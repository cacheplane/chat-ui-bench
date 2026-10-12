import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const api=await import(process.env.CAPABILITY_TEST_BASELINE??'./receipt.mjs');
const env={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',GITHUB_REPOSITORY:'cacheplane/chat-ui-bench',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),EXPECTED_SHA:'a'.repeat(40)};
const identity={status:'observed',pid:20,ppid:10,pgid:20,sid:20,uid:501,birthSec:1,birthUsec:1,kernelStatus:2};
const empty={status:'observed',lookahead:257,admittedMaximum:256,pidBytes:4,returnedBytes:0,members:[]};
test('exact hosted main identity is admitted',()=>assert.deepEqual(api.admitRuntime(env,'darwin','arm64').sha,env.GITHUB_SHA));
for(const [key,value] of [['GITHUB_ACTIONS','false'],['RUNNER_ENVIRONMENT','self-hosted'],['GITHUB_REPOSITORY','other/repo'],['GITHUB_REF','refs/heads/topic'],['EXPECTED_SHA','b'.repeat(40)],['GITHUB_SHA','x']])test('reject '+key+' contradiction before runtime action',()=>assert.throws(()=>api.admitRuntime({...env,[key]:value},'darwin','arm64'),/Hosted capability admission/));
for(const [platform,arch] of [['linux','arm64'],['darwin','x64']])test('reject '+platform+'/'+arch,()=>assert.throws(()=>api.admitRuntime(env,platform,arch),/Hosted capability admission/));
test('exclusive original detached case authority is required',()=> {
 assert.equal(api.exclusiveCase(identity,10,501),true);
 for(const key of ['pid','ppid','pgid','sid','uid','birthSec'])assert.equal(api.exclusiveCase({...identity,[key]:key==='birthSec'?0:99},10,501),false);
});
test('fresh identity includes birth and actual kernel observation',()=> {
 assert.equal(api.sameIdentity(identity,{...identity,kernelStatus:3}),true);
 assert.equal(api.sameIdentity(identity,{...identity,birthUsec:2}),false);
 assert.equal(api.sameIdentity(identity,{...identity,status:'unknown'}),false);
});
test('scoped empty requires actual complete envelope, not zero return alone',()=> {
 assert.equal(api.scopedEmpty(empty),true);
 for(const value of [{returnedBytes:0},{...empty,status:'unknown'},{...empty,lookahead:256},{...empty,invalidMember:true},{...empty,members:[identity]}])assert.equal(api.scopedEmpty(value),false);
});
test('real display/session metadata is mandatory and finite',()=> {
 const display={status:'observed',onConsole:true,loginDone:true,displayCount:1,displays:[{id:1,x:0,y:0,width:1280,height:800}],main:1};
 assert.equal(api.displaySupported(display),true);
 for(const value of [{...display,onConsole:false},{...display,status:'unknown'},{...display,displayCount:0},{...display,displays:[{id:1,x:0,y:0,width:Infinity,height:800}]}])assert.equal(api.displaySupported(value),false);
});
test('supported receipt requires every original closure and actual empty group',()=> {
 const r={primaryPresent:false,cleanupErrors:[],observerErrors:[],stopRequested:false,expired:false,pending:0,resources:['loopback','loopback-request','browser','context','page'].map(role=>({role,closed:true})),caseExit:{code:0,signal:null},caseClosed:true,ipcFlushed:true,ipcDisconnected:true,spawns:[{exited:true,closed:true,code:0,signal:null,identity}],groups:[empty],display:{status:'observed',onConsole:true,loginDone:true,displayCount:1,displays:[{id:1,x:0,y:0,width:1280,height:800}],main:1},page:{visibility:'visible',focused:true,width:1280,height:800,raf:[1,2]}};
 assert.equal(api.supported(r),true);
 for(const value of [{...r,pending:1},{...r,primaryPresent:true},{...r,cleanupErrors:[false]},{...r,observerErrors:[false]},{...r,expired:true},{...r,stopRequested:true},{...r,resources:r.resources.slice(1)},{...r,resources:r.resources.map(x=>({...x,closed:false}))},{...r,caseClosed:false},{...r,ipcDisconnected:false},{...r,groups:[{...empty,status:'unknown'}]},{...r,spawns:[{...r.spawns[0],signal:'SIGKILL'}]},{...r,page:{...r.page,raf:[2,2]}}])assert.equal(api.supported(value),false);
});
test('exact compact UTF8 receipt boundary and one byte overflow',()=> {
 const overhead=Buffer.byteLength(JSON.stringify({value:''})+'\n');
 assert.equal(Buffer.byteLength(api.serialize({value:'x'.repeat(262144-overhead)})),262144);
 assert.throws(()=>api.serialize({value:'x'.repeat(262145-overhead)}),/Receipt capacity262144/);
 assert.equal(Buffer.byteLength(api.serialize({value:'é'})),15);
});
test('only original exclusive case or direct detached session is an owned group',()=> {
 const own={...identity,pid:10,pgid:10,sid:10,ppid:5};
 assert.equal(api.ownedGroup({pid:20,identity,detached:true},own),true);
 assert.equal(api.ownedGroup({pid:20,identity:{...identity,pgid:10,sid:10},detached:false},own),true);
 for(const row of [{pid:20,identity:{...identity,pgid:5,sid:5},detached:false},{pid:20,identity,detached:false},{pid:20,identity:{...identity,ppid:99},detached:true},{pid:21,identity,detached:true},{pid:20,identity,detached:null}])assert.equal(api.ownedGroup(row,own),false);
});
test('prearmed IPC latch receives immediate reply before send callback',async()=> {
 const {EventEmitter}=await import('node:events');const emitter=new EventEmitter();
 const admit=api.ipcLatch(emitter,'nonce','admit');const flush=api.ipcLatch(emitter,'nonce','flush-ack');
 emitter.emit('message',{type:'admit',nonce:'nonce'});emitter.emit('message',{type:'flush-ack',nonce:'nonce'});
 assert.equal((await admit.promise).type,'admit');assert.equal((await flush.promise).type,'flush-ack');
 admit.remove();flush.remove();assert.equal(emitter.listenerCount('message'),0);
});
test('diagnostic cycles and oversized causes are bounded without losing original falsy values',()=> {
 const error=new AggregateError([],'cycle');error.errors.push(error,false);
 const value=api.diagnostic(error);assert.equal(value.errors[0].type,'unavailable');assert.deepEqual(value.errors[1],{type:'boolean',value:false});
});
test('query256/spawn64 and exact64KiB row inclusive boundaries',()=> {
 const rows=[];for(let i=0;i<256;i++)api.appendQuery(rows,{kind:'group',pid:20,actualResult:empty});
 assert.throws(()=>api.appendQuery(rows,{kind:'group',pid:20,actualResult:empty}),/Query capacity256/);
 const overhead=Buffer.byteLength(JSON.stringify({value:''}));
 api.appendQuery([],{value:'x'.repeat(65536-overhead)});
 assert.throws(()=>api.appendQuery([],{value:'x'.repeat(65537-overhead)}),/Query bytes65536/);
 assert.equal(api.spawnAdmitted(63),true);assert.equal(api.spawnAdmitted(64),false);
});
for(const primary of [false,0,'',null,undefined])test('original falsy primary and independent cleanup stay ordered: '+String(primary),()=> {
 const cleanup=Error('close');const result=api.combineFailure(true,primary,[cleanup]);
 assert.ok(result instanceof AggregateError);assert.equal(result.errors[0],primary);assert.equal(result.errors[1],cleanup);
 assert.equal(api.combineFailure(true,primary,[]),primary);
});
test('unknown source-bound helper result never becomes empty or supported',()=> {
 const q={kind:'group',pid:20,actualResult:{status:'unknown',returnedBytes:1028,lookahead:257,admittedMaximum:256}};
 const rows=[];api.appendQuery(rows,q);assert.deepEqual(JSON.parse(api.serialize(rows))[0],q);assert.equal(api.scopedEmpty(q.actualResult),false);
});
test('checked original observer seam retains exact delegation and no private browser process',async()=> {
 if(process.env.CAPABILITY_TEST_BASELINE)return;
 const source=await readFile(new URL('./spawn-observer.mjs',import.meta.url),'utf8');
 assert.match(source,/Reflect\.apply\(originalSpawn,this,args\)/);
 const run=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 assert.equal(/browser\._|browser\.process\(/.test(run),false);
 assert.equal(/process\.kill\(|\.kill\(/.test(run+source),false);
});
test('original acquisition and closure/report deadlines share one start without reset',()=> {
 assert.deepEqual(api.capabilityBudget(100),{acquisition:60100,closureReport:70100});
 assert.throws(()=>api.capabilityBudget(Infinity));
});
test('unsupported capability may still prove scoped original closure independently',()=> {
 const row={primaryPresent:true,expired:true,stopRequested:true,cleanupErrors:[],observerErrors:[],pending:0,resources:[],spawns:[],caseExit:{code:1,signal:null},caseClosed:true,ipcFlushed:true,ipcDisconnected:true,groupAuthorityComplete:true,groups:[empty],helperCommands:[]};
 assert.equal(api.scopedClosure(row),true);assert.equal(api.supported(row),false);
 for(const bad of [{...row,groupAuthorityComplete:false},{...row,groups:[]},{...row,groups:[{...empty,status:'unknown'}]},{...row,pending:1},{...row,cleanupErrors:[false]},{...row,observerErrors:[false]},{...row,helperCommands:[{closed:false,exited:false}]},{...row,resources:[{role:'loopback-request',closed:false}]}])assert.equal(api.scopedClosure(bad),false);
});
test('original request is owned before awaiting completion and joins its actual close',async()=> {
 const {EventEmitter}=await import('node:events');
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const seam=source.split('// BEGIN originalLoopbackRequest\n')[1]?.split('// END originalLoopbackRequest')[0];assert.ok(seam);
 const originalLoopbackRequest=Function('return ('+seam.trim()+')')();
 const request=new EventEmitter(),response=new EventEmitter();response.statusCode=200;let receiver,args,registered,destroyCalls=0;
 request.destroy=()=>{destroyCalls++;queueMicrotask(()=>request.emit('close'));};
 const owner={};const result=originalLoopbackRequest(function(...a){receiver=this;args=a;queueMicrotask(()=>{a[2](response);response.emit('end');});return request;},owner,'http://127.0.0.1:1',resource=>{registered=resource;});
 assert.ok(registered);assert.equal(receiver,owner);assert.equal(args[0],'http://127.0.0.1:1/');assert.deepEqual(args[1],{agent:false});
 await result;let closed=false;const close=registered.close().then(()=>{closed=true;});assert.equal(closed,false);await close;assert.equal(closed,true);assert.equal(destroyCalls,1);
});
test('actual acquisition timer sends only matching stop and never promotes late acquisition',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const line=source.split('\n').find(x=>x.includes('stopTimer=setTimeout('));assert.ok(line);
 const create=Function('sendCase','performance','setTimeout','budget','child','nonce','let acquisitionComplete=false,expired=false,stopTimer;const failure=()=>{};'+line+';return {acquired(){acquisitionComplete=true;},expired(){return expired;}};');
 for(const acquired of [false,true]) {
  const calls=[];let tick,wait;const budget={acquisition:100,closureReport:10100};
  const state=create(message=>{calls.push(message);return Promise.resolve();},{now:()=>90},(body,delay)=>{tick=body;wait=delay;return 1;},budget,{connected:true},'actual-nonce');
  assert.equal(wait,10);if(acquired)state.acquired();tick();await Promise.resolve();
  assert.equal(state.expired(),!acquired);assert.deepEqual(calls,acquired?[]:[{type:'stop',nonce:'actual-nonce'}]);
 }
});
test('actual owned deadline retains pending original and exact falsy late failure until settlement',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const seam=source.split('// BEGIN ownedDeadline\n')[1]?.split('// END ownedDeadline')[0];assert.ok(seam);
 const pending=new Set(),lateErrors=[];
 const owned=Function('pending','lateErrors','performance','setTimeout','clearTimeout','let deadline=0,expired=false;'+seam+';return owned;')(pending,lateErrors,performance,setTimeout,clearTimeout);
 let release;const original=new Promise((_,reject)=>{release=()=>reject(false);});
 const running=owned(()=>original,performance.now()+10);
 await assert.rejects(running,/operation remains owned/);assert.equal(pending.size,1);assert.deepEqual(lateErrors,[]);
 release();await Promise.allSettled([...pending]);await Promise.resolve();assert.equal(pending.size,0);assert.deepEqual(lateErrors,[false]);
});
test('actual request retains original falsy error and never claims EOF on early close',async()=> {
 const {EventEmitter}=await import('node:events');const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const seam=source.split('// BEGIN originalLoopbackRequest\n')[1]?.split('// END originalLoopbackRequest')[0];assert.ok(seam);
 const originalLoopbackRequest=Function('return ('+seam.trim()+')')();
 for(const value of [false,0,null,undefined]) {
  const request=new EventEmitter();let resource;request.destroy=()=>queueMicrotask(()=>request.emit('close'));
  const completion=originalLoopbackRequest(()=>request,null,'http://127.0.0.1:1',r=>{resource=r;});
  request.emit('error',value);try{await completion;assert.fail('Expected original failure');}catch(error){assert.equal(error,value);}
  await resource.close();
 }
 const request=new EventEmitter();request.destroy=()=>{};let resource;
 const completion=originalLoopbackRequest(()=>request,null,'http://127.0.0.1:1',r=>{resource=r;});
 request.emit('close');await assert.rejects(completion,/closed before EOF/);await resource.close();
});
test('whole original observer seam delegates once and retains held query and errorMonitor without swallowing',async()=> {
 const {EventEmitter,errorMonitor}=await import('node:events');
 const source=await readFile(new URL('./spawn-observer.mjs',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('const originalSpawn=')).replace('export function installObserver','function installObserver');
 const actual=new EventEmitter();Object.assign(actual,{pid:20,spawnfile:'actual-public-file',spawnargs:['actual-public-file','arg']});
 let calls=0,receiver,args,release;const original=function(...a){calls++;receiver=this;args=a;return actual;};
 const fakeChildProcess={spawn:original},fakeProcess={pid:10,getuid:()=>501};
 const installObserver=Function('childProcess','syncBuiltinESMExports','errorMonitor','validIdentity','spawnAdmitted','diagnostic','process',body+';return installObserver;')(fakeChildProcess,()=>{},errorMonitor,api.validIdentity,api.spawnAdmitted,api.diagnostic,fakeProcess);
 const query=new Promise(resolve=>{release=resolve;});let queryArgs;
 const observer=installObserver((...a)=>{queryArgs=a;return query;});
 const options={detached:true};const owner={};assert.equal(Reflect.apply(fakeChildProcess.spawn,owner,['actual-public-file',['arg'],options]),actual);
 assert.equal(calls,1);assert.equal(receiver,owner);assert.equal(args[2],options);assert.deepEqual(queryArgs,['pid',20]);assert.equal(observer.snapshot().pending,1);
 let joined=false;const barrier=observer.barrier().then(()=>{joined=true;});await Promise.resolve();assert.equal(joined,false);
 release(identity);await barrier;actual.emit('exit',0,null);actual.emit('close',0,null);
 const snapshot=observer.snapshot();assert.equal(snapshot.rows[0].detached,true);assert.equal(snapshot.rows[0].closed,true);assert.deepEqual(snapshot.rows[0].identity,identity);
 assert.throws(()=>actual.emit('error',false));assert.equal(observer.snapshot().poisoned,true);assert.deepEqual(observer.snapshot().originalErrors,[{type:'boolean',value:false}]);
 await assert.rejects(observer.barrier(),error=>error instanceof AggregateError&&Object.is(error.errors[0],false));
 observer.restore();assert.equal(fakeChildProcess.spawn,original);
});
test('actual command source retains bounded original byte prefix before close and after timeout/overflow/decode failure',async()=> {
 const {EventEmitter}=await import('node:events');const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const seam=source.split('// BEGIN originalCommand\n')[1]?.split('// END originalCommand')[0];assert.ok(seam);
 const prefix=source.split('// BEGIN retainCommandBytes\n')[1]?.split('// END retainCommandBytes')[0];
 const retainCommandBytes=prefix?Function('return ('+prefix.trim()+')')():null;
 for(const mode of ['pending','overflow','invalid-utf8','falsy-error']) {
  const child=new EventEmitter();Object.assign(child,{pid:20,stdout:new EventEmitter(),stderr:new EventEmitter()});const commands=[];let release;
  const originalTasks=[];const owned=body=>{const task=body();originalTasks.push(task);return mode==='pending'?Promise.race([task,new Promise((_,reject)=>{release=()=>reject(Error('Controlled original timeout'));})]):task;};
  const command=Function('commands','originalSpawn','owned','diagnostic','retainCommandBytes',seam+';return command;')(commands,()=>child,owned,api.diagnostic,retainCommandBytes);
  const running=command('original-helper',['group','20']);const observed=running.then(()=>({ok:true}),error=>({error}));
  const bytes=mode==='overflow'?Buffer.alloc(65537,97):mode==='invalid-utf8'?Buffer.from([0xff]):Buffer.from('original-prefix');
  child.stdout.emit('data',bytes);assert.equal(commands[0].stdoutPrefixBase64,bytes.subarray(0,65536).toString('base64'));
  assert.equal(commands[0].stdoutBytes,bytes.length);assert.equal(commands[0].stdoutPrefixBytes,Math.min(65536,bytes.length));assert.equal(commands[0].stdoutOmittedBytes,Math.max(0,bytes.length-65536));
  if(mode==='pending'){release();assert.ok((await observed).error);assert.equal(commands[0].closed,false);assert.equal(commands[0].stdout,undefined);}
  if(mode==='falsy-error')child.emit('error',false);
  child.emit('exit',0,null);child.emit('close',0,null);await Promise.allSettled(originalTasks);const result=await observed;
  assert.equal(commands[0].closed,true);
  if(mode!=='pending')assert.ok(result.error);
  assert.equal(commands[0].stdoutPrefixBase64,bytes.subarray(0,65536).toString('base64'));
  if(mode==='invalid-utf8')assert.equal(commands[0].decodingStatus,'invalid-utf8');
  if(mode==='falsy-error')assert.deepEqual(commands[0].originalErrors,[{type:'boolean',value:false}]);
 }
});
test('actual Node runtime guard precedes any action and bounded case prefixes share 64KiB',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const line=source.split('\n').find(x=>x.includes("assert.equal(process.version,'v24.20.0'"));assert.ok(line);
 const check=Function('assert','process',line);check(assert,{version:'v24.20.0'});assert.throws(()=>check(assert,{version:'v24.19.0'}),/Actual capability Node runtime/);
 assert.ok(source.indexOf(line)<source.indexOf('const originalSpawn='));
 const prefix=source.split('// BEGIN retainCommandBytes\n')[1]?.split('// END retainCommandBytes')[0];assert.ok(prefix);
 const retainCommandBytes=Function('return ('+prefix.trim()+')')();const row={stdoutBytes:0,stderrBytes:0,stdoutPrefixBase64:'',stderrPrefixBase64:''};
 retainCommandBytes(row,'stdout',Buffer.alloc(32768,97));retainCommandBytes(row,'stderr',Buffer.alloc(32769,98),65536-row.stdoutPrefixBytes);
 assert.equal(row.stdoutPrefixBytes+row.stderrPrefixBytes,65536);assert.equal(row.stderrOmittedBytes,1);assert.equal(Buffer.from(row.stderrPrefixBase64,'base64').length,32768);
});
for(const [label,childQueries,expected] of [
 ['closed unavailable positive',[{command:{closed:true,exited:true}}],true],
 ['child helper lacks exit',[{command:{closed:true,exited:false}}],false],
 ['child helper lacks close',[{command:{closed:false,exited:true}}],false],
 ['missing child ledger',undefined,false],
 ['malformed child ledger',{},false],
 ['malformed helper row',[null],false],
 ['missing helper lifecycle',[{}],false],
 ['sparse child ledger',Array(1),false],
 ['exact combined query256',Array.from({length:255},()=>({command:{closed:true,exited:true}})),true],
 ['combined query257',Array.from({length:256},()=>({command:{closed:true,exited:true}})),false]
])test('actual final construction merges every original helper: '+label,async()=> {
 const source=await readFile(process.env.CAPABILITY_CLOSURE_SOURCE??new URL('./run.mjs',import.meta.url),'utf8');
 const seam=source.split('// BEGIN finalClosureConstruction\n')[1]?.split('// END finalClosureConstruction')[0];assert.ok(seam);
 const receipt={child:{primaryPresent:true,cleanupErrors:[],observerErrors:[],resources:[],spawns:[],pending:0,queries:childQueries},groups:[empty],groupAuthorityComplete:true};
 const lifecycle={caseExit:{code:1,signal:null},caseClosed:true,ipcFlushed:true,ipcDisconnected:true};
 const queries=[{command:{closed:true,exited:true}}],pending=new Set();
 const closure=Function('receipt','lifecycle','queries','pending',seam+';return closure;')(receipt,lifecycle,queries,pending);
 assert.equal(api.scopedClosure(closure),expected);
 if(expected)assert.equal(closure.helperCommands.length,queries.length+childQueries.length);
});
for(const closureStatus of ['unknown','observed-scoped-resources-closed'])test('actual publication fallback retains full scoped closure: '+closureStatus,async()=> {
 const source=await readFile(process.env.CAPABILITY_CLOSURE_SOURCE??new URL('./run.mjs',import.meta.url),'utf8');const seam=source.split('// BEGIN publicationFallback\n')[1]?.split('// END publicationFallback')[0];assert.ok(seam);
 const receipt={child:{cleanupErrors:[],observerErrors:[],resources:[],spawns:[],pending:0,queries:[{command:{closed:true,exited:closureStatus!=='unknown'}}]},groups:[empty],groupAuthorityComplete:true},pending=new Set(),lifecycle={caseClosed:true,caseExit:{code:1,signal:null},ipcFlushed:true,ipcDisconnected:true},logs=[];
 const construction=source.split('// BEGIN finalClosureConstruction\n')[1]?.split('// END finalClosureConstruction')[0];assert.ok(construction);
 const closure=Function('receipt','lifecycle','queries','pending',construction+';return closure;')(receipt,lifecycle,[{command:{closed:true,exited:true}}],pending);
 receipt.closureStatus=api.scopedClosure(closure)?'observed-scoped-resources-closed':'unknown';assert.equal(receipt.closureStatus,closureStatus);
 Function('receipt','pending','lifecycle','console','diagnostic','error',seam)(receipt,pending,lifecycle,{error:value=>logs.push(JSON.parse(value))},api.diagnostic,false);
 assert.equal(logs[0].closureStatus,closureStatus);assert.equal(logs[0].originalScopedClosureUnknown,closureStatus==='unknown');assert.deepEqual(logs[0].publication,{type:'boolean',value:false});
 assert.equal(receipt.status,closureStatus==='unknown'?'failed-uncontained':'unavailable');
});
