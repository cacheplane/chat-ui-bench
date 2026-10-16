/** Unscored H100/R6400 conformance. Importing this module allocates no SDK,
 * browser, server, timer or producer; native effects require explicit ports. */
import {evaluateMountedAdmissionPolicy,evaluateMountedModulePolicy,evaluateMountedClosurePolicy,type PreInstallIntent,type PostInstallAdmission,type MountedModuleInput,type CaseRecord,type CaseJourney} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import type {GeometrySnapshot} from '../src/geometry.ts';
import {evaluateMountedGeometry,evaluateHistoricalAnchor} from '../src/geometry-policy.ts';
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
export function createMountedSnapshotReader(journey:CaseJourney,read:()=>Promise<GeometrySnapshot>):()=>Promise<GeometrySnapshot>{
 let calls=0;const limit=journey==='follow'?4:5;
 return async()=>{if(calls===limit)throw Error('Full geometry call budget exhausted');calls++;return read();};
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
