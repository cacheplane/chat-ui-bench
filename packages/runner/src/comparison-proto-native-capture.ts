import {createHash,randomBytes} from 'node:crypto';
import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {types} from 'node:util';
import type {readWholeAnnotationTrace,readWholeUserTimingTrace,readWholeUserTimingTraceV3,readWholeUserTimingTraceV4,isClosedStudyFailureCode,ClosedStudyFailureCode} from '@chat-ui-bench/analyzer/internal/whole-annotation';
import {createProtoTraceCollector,type ProtoClockPort,type ProtoTraceCollector,type ProtoTraceReceipt} from './comparison-proto-trace.js';
import {createProtoPublicPorts,type ProtoPublicInputs} from './comparison-proto-public-ports.js';

/** Owned source adapter only. No browser acquisition and no analyzer admission.
 * Public object calls, Node descriptor operations/hash and vendor correspondence
 * are explicit trusted finite-input boundaries, not a native CPU/RSS theorem. */
const POLICY='pinned-proto-owned-native-transport-v1';
const MAX_EXECUTABLE_BYTES=536870912;
const ROLE_CAPS=Object.freeze({'intent.json':16384,'capture.json':262144,'target.json':65536,'marks.json':16384,'trace.pftrace':33554432,'receipt.json':262144});
const PHASE_POLICY='source-owned-phase-registry-inventory-diagnostic-v1';
const USER_TIMING_PHASE_POLICY='source-owned-user-timing-phase-inventory-diagnostic-v2';
const USER_TIMING_PHASE_V3_POLICY='source-owned-user-timing-phase-inventory-diagnostic-v3';
const USER_TIMING_PHASE_V4_POLICY='source-owned-user-timing-phase-inventory-diagnostic-v4';
const PHASE_AUTHORITY=Object.freeze({captureQualified:false,qualification:false,nativeSupported:false,clockAdmission:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false}as const);
type PhaseRefusal='unregistered-owner'|'owner-not-ready'|'input-reference-unavailable'|'reader-unavailable'|'whole-input-unavailable'|'file-identity-unavailable'|'root-inventory-withheld'|'state-loss-observed'|'candidate-capacity'|'duplicate-start'|'duplicate-end'|'foreign-selected-prefix'|'missing-start'|'missing-end'|'wire-order-unavailable'|'result-capacity'|'internal-unavailable';
export interface ProtoPhaseInventoryRow {
 readonly phase:'start'|'end';readonly name:string;readonly packetIndex:number;readonly sequenceIndex:number;readonly intervalVersion:number;
 readonly eventStart:number;readonly eventValueStart:number;readonly eventEnd:number;readonly bodySHA256:string;readonly annotationIndex:number;readonly definitionIndex:number|null;readonly nameSource:'literal'|'intern';
 readonly clockId:string|null;readonly clockSource:'packet'|'defaults'|'unavailable';readonly trackUuid:string|null;readonly trackSource:'event'|'defaults'|'unavailable';
 readonly machineStatus:'absent'|'present';readonly machineId:string|null;readonly sequenceId:string;readonly rawTimestamp:string|null;readonly timestampStatus:'absent'|'raw-unqualified';
}
interface PhaseBase {readonly policy:typeof PHASE_POLICY;readonly authority:typeof PHASE_AUTHORITY}
export type ProtoPhaseInventoryDiagnostic=(PhaseBase&{readonly status:'unavailable';readonly reason:PhaseRefusal;readonly rows:readonly []})|(PhaseBase&{
 readonly status:'phase-registry-inventory-diagnostic';readonly reason:null;readonly runId:string;readonly phaseId:string;readonly targetId:string;
 readonly input:Readonly<{bytes:number;sha256:string;packetManifestSHA256:string;transitionManifestSHA256:string}>;
 readonly counters:Readonly<{candidates:number;outsidePrefix:number;readAttempts:number;packets:number}>;readonly rows:readonly [ProtoPhaseInventoryRow,ProtoPhaseInventoryRow];
});
export interface ProtoUserTimingPhaseInventoryRow extends Omit<ProtoPhaseInventoryRow,'annotationIndex'> {readonly annotationIndex:number|null;readonly representation:'annotation'|'event_name'}
export type ProtoUserTimingPhaseInventoryDiagnostic=Omit<Extract<ProtoPhaseInventoryDiagnostic,{status:'unavailable'}>,'policy'> & {readonly policy:typeof USER_TIMING_PHASE_POLICY}|Omit<Extract<ProtoPhaseInventoryDiagnostic,{status:'phase-registry-inventory-diagnostic'}>,'policy'|'rows'>&{readonly policy:typeof USER_TIMING_PHASE_POLICY;readonly rows:readonly [ProtoUserTimingPhaseInventoryRow,ProtoUserTimingPhaseInventoryRow]};
export type ClosedWholeFailureCode=ClosedStudyFailureCode|'invalid-reference'|'reader-capacity'|'reader-result'|'reader-growth'|'reader-no-eof'|'reader-drift'|'reader-hash'|'reader-failure'|'reader-close'|'whole-annotation-unavailable'|'whole-result-inconsistent'|'unavailable-code';
export interface WholeInputFailure {
 readonly reason:ClosedWholeFailureCode;
 readonly reader:Readonly<{EOF:boolean;closed:boolean;identityMatch:boolean;hashMatch:boolean;fullInputVerified:boolean;structuralContainerEOF:boolean;bytes:number;reads:number}>;
 readonly study:Readonly<{status:'whole-annotation-study'|'unavailable';packets:number;decodedPackets:number;processedPackets:number}>|null;
 readonly firstSemanticDiagnostic:Readonly<{code:ClosedWholeFailureCode;packetIndex:number|null;component:null|'packet'|'defaults'|'interned_names'|'track_descriptor'|'clock_snapshot';cause:ClosedStudyFailureCode|'unavailable-code'|null}>|null;
}
export type ProtoUserTimingPhaseInventoryDiagnosticV3=Omit<Extract<ProtoUserTimingPhaseInventoryDiagnostic,{status:'unavailable'}>,'policy'>&{readonly policy:typeof USER_TIMING_PHASE_V3_POLICY;readonly wholeInputFailure:WholeInputFailure|null}|Omit<Extract<ProtoUserTimingPhaseInventoryDiagnostic,{status:'phase-registry-inventory-diagnostic'}>,'policy'>&{readonly policy:typeof USER_TIMING_PHASE_V3_POLICY;readonly wholeInputFailure:WholeInputFailure|null};
export type ProtoUserTimingPhaseInventoryDiagnosticV4=Omit<Extract<ProtoUserTimingPhaseInventoryDiagnosticV3,{status:'unavailable'}>,'policy'>&{readonly policy:typeof USER_TIMING_PHASE_V4_POLICY}|Omit<Extract<ProtoUserTimingPhaseInventoryDiagnosticV3,{status:'phase-registry-inventory-diagnostic'}>,'policy'>&{readonly policy:typeof USER_TIMING_PHASE_V4_POLICY};
type PrivatePhaseDiagnostic=ProtoPhaseInventoryDiagnostic|ProtoUserTimingPhaseInventoryDiagnostic|ProtoUserTimingPhaseInventoryDiagnosticV3|ProtoUserTimingPhaseInventoryDiagnosticV4;
const phaseRefusal=(reason:PhaseRefusal):Readonly<ProtoPhaseInventoryDiagnostic>=>Object.freeze({policy:PHASE_POLICY,status:'unavailable',reason,rows:Object.freeze([])as readonly [],authority:PHASE_AUTHORITY});
const UNKNOWN_PHASE=phaseRefusal('unregistered-owner');
const phaseOwners=new WeakMap<object,()=>Readonly<ProtoPhaseInventoryDiagnostic>>();
const userTimingPhaseOwners=new WeakMap<object,{policy:typeof USER_TIMING_PHASE_POLICY|typeof USER_TIMING_PHASE_V3_POLICY|typeof USER_TIMING_PHASE_V4_POLICY;inspect:()=>Readonly<PrivatePhaseDiagnostic>}>();
const userTimingPhaseRefusal=(reason:PhaseRefusal):Readonly<ProtoUserTimingPhaseInventoryDiagnostic>=>Object.freeze({policy:USER_TIMING_PHASE_POLICY,status:'unavailable',reason,rows:Object.freeze([])as readonly [],authority:PHASE_AUTHORITY});
const UNKNOWN_USER_TIMING_PHASE=userTimingPhaseRefusal('unregistered-owner');
const userTimingPhaseV3Refusal=(reason:PhaseRefusal,wholeInputFailure:WholeInputFailure|null=null):Readonly<ProtoUserTimingPhaseInventoryDiagnosticV3>=>Object.freeze({policy:USER_TIMING_PHASE_V3_POLICY,status:'unavailable',reason,rows:Object.freeze([])as readonly [],wholeInputFailure,authority:PHASE_AUTHORITY});
const UNKNOWN_USER_TIMING_PHASE_V3=userTimingPhaseV3Refusal('unregistered-owner');
const userTimingPhaseV4Refusal=(reason:PhaseRefusal,wholeInputFailure:WholeInputFailure|null=null):Readonly<ProtoUserTimingPhaseInventoryDiagnosticV4>=>Object.freeze({policy:USER_TIMING_PHASE_V4_POLICY,status:'unavailable',reason,rows:Object.freeze([])as readonly [],wholeInputFailure,authority:PHASE_AUTHORITY});
/** Exact source-created identity only. This DTO grants no native admission. */
export function inspectProtoNativePhase(owner:unknown):Readonly<ProtoPhaseInventoryDiagnostic>{
 if(owner===null||typeof owner!=='object'||types.isProxy(owner))return UNKNOWN_PHASE;
 return phaseOwners.get(owner)?.()??UNKNOWN_PHASE;
}
/** A distinct owner registry prevents retroactive policy changes or reinspection. */
export function inspectProtoNativeUserTimingPhase(owner:unknown):Readonly<ProtoUserTimingPhaseInventoryDiagnostic>{
 if(owner===null||typeof owner!=='object'||types.isProxy(owner))return UNKNOWN_USER_TIMING_PHASE;
 const entry=userTimingPhaseOwners.get(owner);return entry?.policy===USER_TIMING_PHASE_POLICY?entry.inspect()as ProtoUserTimingPhaseInventoryDiagnostic:UNKNOWN_USER_TIMING_PHASE;
}
export function inspectProtoNativeUserTimingPhaseV3(owner:unknown):Readonly<ProtoUserTimingPhaseInventoryDiagnosticV3>{
 if(owner===null||typeof owner!=='object'||types.isProxy(owner))return UNKNOWN_USER_TIMING_PHASE_V3;
 const entry=userTimingPhaseOwners.get(owner);return entry?.policy===USER_TIMING_PHASE_V3_POLICY?entry.inspect()as ProtoUserTimingPhaseInventoryDiagnosticV3:UNKNOWN_USER_TIMING_PHASE_V3;
}
export function inspectProtoNativeUserTimingPhaseV4(owner:unknown):Readonly<ProtoUserTimingPhaseInventoryDiagnosticV4>{
 if(owner===null||typeof owner!=='object'||types.isProxy(owner))return userTimingPhaseV4Refusal('unregistered-owner');
 const entry=userTimingPhaseOwners.get(owner);return entry?.policy===USER_TIMING_PHASE_V4_POLICY?entry.inspect()as ProtoUserTimingPhaseInventoryDiagnosticV4:userTimingPhaseV4Refusal('unregistered-owner');
}
type WholePhaseResult=ReturnType<typeof readWholeAnnotationTrace>|ReturnType<typeof readWholeUserTimingTrace>|ReturnType<typeof readWholeUserTimingTraceV3>|ReturnType<typeof readWholeUserTimingTraceV4>;
/** Copy bounded observations only; physical reason and first study diagnostic are distinct. */
function wholeInputFailure(whole:WholePhaseResult,studyCode:typeof isClosedStudyFailureCode):WholeInputFailure|null{
 try{
 const closedCode=(value:unknown):ClosedWholeFailureCode=>{if(studyCode(value))return value;switch(value){case'invalid-reference':case'reader-capacity':case'reader-result':case'reader-growth':case'reader-no-eof':case'reader-drift':case'reader-hash':case'reader-failure':case'reader-close':case'whole-annotation-unavailable':case'whole-result-inconsistent':case'unavailable-code':return value;default:return'unavailable-code';}};
 const integer=(value:unknown,max:number):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=max;
 const r=whole.reader,s=whole.study;
 if(s!==null&&(typeof s!=='object'||types.isProxy(s)))return null;
 if([r.EOF,r.closed,r.identityMatch,r.hashMatch,whole.fullInputVerified,whole.structuralContainerEOF].some(value=>typeof value!=='boolean')||!integer(r.bytes,33554433)||!integer(r.reads,4096))return null;
 if(s&&((s.status!=='whole-annotation-study'&&s.status!=='unavailable')||!integer(s.counters.packets,131072)||!integer(s.counters.decodedPackets,131072)||!integer(s.counters.processedPackets,131072)))return null;
 const d=s?.diagnostics[0]as {code:unknown;packetIndex:unknown;component:unknown;cause?:unknown}|undefined;
 if(s&&(!Array.isArray(s.diagnostics)||(s.diagnostics.length!==0&&(!d||typeof d!=='object'||types.isProxy(d)))))return null;
 if(d&&d.packetIndex!==null&&!integer(d.packetIndex,131071))return null;
 const component=d?.component;
 return {reason:whole.reason===null?'whole-result-inconsistent':closedCode(whole.reason),reader:{EOF:r.EOF,closed:r.closed,identityMatch:r.identityMatch,hashMatch:r.hashMatch,fullInputVerified:whole.fullInputVerified,structuralContainerEOF:whole.structuralContainerEOF,bytes:r.bytes,reads:r.reads},study:s?{status:s.status,packets:s.counters.packets,decodedPackets:s.counters.decodedPackets,processedPackets:s.counters.processedPackets}:null,firstSemanticDiagnostic:d?{code:closedCode(d.code),packetIndex:d.packetIndex as number|null,component:component==='packet'||component==='defaults'||component==='interned_names'||component==='track_descriptor'||component==='clock_snapshot'?component:null,cause:d.cause===undefined||d.cause===null?null:studyCode(d.cause)?d.cause:'unavailable-code'}:null};
 }catch{return null;}
}
type PhaseCandidate=NonNullable<WholePhaseResult['study']>['candidates'][number];
function phaseRow(row:PhaseCandidate,phase:'start'|'end',name:string,userTiming:boolean):ProtoPhaseInventoryRow|ProtoUserTimingPhaseInventoryRow{
 const representation=(row as PhaseCandidate&{representation?:string}).representation;
 if((!userTiming&&row.annotationIndex===null)||(userTiming&&(representation!=='annotation'&&representation!=='event_name'))||row.sequenceId===null||(row.nameSource!=='literal'&&row.nameSource!=='intern')||(row.clockSource!=='packet'&&row.clockSource!=='defaults'&&row.clockSource!=='unavailable')||(row.trackSource!=='event'&&row.trackSource!=='defaults'&&row.trackSource!=='unavailable'))throw unavailable();
 const projected={phase,name,packetIndex:row.packetIndex,sequenceIndex:row.sequenceIndex,intervalVersion:row.intervalVersion,eventStart:row.eventStart,eventValueStart:row.eventValueStart,eventEnd:row.eventEnd,bodySHA256:row.bodySHA256,annotationIndex:row.annotationIndex,definitionIndex:row.definitionIndex,nameSource:row.nameSource,clockId:row.clockId,clockSource:row.clockSource,trackUuid:row.trackUuid,trackSource:row.trackSource,machineStatus:row.machineStatus,machineId:row.machineId,sequenceId:row.sequenceId,rawTimestamp:row.rawTimestamp,timestampStatus:row.timestampStatus};
 if(userTiming)(projected as {representation?:'annotation'|'event_name'}).representation=representation as 'annotation'|'event_name';return projected as ProtoPhaseInventoryRow|ProtoUserTimingPhaseInventoryRow;
}
/** Private capacity guard for fixed source-constructed DTOs, not caller input. */
function phaseOutput(value:PrivatePhaseDiagnostic):Readonly<PrivatePhaseDiagnostic>{
 let nodes=0,objects=0,chars=0;
 function visit(v:unknown,depth:number):void{
  if(++nodes>256||depth>6)throw unavailable();
  if(typeof v==='string'){chars+=Buffer.byteLength(v);return;}if(v===null||typeof v==='boolean'||typeof v==='number')return;
  if(!v||typeof v!=='object'||++objects>16)throw unavailable();const array=Array.isArray(v);
  for(const[key,child]of Object.entries(v)){if(!array)chars+=Buffer.byteLength(key);visit(child,depth+1);}Object.freeze(v);
 }
 visit(value,0);if(chars>4096||Buffer.byteLength(JSON.stringify(value))>8192)throw unavailable();return value;
}
type Role=keyof typeof ROLE_CAPS;
type State='pending'|'fulfilled'|'rejected';
type OriginalState=State|'not-dispatched';
type Operation={kind:string;state:OriginalState;timer:{registrationState:'not-attempted'|'registered'|'unknown-after-throw';disposalState:'not-attempted'|'cleared'|'fired'|'unknown-after-throw'}};
type Observe={on(event:string,listener:(value?:unknown)=>void):unknown;off(event:string,listener:(value?:unknown)=>void):unknown};
type Session=ProtoPublicInputs['session']&Observe&{send(method:string,parameters?:unknown):Promise<unknown>};
type Page=ProtoPublicInputs['page']&Observe&{mainFrame():unknown;frames():unknown;url():string};
type Context=ProtoPublicInputs['context']&Observe&{pages():unknown};
type Browser=ProtoPublicInputs['browser']&Observe;
export interface ProtoNativeRuntime {
 executablePath:string;expectedExecutableBytes:number;expectedExecutableSha256:string;
 playwrightVersion:string;browserRevision:string;expectedProduct:string;expectedRevision:string;launchFlags:readonly string[];headless:boolean;
}
export interface ProtoNativeCaptureInputs {
 session:Session;page:Page;context:Context;browser:Browser;clock:ProtoClockPort;
 outputDirectory:string;runtime:ProtoNativeRuntime;runId:string;phaseId:string;
 phase:{mark(name:string):Promise<void>};
 runner:{close():Promise<void>;wait():Promise<{exitCode:number|null;signal:string|null}>};
}
interface TargetSnapshot {frameId:string;loaderId:string;url:string;targetId:string;browserContextId:string}
export interface ProtoNativeCaptureReceipt {
 schemaVersion:1;policy:typeof POLICY;status:'open'|'closed'|'unavailable'|'pending';
 failures:string[];failureCount:number;createdRoles:Role[];operations:Operation[];originalOperationsSettled:boolean;
 transport:ProtoTraceReceipt|null;persistedWholeInput:'verified'|'unavailable';persisted:{bytes:number;sha256:string}|null;
 target:{before:TargetSnapshot|null;after:TargetSnapshot|null;events:{event:string;ordinal:number}[];eventCount:number};
 runtime:{status:'unavailable'|'vendor-assumed-correspondence';assumption:'trusted-pinned-vendor-build-correspondence';executable:{bytes:number;sha256:string}|null;playwrightVersion:string|null;browserRevision:string|null;product:string|null;revision:string|null;launchFlags:string[];headless:boolean|null};
 marks:{phase:'start'|'end';name:string;state:OriginalState;runId:string;phaseId:string;targetId:string}[];
 runner:{close:OriginalState;wait:{exitCode:number|null;signal:string|null}|null};
 analysis:'not_evaluated';qualification:false;captureQualified:false;fpsEligibility:false;evaluationEligibility:false;scoringEligibility:false;rankingEligibility:false;nativeSupported:false;targetLifetime:'unestablished';clockAdmission:'not_evaluated';
}
const unavailable=()=>new Error('Native capture unavailable');
function own(value:unknown,key:string):unknown {
 if(value===null||typeof value!=='object')throw unavailable();
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 if(!descriptor||!Object.hasOwn(descriptor,'value'))throw unavailable();return descriptor.value;
}
function text(value:unknown,max:number):string {if(typeof value!=='string'||value.length<1||value.length>max||! /^[\x20-\x7e]+$/.test(value))throw unavailable();return value;}
function captureRuntime(value:unknown):ProtoNativeRuntime {
 const expectedExecutableBytes=own(value,'expectedExecutableBytes'),headless=own(value,'headless');
 if(typeof expectedExecutableBytes!=='number'||!Number.isSafeInteger(expectedExecutableBytes)||expectedExecutableBytes<1||expectedExecutableBytes>MAX_EXECUTABLE_BYTES||typeof headless!=='boolean')throw unavailable();
 const expectedExecutableSha256=text(own(value,'expectedExecutableSha256'),64);
 if(!/^[a-f0-9]{64}$/.test(expectedExecutableSha256))throw unavailable();
 return {executablePath:text(own(value,'executablePath'),4096),expectedExecutableBytes,expectedExecutableSha256,playwrightVersion:text(own(value,'playwrightVersion'),64),browserRevision:text(own(value,'browserRevision'),64),expectedProduct:text(own(value,'expectedProduct'),128),expectedRevision:text(own(value,'expectedRevision'),128),launchFlags:dataArray(own(value,'launchFlags'),32).map(flag=>text(flag,256)),headless};
}
function dataArray(value:unknown,max:number):unknown[]{
 if(!Array.isArray(value))throw unavailable();const length=own(value,'length');if(typeof length!=='number'||!Number.isInteger(length)||length>max)throw unavailable();
 const result:unknown[]=[];for(let i=0;i<length;i++)result.push(own(value,String(i)));return result;
}
function sameFile(a:Awaited<ReturnType<FileHandle['stat']>>,b:Awaited<ReturnType<FileHandle['stat']>>):boolean{return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&b.isFile()&&b.nlink===1;}
/** Stat and expected length are checked before any original descriptor read. */
type Identity={dev:number;ino:number};
async function hashRegular(path:string,expectedBytes:number,cap:number,identity?:Identity):Promise<{bytes:number;sha256:string}>{
 if(!Number.isSafeInteger(expectedBytes)||expectedBytes<0||expectedBytes>cap)throw unavailable();
 const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let failure=false;
 try{
  const before=await file.stat();if(!before.isFile()||before.nlink!==1||before.size!==expectedBytes||identity&&(before.dev!==identity.dev||before.ino!==identity.ino))throw unavailable();
  const buffer=Buffer.alloc(65536),hash=createHash('sha256');let position=0;
  while(position<expectedBytes){const requested=Math.min(buffer.length,expectedBytes-position);const {bytesRead}=await file.read(buffer,0,requested,position);if(bytesRead!==requested)throw unavailable();hash.update(buffer.subarray(0,bytesRead));position+=bytesRead;}
  const eof=await file.read(buffer,0,1,position);const after=await file.stat();if(eof.bytesRead!==0||!sameFile(before,after))throw unavailable();
  return {bytes:position,sha256:hash.digest('hex')};
 }catch{failure=true;throw unavailable();}finally{try{await file.close();}catch{if(!failure)throw unavailable();}}
}
async function readMetadata(path:string):Promise<Buffer>{
 const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await file.stat();if(!before.isFile()||before.nlink!==1||before.size<1||before.size>16384)throw unavailable();
  const bytes=Buffer.alloc(before.size);let offset=0;
  while(offset<bytes.length){const requested=bytes.length-offset;const result=await file.read(bytes,offset,requested,offset);if(result.bytesRead!==requested)throw unavailable();offset+=result.bytesRead;}
  const eof=await file.read(Buffer.alloc(1),0,1,offset);if(eof.bytesRead!==0||!sameFile(before,await file.stat()))throw unavailable();return bytes;
 }finally{await file.close();}
}

export function createProtoNativeCapture(inputs:ProtoNativeCaptureInputs){
 return createNativeCapture(inputs,false);
}
/** Policy is fixed by source-owned factory selection before inspection can cache. */
export function createProtoNativeUserTimingCapture(inputs:ProtoNativeCaptureInputs){
 return createNativeCapture(inputs,true);
}
export function createProtoNativeUserTimingCaptureV3(inputs:ProtoNativeCaptureInputs){
 return createNativeCapture(inputs,true,3);
}
export function createProtoNativeUserTimingCaptureV4(inputs:ProtoNativeCaptureInputs){
 return createNativeCapture(inputs,true,4);
}
function createNativeCapture(inputs:ProtoNativeCaptureInputs,userTiming:boolean,diagnosticVersion=0){
 const receipt:ProtoNativeCaptureReceipt={schemaVersion:1,policy:POLICY,status:'open',failures:[],failureCount:0,createdRoles:[],operations:[],originalOperationsSettled:true,transport:null,persistedWholeInput:'unavailable',persisted:null,
  target:{before:null,after:null,events:[],eventCount:0},runtime:{status:'unavailable',assumption:'trusted-pinned-vendor-build-correspondence',executable:null,playwrightVersion:null,browserRevision:null,product:null,revision:null,launchFlags:[],headless:null},marks:[],runner:{close:'not-dispatched',wait:null},
  analysis:'not_evaluated',qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,nativeSupported:false,targetLifetime:'unestablished',clockAdmission:'not_evaluated'};
 let collector:ProtoTraceCollector|undefined,raw:FileHandle|undefined,rawClose:Promise<void>|undefined;
 let starting:Promise<ProtoNativeCaptureReceipt>|undefined,finishing:Promise<ProtoNativeCaptureReceipt>|undefined,closing:Promise<ProtoNativeCaptureReceipt>|undefined;
 let finalQueries:Promise<void>|undefined,detach:Promise<void>|undefined,runnerClose:Promise<void>|undefined;
 let installed=false,finalizing=false,runnerClosing=false,ended=false,directoryOwned=false,timedOut=false,eventBytes=2;
 let initialFrame:unknown,ownerTimer:unknown,ownerTimerSet=false;
 let rawIdentity:Identity|undefined,runtimePins:ProtoNativeRuntime|undefined;
 let outputDirectory='',runId='',phaseId='';
 let phaseAttempted=false,phaseCached:Readonly<PrivatePhaseDiagnostic>|undefined,finishState:'not-dispatched'|'fulfilled'|'rejected'='not-dispatched';
 const phasePolicy=diagnosticVersion===4?USER_TIMING_PHASE_V4_POLICY:diagnosticVersion===3?USER_TIMING_PHASE_V3_POLICY:userTiming?USER_TIMING_PHASE_POLICY:PHASE_POLICY;
 const refusePhase=diagnosticVersion===4?userTimingPhaseV4Refusal:diagnosticVersion===3?userTimingPhaseV3Refusal:userTiming?userTimingPhaseRefusal:phaseRefusal;
 const removers:(()=>void)[]=[];
 const snapshot=():ProtoNativeCaptureReceipt=>structuredClone({...receipt,transport:collector?.snapshot()??receipt.transport,originalOperationsSettled:receipt.operations.every(op=>op.state!=='pending')&&(collector?.snapshot().originalOperationsSettled??true)});
 const fail=(code:string)=>{receipt.failureCount=Math.min(65535,receipt.failureCount+1);if(receipt.failures.length<32)receipt.failures.push(code);if(ended)receipt.status='unavailable';};
 // Every timeout races only a mapped wait. The original operation row remains
 // pending until the invoked original settles; no cancellation fiction.
 function bounded<T>(kind:string,call:()=>Promise<T>,budget=10000,cleanupOwned=false):Promise<T>{
  if(receipt.operations.length>=64){fail('operation-capacity');return Promise.reject(unavailable());}
  const row:Operation={kind,state:'not-dispatched',timer:{registrationState:'not-attempted',disposalState:'not-attempted'}};receipt.operations.push(row);
  let token:unknown,tokenSet=false,done=false,fired=false;
  return new Promise<T>((resolveWait,rejectWait)=>{
   const clear=()=>{if(tokenSet){tokenSet=false;try{inputs.clock.clearTimer(token);row.timer.disposalState=fired?'fired':'cleared';}catch{row.timer.disposalState='unknown-after-throw';fail('timer-clear');}}};
   const reject=()=>{if(!done){done=true;clear();rejectWait(unavailable());}};
   try{token=inputs.clock.setTimer(()=>{if(done)return;fired=true;timedOut=true;fail('operation-timeout');reject();},budget);tokenSet=true;row.timer.registrationState='registered';if(done)clear();}
   catch{row.timer.registrationState='unknown-after-throw';row.timer.disposalState='unknown-after-throw';fail('timer-install');reject();}
   // New work requires a usable deadline. Already-owned cleanup still gets one
   // best-effort original attempt; an unusable wait never settles that original.
   if(done&&!cleanupOwned)return;
   row.state='pending';
   const settle=(ok:boolean,value?:T)=>{row.state=ok?'fulfilled':'rejected';if(!done){done=true;clear();if(ok)resolveWait(value as T);else rejectWait(unavailable());}};
   try{void Promise.resolve(call()).then(value=>settle(true,value),()=>settle(false));}catch{settle(false);}
  });
 }
 function event(label:string,refuse:boolean){
  if(ended)return;receipt.target.eventCount=Math.min(65535,receipt.target.eventCount+1);
  const row={event:label,ordinal:receipt.target.eventCount};const bytes=Buffer.byteLength(JSON.stringify(row))+1;
  // Reserve 16KiB for two full target snapshots/schema before retaining events.
  if(receipt.target.eventCount>4096||eventBytes+bytes>49152){fail('lifecycle-capacity');void collector?.close();return;}
  eventBytes+=bytes;receipt.target.events.push(row);if(refuse){fail('target-lifetime-drift');void collector?.close();}
 }
 function install(){
  const registrations:[Observe,string,()=>void][]=[
   [inputs.page,'frameattached',()=>event('page-frameattached',true)],[inputs.page,'framedetached',()=>event('page-framedetached',true)],[inputs.page,'framenavigated',()=>event('page-framenavigated',true)],[inputs.page,'close',()=>event('page-close',!runnerClosing)],[inputs.page,'crash',()=>event('page-crash',true)],
   [inputs.context,'page',()=>event('context-page',true)],[inputs.context,'close',()=>event('context-close',!runnerClosing)],[inputs.browser,'disconnected',()=>event('browser-disconnected',!runnerClosing)],
   [inputs.session,'Page.frameAttached',()=>event('cdp-frameattached',true)],[inputs.session,'Page.frameDetached',()=>event('cdp-framedetached',true)],[inputs.session,'Page.frameNavigated',()=>event('cdp-framenavigated',true)],
   [inputs.session,'Target.targetDestroyed',()=>event('target-destroyed',!runnerClosing)],[inputs.session,'Target.targetInfoChanged',()=>event('target-info-changed',true)],[inputs.session,'Inspector.detached',()=>event('inspector-detached',!finalizing)],[inputs.session,'close',()=>event('session-close',!finalizing)],
  ];
  for(const[source,label,listener]of registrations){const remove=()=>{source.off(label,listener);};removers.push(remove);source.on(label,listener);}
  installed=true;
 }
 function topology():void{
  const frames=dataArray(inputs.page.frames(),1),pages=dataArray(inputs.context.pages(),1);if(frames.length!==1||pages.length!==1||pages[0]!==inputs.page||frames[0]!==inputs.page.mainFrame())throw unavailable();
  if(initialFrame===undefined)initialFrame=frames[0];else if(initialFrame!==frames[0])throw unavailable();
  if(inputs.page.context()!==inputs.context||inputs.context.browser()!==inputs.browser||inputs.page.isClosed()||inputs.context.isClosed()||!inputs.browser.isConnected())throw unavailable();
 }
 async function query(stage:'before'|'after'):Promise<void>{
  topology();
  const [frameReply,targetReply,versionReply]=await Promise.all([
   bounded(stage+'-frame',()=>inputs.session.send('Page.getFrameTree')),
   bounded(stage+'-target',()=>inputs.session.send('Target.getTargetInfo')),
   bounded(stage+'-version',()=>inputs.session.send('Browser.getVersion')),
  ]);
  const tree=own(frameReply,'frameTree'),frame=own(tree,'frame'),target=own(targetReply,'targetInfo');
  const children=Object.getOwnPropertyDescriptor(tree,'childFrames');if(children&&(!Object.hasOwn(children,'value')||dataArray(children.value,0).length))throw unavailable();
  if(own(target,'type')!=='page')throw unavailable();
  const observed:TargetSnapshot={frameId:text(own(frame,'id'),256),loaderId:text(own(frame,'loaderId'),256),url:text(own(frame,'url'),2048),targetId:text(own(target,'targetId'),256),browserContextId:text(own(target,'browserContextId'),256)};
  if(text(own(target,'url'),2048)!==observed.url||inputs.page.url()!==observed.url)throw unavailable();
  const product=text(own(versionReply,'product'),128),revision=text(own(versionReply,'revision'),128);
  if(product!==runtimePins?.expectedProduct||revision!==runtimePins.expectedRevision)throw unavailable();
  receipt.runtime.product=product;receipt.runtime.revision=revision;receipt.target[stage]=observed;
  if(stage==='after'&&JSON.stringify(receipt.target.before)!==JSON.stringify(observed))throw unavailable();topology();
 }
 async function runtime():Promise<void>{
  const r=runtimePins;if(!r)throw unavailable();
  const path=text(r.executablePath,4096);if(resolve(path)!==path)throw unavailable();
  text(r.playwrightVersion,64);text(r.browserRevision,64);text(r.expectedProduct,128);text(r.expectedRevision,128);
  if(!/^[a-f0-9]{64}$/.test(r.expectedExecutableSha256)||typeof r.headless!=='boolean'||!Number.isSafeInteger(r.expectedExecutableBytes)||r.expectedExecutableBytes<1||r.expectedExecutableBytes>MAX_EXECUTABLE_BYTES)throw unavailable();
  const flags=dataArray(r.launchFlags,32).map(value=>text(value,256));
  runtimePins={executablePath:path,expectedExecutableBytes:r.expectedExecutableBytes,expectedExecutableSha256:r.expectedExecutableSha256,playwrightVersion:r.playwrightVersion,browserRevision:r.browserRevision,expectedProduct:r.expectedProduct,expectedRevision:r.expectedRevision,launchFlags:flags,headless:r.headless};
  const executable=await bounded('runtime-hash',()=>hashRegular(path,r.expectedExecutableBytes,MAX_EXECUTABLE_BYTES));if(executable.sha256!==r.expectedExecutableSha256)throw unavailable();
  const require=createRequire(import.meta.url),packagePath=require.resolve('playwright/package.json');
  const packageBytes=await bounded('runtime-package',()=>readMetadata(packagePath));
  const version=text(own(JSON.parse(packageBytes.toString('utf8')),'version'),64);if(version!==r.playwrightVersion)throw unavailable();
  const browserBytes=await bounded('runtime-browser-package',()=>readMetadata(join(dirname(require.resolve('playwright-core/package.json')),'browsers.json')));
  const browsers=dataArray(own(JSON.parse(browserBytes.toString('utf8')),'browsers'),16);
  let found=false;
  for(let i=0;i<browsers.length;i++){const entry=browsers[i];if(own(entry,'name')==='chromium'){if(found||own(entry,'revision')!==r.browserRevision)throw unavailable();found=true;}}
  if(!found)throw unavailable();
  receipt.runtime.executable=executable;receipt.runtime.playwrightVersion=version;receipt.runtime.browserRevision=r.browserRevision;receipt.runtime.launchFlags=flags;receipt.runtime.headless=r.headless;
  // This records the limited vendor assumption; never grants native qualification.
  receipt.runtime.status='vendor-assumed-correspondence';
 }
 async function closeRaw():Promise<void>{
  if(!raw)return;if(!rawClose){const file=raw;rawClose=(async()=>{try{await file.sync();}finally{await file.close();}})();}return rawClose;
 }
 async function finalizeSession():Promise<void>{
  finalizing=true;
  if(!finalQueries){finalQueries=(async()=>{if(collector){try{await query('after');await runtime();}catch{fail('final-target-query');}}})();}
  await finalQueries;
  if(!detach)detach=bounded('detach',()=>inputs.session.detach(),10000,true);await detach;
 }
 async function closeRunner():Promise<void>{
  if(!runnerClose)runnerClose=(async()=>{
   runnerClosing=true;receipt.runner.close='pending';try{await bounded('runner-close',()=>inputs.runner.close(),10000,true);receipt.runner.close='fulfilled';}catch{receipt.runner.close=receipt.operations.find(op=>op.kind==='runner-close')?.state??'not-dispatched';fail('runner-close');}
   try{const result=await bounded('runner-wait',()=>inputs.runner.wait(),10000,true);const exitCode=own(result,'exitCode'),signal=own(result,'signal');if((exitCode!==null&&(typeof exitCode!=='number'||!Number.isSafeInteger(exitCode)||exitCode<0||exitCode>255))||(signal!==null&&(typeof signal!=='string'||!/^SIG[A-Z0-9]{1,12}$/.test(signal))))throw unavailable();receipt.runner.wait={exitCode:exitCode as number|null,signal:signal as string|null};if(exitCode!==0||signal!==null)fail('runner-exit');}catch{fail('runner-wait');}
  })();return runnerClose;
 }
 async function writeRole(role:Role,value:unknown):Promise<void>{
  const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>ROLE_CAPS[role])throw unavailable();
  const file=await fs.open(join(outputDirectory,role),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);receipt.createdRoles.push(role);
  try{const stat=await file.stat();if(!stat.isFile()||stat.nlink!==1)throw unavailable();const ack=await file.write(bytes,0,bytes.length,null);if(ack.bytesWritten!==bytes.length)throw unavailable();await file.sync();}finally{await file.close();}
 }
 async function seal():Promise<ProtoNativeCaptureReceipt>{
  await closeRunner();
  for(const remove of removers){try{remove();}catch{fail('observer-removal');}}removers.length=0;
  if(ownerTimerSet){ownerTimerSet=false;try{inputs.clock.clearTimer(ownerTimer);}catch{fail('owner-timer-clear');}}
  receipt.transport=collector?.snapshot()??null;
  const transport=receipt.transport;
  if(!receipt.failureCount&&transport?.outcome==='protocol-closed'){
   try{const bytes=await bounded('trace-readback',()=>hashRegular(join(outputDirectory,'trace.pftrace'),transport.acknowledgedWrittenBytes,ROLE_CAPS['trace.pftrace'],rawIdentity));if(bytes.sha256!==transport.acknowledgedPrefixSha256)throw unavailable();receipt.persisted=bytes;receipt.persistedWholeInput='verified';}catch{fail('persisted-readback');}
  }
  receipt.status=snapshot().originalOperationsSettled?'unavailable':'pending';if(!receipt.failureCount&&receipt.persistedWholeInput==='verified'&&receipt.runner.close==='fulfilled'&&receipt.runner.wait?.exitCode===0)receipt.status='closed';
  if(directoryOwned){
   for(const[role,value]of [['capture.json',receipt.transport],['target.json',receipt.target],['marks.json',receipt.marks]]as const){try{await bounded('write-'+role,()=>writeRole(role,value));}catch{fail('metadata-write');}}
   receipt.status=snapshot().originalOperationsSettled?receipt.status:'pending';if(receipt.failureCount&&receipt.status==='closed')receipt.status='unavailable';
   try{await bounded('write-receipt',()=>writeRole('receipt.json',snapshot()));}catch{fail('receipt-write');receipt.status='unavailable';}
  }
  if(receipt.operations.some(op=>op.state==='pending')||collector?.snapshot().originalOperationsSettled===false)receipt.status='pending';
  ended=true;return snapshot();
 }
 async function cleanup():Promise<ProtoNativeCaptureReceipt>{
  try{if(collector)await collector.close();else{try{await bounded('raw-close',closeRaw,10000,true);}finally{await finalizeSession();}}}catch{fail('cleanup');}return seal();
 }
 // This frame returns only fixed primitives/two independent rows. The complete
 // reader result and all candidate aliases die before output serialization.
 function projectPrivate():PrivatePhaseDiagnostic{
  const refuse=refusePhase;
  try{
   const t=receipt.transport,before=receipt.target.before,after=receipt.target.after;
   let writes=0;for(const op of receipt.operations){if(op.state!=='fulfilled')return refuse('owner-not-ready');if(op.kind==='write-receipt')writes++;}
   if(finishState!=='fulfilled'||!ended||receipt.status!=='closed'||receipt.failureCount||writes!==1||receipt.marks.length!==2||receipt.marks[0]?.phase!=='start'||receipt.marks[1]?.phase!=='end'||receipt.marks.some(m=>m.state!=='fulfilled'||m.targetId!==before?.targetId)||t?.outcome!=='protocol-closed'||!t.originalOperationsSettled||!t.completeClosureObserved||t.pending.length||receipt.runner.close!=='fulfilled'||receipt.runner.wait?.exitCode!==0||receipt.runner.wait.signal!==null||!before||!after||before.targetId!==after.targetId)return refuse('owner-not-ready');
   const ref=receipt.persisted;
   if(receipt.persistedWholeInput!=='verified'||!ref||!rawIdentity||!Number.isSafeInteger(rawIdentity.dev)||!Number.isSafeInteger(rawIdentity.ino)||rawIdentity.dev<0||rawIdentity.ino<0)return refuse('input-reference-unavailable');
   let whole:WholePhaseResult,studyCode:typeof isClosedStudyFailureCode;
   try{const reader=createRequire(import.meta.url)('@chat-ui-bench/analyzer/internal/whole-annotation')as{readWholeAnnotationTrace:typeof readWholeAnnotationTrace;readWholeUserTimingTrace:typeof readWholeUserTimingTrace;readWholeUserTimingTraceV3:typeof readWholeUserTimingTraceV3;readWholeUserTimingTraceV4:typeof readWholeUserTimingTraceV4;isClosedStudyFailureCode:typeof isClosedStudyFailureCode},reference={path:join(outputDirectory,'trace.pftrace'),bytes:ref.bytes,sha256:ref.sha256};studyCode=reader.isClosedStudyFailureCode;whole=diagnosticVersion===4?reader.readWholeUserTimingTraceV4(reference,'pinned-whole-trace-user-timing-marks-diagnostic-v4'):diagnosticVersion===3?reader.readWholeUserTimingTraceV3(reference,'pinned-whole-trace-user-timing-marks-diagnostic-v3'):userTiming?reader.readWholeUserTimingTrace(reference,'pinned-whole-trace-user-timing-marks-diagnostic-v2'):reader.readWholeAnnotationTrace(reference,'pinned-whole-trace-ordered-annotations-diagnostic-v1');}catch{return refuse('reader-unavailable');}
   if(phaseCached)return phaseCached;
   const study=whole.study;
   if(whole.status!=='complete-whole-annotation-diagnostic'||!whole.fullInputVerified||!whole.structuralContainerEOF||!study||study.status!=='whole-annotation-study'||!study.framingBoundaryComplete||whole.reader.bytes!==ref.bytes||whole.reader.sha256!==ref.sha256)return diagnosticVersion===4?userTimingPhaseV4Refusal('whole-input-unavailable',wholeInputFailure(whole,studyCode)):diagnosticVersion===3?userTimingPhaseV3Refusal('whole-input-unavailable',wholeInputFailure(whole,studyCode)):refuse('whole-input-unavailable');
   if(whole.reader.before?.[0]!==String(rawIdentity.dev)||whole.reader.before?.[1]!==String(rawIdentity.ino)||whole.reader.after?.[0]!==String(rawIdentity.dev)||whole.reader.after?.[1]!==String(rawIdentity.ino))return refuse('file-identity-unavailable');
   if(study.markInventoryAdmission!=='resolved-supported-roots')return refuse('root-inventory-withheld');
   if(study.counters.losses)return refuse('state-loss-observed');
   if(study.candidates.length>128)return refuse('candidate-capacity');
   const a=receipt.marks[0]!,b=receipt.marks[1]!,prefix='native:'+runId+':'+phaseId+':';let start:PhaseCandidate|undefined,end:PhaseCandidate|undefined,outsidePrefix=0;
   for(const row of study.candidates){
    if(row.kind!=='literal_string'||row.value===null)return refuse('root-inventory-withheld');
    if(row.value===a.name){if(start)return refuse('duplicate-start');start=row;}
    else if(row.value===b.name){if(end)return refuse('duplicate-end');end=row;}
    else if(row.value.startsWith(prefix))return refuse('foreign-selected-prefix');else outsidePrefix++;
   }
   if(!start)return refuse('missing-start');if(!end)return refuse('missing-end');if(start.packetIndex>=end.packetIndex)return refuse('wire-order-unavailable');
   try{return {policy:phasePolicy,...(diagnosticVersion?{wholeInputFailure:null}:{}),status:'phase-registry-inventory-diagnostic',reason:null,runId,phaseId,targetId:before.targetId,input:{bytes:ref.bytes,sha256:ref.sha256,packetManifestSHA256:study.packetManifestSHA256,transitionManifestSHA256:study.transitionManifestSHA256},counters:{candidates:study.candidates.length,outsidePrefix,readAttempts:whole.reader.reads,packets:study.counters.packets},rows:[phaseRow(start,'start',a.name,userTiming),phaseRow(end,'end',b.name,userTiming)],authority:PHASE_AUTHORITY}as PrivatePhaseDiagnostic;}catch{return refuse('result-capacity');}
  }catch{return refuse('internal-unavailable');}
 }
 function inspectPrivate():Readonly<PrivatePhaseDiagnostic>{
  if(phaseAttempted)return phaseCached??=refusePhase('internal-unavailable');phaseAttempted=true;
  const projected=projectPrivate();if(phaseCached)return phaseCached;
  try{const checked=phaseOutput(projected);return phaseCached??=checked;}catch{return phaseCached??=refusePhase('result-capacity');}
 }
 const owner={
  start():Promise<ProtoNativeCaptureReceipt>{
   if(starting)return starting;
   starting=(async()=>{
    try{
     runId=text(inputs.runId,32);phaseId=text(inputs.phaseId,32);outputDirectory=text(inputs.outputDirectory,4096);if(resolve(outputDirectory)!==outputDirectory)throw unavailable();
     // Precharge every retained runtime field before serialization or I/O.
     runtimePins=captureRuntime(own(inputs,'runtime'));
     ownerTimer=inputs.clock.setTimer(()=>{timedOut=true;fail('owner-timeout');void collector?.close();},60000);ownerTimerSet=true;
     install();await bounded('reserve-directory',async()=>{await fs.mkdir(outputDirectory,{mode:0o700});directoryOwned=true;if(await fs.realpath(outputDirectory)!==outputDirectory)throw unavailable();});
     await bounded('write-intent',()=>writeRole('intent.json',{schemaVersion:1,policy:POLICY,runId,phaseId,runtime:{executablePath:runtimePins!.executablePath,expectedExecutableBytes:runtimePins!.expectedExecutableBytes,expectedExecutableSha256:runtimePins!.expectedExecutableSha256},analysis:'not_evaluated'}));
     await bounded('raw-open',async()=>{raw=await fs.open(join(outputDirectory,'trace.pftrace'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);receipt.createdRoles.push('trace.pftrace');if(ended||timedOut){await closeRaw();throw unavailable();}});
     const stat=await bounded('raw-stat',()=>raw!.stat());if(!stat.isFile()||stat.nlink!==1||stat.size!==0)throw unavailable();rawIdentity={dev:stat.dev,ino:stat.ino};
     await runtime();await bounded('page-enable',()=>inputs.session.send('Page.enable'));await query('before');if(receipt.failureCount||!installed||timedOut)throw unavailable();
     const publicPorts=createProtoPublicPorts({session:inputs.session,page:inputs.page,context:inputs.context,browser:inputs.browser,clock:inputs.clock,file:{write:(bytes,offset,length,position)=>raw!.write(bytes,offset,length,position),close:closeRaw}});
     const lifetime=publicPorts.lifetime;collector=createProtoTraceCollector({...publicPorts,lifetime:{...lifetime,close:finalizeSession}},POLICY);
     const started=await collector.start();if(started.stage!=='recording')throw unavailable();return snapshot();
    }catch{fail('start-unavailable');return cleanup();}
   })();return starting;
  },
  async mark(phase:'start'|'end'):Promise<ProtoNativeCaptureReceipt>{
   if(!collector||collector.snapshot().stage!=='recording'||receipt.failureCount||receipt.marks.length>=2||receipt.marks.some(row=>row.state!=='fulfilled')||phase!==(receipt.marks.length===0?'start':'end')){fail('phase-sequence');return snapshot();}
   const name=text('native:'+runId+':'+phaseId+':'+phase+':'+randomBytes(8).toString('hex'),128);
   const row={phase,name,state:'pending' as OriginalState,runId,phaseId,targetId:receipt.target.before!.targetId};receipt.marks.push(row);
   try{await bounded('mark-'+phase,()=>inputs.phase.mark(name));row.state='fulfilled';}catch{row.state=receipt.operations.find(op=>op.kind==='mark-'+phase)?.state??'rejected';fail('phase-call');}
   return snapshot();
  },
  finish():Promise<ProtoNativeCaptureReceipt>{
   if(finishing)return finishing;finishing=(async()=>{if(!collector||receipt.marks.length!==2||receipt.marks.some(row=>row.state!=='fulfilled')){fail('phase-sequence');return cleanup();}try{await collector.finish();}catch{fail('transport-finish');}return seal();})();
   void finishing.then(()=>{finishState='fulfilled';},()=>{finishState='rejected';});return finishing;
  },
  close():Promise<ProtoNativeCaptureReceipt>{if(ended)return Promise.resolve(snapshot());if(closing)return closing;fail('explicit-close');closing=cleanup();return closing;},
  snapshot,
 };
 if(userTiming)userTimingPhaseOwners.set(owner,{policy:diagnosticVersion===4?USER_TIMING_PHASE_V4_POLICY:diagnosticVersion===3?USER_TIMING_PHASE_V3_POLICY:USER_TIMING_PHASE_POLICY,inspect:inspectPrivate});else phaseOwners.set(owner,inspectPrivate as()=>Readonly<ProtoPhaseInventoryDiagnostic>);return owner;
}
