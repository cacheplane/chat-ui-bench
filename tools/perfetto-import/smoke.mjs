import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runDiagnostic, runInventoryDiagnostic, runTargetInventoryDiagnostic } from './run.mjs';

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
const targetStart = 'target-"start';

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

// Correct pinned schema: Graphics.Pipeline surface_frame_trace_id is field 10.
// Field 2 is a FrameSinkId message and is deliberately not used here.
export function authoredGraphicsFixture() {
  const event = (name, ts, extra) => body(1, concat(uint(10, 1n), uint(8, ts), uint(58, 64n), body(11, concat(uint(9, 3n), uint(11, 7n), text(22, 'cc'), text(23, name), extra))));
  return concat(authoredClockFixture(),
    event('Graphics.Pipeline', 1022n, body(1052, concat(uint(1, 2n), uint(10, 43n)))),
    event('Graphics.Pipeline', 1023n, body(1052, concat(uint(1, 10n), uint(3, 58n), uint(8, 43n)))),
    event('PipelineReporter', 1024n, body(1075, concat(uint(1, 1n), uint(3, 1n), uint(4, 2n), uint(11, 17n), uint(17, 43n), uint(18, 58n)))));
}

// Pinned v59.1 TrackEvent: debug_annotations=4; DebugAnnotation: name=10,
// dict_entries=11, array_values=12, string_value=6, int_value=4, uint_value=3.
// TrackDescriptor: process=3, thread=4, parent_uuid=5, name=2. ProcessDescriptor:
// pid=1, process_name=6; ThreadDescriptor: pid=1, tid=2, thread_name=5.
// Root thread tracks ignore TrackDescriptor.name, so use a named child track.
export function authoredTargetFixture() {
  const annotation = (name, value) => concat(text(10, name), value);
  const string = (name, value) => annotation(name, text(6, value));
  const integer = (name, value, field = 4) => annotation(name, uint(field, value));
  const dict = (name, ...entries) => annotation(name, concat(...entries.map(entry => body(11, entry))));
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const event = (name, ts, ...annotations) => packet(uint(8, ts), uint(58, 64n), body(11, concat(uint(9, 3n), uint(11, 10n), text(22, 'target.authored'), text(23, name), ...annotations.map(entry => body(4, entry)))));
  const frame = token => dict('', string('frame', token), integer('processId', 4242n));
  const frames = annotation('frames', concat(...['frame-a', 'frame-b'].map(token => body(12, frame(token)))));
  const host = [integer('layerTreeId', 17n), string('frame', 'frame-a'), integer('processId', 4242n)];
  return concat(authoredGraphicsFixture(),
    packet(body(60, concat(uint(1, 9n), body(3, concat(uint(1, 900n), text(6, 'browser,"process"')))))),
    packet(body(60, concat(uint(1, 8n), body(4, concat(uint(1, 900n), uint(2, 901n), text(5, 'thread,"name"')))))),
    packet(body(60, concat(uint(1, 10n), uint(5, 8n), text(2, 'track,"name"')))),
    event('TracingStartedInBrowser', 1025n, dict('data', frames)),
    event('SetLayerTreeId', 1026n, ...host),
    event('SetLayerTreeId', 1027n, ...host),
    event('SetLayerTreeId', 1028n, string('layerTreeId', 'wrong-type')),
    event(targetStart, 1029n, dict('data', string('navigationId', 'loader-a')),
      string('empty', ''), string('literalNull', '[NULL]'), string('quoted', 'comma,"quoted"'),
      string('boundary', 'left",right'), string('unicode', 'é🧪'), string('multiline', 'line1\n\nline3\r\nline4'),
      string('quoted,"key"', 'quoted-key-value'),
      integer('largeSigned', 9007199254740993n), integer('largeUnsigned', 9007199254740995n, 3)),
    event('BeginFrame', 1030n), event('target-end', 1031n));
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

// Strict CSV records: doubled quotes, quoted LF/CRLF and string-valued integers.
// Ignore only empty separator records outside quoted fields.
function csvRows(source) {
  const rows = []; let row = [], cell = '', state = 'start', started = false;
  const field = () => { row.push(cell); cell = ''; state = 'start'; };
  const record = () => { if (started) { field(); rows.push(row); } row = []; started = false; };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (state === 'quoted') {
      if (char === '"') {
        if (source[i + 1] === '"') { cell += '"'; i++; }
        else state = 'closed';
      } else cell += char;
    } else if (char === ',') { started = true; field(); }
    else if (char === '\n' || char === '\r') {
      if (char === '\r') { assert.equal(source[++i], '\n', 'CSV record CR requires LF'); }
      record();
    } else if (char === '"') {
      assert.equal(state, 'start', 'CSV quote must start a field');
      state = 'quoted'; started = true;
    } else {
      assert.notEqual(state, 'closed', 'CSV closing quote must precede a delimiter');
      state = 'unquoted'; started = true; cell += char;
    }
  }
  assert.notEqual(state, 'quoted', 'complete CSV quoting');
  record();
  return rows;
}

const targetHeaders = [
  'name,event_count,arg_set_count',
  'id,ts,dur,name,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,track_name_is_null,process_name_is_null,thread_name_is_null',
  'slice_id,name,arg_set_id,arg_present,flat_key,key,value_type,int_value,string_value,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null',
  'name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
  'name,idx,severity,source,value', 'start_ts,end_ts', 'surface_frame_trace_id,display_trace_id',
].map(header => header.split(','));

function requireTargetInventory(csv) {
  const rows = csvRows(csv), tables = []; let cursor = 0;
  for (let i = 0; i < targetHeaders.length; i++) {
    assert.deepEqual(rows[cursor++], targetHeaders[i], `target table ${i + 1} schema`);
    const end = i + 1 === targetHeaders.length ? rows.length : rows.findIndex((row, index) => index >= cursor && JSON.stringify(row) === JSON.stringify(targetHeaders[i + 1]));
    assert.ok(end >= cursor, `target table ${i + 1} complete`);
    const data = rows.slice(cursor, end);
    for (const row of data) assert.equal(row.length, targetHeaders[i].length);
    tables.push(data.map(row => Object.fromEntries(targetHeaders[i].map((key, index) => [key, row[index]]))));
    cursor = end;
  }
  const [families, slices, args, groups, stats, bounds, mapping] = tables;
  assert.deepEqual(families.map(row => [row.name, row.event_count, row.arg_set_count]), [
    ['BeginFrame', '1', '0'], ['FrameCommittedInBrowser', '0', '0'], ['FrameDeletedInBrowser', '0', '0'],
    ['Graphics.Pipeline', '2', '2'], ['PipelineReporter', '1', '1'], ['ProcessReadyInBrowser', '0', '0'],
    ['SetLayerTreeId', '3', '2'], ['TracingStartedInBrowser', '1', '1'],
  ]);
  assert.deepEqual(tables.map(table => table.length), [8, 10, 34, 30, 3, 1, 1]);
  assert.deepEqual(bounds, [{ start_ts: '1001000', end_ts: '1031000' }]);
  assert.deepEqual(mapping, [{ surface_frame_trace_id: '43', display_trace_id: '58' }]);
  assert.ok(stats.every(row => row.value !== '0'));
  assert.deepEqual(stats.map(row => [row.name, row.idx, row.severity, row.source]), [
    ['clock_sync_cache_miss', '[NULL]', 'info', 'analysis'],
    ['guess_trace_type_duration_ns', '[NULL]', 'info', 'analysis'],
    ['parse_trace_duration_ns', '[NULL]', 'info', 'analysis'],
  ]);
  const browser = slices.find(row => row.name === 'TracingStartedInBrowser');
  assert.equal(browser.pid, '900'); assert.equal(browser.tid, '901');
  assert.equal(browser.track_name, 'track,"name"'); assert.equal(browser.process_name, 'browser,"process"'); assert.equal(browser.thread_name, 'thread,"name"');
  assert.equal(browser.track_name_is_null, '0'); assert.equal(browser.process_name_is_null, '0'); assert.equal(browser.thread_name_is_null, '0');
  const find = (name, key) => args.filter(row => row.name === name && row.key === key);
  for (const [index, token] of [['0', 'frame-a'], ['1', 'frame-b']]) {
    const frame = find('TracingStartedInBrowser', `debug.data.frames[${index}].frame`);
    assert.equal(frame.length, 1); assert.equal(frame[0].flat_key, 'debug.data.frames.frame');
    assert.equal(frame[0].string_value, token);
    const pid = find('TracingStartedInBrowser', `debug.data.frames[${index}].processId`);
    assert.equal(pid.length, 1); assert.equal(pid[0].int_value, '4242'); assert.equal(pid[0].value_type, 'int');
  }
  const hosts = slices.filter(row => row.name === 'SetLayerTreeId');
  assert.deepEqual(hosts.map(row => row.ts), ['1026000', '1027000', '1028000']);
  assert.notEqual(hosts[0].id, hosts[1].id); assert.equal(hosts[0].arg_set_id, hosts[1].arg_set_id);
  for (const host of hosts.slice(0, 2)) {
    assert.equal(host.pid, '900');
    const fanout = args.filter(row => row.slice_id === host.id);
    assert.equal(fanout.length, 3); assert.ok(fanout.every(row => row.arg_present === '1'));
    assert.equal(fanout.find(row => row.key === 'debug.processId').int_value, '4242');
  }
  assert.deepEqual(find('SetLayerTreeId', 'debug.layerTreeId').map(row => [row.value_type, row.int_value, row.string_value]), [
    ['int', '17', '[NULL]'], ['int', '17', '[NULL]'], ['string', '[NULL]', 'wrong-type'],
  ]);
  assert.ok(groups.some(row => row.name === 'SetLayerTreeId' && row.key === 'debug.layerTreeId' && row.value_type === 'int' && row.arg_occurrence_count === '2' && row.slice_count === '2'));
  for (const [key, type, value] of [['debug.largeSigned', 'int', '9007199254740993'], ['debug.largeUnsigned', 'uint', '9007199254740995']]) {
    const [row] = find(targetStart, key); assert.equal(row.value_type, type); assert.equal(row.int_value, value); assert.equal(row.int_value_is_null, '0');
  }
  for (const [key, value] of [['debug.data.navigationId', 'loader-a'], ['debug.empty', ''], ['debug.literalNull', '[NULL]'], ['debug.quoted', 'comma,"quoted"'], ['debug.boundary', 'left",right'], ['debug.unicode', 'é🧪'], ['debug.multiline', 'line1\n\nline3\r\nline4'], ['debug.quoted,"key"', 'quoted-key-value']]) {
    const [row] = find(targetStart, key); assert.equal(row.string_value, value); assert.equal(row.string_value_is_null, '0'); assert.equal(row.int_value_is_null, '1'); assert.equal(row.real_value_is_null, '1');
    assert.equal(row.flat_key, key);
    assert.ok(groups.some(group => group.name === targetStart && group.flat_key === key && group.key === key && group.value_type === 'string' && group.arg_occurrence_count === '1' && group.slice_count === '1'));
  }
  for (const name of ['BeginFrame', 'target-end']) {
    const absent = args.filter(row => row.name === name); assert.equal(absent.length, 1);
    assert.equal(absent[0].arg_present, '0');
    for (const key of ['flat_key', 'key', 'value_type', 'int_value', 'string_value', 'real_value']) assert.equal(absent[0][`${key}_is_null`], '1');
    assert.ok(groups.some(row => row.name === name && row.arg_occurrence_count === '0' && row.slice_count === '1'));
  }
  return tables.map(table => table.length);
}

export async function runSmoke({ processor, out }) {
  if (![processor, out].every(p => typeof p === 'string' && isAbsolute(p) && resolve(p) === p)) throw new Error('normalized absolute processor and fresh output paths required');
  await mkdir(out, { mode: 0o700 });
  const summary = { status: 'failure', authoredOnly: true, nativeSupported: false, fps: null, duration: null, scoring: false };
  try {
    assert.deepEqual(csvRows('\n"left"",right","é🧪","line1\n\nline3\r\nline4"\r\n\r\n""\n'), [['left",right', 'é🧪', 'line1\n\nline3\r\nline4'], ['']]);
    for (const malformed of ['"unclosed', 'bad"quote\n', '"closed"trailing\n', '"closed" "next"\n', '"comma,"quoted""\n', 'record\ronly']) assert.throws(() => csvRows(malformed));
    const bytes = authoredClockFixture();
    assert.equal(bytes.length, 153);
    assert.equal(digest(bytes), '177a183ab43040d16379243c2185cf324a2e49edd8ab1c9d17034b9276f3199d');
    const path = join(out, 'authored-clock-fixture.pftrace');
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    const result = await runDiagnostic({ trace: { path, bytes: bytes.length, sha256: digest(bytes) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: ['authored-start', 'authored-end'], out: join(out, 'diagnostic') });
    requireSuccessfulDiagnostic(result);
    const csv = await readFile(join(out, 'diagnostic', 'query.stdout'), 'utf8');
    csvRows(csv);
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
    const graphicsCsv = await readFile(join(out, 'graphics-diagnostic', 'query.stdout'), 'utf8');
    csvRows(graphicsCsv);
    const graphicsLines = graphicsCsv.trim().split(/\r?\n/);
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
    const inventoryCsv = await readFile(join(out, 'graphics-inventory', 'query.stdout'), 'utf8');
    csvRows(inventoryCsv);
    const inventoryLines = inventoryCsv.trim().split(/\r?\n/);
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
    const target = authoredTargetFixture();
    assert.equal(target.length, 1238);
    assert.equal(digest(target), 'ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0');
    const targetPath = join(out, 'authored-target-fixture.pftrace');
    await writeFile(targetPath, target, { flag: 'wx', mode: 0o600 });
    const targetResult = await runTargetInventoryDiagnostic({ trace: { path: targetPath, bytes: target.length, sha256: digest(target) }, processor: { path: processor, sha256: PROCESSOR_PINS[`${process.platform}-${process.arch}`] }, phases: [targetStart, 'target-end'], out: join(out, 'target-inventory') });
    requireSuccessfulDiagnostic(targetResult);
    assert.equal(targetResult.queryPolicy, 'target-inventory-v1'); assert.equal(targetResult.rawRowsExported, true);
    for (const key of ['qualification', 'captureQualified', 'fpsEligibility', 'evaluationEligibility', 'scoringEligibility', 'rankingEligibility']) assert.equal(targetResult[key], false);
    assert.equal(targetResult.clockAdmission, 'not_evaluated');
    const tableRows = requireTargetInventory(await readFile(join(out, 'target-inventory', 'query.stdout'), 'utf8'));
    summary.targetInventory = { authoredOnly: true, queryPolicy: targetResult.queryPolicy, rawRowsExported: true, fixtureBytes: target.length, fixtureSha256: digest(target), tableRows,
      officialProcessor: targetResult.officialProcessor, nativeSupported: false, qualification: false, captureQualified: false, fpsEligibility: false, evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, clockAdmission: 'not_evaluated', fps: null, duration: null, scoring: false };
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
