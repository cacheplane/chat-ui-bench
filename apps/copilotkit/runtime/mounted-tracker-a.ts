/** Finite supplied-port pilot; importing this module starts no native work. */
import {checkJourney,type MountedCaseOwner} from './mounted-conformance.ts';
import {evaluateMountedClosurePolicy,type CaseRecord} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {evaluateMountedGeometry,evaluateHistoricalAnchor,type MountedGeometryInput,type HistoricalAnchorEvaluation} from '../src/geometry-policy.ts';
import type {GeometrySnapshot,AnchorPurpose,AnchorProbe} from '../src/geometry.ts';
import type {createMountedTrackerATrace,TrackerAOriginal,TrackerAProfileRef} from './mounted-tracker-a-trace.ts';
type Trace=ReturnType<typeof createMountedTrackerATrace>;
type Original={status:TrackerAOriginal;startedHostMs:number|null;settledHostMs:number|null};
type ListenerOriginal={status:TrackerAOriginal;requestedHostMs:number|null;settledHostMs:number|null};
type ListenerFact={registration:ListenerOriginal;removal:ListenerOriginal;ownedIdentityMatch:boolean|null};
const listenerNames=['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'] as const;
type ListenerName=typeof listenerNames[number];
export interface TrackerAScalar {pageNowMs:number;url:string;sameOriginalScroller:boolean;connected:boolean;uniqueSelector:boolean;innerWidth:number;innerHeight:number;devicePixelRatio:number;rect:{x:number;y:number;width:number;height:number};scrollTop:number;scrollHeight:number;clientHeight:number}

/** Structural page-only ports keep these serialized callbacks in the pure closure. */
interface TrackerAAnchorHost {locators:{scroller:string};readGeometrySnapshot(purpose?:AnchorPurpose):GeometrySnapshot;releaseAnchorDiagnostic(reason:'host'|'url'):void;probeAnchorDiagnostic(selection:Readonly<{id:string;ownerToken:number}>):unknown}
export type TrackerAScalarPurpose=Readonly<{role:'pre'|'before'|'after'|'post';ordinal:number;slot:number|null}>;
export interface TrackerAHandlerGate {slot:number;beforeOrdinal:number;afterOrdinal:number;expectedEventOrdinal:number;state:'armed'|'observed'|'cancelled'|'refused';waitClaimed:boolean;listenerOwnedIdentity:boolean|null;eventOrdinal:number|null;eventPageNowMs:number|null;eventTimeStampMs:number|null;cancellationReason:'listener-remove'|null;refusalCode:'arm-state'|'unexpected-order'|'duplicate-event'|'event-invalid'|'event-copy-invalid'|'source-error'|null}
export interface ScrollCausePageExport {snapshot:unknown;capability:'not-checked'|'same'|'missing'|'changed'|'invalid';host:'not-checked'|'same'|'changed';url:'not-checked'|'same'|'changed';sameScroller:'not-checked'|'same'|'changed';g1:'not-returned'|'raw-returned'}
interface PageAttribution {start():void;marker(purpose:TrackerAScalarPurpose,value:TrackerAScalar):void;export():ScrollCausePageExport}
interface TrackerAAnchorPageState {scalar(purpose?:TrackerAScalarPurpose):TrackerAScalar;attribution?:PageAttribution;anchorContext:{host:TrackerAAnchorHost;url:string;refused:'host'|'url'|null};gate?(purpose:TrackerAScalarPurpose):unknown;waitGate?(purpose:TrackerAScalarPurpose):Promise<void>;confirmGate?(purpose:TrackerAScalarPurpose):void}
type TrackerAAnchorWindow=Window&{__copilotkitBenchHost?:TrackerAAnchorHost;__copilotkitTrackerA?:TrackerAAnchorPageState};
/** Same normal full-read path; diagnostic admission can only disable a lease. */
export function readTrackerAGeometrySnapshot(purpose:AnchorPurpose|undefined):GeometrySnapshot{
 const w=window as TrackerAAnchorWindow,h=w.__copilotkitBenchHost;if(!h)throw Error('Original host absent');
 const returned=(snapshot:GeometrySnapshot)=>{if(purpose==='tracker-a-G1-anchor-diagnostic-v1')try{const escrow=Object.getOwnPropertyDescriptor(w,'__copilotkitTrackerAScrollCause');if(escrow&&'value'in escrow&&!escrow.configurable&&!escrow.writable){const record=Object.getOwnPropertyDescriptors(escrow.value),state=Object.getOwnPropertyDescriptor(w,'__copilotkitTrackerA');if(state&&'value'in state&&record.state?.value===state.value&&Object.getOwnPropertyDescriptor(state.value,'attribution')?.value===record.attribution?.value){const start=Object.getOwnPropertyDescriptor(record.attribution!.value,'start');if(start&&'value'in start&&typeof start.value==='function')start.value.call(record.attribution!.value);}}}catch{}return snapshot;};
 if(purpose){const context=w.__copilotkitTrackerA?.anchorContext;if(context){
  if(h!==context.host||location.href!==context.url){context.refused??=h!==context.host?'host':'url';context.host.releaseAnchorDiagnostic(context.refused);}
  if(context.refused===null)return returned(h.readGeometrySnapshot(purpose));
 }}
 return returned(h.readGeometrySnapshot());
}
/** One cleanup evaluate; operates only on the originally captured capsule. */
export function exportTrackerAScrollCauseDiagnostic():ScrollCausePageExport{
 const w=window as TrackerAAnchorWindow,escrow=Object.getOwnPropertyDescriptor(w,'__copilotkitTrackerAScrollCause');
 if(!escrow||!('value'in escrow)||escrow.configurable||escrow.writable||!Object.isFrozen(escrow.value))throw Error('capability-unavailable');
 const d=Object.getOwnPropertyDescriptors(escrow.value),capsule=d.attribution?.value;
 if(!capsule||!Object.isFrozen(capsule))throw Error('capability-unavailable');
 const method=Object.getOwnPropertyDescriptor(capsule,'export');if(!method||!('value'in method)||typeof method.value!=='function')throw Error('capability-unavailable');
 return method.value.call(capsule) as ScrollCausePageExport;
}

/** Closed evaluate callback: no free value bindings and no SDK work. Raw scalar
 * stays first; malformed observer data cannot invoke getters during transport. */
export async function readTrackerAAnchorScalarEnvelope(request:Readonly<{selection:Readonly<{id:string;ownerToken:number}>|undefined;purpose:TrackerAScalarPurpose}>):Promise<{scalar:TrackerAScalar;anchorDiagnostic:unknown;handlerGate:unknown}>{
 const w=window as TrackerAAnchorWindow,s=w.__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');
 let selection:Readonly<{id:string;ownerToken:number}>|undefined,purpose:TrackerAScalarPurpose|undefined,purposeInvalid=false;
 try{
  {const outer=Object.getOwnPropertyDescriptors(request);if(Reflect.ownKeys(outer).length!==2||!outer.selection||!('value'in outer.selection)||!outer.purpose||!('value'in outer.purpose))throw Error('Scalar request');selection=outer.selection.value;
   const candidate:unknown=outer.purpose.value;if(typeof candidate!=='object'||candidate===null)throw Error('Scalar purpose');const d:PropertyDescriptorMap=Object.getOwnPropertyDescriptors(candidate);if(![Object.prototype,null].includes(Object.getPrototypeOf(candidate))||Reflect.ownKeys(d).length!==3||['role','ordinal','slot'].some(k=>!d[k]||!('value'in d[k]!)))throw Error('Scalar purpose');
   const role=d.role!.value,ordinal=d.ordinal!.value,slot=d.slot!.value;
   // Failed trajectories still take the next post sample; only complete runs reach 82.
   if(!((role==='pre'&&ordinal===1&&slot===null)||(role==='post'&&Number.isInteger(ordinal)&&ordinal>=2&&ordinal<=82&&slot===null)||((role==='before'||role==='after')&&Number.isInteger(slot)&&slot>=0&&slot<40&&ordinal===(role==='before'?2:3)+2*slot)))throw Error('Scalar tuple');purpose={role,ordinal,slot};
  }
 }catch{purposeInvalid=true;}
 if(purpose?.role==='after'){
  const wait=Object.getOwnPropertyDescriptor(s,'waitGate');if(!wait||!('value'in wait)||typeof wait.value!=='function')throw Error('Original gate wait unavailable');await wait.value.call(s,purpose);
  const confirm=Object.getOwnPropertyDescriptor(s,'confirmGate');if(!confirm||!('value'in confirm)||typeof confirm.value!=='function')throw Error('Original gate confirmation unavailable');confirm.value.call(s,purpose);
 }
 const scalar=s.scalar(purpose),pageStartMs=performance.now();let candidate:unknown,sameHostObject:boolean|null=null,sameUrl:boolean|null=null;
 const finish=(anchorDiagnostic:unknown)=>{
  let handlerGate:unknown=null;
  if(purposeInvalid||!purpose)handlerGate={schema:1,purpose:null,status:'invalid',record:null,failure:'gate-copy-invalid'};
  else if(purpose.role==='before'||purpose.role==='after'){
   let source:unknown;
   try{const method=Object.getOwnPropertyDescriptor(s,'gate');if(!method||!('value'in method)||typeof method.value!=='function')throw Error('Gate source unavailable');source=method.value.call(s,purpose);}catch{return {scalar,anchorDiagnostic,handlerGate:{schema:1,purpose,status:'invalid',record:null,failure:'gate-source-error'}};}
   try{
    const own=(value:unknown,keys:string[])=>{if(typeof value!=='object'||value===null||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Gate record');const ds=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(ds).length!==keys.length||Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Gate keys');const out:Record<string,unknown>={};for(const key of keys){const d=ds[key];if(!d||!('value'in d))throw Error('Gate accessor');out[key]=d.value;}return out;};
    const gate=own(source,['schema','purpose','status','record','failure']),p=own(gate.purpose,['role','ordinal','slot']);
    if(gate.schema!==1||p.role!==purpose.role||p.ordinal!==purpose.ordinal||p.slot!==purpose.slot||!['armed','observed','invalid'].includes(gate.status as string)||gate.failure!==null&&!['arm-refused','gate-copy-invalid','gate-source-error'].includes(gate.failure as string))throw Error('Gate envelope');
    let record:Record<string,unknown>|null=null;
    if(gate.record!==null){record=own(gate.record,['slot','beforeOrdinal','afterOrdinal','expectedEventOrdinal','state','waitClaimed','listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs','cancellationReason','refusalCode']);if(Object.values(record).some(v=>v!==null&&typeof v!=='boolean'&&typeof v!=='number'&&typeof v!=='string'||typeof v==='number'&&(!Number.isFinite(v)||JSON.stringify(v).length>32)||typeof v==='string'&&!['armed','observed','refused','cancelled','listener-remove','arm-state','unexpected-order','duplicate-event','event-invalid','event-copy-invalid','source-error'].includes(v)))throw Error('Gate row primitive');}
    if(record){
     const slot=record.slot,tuple=['listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs'],empty=tuple.every(k=>record![k]===null);
     if(typeof slot!=='number'||!Number.isInteger(slot)||slot<0||slot>=40||record.beforeOrdinal!==2+2*slot||record.afterOrdinal!==3+2*slot||record.expectedEventOrdinal!==slot+2||typeof record.waitClaimed!=='boolean')throw Error('Gate row tuple');
     if(!empty&&(typeof record.listenerOwnedIdentity!=='boolean'||typeof record.eventOrdinal!=='number'||!Number.isInteger(record.eventOrdinal)||record.eventOrdinal<1||record.eventOrdinal>41||typeof record.eventPageNowMs!=='number'||typeof record.eventTimeStampMs!=='number'))throw Error('Gate candidate tuple');
     if(record.state==='armed'){if(!empty||record.cancellationReason!==null||record.refusalCode!==null)throw Error('Gate armed row');}
     else if(record.state==='observed'){if(empty||record.listenerOwnedIdentity!==true||record.eventOrdinal!==record.expectedEventOrdinal||record.cancellationReason!==null||record.refusalCode!==null)throw Error('Gate observed row');}
     else if(record.state==='cancelled'){if(!empty||record.cancellationReason!=='listener-remove'||record.refusalCode!==null)throw Error('Gate cancelled row');}
     else if(record.state==='refused'){if(record.cancellationReason!==null||!['arm-state','unexpected-order','duplicate-event','event-invalid','event-copy-invalid','source-error'].includes(record.refusalCode as string))throw Error('Gate refused row');}
     else throw Error('Gate row state');
    }
    if(gate.status==='invalid'){if(gate.failure===null)throw Error('Gate failure absent');}
    else if(gate.failure!==null||!record||record.slot!==purpose.slot||gate.status!==(purpose.role==='before'?'armed':'observed')||record.state!==gate.status||purpose.role==='before'&&record.waitClaimed!==false||purpose.role==='after'&&record.waitClaimed!==true)throw Error('Gate success envelope');
    handlerGate={schema:1,purpose:{role:p.role,ordinal:p.ordinal,slot:p.slot},status:gate.status,record,failure:gate.failure};
   }catch{handlerGate={schema:1,purpose,status:'invalid',record:null,failure:'gate-copy-invalid'};}
  }
  return {scalar,anchorDiagnostic,handlerGate};
 };
 try{
  if(!selection)return finish({contractInvalid:true});
  const context=s.anchorContext;sameHostObject=w.__copilotkitBenchHost===context.host;sameUrl=location.href===context.url;
  if(!sameHostObject||!sameUrl){context.refused??=!sameHostObject?'host':'url';context.host.releaseAnchorDiagnostic(context.refused);}
  candidate=context.host.probeAnchorDiagnostic(selection);
 }catch{candidate={status:'unavailable',reason:'source-error',identity:{sameHostObject:null,sameOwner:null,sameScroller:null,sameScope:null,sameUrl:null,connected:null,uniqueSelectors:null,contained:null,parentMatched:null},ownerToken:null,contentTopCssPx:null,relativeTopCssPx:null,nativeViewportY:null,textRectCount:0,eligible:null,scrollTopAfterProbe:null,nodesVisited:0,rectangleUnits:0,textChars:0};}
 const pageEndMs=performance.now();
 const copy=(value:unknown,keys:readonly string[]):Record<string,unknown>=>{
  if(typeof value!=='object'||value===null||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Diagnostic own record');
  const descriptors=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(descriptors).length!==keys.length||Reflect.ownKeys(descriptors).some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Diagnostic keys');
  const result:Record<string,unknown>={};for(const key of keys){const d=descriptors[key];if(!d||!('value'in d))throw Error('Diagnostic accessor');result[key]=d.value;}return result;
 };
 try{
  const probe=copy(candidate,['status','reason','identity','ownerToken','contentTopCssPx','relativeTopCssPx','nativeViewportY','textRectCount','eligible','scrollTopAfterProbe','nodesVisited','rectangleUnits','textChars']);
  const identity=copy(probe.identity,['sameHostObject','sameOwner','sameScroller','sameScope','sameUrl','connected','uniqueSelectors','contained','parentMatched']);
  const primitive=(v:unknown)=>v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=128||typeof v==='number'&&Number.isFinite(v);
  if(Object.values(identity).some(v=>!primitive(v))||Object.entries(probe).some(([key,v])=>key!=='identity'&&!primitive(v)))throw Error('Diagnostic finite primitive');
  identity.sameHostObject=sameHostObject===false?false:sameHostObject===true?identity.sameHostObject:null;identity.sameUrl=sameUrl;
  return finish({...probe,identity,pageStartMs,pageEndMs});
 }catch{return finish({contractInvalid:true});}
}

export interface TrackerAEntrySample {scalar:TrackerAScalar;active:boolean;prefixLength:number;returnControlVisible:boolean}
type EntryRow=Original&{value:TrackerAEntrySample|null};
export interface TrackerAHistoryOwner {
 /** Original owned topology, without a full collector or one of the82 scalars. */
 baseline:unknown;seed():Promise<void>;restore():Promise<GeometrySnapshot>;acquireTrace():Promise<Trace>;
 listeners:Record<ListenerName,{install():Promise<boolean>;remove():Promise<boolean>}>;
 startContinuation():Promise<void>;waitActivePrefix():Promise<unknown>;geometry(purpose?:AnchorPurpose):Promise<GeometrySnapshot>;
 movePointer(x:number,y:number):Promise<void>;entrySample():Promise<unknown>;scalar(selection:Readonly<{id:string;ownerToken:number}>|undefined,purpose:TrackerAScalarPurpose):Promise<unknown>;wheel(x:0,y:-600|-12):Promise<void>;
 returnToResponse():Promise<void>;
 /** Original canonical EOF/public-idle validation and G4, before disposal. */
 complete():Promise<GeometrySnapshot>;close():Promise<CaseRecord>;observations():unknown|Promise<unknown>;
}
export interface TrackerASequencerPorts {
 profileRef:TrackerAProfileRef;
 /** Explicit supplied-test opt out; the hosted diagnostic profile always enables it. */
 anchorDiagnostic?:boolean;
 clock:{now():number;deadlineHostMs:number;alarm(atHostMs:number,fire:()=>void):()=>void;waitUntil(atHostMs:number):Promise<void>};
 connect():Promise<void>;openFollow():Promise<MountedCaseOwner>;openHistory():Promise<TrackerAHistoryOwner>;closeClient():Promise<void>;
}
type ScalarRow={ordinal:number;role:'pre'|'before'|'after'|'post';slot:number|null;requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;value:TrackerAScalar|null};
type WheelRow={slot:number;nominalHostMs:number;requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;beforeOrdinal:number;afterOrdinal:number|null};
type Checkpoint={status:TrackerAOriginal;requestedHostMs:number|null;settledHostMs:number|null;snapshotRef:{path:'native-case-2.json';index:number}|null};
type TrackerAWheelEvent={ordinal:number;receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;isTrusted:boolean;deltaX:number;deltaY:number;deltaMode:number;targetContained:boolean;currentTargetIsScroller:boolean};
type ScrollEvent={ordinal:number;receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;currentTargetIsScroller:boolean;scrollTop:number;scrollHeight:number;clientHeight:number};
type MotionEvent={ordinal:number;kind:'animationstart'|'transitionrun';receivedHostMs:number;pageNowMs:number;eventTimeStampMs:number;targetContained:boolean};
type Loss={firstHostMs:number;firstOverflowHostMs:number|null};type Overflow={firstHostMs:number;ordinal:number};
type Observations={handlerGates:TrackerAHandlerGate[];wheelEvents:TrackerAWheelEvent[];scrollEvents:ScrollEvent[];motionEvents:MotionEvent[];losses:Record<'navigation'|'context'|'page'|'session',Loss|null>;overflows:Record<'wheel'|'scroll'|'motion',Overflow|null>};
const authority=()=>({qualification:false as const,fps:'unavailable' as const,ratio:'unavailable' as const,scoring:false as const,ranking:false as const});
export interface TrackerAInput extends Observations {
 schemaVersion:2;kind:'tracker-a-case-input';mode:'tracker-json-a-pilot-v2';caseNumber:2;profileRef:TrackerAProfileRef;
 entry:{before:EntryRow;wheel:Original;afterWait:Original;after:EntryRow;settledWait:Original;settled:EntryRow};
 phase:{hostT0Ms:number|null;hostT1Ms:number|null;postBoundaryScalarOrdinal:number|null;postBoundarySettled:TrackerAOriginal;returnClick:Original;captureTail:Original&{targetHostMs:number|null};completion:Original;tail:Original};
 geometryCheckpoints:Record<'G0'|'G1'|'G2'|'G3'|'G4',Checkpoint>;
 anchor:{id:string;ownerToken:number;selectedAtHostMs:number;firstCheckpoint:'G1';secondCheckpoint:'G2';evaluation:HistoricalAnchorEvaluation|null}|null;
 listeners:Record<ListenerName,ListenerFact>;
 pointer:{requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;x:number;y:number}|null;
 scalarObservations:ScalarRow[];wheelRequests:WheelRow[];
 outcome:{phase:{status:'not-started'|'incomplete'|'complete';reason:null|'phase'};competingMotion:'unavailable';scenarioQualification:'unavailable'};authority:ReturnType<typeof authority>;
}
export type TrackerAFirstFailure=Readonly<{code:'unclassified'|'baseline'|'timestamp-reverse'|'opposing-offset'|'end-stop';ordinal:number|null;previousOrdinal:number|null;slot:number|null}>;
export type AnchorObservation=AnchorProbe&{ordinal:number;role:ScalarRow['role'];slot:number|null;pageStartMs:number|null;pageEndMs:number|null;jointReadStable:boolean|null};
export interface TrackerAAnchorDiagnostic {selection:{snapshotRef:{path:'native-case-2.json';index:number};id:string;role:'user'|'assistant';ownerToken:number;metric:'min-positive-text-rect-viewport-y';contentTopCssPx:number;relativeTopCssPx:number;nativeViewportY:number};observations:AnchorObservation[]}
export interface TrackerASequencerResult {status:'complete'|'incomplete';cases:CaseRecord[];caseEvidence:CaseRecord[];snapshots:{caseNumber:1|2;snapshot:GeometrySnapshot}[];input:TrackerAInput|null;transport:ReturnType<Trace['snapshot']>|null;/** Original receipt; child tracker persists this closed-drain witness. */inputDrain:ListenerOriginal;anchorDiagnostic:TrackerAAnchorDiagnostic|null;anchorDiagnosticError:unknown|null;handlerGateError:unknown|null;hasPrimary:boolean;primary:unknown;firstFailure:TrackerAFirstFailure|null;cleanupFailures:unknown[];authority:ReturnType<typeof authority>}
function data(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw Error('Invalid owned data');
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Invalid owned keys');
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw Error('Own data required');result[key]=d.value;}return result;
}
function finite(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Nonfinite scalar');return value;}
function text(value:unknown,cap:number):string{
 if(typeof value!=='string'||value.length>cap)throw Error('Bounded text required');
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Invalid Unicode');}else if(c>=0xdc00&&c<=0xdfff)throw Error('Invalid Unicode');}
 if(new TextEncoder().encode(value).length>cap)throw Error('UTF8 text capacity');return value;
}
function scalar(value:unknown):TrackerAScalar{
 const r=data(value,['pageNowMs','url','sameOriginalScroller','connected','uniqueSelector','innerWidth','innerHeight','devicePixelRatio','rect','scrollTop','scrollHeight','clientHeight']);
 const rect=data(r.rect,['x','y','width','height']);for(const k of ['x','y','width','height'])finite(rect[k]);
 for(const k of ['pageNowMs','innerWidth','innerHeight','devicePixelRatio','scrollTop','scrollHeight','clientHeight'])finite(r[k]);
 for(const k of ['sameOriginalScroller','connected','uniqueSelector'])if(typeof r[k]!=='boolean')throw Error('Invalid identity fact');
 const url=text(r.url,4096),x=rect.x as number,y=rect.y as number,width=rect.width as number,height=rect.height as number;
 const scrollTop=r.scrollTop as number,scrollHeight=r.scrollHeight as number,clientHeight=r.clientHeight as number;
 if(width<0||height<0||scrollHeight<0||clientHeight<=0||scrollHeight<clientHeight||scrollTop<0||scrollTop>scrollHeight-clientHeight)throw Error('Invalid scalar range');
 return {...r,url,rect:{x,y,width,height}} as unknown as TrackerAScalar;
}
const anchorIdentityKeys=['sameHostObject','sameOwner','sameScroller','sameScope','sameUrl','connected','uniqueSelectors','contained','parentMatched'] as const;
function absentAnchor(row:ScalarRow):AnchorObservation{return {ordinal:row.ordinal,role:row.role,slot:row.slot,status:'unavailable',reason:'source-error',pageStartMs:null,pageEndMs:null,identity:{sameHostObject:null,sameOwner:null,sameScroller:null,sameScope:null,sameUrl:null,connected:null,uniqueSelectors:null,contained:null,parentMatched:null},ownerToken:null,contentTopCssPx:null,relativeTopCssPx:null,nativeViewportY:null,textRectCount:0,eligible:null,scrollTopAfterProbe:null,jointReadStable:null,nodesVisited:0,rectangleUnits:0,textChars:0};}
function copyAnchorObservation(value:unknown,row:ScalarRow,token:number):AnchorObservation{
 const r=data(value,['status','reason','pageStartMs','pageEndMs','identity','ownerToken','contentTopCssPx','relativeTopCssPx','nativeViewportY','textRectCount','eligible','scrollTopAfterProbe','nodesVisited','rectangleUnits','textChars']);
 const identity=data(r.identity,anchorIdentityKeys);for(const key of anchorIdentityKeys)if(identity[key]!==null&&typeof identity[key]!=='boolean')throw Error('Diagnostic identity');
 for(const [key,max] of [['textRectCount',256],['nodesVisited',4096],['rectangleUnits',290],['textChars',8192]] as const)integer(r[key],0,max);
 if(r.eligible!==null&&typeof r.eligible!=='boolean')throw Error('Diagnostic eligibility');
 for(const key of ['pageStartMs','pageEndMs'])if(r[key]!==null&&(finite(r[key])<0||(r[key] as number)>360000))throw Error('Diagnostic page time');
 if((r.pageStartMs===null)!==(r.pageEndMs===null)||r.pageStartMs!==null&&((r.pageEndMs as number)<(r.pageStartMs as number)||row.value!==null&&(r.pageStartMs as number)<row.value.pageNowMs))throw Error('Diagnostic page bracket');
 if(r.status==='available'){
  if(r.reason!==null||anchorIdentityKeys.some(k=>identity[k]!==true)||r.ownerToken!==token||r.eligible!==true||r.pageStartMs===null)throw Error('Diagnostic available law');
  for(const key of ['contentTopCssPx','nativeViewportY','scrollTopAfterProbe'])if(Math.abs(finite(r[key]))>1000000)throw Error('Diagnostic coordinate');
  if(finite(r.relativeTopCssPx)!==(r.contentTopCssPx as number)-(r.nativeViewportY as number)||(r.scrollTopAfterProbe as number)<0||r.textRectCount===0)throw Error('Diagnostic metric');
 }else if(r.status!=='unavailable'||r.eligible!==false&&r.eligible!==null||!['admission','selection','owner','host','scroller','scope','url','disconnected','selector','text','style','clip','work','rect','geometry','no-positive','fully-clipped','source-error'].includes(r.reason as string)||['ownerToken','contentTopCssPx','relativeTopCssPx','nativeViewportY','scrollTopAfterProbe'].some(k=>r[k]!==null))throw Error('Diagnostic unavailable law');
 return {...r,identity,ordinal:row.ordinal,role:row.role,slot:row.slot,jointReadStable:row.value!==null&&r.scrollTopAfterProbe!==null?row.value.scrollTop===r.scrollTopAfterProbe:null} as unknown as AnchorObservation;
}
function entrySample(value:unknown):TrackerAEntrySample{
 const r=data(value,['scalar','active','prefixLength','returnControlVisible']);
 return {scalar:scalar(r.scalar),active:boolean(r.active),prefixLength:integer(r.prefixLength,0,6400),returnControlVisible:boolean(r.returnControlVisible)};
}
function frame(snapshot:GeometrySnapshot,phase:MountedGeometryInput['phase']):MountedGeometryInput{
 if(snapshot.status!=='available')throw Error('Geometry unavailable');const f=snapshot.frame,e=evaluateMountedGeometry(f);
 if(e.status!=='evaluated'||f.phase!==phase||!e.rows.some(r=>r.geometryEligibility==='eligible')||e.rows.some(r=>r.presence!=='unmounted'&&r.geometryEligibility!=='eligible'&&r.reason!=='fully-clipped'))throw Error('Geometry invalid');return f;
}
function responseVisible(f:MountedGeometryInput,final=false){if(!evaluateMountedGeometry(f).rows.some(r=>r.id===f.expectedResponse.id&&r.geometryEligibility==='eligible'&&(!final||r.textRelation==='exact')))throw Error('Response not visible');}

/** Supplied data only; fixed pilot admission belongs before the native entry's
 * SDK import. No supplied prerequisite flag authorizes or qualifies this run. */
export async function runMountedTrackerA(ports:TrackerASequencerPorts):Promise<TrackerASequencerResult>{
 const cases:CaseRecord[]=[],caseEvidence:CaseRecord[]=[],snapshots:TrackerASequencerResult['snapshots']=[],cleanupFailures:unknown[]=[];
 const inputDrain:ListenerOriginal={status:'not-started',requestedHostMs:null,settledHostMs:null};
 let hasPrimary=false,primary:unknown,input:TrackerAInput|null=null,trace:Trace|null=null,transport:TrackerASequencerResult['transport']=null,connected=false,lastNow=-Infinity;
 let traceFinish:Promise<void>|null=null;
 const finishTrace=()=>{if(traceFinish===null){try{traceFinish=trace!.finish();}catch(error){traceFinish=Promise.reject(error);}}return traceFinish;};
 let clockInvalid=false,clockFailure:unknown;
 let firstFailure:TrackerAFirstFailure|null=null;
 let anchorDiagnostic:TrackerAAnchorDiagnostic|null=null,anchorDiagnosticError:unknown|null=null,handlerGateError:unknown|null=null;
 let returnedResult:TrackerASequencerResult|null=null;
 const remember=(error:unknown,witness:TrackerAFirstFailure={code:'unclassified',ordinal:null,previousOrdinal:null,slot:null})=>{if(!hasPrimary){hasPrimary=true;primary=error;firstFailure=Object.freeze({...witness});}};
 const scalarFailure=(code:Exclude<TrackerAFirstFailure['code'],'unclassified'>,message:string,row:ScalarRow|null=null,previousOrdinal:number|null=null):never=>{const error=Error(message);remember(error,{code,ordinal:row?.ordinal??null,previousOrdinal,slot:row?.slot??null});throw error;};
 const now=()=>{
  if(clockInvalid)throw clockFailure;
  try{
   const n=finite(ports.clock.now());
   if(n<lastNow)throw Error('Host clock reversed');
   lastNow=n;return n;
  }catch(error){
   clockInvalid=true;clockFailure=error;
   if(input)input.outcome.phase={status:'incomplete',reason:'phase'};
   throw error;
  }
 };
 const deadline=ports.clock.deadlineHostMs;
 function bounded<T>(work:Promise<T>,requestedLimit=deadline):Promise<T>{const limit=Math.min(requestedLimit,deadline);return new Promise((resolve,reject)=>{
  let done=false,cancel=()=>{};
  const fail=()=>{if(!done){done=true;reject(Error('Original settlement boundary exceeded'));}};
  void work.then(value=>{
   if(done)return;
   try{
    if(now()>=limit){fail();return;}
    done=true;cancel();resolve(value);
   }catch(error){done=true;cancel();reject(error);}
  },error=>{if(done)return;done=true;cancel();reject(error);});
  try{if(now()>=limit)fail();else cancel=ports.clock.alarm(limit,fail);}catch(e){done=true;reject(e);}
 });}
 function check(limit=deadline){const at=now();if(at>=limit)throw Error('Original deadline unavailable');return at;}
 function dispatch<T>(call:()=>Promise<T>):Promise<T>{check();let work:Promise<T>;try{work=Promise.resolve(call());}catch(e){work=Promise.reject(e);}return bounded(work);}
 function invoke<T>(call:()=>Promise<T>,row:{status:TrackerAOriginal;settledHostMs:number|null;requestedHostMs?:number|null;startedHostMs?:number|null},limit=deadline){
  const at=check(Math.min(limit,deadline));
  if('requestedHostMs'in row)row.requestedHostMs=at;
  if('startedHostMs'in row)row.startedHostMs=at;
  row.status='pending';let original:Promise<T>;try{original=Promise.resolve(call());}catch(e){original=Promise.reject(e);}
  const settled=()=>{if(input?.scalarObservations.some(s=>s===row&&s.role==='post'))input.phase.postBoundarySettled=row.status;};
  const observed=original.then(value=>{
   row.status='fulfilled';
   try{row.settledHostMs=now();}catch(error){remember(error);}
   // Preserve the actual fulfilled value for its independent bounded copier,
   // even when timing qualification has permanently refused further work.
   settled();return value;
  },error=>{
   // The original rejection is known before its optional receipt-clock read.
   // A failed clock observation must not replace null/undefined originals.
   row.status='rejected';remember(error);
   try{row.settledHostMs=now();}
   catch{if(input)input.outcome.phase={status:'incomplete',reason:'phase'};}
   settled();throw error;
  });
  return {original:observed,wait:bounded(observed,limit)};
 }
 const original=():Original=>({status:'not-started',startedHostMs:null,settledHostMs:null});
 const wait=async(at:number)=>{if(!Number.isFinite(at)||at>=deadline)throw Error('Original deadline unavailable');await dispatch(()=>ports.clock.waitUntil(at));if(now()<at)throw Error('Early host wake');};
 async function captureTail(){
  const row=input?.phase.captureTail;
  if(!row||row.targetHostMs===null||row.status!=='not-started')throw Error('Original capture tail unavailable');
  const target=row.targetHostMs;
  await invoke(async()=>{await wait(target);if(now()>=target+50)throw Error('Late capture wake');},row,target+50).wait;
 }
 async function close(owner:{close():Promise<CaseRecord>},n:1|2,caseSnapshots:GeometrySnapshot[],semantic=true){
  const current=await dispatch(()=>owner.close());caseEvidence.push(current);
  if(current.caseNumber!==n||current.journey!==(n===1?'follow':'history-reading')||caseSnapshots.some(s=>s.status!=='available'||s.frame.scopeId!==current.threadId)||evaluateMountedClosurePolicy({schemaVersion:1,kind:'case-boundary',priorCase:n===1?null:cases[0],currentCase:current,secondStarted:n===2}).status!=='accepted')throw Error('Original case boundary incomplete');if(semantic)cases.push(current);
 }
 try{
  finite(deadline);now();const p=data(ports.profileRef,['path','bytes','sha256']);if(p.path!=='tracker-a-profile.json'||!Number.isSafeInteger(p.bytes)||typeof p.bytes!=='number'||p.bytes<0||p.bytes>16384||typeof p.sha256!=='string'||!/^[0-9a-f]{64}$/.test(p.sha256))throw Error('Invalid profile reference');
  check();connected=true;await dispatch(()=>ports.connect());
  let follow:MountedCaseOwner|undefined,followClosed=false;const firstSnapshots:GeometrySnapshot[]=[];
  try{
   const f=await dispatch(()=>ports.openFollow());follow=f;
   await dispatch(()=>f.seed());
   const restored=await dispatch(()=>f.restore());
   firstSnapshots.push(restored);frame(restored,'restored-history');
   await dispatch(()=>f.startContinuation());
   const observations=await dispatch(()=>f.exercise('follow'));
   checkJourney('follow',observations);firstSnapshots.push(...observations.samples);
   const completed=await dispatch(()=>f.complete());
   firstSnapshots.push(completed);responseVisible(frame(completed,'completed'),true);
   followClosed=true;await close(f,1,firstSnapshots);
  }catch(error){remember(error);throw error;}
  finally{
   snapshots.push(...firstSnapshots.map(snapshot=>({caseNumber:1 as const,snapshot})));
   if(follow&&!followClosed){followClosed=true;try{await close(follow,1,firstSnapshots,false);}catch(error){cleanupFailures.push(error);}}
  }
  let owner:TrackerAHistoryOwner|undefined,closed=false,semanticComplete=false,inputAcquired=false;const secondSnapshots:GeometrySnapshot[]=[];
  try{
   const h=await dispatch(()=>ports.openHistory());owner=h;
   const checkpoint=():Checkpoint=>({status:'not-started',requestedHostMs:null,settledHostMs:null,snapshotRef:null});
   const listener=():ListenerFact=>({registration:{status:'not-started',requestedHostMs:null,settledHostMs:null},removal:{status:'not-started',requestedHostMs:null,settledHostMs:null},ownedIdentityMatch:null});
   input={schemaVersion:2,kind:'tracker-a-case-input',mode:'tracker-json-a-pilot-v2',caseNumber:2,profileRef:{path:'tracker-a-profile.json',bytes:p.bytes,sha256:p.sha256},entry:{before:{...original(),value:null},wheel:original(),afterWait:original(),after:{...original(),value:null},settledWait:original(),settled:{...original(),value:null}},phase:{hostT0Ms:null,hostT1Ms:null,postBoundaryScalarOrdinal:null,postBoundarySettled:'not-started',returnClick:original(),captureTail:{...original(),targetHostMs:null},completion:original(),tail:original()},geometryCheckpoints:{G0:checkpoint(),G1:checkpoint(),G2:checkpoint(),G3:checkpoint(),G4:checkpoint()},anchor:null,listeners:{wheel:listener(),scroll:listener(),animationstart:listener(),transitionrun:listener(),navigation:listener(),contextClose:listener(),pageClose:listener()},pointer:null,scalarObservations:[],wheelRequests:[],handlerGates:[],wheelEvents:[],scrollEvents:[],motionEvents:[],losses:{navigation:null,context:null,page:null,session:null},overflows:{wheel:null,scroll:null,motion:null},outcome:{phase:{status:'not-started',reason:null},competingMotion:'unavailable',scenarioQualification:'unavailable'},authority:authority()};const current=input;
   async function geometry(name:keyof TrackerAInput['geometryCheckpoints'],call:()=>Promise<GeometrySnapshot>,phase:MountedGeometryInput['phase']){
    check();const row=current.geometryCheckpoints[name];
    if(row.status!=='not-started')throw Error('Checkpoint already charged');
    const shot=await invoke(call,row).wait;
    const index=secondSnapshots.length;
    secondSnapshots.push(shot);row.snapshotRef={path:'native-case-2.json',index};
    return frame(shot,phase);
   }
   await dispatch(()=>h.seed());await geometry('G0',()=>h.restore(),'restored-history');const baseline=scalar(h.baseline);
   const guard=(s:TrackerAScalar,row:ScalarRow|null=null,previousOrdinal:number|null=null)=>{if(!s.sameOriginalScroller||!s.connected||!s.uniqueSelector||s.innerWidth!==1280||s.innerHeight!==800||s.devicePixelRatio!==1||s.url!==baseline.url||Object.keys(s.rect).some(k=>s.rect[k as keyof typeof s.rect]!==baseline.rect[k as keyof typeof baseline.rect]))scalarFailure('baseline','Original scalar baseline changed',row,previousOrdinal);};
   guard(baseline);if(baseline.rect.width<=0||baseline.rect.height<=0||baseline.rect.x<0||baseline.rect.y<0||baseline.rect.x+baseline.rect.width>1280||baseline.rect.y+baseline.rect.height>800)throw Error('Pointer outside original viewport');
   trace=await dispatch(()=>h.acquireTrace());
   for(const name of listenerNames){
    check();const fact=current.listeners[name];
    const match=await invoke(()=>owner!.listeners[name].install(),fact.registration).wait;
    fact.ownedIdentityMatch=match===true;
    if(match!==true)throw Error('Listener ownership mismatch');
   }
   await dispatch(()=>h.startContinuation());
   const progress=data(await dispatch(()=>h.waitActivePrefix()),['active','prefixLength']);
   if(progress.active!==true||typeof progress.prefixLength!=='number'||!Number.isSafeInteger(progress.prefixLength)||progress.prefixLength<=0||progress.prefixLength>6400)throw Error('No original public advancement');
   const pointer={requestedHostMs:now(),settledHostMs:null as number|null,status:'not-started' as TrackerAOriginal,x:baseline.rect.x+baseline.rect.width/2,y:baseline.rect.y+baseline.rect.height/2};
   await invoke(()=>{current.pointer=pointer;return owner!.movePointer(pointer.x,pointer.y);},pointer).wait;
   async function sampleEntry(row:EntryRow,limit=deadline){
    const op=invoke(()=>owner!.entrySample(),row,limit);
    const retained=op.original.then(value=>{row.value=entrySample(value);return row.value;});
    void retained.catch(()=>{});void op.wait.catch(()=>{});
    const s=await bounded(retained,limit);guard(s.scalar);
    if(!s.active||s.prefixLength<=0)throw Error('Inactive original entry');return s;
   }
   const entryBefore=await sampleEntry(current.entry.before);
   await invoke(()=>owner!.wheel(0,-600),current.entry.wheel).wait;
   const entryAt=current.entry.wheel.settledHostMs!;
   const entryWait=(row:Original,target:number,upper:number)=>invoke(async()=>{await wait(target);if(now()>=upper)throw Error('Late entry wake');},row,upper).wait;
   await entryWait(current.entry.afterWait,entryAt+100,entryAt+200);
   const entryAfter=await sampleEntry(current.entry.after,entryAt+200);
   await entryWait(current.entry.settledWait,entryAt+200,entryAt+300);
   const entrySettled=await sampleEntry(current.entry.settled,entryAt+300);
   if(entryBefore.scalar.pageNowMs>=entryAfter.scalar.pageNowMs||entryAfter.scalar.pageNowMs>=entrySettled.scalar.pageNowMs||entrySettled.scalar.pageNowMs-entryAfter.scalar.pageNowMs<50||entryAfter.scalar.scrollTop>=entryBefore.scalar.scrollTop||entrySettled.scalar.scrollTop!==entryAfter.scalar.scrollTop||entryAfter.prefixLength<=entryBefore.prefixLength||entrySettled.prefixLength<=entryAfter.prefixLength||!entryAfter.returnControlVisible||!entrySettled.returnControlVisible||entrySettled.scalar.scrollHeight-entrySettled.scalar.clientHeight-entrySettled.scalar.scrollTop<entrySettled.scalar.clientHeight/2)throw Error('Original history entry unsettled');
   check();await trace.start();await wait(now()+500);
   const first=await geometry('G1',()=>owner!.geometry(ports.anchorDiagnostic?'tracker-a-G1-anchor-diagnostic-v1':undefined),'streaming');
   if(!first.responseProgress.active||first.responseProgress.prefix.length===0)throw Error('Inactive original streaming');
   const anchor=evaluateMountedGeometry(first).rows.find(r=>r.id!==first.expectedResponse.id&&r.geometryEligibility==='eligible');
   if(!anchor||anchor.ownerToken===null)throw Error('Historical anchor unavailable');
   const selectedAnchor={id:anchor.id,ownerToken:anchor.ownerToken};
   current.anchor={id:anchor.id,ownerToken:anchor.ownerToken,selectedAtHostMs:now(),firstCheckpoint:'G1',secondCheckpoint:'G2',evaluation:null};
   if(ports.anchorDiagnostic)anchorDiagnostic={selection:{snapshotRef:{path:'native-case-2.json',index:current.geometryCheckpoints.G1.snapshotRef!.index},id:anchor.id,role:anchor.role,ownerToken:anchor.ownerToken,metric:'min-positive-text-rect-viewport-y',contentTopCssPx:anchor.contentTopCssPx!,relativeTopCssPx:anchor.relativeTopCssPx!,nativeViewportY:first.nativeViewport.y},observations:[]};
   let priorScalar:TrackerAScalar|null=null,priorScalarOrdinal:number|null=null;
   function observe(role:ScalarRow['role'],slot:number|null,limit=deadline){
    check(Math.min(limit,deadline));if(current.scalarObservations.length>=82)throw Error('Scalar capacity');
    const row:ScalarRow={ordinal:current.scalarObservations.length+1,role,slot,requestedHostMs:now(),settledHostMs:null,status:'not-started',value:null};
    const op=invoke(()=>{
     current.scalarObservations.push(row);
     if(role==='post'){current.phase.postBoundaryScalarOrdinal=row.ordinal;current.phase.postBoundarySettled='pending';}
     return owner!.scalar(ports.anchorDiagnostic?selectedAnchor:undefined,{role,ordinal:row.ordinal,slot});
    },row,limit);
    let diagnostic:unknown,diagnosticReceived=false,checkedFinished=false;
    const retained=op.original.then(value=>{
     {
      // The original scalar descriptor is copied independently. New diagnostic
      // keys/getters cannot reject this original promise or replace its guard.
      const descriptor=typeof value==='object'&&value!==null?Object.getOwnPropertyDescriptor(value,'scalar'):undefined;
      if(!descriptor||!('value'in descriptor))throw Error('Original scalar data required');row.value=scalar(descriptor.value);diagnostic=value;diagnosticReceived=true;
     }return row.value;
    });
    void retained.catch(()=>{});void op.wait.catch(()=>{});
    const refreshGate=()=>{
     if(!diagnosticReceived)return;
     try{if(typeof diagnostic!=='object'||diagnostic===null)throw Error('Gate envelope');const keys=Reflect.ownKeys(diagnostic);if(keys.length!==3||keys.some(k=>!['scalar','anchorDiagnostic','handlerGate'].includes(k as string)))throw Error('Gate envelope keys');const gate=Object.getOwnPropertyDescriptor(diagnostic,'handlerGate');if(!gate||!('value'in gate))throw Error('Gate envelope accessor');copyHandlerGateEnvelope(gate.value,{role,ordinal:row.ordinal,slot});}
     catch{handlerGateError??=Error('Wheel handler gate contract failed');if(returnedResult)returnedResult.handlerGateError=handlerGateError;}
    };
    const refreshDiagnostic=()=>{
     if(anchorDiagnostic){let observation=absentAnchor(row);if(diagnosticReceived)try{const envelope=data(diagnostic,['scalar','anchorDiagnostic','handlerGate']);observation=copyAnchorObservation(envelope.anchorDiagnostic,row,selectedAnchor.ownerToken);}catch{anchorDiagnosticError??=Error('Anchor diagnostic contract failed');if(returnedResult)returnedResult.anchorDiagnosticError=anchorDiagnosticError;}const index=anchorDiagnostic.observations.findIndex(r=>r.ordinal===row.ordinal);if(index<0)anchorDiagnostic.observations.push(observation);else anchorDiagnostic.observations[index]=observation;}
    };
    // A late original still owns its actual page probe. Updating its existing
    // ordinal adds no wait/retry and never re-runs the original strict guard.
    void retained.then(()=>{if(checkedFinished){refreshGate();refreshDiagnostic();}},()=>{if(checkedFinished){refreshGate();refreshDiagnostic();}});
    const checked=async()=>{try{const s=await bounded(retained,limit);guard(s,row,priorScalarOrdinal);if(priorScalar!==null){if(s.pageNowMs<priorScalar.pageNowMs)scalarFailure('timestamp-reverse','Opposing or reversed scalar',row,priorScalarOrdinal);if(s.scrollTop>priorScalar.scrollTop)scalarFailure('opposing-offset','Opposing or reversed scalar',row,priorScalarOrdinal);}if(role!=='pre'&&s.scrollTop===0)scalarFailure('end-stop','Observed end stop',row,priorScalarOrdinal);priorScalar=s;priorScalarOrdinal=row.ordinal;refreshGate();if(handlerGateError)throw handlerGateError;return s;}finally{
      checkedFinished=true;refreshGate();refreshDiagnostic();
    }};return {row,original:retained,wait:checked()};
   }
   const pre=await observe('pre',null).wait;
   if(pre.pageNowMs<entrySettled.scalar.pageNowMs||pre.scrollHeight-pre.clientHeight-pre.scrollTop<pre.clientHeight/2)throw Error('Original history detached pre unavailable');
   const t0=now(),t1=t0+2000;current.phase.hostT0Ms=t0;current.phase.hostT1Ms=t1;current.phase.captureTail.targetHostMs=t1+2000;current.outcome.phase={status:'incomplete',reason:'phase'};
   let slotFailure=false,pending:Promise<unknown>|null=null;
   try{
    for(let slot=0;slot<40;slot++){
     const lower=t0+50*slot,upper=lower+50;
     await wait(lower);
     if(now()<lower||now()>=upper)throw Error('Missed absolute slot');
     const before=observe('before',slot,upper);
     pending=before.original;await before.wait;pending=null;
     if(now()>=upper)throw Error('Before outside slot');
     const row:WheelRow={slot,nominalHostMs:lower,requestedHostMs:now(),settledHostMs:null,status:'not-started',beforeOrdinal:before.row.ordinal,afterOrdinal:null};
     const wheel=invoke(()=>{current.wheelRequests.push(row);return owner!.wheel(0,-12);},row,upper);
     pending=wheel.original;await wheel.wait;pending=null;
     if(now()>=upper)throw Error('Wheel outside slot');
     const after=observe('after',slot,upper);row.afterOrdinal=after.row.ordinal;
     pending=after.original;await after.wait;pending=null;
    }
   }catch(error){slotFailure=true;remember(error);}
   // Keep t1 fixed after an early failure. A pending original is still owned,
   // and post is forbidden until its actual outcome is safely accounted for.
   await wait(t1);
   if(pending!==null){
    try{await bounded(pending);}
    catch(error){
     remember(error);
     if(current.scalarObservations.some(row=>row.status==='pending')||current.wheelRequests.some(row=>row.status==='pending'))throw error;
    }
   }
   const post=observe('post',null);
   try{const s=await post.wait;if(s.scrollTop>=pre.scrollTop)throw Error('No net upward movement');}
   finally{current.phase.postBoundarySettled=post.row.status;}
   const second=await geometry('G2',()=>owner!.geometry(),'streaming');
   current.anchor.evaluation=evaluateHistoricalAnchor({schemaVersion:1,anchorId:current.anchor.id,first,second});
   if(current.anchor.evaluation.status!=='accepted')throw Error('Historical comparison unavailable');
   await invoke(()=>owner!.returnToResponse(),current.phase.returnClick).wait;
   responseVisible(await geometry('G3',()=>owner!.geometry(),'streaming'));
   const captureTarget=current.phase.captureTail.targetHostMs!;
   await captureTail();
   check(captureTarget+50);await finishTrace();
   const finalFrame=await geometry('G4',()=>{
    const completion=invoke(()=>owner!.complete(),current.phase.completion);
    void completion.wait.catch(()=>{});
    return completion.original;
   },'completed');
   responseVisible(finalFrame,true);semanticComplete=true;
   await invoke(()=>wait(current.phase.tail.startedHostMs!+2000),current.phase.tail).wait;
   if(!slotFailure)current.outcome.phase={status:'complete',reason:null};
  }catch(e){remember(e);}finally{
   // Preserve the fixed capture tail after a semantic refusal. Do not retry a
   // charged wait, overlap an unresolved native original, or delay trace closure
   // after the clock/deadline refuses the original target. This never completes
   // the missing scenario work or changes the remembered primary failure.
   if(trace&&traceFinish===null&&input&&input.phase.captureTail.targetHostMs!==null&&input.phase.captureTail.status==='not-started'
     &&!input.scalarObservations.some(row=>row.status==='pending')&&!input.wheelRequests.some(row=>row.status==='pending')
     &&!Object.values(input.geometryCheckpoints).some(row=>row.status==='pending')&&input.phase.returnClick.status!=='pending'&&input.phase.completion.status!=='pending'){
    try{await captureTail();}catch(e){remember(e);cleanupFailures.push(e);}
   }
   if(trace){try{await finishTrace();}catch(e){remember(e);cleanupFailures.push(e);}try{transport=trace.snapshot();if(transport.outcome.capture.status!=='complete'||transport.outcome.containment!=='verified')remember(Error('Trace closure incomplete'));}catch(e){remember(e);}}
   if(owner&&input){
    for(const name of listenerNames){
     const fact=input.listeners[name];
     if(fact.registration.status==='not-started')continue;
     try{
      check();const match=await invoke(()=>owner!.listeners[name].remove(),fact.removal).wait;
      if(match!==true){fact.ownedIdentityMatch=false;throw Error('Listener removal identity mismatch');}
     }catch(error){
      remember(error);cleanupFailures.push(error);
      input.outcome.phase={status:'incomplete',reason:'phase'};
     }
    }
    try{
     // One separately owned drain follows every listener removal attempt.
     // Await the actual drain, including its original rejection identity.
     if(inputDrain.status!=='not-started')throw Error('Original input drain already charged');
     const drain=invoke(()=>Promise.resolve(owner!.observations()),inputDrain);
     const drained=await drain.wait;
     Object.assign(input,copyObservations(drained));inputAcquired=true;
     checkObservations(input);
    }catch(error){remember(error);input.outcome.phase={status:'incomplete',reason:'phase'};}
    if(transport?.sessionClose.timing==='unexpected-loss'){
     const s=transport.sessionClose;
     input.losses.session=s.firstHostMs===null?null:{firstHostMs:s.firstHostMs,firstOverflowHostMs:s.overflowHostMs};
     input.outcome.phase={status:'incomplete',reason:'phase'};
    }
   }
   snapshots.push(...secondSnapshots.map(snapshot=>({caseNumber:2 as const,snapshot})));if(owner&&!closed){closed=true;try{await close(owner,2,secondSnapshots,semanticComplete&&inputAcquired);}catch(e){remember(e);cleanupFailures.push(e);}}
  }
 }catch(e){remember(e);}finally{if(connected)try{await dispatch(()=>ports.closeClient());}catch(e){if(!hasPrimary)remember(e);cleanupFailures.push(e);}}
 returnedResult={status:!hasPrimary&&cleanupFailures.length===0&&cases.length===2?'complete':'incomplete',cases,caseEvidence,snapshots,input,transport,inputDrain,anchorDiagnostic,anchorDiagnosticError,handlerGateError,hasPrimary,primary,firstFailure,cleanupFailures,authority:authority()};return returnedResult;
}
function dense(value:unknown,cap:number):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw Error('Dense population required');const d=Object.getOwnPropertyDescriptor(value,'length');if(!d||!('value'in d)||!Number.isSafeInteger(d.value)||d.value<0||d.value>cap)throw Error('Population capacity');
 if(Reflect.ownKeys(value).length!==d.value+1)throw Error('Dense population keys');const result:unknown[]=[];for(let i=0;i<d.value;i++){const row=Object.getOwnPropertyDescriptor(value,String(i));if(!row||!('value'in row))throw Error('Own population entry');result.push(row.value);}return result;
}
function integer(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER):number{const n=finite(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid integer');return n;}
function boolean(value:unknown):boolean{if(typeof value!=='boolean')throw Error('Invalid boolean');return value;}
function copyHandlerGate(value:unknown):TrackerAHandlerGate{
 const r=data(value,['slot','beforeOrdinal','afterOrdinal','expectedEventOrdinal','state','waitClaimed','listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs','cancellationReason','refusalCode']);
 const slot=integer(r.slot,0,39);if(r.beforeOrdinal!==2+2*slot||r.afterOrdinal!==3+2*slot||r.expectedEventOrdinal!==slot+2)throw Error('Gate ordinal tuple');boolean(r.waitClaimed);
 const keys=['listenerOwnedIdentity','eventOrdinal','eventPageNowMs','eventTimeStampMs'] as const,empty=keys.every(k=>r[k]===null);
 if(!empty){boolean(r.listenerOwnedIdentity);integer(r.eventOrdinal,1,41);for(const k of ['eventPageNowMs','eventTimeStampMs'] as const){finite(r[k]);if(JSON.stringify(r[k]).length>32)throw Error('Gate numeric width');}}
 if(r.state==='armed'){if(!empty||r.cancellationReason!==null||r.refusalCode!==null)throw Error('Gate armed law');}
 else if(r.state==='observed'){if(empty||r.listenerOwnedIdentity!==true||r.eventOrdinal!==r.expectedEventOrdinal||r.cancellationReason!==null||r.refusalCode!==null)throw Error('Gate observed law');}
 else if(r.state==='cancelled'){if(!empty||r.cancellationReason!=='listener-remove'||r.refusalCode!==null)throw Error('Gate cancellation law');}
 else if(r.state==='refused'){if(r.cancellationReason!==null||!['arm-state','unexpected-order','duplicate-event','event-invalid','event-copy-invalid','source-error'].includes(r.refusalCode as string))throw Error('Gate refusal law');}
 else throw Error('Gate state');
 if(new TextEncoder().encode(JSON.stringify(r)).length>340)throw Error('Gate row width');return r as unknown as TrackerAHandlerGate;
}
function copyHandlerGateEnvelope(value:unknown,purpose:TrackerAScalarPurpose):void{
 if(purpose.role==='pre'||purpose.role==='post'){if(value!==null)throw Error('Unmeasured gate');return;}
 const r=data(value,['schema','purpose','status','record','failure']),p=data(r.purpose,['role','ordinal','slot']);
 if(r.schema!==1||p.role!==purpose.role||p.ordinal!==purpose.ordinal||p.slot!==purpose.slot)throw Error('Gate envelope purpose');
 const row=r.record===null?null:copyHandlerGate(r.record);
 if(r.status==='invalid'){if(!['arm-refused','gate-copy-invalid','gate-source-error'].includes(r.failure as string))throw Error('Gate invalid evidence');throw Error('Gate refused');}
 if(r.failure!==null||!row||row.slot!==purpose.slot||r.status!==(purpose.role==='before'?'armed':'observed')||row.state!==r.status||purpose.role==='before'&&row.waitClaimed||purpose.role==='after'&&!row.waitClaimed)throw Error('Gate envelope state');
}
function copyObservations(value:unknown):Observations {
 const r=data(value,['handlerGates','wheelEvents','scrollEvents','motionEvents','losses','overflows']);
 // All populations are preflighted before walking or copying any entry.
 const gates=dense(r.handlerGates,40),wheels=dense(r.wheelEvents,41),scrolls=dense(r.scrollEvents,256),motions=dense(r.motionEvents,32),loss=data(r.losses,['navigation','context','page','session']),over=data(r.overflows,['wheel','scroll','motion']);
 const base=(row:Record<string,unknown>)=>({ordinal:integer(row.ordinal,1),receivedHostMs:finite(row.receivedHostMs),pageNowMs:finite(row.pageNowMs),eventTimeStampMs:finite(row.eventTimeStampMs)});
 const wheelEvents=wheels.map(value=>{const row=data(value,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','isTrusted','deltaX','deltaY','deltaMode','targetContained','currentTargetIsScroller']);return {...base(row),isTrusted:boolean(row.isTrusted),deltaX:finite(row.deltaX),deltaY:finite(row.deltaY),deltaMode:finite(row.deltaMode),targetContained:boolean(row.targetContained),currentTargetIsScroller:boolean(row.currentTargetIsScroller)};});
 const scrollEvents=scrolls.map(value=>{const row=data(value,['ordinal','receivedHostMs','pageNowMs','eventTimeStampMs','currentTargetIsScroller','scrollTop','scrollHeight','clientHeight']);const scrollTop=finite(row.scrollTop),scrollHeight=finite(row.scrollHeight),clientHeight=finite(row.clientHeight);if(clientHeight<=0||scrollHeight<clientHeight||scrollTop<0||scrollTop>scrollHeight-clientHeight)throw Error('Scroll event range');return {...base(row),currentTargetIsScroller:boolean(row.currentTargetIsScroller),scrollTop,scrollHeight,clientHeight};});
 const motionEvents=motions.map(value=>{const row=data(value,['ordinal','kind','receivedHostMs','pageNowMs','eventTimeStampMs','targetContained']);if(row.kind!=='animationstart'&&row.kind!=='transitionrun')throw Error('Motion kind');return {...base(row),kind:row.kind,targetContained:boolean(row.targetContained)};});
 const losses:Observations['losses']={navigation:null,context:null,page:null,session:null};for(const key of ['navigation','context','page','session'] as const){if(loss[key]===null)continue;const row=data(loss[key],['firstHostMs','firstOverflowHostMs']),firstHostMs=finite(row.firstHostMs),firstOverflowHostMs=row.firstOverflowHostMs===null?null:finite(row.firstOverflowHostMs);if(firstOverflowHostMs!==null&&firstOverflowHostMs<firstHostMs)throw Error('Reversed loss');losses[key]={firstHostMs,firstOverflowHostMs};}
 const overflows:Observations['overflows']={wheel:null,scroll:null,motion:null};for(const key of ['wheel','scroll','motion'] as const){if(over[key]===null)continue;const row=data(over[key],['firstHostMs','ordinal']);overflows[key]={firstHostMs:finite(row.firstHostMs),ordinal:integer(row.ordinal,key==='wheel'?42:key==='scroll'?257:33,key==='wheel'?42:key==='scroll'?257:33)};}
 return {handlerGates:gates.map(copyHandlerGate),wheelEvents,scrollEvents,motionEvents:motionEvents as MotionEvent[],losses,overflows};
}
function checkObservations(input:TrackerAInput):void {
 if(input.handlerGates.length!==40)throw Error('Gate coverage incomplete');
 for(const [slot,gate] of input.handlerGates.entries()){
  if(gate.slot!==slot||gate.state!=='observed'||!gate.waitClaimed)throw Error('Gate completion unavailable');
  const event=input.wheelEvents.find(e=>e.ordinal===gate.eventOrdinal),before=input.scalarObservations.find(s=>s.ordinal===gate.beforeOrdinal),after=input.scalarObservations.find(s=>s.ordinal===gate.afterOrdinal);
  if(!event||event.ordinal!==gate.expectedEventOrdinal||event.currentTargetIsScroller!==gate.listenerOwnedIdentity||event.pageNowMs!==gate.eventPageNowMs||event.eventTimeStampMs!==gate.eventTimeStampMs||!before?.value||!after?.value||event.pageNowMs<before.value.pageNowMs||event.pageNowMs>after.value.pageNowMs)throw Error('Gate event join unavailable');
 }
 for(const population of [input.wheelEvents,input.scrollEvents,input.motionEvents]){let lastHost=-Infinity,lastPage=-Infinity,lastEvent=-Infinity;for(let i=0;i<population.length;i++){const row=population[i]!;if(row.ordinal!==i+1||row.eventTimeStampMs<0||row.eventTimeStampMs>row.pageNowMs||row.receivedHostMs<lastHost||row.pageNowMs<lastPage||row.eventTimeStampMs<lastEvent)throw Error('Observation ordering unavailable');lastHost=row.receivedHostMs;lastPage=row.pageNowMs;lastEvent=row.eventTimeStampMs;}}
 if(Object.values(input.losses).some(v=>v!==null)||Object.values(input.overflows).some(v=>v!==null)||input.wheelRequests.length!==40||input.wheelEvents.length!==41)throw Error('Observation coverage incomplete');
 if(input.wheelEvents.some((e,i)=>!e.isTrusted||e.deltaX!==0||e.deltaY!==(i===0?-600:-12)||e.deltaMode!==0||!e.targetContained||!e.currentTargetIsScroller))throw Error('Original trusted wheel facts unavailable');
 const preRows=input.scalarObservations.filter(r=>r.role==='pre'),postRows=input.scalarObservations.filter(r=>r.role==='post');
 const pre=preRows[0]?.value,post=postRows[0]?.value;
 if(preRows.length!==1||postRows.length!==1||!pre||!post||preRows[0]!.status!=='fulfilled'||postRows[0]!.status!=='fulfilled'||input.phase.postBoundaryScalarOrdinal!==postRows[0]!.ordinal||pre.pageNowMs>post.pageNowMs)throw Error('Original phase bracket unavailable');
 const inside=(at:number)=>at>=pre.pageNowMs&&at<=post.pageNowMs;
 const possibleInside=(event:{eventTimeStampMs:number;pageNowMs:number})=>event.eventTimeStampMs<=post.pageNowMs&&event.pageNowMs>=pre.pageNowMs;
 const before=input.entry.before.value?.scalar,after=input.entry.after.value?.scalar,entry=input.wheelEvents[0]!;
 if(!before||!after||entry.pageNowMs<before.pageNowMs||entry.pageNowMs>after.pageNowMs||entry.pageNowMs>=pre.pageNowMs)throw Error('Original entry wheel bracket unavailable');
 const brackets=input.wheelRequests.map((request,i)=>{
  const before=input.scalarObservations.find(row=>row.ordinal===request.beforeOrdinal),after=input.scalarObservations.find(row=>row.ordinal===request.afterOrdinal);
  if(request.slot!==i||request.status!=='fulfilled'||!before?.value||!after?.value||before.role!=='before'||after.role!=='after'||before.slot!==i||after.slot!==i||before.status!=='fulfilled'||after.status!=='fulfilled'||before.value.pageNowMs>after.value.pageNowMs)throw Error('Original slot bracket unavailable');
  return {before:before.value.pageNowMs,after:after.value.pageNowMs};
 });
 for(const [i,event] of input.wheelEvents.slice(1).entries()){
  const eligible=brackets.flatMap((b,slot)=>event.pageNowMs>=b.before&&event.pageNowMs<=b.after?[slot]:[]);
  if(!inside(event.pageNowMs)||eligible.length!==1||eligible[0]!==i)throw Error('Original wheel slot attribution unavailable');
 }
 let previous=pre.scrollTop;
 for(const event of input.scrollEvents){
  if(!event.currentTargetIsScroller)throw Error('Original scroll ownership unavailable');
  if(possibleInside(event)){if(event.scrollTop===0||event.scrollTop>previous)throw Error('Scroll direction unavailable');previous=event.scrollTop;}
 }
 if(input.motionEvents.some(e=>e.targetContained&&possibleInside(e)))throw Error('Competing motion observed');
}

type PilotWheel={ordinal:number;pageNowMs:number;eventTimeStampMs:number;isTrusted:boolean;deltaX:number;deltaY:number;deltaMode:number;targetContained:boolean;currentTargetIsScroller:boolean};
type PilotScroll={ordinal:number;pageNowMs:number;eventTimeStampMs:number;currentTargetIsScroller:boolean;scrollTop:number;scrollHeight:number;clientHeight:number};
type PilotMotion={ordinal:number;kind:'animationstart'|'transitionrun';pageNowMs:number;eventTimeStampMs:number;targetContained:boolean};
type PilotDOMName='wheel'|'scroll'|'animationstart'|'transitionrun';
export type TrackerAPageState=TrackerAAnchorPageState&{baseline:TrackerAScalar;gate(purpose:TrackerAScalarPurpose):unknown;waitGate(purpose:TrackerAScalarPurpose):Promise<void>;confirmGate(purpose:TrackerAScalarPurpose):void;install(name:PilotDOMName):boolean;remove(name:PilotDOMName):boolean;drain():{handlerGates:TrackerAHandlerGate[];wheelEvents:PilotWheel[];scrollEvents:PilotScroll[];motionEvents:PilotMotion[];overflows:{wheel:{ordinal:42}|null;scroll:{ordinal:257}|null;motion:{ordinal:33}|null}}};
type PilotWindow=Window&{__copilotkitBenchHost?:TrackerAAnchorHost;__copilotkitTrackerA?:TrackerAPageState};
/** Actual self-contained native baseline callback; no SDK imports. */
export function initializeTrackerAPage(options?:Readonly<{scrollCauseAttribution:true}>|void):TrackerAScalar{
   const w=window as PilotWindow,h=w.__copilotkitBenchHost;if(!h||w.__copilotkitTrackerA)throw Error('Original pilot baseline unavailable');
   const selector=h.locators.scroller,elements=document.querySelectorAll<HTMLElement>(selector),scroller=elements[0];if(elements.length!==1||!scroller?.isConnected)throw Error('Original pilot scroller unavailable');
   const originalURL=location.href,box=scroller.getBoundingClientRect(),rect={x:box.x,y:box.y,width:box.width,height:box.height};
   const baseline:TrackerAScalar={pageNowMs:performance.now(),url:originalURL,sameOriginalScroller:true,connected:scroller.isConnected,uniqueSelector:true,innerWidth,innerHeight,devicePixelRatio,rect,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight};
   let attribution:PageAttribution|undefined,capturedState:TrackerAPageState|undefined;
   if(options){
    let capability:ScrollCausePageExport['capability']='not-checked',host:ScrollCausePageExport['host']='not-checked',url:ScrollCausePageExport['url']='not-checked',sameScroller:ScrollCausePageExport['sameScroller']='not-checked',g1:ScrollCausePageExport['g1']='not-returned';
    let captured:object|undefined,observer:unknown,start:Function|undefined,marker:Function|undefined,seal:Function|undefined;
    try{
     const o=Object.getOwnPropertyDescriptors(options);if(Reflect.ownKeys(o).length!==1||o.scrollCauseAttribution?.value!==true)throw Error();
     const outer=Object.getOwnPropertyDescriptor(w,'__copilotkitScrollCauseDiagnostic');if(!outer){capability='missing';throw Error();}if(!('value'in outer))throw Error();
     captured=outer.value;if(!captured||![Object.prototype,null].includes(Object.getPrototypeOf(captured))||!Object.isFrozen(captured))throw Error();
     const d=Object.getOwnPropertyDescriptors(captured);if(Reflect.ownKeys(d).length!==5||['protocol','observer','start','marker','seal'].some(k=>!d[k]||!('value'in d[k]!)||!d[k]!.enumerable)||d.protocol!.value!=='scroll-cause-attribution-v1'||typeof d.observer!.value!=='object'||d.observer!.value===null||!Object.isFrozen(d.observer!.value)||['start','marker','seal'].some(k=>typeof d[k]!.value!=='function'))throw Error();
     observer=d.observer!.value;start=d.start!.value;marker=d.marker!.value;seal=d.seal!.value;capability='same';
    }catch{if(capability!=='missing')capability='invalid';}
    const current=()=>{
     if(capability!=='same'||!captured)return false;
     const state=Object.getOwnPropertyDescriptor(w,'__copilotkitTrackerA');if(!state||!('value'in state)||state.value!==capturedState||Object.getOwnPropertyDescriptor(capturedState!,'attribution')?.value!==attribution){capability='changed';return false;}
     const outer=Object.getOwnPropertyDescriptor(w,'__copilotkitScrollCauseDiagnostic');const d=Object.getOwnPropertyDescriptors(captured);
     if(!outer||!('value'in outer)||outer.value!==captured||d.observer?.value!==observer||d.start?.value!==start||d.marker?.value!==marker||d.seal?.value!==seal){capability='changed';return false;}
     const actual=Object.getOwnPropertyDescriptor(w,'__copilotkitBenchHost');if(!actual||!('value'in actual)||actual.value!==h){host='changed';return false;}host='same';return true;
    };
    attribution={start(){try{g1='raw-returned';if(!current())return;const context=w.__copilotkitTrackerA?.anchorContext;if(context?.refused){if(context.refused==='host')host='changed';else url='changed';return;}start!.call(captured,scroller);}catch{capability='invalid';}},marker(purpose,value){try{if(!current())return;if(value.url!==originalURL){url='changed';return;}url='same';if(!value.sameOriginalScroller||!value.connected||!value.uniqueSelector){sameScroller='changed';return;}sameScroller='same';marker!.call(captured,scroller,purpose);}catch{capability='invalid';}},export(){try{if(current()){if(location.href!==originalURL)url='changed';if(url!=='changed'&&host!=='changed')return {snapshot:seal!.call(captured),capability,host,url,sameScroller,g1};}}catch{capability='invalid';}return {snapshot:null,capability,host,url,sameScroller,g1};}};
   }
   const wheelEvents:PilotWheel[]=[],scrollEvents:PilotScroll[]=[],motionEvents:PilotMotion[]=[],overflows:ReturnType<TrackerAPageState['drain']>['overflows']={wheel:null,scroll:null,motion:null};
   let wheelCount=0,scrollCount=0,motionCount=0,drainAttempted=false;
   const handlerGates:TrackerAHandlerGate[]=[];
   let admission=true,latched=false,active:{row:TrackerAHandlerGate;promise:Promise<void>;resolve():void;reject(error:Error):void}|null=null;
   const refuse=(code:NonNullable<TrackerAHandlerGate['refusalCode']>)=>{latched=true;if(active){active.row.state='refused';active.row.refusalCode=code;active.reject(Error('Original wheel gate refused'));}};
   const contained=(target:EventTarget|null)=>target instanceof Node&&(target===scroller||scroller.contains(target));
   const wheel=(event:WheelEvent)=>{
    if(wheelCount>=41){if(overflows.wheel===null)overflows.wheel={ordinal:42};refuse('unexpected-order');return;}
    const ordinal=++wheelCount,row={ordinal,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,isTrusted:event.isTrusted,deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,targetContained:contained(event.target),currentTargetIsScroller:event.currentTarget===scroller};wheelEvents.push(row);
    // The original raw population owns the event before this arm can settle.
    if(!active){if(ordinal!==1||!row.isTrusted||row.deltaX!==0||row.deltaY!==-600||row.deltaMode!==0||!row.targetContained||!row.currentTargetIsScroller)refuse('unexpected-order');return;}
    if(active.row.state!=='armed'){refuse('duplicate-event');return;}
    try{
     const d=Object.getOwnPropertyDescriptors(row),keys=['ordinal','pageNowMs','eventTimeStampMs','isTrusted','deltaX','deltaY','deltaMode','targetContained','currentTargetIsScroller'];
     if(keys.some(k=>!d[k as keyof typeof d]||!('value'in d[k as keyof typeof d]!))||!Number.isFinite(row.pageNowMs)||!Number.isFinite(row.eventTimeStampMs))throw Error('Original event copy');
     Object.assign(active.row,{listenerOwnedIdentity:row.currentTargetIsScroller,eventOrdinal:row.ordinal,eventPageNowMs:row.pageNowMs,eventTimeStampMs:row.eventTimeStampMs});
    }catch{refuse('event-copy-invalid');return;}
    if(ordinal!==active.row.expectedEventOrdinal){refuse('unexpected-order');return;}
    if(!row.isTrusted||row.deltaX!==0||row.deltaY!==-12||row.deltaMode!==0||!row.targetContained||!row.currentTargetIsScroller||row.eventTimeStampMs<0||row.eventTimeStampMs>row.pageNowMs){refuse('event-invalid');return;}
    active.row.state='observed';active.resolve();
   };
   const scroll=(event:Event)=>{if(scrollCount>=256){if(overflows.scroll===null)overflows.scroll={ordinal:257};return;}const ordinal=++scrollCount;scrollEvents.push({ordinal,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,currentTargetIsScroller:event.currentTarget===scroller,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight});};
   const motion=(kind:'animationstart'|'transitionrun',event:Event)=>{if(motionCount>=32){if(overflows.motion===null)overflows.motion={ordinal:33};return;}const ordinal=++motionCount;motionEvents.push({ordinal,kind,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,targetContained:contained(event.target)});};
   const animationstart=(event:Event)=>motion('animationstart',event),transitionrun=(event:Event)=>motion('transitionrun',event);
   const names={wheel:{owner:scroller,callback:wheel as EventListener},scroll:{owner:scroller,callback:scroll},animationstart:{owner:document,callback:animationstart},transitionrun:{owner:document,callback:transitionrun}};
   const installed={wheel:false,scroll:false,animationstart:false,transitionrun:false},removed={wheel:false,scroll:false,animationstart:false,transitionrun:false};
   w.__copilotkitTrackerA={baseline,...(attribution?{attribution}:{}),anchorContext:{host:h,url:originalURL,refused:null},scalar(purpose){
    const matches=document.querySelectorAll(selector),current=scroller.getBoundingClientRect(),url=location.href;
    const value:TrackerAScalar={pageNowMs:performance.now(),url,sameOriginalScroller:matches[0]===scroller,connected:scroller.isConnected,uniqueSelector:matches.length===1,innerWidth,innerHeight,devicePixelRatio,rect:{x:current.x,y:current.y,width:current.width,height:current.height},scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight};
    if(purpose&&attribution)attribution.marker(purpose,value);
    // Return actual finite observations; the sequencer retains them before guards.
    return value;
   },gate(purpose){
    if(purpose.role==='before'){
     if(!admission||latched||!installed.wheel||removed.wheel||active||handlerGates.length>=40||purpose.slot!==handlerGates.length||wheelCount!==purpose.slot!+1){refuse('arm-state');return {schema:1,purpose,status:'invalid',record:active?{...active.row}:null,failure:'arm-refused'};}
     const slot=purpose.slot!,row:TrackerAHandlerGate={slot,beforeOrdinal:2+2*slot,afterOrdinal:3+2*slot,expectedEventOrdinal:slot+2,state:'armed',waitClaimed:false,listenerOwnedIdentity:null,eventOrdinal:null,eventPageNowMs:null,eventTimeStampMs:null,cancellationReason:null,refusalCode:null};
     let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});void promise.catch(()=>{});
     handlerGates.push(row);active={row,promise,resolve,reject};return {schema:1,purpose,status:'armed',record:{...row},failure:null};
    }
    const current=active;
    if(!current||current.row.slot!==purpose.slot||!current.row.waitClaimed||current.row.state!=='observed')return {schema:1,purpose,status:'invalid',record:current?{...current.row}:null,failure:'arm-refused'};
    const record={...current.row};active=null;return {schema:1,purpose,status:'observed',record,failure:null};
   },waitGate(purpose){
    const current=active;if(!current||purpose.role!=='after'||current.row.slot!==purpose.slot||current.row.afterOrdinal!==purpose.ordinal||current.row.waitClaimed){refuse('arm-state');throw Error('Original wheel gate claim refused');}
    current.row.waitClaimed=true;return current.promise;
   },confirmGate(purpose){
    const current=active;
    if(!current||purpose.role!=='after'||current.row.slot!==purpose.slot||current.row.afterOrdinal!==purpose.ordinal||!current.row.waitClaimed||!admission||latched||!installed.wheel||removed.wheel||current.row.state!=='observed'||current.row.eventOrdinal!==current.row.expectedEventOrdinal||wheelCount!==current.row.expectedEventOrdinal)throw Error('Original wheel gate changed before sampling');
   },install(name){if(installed[name])throw Error('Original DOM listener already charged');installed[name]=true;const registration=names[name];registration.owner.addEventListener(name,registration.callback,{passive:true});return true;},remove(name){if(removed[name])throw Error('Original DOM removal already charged');removed[name]=true;const registration=names[name];try{registration.owner.removeEventListener(name,registration.callback);return installed[name];}finally{if(name==='wheel'){admission=false;if(active){if(active.row.state==='armed'){active.row.state='cancelled';active.row.cancellationReason='listener-remove';active.reject(Error('Original wheel listener removed'));}active=null;}}}},drain(){if(drainAttempted)throw Error('Original page drain already charged');drainAttempted=true;return {handlerGates:handlerGates.map(row=>({...row})),wheelEvents:wheelEvents.slice(),scrollEvents:scrollEvents.slice(),motionEvents:motionEvents.slice(),overflows:{wheel:overflows.wheel,scroll:overflows.scroll,motion:overflows.motion}};}};
   if(attribution){try{capturedState=w.__copilotkitTrackerA;Object.freeze(attribution);Object.defineProperty(w,'__copilotkitTrackerAScrollCause',{value:Object.freeze({state:capturedState,attribution}),enumerable:true,writable:false,configurable:false});}catch{attribution=undefined;}}
   return baseline;
}
