import type { AgentSubscriber, HttpAgent, HttpAgentFetchFn, RunAgentParameters, RunAgentResult } from '@ag-ui/client';
import type { AGUIMock } from '@copilotkit/aimock/agui';
import type { createScopedFetch, runOwnedSdkOperation, openOwnedMockEndpoint, SessionOwnership, FinalValidation } from '../hosted/httpagent-transport.js';

// Compile-only public consumer relationships; no SDK/helper value import.
export function hostedConsumerControls(agent: HttpAgent, mock: AGUIMock,
  sdkRun: typeof runOwnedSdkOperation, scoped: typeof createScopedFetch,
  endpoint: typeof openOwnedMockEndpoint, session: SessionOwnership) {
  const fetch: HttpAgentFetchFn = scoped(session);
  const run: (parameters?: RunAgentParameters, subscriber?: AgentSubscriber) => Promise<RunAgentResult> = agent.runAgent.bind(agent);
  const handler: Pick<AGUIMock, 'handleRequest'> = mock;
  const validation: FinalValidation = { operationTokens: [1, 2, 3, 4, 5, 6, 7, 8], assertionOutcome: 'passed' };
  return { fetch, run, handler, validation, sdkRun, endpoint };
}

export function invalidValidationControls() {
  // @ts-expect-error Only passed/failed assertions can bind final validation.
  const unsupported: FinalValidation = { operationTokens: [], assertionOutcome: 'assumed' };
  return unsupported;
}
