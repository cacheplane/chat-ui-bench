// Unused hosted native source. Never rebuild or import the worker before admission.
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,lstat,realpath,readFile,writeFile,readdir} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readSourceSnapshot,COPILOT_PRODUCTION_SOURCES} from '../tests/support/hosted-copilot-context.ts';
import {ordinaryPath,assertInventory,assertProductionOutputInventory,assertOriginalCommand} from '../tests/support/hosted-copilot-contract.ts';
import {MOUNTED_PACKAGE_PINS,evaluateMountedAdmissionPolicy,evaluateMountedModulePolicy,evaluateMountedClosurePolicy} from '../tests/support/hosted-copilot-mounted-policy.ts';

const RELEASE='hosted-copilot-react-h100-r6400-v1',REPOSITORY='cacheplane/chat-ui-bench';
const globalOriginalLabels=['workerImport','browserLaunch','browserConnect','clientClose','clientDisconnected','browserServerClose','publicServerClose','applicationChildExit','applicationChildClose','parentWorkerClose'];
const MiB=1024*1024,hash=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,message='Mounted bootstrap refused')=>{if(!ok)throw new Error(message);};
const id=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const boundedError=e=>{try{return e instanceof Error?e.message.slice(0,512):'Original operation failed';}catch{return 'Original operation failed';}};
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
 const raw=await readFile(path),after=await lstat(path);
 need(raw.length===before.size&&before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs,'Physical input changed');
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
 return {directory:join(temp,'copilot-mounted-'+run+'-1'),scratch:join(temp,'copilot-mounted-static-input-'+run+'-1')};
}
async function writeBytes(directory,name,raw,cap){
 need(ordinaryPath(name)&&raw.length<=cap,'Retained output bound');await writeFile(join(directory,name),raw,{flag:'wx'});
}
async function writeJson(directory,name,value,cap=512*1024){await writeBytes(directory,name,Buffer.from(JSON.stringify(value)+'\n'),cap);}
async function source(){
 const raw=readSourceSnapshot(process.cwd(),COPILOT_PRODUCTION_SOURCES);
 return {commitSha:raw.commitSha,treeSha:raw.treeSha,lockSha256:raw.files.find(f=>f.path==='package-lock.json')?.sha256,files:raw.files};
}
async function checkContext(){
 need(process.version==='v24.20.0'&&process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===REPOSITORY&&process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.RUNNER_OS==='Linux'&&process.platform==='linux'&&process.env.HOSTED_RUNNER_MARKER==='ubuntu-24.04-hosted-copilot-mounted'&&process.env.GITHUB_RUN_ATTEMPT==='1');
 need(process.env.COPILOTKIT_TELEMETRY_DISABLED==='true'&&process.env.DO_NOT_TRACK==='1');
 const selected=await source(),candidate=process.env.HOSTED_CANDIDATE_SHA,ref='refs/tags/'+RELEASE;
 const tag=execFileSync('/usr/bin/git',['--no-optional-locks','rev-parse','--verify',ref+'^{commit}'],{encoding:'utf8',maxBuffer:1024,timeout:5000}).trim();
 need(sha(candidate)&&candidate===selected.commitSha&&candidate===process.env.GITHUB_SHA&&candidate===process.env.GITHUB_WORKFLOW_SHA&&candidate===tag&&process.env.GITHUB_REF===ref&&process.env.GITHUB_WORKFLOW_REF===REPOSITORY+'/.github/workflows/hosted-copilot-mounted.yml@'+ref);
 return {selected,context:{candidateSha:candidate,checkoutSha:selected.commitSha,githubSha:process.env.GITHUB_SHA,workflowSha:process.env.GITHUB_WORKFLOW_SHA,tagSha:tag,repository:REPOSITORY,releaseId:RELEASE,githubRef:ref,workflowRef:process.env.GITHUB_WORKFLOW_REF,eventName:'workflow_dispatch',actions:'true',platform:'linux',runnerOs:'Linux',runnerMarker:'ubuntu-24.04-hosted-copilot-mounted',attempt:'1'}};
}
// Original child close and each stream/writer closure remain separate observations.
async function capture(directory,name,argv,cap=4*MiB,env=cleanChildEnvironment(),deadlineMs=300000){
 need(/^[a-z-]+$/.test(name));await writeJson(directory,name+'-started.json',{argv,qualification:false,originalClosed:false,startedUtc:new Date().toISOString()});
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
 const result={argv,original,spawned,spawnError,timedOut,terminationRequested,exitObserved:exit!==null,exit,closeObserved:true,streamFacts:{stdout:out,stderr:err},descendantClosure:'unqualified',qualification:false};
 await writeJson(directory,name+'-result.json',result);
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
async function bundle(directory,scratch){
 const intent=await jsonFile(join(directory,'native-intent.json')),installed=await jsonFile(join(directory,'installed-admission.json'));
 accepted(evaluateMountedAdmissionPolicy(intent));accepted(evaluateMountedAdmissionPolicy(installed));need(JSON.stringify(installed.intent)===JSON.stringify(intent));
 const module=await jsonFile(join(scratch,'worker-module.json'));accepted(evaluateMountedModulePolicy(module));
 need(module.sourceSha===intent.source.commitSha&&module.runId===intent.prerequisite.originalRunId);
 return {intent,installed,module};
}
async function verifyGraph(directory,scratch,prerequisites){
 const packages=await jsonFile(join(scratch,'worker-installed-packages.json')),files=await jsonFile(join(scratch,'worker-resolution-files.json'));
 need(Array.isArray(packages)&&packages.length===19&&Array.isArray(files)&&files.length===prerequisites.module.resolutions.length&&files.length<=10);
 const lock=await jsonFile(join(process.cwd(),'package-lock.json')),hidden=await jsonFile(join(process.cwd(),'node_modules/.package-lock.json'));const seen=new Set();
 for(const item of packages){
  const pin=MOUNTED_PACKAGE_PINS[item.path];need(pin&&!seen.has(item.path)&&item.version===pin.version&&item.integrity===pin.integrity);seen.add(item.path);
  const actual=await physical(join(process.cwd(),item.path,'package.json'),256*1024),metadata=JSON.parse(actual.raw.toString('utf8'));
  need(actual.sha256===item.manifestSha256&&metadata.name===item.path.split('node_modules/').at(-1)&&metadata.version===pin.version&&lock.packages?.[item.path]?.integrity===pin.integrity&&hidden.packages?.[item.path]?.integrity===pin.integrity&&hidden.packages?.[item.path]?.version===pin.version);
 }
 const worker=join(process.cwd(),prerequisites.module.workerPath);
 need(process.execArgv.length===1&&process.execArgv[0]==='--experimental-import-meta-resolve','Explicit parent-aware resolver flag required');
 for(const resolution of prerequisites.module.resolutions){
  const url=new URL(import.meta.resolve(resolution.specifier,pathToFileURL(worker).href));need(url.protocol==='file:'&&!url.search&&!url.hash&&relative(process.cwd(),fileURLToPath(url))===resolution.entryPath);
  const matching=files.filter(f=>f.path===resolution.entryPath);need(matching.length===1);const current=await physical(fileURLToPath(url),16*MiB);need(current.sha256===matching[0].sha256&&current.bytes===matching[0].bytes);
 }
 const current=await physical(worker,16*MiB);need(current.sha256===prerequisites.module.executedCopySha256&&current.bytes===prerequisites.module.emitted[0].bytes);
 const now=await source();need(JSON.stringify(now)===JSON.stringify(prerequisites.intent.source),'Native selected source changed');
}
async function prepare(directory,scratch){
 await mkdir(directory);const {selected,context}=await checkContext();
 const prerequisite={originalRunId:process.env.HOSTED_STATIC_RUN_ID,attempt:1,sourceSha:selected.commitSha,artifactId:process.env.HOSTED_STATIC_ARTIFACT_ID,archiveSha256:process.env.HOSTED_STATIC_ARCHIVE_SHA256,qualifiedRootReceiptSha256:process.env.HOSTED_STATIC_ROOT_SHA256,qualifiedPeerReceiptSha256:process.env.HOSTED_STATIC_PEER_SHA256,frontendSettingsSha256:process.env.HOSTED_FRONTEND_SETTINGS_SHA256};
 need(id(prerequisite.originalRunId)&&id(prerequisite.artifactId)&&[prerequisite.archiveSha256,prerequisite.qualifiedRootReceiptSha256,prerequisite.qualifiedPeerReceiptSha256,prerequisite.frontendSettingsSha256].every(digest));
 const profile=await capture(directory,'profile',['npm','--version'],65536);successful(profile);need((await physical(join(directory,'profile.stdout'),65536)).raw.toString().trim()==='11.19.0');
 const intent={schemaVersion:1,kind:'pre-install-intent',purpose:'hosted-copilot-mounted-default-react-only',context,source:selected,prerequisite,profile:{nodeVersion:process.version,npmVersion:'11.19.0',telemetryDisabled:'true',doNotTrack:'1'}};
 accepted(evaluateMountedAdmissionPolicy(intent));await writeJson(directory,'native-intent.json',intent);
 const run=await api(directory,'prerequisite-run','repos/'+REPOSITORY+'/actions/runs/'+prerequisite.originalRunId,512*1024);
 const artifact=await api(directory,'prerequisite-artifact','repos/'+REPOSITORY+'/actions/artifacts/'+prerequisite.artifactId,256*1024);
 validateNativePrerequisiteProvider(prerequisite,run,artifact);
 const archive=await api(directory,'static-prerequisite','repos/'+REPOSITORY+'/actions/artifacts/'+prerequisite.artifactId+'/zip',32*MiB,true);need(hash(archive)===prerequisite.archiveSha256&&archive.length===artifact.size_in_bytes);
 const extraction=await capture(directory,'extract',['/usr/bin/python3','-I','-S','-B','-c',extractSource,join(directory,'static-prerequisite.zip'),scratch]);successful(extraction);
 const extracted=await jsonFile(join(directory,'extract.stdout'));const index=new Map(extracted.files.map(f=>[f.path,f]));
 const inventory=await jsonFile(join(scratch,'artifact-inventory.json'));need(inventory.files.length+1===index.size&&inventory.bytesBeforeInventory+index.get('artifact-inventory.json').bytes===extracted.bytes);
 for(const f of inventory.files)need(index.get(f.path)?.sha256===f.sha256&&index.get(f.path)?.bytes===f.bytes);
 const admission=await jsonFile(join(scratch,'admission.json'));need(JSON.stringify(admission.source.files)===JSON.stringify(selected.files)&&admission.source.commitSha===selected.commitSha&&admission.source.treeSha===selected.treeSha);
 const settings=frontendSettingsCommitment(selected);need(settings.sha256===prerequisite.frontendSettingsSha256);await writeBytes(directory,'frontend-settings.json',Buffer.from(JSON.stringify(settings.tuple),'utf8'),65536);
 const frontend=await jsonFile(join(scratch,'static-assets.json'),8*MiB);need(frontend.schemaVersion===4&&frontend.parserComplete===true&&frontend.parserMicrocases?.passed===true&&frontend.parserMicrocases?.count===22);assertProductionOutputInventory(frontend.files);
 for(const f of frontend.files)need(ordinaryPath(f.path)&&index.get('dist/'+f.path)?.sha256===f.sha256&&index.get('dist/'+f.path)?.bytes===f.bytes);
 for(const name of ['inspect','worker-build','worker-inspect']){const result=await jsonFile(join(scratch,'step-'+name+'-result.json'));need(result.sourceSha===selected.commitSha&&result.policyAccepted===true);if(name==='inspect')need(result.originalClosed===true);else need(assertOriginalCommand(result.original).success&&result.originalCloseObserved===true&&result.originalFileCloseObserved===true&&!result.timedOut);}
 const module=await jsonFile(join(scratch,'worker-module.json'));accepted(evaluateMountedModulePolicy(module));need(module.sourceSha===selected.commitSha&&module.runId===prerequisite.originalRunId);
 const original=await physical(join(scratch,'worker/worker.mjs'),16*MiB);need(original.sha256===module.executedCopySha256&&original.bytes===module.emitted[0].bytes);
 const target=join(process.cwd(),module.workerPath);await mkdir(join(target,'..'),{recursive:true});need((await readdir(join(target,'..'))).length===0&&await realpath(join(target,'..'))===join(target,'..'));await writeFile(target,original.raw,{flag:'wx'});
 await writeJson(directory,'prerequisite.json',{prerequisite,provider:{runId:run.id,artifactId:artifact.id,archiveSha256:hash(archive)},externalReviewAssertions:'Root/peer receipt hashes supplied by authorized dispatcher; not signatures or self-authenticated approvals',qualification:false});
}
async function install(directory,scratch){
 const intent=await jsonFile(join(directory,'native-intent.json'));accepted(evaluateMountedAdmissionPolicy(intent));const current=await checkContext();need(JSON.stringify(current.selected)===JSON.stringify(intent.source));
 const original=await capture(directory,'install',['npm','ci','--ignore-scripts','--no-audit','--no-fund']);successful(original);
 const pinned=await jsonFile(join(scratch,'worker-installed-packages.json'));need(pinned.length===19);
 const hidden=await physical(join(process.cwd(),'node_modules/.package-lock.json'),4*MiB);const hiddenValue=JSON.parse(hidden.raw.toString('utf8'));const packages=[];
 for(const item of pinned){const actual=await physical(join(process.cwd(),item.path,'package.json'),256*1024);need(actual.sha256===item.manifestSha256);packages.push({...item});}
 const installed={schemaVersion:1,kind:'post-install-admission',intent,originalInstall:original.original,installedProfile:{sourceSha:intent.source.commitSha,lockSha256:intent.source.lockSha256,originalInstallReceiptSha256:(await physical(join(directory,'install-result.json'),512*1024)).sha256,hiddenLockReceiptSha256:hidden.sha256,checkedInstalledRecords:Object.keys(hiddenValue.packages??{}).length,packages}};
 accepted(evaluateMountedAdmissionPolicy(installed));await writeJson(directory,'installed-admission.json',installed);await verifyGraph(directory,scratch,{intent,installed,module:await jsonFile(join(scratch,'worker-module.json'))});
}
async function child(directory,scratch){
 const options=await jsonFile(join(directory,'native-child-options.json'),512*1024);await verifyGraph(directory,scratch,options.prerequisites);
 const resultPath=join(directory,'native-child-result.json');let imported=false;
 try{
  const importedWorker=await import(pathToFileURL(join(process.cwd(),options.prerequisites.module.workerPath)).href);imported=true;
  need(typeof importedWorker.runNativeMountedConformance==='function','Qualified native export absent');
  const result=await importedWorker.runNativeMountedConformance(options);
  for(const caseNumber of [1,2])await writeJson(directory,'native-case-'+caseNumber+'.json',{caseNumber,cases:result.caseEvidence.filter(c=>c.caseNumber===caseNumber),snapshots:result.snapshots.filter(s=>s.caseNumber===caseNumber),qualification:false},2*MiB);
  const {snapshots,...summary}=result;await writeJson(directory,'native-child-result.json',{...summary,workerImport:'fulfilled',snapshotFiles:['native-case-1.json','native-case-2.json']},512*1024);
  console.log(JSON.stringify({status:result.status,resultPath,qualification:false}));if(result.status!=='complete')process.exitCode=1;
 }catch(error){await writeJson(directory,'native-child-failure.json',{workerImport:imported?'fulfilled':'rejected',reason:boundedError(error),qualification:false});process.exitCode=1;}
}
async function parent(directory,scratch){
 const prerequisites=await bundle(directory,scratch);await checkContext();await verifyGraph(directory,scratch,prerequisites);
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
 const command=await capture(directory,'parent',[process.execPath,'--experimental-import-meta-resolve',fileURLToPath(import.meta.url),'parent'],4*MiB,cleanChildEnvironment(),180000);
 let partial=null,globalInput=null,policy=null;const failures=[];
 try{partial=await jsonFile(join(directory,'native-parent-partial.json'),512*1024);globalInput=nativeGlobalClosureInput(command,partial);policy=evaluateMountedClosurePolicy(globalInput);}catch(error){failures.push(boundedError(error));}
 try{successful(command);}catch(error){failures.push(boundedError(error));}
 await writeJson(directory,'native-result.json',{status:failures.length===0&&partial?.status==='complete'&&policy?.status==='accepted'?'complete':'incomplete',cases:partial?.caseEvidence??[],browserVersion:partial?.browserVersion??null,originals:globalInput?.originals??partial?.originals??globalOriginalLabels.map(label=>({label,status:'pending'})),applicationExit:globalInput?.applicationExit??null,stdio:partial?.stdio??[],parentCommand:command,failures:{parent:partial?.failures??null,outer:failures},policy,qualification:false,fps:'unavailable',scope:'Separate outer owner captured the browser parent from spawn; application exit is from its separate original child. Missing partials remain incomplete. Browser registry source and remote version do not establish executable byte identity.'});
 if(failures.length||partial?.status!=='complete'||policy?.status!=='accepted')process.exitCode=1;
}
async function inventory(directory){
 const records=[];let total=0;
 const allowed=name=>/^(?:profile|extract|install|browser-install|parent|application)(?:-(?:started|result)\.json|\.(?:stdout|stderr))$/.test(name)||/^(?:prerequisite-run|prerequisite-artifact|static-prerequisite)-(?:intent|receipt)\.json$/.test(name)||/^(?:prerequisite-run|prerequisite-artifact|frontend-settings|native-intent|prerequisite|installed-admission|browser-process|browser-registry|native-child-options|native-child-result|native-child-failure|native-parent-partial|native-result|phase-failure-(?:prepare|install|provision|run|parent|child))\.json$/.test(name)||/^native-case-[12]\.json$/.test(name)||/^browser-(?:stdout|stderr)\.bin$/.test(name)||name==='static-prerequisite.zip';
 for(const entry of await readdir(directory,{withFileTypes:true})){need(entry.isFile()&&!entry.isSymbolicLink()&&ordinaryPath(entry.name)&&allowed(entry.name));need(records.length<127);const f=await physical(join(directory,entry.name),32*MiB);total+=f.bytes;need(total<=32*MiB);records.push({path:entry.name,bytes:f.bytes,sha256:f.sha256,regular:true,contained:true,symlink:false});}
 assertInventory(records);const payload={files:records,bytesBeforeInventory:total,qualification:false};const encoded=Buffer.from(JSON.stringify(payload)+'\n');need(total+encoded.length<=32*MiB);await writeBytes(directory,'native-inventory.json',encoded,512*1024);
}
async function main(){
 need(process.argv.length===3&&['prepare','install','provision','run','parent','child','inventory'].includes(process.argv[2]));const {directory,scratch}=paths();
 if(process.argv[2]==='prepare')await prepare(directory,scratch);
 else if(process.argv[2]==='install')await install(directory,scratch);
 else if(process.argv[2]==='provision'){await checkContext();const prerequisites=await bundle(directory,scratch);await verifyGraph(directory,scratch,prerequisites);successful(await capture(directory,'browser-install',[process.execPath,'node_modules/playwright/cli.js','install','--with-deps','chromium']));}
 else if(process.argv[2]==='run')await run(directory,scratch);
 else if(process.argv[2]==='parent')await parent(directory,scratch);
 else if(process.argv[2]==='child')await child(directory,scratch);
 else await inventory(directory);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(async error=>{const reason=boundedError(error);console.error(reason);try{const action=process.argv[2];if(['prepare','install','provision','run','parent','child'].includes(action))await writeJson(paths().directory,'phase-failure-'+action+'.json',{action,reason,status:'incomplete',qualification:false});}catch{}process.exitCode=1;});
