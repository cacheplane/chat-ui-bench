import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AssistantRuntimeProvider, useLocalRuntime, type AssistantRuntime } from '@assistant-ui/react';
import { createBridge } from '../src/bridge.ts';
import { createSource } from '../src/adapter.ts';

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
