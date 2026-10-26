import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runDiagnostic, runInventoryDiagnostic, runTargetInventoryDiagnostic, runScopeInventoryDiagnostic, runMainframeLineageDiagnostic } from './run.mjs';

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

// Independent authored scope/clock input; no existing fixture bytes are extended.
export function authoredScopeFixture() {
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const clock = (id, ts, unit) => body(1, concat(uint(1,id),uint(2,ts),uint(3,0n),uint(4,unit)));
  const annotation = (name, value) => concat(text(10,name),value);
  const string = (name,value) => annotation(name,text(6,value));
  const integer = (name,value,field=4) => annotation(name,uint(field,value));
  const event = (type,name,ts,track=10n,clockId=64n,annotations=[],extra=Buffer.alloc(0)) => packet(
    uint(8,ts),uint(58,clockId),body(11,concat(uint(9,type),uint(11,track),text(22,'scope,"category"'),
      ...(name === null ? [] : [text(23,name)]),...annotations.map(a=>body(4,a)),extra)));
  const scheduler = source => [integer('source_id',source,3),integer('sequence_number',7n,3),integer('frame_time',1009000n),string('shared','same')];
  return concat(
    packet(uint(13,1n),body(6,concat(clock(6n,1000000n,1n),clock(3n,2000000n,1n),clock(64n,1000n,1000n),uint(2,6n)))),
    packet(body(60,concat(uint(1,8n),body(4,concat(uint(1,900n),uint(2,901n),text(5,'thread,"main"')))))),
    packet(body(60,concat(uint(1,10n),uint(5,8n),text(2,'track,"main"')))),
    packet(body(60,concat(uint(1,18n),body(4,concat(uint(1,900n),uint(2,902n),text(5,'thread-other')))))),
    packet(body(60,concat(uint(1,20n),uint(5,18n),text(2,'other-track')))),
    event(2n,null,1000n), // unmatched end: importer-generated behavior, not a parent ID.
    event(1n,'outer',1001n,10n,64n,[string('ancestorOnly','not exported')]),
    event(1n,'inner',1002000n,10n,6n,[string('ancestorOnly2','not exported')]),
    event(1n,'MainFrame.Draw',2003000n,10n,3n,[integer('largeSigned',9007199254740993n),integer('largeUnsigned',9007199254740995n,3),string('repeated','first'),string('repeated','second')]),
    event(1n,'Graphics.Pipeline',1004n,10n,64n,[string('endpoint','begin')],body(1052,concat(uint(1,2n),uint(10,43n)))),
    event(1n,'DrawFrame',1005n,20n,64n,[integer('layer_tree_host_id',999n),...scheduler(333n)]),
    event(2n,null,1006000n,20n,6n),
    event(2n,null,2006000n,10n,3n,[string('endOnly','merged endpoint')]),
    event(3n,'Graphics.Pipeline',1007n,10n,64n,[],body(1052,concat(uint(1,10n),uint(3,58n),uint(8,43n)))),
    event(3n,'DrawFrame',1008000n,10n,6n,[integer('layer_tree_host_id',17n)]),
    event(3n,'Scheduler::BeginFrame',2009000n,10n,3n,scheduler(111n)),
    event(3n,'Scheduler::BeginFrame',1010n,10n,64n,scheduler(111n)),
    event(3n,'Scheduler::BeginFrame',1011000n,10n,6n,scheduler(222n)),
    event(3n,'Scheduler::BeginImplFrame',2012000n,10n,3n,scheduler(111n)),
    event(3n,'scope-"phase',1013n,10n,64n,[string('quoted,"key"','left",right'),string('unicode','é🧪'),string('multiline','line1\n\nline3\r\nline4'),string('empty',''),string('literalNull','[NULL]')]),
    event(3n,'unrelated sibling',1014n),
    event(2n,null,1035000n,10n,6n),
    event(2n,null,2039000n,10n,3n),
    event(2n,null,1040n),
    event(3n,'unrelated root',1041n),
    event(1n,'DrawFrame',1042n,10n,64n,[integer('layer_tree_host_id',19n)]));
}

// Independent authored lineage input. MainFramePipeline uses ChromeTrackEvent
// field 1067; its main_frame_id=1 and step=2 are pinned v59.1 protobuf fields.
// These authored identities deliberately repeat across threads; they certify
// exporter shape, never a production reporter association or frame population.
export function authoredMainframeLineageFixture() {
  const packet = (...fields) => body(1, concat(uint(10, 1n), ...fields));
  const annotation = (name, value) => body(4, concat(text(10,name),uint(3,value)));
  const event = (name,ts,track=10n,extra=Buffer.alloc(0),type=3n,category='cc,benchmark') => packet(uint(8,ts),uint(58,64n),body(11,concat(uint(9,type),uint(11,track),text(22,category),...(name===null?[]:[text(23,name)]),extra)));
  const pipeline = (step,firstDraw=false) => body(1067,concat(uint(1,9007199254740995n),uint(2,step),...(firstDraw?[body(5,concat(uint(1,4294967297n),uint(2,123n)))]:[])));
  const clock = (id,ts,unit) => body(1,concat(uint(1,id),uint(2,ts),uint(3,0n),uint(4,unit)));
  return concat(
    packet(uint(13,1n),body(6,concat(clock(6n,1000000n,1n),clock(64n,1000n,1000n),uint(2,6n)))),
    packet(body(60,concat(uint(1,8n),body(4,concat(uint(1,900n),uint(2,901n),text(5,'impl')))))),
    packet(body(60,concat(uint(1,10n),uint(5,8n),text(2,'impl-track')))),
    packet(body(60,concat(uint(1,18n),body(4,concat(uint(1,900n),uint(2,902n),text(5,'main')))))),
    packet(body(60,concat(uint(1,20n),uint(5,18n),text(2,'main-track')))),
    packet(body(60,concat(uint(1,30n),uint(5,8n),text(2,'reporter-track')))),
    event('lineage-start',1000n),
    event('PipelineReporter',1001n,30n,annotation('ancestorOnly',77n),1n),
    event('Commit',1002n,30n),
    event('ProxyMain::BeginMainFrame',1003n,20n,pipeline(2n)),
    event('ProxyMain::BeginMainFrame::commit',1004n,20n,pipeline(4n)),
    event('ProxyImpl::ReadyToCommit',1005n,10n,pipeline(5n)),
    event('ProxyImpl::Commit',1006n,10n,pipeline(6n)),
    event('LayerTreeHostImpl::CommitComplete',1007n,10n,pipeline(7n)),
    event('ProxyImpl::ReadyToActivate',1008n,10n,pipeline(8n)),
    event('LayerTreeHostImpl::ActivateSyncTree',1009n,10n,pipeline(9n)),
    event('ActivateLayerTree',1010n,10n,concat(annotation('frameId',17n),annotation('layerTreeId',17n))),
    event('Commit',1011n,20n,concat(annotation('frameSeqId',107n),annotation('layerTreeId',17n)),3n,'disabled-by-default-devtools.timeline'),
    event('MainFrame.Draw',1012n,10n,pipeline(10n,true)),
    event('DrawFrame',1013n,10n,concat(annotation('frameSeqId',123n),annotation('layerTreeId',17n))),
    event('ProxyImpl::Commit',1014n,20n,pipeline(6n)),
    event('MainFrame.Draw',1015n,10n,pipeline(10n)),
    event(null,1016n,30n,Buffer.alloc(0),2n),
    event('lineage-end',1017n));
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

// Authored verification only: exact IDs remain CSV strings or SQLite BigInts.
export function reconstructScopeArguments(compact, dictionary) {
  const index = new Map();
  for (const row of dictionary) {
    assert.ok(!index.has(row.arg_key_id), 'duplicate dictionary ID');
    index.set(row.arg_key_id, row);
  }
  return compact.map(row => {
    const group = index.get(row.arg_key_id);
    assert.ok(group, 'missing dictionary reference');
    return {
      slice_id: row.slice_id, name: group.name, arg_set_id: row.arg_set_id,
      arg_present: row.arg_present, flat_key: group.flat_key, key: group.key,
      value_type: group.value_type, int_value: row.int_value,
      string_value: row.string_value, real_value: row.real_value,
      flat_key_is_null: group.flat_key_is_null, key_is_null: group.key_is_null,
      value_type_is_null: group.value_type_is_null,
      int_value_is_null: row.int_value_is_null,
      string_value_is_null: row.string_value_is_null,
      real_value_is_null: row.real_value_is_null,
    };
  });
}

const scopeHeaders = [
  'name,event_count,arg_set_count',
  'id,ts,dur,depth,parent_id,is_selected,name,category,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,parent_status,duration_status,parent_id_is_null,name_is_null,category_is_null,track_name_is_null,process_name_is_null,thread_name_is_null',
  'slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null',
  'arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
  'name,idx,severity,source,value,name_is_null,severity_is_null,source_is_null', 'start_ts,end_ts',
].map(header => header.split(','));

// Frozen complete authored rows: reviewed 6e888e3, official macOS v59.1, unchanged 1927-byte fixture.
// Fixture SHA256 8e5fa01db67d7c2ea70f955d86ba8d36f333a850bee964b275d621e173d84726; processor SHA256 8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4.
// Original successful stdout SHA256 8d57934965e234b85be1d06ec87c8b8fb3fa02c9bdb35a2d264b73eca7a80931.
const expectedExpandedScopeRows = [
  ["2", "MainFrame.Draw", "44", "1", "debug.largeSigned", "debug.largeSigned", "int", "9007199254740993", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["2", "MainFrame.Draw", "44", "1", "debug.largeUnsigned", "debug.largeUnsigned", "uint", "9007199254740995", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["2", "MainFrame.Draw", "44", "1", "debug.repeated", "debug.repeated", "string", "[NULL]", "second", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["3", "Graphics.Pipeline", "23", "1", "chrome_graphics_pipeline.step", "chrome_graphics_pipeline.step", "string", "[NULL]", "STEP_GENERATE_COMPOSITOR_FRAME", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["3", "Graphics.Pipeline", "23", "1", "chrome_graphics_pipeline.surface_frame_trace_id", "chrome_graphics_pipeline.surface_frame_trace_id", "int", "43", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["3", "Graphics.Pipeline", "23", "1", "debug.endOnly", "debug.endOnly", "string", "[NULL]", "merged endpoint", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["3", "Graphics.Pipeline", "23", "1", "debug.endpoint", "debug.endpoint", "string", "[NULL]", "begin", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["4", "DrawFrame", "18", "1", "debug.frame_time", "debug.frame_time", "int", "1009000", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["4", "DrawFrame", "18", "1", "debug.layer_tree_host_id", "debug.layer_tree_host_id", "int", "999", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["4", "DrawFrame", "18", "1", "debug.sequence_number", "debug.sequence_number", "uint", "7", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["4", "DrawFrame", "18", "1", "debug.shared", "debug.shared", "string", "[NULL]", "same", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["4", "DrawFrame", "18", "1", "debug.source_id", "debug.source_id", "uint", "333", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["5", "Graphics.Pipeline", "27", "1", "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids", "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[0]", "int", "43", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["5", "Graphics.Pipeline", "27", "1", "chrome_graphics_pipeline.display_trace_id", "chrome_graphics_pipeline.display_trace_id", "int", "58", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["5", "Graphics.Pipeline", "27", "1", "chrome_graphics_pipeline.step", "chrome_graphics_pipeline.step", "string", "[NULL]", "STEP_SURFACE_AGGREGATION", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["6", "DrawFrame", "30", "1", "debug.layer_tree_host_id", "debug.layer_tree_host_id", "int", "17", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["7", "Scheduler::BeginFrame", "31", "1", "debug.frame_time", "debug.frame_time", "int", "1009000", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["7", "Scheduler::BeginFrame", "31", "1", "debug.sequence_number", "debug.sequence_number", "uint", "7", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["7", "Scheduler::BeginFrame", "31", "1", "debug.shared", "debug.shared", "string", "[NULL]", "same", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["7", "Scheduler::BeginFrame", "31", "1", "debug.source_id", "debug.source_id", "uint", "111", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["8", "Scheduler::BeginFrame", "31", "1", "debug.frame_time", "debug.frame_time", "int", "1009000", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["8", "Scheduler::BeginFrame", "31", "1", "debug.sequence_number", "debug.sequence_number", "uint", "7", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["8", "Scheduler::BeginFrame", "31", "1", "debug.shared", "debug.shared", "string", "[NULL]", "same", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["8", "Scheduler::BeginFrame", "31", "1", "debug.source_id", "debug.source_id", "uint", "111", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["9", "Scheduler::BeginFrame", "35", "1", "debug.frame_time", "debug.frame_time", "int", "1009000", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["9", "Scheduler::BeginFrame", "35", "1", "debug.sequence_number", "debug.sequence_number", "uint", "7", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["9", "Scheduler::BeginFrame", "35", "1", "debug.shared", "debug.shared", "string", "[NULL]", "same", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["9", "Scheduler::BeginFrame", "35", "1", "debug.source_id", "debug.source_id", "uint", "222", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["10", "Scheduler::BeginImplFrame", "31", "1", "debug.frame_time", "debug.frame_time", "int", "1009000", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["10", "Scheduler::BeginImplFrame", "31", "1", "debug.sequence_number", "debug.sequence_number", "uint", "7", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["10", "Scheduler::BeginImplFrame", "31", "1", "debug.shared", "debug.shared", "string", "[NULL]", "same", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["10", "Scheduler::BeginImplFrame", "31", "1", "debug.source_id", "debug.source_id", "uint", "111", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"],
  ["11", "scope-\"phase", "39", "1", "debug.empty", "debug.empty", "string", "[NULL]", "", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["11", "scope-\"phase", "39", "1", "debug.literalNull", "debug.literalNull", "string", "[NULL]", "[NULL]", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["11", "scope-\"phase", "39", "1", "debug.multiline", "debug.multiline", "string", "[NULL]", "line1\n\nline3\r\nline4", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["11", "scope-\"phase", "39", "1", "debug.quoted,\"key\"", "debug.quoted,\"key\"", "string", "[NULL]", "left\",right", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["11", "scope-\"phase", "39", "1", "debug.unicode", "debug.unicode", "string", "[NULL]", "é🧪", "[NULL]", "0", "0", "0", "1", "0", "1"],
  ["14", "DrawFrame", "49", "1", "debug.layer_tree_host_id", "debug.layer_tree_host_id", "int", "19", "[NULL]", "[NULL]", "0", "0", "0", "0", "1", "1"]
];
const expectedScopeGroups = [
  ["DrawFrame", "debug.frame_time", "debug.frame_time", "int", "1", "1", "0", "0", "0"],
  ["DrawFrame", "debug.layer_tree_host_id", "debug.layer_tree_host_id", "int", "3", "3", "0", "0", "0"],
  ["DrawFrame", "debug.sequence_number", "debug.sequence_number", "uint", "1", "1", "0", "0", "0"],
  ["DrawFrame", "debug.shared", "debug.shared", "string", "1", "1", "0", "0", "0"],
  ["DrawFrame", "debug.source_id", "debug.source_id", "uint", "1", "1", "0", "0", "0"],
  ["Graphics.Pipeline", "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids", "chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[0]", "int", "1", "1", "0", "0", "0"],
  ["Graphics.Pipeline", "chrome_graphics_pipeline.display_trace_id", "chrome_graphics_pipeline.display_trace_id", "int", "1", "1", "0", "0", "0"],
  ["Graphics.Pipeline", "chrome_graphics_pipeline.step", "chrome_graphics_pipeline.step", "string", "2", "2", "0", "0", "0"],
  ["Graphics.Pipeline", "chrome_graphics_pipeline.surface_frame_trace_id", "chrome_graphics_pipeline.surface_frame_trace_id", "int", "1", "1", "0", "0", "0"],
  ["Graphics.Pipeline", "debug.endOnly", "debug.endOnly", "string", "1", "1", "0", "0", "0"],
  ["Graphics.Pipeline", "debug.endpoint", "debug.endpoint", "string", "1", "1", "0", "0", "0"],
  ["MainFrame.Draw", "debug.largeSigned", "debug.largeSigned", "int", "1", "1", "0", "0", "0"],
  ["MainFrame.Draw", "debug.largeUnsigned", "debug.largeUnsigned", "uint", "1", "1", "0", "0", "0"],
  ["MainFrame.Draw", "debug.repeated", "debug.repeated", "string", "1", "1", "0", "0", "0"],
  ["Scheduler::BeginFrame", "debug.frame_time", "debug.frame_time", "int", "3", "3", "0", "0", "0"],
  ["Scheduler::BeginFrame", "debug.sequence_number", "debug.sequence_number", "uint", "3", "3", "0", "0", "0"],
  ["Scheduler::BeginFrame", "debug.shared", "debug.shared", "string", "3", "3", "0", "0", "0"],
  ["Scheduler::BeginFrame", "debug.source_id", "debug.source_id", "uint", "3", "3", "0", "0", "0"],
  ["Scheduler::BeginImplFrame", "debug.frame_time", "debug.frame_time", "int", "1", "1", "0", "0", "0"],
  ["Scheduler::BeginImplFrame", "debug.sequence_number", "debug.sequence_number", "uint", "1", "1", "0", "0", "0"],
  ["Scheduler::BeginImplFrame", "debug.shared", "debug.shared", "string", "1", "1", "0", "0", "0"],
  ["Scheduler::BeginImplFrame", "debug.source_id", "debug.source_id", "uint", "1", "1", "0", "0", "0"],
  ["scope-\"phase", "debug.empty", "debug.empty", "string", "1", "1", "0", "0", "0"],
  ["scope-\"phase", "debug.literalNull", "debug.literalNull", "string", "1", "1", "0", "0", "0"],
  ["scope-\"phase", "debug.multiline", "debug.multiline", "string", "1", "1", "0", "0", "0"],
  ["scope-\"phase", "debug.quoted,\"key\"", "debug.quoted,\"key\"", "string", "1", "1", "0", "0", "0"],
  ["scope-\"phase", "debug.unicode", "debug.unicode", "string", "1", "1", "0", "0", "0"]
];

function requireScopeInventory(csv) {
  const rows=csvRows(csv), tables=[]; let cursor=0;
  for (let i=0;i<scopeHeaders.length;i++) {
    assert.deepEqual(rows[cursor++],scopeHeaders[i],`scope table ${i+1} schema`);
    const end=i+1===scopeHeaders.length?rows.length:rows.findIndex((row,index)=>index>=cursor && JSON.stringify(row)===JSON.stringify(scopeHeaders[i+1]));
    assert.ok(end>=cursor,`scope table ${i+1} complete`);
    const data=rows.slice(cursor,end); data.forEach(row=>assert.equal(row.length,scopeHeaders[i].length));
    tables.push(data.map(row=>Object.fromEntries(scopeHeaders[i].map((key,j)=>[key,row[j]])))); cursor=end;
  }
  const [families,nodes,compact,dictionary,stats,bounds]=tables;
  const args=reconstructScopeArguments(compact,dictionary);
  const groups=dictionary.map(({arg_key_id,...row})=>row);
  assert.deepEqual(args.map(Object.values),expectedExpandedScopeRows);
  assert.deepEqual(groups.map(Object.values),expectedScopeGroups);
  assert.equal(new Set(compact.map(row=>row.arg_key_id)).size,dictionary.length);
  assert.deepEqual(tables.map(table=>table.length),[5,13,38,27,3,1]);
  assert.deepEqual(families.map(r=>[r.name,r.event_count,r.arg_set_count]),[['DrawFrame','3','3'],['Graphics.Pipeline','2','2'],['MainFrame.Draw','1','1'],['Scheduler::BeginFrame','3','2'],['Scheduler::BeginImplFrame','1','1']]);
  assert.deepEqual(nodes.map(r=>[r.name,r.ts,r.dur,r.depth]),[
    ['outer','1001000','39000','0'],['inner','1002000','37000','1'],['MainFrame.Draw','1003000','32000','2'],
    ['Graphics.Pipeline','1004000','2000','3'],['DrawFrame','1005000','1000','0'],['Graphics.Pipeline','1007000','0','3'],
    ['DrawFrame','1008000','0','3'],['Scheduler::BeginFrame','1009000','0','3'],['Scheduler::BeginFrame','1010000','0','3'],
    ['Scheduler::BeginFrame','1011000','0','3'],['Scheduler::BeginImplFrame','1012000','0','3'],['scope-"phase','1013000','0','3'],['DrawFrame','1042000','-1','0'],
  ]);
  assert.equal(new Set(nodes.map(r=>r.id)).size,nodes.length);
  const outer=nodes[0],inner=nodes[1],main=nodes[2];
  assert.deepEqual(nodes.filter(r=>r.is_selected==='0').map(r=>r.name),['outer','inner']);
  assert.equal(inner.parent_id,outer.id); assert.equal(main.parent_id,inner.id);
  for (const r of nodes) {
    const root=r.name==='outer' || r.ts==='1005000' || r.ts==='1042000';
    assert.equal(r.parent_status,root?'no_parent':'parent_present');
    assert.equal(r.parent_id_is_null,root?'1':'0');
    assert.equal(r.duration_status,r.ts==='1042000'?'unclosed':'nonnegative');
    if (r.depth==='3') assert.equal(r.parent_id,main.id);
    assert.equal(r.category,'scope,"category"'); assert.equal(r.category_is_null,'0');
    assert.equal(r.tid,r.ts==='1005000'?'902':'901');
  }
  assert.notEqual(nodes[4].track_id,main.track_id);
  assert.ok(args.every(r=>nodes.some(n=>n.id===r.slice_id && n.is_selected==='1')));
  assert.ok(args.every(r=>!r.key.includes('ancestorOnly')));
  assert.ok(groups.every(r=>!r.key.includes('ancestorOnly')));
  const find=(name,key)=>args.filter(r=>r.name===name && r.key===key);
  assert.deepEqual(find('Scheduler::BeginFrame','debug.source_id').map(r=>[r.value_type,r.int_value]),[['uint','111'],['uint','111'],['uint','222']]);
  assert.deepEqual(find('Scheduler::BeginFrame','debug.sequence_number').map(r=>r.int_value),['7','7','7']);
  assert.deepEqual(find('Scheduler::BeginFrame','debug.frame_time').map(r=>r.int_value),['1009000','1009000','1009000']);
  const scheduler=nodes.filter(r=>r.name==='Scheduler::BeginFrame');
  assert.equal(scheduler[0].arg_set_id,scheduler[1].arg_set_id); assert.notEqual(scheduler[0].id,scheduler[1].id);
  assert.ok(groups.some(r=>r.name==='Scheduler::BeginFrame' && r.key==='debug.source_id' && r.arg_occurrence_count==='3' && r.slice_count==='3'));
  for (const [key,type,value] of [['largeSigned','int','9007199254740993'],['largeUnsigned','uint','9007199254740995']]) {
    const [r]=find('MainFrame.Draw',`debug.${key}`); assert.equal(r.value_type,type); assert.equal(r.int_value,value);
  }
  assert.equal(find('Graphics.Pipeline','debug.endOnly')[0].string_value,'merged endpoint');
  // Repeated producer annotation keys collapse to the final imported value.
  assert.deepEqual(find('MainFrame.Draw','debug.repeated').map(r=>r.string_value),['second']);
  for (const [key,value] of [['quoted,"key"','left",right'],['unicode','é🧪'],['multiline','line1\n\nline3\r\nline4'],['empty',''],['literalNull','[NULL]']]) {
    const [r]=find('scope-"phase',`debug.${key}`); assert.equal(r.string_value,value); assert.equal(r.string_value_is_null,'0');
  }
  assert.deepEqual(find('DrawFrame','debug.layer_tree_host_id').map(r=>r.int_value),['999','17','19']);
  for (const r of args) for (const key of ['flat_key','key','value_type','int_value','string_value','real_value']) {
    assert.ok(['0','1'].includes(r[`${key}_is_null`]));
    if (r[`${key}_is_null`]==='1') assert.equal(r[key],'[NULL]');
  }
  assert.ok(stats.every(r=>r.value!=='0'));
  assert.deepEqual(stats.map(r=>[r.name,r.idx,r.severity,r.source]),[
    ['clock_sync_cache_miss','[NULL]','info','analysis'],
    ['guess_trace_type_duration_ns','[NULL]','info','analysis'],
    ['parse_trace_duration_ns','[NULL]','info','analysis'],
  ]);
  assert.equal(stats[0].value,'2');
  for (const r of stats) for (const key of ['name','severity','source']) assert.equal(r[`${key}_is_null`],r[key]==='[NULL]'?'1':'0');
  // The unmatched end produces no slice or bounds entry in this pinned importer.
  assert.deepEqual(bounds,[{start_ts:'1001000',end_ts:'1042000'}]);
  return tables.map(table=>table.length);
}

function requireMainframeLineage(csv) {
  const rows=csvRows(csv),tables=[];let cursor=0;
  for(let i=0;i<scopeHeaders.length;i++) {
    assert.deepEqual(rows[cursor++],scopeHeaders[i],`lineage table ${i+1} schema`);
    const end=i+1===scopeHeaders.length?rows.length:rows.findIndex((row,index)=>index>=cursor && JSON.stringify(row)===JSON.stringify(scopeHeaders[i+1]));
    assert.ok(end>=cursor,`lineage table ${i+1} complete`);
    const data=rows.slice(cursor,end);data.forEach(row=>assert.equal(row.length,scopeHeaders[i].length));
    tables.push(data.map(row=>Object.fromEntries(scopeHeaders[i].map((key,j)=>[key,row[j]]))));cursor=end;
  }
  const [families,nodes,compact,dictionary,stats,bounds]=tables;
  const expected=['ActivateLayerTree','Commit','DrawFrame','LayerTreeHostImpl::ActivateSyncTree','LayerTreeHostImpl::CommitComplete','MainFrame.Draw','ProxyImpl::Commit','ProxyImpl::ReadyToActivate','ProxyImpl::ReadyToCommit','ProxyMain::BeginMainFrame','ProxyMain::BeginMainFrame::commit'];
  assert.deepEqual(families.map(r=>[r.name,r.event_count]),expected.map(name=>[name,['Commit','ProxyImpl::Commit','MainFrame.Draw'].includes(name)?'2':'1']));
  assert.equal(nodes.length,17);assert.equal(compact.length,31);assert.equal(dictionary.length,27);
  const args=reconstructScopeArguments(compact,dictionary);
  const reporters=nodes.filter(r=>r.name==='PipelineReporter');assert.equal(reporters.length,1);assert.equal(reporters[0].is_selected,'0');
  assert.equal(args.some(r=>r.key.includes('ancestorOnly')),false);
  const commits=nodes.filter(r=>r.name==='Commit');assert.equal(commits.length,2);
  assert.equal(commits[0].parent_id,reporters[0].id);assert.equal(commits[0].category,'cc,benchmark');
  assert.equal(commits[1].parent_id_is_null,'1');assert.equal(commits[1].category,'disabled-by-default-devtools.timeline');assert.notEqual(commits[0].track_id,commits[1].track_id);
  const ids=args.filter(r=>r.key==='main_frame_pipeline.main_frame_id');assert.equal(ids.length,10);
  assert.ok(ids.every(r=>r.value_type==='uint' && r.int_value==='9007199254740995'));
  const steps=args.filter(r=>r.key==='main_frame_pipeline.step');assert.equal(steps.length,10);
  assert.deepEqual(steps.map(r=>r.string_value),['BEGIN_MAIN_FRAME','COMMIT_ON_MAIN','READY_TO_COMMIT_ON_IMPL','COMMIT_ON_IMPL','COMMIT_COMPLETE','READY_TO_ACTIVATE','ACTIVATE','DRAW','COMMIT_ON_IMPL','DRAW']);
  const draws=nodes.filter(r=>r.name==='MainFrame.Draw');
  for(const [key,value] of [['source_id','4294967297'],['sequence_number','123']]) {
    const first=args.filter(r=>r.key===`main_frame_pipeline.last_begin_frame_id_during_first_draw.${key}`);
    assert.equal(first.length,1);assert.equal(first[0].slice_id,draws[0].id);assert.equal(first[0].value_type,'uint');assert.equal(first[0].int_value,value);
  }
  const repeated=nodes.filter(r=>r.name==='ProxyImpl::Commit');assert.equal(repeated.length,2);assert.notEqual(repeated[0].track_id,repeated[1].track_id);assert.equal(repeated[0].arg_set_id,repeated[1].arg_set_id);
  assert.equal(args.find(r=>r.slice_id===commits[0].id).arg_present,'0');
  assert.deepEqual(args.filter(r=>r.key==='debug.frameSeqId').map(r=>r.int_value),['107','123']);
  assert.ok(stats.every(r=>r.value!=='0'));assert.deepEqual(bounds,[{start_ts:'1000000',end_ts:'1017000'}]);
  return tables.map(table=>table.length);
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
    const scope=authoredScopeFixture(),scopePath=join(out,'authored-scope-fixture.pftrace');
    assert.equal(scope.length,1927);
    assert.equal(digest(scope),'8e5fa01db67d7c2ea70f955d86ba8d36f333a850bee964b275d621e173d84726');
    await writeFile(scopePath,scope,{flag:'wx',mode:0o600});
    const scopeResult=await runScopeInventoryDiagnostic({trace:{path:scopePath,bytes:scope.length,sha256:digest(scope)},processor:{path:processor,sha256:PROCESSOR_PINS[`${process.platform}-${process.arch}`]},phases:['scope-"phase','MainFrame.Draw'],out:join(out,'scope-inventory')});
    requireSuccessfulDiagnostic(scopeResult);
    assert.equal(scopeResult.queryPolicy,'scope-inventory-compact-v1'); assert.equal(scopeResult.rawRowsExported,true);
    for (const key of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility']) assert.equal(scopeResult[key],false);
    assert.equal(scopeResult.clockAdmission,'not_evaluated');
    const scopeTableRows=requireScopeInventory(await readFile(join(out,'scope-inventory','query.stdout'),'utf8'));
    summary.scopeInventory={authoredOnly:true,queryPolicy:scopeResult.queryPolicy,rawRowsExported:true,fixtureBytes:scope.length,fixtureSha256:digest(scope),tableRows:scopeTableRows,officialProcessor:scopeResult.officialProcessor,nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,clockAdmission:'not_evaluated',fps:null,duration:null,scoring:false};
    const lineage=authoredMainframeLineageFixture(),lineagePath=join(out,'authored-mainframe-lineage-fixture.pftrace');
    assert.equal(lineage.length,1367);assert.equal(digest(lineage),'126b0d2ce9a85a519ab4f8b790b0a35c9154306c00b1313e332735488efa0cb7');
    await writeFile(lineagePath,lineage,{flag:'wx',mode:0o600});
    const lineageResult=await runMainframeLineageDiagnostic({trace:{path:lineagePath,bytes:lineage.length,sha256:digest(lineage)},processor:{path:processor,sha256:PROCESSOR_PINS[`${process.platform}-${process.arch}`]},phases:['lineage-start','lineage-end','Commit'],out:join(out,'mainframe-lineage')});
    requireSuccessfulDiagnostic(lineageResult);assert.equal(lineageResult.queryPolicy,'mainframe-lineage-compact-v1');assert.equal(lineageResult.rawRowsExported,true);
    for(const key of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility'])assert.equal(lineageResult[key],false);
    assert.equal(lineageResult.clockAdmission,'not_evaluated');
    const lineageTableRows=requireMainframeLineage(await readFile(join(out,'mainframe-lineage','query.stdout'),'utf8'));
    summary.mainframeLineage={authoredOnly:true,queryPolicy:lineageResult.queryPolicy,rawRowsExported:true,fixtureBytes:lineage.length,fixtureSha256:digest(lineage),tableRows:lineageTableRows,officialProcessor:lineageResult.officialProcessor,nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,clockAdmission:'not_evaluated',fps:null,duration:null,scoring:false};
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
