import { constants } from 'node:fs';
import { open, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_VERSION = 'Perfetto v59.1-1e9c61e98 (1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d)\nTrace Processor RPC API version: 14';
export const PROCESSOR_PINS = Object.freeze({
  'darwin-arm64': '8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4',
  'linux-x64': '2434129a3af4dc9e2034a476f7b76447b490975213e301769310d3bd0d5d6458',
});
const SHA = /^[a-f0-9]{64}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const tuple = s => Object.fromEntries(['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'].map(k => [k, String(s[k])]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function snapshot(input, limit) {
  if (!input || !isAbsolute(input.path ?? '') || !SHA.test(input.sha256 ?? '')) throw new Error('explicit absolute input path and lowercase SHA256 required');
  const pathBefore = await lstat(input.path, { bigint: true });
  if (!pathBefore.isFile() || pathBefore.nlink !== 1n || pathBefore.size > BigInt(limit)) throw new Error('input must be one-link regular file within size limit');
  // NONBLOCK avoids hanging on a FIFO substituted between lstat and open.
  const handle = await open(input.path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(limit)) throw new Error('input must be one-link regular file within size limit');
    const original = tuple(before);
    if (!same(original, tuple(pathBefore))) throw new Error('input path changed before open');
    if (!same(original, tuple(await lstat(input.path, { bigint: true })))) throw new Error('input path changed');
    const hash = createHash('sha256');
    const chunk = Buffer.alloc(65536); let bytes = 0;
    while (true) {
      const count = (await handle.read(chunk, 0, Math.min(chunk.length, limit + 1 - bytes), bytes)).bytesRead;
      if (!count) break;
      bytes += count; if (bytes > limit) throw new Error('input read exceeded limit'); hash.update(chunk.subarray(0, count));
    }
    const observed = { path: input.path, bytes, sha256: hash.digest('hex'), identity: original };
    if (!same(original, tuple(await handle.stat({ bigint: true }))) || !same(original, tuple(await lstat(input.path, { bigint: true })))) throw new Error('input changed while reading');
    if (observed.sha256 !== input.sha256 || (input.bytes !== undefined && input.bytes !== bytes)) {
      const error = new Error('input bytes or SHA256 mismatch'); error.observed = observed; throw error;
    }
    return observed;
  } finally { await handle.close(); }
}

// Resolve only when the ORIGINAL child and its original pipes have closed.
async function capture(executable, args, deadlineMs) {
  const started = performance.now();
  const record = { args, code: null, signal: null, closed: false, error: null, streams: {} };
  const buffers = { stdout: [], stderr: [] }; const lengths = { stdout: 0, stderr: 0 };
  const child = spawn(executable, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' } });
  let exited = false;
  const fail = message => {
    record.error ??= message;
    // Pipes are ours even when an exited child's descendant retains its writer.
    for (const name of ['stdout', 'stderr']) {
      const pipe = child[name]; const state = record.streams[name];
      if (state && !state.closed && !pipe.destroyed) {
        state.forcedDestroy = true; pipe.destroy();
      }
    }
    if (!exited && child.pid) {
      try { child.kill('SIGKILL'); }
      catch (error) { record.killError ??= error.message; }
    }
  };
  const timer = setTimeout(() => fail('process deadline exceeded'), Math.max(0, deadlineMs - (performance.now() - started)));
  const pipeClosures = ['stdout', 'stderr'].map(name => new Promise(resolvePipe => {
    const pipe = child[name];
    const state = record.streams[name] = { eof: false, closed: false, forcedDestroy: false, error: null, observedBytes: 0 };
    pipe.on('data', chunk => {
      state.observedBytes += chunk.length;
      const limit = name === 'stdout' ? 262144 : 65536;
      const retain = Math.min(chunk.length, limit - lengths[name]);
      if (retain > 0) { buffers[name].push(Buffer.from(chunk.subarray(0, retain))); lengths[name] += retain; }
      if (retain < chunk.length) fail(`${name} limit exceeded`);
    });
    pipe.once('end', () => { state.eof = true; });
    pipe.on('error', error => { state.error ??= error.message; fail(`${name} stream error: ${error.message}`); });
    pipe.once('close', () => {
      state.closed = true;
      if (!state.eof) fail(`${name} closed without EOF`);
      resolvePipe();
    });
  }));
  child.on('error', error => fail(`process error: ${error.message}`));
  child.once('exit', (code, signal) => {
    exited = true;
    if (code !== 0 || signal !== null) fail('processor exited unsuccessfully');
  });
  try {
    await new Promise(resolveClose => child.once('close', (code, signal) => { exited = true; record.code = code; record.signal = signal; record.closed = true; resolveClose(); }));
    await Promise.all(pipeClosures);
  } finally { clearTimeout(timer); }
  if (record.code !== 0 || record.signal !== null) record.error ??= 'processor exited unsuccessfully';
  const result = { record, stdout: Buffer.concat(buffers.stdout), stderr: Buffer.concat(buffers.stderr) };
  for (const name of ['stdout', 'stderr']) {
    const state = record.streams[name]; state.bytes = result[name].length; state.sha256 = digest(result[name]);
    if (!state.eof || !state.closed || state.forcedDestroy || state.error) record.error ??= `${name} did not end normally`;
  }
  return result;
}

export async function runDiagnostic(options) {
  return run(options, false, 'full');
}

export async function runInventoryDiagnostic(options) {
  return run(options, false, 'inventory');
}

export async function runTargetInventoryDiagnostic(options) {
  return run(options, false, 'target-inventory');
}

export async function runScopeInventoryDiagnostic(options) {
  return run(options, false, 'scope-inventory');
}

// Authored executable test fixtures are deliberately labeled untrusted diagnostics.
// The CLI never calls this entrypoint; no fixture result attests an official tool.
export async function runAuthoredFixtureDiagnostic(options) {
  return run(options, true, 'full');
}

export async function runAuthoredFixtureInventoryDiagnostic(options) {
  return run(options, true, 'inventory');
}

export async function runAuthoredFixtureTargetInventoryDiagnostic(options) {
  return run(options, true, 'target-inventory');
}

export async function runAuthoredFixtureScopeInventoryDiagnostic(options) {
  return run(options, true, 'scope-inventory');
}

async function run(options, authoredFixture, policy) {
  const { trace, processor, phases, out, deadlineMs = 60000 } = options;
  if (!isAbsolute(out ?? '')) throw new Error('absolute fresh output directory required');
  await mkdir(out, { mode: 0o700 }); // Exclusive: never modify a previous diagnostic.
  const manifest = { schema: 1, status: 'failure', diagnosticOnly: true, authoredFixture, officialProcessor: false, platform: `${process.platform}-${process.arch}`, nativeSupported: false, fps: null, duration: null, scoring: false, expectedVersion: EXPECTED_VERSION, expected: { trace, processor }, phases, processes: {} };
  if (policy === 'inventory') { manifest.queryPolicy = 'inventory-v1'; manifest.rawRowsExported = false; }
  if (policy === 'target-inventory' || policy === 'scope-inventory') {
    Object.assign(manifest, {
      queryPolicy: policy === 'scope-inventory' ? 'scope-inventory-compact-v1' : `${policy}-v1`, rawRowsExported: true,
      qualification: false, captureQualified: false, fpsEligibility: false,
      evaluationEligibility: false, scoringEligibility: false,
      rankingEligibility: false, clockAdmission: 'not_evaluated',
    });
  }
  const save = (name, bytes) => writeFile(join(out, name), bytes, { flag: 'wx', mode: 0o600 });
  const observe = async (stage, name, input, limit) => {
    manifest[stage] ??= {};
    try { return manifest[stage][name] = await snapshot(input, limit); }
    catch (error) {
      manifest[stage][name] = { error: error.message, observed: error.observed ?? null };
      throw error;
    }
  };
  try {
    if (!authoredFixture && (!PROCESSOR_PINS[manifest.platform] || processor?.sha256 !== PROCESSOR_PINS[manifest.platform])) throw new Error('processor hash does not match fixed platform pin');
    if (!Number.isInteger(trace?.bytes) || trace.bytes < 0 || trace.bytes > 33554432) throw new Error('explicit trace byte count within limit required');
    if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 60000) throw new Error('deadline must be 1..60000 ms');
    if (!Array.isArray(phases) || phases.length < 2 || phases.length > 16 || phases.some(p => typeof p !== 'string' || !p.length || Buffer.byteLength(p) > 256 || /[\x00-\x1f\x7f]/.test(p)) || new Set(phases).size !== phases.length) throw new Error('2..16 distinct literal phase names required');
    await observe('before', 'trace', trace, 33554432);
    await observe('before', 'processor', processor, 67108864);
    manifest.officialProcessor = !authoredFixture;
    const source = await readFile(new URL(policy === 'scope-inventory' ? './scope-inventory.sql' : policy === 'target-inventory' ? './target-inventory.sql' : policy === 'inventory' ? './inventory.sql' : './diagnostic.sql', import.meta.url), 'utf8');
    const sql = source.replace('__PHASE_LITERALS__', phases.map(p => `'${p.replaceAll("'", "''")}'`).join(', '));
    await save('diagnostic.sql', sql);
    manifest.sql = { path: join(out, 'diagnostic.sql'), sha256: digest(sql), sourceSha256: digest(source) };
    for (const [name, args] of [['version', ['--version']], ['query', ['query', '-f', manifest.sql.path, trace.path]]]) {
      const result = await capture(processor.path, args, deadlineMs);
      manifest.processes[name] = result.record;
      await save(`${name}.stdout`, result.stdout); await save(`${name}.stderr`, result.stderr);
      if (result.record.error) throw new Error(result.record.error);
      if (name === 'version') {
        manifest.observedVersion = result.stdout.toString('utf8');
        if (manifest.observedVersion.trim() !== EXPECTED_VERSION) throw new Error('processor version mismatch');
      }
    }
    manifest.status = 'success';
  } catch (error) { manifest.error = error.message; }
  // Even failed subprocesses must have their input bookends checked and retained.
  if (manifest.before) {
    for (const [name, input, limit] of [['trace', trace, 33554432], ['processor', processor, 67108864]]) {
      try { await observe('after', name, input, limit); }
      catch (error) { manifest.status = 'failure'; manifest.error = [manifest.error, error.message].filter(Boolean).join('; '); }
    }
    if (!same(manifest.before, manifest.after)) {
      manifest.status = 'failure'; manifest.error = [manifest.error, 'input identity changed across analysis'].filter(Boolean).join('; ');
    }
  }
  await save('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// Importing the library does not read inputs, spawn processes or write outputs.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || !['--config', '--inventory-config', '--target-inventory-config', '--scope-inventory-config'].includes(args[0])) throw new Error('usage: node tools/perfetto-import/run.mjs (--config|--inventory-config|--target-inventory-config|--scope-inventory-config) /absolute/config.json');
    if (!isAbsolute(args[1]) || resolve(args[1]) !== args[1]) throw new Error('normalized absolute config path required');
    const pathStat = await lstat(args[1], { bigint: true });
    if (!pathStat.isFile() || pathStat.nlink !== 1n || pathStat.size > 16384n) throw new Error('config must be one-link regular file <=16 KiB');
    const configHandle = await open(args[1], constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    let config;
    try {
      const before = await configHandle.stat({ bigint: true });
      if (!before.isFile() || before.nlink !== 1n || before.size > 16384n || !same(tuple(before), tuple(pathStat))) throw new Error('config must be unchanged one-link regular file <=16 KiB');
      const buffer = Buffer.alloc(16385);
      let length = 0;
      while (length < buffer.length) {
        const n = (await configHandle.read(buffer, length, buffer.length - length, length)).bytesRead;
        if (!n) break; length += n;
      }
      if (length > 16384) throw new Error('config exceeds 16 KiB');
      if (BigInt(length) !== before.size || !same(tuple(before), tuple(await configHandle.stat({ bigint: true }))) || !same(tuple(before), tuple(await lstat(args[1], { bigint: true })))) throw new Error('config changed during read');
      config = buffer.subarray(0, length).toString('utf8');
    } finally { await configHandle.close(); }
    const result = await (args[0] === '--scope-inventory-config' ? runScopeInventoryDiagnostic : args[0] === '--target-inventory-config' ? runTargetInventoryDiagnostic : args[0] === '--inventory-config' ? runInventoryDiagnostic : runDiagnostic)(JSON.parse(config));
    process.stdout.write(`${JSON.stringify({ status: result.status, out: JSON.parse(config).out, error: result.error })}\n`);
    if (result.status !== 'success') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
