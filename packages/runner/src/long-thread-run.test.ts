import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, rm, writeFile, rename, open, lstat, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {comparisonCaptureInvocationSchema, comparisonValidationSchema, comparisonEvidenceSchema, comparisonCaptureStatusSchema, comparisonRawInventorySchema, comparisonFinalizationStatusSchema, comparisonExceptionsSchema} from '@chat-ui-bench/contract';
import {ComparisonArtifactWriter} from './comparison-artifacts.js';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {runLongThreadInvocation, createLongThreadLedger} from './long-thread-run.js';
const roots: string[] = [];
afterEach(async () => {vi.useRealTimers(); await Promise.all(roots.splice(0).map(r => rm(r, {recursive: true, force: true})));});
async function config() {const out = await mkdtemp(join(tmpdir(), 'comparison-execution-')); roots.push(out); const args = parseLongThreadArgs(['--out', out]); if (args.help) throw new Error('unexpected help'); return args;}
describe('complete comparison ledger', () => {
  it.each(['returned replay capture', 'setup failure'] as const)('retains empty cleanup failure with %s and the original capture availability', async mode => {
    const initial = await config(), c = parseLongThreadArgs(['--out', initial.out, '--mode', 'headless', '--rounds', '1']); if (c.help) throw new Error('unexpected help');
    let attempts = 0, replayCalls = 0, closes = 0, closeObserved = false, original: unknown;
    let finalizedCapture: unknown = undefined, finalizerCalls = 0;
    const exceptionParse = vi.spyOn(comparisonExceptionsSchema, 'parse'), validationParse = vi.spyOn(comparisonValidationSchema, 'parse');
    let exceptionCandidate: ReturnType<typeof comparisonExceptionsSchema.parse> | undefined, acceptedException: ReturnType<typeof comparisonExceptionsSchema.parse> | undefined;
    let exceptionOutcome: string | undefined, validationCandidate: ReturnType<typeof comparisonValidationSchema.parse> | undefined;
    let result: Awaited<ReturnType<typeof runLongThreadInvocation>> | undefined, escaped = false, escapedError: unknown;
    try {
      result = await runLongThreadInvocation(c, {
      async setup(ctx) {
        attempts++;
        await ctx.ownership.adopt({name: 'host', close: async () => {closes++; try {throw '';} catch (error) {closeObserved = true; original = error; throw error;}}});
        await ctx.writer.text('instrumentation/main.js', 'original acquired bytes');
        if (mode === 'setup failure') throw new Error('actual setup failure before capture');
        return null;
      },
      async replay(ctx) {
        replayCalls++;
        return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'invalid', reasons: ['controlled capture without browser measurement'], checks: [{name: 'controlled capture', passed: false, reason: 'controlled capture without browser measurement', evidencePaths: []}]})};
      },
      async finalize(_ctx, capture) {finalizerCalls++; finalizedCapture = capture;},
      });
      await result.ownershipSettled;
    } catch (error) {escaped = true; escapedError = error;}
    finally {
      try {
        const exceptionIndex = exceptionParse.mock.calls.findIndex(([input]) => (input as ReturnType<typeof comparisonExceptionsSchema.parse>).exceptions.some(row => row.stage === 'disposal' && row.message.startsWith('host: ')));
        if (exceptionIndex >= 0) {
          exceptionCandidate = structuredClone(exceptionParse.mock.calls[exceptionIndex]![0] as ReturnType<typeof comparisonExceptionsSchema.parse>);
          const parsed = exceptionParse.mock.results[exceptionIndex]!; exceptionOutcome = parsed.type;
          if (parsed.type === 'return') acceptedException = structuredClone(parsed.value);
        }
        const call = validationParse.mock.calls.find(([input]) => {
          const candidate = input as ReturnType<typeof comparisonValidationSchema.parse>;
          return candidate.checks.some(check => check.name === 'capture-ownership') && candidate.reasons.some(reason => reason.includes('Owned resource cleanup failed'));
        });
        if (call) validationCandidate = structuredClone(call[0] as ReturnType<typeof comparisonValidationSchema.parse>);
      } finally {exceptionParse.mockRestore(); validationParse.mockRestore();}
    }
    expect(escaped, String(escapedError)).toBe(false); expect(result).toBeDefined();
    expect(closeObserved).toBe(true); expect(original).toBe(''); expect(closes).toBe(1); expect(attempts).toBe(1);
    expect(exceptionCandidate).toBeDefined(); expect(exceptionOutcome).toBe('return'); expect(acceptedException).toEqual(exceptionCandidate);
    expect(acceptedException?.exceptions.find(row => row.stage === 'disposal')?.message.length).toBeGreaterThan(0);
    expect(validationCandidate).toBeDefined(); expect(validationCandidate?.reasons).toContain('Thrown empty string');
    expect(validationCandidate?.reasons.every(reason => reason.length > 0)).toBe(true);
    expect(replayCalls).toBe(mode === 'setup failure' ? 0 : 1); expect(finalizerCalls).toBe(1);
    if (mode === 'setup failure') expect(finalizedCapture).toBeNull();
    else expect(finalizedCapture).toMatchObject({validation: {status: 'invalid', reasons: ['controlled capture without browser measurement']}});
    expect(result!.finalized).toBe(true); expect(result!.unsafeOutstanding).toBe(false);
    const ledger = comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(c.out, 'invocation.json'), 'utf8')));
    expect(ledger.runs).toHaveLength(12); expect(ledger.runs[0]?.status).toBe('failed');
    expect(ledger.runs.slice(1).every(slot => slot.status === 'failed' && slot.reasons.some(reason => reason.includes('failed-not-started')))).toBe(true);
    const directory = join(c.out, ledger.runs[0]!.artifactDirectory);
    expect(await readFile(join(directory, 'instrumentation/main.js'), 'utf8')).toBe('original acquired bytes');
    const exceptions = comparisonExceptionsSchema.parse(JSON.parse(await readFile(join(directory, 'exceptions.json'), 'utf8')));
    expect(exceptions.exceptions).toContainEqual(expect.objectContaining({stage: 'disposal', message: 'host: Thrown empty string'}));
    const validation = comparisonValidationSchema.parse(JSON.parse(await readFile(join(directory, 'validation.json'), 'utf8')));
    expect(validation.reasons).toContain('Thrown empty string'); expect(validation.reasons.every(reason => reason.length > 0)).toBe(true);
    expect(JSON.parse(await readFile(join(c.out, 'dataset-seal.json'), 'utf8')).status).toBe('sealed');
  });
  it.each(['empty string', 'blank Error'] as const)('retains the first filesystem finalizer rejection %s without supplying a usable seal', async kind => {
    const initial = await config(), c = parseLongThreadArgs(['--out', initial.out, '--mode', 'headless', '--rounds', '1']); if (c.help) throw new Error('unexpected help');
    const rejection = kind === 'empty string' ? '' : new Error(''); if (rejection instanceof Error) rejection.name = '';
    const originalStack = rejection instanceof Error ? rejection.stack : null;
    let attempts = 0, finalizerCalls = 0, observed = false, original: unknown;
    const result = await runLongThreadInvocation(c, {
      async setup(ctx) {attempts++; await ctx.writer.text('instrumentation/main.js', 'original finalizer bytes'); return null;},
      async replay(ctx) {return {validation: comparisonValidationSchema.parse({...ctx.identity, status: 'invalid', reasons: ['controlled measurement unavailable'], checks: [{name: 'controlled capture', passed: false, reason: 'controlled measurement unavailable', evidencePaths: []}]})};},
      async finalize() {finalizerCalls++; try {throw rejection;} catch (error) {observed = true; original = error; throw error;}},
    });
    await result.ownershipSettled;
    expect(observed).toBe(true); expect(original).toBe(rejection); expect(attempts).toBe(1); expect(finalizerCalls).toBe(1);
    expect(result.finalized).toBe(false); expect(result.unsafeOutstanding).toBe(false);
    const diagnostic = kind === 'empty string' ? 'Thrown empty string' : 'Error with empty message and name';
    const ledger = comparisonCaptureInvocationSchema.parse(JSON.parse(await readFile(join(c.out, 'invocation.json'), 'utf8')));
    expect(ledger.runs).toHaveLength(12); expect(ledger.runs[0]?.reasons).toEqual([diagnostic]);
    expect(ledger.runs.slice(1).every(slot => slot.status === 'failed' && slot.reasons.some(reason => reason.includes('failed-not-started')))).toBe(true);
    const directory = join(c.out, ledger.runs[0]!.artifactDirectory);
    expect(await readFile(join(directory, 'instrumentation/main.js'), 'utf8')).toBe('original finalizer bytes');
    const exceptions = comparisonExceptionsSchema.parse(JSON.parse(await readFile(join(directory, 'exceptions.json'), 'utf8')));
    expect(exceptions.exceptions).toContainEqual(expect.objectContaining({message: diagnostic, stack: originalStack}));
    expect(comparisonValidationSchema.parse(JSON.parse(await readFile(join(directory, 'validation.json'), 'utf8'))).reasons).toEqual([diagnostic]);
    expect(comparisonFinalizationStatusSchema.parse(JSON.parse(await readFile(join(directory, 'finalization-status.json'), 'utf8')))).toMatchObject({status: 'failed', reason: diagnostic, datasetSealEligible: false, manifest: {path: null, state: 'not-written'}});
    let escaped = false, finalError: unknown;
    try {await result.finalize();} catch (error) {escaped = true; finalError = error;}
    expect(escaped).toBe(true);
    if (rejection instanceof Error) {expect(finalError).toBe(rejection); expect(rejection.stack).toBe(originalStack); expect(rejection.message).toBe(''); expect(rejection.name).toBe('');}
    else expect(finalError).toMatchObject({message: diagnostic});
    await expect(result.finalize()).rejects.toBe(finalError); expect(finalizerCalls).toBe(1);
    await expect(readFile(join(c.out, 'dataset-seal.json'))).rejects.toMatchObject({code: 'ENOENT'});
  });
  it('reconciles genuine O_EXCL bytes after late guarded open rejection and records the actually absent destination',async()=>{
    vi.useFakeTimers(); const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    let now=0,entered!:()=>void,release!:()=>void,owned:Awaited<ReturnType<typeof open>>|undefined;
    const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r);
    const run=runLongThreadInvocation(c,{
      async setup(ctx) {await ctx.writer.json('capture-metadata.json',{acquisition:'will not be written'});},
      async replay() {throw new Error('unreachable');},
    },{clock:{now:()=>now},fileOperations:{open:async(...args)=>{const handle=await open(...args); if(/capture-metadata\.json\..*\.tmp$/.test(String(args[0]))) {owned=handle; entered(); await held;} return handle;}}});
    await started; now=60000; await vi.advanceTimersByTimeAsync(60000); now=70000; await vi.advanceTimersByTimeAsync(10000);
    const result=await run; expect(result.finalized).toBe(false); now=72000; release(); await result.ownershipSettled; await result.finalize(); expect(result.finalized).toBe(true);
    await expect(owned!.stat()).rejects.toThrow(/closed/);
    const directory=join(c.out,result.invocation.runs[0]!.artifactDirectory), inventory=comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(directory,'raw-inventory.json'),'utf8')));
    const temporary=inventory.files.find(f=>/^capture-metadata\.json\..*\.tmp$/.test(f.path));
    expect(temporary).toMatchObject({status:'partial',byteLength:0,sha256:createHash('sha256').update('').digest('hex')});
    const status=comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(directory,'capture-status.json'),'utf8')));
    expect(status.unavailablePaths).toContainEqual({path:'capture-metadata.json',reason:expect.stringMatching(/revoked|deadline/)});
    await expect(lstat(join(directory,'capture-metadata.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it('rejects driver replacement of reserved atomic remnants before creating any file',async()=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    const path='descriptor.json.00000000-0000-4000-8000-000000000000.tmp';
    const result=await runLongThreadInvocation(c,{
      async setup(ctx) {await expect(ctx.writer.json(path,{forged:true})).rejects.toThrow(/root-owned/); return null;},
      async replay(ctx) {return {validation:comparisonValidationSchema.parse({...ctx.identity,status:'valid',reasons:[],checks:[{name:'owned fixture',passed:true,reason:null,evidencePaths:[]}]})};},
    });
    expect(result.finalized).toBe(true);
    for(const slot of result.invocation.runs) await expect(lstat(join(c.out,slot.artifactDirectory,path))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it.each(['setup','replay'] as const)('preserves acquired raw bytes and future failed-not-started inventories while %s expires and actually settles late',async stage=>{
    vi.useFakeTimers(); const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    let now=0,entered!:()=>void,release!:()=>void,attempts=0;
    const started=new Promise<void>(r=>entered=r),pending=new Promise<void>(r=>release=r);
    const hold=async(ctx:Parameters<Parameters<typeof runLongThreadInvocation>[1]['setup']>[0])=>{await ctx.writer.text('instrumentation/main.js','acquired before expiry'); entered(); await pending;};
    const run=runLongThreadInvocation(c,{
      async setup(ctx) {attempts++; if(stage==='setup') await hold(ctx); return null;},
      async replay(ctx) {await hold(ctx); throw new Error('late replay failed after expiry');},
      async finalize(ctx,capture) {expect(capture).toBeNull(); expect(ctx.deadlines.find(d=>d.stage===stage)).toMatchObject({outcome:'expired',finishedAtHostMs:stage==='setup'?72000:42000});},
    },{clock:{now:()=>now}});
    await started; const budget=stage==='setup'?60000:30000; now=budget; await vi.advanceTimersByTimeAsync(budget); now=budget+10000; await vi.advanceTimersByTimeAsync(10000);
    const result=await run; expect(result.finalized).toBe(false); expect(attempts).toBe(1);
    await expect(readFile(join(c.out,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
    for(const slot of result.invocation.runs.slice(1)) {expect(slot.reasons[0]).toContain('failed-not-started'); await readFile(join(c.out,slot.artifactDirectory,'raw-inventory.json'));}
    now=budget+12000; release(); await result.ownershipSettled; await result.finalize(); expect(result.finalized).toBe(true);
    const slot=result.invocation.runs[0]!; expect(slot.status).toBe('failed'); expect(await readFile(join(c.out,slot.artifactDirectory,'instrumentation/main.js'),'utf8')).toBe('acquired before expiry');
  },30000);
  it.each([false,true])('keeps execution unfinalized when real post-rename parent fsync fails (all retention fails=%s)',async allRetentionFails=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1; const rootPath=await realpath(c.out);
    let published=false,failedSync=false;
    const result=await runLongThreadInvocation(c,{
      async setup() {return null;},
      async replay(ctx) {return {validation:comparisonValidationSchema.parse({...ctx.identity,status:'invalid',reasons:['storage-only driver outcome'],checks:[{name:'owned fixture',passed:false,reason:'storage-only driver outcome',evidencePaths:[]}]})};},
    },{fileOperations:{
      rename:async(source,destination)=>{await rename(source,destination); if(String(destination)===join(rootPath,'dataset-seal.json')) published=true;},
      open:async(...args)=>{
        const path=String(args[0]);
        if(published && allRetentionFails && /(?:dataset-finalization-failure|invocation)\.json\..*\.tmp$/.test(path)) throw new Error('ALL root retention writes unavailable');
        const handle=await open(...args);
        if(published && !failedSync && path===rootPath && (await handle.stat()).isDirectory()) {handle.sync=async()=>{failedSync=true; throw new Error('actual root parent fsync failed');};}
        return handle;
      },
    }});
    expect(published).toBe(true); expect(failedSync).toBe(true); expect(result.finalized).toBe(false); expect(result.invocation.status).toBe('failed');
    await expect(result.finalize()).rejects.toThrow(/actual root parent fsync failed/);
    expect(JSON.parse(await readFile(join(c.out,'dataset-seal.json'),'utf8')).status).toBe('sealed');
    if(allRetentionFails) {await expect(readFile(join(c.out,'dataset-finalization-failure.json'))).rejects.toMatchObject({code:'ENOENT'}); expect(JSON.parse(await readFile(join(c.out,'invocation.json'),'utf8')).status).toBe('complete');}
    else expect(JSON.parse(await readFile(join(c.out,'dataset-finalization-failure.json'),'utf8')).sealState).toBe('present-unusable');
  },30000);
  it.each(['setup','replay'] as const)('accepts genuine typed partial filesystem finalization after %s throws without changing failed validation',async stage=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    const result=await runLongThreadInvocation(c,{
      async setup(ctx) {await ctx.writer.text('instrumentation/main.js','actual bytes'); if(stage==='setup') throw new Error('setup acquisition failed'); return null;},
      async replay(ctx) {await ctx.writer.text('trace-auxiliary.json','actual auxiliary bytes'); throw new Error('replay acquisition failed');},
      async finalize(ctx,capture) {
        expect(capture).toBeNull(); expect(Object.isFrozen(ctx.deadlines)).toBe(true);
        const reason='actual final drain not acquired', unavailable={status:'unavailable',reason};
        return {payloadFiles:[{path:'instrumentation/main.js',status:'partial',reason:'acquisition incomplete'}],captureStatus:comparisonCaptureStatusSchema.parse({...ctx.identity,status:'partial',reasons:[reason],captureMetadata:unavailable,evidenceMetadata:unavailable,payloads:[],unavailablePaths:[],terminalPageDrain:unavailable,terminalProducerDrain:unavailable,finalPageInstrumentation:unavailable,traceEof:unavailable})};
      },
    });
    expect(result.finalized).toBe(true);
    for(const slot of result.invocation.runs) {
      expect(slot.status).toBe('failed'); const directory=join(c.out,slot.artifactDirectory);
      const inventory=comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(directory,'raw-inventory.json'),'utf8')));
      expect(inventory.files.find(f=>f.path==='instrumentation/main.js')).toMatchObject({status:'partial',reason:'acquisition incomplete',byteLength:12});
      const status=comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(directory,'capture-status.json'),'utf8')));
      expect(status.captureMetadata.status).toBe('unavailable'); expect(status.terminalPageDrain).toMatchObject({status:'unavailable',reason:'actual final drain not acquired'});
    }
  },30000);
  it.each(['reserved','derived','unregistered','duplicate','identity'] as const)('rejects %s finalization authority without publishing a dataset',async mode=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    const result=await runLongThreadInvocation(c,{
      async setup(ctx) {await ctx.writer.text('instrumentation/main.js','actual'); throw new Error('null capture');},
      async replay() {throw new Error('unreachable');},
      async finalize(ctx) {
        if(mode==='reserved') await ctx.writer.json('exceptions.json',{forged:true});
        const path=mode==='derived'?'results.json':mode==='unregistered'?'visible-validation.json':'instrumentation/main.js';
        const missing={status:'unavailable',reason:'not acquired'};
        const status=comparisonCaptureStatusSchema.parse({...ctx.identity,...(mode==='identity'?{repetition:'wrong'}:{}),status:'partial',reasons:['not acquired'],captureMetadata:missing,evidenceMetadata:missing,payloads:[],unavailablePaths:[],terminalPageDrain:missing,terminalProducerDrain:missing,finalPageInstrumentation:missing,traceEof:missing});
        const file={path,status:'partial' as const,reason:'not completed'};
        return {payloadFiles:mode==='duplicate'?[file,file]:[file],captureStatus:status};
      },
    });
    expect(result.finalized).toBe(false); await expect(result.finalize()).rejects.toThrow();
    await expect(readFile(join(c.out,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it.each(['evidence.json','raw-inventory.json'] as const)('retains exact provisional %s as stale unusable diagnostics when actual slot seal rejects',async manifestPath=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    let original:Buffer|undefined,failed=false;
    const actual=ComparisonArtifactWriter.prototype.seal;
    const spy=vi.spyOn(ComparisonArtifactWriter.prototype,'seal').mockImplementation(async function(this:ComparisonArtifactWriter) {
      if(!failed) {failed=true; original=await readFile(join(this.directory,manifestPath)); throw new Error('actual post-manifest slot seal failure');}
      await actual.call(this);
    });
    try {
      const result=await runLongThreadInvocation(c,{
        async setup() {return null;},
        async replay(ctx) {
          const validation=comparisonValidationSchema.parse({...ctx.identity,status:'valid',reasons:[],checks:[{name:'owned fixture',passed:true,reason:null,evidencePaths:[]}]});
          if(manifestPath==='raw-inventory.json') return {validation};
          const missing={status:'unavailable',reason:'storage test has no browser'},probe={intervalMs:50,callbacks:0,callbackDurationTotalMs:0,maximumObservedGapMs:missing};
          const {files:_,...evidence}=comparisonEvidenceSchema.parse({...ctx.identity,status:'partial',reason:'storage-only fixture',files:[],unavailableFiles:[],trace:missing,instrumentation:{runtimeProbe:probe,domProbe:{...probe,selectionStrategy:'bounded-visible-candidates'},scrollProbe:probe,transportDrain:probe,eventTiming:missing,loaf:missing,buffers:[]}});
          return {validation,evidence};
        },
      });
      expect(result.finalized).toBe(false); const directory=join(c.out,result.invocation.runs[0]!.artifactDirectory);
      expect(await readFile(join(directory,manifestPath))).toEqual(original);
      const manifest=JSON.parse(original!.toString()); const bytes=await readFile(join(directory,'validation.json'));
      expect(manifest.files.find((f:{path:string})=>f.path==='validation.json').sha256).not.toBe(createHash('sha256').update(bytes).digest('hex'));
      const failure=comparisonFinalizationStatusSchema.parse(JSON.parse(await readFile(join(directory,'finalization-status.json'),'utf8')));
      expect(failure.manifest).toEqual({path:manifestPath,state:'unusable'}); await expect(result.finalize()).rejects.toThrow(/slot seal failure/);
    } finally {spy.mockRestore();}
  },30000);
  it.each([false,true])('recognizes a real manifest renamed before rejected durability even when status retention fails=%s',async statusRetentionFails=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=1;
    const rootPath=await realpath(c.out), directory=join(rootPath,'runs/round-1/case-0/profile-0');
    let manifestRenamed=false,failedSync=false,provisional:Buffer|undefined;
    const result=await runLongThreadInvocation(c,{
      async setup() {return null;},
      async replay(ctx) {return {validation:comparisonValidationSchema.parse({...ctx.identity,status:'valid',reasons:[],checks:[{name:'owned fixture',passed:true,reason:null,evidencePaths:[]}]})};},
    },{fileOperations:{
      rename:async(source,destination)=>{
        if(statusRetentionFails && String(destination)===join(directory,'finalization-status.json')) throw new Error('actual status retention failed');
        await rename(source,destination);
        if(String(destination)===join(directory,'raw-inventory.json')) {manifestRenamed=true; provisional=await readFile(String(destination));}
      },
      open:async(...args)=>{const handle=await open(...args); if(manifestRenamed && !failedSync && String(args[0])===directory && (await handle.stat()).isDirectory()) handle.sync=async()=>{failedSync=true; throw new Error('manifest parent fsync rejected after real rename');}; return handle;},
    }});
    expect(failedSync).toBe(true); expect(result.finalized).toBe(false); expect(await readFile(join(directory,'raw-inventory.json'))).toEqual(provisional);
    if(statusRetentionFails) {expect(result.invocation.runs[0]!.reasons.join('; ')).toContain('finalization-status.json'); await expect(readFile(join(directory,'finalization-status.json'))).rejects.toMatchObject({code:'ENOENT'});}
    else expect(JSON.parse(await readFile(join(directory,'finalization-status.json'),'utf8')).manifest).toEqual({path:'raw-inventory.json',state:'unusable'});
    await expect(result.finalize()).rejects.toThrow(/manifest parent fsync rejected/); await expect(readFile(join(rootPath,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
  },30000);
  it.each([1,3])('durably seals every real raw member of a %i round null-capture collection', async rounds => {
    const c = await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=rounds;
    const result = await runLongThreadInvocation(c, {
      async setup(ctx) {await ctx.writer.text('instrumentation/main.js', 'actual partial bytes'); await ctx.writer.appendSerialized('page-exceptions.jsonl', ['{"message":"original page bytes"}']); throw new Error('acquired then failed');},
      async replay() {throw new Error('unreachable');},
    });
    expect(result.finalized).toBe(true);
    const seal = JSON.parse(await readFile(join(c.out,'dataset-seal.json'),'utf8'));
    expect(seal.slots).toHaveLength(rounds*12); expect(seal.status).toBe('sealed');
    for(const slot of result.invocation.runs) {
      const manifest=JSON.parse(await readFile(join(c.out,slot.artifactDirectory,'raw-inventory.json'),'utf8'));
      expect(manifest.status).toBe('partial'); expect(manifest.files.find((f:{path:string})=>f.path==='instrumentation/main.js')).toMatchObject({sha256:createHash('sha256').update('actual partial bytes').digest('hex'),byteLength:20});
      expect(await readFile(join(c.out,slot.artifactDirectory,'page-exceptions.jsonl'),'utf8')).toBe('{"message":"original page bytes"}\n');
      expect(slot.status).toBe('failed');
    }
    for(const member of seal.members) {
      const bytes=await readFile(join(c.out,member.path));
      expect(member.sha256).toBe(createHash('sha256').update(bytes).digest('hex')); expect(member.byteLength).toBe(bytes.length);
    }
  },30000);
  it.each([1,2,3])('builds the whole headless matrix for %i rounds',async rounds=>{
    const c=await config(); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=rounds;
    expect(createLongThreadLedger(c).runs).toHaveLength(rounds*12);
  });
  it('rejects four headless rounds before even making the nonexistent programmatic root',async()=>{
    const c=await config(); c.out=join(c.out,'not-created'); c.purpose='conformance'; c.configuration.mode='headless'; c.configuration.rounds=4;
    const factory=vi.fn(async()=>{}), fileOpen=vi.fn(open);
    await expect(runLongThreadInvocation(c,{setup:factory,replay:async()=>{throw new Error('unreachable');}},{fileOperations:{open:fileOpen}})).rejects.toThrow(/round|36/);
    expect(factory).not.toHaveBeenCalled(); expect(fileOpen).not.toHaveBeenCalled(); await expect(lstat(c.out)).rejects.toMatchObject({code:'ENOENT'});
  });
  it('rejects programmatic overscheduling before filesystem or factory access', async () => {
    const c = await config(); await writeFile(join(c.out, 'sentinel'), 'unchanged');
    c.purpose = 'conformance'; c.configuration.mode = 'headless'; c.configuration.rounds = 4;
    const setup = vi.fn(async () => {throw new Error('factory touched');});
    await expect(runLongThreadInvocation(c, {setup, replay: async () => {throw new Error('unreachable');}})).rejects.toThrow(/round|36|configuration/i);
    expect(setup).not.toHaveBeenCalled(); expect(await readFile(join(c.out, 'sentinel'), 'utf8')).toBe('unchanged');
    expect(() => createLongThreadLedger(c)).toThrow(/round|36|configuration/i);
  });
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
    expect(evidence.files.map(f => f.path)).toEqual(['capture-status.json', 'descriptor.json', 'exceptions.json', 'fixture.json', 'page.jsonl', 'producer.jsonl', 'trace.json', 'validation.json']);
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
        await ctx.writer.json('checkpoints.json', ctx.deadlines);
      },
    }, {clock: {now: () => now}});
    expect(JSON.parse(await readFile(join(cfg.out, result.invocation.runs[0]!.artifactDirectory, 'checkpoints.json'), 'utf8'))).toEqual([
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
        await ctx.writer.json('checkpoints.json', ctx.deadlines);
      },
    }, {clock: {now: () => now}});
    await started; now = 60000; await vi.advanceTimersByTimeAsync(60000); now = 70000; await vi.advanceTimersByTimeAsync(10000); const result = await run;
    now = 72000; resolve(); await result.ownershipSettled; await result.finalize();
    const persisted = JSON.parse(await readFile(join(configuration.out, result.invocation.runs[0]!.artifactDirectory, 'checkpoints.json'), 'utf8'));
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
