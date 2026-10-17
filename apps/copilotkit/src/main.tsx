/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import { CopilotChat, CopilotKitProvider } from '@copilotkit/react-core/v2';
import type { AbstractAgent } from '@ag-ui/client';
import type { CopilotKitCore } from '@copilotkit/core';
import '@copilotkit/react-core/v2/styles.css';
import './styles.css';
import { CONTEXT_URL, parseCaseContext } from './context.js';
import { boundedDiagnostic, createFrontendHost, readBoundedReply, type OwnedFrontendHost } from './host.js';
import { Probe } from './probe.js';

declare global {
  interface Window {
    /** Future harness integration only; excluded from the default registry. */
    __copilotkitBenchHost?: OwnedFrontendHost;
    __copilotkitBenchSourceError?: string;
    __copilotkitBenchMounting?: Promise<void>;
  }
}

async function mount(): Promise<void> {
  if (window.__copilotkitBenchHost !== undefined) throw new Error('Existing frontend owner requires original disposal; reuse is not admitted');
  // The owned server releases this bounded context only after full seed EOF,
  // original bridge/public settlement and exact H commitment.
  const response = await fetch(CONTEXT_URL, { signal: AbortSignal.timeout(60_000), cache: 'no-store' });
  const value: unknown = JSON.parse(await readBoundedReply(response, 128 * 1024));
  const context = parseCaseContext(value);
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing root');
  const root = createRoot(container);
  let host: OwnedFrontendHost | undefined;
  let selectedAgent: AbstractAgent | undefined;
  let initialError: string | null = null;
  function observeError(reason: unknown): void {
    initialError = boundedDiagnostic(reason);
    window.__copilotkitBenchSourceError = initialError;
    host?.observeError(reason);
  }
  function attach(agent: AbstractAgent, core: CopilotKitCore): OwnedFrontendHost {
    if (host) {
      if (selectedAgent !== agent) {
        host.closeAdmission('Unexpected public agent replacement; original disposal required');
        throw new Error('Public agent replacement is not admitted');
      }
      return host;
    }
    selectedAgent = agent;
    host = createFrontendHost(context, agent, core, () => { root.unmount(); }, initialError);
    window.__copilotkitBenchHost = host;
    return host;
  }
  root.render(
    <CopilotKitProvider runtimeUrl="/copilot" onError={({ error }) => { observeError(error); }}>
      <Probe context={context} attach={attach}>
        <CopilotChat agentId={context.agentId} threadId={context.ids.threadId} className="benchmark-chat" />
      </Probe>
    </CopilotKitProvider>,
  );
}

let mounting:Promise<void>|undefined;
/** Explicit document entry owns the original mount; importing this source does
 * not initiate an application request or mount. The HTML entry calls once. */
export function launchPage():Promise<void> {
  if(mounting) throw new Error('Page mount admission is once-only');
  mounting=mount();window.__copilotkitBenchMounting=mounting;
  mounting.catch(reason=> {window.__copilotkitBenchSourceError=boundedDiagnostic(reason);});
  return mounting;
}
