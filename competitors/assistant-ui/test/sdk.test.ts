import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AssistantRuntimeProvider, useLocalRuntime, type AssistantRuntime } from '@assistant-ui/react';
import { createBridge } from '../src/bridge.ts';
import { createSource } from '../src/adapter.ts';
import { createMatrixCase } from '../../../tools/competitor-comparison/matrix-fixtures-v3.mjs';

test('installed SDK hydrates exact history, starts no extra user, and exposes actual reader failure', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  let runtime: AssistantRuntime | undefined;
  const source = createSource({ threadId: 'test-thread', runId: 'test-run' }, async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('installed SDK reader fault')); },
  }), { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } }));
  const history = Array.from({ length: 100 }, (_, i) => ({ id: `history-${i}`, role: i % 2 ? 'user' as const : 'assistant' as const,
    content: [{ type: 'text' as const, text: `history-text-${i}` }], createdAt: new Date('2026-01-01T00:00:00Z') }));
  function Probe() {
    runtime = useLocalRuntime(source.adapter, { initialMessages: history });
    return createElement(AssistantRuntimeProvider, { runtime }, createElement('span', null, 'probe'));
  }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => { root.render(createElement(Probe)); });
  assert.ok(runtime);
  assert.equal(runtime.thread.getState().messages.length, 100);
  assert.deepEqual(runtime.thread.getState().messages.map((message) => message.id), history.map((message) => message.id));
  const bridge = createBridge(runtime.thread, source, () => root.unmount());
  await act(async () => {
    bridge.start();
    await assert.rejects(bridge.waitForRun(), /installed SDK reader fault/);
  });
  const state = bridge.read();
  assert.equal(state.messages.length, 101);
  assert.equal(state.messages[99].role, 'user');
  assert.equal(state.messages[100].role, 'assistant');
  assert.equal(state.operation.status, 'rejected');
  assert.match(state.error!, /installed SDK reader fault/);
  assert.ok(state.responseId);
  await act(async () => { await bridge.dispose(); });
  dom.window.close();
});

for (const historyCount of [1000, 10000]) test(`installed SDK matrix H${historyCount} preserves full actual history and original completion/error`, async () => {
  for (const fault of [false, true]) {
    const value = createMatrixCase({ profile: 'assistant-ui', historyCount, responseBytes: 262144, journey: 'follow' });
    const context = value.publicContext;
    const deltas = value.fixture.events.filter((event: any) => event.type === 'text-delta');
    const expected = deltas.map((event: any) => event.text).join('');
    const events = [{ type: 'start', messageId: 'wire-id-not-sdk-id' }, { type: 'text-start', id: 't' },
      ...deltas.map((event: any) => ({ type: 'text-delta', id: 't', delta: event.text })),
      ...(fault ? [{ type: 'error', errorText: 'matrix original source fault' }] : [{ type: 'text-end', id: 't' }, { type: 'finish' }, '[DONE]'])];
    const wire = events.map((event) => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`).join('');
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
    let runtime: AssistantRuntime | undefined;
    const source = createSource(context, async () => new Response(wire, { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } }));
    const history = context.history.map((message: any) => ({ id: message.id, role: message.role,
      content: [{ type: 'text' as const, text: message.text }], createdAt: new Date('2026-01-01T00:00:00Z') }));
    function Probe() {
      runtime = useLocalRuntime(source.adapter, { initialMessages: history });
      return createElement(AssistantRuntimeProvider, { runtime }, createElement('span', null, 'probe'));
    }
    const root = createRoot(document.getElementById('root')!);
    await act(async () => { root.render(createElement(Probe)); });
    assert.ok(runtime);
    const bridge = createBridge(runtime.thread, source, () => root.unmount(), context);
    assert.deepEqual(bridge.read().messages, context.history);
    assert.equal(bridge.readProgress().messageCount, historyCount);
    await act(async () => {
      bridge.start();
      if (fault) await assert.rejects(bridge.waitForRun(), /matrix original source fault/);
      else await bridge.waitForRun();
    });
    const state = bridge.read();
    assert.deepEqual(state.messages.slice(0, historyCount), context.history);
    assert.equal(state.messages.length, historyCount + 1);
    if (fault) assert.throws(() => bridge.readResponse(), /matrix original source fault/);
    else assert.equal(bridge.readResponse()?.text, expected);
    assert.equal(state.operation.status, fault ? 'rejected' : 'fulfilled');
    if (fault) {
      assert.match(state.error!, /matrix original source fault/);
      await assert.rejects(source.readerOperation!, /matrix original source fault/);
    } else {
      const progress = bridge.readProgress();
      assert.equal(progress.responseCharacters, 262144);
      assert.equal(progress.responseId, state.messages[historyCount].id);
      assert.notEqual(progress.responseId, 'wire-id-not-sdk-id');
      await source.readerOperation;
    }
    await act(async () => { await bridge.dispose(); }); dom.window.close();
  }
});
