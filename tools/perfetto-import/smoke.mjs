import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runDiagnostic, runInventoryDiagnostic } from './run.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const concat = (...parts) => Buffer.concat(parts);
const varint = value => {
  const bytes = [];
  do { const byte = Number(value & 127n); value >>= 7n; bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
};
const uint = (field, value) => concat(varint(BigInt(field) * 8n), varint(value));
const body = (field, bytes) => concat(varint(BigInt(field) * 8n + 2n), varint(BigInt(bytes.length)), bytes);
const text = (field, value) => body(field, Buffer.from(value));

// Pure authored protobuf fixture, never a captured trace or performance sample.
export function authoredClockFixture() {
  const clock = (id, ts, unit) => body(1, concat(uint(1, id), uint(2, ts), uint(3, 0n), uint(4, unit)));
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const mark = (name, ts) => packet(uint(8, ts), uint(58, 64n), body(11, concat(uint(9, 3n), uint(11, 7n), text(22, 'blink.user_timing'), text(23, name))));
  return concat(
    packet(uint(13, 1n), body(6, concat(clock(6n, 1000000n, 1n), clock(64n, 1000n, 1000n), uint(2, 6n)))),
    packet(body(60, concat(uint(1, 7n), body(4, concat(uint(1, 1n), uint(2, 1n)))))),
    mark('authored-start', 1001n), mark('authored-end', 1021n));
}

// Correct v58.2 schema: Graphics.Pipeline surface_frame_trace_id is field 10.
// Field 2 is a FrameSinkId message and is deliberately not used here.
export function authoredGraphicsFixture() {
  const event = (name, ts, extra) => body(1, concat(uint(10, 1n), uint(8, ts), uint(58, 64n), body(11, concat(uint(9, 3n), uint(11, 7n), text(22, 'cc'), text(23, name), extra))));
  return concat(authoredClockFixture(),
    event('Graphics.Pipeline', 1022n, body(1052, concat(uint(1, 2n), uint(10, 43n)))),
    event('Graphics.Pipeline', 1023n, body(1052, concat(uint(1, 10n), uint(3, 58n), uint(8, 43n)))),
    event('PipelineReporter', 1024n, body(1075, concat(uint(1, 1n), uint(3, 1n), uint(4, 2n), uint(11, 17n), uint(17, 43n), uint(18, 58n)))));
}

function requireSuccessfulDiagnostic(result) {
  assert.equal(result.status, 'success', result.error);
  assert.equal(result.officialProcessor, true); assert.equal(result.authoredFixture, false);
  assert.equal(result.nativeSupported, false); assert.equal(result.fps, null); assert.equal(result.duration, null); assert.equal(result.scoring, false);
  for (const name of ['version', 'query']) {
    const proc = result.processes[name]; assert.equal(proc.code, 0); assert.equal(proc.signal, null); assert.equal(proc.closed, true); assert.equal(proc.error, null);
    for (const state of Object.values(proc.streams)) { assert.equal(state.eof, true); assert.equal(state.closed, true); assert.equal(state.forcedDestroy, false); assert.equal(state.error, null); }
  }
}

export async function runSmoke({ processor, out }) {
  if (![processor, out].every(p => typeof p === 'string' && isAbsolute(p) && resolve(p) === p)) throw new Error('normalized absolute processor and fresh output paths required');
  await mkdir(out, { mode: 0o700 });
  const summary = { status: 'failure', authoredOnly: true, nativeSupported: false, fps: null, duration: null, scoring: false };
  try {
    const bytes = authoredClockFixture();
    assert.equal(bytes.length, 153);
    assert.equal(digest(bytes), '177a183ab43040d16379243c2185cf324a2e49edd8ab1c9d17034b9276f3199d');
    const path = join(out, 'authored-clock-fixture.pftrace');
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    const result = await runDiagnostic({ trace: { path, bytes: bytes.length, sha256: digest(bytes) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: ['authored-start', 'authored-end'], out: join(out, 'diagnostic') });
    requireSuccessfulDiagnostic(result);
    const csv = await readFile(join(out, 'diagnostic', 'query.stdout'), 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    assert.equal(lines.filter(line => line.includes('"authored-start"') || line.includes('"authored-end"')).length, 2);
    assert.ok(lines.some(line => /^\d+,1001000,0,"authored-start",\d+,/.test(line)), 'expected authored start timestamp');
    assert.ok(lines.some(line => /^\d+,1021000,0,"authored-end",\d+,/.test(line)), 'expected authored end timestamp');
    assert.ok(lines.includes('1001000,1021000'), 'expected authored trace bounds');
    assert.ok(lines.includes('"Graphics.Pipeline",0'), 'expected zero authored graphics pipeline events');
    for (const inventory of ['surface_frame_steps', 'display_frame_steps', 'surface_first_display_mapping', 'surface_without_first_display_mapping', 'surface_steps_without_surface_id']) {
      assert.ok(lines.includes(`"${inventory}",0`), `expected zero authored ${inventory}`);
    }
    for (const header of [
      '"id","ts","dur","name","track_id","track_name","utid","tid","upid","pid","process_name","thread_name"',
      '"id","ts","dur","step","surface_frame_trace_id","utid","task_start_time_ts"',
      '"id","ts","dur","step","display_trace_id","utid","task_start_time_ts"',
      '"surface_frame_trace_id","display_trace_id"',
      '"id","ts","dur","name","track_id","arg_set_id","utid","tid","upid","pid","process_name","thread_name"',
      '"slice_id","name","arg_set_id","flat_key","key","value_type","int_value","string_value","real_value"',
    ]) assert.ok(lines.includes(header), `expected full export schema ${header}`);
    const graphics = authoredGraphicsFixture();
    assert.equal(graphics.length, 308);
    assert.equal(digest(graphics), '2060e02191ec0f00325e024007de9080ab4224467d325e80c2261a28e1b8c542');
    const graphicsPath = join(out, 'authored-graphics-fixture-v2.pftrace');
    await writeFile(graphicsPath, graphics, { flag: 'wx', mode: 0o600 });
    const graphicsResult = await runDiagnostic({ trace: { path: graphicsPath, bytes: graphics.length, sha256: digest(graphics) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: ['authored-start', 'authored-end'], out: join(out, 'graphics-diagnostic') });
    requireSuccessfulDiagnostic(graphicsResult);
    const graphicsLines = (await readFile(join(out, 'graphics-diagnostic', 'query.stdout'), 'utf8')).trim().split(/\r?\n/);
    for (const row of [
      '"Graphics.Pipeline",2', '"PipelineReporter",1',
      '"surface_frame_steps",1', '"display_frame_steps",1', '"surface_first_display_mapping",1',
      '"surface_without_first_display_mapping",0', '"surface_steps_without_surface_id",0',
      '"surface_frame_steps","STEP_GENERATE_COMPOSITOR_FRAME",1',
      '"display_frame_steps","STEP_SURFACE_AGGREGATION",1',
      '2,1022000,0,"STEP_GENERATE_COMPOSITOR_FRAME",43,1,"[NULL]"',
      '3,1023000,0,"STEP_SURFACE_AGGREGATION",58,1,"[NULL]"',
      '43,58', '1001000,1024000',
    ]) assert.ok(graphicsLines.includes(row), `expected authored graphics row ${row}`);
    for (const [id, ts, name] of [[2, 1022000, 'Graphics.Pipeline'], [3, 1023000, 'Graphics.Pipeline'], [4, 1024000, 'PipelineReporter']]) {
      assert.ok(graphicsLines.some(line => line.startsWith(`${id},${ts},0,"${name}",0,`) && /,\d+,1,1,1,1,"\[NULL\]","\[NULL\]"$/.test(line)), `expected raw authored slice with thread/process context ${id}`);
    }
    for (const [key, type, value] of [
      ['display_trace_id', 'int', 58], ['surface_frame_trace_id', 'int', 43],
      ['frame_sequence', 'uint', 2], ['frame_source', 'uint', 1], ['layer_tree_host_id', 'uint', 17],
    ]) {
      const suffix = `,"frame_reporter.${key}","frame_reporter.${key}","${type}",${value},"[NULL]","[NULL]"`;
      assert.ok(graphicsLines.some(line => line.startsWith('4,"PipelineReporter",') && line.endsWith(suffix)), `expected authored reporter argument ${key}`);
    }
    assert.ok(graphicsLines.some(line => line.startsWith('4,"PipelineReporter",') && line.endsWith(',"frame_reporter.state","frame_reporter.state","string","[NULL]","STATE_PRESENTED_ALL","[NULL]"')), 'expected authored reporter state');
    assert.ok(graphicsLines.some(line => line.startsWith('3,"Graphics.Pipeline",') && line.endsWith(',"chrome_graphics_pipeline.aggregated_surface_frame_trace_ids","chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[0]","int",43,"[NULL]","[NULL]"')), 'expected authored aggregated surface argument');
    // A separate policy imports the identical authored bytes and retains its own artifacts.
    const inventoryResult = await runInventoryDiagnostic({ trace: { path: graphicsPath, bytes: graphics.length, sha256: digest(graphics) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: ['authored-start', 'authored-end'], out: join(out, 'graphics-inventory') });
    requireSuccessfulDiagnostic(inventoryResult);
    assert.equal(inventoryResult.queryPolicy, 'inventory-v1'); assert.equal(inventoryResult.rawRowsExported, false);
    const inventoryLines = (await readFile(join(out, 'graphics-inventory', 'query.stdout'), 'utf8')).trim().split(/\r?\n/);
    for (const row of [
      '"Graphics.Pipeline",2', '"PipelineReporter",1',
      '"surface_frame_steps",1', '"display_frame_steps",1', '"surface_first_display_mapping",1',
      '"surface_without_first_display_mapping",0', '"surface_steps_without_surface_id",0',
      '"surface_frame_steps","STEP_GENERATE_COMPOSITOR_FRAME",1',
      '"display_frame_steps","STEP_SURFACE_AGGREGATION",1', '1001000,1024000',
      '"Graphics.Pipeline",0,"[NULL]",1,1,1,1,"[NULL]","[NULL]",2',
      '"PipelineReporter",0,"[NULL]",1,1,1,1,"[NULL]","[NULL]",1',
    ]) assert.ok(inventoryLines.includes(row), `expected authored inventory row ${row}`);
    const contextHeader = '"name","track_id","track_name","utid","tid","upid","pid","process_name","thread_name","slice_count"';
    const argumentHeader = '"name","flat_key","key","value_type","arg_occurrence_count","slice_count"';
    assert.equal(inventoryLines.includes(contextHeader), true);
    assert.deepEqual(inventoryLines.slice(inventoryLines.indexOf(contextHeader) + 1, inventoryLines.indexOf(argumentHeader)).filter(Boolean), [
      '"Graphics.Pipeline",0,"[NULL]",1,1,1,1,"[NULL]","[NULL]",2',
      '"PipelineReporter",0,"[NULL]",1,1,1,1,"[NULL]","[NULL]",1',
    ]);
    const argumentRows = inventoryLines.slice(inventoryLines.indexOf(argumentHeader) + 1);
    assert.equal(inventoryLines.includes(argumentHeader), true);
    const expectedArguments = [
      ['Graphics.Pipeline', 'chrome_graphics_pipeline.aggregated_surface_frame_trace_ids', 'chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[0]', 'int'],
      ['Graphics.Pipeline', 'chrome_graphics_pipeline.display_trace_id', 'chrome_graphics_pipeline.display_trace_id', 'int'],
      ['Graphics.Pipeline', 'chrome_graphics_pipeline.step', 'chrome_graphics_pipeline.step', 'string'],
      ['Graphics.Pipeline', 'chrome_graphics_pipeline.surface_frame_trace_id', 'chrome_graphics_pipeline.surface_frame_trace_id', 'int'],
      ['PipelineReporter', 'frame_reporter.display_trace_id', 'frame_reporter.display_trace_id', 'int'],
      ['PipelineReporter', 'frame_reporter.frame_sequence', 'frame_reporter.frame_sequence', 'uint'],
      ['PipelineReporter', 'frame_reporter.frame_source', 'frame_reporter.frame_source', 'uint'],
      ['PipelineReporter', 'frame_reporter.layer_tree_host_id', 'frame_reporter.layer_tree_host_id', 'uint'],
      ['PipelineReporter', 'frame_reporter.state', 'frame_reporter.state', 'string'],
      ['PipelineReporter', 'frame_reporter.surface_frame_trace_id', 'frame_reporter.surface_frame_trace_id', 'int'],
    ].map(([name, flatKey, key, type]) => `"${name}","${flatKey}","${key}","${type}",${key === 'chrome_graphics_pipeline.step' ? 2 : 1},${key === 'chrome_graphics_pipeline.step' ? 2 : 1}`);
    assert.deepEqual(argumentRows, expectedArguments);
    for (const header of [
      '"id","ts","dur","step","surface_frame_trace_id","utid","task_start_time_ts"',
      '"id","ts","dur","step","display_trace_id","utid","task_start_time_ts"',
      '"surface_frame_trace_id","display_trace_id"',
      '"slice_id","name","arg_set_id","flat_key","key","value_type","int_value","string_value","real_value"',
    ]) assert.equal(inventoryLines.includes(header), false, `inventory must omit raw export ${header}`);
    summary.status = 'success'; summary.fixtureBytes = bytes.length; summary.fixtureSha256 = digest(bytes);
    summary.graphicsFixtureBytes = graphics.length; summary.graphicsFixtureSha256 = digest(graphics);
    summary.graphicsInventory = { queryPolicy: inventoryResult.queryPolicy, rawRowsExported: inventoryResult.rawRowsExported, fixtureBytes: graphics.length, fixtureSha256: digest(graphics) };
  } catch (error) { summary.error = error.message; }
  await writeFile(join(out, 'smoke.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--processor' || args[2] !== '--out') throw new Error('usage: node tools/perfetto-import/smoke.mjs --processor /absolute/trace_processor_shell --out /absolute/fresh-output');
    const summary = await runSmoke({ processor: args[1], out: args[3] });
    process.stdout.write(`${JSON.stringify(summary)}\n`); if (summary.status !== 'success') process.exitCode = 1;
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
