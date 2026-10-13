import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AGUIMock, type AGUIEvent, type AGUIRunAgentInput } from '@copilotkit/aimock/agui';
import { canonicalSerialize, createLongThreadFixture, payloadBytes } from '@chat-ui-bench/contract';
import { compileCanonicalLongThreadFixture, registerCanonicalLongThreadFixture, registerDeterministicErrorFixture, compileCanonicalHistoryRestoreFixture, registerCanonicalHistoryRestoreFixture } from './aimock.js';

const identity = { threadId: 'fixture-thread', runId: 'fixture-run', epochMs: 1700000000000 };
const sourceFixture = () => createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

// Bound reads even when an implementation never closes SSE or exceeds its contract.
async function post(url: string, input: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(3000) });
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 512000) throw new Error('Response byte bound exceeded');
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return { status: response.status, contentType: response.headers.get('content-type'), body: Buffer.concat(chunks).toString('utf8') };
}
function parseSse(body: string): AGUIEvent[] {
  expect(body.endsWith('\n\n')).toBe(true);
  return body.slice(0, -2).split('\n\n').map(record => {
    expect(record.startsWith('data: ')).toBe(true);
    expect(record.split('\n')).toHaveLength(1);
    return JSON.parse(record.slice(6)) as AGUIEvent;
  });
}

describe('canonical AIMock compiler', () => {
  it('projects the canonical history and 202 replay records into 204 explicit synthetic events', () => {
    const source = sourceFixture();
    const compiled = compileCanonicalLongThreadFixture(source, identity);
    expect(compiled.input).toEqual({ threadId: identity.threadId, runId: identity.runId, messages: source.history.map(({ id, role, text }) => ({ id, role, content: text })) });
    expect(compiled.events).toHaveLength(204);
    expect(compiled.events.map(event => event.type)).toEqual(['RUN_STARTED', 'TEXT_MESSAGE_START', ...Array(200).fill('TEXT_MESSAGE_CONTENT'), 'TEXT_MESSAGE_END', 'RUN_FINISHED']);
    expect(compiled.events.map(event => event.timestamp)).toEqual([identity.epochMs, identity.epochMs, ...source.events.slice(1, -1).map(event => identity.epochMs + event.scheduledMs), identity.epochMs + 10000, identity.epochMs + 10000]);
    expect(compiled.events.every(event => event.metadata?.clock === 'synthetic-canonical-replay-ms')).toBe(true);
    expect(compiled.events[1]).toMatchObject({ messageId: 'response-100', role: 'assistant' });
    expect(compiled.events[203]).toMatchObject({ threadId: identity.threadId, runId: identity.runId });
    expect(compiled.digests).toEqual({ sourceSha256: sha(canonicalSerialize(source)), eventsSha256: sha(canonicalSerialize(compiled.events)), responseSha256: sha(source.events.slice(1, -1).map(event => event.text).join('')) });
    expect(compileCanonicalLongThreadFixture(source, identity)).toMatchObject({ input: compiled.input, events: compiled.events, digests: compiled.digests });
  });
  it('matches the full ordered history and identities and rejects malformed inputs safely', () => {
    const compiled = compileCanonicalLongThreadFixture(sourceFixture(), identity);
    const predicate = compiled.fixture.match.predicate!;
    expect(predicate(compiled.input)).toBe(true);
    const changes: unknown[] = [null, {}, [], { ...compiled.input, threadId: 'wrong' }, { ...compiled.input, runId: 'wrong' }, { ...compiled.input, messages: null }, { ...compiled.input, messages: [] }];
    for (const field of ['id', 'role', 'content']) {
      const input = structuredClone(compiled.input);
      Object.assign(input.messages![0]!, { [field]: 'wrong' });
      changes.push(input);
    }
    const reversed = structuredClone(compiled.input); reversed.messages!.reverse(); changes.push(reversed);
    const extra = structuredClone(compiled.input); extra.messages!.push(extra.messages![0]!); changes.push(extra);
    const malformed = structuredClone(compiled.input); malformed.messages![0] = null as never; changes.push(malformed);
    for (const input of changes) expect(predicate(input as AGUIRunAgentInput)).toBe(false);
    compiled.input.messages![0]!.content = 'mutated';
    expect(predicate(compiled.input)).toBe(false);
  });
  it('rejects canonical tampering before identity checks', () => {
    const fixture = sourceFixture(); fixture.history[0]!.text = fixture.history[0]!.text.replace('The', 'Two');
    expect(() => compileCanonicalLongThreadFixture(fixture, { ...identity, threadId: '' })).toThrow(/canonical generator/);
    const changedId = sourceFixture(); changedId.events.forEach(event => event.messageId = 'override');
    expect(() => compileCanonicalLongThreadFixture(changedId, identity)).toThrow(/canonical generator/);
  });
  it('rejects extra message fields and throwing accessors while allowing unrelated run fields', () => {
    const compiled = compileCanonicalLongThreadFixture(sourceFixture(), identity);
    const predicate = compiled.fixture.match.predicate!;
    expect(predicate({ ...compiled.input, state: { visible: true }, tools: [], context: [] })).toBe(true);
    for (const extra of [{ toolCalls: [] }, { toolCallId: 'altered-agent-history' }, { text: 'non-AGUI-field' }]) {
      const input = structuredClone(compiled.input);
      Object.assign(input.messages![0]!, extra);
      expect(predicate(input)).toBe(false);
    }
    const throwingRun = { ...compiled.input };
    Object.defineProperty(throwingRun, 'threadId', { get() { throw new Error('Malformed run accessor'); } });
    expect(predicate(throwingRun)).toBe(false);
    const throwingMessage = structuredClone(compiled.input);
    Object.defineProperty(throwingMessage.messages![0]!, 'content', { get() { throw new Error('Malformed message accessor'); } });
    expect(predicate(throwingMessage)).toBe(false);
  });
  it('bounds identity and the synthetic epoch including the final safe integer sum', () => {
    for (const field of ['threadId', 'runId'] as const) {
      for (const value of ['', ' ', 'x'.repeat(129), 'bad\nidentity']) expect(() => compileCanonicalLongThreadFixture(sourceFixture(), { ...identity, [field]: value })).toThrow();
    }
    for (const epochMs of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER - 9999]) expect(() => compileCanonicalLongThreadFixture(sourceFixture(), { ...identity, epochMs })).toThrow();
    expect(compileCanonicalLongThreadFixture(sourceFixture(), { ...identity, epochMs: Number.MAX_SAFE_INTEGER - 10000 }).events.at(-1)!.timestamp).toBe(Number.MAX_SAFE_INTEGER);
    expect(compileCanonicalLongThreadFixture(sourceFixture(), { ...identity, epochMs: 0 }).events[0]!.timestamp).toBe(0);
  });
  it.each([1000, 10000] as const)('preserves the larger response and %i-message boundary without a loopback matrix', historyCount => {
    const fixture = createLongThreadFixture({ historyCount, responseBytes: 262144, journey: 'history-reading', seed: 42 });
    const compiled = compileCanonicalLongThreadFixture(fixture, identity);
    expect(compiled.input.messages).toHaveLength(historyCount);
    const deltas = compiled.events.filter(event => event.type === 'TEXT_MESSAGE_CONTENT');
    expect(deltas.map(event => payloadBytes(event.delta))).toEqual(fixture.workload.chunkBytes);
    expect(payloadBytes(deltas.map(event => event.delta).join(''))).toBe(262144);
    expect(compiled.events[1]).toMatchObject({ messageId: `response-${historyCount}` });
  });
});

const restoreIdentity = { ...identity, runId: 'fixture-history-restore' };
const expectedRestoreEvents = (source: ReturnType<typeof sourceFixture>): AGUIEvent[] => {
  const clock = (scheduledMs: number) => ({ timestamp: restoreIdentity.epochMs + scheduledMs, metadata: { clock: 'synthetic-canonical-history-restore-ms', epochMs: restoreIdentity.epochMs, scheduledMs } });
  return [
    { type: 'RUN_STARTED', threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, ...clock(0) },
    { type: 'MESSAGES_SNAPSHOT', messages: source.history.map(({ id, role, text }) => ({ id, role, content: text })), ...clock(1) },
    { type: 'RUN_FINISHED', threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, ...clock(2) },
  ];
};

describe('canonical AIMock history restoration', () => {
  it('uses each identity getter once after canonical source admission and emits only admitted values', () => {
    const reads = { threadId: 0, runId: 0, epochMs: 0 };
    const changingIdentity = {
      get threadId() { return ++reads.threadId === 1 ? restoreIdentity.threadId : ''; },
      get runId() { return ++reads.runId === 1 ? restoreIdentity.runId : ''; },
      get epochMs() { return ++reads.epochMs === 1 ? restoreIdentity.epochMs : -100; },
    };
    const invalidSource = sourceFixture();
    invalidSource.history[0]!.text = invalidSource.history[0]!.text.replace('The', 'Two');
    expect(() => compileCanonicalHistoryRestoreFixture(invalidSource, changingIdentity)).toThrow(/canonical generator/);
    expect(reads).toEqual({ threadId: 0, runId: 0, epochMs: 0 });
    const source = sourceFixture();
    const restore = compileCanonicalHistoryRestoreFixture(source, changingIdentity);
    expect(restore.input).toEqual({ threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, messages: [] });
    expect(restore.events).toEqual(expectedRestoreEvents(source));
    expect(reads).toEqual({ threadId: 1, runId: 1, epochMs: 1 });
  });
  it('compiles exactly three full-history events with independently computed restoration digests', () => {
    const source = sourceFixture();
    const continuationBefore = compileCanonicalLongThreadFixture(source, identity);
    const restore = compileCanonicalHistoryRestoreFixture(source, restoreIdentity);
    expect(restore.events).toHaveLength(3);
    expect(restore.input).toEqual({ threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, messages: [] });
    const expected = expectedRestoreEvents(source);
    expect(restore.events).toEqual(expected);
    expect(restore.fixture.events).toEqual(expected);
    const snapshot = expected[1]!;
    if (snapshot.type !== 'MESSAGES_SNAPSHOT') throw new Error('Expected history snapshot');
    expect(restore.digests).toEqual({ sourceSha256: sha(canonicalSerialize(source)), eventsSha256: sha(canonicalSerialize(expected)), historySha256: sha(canonicalSerialize(snapshot.messages)) });
    expect(compileCanonicalHistoryRestoreFixture(source, restoreIdentity)).toMatchObject({ input: restore.input, events: restore.events, digests: restore.digests });
    expect(compileCanonicalLongThreadFixture(source, identity)).toMatchObject({ input: continuationBefore.input, events: continuationBefore.events, digests: continuationBefore.digests });
  });
  it('accepts only empty history and exact declared IDs while inheriting canonical and epoch admission', () => {
    const source = sourceFixture();
    const restore = compileCanonicalHistoryRestoreFixture(source, restoreIdentity);
    const predicate = restore.fixture.match.predicate!;
    const empty = { threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, messages: [] };
    expect(predicate({ ...empty, state: {}, tools: [], context: [] })).toBe(true);
    for (const input of [null, {}, { ...empty, messages: undefined }, { ...empty, messages: null }, { ...empty, threadId: 'wrong' }, { ...empty, runId: identity.runId }, compileCanonicalLongThreadFixture(source, restoreIdentity).input]) expect(predicate(input as AGUIRunAgentInput)).toBe(false);
    const throwing = { ...empty }; Object.defineProperty(throwing, 'messages', { get() { throw new Error('Malformed accessor'); } });
    expect(predicate(throwing)).toBe(false);
    for (const invalid of [{ ...restoreIdentity, threadId: '' }, { ...restoreIdentity, runId: 'x'.repeat(129) }, { ...restoreIdentity, epochMs: Number.MAX_SAFE_INTEGER - 9999 }]) expect(() => compileCanonicalHistoryRestoreFixture(source, invalid)).toThrow();
    const boundary = compileCanonicalHistoryRestoreFixture(source, { ...restoreIdentity, epochMs: Number.MAX_SAFE_INTEGER - 10000 });
    expect(boundary.events.at(-1)!.timestamp).toBe(Number.MAX_SAFE_INTEGER - 9998);
    source.history[0]!.text = source.history[0]!.text.replace('The', 'Two');
    expect(() => compileCanonicalHistoryRestoreFixture(source, restoreIdentity)).toThrow(/canonical generator/);
  });
  it.each([1000, 10000] as const)('compiles full %i-message restoration without larger loopback runs', historyCount => {
    const source = createLongThreadFixture({ historyCount, responseBytes: 262144, journey: 'history-reading', seed: 42 });
    const restore = compileCanonicalHistoryRestoreFixture(source, restoreIdentity);
    expect(restore.events).toHaveLength(3);
    const snapshot = restore.events[1]!;
    expect(snapshot.type).toBe('MESSAGES_SNAPSHOT');
    if (snapshot.type !== 'MESSAGES_SNAPSHOT') throw new Error('Expected history snapshot');
    expect(snapshot.messages).toEqual(source.history.map(({ id, role, text }) => ({ id, role, content: text })));
    expect(snapshot.messages).toHaveLength(historyCount);
    expect(restore.digests).toMatchObject({ historySha256: sha(canonicalSerialize(snapshot.messages)) });
    expect(compileCanonicalHistoryRestoreFixture(source, restoreIdentity)).toMatchObject({ events: restore.events, digests: restore.digests });
  });
  it('restores over real SSE then continues from wire history with disjoint IDs, owned registration and repeatable reset', async () => {
    const mock = new AGUIMock();
    const source = sourceFixture();
    const restore = registerCanonicalHistoryRestoreFixture(mock, source, restoreIdentity);
    const continuation = registerCanonicalLongThreadFixture(mock, source, identity);
    const emptyInput = { threadId: restoreIdentity.threadId, runId: restoreIdentity.runId, messages: [] };
    const expected = expectedRestoreEvents(source);
    const continuationEvents = structuredClone(continuation.events);
    const restoreDigests = { ...restore.digests };
    const continuationDigests = { ...continuation.digests };
    source.history[0]!.text = 'caller source mutation';
    const returned = restore.events.find(event => event.type === 'MESSAGES_SNAPSHOT');
    const returnedFixture = restore.fixture.events.find(event => event.type === 'MESSAGES_SNAPSHOT');
    if (returned?.type === 'MESSAGES_SNAPSHOT') returned.messages[0]!.content = 'returned nested snapshot mutation';
    if (returnedFixture?.type === 'MESSAGES_SNAPSHOT') returnedFixture.messages[1]!.content = 'returned fixture nested snapshot mutation';
    restore.events.push({ type: 'RUN_ERROR', message: 'returned array mutation' });
    restore.fixture.match.predicate = () => true;
    restore.input.messages!.push({ id: 'returned-input-mutation', role: 'user', content: 'mutation' });
    const url = await mock.start();
    try {
      const response = await post(url, emptyInput);
      expect(response.status).toBe(200); expect(response.contentType).toMatch(/^text\/event-stream/);
      const wire = parseSse(response.body);
      expect(wire).toHaveLength(3); expect(wire).toEqual(expected);
      expect(sha(canonicalSerialize(wire))).toBe(restoreDigests.eventsSha256);
      const snapshot = wire[1]!;
      if (snapshot.type !== 'MESSAGES_SNAPSHOT') throw new Error('Expected actual wire snapshot');
      expect(sha(canonicalSerialize(snapshot.messages))).toBe(restoreDigests.historySha256);
      const wireContinuation = { threadId: identity.threadId, runId: identity.runId, messages: snapshot.messages };
      const replay = await post(url, wireContinuation);
      expect(replay.status).toBe(200); expect(replay.contentType).toMatch(/^text\/event-stream/);
      const replayWire = parseSse(replay.body);
      expect(replayWire).toHaveLength(204); expect(replayWire).toEqual(continuationEvents);
      expect(sha(canonicalSerialize(replayWire))).toBe(continuationDigests.eventsSha256);
      for (const wrong of [{ ...emptyInput, runId: identity.runId }, { ...wireContinuation, runId: restoreIdentity.runId }, { ...emptyInput, threadId: 'wrong' }, { ...wireContinuation, threadId: 'wrong' }]) expect((await post(url, wrong)).status).toBe(404);
      mock.reset();
      expect((await post(url, emptyInput)).status).toBe(404);
      expect((await post(url, wireContinuation)).status).toBe(404);
      const restoredAgain = registerCanonicalHistoryRestoreFixture(mock, sourceFixture(), restoreIdentity);
      const continuationAgain = registerCanonicalLongThreadFixture(mock, sourceFixture(), identity);
      expect(restoredAgain.digests).toEqual(restoreDigests); expect(continuationAgain.digests).toEqual(continuationDigests);
      const restoredResponse = await post(url, emptyInput); expect(restoredResponse.body).toBe(response.body);
      const replayResponse = await post(url, wireContinuation); expect(replayResponse.body).toBe(replay.body);
    } finally { await mock.stop(); }
  }, 10000);
});

describe('real AIMock loopback conformance', () => {
  it('serves exact complete SSE bytes repeatedly, owns registration copies, misses wrong inputs and clears on reset', async () => {
    const mock = new AGUIMock();
    const source = sourceFixture();
    const compiled = registerCanonicalLongThreadFixture(mock, source, identity);
    const expectedInput = structuredClone(compiled.input);
    const expectedEvents = structuredClone(compiled.events);
    const digests = { ...compiled.digests };
    source.history[0]!.text = 'caller mutation'; source.events[1]!.text = 'caller mutation';
    compiled.input.messages![0]!.content = 'returned mutation';
    compiled.events[2] = { type: 'RUN_ERROR', message: 'returned mutation' };
    compiled.fixture.events[3] = { type: 'RUN_ERROR', message: 'fixture mutation' };
    const url = await mock.start();
    try {
      for (let repeat = 0; repeat < 2; repeat++) {
        const response = await post(url, expectedInput);
        expect(response.status).toBe(200); expect(response.contentType).toMatch(/^text\/event-stream/);
        const events = parseSse(response.body);
        expect(events).toHaveLength(204); expect(events).toEqual(expectedEvents);
        expect(sha(canonicalSerialize(events))).toBe(digests.eventsSha256);
        const deltas = events.filter(event => event.type === 'TEXT_MESSAGE_CONTENT');
        const canonical = sourceFixture();
        expect(deltas.map(event => event.delta)).toEqual(canonical.events.slice(1, -1).map(event => event.text));
        expect(deltas.map(event => payloadBytes(event.delta))).toEqual(canonical.workload.chunkBytes);
        const text = deltas.map(event => event.delta).join('');
        expect(payloadBytes(text)).toBe(6400); expect(sha(text)).toBe(digests.responseSha256);
      }
      const wrongHistory = structuredClone(expectedInput); wrongHistory.messages![0]!.content = 'wrong';
      for (const input of [{ ...expectedInput, threadId: 'wrong' }, { ...expectedInput, runId: 'wrong' }, wrongHistory]) expect((await post(url, input)).status).toBe(404);
      mock.reset(); expect((await post(url, expectedInput)).status).toBe(404);
      const again = registerCanonicalLongThreadFixture(mock, sourceFixture(), identity);
      expect(again.digests).toEqual(digests);
      expect(parseSse((await post(url, expectedInput)).body)).toEqual(expectedEvents);
    } finally { await mock.stop(); }
  }, 10000);
  it('serves a separately named deterministic agent error through onPredicate', async () => {
    const mock = new AGUIMock();
    const fixture = registerDeterministicErrorFixture(mock);
    const input = structuredClone(fixture.input); const expected = structuredClone(fixture.events);
    fixture.events[1] = { type: 'RUN_ERROR', message: 'mutation' };
    const url = await mock.start();
    try {
      const response = await post(url, input);
      expect(response.status).toBe(200); expect(response.contentType).toMatch(/^text\/event-stream/);
      expect(parseSse(response.body)).toEqual(expected);
      expect(expected).toMatchObject([{ type: 'RUN_STARTED', threadId: 'agent-error-thread', runId: 'agent-error-run', timestamp: 0 }, { type: 'RUN_ERROR', code: 'FIXTURE_ERROR', message: 'Deterministic agent failure', timestamp: 1 }]);
      expect((await post(url, { ...input, runId: 'wrong' })).status).toBe(404);
      mock.reset(); expect((await post(url, input)).status).toBe(404);
    } finally { await mock.stop(); }
  });
});
