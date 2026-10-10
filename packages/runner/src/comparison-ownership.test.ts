import {describe, expect, it, vi, afterEach} from 'vitest';
import {ComparisonOwnership, type ComparisonOwnershipContext} from './comparison-ownership.js';
afterEach(() => vi.useRealTimers());
describe('comparison ownership', () => {
  it('uses an absolute setup origin, delivers abort and revokes the generation', async () => {
    vi.useFakeTimers(); let now = 100; let context!: ComparisonOwnershipContext;
    const owner = new ComparisonOwnership({now: () => now});
    const result = owner.run('setup', async ctx => {context = ctx; await new Promise(() => {});});
    now = 59100; expect(context.remainingMs()).toBe(1000);
    now = 60100; await vi.advanceTimersByTimeAsync(60000);
    expect(await result).toMatchObject({status: 'expired', deadline: {startedAtHostMs: 100, deadlineAtHostMs: 60100, outcome: 'expired'}});
    expect(context.signal.aborted).toBe(true); expect(() => context.assertActive()).toThrow(); expect(owner.unsafeOutstanding).toBe(true);
  });
  it('records actual late finish time while retaining the expired outcome', async () => {
    vi.useFakeTimers(); let now = 0, release!: () => void;
    const owner = new ComparisonOwnership({now: () => now});
    const run = owner.run('setup', async () => {await new Promise<void>(r => release = r);});
    now = 60000; await vi.advanceTimersByTimeAsync(60000); await run;
    expect(owner.deadlines[0]?.finishedAtHostMs).toBeNull();
    now = 71000; release(); await owner.ownershipSettled;
    expect(owner.deadlines[0]).toMatchObject({outcome: 'expired', finishedAtHostMs: 71000});
  });
  it('does not adopt a resource after absolute expiry even if the timer callback has not run', async () => {
    vi.useFakeTimers(); let now = 0, closes = 0;
    const owner = new ComparisonOwnership({now: () => now});
    const run = owner.run('setup', async ctx => {now = 60001; await ctx.adopt({name: 'late', close: async () => {closes++;}});});
    await run; expect(closes).toBe(1); await owner.dispose();
  });
  it('closes late adopted resources once, without using them in another generation', async () => {
    vi.useFakeTimers(); let now = 0, resolve!: () => void, closes = 0;
    const owner = new ComparisonOwnership({now: () => now});
    const run = owner.run('setup', async ctx => {await new Promise<void>(r => resolve = r); await ctx.adopt({name: 'late-server', close: async () => {closes++;}});});
    now = 60000; await vi.advanceTimersByTimeAsync(60000); expect((await run).status).toBe('expired');
    resolve(); await owner.ownershipSettled; expect(closes).toBe(1); expect(owner.unsafeOutstanding).toBe(false);
  });
  it('starts all cleanup calls without serially waiting for stalled page cleanup', async () => {
    vi.useFakeTimers(); let now = 0, finish!: () => void; const starts: string[] = [];
    const owner = new ComparisonOwnership({now: () => now});
    await owner.run('setup', async ctx => {
      await ctx.adopt({name: 'page', close: async () => {starts.push('page'); await new Promise<void>(r => finish = r);}});
      await ctx.adopt({name: 'browser', close: async () => {starts.push('browser');}});
    });
    const dispose = owner.dispose(); expect(starts).toEqual(['page', 'browser']);
    now = 10000; await vi.advanceTimersByTimeAsync(10000); expect((await dispose).status).toBe('expired'); expect(owner.unsafeOutstanding).toBe(true);
    expect(owner.deadlines.at(-1)?.finishedAtHostMs).toBeNull();
    now = 12000; finish(); await owner.ownershipSettled; expect(owner.unsafeOutstanding).toBe(false);
    expect(owner.deadlines.at(-1)?.outcome).toBe('expired');
    expect(owner.deadlines.at(-1)?.finishedAtHostMs).toBe(12000);
  });
  it('retains capture and ordered cleanup failures and conservatively blocks reuse', async () => {
    const owner = new ComparisonOwnership();
    await owner.run('setup', async ctx => {await ctx.adopt({name: 'server', close: async () => {throw new Error('server-close');}}); await ctx.adopt({name: 'browser', close: async () => {throw new Error('browser-close');}}); throw new Error('setup-failed');});
    await owner.dispose();
    expect(owner.failures.map(f => f.message)).toEqual(['setup-failed', 'server-close', 'browser-close']);
    expect(owner.canContinue).toBe(false); expect(owner.unsafeOutstanding).toBe(false);
  });
  it('settled ordinary capture failure permits continuation after successful cleanup', async () => {
    const owner = new ComparisonOwnership(); await owner.run('setup', async ctx => ctx.adopt({name: 'server', close: async () => {}}));
    await owner.run('replay', async () => {throw new Error('product failure');}); await owner.dispose();
    expect(owner.canContinue).toBe(true); expect(owner.deadlines.map(d => d.budgetMs)).toEqual([60000, 30000, 10000]);
  });
});
