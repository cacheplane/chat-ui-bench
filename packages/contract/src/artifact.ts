import { z } from 'zod';
import { presentationEvidenceSchema, rendererPresentationSchema } from './presentation.js';
const text = z.string().min(1);
const finite = z.number().finite();
const timestamp = finite.nonnegative();
export const runStatusSchema = z.enum(['valid', 'invalid', 'failed']);
export type RunStatus = z.infer<typeof runStatusSchema>;
export const clockDomainSchema = z.enum(['producer-monotonic-ms', 'page-performance-ms']);
export type ClockDomain = z.infer<typeof clockDomainSchema>;
export const phaseSchema = z.enum(['setup', 'streaming-auto-follow', 'composer-input', 'gesture-scroll', 'return-to-bottom', 'validation', 'retention', 'disposal']);
export type Phase = z.infer<typeof phaseSchema>;
export type Metric<T = number> = { status: 'available'; value: T; unit: string; evidence: string[] } | { status: 'unavailable'; reason: string };
export const metricSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('available'), value: finite, unit: text, evidence: z.array(text).min(1) }),
  z.strictObject({ status: z.literal('unavailable'), reason: text }),
]);
export const availabilitySchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('available'), value: z.json() }),
  z.strictObject({ status: z.literal('unavailable'), reason: text }),
]);
export type Availability<T> = { status: 'available'; value: T } | { status: 'unavailable'; reason: string };
export const runMetricsSchema = z.strictObject({
  schemaVersion: z.literal(1), analyzerVersion: text, status: runStatusSchema,
  metrics: z.record(text, metricSchema),
  rendererPresentation: rendererPresentationSchema.optional(),
  diagnostics: z.record(text, z.strictObject({ status: z.literal('available'), value: finite, unit: text, evidence: z.array(text).min(1), scored: z.literal(false) })),
}).superRefine((run, ctx) => {
  if (run.status !== 'valid' && Object.values(run.metrics).some(m => m.status === 'available')) ctx.addIssue({ code: 'custom', message: 'Invalid or failed runs cannot contain scored performance values' });
  if (run.status !== 'valid' && run.rendererPresentation?.status === 'available' && run.rendererPresentation.value.phases.some(p => p.rendererVisualUpdateFps.status === 'available' || p.presentationIntervals.status === 'available')) ctx.addIssue({ code: 'custom', message: 'Invalid or failed runs cannot contain scored presentation values' });
});
export type RunMetrics = z.infer<typeof runMetricsSchema>;
export const observationSchema = z.strictObject({
  schemaVersion: z.literal(1), kind: text, clockDomain: clockDomainSchema, repetition: text, phase: phaseSchema,
  sequence: z.number().int().nonnegative().nullable(), timestampMs: timestamp, data: z.record(z.string(), z.json()),
});
export type Observation = z.infer<typeof observationSchema>;
export interface ClockPoint { clockDomain: ClockDomain; timestampMs: number }
export function elapsedBetween(start: ClockPoint, end: ClockPoint): number {
  if (start.clockDomain !== end.clockDomain) throw new Error('Cannot subtract different clock domains');
  if (!Number.isFinite(start.timestampMs) || !Number.isFinite(end.timestampMs)) throw new Error('Nonfinite clock timestamp');
  return end.timestampMs - start.timestampMs;
}
export const validationSchema = z.strictObject({
  schemaVersion: z.literal(1), status: runStatusSchema, reasons: z.array(text), checks: z.record(text, z.boolean()),
}).superRefine((v, ctx) => {
  if (v.status !== 'valid' && !v.reasons.length) ctx.addIssue({ code: 'custom', message: 'Invalid/failed validation needs a reason' });
});
export type Validation = z.infer<typeof validationSchema>;
export const evidenceSchema = z.strictObject({
  schemaVersion: z.literal(1), collectorVersion: text, files: z.record(text, text),
  trace: z.strictObject({ format: z.literal('cdp-json'), categories: z.array(text).min(1), complete: z.boolean(), lossReason: text.optional(), presentation: presentationEvidenceSchema.optional() }).optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1), suiteVersion: text, analyzerVersion: text, collectorVersion: text,
  repetition: text, scenarioId: text,
  git: z.strictObject({ revision: text, dirty: z.boolean() }),
  fixture: z.strictObject({ sha256, file: text }), assets: z.record(text, sha256),
  browser: z.strictObject({ executable: text, version: text, revision: text, flags: z.array(z.string()) }),
  environment: z.strictObject({ os: text, architecture: text, cpu: availabilitySchema, gpu: availabilitySchema }),
  adapter: z.strictObject({ id: text, configuration: z.record(z.string(), z.json()) }),
  configuration: z.record(z.string(), z.json()), mode: z.enum(['headed', 'headless']),
  viewport: z.strictObject({ width: z.number().int().positive(), height: z.number().int().positive(), deviceScaleFactor: finite.positive() }),
  cachePolicy: z.literal('fresh-profile-empty-cache-assets-preloaded'),
});
export type Manifest = z.infer<typeof manifestSchema>;
