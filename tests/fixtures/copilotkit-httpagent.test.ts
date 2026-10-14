import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalSerialize, createLongThreadFixture } from '@chat-ui-bench/contract';
import { compileCanonicalHistoryRestoreFixture, compileCanonicalLongThreadFixture, type FixtureIdentity } from './aimock.js';
import { createCanonicalHttpAgentConfiguration } from './copilotkit-httpagent.js';

const sourceFixture = () => createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' });
const restore = { threadId: 'public-thread', runId: 'restore-run', epochMs: 1700000000000 };
const continuation = { ...restore, runId: 'continuation-run', epochMs: 1700000001000 };
const endpoint = '  data-only-endpoint  ';
const sha = (value: unknown) => createHash('sha256').update(canonicalSerialize(value)).digest('hex');

describe('pure public HttpAgent configuration', () => {
  it('returns empty constructor history, distinct admitted runs, complete ordered history and separate digests', () => {
    const source = sourceFixture();
    const result = createCanonicalHttpAgentConfiguration(source, restore, continuation, endpoint);
    const restored = compileCanonicalHistoryRestoreFixture(source, restore);
    const continued = compileCanonicalLongThreadFixture(source, continuation);
    expect(result.config).toEqual({ url: endpoint, threadId: restore.threadId, agentId: 'canonical-long-thread', initialMessages: [] });
    expect(result.restoreRun).toEqual({ runId: restore.runId });
    expect(result.continuationRun).toEqual({ runId: continuation.runId });
    expect(result.expectedHistory).toEqual(source.history.map(({ id, role, text }) => ({ id, role, content: text })));
    expect(result.expectedHistory.every(message => Object.keys(message).sort().join(',') === 'content,id,role')).toBe(true);
    expect(result.digests).toEqual({ restoration: restored.digests, continuation: continued.digests });
    expect(sha(result.expectedHistory)).toBe(result.digests.restoration.historySha256);
    expect(Object.keys(result).sort()).toEqual(['config', 'continuationRun', 'digests', 'expectedHistory', 'restoreRun']);
  });

  it('rejects mismatched admitted threads and equal admitted runs', () => {
    expect(() => createCanonicalHttpAgentConfiguration(sourceFixture(), restore, { ...continuation, threadId: 'other' }, endpoint)).toThrow(/thread/i);
    expect(() => createCanonicalHttpAgentConfiguration(sourceFixture(), restore, { ...continuation, runId: restore.runId }, endpoint)).toThrow(/run/i);
  });

  it('rejects nonstring and blank endpoints while preserving a nonblank supplied value', () => {
    for (const invalid of ['', ' \n\t', null, 42, {}, undefined]) {
      expect(() => createCanonicalHttpAgentConfiguration(sourceFixture(), restore, continuation, invalid)).toThrow(/endpoint/i);
    }
  });

  it('keeps canonical provenance and both compiler identity and epoch admission', () => {
    const tampered = sourceFixture(); tampered.history[0]!.text = 'x'.repeat(511) + '.';
    expect(() => createCanonicalHttpAgentConfiguration(tampered, restore, continuation, endpoint)).toThrow(/canonical/i);
    for (const invalid of [{ ...restore, threadId: '' }, { ...restore, runId: 'bad id' }, { ...restore, epochMs: -1 }, { ...restore, epochMs: Number.MAX_SAFE_INTEGER }]) {
      expect(() => createCanonicalHttpAgentConfiguration(sourceFixture(), invalid, continuation, endpoint)).toThrow();
      expect(() => createCanonicalHttpAgentConfiguration(sourceFixture(), restore, invalid, endpoint)).toThrow();
    }
  });

  it('owns caller data and returns independently mutable results', () => {
    const source = sourceFixture(); const restoreIdentity = { ...restore }; const continuationIdentity = { ...continuation };
    const result = createCanonicalHttpAgentConfiguration(source, restoreIdentity, continuationIdentity, endpoint);
    const expected = structuredClone(result);
    source.history[0]!.text = 'caller mutation'; source.events[1]!.text = 'caller mutation';
    restoreIdentity.runId = 'mutated'; continuationIdentity.threadId = 'mutated';
    expect(result).toEqual(expected);
    result.config.initialMessages!.push({ id: 'owned', role: 'user', content: 'owned' });
    result.config.url = 'mutated'; result.restoreRun.runId = 'mutated'; result.continuationRun.runId = 'mutated';
    result.expectedHistory[0]!.content = 'mutated'; result.expectedHistory.push({ id: 'owned', role: 'user', content: 'owned' });
    result.digests.restoration.historySha256 = 'mutated'; result.digests.continuation.sourceSha256 = 'mutated';
    expect(createCanonicalHttpAgentConfiguration(sourceFixture(), restore, continuation, endpoint)).toEqual(expected);
  });

  it('admits the source before either identity and reads each identity field exactly once', () => {
    const source = sourceFixture(); const original = structuredClone(source);
    const counts = { restore: { threadId: 0, runId: 0, epochMs: 0 }, continuation: { threadId: 0, runId: 0, epochMs: 0 } };
    function identity(value: FixtureIdentity, role: keyof typeof counts): FixtureIdentity {
      return {
        get threadId() {
          if (++counts[role].threadId > 1) throw new Error('thread reread');
          if (role === 'restore') { source.history[0]!.text = 'getter mutation'; source.events[1]!.text = 'getter mutation'; }
          return value.threadId;
        },
        get runId() { if (++counts[role].runId > 1) throw new Error('run reread'); return value.runId; },
        get epochMs() { if (++counts[role].epochMs > 1) throw new Error('epoch reread'); return value.epochMs; },
      };
    }
    const result = createCanonicalHttpAgentConfiguration(source, identity(restore, 'restore'), identity(continuation, 'continuation'), endpoint);
    expect(result).toEqual(createCanonicalHttpAgentConfiguration(original, restore, continuation, endpoint));
    expect(counts).toEqual({ restore: { threadId: 1, runId: 1, epochMs: 1 }, continuation: { threadId: 1, runId: 1, epochMs: 1 } });
  });

  it('rejects the original canonical source before accessing either identity', () => {
    let reads = 0;
    const identity: FixtureIdentity = {
      get threadId(): string { reads++; throw new Error('identity read'); },
      get runId(): string { reads++; throw new Error('identity read'); },
      get epochMs(): number { reads++; throw new Error('identity read'); },
    };
    const invalid = sourceFixture(); invalid.history[0]!.text = 'x'.repeat(511) + '.';
    expect(() => createCanonicalHttpAgentConfiguration(invalid, identity, identity, endpoint)).toThrow(/canonical/i);
    expect(reads).toBe(0);
  });
});
