/** UI-message SSE framing only; LocalRuntime owns all assistant state. */
export async function* readTextStream(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.ok) throw new Error(`Stream request failed (${response.status})`);
  if (!response.headers.get('content-type')?.includes('text/event-stream') || response.headers.get('x-vercel-ai-ui-message-stream') !== 'v1') {
    throw new Error('Expected UI message SSE v1');
  }
  if (!response.body) throw new Error('Stream body is missing');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffered = '', text = '', block: string | null = null;
  let started = false, ended = false, finished = false, done = false;
  let verifiedEof = false;
  let originalCancellation: Promise<void> | undefined;
  const cancel = (reason?: unknown) => {
    originalCancellation ??= reader.cancel(reason);
    return originalCancellation;
  };
  const abort = () => { void cancel(signal.reason).catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      buffered += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r\n/g, '\n');
      // Normalize CRLF after joining as a byte chunk can end between CR and LF.
      buffered = buffered.replace(/\r\n/g, '\n');
      if (buffered.length > 1_048_576) throw new Error('SSE frame exceeds bounded buffer');
      let boundary: number;
      while ((boundary = buffered.indexOf('\n\n')) !== -1) {
        const frame = buffered.slice(0, boundary); buffered = buffered.slice(boundary + 2);
        const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        if (done) throw new Error('Data follows stream terminator');
        if (data === '[DONE]') {
          if (!finished || !ended) throw new Error('Premature stream terminator');
          done = true; continue;
        }
        const event: unknown = JSON.parse(data);
        if (!event || typeof event !== 'object' || !('type' in event)) throw new Error('Malformed stream event');
        const value = event as Record<string, unknown>;
        switch (value.type) {
          case 'start':
            if (started || typeof value.messageId !== 'string' || !value.messageId) throw new Error('Invalid stream start');
            started = true; break;
          case 'text-start':
            if (!started || block || typeof value.id !== 'string' || !value.id) throw new Error('Invalid text start');
            block = value.id; break;
          case 'text-delta':
            if (!block || ended || value.id !== block || typeof value.delta !== 'string') throw new Error('Invalid text delta');
            text += value.delta;
            yield text;
            break;
          case 'text-end':
            if (!block || ended || value.id !== block) throw new Error('Invalid text end');
            ended = true; break;
          case 'finish':
            if (!ended || finished) throw new Error('Invalid stream finish');
            finished = true; break;
          case 'error': throw new Error(typeof value.errorText === 'string' ? value.errorText : 'SSE source error');
          default: throw new Error(`Unexpected prose stream event: ${String(value.type)}`);
        }
      }
      if (chunk.done) break;
    }
    if (buffered.trim() || !done) throw new Error('Incomplete UI message SSE stream');
    verifiedEof = true;
  } finally {
    signal.removeEventListener('abort', abort);
    // A later cancel on an already-closed stream can settle before the first
    // underlying asynchronous cancel. Only that first promise owns cleanup.
    // Normal EOF is already complete; cancelling it can change browser network
    // disposition after successful consumption. Failures still own cancellation.
    try { if (!verifiedEof) await cancel(); }
    finally { reader.releaseLock(); }
  }
}
