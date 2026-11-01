import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatrixCase } from '../../../tools/competitor-comparison/matrix-fixtures-v3.mjs';
test('context loader consumes bulk text with explicit protocol and refuses mismatches', async () => {
  const { loadContext } = await import('../src/context.ts');
  const context = createMatrixCase({ profile: 'assistant-ui', historyCount: 10000, responseBytes: 262144, journey: 'follow' }).publicContext;
  const body = JSON.stringify(context);
  assert.ok(body.length > 131072);
  assert.deepEqual(await loadContext(new Response(body, { headers: { 'x-chat-ui-bench-protocol': 'matrix-v3' } })), context);
  await assert.rejects(loadContext(new Response(body)));
  await assert.rejects(loadContext(new Response(body, { headers: { 'x-chat-ui-bench-protocol': 'unknown' } })));
  await assert.rejects(loadContext(new Response('', { status: 500 })), /Context request failed/);
});
