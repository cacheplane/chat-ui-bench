import fs from'node:fs';import assert from'node:assert/strict';import test from'node:test';import{createRequire}from'node:module';
import{createWarmRuntime}from'./warm-runtime.mjs';import*as instrument from'./instrument.mjs';
const{parseAst}=createRequire(import.meta.url)('rolldown/parseAst');
const header=[1,0,0,0,0,1],indices=Array.from({length:100},(_,i)=>i);
const runtime=createWarmRuntime();
function variable(text,name){let found;function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name===name){assert.equal(found,undefined);found=n;}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}walk(parseAst(text,{},'source.mjs'));assert.ok(found);return text.slice(found.init.arguments[0].start,found.init.arguments[0].end);}
function estimate(text,values){const trace=[],records=[],error={original:true};let read=0;const sizes={get size(){trace.push('size'+(++read));const v=values[read-1];if(v==='throw')throw error;return v;}};const ref={current:{total:100,sizes}},fn=Function('measuredRef','__wh','return('+variable(text,'estimateRowSize')+');')(ref,{estimate(total,first){records.push([total,first]);}});let result,thrown;try{result=fn();}catch(e){thrown=e;}return{trace,records,result,thrown,error};}
test('warm source-local range grammar preserves two exact doubles and canonical vector',()=>{
 const text=runtime.formatRange(header,500.5,0.25,0,99,indices);assert.equal(typeof text,'string');assert.match(text,/^R\|1,0,0,0,0,1,407f480000000000,3fd0000000000000,0,99\|/);assert.ok(text.endsWith('98,99\n'));
});
test('warm E21 and unused entry facts have the closed22-kind shape',()=>{
 const text=runtime.formatEvent(header,21,-1,0,0,1e9,100);assert.equal(typeof text,'string');assert.ok(text.includes(',21,-1,0,0000000000000000,41cdcd6500000000,100\n'));
 for(const t of [0,11]){assert.equal(typeof runtime.formatEvent(header,t,-1,0,0,0,0),'string');assert.equal(runtime.formatEvent(header,t,-1,0,0,0,1),null);}
});
test('production layout records actual generation1 through21 with no zero remap',()=>{
 assert.equal(typeof runtime.formatEvent([1,0,0,0,0,21],0,-1,0,0,0,0),'string');
 assert.equal(runtime.formatEvent([1,0,0,0,0,0],0,-1,0,0,0,0),null);assert.equal(runtime.formatEvent([1,0,0,0,0,22],0,-1,0,0,0,0),null);
});
test('every22 event variant enforces exact row/unused/coercion boundaries',()=>{
 for(let t=0;t<22;t++){
  const row=t===8||t===9||t===10||t===12,i=row?99:-1,n=row?32768:0,v=t===8||t===9||t===18?1e7:t===10?-1e7:0,d=t===8||t===21?1e9:t===9?1e7:0,z=t===6?1:t===2?32768:t===15||t===21?100:0;
  assert.equal(typeof runtime.formatEvent(header,t,i,n,v,d,z),'string','kind'+t);assert.equal(runtime.formatEvent(header,22,i,n,v,d,z),null);
  if(t!==8&&t!==9&&t!==10&&t!==18)assert.equal(runtime.formatEvent(header,t,i,n,1,d,z),null);if(t!==8&&t!==9&&t!==21)assert.equal(runtime.formatEvent(header,t,i,n,v,1,z),null);
  if(!row)assert.equal(runtime.formatEvent(header,t,0,1,v,d,z),null);
 }
 let calls=0;const value={valueOf(){calls++;throw Error('coercion');}};assert.equal(runtime.formatEvent(header,21,-1,0,0,value,1),null);assert.equal(runtime.formatEvent(header,21,-1,0,0,0,value),null);assert.equal(runtime.formatRange(header,value,0,0,99,indices),null);assert.equal(calls,0);
});
test('capture admits exact16R448E and preserves one incomplete prefix after refusal',()=>{
 const r=createWarmRuntime();assert.equal(typeof r.close,'function');
 for(let j=0;j<16;j++)assert.equal(r.range([r.ordinal(),0,0,0,0,1],500,0,0,99,indices),true);
 for(let j=0;j<448;j++)assert.equal(r.event([r.ordinal(),0,0,0,0,1],0,-1,0,0,0,0),true);
 assert.equal(r.event([r.ordinal(),0,0,0,0,1],0,-1,0,0,0,0),false);const c=r.close();assert.equal(c.records,464);assert.equal(c.complete,false);assert.equal(c.reason,'record-capacity');assert.equal(c.text.split('\n').length,465);assert.equal(r.retained(),0);assert.equal(c.nativeGO,false);assert.equal(c.fullWarmReady,false);assert.equal(r.close().reason,'already-closed');
});
test('original estimate callback needs one E21 at completed first-size seam without a readback',()=>{
 const held=instrument.transform('copilot').code,candidate=(instrument.transformWarm??instrument.transform)('copilot').code;
 const before=estimate(held,[1,2]),after=estimate(candidate,[1,2]);assert.equal(before.result,50);assert.deepEqual(before.records,[]);assert.equal(after.result,before.result);assert.deepEqual(after.trace,before.trace);assert.deepEqual(after.records,[[100,1]]);
});
let fixtureSerial=0;
async function privateIngress(runtime){
 const source=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8');
 const extra=`\nexport function sourceFixture(runtime){const ingress=createWarmSourceIngress(runtime),Component=function Target(){},root={},host={tag:3,stateNode:root},work={};root.current={alternate:host};adapter.component(Component);adapter.renderStart(work,Component,root,host);const key=i=>i,instance={itemSizeCache:new Map()};instance.getVirtualIndexes=ingress.capture(instance,()=>[],1);instance.scrollToIndex=ingress.capture(instance,()=>{},2);ingress.adapter.options(instance,{getItemKey:key,lanes:1,enabled:true,initialMeasurementsCache:[],count:100},key);return{ingress,instance,root,host,Component,state:()=>({reason,originalFailed,work:counts.work,sealed,eligible,owner,mapping,carry,exports:counts.exports,censuses:counts.censuses})};}\n//fixture${++fixtureSerial}`;
 return(await import('data:text/javascript;base64,'+Buffer.from(source+extra).toString('base64'))).sourceFixture(runtime);
}
function estimateExperiment(text,observer,opts={}){
 const trace=[],sentinel={original:true};let reads=0,observations=0;
 const mark=name=>{trace.push(name);if(opts.throwAt===name)throw sentinel;};
 const first=opts.firstObject?{valueOf(){mark('first-coercion');return 1;}}:opts.firstZero?0:1;
 const total=opts.totalObject?{valueOf(){mark('total-coercion');return 100;}}:100;
 const sizes={get size(){mark(++reads===1?'first-size':'second-size');return reads===1?first:2;}};
 const current={get total(){mark('total');return total;},get sizes(){mark('sizes');return sizes;}},ref={get current(){mark('current');return current;}};
 const fn=Function('measuredRef','__wh','return('+variable(text,'estimateRowSize')+');')(ref,{estimate(a,b){observations++;observer?.estimate(a,b);}});
 let result,thrown;try{result=fn();}catch(e){thrown=e;}
 return{trace,observations,result,thrown,sentinel};
}
test('actual E21 ingress preserves all original reads/coercions/returns and exact throws',async()=>{
 const old=instrument.transform('copilot').code,now=instrument.transformWarm('copilot').code;
 for(const opts of [{},{firstZero:true},{firstObject:true},{totalObject:true},...['current','total','sizes','first-size','second-size','first-coercion','total-coercion'].map(throwAt=>({throwAt,firstObject:throwAt==='first-coercion',totalObject:throwAt==='total-coercion'}))]){
  const r=createWarmRuntime(),f=await privateIngress(r),before=f.state(),a=estimateExperiment(old,null,opts),b=estimateExperiment(now,f.ingress,opts),after=f.state();
  assert.deepEqual(b.trace,a.trace,JSON.stringify(opts));assert.ok(Object.is(b.result,a.result));assert.equal(!!b.thrown,!!a.thrown);if(a.thrown){assert.equal(a.thrown,a.sentinel);assert.equal(b.thrown,b.sentinel);}
  assert.deepEqual(after,before,'new recorder has no old publication/count/work authority');
  const completedFirst=!['current','total','sizes','first-size'].includes(opts.throwAt);assert.equal(b.observations,completedFirst?1:0);const closed=r.close();
  if(completedFirst&&!opts.firstObject&&!opts.totalObject){assert.equal(closed.records,1);assert.equal(closed.complete,true);}else if(opts.firstObject||opts.totalObject){assert.equal(closed.records,0);assert.equal(closed.complete,false);assert.equal(closed.reason,'invalid-record');}else assert.equal(closed.records,0);
 }
});
test('E21 is attempted before original first-value coercion and second getter',()=>{
 const text=instrument.transformWarm('copilot').code,trace=[],value={valueOf(){trace.push('coerce');return 1;}},sizes={get size(){trace.push('size');return value;}},ref={current:{total:100,sizes}};
 const fn=Function('measuredRef','__wh','return('+variable(text,'estimateRowSize')+');')(ref,{estimate(){trace.push('E21');}});fn();assert.deepEqual(trace,['size','E21','coerce','size','coerce']);
});
test('private close refuses a pre-E21 original failure even with no later record',async()=>{
 const old=instrument.transform('copilot').code,now=instrument.transformWarm('copilot').code;
 for(const throwAt of ['current','total','sizes','first-size']){
  const r=createWarmRuntime(),f=await privateIngress(r),a=estimateExperiment(old,null,{throwAt}),b=estimateExperiment(now,f.ingress,{throwAt});
  assert.deepEqual(b.trace,a.trace);assert.equal(a.thrown,a.sentinel);assert.equal(b.thrown,b.sentinel);assert.equal(b.observations,0);
  // Exact existing React finally callee: normal=false latches original-failure.
  f.ingress.adapter.renderEnd(null,false);const state=f.state();assert.equal(state.reason,'original-failure');
  const closed=f.ingress.close();assert.equal(closed.complete,false);assert.equal(closed.reason,'source-fault');assert.equal(closed.records,0);
  assert.deepEqual(f.state(),state,'close has no old observer publication authority');
 }
});
test('warm transform reverses every whole original and leaves default transform exact',()=>{
 for(const kind of ['core','copilot','react','wrapper']){const old=instrument.transform(kind),now=instrument.transformWarm(kind);assert.equal(instrument.reverseWarm(now),instrument.reverse(old));assert.equal(instrument.sha(instrument.reverseWarm(now)),old.sourceSha256);assert.throws(()=>instrument.reverseWarm({...now,code:now.code+' '}));assert.ok(now.base.edits.length+now.changes.length<=96);}
});
function sourceParts(text){
 const ast=parseAst(text,{},'core.mjs'),parts={};
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='AssignmentExpression'&&n.left?.object?.type==='ThisExpression'&&['calculateRange','getVirtualIndexes'].includes(n.left.property?.name)){const rhs=n.right.callee?.property?.name==='capture'?n.right.arguments[1]:n.right;parts[n.left.property.name]=rhs.arguments.map(a=>text.slice(a.start,a.end));}
  if(n.type==='FunctionDeclaration'&&['calculateRangeImpl','findNearestBinarySearchFlat'].includes(n.id?.name))parts[n.id.name]=text.slice(n.start,n.end);
  if(n.type==='VariableDeclarator'&&['defaultRangeExtractor','findNearestBinarySearch'].includes(n.id?.name))parts[n.id.name]='const '+text.slice(n.start,n.end)+';';
  for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);
 }walk(ast);return parts;
}
function rangeCallbacks(text,instance,ingress){
 const p=sourceParts(text);return Function('__wh',p.defaultRangeExtractor+p.findNearestBinarySearch+p.findNearestBinarySearchFlat+p.calculateRangeImpl+
  'return(function(){return {calculateDeps:('+p.calculateRange[0]+'),calculate:('+p.calculateRange[1]+'),deps:('+p.getVirtualIndexes[0]+'),indexes:('+p.getVirtualIndexes[1]+'),extractor:defaultRangeExtractor,kernel:calculateRangeImpl};}).call(this);').call(instance,ingress);
}
test('range capture pairs original calculated bounds and extractor without a range reread',async()=>{
 const r=createWarmRuntime(),f=await privateIngress(r),instance=f.instance,trace=[];let range;
 Object.defineProperty(instance,'range',{get(){trace.push('range-get');return range;},set(v){trace.push('range-set');range=v;}});
 instance._singleLaneMeasurements=null;instance.isScrolling=false;instance.maybeNotify={updateDeps(){trace.push('notify');}};instance.options={overscan:5,count:100,lanes:1};
 const c=rangeCallbacks(instrument.transformWarm('core').code,instance,f.ingress);instance.options.rangeExtractor=c.extractor;instance.calculateRange=()=>range;
 const measurements=Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200}));
 const before=f.state(),returned=c.calculate(measurements,500,1000,1);assert.equal(returned,range);assert.deepEqual(trace,['range-set','range-get']);
 const deps=c.deps();const result=c.indexes(...deps);assert.deepEqual(result,Array.from({length:13},(_,i)=>i));assert.equal(trace.filter(x=>x==='range-get').length,1);
 const closed=f.ingress.close();assert.equal(closed.records,1);assert.match(closed.text,/\|0,1,2,3,4,5,6,7,8,9,10,11,12\n$/);assert.deepEqual(f.state(),before);
});
async function rangeExperiment(text,options={}){
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance,trace=[],sentinel={original:true};let range,reads=0;
 const read=(name,value)=>{trace.push(name);if(++reads===options.throwRead)throw sentinel;return value;};
 Object.defineProperty(instance,'range',{get(){return read('range-return',options.replaceReturn?options.replacement:range);},set(value){read('range-set',0);range=value;}});
 Object.defineProperty(instance,'_singleLaneMeasurements',{get(){return read('flat',null);}});
 Object.defineProperty(instance,'isScrolling',{get(){return read('scrolling',false);}});instance.maybeNotify={updateDeps(){read('notify',0);}};
 const c=rangeCallbacks(text,instance,f.ingress),values={overscan:5,count:options.zero?0:100,lanes:1,rangeExtractor:options.extractor??c.extractor};
 instance.options={};for(const key of Object.keys(values))Object.defineProperty(instance.options,key,{get(){return read(key,values[key]);}});
 instance.calculateRange=()=>read('calculate-call',range);
 const rows=Array.from({length:options.zero?0:100},(_,i)=>({get start(){return read('start'+i,i*200);},get end(){return read('end'+i,(i+1)*200);}}));
 let returned,result,thrown;const state=f.state();try{returned=c.calculate(rows,500,1000,1);result=c.indexes(...c.deps());}catch(e){thrown=e;}
 return{trace,reads,returned,result,thrown,sentinel,state,after:f.state(),close:f.ingress.close()};
}
test('range/extractor whole original getter trace and every throw identity are unchanged',async()=>{
 const old=instrument.transform('core').code,now=instrument.transformWarm('core').code,normal=await rangeExperiment(old);
 for(const options of [{},{zero:true},...Array.from({length:normal.reads},(_,i)=>({throwRead:i+1}))]){
  const a=await rangeExperiment(old,options),b=await rangeExperiment(now,options);assert.deepEqual(b.trace,a.trace);assert.deepEqual(b.result,a.result);assert.deepEqual(b.returned,a.returned);
  assert.equal(!!b.thrown,!!a.thrown);if(a.thrown){assert.equal(a.thrown,a.sentinel);assert.equal(b.thrown,b.sentinel);assert.equal(b.close.complete,false);assert.equal(b.close.reason,'source-fault');}
  assert.deepEqual(b.after,b.state);if(options.zero){assert.equal(b.close.records,0);assert.equal(b.close.complete,true);}
 }
});
test('custom extractor remains original but its arbitrary result is never inspected',async()=>{
 let reads=0,calls=0;const output=new Proxy([], {get(t,k){reads++;return Reflect.get(t,k);}}),extractor=()=>{calls++;return output;};
 const b=await rangeExperiment(instrument.transformWarm('core').code,{extractor});assert.equal(b.result,output);assert.equal(calls,1);assert.equal(reads,0);assert.equal(b.close.reason,'pair-extractor');assert.equal(b.close.records,0);
});
test('range return getter identity is preserved while contradictory publication refuses pairing',async()=>{
 const replacement={startIndex:5,endIndex:7},b=await rangeExperiment(instrument.transformWarm('core').code,{replaceReturn:true,replacement});
 assert.equal(b.returned,replacement);assert.equal(b.close.reason,'pair-null');assert.equal(b.close.records,0);assert.deepEqual(b.after,b.state);
});
test('pinned original memo cache hits reuse range provenance and emit only actual extractor evaluations',async()=>{
 const pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),raw=instrument.boundedRead(instrument.sourceRoot+'/'+pin.path,pin.bytes);assert.equal(instrument.sha(raw),pin.sha256);
 const {memo}=await import(new URL('../../'+pin.path,import.meta.url)),runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance;
 let rows=[],outer=0,offset=0;instance.getMeasurements=()=>rows;instance.getSize=()=>outer;instance.getScrollOffset=()=>offset;instance._singleLaneMeasurements=null;instance.isScrolling=false;instance.maybeNotify={updateDeps(){}};
 const c=rangeCallbacks(instrument.transformWarm('core').code,instance,f.ingress);instance.options={lanes:1,count:0,overscan:5,rangeExtractor:c.extractor};instance.calculateRange=memo(c.calculateDeps,c.calculate,{});instance.getVirtualIndexes=memo(c.deps,c.indexes,{});
 assert.deepEqual(instance.getVirtualIndexes(),[]);assert.equal(runtime.retained(),0);assert.equal(runtime.active(),true);
 rows=Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200}));outer=500;offset=1000;instance.options.count=100;
 const first=instance.getVirtualIndexes();assert.equal(runtime.retained(),1);assert.equal(instance.getVirtualIndexes(),first);assert.equal(runtime.retained(),1);
 instance.options.overscan=6;const second=instance.getVirtualIndexes();assert.notEqual(second,first);assert.equal(runtime.retained(),2);assert.equal(instance.getVirtualIndexes(),second);assert.equal(runtime.retained(),2);
 offset=1200;instance.getVirtualIndexes();const closed=f.ingress.close();assert.equal(closed.complete,true);assert.equal(closed.records,3);
});
test('range dependency reentry refuses capture without suppressing any original nested invocation',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance;instance._singleLaneMeasurements=null;instance.isScrolling=false;instance.maybeNotify={updateDeps(){}};
 const c=rangeCallbacks(instrument.transformWarm('core').code,instance,f.ingress);instance.options={lanes:1,count:100,overscan:5,rangeExtractor:c.extractor};let range=c.calculate(Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200})),500,1000,1),calls=0;
 instance.calculateRange=()=>{if(++calls===1)c.deps();return range;};c.deps();assert.equal(calls,2);const closed=f.ingress.close();assert.equal(closed.complete,false);assert.equal(closed.reason,'pair-reentrant');assert.equal(closed.records,0);
});
test('chosen render start/end and commit start/mutation events use actual private tokens',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=f.ingress.adapter;
 const unrelated=a.renderStart({},function Other(){},f.root,f.host);assert.equal(unrelated,null);assert.equal(runtime.retained(),0);
 const render=a.renderStart({},f.Component,f.root,f.host);assert.ok(render);a.renderEnd(render,true);
 const commit=a.commitStart(f.root,f.host);assert.ok(commit);a.commitMutationEnd(commit,true);
 const text=f.ingress.close().text,lines=text.trim().split('\n');assert.equal(lines.length,4);assert.deepEqual(lines.map(s=>s.split(',')[6]),['00','01','02','03']);
 assert.equal(lines[0].split(',').at(-1),'0');assert.equal(lines[1].split(',').at(-1),'1');assert.equal(lines[2].split(',').at(-1),'0');assert.equal(lines[3].split(',').at(-1),'1');
});
async function memoExperiment(text,throwRead){
 const pin=instrument.registry.find(p=>p.path.endsWith('/utils.js'));const {memo}=await import(new URL('../../'+pin.path,import.meta.url));
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance,trace=[],sentinel={original:true};let calls=0,offset=1000;
 const mark=name=>{trace.push(name);if(++calls===throwRead)throw sentinel;};
 const rows=Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200})),methods={getMeasurements:()=>rows,getSize:()=>500,getScrollOffset:()=>offset};
 for(const [key,fn]of Object.entries(methods))Object.defineProperty(instance,key,{get(){mark(key+'-get');return()=>{mark(key+'-call');return fn();};}});
 const c=rangeCallbacks(text,instance,f.ingress),opts={lanes:1,count:100,overscan:5,rangeExtractor:c.extractor};Object.defineProperty(instance,'options',{get(){mark('options');return opts;}});
 for(const key of Object.keys(opts)){const value=opts[key];Object.defineProperty(opts,key,{get(){mark(key);return value;}});}
 Object.defineProperty(instance,'_singleLaneMeasurements',{get(){mark('flat');return null;}});instance.isScrolling=false;instance.maybeNotify={updateDeps(){mark('notify');}};
 instance.calculateRange=memo(c.calculateDeps,c.calculate,{});instance.getVirtualIndexes=memo(c.deps,c.indexes,{});
 const results=[];let thrown;const before=f.state();try{results.push(instance.calculateRange());results.push(instance.calculateRange());offset=1200;results.push(instance.calculateRange());results.push(instance.getVirtualIndexes());results.push(instance.getVirtualIndexes());}catch(e){thrown=e;}
 return{trace,calls,results,thrown,sentinel,before,after:f.state(),close:f.ingress.close()};
}
test('whole pinned memo calculate dependencies preserve every getter/call throw and close fault',async()=>{
 const old=instrument.transform('core').code,now=instrument.transformWarm('core').code,normal=await memoExperiment(old);
 for(const throwRead of [undefined,...Array.from({length:normal.calls},(_,i)=>i+1)]){
  const a=await memoExperiment(old,throwRead),b=await memoExperiment(now,throwRead);assert.deepEqual(b.trace,a.trace);assert.deepEqual(b.results,a.results);assert.equal(!!a.thrown,!!b.thrown);assert.deepEqual(b.after,b.before);
  if(a.thrown){assert.equal(a.thrown,a.sentinel);assert.equal(b.thrown,b.sentinel);assert.equal(b.close.complete,false);assert.equal(b.close.reason,'source-fault');}else{assert.equal(b.close.complete,true);assert.equal(b.close.records,1);}
 }
});
function measureExperiment(text,observer,throwRead){
 const trace=[],sentinel={original:true};let calls=0,written;
 const mark=name=>{trace.push(name);if(++calls===throwRead)throw sentinel;};
 const sizes={get(i){mark('get-old-size');return 10;},set(i,v){mark('set-size');}},current={get total(){mark('total');return 100;},get sizes(){mark('sizes');return sizes;},set total(v){mark('set-total');written=v;}},ref={get current(){mark('current');return current;}};
 const element={get getBoundingClientRect(){mark('get-rect-method');return()=>{mark('call-rect');return{get height(){mark('height');return 20;}};}},get dataset(){mark('dataset');return{get index(){mark('index');return '5';}};}};
 const fn=Function('measuredRef','__wh','return('+variable(text,'measureRowElement')+');')(ref,observer);let result,thrown;try{result=fn(element);}catch(e){thrown=e;}return{trace,calls,result,thrown,sentinel,written};
}
test('E08 captures original assigned RHS after setters and Map.set with no total readback',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=measureExperiment(instrument.transform('copilot').code,null),b=measureExperiment(instrument.transformWarm('copilot').code,f.ingress);
 assert.deepEqual(b.trace,a.trace);assert.equal(b.result,a.result);assert.equal(b.written,110);const closed=f.ingress.close();assert.equal(closed.records,1);assert.match(closed.text,/,08,-1,0,4034000000000000,405b800000000000,0\n$/);
});
test('E08 every original getter/method/setter throw preserves identity and incomplete close',async()=>{
 const old=instrument.transform('copilot').code,now=instrument.transformWarm('copilot').code,normal=measureExperiment(old,null);
 assert.deepEqual(normal.trace,['get-rect-method','call-rect','height','dataset','index','current','total','sizes','current','get-old-size','set-total','set-size']);
 for(let throwRead=1;throwRead<=normal.calls;throwRead++){
  const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=measureExperiment(old,null,throwRead),b=measureExperiment(now,f.ingress,throwRead),before=f.state();
  assert.deepEqual(b.trace,a.trace);assert.equal(a.thrown,a.sentinel);assert.equal(b.thrown,b.sentinel);assert.equal(b.result,a.result);assert.equal(b.written,a.written);
  // Existing scoped-finally callee must forward original failure even with no record.
  f.ingress.adapter.end(f.instance,null,false);const closed=f.ingress.close();assert.equal(closed.records,0);assert.equal(closed.complete,false);assert.equal(closed.reason,'source-fault');assert.equal(f.state().sealed,before.sealed);assert.equal(f.state().eligible,before.eligible);
 }
});
// A complete capacity case, not a claim all field extrema coexist in a browser.
function maximumWarmWrapper(){
 const falseAuthority={qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'},runtime=createWarmRuntime();
 for(let j=0;j<16;j++)runtime.range([runtime.ordinal(),32768,32768,1,1,21],1e7,1e7,99,99,indices);
 for(let j=0;j<448;j++)runtime.event([runtime.ordinal(),32768,32768,1,1,21],2,-1,0,0,0,32768);
 const chronology=runtime.close(),partial={kind:'live-history-C-partial-v1',phase:'preselection',status:'unavailable',reason:'original-failure',fullH100Readiness:'unavailable',generations:{owner:null,cache:null,layout:21,commit:32768},counts:{scopes:12832,renders:32,commits:32,nodes:3200,writes:6400,censuses:4,exports:4,options:64,detach:6400,layoutEvents:20,work:67108864},rows:indices.map(i=>[i,i,32768,32768,0.0000010000000000000002,null,null,21,32768,32768,32768,32768,6400,true,false,false]),epochs:Array.from({length:3200},()=>[32768,99,32768,32768,false,false,1,21]),closure:{active:4608,pending:8,disposed:false,late:false,originalFailed:false,fontFailed:false},authority:falseAuthority};
 return{kind:'warm-history-C-wrapper-v1',slot:1,partial,chronology,plan:{status:'prepared-structural-only',reason:null,gapStart:99,gapEnd:99,partition:99,targets:'99,98,97,96,95,94,93,92,91,90,89,88',finalLow:99,finalHigh:99,steps:12,rangeCalls:24},fence:{historicalComplete:false,liveSubsetValid:false,fullWarmReady:false,connectedRows:101,reason:'live-binding-gap',nativeGO:false,qualified:false,fps:null},authority:falseAuthority};
}
test('whole warm01 100-row 3200-epoch maximum crossproduct uses unchanged slot ceiling',async()=>{
 const policy=await import('./policy.mjs');assert.equal(typeof policy.encodeWarmSlot,'function');const value=maximumWarmWrapper(),bytes=policy.encodeWarmSlot('partial-01.json',value);
 assert.equal(value.partial.rows.length,100);assert.equal(value.partial.epochs.length,3200);assert.equal(value.chronology.records,464);assert.equal(value.chronology.complete,true);assert.ok(bytes.length<=262144);assert.equal(JSON.parse(bytes).fence.fps,null);assert.equal(Object.keys(value.fence).length,8);
 assert.throws(()=>policy.encodeWarmSlot('partial-02.json',{...value,slot:2}));assert.throws(()=>policy.encodeWarmSlot('partial-01.json',{...value,fence:{...value.fence,nativeGO:true}}));
});
test('whole schema upper bound includes JSON escaping and each finite field maximum',async()=>{
 const {encodeWarmSlot}=await import('./policy.mjs'),value=maximumWarmWrapper(),capacity=encodeWarmSlot('partial-01.json',value);
 // Independent per-field maxima may be inconsistent jointly; that only enlarges
 // this upper bound. Positive IEEE64 JSON decimals <=1e7 need at most24 chars:
 // fixed notation has <=5 fractional leading zeroes +17 significant digits;
 // scientific notation, including -324 exponent, is shorter. No negative sizes.
 assert.equal(JSON.stringify(value.partial.rows[0][4]).length,24);
 const upper=structuredClone(value);upper.chronology.text='';upper.chronology.reason='record-capacity';upper.chronology.complete=false;upper.chronology.bytes=49152;upper.chronology.records=464;
 upper.plan.reason='final-cached-remount';for(const k of ['gapStart','gapEnd','partition','finalLow','finalHigh'])upper.plan[k]=null;
 // Text whitelist excludes quotes/backslashes. At most464 newline records each
 // add one escape byte; the empty JSON string already contributes its quotes.
 const bound=Buffer.byteLength(JSON.stringify(upper))+49152+464;
 assert.ok(capacity.length<=bound);assert.ok(bound<=262144);assert.equal(value.partial.epochs.length,3200);
 for(let slot=2;slot<=4;slot++){const b=encodeWarmSlot('partial-0'+slot+'.json',{...value,slot,chronology:null,plan:null});assert.ok(b.length<=bound);}
 assert.ok(bound*4<=1048576);
});
test('new warm encoder serializes the whole wrapper once and never repeats original partial serialization',async()=>{
 const {encodeWarmSlot}=await import('./policy.mjs'),value=maximumWarmWrapper(),original=JSON.stringify,calls=[];
 try{JSON.stringify=function(v,...args){calls.push(v===value?'wrapper':v===value.partial?'partial':'other');return original.call(this,v,...args);};encodeWarmSlot('partial-01.json',value);}finally{JSON.stringify=original;}
 assert.deepEqual(calls,['wrapper']);
 let coercions=0;const name={toString(){coercions++;throw Error('coerce');}};assert.throws(()=>encodeWarmSlot(name,value));assert.equal(coercions,0);
});
async function warmScopeFacts(runtime,options={}){
 const text=fs.readFileSync(new URL('./lifecycle.node.mjs',import.meta.url),'utf8'),ast=parseAst(text,{},'lifecycle.mjs'),declaration=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='BOUNDARY_FIXTURE').declarations[0].init;
 let fixture=Function('return('+text.slice(declaration.start,declaration.end)+');')();
 fixture=fixture.replace('export function boundaryFacts(opts={}){','export function warmScopeFacts(runtime,opts={}){const ingress=createWarmSourceIngress(runtime),adapter=ingress.adapter;')
  .replace('adapter.renderEnd(r,true);','for(let i=0;i<100;i++)adapter.key(rows[i],messages[i].id);adapter.renderEnd(r,true);')
  .replace('adapter.commitMutationEnd(c,true);const f=adapter.fiberStart(rr,null,w);if(map)adapter.mapping(r);','if(!opts.cleanup){adapter.commitMutationEnd(c,true);const f=adapter.fiberStart(rr,null,w);if(map)adapter.mapping(r);}')
  .replace('adapter.options(ow,',"if(!ow.getVirtualIndexes){ow.getVirtualIndexes=ingress.capture(ow,()=>[],1);ow.scrollToIndex=ingress.capture(ow,()=>{},2);}adapter.options(ow,")
  .replace('return{adapter,root,instance,','return{ingress:createWarmSourceIngress(runtime),adapter,root,instance,')
  .replace('adapter.fiberEnd(f,true);adapter.commitLayoutEnd(rr,rw,true);','');
 const source=fs.readFileSync(new URL('./adapter.mjs',import.meta.url),'utf8');return(await import('data:text/javascript;base64,'+Buffer.from(source+fixture+'\n//scope'+(++fixtureSerial)).toString('base64'))).warmScopeFacts(runtime,options);
}
test('ref and RO source scopes record actual admitted entry/exit without extra credits',async()=>{
 const runtime=createWarmRuntime(),f=await warmScopeFacts(runtime),p=f.prepare(100,true),before=f.inspect();assert.equal(before.reason,null);
 const ref=f.adapter.begin(f.instance,1,{});assert.ok(ref);f.adapter.end(f.instance,ref,true);
 const batch=f.adapter.begin(f.instance,3);assert.ok(batch);f.adapter.end(f.instance,batch,true);
 // Scope methods expose only the existing private observer tokens to this fixture.
 const after=f.inspect();assert.equal(after.reason,null);assert.equal(after.nodes,before.nodes);assert.equal(after.writes,before.writes);
 const lines=runtime.close().text.trim().split('\n'),kinds=lines.map(s=>s.split(',')[6]);assert.ok(kinds.includes('06'));assert.ok(kinds.includes('07'));assert.ok(kinds.includes('11'));assert.ok(kinds.includes('13'));
});
test('RO bind uses an admitted epoch and cleanup finally adds zero measurement credit',async()=>{
 const runtime=createWarmRuntime(),f=await warmScopeFacts(runtime);f.prepare(100,true);const batch=f.adapter.begin(f.instance,3),entry=f.adapter.begin(f.instance,2),node={};assert.ok(batch&&entry);f.adapter.bind(f.instance,entry,node,5);assert.ok(entry.node);f.adapter.end(f.instance,entry,true);f.adapter.end(f.instance,batch,true);assert.equal(f.inspect().reason,null);
 const bind=runtime.close().text.trim().split('\n').find(s=>s.split(',')[6]==='12');assert.ok(bind);assert.equal(bind.split(',')[7],'5');assert.equal(Number(bind.split(',')[8]),entry.node.id);assert.equal(f.inspect().writes,0);
 const cleanupRuntime=createWarmRuntime(),g=await warmScopeFacts(cleanupRuntime,{cleanup:true});g.prepare(100,false);const before=g.inspect(),scope=g.adapter.beginCleanup(g.instance,null);assert.ok(scope);g.adapter.endCleanup(g.instance,scope,true);const after=g.inspect();assert.equal(after.reason,null);assert.equal(after.nodes,before.nodes);assert.equal(after.writes,before.writes);assert.equal(after.eligible,false);assert.equal(after.baseline,false);
 const kinds=cleanupRuntime.close().text.trim().split('\n').map(s=>s.split(',')[6]);assert.ok(kinds.includes('16'));assert.ok(kinds.includes('17'));
});
async function sourceCoreClass(text,ingress){
 const ast=parseAst(text,{},'core.mjs'),removed=[],names=[],values=[];
 for(const n of ast.body){
  if(n.type==='ImportDeclaration'){
   removed.push([n.start,n.end]);if(n.source.value.startsWith('./')){const path=new URL('../../node_modules/@tanstack/virtual-core/dist/esm/'+n.source.value.slice(2),import.meta.url),mod=await import(path);for(const s of n.specifiers){names.push(s.local.name);values.push(mod[s.imported.name]);}}
  }else if(n.type==='ExportNamedDeclaration'||n.type==='ExpressionStatement'&&n.expression.callee?.object?.name==='__lh'&&n.expression.callee.property?.name==='moduleBinding'||n.type==='VariableDeclaration'&&n.declarations.some(d=>['__wh','__lh'].includes(d.id?.name)))removed.push([n.start,n.end]);
 }
 let code=text;for(const[a,b]of removed.sort((x,y)=>y[0]-x[0]))code=code.slice(0,a)+code.slice(b);
 return Function(...names,'__lh','__wh',code+';return {Virtualizer,observeElementRect};')(...values,ingress.adapter,ingress);
}
async function virtualFixture(text,count=100,instantiate=true,initialRender=true){
 const runtime=createWarmRuntime(),source=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8'),extra=`\nexport function unbound(runtime){const ingress=createWarmSourceIngress(runtime),C=function Target(){},root={},host={tag:3,stateNode:root};root.current={alternate:host};adapter.component(C);${initialRender?'adapter.renderStart({},C,root,host);':''}return{ingress,start(work){return adapter.renderStart(work,C,root,host);},end(r){adapter.renderEnd(r,true);},state:()=>({reason,originalFailed,work:counts.work,owner,mapping,carry,sealed,eligible,options:counts.options,renders:counts.renders})};}\n//unbound${++fixtureSerial}`;
 const f=(await import('data:text/javascript;base64,'+Buffer.from(source+extra).toString('base64'))).unbound(runtime),bindings=await sourceCoreClass(text,f.ingress),trace=[];
 const instance=instantiate?new bindings.Virtualizer({count,estimateSize:()=>200,getScrollElement:()=>null,onChange(...args){trace.push(['change',args[0]===instance,args[1]]);},anchorTo:'end'}):null;return{runtime,f,instance,trace,bindings};
}
test('diagnostic original constructor preserves first capture site through later RAF and close',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code);assert.equal(x.f.ingress.healthy(),true);
 const second=new x.bindings.Virtualizer({count:0,estimateSize:()=>200,getScrollElement:()=>null});assert.notEqual(second,x.instance);
 assert.throws(()=>x.f.ingress.controllerFrame(),e=>e.message==='C-warm-raf-10');
 assert.equal(x.runtime.diagnostic(),'10');const close=x.runtime.close();assert.equal(close.reason,'source-fault');assert.equal(x.runtime.diagnostic(),'10');
});
test('diagnostic sticky runtime tag preserves old close reason and explicit unknown after healthy close',()=>{
 const r=createWarmRuntime();r.fail('pair-stale','68');r.fail('source-fault','10');assert.equal(r.diagnostic(),'68');assert.equal(r.close().reason,'pair-stale');r.fail('source-fault','01');assert.equal(r.diagnostic(),'68');
 const fresh=createWarmRuntime();assert.equal(fresh.diagnostic(),'00');assert.equal(fresh.close().reason,null);fresh.fail('source-fault','10');assert.equal(fresh.diagnostic(),'00');assert.equal(fresh.close().reason,'already-closed');
});
test('diagnostic complete75 source-extracted failure calls latch exactly once without changing public reasons',()=>{
 const adapterText=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8'),runtimeText=fs.readFileSync(new URL('warm-runtime.mjs',import.meta.url),'utf8'),adapterAst=parseAst(adapterText,{},'adapter.mjs'),runtimeAst=parseAst(runtimeText,{},'runtime.mjs'),factory=adapterAst.body.find(n=>n.declaration?.id?.name==='createWarmSourceIngress').declaration;
 let sourceErrorText;const calls=[];function walk(n,text){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='sourceError')sourceErrorText=text.slice(n.start,n.end);if(n.type==='CallExpression'&&(n.callee.name==='sourceError'||n.callee.object?.name==='runtime'&&n.callee.property?.name==='fail'||n.callee.name==='fail')){const site=n.arguments.at(-1);if(site?.type==='Literal'&&/^\d\d$/.test(site.value))calls.push({code:site.value,text:text.slice(n.start,n.end),reason:n.callee.name==='sourceError'?'source-fault':n.arguments[0].value});else if(n.callee.name==='sourceError'&&site?.type==='ConditionalExpression'){assert.equal(text.slice(site.test.start,site.test.end),'kind===1');for(const kind of[1,2]){const code=(kind===1?site.consequent:site.alternate).value;assert.ok(code==='10'||code==='01');calls.push({code,text:'(()=>{const kind='+kind+';return '+text.slice(n.start,n.end)+';})()',reason:'source-fault'});}}}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(x=>walk(x,text));else if(v&&typeof v==='object')walk(v,text);}
 walk(factory,adapterText);walk(runtimeAst,runtimeText);assert.equal(calls.length,79);assert.deepEqual([...new Set(calls.map(x=>x.code))].sort(),Array.from({length:74},(_,i)=>String(i+1).padStart(2,'0')));assert.ok(sourceErrorText);
 calls.push({code:'75',text:'sourceError()',reason:'source-fault'});for(const call of calls){const r=createWarmRuntime(),sourceError=Function('runtime','let sourceFault=false;return('+sourceErrorText+');')(r);Function('runtime','fail','sourceError','return('+call.text+');')(r,r.fail,sourceError);assert.equal(r.diagnostic(),call.code);r.fail('pair-owner','00');sourceError('01');const dto=r.close();assert.equal(dto.reason,call.reason);assert.equal(r.diagnostic(),call.code);assert.equal(dto.complete,false);assert.equal(dto.records,0);assert.equal(dto.text,'');assert.equal(dto.nativeGO,false);}
});
test('diagnostic real controller RAF branches distinguish entry callback quota and original throw',async()=>{
 const oldWindow=globalThis.window;try{
  delete globalThis.window;{const r=createWarmRuntime(),f=await privateIngress(r);assert.throws(()=>f.ingress.controllerFrame(),e=>e.message==='C-warm-raf-05');assert.equal(r.diagnostic(),'05');}
  const callbacks=[];globalThis.window={requestAnimationFrame(fn){callbacks.push(fn);}};
  {const r=createWarmRuntime(),f=await privateIngress(r);for(let i=0;i<32;i++){const p=f.ingress.controllerFrame();callbacks.shift()();await p;}assert.throws(()=>f.ingress.controllerFrame(),e=>e.message==='C-warm-raf-06');assert.equal(r.diagnostic(),'06');}
  {const r=createWarmRuntime(),f=await privateIngress(r);const p=f.ingress.controllerFrame(),callback=callbacks.shift();callback();await p;callback();assert.equal(r.diagnostic(),'08');assert.equal(f.ingress.healthy(),false);}
  {const r=createWarmRuntime(),f=await privateIngress(r);const p=f.ingress.controllerFrame();r.fail('pair-stale','68');callbacks.shift()();await assert.rejects(p,e=>e.message==='C-warm-raf-68');assert.equal(r.diagnostic(),'68');}
  {const sentinel={nativeRaf:true};globalThis.window={requestAnimationFrame(){throw sentinel;}};const r=createWarmRuntime(),f=await privateIngress(r);await assert.rejects(f.ingress.controllerFrame(),e=>e===sentinel);assert.equal(r.diagnostic(),'09');}
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});
test('diagnostic actual append failures preserve held public DTO and reentrant getter trace',async()=>{
 const text=fs.readFileSync(new URL('warm-runtime.mjs',import.meta.url),'utf8'),old=text.replace(/fail\(('[^']+'),'[0-9]{2}'\)/g,'fail($1)').replace("function fail(code,site='00'){if(!closed)refusal??=code+'|'+site;return false;}","function fail(code){if(!closed)refusal??=code;return false;}").replace("reason:refusal===null?null:refusal.slice(0,-3)","reason:refusal").replace("diagnostic:()=>refusal===null?'00':refusal.slice(-2),",'');assert.equal(instrument.sha(old),'b559587ca5d216d55596bf9125b809c6c4dbd4cd63f76cb2e1e412ee52b6c236');const held=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
 for(const mode of ['valid','invalid','ordinal','capacity','reentrant']){const traces=[],results=[];for(const factory of [held.createWarmRuntime,createWarmRuntime]){const r=factory(),trace=[],h=[1,0,0,0,0,1];if(mode==='reentrant')Object.defineProperty(h,0,{get(){trace.push('header0');r.event([1,0,0,0,0,1],0,-1,0,0,0,0);return 1;}});if(mode==='capacity')for(let j=0;j<448;j++)r.event([r.ordinal(),0,0,0,0,1],0,-1,0,0,0,0);const value=r.event(mode==='ordinal'?[2,0,0,0,0,1]:h,mode==='invalid'?22:0,-1,0,0,0,0);if(r.diagnostic&&mode!=='valid')assert.equal(r.diagnostic(),{invalid:'72',ordinal:'73',capacity:'71',reentrant:'70'}[mode]);results.push({value,close:r.close()});traces.push(trace);}assert.deepEqual(results[1],results[0],mode);assert.deepEqual(traces[1],traces[0],mode);}
 // Site74 is a defensive guard, unreachable under these prior owned format/count bounds.
 assert.equal(16*384+448*96,49152);
});
test('original notify and conditional nextCount seams emit only already evaluated primitives',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code);assert.equal(x.f.state().reason,null);assert.equal(x.runtime.retained(),0,'constructor does not fabricate nextCount');
 x.instance.notify(false);x.instance.scrollElement={};x.instance.setOptions({...x.instance.options,count:100});assert.equal(x.f.state().reason,null);assert.deepEqual(x.trace,[['change',true,false]]);
 const kinds=x.f.ingress.close().text.trim().split('\n').map(s=>s.split(',')[6]);assert.ok(kinds.includes('14'));assert.ok(kinds.includes('15'));
});
test('original scroll command resolved targets retain exact callee/argument order',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code),trace=[];
 Object.defineProperty(x.instance,'_startScroll',{get(){trace.push('start-get');return(...args)=>{trace.push(['start-call',args[1]]);};}});
 Object.defineProperty(x.instance,'getOffsetForAlignment',{get(){trace.push('offset-get');return(value,align)=>{trace.push(['offset-call',value,align]);return 123;};}});
 x.instance.scrollToOffset(15,{align:'end'});assert.deepEqual(trace,['start-get','offset-get',['offset-call',15,'end'],['start-call',123]]);
 const line=x.f.ingress.close().text.trim().split('\n').find(s=>s.split(',')[6]==='18');assert.ok(line);assert.equal(line.split(',').at(-1),'0');
});
function assignedArrow(text,name){let result;function walk(n){if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left.object?.type==='ThisExpression'&&n.left.property?.name===name){assert.equal(result,undefined);result=text.slice(n.right.start,n.right.end);}for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}walk(parseAst(text,{},'core.mjs'));assert.ok(result);return result;}
async function resizeExperiment(text){
 const runtime=createWarmRuntime(),f=await warmScopeFacts(runtime),p=f.prepare(100,true),instance=f.instance,node={},scope=f.adapter.begin(instance,1,node);f.adapter.bind(instance,scope,node,5);const edge=f.adapter.edge(instance,scope,node,5);f.adapter.measuredResult(edge,220);
 Object.assign(instance,{isIndexInRange:i=>i>=0&&i<100,_resizeBatch:null,_singleLaneMeasurements:{flat:indices.flatMap(i=>[i*200,200])},scrollState:null,scrollAdjustments:0,pendingMin:null,itemSizeCacheVersion:0,getScrollOffset:()=>0,getCommandWrittenOffset:()=>null,notify(){},_retryClampedAdjustment(){}});Object.assign(instance.options,{lanes:1,getItemKey:p.r.optionsKey,anchorTo:'none'});
 const pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),{approxEqual}=await import(new URL('../../'+pin.path,import.meta.url));
 const raw=instrument.reverse(instrument.transform('core')),ast=parseAst(raw,{},'core.mjs'),declaration=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='isSmoothScroll').declarations[0].init,smooth=Function('return('+raw.slice(declaration.start,declaration.end)+');')();
 const fn=Function('__lh','__wh','isSmoothScroll','approxEqual','return('+assignedArrow(text,'resizeItem')+');').call(instance,f.adapter,f.ingress,smooth,approxEqual);fn(5,220);f.adapter.edgeReturn(edge);f.adapter.end(instance,scope,true);return{state:f.inspect(),closed:f.ingress.close(),nodeID:scope.node.id,cache:instance.itemSizeCache.get(5)};
}
test('actual resize callback delta events use original itemSize and private admitted epoch',async()=>{
 const a=await resizeExperiment(instrument.transform('core').code),b=await resizeExperiment(instrument.transformWarm('core').code);assert.deepEqual(b.state,a.state);assert.equal(b.state.reason,null);assert.equal(b.cache,220);assert.equal(b.state.eligible,false);assert.equal(b.state.baseline,false);assert.equal(b.state.exports,0);
 const lines=b.closed.text.trim().split('\n'),size=lines.find(s=>s.split(',')[6]==='09'),delta=lines.find(s=>s.split(',')[6]==='10');assert.ok(size&&delta);assert.equal(size.split(',')[7],'5');assert.equal(Number(size.split(',')[8]),b.nodeID);assert.equal(size.split(',')[9],'406b800000000000');assert.equal(size.split(',')[10],'4069000000000000');assert.equal(delta.split(',')[9],'4034000000000000');assert.equal(delta.split(',').at(-1),'1');
});
test('pinned core RAF request and callback entries keep original scheduling and returns',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code),callbacks=[],trace=[];x.instance.targetWindow={requestAnimationFrame(fn){trace.push('request');callbacks.push(fn);return 17;}};x.instance.reconcileScroll=()=>trace.push('reconcile');
 assert.equal(x.instance.scheduleScrollReconcile(),undefined);assert.equal(x.instance.rafId,17);assert.deepEqual(trace,['request']);assert.equal(callbacks[0](),undefined);assert.equal(x.instance.rafId,null);assert.deepEqual(trace,['request','reconcile']);
 const kinds=x.f.ingress.close().text.trim().split('\n').map(s=>s.split(',')[6]);assert.ok(kinds.includes('19'));assert.ok(kinds.includes('20'));
});
test('shared private RAF admission remains counted after chronology closes',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code);assert.equal(typeof x.f.ingress.frameRequest,'function');assert.equal(typeof x.f.ingress.healthy,'function');
 x.f.ingress.close();for(let i=0;i<32;i++)assert.equal(x.f.ingress.frameRequest(x.instance),true);assert.equal(x.runtime.retained(),0);assert.equal(x.f.ingress.healthy(),true);assert.equal(x.f.ingress.frameRequest(x.instance),false);assert.equal(x.f.ingress.healthy(),false);assert.equal(x.runtime.retained(),0);
});
test('shared256 range entry quota is nonrenewable across all four token begin paths',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=f.ingress,instance=f.instance;
 const end=(fn,token)=>fn.length===2?fn(token,true):fn(instance,token,true);
 // Each operation is paired normally; finally must not refund admission.
 for(let i=0;i<64;i++){
  const d=a.depsBegin(instance);end(a.depsEnd,d);
  const c=a.calculateDepsBegin(instance);end(a.calculateDepsEnd,c);
  const r=a.rangeBegin(instance,500,0,1);a.rangeNull(instance,r);end(a.rangeEnd,r);
  a.indexBegin(instance,null,0,0,null,null,1,null);
 }
 assert.equal(a.healthy(),true);assert.equal(a.calculateDepsBegin(instance),null);assert.equal(a.healthy(),false);const closed=a.close();assert.equal(closed.complete,false);assert.equal(closed.reason,'source-fault');assert.equal(closed.records,0);
});
test('post-close range entries allocate no tokens but retain finite admission and throw health',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=f.ingress;a.close();
 for(let i=0;i<256;i++)assert.equal(a.calculateDepsBegin(f.instance),null);
 assert.equal(a.healthy(),true);assert.equal(a.depsBegin(f.instance),null);assert.equal(a.healthy(),false);assert.equal(runtime.retained(),0);
 const g=await privateIngress(createWarmRuntime());g.ingress.close();g.ingress.calculateDepsEnd(g.instance,null,false);assert.equal(g.ingress.healthy(),false);
});
test('new closed chronology text requires actual source record prefixes and absolute final newline',async()=>{
 const {encodeWarmSlot}=await import('./policy.mjs');
 for(const text of ['R\n','E\n','R|E\n','R|\n\n','R|']){
  const value=maximumWarmWrapper();value.chronology={...value.chronology,text,bytes:text.length,records:text.split('\n').length-1};
  assert.throws(()=>encodeWarmSlot('partial-01.json',value),undefined,JSON.stringify(text));
 }
});
test('closed chronology line capacity refuses before allocating native match result vectors',async()=>{
 const {encodeWarmSlot}=await import('./policy.mjs'),original=String.prototype.match;let matches=0;
 const value=maximumWarmWrapper(),text='E|\n'.repeat(465);value.chronology={...value.chronology,text,bytes:text.length,records:464};
 try{String.prototype.match=function(...args){matches++;return original.apply(this,args);};assert.throws(()=>encodeWarmSlot('partial-01.json',value));}finally{String.prototype.match=original;}
 assert.equal(matches,0);
});
test('scripted pinned memo lifecycle retains finite admission across fourteen recomputes and forty-three cache hits',async()=>{
 const pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),{memo}=await import(new URL('../../'+pin.path,import.meta.url));
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance,entries={calculate:0,range:0,deps:0,index:0};
 const cap={...f.ingress};for(const [name,key]of [['calculateDepsBegin','calculate'],['rangeBegin','range'],['depsBegin','deps'],['indexBegin','index']])cap[name]=(...args)=>{entries[key]++;return f.ingress[name](...args);};
 let offset=0;const rows=Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200}));instance.getMeasurements=()=>rows;instance.getSize=()=>500;instance.getScrollOffset=()=>offset;instance._singleLaneMeasurements=null;instance.isScrolling=false;instance.maybeNotify={updateDeps(){}};
 const c=rangeCallbacks(instrument.transformWarm('core').code,instance,cap);instance.options={lanes:1,count:100,overscan:5,rangeExtractor:c.extractor};instance.calculateRange=memo(c.calculateDeps,c.calculate,{});instance.getVirtualIndexes=memo(c.deps,c.indexes,{});
 for(let i=0;i<14;i++){offset=i*200;assert.ok(instance.getVirtualIndexes().length>0);}
 const retained=instance.getVirtualIndexes();for(let i=0;i<42;i++)assert.equal(instance.getVirtualIndexes(),retained);
 assert.deepEqual(entries,{calculate:57,range:14,deps:57,index:14});assert.equal(Object.values(entries).reduce((a,b)=>a+b,0),142);assert.equal(f.ingress.healthy(),true);
 const closed=f.ingress.close();assert.equal(closed.complete,true);assert.equal(closed.records,14);
 // This is a finite source-script, not a replay of the historical 43 writes.
});
test('close refuses four in-flight tokens but permits completed historical range pairing',async()=>{
 for(const name of ['calculateDepsBegin','rangeBegin','depsBegin','indexBegin']){
  const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=f.ingress,instance=f.instance;
  if(name==='indexBegin'){
   const value={startIndex:0,endIndex:2},r=a.rangeBegin(instance,500,0,1);a.rangeCalculated(instance,r,value);a.rangeEnd(instance,r,true);const d=a.depsBegin(instance);a.rangeDeps(instance,d,value,0,2);a.depsEnd(instance,d,true);const extractor=()=>[];assert.ok(a.indexBegin(instance,extractor,5,100,0,2,1,extractor));
  }else assert.ok(name==='rangeBegin'?a[name](instance,500,0,1):a[name](instance));
  assert.equal(a.close().complete,false,name);assert.equal(a.healthy(),false,name);
 }
 const f=await privateIngress(createWarmRuntime()),a=f.ingress,v={startIndex:0,endIndex:2},r=a.rangeBegin(f.instance,500,0,1);a.rangeCalculated(f.instance,r,v);a.rangeEnd(f.instance,r,true);const d=a.depsBegin(f.instance);a.rangeDeps(f.instance,d,v,0,2);a.depsEnd(f.instance,d,true);assert.equal(a.close().complete,true);assert.equal(a.healthy(),true);
 for(const end of ['calculateDepsEnd','rangeEnd','depsEnd','indexEnd']){const f=await privateIngress(createWarmRuntime());f.ingress.close();f.ingress[end](f.instance,null,false);assert.equal(f.ingress.healthy(),false,end);}
});
test('source flat capability captures the original argument once without another property read',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),instance=f.instance,flat=new Float64Array(200),trace=[],seen=[];
 for(let i=0;i<100;i++){flat[2*i]=i*200;flat[2*i+1]=200;}
 const single={get flat(){trace.push('flat');return flat;}};Object.defineProperty(instance,'_singleLaneMeasurements',{get(){trace.push('single');return single;}});
 const cap={...f.ingress,rangeInput(i,token,value){seen.push(value);return value;}};const c=rangeCallbacks(instrument.transformWarm('core').code,instance,cap);
 assert.ok(c.calculate(Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200})),500,1000,1));assert.deepEqual(trace,['single','single','flat']);assert.deepEqual(seen,[flat]);
});
test('private source factories and original kernel identities are immutable capabilities',async()=>{
 const source=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8'),extra=`\nexport function factoryFacts(r,a,b){const x=createWarmSourceIngress(r,a,b);return {x,same:()=>createWarmSourceIngress(r,a,b),other:()=>createWarmSourceIngress(r,()=>{},b)};}\n//factory${++fixtureSerial}`;
 const r=createWarmRuntime(),a=()=>{},b=()=>{},f=(await import('data:text/javascript;base64,'+Buffer.from(source+extra).toString('base64'))).factoryFacts(r,a,b);
 assert.equal(typeof f.x.kernel,'function');assert.equal(f.same(),f.x);assert.throws(f.other,/warm-source-identity/);
 const calculate=()=>{},extractor=()=>{};assert.equal(f.x.kernel(calculate,extractor),true);assert.equal(f.x.kernel(calculate,extractor),true);assert.equal(f.x.kernel(()=>{},extractor),false);assert.equal(f.x.healthy(),false);
});
test('a commit inside an admitted range entry refuses capture but original commit still executes',async()=>{
 const r=createWarmRuntime(),f=await privateIngress(r),a=f.ingress,token=a.calculateDepsBegin(f.instance),before=f.state();assert.ok(token);
 const c=a.adapter.commitStart(f.root,f.host);assert.ok(c);assert.equal(c.root,f.root);assert.equal(c.work,f.host);assert.equal(c.previousCommit,null);assert.equal(f.state().work,before.work+262144);assert.equal(f.state().reason,null);assert.equal(a.healthy(),false);a.calculateDepsEnd(f.instance,token,true);assert.equal(a.close().complete,false);
});
test('warm-only transform supplies reviewed factories and original core kernel without default imports',()=>{
 const old=instrument.transform('core'),now=instrument.transformWarm('core');assert.ok(!old.code.includes('warm-baseline.mjs'));assert.ok(!old.code.includes('warm-selector.mjs'));
 assert.match(now.code,/createWarmBaseline/);assert.match(now.code,/createWarmSelector/);assert.match(now.code,/__wh\.kernel\(calculateRangeImpl,defaultRangeExtractor\)/);assert.equal(instrument.reverseWarm(now),instrument.reverse(old));
});
async function preparationFixture(configure=(i,a)=>{i.getVirtualIndexes=a.capture(i,()=>[],1);i.scrollToIndex=a.capture(i,()=>{},2);}){
 let initialCallbacks;const configureOwned=(i,a)=>{initialCallbacks=configure(i,a);};
 const life=fs.readFileSync(new URL('lifecycle.node.mjs',import.meta.url),'utf8'),tree=parseAst(life,{},'lifecycle');
 const string=name=>{const n=tree.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name===name).declarations[0].init;return Function('return('+life.slice(n.start,n.end)+');')();};
 const boundary=string('BOUNDARY_FIXTURE').replace('export function boundaryFacts(opts={}){','export function boundaryFacts(opts={}){const adapter=__fixtureIngress.adapter;')
  .replace('adapter.renderEnd(r,true);','for(let i=0;i<100;i++)adapter.key(rows[i],messages[i].id);adapter.renderEnd(r,true);')
  .replace('if(map)adapter.mapping(r);adapter.fiberEnd(f,true);','if(map)adapter.mapping(r);change.onLayout?.();adapter.fiberEnd(f,true);')
  .replace('adapter.options(ow,','if(!__fixtureConfigured){__fixtureConfigure(ow,__fixtureIngress);__fixtureConfigured=true;}adapter.options(ow,');
 const reactPin=instrument.registry.find(p=>p.path.endsWith('react-dom-client.production.js')),reactRaw=instrument.boundedRead(instrument.sourceRoot+'/'+reactPin.path,reactPin.bytes).toString();assert.equal(instrument.sha(reactRaw),reactPin.sha256);
 const declaration=name=>{const a=reactRaw.indexOf('function '+name+'('),b=reactRaw.indexOf('\nfunction ',a+10);assert.ok(a>=0&&b>a);return reactRaw.slice(a,b);};
 const react=Function(declaration('FiberNode')+declaration('createFiberImplClass')+declaration('createWorkInProgress')+declaration('bubbleProperties')+';return{FiberNode,createWorkInProgress,bubbleProperties};')();
 const source=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8');let establish;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.name==='establish')establish=source.slice(n.init.start,n.init.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}walk(parseAst(source,{},'adapter'));assert.ok(establish);
 const extra=`\nlet __fixtureIngress,__fixtureConfigure,__fixtureConfigured=false;\n${boundary}\n${string('CONTINUITY_FIXTURE')}\nexport function preparationFacts(runtime,baselineFactory,selectorFactory,react,configure){__fixtureConfigure=configure;__fixtureIngress=createWarmSourceIngress(runtime,baselineFactory,selectorFactory);const x=continuityFacts(react),f=x.f;let observed=0,style;const fontReady=true,document={fonts:{status:'loaded'}},getComputedStyle=()=>({fontFamily:'fixed',fontSize:'12px',display:'block'}),observer={observe(){observed++;}};continuityNative.nodeConnected=function(){const d=Object.getOwnPropertyDescriptor(this,'isConnected');if(!d||typeof d.value!=='boolean')throw TypeError('fixture DOM brand');return d.value;};const establish=${establish};establish(f.instance,f.scroll);return{x,f,ingress:__fixtureIngress,observed};}\n//preparation${++fixtureSerial}`;
 const {createWarmBaseline}=await import('./warm-baseline.mjs'),{createWarmSelector}=await import('./warm-selector.mjs'),runtime=createWarmRuntime(),f=(await import('data:text/javascript;base64,'+Buffer.from(source+extra).toString('base64'))).preparationFacts(runtime,createWarmBaseline,createWarmSelector,react,configureOwned);
 const instance=f.f.instance,flat=new Float64Array(200);for(let i=0;i<100;i++){flat[2*i]=i*200;flat[2*i+1]=200;}
 instance._singleLaneMeasurements={flat};instance.isScrolling=false;instance.maybeNotify={updateDeps(){}};
 const c=initialCallbacks??rangeCallbacks(instrument.transformWarm('core').code,instance,f.ingress);f.ingress.kernel(c.kernel,c.extractor);instance.options.overscan=5;instance.options.rangeExtractor=c.extractor;let range=c.calculate(Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200})),500,19500,1);instance.calculateRange??=()=>range;c.indexes(...c.deps());
 return{...f,runtime,flat,react,sourceCallbacks:c};
}
test('private preparation consumes established baseline and original range capability without old publication credit',async()=>{
 const f=await preparationFixture();assert.equal(f.observed,1);const before=f.x.snapshot();assert.equal(before.reason,null);assert.equal(before.eligible,true);assert.ok(before.baselineOwner);assert.equal(f.ingress.close().complete,true);
 assert.equal(typeof f.ingress.prepare,'function');const plan=f.ingress.prepare();assert.equal(plan.status,'prepared-structural-only');assert.equal(plan.reason,null);assert.ok(Object.values(plan).every(v=>!Array.isArray(v)));assert.deepEqual(f.x.snapshot(),before);
});
for(const variant of ['before-close','stale-flat','cache-replaced','payload-content','row-reference','keymap','options-accessor'])test('private preparation refuses '+variant+' without credit or application accessor calls',async()=>{
 const f=await preparationFixture();let calls=0;
 if(variant==='stale-flat')f.f.instance.itemSizeCache.set(0,201);
 if(variant==='cache-replaced')f.f.instance.itemSizeCache=new Map();
 if(variant==='payload-content')f.f.messages[0].content='changed';
 if(variant==='row-reference')f.f.rows[0].message={...f.f.messages[0]};
 if(variant==='keymap')f.f.keys.set('history-0','wrong');
 if(variant==='options-accessor')Object.defineProperty(f.f.instance.options,'count',{get(){calls++;throw Error('application getter');}});
 const before=f.x.snapshot();if(variant!=='before-close')f.ingress.close();const plan=f.ingress.prepare();assert.equal(plan.status,'unavailable');assert.equal(plan.reason,'invalid-input');assert.equal(plan.targets,'');assert.equal(f.ingress.healthy(),false);assert.deepEqual(f.x.snapshot(),before);assert.equal(calls,0);
});
test('private preparation has one attempt and releases route input arrays from the output',async()=>{
 const f=await preparationFixture();f.ingress.close();const first=f.ingress.prepare();assert.equal(first.status,'prepared-structural-only');assert.equal(Object.keys(first).length,10);assert.ok(Object.isFrozen(first));assert.ok(Object.values(first).every(v=>!v||typeof v!=='object'));const second=f.ingress.prepare();assert.equal(second.status,'unavailable');assert.equal(second.reason,'invalid-input');assert.equal(f.ingress.healthy(),false);
});
test('private fences consume original partial tickets and report both incomplete populations separately',async()=>{
 const f=await preparationFixture();f.ingress.close();f.ingress.prepare();const partial=f.ingress.adapter.partial(),before=f.x.snapshot();assert.equal(typeof f.ingress.fence,'function');
 const first=f.ingress.fence(partial);assert.deepEqual(first,{historicalComplete:false,liveSubsetValid:false,fullWarmReady:false,connectedRows:0,reason:'historical-gap',nativeGO:false,qualified:false,fps:null});assert.deepEqual(f.x.snapshot(),before);
 const second=f.ingress.fence(f.ingress.adapter.partial());assert.deepEqual(second,first);assert.equal(f.ingress.healthy(),true);
});
test('private fence refuses unowned tickets without inspecting their properties',async()=>{
 const f=await preparationFixture();f.ingress.close();f.ingress.prepare();let reads=0;const other=new Proxy({},{get(){reads++;throw Error('unowned');},getOwnPropertyDescriptor(){reads++;throw Error('unowned');}});
 const result=f.ingress.fence(other);assert.equal(result.fullWarmReady,false);assert.equal(result.reason,'source-shape');assert.equal(reads,0);assert.equal(f.ingress.healthy(),false);
});
test('private partial preserves the existing fault-contained refusal and clears the fence ticket',async()=>{
 const f=await preparationFixture();f.ingress.close();f.ingress.prepare();const sentinel={originalPartial:true};let calls=0;
 Object.defineProperty(f.f.instance,'itemSizeCache',{get(){calls++;throw sentinel;}});
 // The unchanged adapter.partial boundary translates the application getter
 // sentinel into its existing string refusal; the new wrapper preserves it.
 assert.throws(()=>f.ingress.adapter.partial(),e=>e==='live-history-export-refused');assert.equal(calls,1);assert.equal(f.ingress.healthy(),false);assert.equal(f.ingress.fence(null).fullWarmReady,false);
});
test('private fence consumes each exact partial identity once and never renews its two-call budget',async()=>{
 const f=await preparationFixture();f.ingress.close();f.ingress.prepare();const first=f.ingress.adapter.partial();assert.equal(f.ingress.fence(first).reason,'historical-gap');
 assert.equal(f.ingress.fence(first).reason,'source-shape');assert.equal(f.ingress.healthy(),false);
 const g=await preparationFixture();g.ingress.close();g.ingress.prepare();for(let i=0;i<2;i++)assert.equal(g.ingress.fence(g.ingress.adapter.partial()).reason,'historical-gap');
 assert.equal(g.ingress.fence(g.ingress.adapter.partial()).fullWarmReady,false);assert.equal(g.ingress.healthy(),false);
});
test('a pending original partial ticket refuses an intervening commit without suppressing original admission',async()=>{
 const f=await preparationFixture();f.ingress.close();f.ingress.prepare();const partial=f.ingress.adapter.partial(),before=f.x.snapshot(),c=f.ingress.adapter.commitStart(f.f.root,f.p?.work??f.x.p.work);
 assert.ok(c);assert.equal(f.x.snapshot().counts.commits,before.counts.commits+1);assert.equal(f.x.snapshot().counts.work,before.counts.work+262144);assert.equal(f.ingress.healthy(),false);assert.equal(f.ingress.fence(partial).fullWarmReady,false);
});
test('private fence rejects post-partial canonical mutation and disposal with no publication credit',async()=>{
 for(const variant of ['content','dispose']){const f=await preparationFixture();f.ingress.close();f.ingress.prepare();const partial=f.ingress.adapter.partial();if(variant==='content')f.f.messages[0].content='changed';else f.ingress.adapter.dispose();const before=f.x.snapshot();assert.equal(f.ingress.fence(partial).fullWarmReady,false);assert.deepEqual(f.x.snapshot(),before);}
});
async function measuredFenceFixture(){
 const f=await preparationFixture(),a=f.ingress.adapter,instance=f.f.instance,core=instrument.transformWarm('core').code;
 f.ingress.close();assert.equal(f.ingress.prepare().status,'prepared-structural-only');
 const nodes=[],trace=[];
 const pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),{approxEqual}=await import(new URL('../../'+pin.path,import.meta.url));
 const raw=instrument.reverse(instrument.transform('core')),ast=parseAst(raw,{},'core'),decl=ast.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='isSmoothScroll').declarations[0].init,isSmoothScroll=Function('return('+raw.slice(decl.start,decl.end)+');')();
 const measuredRef={current:{total:0,sizes:new Map()}},measure=Function('measuredRef','__wh','return('+variable(instrument.transformWarm('copilot').code,'measureRowElement')+');')(measuredRef,f.ingress);
 Object.assign(instance,{isIndexInRange:i=>i>=0&&i<100,_resizeBatch:null,scrollState:null,scrollAdjustments:0,pendingMin:null,itemSizeCacheVersion:0,getScrollOffset:()=>0,getCommandWrittenOffset:()=>null,notify(){trace.push('notify');},_retryClampedAdjustment(){},indexFromElement:n=>Number(n.dataset.index),observer:{observe(){},unobserve(){}},shouldMeasureDuringScroll:()=>true});
 Object.assign(instance.options,{anchorTo:'none',measureElement:measure});
 instance.resizeItem=Function('__lh','__wh','isSmoothScroll','approxEqual','return('+assignedArrow(core,'resizeItem')+');').call(instance,a,f.ingress,isSmoothScroll,approxEqual);
 instance.measureElement=Function('__lh','__wh','return('+assignedArrow(core,'measureElement')+');').call(instance,a,f.ingress);
 let entry;function entryNode(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id.name==='measureEntry')entry=core.slice(n.init.start,n.init.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(entryNode);else if(v&&typeof v==='object')entryNode(v);}entryNode(parseAst(core,{},'core'));assert.ok(entry);
 const measureEntry=Function('__lh','__wh','return('+entry+');').call(instance,a,f.ingress);
 function mount(indexes,size=220){
  const old=f.f.root.current,host=f.react.createWorkInProgress(old,null),target=f.react.createWorkInProgress(old.child,null);host.child=target;target.return=host;
  const p=f.f.prepare(100,false,{rootWork:host,work:target,currentRoot:old,onLayout(){
   for(const i of indexes){
    const node={dataset:{index:String(i)},isConnected:true,height:size,getBoundingClientRect(){return{height:this.height};}};nodes.push(node);
    if(nodes.length>8){const previous=nodes[nodes.length-9];previous.isConnected=false;instance.elementsCache.delete(Number(previous.dataset.index));}
    instance.measureElement(node);
   }
  }});
  f.f.root.current=host;f.react.bubbleProperties(host);a.commitSpawnedEnd(f.f.root,host,true);return p;
 }
 const p=mount(indices);return{...f,nodes,trace,p,mount,resize(node,size){node.height=size;const batch=a.begin(instance,3);assert.ok(batch);measureEntry({target:node});a.end(instance,batch,true);}};
}
test('generated source ref callbacks mint authentic100 origins with only8 connected latest bindings',async()=>{
 const f=await measuredFenceFixture(),before=f.x.snapshot();assert.equal(before.reason,null);assert.equal(before.counts.writes,100);assert.equal(before.counts.nodes,100);assert.equal(f.trace.length,100);assert.equal(f.nodes.filter(n=>n.isConnected).length,8);
 const firstPartial=f.ingress.adapter.partial();assert.equal(firstPartial.rows.filter(r=>r[15]).length,100);const first=f.ingress.fence(firstPartial);assert.deepEqual(first,{historicalComplete:true,liveSubsetValid:true,fullWarmReady:false,connectedRows:8,reason:'first-fence',nativeGO:false,qualified:false,fps:null});
 const partial=f.ingress.adapter.partial(),state=f.x.snapshot(),second=f.ingress.fence(partial);assert.deepEqual(second,{historicalComplete:true,liveSubsetValid:true,fullWarmReady:true,connectedRows:8,reason:null,nativeGO:false,qualified:false,fps:null});assert.deepEqual(f.x.snapshot(),state);
 // SOURCE_SYNTHETIC_GATE_ONLY: original callbacks and observer seams, not an
 // actual browser itinerary, V9 chronology, runtime profile or qualification.
});
test('original zero-delta remount cannot renew an origin or pass the live fence',async()=>{
 const f=await measuredFenceFixture();assert.equal(f.ingress.fence(f.ingress.adapter.partial()).reason,'first-fence');const before=f.x.snapshot();f.mount(indices.slice(92));const after=f.x.snapshot();assert.equal(after.reason,null);assert.equal(after.counts.writes,before.counts.writes);assert.equal(after.counts.nodes,before.counts.nodes+8);assert.deepEqual(after.origins,before.origins);
 const partial=f.ingress.adapter.partial(),state=f.x.snapshot(),result=f.ingress.fence(partial);assert.equal(result.historicalComplete,true);assert.equal(result.liveSubsetValid,false);assert.equal(result.fullWarmReady,false);assert.equal(result.reason,'live-binding-gap');assert.equal(result.connectedRows,8);assert.deepEqual(f.x.snapshot(),state);
});
test('a genuine later RO write stays individually valid but cannot preserve the first fence tuple',async()=>{
 const f=await measuredFenceFixture();assert.equal(f.ingress.fence(f.ingress.adapter.partial()).reason,'first-fence');const before=f.x.snapshot();f.resize(f.nodes.at(-1),221);const after=f.x.snapshot();assert.equal(after.reason,null);assert.equal(after.counts.writes,before.counts.writes+1);assert.equal(after.origins[99].node,before.origins[99].node);assert.notEqual(after.origins[99].seq,before.origins[99].seq);
 const partial=f.ingress.adapter.partial(),state=f.x.snapshot(),result=f.ingress.fence(partial);assert.equal(result.historicalComplete,true);assert.equal(result.liveSubsetValid,true);assert.equal(result.fullWarmReady,false);assert.equal(result.reason,'fence-drift');assert.deepEqual(f.x.snapshot(),state);
});
test('fence tuple packing is reversible at every private integer boundary',()=>{
 for(const [a,b,base]of [[1,1,32769],[32768,32768,32769],[1,1,6401],[32768,6400,6401]]){const packed=a*base+b;assert.equal(Number.isSafeInteger(packed),true);assert.equal(Math.floor(packed/base),a);assert.equal(packed%base,b);}
});
test('private synchronous partialFence preserves the original output and consumes its ticket in the same stack',async()=>{
 const f=await measuredFenceFixture();assert.equal(typeof f.ingress.partialFence,'function');const before=f.x.snapshot(),first=f.ingress.partialFence();assert.deepEqual(Object.keys(first),['partial','fence']);assert.equal(first.partial.kind,'live-history-C-partial-v1');assert.equal(first.fence.reason,'first-fence');const after=f.x.snapshot();assert.equal(after.counts.exports,before.counts.exports+1);assert.equal(after.counts.censuses,before.counts.censuses+1);assert.equal(after.counts.work,before.counts.work+270336);assert.equal(f.ingress.fence(first.partial).fullWarmReady,false,'the returned output is no longer an accepted pending ticket');
});
test('two synchronous original partialFence calls preserve both fences and original throw containment',async()=>{
 const f=await measuredFenceFixture();assert.equal(f.ingress.partialFence().fence.reason,'first-fence');assert.equal(f.ingress.partialFence().fence.fullWarmReady,true);assert.equal(f.ingress.healthy(),true);
 const g=await preparationFixture();g.ingress.close();g.ingress.prepare();let reads=0;Object.defineProperty(g.f.instance,'itemSizeCache',{get(){reads++;throw 'original-cache-getter';}});assert.throws(()=>g.ingress.partialFence(),e=>e==='live-history-export-refused');assert.equal(reads,1);assert.equal(g.ingress.healthy(),false);assert.equal(g.ingress.fence(null).fullWarmReady,false);
});
test('formatter allocation shape uses fixed parts and unrolled header before source adoption',()=>{
 const source=fs.readFileSync(new URL('warm-runtime.mjs',import.meta.url),'utf8'),tree=parseAst(source,{},'runtime'),functions={};function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')functions[n.id.name]=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}walk(tree);
 for(const name of ['formatRange','formatEvent']){const value=functions[name].body.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='text').declarations[0].init;assert.equal(value.type,'CallExpression');assert.equal(value.callee.object.type,'ArrayExpression');assert.equal(value.callee.property.name,'join');}
 assert.equal(functions.header.body.body.some(n=>n.type==='ForStatement'),false);
});
async function classifierFixture(){
 const raw=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8');
 const source=raw.replace('export const adapter=','const __baseAdapter=').replace('// WARM_SOURCE_CAPABILITY_BEGIN',`let calls=0,throwNext=false;const returned={delegate:true},sentinel={originalFiber:true};const adapter=Object.freeze({...__baseAdapter,fiberStart(){calls++;if(throwNext)throw sentinel;return returned;}});\n// WARM_SOURCE_CAPABILITY_BEGIN`);
 const extra=`\nexport function classifierFacts(r){return{a:createWarmSourceIngress(r),returned,sentinel,calls:()=>calls,throwOriginal(){throwNext=true;},old:()=>({reason,originalFailed,work:counts.work})};}\n//classifier${++fixtureSerial}`;
 const runtime=createWarmRuntime(),f=(await import('data:text/javascript;base64,'+Buffer.from(source+extra).toString('base64'))).classifierFacts(runtime);return{...f,runtime};
}
test('warm lifetime classifier admits30880 entries across close then refuses before another delegated classification',async()=>{
 const f=await classifierFixture(),before=f.old();for(let i=0;i<15440;i++)assert.equal(f.a.adapter.fiberStart(null,null,null),f.returned);assert.equal(f.a.close().complete,true);for(let i=0;i<15440;i++)assert.equal(f.a.adapter.fiberStart(null,null,null),f.returned);assert.equal(f.a.healthy(),true);assert.equal(f.calls(),30880);
 assert.equal(f.a.adapter.fiberStart(null,null,null),f.returned);assert.equal(f.calls(),30881);assert.equal(f.a.healthy(),false);assert.deepEqual(f.old(),before);
 f.throwOriginal();assert.throws(()=>f.a.adapter.fiberStart(null,null,null),e=>e===f.sentinel);assert.equal(f.calls(),30882);assert.deepEqual(f.old(),before);
 // The spy isolates lifetime gate behavior; it is not a fabricated64-commit C run.
});
test('postclose core quota shares512 entries across notify options scroll and estimate without renewing448 active records',async()=>{
 const runtime=createWarmRuntime(),f=await privateIngress(runtime),a=f.ingress;
 // Private owned-capability boundary control, not an original application chronology.
 for(let i=0;i<448;i++)a.coreEvent(f.instance,14,0,0);
 const captured=a.close();assert.equal(captured.complete,true);assert.equal(captured.records,448);const retained=JSON.stringify(captured),before=f.state();
 for(let i=0;i<600;i++)a.coreEvent({},14,0,0);
 for(let i=0;i<512;i++){
  if(i%4===0)a.coreEvent(f.instance,14,0,0);
  else if(i%4===1)a.coreEvent(f.instance,15,0,100);
  else if(i%4===2)assert.equal(a.scrollValue(f.instance,123),123);
  else a.estimate(100,1);
 }
 assert.equal(a.healthy(),true);assert.equal(runtime.retained(),0);assert.equal(JSON.stringify(captured),retained);assert.deepEqual(f.state(),before);
 a.close();a.coreEvent(f.instance,14,0,0);assert.equal(a.healthy(),false);assert.equal(runtime.retained(),0);assert.equal(JSON.stringify(captured),retained);assert.deepEqual(f.state(),before);
});
test('postclose core admission is not refunded by successful private preparation',async()=>{
 const f=await preparationFixture(),a=f.ingress;a.close();for(let i=0;i<256;i++)a.coreEvent(f.f.instance,14,0,0);
 assert.equal(a.prepare().status,'prepared-structural-only');for(let i=0;i<256;i++)a.estimate(0,0);assert.equal(a.healthy(),true);
 const before=f.x.snapshot();a.coreEvent(f.f.instance,15,0,100);assert.equal(a.healthy(),false);assert.deepEqual(f.x.snapshot(),before);
});
test('postclose core admission survives both actual private fences without renewing its counter',async()=>{
 const f=await measuredFenceFixture(),a=f.ingress;for(let i=0;i<256;i++)a.coreEvent(f.f.instance,14,0,0);assert.equal(a.partialFence().fence.reason,'first-fence');
 for(let i=0;i<256;i++)a.estimate(0,0);assert.equal(a.partialFence().fence.fullWarmReady,true);assert.equal(a.healthy(),true);
 const before=f.x.snapshot();a.coreEvent(f.f.instance,14,0,0);assert.equal(a.healthy(),false);assert.deepEqual(f.x.snapshot(),before);
});
test('postclose entry513 preserves original notify throw and original estimate getter coercion order',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code),a=x.f.ingress;a.close();for(let i=0;i<512;i++)a.estimate(0,0);
 const sentinel={originalNotify:true};let calls=0;x.instance.options.onChange=()=>{calls++;throw sentinel;};const before=x.f.state();
 assert.throws(()=>x.instance.notify(false),e=>e===sentinel);assert.equal(calls,1);assert.equal(a.healthy(),false);assert.deepEqual(x.f.state(),before);
 const r=createWarmRuntime(),f=await privateIngress(r);f.ingress.close();for(let i=0;i<512;i++)f.ingress.coreEvent(f.instance,14,0,0);
 const held=estimateExperiment(instrument.transform('copilot').code,null,{throwAt:'second-size'}),now=estimateExperiment(instrument.transformWarm('copilot').code,f.ingress,{throwAt:'second-size'});
 assert.deepEqual(now.trace,held.trace);assert.equal(held.thrown,held.sentinel);assert.equal(now.thrown,now.sentinel);assert.equal(f.ingress.healthy(),false);
});

async function freshMemoFixture(scroll=()=>{}){
 const code=instrument.transformWarm('core').code,pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),{memo}=await import(new URL('../../'+pin.path,import.meta.url)),trace=[],sentinel={freshMemoOriginal:true};let viewport=500,offset=19500,throwAt=null;
 const rows=Array.from({length:100},(_,i)=>({start:i*200,end:(i+1)*200}));
 const mark=n=>{trace.push(n);if(throwAt===n)throw sentinel;};
 const f=await preparationFixture((instance,ingress)=>{
  instance.getMeasurements=()=>{mark('measurements');return rows;};instance.getSize=()=>{mark('size');return viewport;};instance.getScrollOffset=()=>{mark('offset');return offset;};
  const c=rangeCallbacks(code,instance,ingress);ingress.kernel(c.kernel,c.extractor);
  const evaluate=name=>Function('memo','__wh','defaultRangeExtractor','calculateRangeImpl','return('+assignedArrow(code,name)+');').call(instance,memo,ingress,c.extractor,c.kernel);
  instance.calculateRange=evaluate('calculateRange');instance.getVirtualIndexes=evaluate('getVirtualIndexes');instance.scrollToIndex=ingress.capture(instance,scroll,2);return c;
 });
 const instance=f.f.instance;return{...f,instance,trace,sentinel,change(v,o=offset){viewport=v;offset=o;},throwOn(n){throwAt=n;}};
}
test('E1 real pinned memo cached dependencies authenticate one atomic close and preparation',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();f.instance.getVirtualIndexes();const before=f.x.snapshot();assert.equal(typeof f.ingress.sealPreparation,'function','E1 owned atomic source capability missing');
 f.trace.length=0;const result=f.ingress.sealPreparation();assert.deepEqual(f.trace,['measurements','size','offset']);assert.equal(result.chronology.complete,true);assert.equal(result.plan.status,'prepared-structural-only');assert.deepEqual(f.x.snapshot(),before);
 const prior=f.trace.length;const replay=f.ingress.sealPreparation();assert.equal(replay.plan.status,'unavailable');assert.equal(f.trace.length,prior);assert.equal(f.ingress.healthy(),false);
});
test('E1 source probe uses newly evaluated viewport instead of last captured geometry',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();f.change(600,19000);assert.equal(typeof f.ingress.sealPreparation,'function','stale geometry currently has no fresh source gate');
 f.trace.length=0;const result=f.ingress.sealPreparation();assert.deepEqual(f.trace,['measurements','size','offset']);assert.equal(result.chronology.complete,true);const records=result.chronology.text.trim().split('\n').filter(s=>s.startsWith('R|'));assert.ok(records.at(-1).includes('4082c00000000000'),'last original range must describe600 viewport');assert.equal(result.plan.status,'prepared-structural-only');
});
test('E1 source probe preserves original dependency throw identity without closing or preparing',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();f.throwOn('size');assert.equal(typeof f.ingress.sealPreparation,'function','fresh source boundary missing');let thrown;try{f.ingress.sealPreparation();}catch(e){thrown=e;}assert.equal(thrown,f.sentinel);assert.equal(f.ingress.healthy(),false);assert.equal(f.runtime.active(),false);assert.equal(f.ingress.prepare().status,'unavailable');
});
test('E1 cache-hit extractor need not emit a fabricated range record after current source geometry changes',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();const retained=f.runtime.retained();f.change(600,19400);const result=f.ingress.sealPreparation();assert.equal(result.chronology.records,retained);assert.equal(result.chronology.complete,true);assert.equal(result.plan.status,'prepared-structural-only');assert.equal(f.ingress.healthy(),true);
});
test('E1 missing captured callable and a second constructor candidate refuse without invoking application getters',async()=>{
 const f=await preparationFixture();let calls=0;const fn=()=>{calls++;},first={},second={};assert.equal(f.ingress.capture(first,fn,1),fn);assert.equal(f.ingress.capture(second,fn,1),fn);const result=f.ingress.sealPreparation();assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(calls,0);assert.equal(f.ingress.healthy(),false);
});
test('E1 every original probe dependency exception including warm-seal text is rethrown by exact identity',async()=>{
 for(const value of [{original:true},'warm-seal-stale',null,undefined]){
  const f=await freshMemoFixture();f.instance.getVirtualIndexes();f.instance.getSize=()=>{throw value;};let returned=false,thrown=false,error;try{f.ingress.sealPreparation();returned=true;}catch(e){thrown=true;error=e;}assert.equal(returned,false);assert.equal(thrown,true);assert.equal(error,value);assert.equal(f.ingress.healthy(),false);assert.equal(f.ingress.prepare().status,'unavailable');
 }
});
test('E1 nested render and core notification invalidate before publication while original delegates still run',async()=>{
 for(const event of ['render','notify']){
  const f=await freshMemoFixture();f.instance.getVirtualIndexes();const before=f.x.snapshot();let calls=0;
  f.instance.getSize=()=>{calls++;if(event==='render')f.ingress.adapter.renderStart({},function Other(){},f.f.root,f.f.root.current);else f.ingress.coreEvent(f.instance,14,0,0);return 500;};
  const result=f.ingress.sealPreparation();assert.equal(calls,1);assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);assert.equal(f.x.snapshot().sealed,before.sealed);assert.equal(f.x.snapshot().carry,before.carry);
 }
});
test('E1 constructor capture preserves assignment reference RHS setter order and original memo identity',()=>{
 const old=instrument.transform('core').code,now=instrument.transformWarm('core').code;
 for(const code of [old,now]){
  const trace=[],instance={},fn=()=>1;Object.defineProperty(instance,'getVirtualIndexes',{set(value){trace.push(['set',value]);}});
  const original=assignedArrow(code,'getVirtualIndexes');const __wh={capture(i,v,kind){assert.equal(kind,1);trace.push(['capture',i,v]);return v;}};
  Function('memo','__wh','this.getVirtualIndexes='+original+';').call(instance,()=>{trace.push(['memo']);return fn;},__wh);
  assert.equal(trace[0][0],'memo');assert.equal(trace.at(-1)[0],'set');assert.equal(trace.at(-1)[1],fn);assert.equal(trace.filter(x=>x[0]==='memo').length,1);if(code===now){assert.equal(trace[1][0],'capture');assert.equal(trace[1][1],instance);assert.equal(trace[1][2],fn);}
 }
 assert.equal(instrument.reverseWarm(instrument.transformWarm('core')),instrument.reverse(instrument.transform('core')));
});
async function e1ProbeTrace(seal,throwAt){
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();const trace=[],error={probeTrace:true};let reads=0;const mark=n=>{trace.push(n);if(++reads===throwAt)throw error;};
 for(const key of ['getMeasurements','getSize','getScrollOffset']){const fn=f.instance[key];Object.defineProperty(f.instance,key,{get(){mark(key+'-get');return function(){mark(key+'-call');return fn();};}});}
 // Options remain owned data required by the pre-call admission. Accessor options
 // are separately proved refused without invoking the original memo or getter.
 const notify=f.instance.maybeNotify.updateDeps;f.instance.maybeNotify.updateDeps=function(v){mark('updateDeps');return notify(v);};
 let result,thrown,didThrow=false;try{result=seal?f.ingress.sealPreparation():f.instance.getVirtualIndexes();}catch(e){didThrow=true;thrown=e;}
 return{f,trace,reads,error,result,thrown,didThrow};
}
test('E1 extra original memo invocation preserves every original getter/callee trace and thrown identity',async()=>{
 const normal=await e1ProbeTrace(false);
 for(const point of [undefined,...Array.from({length:normal.reads},(_,i)=>i+1)]){
  const a=await e1ProbeTrace(false,point),b=await e1ProbeTrace(true,point);assert.deepEqual(b.trace,a.trace);assert.equal(b.didThrow,a.didThrow);if(a.didThrow){assert.equal(a.thrown,a.error);assert.equal(b.thrown,b.error);assert.equal(b.f.ingress.healthy(),false);}
 }
});
test('E1 replaced or accessor-backed installed memo cannot borrow its historical captured function',async()=>{
 for(const mode of ['replace','accessor']){
  const f=await freshMemoFixture();f.instance.getVirtualIndexes();let calls=0;if(mode==='replace')f.instance.getVirtualIndexes=()=>{calls++;};else Object.defineProperty(f.instance,'getVirtualIndexes',{get(){calls++;throw Error('must not invoke accessor');}});
  const result=f.ingress.sealPreparation();assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(calls,0);assert.equal(f.ingress.healthy(),false);
 }
});
test('E1 absence of a constructor memo capability refuses without source invocation',async()=>{
 const f=await preparationFixture(),before=f.x.snapshot();const result=f.ingress.sealPreparation();assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);assert.deepEqual(f.x.snapshot(),before);
});
test('E1 an estimator entry during the fresh probe refuses even when original dependency returns normally',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();let entries=0;f.instance.getSize=()=>{entries++;f.ingress.estimate(100,1);return 500;};const result=f.ingress.sealPreparation();assert.equal(entries,1);assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);
});
test('E1 nested original partial invalidates before its once-only delegate and cannot leave a usable ticket',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();const before=f.x.snapshot();let entries=0,partial;f.instance.getSize=()=>{entries++;partial=f.ingress.adapter.partial();return 500;};const result=f.ingress.sealPreparation();assert.equal(entries,1);assert.equal(f.x.snapshot().counts.exports,before.counts.exports+1);assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);assert.equal(f.ingress.fence(partial).fullWarmReady,false);
});
async function originalMeasurementProbe(cached){
 const f=await freshMemoFixture(),instance=f.instance,code=instrument.transformWarm('core').code,pin=instrument.registry.find(p=>p.path.endsWith('/utils.js')),{memo}=await import(new URL('../../'+pin.path,import.meta.url)),{createLazyMeasurementsView}=await import(new URL('../../node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js',import.meta.url));
 // A source algorithm fixture, not authentic origins: cached=true supplies
 // bounded synthetic cached sizes only. No write/fence authority is asserted.
 if(cached)for(let i=0;i<100;i++)instance.itemSizeCache.set(i,200);
 Object.assign(instance.options,{paddingStart:0,scrollMargin:0,laneAssignmentMode:'greedy',gap:0,enabled:true,initialMeasurementsCache:[]});
 Object.assign(instance,{laneAssignments:new Map(),prevLanes:1,lanesChangedFlag:false,lanesSettling:false,pendingMin:0,measurementsCache:[],itemSizeCacheVersion:0});instance._singleLaneMeasurements.items=indices.slice();
 let estimates=0;const original=Function('measuredRef','__wh','return('+variable(instrument.transformWarm('copilot').code,'estimateRowSize')+');')({current:{total:0,sizes:new Map()}},f.ingress);instance.options.estimateSize=()=>{estimates++;return original();};
 for(const name of ['getMeasurementOptions','getMeasurements'])instance[name]=Function('memo','createLazyMeasurementsView','return('+assignedArrow(code,name)+');').call(instance,memo,createLazyMeasurementsView);
 const result=f.ingress.sealPreparation();return{f,result,estimates};
}
test('E1 actual original getMeasurements uncached estimator path refuses without suppressing its100 original estimates',async()=>{
 const {f,result,estimates}=await originalMeasurementProbe(false);assert.equal(estimates,100);assert.equal(result.chronology,null);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);assert.equal(f.f.instance.measurementsCache.length,100);
});
test('E1 actual original getMeasurements cached-size recomputation can prepare without any estimator entry',async()=>{
 const {f,result,estimates}=await originalMeasurementProbe(true);assert.equal(estimates,0);assert.equal(result.chronology.complete,true);assert.equal(result.plan.reason,'no-gap');assert.equal(f.ingress.healthy(),true);assert.equal(f.f.instance.measurementsCache.length,100);assert.equal(f.x.snapshot().counts.writes,0);
});
for(const variant of ['count101','count-accessor','cache129'])test('E1 authenticates '+variant+' before inducing the original measurements loop',async()=>{
 const f=await freshMemoFixture();f.instance.getVirtualIndexes();let calls=0,accessors=0;const original=f.instance.getMeasurements;f.instance.getMeasurements=()=>{calls++;return original();};
 if(variant==='count101')f.instance.options.count=101;
 if(variant==='count-accessor')Object.defineProperty(f.instance.options,'count',{get(){accessors++;throw Error('unowned count');}});
 if(variant==='cache129')for(let i=0;i<129;i++)f.instance.itemSizeCache.set(i,200);
 let result,thrown;try{result=f.ingress.sealPreparation();}catch(e){thrown=e;}assert.equal(calls,0,'no induced original loop before closed private count/cache admission');assert.equal(accessors,0);assert.equal(thrown,undefined);assert.equal(result.plan.status,'unavailable');assert.equal(f.ingress.healthy(),false);
});
test('E1 pre-call options accessors are unadmitted without invoking either original memo or accessor',async()=>{
 for(const key of ['count','lanes','enabled','getItemKey','initialMeasurementsCache']){
  const f=await freshMemoFixture();f.instance.getVirtualIndexes();let calls=0,reads=0;const original=f.instance.getMeasurements;f.instance.getMeasurements=()=>{calls++;return original();};Object.defineProperty(f.instance.options,key,{get(){reads++;throw Error('must not call owned-data accessor');}});
  const result=f.ingress.sealPreparation();assert.equal(result.plan.status,'unavailable');assert.equal(calls,0);assert.equal(reads,0);assert.equal(f.ingress.healthy(),false);
 }
});

test('E2 runtime64 codec is separate from old C32 and serializes only the whole wrapper',async()=>{
 const {encodeWarmSlot,encodeWarmRuntimeSlot}=await import('./policy.mjs'),value=maximumWarmWrapper();value.partial.counts.scopes=9109;value.partial.counts.commits=64;
 assert.throws(()=>encodeWarmSlot('partial-01.json',value));const stringify=JSON.stringify,calls=[];let bytes;
 try{JSON.stringify=function(v,...rest){calls.push(v);return stringify.call(this,v,...rest);};bytes=encodeWarmRuntimeSlot('partial-01.json',value);}finally{JSON.stringify=stringify;}
 assert.deepEqual(calls,[value]);assert.ok(bytes.length<=262144);for(let slot=2;slot<=4;slot++)assert.ok(encodeWarmRuntimeSlot('partial-0'+slot+'.json',{...value,slot,chronology:null,plan:null}).length<=262144);
 value.partial.counts.scopes=9110;assert.throws(()=>encodeWarmRuntimeSlot('partial-01.json',value));value.partial.counts.scopes=9109;value.partial.counts.commits=65;assert.throws(()=>encodeWarmRuntimeSlot('partial-01.json',value));
});
test('E2 controller RAF shares core requests before selection and across chronology close',async()=>{
 const raw=fs.readFileSync(new URL('adapter.mjs',import.meta.url),'utf8'),callbacks=[];const g={requestAnimationFrame(fn){callbacks.push(fn);return callbacks.length;}};
 const source='const window=globalThis.__warmFrameTestWindow;\n'+raw+'\n//frame'+(++fixtureSerial);globalThis.__warmFrameTestWindow=g;
 let a;try{const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));a=m.createWarmSourceIngress(createWarmRuntime());}finally{delete globalThis.__warmFrameTestWindow;}
 for(let i=0;i<16;i++)assert.equal(a.frameRequest({}),true);assert.equal(a.close().complete,true);
 for(let i=0;i<16;i++){const p=a.controllerFrame();callbacks.shift()();await p;}assert.equal(a.healthy(),true);const pending=callbacks.length;assert.throws(()=>a.controllerFrame(),/raf/);assert.equal(callbacks.length,pending);assert.equal(a.healthy(),false);
});
test('E2 original scroll constructor capture preserves callable identity before setter',()=>{
 const old=instrument.transform('core').code,now=instrument.transformWarm('core').code;const a=assignedArrow(old,'scrollToIndex'),b=assignedArrow(now,'scrollToIndex');
 const instance={},trace=[],result=Function('__wh','return('+b+');').call(instance,{capture(i,fn,kind){assert.equal(kind,2);assert.equal(i,instance);trace.push('capture');return fn;}});assert.equal(typeof result,'function');assert.deepEqual(trace,['capture']);assert.ok(a.includes('this.getOffsetForIndex'));
});
for(const mutation of ['scrollPaddingStart','scrollPaddingEnd','paddingStart','paddingEnd','scrollMargin','gap','horizontal','accessor'])test('E2 original motion refuses incompatible '+mutation+' before invoking original',async()=>{
 let calls=0,reads=0;const original=()=>{calls++;},f=await freshMemoFixture(original),i=f.instance;Object.assign(i.options,{horizontal:false,paddingStart:0,paddingEnd:0,scrollPaddingStart:0,scrollPaddingEnd:0,scrollMargin:0,gap:0});i.getVirtualIndexes();assert.equal(f.ingress.sealPreparation().plan.status,'prepared-structural-only');
 if(mutation==='accessor')Object.defineProperty(i.options,'scrollPaddingStart',{get(){reads++;return 0;}});else i.options[mutation]=mutation==='horizontal'?true:1;
 assert.equal(f.ingress.moveTo(40),false);assert.equal(calls,0);assert.equal(reads,0);assert.equal(f.ingress.healthy(),false);
});
test('E2 original motion accepts fixed own options and preserves exact original throw identity',async()=>{
 const sentinel={originalScroll:true};let calls=0;const original=(index,options)=>{calls++;assert.equal(index,40);assert.deepEqual(options,{align:'start',behavior:'auto'});throw sentinel;},f=await freshMemoFixture(original),i=f.instance;Object.assign(i.options,{horizontal:false,paddingStart:0,paddingEnd:0,scrollPaddingStart:0,scrollPaddingEnd:0,scrollMargin:0,gap:0});i.getVirtualIndexes();assert.equal(f.ingress.sealPreparation().plan.status,'prepared-structural-only');assert.throws(()=>f.ingress.moveTo(40),e=>e===sentinel);assert.equal(calls,1);assert.equal(f.ingress.healthy(),false);
});
for(const mutation of ['live-cache','live-count','live-key'])test('E2 motion rechecks current live '+mutation+' before original',async()=>{
 let calls=0;const original=()=>{calls++;},f=await freshMemoFixture(original),i=f.instance;Object.assign(i.options,{horizontal:false,paddingStart:0,paddingEnd:0,scrollPaddingStart:0,scrollPaddingEnd:0,scrollMargin:0,gap:0});i.getVirtualIndexes();assert.equal(f.ingress.sealPreparation().plan.status,'prepared-structural-only');
 if(mutation==='live-cache')i.itemSizeCache=new Map();else if(mutation==='live-count')i.options.count=101;else i.options.getItemKey=()=>1;
 assert.equal(f.ingress.moveTo(40),false);assert.equal(calls,0);assert.equal(f.ingress.healthy(),false);
});
test('E2 scroll constructor capability must share the already captured original index owner',async()=>{const f=await freshMemoFixture(),fn=()=>{};assert.equal(f.ingress.capture({},fn,2),fn);assert.equal(f.ingress.healthy(),false);});

// Original production initializer and wrapper; scheduler/effects below are authored.
async function constructorWrapperFixture(){
 const x=await virtualFixture(instrument.transformWarm('core').code,0,false,false),reactPin=instrument.registry.find(p=>p.path.endsWith('react-dom-client.production.js')),reactRaw=instrument.boundedRead(instrument.sourceRoot+'/'+reactPin.path,reactPin.bytes).toString();
 const decl=(text,name)=>{const a=text.indexOf('function '+name+'('),b=text.indexOf('\nfunction ',a+10);assert.ok(a>=0&&b>a);return text.slice(a,b);};
 const mount=Function(`let currentlyRenderingFiber=null,workInProgressHook=null,shouldDoubleInvokeUserFnsInHooksDEV=false;const setIsStrictModeForDevtools=()=>{throw Error('DEV branch');};${decl(reactRaw,'mountWorkInProgressHook')}\n${decl(reactRaw,'basicStateReducer')}\n${decl(reactRaw,'mountStateImpl')}\nreturn(f,init)=>{currentlyRenderingFiber=f;workInProgressHook=null;return mountStateImpl(init).memoizedState;};`)();
 let retained=null,prior=null,refs=[],cursor=0,fiber=null;
 const React={useReducer:()=>[0,()=>{}],useRef(v){if(!prior)refs.push({current:v});return refs[cursor++];},useState(init){return[prior?retained:mount(fiber,init),()=>{}];}};
 // The original uninstrumented wrapper function is bounded by its next export.
 const raw=fs.readFileSync(new URL('../../node_modules/@tanstack/react-virtual/dist/esm/index.js',import.meta.url),'utf8'),a=raw.indexOf('function useVirtualizerBase('),b=raw.indexOf('\nfunction ',a+10);assert.ok(a>=0&&b>a);
 const invoke=Function('React','Virtualizer','flushSync','useIsomorphicLayoutEffect',raw.slice(a,b)+';return useVirtualizerBase;')(React,x.bindings.Virtualizer,()=>{throw Error('unexpected flush');},()=>{});
 return{...x,attempt(count,previous=null){prior=previous;fiber=previous?.fiber??{memoizedState:null};refs=previous?.refs??[];cursor=0;retained=previous?.instance??null;const r=x.f.start(previous?.work??{});const instance=invoke({count,estimateSize:()=>200,getScrollElement:()=>null,anchorTo:'end'});x.f.end(r);return{instance,fiber,refs,work:r.work};}};
}
test('registry original lazy constructor retries retain no count0 target and select the eventual original pair',async()=>{
 const x=await constructorWrapperFixture(),a=x.attempt(0),b=x.attempt(0);assert.notEqual(a.instance,b.instance);assert.equal(x.f.ingress.rangeBegin(a.instance,500,0,1),null);assert.equal(x.f.ingress.rangeBegin(b.instance,500,0,1),null);const c=x.attempt(100,b);assert.equal(c.instance,b.instance);assert.equal(x.f.ingress.healthy(),true);assert.equal(x.runtime.diagnostic(),'00');assert.ok(x.f.ingress.rangeBegin(c.instance,500,0,1));
});
test('registry32 constructor entries are nonrenewable when original property setter throws before options',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code,0,false),sentinel={originalSetter:true};Object.defineProperty(x.bindings.Virtualizer.prototype,'getVirtualIndexes',{set(){throw sentinel;},configurable:true});for(let i=0;i<32;i++)assert.throws(()=>new x.bindings.Virtualizer({}),e=>e===sentinel);assert.equal(x.f.ingress.healthy(),true);assert.throws(()=>new x.bindings.Virtualizer({}),e=>e===sentinel);assert.equal(x.runtime.diagnostic(),'10');
});
test('registry unknown count100 owner refuses after original options acceptance without invoking callables',async()=>{
 const x=await virtualFixture(instrument.transformWarm('core').code,0,false),i={},key=n=>n;x.f.ingress.adapter.options(i,{getItemKey:key,lanes:1,enabled:true,initialMeasurementsCache:[],count:100},key);assert.equal(x.f.state().reason,null);assert.equal(x.runtime.diagnostic(),'10');assert.equal(x.f.ingress.healthy(),false);
});
for(const kind of[1,2])test('registry selected callable mismatch preserves sticky source diagnostic kind'+kind,async()=>{const x=await virtualFixture(instrument.transformWarm('core').code),fn=()=>{};assert.equal(x.f.ingress.capture(x.instance,fn,kind),fn);assert.equal(x.runtime.diagnostic(),kind===1?'10':'01');});
for(const kind of[1,2])test('registry malformed constructor callable records exact first diagnostic kind'+kind,async()=>{const x=await virtualFixture(instrument.transformWarm('core').code,0,false),i={};if(kind===2)x.f.ingress.capture(i,()=>[],1);assert.equal(x.f.ingress.capture(i,null,kind),null);assert.equal(x.runtime.diagnostic(),kind===1?'10':'01');});
test('registry selected property replacement cannot pass original seal or motion capability checks',async()=>{
 const a=await freshMemoFixture();a.instance.getVirtualIndexes=()=>[];assert.equal(a.ingress.sealPreparation().plan.status,'unavailable');assert.equal(a.ingress.healthy(),false);
 const b=await freshMemoFixture();Object.assign(b.instance.options,{horizontal:false,paddingStart:0,paddingEnd:0,scrollPaddingStart:0,scrollPaddingEnd:0,scrollMargin:0,gap:0});b.instance.getVirtualIndexes();assert.equal(b.ingress.sealPreparation().plan.status,'prepared-structural-only');let calls=0;b.instance.scrollToIndex=()=>{calls++;};assert.equal(b.ingress.moveTo(40),false);assert.equal(calls,0);
});

test('registry actual production wrapper admits31 bootstrap constructors and distinct100 on render32/options64',async()=>{
 const x=await constructorWrapperFixture(),records=[];for(let i=0;i<31;i++)records.push(x.attempt(0));const last=x.attempt(100);assert.equal(new Set([...records.map(r=>r.instance),last.instance]).size,32);assert.equal(x.f.state().reason,null);assert.equal(x.f.state().renders,32);assert.equal(x.f.state().options,64);assert.equal(x.f.ingress.healthy(),true);for(const r of records)assert.equal(x.f.ingress.rangeBegin(r.instance,500,0,1),null);assert.ok(x.f.ingress.rangeBegin(last.instance,500,0,1));
});
test('registry scroll hook without prior index row refuses as entry admission without gaining authority',async()=>{const x=await virtualFixture(instrument.transformWarm('core').code,0,false),fn=()=>{};assert.equal(x.f.ingress.capture({},fn,2),fn);assert.equal(x.runtime.diagnostic(),'10');assert.equal(x.f.ingress.healthy(),false);});
