import { z } from 'zod';
import { phaseInstanceIdSchema, rendererVisualUpdateFpsSchema, presentationIntervalsSchema, PRESENTATION_CAPABILITY, PRESENTATION_CONTRACT_VERSION } from './presentation.js';
import { comparisonArtifactPathSchema, comparisonUnavailableSchema, comparisonPhaseSchema } from './comparison.js';

export const comparisonScoredPresentationPhaseSchema = z.enum(['streaming-follow', 'composer-input', 'history-reading', 'return-to-response']);
export type ComparisonScoredPresentationPhase = z.infer<typeof comparisonScoredPresentationPhaseSchema>;
export function comparisonPhaseMarks(phase: string, instanceId: string) {
  comparisonPhaseSchema.parse(phase);
  phaseInstanceIdSchema.parse(instanceId);
  return {startMark: `bench:comparison:${phase}:${instanceId}:start`, endMark: `bench:comparison:${phase}:${instanceId}:end`};
}
const inputShape = {phase: comparisonScoredPresentationPhaseSchema, instanceId: phaseInstanceIdSchema, startMark: z.string().min(1), endMark: z.string().min(1)};
function matchingMarks(v: {phase: string; instanceId: string; startMark: string; endMark: string}) {
  const marks = comparisonPhaseMarks(v.phase, v.instanceId);
  return v.startMark === marks.startMark && v.endMark === marks.endMark;
}
export const comparisonPresentationPhaseInputSchema = z.strictObject(inputShape).refine(matchingMarks, 'Comparison marks must match phase and instance');
export type ComparisonPresentationPhaseInput = z.infer<typeof comparisonPresentationPhaseInputSchema>;
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = count;
export const comparisonRendererPresentationPhaseSchema = z.strictObject({
  ...inputShape, startUs: timestamp, endUs: timestamp, durationUs: timestamp.refine(n => n > 0),
  target: z.strictObject({frameId: z.string().min(1), pid: count, tid: count}), boundaryExcludedPairCount: count, nonPresentedPairCount: count,
  rendererVisualUpdateFps: rendererVisualUpdateFpsSchema, presentationIntervals: presentationIntervalsSchema,
}).superRefine((v, ctx) => {
  const fps = v.rendererVisualUpdateFps, intervals = v.presentationIntervals;
  if (!matchingMarks(v)) ctx.addIssue({code: 'custom', message: 'Comparison marks must match phase and instance'});
  if (v.endUs - v.startUs !== v.durationUs) ctx.addIssue({code: 'custom', message: 'Phase duration must equal end minus start'});
  if (fps.status === 'available' && fps.denominatorUs !== v.durationUs) ctx.addIssue({code: 'custom', message: 'FPS denominator must be the complete phase duration'});
  if (intervals.status === 'available' && (fps.status !== 'available' || fps.numerator !== intervals.timestampsUs.length || intervals.timestampsUs.some(t => t < v.startUs || t >= v.endUs))) ctx.addIssue({code: 'custom', message: 'Interval feedback must agree with phase FPS numerator and exclusive boundaries'});
  if (fps.status === 'available' && fps.numerator > 1 && intervals.status === 'unavailable') ctx.addIssue({code: 'custom', message: 'Multiple deliveries require interval evidence'});
  for (const measurement of [fps, intervals]) if (measurement.status === 'available' && measurement.evidence.some(path => !comparisonArtifactPathSchema.safeParse(path).success)) ctx.addIssue({code: 'custom', message: 'Presentation evidence paths must be normalized'});
});
export const comparisonRendererPresentationSchema = z.discriminatedUnion('status', [comparisonUnavailableSchema, z.strictObject({
  capability: z.literal(PRESENTATION_CAPABILITY), contractVersion: z.literal(PRESENTATION_CONTRACT_VERSION), status: z.literal('available'),
  value: z.strictObject({scope: z.literal('target renderer visual updates'), phases: z.array(comparisonRendererPresentationPhaseSchema).min(1)}),
}).superRefine((v, ctx) => {
  const phases = v.value.phases;
  if (new Set(phases.map(p => p.instanceId)).size !== phases.length) ctx.addIssue({code: 'custom', message: 'Phase instance identities must be unique'});
  if (phases.some((p, i) => i > 0 && p.startUs < phases[i - 1]!.endUs)) ctx.addIssue({code: 'custom', message: 'Presentation phases must be chronological and exclusive'});
})]);
export type ComparisonRendererPresentationPhase = z.infer<typeof comparisonRendererPresentationPhaseSchema>;
export type ComparisonRendererPresentation = z.infer<typeof comparisonRendererPresentationSchema>;
