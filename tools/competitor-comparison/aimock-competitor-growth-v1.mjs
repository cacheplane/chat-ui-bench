import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {competitorBuildEvidenceV1,waitCompetitorBuildOriginalV1} from './competitor-build-v1.mjs';
import {COMPETITOR_STOCK_PROFILES_V1} from './competitor-stock-pins-v1.mjs';
import {matrixVerificationRoster,MATRIX_V5_ACQUISITION,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';

const flags=Object.freeze({performance:false,scoringEligibility:false,FPS:null});
const roster=Object.freeze([1,2,3].flatMap(round=>matrixVerificationRoster().filter(row=>row.kind==='positive'&&COMPETITOR_STOCK_PROFILES_V1.includes(row.selection.profile)&&[1000,10000].includes(row.selection.historyCount)&&row.selection.responseBytes===6400).map(row=>Object.freeze({...row,parentId:row.id,id:`${row.id}-aimock-competitor-growth-v1-round-${round}`,round}))));
const expected=[];for(const round of [1,2,3])for(const h of [1000,10000])for(const profile of COMPETITOR_STOCK_PROFILES_V1)for(const journey of ['follow','history-reading'])expected.push(`${profile}-h${h}-r6400-${journey}-aimock-competitor-growth-v1-round-${round}`);
if(roster.length!==36||new Set(roster.map(row=>row.id)).size!==36||roster.some((row,i)=>row.id!==expected[i]||Object.hasOwn(row,'omitDelta')))throw Error('competitor-growth-roster');
export const aimockCompetitorGrowthRosterV1=()=>roster;
export function parseAimockCompetitorGrowthArgumentsV1(args){if(!Array.isArray(args)||args.length!==2||args[0]!=='--out'||typeof args[1]!=='string'||!path.isAbsolute(args[1])||path.resolve(args[1])!==args[1]||args[1].includes('\0'))throw Error('competitor-growth-arguments');return{out:args[1]};}
const own=(value,key)=>{if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const same=(value,expected)=>Object.entries(expected).every(([key,v])=>own(value,key)===v);
const actualFlags=value=>same(value,flags),acquisition=value=>same(value,MATRIX_V5_ACQUISITION);
function attempt(slot,buildSha256){return Object.freeze({schema:'competitor-aimock-semantic-growth-attempt-v1',parentId:slot.parentId,round:slot.round,selection:slot.selection,competitorBuildSha256:buildSha256,...flags});}
export function admitAimockCompetitorGrowthCohortV1(results,buildHashes){
 try{
  if(!Array.isArray(results)||types.isProxy(results)||own(results,'length')!==36||buildHashes===null||typeof buildHashes!=='object'||types.isProxy(buildHashes)||Object.keys(buildHashes).sort().join(',')!==[...COMPETITOR_STOCK_PROFILES_V1].sort().join(',')||COMPETITOR_STOCK_PROFILES_V1.some(profile=>!/^[a-f0-9]{64}$/.test(own(buildHashes,profile)??'')))return false;
  return roster.every((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission'),g=own(r,'growthAttempt'),t=own(r,'traceDiagnostic'),hash=own(buildHashes,slot.selection.profile);return own(r,'id')===slot.id&&own(r,'kind')==='positive'&&same(r,slot.selection)&&own(r,'schema')==='four-stack-matrix-case-v5'&&own(r,'purpose')==='functional-conformance-development'&&acquisition(own(r,'acquisition'))&&actualFlags(r)&&own(r,'status')==='matrix-pass'&&own(r,'failure')===null&&own(r,'unsafeOutstanding')===false&&own(r,'stopInvocation')===false&&own(r,'publicationUnavailable')===undefined&&own(g,'schema')==='competitor-aimock-semantic-growth-attempt-v1'&&own(g,'parentId')===slot.parentId&&own(g,'round')===slot.round&&same(own(g,'selection'),slot.selection)&&own(g,'competitorBuildSha256')===hash&&actualFlags(g)&&own(a,'schema')==='four-stack-matrix-conformance-v5'&&own(a,'profile')===slot.selection.profile&&same(own(a,'workload'),{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50})&&own(a,'status')==='functional-pass'&&acquisition(own(a,'acquisition'))&&actualFlags(a)&&own(t,'schema')==='competitor-aimock-semantic-trace-case-v1'&&own(t,'profile')===slot.selection.profile&&own(t,'status')==='complete'&&own(t,'competitorBuildSha256')===hash&&actualFlags(t);});
 }catch{return false;}
}
/** Unit ports mirror the existing parent runner. The CLI supplies none and
 * always calls the real selected-profile build reader and real V5 case. */
export async function runAimockCompetitorGrowthInvocationV1(args,ports={}){
 for(const key of Object.keys(ports))if(!['now','loadCaseEngine','buildEvidence','createStore'].includes(key))throw Error('competitor-growth-port');
 const {now=()=>performance.now(),loadCaseEngine=()=>import('./matrix-case-competitor-trace-v1.mjs'),buildEvidence=competitorBuildEvidenceV1,createStore=createMatrixArtifactStore}=ports;
 const {out}=parseAimockCompetitorGrowthArgumentsV1(args),invocationStarted=now();
 const {createMatrixDeadline,runMatrixRoster}=await import('./matrix-run-v5.mjs');
 const deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted,now});
 const {runMatrixCase}=await deadline.wait(loadCaseEngine(),STAGES.progress,'competitor-growth-case-modules');
 const builds={},buildHashes={};
 for(const profile of COMPETITOR_STOCK_PROFILES_V1){const build=await waitCompetitorBuildOriginalV1(buildEvidence(profile),deadline.wait,STAGES.transcript,'competitor-build-before');if(build?.schema!=='competitor-genuine-build-v1'||build.profile!==profile)throw Error('competitor-growth-build-profile');builds[profile]=build;buildHashes[profile]=createHash('sha256').update(JSON.stringify(build)).digest('hex');}
 const store=await deadline.wait(createStore({directory:out}),STAGES.progress,'competitor-growth-directory');
 const manifest={schema:'competitor-aimock-semantic-growth-invocation-v1',captureProfile:'semantic-task-layout-v2',instrumentationCategories:['devtools.timeline','disabled-by-default-devtools.timeline'],purpose:'instrumented-diagnostic-competitor-history-growth',profiles:[...COMPETITOR_STOCK_PROFILES_V1],builds,buildHashes,fixtureProtocol:'aimock-matrix-v3',environment:{platform:os.platform(),release:os.release(),architecture:os.arch(),node:process.version,mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1},physicalPresentation:'unverified'},roster:roster.map(({id,parentId,round,selection})=>({id,parentId,round,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},methodology:'fixed canonical profile blocks within round/workload; separate Threadplane12 plus competitor36 does not remove order/time/thermal confounding or establish a ranking',...flags};
 await deadline.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'competitor-growth-initial');
 const execution=await runMatrixRoster({slots:roster,invocationStarted,now,execute:async slot=>({...await runMatrixCase({slot,store,out,invocationStarted}),growthAttempt:attempt(slot,buildHashes[slot.selection.profile])})});
 const waitPost=async(original,stageMs,label)=>{const end=invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs,began=now();let timer;try{if(now()>=end)throw Error(label+'-deadline');const value=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-deadline')),Math.min(stageMs,end-now()));})]);if(now()>=end||now()-began>stageMs)throw Error(label+'-deadline');return value;}finally{clearTimeout(timer);}};
 let verificationFailure=null,verificationUnsafe=false;
 for(const profile of COMPETITOR_STOCK_PROFILES_V1){try{const after=await waitCompetitorBuildOriginalV1(buildEvidence(profile),waitPost,STAGES.transcript,'competitor-build-after');if(JSON.stringify(after)!==JSON.stringify(builds[profile]))throw Error('competitor-growth-build-drift');}catch(error){verificationFailure??={profile,reason:'competitor-growth-build-drift'};verificationUnsafe||=error?.unsafeOutstanding===true;}}
 const complete=verificationFailure===null&&execution.complete&&admitAimockCompetitorGrowthCohortV1(execution.results,buildHashes),final={...manifest,...execution,verificationFailure,complete,status:complete?'complete':'incomplete',unsafeOutstanding:verificationUnsafe||execution.results.some(row=>row.unsafeOutstanding===true),stopInvocation:verificationFailure!==null||execution.results.some(row=>row.stopInvocation===true),storage:store.stats()};
 const original=store.writeManifest('manifest-final.json',final);let timer;try{await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('competitor-growth-final-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-now())));})]);}finally{clearTimeout(timer);}return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockCompetitorGrowthInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,complete:value.complete,attempts:value.results.map(row=>({id:row.id,status:row.status,trace:row.traceDiagnostic?.status??'unavailable'})),FPS:null}));if(!value.complete)process.exitCode=1;},error=>{console.error(JSON.stringify({schema:'competitor-semantic-growth-failure-v1',failure:String(error?.message??error).slice(0,2048),unsafeOutstanding:error?.unsafeOutstanding===true,...flags}));process.exitCode=1;});
