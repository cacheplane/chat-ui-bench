import { expect, it } from 'vitest';
import { createCalibrationFixture } from '@chat-ui-bench/contract';
import { createReplayServer } from './server.js';
it('serves one validated loopback SSE repetition with CORS and rejects a second connection', async () => {
  const fixture = createCalibrationFixture();
  fixture.events = [fixture.events[0]!, { sequence: 1, scheduledMs: 0, messageId: 'response-100', type: 'assistant-complete', text: '' }];
  const server = await createReplayServer({ fixture, repetition: 'r1' });
  try {
    const response = await fetch(server.url);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const body = await response.text();
    expect(body).toContain('assistant-start');
    expect(body).toContain('assistant-complete');
    expect((await fetch(server.url)).status).toBe(409);
    expect(server.drain().filter((e: any) => e.kind === 'producer-send')).toHaveLength(2);
  } finally { await server.close(); }
});
