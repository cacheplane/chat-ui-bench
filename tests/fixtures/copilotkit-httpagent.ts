import type { HttpAgentConfig, Message, RunAgentParameters } from '@ag-ui/client';
import { validateCanonicalLongThreadFixture } from '@chat-ui-bench/contract';
import { compileCanonicalHistoryRestoreFixture, compileCanonicalLongThreadFixture, type FixtureIdentity } from './aimock.js';

/** Pure consumer configuration; empty initial messages do not establish restored SDK state. */
export function createCanonicalHttpAgentConfiguration(source: unknown, restoreIdentity: FixtureIdentity, continuationIdentity: FixtureIdentity, endpoint: unknown) {
  const canonical = validateCanonicalLongThreadFixture(source);
  const restoration = compileCanonicalHistoryRestoreFixture(canonical, restoreIdentity);
  const continuation = compileCanonicalLongThreadFixture(canonical, continuationIdentity);
  if (restoration.input.threadId !== continuation.input.threadId) throw new TypeError('Restoration and continuation thread IDs must agree');
  if (restoration.input.runId === continuation.input.runId) throw new TypeError('Restoration and continuation run IDs must differ');
  if (typeof endpoint !== 'string' || endpoint.trim().length === 0) throw new TypeError('Endpoint must be a nonblank string');

  const config: HttpAgentConfig = { url: endpoint, threadId: restoration.input.threadId, agentId: 'canonical-long-thread', initialMessages: [] };
  const restoreRun: RunAgentParameters = { runId: restoration.input.runId };
  const continuationRun: RunAgentParameters = { runId: continuation.input.runId };
  const expectedHistory = canonical.history.map(({ id, role, text }) => ({ id, role, content: text })) satisfies Message[];
  return {
    config, restoreRun, continuationRun, expectedHistory,
    digests: { restoration: { ...restoration.digests }, continuation: { ...continuation.digests } },
  };
}
