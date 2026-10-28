import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCESSOR_PINS, runCallbackInventoryDiagnostic } from './callback-inventory-run.mjs';
import { authoredCallbackInventoryFixture, CALLBACK_HEADERS } from './callback-inventory-smoke.mjs';
import { runCallbackInventoryCompactV2Diagnostic } from './callback-inventory-compact-v2-run.mjs';
import { parseCallbackInventoryCompactV2Csv, expandCallbackInventoryCompactV2, decodeCallbackInventoryCompactV2Text, CALLBACK_COMPACT_V2_HEADERS } from './callback-inventory-compact-v2.mjs';

export { CALLBACK_COMPACT_V2_HEADERS };
export function authoredCallbackInventoryCompactV2Fixture() {
  const annotation=body(4,concat(text(10,'invalid-utf8'),body(6,Buffer.from([255,0,254]))));
  const doubles=[['positive-infinity',Infinity],['negative-infinity',-Infinity],['not-a-number',NaN],['finite-double',1.25]].map(([name,value])=>{
    const bytes=Buffer.alloc(8);bytes.writeDoubleLE(value);
    return body(4,concat(text(10,name),varint(41n),bytes));
  });
  const literal=body(4,concat(text(10,'literal-inf'),text(6,'inf')));
  const absent=body(4,text(10,'no-typed-value'));
  const packet=body(1,concat(uint(10,1n),uint(8,1011n),uint(58,64n),body(11,concat(uint(9,3n),uint(11,10n),text(22,'cc,benchmark'),text(23,'PipelineReporter'),annotation,...doubles,literal,absent))));
  return concat(authoredCallbackInventoryFixture(),packet);
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const concat = (...parts) => Buffer.concat(parts);
const varint = value => { const out=[]; do { const n=Number(value&127n); value>>=7n; out.push(n|(value?128:0)); } while(value); return Buffer.from(out); };
const uint=(field,value)=>concat(varint(BigInt(field)*8n),varint(value));
const body=(field,bytes)=>concat(varint(BigInt(field)*8n+2n),varint(BigInt(bytes.length)),bytes);
const text=(field,value)=>body(field,Buffer.from(value));
export const FIXTURE_SHA256=Object.freeze({small:'76095ad44c271fbc8dadd1010a533dd275eb345e1ffc028a0f66c3e0ee83036b',repeated:'5b66b362126442b44adfab7cab8cefb383eb47f7cc4e606022cf0e3b094d48de'});
export const REPEATED_EVENT_COUNT=512;
export const REPEATED_TEXT='R'.repeat(512);

// Pure authored protobuf. Independent of any application/capture fixture.
export function authoredRepeatedCallbackInventoryCompactV2Fixture() {
  const packet=(...fields)=>body(1,concat(uint(10,1n),...fields));
  const event=(name,ts,annotation=Buffer.alloc(0))=>packet(uint(8,ts),body(11,concat(uint(9,3n),uint(11,10n),text(22,'authored-compact-v2'),text(23,name),annotation)));
  const result=[packet(uint(13,1n)),packet(body(60,concat(uint(1,10n),text(2,'authored-repeat-track')))),event('callback-start',1n)];
  for(let i=0;i<REPEATED_EVENT_COUNT;i++)result.push(event('PipelineReporter',BigInt(i+2),body(4,concat(text(10,'repeated'),text(6,REPEATED_TEXT)))));
  result.push(event('callback-end',514n));return concat(...result);
}

function rawCsv(bytes) {
  const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes), rows=[];
  let row=[],cell='',state='start',started=false;
  const field=()=>{row.push(cell==='[NULL]'?null:cell);cell='';state='start';};
  const record=()=>{if(started){field();rows.push(row);}row=[];started=false;};
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(state==='quoted'){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else state='closed';}else cell+=c;}
    else if(c===','){started=true;field();}
    else if(c==='\r'||c==='\n'){if(c==='\r')assert.equal(source[++i],'\n');record();}
    else if(c==='"'){assert.equal(state,'start');state='quoted';started=true;}
    else{assert.notEqual(state,'closed');cell+=c;state='unquoted';started=true;}
  }
  assert.notEqual(state,'quoted');record();
  let cursor=0;return CALLBACK_HEADERS.map((header,index)=>{
    assert.deepEqual(rows[cursor++],header);
    const next=CALLBACK_HEADERS[index+1];let end=rows.length;
    if(next){end=rows.findIndex((r,i)=>i>=cursor&&r.length===next.length&&r.every((v,j)=>v===next[j]));assert.ok(end>=cursor);}
    const data=rows.slice(cursor,end);for(const r of data)assert.equal(r.length,header.length);cursor=end;return {header,rows:data.map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]])))};
  });
}
function negativeAuthorities(result){
  assert.equal(result.diagnosticOnly,true);
  for(const key of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported','scoring'])assert.equal(result[key],false,key);
  for(const key of ['clockAdmission','displayIdentityAdmission','callbackOutcomeAdmission','populationCompleteness'])assert.equal(result[key],'not_evaluated',key);
  assert.equal(result.fps,null);assert.equal(result.duration,null);
}
function success(result){
  negativeAuthorities(result);assert.equal(result.status,'success',result.error);assert.equal(result.officialProcessor,true);assert.equal(result.authoredFixture,false);assert.equal(result.sourceBookends.stable,true);
  for(const proc of Object.values(result.processes)){
    assert.equal(proc.closed,true);assert.equal(proc.code,0);assert.equal(proc.signal,null);assert.equal(proc.error,null);
    for(const s of Object.values(proc.streams)){assert.equal(s.eof,true);assert.equal(s.closed,true);assert.equal(s.forcedDestroy,false);assert.equal(s.error,null);}
  }
}
const objects=table=>table.rows;
function compareSmall(v1,v2){
  assert.equal(v2.length,7);
  for(let i=0;i<7;i++){
    assert.deepEqual(v2[i].header,CALLBACK_HEADERS[i]);
    if(i!==5){assert.deepEqual(v2[i].rows.map(r=>v2[i].header.map(k=>r[k])),v1[i].rows.map(r=>v1[i].header.map(k=>r[k])),`SMALL deterministic table ${i}`);continue;}
    // Every stats row and its NULL structure survives. Each independent import
    // retains its own engine-analysis timing numbers in the original raw files.
    const shape=table=>objects(table).map(row=>{const copy={...row};if(row.source_bytes_hex===Buffer.from('analysis').toString('hex').toUpperCase())copy.value=row.value===null?null:'<independent-analysis-value>';return copy;});
    assert.deepEqual(shape(v2[i]),shape(v1[i]),'SMALL complete stats keys/shapes and non-analysis values');
  }
  const args=objects(v2[2]);
  const annotation=name=>args.find(row=>row.key_bytes_hex===Buffer.from('debug.'+name).toString('hex').toUpperCase());
  // Exact pinned formatter spellings: NaN is imported as SQL NULL, never a nan token.
  for(const [name,value] of [['positive-infinity','inf'],['negative-infinity','-inf'],['not-a-number',null],['finite-double','1.250000']]){
    const row=annotation(name);assert.ok(row,name);assert.equal(row.value_type_bytes_hex,'7265616C');
    assert.equal(row.real_value,value);assert.equal(row.real_value_is_null,value===null?'1':'0');
    assert.equal(row.string_value_bytes_hex,null);assert.equal(row.string_value_is_null,'1');
  }
  const literal=annotation('literal-inf');assert.ok(literal);assert.equal(literal.value_type_bytes_hex,'737472696E67');
  assert.equal(literal.string_value_bytes_hex,'696E66');assert.equal(literal.string_value_is_null,'0');assert.equal(literal.real_value,null);assert.equal(literal.real_value_is_null,'1');
assert.ok(args.some(row=>row.key_bytes_hex===Buffer.from('debug.nul').toString('hex').toUpperCase()&&row.string_value_bytes_hex===Buffer.from('A\0BXYZ').toString('hex').toUpperCase()),'original NUL bytes survive');
}
function repeatedOracle(tables){
  const [counts,slices,args]=tables.map(objects),hex=value=>Buffer.from(value).toString('hex').toUpperCase();
  assert.deepEqual(counts.map(r=>[r.name_bytes_hex,r.event_count]),[
    ['Display::FrameDisplayed','0'],['Graphics.Pipeline','0'],['Graphics.Pipeline.DrawAndSwap','0'],['PipelineReporter',String(REPEATED_EVENT_COUNT)],['callback-end','1'],['callback-start','1']
  ].map(([n,count])=>[hex(n),count]));
  assert.equal(slices.length,REPEATED_EVENT_COUNT+2);
  const selected=slices.filter(r=>r.name_bytes_hex===hex('PipelineReporter'));assert.equal(selected.length,REPEATED_EVENT_COUNT);
  assert.deepEqual(selected.map(r=>r.ts),Array.from({length:REPEATED_EVENT_COUNT},(_,i)=>String(i+2)));
  for(const slice of selected){const rows=args.filter(r=>r.slice_id===slice.id);assert.equal(rows.length,1);const r=rows[0];assert.equal(r.arg_present,'1');assert.equal(r.key_bytes_hex,hex('debug.repeated'));assert.equal(r.flat_key_bytes_hex,hex('debug.repeated'));assert.equal(r.value_type_bytes_hex,hex('string'));assert.equal(r.string_value_bytes_hex,hex(REPEATED_TEXT));assert.equal(r.string_value_is_null,'0');assert.equal(r.int_value_is_null,'1');assert.equal(r.real_value_is_null,'1');}
  assert.equal(args.length,REPEATED_EVENT_COUNT+2);
  const expectedRow=(index,values)=>Object.fromEntries(CALLBACK_HEADERS[index].map(key=>{
    if(key.endsWith('_is_null')){const base=key.slice(0,-8);const raw=base+'_bytes_hex' in values?values[base+'_bytes_hex']:values[base];return [key,raw===null||raw===undefined?'1':'0'];}
    return [key,values[key]??null];
  }));
  const exact=(index,expected)=>assert.deepEqual(tables[index].rows.map(r=>CALLBACK_HEADERS[index].map(k=>r[k])),expected.map(r=>CALLBACK_HEADERS[index].map(k=>r[k])),`LARGE full generated table ${index}`);
  exact(0,counts.map((r,i)=>({...r,arg_set_count:i===3?'1':'0'})));
  exact(1,Array.from({length:REPEATED_EVENT_COUNT+2},(_,i)=>expectedRow(1,{id:String(i),ts:String(i+1),dur:'0',depth:'0',name_bytes_hex:hex(i===0?'callback-start':i===513?'callback-end':'PipelineReporter'),category_bytes_hex:hex('authored-compact-v2'),track_id:'0',arg_set_id:i===0||i===513?null:'7',track_name_bytes_hex:hex('authored-repeat-track')})));
  exact(2,Array.from({length:REPEATED_EVENT_COUNT+2},(_,i)=>expectedRow(2,{slice_id:String(i),arg_set_id:i===0||i===513?null:'7',arg_present:i===0||i===513?'0':'1',...(i===0||i===513?{}:{flat_key_bytes_hex:hex('debug.repeated'),key_bytes_hex:hex('debug.repeated'),value_type_bytes_hex:hex('string'),string_value_bytes_hex:hex(REPEATED_TEXT)})})));
  exact(3,[expectedRow(3,{id:'0',name_bytes_hex:hex('authored-repeat-track'),type_bytes_hex:hex('global_merged_track_event'),machine_id:'0',source_arg_set_id:'4',dimension_arg_set_id:'0',track_group_id:'0',event_type_bytes_hex:hex('slice')})]);
  exact(4,[['dimension','merge_key_type','int','0',null],['dimension','merge_key_value','string',null,'authored-repeat-track'],['dimension','parent_track_uuid','int','0',null],['dimension','track_compressor_idx','int','0',null],['source','is_root_in_scope','bool','0',null],['source','source','string',null,'descriptor'],['source','trace_id','int','10',null]].map(([namespace,key,type,integer,string])=>expectedRow(4,{track_id:'0',namespace_bytes_hex:hex(namespace),arg_set_id:namespace==='dimension'?'0':'4',arg_present:'1',flat_key_bytes_hex:hex(key),key_bytes_hex:hex(key),value_type_bytes_hex:hex(type),int_value:integer,string_value_bytes_hex:string===null?null:hex(string)})));
  const stats=objects(tables[5]);assert.ok(stats.every(r=>r.value!==null&&/^[1-9][0-9]*$/.test(r.value)));
  exact(5,['guess_trace_type_duration_ns','parse_trace_duration_ns'].map((name,i)=>expectedRow(5,{name_bytes_hex:hex(name),severity_bytes_hex:hex('info'),source_bytes_hex:hex('analysis'),value:stats[i]?.value})));
  exact(6,[expectedRow(6,{start_ts:'1',end_ts:'514'})]);
}
export async function runCallbackInventoryCompactV2Smoke({processor,out}){
  assert.ok(isAbsolute(processor)&&isAbsolute(out));await mkdir(out,{mode:0o700});
  const fixtures=[['small',authoredCallbackInventoryCompactV2Fixture()],['repeated',authoredRepeatedCallbackInventoryCompactV2Fixture()]],verification=[];
  for(const [name,trace] of fixtures){
    assert.equal(hash(trace),FIXTURE_SHA256[name],`${name} frozen authored fixture`);
    const path=join(out,`${name}.pftrace`);await writeFile(path,trace,{flag:'wx',mode:0o600});
    const config={trace:{path,bytes:trace.length,sha256:hash(trace)},processor:{path:processor,sha256:PROCESSOR_PINS[`${process.platform}-${process.arch}`]},phases:['callback-start','callback-end']};
    const v1=await runCallbackInventoryDiagnostic({...config,out:join(out,`${name}-v1`)});
    const v2=await runCallbackInventoryCompactV2Diagnostic({...config,out:join(out,`${name}-v2`)});success(v2);
    const compact=await readFile(join(out,`${name}-v2`,'query.stdout'));assert.ok(compact.length<=262144);
    const parsed=parseCallbackInventoryCompactV2Csv(compact);const expanded=expandCallbackInventoryCompactV2(parsed);
    if(name==='small'){success(v1);compareSmall(rawCsv(await readFile(join(out,'small-v1','query.stdout'))),expanded);assert.ok(objects(expanded[2]).some(row=>row.string_value_bytes_hex==='FF00FE'));assert.throws(()=>decodeCallbackInventoryCompactV2Text(parsed));assert.equal(expandCallbackInventoryCompactV2(parsed),expanded);}
    else{negativeAuthorities(v1);assert.equal(v1.status,'failure');assert.match(v1.error,/stdout.*(?:limit|cap|exceed)|(?:limit|cap|exceed).*stdout/i);repeatedOracle(expanded);}
    verification.push({fixture:name,traceBytes:trace.length,traceSha256:hash(trace),v1Status:v1.status,v2Status:v2.status,v2StdoutBytes:compact.length,rows:expanded.map(t=>t.rows.length)});
  }
  await writeFile(join(out,'verification.json'),JSON.stringify({schema:1,status:'authored-callback-compact-v2-smoke-passed',repeatCount:REPEATED_EVENT_COUNT,repeatTextBytes:Buffer.byteLength(REPEATED_TEXT),fixtures:verification})+'\n',{flag:'wx',mode:0o600});return verification;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--processor');assert.equal(args[2],'--out');await runCallbackInventoryCompactV2Smoke({processor:args[1],out:args[3]});process.stdout.write('Authored callback inventory compact V2 smoke passed\n');}
  catch(error){process.stderr.write(`${error.stack}\n`);process.exitCode=1;}
}
