import { expect, it } from 'vitest';
import { collectRetention } from './retention.js';

it('GC and baseline/post snapshots bracket exactly five resets outside tracing', async () => {
  const calls: string[] = [];
  const result = await collectRetention({
    setPhase: async () => { calls.push('retention'); },
    gc: async () => { calls.push('gc'); },
    snapshot: async name => { calls.push(name); return `${name}.heapsnapshot`; },
    reset: async () => { calls.push('reset'); },
  });
  expect(calls).toEqual(['retention', 'gc', 'baseline', 'reset', 'reset', 'reset', 'reset', 'reset', 'gc', 'post']);
  expect(result).toEqual({ status: 'available', value: { baseline: 'baseline.heapsnapshot', post: 'post.heapsnapshot', resets: 5, ownershipAnalysis: 'offline-required' } });
});
it('unsupported snapshots leave retention explicitly unvalidated', async () => {
  const result = await collectRetention({ setPhase: async () => {}, gc: async () => { throw new Error('unsupported'); }, snapshot: async () => '', reset: async () => {} });
  expect(result.status).toBe('unavailable');
  if (result.status === 'unavailable') expect(result.reason).toContain('unsupported');
});
