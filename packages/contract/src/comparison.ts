import { z } from 'zod';
import { manifestSchema } from './artifact.js';
import { replayEventSchema, payloadBytes, type Message, type ReplayEvent } from './fixture.js';
import type { TranscriptMessage } from './adapter.js';
import { LONG_THREAD_SUITE, longThreadWorkloadSchema, longThreadCaseOrder, longThreadScenarioId } from './long-thread.js';

const text = z.string().min(1);
const timestamp = z.number().finite().nonnegative();
const sequence = z.number().int().nonnegative();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const exactVersion = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const hashes = z.record(text, hash);
const nonemptyHashes = hashes.refine(value => Object.keys(value).length > 0, 'Hash inventory must not be empty');
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
export const comparisonManifestSchema = commonEnvironment.extend({
  schemaVersion: z.literal(2), suite: z.literal(LONG_THREAD_SUITE), suiteVersion: text, analyzerVersion: text, collectorVersion: text,
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
const prefixes = z.array(sequence).superRefine((values, ctx) => {
  if (values.some((v, i) => i > 0 && v <= values[i - 1]!)) ctx.addIssue({code: 'custom', message: 'Matched prefixes must increase strictly'});
});
const baseObservation = {schemaVersion: z.literal(2), repetition: text, phase: comparisonPhaseSchema, sequence: sequence.nullable(), timestampMs: timestamp};
const pageObservation = {...baseObservation, clockDomain: z.literal('page-performance-ms')};
/** One nanosecond in millisecond units, plus eight floating-point epsilon steps at the compared magnitude. */
function sameTimingMs(actual: number, expected: number): boolean {
  const toleranceMs = 1e-6 + 8 * Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected));
  return Math.abs(actual - expected) <= toleranceMs;
}
const unavailableCounterSchema = z.strictObject({status: z.literal('unavailable'), reason: text});
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
  z.strictObject({...pageObservation, kind: z.literal('phase'), data: z.strictObject({boundary: z.enum(['start', 'end'])})}),
  z.strictObject({...pageObservation, kind: z.literal('renderer-counters'), data: rendererCountersSchema}),
  z.strictObject({...pageObservation, kind: z.literal('scroll-checkpoint'), data: z.strictObject({scrollTop: z.number().finite(), scrollHeight: timestamp, clientHeight: timestamp, anchorId: text.nullable(), anchorTopCssPx: z.number().finite().nullable(), activeVisible: z.boolean(), followArmed: z.boolean().nullable()})}),
  z.strictObject({...pageObservation, kind: z.literal('composer-input'), data: z.strictObject({value: z.string()})}),
  z.strictObject({...pageObservation, kind: z.literal('failure'), data: z.strictObject({stage: z.enum(['setup', 'replay', 'validation', 'disposal']), reason: text})}),
]).superRefine((observation, ctx) => {
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
