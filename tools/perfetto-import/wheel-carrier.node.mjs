import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import * as runner from './run.mjs';
import * as smoke from './smoke.mjs';
const execFile = promisify(callback);
const hash = x => createHash('sha256').update(x).digest('hex');
const version = `${runner.EXPECTED_VERSION}\n`;
const prefix = 'native-wheel-witness-v1:';
const families = ['LatencyInfo.Flow', 'WidgetBaseInputHandler::OnHandleInputEvent', 'EventDispatch', 'InputLatency::MouseWheel', 'EventLatency'];
function authority(r) {
  assert.equal(r.queryPolicy, 'wheel-carrier-compact-v1'); assert.equal(r.rawRowsExported, true);
  for (const k of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported','scoring']) assert.equal(r[k], false, k);
  assert.equal(r.clockAdmission, 'not_evaluated'); assert.equal(r.fps, null); assert.equal(r.duration, null);
}
async function fixture(code = "process.stdout.write('rows\\n');", versionText = version) {
  const root = await mkdtemp(join(tmpdir(), 'wheel-exporter-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';import {spawn} from 'node:child_process';\nif(process.argv.includes('--version'))process.stdout.write(${JSON.stringify(versionText)});else{${code}}\n`;
  const path = join(root, 'processor.mjs'); await writeFile(path, source); await chmod(path, 0o700);
  const tracePath = join(root, 'trace'); await writeFile(tracePath, trace);
  return {root, options: {trace:{path:tracePath,bytes:trace.length,sha256:hash(trace)},processor:{path,sha256:hash(source)},phases:["begin'quoted",'LatencyInfo.Flow'],out:join(root,'out')}};
}
test('wheel has separate production and authored fixed entrypoints', () => {
  assert.equal(typeof runner.runWheelCarrierDiagnostic,'function'); assert.equal(typeof runner.runAuthoredFixtureWheelCarrierDiagnostic,'function');
});
test('wheel selects fixed SQL and source bookends, never caller authority or prefix', async () => {
  assert.equal(typeof runner.runAuthoredFixtureWheelCarrierDiagnostic,'function');
  const {options} = await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const r = await runner.runAuthoredFixtureWheelCarrierDiagnostic({...options,sql:'SELECT caller',prefix:'other:',queryPolicy:'full',fps:60,qualification:true,authoredFixture:false});
  assert.equal(r.status,'success',r.error); authority(r); assert.equal(r.authoredFixture,true); assert.equal(r.officialProcessor,false);
  const source = await readFile(new URL('./wheel-carrier.sql',import.meta.url),'utf8');
  const sql = source.replaceAll('__PHASE_LITERALS__',"'begin''quoted', 'LatencyInfo.Flow'").replace('__PHASE_VALUES__',"('begin''quoted'), ('LatencyInfo.Flow')");
  assert.equal(await readFile(join(options.out,'query.stdout'),'utf8'),sql); assert.equal(r.sql.sourceSha256,hash(source));
  assert.deepEqual(r.before,r.after); assert.deepEqual(r.sourceBookends.before,r.sourceBookends.after); assert.equal(r.sourceBookends.stable,true);
  assert.deepEqual(Object.keys(r.sourceBookends.before).sort(),['executedSql','runner','sqlSource']);
  assert.equal(r.sourceBookends.before.executedSql.sha256,hash(sql)); assert.equal(r.sourceBookends.before.sqlSource.sha256,hash(source));
  await assert.rejects(runner.runAuthoredFixtureWheelCarrierDiagnostic(options),/EEXIST/);
});
test('wheel production and CLI reject authored identity and unpinned executable', async () => {
  assert.equal(typeof runner.runWheelCarrierDiagnostic,'function');
  const {root,options}=await fixture(); const r=await runner.runWheelCarrierDiagnostic({...options,authoredFixture:true});
  authority(r); assert.equal(r.status,'failure'); assert.equal(r.authoredFixture,false); assert.equal(r.officialProcessor,false); assert.deepEqual(r.processes,{}); assert.match(r.error,/platform pin/);
  options.out=join(root,'cli');const config=join(root,'config.json'); await writeFile(config,JSON.stringify({...options,authoredFixture:true}));
  await assert.rejects(execFile(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'--wheel-carrier-config',config]),e=>{assert.equal(e.code,1);assert.match(e.stdout,/platform pin/);return true;});
  authority(JSON.parse(await readFile(join(options.out,'manifest.json'))));
});
test('wheel retains process and stream failures, exact bounds, and changed input refusals', async () => {
  assert.equal(typeof runner.runAuthoredFixtureWheelCarrierDiagnostic,'function');
  for(const [name,code,pattern,cap] of [
    ['stdout','process.stdout.write(Buffer.alloc(262145));setInterval(()=>{},1000);',/stdout limit/,262144],
    ['stderr','process.stderr.write(Buffer.alloc(65537));setInterval(()=>{},1000);',/stderr limit/,65536],
    ['deadline','setInterval(()=>{},1000);',/deadline/],
    ['exit','process.stdout.write("partial");process.exitCode=7;',/unsuccessfully/],
    ['trace','fs.appendFileSync(process.argv.at(-1),"changed");',/changed|mismatch/],
    ['processor','fs.appendFileSync(process.argv[1],"changed");',/changed|mismatch/],
    ['sql','fs.appendFileSync(process.argv[4],"changed");',/changed|mismatch/],
    ['held-pipe','spawn(process.execPath,["-e","setTimeout(()=>{},1500)"],{stdio:["ignore",1,2]});',/deadline/],
  ]) {
    const {options}=await fixture(code);const r=await runner.runAuthoredFixtureWheelCarrierDiagnostic({...options,deadlineMs:['deadline','held-pipe'].includes(name)?700:60000});
    authority(r);assert.equal(r.status,'failure',name);assert.match(r.error,pattern,name);assert.equal(r.processes.query.closed,true,name);
    if(cap)assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
    if(name==='sql')assert.equal(r.sourceBookends.stable,false);
    if(!['trace','processor'].includes(name))assert.deepEqual(r.before,r.after);
  }
});
test('wheel validation refuses version/RPC, trace extent, duplicate phases and raised deadline', async () => {
  assert.equal(typeof runner.runAuthoredFixtureWheelCarrierDiagnostic,'function');
  for(const text of ['wrong\n',version.replace('version: 14','version: 13')]) {
    const {options}=await fixture('',text);const r=await runner.runAuthoredFixtureWheelCarrierDiagnostic(options);authority(r);assert.equal(r.status,'failure');assert.match(r.error,/version mismatch/);assert.equal(r.processes.query,undefined);
  }
  for(const patch of [{deadlineMs:60001},{phases:['same','same']},{trace:{bytes:33554433}}]) {
    const {options}=await fixture();const r=await runner.runAuthoredFixtureWheelCarrierDiagnostic({...options,...patch});authority(r);assert.equal(r.status,'failure');assert.deepEqual(r.processes,{});
  }
  const {options}=await fixture();options.trace.bytes++;const r=await runner.runAuthoredFixtureWheelCarrierDiagnostic(options);assert.equal(r.status,'failure');assert.equal(r.processes.query,undefined);
});
test('wheel source bookends detect fixed runner and SQL source mutations in isolated copies', async () => {
  for(const file of ['run.mjs','wheel-carrier.sql']) {
    const root=await mkdtemp(join(tmpdir(),'wheel-source-copy-'));
    for(const name of ['run.mjs','wheel-carrier.sql'])await writeFile(join(root,name),await readFile(new URL(`./${name}`,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,'run.mjs')).href);
    const {options}=await fixture(`fs.appendFileSync(${JSON.stringify(join(root,file))},${JSON.stringify('\n// changed\n')});`);
    const r=await copied.runAuthoredFixtureWheelCarrierDiagnostic(options);authority(r);assert.equal(r.status,'failure');assert.equal(r.sourceBookends.stable,false);assert.match(r.error,/source identity changed/);
    assert.equal(r.processes.query.closed,true);assert.deepEqual(r.before,r.after);
  }
});
test('wheel exact stdout and stderr caps remain usable without clipping', async () => {
  for(const [name,cap]of [['stdout',262144],['stderr',65536]]) {
    const {options}=await fixture(`process.${name}.write(Buffer.alloc(${cap}));`);const r=await runner.runAuthoredFixtureWheelCarrierDiagnostic(options);
    authority(r);assert.equal(r.status,'success',r.error);assert.equal(r.processes.query.streams[name].observedBytes,cap);assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
  }
});
test('wheel SQL preserves binary full-prefix counts, unsafe parent shapes and typed multiplicity', async () => {
  assert.equal(typeof runner.runWheelCarrierDiagnostic,'function');
  const sql=await readFile(new URL('./wheel-carrier.sql',import.meta.url),'utf8');assert.doesNotMatch(sql,/\bLIMIT\b|\bUNION ALL\b|\bLIKE\b|\bGLOB\b/i);
  const {DatabaseSync}=await import('node:sqlite'); const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE slice(id,ts,dur,depth,parent_id,name TEXT COLLATE NOCASE,category,track_id,arg_set_id);
      CREATE TABLE track(id,name);CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
      CREATE TABLE args(arg_set_id,flat_key TEXT COLLATE NOCASE,key TEXT COLLATE NOCASE,value_type TEXT COLLATE NOCASE,int_value,string_value,real_value);
      CREATE TABLE stats(name,idx,severity,source,value);CREATE TABLE trace_bounds(start_ts,end_ts);
      INSERT INTO slice VALUES
      (1,1,100,0,NULL,'outer',NULL,1,900),(2,2,90,1,1,'WidgetBaseInputHandler::OnHandleInputEvent','input',1,100),
      (3,3,80,2,2,'LatencyInfo.Flow','input',1,101),(4,4,70,3,3,'intermediate',NULL,1,900),
      (5,5,0,4,4,'native-wheel-witness-v1:A','blink.user_timing',1,102),
      (6,6,0,0,NULL,'native-wheel-witness-v1:a','blink.user_timing',2,102),
      (7,7,0,0,NULL,'native-wheel-witness-v1:A','blink.user_timing',3,102),
      (8,8,-1,7,888,'EventDispatch',NULL,2,NULL),(9,9,0,1,10,'EventLatency',NULL,2,NULL),(10,10,0,2,9,'cycle',NULL,3,900),
      (11,11,0,0,NULL,'native-wheel-witness-v1x:bad',NULL,1,900),(12,12,0,0,NULL,'NATIVE-wheel-witness-v1:bad',NULL,1,900),
      (13,13,0,0,NULL,'latencyinfo.flow',NULL,1,900),(14,14,0,0,NULL,'LatencyInfo.Flow',NULL,2,101),
      (15,15,0,0,NULL,'phase',NULL,2,NULL);
      INSERT INTO args VALUES
      (900,'ancestorOnly','ancestorOnly','string',NULL,'excluded',NULL),
      (100,'debug.event','debug.event','string',NULL,'MouseWheel',NULL),
      (101,'chrome_latency_info.trace_id','chrome_latency_info.trace_id','int',-9223372036854775808,NULL,NULL),
      (101,'chrome_latency_info.trace_id','chrome_latency_info.trace_id','int',-9223372036854775808,NULL,NULL),
      (101,'chrome_latency_info.trace_id','chrome_latency_info.trace_id','uint',9007199254740995,NULL,NULL),
      (101,'chrome_latency_info.trace_id','chrome_latency_info.trace_id','string',NULL,'wrong type',NULL),
      (101,'chrome_latency_info.trace_id','chrome_latency_info.trace_id','real',NULL,NULL,1.5),
      (102,'A','quote"key','string',NULL,'é🧪'||char(10)||'line'||char(13)||char(10)||'end',NULL),
      (102,'a','empty','string',NULL,'',NULL),(102,'a','literal','string',NULL,'[NULL]',NULL),(102,NULL,NULL,NULL,NULL,NULL,NULL);
      INSERT INTO stats VALUES('zero',0,'info','analysis',0),('loss',0,'error','trace',2);
      INSERT INTO trace_bounds VALUES(1,100),(101,200);`);
    const tables=[];
    for(const s of sql.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE chrome.graphics_pipeline;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').replaceAll('__PHASE_LITERALS__',"'phase', 'LatencyInfo.Flow', 'native-wheel-witness-v1:A', 'absent'").replace('__PHASE_VALUES__',"('phase'), ('LatencyInfo.Flow'), ('native-wheel-witness-v1:A'), ('absent')").split(';').filter(x=>x.trim())) {
      if(/^\s*CREATE VIEW/i.test(s))db.exec(s);else{const q=db.prepare(s);q.setReadBigInts(true);tables.push(q.all().map(x=>({...x})));}
    }
    assert.equal(tables.length,6);const [counts,nodes,compact,dictionary,stats,bounds]=tables;
    assert.deepEqual(counts.map(x=>x.name),[...families,'phase',prefix+'A',prefix+'a','absent'].sort());
    assert.equal(counts.find(x=>x.name==='LatencyInfo.Flow').event_count,2n); assert.equal(counts.find(x=>x.name===prefix+'A').event_count,2n);assert.equal(counts.find(x=>x.name===prefix+'a').event_count,1n);
    assert.equal(counts.find(x=>x.name==='InputLatency::MouseWheel').event_count,0n);assert.equal(counts.find(x=>x.name==='absent').event_count,0n);
    assert.deepEqual(nodes.map(x=>x.id),[1n,2n,3n,4n,5n,6n,7n,8n,9n,10n,14n,15n]);
    assert.deepEqual(nodes.filter(x=>!x.is_selected).map(x=>x.id),[1n,4n,10n]);assert.equal(nodes.find(x=>x.id===8n).parent_status,'missing_parent');assert.equal(nodes.find(x=>x.id===8n).duration_status,'unclosed');
    const args=smoke.reconstructScopeArguments(compact,dictionary);assert.equal(args.some(x=>x.key==='ancestorOnly'),false);
    assert.equal(args.filter(x=>x.value_type==='int'&&x.int_value===-9223372036854775808n).length,4);assert.equal(args.filter(x=>x.value_type==='uint'&&x.int_value===9007199254740995n).length,2);
    assert.equal(dictionary.find(x=>x.key==='chrome_latency_info.trace_id'&&x.value_type==='int').arg_occurrence_count,4n);
    assert.equal(dictionary.filter(x=>x.name===prefix+'A'&&['A','a'].includes(x.flat_key)).length,3);
    assert.equal(args.find(x=>x.key==='empty').string_value,'');assert.equal(args.find(x=>x.key==='literal').string_value,'[NULL]');assert.equal(args.find(x=>x.key==='quote""key').string_value,'é🧪\nline\r\nend');
    assert.equal(stats.length,1);assert.equal(stats[0].name,'loss');assert.equal(bounds.length,2);
  } finally {db.close();}
});
test('wheel official smoke fixture is deterministic and separately selected', () => {
  assert.equal(typeof smoke.authoredWheelCarrierFixture,'function');const bytes=smoke.authoredWheelCarrierFixture();assert.ok(Buffer.isBuffer(bytes));assert.deepEqual(bytes,smoke.authoredWheelCarrierFixture());
  assert.equal(bytes.length,1047);assert.equal(hash(bytes),'27631b426b9e243fcb5f460617d3a4c8d4edbdade3a00841a6ebc55e1659d6f5');
});
test('wheel renders placeholder and replacement metacharacters as literal phase data', async () => {
  const phases=['__PHASE_VALUES__','__PHASE_LITERALS__','$&','$`',"$'"];
  const {options}=await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const result=await runner.runAuthoredFixtureWheelCarrierDiagnostic({...options,phases});
  assert.equal(result.status,'success',result.error);
  const sql=await readFile(join(options.out,'query.stdout'),'utf8');
  const literals="'__PHASE_VALUES__', '__PHASE_LITERALS__', '$&', '$`', '$'''";
  assert.ok(sql.includes(`OR name COLLATE BINARY IN (${literals})`));
  assert.ok(sql.includes("phases(name) AS (VALUES ('__PHASE_VALUES__'), ('__PHASE_LITERALS__'), ('$&'), ('$`'), ('$'''))"));
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE slice(id,ts,dur,depth,parent_id,name,category,track_id,arg_set_id);
      CREATE TABLE track(id,name);CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
      CREATE TABLE args(arg_set_id,flat_key,key,value_type,int_value,string_value,real_value);
      CREATE TABLE stats(name,idx,severity,source,value);CREATE TABLE trace_bounds(start_ts,end_ts);`);
    const insert=db.prepare('INSERT INTO slice VALUES (?, ?, 0, 0, NULL, ?, NULL, 1, NULL)');
    phases.forEach((phase,i)=>insert.run(i+1,i+1,phase));
    const tables=[];
    for(const statement of sql.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE chrome.graphics_pipeline;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').split(';').filter(x=>x.trim())) {
      if(/^\s*CREATE VIEW/i.test(statement))db.exec(statement);else tables.push(db.prepare(statement).all());
    }
    assert.equal(tables.length,6);
    assert.deepEqual(tables[1].map(row=>row.name),phases);
    for(const phase of phases)assert.equal(tables[0].find(row=>row.name===phase).event_count,1);
  } finally {db.close();}
});
