import { describe, expect, it } from 'vitest';
import { PageObservations } from './observations.js';
import { type ReplayEvent } from '@chat-ui-bench/contract';
const deltas: ReplayEvent[] = ['a', '🙂', 'c'].map((text, i) => ({ sequence: i + 1, scheduledMs: i * 50, messageId: 'a', type: 'text-delta', text }));
describe('active response DOM checkpoints', () => {
  it('maps all three satisfied cumulative prefixes to one checkpoint time', () => {
    const o = new PageObservations('r1', () => 99);
    deltas.forEach(e => o.receive(e));
    o.checkpoint('a🙂c', 150);
    const mapped = o.drain().filter(e => e.kind === 'dom-checkpoint');
    expect(mapped.map(e => [e.sequence, e.timestampMs])).toEqual([[1, 150], [2, 150], [3, 150]]);
    expect(mapped[1]!.data).toMatchObject({ characterLength: 3, utf8Bytes: 5 });
  });
  it('records positive DOM backlog for a partial visible batch', () => {
    const o = new PageObservations('r1', () => 99);
    deltas.forEach(e => o.receive(e));
    o.checkpoint('a', 150);
    expect(o.drain().findLast(e => e.kind === 'dom-backlog')?.data.backlog).toBe(2);
  });
  it('samples backlog on receipts while display is unchanged, before a later flush', () => {
    const o = new PageObservations('r1', () => 99);
    deltas.forEach(e => o.receive(e));
    expect(o.drain().filter(e => e.kind === 'dom-backlog').map(e => e.data.backlog)).toEqual([1, 2, 3]);
  });
  it('checks exact text prefixes, not only the visible length', () => {
    const o = new PageObservations('r1', () => 99);
    deltas.forEach(e => o.receive(e));
    o.checkpoint('z🙂c', 150);
    expect(o.drain().filter(e => e.kind === 'dom-checkpoint')).toHaveLength(0);
  });
  it('incremental drains do not duplicate observations and phase applies at collection time', () => {
    const o = new PageObservations('r1', () => 99);
    o.receive(deltas[0]!);
    expect(o.drain().filter(e => e.kind === 'receipt')).toHaveLength(1);
    expect(o.drain()).toHaveLength(0);
  });
  it('attributes deferred performance entries to the phase at event start, not observer delivery', () => {
    let now = 10;
    const o = new PageObservations('r1', () => now);
    o.setPhase('composer-input');
    now = 100; o.setPhase('validation');
    o.recordPerformance('event-timing', { duration: 24 }, 25);
    expect(o.drain().find(e => e.kind === 'event-timing')).toMatchObject({ phase: 'composer-input', timestampMs: 25, data: { observedAtMs: 100 } });
  });
});
