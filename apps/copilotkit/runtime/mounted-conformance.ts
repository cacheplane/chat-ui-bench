/** Unscored H100/R6400 conformance. Importing this module allocates no SDK,
 * browser, server, timer or producer; native effects require explicit ports. */
import {evaluateMountedAdmissionPolicy,evaluateMountedModulePolicy,evaluateMountedClosurePolicy,type PreInstallIntent,type PostInstallAdmission,type MountedModuleInput,type CaseRecord,type CaseJourney} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import type {GeometrySnapshot} from '../src/geometry.ts';
import {evaluateMountedGeometry,evaluateHistoricalAnchor} from '../src/geometry-policy.ts';
import {copyHistoryContentScalar,copyHistoryReadinessDiagnostic,type HistoryReadinessContext,type HistoryContentReason,type HistoryReadinessReason,type HistoryReadinessOutcome,type RestoredHistoryContentScalar,type RestoredHistoryReadinessDiagnostic} from '../src/geometry.ts';
export interface HistoryReadinessPorts {
 check():HistoryContentReason|'deadline'|null;
 observe():Promise<unknown>;
 pause():Promise<void>;
 publish(record:RestoredHistoryReadinessDiagnostic):Promise<void>;
}
/** Sequential original observations. A race never substitutes for settlement. */
export async function awaitRestoredHistoryContent(context:HistoryReadinessContext,ports:HistoryReadinessPorts):Promise<void>{
 let attemptCount=0,first:RestoredHistoryContentScalar|null=null,last:RestoredHistoryContentScalar|null=null;
 let outcome:HistoryReadinessOutcome='unavailable',reason:HistoryReadinessReason='source-error',failed=false,primary:unknown;
 try{
  for(let i=0;i<120;i++){
   reason='source-error';const denied=ports.check();if(denied){reason=denied;outcome=['selector','ownership','unknown-id','text-mismatch','invalid-data','public-history'].includes(denied)?'invalid':'unavailable';throw Error('History readiness admission unavailable');}
   attemptCount++;
   let observed:unknown;
   try{observed=await ports.observe();}catch(error){reason='observation-rejected';throw error;}
   let scalar:RestoredHistoryContentScalar;
   try{scalar=copyHistoryContentScalar(observed,context.history);}catch{outcome='invalid';reason='scalar-contract';throw Error('Invalid history readiness scalar');}
   if(first===null)first=scalar;last=scalar;reason=scalar.reason;
   if(scalar.status==='ready'){outcome='ready';return;}
   if(scalar.status!=='pending'){outcome=scalar.status;throw Error('History content unavailable');}
   if(i===119){reason='attempt-limit';throw Error('History readiness attempt limit');}
   try{await ports.pause();}catch(error){reason='source-error';throw error;}
  }
 }catch(error){failed=true;primary=error;throw error;}
 finally{
  if(attemptCount>0){
   const record=copyHistoryReadinessDiagnostic({kind:'copilot-mounted-history-readiness-v1',caseNumber:context.caseNumber,journey:context.journey,threadId:context.threadId,attemptCount,outcome,reason,first,last,qualification:false},context);
   try{await ports.publish(record);}catch(error){if(!failed)throw error;}
   // A prior rejection (including null/undefined) is not replaced by publication.
   if(failed)throw primary;
  }
 }
}
export type RestoredHistorySnapshotObservation=Readonly<{content:unknown;snapshot:GeometrySnapshot|null}>;
export interface RestoredHistorySnapshotPorts extends Omit<HistoryReadinessPorts,'observe'> {
 observe():Promise<RestoredHistorySnapshotObservation>;
}
/** Retains the serialized ready capture before the original diagnostic publishes. */
export async function awaitRestoredHistorySnapshot(context:HistoryReadinessContext,ports:RestoredHistorySnapshotPorts):Promise<GeometrySnapshot>{
 let captured:GeometrySnapshot|null=null;
 await awaitRestoredHistoryContent(context,{
  check:()=>ports.check(),pause:()=>ports.pause(),publish:record=>ports.publish(record),
  async observe(){
   const observation=await ports.observe();
   if(typeof observation!=='object'||observation===null)throw Error('Invalid restored snapshot observation');
   const keys=Reflect.ownKeys(observation);
   if(keys.length!==2||!keys.includes('content')||!keys.includes('snapshot'))throw Error('Invalid restored snapshot observation');
   const content=own(observation,'content'),snapshot=own(observation,'snapshot');
   let scalar:RestoredHistoryContentScalar;
   // Let the original waiter diagnose malformed content as scalar-contract.
   try{scalar=copyHistoryContentScalar(content,context.history);}catch{return content;}
   if(scalar.status==='ready'){
    if(typeof snapshot!=='object'||snapshot===null||Array.isArray(snapshot))throw Error('Ready history snapshot absent');
    captured=snapshot as GeometrySnapshot;
   }else if(snapshot!==null)throw Error('Unexpected history snapshot before readiness');
   return scalar;
  }
 });
 if(captured===null)throw Error('Ready history snapshot absent');
 return captured;
}
/** Native local latch only: ordinary cleanup always settles before refusal. */
export async function closeAfterHistoryReadinessPublication<T>(close:()=>Promise<T>,publicationFailed:()=>boolean):Promise<T>{
 const result=await close();if(publicationFailed())throw Error('History readiness publication incomplete');return result;
}
export interface JourneyObservations {samples:readonly GeometrySnapshot[];anchorId:string|null;returned:GeometrySnapshot|null;
 wheel:Readonly<{isTrusted:boolean;deltaY:number;beforeScrollTop:number;afterScrollTop:number}>|null}
export interface MountedCaseOwner {
 seed():Promise<void>;
 restore():Promise<GeometrySnapshot>;
 startContinuation():Promise<void>;
 exercise(journey:CaseJourney):Promise<JourneyObservations>;
 complete():Promise<GeometrySnapshot>;
 close():Promise<CaseRecord>;
}
export interface MountedConformancePorts {
 connect():Promise<void>;
 openCase(journey:CaseJourney,caseNumber:1|2):Promise<MountedCaseOwner>;
 closeClient():Promise<void>;
}
export interface MountedPrerequisites {intent:PreInstallIntent;installed:PostInstallAdmission;module:MountedModuleInput}
/** Charges attempts before the full H100 collector runs, including failures. */
export function createMountedSnapshotReader(journey:CaseJourney,read:()=>Promise<GeometrySnapshot>,restored?:()=>Promise<GeometrySnapshot>):()=>Promise<GeometrySnapshot>{
 let calls=0;const limit=journey==='follow'?4:5;
 return async()=>{if(calls===limit)throw Error('Full geometry call budget exhausted');calls++;return calls===1&&restored?restored():read();};
}
export interface MountedConformanceResult {status:'complete'|'incomplete';cases:readonly CaseRecord[];snapshots:readonly Readonly<{caseNumber:1|2;snapshot:GeometrySnapshot}>[];nativeInputs:readonly Readonly<{caseNumber:1|2;wheel:JourneyObservations['wheel']}>[];primaryFailure:string|null;cleanupFailures:readonly string[];qualification:false;fps:'unavailable'}
function own(value:unknown,key:string):unknown {
 if(typeof value!=='object'||value===null)throw Error('Invalid data');
 const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw Error('Invalid data');return d.value;
}
function sameData(left:unknown,right:unknown):boolean {
 let remaining=10000;
 function equal(a:unknown,b:unknown,depth:number):boolean {
  if(--remaining<0||depth>32)return false;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Reflect.ownKeys(a),bk=Reflect.ownKeys(b);
  if(ak.length!==bk.length||ak.some(k=>typeof k!=='string')||bk.some(k=>typeof k!=='string'))return false;
  ak.sort();bk.sort();
  return ak.every((k,i)=>k===bk[i]&&equal(own(a,k as string),own(b,k as string),depth+1));
 }
 return equal(left,right,0);
}
export function mountedPrerequisitesAccepted(p:MountedPrerequisites):boolean {
 try {
  const intent=own(p,'intent'),installed=own(p,'installed'),module=own(p,'module');
  const a=evaluateMountedAdmissionPolicy(intent),b=evaluateMountedAdmissionPolicy(installed),c=evaluateMountedModulePolicy(module);
  if(a.status!=='accepted'||b.status!=='accepted'||c.status!=='accepted')return false;
  const source=own(own(intent,'source'),'commitSha'),q=own(intent,'prerequisite');
  return sameData(intent,own(installed,'intent'))&&own(q,'sourceSha')===source&&own(module,'sourceSha')===source&&own(own(installed,'installedProfile'),'sourceSha')===source&&
   own(own(own(installed,'intent'),'source'),'commitSha')===source&&own(module,'runId')===own(q,'originalRunId');
 }catch{return false;}
}
function available(snapshot:GeometrySnapshot){
 if(snapshot.status!=='available')throw Error('Geometry unavailable');
 const evaluation=evaluateMountedGeometry(snapshot.frame);
 if(evaluation.status!=='evaluated'||!evaluation.rows.some(r=>r.geometryEligibility==='eligible')||
   evaluation.rows.some(r=>r.presence!=='unmounted'&&r.geometryEligibility!=='eligible'&&r.reason!=='fully-clipped'))throw Error('Geometry invalid');
 return snapshot.frame;
}
function checkJourney(journey:CaseJourney,observations:JourneyObservations):void {
 if(!Array.isArray(observations.samples)||observations.samples.length!==2)throw Error('Two original samples required');
 const first=available(observations.samples[0]!),second=available(observations.samples[1]!);
 if(first.phase!=='streaming'||second.phase!=='streaming'||!first.responseProgress.active||!second.responseProgress.active||second.responseProgress.prefix.length<=first.responseProgress.prefix.length)throw Error('No progressing original response');
 if(journey==='follow'){
  if(observations.anchorId!==null||observations.returned!==null||observations.wheel!==null||[first,second].some(f=>!evaluateMountedGeometry(f).rows.some(r=>r.id===f.expectedResponse.id&&r.geometryEligibility==='eligible')))throw Error('Response not geometrically visible');
 }else{
  if(evaluateHistoricalAnchor({schemaVersion:1,anchorId:observations.anchorId,first,second}).status!=='accepted'||observations.returned===null)throw Error('Historical anchor unavailable');
  const returned=available(observations.returned);
  const wheel=observations.wheel;
  if(!wheel||wheel.isTrusted!==true||!Number.isFinite(wheel.deltaY)||wheel.deltaY>=0||!Number.isFinite(wheel.beforeScrollTop)||!Number.isFinite(wheel.afterScrollTop)||wheel.afterScrollTop>=wheel.beforeScrollTop)throw Error('Original native wheel did not move history');
  if(!evaluateMountedGeometry(returned).rows.some(r=>r.id===returned.expectedResponse.id&&r.geometryEligibility==='eligible'))throw Error('Native return did not expose response');
 }
}
/** Supplied-port sequencing only; native/provider/source assertions remain
 * externally qualified. This result never promotes supplied policy flags. */
export async function runMountedConformance(prerequisites:MountedPrerequisites,ports:MountedConformancePorts):Promise<MountedConformanceResult>{
 const cases:CaseRecord[]=[],snapshots:{caseNumber:1|2;snapshot:GeometrySnapshot}[]=[],nativeInputs:{caseNumber:1|2;wheel:JourneyObservations['wheel']}[]=[],cleanupFailures:string[]=[];
 let primaryFailure:string|null=null,connected=false;
 const result=():MountedConformanceResult=>({status:primaryFailure===null&&cleanupFailures.length===0&&cases.length===2?'complete':'incomplete',cases,snapshots,nativeInputs,primaryFailure,cleanupFailures,qualification:false,fps:'unavailable'});
 if(!mountedPrerequisitesAccepted(prerequisites)){primaryFailure='prerequisite';return result();}
 try {
  // Even a rejected connection can own resources. Always call its original close port.
  connected=true;await ports.connect();
  for(const n of [1,2] as const){
   const journey=n===1?'follow':'history-reading';let owner:MountedCaseOwner|undefined,closed=false;
   try {
    owner=await ports.openCase(journey,n);await owner.seed();
    const restored=await owner.restore();snapshots.push({caseNumber:n,snapshot:restored});if(available(restored).phase!=='restored-history')throw Error('Wrong restored phase');
    await owner.startContinuation();const observations=await owner.exercise(journey);
    if(!Array.isArray(observations.samples)||observations.samples.length!==2)throw Error('Bounded original samples required');
    snapshots.push(...observations.samples.map(snapshot=>({caseNumber:n,snapshot})));if(observations.returned)snapshots.push({caseNumber:n,snapshot:observations.returned});
    nativeInputs.push({caseNumber:n,wheel:observations.wheel});checkJourney(journey,observations);
    const final=await owner.complete();snapshots.push({caseNumber:n,snapshot:final});
    const finalFrame=available(final);
    if(finalFrame.phase!=='completed'||!evaluateMountedGeometry(finalFrame).rows.some(r=>r.id===finalFrame.expectedResponse.id&&r.geometryEligibility==='eligible'&&r.textRelation==='exact'))throw Error('Final DOM response incomplete');
    closed=true;const current=await owner.close();
    if(current.caseNumber!==n||current.journey!==journey)throw Error('Case identity mismatch');
    if(snapshots.filter(s=>s.caseNumber===n).some(s=>available(s.snapshot).scopeId!==current.threadId))throw Error('Geometry case scope mismatch');
    const boundary=evaluateMountedClosurePolicy({schemaVersion:1,kind:'case-boundary',priorCase:n===1?null:cases[0],currentCase:current,secondStarted:n===2});
    if(boundary.status!=='accepted')throw Error('Original case closure incomplete');cases.push(current);
   }catch{
    primaryFailure='case-conformance';
    if(owner&&!closed){closed=true;try{await owner.close();}catch{cleanupFailures.push('case-close');}}
    else if(closed)cleanupFailures.push('case-close');
    break;
   }
  }
 }catch{primaryFailure='browser-connect';}
 finally{if(connected)try{await ports.closeClient();}catch{cleanupFailures.push('client-close');}}
 return result();
}
export {checkJourney};
