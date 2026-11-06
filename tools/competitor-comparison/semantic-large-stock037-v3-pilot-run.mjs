import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {semanticLargeStock037PilotRosterV3 as rosterV3,parseSemanticLargeStock037PilotArgumentsV3 as parseArgumentsV3,admitSemanticLargeStock037PilotV3 as admitV3,summarizeSemanticLargeStock037PilotV3 as summarizeV3,semanticLargeStock037PilotAdvancementV3 as advancementV3} from './semantic-large-stock037-v3-pilot.mjs';
import {FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3 as PROFILES,SEMANTIC_LARGE_FLAGS_V3 as FLAGS,validateSemanticLargeTraceRecordV3,verifySemanticLargeFixtureV3} from './four-profile-stock036-large-v3.mjs';
import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
import {SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';
import {createSemanticLargeStock03716StoreV3} from './matrix-artifacts-trace-v3.mjs';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertStock037BuildV1,stock037PublishedIdentityV1} from './aimock-stock037-v1.mjs';
import {competitorBuildEvidenceV1} from './competitor-build-v1.mjs';

const SOURCE_NAMES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reason=error=>String(error?.message??error).slice(0,2048);
const need=(value,label)=>{if(!value)throw Error('semantic-large-'+label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const metadata=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs&&a.nlink===b.nlink;
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function keys(value,expected){
 need(value&&typeof value==='object'&&!types.isProxy(value)&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype,'own-data');
 const names=Reflect.ownKeys(value);need(names.length===expected.length&&expected.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')&&d.enumerable;}),'keys');
}
// Bound own JSON data before stringify/copy; no getter/proxy/cycle normalization.
function boundedJSON(value,cap){
 let bytes=0;const seen=new Set(),add=n=>{bytes+=n;need(bytes<=cap,'bound');};
 function visit(v){
  if(v===null){add(4);return;}if(typeof v==='boolean'){add(v?4:5);return;}if(typeof v==='number'){need(Number.isFinite(v),'own-data');add(String(v).length);return;}if(typeof v==='string'){need(v.length<=cap,'bound');add(Buffer.byteLength(JSON.stringify(v)));return;}
  need(v&&typeof v==='object'&&!types.isProxy(v)&&!seen.has(v),'own-data');const array=Array.isArray(v);need(array?Object.getPrototypeOf(v)===Array.prototype:Object.getPrototypeOf(v)===Object.prototype,'own-data');seen.add(v);const names=Reflect.ownKeys(v);need(names.every(k=>typeof k==='string'),'own-data');add(2);let count=0;
  if(array){const length=Object.getOwnPropertyDescriptor(v,'length').value;need(length<=cap&&names.length===length+1,'own-data');for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);visit(d.value);}}
  else for(const key of names){const d=Object.getOwnPropertyDescriptor(v,key);need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);add(Buffer.byteLength(JSON.stringify(key))+1);visit(d.value);}
  seen.delete(v);
 }visit(value);return bytes;
}
function detach(value,cap){boundedJSON(value,cap);return freeze(JSON.parse(JSON.stringify(value)));}
function reference(ref,id,name,cap,value){
 keys(ref,['path','bytes','sha256']);need(ref.path===id+'/'+name&&Number.isSafeInteger(ref.bytes)&&ref.bytes>0&&ref.bytes<=cap&&typeof ref.sha256==='string'&&/^[0-9a-f]{64}$/.test(ref.sha256),'reference');
 if(value!==undefined){boundedJSON(value,cap);const text=JSON.stringify(value);need(Buffer.byteLength(text)===ref.bytes&&sha(text)===ref.sha256,'readback');}
}

/** Each attention observes its exact retained original through an absolute end. */
function ownership(invocationEnd,invocationCleanupEnd){
 const records=[],descriptors=new Set();let store=null,unsafe=false;
 const now=()=>performance.now();
 const storeUnknown=()=>{if(!store)return false;const s=store.stats();return !!(s.pendingOriginals||s.pendingWriters||s.unsafeWriter);};
 const unknown=()=>unsafe||descriptors.size>0||records.some(r=>r.status==='pending'||r.status==='rejected'&&r.error?.unsafeOutstanding===true)||storeUnknown();
 function gate(end,terminal=false){need(now()<end,'deadline');need(!unsafe&&!records.some(r=>r.status==='pending'||r.status==='rejected'&&r.error?.unsafeOutstanding===true)&&!storeUnknown(),'ownership');if(!terminal&&store)need(!store.stats().stopped,'store-stopped');}
 function retain(original,dispatched=now()){const record={original,status:'pending',value:null,error:null,dispatched,settled:null};records.push(record);original.then(value=>{record.status='fulfilled';record.value=value;record.settled=now();},error=>{record.status='rejected';record.error=error;record.settled=now();if(error?.unsafeOutstanding===true)unsafe=true;});return record;}
 // Settled operation payloads are consumed immediately. Keep pending originals
 // intact, and keep unsafe-bearing rejected originals as immutable stop facts.
 function release(record){if(record.status!=='pending'&&record.error?.unsafeOutstanding!==true){record.original=null;record.value=null;}}
 async function attend(record,end){let timer;try{const value=await Promise.race([record.original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('semantic-large-attention-expired')),Math.max(0,end-now()));})]);need(now()<end,'deadline');return value;}finally{clearTimeout(timer);}}
 async function operation(end,factory,terminal=false){gate(end,terminal);const dispatched=now(),record=retain(Promise.resolve(factory()),dispatched);try{const value=await attend(record,end);gate(end,terminal);return value;}finally{if(record.status==='pending')record.original.then(()=>release(record),()=>release(record));else release(record);}}
 async function observe(end){
  if(unsafe)return false;
  for(let i=0;i<records.length;i++){const record=records[i];if(record.status==='pending'&&now()<end){try{await attend(record,end);}catch{}}}
  if(unknown())unsafe=true;return !unsafe;
 }
 async function sourceFact(name,end,observationEnd,prior=null){
  const run=fn=>operation(end,fn),resolved=await run(()=>fs.realpath(name)),before=await run(()=>fs.lstat(resolved,{bigint:true}));need(before.isFile()&&!before.isSymbolicLink(),'source-file');let handle,after,abandoned=false,closeRecord=null;
  function close(){if(closeRecord)return closeRecord;if(!handle)return null;if(now()>=observationEnd){unsafe=true;return null;}const dispatched=now();closeRecord=retain(Promise.resolve(handle.close()),dispatched);closeRecord.original.then(()=>{descriptors.delete(handle);release(closeRecord);},()=>{});return closeRecord;}
  const hasher=createHash('sha256');
  try{
   gate(end);const dispatched=now(),opening=retain(fs.open(resolved,constants.O_RDONLY|constants.O_NOFOLLOW),dispatched);
   opening.original.then(opened=>{handle=opened;descriptors.add(opened);release(opening);if(abandoned)close();},()=>{});
   handle=await attend(opening,end);gate(end);
   need(metadata(before,await run(()=>handle.stat({bigint:true}))),'source-identity');
   const buffer=Buffer.alloc(65536);let position=0;
   while(true){const {bytesRead}=await run(()=>handle.read(buffer,0,buffer.length,position));need(Number.isSafeInteger(bytesRead)&&bytesRead>=0&&bytesRead<=buffer.length,'source-read');if(!bytesRead)break;hasher.update(buffer.subarray(0,bytesRead));position+=bytesRead;}
   after=await run(()=>handle.stat({bigint:true}));need(metadata(before,after),'source-identity');
  }finally{abandoned=true;const closing=close();if(closing)await attend(closing,Math.min(end,observationEnd));}
  need(await run(()=>fs.realpath(name))===resolved&&metadata(after,await run(()=>fs.lstat(resolved,{bigint:true}))),'source-name');
  const fact={name,resolved,stat:after,sha256:hasher.digest('hex')};if(prior)need(fact.resolved===prior.resolved&&fact.sha256===prior.sha256&&metadata(fact.stat,prior.stat),'source-changed');return fact;
 }
 async function sources(prior=null){
  gate(invocationEnd);need(['darwin','linux'].includes(process.platform),'platform');const phaseStarted=now(),end=Math.min(phaseStarted+10000,invocationEnd),observationEnd=Math.min(end+LIMITS.cleanupMs,invocationCleanupEnd),facts=[];
  const names=[process.execPath,...SOURCE_NAMES.map(name=>fileURLToPath(new URL('./'+name,import.meta.url))),process.platform==='darwin'?'/bin/ps':'/usr/bin/ps'];
  try{for(let i=0;i<names.length;i++)facts.push(await sourceFact(names[i],end,observationEnd,prior?.[i]));return facts;}
  catch(error){await observe(observationEnd);throw error;}
 }
 return {records,descriptors,now,gate,retain,release,attend,operation,observe,sources,unknown,setStore:value=>{store=value;},markUnsafe:()=>{unsafe=true;}};
}

export async function runSemanticLargeStock037PilotInvocationV3(args){
 stock037PublishedIdentityV1();need(arguments.length===1,'arguments');const {out}=parseArgumentsV3(args);
 const invocationStarted=performance.now(),invocationEnd=invocationStarted+LIMITS.invocationMs,invocationCleanupEnd=invocationEnd+LIMITS.cleanupMs;
 const own=ownership(invocationEnd,invocationCleanupEnd),roster=rosterV3(),context={decoderSources:null,rssExecutableSha256:null,cases:Object.fromEntries(roster.map(slot=>[slot.id,null]))};
 // Maximum serialized retained records: count*(65536+1048576+2097152),
 // about147MiB for48, plus small context/reference overhead; not a heap ceiling.
 let store=null,stock,competitor,sourceBefore=null,initialized=false,stopReason=null;
 const builds={},buildHashes={},buildBookends=PROFILES.map(profile=>({profile,status:'unavailable'}));let sourceBookends={status:'unavailable'};
 const phaseEnd=()=>Math.min(own.now()+10000,invocationEnd);
 async function buildsAt(end){const found={};for(const profile of PROFILES){const raw=profile==='threadplane'?assertStock037BuildV1(await own.operation(end,()=>threadplaneBuildEvidence())):await own.operation(end,()=>competitorBuildEvidenceV1(profile));own.gate(end);boundedJSON(raw,P.storage.initialManifestReserveBytes);found[profile]={raw:detach(raw,P.storage.initialManifestReserveBytes),sha256:sha(JSON.stringify(raw))};}return found;}
 function sourceContext(facts){return {decoderSources:{nodeExecutableSha256:facts[0].sha256,files:SOURCE_NAMES.map((name,i)=>({path:'tools/competitor-comparison/'+name,sha256:facts[i+1].sha256}))},rssExecutableSha256:facts[8].sha256};}
 const manifest={schema:'semantic-large-stock037-pilot-invocation-v3',purpose:'instrumented-diagnostic-four-profile-history-growth',captureProfile:P.captureProfile,policySha256:POLICY_SHA,instrumentationCategories:P.config.traceConfig.includedCategories,fixtureProtocol:'aimock-matrix-v3',builds,roster,policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},...FLAGS};
 try{
  sourceBefore=await own.sources();Object.assign(context,sourceContext(sourceBefore));
  let end=phaseEnd();stock=await own.operation(end,()=>import('./matrix-case-stock037-trace-v3.mjs'));competitor=await own.operation(end,()=>import('./matrix-case-competitor-trace-v3.mjs'));
  const originalStore=own.retain(createSemanticLargeStock03716StoreV3({directory:out,invocationStarted}));
  originalStore.original.then(value=>{store=value;own.setStore(value);own.release(originalStore);},()=>{});
  store=await own.attend(originalStore,end);own.setStore(store);own.gate(end);own.release(originalStore);
  const found=await buildsAt(phaseEnd());for(const profile of PROFILES){buildHashes[profile]=found[profile].sha256;builds[profile]={sourceFlavor:profile==='threadplane'?'registry-stock037':'published-competitor-v1',...found[profile]};}
  end=phaseEnd();const initial={...manifest,status:'planned'};boundedJSON(initial,P.storage.initialManifestReserveBytes);await own.operation(end,()=>store.writeManifest('manifest-initial.json',initial));initialized=true;
 }catch(error){stopReason=reason(error);await own.observe(invocationCleanupEnd);}
 function unattempted(slot,message){return {id:slot.id,kind:slot.kind,selection:slot.selection,status:'unattempted',reason:message,acquisition:MATRIX_V5_ACQUISITION,...FLAGS};}
 const results=[];
 for(const slot of roster){
  if(!stopReason&&(own.now()>=invocationEnd||own.unknown()||store.stats().stopped))stopReason='semantic-large-invocation-unavailable';
  if(stopReason){results.push(unattempted(slot,stopReason));continue;}
  let native=null,call=null,observationEnd=null,verificationEnd=null,fixture={status:'unavailable',reason:'semantic-large-fixture-unavailable'},qualificationUnsafe=false;
  try{
   const grantEnd=phaseEnd();observationEnd=Math.min(grantEnd+LIMITS.cleanupMs,invocationCleanupEnd);
   await own.operation(grantEnd,()=>store.requireSpaceBeforeNextCaseV3(slot.id));
   own.gate(invocationEnd);const dispatched=own.now();verificationEnd=Math.min(dispatched+LIMITS.caseMs,invocationEnd);observationEnd=verificationEnd+LIMITS.cleanupMs;
   const engine=slot.selection.profile==='threadplane'?stock:competitor;
   call=own.retain(Promise.resolve(engine.runMatrixCase({slot,store,out,invocationStarted})),dispatched);
   const returned=await own.attend(call,observationEnd);boundedJSON(returned,P.storage.kinds.result);need(returned&&typeof returned==='object'&&!Array.isArray(returned),'native-record');native=returned;
   if(native.unsafeOutstanding===true)own.markUnsafe();
   need(!own.unknown(),'native-ownership');need(native.stopInvocation!==true&&!Object.hasOwn(native,'publicationUnavailable'),'native-publication');own.gate(verificationEnd);
   const end=Math.min(own.now()+10000,verificationEnd),diagnostic=native.traceDiagnostic,identity={id:slot.id,...slot.selection,stockVersion:slot.selection.profile==='threadplane'?'0.3.7':null,buildSha256:buildHashes[slot.selection.profile]},sourceFacts={decoderSources:context.decoderSources,rssExecutableSha256:context.rssExecutableSha256};
   need(diagnostic?.status==='complete','trace-unavailable');
   reference(diagnostic.rawCapture,slot.id,'aimock-trace-v3-private.json',P.capture.wrapperBytes);
   let raw=await own.operation(end,()=>store.readJSON(diagnostic.rawCapture,{kind:'trace-v3'}));
   boundedJSON(raw,P.capture.wrapperBytes);keys(raw,['schema','captureProfile','policySha256','identity','traceFormat','compression','payloadEncoding','payloadBase64','receipt','retainedCompressedBytes','compressedSha256',...Object.keys(FLAGS)]);
   reference(diagnostic.rawCapture,slot.id,'aimock-trace-v3-private.json',P.capture.wrapperBytes,raw);
   need(raw.schema===P.schemas.raw&&raw.captureProfile===P.captureProfile&&raw.policySha256===POLICY_SHA&&same(raw.identity,identity)&&raw.traceFormat==='json'&&raw.compression==='gzip'&&raw.payloadEncoding==='base64'&&Object.keys(FLAGS).every(k=>raw[k]===FLAGS[k]),'raw-identity');
   need(typeof raw.payloadBase64==='string'&&raw.payloadBase64.length<=P.capture.base64Characters,'raw-payload');let compressed=Buffer.from(raw.payloadBase64,'base64');
   need(compressed.toString('base64')===raw.payloadBase64&&compressed.length>0&&compressed.length<=P.capture.compressedBytes&&compressed.length===raw.retainedCompressedBytes&&sha(compressed)===raw.compressedSha256,'raw-payload');
   const header={};for(const key of Object.keys(raw))if(key!=='payloadBase64')header[key]=raw[key];boundedJSON(raw.receipt,P.capture.receiptBytes);need(boundedJSON(header,P.capture.wrapperOverheadBytes)+19<=P.capture.wrapperOverheadBytes,'raw-overhead');
   const rawRecord={reference:detach(diagnostic.rawCapture,1024),value:detach(header,P.capture.wrapperOverheadBytes)};raw=null;compressed=null;
   reference(diagnostic.decoderOriginals,slot.id,'aimock-trace-v3-decoder-originals.json',P.decoder.originalsBytes);
   const originals=await own.operation(end,()=>store.readJSON(diagnostic.decoderOriginals,{kind:'evidence'}));reference(diagnostic.decoderOriginals,slot.id,'aimock-trace-v3-decoder-originals.json',P.decoder.originalsBytes,originals);
   reference(diagnostic.validation,slot.id,'aimock-trace-v3-validation.json',P.storage.kinds.evidence);
   const validation=await own.operation(end,()=>store.readJSON(diagnostic.validation,{kind:'evidence'}));reference(diagnostic.validation,slot.id,'aimock-trace-v3-validation.json',P.storage.kinds.evidence,validation);
   const record={raw:rawRecord,originals:{reference:diagnostic.decoderOriginals,value:originals},validation:{reference:diagnostic.validation,value:validation}};
   // The shared closed-schema predicate sees actual bounded readbacks before
   // copying, so unknown fields cannot be normalized into a qualified record.
   need(validateSemanticLargeTraceRecordV3(record,identity,sourceFacts),'trace-join');own.gate(end);
   const detachedRecord=freeze({raw:rawRecord,originals:{reference:detach(diagnostic.decoderOriginals,1024),value:detach(originals,P.decoder.originalsBytes)},validation:{reference:detach(diagnostic.validation,1024),value:detach(validation,P.storage.kinds.evidence)}});
   own.gate(end);context.cases[slot.id]=detachedRecord;
   reference(native.fixture,slot.id,'fixture-private.json',P.storage.kinds['private-case']);
   let source=await own.operation(end,()=>store.readJSON(native.fixture,{kind:'private-case'}));
   fixture=await own.operation(end,()=>verifySemanticLargeFixtureV3(source,native,slot));source=null;
   keys(fixture,['status','sourceSha256','historySha256','responseSha256','sourceDeltaSha256']);need(fixture.status==='verified-canonical'&&['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'].every(k=>typeof fixture[k]==='string'&&/^[0-9a-f]{64}$/.test(fixture[k]))&&['sourceSha256','historySha256','responseSha256'].every(k=>fixture[k]===native.fixtureDigests?.[k]),'fixture-join');fixture=detach(fixture,1024);own.gate(end);
  }catch(error){
   stopReason=reason(error);const closureEnd=observationEnd??invocationCleanupEnd;await own.observe(closureEnd);
   // Even a late engine fulfillment is inspected for immutable unsafe facts;
   // it never restores availability or starts verification.
   if(!native&&call?.status==='fulfilled')try{boundedJSON(call.value,P.storage.kinds.result);need(call.value&&typeof call.value==='object'&&!Array.isArray(call.value),'native-record');native=call.value;}catch{}
   if(native?.unsafeOutstanding===true)own.markUnsafe();
   qualificationUnsafe=own.unknown();fixture={status:'unavailable',reason:reason(error)};
  }
  if(!call){results.push(unattempted(slot,stopReason??'semantic-large-grant-refused'));continue;}
  if(!native)native={id:slot.id,kind:slot.kind,...slot.selection,status:'invalid',failure:{message:stopReason},acquisition:MATRIX_V5_ACQUISITION,...FLAGS};
  const attempt=freeze({schema:'semantic-large-stock037-pilot-attempt-v3',parentId:slot.parentId,round:slot.round,stratum:slot.stratum,block:slot.block,position:slot.position,sourceFlavor:slot.sourceFlavor,buildSha256:buildHashes[slot.selection.profile],fixture,originalCall:{clock:'controller-monotonic',dispatched:call.dispatched,settled:call.settled},qualificationUnsafe,...FLAGS});
  results.push({...native,semanticLargeAttempt:attempt});own.release(call);
 }
 if(initialized&&!own.unknown()&&own.now()<invocationEnd){
  try{const after=await buildsAt(phaseEnd());for(let i=0;i<PROFILES.length;i++){const profile=PROFILES[i];buildBookends[i]={profile,status:after[profile].sha256===buildHashes[profile]&&same(after[profile].raw,builds[profile].raw)?'unchanged':'changed',sha256:after[profile].sha256};}
   await own.sources(sourceBefore);sourceBookends={status:'unchanged'};
  }catch(error){stopReason??=reason(error);await own.observe(invocationCleanupEnd);}
 }
 const unsafeOutstanding=own.unknown(),bookendsComplete=initialized&&buildBookends.every(b=>b.status==='unchanged')&&sourceBookends.status==='unchanged';
 const summary=summarizeV3(results,buildHashes,context),complete=bookendsComplete&&!unsafeOutstanding&&!stopReason&&admitV3(results,buildHashes,context);
 const eligibility=advancementV3(results,buildHashes,context),advancement=freeze({pilotComplete:complete&&eligibility.pilotComplete,boundedDiagnosticAdvancementEligible:bookendsComplete&&!unsafeOutstanding&&!stopReason&&eligibility.boundedDiagnosticAdvancementEligible,...FLAGS});
 const final={...manifest,results,stopReason,buildBookends,sourceBookends,summary,complete,status:complete?'complete':'incomplete',unsafeOutstanding,stopInvocation:!!stopReason||unsafeOutstanding||!bookendsComplete,storage:store?.stats()??null,advancement};
 function diagnostic(error,publicationAttempted){return detach({schema:'semantic-large-stock037-pilot-terminal-failure-v3',failure:reason(error),complete:false,status:'incomplete',unsafeOutstanding:own.unknown(),stopInvocation:true,publication:{attempted:publicationAttempted,status:'unavailable'},counts:{planned:roster.length,attempted:results.filter(r=>r.status!=='unattempted').length,unattempted:results.filter(r=>r.status==='unattempted').length,nativePass:summary.profiles.reduce((total,profile)=>total+profile.nativePass,0)},attempts:results.map(r=>({id:r.id,status:r.status,reason:r.reason??r.failure?.message??null,trace:r.traceDiagnostic?.status??'unavailable',unsafeOutstanding:r.unsafeOutstanding===true,stopInvocation:r.stopInvocation===true,qualificationUnsafe:r.semanticLargeAttempt?.qualificationUnsafe===true})),buildBookends,sourceBookends,summary,...FLAGS},P.storage.invocationFailureReserveBytes);}
 let publicationAttempted=false;
 try{
  need(store&&!unsafeOutstanding,'terminal-ownership');const end=Math.min(own.now()+STAGES.progress,invocationCleanupEnd);boundedJSON(final,P.storage.finalManifestReserveBytes);
  await own.operation(end,()=>{publicationAttempted=true;return store.writeManifest('manifest-final.json',final);},true);
  need(!own.unknown(),'terminal-ownership');return freeze(final);
 }catch(error){
  await own.observe(invocationCleanupEnd);const failure=error instanceof Error?error:Error(reason(error));failure.diagnostic=diagnostic(error,publicationAttempted);failure.unsafeOutstanding=failure.diagnostic.unsafeOutstanding;
  // A stopped store can still charge its once-only failure surface. Unknown
  // ownership cannot write a manifest or invocation-failure sidecar.
  if(store&&!own.unknown()&&own.now()<invocationCleanupEnd){try{await own.operation(Math.min(own.now()+STAGES.progress,invocationCleanupEnd),()=>store.writeInvocationFailureV3(failure.diagnostic),true);}catch{await own.observe(invocationCleanupEnd);failure.diagnostic=diagnostic(error,publicationAttempted);failure.unsafeOutstanding=failure.diagnostic.unsafeOutstanding;}}
  throw failure;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runSemanticLargeStock037PilotInvocationV3(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,complete:value.complete,status:value.status,summary:value.summary,advancement:value.advancement,...FLAGS}));if(!value.complete)process.exitCode=1;},error=>{console.error(JSON.stringify(error.diagnostic??{schema:'semantic-large-stock037-pilot-terminal-failure-v3',failure:reason(error),unsafeOutstanding:error?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
