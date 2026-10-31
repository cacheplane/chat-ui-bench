import {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {CopilotKitProvider, CopilotChat, useAgent, useCopilotKit} from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import {parsePublicContext} from '../../shared/context.mjs';
import type {CompetitorBench, PublicContext} from '../../shared/protocol.ts';
import type {AbstractAgent} from '@ag-ui/client';
import {createLifecycle} from './lifecycle.ts';
import {createMessageProjection} from './messages.ts';
import './styles.css';

const reportError = (error: unknown) => { window.competitorBenchError = String(error instanceof Error ? error.message : error).slice(0, 4096); };

async function launch() {
  const response = await fetch('/context');
  if (!response.ok) throw new Error('Copilot context unavailable');
  const text = await response.text();
  if (text.length > 131072) throw new Error('Copilot context exceeds bound');
  const context = parsePublicContext(JSON.parse(text));
  if (context.profile !== 'copilotkit') throw new Error('Wrong Copilot profile');
  const container = document.querySelector('#root');
  if (!container) throw new Error('Copilot mount absent');
  const root = createRoot(container);
  let attached = false;
  let attachedAgent: AbstractAgent | null = null;
  function Probe({context}: {context: PublicContext}) {
    // Share the default Chat's public agent; Chat owns its thread configuration.
    const {agent, isReady} = useAgent({agentId: 'default'});
    const {copilotkit} = useCopilotKit();
    useEffect(() => {
      if (!isReady) return;
      if (attached) { if (attachedAgent !== agent) reportError(new Error('Copilot public agent replaced')); return; }
      attached = true;
      attachedAgent = agent;
      const projection = createMessageProjection(context.history.map(message => message.id));
      const lifecycle = createLifecycle(
        () => {
          if (agent.threadId !== context.threadId) throw new Error('Copilot public thread differs');
          return copilotkit.runAgent({agent, runId: context.runId});
        },
        () => agent.detachActiveRun(),
        () => { root.unmount(); },
      );
      const bridge: CompetitorBench = {
        read() {
          const messages = projection.read(agent.messages);
          return {messages, running: agent.isRunning, error: lifecycle.error() ?? window.competitorBenchError ?? null, responseId: projection.responseId(), operation: lifecycle.operation()};
        },
        start: () => lifecycle.start(),
        waitForRun: () => lifecycle.waitForRun(),
        dispose: () => lifecycle.dispose(),
        selectors: {
          scroller: '[data-testid="copilot-chat"] > [class~="cpk:flex-1"] > div:has(> [class~="cpk:overflow-y-auto"] > div > [data-testid="copilot-scroll-content"])',
          composer: '[data-testid="copilot-chat-textarea"]',
          message: '[data-testid="copilot-assistant-message"], [data-testid="copilot-user-message"]',
          messageContent: '[class~="cpk:prose"]',
          returnToResponse: '[data-testid="copilot-scroll-to-bottom"]',
        },
        capabilities: {rendering: 'virtualized', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'},
      };
      window.competitorBench = bridge;
    }, [agent, isReady, copilotkit, context]);
    return isReady ? <CopilotChat agentId="default" threadId={context.threadId} className="benchmark-chat" /> : null;
  }
  root.render(<CopilotKitProvider runtimeUrl="/copilot" onError={({error}) => reportError(error)}><Probe context={context} /></CopilotKitProvider>);
}
void launch().catch(reportError);
