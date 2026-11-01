import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
const load = async () => {
  const path = new URL('../src/bridge.ts', import.meta.url);
  assert.ok(existsSync(path), 'SDK bridge must exist');
  return import(path.href);
};
test('bridge starts one continuation under last native user and reads SDK state', async () => {
  const { createBridge } = await load();
  let starts = 0, cancelled = 0, unmounted = 0, disposed = 0;
  let state: any = { isRunning: false, messages: [{ id: 'last-user', role: 'user', content: [{ type: 'text', text: 'SDK text' }] }] };
  const subscribers = new Set<() => void>();
  const thread = { getState: () => state, subscribe: (fn: () => void) => { subscribers.add(fn); return () => subscribers.delete(fn); },
    startRun({ parentId }: any) { starts++; assert.equal(parentId, 'last-user'); }, cancelRun() { cancelled++; } };
  const bridge = createBridge(thread, { async dispose() { disposed++; } }, () => { unmounted++; });
  assert.equal(bridge.selectors.returnToResponse, '.aui-thread-scroll-to-bottom');
  assert.equal(bridge.read().operation.status, 'idle');
  bridge.start(); assert.throws(() => bridge.start(), /already/); assert.equal(starts, 1);
  state = { isRunning: false, messages: [...state.messages, { id: 'native-id', role: 'assistant', content: [{ type: 'text', text: 'actual streamed' }], status: { type: 'complete', reason: 'stop' } }] };
  for (const fn of subscribers) fn();
  await bridge.waitForRun();
  assert.equal(bridge.read().messages.at(-1).text, 'actual streamed');
  assert.equal(bridge.read().responseId, 'native-id');
  await bridge.dispose(); await bridge.dispose();
  assert.deepEqual([cancelled, unmounted, disposed], [1, 1, 1]);
});
test('disposal aborts the source, rejects pending transition, and waits for original reader cleanup', async () => {
  const { createBridge } = await load();
  let release!: () => void, cleaned = false;
  const reader = new Promise<void>((resolve) => { release = resolve; });
  const state = { isRunning: false, messages: [{ id: 'u', role: 'user', content: [{ type: 'text', text: 'input' }] }] };
  const thread = { getState: () => state, subscribe: () => () => {}, startRun() {}, cancelRun() {} };
  const bridge = createBridge(thread, { async dispose() { await reader; cleaned = true; } }, () => {});
  bridge.start(); const rejected = assert.rejects(bridge.waitForRun(), /disposed/);
  const cleanup = bridge.dispose();
  await Promise.resolve(); assert.equal(cleaned, false);
  release(); await cleanup; await rejected;
  assert.equal(cleaned, true); assert.equal(bridge.read().operation.status, 'rejected');
});
test('prose bridge rejects extra reasoning/tool content and inapplicable SDK roles', async () => {
  const { createBridge } = await load();
  const state: any = { isRunning: false, messages: [{ id: 'native', role: 'assistant',
    content: [{ type: 'text', text: 'correct canonical text' }],
    metadata: { custom: { permitted: true } }, status: { type: 'complete', reason: 'stop' } }] };
  const thread = { getState: () => state, subscribe: () => () => {}, startRun() {}, cancelRun() {} };
  const bridge = createBridge(thread, { async dispose() {} }, () => {});
  assert.equal(bridge.read().messages[0].text, 'correct canonical text');
  for (const part of [{ type: 'reasoning', text: 'unexpected reasoning' }, { type: 'tool-call', toolName: 'unexpected' }]) {
    state.messages[0].content = [{ type: 'text', text: 'correct canonical text' }, part];
    assert.throws(() => bridge.read(), /non-prose/);
  }
  state.messages[0].content = [{ type: 'text', text: 'correct canonical text' }];
  state.messages[0].role = 'tool';
  assert.throws(() => bridge.read(), /Unexpected SDK message role/);
});
