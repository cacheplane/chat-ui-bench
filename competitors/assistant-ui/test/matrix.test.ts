import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatrixCase } from '../../../tools/competitor-comparison/matrix-fixtures-v3.mjs';
import { createBridge } from '../src/bridge.ts';

function setup(h = 1000) {
  const context = createMatrixCase({ profile: 'assistant-ui', historyCount: h, responseBytes: 262144, journey: 'follow' }).publicContext;
  const history = context.history.map((m: any) => ({ id: m.id, role: m.role, content: [{ type: 'text', text: m.text }] }));
  let state: any = { isRunning: false, messages: history }, calls = 0, unsubscribed = 0;
  const listeners = new Set<() => void>();
  const thread = { getState() { calls++; return state; }, subscribe(fn: () => void) { listeners.add(fn); return () => { unsubscribed++; listeners.delete(fn); }; }, startRun() {}, cancelRun() {} };
  const bridge = createBridge(thread, { async dispose() {} }, () => {}, context);
  return { bridge, history, context, thread, get calls() { return calls; }, get unsubscribed() { return unsubscribed; },
    emit(next: any) { state = next; for (const fn of listeners) fn(); } };
}
const assistant = (text = '', extra = {}) => ({ id: 'actual-opaque-sdk-id', role: 'assistant', content: [{ type: 'text', text }], status: { type: 'running' }, ...extra });

for (const h of [100, 1000, 10000]) test(`matrix H${h} progress reads cached actual tail without history traversal or response joining`, async () => {
  const s = setup(h), b = s.bridge;
  assert.equal(s.calls, 1, 'one initial public snapshot');
  assert.equal(b.readProgress().messageCount, h);
  assert.equal(b.readProgress().responseCharacters, null);
  b.start();
  const response = assistant();
  const guarded = (array: any[]) => new Proxy(array, { get(target, key) {
    if (key === 'length' || key === String(h - 1) || key === String(h)) return Reflect.get(target, key);
    throw new Error(`history traversal ${String(key)}`);
  } });
  s.emit({ isRunning: true, messages: guarded([...s.history, response]) });
  assert.equal(s.calls, 2, 'one refresh per public notification');
  assert.equal(b.readProgress().responseCharacters, 0);
  response.content = new Proxy([{ type: 'text', text: 'x'.repeat(131072) }, { type: 'text', text: 'y'.repeat(131072) }], {
    get(target, key) { if (key === 'join' || key === 'map') throw new Error('response reconstruction'); return Reflect.get(target, key); },
  });
  s.emit({ isRunning: true, messages: guarded([...s.history, response]) });
  const calls = s.calls;
  for (let i = 0; i < 20; i++) assert.equal(b.readProgress().responseCharacters, 262144);
  assert.equal(s.calls, calls);
  assert.equal(b.readResponse()?.text, 'x'.repeat(131072) + 'y'.repeat(131072));
  response.status = { type: 'complete' };
  s.emit({ isRunning: false, messages: guarded([...s.history, response]) });
  await b.waitForRun();
  assert.equal(b.readProgress().responseId, response.id);
  assert.equal(b.readProgress().operation.status, 'fulfilled');
  await b.dispose(); assert.equal(s.unsubscribed, 1);
});

test('matrix boundary identity remains fixed even when an SDK object is mutated in place', async () => {
  const s = setup(100); s.bridge.start();
  s.history.at(-1).id = 'mutated-in-place';
  s.emit({ isRunning: true, messages: [...s.history, assistant()] });
  await assert.rejects(s.bridge.waitForRun(), /boundary/);
  await s.bridge.dispose();
});

test('matrix progress retains a synchronous original SDK start failure', async () => {
  const s = setup(100), original = new Error('original SDK start failure');
  s.thread.startRun = () => { throw original; };
  assert.throws(() => s.bridge.start(), (cause) => cause === original);
  await assert.rejects(s.bridge.waitForRun(), (cause) => cause === original);
  assert.match(s.bridge.readProgress().error!, /original SDK start failure/);
  await s.bridge.dispose();
});

test('matrix rejects and latches invalid actual tail transitions, including repaired nonprose', async () => {
  for (const mutate of [
    (s: any) => s.history.slice(1),
    (s: any) => [...s.history, assistant(), assistant()],
    (s: any) => [...s.history.slice(0, -1), { ...s.history.at(-1), id: 'changed-boundary' }, assistant()],
    (s: any) => [...s.history, assistant('', { role: 'tool' })],
    (s: any) => [...s.history, assistant('', { id: s.history[0].id })],
    (s: any) => [...s.history, assistant('', { content: [{ type: 'text', text: 'valid' }, { type: 'reasoning', text: 'invalid' }] })],
    (s: any) => [...s.history, assistant('', { status: { type: 'requires-action' } })],
    (s: any) => [...s.history, assistant('', { status: { type: 'incomplete', reason: 'error', error: 'original fault' } })],
  ]) {
    const s = setup(); s.bridge.start();
    assert.doesNotThrow(() => s.emit({ isRunning: true, messages: mutate(s) }));
    await assert.rejects(s.bridge.waitForRun());
    s.emit({ isRunning: false, messages: [...s.history, assistant('fixed', { status: { type: 'complete' } })] });
    assert.equal(s.bridge.readProgress().operation.status, 'rejected');
    assert.ok(s.bridge.readProgress().error);
    await s.bridge.dispose();
  }
});

test('matrix rejects native identity replacement/removal and retains full bookend checks', async () => {
  for (const remove of [false, true]) {
    const s = setup(); s.bridge.start();
    s.emit({ isRunning: true, messages: [...s.history, assistant()] });
    s.emit({ isRunning: true, messages: remove ? s.history : [...s.history, assistant('', { id: 'replaced' })] });
    await assert.rejects(s.bridge.waitForRun(), /identity|removed/i);
    await s.bridge.dispose();
  }
  const s = setup(); s.history[4].content = [{ type: 'reasoning', text: 'corrupt middle' }];
  assert.throws(() => s.bridge.read(), /non-prose/); await s.bridge.dispose();
});

test('all cleanup stages run after cancel/source/unsubscribe failure and preserve causes', async () => {
  const s = setup(); const stages: string[] = [];
  const cancel = new Error('original cancel'), drain = new Error('original source drain');
  s.thread.cancelRun = () => { stages.push('cancel'); throw cancel; };
  s.thread.subscribe = () => () => { stages.push('unsubscribe'); throw new Error('unsubscribe'); };
  const b = createBridge(s.thread, { async dispose() { stages.push('source'); throw drain; } }, () => { stages.push('unmount'); }, s.context);
  b.start(); const run = assert.rejects(b.waitForRun(), /disposed/);
  const cleanup = b.dispose(); assert.equal(b.dispose(), cleanup);
  await assert.rejects(cleanup, (error: any) => error instanceof AggregateError && error.errors.includes(cancel) && error.errors.includes(drain));
  await run;
  assert.deepEqual(stages, ['cancel', 'source', 'unsubscribe', 'unmount']);
  s.thread.cancelRun = () => {};
  await s.bridge.dispose();
});
