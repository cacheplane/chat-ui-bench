import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, symlink, link, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { runBrowserPresentationFeedbackObservationsV1 as run } from './feedback-observations-run.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const config = (root, override = {}) => ({ schema: 'browser-presentation-feedback-observations-v1', trace: { path: join(root, 'trace'), bytes: 2, sha256: sha('{}') }, processor: { path: join(root, 'processor'), sha256: '0'.repeat(64) }, target: { frameId: 'authored-frame', loaderId: 'authored-loader' }, phaseNames: { start: 'authored:start', end: 'authored:end' }, out: join(root, 'out'), deadlineMs: 1000, ...override });
const refusal = r => { assert.equal(r.status, 'unavailable'); assert.equal(r.publication, null); assert.equal(r.observation.count, null); assert.equal(r.observation.interval, null); assert.equal(r.observation.observedHz, null); assert.equal(r.observation.fps, null); assert.deepEqual(r.observation.events, []); };
test('primitive boundary never reads arbitrary object properties or proxy traps', async () => {
  let touched = 0; const p = new Proxy({}, { get() { touched++; throw Error('trap'); }, ownKeys() { touched++; throw Error('trap'); } });
  for (const input of [p, {}, null, undefined, new String('{}'), 1, Symbol('x')]) { const r = await run(input); refusal(r); assert.equal(r.stage, 'config'); }
  assert.equal(touched, 0);
});
test('closed canonical config rejects whitespace, reordering, unknown keys and invalid scalar types without I/O', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-config-')); const c = config(root);
  for (const input of [' ' + JSON.stringify(c), JSON.stringify({ ...c, extra: true }), JSON.stringify({ ...c, deadlineMs: '1000' }), JSON.stringify({ ...c, target: { ...c.target, loaderId: '' } }), JSON.stringify({ ...c, trace: { ...c.trace, path: '/tmp/../x' } }), JSON.stringify({ ...c, phaseNames: { start: 'same', end: 'same' } }), 'x'.repeat(16385), JSON.stringify(Object.fromEntries(Object.entries(c).reverse()))]) { const r = await run(input); refusal(r); assert.equal(r.stage, 'config'); }
  assert.deepEqual(await readdir(root), []);
});
test('genuine first target refusal rejects fake executable production pin and stops before scope', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-pin-')); await writeFile(join(root, 'trace'), '{}'); await writeFile(join(root, 'processor'), '#!/bin/sh\necho forged\n', { mode: 0o700 });
  const r = await run(JSON.stringify(config(root))); refusal(r); assert.equal(r.stage, 'target');
  const manifest = JSON.parse(await readFile(join(root, 'out', 'target', 'manifest.json'), 'utf8'));
  assert.equal(manifest.officialProcessor, false); assert.deepEqual(manifest.processes, {}); assert.match(manifest.error, /fixed platform pin/);
  assert.deepEqual((await readdir(join(root, 'out'))).sort(), ['target']);
  assert.deepEqual(r.observation.evidence.sourcesBefore, r.observation.evidence.sourcesAfter);
  assert.deepEqual(r.observation.evidence.runtime.before, r.observation.evidence.runtime.after);
});
test('existing output is preserved and never reused', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-existing-')); await mkdir(join(root, 'out')); await writeFile(join(root, 'out', 'result.json'), 'caller replacement');
  const r = await run(JSON.stringify(config(root))); refusal(r); assert.equal(await readFile(join(root, 'out', 'result.json'), 'utf8'), 'caller replacement');
});
test('CLI refuses symlink, hardlink, oversized and malformed config before output work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-cli-')); const file = join(root, 'config'); await writeFile(file, JSON.stringify(config(root))); const symbolic = join(root, 'symlink'); await symlink(file, symbolic); const hard = join(root, 'hardlink'); await link(file, hard);
  for (const path of [symbolic, hard]) { const child = spawnSync(process.execPath, [new URL('./feedback-observations-run.mjs', import.meta.url).pathname, '--config', path], { encoding: 'utf8' }); assert.equal(child.status, 1); assert.equal(child.stdout, ''); }
  const large = join(root, 'large'); await writeFile(large, 'x'.repeat(16385)); const child = spawnSync(process.execPath, [new URL('./feedback-observations-run.mjs', import.meta.url).pathname, '--config', large], { encoding: 'utf8' }); assert.equal(child.status, 1); assert.equal(child.stdout, '');
  assert.ok(!(await readdir(root)).includes('out'));
});

test('source closure rejects changed fixed SQL and symlinked source without running target', async () => {
  for (const mode of ['changed', 'symlink']) {
    const root = await mkdtemp(join(tmpdir(), 'feedback-source-')); const source = join(root, 'source'); await mkdir(source);
    for (const name of ['feedback-observations-run.mjs', 'feedback-observations-core.mjs', 'feedback-observations-source-model-v1.json', 'run.mjs', 'target-inventory.sql', 'scope-inventory.sql']) await copyFile(new URL(name, import.meta.url), join(source, name));
    if (mode === 'changed') await writeFile(join(source, 'target-inventory.sql'), 'changed SQL');
    else { const { unlink } = await import('node:fs/promises'); await unlink(join(source, 'target-inventory.sql')); await symlink(new URL('target-inventory.sql', import.meta.url).pathname, join(source, 'target-inventory.sql')); }
    const file = join(root, 'config'); await writeFile(file, JSON.stringify(config(root)));
    const child = spawnSync(process.execPath, [join(source, 'feedback-observations-run.mjs'), '--config', file], { encoding: 'utf8' });
    assert.equal(child.status, 1); const envelope = JSON.parse(child.stdout); assert.equal(envelope.stage, 'source'); assert.equal(envelope.publication, null); assert.deepEqual(await readdir(join(root, 'out')), []);
  }
});
test('input and output pathname aliases are closed before filesystem work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-alias-')); const c = config(root);
  for (const value of [{ ...c, out: c.trace.path }, { ...c, out: root }, { ...c, processor: { ...c.processor, path: c.trace.path } }]) { const r = await run(JSON.stringify(value)); refusal(r); assert.equal(r.stage, 'config'); }
  assert.deepEqual(await readdir(root), []);
});
test('library import does not execute CLI or read declared caller inputs', () => {
  const script = `process.argv[1] = '/does-not-exist'; await import(${JSON.stringify(new URL('./feedback-observations-run.mjs', import.meta.url).href)});`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }); assert.equal(child.status, 0); assert.equal(child.stdout, ''); assert.equal(child.stderr, '');
});

test('CLI withdraws its receipt when the config changes after work starts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-late-config-')); const file = join(root, 'config'); const raw = JSON.stringify(config(root)); await writeFile(file, raw);
  const child = spawn(process.execPath, [new URL('./feedback-observations-run.mjs', import.meta.url).pathname, '--config', file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = ''; child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  const closed = new Promise(resolveClose => child.once('close', resolveClose));
  const started = performance.now(); while (!(await readdir(root)).includes('out')) { assert.ok(performance.now() - started < 5000, 'work did not start'); await new Promise(r => setTimeout(r, 2)); }
  await writeFile(file, raw + ' '); const code = await closed;
  assert.equal(code, 1); assert.equal(stderr, ''); const receipt = JSON.parse(stdout); assert.equal(receipt.stage, 'config'); assert.equal(receipt.reason, 'config-custody'); assert.equal(receipt.publication, null); assert.equal(receipt.fps, null);
});

test('ill-formed Unicode and C1 control selector names refuse before filesystem work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-unicode-name-')); const c = config(root);
  for (const invalid of ['a\ud800', 'a\udfff', 'a\u0080', 'a\u0085', 'a\u009f']) {
    for (const key of ['frameId', 'loaderId', 'start', 'end']) {
      const candidate = ['frameId', 'loaderId'].includes(key) ? { ...c, target: { ...c.target, [key]: invalid } } : { ...c, phaseNames: { ...c.phaseNames, [key]: invalid } };
      const result = await run(JSON.stringify(candidate)); refusal(result); assert.equal(result.stage, 'config', `invalid ${key}`); assert.deepEqual(await readdir(root), []);
    }
  }
});
test('ill-formed Unicode and C1 control paths refuse before filesystem work', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-unicode-path-')); const c = config(root);
  for (const suffix of ['\ud800', '\udfff', '\u0085']) {
    for (const key of ['trace', 'processor', 'out']) {
      const invalid = join(root, 'invalid-' + suffix); const candidate = key === 'out' ? { ...c, out: invalid } : { ...c, [key]: { ...c[key], path: invalid } };
      const result = await run(JSON.stringify(candidate)); refusal(result); assert.equal(result.stage, 'config', `invalid ${key} path`); assert.deepEqual(await readdir(root), []);
    }
  }
});
test('phase selectors cannot alias any fixed target or scope SQL family before I/O', async () => {
  const root = await mkdtemp(join(tmpdir(), 'feedback-phase-family-')); const c = config(root);
  const families = ['BeginFrame', 'FrameCommittedInBrowser', 'FrameDeletedInBrowser', 'Graphics.Pipeline', 'PipelineReporter', 'ProcessReadyInBrowser', 'SetLayerTreeId', 'TracingStartedInBrowser', 'DrawFrame', 'MainFrame.Draw', 'Scheduler::BeginFrame', 'Scheduler::BeginImplFrame'];
  for (const family of families) for (const key of ['start', 'end']) {
    const result = await run(JSON.stringify({ ...c, phaseNames: { ...c.phaseNames, [key]: family } })); refusal(result); assert.equal(result.stage, 'config', `${key} ${family}`); assert.deepEqual(await readdir(root), []);
  }
});
