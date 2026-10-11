import {describe, expect, it, vi, afterEach} from 'vitest';
import {ComparisonOwnership, type ComparisonOwnershipContext} from './comparison-ownership.js';
afterEach(() => vi.useRealTimers());
describe('comparison ownership', () => {
  for (const stage of ['setup', 'replay'] as const) {
    it.each(['empty string', 'blank Error'])('retains a nonempty diagnostic for %s rejected by real '+stage, async kind => {
      const rejection = kind === 'empty string' ? '' : new Error('');
      if (rejection instanceof Error) rejection.name = '';
      const stack = rejection instanceof Error ? rejection.stack : null;
      const owner = new ComparisonOwnership({now: () => 123});
      let observed = false, original: unknown, context!: ComparisonOwnershipContext;
      let result: Awaited<ReturnType<typeof owner.run>> | undefined, escaped = false, escapedError: unknown;
      try {
        result = await owner.run(stage, async ctx => {
          context = ctx;
          try {throw rejection;} catch (error) {observed = true; original = error; throw error;}
        });
      } catch (error) {escaped = true; escapedError = error;}
      finally {await owner.dispose(); await owner.ownershipSettled;}
      expect(observed).toBe(true); expect(original).toBe(rejection);
      expect(escaped, String(escapedError)).toBe(false);
      const diagnostic = kind === 'empty string' ? 'Thrown empty string' : 'Error with empty message and name';
      expect(result).toMatchObject({status: 'failed', deadline: {reason: diagnostic, budgetMs: stage === 'setup' ? 60000 : 30000, startedAtHostMs: 123, deadlineAtHostMs: stage === 'setup' ? 60123 : 30123, finishedAtHostMs: 123}});
      expect(owner.failures[0]).toMatchObject({message: diagnostic, stack, stage, resource: null});
      expect(context.signal.aborted).toBe(true); expect(() => context.assertActive()).toThrow(/revoked/);
      expect(owner.unsafeOutstanding).toBe(false);
      if (rejection instanceof Error) {expect(rejection.message).toBe(''); expect(rejection.name).toBe(''); expect(rejection.stack).toBe(stack);}
    });
  }
  it('retains empty close diagnostics without claiming containment or retrying cleanup', async () => {
    const owner = new ComparisonOwnership({now: () => 123}); let calls = 0, observed = false, original: unknown;
    await owner.run('setup', async ctx => {await ctx.adopt({name: 'host', close: async () => {calls++; try {throw '';} catch (error) {observed = true; original = error; throw error;}}});});
    const result = await owner.dispose(); await owner.ownershipSettled;
    expect(observed).toBe(true); expect(original).toBe(''); expect(calls).toBe(1);
    expect(result).toMatchObject({status: 'failed', deadline: {reason: 'Owned resource cleanup failed', budgetMs: 10000}});
    expect(owner.failures).toEqual([{stage: 'disposal', timestampMs: 123, message: 'Thrown empty string', stack: null, resource: 'host'}]);
    expect(owner.unsafeOutstanding).toBe(false); expect(owner.canContinue).toBe(false);
  });
  it.each([
    [undefined, 'undefined'], [null, 'null'], [false, 'false'], [0, '0'],
    ['ordinary', 'ordinary'], ['   ', '   '], [new Error('ordinary error'), 'ordinary error'],
    [new Error(''), 'Error'], [new Error('   '), '   '],
  ] as const)('preserves existing diagnostic for %s', async (rejection, diagnostic) => {
    const owner = new ComparisonOwnership(); let observed = false, original: unknown;
    let result: Awaited<ReturnType<typeof owner.run>> | undefined, escaped = false, escapedError: unknown;
    try {result = await owner.run('setup', async () => {try {throw rejection;} catch (error) {observed = true; original = error; throw error;}});}
    catch (error) {escaped = true; escapedError = error;}
    finally {await owner.dispose(); await owner.ownershipSettled;}
    expect(observed).toBe(true); expect(original).toBe(rejection); expect(escaped, String(escapedError)).toBe(false);
    expect(result).toMatchObject({status: 'failed', deadline: {reason: diagnostic}}); expect(owner.failures[0]?.message).toBe(diagnostic);
  });
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
