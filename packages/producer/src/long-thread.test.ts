import { describe, expect, it, vi } from 'vitest';
import { comparisonObservationSchema, createCalibrationFixture, createLongThreadFixture, LONG_THREAD_SUITE, payloadBytes, type ComparisonObservation } from '@chat-ui-bench/contract';
import * as replayApi from './replay.js';
import * as serverApi from './server.js';

const fixture = () => createLongThreadFixture({historyCount: 100, responseBytes: 6400, journey: 'follow'});
function harness(options: {backpressure?: boolean; throwWrite?: boolean; writeAdvance?: number} = {}) {
  let now = 1000, callback: (() => void) | undefined, ended = 0, cleared = 0;
  const deadlines: number[] = [], frames: string[] = [], logs: ComparisonObservation[] = [];
  const input = {repetition: 'round-2-case-1', now: () => now,
    timer: {set: (fn: () => void, delay: number) => {callback = fn; deadlines.push(now + delay - 1000); return 1;}, clear: () => {callback = undefined; cleared++;}},
    writer: {write: (frame: string) => {if (options.throwWrite) throw new Error('socket broke'); frames.push(frame); now += options.writeAdvance ?? 0; return !options.backpressure;}, end: () => ended++},
    record: (entry: ComparisonObservation) => logs.push(entry)};
  const replay = replayApi.startLongThreadReplay(fixture(), input);
  return {replay, deadlines, frames, logs, fire: (time: number) => {now = time + 1000; const fn = callback; callback = undefined; fn?.();}, ended: () => ended, cleared: () => cleared, input};
}
describe('canonical long thread producer', () => {
  it('exports explicit v2 entrypoints and rejects v1, unknown versions and noncanonical data before allocating a timer', () => {
    expect(replayApi.startLongThreadReplay).toBeTypeOf('function');
    expect(serverApi.createLongThreadReplayServer).toBeTypeOf('function');
    const timer = {set: vi.fn(), clear: vi.fn()};
    const now = vi.fn(() => 0);
    const changed = fixture(); changed.history[0]!.text = 'X' + changed.history[0]!.text.slice(1);
    for (const input of [createCalibrationFixture(), {...fixture(), schemaVersion: 3}, changed]) {
      expect(() => replayApi.startLongThreadReplay(input, {repetition: 'r', timer, now, writer: {write: () => true, end: () => {}}, record: () => {}})).toThrow();
    }
    expect(timer.set).not.toHaveBeenCalled(); expect(now).not.toHaveBeenCalled();
    expect(() => replayApi.startReplay(fixture(), {} as replayApi.ReplayOptions)).toThrow();
  });
  it('records v2 evidence for actual writes and emission time while keeping original deadlines without acknowledgments', () => {
    const h = harness({backpressure: true, writeAdvance: 3});
    h.input.repetition = 'changed';
    expect(h.replay.suite).toBe(LONG_THREAD_SUITE); expect(h.replay.repetition).toBe('round-2-case-1');
    h.fire(20);
    expect(h.deadlines).toEqual([0, 50]);
    const first = h.logs[0]!;
    expect(first).toMatchObject({schemaVersion: 2, kind: 'producer-emission', repetition: h.replay.repetition, clockDomain: 'producer-monotonic-ms', timestampMs: 23, data: {scheduledMs: 0, emittedMs: 23, latenessMs: 23, backpressure: true}});
    h.fire(170);
    expect(h.deadlines.at(-1)).toBe(200);
    h.fire(10000);
    expect(h.frames).toHaveLength(202); expect(h.replay.state).toBe('complete'); expect(h.ended()).toBe(1);
    h.logs.forEach((entry, i) => {
      expect(comparisonObservationSchema.safeParse(entry).success).toBe(true);
      expect(entry.kind).toBe('producer-emission');
      if (entry.kind !== 'producer-emission') throw new Error('Expected emission');
      const json = h.frames[i]!.split('data: ')[1]!.trim();
      expect(entry.data.event).toEqual(JSON.parse(json));
      expect(entry.data.eventBytes).toBe(payloadBytes(json)); expect(entry.data.payloadBytes).toBe(payloadBytes(entry.data.event.text));
      expect(entry.sequence).toBe(i);
    });
    h.replay.disconnect(); h.replay.dispose(); expect(h.ended()).toBe(1);
  });
  it.each(['disconnect', 'dispose', 'write-error'] as const)('records a single producer-clock terminal failure for %s', action => {
    const h = harness({throwWrite: action === 'write-error'});
    if (action === 'write-error') h.fire(10); else if (action === 'disconnect') h.replay.disconnect(); else h.replay.dispose();
    h.replay.disconnect(); h.replay.dispose(); h.fire(10000);
    expect(h.replay.state).toBe(action === 'dispose' ? 'disposed' : 'failed');
    expect(h.frames).toHaveLength(0); expect(h.logs).toHaveLength(1); expect(h.ended()).toBe(1);
    expect(h.logs[0]).toMatchObject({schemaVersion: 2, kind: 'producer-failure', clockDomain: 'producer-monotonic-ms', repetition: 'round-2-case-1', sequence: 0, data: {stage: action === 'dispose' ? 'disposal' : 'replay', reason: action === 'write-error' ? 'write-error: socket broke' : action === 'dispose' ? 'runner-disposal' : 'disconnect'}});
    expect(comparisonObservationSchema.safeParse(h.logs[0]).success).toBe(true);
    if (action !== 'write-error') expect(h.cleared()).toBe(1);
  });
  it('validates canonical server input before listening', async () => {
    const changed = fixture(); changed.history[0]!.text = 'X' + changed.history[0]!.text.slice(1);
    await expect(serverApi.createLongThreadReplayServer({fixture: changed, repetition: 'r', port: -1})).rejects.toThrow(/canonical/i);
    await expect(serverApi.createLongThreadReplayServer({fixture: {...fixture(), schemaVersion: 99}, repetition: 'r', port: -1})).rejects.toThrow();
  });
  it('retains client disconnection evidence without reconnect or another terminal record', async () => {
    const server = await serverApi.createLongThreadReplayServer({fixture: fixture(), repetition: 'disconnect-r'});
    try {
      const controller = new AbortController();
      const response = await fetch(server.url, {signal: controller.signal});
      await response.body!.getReader().read(); controller.abort();
      await vi.waitFor(() => expect(server.state).toBe('failed'));
      expect((await fetch(server.url)).status).toBe(409);
      const entries = server.drain();
      expect(entries.at(-1)).toMatchObject({schemaVersion: 2, kind: 'producer-failure', repetition: 'disconnect-r', clockDomain: 'producer-monotonic-ms', data: {stage: 'replay', reason: 'disconnect'}});
      expect(entries.every(e => comparisonObservationSchema.safeParse(e).success)).toBe(true);
      await server.close(); expect(server.drain()).toEqual([]);
    } finally {await server.close();}
  });
  it('binds drained v2 HTTP evidence to its immutable suite/repetition and rejects a second client', async () => {
    const options = {fixture: fixture(), repetition: 'http-r'};
    const server = await serverApi.createLongThreadReplayServer(options);
    options.repetition = 'changed';
    try {
      expect(server.suite).toBe(LONG_THREAD_SUITE); expect(server.repetition).toBe('http-r');
      const response = await fetch(server.url);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      const reader = response.body!.getReader(); const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain('assistant-start');
      expect((await fetch(server.url)).status).toBe(409);
      expect((await fetch(server.url, {method: 'POST', body: 'ack'})).status).toBe(404);
      await server.close(); await server.close();
      const entries = server.drain();
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries.every(e => e.schemaVersion === 2 && e.repetition === server.repetition && comparisonObservationSchema.safeParse(e).success)).toBe(true);
      expect(entries.at(-1)).toMatchObject({kind: 'producer-failure', data: {stage: 'disposal', reason: 'runner-disposal'}});
      expect(server.drain()).toEqual([]); expect(server.state).toBe('disposed');
      await reader.cancel().catch(() => {});
    } finally {await server.close();}
  });
});
