import assert from 'node:assert/strict';
import test from 'node:test';

const modulePath = new URL('../src/stream.ts', import.meta.url);
const load = async () => {
  assert.ok(await import('node:fs').then(({ existsSync }) => existsSync(modulePath)), 'stream adapter must exist');
  return import(modulePath.href);
};
const wire = (events: unknown[]) => events.map((event) => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\r\n\r\n`).join('');
function response(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }), { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } });
}
test('parses split SSE frames and UTF-8 into cumulative content without an oracle', async () => {
  const { readTextStream } = await load();
  const events = [{ type: 'start', messageId: 'native-server-id' }, { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'hello ' }, { type: 'text-delta', id: 't', delta: '世界' },
    { type: 'text-end', id: 't' }, { type: 'finish' }, '[DONE]'];
  const result = [];
  for await (const value of readTextStream(response(wire(events)), new AbortController().signal)) result.push(value);
  assert.deepEqual(result, ['hello ', 'hello 世界']);
});
test('verified complete EOF releases the reader without invoking cancel', async () => {
  const { readTextStream } = await load();
  const source = response(wire([{ type: 'start', messageId: 'x' }, { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'complete' }, { type: 'text-end', id: 't' }, { type: 'finish' }, '[DONE]']));
  const body = source.body!;
  const originalGetReader = body.getReader.bind(body);
  let cancellations = 0, releases = 0;
  (body as any).getReader = () => {
    const reader = originalGetReader();
    const originalCancel = reader.cancel.bind(reader), originalRelease = reader.releaseLock.bind(reader);
    reader.cancel = (reason?: unknown) => { cancellations++; return originalCancel(reason); };
    reader.releaseLock = () => { releases++; originalRelease(); };
    return reader;
  };
  for await (const _ of readTextStream(source, new AbortController().signal)) {}
  assert.equal(cancellations, 0, 'successful reader EOF must not trigger transport cancellation');
  assert.equal(releases, 1);
});
test('rejects incomplete, malformed, and errored streams', async () => {
  const { readTextStream } = await load();
  for (const events of [
    [{ type: 'start', messageId: 'x' }, { type: 'text-start', id: 't' }],
    [{ type: 'text-delta', id: 't', delta: 'orphan' }],
    [{ type: 'error', errorText: 'synthetic SDK failure' }],
  ]) await assert.rejects(async () => { for await (const _ of readTextStream(response(wire(events)), new AbortController().signal)) {} });
  await assert.rejects(async () => { for await (const _ of readTextStream(response('data: {bad}\n\n'), new AbortController().signal)) {} });
});
test('abort cancels an owned reader and does not report success', async () => {
  const { readTextStream } = await load();
  let cancelled = false;
  const controller = new AbortController();
  const result = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  });
  const work = (async () => { for await (const _ of readTextStream(result, controller.signal)) {} })();
  controller.abort();
  await assert.rejects(work, { name: 'AbortError' });
  assert.equal(cancelled, true);
});
test('abort awaits the original asynchronous reader cancellation before terminating', async () => {
  const { readTextStream } = await load();
  let release!: () => void, cancellationStarted = false, terminated = false;
  const originalCancellation = new Promise<void>((resolve) => { release = resolve; });
  const controller = new AbortController();
  const result = new Response(new ReadableStream({ cancel() {
    cancellationStarted = true;
    return originalCancellation;
  } }), { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } });
  const work = (async () => { for await (const _ of readTextStream(result, controller.signal)) {} })();
  void work.then(() => { terminated = true; }, () => { terminated = true; });
  controller.abort();
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(cancellationStarted, true);
    assert.equal(terminated, false, 'original cancellation is still pending');
  } finally {
    release();
    await assert.rejects(work, { name: 'AbortError' });
  }
  assert.equal(terminated, true);
});
