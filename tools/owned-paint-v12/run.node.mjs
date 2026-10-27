import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';

const entry = new URL('./run.mjs', import.meta.url);
const policy = 'private-owned-whole-ordered-paint-r-v12';
function run(input, options = {}) {
  return new Promise((resolve, reject) => {
    const inputFD = options.fileInput ? fs.openSync(options.fileInput, 'r') : null;
    const child = spawn(process.execPath, [entry.pathname], { stdio: [inputFD ?? 'pipe', 'pipe', 'pipe'], env: { ...process.env, ...options.env } });
    if (inputFD !== null) fs.closeSync(inputFD);
    const out = [], err = [];
    child.stdout.on('data', b => out.push(b)); child.stderr.on('data', b => err.push(b));
    child.on('error', reject);
    child.on('close', code => {
      try { resolve({ code, result: JSON.parse(Buffer.concat(out).toString('utf8')), stderr: Buffer.concat(err).toString('utf8') }); }
      catch (error) { reject(error); }
    });
    if (child.stdin) { child.stdin.on('error', () => {}); child.stdin.end(input); }
  });
}
function failure(result) {
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reader, null); assert.equal(result.bundle, null);
  assert.deepEqual(result.metrics, { FPS: null, rate: null, latency: null, duration: null });
  for (const key of ['nativeSupported', 'qualificationEligibility', 'evaluationEligibility', 'scoringEligibility', 'rankingEligibility']) assert.equal(result.authority[key], false);
  assert.ok(!JSON.stringify(result).includes('complete-owned-selected-schema'));
}
test('malformed single request returns only the fixed failure envelope', async () => {
  for (const input of ['', '{}', 'null', '[]', '{', '{}\n{}', ' '.repeat(65537)]) {
    const output = await run(input); failure(output.result); assert.equal(output.stderr, '');
  }
});
test('invalid manifest custody never creates a child semantic bundle or output path', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-cli-synthetic-')));
  try {
    const trace = path.join(directory, 'authored.bin'); fs.writeFileSync(trace, Buffer.from([10, 0]));
    const output = path.join(directory, 'sealed.json');
    const ref = { path: trace, bytes: 2, sha256: createHash('sha256').update(Buffer.from([10, 0])).digest('hex') };
    const request = { policy, trace: ref, compatibility: { path: path.join(directory, 'absent.json'), bytes: 0, sha256: '0'.repeat(64) }, output };
    const result = await run(JSON.stringify(request)); failure(result.result);
    assert.equal(fs.existsSync(output), false);
    assert.deepEqual(fs.readdirSync(directory), ['authored.bin']);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('request schema denies arbitrary runtime path, import and shell fields', async () => {
  for (const key of ['node', 'module', 'command', 'resolver', 'budget', 'timeout', 'execArgv']) {
    const result = await run(JSON.stringify({ policy, [key]: '/should-not-run' })); failure(result.result);
  }
});

function syntheticRequest(directory) {
  const trace = path.join(directory, 'authored.bin'), bytes = Buffer.from([10, 0]); fs.writeFileSync(trace, bytes);
  const template = JSON.parse(fs.readFileSync(new URL('./compatibility.json', import.meta.url), 'utf8'));
  // Authored local compatibility fixture keeps the reviewed source/build hashes,
  // binding exactly this test process's physical executable on each CI host.
  const executable = fs.realpathSync(process.execPath), binary = fs.readFileSync(executable), stat = fs.statSync(executable, { bigint: true });
  template.runtime = { path: executable, bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
    identity: [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(String),
    version: process.version, platform: process.platform, arch: process.arch };
  const manifestPath = path.join(directory, 'compatibility.json'), manifest = Buffer.from(JSON.stringify(template)); fs.writeFileSync(manifestPath, manifest);
  return { policy, trace: { path: trace, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
    compatibility: { path: manifestPath, bytes: manifest.length, sha256: createHash('sha256').update(manifest).digest('hex') }, output: path.join(directory, 'sealed.json') };
}
test('actual original worker reads synthetic bytes and parent seals a verified local diagnostic', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-seal-synthetic-')));
  try {
    const request = syntheticRequest(directory), response = await run(JSON.stringify(request));
    assert.equal(response.result.status, 'sealed-local-diagnostic'); assert.equal(response.result.reason, null);
    assert.equal(response.result.reader.fullInputVerified, true); assert.equal(response.result.reader.structuralContainerEOF, true);
    assert.equal(response.result.reader.study.status, 'complete-owned-selected-schema');
    assert.equal(response.result.reader.study.counters.packets, 1);
    const raw = fs.readFileSync(request.output), sealed = JSON.parse(raw);
    assert.equal(raw.length, response.result.bundle.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), response.result.bundle.sha256);
    assert.equal(sealed.reader.fullInputVerified, true);
    assert.deepEqual(fs.readdirSync(directory).sort(), ['authored.bin', 'compatibility.json', 'sealed.json']);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('occupied destination is preserved byte-for-byte and receives no semantic seal', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-occupied-synthetic-')));
  try {
    const request = syntheticRequest(directory); fs.writeFileSync(request.output, 'original user file');
    const response = await run(JSON.stringify(request)); failure(response.result);
    assert.equal(fs.readFileSync(request.output, 'utf8'), 'original user file');
    assert.deepEqual(fs.readdirSync(directory).sort(), ['authored.bin', 'compatibility.json', 'sealed.json']);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

function controls(overrides = {}) {
  const source = fs.readFileSync(entry, 'utf8').replace(/^import .*;\n/gm, '')
    .replace(/^const ROOT = .*;$/m, 'const ROOT = ' + JSON.stringify(overrides.root ?? path.resolve(entry.pathname, '../../..')) + ';')
    .replace(/main\(\)\.catch\(.*\);\s*$/, '');
  return Function('fs', 'path', 'createHash', 'randomBytes', 'spawn', 'process', 'setTimeout', 'clearTimeout',
    'let measurementCount=0;\n' + source.replace('function measureOutput(value,budget){', 'function measureOutput(value,budget){measurementCount++;') +
    '\nreturn {parse,lexical,collect,childOnce,ParentBudget,publish,closure,prepareOutput,sendFinalOutput,importEdges,measurements:()=>measurementCount};')(
    fs, path, createHash, () => Buffer.alloc(16, 7), overrides.spawn ?? (() => { throw Error('no child expected'); }),
    overrides.process ?? process, overrides.setTimeout ?? setTimeout, overrides.clearTimeout ?? clearTimeout);
}
test('production lexical preflight denies deep and overwide JSON before JSON.parse', () => {
  const api = controls(), budget = new api.ParentBudget(), original = JSON.parse; let calls = 0;
  JSON.parse = (...args) => { calls++; return original(...args); };
  try {
    assert.throws(() => api.parse('['.repeat(17) + '0' + ']'.repeat(17), 'request', budget));
    assert.throws(() => api.parse('"' + 'x'.repeat(4097) + '"', 'request', budget));
    assert.throws(() => api.parse('{"x":' + '['.repeat(25) + '0' + ']'.repeat(25) + '}', 'child', budget));
    assert.equal(calls, 0);
  } finally { JSON.parse = original; }
});
test('lexical string-width boundary accepts raw and escaped paired Unicode at4096UTF8 bytes', () => {
  const api = controls();
  const paired = '😀'.repeat(1024);
  for (const text of [JSON.stringify(paired), '"' + '\\ud83d\\ude00'.repeat(1024) + '"', '"' + '\\u00e9'.repeat(2048) + '"']) {
    const parsed = api.parse(text, 'child', new api.ParentBudget());
    assert.equal(Buffer.byteLength(parsed.value), 4096); parsed.release();
  }
  assert.throws(() => api.parse(JSON.stringify(paired + '😀'), 'child', new api.ParentBudget()));
});
test('original transport needs independent end and close and refuses capacity before copy', async () => {
  const api = controls(), budget = new api.ParentBudget(), stream = new EventEmitter(); stream.destroy = () => stream.emit('close');
  const receipt = api.collect(stream, 3, budget); stream.emit('data', Buffer.from('abc'));
  assert.throws(() => receipt.finish()); stream.emit('end'); assert.throws(() => receipt.finish()); stream.emit('close'); await receipt.done;
  assert.equal(receipt.finish().toString(), 'abc');
  const over = new EventEmitter(); over.destroy = () => over.emit('close'); const refused = api.collect(over, 3, budget);
  over.emit('data', Buffer.from('abcd')); await refused.done; assert.throws(() => refused.finish());
  const late = new EventEmitter(); late.destroy = () => late.emit('close'); const lateReceipt = api.collect(late, 20, budget);
  late.emit('end'); late.emit('data', Buffer.from('late')); await lateReceipt.done; assert.throws(() => lateReceipt.finish());
});
function fakeChild(fault) {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
  child.stdout.destroy = () => child.stdout.emit('close'); child.stderr.destroy = () => child.stderr.emit('close');
  child.stdin.end = () => { child.stdin.emit('finish'); child.stdin.emit('close'); };
  const close = (code, signal = null) => {
    child.stdout.emit('data', Buffer.from('{"authored":true}'));
    if (fault === 'stderr-overflow') child.stderr.emit('data', Buffer.alloc(65537));
    for (const stream of [child.stdout, child.stderr]) { if (fault !== 'missing-end') stream.emit('end'); stream.emit('close'); }
    child.emit('exit', code, signal); child.emit('close', code, signal);
  };
  child.kill = signal => { child.kills.push(signal); close(null, signal); return true; }; child.kills = [];
  if (fault !== 'deadline') queueMicrotask(() => close(fault === 'exit' ? 1 : 0));
  return child;
}
for (const fault of ['exit', 'missing-end', 'stderr-overflow', 'deadline']) test('original child lifecycle withdraws on ' + fault, async () => {
  let spawns = 0, child;
  const options = { spawn() { spawns++; return child = fakeChild(fault); } };
  if (fault === 'deadline') { options.setTimeout = fn => { queueMicrotask(fn); return 1; }; options.clearTimeout = () => {}; }
  const api = controls(options), budget = new api.ParentBudget();
  await assert.rejects(api.childOnce('{}', { path: process.execPath }, budget));
  assert.equal(spawns, 1); if (fault === 'deadline') assert.deepEqual(child.kills, ['SIGTERM']);
});
test('exclusive temporary write failure removes only this run owned file', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-write-synthetic-')));
  const original = fs.writeSync;
  try {
    const api = controls(), budget = new api.ParentBudget(); fs.writeSync = () => 0;
    assert.throws(() => api.publish(path.join(directory, 'out.json'), Buffer.from('{}'), budget, []));
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.writeSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('actual fixed worker preserves control escapes, quotes, backslashes and Unicode in a candidate', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-controls-synthetic-')));
  try {
    const request = syntheticRequest(directory), encoder = new TextEncoder();
    const varint = n => { const out = []; do { const low = n & 127; n = Math.floor(n / 128); out.push(low | (n ? 128 : 0)); } while (n); return out; };
    const uint = (field, n) => Buffer.from([...varint(field * 8), ...varint(n)]);
    const body = (field, bytes) => Buffer.concat([Buffer.from([...varint(field * 8 + 2), ...varint(bytes.length)]), bytes]);
    const text = (field, value) => body(field, Buffer.from(encoder.encode(value)));
    const value = 'controls:\b\t\n\f\r\0"\\é😀';
    const bytes = body(1, Buffer.concat([uint(10, 1), uint(13, 1), body(11, Buffer.concat([uint(9, 3), text(22, 'blink.user_timing'), text(23, value)]))]));
    fs.writeFileSync(request.trace.path, bytes); request.trace.bytes = bytes.length; request.trace.sha256 = createHash('sha256').update(bytes).digest('hex');
    const response = await run(JSON.stringify(request)); assert.equal(response.result.status, 'sealed-local-diagnostic');
    assert.equal(response.result.reader.study.candidates[0].value, value);
    const sealed = JSON.parse(fs.readFileSync(request.output, 'utf8')); assert.equal(sealed.reader.study.candidates[0].value, value);
    assert.equal(response.result.usage.finalOutput.escapedBytes, Buffer.byteLength(JSON.stringify(response.result)));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('sealed semantic refusal remains an explicit unavailable diagnostic with verified file custody', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-refusal-synthetic-')));
  try {
    const request = syntheticRequest(directory), bytes = Buffer.from([10, 3, 146, 3, 0]);
    fs.writeFileSync(request.trace.path, bytes); request.trace.bytes = bytes.length; request.trace.sha256 = createHash('sha256').update(bytes).digest('hex');
    const response = await run(JSON.stringify(request)); assert.equal(response.result.status, 'sealed-local-diagnostic');
    assert.equal(response.result.reader.status, 'unavailable'); assert.equal(response.result.reader.fullInputVerified, true);
    assert.equal(response.result.reader.study.status, 'unavailable'); assert.deepEqual(response.result.reader.study.paint, []);
    assert.deepEqual(response.result.reader.study.state.definitions, []); assert.equal(fs.existsSync(request.output), true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('source closure refuses an identical-byte physical replacement between original bookends', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-closure-synthetic-')));
  try {
    const request = syntheticRequest(directory), manifest = JSON.parse(fs.readFileSync(request.compatibility.path, 'utf8'));
    const originalRoot = path.resolve(entry.pathname, '../../..');
    for (const row of manifest.files) { const destination = path.join(directory, row.path); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(originalRoot, row.path), destination); }
    const api = controls({ root: directory }), budget = new api.ParentBudget(), original = api.closure(manifest, budget);
    const target = path.join(directory, manifest.files[0].path), bytes = fs.readFileSync(target);
    fs.renameSync(target, target + '.original'); fs.writeFileSync(target, bytes);
    assert.throws(() => api.closure(manifest, budget, original));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('toolchain mismatch denies before any source descriptor opens', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-toolchain-synthetic-'))), original = fs.openSync;
  try {
    const request = syntheticRequest(directory), manifest = JSON.parse(fs.readFileSync(request.compatibility.path, 'utf8'));
    manifest.toolchain.compilerVersion = 'unreviewed'; const api = controls(), budget = new api.ParentBudget(); let calls = 0;
    fs.openSync = (...args) => { calls++; return original(...args); };
    assert.throws(() => api.closure(manifest, budget)); assert.equal(calls, 0);
  } finally { fs.openSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('exclusive publication collision preserves the newly occupied user destination', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-collision-synthetic-'))), original = fs.linkSync;
  try {
    const api = controls(), budget = new api.ParentBudget(), destination = path.join(directory, 'out.json');
    fs.linkSync = (source, target) => { fs.writeFileSync(target, 'user-owned'); return original(source, target); };
    assert.throws(() => api.publish(destination, Buffer.from('{}'), budget, []));
    assert.equal(fs.readFileSync(destination, 'utf8'), 'user-owned'); assert.deepEqual(fs.readdirSync(directory), ['out.json']);
  } finally { fs.linkSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('same-size mutation during exclusive link cannot publish a stale hash for final bytes', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-link-mutation-synthetic-'))), original = fs.linkSync;
  try {
    const api = controls(), budget = new api.ParentBudget(), destination = path.join(directory, 'out.json');
    fs.linkSync = (source, target) => { fs.writeFileSync(source, 'xx'); return original(source, target); };
    assert.throws(() => api.publish(destination, Buffer.from('{}'), budget, []));
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.linkSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('publication performs its single bounded readback on the final one-link600 path', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-final-readback-synthetic-'))), original = fs.openSync;
  try {
    const api = controls(), budget = new api.ParentBudget(), destination = path.join(directory, 'out.json'), reads = [];
    fs.openSync = (filename, flags, ...args) => { if (typeof flags === 'number' && (flags & 3) === fs.constants.O_RDONLY) reads.push(filename); return original(filename, flags, ...args); };
    const bundle = api.publish(destination, Buffer.from('{}'), budget, []), stat = fs.lstatSync(destination);
    assert.deepEqual(reads, [destination]); assert.equal(stat.nlink, 1); assert.equal(stat.mode & 0o777, 0o600);
    assert.equal(bundle.sha256, createHash('sha256').update('{}').digest('hex'));
    assert.equal(budget.usage.cumulative.sourceReadBytes, 0); assert.equal(budget.usage.cumulative.sourceHashBytes, 0);
    assert.ok(budget.usage.cumulative.outputReadbackBytes > 0);
  } finally { fs.openSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('final-path readback close failure withdraws and removes the original owned seal', () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-final-close-synthetic-'))), original = fs.closeSync;
  try {
    const api = controls(), budget = new api.ParentBudget(); let closes = 0;
    fs.closeSync = fd => { original(fd); if (++closes === 2) throw Error('authored final readback close'); };
    assert.throws(() => api.publish(path.join(directory, 'out.json'), Buffer.from('{}'), budget, []));
    assert.equal(closes, 2); assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.closeSync = original; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('regular-file redirected stdin closes its original descriptor and seals synthetic input', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-file-stdin-synthetic-')));
  try {
    const request = syntheticRequest(directory), filename = path.join(directory, 'request.json'); fs.writeFileSync(filename, JSON.stringify(request));
    const response = await run(null, { fileInput: filename });
    assert.equal(response.result.status, 'sealed-local-diagnostic'); assert.equal(response.result.reader.fullInputVerified, true);
    assert.equal(fs.existsSync(request.output), true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('parent allocation and output counters deny atomically at selected finite capacities', () => {
  const api = controls(), budget = new api.ParentBudget();
  budget.counter('sourceReadBytes', 2 * (16777216 + 1048576));
  assert.throws(() => budget.counter('sourceReadBytes', 1));
  assert.equal(budget.usage.cumulative.sourceReadBytes, 35651584);
  budget.counter('allocatedUTF16Units', 34359738368);
  const before = structuredClone(budget.usage.current);
  assert.throws(() => budget.occupy(2, { utf16Units: 1 }));
  assert.deepEqual(budget.usage.current, before);
  budget.counter('outputReadbackBytes', 33554433); assert.throws(() => budget.counter('outputReadbackBytes', 1));
});

test('parent output uses one full walk and snapshots prepaid settlement and staging', () => {
  const api = controls(), budget = new api.ParentBudget(); budget.failureMode = true;
  const result = { policy, status: 'unavailable', reason: 'authored', reader: null, bundle: null,
    metrics: { FPS: null, rate: null, latency: null, duration: null }, authority: { nativeSupported: false }, usage: null };
  const prepared = api.prepareOutput(result, budget, true), decoded = JSON.parse(prepared.bytes);
  assert.equal(api.measurements(), 1);
  assert.equal(decoded.usage.cumulative.wrapperWork, budget.usage.cumulative.wrapperWork);
  assert.deepEqual(decoded.usage.current, budget.usage.current);
  assert.equal(decoded.usage.finalOutput.escapedBytes, prepared.bytes.length);
});

test('actual backpressured final Writable times out at the original deadline and withdraws its owned seal', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-stdout-synthetic-')));
  let now = 0n, expire, acknowledge;
  const stdout = new Writable({ highWaterMark: 1, write(_bytes, _encoding, callback) { acknowledge = callback; } });
  const exits = [], fakeProcess = { hrtime: { bigint: () => now }, stdout, exit(code) { exits.push(code); } };
  try {
    const api = controls({ process: fakeProcess, setTimeout(fn) { expire = fn; return 1; }, clearTimeout() {} });
    const budget = new api.ParentBudget(), destination = path.join(directory, 'sealed.json');
    const bundle = api.publish(destination, Buffer.from('{}'), budget, []);
    const sent = api.sendFinalOutput(Buffer.alloc(64), bundle, budget);
    assert.equal(stdout.writableNeedDrain, true);
    now = 60000000000n; expire();
    await assert.rejects(sent); assert.equal(stdout.destroyed, true); assert.equal(fs.existsSync(destination), false); assert.deepEqual(exits, [1]);
    acknowledge?.(); // Late original completion cannot turn timeout into fulfillment.
    await assert.rejects(sent);
  } finally { stdout.destroy(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('import topology admits at most32edges and prepays the first-excess native match envelope', () => {
  const api = controls(), budget = new api.ParentBudget();
  assert.deepEqual(api.importEdges("import fs from 'node:fs';\n", budget), ['node:fs']);
  assert.deepEqual(api.importEdges("import{readFileSync}from'node:fs';\nimport'node:net';\nexport{readFileSync}from'node:fs';\nimport type{T}from'./types.js';\n", new api.ParentBudget()),
    ['node:fs', 'node:net', 'node:fs']);
  const exhausted = new api.ParentBudget();
  assert.throws(() => api.importEdges("import fs from 'node:fs';\n".repeat(10000), exhausted));
  assert.equal(exhausted.usage.cumulative.allocatedLogicalSlots, 33 * 16 + 32 * 2);
});

test('native stdio dummyDestroy cannot leave the original deadline parent process alive', async () => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v12-native-stdout-synthetic-')));
  let child, forced = false;
  try {
    const source = fs.readFileSync(entry, 'utf8').replace(/^const ORIGIN = .*;$/m, 'const ORIGIN = process.hrtime.bigint()-59950000000n;')
      .replace(/main\(\)\.catch\(.*\);\s*$/, "const budget=new ParentBudget();sendFinalOutput(Buffer.alloc(1048576),null,budget).catch(()=>{process.exitCode=1;});");
    const harness = path.join(directory, 'owned-native-stdout.mjs'); fs.writeFileSync(harness, source);
    child = spawn(process.execPath, [harness], { stdio: ['ignore', 'pipe', 'pipe'] });
    // Deliberately do not consume original stdout: native pipe backpressure is real.
    let errors = ''; child.stderr.on('data', bytes => errors += bytes.toString());
    const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)); });
    const timer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, 2000);
    const code = await closed; clearTimeout(timer);
    assert.equal(forced, false, errors); assert.equal(code, 1, errors);
  } finally { if (child?.exitCode === null) child.kill('SIGKILL'); fs.rmSync(directory, { recursive: true, force: true }); }
});
