import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {types} from 'node:util';
import {SEMANTIC_LARGE_V3_POLICY as policy} from './semantic-large-v3-policy.mjs';
import {fourProfileStock036InterleavedRosterV1} from './four-profile-stock036-interleaved-v1.mjs';
import * as production from './matrix-artifacts-trace-v3.mjs';

const MiB = 1048576, margin = 1073741824n, transport = 1917186;
// Independent literal transcription of the frozen pilot reference (SHA256
// 1ca9eb6820340ce092f2d251db84d5d19e8f160718fad3e318b5a6abe8248757).
const pilot = Object.freeze([
  'threadplane-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
]);
const full = fourProfileStock036InterleavedRosterV1().map(x => x.id.replace(/-four-profile-stock036-interleaved-v1-round-([123])$/, '-four-profile-stock036-large-v3-round-$1'));
// Source-local VM substitution only: the production entry exports no test ports.
const source = await fs.readFile(new URL('./matrix-artifacts-trace-v3.mjs', import.meta.url), 'utf8');
async function fixture(t, {count = 16, free, clock = 100, hooks = {}} = {}) {
  const parent = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-v3-store-unit-')));
  t.after(() => fs.rm(parent, {recursive: true, force: true}));
  const directory = path.join(parent, 'invocation');
  const state = {now: clock, calls: [], free: free ?? BigInt((count * 96 + 3) * MiB) + margin, hooks};
  const io = Object.fromEntries(Object.entries(fs).map(([key, value]) => [key, typeof value === 'function' ? async (...args) => {
    state.calls.push({method: key, args});
    if (state.hooks[key]) return state.hooks[key](...args);
    if (key === 'statfs') return {bsize: 1n, bavail: state.free, bfree: 0n};
    return value(...args);
  } : value]));
  const body = source.replace(/^import .*;\n/gm, '').replace(/export /g, '');
  const api = vm.runInNewContext(`(function(){${body}\nreturn {createSemanticLarge16StoreV3, createSemanticLarge48StoreV3};})()`, {fs: io, constants, path, createHash, types, Buffer, TextDecoder, performance: {now: () => state.now}, SEMANTIC_LARGE_V3_POLICY: policy});
  const create = input => api[count === 16 ? 'createSemanticLarge16StoreV3' : 'createSemanticLarge48StoreV3'](input);
  return {parent, directory, state, create, async store() {return create({directory, invocationStarted: 0});}};
}
const plain = value => JSON.parse(JSON.stringify(value));
async function begin(store, id = pilot[0]) {await store.requireSpaceBeforeNextCaseV3(id); return store.beginCase(id);}

test('fixed reservation is upfront, hierarchical and includes three independent root reserves', async t => {
  for (const count of [16, 48]) {
    const f = await fixture(t, {count}), store = await f.store();
    assert.equal(store.stats().invocationReservation, (count * 96 + 3) * MiB);
    assert.equal(store.stats().chargedBytes, 0);
    assert.equal(store.stats().spaceChecks[0].requiredBytes, String(BigInt((count * 96 + 3) * MiB) + margin));
  }
});

test('initial statfs uses canonical existing parent and BigInts before mkdir; equality admits', async t => {
  const f = await fixture(t), store = await f.store();
  const probe = f.state.calls.findIndex(x => x.method === 'statfs');
  assert.ok(probe >= 0 && probe < f.state.calls.findIndex(x => x.method === 'mkdir'));
  assert.equal(f.state.calls[probe].args[0], f.parent);
  assert.equal(f.state.calls[probe].args[1].bigint, true);
  assert.equal(store.stats().spaceChecks[0].status, 'fulfilled');
});

for (const mode of ['short', 'bad-block', 'negative', 'number', 'rejected', 'late', 'parent-drift']) test(`initial admission ${mode} refuses without output-directory creation`, async t => {
  const f = await fixture(t);
  if (mode === 'short') f.state.free--;
  if (mode === 'bad-block') f.state.hooks.statfs = async () => ({bsize: 0n, bavail: 1n});
  if (mode === 'negative') f.state.hooks.statfs = async () => ({bsize: 1n, bavail: -1n});
  if (mode === 'number') f.state.hooks.statfs = async () => ({bsize: 1, bavail: Number.MAX_SAFE_INTEGER});
  if (mode === 'rejected') f.state.hooks.statfs = async () => {throw Error('ENOSPC');};
  if (mode === 'late') f.state.hooks.statfs = async () => {f.state.now = 100 + 10000; return {bsize: 1n, bavail: f.state.free};};
  if (mode === 'parent-drift') {
    const real = fs.lstat; let seen = 0;
    f.state.hooks.lstat = async (file, ...args) => {
      const stat = await real(file, ...args);
      if (file === f.parent && ++seen > 1) return new Proxy(stat, {get(target, key) {return key === 'ino' ? target.ino + 1n : Reflect.get(target, key);}});
      return stat;
    };
  }
  await assert.rejects(f.store());
  assert.equal(f.state.calls.some(x => x.method === 'mkdir'), false);
  await assert.rejects(fs.stat(f.directory), /ENOENT/);
});

test('closed constructor input refuses unknown options, future/nonfinite clocks and noncanonical paths before IO', async t => {
  const f = await fixture(t);
  for (const input of [{directory: f.directory, invocationStarted: 0, count: 1}, {directory: f.directory, invocationStarted: Infinity}, {directory: f.directory, invocationStarted: 101}, {directory: f.directory + '/..', invocationStarted: 0}]) await assert.rejects(f.create(input));
  assert.equal(f.state.calls.length, 0);
});

test('ordered case grants are required, consumed once and follow literal pilot/full schedules', async t => {
  for (const [count, ids] of [[16, pilot], [48, full]]) {
    const f = await fixture(t, {count}), store = await f.store();
    await assert.rejects(store.beginCase(ids[0]), /grant/);
    for (const id of ids) {await store.requireSpaceBeforeNextCaseV3(id); await store.beginCase(id);}
    await assert.rejects(store.requireSpaceBeforeNextCaseV3(ids[0]), /roster|next|stopped|unavailable/);
    assert.equal(store.stats().caseReservation, count * 96 * MiB);
  }
});

test('wrong next ID and duplicate recheck refuse without probe or grant replacement', async t => {
  const f = await fixture(t), store = await f.store();
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[1]), /next|roster/);
  await store.requireSpaceBeforeNextCaseV3(pilot[0]);
  const probes = f.state.calls.filter(x => x.method === 'statfs').length;
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[0]), /attempt|grant/);
  assert.equal(f.state.calls.filter(x => x.method === 'statfs').length, probes);
});

for (const elapsed of [10001, 1200000]) test(`grant age ${elapsed} refuses before case mkdir`, async t => {
  const f = await fixture(t), store = await f.store();
  await store.requireSpaceBeforeNextCaseV3(pilot[0]);
  f.state.now += elapsed;
  const before = f.state.calls.length;
  await assert.rejects(store.beginCase(pilot[0]), /deadline|grant/);
  assert.equal(f.state.calls.slice(before).some(x => x.method === 'mkdir'), false);
});

test('trace kind is bound bidirectionally to exact basename; ordinary evidence cap stays 2MiB', async t => {
  for (const [name, kind, bytes] of [['other.json', 'trace-v3', 2], ['aimock-trace-v3-private.json', 'evidence', 2], ['wide.json', 'evidence', 2 * MiB + 1]]) {
    const f = await fixture(t), store = await f.store(), record = await begin(store);
    await assert.rejects(record.writeJSON(name, 'x'.repeat(bytes - 2), {kind}), /kind|cap|trace/);
    assert.equal(f.state.calls.some(x => x.method === 'open'), false);
    assert.equal(store.stats().stopped, true);
  }
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const ref = await record.writeJSON('aimock-trace-v3-private.json', 'é'.repeat((6 * MiB - 2) / 2), {kind: 'trace-v3'});
  assert.equal(ref.bytes, 6 * MiB);
  assert.equal((await store.readJSON(ref, {kind: 'trace-v3'})).length, (6 * MiB - 2) / 2);
  await assert.rejects(store.readJSON(ref), /kind|trace/);
});

test('raw over-cap refuses before open and retains failed name/stop, with case failure still independent', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  await assert.rejects(record.writeJSON('aimock-trace-v3-private.json', 'x'.repeat(6 * MiB - 1), {kind: 'trace-v3'}), /cap/);
  assert.equal(f.state.calls.some(x => x.method === 'open'), false);
  await assert.rejects(record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'}), /attempt|failed/);
  const failure = await record.writeJSON('failure.json', 'x'.repeat(65534), {kind: 'failure'});
  assert.equal(failure.bytes, 65536);
  await assert.rejects(record.writeJSON('failure2.json', {}, {kind: 'failure'}), /reserve|attempt/);
});

test('transport reservation is synchronous fixed zero-argument one-shot and included once in E', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  assert.throws(() => record.reserveDecoderTrafficV3(1), /argument/);
  record.reserveDecoderTrafficV3();
  assert.equal(record.stats().ordinaryBytes, transport);
  assert.equal(store.stats().chargedBytes, transport);
  assert.equal(store.stats().invocationReservation, 1539 * MiB);
  assert.throws(() => record.reserveDecoderTrafficV3(), /attempt|reserved/);
});

test('decoder context requires completed raw and transport, is exact detached immutable BigInt-derived facts', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const raw = await record.writeJSON('aimock-trace-v3-private.json', {text: 'raw'}, {kind: 'trace-v3'});
  record.reserveDecoderTrafficV3();
  f.state.free = BigInt(1539 * MiB - raw.bytes - transport) + margin;
  const context = await record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0});
  assert.deepEqual(Object.keys(context).sort(), ['artifactRoot', 'caseParentIdentity', 'rawReference', 'rootIdentity']);
  assert.equal(context.artifactRoot, f.directory);
  assert.deepEqual(plain(context.rawReference), plain(raw));
  for (const [key, file] of [['rootIdentity', f.directory], ['caseParentIdentity', path.join(f.directory, pilot[0])]]) {
    const stat = await fs.lstat(file, {bigint: true});
    assert.deepEqual(plain(context[key]), {dev: String(stat.dev), ino: String(stat.ino)});
    assert.ok(Object.isFrozen(context[key]));
  }
  assert.ok(Object.isFrozen(context) && Object.isFrozen(context.rawReference));
  assert.notEqual(context.rawReference, raw);
  const row = store.stats().spaceChecks.at(-1);
  assert.equal(row.chargedBytes, String(raw.bytes + transport));
  assert.equal(row.requiredBytes, String(f.state.free));
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0}), /attempt/);
});

for (const missing of ['raw', 'transport', 'invocation-clock', 'case-clock', 'unknown-field']) test(`decoder refuses ${missing} without new probe`, async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  if (missing !== 'raw') await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  if (missing !== 'transport') record.reserveDecoderTrafficV3();
  const input = {caseStarted: missing === 'case-clock' ? 101 : 100, invocationStarted: missing === 'invocation-clock' ? 1 : 0};
  if (missing === 'unknown-field') input.rawReference = {};
  const before = f.state.calls.length;
  await assert.rejects(record.requireSpaceBeforeDecoderV3(input));
  assert.equal(f.state.calls.length, before);
});

test('pending raw close never exposes context or allows invocation-failure while writer remains owned', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  let closeEntered, release;
  const entered = new Promise(resolve => {closeEntered = resolve;});
  const wait = new Promise(resolve => {release = resolve;});
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), close = handle.close.bind(handle);
    handle.close = async () => {closeEntered(); await wait; return close();};
    return handle;
  };
  const publication = record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  await entered;
  record.reserveDecoderTrafficV3();
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0}), /raw|pending|writer/);
  await assert.rejects(store.writeInvocationFailureV3({failed: true}), /pending|writer|unsafe/);
  assert.equal(store.stats().pendingWriters, 1);
  release(); await publication;
  assert.equal(store.stats().pendingWriters, 0);
});

test('pending statfs is retained without retry, late original settlement cannot grant a case', async t => {
  const f = await fixture(t), store = await f.store();
  let resolve, entered;
  const ready = new Promise(r => {entered = r;});
  f.state.hooks.statfs = () => {entered(); return new Promise(r => {resolve = r;});};
  const attempt = store.requireSpaceBeforeNextCaseV3(pilot[0]);
  await ready;
  const row = store.stats().spaceChecks.at(-1);
  assert.equal(row.status, 'pending'); assert.equal(row.settledMs, null);
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[0]), /attempt|pending/);
  f.state.now = 10100;
  resolve({bsize: 1n, bavail: f.state.free});
  await assert.rejects(attempt, /deadline/);
  assert.equal(store.stats().spaceChecks.at(-1).deadlineFailed, true);
  await assert.rejects(store.beginCase(pilot[0]));
});

test('root/case replacement and leaf hardlinks/symlinks never yield accepted references', async t => {
  for (const mode of ['case', 'root', 'hardlink', 'symlink']) {
    const f = await fixture(t), store = await f.store(), record = await begin(store);
    const ref = await record.writeJSON('evidence.json', {ok: true});
    if (mode === 'case' || mode === 'root') {
      const victim = mode === 'case' ? path.join(f.directory, pilot[0]) : f.directory;
      await fs.rename(victim, path.join(f.parent, 'retained'));
      await fs.mkdir(victim);
    } else if (mode === 'hardlink') await fs.link(path.join(f.directory, ref.path), path.join(f.directory, pilot[0], 'alias'));
    else {await fs.rename(path.join(f.directory, ref.path), path.join(f.parent, 'retained')); await fs.symlink(path.join(f.parent, 'retained'), path.join(f.directory, ref.path));}
    await assert.rejects(store.readJSON(ref), /identity|path|ELOOP|ENOENT|file/);
  }
});

test('forged references reject traversal/current-case mismatch, cap, size and hash', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const ref = await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  for (const change of [{path: '../escape'}, {path: 'other/aimock-trace-v3-private.json'}, {path: pilot[0] + '/other.json'}, {bytes: 6 * MiB + 1}, {bytes: 1}, {sha256: '0'.repeat(64)}]) await assert.rejects(store.readJSON({...ref, ...change}, {kind: 'trace-v3'}));
});

test('three root reserves are independent exact-byte, immutable attempts, exclusive and accounted', async t => {
  const f = await fixture(t), store = await f.store();
  await store.writeManifest('initial.json', 'a'.repeat(MiB - 2));
  await store.writeManifest('final.json', 'b'.repeat(MiB - 2));
  const ref = await store.writeInvocationFailureV3('c'.repeat(MiB - 2));
  assert.equal(ref.path, 'invocation-failure-v3.json');
  assert.equal(ref.bytes, MiB);
  assert.equal(store.stats().chargedBytes, 3 * MiB);
  assert.equal(store.stats().invocationFailureBytes, MiB);
  assert.equal(await store.readJSON(ref, {kind: 'manifest'}), 'c'.repeat(MiB - 2));
  await assert.rejects(store.writeInvocationFailureV3({}), /attempt/);
});

test('invocation failure over-cap and clock hard end never dispatch an extra file', async t => {
  for (const mode of ['cap', 'deadline']) {
    const f = await fixture(t), store = await f.store();
    if (mode === 'deadline') f.state.now = 1230000;
    const before = f.state.calls.length;
    await assert.rejects(store.writeInvocationFailureV3(mode === 'cap' ? 'x'.repeat(MiB - 1) : {}), /cap|deadline/);
    assert.equal(f.state.calls.slice(before).some(x => x.method === 'open'), false);
  }
});

test('space ledger snapshots are bounded detached deeply frozen and max 1+2*N', async t => {
  const f = await fixture(t), store = await f.store();
  const before = store.stats();
  for (const id of pilot) {
    const record = await begin(store, id);
    await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
    record.reserveDecoderTrafficV3();
    await record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0});
  }
  const stats = store.stats();
  assert.equal(before.spaceChecks.length, 1);
  assert.equal(stats.spaceChecks.length, 33);
  assert.ok(Object.isFrozen(stats.spaceChecks) && stats.spaceChecks.every(Object.isFrozen));
  assert.ok(Buffer.byteLength(JSON.stringify(stats)) < 2 * MiB);
});

test('late acquired open retains descriptor ownership and closes once within original cleanup end', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  let closes = 0, writes = 0;
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), close = handle.close.bind(handle), write = handle.writeFile.bind(handle);
    handle.close = async () => {closes++; return close();};
    handle.writeFile = async (...params) => {writes++; return write(...params);};
    f.state.now = 1200000;
    return handle;
  };
  await assert.rejects(record.writeJSON('late.json', {}), /deadline/);
  assert.equal(closes, 1); assert.equal(writes, 0);
  assert.equal(store.stats().pendingOriginals, 0);
  assert.equal(store.stats().pendingWriters, 0);
});

test('rejected original close rejects raw publication, retains charge and disallows new failure writer', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  let closes = 0;
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), close = handle.close.bind(handle);
    handle.close = async () => {closes++; await close(); throw Error('original-close-rejected');};
    return handle;
  };
  await assert.rejects(record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'}), /original-close-rejected/);
  assert.equal(closes, 1);
  assert.equal(store.stats().chargedBytes, 2);
  assert.equal(store.stats().unsafeWriter, true);
  await assert.rejects(store.writeInvocationFailureV3({}), /unsafe|writer/);
});

test('path drift during descriptor close rejects successful bytes and never adopts a replacement root', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), close = handle.close.bind(handle);
    handle.close = async () => {
      await close(); await fs.rename(f.directory, path.join(f.parent, 'retained-root')); await fs.mkdir(f.directory);
    };
    return handle;
  };
  await assert.rejects(record.writeJSON('evidence.json', {}), /identity|drift/);
  assert.equal(await fs.readFile(path.join(f.parent, 'retained-root', pilot[0], 'evidence.json'), 'utf8'), '{}');
});

test('parent swap immediately before open refuses before content is written outside the pinned case', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const outside = path.join(f.parent, 'outside'); await fs.mkdir(outside);
  f.state.hooks.open = async (...args) => {
    await fs.rename(path.join(f.directory, pilot[0]), path.join(f.parent, 'retained-case'));
    await fs.symlink(outside, path.join(f.directory, pilot[0]));
    return fs.open(...args);
  };
  await assert.rejects(record.writeJSON('evidence.json', {secret: 'never-written'}), /path|identity|symlink/);
  assert.equal((await fs.stat(path.join(outside, 'evidence.json'))).size, 0);
});

test('whole invocation+cleanup equality dispatches no new IO, including reads and close', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const ref = await record.writeJSON('evidence.json', {});
  f.state.now = 1230000;
  const before = f.state.calls.length;
  await assert.rejects(record.writeJSON('late.json', {}), /deadline/);
  await assert.rejects(store.readJSON(ref), /deadline/);
  await assert.rejects(store.writeManifest('final.json', {}), /deadline/);
  await assert.rejects(store.writeInvocationFailureV3({}), /deadline/);
  assert.equal(f.state.calls.length, before);
});

test('both exact frozen roster arrays are private and literal with no roster/configuration exports', () => {
  assert.match(source, /const PILOT_IDS = Object\.freeze\(\[/);
  assert.match(source, /const FULL_IDS = Object\.freeze\(\[/);
  assert.deepEqual([...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(x => x[1]).sort(), ['createSemanticLarge16StoreV3', 'createSemanticLarge48StoreV3']);
  assert.equal(new Set(full).size, 48);
});

test('case envelope includes transport and one failure reserve without refund after budget refusal', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  record.reserveDecoderTrafficV3();
  const write = async (name, bytes, kind) => record.writeJSON(name, 'x'.repeat(bytes - 2), {kind});
  await write('private1.json', 32 * MiB, 'private-case');
  await write('private2.json', 32 * MiB, 'private-case');
  await write('transcript1.json', 16 * MiB, 'transcript');
  await write('transcript2.json', 16 * MiB - 65536 - transport, 'transcript');
  await assert.rejects(record.writeJSON('over.json', 0), /case-budget/);
  await write('failure.json', 65536, 'failure');
  assert.equal(record.stats().reservedBytes, 96 * MiB);
  assert.equal(store.stats().chargedBytes, 96 * MiB);
  assert.equal(store.stats().invocationReservation, 1539 * MiB);
});

test('BigInt dev/inode identities above 2^53 are preserved and one-unit drift is never rounded away', async t => {
  const f = await fixture(t);
  const high = 9007199254740993n;
  let drift = false;
  const transform = stat => {
    const adjustment = drift ? 1n : 0n;
    return new Proxy(stat, {get(target, key) {
    if (key === 'dev') return high;
    if (key === 'ino') return target.ino + high + adjustment;
    return Reflect.get(target, key);
    }});
  };
  f.state.hooks.lstat = async (...args) => transform(await fs.lstat(...args));
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), stat = handle.stat.bind(handle);
    handle.stat = async (...params) => transform(await stat(...params));
    return handle;
  };
  const store = await f.store(), record = await begin(store);
  await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  record.reserveDecoderTrafficV3();
  const context = await record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0});
  assert.equal(context.rootIdentity.dev, String(high));
  assert.equal(context.rootIdentity.ino, String((await fs.lstat(f.directory, {bigint: true})).ino + high));
  drift = true;
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[1]), /identity|drift/);
});

test('bounded evidence reader refuses fatal UTF8 and growth/shrink between descriptor bookends', async t => {
  for (const mode of ['utf8', 'growth', 'shrink']) {
    const f = await fixture(t), store = await f.store(), record = await begin(store);
    let ref = await record.writeJSON('evidence.json', {ok: true});
    if (mode === 'utf8') {
      const bytes = Buffer.from([0xc3, 0x28]);
      await fs.writeFile(path.join(f.directory, ref.path), bytes);
      ref = {...ref, bytes: 2, sha256: createHash('sha256').update(bytes).digest('hex')};
    } else {
      let changed = false;
      f.state.hooks.open = async (...args) => {
        const handle = await fs.open(...args), read = handle.read.bind(handle);
        handle.read = async (...params) => {
          const result = await read(...params);
          if (!changed) {
            changed = true;
            if (mode === 'growth') await fs.appendFile(path.join(f.directory, ref.path), 'x');
            else await fs.truncate(path.join(f.directory, ref.path), 1);
          }
          return result;
        };
        return handle;
      };
    }
    await assert.rejects(store.readJSON(ref), /encoded|encoding|size|drift/i);
    assert.equal(store.stats().pendingOriginals, 0);
  }
});

test('late statfs preserves observed exact free bytes while refusing its stale grant', async t => {
  const f = await fixture(t), store = await f.store();
  f.state.hooks.statfs = async () => {f.state.now = 10100; return {bsize: 3n, bavail: 9007199254740993n};};
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[0]), /deadline/);
  const row = store.stats().spaceChecks.at(-1);
  assert.equal(row.observedFreeBytes, String(3n * 9007199254740993n));
  assert.equal(row.status, 'rejected'); assert.equal(row.deadlineFailed, true);
});

test('exact raw basename cannot consume an ordinary root manifest allowance', async t => {
  const f = await fixture(t), store = await f.store();
  await assert.rejects(store.writeManifest('aimock-trace-v3-private.json', {}), /trace|kind/);
  assert.equal(f.state.calls.some(x => x.method === 'open'), false);
});

test('original native failure and fixed final manifests retain invocation cleanup publication window', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  f.state.now = 1200001;
  const failure = await record.writeJSON('failure.json', {original: true}, {kind: 'failure'});
  const final = await store.writeManifest('manifest-final.json', {original: true});
  assert.equal(failure.bytes, 17); assert.equal(final.bytes, 17);
  await assert.rejects(store.writeManifest('alternate-final.json', {}), /deadline/);
  f.state.now = 1230000;
  const before = f.state.calls.length;
  await assert.rejects(store.writeManifest('final.json', {}), /deadline/);
  await assert.rejects(store.writeInvocationFailureV3({}), /deadline/);
  assert.equal(f.state.calls.length, before);
});

test('decoder original case clock tightens all subsequent ordinary reads/writes and case failure cleanup', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const raw = await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  record.reserveDecoderTrafficV3();
  await record.requireSpaceBeforeDecoderV3({caseStarted: 90, invocationStarted: 0});
  f.state.now = 240090;
  const before = f.state.calls.length;
  await assert.rejects(store.readJSON(raw, {kind: 'trace-v3'}), /deadline/);
  await assert.rejects(record.writeJSON('validation.json', {}), /deadline/);
  assert.equal(f.state.calls.length, before);
  await record.writeJSON('failure.json', {}, {kind: 'failure'});
  f.state.now = 270090;
  const atEnd = f.state.calls.length;
  await assert.rejects(store.readJSON(raw, {kind: 'trace-v3'}), /deadline/);
  assert.equal(f.state.calls.length, atEnd);
});

test('decoder space shortfall after raw publication includes actual E and never grants or retries', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const raw = await record.writeJSON('aimock-trace-v3-private.json', {raw: true}, {kind: 'trace-v3'});
  record.reserveDecoderTrafficV3();
  f.state.free = BigInt(1539 * MiB - raw.bytes - transport) + margin - 1n;
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0}), /space/);
  assert.equal(store.stats().chargedBytes, raw.bytes + transport);
  assert.equal(store.stats().spaceChecks.at(-1).requiredBytes, String(f.state.free + 1n));
  const before = f.state.calls.length;
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0}));
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[1]));
  assert.equal(f.state.calls.length, before);
});

test('full48 maximum ledger is 97 rows, with detached facts fitting ordinary evidence cap', async t => {
  const f = await fixture(t, {count: 48}), store = await f.store();
  for (const id of full) {
    const record = await begin(store, id);
    await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
    record.reserveDecoderTrafficV3();
    await record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0});
  }
  const facts = store.stats();
  assert.equal(facts.spaceChecks.length, 97);
  assert.ok(Buffer.byteLength(JSON.stringify(facts)) <= 2 * MiB);
  assert.equal(facts.pendingOriginals, 0); assert.equal(facts.pendingWriters, 0);
});

test('production exports only the two closed constructors and old store source remains byte-exact', async () => {
  assert.deepEqual(Object.keys(production).sort(), ['createSemanticLarge16StoreV3', 'createSemanticLarge48StoreV3']);
  const old = await fs.readFile(new URL('./matrix-artifacts-v3.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(old).digest('hex'), '172fbdd42640c0053f07a50a939b99fa33d6e34b0b7a660cf1644b2d5d621a4e');
});

test('a grant exactly 10s old is accepted while original invocation-end equality refuses', async t => {
  const f = await fixture(t), store = await f.store();
  await store.requireSpaceBeforeNextCaseV3(pilot[0]);
  f.state.now = 10100;
  await store.beginCase(pilot[0]);
  await store.requireSpaceBeforeNextCaseV3(pilot[1]);
  f.state.now = 1200000;
  const before = f.state.calls.length;
  await assert.rejects(store.beginCase(pilot[1]), /deadline|grant/);
  assert.equal(f.state.calls.length, before);
});

test('decoder recheck original case-end equality rejects before statfs and never renews case time', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  await record.writeJSON('aimock-trace-v3-private.json', {}, {kind: 'trace-v3'});
  record.reserveDecoderTrafficV3();
  f.state.now = 240090;
  const before = f.state.calls.length;
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 90, invocationStarted: 0}), /deadline/);
  assert.equal(f.state.calls.length, before);
  await assert.rejects(record.requireSpaceBeforeDecoderV3({caseStarted: 100, invocationStarted: 0}), /attempt/);
});

test('pending final-manifest original retains its charge and prevents independent invocation-failure dispatch', async t => {
  const f = await fixture(t), store = await f.store();
  let release, entered;
  const ready = new Promise(resolve => {entered = resolve;});
  const wait = new Promise(resolve => {release = resolve;});
  f.state.hooks.open = async (...args) => {
    const handle = await fs.open(...args), close = handle.close.bind(handle);
    handle.close = async () => {entered(); await wait; return close();};
    return handle;
  };
  const final = store.writeManifest('final.json', {});
  await ready;
  const before = f.state.calls.filter(x => x.method === 'open').length;
  await assert.rejects(store.writeInvocationFailureV3({}), /pending|writer/);
  assert.equal(f.state.calls.filter(x => x.method === 'open').length, before);
  assert.equal(store.stats().chargedBytes, 2);
  release(); await final;
  assert.equal(store.stats().pendingOriginals, 0); assert.equal(store.stats().pendingWriters, 0);
});

test('failed exclusive write retains original file, exact charge/name and stopped state', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  const file = path.join(f.directory, pilot[0], 'existing.json');
  await fs.writeFile(file, 'original');
  await assert.rejects(record.writeJSON('existing.json', {new: true}), /EEXIST/);
  assert.equal(await fs.readFile(file, 'utf8'), 'original');
  assert.equal(store.stats().chargedBytes, Buffer.byteLength(JSON.stringify({new: true})));
  assert.equal(store.stats().stopped, true);
  await assert.rejects(record.writeJSON('existing.json', {}), /failed|attempt/);
  await assert.rejects(store.requireSpaceBeforeNextCaseV3(pilot[1]), /unavailable/);
});

test('no new descriptor close dispatch after cleanup hard end; acquired late handle stays unsafe', async t => {
  const f = await fixture(t), store = await f.store(), record = await begin(store);
  let acquired, realClose, closes = 0;
  f.state.hooks.open = async (...args) => {
    acquired = await fs.open(...args); realClose = acquired.close.bind(acquired);
    acquired.close = async () => {closes++; return realClose();};
    f.state.now = 1230000;
    return acquired;
  };
  try {
    await assert.rejects(record.writeJSON('late-open.json', {}), /deadline/);
    assert.equal(closes, 0);
    assert.equal(store.stats().unsafeWriter, true);
    const before = f.state.calls.length;
    await assert.rejects(store.writeInvocationFailureV3({}), /unsafe|writer/);
    assert.equal(f.state.calls.length, before);
  } finally {
    // Harness cleanup of its intentionally withheld descriptor; production
    // correctly dispatched no new close after the simulated absolute end.
    if (acquired) await realClose();
  }
});
