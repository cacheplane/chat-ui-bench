import { useEffect } from 'react';
import { useAgent, useCopilotKit } from '@copilotkit/react-core/v2';
import type { AbstractAgent } from '@ag-ui/client';
import type { CopilotKitCore } from '@copilotkit/core';
import type { CaseContext } from './context.js';
import type { OwnedFrontendHost } from './host.js';

export function Probe({ context, attach }: {
  readonly context: CaseContext;
  readonly attach: (agent: AbstractAgent, core: CopilotKitCore) => OwnedFrontendHost;
}) {
  const { agent, isReady } = useAgent({ agentId: context.agentId });
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    if (!isReady) return;
    // Readiness selects the real agent only. loadHistory independently waits for
    // native cold-connect restoration of exact H, idle and error-free state.
    const host = attach(agent, copilotkit);
    return () => {
      // React cannot await cleanup. Keep the original owner for harness disposal;
      // do not launch detached asynchronous cleanup or clear a global store.
      host.closeAdmission('React probe cleanup: source admission closed');
    };
  }, [agent, isReady, copilotkit, attach]);
  return null;
}
