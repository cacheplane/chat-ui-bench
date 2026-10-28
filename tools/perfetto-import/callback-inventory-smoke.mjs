import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runCallbackInventoryDiagnostic } from './callback-inventory-run.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const concat = (...parts) => Buffer.concat(parts);
const varint = value => {const bytes=[]; do {const byte=Number(value&127n);value>>=7n;bytes.push(byte|(value?128:0));} while(value);return Buffer.from(bytes);};
const uint=(field,value)=>concat(varint(BigInt(field)*8n),varint(value));
const body=(field,bytes)=>concat(varint(BigInt(field)*8n+2n),varint(BigInt(bytes.length)),bytes);
const text=(field,value)=>body(field,Buffer.from(value));

// Pure authored protobuf, never a captured trace. Pinned v59.1 fields:
// TrackDescriptor uuid=1,name=2,process=3,thread=4,parent_uuid=5;
// TrackEvent type=9,track_uuid=11,categories=22,name=23,debug_annotations=4.
// DebugAnnotation name=10,string_value=6,uint_value=3. ThreadDescriptor
// pid=1,tid=2,thread_name=5. ProcessDescriptor pid=1,process_name=6.
export function authoredCallbackInventoryFixture() {
  const packet=(...fields)=>body(1,concat(uint(10,1n),...fields));
  const clock=(id,ts,unit)=>body(1,concat(uint(1,id),uint(2,ts),uint(3,0n),uint(4,unit)));
  const annotation=(name,value)=>body(4,concat(text(10,name),value));
  const string=(name,value)=>annotation(name,text(6,value));
  const integer=(name,value)=>annotation(name,uint(3,value));
  const event=(name,ts,type=3n,extra=Buffer.alloc(0),track=10n)=>packet(uint(8,ts),uint(58,64n),body(11,concat(uint(9,type),uint(11,track),text(22,'cc,benchmark'),...(name===null?[]:[text(23,name)]),extra)));
  return concat(
    packet(uint(13,1n),body(6,concat(clock(6n,1000000n,1n),clock(64n,1000n,1000n),uint(2,6n)))),
    packet(body(60,concat(uint(1,6n),body(3,concat(uint(1,900n),text(6,'authored-process')))))),
    packet(body(60,concat(uint(1,8n),uint(5,6n),body(4,concat(uint(1,900n),uint(2,901n),text(5,'authored-thread')))))),
    packet(body(60,concat(uint(1,10n),uint(5,8n),text(2,'shared,"callback"')))),
    packet(body(60,concat(uint(1,20n),uint(5,6n),text(2,'process-callback')))),
    event('callback-start',1000n),
    event('Graphics.Pipeline.DrawAndSwap',1001n,1n,concat(integer('large',9007199254740995n),string('duplicate','first'),string('duplicate','second'),string('empty',''),string('literal','[NULL]'),string('nul','A\0BXYZ'),string('quoted,"key"','left",right'),string('line','é🧪\nline\r\nend'))),
    event(null,1002n,2n,string('status','canceled')),
    event('Display::FrameDisplayed',1003n,1n),
    event(null,1004n,2n),
    event('Graphics.Pipeline',1005n,3n,body(1052,concat(uint(1,2n),uint(10,43n)))),
    event('PipelineReporter',1006n,3n,body(1075,concat(uint(1,1n),uint(3,1n),uint(4,2n),uint(11,17n),uint(17,43n),uint(18,58n)))),
    event('Display::FrameDisplayed',1007n,1n,Buffer.alloc(0),20n),
    event(null,1008n,2n,Buffer.alloc(0),20n),
    event('graphics.pipeline',1008n),
    event('callback-end',1009n),
    event('PipelineReporter',1010n,1n,string('description','partial/dropped')));
}

export const CALLBACK_HEADERS = Object.freeze([
  [
    "name_bytes_hex",
    "event_count",
    "arg_set_count"
  ],
  [
    "id",
    "ts",
    "dur",
    "depth",
    "parent_id",
    "name_bytes_hex",
    "category_bytes_hex",
    "track_id",
    "arg_set_id",
    "track_name_bytes_hex",
    "utid",
    "tid",
    "upid",
    "pid",
    "process_name_bytes_hex",
    "thread_name_bytes_hex",
    "ts_is_null",
    "dur_is_null",
    "depth_is_null",
    "parent_id_is_null",
    "name_is_null",
    "category_is_null",
    "track_id_is_null",
    "arg_set_id_is_null",
    "track_name_is_null",
    "utid_is_null",
    "tid_is_null",
    "upid_is_null",
    "pid_is_null",
    "process_name_is_null",
    "thread_name_is_null"
  ],
  [
    "slice_id",
    "arg_set_id",
    "arg_set_id_is_null",
    "arg_present",
    "flat_key_bytes_hex",
    "key_bytes_hex",
    "value_type_bytes_hex",
    "int_value",
    "string_value_bytes_hex",
    "real_value",
    "flat_key_is_null",
    "key_is_null",
    "value_type_is_null",
    "int_value_is_null",
    "string_value_is_null",
    "real_value_is_null"
  ],
  [
    "id",
    "name_bytes_hex",
    "type_bytes_hex",
    "parent_id",
    "machine_id",
    "source_arg_set_id",
    "dimension_arg_set_id",
    "track_group_id",
    "event_type_bytes_hex",
    "counter_unit_bytes_hex",
    "utid",
    "upid",
    "name_is_null",
    "type_is_null",
    "parent_id_is_null",
    "machine_id_is_null",
    "source_arg_set_id_is_null",
    "dimension_arg_set_id_is_null",
    "track_group_id_is_null",
    "event_type_is_null",
    "counter_unit_is_null",
    "utid_is_null",
    "upid_is_null"
  ],
  [
    "track_id",
    "namespace_bytes_hex",
    "arg_set_id",
    "arg_set_id_is_null",
    "arg_present",
    "flat_key_bytes_hex",
    "key_bytes_hex",
    "value_type_bytes_hex",
    "int_value",
    "string_value_bytes_hex",
    "real_value",
    "flat_key_is_null",
    "key_is_null",
    "value_type_is_null",
    "int_value_is_null",
    "string_value_is_null",
    "real_value_is_null"
  ],
  [
    "name_bytes_hex",
    "idx",
    "severity_bytes_hex",
    "source_bytes_hex",
    "value",
    "name_is_null",
    "idx_is_null",
    "severity_is_null",
    "source_is_null",
    "value_is_null"
  ],
  [
    "start_ts",
    "end_ts",
    "start_ts_is_null",
    "end_ts_is_null"
  ]
].map(header=>Object.freeze(header)));

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


// Authored verification helper only; raw bytes remain available in *_bytes_hex.
// Invalid UTF8 refuses this convenience text view, never the raw exporter.
export function decodeCallbackInventorySmokeRows(rows) {
  return rows.map(row => {
    const result = {...row};
    for (const [key, value] of Object.entries(row)) {
      if (!key.endsWith('_bytes_hex')) continue;
      const name = key.slice(0, -10), flag = row[`${name}_is_null`];
      const isNull = value === null || value === '[NULL]';
      if (flag !== undefined) {
        assert.ok(['0','1',0n,1n].includes(flag), `${name} NULL flag`);
        assert.equal(isNull, flag === '1' || flag === 1n, `${name} NULL consistency`);
      } else assert.equal(isNull, false, `${name} is nonnullable`);
      if (isNull) result[name] = value;
      else {
        assert.ok(typeof value === 'string' && /^(?:[0-9A-F]{2})*$/.test(value), `${name} canonical byte hex`);
        result[name] = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(Buffer.from(value, 'hex'));
      }
    }
    return result;
  });
}

// Verification helper only. Cells remain decimal strings; never coerce IDs.
export function parseCallbackInventorySmokeCsv(bytes) {
  const rows=csvRows(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  let cursor=0;const tables=[];
  for(let i=0;i<CALLBACK_HEADERS.length;i++) {
    const header=CALLBACK_HEADERS[i];assert.deepEqual(rows[cursor++],header,`callback table ${i+1} schema`);
    const end=i+1===CALLBACK_HEADERS.length?rows.length:rows.findIndex((row,index)=>index>=cursor&&JSON.stringify(row)===JSON.stringify(CALLBACK_HEADERS[i+1]));
    assert.ok(end>=cursor,`callback table ${i+1} complete`);
    const data=rows.slice(cursor,end);for(const row of data)assert.equal(row.length,header.length);
    tables.push(decodeCallbackInventorySmokeRows(data.map(row=>Object.fromEntries(header.map((key,index)=>[key,row[index]])))));cursor=end;
  }
  return tables;
}

export async function runCallbackInventorySmoke({processor,out}) {
  assert.ok(isAbsolute(processor)&&isAbsolute(out)); await mkdir(out,{mode:0o700});
  const trace=authoredCallbackInventoryFixture();const tracePath=join(out,'authored-callback.pftrace');
  await writeFile(tracePath,trace,{flag:'wx',mode:0o600});
  const result=await runCallbackInventoryDiagnostic({trace:{path:tracePath,bytes:trace.length,sha256:hash(trace)},processor:{path:processor,sha256:PROCESSOR_PINS[`${process.platform}-${process.arch}`]},phases:['callback-start','callback-end'],out:join(out,'diagnostic')});
  assert.equal(result.status,'success',result.error);assert.equal(result.officialProcessor,true);assert.equal(result.authoredFixture,false);assert.equal(result.sourceBookends.stable,true);
  for(const k of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported','scoring'])assert.equal(result[k],false,k);
  for(const k of ['displayIdentityAdmission','callbackOutcomeAdmission','populationCompleteness','clockAdmission'])assert.equal(result[k],'not_evaluated',k);
  assert.equal(result.fps,null);assert.equal(result.duration,null);
  for(const proc of Object.values(result.processes)) {
    assert.equal(proc.closed,true);assert.equal(proc.code,0);assert.equal(proc.signal,null);assert.equal(proc.error,null);
    for(const stream of Object.values(proc.streams)){assert.equal(stream.eof,true);assert.equal(stream.closed,true);assert.equal(stream.forcedDestroy,false);assert.equal(stream.error,null);}
  }
  const tables=parseCallbackInventorySmokeCsv(await readFile(join(out,'diagnostic','query.stdout')));
  const [counts,slices,args,tracks,trackArgs,stats,bounds]=tables;
  assert.deepEqual(counts.map(r=>[r.name,r.event_count]),[['Display::FrameDisplayed','2'],['Graphics.Pipeline','1'],['Graphics.Pipeline.DrawAndSwap','1'],['PipelineReporter','2'],['callback-end','1'],['callback-start','1']]);
  assert.equal(slices.length,8);assert.ok(!slices.some(r=>r.name==='graphics.pipeline'));
  assert.ok(slices.some(r=>r.name==='PipelineReporter'&&r.dur==='-1'));
  assert.ok(args.some(r=>r.key==='debug.large'&&r.int_value==='9007199254740995'));
  for(const [key,value] of [['debug.nul','A\0BXYZ'],['debug.empty',''],['debug.literal','[NULL]'],['debug.quoted,"key"','left",right'],['debug.line','é🧪\nline\r\nend']])assert.ok(args.some(r=>r.key===key&&r.string_value===value&&r.string_value_is_null==='0'),key);
  // The pinned importer retains the last equal debug key; the export preserves
  // every imported row (duplicate relational rows are covered by SQLite controls).
  assert.deepEqual(args.filter(r=>r.key==='debug.duplicate').map(r=>r.string_value),['second']);
  assert.ok(args.some(r=>r.arg_present==='0'));
  const callbacks=slices.filter(r=>r.name==='Display::FrameDisplayed');
  assert.equal(callbacks.length,2);assert.ok(callbacks.every(r=>r.dur==='1000'));
  const draw=slices.find(r=>r.name==='Graphics.Pipeline.DrawAndSwap');
  assert.ok(args.some(r=>r.slice_id===draw.id&&r.key==='debug.status'&&r.string_value==='canceled'));
  assert.ok(!args.some(r=>r.slice_id===callbacks[0].id&&r.key==='debug.status'));
  assert.ok(!args.some(r=>r.slice_id===callbacks[1].id&&r.key==='debug.status'));
  // These are retained endpoint facts, with no callback outcome classification.
  assert.ok(tracks.length>=2);assert.ok(tracks.every(r=>'counter_unit' in r&&'track_group_id' in r&&'event_type' in r));
  assert.ok(tracks.some(r=>r.name==='shared,"callback"'&&r.type==='thread_merged_track_event'&&r.parent_id_is_null==='1'));
  assert.ok(trackArgs.some(r=>r.namespace==='dimension'&&r.key==='parent_track_uuid'&&r.int_value==='8'));
  for(const namespace of ['source','dimension']) {
    assert.ok(trackArgs.some(r=>r.namespace===namespace&&r.arg_present==='1'),namespace);
    for(const t of tracks)assert.ok(trackArgs.some(r=>r.track_id===t.id&&r.namespace===namespace));
  }
  assert.ok(stats.every(r=>r.value!=='0'));assert.equal(bounds.length,1);
  await writeFile(join(out,'verification.json'),JSON.stringify({schema:1,status:'authored-callback-smoke-passed',tables:tables.map(rows=>rows.length),traceSha256:hash(trace),sourceBookendsStable:true})+'\n',{flag:'wx',mode:0o600});
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--processor');assert.equal(args[2],'--out');
    await runCallbackInventorySmoke({processor:args[1],out:args[3]});process.stdout.write('Authored callback inventory smoke passed\n');
  } catch(error) {process.stderr.write(`${error.stack}\n`);process.exitCode=1;}
}
