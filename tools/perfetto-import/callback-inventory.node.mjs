import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import * as runner from './callback-inventory-run.mjs';
const execFile = promisify(callback);
const hash = x => createHash('sha256').update(x).digest('hex');
const version = `${runner.EXPECTED_VERSION}\n`;
const families = ['Graphics.Pipeline.DrawAndSwap','Display::FrameDisplayed','Graphics.Pipeline','PipelineReporter'];
function authority(r) {
  assert.equal(r.queryPolicy, 'callback-inventory-v1'); assert.equal(r.rawRowsExported, true);
  for (const k of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported','scoring']) assert.equal(r[k], false, k);
  for (const k of ['displayIdentityAdmission','callbackOutcomeAdmission','populationCompleteness']) assert.equal(r[k], 'not_evaluated'); assert.equal(r.clockAdmission, 'not_evaluated'); assert.equal(r.fps, null); assert.equal(r.duration, null);
}
async function fixture(code = "process.stdout.write('rows\\n');", versionText = version) {
  const root = await mkdtemp(join(tmpdir(), 'wheel-exporter-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';import {spawn} from 'node:child_process';\nif(process.argv.includes('--version'))process.stdout.write(${JSON.stringify(versionText)});else{${code}}\n`;
  const path = join(root, 'processor.mjs'); await writeFile(path, source); await chmod(path, 0o700);
  const tracePath = join(root, 'trace'); await writeFile(tracePath, trace);
  return {root, options: {trace:{path:tracePath,bytes:trace.length,sha256:hash(trace)},processor:{path,sha256:hash(source)},phases:["begin'quoted",'LatencyInfo.Flow'],out:join(root,'out')}};
}
test('callback has separate production and authored fixed entrypoints', () => {
  assert.equal(typeof runner.runCallbackInventoryDiagnostic,'function'); assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryDiagnostic,'function');
});
test('callback selects fixed SQL and source bookends, never caller authority or prefix', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryDiagnostic,'function');
  const {options} = await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const r = await runner.runAuthoredFixtureCallbackInventoryDiagnostic({...options,sql:'SELECT caller',prefix:'other:',queryPolicy:'full',fps:60,qualification:true,authoredFixture:false});
  assert.equal(r.status,'success',r.error); authority(r); assert.equal(r.authoredFixture,true); assert.equal(r.officialProcessor,false);
  const source = await readFile(new URL('./callback-inventory.sql',import.meta.url),'utf8');
  const sql = source.replaceAll('__PHASE_LITERALS__',"'begin''quoted', 'LatencyInfo.Flow'").replace('__PHASE_VALUES__',"('begin''quoted'), ('LatencyInfo.Flow')");
  assert.equal(await readFile(join(options.out,'query.stdout'),'utf8'),sql); assert.equal(r.sql.sourceSha256,hash(source));
  assert.deepEqual(r.before,r.after); assert.deepEqual(r.sourceBookends.before,r.sourceBookends.after); assert.equal(r.sourceBookends.stable,true);
  assert.deepEqual(Object.keys(r.sourceBookends.before).sort(),['executedSql','runner','sqlSource']);
  assert.equal(r.sourceBookends.before.executedSql.sha256,hash(sql)); assert.equal(r.sourceBookends.before.sqlSource.sha256,hash(source));
  await assert.rejects(runner.runAuthoredFixtureCallbackInventoryDiagnostic(options),/EEXIST/);
});
test('callback production and CLI reject authored identity and unpinned executable', async () => {
  assert.equal(typeof runner.runCallbackInventoryDiagnostic,'function');
  const {root,options}=await fixture(); const r=await runner.runCallbackInventoryDiagnostic({...options,authoredFixture:true});
  authority(r); assert.equal(r.status,'failure'); assert.equal(r.authoredFixture,false); assert.equal(r.officialProcessor,false); assert.deepEqual(r.processes,{}); assert.match(r.error,/platform pin/);
  options.out=join(root,'cli');const config=join(root,'config.json'); await writeFile(config,JSON.stringify({...options,authoredFixture:true}));
  await assert.rejects(execFile(process.execPath,[new URL('./callback-inventory-run.mjs',import.meta.url).pathname,'--callback-inventory-config',config]),e=>{assert.equal(e.code,1);assert.match(e.stdout,/platform pin/);return true;});
  authority(JSON.parse(await readFile(join(options.out,'manifest.json'))));
});
test('callback retains process and stream failures, exact bounds, and changed input refusals', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryDiagnostic,'function');
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
    const {options}=await fixture(code);const r=await runner.runAuthoredFixtureCallbackInventoryDiagnostic({...options,deadlineMs:['deadline','held-pipe'].includes(name)?700:60000});
    authority(r);assert.equal(r.status,'failure',name);assert.match(r.error,pattern,name);assert.equal(r.processes.query.closed,true,name);
    if(cap)assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
    if(name==='sql')assert.equal(r.sourceBookends.stable,false);
    if(!['trace','processor'].includes(name))assert.deepEqual(r.before,r.after);
  }
});
test('callback validation refuses version/RPC, trace extent, duplicate phases and raised deadline', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryDiagnostic,'function');
  for(const text of ['wrong\n',version.replace('version: 14','version: 13')]) {
    const {options}=await fixture('',text);const r=await runner.runAuthoredFixtureCallbackInventoryDiagnostic(options);authority(r);assert.equal(r.status,'failure');assert.match(r.error,/version mismatch/);assert.equal(r.processes.query,undefined);
  }
  for(const patch of [{deadlineMs:60001},{phases:['same','same']},{trace:{bytes:33554433}}]) {
    const {options}=await fixture();const r=await runner.runAuthoredFixtureCallbackInventoryDiagnostic({...options,...patch});authority(r);assert.equal(r.status,'failure');assert.deepEqual(r.processes,{});
  }
  const {options}=await fixture();options.trace.bytes++;const r=await runner.runAuthoredFixtureCallbackInventoryDiagnostic(options);assert.equal(r.status,'failure');assert.equal(r.processes.query,undefined);
});
test('callback source bookends detect fixed runner and SQL source mutations in isolated copies', async () => {
  for(const file of ['callback-inventory-run.mjs','callback-inventory.sql']) {
    const root=await mkdtemp(join(tmpdir(),'wheel-source-copy-'));
    for(const name of ['callback-inventory-run.mjs','callback-inventory.sql'])await writeFile(join(root,name),await readFile(new URL(`./${name}`,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,'callback-inventory-run.mjs')).href);
    const {options}=await fixture(`fs.appendFileSync(${JSON.stringify(join(root,file))},${JSON.stringify('\n// changed\n')});`);
    const r=await copied.runAuthoredFixtureCallbackInventoryDiagnostic(options);authority(r);assert.equal(r.status,'failure');assert.equal(r.sourceBookends.stable,false);assert.match(r.error,/source identity changed/);
    assert.equal(r.processes.query.closed,true);assert.deepEqual(r.before,r.after);
  }
});
test('callback exact stdout and stderr caps remain usable without clipping', async () => {
  for(const [name,cap]of [['stdout',262144],['stderr',65536]]) {
    const {options}=await fixture(`process.${name}.write(Buffer.alloc(${cap}));`);const r=await runner.runAuthoredFixtureCallbackInventoryDiagnostic(options);
    authority(r);assert.equal(r.status,'success',r.error);assert.equal(r.processes.query.streams[name].observedBytes,cap);assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
  }
});

test('fixed SQL retains selected occurrences and binary names with complete typed track context', async () => {
  const sql = await readFile(new URL('./callback-inventory.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/\bLIMIT\b|\bLIKE\b|\bGLOB\b|duration_status|display_trace_id|surface_frame_trace_id/i);
  const {DatabaseSync}=await import('node:sqlite'); const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE slice(id,ts,dur,depth,parent_id,name TEXT COLLATE NOCASE,category,track_id,arg_set_id);
    CREATE TABLE track(id,name,type,parent_id,machine_id,source_arg_set_id,dimension_arg_set_id,track_group_id,event_type,counter_unit,utid,upid);
    CREATE VIEW __intrinsic_track AS SELECT * FROM track; CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
    CREATE TABLE args(arg_set_id,flat_key TEXT COLLATE NOCASE,key TEXT COLLATE NOCASE,value_type TEXT COLLATE NOCASE,int_value,string_value TEXT COLLATE NOCASE,real_value);
    CREATE TABLE stats(name TEXT COLLATE NOCASE,idx,severity,source,value); CREATE TABLE trace_bounds(start_ts,end_ts);
    INSERT INTO slice VALUES
    (1,1,-1,3,999,'Graphics.Pipeline.DrawAndSwap',NULL,1,100),
    (2,2,0,0,NULL,'Display::FrameDisplayed','',1,101),
    (3,3,-2,0,NULL,'PipelineReporter','[NULL]',2,NULL),
    (4,4,8,0,NULL,'PipelineReporter',NULL,1,100),
    (5,5,0,0,NULL,'phase',NULL,3,102),
    (6,6,0,0,NULL,'PHASE',NULL,4,104),
    (7,7,0,0,NULL,'graphics.pipeline',NULL,4,104),
    (9007199254740995,8,0,0,NULL,'phase',NULL,1,100),
    (9,9,0,0,NULL,'phase',NULL,999,NULL);
    INSERT INTO track VALUES
    (1,'shared','track_event',888,NULL,100,100,NULL,'slice',NULL,7,8),
    (2,'','track_event',NULL,2,NULL,NULL,3,'slice','[NULL]',NULL,NULL),
    (3,'[NULL]',NULL,NULL,NULL,102,103,NULL,NULL,'',NULL,NULL),
    (4,'excluded',NULL,NULL,NULL,104,104,NULL,NULL,NULL,NULL,NULL);
    INSERT INTO thread_or_process_slice VALUES(1,7,70,8,80,'','[NULL]');
    INSERT INTO args VALUES
    (100,'A','quote"key','int',9007199254740995,NULL,NULL),
    (100,'A','quote"key','int',9007199254740995,NULL,NULL),
    (100,'a','empty','string',NULL,'',NULL),
    (100,'a','literal','string',NULL,'[NULL]',NULL),
    (100,'a','line','string',NULL,'é🧪'||char(10)||'line'||char(13)||char(10)||'end',NULL),
    (100,'a','canceled','bool',1,NULL,NULL),
    (101,NULL,NULL,NULL,NULL,NULL,NULL),
    (102,'reporter','partial','string',NULL,'dropped',NULL),
    (104,'excluded','excluded','string',NULL,'excluded',NULL);
    INSERT INTO stats VALUES('zero',0,'info','analysis',0),('Z',NULL,NULL,'',-1),('a',1,'error','[NULL]',2);
    INSERT INTO trace_bounds VALUES(1,8),(9,10);`);
    const nulText='A\0BXYZé🧪"\r\n';
    db.prepare('UPDATE slice SET category = ? WHERE id = 4').run(nulText);
    db.prepare('UPDATE track SET name = ?, type = ?, event_type = ?, counter_unit = ? WHERE id = 1').run(nulText,nulText,nulText,nulText);
    db.prepare('INSERT INTO thread_or_process_slice VALUES(4,7,70,8,80,?,?)').run(nulText,nulText);
    db.prepare("UPDATE args SET flat_key = ?, key = ?, value_type = ?, string_value = ? WHERE key = 'canceled'").run(nulText,nulText,nulText,nulText);
    db.prepare("UPDATE stats SET severity = ?, source = ? WHERE name = 'a'").run(nulText,nulText);
    const rendered=sql.replaceAll('__PHASE_LITERALS__',"'phase', 'absent', 'PipelineReporter'").replaceAll('__PHASE_VALUES__',"('phase'), ('absent'), ('PipelineReporter')");
    const tables=[];
    for(const s of rendered.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE slices.with_context;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').split(';').filter(x=>x.trim())) {
      if(/^\s*CREATE VIEW/i.test(s))db.exec(s);else {const q=db.prepare(s);q.setReadBigInts(true);tables.push(q.all().map(x=>({...x})));}
    }
    assert.ok('name_bytes_hex' in tables[0][0], 'all text must export as lossless byte hex');
    const {CALLBACK_HEADERS,decodeCallbackInventorySmokeRows:decode}=await import('./callback-inventory-smoke.mjs');
    for(let i=0;i<tables.length;i++)for(const row of tables[i])assert.deepEqual(Object.keys(row),CALLBACK_HEADERS[i]);
    const decoded=tables.map(decode);
    assert.equal(tables.length,7);const [counts,slices,args,tracks,trackArgs,stats,bounds]=decoded;
    assert.deepEqual(counts.map(r=>r.name),[...families,'phase','absent'].sort());
    assert.equal(counts.find(r=>r.name==='Graphics.Pipeline').event_count,0n);
    assert.equal(counts.find(r=>r.name==='absent').event_count,0n);
    assert.equal(counts.find(r=>r.name==='PipelineReporter').event_count,2n);
    assert.equal(counts.find(r=>r.name==='phase').event_count,3n);
    assert.deepEqual(slices.map(r=>r.id),[1n,2n,3n,4n,5n,9007199254740995n,9n]);
    assert.equal(slices[0].dur,-1n);assert.equal(slices[2].dur,-2n);assert.equal(slices[0].parent_id,999n);
    assert.equal(slices[0].category_is_null,1n);assert.equal(slices[1].category,'');assert.equal(slices[1].category_is_null,0n);
    assert.equal(slices[2].category,'[NULL]');assert.equal(slices[2].category_is_null,0n);
    assert.equal(slices[0].process_name,'');assert.equal(slices[0].thread_name,'[NULL]');assert.equal(slices[1].process_name_is_null,1n);
    assert.equal(args.filter(r=>r.int_value===9007199254740995n).length,6);
    assert.equal(args.find(r=>r.slice_id===2n).arg_present,1n);assert.equal(args.find(r=>r.slice_id===2n).key_is_null,1n);
    assert.equal(args.find(r=>r.slice_id===3n).arg_present,0n);
    assert.ok(args.some(r=>r.key==='empty'&&r.string_value===''&&r.string_value_is_null===0n));
    assert.ok(args.some(r=>r.key==='literal'&&r.string_value==='[NULL]'&&r.string_value_is_null===0n));
    assert.ok(args.some(r=>r.key==='line'&&r.string_value==='é🧪\nline\r\nend'));
    assert.ok(!args.some(r=>r.key==='excluded'));
    assert.deepEqual(tracks.map(r=>r.id),[1n,2n,3n]);assert.equal(tracks[0].parent_id,888n);assert.equal(tracks[0].source_arg_set_id,100n);
    for(const ns of ['source','dimension']) {
      const rows=trackArgs.filter(r=>r.track_id===1n&&r.namespace===ns);assert.equal(rows.length,6);assert.equal(rows.filter(r=>r.int_value===9007199254740995n).length,2);
      assert.equal(trackArgs.find(r=>r.track_id===2n&&r.namespace===ns).arg_present,0n);
    }
    assert.equal(trackArgs.find(r=>r.track_id===3n&&r.namespace==='dimension').arg_set_id,103n);
    assert.equal(trackArgs.find(r=>r.track_id===3n&&r.namespace==='dimension').arg_present,0n);
    assert.deepEqual(stats.map(r=>r.name),['Z','a']);assert.equal(bounds.length,2);
    const rawNulHex=Buffer.from(nulText).toString('hex').toUpperCase();
    for(const [table,index,fields] of [
      [1,3,['category','process_name','thread_name']],
      [3,0,['name','type','event_type','counter_unit']],
      [5,1,['severity','source']],
    ]) for(const field of fields) {
      assert.equal(tables[table][index][`${field}_bytes_hex`],rawNulHex,field);
      assert.equal(decoded[table][index][field],nulText,field);
    }
    for(const table of [2,4]) {
      const raw=tables[table].filter(row=>row.key_bytes_hex===rawNulHex);
      assert.ok(raw.length>0);
      for(const row of raw)for(const field of ['flat_key','key','value_type','string_value'])assert.equal(row[`${field}_bytes_hex`],rawNulHex,field);
    }
    assert.ok(tables[4].every(row=>['736F75726365','64696D656E73696F6E'].includes(row.namespace_bytes_hex)));
    // Every nullable selected projection has an explicit NULL flag.
    for(const [rows,excluded] of [[slices,['id']],[tracks,['id']]]) for(const key of Object.keys(rows[0]).filter(k=>!k.endsWith('_is_null')&&!k.endsWith('_bytes_hex')&&!excluded.includes(k))) assert.ok(`${key}_is_null` in rows[0],key);
    // Raw export also retains non-UTF8 bytes; only the convenience decoder refuses.
    db.exec('DROP VIEW _callback_track_sets; DROP VIEW _callback_tracks; DROP VIEW _callback_selected;');
    db.exec("UPDATE args SET string_value = CAST(X'FF0041' AS TEXT) WHERE key = 'literal'");
    const rawInvalid=[];
    for(const statement of rendered.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE slices.with_context;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').split(';').filter(x=>x.trim())) {
      if(/^\s*CREATE VIEW/i.test(statement))db.exec(statement);else {const q=db.prepare(statement);q.setReadBigInts(true);rawInvalid.push(q.all().map(row=>({...row})));}
    }
    assert.ok(rawInvalid[2].some(row=>row.string_value_bytes_hex==='FF0041'));
    assert.throws(()=>decode(rawInvalid[2]),/encoded data|encoding/i);
  } finally {db.close();}
});

test('official callback smoke has independent deterministic authored protobuf and frozen schemas', async () => {
  const smoke = await import('./callback-inventory-smoke.mjs');
  assert.equal(typeof smoke.authoredCallbackInventoryFixture,'function');
  assert.equal(typeof smoke.runCallbackInventorySmoke,'function');
  assert.deepEqual(smoke.authoredCallbackInventoryFixture(),smoke.authoredCallbackInventoryFixture());
  assert.equal(smoke.CALLBACK_HEADERS.length,7);
});

test('callback phase metacharacters remain literal and SQL/runner bounds and UTF8 refuse', async () => {
  const phases=['__PHASE_VALUES__','__PHASE_LITERALS__','$&','$`',"$'"];
  const {options}=await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const result=await runner.runAuthoredFixtureCallbackInventoryDiagnostic({...options,phases});
  assert.equal(result.status,'success',result.error);
  const sql=await readFile(join(options.out,'query.stdout'),'utf8');
  assert.ok(sql.includes("phases(name) AS (VALUES ('__PHASE_VALUES__'), ('__PHASE_LITERALS__'), ('$&'), ('$`'), ('$'''))"));
  for(const [name,bytes] of [['callback-inventory.sql',Buffer.from([255])],['callback-inventory.sql',Buffer.alloc(16385,32)],['callback-inventory-run.mjs',Buffer.alloc(65537,32)]]) {
    const root=await mkdtemp(join(tmpdir(),'callback-source-bounds-'));
    for(const file of ['callback-inventory-run.mjs','callback-inventory.sql'])await writeFile(join(root,file),await readFile(new URL(`./${file}`,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,'callback-inventory-run.mjs')).href);
    await writeFile(join(root,name),bytes);
    const {options:opts}=await fixture();const r=await copied.runAuthoredFixtureCallbackInventoryDiagnostic(opts);
    authority(r);assert.equal(r.status,'failure');assert.deepEqual(r.processes,{});assert.equal(r.sourceBookends.stable,false);
  }
});

test('callback isolation preserves the legacy runner identity used by feedback v1', async () => {
  assert.equal(hash(await readFile(new URL('./run.mjs',import.meta.url))),'ae945c2874ef877363d30e763e973f1a3480d6e2c2613c3f75dfb4127220c305');
});

test('callback CLI retains normalized one-link bounded config refusal', async () => {
  const {symlink,link}=await import('node:fs/promises');
  const {root,options}=await fixture();
  const cli=new URL('./callback-inventory-run.mjs',import.meta.url).pathname;
  const config=join(root,'config.json');await writeFile(config,JSON.stringify(options));
  await symlink(config,join(root,'symbolic.json'));await link(config,join(root,'hard.json'));
  for(const path of [join(root,'symbolic.json'),join(root,'hard.json'),join(root,'child','..','config.json')])await assert.rejects(execFile(process.execPath,[cli,'--callback-inventory-config',path]),e=>{assert.equal(e.code,1);assert.match(e.stderr,/regular|normalized/);return true;});
  const large=join(root,'large.json');await writeFile(large,' '.repeat(16385));
  await assert.rejects(execFile(process.execPath,[cli,'--callback-inventory-config',large]),e=>{assert.equal(e.code,1);assert.match(e.stderr,/16 KiB/);return true;});
});


test('authored text decoder rejects noncanonical hex and invalid UTF8 without rounding integers', async () => {
  const {decodeCallbackInventorySmokeRows:decode}=await import('./callback-inventory-smoke.mjs');
  assert.equal(typeof decode,'function');
  assert.deepEqual(decode([{name_bytes_hex:'41004258595A',name_is_null:'0',id:9007199254740995n}]),[{name_bytes_hex:'41004258595A',name:'A\0BXYZ',name_is_null:'0',id:9007199254740995n}]);
  for(const value of ['a0','0','GG','FF','C080'])assert.throws(()=>decode([{name_bytes_hex:value,name_is_null:'0'}]));
  for(const [value,flag] of [['41','1'],['[NULL]','0'],[null,'0']])assert.throws(()=>decode([{name_bytes_hex:value,name_is_null:flag}]));
  assert.equal(decode([{name_bytes_hex:'EFBBBF41',name_is_null:'0'}])[0].name,'\uFEFFA');
  assert.equal(decode([{name_bytes_hex:'',name_is_null:'0'}])[0].name,'');
  assert.equal(decode([{name_bytes_hex:'5B4E554C4C5D',name_is_null:'0'}])[0].name,'[NULL]');
  assert.equal(decode([{name_bytes_hex:'[NULL]',name_is_null:'1'}])[0].name,'[NULL]');
});
