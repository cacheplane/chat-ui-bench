import { z } from 'zod';
import { messageSchema, replayEventSchema, payloadBytes, canonicalSerialize, type ReplayEvent } from './fixture.js';

export const LONG_THREAD_SCHEMA_VERSION = 2 as const;
export const LONG_THREAD_SUITE = 'long-thread-prose-v1' as const;
export const LONG_THREAD_GENERATOR = 'long-thread-prose-v1' as const;
export const LONG_THREAD_HISTORY_COUNTS = [100, 1000, 10000] as const;
export const LONG_THREAD_RESPONSE_BYTES = [6400, 262144] as const;
export const longThreadJourneySchema = z.enum(['follow', 'history-reading']);
export type LongThreadJourney = z.infer<typeof longThreadJourneySchema>;
export const longThreadWorkloadSchema = z.strictObject({
  suite: z.literal(LONG_THREAD_SUITE), generator: z.literal(LONG_THREAD_GENERATOR),
  seed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  historyCount: z.union([z.literal(100), z.literal(1000), z.literal(10000)]),
  historyMessageBytes: z.literal(512), totalHistoryBytes: z.number().int().positive(),
  responseBytes: z.union([z.literal(6400), z.literal(262144)]),
  deltaCount: z.literal(200), deltaIntervalMs: z.literal(50), journey: longThreadJourneySchema,
  chunkBytes: z.array(z.number().int().positive()).length(200),
}).superRefine((w, ctx) => {
  if (w.totalHistoryBytes !== w.historyCount * w.historyMessageBytes) ctx.addIssue({code: 'custom', message: 'History byte total mismatch'});
  const chunks = splitLengths(w.responseBytes);
  if (w.chunkBytes.some((n, i) => n !== chunks[i])) ctx.addIssue({code: 'custom', message: 'Noncanonical chunk distribution'});
});
export type LongThreadWorkload = z.infer<typeof longThreadWorkloadSchema>;
const prose = /^[A-Za-z0-9 .,]*[A-Za-z0-9.]$/;
export const longThreadFixtureSchema = z.strictObject({
  schemaVersion: z.literal(2), scenarioId: z.string().min(1), workload: longThreadWorkloadSchema,
  history: z.array(messageSchema), events: z.array(replayEventSchema).length(202),
}).superRefine((f, ctx) => {
  const issue = (message: string) => ctx.addIssue({code: 'custom', message});
  const w = f.workload;
  if (f.scenarioId !== longThreadScenarioId(w)) issue('Scenario identity mismatch');
  if (f.history.length !== w.historyCount) issue('History count mismatch');
  const ids = new Set<string>();
  f.history.forEach((m, i) => {
    if (ids.has(m.id)) issue('Duplicate history ID');
    ids.add(m.id);
    if (m.role !== (i % 2 === 0 ? 'assistant' : 'user')) issue('History must alternate and end with user');
    if (payloadBytes(m.text) !== 512 || !prose.test(m.text)) issue('History must be 512 bytes of inert one paragraph ASCII prose');
  });
  const responseId = f.events[0]?.messageId;
  if (!responseId || ids.has(responseId)) issue('Response ID conflicts with history');
  f.events.forEach((e, i) => {
    const expectedType = i === 0 ? 'assistant-start' : i === 201 ? 'assistant-complete' : 'text-delta';
    if (e.sequence !== i || e.type !== expectedType || e.messageId !== responseId || e.scheduledMs !== Math.min(i, 200) * 50) issue('Invalid replay lifecycle or schedule');
    if (e.type === 'text-delta' && (payloadBytes(e.text) !== w.chunkBytes[i - 1] || !/[^ \t\n\r\f\v]/.test(e.text) || !/^[A-Za-z0-9 .,]+$/.test(e.text))) issue('Invalid delta content or byte length');
  });
  const response = f.events.filter(e => e.type === 'text-delta').map(e => e.text).join('');
  if (payloadBytes(response) !== w.responseBytes || !prose.test(response)) issue('Response byte total or prose mismatch');
});
export type LongThreadFixture = z.infer<typeof longThreadFixtureSchema>;
/** Structural lifecycle/prose validation. It does not establish generator provenance. */
export function validateLongThreadFixture(input: unknown): LongThreadFixture { return longThreadFixtureSchema.parse(input); }
/** Regenerate every ID and text byte from metadata before serving or accepting a canonical performance fixture. */
export function validateCanonicalLongThreadFixture(input: unknown): LongThreadFixture {
  const fixture = validateLongThreadFixture(input);
  const expected = createLongThreadFixture(fixture.workload);
  if (canonicalSerialize(fixture) !== canonicalSerialize(expected)) throw new Error('Fixture does not match canonical generator output');
  return fixture;
}

export interface LongThreadFixtureOptions {
  historyCount: LongThreadWorkload['historyCount']; responseBytes: LongThreadWorkload['responseBytes'];
  journey: LongThreadJourney; seed?: number;
}
function splitLengths(bytes: number): number[] {
  const base = Math.floor(bytes / 200), remainder = bytes % 200;
  return Array.from({length: 200}, (_, i) => base + (i < remainder ? 1 : 0));
}
export function longThreadScenarioId(w: Pick<LongThreadWorkload, 'historyCount' | 'responseBytes' | 'journey' | 'seed'>): string {
  return `${LONG_THREAD_SUITE}-h${w.historyCount}-r${w.responseBytes}-${w.journey}-s${w.seed}`;
}
/** Full round order without allocating retained histories. */
export function longThreadCaseOrder(seed = 1): string[] {
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(seed);
  return LONG_THREAD_HISTORY_COUNTS.flatMap(historyCount => LONG_THREAD_RESPONSE_BYTES.flatMap(responseBytes =>
    (['follow', 'history-reading'] as const).map(journey => longThreadScenarioId({historyCount, responseBytes, journey, seed}))));
}
/** Fixed ASCII words and numeric identity make every byte budget platform independent. */
function makeProse(bytes: number, seed: number, ordinal: number): string {
  const sentence = `The reader considers the calm conversation number ${ordinal} from collection ${seed}. Clear words describe a familiar place and a thoughtful reply. `;
  return (sentence.repeat(Math.ceil(bytes / sentence.length)).slice(0, bytes - 1).replace(/ $/, 'a')) + '.';
}
export function createLongThreadFixture(options: LongThreadFixtureOptions): LongThreadFixture {
  const workload = longThreadWorkloadSchema.parse({
    suite: LONG_THREAD_SUITE, generator: LONG_THREAD_GENERATOR, seed: options.seed ?? 1,
    historyCount: options.historyCount, historyMessageBytes: 512, totalHistoryBytes: options.historyCount * 512,
    responseBytes: options.responseBytes, deltaCount: 200, deltaIntervalMs: 50, journey: options.journey,
    chunkBytes: splitLengths(options.responseBytes),
  });
  const messageId = `response-${workload.historyCount}`;
  const response = makeProse(workload.responseBytes, workload.seed, workload.historyCount);
  let offset = 0;
  const deltas: ReplayEvent[] = workload.chunkBytes.map((bytes, i) => {
    const text = response.slice(offset, offset + bytes); offset += bytes;
    return {sequence: i + 1, scheduledMs: (i + 1) * 50, messageId, type: 'text-delta', text};
  });
  return validateLongThreadFixture({
    schemaVersion: 2, scenarioId: longThreadScenarioId(workload), workload,
    history: Array.from({length: workload.historyCount}, (_, i) => ({id: `history-${i}`, role: i % 2 === 0 ? 'assistant' : 'user', status: 'complete', text: makeProse(512, workload.seed, i)})),
    events: [{sequence: 0, scheduledMs: 0, messageId, type: 'assistant-start', text: ''}, ...deltas,
      {sequence: 201, scheduledMs: 10000, messageId, type: 'assistant-complete', text: ''}],
  });
}
export function createLongThreadMatrix(seed = 1): LongThreadFixture[] {
  return LONG_THREAD_HISTORY_COUNTS.flatMap(historyCount => LONG_THREAD_RESPONSE_BYTES.flatMap(responseBytes =>
    (['follow', 'history-reading'] as const).map(journey => createLongThreadFixture({historyCount, responseBytes, journey, seed}))));
}
/** DOM-only projection: ASCII whitespace collapse and ASCII boundary trim. Never use for raw runtime content. */
export function projectProseDomText(text: string): string { return text.replace(/[ \t\n\r\f\v]+/g, ' ').replace(/^ | $/g, ''); }
