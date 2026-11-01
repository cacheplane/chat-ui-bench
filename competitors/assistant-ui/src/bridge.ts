import type { CompetitorBench, BenchSnapshot } from '../../shared/protocol.ts';
import { createTransition, describeError, type PublicThread } from './lifecycle.ts';
type NativeMessage = { id: string; role: string; content: readonly { type: string; text?: string }[]; status?: { type: string; reason?: string; error?: unknown } };
interface ThreadController extends PublicThread {
  getState(): { isRunning: boolean; messages: readonly NativeMessage[] };
  startRun(config: { parentId: string }): void;
  cancelRun(): void;
}
export function createBridge(thread: ThreadController, source: { dispose(): Promise<void> }, unmount: () => void): CompetitorBench {
  let operation: ReturnType<typeof createTransition> | null = null;
  let disposed = false, error: string | null = null;
  let cleanup: Promise<void> | undefined;
  return {
    selectors: {
      scroller: '[data-slot="aui_thread-viewport"]',
      composer: '.aui-composer-input',
      message: '[data-slot="aui_assistant-message-root"], [data-slot="aui_user-message-root"]',
      messageContent: '[data-slot="aui_assistant-message-content"], .aui-user-message-content',
      returnToResponse: '.aui-thread-scroll-to-bottom',
    },
    capabilities: { rendering: 'all-mounted', scrollPolicy: 'turn-anchoring', returnToResponse: 'native-control' },
    read(): BenchSnapshot {
      const state = thread.getState();
      const sdkError = state.messages.find((message) => message.status?.type === 'incomplete' && message.status.reason === 'error')?.status?.error;
      return {
        messages: state.messages.map((message) => {
          if (message.role !== 'assistant' && message.role !== 'user') throw new Error('Unexpected SDK message role');
          if (message.content.some((part) => part.type !== 'text' || typeof part.text !== 'string')) throw new Error('Unexpected non-prose SDK content');
          return { id: message.id, role: message.role, text: message.content.map((part) => part.text).join('') };
        }),
        running: state.isRunning,
        error: error ?? (sdkError === undefined ? null : describeError(sdkError)),
        responseId: operation?.responseId ?? null,
        operation: { kind: 'public-runtime-state-transition', status: operation?.status ?? 'idle' },
      };
    },
    start() {
      if (disposed) throw new Error('Assistant runtime disposed');
      if (operation) throw new Error('Original assistant continuation already started');
      const messages = thread.getState().messages;
      const last = messages.at(-1);
      if (!last || last.role !== 'user') throw new Error('Continuation requires an existing final user');
      operation = createTransition(thread, messages.map((message) => message.id));
      void operation.promise.catch((cause: unknown) => { error = describeError(cause); });
      try { thread.startRun({ parentId: last.id }); }
      catch (cause) { operation.fail(cause); throw cause; }
    },
    waitForRun() {
      if (!operation) return Promise.reject(new Error('Original continuation has not started'));
      return operation.promise;
    },
    dispose() {
      if (cleanup) return cleanup;
      disposed = true;
      cleanup = (async () => {
        thread.cancelRun();
        operation?.dispose();
        await source.dispose();
        await Promise.allSettled(operation ? [operation.promise] : []);
        unmount();
      })();
      return cleanup;
    },
  };
}
