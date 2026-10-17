import {describe,it,expect} from 'vitest';
import {runMountedTrackerA} from '../apps/copilotkit/runtime/mounted-tracker-a.ts';

describe('finite supplied tracker-A sequencer',()=>{
 it('retains a null original connection rejection through client cleanup',async()=>{
  let closes=0,opens=0;
  const result=await runMountedTrackerA({profileRef:{path:'tracker-a-profile.json',bytes:1,sha256:'a'.repeat(64)},clock:{now:()=>0,deadlineHostMs:120000,alarm:()=>()=>{},waitUntil:async()=>{}},connect:async()=>{throw null;},openFollow:async()=>{opens++;throw Error('unreachable');},openHistory:async()=>{opens++;throw Error('unreachable');},closeClient:async()=>{closes++;throw undefined;}});
  expect(result.hasPrimary).toBe(true);expect(result.primary).toBe(null);expect(result.cleanupFailures).toEqual([undefined]);expect(closes).toBe(1);expect(opens).toBe(0);
 });
});

import type {GeometrySnapshot} from '../apps/copilotkit/src/geometry.ts';
import {evaluateMountedGeometry} from '../apps/copilotkit/src/geometry-policy.ts';
import {MOUNTED_CASE_WITNESS_LABELS,type CaseRecord} from './support/hosted-copilot-mounted-policy.ts';
import type {createMountedTrackerATrace} from '../apps/copilotkit/runtime/mounted-tracker-a-trace.ts';
type Trace=ReturnType<typeof createMountedTrackerATrace>;
function frame(n:1|2,phase:'restored-history'|'streaming'|'completed',pageMs=0,prefix='R'):GeometrySnapshot {
 const data={schemaVersion:1 as const,scopeId:`thread-${n}`,clockDomain:'page-performance-ms' as const,observedAtPageMs:pageMs,phase,expectedHistory:Array.from({length:100},(_,i)=>({id:`H${i}`,role:'user' as const,text:'H'.repeat(512)})),expectedResponse:{id:'R',role:'assistant' as const,text:'R'.repeat(6400)},responseProgress:phase==='restored-history'?{active:false,prefix:''}:phase==='completed'?{active:false,prefix:'R'.repeat(6400)}:{active:true,prefix},viewport:{x:0,y:0,width:1280,height:800},nativeViewport:{x:0,y:0,width:1280,height:800},rows:[{id:'H0',role:'user' as const,presence:'mounted' as const,ownerToken:1,observedText:'H'.repeat(512),textRects:[{x:0,y:10,width:100,height:20}],ancestorClips:[]},...(phase==='restored-history'?[]:[{id:'R',role:'assistant' as const,presence:'mounted' as const,ownerToken:2,observedText:phase==='completed'?'R'.repeat(6400):prefix,textRects:[{x:0,y:40,width:100,height:20}],ancestorClips:[]}])]};
 return {status:'available',frame:data,evaluation:evaluateMountedGeometry(data),visibleMessages:[],scroll:{scrollTop:1000,scrollHeight:2000,clientHeight:500}};
}
function caseRecord(n:1|2):CaseRecord{return {caseNumber:n,journey:n===1?'follow':'history-reading',threadId:`thread-${n}`,seedRunId:`seed-${n}`,continuationRunId:`continue-${n}`,repetition:`rep-${n}`,completed:true,publicIdle:true,storeEmpty:true,domainReleased:true,originals:MOUNTED_CASE_WITNESS_LABELS.map(label=>({label,status:'fulfilled'}))};}
function fixture(){
 let now=0,top=1000,geometry=0;const calls:string[]=[],alarms=new Map<()=>void,number>();
 const clock={now:()=>now,deadlineHostMs:120000,alarm:(at:number,fire:()=>void)=>{alarms.set(fire,at);return ()=>{alarms.delete(fire);};},waitUntil:async(at:number)=>{advance(at);}};
 function advance(at:number){now=Math.max(now,at);for(const [fire,t] of [...alarms])if(t<=now){alarms.delete(fire);fire();}}
 const scalar=()=>({pageNowMs:now+7000,url:'http://localhost:1234/',sameOriginalScroller:true,connected:true,uniqueSelector:true,innerWidth:1280,innerHeight:800,devicePixelRatio:1,rect:{x:10,y:20,width:500,height:500},scrollTop:top,scrollHeight:2000,clientHeight:500});
 const events:{ordinal:number;receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;isTrusted:boolean;deltaX:number;deltaY:number;deltaMode:number;targetContained:boolean;currentTargetIsScroller:boolean}[]=[];
 const listeners=Object.fromEntries(['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'].map(name=>[name,{install:async()=>{calls.push(`install-${name}`);return true;},remove:async()=>{calls.push(`remove-${name}`);return true;}}])) as Record<'wheel'|'scroll'|'animationstart'|'transitionrun'|'navigation'|'contextClose'|'pageClose',{install:()=>Promise<boolean>;remove:()=>Promise<boolean>}>;
 const trace={start:async()=>{calls.push('trace-start');},finish:async()=>{calls.push('trace-finish');},snapshot:()=>({outcome:{capture:{status:'complete',reason:null},containment:'verified'},sessionClose:{firstHostMs:null,overflowHostMs:null,timing:'expected-detach'}})} as unknown as Trace;
 const history={baseline:scalar(),seed:async()=>{calls.push('seed-2');},restore:async()=>{calls.push('G0');return frame(2,'restored-history');},acquireTrace:async()=>{calls.push('acquire-trace');return trace;},listeners,startContinuation:async()=>{calls.push('start-2');},waitActivePrefix:async()=>({active:true,prefixLength:1}),geometry:async()=>{calls.push(`G${++geometry}`);return frame(2,'streaming',geometry===1?100:2100,geometry===1?'R':'RR');},movePointer:async(x:number,y:number)=>{calls.push(`pointer-${x}-${y}`);},scalar:async()=>scalar(),wheel:async(dx:0,dy:-12)=>{calls.push('wheel');top+=dy;events.push({ordinal:events.length+1,receivedHostMs:now,pageNowMs:now+7000,eventTimeStampMs:now+6999,isTrusted:true,deltaX:dx,deltaY:dy,deltaMode:0,targetContained:true,currentTargetIsScroller:true});},returnToResponse:async()=>{calls.push('return');},complete:async()=>{calls.push('G4');return frame(2,'completed',11000);},close:async()=>{calls.push('close-2');return caseRecord(2);},observations:()=>({wheelEvents:events,scrollEvents:[],motionEvents:[],losses:{navigation:null,context:null,page:null,session:null},overflows:{wheel:null,scroll:null,motion:null}})};
 const follow={seed:async()=>{calls.push('seed-1');},restore:async()=>frame(1,'restored-history'),startContinuation:async()=>{calls.push('start-1');},exercise:async()=>({samples:[frame(1,'streaming',0),frame(1,'streaming',800,'RR')],anchorId:null,returned:null,wheel:null}),complete:async()=>{calls.push('complete-1');return frame(1,'completed');},close:async()=>{calls.push('close-1');return caseRecord(1);}};
 const ports={profileRef:{path:'tracker-a-profile.json' as const,bytes:1,sha256:'a'.repeat(64)},clock,connect:async()=>{calls.push('connect');},openFollow:async()=>{calls.push('open-1');return follow;},openHistory:async()=>{calls.push('open-2');return history;},closeClient:async()=>{calls.push('client-close');}};
 return {ports,history,follow,calls,clock,advance,events,scalar,get now(){return now;}};
}

describe('fixed two-case trajectory',()=>{
 it('closes follow before history and retains five checkpoints, forty slots and eighty-two scalars',async()=>{
  const f=fixture(),r=await runMountedTrackerA(f.ports);
  expect(r.hasPrimary).toBe(false);expect(r.status).toBe('complete');expect(r.cases).toHaveLength(2);
  expect(f.calls.indexOf('close-1')).toBeLessThan(f.calls.indexOf('open-2'));expect(f.calls.indexOf('G0')).toBeLessThan(f.calls.indexOf('trace-start'));expect(f.calls.indexOf('trace-start')).toBeLessThan(f.calls.indexOf('start-2'));
  expect(r.input?.scalarObservations).toHaveLength(82);expect(r.input?.wheelRequests).toHaveLength(40);expect(r.input?.wheelEvents).toHaveLength(40);expect(r.input?.phase.hostT0Ms).toBe(500);expect(r.input?.phase.hostT1Ms).toBe(2500);expect(r.input?.phase.tail).toMatchObject({status:'fulfilled',startedHostMs:2500,settledHostMs:4500});
  expect(r.input?.anchor).toMatchObject({id:'H0',ownerToken:1,firstCheckpoint:'G1',secondCheckpoint:'G2',evaluation:{status:'accepted',elapsedMs:2000}});
  expect(Object.values(r.input!.geometryCheckpoints).map(v=>v.snapshotRef?.index)).toEqual([0,1,2,3,4]);expect(f.calls.indexOf('G2')).toBeLessThan(f.calls.indexOf('return'));expect(f.calls.indexOf('G4')).toBeLessThan(f.calls.indexOf('trace-finish'));expect(f.calls.indexOf('trace-finish')).toBeLessThan(f.calls.indexOf('close-2'));expect(f.calls.at(-1)).toBe('client-close');expect(r.input?.outcome).toEqual({phase:{status:'complete',reason:null},competingMotion:'unavailable',scenarioQualification:'unavailable'});
 });
 it('never opens history after failed follow closure',async()=>{const f=fixture();f.follow.close=async()=>({...caseRecord(1),domainReleased:false});const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(f.calls).not.toContain('open-2');});
 it('requires original active positive public prefix before G1 or pointer',async()=>{const f=fixture();f.history.waitActivePrefix=async()=>({active:false,prefixLength:0});const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(f.calls).not.toContain('G1');expect(f.calls).not.toContain('wheel');expect(f.calls).toContain('trace-finish');expect(f.calls).toContain('close-2');});
 it.each(['before','wheel','after'] as const)('refuses an exact upper-bound %s settlement without catchup or shifted t1',async kind=>{
  const f=fixture();let reads=0;const original=f.history.scalar,originalWheel=f.history.wheel;
  f.history.scalar=async()=>{reads++;if((kind==='before'&&reads===2)||(kind==='after'&&reads===3))f.advance(550);return original();};
  f.history.wheel=async(dx,dy)=>{await originalWheel(dx,dy);if(kind==='wheel')f.advance(550);};
  const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.input?.phase.hostT0Ms).toBe(500);expect(r.input?.phase.hostT1Ms).toBe(2500);expect(r.input?.wheelRequests.length).toBeLessThanOrEqual(1);expect(r.input?.outcome.phase.status).toBe('incomplete');expect(r.input?.scalarObservations.at(-1)?.role).toBe('post');if(kind!=='before')expect(f.calls).toContain('G4');else expect(f.calls).not.toContain('return');expect(f.calls).toContain('trace-finish');
 });
 it('stops on a missed wakeup without moving the declared boundary',async()=>{const f=fixture(),wait=f.clock.waitUntil;f.clock.waitUntil=async at=>{await wait(at===550?600:at);};const r=await runMountedTrackerA(f.ports);expect(r.input?.wheelRequests).toHaveLength(1);expect(r.input?.phase.hostT1Ms).toBe(2500);expect(r.hasPrimary).toBe(true);});
 it('retains a pending wheel original and admits no overlapping post scalar until its late settlement',async()=>{
  const f=fixture();let resolve!:()=>void,reads=0;const scalar=f.history.scalar;f.history.scalar=async()=>{reads++;return scalar();};f.history.wheel=()=>new Promise<void>(yes=>{resolve=yes;});let settled=false;
  const run=runMountedTrackerA(f.ports).then(r=>{settled=true;return r;});for(let i=0;i<100;i++)await Promise.resolve();expect(reads).toBe(2);f.advance(550);for(let i=0;i<30;i++)await Promise.resolve();expect(reads).toBe(2);expect(settled).toBe(false);resolve();const r=await run;expect(r.input?.wheelRequests).toHaveLength(1);expect(r.input?.wheelRequests[0]?.status).toBe('fulfilled');expect(r.input?.scalarObservations.map(s=>s.role)).toEqual(['pre','before','post']);expect(r.hasPrimary).toBe(true);
 });
 it('forbids G2 and click after rejected postboundary scalar but attempts trace and case cleanup',async()=>{const f=fixture();let reads=0;const scalar=f.history.scalar;f.history.scalar=async()=>{if(++reads===82)throw null;return scalar();};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.primary).toBe(null);expect(r.input?.phase.postBoundarySettled).toBe('rejected');expect(f.calls).not.toContain('G2');expect(f.calls).not.toContain('return');expect(f.calls).not.toContain('G4');expect(f.calls).toContain('trace-finish');expect(f.calls).toContain('close-2');});
 it('preserves the first G1 anchor even when G2 makes it unavailable',async()=>{const f=fixture(),geometry=f.history.geometry;let n=0;f.history.geometry=async()=>{const s=await geometry();if(++n===2&&s.status==='available')return {...s,frame:{...s.frame,observedAtPageMs:200}};return s;};const r=await runMountedTrackerA(f.ports);expect(r.input?.anchor?.id).toBe('H0');expect(r.input?.anchor?.evaluation?.reason).toBe('interval-too-short');expect(f.calls.filter(c=>c==='G2')).toHaveLength(1);expect(f.calls).not.toContain('return');});
 it('never starts the closing tail when original completion fails',async()=>{const f=fixture();f.history.complete=async()=>{throw undefined;};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.primary).toBe(undefined);expect(r.input?.phase.tail.status).toBe('not-started');expect(f.calls).toContain('trace-finish');expect(f.calls).toContain('close-2');});
});

describe('bounded supplied facts',()=>{
 it.each(['missing-wheel','untrusted','wrong-delta','reversed-page','scroll-down','wheel-overflow','scroll-overflow','motion-overflow','navigation','context','page','session','motion','accessor','oversize'] as const)('retains unavailable phase for %s without promoting observations',async kind=>{
  const f=fixture(),get=f.history.observations;let getterReads=0;
  Object.assign(f.history,{observations:()=>{const r:Record<string,unknown>=get();
   if(kind==='missing-wheel')r.wheelEvents=[];
   if(kind==='untrusted')r.wheelEvents=f.events.map((e,i)=>i===0?{...e,isTrusted:false}:e);
   if(kind==='wrong-delta')r.wheelEvents=f.events.map((e,i)=>i===0?{...e,deltaY:-600}:e);
   if(kind==='reversed-page')r.wheelEvents=f.events.map((e,i)=>i===1?{...e,pageNowMs:0}:e);
   if(kind==='scroll-down')r.scrollEvents=[{ordinal:1,receivedHostMs:600,pageNowMs:7600,eventTimeStampMs:7599,currentTargetIsScroller:true,scrollTop:900,scrollHeight:2000,clientHeight:500},{ordinal:2,receivedHostMs:700,pageNowMs:7700,eventTimeStampMs:7699,currentTargetIsScroller:true,scrollTop:910,scrollHeight:2000,clientHeight:500}];
   if(kind.endsWith('-overflow'))r.overflows={wheel:null,scroll:null,motion:null,[kind.split('-')[0]!]:{firstHostMs:650,ordinal:kind==='wheel-overflow'?41:kind==='scroll-overflow'?257:33}};
   if(['navigation','context','page','session'].includes(kind))r.losses={navigation:null,context:null,page:null,session:null,[kind]:{firstHostMs:650,firstOverflowHostMs:651}};
   if(kind==='motion')r.motionEvents=[{ordinal:1,kind:'animationstart',receivedHostMs:650,pageNowMs:7650,eventTimeStampMs:7649,targetContained:true}];
   if(kind==='accessor'){const a=[...f.events];Object.defineProperty(a,0,{get(){getterReads++;throw Error('getter');}});r.wheelEvents=a;}
   if(kind==='oversize'){const a=new Array(41);Object.defineProperty(a,0,{get(){getterReads++;throw Error('getter');}});r.wheelEvents=a;}
   return r;
  }});
  const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.input?.outcome.phase.status).toBe('incomplete');expect(r.input?.outcome.scenarioQualification).toBe('unavailable');expect(getterReads).toBe(0);expect(f.calls).toContain('trace-finish');expect(f.calls).toContain('close-2');
 });
 it.each(['url','utf8','surrogate','nan','viewport','dpr','scroller','rect','range','extra','getter'] as const)('rejects invalid %s scalar before dispatch and preserves exact fulfilled finite guard evidence',async kind=>{
  const f=fixture();let getters=0;const s:Record<string,unknown>={...f.scalar()};
  if(kind==='url')s.url='x'.repeat(4097);if(kind==='utf8')s.url='é'.repeat(2049);if(kind==='surrogate')s.url='\ud800';if(kind==='nan')s.pageNowMs=NaN;if(kind==='viewport')s.innerWidth=1279;if(kind==='dpr')s.devicePixelRatio=2;if(kind==='scroller')s.sameOriginalScroller=false;if(kind==='rect')s.rect={x:11,y:20,width:500,height:500};if(kind==='range')s.scrollTop=1501;if(kind==='extra')s.text='never copied';if(kind==='getter')Object.defineProperty(s,'url',{get(){getters++;return 'secret';}});
  Object.assign(f.history,{scalar:async()=>s});const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.input?.wheelRequests).toHaveLength(0);expect(r.input?.scalarObservations).toHaveLength(1);expect(getters).toBe(0);if(['viewport','dpr','scroller','rect'].includes(kind))expect(r.input?.scalarObservations[0]?.value).toEqual(s);
 });
 it('keeps the last original pending at enclosing expiry, skips post and still attempts cleanup',async()=>{
  const f=fixture();let reject!:(e:unknown)=>void;f.history.wheel=()=>new Promise<void>((_yes,no)=>{reject=no;});const run=runMountedTrackerA(f.ports);for(let i=0;i<100;i++)await Promise.resolve();f.advance(550);for(let i=0;i<30;i++)await Promise.resolve();f.advance(120000);const r=await run;expect(r.input?.wheelRequests[0]?.status).toBe('pending');expect(r.input?.phase.postBoundaryScalarOrdinal).toBe(null);expect(f.calls).toContain('trace-finish');expect(f.calls).not.toContain('close-2');expect(r.cleanupFailures.length).toBeGreaterThan(0);const primary=r.primary;reject(undefined);for(let i=0;i<10;i++)await Promise.resolve();expect(r.input?.wheelRequests[0]?.status).toBe('rejected');expect(r.primary).toBe(primary);
 });
 it('rolls back an original partially installed listener and retains its rejected registration',async()=>{const f=fixture();f.history.listeners.scroll.install=async()=>{throw null;};const r=await runMountedTrackerA(f.ports);expect(r.primary).toBe(null);expect(r.input?.listeners.scroll.registration.status).toBe('rejected');expect(r.input?.listeners.scroll.removal.status).toBe('fulfilled');expect(f.calls).not.toContain('trace-start');expect(f.calls).toContain('trace-finish');});
});

describe('original deadlines and independent closure',()=>{
 it('admits no original connect after exhausted enclosing deadline',async()=>{const f=fixture();f.advance(120000);const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(f.calls).toEqual([]);});
 it('retains accepted semantic case closure separately from a failed phase',async()=>{const f=fixture(),wheel=f.history.wheel;let n=0;f.history.wheel=async(x,y)=>{await wheel(x,y);if(++n===1)f.advance(550);};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.cases.map(c=>c.caseNumber)).toEqual([1,2]);expect(r.status).toBe('incomplete');});
 it('refuses an early closing-tail fulfillment without changing its requested end',async()=>{const f=fixture();const wait=f.clock.waitUntil;f.clock.waitUntil=async at=>{if(at!==4500)await wait(at);};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.input?.phase.tail.status).toBe('rejected');expect(r.input?.phase.tail.startedHostMs).toBe(2500);});
 it('keeps pending postboundary receipt pending and prohibits G2 through expiry and late rejection',async()=>{const f=fixture(),read=f.history.scalar;let n=0,reject!:(e:unknown)=>void;f.history.scalar=()=>++n===82?new Promise((_yes,no)=>{reject=no;}):read();const run=runMountedTrackerA(f.ports);for(let i=0;i<3000;i++)await Promise.resolve();expect(f.calls).not.toContain('G2');f.advance(120000);const r=await run;expect(r.input?.phase.postBoundarySettled).toBe('pending');reject(null);for(let i=0;i<10;i++)await Promise.resolve();expect(r.input?.phase.postBoundarySettled).toBe('rejected');expect(f.calls).not.toContain('return');});
});

describe('fixed boundary and clock evidence',()=>{
 it('accepts each final legal after-scalar receipt strictly below its half-open upper boundary',async()=>{const f=fixture(),read=f.history.scalar;let n=0;f.history.scalar=async()=>{n++;if(n>1&&n<82&&n%2===1)f.advance(500+50*((n-3)/2)+49.999);return read();};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(false);expect(r.input?.wheelRequests.at(-1)?.slot).toBe(39);expect(r.input?.scalarObservations[80]?.settledHostMs).toBe(2499.999);expect(r.input?.phase.hostT1Ms).toBe(2500);});
 it('keeps page event facts separate when all DOM events arrive in one final owned drain',async()=>{const f=fixture(),observations=f.history.observations;Object.assign(f.history,{observations:()=>({...observations(),wheelEvents:f.events.map(e=>({...e,receivedHostMs:f.now}))})});const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(false);expect(new Set(r.input?.wheelEvents.map(e=>e.receivedHostMs)).size).toBe(1);expect(r.input?.wheelEvents[0]?.pageNowMs).toBe(7500);expect(r.input?.wheelEvents[0]?.receivedHostMs).toBe(4500);expect(r.input?.outcome.scenarioQualification).toBe('unavailable');});
 it('starts t0 at the actual preboundary scalar receipt and retains the independent page clock',async()=>{const f=fixture(),read=f.history.scalar;let n=0;f.history.scalar=async()=>{if(++n===1)f.advance(537);return read();};const r=await runMountedTrackerA(f.ports);expect(r.input?.phase.hostT0Ms).toBe(537);expect(r.input?.phase.hostT1Ms).toBe(2537);expect(r.input?.scalarObservations[0]?.value?.pageNowMs).toBe(7537);});
 it('keeps the full tail after delayed successful canonical completion',async()=>{const f=fixture(),complete=f.history.complete;f.history.complete=async()=>{f.advance(11000);return complete();};const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(false);expect(r.input?.phase.tail).toEqual({status:'fulfilled',startedHostMs:11000,settledHostMs:13000});expect(f.now).toBe(13000);});
 it('charges a synchronous scalar throw once and keeps primary identity across failed removals and case cleanup',async()=>{const f=fixture(),primary=Object.freeze({original:true});let n=0;Object.assign(f.history,{scalar:()=>{n++;throw primary;},close:async()=>{throw null;}});f.history.listeners.wheel.remove=async()=>{throw undefined;};const r=await runMountedTrackerA(f.ports);expect(n).toBe(1);expect(r.primary).toBe(primary);expect(r.cleanupFailures).toContain(null);expect(r.cleanupFailures).toContain(undefined);expect(r.input?.scalarObservations[0]?.status).toBe('rejected');expect(r.input?.scalarObservations[0]?.value).toBe(null);});
});

describe('charge only actual dispatched originals',()=>{
 it.each([1,2,3,4,5,6,7,8])('keeps no phantom request when boundary is reached at host read %i',async boundaryRead=>{
  const f=fixture(),read=f.history.scalar,hostNow=f.clock.now;let scalarCount=0,armed=false,hostReads=0;
  f.history.scalar=async()=>{const value=await read();if(++scalarCount===2)armed=true;return value;};
  f.clock.now=()=>{if(armed&&++hostReads===boundaryRead)f.advance(550);return hostNow();};
  const r=await runMountedTrackerA(f.ports);
  expect(r.input?.wheelRequests.some(row=>row.status==='not-started')).toBe(false);expect(r.input?.scalarObservations.some(row=>row.status==='not-started')).toBe(false);
 });
});

describe('separate observation drain and original completion',()=>{
 it('waits for the held final observation drain after all removals and before case close',async()=>{const f=fixture(),observe=f.history.observations;let resolve!:(v:unknown)=>void;Object.assign(f.history,{observations:()=>{f.calls.push('drain');return new Promise(yes=>{resolve=yes;});}});let done=false;const run=runMountedTrackerA(f.ports).then(r=>{done=true;return r;});for(let i=0;i<3000;i++)await Promise.resolve();expect(f.calls.filter(c=>c.startsWith('remove-'))).toHaveLength(7);expect(f.calls).not.toContain('close-2');expect(done).toBe(false);resolve(observe());const r=await run;expect(r.hasPrimary).toBe(false);expect(f.calls.indexOf('drain')).toBeLessThan(f.calls.indexOf('close-2'));});
 it('retains the exact original asynchronous drain rejection through case and client cleanup',async()=>{const f=fixture();Object.assign(f.history,{observations:async()=>{throw null;}});const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.primary).toBe(null);expect(f.calls).toContain('close-2');expect(f.calls.at(-1)).toBe('client-close');});
 it('accounts for a rejected slot original then obtains post only after fixed t1',async()=>{const f=fixture();f.history.wheel=async()=>{throw null;};const r=await runMountedTrackerA(f.ports);expect(r.primary).toBe(null);expect(r.input?.scalarObservations.map(s=>s.role)).toEqual(['pre','before','post']);expect(r.input?.scalarObservations.at(-1)?.requestedHostMs).toBe(2500);});
 it('retains fulfilled completion separately from a rejected completed-geometry guard',async()=>{const f=fixture();f.history.complete=async()=>frame(2,'streaming',11000,'RRR');const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.input?.phase.completion.status).toBe('fulfilled');expect(r.input?.geometryCheckpoints.G4.status).toBe('fulfilled');expect(r.input?.phase.tail.status).toBe('not-started');});
});

describe('SPEC required acquisition admission',()=>{
 it.each([null,undefined])('retains rejected drain %s and raw closure without accepting case2',async failure=>{
  const f=fixture();let drains=0;Object.assign(f.history,{observations:async()=>{drains++;throw failure;}});
  const r=await runMountedTrackerA(f.ports);
  expect(r.primary).toBe(failure);expect(r.hasPrimary).toBe(true);expect(r.status).toBe('incomplete');expect(r.cases.map(c=>c.caseNumber)).toEqual([1]);expect(r.caseEvidence.map(c=>c.caseNumber)).toEqual([1,2]);expect(drains).toBe(1);
  expect(Object.values(r.input!.listeners).every(fact=>fact.removal.status==='fulfilled')).toBe(true);
 });
 it.each(['resolve','reject'] as const)('retains the once-only held drain original after expiry and late %s',async settlement=>{
  const f=fixture(),observations=f.history.observations;let drains=0,resolve!:(v:unknown)=>void,reject!:(e:unknown)=>void;
  Object.assign(f.history,{observations:()=>{drains++;return new Promise((yes,no)=>{resolve=yes;reject=no;});}});
  const run=runMountedTrackerA(f.ports);for(let i=0;i<3000;i++)await Promise.resolve();f.advance(120000);const r=await run;
  expect(r.cases.map(c=>c.caseNumber)).toEqual([1]);expect(r.status).toBe('incomplete');expect(drains).toBe(1);expect(Object.values(r.input!.listeners).every(fact=>fact.removal.status==='fulfilled')).toBe(true);
  expect(r.inputDrain).toEqual({status:'pending',requestedHostMs:4500,settledHostMs:null});const primary=r.primary;
  if(settlement==='resolve')resolve(observations());else reject(null);
  for(let i=0;i<10;i++)await Promise.resolve();
  expect(r.inputDrain.status).toBe(settlement==='resolve'?'fulfilled':'rejected');expect(r.inputDrain.settledHostMs).toBe(120000);expect(r.primary).toBe(primary);expect(r.cases.map(c=>c.caseNumber)).toEqual([1]);expect(drains).toBe(1);
 });
});

describe('SPEC enclosing deadline clips every slot wait',()=>{
 it.each(['before','wheel','after'] as const)('retains pending %s original while bounded orchestration expires inside slot0',async kind=>{
  const f=fixture();f.clock.deadlineHostMs=525;const read=f.history.scalar;let reads=0,resolve!:(v:unknown)=>void,reject!:(e:unknown)=>void;
  const held=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});
  f.history.scalar=async()=>{reads++;if((kind==='before'&&reads===2)||(kind==='after'&&reads===3))return await held as ReturnType<typeof f.scalar>;return read();};
  if(kind==='wheel')f.history.wheel=async()=>{await held;};
  let done=false;const run=runMountedTrackerA(f.ports).then(r=>{done=true;return r;});for(let i=0;i<150;i++)await Promise.resolve();f.advance(525);for(let i=0;i<100;i++)await Promise.resolve();
  try{expect(done).toBe(true);}finally{f.advance(550);}
  const r=await run;expect(r.status).toBe('incomplete');expect(r.input?.phase.hostT1Ms).toBe(2500);expect(r.input?.phase.postBoundaryScalarOrdinal).toBe(null);expect(r.input?.scalarObservations).toHaveLength(kind==='after'?3:2);expect(r.input?.wheelRequests).toHaveLength(kind==='before'?0:1);
  const row=kind==='wheel'?r.input!.wheelRequests[0]!:r.input!.scalarObservations.at(-1)!;expect(row.status).toBe('pending');const primary=r.primary;
  if(kind==='wheel')reject(null);else resolve(f.scalar());for(let i=0;i<20;i++)await Promise.resolve();expect(row.status).toBe(kind==='wheel'?'rejected':'fulfilled');expect(r.primary).toBe(primary);
 });
});

describe('SPEC original rejection survives unavailable settlement clock',()=>{
 it.each(['scalar','wheel'] as const)('preserves %s null/undefined originals through thrown, nonfinite and reversed clocks',async kind=>{
  for(const clockFailure of ['throw','nonfinite','reversed'] as const)for(const failure of [null,undefined]){
   const f=fixture();const reject=()=>{f.clock.now=()=>{if(clockFailure==='throw')throw Error('clock');return clockFailure==='nonfinite'?NaN:-1;};throw failure;};
   if(kind==='scalar')f.history.scalar=async()=>reject();else f.history.wheel=async()=>reject();
   const r=await runMountedTrackerA(f.ports);expect(r.hasPrimary).toBe(true);expect(r.primary).toBe(failure);expect(r.status).toBe('incomplete');const row=kind==='scalar'?r.input!.scalarObservations[0]!:r.input!.wheelRequests[0]!;expect(row.status).toBe('rejected');expect(row.settledHostMs).toBe(null);expect(r.cleanupFailures.length).toBeGreaterThan(0);
  }
 });
});

describe('SPEC fulfilled data survives a permanently refused receipt clock',()=>{
 it.each(['throw','nonfinite','reversed'] as const)('retains the finite original scalar when the %s receipt clock later recovers',async kind=>{
  const f=fixture(),hostNow=f.clock.now,clockError=Object.freeze({clock:true});const value={...f.scalar(),pageNowMs:12345};let reads=0,clockReads=0;
  f.history.scalar=async()=>{
   reads++;await Promise.resolve();
   f.clock.now=()=>{if(++clockReads===1){if(kind==='throw')throw clockError;return kind==='nonfinite'?NaN:-1;}return hostNow();};
   return value;
  };
  const r=await runMountedTrackerA(f.ports);
  expect(r.hasPrimary).toBe(true);expect(r.status).toBe('incomplete');expect(reads).toBe(1);expect(r.input?.scalarObservations).toHaveLength(1);
  expect(r.input?.scalarObservations[0]).toMatchObject({status:'fulfilled',settledHostMs:null,value});expect(r.input?.phase.hostT0Ms).toBe(null);expect(r.input?.wheelRequests).toHaveLength(0);expect(r.input?.outcome.phase.status).toBe('incomplete');
  if(kind==='throw')expect(r.primary).toBe(clockError);else expect(()=>{throw r.primary;}).toThrow(kind==='nonfinite'?'Nonfinite scalar':'Host clock reversed');
  expect(clockReads).toBe(1);
 });
});

describe('QUALITY required listener-removal coverage',()=>{
 it.each(['reject-null','reject-undefined','wrong-identity','valid'] as const)('records required %s removal coverage while preserving actual originals and drain',async kind=>{
  const f=fixture(),observe=f.history.observations;let removals=0,drains=0;
  f.history.listeners.scroll.remove=async()=>{removals++;f.calls.push('remove-scroll');if(kind==='reject-null')throw null;if(kind==='reject-undefined')throw undefined;return kind==='valid';};
  Object.assign(f.history,{observations:()=>{drains++;f.calls.push('drain');return observe();}});
  const r=await runMountedTrackerA(f.ports);
  expect(r.hasPrimary).toBe(kind!=='valid');expect(r.status).toBe(kind==='valid'?'complete':'incomplete');expect(r.input?.outcome.phase).toEqual(kind==='valid'?{status:'complete',reason:null}:{status:'incomplete',reason:'phase'});expect(removals).toBe(1);expect(drains).toBe(1);expect(r.inputDrain.status).toBe('fulfilled');
  expect(r.input?.listeners.scroll.removal.status).toBe(kind.startsWith('reject')?'rejected':'fulfilled');expect(r.input?.listeners.pageClose.removal.status).toBe('fulfilled');expect(r.caseEvidence.map(c=>c.caseNumber)).toEqual([1,2]);expect(r.cases.map(c=>c.caseNumber)).toEqual([1,2]);
  expect(Object.entries(r.input!.listeners).filter(([name])=>name!=='scroll').every(([,fact])=>fact.removal.status==='fulfilled')).toBe(true);
  expect(f.calls.filter(c=>c.startsWith('remove-'))).toHaveLength(7);expect(f.calls.indexOf('remove-pageClose')).toBeLessThan(f.calls.indexOf('drain'));expect(f.calls.indexOf('drain')).toBeLessThan(f.calls.indexOf('close-2'));
  if(kind.startsWith('reject')){const failure=kind==='reject-null'?null:undefined;expect(r.primary).toBe(failure);expect(r.cleanupFailures).toContain(failure);}else expect(r.input?.listeners.scroll.ownedIdentityMatch).toBe(kind==='valid');
 });
});
