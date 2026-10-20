import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const instrument = existsSync(new URL('./instrument.mjs',import.meta.url)) ? await import('./instrument.mjs') : null;
test('exact source preflight is present before vendor execution',{timeout:5000},async()=>{
 assert.ok(instrument,'missing exact-source/reverse preflight capability');
 assert.equal(typeof instrument.preflight,'function');


});
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.env.CAPABILITY_SOURCE_ROOT;
const corePath='node_modules/@tanstack/virtual-core/dist/esm/index.js';
const coreSource=readFileSync(resolve(root,corePath),'utf8');
const studyPath=resolve(process.env.CAPABILITY_ARTIFACT_ROOT,'observer-study.mjs');
const {prepare,deriveStudy}=await import('./run.mjs');
prepare(root);
assert.deepEqual(readFileSync(studyPath),deriveStudy(),'owned derived study must validate before import');
const observerURL=pathToFileURL(studyPath).href;
test('preflight exact ten-file registry without vendor import',{timeout:5000},()=>{
 assert.ok(instrument);const r=instrument.preflight(root);assert.equal(r.files.length,10);assert.equal(r.vendorExecuted,false);
});
test('every registry source/package byte mutation refuses before import',{timeout:5000},()=>{
 assert.ok(instrument);
 for(const row of JSON.parse(readFileSync(new URL('./source-pins.json',import.meta.url))).files){
  assert.throws(()=>instrument.preflight(root,(p,cap)=>{const b=readFileSync(p);return p.endsWith(row.path)?Buffer.concat([b,Buffer.from(' ')]):b;}));
 }
});
test('canonical inserted original reverses exactly and rejects changed receipts',{timeout:5000},()=>{
 assert.ok(instrument);const r=instrument.instrument(coreSource,observerURL);
 assert.equal(instrument.reverse(r),coreSource);
 assert.ok(r.code.includes('measuredResult'));
 assert.throws(()=>instrument.reverse({...r,code:r.code+' '}));
 assert.throws(()=>instrument.reverse({...r,insertions:[...r.insertions,{offset:0,text:'void 0;'}]}));
});
test('noncanonical original/already instrumented/foreign import refuse',{timeout:5000},()=>{
 assert.ok(instrument);assert.throws(()=>instrument.instrument(coreSource+' ',observerURL));
 const r=instrument.instrument(coreSource,observerURL);assert.throws(()=>instrument.instrument(r.code,observerURL));
 assert.throws(()=>instrument.instrument(coreSource,'https://invalid.test/observer.mjs'));
});
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
assert.equal(instrument.sha(readFileSync(new URL('./observer-base.mjs',import.meta.url))),'b24787211944d896a02f7856bec7350e699c3e670301ed9a57f68ef3bf7806fc');
const legacyModule=await import('./observer-base.mjs');
const observerModule=await import(observerURL);
assert.ok(process.env.CAPABILITY_OUTPUT_ROOT&&process.env.CAPABILITY_ARTIFACT_ROOT,'explicit fixture/artifact roots required');
const scratch=resolve(process.env.CAPABILITY_OUTPUT_ROOT),artifactRoot=resolve(process.env.CAPABILITY_ARTIFACT_ROOT);let fixtures=0;
function mapping(){return {schemaVersion:1,kind:'synthetic-default-history-mapping-v1',context:{contextToken:1,contextGeneration:1,scrollerToken:1,threadId:'synthetic-thread'},historyRows:Array.from({length:100},(_,i)=>[i+1,`history-${i}`,i%2?'user':'assistant','a'.repeat(64),i,i,`history-${i}`,i+1]),response:null,count:100};}
async function load(transformed,selection='study',work){
 assert.ok(selection==='study'||selection==='legacy');assert.ok(work===undefined||selection==='study'&&[363846,363845].includes(work));
 const selected=selection==='legacy'?legacyModule:observerModule,profile=selection==='legacy'?'legacy-capability-v3':'h100-functional-v1',selectedURL=selection==='legacy'?new URL('./observer-base.mjs',import.meta.url).href:observerURL;
 assert.ok(observerModule,'missing bounded observer capability');instrument.preflight(root);
 if(!transformed)return {vendor:await import(pathToFileURL(resolve(root,corePath)).href),observer:null,observerModule:selected,profile};
 if(!fixtures){mkdirSync(scratch,{recursive:true});writeFileSync(resolve(scratch,'package.json'),'{"type":"module"}');for(const n of ['lazy-measurements.js','utils.js'])copyFileSync(resolve(root,'node_modules/@tanstack/virtual-core/dist/esm',n),resolve(scratch,n));}
 assert.ok(++fixtures<=40);const bridge=resolve(scratch,`bridge-${fixtures}.mjs`),index=resolve(scratch,`index-${fixtures}.mjs`);
 writeFileSync(bridge,`import {createObserver} from ${JSON.stringify(selectedURL)};export const observer=createObserver(${work===undefined?'':JSON.stringify({work})});`,{flag:'wx'});
 const receipt=instrument.instrument(coreSource,pathToFileURL(bridge).href);assert.equal(instrument.reverse(receipt),coreSource);writeFileSync(index,receipt.code,{flag:'wx'});
 return {vendor:await import(pathToFileURL(index).href),observer:(await import(pathToFileURL(bridge).href)).observer,observerModule:selected,profile};
}
function instance(vendor,observer,settings={}){
 const log=[];let callback;
 const owner={scrollTo(value){assert.equal(this,owner);assert.deepEqual(Reflect.ownKeys(value),['top','behavior']);log.push(['delegate',value]);if(settings.delegateThrow)throw settings.sentinel;}};
 const v=new vendor.Virtualizer({count:100,estimateSize:()=>10,getScrollElement:()=>null,scrollToFn:vendor.elementScroll,onChange:(_,sync)=>{log.push(['notify',sync]);if(settings.notifyThrow)throw settings.sentinel;},measureElement(node){log.push(['measure',node.id]);return callback?callback(node):settings.size??15;},...settings.options});
 v.scrollOffset=100;v.scrollElement=owner;v.measurementsCache=Array.from({length:100},(_,i)=>({index:i,key:i,start:i*10,size:10,end:i*10+10,lane:0}));
 const nodes=Array.from({length:100},(_,i)=>({id:i,isConnected:true,getAttribute(name){assert.equal(name,'data-index');log.push(['index',i]);return String(i);}}));
 if(observer)assert.equal(observer.mapping(v,mapping(),nodes.map((node,i)=>[node,i+1])),true);
 return {v,log,nodes,setCallback:fn=>{callback=fn;}};
}
function negativeExport(fn,label,selected){assert.ok(selected===observerModule||selected===legacyModule);try{assert.equal(fn().status,'unavailable',label);}catch(error){if(error!==selected.EXPORT_REFUSAL)throw error;}}
function observed(f){return f.observer.snapshot();}
for(const mode of ['normal','zero','notifyThrow','delegateThrow','nestedThrow','directReentrant'])test(`original differential and provenance: ${mode}`,{timeout:5000},async()=>{
 const outcomes=[];const sentinel=Object.freeze({original:'sentinel'});
 for(const transformed of [false,true]){
  const loaded=await load(transformed),f={...loaded,...instance(loaded.vendor,loaded.observer,{sentinel,notifyThrow:mode==='notifyThrow',delegateThrow:mode==='delegateThrow',size:mode==='zero'?10:15})};
  if(mode==='nestedThrow')f.setCallback(node=>{if(node.id===0){f.v.measureElement(f.nodes[1]);throw sentinel;}return 15;});
  if(mode==='directReentrant')f.setCallback(node=>{if(node.id===0)f.v.resizeItem(1,20);return 15;});
  let thrown=null;try{f.v.measureElement(f.nodes[0]);}catch(e){thrown=e;}assert.ok(thrown===null||thrown===sentinel);
  outcomes.push({log:f.log,thrown,cache:[...f.v.itemSizeCache],offset:f.v.scrollOffset});
  if(transformed){const s=observed(f);if(['notifyThrow','delegateThrow','nestedThrow'].includes(mode)){assert.equal(s.status,'unavailable');assert.ok(s.provenanceCandidates.every(c=>c[7]!==1));}
   else if(mode==='zero')assert.equal(s.provenanceCandidates.length,0);
   else if(mode==='directReentrant'){assert.equal(s.provenanceCandidates.filter(c=>c[4]===1).length,0);assert.equal(s.provenanceCandidates.filter(c=>c[4]===0&&c[7]===1).length,1);}
   else assert.equal(s.provenanceCandidates.filter(c=>c[7]===1).length,1);
  }
 }
 assert.deepEqual(outcomes[1],outcomes[0]);
});
test('H100 collection records exact work refusal and preserves actual original behavior',{timeout:5000},async()=>{
 const results=[];for(const transformed of [false,true]){const f=await load(transformed,'legacy'),p=instance(f.vendor,f.observer);for(const node of p.nodes)p.v.measureElement(node);results.push({log:p.log,cache:[...p.v.itemSizeCache],offset:p.v.scrollOffset});if(!transformed)continue;
 assert.equal(f.observerModule,legacyModule);assert.equal(f.profile,'legacy-capability-v3');
 const failure=f.observer.workFailure();assert.ok(failure);assert.deepEqual(failure,{operation:'write',requested:2,remaining:0,workUnits:32768,limit:32768});assert.throws(()=>f.observer.fence(p.v),error=>error===f.observerModule.EXPORT_REFUSAL);console.log('H100-COLLECTION-WORK-REFUSAL '+JSON.stringify(failure));
 p.v.setOptions({...p.v.options,count:101});const m=mapping();m.response={messageId:'response-100',index:100,cacheKey:100,reactKey:'response-100',nodeToken:101};m.count=101;assert.equal(f.observer.mapping(p.v,m,p.nodes.map((n,i)=>[n,i+1])),false);assert.equal(f.observer.workFailure(),failure);
 }assert.deepEqual(results[1],results[0]);
});
test('proxy/getter mapping rejected without invocation and whole unavailable latch',{timeout:5000},()=>{
 assert.ok(observerModule);let hits=0;const o=observerModule.createObserver();const v={};const map=new Map();o.cache(v,map);let bad=new Proxy({}, {ownKeys(){hits++;throw Error('trap');}});assert.equal(o.mapping(v,bad,[]),false);assert.equal(hits,0);assert.equal(o.snapshot().status,'unavailable');
});
test('closed configuration faithfully rejects every unknown own key without setters or getters',{timeout:5000},()=>{
 for(const literal of ['{"__proto__":1}','{"__proto__":{"work":32769}}'])assert.equal(observerModule.createObserver(JSON.parse(literal)).snapshot().reasonCode,'limit');
 let hits=0;const p=new Proxy({}, {ownKeys(){hits++;throw Error('must not run');}});const proxy=observerModule.createObserver(p);assert.equal(hits,0);assert.equal(proxy.snapshot().status,'unavailable');
 for(const nullPrototype of [false,true])for(const value of [1,{work:32769}])for(const key of ['__proto__','unknown','constructor','toString',Symbol('unknown')]){const config=nullPrototype?Object.create(null):{};Object.defineProperty(config,key,{value,enumerable:true});const o=observerModule.createObserver(config);assert.equal(o.snapshot().status,'unavailable',String(key));assert.equal(o.snapshot().reasonCode,'limit');}
 for(const nullPrototype of [false,true]){const config=nullPrototype?Object.create(null):{};Object.defineProperty(config,'__proto__',{enumerable:true,get(){hits++;throw Error('must not invoke');}});const o=observerModule.createObserver(config);assert.equal(o.snapshot().reasonCode,'primitive');}
 assert.equal(hits,0);const config=Object.assign(Object.create(null),{events:1024,work:32768});assert.equal(observerModule.createObserver(config).snapshot().status,'observed');
 const f=model(),m=mapping();assert.equal(f.o.mapping(f.v,m,f.nodes.map((node,i)=>[node,i+1])),true);assert.equal(f.o.snapshot().mappingDigest,instrument.sha(JSON.stringify({context:m.context,historyRows:m.historyRows})),'inert-copy prototype does not change canonical mapping serialization/hash');
});
test('source registry itself is immutable',{timeout:5000},async()=>{
 assert.equal(observerModule.LIMITS.work,393216);assert.deepEqual({...observerModule.LIMITS,work:32768},legacyModule.LIMITS);
 assert.equal(observerModule.createObserver({work:393216}).snapshot().status,'observed');for(const cfg of [{work:393217},{profile:'h100-functional-v1'}])assert.equal(observerModule.createObserver(cfg).snapshot().reasonCode,'limit');
 assert.equal(observerModule.createObserver().snapshot().kind,'history-cache-observer-h100-functional-v1');
 assert.equal(legacyModule.LIMITS.work,32768);
 assert.equal(legacyModule.createObserver().snapshot().kind,'history-cache-observer-capability-v1');
 assert.notEqual(observerModule.EXPORT_REFUSAL,legacyModule.EXPORT_REFUSAL);assert.notEqual(observerModule.TIMEOUT,legacyModule.TIMEOUT);
 for(const module of [observerModule,legacyModule]){const o=module.createObserver({work:20});assert.throws(()=>o.snapshot(),e=>e===module.EXPORT_REFUSAL);}
 for(const module of [observerModule,legacyModule])for(const correct of [true,false]){const o=module.createObserver();let rejectWaiter;const waiter=new Promise((_,r)=>rejectWaiter=r);const result=o.publish(()=>new Promise(()=>{}),waiter);rejectWaiter(correct?module.TIMEOUT:(module===observerModule?legacyModule:observerModule).TIMEOUT);const value=await result;assert.equal(value.closure.publishWaiter,correct?'timed-out':'rejected');assert.equal(value.reasonCode,'mapping');}
 const b=readFileSync(new URL('./source-pins.json',import.meta.url));assert.equal(instrument.verifyRegistry(b).files.length,10);assert.throws(()=>instrument.verifyRegistry(Buffer.concat([b,Buffer.from(' ')])));
});
for(const mode of ['batchNotify','batchRetry','calleeGetter','calleeThrow','calleeChanged','objectResult','nodeGetter','nestedNormal','seed','disabled','lanes','measure'])test(`original lifecycle differential: ${mode}`,{timeout:5000},async()=>{
 const records=[],sentinel=Object.freeze({original:mode});
 for(const transformed of [false,true]){
  const loaded=await load(transformed),f={...loaded,...instance(loaded.vendor,loaded.observer)};let thrown=null;
  if(mode==='calleeGetter'||mode==='calleeThrow'){const original=f.v.resizeItem;Object.defineProperty(f.v,'resizeItem',{configurable:true,get(){f.log.push(['callee-read']);if(mode==='calleeThrow')throw sentinel;return original;}});}
  if(mode==='calleeChanged')f.setCallback(()=>{f.v.resizeItem=function(i,s){assert.equal(this,f.v);f.log.push(['changed-callee',i,s]);};return 15;});
  if(mode==='objectResult'){const value={valueOf(){f.log.push(['coerce']);return 15;}};f.setCallback(()=>value);}
  if(mode==='nodeGetter')Object.defineProperty(f.nodes[0],'isConnected',{get(){f.log.push(['connected-read']);return true;}});
  if(mode==='nestedNormal')f.setCallback(node=>{if(node.id===0){f.v.measureElement(f.nodes[1]);if(f.observer)assert.equal(f.observer.snapshot().counts.committedCandidates,0);}return 15;});
  try{
   if(mode==='seed'){f.v.measurementsCache=[];f.v.options.initialMeasurementsCache=[{index:0,key:0,start:0,size:10,end:10,lane:0}];f.v.getMeasurements();}
   else if(mode==='disabled'){f.v.resizeItem(0,15);f.v.setOptions({...f.v.options,enabled:false});f.v.getMeasurements();}
   else if(mode==='lanes'){f.v.getMeasurements();f.v.setOptions({...f.v.options,lanes:2});f.v.getMeasurements();}
   else if(mode==='measure'){f.v.resizeItem(0,15);f.v.measure();}
   else if(mode.startsWith('batch')){
    let callback;f.v.targetWindow={ResizeObserver:class{constructor(cb){callback=cb;}observe(){}unobserve(){}disconnect(){}},requestAnimationFrame(){throw Error('unexpected RAF');},cancelAnimationFrame(){}};
    f.v.measureElement(f.nodes[0]);f.log.length=0;
    if(mode==='batchNotify')f.v.options.onChange=()=>{f.log.push(['batch-notify']);throw sentinel;};
    else f.v._retryClampedAdjustment=()=>{f.log.push(['batch-retry']);throw sentinel;};
    f.setCallback(()=>20);callback([{target:f.nodes[0]}]);
   }else{f.v.measureElement(f.nodes[0]);if(mode==='calleeChanged')f.v.measureElement(f.nodes[1]);}
  }catch(e){thrown=e;}assert.ok(thrown===null||thrown===sentinel);
  // Raw foreign result identity is checked in its own run; comparison retains
  // only primitive state, avoiding any extra coercion or formatter call.
  const cache=[...f.v.itemSizeCache].map(([k,v])=>[k,typeof v==='object'?'original-object':v]);
  records.push({log:f.log,cache,thrown,offset:f.v.scrollOffset});
  if(transformed){const s=f.observer.snapshot();if(['batchNotify','batchRetry','calleeGetter','calleeThrow','calleeChanged','objectResult','seed','disabled','lanes','measure'].includes(mode))assert.equal(s.status,'unavailable',mode);
   if(mode.startsWith('batch')){assert.equal(f.v.itemSizeCache.get(0),20);assert.ok(s.provenanceCandidates.filter(c=>c[6]===20).every(c=>c[7]!==1));}
   if(mode==='nestedNormal')assert.equal(s.counts.committedCandidates,2);
  }
 }
 assert.deepEqual(records[1],records[0]);
});
function model(smaller={}){const o=observerModule.createObserver(smaller),v={itemSizeCache:new Map(),options:{count:100}},fn=()=>{};o.cache(v,v.itemSizeCache);o.resizeFn(v,fn);v.resizeItem=fn;const nodes=Array.from({length:100},()=>({}));return {o,v,nodes,bind:()=>o.mapping(v,mapping(),nodes.map((n,i)=>[n,i+1]))};}
test('missing/cache replacement/node replacement/history group change refuse',{timeout:5000},()=>{
 for(const attack of ['missing','map','node','mapping','append-collision']){const f=model();assert.equal(f.bind(),true);
  if(attack==='map')f.v.itemSizeCache=new Map();
  if(attack==='node'){f.nodes[0]={};assert.equal(f.bind(),false);}
  if(attack==='mapping'){const m=mapping();m.historyRows[0][1]='changed';m.historyRows[0][6]='changed';assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false);}
  if(attack==='append-collision'){const m=mapping();m.count=101;m.response={messageId:'history-0',index:100,cacheKey:100,reactKey:'history-0',nodeToken:101};assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false);}
  negativeExport(()=>f.o.fence(f.v),attack,observerModule);
 }
});
test('finite owner/node/work/event/depth/schema bounds are never enlarged',{timeout:5000},()=>{
 for(const limit of [{owners:1},{nodes:99},{rows:99},{work:1},{events:1},{eventBytes:1},{depth:1},{scopes:1}]){
  const f=model(limit);f.bind();
  if(limit.owners){f.o.cache({},new Map());}
  else {f.o.begin(f.v,1);f.o.begin(f.v,1);}
  assert.equal(f.o.snapshot().status,'unavailable',JSON.stringify(limit));assert.ok(f.o.snapshot().counts.workUnits<=32768,'invalid sub-setup work limit is refused before adoption, never clipped');
 }
 const f=model();f.bind();const v2={};f.o.cache(v2,new Map());const nodes=Array.from({length:100},()=>({}));assert.equal(f.o.mapping(v2,mapping(),nodes.map((n,i)=>[n,i+1])),false,'global node ceiling');
});
test('all exact output bytes include escaping and newline',{timeout:5000},()=>{
 const n=262144-Buffer.byteLength('{\n  "x": ""\n}\n');const value={x:'a'.repeat(n)};assert.equal(observerModule.render(value).length,262144);assert.throws(()=>observerModule.render({x:'a'.repeat(n+1)}));assert.throws(()=>observerModule.render({x:'"'.repeat(n)}));
});
test('retained publication originals cannot be promoted after waiter timeout',{timeout:5000},async()=>{
 const f=model();let resolveOriginal,rejectWaiter;const original=new Promise(r=>{resolveOriginal=r;}),waiter=new Promise((_,r)=>{rejectWaiter=r;});const pending=f.o.publish(()=>original,waiter);rejectWaiter(observerModule.TIMEOUT);assert.equal((await pending).closure.publishWaiter,'timed-out');resolveOriginal();await original;await Promise.resolve();const s=f.o.snapshot();assert.equal(s.status,'unavailable');assert.equal(s.closure.publishOriginal,'fulfilled');assert.equal(s.closure.lateOutcome,'fulfilled');
});
test('node budget applies across all registered owners',{timeout:5000},()=>{
 const f=model();assert.equal(f.bind(),true);const v={};f.o.cache(v,new Map());const nodes=Array.from({length:100},()=>({}));assert.equal(f.o.mapping(v,mapping(),nodes.map((n,i)=>[n,i+1])),false);negativeExport(()=>f.o.snapshot(),'second-owner mapping budget/identity refusal',observerModule);
});
test('mapping arrays require native dense ordinary brand without proxy or getter execution',{timeout:5000},()=>{
 for(const kind of ['impostor','prototype','hole','getter','proxy','nonenum']){
  const f=model(),m=mapping();let hits=0;
  if(kind==='impostor'){const a=Object.create(Array.prototype);Object.defineProperty(a,'length',{value:100});for(let i=0;i<100;i++)a[i]=m.historyRows[i];m.historyRows=a;}
  if(kind==='prototype')Object.setPrototypeOf(m.historyRows,Object.create(Array.prototype));
  if(kind==='hole')delete m.historyRows[2];if(kind==='nonenum')Object.defineProperty(m.historyRows[0],'0',{value:1,enumerable:false});
  if(kind==='getter')Object.defineProperty(m.historyRows[0],'0',{get(){hits++;return 1;}});
  if(kind==='proxy')m.historyRows=new Proxy(m.historyRows,{get(){hits++;throw Error('trap');},getPrototypeOf(){hits++;throw Error('trap');}});
  assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false,kind);assert.equal(hits,0,kind);
 }
});
test('changed original key mapping cannot attribute another row measurement',{timeout:5000},async()=>{
 const outcomes=[];
 for(const transformed of [false,true]){const loaded=await load(transformed),f={...loaded,...instance(loaded.vendor,loaded.observer)};
  f.v.setOptions({...f.v.options,getItemKey:i=>99-i});f.v.getMeasurements();
  for(const node of f.nodes)f.v.measureElement(node);
  outcomes.push({log:f.log,cache:[...f.v.itemSizeCache]});
  if(transformed)assert.equal(f.observer.fence(f.v).status,'unavailable');
 }assert.deepEqual(outcomes[1],outcomes[0]);
});
test('render rejects foreign proxy/getter/toJSON without invoking them',{timeout:5000},()=>{
 let hits=0;for(const value of [new Proxy({},{ownKeys(){hits++;throw Error('trap');}}),Object.defineProperty({},'x',{enumerable:true,get(){hits++;return 1;}}),{toJSON(){hits++;return {};}}])assert.throws(()=>observerModule.render(value));assert.equal(hits,0);
});
test('owned snapshots and publication arguments are deeply immutable',{timeout:5000},async()=>{
 const f=model();f.bind();const s=f.o.snapshot();assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.counts));assert.throws(()=>{s.counts.owners=99;});let published;
 const p=f.o.publish(value=>{published=value;return Promise.resolve();},Promise.resolve());await p;assert.ok(Object.isFrozen(published));assert.equal(f.o.snapshot().counts.owners,1);
});
test('publication rejects late originals and preserves closure after invalidation',{timeout:5000},async()=>{
 const f=model();let rejectOriginal,rejectWaiter;const original=new Promise((_,r)=>rejectOriginal=r),waiter=new Promise((_,r)=>rejectWaiter=r);const p=f.o.publish(()=>original,waiter);rejectWaiter(observerModule.TIMEOUT);await p;f.o.dispose();rejectOriginal(Object.freeze({}));await Promise.resolve();await Promise.resolve();const s=f.o.snapshot();assert.equal(s.closure.publishOriginal,'rejected');assert.equal(s.closure.lateOutcome,'rejected');assert.equal(s.status,'unavailable');assert.equal(s.closure.disposed,true);
 assert.equal((await f.o.publish(()=>{throw Error('must not run');},Promise.resolve())).status,'unavailable');
});
test('same-value external writes are explicitly outside available continuity',{timeout:5000},()=>{
 const f=model();f.v.itemSizeCache.set(0,15);f.v.itemSizeCache.delete(0);const s=f.o.unavailable('external-continuity');assert.equal(s.status,'unavailable');assert.equal(s.reasonCode,'external-continuity');
});
const runner=existsSync(new URL('./run.mjs',import.meta.url))?await import('./run.mjs'):null;
test('inert runner resolves repository source and strict preflight writes no output',{timeout:5000},()=>{
 assert.ok(runner,'missing inert bounded runner');const prepared=runner.prepare(root);assert.equal(prepared.profile,'h100-functional-v1');assert.equal(prepared.workCeiling,393216);assert.equal(prepared.legacyObserver.sha256,'b24787211944d896a02f7856bec7350e699c3e670301ed9a57f68ef3bf7806fc');assert.deepEqual(runner.parseArgs(['--preflight']),{mode:'preflight',sourceRoot:root});
 for(const args of [['--run'],['--test','--source-root',root],['--preflight','--source-root',root,'--out','x'],['--preflight','--source-root',root,'--source-root',root]])assert.throws(()=>runner.parseArgs(args));
});
test('exclusive receipt writer requires fsync close and readback without overwriting',{timeout:5000},()=>{
 assert.ok(runner);mkdirSync(scratch,{recursive:true});const p=resolve(scratch,'writer.json'),bytes=Buffer.from('{"closed":true}\n');const r=runner.writeClosed(p,bytes);assert.equal(r.bytes,bytes.length);assert.throws(()=>runner.writeClosed(p,bytes));
 for(const stage of ['write','fsync','close','readback']){let closed=0;const io={open:()=>42,write:()=>{if(stage==='write')throw Error('fixture');return bytes.length;},fsync:()=>{if(stage==='fsync')throw Error('fixture');},close:()=>{closed++;if(stage==='close')throw Error('fixture');},read:()=>stage==='readback'?Buffer.from('wrong'):bytes};assert.throws(()=>runner.writeClosed('unused',bytes,io),undefined,stage);assert.equal(closed,1,stage);}
});
test('whole study report never promotes synthetic checks to warm readiness',{timeout:5000},()=>{
 assert.ok(runner);const r=runner.studyReport([{id:'synthetic-core-tests',outcome:'passed'}]);assert.equal(r.kind,'history-cache-observer-h100-functional-study-v1');assert.equal(r.status,'unavailable');assert.equal(r.warmReadiness,'unavailable');assert.equal(r.liveReactMapping,'unavailable');assert.equal(r.externalMutationContinuity,'unavailable');assert.ok(Object.values(r.authority).every(x=>x===false||x==='unavailable'));
});
for(const mode of ['negativeDelta','zeroSize','pending','mapFieldGetter','mapMethodGetter','measureOptionGetter','setOptionsGetter'])test(`read/value differential: ${mode}`,{timeout:5000},async()=>{
 const results=[];for(const transformed of [false,true]){const loaded=await load(transformed),f={...loaded,...instance(loaded.vendor,loaded.observer,{size:mode==='negativeDelta'?5:mode==='zeroSize'?0:15})};
  if(mode==='pending')f.v.getCommandWrittenOffset=()=>{f.log.push(['command-read']);return 117;};
  if(mode==='mapFieldGetter'){const map=f.v.itemSizeCache;Object.defineProperty(f.v,'itemSizeCache',{get(){f.log.push(['map-read']);return map;}});}
  if(mode==='mapMethodGetter'){const map=f.v.itemSizeCache;Object.defineProperty(map,'set',{get(){f.log.push(['set-read']);return Map.prototype.set;}});}
  if(mode==='measureOptionGetter'){const fn=f.v.options.measureElement;Object.defineProperty(f.v.options,'measureElement',{get(){f.log.push(['callback-read']);return fn;}});}
  if(mode==='setOptionsGetter'){const opts={...f.v.options};Object.defineProperty(opts,'getItemKey',{enumerable:true,get(){f.log.push(['options-key-read']);return f.v.options.getItemKey;}});f.v.setOptions(opts);}
  const value=f.v.measureElement(f.nodes[0]);results.push({value,log:[...f.log],cache:[...f.v.itemSizeCache],offset:f.v.scrollOffset});
  if(transformed){const s=f.observer.snapshot();if(mode==='mapFieldGetter')assert.equal(s.status,'unavailable');else assert.equal(s.counts.committedCandidates,1);if(mode==='pending')assert.ok(!f.log.some(x=>x[0]==='delegate'));}
 }assert.deepEqual(results[1],results[0]);
});
test('open scope and observed then invalidated scope remain unavailable',{timeout:5000},async()=>{
 const f=await load(true),p=instance(f.vendor,f.observer);p.v.measureElement(p.nodes[0]);assert.equal(f.observer.snapshot().counts.committedCandidates,1);p.v.measure();assert.equal(f.observer.fence(p.v).status,'unavailable');
 const m=model();m.bind();m.o.begin(m.v,1);assert.equal(m.o.fence(m.v).reasonCode,'scope-open');
});
test('generation/candidate/census ceilings are lifetime limits',{timeout:5000},()=>{
 const g=model({generations:1});g.o.reset(g.v,1);assert.equal(g.o.snapshot().reasonCode,'limit');
 const c=model({candidates:1});c.bind();function measure(i){const scope=c.o.begin(c.v,1);c.o.bind(c.v,scope,c.nodes[i],i);const edge=c.o.edge(c.v,scope,c.nodes[i],i);c.o.measuredResult(edge,15);const r=c.o.resizeEnter(c.v,i,15);c.v.itemSizeCache.set(i,15);c.o.write(c.v,i,15);c.o.resizeExit(c.v,r,true);c.o.edgeReturn(edge);c.o.end(c.v,scope,true);}
 measure(0);measure(1);assert.equal(c.o.snapshot().reasonCode,'limit');assert.equal(c.o.snapshot().provenanceCandidates.length,1);
 const f=model({candidates:1});f.bind();const outer=f.o.begin(f.v,1);function pendingWrite(i){const scope=f.o.begin(f.v,1);f.o.bind(f.v,scope,f.nodes[i],i);const edge=f.o.edge(f.v,scope,f.nodes[i],i);f.o.measuredResult(edge,15);const resize=f.o.resizeEnter(f.v,i,15);f.v.itemSizeCache.set(i,15);f.o.write(f.v,i,15);f.o.resizeExit(f.v,resize,true);f.o.edgeReturn(edge);f.o.end(f.v,scope,true);}pendingWrite(0);assert.equal(f.o.snapshot().counts.pendingCandidates,1);pendingWrite(1);let state=f.o.snapshot();assert.equal(state.counts.pendingCandidates,0);assert.equal(state.provenanceCandidates.length,1);assert.equal(state.provenanceCandidates[0][7],2);assert.equal(state.closure.activeMeasurements,1);f.o.end(f.v,outer,false);state=f.o.unavailable('owner');assert.equal(state.closure.activeMeasurements,0);assert.equal(state.provenanceCandidates[0][7],2);
 const source=readFileSync(studyPath,'utf8'),failure=source.slice(source.indexOf(' function fail('),source.indexOf(' function charge('));assert.ok(failure.indexOf('cleanupDone||cleanupInProgress')<failure.indexOf('for(const c of pending)'));assert.ok(!failure.includes('charge('));assert.ok(!failure.includes('fail(' ,failure.indexOf('{')+1));

});
test('closed tuples reject extra own properties',{timeout:5000},()=>{
 for(const extra of ['string','symbol']){const f=model(),m=mapping();m.historyRows[0][extra==='symbol'?Symbol('extra'):'extra']=1;assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false);assert.equal(f.o.snapshot().status,'unavailable');}
});
test('new profile completes first census and refuses next lifetime census call',{timeout:5000},()=>{
 const f=model({censusCalls:1});f.bind();for(let i=0;i<100;i++){const scope=f.o.begin(f.v,1);f.o.bind(f.v,scope,f.nodes[i],i);const edge=f.o.edge(f.v,scope,f.nodes[i],i);f.o.measuredResult(edge,15);const r=f.o.resizeEnter(f.v,i,15);f.v.itemSizeCache.set(i,15);f.o.write(f.v,i,15);f.o.resizeExit(f.v,r,true);f.o.edgeReturn(edge);f.o.end(f.v,scope,true);}
 assert.equal(f.o.workFailure(),null);const first=f.o.fence(f.v);assert.equal(first.status,'observed');assert.equal(first.census.complete,true);assert.equal(first.census.entries.length,100);assert.equal(first.counts.censusCalls,1);const second=f.o.fence(f.v);assert.equal(second.status,'unavailable');assert.equal(second.reasonCode,'limit');assert.equal(second.counts.censusCalls,2);assert.equal(f.o.workFailure(),null);
});
test('B1 publication never exports observed active scope or unconsumed provenance',{timeout:5000},async()=>{
 for(const kind of ['scope','armed','consumed','pending','double']){const f=model();f.bind();const s=f.o.begin(f.v,1);f.o.bind(f.v,s,f.nodes[0],0);const e=f.o.edge(f.v,s,f.nodes[0],0);if(kind!=='scope')f.o.measuredResult(e,15);if(['consumed','pending','double'].includes(kind)){f.o.resizeEnter(f.v,0,15);if(kind!=='consumed'){f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);}if(kind==='double')f.o.measuredResult(e,15);}
  let argument;await f.o.publish(v=>{argument=v;return Promise.resolve();},Promise.resolve());assert.equal(argument.status,'unavailable',kind);f.o.end(f.v,s,false);assert.equal(argument.status,'unavailable');
 }
});
test('B2 source key/start changes refuse after measured origin and during append',{timeout:5000},async()=>{
 for(const change of ['key','anchor','appendKey']){const f=await load(true),p=instance(f.vendor,f.observer);p.v.measureElement(p.nodes[0]);assert.equal(f.observer.snapshot().counts.committedCandidates,1);p.v.setOptions({...p.v.options,...(change==='anchor'?{anchorTo:'end'}:{getItemKey:i=>99-i}),...(change==='appendKey'?{count:101}:{})});assert.equal(f.observer.snapshot().reasonCode,'mapping',change);assert.equal(f.observer.fence(p.v).status,'unavailable',change);}
});
test('B3 distinct declared node tokens join actual registered node identity and never response token',{timeout:5000},()=>{
 for(const kind of ['repeat','mismatch','response']){const f=model(),m=mapping();if(kind==='repeat')m.historyRows[1][7]=m.historyRows[0][7];if(kind==='mismatch')[m.historyRows[0][7],m.historyRows[1][7]]=[2,1];if(kind==='response'){m.count=101;m.response={messageId:'new',reactKey:'new',index:100,cacheKey:100,nodeToken:1};}assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false,kind);}
 const f=model(),m=mapping();for(let i=0;i<100;i++)m.historyRows[i][7]=100-i;assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,100-i])),true);const scope=f.o.begin(f.v,1);f.o.bind(f.v,scope,f.nodes[0],0);f.o.end(f.v,scope,true);const state=f.o.snapshot();assert.equal(state.measurementScopes[0][4],100);assert.equal(state.measurementScopes[0][5],0);

});
test('N1 closed records reject custom prototype and nonenumerable fields',{timeout:5000},()=>{
 for(const kind of ['prototype','enumerable']){const f=model(),m=mapping();if(kind==='prototype')Object.setPrototypeOf(m,{foreign:true});else Object.defineProperty(m,'count',{value:100,enumerable:false});assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),false,kind);}
 const f=model(),m=Object.assign(Object.create(null),mapping());assert.equal(f.o.mapping(f.v,m,f.nodes.map((n,i)=>[n,i+1])),true);
});
test('N2 render bounds own native array length before enumerating keys',{timeout:5000},()=>{
 const source=readFileSync(studyPath,'utf8');const start=source.indexOf('export function render');const end=source.indexOf('export function createObserver');const renderSource=source.slice(start,end);assert.ok(renderSource.indexOf("desc(v,'length')")<renderSource.indexOf('keys(v)'));
 const a=[];a.length=32769;assert.throws(()=>observerModule.render(a));
});
test('N3 same-key direct overwrite supersedes measured origin even with equal value',{timeout:5000},async()=>{
 for(const size of [15,20]){const f=await load(true),p=instance(f.vendor,f.observer);p.v.measureElement(p.nodes[0]);p.v.resizeItem(0,size);const s=f.observer.snapshot();if(size===20)assert.equal(s.counts.committedCandidates,0);else assert.equal(s.counts.committedCandidates,1,'original equal-delta branch performs NO write, origin remains valid');}
});
test('equal native direct-write model supersedes provenance while unchanged vendor equal delta makes no write',{timeout:5000},()=>{
 const f=model();f.bind();const s=f.o.begin(f.v,1);f.o.bind(f.v,s,f.nodes[0],0);const e=f.o.edge(f.v,s,f.nodes[0],0);f.o.measuredResult(e,15);let r=f.o.resizeEnter(f.v,0,15);f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);f.o.resizeExit(f.v,r,true);f.o.edgeReturn(e);f.o.end(f.v,s,true);assert.equal(f.o.snapshot().counts.committedCandidates,1);
 r=f.o.resizeEnter(f.v,0,15);f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);f.o.resizeExit(f.v,r,true);assert.equal(f.o.snapshot().counts.committedCandidates,0);assert.equal(f.o.snapshot().provenanceCandidates[0][7],3);
});
test('N3 original predicate delegate and notify reentry after consumed edge never inherit origin',{timeout:5000},async()=>{
 for(const site of ['predicate','delegate','notify']){const results=[];for(const transformed of [false,true]){const loaded=await load(transformed),f={...loaded,...instance(loaded.vendor,loaded.observer)};let once=false;const reenter=()=>{if(!once){once=true;f.v.resizeItem(1,20);}};
  if(site==='predicate')f.v.shouldAdjustScrollPositionOnItemSizeChange=function(){assert.equal(this,f.v);reenter();return true;};if(site==='delegate'){const delegate=f.v.scrollElement.scrollTo;f.v.scrollElement.scrollTo=function(value){reenter();return delegate.call(this,value);};}if(site==='notify')f.v.options.onChange=()=>{reenter();f.log.push(['custom-notify']);};
  f.v.measureElement(f.nodes[0]);results.push({log:f.log,cache:[...f.v.itemSizeCache]});if(transformed){const s=f.observer.snapshot();assert.ok(s.provenanceCandidates.filter(c=>c[4]===1).every(c=>c[7]!==1));}
 }assert.deepEqual(results[1],results[0]);}
});
test('N3 wrong double and unconsumed edge plus open resize cannot be admitted',{timeout:5000},()=>{
 for(const kind of ['wrong','double','unconsumed','pending']){const f=model();f.bind();const s=f.o.begin(f.v,1);f.o.bind(f.v,s,f.nodes[0],0);const e=f.o.edge(f.v,s,f.nodes[0],0);f.o.measuredResult(e,15);if(kind==='double')f.o.measuredResult(e,15);else if(kind==='wrong')f.o.resizeEnter(f.v,1,15);else if(kind==='pending'){const r=f.o.resizeEnter(f.v,0,15);f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);f.o.resizeExit(f.v,r,true);}f.o.end(f.v,s,true);assert.equal(f.o.fence(f.v).status,'unavailable',kind);}
 for(const method of ['begin','resizeEnter']){const f=model({events:1});const id=method==='begin'?f.o.begin(f.v,1):f.o.resizeEnter(f.v,0,15);assert.equal(id,null,'denied event admission must not create active ID');const state=f.o.snapshot();assert.equal(state.closure.activeMeasurements,0);assert.equal(state.closure.activeResizes,0);}

});
test('B4 candidate and ancestor scans are precharged rather than hidden by event cost',{timeout:5000},()=>{
 const f=model();f.bind();const outer=f.o.begin(f.v,1),inner=f.o.begin(f.v,1);f.o.bind(f.v,inner,f.nodes[0],0);const edge=f.o.edge(f.v,inner,f.nodes[0],0);f.o.measuredResult(edge,15);const r=f.o.resizeEnter(f.v,0,15);f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);f.o.resizeExit(f.v,r,true);f.o.edgeReturn(edge);const before=f.o.snapshot().counts.workUnits;f.o.end(f.v,inner,true);const after=f.o.snapshot().counts.workUnits;assert.ok(after-before>=30,'end record, edge inspection, candidate and both ancestor lookups require charges');f.o.end(f.v,outer,true);
});
test('B4 exact deep-copy budget and plus-one export refusal retain first exhausted operation',{timeout:5000},async()=>{

 const denied=observerModule.createObserver({work:20}),identity=new Map();assert.equal(denied.workFailure().operation,'configuration');assert.equal(denied.workFailure().requested,32);const originalFailure=denied.workFailure();assert.equal(denied.cache({},identity),identity);assert.equal(denied.begin({},1),null);assert.equal(denied.resizeEnter({},0,15),null);assert.equal(denied.workFailure(),originalFailure);assert.throws(()=>denied.snapshot(),error=>error===observerModule.EXPORT_REFUSAL);
 function pending(limit){const f=model({work:limit});assert.equal(f.bind(),true);const scope=f.o.begin(f.v,1);f.o.bind(f.v,scope,f.nodes[0],0);const edge=f.o.edge(f.v,scope,f.nodes[0],0);f.o.measuredResult(edge,15);const resize=f.o.resizeEnter(f.v,0,15);const before=f.o.snapshot().counts.workUnits;return {...f,scope,resize,before};}
 const probe=pending(32768),boundary=probe.before+104,yes=pending(boundary),no=pending(boundary-1);for(const f of [yes,no]){f.v.itemSizeCache.set(0,15);f.o.write(f.v,0,15);}assert.equal(yes.o.workFailure(),null,'full candidate credit fits exactly before insertion');assert.ok(no.o.workFailure(),'candidate reserve plus-one denied before insertion');assert.equal(no.o.workFailure().operation,'write');assert.equal(no.o.workFailure().requested,36);assert.equal(no.o.workFailure().remaining,35);for(const f of [yes,no]){f.o.resizeExit(f.v,f.resize,true);f.o.end(f.v,f.scope,true);}
 function setup(limit){const o=observerModule.createObserver({work:limit}),v={};o.cache(v,new Map());o.resizeFn(v,()=>{});return {o,v};}
 const baseline=setup(32768),cost=baseline.o.snapshot().counts.workUnits,exact=setup(cost),short=setup(cost-1);assert.equal(exact.o.snapshot().status,'observed');assert.throws(()=>short.o.snapshot(),e=>e===observerModule.EXPORT_REFUSAL,'no alternate refusal schema or fallback clone');assert.equal(short.o.workFailure().operation,'snapshot-copy');assert.equal(short.o.workFailure().requested,1024+64);assert.ok(short.o.workFailure().remaining<short.o.workFailure().requested);exact.o.begin(exact.v,1);assert.equal(exact.o.workFailure().operation,'begin');
 let invoked=0;await assert.rejects(short.o.publish(()=>{invoked++;return Promise.resolve();},Promise.resolve()),e=>e===observerModule.EXPORT_REFUSAL);assert.equal(invoked,0,'pre-export refusal cannot call original publisher');
});
test('exact128 scope records plus next refusal; default append law and crossowner coverage limits',{timeout:5000},()=>{
 const o=observerModule.createObserver(),v={};o.cache(v,new Map());const ids=[];for(let i=0;i<128;i++){const scope=o.begin(v,1);assert.ok(scope!==null);ids.push(scope);o.end(v,scope,true);}assert.equal(ids.length,128);assert.equal(o.workFailure(),null,'all128scope admissions fit; detailed export is a separate budget');assert.equal(o.begin(v,1),null);assert.equal(o.workFailure(),null,'next refusal is scope count, not a fabricated budget tuple');const state=o.snapshot();assert.equal(state.status,'unavailable');assert.equal(state.reasonCode,'limit');assert.equal(state.measurementScopes.length,128);assert.equal(o.workFailure(),null);
 const f=model(),key=i=>i;f.o.options(f.v,{getItemKey:key,anchorTo:'start',count:100},key);assert.equal(f.bind(),true);f.o.options(f.v,{getItemKey:key,anchorTo:'start',count:101},key);assert.equal(f.o.snapshot().status,'observed','mapping law only; no coverage claim');
 const second={};f.o.cache(second,new Map());const nodes=Array.from({length:100},()=>({}));assert.equal(f.o.mapping(second,mapping(),nodes.map((n,i)=>[n,i+1])),false);negativeExport(()=>f.o.snapshot(),'second fullH100 exceeds combined work/node scope',observerModule);
});

test('new profile H100 four exports and exact full-sequence plus-one boundary',{timeout:5000},async()=>{
 const baseline=await load(false),original=instance(baseline.vendor,null);for(const node of original.nodes)original.v.measureElement(node);
 const before={log:[...original.log],cache:[...original.v.itemSizeCache],offset:original.v.scrollOffset};original.v.setOptions({...original.v.options,count:101});const after={log:[...original.log],cache:[...original.v.itemSizeCache],offset:original.v.scrollOffset};
 for(const work of [undefined,363846,363845]){
  const f=await load(true,'study',work),p=instance(f.vendor,f.observer);assert.equal(f.observerModule,observerModule);assert.equal(f.profile,'h100-functional-v1');
  for(const node of p.nodes)p.v.measureElement(node);
  assert.deepEqual({log:p.log,cache:[...p.v.itemSizeCache],offset:p.v.scrollOffset},before);assert.equal(f.observer.workFailure(),null);
  const records=[],rendered=[],graphs=new Set(),writerReceipts=[];const shift=work===undefined?0:6;
  function retain(record,index,expected){
   assert.equal(record.kind,'history-cache-observer-h100-functional-v1');assert.equal(record.counts.workUnits,expected+shift);assert.equal(record.counts.owners,1);assert.equal(record.counts.nodes,100);assert.equal(record.counts.generations,1);assert.equal(record.counts.committedCandidates,100);assert.equal(record.counts.pendingCandidates,0);assert.equal(record.counts.historyRows,100);assert.equal(record.counts.totalRows,index===0?100:101);assert.equal(record.counts.events,index===0?803:805);assert.equal(record.measurementScopes.length,100);assert.equal(record.provenanceCandidates.length,100);assert.ok(record.provenanceCandidates.every(c=>c[7]===1));assert.ok(record.measurementScopes.every(s=>s[8]===1));assert.equal(record.census.complete,true);assert.equal(record.census.entries.length,100);assert.equal(record.counts.censusCalls,index===0?1:2);
   assert.equal(record.closure.activeMeasurements,0);assert.equal(record.closure.activeResizes,0);assert.equal(record.status,index===3?'unavailable':'observed');assert.equal(record.reasonCode,index===3?'disposal':null);assert.equal(record.closure.disposed,index===3);assert.equal(record.closure.admission,index===3?'closed':'open');assert.equal(record.closure.publishOriginal,index<2?'not-started':'fulfilled');assert.equal(record.closure.publishWaiter,index<2?'not-started':'fulfilled');assert.equal(record.closure.lateOutcome,'none');assert.equal(record.closure.receiptWriter,'not-started');assert.ok(Object.values(record.authority).every(x=>x===false||x==='unavailable'));
   for(let i=0;i<100;i++){assert.equal(p.v.itemSizeCache.get(i),15);assert.deepEqual(record.census.entries[i].slice(0,5),[i+1,i,15,1,i+1]);const c=record.provenanceCandidates[i],s=record.measurementScopes[i];assert.equal(c[2],s[0]);assert.equal(c[4],i);assert.equal(c[6],15);assert.equal(s[4],i+1);assert.equal(s[5],i);assert.equal(record.census.entries[i][5],c[5]);}
   function owned(value){if(value===null||typeof value!=='object')return;assert.ok(Object.isFrozen(value));assert.ok(!graphs.has(value),'each record and child is a fresh deep-owned copy');graphs.add(value);for(const name of Object.keys(value))owned(value[name]);}owned(record);
   const bytes=f.observerModule.render(record);assert.ok(bytes.length<=262144);for(let i=0;i<records.length;i++)assert.deepEqual(f.observerModule.render(records[i]),rendered[i],'earlier owned evidence unchanged');records.push(record);rendered.push(bytes);
   if(work===undefined&&index!==1)writerReceipts.push(runner.writeClosed(resolve(artifactRoot,['h100-01-entry.json','h100-02-publication-argument.json','h100-03-publication-returned.json','h100-04-disposed.json'][index]),bytes));
   return bytes;
  }
  const entry=f.observer.fence(p.v);retain(entry,0,143170);
  p.v.setOptions({...p.v.options,count:101});const m=mapping();m.response={messageId:'response-100',index:100,cacheKey:100,reactKey:'response-100',nodeToken:101};m.count=101;assert.equal(f.observer.mapping(p.v,m,p.nodes.map((node,i)=>[node,i+1])),true);
  assert.deepEqual({log:p.log,cache:[...p.v.itemSizeCache],offset:p.v.scrollOffset},after);assert.equal(p.v.itemSizeCache.has(100),false);
  let resolveOriginal,resolveWaiter;const originalPromise=new Promise(r=>resolveOriginal=r),waiter=new Promise(r=>resolveWaiter=r);let publicationReceipt;
  const pending=f.observer.publish(argument=>{const bytes=retain(argument,1,231552);assert.equal(argument.mappingDigest,entry.mappingDigest);if(work===undefined){publicationReceipt=runner.writeClosed(resolve(artifactRoot,'h100-02-publication-argument.json'),bytes);writerReceipts.push(publicationReceipt);}resolveOriginal(publicationReceipt);return originalPromise;},waiter);
  await originalPromise;await Promise.resolve();resolveWaiter(publicationReceipt);const returned=await pending;retain(returned,2,297696);assert.equal(returned.mappingDigest,entry.mappingDigest);
  if(work===363845){assert.throws(()=>f.observer.dispose(),error=>error===f.observerModule.EXPORT_REFUSAL);assert.deepEqual(f.observer.workFailure(),{operation:'snapshot-copy',requested:66144,remaining:66143,workUnits:297702,limit:363845});assert.equal(records.length,3);console.log('H100-PLUS-ONE-EXPORT-REFUSAL '+JSON.stringify(f.observer.workFailure()));}
  else {const disposed=f.observer.dispose();retain(disposed,3,363840);assert.equal(f.observer.workFailure(),null);assert.equal(records.length,4);assert.equal(disposed.mappingDigest,entry.mappingDigest);}
  if(work===undefined){assert.equal(writerReceipts.length,4);assert.ok(writerReceipts.every(r=>r.fsync==='fulfilled'&&r.close==='fulfilled'&&r.readback==='matched'));console.log('H100-FOUR-EXPORTS '+JSON.stringify({work:records.map(r=>r.counts.workUnits),bytes:rendered.map(b=>b.length),digest:entry.mappingDigest,authority:records[3].authority}));}
 }
});
