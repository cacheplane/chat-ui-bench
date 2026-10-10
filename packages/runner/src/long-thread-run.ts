import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {comparisonCaptureInvocationSchema, comparisonScheduledRunSchema, comparisonValidationSchema, comparisonExceptionsSchema, comparisonEvidenceSchema, canonicalSerialize, createLongThreadFixture, type ComparisonCaptureInvocation, type ComparisonIdentity, type ComparisonValidation, type ComparisonEvidence, type ComparisonDeadline, type LongThreadFixture} from '@chat-ui-bench/contract';
import {ComparisonArtifactWriter, type ComparisonScopedWriter, type ComparisonPayloadFile, type ComparisonFileOperations} from './comparison-artifacts.js';
import {ComparisonOwnership, type ComparisonOwnershipClock, type ComparisonOwnershipContext} from './comparison-ownership.js';
import type {LongThreadConfiguration} from './long-thread-cli.js';
const versions = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0'} as const;
type Slot = ComparisonCaptureInvocation['runs'][number];
export interface ComparisonSlotContext {identity: ComparisonIdentity; descriptor: ReturnType<typeof comparisonScheduledRunSchema.parse>; fixture: LongThreadFixture; writer: ComparisonScopedWriter; ownership: ComparisonOwnershipContext}
export interface ComparisonSlotCapture {
  validation: ComparisonValidation;
  /** Actual instrumentation metadata only. Absent before acquisition/instrumentation exists. */
  evidence?: Omit<ComparisonEvidence, 'files'>;
  payloadFiles?: readonly ComparisonPayloadFile[];
}
export interface ComparisonSlotDriver<State> {
  setup(context: ComparisonSlotContext): Promise<State>;
  /** Scored phases close before full validation reads; both remain inside the same 30s ownership stage. */
  replay(context: ComparisonSlotContext, state: State): Promise<ComparisonSlotCapture>;
  /** Filesystem-only final persistence after all owned asynchronous work settles. No browser calls here. */
  finalize?(context: {identity: ComparisonIdentity; writer: ComparisonScopedWriter; readonly deadlines: readonly Readonly<ComparisonDeadline>[]}, capture: ComparisonSlotCapture | null): Promise<void>;
}
export interface ComparisonInvocationExecution {
  invocation: ComparisonCaptureInvocation; readonly finalized: boolean; readonly unsafeOutstanding: boolean;
  readonly ownershipSettled: Promise<void>;
  finalize(): Promise<void>;
}
export function createLongThreadLedger(config: LongThreadConfiguration): ComparisonCaptureInvocation {
  const runs: Slot[] = [];
  for (let round = 1; round <= config.configuration.rounds; round++) config.configuration.caseOrder.forEach((scenarioId, caseIndex) => config.configuration.adapterProfiles.forEach((adapterProfile, profileIndex) => {
    runs.push({round, caseIndex, scenarioId, adapterProfile, repetition: `${round}-${caseIndex}-${profileIndex}`, artifactDirectory: `runs/round-${round}/case-${caseIndex}/profile-${profileIndex}`, status: 'scheduled', reasons: []});
  }));
  return comparisonCaptureInvocationSchema.parse({...versions, createdAt: new Date().toISOString(), purpose: config.purpose, status: 'pending', configuration: config.configuration, runs});
}
function identity(slot: Slot): ComparisonIdentity {return {...versions, repetition: slot.repetition, scenarioId: slot.scenarioId, round: slot.round, caseIndex: slot.caseIndex, adapterProfile: slot.adapterProfile};}
function failed(id: ComparisonIdentity, reasons: string[]): ComparisonValidation {return comparisonValidationSchema.parse({...id, status: 'failed', checks: [{name: 'capture-ownership', passed: false, reason: reasons.join('; '), evidencePaths: ['descriptor.json', 'exceptions.json']}], reasons});}
function fixtureFor(slot: Slot, seed: number) {return createLongThreadFixture({seed, historyCount: ([100, 1000, 10000] as const)[Math.floor(slot.caseIndex / 4)]!, responseBytes: slot.caseIndex % 4 < 2 ? 6400 : 262144, journey: slot.caseIndex % 2 === 0 ? 'follow' : 'history-reading'});}
function describeError(error: unknown) {return error instanceof Error ? error.message || error.name : String(error);}

/** Injected orchestration only: this does not instantiate a browser, manufacture evidence, or score results. */
export async function runLongThreadInvocation<State>(config: LongThreadConfiguration, driver: ComparisonSlotDriver<State>, options: {clock?: ComparisonOwnershipClock; fileOperations?: ComparisonFileOperations} = {}): Promise<ComparisonInvocationExecution> {
  if (!driver || typeof driver.setup !== 'function' || typeof driver.replay !== 'function') throw new Error('An actual comparison slot driver is required');
  const invocation = createLongThreadLedger(config), root = await ComparisonArtifactWriter.create(config.out, options.fileOperations);
  await root.claimEmptyRoot('invocation-claim.json', {...versions, kind: 'invocation-ownership-claim', invocationId: randomUUID(), createdAt: invocation.createdAt, purpose: invocation.purpose, configuration: invocation.configuration});
  const writers: ComparisonArtifactWriter[] = [], owners: ComparisonOwnership[] = [], pendingFinalizers: (() => Promise<void>)[] = [];
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
    const writer = await ComparisonArtifactWriter.create(join(root.directory, slot.artifactDirectory), options.fileOperations); writers.push(writer);
    await writer.json('descriptor.json', comparisonScheduledRunSchema.parse({...identity(slot), seed: config.configuration.seed, mode: config.configuration.mode, artifactDirectory: slot.artifactDirectory}));
    await writer.json('validation.json', failed(identity(slot), ['capture-not-started']));
    await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...identity(slot), exceptions: []}));
  }
  let halted: string | null = null;
  for (let index = 0; index < invocation.runs.length; index++) {
    const slot = invocation.runs[index]!, id = identity(slot), writer = writers[index]!;
    if (halted) {
      slot.status = 'failed'; slot.reasons = [`failed-not-started: ${halted}`];
      try {await writer.json('validation.json', failed(id, slot.reasons)); await writer.seal();}
      catch (error) {
        const reason = `Unable to finalize not-started slot ${slot.artifactDirectory}: ${describeError(error)}`;
        slot.reasons.push(reason); recordFinalizationFailure(new Error(reason, {cause: error}));
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
        const scoped = writer.scoped(() => ownership.assertActive());
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
          exceptionStage = 'validation'; capture = replay.value; comparisonValidationSchema.parse(capture.validation);
          for (const key of ['repetition', 'scenarioId', 'round', 'caseIndex', 'adapterProfile'] as const) if (capture.validation[key] !== id[key]) throw new Error('Driver validation identity differs from scheduled slot');
        }
      }
    } catch (error) {primaryReason = describeError(error); runnerFailure = {stage: exceptionStage, timestampMs: owner.now(), message: primaryReason, stack: error instanceof Error ? error.stack ?? null : null};}
    const disposal = await owner.dispose();
    if (disposal.status !== 'complete') primaryReason = [primaryReason, disposal.deadline.reason].filter(Boolean).join('; ');
    const finalizeSlot = async () => {
      await owner.ownershipSettled;
      const failures = [...owner.failures, ...(runnerFailure ? [{...runnerFailure, resource: null}] : [])];
      await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...id, exceptions: failures.map(f => ({source: 'runner', stage: f.stage, clockDomain: 'host-monotonic-ms', timestampMs: f.timestampMs, message: f.resource ? `${f.resource}: ${f.message}` : f.message, stack: f.stack, severity: 'error'}))}));
      const reasons = [...new Set([...(primaryReason ? [primaryReason] : []), ...failures.map(f => f.message)])];
      if (!capture && reasons.length === 0) reasons.push('Capture produced no validation');
      const validation = reasons.length ? failed(id, reasons) : comparisonValidationSchema.parse(capture!.validation);
      await writer.json('validation.json', validation);
      const deadlines = Object.freeze(owner.deadlines.map(deadline => Object.freeze({...deadline})));
      await driver.finalize?.({identity: id, writer, deadlines}, capture);
      if (capture?.evidence) {
        const supplied = capture.payloadFiles ?? [];
        if (new Set(supplied.map(file => file.path)).size !== supplied.length) throw new Error('Duplicate capture payload file');
        const retained = new Map<string, ComparisonPayloadFile>(['descriptor.json', 'fixture.json', 'producer.jsonl', 'page.jsonl', 'trace.json', 'validation.json', 'exceptions.json'].map(path => [path, {path, status: 'complete'}]));
        for (const file of supplied) retained.set(file.path, file);
        const files = await writer.inventory([...retained.values()]);
        const metadata = capture.evidence;
        for (const key of ['repetition', 'scenarioId', 'round', 'caseIndex', 'adapterProfile'] as const) if (metadata[key] !== id[key]) throw new Error('Driver evidence identity differs from scheduled slot');
        await writer.json('evidence.json', comparisonEvidenceSchema.parse({...metadata, ...(validation.status === 'failed' ? {status: 'partial', reason: validation.reasons.join('; ')} : {}), files}));
      }
      await writer.seal(); slot.status = validation.status; slot.reasons = validation.reasons;
    };
    const retainFinalizationFailure = async (error: unknown) => {
      const primary = error instanceof Error ? error : new Error(describeError(error));
      slot.status = 'failed'; slot.reasons = [describeError(error)]; halted = 'Finalization failed; dataset remains unsealed';
      const retentionErrors: unknown[] = [];
      try {
        await writer.json('exceptions.json', comparisonExceptionsSchema.parse({...id, exceptions: [...owner.failures.map(f => ({source: 'runner', stage: f.stage, clockDomain: 'host-monotonic-ms', timestampMs: f.timestampMs, message: f.resource ? `${f.resource}: ${f.message}` : f.message, stack: f.stack, severity: 'error'})), ...(runnerFailure ? [{source: 'runner', ...runnerFailure, clockDomain: 'host-monotonic-ms', severity: 'error'}] : []), {source: 'runner', stage: 'validation', clockDomain: 'host-monotonic-ms', timestampMs: owner.now(), message: describeError(error), stack: error instanceof Error ? error.stack ?? null : null, severity: 'error'}]}));
      } catch (retention) {retentionErrors.push(retention); slot.reasons.push(`Unable to retain exceptions.json: ${describeError(retention)}`);}
      try {await writer.json('validation.json', failed(id, slot.reasons));}
      catch (retention) {retentionErrors.push(retention); slot.reasons.push(`Unable to retain validation.json: ${describeError(retention)}`);}
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
    finalization ??= (async () => {for (const finish of pendingFinalizers) await finish(); invocation.status = invocation.runs.some(slot => slot.status === 'failed') ? 'failed' : 'complete'; await persistLedger(); if (finalizationFailure) throw finalizationFailure; await root.seal(); finalized = true;})();
    return finalization;
  };
  if (pendingFinalizers.length === 0 && !finalizationFailure) await finalize();
  return {invocation, get finalized() {return finalized;}, get unsafeOutstanding() {return owners.some(owner => owner.unsafeOutstanding);}, get ownershipSettled() {return Promise.all(owners.map(owner => owner.ownershipSettled)).then(() => {});}, finalize};
}
