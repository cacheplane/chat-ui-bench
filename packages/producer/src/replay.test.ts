import { describe, expect, it } from 'vitest';
import { startReplay } from './replay.js';
import { createCalibrationFixture, type Observation } from '@chat-ui-bench/contract';

function harness(backpressure = false) {
  let now = 0;
  let callback: (() => void) | undefined;
  const deadlines: number[] = [];
  const frames: string[] = [];
  const logs: Observation[] = [];
  let cleared = 0, ended = 0;
  const fixture = createCalibrationFixture();
  fixture.events = fixture.events.slice(0, 3).concat({ sequence: 3, scheduledMs: 150, messageId: 'response-100', type: 'assistant-complete', text: '' });
  fixture.events[0]!.scheduledMs = 100;
  fixture.events[1]!.scheduledMs = 150;
  fixture.events[2]!.scheduledMs = 150;
  const replay = startReplay(fixture, {
    repetition: 'r1', now: () => now,
    timer: { set: (fn: () => void, delay: number) => { callback = fn; deadlines.push(now + delay); return 1; }, clear: () => { callback = undefined; cleared++; } },
    writer: { write: (frame: string) => { frames.push(frame); return !backpressure; }, end: () => ended++ },
    record: (entry: Observation) => logs.push(entry),
  });
  return { replay, deadlines, frames, logs, fire: (time: number) => { now = time; const fn = callback; callback = undefined; fn?.(); }, cleared: () => cleared, ended: () => ended };
}
describe('independent monotonic replay', () => {
  it('preserves v1 clock sampling and emitted observation bytes', () => {
    const fixture = createCalibrationFixture();
    fixture.events = [fixture.events[0]!, {sequence: 1, scheduledMs: 0, messageId: 'response-100', type: 'assistant-complete', text: ''}];
    let sample = 0, callback: (() => void) | undefined;
    const logs: Observation[] = [];
    startReplay(fixture, {repetition: 'r1', now: () => sample++ * 10,
      timer: {set: fn => {callback = fn; return 1;}, clear: () => {}},
      writer: {write: () => true, end: () => {}}, record: entry => logs.push(entry)});
    callback!();
    expect(logs.map(entry => entry.timestampMs)).toEqual([10, 20]);
    expect(sample).toBe(3);
    expect(logs.map(entry => entry.data.actualMs)).toEqual([10, 20]);
  });
  it('logs event planned at 100 and sent at 170 with 70ms lateness; preserves order and deadlines', () => {
    const h = harness();
    expect(h.deadlines).toEqual([100]);
    h.fire(170);
    expect(h.logs.filter(l => l.kind === 'producer-send').map(l => l.sequence)).toEqual([0, 1, 2, 3]);
    expect(h.logs[0]!.data).toMatchObject({ scheduledMs: 100, actualMs: 170, latenessMs: 70 });
    expect(h.logs[1]!.data.scheduledMs).toBe(150);
    expect(h.replay.state).toBe('complete');
    expect(h.ended()).toBe(1);
  });
  it('a late callback does not shift the next future deadline', () => {
    const h = harness();
    h.fire(120);
    expect(h.deadlines).toEqual([100, 150]);
    expect(h.frames).toHaveLength(1);
  });
  it('records write(false) as backpressure and keeps sending without browser acknowledgments', () => {
    const h = harness(true);
    h.fire(170);
    expect(h.frames).toHaveLength(4);
    expect(h.logs.filter(l => l.kind === 'producer-send').every(l => l.data.backpressure === true)).toBe(true);
  });
  it('disconnect cancels the pending timer and records terminal failure without retry', () => {
    const h = harness();
    h.replay.disconnect();
    h.fire(170);
    expect(h.frames).toHaveLength(0);
    expect(h.cleared()).toBe(1);
    expect(h.replay.state).toBe('failed');
    expect(h.logs.at(-1)).toMatchObject({ kind: 'producer-failure', data: { reason: 'disconnect' } });
  });
  it('validates fixtures before allocating a timer', () => {
    const fixture = createCalibrationFixture();
    fixture.events[1]!.sequence = 0;
    expect(() => startReplay(fixture, {})).toThrow(/sequence/i);
  });
});
