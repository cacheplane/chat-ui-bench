import type { AGUIEvent, AGUIFixture, AGUIMock, AGUIRunAgentInput } from '@copilotkit/aimock/agui';
import { buildMessagesSnapshot } from '@copilotkit/aimock/agui';
import { createHash } from 'node:crypto';
import { canonicalSerialize, validateCanonicalLongThreadFixture } from '@chat-ui-bench/contract';

export interface FixtureIdentity { threadId: string; runId: string; epochMs: number }
export interface CompiledCanonicalFixture {
  input: AGUIRunAgentInput;
  events: AGUIEvent[];
  fixture: AGUIFixture;
  digests: { sourceSha256: string; eventsSha256: string; responseSha256: string };
}
export interface CompiledCanonicalHistoryRestoreFixture {
  input: AGUIRunAgentInput;
  events: AGUIEvent[];
  fixture: AGUIFixture;
  digests: { sourceSha256: string; eventsSha256: string; historySha256: string };
}
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

// Capture an owned history. Neither the caller nor returned diagnostics own this copy.
function exactInputPredicate(expected: AGUIRunAgentInput): (input: AGUIRunAgentInput) => boolean {
  const owned = structuredClone(expected);
  return (input: unknown): boolean => {
    try {
      if (typeof input !== 'object' || input === null) return false;
      const actual = input as Record<string, unknown>;
      if (actual.threadId !== owned.threadId || actual.runId !== owned.runId || !Array.isArray(actual.messages) || actual.messages.length !== owned.messages!.length) return false;
      for (let i = 0; i < owned.messages!.length; i++) {
        const message: unknown = actual.messages[i];
        if (typeof message !== 'object' || message === null) return false;
        if (Reflect.ownKeys(message).length !== 3 || !['id', 'role', 'content'].every(key => Object.hasOwn(message, key))) return false;
        const fields = message as Record<string, unknown>;
        const expectedMessage = owned.messages![i]!;
        if (fields.id !== expectedMessage.id || fields.role !== expectedMessage.role || fields.content !== expectedMessage.content) return false;
      }
      return true;
    } catch { return false; }
  };
}

/** Compile canonical provenance into AG-UI data. Timestamps describe a synthetic clock, not transport pacing. */
export function compileCanonicalLongThreadFixture(source: unknown, identity: FixtureIdentity): CompiledCanonicalFixture {
  const canonical = validateCanonicalLongThreadFixture(source);
  const { threadId, runId, epochMs } = identity;
  for (const id of [threadId, runId]) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) throw new TypeError('Thread and run IDs must be 1–128 bounded ASCII identity characters');
  }
  if (!Number.isSafeInteger(epochMs) || epochMs < 0 || !Number.isSafeInteger(epochMs + 10000)) throw new RangeError('Synthetic epoch and final timestamp must be nonnegative safe integers');
  const input: AGUIRunAgentInput = { threadId, runId, messages: canonical.history.map(({ id, role, text }) => ({ id, role, content: text })) };
  const messageId = canonical.events[0]!.messageId;
  const clock = (scheduledMs: number) => ({ timestamp: epochMs + scheduledMs, metadata: { clock: 'synthetic-canonical-replay-ms', epochMs, scheduledMs } });
  const events: AGUIEvent[] = [
    { type: 'RUN_STARTED', threadId, runId, ...clock(0) },
    { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', ...clock(0) },
    ...canonical.events.slice(1, -1).map(event => ({ type: 'TEXT_MESSAGE_CONTENT' as const, messageId, delta: event.text, ...clock(event.scheduledMs) })),
    { type: 'TEXT_MESSAGE_END', messageId, ...clock(10000) },
    { type: 'RUN_FINISHED', threadId, runId, ...clock(10000) },
  ];
  return {
    input, events,
    fixture: { match: { predicate: exactInputPredicate(input) }, events: structuredClone(events) },
    digests: {
      sourceSha256: sha256(canonicalSerialize(canonical)),
      eventsSha256: sha256(canonicalSerialize(events)),
      responseSha256: sha256(canonical.events.slice(1, -1).map(event => event.text).join('')),
    },
  };
}

/** Register an independently owned fixture using the actual AIMock API, without upstream recording. */
export function registerCanonicalLongThreadFixture(mock: AGUIMock, source: unknown, identity: FixtureIdentity): CompiledCanonicalFixture {
  const compiled = compileCanonicalLongThreadFixture(source, identity);
  mock.addFixture({ match: { predicate: compiled.fixture.match.predicate! }, events: structuredClone(compiled.events) });
  return compiled;
}

/** Restore complete canonical history separately from continuation; inherits the canonical epoch + 10000 bound. */
export function compileCanonicalHistoryRestoreFixture(source: unknown, identity: FixtureIdentity): CompiledCanonicalHistoryRestoreFixture {
  const canonical = compileCanonicalLongThreadFixture(source, identity);
  const { threadId, runId } = canonical.input;
  const epochMs = canonical.events[0]!.timestamp!; // Admitted RUN_STARTED always uses the validated epoch + 0.
  const history = structuredClone(canonical.input.messages!);
  const input: AGUIRunAgentInput = { threadId, runId, messages: [] };
  const events: AGUIEvent[] = buildMessagesSnapshot(history, { threadId, runId }).map((event, scheduledMs) => ({
    ...event, timestamp: epochMs + scheduledMs,
    metadata: { clock: 'synthetic-canonical-history-restore-ms', epochMs, scheduledMs },
  }));
  return {
    input, events,
    fixture: { match: { predicate: exactInputPredicate(input) }, events: structuredClone(events) },
    digests: { sourceSha256: canonical.digests.sourceSha256, eventsSha256: sha256(canonicalSerialize(events)), historySha256: sha256(canonicalSerialize(history)) },
  };
}

/** Register owned restoration events and an empty-history predicate independent of returned diagnostics. */
export function registerCanonicalHistoryRestoreFixture(mock: AGUIMock, source: unknown, identity: FixtureIdentity): CompiledCanonicalHistoryRestoreFixture {
  const compiled = compileCanonicalHistoryRestoreFixture(source, identity);
  mock.addFixture({ match: { predicate: compiled.fixture.match.predicate! }, events: structuredClone(compiled.events) });
  return compiled;
}

/** Small agent error fixture, distinct from the canonical performance workload. */
export function registerDeterministicErrorFixture(mock: AGUIMock): { input: AGUIRunAgentInput; events: AGUIEvent[] } {
  const input: AGUIRunAgentInput = { threadId: 'agent-error-thread', runId: 'agent-error-run', messages: [{ id: 'agent-error-user', role: 'user', content: 'Demonstrate a deterministic agent error.' }] };
  const events: AGUIEvent[] = [
    { type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId, timestamp: 0, metadata: { clock: 'synthetic-agent-error-ms' } },
    { type: 'RUN_ERROR', code: 'FIXTURE_ERROR', message: 'Deterministic agent failure', timestamp: 1, metadata: { clock: 'synthetic-agent-error-ms' } },
  ];
  mock.onPredicate(exactInputPredicate(input), structuredClone(events));
  return { input, events };
}
