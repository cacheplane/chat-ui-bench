import fs from 'node:fs';
import {resolve,dirname,basename,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import childProcess from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {here,sourceRoot,sha,boundedRead,preflight} from './instrument.mjs';
import {offlineBuild,createBuildReservation,recheckBuildInputs,validateEmittedImports,requiredStaticOutputs,selectedSourceStaticWitness} from './build.mjs';
const require=createRequire(sourceRoot+'/package.json'),profileRaw=boundedRead(resolve(here,'profile.json'),65536);
if(sha(profileRaw)!=='182bbb6a6103c0238442600921170240cee6c147ec192fb8a5c3285c0853ca08')throw Error('profile-contract');
const policy=JSON.parse(profileRaw);
let caseNonce=null;
const bindingHTML='<!doctype html><meta charset="utf-8"><link rel="icon" href="/favicon.ico"><pre id="binding-receipt"></pre><script type="module">import {receipt} from "/sentinel.mjs";document.getElementById("binding-receipt").textContent=JSON.stringify(receipt);</script>';
export function createBrowserAdmission(origin,outputs){
 if(!/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/.test(origin))throw Error('static-origin');
 const inventory=new Map(),requests=[];let bytes=0,closed=false,late=false,reason=null;
 const add=(path,body,contentType,expected)=>{body=Buffer.from(body);if(inventory.size===640||body.length>8388608||[...inventory.values()].reduce((n,f)=>n+f.body.length,0)+body.length>33554432)throw Error('static-limit');if(expected&&sha(body)!==expected)throw Error('static-hash');if(inventory.has(path))throw Error('static-duplicate');inventory.set(path,{body,contentType,sha256:sha(body)});};
 add('/',bindingHTML,'text/html; charset=utf-8');add('/favicon.ico',Buffer.alloc(0),'image/x-icon');
 for(const f of outputs){if(!/^[A-Za-z0-9._-]+$/.test(f.name)||f.bytes!==f.contents.length)throw Error('static-path');add('/'+f.name,f.contents,f.name.endsWith('.mjs')?'text/javascript; charset=utf-8':'application/octet-stream',f.sha256);}
 return {admit(url,method,type,redirect){
  if(closed){late=true;reason??='late-request';return null;}if(reason)return null;
  const path=url.startsWith(origin+'/')?url.slice(origin.length):null,f=inventory.get(path);
  if(!f||method!=='GET'||redirect||!['document','script','image','font','stylesheet'].includes(type)){reason='unexpected-request';return null;}
  if(requests.length===768){reason='request-limit';return null;}if(bytes+f.body.length>33554432){reason='response-limit';return null;}
  if(sha(f.body)!==f.sha256){reason='static-hash';return null;}
  bytes+=f.body.length;requests.push({path,bytes:f.body.length,sha256:f.sha256});return f;
 },fail(value){reason??=value;},close(){closed=true;},snapshot(){return {reason,closed,late,requests:requests.length,bytes,inventory:[...inventory].map(([path,f])=>({path,bytes:f.body.length,sha256:f.sha256})),loaded:requests.map(r=>({...r}))};}};
}
export async function withBrowserDeadline(promise,deadline){
 const remaining=deadline-performance.now();if(remaining<=0){Promise.resolve(promise).catch(()=>{});throw Error('browser-deadline');}
 let timer;try{return await Promise.race([Promise.resolve(promise).then(value=>{if(performance.now()>=deadline)throw Error('browser-deadline');return value;}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('browser-deadline')),remaining);})]);}finally{clearTimeout(timer);}
}
export function validateBrowserReceipt(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>262144)throw Error('binding-receipt-limit');
 const r=JSON.parse(text);if(!r||Object.keys(r).sort().join(',')!=='bindings,counts,kind,performance,qualification,reason,status'||r.kind!=='copilot-module-binding-v1'||r.status!=='observed'||r.reason!==null||r.qualification!==false||r.performance!==false||JSON.stringify(r.counts)!=='[1,1,1,1]'||!Array.isArray(r.bindings)||JSON.stringify(r.bindings)!=='["copilot","core","react","wrapper"]')throw Error('binding-receipt');
 if(Buffer.byteLength(JSON.stringify(r,null,2)+'\n')>262144)throw Error('binding-receipt-limit');return r;
}
export function recordReceiptText(phase,text,deadline,now=()=>performance.now()){
 const refuse=reason=>{phase.rawReceiptRefusal={reason,origin:'#binding-receipt original textContent read',encoding:'utf-8'};throw Error('binding-raw-receipt-'+reason);};
 if(now()>=deadline)refuse('late');if(typeof text!=='string')refuse('missing');if(text.length>16384||Buffer.byteLength(text)>16384)refuse('limit');
 const raw={status:'retained',origin:'#binding-receipt original textContent last admitted read',encoding:'utf-8',text,bytes:Buffer.byteLength(text),sha256:sha(text)};
 if(now()>=deadline)refuse('late');phase.rawReceipt=raw;return raw;
}
export function serializePhaseEvidence(phase,deadline=Infinity,now=()=>performance.now()){if(now()>=deadline)throw Error('binding-writer-deadline');const raw=Buffer.from(JSON.stringify(phase,null,2)+'\n');if(raw.length>262144)throw Error('binding-phase-evidence-limit');if(now()>=deadline)throw Error('binding-writer-deadline');return raw;}
function processGroupGone(proc){if(!proc)return true;try{process.kill(-proc.pid,0);return false;}catch(e){return e.code==='ESRCH';}}
export function processWitnessClosed(w){return !!w&&!w.error&&JSON.stringify(w.exit)==='[0,null]'&&JSON.stringify(w.close)==='[0,null]'&&['stdout','stderr'].every(k=>w[k]?.end===true&&w[k]?.close===true&&w[k]?.error===false);}
export function verifyRawReceipt(phase){const raw=phase.rawReceipt;if(!raw||raw.status!=='retained'||raw.encoding!=='utf-8'||phase.rawReceiptRefusal||typeof raw.text!=='string'||Buffer.byteLength(raw.text)>16384||Buffer.byteLength(raw.text)!==raw.bytes||sha(raw.text)!==raw.sha256)throw Error('binding-raw-join');const parsed=validateBrowserReceipt(raw.text);if(JSON.stringify(parsed)!==JSON.stringify(phase.receipt))throw Error('binding-raw-join');return parsed;}
export async function browserBindingPhase(build,{out,overallDeadline}){
 const profile={...policy};
 if(build.receipt.graphStatus!=='observed'||build.receipt.singletonEmittedChunks!==1)throw Error('browser-build-binding');
 if(JSON.stringify(validateEmittedImports(build))!==JSON.stringify(build.receipt.embeddedAssets)||JSON.stringify(selectedSourceStaticWitness(build.receipt))!==JSON.stringify(build.receipt.sourceStaticWitness))throw Error('browser-source-binding');
 const playwright=require('playwright');profile.executable=playwright.chromium.executablePath();const browserBefore=fileMetadata(profile.executable);
 const deadline=Math.min(performance.now()+15000,overallDeadline-5000);if(deadline<=performance.now())throw Error('browser-deadline');
 let server,browserServer,browser,context,page,admission,profileDir,proc,error=null,receipt=null,closed=false,spawnObserved=false,launchSettled=false,originalSpawn,observedSpawn,processClosed;
 const witness={exit:null,close:null,error:false,stdout:{end:false,close:false,error:false},stderr:{end:false,close:false,error:false}},streamClosed=[],tickets=new Map(),logs={stdout:[],stderr:[]},logBytes={stdout:0,stderr:0};
 const within=p=>withBrowserDeadline(p,deadline);
 const fail=reason=>{admission?.fail(reason);};
 const result={kind:'copilot-module-binding-browser-v1',status:'unavailable',reason:null,executedSingleton:'unavailable',receipt:null,runtimeBrowser:{before:browserBefore,attestation:"executable metadata only; no whole binary/app claim"},networkBoundary:'owned page/context observable requests and controlled features only',cleanup:{http:false,context:false,browser:false,process:false,profile:false},qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,warmReadiness:'unavailable',liveReadiness:'unavailable',fps:'unavailable'};
 try{
  server=createServer((req,res)=>{const ticket=tickets.get(req.headers['x-private-binding-ticket']);tickets.delete(req.headers['x-private-binding-ticket']);if(!ticket||req.method!=='GET'||req.url!==ticket.path){fail('unexpected-http');res.destroy();return;}res.writeHead(200,{'content-type':ticket.file.contentType,'content-length':ticket.file.body.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(ticket.file.body);});
  await within(new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}));const origin=`http://127.0.0.1:${server.address().port}`;admission=createBrowserAdmission(origin,build.outputs);
  originalSpawn=childProcess.spawn;
  childProcess.spawn=observedSpawn=function(...args){
   // Observe only the exact pinned browser spawn; preserve the native receiver, arguments and return.
   if(args[0]!==profile.executable)return Reflect.apply(originalSpawn,this,args);
   if(spawnObserved)throw Error('browser-duplicate-process');spawnObserved=true;
   if(args[2]?.detached!==true)throw Error('browser-process-group');
   proc=Reflect.apply(originalSpawn,this,args);
   proc.once('exit',(code,signal)=>{witness.exit=[code,signal];});proc.once('error',()=>{witness.error=true;});processClosed=new Promise(resolve=>proc.once('close',(code,signal)=>{witness.close=[code,signal];resolve();}));
   profileDir=proc.spawnargs.find(a=>a.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
   result.process={pid:proc.pid,profileDir:profileDir??null,controlEndpoint:null};
   if(process.send)process.send({type:"browser-born",nonce:caseNonce,pid:proc.pid,profileDir,detached:true},sendError=>{if(sendError){fail('browser-owner-ipc');error??={name:sendError.name,message:'browser-owner-ipc'};}});
   for(const channel of ['stdout','stderr']){if(!proc[channel])throw Error('browser-process-stream');const stream=proc[channel];stream.once('end',()=>{witness[channel].end=true;});stream.once('error',()=>{witness[channel].error=true;});streamClosed.push(new Promise(resolve=>stream.once('close',()=>{witness[channel].close=true;resolve();})));stream.on('data',chunk=>{logBytes[channel]+=chunk.length;if(logBytes[channel]>1048576){fail('browser-output-limit');try{process.kill(-proc.pid,'SIGKILL');}catch{}}else logs[channel].push(Buffer.from(chunk));});}
   return proc;
  };
  const launching=playwright.chromium.launchServer({executablePath:profile.executable,headless:true,timeout:Math.max(1,deadline-performance.now()),env:{PATH:process.env.PATH,HOME:process.env.HOME},host:'127.0.0.1'}).finally(()=>{launchSettled=true;if(childProcess.spawn===observedSpawn)childProcess.spawn=originalSpawn;});
  // A late launch must still close its owned process; it can never return a receipt.
  launching.then(s=>{if(performance.now()>=deadline)void s.kill().catch(()=>{});},()=>{});
  browserServer=await within(launching);if(!spawnObserved||proc!==browserServer.process())throw Error('browser-process-observation');
  if(!validProfilePath(profileDir))throw Error('browser-profile-path');
  result.process={pid:proc.pid,profileDir,controlEndpoint:browserServer.wsEndpoint()};
  if(admission.snapshot().reason)throw Error(admission.snapshot().reason);
  const connecting=playwright.chromium.connect(browserServer.wsEndpoint(),{timeout:Math.max(1,deadline-performance.now())});connecting.then(b=>{if(performance.now()>=deadline)void b.close().catch(()=>{});},()=>{});browser=await within(connecting);
  result.browserVersion=browser.version();if(typeof result.browserVersion!=='string'||result.browserVersion.length>128)throw Error('browser-version');
  context=await within(browser.newContext({serviceWorkers:'block',acceptDownloads:false}));
  context.on('serviceworker',()=>fail('serviceworker'));context.on('page',p=>{if(page&&p!==page)fail('extra-page');p.on('worker',()=>fail('worker'));p.on('download',()=>fail('download'));p.on('websocket',()=>fail('websocket'));p.on('pageerror',e=>{error??={name:e.name,message:String(e.message).slice(0,512)};fail('original-browser-error');});});
  await within(context.routeWebSocket('**/*',ws=>{fail('websocket');ws.close();}));
  await within(context.route('**/*',async route=>{const request=route.request(),file=admission.admit(request.url(),request.method(),request.resourceType(),!!request.redirectedFrom());if(!file){await route.abort('blockedbyclient');return;}const token=randomUUID(),path=request.url().slice(origin.length);tickets.set(token,{file,path});try{await route.continue({headers:{...request.headers(),'x-private-binding-ticket':token}});}catch(e){tickets.delete(token);fail('request-error');error??={name:e.name,message:String(e.message).slice(0,512)};}}));
  page=await within(context.newPage());if(context.pages().length!==1)throw Error('browser-page-count');
  await within(page.goto(origin+'/',{waitUntil:'load',timeout:Math.max(1,deadline-performance.now())}));
  const node=page.locator('#binding-receipt');await within(node.waitFor({state:'attached',timeout:Math.max(1,deadline-performance.now())}));
  // Bounded text read from the sole owned output element; no arbitrary page evaluation.
  let text='';while(!text){if(admission.snapshot().reason)throw Error(admission.snapshot().reason);text=await within(node.textContent({timeout:Math.max(1,deadline-performance.now())}));recordReceiptText(result,text,deadline);if(!text)await within(page.waitForTimeout(10));}
  receipt=validateBrowserReceipt(text);if(tickets.size||admission.snapshot().reason)throw Error(admission.snapshot().reason??'request-closure');
  const loaded=new Set(admission.snapshot().loaded.map(f=>f.path.slice(1))),needed=requiredStaticOutputs(build.receipt.outputGraph,'sentinel.mjs');if([...needed].some(name=>!loaded.has(name)))throw Error('browser-loaded-graph');
 }catch(e){error??={name:e.name??'Error',message:String(e.message??e).slice(0,512)};}
 finally{
  // No cleanup path can manufacture an observed binding receipt.
  const cleanupDeadline=Math.min(overallDeadline,performance.now()+5000),cleanup=p=>withBrowserDeadline(p,cleanupDeadline);
  if(originalSpawn&&childProcess.spawn===observedSpawn)childProcess.spawn=originalSpawn;
  try{if(context)await cleanup(context.close());result.cleanup.context=true;}catch(e){error??={name:e.name,message:String(e.message).slice(0,512)};}
  try{if(browser)await cleanup(browser.close());if(browserServer)await cleanup(browserServer.close());result.cleanup.browser=true;}catch(e){try{await cleanup(browserServer?.kill());}catch{}error??={name:e.name,message:String(e.message).slice(0,512)};}
  // Pinned Playwright launches a detached POSIX process group and kill() closes that tree.
  if(proc&&!processGroupGone(proc)){error??={name:'Error',message:'browser-forced-cleanup'};try{await cleanup(browserServer.kill());}catch{} }
  if(proc&&!processGroupGone(proc)){error??={name:'Error',message:'browser-forced-cleanup'};try{process.kill(-proc.pid,'SIGKILL');}catch{} }
  try{if(processClosed)await cleanup(Promise.all([processClosed,...streamClosed]));}catch(e){error??={name:e.name,message:String(e.message).slice(0,512)};}
  result.cleanup.process=launchSettled&&!!proc&&processGroupGone(proc)&&processWitnessClosed(witness);
  try{if(profileDir){if(!result.cleanup.process||!validProfilePath(profileDir))throw Error('browser-process-cleanup');fs.rmSync(profileDir,{recursive:true,force:true});if(fs.existsSync(profileDir))throw Error('browser-profile-cleanup');}result.cleanup.profile=true;}catch(e){result.retainedProfileCoverage='unknown/unavailable';error??={name:e.name,message:String(e.message).slice(0,512)};}
  try{if(server){server.closeAllConnections();await cleanup(new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));}result.cleanup.http=true;}catch(e){error??={name:e.name,message:String(e.message).slice(0,512)};}
  admission?.close();closed=Object.values(result.cleanup).every(v=>v===true)&&!tickets.size;
 }
 try{result.runtimeBrowser.after=fileMetadata(profile.executable);if(JSON.stringify(result.runtimeBrowser.after)!==JSON.stringify(browserBefore))throw Error('browser-executable-metadata-drift');}catch(e){error??={name:e.name,message:e.message};}
 result.network=admission?.snapshot()??null;result.error=error;result.processWitness=witness;result.logs={stdout:Buffer.concat(logs.stdout),stderr:Buffer.concat(logs.stderr),bytes:logBytes};
 if(receipt&&!error&&closed&&!result.network?.reason&&performance.now()<=overallDeadline){result.status='observed';result.executedSingleton='observed';result.receipt=receipt;}else result.reason=error?.message??result.network?.reason??'browser-cleanup';
 return result;
}
export function writeFresh(dir,name,value,budget){
 if(!/^[A-Za-z0-9._-]+$/.test(name))throw Error('output-path');
 const bytes=typeof value==='string'||value instanceof Uint8Array?Buffer.from(value):Buffer.from(JSON.stringify(value,null,2)+'\n');
 if(!budget.reserve(bytes.length))throw Error('build-output-limit');
 writeClosed(resolve(dir,name),bytes);
}
export function createBindingWriter(out,deadline,now=()=>performance.now()){
 if(!isAbsolute(out)||resolve(out)!==out||!fs.lstatSync(out).isDirectory())throw Error('binding-writer-path');const budget=createBuildReservation(),inventory=[],external=[];let failure=null,finished=false;
 // Reserve all variable phase outputs and the four outer capture files before launch.
 for(const size of [1048576,1048576,262144,262144,16384,65536,1048576,1048576,65536])if(!budget.reserve(size))throw Error('binding-writer-limit');
 function bytes(value){return typeof value==='string'||value instanceof Uint8Array?Buffer.from(value):Buffer.from(JSON.stringify(value,null,2)+'\n');}
 function actualWrite(name,data,maximum){if(data.length>maximum)throw Error('binding-writer-limit');writeFresh(out,name,data,{reserve:()=>true});inventory.push({path:name,bytes:data.length,sha256:sha(data)});}
 return {write(name,value){if(finished||failure)throw Error(failure??'binding-writer-closed');try{if(now()>=deadline)throw Error('binding-writer-deadline');const raw=bytes(value);writeFresh(out,name,raw,budget);inventory.push({path:name,bytes:raw.length,sha256:sha(raw)});}catch(e){failure=String(e.message);throw e;}},finish(phase,buildInventorySha256){
  if(finished)throw Error('binding-writer-closed');finished=true;
  try{
   if(now()>=deadline)throw Error('binding-writer-deadline');if(failure)throw Error(failure);
   const stdout=bytes(phase.logs?.stdout??''),stderr=bytes(phase.logs?.stderr??'');if(stdout.length>1048576||stderr.length>1048576)throw Error('binding-writer-limit');
   actualWrite('browser.stdout.txt',stdout,1048576);actualWrite('browser.stderr.txt',stderr,1048576);
   const evidence={...phase,logs:{stdout:{path:'browser.stdout.txt',bytes:stdout.length,sha256:sha(stdout)},stderr:{path:'browser.stderr.txt',bytes:stderr.length,sha256:sha(stderr)}}};
   actualWrite('browser-evidence.json',serializePhaseEvidence(evidence,deadline,now),262144);
   const marker=boundedRead(resolve(out,'attempt.json'),16384);external.push({path:'attempt.json',bytes:marker.length,sha256:sha(marker)});

   if(phase.status==='observed'){verifyRawReceipt(phase);if(phase.executedSingleton!=='observed'||phase.error||!phase.network?.closed||phase.network.reason||phase.network.late||!Object.values(phase.cleanup??{}).length||!Object.values(phase.cleanup).every(v=>v===true)||!external.length)throw Error('binding-writer-closure');}
  }catch(e){failure??=String(e.message);}
  const result={kind:'copilot-module-binding-run-v1',status:!failure&&phase.status==='observed'?'observed':'unavailable',reason:failure??phase.reason??null,buildInventorySha256,executedSingleton:!failure&&phase.status==='observed'?'observed':'unavailable',inventory:[...inventory],external:[...external],files:inventory.length+external.length+1,bytes:0,reservation:{files:budget.files,bytes:budget.bytes},outerCaptureReservation:{files:4,bytes:2228224,intentBytes:65536,stdoutBytes:1048576,stderrBytes:1048576,receiptBytes:65536,actualInventoryJoin:"required from outer controller after child exit; terminal and actual CLI exit still required"},qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'};
  // Final inventory replay uses the actual retained bytes, not only reservations.
  const refuse=reason=>{result.status='unavailable';result.reason=reason;result.executedSingleton='unavailable';};
  const checkDeadline=()=>{if(now()>=deadline)refuse('binding-writer-deadline');};
  for(const fact of inventory){checkDeadline();const raw=boundedRead(resolve(out,fact.path),8388608);if(raw.length!==fact.bytes||sha(raw)!==fact.sha256)refuse('binding-writer-replay');}
  try{const build=JSON.parse(boundedRead(resolve(out,'build-binding.json'),8388608));if(sha(JSON.stringify(build))!==buildInventorySha256)throw Error('binding-writer-replay');result.finalSourceReplay=recheckBuildInputs(build);result.finalSourcesStable=JSON.stringify(prepare())===JSON.stringify(phase.sourceBefore);if(!result.finalSourcesStable)throw Error('source-drift');}catch(e){refuse(String(e.message));}

  if(phase.retainedProfileCoverage==='unknown/unavailable'){refuse('browser-profile-cleanup');result.retainedProfileCoverage='unknown/unavailable';result.allRetainedInventoryCoverage='unavailable';}
  checkDeadline();
  const encode=()=>{for(let i=0;i<8;i++){const size=bytes(result).length,total=result.inventory.reduce((n,f)=>n+f.bytes,0)+external.reduce((n,f)=>n+f.bytes,0)+size;if(result.bytes===total)break;result.bytes=total;}if(result.files>640||result.bytes>33554432)throw Error('binding-writer-limit');const raw=bytes(result);if(raw.length>262144)throw Error('binding-writer-limit');return raw;};
  actualWrite('closure.json',encode(),262144);
  const closurePath=resolve(out,'closure.json');if(sha(boundedRead(closurePath,262144))!==sha(bytes(result)))refuse('binding-writer-replay');checkDeadline();
  // A deadline crossed by the actual final I/O revokes the persisted receipt too.
  if(result.status==='unavailable'){const raw=encode(),fd=fs.openSync(closurePath,fs.constants.O_WRONLY|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW);try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(sha(boundedRead(closurePath,262144))!==sha(raw))throw Error('binding-writer-replay');}
  return result;
 }};
}
const toolFiles=['adapter.mjs','instrument.mjs','build.mjs','run.mjs','source-pins.json','profile.json','conformance.node.mjs','portability.node.mjs','README.md'];
export function prepare(actual={node:process.versions.node,v8:process.versions.v8,platform:process.platform,arch:process.arch,execPath:process.execPath}){
 if(!/^24\./.test(actual.node)||!['linux','darwin'].includes(actual.platform))throw Error('runtime');
 const sources=preflight();const fingerprints=toolFiles.map(path=>{const raw=boundedRead(resolve(here,path),262144);return {path,bytes:raw.length,sha256:sha(raw)};});
 const controls=sources.filter(p=>/^node_modules\/(playwright|playwright-core|esbuild)\//.test(p.path));if(controls.length>16||controls.reduce((n,p)=>n+p.bytes,0)>16777216)throw Error('runtime-control-limit');
 const browserRevisions=JSON.parse(boundedRead(resolve(sourceRoot,'node_modules/playwright-core/browsers.json'),65536)).browsers.filter(b=>b.name==='chromium'||b.name==='chromium-headless-shell');
 return {runtime:actual,runtimeControls:controls,browserRevisions,sources,fingerprints,profileSha256:sha(boundedRead(resolve(here,'profile.json'),65536)),vendorExecuted:false};
}
export function parseArgs(args){let mode='preflight',declared=false,out,runId;for(let i=0;i<args.length;i++){const a=args[i];if(['--browser','--preflight','--test'].includes(a)){if(declared)throw Error('arguments');declared=true;mode=a.slice(2);}else if(a==='--out'){if(out)throw Error('arguments');out=args[++i];if(typeof out!=='string'||!isAbsolute(out)||resolve(out)!==out)throw Error('output-path');}else if(a==='--run-id'){if(runId)throw Error('arguments');runId=args[++i];if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId??''))throw Error('run-id');}else throw Error('arguments');}if(mode==='preflight'&&(out||runId))throw Error('arguments');return {mode,out,runId};}
export function fileMetadata(path){const s=fs.lstatSync(path);if(!s.isFile()||s.isSymbolicLink())throw Error('executable-metadata');return {path,bytes:s.size,dev:String(s.dev),ino:String(s.ino),mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs,scope:'regular-file metadata only; no binary/app attestation'};}
export function validProfilePath(path){if(typeof path!=='string'||dirname(resolve(path))!==resolve(tmpdir())||!/^playwright_chromiumdev_profile-[A-Za-z0-9_-]+$/.test(basename(path)))return false;try{return fs.lstatSync(path).isDirectory()&&!fs.lstatSync(path).isSymbolicLink();}catch(e){return e.code==='ENOENT';}}
export function writeClosed(path,raw,cap=8388608,io=null){if(!Buffer.isBuffer(raw)||raw.length>cap)throw Error('output-limit');const ops=io??{open:p=>fs.openSync(p,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600),write:(fd,b,o)=>fs.writeSync(fd,b,o,b.length-o),sync:fs.fsyncSync,close:fs.closeSync,read:p=>boundedRead(p,cap)};const fd=ops.open(path);let error;try{let offset=0;while(offset<raw.length){const n=ops.write(fd,raw,offset);if(!Number.isSafeInteger(n)||n<=0||n>raw.length-offset)throw Error('output-write');offset+=n;}ops.sync(fd);}catch(e){error=e;}try{ops.close(fd);}catch(e){error??=e;}if(error)throw error;const back=ops.read(path);if(!Buffer.isBuffer(back)||!back.equals(raw))throw Error('output-readback');return {bytes:raw.length,sha256:sha(raw),fsync:true,close:true,readback:true};}
export function inventory(out,capFiles=640,capBytes=33554432){const rows=[];let bytes=0;for(const name of fs.readdirSync(out).sort()){if(rows.length===capFiles||!/^[A-Za-z0-9._-]+$/.test(name))throw Error('inventory-limit');const raw=boundedRead(resolve(out,name),8388608);bytes+=raw.length;if(bytes>capBytes)throw Error('inventory-limit');rows.push({path:name,bytes:raw.length,sha256:sha(raw)});}return {files:rows.length,bytes,rows,sha256:sha(JSON.stringify(rows))};}
function groupExists(pid){try{process.kill(-pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
function killOwned(pid){try{process.kill(-pid,'SIGKILL');}catch(e){if(e.code!=='ESRCH')throw e;}}
export async function captureCase(argv,{out,deadline,env,nonce}){
 const streams={stdout:{bytes:0,end:false,close:false,error:false,chunks:[]},stderr:{bytes:0,end:false,close:false,error:false,chunks:[]}},handles={};
 for(const name of ['stdout','stderr'])handles[name]=fs.openSync(resolve(out,'cli.'+name+'.bin'),'wx',0o600);
 let child,exit=null,close=null,failure=null,browser=null,late=false,timer,containmentTimer;
 const stop=reason=>{failure??=reason;if(child?.pid){try{killOwned(child.pid);}catch{failure??='case-group-kill';}}if(browser?.pid){try{killOwned(browser.pid);}catch{failure??='browser-group-kill';}}};
 try{
  const {__context,...childEnv}=env;child=childProcess.spawn(argv[0],argv.slice(1),{cwd:sourceRoot,env:childEnv,detached:true,stdio:nonce?['ignore','pipe','pipe','ipc']:['ignore','pipe','pipe']});
  child.once('error',()=>{failure??='case-spawn';});child.once('exit',(code,signal)=>{exit=[code,signal];});
  child.on('message',message=>{if(close||message?.type!=='browser-born'||message.nonce!==nonce||browser||!Number.isSafeInteger(message.pid)||message.pid<=1||message.detached!==true){stop('case-ipc');return;}browser={pid:message.pid,profileDir:message.profileDir??null,provenance:'original exact-executable spawn observed by owned source-pinned controller'};});
  for(const [name,stream]of [['stdout',child.stdout],['stderr',child.stderr]]){const s=streams[name];stream.on('data',b=>{if(s.bytes+b.length>1048576){stop('case-stream-limit');return;}try{let offset=0;while(offset<b.length){const n=fs.writeSync(handles[name],b,offset,b.length-offset);if(n<=0)throw Error('write');offset+=n;}s.chunks.push(Buffer.from(b));s.bytes+=b.length;}catch{stop('case-stream-write');}});stream.once('end',()=>{s.end=true;});stream.once('close',()=>{s.close=true;});stream.once('error',()=>{s.error=true;stop('case-stream-error');});}
  const closed=new Promise(resolveClosed=>{child.once('close',(code,signal)=>{close=[code,signal];resolveClosed();});containmentTimer=setTimeout(()=>{stop('case-containment-unresolved');resolveClosed();},Math.max(1,deadline-performance.now()+5000));});
  timer=setTimeout(()=>{late=true;stop('deadline');},Math.max(1,deadline-performance.now()));
  if(nonce)child.send({type:'start',nonce,...env.__context},error=>{if(error)stop('case-ipc-send');});
  await closed;
 }catch{stop('case-spawn');}finally{clearTimeout(timer);clearTimeout(containmentTimer);}
 if(child?.pid&&groupExists(child.pid)){stop('case-group-survivor');}
 if(browser?.pid&&groupExists(browser.pid)){stop('browser-group-survivor');}
 let profileGone=browser?.profileDir?validProfilePath(browser.profileDir)&&!fs.existsSync(browser.profileDir):false;
 if(browser?.profileDir&&!profileGone&&!groupExists(browser.pid)&&validProfilePath(browser.profileDir)){try{fs.rmSync(browser.profileDir,{recursive:true,force:true});profileGone=!fs.existsSync(browser.profileDir);failure??='browser-profile-survivor';}catch{failure??='browser-profile-unknown';}}
 const refs={};for(const name of ['stdout','stderr']){let fsync=true,fileClose=true;try{fs.fsyncSync(handles[name]);}catch{fsync=false;failure??='case-stream-fsync';}try{fs.closeSync(handles[name]);}catch{fileClose=false;failure??='case-stream-file-close';}const raw=boundedRead(resolve(out,'cli.'+name+'.bin'),1048576),s=streams[name],readback=raw.length===s.bytes&&sha(raw)===sha(Buffer.concat(s.chunks));if(!readback)failure??='case-stream-readback';refs[name]={bytes:raw.length,sha256:sha(raw),end:s.end,close:s.close,error:s.error,fsync,fileClose,readback};}
 const exact=a=>JSON.stringify(a)==='[0,null]';if(!exact(exit)||!exact(close)||!Object.values(streams).every(s=>s.end&&s.close&&!s.error))failure??='case-process-closure';
 if(performance.now()>=deadline){late=true;failure??='deadline';}
 return {controllerPid:child?.pid??null,exit,close,failure,late,streams:refs,browser,profileGone,controllerGroupGone:!!child?.pid&&!groupExists(child.pid),browserGroupGone:!!browser?.pid&&!groupExists(browser.pid),stdout:Buffer.concat(streams.stdout.chunks)};
}
async function runCase(context){
 caseNonce=context.nonce;const remaining=Number(BigInt(context.expiresNs)-process.hrtime.bigint())/1e6,deadline=performance.now()+Math.max(0,remaining),out=context.out,before=prepare();
 if(JSON.stringify(before)!==JSON.stringify(context.before)||sha(boundedRead(resolve(out,'intent.json'),65536))!==context.intentSha256)throw Error('case-source-or-intent');
 const writer=createBindingWriter(out,deadline);let phase={kind:'copilot-module-binding-browser-v1',status:'unavailable',reason:'build-unavailable',logs:{},sourceBefore:before},digest=null;
 try{const build=await withBrowserDeadline(offlineBuild(),deadline-20000);digest=sha(JSON.stringify(build.receipt));for(const f of build.outputs)writer.write(f.name,f.contents);writer.write('build-binding.json',build.receipt);writer.write('binding.html',bindingHTML);writer.write('favicon.ico',Buffer.alloc(0));writer.write('browser-profile.json',boundedRead(resolve(here,'profile.json'),65536));
  writeClosed(resolve(out,'attempt.json'),Buffer.from(JSON.stringify({runId:context.runId,nonce:context.nonce,intentSha256:context.intentSha256,buildInventorySha256:digest})+'\n'),16384);
  phase=await browserBindingPhase(build,{out,overallDeadline:deadline});phase.sourceBefore=before;
 }catch(e){phase.reason=String(e.message).slice(0,512);}
 const result=writer.finish(phase,digest);process.stdout.write(JSON.stringify({kind:'copilot-module-binding-case-v1',status:result.status,reason:result.reason,buildInventorySha256:digest,runId:context.runId})+'\n');process.exitCode=result.status==='observed'?0:1;
}
export async function main(args){const options=parseArgs(args);if(options.mode==='preflight'){return {status:'prepared',...prepare(),vendorExecuted:false,outputWritten:false};}if(options.mode==='test')return runFunctional(options);
 const start=performance.now(),deadline=start+120000,expiresNs=(process.hrtime.bigint()+120000000000n).toString(),before=prepare(),runId=options.runId??randomUUID();
 const out=options.out??join(fs.mkdtempSync(join(tmpdir(),'copilot-module-binding-')),'run');fs.mkdirSync(out,{mode:0o700});
 const nonce=randomUUID(),intent={kind:'copilot-module-binding-intent-v1',runId,mode:'explicit-browser-one-attempt',startedAt:new Date().toISOString(),sourceBefore:before,profile:policy,declaredCI:{runId:process.env.GITHUB_RUN_ID??null,runAttempt:process.env.GITHUB_RUN_ATTEMPT??null,sha:process.env.GITHUB_SHA??null,trust:'caller metadata; external CI authentication required'},qualification:false,performance:false};
 const intentRef=writeClosed(resolve(out,'intent.json'),Buffer.from(JSON.stringify(intent,null,2)+'\n'),65536);
 const env=Object.fromEntries(['HOME','TMPDIR','PATH'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));env.LC_ALL='C';env.MODULE_BINDING_NONCE=nonce;env.__context={out,runId,expiresNs,before,intentSha256:intentRef.sha256};
 const observed=await captureCase([process.execPath,fileURLToPath(import.meta.url),'--browser','--case'],{out,deadline,env,nonce});const {stdout,...original}=observed;let failure=observed.failure,inner=null,phase=null;
 try{const line=new TextDecoder('utf-8',{fatal:true}).decode(stdout),summary=JSON.parse(line);if(summary.kind!=='copilot-module-binding-case-v1'||summary.runId!==runId||summary.status!=='observed')throw Error('case-unavailable');inner=JSON.parse(boundedRead(resolve(out,'closure.json'),262144));phase=JSON.parse(boundedRead(resolve(out,'browser-evidence.json'),262144));if(inner.status!=='observed'||phase.status!=='observed'||!Object.values(phase.cleanup).every(v=>v===true)||phase.rawReceiptRefusal)throw Error('inner-unavailable');verifyRawReceipt(phase);for(const fact of [...inner.inventory,...inner.external]){if(!/^[A-Za-z0-9._-]+$/.test(fact.path))throw Error('outer-artifact-path');const raw=boundedRead(resolve(out,fact.path),8388608);if(raw.length!==fact.bytes||sha(raw)!==fact.sha256)throw Error('outer-artifact-replay');}const names=[...inner.inventory,...inner.external].map(f=>f.path);if(new Set(names).size!==names.length||inner.files!==names.length+1||JSON.stringify([...fs.readdirSync(out)].sort())!==JSON.stringify([...names,'closure.json','intent.json','cli.stdout.bin','cli.stderr.bin'].sort()))throw Error('outer-artifact-inventory');const attempt=JSON.parse(boundedRead(resolve(out,'attempt.json'),16384));if(attempt.runId!==runId||attempt.nonce!==nonce||attempt.intentSha256!==intentRef.sha256||attempt.buildInventorySha256!==summary.buildInventorySha256||inner.buildInventorySha256!==summary.buildInventorySha256||phase.process?.pid!==observed.browser?.pid||phase.process?.profileDir!==observed.browser?.profileDir)throw Error('outer-attempt-join');if(!observed.controllerGroupGone||!observed.browserGroupGone||!observed.profileGone)throw Error('outer-group-profile-closure');if(JSON.stringify(prepare())!==JSON.stringify(before))throw Error('source-drift');const build=JSON.parse(boundedRead(resolve(out,'build-binding.json'),8388608));recheckBuildInputs(build);if(sha(JSON.stringify(build))!==summary.buildInventorySha256)throw Error('build-drift');const outputs=build.emitted.map(f=>({...f,contents:boundedRead(resolve(out,f.name),8388608)}));if(JSON.stringify(validateEmittedImports({receipt:build,outputs}))!==JSON.stringify(build.embeddedAssets)||JSON.stringify(selectedSourceStaticWitness(build))!==JSON.stringify(build.sourceStaticWitness))throw Error('outer-source-static');const needed=requiredStaticOutputs(build.outputGraph,'sentinel.mjs'),loaded=new Set(phase.network.loaded.map(f=>f.path.slice(1)));if([...needed].some(name=>!loaded.has(name)))throw Error('outer-loaded-graph');}catch(e){failure??=String(e.message).slice(0,512);}
 let prefix=inventory(out);if(prefix.files+1>640||prefix.bytes+65536>33554432)throw Error('outer-receipt-reservation');if(performance.now()>=deadline)failure??='deadline';
 const receipt={kind:'copilot-module-binding-outer-v1',runId,status:failure?'unavailable':'observed',reason:failure,original,sourceBefore:before,sourceAfter:prepare(),completedPrefix:{files:prefix.files,bytes:prefix.bytes,sha256:prefix.sha256},ownFuturePersistence:'not self-attested; final terminal and original command exit must be joined',innerStatus:inner?.status??'unavailable',qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,warmReadiness:'unavailable',liveReadiness:'unavailable',fps:'unavailable'};
 writeClosed(resolve(out,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'),65536);const final=inventory(out);if(performance.now()>=deadline||JSON.stringify(prepare())!==JSON.stringify(before))failure??='finalization-boundary-or-source';
 return {kind:'copilot-module-binding-terminal-v1',status:failure?'unavailable':'observed',reason:failure,runId,output:out,inventory:final,retainedProfileCoverage:observed.profileGone?'absent':'unknown/unavailable',allRetainedInventoryCoverage:observed.profileGone?'owned output enumerated':'unavailable',elapsedMs:performance.now()-start,withinOriginalBoundary:performance.now()<deadline,qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,warmReadiness:'unavailable',liveReadiness:'unavailable',fps:'unavailable'};
}
async function runFunctional(options){const start=performance.now(),deadline=start+120000,before=prepare(),runId=options.runId??randomUUID(),out=options.out??join(fs.mkdtempSync(join(tmpdir(),'copilot-module-binding-tests-')),'run');fs.mkdirSync(out,{mode:0o700});writeClosed(resolve(out,'intent.json'),Buffer.from(JSON.stringify({kind:'copilot-module-binding-functional-intent-v1',runId,source:before,browser:false})+'\n'),65536);const env=Object.fromEntries(['HOME','TMPDIR','PATH'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));const {stdout,...original}=await captureCase([process.execPath,'--test','--test-concurrency=1','--test-timeout=5000',resolve(here,'conformance.node.mjs'),resolve(here,'portability.node.mjs')],{out,deadline,env});let reason=original.failure;if(JSON.stringify(prepare())!==JSON.stringify(before))reason??='source-drift';if(performance.now()>=deadline)reason??='deadline';const prefix=inventory(out,95,8388608-65536);writeClosed(resolve(out,'receipt.json'),Buffer.from(JSON.stringify({kind:'copilot-module-binding-functional-prefix-v1',runId,status:reason?'unavailable':'closed',reason,original,completedPrefix:prefix,ownFuturePersistence:'not self-attested; join terminal and actual command exit',browser:false,qualification:false,performance:false})+'\n'),65536);const final=inventory(out,96,8388608);if(performance.now()>=deadline||JSON.stringify(prepare())!==JSON.stringify(before))reason??='finalization-boundary-or-source';return {kind:'copilot-module-binding-functional-terminal-v1',status:reason?'unavailable':'closed',reason,runId,output:out,inventory:final,elapsedMs:performance.now()-start,browser:false,qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'};}
if(process.argv[1]&&fs.realpathSync(resolve(process.argv[1]))===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).join(' ')==='--browser --case'){if(!process.send||!process.env.MODULE_BINDING_NONCE)throw Error('private-case-channel');process.once('message',context=>{if(context?.type!=='start'||context.nonce!==process.env.MODULE_BINDING_NONCE)throw Error('private-case-channel');runCase(context).catch(error=>{process.stderr.write('module-binding-case-refused: '+error.message+'\n');process.exitCode=1;}).finally(()=>{if(process.connected)process.disconnect();});});}
 else main(process.argv.slice(2)).then(result=>{process.stdout.write('COPILOT_MODULE_BINDING_TERMINAL '+JSON.stringify(result)+'\n');process.exitCode=['observed','prepared','closed'].includes(result.status)?0:1;},error=>{process.stderr.write('copilot-module-binding-refused: '+error.message+'\n');process.exitCode=1;});
}
