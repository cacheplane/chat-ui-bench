import { z } from 'zod';
import { manifestSchema } from './artifact.js';
import { replayEventSchema, payloadBytes, type Message, type ReplayEvent } from './fixture.js';
import type { TranscriptMessage } from './adapter.js';
import { LONG_THREAD_SUITE, longThreadWorkloadSchema, longThreadCaseOrder, longThreadScenarioId } from './long-thread.js';
import { phaseInstanceIdSchema } from './presentation.js';

const text = z.string().min(1);
const timestamp = z.number().finite().nonnegative();
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const hashes = z.record(text, hash);
const nonemptyHashes = hashes.refine(value => Object.keys(value).length > 0, 'Hash inventory must not be empty');
export const COMPARISON_SUITE_VERSION = '1.0.0' as const;
export const COMPARISON_COLLECTOR_VERSION = '2.0.0' as const;
export const COMPARISON_ANALYZER_VERSION = '2.0.0' as const;
export const ACCEPTED_COMPARISON_VERSION_PAIRS = [{collectorVersion: COMPARISON_COLLECTOR_VERSION, analyzerVersion: COMPARISON_ANALYZER_VERSION}] as const;
/** Syntax only; realpath/symlink containment is a separate filesystem gate. */
export const comparisonArtifactPathSchema = z.string().regex(/^[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/).refine(path => !path.split('/').some(segment => segment === '.' || segment === '..'), 'Artifact path must be normalized relative POSIX');
export type ComparisonIdentity = z.infer<typeof comparisonIdentitySchema>;
export const comparisonPhaseSchema = z.enum([
  'setup', 'history-ready', 'streaming-follow', 'composer-input', 'history-reading', 'return-to-response',
  'replay-end', 'validation', 'disposal',
]);
export type ComparisonPhase = z.infer<typeof comparisonPhaseSchema>;
export const adapterCapabilitiesSchema = z.strictObject({
  rendering: z.enum(['all-mounted', 'virtualized']),
  scrollPolicy: z.enum(['bottom-follow', 'turn-anchoring', 'manual']),
  returnToResponse: z.enum(['native-control', 'unsupported']),
});
export type AdapterCapabilities = z.infer<typeof adapterCapabilitiesSchema>;
export const adapterBuildSchema = z.strictObject({
  packages: z.array(z.strictObject({name: text, version: exactVersion, integrity: z.string().regex(/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/), resolutionPath: z.string().regex(/^(?:[A-Za-z0-9._@-]+\/)*node_modules\/(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/).refine(path=>!path.split('/').some(segment=>segment==='.'||segment==='..'),'Package path must be normalized').optional()})).min(1),
  framework: z.strictObject({name: text, version: exactVersion}), production: z.literal(true),
  sourceHashes: nonemptyHashes, copiedSourceHashes: hashes, assetHashes: nonemptyHashes,
  settings: z.strictObject({optimization: z.boolean(), sourceMaps: z.boolean()}),
}).superRefine((build, ctx) => {
  const identities=build.packages.map(p=>p.resolutionPath===undefined?`name:${p.name}`:`path:${p.resolutionPath}`);
  if (new Set(identities).size !== identities.length) ctx.addIssue({code: 'custom', message: 'Duplicate package provenance'});
  for(const p of build.packages)if(p.resolutionPath!==undefined&&!p.resolutionPath.endsWith(`node_modules/${p.name}`))ctx.addIssue({code:'custom',message:'Package name and physical resolution path differ'});
});
export type AdapterBuild = z.infer<typeof adapterBuildSchema>;
export const comparisonAdapterSchema = z.strictObject({
  id: text, profile: text, capabilities: adapterCapabilitiesSchema, build: adapterBuildSchema,
  configuration: z.strictObject({markdown: z.literal('default'), pinThresholdCssPx: z.number().finite().nonnegative().nullable(), telemetry: z.enum(['disabled', 'not-applicable'])}),
});
export type ComparisonAdapter = z.infer<typeof comparisonAdapterSchema>;
const commonEnvironment = manifestSchema.pick({git: true, fixture: true, browser: true, environment: true, mode: true, viewport: true, cachePolicy: true});
export type ComparisonManifest = z.infer<typeof comparisonManifestSchema>;
export const comparisonInvocationSchema = z.strictObject({
  schemaVersion: z.literal(2), suite: z.literal(LONG_THREAD_SUITE), seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  rounds: z.number().int().positive(), adapterProfiles: z.array(text).min(1), caseOrder: z.array(text).min(1), mode: z.enum(['headed', 'headless']),
  deadlinesMs: z.strictObject({historySetup: z.literal(60000), replay: z.literal(30000), disposal: z.literal(10000)}),
}).superRefine((v, ctx) => {
  if (new Set(v.caseOrder).size !== v.caseOrder.length || new Set(v.adapterProfiles).size !== v.adapterProfiles.length) ctx.addIssue({code: 'custom', message: 'Invocation identities must be unique'});
  if (!Number.isSafeInteger(v.seed) || v.seed < 0) return;
  const expectedOrder = longThreadCaseOrder(v.seed);
  if (v.caseOrder.length !== expectedOrder.length || v.caseOrder.some((id, i) => id !== expectedOrder[i])) ctx.addIssue({code: 'custom', message: 'Noncanonical long thread case order'});
});
export type ComparisonInvocation = z.infer<typeof comparisonInvocationSchema>;

export const runtimeMessageSchema = z.strictObject({id: text, role: z.enum(['user', 'assistant']), text: z.string(), status: z.enum(['streaming', 'complete'])});
export const runtimeProgressSchema = z.strictObject({
  activeMessage: runtimeMessageSchema.nullable(), delivery: z.enum(['idle', 'streaming', 'complete', 'aborted', 'error']),
  outcome: z.enum(['success', 'error', 'aborted']).nullable(), loading: z.boolean(), error: z.string().nullable(),
});
export type RuntimeProgress = z.infer<typeof runtimeProgressSchema>;
export const visibleMessageSchema = z.strictObject({id: text, text: z.string(), topCssPx: z.number().finite(), bottomCssPx: z.number().finite()});
export type VisibleMessage = z.infer<typeof visibleMessageSchema>;
// Initial v2 collector never asserts matches; offline analysis reconstructs them.
const prefixes = z.tuple([]);
const baseObservation = {schemaVersion: z.literal(2), repetition: text, phase: comparisonPhaseSchema, sequence: sequence.nullable(), timestampMs: timestamp};
const pageObservation = {...baseObservation, phase: comparisonPhaseSchema.nullable(), phaseInstanceId: phaseInstanceIdSchema.nullable(), attributionReason: text.nullable(), clockDomain: z.literal('page-performance-ms')};
/** One nanosecond in millisecond units, plus eight floating-point epsilon steps at the compared magnitude. */
function sameTimingMs(actual: number, expected: number): boolean {
  const toleranceMs = 1e-6 + 8 * Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected));
  return Math.abs(actual - expected) <= toleranceMs;
}
const unavailableCounterSchema = z.strictObject({status: z.literal('unavailable'), reason: text});
export const comparisonUnavailableSchema = unavailableCounterSchema;
export function comparisonAvailabilitySchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('status', [unavailableCounterSchema, z.strictObject({status: z.literal('available'), value})]);
}
export const comparisonBoundedBufferSchema = z.strictObject({
  name: z.enum(['transport', 'page-observations', 'pre-navigation-errors']), maxEntries: z.literal(4096), maxSerializedBytes: z.literal(16777216),
  highWaterEntries: sequence.max(4096), highWaterSerializedBytes: sequence.max(16777216), overflowCount: sequence, rejectedRecordCount: sequence,
  status: z.enum(['complete', 'partial']), reason: text.optional(),
}).superRefine((v, ctx) => {
  if (v.status === 'complete' && (v.reason !== undefined || v.overflowCount > 0 || v.rejectedRecordCount > 0)) ctx.addIssue({code: 'custom', message: 'Complete buffer cannot claim lost records'});
  if (v.status === 'partial' && v.reason === undefined) ctx.addIssue({code: 'custom', message: 'Partial buffer needs a reason'});
});
export type ComparisonBoundedBuffer = z.infer<typeof comparisonBoundedBufferSchema>;
export const comparisonObserverSchema = z.discriminatedUnion('status', [unavailableCounterSchema, z.strictObject({
  status: z.literal('available'), value: z.strictObject({entryType: z.enum(['event', 'long-animation-frame']), buffered: z.boolean(), requestedDurationThresholdMs: timestamp.nullable(), registrationTimestampMs: timestamp, observedEntries: sequence, callbackCount: sequence, droppedEntriesCount: comparisonAvailabilitySchema(sequence), finalTakeRecords: z.boolean()}),
})]);
const targetRole = z.enum(['composer', 'return-control', 'scroller', 'other', 'unknown']);
const nativeInput = z.strictObject({
  recipeId: text, type: z.enum(['wheel', 'keydown', 'keyup', 'beforeinput', 'input', 'click']), eventTimestampMs: timestamp, observedAtMs: timestamp, isTrusted: z.boolean(), targetRole,
  deltaX: z.number().finite().nullable(), deltaY: z.number().finite().nullable(), deltaMode: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(), key: z.string().nullable(), code: z.string().nullable(), inputType: z.string().nullable(), value: z.string().nullable(),
}).superRefine((v, ctx) => {
  if (v.observedAtMs < v.eventTimestampMs) ctx.addIssue({code: 'custom', message: 'Input observation precedes event'});
  const deltas = [v.deltaX, v.deltaY, v.deltaMode];
  if (v.type === 'wheel' ? deltas.some(n => n === null) : deltas.some(n => n !== null)) ctx.addIssue({code: 'custom', message: 'Wheel alone requires delta fields'});
});
const eventTiming = z.strictObject({
  entryType: z.literal('event'), name: text.refine(name => name !== 'wheel', 'Wheel uses separate native event evidence'),
  startTime: timestamp, duration: timestamp, processingStart: timestamp, processingEnd: timestamp, cancelable: z.boolean(), interactionId: sequence, observedAtMs: timestamp, targetRole: z.enum(['composer', 'return-control', 'other', 'unknown']),
}).superRefine((v, ctx) => {
  if (v.processingStart < v.startTime || v.processingEnd < v.processingStart || v.observedAtMs < v.startTime) ctx.addIssue({code: 'custom', message: 'Event Timing times are not chronological'});
});
const loaf = z.strictObject({entryType: z.literal('long-animation-frame'), name: z.literal('long-animation-frame'), startTime: timestamp, duration: timestamp, renderStart: timestamp, styleAndLayoutStart: timestamp, blockingDuration: timestamp, firstUIEventTimestamp: timestamp, observedAtMs: timestamp}).refine(v => v.observedAtMs >= v.startTime, 'LoAF observation precedes entry');
export const rendererCountersSchema = z.strictObject({
  heap: z.discriminatedUnion('status', [z.strictObject({status: z.literal('available'), value: z.strictObject({jsHeapUsedBytes: sequence})}), unavailableCounterSchema]),
  dom: z.discriminatedUnion('status', [z.strictObject({status: z.literal('available'), value: z.strictObject({nodes: sequence, documents: sequence, eventListeners: sequence})}), unavailableCounterSchema]),
});
export type RendererCounters = z.infer<typeof rendererCountersSchema>;
export const comparisonObservationSchema = z.discriminatedUnion('kind', [
  z.strictObject({...baseObservation, sequence, kind: z.literal('producer-emission'), clockDomain: z.literal('producer-monotonic-ms'), data: z.strictObject({scheduledMs: timestamp, emittedMs: timestamp, latenessMs: z.number().finite(), event: replayEventSchema, payloadBytes: sequence, eventBytes: sequence, backpressure: z.boolean()})}),
  z.strictObject({...baseObservation, kind: z.literal('producer-failure'), clockDomain: z.literal('producer-monotonic-ms'), data: z.strictObject({stage: z.enum(['replay', 'disposal']), reason: text})}),
  z.strictObject({...pageObservation, sequence, kind: z.literal('receipt'), data: z.strictObject({event: replayEventSchema})}),
  // Yielding a supported transport event establishes translation only, never applied state.
  z.strictObject({...pageObservation, kind: z.literal('translation'), data: z.strictObject({protocolEvent: text, messageId: text, text: z.string()})}),
  z.strictObject({...pageObservation, kind: z.literal('runtime-checkpoint'), data: runtimeProgressSchema.extend({matchedSequences: prefixes})}),
  z.strictObject({...pageObservation, kind: z.literal('dom-checkpoint'), data: z.strictObject({matchedSequences: prefixes, activeMessageId: text.nullable(), mounted: z.boolean(), text: z.string().nullable(), visibleMessages: z.array(visibleMessageSchema), mountedMessageCount: sequence}).superRefine((d, ctx) => {
    if (!d.mounted && d.text !== null) ctx.addIssue({code: 'custom', message: 'Unmounted content cannot carry DOM text'});
    if (!d.mounted && d.matchedSequences.length !== 0) ctx.addIssue({code: 'custom', message: 'Unmounted content cannot satisfy DOM prefixes'});
  })}),
  z.strictObject({...baseObservation, clockDomain: z.literal('page-performance-ms'), phaseInstanceId: phaseInstanceIdSchema, kind: z.literal('phase'), data: z.strictObject({boundary: z.enum(['start', 'end']), markName: text})}),
  z.strictObject({...pageObservation, kind: z.literal('renderer-counters'), data: rendererCountersSchema}),
  z.strictObject({...pageObservation, kind: z.literal('scroll-checkpoint'), data: z.strictObject({scrollTop: z.number().finite(), scrollHeight: timestamp, clientHeight: timestamp, anchorId: text.nullable(), anchorTopCssPx: z.number().finite().nullable(), activeVisible: z.boolean(), followArmed: z.boolean().nullable()})}),
  z.strictObject({...pageObservation, kind: z.literal('composer-input'), data: z.strictObject({value: z.string()})}),
  z.strictObject({...pageObservation, kind: z.literal('failure'), data: z.strictObject({stage: z.enum(['setup', 'replay', 'validation', 'disposal']), reason: text})}),
  z.strictObject({...pageObservation, kind: z.literal('probe-unavailable'), data: z.strictObject({probe: z.enum(['runtime', 'dom', 'candidates', 'geometry', 'native-input']), reason: text})}),
  z.strictObject({...pageObservation, kind: z.literal('event-timing'), data: eventTiming}),
  z.strictObject({...pageObservation, kind: z.literal('long-animation-frame'), data: loaf}),
  z.strictObject({...pageObservation, kind: z.literal('observer-state'), data: z.strictObject({entryType: z.enum(['event', 'long-animation-frame']), supported: z.boolean(), registration: z.enum(['registered', 'failed', 'unsupported']), reason: text.nullable(), buffered: z.boolean(), requestedDurationThresholdMs: timestamp.nullable(), droppedEntriesCount: comparisonAvailabilitySchema(sequence), observedAtMs: timestamp}).superRefine((v, ctx) => {
    if (v.registration === 'registered' ? !v.supported || v.reason !== null : v.reason === null) ctx.addIssue({code: 'custom', message: 'Observer registration needs honest availability'});
    if (v.registration === 'unsupported' && v.supported) ctx.addIssue({code: 'custom', message: 'Unsupported observer cannot claim API support'});
  })}),
  z.strictObject({...pageObservation, kind: z.literal('buffer-state'), data: comparisonBoundedBufferSchema}),
  z.strictObject({...pageObservation, kind: z.literal('assistant-host'), data: z.strictObject({messageId: text.nullable(), hostMounted: z.boolean(), contentMounted: z.boolean()}).refine(v => v.messageId !== null || (!v.hostMounted && !v.contentMounted), 'Absent message cannot be mounted')}),
  z.strictObject({...pageObservation, kind: z.literal('animation-frame-checkpoint'), data: z.strictObject({messageId: text, ordinal: z.union([z.literal(1), z.literal(2)])})}),
  z.strictObject({...pageObservation, kind: z.literal('native-input'), data: nativeInput}),
]).superRefine((observation, ctx) => {
  if (observation.clockDomain === 'page-performance-ms') {
    if (observation.kind === 'phase') {
      if (observation.data.markName !== `bench:comparison:${observation.phase}:${observation.phaseInstanceId}:${observation.data.boundary}`) ctx.addIssue({code: 'custom', message: 'Boundary mark identity mismatch'});
    } else {
      if (observation.phase === null ? observation.phaseInstanceId !== null || observation.attributionReason === null : observation.phaseInstanceId === null || observation.attributionReason !== null) ctx.addIssue({code: 'custom', message: 'Page attribution requires a known pair or null pair with reason'});
      if ((observation.kind === 'event-timing' || observation.kind === 'long-animation-frame') && observation.timestampMs !== observation.data.startTime) ctx.addIssue({code: 'custom', message: 'Performance timestamp must retain actual entry startTime'});
      if (observation.kind === 'native-input' && observation.timestampMs !== observation.data.eventTimestampMs) ctx.addIssue({code: 'custom', message: 'Input timestamp must retain actual event time'});
    }
  }
  if (observation.kind === 'receipt' && observation.sequence !== observation.data.event.sequence) {
    ctx.addIssue({code: 'custom', message: 'Receipt sequence must match the received event'});
  }
  if (observation.kind === 'producer-emission') {
    const d = observation.data;
    if (observation.sequence !== d.event.sequence || d.scheduledMs !== d.event.scheduledMs) ctx.addIssue({code: 'custom', message: 'Producer event identity or schedule mismatch'});
    if (d.payloadBytes !== payloadBytes(d.event.text)) ctx.addIssue({code: 'custom', message: 'Producer payload byte count mismatch'});
    if (d.eventBytes !== payloadBytes(JSON.stringify(d.event))) ctx.addIssue({code: 'custom', message: 'Producer event byte count mismatch'});
    if (!sameTimingMs(observation.timestampMs, d.emittedMs)) ctx.addIssue({code: 'custom', message: 'Producer timestamp must represent emission time'});
    // Signed lateness preserves early emissions as evidence rather than silently clamping to zero.
    if (!sameTimingMs(d.latenessMs, d.emittedMs - d.scheduledMs)) ctx.addIssue({code: 'custom', message: 'Producer lateness must equal emission time minus scheduled time'});
  }
});
export type ComparisonObservation = z.infer<typeof comparisonObservationSchema>;

export interface RuntimeTranscriptSnapshot {
  readonly transcript: readonly TranscriptMessage[];
  readonly activeMessageId: string | null;
  readonly delivery: RuntimeProgress['delivery'];
  readonly outcome: RuntimeProgress['outcome'];
  readonly loading: boolean;
  readonly error: string | null;
}
export interface LongThreadAdapterLocators {
  readonly scroller: string;
  readonly composer: string;
  /** Library-owned control; null means unsupported. */
  readonly returnToResponse: string | null;
  /** Resolves only the rendered message text, excluding controls and metadata. */
  messageContent(messageId: string): string;
}
/** The product owns rendering, state, composer, and scrolling. Validation lives outside this host. */
export interface LongThreadAdapterHost {
  readonly capabilities: AdapterCapabilities;
  readonly locators: LongThreadAdapterLocators;
  loadHistory(history: readonly Message[]): void | Promise<void>;
  connectReplay(url: string): void | Promise<void>;
  resetThread(): void | Promise<void>;
  dispose(): void | Promise<void>;
  /** Bounded active-message observation during scored phases; no history traversal. */
  readProgress(): RuntimeProgress;
  /** Public runtime transcript, read outside scored phases only. */
  readTranscript(): RuntimeTranscriptSnapshot;
  readVisibleMessages(): readonly VisibleMessage[];
}
/** Raw runtime validation accepts Unicode conformance input as well as performance fixtures. */
export function validateRuntimeTranscript(fixture: {history: readonly Message[]; events: readonly ReplayEvent[]}, state: RuntimeTranscriptSnapshot): string[] {
  const reasons: string[] = [];
  if (state.transcript.length !== fixture.history.length + 1) reasons.push('Transcript count mismatch');
  fixture.history.forEach((expected, i) => {
    const actual = state.transcript[i];
    if (!actual || actual.id !== expected.id || actual.role !== expected.role || actual.text !== expected.text || actual.status !== 'complete') reasons.push(`History message mismatch at ${i}`);
  });
  const response = state.transcript[fixture.history.length];
  const responseId = fixture.events.find(e => e.type === 'assistant-start')?.messageId;
  if (!response || response.id !== responseId || response.role !== 'assistant' || response.status !== 'complete') reasons.push('Response identity or delivery mismatch');
  const expectedText = fixture.events.filter(e => e.type === 'text-delta').map(e => e.text).join('');
  if (response?.text !== expectedText) reasons.push('Response raw text mismatch');
  if (state.activeMessageId !== null || state.delivery !== 'complete' || state.outcome !== 'success' || state.loading || state.error !== null) reasons.push('Runtime has not settled successfully');
  return reasons;
}

export type ComparisonSchemaVersion='2.0.0'|'2.1.0';
export function createComparisonBaseSchemas<const V extends ComparisonSchemaVersion>(version:V){
 if(version!=='2.0.0'&&version!=='2.1.0')throw new Error('Unsupported comparison schema version');
const comparisonVersionShape = {schemaVersion: z.literal(2), suite: z.literal(LONG_THREAD_SUITE), suiteVersion: z.literal(COMPARISON_SUITE_VERSION), collectorVersion: z.literal(version), analyzerVersion: z.literal(version)};
const comparisonIdentityShape = {...comparisonVersionShape, repetition: text, scenarioId: text, round: sequence.refine(n => n > 0), caseIndex: sequence, adapterProfile: text};
const comparisonIdentitySchema = z.strictObject(comparisonIdentityShape);
const comparisonManifestSchema = commonEnvironment.extend({
  ...comparisonVersionShape,
  fixture: z.strictObject({sha256: hash, file: comparisonArtifactPathSchema}),
  repetition: text, scenarioId: text, round: z.number().int().positive(), caseIndex: sequence,
  caseOrder: z.array(text).min(1), workload: longThreadWorkloadSchema, adapter: comparisonAdapterSchema,
  fonts: z.literal('local-system'),
}).superRefine((m, ctx) => {
  if (m.caseOrder[m.caseIndex] !== m.scenarioId) ctx.addIssue({code: 'custom', message: 'Case index/order mismatch'});
  if (m.scenarioId !== longThreadScenarioId(m.workload)) ctx.addIssue({code: 'custom', message: 'Scenario/workload mismatch'});
  if (new Set(m.caseOrder).size !== m.caseOrder.length) ctx.addIssue({code: 'custom', message: 'Duplicate scenario in case order'});
  if (!Number.isSafeInteger(m.workload.seed) || m.workload.seed < 0) return;
  const expectedOrder = longThreadCaseOrder(m.workload.seed);
  if (m.caseOrder.length !== expectedOrder.length || m.caseOrder.some((id, i) => id !== expectedOrder[i])) ctx.addIssue({code: 'custom', message: 'Noncanonical long thread case order'});
  if (m.viewport.width !== 1280 || m.viewport.height !== 800 || m.viewport.deviceScaleFactor !== 1) ctx.addIssue({code: 'custom', message: 'Long thread viewport must be 1280 by 800 at scale 1'});
});
 return {version,versions:Object.freeze({schemaVersion:2,suite:LONG_THREAD_SUITE,suiteVersion:COMPARISON_SUITE_VERSION,collectorVersion:version,analyzerVersion:version} as const),comparisonVersionShape,comparisonIdentityShape,comparisonIdentitySchema,comparisonManifestSchema};
}
export type ComparisonBaseSchemas<V extends ComparisonSchemaVersion>=ReturnType<typeof createComparisonBaseSchemas<V>>;
export const legacyComparisonBase=createComparisonBaseSchemas('2.0.0');
export const comparisonVersionShape=legacyComparisonBase.comparisonVersionShape;
export const comparisonIdentityShape=legacyComparisonBase.comparisonIdentityShape;
export const comparisonIdentitySchema=legacyComparisonBase.comparisonIdentitySchema;
export const comparisonManifestSchema=legacyComparisonBase.comparisonManifestSchema;
