import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, rm, writeFile, rename, open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {comparisonCaptureInvocationSchema, comparisonValidationSchema, comparisonEvidenceSchema} from '@chat-ui-bench/contract';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {runLongThreadInvocation, createLongThreadLedger} from './long-thread-run.js';
const roots: string[] = [];
afterEach(async () => {vi.useRealTimers(); await Promise.all(roots.splice(0).map(r => rm(r, {recursive: true, force: true})));});
async function config() {const out = await mkdtemp(join(tmpdir(), 'comparison-execution-')); roots.push(out); const args = parseLongThreadArgs(['--out', out]); if (args.help) throw new Error('unexpected help'); return args;}
describe('complete comparison ledger', () => {
  it('constructs exact 36 slots with decimal member directories and no fabricated environment', async () => {
    const invocation = createLongThreadLedger(await config());
    expect(comparisonCaptureInvocationSchema.parse(invocation).runs).toHaveLength(36);
    expect(invocation.runs[0]).toMatchObject({round: 1, caseIndex: 0, repetition: '1-0-0', artifactDirectory: 'runs/round-1/case-0/profile-0', status: 'scheduled'});
    expect(invocation.runs[35]).toMatchObject({round: 3, caseIndex: 11, status: 'scheduled'});
    expect(JSON.stringify(invocation)).not.toContain('browserVersion');
  });
  it('durably creates every descriptor before acquisition and retains local failures without skipping later cases', async () => {
    const configuration = await config(); let attempts = 0, closed = 0;
    const result = await runLongThreadInvocation(configuration, {
      async setup(ctx) {
        const ledger = comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(configuration.out, 'invocation.json'), 'utf8')));
        expect(ledger.runs).toHaveLength(36);
        for (const slot of ledger.runs) await readFile(join(configuration.out, slot.artifactDirectory, 'descriptor.json'));
        attempts++; await ctx.ownership.adopt({name: `server-${attempts}`, close: async () => {closed++;}});
        if (attempts === 2) throw new Error('local setup failure');
        return {slot: attempts};
      },
      async replay(ctx, state) {
        expect(state.slot).toBe(attempts);
        const trace = await ctx.writer.stream('trace.json'); await trace.write(Buffer.from('{"fakeTrace":true}')); await trace.complete();
        return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'invalid', checks: [{name: 'policy', passed: false, reason: 'history did not hold', evidencePaths: []}], reasons: ['history did not hold']})};
      },
    });
    expect(attempts).toBe(36); expect(closed).toBe(36); expect(result.finalized).toBe(true);
    expect(result.invocation.status).toBe('failed'); expect(result.invocation.runs[1]?.status).toBe('failed'); expect(result.invocation.runs[35]?.status).toBe('invalid');
    const second = result.invocation.runs[1]!;
    expect(await readFile(join(configuration.out, second.artifactDirectory, 'exceptions.json'), 'utf8')).toContain('local setup failure');
    await expect(readFile(join(configuration.out, second.artifactDirectory, 'evidence.json'))).rejects.toThrow();
  }, 30000);
  it('rejects a missing real driver before creating artificial run failures', async () => {
    const configuration = await config(); await expect(runLongThreadInvocation(configuration, undefined as never)).rejects.toThrow(/driver/i);
    await expect(readFile(join(configuration.out, 'invocation.json'))).rejects.toThrow();
  });
  it('rejects a previously initialized invocation root without overwriting its raw bytes', async () => {
    const configuration = await config(); await writeFile(join(configuration.out, 'invocation.json'), 'original evidence');
    await expect(runLongThreadInvocation(configuration, {async setup() {throw new Error('must not acquire');}, async replay() {throw new Error('must not capture');}})).rejects.toThrow(/already|existing|initialized/i);
    expect(await readFile(join(configuration.out, 'invocation.json'), 'utf8')).toBe('original evidence');
  }, 30000);
  it('rejects partial old evidence even without an invocation ledger', async () => {
    const configuration = await config(); await writeFile(join(configuration.out, 'partial-trace'), 'raw partial'); let attempts = 0;
    await expect(runLongThreadInvocation(configuration, {async setup() {attempts++; return null;}, async replay() {throw new Error('must not capture');}})).rejects.toThrow(/empty|existing|initialized/i);
    expect(attempts).toBe(0); expect(await readFile(join(configuration.out, 'partial-trace'), 'utf8')).toBe('raw partial');
  });
  it('permits only one concurrent invocation owner to begin resource acquisition', async () => {
    const configuration = await config(); let attempts = 0;
    const driver = {async setup() {attempts++; throw new Error('local fake failure');}, async replay() {throw new Error('must not capture');}};
    const results = await Promise.allSettled([runLongThreadInvocation(configuration, driver), runLongThreadInvocation(configuration, driver)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(attempts).toBe(36);
    expect(JSON.parse(await readFile(join(configuration.out, 'invocation-claim.json'), 'utf8'))).toMatchObject({kind: 'invocation-ownership-claim', schemaVersion: 2});
  }, 30000);
  it('retains finalization failure and terminalizes all future descriptors without publishing hashes', async () => {
    const configuration = await config(); let attempts = 0;
    const result = await runLongThreadInvocation(configuration, {
      async setup() {attempts++; return null;},
      async replay(ctx) {return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake-driver', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
      async finalize() {if (attempts === 2) throw new Error('inventory finalization failed');},
    });
    expect(attempts).toBe(2); expect(result.finalized).toBe(false); expect(result.invocation.status).toBe('failed');
    expect(result.invocation.runs[1]?.status).toBe('failed'); expect(result.invocation.runs[35]?.reasons[0]).toContain('failed-not-started');
    const diskLedger = comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(configuration.out, 'invocation.json'), 'utf8')));
    expect(diskLedger.status).toBe('failed'); expect(await readFile(join(configuration.out, result.invocation.runs[1]!.artifactDirectory, 'exceptions.json'), 'utf8')).toContain('inventory finalization failed');
    await expect(result.finalize()).rejects.toThrow('inventory finalization failed');
  }, 30000);
  it('records terminal failure through the independent root writer when persistent slot I/O also prevents exception retention', async () => {
    const cfg = await config(), parsed = parseLongThreadArgs(['--out', cfg.out, '--mode', 'headless', '--rounds', '1']); if (parsed.help) throw new Error('unexpected help'); let broken = false, attempts = 0;
    const result = await runLongThreadInvocation(parsed, {
      async setup() {attempts++; return null;},
      async replay(ctx) {return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
      async finalize(ctx) {broken = true; await ctx.writer.json('final-runtime.json', {fake: true});},
    }, {fileOperations: {rename: async (source, destination) => {if (broken && String(destination).includes('/round-1/case-0/profile-0/')) throw new Error(`Persistent slot write failure: ${String(destination).split('/').at(-1)}`); return rename(source, destination);}}});
    expect(attempts).toBe(1); expect(result.finalized).toBe(false); expect(result.invocation.status).toBe('failed');
    expect(result.invocation.runs[0]?.reasons.join('; ')).toContain('final-runtime.json'); expect(result.invocation.runs[0]?.reasons.join('; ')).toContain('exceptions.json');
    expect(result.invocation.runs[11]?.reasons[0]).toContain('failed-not-started');
    expect(comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(cfg.out, 'invocation.json'), 'utf8'))).status).toBe('failed');
  }, 30000);
  it.each(['different-future-slot', 'all-run-writes'])('terminalizes all 36 slots despite %s failure after capture finalization fails', async failureMode => {
    const configuration = await config(); let broken = false, attempts = 0, originalFutureValidation: Buffer | null = null;
    const future = join(configuration.out, 'runs/round-1/case-1/profile-0/validation.json');
    const result = await runLongThreadInvocation(configuration, {
      async setup() {attempts++; originalFutureValidation = await readFile(future); return null;},
      async replay(ctx) {const stream = await ctx.writer.stream('trace.json'); await stream.write(Buffer.from('original captured raw')); await stream.complete(); return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
      async finalize() {broken = true; throw new Error('original capture finalization failure');},
    }, {fileOperations: {rename: async (source, destination) => {
      if (broken && (failureMode === 'all-run-writes' ? String(destination).includes('/runs/') : String(destination).includes('/round-1/case-1/profile-0/'))) throw new Error('future-slot persistent write failure');
      return rename(source, destination);
    }}});
    expect(attempts).toBe(1); expect(result.finalized).toBe(false); expect(result.invocation.status).toBe('failed');
    expect(result.invocation.runs).toHaveLength(36); expect(result.invocation.runs.every(slot => slot.status === 'failed')).toBe(true);
    expect(result.invocation.runs[1]?.reasons.join('; ')).toContain('future-slot persistent write failure');
    expect(await readFile(future)).toEqual(originalFutureValidation);
    expect(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'trace.json'), 'utf8')).toBe('original captured raw');
    const ledger = comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(configuration.out, 'invocation.json'), 'utf8'))); expect(ledger.status).toBe('failed'); expect(ledger.runs.every(slot => slot.status === 'failed')).toBe(true);
    await expect(result.finalize()).rejects.toThrow(/original capture finalization failure.*future-slot persistent write failure/);
  }, 30000);
  it('halts all later slots for unresolved acquisition, leaves raw unsealed, then records late close failure before finalizing', async () => {
    vi.useFakeTimers(); const configuration = await config(); let now = 0, acquired!: () => void, started!: () => void, attempts = 0, closes = 0;
    const entered = new Promise<void>(r => started = r), acquisition = new Promise<void>(r => acquired = r);
    const run = runLongThreadInvocation(configuration, {
      async setup(ctx) {attempts++; started(); await acquisition; await ctx.ownership.adopt({name: 'late-browser', close: async () => {closes++; throw new Error('late close failed');}});},
      async replay() {throw new Error('must never capture');},
    }, {clock: {now: () => now}});
    await entered; now = 60000; await vi.advanceTimersByTimeAsync(60000); now = 70000; await vi.advanceTimersByTimeAsync(10000);
    const result = await run; expect(attempts).toBe(1); expect(result.finalized).toBe(false); expect(result.unsafeOutstanding).toBe(true);
    expect(result.invocation.runs).toHaveLength(36); expect(result.invocation.runs.every(slot => slot.status === 'failed')).toBe(true);
    expect(result.invocation.runs[35]?.reasons[0]).toContain('failed-not-started');
    acquired(); await result.ownershipSettled; await result.finalize();
    expect(closes).toBe(1); expect(result.finalized).toBe(true); expect(result.invocation.runs[0]?.status).toBe('failed');
    expect(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'exceptions.json'), 'utf8')).toContain('late close failed');
  }, 30000);
  it('retains late cleanup facts even when an unsafe halt also encounters future-slot persistence failure', async () => {
    vi.useFakeTimers(); const configuration = await config(); let now = 0, resolve!: () => void, entered!: () => void, attempts = 0;
    const acquisition = new Promise<void>(r => resolve = r), started = new Promise<void>(r => entered = r);
    const run = runLongThreadInvocation(configuration, {
      async setup(ctx) {attempts++; entered(); await acquisition; await ctx.ownership.adopt({name: 'late-browser', close: async () => {throw new Error('late browser close failure');}});},
      async replay() {throw new Error('must not capture');},
    }, {clock: {now: () => now}, fileOperations: {rename: async (source, destination) => {if (now >= 70000 && String(destination).includes('/round-1/case-1/profile-0/')) throw new Error('future pending-slot persistence failure'); return rename(source, destination);}}});
    await started; now = 60000; await vi.advanceTimersByTimeAsync(60000); now = 70000; await vi.advanceTimersByTimeAsync(10000); const result = await run;
    expect(attempts).toBe(1); expect(result.invocation.runs.every(slot => slot.status === 'failed')).toBe(true); expect(result.finalized).toBe(false);
    now = 72000; resolve(); await result.ownershipSettled; await expect(result.finalize()).rejects.toThrow('future pending-slot persistence failure');
    expect(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'exceptions.json'), 'utf8')).toContain('late browser close failure');
  }, 30000);
  it('retains a pre-acquisition fixture filesystem error and continues settled later slots', async () => {
    const configuration = await config(); let attempts = 0, failedWrite = false;
    const result = await runLongThreadInvocation(configuration, {
      async setup() {attempts++; return null;},
      async replay(ctx) {return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake-driver', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
    }, {fileOperations: {rename: async (source, destination) => {if (!failedWrite && String(destination).endsWith('/fixture.json')) {failedWrite = true; throw new Error('fixture rename filesystem failure');} return rename(source, destination);}}});
    expect(attempts).toBe(35); expect(result.invocation.runs[0]?.status).toBe('failed');
    expect(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'exceptions.json'), 'utf8')).toContain('fixture rename filesystem failure');
  }, 30000);
  it('hashes cleanup failures and required retained payloads before writing genuine supplied evidence last', async () => {
    const cfg = await config(), parsed = parseLongThreadArgs(['--out', cfg.out, '--mode', 'headless', '--rounds', '1']); if (parsed.help) throw new Error('unexpected help');
    let attempts = 0;
    const result = await runLongThreadInvocation(parsed, {
      async setup(ctx) {attempts++; const ordinal = attempts; await ctx.ownership.adopt({name: 'fake-contained-browser', close: async () => {if (ordinal === 1) throw new Error('auxiliary page disposal failed');}, verifyContained: async () => true}); return null;},
      async replay(ctx) {
        const unavailable = {status: 'unavailable', reason: 'fake driver has no browser observers'};
        const probe = {intervalMs: 25, callbacks: 1, callbackDurationTotalMs: 0.1, maximumObservedGapMs: unavailable};
        const {files: _files, ...evidence} = comparisonEvidenceSchema.parse({...ctx.identity, status: 'complete', files: [], unavailableFiles: [], trace: unavailable, instrumentation: {runtimeProbe: probe, domProbe: {...probe, selectionStrategy: 'bounded-visible-candidates'}, scrollProbe: probe, transportDrain: probe, eventTiming: unavailable, loaf: unavailable, buffers: []}});
        return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake-validation', passed: true, reason: null, evidencePaths: []}], reasons: []}), evidence};
      },
    });
    expect(attempts).toBe(12); expect(result.finalized).toBe(true); const slot = result.invocation.runs[0]!;
    const evidence = comparisonEvidenceSchema.parse(JSON.parse(await readFile(join(cfg.out, slot.artifactDirectory, 'evidence.json'), 'utf8')));
    expect(evidence.files.map(f => f.path)).toEqual(['descriptor.json', 'exceptions.json', 'fixture.json', 'page.jsonl', 'producer.jsonl', 'trace.json', 'validation.json']);
    const exceptionBytes = await readFile(join(cfg.out, slot.artifactDirectory, 'exceptions.json'));
    expect(evidence.files.find(f => f.path === 'exceptions.json')?.sha256).toBe(createHash('sha256').update(exceptionBytes).digest('hex'));
    expect(exceptionBytes.toString()).toContain('auxiliary page disposal failed'); expect(evidence.status).toBe('partial');
  }, 30000);
  it('owns and closes unfinished checked trace streams before finalizing a slot', async () => {
    const cfg = await config(), parsed = parseLongThreadArgs(['--out', cfg.out, '--mode', 'headless', '--rounds', '1']); if (parsed.help) throw new Error('unexpected help'); let attempts = 0;
    const result = await runLongThreadInvocation(parsed, {
      async setup() {attempts++; return null;},
      async replay(ctx) {const trace = await ctx.writer.stream('trace.json'); await trace.write(Buffer.from('partial captured trace')); return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'invalid', checks: [{name: 'fake', passed: false, reason: 'unscored fake trace', evidencePaths: ['trace.json']}], reasons: ['unscored fake trace']})};},
    });
    expect(attempts).toBe(12); expect(result.finalized).toBe(true);
    expect(await readFile(join(cfg.out, result.invocation.runs[0]!.artifactDirectory, 'trace.json'), 'utf8')).toBe('partial captured trace');
  }, 30000);
  it('supplies detached frozen actual stage deadlines to final persistence', async () => {
    const cfg = await config(), parsed = parseLongThreadArgs(['--out', cfg.out, '--mode', 'headless', '--rounds', '1']); if (parsed.help) throw new Error('unexpected help'); let now = 100;
    const result = await runLongThreadInvocation(parsed, {
      async setup(ctx) {await ctx.ownership.adopt({name: 'fake-browser', close: async () => {now += 39;}}); now += 37; return null;},
      async replay(ctx) {now += 64; return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
      async finalize(ctx) {
        expect(Object.isFrozen(ctx.deadlines)).toBe(true); expect(ctx.deadlines.every(Object.isFrozen)).toBe(true);
        const before = JSON.stringify(ctx.deadlines);
        expect(() => {Reflect.set(ctx.deadlines[0]!, 'finishedAtHostMs', 999);}).not.toThrow();
        expect(JSON.stringify(ctx.deadlines)).toBe(before);
        await ctx.writer.json('deadlines.json', ctx.deadlines);
      },
    }, {clock: {now: () => now}});
    expect(JSON.parse(await readFile(join(cfg.out, result.invocation.runs[0]!.artifactDirectory, 'deadlines.json'), 'utf8'))).toEqual([
      {stage: 'setup', budgetMs: 60000, startedAtHostMs: 100, deadlineAtHostMs: 60100, finishedAtHostMs: 137, outcome: 'complete'},
      {stage: 'replay', budgetMs: 30000, startedAtHostMs: 137, deadlineAtHostMs: 30137, finishedAtHostMs: 201, outcome: 'complete'},
      {stage: 'disposal', budgetMs: 10000, startedAtHostMs: 201, deadlineAtHostMs: 10201, finishedAtHostMs: 240, outcome: 'complete'},
    ]);
  }, 30000);
  it('supplies actual expired late-finish deadlines without inventing an unstarted replay stage', async () => {
    vi.useFakeTimers(); const configuration = await config(); let now = 0, resolve!: () => void, entered!: () => void;
    const acquisition = new Promise<void>(r => resolve = r), started = new Promise<void>(r => entered = r);
    const run = runLongThreadInvocation(configuration, {
      async setup(ctx) {entered(); await acquisition; await ctx.ownership.adopt({name: 'late-browser', close: async () => {}});},
      async replay() {throw new Error('must not capture');},
      async finalize(ctx) {
        expect(ctx.deadlines.map(deadline => deadline.stage)).toEqual(['setup', 'disposal']);
        expect(ctx.deadlines.every(deadline => deadline.outcome === 'expired' && deadline.finishedAtHostMs === 72000)).toBe(true);
        expect(Reflect.set(ctx.deadlines[0]!, 'outcome', 'complete')).toBe(false);
        expect(Reflect.set(ctx.deadlines, '0', {})).toBe(false);
        await ctx.writer.json('deadlines.json', ctx.deadlines);
      },
    }, {clock: {now: () => now}});
    await started; now = 60000; await vi.advanceTimersByTimeAsync(60000); now = 70000; await vi.advanceTimersByTimeAsync(10000); const result = await run;
    now = 72000; resolve(); await result.ownershipSettled; await result.finalize();
    const persisted = JSON.parse(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'deadlines.json'), 'utf8'));
    expect(persisted).toHaveLength(2); expect(persisted.every((deadline: {outcome: string; finishedAtHostMs: number}) => deadline.outcome === 'expired' && deadline.finishedAtHostMs === 72000)).toBe(true);
  }, 30000);
  it('includes outstanding queued writes in disposal ownership and blocks subsequent slots', async () => {
    vi.useFakeTimers(); const configuration = await config(); let now = 0, entered!: () => void, release!: () => void, attempts = 0;
    const opened = new Promise<void>(r => entered = r), blocker = new Promise<void>(r => release = r);
    const run = runLongThreadInvocation(configuration, {
      async setup() {attempts++; return null;},
      async replay(ctx) {void ctx.writer.append('page.jsonl', [{fake: true}]).catch(() => {}); await opened; return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'valid', checks: [{name: 'fake', passed: true, reason: null, evidencePaths: []}], reasons: []})};},
    }, {clock: {now: () => now}, fileOperations: {open: async (...args) => {if (String(args[0]).endsWith('/page.jsonl')) {entered(); await blocker;} return open(...args);}}});
    await opened; await vi.advanceTimersByTimeAsync(0); now = 10000; await vi.advanceTimersByTimeAsync(10000);
    const result = await run; expect(result.finalized).toBe(false); expect(result.unsafeOutstanding).toBe(true); expect(attempts).toBe(1);
    release(); await result.ownershipSettled; await result.finalize(); expect(result.finalized).toBe(true);
    expect(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'page.jsonl'), 'utf8')).toBe('');
  }, 30000);
});
