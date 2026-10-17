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
export function writeTrackerAPilotFile(directory:string,name:string,raw:Uint8Array,allocatedCap?:number):Promise<Readonly<{path:string;bytes:number;sha256:string}>>;
export function createTrackerATraceSink(ports:{reserve():Promise<void>;open():Promise<{write(bytes:Uint8Array):Promise<void>;fsync():Promise<void>;close():Promise<void>}>;authenticate():Promise<TrackerAFileRef>}):Promise<TrackerATracePorts['sink']>;
export function constructTrackerAChildResult(native:unknown,persistence:unknown):unknown;
export function constructTrackerAResult(value:unknown):unknown;
export function publishTrackerAResults(value:unknown,ports:{writeNative(value:unknown):Promise<void>;authenticateNative():Promise<Readonly<{path:'native-result.json';bytes:number;sha256:string}>>;writeTracker(value:unknown):Promise<void>}):Promise<void>;
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
export function runTrackerAPilotAction(action:'prepare'|'install'|'provision'|'inventory'|'child'|'parent'|'run',perform:()=>Promise<unknown>,setExit:(code:number)=>void):Promise<void>;
export function handleMountedBootstrapFailure(error:unknown,setExit:(code:number)=>void,report:(error:unknown)=>Promise<void>):Promise<void>;
export function publishTrackerAInternalReport(action:'child'|'parent',value:unknown,publish:(value:unknown)=>Promise<unknown>):Promise<'complete'|'incomplete'>;
export function authenticateTrackerAReport(command:unknown,action:'child'|'parent',profileRef:unknown,ports:{read(name:string,cap:number):Promise<{raw:Uint8Array;bytes:number;sha256:string}>}):Promise<{value:any;ref:{path:string;bytes:number;sha256:string}}>;
export function publishTrackerAOuterResult(value:unknown,ports:{writeNative(value:unknown):Promise<void>;authenticateNative():Promise<Readonly<{path:'native-result.json';bytes:number;sha256:string}>>;writeTracker(value:unknown):Promise<void>}):Promise<'complete'|'incomplete'>;
export function assertTrackerARuntimeAbsent(directory:string,known:unknown):Promise<void>;
export function admitTrackerAInventory(profileRef:unknown,ports:{names():Promise<string[]>;read(name:string,cap:number):Promise<{raw:Uint8Array;bytes:number;sha256:string}>}):Promise<void>;
