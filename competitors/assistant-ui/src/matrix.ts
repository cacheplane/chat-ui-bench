import type { MatrixBenchProgress, ProseMessage } from '../../shared/protocol.ts';
import { describeError } from './lifecycle.ts';

export type NativeMessage = { id: string; role: string; content: readonly { type: string; text?: string }[]; status?: { type: string; reason?: string; error?: unknown } };
type State = { isRunning: boolean; messages: readonly NativeMessage[] };

/** One connected public snapshot. SDK synchronization may still traverse history. */
export function createMatrixObserver(thread: { getState(): State; subscribe(fn: () => void): () => void }, historyCount: number, responseLimit: number) {
  let latest: State;
  let failure: unknown;
  let failed = false;
  let operation: ReturnType<typeof begin> | null = null;
  const latch = (cause: unknown) => {
    if (!failed) { failure = cause; failed = true; }
    operation?.fail(cause);
  };
  const update = () => {
    try { latest = thread.getState(); operation?.observe(); }
    catch (cause) { latch(cause); }
  };
  const unsubscribe = thread.subscribe(update);
  update();

  function begin() {
    if (failed) throw failure;
    const messages = latest.messages;
    if (messages.length !== historyCount) throw new Error('Continuation requires exact hydrated history');
    const boundary = messages[historyCount - 1];
    if (!boundary || boundary.role !== 'user') throw new Error('Continuation requires an existing final user');
    const boundaryId = boundary.id;
    const historical = new Set<string>();
    for (const message of messages) historical.add(message.id);
    let responseId: string | null = null;
    let status: 'pending' | 'fulfilled' | 'rejected' = 'pending';
    let resolve!: () => void, reject!: (cause: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    void promise.catch(() => {});
    const fail = (cause: unknown) => { if (status === 'pending') { status = 'rejected'; reject(cause); } };
    const response = () => {
      const { messages } = latest;
      if (messages.length !== historyCount && messages.length !== historyCount + 1) throw new Error('Unexpected actual SDK message count');
      if (messages[historyCount - 1]?.id !== boundaryId || messages[historyCount - 1]?.role !== 'user') throw new Error('Final user boundary changed');
      if (messages.length === historyCount) {
        if (responseId) throw new Error('Bound assistant response removed');
        return null;
      }
      const tail = messages[historyCount];
      if (tail.role !== 'assistant') throw new Error('Unexpected SDK response role');
      if (typeof tail.id !== 'string' || !tail.id || historical.has(tail.id)) throw new Error('Assistant identity collides with history');
      if (responseId && tail.id !== responseId) throw new Error('Assistant identity changed during original run');
      responseId = tail.id;
      characters(tail);
      if (tail.status?.type === 'incomplete') throw new Error(`Assistant run ${tail.status.reason ?? 'incomplete'}: ${describeError(tail.status.error ?? '')}`, { cause: tail.status.error });
      if (tail.status?.type !== 'running' && tail.status?.type !== 'complete') throw new Error('Unsupported assistant status');
      if (tail.status.type === 'complete' && tail.status.reason !== undefined && tail.status.reason !== 'stop' && tail.status.reason !== 'unknown') throw new Error('Unsupported assistant completion reason');
      return tail;
    };
    return {
      promise, fail, parentId: boundaryId,
      get status() { return status; }, get responseId() { return responseId; },
      response,
      observe() { const tail = response(); if (status === 'pending' && !latest.isRunning && tail?.status?.type === 'complete') { status = 'fulfilled'; resolve(); } },
      dispose() { fail(new Error('Assistant runtime disposed before completion')); },
    };
  }
  function characters(message: NativeMessage) {
    let count = 0;
    for (const part of message.content) {
      if (part.type !== 'text' || typeof part.text !== 'string') throw new Error('Unexpected non-prose SDK content');
      count += part.text.length;
    }
    if (count > responseLimit) throw new Error('Actual SDK response exceeds context bound');
    return count;
  }
  function current() {
    try { return operation?.response() ?? null; }
    catch (cause) { latch(cause); throw cause; }
  }
  return {
    fail: latch,
    start() { operation = begin(); return operation; },
    readProgress(): MatrixBenchProgress {
      const tail = current();
      if (!latest) throw failure;
      return { schema: 1, messageCount: latest.messages.length, responseId: tail?.id ?? null,
        responseCharacters: tail ? characters(tail) : null, running: latest.isRunning,
        error: failed ? describeError(failure) : null,
        operation: { kind: 'public-runtime-state-transition', status: operation?.status ?? 'idle' } };
    },
    readResponse(): ProseMessage | null {
      const tail = current();
      if (!tail) return null;
      let text = '';
      for (const part of tail.content) text += part.text;
      return { id: tail.id, role: 'assistant', text };
    },
    get error() { return failed ? describeError(failure) : null; },
    unsubscribe,
  };
}
