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
 Function('receipt','pending','lifecycle','console','diagnostic','caseNotAttempted','error',seam)(receipt,pending,lifecycle,{error:value=>logs.push(JSON.parse(value))},api.diagnostic,api.caseNotAttempted??(()=>false),false);
 assert.equal(logs[0].closureStatus,closureStatus);assert.equal(logs[0].originalScopedClosureUnknown,closureStatus==='unknown');assert.deepEqual(logs[0].publication,{type:'boolean',value:false});
 assert.equal(receipt.status,closureStatus==='unknown'?'failed-uncontained':'unavailable');
});

// Offline source-bound controls. Synthetic audited bytes are not Apple source authenticity.
const syntheticAudited=[
 {path:'libsyscall/wrappers/libproc/libproc.c',signature:'int fixture_one(void)',digest:'344db0ea4477eabfa640529dabe4a4535c0f17243e6776479477b680037079ca'},
 {path:'bsd/kern/proc_info.c',signature:'int fixture_two(void)',digest:'5373334fe6cbffd381c449c2ad7f0ce7e1326c0323a8ae714bf721e7715f038c'}
];
const syntheticText=index=>'\n'+syntheticAudited[index].signature+'\n{\n return 0;\n}\n';
async function primaryFixture(fetchOriginal,options={}) {
 const {createHash}=await import('node:crypto');const {join}=await import('node:path');
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
 const start=source.indexOf('async function primarySources('),end=source.indexOf('// BEGIN originalLoopbackRequest',start);assert.ok(start>=0&&end>start);
 const writes=[];const owners=[];
 const owned=body=>{const task=Promise.resolve().then(body);owners.push(task);return options.rejectFirstOwned&&owners.length===1?Promise.race([task,Promise.reject(false)]):task;};
 const writeFile=async(path,bytes,args)=>{writes.push({path,bytes:Buffer.from(bytes),args});};
 const fact=async path=>{const row=writes.find(x=>x.path===path);return {path,byteLength:row.bytes.length,sha256:createHash('sha256').update(row.bytes).digest('hex')};};
 const primarySources=Function('assert','owned','fetch','audited','createHash','writeFile','fact','join','diagnostic','combineFailure','"use strict";'+source.slice(start,end)+';return primarySources;')(assert,owned,fetchOriginal,syntheticAudited,createHash,writeFile,fact,join,api.diagnostic,api.combineFailure);
 const attempts=[];let result,present=false,error;
 try{result=await primarySources(options.kernel??'Darwin root:xnu-12377.161.14~5/RELEASE','/controlled',attempts);}catch(value){present=true;error=value;}
 options.settle?.();await Promise.allSettled(owners);return {attempts,writes,result,present,error};
}
for(const [status,index] of [[404,0],[503,1]])test('primary response records original URL/status/index before failure '+index,async()=> {
 const calls=[];let cancels=0;
 function fetchOriginal(url,options){'use strict';calls.push({receiver:this,url,options});if(calls.length-1===index)return new Response(new ReadableStream({cancel(){cancels++;}}),{status});return new Response(syntheticText(0));}
 const value=await primaryFixture(fetchOriginal);assert.equal(value.present,true);assert.equal(calls.length,index+1);assert.equal(cancels,1);
 assert.equal(value.attempts.length,index+1);const failed=value.attempts[index];assert.equal(failed.index,index);assert.equal(failed.status,status);assert.equal(failed.ok,false);assert.equal(failed.responsePresent,true);assert.equal(failed.bodyDisposition,'cancelled');assert.equal(failed.originalFailurePresent,true);
 assert.equal(failed.requestedUrl,'https://raw.githubusercontent.com/apple-oss-distributions/xnu/xnu-12377.161.14/'+syntheticAudited[index].path);
 for(const call of calls){assert.equal(call.receiver,undefined);assert.deepEqual(call.options,{redirect:'error'});}
 if(index===1){assert.equal(value.attempts[0].bodyDisposition,'read-eof');assert.ok(value.attempts[0].sourceFact);assert.equal(value.writes.length,1);}
});
test('primary failed HTTP absent body remains explicit and no source is written',async()=> {
 const value=await primaryFixture(()=>new Response(null,{status:404}));assert.equal(value.present,true);assert.equal(value.attempts[0].bodyDisposition,'absent');assert.equal(value.writes.length,0);
});
for(const failure of [false,0,'',null,undefined])test('primary fetch rejection retains original falsy cause '+String(failure),async()=> {
 const value=await primaryFixture(()=>Promise.reject(failure));assert.equal(value.present,true);assert.equal(value.error,failure);assert.equal(value.attempts.length,1);assert.equal(value.attempts[0].responsePresent,false);assert.equal(value.attempts[0].status,null);assert.equal(value.attempts[0].originalFailurePresent,true);assert.deepEqual(value.attempts[0].originalFailure,api.diagnostic(failure));
});
test('primary non-ok body cancellation failure retains assertion and falsy cleanup independently',async()=> {
 let count=0;const value=await primaryFixture(()=>new Response(new ReadableStream({cancel(){count++;return Promise.reject(false);}}),{status:404}));
 assert.equal(count,1);assert.ok(value.error instanceof AggregateError);assert.ok(value.error.errors[0] instanceof assert.AssertionError);assert.equal(value.error.errors[1],false);assert.equal(value.attempts[0].bodyDisposition,'unknown');assert.deepEqual(value.attempts[0].cleanupErrors,[{type:'boolean',value:false}]);
});
test('primary original read and release-lock failures retain exact falsy identities/order',async()=> {
 let reads=0,cancels=0,releases=0;const response=new Response('body');const original=response.body.getReader.bind(response.body);
 Object.defineProperty(response.body,'getReader',{value(){const reader=original();const actualRead=reader.read.bind(reader),actualCancel=reader.cancel.bind(reader),actualRelease=reader.releaseLock.bind(reader);
  reader.read=async()=>{await actualRead();reads++;throw false;};reader.cancel=async()=>{await actualCancel();cancels++;};reader.releaseLock=()=>{actualRelease();releases++;throw 0;};return reader;}});
 const value=await primaryFixture(()=>response);assert.equal(reads,1);assert.equal(cancels,1);assert.equal(releases,1);assert.ok(value.error instanceof AggregateError);assert.equal(value.error.errors[0],false);assert.equal(value.error.errors[1],0);assert.deepEqual(value.attempts[0].originalFailure,{type:'boolean',value:false});assert.deepEqual(value.attempts[0].cleanupErrors,[{type:'number',value:0}]);
});
test('primary errored stream preserves null read and independent null cancellation rejection',async()=> {
 const response=new Response(new ReadableStream({start(controller){controller.error(null);}}));const value=await primaryFixture(()=>response);assert.equal(value.present,true);assert.ok(value.error instanceof AggregateError);assert.equal(value.error.errors[0],null);assert.equal(value.error.errors[1],null);assert.equal(value.attempts[0].originalFailurePresent,true);
});
test('primary complete synthetic EOF and exact digest gate preserve both matching URLs',async()=> {
 let index=0;const value=await primaryFixture(()=>new Response(syntheticText(index++)));assert.equal(value.present,false);assert.equal(value.result.length,2);assert.equal(value.writes.length,2);assert.equal(value.attempts.length,2);assert.ok(value.attempts.every(row=>row.bodyDisposition==='read-eof'&&row.sourceFact&&row.cleanupErrors.length===0));
});
test('primary altered synthetic function never passes unchanged digest gate',async()=> {
 const value=await primaryFixture(()=>new Response(syntheticText(0).replace('return 0','return 1')));assert.equal(value.present,true);assert.match(value.error.message,/semantics changed/);assert.equal(value.writes.length,0);
});
test('primary oversized original URL rejects before the original fetch dispatch',async()=> {
 let calls=0;const value=await primaryFixture(()=>{calls++;return new Response(null,{status:404});},{kernel:'xnu-'+('1'.repeat(4096))+'.1~'});assert.equal(calls,0);assert.equal(value.present,true);
});
for(const length of [262144,262145])test('primary response original inclusive byte cap '+length,async()=> {
 let cancels=0;const first=Buffer.from(syntheticText(0));const data=Buffer.concat([first,Buffer.alloc(length-first.length,32)]);let index=0;
 const value=await primaryFixture(()=>index++===0?new Response(new ReadableStream({start(c){c.enqueue(data);c.close();},cancel(){cancels++;}})):new Response(syntheticText(1)));
 if(length===262144){assert.equal(value.present,false);assert.equal(value.writes[0].bytes.length,length);}else{assert.equal(value.present,true);assert.match(value.error.message,/bytes262144/);assert.equal(value.writes.length,0);assert.equal(value.attempts[0].originalFailurePresent,true);}
});
function preCaseReceipt(){return {status:'unavailable',caseSpawnAttempted:false,primaryPresent:true,oldLocalClosure:'UNKNOWN',pending:0,queries:[],lifecycle:{caseClosed:false,caseExit:null,ipcFlushed:false,ipcDisconnected:false},commands:[{exited:true,closed:true,code:0,signal:null}],trackedSourceClosed:true,primarySourceAttempts:[{index:0,fetchCallAttempted:true,fetchSettled:true,responsePresent:true,status:404,ok:false,bodyDisposition:'cancelled',originalFailurePresent:true,cleanupErrors:[]}]};}
async function classifyCurrent(receipt,closure={}) {
 if(api.classifyCapabilityReceipt)return api.classifyCapabilityReceipt(receipt,closure);
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');const start=source.indexOf('  receipt.capabilityStatus='),end=source.indexOf('  try{const text=serialize',start);assert.ok(start>=0&&end>start);
 Function('receipt','scopedClosure','closure',source.slice(start,end))(receipt,api.scopedClosure,closure);return receipt;
}
test('explicit no-case preparation failure is unavailable without escaped-case claim',async()=> {
 const row=preCaseReceipt();const value=await classifyCurrent(row);assert.equal(value.status,'failed-preparation-case-not-attempted');assert.equal(value.capabilityStatus,'unavailable');assert.equal(value.caseClosureStatus,'not-applicable-case-not-attempted');assert.equal(value.overallResourceClosure,'unknown');assert.equal(value.preparationOperationStatus,'settled-observed');assert.equal(row.oldLocalClosure,'UNKNOWN');
});
for(const [name,change] of [['missing marker',r=>delete r.caseSpawnAttempted],['attempted marker',r=>r.caseSpawnAttempted=true],['PID present',r=>r.casePid=20],['child present',r=>r.child={}],['IPC progress',r=>r.lifecycle.ipcFlushed=true],['group facts',r=>r.groups=[]],['query admission',r=>r.queries=[{}]],['browser resource facts',r=>r.resources=[]]])test('no-case branch rejects original contradiction '+name,async()=> {
 const r=preCaseReceipt();change(r);const value=await classifyCurrent(r);assert.notEqual(value.caseClosureStatus,'not-applicable-case-not-attempted');assert.equal(value.closureStatus,'unknown');assert.equal(value.capabilityStatus,'unavailable');
});
for(const [name,change] of [['pending',r=>r.pending=1],['command unclosed',r=>r.commands[0].closed=false],['source unclosed',r=>r.trackedSourceClosed=false],['unknown body',r=>r.primarySourceAttempts[0].bodyDisposition='unknown'],['cleanup failure',r=>r.primarySourceAttempts[0].cleanupErrors=[false]],['missing HTTP ledger',r=>delete r.primarySourceAttempts],['HTTP task unresolved',r=>r.primarySourceAttempts[0].fetchSettled=false]])test('pre-case original preparation remains unknown '+name,async()=> {
 const r=preCaseReceipt();change(r);const value=await classifyCurrent(r);assert.equal(value.status,'failed-preparation-case-not-attempted');assert.equal(value.preparationOperationStatus,'unknown');assert.equal(value.overallResourceClosure,'unknown');
});
test('original case spawn attempt marker is recorded before genuine synchronous falsy rejection',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');const existing=source.slice(source.indexOf('  child=originalSpawn('),source.indexOf('  stopTimer=setTimeout(',source.indexOf('  child=originalSpawn(')));
 const seam=source.includes('// BEGIN originalCaseSpawn')?source.split('// BEGIN originalCaseSpawn\n')[1].split('// END originalCaseSpawn')[0]:existing;const receipt={caseSpawnAttempted:false};let calls=0;
 const run=Function('receipt','originalSpawn','process','source','root','nonce','binding','let child=null;'+seam);const failure=false;
 assert.throws(()=>run(receipt,()=>{calls++;throw failure;},{execPath:'selected-node',env:{}},'original-source','root','nonce',{}),error=>Object.is(error,failure));assert.equal(calls,1);assert.equal(receipt.caseSpawnAttempted,true);
});

test('primary EOF release-lock failure precedes original source digest/publication',async()=> {
 let releases=0;const response=new Response(syntheticText(0));const original=response.body.getReader.bind(response.body);
 Object.defineProperty(response.body,'getReader',{value(){const reader=original(),release=reader.releaseLock.bind(reader);reader.releaseLock=()=>{release();releases++;throw false;};return reader;}});
 const value=await primaryFixture(()=>response);assert.equal(releases,1);assert.ok(value.error instanceof AggregateError);assert.equal(value.error.errors[0],false);assert.equal(value.writes.length,0);assert.equal(value.attempts[0].sourceFact,null);assert.deepEqual(value.attempts[0].cleanupErrors,[{type:'boolean',value:false}]);
});
for(const flag of [false,undefined])test('preparation settlement rejects missing or contradictory original fetch-call flag '+String(flag),async()=> {
 const r=preCaseReceipt();r.primarySourceAttempts[0].fetchCallAttempted=flag;assert.equal((await classifyCurrent(r)).preparationOperationStatus,'unknown');
});

test('late original fetch response retains actual status and cannot masquerade as a rejected fetch',async()=> {
 let resolve;const fetchResult=new Promise(done=>{resolve=done;});let cancels=0;const response=new Response(new ReadableStream({cancel(){cancels++;}}),{status:404});
 const value=await primaryFixture(()=>fetchResult,{rejectFirstOwned:true,settle(){resolve(response);}});
 assert.equal(value.present,true);assert.equal(value.error,false);assert.equal(value.attempts[0].fetchSettled,true);assert.equal(value.attempts[0].responsePresent,true);assert.equal(value.attempts[0].status,404);assert.equal(value.attempts[0].bodyDisposition,'not-attempted');assert.equal(cancels,0);
 const r=preCaseReceipt();r.primarySourceAttempts=value.attempts;assert.equal((await classifyCurrent(r)).preparationOperationStatus,'unknown');
 await response.body.cancel();assert.equal(cancels,1); // Owned fixture cleanup, not a claimed production cancellation.
});
for(const bytes of [4096,4097])test('original primary dispatched URL inclusive boundary '+bytes,async()=> {
 const fixed='https://raw.githubusercontent.com/apple-oss-distributions/xnu/xnu-'+'.1/'+syntheticAudited[0].path;
 const kernel='xnu-'+('1'.repeat(bytes-Buffer.byteLength(fixed)))+'.1~';let calls=0;
 const value=await primaryFixture(url=>{calls++;assert.equal(Buffer.byteLength(url),bytes);return new Response(null,{status:404});},{kernel});
 assert.equal(value.present,true);assert.equal(calls,bytes===4096?1:0);
 if(bytes===4096)assert.equal(Buffer.byteLength(value.attempts[0].requestedUrl),4096);
});

test('actual final source check refreshes pending ownership before no-case classification',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');const start=source.indexOf('  try{receipt.after=await trackedFacts(root)'),end=source.indexOf('  // BEGIN finalClosureConstruction',start);assert.ok(start>=0&&end>start);
 const row=preCaseReceipt(),pending=new Set(),lateErrors=[];let settle;const held=new Promise(done=>{settle=done;});const before=[];
 const run=Function('receipt','trackedFacts','root','before','assert','diagnostic','pending','lateErrors','return (async()=>{'+source.slice(start,end)+'})();');
 await run(row,async()=>{pending.add(held);return before;},'controlled',before,assert,api.diagnostic,pending,lateErrors);
 assert.equal(row.pending,1);assert.equal((await classifyCurrent(row)).preparationOperationStatus,'unknown');settle();await held;pending.delete(held);
});
test('actual final source rejection keeps original falsy diagnostic and cannot settle preparation',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');const start=source.indexOf('  try{receipt.after=await trackedFacts(root)'),end=source.indexOf('  // BEGIN finalClosureConstruction',start);
 const row=preCaseReceipt();const run=Function('receipt','trackedFacts','root','before','assert','diagnostic','pending','lateErrors','return (async()=>{'+source.slice(start,end)+'})();');
 await run(row,()=>Promise.reject(false),'controlled',[],assert,api.diagnostic,new Set(),[]);assert.deepEqual(row.finalSourceError,{type:'boolean',value:false});assert.equal((await classifyCurrent(row)).preparationOperationStatus,'unknown');
});
test('actual no-case publication failure preserves phase distinction and unknown overall resource closure',async()=> {
 const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');const seam=source.split('// BEGIN publicationFallback\n')[1].split('// END publicationFallback')[0];const row=preCaseReceipt();Object.assign(row,await classifyCurrent(row));const logs=[];
 Function('receipt','pending','console','diagnostic','caseNotAttempted','error',seam)(row,new Set(),{error:text=>logs.push(JSON.parse(text))},api.diagnostic,api.caseNotAttempted,false);
 assert.equal(logs[0].status,'failed-preparation-case-not-attempted');assert.equal(logs[0].caseClosureStatus,'not-applicable-case-not-attempted');assert.equal(logs[0].overallResourceClosure,'unknown');assert.deepEqual(logs[0].publication,{type:'boolean',value:false});
});
for(const [name,change] of [['sparse command',r=>r.commands=Array(1)],['sparse HTTP row',r=>r.primarySourceAttempts=Array(1)],['HTTP status contradiction',r=>r.primarySourceAttempts[0].ok=true],['HTTP boolean status',r=>r.primarySourceAttempts[0].status=true],['misordered HTTP index',r=>r.primarySourceAttempts[0].index=1]])test('preparation settlement refuses malformed original ledger '+name,async()=> {
 const row=preCaseReceipt();change(row);assert.equal((await classifyCurrent(row)).preparationOperationStatus,'unknown');
});
test('classifying a closed attempted unavailable case preserves existing scoped proof independently',async()=> {
 const closure={cleanupErrors:[],observerErrors:[],pending:0,resources:[],spawns:[],caseExit:{code:1,signal:null},caseClosed:true,ipcFlushed:true,ipcDisconnected:true,groupAuthorityComplete:true,groups:[empty],helperCommands:[]};
 const result=await classifyCurrent({status:'unavailable',caseSpawnAttempted:true},closure);assert.equal(result.status,'unavailable');assert.equal(result.closureStatus,'observed-scoped-resources-closed');assert.equal(result.caseClosureStatus,'observed-scoped-resources-closed');assert.equal(result.capabilityStatus,'unavailable');assert.equal(result.overallResourceClosure,'unknown');
});
test('explicit no-case receipt cannot adopt an independently closed attempted-case argument',async()=> {
 const closure={cleanupErrors:[],observerErrors:[],pending:0,resources:[],spawns:[],caseExit:{code:1,signal:null},caseClosed:true,ipcFlushed:true,ipcDisconnected:true,groupAuthorityComplete:true,groups:[empty],helperCommands:[]};
 assert.equal(api.scopedClosure(closure),true);
 const value=await classifyCurrent(preCaseReceipt(),closure);assert.equal(value.status,'failed-preparation-case-not-attempted');assert.equal(value.closureStatus,'unknown');assert.equal(value.caseClosureStatus,'not-applicable-case-not-attempted');assert.equal(value.overallResourceClosure,'unknown');assert.equal(value.capabilityStatus,'unavailable');
});
