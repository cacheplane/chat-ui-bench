import {test as nativeTest, expect, describe, beforeEach, afterEach, vi} from 'vitest';
import type {TestContext, TestOptions} from 'vitest';
import {AsyncLocalStorage} from 'node:async_hooks';
import {canonicalSerialize, comparisonScheduledRunSchema, comparisonIdentitySchema, createLongThreadFixture, manifestSchema} from '@chat-ui-bench/contract';
import {preOptions as originalPreOptions, mainOptions as originalMainOptions} from './comparison-page.test-helper.mts';
const preOptions = {...originalPreOptions, identity: {...originalPreOptions.identity, adapterProfile: 'threadplane-langgraph-custom-transport'}};
const mainOptions = {...originalMainOptions, identity: {...preOptions.identity}};
import type {ComparisonSlotContext} from './long-thread-run.js';
import * as fs from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
type ObservedStat = import('node:fs').Stats | import('node:fs').BigIntStats;
const fileOperations = vi.hoisted(() => ({opened: undefined as undefined | ((path: string, fd: FileHandle) => Promise<FileHandle>), statted: undefined as undefined | ((path: string, stat: ObservedStat) => ObservedStat), timing:undefined as undefined | ((kind:'open' | 'lstat',path:string) => undefined | ((failed:boolean) => void)), timingErrors:[] as unknown[],timingErrorCount:0}));
vi.mock('node:fs/promises', async importOriginal => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {...real, async lstat(...args: Parameters<typeof real.lstat>) {
    let done:undefined | ((failed:boolean) => void), failed = true;
    try {done = fileOperations.timing?.('lstat',String(args[0]));} catch (error) {fileOperations.timingErrorCount++;if (fileOperations.timingErrors.length < 8) fileOperations.timingErrors.push(error);}
    try {const stat = await real.lstat(...args); failed = false; return fileOperations.statted ? fileOperations.statted(String(args[0]), stat) : stat;}
    finally {try {done?.(failed);} catch (error) {fileOperations.timingErrorCount++;if (fileOperations.timingErrors.length < 8) fileOperations.timingErrors.push(error);}}
  }, async open(...args: Parameters<typeof real.open>) {
    let done:undefined | ((failed:boolean) => void), failed = true;
    try {done = fileOperations.timing?.('open',String(args[0]));} catch (error) {fileOperations.timingErrorCount++;if (fileOperations.timingErrors.length < 8) fileOperations.timingErrors.push(error);}
    try {const fd = await real.open(...args); failed = false; return fileOperations.opened ? fileOperations.opened(String(args[0]), fd) : fd;}
    finally {try {done?.(failed);} catch (error) {fileOperations.timingErrorCount++;if (fileOperations.timingErrors.length < 8) fileOperations.timingErrors.push(error);}}
  }};
});
import {join, relative, dirname} from 'node:path';
import {tmpdir,devNull} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ComparisonArtifactWriter} from './comparison-artifacts.js';
import {ComparisonOwnership, COMPARISON_STAGE_BUDGETS} from './comparison-ownership.js';
import {resolveComparisonThreadplaneProfile, recheckComparisonThreadplaneProfile} from './comparison-threadplane.js';
import {comparisonProvenanceAcquisitionSchema, adapterBuildSchema, comparisonInstrumentationBuildSchema} from '@chat-ui-bench/contract';
import {createHash} from 'node:crypto';
import {collectComparisonEnvironment} from './environment.js';
import type {CDPSession} from 'playwright';
import {execFile} from 'node:child_process';
import type {ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio} from 'node:child_process';
import {promisify} from 'node:util';
type SpawnObservation = {command: string; args: readonly string[]; options: SpawnOptionsWithoutStdio; child: ChildProcessWithoutNullStreams};
const processOperations = vi.hoisted(() => ({created: undefined as undefined | ((child: ChildProcessWithoutNullStreams) => void), spawned:undefined as undefined | ((observation: SpawnObservation) => void), errors:[] as unknown[]}));
vi.mock('node:child_process', async importOriginal => {
  const real = await importOriginal<typeof import('node:child_process')>();
  return {...real, spawn(...args: Parameters<typeof real.spawn>) {
    const child = real.spawn(...args);
    const actual = child as ChildProcessWithoutNullStreams, kill = actual.kill;
    const delegates = [actual.stdin,actual.stdout,actual.stderr].map(stream => ({stream,destroy:stream.destroy,emit:stream.emit}));
    const write = actual.stdin.write, end = actual.stdin.end;
    try {
      processOperations.created?.(child as ChildProcessWithoutNullStreams);
      processOperations.spawned?.({command:String(args[0]), args:Array.isArray(args[1]) ? [...args[1]] : [], options:(Array.isArray(args[1]) ? args[2] : args[1]) as SpawnOptionsWithoutStdio, child:child as ChildProcessWithoutNullStreams});
    } catch (error) {
      actual.kill = kill; actual.stdin.write = write; actual.stdin.end = end;
      for (const row of delegates) Object.assign(row.stream,{destroy:row.destroy,emit:row.emit});
      processOperations.errors.push(error);
    } // Return the REAL child for unchanged tracker observation/adoption FIRST.
    return child;
  }};
});
function context(): ComparisonSlotContext {
  const descriptor = comparisonScheduledRunSchema.parse({...preOptions.identity, schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
  const identity = comparisonIdentitySchema.parse(Object.fromEntries(Object.entries(descriptor).filter(([key]) => !['seed', 'mode', 'artifactDirectory'].includes(key))));
  return {descriptor, identity, fixture: createLongThreadFixture({seed: 1, historyCount: 100, responseBytes: 6400, journey: 'follow'}), ownership: {signal: new AbortController().signal, generation: 1, stage: 'setup', startedAtHostMs: 0, deadlineAtHostMs: 60000, remainingMs: () => 60000, assertActive() {}, async adopt() {}}, writer: {async text() {throw Error('unexpected write');}, async json() {throw Error('unexpected write');}, async append() {throw Error('unexpected write');}, async appendSerialized() {throw Error('unexpected write');}, async stream() {throw Error('unexpected stream');}}};
}
type LocalOwnerRecord = {owner:ComparisonOwnership; current:FileCase; assertGeneration:() => void; first?:ReturnType<ComparisonOwnership['dispose']>; realClosedProof:boolean};
type FileCase = {
  task:TestContext['task']; generation:number; admitted:boolean; blocked?:string; abandoned:boolean;
  body?:Promise<unknown>; bodySettled:boolean; innerCleanup?:Promise<void>; rootCleanup?:Promise<void>; cleanupSettled:boolean; safe:boolean; managed?:boolean; resourceSafe?:boolean;
  original?:OriginalCaseState; evidenceRoot?:string; evidenceDirectory?:Promise<string>; evidence:Promise<void>[]; evidenceErrors:unknown[];
  processes?:{tracker:import('./comparison-provenance.js').ObservedComparisonProcess; child:ChildProcessWithoutNullStreams | undefined; actualCloses:Promise<void>[]; closed:number}[];
  spawnErrorProof?:{task:TestContext['task']; tracker:import('./comparison-provenance.js').ObservedComparisonProcess; child:ChildProcessWithoutNullStreams; first:Promise<void>; error:Error; spawnError:Error; command:string; args:readonly string[]};
  localOwners?:LocalOwnerRecord[];
  localPaths?:Set<string>; retainPaths?:boolean; primary?:PromiseRejectedResult;
  restorations?:{restore:() => void; restored:() => boolean}[];
  restoration?:Promise<void>;
  processesStatus?:{first:string; actualClosed:number}[];
  exactIdentityDiagnostic?:ExactIdentityDiagnostic;
};
const exactIdentityBoundaries = ['FD during copy','leaf between passes','ancestor between passes','fresh after assembly','explicit pre-serving','mtimeNs','ctimeNs'] as const;
// Test harness envelope for setup, disposal and control overhead; production deadlines stay unchanged.
const provenanceIntegrationControlMarginMs = 5000;
const provenanceIntegrationBodyMs = COMPARISON_STAGE_BUDGETS.setup + COMPARISON_STAGE_BUDGETS.disposal + provenanceIntegrationControlMarginMs;
const provenanceIntegrationCaseNames = new Set<string>([
  'genuine current150 plan admits exact roles before the first destination failure',
  'registered session preserves actual member candidate on destination failure and new finalization writer persists pure partial snapshot',
  'actual source close rejection cannot publish a copied digest and independently completes the destination',
  'actual same-size source rejects pinned copy facts',
  'actual ancestor substitution rejects pinned copy facts',
  'actual source after destination completion rejects pinned copy facts',
  'actual source after all copies rejects pinned copy facts',
  'exact provenance rejects rounded identity contradiction at FD during copy',
  'exact provenance rejects rounded identity contradiction at leaf between passes',
  'exact provenance rejects rounded identity contradiction at ancestor between passes',
  'exact provenance rejects rounded identity contradiction at fresh after assembly',
  'exact provenance rejects rounded identity contradiction at explicit pre-serving',
  'exact provenance rejects rounded identity contradiction at mtimeNs',
  'exact provenance rejects rounded identity contradiction at ctimeNs',
  'actual late source open is adopted first and closes after generation revocation',
  'actual immutable instrumentation/pre-navigation.js destination cannot heal its first rejected command',
  'actual immutable provenance/acquisition.json destination cannot heal its first rejected command',
  'genuine complete101 acquisition payload persistence and actual disposal complete under production ownership',
]);
const exactIdentityCaseNames = new Set<string>(exactIdentityBoundaries.map(boundary => `exact provenance rejects rounded identity contradiction at ${boundary}`));
const exactPoints = ['body-entered','output-initializing','output-initialized','writer-initializing','writer-initialized','assertions-entered','finally-entered','teardown-before-FIRST-start','whole-body-settled'] as const;
type ExactPoint = typeof exactPoints[number];
type ExactIdentityDiagnostic = {
  current:FileCase; original:OriginalCaseState; assertGeneration:() => void; boundary:string; taskId:string; testName:string;
  dependencies:{clock:() => number; stringify:(value:unknown) => string; log:(line:string) => void};
  anchor:number | null; events:{event:string;hostElapsedMs:number | null}[]; eventAttempts:number;
  point:ExactPoint; points:Record<ExactPoint,number | null>;
  observerErrorCount:number; observerErrors:string[]; summaryIssued:boolean;
  wholeBody:{status:'pending' | 'fulfilled' | 'rejected'}; wholeBodyError:unknown;
  first:{status:'not-invoked' | 'pending' | 'fulfilled' | 'rejected'; resultStatus?:string; canContinue?:boolean}; firstError:unknown;
  stage:string; stagePromise:'not-invoked' | 'pending' | 'fulfilled' | 'rejected'; callback:string; acquisition:string; ownershipSettled:boolean;
  stageFacts:Record<string,string | number | null>; firstFacts:Record<string,string | number | null>; firstFailures:{stage:string;message:string;resource:string | null}[];
  changed:boolean; reached:boolean; streamAttempts:number; streamAdopted:number; textAttempts:number;
  workerCoverage:'not-installed' | 'installed' | 'partial'; workerObservationEnded:boolean; workers:{closes:boolean[];installed:boolean[]}[];
};
function exactObserverFailure(value:ExactIdentityDiagnostic,label:string) {
  value.observerErrorCount++; if (value.observerErrors.length < 8) value.observerErrors.push(label);
}
function exactObserve(value:ExactIdentityDiagnostic,label:string,operation:() => void) {
  try {value.assertGeneration(); operation();} catch {exactObserverFailure(value,label);}
}
function exactErrorProjection(error:unknown):Record<string,string> {
  if (typeof error !== 'object' || error === null) return {kind:'unknown'};
  const output:Record<string,string> = {};
  for (const key of ['name','message','code']) {
    const field = Object.getOwnPropertyDescriptor(error,key);
    if (field && 'value' in field && typeof field.value === 'string') output[key] = field.value.slice(0,256);
  }
  return Object.keys(output).length ? output : {kind:'unknown'};
}
function exactResultProjection(result:unknown):Record<string,string | number | null> {
  const output:Record<string,string | number | null> = {};
  if (typeof result !== 'object' || result === null) return output;
  const status = Object.getOwnPropertyDescriptor(result,'status');
  if (status && 'value' in status && typeof status.value === 'string') output.status = status.value.slice(0,32);
  const deadline = Object.getOwnPropertyDescriptor(result,'deadline');
  if (deadline && 'value' in deadline && typeof deadline.value === 'object' && deadline.value !== null) {
    for (const key of ['stage','budgetMs','startedAtHostMs','deadlineAtHostMs','finishedAtHostMs','outcome','reason']) {
      const field = Object.getOwnPropertyDescriptor(deadline.value,key);
      if (field && 'value' in field) {
        const value:unknown = field.value;
        if (typeof value === 'string') output[key] = value.slice(0,256);
        else if (typeof value === 'number' && Number.isFinite(value) || value === null) output[key] = value;
      }
    }
  }
  return output;
}
function exactElapsed(value:ExactIdentityDiagnostic):number | null {
  try {const now = value.dependencies.clock(); if (!Number.isFinite(now) || value.anchor === null) throw Error('Unavailable diagnostic clock'); const elapsed = now - value.anchor; if (!Number.isFinite(elapsed)) throw Error('Unavailable diagnostic elapsed time'); return elapsed;}
  catch {exactObserverFailure(value,'clock unavailable'); return null;}
}
function exactTiming(value:ExactIdentityDiagnostic,point:ExactPoint = value.point) {
  return {snapshotPoint:point,snapshotElapsedMs:exactElapsed(value),points:{...value.points}};
}
function snapshotExactIdentityDiagnostic(value:ExactIdentityDiagnostic,point:ExactPoint = value.point) {
  let bodyError:Record<string,string> = {kind:'unknown'}, firstError:Record<string,string> = {kind:'unknown'};
  try {bodyError = exactErrorProjection(value.wholeBodyError); firstError = exactErrorProjection(value.firstError);} catch {exactObserverFailure(value,'error projection');}
  return {taskId:value.taskId,test:value.testName,generation:value.current.generation,boundary:value.boundary.slice(0,128),clock:'host performance.now only',hostAnchorMs:value.anchor,...exactTiming(value,point),eventLimit:64,eventAttempts:value.eventAttempts,retainedEvents:value.events.length,eventTruncated:value.eventAttempts > value.events.length,encodingTruncated:false,events:value.events.map(row => ({...row})),wholeBody:{...value.wholeBody},wholeBodyError:bodyError,first:{...value.first},firstError,firstFacts:{...value.firstFacts},firstFailures:value.firstFailures.map(row => ({...row})),stage:value.stage,stagePromise:value.stagePromise,stageFacts:{...value.stageFacts},callback:value.callback,acquisition:value.acquisition,ownershipSettled:value.ownershipSettled,changed:value.changed,reached:value.reached,streamAttempts:value.streamAttempts,streamReturnedAndAdopted:value.streamAdopted,textAttempts:value.textAttempts,workerCoverage:value.workerCoverage,workerObservationEnded:value.workerObservationEnded,workers:value.workers.map(row => ({actualClose:[...row.closes],observerInstalled:[...row.installed]})),observerErrorCount:value.observerErrorCount,observerErrors:[...value.observerErrors]};
}
function exactPublish(value:ExactIdentityDiagnostic) {
  exactObserve(value,'detached publication',() => {value.original.repairFacts ??= {}; value.original.repairFacts.exactIdentityDiagnostic = snapshotExactIdentityDiagnostic(value);});
}
function exactEvent(value:ExactIdentityDiagnostic,event:string) {
  exactObserve(value,'event clock',() => {
    value.eventAttempts++;
    const elapsed = exactElapsed(value);
    if (value.events.length < 64) value.events.push({event:event.slice(0,96),hostElapsedMs:elapsed});
  }); exactPublish(value);
}
function exactPoint(value:ExactIdentityDiagnostic,point:ExactPoint) {
  exactObserve(value,'actual lifecycle point',() => {value.point = point; value.points[point] = exactElapsed(value);}); exactEvent(value,point);
}
function encodeExactIdentityDiagnostic(value:ExactIdentityDiagnostic):string {
  try {
    const facts = snapshotExactIdentityDiagnostic(value);
    let encoded = value.dependencies.stringify(facts);
    if (Buffer.byteLength(encoded,'utf8') <= 16384) return encoded;
    facts.events = []; facts.observerErrors = []; facts.wholeBodyError = {kind:'omitted for byte bound'}; facts.firstError = {kind:'omitted for byte bound'}; facts.eventTruncated = true; facts.encodingTruncated = true; facts.retainedEvents = 0;
    encoded = value.dependencies.stringify(facts);
    if (Buffer.byteLength(encoded,'utf8') <= 16384) return encoded;
  } catch {exactObserverFailure(value,'encoding');}
  // Generated terminal scalars only: no caller objects, custom encoder, or getters.
  return JSON.stringify({encodingFallback:true,generation:value.current.generation,...exactTiming(value),wholeBody:{status:value.wholeBody.status},first:{...value.first},stage:value.stage,stagePromise:value.stagePromise,callback:value.callback,acquisition:value.acquisition,ownershipSettled:value.ownershipSettled,changed:value.changed,reached:value.reached,streamAttempts:value.streamAttempts,streamReturnedAndAdopted:value.streamAdopted,textAttempts:value.textAttempts,eventAttempts:value.eventAttempts,eventTruncated:true,workerCoverage:value.workerCoverage,workerObservationEnded:value.workerObservationEnded,workers:value.workers.map(row => ({actualClose:[...row.closes],observerInstalled:[...row.installed]})),observerErrorCount:value.observerErrorCount});
}
function exactFailureSummary(value:ExactIdentityDiagnostic,failure:boolean) {
  if (!failure || value.summaryIssued) return;
  value.summaryIssued = true;
  try {value.assertGeneration(); value.dependencies.log(`comparison exact-identity diagnostic: ${encodeExactIdentityDiagnostic(value)}`);} catch {exactObserverFailure(value,'summary logger');}
  exactPublish(value);
}
function installExactIdentityDiagnostic(current:FileCase,original:OriginalCaseState,boundary:string,assertGeneration:() => void = () => fileCoordinator.assert(current),dependencies:Partial<ExactIdentityDiagnostic['dependencies']> = {}) {
  assertGeneration(); if (current.original !== original || current.exactIdentityDiagnostic) throw Error('Wrong captured diagnostic case');
  const ordinaryName = `exact provenance rejects rounded identity contradiction at ${boundary}`;
  const expected = exactIdentityCaseNames.has(ordinaryName) ? ordinaryName : boundary === 'fulfillment' || boundary === 'rejection' ? `exact provenance diagnostic tracks actual held whole-body ${boundary}` : undefined;
  if (!expected || current.task.name !== expected || original.name !== expected) throw Error('Unselected exact diagnostic task');
  const value:ExactIdentityDiagnostic = {current,original,boundary,taskId:current.task.id.slice(0,256),testName:original.name.slice(0,256),assertGeneration,dependencies:{clock:() => performance.now(),stringify:JSON.stringify,log:line => console.info(line),...dependencies},anchor:null,point:'body-entered',points:{'body-entered':null,'output-initializing':null,'output-initialized':null,'writer-initializing':null,'writer-initialized':null,'assertions-entered':null,'finally-entered':null,'teardown-before-FIRST-start':null,'whole-body-settled':null},events:[],eventAttempts:0,observerErrorCount:0,observerErrors:[],summaryIssued:false,wholeBody:{status:'pending'},wholeBodyError:undefined,first:{status:'not-invoked'},firstError:undefined,stage:'not-invoked',stagePromise:'not-invoked',callback:'not-invoked',acquisition:'not-invoked',stageFacts:{},firstFacts:{},firstFailures:[],ownershipSettled:false,changed:false,reached:false,streamAttempts:0,streamAdopted:0,textAttempts:0,workerCoverage:'not-installed',workerObservationEnded:false,workers:[]};
  current.exactIdentityDiagnostic = value;
  exactObserve(value,'anchor clock',() => {const anchor = value.dependencies.clock(); if (!Number.isFinite(anchor)) throw Error('Unavailable diagnostic anchor'); value.anchor = anchor;}); exactPoint(value,'body-entered'); return value;
}
function exactBodyReceipt(current:FileCase,error?:{reason:unknown}) {
  const value = current.exactIdentityDiagnostic; if (!value) return;
  exactObserve(value,'actual body receipt',() => {value.wholeBody.status = error ? 'rejected' : 'fulfilled'; if (error) value.wholeBodyError = error.reason;});
  exactPoint(value,'whole-body-settled');
  exactFailureSummary(value,!!error || current.task.result?.state === 'fail');
}
function exactTeardownDiagnostic(current:FileCase) {
  const value = current.exactIdentityDiagnostic; if (!value) return;
  exactPoint(value,'teardown-before-FIRST-start');
  exactFailureSummary(value,current.task.result?.state === 'fail' || value.wholeBody.status === 'rejected' || current.abandoned && value.wholeBody.status === 'pending');
}
function exactOwnershipSettled(current:FileCase) {
  const value = current.exactIdentityDiagnostic; if (!value) return;
  exactObserve(value,'actual ownership settlement',() => {value.ownershipSettled = true;}); exactEvent(value,'actual ownership settlement awaited');
}
function exactOperation<T>(value:ExactIdentityDiagnostic,lane:'stage' | 'callback' | 'acquisition',promise:Promise<T>):Promise<T> {
  exactObserve(value,`${lane} entered`,() => {value[lane] = 'pending'; if (lane === 'stage') value.stagePromise = 'pending';}); exactEvent(value,`actual ${lane} promise created`);
  void promise.then(result => {
    exactObserve(value,`${lane} fulfillment`,() => {
      if (lane === 'stage') {value.stagePromise = 'fulfilled'; value.stage = 'fulfilled'; value.stageFacts = exactResultProjection(result); value.stage = typeof value.stageFacts.status === 'string' ? value.stageFacts.status : 'fulfilled';}
      else value[lane] = 'fulfilled';
    }); exactEvent(value,`actual ${lane} promise fulfilled`);
  },() => {exactObserve(value,`${lane} rejection`,() => {value[lane] = 'rejected'; if (lane === 'stage') value.stagePromise = 'rejected';}); exactEvent(value,`actual ${lane} promise rejected`);}).catch(() => {});
  return promise;
}
function exactWorkerCreated(value:ExactIdentityDiagnostic,child:ChildProcessWithoutNullStreams) {
  exactObserve(value,'actual worker creation receipt',() => {
    if (value.workers.length >= 2) {value.workerCoverage = 'partial'; return;}
    const row = {closes:[false,false,false,false],installed:[false,false,false,false]}; value.workers.push(row);
    for (const [index,emitter] of [child,child.stdin,child.stdout,child.stderr].entries()) {
      exactInstallCloseObserver(value,row,index,listener => {emitter.once('close',listener);});
    }
  }); exactEvent(value,'actual worker creation received');
}
function exactInstallCloseObserver(value:ExactIdentityDiagnostic,row:{closes:boolean[];installed:boolean[]},index:number,register:(listener:() => void) => void) {
  try {register(() => {exactObserve(value,'actual worker close receipt',() => {row.closes[index] = true;}); exactEvent(value,`actual worker close lane ${index}`);}); row.installed[index] = true;}
  catch {value.workerCoverage = 'partial'; exactObserverFailure(value,'worker close observer installation');}
}
function containmentCoordinator() {
  let predecessor:FileCase | undefined, generation = 0;
  return {
    admit(task:TestContext['task']):FileCase {
      const state:FileCase = {task,generation:++generation,admitted:false,abandoned:false,bodySettled:true,cleanupSettled:false,safe:false,evidence:[],evidenceErrors:[]};
      if (predecessor && (!predecessor.cleanupSettled || !predecessor.safe)) {state.blocked = `Predecessor ${predecessor.task.id} is ${predecessor.cleanupSettled ? 'unsafe' : 'pending'}`; return state;}
      state.admitted = true; predecessor = state; return state;
    },
    assert(state:FileCase) {if (!state.admitted || predecessor !== state) throw Error(state.blocked ?? 'Wrong test generation');},
    active(state:FileCase) {this.assert(state); if (state.abandoned) throw Error('Actual test body abandoned');},
  };
}
const fileCoordinator = containmentCoordinator(), fileCases = new WeakMap<TestContext['task'],FileCase>(), actualBody = new AsyncLocalStorage<FileCase>();
function capturedFileCase():FileCase {const current = actualBody.getStore(); if (!current) throw Error('Missing actual body task'); fileCoordinator.active(current); return current;}
function trackedBody(current:FileCase, operation:() => unknown):Promise<unknown> {
  current.bodySettled = false;
  const body = Promise.resolve().then(() => actualBody.run(current,operation)).finally(() => {current.bodySettled = true;});
  current.body = body; void body.catch(() => {});
  // Observe the exact returned promise, after its trailing finally has settled.
  if (current.exactIdentityDiagnostic || exactIdentityCaseNames.has(current.task.name)) void body.then(() => exactBodyReceipt(current),reason => exactBodyReceipt(current,{reason})).catch(() => {});
  return body;
}
function test(name:string, operation:(context:TestContext) => unknown):void;
function test(name:string, options:TestOptions, operation:(context:TestContext) => unknown):void;
function test(name:string, optionsOrOperation:TestOptions | ((context:TestContext) => unknown), operation?: (context:TestContext) => unknown) {
  const options = typeof optionsOrOperation === 'function' ? {} : optionsOrOperation, body = typeof optionsOrOperation === 'function' ? optionsOrOperation : operation!;
  nativeTest(name,options,async context => {const current = fileCases.get(context.task)!; fileCoordinator.active(current); await trackedBody(current,() => body(context));});
}
namespace test {
  export function each<T>(rows:readonly T[]) {
    type Args = T extends readonly [...infer Values] ? Values : [T];
    return (name:string, optionsOrOperation:TestOptions | ((...values:Args) => unknown), operation?: (...values:Args) => unknown) => {
      const options = typeof optionsOrOperation === 'function' ? {} : optionsOrOperation, body = typeof optionsOrOperation === 'function' ? optionsOrOperation : operation!;
      return nativeTest.for(rows)(name,options,async (row,context) => {
        const current = fileCases.get(context.task)!; fileCoordinator.active(current);
        await trackedBody(current,() => body(...(Array.isArray(row) ? row : [row]) as Args));
      });
    };
  }
}
async function persistForensic(current:FileCase, name:string, facts:unknown, write:(path:string,data:string) => Promise<void> = (path,data) => fs.writeFile(path,data,{flag:'wx'})) {
  try {
    current.evidenceDirectory ??= fs.mkdtemp(join(tmpdir(),'comparison-forensic-')).then(path => {current.evidenceRoot = path; return path;});
    const directory = await current.evidenceDirectory;
    const path = join(directory,`${name}.json`);
    await write(path,JSON.stringify(facts,null,2)); console.info(`comparison forensic: ${path}`);
  } catch (error) {current.evidenceErrors.push(error); throw error;}
}
function pendingForensic(current:FileCase, facts:unknown) {
  const pending = persistForensic(current,'pending',facts); current.evidence.push(pending); void pending.catch(() => {});
}
async function preservePrimary(primary:PromiseSettledResult<unknown> | undefined, current:FileCase, evidence:() => Promise<void>) {
  await Promise.allSettled(current.evidence);
  let evidenceFailure:unknown, evidenceFailed = false;
  try {await evidence();} catch (error) {evidenceFailed = true; evidenceFailure = error;}
  if (primary?.status === 'rejected') throw primary.reason;
  if (evidenceFailed) throw evidenceFailure;
  if (current.evidenceErrors.length) throw current.evidenceErrors[0];
}
function restoreParent(current:FileCase, lane:'inner-owned-work' | 'root-owned-work', ownedWorkSettled:boolean, write?:(path:string,data:string) => Promise<void>, assertGeneration:() => void = () => fileCoordinator.assert(current)):Promise<void> {
  if (current.restoration) return current.restoration;
  const restoration = Promise.resolve().then(async () => {
    assertGeneration();
    if (!ownedWorkSettled || !current.bodySettled) throw Error('Parent restoration requires actual owned work and whole body settlement');
    let first:unknown, failed = false;
    for (const row of current.restorations ?? []) {
      try {row.restore(); if (!row.restored()) throw Error('Captured parent presence/value/argv was not restored');}
      catch (error) {current.evidenceErrors.push(error); if (!failed) {first = error; failed = true;}}
    }
    try {
      if (current.restorations?.length) await persistForensic(current,'restored',{test:current.task.name,lane,actualOwnedWorkSettled:ownedWorkSettled,actualBodySettled:current.bodySettled,restorations:current.restorations.map(row => row.restored())},write);
    } catch (error) {if (!failed) {first = error; failed = true;}}
    if (failed) throw first;
  });
  current.restoration = restoration; current.evidence.push(restoration); void restoration.catch(error => {current.safe = false; if (!current.evidenceErrors.includes(error)) current.evidenceErrors.push(error);}); return restoration;
}
type FirstDisposal = {outcome:PromiseSettledResult<unknown>; failures:readonly unknown[]; allowed:boolean};
function selectPrimary(current:FileCase, disposals:readonly FirstDisposal[], work:readonly PromiseSettledResult<unknown>[]) {
  if (current.primary) return current.primary;
  for (const row of disposals) {
    if (row.outcome.status === 'rejected') {current.primary = row.outcome; return current.primary;}
    const value = row.outcome.value;
    if (!row.allowed && typeof value === 'object' && value !== null && 'status' in value && (value.status === 'failed' || value.status === 'expired')) {
      current.primary = {status:'rejected',reason:Error(`Actual FIRST disposal ${value.status}: ${JSON.stringify({result:value,failures:row.failures})}`)}; return current.primary;
    }
  }
  const failure = work.find((row):row is PromiseRejectedResult => row.status === 'rejected');
  if (failure) current.primary = failure; return current.primary;
}
function genericPending(current:FileCase) {
  return !current.bodySettled || (current.processes ?? []).some(record => record.closed !== 4) || (current.processesStatus ?? []).some(record => record.first === 'pending');
}
async function localOutput(prefix:string):Promise<string> {
  return registeredOutput(capturedFileCase(),prefix);
}
async function registeredOutput(current:FileCase,prefix:string):Promise<string> {
  fileCoordinator.active(current); const output = await fs.mkdtemp(join(tmpdir(),prefix));
  (current.localPaths ??= new Set()).add(output); fileCoordinator.active(current); return output;
}
async function deleteSuccessPaths(current:FileCase, passed:boolean) {
  await Promise.allSettled(current.evidence);
  if (!passed || !current.safe || current.retainPaths || current.evidenceErrors.length) return;
  for (const path of current.localPaths ?? []) await fs.rm(path,{recursive:true,force:true});
}
function recordRootCleanup(current:FileCase, operation:() => Promise<void>):Promise<void> {
  if (current.rootCleanup) throw Error('Actual root cleanup cannot be retried');
  current.abandoned = true; current.cleanupSettled = false;
  const cleanup = Promise.resolve().then(operation).catch(error => {current.safe = false; throw error;}).finally(() => {current.cleanupSettled = true;});
  current.rootCleanup = cleanup; void cleanup.catch(() => {}); return cleanup;
}
beforeEach(({task}) => {
  const current = fileCoordinator.admit(task); fileCases.set(task,current);
  if (!current.admitted) throw Error(current.blocked);
  processOperations.errors = [];
});
afterEach(async ({task}) => {
  const current = fileCases.get(task)!;
  if (!current.admitted) {current.abandoned = true; return;}
  return recordRootCleanup(current,async () => {
  current.processesStatus = [];
  const processCleanup = (current.processes ?? []).map(record => {
    const status = {first:'pending',actualClosed:record.closed}; current.processesStatus!.push(status);
    const first = record.tracker.resource.close(); void first.then(() => {status.first = 'fulfilled';},() => {status.first = 'rejected';});
    const actual = Promise.allSettled([first,...record.actualCloses]); void actual.catch(() => {}); return actual;
  });
  if (!current.managed && genericPending(current)) pendingForensic(current,{taskId:task.id,test:task.name,state:'pending',bodySettled:current.bodySettled,resources:(current.processes ?? []).map((row,index) => ({actualClosed:row.closed,first:current.processesStatus?.[index]?.first ?? 'N/A'}))});
  const outcomes = await Promise.allSettled([current.innerCleanup,current.body]);
  const processOutcomes = await Promise.all(processCleanup);
  await Promise.allSettled(current.evidence);
  fileCoordinator.assert(current);
  await restoreParent(current,'root-owned-work',!genericPending(current)).catch(() => {});
  fileOperations.opened = undefined; fileOperations.statted = undefined; fileOperations.timing = undefined; processOperations.created = undefined; processOperations.spawned = undefined;
  current.safe = current.managed ? current.safe : outcomes.every(row => row.status === 'fulfilled');
  const resourceDisposals:FirstDisposal[] = [];
  expect(processOutcomes).toHaveLength(current.processes?.length ?? 0);
  for (const [index,record] of (current.processes ?? []).entries()) {
    const result = processOutcomes[index]?.[0]; if (!result) throw Error('Missing actual process close outcome');
    const proof = current.spawnErrorProof;
    const expectedSpawnFailure = task.name === spawnErrorCaseName && current.processes?.length === 1 && outcomes[1].status === 'fulfilled' && current.bodySettled && proof?.task === task && proof.tracker === record.tracker && proof.child === record.child && proof.first === record.tracker.resource.close() && result.status === 'rejected' && result.reason === proof.error && proof.error.message === 'comparison-process-cleanup-failed' && validSpawnErrorBinding(proof) && record.closed === 4 && processOutcomes[index]?.slice(1).length === 4 && processOutcomes[index]?.slice(1).every(row => row.status === 'fulfilled') && processOperations.errors.length === 0 && current.evidenceErrors.length === 0 && (current.restorations ?? []).every(row => row.restored());
    const expectedCommandFailure = expectedSpawnFailure || (['failed direct kill cannot settle safety before actual child close and preserves shared rejection','one actual pipe destroy rejection does not prevent every other destroy and direct kill'].includes(task.name) && outcomes[1].status === 'fulfilled');
    if (record.closed !== 4 || (result.status === 'rejected' && !expectedCommandFailure)) current.safe = false;
    if (!expectedCommandFailure) resourceDisposals.push({outcome:result,failures:[],allowed:false});
  }
  const primary = selectPrimary(current,resourceDisposals,outcomes);
  if (processOperations.errors.length) {current.safe = false; current.primary ??= {status:'rejected',reason:processOperations.errors[0]};}
  if (!current.safe) current.primary ??= {status:'rejected',reason:Error('Actual test resource containment is unsafe')};
  current.resourceSafe ??= current.safe;
  if (current.evidenceErrors.length) current.safe = false;
  if (current.primary || current.evidenceErrors.length || current.processes?.length) {
    try {await preservePrimary(current.primary ?? primary,current,() => persistForensic(current,current.safe ? 'root-settled' : 'root-unsafe',{taskId:task.id,test:task.name,bodySettled:current.bodySettled,resourceSafe:current.resourceSafe ?? current.safe,admissionSafe:current.safe,resources:(current.processes ?? []).map((row,index) => ({actualClosed:row.closed,first:current.processesStatus?.[index]?.first ?? 'N/A'})),spawnErrorProof:current.spawnErrorProof ? {command:current.spawnErrorProof.command,args:current.spawnErrorProof.args,spawnfile:current.spawnErrorProof.child.spawnfile,spawnargs:current.spawnErrorProof.child.spawnargs,originalSpawnError:spawnErrorFacts(current.spawnErrorProof.spawnError),firstCloseMessage:current.spawnErrorProof.error.message,actualBindingVerified:validSpawnErrorBinding(current.spawnErrorProof)} : null,primary:current.primary?.reason instanceof Error ? current.primary.reason.message : current.primary ? 'non-Error' : null,evidenceErrors:current.evidenceErrors.map(row => row instanceof Error ? row.message : 'non-Error'),localPaths:[...(current.localPaths ?? [])]}));} catch (error) {current.safe = false; throw error;}
  }
  await deleteSuccessPaths(current,task.result?.state === 'pass' && outcomes.every(row => row.status === 'fulfilled'));
  });
});
function observedProcess(...args:Parameters<typeof api.createObservedComparisonProcess>) {
  const current = capturedFileCase(), previous = processOperations.created;
  const record = {tracker:undefined as unknown as import('./comparison-provenance.js').ObservedComparisonProcess,child:undefined as ChildProcessWithoutNullStreams | undefined,actualCloses:[] as Promise<void>[],closed:0};
  processOperations.created = child => {
    record.child = child;
    record.actualCloses = [child,child.stdin,child.stdout,child.stderr].map(emitter => new Promise<void>(resolve => {emitter.once('close',() => {record.closed++; resolve();});}));
    previous?.(child);
  };
  try {record.tracker = api.createObservedComparisonProcess(...args); void record.tracker.result.catch(() => {}); (current.processes ??= []).push(record); return record.tracker;}
  finally {processOperations.created = previous;}
}
const localOwnerRecords = new WeakMap<ComparisonOwnership,LocalOwnerRecord>();
function registerLocalOwner(current:FileCase,owner:ComparisonOwnership,assertGeneration:() => void = () => fileCoordinator.assert(current)):LocalOwnerRecord {
  assertGeneration();
  if (localOwnerRecords.has(owner)) throw Error('Local owner already registered');
  const record:LocalOwnerRecord = {owner,current,assertGeneration,realClosedProof:false};
  localOwnerRecords.set(owner,record); (current.localOwners ??= []).push(record); return record;
}
function firstLocalDisposal(owner:ComparisonOwnership):ReturnType<ComparisonOwnership['dispose']> {
  const record = localOwnerRecords.get(owner); if (!record) throw Error('Unregistered local owner');
  record.assertGeneration();
  if (record.first) return record.first;
  const diagnostic = record.current.exactIdentityDiagnostic;
  if (diagnostic) {exactObserve(diagnostic,'FIRST invocation',() => {diagnostic.first.status = 'pending';}); exactEvent(diagnostic,'actual FIRST disposal invoked');}
  const first = owner.dispose(); record.first = first; void first.catch(() => {});
  if (diagnostic) {
    void first.then(result => {
      exactObserve(diagnostic,'FIRST fulfillment',() => {diagnostic.first = {status:'fulfilled',resultStatus:result.status,canContinue:owner.canContinue}; diagnostic.firstFacts = exactResultProjection(result); diagnostic.firstFailures = owner.failures.slice(0,4).map(row => ({stage:row.stage,message:row.message.slice(0,256),resource:row.resource === null ? null : row.resource.slice(0,256)}));}); exactEvent(diagnostic,'actual FIRST disposal fulfilled');
    },reason => {
      exactObserve(diagnostic,'FIRST rejection',() => {diagnostic.first.status = 'rejected'; diagnostic.firstError = reason;}); exactEvent(diagnostic,'actual FIRST disposal rejected');
    }).catch(() => {});
  }
  const original = record.current.original;
  if (original?.localDisposalDiagnostic) {
    const note = (name:string) => {try {fileCoordinator.assert(record.current); markOriginalCase(original,name);} catch (error) {record.current.evidenceErrors.push(error);}};
    note('actual local FIRST disposal invoked');
    void first.then(() => {note('actual local FIRST disposal fulfilled');},() => {note('actual local FIRST disposal rejected');});
  }
  return first;
}
function caseOwner(clock?:import('./comparison-ownership.js').ComparisonOwnershipClock):ComparisonOwnership {
  const current = actualBody.getStore(); if (current) fileCoordinator.active(current);
  const owner = new ComparisonOwnership(clock);
  if (current?.original && !current.original.gate) {
    registerLocalOwner(current,owner);
  }
  return owner;
}
function challengeParent(current:FileCase, values:Record<string,string>, argv?:string[]) {
  fileCoordinator.active(current);
  const saved = Object.entries(values).map(([key]) => ({key,present:Object.hasOwn(process.env,key),value:process.env[key]})), originalArgv = [...process.execArgv];
  let restored = false;
  (current.restorations ??= []).push({restore() {for (const row of saved) {if (row.present) process.env[row.key] = row.value; else delete process.env[row.key];} if (argv) process.execArgv.splice(0,process.execArgv.length,...originalArgv); restored = true;},restored() {return restored && saved.every(row => Object.hasOwn(process.env,row.key) === row.present && process.env[row.key] === row.value) && (!argv || JSON.stringify(process.execArgv) === JSON.stringify(originalArgv));}});
  Object.assign(process.env,values); if (argv) process.execArgv.splice(0,process.execArgv.length,...argv);
}
test.each(['fulfillment','rejection'] as const)('exact provenance diagnostic tracks actual held whole-body %s', async scenario => {
  const outer = capturedFileCase(), coordinator = containmentCoordinator(), current = coordinator.admit(outer.task);
  const original:OriginalCaseState = current.original = {name:outer.task.name,abandoned:false,preparationSettled:true,hookSettled:true,cleanupStarted:false,workSettled:false,phases:[],started:performance.now(),diagnostic:false};
  const lines:string[] = [], originalError = Error('actual held diagnostic whole-body rejection');
  const diagnostic = installExactIdentityDiagnostic(current,original,scenario,() => coordinator.assert(current),{log:line => {lines.push(line); console.info(line);}});
  const owner = new ComparisonOwnership(); registerLocalOwner(current,owner,() => coordinator.assert(current));
  let fd:FileHandle | undefined, restoreSpy:(() => void) | undefined, rawCalls:() => number = () => 0;
  let body:Promise<unknown> | undefined, callback:Promise<void> | undefined, stage:ReturnType<ComparisonOwnership['run']> | undefined;
  let releaseWork!:() => void, releaseClose!:() => void, releaseTail!:() => void, entered!:() => void;
  const workHeld = new Promise<void>(resolve => {releaseWork = resolve;}), closeHeld = new Promise<void>(resolve => {releaseClose = resolve;}), tailHeld = new Promise<void>(resolve => {releaseTail = resolve;}), entering = new Promise<void>(resolve => {entered = resolve;});
  let actualClosed = false, guardError:unknown, proofPassed = false, primary:PromiseRejectedResult | undefined, rawCount = 0;
  try {
    exactPoint(diagnostic,'output-initializing');
    const output = await localOutput('comparison-exact-source-');
    exactPoint(diagnostic,'output-initialized');
    fd = await fs.open(join(output,'held-diagnostic-fd'),'w+'); const actualFD = fd;
    const spy = vi.spyOn(owner,'dispose'); restoreSpy = () => spy.mockRestore(); rawCalls = () => spy.mock.calls.length;
    body = trackedBody(current,async () => {
      try {
        stage = exactOperation(diagnostic,'stage',owner.run('setup',ownership => {
          callback = exactOperation(diagnostic,'callback',(async () => {
            await ownership.adopt({name:'actual diagnostic held FD',async close() {await closeHeld; await actualFD.close(); actualClosed = true;}});
            entered(); await workHeld;
            try {ownership.assertActive();} catch (error) {guardError = error; throw error;}
          })()); void callback.catch(() => {}); return callback;
        })); void stage.catch(() => {});
        const result = await stage; exactPoint(diagnostic,'assertions-entered'); expect(result.status).toBe('failed'); await callback;
      } catch (error) {expect(error).toBe(guardError);}
      finally {
        exactPoint(diagnostic,'finally-entered');
        await firstLocalDisposal(owner); await owner.ownershipSettled;
        exactOwnershipSettled(current); await tailHeld;
      }
      if (scenario === 'rejection') throw originalError;
      return 'actual whole body fulfilled';
    });
    expect(body).toBe(current.body); await entering;
    const before = snapshotExactIdentityDiagnostic(diagnostic);
    expect(before).toMatchObject({wholeBody:{status:'pending'},first:{status:'not-invoked'},ownershipSettled:false});
    expect(before.workerCoverage).toBe('not-installed'); expect(before.workerObservationEnded).toBe(false);
    const first = firstLocalDisposal(owner); expect(firstLocalDisposal(owner)).toBe(first); expect(rawCalls()).toBe(1);
    current.abandoned = true; exactTeardownDiagnostic(current);
    expect(lines).toHaveLength(1); expect(lines[0]).toMatch(/^comparison exact-identity diagnostic: /);
    releaseWork(); releaseClose();
    expect((await first).status).toBe('complete'); await owner.ownershipSettled;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(actualClosed).toBe(true); await expect(actualFD.stat()).rejects.toMatchObject({code:'EBADF'});
    expect(guardError).toBeInstanceOf(Error); if (!(guardError instanceof Error)) throw Error('Missing actual guard rejection'); expect(guardError.message).toBe('Ownership generation revoked or deadline expired');
    expect(owner.failures).toHaveLength(1); expect(owner.failures[0]).toMatchObject({stage:'setup',message:'Ownership generation revoked or deadline expired',resource:null});
    expect(snapshotExactIdentityDiagnostic(diagnostic)).toMatchObject({wholeBody:{status:'pending'},first:{status:'fulfilled',resultStatus:'complete'},ownershipSettled:true,stage:'failed',callback:'rejected',workerCoverage:'not-installed',workers:[]});
    expect(before).toMatchObject({wholeBody:{status:'pending'},first:{status:'not-invoked'},ownershipSettled:false});
    expect(lines).toHaveLength(1); expect(rawCalls()).toBe(1);
    // Deliberate failed-registration coverage model, not a worker creation or close.
    const partialModel = {closes:[false,false,false,false],installed:[false,false,false,false]};
    exactInstallCloseObserver(diagnostic,partialModel,0,() => {throw Error('injected registration failure');});
    expect(partialModel).toEqual({closes:[false,false,false,false],installed:[false,false,false,false]});
    expect(diagnostic.workerCoverage).toBe('partial'); expect(diagnostic.workers).toEqual([]);
    for (let index = 0; index < 100; index++) exactEvent(diagnostic,'\u0000界'.repeat(96));
    expect(diagnostic.events).toHaveLength(64); expect(diagnostic.eventAttempts).toBeGreaterThan(100);
    const retained = snapshotExactIdentityDiagnostic(diagnostic);
    expect(retained.retainedEvents).toBe(retained.events.length); expect(retained.retainedEvents).toBe(64);
    const terminal = {wholeBody:{status:'pending'},first:{status:'fulfilled',resultStatus:'complete',canContinue:true},stage:'failed',stagePromise:'fulfilled',callback:'rejected',acquisition:'not-invoked',ownershipSettled:true,changed:false,reached:false,workerCoverage:'partial',workerObservationEnded:false,workers:[]};
    expect(retained).toMatchObject(terminal); expect(retained.stageFacts.status).toBe('failed');
    const pointFacts = {...diagnostic.points};
    const encoded = encodeExactIdentityDiagnostic(diagnostic);
    expect(Buffer.byteLength(encoded,'utf8')).toBeLessThanOrEqual(16384);
    const overflow = JSON.parse(encoded);
    expect(overflow).toMatchObject({...terminal,eventLimit:64,eventAttempts:diagnostic.eventAttempts,eventTruncated:true,encodingTruncated:true,retainedEvents:0,events:[],snapshotPoint:'finally-entered',points:pointFacts});
    expect(overflow.snapshotElapsedMs).toEqual(expect.any(Number));
    const hostile = Object.create(null); Object.defineProperty(hostile,'message',{get() {throw Error('arbitrary getter must not run');}});
    expect(exactErrorProjection(hostile)).toEqual({kind:'unknown'});
    const hugeError = Error('\u0000界'.repeat(20000)); diagnostic.wholeBodyError = hugeError;
    expect(Buffer.byteLength(encodeExactIdentityDiagnostic(diagnostic),'utf8')).toBeLessThanOrEqual(16384);
    diagnostic.wholeBodyError = undefined;
    const failureCount = diagnostic.observerErrorCount;
    const hostileProjection = new Proxy({}, {getOwnPropertyDescriptor() {throw Error('injected descriptor projection');}});
    diagnostic.firstError = hostileProjection; snapshotExactIdentityDiagnostic(diagnostic); diagnostic.firstError = undefined;
    diagnostic.dependencies.clock = () => {throw Error('injected diagnostic clock');}; exactEvent(diagnostic,'clock failure');
    expect(diagnostic.observerErrors).toContain('clock unavailable');
    diagnostic.dependencies.stringify = () => {throw Error('injected diagnostic encoder');};
    const fallback = JSON.parse(encodeExactIdentityDiagnostic(diagnostic));
    expect(fallback).toMatchObject({...terminal,encodingFallback:true,snapshotPoint:'finally-entered',snapshotElapsedMs:null,points:pointFacts,eventAttempts:diagnostic.eventAttempts,eventTruncated:true});
    let loggerFailures = 0;
    diagnostic.summaryIssued = false; diagnostic.dependencies.log = () => {loggerFailures++; throw Error('injected diagnostic logger');}; exactFailureSummary(diagnostic,true);
    expect(loggerFailures).toBe(1); expect(diagnostic.summaryIssued).toBe(true);
    expect(diagnostic.observerErrorCount).toBeGreaterThan(failureCount);
    expect(diagnostic.wholeBodyError).toBeUndefined(); expect(diagnostic.wholeBody.status).toBe('pending');
    releaseTail();
    if (scenario === 'rejection') await expect(body).rejects.toBe(originalError); else await expect(body).resolves.toBe('actual whole body fulfilled');
    expect(snapshotExactIdentityDiagnostic(diagnostic).wholeBody.status).toBe(scenario === 'rejection' ? 'rejected' : 'fulfilled');
    expect(diagnostic.wholeBodyError).toBe(scenario === 'rejection' ? originalError : undefined); expect(lines).toHaveLength(1); expect(loggerFailures).toBe(1);
    const settledFallback = JSON.parse(encodeExactIdentityDiagnostic(diagnostic));
    expect(settledFallback).toMatchObject({...terminal,wholeBody:{status:scenario === 'rejection' ? 'rejected' : 'fulfilled'},encodingFallback:true,snapshotPoint:'whole-body-settled',snapshotElapsedMs:null,points:{...pointFacts,'whole-body-settled':null}});
    const priorFacts = original.repairFacts!.exactIdentityDiagnostic;
    const actualAssert = diagnostic.assertGeneration;
    diagnostic.assertGeneration = () => {coordinator.assert({...current});}; exactEvent(diagnostic,'wrong generation');
    expect(original.repairFacts!.exactIdentityDiagnostic).toBe(priorFacts); diagnostic.assertGeneration = actualAssert;
    expect(coordinator.admit(outer.task).admitted).toBe(false);
    expect(() => coordinator.assert({...current})).toThrow('Wrong test generation');
    const successor = coordinator.admit(outer.task); let successorWrites = 0;
    expect(() => {coordinator.active(successor); successorWrites++;}).toThrow(); expect(successorWrites).toBe(0);
    proofPassed = true;
  } catch (error) {primary = {status:'rejected',reason:error};
  } finally {
    releaseWork(); releaseClose(); releaseTail();
    try {
      const first = firstLocalDisposal(owner); await Promise.allSettled([body,callback,stage,first]); await owner.ownershipSettled;
      current.resourceSafe = owner.canContinue && actualClosed && current.bodySettled;
      current.safe = current.resourceSafe && proofPassed && scenario === 'fulfillment';
      if (scenario === 'rejection') outer.retainPaths = true;
    } catch (error) {primary ??= {status:'rejected',reason:error}; current.safe = false;
    } finally {
      try {if (fd && !actualClosed) await fd.close();}
      catch (error) {primary ??= {status:'rejected',reason:error}; current.safe = false;}
      finally {try {rawCount = rawCalls(); restoreSpy?.();} catch (error) {primary ??= {status:'rejected',reason:error}; current.safe = false;}}
    }
    await recordRootCleanup(current,async () => {
      coordinator.assert(current);
      await preservePrimary(primary,outer,() => persistForensic(outer,'exact-identity-proof',{scenario,proofPassed,actualFDClosed:actualClosed,actualOwnershipSettled:diagnostic.ownershipSettled,resourceSafe:current.resourceSafe ?? false,admissionSafe:current.safe,rawDisposeCalls:rawCount,diagnostic:snapshotExactIdentityDiagnostic(diagnostic),summaryCount:lines.length,summaryBytes:lines.map(line => Buffer.byteLength(line.slice('comparison exact-identity diagnostic: '.length),'utf8')),primary:primary ? exactErrorProjection(primary.reason) : null}));
    });
    if (proofPassed) expect(coordinator.admit(outer.task).admitted).toBe(scenario === 'fulfillment');
  }
});
test.each(['complete','close-then-error'] as const)('local FIRST disposal shares actual cleanup across late body revocation %s', async scenario => {
  const current = capturedFileCase(), owner = new ComparisonOwnership(); registerLocalOwner(current,owner);
  const closeError = Error('actual local close after real FD closure');
  let output:string | undefined, fd:FileHandle | undefined, restoreSpy:(() => void) | undefined, rawCalls:() => number = () => 0;
  let primary:PromiseRejectedResult | undefined, firstOutcome:PromiseSettledResult<Awaited<ReturnType<ComparisonOwnership['dispose']>>> | undefined;
  let callbackOutcome:PromiseSettledResult<void | undefined> | undefined, stageOutcome:PromiseSettledResult<unknown> | undefined, closedStat:unknown;
  const cleanupErrors:unknown[] = [];
  let sharing = false, resultSharing = false, ownershipSettled = false, assertionBodySettled = false, rawCallCount = 0;
  let releaseBody!:() => void, releaseClose!:() => void, entered!:() => void;
  let callback:Promise<void> | undefined, stage:ReturnType<ComparisonOwnership['run']> | undefined, first:ReturnType<ComparisonOwnership['dispose']> | undefined;
  let lateFirst:ReturnType<ComparisonOwnership['dispose']> | undefined, closed = false, callbackSettled = false, guardError:unknown;
  const bodyHeld = new Promise<void>(resolve => {releaseBody = resolve;}), closeHeld = new Promise<void>(resolve => {releaseClose = resolve;}), entering = new Promise<void>(resolve => {entered = resolve;});
  try {
    output = await localOutput('comparison-local-first-held-'); fd = await fs.open(join(output,'actual-owned-file'),'w+');
    const actualFD = fd, rawDispose = vi.spyOn(owner,'dispose'); rawCalls = () => rawDispose.mock.calls.length; restoreSpy = () => rawDispose.mockRestore();
    stage = owner.run('setup',ownership => {
      callback = (async () => {
        await ownership.adopt({name:'actual local held FD',async close() {await closeHeld; await actualFD.close(); closed = true; if (scenario === 'close-then-error') throw closeError;}});
        entered(); await bodyHeld;
        try {ownership.assertActive();} catch (error) {guardError = error; throw error;}
      })().finally(() => {lateFirst = firstLocalDisposal(owner); void lateFirst.catch(() => {}); callbackSettled = true;});
      void callback.catch(() => {}); return callback;
    }); void stage.catch(() => {});
    await entering;
    first = firstLocalDisposal(owner); let firstSettled = false; void first.then(() => {firstSettled = true;},() => {firstSettled = true;});
    expect(firstLocalDisposal(owner)).toBe(first); expect(rawDispose).toHaveBeenCalledTimes(1);
    await new Promise<void>(resolve => setImmediate(resolve)); expect(firstSettled).toBe(false); expect(callbackSettled).toBe(false); expect(closed).toBe(false);
    releaseBody(); await new Promise<void>(resolve => setImmediate(resolve));
    expect(callbackSettled).toBe(true); expect(guardError).toBeInstanceOf(Error); expect(lateFirst).toBe(first); expect(closed).toBe(false);
    releaseClose();
    const [callbackResult,stageResult,firstResult] = await Promise.allSettled([callback,stage,first]); await owner.ownershipSettled;
    expect(callbackResult?.status).toBe('rejected'); if (callbackResult?.status === 'rejected') expect(callbackResult.reason).toBe(guardError);
    expect(stageResult).toMatchObject({status:'fulfilled',value:{status:'failed'}});
    if (!firstResult || firstResult.status !== 'fulfilled') throw Error('Missing actual local FIRST fulfilled result');
    sharing = lateFirst === first && firstLocalDisposal(owner) === first; const repeated = await firstLocalDisposal(owner); resultSharing = repeated === firstResult.value;
    expect(repeated).toBe(firstResult.value); expect(rawDispose).toHaveBeenCalledTimes(1);
    expect(firstResult.value.status).toBe(scenario === 'complete' ? 'complete' : 'failed'); expect(owner.canContinue).toBe(scenario === 'complete');
    expect(owner.failures.filter(row => row.stage === 'setup')).toEqual([expect.objectContaining({message:expect.stringMatching(/revoked/),resource:null})]);
    if (scenario === 'close-then-error') {expect(owner.failures.filter(row => row.resource === 'actual local held FD')).toEqual([expect.objectContaining({message:closeError.message})]); current.retainPaths = true;}
    expect(closed).toBe(true); closedStat = await actualFD.stat().then(() => 'open',error => error); expect(closedStat).toMatchObject({code:'EBADF'});
  } catch (error) {primary = {status:'rejected',reason:error};
  } finally {
    assertionBodySettled = true; releaseBody(); releaseClose();
    try {
      first ??= firstLocalDisposal(owner); void first.catch(() => {});
      const outcomes = await Promise.allSettled([callback,stage,first]); callbackOutcome = outcomes[0]; stageOutcome = outcomes[1]; firstOutcome = outcomes[2];
      await owner.ownershipSettled; ownershipSettled = true;
    } catch (error) {cleanupErrors.push(error); primary ??= {status:'rejected',reason:error};
    } finally {
      try {if (fd && !closed) {await fd.close(); closed = true;} if (fd) closedStat = await fd.stat().then(() => 'open',error => error);}
      catch (error) {cleanupErrors.push(error); primary ??= {status:'rejected',reason:error};}
      finally {try {rawCallCount = rawCalls(); restoreSpy?.();} catch (error) {cleanupErrors.push(error); primary ??= {status:'rejected',reason:error};}}
    }
  }
  if (scenario === 'close-then-error') current.retainPaths = true;
  const closedCode = typeof closedStat === 'object' && closedStat !== null && 'code' in closedStat ? closedStat.code : closedStat ?? 'N/A';
  await preservePrimary(primary,current,() => persistForensic(current,'local-first-proof',{test:current.task.name,scenario,output:output ?? 'N/A',first:firstOutcome ?? 'N/A',failures:owner.failures,canContinue:owner.canContinue,rawDisposeCalls:rawCallCount,exactPromiseShared:sharing,exactFulfilledResultShared:resultSharing,callback:callbackOutcome ?? 'N/A',stage:stageOutcome ?? 'N/A',assertionBodySettled,heldCallbackSettled:callbackSettled,actualOwnershipSettled:ownershipSettled,actualFDClosed:closed,actualPostcloseStatCode:closedCode,outerTrackedBodySettledAtEvidence:current.bodySettled,primary:primary?.reason instanceof Error ? primary.reason.message : primary ? 'non-Error' : null,cleanupErrors:cleanupErrors.map(error => error instanceof Error ? error.message : 'non-Error'),retainedFailedPaths:scenario === 'close-then-error',evidenceErrors:current.evidenceErrors.map(error => error instanceof Error ? error.message : 'non-Error')}));
});
test('shared parent restoration waits real held work and preserves inner primary when root is skipped', async ({task}) => {
  const actualCase = capturedFileCase(), coordinator = containmentCoordinator(), current = coordinator.admit(task);
  actualCase.retainPaths = true;
  const output = await localOutput('comparison-parent-restoration-held-'); current.localPaths = new Set([output]);
  const fd = await fs.open(join(output,'actual-owned-file'),'w+'), owner = new ComparisonOwnership();
  let releaseBody!:() => void, releaseClose!:() => void, entered!:() => void, bodySettled = false, closeSettled = false, restores = 0, evidenceWrites = 0;
  const bodyHeld = new Promise<void>(resolve => {releaseBody = resolve;}), closeHeld = new Promise<void>(resolve => {releaseClose = resolve;}), entering = new Promise<void>(resolve => {entered = resolve;});
  const originalEnv = {PATH:process.env.PATH,NODE_OPTIONS:process.env.NODE_OPTIONS}, originalPresence = {PATH:Object.hasOwn(process.env,'PATH'),NODE_OPTIONS:Object.hasOwn(process.env,'NODE_OPTIONS')}, argv = [...process.execArgv];
  const primary = Error('actual inner body rejection'), evidenceError = Error('restoration artifact write rejection');
  challengeParent(actualCase,{PATH:join(output,'nonexistent-path'),NODE_OPTIONS:`--require=${join(output,'nonexistent-preload.cjs')}`},['--require',join(output,'nonexistent-preload.cjs')]);
  const registered = actualCase.restorations!.pop()!;
  current.restorations = [{restore() {restores++; registered.restore();},restored:() => registered.restored()}];
  const stage = owner.run('setup',context => {
    const body = (async () => {await context.adopt({name:'actual held restoration FD',async close() {await closeHeld; await fd.close(); closeSettled = true;}}); entered(); await bodyHeld; throw primary;})().finally(() => {bodySettled = true; current.bodySettled = true;});
    current.body = body; current.bodySettled = false; void body.catch(() => {}); return body;
  }); void stage.catch(() => {});
  await entering;
  const firstDisposal = owner.dispose(); void firstDisposal.catch(() => {});
  const inner = (async () => {
    const outcomes = await Promise.allSettled([current.body,stage,firstDisposal]); await owner.ownershipSettled;
    coordinator.assert(current);
    const selected = selectPrimary(current,[{outcome:outcomes[2],failures:owner.failures,allowed:false}],[outcomes[0]]);
    const restoration = restoreParent(current,'inner-owned-work',bodySettled && closeSettled,async () => {evidenceWrites++; throw evidenceError;},() => coordinator.assert(current));
    await restoration.catch(() => {});
    expect(restoreParent(current,'root-owned-work',true,async () => {throw Error('Forbidden evidence retry');},() => coordinator.assert(current))).toBe(restoration);
    await preservePrimary(selected,current,() => persistForensic(current,'final',{test:task.name,actualBodySettled:bodySettled,actualFDClosed:closeSettled,firstDisposal:outcomes[2],actualOwnershipSettled:true,canContinue:owner.canContinue,rootFallbackInvoked:false,restores,evidenceWrites,primaryIdentityPreserved:selected?.status === 'rejected' && selected.reason === primary,evidenceErrorSeparate:current.evidenceErrors.includes(evidenceError),unsafeRetainedPaths:[output]}));
  })(); void inner.catch(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve)); expect(restores).toBe(0); expect(closeSettled).toBe(false); expect(process.env.PATH).toBe(join(output,'nonexistent-path'));
    releaseBody(); await new Promise<void>(resolve => setImmediate(resolve)); expect(bodySettled).toBe(true); expect(closeSettled).toBe(false); expect(restores).toBe(0);
    releaseClose(); await expect(inner).rejects.toBe(primary); await owner.ownershipSettled;
    expect(closeSettled).toBe(true); await expect(fd.stat()).rejects.toThrow(); expect(owner.canContinue).toBe(true);
    expect(restores).toBe(1); expect(evidenceWrites).toBe(1); expect(current.evidenceErrors).toEqual([evidenceError]); expect(current.primary?.reason).toBe(primary);
    expect(process.execArgv).toEqual(argv); for (const key of ['PATH','NODE_OPTIONS'] as const) {expect(Object.hasOwn(process.env,key)).toBe(originalPresence[key]); expect(process.env[key]).toBe(originalEnv[key]);}
    current.safe = false; current.cleanupSettled = true; expect(coordinator.admit(task).admitted).toBe(false); expect(await fs.stat(output)).toBeDefined();
  } finally {releaseBody();releaseClose();await Promise.allSettled([inner,firstDisposal,stage]);await owner.ownershipSettled; await restoreParent(current,'inner-owned-work',bodySettled && closeSettled,undefined,() => coordinator.assert(current)).catch(() => {});}
});
type ActualSpawnFacts = {command:string; args:string[]; cwd:unknown; env:NodeJS.ProcessEnv; shell:unknown; detached:unknown; stdio:unknown; hostile:Record<string,string | undefined>; argv:string[]; actualCloses:Promise<void>[]};
function spawnFacts(observation:SpawnObservation, hostileKeys:readonly string[]):ActualSpawnFacts {
  const {command,args,options,child} = observation;
  return {command,args:[...args],cwd:options.cwd,env:{...options.env},shell:options.shell,detached:options.detached,stdio:options.stdio,hostile:Object.fromEntries(hostileKeys.map(key => [key,process.env[key]])),argv:[...process.execArgv],actualCloses:[child,child.stdin,child.stdout,child.stderr].map(target => new Promise<void>(resolve => target.once('close',() => resolve())))};
}
test('containment tracks held whole-body prefix trailing work and synchronous throw', async ({task}) => {
  const coordinator = containmentCoordinator(), current = coordinator.admit(task);
  let releasePrefix!:() => void, releaseTrailing!:() => void;
  const prefix = new Promise<void>(resolve => {releasePrefix = resolve;}), trailing = new Promise<void>(resolve => {releaseTrailing = resolve;});
  let submissions = 0, restored = false;
  const body = trackedBody(current,async () => {
    await prefix;
    expect(actualBody.getStore()).toBe(current);
    try {coordinator.active(current); submissions++;} finally {await trailing;}
  });
  current.abandoned = true;
  const closing = Promise.allSettled([body]).then(outcomes => {coordinator.assert(current); restored = true; current.cleanupSettled = true; current.safe = true; return outcomes;}); void closing.catch(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve)); expect(restored).toBe(false); expect(current.bodySettled).toBe(false);
    releasePrefix(); await new Promise<void>(resolve => setImmediate(resolve)); expect(submissions).toBe(0); expect(restored).toBe(false); expect(current.bodySettled).toBe(false);
    releaseTrailing(); const outcomes = await closing; expect(outcomes[0].status).toBe('rejected'); expect(restored).toBe(true); expect(current.bodySettled).toBe(true);
    const sync = coordinator.admit({...task,id:task.id+'-sync'}), failure = Error('synchronous actual body rejection');
    await expect(trackedBody(sync,() => {throw failure;})).rejects.toBe(failure); expect(sync.bodySettled).toBe(true);
  } finally {releasePrefix(); releaseTrailing(); await closing;}
});
test('containment quarantines late predecessor before generic original and capacity seam work', async ({task}) => {
  const coordinator = containmentCoordinator(), current = coordinator.admit(task);
  let release!:() => void; const held = new Promise<void>(resolve => {release = resolve;});
  let restores = 0, work = 0; const seam = {generation:current.generation};
  const body = trackedBody(current,async () => {await held; coordinator.active(current); work++;});
  current.abandoned = true;
  const cleanup = Promise.allSettled([body]).then(() => {coordinator.assert(current); restores++; seam.generation = 0; current.safe = true; current.cleanupSettled = true;}); void cleanup.catch(() => {});
  try {
    for (const kind of ['generic','original','capacity']) {
      const blocked = coordinator.admit({...task,id:task.id+'-'+kind});
      expect(blocked).not.toBe(current); expect(blocked.admitted).toBe(false); expect(blocked.blocked).toContain('pending');
      blocked.abandoned = true; expect(() => coordinator.active(blocked)).toThrow('pending');
      expect(seam.generation).toBe(current.generation); expect(restores).toBe(0); expect(work).toBe(0);
    }
    release(); await cleanup; expect(restores).toBe(1); expect(work).toBe(0);
    const successor = coordinator.admit({...task,id:task.id+'-safe'}); expect(successor.admitted).toBe(true);
    successor.cleanupSettled = true; successor.safe = false; // A settled first disposal failure is never healed into admission.
    const unsafe = coordinator.admit({...task,id:task.id+'-unsafe'}); expect(unsafe.admitted).toBe(false); expect(unsafe.blocked).toContain('unsafe'); expect(() => coordinator.assert(current)).toThrow('Wrong test generation');
  } finally {release(); await cleanup;}
});
test('containment rejected forensic write preserves actual first cleanup failure', async ({task}) => {
  const coordinator = containmentCoordinator(), current = coordinator.admit(task), path = await fs.mkdtemp(join(tmpdir(),'comparison-evidence-precedence-'));
  current.localPaths = new Set([path]);
  const fd = await fs.open(join(path,'actual-owned.txt'),'w'), owner = new ComparisonOwnership();
  const failure = Error('first actual close completion rejected'), evidenceFailure = Error('forensic write rejected');
  let release!:() => void, entered!:() => void, closes = 0;
  const held = new Promise<void>(resolve => {release = resolve;}), ready = new Promise<void>(resolve => {entered = resolve;});
  const operation = owner.run('setup',async ownership => {await ownership.adopt({name:'actual forensic FD',async close() {closes++; await fd.close(); throw failure;}}); entered(); await held; ownership.assertActive();}); void operation.catch(() => {});
  await ready;
  const disposal = owner.dispose(); void disposal.catch(() => {}); release();
  const closing = (async () => {await operation; const result = await disposal; await owner.ownershipSettled; if (result.status === 'failed') throw failure;})(); void closing.catch(() => {});
  const primary = (await Promise.allSettled([closing]))[0];
  await expect(preservePrimary(primary,current,() => persistForensic(current,'rejected',{pending:false},async () => {throw evidenceFailure;}))).rejects.toBe(failure);
  expect(current.evidenceErrors).toEqual([evidenceFailure]); expect(closes).toBe(1); expect(owner.canContinue).toBe(false); await expect(fd.stat()).rejects.toThrow();
  expect(await fs.stat(path)).toBeDefined(); current.cleanupSettled = true; current.safe = false;
  expect(coordinator.admit({...task,id:task.id+'-after-failure'}).admitted).toBe(false);
  const evidenceOnly = coordinator.admit({...task,id:task.id+'-evidence-only'});
  await expect(preservePrimary(undefined,evidenceOnly,() => persistForensic(evidenceOnly,'only',{},async () => {throw evidenceFailure;}))).rejects.toBe(evidenceFailure);
  console.info(`comparison retained primary-failure fixture: ${path}`); // Deliberately unsafe first completion; no retry/delete.
});
test('containment held rejected pending evidence with successful final retains actual fixture', async ({task}) => {
  const coordinator = containmentCoordinator(), current = coordinator.admit(task), path = await fs.mkdtemp(join(tmpdir(),'comparison-evidence-retention-'));
  current.localPaths = new Set([path]); current.safe = true;
  let release!:() => void, entered!:() => void, settled = false;
  const held = new Promise<void>(resolve => {release = resolve;}), ready = new Promise<void>(resolve => {entered = resolve;});
  const failure = Error('actual pending evidence write rejected');
  const pending = persistForensic(current,'pending',{},async () => {entered(); await held; throw failure;}); current.evidence.push(pending); void pending.catch(() => {});
  await ready;
  const final = preservePrimary(undefined,current,() => persistForensic(current,'settled',{resourceSafe:true})).finally(() => {settled = true;}); void final.catch(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve)); expect(settled).toBe(false); expect(await fs.stat(path)).toBeDefined();
    release(); await expect(final).rejects.toBe(failure);
    expect(current.evidenceErrors).toEqual([failure]); await expect(fs.readFile(join(current.evidenceRoot!,'settled.json'),'utf8')).resolves.toContain('resourceSafe');
    await deleteSuccessPaths(current,true); expect(await fs.stat(path)).toBeDefined();
  } finally {release(); await final.catch(() => {});}
});
test.each(['failed','expired'] as const)('containment selects fulfilled %s FIRST disposal before rejected evidence', async status => {
  const current = containmentCoordinator().admit(capturedFileCase().task), path = await fs.mkdtemp(join(tmpdir(),'comparison-disposal-selection-'));
  current.localPaths = new Set([path]);
  const fd = await fs.open(join(path,'actual-owned.txt'),'w');
  let now = 0, disposalTimer!:() => void, release!:() => void;
  const held = new Promise<void>(resolve => {release = resolve;}); let closes = 0;
  const owner = new ComparisonOwnership({now:() => now,setTimer(callback,ms) {if (ms === 10000) disposalTimer = callback; return 1 as unknown as ReturnType<typeof setTimeout>;},clearTimer() {}});
  const stage = await owner.run('setup',async ownership => {await ownership.adopt({name:'actual selection FD',async close() {closes++; if (status === 'expired') await held; await fd.close(); if (status === 'failed') throw Error('actual first resource completion failed');}});});
  expect(stage.status).toBe('complete');
  const first = owner.dispose(); void first.catch(() => {});
  if (status === 'expired') {await new Promise<void>(resolve => setImmediate(resolve)); now = 10001; disposalTimer();}
  const result = await first; expect(result.status).toBe(status);
  const primary = selectPrimary(current,[{outcome:{status:'fulfilled',value:result},failures:owner.failures,allowed:false}],[]);
  expect(primary).toBeDefined(); expect(selectPrimary(current,[],[])).toBe(primary);
  const evidenceFailure = Error('selection evidence failed');
  try {await expect(preservePrimary(primary,current,() => persistForensic(current,'rejected',{},async () => {throw evidenceFailure;}))).rejects.toBe(primary!.reason); expect(primary!.reason.message).toContain(`FIRST disposal ${status}`); expect(current.evidenceErrors).toEqual([evidenceFailure]);}
  finally {release(); await owner.ownershipSettled;}
  expect(closes).toBe(1); await expect(fd.stat()).rejects.toThrow(); expect(owner.canContinue).toBe(false); expect(await fs.stat(path)).toBeDefined();
});
test('containment records generic resource pending despite actual body settlement', async () => {
  const current = capturedFileCase(); let terminate!:() => void;
  processOperations.created = child => {const kill = child.kill.bind(child); terminate = () => {kill('SIGKILL');}; child.kill = () => true;};
  const tracker = observedProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:process.cwd(),env:{NODE_DISABLE_COMPILE_CACHE:'1'}},new AbortController().signal,{cap:65});
  const record = current.processes!.at(-1)!;
  const local = containmentCoordinator().admit(current.task); local.bodySettled = true; local.processes = [record]; local.processesStatus = [{first:'pending',actualClosed:record.closed}];
  const first = tracker.resource.close(); void first.catch(() => {}); let closed = false; void first.then(() => {closed = true;});
  try {await new Promise<void>(resolve => setImmediate(resolve)); expect(closed).toBe(false); expect(genericPending(local)).toBe(true); expect(record.closed).toBeLessThan(4);}
  finally {terminate(); await first; processOperations.created = undefined;}
  expect(record.closed).toBe(4); local.processesStatus[0]!.first = 'fulfilled'; expect(genericPending(local)).toBe(false); expect(tracker.resource.close()).toBe(first);
});
test.each(['success','rejection'] as const)('containment whole root final IO %s retains predecessor admission until actual settlement', async outcome => {
  const coordinator = containmentCoordinator(), current = coordinator.admit(capturedFileCase().task);
  const path = await fs.mkdtemp(join(tmpdir(),'comparison-root-lifetime-')); current.localPaths = new Set([path]);
  let release!:() => void, entered!:() => void;
  const held = new Promise<void>(resolve => {release = resolve;}), ready = new Promise<void>(resolve => {entered = resolve;});
  const failure = Error('actual final root evidence rejected'); current.safe = true;
  const root = recordRootCleanup(current,async () => {
    coordinator.assert(current); entered(); await held;
    if (outcome === 'rejection') throw failure;
    await fs.writeFile(join(path,'actual-final.json'),'{}',{flag:'wx'});
    await deleteSuccessPaths(current,true);
  });
  await ready;
  try {
    expect(current.rootCleanup).toBe(root); expect(current.bodySettled).toBe(true); expect(current.cleanupSettled).toBe(false);
    for (const kind of ['generic','original','capacity']) {
      const successor = coordinator.admit({...current.task,id:current.task.id+'-'+kind});
      expect(successor.admitted).toBe(false); expect(successor.blocked).toContain('pending');
    }
    expect(await fs.stat(path)).toBeDefined(); release();
    if (outcome === 'rejection') {
      await expect(root).rejects.toBe(failure); expect(current.cleanupSettled).toBe(true); expect(current.safe).toBe(false);
      const successor = coordinator.admit({...current.task,id:current.task.id+'-unsafe'}); expect(successor.admitted).toBe(false); expect(successor.blocked).toContain('unsafe'); expect(await fs.stat(path)).toBeDefined();
    } else {
      await root; expect(current.cleanupSettled).toBe(true); await expect(fs.access(path)).rejects.toMatchObject({code:'ENOENT'});
      expect(coordinator.admit({...current.task,id:current.task.id+'-safe'}).admitted).toBe(true);
    }
  } finally {release(); await root.catch(() => {});}
});
test('synchronous session exists before acquisition and pure partial snapshot survives failure', async () => {
  expect(typeof api.createComparisonProvenanceSession).toBe('function');
  const session = api.createComparisonProvenanceSession(context(), '/private/tmp/no-original');
  expect(Object.isFrozen(session)).toBe(true);
  expect(session.snapshotAcquisition().acquisition).toMatchObject({status: 'partial', members: []});
  await expect(session.acquire(canonicalSerialize(preOptions), canonicalSerialize({...mainOptions, identity: {...mainOptions.identity, seed: 2}}))).rejects.toThrow('descriptor');
  expect(session.snapshotAcquisition().acquisition.status).toBe('partial');
  await expect(session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions))).rejects.toThrow('one-shot');
});
test.each(['artifactDirectory', 'seed', 'mode', 'repetition', 'round', 'scenarioId', 'caseIndex', 'adapterProfile'] as const)('each option identity %s binds independently before any IO', async key => {
  for (const side of ['pre', 'main'] as const) {
    const id = {...preOptions.identity, [key]: key === 'seed' || key === 'round' || key === 'caseIndex' ? 2 : key === 'mode' ? 'headed' : 'other'};
    const session = api.createComparisonProvenanceSession(context(), '/private/tmp/no-original');
    await expect(session.acquire(canonicalSerialize(side === 'pre' ? {...preOptions, identity: id} : preOptions), canonicalSerialize(side === 'main' ? {...mainOptions, identity: id} : mainOptions))).rejects.toThrow('descriptor');
  }
});
function rawPair(preNavigation: string, main: string) {
  const hash = createHash('sha256').update('chat-ui-bench:comparison-installer-pair:v1\n');
  for (const text of [preNavigation, main]) {const bytes = Buffer.from(text), length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.length)); hash.update(length).update(bytes);}
  return {preNavigation, main, preNavigationByteLength: Buffer.byteLength(preNavigation), mainByteLength: Buffer.byteLength(main), installerSha256: hash.digest('hex')};
}
test('raw parent output checks exact ordered grammar, original bytes and independent framed hash', () => {
  const pair = rawPair('🌍\n\ud800', '漢\\"');
  const wire = Buffer.from(JSON.stringify(pair));
  expect(api.parseComparisonAssemblyOutput(wire)).toEqual(pair);
  for (const raw of [Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), wire]), Buffer.concat([wire, Buffer.from('\n')]), Buffer.concat([wire, wire]), Buffer.from([0xff]), Buffer.from(JSON.stringify({...pair, extra: 1})), Buffer.from(JSON.stringify({...pair, installerSha256: '0'.repeat(64)})), Buffer.from(JSON.stringify({...pair, mainByteLength: pair.mainByteLength + 1})), Buffer.from(wire.toString().replace('"main":', '"main":"duplicate","main":')), Buffer.from(wire.toString().replace('"preNavigationByteLength":8', '"preNavigationByteLength":8.0'))]) {
    if (!raw.equals(wire)) expect(() => api.parseComparisonAssemblyOutput(raw)).toThrow();
  }
  expect(() => api.parseComparisonAssemblyOutput(Buffer.alloc(12583087))).toThrow('limit');
});
test('equal pair for another slot fails and forged handles cannot acquire serving authority', async () => {
  const session = api.createComparisonProvenanceSession(context(), '/private/tmp/no-original');
  const identity = {...preOptions.identity, seed: 2};
  await expect(session.acquire(canonicalSerialize({...preOptions, identity}), canonicalSerialize({...mainOptions, identity}))).rejects.toThrow('descriptor');
  expect(() => api.requireComparisonProvenanceSession({...session})).toThrow('genuine');
});
test.each(['copied snapshot', 'unbound snapshot', 'copied acquire', 'unbound acquire', 'copied recheck', 'unbound recheck'])('session method requires a genuine receiver: %s', async method => {
  const session = api.createComparisonProvenanceSession(context(), '/private/tmp/no-original-io'), copied = {...session};
  const {snapshotAcquisition, acquire, recheckBeforeServing} = session;
  if (method.endsWith('snapshot')) expect(() => method.startsWith('copied') ? copied.snapshotAcquisition() : snapshotAcquisition()).toThrow('genuine');
  else if (method.endsWith('acquire')) {
    const wrong = canonicalSerialize({...preOptions, identity:{...preOptions.identity, seed:2}});
    await expect(method.startsWith('copied') ? copied.acquire(wrong, canonicalSerialize(mainOptions)) : acquire(wrong, canonicalSerialize(mainOptions))).rejects.toThrow('genuine');
  } else await expect(method.startsWith('copied') ? copied.recheckBeforeServing() : recheckBeforeServing()).rejects.toThrow('genuine');
  expect(snapshotAcquisition.bind(session)()).toEqual(session.snapshotAcquisition());
  expect(session.snapshotAcquisition().acquisition.reason).toBe('comparison-not-yet-acquired');
});
test('factory detaches actual descriptor and pure snapshots without borrowing caller mutations', async () => {
  const ctx = context(), session = api.createComparisonProvenanceSession(ctx, '/private/tmp/no-original');
  ctx.descriptor.seed = 9;
  const detached = session.snapshotAcquisition(); detached.acquisition.reason = 'caller invented success';
  expect(session.snapshotAcquisition().acquisition.reason).toBe('comparison-not-yet-acquired');
  await expect(session.acquire(canonicalSerialize({...preOptions, identity: {...preOptions.identity, seed: 9}}), canonicalSerialize({...mainOptions, identity: {...mainOptions.identity, seed: 9}}))).rejects.toThrow('descriptor');
});
test('unsupported descriptor profile and identity disagreement reject synchronously without ownership work', () => {
  const wrong = context(); wrong.identity.round = 2;
  expect(() => api.createComparisonProvenanceSession(wrong, '/private/tmp/no-original')).toThrow('descriptor');
  const unsupported = context(); unsupported.identity.adapterProfile = unsupported.descriptor.adapterProfile = 'invented';
  expect(() => api.createComparisonProvenanceSession(unsupported, '/private/tmp/no-original')).toThrow('profile');
});
test('canonical primitive bounds and reviewed limits reject before filesystem work', async () => {
  for (const [pre, main] of [[canonicalSerialize(preOptions) + '\n', canonicalSerialize(mainOptions)], [canonicalSerialize(preOptions), canonicalSerialize({...mainOptions, limits: {...mainOptions.limits, maxRecordDepth: 1}})], ['漢'.repeat(21846), canonicalSerialize(mainOptions)], [new String(canonicalSerialize(preOptions)) as unknown as string, canonicalSerialize(mainOptions)]]) {
    const session = api.createComparisonProvenanceSession(context(), '/private/tmp/no-original-io');
    await expect(session.acquire(pre as string, main as string)).rejects.toThrow();
    expect(session.snapshotAcquisition().acquisition.members).toEqual([]);
  }
});
test('captured context methods stay bound and generation change cannot create authority', async () => {
  const ctx = context(), owner = ctx.ownership;
  owner.assertActive = function () {expect(this).toBe(owner); throw new Error('actual bound context guard');};
  const session = api.createComparisonProvenanceSession(ctx, '/private/tmp/no-original-io');
  await expect(session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions))).rejects.toThrow('actual bound');
  Object.defineProperty(owner, 'generation', {value: 2});
  await expect(session.recheckBeforeServing()).rejects.toThrow('generation');
  expect(session.snapshotAcquisition().acquisition.status).toBe('partial');
});
test('already aborted process remains observed until actual shared closure', async () => {
  const abort = new AbortController(); abort.abort();
  const tracker = observedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, abort.signal, {cap: 65});
  await expect(tracker.result).rejects.toThrow();
  await tracker.resource.close();
});
test('valid output from a live actual process does not settle until abort closes it', async () => {
  const abort = new AbortController();
  const tracker = observedProcess(process.execPath, ['-e', 'process.stdout.write("valid");setInterval(()=>{},1000)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, abort.signal, {cap: 65});
  let settled = false; void tracker.result.then(() => {settled = true;}, () => {settled = true;});
  await new Promise<void>(resolve => setImmediate(resolve)); expect(settled).toBe(false);
  abort.abort(); await expect(tracker.result).rejects.toThrow(); await tracker.resource.close();
});
const api = await import('./comparison-provenance.js').catch(() => ({})) as typeof import('./comparison-provenance.js');
test('persistent process creator is callable before any awaited handoff', () => {
  expect(typeof api.createObservedComparisonProcess).toBe('function');
});
test('observed process retains actual closure after delayed handoff', async () => {
  const tracker = observedProcess(process.execPath, ['-e', 'process.stdout.write("original")'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, new AbortController().signal, {cap: 65});
  const result = await tracker.result;
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(result.stdout.toString()).toBe('original');
  expect(tracker.resource.close()).toBe(tracker.resource.close());
  await tracker.resource.close();
});
const spawnErrorCaseName = 'observable spawn error fails without losing actual child and pipe closes';
const nonexistentSpawnExecutable = '/private/tmp/nonexistent-comparison-executable';
function spawnErrorFacts(error:Error) {
  return {code:'code' in error ? error.code : null,pathPresent:'path' in error,path:'path' in error ? error.path : null,argsPresent:'spawnargs' in error,args:'spawnargs' in error ? error.spawnargs : null};
}
function validSpawnErrorBinding(proof:NonNullable<FileCase['spawnErrorProof']>):boolean {
  const facts = spawnErrorFacts(proof.spawnError);
  return proof.command === nonexistentSpawnExecutable && proof.args.length === 0 && facts.code === 'ENOENT' && (!facts.pathPresent || facts.path === proof.command) && (!facts.argsPresent || (Array.isArray(facts.args) && facts.args.length === 0)) && (proof.child.spawnfile === undefined || proof.child.spawnfile === proof.command) && (proof.child.spawnargs === undefined || (proof.child.spawnargs.length === 1 && proof.child.spawnargs[0] === proof.command));
}
test(spawnErrorCaseName, async () => {
  const current = capturedFileCase();
  let actualChild:ChildProcessWithoutNullStreams | undefined, originalSpawnError:Error | undefined;
  const command = nonexistentSpawnExecutable, args:string[] = [];
  processOperations.created = child => {actualChild = child; child.once('error',error => {originalSpawnError = error;});};
  let tracker:import('./comparison-provenance.js').ObservedComparisonProcess;
  try {tracker = observedProcess(command,args,{cwd:process.cwd(),env:{}},new AbortController().signal,{cap:65});}
  finally {processOperations.created = undefined;}
  const observedResult = Promise.allSettled([tracker.result]);
  const [result] = await observedResult;
  expect(result?.status).toBe('rejected');
  // The actual result rejection already initiated the shared close. No early explicit close.
  const first = tracker.resource.close(), observedClose = Promise.allSettled([first]);
  expect(tracker.resource.close()).toBe(first);
  const [closed] = await observedClose;
  if (!closed || closed.status !== 'rejected' || !(closed.reason instanceof Error)) throw Error('Expected original shared close Error');
  const record = current.processes?.find(row => row.tracker === tracker);
  if (!record || !actualChild || !originalSpawnError) throw Error('Missing actual creation-turn spawn observation');
  const actualCloses = await Promise.allSettled(record.actualCloses);
  expect(actualCloses).toHaveLength(4); expect(actualCloses.every(row => row.status === 'fulfilled')).toBe(true); expect(record.closed).toBe(4);
  expect(record.child).toBe(actualChild); expect(current.processes).toHaveLength(1); expect(processOperations.errors).toEqual([]);
  expect(closed.reason.message).toBe('comparison-process-cleanup-failed');
  expect(tracker.resource.close()).toBe(first); await expect(tracker.resource.close()).rejects.toBe(closed.reason);
  const proof:NonNullable<FileCase['spawnErrorProof']> = {task:current.task,tracker,child:actualChild,first,error:closed.reason,spawnError:originalSpawnError,command,args};
  expect(validSpawnErrorBinding(proof)).toBe(true); expect(spawnErrorFacts(originalSpawnError).code).toBe('ENOENT');
  current.spawnErrorProof = proof;
});
test.each(['process.stdout.write("valid");process.exitCode=1', 'process.stderr.write("private diagnostic")', 'process.stdout.write("x".repeat(66))'])('process rejects observed lifecycle or raw output failure %#', async code => {
  const tracker = observedProcess(process.execPath, ['-e', code], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, new AbortController().signal, {cap: 65});
  await expect(tracker.result).rejects.toThrow();
  await tracker.resource.close().catch(() => {});
});
test('failed direct kill cannot settle safety before actual child close and preserves shared rejection', async () => {
  let terminate!: () => void;
  processOperations.created = child => {const kill = child.kill.bind(child); terminate = () => {kill('SIGKILL');}; child.kill = () => {throw new Error('actual kill command rejected');};};
  const abort = new AbortController();
  try {
    const tracker = observedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, abort.signal, {cap: 65});
    abort.abort(); const close = tracker.resource.close(); expect(tracker.resource.close()).toBe(close);
    let settled = false; void close.then(() => {settled = true;}, () => {settled = true;});
    await new Promise<void>(resolve => setImmediate(resolve)); expect(settled).toBe(false);
    terminate(); await expect(close).rejects.toThrow('cleanup'); await expect(tracker.result).rejects.toThrow();
    expect(tracker.resource.close()).toBe(close);
  } finally {processOperations.created = undefined; terminate?.();}
});
test('one actual pipe destroy rejection does not prevent every other destroy and direct kill', async () => {
  let destroyed = 0, killed = false;
  processOperations.created = child => {
    const kill = child.kill.bind(child); child.kill = signal => {killed = true; return kill(signal);};
    const stdinDestroy = child.stdin.destroy.bind(child.stdin), stdoutDestroy = child.stdout.destroy.bind(child.stdout), stderrDestroy = child.stderr.destroy.bind(child.stderr);
    child.stdin.destroy = error => {destroyed++; if (destroyed === 1) throw new Error('actual pipe destroy command rejected'); return stdinDestroy(error);};
    child.stdout.destroy = error => {destroyed++; return stdoutDestroy(error);};
    child.stderr.destroy = error => {destroyed++; return stderrDestroy(error);};
  };
  const abort = new AbortController();
  try {
    const tracker = observedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, abort.signal, {cap: 65});
    abort.abort(); await expect(tracker.result).rejects.toThrow('cleanup');
    expect(destroyed).toBeGreaterThanOrEqual(3); expect(killed).toBe(true);
    await expect(tracker.resource.close()).rejects.toThrow('cleanup');
  } finally {processOperations.created = undefined;}
});
test('actual stdout destruction without natural EOF cannot acquire success', async () => {
  processOperations.created = child => {setImmediate(() => child.stdout.destroy());};
  try {
    const tracker = observedProcess(process.execPath, ['-e', 'setTimeout(()=>{},10)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, new AbortController().signal, {cap: 65});
    await expect(tracker.result).rejects.toThrow(); await tracker.resource.close();
  } finally {processOperations.created = undefined;}
});
test('already observed asynchronous handoff adopts first after abort and actual settlement', async () => {
  const abort = new AbortController();
  const tracker = observedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {cwd: process.cwd(), env: {NODE_DISABLE_COMPILE_CACHE: '1'}}, abort.signal, {cap: 65});
  const handoff = Promise.resolve().then(async () => {abort.abort(); await tracker.result.catch(() => {}); return tracker;});
  const observed = await handoff; await context().ownership.adopt(observed.resource);
  await observed.resource.close(); await expect(observed.result).rejects.toThrow();
});

const parentPipeCases = [
  'false return waits callback then drain', 'false return waits drain then callback', 'true return still waits actual callback',
  'error before callback preserves failure', 'callback before drain cannot hide later error', 'actual close before callback rejects',
  'callback rejection cannot be healed by drain', 'synchronous write rejection retains actual cleanup',
  'end awaits actual finish', 'end synchronous rejection retains failure', 'end error before finish rejects', 'end actual close before finish rejects',
] as const;
test.each(parentPipeCases)('parent tracker stdin %s', async scenario => {
  const owner = new ComparisonOwnership(), bytes = Buffer.alloc(65537, 0x71);
  let callbackEntered!: () => void, endEntered!: () => void;
  const actualCallback = new Promise<void>(resolve => {callbackEntered = resolve;}), endCalled = new Promise<void>(resolve => {endEntered = resolve;});
  let callback: ((error?: Error | null) => void) | undefined, callbackError: Error | null | undefined;
  let drain!: () => void, end!: () => void, child: ChildProcessWithoutNullStreams | undefined;
  let sent: Buffer[] = [], ends = 0, actualFinish = false, suppressedDrains = 0;
  let closes: Promise<void>[] = [], writesSettled = false;
  processOperations.errors = [];
  processOperations.created = actual => {
    child = actual;
    closes = [actual, actual.stdin, actual.stdout, actual.stderr].map(emitter => new Promise<void>(resolve => {emitter.once('close', resolve);}));
    const pipe = actual.stdin, write = pipe.write.bind(pipe), originalEnd = pipe.end.bind(pipe), emit = pipe.emit.bind(pipe);
    pipe.on('finish', () => {actualFinish = true;});
    pipe.emit = ((event: string | symbol, ...args: unknown[]) => {if (event === 'drain') {suppressedDrains++; return true;} return emit(event, ...args);}) as typeof pipe.emit;
    drain = () => {emit('drain');};
    pipe.write = ((chunk: Uint8Array, done: (error?: Error | null) => void) => {
      sent.push(Buffer.from(chunk));
      if (sent.length === 1 && scenario === 'synchronous write rejection retains actual cleanup') throw Error('controlled parent write rejection');
      const actualReturn = write(chunk, error => {
        if (sent.length === 1) {callback = done; callbackError = error; callbackEntered();}
        else done(error);
      });
      return sent.length === 1 ? !(scenario.startsWith('false') || scenario === 'callback before drain cannot hide later error' || scenario === 'callback rejection cannot be healed by drain') : actualReturn;
    }) as typeof pipe.write;
    pipe.end = (() => {ends++; endEntered(); if (scenario.startsWith('end ')) {
      end = () => {originalEnd();};
      if (scenario === 'end synchronous rejection retains failure') throw Error('controlled parent end rejection');
      return pipe;
    } originalEnd(); return pipe;}) as typeof pipe.end;
  };
  let tracker: ReturnType<typeof api.createObservedComparisonProcess> | undefined, disposed = false;
  try {
    const stage = await owner.run('setup', async ownership => {
      tracker = observedProcess(process.execPath, ['-e', 'const c=require("node:crypto");let n=0,h=c.createHash("sha256");process.stdin.on("data",b=>{n+=b.length;h.update(b)});process.stdin.on("end",()=>process.stdout.write(JSON.stringify({length:n,sha256:h.digest("hex")})));'], {cwd:process.cwd(), env:{NODE_DISABLE_COMPILE_CACHE:'1'}}, ownership.signal, {cap:200});
      await ownership.adopt(tracker.resource); // FIRST follow-up, before inspecting creation observation.
      expect(processOperations.errors).toEqual([]);
      const writing = tracker.write(bytes).finally(() => {writesSettled = true;}); void writing.catch(() => {});
      const fails = !scenario.startsWith('false') && !scenario.startsWith('true') && scenario !== 'end awaits actual finish';
      if (scenario !== 'synchronous write rejection retains actual cleanup') {
        await actualCallback; expect(callbackError).toBeFalsy(); expect(callback).toBeDefined();
        expect(writesSettled).toBe(false); expect(ends).toBe(0);
        if (scenario === 'false return waits drain then callback') {drain(); await new Promise<void>(resolve => setImmediate(resolve)); expect(writesSettled).toBe(false); expect(ends).toBe(0); callback!();}
        else if (scenario === 'false return waits callback then drain') {callback!(); await new Promise<void>(resolve => setImmediate(resolve)); expect(writesSettled).toBe(false); expect(ends).toBe(0); drain();}
        else if (scenario === 'error before callback preserves failure') child!.stdin.emit('error', Error('controlled parent stdin error'));
        else if (scenario === 'callback before drain cannot hide later error') {callback!(); expect(ends).toBe(0); child!.stdin.emit('error', Error('controlled parent error before drain'));}
        else if (scenario === 'actual close before callback rejects') child!.stdin.destroy();
        else if (scenario === 'callback rejection cannot be healed by drain') {callback!(Error('controlled callback contradiction')); drain();}
        else callback!();
        if (scenario.startsWith('end ')) {
          await endCalled; expect(actualFinish).toBe(false);
          if (scenario === 'end awaits actual finish') {expect(writesSettled).toBe(false); end();}
          else if (scenario === 'end error before finish rejects') child!.stdin.emit('error', Error('controlled parent end error'));
          else if (scenario === 'end actual close before finish rejects') child!.stdin.destroy();
        }
      }
      if (fails) {await expect(writing).rejects.toThrow('stdin'); await expect(tracker.result).rejects.toThrow();}
      else {
        await writing; expect(actualFinish).toBe(true);
        const result = await tracker.result;
        expect(JSON.parse(result.stdout.toString())).toEqual({length:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')});
        expect(Buffer.concat(sent)).toEqual(bytes); expect(sent.map(row => row.length)).toEqual([65536, 1]);
      }
      expect(sent.every(row => row.length <= 65536)).toBe(true);
      expect(suppressedDrains).toBeGreaterThanOrEqual(0); // Every uncontrolled drain was withheld; only drain() reaches the production latch.
      const close = tracker.resource.close(); expect(tracker.resource.close()).toBe(close); await close; await Promise.all(closes);
    });
    expect(stage.status, JSON.stringify(owner.failures)).toBe('complete'); expect(owner.failures).toEqual([]);
    disposed = true; expect((await owner.dispose()).status).toBe('complete'); await owner.ownershipSettled; expect(owner.canContinue).toBe(true);
  } finally {
    if (!disposed) await owner.dispose(); await owner.ownershipSettled;
    processOperations.created = undefined;
  }
});

async function originalFixture(small = false, onCreated?: (root: string) => void, onPhase?: (name: string) => void, assertPreparationActive: () => void = () => {}): Promise<string> {
  assertPreparationActive();
  const created = await fs.mkdtemp(join(tmpdir(), 'comparison-acquisition-original-')); onCreated?.(created); onPhase?.('physical mkdtemp settled'); assertPreparationActive();
  const root = await fs.realpath(created); onCreated?.(root); onPhase?.('canonical realpath settled'); assertPreparationActive();
  const step = async <T>(operation: () => Promise<T>): Promise<T> => {assertPreparationActive(); const value = await operation(); assertPreparationActive(); return value;};
  const copy = async (key: string) => {await step(() => fs.mkdir(dirname(join(root, key)), {recursive: true})); await step(() => fs.copyFile(join(process.cwd(), key), join(root, key)));};
  const probe = await step(() => import(pathToFileURL(join(process.cwd(), 'apps/threadplane/probe-provenance.mjs')).href));
  const originalBuild = JSON.parse(await step(() => fs.readFile(join(process.cwd(), 'apps/threadplane/.build-evidence.json'), 'utf8')));
  const configurationKeys = ['app.ts', 'main.ts', 'host.ts', 'index.html', 'styles.css'].map(name => `apps/threadplane/src/${name}`);
  for (const key of new Set<string>([...probe.probeSourceKeys, ...Object.keys(originalBuild.sourceHashes)])) if (!small || !key.startsWith('apps/threadplane/src/') || configurationKeys.includes(key)) await step(() => copy(key));
  for (const key of Object.keys(originalBuild.assetHashes)) if (!small || key === 'index.html') await step(() => copy(`apps/threadplane/dist/${key}`));
  for (const row of originalBuild.packages) await step(() => copy(`${row.resolutionPath}/package.json`));
  for (const key of ['node_modules/typescript/package.json', `node_modules/@typescript/typescript-${process.platform}-${process.arch}/package.json`]) await step(() => copy(key));
  const native = `node_modules/@typescript/typescript-${process.platform}-${process.arch}/lib/tsc`;
  await step(() => fs.mkdir(dirname(join(root, native)), {recursive: true})); await step(() => fs.writeFile(join(root, native), 'private fixture native tool identity; never executed'));
  const require = createRequire(join(process.cwd(), 'apps/threadplane/package.json'));
  for (const name of ['@threadplane/chat', '@threadplane/langgraph', '@threadplane/render', '@threadplane/telemetry']) await step(() => copy(relative(process.cwd(), require.resolve(name))));
  await step(() => fs.cp(join(process.cwd(), 'packages/runner/dist'), join(root, 'packages/runner/dist'), {recursive: true}));
  await step(() => fs.cp(join(process.cwd(), 'packages/contract/dist'), join(root, 'packages/contract/dist'), {recursive: true}));
  await step(() => fs.cp(join(process.cwd(), 'node_modules/zod'), join(root, 'node_modules/zod'), {recursive: true}));
  await step(() => fs.mkdir(join(root, 'node_modules/@chat-ui-bench'), {recursive: true}));
  await step(() => fs.symlink('../../packages/contract', join(root, 'node_modules/@chat-ui-bench/contract')));
  if (small) {
    // A separate, genuinely checked smaller dependency inventory. These fixture
    // metadata declarations never establish compiler execution attestation.
    for (const row of originalBuild.packages) {
      if (row.name === 'typescript' || row.name.startsWith('@typescript/')) continue;
      const path = join(root, row.resolutionPath, 'package.json'), metadata = JSON.parse(await step(() => fs.readFile(path, 'utf8')));
      delete metadata.dependencies; delete metadata.peerDependencies; delete metadata.optionalDependencies;
      await step(() => fs.writeFile(path, JSON.stringify(metadata)));
    }
    const path = join(root, 'apps/threadplane/package.json'), metadata = JSON.parse(await step(() => fs.readFile(path, 'utf8')));
    metadata.dependencies = Object.fromEntries(Object.entries(metadata.dependencies).filter(([name]) => ['@angular/core', '@threadplane/chat', '@threadplane/langgraph', '@threadplane/render', '@threadplane/telemetry'].includes(name)));
    metadata.devDependencies = {};
    await step(() => fs.writeFile(path, JSON.stringify(metadata)));
    const lockPath = join(root, 'package-lock.json'), lock = JSON.parse(await step(() => fs.readFile(lockPath, 'utf8')));
    const retained = new Set([...originalBuild.packages.filter((row: {name: string}) => ['@angular/core', '@threadplane/chat', '@threadplane/langgraph', '@threadplane/render', '@threadplane/telemetry'].includes(row.name)).map((row: {resolutionPath: string}) => row.resolutionPath), 'node_modules/typescript', `node_modules/@typescript/typescript-${process.platform}-${process.arch}`, 'node_modules/playwright', 'node_modules/playwright-core', '', 'apps/threadplane', 'packages/contract']);
    lock.packages = Object.fromEntries(Object.entries(lock.packages).filter(([key]) => retained.has(key)));
    await step(() => fs.writeFile(lockPath, JSON.stringify(lock)));
  }
  onPhase?.('internal first publish entered');
  try {await step(() => publishFixtureRecords(root, onPhase, assertPreparationActive));} finally {onPhase?.('internal first publish settled');}
  return root;
}
async function publishFixtureRecords(root: string, onPhase?: (name: string) => void, assertPreparationActive: () => void = () => {}) {
  const step = async <T>(operation: () => Promise<T>, label?: string): Promise<T> => {
    assertPreparationActive(); if (label) onPhase?.(`${label} entered`);
    let value: T; try {value = await operation();} finally {if (label) onPhase?.(`${label} settled`);}
    assertPreparationActive(); return value;
  };
  const product = await step(() => import(pathToFileURL(join(root, 'apps/threadplane/provenance.mjs')).href));
  const privateProbe = await step(() => import(pathToFileURL(join(root, 'apps/threadplane/probe-provenance.mjs')).href));
  const build = await step(() => product.productBuildInventory(root), 'genuine product inventory');
  await step(() => fs.writeFile(join(root, 'apps/threadplane/.build-evidence.json'), JSON.stringify(build, null, 2) + '\n'));
  const input = await step(() => privateProbe.snapshotProbeInputs(root), 'genuine probe inputs'), compiled = await step(() => privateProbe.snapshotCompiledInputs(root), 'genuine compiled inputs');
  await step(() => fs.writeFile(join(root, 'packages/runner/.comparison-build-evidence.json'), canonicalSerialize({kind: 'comparison-instrumentation-build', formatVersion: 1, ...privateProbe.probeRecordInputs(input), compiledHashes: privateProbe.hashes(compiled)}) + '\n'));
}
type Session = import('./comparison-provenance.js').ComparisonProvenanceSession;
const nativeCloseFailureCase = 'native Git owned header rejects actual FD close rejection without mutating system files';
function ownedGate(owner = new ComparisonOwnership(), onPhase?: (name: string) => void, onRevoked?:() => void) {
  let resolveReady!: (session: Session) => void, rejectReady!: (error: unknown) => void;
  const ready = new Promise<Session>((resolve, reject) => {resolveReady = resolve; rejectReady = reject;}); void ready.catch(() => {});
  let release!: (operation: (session: Session) => Promise<void>) => void;
  const submittedOperation = new Promise<(session: Session) => Promise<void>>(resolve => {release = resolve;});
  let closing = false, submitted = false, started = false;
  let stage: ReturnType<ComparisonOwnership['run']> | undefined;
  let disposal: ReturnType<ComparisonOwnership['dispose']> | undefined;
  let callback: Promise<void> | undefined, callbackSettled = false;
  let stageResult: Awaited<ReturnType<ComparisonOwnership['run']>> | undefined, disposalResult: Awaited<ReturnType<ComparisonOwnership['dispose']>> | undefined;
  return {
    ready, owner,
    observation() {return {started, callbackSettled, stage:stageResult ?? 'N/A', disposal:disposalResult ?? 'N/A'};},
    start(prepare: (context: import('./comparison-ownership.js').ComparisonOwnershipContext) => Promise<Session>) {
      if (started || closing) throw new Error('Case preparation is one-shot'); started = true;
      stage = owner.run('setup', context => {
        callback = (async () => {
          onPhase?.('actual setup callback entered');
          const session = await prepare(context); context.assertActive();
          if (closing) throw new Error('Case abandoned before readiness');
          onPhase?.('actual readiness published'); resolveReady(session);
          const operation = await submittedOperation; context.assertActive();
          await operation(session);
        })().finally(() => {callbackSettled = true; onPhase?.('actual setup callback settled');});
        void callback.catch(() => {}); return callback;
      });
      void stage.then(result => {stageResult = result; if (result.status !== 'complete') rejectReady(new Error(`Case preparation ${result.status}: ${result.deadline.reason}`));}, rejectReady);
    },
    async run(operation: (session: Session) => Promise<void>) {
      if (closing || submitted || !started) throw new Error('Case submission is one-shot');
      await ready;
      if (closing || submitted) throw new Error('Case abandoned before submission');
      submitted = true; release(operation);
      const result = await stage!;
      expect(result.status, JSON.stringify(owner.failures)).toBe('complete');
      expect(owner.failures).toEqual([]);
    },
    async runExpired(caseName:string, operation:(session:Session) => Promise<void>) {
      if (!expiryGateNames.has(caseName)) throw Error('Expected expiry transport requires an exact reviewed case');
      if (closing || submitted || !started) throw Error('Case submission is one-shot');
      await ready; if (closing || submitted) throw Error('Case abandoned before submission');
      submitted = true; release(operation); return await stage!;
    },
    async cleanup(caseName?: string) {
      if (disposal) throw new Error('Case cleanup cannot be retried');
      closing = true; rejectReady(new Error('Case abandoned'));
      disposal = owner.dispose(); // Initiate revocation before releasing the unused latch.
      onRevoked?.(); // Release held I/O only AFTER FIRST actual disposal/revocation.
      if (!submitted) {submitted = true; release(async () => {});}
      const [result, observedStage] = await Promise.all([disposal, stage]);
      disposalResult = result;
      await callback?.catch(() => {}); await owner.ownershipSettled;
      const stageResult = observedStage;
      if (caseName === nativeCloseFailureCase) {
        expect(stageResult!.status).toBe('complete');
        expect(result.status).toBe('failed'); expect(owner.canContinue).toBe(false);
        expect(owner.failures).toEqual([expect.objectContaining({stage:'disposal', resource:'comparison-native-git-header', message:'native actual close rejection'})]);
      } else {
        expect(result.status, JSON.stringify(owner.failures)).toBe('complete');
        expect(owner.canContinue).toBe(true);
        if (caseName && expiryGateNames.has(caseName)) {
          expect(stageResult!.status).toBe('expired');
          expect(owner.failures).toEqual([
            expect.objectContaining({stage:'setup',resource:null,message:'setup absolute deadline expired'}),
            expect.objectContaining({stage:'setup',resource:null,message:'Ownership generation revoked or deadline expired'}),
          ]);
        }
      }
    },
  };
}
test('owned precondition observes fulfilled failed setup before readiness', async () => {
  const gate = ownedGate(); gate.start(async () => {throw new Error('first actual preparation failure');});
  await expect(gate.ready).rejects.toThrow('first actual preparation failure');
  await gate.cleanup(); expect(gate.owner.failures[0]!.message).toBe('first actual preparation failure');
});
test('owned precondition observes fulfilled expired setup before late readiness', async () => {
  let now = 0, expire!: () => void, release!: () => void;
  const blocked = new Promise<void>(resolve => {release = resolve;});
  const owner = new ComparisonOwnership({now: () => now, setTimer(callback) {expire = callback; return 1 as unknown as ReturnType<typeof setTimeout>;}, clearTimer() {}});
  const gate = ownedGate(owner); gate.start(async () => {await blocked; return api.createComparisonProvenanceSession(context(), '/private/tmp/no-io');});
  now = 60001; expire(); await expect(gate.ready).rejects.toThrow('expired');
  const cleaning = gate.cleanup(); release(); await cleaning;
  expect(owner.failures[0]!.message).toContain('setup absolute deadline expired');
});
test('owned precondition unused submission releases after revocation and rejects retry', async () => {
  const gate = ownedGate(); gate.start(async () => api.createComparisonProvenanceSession(context(), '/private/tmp/no-io'));
  await gate.ready; await gate.cleanup();
  expect(gate.owner.failures[0]!.message).toMatch(/revoked/);
  await expect(gate.run(async () => {throw Error('must never run');})).rejects.toThrow('one-shot');
  await expect(gate.cleanup()).rejects.toThrow('retried');
});
test('owned precondition late readiness remains rejected after abandonment', async () => {
  let release!: () => void; const blocked = new Promise<void>(resolve => {release = resolve;});
  const gate = ownedGate(); gate.start(async () => {await blocked; return api.createComparisonProvenanceSession(context(), '/private/tmp/no-io');});
  const cleaning = gate.cleanup(); await expect(gate.ready).rejects.toThrow('abandoned'); release(); await cleaning;
  expect(gate.owner.failures[0]!.message).toMatch(/revoked/);
});
test('owned precondition tracks body failure without healing it during cleanup', async () => {
  const gate = ownedGate(); gate.start(async () => api.createComparisonProvenanceSession(context(), '/private/tmp/no-io'));
  await expect(gate.run(async () => {throw Error('actual gate body failure');})).rejects.toThrow();
  await gate.cleanup(); expect(gate.owner.failures[0]!.message).toBe('actual gate body failure');
});
test('owned precondition waits pending body and preserves failed first disposal', async () => {
  let release!: () => void, entered!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;}), running = new Promise<void>(resolve => {entered = resolve;});
  const gate = ownedGate(); let closes = 0;
  gate.start(async ownership => {await ownership.adopt({name:'actual test close rejection', async close() {closes++; throw Error('first close failure');}}); return api.createComparisonProvenanceSession(context(), '/private/tmp/no-io');});
  const body = gate.run(async () => {entered(); await pending;}); void body.catch(() => {}); await running;
  let settled = false; const cleaning = gate.cleanup().finally(() => {settled = true;}); void cleaning.catch(() => {});
  await new Promise<void>(resolve => setImmediate(resolve)); expect(settled).toBe(false);
  release(); await expect(body).rejects.toThrow(); await expect(cleaning).rejects.toThrow(); expect(closes).toBe(1);
  await expect(gate.cleanup()).rejects.toThrow('retried'); expect(gate.owner.canContinue).toBe(false);
});
test('owned precondition rejects expired disposal despite later actual body settlement', async () => {
  let now = 0; const timers: (() => void)[] = [];
  const owner = new ComparisonOwnership({now: () => now, setTimer(callback) {timers.push(callback); return timers.length as unknown as ReturnType<typeof setTimeout>;}, clearTimer() {}});
  let release!: () => void, entered!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;}), running = new Promise<void>(resolve => {entered = resolve;});
  const gate = ownedGate(owner); gate.start(async () => api.createComparisonProvenanceSession(context(), '/private/tmp/no-io'));
  const body = gate.run(async () => {entered(); await pending;}); void body.catch(() => {}); await running;
  const cleaning = gate.cleanup(); void cleaning.catch(() => {}); now = 10001; timers.at(-1)!();
  release(); await expect(body).rejects.toThrow(); await expect(cleaning).rejects.toThrow(); expect(owner.canContinue).toBe(false);
});
const metadataGateCases = [
  ['missing original playwright package metadata', 'node_modules/playwright/package.json', 'missing'],
  ['missing original playwright-core package metadata', 'node_modules/playwright-core/package.json', 'missing'],
  ['original playwright package name contradiction', 'node_modules/playwright/package.json', 'name'],
  ['nonprimitive original playwright version', 'node_modules/playwright/package.json', 'version-object'],
  ['original playwright-core package name contradiction', 'node_modules/playwright-core/package.json', 'name'],
  ['original playwright-core version contradiction', 'node_modules/playwright-core/package.json', 'version'],
  ['original playwright direct pin contradiction', 'package.json', 'pin'],
  ['original playwright physical lock contradiction', 'package-lock.json', 'playwright-lock'],
  ['original playwright-core physical lock contradiction', 'package-lock.json', 'core-lock'],
  ['missing original Chromium download row', 'node_modules/playwright-core/browsers.json', 'missing-row'],
  ['empty original Chromium download revision', 'node_modules/playwright-core/browsers.json', 'empty-revision'],
  ['fractional original Chromium download revision', 'node_modules/playwright-core/browsers.json', 'fractional-revision'],
  ['nonarray original Chromium download inventory', 'node_modules/playwright-core/browsers.json', 'nonarray'],
  ['malformed original Chromium download JSON', 'node_modules/playwright-core/browsers.json', 'malformed'],
] as const;
const expiryGateNames = new Set([
  'environment pending version fulfillment cannot survive original setup expiry',
  'environment pending GPU fulfillment cannot become unavailable after original setup expiry',
  'environment pending GPU rejection cannot become unavailable after original setup expiry',
  'native Git actual FD read continuation cannot survive setup expiry',
]);
const gitPolicyCases = [
  ['environment conformance retains actual private submodule dirtiness','conformance','submodule','initial'],
  ['publication serving rejects same revision clean-to-dirty worktree','publication','untracked','serving'],
  ['conformance serving returns current dirty state at unchanged revision','conformance','untracked','serving'],
  ['publication serving rejects same revision dirty real submodule','publication','submodule','serving'],
] as const;
const gitPolicyGateNames = new Set<string>(gitPolicyCases.map(([name]) => name));
const repairGateNames = new Set([
  ...metadataGateCases.map(([name]) => `environment rejects ${name}`),
  'environment retains available JSON GPU facts from typed CDP',
  'environment rejects non-JSON available GPU before original metadata or Git',
  ...expiryGateNames,
  'fresh worker spawn excludes hostile inherited Node options and execution flags',
  'native Git spawn excludes hostile inherited config and worktree controls',
  'environment conformance retains actual private submodule dirtiness',
  'publication serving rejects same revision clean-to-dirty worktree',
  'conformance serving returns current dirty state at unchanged revision',
  'publication serving rejects same revision dirty real submodule',
  'native Git actual FD progressing short reads complete only the fixed header',
  'native Git actual FD zero progress rejects before Git spawn',
]);
const hookGateNames = new Set([
  'genuine smaller original inventory resolves every reviewed profile declaration',
  ...['app.ts', 'main.ts', 'host.ts', 'index.html', 'styles.css', '../angular.json'].map(name => `new genuine records cannot authorize unknown complete configuration ${name}`),
  'actual source change after fresh assembly prevents genuine profile pre-serving recheck',
  ...['chat', 'Angular core'].map(name => `genuine physical profile rejects ${name}`),
  'missing reviewed configuration remains rejected with genuine fresh records',
  ...['protocolVersion', 'product', 'revision', 'userAgent', 'jsVersion', 'automation', 'executable'].map(name => `checked CDP rejects missing actual ${name} identity before native Git`),
  'genuine environment rejects actual dirty publication worktree',
  'genuine environment reads actual private Git state, typed CDP and original Playwright metadata',
  ...['close rejection', 'injected path identity contradiction', 'rounded adjacent64-bit inode contradiction', 'rounded native FD inode contradiction'].map(name => `native Git owned header rejects actual FD ${name} without mutating system files`),
  ...repairGateNames,
]);
const capacityCaseName = 'genuine filesystem member inventory4097 rejects before every destination mutation';
type OriginalCaseState = {
  name:string; gate?:ReturnType<typeof ownedGate>; root?:string; output?:string; session?:Session; closeProof?:() => Promise<void>;
  extraRepo?:string; nativeAdoptions?:number; nativeEvents?:string[]; abandoned:boolean;
  preparation?:Promise<void>; continuation?:Promise<void>; preparationSettled:boolean; hookSettled:boolean;
  firstCleanup?:Promise<void>; cleanupStarted:boolean; workSettled:boolean;
  phases:{name:string; elapsedMs:number}[]; started:number; diagnostic:boolean; collectorError?:string; metadataReads?:string[];
  repairFacts?:Record<string,unknown>;
  releaseHeld?:() => void; expireSetup?:() => void;
  workerSpawn?:ActualSpawnFacts; workerSpawnCount?:number; hostileWorker?:Record<string,string>;
  isolationHead?:string;
  policyHead?:string; policyCanary?:string; policyInitialStatus?:string;
  policyGitlink?:string;
  phaseAttempts?:number; gitDiagnostic?:GitDiagnostic;
  diagnosticPending?:unknown;
  localDisposalDiagnostic?:boolean;
};
type TimedIO = {id:number;kind:'open' | 'lstat';key:string;enteredMs:number;durationMs?:number;failed?:boolean};
type GitDiagnostic = {
  flag:string;taskId:string;generation:number;hostAnchorMs:number;ownerGeneration?:number;acquiring:boolean;
  attempted:number;completed:number;failed:number;pendingCount:number;pending:Map<number,TimedIO>;pendingTruncated:boolean;keysTruncated:boolean;
  maximumMs:number;sumCompletedMs:number;lastAttempted?:TimedIO;lastCompleted?:TimedIO;top:TimedIO[];
  workerSpawns:number;workerCloses:number;workerEvents:{event:string;elapsedMs:number}[];workerEventsTruncated:boolean;
  observerErrorCount:number;observerErrors:string[];
};
const gitDiagnosticName = 'environment conformance retains actual private submodule dirtiness';
const gitDiagnosticFlag = 'COMPARISON_GIT_TIMEOUT_DIAGNOSTIC';
function snapshotGitDiagnostic(current:OriginalCaseState) {
  const value = current.gitDiagnostic; if (!value) return undefined;
  const {pending,...facts} = value;
  return structuredClone({...facts,snapshotAtMs:performance.now() - current.started,pending:[...pending.values()],phaseAttempts:current.phaseAttempts ?? 0,phaseCount:current.phases.length,phaseTruncated:(current.phaseAttempts ?? 0) > current.phases.length,clock:'actual performance.now; default actual owner clock unchanged',observerCoverage:'real test-side open/lstat delegates only during actual session.acquire; no inferred product/probe/read/FD-lifetime durations',concurrentSumIsWallClock:false,sourceBinding:'immutable external source fingerprint',adapterTimingErrorCount:fileOperations.timingErrorCount,adapterTimingErrors:fileOperations.timingErrors.map(error => error instanceof Error ? error.message.slice(0,512) : 'non-Error')});
}
function installGitDiagnostic(current:OriginalCaseState,fileCase:FileCase) {
  const value = current.gitDiagnostic!;
  const record = (operation:() => void) => {try {fileCoordinator.assert(fileCase); operation();} catch (error) {value.observerErrorCount++;if (value.observerErrors.length < 8) {value.observerErrors.push(error instanceof Error ? error.message.slice(0,512) : 'non-Error');fileCase.evidenceErrors.push(error);}}};
  fileOperations.timing = (kind,path) => {
    if (!value.acquiring) return undefined;
    const entered = performance.now(), id = ++value.attempted;
    let key = current.root && path.startsWith(current.root + '/') ? relative(current.root,path) : path;
    if (key.length > 512) {key = key.slice(0,512); value.keysTruncated = true;}
    const row:TimedIO = {id,kind,key,enteredMs:entered - current.started};
    record(() => {value.lastAttempted = row; value.pendingCount++; if (value.pending.size < 32) value.pending.set(id,row); else value.pendingTruncated = true;});
    return failed => record(() => {
      const completed:TimedIO = {...row,durationMs:performance.now() - entered,failed};
      value.completed++;value.failed += Number(failed);value.pendingCount--;value.pending.delete(id);value.lastCompleted = completed;
      value.maximumMs = Math.max(value.maximumMs,completed.durationMs!);value.sumCompletedMs += completed.durationMs!;
      value.top.push(completed);value.top.sort((a,b) => b.durationMs! - a.durationMs!);if (value.top.length > 8) value.top.pop();
    });
  };
  processOperations.spawned = ({child}) => {
    if (!value.acquiring) return;
    const event = (name:string) => record(() => {if (value.workerEvents.length < 32) value.workerEvents.push({event:name,elapsedMs:performance.now() - current.started});else value.workerEventsTruncated = true;});
    record(() => {value.workerSpawns++;});event('actual worker spawn');
    for (const [target,name] of [[child,'child'],[child.stdin,'stdin'],[child.stdout,'stdout'],[child.stderr,'stderr']] as const) target.once('close',() => {record(() => {value.workerCloses++;});event(`actual worker ${name} close`);});
  };
}
const metadataDiagnosticName = 'environment rejects missing original playwright package metadata';
function markOriginalCase(current:OriginalCaseState, name:string) {
  if (current.diagnostic) {current.phaseAttempts = (current.phaseAttempts ?? 0) + 1; if (current.phases.length < (current.localDisposalDiagnostic ? 64 : 128)) current.phases.push({name, elapsedMs:performance.now() - current.started});}
}
async function settleOriginalCase(current:OriginalCaseState, body?:Promise<unknown>) {
  if (current.cleanupStarted) throw Error('Original case cleanup cannot be retried'); current.cleanupStarted = true;
  current.abandoned = true; markOriginalCase(current, 'teardown abandonment and FIRST disposal invoked');
  if (current.gate && !current.firstCleanup) current.firstCleanup = current.gate.cleanup(current.name); void current.firstCleanup?.catch(() => {});
  const outcomes = await Promise.allSettled([current.preparation, current.continuation, current.firstCleanup,body]);
  if (current.gate) await current.gate.owner.ownershipSettled;
  current.workSettled = current.preparationSettled && current.hookSettled;
  markOriginalCase(current, 'actual preparation hook callback stage ownership settled');
  return outcomes;
}
test('owned pure preparation abandonment waits actual continuation before restoration', async () => {
  let release!:() => void; const held = new Promise<void>(resolve => {release = resolve;});
  const path = await fs.mkdtemp(join(tmpdir(),'comparison-preparation-lifetime-'));
  const current:OriginalCaseState = {name:'held real preparation', gate:ownedGate(), root:path, abandoned:false, preparationSettled:false, hookSettled:false, cleanupStarted:false, workSettled:false, phases:[], started:performance.now(), diagnostic:false};
  let started = 0, restored = false;
  current.preparation = (async () => {await fs.stat(path); await held; if (current.abandoned) throw Error('actual preparation abandoned'); await fs.writeFile(join(path,'late.txt'),'forbidden');})().finally(() => {current.preparationSettled = true;});
  void current.preparation.catch(() => {});
  current.continuation = current.preparation.then(() => {if (current.abandoned) throw Error('late hook abandoned'); started++; current.gate!.start(async () => api.createComparisonProvenanceSession(context(),'/private/tmp/no-io'));}).finally(() => {current.hookSettled = true;});
  void current.continuation.catch(() => {});
  const closing = settleOriginalCase(current).then(outcomes => {restored = true; return outcomes;}); void closing.catch(() => {});
  let proofPassed = false;
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(current.gate!.owner.canContinue).toBe(true); expect(restored).toBe(false); expect(current.workSettled).toBe(false); expect(await fs.stat(path)).toBeDefined();
    release(); const outcomes = await closing;
    expect(outcomes[0].status).toBe('rejected'); expect(outcomes[1].status).toBe('rejected'); expect(outcomes[2].status).toBe('fulfilled');
    expect(restored).toBe(true); expect(current.workSettled).toBe(true); expect(started).toBe(0); expect(current.gate!.observation().stage).toBe('N/A');
    await expect(fs.access(join(path,'late.txt'))).rejects.toMatchObject({code:'ENOENT'}); proofPassed = true;
  } finally {release(); await closing; if (proofPassed && current.workSettled && current.gate!.owner.canContinue) await fs.rm(path,{recursive:true,force:true});}
});
describe('genuine original fixtures', () => {
let root: string;
function originalCase():OriginalCaseState {const state = capturedFileCase().original; if (!state) throw Error('Missing task original fixture'); return state;}
beforeEach(async ({task}) => {
  const fileCase = fileCases.get(task)!; if (!fileCase.admitted) return; fileCoordinator.active(fileCase);
  fileCase.managed = true;
  const current:OriginalCaseState = fileCase.original = {name:task.name, abandoned:false, preparationSettled:false, hookSettled:false, cleanupStarted:false, workSettled:false, phases:[], started:performance.now(), diagnostic:false};
  if (task.name === 'actual immutable provenance/acquisition.json destination cannot heal its first rejected command' && process.env.COMPARISON_LOCAL_DISPOSAL_DIAGNOSTIC === '1') {
    current.localDisposalDiagnostic = true; current.diagnostic = true; fileCase.retainPaths = true;
  }
  if (task.name === gitDiagnosticName && process.env[gitDiagnosticFlag] === '1') {
    current.diagnostic = true;fileCase.retainPaths = true;fileOperations.timingErrors = [];fileOperations.timingErrorCount = 0;
    current.gitDiagnostic = {flag:process.env[gitDiagnosticFlag]!,taskId:task.id,generation:fileCase.generation,hostAnchorMs:current.started,acquiring:false,attempted:0,completed:0,failed:0,pendingCount:0,pending:new Map(),pendingTruncated:false,keysTruncated:false,maximumMs:0,sumCompletedMs:0,top:[],workerSpawns:0,workerCloses:0,workerEvents:[],workerEventsTruncated:false,observerErrorCount:0,observerErrors:[]};
  }
  const mark = (name:string) => {
    try {if (current.gitDiagnostic) {fileCoordinator.assert(fileCase); if (name === 'actual session.acquire entered') {current.gitDiagnostic.acquiring = true;installGitDiagnostic(current,fileCase);} if (name === 'actual session.acquire settled') current.gitDiagnostic.acquiring = false;} markOriginalCase(current,name);}
    catch (error) {fileCase.evidenceErrors.push(error);}
  };
  const active = () => {if (current.abandoned) throw Error('Original fixture preparation abandoned');};
  const step = async <T>(operation:() => Promise<T>):Promise<T> => {active(); const value = await operation(); active(); return value;};
  if (hookGateNames.has(current.name)) {
    let clock:import('./comparison-ownership.js').ComparisonOwnershipClock | undefined;
    if (expiryGateNames.has(current.name)) {
      let now = 0, setupTimer:(() => void) | undefined, disposalTimer:(() => void) | undefined, timerId = 0;
      clock = {now:() => now,setTimer(callback,ms) {if (ms === 60000) setupTimer = callback; else if (ms === 10000) disposalTimer = callback; else throw Error('Unexpected actual owner timer budget'); return ++timerId as unknown as ReturnType<typeof setTimeout>;},clearTimer() {}};
      current.expireSetup = () => {if (!setupTimer || disposalTimer) throw Error('Original setup timer must expire before disposal'); now = 60001; setupTimer();};
    }
    current.gate = ownedGate(caseOwner(clock),mark,() => current.releaseHeld?.());
  }
  mark('beforeEach entered');
  current.preparation = (async () => {
    mark('originalFixture entered');
    let fixtureRoot:string;
    try {fixtureRoot = await originalFixture(!current.name.includes('current150'), path => {current.root = path; (fileCase.localPaths ??= new Set()).add(path); mark('physical root registered');}, mark, active);}
    finally {mark('originalFixture settled');}
    active(); root = fixtureRoot;
  if (current.name.startsWith('new genuine records cannot authorize unknown complete configuration ')) {
    const name = current.name.split(' ').at(-1)!, path = join(fixtureRoot, 'apps/threadplane/src', name);
    if (name.endsWith('.json')) {const value = JSON.parse(await step(() => fs.readFile(path, 'utf8'))); value.reviewedConfigurationMutation = true; await step(() => fs.writeFile(path, JSON.stringify(value)));}
    else await step(() => fs.appendFile(path, '\n/* private unreviewed configuration */\n'));
    await step(() => publishFixtureRecords(fixtureRoot, mark, active));
  }
  if (current.name.startsWith('genuine physical profile rejects ')) {
    const name = current.name.endsWith('chat') ? '@threadplane/chat' : '@angular/core', version = name === '@threadplane/chat' ? '0.3.3' : '21.2.24';
    const build = JSON.parse(await step(() => fs.readFile(join(fixtureRoot, 'apps/threadplane/.build-evidence.json'), 'utf8'))), resolutionPath = build.packages.find((row: {name: string}) => row.name === name).resolutionPath;
    for (const key of [`${resolutionPath}/package.json`, 'apps/threadplane/package.json', 'package-lock.json']) {
      const path = join(fixtureRoot, key), value = JSON.parse(await step(() => fs.readFile(path, 'utf8')));
      if (key.endsWith(`${name}/package.json`)) value.version = version;
      else if (key === 'package-lock.json') value.packages[resolutionPath].version = version;
      else value.dependencies[name] = version;
      await step(() => fs.writeFile(path, JSON.stringify(value)));
    }
    await step(() => publishFixtureRecords(fixtureRoot, mark, active));
  }
  if (current.name === 'missing reviewed configuration remains rejected with genuine fresh records') {await step(() => fs.rm(join(fixtureRoot, 'apps/threadplane/src/styles.css'))); await step(() => publishFixtureRecords(fixtureRoot, mark, active));}
  if (current.name.startsWith('genuine environment') || current.name.startsWith('native Git owned header ') || repairGateNames.has(current.name)) {
    mark('metadata copies entered');
    for (const key of ['node_modules/playwright/package.json', 'node_modules/playwright-core/package.json', 'node_modules/playwright-core/browsers.json']) {await step(() => fs.mkdir(dirname(join(fixtureRoot, key)), {recursive: true})); await step(() => fs.copyFile(join(process.cwd(), key), join(fixtureRoot, key)));}
  }
  mark('metadata copies settled');
  const metadataCase = metadataGateCases.find(([name]) => current.name === `environment rejects ${name}`);
  if (metadataCase) {
    mark('metadata mutation entered');
    const [, key, kind] = metadataCase, path = join(fixtureRoot, key);
    if (kind === 'missing') await step(() => fs.rm(path));
    else if (kind === 'malformed') await step(() => fs.writeFile(path, '{invalid original download JSON'));
    else {
      const value = JSON.parse(await step(() => fs.readFile(path, 'utf8')));
      if (kind === 'name') value.name = 'private-other-name';
      else if (kind === 'version-object') value.version = {invalid:'nonprimitive'};
      else if (kind === 'version') value.version = '0.0.0';
      else if (kind === 'pin') value.devDependencies.playwright = '0.0.0';
      else if (kind === 'playwright-lock' || kind === 'core-lock') value.packages[`node_modules/${kind === 'core-lock' ? 'playwright-core' : 'playwright'}`].version = '0.0.0';
      else if (kind === 'missing-row') value.browsers = value.browsers.filter((row:{name:string}) => row.name !== 'chromium');
      else if (kind === 'nonarray') value.browsers = {};
      else {const chromium = value.browsers.find((row:{name:string}) => row.name === 'chromium'); chromium.revision = kind === 'empty-revision' ? '' : 0.5;}
      await step(() => fs.writeFile(path, JSON.stringify(value)));
    }
    mark('metadata mutation settled'); mark('genuine republish entered');
    try {await step(() => publishFixtureRecords(fixtureRoot, mark, active));} finally {mark('genuine republish settled');} // Root/lock contradictions are recorded BEFORE genuine acquisition.
  }
  if (current.name.startsWith('genuine environment') || current.name === 'environment retains available JSON GPU facts from typed CDP' || current.name === 'native Git spawn excludes hostile inherited config and worktree controls' || gitPolicyGateNames.has(current.name) || current.name === 'native Git actual FD progressing short reads complete only the fixed header') {
    mark('actual Git preparation entered');
    try {
    const git = promisify(execFile), options = {cwd: fixtureRoot, env: {GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null'}};
    await step(() => git('/usr/bin/git', ['init', '--quiet'], options));
    await step(() => git('/usr/bin/git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'Private original fixture'], options));
    if (current.name === 'native Git spawn excludes hostile inherited config and worktree controls') {
      await step(() => fs.writeFile(join(fixtureRoot,'private-hostile-git-config'),'[status]\n\tshowUntrackedFiles = no\n[submodule]\n\tignore = all\n'));
      await step(() => fs.writeFile(join(fixtureRoot,'private-untracked-isolation-canary'),'actual dirty canary'));
      const inputs = await step(() => fs.readdir(fixtureRoot));
      const excludes = inputs.filter(name => name !== '.git' && name !== 'private-untracked-isolation-canary').map(name => `/${name}/`.replace(/\/$/,''));
      await step(() => fs.writeFile(join(fixtureRoot,'.git/info/exclude'),excludes.join('\n') + '\n'));
      const status = await step(() => git('/usr/bin/git',['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'],options));
      expect(status.stdout).toBe('?? private-untracked-isolation-canary\n');
      const head = await step(() => git('/usr/bin/git',['rev-parse','--verify','HEAD'],options));
      current.isolationHead = head.stdout.trim();
      await step(() => publishFixtureRecords(fixtureRoot,mark,active));
    }
    if (gitPolicyGateNames.has(current.name)) {
      mark('actual Git policy preparation entered');
      try {
      const policy = gitPolicyCases.find(([name]) => name === current.name)!;
      await step(() => fs.mkdir(join(fixtureRoot,'private-git-canaries')));
      if (policy[2] === 'submodule') {
        const extra = await registeredOutput(fileCase,'comparison-submodule-source-'); current.extraRepo = extra; active();
        const extraOptions = {...options,cwd:extra};
        mark('actual submodule source init/add/commit entered');
        try {
        await step(() => git('/usr/bin/git',['init','--quiet'],extraOptions));
        await step(() => fs.writeFile(join(extra,'tracked-canary'),'initial actual tracked child content'));
        await step(() => git('/usr/bin/git',['add','tracked-canary'],extraOptions));
        await step(() => git('/usr/bin/git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Private actual submodule'],extraOptions));
        } finally {mark('actual submodule source init/add/commit settled');}
        mark('actual submodule add/main gitlink commit entered');
        try {
        await step(() => git('/usr/bin/git',['-c','protocol.file.allow=always','submodule','add','--quiet','--force',extra,'private-submodule'],options));
        await step(() => git('/usr/bin/git',['add','--force','.gitmodules','private-submodule'],options));
        await step(() => git('/usr/bin/git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Actual private gitlink'],options));
        current.policyGitlink = (await step(() => git('/usr/bin/git',['ls-files','--stage','.gitmodules','private-submodule'],options))).stdout;
        expect(current.policyGitlink).toMatch(/^100644 [a-f0-9]{40} 0\t\.gitmodules\n160000 [a-f0-9]{40} 0\tprivate-submodule\n$/);
        current.policyCanary = join(fixtureRoot,'private-submodule/tracked-canary');
        } finally {mark('actual submodule add/main gitlink commit settled');}
      } else current.policyCanary = join(fixtureRoot,'private-git-canaries/untracked-canary');
      const inputs = await step(() => fs.readdir(fixtureRoot));
      const excludes = inputs.filter(name => !['.git','.gitmodules','private-submodule','private-git-canaries'].includes(name)).map(name => `/${name}`);
      await step(() => fs.writeFile(join(fixtureRoot,'.git/info/exclude'),excludes.join('\n') + '\n'));
      mark('actual native clean-status/HEAD proof entered');
      try {
      const status = await step(() => git('/usr/bin/git',['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'],options));
      current.policyInitialStatus = status.stdout; expect(status.stdout).toBe('');
      current.policyHead = (await step(() => git('/usr/bin/git',['rev-parse','--verify','HEAD'],options))).stdout.trim();
      } finally {mark('actual native clean-status/HEAD proof settled');}
      mark('actual final pre-acquisition publication entered');
      try {await step(() => publishFixtureRecords(fixtureRoot,mark,active));} finally {mark('actual final pre-acquisition publication settled');}
      } finally {mark('actual Git policy preparation settled');}
    }
    } finally {mark('actual Git preparation settled');}
  }
  })().finally(() => {current.preparationSettled = true; mark('actual pure preparation settled');});
  void current.preparation.catch(() => {});
  current.continuation = (async () => {
    await current.preparation; active();
    if (current.gate) {
      const gate = current.gate, originalRoot = current.root!;
      mark('actual gate.start invoked');
      gate.start(async ownership => {
        if (current.gitDiagnostic) current.gitDiagnostic.ownerGeneration = ownership.generation;
        active(); mark('actual output initialization entered');
        current.output = await registeredOutput(fileCase,'comparison-profile-output-'); active(); ownership.assertActive();
        const writer = await ComparisonArtifactWriter.create(current.output); active(); ownership.assertActive(); mark('actual output writer initialized');
        current.nativeAdoptions = 0; current.nativeEvents = [];
        const observedOwnership:typeof ownership = {...ownership, adopt(resource) {
          if (resource.name === 'comparison-native-git-header') {current.nativeAdoptions!++; current.nativeEvents!.push('adopt');}
          return ownership.adopt.call(ownership,resource);
        }};
        if (current.name === 'fresh worker spawn excludes hostile inherited Node options and execution flags') {
          const preload = join(originalRoot,'nonexistent-private-preload.cjs');
          await fs.access(preload).then(() => {throw Error('Hostile preload must not exist');},error => {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}); active(); ownership.assertActive();
          current.hostileWorker = {NODE_OPTIONS:`--require=${preload}`,NODE_PATH:join(originalRoot,'nonexistent-node-path'),NODE_COMPILE_CACHE:join(originalRoot,'nonexistent-cache'),NODE_DISABLE_COMPILE_CACHE:'0'};
          challengeParent(fileCase,current.hostileWorker,['--require',preload]);
          processOperations.spawned = observation => {current.workerSpawnCount = (current.workerSpawnCount ?? 0) + 1; current.workerSpawn = spawnFacts(observation,Object.keys(current.hostileWorker!));};
        }
        current.session = await acquireAndAssert(observedOwnership, writer, current.output, originalRoot, mark); active(); ownership.assertActive();
        return current.session;
      });
      await gate.ready; active(); mark('hook readiness observed');
    }
  })().finally(() => {current.hookSettled = true; mark('actual whole hook continuation settled');});
  void current.continuation.catch(() => {}); await current.continuation;
});
afterEach(async ({task}) => {
  const fileCase = fileCases.get(task)!; if (!fileCase.admitted) return;
  const current = fileCase.original!; fileCase.abandoned = true;
  exactTeardownDiagnostic(fileCase);
  const exactPending = fileCase.exactIdentityDiagnostic ? snapshotExactIdentityDiagnostic(fileCase.exactIdentityDiagnostic,'teardown-before-FIRST-start') : undefined;
  if (current.gitDiagnostic) {try {current.diagnosticPending = snapshotGitDiagnostic(current);} catch (error) {fileCase.evidenceErrors.push(error);}}
  pendingForensic(fileCase,{taskId:task.id,test:current.name,state:'pending',bodySettled:fileCase.bodySettled,preparationSettled:current.preparationSettled,hookSettled:current.hookSettled,root:current.root,output:current.output,observation:current.gate?.observation() ?? 'N/A',repairFacts:exactPending ? {exactIdentityDiagnostic:exactPending} : undefined});
  fileCase.innerCleanup = (async () => {
  const localDisposals = (fileCase.localOwners ?? []).map(record => firstLocalDisposal(record.owner));
  const outcomes = await settleOriginalCase(current,fileCase.body);
  const localResults = await Promise.allSettled(localDisposals);
  await Promise.all((fileCase.localOwners ?? []).map(record => record.owner.ownershipSettled));
  if (fileCase.localOwners?.length) exactOwnershipSettled(fileCase);
  fileCoordinator.assert(fileCase);
  if (current.gitDiagnostic) for (const error of fileOperations.timingErrors) if (!fileCase.evidenceErrors.includes(error)) fileCase.evidenceErrors.push(error);
  await restoreParent(fileCase,'inner-owned-work',current.workSettled && fileCase.bodySettled).catch(() => {});
  const observation = current.gate?.observation();
  const safe = current.workSettled && fileCase.bodySettled && outcomes[2].status === 'fulfilled' && (!current.gate || current.gate.owner.canContinue);
  expect(localResults).toHaveLength(fileCase.localOwners?.length ?? 0);
  const localSafe = (fileCase.localOwners ?? []).every((record,index) => {const result = localResults[index]; if (!result) throw Error('Missing actual local FIRST disposal'); return result.status === 'fulfilled' && (result.value.status === 'complete' && record.owner.canContinue || record.realClosedProof && fileCase.bodySettled && outcomes[3].status === 'fulfilled');});
  const resourceSafe = safe && localSafe && (current.gate !== undefined || outcomes[3].status === 'fulfilled');
  fileCase.resourceSafe = resourceSafe;
  const disposals:FirstDisposal[] = [{outcome:outcomes[2],failures:current.gate?.owner.failures ?? [],allowed:false}];
  if (observation && observation.disposal !== 'N/A') disposals.push({outcome:{status:'fulfilled',value:observation.disposal},failures:current.gate!.owner.failures,allowed:current.name === nativeCloseFailureCase && outcomes[3].status === 'fulfilled'});
  for (const [index,record] of (fileCase.localOwners ?? []).entries()) {const outcome = localResults[index]; if (!outcome) throw Error('Missing local disposal observation'); disposals.push({outcome,failures:record.owner.failures,allowed:record.realClosedProof && outcomes[3].status === 'fulfilled'});}
  const primary = selectPrimary(fileCase,disposals,[outcomes[0],outcomes[1],outcomes[3]]);
  await preservePrimary(primary,fileCase,() => persistForensic(fileCase,resourceSafe ? 'settled' : 'unsafe', {test:current.name, allocation:{hookMs:10000, bodyMs:provenanceIntegrationCaseNames.has(current.name) ? provenanceIntegrationBodyMs : 5000, cleanupHookMs:10000, ownerBudgets:{setup:60000,replay:30000,disposal:10000}}, root:current.root, output:current.output, localPaths:[...(fileCase.localPaths ?? [])], taskState:task.result?.state, phases:current.phases, preparationSettled:current.preparationSettled, hookSettled:current.hookSettled, bodySettled:fileCase.bodySettled, workSettled:current.workSettled, resourceSafe, observation:observation ?? 'N/A', localOwnership:(fileCase.localOwners ?? []).map((record,index) => ({first:localResults[index],failures:record.owner.failures,canContinue:record.owner.canContinue,actualOwnershipSettled:true,realClosedProof:record.realClosedProof})), failures:current.gate?.owner.failures ?? [], primary:primary?.reason instanceof Error ? primary.reason.message : primary ? 'non-Error' : null, evidenceErrors:fileCase.evidenceErrors.map(row => row instanceof Error ? row.message : 'non-Error'), collectorError:current.collectorError, metadataReads:current.metadataReads,repairFacts:current.repairFacts,localDiagnostic:current.localDisposalDiagnostic ? {phaseAttempts:current.phaseAttempts ?? 0,phaseCount:current.phases.length,limit:64,truncated:(current.phaseAttempts ?? 0) > current.phases.length} : undefined,diagnostic:snapshotGitDiagnostic(current),diagnosticPending:current.diagnosticPending, outcomes:outcomes.map(row => row.status === 'rejected' ? {status:row.status,reason:row.reason instanceof Error ? row.reason.message : 'non-Error'} : {status:row.status})}));
  if (outcomes[2].status === 'rejected') throw outcomes[2].reason;
  expect(current.workSettled).toBe(true);
  if (current.session) expect(current.session.snapshotAcquisition().acquisition.status).toBe('complete');
  if (current.name === nativeCloseFailureCase) {
    expect(current.closeProof).toBeDefined(); await current.closeProof!();
    await persistForensic(fileCase,'native-close',{test:current.name,root:current.root,output:current.output,disposal:'failed',canContinue:false,actualOwnershipSettled:true,failures:current.gate!.owner.failures});
    fileCase.safe = true; // Sole reviewed realclosed deliberate failed-disposal exception.
    fileCase.retainPaths = true;
    return;
  }
  expect(resourceSafe).toBe(true); fileCase.safe = true;
  if (current.diagnostic) fileCase.retainPaths = true;
  })(); void fileCase.innerCleanup.catch(() => {}); await fileCase.innerCleanup;
});
test('genuine current150 plan admits exact roles before the first destination failure', {timeout:provenanceIntegrationBodyMs}, async () => {
  const output = await localOutput('comparison-full-plan-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  const build = adapterBuildSchema.parse(JSON.parse(await fs.readFile(join(root, 'apps/threadplane/.build-evidence.json'), 'utf8')));
  const probe = comparisonInstrumentationBuildSchema.parse(JSON.parse(await fs.readFile(join(root, 'packages/runner/.comparison-build-evidence.json'), 'utf8')));
  const expected: {role: string; key: string; path: string; originalSha256?: string}[] = [];
  const add = (role: string, key: string, path: string, hash?: string) => expected.push({role, key, path, ...(hash === undefined ? {} : {originalSha256: hash})});
  add('build-record', '.build-evidence.json', 'provenance/build-evidence.json');
  add('instrumentation-build-record', 'packages/runner/.comparison-build-evidence.json', 'instrumentation/build-evidence.json');
  for (const [key, hash] of Object.entries(build.sourceHashes).sort()) add('build-source', key, `provenance/source/${key}`, hash);
  for (const [key, hash] of Object.entries(probe.sourceHashes).sort()) add('instrumentation-source', key, `instrumentation/source/${key}`, hash);
  for (const [key, hash] of Object.entries(probe.compiledHashes).sort()) add('instrumentation-compiled-input', key, `instrumentation/compiled/${key}`, hash);
  for (const [key, hash] of Object.entries(build.assetHashes).sort()) add('served-asset', key, `provenance/assets/${key}`, hash);
  for (const key of [...new Set([...build.packages.map(row => row.resolutionPath!), probe.compiler.resolutionPath, probe.nativeCompiler.resolutionPath])].sort()) add('installed-package-metadata', key, `provenance/packages/${key}/package.json`);
  expect(expected).toHaveLength(150);
  expect(['build-record', 'instrumentation-build-record', 'build-source', 'instrumentation-source', 'instrumentation-compiled-input', 'served-asset', 'installed-package-metadata'].map(role => expected.filter(row => row.role === role).length)).toEqual([1, 1, 47, 31, 16, 11, 43]);
  let session: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined, disposed = false, streams = 0;
  try {
    const result = await owner.run('setup', async ownership => {
      const scoped = writer.scoped(() => ownership.assertActive());
      session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped, async stream(path: string) {
        const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()}); streams++;
        throw new Error('actual first destination acquisition rejected');
      }}}, root);
      await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
    });
    expect(result.status).toBe('failed'); expect(streams).toBe(1);
    disposed = true; expect((await firstLocalDisposal(owner)).status).toBe('complete'); await owner.ownershipSettled;
    const snapshot = session!.snapshotAcquisition(); expect(snapshot.acquisition.status).toBe('partial');
    expect(snapshot.acquisition.members.map(({role, key, path, originalSha256}) => ({role, key, path, ...(originalSha256 === undefined ? {} : {originalSha256})}))).toEqual(expected);
    expect(snapshot.acquisition.members.every(row => row.copied.status === 'unavailable')).toBe(true);
    snapshot.acquisition.members.length = 0; expect(session!.snapshotAcquisition().acquisition.members).toHaveLength(150);
  } finally {if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
});
test('registered session preserves actual member candidate on destination failure and new finalization writer persists pure partial snapshot', {timeout:provenanceIntegrationBodyMs}, async () => {
  const output = await localOutput('comparison-acquisition-partial-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let session: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined, streams = 0, disposed = false;
  try {
    const result = await owner.run('setup', async ownership => {
      const scoped = writer.scoped(() => ownership.assertActive());
      const ctx = {...context(), ownership, writer: {...scoped, async stream(path: string) {
        const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()});
        if (++streams === 2) return {write: stream.write, async complete() {await stream.complete(); throw new Error('actual first completion failure');}};
        return stream;
      }}};
      session = api.createComparisonProvenanceSession(ctx, root);
      await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
    });
    expect(result.status).toBe('failed'); disposed = true; await firstLocalDisposal(owner); await owner.ownershipSettled;
    let lateOriginalOpens = 0;
    fileOperations.opened = async (path, fd) => {if (path.startsWith(root + '/')) lateOriginalOpens++; return fd;};
    const partial = session!.snapshotAcquisition();
    expect(partial.acquisition.status).toBe('partial');
    expect(partial.acquisition.members[0]!.status).toBe('complete');
    expect(partial.acquisition.members[1]!.copied.status).toBe('unavailable');
    const candidates = await writer.reconcilePayloadCandidates(); expect(candidates.present.length).toBe(2);
    await expect(fs.access(join(output, 'provenance/acquisition.json'))).rejects.toMatchObject({code:'ENOENT'});
    const finalizationWriter = await ComparisonArtifactWriter.create(output);
    expect(finalizationWriter).not.toBe(writer);
    const finalization = finalizationWriter.scoped(() => {});
    await finalization.text('provenance/acquisition.json', canonicalSerialize(partial.acquisition));
    expect(comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await fs.readFile(join(output, 'provenance/acquisition.json'), 'utf8')))).toEqual(partial.acquisition);
    expect(lateOriginalOpens).toBe(0);
    await expect(session!.recheckBeforeServing()).rejects.toThrow();
  } finally {if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
});
test('actual source close rejection cannot publish a copied digest and independently completes the destination', {timeout:provenanceIntegrationBodyMs}, async () => {
  const output = await localOutput('comparison-close-order-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let session: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined, fd: FileHandle | undefined, destinationCompleted = false, disposed = false;
  try {
    const result = await owner.run('setup', async ownership => {
      const scoped = writer.scoped(() => ownership.assertActive());
      session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped, async stream(path: string) {
        const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()});
        fileOperations.opened = async (openedPath, actual) => {
          if (openedPath !== join(root, 'apps/threadplane/.build-evidence.json')) return actual;
          fileOperations.opened = undefined; fd = actual;
          return new Proxy(actual, {get(target, key) {
            if (key === 'close') return async () => {await target.close(); throw new Error('actual source close completion rejected');};
            const value: unknown = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
          }});
        };
        return {write: stream.write, async complete() {await stream.complete(); destinationCompleted = true;}};
      }}}, root);
      await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
    });
    expect(result.status).toBe('failed'); expect(destinationCompleted).toBe(true);
    expect(session!.snapshotAcquisition().acquisition.members[0]).toMatchObject({status: 'partial', beforeCopy: {status: 'available'}, copied: {status: 'unavailable'}});
    await expect(fd!.stat()).rejects.toThrow();
    disposed = true; expect((await firstLocalDisposal(owner)).status).toBe('failed'); await owner.ownershipSettled;
    expect(owner.canContinue).toBe(false);
    const record = capturedFileCase().localOwners!.find(row => row.owner === owner)!;
    expect(owner.failures.filter(row => row.stage === 'disposal')).toEqual([expect.objectContaining({message:'actual source close completion rejected'})]);
    record.realClosedProof = true; capturedFileCase().retainPaths = true; // Existing local proof, not sharedgate exception.
  } finally {fileOperations.opened = undefined; if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
});
test.each(['same-size source', 'ancestor substitution', 'source after destination completion', 'source after all copies'])('actual %s rejects pinned copy facts', {timeout:provenanceIntegrationBodyMs}, async mutation => {
  const output = await localOutput('comparison-source-mutation-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let session: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined, disposed = false, copies = 0, workers = 0;
  processOperations.created = () => {workers++;};
  const mutate = async () => {
    if (mutation === 'ancestor substitution') {await fs.rename(join(root, 'apps/threadplane'), join(root, 'apps/threadplane-original')); await fs.mkdir(join(root, 'apps/threadplane'));}
    else {const path = join(root, 'apps/threadplane/.build-evidence.json'), bytes = await fs.readFile(path); bytes[bytes.length - 1] = 32; await fs.writeFile(path, bytes);}
  };
  try {
    const result = await owner.run('setup', async ownership => {
      const scoped = writer.scoped(() => ownership.assertActive());
      session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped, async stream(path: string) {
        const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()});
        if (!mutation.startsWith('source after')) {await mutate(); return stream;}
        return {write: stream.write, async complete() {await stream.complete(); if (mutation === 'source after destination completion' || ++copies === 101) {if (mutation === 'source after all copies') expect(path).toBe('provenance/packages/node_modules/typescript/package.json'); await mutate();}}};
      }}}, root);
      await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
    });
    expect(result.status).toBe('failed'); disposed = true; await firstLocalDisposal(owner); await owner.ownershipSettled;
    const snapshot = session!.snapshotAcquisition(); expect(snapshot.acquisition.status).toBe('partial');
    if (mutation === 'source after all copies') {expect(copies).toBe(101); expect(snapshot.acquisition.members.every(row => row.status === 'complete')).toBe(true);}
    else expect(snapshot.acquisition.members[0]).toMatchObject({beforeCopy: {status: 'available'}, copied: {status: 'unavailable'}, status: 'partial'});
    expect(workers).toBe(0);
    expect(snapshot.payloads.every(row => row.status === 'not-attempted')).toBe(true);
  } finally {processOperations.created = undefined; if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
});
test.each(exactIdentityBoundaries)('exact provenance rejects rounded identity contradiction at %s', {timeout:provenanceIntegrationBodyMs}, async boundary => {
  const fileCase = capturedFileCase(), original = fileCase.original!;
  const diagnostic = installExactIdentityDiagnostic(fileCase,original,boundary);
  exactPoint(diagnostic,'output-initializing');
  const output = await localOutput('comparison-exact-source-');
  exactPoint(diagnostic,'output-initialized'); exactPoint(diagnostic,'writer-initializing');
  const writer = await ComparisonArtifactWriter.create(output);
  exactPoint(diagnostic,'writer-initialized'); const owner = caseOwner();
  const leaf = join(root, 'apps/threadplane/.build-evidence.json'), target = boundary === 'ancestor between passes' ? dirname(leaf) : leaf;
  const field = boundary === 'mtimeNs' || boundary === 'ctimeNs' ? boundary : 'ino', base = (1n << 60n) + 1n;
  expect(base).not.toBe(base + 1n); expect(Number(base)).toBe(Number(base + 1n));
  if (field !== 'ino') expect(Number(base) / 1e6).toBe(Number(base + 1n) / 1e6);
  let changed = false, reached = false, workers = 0, streams = 0, writes = 0, fd: FileHandle | undefined, disposed = false;
  let session: Session | undefined;
  const project = (stat: ObservedStat, delta: boolean): ObservedStat => {
    if (field !== 'ino' && !(field in stat)) return stat; // Original numeric helper timestamps remain unchanged.
    const exact = base + BigInt(Number(delta));
    return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {[field]: typeof stat.ino === 'bigint' ? exact : Number(exact)});
  };
  fileOperations.statted = (path, stat) => {
    if (path !== target) return stat;
    if (changed && boundary !== 'FD during copy' && typeof stat.ino === 'bigint') {reached = true; exactObserve(diagnostic,'actual path contradiction reached',() => {diagnostic.reached = true;}); exactEvent(diagnostic,'actual path contradiction reached');}
    return project(stat, changed && boundary !== 'FD during copy');
  };
  fileOperations.opened = async (path, actual) => {
    if (path !== target || boundary === 'ancestor between passes') return actual;
    if (changed && boundary === 'FD during copy') fd = actual;
    let read = false;
    return new Proxy(actual, {get(handle, key) {
      if (key === 'stat') return async (options?: import('node:fs').StatOptions) => {
        const stat = await handle.stat(options as {bigint: true});
        if (read && changed && boundary === 'FD during copy' && typeof stat.ino === 'bigint') {reached = true; exactObserve(diagnostic,'actual FD contradiction reached',() => {diagnostic.reached = true;}); exactEvent(diagnostic,'actual FD contradiction reached');}
        return project(stat, changed && (boundary !== 'FD during copy' || read));
      };
      if (key === 'read') return async (...args: Parameters<FileHandle['read']>) => {const value = await handle.read(...args); if (value.bytesRead) read = true; return value;};
      const value = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
    }});
  };
  diagnostic.workerCoverage = 'installed';
  processOperations.created = child => {exactWorkerCreated(diagnostic,child); workers++; if (boundary === 'fresh after assembly') child.on('close', () => {changed = true; exactObserve(diagnostic,'actual post-assembly change',() => {diagnostic.changed = true;}); exactEvent(diagnostic,'actual child close triggered contradiction');});};
  try {
    exactEvent(diagnostic,'actual setup invocation');
    const stage = owner.run('setup', ownership => exactOperation(diagnostic,'callback',(async () => {
      const scoped = writer.scoped(() => ownership.assertActive());
      session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped,
        async text(path, text) {writes++; exactObserve(diagnostic,'actual text attempt',() => {diagnostic.textAttempts++;}); return scoped.text(path, text);},
        async stream(path) {
          exactObserve(diagnostic,'actual stream attempt',() => {diagnostic.streamAttempts++;}); exactEvent(diagnostic,'actual destination stream attempt');
          streams++; const stream = await scoped.stream(path); await ownership.adopt({name:path, close: () => stream.complete()});
          exactObserve(diagnostic,'actual stream return and adoption',() => {diagnostic.streamAdopted++;});
          if (boundary !== 'fresh after assembly' && boundary !== 'explicit pre-serving') {changed = true; exactObserve(diagnostic,'actual between-pass change',() => {diagnostic.changed = true;}); exactEvent(diagnostic,'actual stream adoption triggered contradiction');}
          return stream;
        },
      }}, root);
      if (boundary === 'explicit pre-serving') {
        await exactOperation(diagnostic,'acquisition',session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions)));
        const prior = session.snapshotAcquisition(); changed = true; exactObserve(diagnostic,'actual pre-serving change',() => {diagnostic.changed = true;}); exactEvent(diagnostic,'actual pre-serving contradiction activated');
        await expect(session.recheckBeforeServing()).rejects.toThrow('original facts changed');
        expect(session.snapshotAcquisition()).toEqual(prior);
      } else await exactOperation(diagnostic,'acquisition',session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions)));
    })()));
    const result = await exactOperation(diagnostic,'stage',stage);
    exactPoint(diagnostic,'assertions-entered');
    expect(reached).toBe(true);
    expect(result.status).toBe(boundary === 'explicit pre-serving' ? 'complete' : 'failed');
    if (boundary === 'explicit pre-serving' || boundary === 'fresh after assembly') {
      expect(streams).toBe(101); expect(workers).toBe(1);
      expect(writes).toBe(boundary === 'explicit pre-serving' ? 3 : 0);
      expect(session!.snapshotAcquisition().acquisition.members.every(row => row.status === 'complete')).toBe(true);
    } else {
      expect(streams).toBe(1); expect(workers).toBe(0); expect(writes).toBe(0);
      expect(owner.failures[0]!.message).toContain('exact source');
      expect(session!.snapshotAcquisition().acquisition.members[0]).toMatchObject({beforeCopy:{status:'available'}, copied:{status:'unavailable'}});
    }
    if (boundary === 'FD during copy') {expect(fd).toBeDefined(); await expect(fd!.stat()).rejects.toThrow();}
    disposed = true; expect((await firstLocalDisposal(owner)).status).toBe('complete'); await owner.ownershipSettled; exactOwnershipSettled(fileCase); expect(owner.canContinue).toBe(true);
  } finally {exactPoint(diagnostic,'finally-entered'); exactObserve(diagnostic,'worker observation end',() => {diagnostic.workerObservationEnded = true;}); exactEvent(diagnostic,'actual worker creation observer span ended'); fileOperations.opened = undefined; fileOperations.statted = undefined; processOperations.created = undefined; if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; exactOwnershipSettled(fileCase); }
});
test('actual late source open is adopted first and closes after generation revocation', {timeout:provenanceIntegrationBodyMs}, async () => {
  const output = await localOutput('comparison-late-open-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let release!: () => void, entered!: () => void, fd: FileHandle | undefined, disposed = false;
  const gate = new Promise<void>(resolve => {release = resolve;}), opening = new Promise<void>(resolve => {entered = resolve;});
  try {
    const running = owner.run('setup', async ownership => {
      const scoped = writer.scoped(() => ownership.assertActive());
      const session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped, async stream(path: string) {
        const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()});
        fileOperations.opened = async (openedPath, actual) => {
          if (openedPath !== join(root, 'apps/threadplane/.build-evidence.json')) return actual;
          fileOperations.opened = undefined; fd = actual; entered(); await gate; return actual;
        }; return stream;
      }}}, root);
      await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
    });
    await opening; disposed = true; const disposal = firstLocalDisposal(owner); release();
    expect((await running).status).toBe('failed'); expect((await disposal).status).toBe('complete'); await owner.ownershipSettled;
    await expect(fd!.stat()).rejects.toThrow(); expect(owner.canContinue).toBe(true);
  } finally {release(); fileOperations.opened = undefined; if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
});
test.each(['instrumentation/pre-navigation.js', 'provenance/acquisition.json'])('actual immutable %s destination cannot heal its first rejected command', {timeout:provenanceIntegrationBodyMs}, async failedPath => {
  const fileCase = capturedFileCase(), current = originalCase(), fault = Error('actual immutable destination command rejected');
  let faultReached = false, setupError:unknown;
  const facts = {failedPath,faultReached:false,streamAttempts:0,workerObservationEnabled:Boolean(current.localDisposalDiagnostic),observedWorkers:0,observedWorkerCloses:0}; current.repairFacts = facts;
  const mark = (name:string) => {if (current.localDisposalDiagnostic) try {fileCoordinator.assert(fileCase); markOriginalCase(current,name);} catch (error) {fileCase.evidenceErrors.push(error);}};
  const actualWorkerCloses:Promise<void>[] = [];
  if (current.localDisposalDiagnostic) processOperations.created = child => {
    try {
      fileCoordinator.assert(fileCase); facts.observedWorkers++; mark('actual worker creation');
      for (const [emitter,name] of [[child,'child'],[child.stdin,'stdin'],[child.stdout,'stdout'],[child.stderr,'stderr']] as const) {
        actualWorkerCloses.push(new Promise<void>(resolve => {emitter.once('close',() => {facts.observedWorkerCloses++; mark(`actual worker ${name} close`); resolve();});}));
      }
    } catch (error) {fileCase.evidenceErrors.push(error);}
  };
  mark('actual immutable body entered');
  const output = await localOutput('comparison-immutable-failure-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let session: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined, disposed = false;
  try {
    const result = await owner.run('setup', async ownership => {
      mark('actual immutable setup entered');
      const scoped = writer.scoped(() => ownership.assertActive());
      session = api.createComparisonProvenanceSession({...context(), ownership, writer: {...scoped,
        async text(path: string, value: string) {
          if (path === failedPath) mark('selected actual fault write entered');
          try {await scoped.text(path,value); if (path === failedPath) {mark('selected actual fault write fulfilled'); faultReached = true; facts.faultReached = true; mark('intended immutable fault reached'); throw fault;}}
          finally {if (path === failedPath) mark('selected actual fault write settled');}
        },
        async stream(path: string) {facts.streamAttempts++; const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()}); return stream;},
      }}, root);
      try {await session.acquire(canonicalSerialize(preOptions),canonicalSerialize(mainOptions));}
      catch (error) {setupError = error; throw error;}
      finally {mark('actual immutable setup callback settled');}
    });
    mark('actual immutable setup result settled');
    expect(faultReached).toBe(true); expect(setupError).toBe(fault); expect(result.status).toBe('failed'); expect(result.deadline.reason).toBe(fault.message);
    expect(owner.failures).toEqual([expect.objectContaining({stage:'setup',message:fault.message,resource:null})]);
    disposed = true; await firstLocalDisposal(owner); await owner.ownershipSettled; mark('actual immutable FIRST and ownership settled');
    const snapshot = session!.snapshotAcquisition(); expect(snapshot.acquisition.status).toBe('partial');
    if (failedPath.startsWith('instrumentation/')) expect(snapshot.payloads[0]).toMatchObject({status: 'failed', measurement: {status: 'unavailable'}});
    else expect(snapshot.persistence).toMatchObject({status: 'failed'});
    const immutableBytes = await fs.readFile(join(output, failedPath)); expect(immutableBytes.length).toBeGreaterThan(0);
    // Future G must inspect actual candidates and avoid overwriting an existing
    // completed destination merely to persist this pure local partial snapshot.
    const candidates = await writer.reconcilePayloadCandidates();
    expect(candidates.present.some(row => row.path === failedPath)).toBe(true);
    expect((await fs.readFile(join(output, failedPath))).equals(immutableBytes)).toBe(true);
    await expect(session!.recheckBeforeServing()).rejects.toThrow();
    expect(session!.snapshotAcquisition()).toEqual(snapshot);
  } finally {
    mark('actual immutable body finally entered');
    if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled;
    await Promise.all(actualWorkerCloses); mark('actual immutable body work settled');
  }
});
async function acquireAndAssert(ownership: import('./comparison-ownership.js').ComparisonOwnershipContext, writer: ComparisonArtifactWriter, output: string, originalRoot = root, onPhase?: (name:string) => void): Promise<Session> {
  const scoped = writer.scoped(() => ownership.assertActive());
  const ctx = {...context(), ownership, writer: {...scoped, async stream(path: string) {const stream = await scoped.stream(path); await ownership.adopt({name: path, close: () => stream.complete()}); return stream;}}};
  const session = api.createComparisonProvenanceSession(ctx, originalRoot);
  onPhase?.('actual session.acquire entered');
  let pair: Awaited<ReturnType<Session['acquire']>>;
  try {pair = await session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));} finally {onPhase?.('actual session.acquire settled');}
  const snapshot = session.snapshotAcquisition();
  expect(snapshot.acquisition.status).toBe('complete'); expect(snapshot.persistence.status).toBe('complete');
  // Closed smaller fixture: records2 + product sources44 + probe sources31 +
  // compiled inputs16 + served asset1 + installed metadata7. A controlled
  // missing stylesheet removes only its one product-source member.
  expect(snapshot.acquisition.members).toHaveLength(101 - Number(!snapshot.acquisition.members.some(row => row.key === 'apps/threadplane/src/styles.css')));
  expect(snapshot.payloads.map(row => ({path: row.path, status: row.status}))).toEqual([{path: 'instrumentation/pre-navigation.js', status: 'complete'}, {path: 'instrumentation/main.js', status: 'complete'}]);
  onPhase?.('actual post-acquire payload/persistence reads entered');
  try {
    expect(await fs.readFile(join(output, 'instrumentation/pre-navigation.js'), 'utf8')).toBe(pair.preNavigation);
    expect(await fs.readFile(join(output, 'instrumentation/main.js'), 'utf8')).toBe(pair.main);
    expect(pair).toEqual(rawPair(pair.preNavigation, pair.main));
    expect(await fs.readFile(join(output, 'provenance/acquisition.json'), 'utf8')).toBe(canonicalSerialize(snapshot.acquisition));
  } finally {onPhase?.('actual post-acquire payload/persistence reads settled');}
  expect(snapshot.acquisition.members.every(row => row.status === 'complete' && JSON.stringify(row.beforeCopy) === JSON.stringify(row.copied) && JSON.stringify(row.copied) === JSON.stringify(row.afterCopy))).toBe(true);
  onPhase?.('full pipeline payload persistence assertions complete');
  return session;
}
async function acquired(operation: (session: Session) => Promise<void>, cleanupStatus: 'complete' | 'failed' = 'complete') {
  const fileCase = capturedFileCase(), current = fileCase.original!;
  const boundOperation = (session:Session) => actualBody.run(fileCase,() => {fileCoordinator.active(fileCase); return operation(session);});
  if (current.gate) {await current.gate.run(boundOperation); return;}
  const output = await localOutput('comparison-profile-output-');
  const writer = await ComparisonArtifactWriter.create(output), owner = caseOwner();
  let disposed = false, completedSession: import('./comparison-provenance.js').ComparisonProvenanceSession | undefined;
  try {
    const result = await owner.run('setup', async ownership => {
      const session = await acquireAndAssert(ownership, writer, output); completedSession = session;
      await boundOperation(session);
    });
    expect(result.status, JSON.stringify(owner.failures)).toBe('complete');
    disposed = true; expect((await firstLocalDisposal(owner)).status).toBe(cleanupStatus);
    expect(owner.canContinue).toBe(cleanupStatus === 'complete');
    expect(completedSession!.snapshotAcquisition().acquisition.status).toBe('complete');
  } finally {if (!disposed) await firstLocalDisposal(owner); await owner.ownershipSettled; }
}
test('genuine complete101 acquisition payload persistence and actual disposal complete under production ownership', {timeout:provenanceIntegrationBodyMs}, async () => {await acquired(async () => {});});
test.each(['close rejection', 'injected path identity contradiction', 'rounded adjacent64-bit inode contradiction', 'rounded native FD inode contradiction'] as const)('native Git owned header rejects actual FD %s without mutating system files', async failure => {
  let nativeFd: FileHandle | undefined, closed = false, closes = 0, observedFD = false, reads = 0;
  const canonical = await fs.realpath('/usr/bin/git');
  const aliasInode = (1n << 60n) + 1n;
  const projectInode = (stat: import('node:fs').Stats | import('node:fs').BigIntStats, ino: bigint) => Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {ino: typeof stat.ino === 'bigint' ? ino : Number(ino)});
  if (failure.startsWith('rounded')) {
    expect(aliasInode).not.toBe(aliasInode + 1n);
    expect(Number(aliasInode)).toBe(Number(aliasInode + 1n));
  }
  const cdp = {async send(method: string) {
    if (method === 'Browser.getVersion') return versionFixture;
    if (method === 'Browser.getBrowserCommandLine') return {arguments: ['/private/fixture/chromium', '--enable-automation']};
    if (method === 'SystemInfo.getInfo') throw Error('GPU unavailable');
    throw Error('Unexpected request');
  }} as unknown as CDPSession;
  await acquired(async session => {
    fileOperations.opened = async (path, fd) => {
      if (path !== canonical) return fd;
      nativeFd = fd;
      return new Proxy(fd, {get(target, key) {
        if (key === 'close') return async () => {closes++; await target.close(); closed = true; if (failure === 'close rejection') throw Error('native actual close rejection');};
        if (key === 'stat' && failure.startsWith('rounded')) return async (options?: import('node:fs').StatOptions) => {observedFD = true; return projectInode(await target.stat(options as {bigint: true}), aliasInode + BigInt(Number(failure === 'rounded native FD inode contradiction')));};
        if (key === 'read') return async (...args: Parameters<FileHandle['read']>) => {reads++; return target.read(...args);};
        const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
      }});
    };
    if (failure === 'injected path identity contradiction') fileOperations.statted = (path, stat) => path === canonical && closed ? Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {ino: typeof stat.ino === 'bigint' ? (stat.ino === 1n ? 2n : 1n) : (stat.ino === 1 ? 2 : 1)}) : stat;
    if (failure === 'rounded adjacent64-bit inode contradiction') fileOperations.statted = (path, stat) => path === canonical ? projectInode(stat, aliasInode + BigInt(Number(closed))) : stat;
    if (failure === 'rounded native FD inode contradiction') fileOperations.statted = (path, stat) => path === canonical ? projectInode(stat, aliasInode) : stat;
    await expect(collectComparisonEnvironment(session, cdp, 'conformance')).rejects.toThrow(failure === 'close rejection' ? 'native actual close rejection' : failure === 'rounded native FD inode contradiction' ? 'Native Git changed before header read' : 'System Git identity changed');
    if (failure.startsWith('rounded')) expect(observedFD).toBe(true);
    expect(reads === 0).toBe(failure === 'rounded native FD inode contradiction');
    expect(nativeFd).toBeDefined(); expect(closed).toBe(true); await expect(nativeFd!.stat()).rejects.toThrow();
    if (failure === 'close rejection') originalCase().closeProof = async () => {expect(closes).toBe(1); expect(closed).toBe(true); await expect(nativeFd!.stat()).rejects.toThrow();};
  }, failure === 'close rejection' ? 'failed' : 'complete');
  expect(closes).toBe(1);
});
test.each(metadataGateCases)('environment rejects %s', async (name, key, kind) => {
  const current = originalCase(), originalRoot = current.root!;
  markOriginalCase(current,'body collector entered');
  const calls:string[] = [], reads:string[] = []; let metadataPhase = false, nativeOpens = 0, gitSpawns = 0;
  const native = await fs.realpath('/usr/bin/git');
  await acquired(async session => {
    fileOperations.opened = async (path, fd) => {if (path === native) nativeOpens++; if (metadataPhase && path.startsWith(originalRoot + '/')) {reads.push(relative(originalRoot,path)); markOriginalCase(current,`collector owned read ${relative(originalRoot,path)}`);} return fd;};
    processOperations.spawned = () => {gitSpawns++;};
    const cdp = {async send(method:string) {
      calls.push(method); markOriginalCase(current,`collector CDP ${method}`);
      if (method === 'Browser.getVersion') return versionFixture;
      if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium', '--enable-automation']};
      if (method === 'SystemInfo.getInfo') {metadataPhase = true; throw Error('fixed optional GPU unavailable');}
      throw Error('Unexpected CDP');
    }} as unknown as CDPSession;
    if (kind === 'missing') await expect(fs.access(join(originalRoot,key))).rejects.toMatchObject({code:'ENOENT'});
    const collecting = collectComparisonEnvironment(session,cdp,'conformance').catch(error => {current.collectorError = error instanceof Error ? error.message : 'non-Error'; markOriginalCase(current,'actual collector rejected'); throw error;}); void collecting.catch(() => {});
    if (kind === 'malformed') await expect(collecting).rejects.toThrow(SyntaxError);
    else await expect(collecting).rejects.toThrow(kind === 'missing' ? /metadata|Cannot find|ENOENT/ : kind.includes('lock') ? 'Original Playwright lock differs' : key.includes('browsers.json') ? 'Original Chromium download' : 'Original Playwright direct pin differs');
    expect(session.snapshotAcquisition().acquisition.status).toBe('complete');
    expect(calls).toEqual(['Browser.getVersion','Browser.getBrowserCommandLine','SystemInfo.getInfo']);
    if (kind !== 'missing') expect(reads).toContain(key);
    expect(nativeOpens).toBe(0); expect(gitSpawns).toBe(0); expect(processOperations.errors).toEqual([]);
  });
  current.metadataReads = reads; markOriginalCase(current,'body collector proof complete');
});
const typedVersionRequest = (session:CDPSession) => session.send('Browser.getVersion');
const typedCommandRequest = (session:CDPSession) => session.send('Browser.getBrowserCommandLine');
const typedGPURequest = (session:CDPSession) => session.send('SystemInfo.getInfo');
const gpuFixture:Awaited<ReturnType<typeof typedGPURequest>> = {gpu:{devices:[{vendorId:0,deviceId:1,vendorString:'private fixture',deviceString:'JSON device',driverVendor:'fixture',driverVersion:'1'}],auxAttributes:{finite:'true'},featureStatus:{compositing:'enabled'},driverBugWorkarounds:['fixture'],videoDecoding:[],videoEncoding:[]},modelName:'private fixture',modelVersion:'1',commandLine:'/private/fixture/chromium --enable-automation'};
test('environment retains available JSON GPU facts from typed CDP', async () => {
  const current = originalCase(), calls:string[] = [], closes:Promise<void>[] = []; let children = 0, nativeFD:FileHandle | undefined, nativeCloses = 0;
  const canonical = await fs.realpath('/usr/bin/git');
  const version:Awaited<ReturnType<typeof typedVersionRequest>> = versionFixture;
  const command:Awaited<ReturnType<typeof typedCommandRequest>> = {arguments:['/private/fixture/chromium','--enable-automation']};
  const cdp = {async send(method:string) {calls.push(method); if (method === 'Browser.getVersion') return version; if (method === 'Browser.getBrowserCommandLine') return command; if (method === 'SystemInfo.getInfo') return structuredClone(gpuFixture); throw Error('Unexpected CDP');}} as unknown as CDPSession;
  await acquired(async session => {
    processOperations.spawned = ({child}) => {children++; for (const target of [child,child.stdin,child.stdout,child.stderr]) closes.push(new Promise<void>(resolve => target.once('close',() => resolve())));};
    fileOperations.opened = async (path,fd) => {
      if (path !== canonical) return fd; nativeFD = fd;
      return new Proxy(fd,{get(target,key) {if (key === 'close') return async () => {await target.close(); nativeCloses++;}; const value = Reflect.get(target,key,target); return typeof value === 'function' ? value.bind(target) : value;}});
    };
    const capture = await collectComparisonEnvironment(session,cdp,'conformance');
    expect(capture.facts.environment.gpu).toEqual({status:'available',value:gpuFixture.gpu});
    expect(manifestSchema.shape.environment.parse(capture.facts.environment)).toEqual(capture.facts.environment);
    expect(capture.facts.assets).toEqual((await session.recheckBeforeServing()).assets);
    expect(capture.facts.playwrightVersion).toBe(JSON.parse(await fs.readFile(join(current.root!,'node_modules/playwright/package.json'),'utf8')).version);
    if (capture.facts.environment.gpu.status !== 'available') throw Error('Missing available GPU proof');
    capture.facts.environment.gpu.value = 'caller mutation';
    const fresh = await capture.recheckBeforeServing(); expect(fresh.environment.gpu).toEqual({status:'available',value:gpuFixture.gpu});
    await Promise.all(closes); expect(children).toBe(4); expect(closes).toHaveLength(16);
    expect(nativeCloses).toBe(2); expect(current.nativeAdoptions).toBe(2); expect(nativeFD).toBeDefined(); await expect(nativeFD!.stat()).rejects.toThrow();
    expect(calls).toEqual(['Browser.getVersion','Browser.getBrowserCommandLine','SystemInfo.getInfo']); expect(processOperations.errors).toEqual([]);
    current.repairFacts = {calls,children,actualChildAndPipeCloses:closes.length,nativeCloses,nativeAdoptions:current.nativeAdoptions,availableGPU:gpuFixture.gpu,detachedRecheck:true,originalAssets:true,originalPlaywright:true};
  });
});
test('environment rejects non-JSON available GPU before original metadata or Git', async () => {
  const current = originalCase(), calls:string[] = [], metadataReads:string[] = []; let gpuReached = false, nativeOpens = 0, children = 0;
  const canonical = await fs.realpath('/usr/bin/git');
  const cdp = {async send(method:string) {
    calls.push(method); if (method === 'Browser.getVersion') return versionFixture;
    if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium','--enable-automation']};
    if (method === 'SystemInfo.getInfo') {gpuReached = true; return {...gpuFixture,gpu:{...gpuFixture.gpu,injectedNonJSON:() => 'protocol contradiction'}};}
    throw Error('Unexpected CDP');
  }} as unknown as CDPSession;
  await acquired(async session => {
    fileOperations.opened = async (path,fd) => {if (path === canonical) nativeOpens++; if (gpuReached && path.startsWith(current.root! + '/')) metadataReads.push(relative(current.root!,path)); return fd;};
    processOperations.spawned = () => {children++;};
    let actualError:unknown;
    const collecting = collectComparisonEnvironment(session,cdp,'conformance').catch(error => {actualError = error; throw error;}); void collecting.catch(() => {});
    await expect(collecting).rejects.toMatchObject({name:'ZodError',issues:expect.any(Array)});
    const expected = manifestSchema.shape.environment.shape.gpu.safeParse({status:'available',value:{...gpuFixture.gpu,injectedNonJSON:() => 'protocol contradiction'}});
    if (expected.success) throw Error('Invalid protocol fixture was accepted by actual GPU schema');
    expect(actualError).toBeDefined(); expect(actualError).toMatchObject({name:expected.error.name,issues:expected.error.issues});
    expect(gpuReached).toBe(true); expect(calls).toEqual(['Browser.getVersion','Browser.getBrowserCommandLine','SystemInfo.getInfo']);
    expect(metadataReads).toEqual([]); expect(nativeOpens).toBe(0); expect(children).toBe(0); expect(session.snapshotAcquisition().acquisition.status).toBe('complete'); expect(processOperations.errors).toEqual([]);
    current.repairFacts = {calls,gpuReached,controlledNonJSONFunction:true,metadataReads,nativeOpens,children,noUnavailableFallback:true,actualErrorName:expected.error.name,actualErrorIssues:expected.error.issues};
  });
});
test.each([
  ['environment pending version fulfillment cannot survive original setup expiry','version','fulfill'],
  ['environment pending GPU fulfillment cannot become unavailable after original setup expiry','gpu','fulfill'],
  ['environment pending GPU rejection cannot become unavailable after original setup expiry','gpu','reject'],
] as const)('%s', async (_name,boundary,outcome) => {
  const fileCase = capturedFileCase(), current = originalCase(), gate = current.gate!;
  const snapshot = current.session!.snapshotAcquisition(), calls:string[] = [], lateReads:string[] = [];
  let entered!:() => void, release!:() => void, released = false, reached = false, collectorSettled = false, nativeOpens = 0, children = 0, outputOpens = 0;
  const entering = new Promise<void>(resolve => {entered = resolve;});
  const injected = Error('held GPU protocol rejection');
  const held = new Promise<unknown>((resolve,reject) => {release = () => {if (released) return; released = true; if (outcome === 'reject') reject(injected); else resolve(boundary === 'version' ? versionFixture : structuredClone(gpuFixture));};}); void held.catch(() => {});
  current.releaseHeld = release;
  const canonical = await fs.realpath('/usr/bin/git');
  const cdp = {async send(method:string) {
    calls.push(method);
    if (method === (boundary === 'version' ? 'Browser.getVersion' : 'SystemInfo.getInfo')) {reached = true; entered(); return held;}
    if (method === 'Browser.getVersion') return versionFixture;
    if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium','--enable-automation']};
    throw Error('Forbidden CDP request after held boundary');
  }} as unknown as CDPSession;
  fileOperations.opened = async (path,fd) => {if (path === canonical) nativeOpens++; if (reached && path.startsWith(current.root! + '/')) lateReads.push(relative(current.root!,path)); if (reached && path.startsWith(current.output! + '/')) outputOpens++; return fd;};
  processOperations.spawned = () => {children++;};
  let collecting:Promise<unknown> | undefined, actualError:unknown;
  const submitted = gate.runExpired(current.name,session => actualBody.run(fileCase,() => {
    fileCoordinator.active(fileCase);
    collecting = collectComparisonEnvironment(session,cdp,'conformance').catch(error => {actualError = error; throw error;}).finally(() => {collectorSettled = true;});
    void collecting.catch(() => {}); return collecting.then(() => {});
  })); void submitted.catch(() => {});
  await entering; expect(reached).toBe(true); expect(released).toBe(false); expect(collectorSettled).toBe(false);
  current.expireSetup!(); const expired = await submitted;
  expect(expired.status).toBe('expired'); expect(expired.deadline).toMatchObject({stage:'setup',budgetMs:60000,reason:'setup absolute deadline expired'});
  expect(gate.observation().callbackSettled).toBe(false); expect(collectorSettled).toBe(false); expect(released).toBe(false);
  current.firstCleanup = gate.cleanup(current.name); void current.firstCleanup.catch(() => {});
  expect(released).toBe(true);
  await expect(collecting!).rejects.toThrow('Ownership generation revoked or deadline expired');
  await current.firstCleanup; await gate.owner.ownershipSettled;
  expect(actualError).toBeInstanceOf(Error); expect(actualError).not.toBe(injected);
  expect(collectorSettled).toBe(true); expect(gate.observation().callbackSettled).toBe(true); expect(gate.owner.canContinue).toBe(true);
  expect(calls).toEqual(boundary === 'version' ? ['Browser.getVersion'] : ['Browser.getVersion','Browser.getBrowserCommandLine','SystemInfo.getInfo']);
  expect(lateReads).toEqual([]); expect(nativeOpens).toBe(0); expect(children).toBe(0); expect(outputOpens).toBe(0); expect(processOperations.errors).toEqual([]);
  expect(current.session!.snapshotAcquisition()).toEqual(snapshot);
  current.repairFacts = {calls,boundary,outcome,reached,released,collectorSettled,callbackSettled:gate.observation().callbackSettled,actualSetupExpired:expired,firstDisposal:gate.observation().disposal,actualOwnershipSettled:true,canContinue:gate.owner.canContinue,actualFailures:gate.owner.failures,lateReads,nativeOpens,children,outputOpens,pureSnapshotUnchanged:true,actualError:actualError instanceof Error ? actualError.message : 'non-Error'};
});
test('fresh worker spawn excludes hostile inherited Node options and execution flags', async () => {
  const current = originalCase();
  await acquired(async session => {
    const observed = current.workerSpawn; expect(observed).toBeDefined(); if (!observed) throw Error('Actual fresh worker spawn not observed');
    await Promise.all(observed.actualCloses); expect(observed.actualCloses).toHaveLength(4);
    expect(observed.command).toBe(process.execPath); expect(observed.args).toEqual([join(current.root!,'packages/runner/dist/comparison-assembly-worker.js')]);
    expect(observed.cwd).toBe(current.root); expect(observed.shell).toBe(false); expect(observed.detached).toBe(false); expect(observed.stdio).toEqual(['pipe','pipe','pipe']);
    expect(observed.env).toEqual({NODE_DISABLE_COMPILE_CACHE:'1'}); expect(observed.hostile).toEqual(current.hostileWorker);
    expect(current.workerSpawnCount).toBe(1);
    expect(observed.argv).toEqual(['--require',join(current.root!,'nonexistent-private-preload.cjs')]);
    expect(session.snapshotAcquisition().acquisition.status).toBe('complete'); expect(session.snapshotAcquisition().persistence.status).toBe('complete'); expect(processOperations.errors).toEqual([]);
    const {actualCloses,...facts} = observed; current.repairFacts = {...facts,actualChildAndPipeCloses:actualCloses.length,actualOriginalPairAndPersistence:true,noPreloadExecuted:true};
  });
});
test('native Git spawn excludes hostile inherited config and worktree controls', async () => {
  const fileCase = capturedFileCase(), current = originalCase(), spawns:ActualSpawnFacts[] = [], nativeClosedAtSpawn:boolean[] = []; let nativeFD:FileHandle | undefined, nativeClosed = false, nativeCloses = 0;
  await acquired(async session => {
    const hostileConfig = join(current.root!,'private-hostile-git-config');
    const hostile = {GIT_CONFIG_GLOBAL:hostileConfig,GIT_CONFIG_SYSTEM:hostileConfig,GIT_CONFIG_NOSYSTEM:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'status.showUntrackedFiles',GIT_CONFIG_VALUE_0:'no',GIT_DIR:join(current.root!,'nonexistent-git-dir'),GIT_WORK_TREE:join(current.root!,'nonexistent-work-tree'),GIT_INDEX_FILE:join(current.root!,'nonexistent-index'),PATH:join(current.root!,'nonexistent-path')};
    challengeParent(fileCase,hostile);
    const native = await fs.realpath('/usr/bin/git');
    fileOperations.opened = async (path,fd) => {if (path !== native) return fd; nativeFD = fd; return new Proxy(fd,{get(target,key) {if (key === 'close') return async () => {await target.close(); nativeCloses++; try {await target.stat();} catch (error) {if ((error as NodeJS.ErrnoException).code === 'EBADF') nativeClosed = true;} };const value = Reflect.get(target,key,target);return typeof value === 'function' ? value.bind(target) : value;}});};
    processOperations.spawned = observation => {nativeClosedAtSpawn.push(nativeClosed);spawns.push(spawnFacts(observation,Object.keys(hostile)));};
    const cdp = {async send(method:string) {if (method === 'Browser.getVersion') return versionFixture; if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium','--enable-automation']}; if (method === 'SystemInfo.getInfo') throw Error('GPU unavailable'); throw Error('Unexpected CDP');}} as unknown as CDPSession;
    const capture = await collectComparisonEnvironment(session,cdp,'conformance'); expect(capture.facts.git.dirty).toBe(true); expect(capture.facts.git.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(capture.facts.git.revision).toBe(current.isolationHead);
    expect(spawns).toHaveLength(2);
    const executable = await fs.realpath('/usr/bin/git'), prefix = ['--no-optional-locks',`--work-tree=${current.root}`,'-c','core.fsmonitor=false','-c','core.untrackedCache=false'];
    for (const [index,row] of spawns.entries()) {
      await Promise.all(row.actualCloses); expect(row.actualCloses).toHaveLength(4); expect(row.command).toBe(executable); expect(row.cwd).toBe(current.root);
      expect(row.args).toEqual([...prefix,...(index === 0 ? ['rev-parse','--verify','HEAD'] : ['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'])]);
      expect(row.env).toEqual({GIT_CONFIG_GLOBAL:devNull,GIT_CONFIG_SYSTEM:devNull,GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'});
      expect(row.hostile).toEqual(hostile); expect(row.shell).toBe(false); expect(row.detached).toBe(false); expect(row.stdio).toEqual(['pipe','pipe','pipe']);
    }
    expect(current.nativeAdoptions).toBe(1); expect(processOperations.errors).toEqual([]);
    expect(nativeCloses).toBe(1); expect(nativeClosedAtSpawn).toEqual([true,true]); expect(nativeFD).toBeDefined();await expect(nativeFD!.stat()).rejects.toThrow();
    current.repairFacts = {git:capture.facts.git,nativeAdoptions:current.nativeAdoptions,nativeCloses,nativeClosedAtSpawn,spawns:spawns.map(({actualCloses,...facts}) => ({...facts,actualChildAndPipeCloses:actualCloses.length})),actualUntrackedCanary:true};
  });
});
test.each(gitPolicyCases)('%s',async (_name,purpose,mutation,phase) => {
  const current = originalCase(), git = promisify(execFile), options = {cwd:current.root!,env:{GIT_CONFIG_GLOBAL:devNull,GIT_CONFIG_SYSTEM:devNull,GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'}};
  markOriginalCase(current,'actual Git policy body entered');
  const spawns:ActualSpawnFacts[] = [];
  const cdp = {async send(method:string) {if (method === 'Browser.getVersion') return versionFixture; if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium','--enable-automation']}; if (method === 'SystemInfo.getInfo') throw Error('GPU unavailable');throw Error('Unexpected CDP');}} as unknown as CDPSession;
  await acquired(async session => {
    expect(current.policyInitialStatus).toBe('');
    if (mutation === 'submodule') expect(current.policyGitlink).toMatch(/^100644 [a-f0-9]{40} 0\t\.gitmodules\n160000 [a-f0-9]{40} 0\tprivate-submodule\n$/);
    expect(session.snapshotAcquisition().acquisition.members.some(row => row.key.startsWith('private-git-canaries/') || row.key.startsWith('private-submodule/'))).toBe(false);
    processOperations.spawned = observation => {spawns.push(spawnFacts(observation,[]));};
    let baseline:Awaited<ReturnType<typeof collectComparisonEnvironment>> | undefined, served:Awaited<ReturnType<Awaited<ReturnType<typeof collectComparisonEnvironment>>['recheckBeforeServing']>> | undefined;
    if (phase === 'serving') {baseline = await collectComparisonEnvironment(session,cdp,purpose); expect(baseline.facts.git).toEqual({revision:current.policyHead,dirty:false});}
    await fs.writeFile(current.policyCanary!,'changed actual Git-only canary');
    const head = (await git('/usr/bin/git',['rev-parse','--verify','HEAD'],options)).stdout.trim(); expect(head).toBe(current.policyHead);
    const status = (await git('/usr/bin/git',['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none'],options)).stdout;
    expect(status).toBe(mutation === 'submodule' ? ' M private-submodule\n' : '?? private-git-canaries/untracked-canary\n');
    const serving = await session.recheckBeforeServing(); expect(serving.assets).toBeDefined();
    if (phase === 'initial') {baseline = await collectComparisonEnvironment(session,cdp,purpose); expect(baseline.facts.git).toEqual({revision:head,dirty:true});}
    else if (purpose === 'publication') await expect(baseline!.recheckBeforeServing()).rejects.toThrow('Original Git state changed before serving');
    else {served = await baseline!.recheckBeforeServing(); expect(served.git).toEqual({revision:head,dirty:true}); expect(baseline!.facts.git.dirty).toBe(false);}
    const count = phase === 'initial' ? 2 : 4; expect(spawns).toHaveLength(count);
    for (const [index,row] of spawns.entries()) {await Promise.all(row.actualCloses);expect(row.actualCloses).toHaveLength(4);expect(row.args.slice(- (index % 2 === 0 ? 3 : 4))).toEqual(index % 2 === 0 ? ['rev-parse','--verify','HEAD'] : ['status','--porcelain=v1','--untracked-files=all','--ignore-submodules=none']);}
    expect(processOperations.errors).toEqual([]);
    current.repairFacts = {purpose,mutation,phase,initialNativeStatus:current.policyInitialStatus,mainHeadBefore:current.policyHead,mainHeadAfter:head,actualNativeStatusAfter:status,genuinePostMutationRecheck:true,canaryOutsideProvenanceAncestorChains:true,actualSubmodule:mutation === 'submodule',actualGitlinkAndGitmodules:current.policyGitlink,extraRepo:current.extraRepo,baselineGit:baseline!.facts.git,servedGit:served?.git,publicationRejected:purpose === 'publication',spawns:spawns.map(({actualCloses,...facts}) => ({...facts,actualChildAndPipeCloses:actualCloses.length}))};
  });
});
test.each([
  ['native Git actual FD progressing short reads complete only the fixed header','progress'],
  ['native Git actual FD zero progress rejects before Git spawn','zero'],
  ['native Git actual FD read continuation cannot survive setup expiry','expiry'],
] as const)('%s',async (_name,mode) => {
  const fileCase = capturedFileCase(), current = originalCase(), canonical = await fs.realpath('/usr/bin/git');
  const before = current.session!.snapshotAcquisition(), firstEight = Buffer.alloc(8), reads:{position:number;requested:number;delegated:number;returned:number}[] = [], spawns:ActualSpawnFacts[] = [], closedAtSpawn:boolean[] = [];
  let nativeFD:FileHandle | undefined, nativeCloses = 0, closedProof = false, fdStats = 0, pathStatsAfterClose = 0, returnedTotal = 0, collectorSettled = false;
  let entered!:() => void, release!:() => void, closeResolved!:() => void, closeRejected!:(error:unknown) => void, released = false;
  const entering = new Promise<void>(resolve => {entered = resolve;}), held = new Promise<void>(resolve => {release = () => {if (!released) {released = true;resolve();}};});
  const actualClosed = new Promise<void>((resolve,reject) => {closeResolved = resolve;closeRejected = reject;}); void actualClosed.catch(() => {});
  if (mode === 'expiry') current.releaseHeld = () => {if (nativeFD) void actualClosed.then(release,release);else release();};
  fileOperations.statted = (path,stat) => {if (path === canonical && closedProof) pathStatsAfterClose++;return stat;};
  fileOperations.opened = async (path,fd) => {
    if (path !== canonical) return fd; nativeFD = fd;
    return new Proxy(fd,{get(target,key) {
      if (key === 'stat') return (...args:Parameters<FileHandle['stat']>) => {fdStats++;current.nativeEvents!.push('actual FD stat');return target.stat(...args);};
      if (key === 'read') return async (buffer:Buffer,offset:number,length:number,position:number) => {
        const delegated = mode === 'zero' && reads.length === 1 ? 0 : Math.min(2,length);
        const result = await target.read(buffer,offset,delegated,position);
        reads.push({position,requested:length,delegated,returned:result.bytesRead});returnedTotal += result.bytesRead;
        if (position < 8) buffer.copy(firstEight,position,offset,offset + Math.min(result.bytesRead,8 - position));
        current.nativeEvents!.push('actual delegated native read completed');
        if (mode === 'expiry' && reads.length === 1) {entered();await held;}
        return result;
      };
      if (key === 'close') return async () => {
        try {await target.close();nativeCloses++;current.nativeEvents!.push('actual native close fulfilled');
          try {await target.stat();} catch (error) {closedProof = (error as NodeJS.ErrnoException).code === 'EBADF';}
          if (closedProof) current.nativeEvents!.push('actual closed FD stat observed');closeResolved();
        } catch (error) {closeRejected(error);throw error;}
      };
      const value = Reflect.get(target,key,target);return typeof value === 'function' ? value.bind(target) : value;
    }});
  };
  processOperations.spawned = observation => {closedAtSpawn.push(closedProof);current.nativeEvents!.push('actual Git spawn');spawns.push(spawnFacts(observation,[]));};
  const cdp = {async send(method:string) {if (method === 'Browser.getVersion') return versionFixture;if (method === 'Browser.getBrowserCommandLine') return {arguments:['/private/fixture/chromium','--enable-automation']};if (method === 'SystemInfo.getInfo') throw Error('GPU unavailable');throw Error('Unexpected CDP');}} as unknown as CDPSession;
  let collecting:ReturnType<typeof collectComparisonEnvironment> | undefined;
  const collect = (session:Session) => {collecting = collectComparisonEnvironment(session,cdp,'conformance').finally(() => {collectorSettled = true;});void collecting.catch(() => {});return collecting;};
  const proof = async () => {
    expect(nativeFD).toBeDefined();expect(current.nativeAdoptions).toBe(1);expect(current.nativeEvents![0]).toBe('adopt');
    expect(nativeCloses).toBe(1);expect(closedProof).toBe(true);await expect(nativeFD!.stat()).rejects.toMatchObject({code:'EBADF'});
    expect(reads.length).toBeGreaterThan(0);expect(returnedTotal).toBeLessThanOrEqual(64);
    let position = 0;for (const row of reads) {expect(row.position).toBe(position);expect(row.delegated).toBeLessThanOrEqual(2);expect(row.returned).toBeLessThanOrEqual(row.delegated);position += row.returned;}
    if (mode === 'progress') {
      const magic = firstEight.readUInt32BE(0);
      const expected = magic === 0x7f454c46 ? firstEight[4] === 1 ? 52 : firstEight[4] === 2 ? 64 : 0 : [0xfeedface,0xcefaedfe].includes(magic) ? 28 : [0xfeedfacf,0xcffaedfe].includes(magic) ? 32 : [0xcafebabe,0xbebafeca,0xcafebabf,0xbfbafeca].includes(magic) ? 8 : 0;
      expect(expected).toBeGreaterThanOrEqual(8);expect(returnedTotal).toBe(expected);expect(fdStats).toBe(2);
      for (const row of reads) expect(row.requested).toBe((row.position < 8 ? 8 : expected) - row.position);
      expect(spawns).toHaveLength(2);expect(closedAtSpawn).toEqual([true,true]);
      expect(current.nativeEvents!.indexOf('actual closed FD stat observed')).toBeLessThan(current.nativeEvents!.indexOf('actual Git spawn'));
      for (const row of spawns) {await Promise.all(row.actualCloses);expect(row.actualCloses).toHaveLength(4);}
    } else {
      expect(reads).toHaveLength(mode === 'zero' ? 2 : 1);expect(fdStats).toBe(1);expect(pathStatsAfterClose).toBe(0);expect(spawns).toEqual([]);expect(returnedTotal).toBe(2);
      if (mode === 'zero') expect(reads[1]).toEqual({position:2,requested:6,delegated:0,returned:0});
    }
    expect(collectorSettled).toBe(true);expect(processOperations.errors).toEqual([]);expect(current.session!.snapshotAcquisition()).toEqual(before);
    current.repairFacts = {mode,actualFirstEight:firstEight.toString('hex'),reads,returnedTotal,fdStats,pathStatsAfterClose,nativeAdoptions:current.nativeAdoptions,nativeCloses,closedFDStatEBADF:closedProof,events:current.nativeEvents,collectorSettled,released,controlledZeroLengthSyscallContradiction:mode === 'zero',physicalEOFClaim:false,spawns:spawns.map(({actualCloses,...facts}) => ({...facts,actualChildAndPipeCloses:actualCloses.length})),closedAtSpawn,pureSnapshotUnchanged:true};
  };
  if (mode === 'expiry') {
    const gate = current.gate!;
    const submitted = gate.runExpired(current.name,session => actualBody.run(fileCase,() => {fileCoordinator.active(fileCase);return collect(session).then(() => {});}));void submitted.catch(() => {});
    await entering;expect(reads).toHaveLength(1);expect(collectorSettled).toBe(false);expect(released).toBe(false);
    current.expireSetup!();const expired = await submitted;expect(expired.status).toBe('expired');expect(collectorSettled).toBe(false);expect(gate.observation().callbackSettled).toBe(false);
    current.firstCleanup = gate.cleanup(current.name);void current.firstCleanup.catch(() => {});
    await expect(collecting!).rejects.toThrow('Ownership generation revoked or deadline expired');await current.firstCleanup;await gate.owner.ownershipSettled;
    expect(released).toBe(true);expect(gate.owner.canContinue).toBe(true);await proof();
    Object.assign(current.repairFacts!,{actualSetupExpired:expired,firstDisposal:gate.observation().disposal,actualOwnershipSettled:true,callbackSettled:gate.observation().callbackSettled,actualFailures:gate.owner.failures});
  } else await acquired(async session => {if (mode === 'zero') await expect(collect(session)).rejects.toThrow('Short native Git header');else expect((await collect(session)).facts.git.revision).toMatch(/^[a-f0-9]{40}$/);await proof();});
});
test('genuine smaller original inventory resolves every reviewed profile declaration', async () => {
  await acquired(async session => {
    const profile = await resolveComparisonThreadplaneProfile(session);
    expect(profile).toMatchObject({id: 'threadplane', profile: 'threadplane-langgraph-custom-transport', capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, configuration: {markdown: 'default', pinThresholdCssPx: 150, telemetry: 'disabled'}});
    expect(profile.build.packages.find(row => row.name === '@threadplane/chat')?.version).toBe('0.3.2');
  });
});
test.each(['app.ts', 'main.ts', 'host.ts', 'index.html', 'styles.css', '../angular.json'])('new genuine records cannot authorize unknown complete configuration %s', async () => {
  await acquired(async session => {await expect(resolveComparisonThreadplaneProfile(session)).rejects.toThrow('configuration');});
});
test('actual source change after fresh assembly prevents genuine profile pre-serving recheck', async () => {
  await acquired(async session => {
    await fs.appendFile(join(root, 'apps/threadplane/src/app.ts'), '\n/* changed after assembly */\n');
    await expect(session.recheckBeforeServing()).rejects.toThrow();
    await expect(recheckComparisonThreadplaneProfile(session)).rejects.toThrow();
  });
});
test.each(['chat', 'Angular core'])('genuine physical profile rejects %s', async () => {
  await acquired(async session => {await expect(resolveComparisonThreadplaneProfile(session)).rejects.toThrow(/framework|chat package/);});
});
test('missing reviewed configuration remains rejected with genuine fresh records', async () => {
  await acquired(async session => {await expect(resolveComparisonThreadplaneProfile(session)).rejects.toThrow();});
});
const versionFixture = {protocolVersion: '1.3', product: 'Chromium fixture', revision: 'actual-cdp-revision', userAgent: 'fixture user agent', jsVersion: 'fixture-js'};
test.each(['protocolVersion', 'product', 'revision', 'userAgent', 'jsVersion', 'automation', 'executable'])('checked CDP rejects missing actual %s identity before native Git', async missing => {
  const cdp = {async send(method: string) {
    if (method === 'Browser.getVersion') return {...versionFixture, ...(Object.hasOwn(versionFixture, missing) ? {[missing]: ''} : {})};
    if (method === 'Browser.getBrowserCommandLine') return {arguments: missing === 'automation' ? ['/private/fixture/chromium'] : ['', '--enable-automation']};
    throw new Error('Unexpected later CDP request');
  }} as unknown as CDPSession;
  await acquired(async session => {await expect(collectComparisonEnvironment(session, cdp, 'conformance')).rejects.toThrow('Browser omitted');});
});
test('genuine environment rejects actual dirty publication worktree', async () => {
  const cdp = {async send(method: string) {
    if (method === 'Browser.getVersion') return versionFixture;
    if (method === 'Browser.getBrowserCommandLine') return {arguments: ['/private/fixture/chromium', '--enable-automation']};
    if (method === 'SystemInfo.getInfo') throw new Error('GPU unavailable');
    throw new Error('Unexpected CDP request');
  }} as unknown as CDPSession;
  await acquired(async session => {await expect(collectComparisonEnvironment(session, cdp, 'publication')).rejects.toThrow('clean original worktree');});
});
test('genuine environment reads actual private Git state, typed CDP and original Playwright metadata', async () => {
  const git = promisify(execFile);
  const gitOptions = {cwd: root, env: {GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_GLOBAL: '/dev/null'}};
  const cdp = {async send(method: string) {
    if (method === 'Browser.getVersion') return {protocolVersion: '1.3', product: 'Chromium fixture', revision: 'actual-cdp-revision', userAgent: 'fixture user agent', jsVersion: 'fixture-js'};
    if (method === 'Browser.getBrowserCommandLine') return {arguments: ['/private/fixture/chromium', '--enable-automation']};
    if (method === 'SystemInfo.getInfo') throw new Error('GPU protocol unavailable');
    throw new Error('Unexpected CDP request');
  }} as unknown as CDPSession;
  await acquired(async session => {
    const capture = await collectComparisonEnvironment(session, cdp, 'conformance');
    expect(Object.isFrozen(capture)).toBe(true); expect(capture.facts.git).toMatchObject({dirty: true});
    expect(capture.facts.browserProtocol).toEqual({protocolVersion: '1.3', product: 'Chromium fixture', revision: 'actual-cdp-revision', userAgent: 'fixture user agent', jsVersion: 'fixture-js'});
    capture.facts.git.revision = 'caller mutation';
    expect((await capture.recheckBeforeServing()).git.revision).toMatch(/^[a-f0-9]{40}$/);
    await git('/usr/bin/git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--allow-empty', '-m', 'Changed original revision'], gitOptions);
    await expect(capture.recheckBeforeServing()).rejects.toThrow('Git state changed');
  });
});
});


describe('isolated genuine filesystem capacity admission', () => {
  // Includes filesystem fixture preparation before the unchanged 60s setup deadline starts.
  const capacityWholeBodyMs = 120000;
  type CapacityState = {
    root?: string; output?: string; preparation?: Promise<void>; preparationSettled: boolean; abandoned: boolean;
    body?: Promise<void>; bodySettled: boolean;
    owner?: ComparisonOwnership; stage?: ReturnType<ComparisonOwnership['run']>; operation?: Promise<void>;
    result?: Awaited<ReturnType<ComparisonOwnership['run']>>; session?: Session; underlyingSettled: boolean;
    expectedCount?: number; assets?: number; finalAnchor: boolean; destinations: number; children: number;
    baseline?: string[]; proofPassed: boolean; phases: {name: string; elapsedMs: number}[]; started: number;
  };
  const capacityCases = new WeakMap<TestContext['task'],CapacityState>();
  beforeEach(({task}) => {
    const fileCase = fileCases.get(task)!; if (!fileCase.admitted) return; fileCoordinator.active(fileCase); fileCase.managed = true;
    capacityCases.set(task,{preparationSettled:true,bodySettled:true,abandoned:false,underlyingSettled:false,finalAnchor:false,destinations:0,children:0,proofPassed:false,phases:[],started:performance.now()});
  });
  afterEach(async ({task}) => {
    const fileCase = fileCases.get(task)!; if (!fileCase.admitted) return;
    const current = capacityCases.get(task)!; current.abandoned = true; fileCase.abandoned = true;
    pendingForensic(fileCase,{taskId:task.id,test:capacityCaseName,state:'pending',bodySettled:fileCase.bodySettled,preparationSettled:current.preparationSettled,underlyingSettled:current.underlyingSettled,root:current.root,output:current.output});
    fileCase.innerCleanup = (async () => {
    const phase = (name: string) => current.phases.push({name, elapsedMs:performance.now() - current.started});
    const disposal = current.owner?.dispose(); // FIRST revocation before awaiting ALL actual body/preparation work.
    if (disposal) {phase('first actual disposal initiated'); void disposal.catch(() => {});}
    const outcomes = await Promise.allSettled([current.preparation, current.body, current.operation, current.stage, disposal,fileCase.body]);
    if (current.owner) await current.owner.ownershipSettled;
    phase(current.owner ? 'first disposal and actual body callback ownership settled' : 'actual pure preparation/body settled; owner and disposal N/A');
    fileCoordinator.assert(fileCase);
    const disposed = outcomes[4]?.status === 'fulfilled' ? outcomes[4].value : undefined;
    const safe = current.preparationSettled && current.bodySettled && (!current.owner || current.underlyingSettled && disposed?.status === 'complete' && current.owner.canContinue);
    fileCase.resourceSafe = safe;
    const disposalFailure = selectPrimary(fileCase,[{outcome:outcomes[4],failures:current.owner?.failures ?? [],allowed:false}],[outcomes[0],outcomes[1],outcomes[5]]);
    await preservePrimary(disposalFailure,fileCase,() => persistForensic(fileCase,safe ? 'settled' : 'unsafe', {test:capacityCaseName, allocation:{preparationHookMs:null, wholeBodyMs:capacityWholeBodyMs, cleanupHookMs:10000, actualOwnerSetupMs:current.owner ? 60000 : 'N/A'}, root:current.root, output:current.output, localPaths:[...(fileCase.localPaths ?? [])], phases:current.phases, expectedCount:current.expectedCount, assets:current.assets, finalAnchor:current.finalAnchor, destinations:current.destinations, children:current.children, result:current.result ?? 'N/A', owner:current.owner ? 'created after actual pure preparation' : 'N/A', disposal:disposed ?? 'N/A', actualOwnershipSettled:current.owner ? true : 'N/A', canContinue:current.owner?.canContinue ?? 'N/A', primary:disposalFailure?.reason instanceof Error ? disposalFailure.reason.message : disposalFailure ? 'non-Error' : null, evidenceErrors:fileCase.evidenceErrors.map(row => row instanceof Error ? row.message : 'non-Error'), preparationSettled:current.preparationSettled, bodySettled:current.bodySettled, underlyingSettled:current.underlyingSettled, proofPassed:current.proofPassed, resourceSafe:safe, failures:current.owner?.failures ?? [], operations:outcomes.map(row => row.status === 'rejected' ? {status:row.status, reason:row.reason instanceof Error ? row.reason.message : 'non-Error rejection'} : {status:row.status})}));
    expect(safe).toBe(true); fileCase.safe = true;
    if (current.owner) expect(current.owner.failures).toEqual([expect.objectContaining({stage:'setup', message:'Comparison member capacity exceeded', resource:null})]);
    if (!current.proofPassed || !outcomes.every(row => row.status === 'fulfilled' || row === outcomes[2])) fileCase.retainPaths = true;
    })(); void fileCase.innerCleanup.catch(() => {}); await fileCase.innerCleanup;
  });
  test(capacityCaseName, {timeout:capacityWholeBodyMs}, async () => {
    const fileCase = capturedFileCase();
    const current:CapacityState = {preparationSettled:false, bodySettled:false, abandoned:false, underlyingSettled:false, finalAnchor:false, destinations:0, children:0, proofPassed:false, phases:[], started:performance.now()};
    capacityCases.set(fileCase.task,current);
    const phase = (name: string) => current.phases.push({name, elapsedMs:performance.now() - current.started});
    const active = () => {fileCoordinator.active(fileCase); if (current.abandoned) throw Error('Capacity case abandoned');};
    phase('whole capacity body entered');
    current.body = (async () => {
      current.preparation = (async () => {
        phase('pure preparation entered');
        const root = await originalFixture(true, created => {current.root = created; (fileCase.localPaths ??= new Set()).add(created);},undefined,active); active();
        phase('genuine smaller fixture prepared');
        // Closed smaller graph101 +3996 actual extra files reaches4097 exactly.
        for (let i = 0; i < 3996; i++) {active(); await fs.writeFile(join(root, 'apps/threadplane/dist', `capacity-${String(i).padStart(4, '0')}.bin`), ''); active();}
        phase('3996 physical assets created');
        await publishFixtureRecords(root,undefined,active); active(); phase('genuine private records published');
        const build = adapterBuildSchema.parse(JSON.parse(await fs.readFile(join(root, 'apps/threadplane/.build-evidence.json'), 'utf8'))); active();
        const probe = comparisonInstrumentationBuildSchema.parse(JSON.parse(await fs.readFile(join(root, 'packages/runner/.comparison-build-evidence.json'), 'utf8'))); active();
        current.assets = Object.keys(build.assetHashes).length;
        current.expectedCount = 2 + Object.keys(build.sourceHashes).length + Object.keys(probe.sourceHashes).length + Object.keys(probe.compiledHashes).length + current.assets + new Set([...build.packages.map(row => row.resolutionPath), probe.compiler.resolutionPath, probe.nativeCompiler.resolutionPath]).size;
        expect(current.assets).toBe(3997); expect(current.expectedCount).toBe(4097);
      })().finally(() => {current.preparationSettled = true; phase('actual pure preparation settled');});
      void current.preparation.catch(() => {});
      await current.preparation; active();
      current.owner = new ComparisonOwnership(); phase('one actual owner created after preparation');
      current.output = await localOutput('comparison-capacity-output-'); active();
      const writer = await ComparisonArtifactWriter.create(current.output); active();
      current.baseline = await fs.readdir(current.output, {recursive:true}); active();
      fileOperations.statted = (path, stat) => {if (path === join(current.root!, 'apps/threadplane/dist/capacity-3995.bin') && typeof stat.ino === 'bigint') current.finalAnchor = true; return stat;};
      processOperations.created = () => {current.children++;}; // Non-throwing; unchanged tracker observes/adopts unexpected child.
      active();
      current.stage = current.owner.run('setup', ownership => {
        current.operation = (async () => {
          phase('one actual setup acquisition entered'); active(); ownership.assertActive();
          const scoped = writer.scoped(() => ownership.assertActive());
          const counted: typeof scoped = {
            async stream(path) {current.destinations++; return scoped.stream(path);},
            async text(path, value) {current.destinations++; return scoped.text(path, value);},
            async json(path, value) {current.destinations++; return scoped.json(path, value);},
            async append(path, value) {current.destinations++; return scoped.append(path, value);},
            async appendSerialized(path, value) {current.destinations++; return scoped.appendSerialized(path, value);},
          };
          current.session = api.createComparisonProvenanceSession({...context(), ownership, writer:counted}, current.root!);
          await current.session.acquire(canonicalSerialize(preOptions), canonicalSerialize(mainOptions));
        })().finally(() => {current.underlyingSettled = true; phase('actual underlying acquisition settled');});
        void current.operation.catch(() => {}); return current.operation;
      });
      void current.stage.catch(() => {});
      current.result = await current.stage; active(); phase('actual setup result observed');
      expect(current.result.status, JSON.stringify(current.owner.failures)).toBe('failed');
      expect(current.owner.failures).toEqual([expect.objectContaining({stage:'setup', message:'Comparison member capacity exceeded', resource:null})]);
      expect(current.underlyingSettled).toBe(true);
      expect(current.expectedCount).toBe(4097); expect(current.assets).toBe(3997); expect(current.finalAnchor).toBe(true);
      expect(current.destinations).toBe(0); expect(current.children).toBe(0);
      const inventory = await fs.readdir(current.output, {recursive:true}); active(); expect(inventory).toEqual(current.baseline);
      const snapshot = current.session!.snapshotAcquisition();
      expect(snapshot.acquisition.members).toEqual([]); expect(snapshot.acquisition.status).toBe('partial');
      expect(snapshot.payloads.every(row => row.status === 'not-attempted')).toBe(true); expect(snapshot.persistence.status).toBe('not-attempted');
      current.proofPassed = true; phase('specific capacity proof assertions passed');
    })().finally(() => {current.bodySettled = true; phase('actual whole body settled');});
    void current.body.catch(() => {}); await current.body;
  });
});
