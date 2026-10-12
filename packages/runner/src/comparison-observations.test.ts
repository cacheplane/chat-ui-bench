import {test,expect,vi,afterEach} from 'vitest';
import {createComparisonBuffer,COMPARISON_CAPTURE_LIMITS,comparisonObservationSchema,comparisonInstrumentationSchema,comparisonHostFrameGuardSchema} from '@chat-ui-bench/contract';
import * as implementation from './comparison-observations.js';
import {runInNewContext} from 'node:vm';

import {page,install,preOptions,mainOptions,controlledRangeGeometry} from './comparison-page.test-helper.mts';
afterEach(()=>vi.unstubAllGlobals());
function observations(state:any){return state.drain(64).filter((v:any)=>v.cohort==='observation').map((v:any)=>JSON.parse(v.serialized));}

test('whole Text envelope prunes long offscreen active prose before glyph budget exhaustion',()=>{
  const p=page();p.setText('a'.repeat(8192));
  const offscreen={left:0,top:200,right:100,bottom:220};
  const layout=controlledRangeGeometry(p,{envelope:()=>offscreen,glyphs:()=>[offscreen]});
  const state=install(p);p.tick(51);
  expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available',value:{contentRects:[]}}}});
  expect(layout.calls).toEqual([{kind:'envelope',node:p.node,start:0,end:8192}]);
  expect(layout.detached).toEqual([p.node]);state.stop();
});
test('long offscreen historical prose cannot hide the later genuinely visible anchor',()=>{
  const p=page();p.setText('A');
  function historical(id:string,data:string){const node:any={nodeType:3,length:data.length,data,isConnected:true,parentElement:null};const content:any={isConnected:true,parentElement:p.scroller,contains:(value:any)=>value===node,nodes:[node]};node.parentElement=content;return {node,candidate:{id,role:'user',hostElement:p.host,contentElement:content}};}
  const off=historical('offscreen','x'.repeat(8192)),visible=historical('visible','B');
  p.bridge.readCaptureCandidates=()=>({status:'available',value:{active:p.candidate,historical:[off.candidate,visible.candidate]}});
  const inside={left:1,top:1,right:10,bottom:10},outside={left:0,top:200,right:100,bottom:220};
  const layout=controlledRangeGeometry(p,{envelope:node=>node===off.node?outside:inside,glyphs:node=>[node===off.node?outside:inside]});
  const state=install(p);p.tick(51);
  expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:true,anchorId:'visible',anchorGeometry:{status:'available',value:{messageId:'visible',contentRects:[inside]}}}});
  expect(layout.calls.filter(call=>call.node===off.node)).toEqual([{kind:'envelope',node:off.node,start:0,end:8192}]);state.stop();
});
test('overlapping whole Text envelope supplies no positive visibility across an empty fragment gap',()=>{
  const p=page();p.setText('AB');const above={left:0,top:-20,right:10,bottom:-10},below={left:0,top:110,right:10,bottom:120};
  const layout=controlledRangeGeometry(p,{envelope:()=>({left:0,top:-20,right:10,bottom:120}),glyphs:(_node,start)=>[start===0?above:below]});
  const state=install(p);p.tick(51);
  expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available',value:{contentRects:[above,below]}}}});
  expect(layout.calls.map(call=>[call.kind,call.start,call.end])).toEqual([['envelope',0,2],['glyphs',0,1],['glyphs',1,2]]);state.stop();
});
test.each([{left:100,top:0,right:110,bottom:10},{left:0,top:0,right:0,bottom:10}])('touching or zero-area envelope remains a complete negative %j',envelope=>{
  const p=page();p.setText('x'.repeat(8192));const layout=controlledRangeGeometry(p,{envelope:()=>envelope,glyphs:()=>[envelope]});
  const state=install(p);p.tick(51);expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available',value:{contentRects:[]}}}});
  expect(layout.calls.map(call=>call.kind)).toEqual(['envelope']);state.stop();
});
test('positive visibility still requires a nonwhitespace whole-codepoint glyph after envelope admission',()=>{
  const p=page();p.setText(' 🌍 ');const inside={left:1,top:1,right:10,bottom:10};
  const layout=controlledRangeGeometry(p,{envelope:()=>inside,glyphs:()=>[inside]});
  const state=install(p);p.tick(51);expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:true,geometry:{status:'available',value:{contentRects:[inside]}}}});
  expect(layout.calls.map(call=>[call.kind,call.start,call.end])).toEqual([['envelope',0,4],['glyphs',1,3]]);state.stop();
});
test.each([2043,2044])('glyph list respects exact sample2048 and plus-one after charged envelope (%i fragments)',count=>{
  const p=page();p.setText('A');const inside={left:1,top:1,right:2,bottom:2};let reads=0;
  controlledRangeGeometry(p,{envelope:()=>inside,glyphs:()=>new Proxy(Array(count).fill(inside),{get:(target,key,receiver)=>{if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}})});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe(count===2043?'available':'unavailable');expect(reads).toBe(count===2043?count:0);state.stop();
});
test.each([2042,2043])('active and history share exact callback4096 including DOM host query (%i historical fragments)',count=>{
  const p=page();p.setText('A');const node:any={nodeType:3,length:1,data:'B',isConnected:true,parentElement:null},content:any={isConnected:true,parentElement:p.scroller,contains:(v:any)=>v===node,nodes:[node]};node.parentElement=content;
  const historical={id:'history',role:'user',hostElement:p.host,contentElement:content};p.bridge.readCaptureCandidates=()=>({status:'available',value:{active:p.candidate,historical:[historical]}});
  const inside={left:1,top:1,right:2,bottom:2};let historyReads=0;
  controlledRangeGeometry(p,{envelope:()=>inside,glyphs:n=>n===p.node?Array(2043).fill(inside):new Proxy(Array(count).fill(inside),{get:(target,key,receiver)=>{if(typeof key==='string'&&/^\d+$/.test(key))historyReads++;return Reflect.get(target,key,receiver);}})});
  const state=install(p);p.tick(51);expect(state.readScroll()).toMatchObject({status:'available',value:{activeVisible:true,anchorGeometry:{status:count===2042?'available':'unavailable'}}});expect(historyReads).toBe(count===2042?count:0);state.stop();
});
test.each([undefined,null,false,0,'',{}])('range setup preserves exact primary %j before ordered detach failure',primary=>{
  const p=page();p.setText('A');const cleanup={},pairs:unknown[][]=[];
  p.context.AggregateError=class extends AggregateError{constructor(errors:unknown[],message:string){pairs.push(errors);super(errors,message);}};
  let detached=0;p.context.document.createRange=()=>({setStart:()=>{throw primary;},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:1,bottom:1}),getClientRects:()=>[],detach:()=>{detached++;throw cleanup;}});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');expect(detached).toBe(1);expect(pairs).toHaveLength(1);expect(pairs[0]![0]).toBe(primary);expect(pairs[0]![1]).toBe(cleanup);state.stop();
});
test.each(['setEnd','envelope','glyphs','detach'])('every acquired range is detached and %s failure cannot become positive',failure=>{
  const p=page();p.setText('A');let detached=0;
  p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{if(failure==='setEnd')throw false;},getBoundingClientRect:()=>{if(failure==='envelope')throw null;return {left:0,top:0,right:10,bottom:10};},getClientRects:()=>{if(failure==='glyphs')throw 0;return [{left:0,top:0,right:10,bottom:10}];},detach:()=>{detached++;if(failure==='detach')throw undefined;}});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');expect(detached).toBe(failure==='glyphs'?2:1);state.stop();
});
test.each(['host','content','id','role','text','mutation'])('envelope return rechecks original %s facts before pruning',change=>{
  const p=page();p.setText('A');let dirty=false;p.context.MutationObserver=class{observe(){}takeRecords(){return dirty?[{}]:[];}disconnect(){}};
  const outside={left:0,top:200,right:10,bottom:210};controlledRangeGeometry(p,{envelope:()=>{if(change==='host')p.candidate.hostElement={...p.host};else if(change==='content')p.candidate.contentElement={...p.content};else if(change==='id')p.candidate.id='replacement';else if(change==='role')(p.candidate as any).role='user';else if(change==='text')p.setText('B');else dirty=true;return outside;},glyphs:()=>[outside]});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');state.stop();
});
test.each([undefined,null,false,0,''])('mutation cleanup failure %j revokes the successful cache and continues owned polling',failure=>{
  const p=page();p.setText('A');let stopped=0;p.context.MutationObserver=class{observe(){}takeRecords(){return [];}disconnect(){stopped++;throw failure;}};
  const state=install(p);expect(()=>p.tick(51)).not.toThrow();expect(stopped).toBe(1);expect(state.readScroll().status).toBe('unavailable');expect(observations(state).some((row:any)=>row.kind==='scroll-checkpoint')).toBe(false);expect(p.timers.size).toBe(1);state.stop();
});
test('envelope reserves both units before querying when only one sample unit remains',()=>{
  const p=page();p.setText('A');const other:any={nodeType:3,length:1,data:'B',isConnected:true,parentElement:p.content};p.content.nodes.push(other);p.content.contains=()=>true;
  const outside={left:0,top:200,right:1,bottom:201};const layout=controlledRangeGeometry(p,{envelope:()=>({left:0,top:0,right:1,bottom:201}),glyphs:()=>Array(2042).fill(outside)});
  const state=install(p);p.tick(51);expect(state.readScroll()).toMatchObject({status:'unavailable',reason:expect.stringContaining('before envelope query')});expect(layout.calls.filter(row=>row.kind==='envelope')).toHaveLength(1);expect(layout.calls.some(row=>row.node===other)).toBe(false);state.stop();
});
test('active range owner moved into historical candidates is not the same current active owner',()=>{
  const p=page();p.setText('A');const outside={left:0,top:200,right:1,bottom:201};
  controlledRangeGeometry(p,{envelope:()=>{p.bridge.readCaptureCandidates=()=>({status:'available',value:{active:null,historical:[p.candidate]}});return outside;},glyphs:()=>[outside]});
  const state=install(p);p.tick(51);expect(state.readScroll()).toMatchObject({status:'unavailable',reason:expect.stringContaining('Geometry owner changed')});state.stop();
});
test('installers are self contained and expose one bounded cohort drain with real probes',()=>{
  expect(typeof implementation.installComparisonObservations).toBe('function');
  const p=page(),state=install(p);p.tick(51);
  const records=observations(state);for(const r of records)comparisonObservationSchema.parse(r);
  expect(records.find((r:any)=>r.kind==='runtime-checkpoint').data.activeMessage.text).toBe('');
  expect(records.find((r:any)=>r.kind==='dom-checkpoint').data.mountedMessageCount).toBe(1);
  expect(records.every((r:any)=>r.phase===null&&r.attributionReason)).toBe(true);
  comparisonInstrumentationSchema.parse(state.readInstrumentation());
  state.stop();state.stop();expect(p.timers.size).toBe(0);
});
test('missing mounted scalar forbids DOM success while runtime continues',()=>{
  const p=page();delete p.bridge.readCaptureMountedMessageCount;const state=install(p);p.tick(51);
  const records=observations(state);expect(records.some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
  expect(records.some((r:any)=>r.kind==='runtime-checkpoint')).toBe(true);
  expect(records.some((r:any)=>r.kind==='probe-unavailable'&&r.data.probe==='dom')).toBe(true);
  expect(state.readScroll()).toMatchObject({status:'available',value:{timestampMs:51,geometry:{status:'available'}}});
});
test.each(['unavailable','throw',-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('mounted count failure %s leaves fresh actual scroll geometry independent',failure=>{
  const p=page();p.setText('A');p.bridge.readCaptureMountedMessageCount=()=>{if(failure==='throw')throw Error('count failed');return failure==='unavailable'?{status:'unavailable',reason:'count unavailable'}:{status:'available',value:failure};};
  const state=install(p);p.tick(51);const records=observations(state);expect(records.some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);expect(records.some((r:any)=>r.kind==='runtime-checkpoint')).toBe(true);expect(records.some((r:any)=>r.kind==='scroll-checkpoint'&&r.timestampMs===51)).toBe(true);expect(state.readScroll()).toMatchObject({status:'available',value:{timestampMs:51,activeVisible:true,geometry:{status:'available'}}});
});
test.each([{overflowX:'hidden'},{overflowY:'hidden'},{display:'none'},{visibility:'hidden'},{transform:'matrix(1,0,0,1,0,0)'},{clipPath:'inset(0)'},{overflowClipMargin:'1px'}])('inner prose ancestors reject unrepresentable or unsupported geometry %j',override=>{
  const p=page();p.setText('A');const inner={tagName:'SPAN',isConnected:true,parentElement:p.content,getAttribute:()=>null};p.node.parentElement=inner as any;let reads=0;const style=p.context.getComputedStyle;p.context.getComputedStyle=(element:any)=>{if(element===inner){reads++;return {...style(element),...override};}return style(element);};
  const state=install(p);p.tick(51);expect(reads).toBeGreaterThan(0);expect(state.readScroll().status).toBe('unavailable');expect(observations(state).some((r:any)=>r.kind==='scroll-checkpoint')).toBe(false);
});
test('different sibling clipping branches cannot be flattened into one available geometry chain',()=>{
  const p=page();p.setText('A');const plain={tagName:'SPAN',isConnected:true,parentElement:p.content,getAttribute:()=>null},clipped={...plain};p.node.parentElement=plain as any;
  const other={nodeType:3,length:1,data:'B',isConnected:true,parentElement:clipped};p.content.nodes.push(other as any);p.content.contains=()=>true;const style=p.context.getComputedStyle;p.context.getComputedStyle=(element:any)=>({...style(element),overflowX:element===clipped?'hidden':'visible'});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');expect(observations(state).some((r:any)=>r.kind==='scroll-checkpoint')).toBe(false);
});
test('oversized text fails before data getter and successful checkpoint is never reused',()=>{
  const p=page(),state=install(p);p.tick(51);observations(state);
  const data=vi.fn(()=>{throw Error('data must not be read');});Object.defineProperty(p.node,'length',{get:()=>524289});Object.defineProperty(p.node,'data',{get:data});
  p.tick(101);const records=observations(state);expect(data).not.toHaveBeenCalled();expect(records.some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
});
test('host guard requires explicit arm and two later distinct real callbacks on same element',()=>{
  const p=page(),state=install(p);expect(p.frames.size).toBe(0);state.armHostGuard();expect(()=>state.armHostGuard()).toThrow();
  p.frame(10);expect(state.readHostGuard().status).toBe('pending');
  p.frame(20);expect(state.readHostGuard().status).toBe('pending');
  p.frame(30);const guard=state.readHostGuard();expect(guard.status).toBe('ready');expect(guard.value.hostObservation.contentMounted).toBe(true);expect(guard.value.frames.map((f:any)=>f.timestampMs)).toEqual([20,30]);expect(p.frames.size).toBe(0);
});
test('guard fails on same ID replacement and releases scheduled work',()=>{
  const p=page(),state=install(p);state.armHostGuard();p.frame(10);p.candidate.hostElement={...p.host} as any;p.frame(20);expect(state.readHostGuard().status).toBe('unavailable');expect(p.frames.size).toBe(0);
});
test('phase timestamps resolve delayed native events, boundaries and failed closure',()=>{
  const p=page(),state=install(p);p.setTime(10);state.setPhase('streaming-follow');p.setTime(20);state.closePhase();p.setTime(20);state.setPhase('composer-input');p.setTime(30);
  const event={timeStamp:15,isTrusted:true,target:p.composer,key:'a',code:'KeyA'};p.emit('keydown',event);
  p.emit('keyup',{...event,timeStamp:20});const records=observations(state).filter((r:any)=>r.kind==='native-input');expect(records.map((r:any)=>r.phase)).toEqual(['streaming-follow','composer-input']);
  p.bridge.markPhase=()=>{throw Error('close failed');};expect(()=>state.closePhase()).toThrow();expect(state.readPhases().openPhase.phase).toBe('composer-input');
});
test('native evidence preserves three actual wheels, page clock and consumed recipe labels',()=>{
  const p=page(),state=install(p);p.setTime(100);for(let i=0;i<3;i++)p.emit('wheel',{timeStamp:10+i,isTrusted:true,target:p.scroller,deltaX:0,deltaY:-100,deltaMode:0});
  p.emit('input',{timeStamp:20,isTrusted:true,target:p.composer,inputType:'insertText'});p.emit('click',{timeStamp:1e12,isTrusted:true,target:p.composer});
  const records=observations(state),wheels=records.filter((r:any)=>r.kind==='native-input'&&r.data.type==='wheel');expect(wheels).toHaveLength(3);expect(wheels.every((r:any)=>r.data.recipeId===mainOptions.nativeRecipeIds.wheel)).toBe(true);
  const input=records.find((r:any)=>r.kind==='native-input'&&r.data.type==='input');expect(input.data.recipeId).toBe(mainOptions.nativeRecipeIds.composer);expect(input.data.value).toBe('calibrate');expect(records.some((r:any)=>r.kind==='probe-unavailable'&&r.data.probe==='native-input')).toBe(true);
});
test('diagnostic objects remain opaque, original console identities unchanged, and stop owns only its wrapper',()=>{
  const p=page();runInNewContext(`(${implementation.installComparisonPreNavigation.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options:preOptions,window:p.context});
  const state=p.context.comparisonPreNavigation,touch=vi.fn(()=>{throw Error('object touched');}),object=new Proxy({toJSON:touch,toString:touch},{get:touch,ownKeys:touch});
  p.context.console.warn(object,'x'.repeat(100000));expect(p.nativeConsole.warn.mock.calls[0]![0]).toBe(object);expect(p.nativeConsole.warn.mock.calls[0]![1]).toBe('x'.repeat(100000));expect(touch).not.toHaveBeenCalled();
  const record=JSON.parse(state.drain(1)[0]);expect(record.message.length).toBeLessThanOrEqual(8192);expect(record.message).toContain('truncated');
  const later=()=>{};p.context.console.warn=later;state.stop();state.stop();expect(p.context.console.warn).toBe(later);expect(state.state().highWaterEntries).toBe(1);
});
test('transfer preserves original Unicode bytes/stage and final source lifetime loss',()=>{
  const p=page();runInNewContext(`(${implementation.installComparisonPreNavigation.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options:preOptions,window:p.context});
  for(let i=0;i<4097;i++)p.context.console.error('🌍漢\\\n'+i);
  const state=install(p,false),transfer=state.readPreNavigationTransfer();expect(transfer.accepted).toBe(64);expect(transfer.sourceFinal.rejectedRecordCount).toBe(1);expect(transfer.remainingEntries).toBe(4032);
  const entries=state.drain(64);expect(entries[0].cohort).toBe('exception');expect(JSON.parse(entries[0].serialized)).toMatchObject({stage:'setup',timestampMs:1,message:'🌍漢\\\n0'});
  expect(state.readInstrumentation().buffers.find((b:any)=>b.name==='pre-navigation-errors').rejectedRecordCount).toBe(1);
});
test('200 growing runtime plus independent DOM snapshots overflow real pending bytes; incremental drains exceed limit without loss',()=>{
  const p=page(),state=install(p);for(let i=1;i<=200;i++){p.setText('x'.repeat(Math.floor(262144*i/200)));p.tick(i*50+1);}
  const buffer=state.readInstrumentation().buffers.find((b:any)=>b.name==='page-observations');expect(buffer.status).toBe('partial');expect(buffer.overflowCount).toBeGreaterThan(0);expect(buffer.highWaterSerializedBytes).toBeLessThanOrEqual(16777216);
  const q=page(),drained=install(q);let bytes=0;for(let i=1;i<=200;i++){q.setText('x'.repeat(262144));q.tick(i*50+1);for(const e of drained.drain(64))bytes+=Buffer.byteLength(e.serialized);}
  expect(bytes).toBeGreaterThan(16777216);expect(drained.readInstrumentation().buffers.find((b:any)=>b.name==='page-observations').rejectedRecordCount).toBe(0);
});
test('incomplete prose negatives make the combined scroll checkpoint unavailable, complete negatives remain factual',()=>{
  const p=page();p.setText('a'.repeat(2048));const queries=vi.fn(()=>[{left:0,top:200,right:10,bottom:210}]);p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:queries,detach:()=>{}});
  const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');expect(observations(state).some((r:any)=>r.kind==='scroll-checkpoint')).toBe(false);expect(queries.mock.calls.length).toBeLessThan(2048);
  const q=page();q.setText('ab');q.context.document.createRange=p.context.document.createRange;const complete=install(q);q.tick(51);expect(complete.readScroll()).toMatchObject({status:'available',value:{activeVisible:false,geometry:{status:'available'}}});
});
test('positive prose, Unicode codepoint ranges, per-axis clipping and bordered client scroller boxes',()=>{
  const p=page();p.setText('🌍A🌍');p.scroller.clientLeft=5;p.scroller.clientTop=7;p.scroller.clientWidth=80;p.scroller.clientHeight=70;
  const clip={isConnected:true,parentElement:p.scroller,clientLeft:3,clientTop:4,clientWidth:50,clientHeight:30,getBoundingClientRect:()=>({left:10,top:10,right:70,bottom:50})};p.content.parentElement=clip as any;
  p.context.getComputedStyle=(element:any)=>({transform:'none',clipPath:'none',overflowClipMargin:'0px',overflowX:element===clip?'hidden':'visible',overflowY:'visible'});
  const positions:number[][]=[];p.context.document.createRange=()=>{let start=0;return {setStart:(_n:any,v:number)=>{start=v;},setEnd:(_n:any,v:number)=>{positions.push([start,v]);},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>[{left:20,top:50,right:25,bottom:55}],detach:()=>{}};};
  const state=install(p);p.tick(51);const value=state.readScroll().value;expect(value.activeVisible).toBe(true);expect(value.geometry.value.scrollerRect).toEqual({left:5,top:7,right:85,bottom:77});expect(value.geometry.value.clippingAncestorRects[0]).toEqual({left:13,top:14,right:63,bottom:44});expect(value.geometry.value.clippingAncestorAxes).toEqual([{clipX:true,clipY:false}]);expect(positions).toEqual([[0,5],[0,2]]);
});
test('unsupported styles and disconnected prose never become successful visibility evidence',()=>{
  for(const style of [{transform:'matrix(1,0,0,1,0,0)'},{clipPath:'circle(50%)'},{overflowClipMargin:'1px'}]){const p=page();p.setText('text');p.context.getComputedStyle=()=>({transform:'none',clipPath:'none',overflowClipMargin:'0px',overflowX:'visible',overflowY:'visible',...style});const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');}
  const p=page();p.content.isConnected=false;const state=install(p);p.tick(51);expect(state.readScroll().status).toBe('unavailable');
});
test('shared node budget stops before expensive next traversal across all candidates',()=>{
  const p=page();let calls=0;
  function candidate(index:number){const nodes=Array.from({length:1000},()=>({nodeType:3,length:0,data:'',isConnected:true})),content={isConnected:true,nodes,contains:()=>true,parentElement:p.scroller};return {id:'h'+index,role:'assistant',hostElement:p.host,contentElement:content};}
  const history=[candidate(1),candidate(2),candidate(3)];p.bridge.readCaptureCandidates=()=>({status:'available',value:{historical:history,active:p.candidate}});p.context.document.createTreeWalker=(root:any)=>{let i=0;return {nextNode:()=>{calls++;return root.nodes[i++]??null;}};};
  const state=install(p);p.tick(51);expect(calls).toBeLessThanOrEqual(2052);expect(observations(state).some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
});
test('observers retain delayed original start, quantized duration, individual drop reports and final takeRecords',()=>{
  const p=page(),constructed:any[]=[],order:string[]=[];
  p.context.PerformanceObserver=class {static supportedEntryTypes=['event','long-animation-frame'];callback:any;pending:any[]=[];constructor(callback:any){this.callback=callback;constructed.push(this);}observe(options:any){this.options=options;}options:any;takeRecords(){order.push('take');const v=this.pending;this.pending=[];return v;}disconnect(){order.push('disconnect');}};
  const state=install(p);expect(constructed[0].options).toEqual({type:'event',buffered:true,durationThreshold:16});p.setTime(10);state.setPhase('streaming-follow');p.setTime(20);state.closePhase();p.setTime(30);state.setPhase('composer-input');p.setTime(100);
  const event={entryType:'event',name:'keydown',startTime:15,duration:16,processingStart:15,processingEnd:40,cancelable:true,interactionId:1,target:p.composer};constructed[0].callback({getEntries:()=>[event]},constructed[0],{droppedEntriesCount:3});
  constructed[1].pending=[{entryType:'long-animation-frame',name:'long-animation-frame',startTime:16,duration:60,renderStart:50,styleAndLayoutStart:51,blockingDuration:40,firstUIEventTimestamp:15}];state.stop();
  const records=observations(state);for(const r of records)comparisonObservationSchema.parse(r);expect(records.find((r:any)=>r.kind==='event-timing')).toMatchObject({timestampMs:15,phase:'streaming-follow'});expect(records.find((r:any)=>r.kind==='observer-state'&&r.data.droppedEntriesCount.status==='available').data.droppedEntriesCount.value).toBe(3);expect(records.some((r:any)=>r.kind==='long-animation-frame')).toBe(true);expect(order).toEqual(['take','disconnect','take','disconnect']);expect(state.readInstrumentation().eventTiming.value.droppedEntriesCount.status).toBe('unavailable');
});
test('observer malformed required fields and registration errors are unavailable instead of fabricated zero',()=>{
  const p=page();let callback:any;p.context.PerformanceObserver=class {static supportedEntryTypes=['long-animation-frame'];constructor(fn:any){callback=fn;}observe(){}disconnect(){}takeRecords(){return [];}};
  const state=install(p);p.setTime(100);callback({getEntries:()=>[{entryType:'long-animation-frame',name:'long-animation-frame',startTime:10,duration:60,renderStart:40}]});expect(state.readInstrumentation().loaf.status).toBe('unavailable');expect(observations(state).some((r:any)=>r.kind==='long-animation-frame')).toBe(false);
  const q=page();q.context.PerformanceObserver=class {static supportedEntryTypes=['event'];constructor(){throw Error('registration');}};expect(install(q).readInstrumentation().eventTiming.status).toBe('unavailable');
  const r=page();r.context.PerformanceObserver=class {static supportedEntryTypes=['event'];constructor(){}observe(){throw Error('registration');}disconnect(){throw Error('registration cleanup');}};expect(()=>install(r)).not.toThrow();expect(r.context.comparisonCapture.readInstrumentation().eventTiming.status).toBe('unavailable');
});
test('observer floods fail before reading any entry and cleanup continues after native disconnect throws',()=>{
  const p=page(),constructed:any[]=[],order:string[]=[];let reads=0;
  p.context.PerformanceObserver=class {static supportedEntryTypes=['event','long-animation-frame'];callback:any;index:number;constructor(fn:any){this.callback=fn;this.index=constructed.length;constructed.push(this);}observe(){}takeRecords(){order.push('take'+this.index);return [];}disconnect(){order.push('disconnect'+this.index);if(this.index===0)throw Error('disconnect failed');}};
  const state=install(p);state.armHostGuard();const entry=new Proxy({}, {get(){reads++;throw Error('entry read');}});
  constructed[0].callback({getEntries:()=>Array(4097).fill(entry)});
  expect(reads).toBe(0);expect(state.readInstrumentation().eventTiming).toMatchObject({status:'unavailable',reason:expect.stringContaining('budget')});
  expect(()=>state.stop()).not.toThrow();state.stop();expect(order).toEqual(['take0','disconnect0','take1','disconnect1']);expect(p.timers.size).toBe(0);expect(p.frames.size).toBe(0);expect([...p.listeners.values()].every(set=>set.size===0)).toBe(true);expect(p.context.console.error).toBe(p.nativeConsole.error);expect(state.readInstrumentation().loaf.value.finalTakeRecords).toBe(true);
});
test('pre-navigation stop attempts every owned cleanup before reporting a native failure and preserves its queue',()=>{
  const p=page(),removed:string[]=[];const remove=p.context.removeEventListener;
  p.context.removeEventListener=(type:string,fn:any)=>{removed.push(type);if(type==='error')throw Error('listener removal failed');remove(type,fn);};
  runInNewContext(`(${implementation.installComparisonPreNavigation.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options:preOptions,window:p.context});
  p.context.console.error('retained');const state=p.context.comparisonPreNavigation;
  expect(()=>state.stop()).toThrow('listener removal failed');expect(removed).toEqual(['error','unhandledrejection']);expect(p.context.console.warn).toBe(p.nativeConsole.warn);expect(p.context.console.error).toBe(p.nativeConsole.error);expect(state.state().pendingEntries).toBe(1);expect(()=>state.stop()).not.toThrow();expect(state.drain(1)).toHaveLength(1);
});
test('destination full transfer loses only the first attempted entry and leaves honest source remainder',()=>{
  const p=page();runInNewContext(`(${implementation.installComparisonPreNavigation.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options:preOptions,window:p.context});for(let i=0;i<4097;i++)p.context.console.error('original '+i);
  const fullFactory=`function(name){const factory=${createComparisonBuffer.toString()};const q=factory(name);if(name==='page-observations')for(let i=0;i<4096;i++)q.enqueue('null');return q;}`;
  runInNewContext(`(${implementation.installComparisonObservations.toString()})(${fullFactory}, options)`,{...p.context,options:mainOptions,window:p.context});const state=p.context.comparisonCapture,transfer=state.readPreNavigationTransfer();expect(transfer).toMatchObject({attempted:1,accepted:0,rejected:1,remainingEntries:4095,sourceFinal:{highWaterEntries:4096,rejectedRecordCount:1,pendingEntries:4096},failureReason:'Pending entry limit exceeded'});state.stop();expect(p.context.comparisonPreNavigation.drain(1)).toHaveLength(1);
});
test('failed phase entry does not advance exception lifecycle stage, transfer setup remains original',()=>{
  const p=page(),state=install(p);p.setTime(10);state.setPhase('streaming-follow');p.setTime(20);state.closePhase();p.bridge.markPhase=()=>{throw Error('start failed');};expect(()=>state.setPhase('validation')).toThrow();p.setTime(30);p.context.console.error('gap error');const entry=state.drain(64).find((r:any)=>r.cohort==='exception');expect(JSON.parse(entry.serialized)).toMatchObject({stage:'replay',timestampMs:30});
});
test('metadata/actions/input text is excluded and traversal counts non-text nodes before entering next',()=>{
  const p=page();const action={isConnected:true,parentElement:p.content,tagName:'BUTTON'},actionText={nodeType:3,isConnected:true,parentElement:action,length:6,data:'ACTION'};p.content.contains=()=>true;p.content.nodes=[p.node,actionText] as any;p.setText('prose');
  const state=install(p);p.tick(51);expect(observations(state).find((r:any)=>r.kind==='dom-checkpoint').data.text).toBe('prose');
  const q=page();let calls=0;q.content.nodes=Array.from({length:1100},()=>({nodeType:1,isConnected:true})) as any;q.context.document.createTreeWalker=(root:any)=>{let i=0;return {nextNode:()=>{calls++;return root.nodes[i++]??null;}};};const bounded=install(q);q.tick(51);expect(calls).toBe(1024);expect(observations(bounded).some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
});
test('shared callback history character cap fails before later candidate data getter',()=>{
  const p=page();let touch=0;function candidate(i:number){const data='a'.repeat(16384),node={nodeType:3,length:16384,get data(){if(i===16)touch++;return data;},isConnected:true,parentElement:null};const content={isConnected:true,parentElement:p.scroller,contains:()=>true,nodes:[node]};node.parentElement=content as any;return {id:'h'+i,role:'assistant',hostElement:p.host,contentElement:content};}
  p.bridge.readCaptureCandidates=()=>({status:'available',value:{historical:Array.from({length:17},(_,i)=>candidate(i)),active:p.candidate}});const state=install(p);p.tick(51);expect(touch).toBe(0);expect(observations(state).some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
});
test('one queue capacity includes both cohorts and envelope overhead, persists losses after stop/drain',()=>{
  const p=page(),state=install(p);for(let i=0;i<3000;i++)p.context.console.warn('owned');p.setTime(100);for(let i=0;i<1200;i++)p.emit('wheel',{timeStamp:1,isTrusted:true,target:p.scroller,deltaX:0,deltaY:-100,deltaMode:0});
  const buffer=state.readInstrumentation().buffers.find((b:any)=>b.name==='page-observations');expect(buffer.highWaterEntries).toBe(4096);expect(buffer.rejectedRecordCount).toBe(106);state.stop();let count=0,bytes=0;while(true){const batch=state.drain(64);if(batch.length===0)break;count+=batch.length;for(const e of batch)bytes+=Buffer.byteLength(e.serialized);}expect(count).toBe(4096);expect(buffer.highWaterSerializedBytes).toBeGreaterThan(bytes);expect(state.readInstrumentation().buffers.find((b:any)=>b.name==='page-observations').rejectedRecordCount).toBe(106);
});
test('two samples are required for actual max gap and no timer backfill occurs',()=>{
  const p=page(),state=install(p);p.tick(51);expect(state.readInstrumentation().runtimeProbe).toMatchObject({callbacks:1,maximumObservedGapMs:{status:'unavailable'}});p.tick(551);expect(state.readInstrumentation().runtimeProbe).toMatchObject({callbacks:2,maximumObservedGapMs:{status:'available',value:500}});expect(p.timers.size).toBe(1);state.stop();expect(p.timers.size).toBe(0);
});
test('empty connected host with no content is guarded without inferring text from mount',()=>{
  const p=page();p.candidate.contentElement=null as any;const state=install(p);state.armHostGuard();p.frame(10);p.frame(20);p.frame(30);expect(state.readHostGuard()).toMatchObject({status:'ready',value:{hostObservation:{contentMounted:false}}});expect(observations(state).find((r:any)=>r.kind==='runtime-checkpoint').data.activeMessage.text).toBe('');
});
test('y clipping and nested disjoint/zero area clipping only use prose positive area',()=>{
  for(const [x,y,visible] of [['visible','hidden',false],['hidden','visible',true]]){const p=page();p.setText('A');const clip={isConnected:true,parentElement:p.scroller,clientLeft:0,clientTop:0,clientWidth:50,clientHeight:30,getBoundingClientRect:()=>({left:10,top:10,right:60,bottom:40})};p.content.parentElement=clip as any;p.context.getComputedStyle=(e:any)=>({transform:'none',clipPath:'none',overflowClipMargin:'0px',overflowX:e===clip?x:'visible',overflowY:e===clip?y:'visible'});p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>[{left:20,top:50,right:30,bottom:60}],detach:()=>{}});const state=install(p);p.tick(51);expect(state.readScroll().value.activeVisible).toBe(visible);}
  const p=page();p.setText('A');p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>[{left:20,top:20,right:20,bottom:30}],detach:()=>{}});const state=install(p);p.tick(51);expect(state.readScroll().value.activeVisible).toBe(false);
});
test('phase instance IDs must match actual strict decimal ordinal schema',()=>{
  const p=page();p.bridge.markPhase=(phase:string,boundary:string)=>({phase,boundary,instanceId:'not-an-ordinal',timestampMs:10});const state=install(p);expect(()=>state.setPhase('setup')).toThrow();expect(state.readPhases().openPhase).toBe(null);
});
test('missing transport buffer API produces explicit acquisition failure without manufactured state',()=>{
  const p=page();delete p.bridge.readCaptureBufferState;const state=install(p);p.tick(51);expect(state.readInstrumentation().buffers.some((b:any)=>b.name==='transport')).toBe(false);expect(observations(state).some((r:any)=>r.kind==='failure'&&r.data.reason.includes('buffer'))).toBe(true);
});
test('arbitrarily large BigInt diagnostics use bounded labels before coercion',()=>{
  const p=page(),coercion=vi.fn((value:any)=>{if(typeof value==='bigint')throw Error('BigInt formatting unbounded');return String(value);});p.context.String=coercion;const state=install(p);p.context.console.warn(1n<<100000n);expect(coercion.mock.calls.some(([v])=>typeof v==='bigint')).toBe(false);const entry=state.drain(64).find((e:any)=>e.cohort==='exception');expect(JSON.parse(entry.serialized).message.length).toBeLessThan(2048);
});
test('callback-local mutation assurance rejects inserted siblings and layout-time mutations, then disconnects',()=>{
  const p=page();let dirty=false,stopped=0;const read=vi.fn(()=>{throw Error('MutationRecord contents must not be inspected');});
  p.context.MutationObserver=class{observe(){}takeRecords(){if(!dirty)return [];dirty=false;return new Proxy({length:1},{get:(target,key)=>key==='length'?target.length:read()});}disconnect(){stopped++;}};
  const original=p.context.document.createTreeWalker;p.context.document.createTreeWalker=(root:any)=>{const walker=original(root);return {nextNode:()=>{const next=walker.nextNode();if(next===null)dirty=true;return next;}};};const state=install(p);p.tick(51);expect(observations(state).some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);expect(state.readScroll().status).toBe('unavailable');expect(read).not.toHaveBeenCalled();expect(stopped).toBe(1);
  const q=page();let changed=false;q.context.MutationObserver=class{observe(){}takeRecords(){return changed?[{}]:[];}disconnect(){}};q.setText('A');q.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>{changed=true;return [{left:0,top:0,right:10,bottom:10}];},detach:()=>{}});const geometry=install(q);q.tick(51);expect(geometry.readScroll().status).toBe('unavailable');
});
test('mutation observer registration failure gives unavailable assurance while runtime continues',()=>{
  const p=page();p.context.MutationObserver=class{observe(){throw Error('cannot observe');}takeRecords(){return [];}disconnect(){}};const state=install(p);p.tick(51);const records=observations(state);expect(records.some((r:any)=>r.kind==='runtime-checkpoint')).toBe(true);expect(records.some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);expect(state.readScroll().status).toBe('unavailable');
});
test('layout rect lists reject oversized lengths before accessing any individual rect',()=>{
  const p=page();p.setText('A');const touch=vi.fn(()=>{throw Error('Rect read');});p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>new Proxy({length:4097},{get:(target,key)=>key==='length'?target.length:touch()}),detach:()=>{}});const state=install(p);p.tick(51);expect(touch).not.toHaveBeenCalled();expect(state.readScroll().status).toBe('unavailable');
});
test('candidate overflow fails before any candidate getter and other probes retain actual work',()=>{
  const p=page(),touch=vi.fn(()=>{throw Error('Candidate touched');});const candidate=new Proxy({},{get:touch});p.bridge.readCaptureCandidates=()=>({status:'available',value:{historical:Array(65).fill(candidate),active:null}});const state=install(p);p.tick(51);expect(touch).not.toHaveBeenCalled();expect(observations(state).some((r:any)=>r.kind==='probe-unavailable'&&r.data.probe==='candidates')).toBe(true);expect(state.readInstrumentation().runtimeProbe.callbacks).toBe(1);
});
test.each([undefined,{status:'unavailable',reason:'count missing'},{status:'available',value:-1},{status:'available',value:NaN},{status:'available',value:1.5}])('invalid total scalar count %j never becomes zero or a successful DOM checkpoint',value=>{
  const p=page();p.bridge.readCaptureMountedMessageCount=()=>value;const state=install(p);p.tick(51);expect(observations(state).some((r:any)=>r.kind==='dom-checkpoint')).toBe(false);
});
test('complete no-active state reports factual false and raw signed gap remains derivable without threshold/policy guesses',()=>{
  const p=page();p.bridge.readCaptureCandidates=()=>({status:'available',value:{historical:[],active:null}});p.bridge.readActiveHost=()=>({activeMessageId:null,hostMounted:false});p.scroller.scrollHeight=100;p.scroller.scrollTop=20;p.scroller.clientHeight=100;const state=install(p);p.tick(51);const value=state.readScroll().value;expect(value.activeVisible).toBe(false);expect(value.scrollHeight-value.scrollTop-value.clientHeight).toBe(-20);expect(value.pinThresholdCssPx).toBe(null);expect(value.followArmed).toBe(null);expect(value.timestampMs).toBe(51);
});
test('all geometry samples share the ancestor cap before the next style inspection',()=>{
  const p=page();p.setText('A');const styles=vi.fn(()=>({transform:'none',clipPath:'none',overflowClipMargin:'0px',overflowX:'visible',overflowY:'visible'}));p.context.getComputedStyle=styles;
  function candidate(i:number){let parent:any=p.scroller;for(let j=0;j<40;j++)parent={parentElement:parent,isConnected:true};const content:any={parentElement:parent,isConnected:true,contains:()=>true,nodes:[]};content.nodes=[{nodeType:3,length:1,data:'A',isConnected:true,parentElement:content}];return {id:'h'+i,role:'assistant',contentElement:content,hostElement:p.host};}
  const history=Array.from({length:8},(_,i)=>candidate(i));p.bridge.readCaptureCandidates=()=>({status:'available',value:{historical:history,active:p.candidate}});p.context.document.createRange=()=>({setStart:()=>{},setEnd:()=>{},getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100}),getClientRects:()=>[{left:0,top:200,right:10,bottom:210}],detach:()=>{}});const state=install(p);p.tick(51);expect(styles.mock.calls.length).toBe(256);expect(state.readScroll().value.anchorGeometry.status).toBe('unavailable');
});
test('invalid owned transfer shape is an integrity rejection, not fake factory overflow, and complete only means exhaustion',()=>{
  const p=page(),source=createComparisonBuffer('pre-navigation-errors');source.enqueue('null');p.context.comparisonPreNavigation={state:source.state,stop:()=>{},drain:(size:number)=>source.drain(size as 4096)};const state=install(p,false);expect(state.readPreNavigationTransfer()).toMatchObject({attempted:1,accepted:0,rejected:1,complete:true,failureReason:'Owned pre-navigation source integrity failure'});expect(state.readInstrumentation().buffers.find((b:any)=>b.name==='page-observations').rejectedRecordCount).toBe(0);
});

// Controlled installer fixtures use the actual bounded queue; native H receipts stay strict.
test.each([true,false])('terminal transport transfer is explicit; normal terminal=%s',terminal=>{
  const p=page(),transport=createComparisonBuffer('transport');
  const drain=vi.fn(()=>transport.drain().map(serialized=>JSON.parse(JSON.parse(serialized))));
  p.bridge.drainCaptureEvents=drain;p.bridge.readCaptureBufferState=()=>{const {pendingEntries,pendingSerializedBytes,...state}=transport.state();return state;};
  const state=install(p);p.setTime(50);state.setPhase('streaming-follow');p.tick(51);observations(state);
  const originalRecords=[
    {kind:'receipt',timestampMs:52,sequence:200,data:{event:{type:'text-delta',sequence:200,scheduledMs:10000,messageId:'response',text:'🌍'}}},
    {kind:'translation',timestampMs:52,sequence:200,data:{protocolEvent:'text-delta',messageId:'response',text:'🌍'}},
    {kind:'receipt',timestampMs:53,sequence:201,data:{event:{type:'assistant-complete',sequence:201,scheduledMs:10000,messageId:'response',text:''}}},
    {kind:'translation',timestampMs:53,sequence:201,data:{protocolEvent:'complete',messageId:'response',text:''}},
  ];
  for(const record of originalRecords)expect(transport.enqueue('string',JSON.stringify(record))).toBe(true);
  expect(transport.state().pendingEntries).toBe(4);p.setTime(54);state.closePhase();p.setTime(55);
  if(terminal)Reflect.apply(state.stop,state,[{drainTransport:true}]);else state.stop();
  const records=observations(state),transferred=records.filter(record=>record.kind==='receipt'||record.kind==='translation');
  expect(transferred.map(record=>({kind:record.kind,timestampMs:record.timestampMs,sequence:record.sequence,data:record.data}))).toEqual(terminal?originalRecords:[]);
  for(const record of transferred){comparisonObservationSchema.parse(record);expect(record.phase).toBe('streaming-follow');expect(record.phaseInstanceId).toBe('1');expect(record.attributionReason).toBe(null);}
  expect(transport.state().pendingEntries).toBe(terminal?0:4);expect(drain).toHaveBeenCalledTimes(terminal?2:1);
  const instrumentation=state.readInstrumentation();expect(instrumentation.transportDrain.callbacks).toBe(terminal?2:1);
  expect(instrumentation.runtimeProbe.callbacks).toBe(1);expect(instrumentation.domProbe.callbacks).toBe(1);expect(instrumentation.scrollProbe.callbacks).toBe(1);
  expect(p.timers.size).toBe(0);expect([...p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);
  expect(p.context.console.warn).toBe(p.nativeConsole.warn);expect(p.context.console.error).toBe(p.nativeConsole.error);
  Reflect.apply(state.stop,state,[{drainTransport:true}]);expect(drain).toHaveBeenCalledTimes(terminal?2:1);
});
test('normal terminal transport failure stays factual while all cleanup still runs',()=>{
  const p=page(),state=install(p);p.tick(51);observations(state);const drain=vi.fn(()=>{throw false;});p.bridge.drainCaptureEvents=drain;p.setTime(55);
  Reflect.apply(state.stop,state,[{drainTransport:true}]);
  expect(observations(state).filter(record=>record.kind==='failure').map(record=>record.data.reason)).toEqual(['Transport drain unavailable: false']);
  expect(drain).toHaveBeenCalledTimes(1);expect(p.timers.size).toBe(0);expect([...p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);
  expect(p.context.console.warn).toBe(p.nativeConsole.warn);expect(p.context.console.error).toBe(p.nativeConsole.error);
  state.stop();expect(drain).toHaveBeenCalledTimes(1);
});


function withChronologyHost(inspect:(p:ReturnType<typeof page>,state:ReturnType<typeof install>)=>void,hostTime=100){
  let state:ReturnType<typeof install>|undefined,failed=false,originalError:unknown;const cleanupFailures:unknown[]=[];
  try{const p=page();state=install(p);state.armHostGuard();p.frame(hostTime);inspect(p,state);}
  catch(error){failed=true;originalError=error;}
  finally{try{state?.stop();}catch(error){cleanupFailures.push(error);}}
  if(failed){if(cleanupFailures.length)console.error('Original chronology fixture cleanup failures',cleanupFailures);throw originalError;}
  if(cleanupFailures.length)throw cleanupFailures[0];
}
function originalChronologyCallback(p:ReturnType<typeof page>,value:unknown){
  expect(p.frames.size).toBe(1);const [handle,callback]=p.frames.entries().next().value!;p.frames.delete(handle);Reflect.apply(callback,undefined,[value]);
}
test('rAF chronology policy keeps backdated first callbacks pending without extra records or state growth',()=>{
  withChronologyHost((p,state)=>{
    const initial=observations(state);expect(initial.filter(row=>row.kind==='assistant-host')).toHaveLength(1);expect(initial.filter(row=>row.kind==='runtime-checkpoint')).toHaveLength(1);expect(initial.filter(row=>row.kind==='animation-frame-checkpoint')).toEqual([]);
    const timerCount=p.timers.size,clock=p.context.performance.now;const now=vi.fn(clock);p.context.performance.now=now;
    for(const value of [99,98,99]){originalChronologyCallback(p,value);expect(state.readHostGuard()).toEqual({status:'pending'});expect(p.frames.size).toBe(1);expect(p.timers.size).toBe(timerCount);expect(observations(state)).toEqual([]);expect(now).not.toHaveBeenCalled();}
    originalChronologyCallback(p,100);expect(state.readHostGuard()).toEqual({status:'pending'});expect(p.frames.size).toBe(1);expect(observations(state).filter(row=>row.kind==='animation-frame-checkpoint').map(row=>({ordinal:row.data.ordinal,timestampMs:row.timestampMs}))).toEqual([{ordinal:1,timestampMs:100}]);
    originalChronologyCallback(p,120);const guard=state.readHostGuard();expect(guard.status).toBe('ready');if(guard.status!=='ready')throw Error('Two eligible original samples required');expect(guard.value.hostObservation).toEqual({clockDomain:'page-performance-ms',timestampMs:100,hostMounted:true,contentMounted:true});expect(guard.value.frames.map(row=>row.timestampMs)).toEqual([100,120]);expect(comparisonHostFrameGuardSchema.safeParse(guard.value).success).toBe(true);expect(p.frames.size).toBe(0);expect(p.timers.size).toBe(timerCount);
    expect(observations(state).filter(row=>row.kind==='animation-frame-checkpoint').map(row=>({ordinal:row.data.ordinal,timestampMs:row.timestampMs}))).toEqual([{ordinal:2,timestampMs:120}]);
  });
});
test('rAF chronology policy treats negative zero as pending before a positive host sample',()=>{
  withChronologyHost((p,state)=>{observations(state);originalChronologyCallback(p,-0);expect(state.readHostGuard()).toEqual({status:'pending'});expect(observations(state)).toEqual([]);originalChronologyCallback(p,100);originalChronologyCallback(p,120);const guard=state.readHostGuard();expect(guard.status).toBe('ready');if(guard.status==='ready')expect(guard.value.frames.map(row=>row.timestampMs)).toEqual([100,120]);});
});
test('rAF chronology policy preserves eligible negative zero at host time zero',()=>{
  withChronologyHost((p,state)=>{originalChronologyCallback(p,-0);expect(state.readHostGuard()).toEqual({status:'pending'});originalChronologyCallback(p,20);const guard=state.readHostGuard();expect(guard.status).toBe('ready');if(guard.status!=='ready')throw Error('Eligible zero must remain original');expect(Object.is(guard.value.frames[0].timestampMs,-0)).toBe(true);expect(guard.value.frames[1].timestampMs).toBe(20);expect(comparisonHostFrameGuardSchema.safeParse(guard.value).success).toBe(true);},0);
});
test.each([NaN,Infinity,-Infinity,-1,Symbol('native anomaly'),null,undefined,'99',{[Symbol.toPrimitive](){throw false;},toJSON(){throw '';}}])('rAF chronology policy rejects malformed or negative first sample without coercion %s',value=>{
  withChronologyHost((p,state)=>{observations(state);originalChronologyCallback(p,value);expect(state.readHostGuard()).toEqual({status:'unavailable',reason:'Distinct chronological rAF timestamp unavailable'});expect(p.frames.size).toBe(0);expect(observations(state)).toEqual([]);});
});
test.each([120,110,99,-0,-1,NaN])('rAF chronology policy rejects post-first nonincreasing or invalid sample %s',value=>{
  withChronologyHost((p,state)=>{originalChronologyCallback(p,120);observations(state);originalChronologyCallback(p,value);expect(state.readHostGuard()).toEqual({status:'unavailable',reason:'Distinct chronological rAF timestamp unavailable'});expect(p.frames.size).toBe(0);expect(observations(state)).toEqual([]);});
});
test.each(['identity','replacement','disconnection'] as const)('rAF chronology policy cannot pend across retained host %s change',change=>{
  withChronologyHost((p,state)=>{originalChronologyCallback(p,99);expect(state.readHostGuard()).toEqual({status:'pending'});observations(state);if(change==='identity')p.bridge.readActiveHost=()=>({activeMessageId:'other',hostMounted:true});else if(change==='replacement')p.candidate.hostElement={...p.host};else p.host.isConnected=false;
    originalChronologyCallback(p,98);expect(state.readHostGuard()).toEqual({status:'unavailable',reason:'Original streaming host removed or replaced'});expect(p.frames.size).toBe(0);expect(observations(state)).toEqual([]);});
});
test('rAF chronology policy stop cancels the sole pending callback and all original cleanup',()=>{
  withChronologyHost((p,state)=>{originalChronologyCallback(p,99);expect(state.readHostGuard()).toEqual({status:'pending'});expect(p.frames.size).toBe(1);observations(state);state.stop();expect(state.readHostGuard()).toEqual({status:'unavailable',reason:'Capture stopped before host readiness'});expect(p.frames.size).toBe(0);expect(p.timers.size).toBe(0);expect([...p.listeners.values()].every(listeners=>listeners.size===0)).toBe(true);expect(p.context.console.warn).toBe(p.nativeConsole.warn);expect(p.context.console.error).toBe(p.nativeConsole.error);expect(observations(state).filter(row=>['assistant-host','runtime-checkpoint','animation-frame-checkpoint'].includes(row.kind))).toEqual([]);state.stop();expect(p.frames.size).toBe(0);expect(p.timers.size).toBe(0);expect(observations(state)).toEqual([]);});
});
test('rAF chronology policy preserves successful guard schema inequality rejection',()=>{
  withChronologyHost((p,state)=>{originalChronologyCallback(p,120);originalChronologyCallback(p,140);const guard=state.readHostGuard();expect(guard.status).toBe('ready');if(guard.status!=='ready')throw Error('Original success must remain ready');expect(comparisonHostFrameGuardSchema.safeParse(guard.value).success).toBe(true);for(const frames of [[{...guard.value.frames[0],timestampMs:99},guard.value.frames[1]],[guard.value.frames[0],{...guard.value.frames[1],timestampMs:120}],[guard.value.frames[0],{...guard.value.frames[1],timestampMs:110}]])expect(comparisonHostFrameGuardSchema.safeParse({...guard.value,frames}).success).toBe(false);});
});
