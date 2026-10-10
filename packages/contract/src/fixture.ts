import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const messageSchema = z.strictObject({
  id: z.string().min(1), role: z.enum(['user', 'assistant']), text: z.string(), status: z.literal('complete'),
});
export type Message = z.infer<typeof messageSchema>;
export const replayEventSchema = z.strictObject({
  sequence: z.number().int().nonnegative(), scheduledMs: z.number().finite().nonnegative(), messageId: z.string().min(1),
  type: z.enum(['assistant-start', 'text-delta', 'assistant-complete']), text: z.string(),
}).superRefine((event, ctx) => {
  if (event.type !== 'text-delta' && event.text !== '') ctx.addIssue({ code: 'custom', message: 'Lifecycle events must have empty text' });
});
export type ReplayEvent = z.infer<typeof replayEventSchema>;
export const fixtureSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION), scenarioId: z.string().min(1),
  generator: z.strictObject({ version: z.string().min(1), seed: z.number().int().nonnegative() }).optional(),
  history: z.array(messageSchema), events: z.array(replayEventSchema).min(1),
}).superRefine((fixture, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const ids = new Set<string>();
  for (const message of fixture.history) {
    if (ids.has(message.id)) issue(`Duplicate history ID: ${message.id}`);
    ids.add(message.id);
  }
  let active: string | null = null;
  let completed = false;
  let lastTime = -1;
  let lastSequence = -1;
  for (const event of fixture.events) {
    if (completed) issue('Events after assistant completion are not allowed');
    if (event.scheduledMs < lastTime) issue('Decreasing schedule');
    if (event.sequence <= lastSequence) issue('Duplicate or decreasing sequence');
    lastTime = event.scheduledMs;
    lastSequence = event.sequence;
    if (event.type === 'assistant-start') {
      if (active !== null || ids.has(event.messageId)) issue(`Invalid assistant start: ${event.messageId}`);
      ids.add(event.messageId);
      active = event.messageId;
    } else {
      if (active !== event.messageId) issue(`Unknown or inactive message ID: ${event.messageId}`);
      if (event.type === 'assistant-complete') { active = null; completed = true; }
    }
  }
  if (active !== null) issue('Missing assistant completion');
}).transform(fixture => {
  if (fixture.generator === undefined) delete fixture.generator;
  return fixture;
});
export type Fixture = z.infer<typeof fixtureSchema>;
export function validateFixture(input: unknown): Fixture { return fixtureSchema.parse(input); }
export function payloadBytes(text: string): number { return new TextEncoder().encode(text).byteLength; }

/** Sorted recursively, without whitespace; rejects values JSON would silently discard. */
export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new TypeError('Canonical JSON rejects sparse arrays');
    }
    return '[' + value.map(canonicalSerialize).join(',') + ']';
  }
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalSerialize((value as Record<string, unknown>)[key])).join(',') + '}';
  }
  throw new TypeError('Canonical JSON only accepts finite JSON values');
}
export function prefixesFor(chunks: readonly string[]): string[] {
  let prefix = '';
  return chunks.map(chunk => prefix += chunk);
}
export interface PrefixCheckpoint { sequence: number; prefix: string; characterLength: number; utf8Bytes: number }
export function prefixCheckpoints(chunks: readonly Pick<ReplayEvent, 'sequence' | 'text'>[]): PrefixCheckpoint[] {
  const prefixes = prefixesFor(chunks.map(chunk => chunk.text));
  return chunks.map((chunk, i) => ({ sequence: chunk.sequence, prefix: prefixes[i]!, characterLength: prefixes[i]!.length, utf8Bytes: payloadBytes(prefixes[i]!) }));
}
export function createCalibrationFixture(seed = 1): Fixture {
  const messageId = 'response-100';
  return validateFixture({
    schemaVersion: 1, scenarioId: 'calibration-v1', generator: { version: '1', seed },
    history: Array.from({ length: 100 }, (_, i) => ({ id: `history-${i}`, role: i % 2 ? 'assistant' : 'user', status: 'complete', text: `Message ${i}: fixed calibration history ${seed}. ` + 'Readable historical context. '.repeat(8) })),
    events: [
      { sequence: 0, scheduledMs: 0, messageId, type: 'assistant-start', text: '' },
      ...Array.from({ length: 200 }, (_, i) => ({ sequence: i + 1, scheduledMs: (i + 1) * 50, messageId, type: 'text-delta', text: `[${seed}:${i + 1}] ${i % 10 === 0 ? '🙂' : 'text'} ` })),
      { sequence: 201, scheduledMs: 10000, messageId, type: 'assistant-complete', text: '' },
    ],
  });
}
