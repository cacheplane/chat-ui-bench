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
const version = 'Perfetto v59.1-1e9c61e98 (1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d)\nTrace Processor RPC API version: 14\n';
function assertScopeAuthority(result) {
  assert.equal(result.queryPolicy, 'scope-inventory-compact-v1');
  assertTargetAuthority({ ...result, queryPolicy: 'target-inventory-v1' });
}
test('scope inventory has inert explicit production and untrusted authored entrypoints', () => {
  assert.equal(typeof module.runScopeInventoryDiagnostic, 'function');
  assert.equal(typeof module.runAuthoredFixtureScopeInventoryDiagnostic, 'function');
});
test('scope selects only its fixed SQL and literal phases despite caller overrides', async () => {
  const { options } = await fixture(`process.stdout.write(fs.readFileSync(process.argv[4]));`);
  const result = await module.runAuthoredFixtureScopeInventoryDiagnostic({ ...options, queryPolicy: 'full', sql: 'SELECT override', filters: ['none'], qualification: true, fps: 60, authoredFixture: false });
  assert.equal(result.status, 'success', result.error); assertScopeAuthority(result);
  assert.equal(result.authoredFixture, true); assert.equal(result.officialProcessor, false);
  const source = await readFile(new URL('./scope-inventory.sql', import.meta.url), 'utf8');
  const sql = source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'");
  assert.equal(await readFile(join(options.out, 'diagnostic.sql'), 'utf8'), sql);
  assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), sql);
  assert.equal(result.sql.sourceSha256, hash(source)); assert.equal(result.sql.sha256, hash(sql));
  assert.deepEqual(result.before, result.after);
});
test('scope preserves all old SQL bytes and manifest shapes when supplied to old APIs', async () => {
  for (const [run, file, policy] of [[module.runAuthoredFixtureDiagnostic, 'diagnostic.sql', undefined], [module.runAuthoredFixtureInventoryDiagnostic, 'inventory.sql', 'inventory-v1'], [module.runAuthoredFixtureTargetInventoryDiagnostic, 'target-inventory.sql', 'target-inventory-v1']]) {
    const { options } = await fixture();
    const result = await run({ ...options, queryPolicy: 'scope-inventory-v1' });
    assert.equal(result.status, 'success', result.error); assert.equal(result.queryPolicy, policy);
    if (policy === 'target-inventory-v1') assertTargetAuthority(result);
    else assert.equal(Object.hasOwn(result, 'clockAdmission'), false);
    const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.equal(await readFile(join(options.out, 'diagnostic.sql'), 'utf8'), source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'"));
  }
});
test('scope false authority survives early failures and cannot bypass production pins', async () => {
  for (const mode of ['pin', 'phase', 'bytes', 'byteMismatch', 'hash', 'processorHash', 'version', 'symlink', 'hardlink']) {
    const { root, options } = await fixture();
    let run = module.runAuthoredFixtureScopeInventoryDiagnostic;
    if (mode === 'pin') run = module.runScopeInventoryDiagnostic;
    if (mode === 'phase') options.phases = ['only'];
    if (mode === 'bytes') options.trace.bytes = undefined;
    if (mode === 'byteMismatch') options.trace.bytes++;
    if (mode === 'hash') options.trace.sha256 = '0'.repeat(64);
    if (mode === 'processorHash') options.processor.sha256 = '0'.repeat(64);
    if (mode === 'version') {
      const source = `#!${process.execPath}\nprocess.stdout.write('Perfetto v58.2-add693d8b (add693d8b338ba9599dbcbc3e300b1ab8c000897)\\nTrace Processor RPC API version: 14\\n');\n`;
      await writeFile(options.processor.path, source); options.processor.sha256 = hash(source);
    }
    if (mode === 'symlink') { const path = join(root, 'sym'); await symlink(options.trace.path, path); options.trace.path = path; }
    if (mode === 'hardlink') await link(options.trace.path, join(root, 'linked'));
    const result = await run({ ...options, authoredFixture: true });
    assert.equal(result.status, 'failure', mode); assertScopeAuthority(result);
    assert.equal(result.processes.query, undefined, mode);
    if (mode === 'pin') { assert.equal(result.authoredFixture, false); assert.equal(result.officialProcessor, false); assert.match(result.error, /platform pin/); }
    if (mode === 'version') assert.match(result.error, /version mismatch/);
  }
});
test('scope CLI enforces production identity and normalized one-link regular config', async () => {
  const { root, options } = await fixture(); const config = join(root, 'config.json');
  await writeFile(config, JSON.stringify({ ...options, authoredFixture: true }));
  await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--scope-inventory-config', config]), error => { assert.equal(error.code, 1); assert.match(error.stdout, /platform pin/); return true; });
  const result = JSON.parse(await readFile(join(options.out, 'manifest.json'))); assertScopeAuthority(result); assert.equal(result.authoredFixture, false);
  const fifo = join(root, 'fifo'), sym = join(root, 'sym'), hard = join(root, 'hard');
  await execFile('/usr/bin/mkfifo', [fifo]); await symlink(config, sym); await link(config, hard);
  for (const path of ['relative.json', `${root}/../${root.split('/').at(-1)}/config.json`, fifo, sym, hard]) {
    await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--scope-inventory-config', path], { timeout: 1000 }), error => { assert.equal(error.code, 1); assert.equal(error.killed, false); assert.match(error.stderr, /absolute|regular/); return true; });
  }
});
test('scope retains whole-run process failure, capped streams and custody bookends', async () => {
  for (const [name, body, pattern, limit] of [
    ['stdout', `process.stdout.write(Buffer.alloc(300000,120)); setInterval(()=>{},1000);`, /stdout limit/, 262144],
    ['stderr', `process.stderr.write(Buffer.alloc(70000,120)); setInterval(()=>{},1000);`, /stderr limit/, 65536],
    ['deadline', `setInterval(()=>{},1000);`, /deadline/],
    ['exit', `process.stdout.write('original'); process.stderr.write('failure'); process.exitCode=7;`, /unsuccessfully/],
    ['inherited', `const {spawn}=await import('node:child_process'); spawn(process.execPath,['-e','setTimeout(()=>{},1800)'],{stdio:['ignore',1,2]}).unref();`, /deadline/],
    ['mutation', `fs.appendFileSync(process.argv.at(-1),'changed');`, /changed|mismatch/],
  ]) {
    const { options } = await fixture(body);
    const result = await module.runAuthoredFixtureScopeInventoryDiagnostic({ ...options, deadlineMs: ['deadline','inherited'].includes(name) ? 700 : 60000 });
    assert.equal(result.status, 'failure', name); assert.match(result.error, pattern); assertScopeAuthority(result);
    assert.equal(result.processes.query.closed, true);
    if (limit) assert.equal((await stat(join(options.out, `query.${name}`))).size, limit);
    if (name !== 'mutation') assert.deepEqual(result.before, result.after);
    const saved = JSON.parse(await readFile(join(options.out, 'manifest.json'))); assertScopeAuthority(saved); assert.equal(saved.status, 'failure');
  }
});
async function fixture(body = `process.stdout.write('rows\\n');`) {
  const root = await mkdtemp(join(tmpdir(), 'perfetto-import-test-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';\nif(process.argv.includes('--version')) { process.stdout.write(${JSON.stringify(version)}); } else { ${body} }\n`;
  await writeFile(join(root, 'processor.mjs'), source); await chmod(join(root, 'processor.mjs'), 0o700);
  await writeFile(join(root, 'trace'), trace);
  return { root, options: { trace: { path: join(root, 'trace'), bytes: trace.length, sha256: hash(trace) }, processor: { path: join(root, 'processor.mjs'), sha256: hash(source) }, phases: ["begin'quoted", 'end'], out: join(root, 'out') } };
}
test('library exists and imports without running a diagnostic', () => assert.equal(typeof module.runDiagnostic, 'function'));
test('production full, inventory and target inventory reject the former official platform pin before launch', async () => {
  const formerPins = {
    'darwin-arm64': 'd29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa',
    'linux-x64': '58042408e6cc861fb1a731c26bb082dc222285561eaa4e12a48a8b2b90dca7b9',
  };
  const formerPin = formerPins[`${process.platform}-${process.arch}`];
  assert.ok(formerPin, 'this control requires a supported runtime platform');
  for (const run of [module.runDiagnostic, module.runInventoryDiagnostic, module.runTargetInventoryDiagnostic]) {
    const { options } = await fixture();
    options.processor.sha256 = formerPin;
    const result = await run(options);
    assert.equal(result.status, 'failure'); assert.match(result.error, /platform pin/);
    assert.deepEqual(result.processes, {});
  }
});
test('authored full, inventory and target inventory reject complete former version after normal version exit before query', async () => {
  const formerVersion = 'Perfetto v58.2-add693d8b (add693d8b338ba9599dbcbc3e300b1ab8c000897)\nTrace Processor RPC API version: 14\n';
  for (const run of [module.runAuthoredFixtureDiagnostic, module.runAuthoredFixtureInventoryDiagnostic, module.runAuthoredFixtureTargetInventoryDiagnostic]) {
    const { options } = await fixture();
    const source = `#!${process.execPath}\nif(process.argv.includes('--version')) { process.stdout.write(${JSON.stringify(formerVersion)}); } else { throw new Error('query must not launch'); }\n`;
    await writeFile(options.processor.path, source); options.processor.sha256 = hash(source);
    const result = await run(options);
    assert.equal(result.status, 'failure'); assert.match(result.error, /version mismatch/);
    assert.equal(result.processes.query, undefined);
    assert.equal(result.processes.version.code, 0); assert.equal(result.processes.version.signal, null);
    assert.equal(result.processes.version.closed, true); assert.equal(result.processes.version.error, null);
    for (const stream of Object.values(result.processes.version.streams)) {
      assert.equal(stream.eof, true); assert.equal(stream.closed, true);
      assert.equal(stream.forcedDestroy, false); assert.equal(stream.error, null);
    }
    assert.equal(await readFile(join(options.out, 'version.stdout'), 'utf8'), formerVersion);
    assert.equal(await readFile(join(options.out, 'version.stderr'), 'utf8'), '');
  }
});
test('inventory has separate official and authored-only library entrypoints', () => {
  assert.equal(typeof module.runInventoryDiagnostic, 'function');
  assert.equal(typeof module.runAuthoredFixtureInventoryDiagnostic, 'function');
});
function assertTargetAuthority(result) {
  assert.equal(result.schema, 1);
  assert.equal(result.queryPolicy, 'target-inventory-v1');
  assert.equal(result.rawRowsExported, true);
  for (const key of ['qualification', 'captureQualified', 'fpsEligibility', 'evaluationEligibility', 'scoringEligibility', 'rankingEligibility', 'nativeSupported', 'scoring']) assert.equal(result[key], false, key);
  assert.equal(result.clockAdmission, 'not_evaluated');
  assert.equal(result.diagnosticOnly, true);
  assert.equal(result.fps, null); assert.equal(result.duration, null);
}
test('target inventory exports inert explicit production and authored entrypoints', () => {
  assert.equal(typeof module.runTargetInventoryDiagnostic, 'function');
  assert.equal(typeof module.runAuthoredFixtureTargetInventoryDiagnostic, 'function');
});
test('target inventory selects exact fixed SQL and ignores caller policy and authority', async () => {
  const { options } = await fixture(`process.stdout.write(fs.readFileSync(process.argv[4]));`);
  const result = await module.runAuthoredFixtureTargetInventoryDiagnostic({ ...options, sql: 'SELECT caller_override', queryPolicy: 'full', filters: ['unrelated'], authoredFixture: false, qualification: true, fps: 60 });
  assert.equal(result.status, 'success', result.error); assertTargetAuthority(result);
  assert.equal(result.authoredFixture, true); assert.equal(result.officialProcessor, false);
  const source = await readFile(new URL('./target-inventory.sql', import.meta.url), 'utf8');
  const executed = source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'");
  assert.equal(await readFile(join(options.out, 'diagnostic.sql'), 'utf8'), executed);
  assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), executed);
  assert.equal(result.sql.sourceSha256, hash(source)); assert.equal(result.sql.sha256, hash(executed));
  assert.deepEqual(result.before, result.after);
  assert.equal(result.processes.query.code, 0); assert.equal(result.processes.query.signal, null);
  for (const state of Object.values(result.processes.query.streams)) {
    assert.equal(state.eof, true); assert.equal(state.closed, true); assert.equal(state.forcedDestroy, false); assert.equal(state.error, null);
  }
});
test('target policy labels exist before production and phase validation failures', async () => {
  const production = await fixture();
  const refused = await module.runTargetInventoryDiagnostic({ ...production.options, authoredFixture: true });
  assertTargetAuthority(refused); assert.equal(refused.status, 'failure'); assert.match(refused.error, /platform pin/);
  assert.deepEqual(refused.processes, {}); assert.equal(refused.authoredFixture, false); assert.equal(refused.officialProcessor, false);
  const authored = await fixture();
  const invalid = await module.runAuthoredFixtureTargetInventoryDiagnostic({ ...authored.options, phases: ['only'] });
  assertTargetAuthority(invalid); assert.equal(invalid.status, 'failure'); assert.match(invalid.error, /phase/); assert.deepEqual(invalid.processes, {});
});
test('existing APIs ignore target policy extras and keep their SQL and manifest contracts', async () => {
  for (const [run, file, policy] of [[module.runAuthoredFixtureDiagnostic, 'diagnostic.sql', undefined], [module.runAuthoredFixtureInventoryDiagnostic, 'inventory.sql', 'inventory-v1']]) {
    const { options } = await fixture();
    const result = await run({ ...options, queryPolicy: 'target-inventory-v1', sql: 'SELECT caller_override', qualification: true });
    assert.equal(result.status, 'success', result.error); assert.equal(result.queryPolicy, policy);
    for (const key of ['qualification', 'captureQualified', 'clockAdmission', 'fpsEligibility', 'evaluationEligibility', 'scoringEligibility', 'rankingEligibility']) assert.equal(Object.hasOwn(result, key), false, key);
    const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.equal(await readFile(join(options.out, 'diagnostic.sql'), 'utf8'), source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'"));
  }
});
test('inventory success selects fixed SQL and reports aggregate-only authority', async () => {
  const { options } = await fixture(`process.stdout.write(fs.readFileSync(process.argv[4]));`);
  const r = await module.runAuthoredFixtureInventoryDiagnostic({ ...options, sql: 'SELECT caller_override', queryPolicy: 'full' });
  assert.equal(r.status, 'success', r.error);
  assert.equal(r.queryPolicy, 'inventory-v1'); assert.equal(r.rawRowsExported, false);
  assert.equal(r.nativeSupported, false); assert.equal(r.fps, null); assert.equal(r.duration, null); assert.equal(r.scoring, false);
  assert.equal(r.authoredFixture, true); assert.equal(r.officialProcessor, false);
  const source = await readFile(new URL('./inventory.sql', import.meta.url), 'utf8');
  const executed = await readFile(join(options.out, 'diagnostic.sql'), 'utf8');
  assert.equal(executed, source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'"));
  assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), executed);
  assert.equal(r.sql.sourceSha256, hash(source)); assert.equal(r.sql.sha256, hash(executed));
  assert.deepEqual(r.before, r.after);
  assert.equal(r.processes.query.code, 0); assert.equal(r.processes.query.signal, null);
  for (const state of Object.values(r.processes.query.streams)) {
    assert.equal(state.eof, true); assert.equal(state.closed, true); assert.equal(state.forcedDestroy, false);
  }
});
test('official inventory refuses authored processor before launch', async () => {
  const { options } = await fixture();
  const r = await module.runInventoryDiagnostic(options);
  assert.equal(r.status, 'failure'); assert.match(r.error, /platform pin/);
  assert.deepEqual(r.processes, {}); assert.equal(r.queryPolicy, 'inventory-v1'); assert.equal(r.rawRowsExported, false);
});
test('inventory overflow retains a whole-run failure and input bookends', async () => {
  const { options } = await fixture(`process.stdout.write(Buffer.alloc(300000, 120)); setInterval(()=>{},1000);`);
  const r = await module.runAuthoredFixtureInventoryDiagnostic(options);
  assert.equal(r.status, 'failure'); assert.match(r.error, /stdout limit/);
  assert.equal(r.processes.query.closed, true); assert.equal(r.processes.query.streams.stdout.forcedDestroy, true);
  assert.equal((await stat(join(options.out, 'query.stdout'))).size, 262144);
  assert.deepEqual(r.before, r.after); assert.equal(r.rawRowsExported, false);
  assert.equal(JSON.parse(await readFile(join(options.out, 'manifest.json'))).status, 'failure');
});
test('inventory checks trace hashes and mutation using the same bookends', async () => {
  const bad = await fixture(); bad.options.trace.sha256 = '0'.repeat(64);
  const rejected = await module.runAuthoredFixtureInventoryDiagnostic(bad.options);
  assert.equal(rejected.status, 'failure'); assert.deepEqual(rejected.processes, {});
  const { options } = await fixture(`fs.appendFileSync(process.argv.at(-1), 'changed');`);
  const changed = await module.runAuthoredFixtureInventoryDiagnostic(options);
  assert.equal(changed.status, 'failure'); assert.match(changed.error, /changed|mismatch/);
});
test('default API ignores requested policy and retains full SQL and manifest shape', async () => {
  const { options } = await fixture();
  const r = await module.runAuthoredFixtureDiagnostic({ ...options, queryPolicy: 'inventory-v1', sql: 'SELECT caller_override' });
  assert.equal(r.status, 'success');
  assert.equal(Object.hasOwn(r, 'queryPolicy'), false); assert.equal(Object.hasOwn(r, 'rawRowsExported'), false);
  const source = await readFile(new URL('./diagnostic.sql', import.meta.url), 'utf8');
  assert.equal(await readFile(join(options.out, 'diagnostic.sql'), 'utf8'), source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'"));
});
test('CLI explicitly selects official inventory mode without allowing authored identity', async () => {
  const { root, options } = await fixture(); const config = join(root, 'config.json');
  await writeFile(config, JSON.stringify(options));
  await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--inventory-config', config]), error => {
    assert.equal(error.code, 1); assert.match(error.stdout, /platform pin/); return true;
  });
  const r = JSON.parse(await readFile(join(options.out, 'manifest.json')));
  assert.equal(r.queryPolicy, 'inventory-v1'); assert.equal(r.rawRowsExported, false); assert.deepEqual(r.processes, {});
});
test('target inventory CLI selects production policy and ignores authored bypass JSON', async () => {
  const { root, options } = await fixture(); const config = join(root, 'config.json');
  await writeFile(config, JSON.stringify({ ...options, authoredFixture: true, authored: true, queryPolicy: 'full', sql: 'SELECT caller_override', fps: 60 }));
  await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--target-inventory-config', config]), error => {
    assert.equal(error.code, 1); assert.match(error.stdout, /platform pin/); return true;
  });
  const result = JSON.parse(await readFile(join(options.out, 'manifest.json')));
  assertTargetAuthority(result); assert.equal(result.authoredFixture, false); assert.equal(result.officialProcessor, false); assert.deepEqual(result.processes, {});
});
test('target inventory CLI refuses relative and FIFO config paths before reading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'perfetto-target-config-fifo-')); const fifo = join(root, 'config');
  await execFile('/usr/bin/mkfifo', [fifo]);
  for (const [path, message] of [['relative.json', /absolute/], [fifo, /regular/]]) {
    await assert.rejects(execFile(process.execPath, [new URL('./run.mjs', import.meta.url).pathname, '--target-inventory-config', path], { timeout: 1000 }), error => {
      assert.equal(error.killed, false); assert.equal(error.code, 1); assert.match(error.stderr, message); return true;
    });
  }
});
test('target inventory retains the existing bounded process and input failure boundaries', async () => {
  const cases = [
    ['stdout', `process.stdout.write(Buffer.alloc(300000, 120)); setInterval(()=>{},1000);`, /stdout limit/, 262144],
    ['stderr', `process.stderr.write(Buffer.alloc(70000, 120)); setInterval(()=>{},1000);`, /stderr limit/, 65536],
    ['deadline', `setInterval(()=>{},1000);`, /deadline/],
    ['exit', `process.stdout.write('original rows'); process.stderr.write('original error'); process.exitCode=7;`, /unsuccessfully/],
    ['inherited', `const {spawn}=await import('node:child_process'); const descendant=spawn(process.execPath,['-e','setTimeout(()=>{},1800)'],{stdio:['ignore',1,2]}); descendant.unref();`, /deadline/],
    ['mutation', `fs.appendFileSync(process.argv.at(-1), 'changed'); process.stdout.write('rows');`, /changed|mismatch/],
  ];
  for (const [name, body, error, limit] of cases) {
    const { options } = await fixture(body);
    const result = await module.runAuthoredFixtureTargetInventoryDiagnostic({ ...options, deadlineMs: ['deadline','inherited'].includes(name) ? 700 : 60000 });
    assert.equal(result.status, 'failure', name); assert.match(result.error, error, name); assertTargetAuthority(result);
    assert.equal(result.processes.query.closed, true, name);
    const saved = JSON.parse(await readFile(join(options.out, 'manifest.json')));
    assert.equal(saved.status, 'failure'); assertTargetAuthority(saved);
    if (name !== 'mutation') assert.deepEqual(result.before, result.after, name);
    else assert.notDeepEqual(result.before, result.after);
    if (limit) {
      const bytes = await readFile(join(options.out, `query.${name}`));
      assert.equal(bytes.length, limit);
      assert.equal(result.processes.query.streams[name].bytes, limit);
      assert.equal(result.processes.query.streams[name].sha256, hash(bytes));
      assert.equal(result.processes.query.streams[name].forcedDestroy, true);
    }
    if (name === 'inherited') {
      assert.equal(result.processes.query.code, 0); assert.equal(result.processes.query.signal, null);
      for (const state of Object.values(result.processes.query.streams)) {
        assert.equal(state.forcedDestroy, true); assert.equal(state.eof, false); assert.equal(state.closed, true);
      }
    }
    if (name === 'exit') {
      assert.equal(result.processes.query.code, 7);
      assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), 'original rows');
      assert.equal(await readFile(join(options.out, 'query.stderr'), 'utf8'), 'original error');
    }
  }
  for (const method of [symlink, link]) {
    const { options, root } = await fixture(); await method(options.trace.path, join(root, 'alias')); options.trace.path = join(root, 'alias');
    const result = await module.runAuthoredFixtureTargetInventoryDiagnostic(options);
    assert.equal(result.status, 'failure'); assert.match(result.error, /regular file/); assert.deepEqual(result.processes, {}); assertTargetAuthority(result);
  }
  const { options } = await fixture();
  assert.equal((await module.runAuthoredFixtureTargetInventoryDiagnostic(options)).status, 'success');
  await assert.rejects(module.runAuthoredFixtureTargetInventoryDiagnostic(options), /exist/);
  assert.equal(await readFile(join(options.out, 'query.stdout'), 'utf8'), 'rows\n');
});
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
test('inert smoke module authors the corrected populated graphics fixture', () => {
  assert.equal(typeof smoke.authoredGraphicsFixture, 'function');
  const bytes = smoke.authoredGraphicsFixture(); assert.equal(bytes.length, 308);
  assert.equal(hash(bytes), '2060e02191ec0f00325e024007de9080ab4224467d325e80c2261a28e1b8c542');
  assert.deepEqual(bytes.subarray(0, 153), smoke.authoredClockFixture());
});
test('inert smoke module authors a separate deterministic target fixture with unchanged graphics prefix', () => {
  assert.equal(typeof smoke.authoredTargetFixture, 'function');
  const bytes = smoke.authoredTargetFixture();
  assert.ok(Buffer.isBuffer(bytes));
  assert.equal(bytes.length, 1238);
  assert.equal(hash(bytes), 'ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0');
  assert.deepEqual(bytes.subarray(0, 308), smoke.authoredGraphicsFixture());
  assert.deepEqual(bytes, smoke.authoredTargetFixture());
  for (const value of ['TracingStartedInBrowser', 'SetLayerTreeId', 'frames', 'navigationId', 'BeginFrame', 'left",right', 'é🧪', 'line1\n\nline3\r\nline4']) assert.ok(bytes.includes(Buffer.from(value)), value);
});
test('fixed SQL retains full graphics inventories, raw context and unfiltered arguments', async () => {
  const sql = await readFile(new URL('./diagnostic.sql', import.meta.url), 'utf8');
  for (const name of ['chrome_graphics_pipeline_surface_frame_steps', 'chrome_graphics_pipeline_display_frame_steps', 'chrome_surface_frame_id_to_first_display_id', 'surface_without_first_display_mapping']) assert.ok(sql.includes(name), name);
  assert.match(sql, /LEFT JOIN thread_or_process_slice/);
  assert.match(sql, /LEFT JOIN args a ON a\.arg_set_id = s\.arg_set_id/);
  for (const name of ['flat_key', 'key', 'value_type', 'int_value', 'string_value', 'real_value', 'task_start_time_ts', 'process_name', 'thread_name']) assert.ok(sql.includes(name), name);
  assert.match(sql, /GROUP BY step/);
  assert.match(sql, /surface_without_first_display_mapping[\s\S]*SELECT DISTINCT surface_frame_trace_id[\s\S]*WHERE surface_frame_trace_id IS NOT NULL/);
  assert.match(sql, /'surface_steps_without_surface_id'[\s\S]*WHERE surface_frame_trace_id IS NULL/);
  assert.doesNotMatch(sql, /\bLIMIT\s+\d+|LIKE\s+['"]/i);
});
test('inventory SQL aggregates complete groups and preserves NULL arguments without inventing occurrences', async () => {
  const sql = await readFile(new URL('./inventory.sql', import.meta.url), 'utf8');
  assert.match(sql, /INCLUDE PERFETTO MODULE chrome\.graphics_pipeline/);
  assert.match(sql, /WHERE value != 0 ORDER BY name, idx/);
  assert.doesNotMatch(sql, /\bLIMIT\b|\bLIKE\b|a\.(?:int_value|string_value|real_value)|\b(?:fps|rate)\b/i);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id, ts, dur, name, track_id, arg_set_id);
      CREATE TABLE track(id, name);
      CREATE TABLE thread_or_process_slice(id, utid, tid, upid, pid, process_name, thread_name);
      CREATE TABLE args(arg_set_id, flat_key, key, value_type);
      CREATE TABLE stats(name, idx, severity, source, value);
      CREATE TABLE trace_bounds(start_ts, end_ts);
      CREATE TABLE chrome_graphics_pipeline_surface_frame_steps(surface_frame_trace_id, step);
      CREATE TABLE chrome_graphics_pipeline_display_frame_steps(step);
      CREATE TABLE chrome_surface_frame_id_to_first_display_id(surface_frame_trace_id, display_trace_id);
      INSERT INTO slice VALUES (1,1,0,'PipelineReporter',1,100),(2,2,0,'PipelineReporter',1,101),
        (3,3,0,'PipelineReporter',2,102),(4,4,0,'Graphics.Pipeline',NULL,NULL),
        (5,5,0,'Graphics.Pipeline',NULL,NULL),(6,6,0,'start',NULL,NULL),(7,7,0,'end',NULL,NULL);
      INSERT INTO track VALUES(1,'main'),(2,'worker');
      INSERT INTO thread_or_process_slice VALUES(1,10,11,12,13,'proc','thread'),(2,10,11,12,13,'proc','thread');
      INSERT INTO args VALUES(100,'key','key[0]','int'),(100,'key','key[1]','int'),(101,'key','key[0]','int');
      INSERT INTO stats VALUES('nonzero',0,'data_loss','trace',7),('zero',0,'info','analysis',0);
      INSERT INTO trace_bounds VALUES(1,7);
      INSERT INTO chrome_graphics_pipeline_surface_frame_steps VALUES(43,'surface'),(43,'surface'),(44,'surface'),(NULL,'surface');
      INSERT INTO chrome_graphics_pipeline_display_frame_steps VALUES('display');
      INSERT INTO chrome_surface_frame_id_to_first_display_id VALUES(43,58);
    `);
    const queries = sql.replace(/--[^\n]*/g, '').replace(/INCLUDE PERFETTO MODULE chrome\.graphics_pipeline;/, '').replace('__PHASE_LITERALS__', "'start', 'end'").split(';').filter(s => s.trim());
    const results = queries.map(query => db.prepare(query).all().map(row => ({ ...row })));
    assert.equal(results.length, 10, 'inventory exports only phases, stats, bounds, counts, grouped slices and argument keys');
    assert.deepEqual(results[0].map(row => [row.name, row.track_name, row.utid]), [['start', null, null], ['end', null, null]]);
    assert.deepEqual(results[1], [{ name: 'nonzero', idx: 0, severity: 'data_loss', source: 'trace', value: 7 }]);
    assert.deepEqual(results[6], [{ inventory: 'surface_without_first_display_mapping', row_count: 1 }]);
    assert.deepEqual(results[7], [{ inventory: 'surface_steps_without_surface_id', row_count: 1 }]);
    assert.deepEqual(results[8].map(row => [row.name, row.track_name, row.process_name, row.slice_count]), [
      ['Graphics.Pipeline', null, null, 2], ['PipelineReporter', 'main', 'proc', 2], ['PipelineReporter', 'worker', null, 1],
    ]);
    assert.deepEqual(results[9], [
      { name: 'Graphics.Pipeline', flat_key: null, key: null, value_type: null, arg_occurrence_count: 0, slice_count: 2 },
      { name: 'PipelineReporter', flat_key: null, key: null, value_type: null, arg_occurrence_count: 0, slice_count: 1 },
      { name: 'PipelineReporter', flat_key: 'key', key: 'key[0]', value_type: 'int', arg_occurrence_count: 2, slice_count: 2 },
      { name: 'PipelineReporter', flat_key: 'key', key: 'key[1]', value_type: 'int', arg_occurrence_count: 1, slice_count: 1 },
    ]);
  } finally { db.close(); }
});
test('inventory counts matched NULL-key arguments while excluding unmatched slices', async () => {
  const sql = await readFile(new URL('./inventory.sql', import.meta.url), 'utf8');
  const argumentQuery = sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim()).at(-1);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id, name, arg_set_id);
      CREATE TABLE args(arg_set_id, flat_key, key, value_type);
      INSERT INTO slice VALUES(1,'PipelineReporter',100),(2,'PipelineReporter',101),
        (3,'Graphics.Pipeline',NULL),(4,'PipelineReporter',102);
      INSERT INTO args VALUES(100,NULL,NULL,NULL),(102,'nullable',NULL,'int');
    `);
    assert.deepEqual(db.prepare(argumentQuery).all().map(row => ({ ...row })), [
      { name: 'Graphics.Pipeline', flat_key: null, key: null, value_type: null, arg_occurrence_count: 0, slice_count: 1 },
      { name: 'PipelineReporter', flat_key: null, key: null, value_type: null, arg_occurrence_count: 1, slice_count: 2 },
      { name: 'PipelineReporter', flat_key: 'nullable', key: null, value_type: 'int', arg_occurrence_count: 1, slice_count: 1 },
    ]);
  } finally { db.close(); }
});

test('target inventory SQL exports seven complete tables with lossless context and argument multiplicity', async () => {
  const sql = await readFile(new URL('./target-inventory.sql', import.meta.url), 'utf8');
  assert.equal(sql.split('__PHASE_LITERALS__').length - 1, 1);
  assert.match(sql, /INCLUDE PERFETTO MODULE chrome\.graphics_pipeline;/);
  assert.doesNotMatch(sql, /\bLIMIT\b|\bLIKE\b|CAST\([^)]*\bREAL\b|\b(?:fps|qualification|scoring)\b/i);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id, ts, dur, name, track_id, arg_set_id);
      CREATE TABLE track(id, name);
      CREATE TABLE thread_or_process_slice(id, utid, tid, upid, pid, process_name, thread_name);
      CREATE TABLE args(arg_set_id, flat_key, key, value_type, int_value, string_value, real_value);
      CREATE TABLE stats(name, idx, severity, source, value);
      CREATE TABLE trace_bounds(start_ts, end_ts);
      CREATE TABLE chrome_surface_frame_id_to_first_display_id(surface_frame_trace_id, display_trace_id);
      INSERT INTO slice VALUES
        (1,9007199254740993,0,'SetLayerTreeId',1,100),
        (2,2,0,'SetLayerTreeId',1,100),
        (3,3,0,'TracingStartedInBrowser',1,101),
        (4,4,0,'FrameCommittedInBrowser',NULL,102),
        (5,5,0,'ProcessReadyInBrowser',NULL,NULL),
        (6,6,0,'BeginFrame',NULL,NULL),
        (7,7,0,'PipelineReporter',NULL,103),
        (8,8,0,'PipelineReporter',NULL,104),
        (9,9,0,'Graphics.Pipeline',NULL,105),
        (10,10,0,'begin''quoted',NULL,106),
        (11,11,0,'unrelated',NULL,101);
      INSERT INTO track VALUES(1,'browser');
      INSERT INTO thread_or_process_slice VALUES(3,1,2,3,13799,'browser process','emitter');
      INSERT INTO args VALUES
        (100,'debug.data.frame','debug.data.frame','string',NULL,'frame-a',NULL),
        (100,'debug.data.layerTreeId','debug.data.layerTreeId','int',9007199254740993,NULL,NULL),
        (100,'debug.data.layerTreeId','debug.data.layerTreeId','int',9007199254740993,NULL,NULL),
        (100,'debug.data.layerTreeId','debug.data.layerTreeId','string',NULL,'wrong-type',NULL),
        (101,'debug.data.frames.frame','debug.data.frames[0].frame','string',NULL,'frame-a',NULL),
        (101,'debug.data.frames.frame','debug.data.frames[1].frame','string',NULL,'frame-b',NULL),
        (101,'debug.data.frames.processId','debug.data.frames[0].processId','int',13804,NULL,NULL),
        (101,'debug.data.frames.processId','debug.data.frames[1].processId','int',13804,NULL,NULL),
        (102,'empty','empty','string',NULL,'',NULL),
        (102,'literal','literal','string',NULL,'[NULL]',NULL),
        (103,NULL,NULL,NULL,NULL,NULL,NULL),
        (105,'real','real','real',NULL,NULL,1.25),
        (105,'unsigned','unsigned','uint',9007199254740995,NULL,NULL),
        (105,NULL,'nullable',NULL,NULL,NULL,NULL),
        (106,'debug.data.navigationId','debug.data.navigationId','string',NULL,'loader',NULL);
      INSERT INTO stats VALUES('z',1,'error','trace',7),('a',0,'info','analysis',-1),('zero',0,'info','trace',0);
      INSERT INTO trace_bounds VALUES(9,20),(1,8);
      INSERT INTO chrome_surface_frame_id_to_first_display_id VALUES(44,59),(43,58),(43,58);
    `);
    const statements = sql.replace(/--[^\n]*/g, '').replace(/INCLUDE PERFETTO MODULE chrome\.graphics_pipeline;/, '')
      .replace(/CREATE PERFETTO VIEW/g, 'CREATE VIEW').replace('__PHASE_LITERALS__', "'begin''quoted', 'SetLayerTreeId'").split(';').filter(s => s.trim());
    const selectStatements = [];
    for (const statement of statements) {
      if (/^\s*CREATE\s+VIEW/i.test(statement)) db.exec(statement);
      else selectStatements.push(statement);
    }
    const read = query => {
      const statement = db.prepare(query); statement.setReadBigInts(true);
      return statement.all().map(row => ({ ...row }));
    };
    const tables = selectStatements.map(read);
    assert.equal(tables.length, 7);
    const schemas = [
      'name,event_count,arg_set_count',
      'id,ts,dur,name,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,track_name_is_null,process_name_is_null,thread_name_is_null',
      'slice_id,name,arg_set_id,arg_present,flat_key,key,value_type,int_value,string_value,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null',
      'name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
      'name,idx,severity,source,value', 'start_ts,end_ts', 'surface_frame_trace_id,display_trace_id',
    ];
    tables.forEach((rows, i) => assert.equal(Object.keys(rows[0]).join(','), schemas[i]));
    assert.deepEqual(tables[0].map(r => [r.name, r.event_count, r.arg_set_count]), [
      ['BeginFrame',1n,0n], ['FrameCommittedInBrowser',1n,1n], ['FrameDeletedInBrowser',0n,0n], ['Graphics.Pipeline',1n,1n],
      ['PipelineReporter',2n,2n], ['ProcessReadyInBrowser',1n,0n], ['SetLayerTreeId',2n,1n], ['TracingStartedInBrowser',1n,1n],
    ]);
    assert.deepEqual(tables[1].map(r => r.id), [2n,3n,4n,5n,6n,7n,8n,9n,10n,1n]);
    assert.equal(tables[1].at(-1).ts, 9007199254740993n);
    assert.deepEqual(tables[1].find(r => r.id === 3n), {
      id:3n, ts:3n, dur:0n, name:'TracingStartedInBrowser', track_id:1n, track_name:'browser', arg_set_id:101n,
      utid:1n, tid:2n, upid:3n, pid:13799n, process_name:'browser process', thread_name:'emitter',
      track_name_is_null:0n, process_name_is_null:0n, thread_name_is_null:0n,
    });
    const emptyContext = tables[1].find(r => r.id === 4n);
    for (const key of ['track_id','track_name','utid','tid','upid','pid','process_name','thread_name']) assert.equal(emptyContext[key], null, key);
    for (const key of ['track_name_is_null','process_name_is_null','thread_name_is_null']) assert.equal(emptyContext[key], 1n, key);
    const args = tables[2];
    assert.equal(args.length, 22);
    assert.deepEqual(args.filter(r => r.name === 'SetLayerTreeId').map(r => [r.slice_id, r.key, r.value_type, r.int_value, r.string_value]), [2n,1n].flatMap(id => [
      [id,'debug.data.frame','string',null,'frame-a'],
      [id,'debug.data.layerTreeId','int',9007199254740993n,null],
      [id,'debug.data.layerTreeId','int',9007199254740993n,null],
      [id,'debug.data.layerTreeId','string',null,'wrong-type'],
    ]));
    assert.deepEqual(args.filter(r => r.slice_id === 3n).map(r => [r.flat_key,r.key,r.int_value,r.string_value]), [
      ['debug.data.frames.frame','debug.data.frames[0].frame',null,'frame-a'],
      ['debug.data.frames.frame','debug.data.frames[1].frame',null,'frame-b'],
      ['debug.data.frames.processId','debug.data.frames[0].processId',13804n,null],
      ['debug.data.frames.processId','debug.data.frames[1].processId',13804n,null],
    ]);
    assert.deepEqual(args.filter(r => r.slice_id === 4n).map(r => [r.string_value,r.string_value_is_null]), [['',0n],['[NULL]',0n]]);
    for (const row of args) {
      const context = tables[1].find(slice => slice.id === row.slice_id);
      assert.equal(row.name, context.name); assert.equal(row.arg_set_id, context.arg_set_id);
      assert.equal(row.arg_present, [5n,6n,8n].includes(row.slice_id) ? 0n : 1n);
      for (const key of ['flat_key','key','value_type','int_value','string_value','real_value']) assert.equal(row[`${key}_is_null`], row[key] === null ? 1n : 0n, `${row.slice_id}: ${key}`);
    }
    assert.deepEqual(args.filter(r => r.name === 'PipelineReporter').map(r => [r.slice_id,r.arg_present,r.flat_key]), [[7n,1n,null],[8n,0n,null]]);
    assert.deepEqual(args.filter(r => r.slice_id === 9n).map(r => [r.key,r.real_value,r.int_value]), [['nullable',null,null],['real',1.25,null],['unsigned',null,9007199254740995n]]);
    assert.equal(args.find(r => r.slice_id === 10n).string_value, 'loader');
    const groups = tables[3];
    assert.deepEqual(groups.map(r => [r.name,r.flat_key,r.key,r.value_type,r.arg_occurrence_count,r.slice_count]), [
      ['BeginFrame',null,null,null,0n,1n],
      ['FrameCommittedInBrowser','empty','empty','string',1n,1n],
      ['FrameCommittedInBrowser','literal','literal','string',1n,1n],
      ['Graphics.Pipeline',null,'nullable',null,1n,1n],
      ['Graphics.Pipeline','real','real','real',1n,1n],
      ['Graphics.Pipeline','unsigned','unsigned','uint',1n,1n],
      ['PipelineReporter',null,null,null,1n,2n],
      ['ProcessReadyInBrowser',null,null,null,0n,1n],
      ['SetLayerTreeId','debug.data.frame','debug.data.frame','string',2n,2n],
      ['SetLayerTreeId','debug.data.layerTreeId','debug.data.layerTreeId','int',4n,2n],
      ['SetLayerTreeId','debug.data.layerTreeId','debug.data.layerTreeId','string',2n,2n],
      ['TracingStartedInBrowser','debug.data.frames.frame','debug.data.frames[0].frame','string',1n,1n],
      ['TracingStartedInBrowser','debug.data.frames.frame','debug.data.frames[1].frame','string',1n,1n],
      ['TracingStartedInBrowser','debug.data.frames.processId','debug.data.frames[0].processId','int',1n,1n],
      ['TracingStartedInBrowser','debug.data.frames.processId','debug.data.frames[1].processId','int',1n,1n],
      ["begin'quoted",'debug.data.navigationId','debug.data.navigationId','string',1n,1n],
    ]);
    for (const row of groups) for (const key of ['flat_key','key','value_type']) assert.equal(row[`${key}_is_null`], row[key] === null ? 1n : 0n);
    assert.deepEqual(tables[4], [{name:'a',idx:0n,severity:'info',source:'analysis',value:-1n},{name:'z',idx:1n,severity:'error',source:'trace',value:7n}]);
    assert.deepEqual(tables[5], [{start_ts:1n,end_ts:8n},{start_ts:9n,end_ts:20n}]);
    assert.deepEqual(tables[6], [{surface_frame_trace_id:43n,display_trace_id:58n},{surface_frame_trace_id:43n,display_trace_id:58n},{surface_frame_trace_id:44n,display_trace_id:59n}]);
    db.exec("INSERT INTO slice VALUES(12,12,0,'FrameDeletedInBrowser',NULL,NULL)");
    assert.deepEqual(read(selectStatements[0]).find(r => r.name === 'FrameDeletedInBrowser'), {name:'FrameDeletedInBrowser',event_count:1n,arg_set_count:0n});
    assert.equal(read(selectStatements[1]).filter(r => r.name === 'FrameDeletedInBrowser').length, 1);
    assert.equal(read(selectStatements[2]).find(r => r.name === 'FrameDeletedInBrowser').arg_present, 0n);
  } finally { db.close(); }
});

test('target inventory final text projections compensate pinned CSV wrapping without changing raw facts', async () => {
  const sql = await readFile(new URL('./target-inventory.sql', import.meta.url), 'utf8');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id, ts, dur, name, track_id, arg_set_id);
      CREATE TABLE track(id, name);
      CREATE TABLE thread_or_process_slice(id, utid, tid, upid, pid, process_name, thread_name);
      CREATE TABLE args(arg_set_id, flat_key, key, value_type, int_value, string_value, real_value);
      CREATE TABLE stats(name, idx, severity, source, value);
      CREATE TABLE trace_bounds(start_ts, end_ts);
      CREATE TABLE chrome_surface_frame_id_to_first_display_id(surface_frame_trace_id, display_trace_id);
      INSERT INTO slice VALUES(1,1,0,'SetLayerTreeId',1,100),(2,2,0,'SetLayerTreeId',1,100);
      INSERT INTO track VALUES(1,'track"name');
      INSERT INTO thread_or_process_slice VALUES(1,1,2,3,4,'process",name','thread"name');
      INSERT INTO args VALUES(100,'flat"key','key",0','string"type',NULL,'left",right',NULL),
        (100,'flat"key','key",0','string"type',NULL,'left",right',NULL),
        (100,NULL,NULL,NULL,NULL,NULL,NULL),
        (100,'integer','integer','uint',9007199254740993,NULL,NULL);
      INSERT INTO stats VALUES('stat"z',2,'severity"quoted','source",quoted',7),
        ('stat"a',1,NULL,NULL,-1),('zero"stat',0,'info','trace',0);
      INSERT INTO trace_bounds VALUES(1,3);
      INSERT INTO chrome_surface_frame_id_to_first_display_id VALUES(43,58);
    `);
    const quotedPhase = 'phase",name';
    db.prepare('INSERT INTO slice VALUES(3,3,0,?,NULL,101)').run(quotedPhase);
    // Expected cells and wire forms follow RFC-style quote doubling independently
    // of the SQL implementation; the pinned formatter only wraps text cells.
    const textCases = [
      ['left",right', 'left"",right', '"left"",right"'],
      [',', ',', '","'],
      ['"quoted"', '""quoted""', '"""quoted"""'],
      ['é🧪', 'é🧪', '"é🧪"'],
      ['line\nfeed', 'line\nfeed', '"line\nfeed"'],
      ['cr\r\nlf', 'cr\r\nlf', '"cr\r\nlf"'],
      ['blank\n\nline', 'blank\n\nline', '"blank\n\nline"'],
      ['', '', '""'],
      ['[NULL]', '[NULL]', '"[NULL]"'],
    ];
    const insertArg = db.prepare('INSERT INTO args VALUES(101,?,?,?,?,?,NULL)');
    textCases.forEach(([raw], index) => insertArg.run('value', `value[${index}]`, 'string', null, raw));
    const statements = sql.replace(/--[^\n]*/g, '').replace(/INCLUDE PERFETTO MODULE chrome\.graphics_pipeline;/, '')
      .replace(/CREATE PERFETTO VIEW/g, 'CREATE VIEW').replace('__PHASE_LITERALS__', "'phase\",name', 'absent'").split(';').filter(s => s.trim());
    const tables = [];
    for (const query of statements) {
      if (/^\s*CREATE\s+VIEW/i.test(query)) db.exec(query);
      else {
        const statement = db.prepare(query); statement.setReadBigInts(true);
        tables.push(statement.all().map(row => ({ ...row })));
      }
    }
    assert.equal(tables.length, 7);
    assert.deepEqual(tables[0].find(row => row.name === 'SetLayerTreeId'), {name:'SetLayerTreeId',event_count:2n,arg_set_count:1n});
    const context = tables[1][0];
    assert.deepEqual([context.track_name,context.process_name,context.thread_name], ['track""name','process"",name','thread""name']);
    assert.deepEqual([context.track_name_is_null,context.process_name_is_null,context.thread_name_is_null], [0n,0n,0n]);
    assert.equal(tables[1][2].name, 'phase"",name');
    assert.equal(tables[1][2].track_name, null); assert.equal(tables[1][2].track_name_is_null, 1n);
    const quotedArgs = tables[2].filter(row => row.key === 'key"",0');
    assert.equal(quotedArgs.length, 4, 'two identical arguments fan out for both original slices');
    quotedArgs.forEach(row => assert.deepEqual([row.flat_key,row.key,row.value_type,row.string_value], ['flat""key','key"",0','string""type','left"",right']));
    const phaseArgs = tables[2].filter(row => row.slice_id === 3n);
    assert.equal(phaseArgs.length, textCases.length);
    // Model precisely the fixed renderer's string wrapping, not a CSV parser.
    const wrapped = value => `"${value}"`;
    textCases.forEach(([raw, projected, wire], index) => {
      const row = phaseArgs[index];
      assert.equal(row.name, 'phase"",name'); assert.equal(row.string_value, projected, raw);
      assert.equal(wrapped(row.string_value), wire, raw);
      assert.equal(row.string_value_is_null, 0n, raw);
    });
    const nullArg = tables[2].find(row => row.slice_id === 1n && row.key === null);
    assert.equal(nullArg.arg_present, 1n); assert.equal(nullArg.string_value, null); assert.equal(nullArg.string_value_is_null, 1n);
    const integer = tables[2].find(row => row.key === 'integer');
    assert.equal(integer.int_value, 9007199254740993n); assert.equal(typeof integer.int_value, 'bigint');
    assert.deepEqual(tables[3].find(row => row.key === 'key"",0'), {
      name:'SetLayerTreeId',flat_key:'flat""key',key:'key"",0',value_type:'string""type',
      arg_occurrence_count:4n,slice_count:2n,flat_key_is_null:0n,key_is_null:0n,value_type_is_null:0n,
    });
    assert.equal(tables[3].filter(row => row.name === 'phase"",name').length, textCases.length);
    assert.deepEqual(tables[4], [
      {name:'stat""a',idx:1n,severity:null,source:null,value:-1n},
      {name:'stat""z',idx:2n,severity:'severity""quoted',source:'source"",quoted',value:7n},
    ]);
    // Presentation must never replace the original scope, grouping or sort keys.
    const rawPhase = db.prepare('SELECT name FROM slice WHERE id = 3').get().name;
    assert.equal(rawPhase, quotedPhase);
    const groups = statements.find(statement => /arg_occurrence_count/.test(statement));
    assert.match(groups, /GROUP BY s\.name, a\.flat_key, a\.key, a\.value_type/);
    assert.match(groups, /ORDER BY s\.name, a\.flat_key, a\.key, a\.value_type/);
    const stats = statements.find(statement => /FROM stats/.test(statement));
    assert.match(stats, /WHERE st\.value != 0 ORDER BY st\.name, st\.idx/);
  } finally { db.close(); }
});

// Independent oracle: original projections from reviewed 6e888e3455b2af48184a0a825c4fb02214350065.
const originalScopeArguments = "SELECT s.id AS slice_id, REPLACE(s.name, '\"', '\"\"') AS name, s.arg_set_id,\n  a.arg_set_id IS NOT NULL AS arg_present,\n  REPLACE(a.flat_key, '\"', '\"\"') AS flat_key,\n  REPLACE(a.key, '\"', '\"\"') AS key,\n  REPLACE(a.value_type, '\"', '\"\"') AS value_type,\n  a.int_value, REPLACE(a.string_value, '\"', '\"\"') AS string_value, a.real_value,\n  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null,\n  a.value_type IS NULL AS value_type_is_null,\n  a.int_value IS NULL AS int_value_is_null,\n  a.string_value IS NULL AS string_value_is_null,\n  a.real_value IS NULL AS real_value_is_null\nFROM _scope_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id\nORDER BY s.ts, s.id, a.flat_key, a.key, a.value_type,\n  a.int_value, a.string_value, a.real_value;";
const originalScopeGroups = "SELECT REPLACE(s.name, '\"', '\"\"') AS name,\n  REPLACE(a.flat_key, '\"', '\"\"') AS flat_key,\n  REPLACE(a.key, '\"', '\"\"') AS key,\n  REPLACE(a.value_type, '\"', '\"\"') AS value_type,\n  COUNT(a.arg_set_id) AS arg_occurrence_count, COUNT(DISTINCT s.id) AS slice_count,\n  a.flat_key IS NULL AS flat_key_is_null, a.key IS NULL AS key_is_null,\n  a.value_type IS NULL AS value_type_is_null\nFROM _scope_inventory_selected s LEFT JOIN args a ON a.arg_set_id = s.arg_set_id\nGROUP BY s.name, a.flat_key, a.key, a.value_type\nORDER BY s.name, a.flat_key, a.key, a.value_type;";
const scopeSchemas = [
  'name,event_count,arg_set_count',
  'id,ts,dur,depth,parent_id,is_selected,name,category,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,parent_status,duration_status,parent_id_is_null,name_is_null,category_is_null,track_name_is_null,process_name_is_null,thread_name_is_null',
  'slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null',
  'arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
  'name,idx,severity,source,value,name_is_null,severity_is_null,source_is_null', 'start_ts,end_ts',
];
test('scope SQL exports complete distinct cycle-safe ancestry and selected-only multiplicity without inferred relationships', async () => {
  const sql = await readFile(new URL('./scope-inventory.sql', import.meta.url), 'utf8');
  assert.equal(sql.split('__PHASE_LITERALS__').length - 1, 1);
  assert.match(sql, /WITH RECURSIVE context_ids\(id\)/);
  assert.doesNotMatch(sql, /\bUNION ALL\b|\bLIMIT\b|\bLIKE\b|\b(?:fps|qualification|scoring)\b/i);
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id,ts,dur,depth,parent_id,name,category,track_id,arg_set_id);
      CREATE TABLE track(id,name);
      CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
      CREATE TABLE args(arg_set_id,flat_key,key,value_type,int_value,string_value,real_value);
      CREATE TABLE stats(name,idx,severity,source,value);
      CREATE TABLE trace_bounds(start_ts,end_ts);
      INSERT INTO slice VALUES
        (1,1,100,0,NULL,NULL,NULL,1,500),
        (2,2,90,3,1,'ancestor','',1,501),
        (3,3,80,7,2,'MainFrame.Draw','cat',1,100),
        (4,4,0,8,3,'Graphics.Pipeline','cat',1,101),
        (5,5,0,8,3,'Graphics.Pipeline','cat',1,101),
        (6,6,0,8,3,'unrelated sibling','cat',1,101),
        (7,7,-1,12,888,'DrawFrame',NULL,2,NULL),
        (8,8,-2,50,9,'Scheduler::BeginFrame',NULL,2,102),
        (9,9,0,2,8,'cycle context',NULL,1,500),
        (10,10,0,9,10,'Scheduler::BeginImplFrame',NULL,NULL,NULL),
        (11,11,0,20,2,'phase',NULL,2,103),
        (12,12,0,1,NULL,'unrelated root',NULL,2,500),
        (13,9007199254740993,0,9,NULL,'Graphics.Pipeline','[NULL]',2,104);
      INSERT INTO track VALUES(1,'track"name'),(2,'');
      INSERT INTO thread_or_process_slice VALUES(3,1,2,3,4,'process",name','thread"name');
      INSERT INTO args VALUES
        (500,'ancestor-only','ancestor-only','string',NULL,'excluded',NULL),
        (501,'ancestor-only2','ancestor-only2','int',7,NULL,NULL),
        (100,NULL,NULL,NULL,NULL,NULL,NULL),
        (101,'dup"key','dup"key','uint',9007199254740995,NULL,NULL),
        (101,'dup"key','dup"key','uint',9007199254740995,NULL,NULL),
        (102,'empty','empty','string',NULL,'',NULL),
        (102,'literal','literal','string',NULL,'[NULL]',NULL),
        (104,'real','real','real',NULL,NULL,1.25);
      INSERT INTO stats VALUES(NULL,NULL,NULL,NULL,-1),('stat"z',1,'severity"quoted','source",quoted',7),('zero',0,'info','trace',0);
      INSERT INTO trace_bounds VALUES(9,20),(1,8);
    `);
    const textCases = ['left",right', ',', '"quoted"', 'é🧪', 'line\nfeed', 'cr\r\nlf', 'blank\n\nline', '', '[NULL]'];
    const insert = db.prepare('INSERT INTO args VALUES(103,?,?,?,?,?,NULL)');
    textCases.forEach((s,i) => insert.run('value',`value[${i}]`,'string',null,s));
    const tables = [], queries = [];
    for (const statement of sql.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE chrome.graphics_pipeline;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').replace('__PHASE_LITERALS__',"'phase', 'Graphics.Pipeline'").split(';').filter(s=>s.trim())) {
      if (/^\s*CREATE VIEW/i.test(statement)) db.exec(statement);
      else { const q=db.prepare(statement); q.setReadBigInts(true); tables.push(q.all().map(r=>({...r}))); queries.push(statement); }
    }
    assert.deepEqual([0,1,4,5].map(i=>hash(queries[i])),["96651c13594fbe1df51c724525f7f6e039602268f68825e134c83eadcb0bf271", "8c08c7de23ef5f4530d9f977ad78c905d64d55710d2e48f23c9a1e9e35544514", "c708bc16f26425e142b1e2b8e3a5d29d8355d7fcad3c74a3f6d22a95613c61ff", "8ddb578cf244e662b29df7046adb5352119e55caf25be4d8fa945cad852fcc39"],'unchanged scope table 1/2/5/6 statements from 6e888e3');
    assert.equal(tables.length,6); tables.forEach((rows,i)=>assert.equal(Object.keys(rows[0]).join(','),scopeSchemas[i]));
    const [counts,nodes,compact,dictionary,stats,bounds] = tables;
    const args=smoke.reconstructScopeArguments(compact,dictionary);
    const groups=dictionary.map(({arg_key_id,...r})=>r);
    const read=query=>{const q=db.prepare(query); q.setReadBigInts(true); return q.all().map(r=>({...r}));};
    assert.deepEqual(args,read(originalScopeArguments));
    assert.deepEqual(groups,read(originalScopeGroups));
    assert.equal(compact.length,args.length);
    assert.equal(new Set(compact.map(r=>r.arg_key_id)).size,dictionary.length);
    assert.ok(compact.length>dictionary.length,'duplicate and shared-set references remain repeated');
    assert.throws(()=>smoke.reconstructScopeArguments(compact,[...dictionary,dictionary[0]]),/duplicate/);
    assert.throws(()=>smoke.reconstructScopeArguments(compact,dictionary.slice(1)),/missing/);
    const mapping=dictionary.map(r=>[r.arg_key_id,r.name,r.flat_key,r.key,r.value_type]);
    db.exec('CREATE TEMP TABLE reversed AS SELECT * FROM args ORDER BY rowid DESC; DELETE FROM args; INSERT INTO args SELECT * FROM reversed');
    assert.deepEqual(read(queries[3]).map(r=>[r.arg_key_id,r.name,r.flat_key,r.key,r.value_type]),mapping);
    assert.deepEqual(counts.map(r=>[r.name,r.event_count,r.arg_set_count]),[['DrawFrame',1n,0n],['Graphics.Pipeline',3n,2n],['MainFrame.Draw',1n,1n],['Scheduler::BeginFrame',1n,1n],['Scheduler::BeginImplFrame',1n,0n]]);
    assert.deepEqual(nodes.map(r=>r.id),[1n,2n,3n,4n,5n,7n,8n,9n,10n,11n,13n]);
    assert.equal(new Set(nodes.map(r=>r.id)).size,nodes.length);
    assert.deepEqual(nodes.filter(r=>r.is_selected===0n).map(r=>r.id),[1n,2n,9n]);
    assert.deepEqual(nodes.map(r=>[r.parent_id,r.depth,r.parent_status]),[[null,0n,'no_parent'],[1n,3n,'parent_present'],[2n,7n,'parent_present'],[3n,8n,'parent_present'],[3n,8n,'parent_present'],[888n,12n,'missing_parent'],[9n,50n,'parent_present'],[8n,2n,'parent_present'],[10n,9n,'parent_present'],[2n,20n,'parent_present'],[null,9n,'no_parent']]);
    assert.equal(nodes.find(r=>r.id===7n).duration_status,'unclosed'); assert.equal(nodes.find(r=>r.id===8n).duration_status,'other_negative');
    assert.equal(nodes.at(-1).ts,9007199254740993n);
    assert.equal(nodes[0].arg_set_id,500n); assert.equal(nodes[1].arg_set_id,501n);
    for (const r of nodes) for (const key of ['parent_id','name','category','track_name','process_name','thread_name']) assert.equal(r[`${key}_is_null`],r[key]===null?1n:0n,key);
    assert.deepEqual([nodes[2].track_name,nodes[2].process_name,nodes[2].thread_name],['track""name','process"",name','thread""name']);
    assert.equal(args.some(r=>r.key?.startsWith('ancestor')),false); assert.equal(groups.some(r=>r.key?.startsWith('ancestor')),false);
    assert.deepEqual(args.filter(r=>r.key==='dup""key').map(r=>[r.slice_id,r.int_value]),[[4n,9007199254740995n],[4n,9007199254740995n],[5n,9007199254740995n],[5n,9007199254740995n]]);
    assert.deepEqual(groups.find(r=>r.key==='dup""key'),{name:'Graphics.Pipeline',flat_key:'dup""key',key:'dup""key',value_type:'uint',arg_occurrence_count:4n,slice_count:2n,flat_key_is_null:0n,key_is_null:0n,value_type_is_null:0n});
    assert.equal(args.find(r=>r.slice_id===3n).arg_present,1n); assert.equal(args.find(r=>r.slice_id===7n).arg_present,0n);
    assert.equal(groups.find(r=>r.name==='MainFrame.Draw').arg_occurrence_count,1n); assert.equal(groups.find(r=>r.name==='DrawFrame').arg_occurrence_count,0n);
    assert.deepEqual(args.filter(r=>r.slice_id===11n).map(r=>r.string_value),textCases.map(s=>s.replaceAll('"','""')));
    for (const r of args) for (const key of ['flat_key','key','value_type','int_value','string_value','real_value']) assert.equal(r[`${key}_is_null`],r[key]===null?1n:0n,key);
    assert.deepEqual(stats,[{name:null,idx:null,severity:null,source:null,value:-1n,name_is_null:1n,severity_is_null:1n,source_is_null:1n},{name:'stat""z',idx:1n,severity:'severity""quoted',source:'source"",quoted',value:7n,name_is_null:0n,severity_is_null:0n,source_is_null:0n}]);
    assert.deepEqual(bounds,[{start_ts:1n,end_ts:8n},{start_ts:9n,end_ts:20n}]);
    db.exec(`INSERT INTO slice VALUES(14,14,0,0,NULL,'MainFrame.Draw',NULL,1,NULL),(15,15,0,0,NULL,'DrawFrame',NULL,1,100);
      INSERT INTO args VALUES
      (104,'','', 'int',-9007199254740993,NULL,NULL),
      (104,'[NULL]','[NULL]','string',NULL,'[NULL]',NULL),
      (104,'real','real','int',9007199254740997,NULL,NULL),
      (104,NULL,'',NULL,NULL,NULL,NULL),
      (104,'',NULL,'',NULL,NULL,NULL),
      (104,'[NULL]','[NULL]','[NULL]',NULL,'',NULL),
      (104,'é🧪','quote"key','string',NULL,'cr'||char(13)||char(10)||'lf',NULL);`);
    const moreDictionary=read(queries[3]);
    assert.deepEqual(smoke.reconstructScopeArguments(read(queries[2]),moreDictionary),read(originalScopeArguments));
    assert.deepEqual(moreDictionary.map(({arg_key_id,...r})=>r),read(originalScopeGroups));
    const merged=moreDictionary.find(r=>r.name==='MainFrame.Draw' && r.key===null);
    assert.equal(merged.arg_occurrence_count,1n); assert.equal(merged.slice_count,2n);
    const adversarialMapping=moreDictionary.map(r=>[r.arg_key_id,r.name,r.flat_key,r.key,r.value_type]);
    db.exec('DELETE FROM reversed; INSERT INTO reversed SELECT * FROM args ORDER BY rowid DESC; DELETE FROM args; INSERT INTO args SELECT * FROM reversed');
    assert.deepEqual(read(queries[3]).map(r=>[r.arg_key_id,r.name,r.flat_key,r.key,r.value_type]),adversarialMapping);
    db.exec('DELETE FROM slice');
    assert.deepEqual(read(queries[2]),[]); assert.deepEqual(read(queries[3]),[]);
    assert.deepEqual(smoke.reconstructScopeArguments([],[]),[]);
    db.exec("INSERT INTO slice VALUES(3,3,80,7,2,'MainFrame.Draw','cat',1,100),(4,4,0,8,3,'Graphics.Pipeline','cat',1,101)");
    const q=db.prepare(queries[0]); q.setReadBigInts(true);
    assert.deepEqual(q.all().map(r=>[r.name,r.event_count]).filter(r=>r[1]===0n),[['DrawFrame',0n],['Scheduler::BeginFrame',0n],['Scheduler::BeginImplFrame',0n]]);
  } finally { db.close(); }
});

test('scope smoke fixture is independent, deterministic and import-inert', async () => {
  assert.equal(typeof smoke.authoredScopeFixture, 'function');
  const bytes=smoke.authoredScopeFixture();
  assert.ok(Buffer.isBuffer(bytes)); assert.deepEqual(bytes,smoke.authoredScopeFixture());
  assert.equal(bytes.length,1927);
  assert.equal(hash(bytes),'8e5fa01db67d7c2ea70f955d86ba8d36f333a850bee964b275d621e173d84726');
  assert.deepEqual([smoke.authoredClockFixture().length,smoke.authoredGraphicsFixture().length,smoke.authoredTargetFixture().length],[153,308,1238]);
  assert.equal(hash(smoke.authoredTargetFixture()),'ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0');
});

test('scope library and smoke imports perform no input reads, writes or process launches', async () => {
  const source = `
    import fs from 'node:fs/promises';
    import child from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const forbidden = () => { throw new Error('import side effect'); };
    for (const key of ['open','lstat','mkdir','readFile','writeFile']) fs[key] = forbidden;
    child.spawn = forbidden;
    syncBuiltinESMExports();
    const run = await import(${JSON.stringify(new URL('./run.mjs',import.meta.url).href)});
    const smoke = await import(${JSON.stringify(new URL('./smoke.mjs',import.meta.url).href)});
    if (typeof run.runScopeInventoryDiagnostic !== 'function' || typeof smoke.authoredScopeFixture !== 'function') throw new Error('missing exports');
    process.stdout.write('inert\\n');
  `;
  const result = await execFile(process.execPath,['--input-type=module','-e',source]);
  assert.equal(result.stdout,'inert\n'); assert.equal(result.stderr,'');
});

test('scope final text projections retain all nullable text flags and raw quoted grouping keys', async () => {
  const sql = await readFile(new URL('./scope-inventory.sql',import.meta.url),'utf8');
  const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE slice(id,ts,dur,depth,parent_id,name,category,track_id,arg_set_id);
      CREATE TABLE track(id,name);
      CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
      CREATE TABLE args(arg_set_id,flat_key,key,value_type,int_value,string_value,real_value);
      CREATE TABLE stats(name,idx,severity,source,value);
      CREATE TABLE trace_bounds(start_ts,end_ts);
      INSERT INTO slice VALUES(1,1,0,0,NULL,'phase"name','category"name',1,100);
      INSERT INTO track VALUES(1,'track"name');
      INSERT INTO thread_or_process_slice VALUES(1,1,2,3,4,'process"name','thread"name');
      INSERT INTO args VALUES(100,'flat"key','key"name','type"name',NULL,'value"name',NULL);
      INSERT INTO stats VALUES('stat"name',0,'severity"name','source"name',1);
      INSERT INTO trace_bounds VALUES(1,1);
    `);
    const tables=[];
    for (const statement of sql.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE chrome.graphics_pipeline;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').replace('__PHASE_LITERALS__',"'phase\"name', 'absent'").split(';').filter(s=>s.trim())) {
      if (/^\s*CREATE VIEW/i.test(statement)) db.exec(statement);
      else tables.push(db.prepare(statement).all().map(r=>({...r})));
    }
    for (const [index,fields] of [[1,['name','category','track_name','process_name','thread_name']],[2,['string_value']],[3,['name','flat_key','key','value_type']],[4,['name','severity','source']]]) {
      for (const key of fields) {
        assert.ok(tables[index][0][key].includes('""'),key);
        if (Object.hasOwn(tables[index][0],`${key}_is_null`)) assert.equal(tables[index][0][`${key}_is_null`],0,key);
      }
    }
    assert.equal(tables[3][0].arg_occurrence_count,1); assert.equal(tables[3][0].slice_count,1);
    assert.equal(db.prepare('SELECT name FROM slice').get().name,'phase"name');
    assert.match(sql,/GROUP BY s\.name, a\.flat_key, a\.key, a\.value_type/);
    assert.match(sql,/ORDER BY arg_key_id/);
  } finally { db.close(); }
});


test('compact reconstruction preserves exact large string IDs and repeated references, rejecting malformed dictionaries', () => {
  const row={arg_key_id:'9007199254740993',slice_id:'1',arg_set_id:'2',arg_present:'1'};
  const other={arg_key_id:'9007199254740992',name:'other'};
  const dictionary=[{arg_key_id:row.arg_key_id,name:'exact'},other];
  assert.deepEqual(smoke.reconstructScopeArguments([row,row],dictionary).map(r=>r.name),['exact','exact']);
  assert.throws(()=>smoke.reconstructScopeArguments([row],[other]),/missing/);
  assert.throws(()=>smoke.reconstructScopeArguments([],dictionary.concat(dictionary[0])),/duplicate/);
});
