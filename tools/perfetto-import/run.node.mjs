import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, stat, symlink, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
const execFile = promisify(execFileCallback);

const hash = b => createHash('sha256').update(b).digest('hex');
const module = await import('./run.mjs').catch(() => ({}));
const fixtureModule = { runDiagnostic: module.runAuthoredFixtureDiagnostic };
const smoke = await import('./smoke.mjs').catch(() => ({}));
const version = 'Perfetto v58.2-add693d8b (add693d8b338ba9599dbcbc3e300b1ab8c000897)\nTrace Processor RPC API version: 14\n';
async function fixture(body = `process.stdout.write('rows\\n');`) {
  const root = await mkdtemp(join(tmpdir(), 'perfetto-import-test-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';\nif(process.argv.includes('--version')) { process.stdout.write(${JSON.stringify(version)}); } else { ${body} }\n`;
  await writeFile(join(root, 'processor.mjs'), source); await chmod(join(root, 'processor.mjs'), 0o700);
  await writeFile(join(root, 'trace'), trace);
  return { root, options: { trace: { path: join(root, 'trace'), bytes: trace.length, sha256: hash(trace) }, processor: { path: join(root, 'processor.mjs'), sha256: hash(source) }, phases: ["begin'quoted", 'end'], out: join(root, 'out') } };
}
test('library exists and imports without running a diagnostic', () => assert.equal(typeof module.runDiagnostic, 'function'));
test('production rejects self-declared processor identity before launch', async () => {
  const { options } = await fixture(); const r = await module.runDiagnostic(options);
  assert.equal(r.status, 'failure'); assert.match(r.error, /platform pin/); assert.deepEqual(r.processes, {}); assert.equal(r.officialProcessor, false);
});
test('success retains exact bounded outputs, SQL and diagnostic-only manifest', async () => {
  const { options } = await fixture(); const result = await fixtureModule.runDiagnostic(options);
  assert.equal(result.status, 'success'); assert.equal(result.nativeSupported, false); assert.equal(result.fps, null); assert.equal(result.duration, null); assert.equal(result.scoring, false);
  assert.equal(result.authoredFixture, true); assert.equal(result.officialProcessor, false);
  assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), 'rows\n');
  const sql = await readFile(join(options.out, 'diagnostic.sql'), 'utf8'); assert.ok(sql.includes("'begin''quoted'")); assert.ok(sql.includes('severity')); assert.ok(sql.includes('source')); assert.ok(sql.includes('chrome.graphics_pipeline'));
  assert.ok(sql.includes("('Graphics.Pipeline')"));
  assert.equal(result.sql.sha256, hash(sql)); assert.equal(result.processes.query.code, 0);
  assert.equal(JSON.parse(await readFile(join(options.out, 'manifest.json'))).status, 'success');
});
test('wrong trace bytes or processor hash prevents launch', async () => {
  for (const field of ['trace', 'processor']) { const { options } = await fixture('throw new Error("must not launch")'); options[field].sha256 = '0'.repeat(64); const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.equal(r.processes.version, undefined); }
  const { options } = await fixture(); options.trace.bytes++; assert.equal((await fixtureModule.runDiagnostic(options)).status, 'failure');
});
test('malformed version rejects before query', async () => {
  const { options } = await fixture(); const source = `#!${process.execPath}\nconsole.log('v58.2');\n`; await writeFile(options.processor.path, source); options.processor.sha256 = hash(source);
  const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.equal(r.processes.query, undefined);
});
test('nonzero original exit remains a failure with retained bytes', async () => {
  const { options } = await fixture(`process.stderr.write('original error'); process.exitCode=7;`); const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.equal(r.processes.query.code, 7); assert.equal(await readFile(join(options.out, 'query.stderr'), 'utf8'), 'original error');
});
test('overflow kills and joins original process with bounded retained output', async () => {
  const { options } = await fixture(`process.stdout.write(Buffer.alloc(300000, 120)); setInterval(()=>{},1000);`); const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.match(r.error, /limit/); assert.equal(r.processes.query.closed, true); assert.ok((await stat(join(options.out, 'query.stdout'))).size <= 262144);
});
test('stderr overflow is independently bounded', async () => {
  const { options } = await fixture(`process.stderr.write(Buffer.alloc(70000)); setInterval(()=>{},1000);`);
  const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.match(r.error, /stderr limit/); assert.equal(r.processes.query.closed, true); assert.ok((await stat(join(options.out, 'query.stderr'))).size <= 65536);
});
test('deadline kills and joins original process', async () => {
  const { options } = await fixture(`setInterval(()=>{},1000);`); const r = await fixtureModule.runDiagnostic({ ...options, deadlineMs: 1000 }); assert.equal(r.status, 'failure'); assert.match(r.error, /deadline/); assert.equal(r.processes.query.closed, true);
});
test('deadline closes inherited pipes after original child exits without claiming EOF', async () => {
  const { options } = await fixture(`const {spawn}=await import('node:child_process'); const descendant=spawn(process.execPath,['-e','setTimeout(()=>{},1800)'],{stdio:['ignore',1,2]}); descendant.unref();`);
  const start = performance.now();
  const r = await fixtureModule.runDiagnostic({ ...options, deadlineMs: 700 });
  assert.ok(performance.now() - start < 1600, 'must not await descendant pipe lifetime');
  assert.equal(r.status, 'failure'); assert.match(r.error, /deadline/);
  assert.equal(r.processes.query.code, 0); assert.equal(r.processes.query.closed, true);
  assert.equal(r.processes.query.streams.stdout.forcedDestroy, true);
  assert.equal(r.processes.query.streams.stdout.eof, false);
  assert.equal(r.processes.query.streams.stdout.closed, true);
});
test('records byte count and SHA256 of exact original retained output', async () => {
  const { options } = await fixture(`process.stdout.write('bytes');process.stderr.write('error bytes');`);
  const r = await fixtureModule.runDiagnostic(options);
  assert.equal(r.processes.query.streams.stdout.bytes, 5);
  assert.equal(r.processes.query.streams.stdout.sha256, hash('bytes'));
  assert.equal(r.processes.query.streams.stderr.bytes, 11);
  assert.equal(r.processes.query.streams.stderr.sha256, hash('error bytes'));
  assert.equal(r.processes.query.streams.stdout.eof, true);
  assert.equal(r.processes.query.streams.stdout.forcedDestroy, false);
});
test('fresh output is exclusive and existing files remain intact', async () => {
  const { options } = await fixture(); await fixtureModule.runDiagnostic(options); await assert.rejects(fixtureModule.runDiagnostic(options), /exist/); assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), 'rows\n');
});
test('symlink and multiple-link inputs are refused', async () => {
  for (const method of [symlink, link]) { const { options, root } = await fixture(); await method(options.trace.path, join(root, 'alias')); options.trace.path = join(root, 'alias'); assert.equal((await fixtureModule.runDiagnostic(options)).status, 'failure'); }
});
test('mutation during processor execution is detected', async () => {
  const { options } = await fixture(`fs.appendFileSync(process.argv.at(-1), 'changed'); process.stdout.write('rows');`); const r = await fixtureModule.runDiagnostic(options); assert.equal(r.status, 'failure'); assert.match(r.error, /changed|mismatch/);
});
test('CLI rejects a writerless config FIFO without hanging', async () => {
  const root = await mkdtemp(join(tmpdir(), 'perfetto-config-fifo-'));
  const path = join(root, 'config');
  await execFile('/usr/bin/mkfifo', [path]);
  await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--config', path], { timeout: 1000 }), error => {
    assert.equal(error.killed, false); assert.match(error.stderr, /regular/); return true;
  });
});
test('CLI rejects relative config paths', async () => {
  await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--config', 'relative.json']), error => { assert.match(error.stderr, /absolute/); return true; });
});
test('inert smoke module authors exactly the pinned synthetic clock bytes', () => {
  assert.equal(typeof smoke.authoredClockFixture, 'function');
  const bytes = smoke.authoredClockFixture(); assert.equal(bytes.length, 153);
  assert.equal(hash(bytes), '177a183ab43040d16379243c2185cf324a2e49edd8ab1c9d17034b9276f3199d');
});
