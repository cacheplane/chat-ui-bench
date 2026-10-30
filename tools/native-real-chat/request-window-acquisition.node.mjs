import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAuthoredRequestWindowWorkerResultV1 as project} from './request-window-result.mjs';
import {REQUEST_WINDOW_RECIPE as recipe,REQUEST_WINDOW_RUN_ID as runId,createRequestWindowInput,createRequestWindowGesture} from './request-window-core.mjs';

function authored(){
 const binding={nonce:'a'.repeat(32),requestSha256:'b'.repeat(64),manifestSha256:'c'.repeat(64),sourceRevision:'d'.repeat(40)},input=createRequestWindowInput(binding.nonce),before={top:3000,height:100,extent:10000,x:0,y:0,width:100,rectHeight:100};
 const marks=Object.fromEntries(['start','end'].map((phase,i)=>[phase,`native:${runId}:history100-up:${phase}:${i?'b':'a'}${'0'.repeat(15)}`]));
 const authority={captureQualified:false,qualification:false,nativeSupported:false,clockAdmission:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false};
 const trace={bytes:1,sha256:'e'.repeat(64),identity:{dev:1,ino:2,size:1,mtimeMs:3,ctimeMs:4}};
 const phase={policy:'source-owned-user-timing-phase-inventory-diagnostic-v6',status:'phase-registry-inventory-diagnostic',wholeInputFailure:null,reason:null,runId,phaseId:'history100-up',targetId:'cdp-target',input:{bytes:trace.bytes,sha256:trace.sha256,packetManifestSHA256:'1'.repeat(64),transitionManifestSHA256:'2'.repeat(64)},counters:{candidates:2,outsidePrefix:0,readAttempts:1,packets:2},authority,rows:['start','end'].map((p,i)=>({phase:p,name:marks[p],packetIndex:i+1,sequenceIndex:0,intervalVersion:1,eventStart:2,eventValueStart:3,eventEnd:4,bodySHA256:'3'.repeat(64),annotationIndex:null,definitionIndex:null,nameSource:'literal',clockId:null,clockSource:'unavailable',trackUuid:null,trackSource:'unavailable',machineStatus:'absent',machineId:null,sequenceId:'1',rawTimestamp:null,timestampStatus:'absent',representation:'event_name'}))};
 const fixture={projection:'f'.repeat(64)},request={nonce:binding.nonce,inputRecipe:recipe,input,fixture,runtime:{executablePath:'/browser'},mode:'real-chat-stock033-request-window-scroll-v1',fixtureProfile:'native-history100-v1'},requestFact={sha256:binding.requestSha256},custody={inputRecipe:recipe,fixtureProfile:request.fixtureProfile,manifestSha256:binding.manifestSha256,sourceRevision:binding.sourceRevision};
 const pipe=()=>({bytes:0,chunks:0,end:true,close:true,error:false,writerClosed:true});
 const value={status:'diagnostic',inputRecipe:recipe,captureStatus:'closed',phase,input:{schema:1,inputRecipe:recipe,request:binding,selected:{frameId:'frame',loaderId:'loader',executionContextUniqueId:'context',generation:1,backendNodeId:4},input,geometry:{before,after:{...before,top:1400}},issued:{method:'Input.synthesizeScrollGesture',params:createRequestWindowGesture(input,before),state:'fulfilled',responseShape:'empty-object'},marks},nativeSupported:false,clock:'not_evaluated',population:'not_evaluated',FPS:null,counters:{runtimeCalls:78,runtimeBytes:2000,eventRows:3,eventBytes:1000,originalDetach:{state:'fulfilled',health:true}},fixture,fixtureProfile:request.fixtureProfile,physical:{pid:456,executable:'/browser',argv:['/browser','--headless'],exit:{code:0,signal:null},close:{code:0,signal:null},browserGroupAbsent:true,pipes:[pipe(),pipe()],earlySpawnHook:true},collection:{trace,marks:{...marks}}};
 return {value,request,requestFact,custody,raw:()=>Buffer.from(JSON.stringify(value)+'\n')};
}
test('authored closed worker schema preserves exact bound gesture, trace and owner phase',()=>{
 const f=authored(),result=project(f.raw(),f.request,f.requestFact,f.custody);
 assert.equal(result.analysisEligible,true);assert.equal(result.physicalPid,456);assert.deepEqual(result.trace,f.value.collection.trace);
});
for(const mutate of [
 f=>f.value.extra=true,f=>f.value.FPS=60,f=>f.value.fixtureProfile='native-history1000-v1',
 f=>f.value.input.request.requestSha256='0'.repeat(64),f=>f.value.input.selected.loaderId='',
 f=>f.value.input.geometry.after.top=3000,f=>f.value.input.geometry.after.extent++,
 f=>f.value.input.issued.params={...f.value.input.issued.params,speed:801},
 f=>f.value.input.marks.start=`native:${runId}:history100-up:start:${'9'.repeat(16)}`,
 f=>f.value.counters.runtimeCalls=81,f=>f.value.counters.originalDetach.health=false,
 f=>f.value.physical.pipes[0].end=false,f=>f.value.collection.trace.identity.size=2,
 f=>f.value.phase.authority.qualification=true,f=>f.value.phase.input.sha256='0'.repeat(64),
 f=>f.value.phase.rows[0].name=`native:${runId}:history100-up:start:${'8'.repeat(16)}`,
])test('closed worker custody refuses mutation '+mutate,()=>{const f=authored();mutate(f);assert.throws(()=>project(f.raw(),f.request,f.requestFact,f.custody));});

test('request-window acquisition has an original-return capability that rejects persisted copies',async()=>{
 const api=await import('./request-window-run.mjs').catch(()=>({}));
 assert.equal(typeof api.runStock033RequestWindowOriginalV1,'function');
 assert.equal(typeof api.inspectRequestWindowAcquisitionV1,'function');
 for(const forged of [{},null,{status:'original-process-closed',terminalReceiptWrite:'fulfilled'}])assert.throws(()=>api.inspectRequestWindowAcquisitionV1(forged));
});
test('request-window acquisition refuses crossed preparation before any child dispatch',async()=>{
 const api=await import('./request-window-run.mjs').catch(()=>({}));
 assert.equal(typeof api.runStock033RequestWindowOriginalV1,'function');
 await assert.rejects(api.runStock033RequestWindowOriginalV1('/unused',{mode:'real-chat-history100-v1'},{}));
});

// Test-only extraction injects authored OS/process ports. No production injection API.
async function authoredParent(fault={},v2=false){
 const fs=(await import('node:fs/promises')).default,cp=(await import('node:child_process')).default,{EventEmitter}=await import('node:events'),crypto=await import('node:crypto'),io=await import('./prepare.mjs');
 const {tmpdir}=await import('node:os'),{join}=await import('node:path');const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'request-window-parent-'))),captures=new WeakMap();
 const source=Buffer.from('authored source');await fs.writeFile(root+'/source',source);await fs.mkdir(root+'/inputs');await fs.writeFile(root+'/inputs/source',source);await fs.mkdir(root+'/capture');
 const trace=Buffer.from('authored trace');await fs.writeFile(root+'/capture/trace.pftrace',trace);
 const id=s=>({dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs}),stat=await fs.stat(root+'/source'),arch=await fs.stat(root+'/inputs/source');
 const manifest=await io.writeClosed(root+'/app-manifest.json',Buffer.from(JSON.stringify({records:[{key:'source',source:root+'/source',bytes:source.length,sha256:io.sha(source),identity:id(stat),archivedIdentity:id(arch)}]})+'\n'),1048576);
 const f=authored(),captureProtocol='request-window-trace-preroll-1000-v1',selected=v2&&fault.preroll===true,selection=selected?{captureProtocol}:{},template={root,mode:'real-chat-stock033-request-window-scroll-v1',runtime:f.request.runtime,assets:[],fixture:f.request.fixture,history:{},manifest,product:{id:'threadplane-stock-0.3.3'},...selection},templateFact=await io.writeClosed(root+'/template.json',Buffer.from(JSON.stringify(template)+'\n'),4096),reference={manifest,template:templateFact,...selection},traceFact={bytes:trace.length,sha256:io.sha(trace),identity:id(await fs.stat(root+'/capture/trace.pftrace'))};
 if(selected)f.custody.captureProtocol=captureProtocol;
 const file=await fs.readFile(new URL(v2?'./request-window-run-v2.mjs':'./request-window-run.mjs',import.meta.url),'utf8'),a=file.indexOf('function processIdentity('),b=file.indexOf('\nasync function runCore(',a),c=v2?file.length:file.indexOf('\nif(process.argv[1]',b);
 const core=Function('cp','fs','randomBytes','createHash','writeClosed','verifyRequestWindowOriginalsV1','verifyOwnedFile','HERE','unavailable','projectAuthoredRequestWindowWorkerResultV1','REQUEST_WINDOW_RECIPE','createRequestWindowInput','admissions','freeze','preparation','projectAuthoredRequestWindowWorkerResultV2','closedCapturesV2',file.slice(a,b)+';return ('+file.slice(b,c).trim()+');')(cp,fs,crypto.randomBytes,crypto.createHash,io.writeClosed,io.verifyOriginals,io.verifyOwnedFile,'/authored',()=>Error('authored-parent-refused'),project,recipe,createRequestWindowInput,v2?new WeakMap():captures,v=>v,{verifyRequestWindowOriginalsV2:io.verifyOriginals},(await import('./request-window-result.mjs')).projectAuthoredRequestWindowWorkerResultV2,captures);
 const saved={fork:cp.fork,ps:cp.execFileSync,kill:process.kill};let forks=0;const timer=globalThis.setTimeout;if(fault.pendingACK)globalThis.setTimeout=(fn,ms,...args)=>timer(fn,Math.min(ms,100),...args);
 cp.execFileSync=(_cmd,args)=>{const pid=Number(args[2]);return`${pid} ${pid===123?process.pid:123} ${pid} Thu Oct 29 00:00:00 2026\n`;};
 process.kill=(_pid,signal)=>{if(signal!==0)return true;const error=Error('authored absence');error.code='ESRCH';throw error;};
 cp.fork=(_entry,args)=>{forks++;assert.equal(_entry,v2?'/authored/request-window-worker-v2.mjs':'/authored/request-window-worker.mjs');const child=new EventEmitter();Object.assign(child,{pid:123,exitCode:null,kill(){return true;},stdout:new EventEmitter(),stderr:new EventEmitter(),send(_m,cb){if(!fault.pendingACK)cb?.();}});for(const stream of [child.stdout,child.stderr])stream.destroy=()=>{};
  queueMicrotask(async()=>{const request=JSON.parse(await fs.readFile(args[0],'utf8')),fact=JSON.parse(args[1]);child.emit('message',{type:'browser-born',nonce:request.nonce,pid:456});
   const record=authored();record.value.input.request={nonce:request.nonce,requestSha256:fact.sha256,manifestSha256:f.custody.manifestSha256,sourceRevision:f.custody.sourceRevision};record.value.input.input=createRequestWindowInput(request.nonce);record.value.input.issued.params=createRequestWindowGesture(record.value.input.input,record.value.input.geometry.before);record.value.collection.trace=traceFact;record.value.phase.input.bytes=traceFact.bytes;record.value.phase.input.sha256=traceFact.sha256;
   if(v2){record.value.phase={policy:'source-owned-request-window-deferred-phase-v2',phaseInspectionPolicy:'request-window-postcapture-owned-v12-v1',status:'deferred',originalTraceIdentity:{dev:traceFact.identity.dev,ino:traceFact.identity.ino},target:{frameId:'frame',loaderId:'loader',targetId:'target'},marks:{...record.value.input.marks},trace:{bytes:traceFact.bytes,sha256:traceFact.sha256},analysisEligible:false,FPS:null};}
   if(selected){record.value.captureProtocol=request.captureProtocol;record.value.input.preRoll={policy:captureProtocol,requestedMs:1000,elapsedNs:'1000000000',state:'fulfilled'};if(fault.preRollFault==='missing')delete record.value.input.preRoll;if(fault.preRollFault==='early')record.value.input.preRoll.elapsedNs='999999999';if(fault.preRollFault==='policy')record.value.captureProtocol='wrong';}
   if(fault.wrongNonce)record.value.input.request.nonce='0'.repeat(32);if(fault.missingSource)await fs.unlink(root+'/source');
   child.stdout.emit('data',record.raw());for(const stream of [child.stdout,child.stderr]){if(!fault.missingEOF)stream.emit('end');stream.emit('close');}child.emit('exit',fault.nonzero?1:0,null);child.emit('close',fault.nonzero?1:0,null);
  });return child;
 };
 try{if(Object.keys(fault).some(k=>k!=='preroll')){await assert.rejects(core(root,template,reference,v2?{...f.custody,phaseInspectionPolicy:'request-window-postcapture-owned-v12-v1'}:f.custody,v2?'v12-deferred':'v6'));const persisted=JSON.parse(await fs.readFile(root+'/outer.json'));assert.equal(persisted.status,'unavailable');assert.equal(captures.has(persisted),false);}else{const result=await core(root,template,reference,v2?{...f.custody,phaseInspectionPolicy:'request-window-postcapture-owned-v12-v1'}:f.custody,v2?'v12-deferred':'v6');assert.equal(result.status,'original-process-closed');assert.equal(result.terminalReceiptWrite,'fulfilled');assert.equal(captures.has(result),true);assert.equal(captures.has(structuredClone(result)),false);assert.equal(captures.get(result).facts.trace.sha256,traceFact.sha256);assert.equal(result.operations.every(row=>row.state==='fulfilled'&&!row.timedOut),true);assert.equal(result.closeStates.every(row=>row.state==='fulfilled'&&!row.late),true);if(selected){assert.equal(result.captureProtocol,captureProtocol);assert.deepEqual(result.preRoll,result.observedCollection.input.preRoll);assert.equal(captures.get(result).captureProtocol,captureProtocol);assert.deepEqual(captures.get(result).preRoll,result.preRoll);assert.equal(Object.hasOwn(captures.get(result).facts,'preRoll'),false);const disk=JSON.parse(await fs.readFile(root+'/outer.json'));assert.equal(disk.captureProtocol,captureProtocol);assert.deepEqual(disk.preRoll,result.preRoll);}}assert.equal(forks,1);
 }finally{cp.fork=saved.fork;cp.execFileSync=saved.ps;process.kill=saved.kill;globalThis.setTimeout=timer;await fs.rm(root,{recursive:true,force:true});}
}
test('actual parent original closure binds owned trace and only its original return',()=>authoredParent());
for(const fault of ['wrongNonce','missingSource','missingEOF','nonzero'])test('actual parent refuses original custody fault '+fault,()=>authoredParent({[fault]:true}));

test('production facade snapshots both caller DTOs before its first asynchronous admission',async()=>{
 const fs=(await import('node:fs/promises')).default,path=(await import('node:path')).default,{admitStock033DataV2}=await import('./roster-stock033-v2.mjs');
 const source=await fs.readFile(new URL('./request-window-run.mjs',import.meta.url),'utf8'),start=source.indexOf('export async function runStock033RequestWindowOriginalV1('),end=source.indexOf('\nfunction processIdentity(',start);
 let release,observed;const pending=new Promise(resolve=>release=resolve),template={fixtureProfile:'native-history100-v1',nested:{hash:'original'}},reference={manifest:{sha256:'original'}};
 const facade=Function('process','path','fs','preparation','unavailable','runCore','admitStock033DataV2','freeze',source.slice(start,end).replace(/^export /,'')+';return runStock033RequestWindowOriginalV1;')({env:{NATIVE_REAL_CHAT_ONCE_RELEASE:'source-reviewed-native-stock033-request-window-scroll-v1'}},path,{realpath:async p=>p},{async verifyStock033RequestWindowPreparationV1(root,t,r){observed={t,r};await pending;return t;},inspectStock033RequestWindowPreparationV1:()=>({})},()=>Error('refused'),async(root,t,r)=>({t,r}),admitStock033DataV2,v=>v);
 const original=facade('/root',template,reference);template.nested.hash='replaced';reference.manifest.sha256='replaced';release();const result=await original;
 assert.notEqual(observed.t,template);assert.notEqual(observed.r,reference);assert.equal(result.t.nested.hash,'original');assert.equal(result.r.manifest.sha256,'original');
});

test('actual parent refuses an original browser acknowledgement callback that remains pending',()=>authoredParent({pendingACK:true}));

test('V2 actual parent closes original collection with a separate private collection brand',()=>authoredParent({},true));

for(const fault of ['wrongNonce','missingSource','missingEOF','nonzero','pendingACK'])test('V2 actual parent refuses original custody fault '+fault,()=>authoredParent({[fault]:true},true));
test('V2 pre-roll parent binds original receipt in publication and private sidecar',()=>authoredParent({preroll:true},true));
for(const preRollFault of ['missing','early','policy'])test('V2 pre-roll parent refuses original wait fault '+preRollFault,()=>authoredParent({preroll:true,preRollFault},true));
