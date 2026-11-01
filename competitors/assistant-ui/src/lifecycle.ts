type Status = { type: string; reason?: string; error?: unknown };
type Message = { id: string; role: string; status?: Status };
export interface PublicThread {
  getState(): { isRunning: boolean; messages: readonly Message[] };
  subscribe(listener: () => void): () => void;
}
export function describeError(value: unknown): string {
  if (value instanceof Error) return value.message.slice(0, 4096);
  if (typeof value === 'string') return value.slice(0, 4096);
  try { return JSON.stringify(value).slice(0, 4096); } catch { return 'Unknown runtime error'; }
}
/** startRun has a public void signature. Completion is explicitly a state transition. */
export function createTransition(thread: PublicThread, historyIds: readonly string[]) {
  const historical = new Set(historyIds);
  let status: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  let responseId: string | null = null;
  let resolve!: () => void, reject!: (error: Error) => void;
  let unsubscribe = () => {};
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  // Mark rejection observed while retaining the original rejecting promise for callers.
  void promise.catch(() => {});
  const settle = (error?: Error) => {
    if (status !== 'pending') return;
    status = error ? 'rejected' : 'fulfilled';
    // Settle the original promise even when public unsubscription itself fails.
    try { unsubscribe(); }
    finally { if (error) reject(error); else resolve(); }
  };
  unsubscribe = thread.subscribe(() => {
    const state = thread.getState();
    const assistant = state.messages.find((message) => !historical.has(message.id) && message.role === 'assistant');
    if (!assistant) return;
    if (responseId && assistant.id !== responseId) { settle(new Error('Assistant identity changed during original run')); return; }
    responseId = assistant.id;
    if (assistant.status?.type === 'incomplete') {
      settle(new Error(`Assistant run ${assistant.status.reason ?? 'incomplete'}: ${describeError(assistant.status.error ?? '')}`));
    } else if (!state.isRunning && assistant.status?.type === 'complete') settle();
  });
  return {
    promise,
    get status() { return status; },
    get responseId() { return responseId; },
    fail(error: unknown) { settle(new Error(describeError(error))); },
    dispose() { settle(new Error('Assistant runtime disposed before completion')); },
  };
}
