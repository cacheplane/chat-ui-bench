import {test,expect} from 'vitest';
import {comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';
import {page,install,mainOptions} from './comparison-page.test-helper.mts';

const options={...mainOptions,scoredScrollSampling:{mode:'fresh-page-acquisition' as const,minimumPostToLaterPageMs:800 as const,maxWaitCallbacks:64 as const}};
function fixture(setup?:(p:ReturnType<typeof page>)=>void){
  const p=page(),waits=new Map<number,()=>void>(),delays:number[]=[];let id=1000;
  const original=p.context.setTimeout;p.context.setTimeout=(callback:()=>void,delay:number)=>{if(delay===50)return original(callback,delay);delays.push(delay);waits.set(++id,callback);return id;};
  const clear=p.context.clearTimeout;p.context.clearTimeout=(token:number)=>{waits.delete(token);clear(token);};
  setup?.(p);
  return {p,waits,delays,state:install(p,true,options),wake(time:number){p.setTime(time);const [token,callback]=waits.entries().next().value??[];waits.delete(token);callback?.();}};
}
test('fresh immediate acquisition uses current content/page time and leaves poll cache/statistics unchanged',async()=>{
  const {p,state}=fixture();p.setText('A');p.tick(51);const poll=state.readScroll(),stats=state.readInstrumentation();state.drain(64);p.setText('B');p.setTime(73);
  expect(await state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{timestampMs:73,activeVisible:true}});
  expect(state.readScroll()).toEqual(poll);expect(state.readInstrumentation().scrollProbe).toEqual(stats.scrollProbe);
  const rows=state.drain(64).map(row=>JSON.parse(row.serialized));expect(rows.map(row=>row.kind)).toEqual(['scroll-checkpoint']);
  expect((state.readInstrumentation() as any).freshScrollProbe).toMatchObject({samplingMode:'on-demand',callbacks:1,maximumObservedGapMs:{status:'unavailable'}});state.stop();
});
test('later fresh request waits for actual page post+800 despite opposite poll age jitter',async()=>{
  const f=fixture();f.p.setText('A');f.p.tick(199);f.p.setTime(243);const post=await f.state.readScrollFresh({notBeforePageMs:null});expect(post).toMatchObject({status:'available',value:{timestampMs:243}});
  f.p.tick(999);f.p.setTime(1000);let settled=false;const later=f.state.readScrollFresh({notBeforePageMs:1043});void later.then(()=>{settled=true;});await Promise.resolve();expect(settled).toBe(false);expect(f.delays).toEqual([43]);
  f.wake(1042);await Promise.resolve();expect(settled).toBe(false);expect(f.delays).toEqual([43,1]);f.wake(1044);
  expect(await later).toMatchObject({status:'available',value:{timestampMs:1044}});expect(f.state.readScroll()).toMatchObject({status:'available',value:{timestampMs:999}});
  const instrumentation=f.state.readInstrumentation();expect((instrumentation as any).freshScrollProbe).toMatchObject({callbacks:2,maximumObservedGapMs:{status:'available',value:801}});comparisonSchemasForVersionPair({collectorVersion:'2.1.0',analyzerVersion:'2.1.0'}).comparisonInstrumentationSchema.parse(instrumentation);f.state.stop();
});
test('fresh request reservation includes immediate settlement and rejects concurrent admission',async()=>{
  const f=fixture();f.p.setText('A');const original=f.p.bridge.readCaptureCandidates;let nested:Promise<any>|undefined;
  f.p.bridge.readCaptureCandidates=()=>{if(!nested)nested=f.state.readScrollFresh({notBeforePageMs:null});return original();};
  const result=await f.state.readScrollFresh({notBeforePageMs:null});expect(result.status).toBe('available');expect(await nested).toEqual({status:'unavailable',reason:'Fresh scroll acquisition already pending'});f.state.stop();
});
test('stop settles the original pending request even if clearTimeout throws and stale callback does no work',async()=>{
  const f=fixture();f.p.setText('A');const request=f.state.readScrollFresh({notBeforePageMs:1000}),callback=[...f.waits.values()][0];let reads=0;f.p.context.performance.now=()=>{reads++;return 1000;};f.p.context.clearTimeout=()=>{throw false;};
  f.state.stop();expect(await request).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});const stoppedReads=reads;callback?.();expect(reads).toBe(stoppedReads);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
});
test.each([NaN,Infinity,-1])('malformed minimum %s never acquires or fabricates a timestamp',async minimum=>{
  const f=fixture();expect(await f.state.readScrollFresh({notBeforePageMs:minimum})).toEqual({status:'unavailable',reason:'Fresh scroll minimum timestamp invalid'});expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);f.state.stop();
});
test('wait callbacks are bounded to64 actual admissions with one timer and no sample work',async()=>{
  const f=fixture();let reads=0;f.p.bridge.readCaptureCandidates=()=>{reads++;throw Error('must not sample');};const request=f.state.readScrollFresh({notBeforePageMs:1000});
  for(let index=0;index<64;index++){expect(f.waits.size).toBe(1);f.wake(index+2);}
  expect(await request).toEqual({status:'unavailable',reason:'Fresh scroll wait callback limit exceeded'});expect(f.waits.size).toBe(0);expect(reads).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);f.state.stop();
});
test.each([1,0,NaN,Infinity])('frozen/decreasing/nonfinite wait clock %s settles without sample',async clock=>{
  const f=fixture();const request=f.state.readScrollFresh({notBeforePageMs:1000});f.wake(clock);expect(await request).toEqual({status:'unavailable',reason:'Fresh scroll page clock unavailable'});expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);f.state.stop();
});
test.each([undefined,null,false,0,''])('installed-then-thrown timer setup %j settles and closes its unknown-token callback',async failure=>{
  let queued:(()=>void)|undefined;const f=fixture(p=>{const original=p.context.setTimeout;p.context.setTimeout=(callback:()=>void,delay:number)=>{if(delay===50)return original(callback,delay);queued=callback;throw failure;};});
  expect((await f.state.readScrollFresh({notBeforePageMs:1000})).status).toBe('unavailable');let clocks=0;f.p.context.performance.now=()=>{clocks++;return 1000;};queued?.();expect(clocks).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);f.state.stop();
});
test('stop revokes fresh admission before attempted timer cancellation and still cleans other resources',async()=>{
  let nested:Promise<any>|undefined;const f=fixture(p=>{p.context.clearTimeout=()=>{nested=f.state.readScrollFresh({notBeforePageMs:null});throw false;};});const request=f.state.readScrollFresh({notBeforePageMs:1000});
  f.state.stop();expect(await request).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(await nested).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect([...f.p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});
});
test('fresh mutation cleanup failure produces no successful record or poll cache change',async()=>{
  let stopped=0,fail=false;const f=fixture(p=>{p.context.MutationObserver=class{observe(){}takeRecords(){return [];}disconnect(){stopped++;if(fail)throw 0;}};});f.p.setText('A');f.p.tick(51);const cached=f.state.readScroll();f.state.drain(64);stopped=0;fail=true;
  expect((await f.state.readScrollFresh({notBeforePageMs:null})).status).toBe('unavailable');expect(stopped).toBe(1);expect(f.state.readScroll()).toEqual(cached);expect(f.state.drain(64).map(row=>JSON.parse(row.serialized)).some(row=>row.kind==='scroll-checkpoint')).toBe(false);f.state.stop();
});
test('invalid acquisition end clock fails closed rather than clamping observer duration',async()=>{
  const f=fixture();f.p.setText('A');let reads=0;f.p.context.performance.now=()=>++reads===1?73:72;expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll page clock unavailable'});expect(()=>f.state.readInstrumentation()).toThrow('Fresh scroll page clock unavailable');f.state.stop();
});
test.each([undefined,null,false,0,'',{}])('fresh primary %j precedes independent mutation cleanup failure exactly',async primary=>{
  const cleanup={},pairs:unknown[][]=[];const f=fixture(p=>{p.context.AggregateError=class extends AggregateError{constructor(errors:unknown[],message:string){pairs.push(errors);super(errors,message);}};p.context.MutationObserver=class{observe(){}takeRecords(){return [];}disconnect(){throw cleanup;}};});
  f.p.bridge.readCaptureCandidates=()=>{throw primary;};expect((await f.state.readScrollFresh({notBeforePageMs:null})).status).toBe('unavailable');expect(pairs).toHaveLength(1);expect(pairs[0]![0]).toBe(primary);expect(pairs[0]![1]).toBe(cleanup);f.state.stop();
});
test('poll and scored anchors are independent, and scored same-ID replacement never reselects',async()=>{
  const f=fixture();f.p.setText('A');function candidate(id:string){const node:any={nodeType:3,length:1,data:'B',isConnected:true,parentElement:null},content:any={isConnected:true,parentElement:f.p.scroller,contains:(v:any)=>v===node,nodes:[node]};node.parentElement=content;return {id,role:'user',hostElement:{...f.p.host},contentElement:content};}
  const poll=candidate('poll'),scored=candidate('scored');let history=[poll];f.p.bridge.readCaptureCandidates=()=>({status:'available',value:{active:f.p.candidate,historical:history}});
  f.p.tick(51);expect(f.state.readScroll()).toMatchObject({status:'available',value:{anchorId:'poll'}});history=[scored];f.p.setTime(73);expect(await f.state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{anchorId:'scored',anchorGeometry:{status:'available'}}});expect(f.state.readScroll()).toMatchObject({status:'available',value:{anchorId:'poll'}});
  history=[candidate('scored'),poll];f.p.setTime(74);expect(await f.state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{anchorId:'scored',anchorGeometry:{status:'unavailable',reason:'Historical anchor owner changed'}}});f.state.stop();
});
test('reentrant stop in candidate acquisition revokes the body before traversal/layout/end clock or success emission',async()=>{
  const f=fixture();f.p.setText('A');let revoked=false,afterClock=0,afterTraversal=0,afterLayout=0;
  const now=f.p.context.performance.now;f.p.context.performance.now=()=>{if(revoked)afterClock++;return now();};
  const walker=f.p.context.document.createTreeWalker;f.p.context.document.createTreeWalker=(root:any)=>{if(revoked)afterTraversal++;return walker(root);};
  const range=f.p.context.document.createRange;f.p.context.document.createRange=()=>{if(revoked)afterLayout++;return range();};
  const candidates=f.p.bridge.readCaptureCandidates;f.p.bridge.readCaptureCandidates=()=>{f.state.stop();revoked=true;return candidates();};
  expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect({afterClock,afterTraversal,afterLayout}).toEqual({afterClock:0,afterTraversal:0,afterLayout:0});expect(f.state.drain(64).map(row=>JSON.parse(row.serialized)).some(row=>row.kind==='scroll-checkpoint')).toBe(false);
});
test.each(['text','style','range'])('reentrant stop from %s keeps independent cleanup and forbids later probes',async boundary=>{
  let f:ReturnType<typeof fixture>,revoked=false,afterClock=0,afterRange=0,detached=0,disconnected=0;f=fixture(p=>{
    p.context.MutationObserver=class{observe(){}takeRecords(){return [];}disconnect(){disconnected++;}};
    const now=p.context.performance.now;p.context.performance.now=()=>{if(revoked)afterClock++;return now();};
    const style=p.context.getComputedStyle;p.context.getComputedStyle=(element:any)=>{if(boundary==='style'){f.state.stop();revoked=true;}return style(element);};
    if(boundary==='text')Object.defineProperty(p.node,'data',{get(){f.state.stop();revoked=true;return 'A';}});
    const original=p.context.document.createRange;p.context.document.createRange=()=>{if(revoked)afterRange++;const range=original();return {...range,getBoundingClientRect:()=>{if(boundary==='range'){f.state.stop();revoked=true;}return {left:0,top:0,right:10,bottom:10};},detach:()=>{detached++;}};};
  });f.p.setText('A');expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(afterClock).toBe(0);expect(afterRange).toBe(0);expect(disconnected).toBe(1);expect(detached).toBe(boundary==='range'?1:0);expect(()=>f.state.readInstrumentation()).toThrow('Fresh scroll acquisition stopped');expect(f.state.drain(64).map(row=>JSON.parse(row.serialized)).some(row=>row.kind==='scroll-checkpoint')).toBe(false);
});
test('first clock reentrant stop prevents any timer or acquisition admission',async()=>{
  const f=fixture();f.p.context.performance.now=()=>{f.state.stop();return 1;};expect(await f.state.readScrollFresh({notBeforePageMs:1000})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(f.waits.size).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
});
test('end clock reentrant stop prevents a success record and complete timing statistics',async()=>{
  const f=fixture();f.p.setText('A');f.state.drain(64);let reads=0;f.p.context.performance.now=()=>{if(++reads===2)f.state.stop();return 73;};expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(f.state.drain(64).map(row=>JSON.parse(row.serialized)).some(row=>row.kind==='scroll-checkpoint')).toBe(false);expect(()=>f.state.readInstrumentation()).toThrow('Fresh scroll acquisition stopped');
});
test('reentrant timer provider stop still clears the newly returned timer token independently',async()=>{
  let f:ReturnType<typeof fixture>;const tokens:number[]=[];f=fixture(p=>{const original=p.context.setTimeout,clear=p.context.clearTimeout;p.context.setTimeout=(callback:()=>void,delay:number)=>{if(delay===50)return original(callback,delay);f.state.stop();return original(callback,delay);};p.context.clearTimeout=(token:number)=>{tokens.push(token);clear(token);};});
  expect(await f.state.readScrollFresh({notBeforePageMs:1000})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(f.waits.size).toBe(0);expect(tokens).toContain(1001);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
});
test('original primitive wait target cannot be lowered by mutating the caller request',async()=>{
  const f=fixture();f.p.setText('A');const input:{notBeforePageMs:number|null}={notBeforePageMs:1000};let settled=false;const request=f.state.readScrollFresh(input);void request.then(()=>{settled=true;});input.notBeforePageMs=null;f.wake(2);await Promise.resolve();expect(settled).toBe(false);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);f.wake(1000);expect(await request).toMatchObject({status:'available',value:{timestampMs:1000}});f.state.stop();
});
test.each(['keys','target'])('request %s reentrant stop revokes admission before clock or timer',async boundary=>{
  const f=fixture();let reads=0;f.p.context.performance.now=()=>{reads++;return 1;};const input=boundary==='target'?Object.defineProperty({},'notBeforePageMs',{enumerable:true,get(){f.state.stop();return 1000;}}):new Proxy({notBeforePageMs:1000},{ownKeys(){f.state.stop();return ['notBeforePageMs'];}});
  expect(await f.state.readScrollFresh(input as {notBeforePageMs:number|null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(reads).toBe(0);expect(f.waits.size).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
});
test('newly returned token cancellation failure cannot reopen its revoked callback',async()=>{
  let f:ReturnType<typeof fixture>,afterClock=0;const tokens:number[]=[];f=fixture(p=>{const original=p.context.setTimeout;p.context.setTimeout=(callback:()=>void,delay:number)=>{if(delay===50)return original(callback,delay);f.state.stop();return original(callback,delay);};p.context.clearTimeout=(token:number)=>{tokens.push(token);throw false;};});
  expect(await f.state.readScrollFresh({notBeforePageMs:1000})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(tokens).toContain(1001);f.p.context.performance.now=()=>{afterClock++;return 1000;};f.wake(1000);expect(afterClock).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
});
for(const boundary of ['keys','target'] as const)test.each([undefined,null,false,0,'',{}])('throwing '+boundary+' %j settles its reservation before the next valid request',async primary=>{
  const f=fixture();f.p.setText('A');const input=boundary==='target'?Object.defineProperty({},'notBeforePageMs',{enumerable:true,get(){throw primary;}}):new Proxy({notBeforePageMs:1000},{ownKeys(){throw primary;}});
  expect((await f.state.readScrollFresh(input as {notBeforePageMs:number|null})).status).toBe('unavailable');expect(await f.state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{timestampMs:1}});f.state.stop();
});

test.each([NaN,Infinity,-1])('preclock invalid target %s returns unavailable without inventing a page observation',async minimum=>{
  const f=fixture();f.p.setText('A');f.state.drain(64);let clocks=0;
  f.p.context.performance.now=()=>{clocks++;return 73;};
  try{
    expect(await f.state.readScrollFresh({notBeforePageMs:minimum})).toEqual({status:'unavailable',reason:'Fresh scroll minimum timestamp invalid'});
    expect(clocks).toBe(0);expect(f.waits.size).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
    expect(f.state.drain(64)).toEqual([]);
    expect(await f.state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{timestampMs:73}});
  }finally{f.state.stop();}
});
test.each([undefined,null,false,0,''])('preclock thrown value %j returns unavailable without inventing a page observation',async failure=>{
  const f=fixture();f.p.setText('A');f.state.drain(64);let clocks=0;
  f.p.context.performance.now=()=>{clocks++;throw failure;};
  try{
    expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll page clock unavailable'});
    expect(clocks).toBe(1);expect(f.waits.size).toBe(0);expect((f.state.readInstrumentation() as any).freshScrollProbe.callbacks).toBe(0);
    expect(f.state.drain(64)).toEqual([]);
    f.p.context.performance.now=()=>73;
    expect(await f.state.readScrollFresh({notBeforePageMs:null})).toMatchObject({status:'available',value:{timestampMs:73}});
  }finally{f.state.stop();}
});
test('failure after an observed wait clock retains that actual page timestamp',async()=>{
  const f=fixture();f.state.drain(64);
  try{
    const request=f.state.readScrollFresh({notBeforePageMs:1000});f.wake(NaN);
    expect(await request).toEqual({status:'unavailable',reason:'Fresh scroll page clock unavailable'});
    const rows=f.state.drain(64).map(row=>JSON.parse(row.serialized));
    expect(rows).toEqual([expect.objectContaining({kind:'probe-unavailable',timestampMs:1})]);
  }finally{f.state.stop();}
});
test('first clock stop plus falsy timer cancellation cannot reenter stop and retains every independent cleanup',async()=>{
  const f=fixture(p=>{p.context.clearTimeout=()=>{throw false;};});let clocks=0;
  f.p.context.performance.now=()=>{clocks++;if(clocks>8)throw new Error('Controlled recursive stop bound');f.state.stop();return 1;};
  expect(await f.state.readScrollFresh({notBeforePageMs:null})).toEqual({status:'unavailable',reason:'Fresh scroll acquisition stopped'});expect(clocks).toBeLessThanOrEqual(2);expect([...f.p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);expect(f.p.context.console.error).toBe(f.p.nativeConsole.error);expect(f.p.context.console.warn).toBe(f.p.nativeConsole.warn);
});
test('cleanup failure recording clock throw cannot skip later cleanup or replace original error order',()=>{
  const primary=false,recordingFailure={},pairs:unknown[][]=[];const f=fixture(p=>{p.context.clearTimeout=()=>{throw primary;};p.context.AggregateError=class extends AggregateError{constructor(errors:unknown[],message:string){pairs.push(errors);super(errors,message);}};});
  f.p.context.performance.now=()=>{throw recordingFailure;};let failed=false,error:unknown;try{f.state.stop();}catch(value){failed=true;error=value;}
  expect([...f.p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);expect(f.p.context.console.error).toBe(f.p.nativeConsole.error);expect(f.p.context.console.warn).toBe(f.p.nativeConsole.warn);expect(failed).toBe(true);expect(pairs).toHaveLength(1);expect(pairs[0]![0]).toBe(primary);expect(pairs[0]![1]).toBe(recordingFailure);expect(error).toBeInstanceOf(AggregateError);expect(()=>f.state.stop()).not.toThrow();
});
