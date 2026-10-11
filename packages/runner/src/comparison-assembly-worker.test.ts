import {test, expect, describe, beforeEach, afterEach, type TestContext} from 'vitest';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access, cp, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {Writable, PassThrough} from 'node:stream';
import {writeWorkerWire, runComparisonAssemblyWorker} from './comparison-assembly-worker.js';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {canonicalSerialize} from '@chat-ui-bench/contract';
import {preOptions, mainOptions} from './comparison-page.test-helper.mts';

const worker = join(process.cwd(), 'packages/runner/dist/comparison-assembly-worker.js');
function run(bytes: Buffer): Promise<{code: number | null; stdout: Buffer; stderr: Buffer}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker], {env: {NODE_DISABLE_COMPILE_CACHE: '1'}, stdio: 'pipe'});
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    child.on('error', reject);
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.stdin.on('error', () => {});
    child.on('close', code => resolve({code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr)}));
    child.stdin.end(bytes);
  });
}
test('actual emitted standalone entry exists', async () => {
  await expect(access(worker)).resolves.toBeUndefined();
});
test('actual standalone worker returns exact original ordered pair with no LF', async () => {
  const pre = canonicalSerialize(preOptions), main = canonicalSerialize(mainOptions);
  const result = await run(Buffer.from(JSON.stringify([pre, main])));
  expect(result.code).toBe(0);
  expect(result.stderr.length).toBe(0);
  // A separate native Node lane imports original compiled code without
  // Vitest transforms. No retained artifact code is executed.
  const moduleURL = pathToFileURL(join(process.cwd(), 'packages/runner/dist/comparison-installer.js')).href;
  const code = `import {assembleComparisonInstaller} from ${JSON.stringify(moduleURL)};process.stdout.write(JSON.stringify(assembleComparisonInstaller(...JSON.parse(process.argv[1]))));`;
  const expected = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code, JSON.stringify([pre, main])], {env: {NODE_DISABLE_COMPILE_CACHE: '1'}, encoding: 'buffer'});
  expect(result.stdout.equals(expected.stdout)).toBe(true);
});
test('actual stdout pipe failure remains silent and cannot report success', async () => {
  const result = await new Promise<{code: number | null; stderr: Buffer}>((resolve, reject) => {
    const child = spawn(process.execPath, [worker], {env: {NODE_DISABLE_COMPILE_CACHE: '1'}, stdio: 'pipe'});
    const stderr: Buffer[] = []; child.on('error', reject); child.stdin.on('error', () => {});
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('close', code => resolve({code, stderr: Buffer.concat(stderr)}));
    child.stdout.destroy(); child.stdin.end(JSON.stringify([canonicalSerialize(preOptions), canonicalSerialize(mainOptions)]));
  });
  expect(result.code).not.toBe(0); expect(result.stderr.length).toBe(0);
});
test('stdin tuple bytes alone cannot assemble before actual EOF', async () => {
  const input = new PassThrough(); let writes = 0;
  const output = new Writable({write(_chunk, _encoding, callback) {writes++; callback();}});
  const running = runComparisonAssemblyWorker(input, output);
  input.write(JSON.stringify([canonicalSerialize(preOptions), canonicalSerialize(mainOptions)]));
  await new Promise<void>(resolve => setImmediate(resolve)); expect(writes).toBe(0);
  input.end(); await running; expect(writes).toBeGreaterThan(0);
});
test('observed stdin error rejects without any output success', async () => {
  const input = new PassThrough(); let writes = 0;
  const output = new Writable({write(_chunk, _encoding, callback) {writes++; callback();}});
  const running = runComparisonAssemblyWorker(input, output);
  input.destroy(new Error('actual input stream failure'));
  await expect(running).rejects.toThrow('input stream failure'); expect(writes).toBe(0);
});
test.each([
  Buffer.from('\ufeff["",""]'), Buffer.from('["",""]\n'), Buffer.from('["",""] ["",""]'),
  Buffer.from([0xff]), Buffer.from('[1,2]'), Buffer.from('["",""]'),
  Buffer.from(JSON.stringify(['a'.repeat(65537), ''])), Buffer.alloc(786440, 32),
])('actual worker fails silently on malformed or overbudget input %#', async bytes => {
  const result = await run(bytes);
  expect(result.code).not.toBe(0);
  expect(result.stdout.length).toBe(0);
  expect(result.stderr.length).toBe(0);
});
test('literal protocol envelopes and Unicode expansion bounds', () => {
  expect(Buffer.byteLength('["",""]')).toBe(7);
  expect(Buffer.byteLength(JSON.stringify({preNavigation: '', main: '', preNavigationByteLength: 1048576, mainByteLength: 1048576, installerSha256: '0'.repeat(64)}))).toBe(174);
  expect(2 * 6 * 65536 + 7).toBe(786439);
  expect(2 * 6 * 1048576 + 174).toBe(12583086);
  for (const value of ['\u0000', '"', '\\', '漢', '🌍', '\ud800']) {
    expect(Buffer.byteLength(JSON.stringify([value, value]))).toBeLessThanOrEqual(12 * Buffer.byteLength(value) + 7);
  }
});

test.each(['callback-first', 'drain-first'] as const)('wire writer awaits both latches on false return: %s', async order => {
  const stream = new Writable({write(_chunk, _encoding, callback) {callback();}});
  let callback: ((error?: Error | null) => void) | undefined;
  let writes = 0;
  stream.write = ((_bytes: Buffer, done: (error?: Error | null) => void) => {writes++; callback = done; return false;}) as typeof stream.write;
  const writing = writeWorkerWire(stream, Buffer.alloc(65537));
  if (order === 'callback-first') callback!(); else stream.emit('drain');
  await Promise.resolve(); expect(writes).toBe(1);
  if (order === 'callback-first') stream.emit('drain'); else callback!();
  await Promise.resolve(); expect(writes).toBe(2);
  callback!(); stream.emit('drain'); await writing;
});
test('wire writer requires callback even when write returns true and rejects close', async () => {
  const stream = new Writable({write(_chunk, _encoding, callback) {callback();}});
  stream.write = (() => true) as typeof stream.write;
  const writing = writeWorkerWire(stream, Buffer.from('x'));
  let settled = false; void writing.then(() => {settled = true;}, () => {});
  await Promise.resolve(); expect(settled).toBe(false);
  stream.emit('close'); await expect(writing).rejects.toThrow('worker-write-failed');
});
describe('fresh original worker cache fixture lifecycle', () => {
  const states = new WeakMap<TestContext['task'], {body: () => Promise<void>; cleanup: () => Promise<void>}>();
  beforeEach(context => {
  const rows: {phase: string; boundary: string; elapsedMs: number | null; durationMs?: number | null}[] = [];
  const pending = new Set<string>();
  let attempts = 0, diagnosticErrors = 0, anchor: bigint | undefined;
  const elapsed = (): number | null => {
    try {return anchor === undefined ? null : Number(process.hrtime.bigint() - anchor) / 1e6;}
    catch {diagnosticErrors++; return null;}
  };
  try {anchor = process.hrtime.bigint();} catch {diagnosticErrors++;}
  const facts = {
    setup: 'not-started', body: 'not-started', cleanup: 'not-started', callback: 'not-started', removal: 'not-started', oracle: 'not-reached', root: '',
    parentCoverage: 'unavailable', parentCloses: [false, false, false, false], innerWorkerClosureCoverage: 'unavailable',
    firstOperationError: {} as Record<string, string>, removalError: {} as Record<string, string>,
  };
  const project = (error: unknown): Record<string, string> => {
    const result: Record<string, string> = {};
    try {
      if (typeof error === 'object' && error !== null) for (const key of ['name', 'message', 'code']) {
        const field = Object.getOwnPropertyDescriptor(error, key);
        if (field && 'value' in field && typeof field.value === 'string') result[key] = field.value.slice(0, 256);
      }
    } catch {diagnosticErrors++;}
    return result;
  };
  let firstOperationRejected = false, failureIssued = false, lateIssued = false;
  const note = (phase: string, boundary: string, started?: number | null): void => {
    const now = elapsed(); attempts++;
    if (rows.length < 64) rows.push({phase, boundary, elapsedMs: now,
      ...(started === undefined ? {} : {durationMs: now === null || started === null ? null : now - started})});
  };
  const phase = <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const started = elapsed(); pending.add(name); note(name, 'entered');
    const rejected = (error: unknown): void => {
      if (name === 'removal') facts.removalError = project(error);
      else if (!firstOperationRejected) {firstOperationRejected = true; facts.firstOperationError = project(error);}
    };
    let original: Promise<T>;
    try {original = operation();}
    catch (error) {
      try {note(name, 'rejected', started); rejected(error); pending.delete(name);} catch {diagnosticErrors++;}
      throw error;
    }
    try {
      void original.then(() => {
        try {note(name, 'fulfilled', started); pending.delete(name);} catch {diagnosticErrors++;}
      }, error => {
        try {note(name, 'rejected', started); rejected(error); pending.delete(name);} catch {diagnosticErrors++;}
      });
    } catch {diagnosticErrors++;}
    return original;
  };
  const emit = (point: string): void => {
    try {
      const snapshot = {point, elapsedMs: elapsed(), ...facts, parentCloses: [...facts.parentCloses],
        firstOperationError: {...facts.firstOperationError}, removalError: {...facts.removalError},
        pending: [...pending], rows: rows.map(row => ({...row})), attempts, limit: 64, truncated: attempts > rows.length, diagnosticErrors, failureHookObserved: failureIssued};
      let encoded = JSON.stringify(snapshot);
      while (Buffer.byteLength(encoded, 'utf8') > 16384 && snapshot.rows.length) {
        snapshot.rows.pop(); snapshot.truncated = true; encoded = JSON.stringify(snapshot);
      }
      if (Buffer.byteLength(encoded, 'utf8') > 16384) encoded = JSON.stringify({...snapshot, root: '', rows: [], firstOperationError: {}, removalError: {}, truncated: true});
      console.error('comparison worker-cache diagnostic:', encoded);
    } catch {diagnosticErrors++;}
  };
  context.onTestFailed(() => {if (!failureIssued) {failureIssued = true; emit('actual framework failure hook');}});
  let root: string | undefined;
  let setup: Promise<void> | undefined, body: Promise<void> | undefined, cleanup: Promise<void> | undefined;
  const receipt = (operation: Promise<void>, lane: 'setup' | 'body' | 'cleanup'): void => {
    const terminal = (state: string): void => {
      try {
        facts[lane] = state; note(`actual ${lane} promise`, state);
        if (lane === 'cleanup' && failureIssued && !lateIssued) {lateIssued = true; emit('actual late cleanup settlement');}
      } catch {diagnosticErrors++;}
    };
    try {void operation.then(() => {terminal('fulfilled');}, () => {terminal('rejected');});}
    catch {diagnosticErrors++;}
  };
  states.set(context.task, {
    body: () => {
      if (body) throw new Error('worker-cache body already started');
      if (!root) throw new Error('worker-cache setup did not supply a root');
      const actualRoot = root;
      facts.body = 'pending';
      body = (async () => {
    const script = `
      import {assembleComparisonInstaller} from './packages/runner/dist/comparison-installer.js';
      import {readFile,writeFile} from 'node:fs/promises';
      import {spawn} from 'node:child_process';
      const [pre,main] = JSON.parse(process.argv[2]);
      const cached=assembleComparisonInstaller(pre,main);
      const key='packages/runner/dist/comparison-observations.js';
      const before=await readFile(key,'utf8');
      const after=before.replace('const page =','const page = /* private original dependency change */');
      if(after===before)throw Error('fixture did not change');
      await writeFile(key,after);
      const child=spawn(process.execPath,['packages/runner/dist/comparison-assembly-worker.js'],{env:{NODE_DISABLE_COMPILE_CACHE:'1'},stdio:'pipe'});
      const chunks=[];child.stdout.on('data',v=>chunks.push(v));
      child.stderr.on('data',()=>{process.exitCode=1;});child.on('error',()=>{process.exitCode=1;});
      child.stdin.end(JSON.stringify([pre,main]));
      child.on('close',code=>{
        const fresh=JSON.parse(Buffer.concat(chunks).toString());
        process.stdout.write(JSON.stringify({code,cacheUnchanged:assembleComparisonInstaller(pre,main).installerSha256===cached.installerSha256,freshChanged:fresh.installerSha256!==cached.installerSha256,marker:fresh.preNavigation.includes('private original dependency change')}));
      });`;
    await phase('write original parent script', () => writeFile(join(actualRoot, 'prime-original.mjs'), script));
    const result = await phase('native execFile', () => {
      const execution = promisify(execFile)(process.execPath, ['prime-original.mjs', JSON.stringify([canonicalSerialize(preOptions), canonicalSerialize(mainOptions)])], {cwd: actualRoot, env: {NODE_DISABLE_COMPILE_CACHE: '1'}});
      facts.callback = 'pending';
      void execution.then(() => {facts.callback = 'fulfilled';}, () => {facts.callback = 'rejected';});
      let installed = 0;
      try {
        const child = execution.child;
        if (child) facts.parentCoverage = 'partial';
        for (let index = 0; child && index < 4; index++) {
          try {
            const emitter = index === 0 ? child : index === 1 ? child.stdin : index === 2 ? child.stdout : child.stderr;
            if (emitter) {emitter.once('close', () => {
              try {facts.parentCloses[index] = true; note(`parent close ${index}`, 'received');} catch {diagnosticErrors++;}
            }); installed++;}
          } catch {diagnosticErrors++;}
        }
      } catch {diagnosticErrors++;}
      if (installed === 4) facts.parentCoverage = 'installed';
      return execution;
    });
    note('assertions', 'entered');
    try {
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({code: 0, cacheUnchanged: true, freshChanged: true, marker: true});
    facts.oracle = 'passed'; note('assertions', 'fulfilled');
    } catch (error) {
      facts.oracle = 'failed'; note('assertions', 'rejected');
      if (!firstOperationRejected) {firstOperationRejected = true; facts.firstOperationError = project(error);}
      throw error;
    }
      })();
      receipt(body, 'body');
      return body;
    },
    cleanup: () => {
      if (cleanup) return cleanup;
      facts.cleanup = 'pending';
      cleanup = (async () => {
        await Promise.allSettled([...(setup ? [setup] : []), ...(body ? [body] : [])]);
        if (root) {
          const actualRoot = root;
          facts.removal = 'pending';
          try {await phase('removal', () => rm(actualRoot, {recursive: true, force: true})); facts.removal = 'fulfilled';}
          catch (error) {facts.removal = 'rejected'; throw error;}
        }
      })();
      receipt(cleanup, 'cleanup');
      return cleanup;
    },
  });
  facts.setup = 'pending';
  setup = (async () => {
    const actualRoot = await phase('mkdtemp', () => mkdtemp(join(tmpdir(), 'comparison-worker-original-')));
    root = actualRoot; facts.root = actualRoot.slice(0, 1024);
    for (const path of ['packages/runner/dist', 'packages/contract/dist', 'node_modules/zod']) await phase(`copy ${path}`, () => cp(join(process.cwd(), path), join(actualRoot, path), {recursive: true}));
    await phase('mkdir package resolution', () => mkdir(join(actualRoot, 'node_modules/@chat-ui-bench/contract'), {recursive: true}));
    await phase('copy contract metadata', () => cp(join(process.cwd(), 'packages/contract/package.json'), join(actualRoot, 'node_modules/@chat-ui-bench/contract/package.json')));
    await phase('second contract dist copy', () => cp(join(actualRoot, 'packages/contract/dist'), join(actualRoot, 'node_modules/@chat-ui-bench/contract/dist'), {recursive: true}));
    await phase('write root metadata', () => writeFile(join(actualRoot, 'package.json'), '{"type":"module"}'));
  })();
  receipt(setup, 'setup');
  return setup;
  });
  test('fresh actual original transitive imports ignore the primed parent module cache', context => {
    const state = states.get(context.task);
    if (!state) throw new Error('worker-cache task state missing');
    return state.body();
  });
  afterEach(context => {
    const state = states.get(context.task);
    if (!state) throw new Error('worker-cache cleanup task state missing');
    return state.cleanup();
  });
});
