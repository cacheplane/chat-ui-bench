import { z } from 'zod';

export const PRESENTATION_CAPABILITY = 'rendererVisualUpdateFps' as const;
export const PRESENTATION_CONTRACT_VERSION = '1.1.0' as const;
export const PRESENTATION_BROWSER_REVISION = 'f842f52ef39fd97b449eb27cff414bf05a98ddce' as const;
export const PRESENTATION_BROWSER_VERSION = '156.0.8078.4' as const;
export const PRESENTATION_FRONTEND_REVISION = '2d671c506c4e5f8958b027e26047deb0acfbd7f9' as const;
export const PRESENTATION_FRAME_CATEGORY = 'disabled-by-default-devtools.timeline.frame' as const;
export const PRESENTATION_TRACE_CATEGORIES = ['blink.user_timing', 'devtools.timeline', 'disabled-by-default-devtools.timeline', PRESENTATION_FRAME_CATEGORY, 'toplevel', 'input', 'latencyInfo', 'cc', 'viz', 'benchmark', 'v8', 'v8.execute', 'disabled-by-default-v8.gc'] as const;
export const ACCEPTED_RAW_VERSION_PAIRS = [
  { collectorVersion: '1.0.0', analyzerVersion: '1.0.0' },
  { collectorVersion: '1.1.0', analyzerVersion: '1.1.0' },
] as const;
export const scoredPresentationPhaseSchema = z.enum(['streaming-auto-follow', 'composer-input', 'gesture-scroll', 'return-to-bottom']);
export type ScoredPresentationPhase = z.infer<typeof scoredPresentationPhaseSchema>;
export const phaseInstanceIdSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
export function presentationPhaseMarks(repetition: string, instanceId: string): { startMark: string; endMark: string } {
  phaseInstanceIdSchema.parse(instanceId);
  if (!repetition) throw new Error('Phase repetition must be nonempty');
  return { startMark: `bench:${repetition}:phase:${instanceId}:start`, endMark: `bench:${repetition}:phase:${instanceId}:end` };
}
export interface PresentationPhaseInput { phase: ScoredPresentationPhase; instanceId: string; startMark: string; endMark: string }
const text = z.string().min(1);
const timestamp = z.number().finite().nonnegative().refine(Number.isSafeInteger, 'Trace timestamps must be safe integer microseconds');
const count = z.number().int().nonnegative().refine(Number.isSafeInteger);
// Preserve the actual CDP response, including protocol fields unfamiliar to this version.
// Topology support is decided by the analyzer, not rewritten by this schema.
export interface PresentationFrameTree { frame: { id: string; url: string; [key: string]: unknown }; childFrames?: PresentationFrameTree[] | undefined }
export const presentationFrameTreeSchema: z.ZodType<PresentationFrameTree> = z.lazy(() => z.strictObject({
  frame: z.object({ id: text, url: text }).catchall(z.json()), childFrames: z.array(presentationFrameTreeSchema).optional(),
}));
export const presentationEvidenceSchema = z.strictObject({
  capability: z.literal(PRESENTATION_CAPABILITY), contractVersion: z.literal(PRESENTATION_CONTRACT_VERSION),
  sessionTarget: z.literal('page'), targetId: text, appURL: text,
  frameTree: z.strictObject({ frameTree: presentationFrameTreeSchema }),
  frameTreeCapturePoint: z.literal('before-tracing'), isolatedBrowserProcess: z.boolean(), singleWorkloadPage: z.boolean(),
});
export type PresentationEvidence = z.infer<typeof presentationEvidenceSchema>;
const unavailable = z.strictObject({ status: z.literal('unavailable'), reason: text });
export const rendererVisualUpdateFpsSchema = z.discriminatedUnion('status', [unavailable, z.strictObject({
  status: z.literal('available'), value: z.number().finite().positive(), unit: z.literal('updates/s'), evidence: z.array(text).min(1),
  numerator: count.refine(n => n > 0), denominatorUs: timestamp.refine(n => n > 0),
// Only floating FPS arithmetic has a relative 1e-12 tolerance. Trace timestamps,
// differences and all interval summary values are checked exactly.
}).refine(v => {
  const expected = v.numerator * 1e6 / v.denominatorUs;
  return Math.abs(v.value - expected) <= expected * 1e-12;
}, 'FPS must use the explicit numerator and denominator')]);
export const presentationIntervalsSchema = z.discriminatedUnion('status', [unavailable, z.strictObject({
  status: z.literal('available'), timestampsUs: z.array(timestamp).min(2), intervalsUs: z.array(timestamp.refine(n => n > 0)).min(1),
  median: z.number().finite().positive(), p95: timestamp.refine(n => n > 0), max: timestamp.refine(n => n > 0), unit: z.literal('us'), evidence: z.array(text).min(1),
}).superRefine((v, ctx) => {
  const intervals = v.timestampsUs.slice(1).map((t, i) => t - v.timestampsUs[i]!);
  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  if (intervals.some(n => n <= 0) || intervals.length !== v.intervalsUs.length || intervals.some((n, i) => n !== v.intervalsUs[i]) || v.median !== median || v.p95 !== sorted[Math.ceil(sorted.length * .95) - 1] || v.max !== sorted.at(-1)) ctx.addIssue({ code: 'custom', message: 'Intervals and summaries must describe consecutive distinct chronological feedback' });
})]);
export const rendererPresentationPhaseSchema = z.strictObject({
  phase: scoredPresentationPhaseSchema, instanceId: phaseInstanceIdSchema,
  startUs: timestamp, endUs: timestamp, durationUs: timestamp.refine(n => n > 0),
  target: z.strictObject({ frameId: text, pid: count, tid: count }),
  boundaryExcludedPairCount: count, nonPresentedPairCount: count,
  rendererVisualUpdateFps: rendererVisualUpdateFpsSchema, presentationIntervals: presentationIntervalsSchema,
}).superRefine((v, ctx) => {
  const fps = v.rendererVisualUpdateFps, intervals = v.presentationIntervals;
  if (v.endUs - v.startUs !== v.durationUs) ctx.addIssue({ code: 'custom', message: 'Phase duration must equal end minus start' });
  if (fps.status === 'available' && fps.denominatorUs !== v.durationUs) ctx.addIssue({ code: 'custom', message: 'FPS denominator must be the complete phase duration' });
  if (intervals.status === 'available' && (fps.status !== 'available' || fps.numerator !== intervals.timestampsUs.length || intervals.timestampsUs.some(t => t < v.startUs || t >= v.endUs))) ctx.addIssue({ code: 'custom', message: 'Interval feedback must agree with the phase FPS numerator and boundaries' });
  if (fps.status === 'available' && fps.numerator > 1 && intervals.status === 'unavailable') ctx.addIssue({ code: 'custom', message: 'Multiple deliveries require interval evidence' });
});
export const rendererPresentationSchema = z.discriminatedUnion('status', [unavailable, z.strictObject({
  status: z.literal('available'), value: z.strictObject({ scope: z.literal('target renderer visual updates'), phases: z.array(rendererPresentationPhaseSchema).min(1) }),
}).superRefine((v, ctx) => {
  const ids = v.value.phases.map(p => p.instanceId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Phase instance identities must be unique' });
})]);
export type RendererVisualUpdateFps = z.infer<typeof rendererVisualUpdateFpsSchema>;
export type PresentationIntervals = z.infer<typeof presentationIntervalsSchema>;
export type RendererPresentationPhase = z.infer<typeof rendererPresentationPhaseSchema>;
export type RendererPresentation = z.infer<typeof rendererPresentationSchema>;
