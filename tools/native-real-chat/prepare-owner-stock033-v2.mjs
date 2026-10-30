// Preparation only. Import is inert; this module never imports a capture worker.
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {buildThreadplane} from '../../apps/threadplane/build.mjs';
import {productSourceKeys,parseStock033ProductRecord} from '../../apps/threadplane/provenance.mjs';
import {parseProbeRecord,contractCompiledKeys} from '../../apps/threadplane/probe-provenance.mjs';
import {compilerOutputBytes} from './prepare.mjs';
import {admitStock033DataV2,measureStock033DataV2,stock033Roles,nativeOwnerKeys,requestWindowNativeOwnerKeys,requestWindowV2NativeOwnerKeys,requestWindowV2NativeRuntimeCompiledKeys,requestWindowV2NativeRuntimeSourceKeys,requestWindowPhaseInspectionPolicyV2,nativeRuntimeCompiledKeys,nativeRuntimeSourceKeys,stock033CoreMetadataKeys,stock033MacMetadataKeys,assembleStock033RosterV2,assembleStock033RequestWindowRosterV1,assembleStock033RequestWindowRosterV2} from './roster-stock033-v2.mjs';
import {createStock033PreparationLedgerV2,createStock033RequestWindowPreparationLedgerV1,createTransferredStock033RequestWindowLedgerV1,createTransferredStock033LedgerV2,reconcileStock033LedgerV2,stock033PlatformSetSha256V2,serializeStock033DataV2,readStock033FileV2,writeStock033FileV2,observeStock033PlatformsV2,verifyStock033PlatformsV2,prepareActualStock033V2,verifyStock033PreparationV2,prepareActualStock033V2Tail500,verifyStock033Tail500PreparationV2,prepareActualStock033V2WheelCarrierTail500,verifyStock033WheelCarrierTail500PreparationV2,prepareActualStock033RequestWindowV1,verifyStock033RequestWindowPreparationV1,prepareActualStock033RequestWindowV2,verifyStock033RequestWindowPreparationV2} from './prepare-stock033-v2.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..'),SELF=fileURLToPath(import.meta.url);
const unavailable=()=>Error('native-stock033-preparation-owner-unavailable');
const authority=Object.freeze({nativeSupported:false,clock:'not_evaluated',population:'not_evaluated',FPS:null,scoringEligibility:false});
const generated=new WeakMap(),generatedTail=new WeakMap(),tailPolicy='native-post-phase-tail-500ms-v1';
const wheelFamily=Object.freeze({}),wheelRecipe='native-wheel-carrier-v1',generatedWheel=new WeakMap();
const requestRecipe='native-stock033-request-window-scroll-v1',requestProfiles=['native-history100-v1','native-history1000-v1','native-history10000-v1'],requestFamilies=new Map(requestProfiles.map(profile=>[profile,Object.freeze({profile,generated:new WeakMap()})])),requestV2Families=new Map(requestProfiles.map(profile=>[profile,Object.freeze({profile,phaseInspectionPolicy:requestWindowPhaseInspectionPolicyV2,generated:new WeakMap()})]));
function requestFamily(profile,v2=false){const family=(v2?requestV2Families:requestFamilies).get(profile);if(!family)throw unavailable();return family;}
const isRequest=family=>[...requestFamilies.values(),...requestV2Families.values()].includes(family);
const isRequestV2=family=>[...requestV2Families.values()].includes(family);
const requestVersion=family=>isRequestV2(family)?'v2':'v1';
const selectedOwnerKeys=family=>isRequestV2(family)?requestWindowV2NativeOwnerKeys:isRequest(family)?requestWindowNativeOwnerKeys:nativeOwnerKeys;
const selectedRuntimeKeys=family=>isRequestV2(family)?[...requestWindowV2NativeRuntimeCompiledKeys,...requestWindowV2NativeRuntimeSourceKeys]:[...nativeRuntimeCompiledKeys,...nativeRuntimeSourceKeys];
const selectedAssembler=family=>isRequestV2(family)?assembleStock033RequestWindowRosterV2:isRequest(family)?assembleStock033RequestWindowRosterV1:assembleStock033RosterV2;
const suffix=tail=>tail?'-tail500-v1':'';
const collectionKeys=tail=>isRequest(tail)?['inputRecipe','fixtureProfile',...(isRequestV2(tail)?['phaseInspectionPolicy']:[])]:tail===wheelFamily?['collectionPolicy','inputRecipe']:tail?['collectionPolicy']:[];
const collectionFields=tail=>isRequest(tail)?{inputRecipe:requestRecipe,fixtureProfile:tail.profile,...(isRequestV2(tail)?{phaseInspectionPolicy:requestWindowPhaseInspectionPolicyV2}:{})}:tail===wheelFamily?{collectionPolicy:tailPolicy,inputRecipe:wheelRecipe}:tail?{collectionPolicy:tailPolicy}:{};
const releasePolicy=tail=>isRequest(tail)?'source-reviewed-stock033-inputs-request-window-scroll-'+requestVersion(tail):tail===wheelFamily?'source-reviewed-stock033-inputs-tail500-wheel-v1':'source-reviewed-stock033-preparation-inputs-v2'+suffix(tail);
const configPolicy=tail=>isRequest(tail)?'native-stock033-prep-owner-request-window-scroll-'+requestVersion(tail):tail===wheelFamily?'native-stock033-prep-owner-tail500-wheel-v1':'native-stock033-preparation-owner-v2'+suffix(tail);
const resultPolicy=tail=>isRequest(tail)?'native-stock033-prep-result-request-window-scroll-'+requestVersion(tail):tail===wheelFamily?'native-stock033-prep-result-tail500-wheel-v1':'native-stock033-preparation-owner-result-v2'+suffix(tail);
const prepMode=tail=>isRequest(tail)?'real-chat-stock033-request-window-scroll-'+requestVersion(tail):tail===wheelFamily?'real-chat-stock033-tail500-wheel-v1':'real-chat-history100-stock-033-v2'+suffix(tail);
const refPolicy=tail=>isRequest(tail)?'source-owned-prep-stock033-request-window-scroll-'+requestVersion(tail):tail===wheelFamily?'source-owned-prep-stock033-tail500-wheel-v1':'source-owned-preparation-reference-stock-033-v2'+suffix(tail);
const requestType=(tail,authored=false)=>isRequest(tail)?(authored?'authored-request-window-scroll-':'prepare-request-window-scroll-')+requestVersion(tail):tail===wheelFamily?(authored?'authored-tail500-wheel-v1':'prepare-tail500-wheel-v1'):authored?(tail?'authored-tail500-v1':'authored'):(tail?'prepare-tail500-v1':'prepare');
const generationMap=tail=>isRequest(tail)?tail.generated:tail===wheelFamily?generatedWheel:tail?generatedTail:generated;
function collectionCheck(value,tail){if(isRequest(tail)){if(value.inputRecipe!==requestRecipe||value.fixtureProfile!==tail.profile||(isRequestV2(tail)?value.phaseInspectionPolicy!==requestWindowPhaseInspectionPolicyV2:Object.hasOwn(value,'phaseInspectionPolicy')))throw unavailable();return;}if(tail&&value.collectionPolicy!==tailPolicy||tail===wheelFamily&&value.inputRecipe!==wheelRecipe)throw unavailable();}
function freezeData(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freezeData(item);Object.freeze(value);}return value;}
const environment=()=>({PATH:path.dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME,LC_ALL:'C'});
function closed(value,keys,cap=1048576){admitStock033DataV2(value,cap);if(!value||typeof value!=='object'||!same(Object.keys(value).sort(),[...keys].sort()))throw unavailable();}
function absolute(filename,max=512){if(typeof filename!=='string'||Buffer.byteLength(filename)>max||path.resolve(filename)!==filename)throw unavailable();return filename;}
function host(){if(process.platform!=='darwin'||process.arch!=='arm64')throw unavailable();}
function accounting(ledger){return{totals:ledger.totals(),platformSetSha256:stock033PlatformSetSha256V2(ledger)};}
const counterKeys=Object.freeze(['operations','readBytes','hashBytes','writeBytes','externalWriteBytes','serializedBytes','platformPasses','platformReadBytes','platformReferencedBytes','archiveWriteBytes']);
function encodeCounterTuple(totals){
 closed(totals,counterKeys);return counterKeys.map((key,index)=>{const value=totals[key];if(!Number.isSafeInteger(value)||value<0||Object.is(value,-0))throw unavailable();return[index,value];});
}
function decodeCounterTuple(tuple){
 admitStock033DataV2(tuple,1023);
 if(!Array.isArray(tuple)||tuple.length!==counterKeys.length||!same(Object.keys(tuple),counterKeys.map((_,index)=>String(index))))throw unavailable();
 return Object.fromEntries(counterKeys.map((key,index)=>{const pair=tuple[index];if(!Array.isArray(pair)||pair.length!==2||!same(Object.keys(pair),['0','1'])||pair[0]!==index||Object.is(pair[0],-0)||!Number.isSafeInteger(pair[1])||pair[1]<0||Object.is(pair[1],-0))throw unavailable();return[key,pair[1]];}));
}
function bytes(value,cap,ledger){return serializeStock033DataV2(value,cap,ledger);}
function encodedWidth(value,cap,tail){return isRequest(tail)?measureStock033DataV2(value,cap)+1:Buffer.byteLength(JSON.stringify(value)+'\n');}
async function mkdir(filename,ledger){await ledger.operation('owner mkdir',()=>fs.mkdir(filename,{mode:0o700}));}
async function canonicalRoot(ledger){const root=await ledger.operation('owner source realpath',()=>fs.realpath(ROOT));if(root!==ROOT)throw unavailable();return root;}
async function freshPaths(source,paths,ledger){
 if(new Set(paths).size!==paths.length)throw unavailable();
 for(const filename of paths){absolute(filename,256);if(filename===source||filename.startsWith(source+'/')||paths.some(other=>other!==filename&&(filename.startsWith(other+'/')||other.startsWith(filename+'/'))))throw unavailable();
  const parent=path.dirname(filename);if(await ledger.operation('owner parent realpath',()=>fs.realpath(parent))!==parent)throw unavailable();
  try{await ledger.operation('owner fresh path',()=>fs.lstat(filename));throw unavailable();}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
// This fixed resolver is also used for original build prerequisites. No ambient ng/npm.
function buildCommand(source,{command,args,cwd}){
 if(command==='npm'&&cwd===source&&same(args.slice(0,3),['run','build','--workspace'])&&args.length===4&&/^@chat-ui-bench\/(contract|producer|analyzer|runner)$/.test(args[3]))return{command:process.execPath,args:[path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),...args],cwd};
 if(command==='ng'&&cwd===source+'/apps/threadplane'&&same(args,['build','threadplane','--configuration','production']))return{command:process.execPath,args:[createRequire(cwd+'/package.json').resolve('@angular/cli/bin/ng.js'),...args],cwd};
 throw unavailable();
}
async function commandOriginal(command,args,{cwd,cap=65536,timeout=1000,ledger,cleanup=false}={}){
 const invoke=()=>commandProcess(command,args,{cwd,cap,timeout,ledger});return ledger?ledger.operation('owner original command',invoke,{cleanup}):invoke();
}
async function commandProcess(command,args,{cwd,cap,timeout,ledger}){
 return new Promise((resolve,reject)=>{
  const child=cp.spawn(command,args,{cwd,env:environment(),stdio:['ignore','pipe','pipe']});let error=false,exit=null,close=null,chunks=0;
  const streams={stdout:{parts:[],bytes:0,end:false,close:false},stderr:{parts:[],bytes:0,end:false,close:false}};
  const timer=setTimeout(()=>{error=true;child.kill('SIGKILL');for(const key of Object.keys(streams))child[key].destroy();},timeout);
  child.once('error',()=>error=true);child.once('exit',(code,signal)=>exit={code,signal});
  for(const key of Object.keys(streams)){const state=streams[key],stream=child[key];stream.once('error',()=>error=true);stream.once('end',()=>state.end=true);stream.once('close',()=>state.close=true);stream.on('data',data=>{
   if(!Buffer.isBuffer(data)||++chunks>4096||state.bytes+data.length>cap){error=true;child.kill('SIGKILL');stream.destroy();return;}
   if(ledger)try{ledger.charge('readBytes',data.length);}catch{error=true;child.kill('SIGKILL');stream.destroy();return;}state.bytes+=data.length;state.parts.push(Buffer.from(data));
  });}
  child.once('close',(code,signal)=>queueMicrotask(()=>{clearTimeout(timer);close={code,signal};if(error||!exit||exit.code!==0||exit.signal!==null||code!==0||signal!==null||Object.values(streams).some(s=>!s.end||!s.close))return reject(unavailable());
   resolve({exit,close,stdout:Buffer.concat(streams.stdout.parts),stderr:Buffer.concat(streams.stderr.parts)});
  }));
 });
}
async function sourceObservation(source,ledger){
 const head=await commandOriginal('/usr/bin/git',['-C',source,'rev-parse','HEAD'],{cap:256,ledger});
 const status=await commandOriginal('/usr/bin/git',['-C',source,'status','--porcelain=v1','--untracked-files=all'],{cap:65536,ledger});
 const revision=head.stdout.toString('utf8').trim();if(!/^[a-f0-9]{40}$/.test(revision)||status.stdout.length||head.stderr.length||status.stderr.length)throw unavailable();return{revision,dirty:false};
}
async function processIdentity(pid,ledger,cleanup=false){
 if(!Number.isSafeInteger(pid)||pid<1)throw unavailable();const observed=await commandOriginal('/bin/ps',['-ww','-p',String(pid),'-o','pid=,ppid=,pgid=,lstart='],{cap:256,ledger,cleanup});
 const match=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(observed.stdout.toString());if(!match||Number(match[1])!==pid)throw unavailable();return{pid,ppid:Number(match[2]),pgid:Number(match[3]),start:match[4]};
}
async function contain(original,child,ledger){
 if(!original){if(child&&child.exitCode===null)child.kill('SIGKILL');return;}
 try{const current=await processIdentity(original.pid,ledger,true);if(!same(current,original))return;process.kill(-original.pgid,'SIGKILL');}catch{/* No guessed PID/group replacement. */}
}
const fixedReserved=Object.freeze({writeBytes:262144,externalWriteBytes:262144,serializedBytes:262144,platformPasses:1,platformReadBytes:536870912,platformReferencedBytes:0,archiveWriteBytes:0});
function reservationFromTuple(tuple){if(!Array.isArray(tuple)||tuple.length!==3||tuple.some(n=>!Number.isSafeInteger(n)||n<0))throw unavailable();return{operations:tuple[0],readBytes:tuple[1],hashBytes:tuple[2],...fixedReserved};}
const readOperations=(filename,size)=>2*absolute(filename).split('/').filter(Boolean).length+Math.ceil(size/65536)+7;
const writeOperations=(filename,size)=>absolute(filename).split('/').filter(Boolean).length+6+readOperations(filename,size);
function finalAllowance(config,release,inventoryOperations){
 closed(release.roles,stock033Roles);const members=new Map();let archiveBytes=0;
 for(const role of stock033Roles){if(!Array.isArray(release.roles[role])||release.roles[role].length>1024)throw unavailable();for(const row of release.roles[role]){
  closed(row,['key','bytes','sha256'],4096);if(typeof row.key!=='string'||Buffer.byteLength(row.key)>192||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>2097152)throw unavailable();
  const old=members.get(row.key);if(old){if(!same(old,row))throw unavailable();continue;}if(members.size>=1024||(archiveBytes+=row.bytes)>16777216)throw unavailable();members.set(row.key,row);
 }}
 let operations=inventoryOperations+64,platformBytes=0;
 for(const row of members.values())operations+=readOperations(config.sourceRoot+'/'+row.key,row.bytes)+readOperations(config.preparedDirectory+'/inputs/'+row.key,row.bytes);
 for(const row of release.platformRows){if(!Number.isSafeInteger(row.bytes)||row.bytes<1||(platformBytes+=row.bytes)>536870912)throw unavailable();operations+=readOperations(row.path,row.bytes);}
 for(const[filename,cap]of [[config.preparedDirectory+'/template.json',4096],[config.preparedDirectory+'/app-manifest.json',1048576],[config.preparedDirectory+'/app-manifest.json',1048576],[config.preparedDirectory+'/history.json',65536],[config.preparedDirectory+'/fixture-compiled.mjs',2097152],[config.release.path,1048576],[config.originalConfigPath,1048576]])operations+=readOperations(filename,cap);
 for(const[name,cap]of [['reference.json',4096],['receipt.json',65536],['failure.json',65536]])operations+=writeOperations(config.evidenceDirectory+'/'+name,cap);
 if(release.inputRecipe===requestRecipe){
  const family=requestFamily(release.fixtureProfile),count=family.profile==='native-history10000-v1'?100:family.profile==='native-history1000-v1'?10:0;
  if(members.size+(count?count+4:4)>1024)throw unavailable();
  if(count){
   if(archiveBytes+count*65536+65536+2097152+1048576+262144>16777216)throw unavailable();
   // Existing list reserved one history.json read; new family instead owns the
   // manifest and each chunk, all rechecked during canonical history admission.
   operations-=readOperations(config.preparedDirectory+'/history.json',65536);
   operations+=2*readOperations(config.preparedDirectory+'/history-manifest.json',65536);
   for(let i=0;i<count;i++)operations+=2*readOperations(config.preparedDirectory+'/history-'+String(i).padStart(3,'0')+'.json',65536);
   return[operations,platformBytes+2*archiveBytes+8388608+2*count*65536,platformBytes+2*archiveBytes+10485760+4*count*65536];
  }
 }
 return[operations,platformBytes+2*archiveBytes+8388608,platformBytes+2*archiveBytes+10485760];
}
function childRequest(config,sourceObservation,ledger,nonce,tuple,tail=false){
 ledger.ensureCapacity('serializedBytes',isRequest(tail)?0:1024);
 const request={type:requestType(tail),...collectionFields(tail),nonce,config,sourceObservation,budget:{...accounting(ledger),reservation:tuple}};
 if(isRequestV2(tail))request.budget.totals=encodeCounterTuple(request.budget.totals);
 let width=0;for(let i=0;i<16;i++){
  if(isRequestV2(tail))request.budget.totals[5][1]=ledger.totals().serializedBytes+width;else request.budget.totals.serializedBytes=ledger.totals().serializedBytes+width;admitStock033DataV2(request,1023);
  const next=encodedWidth(request,1023,tail);if(next===width){ledger.charge('serializedBytes',width);const{reservation,...baseline}=request.budget;if(isRequestV2(tail))baseline.totals=decodeCounterTuple(baseline.totals);return{request,baseline};}width=next;
 }throw unavailable();
}
async function ownChild({config,source,ledger,tuple,authoredCase,tail=false}){
 const nonce=randomBytes(16).toString('hex'),authored=authoredCase!==undefined;
 const reserved=reservationFromTuple(tuple??[16384,541065216,541065216]);
 const selection=authored?{request:{type:requestType(tail,true),...collectionFields(tail),nonce,kind:authoredCase},baseline:accounting(ledger)}:childRequest(config,source,ledger,nonce,tuple,tail);
 createTransferredStock033LedgerV2({...accounting(ledger),reservation:reserved});
 ledger.charge('operations',1);const child=cp.fork(SELF,['--preparation-child'],{execPath:process.execPath,execArgv:[],env:environment(),detached:true,serialization:'json',stdio:['ignore','pipe','pipe','ipc']});
 let failed=false,timedOut=false,result=null,messageCount=0,send='pending',ipc=false,exit=null,close=null,original=null,chunks=0,resolveClosed,containment;
 const containOnce=()=>containment??=contain(original,child,ledger);
 const closedChild=new Promise(resolve=>resolveClosed=resolve),streams={stdout:{parts:[],bytes:0,end:false,close:false},stderr:{parts:[],bytes:0,end:false,close:false}};
 child.once('error',()=>failed=true);child.once('exit',(code,signal)=>exit={code,signal});child.once('disconnect',()=>ipc=true);child.once('close',(code,signal)=>{close={code,signal};resolveClosed();});
 for(const key of Object.keys(streams)){const state=streams[key],stream=child[key];stream.once('error',()=>failed=true);stream.once('end',()=>state.end=true);stream.once('close',()=>state.close=true);stream.on('data',data=>{
  if(!Buffer.isBuffer(data)||++chunks>4096||state.bytes+data.length>65536){failed=true;stream.destroy();void containOnce();return;}
  try{ledger.charge('readBytes',data.length);}catch{failed=true;stream.destroy();void containOnce();return;}state.bytes+=data.length;state.parts.push(Buffer.from(data));
 });}
 const receive=value=>{try{if(++messageCount!==1||send!=='fulfilled')throw unavailable();closed(value,['type','nonce','template','reference','accounting',...collectionKeys(tail),...(authored?['authoredControl']:[])],tail?8191:8192);collectionCheck(value,tail);if(tail===wheelFamily||isRequest(tail)){collectionCheck(value.template,tail);collectionCheck(value.reference,tail);}if(value.type!=='prepared'||value.nonce!==nonce||authored!==Boolean(value.authoredControl)||(!authored&&(value.template?.authoredControl||value.reference?.authoredControl||value.template?.mode!==prepMode(tail)||value.reference?.policy!==refPolicy(tail)||tail&&!isRequest(tail)&&(value.template.collectionPolicy!==tailPolicy||value.reference.collectionPolicy!==tailPolicy))))throw unavailable();closed(value.accounting,['totals','platformSetSha256','peakHandles','peakOperations','stages'],512);result=value;}catch{failed=true;child.off('message',receive);void containOnce();}};child.on('message',receive);
 let timer,baseline;
 try{
  original=await processIdentity(child.pid,ledger);if(original.ppid!==process.pid||original.pgid!==child.pid)throw unavailable();
  baseline=selection.baseline;
  // Child ceiling validation happens before request dispatch; parent remaining work is reserved.
  createTransferredStock033LedgerV2({...baseline,reservation:reserved});
  ledger.charge('operations',1);await new Promise((resolve,reject)=>child.send(selection.request,error=>{send=error?'rejected':'fulfilled';error?reject(error):resolve();}));
  const timeout=authored?3000:Math.max(1,ledger.remainingForwardMs());
  const deadline=new Promise(resolve=>timer=setTimeout(()=>{failed=true;timedOut=true;void containOnce();resolve('deadline');},timeout));
  if(await Promise.race([closedChild.then(()=> 'closed'),deadline])==='deadline'){
   await containOnce();for(const key of Object.keys(streams))if(!streams[key].close)child[key].destroy();
   let joinTimer;try{await Promise.race([closedChild,new Promise(resolve=>joinTimer=setTimeout(resolve,authored?4000:Math.max(1,ledger.remainingFinalMs())))]);}finally{clearTimeout(joinTimer);}
  }
  if(failed||!result||!exit||!close||exit.code!==0||exit.signal!==null||close.code!==0||close.signal!==null||!ipc||Object.values(streams).some(s=>!s.end||!s.close)||ledger.pending().length)throw unavailable();
  const {peakHandles,peakOperations,stages,...final}=result.accounting;
  if(!Number.isSafeInteger(peakHandles)||peakHandles<0||peakHandles>8||!Number.isSafeInteger(peakOperations)||peakOperations<0||peakOperations>16||!Number.isSafeInteger(stages)||stages<0||stages>64)throw unavailable();
  if(!authored){createTransferredStock033LedgerV2({...final,reservation:reserved});reconcileStock033LedgerV2(ledger,baseline,final);}
  try{ledger.charge('operations',1);process.kill(-original.pgid,0);throw unavailable();}catch(error){if(error.code!=='ESRCH')throw error;}
  ledger.assertActive();
  const facts=Object.fromEntries(Object.entries(streams).map(([key,s])=>[key,{bytes:s.bytes,sha256:ledger.hash(Buffer.concat(s.parts)),end:s.end,close:s.close}]));
  return{child:{...original,nonce,send,ipc,exit,close},request:selection.request,...facts,prepared:{template:result.template,reference:result.reference,...(tail===wheelFamily?{inputRecipe:wheelRecipe}:{})},childAccounting:result.accounting,authority,...(tail===wheelFamily?{inputRecipe:wheelRecipe}:{}),...(authored?{authoredControl:true}:{})};
 }catch{
  const error=unavailable();error.ownerObservation={original,nonce,send,ipc,exit,close,messageCount,timedOut,stdout:{bytes:streams.stdout.bytes,end:streams.stdout.end,close:streams.stdout.close},stderr:{bytes:streams.stderr.bytes,end:streams.stderr.end,close:streams.stderr.close}};throw error;
 }finally{
  clearTimeout(timer);if(!close||failed)await containOnce();
  if(!close){let cleanupTimer;try{await Promise.race([closedChild,new Promise(resolve=>cleanupTimer=setTimeout(resolve,Math.max(1,authored?4000:ledger.remainingFinalMs())))]);}finally{clearTimeout(cleanupTimer);}}
 }
}

/** Original stock build is a separate opaque prerequisite, outside owner admission
 * clock/source I/O accounting. Its fixed child commands still require original closure.
 * The returned build record objects are joined immediately to closed canonical bytes. */
export async function generateStock033PreparationInputsV2(options){return generateInputs(options,false);}
export async function generateStock033PreparationInputsV2Tail500(options){return generateInputs(options,true);}
function selectedRequestOptions(options,keys,v2=false){closed(options,[...keys,'fixtureProfile']);const family=requestFamily(options.fixtureProfile,v2),copy={};for(const key of keys)copy[key]=key==='generation'?options[key]:structuredClone(options[key]);return{family,options:copy};}
function selectedRequestOwnerOptions(options,v2=false){admitStock033DataV2(options);return selectedRequestOptions(options,['config',...(Object.hasOwn(options??{},'generation')?['generation']:[])],v2);}
export async function generateStock033RequestWindowPreparationInputsV1(options){const selected=selectedRequestOptions(options,['inputDirectory','preparedDirectory','compilationDirectory','evidenceDirectory']);return generateInputs(selected.options,selected.family);}
export async function runStock033RequestWindowPreparationOwnerV1(options){const selected=selectedRequestOwnerOptions(options);return runOwner(selected.options,undefined,selected.family);}
export async function generateStock033RequestWindowPreparationInputsV2(options){const selected=selectedRequestOptions(options,['inputDirectory','preparedDirectory','compilationDirectory','evidenceDirectory'],true);return generateInputs(selected.options,selected.family);}
export async function runStock033RequestWindowPreparationOwnerV2(options){const selected=selectedRequestOwnerOptions(options,true);return runOwner(selected.options,undefined,selected.family);}
async function generateInputs(options,tail){
 try{
  closed(options,['inputDirectory','preparedDirectory','compilationDirectory','evidenceDirectory']);options=structuredClone(options);host();if(process.env.ESBUILD_BINARY_PATH!==undefined)throw unavailable();
  const source=ROOT,prerequisiteLedger=createStock033PreparationLedgerV2(),beforeBuild=await sourceObservation(source,prerequisiteLedger),buildCommands=[];
  const build=await buildThreadplane({root:source,runCommand:async selected=>{const cmd=buildCommand(source,selected),original=await commandOriginal(cmd.command,cmd.args,{cwd:cmd.cwd,timeout:600000});buildCommands.push({command:cmd.command,args:cmd.args,exit:original.exit,close:original.close,stdoutBytes:original.stdout.length,stderrBytes:original.stderr.length});}});
  const ledger=(isRequest(tail)?createStock033RequestWindowPreparationLedgerV1:createStock033PreparationLedgerV2)({initial:prerequisiteLedger.totals()}),generationStarted=performance.now();await canonicalRoot(ledger);
  const paths=Object.values(options);await freshPaths(source,paths,ledger);const observedSource=await sourceObservation(source,ledger);if(!same(beforeBuild,observedSource))throw unavailable();
  const productRead=await readStock033FileV2(source+'/apps/threadplane/.build-evidence.json',262144,ledger),probeRead=await readStock033FileV2(source+'/packages/runner/.comparison-build-evidence.json',262144,ledger);
  const contract=await import('../../packages/contract/dist/index.js'),product=parseStock033ProductRecord(productRead.bytes,contract),probe=parseProbeRecord(probeRead.bytes,contract);
  originalBuildJoin(build,product,probe);
  const esbuild=createRequire(source+'/package.json')('esbuild');let compiled;
  try{const built=await esbuild.build({absWorkingDir:source,entryPoints:[isRequest(tail)?'tools/native-real-chat/request-window-fixture-entry.mjs':'tools/native-real-chat/fixture-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'node24',write:false,metafile:true,logLevel:'silent',banner:{js:"import{createRequire as __fixtureRequire}from'node:module';const require=__fixtureRequire(import.meta.url);"}});ledger.ensureCapacity('serializedBytes',3145728);compiled=compilerOutputBytes(built);ledger.charge('serializedBytes',compiled.moduleBytes.length+compiled.metafileBytes.length);}
  finally{await esbuild.stop();}
  const fixtureMeta=JSON.parse(compiled.metafileBytes.toString()),fixtureNames=Object.keys(fixtureMeta.inputs).sort();if(fixtureNames.length<1||fixtureNames.length>256)throw unavailable();
  const inventoryOps=Object.fromEntries(['realpath','lstat','readdir'].map(method=>[method,async(...args)=>{const value=await ledger.operation('generator inventory '+method,()=>fs[method](...args));if(method==='readdir'&&value.length>1024)throw unavailable();return value;}]));
  const approvedProduct=[...await productSourceKeys(source,{ops:inventoryOps}),...contractCompiledKeys].sort();
  const metadata=[...new Set([...stock033CoreMetadataKeys,...stock033MacMetadataKeys,...product.packages.map(p=>p.resolutionPath+'/package.json')])].sort();
  const keys={'product-source':Object.keys(product.sourceHashes),'probe-source':Object.keys(probe.sourceHashes),'probe-compiled':Object.keys(probe.compiledHashes),'fixture-input':fixtureNames,'native-owner':selectedOwnerKeys(tail),'native-runtime':selectedRuntimeKeys(tail),metadata,'served-asset':Object.keys(product.assetHashes).map(name=>'apps/threadplane/dist/'+name)};
  const facts=new Map();for(const key of [...new Set(Object.values(keys).flat())].sort()){const observed=await readStock033FileV2(source+'/'+key,2097152,ledger);facts.set(key,{key,bytes:observed.fact.bytes,sha256:observed.fact.sha256});}
  const roles=Object.fromEntries(stock033Roles.map(role=>[role,[...keys[role]].sort().map(key=>facts.get(key))]));for(const row of roles['fixture-input'])if(fixtureMeta.inputs[row.key].bytes!==row.bytes)throw unavailable();
  ledger.ensureCapacity('hashBytes',2097152);const roster=selectedAssembler(tail)({roles,observedRoles:roles,rootAuthority:{product,probe,productSourceKeys:approvedProduct,fixtureInputs:roles['fixture-input'],platform:process.platform,architecture:process.arch}});ledger.charge('hashBytes',roster.digestBytes);
  const browser=fixedBrowser(source);if(probe.nativeCompiler.executablePath!=='node_modules/@typescript/typescript-darwin-arm64/lib/tsc')throw unavailable();
  const platformPaths=fixedPlatformPaths(source,browser);
  const platformRows=await observeStock033PlatformsV2(platformPaths.map((filename,i)=>({key:'platform/file'+i,path:filename})),ledger);
  const runtime={executablePath:browser,expectedExecutableBytes:platformRows[3].bytes,expectedExecutableSha256:platformRows[3].sha256,playwrightVersion:'1.64.0',browserRevision:'1248',expectedProduct:'HeadlessChrome/156.0.8078.4',expectedRevision:'@f842f52ef39fd97b449eb27cff414bf05a98ddce',launchFlags:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-automation'],headless:true};
  if(!same(observedSource,await sourceObservation(source,ledger)))throw unavailable();
  await readStock033FileV2(source+'/apps/threadplane/.build-evidence.json',262144,ledger,productRead.fact);await readStock033FileV2(source+'/packages/runner/.comparison-build-evidence.json',262144,ledger,probeRead.fact);
  if(isRequest(tail)){
   const count=tail.profile==='native-history10000-v1'?100:tail.profile==='native-history1000-v1'?10:0,chunkBytes=count===100?5803990:count===10?579400:65536;
   if(roster.unionCount+(count?count+4:4)>1024||roster.archiveBytes+chunkBytes+(count?65536:0)+compiled.moduleBytes.length+1048576+262144>16777216)throw unavailable();
   ledger.ensureCapacity('serializedBytes',chunkBytes+compiled.moduleBytes.length+compiled.metafileBytes.length);
  }
  await mkdir(options.inputDirectory,ledger);
  await writeStock033FileV2(options.inputDirectory+'/fixture-metafile.json',compiled.metafileBytes,1048576,ledger);
  const release={schema:1,policy:releasePolicy(tail),...collectionFields(tail),source:observedSource,build:{product:{key:'apps/threadplane/.build-evidence.json',fact:productRead.fact},probe:{key:'packages/runner/.comparison-build-evidence.json',fact:probeRead.fact}},roles,fixtureInputs:roles['fixture-input'],runtime,platformRows};
  const releasePath=options.inputDirectory+'/release.json',releaseFact=await writeStock033FileV2(releasePath,bytes(release,1048576,ledger),1048576,ledger);
  const config={schema:1,policy:configPolicy(tail),...collectionFields(tail),sourceRoot:source,preparedDirectory:options.preparedDirectory,compilationDirectory:options.compilationDirectory,evidenceDirectory:options.evidenceDirectory,release:{path:releasePath,fact:releaseFact}},configPath=options.inputDirectory+'/config.json';
  const configFact=await writeStock033FileV2(configPath,bytes(config,1048576,ledger),1048576,ledger);
  const result=freezeData({config:{path:configPath,fact:configFact},release:{path:releasePath,fact:releaseFact},roster:{digest:roster.digest,roleCounts:roster.roleCounts,unionCount:roster.unionCount,overlapCount:roster.overlapCount},buildCommands,generationDurationMs:performance.now()-generationStarted,...(isRequest(tail)?collectionFields(tail):{})});
  bytes(result,65536,ledger);generationMap(tail).set(result,accounting(ledger));return result;
 }catch{throw unavailable();}
}
async function readConfig(config,ledger,tail=false){
 closed(config,['path','fact'],4096);absolute(config.path);const read=await readStock033FileV2(config.path,1048576,ledger,config.fact),value=JSON.parse(read.bytes.toString());
 closed(value,['schema','policy','sourceRoot','preparedDirectory','compilationDirectory','evidenceDirectory','release',...collectionKeys(tail)]);collectionCheck(value,tail);if(value.schema!==1||value.policy!==configPolicy(tail)||value.sourceRoot!==ROOT)throw unavailable();
 for(const key of ['sourceRoot','preparedDirectory','compilationDirectory','evidenceDirectory'])absolute(value[key],256);closed(value.release,['path','fact']);absolute(value.release.path);
 return value;
}
function fixedPlatformPaths(source,browser){return[process.execPath,source+'/node_modules/@typescript/typescript-darwin-arm64/lib/tsc',source+'/node_modules/@esbuild/darwin-arm64/bin/esbuild',browser,source+'/node_modules/playwright-core/lib/coreBundle.js'];}
function fixedBrowser(source){return createRequire(source+'/package.json')('playwright-core/lib/coreBundle').registry.registry.findExecutable('chromium-headless-shell').executablePath();}
function fixedPlatforms(release,source){
 if(!Array.isArray(release.platformRows)||release.platformRows.length!==5)throw unavailable();
 const expected=fixedPlatformPaths(source,fixedBrowser(source));
 for(let i=0;i<expected.length;i++){const row=release.platformRows.find(row=>row.key==='platform/file'+i);if(!row||row.path!==expected[i])throw unavailable();}
}
export async function runStock033PreparationOwnerV2(options){
 return runOwner(options);
}
export async function runStock033PreparationOwnerV2Tail500(options){return runOwner(options,undefined,true);}
async function runOwner(options,originalLedger,tail=false){
 let ledger,timer;
 try{
  admitStock033DataV2(options);closed(options,['config',...(Object.hasOwn(options,'generation')?['generation']:[])]);options={config:structuredClone(options.config),...(Object.hasOwn(options,'generation')?{generation:options.generation}:{})};host();
  const initial=options.generation===undefined?null:generationMap(tail).get(options.generation);if(options.generation!==undefined&&(!initial||!same(options.config,options.generation.config)))throw unavailable();
  ledger=originalLedger??(initial?(isRequest(tail)?createTransferredStock033RequestWindowLedgerV1:createTransferredStock033LedgerV2)({...initial,reservation:Object.fromEntries(Object.keys(initial.totals).map(key=>[key,0]))}):(isRequest(tail)?createStock033RequestWindowPreparationLedgerV1:createStock033PreparationLedgerV2)());
  const original=ownerBody(options,ledger,tail);const deadline=new Promise((_,reject)=>timer=setTimeout(()=>reject(unavailable()),Math.max(1,ledger.remainingFinalMs())));
  return await Promise.race([original,deadline]);
 }catch{throw unavailable();}finally{clearTimeout(timer);}
}
async function ownerBody(options,ledger,tail=false){
 let config,observation,release,result,evidenceCreated=false;
 try{
  config=await readConfig(options.config,ledger,tail);const source=await canonicalRoot(ledger);await freshPaths(source,[config.preparedDirectory,config.compilationDirectory,config.evidenceDirectory],ledger);
  ledger.stage('owner-admitted');
  observation=await sourceObservation(source,ledger);const releaseRead=await readStock033FileV2(config.release.path,1048576,ledger,config.release.fact);release=JSON.parse(releaseRead.bytes.toString());if(!same(release.source,observation))throw unavailable();
  if(tail){closed(release,['schema','policy','source','build','roles','fixtureInputs','runtime','platformRows',...collectionKeys(tail)]);collectionCheck(release,tail);if(release.schema!==1||release.policy!==releasePolicy(tail))throw unavailable();}
  fixedPlatforms(release,source);
  if(stock033PlatformSetSha256V2(ledger)===null)await verifyStock033PlatformsV2(release.platformRows,ledger);
  await mkdir(config.evidenceDirectory,ledger);evidenceCreated=true;await writeStock033FileV2(config.evidenceDirectory+'/config.json',bytes(config,1048576,ledger),1048576,ledger);await writeStock033FileV2(config.evidenceDirectory+'/release.json',releaseRead.bytes,1048576,ledger);
  const inventoryStart=ledger.totals().operations,inventoryOps=Object.fromEntries(['realpath','lstat','readdir'].map(method=>[method,async(...args)=>{const value=await ledger.operation('owner inventory '+method,()=>fs[method](...args));if(method==='readdir'&&value.length>1024)throw unavailable();return value;}]));
  const inventory=[...await productSourceKeys(source,{ops:inventoryOps}),...contractCompiledKeys].sort();if(!same(inventory,release.roles['product-source'].map(row=>row.key).sort()))throw unavailable();
  const tuple=finalAllowance({...config,originalConfigPath:options.config.path},release,ledger.totals().operations-inventoryStart);
  ledger.stage('owner-child-dispatch');result=await ownChild({config:options.config,source:observation,ledger,tuple,tail});ledger.stage('owner-child-closed');
  const verified=await (isRequestV2(tail)?verifyStock033RequestWindowPreparationV2:isRequest(tail)?verifyStock033RequestWindowPreparationV1:tail===wheelFamily?verifyStock033WheelCarrierTail500PreparationV2:tail?verifyStock033Tail500PreparationV2:verifyStock033PreparationV2)(config.preparedDirectory,result.prepared.template,result.prepared.reference,{ledger});if(!same(verified,result.prepared.template))throw unavailable();
  const manifestRead=await readStock033FileV2(config.preparedDirectory+'/app-manifest.json',1048576,ledger,result.prepared.reference.manifest),manifest=JSON.parse(manifestRead.bytes.toString());
  if(!same(observation,await sourceObservation(source,ledger)))throw unavailable();await readStock033FileV2(config.release.path,1048576,ledger,config.release.fact);await readStock033FileV2(options.config.path,1048576,ledger,options.config.fact);
  ledger.assertFinal();if(ledger.pending().length)throw unavailable();
  const referenceFact=await writeStock033FileV2(config.evidenceDirectory+'/reference.json',bytes(result.prepared.reference,4096,ledger),4096,ledger);
  const receipt={schema:1,policy:resultPolicy(tail),...collectionFields(tail),accountingBoundary:options.generation===undefined?'owner-inputs-only':'generator-through-owner',status:'original-process-closed',terminalReceiptWrite:'pending',source:observation,config:options.config,release:config.release,build:release.build,roster:{digest:manifest.roster.digest,roleCounts:manifest.roster.roleCounts,unionCount:manifest.roster.unionCount,overlapCount:manifest.roster.overlapCount},child:{...result.child,request:result.request,accounting:result.childAccounting},stdout:result.stdout,stderr:result.stderr,stages:ledger.stageRows(),pending:ledger.pending(),io:accounting(ledger),prepared:result.prepared,referenceFact,error:null,authority};
  const receiptFact=await writeStock033FileV2(config.evidenceDirectory+'/receipt.json',bytes(receipt,65536,ledger),65536,ledger);ledger.assertFinal();return{...receipt,io:accounting(ledger),terminalReceiptWrite:'fulfilled',receiptFact};
 }catch(error){
  if(evidenceCreated&&ledger.remainingForwardMs()>0&&ledger.pending().length===0){
   const refusal={schema:1,policy:resultPolicy(tail),...collectionFields(tail),accountingBoundary:options.generation===undefined?'owner-inputs-only':'generator-through-owner',status:'unavailable',terminalReceiptWrite:'pending',source:observation??null,config:options.config,release:config.release,build:release?.build??null,child:error.ownerObservation??result?.child??null,stages:ledger.stageRows(),pending:ledger.pending(),io:accounting(ledger),prepared:null,error:'original-preparation-unavailable',authority};
   try{await writeStock033FileV2(config.evidenceDirectory+'/failure.json',bytes(refusal,65536,ledger),65536,ledger);}catch{/* Original failure remains unavailable, including inability to persist it. */}
  }throw unavailable();
 }
}
function originalBuildJoin(build,product,probe){closed(build,['product','probe']);if(!same(product,build.product)||!same(probe,build.probe))throw unavailable();}
function successEnvelope(nonce,result,ledger,authored=false,tail=false){
 ledger.ensureCapacity('serializedBytes',isRequest(tail)?0:8192);
 let value={type:'prepared',...collectionFields(tail),nonce,template:result.template,reference:result.reference,accounting:{...accounting(ledger),...Object.fromEntries(['peakHandles','peakOperations','stages'].map(key=>[key,ledger.snapshot()[key]]))},...(authored?{authoredControl:true}:{})};
 // Account exactly one terminal serialization, including the digits of that total.
 let width=0;for(let i=0;i<16;i++){const next=structuredClone(value);next.accounting.totals.serializedBytes=ledger.totals().serializedBytes+width;admitStock033DataV2(next,8191);closed(next.accounting,['totals','platformSetSha256','peakHandles','peakOperations','stages'],512);const nextWidth=encodedWidth(next,8191,tail);value=next;if(nextWidth===width){ledger.charge('serializedBytes',width);return value;}width=nextWidth;}throw unavailable();
}
async function childEntry(){
 let received=false;
 process.on('message',async request=>{
  if(received){process.exitCode=1;process.disconnect();return;}received=true;
  try{
   if(request?.type==='authored'||request?.type==='authored-tail500-v1'||request?.type==='authored-tail500-wheel-v1'||request?.type==='authored-request-window-scroll-v1'||request?.type==='authored-request-window-scroll-v2')return await authoredChild(request);
   const tail=request?.type==='prepare-request-window-scroll-v2'?requestFamily(request.fixtureProfile,true):request?.type==='prepare-request-window-scroll-v1'?requestFamily(request.fixtureProfile):request?.type==='prepare-tail500-wheel-v1'?wheelFamily:request?.type==='prepare-tail500-v1';closed(request,['type','nonce','config','sourceObservation','budget',...collectionKeys(tail)],tail?1023:1024);collectionCheck(request,tail);if(request.type!==requestType(tail)||!/^[a-f0-9]{32}$/.test(request.nonce))throw unavailable();host();
   closed(request.budget,['totals','platformSetSha256','reservation']);const reserved=reservationFromTuple(request.budget.reservation);
   const ledger=(isRequest(tail)?createTransferredStock033RequestWindowLedgerV1:createTransferredStock033LedgerV2)({...request.budget,...(isRequestV2(tail)?{totals:decodeCounterTuple(request.budget.totals)}:{}),reservation:reserved}),config=await readConfig(request.config,ledger,tail);await canonicalRoot(ledger);
   const releaseRead=await readStock033FileV2(config.release.path,1048576,ledger,config.release.fact),release=JSON.parse(releaseRead.bytes.toString());
   const result=await (isRequestV2(tail)?prepareActualStock033RequestWindowV2:isRequest(tail)?prepareActualStock033RequestWindowV1:tail===wheelFamily?prepareActualStock033V2WheelCarrierTail500:tail?prepareActualStock033V2Tail500:prepareActualStock033V2)({mode:prepMode(tail),...collectionFields(tail),sourceRoot:ROOT,outputDirectory:config.preparedDirectory,compilationDirectory:config.compilationDirectory,release,sourceObservation:request.sourceObservation,ledger});
   ledger.charge('operations',2);const envelope=successEnvelope(request.nonce,result,ledger,false,tail);await new Promise((resolve,reject)=>process.send(envelope,error=>error?reject(error):resolve()));process.disconnect();
  }catch{process.exitCode=1;process.stderr.write('native-stock033-preparation-child-unavailable\n');if(process.connected)process.disconnect();}
 });
}
const authoredCases=new Set(['success','wrong-nonce','duplicate','nonzero','disconnect','overflow','inherited-pipe','timeout']);
const wheelAuthoredCases=new Set([...authoredCases,'wrong-recipe','wrong-template-recipe','wrong-reference-recipe']);
export function createStock033OwnerAuthoredControlV2(){return ownerAuthoredControl(false);}
export function createStock033OwnerAuthoredControlV2Tail500(){return ownerAuthoredControl(true);}
function ownerAuthoredControl(tail){
 return Object.freeze({
  run:async kind=>{if(!(tail===wheelFamily?wheelAuthoredCases:authoredCases).has(kind))throw unavailable();return ownChild({ledger:createStock033PreparationLedgerV2(),authoredCase:kind,tail});},
  joinOriginalBuild:(build,product,probe)=>{originalBuildJoin(build,product,probe);return{authoredControl:true};},
  resultEnvelope:(text,serializedBytes=0)=>successEnvelope('a'.repeat(32),{template:{authoredControl:true,text,...(tail===wheelFamily||isRequest(tail)?collectionFields(tail):{})},reference:{policy:'authored-owner-reference-stock033-v2',authoredControl:true,...(tail===wheelFamily||isRequest(tail)?collectionFields(tail):{})}},createStock033PreparationLedgerV2({initial:{serializedBytes}}),true,tail),
  requestEnvelope:(filename,serializedBytes=0)=>{const zero=createStock033PreparationLedgerV2().totals(),ledger=createTransferredStock033LedgerV2({totals:{...zero,serializedBytes,platformReferencedBytes:1},platformSetSha256:'a'.repeat(64),reservation:zero}),fact={bytes:1,sha256:'b'.repeat(64),identity:{dev:1,ino:1,size:1,mtimeMs:1,ctimeMs:1}};return{...childRequest({path:filename,fact},{revision:'a'.repeat(40),dirty:false},ledger,'a'.repeat(32),[1000,1000000,1000000],tail),authoredControl:true};},
  reservationFor:(config,release,inventoryOperations)=>({tuple:finalAllowance(config,release,inventoryOperations),authoredControl:true})
 });
}
async function authoredChild(request){
 const tail=request.type==='authored-request-window-scroll-v2'?requestFamily(request.fixtureProfile,true):request.type==='authored-request-window-scroll-v1'?requestFamily(request.fixtureProfile):request.type==='authored-tail500-wheel-v1'?wheelFamily:request.type==='authored-tail500-v1';closed(request,['type','nonce','kind',...collectionKeys(tail)],1024);collectionCheck(request,tail);if(!(tail===wheelFamily?wheelAuthoredCases:authoredCases).has(request.kind))throw unavailable();
 if(request.kind==='timeout'){setTimeout(()=>{},10000);return;}
 if(request.kind==='disconnect'){process.disconnect();return;}
 if(request.kind==='overflow')process.stdout.write(Buffer.alloc(65537));
 if(request.kind==='inherited-pipe')cp.spawn(process.execPath,['-e','setTimeout(()=>{},3500)'],{stdio:['ignore',process.stdout,process.stderr],env:environment()});
 const envelope=successEnvelope(request.kind==='wrong-nonce'?'0'.repeat(32):request.nonce,{template:{authoredControl:true,...collectionFields(tail)},reference:{policy:'authored-owner-reference-stock033-v2'+suffix(tail),authoredControl:true,...collectionFields(tail)}},createStock033PreparationLedgerV2(),true,tail);
 if(tail===wheelFamily){if(request.kind==='wrong-recipe')envelope.inputRecipe='wrong';if(request.kind==='wrong-template-recipe')envelope.template.inputRecipe='wrong';if(request.kind==='wrong-reference-recipe')envelope.reference.inputRecipe='wrong';}
 await new Promise((resolve,reject)=>process.send(envelope,error=>error?reject(error):resolve()));
 if(request.kind==='duplicate')await new Promise(resolve=>process.send(envelope,()=>resolve()));
 if(request.kind==='nonzero')process.exitCode=1;process.disconnect();
}
if(process.argv[1]===SELF){
 if(process.argv.length===3&&process.argv[2]==='--preparation-child'&&process.send)await childEntry();
 else if(process.argv.length===4&&['--config','--config-tail500-v1','--config-tail500-wheel-v1','--config-request-window-scroll-v1','--config-request-window-scroll-v2'].includes(process.argv[2])){
  // CLI is the trusted outer invocation. It observes the original config fact;
  // this is explicit root trust, not authentication from arbitrary DTO hashes.
  try{host();const ledger=(process.argv[2].startsWith('--config-request-window-scroll-')?createStock033RequestWindowPreparationLedgerV1:createStock033PreparationLedgerV2)(),configPath=absolute(process.argv[3]),read=await readStock033FileV2(configPath,1048576,ledger);const result=await runOwner({config:{path:configPath,fact:read.fact}},ledger,process.argv[2].startsWith('--config-request-window-scroll-')?requestFamily(JSON.parse(read.bytes).fixtureProfile,process.argv[2]==='--config-request-window-scroll-v2'):process.argv[2]==='--config-tail500-wheel-v1'?wheelFamily:process.argv[2]==='--config-tail500-v1');const output=bytes(result,65536,ledger);await new Promise((resolve,reject)=>process.stdout.write(output,error=>error?reject(error):resolve()));}catch{process.exitCode=1;process.stderr.write('native-stock033-preparation-owner-unavailable\n');}
 }else{process.exitCode=1;process.stderr.write('native-stock033-preparation-owner-unavailable\n');}
}

export async function generateStock033PreparationInputsV2WheelCarrierTail500(options){return generateInputs(options,wheelFamily);}
export async function runStock033PreparationOwnerV2WheelCarrierTail500(options){return runOwner(options,undefined,wheelFamily);}
export function createStock033OwnerAuthoredControlV2WheelCarrierTail500(){return ownerAuthoredControl(wheelFamily);}
export function createStock033RequestWindowOwnerAuthoredControlV1(profile){requestFamily(profile);return Object.freeze({...ownerAuthoredControl(requestFamily(profile)),selectOwnerOptions:options=>selectedRequestOwnerOptions(options).options,requestLedger:()=>createStock033RequestWindowPreparationLedgerV1(),transferRequestLedger:input=>createTransferredStock033RequestWindowLedgerV1(input)});}

export function createStock033RequestWindowOwnerAuthoredControlV2(profile){const family=requestFamily(profile,true);return Object.freeze({...ownerAuthoredControl(family),selectOwnerOptions:options=>selectedRequestOwnerOptions(options,true).options,requestLedger:()=>createStock033RequestWindowPreparationLedgerV1(),transferRequestLedger:input=>createTransferredStock033RequestWindowLedgerV1(input),encodeCounterTuple,decodeCounterTuple});}
