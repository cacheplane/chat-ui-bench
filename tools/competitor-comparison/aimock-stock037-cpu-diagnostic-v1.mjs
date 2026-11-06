// One owned diagnostic. Concurrent timeline data is never a baseline observation.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {parseFourProfileStock036LargeArgumentsV3,validateSemanticLargeTraceRecordV3,verifySemanticLargeFixtureV3,SEMANTIC_LARGE_FLAGS_V3 as FLAGS} from './four-profile-stock036-large-v3.mjs';
import {SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';
import {createStock037CpuDiagnosticStoreV1} from './matrix-artifacts-trace-v3.mjs';
import {collectMatrixProvenance} from './matrix-run-v5.mjs';
import {MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
import {admitMatrixCase} from './matrix-admission-v5.mjs';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {stock037PublishedIdentityV1,assertStock037BuildV1} from './aimock-stock037-v1.mjs';
import {analyzeChrome156CpuProfileV2,CPU_PROFILE_V2_LIMITS} from './aimock-cpu-profile-v2.mjs';

const ID='threadplane-h10000-r6400-follow-stock037-cpu-samples-v1';
const SELECTION=Object.freeze({profile:'threadplane',historyCount:10000,responseBytes:6400,journey:'follow'});
const SLOT=Object.freeze({id:ID,kind:'positive',selection:SELECTION});
const SOURCE_NAMES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
const REQUIRED_SOURCES=['process.mjs','serve.mjs','server.mjs','aimock-stock037-cpu-diagnostic-v1.mjs','aimock-stock037-cpu-capture-v1.mjs','matrix-case-stock037-trace-v3.mjs','matrix-artifacts-trace-v3.mjs','aimock-cpu-profile-v2.mjs'];
const CPU_KINDS=['session','version','frame','target','enable','interval','start','stop','disable','detach','finish'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(v,label)=>{if(!v)throw Error('stock037-cpu-diagnostic-'+label);};
const reason=error=>String(error?.message??error).slice(0,2048);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const metadata=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs&&a.nlink===b.nlink;
function keys(value,expected){need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===expected.length&&expected.every(k=>Object.hasOwn(value,k)),'closed-schema');}
function bounded(value,cap){const text=JSON.stringify(value);need(typeof text==='string'&&Buffer.byteLength(text)<=cap,'byte-cap');return text;}
function reference(ref,name,cap,value){
 need(ref&&Object.keys(ref).length===3&&ref.path===ID+'/'+name&&Number.isSafeInteger(ref.bytes)&&ref.bytes>0&&ref.bytes<=cap&&digest(ref.sha256),'reference');
 if(value!==undefined){const text=bounded(value,cap);need(Buffer.byteLength(text)===ref.bytes&&sha(text)===ref.sha256,'canonical-readback');return text;}
}

// Preserve the returned attempt's refusal facts without copying raw payloads or
// treating unverified references as acquisition evidence.
function projectNativeAttempt(native){
 if(!native||typeof native!=='object')return null;
 const text=value=>typeof value==='string'?value.slice(0,256):null;
 const failure=value=>value==null?null:typeof value==='object'?{message:reason(value.message??value)}:reason(value);
 function ref(value,name,cap){try{reference(value,name,cap);return{path:value.path,bytes:value.bytes,sha256:value.sha256};}catch{return null;}}
 const trace=native.traceDiagnostic,cpu=native.cpuDiagnostic;
 const projection={id:text(native.id),status:text(native.status),failure:failure(native.failure),stopInvocation:typeof native.stopInvocation==='boolean'?native.stopInvocation:null,unsafeOutstanding:typeof native.unsafeOutstanding==='boolean'?native.unsafeOutstanding:null,referencesVerified:false,
  traceDiagnostic:trace?{status:text(trace.status),failure:failure(trace.failure),rawCapture:ref(trace.rawCapture,'aimock-trace-v3-private.json',P.capture.wrapperBytes),decoderOriginals:ref(trace.decoderOriginals,'aimock-trace-v3-decoder-originals.json',P.decoder.originalsBytes),validation:ref(trace.validation,'aimock-trace-v3-validation.json',P.storage.kinds.evidence)}:null,
  cpuDiagnostic:cpu?{status:text(cpu.status),failure:failure(cpu.failure),rawCapture:ref(cpu.rawCapture,'stock037-cpu-profile-v1.json',CPU_PROFILE_V2_LIMITS.maxProfileBytes),binding:ref(cpu.binding,'stock037-cpu-binding-v1.json',CPU_PROFILE_V2_LIMITS.maxBindingBytes),ownerReceipt:ref(cpu.ownerReceipt,'stock037-cpu-owner-v1.json',16384)}:null};
 bounded(projection,16384);return projection;
}

// A fixed controller owner: attention expiry never releases the actual original.
function ownership(invocationEnd,cleanupEnd){
 const records=[],descriptors=new Set();let store=null,unsafe=false;
 const now=()=>performance.now();
 const unknown=()=>unsafe||descriptors.size>0||records.some(r=>r.status==='pending'||r.error?.unsafeOutstanding===true)||!!(store&&(store.stats().pendingOriginals||store.stats().pendingWriters||store.stats().unsafeWriter));
 function gate(end,terminal=false){need(now()<end,'deadline');need(!unknown(),'ownership');if(!terminal&&store)need(!store.stats().stopped,'store-stopped');}
 function retain(original){const r={original,status:'pending',dispatched:now(),settled:null,error:null};records.push(r);original.then(value=>{r.status='fulfilled';r.value=value;r.settled=now();},error=>{r.status='rejected';r.error=error;r.settled=now();if(error?.unsafeOutstanding===true)unsafe=true;});return r;}
 async function attend(r,end){r.attentionEnd??=end;let timer;try{const value=await Promise.race([r.original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('stock037-cpu-diagnostic-attention-expired')),Math.max(0,end-now()));})]);need(now()<end,'deadline');return value;}finally{clearTimeout(timer);}}
 async function operation(end,factory,terminal=false){gate(end,terminal);const r=retain(Promise.resolve(factory()));const value=await attend(r,end);gate(end,terminal);return value;}
 async function observe(end){if(unsafe)return false;for(const r of records)if(r.status==='pending'&&finite(r.attentionEnd))end=Math.min(end,r.attentionEnd+P.timing.cleanupMs);for(const r of records)if(r.status==='pending'&&now()<end)try{await attend(r,end);}catch{}if(unknown())unsafe=true;return !unsafe;}
 // Sources stream through a fixed buffer. Artifact retention additionally has a
 // literal byte cap; descriptor and pathname metadata must agree at both ends.
 async function fileFact(name,end,observationEnd,prior=null,cap=null){
  const run=fn=>operation(end,fn),resolved=await run(()=>fs.realpath(name));need(resolved===name,'file-realpath');
  const before=await run(()=>fs.lstat(name,{bigint:true}));need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n,'file-type');if(cap!==null)need(before.size>0n&&before.size<=BigInt(cap),'file-cap');
  let handle=null,abandoned=false,closing=null;const chunks=[],hash=createHash('sha256');let length=0;
  function close(){if(closing||!handle)return closing;if(now()>=observationEnd){unsafe=true;return null;}closing=retain(Promise.resolve(handle.close()));closing.original.then(()=>descriptors.delete(handle),()=>{unsafe=true;});return closing;}
  let after;
  try{
   gate(end);const opening=retain(fs.open(name,constants.O_RDONLY|constants.O_NOFOLLOW));
   opening.original.then(value=>{handle=value;descriptors.add(value);if(abandoned)close();},()=>{});
   handle=await attend(opening,end);need(!unsafe&&now()<end,'file-open');
   // The held descriptor is intentional ownership during its bounded operations.
   const heldRun=async factory=>{need(now()<end&&!unsafe,'deadline');const r=retain(Promise.resolve(factory()));return attend(r,end);};
   need(metadata(before,await heldRun(()=>handle.stat({bigint:true}))),'file-identity');
   const buffer=Buffer.alloc(65536);
   while(true){const {bytesRead}=await heldRun(()=>handle.read(buffer,0,cap===null?buffer.length:Math.min(buffer.length,cap+1-length),length));need(Number.isSafeInteger(bytesRead)&&bytesRead>=0&&bytesRead<=buffer.length,'file-read');if(bytesRead===0)break;length+=bytesRead;need(cap===null||length<=cap,'file-cap');hash.update(buffer.subarray(0,bytesRead));if(cap!==null)chunks.push(Buffer.from(buffer.subarray(0,bytesRead)));}
   after=await heldRun(()=>handle.stat({bigint:true}));need(metadata(before,after)&&BigInt(length)===after.size,'file-drift');
  }finally{abandoned=true;const c=close();if(c)await attend(c,Math.min(end,observationEnd));}
  need(await run(()=>fs.realpath(name))===resolved&&metadata(after,await run(()=>fs.lstat(name,{bigint:true}))),'file-name');
  const fact={name,resolved,stat:after,sha256:hash.digest('hex'),bytes:length};if(prior)need(fact.resolved===prior.resolved&&fact.sha256===prior.sha256&&metadata(fact.stat,prior.stat),'source-changed');
  return cap===null?fact:{...fact,data:Buffer.concat(chunks)};
 }
 async function sources(prior=null){
  gate(invocationEnd);need(['darwin','linux'].includes(process.platform),'platform');const end=Math.min(now()+10000,invocationEnd),observationEnd=Math.min(end+P.timing.cleanupMs,cleanupEnd);
  const names=[process.execPath,...SOURCE_NAMES.map(name=>fileURLToPath(new URL('./'+name,import.meta.url))),process.platform==='darwin'?'/bin/ps':'/usr/bin/ps'],facts=[];
  try{for(let i=0;i<names.length;i++)facts.push(await fileFact(names[i],end,observationEnd,prior?.[i]));return facts;}catch(error){await observe(observationEnd);throw error;}
 }
 return{now,gate,retain,attend,operation,observe,fileFact,sources,unknown,setStore(value){store=value;},markUnsafe(){unsafe=true;}};
}

function cpuReceipt(receipt,identity,rawRef,bindingRef,binding,traceInventory,browserVersion){
 keys(receipt,['schema','identity','nodeClock','setupClock','startClock','finishClock','sealedMs','publicAckMs','inventory','samplingIntervalUs','captureLimitMs','watchdog','owners','issues','raw','binding','complete','unsafeOutstanding','resourceScope','limits',...Object.keys(FLAGS)]);
 keys(receipt.identity,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256']);
 keys(receipt.setupClock,['startedMs','deadlineMs']);keys(receipt.startClock,['dispatchedMs','captureDeadlineMs']);keys(receipt.finishClock,['startedMs','attentionBudgetMs']);keys(receipt.watchdog,['scheduled','deadlineMs','expired','cancelled']);keys(receipt.limits,['rawBytes','bindingBytes','receiptBytes']);keys(receipt.raw,['bytes','sha256']);keys(receipt.binding,['bytes','sha256']);
 keys(receipt.inventory,['browserVersion','browserProduct','chromiumRevision','versionReply','mainFrameId','targetId','url','expectedOrigin','pageCount']);
 need(receipt?.schema==='stock037-cpu-capture-receipt-v1'&&same(receipt.identity,identity)&&receipt.complete===true&&receipt.unsafeOutstanding===false&&Array.isArray(receipt.issues)&&receipt.issues.length===0,'cpu-owner');
 need(Object.keys(FLAGS).every(k=>receipt[k]===FLAGS[k])&&receipt.nodeClock==='node-performance-relative-to-case-start'&&receipt.samplingIntervalUs===10000&&receipt.captureLimitMs===30000,'cpu-config');
 need(same(receipt.raw,{bytes:rawRef.bytes,sha256:rawRef.sha256})&&same(receipt.binding,{bytes:bindingRef.bytes,sha256:bindingRef.sha256}),'cpu-custody');
 need(same(receipt.limits,{rawBytes:2097152,bindingBytes:65536,receiptBytes:16384}),'cpu-limits');
 need(Array.isArray(receipt.owners)&&receipt.owners.length===CPU_KINDS.length&&CPU_KINDS.every(kind=>receipt.owners.filter(o=>o.kind===kind).length===1),'cpu-originals');
 for(const o of receipt.owners){keys(o,['kind','status','dispatchedMs','settledMs','attentionStatus','attentionDeadlineMs','attentionSettledMs','error']);need(o.status==='fulfilled'&&o.attentionStatus==='fulfilled'&&o.error===null&&[o.dispatchedMs,o.settledMs,o.attentionDeadlineMs,o.attentionSettledMs].every(finite)&&o.dispatchedMs<=o.settledMs&&o.settledMs<=o.attentionSettledMs&&o.attentionSettledMs<o.attentionDeadlineMs&&o.attentionSettledMs<=receipt.sealedMs,'cpu-original-clock');}
 need(receipt.setupClock&&[receipt.setupClock.startedMs,receipt.setupClock.deadlineMs].every(finite)&&receipt.setupClock.startedMs<receipt.setupClock.deadlineMs&&receipt.setupClock.deadlineMs-receipt.setupClock.startedMs<=10000,'cpu-setup-clock');
 need(receipt.finishClock&&[receipt.finishClock.startedMs,receipt.finishClock.attentionBudgetMs].every(finite)&&receipt.finishClock.attentionBudgetMs>0&&receipt.finishClock.attentionBudgetMs<=10000,'cpu-finish-clock');
 const start=receipt.owners.find(o=>o.kind==='start'),stop=receipt.owners.find(o=>o.kind==='stop');
 need(finite(receipt.publicAckMs)&&finite(receipt.sealedMs)&&finite(receipt.startClock?.dispatchedMs)&&finite(receipt.startClock?.captureDeadlineMs)&&start.dispatchedMs<=receipt.startClock.dispatchedMs&&receipt.startClock.dispatchedMs<=start.settledMs&&start.attentionSettledMs<=receipt.publicAckMs&&receipt.publicAckMs<=stop.dispatchedMs&&receipt.finishClock.startedMs<=stop.dispatchedMs&&stop.dispatchedMs<receipt.startClock.captureDeadlineMs&&stop.settledMs<receipt.startClock.captureDeadlineMs&&receipt.startClock.captureDeadlineMs-receipt.startClock.dispatchedMs<=30000&&receipt.publicAckMs<receipt.setupClock.deadlineMs,'cpu-capture-clock');
 need(receipt.watchdog?.scheduled===true&&receipt.watchdog.expired===false&&receipt.watchdog.cancelled===true&&receipt.watchdog.deadlineMs===receipt.startClock.captureDeadlineMs,'cpu-watchdog');
 const inv=receipt.inventory;need(inv&&inv.pageCount===1&&inv.browserVersion==='156.0.8078.4'&&inv.browserVersion===browserVersion&&inv.chromiumRevision==='f842f52ef39fd97b449eb27cff414bf05a98ddce'&&['Chrome/','HeadlessChrome/'].some(prefix=>inv.browserProduct===prefix+inv.browserVersion)&&inv.versionReply?.product===inv.browserProduct&&inv.versionReply.revision?.replace(/^@/,'')===inv.chromiumRevision,'cpu-browser');
 need(binding.browserVersion===inv.browserVersion&&binding.chromiumRevision===inv.chromiumRevision&&binding.origin===inv.expectedOrigin&&inv.url===inv.expectedOrigin+'/'&&traceInventory?.oneOwnedPage===true&&inv.mainFrameId===traceInventory.mainFrameId&&inv.targetId===traceInventory.targetId,'cpu-inventory');
 for(const [key,text]of [['documentURL',inv.url],['origin',inv.expectedOrigin],['browserVersion',inv.browserVersion]]){const fact=traceInventory[key];need(fact&&fact.truncated===false&&fact.text===text&&fact.trueCharacters===text.length&&(!Object.hasOwn(fact,'sha256')||fact.sha256===sha(text)),'cpu-trace-inventory');}
}

function servedAssets(profile,binding,build,provenance,evidence,server){
 need(same(binding.assetHashes,build.assetHashes),'binding-assets');
 need(same(evidence.server,server.report)&&server.report?.schema===2&&server.report.protocol==='matrix-v3'&&server.report.profile==='threadplane'&&server.report.closed===true&&Array.isArray(server.report.errors)&&server.report.errors.length===0,'server-report');
 need(Number.isSafeInteger(server.pid)&&server.pid>0&&server.exit?.code===0&&server.exit.signal===null&&server.close?.code===0&&server.close.signal===null&&server.disconnected===true&&server.protocolError===null,'server-originals');
 for(const name of ['stdout','stderr'])need(server.streams?.[name]?.end===true&&server.streams[name].closed===true&&Number.isSafeInteger(server.streams[name].bytes)&&server.streams[name].bytes>=0&&server.streams[name].bytes<=262144&&typeof server[name]==='string'&&Buffer.byteLength(server[name])===server.streams[name].bytes,'server-pipes');
 const paths=new Set(profile.nodes.flatMap(n=>n.callFrame.url===''?[]:[new URL(n.callFrame.url).pathname.slice(1)]));
 for(const key of paths){const asset=provenance.assets.find(row=>row.path===key);need(asset&&digest(asset.sha256)&&asset.sha256===binding.assetHashes[key]&&asset.sha256===build.assetHashes[key]&&evidence.network.finished.includes('/'+key),'served-asset');
  const requests=server.report.requests.filter(row=>row.method==='GET'&&row.path==='/'+key);need(requests.length>0&&requests.every(row=>row.status===200&&row.responseBytes===asset.bytes&&row.sourceEof===true&&row.responseFinished===true&&row.responseClosed===true&&row.clientAborted===false&&row.error===null),'served-response');
 }
}

export async function runStock037CpuDiagnosticInvocationV1(args){
 stock037PublishedIdentityV1();need(arguments.length===1,'arguments');const {out}=parseFourProfileStock036LargeArgumentsV3(args);
 const invocationStarted=performance.now(),invocationEnd=invocationStarted+P.timing.invocationMs,cleanupEnd=invocationEnd+P.timing.cleanupMs,own=ownership(invocationEnd,cleanupEnd);
 const phaseEnd=()=>Math.min(own.now()+10000,invocationEnd);
 const gates={native:false,trace:false,cpu:false,data:false};let store=null,native=null,analysis=null,failure=null,sourceBefore=null,provenanceBefore=null,build=null,buildSha256=null,caseCall=null,caseEnd=null,caseObservationEnd=null;
 const refs={},bookends={build:'unavailable',source:'unavailable',provenance:'unavailable'};
 const manifest={schema:'stock037-cpu-diagnostic-invocation-v1',id:ID,selection:SELECTION,purpose:'one-source-bound-sampled-stack-diagnostic',baselineCohortEquivalent:false,resourceScope:'Caps bound retained/analyzed bytes, not Chromium/CDP whole-object transport allocation.',limitations:['CPU profiling perturbs concurrent strict timeline.','Sample counts are not CPU time or display presentation.','Concurrent trace data must not be pooled with the original closed48 baseline.'],...FLAGS};
 async function read(ref,name,kind,cap,end){reference(ref,name,cap);const value=await own.operation(end,()=>store.readJSON(ref,{kind}));reference(ref,name,cap,value);return value;}
 async function observed(name,kind,cap,end){
  const full=path.join(out,ID,name),fact=await own.fileFact(full,end,caseObservationEnd,null,cap),ref={path:ID+'/'+name,bytes:fact.bytes,sha256:fact.sha256};
  const text=new TextDecoder('utf-8',{fatal:true}).decode(fact.data),value=JSON.parse(text);need(bounded(value,cap)===text,'observed-canonical');
  const retained=await read(ref,name,kind,cap,end);need(same(retained,value),'observed-readback');refs[name]=ref;return retained;
 }
 try{
  sourceBefore=await own.sources();
  const sourceFacts={decoderSources:{nodeExecutableSha256:sourceBefore[0].sha256,files:SOURCE_NAMES.map((name,i)=>({path:'tools/competitor-comparison/'+name,sha256:sourceBefore[i+1].sha256}))},rssExecutableSha256:sourceBefore[8].sha256};
  provenanceBefore=await own.operation(phaseEnd(),()=>collectMatrixProvenance('threadplane'));bounded(provenanceBefore,2097152);
  for(const name of REQUIRED_SOURCES)need(provenanceBefore.source.some(row=>row.path==='tools/competitor-comparison/'+name&&digest(row.sha256)),'source-inventory');
  build=assertStock037BuildV1(await own.operation(phaseEnd(),()=>threadplaneBuildEvidence()));buildSha256=sha(bounded(build,1048576));
  const module=await own.operation(phaseEnd(),()=>import('./matrix-case-stock037-trace-v3.mjs'));
  const storeOriginal=own.retain(createStock037CpuDiagnosticStoreV1({directory:out,invocationStarted}));storeOriginal.original.then(value=>{store=value;own.setStore(value);},()=>{});store=await own.attend(storeOriginal,phaseEnd());own.setStore(store);own.gate(invocationEnd);
  await own.operation(phaseEnd(),()=>store.writeManifest('manifest-initial.json',{...manifest,status:'planned',buildSha256}));
  await own.operation(phaseEnd(),()=>store.requireSpaceBeforeNextCaseV3(ID));own.gate(invocationEnd);
  caseEnd=Math.min(own.now()+P.timing.caseMs,invocationEnd);caseObservationEnd=Math.min(caseEnd+P.timing.cleanupMs,cleanupEnd);
  caseCall=own.retain(Promise.resolve(module.runStock037CpuDiagnosticCaseV1({store,out,invocationStarted})));
  native=await own.attend(caseCall,caseObservationEnd);bounded(native,P.storage.kinds.result);if(native?.unsafeOutstanding===true)own.markUnsafe();own.gate(caseEnd);
  need(native?.stopInvocation===false&&!Object.hasOwn(native,'publicationUnavailable'),'case-publication');
  const identity={id:ID,...SELECTION,stockVersion:'0.3.7',buildSha256},end=Math.min(own.now()+10000,caseEnd);
  need(native.schema==='four-stack-matrix-case-v5'&&native.purpose==='functional-conformance-development'&&same(native.acquisition,MATRIX_V5_ACQUISITION)&&native.id===ID&&native.kind==='positive'&&Object.keys(SELECTION).every(k=>native[k]===SELECTION[k])&&native.status==='matrix-pass'&&native.failure===null&&native.unsafeOutstanding===false&&native.performance===false&&native.scoringEligibility===false&&native.FPS===null,'native-result');
  const retainedResult=await observed('result.json','result',P.storage.kinds.result,end);need(!Object.hasOwn(retainedResult,'stopInvocation')&&same({...retainedResult,stopInvocation:false},native),'native-result-readback');
  const evidence=await observed('evidence.json','evidence',P.storage.kinds.evidence,end),server=await observed('server-process.json','evidence',P.storage.kinds.evidence,end);
  need(same(evidence.provenance?.before,provenanceBefore)&&same(evidence.provenance?.after,provenanceBefore),'native-provenance');
  const fixture=await read(native.fixture,'fixture-private.json','private-case',P.storage.kinds['private-case'],end);
  const fixtureFacts=await own.operation(end,()=>verifySemanticLargeFixtureV3(fixture,native,SLOT));need(fixtureFacts.status==='verified-canonical'&&['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'].every(k=>digest(fixtureFacts[k]))&&['sourceSha256','historySha256','responseSha256'].every(k=>fixtureFacts[k]===native.fixtureDigests[k]),'fixture-join');
  const initial=await read(native.transcripts.initial,'transcript-initial.json','transcript',P.storage.kinds.transcript,end),final=await read(native.transcripts.final,'transcript-final.json','transcript',P.storage.kinds.transcript,end);
  const admitted=admitMatrixCase(fixture,evidence,{initial,final});need(same(admitted,native.admission)&&admitted.status==='functional-pass'&&admitted.profile==='threadplane'&&same(admitted.workload,{seed:1,historyCount:10000,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey:'follow'}),'native-admission');gates.native=true;
  const trace=native.traceDiagnostic;need(trace?.status==='complete'&&trace.failure===null,'trace-unavailable');
  const raw=await read(trace.rawCapture,'aimock-trace-v3-private.json','trace-v3',P.capture.wrapperBytes,end);
  need(raw.schema===P.schemas.raw&&raw.captureProfile===P.captureProfile&&raw.policySha256===POLICY_SHA&&same(raw.identity,identity)&&raw.traceFormat==='json'&&raw.compression==='gzip'&&raw.payloadEncoding==='base64'&&Object.keys(FLAGS).every(k=>raw[k]===FLAGS[k]),'trace-header');
  need(typeof raw.payloadBase64==='string'&&raw.payloadBase64.length<=P.capture.base64Characters,'trace-payload');
  const compressed=Buffer.from(raw.payloadBase64,'base64');need(compressed.toString('base64')===raw.payloadBase64&&compressed.length>0&&compressed.length<=P.capture.compressedBytes&&compressed.length===raw.retainedCompressedBytes&&sha(compressed)===raw.compressedSha256,'trace-payload');
  const header={};for(const key of Object.keys(raw))if(key!=='payloadBase64')header[key]=raw[key];bounded(raw.receipt,P.capture.receiptBytes);need(Buffer.byteLength(bounded(header,P.capture.wrapperOverheadBytes))+19<=P.capture.wrapperOverheadBytes,'trace-overhead');
  const originals=await read(trace.decoderOriginals,'aimock-trace-v3-decoder-originals.json','evidence',P.decoder.originalsBytes,end),validation=await read(trace.validation,'aimock-trace-v3-validation.json','evidence',P.storage.kinds.evidence,end);
  need(validateSemanticLargeTraceRecordV3({raw:{reference:trace.rawCapture,value:header},originals:{reference:trace.decoderOriginals,value:originals},validation:{reference:trace.validation,value:validation}},identity,sourceFacts),'trace-validation');gates.trace=true;
  const cpu=native.cpuDiagnostic;need(cpu?.status==='complete'&&cpu.failure===null,'cpu-unavailable');
  const profile=await read(cpu.rawCapture,'stock037-cpu-profile-v1.json','evidence',CPU_PROFILE_V2_LIMITS.maxProfileBytes,end),binding=await read(cpu.binding,'stock037-cpu-binding-v1.json','evidence',CPU_PROFILE_V2_LIMITS.maxBindingBytes,end),owner=await read(cpu.ownerReceipt,'stock037-cpu-owner-v1.json','evidence',16384,end);
  cpuReceipt(owner,identity,cpu.rawCapture,cpu.binding,binding,raw.receipt.inventory,evidence.browser?.version);
  // Analyzer receives the exact hash-joined canonical retained strings.
  const profileJson=reference(cpu.rawCapture,'stock037-cpu-profile-v1.json',CPU_PROFILE_V2_LIMITS.maxProfileBytes,profile),bindingJson=reference(cpu.binding,'stock037-cpu-binding-v1.json',CPU_PROFILE_V2_LIMITS.maxBindingBytes,binding);
  analysis=analyzeChrome156CpuProfileV2(profileJson,bindingJson);bounded(analysis,CPU_PROFILE_V2_LIMITS.maxResultBytes);
  need(analysis.status==='validated-data-only'&&analysis.input.profileSha256===cpu.rawCapture.sha256&&analysis.input.bindingSha256===cpu.binding.sha256&&analysis.input.profileBytes===cpu.rawCapture.bytes,'analysis-join');
  servedAssets(profile,binding,build,provenanceBefore,evidence,server);gates.cpu=true;gates.data=true;
  refs.fixture=native.fixture;refs.transcripts=native.transcripts;refs.trace=trace;refs.cpu=cpu;
  const afterBuild=assertStock037BuildV1(await own.operation(phaseEnd(),()=>threadplaneBuildEvidence()));need(sha(bounded(afterBuild,1048576))===buildSha256&&same(afterBuild,build),'build-bookend');bookends.build='unchanged';
  const afterProvenance=await own.operation(phaseEnd(),()=>collectMatrixProvenance('threadplane'));need(same(afterProvenance,provenanceBefore),'provenance-bookend');bookends.provenance='unchanged';
  await own.sources(sourceBefore);bookends.source='unchanged';own.gate(invocationEnd);
 }catch(error){failure=reason(error);await own.observe(caseObservationEnd??cleanupEnd);if(caseCall?.value?.unsafeOutstanding===true||error?.unsafeOutstanding===true)own.markUnsafe();}
 const complete=!failure&&!own.unknown()&&Object.values(gates).every(Boolean)&&Object.values(bookends).every(v=>v==='unchanged');
 const attempts={planned:1,attempted:caseCall?1:0},originalCall=caseCall?{dispatched:caseCall.dispatched,settled:caseCall.settled,status:caseCall.status}:null,nativeAttempt=projectNativeAttempt(native??caseCall?.value),nativeStatus=nativeAttempt?.status??(caseCall?'unavailable':'unattempted');
 const result={...manifest,status:complete?'complete':'unavailable',complete,gates,bookends,buildSha256,failure,unsafeOutstanding:own.unknown(),attempts,originalCall,nativeAttempt,nativeStatus,references:refs,analysis:complete?analysis:null,storage:store?.stats()??null};
 try{
  need(store&&!own.unknown(),'terminal-ownership');bounded(result,P.storage.finalManifestReserveBytes);
  await own.operation(Math.min(own.now()+10000,cleanupEnd),()=>store.writeManifest('manifest-final.json',result),true);return result;
 }catch(error){
  await own.observe(caseObservationEnd??cleanupEnd);
  const terminal=Error(failure??reason(error));terminal.unsafeOutstanding=own.unknown();terminal.diagnostic={...manifest,status:'unavailable',complete:false,gates,bookends,buildSha256,failure:terminal.message,unsafeOutstanding:terminal.unsafeOutstanding,attempts,originalCall,nativeAttempt,nativeStatus,analysis:null,publication:'unavailable'};
  // Unknown originals/descriptors/writers forbid even a failure sidecar.
  if(store&&!own.unknown()&&own.now()<cleanupEnd)try{await own.operation(Math.min(own.now()+10000,cleanupEnd),()=>store.writeInvocationFailureV3(terminal.diagnostic),true);}catch{await own.observe(caseObservationEnd??cleanupEnd);terminal.unsafeOutstanding=own.unknown();terminal.diagnostic.unsafeOutstanding=terminal.unsafeOutstanding;}
  throw terminal;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runStock037CpuDiagnosticInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,status:value.status,complete:value.complete,gates:value.gates,counts:value.analysis?.counts??null,attempts:value.attempts,originalCall:value.originalCall,nativeAttempt:value.nativeAttempt,failure:value.failure,...FLAGS}));if(!value.complete)process.exitCode=1;},error=>{console.error(JSON.stringify(error.diagnostic??{schema:'stock037-cpu-diagnostic-terminal-failure-v1',failure:reason(error),unsafeOutstanding:error?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
