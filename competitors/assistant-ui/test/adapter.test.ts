import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { createBridge } from '../src/bridge.ts';
const load = async () => {
  const path = new URL('../src/adapter.ts', import.meta.url);
  assert.ok(existsSync(path), 'owned LocalRuntime model adapter must exist');
  return import(path.href);
};
test('actual reader fault becomes public SDK error and rejecting original operation without an unhandled rejection', async () => {
  const { createSource } = await load();
  const source = createSource({ threadId: 'thread', runId: 'run' }, async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('authored reader fault')); },
  }), { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } }));
  let state: any = { isRunning: false, messages: [{ id: 'u', role: 'user', content: [{ type: 'text', text: 'input' }] }] };
  const subscribers = new Set<() => void>();
  const emit = () => { for (const fn of subscribers) fn(); };
  const thread = { getState: () => state, subscribe: (fn: () => void) => { subscribers.add(fn); return () => subscribers.delete(fn); },
    startRun() {
      state = { isRunning: true, messages: [...state.messages, { id: 'sdk-generated', role: 'assistant', content: [], status: { type: 'running' } }] }; emit();
      void (async () => {
        for await (const value of source.adapter.run({ abortSignal: new AbortController().signal })) {
          state.messages[1] = { ...state.messages[1], ...value }; emit();
        }
        state.isRunning = false; emit();
      })();
    }, cancelRun() {} };
  const unhandled: unknown[] = [];
  const listener = (error: unknown) => { unhandled.push(error); };
  process.on('unhandledRejection', listener);
  try {
    const bridge = createBridge(thread, source, () => {});
    bridge.start();
    await assert.rejects(bridge.waitForRun(), /authored reader fault/);
    assert.equal(bridge.read().operation.status, 'rejected');
    assert.match(bridge.read().error!, /authored reader fault/);
    await assert.rejects(source.readerOperation, /authored reader fault/);
    await bridge.dispose();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});
test('dispose cancels a real pending source reader and awaits its termination', async () => {
  const { createSource } = await load();
  let cancelled = false;
  const source = createSource({ threadId: 'thread', runId: 'run' }, async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  }));
  const iterator = source.adapter.run({ abortSignal: new AbortController().signal });
  const pending = iterator.next();
  await Promise.resolve(); await Promise.resolve();
  await source.dispose();
  const value = await pending;
  assert.equal(value.value.status.reason, 'cancelled');
  await iterator.return();
  assert.equal(cancelled, true);
  await assert.rejects(source.readerOperation, { name: 'AbortError' });
});
