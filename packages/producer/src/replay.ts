import { performance } from 'node:perf_hooks';
import { LONG_THREAD_SUITE, payloadBytes, validateFixture, validateCanonicalLongThreadFixture, type Observation, type ComparisonObservation, type ReplayEvent } from '@chat-ui-bench/contract';

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
export interface LongThreadReplayOptions extends Omit<ReplayOptions, 'record'> {
  record: (observation: ComparisonObservation) => void;
}
export interface LongThreadReplaySession extends ReplaySession {
  readonly suite: typeof LONG_THREAD_SUITE;
  readonly repetition: string;
}
const nodeTimer: ReplayTimer = {
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Deadlines always refer to the original monotonic origin, regardless of lateness/backpressure. */
export function startReplay(input: unknown, options: ReplayOptions): ReplaySession {
  const fixture = validateFixture(input);
  const record = (kind: string, sequence: number | null, timestampMs: number, data: Observation['data']) => options.record({
    schemaVersion: 1, kind, clockDomain: 'producer-monotonic-ms', repetition: options.repetition,
    phase: 'streaming-auto-follow', sequence, timestampMs, data,
  });
  return startTimedReplay(fixture.events, options, {
    emission: (event, json, accepted, actualMs) => record('producer-send', event.sequence, actualMs, {
      scheduledMs: event.scheduledMs, actualMs, latenessMs: actualMs - event.scheduledMs,
      payloadBytes: payloadBytes(event.text), eventBytes: payloadBytes(json), backpressure: !accepted,
    }),
    failure: (reason, sequence, timestampMs) => record('producer-failure', sequence, timestampMs, {reason}),
  });
}

/** Canonical v2 fixtures retain their version; validation precedes clock/timer allocation. */
export function startLongThreadReplay(input: unknown, options: LongThreadReplayOptions): LongThreadReplaySession {
  const fixture = validateCanonicalLongThreadFixture(input);
  const repetition = options.repetition;
  if (!repetition.trim()) throw new Error('Repetition must not be empty');
  const phase = fixture.workload.journey === 'follow' ? 'streaming-follow' : 'history-reading';
  const session = startTimedReplay(fixture.events, options, {
    sampleEmissionTime: true,
    emission: (event, json, accepted, _actualMs, emittedMs) => options.record({
      schemaVersion: 2, kind: 'producer-emission', clockDomain: 'producer-monotonic-ms', repetition,
      phase, sequence: event.sequence, timestampMs: emittedMs,
      data: {event, scheduledMs: event.scheduledMs, emittedMs, latenessMs: emittedMs - event.scheduledMs,
        payloadBytes: payloadBytes(event.text), eventBytes: payloadBytes(json), backpressure: !accepted},
    }),
    failure: (reason, sequence, timestampMs) => options.record({
      schemaVersion: 2, kind: 'producer-failure', clockDomain: 'producer-monotonic-ms', repetition,
      phase: reason === 'runner-disposal' ? 'disposal' : phase, sequence, timestampMs,
      data: {stage: reason === 'runner-disposal' ? 'disposal' : 'replay', reason},
    }),
  });
  return {get suite() {return LONG_THREAD_SUITE;}, get repetition() {return repetition;},
    get state() {return session.state;}, disconnect: () => session.disconnect(), dispose: () => session.dispose()};
}

/** The same independently timed engine drives both versioned evidence formats. */
function startTimedReplay(events: readonly ReplayEvent[], options: Omit<ReplayOptions, 'record'>, evidence: {
  sampleEmissionTime?: boolean;
  emission(event: ReplayEvent, json: string, accepted: boolean, actualMs: number, emittedMs: number): void;
  failure(reason: string, sequence: number | null, timestampMs: number): void;
}): ReplaySession {
  const now = options.now ?? (() => performance.now());
  const timer = options.timer ?? nodeTimer;
  const origin = now();
  let state: ReplayState = 'running';
  let index = 0;
  let pending: unknown;
  const cancelTimer = () => { if (pending !== undefined) { timer.clear(pending); pending = undefined; } };
  const fail = (reason: string) => {
    if (state !== 'running') return;
    state = 'failed'; cancelTimer();
    evidence.failure(reason, events[index]?.sequence ?? null, now() - origin);
    options.writer.end();
  };
  const tick = () => {
    pending = undefined;
    if (state !== 'running') return;
    while (index < events.length) {
      const event = events[index]!;
      const actualMs = now() - origin;
      if (actualMs < event.scheduledMs) {
        pending = timer.set(tick, event.scheduledMs - actualMs);
        return;
      }
      const json = JSON.stringify(event);
      let accepted: boolean;
      try { accepted = options.writer.write(`id: ${event.sequence}\ndata: ${json}\n\n`); }
      catch (error) { fail(`write-error: ${error instanceof Error ? error.message : String(error)}`); return; }
      evidence.emission(event, json, accepted, actualMs, evidence.sampleEmissionTime ? now() - origin : actualMs);
      index++;
    }
    state = 'complete'; options.writer.end();
  };
  pending = timer.set(tick, Math.max(0, events[0]!.scheduledMs));
  return {
    get state() { return state; },
    disconnect: () => fail('disconnect'),
    dispose: () => { if (state === 'running') { fail('runner-disposal'); state = 'disposed'; } else cancelTimer(); },
  };
}
