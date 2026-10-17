// Unused hosted native source. Never rebuild or import the worker before admission.
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream,constants} from 'node:fs';
import {mkdir,lstat,realpath,writeFile,readdir,open} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readSourceSnapshot,COPILOT_PRODUCTION_SOURCES} from '../tests/support/hosted-copilot-context.ts';
import {ordinaryPath,assertInventory,assertProductionOutputInventory,assertOriginalCommand} from '../tests/support/hosted-copilot-contract.ts';
import {MOUNTED_PACKAGE_PINS,evaluateMountedAdmissionPolicy,evaluateMountedTrackerAAdmissionPolicy,evaluateMountedTrackerAPilotPrerequisites,evaluateMountedOriginPolicy,evaluateMountedModulePolicy,evaluateMountedClosurePolicy,WORKER_ZOD_PUBLIC_BINDING,resolveMountedPublicEntry} from '../tests/support/hosted-copilot-mounted-policy.ts';
import {validateWorkerContractSourceGraph,assertWorkerComponentPins,WORKER_STATIC_COMPONENT_PATHS} from '../tests/support/hosted-copilot-worker-static-policy.ts';
import {copyHistoryReadinessDiagnostic} from '../apps/copilotkit/src/geometry.ts';
import {evaluateMountedGeometry,evaluateHistoricalAnchor} from '../apps/copilotkit/src/geometry-policy.ts';
import {checkJourney} from '../apps/copilotkit/runtime/mounted-conformance.ts';
import {TRACKER_A_TRACE_CONFIG} from '../apps/copilotkit/runtime/mounted-tracker-a-trace.ts';

/** Fixed profile identity expectations from contract/src/long-thread.ts H100
 * history Array.from law: history-i, even assistant/odd user. No generator runs,
 * DOM/content authentication or caller-provided identity catalog is implied. */
export function createRestoredHistoryDiagnosticPort(write){
 const history=Array.from({length:100},(_,i)=>({id:`history-${i}`,role:i%2===0?'assistant':'user'}));
 const used=new Set();let writing=false;
 return {async emitReadinessSummary(value){
  const descriptor=typeof value==='object'&&value!==null?Object.getOwnPropertyDescriptor(value,'caseNumber'):undefined;
  const number=descriptor&&'value'in descriptor?descriptor.value:undefined;
  need(number===1||number===2,'Readiness case identity denied');
  const record=copyHistoryReadinessDiagnostic(value,{caseNumber:number,journey:number===1?'follow':'history-reading',threadId:`native-thread-${number}`,history});
  const bytes=Buffer.from(JSON.stringify(record)+'\n','utf8');need(bytes.length<=4096,'Readiness line cap');
  need(!writing&&!used.has(number)&&used.size<2,'Readiness publication already attempted');used.add(number);writing=true;
  try{await new Promise((resolve,reject)=>{try{write(bytes,error=>error?reject(error):resolve());}catch(error){reject(error);}});}finally{writing=false;}
 }};
}

const RELEASE='hosted-copilot-react-h100-r6400-v8',REPOSITORY='cacheplane/chat-ui-bench';
const globalOriginalLabels=['workerImport','browserLaunch','browserConnect','clientClose','clientDisconnected','browserServerClose','publicServerClose','applicationChildExit','applicationChildClose','parentWorkerClose'];
const MiB=1024*1024,hash=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,message='Mounted bootstrap refused')=>{if(!ok)throw new Error(message);};
const id=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const boundedError=e=>{try{return e instanceof Error?e.message.slice(0,512):'Original operation failed';}catch{return 'Original operation failed';}};
const PILOT_RELEASE='hosted-copilot-react-tracker-json-a-v2',PILOT_MODE='tracker-json-a-pilot-v1';
const nativePrerequisiteRelease='hosted-copilot-react-h100-r6400-v8';
let selectedBootstrapMode=null,pilotPhase=null,pilotKnown=null;
const contextFields=['candidateSha','checkoutSha','githubSha','workflowSha','tagSha','repository','releaseId','githubRef','workflowRef','eventName','actions','platform','runnerOs','runnerMarker','attempt'];
function ownData(value,keys){
 need(value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'Own plain data required');
 const names=Reflect.ownKeys(value);need(names.length===keys.length&&names.every(key=>typeof key==='string'&&keys.includes(key)),'Closed data fields required');
 const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);need(d&&'value'in d,'Accessors denied');Object.defineProperty(result,key,{value:d.value,enumerable:true});}return result;
}
function denseData(value,cap){need(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length<=cap&&Reflect.ownKeys(value).length===value.length+1,'Dense bounded array required');const result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));need(d&&'value'in d,'Array accessors denied');result.push(d.value);}return result;}
const bool=v=>{need(typeof v==='boolean');return v;};
const count=v=>{need(Number.isSafeInteger(v)&&v>=0);return v;};
const exitCode=v=>{need(v===null||Number.isInteger(v)&&v>=-2147483648&&v<=2147483647);return v;};
const signal=v=>{need(v===null||typeof v==='string'&&v.length<=64);return v;};
const encoded=value=>Buffer.from(JSON.stringify(value)+'\n','utf8');
export function selectMountedBootstrapMode(value){
 const c=ownData(value,contextFields);for(const v of Object.values(c))need(typeof v==='string'&&v.length>0&&v.length<=256);
 need(sha(c.candidateSha)&&['checkoutSha','githubSha','workflowSha','tagSha'].every(k=>c[k]===c.candidateSha),'Selected source context differs');
 need(c.repository===REPOSITORY&&c.eventName==='workflow_dispatch'&&c.actions==='true'&&c.platform==='linux'&&c.runnerOs==='Linux'&&c.attempt==='1','Hosted context differs');
 const pilot=c.releaseId===PILOT_RELEASE;need(pilot||c.releaseId===RELEASE,'Unknown fixed mode');
 const ref='refs/tags/'+(pilot?PILOT_RELEASE:RELEASE),workflow=pilot?'hosted-copilot-tracker-a.yml':'hosted-copilot-mounted.yml';
 need(c.githubRef===ref&&c.workflowRef===REPOSITORY+'/.github/workflows/'+workflow+'@'+ref&&c.runnerMarker===(pilot?'ubuntu-24.04-hosted-copilot-tracker-a':'ubuntu-24.04-hosted-copilot-mounted'),'Mixed fixed mode');return pilot?'tracker-a':'ordinary';
}
function captureArgv(value){const argv=denseData(value,4);need(argv.length===4&&argv.every(v=>typeof v==='string')&&Buffer.byteLength(JSON.stringify(argv))<=8192,'Pilot original argv bound');return argv;}
export function constructMountedCaptureResult(value){
 const r=ownData(value,['argv','original','spawned','spawnError','timedOut','terminationRequested','exitObserved','exit','closeObserved','streamFacts','descendantClosure','qualification']);
 const o=ownData(r.original,['exitCode','signal','stdoutBytes','stderrBytes','stdoutRetainedBytes','stderrRetainedBytes','closed','streamsComplete']);
 const original={exitCode:exitCode(o.exitCode),signal:signal(o.signal),stdoutBytes:count(o.stdoutBytes),stderrBytes:count(o.stderrBytes),stdoutRetainedBytes:count(o.stdoutRetainedBytes),stderrRetainedBytes:count(o.stderrRetainedBytes),closed:bool(o.closed),streamsComplete:bool(o.streamsComplete)};
 const stream=value=>{const s=ownData(value,['readableEOF','writerFinish','writerClose','writerError','seen','retained','retainedBytesKnown','overflow']);return {readableEOF:bool(s.readableEOF),writerFinish:bool(s.writerFinish),writerClose:bool(s.writerClose),writerError:bool(s.writerError),seen:count(s.seen),retained:count(s.retained),retainedBytesKnown:bool(s.retainedBytesKnown),overflow:bool(s.overflow)};};
 const streams=ownData(r.streamFacts,['stdout','stderr']),e=r.exit===null?null:ownData(r.exit,['exitCode','signal']);
 need(r.spawnError===null||typeof r.spawnError==='string'&&r.spawnError.length<=512);need(r.descendantClosure==='unqualified'&&r.qualification===false);
 const result={argv:captureArgv(r.argv),original,spawned:bool(r.spawned),spawnError:r.spawnError,timedOut:bool(r.timedOut),terminationRequested:bool(r.terminationRequested),exitObserved:bool(r.exitObserved),exit:e===null?null:{exitCode:exitCode(e.exitCode),signal:signal(e.signal)},closeObserved:bool(r.closeObserved),streamFacts:{stdout:stream(streams.stdout),stderr:stream(streams.stderr)},descendantClosure:'unqualified',qualification:false};
 need(encoded(result).length<=16384,'Pilot capture result subcap');return result;
}
export function serializeMountedFailure(action,error,workerImport){
 need(['prepare','install','provision','run','parent','child','native-child'].includes(action));
 if(action==='native-child')need(workerImport==='fulfilled'||workerImport==='rejected');
 const name=action==='native-child'?'native-child-failure.json':'phase-failure-'+action+'.json';
 const value=action==='native-child'?{workerImport,reason:boundedError(error),qualification:false}:{action,reason:boundedError(error),status:'incomplete',qualification:false};
 const raw=encoded(value);need(raw.length<=4096,'Original failure output bound');return {name,raw,cap:4096};
}
// Literal finite role unions, never a spendable shared remainder or persisted ledger.
function traceRoles(){return [
 ['tracker-a-case-2-trace.json',4194304,'child'],['tracker-a-case-2-input.json',262144,'child'],['tracker-a-case-2-transport.json',262144,'child'],['tracker-a-result.json',262144,'outer'],
 ['native-case-1.json',2097152,'child'],['native-case-2.json',2097152,'child'],['native-child-result.json',524288,'child'],['native-parent-partial.json',524288,'parent'],['native-result.json',524288,'outer'],
 ['application-result.json',16384,'parent'],['parent-result.json',16384,'outer'],['application.stdout',262144,'parent'],['application.stderr',262144,'parent'],['parent.stdout',4194304,'outer'],['parent.stderr',4194304,'outer'],
 ['browser-stdout.bin',262144,'parent'],['browser-stderr.bin',262144,'parent'],['native-inventory.json',524288,'outer'],['phase-failure-child.json',4096,'child'],['phase-failure-parent.json',4096,'parent'],['phase-failure-run.json',4096,'outer'],['native-child-failure.json',4096,'child']
 ].map(([path,cap,owner])=>({path,cap,owner}));}
function runtimeClosedNames(phase){
 switch(phase){case 'runtime':return [];case 'runtime-registry-closed':return ['browser-registry.json'];case 'runtime-parent-started-closed':return ['browser-registry.json','parent-started.json'];case 'runtime-process-closed':return ['browser-registry.json','parent-started.json','browser-process.json'];case 'runtime-options-closed':return ['browser-registry.json','parent-started.json','browser-process.json','native-child-options.json'];default:throw Error('Unknown fixed runtime transition');}
}
export function mountedTrackerAReservation(phase,closed,known={}){
 let roles=[],replacements=[];const add=(path,cap,owner='phase')=>{count(cap);need(cap>0&&cap<=33554432);roles.push({path,cap,owner});};
 if(phase==='trace'||phase.startsWith('runtime')){
  roles=traceRoles();if(phase!=='trace'){
   const k=ownData(known,['registryBytes','optionsBytes','parentStartedBytes','applicationStartedBytes']);
   for(const [key,max] of [['registryBytes',262144],['optionsBytes',524288],['parentStartedBytes',524288],['applicationStartedBytes',524288]])need(Number.isSafeInteger(k[key])&&k[key]>0&&k[key]<=max);
   add('parent-started.json',k.parentStartedBytes,'outer');add('browser-process.json',524288,'parent');add('native-child-options.json',k.optionsBytes,'parent');add('application-started.json',k.applicationStartedBytes,'parent');
   add('browser-registry.json',k.registryBytes,'outer');const completed=runtimeClosedNames(phase);replacements=roles.filter(r=>completed.includes(r.path)).map(r=>[r.path,r.cap]);roles=roles.filter(r=>!completed.includes(r.path));
  }
 }else{
  add('native-inventory.json',524288,'outer');
  if(phase!=='inventory')add('phase-failure-'+(phase.startsWith('prepare-')?'prepare':phase==='installed'?'install':phase==='provision'?'provision':'install')+'.json',4096);
  const command=(name,stream)=>{add(name+'-started.json',524288);add(name+'.stdout',stream);add(name+'.stderr',stream);add(name+'-result.json',524288);};
  const get=(stem,body,cap)=>{add(stem+'-intent.json',524288);add(body,cap);add(stem+'-receipt.json',524288);};
  switch(phase){
   case 'prepare-profile':command('profile',65536);break;
   case 'prepare-intent':add('native-intent.json',524288);break;
   case 'prepare-static-run':get('prerequisite-run','prerequisite-run.json',524288);break;
   case 'prepare-static-artifact':get('prerequisite-artifact','prerequisite-artifact.json',262144);break;
   case 'prepare-static-zip':case 'prepare-native-zip':need(Number.isSafeInteger(known.archiveBytes)&&known.archiveBytes>0&&known.archiveBytes<=33554432);get(phase==='prepare-static-zip'?'static-prerequisite':'native-prerequisite',phase==='prepare-static-zip'?'static-prerequisite.zip':'native-prerequisite.zip',known.archiveBytes);break;
   case 'prepare-extract':command('extract',4194304);break;
   case 'prepare-settings':add('frontend-settings.json',65536);break;
   case 'prepare-prerequisite':add('prerequisite.json',524288);break;
   case 'prepare-native-run':get('native-prerequisite-run','native-prerequisite-run.json',524288);break;
   case 'prepare-native-artifact':get('native-prerequisite-artifact','native-prerequisite-artifact.json',262144);break;
   case 'prepare-tracker-profile':add('tracker-a-profile.json',16384);break;
   case 'install':command('install',4194304);add('installed-admission.json',524288);break;
   case 'installed':add('installed-admission.json',524288);break;
   case 'provision':command('browser-install',4194304);break;
   case 'inventory':break;
   default:throw Error('Unknown fixed phase');
  }
 }
 const seen=new Set(),rows=denseData(closed,128);let bytes=roles.reduce((sum,r)=>sum+r.cap,0),files=roles.length;
 for(const value of rows){const row=ownData(value,['path','bytes']);need(typeof row.path==='string'&&ordinaryPath(row.path)&&!seen.has(row.path));seen.add(row.path);count(row.bytes);need(row.bytes<=33554432);if(roles.some(role=>role.path===row.path))continue;const previous=replacements.find(([path])=>path===row.path);if(previous)need(row.path==='browser-registry.json'?row.bytes===previous[1]:row.bytes<=previous[1],'Original startup replacement differs');bytes+=row.bytes;files++;}
 for(const [path] of replacements)need(seen.has(path),'Original registry physical close absent');
 need(Number.isSafeInteger(bytes)&&bytes<=33554432&&files<=128,'Pilot phase union capacity refused');return {roles,bytes,files};
}
function providerField(value,key){need(value!==null&&typeof value==='object'&&!Array.isArray(value));const d=Object.getOwnPropertyDescriptor(value,key);need(d&&'value'in d,'Provider own data required');return d.value;}
export function validateOrdinaryNativePrerequisiteProvider(value,run,artifact){
 const expected=ownData(value,['sourceSha','originalRunId','artifactId','archiveSha256']);need(sha(expected.sourceSha)&&id(expected.originalRunId)&&id(expected.artifactId)&&digest(expected.archiveSha256));
 const r=k=>providerField(run,k),a=k=>providerField(artifact,k),workflow=a('workflow_run');
 const runId=r('id'),artifactId=a('id'),workflowRunId=providerField(workflow,'id');
 need([runId,artifactId,workflowRunId,r('workflow_id')].every(n=>Number.isSafeInteger(n)&&n>0),'Provider numeric identity precision unavailable');
 need(String(runId)===expected.originalRunId&&r('run_attempt')===1&&r('head_sha')===expected.sourceSha&&r('event')==='workflow_dispatch'&&r('workflow_id')===386692729&&r('name')===nativePrerequisiteRelease&&r('path')==='.github/workflows/hosted-copilot-mounted.yml'&&r('head_branch')===nativePrerequisiteRelease&&r('display_title')===nativePrerequisiteRelease&&r('status')==='completed'&&r('conclusion')==='success'&&providerField(r('repository'),'full_name')===REPOSITORY,'Original ordinary native run differs');
 const size=a('size_in_bytes');need(String(artifactId)===expected.artifactId&&a('name')==='copilot-mounted-'+expected.originalRunId+'-1'&&a('expired')===false&&Number.isSafeInteger(size)&&size>0&&size<=33554432&&a('digest')==='sha256:'+expected.archiveSha256&&String(workflowRunId)===expected.originalRunId&&providerField(workflow,'head_sha')===expected.sourceSha,'Original ordinary native artifact differs');
 return {sourceSha:expected.sourceSha,qualification:false};
}
export function bindOpaqueNativePrerequisite(value,receipt,raw){
 const e=ownData(value,['sourceSha','originalRunId','artifactId','archiveSha256','archiveBytes']),r=ownData(receipt,['url','status','bytes','observedBytes','bodyComplete','sha256','qualification']);
 need(sha(e.sourceSha)&&id(e.originalRunId)&&id(e.artifactId)&&digest(e.archiveSha256)&&Number.isSafeInteger(e.archiveBytes)&&e.archiveBytes>0&&e.archiveBytes<=33554432);need(raw instanceof Uint8Array&&Object.getPrototypeOf(raw)!==null);
 need(r.url==='https://api.github.com/repos/'+REPOSITORY+'/actions/artifacts/'+e.artifactId+'/zip'&&r.status===200&&r.bodyComplete===true&&r.qualification===false&&r.observedBytes===e.archiveBytes&&r.bytes===e.archiveBytes&&raw.byteLength===e.archiveBytes&&r.sha256===e.archiveSha256&&hash(raw)===e.archiveSha256,'Opaque native original byte binding differs');
 return {bytes:raw.byteLength,sha256:e.archiveSha256,qualification:false};
}
function pilotRoleCap(name){
 const trace=traceRoles().find(r=>r.path===name);if(trace)return trace.cap;
 if(name==='tracker-a-profile.json')return 16384;
 if(/^phase-failure-(?:prepare|install|provision)\.json$/.test(name))return 4096;
 if(name==='browser-registry.json')return 262144;
 if(['parent-started.json','application-started.json','browser-process.json','native-child-options.json'].includes(name))return 524288;
 if(/^(?:profile|extract|install|browser-install)(?:-(?:started|result)\.json)$/.test(name))return 524288;
 if(/^profile\.(?:stdout|stderr)$/.test(name))return 65536;
 if(/^(?:extract|install|browser-install)\.(?:stdout|stderr)$/.test(name))return 4194304;
 if(/^(?:native-)?prerequisite-artifact\.json$/.test(name))return 262144;
 if(/^(?:(?:native-)?prerequisite-(?:run|artifact)|(?:static|native)-prerequisite)-(?:intent|receipt)\.json$/.test(name))return 524288;
 if(/^(?:prerequisite-run|native-prerequisite-run|native-intent|prerequisite|installed-admission)\.json$/.test(name))return 524288;
 if(name==='frontend-settings.json')return 65536;
 if(name==='static-prerequisite.zip'||name==='native-prerequisite.zip')return 33554432;
 throw Error('Unknown pilot output role');
}
export async function writeTrackerAPilotFile(directory,name,raw,allocatedCap=pilotRoleCap(name)){
 need(Number.isSafeInteger(allocatedCap)&&allocatedCap>=0&&allocatedCap<=pilotRoleCap(name)&&ordinaryPath(name)&&raw instanceof Uint8Array&&raw.byteLength<=allocatedCap,'Pilot physical role bound');
 const parent=await lstat(directory);need(parent.isDirectory()&&!parent.isSymbolicLink()&&await realpath(directory)===directory,'Pilot output directory ownership');
 const path=join(directory,name),file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 return closeTrackerAPilotFile(raw,{write:bytes=>file.writeFile(bytes),fsync:()=>file.sync(),close:()=>file.close()},async()=>{const after=await physical(path,pilotRoleCap(name));need(after.bytes===raw.byteLength&&after.sha256===hash(raw),'Pilot original physical bytes differ');return {path:name,bytes:after.bytes,sha256:after.sha256};});
}
export async function closeTrackerAPilotFile(raw,writer,authenticate){
 let failed=false,primary;try{await writer.write(raw);await writer.fsync();}catch(error){failed=true;primary=error;}
 try{await writer.close();}catch(error){if(!failed){failed=true;primary=error;}}if(failed)throw primary;return await authenticate();
}
export async function runTrackerAPilotAction(action,perform,setExit){
 setExit(1);need(['prepare','install','provision','inventory','child','parent','run'].includes(action));const result=await perform();
 if(action==='child'||action==='parent'){need(result==='complete'||result==='incomplete','Original closed publication status absent');setExit(result==='complete'?0:2);}
 else if(action==='run'){need(result==='complete'||result==='incomplete','Original run outcome absent');if(result==='complete')setExit(0);}
 else setExit(0);
}
export async function handleMountedBootstrapFailure(error,setExit,report){setExit(1);await report(error);}
export async function publishTrackerAInternalReport(action,value,publish){
 need(action==='child'||action==='parent');const retained=action==='child'?childStages(value):constructTrackerAParentPartial(value);await publish(retained);return retained.status;
}
export async function authenticateTrackerAReport(command,action,profileRef,ports){
 need(action==='child'||action==='parent');const c=constructMountedCaptureResult(command);startupArgv(c.argv,action);const cap=action==='child'?262144:4194304;
 need(c.spawned&&c.spawnError===null&&!c.timedOut&&!c.terminationRequested&&c.exitObserved&&c.closeObserved&&c.exit!==null&&[0,2].includes(c.exit.exitCode)&&c.exit.signal===null&&c.original.closed&&c.original.streamsComplete&&c.original.exitCode===c.exit.exitCode&&c.original.signal===null,'Original report process publication unavailable');
 for(const key of ['stdout','stderr']){const s=c.streamFacts[key];need(s.readableEOF&&s.writerFinish&&s.writerClose&&!s.writerError&&!s.overflow&&s.retainedBytesKnown&&s.seen===s.retained&&s.retained<=cap&&c.original[key+'Bytes']===s.seen&&c.original[key+'RetainedBytes']===s.retained,'Original report stdio publication unavailable');}
 const profile=fileRef(profileRef,'tracker-a-profile.json');need(profile!==null);
 const read=async(name,limit)=>{const f=ownData(await ports.read(name,limit),['raw','bytes','sha256']);need(f.raw instanceof Uint8Array&&f.bytes===f.raw.byteLength&&f.bytes<=limit&&digest(f.sha256)&&hash(f.raw)===f.sha256,'Original report physical binding differs');return f;};
 const name=action==='child'?'native-child-result.json':'native-parent-partial.json',f=await read(name,524288),parsed=JSON.parse(Buffer.from(f.raw).toString('utf8')),value=action==='child'?childStages(parsed):constructTrackerAParentPartial(parsed);
 need(value.status===(c.exit.exitCode===0?'complete':'incomplete'),'Original publication status differs');
 const bind=async(ref,name,limit)=>{const r=fileRef(ref,name);if(r===null)return null;const original=await read(name,limit);need(r.bytes===original.bytes&&r.sha256===original.sha256,'Transitive publication bytes differ');return JSON.parse(Buffer.from(original.raw).toString('utf8'));};
 if(action==='child'){
  const snapshots=[];for(const number of [1,2]){const caseFile=await read('native-case-'+number+'.json',2097152),record=ownData(JSON.parse(Buffer.from(caseFile.raw).toString('utf8')),['caseNumber','cases','snapshots','qualification']);need(record.caseNumber===number&&record.qualification===false&&JSON.stringify(record.cases)===JSON.stringify(value.caseEvidence.filter(c=>c.caseNumber===number)));snapshots.push(...copyPilotSnapshots(record.snapshots));}const input=copyTrackerAInput(await bind(value.tracker.inputRef,'tracker-a-case-2-input.json',262144),snapshots),transport=copyTrackerATransport(await bind(value.tracker.transportRef,'tracker-a-case-2-transport.json',262144));
  if(input)need(JSON.stringify(input.profileRef)===JSON.stringify(profile),'Input profile differs');if(transport){need(JSON.stringify(transport.profileRef)===JSON.stringify(profile),'Transport profile differs');if(transport.raw.ref!==null){need(transport.sink.fileClose==='fulfilled','Raw original close absent');const raw=await read('tracker-a-case-2-trace.json',4194304);need(transport.raw.ref.bytes===raw.bytes&&transport.raw.ref.sha256===raw.sha256,'Raw original binding differs');}}
 }else if(value.tracker.childResultRef!==null){const child=await authenticateTrackerAReport(value.applicationCommand,'child',profile,ports);need(JSON.stringify(child.ref)===JSON.stringify(value.tracker.childResultRef),'Parent child reference differs');need(JSON.stringify(value.cases)===JSON.stringify(child.value.cases)&&JSON.stringify(value.caseEvidence)===JSON.stringify(child.value.caseEvidence)&&value.browserVersion===child.value.browserVersion,'Parent child facts differ');}
 return {value,ref:{path:name,bytes:f.bytes,sha256:f.sha256}};
}
export async function createTrackerATraceSink(ports){
 await ports.reserve();const writer=await ports.open();let retained=0,writing=false,lastWrite=Promise.resolve(),finishOriginal=null,failed=false,primary;
 const remember=error=>{if(!failed){failed=true;primary=error;}};
 const sink={created:true,fsync:null,fileClose:null,write(bytes){
  if(finishOriginal!==null||writing||failed||!(bytes instanceof Uint8Array)||bytes.byteLength===0||retained+bytes.byteLength>4194304)return Promise.reject(Error('Raw sink write bound/ownership'));
  retained+=bytes.byteLength;writing=true;let original;try{original=Promise.resolve(writer.write(bytes));}catch(error){original=Promise.reject(error);}
  lastWrite=original.then(()=>{writing=false;},error=>{writing=false;remember(error);throw error;});void lastWrite.catch(()=>{});return lastWrite;
 },finish(){
  if(finishOriginal!==null)return finishOriginal;
  const close=()=>{try{sink.fileClose=writer.close();}catch(error){sink.fileClose=Promise.reject(error);}return sink.fileClose;};
  const start=()=>{
   try{sink.fsync=writer.fsync();}catch(error){sink.fsync=Promise.reject(error);}
   return (async()=>{try{await sink.fsync;}catch(error){remember(error);}finally{try{await close();}catch(error){remember(error);}}
    if(failed)throw primary;const ref=await ports.authenticate();const r=ownData(ref,['path','bytes','sha256']);need(r.path==='tracker-a-case-2-trace.json'&&r.bytes===retained&&digest(r.sha256),'Original raw physical binding differs');return {path:r.path,bytes:r.bytes,sha256:r.sha256};})();
  };
  finishOriginal=writing?lastWrite.catch(remember).then(start):start();void finishOriginal.catch(()=>{});return finishOriginal;
 }};return sink;
}
const trackerAuthority=()=>({qualification:false,fps:'unavailable',ratio:'unavailable',scoring:false,ranking:false});
const trackerStage=(complete,reason)=>({status:complete?'complete':'incomplete',reason:complete?null:reason});
const originalStates=['not-started','pending','fulfilled','rejected'];
function finite(value){need(typeof value==='number'&&Number.isFinite(value));return value;}
function boundedText(value,cap){need(typeof value==='string'&&value.length<=cap&&Buffer.byteLength(value)<=cap);return value;}
// Only finite public records reach this copier. Private errors/drain never do.
function copyPublicationData(value,cap){
 let visits=0;const active=new Set();
 function copy(v,depth){need(++visits<=65536&&depth<=24,'Publication shape capacity');if(v===null||typeof v==='boolean')return v;if(typeof v==='number')return finite(v);if(typeof v==='string')return boundedText(v,65536);
  need(v!==null&&typeof v==='object'&&!active.has(v),'Finite publication data required');active.add(v);let result;
  if(Array.isArray(v))result=denseData(v,4096).map(x=>copy(x,depth+1));else{need([Object.prototype,null].includes(Object.getPrototypeOf(v)));const keys=Reflect.ownKeys(v);need(keys.length<=64&&keys.every(k=>typeof k==='string'));const r=ownData(v,keys);result={};for(const key of keys)Object.defineProperty(result,key,{value:copy(r[key],depth+1),enumerable:true});}active.delete(v);return result;
 }
 const result=copy(value,0);need(encoded(result).length<=cap,'Public artifact serialization cap');return result;
}
function fileRef(value,path){if(value===null)return null;const r=ownData(value,['path','bytes','sha256']);need(r.path===path&&Number.isSafeInteger(r.bytes)&&r.bytes>=0&&r.bytes<=pilotRoleCap(path)&&digest(r.sha256),'Physical reference shape');return {path,bytes:r.bytes,sha256:r.sha256};}
function assertAuthority(value){need(JSON.stringify(ownData(value,['qualification','fps','ratio','scoring','ranking']))===JSON.stringify(trackerAuthority()),'Pilot authority differs');}
function assertStage(value,reasons){const r=ownData(value,['status','reason']);need(['not-started','incomplete','complete'].includes(r.status)&&((r.status==='complete'||r.status==='not-started')?r.reason===null:reasons.includes(r.reason)),'Pilot stage differs');}
function assertReceipt(value,requested='requestedHostMs'){const r=ownData(value,['status',requested,'settledHostMs']);need(originalStates.includes(r.status));if(r[requested]!==null)finite(r[requested]);if(r.settledHostMs!==null)finite(r.settledHostMs);}
function assertListener(value){const r=ownData(value,['registration','removal','ownedIdentityMatch']);assertReceipt(r.registration);assertReceipt(r.removal);need(r.ownedIdentityMatch===null||typeof r.ownedIdentityMatch==='boolean');}
function closedListener(value){return value.registration.status==='fulfilled'&&value.removal.status==='fulfilled'&&value.ownedIdentityMatch===true;}
function copyCases(value){return denseData(value,2).map((v,i)=>{
 const r=ownData(v,['caseNumber','journey','threadId','seedRunId','continuationRunId','repetition','completed','publicIdle','storeEmpty','domainReleased','originals']);need(r.caseNumber===i+1&&r.journey===(i===0?'follow':'history-reading'));
 for(const k of ['threadId','seedRunId','continuationRunId','repetition'])need(/^[A-Za-z0-9._-]{1,128}$/.test(boundedText(r[k],128)));
 for(const k of ['completed','publicIdle','storeEmpty','domainReleased'])bool(r[k]);const labels=['seedReaderEOF','coldReaderEOF','mountedACK','publicRun','successfulTerminal','completionACK','bridge','producerFinish','producerReaderEOF','nativeOriginClose','producerOriginClose','remoteCloseAdmission','hostDispose','rootUnmount','pageClose','contextClose','storeClear','publicStoreEmpty','caseDomainRelease'];
 const originals=denseData(r.originals,19).map((value,index)=>{const row=ownData(value,['label','status']);need(row.label===labels[index]&&['fulfilled','pending','rejected','timed-out','unavailable'].includes(row.status));return {label:row.label,status:row.status};});need(originals.length===19);return {caseNumber:r.caseNumber,journey:r.journey,threadId:r.threadId,seedRunId:r.seedRunId,continuationRunId:r.continuationRunId,repetition:r.repetition,completed:r.completed,publicIdle:r.publicIdle,storeEmpty:r.storeEmpty,domainReleased:r.domainReleased,originals};
 });}
function caseAccepted(cases,n){return cases.length>=n&&evaluateMountedClosurePolicy({schemaVersion:1,kind:'case-boundary',priorCase:n===1?null:cases[0],currentCase:cases[n-1],secondStarted:n===2}).status==='accepted';}
function copyPilotSnapshots(value){let prior=1;const counts=[0,0];return denseData(value,9).map(v=>{
 const row=ownData(v,['caseNumber','snapshot']);need((row.caseNumber===1||row.caseNumber===2)&&row.caseNumber>=prior);prior=row.caseNumber;need(++counts[row.caseNumber-1]<=(row.caseNumber===1?4:5));
 const snapshot=copyPublicationData(row.snapshot,2097152);if(snapshot.status!=='available'){ownData(snapshot,['status','reason']);need(['invalid','unavailable'].includes(snapshot.status)&&typeof snapshot.reason==='string'&&snapshot.reason.length<=64);return {caseNumber:row.caseNumber,snapshot};}
 ownData(snapshot,['status','frame','evaluation','visibleMessages','scroll']);const evaluation=evaluateMountedGeometry(snapshot.frame);need(evaluation.status==='evaluated'&&JSON.stringify(evaluation)===JSON.stringify(snapshot.evaluation),'Actual geometry evaluation differs');
 ownData(snapshot.scroll,['scrollTop','scrollHeight','clientHeight']);for(const k of ['scrollTop','scrollHeight','clientHeight'])finite(snapshot.scroll[k]);for(const v of denseData(snapshot.visibleMessages,128)){const m=ownData(v,['id','text','topCssPx','bottomCssPx']);boundedText(m.id,128);boundedText(m.text,6400);finite(m.topCssPx);finite(m.bottomCssPx);}
 return {caseNumber:row.caseNumber,snapshot};
 });}
function semanticCase(cases,snapshots,n){
 if(!caseAccepted(cases,n))return false;const rows=snapshots.filter(s=>s.caseNumber===n).map(s=>s.snapshot);if(rows.length!==(n===1?4:5)||rows.some(s=>s.status!=='available'||s.frame.scopeId!==cases[n-1].threadId))return false;
 try{need(rows[0].frame.phase==='restored-history');const final=rows.at(-1);need(final.frame.phase==='completed'&&final.evaluation.rows.some(r=>r.id===final.frame.expectedResponse.id&&r.geometryEligibility==='eligible'&&r.textRelation==='exact'));
  if(n===1)checkJourney('follow',{samples:rows.slice(1,3),anchorId:null,returned:null,wheel:null});else{need(rows.slice(1,4).every(s=>s.frame.phase==='streaming'));need(rows[3].evaluation.rows.some(r=>r.id===rows[3].frame.expectedResponse.id&&r.geometryEligibility==='eligible'));}return true;
 }catch{return false;}
}
function copyTrackerAInput(value,snapshots){
 if(value===null)return null;const r=copyPublicationData(value,262144);ownData(r,['schemaVersion','kind','mode','caseNumber','profileRef','phase','geometryCheckpoints','anchor','listeners','pointer','scalarObservations','wheelRequests','wheelEvents','scrollEvents','motionEvents','losses','overflows','outcome','authority']);
 need(r.schemaVersion===1&&r.kind==='tracker-a-case-input'&&r.mode===PILOT_MODE&&r.caseNumber===2);fileRef(r.profileRef,'tracker-a-profile.json');assertAuthority(r.authority);
 const p=ownData(r.phase,['hostT0Ms','hostT1Ms','postBoundaryScalarOrdinal','postBoundarySettled','returnClick','completion','tail']);for(const k of ['hostT0Ms','hostT1Ms'])if(p[k]!==null)finite(p[k]);if(p.postBoundaryScalarOrdinal!==null)count(p.postBoundaryScalarOrdinal);need(originalStates.includes(p.postBoundarySettled));for(const k of ['returnClick','completion','tail'])assertReceipt(p[k],'startedHostMs');if(p.hostT0Ms!==null&&p.hostT1Ms!==null)need(p.hostT1Ms===p.hostT0Ms+2000);
 const checkpoints=ownData(r.geometryCheckpoints,['G0','G1','G2','G3','G4']);let index=0;for(const c of Object.values(checkpoints)){const q=ownData(c,['status','requestedHostMs','settledHostMs','snapshotRef']);assertReceipt({status:q.status,requestedHostMs:q.requestedHostMs,settledHostMs:q.settledHostMs});if(q.snapshotRef!==null){const ref=ownData(q.snapshotRef,['path','index']);need(ref.path==='native-case-2.json'&&ref.index===index&&snapshots.filter(s=>s.caseNumber===2)[index]!==undefined);}index++;}
 const listeners=ownData(r.listeners,['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose']);for(const l of Object.values(listeners))assertListener(l);
 if(r.anchor!==null){const a=ownData(r.anchor,['id','ownerToken','selectedAtHostMs','firstCheckpoint','secondCheckpoint','evaluation']);boundedText(a.id,128);count(a.ownerToken);finite(a.selectedAtHostMs);need(a.firstCheckpoint==='G1'&&a.secondCheckpoint==='G2');if(a.evaluation!==null){const frames=snapshots.filter(s=>s.caseNumber===2);need(frames[1]?.snapshot.status==='available'&&frames[2]?.snapshot.status==='available');need(JSON.stringify(evaluateHistoricalAnchor({schemaVersion:1,anchorId:a.id,first:frames[1].snapshot.frame,second:frames[2].snapshot.frame}))===JSON.stringify(a.evaluation));}}
 if(r.pointer!==null){const q=ownData(r.pointer,['requestedHostMs','settledHostMs','status','x','y']);assertReceipt({status:q.status,requestedHostMs:q.requestedHostMs,settledHostMs:q.settledHostMs});finite(q.x);finite(q.y);}
 for(const q of denseData(r.scalarObservations,82)){ownData(q,['ordinal','role','slot','requestedHostMs','settledHostMs','status','value']);count(q.ordinal);need(['pre','before','after','post'].includes(q.role));assertReceipt({status:q.status,requestedHostMs:q.requestedHostMs,settledHostMs:q.settledHostMs});if(q.slot!==null)need(Number.isInteger(q.slot)&&q.slot>=0&&q.slot<40);if(q.value!==null){const s=ownData(q.value,['pageNowMs','url','sameOriginalScroller','connected','uniqueSelector','innerWidth','innerHeight','devicePixelRatio','rect','scrollTop','scrollHeight','clientHeight']);boundedText(s.url,4096);for(const k of ['sameOriginalScroller','connected','uniqueSelector'])bool(s[k]);for(const k of ['pageNowMs','innerWidth','innerHeight','devicePixelRatio','scrollTop','scrollHeight','clientHeight'])finite(s[k]);const rect=ownData(s.rect,['x','y','width','height']);Object.values(rect).forEach(finite);}}
 for(const q of denseData(r.wheelRequests,40)){ownData(q,['slot','nominalHostMs','requestedHostMs','settledHostMs','status','beforeOrdinal','afterOrdinal']);need(Number.isInteger(q.slot)&&q.slot>=0&&q.slot<40);finite(q.nominalHostMs);assertReceipt({status:q.status,requestedHostMs:q.requestedHostMs,settledHostMs:q.settledHostMs});count(q.beforeOrdinal);if(q.afterOrdinal!==null)count(q.afterOrdinal);}
 for(const [key,cap,fields] of [['wheelEvents',40,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','isTrusted','deltaX','deltaY','deltaMode','targetContained','currentTargetIsScroller']],['scrollEvents',256,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','currentTargetIsScroller','scrollTop','scrollHeight','clientHeight']],['motionEvents',32,['ordinal','kind','receivedHostMs','pageNowMs','eventTimeStampMs','targetContained']]])for(const q of denseData(r[key],cap)){ownData(q,fields);for(const name of fields){if(name==='kind')need(['animationstart','transitionrun'].includes(q[name]));else if(['isTrusted','targetContained','currentTargetIsScroller'].includes(name))bool(q[name]);else finite(q[name]);}}
 for(const q of Object.values(ownData(r.losses,['navigation','context','page','session'])))if(q!==null){ownData(q,['firstHostMs','firstOverflowHostMs']);finite(q.firstHostMs);if(q.firstOverflowHostMs!==null)finite(q.firstOverflowHostMs);}
 for(const q of Object.values(ownData(r.overflows,['wheel','scroll','motion'])))if(q!==null){ownData(q,['firstHostMs','ordinal']);finite(q.firstHostMs);count(q.ordinal);}
 ownData(r.outcome,['phase','competingMotion','scenarioQualification']);assertStage(r.outcome.phase,['phase']);need(r.outcome.competingMotion==='unavailable'&&r.outcome.scenarioQualification==='unavailable');return r;
}
function copyTrackerATransport(value){
 if(value===null)return null;const r=copyPublicationData(value,262144);ownData(r,['schemaVersion','kind','mode','profileRef','raw','listeners','operations','completion','sessionClose','handles','handleOverflow','sink','portCalls','readCalls','knownReadBytes','outcome','authority']);need(r.schemaVersion===1&&r.kind==='tracker-a-transport'&&r.mode===PILOT_MODE);fileRef(r.profileRef,'tracker-a-profile.json');assertAuthority(r.authority);
 ownData(r.raw,['status','ref','extent']);need(['absent','known-prefix','complete-raw'].includes(r.raw.status));if(r.raw.status==='absent')need(r.raw.ref===null&&r.raw.extent==='unobserved');else{fileRef(r.raw.ref,'tracker-a-case-2-trace.json');need(r.raw.extent===(r.raw.status==='complete-raw'?'complete':'unknown'));if(r.raw.status==='complete-raw')need(r.raw.ref!==null);}
 for(const l of Object.values(ownData(r.listeners,['tracingComplete','sessionClose'])))assertListener(l);
 for(const [i,q] of denseData(r.operations,133).entries()){ownData(q,['ordinal','kind','requestedHostMs','settledHostMs','status','timedOut','handleOrdinal','bytes','eof','readOperationOrdinal']);need(q.ordinal===i+1&&['start','end','read','write','io-close','sink-finish','detach'].includes(q.kind));assertReceipt({status:q.status,requestedHostMs:q.requestedHostMs,settledHostMs:q.settledHostMs});bool(q.timedOut);need([null,1,2].includes(q.handleOrdinal));if(q.bytes!==null)count(q.bytes);need(q.eof===null||typeof q.eof==='boolean');if(q.readOperationOrdinal!==null)count(q.readOperationOrdinal);}
 ownData(r.completion,['firstHostMs','overflowHostMs','format','compression','dataLoss']);for(const k of ['firstHostMs','overflowHostMs'])if(r.completion[k]!==null)finite(r.completion[k]);need([null,'json','other'].includes(r.completion.format)&&[null,'none','other'].includes(r.completion.compression)&&(r.completion.dataLoss===null||typeof r.completion.dataLoss==='boolean'));
 ownData(r.sessionClose,['firstHostMs','overflowHostMs','originalSessionMatch','timing']);for(const k of ['firstHostMs','overflowHostMs'])if(r.sessionClose[k]!==null)finite(r.sessionClose[k]);need([null,true,false].includes(r.sessionClose.originalSessionMatch)&&['unobserved','expected-detach','unexpected-loss'].includes(r.sessionClose.timing));
 for(const [i,h] of denseData(r.handles,2).entries()){ownData(h,['ordinal','firstHostMs','role','closeOperationOrdinal']);need(h.ordinal===i+1&&['accepted','unexpected'].includes(h.role));finite(h.firstHostMs);if(h.closeOperationOrdinal!==null)count(h.closeOperationOrdinal);}
 if(r.handleOverflow!==null){ownData(r.handleOverflow,['firstHostMs','ordinal']);finite(r.handleOverflow.firstHostMs);need(r.handleOverflow.ordinal===3);}
 const sink=ownData(r.sink,['created','finish','fsync','fileClose']);bool(sink.created);for(const k of ['finish','fsync','fileClose'])need(originalStates.includes(sink[k]));for(const k of ['portCalls','readCalls','knownReadBytes'])count(r[k]);need(r.portCalls===r.operations.length&&r.readCalls<=64&&r.knownReadBytes<=4194304);
 ownData(r.outcome,['capture','containment']);assertStage(r.outcome.capture,['transport']);need(['verified','unverified'].includes(r.outcome.containment));return r;
}
function transportContained(t){
 return t!==null&&t.outcome.containment==='verified'&&t.handleOverflow===null&&t.handles.every(h=>h.closeOperationOrdinal!==null&&t.operations[h.closeOperationOrdinal-1]?.kind==='io-close'&&t.operations[h.closeOperationOrdinal-1]?.status==='fulfilled')&&t.sink.fileClose==='fulfilled'&&t.operations.some(o=>o.kind==='detach'&&o.status==='fulfilled')&&t.sessionClose.originalSessionMatch===true&&t.sessionClose.firstHostMs!==null&&Object.values(t.listeners).every(closedListener);
}
function transportComplete(t,ref){
 if(t===null||ref===null||!transportContained(t)||t.outcome.capture.status!=='complete'||t.raw.status!=='complete-raw'||JSON.stringify(t.raw.ref)!==JSON.stringify(ref)||t.operations.some(o=>o.status!=='fulfilled'||o.timedOut)||t.sink.finish!=='fulfilled'||t.sink.fsync!=='fulfilled'||t.sessionClose.timing!=='expected-detach'||t.sessionClose.overflowHostMs!==null)return false;
 if(t.completion.firstHostMs===null||t.completion.overflowHostMs!==null||t.completion.format!=='json'||t.completion.compression!=='none'||t.completion.dataLoss!==false||t.handles.length!==1||t.handles[0].role!=='accepted')return false;
 for(const kind of ['start','end','io-close','sink-finish','detach'])if(t.operations.filter(o=>o.kind===kind).length!==1)return false;
 const reads=t.operations.filter(o=>o.kind==='read'),writes=t.operations.filter(o=>o.kind==='write');if(reads.length===0||reads.length!==t.readCalls||reads.length>64||reads.some((o,i)=>o.handleOrdinal!==1||!Number.isSafeInteger(o.bytes)||o.bytes<0||o.bytes>65536||o.eof!==(i===reads.length-1)||o.bytes===0&&o.eof!==true))return false;
 const nonempty=reads.filter(o=>o.bytes>0);if(writes.length!==nonempty.length||writes.some((o,i)=>o.handleOrdinal!==1||o.readOperationOrdinal!==nonempty[i].ordinal||o.bytes!==nonempty[i].bytes||o.ordinal<=nonempty[i].ordinal))return false;
 const bytes=reads.reduce((sum,o)=>sum+o.bytes,0);return bytes===t.knownReadBytes&&bytes===ref.bytes;
}
function copyNativePilot(native){
 const r=ownData(native,['pilot','originals','browserVersion','caseEvidence']),p=ownData(r.pilot,['status','cases','caseEvidence','snapshots','input','transport','inputDrain','hasPrimary','primary','cleanupFailures','authority']);
 need(['complete','incomplete'].includes(p.status));bool(p.hasPrimary);const privateCleanup=denseData(p.cleanupFailures,128);assertAuthority(p.authority);
 const cases=copyCases(p.cases),caseEvidence=copyCases(r.caseEvidence),pureEvidence=copyCases(p.caseEvidence);need(pureEvidence.length<=caseEvidence.length&&pureEvidence.every((c,i)=>JSON.stringify(c)===JSON.stringify(caseEvidence[i])),'Native/pure original case evidence differs');
 const snapshots=copyPilotSnapshots(p.snapshots),input=copyTrackerAInput(p.input,snapshots),transport=copyTrackerATransport(p.transport);
 const originals=denseData(r.originals,3).map((value,i)=>{const row=ownData(value,['label','status']);need(row.label===['browserConnect','clientClose','clientDisconnected'][i]&&['fulfilled','pending','rejected','timed-out','unavailable'].includes(row.status));return {label:row.label,status:row.status};});need(originals.length===3);if(r.browserVersion!==null)boundedText(r.browserVersion,4096);
 // Read only the finite private drain receipt; never place it on disk.
 const drain=ownData(p.inputDrain,['status','requestedHostMs','settledHostMs']);assertReceipt(drain);
 return {cases,caseEvidence,snapshots,input,transport,originals,browserVersion:r.browserVersion,drainFulfilled:drain.status==='fulfilled',hasPrivateFailure:p.hasPrimary||privateCleanup.length>0};
}
export function constructTrackerAChildResult(native,persistence){
 const n=copyNativePilot(native),p=ownData(persistence,['inputRef','transportRef','rawRef','snapshotFiles']);const inputRef=fileRef(p.inputRef,'tracker-a-case-2-input.json'),transportRef=fileRef(p.transportRef,'tracker-a-case-2-transport.json'),rawRef=fileRef(p.rawRef,'tracker-a-case-2-trace.json');need(JSON.stringify(denseData(p.snapshotFiles,2))===JSON.stringify(['native-case-1.json','native-case-2.json']),'Original case publications absent');
 const first=semanticCase(n.cases,n.snapshots,1),second=semanticCase(n.cases,n.snapshots,2)&&n.input!==null&&n.input.anchor?.evaluation?.status==='accepted'&&n.input.anchor.ownerToken===n.input.anchor.evaluation.firstOwnerToken&&Object.values(n.input.geometryCheckpoints).every(c=>c.status==='fulfilled'&&c.snapshotRef!==null)&&n.input.phase.returnClick.status==='fulfilled'&&n.input.phase.completion.status==='fulfilled',semantic=trackerStage(first&&second,'semantic');
 const inputClosed=n.input!==null&&n.drainFulfilled&&Object.values(n.input.listeners).every(closedListener),phase=inputClosed&&n.input.outcome.phase.status==='complete';
 const transportClosed=transportContained(n.transport),rawComplete=transportComplete(n.transport,rawRef);
 const persisted=inputRef!==null&&transportRef!==null&&rawRef!==null&&n.input!==null&&n.transport!==null;
 const capture=trackerStage(persisted&&phase&&rawComplete&&transportClosed,!persisted?'persistence':!phase?'phase':'transport');
 const caseCleanup=caseAccepted(n.cases,1)&&caseAccepted(n.cases,2)&&inputClosed&&transportClosed,clientCleanup=n.originals.slice(1).every(o=>o.status==='fulfilled'),connected=n.originals[0].status==='fulfilled';
 const cleanupFailures=[];if(!caseCleanup)cleanupFailures.push('case-close');if(!clientCleanup)cleanupFailures.push('client-close');
 const distinguishable=!connected||semantic.status!=='complete'||capture.status!=='complete'||!caseCleanup||!clientCleanup;need(!n.hasPrivateFailure||distinguishable,'Unrepresentable private-only pilot refusal');
 const primaryFailure=!connected&&n.hasPrivateFailure?'browser-connect':semantic.status!=='complete'||capture.status!=='complete'||!caseCleanup?'case-conformance':null;
 const cleanup=trackerStage(caseCleanup&&clientCleanup,'cleanup'),status=semantic.status==='complete'&&capture.status==='complete'&&cleanup.status==='complete'&&connected?'complete':'incomplete';
 return {status,cases:n.cases,nativeInputs:first?[{caseNumber:1,wheel:null}]:[],primaryFailure,cleanupFailures,qualification:false,fps:'unavailable',originals:n.originals,browserVersion:n.browserVersion,caseEvidence:n.caseEvidence,workerImport:'fulfilled',snapshotFiles:['native-case-1.json','native-case-2.json'],mode:PILOT_MODE,tracker:{inputRef,transportRef,semantic,capture,cleanup}};
}
const finalProjectionKeys=['profileRef','inputRef','transportRef','childResultRef','parentPartialRef','nativeResultRef','childResult','parentPartial','nativeResult','transport','rawCreated','rawRef'];
function childStages(value){
 if(value===null)return null;const c=copyPublicationData(value,524288);ownData(c,['status','cases','nativeInputs','primaryFailure','cleanupFailures','qualification','fps','originals','browserVersion','caseEvidence','workerImport','snapshotFiles','mode','tracker']);need(c.mode===PILOT_MODE&&c.qualification===false&&c.fps==='unavailable'&&['complete','incomplete'].includes(c.status));
 copyCases(c.cases);copyCases(c.caseEvidence);need([null,'prerequisite','browser-connect','case-conformance'].includes(c.primaryFailure));
 const failures=denseData(c.cleanupFailures,2);need(failures.every((label,i)=>['case-close','client-close'].includes(label)&&(i===0||failures[i-1]==='case-close'&&label==='client-close')),'Finite child cleanup labels required');
 const inputs=denseData(c.nativeInputs,1);for(const v of inputs){const input=ownData(v,['caseNumber','wheel']);need(input.caseNumber===1&&input.wheel===null);}
 const originals=denseData(c.originals,3);need(originals.length===3);originals.forEach((v,i)=>{const o=ownData(v,['label','status']);need(o.label===['browserConnect','clientClose','clientDisconnected'][i]&&['fulfilled','pending','rejected','timed-out','unavailable'].includes(o.status));});
 if(c.browserVersion!==null)boundedText(c.browserVersion,4096);need(c.workerImport==='fulfilled'&&JSON.stringify(denseData(c.snapshotFiles,2))===JSON.stringify(['native-case-1.json','native-case-2.json']));
 const t=ownData(c.tracker,['inputRef','transportRef','semantic','capture','cleanup']);fileRef(t.inputRef,'tracker-a-case-2-input.json');fileRef(t.transportRef,'tracker-a-case-2-transport.json');assertStage(t.semantic,['semantic']);assertStage(t.capture,['persistence','phase','transport']);assertStage(t.cleanup,['cleanup']);return c;
}
export function constructTrackerAResult(value){
 const r=ownData(value,finalProjectionKeys),profileRef=fileRef(r.profileRef,'tracker-a-profile.json'),inputRef=fileRef(r.inputRef,'tracker-a-case-2-input.json'),transportRef=fileRef(r.transportRef,'tracker-a-case-2-transport.json'),childResultRef=fileRef(r.childResultRef,'native-child-result.json'),parentPartialRef=fileRef(r.parentPartialRef,'native-parent-partial.json'),nativeResultRef=fileRef(r.nativeResultRef,'native-result.json'),rawRef=fileRef(r.rawRef,'tracker-a-case-2-trace.json');
 bool(r.rawCreated);need(r.rawCreated||rawRef===null,'Unowned raw reference');const suppliedChild=childStages(r.childResult),child=childResultRef===null?null:suppliedChild,transport=copyTrackerATransport(r.transport);
 const complete=profileRef!==null&&transportRef!==null&&transport!==null&&JSON.stringify(transport.profileRef)===JSON.stringify(profileRef)&&transportComplete(transport,rawRef);
 const raw=!r.rawCreated?{status:'absent',ref:null,extent:'unobserved'}:complete?{status:'complete-raw',ref:rawRef,extent:'complete'}:{status:'known-prefix',ref:rawRef,extent:'unknown'};
 const semantic=child&&childResultRef?child.tracker.semantic:trackerStage(false,'missing-child');
 const cases=child===null?[]:copyCases(child.cases);const case1=trackerStage(caseAccepted(cases,1),'cleanup'),case2=trackerStage(caseAccepted(cases,2)&&!child.cleanupFailures.includes('case-close'),'cleanup');
 let global=trackerStage(false,r.parentPartial===null||parentPartialRef===null?'missing-parent':'cleanup');
 if(r.parentPartial!==null&&parentPartialRef!==null&&r.nativeResult!==null){
  const tracker=providerField(r.parentPartial,'tracker');const cleanup=providerField(tracker,'cleanup');assertStage(cleanup,['cleanup','missing-child']);
  const policy=providerField(r.nativeResult,'policy'),command=providerField(r.nativeResult,'parentCommand');
  const ownClose=providerField(command,'closeObserved')===true&&providerField(providerField(command,'original'),'closed')===true&&providerField(providerField(command,'original'),'streamsComplete')===true;
  if(policy!==null&&providerField(policy,'status')==='accepted'&&ownClose&&cleanup.status==='complete'&&child?.tracker.cleanup.status==='complete'&&nativeResultRef!==null)global=trackerStage(true,'cleanup');
 }
 const capture={status:raw.status,containment:complete?'verified':'unverified'};
 const projection=raw.status==='absent'?{status:'unavailable',reason:'raw-absent'}:rawRef===null?{status:'unavailable',reason:'persistence'}:raw.status!=='complete-raw'?{status:'unavailable',reason:'raw-incomplete'}:rawRef.bytes>262144?{status:'unavailable',reason:'byte-capacity'}:{status:'not-run',reason:'separate-pure-admission-required'};
 return {schemaVersion:1,kind:'tracker-a-result',mode:PILOT_MODE,profileRef,inputRef,transportRef,raw,childResultRef,parentPartialRef,nativeResultRef,semantic,cleanup:{case1,case2,global},capture,projection,scenario:{status:'unavailable',competingMotion:'unavailable',coverage:'unestablished',target:'unestablished',clock:'unestablished'},authority:trackerAuthority()};
}
export async function publishTrackerAResults(value,ports){
 const r=ownData(value,finalProjectionKeys);await ports.writeNative(r.nativeResult);const ref=fileRef(await ports.authenticateNative(),'native-result.json');need(ref!==null);
 const final=constructTrackerAResult({profileRef:r.profileRef,inputRef:r.inputRef,transportRef:r.transportRef,childResultRef:r.childResultRef,parentPartialRef:r.parentPartialRef,nativeResultRef:ref,childResult:r.childResult,parentPartial:r.parentPartial,nativeResult:r.nativeResult,transport:r.transport,rawCreated:r.rawCreated,rawRef:r.rawRef});await ports.writeTracker(final);return final;
}
export async function publishTrackerAOuterResult(value,ports){
 const r=ownData(value,finalProjectionKeys),native=constructTrackerANativeResult(r.nativeResult);const final=await publishTrackerAResults({profileRef:r.profileRef,inputRef:r.inputRef,transportRef:r.transportRef,childResultRef:r.childResultRef,parentPartialRef:r.parentPartialRef,nativeResultRef:null,childResult:r.childResult,parentPartial:r.parentPartial,nativeResult:native,transport:r.transport,rawCreated:r.rawCreated,rawRef:r.rawRef},ports);
 return native.status==='complete'&&final.semantic.status==='complete'&&Object.values(final.cleanup).every(stage=>stage.status==='complete')&&final.capture.status==='complete-raw'&&final.capture.containment==='verified'?'complete':'incomplete';
}
export async function assertTrackerARuntimeAbsent(directory,known){const future=new Set(mountedTrackerAReservation('runtime',[],known).roles.map(role=>role.path));for(const name of await readdir(directory))need(!future.has(name),'Preexisting runtime writer role denied');}
export async function admitTrackerAInventory(profileRef,ports){
 const names=await ports.names();need(names.includes('parent-started.json'),'Runtime original publication unavailable');const parentFile=await ports.read('parent-result.json',16384),parent=JSON.parse(Buffer.from(parentFile.raw).toString('utf8')),publication=await authenticateTrackerAReport(parent,'parent',profileRef,ports),partial=publication.value;need(partial.originals.filter(row=>row.label!=='parentWorkerClose').every(row=>row.status==='fulfilled')&&partial.stdio.every(row=>row.status==='fulfilled'),'Runtime original quiescence unavailable');
}
const nativePrerequisiteFields=['sourceSha','sourceTreeSha','originalRunId','attempt','workflowId','workflowPath','releaseId','artifactId','archiveSha256','archiveBytes','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256','frontendSettingsSha256','qualification'];
const trackerTrajectory=()=>({caseNumber:2,prephaseMs:500,durationMs:2000,wheelCount:40,slotMs:50,deltaX:0,deltaY:-12,tailMs:2000,scalarLimit:82});
const trackerLimits=()=>({archiveFiles:128,archiveBytes:33554432,rawBytes:4194304,reads:64,readBytes:65536,collectorPortCalls:133,wheelEvents:40,scrollEvents:256,motionEvents:32,projectionBytes:262144,knownHandles:2});
export function constructTrackerAProfile(intent,native,intentRef){
 accepted(evaluateMountedTrackerAAdmissionPolicy(intent));need(intent.kind==='pre-install-intent'&&selectMountedBootstrapMode(intent.context)==='tracker-a');
 const q=ownData(native,nativePrerequisiteFields);need(q.sourceSha===intent.source.commitSha&&q.sourceTreeSha===intent.source.treeSha&&q.frontendSettingsSha256===intent.prerequisite.frontendSettingsSha256&&q.attempt===1&&q.workflowId===386692729&&q.workflowPath==='.github/workflows/hosted-copilot-mounted.yml'&&q.releaseId===nativePrerequisiteRelease&&q.qualification===false);
 need(id(q.originalRunId)&&id(q.artifactId)&&Number.isSafeInteger(q.archiveBytes)&&q.archiveBytes>0&&q.archiveBytes<=33554432&&['archiveSha256','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256','frontendSettingsSha256'].every(k=>digest(q[k])));
 const file=fileRef(intentRef,'native-intent.json');need(file!==null);const result={schemaVersion:1,kind:'tracker-a-profile',mode:PILOT_MODE,sourceSha:intent.source.commitSha,sourceTree:intent.source.treeSha,releaseId:PILOT_RELEASE,staticPrerequisiteRef:{file,member:'prerequisite'},nativePrerequisite:q,trace:TRACKER_A_TRACE_CONFIG,trajectory:trackerTrajectory(),limits:trackerLimits(),qualification:false};need(encoded(result).length<=16384);return result;
}
export function validateTrackerAProfile(profile,intent,intentRef){
 const r=copyPublicationData(profile,16384);ownData(r,['schemaVersion','kind','mode','sourceSha','sourceTree','releaseId','staticPrerequisiteRef','nativePrerequisite','trace','trajectory','limits','qualification']);const expected=constructTrackerAProfile(intent,r.nativePrerequisite,intentRef);need(JSON.stringify(r)===JSON.stringify(expected),'Disk tracker profile/source differs');return expected;
}
function trackerAssets(value){const a=ownData(value,['root','files']);need(typeof a.root==='string'&&a.root.startsWith('/')&&resolve(a.root)===a.root);assertProductionOutputInventory(a.files);return copyPublicationData({root:a.root,files:a.files},524288);}
function startupArgv(value,action){const argv=captureArgv(value);need(argv[0]===process.execPath&&argv[1]==='--experimental-import-meta-resolve'&&argv[2]===fileURLToPath(import.meta.url)&&argv[3]===action,'Fixed startup argv differs');return argv;}
function plannedStarted(argv){return encoded({argv,qualification:false,originalClosed:false,startedUtc:'x'.repeat(32)}).length;}
export function planTrackerAStartup(prerequisites,assets,registryBytes,parentArgv,childArgv){
 accepted(evaluateMountedTrackerAPilotPrerequisites(prerequisites));const copied=copyPublicationData(prerequisites,524288),a=trackerAssets(assets);need(registryBytes instanceof Uint8Array&&registryBytes.byteLength>0&&registryBytes.byteLength<=262144);
 const parent=startupArgv(parentArgv,'parent'),child=startupArgv(childArgv,'child'),optionsBytes=encoded({prerequisites:copied,browserEndpoint:'x'.repeat(4096),assets:a}).length;need(optionsBytes<=524288);
 return {registryBytes:registryBytes.byteLength,optionsBytes,parentStartedBytes:plannedStarted(parent),applicationStartedBytes:plannedStarted(child)};
}
export function validateTrackerAOptions(options,prerequisites,assets){
 accepted(evaluateMountedTrackerAPilotPrerequisites(prerequisites));const o=ownData(options,['prerequisites','browserEndpoint','assets']);accepted(evaluateMountedTrackerAPilotPrerequisites(o.prerequisites));const copied=copyPublicationData(o.prerequisites,524288),planned=copyPublicationData(prerequisites,524288),a=trackerAssets(o.assets),expected=trackerAssets(assets);
 need(JSON.stringify(copied)===JSON.stringify(planned)&&JSON.stringify(a)===JSON.stringify(expected),'Immutable child options differ');
 accepted(evaluateMountedOriginPolicy({schemaVersion:1,kind:'control-connect',boundEndpoint:o.browserEndpoint,requestedEndpoint:o.browserEndpoint,priorConnectCount:0}));
 const result={prerequisites:copied,browserEndpoint:o.browserEndpoint,assets:a};need(encoded(result).length<=524288&&encoded(result).length<=encoded({prerequisites:planned,browserEndpoint:'x'.repeat(4096),assets:expected}).length,'Original options template bound');return result;
}
export async function authenticateTrackerARegistry(directory,sourceRoot){
 const stored=await physical(join(directory,'browser-registry.json'),262144),current=await physical(join(sourceRoot,'node_modules/playwright-core/browsers.json'),262144);need(stored.bytes===current.bytes&&stored.sha256===current.sha256&&stored.raw.equals(current.raw),'Original stored/current registry differs');return stored;
}
function metadataOriginal(value,url,cap){
 const v=ownData(value,['raw','receipt']),r=ownData(v.receipt,['url','status','bytes','observedBytes','bodyComplete','sha256','qualification']);need(v.raw instanceof Uint8Array&&v.raw.byteLength<=cap&&r.url===url&&r.status===200&&r.bytes===v.raw.byteLength&&r.observedBytes===v.raw.byteLength&&r.bodyComplete===true&&r.qualification===false&&r.sha256===hash(v.raw),'Original provider metadata EOF/whole binding differs');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(v.raw));
}
export async function acquireTrackerANativePrerequisite(value,ports){
 const e=ownData(value,['sourceSha','sourceTreeSha','originalRunId','artifactId','archiveSha256','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256','frontendSettingsSha256']);need(sha(e.sourceSha)&&sha(e.sourceTreeSha)&&id(e.originalRunId)&&id(e.artifactId)&&['archiveSha256','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256','frontendSettingsSha256'].every(k=>digest(e[k])));
 const base='https://api.github.com/repos/'+REPOSITORY+'/actions/',run=metadataOriginal(await ports.run(),base+'runs/'+e.originalRunId,524288),artifact=metadataOriginal(await ports.artifact(),base+'artifacts/'+e.artifactId,262144);
 const expected={sourceSha:e.sourceSha,originalRunId:e.originalRunId,artifactId:e.artifactId,archiveSha256:e.archiveSha256};validateOrdinaryNativePrerequisiteProvider(expected,run,artifact);
 const size=providerField(artifact,'size_in_bytes'),archive=ownData(await ports.archive(size),['raw','receipt']);bindOpaqueNativePrerequisite({sourceSha:e.sourceSha,originalRunId:e.originalRunId,artifactId:e.artifactId,archiveSha256:e.archiveSha256,archiveBytes:size},archive.receipt,archive.raw);
 return {sourceSha:e.sourceSha,sourceTreeSha:e.sourceTreeSha,originalRunId:e.originalRunId,attempt:1,workflowId:386692729,workflowPath:'.github/workflows/hosted-copilot-mounted.yml',releaseId:nativePrerequisiteRelease,artifactId:e.artifactId,archiveSha256:e.archiveSha256,archiveBytes:size,qualifiedRootReceiptSha256:e.qualifiedRootReceiptSha256,qualifiedPeerReceiptSha256:e.qualifiedPeerReceiptSha256,frontendSettingsSha256:e.frontendSettingsSha256,qualification:false};
}
export async function invokeTrackerAWorker(value,ports){
 const r=ownData(value,['options','prerequisites','assets','profile','intentRef']),options=validateTrackerAOptions(r.options,r.prerequisites,r.assets),profile=validateTrackerAProfile(r.profile,r.prerequisites.intent,r.intentRef);
 need(JSON.stringify(profile.nativePrerequisite)===JSON.stringify(options.prerequisites.nativePrerequisite),'Worker profile/native tuple differs');const ref=fileRef(ports.publication.profileRef,'tracker-a-profile.json'),profileBytes=encoded(profile);need(ref!==null&&ref.bytes===profileBytes.length&&ref.sha256===hash(profileBytes),'Worker physical profile ref differs');need(typeof ports.publication.reserveTraceSink==='function');
 const worker=await ports.importWorker();need(typeof worker.runNativeMountedTrackerAPilot==='function','Fixed pilot native export absent');return worker.runNativeMountedTrackerAPilot(options,ports.diagnostics,ports.publication);
}
function copyFailureStrings(value){return denseData(value,16).map(v=>{need(typeof v==='string'&&v.length<=512);return v;});}
function copyGlobalOriginals(value){const rows=denseData(value,10);need(rows.length===10);return rows.map((v,i)=>{const r=ownData(v,['label','status']);need(r.label===globalOriginalLabels[i]&&['fulfilled','pending','rejected','timed-out','unavailable'].includes(r.status));return {label:r.label,status:r.status};});}
function copyStdio(value){return denseData(value,8).map(v=>{const r=ownData(v,['index','kind','status','coverage','seenBytes','retainedBytes']);need(Number.isInteger(r.index)&&r.index>=0&&r.index<8&&['stdout','stderr','protocol'].includes(r.kind)&&['fulfilled','pending','rejected','timed-out','unavailable'].includes(r.status)&&r.coverage==='post-bind-only');if(r.kind==='protocol')need(r.seenBytes===null&&r.retainedBytes===null);else{count(r.seenBytes);count(r.retainedBytes);need(r.retainedBytes<=262144&&r.retainedBytes<=r.seenBytes);}return {index:r.index,kind:r.kind,status:r.status,coverage:r.coverage,seenBytes:r.seenBytes,retainedBytes:r.retainedBytes};});}
function copiedStage(value){const r=ownData(value,['status','reason']);assertStage(r,['admission','semantic','phase','transport','cleanup','persistence','missing-child','missing-parent']);return {status:r.status,reason:r.reason};}
export function constructTrackerAParentPartial(value){
 const r=ownData(value,['status','applicationCommand','cases','caseEvidence','browserVersion','originals','stdio','failures','qualification','fps','scope','mode','tracker']),t=ownData(r.tracker,['childResultRef','semantic','capture','cleanup']);
 need(['complete','incomplete'].includes(r.status)&&r.qualification===false&&r.fps==='unavailable'&&r.mode===PILOT_MODE);const cases=copyCases(r.cases),caseEvidence=copyCases(r.caseEvidence),originals=copyGlobalOriginals(r.originals),stdio=copyStdio(r.stdio),failures=copyFailureStrings(r.failures),applicationCommand=r.applicationCommand===null?null:constructMountedCaptureResult(r.applicationCommand);if(applicationCommand)startupArgv(applicationCommand.argv,'child');
 if(r.browserVersion!==null)boundedText(r.browserVersion,4096);boundedText(r.scope,1024);const tracker={childResultRef:fileRef(t.childResultRef,'native-child-result.json'),semantic:copiedStage(t.semantic),capture:copiedStage(t.capture),cleanup:copiedStage(t.cleanup)};
 if(r.status==='complete')need(tracker.childResultRef!==null&&Object.values(tracker).filter(v=>v&&'status'in v).every(v=>v.status==='complete')&&applicationCommand!==null&&assertOriginalCommand(applicationCommand.original).success&&originals.filter(o=>o.label!=='parentWorkerClose').every(o=>o.status==='fulfilled')&&stdio.every(s=>s.status==='fulfilled')&&failures.length===0,'Parent complete facts conflict');
 return {status:r.status,applicationCommand,cases,caseEvidence,browserVersion:r.browserVersion,originals,stdio,failures,qualification:false,fps:'unavailable',scope:r.scope,mode:PILOT_MODE,tracker};
}
export function constructTrackerANativeResult(value){
 const r=ownData(value,['status','cases','browserVersion','originals','applicationExit','stdio','parentCommand','failures','policy','qualification','fps','scope','mode','tracker']),t=ownData(r.tracker,['childResultRef','parentPartialRef','semantic','capture','cleanup']),f=ownData(r.failures,['parent','outer']);
 need(['complete','incomplete'].includes(r.status)&&r.qualification===false&&r.fps==='unavailable'&&r.mode===PILOT_MODE);const cases=copyCases(r.cases),originals=copyGlobalOriginals(r.originals),stdio=copyStdio(r.stdio),parentCommand=constructMountedCaptureResult(r.parentCommand);startupArgv(parentCommand.argv,'parent');
 let applicationExit=null;if(r.applicationExit!==null){const e=ownData(r.applicationExit,['exitCode','signal']);applicationExit={exitCode:exitCode(e.exitCode),signal:signal(e.signal)};}
 if(r.browserVersion!==null)boundedText(r.browserVersion,4096);boundedText(r.scope,1024);const failures={parent:f.parent===null?null:copyFailureStrings(f.parent),outer:copyFailureStrings(f.outer)},tracker={childResultRef:fileRef(t.childResultRef,'native-child-result.json'),parentPartialRef:fileRef(t.parentPartialRef,'native-parent-partial.json'),semantic:copiedStage(t.semantic),capture:copiedStage(t.capture),cleanup:copiedStage(t.cleanup)};
 let policy=null;if(r.policy!==null){const p=ownData(r.policy,['schemaVersion','status','reason','facts','authority']);need(p.schemaVersion===1&&['accepted','invalid','unavailable'].includes(p.status));const a=ownData(p.authority,['input','sourceAuthenticated','prerequisiteQualified','installedGraphQualified','nativeImportQualified','originalClosureQualified','runtimeAdmission','qualification']);need(a.input==='supplied-data'&&Object.entries(a).filter(([k])=>k!=='input').every(([,v])=>v===false));policy=copyPublicationData(p,524288);}
 if(r.status==='complete')need(tracker.childResultRef!==null&&tracker.parentPartialRef!==null&&[tracker.semantic,tracker.capture,tracker.cleanup].every(s=>s.status==='complete')&&policy?.status==='accepted'&&assertOriginalCommand(parentCommand.original).success&&failures.outer.length===0&&failures.parent?.length===0,'Outer complete facts conflict');
 return {status:r.status,cases,browserVersion:r.browserVersion,originals,applicationExit,stdio,parentCommand,failures,policy,qualification:false,fps:'unavailable',scope:r.scope,mode:PILOT_MODE,tracker};
}
function accepted(result){need(result.status==='accepted','Mounted policy refused: '+result.reason);return result;}
export function frontendSettingsCommitment(source){
 need(sha(source.commitSha)&&Array.isArray(source.files)&&source.files.length<=128);
 const paths=['apps/copilotkit/vite.config.ts','tests/support/hosted-copilot-build-plugin.ts','package-lock.json'];
 const tuple=[['source',source.commitSha],...paths.map(path=>{const rows=source.files.filter(f=>f.path===path);need(rows.length===1&&digest(rows[0].sha256));return [path,rows[0].sha256];})];
 return {tuple,sha256:hash(Buffer.from(JSON.stringify(tuple),'utf8'))};
}
export function validateNativePrerequisiteProvider(expected,run,artifact){
 need(sha(expected.sourceSha)&&id(expected.originalRunId)&&id(expected.artifactId)&&digest(expected.archiveSha256));
 need([run.id,artifact.id,artifact.workflow_run?.id].every(value=>Number.isSafeInteger(value)&&value>=0),'Provider numeric identity precision unavailable');
 need(String(run.id)===expected.originalRunId&&run.run_attempt===1&&run.head_sha===expected.sourceSha&&run.event==='workflow_dispatch'&&run.workflow_id===384492100&&run.status==='completed'&&run.conclusion==='success'&&run.repository?.full_name===REPOSITORY,'Original STATIC run identity/outcome differs');
 need(String(artifact.id)===expected.artifactId&&artifact.name==='copilot-production-'+expected.originalRunId+'-1'&&artifact.expired===false&&Number.isSafeInteger(artifact.size_in_bytes)&&artifact.size_in_bytes>0&&artifact.size_in_bytes<=32*MiB&&artifact.digest==='sha256:'+expected.archiveSha256&&String(artifact.workflow_run?.id)===expected.originalRunId&&artifact.workflow_run?.head_sha===expected.sourceSha,'Original STATIC artifact identity differs');
 return {sourceSha:expected.sourceSha,qualification:false};
}
async function physical(path,cap){
 const before=await lstat(path);need(before.isFile()&&!before.isSymbolicLink()&&before.size<=cap&&await realpath(path)===path,'Physical input bound/ownership');
 const original=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let raw;
 try{
  const opened=await original.stat();need(opened.isFile()&&opened.dev===before.dev&&opened.ino===before.ino&&opened.size===before.size&&opened.mtimeMs===before.mtimeMs&&opened.ctimeMs===before.ctimeMs,'Physical open identity differs');
  let bytes=0;const chunks=[];while(true){const chunk=Buffer.alloc(Math.min(65536,cap+1-bytes)),read=await original.read(chunk,0,chunk.length,bytes);if(read.bytesRead===0)break;bytes+=read.bytesRead;need(bytes<=cap,'Physical input grew past bound');chunks.push(chunk.subarray(0,read.bytesRead));}
  raw=Buffer.concat(chunks);const fdAfter=await original.stat(),pathAfter=await lstat(path);
  need(raw.length===before.size&&[fdAfter,pathAfter].every(s=>s.isFile()&&!s.isSymbolicLink()&&s.dev===before.dev&&s.ino===before.ino&&s.size===before.size&&s.mtimeMs===before.mtimeMs&&s.ctimeMs===before.ctimeMs)&&await realpath(path)===path,'Physical input changed');
 }finally{await original.close();}
 return {raw,bytes:raw.length,sha256:hash(raw)};
}
async function jsonFile(path,cap=4*MiB){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode((await physical(path,cap)).raw));}
function cleanChildEnvironment(){
 const env={};
 for(const key of ['PATH','HOME','RUNNER_TEMP','TMPDIR','LANG','LC_ALL','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','GITHUB_WORKFLOW_SHA','GITHUB_REF','GITHUB_WORKFLOW_REF','GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_EVENT_NAME','RUNNER_OS','HOSTED_RUNNER_MARKER','HOSTED_CANDIDATE_SHA'])if(process.env[key]!==undefined)env[key]=process.env[key];
 return {...env,CI:'true',COPILOTKIT_TELEMETRY_DISABLED:'true',DO_NOT_TRACK:'1'};
}
function paths(){
 const run=process.env.GITHUB_RUN_ID,temp=process.env.RUNNER_TEMP;
 need(id(run)&&process.env.GITHUB_RUN_ATTEMPT==='1'&&typeof temp==='string'&&temp.startsWith('/')&&resolve(temp)===temp);
 const pilot=environmentMode()==='tracker-a';return {directory:join(temp,(pilot?'copilot-tracker-a-':'copilot-mounted-')+run+'-1'),scratch:join(temp,(pilot?'copilot-tracker-a-static-input-':'copilot-mounted-static-input-')+run+'-1')};
}
async function writeBytes(directory,name,raw,cap){
 need(selectedBootstrapMode==='ordinary'||selectedBootstrapMode==='tracker-a','Output context unadmitted');need(ordinaryPath(name)&&raw.length<=cap,'Retained output bound');
 if(selectedBootstrapMode==='tracker-a'){
  const allocatedCap=await beforePilotMutation(directory,name);need(raw.length<=allocatedCap,'Original output exceeds admitted fixed reservation');await writeTrackerAPilotFile(directory,name,raw,allocatedCap);
  if(pilotPhase==='runtime'&&name==='browser-registry.json')pilotPhase='runtime-registry-closed';
  else if(pilotPhase==='runtime-registry-closed'&&name==='parent-started.json')pilotPhase='runtime-parent-started-closed';
  else if(pilotPhase==='runtime-parent-started-closed'&&name==='browser-process.json')pilotPhase='runtime-process-closed';
  else if(pilotPhase==='runtime-process-closed'&&name==='native-child-options.json')pilotPhase='runtime-options-closed';
  else if(pilotPhase==='runtime-options-closed'&&name==='application-started.json')pilotPhase='trace';return;
 }
 await writeFile(join(directory,name),raw,{flag:'wx'});
}
async function writeJson(directory,name,value,cap=512*1024){await writeBytes(directory,name,Buffer.from(JSON.stringify(value)+'\n'),cap);}
async function source(){
 const raw=readSourceSnapshot(process.cwd(),COPILOT_PRODUCTION_SOURCES);
 return {commitSha:raw.commitSha,treeSha:raw.treeSha,lockSha256:raw.files.find(f=>f.path==='package-lock.json')?.sha256,files:raw.files};
}
async function checkContext(){
 const mode=environmentMode(),pilot=mode==='tracker-a',release=pilot?PILOT_RELEASE:RELEASE,marker=pilot?'ubuntu-24.04-hosted-copilot-tracker-a':'ubuntu-24.04-hosted-copilot-mounted';
 need(process.version==='v24.20.0'&&process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===REPOSITORY&&process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.RUNNER_OS==='Linux'&&process.platform==='linux'&&process.env.HOSTED_RUNNER_MARKER===marker&&process.env.GITHUB_RUN_ATTEMPT==='1');
 need(process.env.COPILOTKIT_TELEMETRY_DISABLED==='true'&&process.env.DO_NOT_TRACK==='1');
 const selected=await source(),candidate=process.env.HOSTED_CANDIDATE_SHA,ref='refs/tags/'+release;
 const tag=execFileSync('/usr/bin/git',['--no-optional-locks','rev-parse','--verify',ref+'^{commit}'],{encoding:'utf8',maxBuffer:1024,timeout:5000}).trim();
 need(sha(candidate)&&candidate===selected.commitSha&&candidate===process.env.GITHUB_SHA&&candidate===process.env.GITHUB_WORKFLOW_SHA&&candidate===tag&&process.env.GITHUB_REF===ref);
 const context={candidateSha:candidate,checkoutSha:selected.commitSha,githubSha:process.env.GITHUB_SHA,workflowSha:process.env.GITHUB_WORKFLOW_SHA,tagSha:tag,repository:REPOSITORY,releaseId:release,githubRef:ref,workflowRef:process.env.GITHUB_WORKFLOW_REF,eventName:'workflow_dispatch',actions:'true',platform:'linux',runnerOs:'Linux',runnerMarker:marker,attempt:'1'};need(selectMountedBootstrapMode(context)===mode);selectedBootstrapMode=mode;return {selected,context,mode};
}
function environmentMode(){
 const release=process.env.GITHUB_REF==='refs/tags/'+PILOT_RELEASE?PILOT_RELEASE:RELEASE;
 return selectMountedBootstrapMode({candidateSha:process.env.HOSTED_CANDIDATE_SHA,checkoutSha:process.env.HOSTED_CANDIDATE_SHA,githubSha:process.env.GITHUB_SHA,workflowSha:process.env.GITHUB_WORKFLOW_SHA,tagSha:process.env.HOSTED_CANDIDATE_SHA,repository:process.env.GITHUB_REPOSITORY,releaseId:release,githubRef:process.env.GITHUB_REF,workflowRef:process.env.GITHUB_WORKFLOW_REF,eventName:process.env.GITHUB_EVENT_NAME,actions:process.env.GITHUB_ACTIONS,platform:'linux',runnerOs:process.env.RUNNER_OS,runnerMarker:process.env.HOSTED_RUNNER_MARKER,attempt:process.env.GITHUB_RUN_ATTEMPT});
}
async function beginPilotPhase(directory,phase,known={}){if(selectedBootstrapMode!=='tracker-a')return;pilotPhase=phase;pilotKnown=known;await checkPilotPhase(directory);}
async function checkPilotPhase(directory){
 need(pilotPhase!==null,'Pilot phase unallocated');const reserved=(pilotPhase.startsWith('runtime')?mountedTrackerAReservation('runtime',[],pilotKnown).roles.filter(r=>!runtimeClosedNames(pilotPhase).includes(r.path)):mountedTrackerAReservation(pilotPhase,[],pilotKnown).roles),excluded=new Set(reserved.map(r=>r.path)),closed=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  need(entry.isFile()&&!entry.isSymbolicLink()&&ordinaryPath(entry.name));const cap=pilotRoleCap(entry.name);if(excluded.has(entry.name))continue;
  const command=/^(profile|extract|install|browser-install|parent|application)\.(stdout|stderr)$/.exec(entry.name);
  if(command){const result=await jsonFile(join(directory,command[1]+'-result.json'),524288),fact=result.streamFacts?.[command[2]];need(result.closeObserved===true&&fact?.readableEOF===true&&fact.writerFinish===true&&fact.writerClose===true,'Original historical writer closure unavailable');}
  if(pilotPhase==='inventory'&&/^browser-(?:stdout|stderr)\.bin$/.test(entry.name)){const partial=await jsonFile(join(directory,'native-parent-partial.json'),524288),kind=entry.name==='browser-stdout.bin'?'stdout':'stderr';need(partial.stdio.some(row=>row.kind===kind&&['fulfilled','rejected'].includes(row.status)),'Browser original physical writer close unavailable');}
  if(pilotPhase==='inventory'&&entry.name==='tracker-a-case-2-trace.json'){const transport=copyTrackerATransport(await jsonFile(join(directory,'tracker-a-case-2-transport.json'),262144));need(transport.sink.fileClose==='fulfilled','Raw original physical close unavailable');}
  const physicalFile=await physical(join(directory,entry.name),cap);closed.push({path:entry.name,bytes:physicalFile.bytes});
 }
 return mountedTrackerAReservation(pilotPhase,closed,pilotKnown);
}
async function beforePilotMutation(directory,name){
 const allocation=await checkPilotPhase(directory),role=allocation.roles.find(row=>row.path===name);need(role,'Unallocated pilot role');
 if(pilotPhase.startsWith('runtime')||pilotPhase==='trace'){const action=process.argv[2],owner=action==='run'||action==='inventory'?'outer':action==='parent'?'parent':'child';need(role.owner===owner,'Exclusive pilot writer differs');}
 return role.cap;
}
// Original child close and each stream/writer closure remain separate observations.
async function capture(directory,name,argv,cap=4*MiB,env=cleanChildEnvironment(),deadlineMs=300000){
 need(/^[a-z-]+$/.test(name));const pilotRuntime=selectedBootstrapMode==='tracker-a'&&(name==='parent'||name==='application'),startedUtc=new Date().toISOString();
 if(pilotRuntime){startupArgv(argv,name==='parent'?'parent':'child');need(/^[\x20-\x7e]{1,32}$/.test(startedUtc));need(encoded({argv,qualification:false,originalClosed:false,startedUtc}).length<=(name==='parent'?pilotKnown.parentStartedBytes:pilotKnown.applicationStartedBytes));}
 await writeJson(directory,name+'-started.json',{argv,qualification:false,originalClosed:false,startedUtc});
 if(selectedBootstrapMode==='tracker-a'){need(cap===await beforePilotMutation(directory,name+'.stdout')&&cap===await beforePilotMutation(directory,name+'.stderr'),'Original capture stream allocation differs');await beforePilotMutation(directory,name+'-result.json');}
 const originalEnv={...env};delete originalEnv.GH_TOKEN;delete originalEnv.GITHUB_TOKEN;delete originalEnv.NODE_OPTIONS;delete originalEnv.NODE_PATH;
 const child=spawn(argv[0],argv.slice(1),{cwd:process.cwd(),env:originalEnv,stdio:['ignore','pipe','pipe']});
 let spawned=false,spawnError=null,timedOut=false,terminationRequested=false;
 child.once('spawn',()=>{spawned=true;});child.once('error',e=>{spawnError=boundedError(e);});
 const requestStop=()=>{if(!terminationRequested){terminationRequested=true;child.kill('SIGTERM');}};
 const timer=setTimeout(()=>{timedOut=true;requestStop();},deadlineMs);
 function pipe(stream,kind){
  const sink=createWriteStream(join(directory,name+'.'+kind),{flags:'wx'});let seen=0,retained=0,eof=false,finish=false,close=false,error=false,overflow=false;
  const closed=new Promise(resolve=>{sink.once('finish',()=>{finish=true;});sink.once('close',()=>{close=true;resolve();});});
  sink.on('error',()=>{error=true;stream.resume();});
  stream.on('data',chunk=>{seen+=chunk.length;if(seen>cap){overflow=true;requestStop();}if(error)return;const part=chunk.subarray(0,Math.max(0,cap-retained));retained+=part.length;if(part.length&&!sink.write(part)){stream.pause();sink.once('drain',()=>stream.resume());}});
  stream.once('end',()=>{eof=true;sink.end();});stream.once('error',()=>{error=true;sink.end();});stream.once('close',()=>{if(!eof){error=true;sink.end();}});
  return {closed,facts:()=>({readableEOF:eof,writerFinish:finish,writerClose:close,writerError:error,seen,retained,retainedBytesKnown:!error,overflow})};
 }
 const stdout=pipe(child.stdout,'stdout'),stderr=pipe(child.stderr,'stderr');
 const exitPromise=new Promise(resolve=>child.once('exit',(exitCode,signal)=>resolve({exitCode,signal})));
 const closeResult=await new Promise(resolve=>child.once('close',(exitCode,signal)=>resolve({exitCode,signal})));
 clearTimeout(timer);await Promise.all([stdout.closed,stderr.closed]);
 const out=stdout.facts(),err=stderr.facts(),complete=s=>s.readableEOF&&s.writerFinish&&s.writerClose&&!s.writerError&&!s.overflow&&s.seen===s.retained;
 const original={...closeResult,stdoutBytes:out.seen,stderrBytes:err.seen,stdoutRetainedBytes:out.retained,stderrRetainedBytes:err.retained,closed:true,streamsComplete:complete(out)&&complete(err)};
 // A spawn error can close without exit; do not await or fabricate an exit then.
 const exit=spawned?await exitPromise:null;
 const observed={argv,original,spawned,spawnError,timedOut,terminationRequested,exitObserved:exit!==null,exit,closeObserved:true,streamFacts:{stdout:out,stderr:err},descendantClosure:'unqualified',qualification:false};
 const result=pilotRuntime?constructMountedCaptureResult(observed):observed;await writeJson(directory,name+'-result.json',result,pilotRuntime?16384:524288);
 return result;
}
function successful(result){need(result.spawned&&!result.spawnError&&!result.timedOut&&!result.terminationRequested&&assertOriginalCommand(result.original).success,'Original command failed/incomplete');}
// Observe only streams publicly exposed by the original BrowserServer process.
// Protocol pipes are never read or written here; their original close is observed.
function observeBrowserStdio(directory,process){
 const observations=[],closed=[];
 for(const [index,stream] of process.stdio.entries()){
  if(!stream||index===0)continue;need(index<8,'Browser stdio bound');
  const kind=index===1?'stdout':index===2?'stderr':'protocol';
  const row={index,kind,status:'pending',coverage:'post-bind-only',seenBytes:kind==='protocol'?null:0,retainedBytes:kind==='protocol'?null:0};observations.push(row);
  // An already closed stream has no accessible original close left to observe.
  if(stream.destroyed||stream.closed||stream.readableEnded)continue;
  if(kind==='protocol'){closed.push(new Promise(resolve=>stream.once('close',()=>{row.status='fulfilled';resolve();})));continue;}
  const sink=createWriteStream(join(directory,'browser-'+kind+'.bin'),{flags:'wx'});let eof=false,failed=false;
  closed.push(new Promise(resolve=>sink.once('close',()=>{row.status=eof&&!failed&&row.seenBytes===row.retainedBytes?'fulfilled':'rejected';resolve();})));
  sink.on('error',()=>{failed=true;stream.resume();});
  stream.on('data',chunk=>{row.seenBytes+=chunk.length;const part=chunk.subarray(0,Math.max(0,262144-row.retainedBytes));row.retainedBytes+=part.length;if(!failed&&part.length&&!sink.write(part)){stream.pause();sink.once('drain',()=>stream.resume());}});
  stream.once('end',()=>{eof=true;sink.end();});stream.once('error',()=>{failed=true;sink.end();});stream.once('close',()=>{if(!eof){failed=true;sink.end();}});
 }
 return {observations,closed:()=>Promise.all(closed)};
}
async function api(directory,name,path,cap,binary=false){
 if(selectedBootstrapMode==='tracker-a'){
  const phase=name==='prerequisite-run'?'prepare-static-run':name==='prerequisite-artifact'?'prepare-static-artifact':name==='static-prerequisite'?'prepare-static-zip':name==='native-prerequisite-run'?'prepare-native-run':name==='native-prerequisite-artifact'?'prepare-native-artifact':name==='native-prerequisite'?'prepare-native-zip':null;need(phase!==null,'Fixed pilot GET stem differs');await beginPilotPhase(directory,phase,binary?{archiveBytes:cap}:{});
 }
 need(path.startsWith('repos/'+REPOSITORY+'/'));const token=process.env.GH_TOKEN;need(typeof token==='string'&&token.length>0,'Hosted read-only token absent');
 const url='https://api.github.com/'+path;await writeJson(directory,name+'-intent.json',{url,method:'GET',qualification:false});
 const response=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'},redirect:'follow',signal:AbortSignal.timeout(60000)});
 const chunks=[];let bytes=0,failure=null;const reader=response.body?.getReader();need(reader,'Provider body absent');
 try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;need(bytes<=cap,'Provider response byte bound');chunks.push(item.value);}}
 catch(error){failure=error;try{await reader.cancel();}catch{}}
 finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks);await writeBytes(directory,name+(binary?'.zip':'.json'),raw,cap);await writeJson(directory,name+'-receipt.json',{url,status:response.status,bytes:raw.length,observedBytes:bytes,bodyComplete:failure===null,sha256:hash(raw),qualification:false});
 if(failure)throw failure;need(response.ok,'Provider response refused');
 return binary?raw:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
}
const extractSource=String.raw`
import os,sys,json,zipfile,stat,hashlib,re
archive,destination=sys.argv[1:];records=[];total=0;seen=set();dirs=set();files=set();admitted=[]
with zipfile.ZipFile(archive) as z:
 entries=z.infolist();assert len(entries)<=4096 and sum(i.file_size for i in entries)<=33554432
 for i in entries:
  directory=i.is_dir();name=i.filename[:-1] if directory else i.filename;kind=stat.S_IFMT(i.external_attr>>16)
  assert i.orig_filename==i.filename and 0<len(name)<=1024 and re.fullmatch(r'[A-Za-z0-9._@/-]+',name) and all(x not in ('','.','..') for x in name.split('/')) and name not in seen
  seen.add(name);assert not i.flag_bits&1 and i.compress_type in (0,8)
  assert kind in ((0,stat.S_IFDIR) if directory else (0,stat.S_IFREG))
  assert not i.external_attr&16 or directory
  if directory:assert i.file_size==0 and i.CRC==0
  parts=name.split('/')
  for n in range(1,len(parts)):dirs.add('/'.join(parts[:n]))
  if directory:dirs.add(name)
  else:files.add(name)
  assert not files.intersection(dirs) and len(files)<=1152 and len(files)+len(dirs)<=4096
  admitted.append((i,name,directory))
 # No destination or implicit directory exists until the complete header union
 # (including conflicts, types and all implicit parents) is admitted.
 os.mkdir(destination)
 for i,name,directory in admitted:
  path=os.path.join(destination,*name.split('/'));parent=os.path.dirname(path);os.makedirs(parent,exist_ok=True)
  if directory:os.makedirs(path,exist_ok=True);continue
  h=hashlib.sha256();count=0
  fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  try:
   with z.open(i) as f:
    while True:
     b=f.read(65536)
     if not b:break
     count+=len(b);total+=len(b);assert count<=i.file_size and total<=33554432;h.update(b)
     offset=0
     while offset<len(b):offset+=os.write(fd,b[offset:])
  finally:os.close(fd)
  assert count==i.file_size
  records.append(dict(path=name,bytes=count,sha256=h.hexdigest(),regular=True,contained=True,symlink=False))
assert len(records)+len(dirs)<=4096
print(json.dumps(dict(files=records,bytes=total,visitedEntries=len(records)+len(dirs),qualification=False)))
`;
async function apiOriginal(directory,stem,name,cap){
 const intent=await jsonFile(join(directory,stem+'-intent.json'),524288);ownData(intent,['url','method','qualification']);need(intent.method==='GET'&&intent.qualification===false);
 const body=await physical(join(directory,name),cap),receipt=await jsonFile(join(directory,stem+'-receipt.json'),524288);need(receipt.url===intent.url);return {raw:body.raw,receipt};
}
async function loadTrackerAProfile(directory,intent){
 const intentFile=await physical(join(directory,'native-intent.json'),524288),intentRef={path:'native-intent.json',bytes:intentFile.bytes,sha256:intentFile.sha256};
 need(JSON.stringify(JSON.parse(intentFile.raw.toString('utf8')))===JSON.stringify(intent));
 const profileFile=await physical(join(directory,'tracker-a-profile.json'),16384),profile=validateTrackerAProfile(JSON.parse(profileFile.raw.toString('utf8')),intent,intentRef),q=profile.nativePrerequisite;
 const expected={sourceSha:q.sourceSha,sourceTreeSha:q.sourceTreeSha,originalRunId:q.originalRunId,artifactId:q.artifactId,archiveSha256:q.archiveSha256,qualifiedRootReceiptSha256:q.qualifiedRootReceiptSha256,qualifiedPeerReceiptSha256:q.qualifiedPeerReceiptSha256,frontendSettingsSha256:q.frontendSettingsSha256};
 const native=await acquireTrackerANativePrerequisite(expected,{run:()=>apiOriginal(directory,'native-prerequisite-run','native-prerequisite-run.json',524288),artifact:()=>apiOriginal(directory,'native-prerequisite-artifact','native-prerequisite-artifact.json',262144),archive:bytes=>apiOriginal(directory,'native-prerequisite','native-prerequisite.zip',bytes)});need(JSON.stringify(native)===JSON.stringify(q),'Original native profile/provider bytes differ');
 const s=intent.prerequisite,base='https://api.github.com/repos/'+REPOSITORY+'/actions/';
 const run=metadataOriginal(await apiOriginal(directory,'prerequisite-run','prerequisite-run.json',524288),base+'runs/'+s.originalRunId,524288),artifact=metadataOriginal(await apiOriginal(directory,'prerequisite-artifact','prerequisite-artifact.json',262144),base+'artifacts/'+s.artifactId,262144);validateNativePrerequisiteProvider(s,run,artifact);
 const archive=await apiOriginal(directory,'static-prerequisite','static-prerequisite.zip',artifact.size_in_bytes);bindOpaqueNativePrerequisite({sourceSha:s.sourceSha,originalRunId:s.originalRunId,artifactId:s.artifactId,archiveSha256:s.archiveSha256,archiveBytes:artifact.size_in_bytes},archive.receipt,archive.raw);
 need(frontendSettingsCommitment(intent.source).sha256===s.frontendSettingsSha256,'Original frontend settings changed');
 return {profile,profileRef:{path:'tracker-a-profile.json',bytes:profileFile.bytes,sha256:profileFile.sha256},intentRef};
}
function admissionFor(mode){return mode==='tracker-a'?evaluateMountedTrackerAAdmissionPolicy:evaluateMountedAdmissionPolicy;}
async function bundle(directory,scratch){
 const current=await checkContext(),mode=current.mode;
 const intent=await jsonFile(join(directory,'native-intent.json')),installed=await jsonFile(join(directory,'installed-admission.json'));
 accepted(admissionFor(mode)(intent));accepted(admissionFor(mode)(installed));need(JSON.stringify(installed.intent)===JSON.stringify(intent));need(JSON.stringify(current.selected)===JSON.stringify(intent.source)&&JSON.stringify(current.context)===JSON.stringify(intent.context),'Disk/source mode changed');
 const module=await jsonFile(join(scratch,'worker-module.json'));accepted(evaluateMountedModulePolicy(module));
 need(module.sourceSha===intent.source.commitSha&&module.runId===intent.prerequisite.originalRunId);
 if(mode==='tracker-a'){const {profile}=await loadTrackerAProfile(directory,intent);const prerequisites={intent,installed,module,nativePrerequisite:profile.nativePrerequisite};accepted(evaluateMountedTrackerAPilotPrerequisites(prerequisites));return prerequisites;}
 return {intent,installed,module};
}
async function verifyGraph(directory,scratch,prerequisites){
 if(selectedBootstrapMode==='tracker-a'){accepted(evaluateMountedTrackerAPilotPrerequisites(prerequisites));const loaded=await loadTrackerAProfile(directory,prerequisites.intent);need(JSON.stringify(loaded.profile.nativePrerequisite)===JSON.stringify(prerequisites.nativePrerequisite));}
 const packages=await jsonFile(join(scratch,'worker-installed-packages.json')),files=await jsonFile(join(scratch,'worker-resolution-files.json'));
 need(Array.isArray(packages)&&packages.length===19&&Array.isArray(files)&&files.length===prerequisites.module.resolutions.length&&files.length<=10);
 const lock=await jsonFile(join(process.cwd(),'package-lock.json')),hidden=await jsonFile(join(process.cwd(),'node_modules/.package-lock.json'));const seen=new Set();
 for(const item of packages){
  const pin=MOUNTED_PACKAGE_PINS[item.path];need(pin&&!seen.has(item.path)&&item.version===pin.version&&item.integrity===pin.integrity);seen.add(item.path);
  const actual=await physical(join(process.cwd(),item.path,'package.json'),256*1024),metadata=JSON.parse(actual.raw.toString('utf8'));
  need(actual.sha256===item.manifestSha256&&metadata.name===item.path.split('node_modules/').at(-1)&&metadata.version===pin.version&&lock.packages?.[item.path]?.integrity===pin.integrity&&hidden.packages?.[item.path]?.integrity===pin.integrity&&hidden.packages?.[item.path]?.version===pin.version);
 }
 const worker=join(process.cwd(),prerequisites.module.workerPath);
 const compiler=await jsonFile(join(scratch,'worker-compiler-profile.json')),owned=await jsonFile(join(scratch,'worker-owned-modules.json'));
 const graph=validateWorkerContractSourceGraph(compiler.registeredGraph,process.cwd(),prerequisites.intent.source.files);
 need(JSON.stringify(graph.rows.filter(row=>row.role==='normal-source').map(row=>row.source))===JSON.stringify(owned)&&graph.chunks[0].sha256===prerequisites.module.executedCopySha256&&graph.chunks[0].bytes===prerequisites.module.emitted[0].bytes,'Original worker graph binding differs');
 const components=[];for(const path of WORKER_STATIC_COMPONENT_PATHS){const file=await physical(join(process.cwd(),path),4*MiB);components.push({path,bytes:file.bytes,sha256:file.sha256});}
 assertWorkerComponentPins(components,compiler.componentPins);
 const parents=owned.filter(row=>row.kind==='physical'&&row.path===WORKER_ZOD_PUBLIC_BINDING.sourceParent);
 const parent=await physical(join(process.cwd(),WORKER_ZOD_PUBLIC_BINDING.sourceParent),16*MiB);
 need(parents.length===1&&parents[0].id===join(process.cwd(),WORKER_ZOD_PUBLIC_BINDING.sourceParent)&&parents[0].sha256===parent.sha256&&graph.rows.some(row=>row.id==='zod'&&row.role==='configured-external'),'Original public source parent differs');
 need(prerequisites.module.imports.some(row=>row.specifier===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier&&row.kind==='static'),'Static Zod alias missing');
 need(process.execArgv.length===1&&process.execArgv[0]==='--experimental-import-meta-resolve','Explicit parent-aware resolver flag required');
 for(const resolution of prerequisites.module.resolutions){
  const observed=resolveMountedPublicEntry(resolution.specifier,pathToFileURL(worker).href,pathToFileURL(process.cwd()+'/').href,(specifier,parent)=>import.meta.resolve(specifier,parent));
  const url=new URL(observed.rawUrl),publicUrl=new URL(observed.publicUrl);need(observed.publicSpecifier===resolution.publicSpecifier&&relative(process.cwd(),fileURLToPath(url))===resolution.entryPath&&relative(process.cwd(),fileURLToPath(publicUrl))===resolution.publicEntryPath);
  const matching=files.filter(f=>f.path===resolution.entryPath);need(matching.length===1);const current=await physical(fileURLToPath(url),16*MiB);need(current.sha256===matching[0].sha256&&current.bytes===matching[0].bytes);
 }
 const current=await physical(worker,16*MiB);need(current.sha256===prerequisites.module.executedCopySha256&&current.bytes===prerequisites.module.emitted[0].bytes);
 const now=await source();need(JSON.stringify(now)===JSON.stringify(prerequisites.intent.source),'Native selected source changed');
}
async function prepare(directory,scratch){
 const {selected,context,mode}=await checkContext();await mkdir(directory);const pilot=mode==='tracker-a';
 const prerequisite={originalRunId:process.env.HOSTED_STATIC_RUN_ID,attempt:1,sourceSha:selected.commitSha,artifactId:process.env.HOSTED_STATIC_ARTIFACT_ID,archiveSha256:process.env.HOSTED_STATIC_ARCHIVE_SHA256,qualifiedRootReceiptSha256:process.env.HOSTED_STATIC_ROOT_SHA256,qualifiedPeerReceiptSha256:process.env.HOSTED_STATIC_PEER_SHA256,frontendSettingsSha256:process.env.HOSTED_FRONTEND_SETTINGS_SHA256};
 need(id(prerequisite.originalRunId)&&id(prerequisite.artifactId)&&[prerequisite.archiveSha256,prerequisite.qualifiedRootReceiptSha256,prerequisite.qualifiedPeerReceiptSha256,prerequisite.frontendSettingsSha256].every(digest));
 const nativeExpected=pilot?{sourceSha:selected.commitSha,sourceTreeSha:selected.treeSha,originalRunId:process.env.HOSTED_NATIVE_RUN_ID,artifactId:process.env.HOSTED_NATIVE_ARTIFACT_ID,archiveSha256:process.env.HOSTED_NATIVE_ARCHIVE_SHA256,qualifiedRootReceiptSha256:process.env.HOSTED_NATIVE_ROOT_SHA256,qualifiedPeerReceiptSha256:process.env.HOSTED_NATIVE_PEER_SHA256,frontendSettingsSha256:prerequisite.frontendSettingsSha256}:null;
 if(nativeExpected)need(id(nativeExpected.originalRunId)&&id(nativeExpected.artifactId)&&['archiveSha256','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256'].every(k=>digest(nativeExpected[k])),'Pilot dispatch native tuple differs');
 const intent={schemaVersion:1,kind:'pre-install-intent',purpose:pilot?'hosted-copilot-mounted-tracker-json-a-pilot-only':'hosted-copilot-mounted-default-react-only',context,source:selected,prerequisite,profile:{nodeVersion:process.version,npmVersion:'11.19.0',telemetryDisabled:'true',doNotTrack:'1'}};
 if(pilot)accepted(evaluateMountedTrackerAAdmissionPolicy(intent));
 await beginPilotPhase(directory,'prepare-profile');const profile=await capture(directory,'profile',['npm','--version'],65536);successful(profile);need((await physical(join(directory,'profile.stdout'),65536)).raw.toString().trim()==='11.19.0');
 accepted(admissionFor(mode)(intent));await beginPilotPhase(directory,'prepare-intent');await writeJson(directory,'native-intent.json',intent);
 const run=await api(directory,'prerequisite-run','repos/'+REPOSITORY+'/actions/runs/'+prerequisite.originalRunId,512*1024);
 const artifact=await api(directory,'prerequisite-artifact','repos/'+REPOSITORY+'/actions/artifacts/'+prerequisite.artifactId,256*1024);
 validateNativePrerequisiteProvider(prerequisite,run,artifact);
 const archive=await api(directory,'static-prerequisite','repos/'+REPOSITORY+'/actions/artifacts/'+prerequisite.artifactId+'/zip',pilot?artifact.size_in_bytes:32*MiB,true);need(hash(archive)===prerequisite.archiveSha256&&archive.length===artifact.size_in_bytes);
 if(pilot){const original=await apiOriginal(directory,'static-prerequisite','static-prerequisite.zip',artifact.size_in_bytes);bindOpaqueNativePrerequisite({sourceSha:prerequisite.sourceSha,originalRunId:prerequisite.originalRunId,artifactId:prerequisite.artifactId,archiveSha256:prerequisite.archiveSha256,archiveBytes:artifact.size_in_bytes},original.receipt,original.raw);}
 await beginPilotPhase(directory,'prepare-extract');const extraction=await capture(directory,'extract',['/usr/bin/python3','-I','-S','-B','-c',extractSource,join(directory,'static-prerequisite.zip'),scratch]);successful(extraction);
 const extracted=await jsonFile(join(directory,'extract.stdout'));const index=new Map(extracted.files.map(f=>[f.path,f]));
 const inventory=await jsonFile(join(scratch,'artifact-inventory.json'));need(inventory.files.length+1===index.size&&inventory.bytesBeforeInventory+index.get('artifact-inventory.json').bytes===extracted.bytes);
 for(const f of inventory.files)need(index.get(f.path)?.sha256===f.sha256&&index.get(f.path)?.bytes===f.bytes);
 const admission=await jsonFile(join(scratch,'admission.json'));need(JSON.stringify(admission.source.files)===JSON.stringify(selected.files)&&admission.source.commitSha===selected.commitSha&&admission.source.treeSha===selected.treeSha);
 const settings=frontendSettingsCommitment(selected);need(settings.sha256===prerequisite.frontendSettingsSha256);await beginPilotPhase(directory,'prepare-settings');await writeBytes(directory,'frontend-settings.json',Buffer.from(JSON.stringify(settings.tuple),'utf8'),65536);
 const frontend=await jsonFile(join(scratch,'static-assets.json'),8*MiB);need(frontend.schemaVersion===4&&frontend.parserComplete===true&&frontend.parserMicrocases?.passed===true&&frontend.parserMicrocases?.count===22);assertProductionOutputInventory(frontend.files);
 for(const f of frontend.files)need(ordinaryPath(f.path)&&index.get('dist/'+f.path)?.sha256===f.sha256&&index.get('dist/'+f.path)?.bytes===f.bytes);
 for(const name of ['inspect','worker-build','worker-inspect']){const result=await jsonFile(join(scratch,'step-'+name+'-result.json'));need(result.sourceSha===selected.commitSha&&result.policyAccepted===true);if(name==='inspect')need(result.originalClosed===true);else need(assertOriginalCommand(result.original).success&&result.originalCloseObserved===true&&result.originalFileCloseObserved===true&&!result.timedOut);}
 const module=await jsonFile(join(scratch,'worker-module.json'));accepted(evaluateMountedModulePolicy(module));need(module.sourceSha===selected.commitSha&&module.runId===prerequisite.originalRunId);
 const original=await physical(join(scratch,'worker/worker.mjs'),16*MiB);need(original.sha256===module.executedCopySha256&&original.bytes===module.emitted[0].bytes);
 const target=join(process.cwd(),module.workerPath);await mkdir(join(target,'..'),{recursive:true});need((await readdir(join(target,'..'))).length===0&&await realpath(join(target,'..'))===join(target,'..'));await writeFile(target,original.raw,{flag:'wx'});
 await beginPilotPhase(directory,'prepare-prerequisite');await writeJson(directory,'prerequisite.json',{prerequisite,provider:{runId:run.id,artifactId:artifact.id,archiveSha256:hash(archive)},externalReviewAssertions:'Root/peer receipt hashes supplied by authorized dispatcher; not signatures or self-authenticated approvals',qualification:false});
 if(pilot){
  const expected=nativeExpected;
  const native=await acquireTrackerANativePrerequisite(expected,{run:async()=>{await api(directory,'native-prerequisite-run','repos/'+REPOSITORY+'/actions/runs/'+expected.originalRunId,524288);return apiOriginal(directory,'native-prerequisite-run','native-prerequisite-run.json',524288);},artifact:async()=>{await api(directory,'native-prerequisite-artifact','repos/'+REPOSITORY+'/actions/artifacts/'+expected.artifactId,262144);return apiOriginal(directory,'native-prerequisite-artifact','native-prerequisite-artifact.json',262144);},archive:async bytes=>{await api(directory,'native-prerequisite','repos/'+REPOSITORY+'/actions/artifacts/'+expected.artifactId+'/zip',bytes,true);return apiOriginal(directory,'native-prerequisite','native-prerequisite.zip',bytes);}});
  await checkContext();const original=await physical(join(directory,'native-intent.json'),524288),intentRef={path:'native-intent.json',bytes:original.bytes,sha256:original.sha256};
  const trackerProfile=constructTrackerAProfile(intent,native,intentRef);await beginPilotPhase(directory,'prepare-tracker-profile');await writeJson(directory,'tracker-a-profile.json',trackerProfile,16384);
 }
}
async function install(directory,scratch){
 const current=await checkContext(),intent=await jsonFile(join(directory,'native-intent.json'));accepted(admissionFor(current.mode)(intent));need(JSON.stringify(current.selected)===JSON.stringify(intent.source)&&JSON.stringify(current.context)===JSON.stringify(intent.context));if(current.mode==='tracker-a')await loadTrackerAProfile(directory,intent);
 await beginPilotPhase(directory,'install');const original=await capture(directory,'install',['npm','ci','--ignore-scripts','--no-audit','--no-fund']);successful(original);
 const pinned=await jsonFile(join(scratch,'worker-installed-packages.json'));need(pinned.length===19);
 const hidden=await physical(join(process.cwd(),'node_modules/.package-lock.json'),4*MiB);const hiddenValue=JSON.parse(hidden.raw.toString('utf8'));const packages=[];
 for(const item of pinned){const actual=await physical(join(process.cwd(),item.path,'package.json'),256*1024);need(actual.sha256===item.manifestSha256);packages.push({...item});}
 const installed={schemaVersion:1,kind:'post-install-admission',intent,originalInstall:original.original,installedProfile:{sourceSha:intent.source.commitSha,lockSha256:intent.source.lockSha256,originalInstallReceiptSha256:(await physical(join(directory,'install-result.json'),512*1024)).sha256,hiddenLockReceiptSha256:hidden.sha256,checkedInstalledRecords:Object.keys(hiddenValue.packages??{}).length,packages}};
 accepted(admissionFor(current.mode)(installed));await beginPilotPhase(directory,'installed');await writeJson(directory,'installed-admission.json',installed);await verifyGraph(directory,scratch,await bundle(directory,scratch));
}
function fixedWorkerArgv(action){return [process.execPath,'--experimental-import-meta-resolve',fileURLToPath(import.meta.url),action];}
async function runtimePlan(directory,scratch,prerequisites,stored){
 const frontend=await jsonFile(join(scratch,'static-assets.json'),8*MiB),assets=trackerAssets({root:join(scratch,'dist'),files:frontend.files});
 const registry=stored?await authenticateTrackerARegistry(directory,process.cwd()):await physical(join(process.cwd(),'node_modules/playwright-core/browsers.json'),262144);
 const known=planTrackerAStartup(prerequisites,assets,registry.raw,fixedWorkerArgv('parent'),fixedWorkerArgv('child'));return {assets,registry,known};
}
async function authenticateStartupFiles(directory,prerequisites,plan){
 const options=await jsonFile(join(directory,'native-child-options.json'),524288);validateTrackerAOptions(options,prerequisites,plan.assets);
 for(const [name,argv,k] of [['parent-started.json',fixedWorkerArgv('parent'),plan.known.parentStartedBytes],['application-started.json',fixedWorkerArgv('child'),plan.known.applicationStartedBytes]]){
  const original=await physical(join(directory,name),k),value=JSON.parse(original.raw.toString('utf8'));ownData(value,['argv','qualification','originalClosed','startedUtc']);need(JSON.stringify(captureArgv(value.argv))===JSON.stringify(argv)&&value.qualification===false&&value.originalClosed===false&&typeof value.startedUtc==='string'&&/^[\x20-\x7e]{1,32}$/.test(value.startedUtc));
 }
 const processFile=await jsonFile(join(directory,'browser-process.json'),524288);need(processFile.registrySha256===plan.registry.sha256&&processFile.registryBytes===plan.registry.bytes);return options;
}
async function publishedFileRef(directory,name){const original=await physical(join(directory,name),pilotRoleCap(name));return {path:name,bytes:original.bytes,sha256:original.sha256};}
async function reserveRawSink(directory,state){
 need(!state.attempted,'Raw sink acquisition already attempted');state.attempted=true;
 return createTrackerATraceSink({reserve:async()=>{need(await beforePilotMutation(directory,'tracker-a-case-2-trace.json')===4194304);},open:async()=>{
  const handle=await open(join(directory,'tracker-a-case-2-trace.json'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);state.created=true;state.handle=handle;
  return {write:bytes=>handle.writeFile(bytes),fsync:()=>handle.sync(),close:()=>handle.close()};
 },authenticate:()=>publishedFileRef(directory,'tracker-a-case-2-trace.json')});
}
async function child(directory,scratch){
 await checkContext();
 if(selectedBootstrapMode==='tracker-a'){
  const prerequisites=await bundle(directory,scratch);await verifyGraph(directory,scratch,prerequisites);const loaded=await loadTrackerAProfile(directory,prerequisites.intent),plan=await runtimePlan(directory,scratch,prerequisites,true);
  const options=await authenticateStartupFiles(directory,prerequisites,plan);await beginPilotPhase(directory,'trace',plan.known);let imported=false;const rawState={attempted:false,created:false,handle:null};
  try{
   const diagnostics=createRestoredHistoryDiagnosticPort((bytes,callback)=>process.stdout.write(bytes,callback)),publication={profileRef:loaded.profileRef,reserveTraceSink:()=>reserveRawSink(directory,rawState)};
   const result=await invokeTrackerAWorker({options,prerequisites,assets:plan.assets,profile:loaded.profile,intentRef:loaded.intentRef},{importWorker:async()=>{const worker=await import(pathToFileURL(join(process.cwd(),prerequisites.module.workerPath)).href);imported=true;return worker;},diagnostics,publication});
   const current=await bundle(directory,scratch);await verifyGraph(directory,scratch,current);need(JSON.stringify(current)===JSON.stringify(prerequisites));const n=copyNativePilot(result);
   if(n.input)need(JSON.stringify(n.input.profileRef)===JSON.stringify(loaded.profileRef));if(n.transport)need(JSON.stringify(n.transport.profileRef)===JSON.stringify(loaded.profileRef));
   for(const caseNumber of [1,2])await writeJson(directory,'native-case-'+caseNumber+'.json',{caseNumber,cases:n.caseEvidence.filter(c=>c.caseNumber===caseNumber),snapshots:n.snapshots.filter(s=>s.caseNumber===caseNumber),qualification:false},2097152);
   let inputRef=null,transportRef=null,rawRef=null;
   if(n.input){await writeJson(directory,'tracker-a-case-2-input.json',n.input,262144);inputRef=await publishedFileRef(directory,'tracker-a-case-2-input.json');}
   if(n.transport){if(n.transport.raw.ref!==null&&n.transport.sink.fileClose==='fulfilled'){rawRef=await publishedFileRef(directory,'tracker-a-case-2-trace.json');need(JSON.stringify(rawRef)===JSON.stringify(n.transport.raw.ref));}await writeJson(directory,'tracker-a-case-2-transport.json',n.transport,262144);transportRef=await publishedFileRef(directory,'tracker-a-case-2-transport.json');}
   const summary=constructTrackerAChildResult(result,{inputRef,transportRef,rawRef,snapshotFiles:['native-case-1.json','native-case-2.json']});
   const status=await publishTrackerAInternalReport('child',summary,value=>writeJson(directory,'native-child-result.json',value,524288));
   console.log(JSON.stringify({status:summary.status,resultPath:join(directory,'native-child-result.json'),qualification:false}));return status;
  }catch(error){await handleMountedBootstrapFailure(error,code=>{process.exitCode=code;},async original=>{const failure=serializeMountedFailure('native-child',original,imported?'fulfilled':'rejected');await writeBytes(directory,failure.name,failure.raw,failure.cap);});throw error;}
 }
 const options=await jsonFile(join(directory,'native-child-options.json'),512*1024);await verifyGraph(directory,scratch,options.prerequisites);
 const resultPath=join(directory,'native-child-result.json');let imported=false;
 try{
  const importedWorker=await import(pathToFileURL(join(process.cwd(),options.prerequisites.module.workerPath)).href);imported=true;
  need(typeof importedWorker.runNativeMountedConformance==='function','Qualified native export absent');
  const diagnostics=createRestoredHistoryDiagnosticPort((bytes,callback)=>process.stdout.write(bytes,callback));
  const result=await importedWorker.runNativeMountedConformance(options,diagnostics);
  for(const caseNumber of [1,2])await writeJson(directory,'native-case-'+caseNumber+'.json',{caseNumber,cases:result.caseEvidence.filter(c=>c.caseNumber===caseNumber),snapshots:result.snapshots.filter(s=>s.caseNumber===caseNumber),qualification:false},2*MiB);
  const {snapshots,...summary}=result;await writeJson(directory,'native-child-result.json',{...summary,workerImport:'fulfilled',snapshotFiles:['native-case-1.json','native-case-2.json']},512*1024);
  console.log(JSON.stringify({status:result.status,resultPath,qualification:false}));if(result.status!=='complete')process.exitCode=1;
 }catch(error){await writeJson(directory,'native-child-failure.json',{workerImport:imported?'fulfilled':'rejected',reason:boundedError(error),qualification:false});process.exitCode=1;}
}
async function parent(directory,scratch){
 const prerequisites=await bundle(directory,scratch);await checkContext();await verifyGraph(directory,scratch,prerequisites);
 if(selectedBootstrapMode==='tracker-a')return await parentTrackerA(directory,scratch,prerequisites);
 // Native SDK imports receive the same explicit environment as the child.
 const nativeEnvironment=cleanChildEnvironment();for(const key of Object.keys(process.env))if(!Object.hasOwn(nativeEnvironment,key))delete process.env[key];Object.assign(process.env,nativeEnvironment);
 const frontend=await jsonFile(join(scratch,'static-assets.json'),8*MiB);const originals=new Map(globalOriginalLabels.map(label=>[label,{label,status:'pending'}]));
 let server,command,result,closeEvent,stdio;const failures=[];
 try{
  const {chromium}=await import('playwright');server=await chromium.launchServer({headless:true,host:'127.0.0.1',port:0});originals.get('browserLaunch').status='fulfilled';
  closeEvent=new Promise(resolve=>server.once('close',()=>{originals.get('browserServerClose').status='fulfilled';resolve();}));
  const browserProcess=server.process();stdio=observeBrowserStdio(directory,browserProcess);
  const registry=await physical(join(process.cwd(),'node_modules/playwright-core/browsers.json'),256*1024);await writeBytes(directory,'browser-registry.json',registry.raw,256*1024);
  await writeJson(directory,'browser-process.json',{pid:browserProcess.pid??null,spawnfile:browserProcess.spawnfile??null,spawnargs:browserProcess.spawnargs,configuredExecutablePath:chromium.executablePath(),launchProfile:{headless:true,host:'127.0.0.1',port:0},registrySha256:registry.sha256,registryBytes:registry.bytes,coverage:'post-bind-only',binaryByteIdentity:'unestablished',qualification:false});
  const endpoint=server.wsEndpoint();need(typeof endpoint==='string'&&endpoint.startsWith('ws://127.0.0.1:'));
  await writeJson(directory,'native-child-options.json',{prerequisites,browserEndpoint:endpoint,assets:{root:join(scratch,'dist'),files:frontend.files}},512*1024);
  command=await capture(directory,'application',[process.execPath,'--experimental-import-meta-resolve',fileURLToPath(import.meta.url),'child'],262144,cleanChildEnvironment(),120000);
  if(command.exitObserved)originals.get('applicationChildExit').status='fulfilled';if(command.closeObserved)originals.get('applicationChildClose').status='fulfilled';
  result=await jsonFile(join(directory,'native-child-result.json'),512*1024);originals.get('workerImport').status=result.workerImport;
  for(const row of result.originals){need(['browserConnect','clientClose','clientDisconnected'].includes(row.label));originals.set(row.label,row);}
  successful(command);need(result.status==='complete');
 }catch(error){failures.push(boundedError(error));}
 finally{if(server){try{const original=server.close();await original;originals.get('publicServerClose').status='fulfilled';await closeEvent;if(stdio)await stdio.closed();}catch(error){originals.get('publicServerClose').status='rejected';failures.push(boundedError(error));}}}
 await writeJson(directory,'native-parent-partial.json',{status:failures.length===0&&result?.status==='complete'?'complete':'incomplete',applicationCommand:command??null,cases:result?.cases??[],caseEvidence:result?.caseEvidence??[],browserVersion:result?.browserVersion??null,originals:[...originals.values()],stdio:stdio?.observations??[],failures,qualification:false,fps:'unavailable',scope:'Parent partial only. Its own close and spawn-complete stdio are observed exclusively by the outer owner. Browser event and original close promise remain distinct. Executable byte identity is unestablished.'});
 if(failures.length||result?.status!=='complete')process.exitCode=1;
}
async function parentTrackerA(directory,scratch,prerequisites){
 const plan=await runtimePlan(directory,scratch,prerequisites,true);await beginPilotPhase(directory,'runtime-parent-started-closed',plan.known);
 const started=await jsonFile(join(directory,'parent-started.json'),plan.known.parentStartedBytes);ownData(started,['argv','qualification','originalClosed','startedUtc']);need(JSON.stringify(startupArgv(started.argv,'parent'))===JSON.stringify(fixedWorkerArgv('parent'))&&started.qualification===false&&started.originalClosed===false&&typeof started.startedUtc==='string'&&/^[\x20-\x7e]{1,32}$/.test(started.startedUtc));
 need(await beforePilotMutation(directory,'browser-stdout.bin')===262144&&await beforePilotMutation(directory,'browser-stderr.bin')===262144);
 const nativeEnvironment=cleanChildEnvironment();for(const key of Object.keys(process.env))if(!Object.hasOwn(nativeEnvironment,key))delete process.env[key];Object.assign(process.env,nativeEnvironment);
 const originals=new Map(globalOriginalLabels.map(label=>[label,{label,status:'pending'}]));let server,command,result,childResultRef=null,closeEvent,stdio;const failures=[];
 try{
  const {chromium}=await import('playwright');try{server=await chromium.launchServer({headless:true,host:'127.0.0.1',port:0});originals.get('browserLaunch').status='fulfilled';}catch(error){originals.get('browserLaunch').status='rejected';throw error;}
  closeEvent=new Promise(resolve=>server.once('close',()=>{originals.get('browserServerClose').status='fulfilled';resolve();}));const browserProcess=server.process();stdio=observeBrowserStdio(directory,browserProcess);
  await writeJson(directory,'browser-process.json',{pid:browserProcess.pid??null,spawnfile:browserProcess.spawnfile??null,spawnargs:browserProcess.spawnargs,configuredExecutablePath:chromium.executablePath(),launchProfile:{headless:true,host:'127.0.0.1',port:0},registrySha256:plan.registry.sha256,registryBytes:plan.registry.bytes,coverage:'post-bind-only',binaryByteIdentity:'unestablished',qualification:false});
  const options=validateTrackerAOptions({prerequisites,browserEndpoint:server.wsEndpoint(),assets:plan.assets},prerequisites,plan.assets);need(encoded(options).length<=plan.known.optionsBytes);await writeJson(directory,'native-child-options.json',options,524288);
  command=await capture(directory,'application',fixedWorkerArgv('child'),262144,cleanChildEnvironment(),120000);if(command.exitObserved)originals.get('applicationChildExit').status='fulfilled';if(command.closeObserved)originals.get('applicationChildClose').status='fulfilled';
  const loaded=await loadTrackerAProfile(directory,prerequisites.intent),childFile=await authenticateTrackerAReport(command,'child',loaded.profileRef,{read:(name,cap)=>physical(join(directory,name),cap)});result=childFile.value;childResultRef=childFile.ref;originals.get('workerImport').status=result.workerImport;
  for(const row of result.originals)originals.set(row.label,{label:row.label,status:row.status});successful(command);need(result.status==='complete','Pilot child incomplete');
 }catch(error){failures.push(boundedError(error));}
 finally{if(server){try{const original=server.close();await original;originals.get('publicServerClose').status='fulfilled';await closeEvent;if(stdio)await stdio.closed();}catch(error){originals.get('publicServerClose').status='rejected';failures.push(boundedError(error));}}}
 await verifyGraph(directory,scratch,await bundle(directory,scratch));
 const semantic=result&&childResultRef?result.tracker.semantic:trackerStage(false,'missing-child'),captureStage=result&&childResultRef?result.tracker.capture:trackerStage(false,'missing-child');
 const commandComplete=command?.closeObserved===true&&command.original.streamsComplete===true;const capture=captureStage.status==='complete'&&!commandComplete?trackerStage(false,'transport'):captureStage;
 const ownCleanup=[...originals.values()].filter(row=>row.label!=='parentWorkerClose').every(row=>row.status==='fulfilled')&&(stdio?.observations??[]).every(row=>row.status==='fulfilled');
 const cleanup=trackerStage(result!==undefined&&childResultRef!==null&&result.tracker.cleanup.status==='complete'&&ownCleanup,'cleanup');const status=failures.length===0&&result?.status==='complete'&&[semantic,capture,cleanup].every(s=>s.status==='complete')?'complete':'incomplete';
 const partial={status,applicationCommand:command??null,cases:result?.cases??[],caseEvidence:result?.caseEvidence??[],browserVersion:result?.browserVersion??null,originals:[...originals.values()].map(row=>({label:row.label,status:row.status})),stdio:stdio?.observations??[],failures,qualification:false,fps:'unavailable',scope:'Parent partial only. Its own close and spawn-complete stdio are observed exclusively by the outer owner. Browser event and original close promise remain distinct. Executable byte identity is unestablished.',mode:PILOT_MODE,tracker:{childResultRef,semantic,capture,cleanup}};
 return await publishTrackerAInternalReport('parent',partial,value=>writeJson(directory,'native-parent-partial.json',value,524288));
}
export function nativeGlobalClosureInput(parentCommand,partial){
 need(partial&&typeof partial==='object'&&partial.applicationCommand,'Original parent partial absent');
 const application=partial.applicationCommand,commandOwner=(command,action)=>Array.isArray(command?.argv)&&command.argv.length===4&&command.argv[0]===process.execPath&&command.argv[1]==='--experimental-import-meta-resolve'&&command.argv[2]===fileURLToPath(import.meta.url)&&command.argv[3]===action;
 need(parentCommand!==application&&parentCommand.original!==application.original&&commandOwner(parentCommand,'parent')&&commandOwner(application,'child'),'Distinct original parent/application owners required');
 const stream=s=>Object.fromEntries(['readableEOF','writerFinish','writerClose','writerError','seen','retained','retainedBytesKnown'].map(k=>[k,s[k]]));
 const closed=parentCommand.closeObserved===true&&parentCommand.original.streamsComplete===true&&['stdout','stderr'].every(k=>{const s=parentCommand.streamFacts[k];return s.readableEOF&&s.writerFinish&&s.writerClose&&!s.writerError&&s.retainedBytesKnown&&s.seen===s.retained;});
 return {schemaVersion:1,kind:'global-final',cases:partial.cases,originals:partial.originals.map(row=>row.label==='parentWorkerClose'?{...row,status:closed?'fulfilled':'pending'}:{...row}),applicationExit:application.exitObserved?{exitCode:application.exit.exitCode,signal:application.exit.signal}:{exitCode:null,signal:null},stdio:partial.stdio,parentCommand:{original:parentCommand.original,stdout:stream(parentCommand.streamFacts.stdout),stderr:stream(parentCommand.streamFacts.stderr)}};
}
async function run(directory,scratch){
 await checkContext();const prerequisites=await bundle(directory,scratch);await verifyGraph(directory,scratch,prerequisites);
 if(selectedBootstrapMode==='tracker-a')return await runTrackerA(directory,scratch,prerequisites);
 const command=await capture(directory,'parent',[process.execPath,'--experimental-import-meta-resolve',fileURLToPath(import.meta.url),'parent'],4*MiB,cleanChildEnvironment(),180000);
 let partial=null,globalInput=null,policy=null;const failures=[];
 try{partial=await jsonFile(join(directory,'native-parent-partial.json'),512*1024);globalInput=nativeGlobalClosureInput(command,partial);policy=evaluateMountedClosurePolicy(globalInput);}catch(error){failures.push(boundedError(error));}
 try{successful(command);}catch(error){failures.push(boundedError(error));}
 await writeJson(directory,'native-result.json',{status:failures.length===0&&partial?.status==='complete'&&policy?.status==='accepted'?'complete':'incomplete',cases:partial?.caseEvidence??[],browserVersion:partial?.browserVersion??null,originals:globalInput?.originals??partial?.originals??globalOriginalLabels.map(label=>({label,status:'pending'})),applicationExit:globalInput?.applicationExit??null,stdio:partial?.stdio??[],parentCommand:command,failures:{parent:partial?.failures??null,outer:failures},policy,qualification:false,fps:'unavailable',scope:'Separate outer owner captured the browser parent from spawn; application exit is from its separate original child. Missing partials remain incomplete. Browser registry source and remote version do not establish executable byte identity.'});
 if(failures.length||partial?.status!=='complete'||policy?.status!=='accepted')process.exitCode=1;
}
async function runTrackerA(directory,scratch,prerequisites){
 const plan=await runtimePlan(directory,scratch,prerequisites,false);await assertTrackerARuntimeAbsent(directory,plan.known);await beginPilotPhase(directory,'runtime',plan.known);
 await writeBytes(directory,'browser-registry.json',plan.registry.raw,262144);await authenticateTrackerARegistry(directory,process.cwd());
 const command=await capture(directory,'parent',fixedWorkerArgv('parent'),4194304,cleanChildEnvironment(),180000),loaded=await loadTrackerAProfile(directory,prerequisites.intent);
 let partial=null,parentPartialRef=null,child=null,childResultRef=null,inputRef=null,transportRef=null,transport=null,rawRef=null,globalInput=null,policy=null;const failures=[];
 try{const publication=await authenticateTrackerAReport(command,'parent',loaded.profileRef,{read:(name,cap)=>physical(join(directory,name),cap)});partial=publication.value;parentPartialRef=publication.ref;
  if(partial.tracker.childResultRef!==null){const publishedChild=await authenticateTrackerAReport(partial.applicationCommand,'child',loaded.profileRef,{read:(name,cap)=>physical(join(directory,name),cap)});child=publishedChild.value;childResultRef=publishedChild.ref;need(JSON.stringify(childResultRef)===JSON.stringify(partial.tracker.childResultRef));inputRef=child.tracker.inputRef;transportRef=child.tracker.transportRef;if(transportRef!==null){transport=copyTrackerATransport(await jsonFile(join(directory,'tracker-a-case-2-transport.json'),262144));rawRef=transport.raw.ref;}}
  globalInput=nativeGlobalClosureInput(command,partial);policy=evaluateMountedClosurePolicy(globalInput);
 }catch(error){failures.push(boundedError(error));}
 try{successful(command);}catch(error){failures.push(boundedError(error));}
 let rawCreated=false;try{const raw=await lstat(join(directory,'tracker-a-case-2-trace.json'));need(command.spawned&&raw.isFile()&&!raw.isSymbolicLink()&&raw.size<=4194304,'Assigned raw creation differs');rawCreated=true;}catch(error){if(error?.code!=='ENOENT')throw error;}
 const current=await bundle(directory,scratch);await verifyGraph(directory,scratch,current);need(JSON.stringify(current)===JSON.stringify(prerequisites));
 const semantic=partial?.tracker.semantic??trackerStage(false,'missing-parent'),capture=partial?.tracker.capture??trackerStage(false,'missing-parent'),cleanup=trackerStage(policy?.status==='accepted'&&partial?.tracker.cleanup.status==='complete'&&parentPartialRef!==null&&childResultRef!==null,'cleanup');
 const status=failures.length===0&&partial?.status==='complete'&&policy?.status==='accepted'&&[semantic,capture,cleanup].every(stage=>stage.status==='complete')?'complete':'incomplete';
 const native=constructTrackerANativeResult({status,cases:partial?.caseEvidence??[],browserVersion:partial?.browserVersion??null,originals:globalInput?.originals??partial?.originals??globalOriginalLabels.map(label=>({label,status:'pending'})),applicationExit:globalInput?.applicationExit??null,stdio:partial?.stdio??[],parentCommand:command,failures:{parent:partial?.failures??null,outer:failures},policy,qualification:false,fps:'unavailable',scope:'Separate original outer parent capture. Published incomplete descendants retain authentic refs while original global policy independently refuses. Executable byte identity and outward tracker publication proof are unestablished.',mode:PILOT_MODE,tracker:{childResultRef,parentPartialRef,semantic,capture,cleanup}});
 return await publishTrackerAOuterResult({profileRef:loaded.profileRef,inputRef,transportRef,childResultRef,parentPartialRef,nativeResultRef:null,childResult:child,parentPartial:partial,nativeResult:native,transport,rawCreated,rawRef},{writeNative:value=>writeJson(directory,'native-result.json',value,524288),authenticateNative:()=>publishedFileRef(directory,'native-result.json'),writeTracker:value=>writeJson(directory,'tracker-a-result.json',value,262144)});
}
async function inventory(directory){
 const current=await checkContext();if(selectedBootstrapMode==='tracker-a'){
  const intent=await jsonFile(join(directory,'native-intent.json'),524288);accepted(evaluateMountedTrackerAAdmissionPolicy(intent));need(JSON.stringify(current.selected)===JSON.stringify(intent.source)&&JSON.stringify(current.context)===JSON.stringify(intent.context));const loaded=await loadTrackerAProfile(directory,intent);
  await admitTrackerAInventory(loaded.profileRef,{names:()=>readdir(directory),read:(name,cap)=>physical(join(directory,name),cap)});
  await beginPilotPhase(directory,'inventory');
 }
 const records=[];let total=0;
 const allowed=name=>/^(?:profile|extract|install|browser-install|parent|application)(?:-(?:started|result)\.json|\.(?:stdout|stderr))$/.test(name)||/^(?:prerequisite-run|prerequisite-artifact|static-prerequisite)-(?:intent|receipt)\.json$/.test(name)||/^(?:prerequisite-run|prerequisite-artifact|frontend-settings|native-intent|prerequisite|installed-admission|browser-process|browser-registry|native-child-options|native-child-result|native-child-failure|native-parent-partial|native-result|phase-failure-(?:prepare|install|provision|run|parent|child))\.json$/.test(name)||/^native-case-[12]\.json$/.test(name)||/^browser-(?:stdout|stderr)\.bin$/.test(name)||name==='static-prerequisite.zip';
 for(const entry of await readdir(directory,{withFileTypes:true})){need(entry.isFile()&&!entry.isSymbolicLink()&&ordinaryPath(entry.name)&&(selectedBootstrapMode==='tracker-a'?pilotRoleCap(entry.name)>0:allowed(entry.name)));need(records.length<127);const f=await physical(join(directory,entry.name),selectedBootstrapMode==='tracker-a'?pilotRoleCap(entry.name):32*MiB);total+=f.bytes;need(total<=32*MiB);records.push({path:entry.name,bytes:f.bytes,sha256:f.sha256,regular:true,contained:true,symlink:false});}
 assertInventory(records);const payload={files:records,bytesBeforeInventory:total,qualification:false};const encoded=Buffer.from(JSON.stringify(payload)+'\n');need(total+encoded.length<=32*MiB);await writeBytes(directory,'native-inventory.json',encoded,512*1024);
}
async function main(){
 const action=process.argv[2],mode=environmentMode();
 const perform=async()=>{need(process.argv.length===3&&['prepare','install','provision','run','parent','child','inventory'].includes(action));const {directory,scratch}=paths();return await performAction(action,directory,scratch);};
 if(mode==='tracker-a')return await runTrackerAPilotAction(action,perform,code=>{process.exitCode=code;});await perform();
}
async function performAction(action,directory,scratch){
 if(process.argv[2]==='prepare')await prepare(directory,scratch);
 else if(process.argv[2]==='install')await install(directory,scratch);
 else if(process.argv[2]==='provision'){await checkContext();const prerequisites=await bundle(directory,scratch);await verifyGraph(directory,scratch,prerequisites);await beginPilotPhase(directory,'provision');successful(await capture(directory,'browser-install',[process.execPath,'node_modules/playwright/cli.js','install','--with-deps','chromium']));}
 else if(process.argv[2]==='run')return await run(directory,scratch);
 else if(process.argv[2]==='parent')return await parent(directory,scratch);
 else if(process.argv[2]==='child')return await child(directory,scratch);
 else await inventory(directory);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>handleMountedBootstrapFailure(error,code=>{process.exitCode=code;},async error=>{const reason=boundedError(error);console.error(reason);try{const action=process.argv[2];if(selectedBootstrapMode!==null&&['prepare','install','provision','run','parent','child'].includes(action)){await checkContext();if(selectedBootstrapMode==='tracker-a'){const failure=serializeMountedFailure(action,error);await writeBytes(paths().directory,failure.name,failure.raw,failure.cap);}else await writeJson(paths().directory,'phase-failure-'+action+'.json',{action,reason,status:'incomplete',qualification:false});}}catch{}}));
