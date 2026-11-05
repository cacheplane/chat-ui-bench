import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {types} from 'node:util';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertLocal036ExecutionsReadyV1,local036ExecutionIdentityV1,LOCAL036_ROLES_V1} from '../threadplane-local036/fixed-experiment-v1.mjs';
import {createLocal036BuildGuardV1,waitLocal036OriginalV1,assertLocal036ToolingBookendsV1} from './threadplane-local036-build-v1.mjs';
import {matrixVerificationRoster,MATRIX_V5_ACQUISITION,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';
const flags=Object.freeze({performance:false,scoringEligibility:false,FPS:null});
const rosters=new Map(LOCAL036_ROLES_V1.map(role=>[role,Object.freeze([1,2,3].flatMap(round=>matrixVerificationRoster().filter(row=>row.kind==='positive'&&row.selection.profile==='threadplane'&&[1000,10000].includes(row.selection.historyCount)&&row.selection.responseBytes===6400).map(row=>Object.freeze({...row,parentId:row.id,id:`${row.id}-aimock-local036-growth-v1-${role}-round-${round}`,round}))))]));
for(const[role,roster]of rosters){const expected=[];for(const round of [1,2,3])for(const h of [1000,10000])for(const journey of ['follow','history-reading'])expected.push(`threadplane-h${h}-r6400-${journey}-aimock-local036-growth-v1-${role}-round-${round}`);if(roster.length!==12||new Set(roster.map(r=>r.id)).size!==12||roster.some((r,i)=>r.id!==expected[i]||Object.hasOwn(r,'omitDelta')))throw Error('local036-roster');}
export function aimockLocal036GrowthRosterV1(role){const value=rosters.get(role);if(!value)throw Error('local036-role');return value;}
export function parseAimockLocal036GrowthArgumentsV1(args){if(!Array.isArray(args)||args.length!==4||args[0]!=='--role'||!LOCAL036_ROLES_V1.includes(args[1])||args[2]!=='--out'||typeof args[3]!=='string'||!path.isAbsolute(args[3])||path.resolve(args[3])!==args[3]||args[3].includes('\0'))throw Error('local036-growth-arguments');return{role:args[1],out:args[3]};}
/** Fixed post budget; factory is not dispatched after hard end. Pure clock tests grant no runtime authority. */
export async function waitLocal036PostOriginalV1(factory,invocationStarted,label,now=()=>performance.now()){
 const end=invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs,dispatch=now();let state='not-dispatched',settledAt=null,timer,deadlineFailed=false;
 const receipt=()=>Object.freeze({label,attempted:state!=='not-dispatched',dispatchedAt:state==='not-dispatched'?null:dispatch,originalState:state,settledAt,attentionAt:now(),deadlineFailed});
 try{
  if(dispatch>=end){deadlineFailed=true;throw Error(label+'-deadline-before-dispatch');}
  state='pending';let original;try{original=Promise.resolve(factory());}catch(error){state='rejected';settledAt=now();throw error;}
  void original.then(()=>{state='fulfilled';settledAt=now();},()=>{state='rejected';settledAt=now();});
  const value=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>{deadlineFailed=true;reject(Error(label+'-deadline'));},Math.min(STAGES.transcript,end-dispatch));})]);
  if(now()>=end||now()-dispatch>=STAGES.transcript){deadlineFailed=true;throw Error(label+'-deadline');}
  return{value,owner:receipt()};
 }catch(error){const e=error instanceof Error?error:Error(label,{cause:error});e.originalOwner=receipt();if(state==='pending')e.unsafeOutstanding=true;throw e;}finally{clearTimeout(timer);}
}
const own=(v,k)=>{if(v===null||typeof v!=='object'||types.isProxy(v))return undefined;const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const same=(v,expected)=>Object.entries(expected).every(([k,x])=>own(v,k)===x),actualFlags=v=>same(v,flags);
function sameIdentity(value,expected){try{assertLocal036ToolingBookendsV1(own(value,'toolingSourceHashes'),expected.toolingSourceHashes);return same(value,Object.fromEntries(Object.entries(expected).filter(([key])=>key!=='toolingSourceHashes')));}catch{return false;}}
function attempt(slot,identity){return Object.freeze({schema:'threadplane-local036-growth-attempt-v1',parentId:slot.parentId,round:slot.round,selection:slot.selection,localBuild:identity,...flags});}
/** Pure aggregate model, never production source or build authority. */
export function admitLocal036GrowthCohortV1(results,identity,parsedBuildSha256,rawBuildSha256){
 try{const identityKeys=['schema','experimentId','role','sourceCommit','selectionDigest','executionDigest','toolingSourceHashes','label','stock'];if(identity===null||typeof identity!=='object'||types.isProxy(identity))return false;const descriptors=Object.getOwnPropertyDescriptors(identity);if(Object.getPrototypeOf(identity)!==Object.prototype||!Reflect.ownKeys(descriptors).every(k=>typeof k==='string'))return false;if(Object.keys(descriptors).sort().join(',')!==identityKeys.sort().join(',')||!Object.values(descriptors).every(d=>Object.hasOwn(d,'value')))return false;assertLocal036ToolingBookendsV1(identity.toolingSourceHashes,identity.toolingSourceHashes);if(!same(identity,{schema:'threadplane-local036-build-identity-v1',experimentId:'local036-view-work-v1',label:'local-source-built-036',stock:false})||!LOCAL036_ROLES_V1.includes(own(identity,'role'))||!['sourceCommit','selectionDigest','executionDigest'].every(k=>new RegExp(`^[a-f0-9]{${k==='sourceCommit'?40:64}}$`).test(own(identity,k)??''))||![parsedBuildSha256,rawBuildSha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||!Array.isArray(results)||types.isProxy(results)||Object.getPrototypeOf(results)!==Array.prototype||Reflect.ownKeys(results).some(k=>typeof k!=='string')||own(results,'length')!==12)return false;const roster=aimockLocal036GrowthRosterV1(identity.role);
 return roster.every((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission'),g=own(r,'localAttempt'),t=own(r,'traceDiagnostic');return own(r,'id')===slot.id&&own(r,'kind')==='positive'&&same(r,slot.selection)&&own(r,'schema')==='four-stack-matrix-case-v5'&&own(r,'purpose')==='functional-conformance-development'&&same(own(r,'acquisition'),MATRIX_V5_ACQUISITION)&&actualFlags(r)&&own(r,'status')==='matrix-pass'&&own(r,'failure')===null&&own(r,'unsafeOutstanding')===false&&own(r,'stopInvocation')===false&&own(r,'publicationUnavailable')===undefined&&own(g,'schema')==='threadplane-local036-growth-attempt-v1'&&own(g,'parentId')===slot.parentId&&own(g,'round')===slot.round&&same(own(g,'selection'),slot.selection)&&sameIdentity(own(g,'localBuild'),identity)&&actualFlags(g)&&own(a,'schema')==='four-stack-matrix-conformance-v5'&&own(a,'profile')==='threadplane'&&same(own(a,'workload'),{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50})&&own(a,'status')==='functional-pass'&&same(own(a,'acquisition'),MATRIX_V5_ACQUISITION)&&actualFlags(a)&&own(t,'schema')==='threadplane-local036-aimock-trace-case-v1'&&own(t,'status')==='complete'&&own(t,'localBuildSha256')===parsedBuildSha256&&own(t,'localBuildRecordSha256')===rawBuildSha256&&sameIdentity(own(t,'localBuild'),identity)&&actualFlags(t);});
 }catch{return false;}
}
function compactFailure(role,execution,owners,error,publication){const roster=aimockLocal036GrowthRosterV1(role);return Object.freeze({schema:'threadplane-local036-growth-failure-v1',role,status:'incomplete',complete:false,failure:String(error?.message??error).slice(0,4096),unsafeOutstanding:error?.unsafeOutstanding===true||execution?.results.some(r=>r.unsafeOutstanding===true)||false,publication,originalOwners:owners,results:roster.map((slot,i)=>({id:slot.id,status:execution?.results[i]?.status??'unattempted',reason:execution?.results[i]?.reason??(execution?'': 'invocation-setup-failed')})),...flags});}
/** Production has no caller identity, root, guard, verifier or engine ports. */
export async function runAimockLocal036GrowthInvocationV1(args){
 assertLocal036ExecutionsReadyV1();
 const{role,out}=parseAimockLocal036GrowthArgumentsV1(args),fixed=local036ExecutionIdentityV1(role),invocationStarted=performance.now(),owners=[];let execution,publication={attempted:false};
 const post=async(factory,label)=>{try{const r=await waitLocal036PostOriginalV1(factory,invocationStarted,label);owners.push(r.owner);return r.value;}catch(error){if(error.originalOwner)owners.push(error.originalOwner);throw error;}};
 try{
  const{createMatrixDeadline,runMatrixRoster}=await post(()=>import('./matrix-run-v5.mjs'),'local036-modules'),deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted}),wait=deadline.wait;
  const guard=await waitLocal036OriginalV1(createLocal036BuildGuardV1(role),wait,STAGES.transcript,'local036-guard');
  const readVerified=async()=>guard.verify(await threadplaneBuildEvidence());
  const build=await waitLocal036OriginalV1(readVerified(),wait,STAGES.transcript,'local036-build-before');
  const{runMatrixCase}=await waitLocal036OriginalV1(import('./matrix-case-local036-trace-v1.mjs'),wait,STAGES.progress,'local036-case-module');
  const store=await waitLocal036OriginalV1(createMatrixArtifactStore({directory:out}),wait,STAGES.progress,'local036-directory'),identity=guard.identity,roster=aimockLocal036GrowthRosterV1(role);
  const manifest={schema:'threadplane-local036-growth-invocation-v1',purpose:'instrumented-diagnostic-local-history-growth',localBuild:identity,build,buildSha256:fixed.parsedBuildSha256,buildRecordSha256:fixed.buildRecordSha256,captureProfile:'semantic-task-layout-v2',instrumentationCategories:['devtools.timeline','disabled-by-default-devtools.timeline'],fixtureProtocol:'aimock-matrix-v3',environment:{platform:os.platform(),release:os.release(),architecture:os.arch(),node:process.version,mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1},physicalPresentation:'unverified'},roster:roster.map(({id,parentId,round,selection})=>({id,parentId,round,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},...flags};
  await waitLocal036OriginalV1(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),wait,STAGES.progress,'local036-initial');
  execution=await runMatrixRoster({slots:roster,invocationStarted,execute:async slot=>{const native=await runMatrixCase({slot:{...slot,local036Role:role},store,out,invocationStarted});return{...native,localAttempt:attempt(slot,identity)};}});
  let verificationFailure=null,verificationUnsafe=false;
  try{const after=await post(readVerified,'local036-build-after');if(JSON.stringify(after)!==JSON.stringify(build))throw Error('local036-build-drift');}catch(error){verificationFailure=String(error?.message??error).slice(0,4096);verificationUnsafe=error?.unsafeOutstanding===true;}
  const qualified=admitLocal036GrowthCohortV1(execution.results,identity,fixed.parsedBuildSha256,fixed.buildRecordSha256),closure=local036InvocationClosureV1(execution,verificationFailure,verificationUnsafe,qualified);
  const final={...manifest,...execution,...closure,verificationFailure,originalOwners:[...owners],finalPublication:{state:'pending-at-serialization',receiptLocation:'original-cli-output'},storage:store.stats()};
  await post(()=>{publication={attempted:true};return store.writeManifest('manifest-final.json',final);},'local036-final-publication');return{...final,finalPublication:{state:'fulfilled',owner:owners.at(-1)}};
 }catch(error){error.local036Diagnostic=compactFailure(role,execution,owners,error,publication);throw error;}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockLocal036GrowthInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,role:value.localBuild.role,complete:value.complete,cases:value.results.map(r=>({id:r.id,status:r.status,trace:r.traceDiagnostic?.status??'unavailable'})),finalPublication:value.finalPublication,...flags}));if(!value.complete)process.exitCode=1;},error=>{console.error(JSON.stringify(error.local036Diagnostic??{schema:'threadplane-local036-growth-failure-v1',status:'invalid',failure:String(error?.message??error).slice(0,4096),...flags}));process.exitCode=1;});

/** Pure outer metadata closure. Never mutates the native case records. */
export function local036InvocationClosureV1(execution,verificationFailure,verificationUnsafe,qualified){const unsafeOutstanding=verificationUnsafe===true||execution.results.some(r=>r.unsafeOutstanding===true),stopInvocation=unsafeOutstanding||verificationFailure!==null||Boolean(execution.stopReason)||execution.results.some(r=>r.stopInvocation===true),complete=execution.results.length===12&&execution.complete===true&&qualified===true&&!stopInvocation;return{complete,status:complete?'complete':'incomplete',unsafeOutstanding,stopInvocation};}
