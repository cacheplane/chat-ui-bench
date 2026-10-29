import cp from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {readFixed,writeClosed,verifyOwnedFile} from './prepare.mjs';
import * as preparation from './prepare-stock033-v2.mjs';
import {REQUEST_WINDOW_RECIPE,createRequestWindowInput} from './request-window-core.mjs';
import {projectAuthoredRequestWindowWorkerResultV1} from './request-window-result.mjs';
import {admitStock033DataV2} from './roster-stock033-v2.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),unavailable=()=>Error('native-request-window-supervisor-unavailable');
const admissions=new WeakMap();
function freeze(v){if(v&&typeof v==='object'){for(const value of Object.values(v))freeze(value);Object.freeze(v);}return v;}
const verifyRequestWindowOriginalsV1=(...args)=>preparation.verifyRequestWindowOriginalsV1(...args);
export function inspectRequestWindowAcquisitionV1(original){const owned=admissions.get(original);if(!owned)throw unavailable();return owned.facts;}
export async function verifyRequestWindowAcquisitionV1(original){const owned=admissions.get(original);if(!owned)throw unavailable();const {root,template,reference,requestFact,before,facts}=owned;const after=await verifyRequestWindowOriginalsV1(root,reference.manifest);if(JSON.stringify(before)!==JSON.stringify(after))throw unavailable();await verifyOwnedFile(root+'/template.json',reference.template,4096);await verifyOwnedFile(root+'/request.json',requestFact,4096);await verifyOwnedFile(facts.trace.path,facts.trace,33554432);await verifyOwnedFile(facts.publication.path,facts.publication,65536);return facts;}
export async function runStock033RequestWindowOriginalV1(root,template,reference){
 if(process.env.NATIVE_REAL_CHAT_ONCE_RELEASE!=='source-reviewed-native-stock033-request-window-scroll-v1'||typeof root!=='string'||root.length>256||path.resolve(root)!==root)throw unavailable();
 // Copy only inert bounded data before any original asynchronous observation.
 // Caller mutations cannot replace an expected original identity later.
 admitStock033DataV2(template,4095);admitStock033DataV2(reference,4095);
 template=freeze(structuredClone(template));reference=freeze(structuredClone(reference));
 const owned=await preparation.verifyStock033RequestWindowPreparationV1(root,template,reference),custody=preparation.inspectStock033RequestWindowPreparationV1(owned);if(await fs.realpath(root)!==root)throw unavailable();return runCore(root,owned,reference,custody);
}
function processIdentity(pid){if(!Number.isSafeInteger(pid)||pid<1)throw unavailable();const text=cp.execFileSync('/bin/ps',['-ww','-p',String(pid),'-o','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',timeout:1000,maxBuffer:256,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});if(text.length>256)throw unavailable();const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(text);if(!m||Number(m[1])!==pid)throw unavailable();return{pid,ppid:Number(m[2]),pgid:Number(m[3]),start:m[4]};}
function absent(identity){if(!identity)throw unavailable();try{process.kill(-identity.pgid,0);}catch(e){if(e?.code==='ESRCH')return{pgid:identity.pgid,absent:true,observation:'original-kill-zero-ESRCH'};throw unavailable();}throw unavailable();}
async function runCore(root,template,reference,custody){
 const before=await verifyRequestWindowOriginalsV1(root,reference.manifest),origin=Number(process.hrtime.bigint());if(!Number.isSafeInteger(origin))throw unavailable();const operations=[],closeStates=[],closeCache=new Map();let failed=false,captureTimer=null,result,child=null,browser=null,workerIdentity=null,closing=false;const ownedFiles=[];
 async function within(kind,call){const left=19000-(Number(process.hrtime.bigint())-origin)/1000000;if(left<=0||operations.length>=16)throw unavailable();const row={kind,state:'pending',timedOut:false};operations.push(row);let timer;const original=Promise.resolve().then(call).then(v=>{row.state='fulfilled';return v;},()=>{row.state='rejected';throw unavailable();});try{return await Promise.race([original,new Promise((_,reject)=>timer=setTimeout(()=>{row.timedOut=true;reject(unavailable());},left))]);}finally{clearTimeout(timer);}}
 function closeOwned(file,name){if(closeCache.has(file))return closeCache.get(file);const row={kind:name,state:'pending',late:false};closeStates.push(row);let original;try{original=file.close();}catch{original=Promise.reject(unavailable());}const promise=Promise.resolve(original).then(()=>{row.state='fulfilled';row.late=Number(process.hrtime.bigint())-origin>=19000000000;},()=>{row.state='rejected';throw unavailable();});promise.catch(()=>{});closeCache.set(file,promise);return promise;}
 // Source-owned admission selects the fixed capture recipe and private binding.
 // Legacy selections retain their original lean request population.
 const recipe={mode:'real-chat-stock033-request-window-scroll-v1',root:template.root,runtime:template.runtime,assets:template.assets,fixture:template.fixture,history:template.history,manifest:template.manifest,inputRecipe:REQUEST_WINDOW_RECIPE,manifestSha256:custody.manifestSha256,sourceRevision:custody.sourceRevision,fixtureProfile:custody.fixtureProfile};
 const request={...recipe,root,originNs:origin,nonce:randomBytes(16).toString('hex')};request.input=createRequestWindowInput(request.nonce);const requestFact=await within('request-write',()=>writeClosed(root+'/request.json',Buffer.from(JSON.stringify(request)+'\n'),4096));
 let observed=null,publicationFact=null;

 function openOwned(name){const original=fs.open(root+'/worker.'+name+'.bin','wx',0o600);return Promise.resolve(original).then(file=>{ownedFiles.push({name,file});if(closing){closeOwned(file,name);throw unavailable();}return file;});}
 function contain(identity){if(!identity)return;try{const now=processIdentity(identity.pid);if(now.pgid!==identity.pgid||now.start!==identity.start){failed=true;return;}process.kill(-identity.pgid,'SIGKILL');}catch{failed=true;}}
 let out=null,err=null;try{
  out=await within('stdout-open',()=>openOwned('stdout'));err=await within('stderr-open',()=>openOwned('stderr'));let rows=0,chunks=0,stdout=0,stderr=0,endOut=false,endErr=false,closeOut=false,closeErr=false,exit=null,close=null;const chains={stdout:Promise.resolve(),stderr:Promise.resolve()},stdoutCopies=[],stdoutHash=createHash('sha256');let acknowledgedStdout=0,acknowledgement=null;let closeResolve;const closed=new Promise(r=>closeResolve=r),fail=()=>failed=true;
  child=cp.fork(HERE+'/request-window-worker.mjs',[root+'/request.json',JSON.stringify(requestFact)],{execPath:process.execPath,detached:true,stdio:['ignore','pipe','pipe','ipc'],env:{PATH:process.env.PATH,HOME:process.env.HOME,NATIVE_REAL_CHAT_SOURCE_RELEASE:'source-reviewed-native-stock033-request-window-scroll-v1'}});
  child.once('error',fail);child.once('exit',(code,signal)=>exit={code,signal});child.once('close',(code,signal)=>{close={code,signal};closeResolve();});
  const deadline=new Promise(resolve=>{captureTimer=setTimeout(()=>{failed=true;contain(browser);contain(workerIdentity);if(!workerIdentity&&child.exitCode===null)child.kill('SIGKILL');resolve('deadline');},Math.max(1,17000-(Number(process.hrtime.bigint())-origin)/1000000));});
  try{workerIdentity=processIdentity(child.pid);if(workerIdentity.ppid!==process.pid||workerIdentity.pgid!==child.pid)failed=true;}catch{fail();if(child.exitCode===null)child.kill('SIGKILL');}
  for(const[key,file]of[['stdout',out],['stderr',err]]){const stream=child[key];stream.once('end',()=>{if(key==='stdout')endOut=true;else endErr=true;});stream.once('close',()=>{if(key==='stdout')closeOut=true;else closeErr=true;});stream.once('error',fail);const data=bytes=>{if(!Buffer.isBuffer(bytes)||++chunks>4096){stream.off('data',data);stream.destroy();fail();return;}if(key==='stdout')stdout+=bytes.length;else stderr+=bytes.length;if(stdout>65536||stderr>65536){stream.off('data',data);stream.destroy();fail();return;}const copy=Buffer.from(bytes);chains[key]=chains[key].then(async()=>{const ack=await file.write(copy,0,copy.length,null);if(ack.bytesWritten!==copy.length)throw unavailable();if(key==='stdout'){stdoutCopies.push(copy);stdoutHash.update(copy);acknowledgedStdout+=copy.length;}});chains[key].catch(fail);};stream.on('data',data);}
  const message=m=>{try{if(++rows>1||!m||m.type!=='browser-born'||m.nonce!==request.nonce||!Number.isSafeInteger(m.pid)||Buffer.byteLength(JSON.stringify(m))>256)throw unavailable();browser=processIdentity(m.pid);if(browser.ppid!==child.pid||browser.pgid!==m.pid)throw unavailable();acknowledgement=within('browser-ack',()=>new Promise((resolve,reject)=>{child.send({type:'browser-ack',nonce:request.nonce,pid:m.pid},error=>error?reject(unavailable()):resolve());}));acknowledgement.catch(fail);}catch{child.off('message',message);fail();}};child.on('message',message);
  const outcome=await Promise.race([closed.then(()=> 'closed'),deadline]);if(outcome==='deadline')await within('worker-close-cleanup',()=>closed);
  if(outcome==='closed'){clearTimeout(captureTimer);if(Number(process.hrtime.bigint())-origin>=17000000000)failed=true;}
  try{if(!acknowledgement)throw unavailable();await acknowledgement;}catch{fail();}
  if(!close||!exit||exit.code!==0||exit.signal!==null||close.code!==0||close.signal!==null||!endOut||!endErr||!closeOut||!closeErr||!browser)failed=true;
  let groupAbsence=[];try{groupAbsence=[absent(workerIdentity),absent(browser)];}catch{fail();contain(browser);contain(workerIdentity);}
  try{await within('raw-ordered-writes',()=>Promise.all([chains.stdout,chains.stderr]));}catch{fail();}
  for(const[name,file]of[['stdout',out],['stderr',err]]){try{await within(name+'-sync',()=>file.sync());}catch{fail();}try{await within(name+'-close',()=>closeOwned(file,name));}catch{fail();}}
  let after=null,sourceError=null;try{after=await within('source-bookend',()=>verifyRequestWindowOriginalsV1(root,reference.manifest));if(before.files!==after.files||before.bytes!==after.bytes||before.manifestSha256!==after.manifestSha256)sourceError='source-verification-unavailable';await within('generated-bookend',async()=>{await verifyOwnedFile(root+'/template.json',reference.template,4096);await verifyOwnedFile(root+'/request.json',requestFact,4096);});}catch{sourceError='source-verification-unavailable';}if(sourceError)failed=true;
  let observedCollection;
  if(!failed){try{if(acknowledgedStdout!==stdout||operations.some(row=>row.state!=='fulfilled'||row.timedOut)||closeStates.some(row=>row.state!=='fulfilled'||row.late))throw unavailable();observed=projectAuthoredRequestWindowWorkerResultV1(Buffer.concat(stdoutCopies,acknowledgedStdout),request,requestFact,custody);if(observed.physicalPid!==browser.pid)throw unavailable();await within('trace-original-bookend',()=>verifyOwnedFile(root+'/capture/trace.pftrace',observed.trace,33554432));observedCollection={collection:observed.value.collection,input:observed.inputTrace,phase:observed.value.phase,stdout:{bytes:acknowledgedStdout,sha256:stdoutHash.digest('hex')}};}catch{failed=true;}}

  const receipt={status:failed?'unavailable':'candidate-process-closed',terminalReceiptWrite:'pending',sourceBookends:{before,after,stable:sourceError===null,error:sourceError},request:requestFact,worker:workerIdentity,browser,groupAbsence,exit,close,stdout:{bytes:stdout,end:endOut,close:closeOut},stderr:{bytes:stderr,end:endErr,close:closeErr},operations,closeStates,captureDeadlineMs:17000,cleanupAndFinalizationDeadlineMs:19000,preparationReferenceTrust:'source-owned outer original prep return/exit/EOF; not parsed-template self-authentication',authority:{nativeSupported:false,clock:'not_evaluated',population:'not_evaluated',FPS:null}};
  receipt.kind='native-stock033-request-window-scroll-result-v1';receipt.label='Threadplane 0.3.3 (stock published packages; fixed request-window scroll)';receipt.product=template.product;receipt.preparation={policy:reference.policy,template:reference.template,manifest:reference.manifest};receipt.nonce=request.nonce;receipt.inputRecipe=REQUEST_WINDOW_RECIPE;receipt.fixtureProfile=custody.fixtureProfile;if(observedCollection)receipt.observedCollection=observedCollection;
  publicationFact=await within('terminal-receipt-write',()=>writeClosed(root+'/outer.json',Buffer.from(JSON.stringify(receipt)+'\n'),65536));if(failed)throw unavailable();result={...receipt,status:'original-process-closed',terminalReceiptWrite:'fulfilled'};

 }finally{
  clearTimeout(captureTimer);closing=true;if(!result&&child){contain(browser);contain(workerIdentity);if(!workerIdentity&&child.exitCode===null){try{child.kill('SIGKILL');}catch{failed=true;}}}
  // Dispatch each still-owned original close even when the wait deadline passed.
  // The mapped wait can refuse while its original remains pending/late.
  for(const{name,file}of ownedFiles){const original=closeOwned(file,name);try{await within('finally-'+name+'-close',()=>original);}catch{failed=true;}}
 }
 if(failed||!result||Number(process.hrtime.bigint())-origin>=19000000000)throw unavailable();
 if(observed.analysisEligible){const facts=freeze({inputRecipe:REQUEST_WINDOW_RECIPE,fixtureProfile:custody.fixtureProfile,binding:{nonce:request.nonce,requestSha256:requestFact.sha256,manifestSha256:custody.manifestSha256,sourceRevision:custody.sourceRevision},trace:{path:root+'/capture/trace.pftrace',...observed.trace},target:{frameId:observed.inputTrace.selected.frameId,loaderId:observed.inputTrace.selected.loaderId},phaseNames:{...observed.inputTrace.marks},publication:{path:root+'/outer.json',...publicationFact}});admissions.set(result,{root,template,reference,requestFact,before,facts});}
 return freeze(result);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==6||process.argv[2]!=='--prepared-stock033-request-window-scroll-v1'||process.argv[4]!=='--reference')throw unavailable();
 const root=process.argv[3];Promise.all([readFixed(root+'/template.json',4096),readFixed(process.argv[5],4096)]).then(([template,reference])=>runStock033RequestWindowOriginalV1(root,JSON.parse(template.toString('utf8')),JSON.parse(reference.toString('utf8')))).then(result=>process.stdout.write(JSON.stringify(result)+'\n'),()=>{process.exitCode=1;process.stderr.write('native-request-window-supervisor-unavailable\n');});
}
