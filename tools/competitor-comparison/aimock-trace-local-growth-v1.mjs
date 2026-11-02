import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {createThreadplaneLocalBuildGuardV1,waitThreadplaneLocalBuildOriginalV1} from './threadplane-local-build-v1.mjs';
import {matrixVerificationRoster,MATRIX_V5_ACQUISITION,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {createMatrixDeadline,runMatrixRoster} from './matrix-run-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';
const flags=Object.freeze({performance:false,scoringEligibility:false,FPS:null});
const roles=['current-main-control','render-fix-candidate'];
const rosters=new Map(roles.map(role=>[role,Object.freeze([1,2,3].flatMap(round=>matrixVerificationRoster().filter(row=>row.kind==='positive'&&row.selection.profile==='threadplane'&&[1000,10000].includes(row.selection.historyCount)&&row.selection.responseBytes===6400).map(row=>Object.freeze({...row,parentId:row.id,id:`${row.id}-aimock-local-growth-v1-${role}-round-${round}`,round}))))]));
for(const [role,roster] of rosters){const expected=[];for(const round of [1,2,3])for(const h of [1000,10000])for(const journey of ['follow','history-reading'])expected.push(`threadplane-h${h}-r6400-${journey}-aimock-local-growth-v1-${role}-round-${round}`);if(roster.length!==12||new Set(roster.map(r=>r.id)).size!==12||roster.some((r,i)=>r.id!==expected[i]||Object.hasOwn(r,'omitDelta')))throw Error('aimock-local-growth-roster');}
export function aimockTraceLocalGrowthRosterV1(role){const roster=rosters.get(role);if(!roster)throw Error('aimock-local-role');return roster;}
function absolute(value){return typeof value==='string'&&path.isAbsolute(value)&&path.resolve(value)===value&&!value.includes('\0');}
export function parseAimockTraceLocalGrowthArgumentsV1(args){if(!Array.isArray(args)||args.length!==6||args[0]!=='--out'||!absolute(args[1])||args[2]!=='--artifact-manifest'||!absolute(args[3])||args[4]!=='--artifact-sha256'||typeof args[5]!=='string'||!/^[a-f0-9]{64}$/.test(args[5]))throw Error('aimock-local-growth-arguments');return {out:args[1],manifestPath:args[3],manifestSha256:args[5]};}
const own=(value,key)=>{if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const same=(value,expected)=>Object.entries(expected).every(([key,v])=>own(value,key)===v);
const actualFlags=value=>same(value,flags),acquisition=value=>same(value,MATRIX_V5_ACQUISITION);
const identityFields=value=>({schema:own(value,'schema'),role:own(value,'role'),sourceCommit:own(value,'sourceCommit'),manifestSha256:own(value,'manifestSha256')});
function validIdentity(value){const i=identityFields(value);return i.schema==='threadplane-local-build-identity-v1'&&roles.includes(i.role)&&/^[a-f0-9]{40}$/.test(i.sourceCommit??'')&&/^[a-f0-9]{64}$/.test(i.manifestSha256??'');}
function attempt(slot,localBuild){return Object.freeze({schema:'threadplane-aimock-local-growth-attempt-v1',parentId:slot.parentId,round:slot.round,selection:slot.selection,localBuild,...flags});}
/** Aggregate diagnostic closure only. Unchanged V5 execution owns functional admission. */
export function admitAimockTraceLocalGrowthCohortV1(results,buildSha256,identity){
 try{if(typeof buildSha256!=='string'||!/^[a-f0-9]{64}$/.test(buildSha256)||!validIdentity(identity)||!Array.isArray(results)||types.isProxy(results)||own(results,'length')!==12)return false;const roster=aimockTraceLocalGrowthRosterV1(own(identity,'role')),expectedIdentity=identityFields(identity);
 return roster.every((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission'),g=own(r,'localAttempt'),t=own(r,'traceDiagnostic');return own(r,'id')===slot.id&&own(r,'kind')==='positive'&&same(r,slot.selection)&&own(r,'schema')==='four-stack-matrix-case-v5'&&own(r,'purpose')==='functional-conformance-development'&&acquisition(own(r,'acquisition'))&&actualFlags(r)&&own(r,'status')==='matrix-pass'&&own(r,'failure')===null&&own(r,'unsafeOutstanding')===false&&own(r,'stopInvocation')===false&&own(r,'publicationUnavailable')===undefined&&own(g,'schema')==='threadplane-aimock-local-growth-attempt-v1'&&own(g,'parentId')===slot.parentId&&own(g,'round')===slot.round&&same(own(g,'selection'),slot.selection)&&same(own(g,'localBuild'),expectedIdentity)&&actualFlags(g)&&own(a,'schema')==='four-stack-matrix-conformance-v5'&&own(a,'profile')==='threadplane'&&same(own(a,'workload'),{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50})&&own(a,'status')==='functional-pass'&&acquisition(own(a,'acquisition'))&&actualFlags(a)&&own(t,'status')==='complete'&&own(t,'localBuildSha256')===buildSha256&&same(own(t,'localBuild'),expectedIdentity)&&actualFlags(t);});
 }catch{return false;}
}
/** CLI always uses original production ports; explicit overrides support pure tests only. */
export async function runAimockTraceLocalGrowthInvocationV1(args,ports={}){
 for(const key of Object.keys(ports))if(!['now','loadCaseEngine','buildEvidence','createStore','createGuard'].includes(key))throw Error('aimock-local-growth-port');
 const {now=()=>performance.now(),loadCaseEngine=()=>import('./matrix-case-local-trace-v1.mjs'),buildEvidence=threadplaneBuildEvidence,createStore=createMatrixArtifactStore,createGuard=createThreadplaneLocalBuildGuardV1}=ports;
 const {out,manifestPath,manifestSha256}=parseAimockTraceLocalGrowthArgumentsV1(args),invocationStarted=now(),deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted,now});
 // The final bookend belongs to the invocation, after all per-case deadlines.
 // Its absolute limit includes only the existing fixed cleanup allowance.
 const waitPostInvocation=async(original,stageMs,label)=>{const end=invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs,began=now();let timer;const check=()=>{if(now()>=end)throw Error('aimock-local-invocation-post-deadline');};try{check();const value=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-deadline')),Math.min(stageMs,end-now()));})]);check();if(now()-began>stageMs)throw Error(label+'-deadline');return value;}finally{clearTimeout(timer);}};
 const {runMatrixCase}=await deadline.wait(loadCaseEngine(),STAGES.progress,'aimock-trace-modules');
 const guard=await waitThreadplaneLocalBuildOriginalV1(createGuard({manifestPath,manifestSha256}),deadline.wait,STAGES.transcript,'aimock-local-profile'),identity=guard.identity;if(!validIdentity(identity)||identity.manifestSha256!==manifestSha256)throw Error('aimock-local-profile');
 const roster=aimockTraceLocalGrowthRosterV1(identity.role),store=await deadline.wait(createStore({directory:out}),STAGES.progress,'aimock-trace-directory');
 const build=await waitThreadplaneLocalBuildOriginalV1(guard.verify(await waitThreadplaneLocalBuildOriginalV1(buildEvidence(),deadline.wait,STAGES.transcript,'aimock-local-build-before')),deadline.wait,STAGES.transcript,'aimock-local-verify-before'),buildSha256=createHash('sha256').update(JSON.stringify(build)).digest('hex');
 const manifest={schema:'threadplane-aimock-local-growth-invocation-v1',captureProfile:'semantic-task-layout-v2',instrumentationCategories:['devtools.timeline','disabled-by-default-devtools.timeline'],purpose:'instrumented-diagnostic-local-history-growth',localBuild:identity,fixtureProtocol:'aimock-matrix-v3',build,buildSha256,environment:{platform:os.platform(),release:os.release(),architecture:os.arch(),node:process.version,mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1},physicalPresentation:'unverified'},roster:roster.map(({id,parentId,round,selection})=>({id,parentId,round,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},...flags};
 await deadline.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'aimock-trace-initial');
 const localBuildProfile=Object.freeze({manifestPath,manifestSha256});
 const execution=await runMatrixRoster({slots:roster,invocationStarted,now,execute:async slot=>{const originalResult=await runMatrixCase({slot:{...slot,localBuildProfile},store,out,invocationStarted});return {...originalResult,localAttempt:attempt(slot,identity)};}});
 let verificationFailure=null,verificationUnsafe=false;try{const after=await waitThreadplaneLocalBuildOriginalV1(guard.verify(await waitThreadplaneLocalBuildOriginalV1(buildEvidence(),waitPostInvocation,STAGES.transcript,'aimock-local-build-after')),waitPostInvocation,STAGES.transcript,'aimock-local-verify-after');if(JSON.stringify(after)!==JSON.stringify(build))throw Error('aimock-local-invocation-build-drift');}catch(error){verificationFailure='aimock-local-invocation-build-drift';verificationUnsafe=error?.unsafeOutstanding===true;}
 const complete=verificationFailure===null&&execution.complete&&admitAimockTraceLocalGrowthCohortV1(execution.results,buildSha256,identity),final={...manifest,...execution,complete,status:complete?'complete':'incomplete',verificationFailure,unsafeOutstanding:verificationUnsafe||execution.results.some(r=>r.unsafeOutstanding===true),stopInvocation:verificationUnsafe||execution.results.some(r=>r.stopInvocation===true),storage:store.stats()};
 const original=store.writeManifest('manifest-final.json',final);let timer;
 try{await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('aimock-trace-final-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-now())));})]);}finally{clearTimeout(timer);}
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockTraceLocalGrowthInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,role:value.localBuild.role,sourceCommit:value.localBuild.sourceCommit,complete:value.complete,cases:value.results.map(r=>({id:r.id,status:r.status,trace:r.traceDiagnostic?.status??'unavailable'})),FPS:null}));if(!value.complete)process.exitCode=1;},error=>{console.error(JSON.stringify({schema:'threadplane-aimock-local-growth-failure-v1',status:'invalid',unsafeOutstanding:error?.unsafeOutstanding===true,...flags}));process.exitCode=1;});
