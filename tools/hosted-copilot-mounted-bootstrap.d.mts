/** Inert supplied-data exports only; importing the bootstrap does not run a CLI action. */
import type {RestoredHistoryDiagnosticPort} from '../apps/copilotkit/src/geometry.ts';
export function createRestoredHistoryDiagnosticPort(write:(bytes:Uint8Array,callback:(error?:Error|null)=>void)=>boolean):RestoredHistoryDiagnosticPort;
export function frontendSettingsCommitment(source: unknown): Readonly<{
  tuple: readonly (readonly [string, string])[];
  sha256: string;
}>;
export function validateNativePrerequisiteProvider(expected: unknown, run: unknown, artifact: unknown): Readonly<{
  sourceSha: string;
  qualification: false;
}>;
/** A projection is supplied data, not validated global closure or runtime authority. */
export function nativeGlobalClosureInput(parentCommand: unknown, partial: unknown): unknown;
export function selectMountedBootstrapMode(context:unknown):'ordinary'|'tracker-a';
export function constructMountedCaptureResult(value:unknown):unknown;
export function serializeMountedFailure(action:'prepare'|'install'|'provision'|'run'|'parent'|'child'|'native-child',error:unknown,workerImport?:'fulfilled'|'rejected'):Readonly<{name:string;raw:Uint8Array;cap:4096}>;
export function mountedTrackerAReservation(phase:string,closed:unknown,known?:unknown):Readonly<{roles:readonly Readonly<{path:string;cap:number;owner:string}>[];bytes:number;files:number}>;
export function validateOrdinaryNativePrerequisiteProvider(expected:unknown,run:unknown,artifact:unknown):Readonly<{sourceSha:string;qualification:false}>;
export function bindOpaqueNativePrerequisite(expected:unknown,receipt:unknown,raw:Uint8Array):Readonly<{bytes:number;sha256:string;qualification:false}>;
import type {TrackerATracePorts,TrackerAFileRef} from '../apps/copilotkit/runtime/mounted-tracker-a-trace.ts';
import type {CaseRecord,PolicyReason,StdioFact} from '../tests/support/hosted-copilot-mounted-policy.ts';
type Ref<P extends string> = Readonly<{path:P;bytes:number;sha256:string}>;
type ReceiptState = 'not-started'|'pending'|'fulfilled'|'rejected';
type OriginalState = 'fulfilled'|'pending'|'rejected'|'timed-out'|'unavailable';
type StageReason = 'admission'|'semantic'|'phase'|'transport'|'cleanup'|'persistence'|'missing-child'|'missing-parent';
type Stage = Readonly<{status:'not-started'|'incomplete'|'complete';reason:StageReason|null}>;
type StageTuple = readonly [Stage['status'],Stage['reason']];
type Two<T> = readonly [T,T];
type Three<T> = readonly [T,T,T];
type Four<T> = readonly [T,T,T,T];
type Five<T> = readonly [T,T,T,T,T];
type Seven<T> = readonly [T,T,T,T,T,T,T];
type Listener = readonly [ReceiptState,ReceiptState,boolean|null];
type InputDiagnostic = Readonly<{
 phase:readonly [number|null,number|null,number|null,ReceiptState,ReceiptState,ReceiptState,ReceiptState];
 checkpoints:Five<readonly [ReceiptState,boolean]>;
 anchor:readonly ['accepted'|'invalid'|'unavailable'|null,boolean|null]|null;
 pointer:ReceiptState|null;listeners:Seven<Listener>;
 scalars:readonly (readonly [number,0|1|2|3,number|null,ReceiptState,boolean])[];
 wheels:readonly (readonly [number,ReceiptState,number,number|null,number|null,number,number|null,boolean,boolean])[];
 events:readonly [number,number,number];losses:Four<readonly [true,boolean]|null>;
 overflows:Three<readonly [true,number]|null>;outcome:readonly [Stage['status'],'phase'|null];
}>;
type RawStatus = 'absent'|'known-prefix'|'complete-raw';
type Extent = 'unobserved'|'unknown'|'complete';
type Containment = 'verified'|'unverified';
type TransportDiagnostic = Readonly<{
 raw:readonly [RawStatus,Extent];listeners:Two<Listener>;
 operations:Seven<readonly [number,number,number,number,number,number|null]>;
 completion:readonly [boolean,boolean,'json'|'other'|null,'none'|'other'|null,boolean|null];
 sessionClose:readonly [boolean,boolean,boolean|null,'unobserved'|'expected-detach'|'unexpected-loss'];
 handles:readonly (readonly [1|2,'accepted'|'unexpected',number|null])[];handleOverflow:boolean;
 sink:readonly [boolean,ReceiptState,ReceiptState,ReceiptState];counts:readonly [number,number,number];
 outcome:readonly [StageTuple,Containment];
}>;
type ObservedCheckCode = 1|2|3|4|5|6;
/** Original-array indices, validated against the bounded diagnostic summaries. */
type ScalarIndex = number;
type TransportIndex = number;
type ObservedCheck = readonly [ObservedCheckCode,ScalarIndex,ScalarIndex|null,number,number];
type ReadTail = readonly [TransportIndex,boolean|null,number|null];
type CloseOrder = 0|1|2|3|4|5|6|7|8;
type Relations = readonly [ObservedCheck|null,ReadTail|null,CloseOrder];
export type TrackerAAuthenticatedDiagnostic = Readonly<{
 profileRef:Ref<'tracker-a-profile.json'>;childResultRef:Ref<'native-child-result.json'>;
 inputRef:Ref<'tracker-a-case-2-input.json'>|null;transportRef:Ref<'tracker-a-case-2-transport.json'>|null;
 rawRef:Ref<'tracker-a-case-2-trace.json'>|null;input:InputDiagnostic|null;transport:TransportDiagnostic|null;relations:Relations;
}>;
type StreamFacts = Readonly<{readableEOF:boolean;writerFinish:boolean;writerClose:boolean;writerError:boolean;seen:number;retained:number;retainedBytesKnown:boolean;overflow:boolean}>;
export type MountedCaptureResult = Readonly<{
 argv:readonly [string,string,string,string];original:Readonly<{exitCode:number|null;signal:string|null;stdoutBytes:number;stderrBytes:number;stdoutRetainedBytes:number;stderrRetainedBytes:number;closed:boolean;streamsComplete:boolean}>;
 spawned:boolean;spawnError:string|null;timedOut:boolean;terminationRequested:boolean;exitObserved:boolean;
 exit:Readonly<{exitCode:number|null;signal:string|null}>|null;closeObserved:boolean;
 streamFacts:Readonly<{stdout:StreamFacts;stderr:StreamFacts}>;descendantClosure:'unqualified';qualification:false;
}>;
type GlobalOriginalLabel = 'workerImport'|'browserLaunch'|'browserConnect'|'clientClose'|'clientDisconnected'|'browserServerClose'|'publicServerClose'|'applicationChildExit'|'applicationChildClose'|'parentWorkerClose';
type PilotAuthority = Readonly<{qualification:false;fps:'unavailable';ratio:'unavailable';scoring:false;ranking:false}>;
export type TrackerAChildPublicReport = Readonly<{
 status:'complete'|'incomplete';cases:readonly CaseRecord[];nativeInputs:readonly Readonly<{caseNumber:1;wheel:null}>[];
 primaryFailure:'prerequisite'|'browser-connect'|'case-conformance'|null;cleanupFailures:readonly ('case-close'|'client-close')[];
 qualification:false;fps:'unavailable';originals:readonly Readonly<{label:'browserConnect'|'clientClose'|'clientDisconnected';status:OriginalState}>[];
 browserVersion:string|null;caseEvidence:readonly CaseRecord[];workerImport:'fulfilled';snapshotFiles:readonly ['native-case-1.json','native-case-2.json'];mode:'tracker-json-a-pilot-v2';
 tracker:Readonly<{inputRef:Ref<'tracker-a-case-2-input.json'>|null;transportRef:Ref<'tracker-a-case-2-transport.json'>|null;semantic:Stage;capture:Stage;cleanup:Stage}>;
}>;
export type TrackerAParentPublicReport = Readonly<{
 status:'complete'|'incomplete';applicationCommand:MountedCaptureResult|null;cases:readonly CaseRecord[];caseEvidence:readonly CaseRecord[];browserVersion:string|null;
 originals:readonly Readonly<{label:GlobalOriginalLabel;status:OriginalState}>[];stdio:readonly StdioFact[];failures:readonly string[];
 qualification:false;fps:'unavailable';scope:string;mode:'tracker-json-a-pilot-v2';
 tracker:Readonly<{childResultRef:Ref<'native-child-result.json'>|null;semantic:Stage;capture:Stage;cleanup:Stage}>;
}>;
export type TrackerAFinalResult = Readonly<{
 schemaVersion:1;kind:'tracker-a-result';mode:'tracker-json-a-pilot-v2';profileRef:Ref<'tracker-a-profile.json'>|null;
 inputRef:Ref<'tracker-a-case-2-input.json'>|null;transportRef:Ref<'tracker-a-case-2-transport.json'>|null;
 raw:Readonly<{status:RawStatus;ref:Ref<'tracker-a-case-2-trace.json'>|null;extent:Extent}>;
 childResultRef:Ref<'native-child-result.json'>|null;parentPartialRef:Ref<'native-parent-partial.json'>|null;nativeResultRef:TrackerANativeResultRef|null;
 semantic:Stage;cleanup:Readonly<{case1:Stage;case2:Stage;global:Stage}>;
 capture:Readonly<{status:RawStatus;containment:Containment}>;
 projection:Readonly<{status:'unavailable'|'not-run';reason:'raw-absent'|'persistence'|'raw-incomplete'|'byte-capacity'|'separate-pure-admission-required'}>;
 scenario:Readonly<{status:'unavailable';competingMotion:'unavailable';coverage:'unestablished';target:'unestablished';clock:'unestablished'}>;authority:PilotAuthority;
}>;
export type TrackerAReportRef = Ref<'native-child-result.json'|'native-parent-partial.json'>;
export type TrackerANativeResultRef = Ref<'native-result.json'>;
export type TrackerADiagnosticWrite = (bytes:Uint8Array,callback:(error?:Error|null)=>void)=>boolean;
export type TrackerAAuthenticatedReport<T> = Readonly<{value:T;ref:TrackerAReportRef;diagnostic:TrackerAAuthenticatedDiagnostic|null}>;
export type TrackerAReportReadPorts = Readonly<{read(name:string,cap:number):Promise<Readonly<{raw:Uint8Array;bytes:number;sha256:string}>>}>;
export type TrackerAOuterPublicationPorts = Readonly<{writeNative(value:unknown):Promise<void>;authenticateNative():Promise<TrackerANativeResultRef>;writeTracker(value:TrackerAFinalResult):Promise<void>}>;
/** Policy reasons remain the SOURCE-owned closed union; facts are never diagnostic output. */
export type TrackerADiagnosticPolicy = readonly ['accepted'|'invalid'|'unavailable',PolicyReason|null];
export function writeTrackerAPilotFile(directory:string,name:string,raw:Uint8Array,allocatedCap?:number):Promise<Readonly<{path:string;bytes:number;sha256:string}>>;
export function createTrackerATraceSink(ports:{reserve():Promise<void>;open():Promise<{write(bytes:Uint8Array):Promise<void>;fsync():Promise<void>;close():Promise<void>}>;authenticate():Promise<TrackerAFileRef>}):Promise<TrackerATracePorts['sink']>;
export function constructTrackerAChildResult(native:unknown,persistence:unknown):unknown;
export function constructTrackerAResult(value:unknown):TrackerAFinalResult;
export function publishTrackerAResults(value:unknown,ports:TrackerAOuterPublicationPorts):Promise<TrackerAFinalResult>;
export function constructTrackerAProfile(intent:unknown,native:unknown,intentRef:unknown):unknown;
export function validateTrackerAProfile(profile:unknown,intent:unknown,intentRef:unknown):unknown;
export function planTrackerAStartup(prerequisites:unknown,assets:unknown,registryBytes:Uint8Array,parentArgv:unknown,childArgv:unknown):Readonly<{registryBytes:number;optionsBytes:number;parentStartedBytes:number;applicationStartedBytes:number}>;
export function validateTrackerAOptions(options:unknown,prerequisites:unknown,assets:unknown):unknown;
export function authenticateTrackerARegistry(directory:string,sourceRoot:string):Promise<Readonly<{raw:Uint8Array;bytes:number;sha256:string}>>;
export function acquireTrackerANativePrerequisite(expected:unknown,ports:{run():Promise<{raw:Uint8Array;receipt:unknown}>;artifact():Promise<{raw:Uint8Array;receipt:unknown}>;archive(bytes:number):Promise<{raw:Uint8Array;receipt:unknown}>}):Promise<unknown>;
export function invokeTrackerAWorker(value:unknown,ports:{importWorker():Promise<{runNativeMountedTrackerAPilot?:(options:unknown,diagnostics:unknown,publication:unknown)=>Promise<unknown>}>;diagnostics:unknown;publication:{profileRef:unknown;reserveTraceSink():Promise<TrackerATracePorts['sink']>}}):Promise<unknown>;
export function constructTrackerAParentPartial(value:unknown):unknown;
export function constructTrackerANativeResult(value:unknown):unknown;
export function closeTrackerAPilotFile<T>(raw:Uint8Array,writer:{write(raw:Uint8Array):Promise<void>;fsync():Promise<void>;close():Promise<void>},authenticate:()=>Promise<T>):Promise<T>;
export function runTrackerAPilotAction(action:'prepare'|'install'|'provision'|'inventory'|'failure-inventory'|'child'|'parent'|'run',perform:()=>Promise<unknown>,setExit:(code:number)=>void):Promise<void>;
export function handleMountedBootstrapFailure(error:unknown,setExit:(code:number)=>void,report:(error:unknown)=>Promise<void>):Promise<void>;
export function publishTrackerAInternalReport(action:'child'|'parent',value:unknown,publish:(value:unknown)=>Promise<unknown>):Promise<'complete'|'incomplete'>;
export function authenticateTrackerAReport(command:unknown,action:'child',profileRef:unknown,ports:TrackerAReportReadPorts):Promise<TrackerAAuthenticatedReport<TrackerAChildPublicReport>>;
export function authenticateTrackerAReport(command:unknown,action:'parent',profileRef:unknown,ports:TrackerAReportReadPorts):Promise<TrackerAAuthenticatedReport<TrackerAParentPublicReport>>;
export function authenticateTrackerAReport(command:unknown,action:'child'|'parent',profileRef:unknown,ports:TrackerAReportReadPorts):Promise<TrackerAAuthenticatedReport<TrackerAChildPublicReport|TrackerAParentPublicReport>>;
export function constructTrackerAIncompleteDiagnostic(value:unknown,final:TrackerAFinalResult,diagnostic:TrackerAAuthenticatedDiagnostic|null):Uint8Array;
export function publishTrackerAOuterResult(value:unknown,ports:TrackerAOuterPublicationPorts,diagnostic:Readonly<{retained:TrackerAAuthenticatedDiagnostic|null;write:TrackerADiagnosticWrite}>):Promise<'complete'|'incomplete'>;
export function writeTrackerAExceptionDiagnostic(write:TrackerADiagnosticWrite):Promise<void>;
export function assertTrackerARuntimeAbsent(directory:string,known:unknown):Promise<void>;
export function admitTrackerAInventory(profileRef:unknown,ports:{names():Promise<string[]>;read(name:string,cap:number):Promise<{raw:Uint8Array;bytes:number;sha256:string}>}):Promise<void>;
import type {TrackerAFirstFailure} from '../apps/copilotkit/runtime/mounted-tracker-a.ts';
export type TrackerAFirstFailureCapsule=Readonly<{schemaVersion:1;kind:'tracker-a-first-failure';profileRef:Ref<'tracker-a-profile.json'>;childResultRef:Ref<'native-child-result.json'>;firstFailure:TrackerAFirstFailure;qualification:false;nativeGO:false;performance:false}>;
export function copyTrackerAFirstFailureCapsule(value:unknown):TrackerAFirstFailureCapsule;
export function admitTrackerAFailureInventory(profileRef:unknown,ports:TrackerAReportReadPorts&{names():Promise<string[]>}):Promise<Readonly<{schemaVersion:1;kind:'tracker-a-failure-inventory';status:'unqualified-runtime-failure';profileRef:Ref<'tracker-a-profile.json'>;childResultRef:Ref<'native-child-result.json'>;files:readonly Readonly<{path:string;bytes:number;sha256:string;regular:true;contained:true;symlink:false}>[];absent:readonly string[];bytesBeforeInventory:number;qualification:false;nativeGO:false;performance:false}>>;
