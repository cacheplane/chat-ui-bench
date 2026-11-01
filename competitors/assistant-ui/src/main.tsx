import { Component, useLayoutEffect, useMemo, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { Thread } from './components/assistant-ui/elements/thread.aui';
import { loadContext } from './context.ts';
import type { PublicContext } from '../../shared/protocol.ts';
import { createBridge } from './bridge.ts';
import { createSource } from './adapter.ts';
import { describeError } from './lifecycle.ts';
import './official-globals.css';
import './official-theme.css';
import './shell.css';

async function boot() {
  const contextResponse = await fetch('/context', { cache: 'no-store' });
  const context = await loadContext(contextResponse);
  if (context.profile !== 'assistant-ui') throw new Error('Wrong profile context');
  const element = document.getElementById('root');
  if (!element) throw new Error('Root element is missing');
  const root = createRoot(element);
  root.render(<StartupBoundary><App context={context} unmount={() => root.unmount()} /></StartupBoundary>);
}

class StartupBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    window.competitorBenchError = describeError(error);
    delete window.competitorBench;
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function App({ context, unmount }: { context: PublicContext; unmount: () => void }) {
  const source = useMemo(() => createSource(context), [context]);
  const initialMessages = useMemo(() => context.history.map((message, index) => ({
    id: message.id, role: message.role,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    content: [{ type: 'text' as const, text: message.text }],
  })), [context]);
  const runtime = useLocalRuntime(source.adapter, { initialMessages });
  useLayoutEffect(() => {
    window.competitorBench = createBridge(runtime.thread, source, unmount, context);
  }, [runtime, source, unmount]);
  return <AssistantRuntimeProvider runtime={runtime}><Thread /></AssistantRuntimeProvider>;
}

void boot().catch((error: unknown) => { window.competitorBenchError = describeError(error); });
