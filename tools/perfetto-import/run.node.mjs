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
async function fixture(body = `process.stdout.write('rows\\n');`) {
  const root = await mkdtemp(join(tmpdir(), 'perfetto-import-test-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';\nif(process.argv.includes('--version')) { process.stdout.write(${JSON.stringify(version)}); } else { ${body} }\n`;
  await writeFile(join(root, 'processor.mjs'), source); await chmod(join(root, 'processor.mjs'), 0o700);
  await writeFile(join(root, 'trace'), trace);
  return { root, options: { trace: { path: join(root, 'trace'), bytes: trace.length, sha256: hash(trace) }, processor: { path: join(root, 'processor.mjs'), sha256: hash(source) }, phases: ["begin'quoted", 'end'], out: join(root, 'out') } };
}
test('library exists and imports without running a diagnostic', () => assert.equal(typeof module.runDiagnostic, 'function'));
test('production full and inventory reject the former official platform pin before launch', async () => {
  const formerPins = {
    'darwin-arm64': 'd29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa',
    'linux-x64': '58042408e6cc861fb1a731c26bb082dc222285561eaa4e12a48a8b2b90dca7b9',
  };
  const formerPin = formerPins[`${process.platform}-${process.arch}`];
  assert.ok(formerPin, 'this control requires a supported runtime platform');
  for (const run of [module.runDiagnostic, module.runInventoryDiagnostic]) {
    const { options } = await fixture();
    options.processor.sha256 = formerPin;
    const result = await run(options);
    assert.equal(result.status, 'failure'); assert.match(result.error, /platform pin/);
    assert.deepEqual(result.processes, {});
  }
});
test('authored full and inventory reject complete former version after normal version exit before query', async () => {
  const formerVersion = 'Perfetto v58.2-add693d8b (add693d8b338ba9599dbcbc3e300b1ab8c000897)\nTrace Processor RPC API version: 14\n';
  for (const run of [module.runAuthoredFixtureDiagnostic, module.runAuthoredFixtureInventoryDiagnostic]) {
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
