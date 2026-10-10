import { z } from 'zod';
import { comparisonIdentityShape, comparisonVersionShape, comparisonPhaseSchema, comparisonArtifactPathSchema, comparisonInvocationSchema, comparisonUnavailableSchema, comparisonAvailabilitySchema, comparisonBoundedBufferSchema, comparisonObserverSchema, runtimeMessageSchema, rendererCountersSchema, type ComparisonObservation } from './comparison.js';
import { phaseInstanceIdSchema, presentationEvidenceSchema } from './presentation.js';
import { comparisonPhaseMarks, comparisonScoredPresentationPhaseSchema, comparisonRendererPresentationSchema } from './comparison-presentation.js';
import { longThreadCaseOrder } from './long-thread.js';

const text = z.string().min(1);
const timestamp = z.number().finite().nonnegative();
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const paths = z.array(comparisonArtifactPathSchema);
const isoTime = z.iso.datetime();
const issue = (ctx: z.RefinementCtx, message: string) => ctx.addIssue({code: 'custom', message});
function unique(values: readonly (string | number)[], ctx: z.RefinementCtx, label: string) {
  if (new Set(values).size !== values.length) issue(ctx, `Duplicate ${label}`);
}
function marksMatch(v: {phase: string; instanceId: string; startMark: string; endMark?: string}) {
  const marks = comparisonPhaseMarks(v.phase, v.instanceId);
  return v.startMark === marks.startMark && (v.endMark === undefined || v.endMark === marks.endMark);
}
const openShape = {phase: comparisonPhaseSchema, instanceId: phaseInstanceIdSchema, startMs: timestamp, startMark: text};
export const comparisonPhaseInstanceSchema = z.strictObject({...openShape, endMs: timestamp, endMark: text}).superRefine((v, ctx) => {
  if (v.endMs <= v.startMs) issue(ctx, 'Closed phase must have positive duration');
  if (!marksMatch(v)) issue(ctx, 'Phase marks do not match identity');
});
export const comparisonOpenPhaseSchema = z.strictObject(openShape).refine(marksMatch, 'Open phase mark does not match identity');
export const comparisonPhaseBoundarySchema = z.strictObject({phase: comparisonPhaseSchema, instanceId: phaseInstanceIdSchema, boundary: z.enum(['start', 'end']), timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), markName: text}).refine(v => v.markName === `bench:comparison:${v.phase}:${v.instanceId}:${v.boundary}`, 'Boundary mark does not match identity');
export const comparisonPhasesSchema = z.strictObject({...comparisonIdentityShape, status: z.enum(['complete', 'partial']), reason: text.optional(), instances: z.array(comparisonPhaseInstanceSchema), openPhase: comparisonOpenPhaseSchema.nullable()}).superRefine((v, ctx) => {
  if (v.status === 'complete' ? v.reason !== undefined || v.openPhase !== null : v.reason === undefined) issue(ctx, 'Phase status requires complete closure or explicit partial reason');
  unique([...v.instances.map(p => p.instanceId), ...(v.openPhase ? [v.openPhase.instanceId] : [])], ctx, 'phase instance identity');
  unique([...v.instances.flatMap(p => [p.startMark, p.endMark]), ...(v.openPhase ? [v.openPhase.startMark] : [])], ctx, 'phase mark');
  if (v.instances.some((p, i) => i > 0 && p.startMs < v.instances[i - 1]!.endMs)) issue(ctx, 'Phase intervals must be chronological and nonoverlapping');
  if (v.openPhase && v.instances.length && v.openPhase.startMs < v.instances.at(-1)!.endMs) issue(ctx, 'Open phase overlaps a closed interval');
});
export type ComparisonPhases = z.infer<typeof comparisonPhasesSchema>;
/** This checks only supplied page identity/time facts, never capture or scoring eligibility. */
export function validateComparisonPageAttribution(observation: ComparisonObservation, phases: ComparisonPhases): string[] {
  if (observation.clockDomain !== 'page-performance-ms') return [];
  if (observation.repetition !== phases.repetition) return ['Observation repetition differs from phase artifact'];
  if (observation.kind !== 'phase' && observation.phase === null) {
    return observation.phaseInstanceId === null && observation.attributionReason !== null ? [] : ['Unattributed record requires a null pair and reason'];
  }
  const closed = phases.instances.find(p => p.instanceId === observation.phaseInstanceId);
  const open = phases.openPhase?.instanceId === observation.phaseInstanceId ? phases.openPhase : null;
  if (observation.kind === 'phase') {
    const instance = closed ?? open;
    if (!instance || instance.phase !== observation.phase) return ['Boundary instance identity mismatch'];
    if (observation.data.boundary === 'start') return observation.timestampMs === instance.startMs && observation.data.markName === instance.startMark ? [] : ['Boundary start does not match actual phase start'];
    return closed && observation.timestampMs === closed.endMs && observation.data.markName === closed.endMark ? [] : ['Boundary end does not match a closed phase end'];
  }
  if (!closed) return ['Attribution needs a known closed interval'];
  if (observation.phase !== closed.phase) return ['Attributed phase name differs from instance'];
  if (observation.attributionReason !== null) return ['Known attribution must not carry an unavailable reason'];
  return observation.timestampMs >= closed.startMs && observation.timestampMs < closed.endMs ? [] : ['Actual page timestamp lies outside attributed exclusive interval'];
}

export const comparisonInventoryFileSchema = z.strictObject({path: comparisonArtifactPathSchema, status: z.enum(['complete', 'partial']), byteLength: count, sha256: hash, reason: text.optional()}).refine(v => v.status === 'partial' ? v.reason !== undefined : v.reason === undefined, 'File status must match partial reason');
const probeShape = {intervalMs: timestamp.refine(n => n > 0), callbacks: count, callbackDurationTotalMs: timestamp, maximumObservedGapMs: comparisonAvailabilitySchema(timestamp)};
export const comparisonInstrumentationSchema = z.strictObject({
  runtimeProbe: z.strictObject(probeShape), domProbe: z.strictObject({...probeShape, selectionStrategy: z.literal('bounded-visible-candidates')}), scrollProbe: z.strictObject(probeShape), transportDrain: z.strictObject(probeShape),
  eventTiming: comparisonObserverSchema, loaf: comparisonObserverSchema, buffers: z.array(comparisonBoundedBufferSchema),
}).superRefine((v, ctx) => {
  unique(v.buffers.map(b => b.name), ctx, 'buffer name');
  for (const [expected, observer] of [['event', v.eventTiming], ['long-animation-frame', v.loaf]] as const) if (observer.status === 'available' && observer.value.entryType !== expected) issue(ctx, 'Observer entry type differs from instrumentation slot');
});
export const comparisonTraceSchema = z.discriminatedUnion('status', [comparisonUnavailableSchema, z.strictObject({
  status: z.literal('available'), format: z.literal('cdp-json'), file: comparisonArtifactPathSchema, categories: z.array(text).min(1), complete: z.boolean(), reason: text.optional(),
  tracingComplete: comparisonAvailabilitySchema(z.strictObject({dataLossOccurred: z.boolean(), stream: text.optional(), traceFormat: z.enum(['json', 'proto']).optional(), streamCompression: z.enum(['none', 'gzip']).optional()})),
  bufferUsage: z.array(z.strictObject({percentFull: z.number().finite().min(0).max(1).optional(), value: z.number().finite().min(0).max(1).optional(), eventCount: timestamp.optional(), observedAtHostMs: timestamp})),
  presentation: comparisonAvailabilitySchema(presentationEvidenceSchema),
}).superRefine((v, ctx) => {
  unique(v.categories, ctx, 'trace category');
  if (v.complete ? v.reason !== undefined : v.reason === undefined) issue(ctx, 'Incomplete trace requires a reason');
})]);
export const comparisonEvidenceSchema = z.strictObject({
  ...comparisonIdentityShape, status: z.enum(['pending', 'complete', 'partial']), reason: text.optional(), files: z.array(comparisonInventoryFileSchema), unavailableFiles: z.array(z.strictObject({path: comparisonArtifactPathSchema, reason: text})),
  trace: comparisonTraceSchema, instrumentation: comparisonInstrumentationSchema,
}).superRefine((v, ctx) => {
  if (v.status === 'partial' ? v.reason === undefined : v.reason !== undefined) issue(ctx, 'Evidence status requires explicit partial reason');
  unique([...v.files.map(f => f.path), ...v.unavailableFiles.map(f => f.path)], ctx, 'inventory path');
  const derived = new Set(['evidence.json', 'results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
  if (v.files.some(f => derived.has(f.path.split('/').at(-1)!))) issue(ctx, 'Payload inventory excludes itself and derived analysis files');
  if (v.status === 'complete' && (v.files.some(f => f.status === 'partial') || v.instrumentation.buffers.some(b => b.status === 'partial') || v.trace.status === 'available' && (!v.trace.complete || v.trace.tracingComplete.status === 'available' && v.trace.tracingComplete.value.dataLossOccurred))) issue(ctx, 'Complete evidence cannot claim partial or lost capture');
});
export type ComparisonEvidence = z.infer<typeof comparisonEvidenceSchema>;

const runtimeSnapshot = z.strictObject({transcript: z.array(runtimeMessageSchema), activeMessageId: text.nullable(), delivery: z.enum(['idle', 'streaming', 'complete', 'aborted', 'error']), outcome: z.enum(['success', 'error', 'aborted']).nullable(), loading: z.boolean(), error: z.string().nullable()});
export const comparisonFinalRuntimeSchema = z.strictObject({...comparisonIdentityShape, timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), snapshot: runtimeSnapshot});
export type ComparisonFinalRuntime = z.infer<typeof comparisonFinalRuntimeSchema>;
const capturedMessage = z.strictObject({id: text, text: z.string()});
const activeResponse = z.union([capturedMessage, comparisonUnavailableSchema]);
const coverage = z.discriminatedUnion('mode', [
  z.strictObject({mode: z.literal('all-mounted'), messages: z.array(capturedMessage), activeResponse}).superRefine((v, ctx) => unique(v.messages.map(m => m.id), ctx, 'mounted message identity')),
  z.strictObject({mode: z.literal('virtualized'), visibleMessages: z.array(capturedMessage), historySamples: z.array(capturedMessage.extend({sampleIndex: count, pageTimestampMs: timestamp})), activeResponse, samplingRecipe: z.strictObject({seed: count, count})}).superRefine((v, ctx) => {
    unique([...v.visibleMessages.map(m => m.id), ...v.historySamples.map(m => m.id)], ctx, 'visible/sample message identity');
    unique(v.historySamples.map(m => m.sampleIndex), ctx, 'history sample index');
    if (v.historySamples.length !== v.samplingRecipe.count || v.historySamples.some(s => s.sampleIndex >= v.samplingRecipe.count)) issue(ctx, 'Sample cohort must match declared recipe count');
  }),
]);
export const comparisonVisibleValidationSchema = z.strictObject({...comparisonIdentityShape, timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), coverage});
export type ComparisonVisibleValidation = z.infer<typeof comparisonVisibleValidationSchema>;
const stage = z.enum(['setup', 'replay', 'validation', 'disposal']);
export const comparisonExceptionsSchema = z.strictObject({...comparisonIdentityShape, exceptions: z.array(z.strictObject({source: z.enum(['runner', 'page', 'console', 'producer']), stage, clockDomain: z.enum(['host-monotonic-ms', 'page-performance-ms', 'producer-monotonic-ms']), timestampMs: timestamp, message: text, stack: z.string().nullable(), severity: z.enum(['error', 'warning'])}).superRefine((v, ctx) => {
  const clock = v.source === 'producer' ? 'producer-monotonic-ms' : v.source === 'runner' ? 'host-monotonic-ms' : 'page-performance-ms';
  if (v.clockDomain !== clock) issue(ctx, 'Exception source and clock differ');
}))});
export type ComparisonExceptions = z.infer<typeof comparisonExceptionsSchema>;
const status = z.enum(['valid', 'invalid', 'failed']);
function validateVerdict(v: {status: 'valid'|'invalid'|'failed'; reasons: string[]}, ctx: z.RefinementCtx) {
  if (v.status === 'valid' ? v.reasons.length !== 0 : v.reasons.length === 0) issue(ctx, 'Verdict must preserve explicit unsuccessful reasons');
}
export const comparisonValidationSchema = z.strictObject({...comparisonIdentityShape, status, checks: z.array(z.strictObject({name: text, passed: z.boolean(), reason: text.nullable(), evidencePaths: paths}).refine(v => v.passed ? v.reason === null : v.reason !== null, 'Unsuccessful check requires a reason')).min(1), reasons: z.array(text)}).superRefine((v, ctx) => {
  validateVerdict(v, ctx);
  unique(v.checks.map(c => c.name), ctx, 'validation check name');
  if (v.status === 'valid' && v.checks.some(c => !c.passed)) issue(ctx, 'Valid verdict cannot contain unsuccessful checks');
});
export type ComparisonValidation = z.infer<typeof comparisonValidationSchema>;
export const comparisonMeasurementSchema = z.discriminatedUnion('status', [comparisonUnavailableSchema, z.strictObject({status: z.literal('available'), value: z.number().finite(), unit: text, evidencePaths: paths.min(1)})]);
const metric = z.strictObject({name: text, measurement: comparisonMeasurementSchema});
const metricList = z.array(metric).superRefine((v, ctx) => unique(v.map(m => m.name), ctx, 'metric name'));
export const comparisonRunResultsSchema = z.strictObject({
  ...comparisonIdentityShape, generatedAt: isoTime, status, reasons: z.array(text), metrics: metricList,
  phases: z.array(z.strictObject({phase: comparisonScoredPresentationPhaseSchema, instanceId: phaseInstanceIdSchema, metrics: metricList})), presentation: comparisonRendererPresentationSchema,
  diagnostics: z.array(z.strictObject({name: text, value: z.number().finite(), unit: text, scored: z.literal(false), evidencePaths: paths.min(1)})),
}).superRefine((v, ctx) => {
  validateVerdict(v, ctx);
  unique(v.phases.map(p => p.instanceId), ctx, 'result phase identity');
  unique(v.diagnostics.map(d => d.name), ctx, 'diagnostic name');
  if (v.status !== 'valid') {
    if ([...v.metrics, ...v.phases.flatMap(p => p.metrics)].some(m => m.measurement.status === 'available')) issue(ctx, 'Unsuccessful run cannot have available scored metrics');
    if (v.presentation.status === 'available' && v.presentation.value.phases.some(p => p.rendererVisualUpdateFps.status === 'available' || p.presentationIntervals.status === 'available')) issue(ctx, 'Unsuccessful run cannot have scored presentation');
  }
});
export type ComparisonRunResults = z.infer<typeof comparisonRunResultsSchema>;

export const comparisonRectSchema = z.strictObject({left: z.number().finite(), top: z.number().finite(), right: z.number().finite(), bottom: z.number().finite()}).refine(v => v.right >= v.left && v.bottom >= v.top, 'Rectangle bounds must be ordered');
export const comparisonGeometrySchema = comparisonAvailabilitySchema(z.strictObject({hostRect: comparisonRectSchema, contentRects: z.array(comparisonRectSchema), viewportRect: comparisonRectSchema, scrollerRect: comparisonRectSchema, clippingAncestorRects: z.array(comparisonRectSchema), effectiveClipRect: comparisonRectSchema.nullable()}));
export const comparisonInputRecipeSchema = z.strictObject({
  wheel: z.strictObject({recipeId: text, deltasCssPx: z.tuple([z.literal(-100), z.literal(-100), z.literal(-100), z.literal(-100)]), cadenceMs: z.literal(50)}),
  composer: z.strictObject({recipeId: text, text: z.literal('calibrate'), cadenceMs: z.literal(35), submit: z.literal(false)}),
}).refine(v => v.wheel.recipeId !== v.composer.recipeId, 'Input recipes require distinct identities');
export const comparisonHostDispatchSchema = z.strictObject({recipeId: text, index: count, kind: z.enum(['wheel', 'composer', 'return-control']), hostMonotonicMs: timestamp, requestedOffsetMs: timestamp, actualOffsetMs: timestamp}).superRefine((v, ctx) => {
  if (v.kind === 'wheel' && (v.index > 3 || v.requestedOffsetMs !== v.index * 50)) issue(ctx, 'Wheel dispatch requires four canonical requested offsets');
  if (v.kind === 'composer' && (v.index >= 'calibrate'.length || v.requestedOffsetMs !== v.index * 35)) issue(ctx, 'Composer dispatch requires canonical requested cadence');
});
export const comparisonDeadlineSchema = z.strictObject({stage: z.enum(['setup', 'replay', 'disposal']), budgetMs: z.union([z.literal(60000), z.literal(30000), z.literal(10000)]), startedAtHostMs: timestamp, deadlineAtHostMs: timestamp, finishedAtHostMs: timestamp.nullable(), outcome: z.enum(['complete', 'expired', 'failed']), reason: text.optional()}).superRefine((v, ctx) => {
  const expected = {setup: 60000, replay: 30000, disposal: 10000}[v.stage];
  if (v.budgetMs !== expected || v.deadlineAtHostMs !== v.startedAtHostMs + expected) issue(ctx, 'Deadline must use exact stage budget and host-clock arithmetic');
  if (v.outcome === 'complete' ? v.reason !== undefined || v.finishedAtHostMs === null : v.reason === undefined) issue(ctx, 'Deadline outcome needs honest completion or failure reason');
  if (v.finishedAtHostMs !== null && v.finishedAtHostMs < v.startedAtHostMs) issue(ctx, 'Deadline completion precedes start');
  if (v.outcome === 'complete' && v.finishedAtHostMs !== null && v.finishedAtHostMs > v.deadlineAtHostMs) issue(ctx, 'Successful completion cannot exceed the absolute host deadline');
});
export const comparisonHostFrameGuardSchema = z.strictObject({
  messageId: text, hostObservation: z.strictObject({clockDomain: z.literal('page-performance-ms'), timestampMs: timestamp, hostMounted: z.literal(true), contentMounted: z.boolean()}),
  frames: z.tuple([z.strictObject({ordinal: z.literal(1), clockDomain: z.literal('page-performance-ms'), timestampMs: timestamp}), z.strictObject({ordinal: z.literal(2), clockDomain: z.literal('page-performance-ms'), timestampMs: timestamp})]),
}).refine(v => v.frames[0].timestampMs >= v.hostObservation.timestampMs && v.frames[1].timestampMs > v.frames[0].timestampMs, 'Two page frame callbacks must follow actual host mount chronologically');
const scrollCheckpoint = z.strictObject({timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), scrollTop: z.number().finite(), scrollHeight: timestamp, clientHeight: timestamp, anchorId: text.nullable(), anchorTopCssPx: z.number().finite().nullable(), activeVisible: z.boolean(), followArmed: z.boolean().nullable(), pinThresholdCssPx: timestamp.nullable(), geometry: comparisonGeometrySchema});
export const comparisonCheckpointsSchema = z.strictObject({...comparisonIdentityShape, inputRecipe: comparisonInputRecipeSchema, hostDispatches: z.array(comparisonHostDispatchSchema), hostFrameGuards: z.array(comparisonHostFrameGuardSchema), scroll: z.array(scrollCheckpoint), counters: z.array(z.strictObject({timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), data: rendererCountersSchema})), deadlines: z.array(comparisonDeadlineSchema)}).superRefine((v, ctx) => {
  unique(v.deadlines.map(d => d.stage), ctx, 'deadline stage');
  unique(v.hostDispatches.map(d => `${d.recipeId}:${d.index}`), ctx, 'dispatch identity');
  for (const d of v.hostDispatches) {
    if (d.kind === 'wheel' && d.recipeId !== v.inputRecipe.wheel.recipeId || d.kind === 'composer' && d.recipeId !== v.inputRecipe.composer.recipeId) issue(ctx, 'Dispatch recipe identity mismatch');
  }
});
export type ComparisonCheckpoints = z.infer<typeof comparisonCheckpointsSchema>;

export const comparisonScheduledRunSchema = z.strictObject({...comparisonIdentityShape, seed: count, mode: z.enum(['headed', 'headless']), artifactDirectory: comparisonArtifactPathSchema});
export type ComparisonScheduledRun = z.infer<typeof comparisonScheduledRunSchema>;
const runSlot = z.strictObject({round: count.refine(n => n > 0), caseIndex: count, scenarioId: text, adapterProfile: text, repetition: text, artifactDirectory: comparisonArtifactPathSchema, status: z.enum(['scheduled', 'running', 'valid', 'invalid', 'failed']), reasons: z.array(text)}).superRefine((v, ctx) => {
  if (v.status === 'invalid' || v.status === 'failed' ? v.reasons.length === 0 : v.reasons.length !== 0) issue(ctx, 'Slot status needs explicit unsuccessful reasons');
});
export const comparisonCaptureInvocationSchema = z.strictObject({...comparisonVersionShape, createdAt: isoTime, purpose: z.enum(['publication', 'conformance']), status: z.enum(['pending', 'complete', 'failed']), configuration: comparisonInvocationSchema, runs: z.array(runSlot)}).superRefine((v, ctx) => {
  const config = v.configuration, order = longThreadCaseOrder(config.seed);
  if (v.purpose === 'publication' && (config.rounds !== 3 || config.adapterProfiles.length !== 1)) issue(ctx, 'Publication requires three rounds and one adapter profile');
  const slots = config.rounds * order.length * config.adapterProfiles.length;
  if (v.runs.length !== slots) issue(ctx, 'Invocation must retain all declared canonical slots');
  unique(v.runs.map(r => r.repetition), ctx, 'run repetition');
  unique(v.runs.map(r => r.artifactDirectory), ctx, 'run directory');
  v.runs.forEach((run, index) => {
    const perRound = order.length * config.adapterProfiles.length;
    const expectedRound = Math.floor(index / perRound) + 1;
    const caseIndex = Math.floor(index % perRound / config.adapterProfiles.length);
    const profile = config.adapterProfiles[index % config.adapterProfiles.length];
    if (run.round !== expectedRound || run.caseIndex !== caseIndex || run.scenarioId !== order[caseIndex] || run.adapterProfile !== profile) issue(ctx, 'Run slot differs from canonical invocation order');
    if (v.status !== 'pending' && (run.status === 'scheduled' || run.status === 'running')) issue(ctx, 'Terminal invocation must finalize untouched slots');
  });
});
export type ComparisonCaptureInvocation = z.infer<typeof comparisonCaptureInvocationSchema>;
export type ComparisonPhaseInstance = z.infer<typeof comparisonPhaseInstanceSchema>;
export type ComparisonOpenPhase = z.infer<typeof comparisonOpenPhaseSchema>;
export type ComparisonPhaseBoundary = z.infer<typeof comparisonPhaseBoundarySchema>;
export type ComparisonInventoryFile = z.infer<typeof comparisonInventoryFileSchema>;
export type ComparisonInstrumentation = z.infer<typeof comparisonInstrumentationSchema>;
export type ComparisonTrace = z.infer<typeof comparisonTraceSchema>;
export type ComparisonMeasurement = z.infer<typeof comparisonMeasurementSchema>;
export type ComparisonRect = z.infer<typeof comparisonRectSchema>;
export type ComparisonGeometry = z.infer<typeof comparisonGeometrySchema>;
export type ComparisonInputRecipe = z.infer<typeof comparisonInputRecipeSchema>;
export type ComparisonHostDispatch = z.infer<typeof comparisonHostDispatchSchema>;
export type ComparisonDeadline = z.infer<typeof comparisonDeadlineSchema>;
export type ComparisonHostFrameGuard = z.infer<typeof comparisonHostFrameGuardSchema>;
