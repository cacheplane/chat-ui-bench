import { expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { calibrationOrder, closeBrowserWithPage, runOwnedCapture, withDeadline } from './calibrate.js';
import { finishTrace, matchingStallObservation } from './capture.js';
import type { Observation } from '@chat-ui-bench/contract';

it('interleaves seven variants per round, defaulting to 21 fresh runs', () => {
  const runs = calibrationOrder();
  expect(runs).toHaveLength(21);
  expect(runs.slice(0, 7).map(run => run.variant)).toEqual(['clean', 'stall', 'delayed-display', 'scroll', 'omitted-delta', 'retention-release', 'retention-retain']);
  expect(new Set(runs.map(run => run.id)).size).toBe(21);
  expect(runs[7]?.round).toBe(2);
});
it('only validates a LoAF containing the full configured 120ms stall', () => {
  const base = { schemaVersion: 1, clockDomain: 'page-performance-ms', repetition: 'stall', phase: 'streaming-auto-follow', sequence: null } as const;
  const fault: Observation = { ...base, kind: 'fault-stall', timestampMs: 100, data: { durationMs: 120 } };
  const short: Observation = { ...base, kind: 'long-animation-frame', timestampMs: 99, data: { duration: 112 } };
  const matching: Observation = { ...base, kind: 'long-animation-frame', timestampMs: 99, data: { duration: 122 } };
  expect(matchingStallObservation([fault, short])).toBeUndefined();
  expect(matchingStallObservation([fault, matching])).toBe(matching);
});
it('creates fresh resources, preserves partial logs, and closes both resources after capture failure without retry', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-lifecycle-')); const calls: string[] = [];
  for (let i = 0; i < 2; i++) await runOwnedCapture(join(base, String(i)), {
    createServer: async () => ({ drain: () => [{ sequence: i }], close: async () => { calls.push('server-close'); } }),
    createBrowser: async () => { calls.push('browser-new'); return { close: async () => { calls.push('browser-close'); } }; },
    capture: async (_browser, _server, writer) => { await writer.append('page-observations.jsonl', [{ sequence: i }]); throw new Error('collection broken'); },
  });
  expect(calls).toEqual(['browser-new', 'browser-close', 'server-close', 'browser-new', 'browser-close', 'server-close']);
  expect(await readFile(join(base, '0', 'producer-events.jsonl'), 'utf8')).toContain('"sequence":0');
  expect(await readFile(join(base, '0', 'page-observations.jsonl'), 'utf8')).toContain('"sequence":0');
  expect(JSON.parse(await readFile(join(base, '0', 'validation.json'), 'utf8'))).toMatchObject({ status: 'failed', reasons: ['collection broken'] });
});
it('closes an already owned server when browser launch fails', async () => {
  let closed = 0; const base = await mkdtemp(join(tmpdir(), 'bench-launch-'));
  await runOwnedCapture(base, { createServer: async () => ({ drain: () => [], close: async () => { closed++; } }), createBrowser: async () => { throw new Error('launch failed'); }, capture: async () => {} });
  expect(closed).toBe(1);
});
it('records cleanup failure rather than losing the prior capture error', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-close-'));
  await runOwnedCapture(base, { createServer: async () => ({ drain: () => [], close: async () => { throw new Error('server failed'); } }), createBrowser: async () => ({ close: async () => { throw new Error('browser failed'); } }), capture: async () => { throw new Error('capture failed'); } });
  const validation = JSON.parse(await readFile(join(base, 'validation.json'), 'utf8'));
  expect(validation.reasons).toEqual(['capture failed', 'browser disposal: browser failed', 'server disposal: server failed']);
});
it('enforces deadlines explicitly', async () => {
  await expect(withDeadline(new Promise(() => {}), 10, 'replay')).rejects.toThrow('replay timed out after 10ms');
});
it('always attempts browser close when page disposal never responds', async () => {
  let closed = false;
  await expect(closeBrowserWithPage({ close: async () => { closed = true; } }, async () => { await new Promise(() => {}); }, 10)).rejects.toThrow('page disposal timed out');
  expect(closed).toBe(true);
});
it('starts disposal for all resources within one shared disposal phase deadline', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-disposal-')); const calls: string[] = [];
  let release!: () => void; const serverClosed = new Promise<void>(resolve => { release = resolve; });
  const result = await runOwnedCapture(base, {
    disposalMs: 100,
    createServer: async () => ({ drain: () => [], close: async () => { calls.push('server-close'); release(); } }),
    createBrowser: async () => ({ close: async () => { calls.push('browser-close'); await serverClosed; } }),
    capture: async () => {},
  });
  expect(calls).toEqual(['browser-close', 'server-close']); expect(result.status).toBe('valid');
});
it('a late browser factory result is closed after setup timeout and never captured', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-late-')); let closed = false; let captured = false;
  await runOwnedCapture(base, {
    setupMs: 10,
    createServer: async () => ({ drain: () => [], close: async () => {} }),
    createBrowser: async () => { await new Promise(resolve => setTimeout(resolve, 25)); return { close: async () => { closed = true; } }; },
    capture: async () => { captured = true; },
  });
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(closed).toBe(true); expect(captured).toBe(false);
});
it('subscribes before ending the trace, drains until EOF, closes stream and records data loss', async () => {
  const calls: string[] = []; let complete: ((event: { stream: string; dataLossOccurred: boolean }) => void) | undefined;
  const session = {
    once: (_event: string, handler: typeof complete) => { calls.push('subscribe'); complete = handler; },
    off: () => {},
    send: async (method: string) => { calls.push(method); if (method === 'Tracing.end') { complete!({ stream: 's', dataLossOccurred: true }); return {}; } if (method === 'IO.read') return { data: '{"traceEvents":[]}', eof: true }; return {}; },
  };
  const base = await mkdtemp(join(tmpdir(), 'bench-trace-'));
  const result = await finishTrace(session, join(base, 'trace.json'), 100);
  expect(calls).toEqual(['subscribe', 'Tracing.end', 'IO.read', 'IO.close']);
  expect(result).toMatchObject({ complete: false, lossReason: 'CDP reported trace data loss' });
  expect(JSON.parse(await readFile(join(base, 'trace.json'), 'utf8')).traceEvents).toEqual([]);
});
it('keeps an inspectable trace artifact when completion times out', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-trace-timeout-'));
  const result = await finishTrace({ once: () => {}, off: () => {}, send: async () => ({}) }, join(base, 'trace.json'), 10);
  expect(result.complete).toBe(false);
  expect(result.lossReason).toContain('timed out');
  expect(await readFile(join(base, 'trace.json'), 'utf8')).toBe('');
});
it('retains raw artifact and an explicit failure when trace completion omits the stream', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-trace-missing-stream-')); let callback: ((event: {}) => void) | undefined;
  const calls: string[] = [];
  const result = await finishTrace({ once: (_name, handler) => { callback = handler; }, off: () => {}, send: async method => {
    calls.push(method); if (method === 'Tracing.end') callback!({}); return {};
  } }, join(base, 'trace.json'), 100);
  expect(result).toEqual({ complete: false, lossReason: 'Tracing.tracingComplete omitted stream' });
  expect(calls).toEqual(['Tracing.end']);
  expect(await readFile(join(base, 'trace.json'), 'utf8')).toBe('');
});
it('treats a stream close failure as incomplete collection while retaining drained data', async () => {
  const base = await mkdtemp(join(tmpdir(), 'bench-trace-close-')); let callback: ((event: { stream: string }) => void) | undefined;
  const result = await finishTrace({ once: (_name, handler) => { callback = handler; }, off: () => {}, send: async method => {
    if (method === 'Tracing.end') { callback!({ stream: 's' }); return {}; }
    if (method === 'IO.read') return { data: '{"traceEvents":[]}', eof: true };
    throw new Error('IO.close rejected');
  } }, join(base, 'trace.json'), 100);
  expect(result.complete).toBe(false); expect(result.lossReason).toContain('IO.close rejected');
  expect(JSON.parse(await readFile(join(base, 'trace.json'), 'utf8')).traceEvents).toEqual([]);
});
