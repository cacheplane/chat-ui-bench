import { z } from 'zod';
import { comparisonIdentityShape, comparisonIdentitySchema, comparisonVersionShape, comparisonPhaseSchema, comparisonArtifactPathSchema, comparisonInvocationSchema, comparisonUnavailableSchema, comparisonAvailabilitySchema, comparisonBoundedBufferSchema, comparisonObserverSchema, runtimeMessageSchema, rendererCountersSchema, type ComparisonObservation } from './comparison.js';
import { phaseInstanceIdSchema, presentationEvidenceSchema } from './presentation.js';
import { comparisonPhaseMarks, comparisonScoredPresentationPhaseSchema, comparisonRendererPresentationSchema } from './comparison-presentation.js';
import { longThreadCaseOrder } from './long-thread.js';
import {COMPARISON_CAPTURE_LIMITS} from './comparison-buffer.js';

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
  bufferUsage: z.array(z.strictObject({percentFull: z.number().finite().min(0).max(1).optional(), value: z.number().finite().min(0).max(1).optional(), eventCount: timestamp.optional(), observedAtHostMs: timestamp})).max(256),
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
export const comparisonExceptionEntrySchema = z.strictObject({source: z.enum(['runner', 'page', 'console', 'producer']), stage, clockDomain: z.enum(['host-monotonic-ms', 'page-performance-ms', 'producer-monotonic-ms']), timestampMs: timestamp, message: text, stack: z.string().nullable(), severity: z.enum(['error', 'warning'])}).superRefine((v, ctx) => {
  const clock = v.source === 'producer' ? 'producer-monotonic-ms' : v.source === 'runner' ? 'host-monotonic-ms' : 'page-performance-ms';
  if (v.clockDomain !== clock) issue(ctx, 'Exception source and clock differ');
});
export type ComparisonExceptionEntry = z.infer<typeof comparisonExceptionEntrySchema>;
export const comparisonExceptionsSchema = z.strictObject({...comparisonIdentityShape, exceptions:z.array(comparisonExceptionEntrySchema)});
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
export const comparisonGeometrySchema = comparisonAvailabilitySchema(z.strictObject({messageId: text, role: z.enum(['user', 'assistant']), hostRect: comparisonRectSchema, contentRects: z.array(comparisonRectSchema).max(COMPARISON_CAPTURE_LIMITS.maxRectsPerSample), viewportRect: comparisonRectSchema, scrollerRect: comparisonRectSchema, clippingAncestorRects: z.array(comparisonRectSchema).max(COMPARISON_CAPTURE_LIMITS.maxAncestorsPerGeometry), clippingAncestorAxes: z.array(z.strictObject({clipX: z.boolean(), clipY: z.boolean()})).max(COMPARISON_CAPTURE_LIMITS.maxAncestorsPerGeometry), effectiveClipRect: comparisonRectSchema.nullable()}).refine(v => v.clippingAncestorRects.length === v.clippingAncestorAxes.length, 'Clipping rectangles and axes must align'));
export const comparisonCaptureLimitsSchema = z.strictObject({
  maxPendingEntries:z.literal(COMPARISON_CAPTURE_LIMITS.maxPendingEntries),maxPendingSerializedBytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes),maxRecordSerializedBytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes),
  maxRecordTokens:z.literal(COMPARISON_CAPTURE_LIMITS.maxRecordTokens),maxRecordDepth:z.literal(COMPARISON_CAPTURE_LIMITS.maxRecordDepth),
  maxRuntimeCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxRuntimeCodeUnits),maxRuntimeUtf8Bytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxRuntimeUtf8Bytes),
  maxActiveDomCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxActiveDomCodeUnits),maxActiveDomUtf8Bytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxActiveDomUtf8Bytes),
  maxHistoricalDomCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxHistoricalDomCodeUnits),maxHistoricalDomUtf8Bytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxHistoricalDomUtf8Bytes),
  maxHistoricalCallbackCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxHistoricalCallbackCodeUnits),maxHistoricalCallbackUtf8Bytes:z.literal(COMPARISON_CAPTURE_LIMITS.maxHistoricalCallbackUtf8Bytes),
  maxHistoricalCandidates:z.literal(COMPARISON_CAPTURE_LIMITS.maxHistoricalCandidates),maxNodesPerSample:z.literal(COMPARISON_CAPTURE_LIMITS.maxNodesPerSample),maxNodesPerCallback:z.literal(COMPARISON_CAPTURE_LIMITS.maxNodesPerCallback),
  maxAncestorsPerGeometry:z.literal(COMPARISON_CAPTURE_LIMITS.maxAncestorsPerGeometry),maxAncestorsPerCallback:z.literal(COMPARISON_CAPTURE_LIMITS.maxAncestorsPerCallback),
  maxRectsPerSample:z.literal(COMPARISON_CAPTURE_LIMITS.maxRectsPerSample),maxRectsPerCallback:z.literal(COMPARISON_CAPTURE_LIMITS.maxRectsPerCallback),
  maxConsoleArguments:z.literal(COMPARISON_CAPTURE_LIMITS.maxConsoleArguments),maxDiagnosticFieldCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits),maxDiagnosticMessageCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxDiagnosticMessageCodeUnits),maxDiagnosticStackCodeUnits:z.literal(COMPARISON_CAPTURE_LIMITS.maxDiagnosticStackCodeUnits),
});
export const comparisonCaptureMetadataSchema = z.strictObject({...comparisonIdentityShape,
  browserProtocol:z.strictObject({protocolVersion:text,product:text,revision:text,userAgent:text,jsVersion:text}),chromiumDownloadRevision:text,playwrightVersion:text,
  instrumentation:z.strictObject({sourceHashes:z.record(comparisonArtifactPathSchema,hash).refine(v=>Object.keys(v).length>0,'Actual source inventory must not be empty'),installerSha256:hash,probeIntervalMs:z.literal(50),limits:comparisonCaptureLimitsSchema}),
});
export type ComparisonCaptureMetadata = z.infer<typeof comparisonCaptureMetadataSchema>;
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
const scrollCheckpoint = z.strictObject({timestampMs: timestamp, clockDomain: z.literal('page-performance-ms'), scrollTop: z.number().finite(), scrollHeight: timestamp, clientHeight: timestamp, anchorId: text.nullable(), anchorTopCssPx: z.number().finite().nullable(), activeVisible: z.boolean(), followArmed: z.boolean().nullable(), pinThresholdCssPx: timestamp.nullable(), geometry: comparisonGeometrySchema,anchorGeometry:comparisonGeometrySchema}).superRefine((v,ctx)=>{
  if(v.geometry.status==='available'&&v.geometry.value.role!=='assistant') issue(ctx,'Active geometry requires actual assistant role');
  if(v.anchorGeometry.status==='available'&&v.anchorGeometry.value.messageId!==v.anchorId) issue(ctx,'Anchor geometry must own actual anchor identity');
});
const hostReceipt = comparisonAvailabilitySchema(z.strictObject({timestampMs:timestamp,clockDomain:z.literal('host-monotonic-ms')}));
export const comparisonCounterCheckpointSchema = z.strictObject({lifecycle:z.enum(['baseline','history-ready','replay-end']),pageRequestBracket:comparisonAvailabilitySchema(z.strictObject({clockDomain:z.literal('page-performance-ms'),beforeMs:timestamp,afterMs:timestamp}).refine(v=>v.beforeMs<=v.afterMs,'Page request bracket must be ordered')),hostReceipt:z.strictObject({heap:hostReceipt,dom:hostReceipt}),data:rendererCountersSchema});
export type ComparisonCounterCheckpoint = z.infer<typeof comparisonCounterCheckpointSchema>;
export const comparisonCheckpointsSchema = z.strictObject({...comparisonIdentityShape, inputRecipe: comparisonInputRecipeSchema, hostDispatches: z.array(comparisonHostDispatchSchema), hostFrameGuards: z.array(comparisonHostFrameGuardSchema), scroll: z.array(scrollCheckpoint), counters: z.array(comparisonCounterCheckpointSchema), deadlines: z.array(comparisonDeadlineSchema)}).superRefine((v, ctx) => {
  const order=['baseline','history-ready','replay-end'];
  if(v.counters.some((counter,i)=>i>0&&order.indexOf(counter.lifecycle)<=order.indexOf(v.counters[i-1]!.lifecycle))) issue(ctx,'Counter lifecycle must be unique and ordered');
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

// Operational acquisition facts are bounded independently of observation retention.
const reason = text.max(4096);
const missingFact = z.strictObject({status:z.literal('unavailable'),reason});
const availability = <T extends z.ZodType>(value:T) => z.discriminatedUnion('status',[missingFact,z.strictObject({status:z.literal('available'),value})]);
const payloadStatus = z.strictObject({path:comparisonArtifactPathSchema,status:z.enum(['complete','partial']),reason:reason.optional()}).refine(v=>v.status==='partial' ? v.reason!==undefined : v.reason===undefined,'Payload partial status requires a reason');
const unavailablePath = z.strictObject({path:comparisonArtifactPathSchema,reason});
const analysisOutputs = new Set(['results.json','metrics.json','summary.md','report.json','report.html','report.md']);
const slotRawNames = new Set(['descriptor.json','fixture.json','validation.json','exceptions.json','producer.jsonl','page.jsonl','page-exceptions.jsonl','trace.json','manifest.json','capture-metadata.json','phases.json','checkpoints.json','final-runtime.json','visible-validation.json','trace-auxiliary.json','native-dispatch-results.json','capture-status.json','finalization-status.json']);
function rawSlotPath(path:string):boolean {
  const original=path.replace(/\.[a-f0-9-]{36}\.tmp$/,'');
  return slotRawNames.has(original) || original==='provenance/build-evidence.json' || original==='provenance/acquisition.json' || original==='instrumentation/pre-navigation.js' || original==='instrumentation/main.js' || original==='instrumentation/build-evidence.json' || /^(?:provenance\/(?:source|assets|packages)|instrumentation\/(?:source|compiled))\/.+/.test(original);
}
function sameIdentityFacts(a:Record<string,unknown>,b:Record<string,unknown>):boolean {return Object.keys(comparisonIdentityShape).every(key=>a[key]===b[key]);}
const drainSummary = z.strictObject({entries:count,serializedBytes:count}).refine(v=>v.entries!==0 || v.serializedBytes===0,'Empty drain cannot contain serialized bytes');
export const comparisonCaptureStatusSchema = z.strictObject({
  ...comparisonIdentityShape,status:z.enum(['complete','partial','unavailable']),reasons:z.array(reason).max(32),
  captureMetadata:availability(comparisonCaptureMetadataSchema),evidenceMetadata:z.discriminatedUnion('status',[missingFact,z.strictObject({status:z.literal('available')})]),
  payloads:z.array(payloadStatus).max(4096),unavailablePaths:z.array(unavailablePath).max(4096),
  terminalPageDrain:availability(drainSummary),terminalProducerDrain:availability(drainSummary),finalPageInstrumentation:availability(comparisonInstrumentationSchema),traceEof:availability(z.strictObject({observedAtHostMs:timestamp,clockDomain:z.literal('host-monotonic-ms')})),
}).superRefine((v,ctx)=>{
  if(v.status==='complete' ? v.reasons.length!==0 : v.reasons.length===0) issue(ctx,'Capture status needs explicit unsuccessful reasons');
  const paths=[...v.payloads.map(p=>p.path),...v.unavailablePaths.map(p=>p.path)]; unique(paths,ctx,'capture path');
  if(paths.length>4096 || paths.some(path=>!rawSlotPath(path))) issue(ctx,'Capture paths must be bounded declared raw members');
  if(v.captureMetadata.status==='available' && !sameIdentityFacts(v,v.captureMetadata.value)) issue(ctx,'Capture metadata identity mismatch');
  if(v.status==='complete' && ([v.captureMetadata,v.evidenceMetadata,v.terminalPageDrain,v.terminalProducerDrain,v.finalPageInstrumentation,v.traceEof].some(f=>f.status!=='available') || v.payloads.some(f=>f.status==='partial') || v.unavailablePaths.length)) issue(ctx,'Complete capture requires genuinely acquired complete facts');
  if(v.status==='complete' && v.finalPageInstrumentation.status==='available' && v.finalPageInstrumentation.value.buffers.some(b=>b.status==='partial')) issue(ctx,'Complete capture cannot hide buffer loss');
});
export type ComparisonCaptureStatus = z.infer<typeof comparisonCaptureStatusSchema>;
export const comparisonRawInventorySchema = z.strictObject({...comparisonIdentityShape,status:z.literal('partial'),reason,files:z.array(comparisonInventoryFileSchema).max(4096)}).superRefine((v,ctx)=>{
  unique(v.files.map(f=>f.path),ctx,'raw inventory path');
  if(v.files.some(f=>!rawSlotPath(f.path))) issue(ctx,'Raw inventory excludes its own manifest, evidence and derived files');
});
export type ComparisonRawInventory = z.infer<typeof comparisonRawInventorySchema>;
export const comparisonFinalizationStatusSchema = z.strictObject({...comparisonIdentityShape,status:z.literal('failed'),reason,manifest:z.strictObject({path:z.enum(['evidence.json','raw-inventory.json']).nullable(),state:z.enum(['unusable','not-written'])}),failedAtHostMs:timestamp,datasetSealEligible:z.literal(false)}).refine(v=>(v.manifest.path===null)===(v.manifest.state==='not-written'),'Finalization manifest availability must agree');
export type ComparisonFinalizationStatus = z.infer<typeof comparisonFinalizationStatusSchema>;
export const comparisonDatasetFinalizationFailureSchema = z.strictObject({...comparisonVersionShape,invocationId:z.uuid(),status:z.literal('failed'),reasons:z.array(reason).min(1).max(32),failedAtHostMs:timestamp,sealPath:z.literal('dataset-seal.json'),sealState:z.enum(['absent','present-unusable','unavailable'])});
export type ComparisonDatasetFinalizationFailure = z.infer<typeof comparisonDatasetFinalizationFailureSchema>;
const traceCompletionFact=z.strictObject({observedAtHostMs:timestamp,dataLossOccurred:z.boolean().optional(),stream:text.optional(),traceFormat:z.enum(['json','proto']).optional(),streamCompression:z.enum(['none','gzip']).optional()});
export const comparisonTraceAuxiliarySchema = z.strictObject({...comparisonIdentityShape,cap:z.literal(256),observedCallbacks:count,retainedCallbacks:count.max(256),droppedCallbacks:count,invalidCallbacks:count,status:z.enum(['complete','partial']),reason:reason.optional(),completion:availability(traceCompletionFact)}).superRefine((v,ctx)=>{
  if(v.observedCallbacks!==v.retainedCallbacks+v.droppedCallbacks+v.invalidCallbacks) issue(ctx,'Trace callback accounting must agree');
  // Invalid callbacks consume ordinals in the first256 inspected cohort; later callbacks are uninspected drops.
  if(v.retainedCallbacks+v.invalidCallbacks>256 || v.droppedCallbacks!==Math.max(0,v.observedCallbacks-256)) issue(ctx,'Trace callback admission must use the first256 observed callbacks');
  if(v.status==='partial' ? v.reason===undefined : v.reason!==undefined) issue(ctx,'Trace auxiliary status requires explicit partial reason');
  if(v.status==='complete' && (v.droppedCallbacks>0 || v.invalidCallbacks>0 || v.completion.status!=='available' || v.completion.value.dataLossOccurred!==false || !v.completion.value.stream || v.completion.value.traceFormat==='proto' || v.completion.value.streamCompression==='gzip')) issue(ctx,'Complete trace auxiliary requires actual supported completion without loss');
});
export type ComparisonTraceAuxiliary = z.infer<typeof comparisonTraceAuxiliarySchema>;
const nativeCompletion = z.discriminatedUnion('status',[
  missingFact,z.strictObject({status:z.literal('acknowledged'),completionAtHostMs:timestamp,latencyMs:timestamp}),
  z.strictObject({status:z.literal('rejected'),completionAtHostMs:timestamp,latencyMs:timestamp,message:reason}),
]);
const nativeResult=z.strictObject({recipeId:text,index:count,kind:z.enum(['wheel','composer','return-control']),invocationAtHostMs:timestamp,completion:nativeCompletion}).superRefine((v,ctx)=>{
  if(v.completion.status!=='unavailable' && (v.completion.completionAtHostMs<v.invocationAtHostMs || v.completion.latencyMs!==v.completion.completionAtHostMs-v.invocationAtHostMs)) issue(ctx,'Native settlement must use exact same-host arithmetic');
});
export const comparisonNativeDispatchResultsSchema = z.strictObject({...comparisonIdentityShape,status:z.enum(['complete','partial']),reason:reason.optional(),hostDispatches:z.array(comparisonHostDispatchSchema).max(14),results:z.array(nativeResult).max(14)}).superRefine((v,ctx)=>{
  if(v.status==='partial' ? v.reason===undefined : v.reason!==undefined) issue(ctx,'Native auxiliary status requires explicit partial reason');
  const key=(r:{recipeId:string;index:number;kind:string})=>`${r.recipeId}:${r.index}:${r.kind}`;
  unique(v.hostDispatches.map(key),ctx,'native dispatch'); unique(v.results.map(key),ctx,'native result');
  const dispatches=new Map(v.hostDispatches.map(d=>[key(d),d]));
  for(const result of v.results) if(dispatches.get(key(result))?.hostMonotonicMs!==result.invocationAtHostMs) issue(ctx,'Native result must bind to an actual dispatch invocation');
  if(v.status==='complete' && (v.results.length!==v.hostDispatches.length || v.results.some(r=>r.completion.status==='unavailable'))) issue(ctx,'Complete native auxiliary requires actual settlement for every invoked action');
});
export type ComparisonNativeDispatchResults = z.infer<typeof comparisonNativeDispatchResultsSchema>;
const measuredBytes=z.strictObject({byteLength:count,sha256:hash});
const buildHashes=z.record(comparisonArtifactPathSchema,hash).refine(v=>Object.keys(v).length>0,'Build input inventory must be nonempty');
const buildToolShape={name:text,version:text,resolutionPath:comparisonArtifactPathSchema,integrity:z.string().regex(/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/)};
/** Measured metadata identifies package.json bytes, independently of tarball integrity. */
export const comparisonInstrumentationBuildSchema=z.strictObject({
  kind:z.literal('comparison-instrumentation-build'),formatVersion:z.literal(1),
  sourceHashes:buildHashes,compiledHashes:buildHashes,
  compiler:z.strictObject({...buildToolShape,nodeVersion:text}),
  nativeCompiler:z.strictObject({...buildToolShape,platform:text,architecture:text,executablePath:comparisonArtifactPathSchema}),
  compilerPackageMetadata:measuredBytes,nativeCompilerPackageMetadata:measuredBytes,
});
export type ComparisonInstrumentationBuild=z.infer<typeof comparisonInstrumentationBuildSchema>;
const provenanceMember=z.strictObject({role:z.enum(['build-record','build-source','served-asset','installed-package-metadata','instrumentation-source','instrumentation-build-record','instrumentation-compiled-input']),key:comparisonArtifactPathSchema,path:comparisonArtifactPathSchema,originalSha256:hash.optional(),beforeCopy:availability(measuredBytes),copied:availability(measuredBytes),afterCopy:availability(measuredBytes),status:z.enum(['complete','partial']),reason:reason.optional()}).superRefine((v,ctx)=>{
  if(v.status==='partial' ? v.reason===undefined : v.reason!==undefined) issue(ctx,'Provenance member requires explicit partial reason');
  const expected=v.role==='build-record' ? 'provenance/build-evidence.json' : v.role==='build-source' ? `provenance/source/${v.key}` : v.role==='served-asset' ? `provenance/assets/${v.key}` : v.role==='installed-package-metadata' ? `provenance/packages/${v.key}/package.json` : v.role==='instrumentation-build-record' ? 'instrumentation/build-evidence.json' : v.role==='instrumentation-compiled-input' ? `instrumentation/compiled/${v.key}` : `instrumentation/source/${v.key}`;
  if(v.path!==expected || v.role==='build-record' && v.key!=='.build-evidence.json' || v.role==='instrumentation-build-record' && v.key!=='packages/runner/.comparison-build-evidence.json') issue(ctx,'Provenance role must retain its exact deterministic original key');
  const originalRole=v.role==='build-source' || v.role==='served-asset' || v.role==='instrumentation-source' || v.role==='instrumentation-compiled-input';
  if(!originalRole && v.originalSha256!==undefined) issue(ctx,'This provenance role has no original inventory byte digest');
  if(v.status==='complete') {
    if(originalRole && v.originalSha256===undefined) issue(ctx,'Complete source acquisition requires the original digest');
    if(v.beforeCopy.status!=='available' || v.copied.status!=='available' || v.afterCopy.status!=='available') issue(ctx,'Complete acquisition requires measured before/copy/after facts');
    else if(v.beforeCopy.value.byteLength!==v.copied.value.byteLength || v.beforeCopy.value.byteLength!==v.afterCopy.value.byteLength || v.beforeCopy.value.sha256!==v.copied.value.sha256 || v.beforeCopy.value.sha256!==v.afterCopy.value.sha256 || originalRole && v.originalSha256!==v.copied.value.sha256) issue(ctx,'Acquired bytes must match genuine original and all measured stages');
  }
});
export const comparisonProvenanceAcquisitionSchema = z.strictObject({...comparisonIdentityShape,status:z.enum(['complete','partial']),reason:reason.optional(),members:z.array(provenanceMember).max(4096)}).superRefine((v,ctx)=>{
  unique(v.members.map(m=>m.path),ctx,'provenance member'); unique(v.members.map(m=>`${m.role}:${m.key}`),ctx,'provenance original key');
  if(v.status==='partial' ? v.reason===undefined : v.reason!==undefined || v.members.some(m=>m.status==='partial')) issue(ctx,'Provenance status must preserve partial acquisition');
});
export type ComparisonProvenanceAcquisition = z.infer<typeof comparisonProvenanceAcquisitionSchema>;
const invocationClaimSchema=z.strictObject({...comparisonVersionShape,kind:z.literal('invocation-ownership-claim'),invocationId:z.uuid(),createdAt:isoTime,purpose:z.enum(['publication','conformance']),configuration:comparisonInvocationSchema});
const datasetMember=z.strictObject({path:comparisonArtifactPathSchema,byteLength:count,sha256:hash});
const datasetSlot=z.strictObject({identity:comparisonIdentitySchema,artifactDirectory:comparisonArtifactPathSchema,status:z.enum(['valid','invalid','failed'])});
function ancestorPaths(path:string):string[] {const parts=path.split('/'); return parts.slice(0,-1).map((_,i)=>parts.slice(0,i+1).join('/'));}
function sortedUnique(values:readonly string[],ctx:z.RefinementCtx,label:string) {
  unique(values,ctx,label); if(values.some((path,i)=>i>0 && path<values[i-1]!)) issue(ctx,`${label} must be sorted`);
}
export const comparisonDatasetInventorySchema=z.strictObject({
  ...comparisonVersionShape,invocationId:z.uuid(),status:z.enum(['sealed','partial']),reason:reason.optional(),configuration:comparisonInvocationSchema,
  invocationClaim:invocationClaimSchema,invocationLedger:comparisonCaptureInvocationSchema,root:z.literal('.'),
  ledger:z.strictObject({path:z.literal('invocation.json'),byteLength:count,sha256:hash}),
  members:z.array(datasetMember).max(16+36*4096),absentMembers:z.array(unavailablePath).max(16+36*4096),directories:z.array(comparisonArtifactPathSchema),slots:z.array(datasetSlot).max(36),
  ownershipSettled:z.union([z.boolean(),missingFact]),finalizationSucceeded:z.union([z.boolean(),missingFact]),
}).superRefine((v,ctx)=>{
  const config=v.configuration, ledger=v.invocationLedger, claim=v.invocationClaim;
  if(v.status==='partial' ? v.reason===undefined : v.reason!==undefined || v.ownershipSettled!==true || v.finalizationSucceeded!==true) issue(ctx,'Dataset status must preserve actual filesystem completion facts');
  if(config.adapterProfiles.length!==1 || config.adapterProfiles[0]!=='threadplane-langgraph-custom-transport' || config.rounds>3 || config.mode==='headed' && config.rounds!==3) issue(ctx,'Dataset configuration must be the bounded supported capture invocation');
  const sameConfig=(a:typeof config,b:typeof config)=>a.seed===b.seed && a.rounds===b.rounds && a.mode===b.mode && a.adapterProfiles.length===b.adapterProfiles.length && a.adapterProfiles.every((p,i)=>p===b.adapterProfiles[i]) && a.caseOrder.length===b.caseOrder.length && a.caseOrder.every((c,i)=>c===b.caseOrder[i]);
  if(claim.invocationId!==v.invocationId || !sameConfig(config,claim.configuration) || !sameConfig(config,ledger.configuration) || claim.purpose!==ledger.purpose || claim.createdAt!==ledger.createdAt || claim.purpose!==(config.mode==='headed'?'publication':'conformance')) issue(ctx,'Dataset claim, configuration and ledger identities must agree');
  if(ledger.status==='pending' || ledger.runs.some(r=>r.status==='scheduled' || r.status==='running')) issue(ctx,'Dataset requires the actual terminal invocation ledger');
  if(v.slots.length!==ledger.runs.length) issue(ctx,'Dataset must retain every scheduled slot');
  unique(v.slots.map(s=>s.artifactDirectory),ctx,'dataset slot directory');
  v.slots.forEach((slot,i)=>{
    const row=ledger.runs[i];
    if(!row || slot.artifactDirectory!==row.artifactDirectory || slot.status!==row.status || !sameIdentityFacts(slot.identity,{...v,...row})) issue(ctx,'Dataset slot differs from terminal ledger');
  });
  sortedUnique(v.members.map(m=>m.path),ctx,'dataset member'); sortedUnique(v.absentMembers.map(m=>m.path),ctx,'dataset absent member'); sortedUnique(v.directories,ctx,'dataset directory');
  unique([...v.members.map(m=>m.path),...v.absentMembers.map(m=>m.path)],ctx,'dataset present/absent member');
  const limit=16+v.slots.length*4096;
  if(v.members.length+v.absentMembers.length>limit) issue(ctx,'Dataset candidate count exceeds declared writer capacities');
  const ledgerMember=v.members.find(m=>m.path===v.ledger.path);
  if(!ledgerMember || ledgerMember.byteLength!==v.ledger.byteLength || ledgerMember.sha256!==v.ledger.sha256 || !v.members.some(m=>m.path==='invocation-claim.json')) issue(ctx,'Dataset ledger and claim require actual bound member entries');
  const slotPrefixes=v.slots.map(s=>s.artifactDirectory+'/');
  const presentPaths=new Set(v.members.map(member=>member.path)), absentPaths=new Set(v.absentMembers.map(member=>member.path));
  for(const prefix of slotPrefixes) {
    for(const name of ['descriptor.json','validation.json','exceptions.json']) {
      const path=prefix+name;
      if(!presentPaths.has(path) && (v.status==='sealed' || !absentPaths.has(path))) issue(ctx,'Dataset must bind every scheduled baseline raw member or explicit partial absence');
    }
    const manifests=[prefix+'evidence.json',prefix+'raw-inventory.json'];
    const retainedManifests=manifests.filter(path=>presentPaths.has(path)).length;
    if(v.status==='sealed' && retainedManifests!==1) issue(ctx,'Sealed dataset requires exactly one actual inventory manifest per scheduled slot');
  }
  if(v.status==='sealed' && v.members.some(member=>member.path==='dataset-finalization-failure.json' || slotPrefixes.some(prefix=>member.path===prefix+'finalization-status.json'))) issue(ctx,'Known finalization failure members prohibit sealed collection');
  const rootNames=new Set(['invocation-claim.json','invocation.json','dataset-finalization-failure.json']);
  const rootPaths:string[]=[], slotPaths=new Map(slotPrefixes.map(prefix=>[prefix,[] as string[]]));
  for(const member of [...v.members,...v.absentMembers]) {
    const path=member.path, original=path.replace(/\.[a-f0-9-]{36}\.tmp$/,'');
    if(path==='dataset-seal.json' || /^dataset-seal\.json\.[a-f0-9-]{36}\.tmp$/.test(path) || analysisOutputs.has(path.split('/').at(-1)!)) {issue(ctx,'Dataset inventory excludes seal and derived output');continue;}
    const prefix=slotPrefixes.find(prefix=>path.startsWith(prefix));
    if(prefix) {
      const local=path.slice(prefix.length), raw=local.replace(/\.[a-f0-9-]{36}\.tmp$/,'');
      if(!rawSlotPath(local) && raw!=='evidence.json' && raw!=='raw-inventory.json') issue(ctx,'Dataset member must be a declared slot raw member');
      slotPaths.get(prefix)!.push(path);
    } else {rootPaths.push(path); if(!rootNames.has(original)) issue(ctx,'Dataset member must bind to a declared root or slot');}
  }
  if(rootPaths.length>16 || [...slotPaths.values()].some(paths=>paths.length>4096)) issue(ctx,'Dataset must respect each root16/slot4096 registry');
  const requiredDirectories=new Set([...v.slots.flatMap(s=>[...ancestorPaths(s.artifactDirectory),s.artifactDirectory]),...v.members.flatMap(m=>ancestorPaths(m.path))]);
  const allowedDirectories=new Set([...requiredDirectories,...v.absentMembers.flatMap(m=>ancestorPaths(m.path))]);
  const declaredDirectories=new Set(v.directories);
  if(v.directories.length>allowedDirectories.size || v.directories.some(dir=>!allowedDirectories.has(dir)) || [...requiredDirectories].some(dir=>!declaredDirectories.has(dir))) issue(ctx,'Dataset directories must bind scheduled slots and actually present candidate ancestors');
});
export type ComparisonDatasetInventory = z.infer<typeof comparisonDatasetInventorySchema>;
