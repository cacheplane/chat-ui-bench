import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertStock036BuildV1,stock036PublishedIdentityV1,waitStock036BuildOriginalV1} from './aimock-stock036-v1.mjs';
import {matrixVerificationRoster,MATRIX_V5_ACQUISITION,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';

const flags=Object.freeze({performance:false,scoringEligibility:false,FPS:null});
const roster=Object.freeze([1,2,3].flatMap(round=>matrixVerificationRoster().filter(row=>row.kind==='positive'&&row.selection.profile==='threadplane'&&[1000,10000].includes(row.selection.historyCount)&&row.selection.responseBytes===6400).map(row=>Object.freeze({...row,parentId:row.id,id:`${row.id}-aimock-stock036-growth-v1-round-${round}`,round}))));
const expected=[];for(const round of [1,2,3])for(const h of [1000,10000])for(const journey of ['follow','history-reading'])expected.push(`threadplane-h${h}-r6400-${journey}-aimock-stock036-growth-v1-round-${round}`);
if(roster.length!==12||new Set(roster.map(r=>r.id)).size!==12||roster.some((r,i)=>r.id!==expected[i]||Object.hasOwn(r,'omitDelta')))throw Error('aimock-stock036-growth-roster');
export const aimockStock036GrowthRosterV1=()=>roster;
export function parseAimockStock036GrowthArgumentsV1(args){
 if(!Array.isArray(args)||args.length!==2||args[0]!=='--out'||typeof args[1]!=='string'||!path.isAbsolute(args[1])||path.resolve(args[1])!==args[1]||args[1].includes('\0'))throw Error('aimock-stock036-growth-arguments');
 return {out:args[1]};
}
const own=(value,key)=>{if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const same=(value,expected)=>Object.entries(expected).every(([key,v])=>own(value,key)===v);
const actualFlags=value=>same(value,flags);
const acquisition=value=>same(value,MATRIX_V5_ACQUISITION);
function attempt(slot){return Object.freeze({schema:'threadplane-aimock-stock036-growth-attempt-v1',parentId:slot.parentId,round:slot.round,selection:slot.selection,stockVersion:'0.3.6',...flags});}
/** Aggregate cohort closure only: unchanged V5 case execution owns admission. */
export function admitAimockStock036GrowthCohortV1(results,stockBuildSha256){
 try{if(typeof stockBuildSha256!=='string'||!/^[a-f0-9]{64}$/.test(stockBuildSha256)||!Array.isArray(results)||types.isProxy(results)||own(results,'length')!==12)return false;
 return roster.every((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission'),g=own(r,'growthAttempt'),t=own(r,'traceDiagnostic');return own(r,'id')===slot.id&&own(r,'kind')==='positive'&&same(r,slot.selection)&&own(r,'schema')==='four-stack-matrix-case-v5'&&own(r,'purpose')==='functional-conformance-development'&&acquisition(own(r,'acquisition'))&&actualFlags(r)&&own(r,'status')==='matrix-pass'&&own(r,'failure')===null&&own(r,'unsafeOutstanding')===false&&own(r,'stopInvocation')===false&&own(r,'publicationUnavailable')===undefined&&own(g,'schema')==='threadplane-aimock-stock036-growth-attempt-v1'&&own(g,'parentId')===slot.parentId&&own(g,'round')===slot.round&&own(g,'stockVersion')==='0.3.6'&&same(own(g,'selection'),slot.selection)&&actualFlags(g)&&own(a,'schema')==='four-stack-matrix-conformance-v5'&&own(a,'profile')==='threadplane'&&same(own(a,'workload'),{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50})&&own(a,'status')==='functional-pass'&&acquisition(own(a,'acquisition'))&&actualFlags(a)&&own(t,'status')==='complete'&&own(t,'stockBuildSha256')===stockBuildSha256&&actualFlags(t);});
 }catch{return false;}
}
/** CLI always uses original production ports. Overrides are limited to pure tests. */
export async function runAimockStock036GrowthInvocationV1(args,ports={}){
 stock036PublishedIdentityV1();
 for(const key of Object.keys(ports))if(!['now','loadCaseEngine','buildEvidence','createStore'].includes(key))throw Error('aimock-stock036-growth-port');
 const {now=()=>performance.now(),loadCaseEngine=()=>import('./matrix-case-stock036-trace-v1.mjs'),buildEvidence=threadplaneBuildEvidence,createStore=createMatrixArtifactStore}=ports;
 const {createMatrixDeadline,runMatrixRoster}=await import('./matrix-run-v5.mjs');
 const {out}=parseAimockStock036GrowthArgumentsV1(args),invocationStarted=now(),deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted,now});
 const {runMatrixCase}=await deadline.wait(loadCaseEngine(),STAGES.progress,'aimock-trace-modules');
 const store=await deadline.wait(createStore({directory:out}),STAGES.progress,'aimock-trace-directory');
 const build=assertStock036BuildV1(await waitStock036BuildOriginalV1(buildEvidence(),deadline.wait,STAGES.transcript,'aimock-stock036-build'));
 const manifest={schema:'threadplane-aimock-stock036-growth-invocation-v1',captureProfile:'semantic-task-layout-v2',instrumentationCategories:['devtools.timeline','disabled-by-default-devtools.timeline'],purpose:'instrumented-diagnostic-history-growth',stockVersion:'0.3.6',fixtureProtocol:'aimock-matrix-v3',build,environment:{platform:os.platform(),release:os.release(),architecture:os.arch(),node:process.version,mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1},physicalPresentation:'unverified'},roster:roster.map(({id,parentId,round,selection})=>({id,parentId,round,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},...flags};
 await deadline.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'aimock-trace-initial');
 const execution=await runMatrixRoster({slots:roster,invocationStarted,now,execute:async slot=>{const originalResult=await runMatrixCase({slot,store,out,invocationStarted});return {...originalResult,growthAttempt:attempt(slot)};}});
 const buildSha256=createHash('sha256').update(JSON.stringify(build)).digest('hex');
 let verificationFailure=null,verificationUnsafe=false;
 const waitPost=async(original,stageMs,label)=>{const end=invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs,began=now();let timer;try{if(now()>=end)throw Error(label+'-deadline');const value=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-deadline')),Math.min(stageMs,end-now()));})]);if(now()>=end||now()-began>stageMs)throw Error(label+'-deadline');return value;}finally{clearTimeout(timer);}};
 try{const after=assertStock036BuildV1(await waitStock036BuildOriginalV1(buildEvidence(),waitPost,STAGES.transcript,'aimock-stock036-build-after'));if(JSON.stringify(after)!==JSON.stringify(build))throw Error('aimock-stock036-build-drift');}catch(error){verificationFailure='aimock-stock036-build-drift';verificationUnsafe=error?.unsafeOutstanding===true;}
 const complete=verificationFailure===null&&execution.complete&&admitAimockStock036GrowthCohortV1(execution.results,buildSha256),final={...manifest,...execution,verificationFailure,unsafeOutstanding:verificationUnsafe||execution.results.some(r=>r.unsafeOutstanding===true),stopInvocation:verificationUnsafe||execution.results.some(r=>r.stopInvocation===true),complete,status:complete?'complete':'incomplete',storage:store.stats()};
 const original=store.writeManifest('manifest-final.json',final);let timer;
 try{await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('aimock-trace-final-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-now())));})]);}finally{clearTimeout(timer);}
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockStock036GrowthInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,complete:value.complete,cases:value.results.map(r=>({id:r.id,status:r.status,trace:r.traceDiagnostic?.status??'unavailable'})),FPS:null}));if(!value.complete)process.exitCode=1;},()=>{console.error('aimock-stock036-growth-invocation-failed details-retained-locally');process.exitCode=1;});
