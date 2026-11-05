import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {fourProfileStock036InterleavedRosterV1,FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1 as PROFILES,parseFourProfileStock036InterleavedArgumentsV1,admitFourProfileStock036InterleavedV1,summarizeFourProfileStock036InterleavedV1,verifyInterleavedFixtureV1,INTERLEAVED_FLAGS_V1 as FLAGS} from './four-profile-stock036-interleaved-v1.mjs';
import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
import {createMatrixDeadline} from './matrix-run-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertStock036BuildV1,stock036PublishedIdentityV1} from './aimock-stock036-v1.mjs';
import {competitorBuildEvidenceV1} from './competitor-build-v1.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const reason=e=>String(e?.message??e).slice(0,2048);
async function defaultReadBuild(profile){return profile==='threadplane'?assertStock036BuildV1(await threadplaneBuildEvidence()):competitorBuildEvidenceV1(profile);}
/** Attention never settles the original. Pending status is captured at refusal. */
async function originalWait(original,wait,ms,label){let pending=true;void original.then(()=>{pending=false;},()=>{pending=false;});try{return await wait(original,ms,label);}catch(error){const e=error instanceof Error?error:Error(label,{cause:error});if(pending)e.unsafeOutstanding=true;throw e;}}
/** CLI has no caller ports. Explicit ports below are pure unit orchestration only. */
export async function runFourProfileStock036InterleavedInvocationV1(args,ports={}){
 stock036PublishedIdentityV1();
 for(const k of Object.keys(ports))if(!['now','loadStockEngine','loadCompetitorEngine','readBuild','createStore'].includes(k))throw Error('interleaved-port');
 const {now=()=>performance.now(),loadStockEngine=()=>import('./matrix-case-stock036-trace-v1.mjs'),loadCompetitorEngine=()=>import('./matrix-case-competitor-trace-v1.mjs'),readBuild=defaultReadBuild,createStore=createMatrixArtifactStore}=ports;
 const {out}=parseFourProfileStock036InterleavedArgumentsV1(args),invocationStarted=now(),deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted,now});
 const stock=await originalWait(loadStockEngine(),deadline.wait,STAGES.progress,'interleaved-stock-modules'),competitor=await originalWait(loadCompetitorEngine(),deadline.wait,STAGES.progress,'interleaved-competitor-modules');
 const store=await originalWait(createStore({directory:out}),deadline.wait,STAGES.progress,'interleaved-directory');
 const builds={},buildHashes={};
 for(const profile of PROFILES){const raw=await originalWait(readBuild(profile),deadline.wait,STAGES.transcript,'interleaved-build-before');buildHashes[profile]=digest(raw);builds[profile]={sourceFlavor:profile==='threadplane'?'registry-stock036':'published-competitor-v1',raw,sha256:buildHashes[profile]};}
 const roster=fourProfileStock036InterleavedRosterV1(),manifest={schema:'four-profile-stock036-interleaved-invocation-v1',purpose:'instrumented-diagnostic-four-profile-history-growth',captureProfile:'semantic-task-layout-v2',instrumentationCategories:['devtools.timeline','disabled-by-default-devtools.timeline'],fixtureProtocol:'aimock-matrix-v3',builds,roster,policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},methodology:'Fixed Latin arrangement: each profile occupies each position three times overall; within each stratum only three of four positions are covered. Warmup, time, thermal, load, renderer and carryover effects remain. No ranking or fallback.',...FLAGS};
 await originalWait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),deadline.wait,STAGES.progress,'interleaved-initial');
 const end=invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs;
 const waitEnd=async(original,stageMs,label)=>{const began=now(),limit=Math.min(stageMs,end-began);let timer;try{if(limit<=0)throw Error(label+'-deadline');const value=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-deadline')),limit);})]);if(now()>=end||now()-began>=stageMs)throw Error(label+'-deadline');return value;}finally{clearTimeout(timer);}};
 const dispatchPost=(factory,ms,label)=>{if(now()>=end){const e=Error(label+'-refused-before-dispatch');e.refusedBeforeDispatch=true;throw e;}return originalWait(factory(),waitEnd,ms,label);};
 const executeSlot=async slot=>{
  const dispatched=now(),engine=slot.selection.profile==='threadplane'?stock:competitor;
  const native=await originalWait(engine.runMatrixCase({slot,store,out,invocationStarted}),waitEnd,LIMITS.caseMs+LIMITS.cleanupMs,'interleaved-original-case');
  const settled=now();let fixture={status:'unavailable',reason:'actual-fixture-reference-unavailable'},qualificationUnsafe=false;
  if(native.fixture){try{const source=await dispatchPost(()=>store.readJSON(native.fixture,{kind:'private-case'}),STAGES.transcript,'interleaved-actual-fixture-read');fixture=await dispatchPost(()=>verifyInterleavedFixtureV1(source,native,slot),STAGES.transcript,'interleaved-canonical-fixture');}catch(e){fixture={status:'unavailable',reason:reason(e)};qualificationUnsafe=e?.unsafeOutstanding===true;}}
  const attempt={schema:'four-profile-stock036-interleaved-attempt-v1',parentId:slot.parentId,round:slot.round,stratum:slot.stratum,block:slot.block,position:slot.position,sourceFlavor:slot.sourceFlavor,buildSha256:buildHashes[slot.selection.profile],fixture,originalCall:{clock:'controller-monotonic',dispatched,settled},qualificationUnsafe,...FLAGS};
  return{...native,interleavedAttempt:attempt};
 };
 // This outer stop belongs to the comparison, not to native admission. Preserve
 // every returned native field even if a later fixture original is unsettled.
 const results=[];let stopReason=null;
 for(const slot of roster){
  if(!stopReason&&now()-invocationStarted>=LIMITS.invocationMs)stopReason='matrix-invocation-deadline';
  if(stopReason){results.push({id:slot.id,kind:slot.kind,selection:slot.selection,status:'unattempted',reason:stopReason,acquisition:MATRIX_V5_ACQUISITION,...FLAGS});continue;}
  let result;
  try{result=await executeSlot(slot);}catch(e){result={id:slot.id,kind:slot.kind,selection:slot.selection,status:'invalid',failure:{message:reason(e)},unsafeOutstanding:true,acquisition:MATRIX_V5_ACQUISITION,...FLAGS};}
  results.push(result);
  if(result.unsafeOutstanding||result.interleavedAttempt?.qualificationUnsafe)stopReason='matrix-original-ownership-unsettled';
  else if(result.stopInvocation||result.publicationUnavailable!==undefined)stopReason='matrix-publication-or-storage-unavailable';
 }
 const execution={results,stopReason,complete:results.length===48&&results.every(r=>r.status==='matrix-pass'&&!r.unsafeOutstanding&&!r.stopInvocation&&!r.interleavedAttempt?.qualificationUnsafe)};

 const bookends=[];let verificationUnsafe=false;
 for(const profile of PROFILES){try{const raw=await dispatchPost(()=>readBuild(profile),STAGES.transcript,'interleaved-build-after'),sha256=digest(raw);bookends.push({profile,status:sha256===buildHashes[profile]?'unchanged':'changed',sha256,raw});}catch(e){verificationUnsafe||=e?.unsafeOutstanding===true;bookends.push({profile,status:'unavailable',reason:reason(e),unsafeOutstanding:e?.unsafeOutstanding===true,refusedBeforeDispatch:e?.refusedBeforeDispatch===true});}}
 const qualificationUnsafe=execution.results.some(r=>r.interleavedAttempt?.qualificationUnsafe===true),unsafeOutstanding=verificationUnsafe||qualificationUnsafe||execution.results.some(r=>r.unsafeOutstanding===true),complete=!unsafeOutstanding&&bookends.every(b=>b.status==='unchanged')&&execution.complete&&admitFourProfileStock036InterleavedV1(execution.results,buildHashes);
 const final={...manifest,...execution,bookends,summary:summarizeFourProfileStock036InterleavedV1(execution.results,buildHashes),complete,status:complete?'complete':'incomplete',unsafeOutstanding,stopInvocation:execution.stopReason!==null||unsafeOutstanding||bookends.some(b=>b.status!=='unchanged')||execution.results.some(r=>r.stopInvocation===true),storage:store.stats()};
 // Publication refusal is observable rejection, never a fabricated complete return.
 let publicationAttempted=false;
 try{if(now()>=end){const e=Error('interleaved-final-publication-refused-before-dispatch');e.refusedBeforeDispatch=true;throw e;}await dispatchPost(()=>{publicationAttempted=true;return store.writeManifest('manifest-final.json',final);},STAGES.progress,'interleaved-final-publication');}
 catch(error){
  const e=error instanceof Error?error:Error('interleaved-final-publication',{cause:error});
  const counts={attempted:final.results.filter(r=>r.status!=='unattempted').length,unattempted:final.results.filter(r=>r.status==='unattempted').length,nativePass:final.results.filter(r=>r.status==='matrix-pass').length};
  const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
  e.diagnostic=freeze(JSON.parse(JSON.stringify({schema:'four-profile-stock036-interleaved-terminal-failure-v1',failure:reason(e),complete:false,unsafeOutstanding:final.unsafeOutstanding||e.unsafeOutstanding===true,stopInvocation:true,publication:{attempted:publicationAttempted,status:'unavailable'},counts,attempts:final.results.map(r=>({id:r.id,status:r.status,reason:r.reason??r.failure?.message??null,trace:r.traceDiagnostic?.status??'unavailable',failure:r.failure??null,unsafeOutstanding:r.unsafeOutstanding===true,stopInvocation:r.stopInvocation===true,qualificationUnsafe:r.interleavedAttempt?.qualificationUnsafe===true})),bookends:final.bookends.map(b=>({profile:b.profile,status:b.status,unsafeOutstanding:b.unsafeOutstanding===true,refusedBeforeDispatch:b.refusedBeforeDispatch===true})),summary:final.summary,...FLAGS})));
  throw e;
 }
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runFourProfileStock036InterleavedInvocationV1(process.argv.slice(2)).then(v=>{console.log(JSON.stringify({schema:v.schema,complete:v.complete,attempts:v.results.map(r=>({id:r.id,status:r.status,trace:r.traceDiagnostic?.status??'unavailable'})),...FLAGS}));if(!v.complete)process.exitCode=1;},e=>{console.error(JSON.stringify(e.diagnostic??{schema:'four-profile-stock036-interleaved-failure-v1',failure:reason(e),unsafeOutstanding:e?.unsafeOutstanding===true,...FLAGS}));process.exitCode=1;});
