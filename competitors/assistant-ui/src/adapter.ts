import type { ChatModelAdapter } from '@assistant-ui/react';
import { describeError } from './lifecycle.ts';
import { readTextStream } from './stream.ts';

/** Owns exactly one stream reader. No expected response content enters this API. */
export function createSource(context: { threadId: string; runId: string }, request: typeof fetch = fetch) {
  const disposal = new AbortController();
  let originalReader: Promise<void> | null = null;
  let disposed = false;
  const adapter: ChatModelAdapter = {
    async *run({ abortSignal }) {
      if (disposed || originalReader) {
        yield { status: { type: 'incomplete', reason: 'error', error: 'Only one original reader is allowed' } };
        return;
      }
      let resolve!: () => void, reject!: (error: unknown) => void;
      originalReader = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      // Retain the rejecting operation; suppress only unhandled-rejection reporting.
      void originalReader.catch(() => {});
      const signal = AbortSignal.any([abortSignal, disposal.signal]);
      try {
        const response = await request('/stream/ui', {
          method: 'POST', signal, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: context.threadId, runId: context.runId, trigger: 'regenerate-message' }),
        });
        for await (const text of readTextStream(response, signal)) yield { content: [{ type: 'text', text }] };
        resolve();
      } catch (error) {
        // readTextStream awaits reader cancellation/release before rejecting.
        reject(error);
        // Documented SDK status preserves failure without depending on startRun's
        // undocumented return. The public transition rejects on this SDK status.
        yield { status: { type: 'incomplete', reason: signal.aborted ? 'cancelled' : 'error', error: describeError(error) } };
      }
    },
  };
  return {
    adapter,
    get readerOperation() { return originalReader; },
    async dispose() {
      disposed = true;
      disposal.abort(new DOMException('Assistant source disposed', 'AbortError'));
      if (originalReader) await Promise.allSettled([originalReader]);
    },
  };
}
