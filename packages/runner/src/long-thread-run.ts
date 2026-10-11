import {randomUUID} from 'node:crypto';
import {comparisonCaptureInvocationSchema, comparisonScheduledRunSchema, comparisonValidationSchema, comparisonExceptionsSchema, comparisonEvidenceSchema, comparisonCaptureStatusSchema, comparisonRawInventorySchema, comparisonFinalizationStatusSchema, canonicalSerialize, createLongThreadFixture, type ComparisonCaptureStatus, type ComparisonCaptureInvocation, type ComparisonIdentity, type ComparisonValidation, type ComparisonEvidence, type ComparisonDeadline, type LongThreadFixture} from '@chat-ui-bench/contract';
import {ComparisonArtifactWriter, type ComparisonScopedWriter, type ComparisonPayloadFile, type ComparisonFileOperations} from './comparison-artifacts.js';
import {ComparisonOwnership, type ComparisonOwnershipClock, type ComparisonOwnershipContext} from './comparison-ownership.js';
import {validateLongThreadConfiguration, type LongThreadConfiguration} from './long-thread-cli.js';
const versions = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0'} as const;
type Slot = ComparisonCaptureInvocation['runs'][number];
export interface ComparisonSlotContext {identity: ComparisonIdentity; descriptor: ReturnType<typeof comparisonScheduledRunSchema.parse>; fixture: LongThreadFixture; writer: ComparisonScopedWriter; ownership: ComparisonOwnershipContext}
export interface ComparisonSlotCapture {
  validation: ComparisonValidation;
  /** Actual instrumentation metadata only. Absent before acquisition/instrumentation exists. */
  evidence?: Omit<ComparisonEvidence, 'files'>;
  payloadFiles?: readonly ComparisonPayloadFile[];
}
export interface ComparisonSlotFinalization {
  payloadFiles: readonly ComparisonPayloadFile[];
  captureStatus: ComparisonCaptureStatus;
  evidence?: Omit<ComparisonEvidence,'files'>;
}
export interface ComparisonSlotDriver<State> {
  setup(context: ComparisonSlotContext): Promise<State>;
  /** Scored phases close before full validation reads; both remain inside the same 30s ownership stage. */
  replay(context: ComparisonSlotContext, state: State): Promise<ComparisonSlotCapture>;
  /** Filesystem-only final persistence after all owned asynchronous work settles. No browser calls here. */
  finalize?(context: {identity: ComparisonIdentity; writer: ComparisonScopedWriter; readonly deadlines: readonly Readonly<ComparisonDeadline>[]}, capture: ComparisonSlotCapture | null): Promise<void | ComparisonSlotFinalization>;
}
export interface ComparisonInvocationExecution {
  invocation: ComparisonCaptureInvocation; readonly finalized: boolean; readonly unsafeOutstanding: boolean;
  readonly ownershipSettled: Promise<void>;
  finalize(): Promise<void>;
}
export function createLongThreadLedger(config: LongThreadConfiguration): ComparisonCaptureInvocation {
  config = validateLongThreadConfiguration(config);
  const runs: Slot[] = [];
  for (let round = 1; round <= config.configuration.rounds; round++) config.configuration.caseOrder.forEach((scenarioId, caseIndex) => config.configuration.adapterProfiles.forEach((adapterProfile, profileIndex) => {
    runs.push({round, caseIndex, scenarioId, adapterProfile, repetition: `${round}-${caseIndex}-${profileIndex}`, artifactDirectory: `runs/round-${round}/case-${caseIndex}/profile-${profileIndex}`, status: 'scheduled', reasons: []});
  }));
  return comparisonCaptureInvocationSchema.parse({...versions, createdAt: new Date().toISOString(), purpose: config.purpose, status: 'pending', configuration: config.configuration, runs});
}
function identity(slot: Slot): ComparisonIdentity {return {...versions, repetition: slot.repetition, scenarioId: slot.scenarioId, round: slot.round, caseIndex: slot.caseIndex, adapterProfile: slot.adapterProfile};}
function terminalStatus(slot:Slot):'valid'|'invalid'|'failed' {
  if(slot.status!=='valid' && slot.status!=='invalid' && slot.status!=='failed') throw new Error('Dataset slot has not actually terminalized');
  return slot.status;
}
function writtenManifest(files:readonly ComparisonPayloadFile[]):'evidence.json'|'raw-inventory.json'|null {
  const file=files.find(f=>f.path==='evidence.json' || f.path==='raw-inventory.json');
  return file?.path==='evidence.json' ? 'evidence.json' : file?.path==='raw-inventory.json' ? 'raw-inventory.json' : null;
}
function failed(id: ComparisonIdentity, reasons: string[]): ComparisonValidation {return comparisonValidationSchema.parse({...id, status: 'failed', checks: [{name: 'capture-ownership', passed: false, reason: reasons.join('; '), evidencePaths: ['descriptor.json', 'exceptions.json']}], reasons});}
function fixtureFor(slot: Slot, seed: number) {return createLongThreadFixture({seed, historyCount: ([100, 1000, 10000] as const)[Math.floor(slot.caseIndex / 4)]!, responseBytes: slot.caseIndex % 4 < 2 ? 6400 : 262144, journey: slot.caseIndex % 2 === 0 ? 'follow' : 'history-reading'});}
function describeError(error: unknown) {
  if (error instanceof Error) {const rendered = error.message || error.name; return rendered === '' ? 'Error with empty message and name' : rendered;}
  return error === '' ? 'Thrown empty string' : String(error);
}
const reserved=new Set(['descriptor.json','fixture.json','validation.json','exceptions.json','capture-status.json','finalization-status.json','evidence.json','raw-inventory.json']);
const reservedPath=(path:string)=>reserved.has(path.replace(/\.[a-f0-9-]{36}\.tmp$/,''));
function assertIdentity(value:ComparisonIdentity,id:ComparisonIdentity) {
  for(const key of Object.keys(id) as (keyof ComparisonIdentity)[]) if(value[key]!==id[key]) throw new Error('Driver finalization identity differs from scheduled slot');
}
function rawPath(path:string,id:ComparisonIdentity) {
  // Reuse the strict reviewed raw-role grammar, including atomic remnants.
  comparisonCaptureStatusSchema.parse({...unavailableStatus(id,'Path grammar admission only'),payloads:[{path,status:'complete'}]});
}
function driverWriter(writer:ComparisonArtifactWriter,id:ComparisonIdentity,guard:()=>void):ComparisonScopedWriter {
  const scoped=writer.scoped(guard);
  const check=(path:string)=>{if(reservedPath(path)) throw new Error('Driver cannot replace root-owned artifact'); rawPath(path,id);};
  return {text:async(path,value)=>{check(path); await scoped.text(path,value);},json:async(path,value)=>{check(path); await scoped.json(path,value);},append:async(path,entries)=>{check(path); await scoped.append(path,entries);},appendSerialized:async(path,records)=>{check(path); await scoped.appendSerialized(path,records);},stream:async path=>{check(path); return scoped.stream(path);}};
}
function unavailableStatus(id:ComparisonIdentity,reason:string):ComparisonCaptureStatus {
  const missing={status:'unavailable' as const,reason:reason.slice(0,4096)};
  return comparisonCaptureStatusSchema.parse({...id,status:'unavailable',reasons:[missing.reason],captureMetadata:missing,evidenceMetadata:missing,payloads:[],unavailablePaths:[],terminalPageDrain:missing,terminalProducerDrain:missing,finalPageInstrumentation:missing,traceEof:missing});
}
async function persistSlotInventory(writer:ComparisonArtifactWriter,id:ComparisonIdentity,validation:ComparisonValidation,capture:ComparisonSlotCapture|null,finalization:void|ComparisonSlotFinalization):Promise<'evidence.json'|'raw-inventory.json'> {
  if(finalization && (typeof finalization!=='object' || Array.isArray(finalization) || Object.keys(finalization).some(key=>!['payloadFiles','captureStatus','evidence'].includes(key)) || !Array.isArray(finalization.payloadFiles))) throw new Error('Finalization must contain only typed acquired facts');
  if((capture?.payloadFiles?.length ?? 0)+(finalization?.payloadFiles.length ?? 0)>4096) throw new Error('Driver payload capacity exceeded');
  const supplied=[...(capture?.payloadFiles ?? []),...(finalization?.payloadFiles ?? [])];
  if(new Set(supplied.map(f=>f.path)).size!==supplied.length) throw new Error('Duplicate driver payload file');
  for(const file of supplied) {if(reservedPath(file.path)) throw new Error('Driver payload replaces root-owned artifact'); rawPath(file.path,id);}
  let status=finalization ? comparisonCaptureStatusSchema.parse(finalization.captureStatus) : unavailableStatus(id,'Driver supplied no acquired finalization metadata');
  if(!finalization && capture?.evidence) status={...status,evidenceMetadata:{status:'available'},finalPageInstrumentation:{status:'available',value:structuredClone(capture.evidence.instrumentation)}};
  assertIdentity(status,id);
  if(status.payloads.some(file=>reservedPath(file.path))) throw new Error('Driver status cannot override root-owned baseline artifacts');
  const before=await writer.reconcilePayloadCandidates();
  const candidates=new Set([...before.present,...before.absent].map(f=>f.path));
  for(const file of [...supplied,...status.payloads,...status.unavailablePaths]) if(!candidates.has(file.path)) throw new Error('Driver path is not a registered artifact candidate');
  const overrides=new Map<string,ComparisonPayloadFile>([...status.payloads,...supplied].map(f=>[f.path,{path:f.path,status:f.status,...(f.reason!==undefined?{reason:f.reason}:{})}]));
  const payloads=before.present.map(file=>{
    if(file.status==='partial') return file;
    const override=overrides.get(file.path); if(override) return override;
    return !capture && ['page.jsonl','producer.jsonl','trace.json'].includes(file.path) ? {path:file.path,status:'partial' as const,reason:'Capture did not complete; initialized bytes are not successful empty collection'} : file;
  });
  const reason=validation.reasons.join('; ').slice(0,4096) || 'Required capture metadata unavailable';
  if(validation.status==='failed' || payloads.some(f=>f.status==='partial') || before.absent.length) status={...status,status:'partial',reasons:[...new Set([...status.reasons,reason])].slice(0,32)};
  status=comparisonCaptureStatusSchema.parse({...status,payloads,unavailablePaths:before.absent});
  await writer.json('capture-status.json',status);
  const after=await writer.reconcilePayloadCandidates();
  const files=await writer.inventory(after.present.map(f=>f.path==='capture-status.json' ? f : payloads.find(p=>p.path===f.path) ?? f));
  const metadata=finalization?.evidence ?? capture?.evidence;
  if(finalization && status.evidenceMetadata.status==='available' && !metadata) throw new Error('Finalization claims unavailable evidence metadata as acquired');
  if(metadata) {
    assertIdentity(metadata,id);
    if(finalization && status.evidenceMetadata.status!=='available') throw new Error('Finalization evidence contradicts acquired metadata availability');
    const parsed=comparisonEvidenceSchema.parse({...metadata,...(validation.status==='failed' || files.some(f=>f.status==='partial') || after.absent.length ? {status:'partial',reason} : {}),files,unavailableFiles:after.absent});
    await writer.json('evidence.json',parsed); return 'evidence.json';
  }
  await writer.json('raw-inventory.json',comparisonRawInventorySchema.parse({...id,status:'partial',reason,files})); return 'raw-inventory.json';
}

/** Injected orchestration only: this does not instantiate a browser, manufacture evidence, or score results. */
export async function runLongThreadInvocation<State>(config: LongThreadConfiguration, driver: ComparisonSlotDriver<State>, options: {clock?: ComparisonOwnershipClock; fileOperations?: ComparisonFileOperations} = {}): Promise<ComparisonInvocationExecution> {
  config = validateLongThreadConfiguration(config);
  if (!driver || typeof driver.setup !== 'function' || typeof driver.replay !== 'function') throw new Error('An actual comparison slot driver is required');
  const invocation = createLongThreadLedger(config), root = await ComparisonArtifactWriter.create(config.out, options.fileOperations, {candidateLimit:16});
  const invocationClaim={...versions, kind: 'invocation-ownership-claim', invocationId: randomUUID(), createdAt: invocation.createdAt, purpose: invocation.purpose, configuration: invocation.configuration};
  await root.claimEmptyRoot('invocation-claim.json',invocationClaim);
  const writers: ComparisonArtifactWriter[] = [], owners: ComparisonOwnership[] = [], pendingFinalizers: (() => Promise<void>)[] = [];
  const slotFinalized:boolean[]=[];
  let finalized = false; let finalizationFailure: Error | null = null;
  const recordFinalizationFailure = (error: Error) => {
    if (!finalizationFailure) {finalizationFailure = error; return;}
    const previous: Error[] = finalizationFailure instanceof AggregateError ? finalizationFailure.errors : [finalizationFailure];
    const errors = [...previous, ...(error instanceof AggregateError ? error.errors : [error])];
    finalizationFailure = new AggregateError(errors, errors.map(failure => failure.message).join('; '));
  };
  const persistLedger = () => root.json('invocation.json', comparisonCaptureInvocationSchema.parse(invocation));
  await persistLedger();
  // The complete durable plan precedes every resource factory, including the first.
  for (const slot of invocation.runs) {
    const writer = await root.createSlotWriter(slot.artifactDirectory); writers.push(writer);
    await writer.json('descriptor.json', comparisonScheduledRunSchema.parse({...identity(slot), seed: config.configuration.seed, mode: config.configuration.mode, artifactDirectory: slot.artifactDirectory}));
    await writer.json('validation.json', failed(identity(slot), ['capture-not-started']));
    await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...identity(slot), exceptions: []}));
  }
  let halted: string | null = null;
  for (let index = 0; index < invocation.runs.length; index++) {
    const slot = invocation.runs[index]!, id = identity(slot), writer = writers[index]!;
    if (halted) {
      slot.status = 'failed'; slot.reasons = [`failed-not-started: ${halted}`];
      try {const validation=failed(id,slot.reasons); await writer.json('validation.json', validation); await persistSlotInventory(writer,id,validation,null,undefined); await writer.seal(); slotFinalized[index]=true;}
      catch (error) {
        const reason = `Unable to finalize not-started slot ${slot.artifactDirectory}: ${describeError(error)}`;
        slot.reasons.push(reason); const retentionErrors:unknown[]=[];
        let manifest:'evidence.json'|'raw-inventory.json'|null=null;
        try {const actual=await writer.reconcilePayloadCandidates(); manifest=writtenManifest(actual.present);}
        catch(retention) {retentionErrors.push(retention);}
        const failedAtHostMs=options.clock?.now() ?? performance.now();
        try {await writer.json('exceptions.json',comparisonExceptionsSchema.parse({...id,exceptions:[{source:'runner',stage:'validation',clockDomain:'host-monotonic-ms',timestampMs:failedAtHostMs,message:reason,stack:error instanceof Error?error.stack??null:null,severity:'error'}]}));} catch(retention) {retentionErrors.push(retention);}
        try {await writer.json('validation.json',failed(id,slot.reasons));} catch(retention) {retentionErrors.push(retention);}
        try {await writer.json('finalization-status.json',comparisonFinalizationStatusSchema.parse({...id,status:'failed',reason:reason.slice(0,4096),manifest:{path:manifest,state:manifest?'unusable':'not-written'},failedAtHostMs,datasetSealEligible:false}));} catch(retention) {retentionErrors.push(retention);}
        recordFinalizationFailure(retentionErrors.length ? new AggregateError([new Error(reason,{cause:error}),...retentionErrors],reason+'; '+retentionErrors.map(describeError).join('; ')) : new Error(reason,{cause:error}));
      }
      // A broken future slot cannot suppress durable status for the other initialized descriptors.
      await persistLedger(); continue;
    }
    const owner = new ComparisonOwnership(options.clock); owners.push(owner);
    let capture: ComparisonSlotCapture | null = null, primaryReason: string | null = null;
    let runnerFailure: {stage: 'setup' | 'validation'; timestampMs: number; message: string; stack: string | null} | null = null;
    let exceptionStage: 'setup' | 'validation' = 'setup';
    slot.status = 'running'; await persistLedger();
    try {
      const fixture = fixtureFor(slot, config.configuration.seed);
      await writer.text('fixture.json', canonicalSerialize(fixture));
      await writer.text('producer.jsonl', ''); await writer.text('page.jsonl', ''); await writer.text('trace.json', '');
      const descriptor = comparisonScheduledRunSchema.parse({...id, seed: config.configuration.seed, mode: config.configuration.mode, artifactDirectory: slot.artifactDirectory});
      const context = (ownership: ComparisonOwnershipContext): ComparisonSlotContext => {
        const scoped = driverWriter(writer,id,() => ownership.assertActive());
        return {identity: id, descriptor, fixture, ownership, writer: {...scoped, stream: async path => {
          const stream = await scoped.stream(path);
          await ownership.adopt({name: `artifact-stream:${path}`, close: () => stream.complete()}); return stream;
        }}};
      };
      const setup = await owner.run('setup', async ownership => {
        await ownership.adopt({name: 'artifact-writer-drain', close: () => writer.drain()});
        return driver.setup(context(ownership));
      });
      if (setup.status !== 'complete') primaryReason = setup.deadline.reason ?? 'Setup failed';
      else {
        const replay = await owner.run('replay', ownership => driver.replay(context(ownership), setup.value));
        if (replay.status !== 'complete') primaryReason = replay.deadline.reason ?? 'Replay failed';
        else {
          exceptionStage = 'validation'; capture = structuredClone(replay.value); comparisonValidationSchema.parse(capture.validation);
          for (const key of ['repetition', 'scenarioId', 'round', 'caseIndex', 'adapterProfile'] as const) if (capture.validation[key] !== id[key]) throw new Error('Driver validation identity differs from scheduled slot');
        }
      }
    } catch (error) {primaryReason = describeError(error); runnerFailure = {stage: exceptionStage, timestampMs: owner.now(), message: primaryReason, stack: error instanceof Error ? error.stack ?? null : null};}
    const disposal = await owner.dispose();
    if (disposal.status !== 'complete') primaryReason = [primaryReason, disposal.deadline.reason].filter(Boolean).join('; ');
    let provisionalManifest:'evidence.json'|'raw-inventory.json'|null=null;
    const finalizeSlot = async () => {
      await owner.ownershipSettled;
      const failures = [...owner.failures, ...(runnerFailure ? [{...runnerFailure, resource: null}] : [])];
      await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...id, exceptions: failures.map(f => ({source: 'runner', stage: f.stage, clockDomain: 'host-monotonic-ms', timestampMs: f.timestampMs, message: f.resource ? `${f.resource}: ${f.message}` : f.message, stack: f.stack, severity: 'error'}))}));
      const reasons = [...new Set([...(primaryReason ? [primaryReason] : []), ...failures.map(f => f.message)])];
      if (!capture && reasons.length === 0) reasons.push('Capture produced no validation');
      const validation = reasons.length ? failed(id, reasons) : comparisonValidationSchema.parse(capture!.validation);
      await writer.json('validation.json', validation);
      const deadlines = Object.freeze(owner.deadlines.map(deadline => Object.freeze({...deadline})));
      // Driver receives a detached snapshot; its filesystem finalizer cannot mutate the acquired capture.
      const finalization=await driver.finalize?.({identity: {...id}, writer:driverWriter(writer,id,()=>{}), deadlines},capture ? structuredClone(capture) : null);
      provisionalManifest=await persistSlotInventory(writer,id,validation,capture,finalization);
      await writer.seal(); slotFinalized[index]=true; slot.status = validation.status; slot.reasons = validation.reasons;
    };
    const retainFinalizationFailure = async (error: unknown) => {
      const primary = error instanceof Error ? error : new Error(describeError(error));
      slot.status = 'failed'; slot.reasons = [describeError(error)]; halted = 'Finalization failed; dataset remains unsealed';
      const retentionErrors: unknown[] = [];
      // A failed manifest write can have renamed genuine bytes before rejecting durability.
      if(!provisionalManifest) {
        try {const actual=await writer.reconcilePayloadCandidates(); provisionalManifest=writtenManifest(actual.present);}
        catch(retention) {retentionErrors.push(retention);}
      }
      try {
        await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...id, exceptions: [...owner.failures.map(f => ({source: 'runner', stage: f.stage, clockDomain: 'host-monotonic-ms', timestampMs: f.timestampMs, message: f.resource ? `${f.resource}: ${f.message}` : f.message, stack: f.stack, severity: 'error'})), ...(runnerFailure ? [{source: 'runner', ...runnerFailure, clockDomain: 'host-monotonic-ms', severity: 'error'}] : []), {source: 'runner', stage: 'validation', clockDomain: 'host-monotonic-ms', timestampMs: owner.now(), message: describeError(error), stack: error instanceof Error ? error.stack ?? null : null, severity: 'error'}]}));
      } catch (retention) {retentionErrors.push(retention); slot.reasons.push(`Unable to retain exceptions.json: ${describeError(retention)}`);}
      try {await writer.json('validation.json', failed(id, slot.reasons));}
      catch (retention) {retentionErrors.push(retention); slot.reasons.push(`Unable to retain validation.json: ${describeError(retention)}`);}
      try {await writer.json('finalization-status.json',comparisonFinalizationStatusSchema.parse({...id,status:'failed',reason:describeError(error).slice(0,4096),manifest:{path:provisionalManifest,state:provisionalManifest?'unusable':'not-written'},failedAtHostMs:owner.now(),datasetSealEligible:false}));}
      catch(retention) {retentionErrors.push(retention); slot.reasons.push(`Unable to retain finalization-status.json: ${describeError(retention)}`);}
      recordFinalizationFailure(retentionErrors.length ? new AggregateError([primary, ...retentionErrors], slot.reasons.join('; ')) : primary);
    };
    if (owner.unsafeOutstanding) {
      primaryReason ??= 'Unsafe outstanding ownership after disposal'; slot.status = 'failed'; slot.reasons = [primaryReason];
      // Affected files remain mutable only for settlement finalization, never apparently published/sealed.
      // Its own queue may still be blocked. The separate invocation writer records the failure now;
      // per-run exception/verdict rewrites wait for real settlement instead of extending nominal disposal.
      pendingFinalizers.push(async () => {try {await finalizeSlot();} catch (error) {await retainFinalizationFailure(error); await persistLedger(); throw finalizationFailure;}}); halted = 'unsafe outstanding ownership after absolute disposal deadline';
    } else {
      try {await finalizeSlot();} catch (error) {await retainFinalizationFailure(error);}
      if (!owner.canContinue) halted = 'Owned resource containment was not established after cleanup';
    }
    await persistLedger();
  }
  invocation.status = invocation.runs.some(slot => slot.status === 'failed') ? 'failed' : 'complete'; await persistLedger();
  let finalization: Promise<void> | null = null;
  const finalize = (): Promise<void> => {
    finalization ??= (async () => {
      for (const finish of pendingFinalizers) {try {await finish();} catch(error) {if(!finalizationFailure) recordFinalizationFailure(error instanceof Error?error:new Error(describeError(error)));}}
      await Promise.all(owners.map(owner=>owner.ownershipSettled));
      invocation.status = invocation.runs.some(slot => slot.status === 'failed') ? 'failed' : 'complete'; await persistLedger();
      if (finalizationFailure) throw finalizationFailure;
      try {
        await root.publishDatasetSeal(invocation.runs.map((slot,index)=>({writer:writers[index]!,artifactDirectory:slot.artifactDirectory,identity:identity(slot),status:terminalStatus(slot),ownershipSettled:!owners.some(owner=>owner.unsafeOutstanding),finalizationSucceeded:slotFinalized[index]===true})),checked=>{
          if(canonicalSerialize(checked.invocationClaim)!==canonicalSerialize(invocationClaim) || canonicalSerialize(checked.invocationLedger)!==canonicalSerialize(invocation)) throw new Error('Checked invocation differs from settled runner facts');
          return structuredClone(checked);
        });
        finalized=true;
      } catch(error) {
        invocation.status='failed'; const first=invocation.runs[0]; if(first) {first.status='failed'; first.reasons=[...first.reasons,'Dataset finalization failed: '+describeError(error)];}
        recordFinalizationFailure(error instanceof Error?error:new Error(describeError(error))); throw finalizationFailure;
      }
    })();
    return finalization;
  };
  if (pendingFinalizers.length === 0 && !finalizationFailure) {try {await finalize();} catch { /* Failed execution exposes the original frozen rejection through finalize(). */ }}
  return {invocation, get finalized() {return finalized;}, get unsafeOutstanding() {return owners.some(owner => owner.unsafeOutstanding);}, get ownershipSettled() {return Promise.all(owners.map(owner => owner.ownershipSettled)).then(() => {});}, finalize};
}
