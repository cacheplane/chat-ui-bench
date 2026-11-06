import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate as immediate} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {createStock037CpuCaptureV1,STOCK037_CPU_DIAGNOSTIC_ID_V1} from './aimock-stock037-cpu-capture-v1.mjs';
import {analyzeChrome156CpuProfileV2,CPU_PROFILE_V2_LIMITS} from './aimock-cpu-profile-v2.mjs';

const revision='f842f52ef39fd97b449eb27cff414bf05a98ddce';
const identity={id:'threadplane-h10000-r6400-follow-stock037-cpu-samples-v1',profile:'threadplane',historyCount:10000,responseBytes:6400,journey:'follow',stockVersion:'0.3.7',buildSha256:'a'.repeat(64)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function profile(){return {nodes:[{id:1,callFrame:{functionName:'(root)',scriptId:'0',url:'',lineNumber:-1,columnNumber:-1},children:[2]},{id:2,callFrame:{functionName:'render',scriptId:'5',url:'http://127.0.0.1:1234/main.js',lineNumber:0,columnNumber:0}}],startTime:100,endTime:1000,samples:[2,1,2],timeDeltas:[100,-50,0]};}
function harness({send=()=>undefined,wait=p=>p,newSession,detach=()=>Promise.resolve(),remaining,version,assetHashes={'main.js':'b'.repeat(64)}}={}){
 let time=0;const calls=[],session=new EventEmitter(),page=new EventEmitter(),context=new EventEmitter(),browser=new EventEmitter(),frame={},pages=[page];
 page.mainFrame=()=>frame;context.pages=()=>pages;context.newCDPSession=()=>{calls.push('new-session');return newSession??Promise.resolve(session);};
 session.send=(method,params)=>{calls.push(method);const supplied=send(method,params);if(supplied!==undefined)return supplied;if(method==='Browser.getVersion')return Promise.resolve(version??{product:'Chrome/156.0.8078.4',revision:'@'+revision,protocolVersion:'1.3',userAgent:'authored',jsVersion:'authored'});if(method==='Page.getFrameTree')return Promise.resolve({frameTree:{frame:{id:'frame',url:'http://127.0.0.1:1234/'}}});if(method==='Target.getTargetInfo')return Promise.resolve({targetInfo:{targetId:'target',type:'page',url:'http://127.0.0.1:1234/'}});if(method==='Profiler.stop')return Promise.resolve({profile:profile()});return Promise.resolve({});};
 session.detach=()=>{calls.push('detach');return detach();};
 const owner=createStock037CpuCaptureV1({now:()=>time,origin:0,identity,wait,remaining:remaining??(()=>100000-time),stageMs:10000,assetHashes});
 return {owner,calls,session,page,context,browser,frame,pages,setTime:n=>{time=n;},setup:()=>owner.setup({browser,context,page,expectedOrigin:'http://127.0.0.1:1234'})};
}
async function running(h){await h.setup();await h.owner.start();h.owner.markPublicAck();return h;}

test('fixed owned commands, actual browser binding and exact canonical raw close successfully',async()=>{
 const h=await running(harness());await h.owner.finish();h.owner.afterBrowserClose();const s=h.owner.seal();
 assert.equal(STOCK037_CPU_DIAGNOSTIC_ID_V1,identity.id);assert.deepEqual(h.calls,['new-session','Browser.getVersion','Page.getFrameTree','Target.getTargetInfo','Profiler.enable','Profiler.setSamplingInterval','Profiler.start','Profiler.stop','Profiler.disable','detach']);
 assert.equal(s.rawJson,JSON.stringify(profile()));assert.equal(s.receipt.complete,true);assert.equal(s.receipt.unsafeOutstanding,false);assert.deepEqual(s.receipt.issues,[]);
 assert.deepEqual(s.receipt.raw,{bytes:Buffer.byteLength(s.rawJson),sha256:sha(s.rawJson)});assert.equal(s.receipt.inventory.chromiumRevision,revision);assert.equal(s.receipt.inventory.versionReply.revision,'@'+revision);
 assert.equal(JSON.parse(s.bindingJson).browserVersion,'156.0.8078.4');assert.equal(analyzeChrome156CpuProfileV2(s.rawJson,s.bindingJson).deltas.negative,1);
 assert(s.receipt.owners.every(o=>o.status==='fulfilled'&&o.attentionStatus==='fulfilled'));assert(Object.isFrozen(s.receipt));
});

test('literal interval and closed fixed identity reject arbitrary ports and selections',async()=>{
 const h=await running(harness({send:(method,params)=>{if(method==='Profiler.setSamplingInterval')assert.deepEqual(params,{interval:10000});}}));await h.owner.finish();
 const base={now:()=>0,origin:0,identity,wait:p=>p,remaining:()=>10000,stageMs:10000,assetHashes:{}};
 for(const patch of [{timeout:50000},{identity:{...identity,historyCount:1000}},{identity:{...identity,id:'other'}},{stageMs:20000}])assert.throws(()=>createStock037CpuCaptureV1({...base,...patch}));
});

test('single stop original shared by finish and cleanup',async()=>{
 const held=deferred(),h=await running(harness({send:m=>m==='Profiler.stop'?held.promise:undefined}));const finish=h.owner.finish();void finish.catch(()=>{});assert.equal(h.owner.beforeBrowserClose(),finish);assert.equal(h.owner.finish(),finish);held.resolve({profile:profile()});await finish;assert.equal(h.calls.filter(x=>x==='Profiler.stop').length,1);assert.equal(h.owner.seal().receipt.complete,true);
});

test('browser mismatch, page navigation, extra page and terminal events latch refusal',async()=>{
 const wrong=harness({version:{product:'Chrome/155.0.0.0',revision:'@'+revision}});await assert.rejects(wrong.setup());await assert.rejects(wrong.owner.beforeBrowserClose());assert.equal(wrong.owner.seal().receipt.complete,false);
 for(const fault of ['navigation','extra','page','browser','session','inventory']){const h=await running(harness());if(fault==='navigation')h.page.emit('framenavigated',h.frame);if(fault==='extra')h.context.emit('page',{});if(fault==='page')h.page.emit('close');if(fault==='browser')h.browser.emit('disconnected');if(fault==='session')h.session.emit('close');if(fault==='inventory')h.pages.push({});await assert.rejects(h.owner.finish());assert.equal(h.owner.seal().receipt.complete,false);}
});

test('start original rejection still attempts one stop, disable and detach',async()=>{
 const h=harness({send:m=>m==='Profiler.start'?Promise.reject(Error('start rejected')):undefined});await h.setup();await assert.rejects(h.owner.start());await assert.rejects(h.owner.beforeBrowserClose());const s=h.owner.seal();assert.equal(s.receipt.complete,false);assert.equal(s.receipt.unsafeOutstanding,false);for(const kind of ['Profiler.stop','Profiler.disable','detach'])assert.equal(h.calls.filter(x=>x===kind).length,1);
});

test('pending start attention stays refused after late actual fulfillment',async()=>{
 const held=deferred(),attention=deferred(),h=harness({send:m=>m==='Profiler.start'?held.promise:undefined,wait:(p,ms,label)=>label==='stock037-cpu-start'?attention.promise:p});await h.setup();const start=h.owner.start();void start.catch(()=>{});h.setTime(5);attention.reject(Error('attention expired'));await assert.rejects(start);await assert.rejects(h.owner.beforeBrowserClose());const s=h.owner.seal(),sealed=JSON.stringify(s);assert.equal(s.receipt.unsafeOutstanding,true);assert.equal(s.receipt.owners.find(o=>o.kind==='start').status,'pending');held.resolve({});await immediate();assert.equal(JSON.stringify(h.owner.seal()),sealed);
});

test('pending stop releases independently, retains original pending and immutable unsafe seal',async()=>{
 const held=deferred(),h=await running(harness({send:m=>m==='Profiler.stop'?held.promise:undefined,wait:(p,ms,label)=>label==='stock037-cpu-stop'?Promise.reject(Error('attention expired')):p}));await assert.rejects(h.owner.finish());assert(h.calls.includes('Profiler.disable'));assert(h.calls.includes('detach'));const s=h.owner.seal(),sealed=JSON.stringify(s);assert.equal(s.receipt.unsafeOutstanding,true);assert.equal(s.receipt.complete,false);assert.equal(s.receipt.owners.find(o=>o.kind==='stop').status,'pending');held.resolve({profile:profile()});await immediate();assert.equal(JSON.stringify(h.owner.seal()),sealed);assert.equal(h.calls.filter(x=>x==='Profiler.stop').length,1);
});

test('disable and detach rejection or pending attention are independent refusal facts',async()=>{
 for(const point of ['Profiler.disable','detach'])for(const pending of [false,true]){const held=deferred(),fail=()=>pending?held.promise:Promise.reject(Error('release rejected'));const h=await running(harness({send:m=>m===point?fail():undefined,detach:point==='detach'?fail:()=>Promise.resolve(),wait:(p,ms,label)=>pending&&label==='stock037-cpu-'+(point==='detach'?'detach':'disable')?Promise.reject(Error('release attention')):p}));await assert.rejects(h.owner.finish());assert(h.calls.includes('Profiler.disable'));assert(h.calls.includes('detach'));const s=h.owner.seal();assert.equal(s.receipt.complete,false);assert.equal(s.receipt.unsafeOutstanding,pending||point==='detach');held.resolve({});await immediate();}
});

test('late session creation is retained and released after setup attention refusal',async()=>{
 const held=deferred(),attention=deferred(),h=harness({newSession:held.promise,wait:(p,ms,label)=>label==='stock037-cpu-session'?attention.promise:p});const setup=h.setup();void setup.catch(()=>{});h.setTime(5);attention.reject(Error('session attention'));await assert.rejects(setup);const finish=h.owner.beforeBrowserClose();held.resolve(h.session);await immediate();await assert.rejects(finish);assert(h.calls.includes('Profiler.disable'));assert(h.calls.includes('detach'));assert.equal(h.owner.seal().receipt.complete,false);
});

test('watchdog expiry shares stop with cleanup and never qualifies shortened acquisition',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=await running(harness());h.setTime(30000);t.mock.timers.tick(30000);await immediate();await assert.rejects(h.owner.beforeBrowserClose());assert.equal(h.calls.filter(x=>x==='Profiler.stop').length,1);const s=h.owner.seal();assert.equal(s.receipt.complete,false);assert(s.receipt.issues.includes('stock037-cpu-watchdog-expired'));assert.equal(s.receipt.watchdog.cancelled,true);
});

test('exact attention equality and exhausted cleanup never receive late success or new dispatch',async()=>{
 const h=harness({wait:async(p,ms,label)=>{const value=await p;if(label==='stock037-cpu-start')h.setTime(10000);return value;}});await h.setup();await assert.rejects(h.owner.start());await assert.rejects(h.owner.beforeBrowserClose());assert.equal(h.owner.seal().receipt.complete,false);
 const end=await running(harness());end.setTime(100000);const before=end.calls.length;await assert.rejects(end.owner.beforeBrowserClose());end.owner.afterBrowserClose();assert.equal(end.calls.length,before);assert.equal(end.owner.seal().receipt.complete,false);
});

test('raw preserves unknown fields and signed deltas until data analyzer independently refuses',async()=>{
 const p={...profile(),unknown:{'2':'two','1':'one',extra:true}},h=await running(harness({send:m=>m==='Profiler.stop'?Promise.resolve({profile:p}):undefined}));await h.owner.finish();const s=h.owner.seal();assert.equal(s.rawJson,JSON.stringify(p));assert.equal(s.receipt.complete,true);assert.throws(()=>analyzeChrome156CpuProfileV2(s.rawJson,s.bindingJson),/profile-shape/);
});

test('raw byte cap, structural caps and malformed stop envelopes refuse without truncation',async()=>{
 for(const reply of [{profile:{...profile(),extra:'x'.repeat(CPU_PROFILE_V2_LIMITS.maxProfileBytes)}},{profile:{...profile(),samples:Array(CPU_PROFILE_V2_LIMITS.maxSamples+1).fill(1)}},{profile:profile(),extra:true},{other:profile()}]){const h=await running(harness({send:m=>m==='Profiler.stop'?Promise.resolve(reply):undefined}));await assert.rejects(h.owner.finish());const s=h.owner.seal();assert.equal(s.receipt.complete,false);assert.equal(s.rawJson,null);assert(h.calls.includes('detach'));}
});

test('elapsed capture deadline refuses even before the watchdog callback receives an event-loop turn',async()=>{
 for(const at of [30000,30001]){const h=await running(harness());h.setTime(at);await assert.rejects(h.owner.finish());const s=h.owner.seal();assert.equal(s.receipt.complete,false);assert.equal(s.receipt.watchdog.expired,true);assert(h.calls.includes('Profiler.stop'));assert(h.calls.includes('detach'));}
});

test('late session creation after immutable unsafe seal still executes release continuation',async()=>{
 const held=deferred(),h=harness({newSession:held.promise,wait:(p,ms,label)=>label==='stock037-cpu-session'?Promise.reject(Error('session attention')):p});await assert.rejects(h.setup());const s=h.owner.seal(),sealed=JSON.stringify(s);assert.equal(s.receipt.unsafeOutstanding,true);held.resolve(h.session);await immediate();assert(h.calls.includes('Profiler.disable'));assert(h.calls.includes('detach'));assert.equal(JSON.stringify(h.owner.seal()),sealed);
});

test('positive-time session/start/stop originals settle before their individual attention deadlines',async()=>{
 const created=deferred(),started=deferred(),stopped=deferred(),h=harness({newSession:created.promise,send:m=>m==='Profiler.start'?started.promise:m==='Profiler.stop'?stopped.promise:undefined});
 const setup=h.setup();h.setTime(2);created.resolve(h.session);await setup;const start=h.owner.start();h.setTime(4);started.resolve({});await start;h.owner.markPublicAck();const finish=h.owner.finish();h.setTime(6);stopped.resolve({profile:profile()});await finish;
 const s=h.owner.seal();assert.equal(s.receipt.complete,true);for(const kind of ['session','start','stop']){const row=s.receipt.owners.find(x=>x.kind===kind);assert(row.settledMs>row.dispatchedMs);assert(row.attentionSettledMs>=row.settledMs);assert(row.attentionSettledMs<row.attentionDeadlineMs);}
});

test('early case deadline clips watchdog and cleanup never resets its remaining deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let time=0;const h=await running(harness({remaining:()=>7-time}));time=7;h.setTime(7);const count=h.calls.length;t.mock.timers.tick(7);await immediate();await assert.rejects(h.owner.beforeBrowserClose());const s=h.owner.seal();assert.equal(h.calls.length,count);assert.equal(s.receipt.watchdog.deadlineMs,7);assert.equal(s.receipt.complete,false);assert.equal(s.receipt.unsafeOutstanding,true);
});

test('canonical retained raw accepts exact byte cap and refuses cap plus one',async()=>{
 const overhead=Buffer.byteLength(JSON.stringify({...profile(),padding:''}));
 for(const extra of [0,1]){const p={...profile(),padding:'x'.repeat(CPU_PROFILE_V2_LIMITS.maxProfileBytes-overhead+extra)},h=await running(harness({send:m=>m==='Profiler.stop'?Promise.resolve({profile:p}):undefined}));if(extra)await assert.rejects(h.owner.finish());else await h.owner.finish();const s=h.owner.seal();assert.equal(s.receipt.complete,!extra);if(!extra)assert.equal(s.receipt.raw.bytes,CPU_PROFILE_V2_LIMITS.maxProfileBytes);else assert.equal(s.rawJson,null);}
});

test('original clock regression cannot produce an admitted complete receipt',async()=>{
 let h;h=await running(harness({send:m=>{if(m==='Profiler.stop')h.setTime(4);}}));h.setTime(5);await h.owner.finish();const s=h.owner.seal();assert.equal(s.receipt.complete,false);
});

test('late stop acknowledgement after attention refusal retains original facts but never eligibility',async()=>{
 const held=deferred(),attention=deferred(),h=await running(harness({send:m=>m==='Profiler.stop'?held.promise:undefined,wait:(p,ms,label)=>label==='stock037-cpu-stop'?attention.promise:p}));const finish=h.owner.finish();void finish.catch(()=>{});h.setTime(5);attention.reject(Error('stop attention'));await assert.rejects(finish);h.setTime(6);held.resolve({profile:profile()});await immediate();const s=h.owner.seal();assert.equal(s.receipt.raw.bytes,Buffer.byteLength(JSON.stringify(profile())));assert.equal(s.receipt.owners.find(x=>x.kind==='stop').status,'fulfilled');assert.equal(s.receipt.owners.find(x=>x.kind==='stop').attentionStatus,'rejected');assert.equal(s.receipt.complete,false);
});

test('stop dispatch before capture deadline does not admit an original stop acknowledgement at or beyond it',async()=>{
 for(const ended of [30000,31000]){const stopped=deferred(),h=await running(harness({send:m=>m==='Profiler.stop'?stopped.promise:undefined}));h.setTime(29000);const finish=h.owner.finish();void finish.catch(()=>{});h.setTime(ended);stopped.resolve({profile:profile()});await assert.rejects(finish);const s=h.owner.seal();assert.equal(s.receipt.watchdog.expired,true);assert.equal(s.receipt.complete,false);assert(h.calls.includes('Profiler.disable'));assert(h.calls.includes('detach'));assert.equal(h.calls.filter(x=>x==='Profiler.stop').length,1);}
});

test('watchdog remains armed while a normal finish holds the sole pending stop original',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const stopped=deferred(),h=await running(harness({send:m=>m==='Profiler.stop'?stopped.promise:undefined}));h.setTime(29000);const finish=h.owner.finish();void finish.catch(()=>{});h.setTime(30000);t.mock.timers.tick(30000);await immediate();stopped.resolve({profile:profile()});await assert.rejects(finish);const s=h.owner.seal();assert.equal(s.receipt.watchdog.expired,true);assert.equal(s.receipt.watchdog.cancelled,true);assert.equal(h.calls.filter(x=>x==='Profiler.stop').length,1);assert.equal(s.receipt.complete,false);
});
