import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
const load = async () => {
  const path = new URL('../src/lifecycle.ts', import.meta.url);
  assert.ok(existsSync(path), 'public runtime transition observer must exist');
  return import(path.href);
};
function runtime() {
  let state: any = { isRunning: false, messages: [{ id: 'user-last', role: 'user', content: [{ type: 'text', text: 'question' }] }] };
  const listeners = new Set<() => void>();
  return { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
    publish(next: any) { state = next; for (const listener of [...listeners]) listener(); }, listeners };
}
test('completion observes a new actual assistant and settled public status', async () => {
  const { createTransition } = await load();
  const thread = runtime();
  const transition = createTransition(thread, ['user-last']);
  let complete = false;
  transition.promise.then(() => { complete = true; });
  thread.publish({ isRunning: true, messages: [...thread.getState().messages, { id: 'generated', role: 'assistant', content: [], status: { type: 'running' } }] });
  await Promise.resolve(); assert.equal(complete, false);
  thread.publish({ isRunning: false, messages: [{ id: 'generated', role: 'assistant', content: [{ type: 'text', text: 'answer' }], status: { type: 'complete', reason: 'stop' } }] });
  await transition.promise;
  assert.equal(transition.status, 'fulfilled');
  assert.equal(transition.responseId, 'generated');
  assert.equal(thread.listeners.size, 0);
});
test('SDK error and cancellation reject the retained transition', async () => {
  const { createTransition } = await load();
  for (const reason of ['error', 'cancelled']) {
    const thread = runtime(); const transition = createTransition(thread, ['user-last']);
    const rejected = assert.rejects(transition.promise);
    thread.publish({ isRunning: false, messages: [{ id: 'native', role: 'assistant', content: [], status: { type: 'incomplete', reason, error: { message: 'synthetic failure' } } }] });
    await rejected; assert.equal(transition.status, 'rejected'); assert.equal(thread.listeners.size, 0);
  }
});
test('disposal before any public state transition rejects and unsubscribes', async () => {
  const { createTransition } = await load();
  const thread = runtime(); const transition = createTransition(thread, ['user-last']);
  const rejected = assert.rejects(transition.promise, /disposed/);
  transition.dispose(); await rejected;
  assert.equal(thread.listeners.size, 0);
});
