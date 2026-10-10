import { performance } from 'node:perf_hooks';
import { payloadBytes, validateFixture, type Observation } from '@chat-ui-bench/contract';

export interface ReplayTimer { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void }
export interface SSEWriter { write(frame: string): boolean; end(): void }
export interface ReplayOptions {
  repetition: string;
  writer: SSEWriter;
  record: (observation: Observation) => void;
  now?: () => number;
  timer?: ReplayTimer;
}
export type ReplayState = 'running' | 'complete' | 'failed' | 'disposed';
export interface ReplaySession { readonly state: ReplayState; disconnect(): void; dispose(): void }
const nodeTimer: ReplayTimer = {
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Deadlines always refer to the original monotonic origin, regardless of lateness/backpressure. */
export function startReplay(input: unknown, options: ReplayOptions): ReplaySession {
  const fixture = validateFixture(input);
  const now = options.now ?? (() => performance.now());
  const timer = options.timer ?? nodeTimer;
  const origin = now();
  let state: ReplayState = 'running';
  let index = 0;
  let pending: unknown;
  const record = (kind: string, sequence: number | null, timestampMs: number, data: Observation['data']) => options.record({
    schemaVersion: 1, kind, clockDomain: 'producer-monotonic-ms', repetition: options.repetition,
    phase: 'streaming-auto-follow', sequence, timestampMs, data,
  });
  const cancelTimer = () => { if (pending !== undefined) { timer.clear(pending); pending = undefined; } };
  const fail = (reason: string) => {
    if (state !== 'running') return;
    state = 'failed'; cancelTimer();
    record('producer-failure', fixture.events[index]?.sequence ?? null, now() - origin, { reason });
    options.writer.end();
  };
  const tick = () => {
    pending = undefined;
    if (state !== 'running') return;
    while (index < fixture.events.length) {
      const event = fixture.events[index]!;
      const actualMs = now() - origin;
      if (actualMs < event.scheduledMs) {
        pending = timer.set(tick, event.scheduledMs - actualMs);
        return;
      }
      const json = JSON.stringify(event);
      let accepted: boolean;
      try { accepted = options.writer.write(`id: ${event.sequence}\ndata: ${json}\n\n`); }
      catch (error) { fail(`write-error: ${error instanceof Error ? error.message : String(error)}`); return; }
      record('producer-send', event.sequence, actualMs, {
        scheduledMs: event.scheduledMs, actualMs, latenessMs: actualMs - event.scheduledMs,
        payloadBytes: payloadBytes(event.text), eventBytes: payloadBytes(json), backpressure: !accepted,
      });
      index++;
    }
    state = 'complete'; options.writer.end();
  };
  pending = timer.set(tick, Math.max(0, fixture.events[0]!.scheduledMs));
  return {
    get state() { return state; },
    disconnect: () => fail('disconnect'),
    dispose: () => { if (state === 'running') { fail('runner-disposal'); state = 'disposed'; } else cancelTimer(); },
  };
}
