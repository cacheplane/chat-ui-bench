import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createMatrixArtifactStore } from './matrix-artifacts-v3.mjs';
import * as artifacts from './matrix-artifacts-v3.mjs';

async function fixture(t) {
  const parent = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'matrix-artifacts-v3-')));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const directory = path.join(parent, 'invocation');
  return { parent, directory, store: await createMatrixArtifactStore({ directory }) };
}
test('exclusive local JSON sidecars return exact UTF8 byte/hash references and bounded reads', async t => {
  const { directory, store } = await fixture(t);
  const record = await store.beginCase('case-1');
  const value = { text: 'é🙂', messages: [1, 2] };
  const ref = await record.writeJSON('before.json', value, { kind: 'transcript' });
  const bytes = Buffer.from(JSON.stringify(value));
  assert.deepEqual(ref, { path: 'case-1/before.json', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  assert.deepEqual(await store.readJSON(ref, { kind: 'transcript' }), value);
  assert.equal((await fs.stat(path.join(directory, ref.path))).mode & 0o777, 0o600);
  await assert.rejects(createMatrixArtifactStore({ directory }), /exist/i);
  await assert.rejects(record.writeJSON('before.json', {}, { kind: 'transcript' }), /exist|attempt/i);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, ref.path), 'utf8')), value);
});
test('standalone reader verifies existing invocation without creating or modifying it', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('existing');
  const reference = await record.writeJSON('before.json', { text: 'actual' }, { kind: 'transcript' });
  const read = ref => artifacts.readMatrixArtifactJSON({ directory, reference: ref, kind: 'transcript' });
  assert.deepEqual(await read(reference), { text: 'actual' });
  await assert.rejects(read({ ...reference, path: '../../escape' }), /path/i);
  await assert.rejects(read({ ...reference, sha256: '0'.repeat(64) }), /hash/i);
  await assert.rejects(read({ ...reference, bytes: 16 * 1024 * 1024 + 1 }), /cap/i);
  const link = path.join(parent, 'linked-invocation');
  await fs.symlink(directory, link);
  await assert.rejects(artifacts.readMatrixArtifactJSON({ directory: link, reference, kind: 'transcript' }), /symlink|path/i);
  assert.equal((await fs.readdir(directory)).length, 1);
});
test('reject traversal, malformed references, hash drift and symlink files/parents', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('one');
  await assert.rejects(store.beginCase('../escape'), /path|name/i);
  await assert.rejects(record.writeJSON('../escape.json', {}, { kind: 'result' }), /path|name/i);
  const ref = await record.writeJSON('result.json', { ok: true }, { kind: 'result' });
  await assert.rejects(store.readJSON({ ...ref, path: '../escape' }, { kind: 'result' }), /path/i);
  await assert.rejects(store.readJSON({ ...ref, sha256: '0'.repeat(64) }, { kind: 'result' }), /hash/i);
  await fs.writeFile(path.join(directory, ref.path), JSON.stringify({ ok: null }));
  await assert.rejects(store.readJSON(ref, { kind: 'result' }), /size|hash/i);
  await fs.symlink(path.join(directory, ref.path), path.join(directory, 'one', 'link.json'));
  await assert.rejects(store.readJSON({ ...ref, path: 'one/link.json' }, { kind: 'result' }), /symlink|ELOOP/i);
  await fs.symlink(parent, path.join(directory, 'alias'));
  await assert.rejects(store.readJSON({ ...ref, path: 'alias/whatever.json' }, { kind: 'result' }), /path|symlink/i);
});
test('exact UTF8 caps reject before publication and preserve failure reserve', async t => {
  const { directory, store } = await fixture(t);
  const record = await store.beginCase('caps');
  await assert.rejects(record.writeJSON('wide.json', 'é'.repeat(1048576), { kind: 'evidence' }), /cap/i);
  await assert.rejects(fs.stat(path.join(directory, 'caps/wide.json')), /ENOENT/);
  await assert.rejects(store.beginCase('after-cap'), /invocation.*unavailable/i);
  await store.writeManifest('final.json', { stopped: 'file-cap' });
  const failure = await record.writeJSON('failure.json', { error: 'byte-cap' }, { kind: 'failure' });
  assert.deepEqual(await store.readJSON(failure, { kind: 'failure' }), { error: 'byte-cap' });
  await assert.rejects(record.writeJSON('failure2.json', {}, { kind: 'failure' }), /failure|reserve/i);
});
test('case budget reserves 64KiB and consumes attempted reservations without cap raises', async t => {
  const { store } = await fixture(t);
  const record = await store.beginCase('large');
  const chunk = 'x'.repeat(16 * 1024 * 1024 - 2);
  for (let i = 0; i < 4; i++) await record.writeJSON(`transcript-${i}.json`, chunk, { kind: 'transcript' });
  await record.writeJSON('partial.json', 'x'.repeat(16 * 1024 * 1024 - 65536 - 2), { kind: 'transcript' });
  await assert.rejects(record.writeJSON('over.json', 0, { kind: 'result' }), /case.*budget/i);
  await assert.rejects(store.beginCase('after-case-budget'), /invocation.*unavailable/i);
  const failure = await record.writeJSON('failure.json', 'x'.repeat(65534), { kind: 'failure' });
  assert.equal(failure.bytes, 65536);
  assert.equal(record.stats().reservedBytes, 80 * 1024 * 1024);
});
test('invocation reserves full cases and separate initial/final manifest publication', async t => {
  const { store } = await fixture(t);
  for (let i = 0; i < 51; i++) await store.beginCase(`case-${i}`);
  await assert.rejects(store.beginCase('case-52'), /invocation.*budget/i);
  await store.writeManifest('initial.json', 'x'.repeat(1024 * 1024 - 2));
  const final = await store.writeManifest('final.json', 'y'.repeat(1024 * 1024 - 2));
  assert.equal(final.bytes, 1024 * 1024);
  assert.equal(store.stats().initialManifestBytes, 1024 * 1024);
  assert.equal(store.stats().finalManifestBytes, 1024 * 1024);
  assert.equal(store.stats().invocationReservation, (51 * 80 + 2) * 1024 * 1024);
  await assert.rejects(store.writeManifest('extra.json', 0), /manifest.*budget/i);
  await assert.rejects(store.beginCase('after-manifest-budget'), /invocation.*unavailable/i);
});

test('parent swapped just before open refuses publication before writing any content', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('race');
  const outside = path.join(parent, 'outside');
  await fs.mkdir(outside);
  const open = fs.open;
  t.after(() => { fs.open = open; });
  fs.open = async (file, ...args) => {
    if (file === path.join(directory, 'race/evidence.json')) {
      await fs.rename(path.join(directory, 'race'), path.join(parent, 'original-case'));
      await fs.symlink(outside, path.join(directory, 'race'));
    }
    return open(file, ...args);
  };
  await assert.rejects(record.writeJSON('evidence.json', { secret: 'must-not-escape' }), /path|identity|symlink/i);
  assert.equal((await fs.stat(path.join(outside, 'evidence.json'))).size, 0);
  assert.equal(store.stats().stopped, true);
});

test('invocation root swapped to a symlink during creation is never adopted as the owned root', async t => {
  const parent = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'matrix-artifacts-v3-bootstrap-')));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const directory = path.join(parent, 'invocation'), outside = path.join(parent, 'outside');
  await fs.mkdir(outside);
  const mkdir = fs.mkdir;
  t.after(() => { fs.mkdir = mkdir; });
  fs.mkdir = async (file, ...args) => {
    const result = await mkdir(file, ...args);
    if (file === directory) {
      await fs.rename(directory, path.join(parent, 'original-invocation'));
      await fs.symlink(outside, directory);
    }
    return result;
  };
  await assert.rejects(createMatrixArtifactStore({ directory }), /path|identity|symlink/i);
  assert.deepEqual(await fs.readdir(outside), []);
});

test('original case identity is pinned across replacement with a different real directory', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('replace');
  await fs.rename(path.join(directory, 'replace'), path.join(parent, 'original-case'));
  await fs.mkdir(path.join(directory, 'replace'));
  await assert.rejects(record.writeJSON('result.json', { wrong: 'directory' }, { kind: 'result' }), /path|identity/i);
  assert.deepEqual(await fs.readdir(path.join(directory, 'replace')), []);
});

test('standalone reader refuses preopen parent swap before reading even identical outside data', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('read-race');
  const reference = await record.writeJSON('before.json', { text: 'same' }, { kind: 'transcript' });
  const outside = path.join(parent, 'outside');
  await fs.mkdir(outside);
  await fs.copyFile(path.join(directory, reference.path), path.join(outside, 'before.json'));
  const open = fs.open;
  let contentReads = 0;
  t.after(() => { fs.open = open; });
  fs.open = async (file, ...args) => {
    if (file === path.join(directory, reference.path)) {
      await fs.rename(path.join(directory, 'read-race'), path.join(parent, 'original-case'));
      await fs.symlink(outside, path.join(directory, 'read-race'));
    }
    const handle = await open(file, ...args);
    const read = handle.read.bind(handle);
    handle.read = async (...params) => { contentReads++; return read(...params); };
    return handle;
  };
  await assert.rejects(artifacts.readMatrixArtifactJSON({ directory, reference, kind: 'transcript' }), /path|identity|symlink/i);
  assert.equal(contentReads, 0);
});

test('path drift after content write refuses the publication reference', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('post-write');
  const open = fs.open;
  t.after(() => { fs.open = open; });
  fs.open = async (...args) => {
    const handle = await open(...args);
    const sync = handle.sync.bind(handle);
    handle.sync = async () => {
      await sync();
      await fs.rename(path.join(directory, 'post-write'), path.join(parent, 'retained-case'));
      await fs.mkdir(path.join(directory, 'post-write'));
    };
    return handle;
  };
  await assert.rejects(record.writeJSON('result.json', { retained: true }, { kind: 'result' }), /path|identity|ENOENT/i);
  assert.equal(await fs.readFile(path.join(parent, 'retained-case/result.json'), 'utf8'), '{"retained":true}');
});

test('path drift after content read refuses acceptance despite valid bytes and hash', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('post-read');
  const reference = await record.writeJSON('before.json', { value: 'original' }, { kind: 'transcript' });
  const open = fs.open;
  t.after(() => { fs.open = open; });
  let swapped = false;
  fs.open = async (...args) => {
    const handle = await open(...args);
    const read = handle.read.bind(handle);
    handle.read = async (...params) => {
      const result = await read(...params);
      if (!swapped) {
        swapped = true;
        await fs.rename(path.join(directory, 'post-read'), path.join(parent, 'retained-case'));
        await fs.mkdir(path.join(directory, 'post-read'));
      }
      return result;
    };
    return handle;
  };
  await assert.rejects(artifacts.readMatrixArtifactJSON({ directory, reference, kind: 'transcript' }), /path|identity|ENOENT/i);
});

test('root drift during descriptor close refuses an otherwise completed publication', async t => {
  const { directory, parent, store } = await fixture(t);
  const record = await store.beginCase('post-close');
  const open = fs.open;
  t.after(() => { fs.open = open; });
  fs.open = async (...args) => {
    const handle = await open(...args);
    const close = handle.close.bind(handle);
    handle.close = async () => {
      await close();
      await fs.rename(directory, path.join(parent, 'original-invocation'));
      await fs.mkdir(directory);
    };
    return handle;
  };
  await assert.rejects(record.writeJSON('result.json', { complete: true }, { kind: 'result' }), /path|identity/i);
});
test('oversized file is refused before JSON parse; failed exclusive write retains existing data', async t => {
  const { directory, store } = await fixture(t);
  const record = await store.beginCase('invalid');
  const file = path.join(directory, 'invalid/huge.json');
  const handle = await fs.open(file, 'wx');
  await handle.truncate(16 * 1024 * 1024 + 1);
  await handle.close();
  await assert.rejects(store.readJSON({ path: 'invalid/huge.json', bytes: 16 * 1024 * 1024 + 1, sha256: '0'.repeat(64) }, { kind: 'transcript' }), /cap/i);
  // Forging a small reference cannot bypass the pre-read stat bound.
  await assert.rejects(store.readJSON({ path: 'invalid/huge.json', bytes: 1, sha256: '0'.repeat(64) }, { kind: 'transcript' }), /cap/i);
  await fs.writeFile(path.join(directory, 'invalid/existing.json'), 'original');
  await assert.rejects(record.writeJSON('existing.json', {}, { kind: 'evidence' }), /EEXIST/);
  assert.equal(await fs.readFile(path.join(directory, 'invalid/existing.json'), 'utf8'), 'original');
  await assert.rejects(record.writeJSON('later.json', {}, { kind: 'result' }), /failed|unavailable/i);
  await record.writeJSON('failure.json', { error: 'publication-unavailable' }, { kind: 'failure' });
});
