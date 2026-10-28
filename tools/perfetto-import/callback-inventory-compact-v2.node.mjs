import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
const runner = await import('./callback-inventory-compact-v2-run.mjs').catch(() => ({}));
const execFile = promisify(callback);
const hash = x => createHash('sha256').update(x).digest('hex');
const version = `${runner.EXPECTED_VERSION}\n`;
const families = ['Graphics.Pipeline.DrawAndSwap','Display::FrameDisplayed','Graphics.Pipeline','PipelineReporter'];
function authority(r) {
  assert.equal(r.queryPolicy, 'callback-inventory-compact-v2'); assert.equal(r.rawRowsExported, true);
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
  assert.equal(typeof runner.runCallbackInventoryCompactV2Diagnostic,'function'); assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic,'function');
});
test('callback selects fixed SQL and source bookends, never caller authority or prefix', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic,'function');
  const {options} = await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const r = await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...options,sql:'SELECT caller',prefix:'other:',queryPolicy:'full',fps:60,qualification:true,authoredFixture:false});
  assert.equal(r.status,'success',r.error); authority(r); assert.equal(r.authoredFixture,true); assert.equal(r.officialProcessor,false);
  const source = await readFile(new URL('./callback-inventory-compact-v2.sql',import.meta.url),'utf8');
  const sql = source.replaceAll('__PHASE_LITERALS__',"'begin''quoted', 'LatencyInfo.Flow'").replace('__PHASE_VALUES__',"('begin''quoted'), ('LatencyInfo.Flow')");
  assert.equal(await readFile(join(options.out,'query.stdout'),'utf8'),sql); assert.equal(r.sql.sourceSha256,hash(source));
  assert.deepEqual(r.before,r.after); assert.deepEqual(r.sourceBookends.before,r.sourceBookends.after); assert.equal(r.sourceBookends.stable,true);
  assert.deepEqual(Object.keys(r.sourceBookends.before).sort(),['executedSql','runner','sqlSource']);
  assert.equal(r.sourceBookends.before.executedSql.sha256,hash(sql)); assert.equal(r.sourceBookends.before.sqlSource.sha256,hash(source));
  await assert.rejects(runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(options),/EEXIST/);
});
test('callback production and CLI reject authored identity and unpinned executable', async () => {
  assert.equal(typeof runner.runCallbackInventoryCompactV2Diagnostic,'function');
  const {root,options}=await fixture(); const r=await runner.runCallbackInventoryCompactV2Diagnostic({...options,authoredFixture:true});
  authority(r); assert.equal(r.status,'failure'); assert.equal(r.authoredFixture,false); assert.equal(r.officialProcessor,false); assert.deepEqual(r.processes,{}); assert.match(r.error,/platform pin/);
  options.out=join(root,'cli');const config=join(root,'config.json'); await writeFile(config,JSON.stringify({...options,authoredFixture:true}));
  await assert.rejects(execFile(process.execPath,[new URL('./callback-inventory-compact-v2-run.mjs',import.meta.url).pathname,'--callback-inventory-compact-v2-config',config]),e=>{assert.equal(e.code,1);assert.match(e.stdout,/platform pin/);return true;});
  authority(JSON.parse(await readFile(join(options.out,'manifest.json'))));
});
test('callback retains process and stream failures, exact bounds, and changed input refusals', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic,'function');
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
    const {options}=await fixture(code);const r=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...options,deadlineMs:['deadline','held-pipe'].includes(name)?700:60000});
    authority(r);assert.equal(r.status,'failure',name);assert.match(r.error,pattern,name);assert.equal(r.processes.query.closed,true,name);
    if(cap)assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
    if(name==='sql')assert.equal(r.sourceBookends.stable,false);
    if(!['trace','processor'].includes(name))assert.deepEqual(r.before,r.after);
  }
});
test('callback validation refuses version/RPC, trace extent, duplicate phases and raised deadline', async () => {
  assert.equal(typeof runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic,'function');
  for(const text of ['wrong\n',version.replace('version: 14','version: 13')]) {
    const {options}=await fixture('',text);const r=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(options);authority(r);assert.equal(r.status,'failure');assert.match(r.error,/version mismatch/);assert.equal(r.processes.query,undefined);
  }
  for(const patch of [{deadlineMs:60001},{phases:['same','same']},{trace:{bytes:33554433}}]) {
    const {options}=await fixture();const r=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...options,...patch});authority(r);assert.equal(r.status,'failure');assert.deepEqual(r.processes,{});
  }
  const {options}=await fixture();options.trace.bytes++;const r=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(options);assert.equal(r.status,'failure');assert.equal(r.processes.query,undefined);
});
test('callback source bookends detect fixed runner and SQL source mutations in isolated copies', async () => {
  for(const file of ['callback-inventory-compact-v2-run.mjs','callback-inventory-compact-v2.sql']) {
    const root=await mkdtemp(join(tmpdir(),'wheel-source-copy-'));
    for(const name of ['callback-inventory-compact-v2-run.mjs','callback-inventory-compact-v2.sql'])await writeFile(join(root,name),await readFile(new URL(`./${name}`,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,'callback-inventory-compact-v2-run.mjs')).href);
    const {options}=await fixture(`fs.appendFileSync(${JSON.stringify(join(root,file))},${JSON.stringify('\n// changed\n')});`);
    const r=await copied.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(options);authority(r);assert.equal(r.status,'failure');assert.equal(r.sourceBookends.stable,false);assert.match(r.error,/source identity changed/);
    assert.equal(r.processes.query.closed,true);assert.deepEqual(r.before,r.after);
  }
});
test('callback exact stdout and stderr caps remain usable without clipping', async () => {
  for(const [name,cap]of [['stdout',262144],['stderr',65536]]) {
    const {options}=await fixture(`process.${name}.write(Buffer.alloc(${cap}));`);const r=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(options);
    authority(r);assert.equal(r.status,'success',r.error);assert.equal(r.processes.query.streams[name].observedBytes,cap);assert.equal((await stat(join(options.out,`query.${name}`))).size,cap);
  }
});

test('fixed SQL retains selected occurrences and binary names with complete typed track context', async () => {
  const sql = await readFile(new URL('./callback-inventory-compact-v2.sql',import.meta.url),'utf8');
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
    db.exec("INSERT INTO args VALUES(100,'invalid','invalid','string',NULL,CAST(X'FF0041' AS TEXT),NULL),(100,'bom','bom','string',NULL,CAST(X'EFBBBF41' AS TEXT),NULL);");
    const nulText='A\0BXYZé🧪"\r\n';
    db.prepare('UPDATE slice SET category = ? WHERE id = 4').run(nulText);
    db.prepare('UPDATE track SET name = ?, type = ?, event_type = ?, counter_unit = ? WHERE id = 1').run(nulText,nulText,nulText,nulText);
    db.prepare('INSERT INTO thread_or_process_slice VALUES(4,7,70,8,80,?,?)').run(nulText,nulText);
    db.prepare("UPDATE args SET flat_key = ?, key = ?, value_type = ?, string_value = ? WHERE key = 'canceled'").run(nulText,nulText,nulText,nulText);
    db.prepare("UPDATE stats SET severity = ?, source = ? WHERE name = 'a'").run(nulText,nulText);
    const rendered=sql.replaceAll('__PHASE_LITERALS__',"'phase', 'absent', 'PipelineReporter'").replaceAll('__PHASE_VALUES__',"('phase'), ('absent'), ('PipelineReporter')");
    const execute = source => {
      const tables=[];
      for(const statement of source.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE slices.with_context;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').replaceAll('CREATE PERFETTO TABLE','CREATE TABLE').split(';').filter(x=>x.trim())) {
        if(/^\s*CREATE (VIEW|TABLE)/i.test(statement))db.exec(statement);
        else {const q=db.prepare(statement);q.setReadBigInts(true);tables.push({header:q.columns().map(c=>c.name),rows:q.all().map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v===null?null:String(v)])))});}
      }
      return tables;
    };
    const v1Source=await readFile(new URL('./callback-inventory.sql',import.meta.url),'utf8');
    const v1Rendered=v1Source.replaceAll('__PHASE_LITERALS__',"'phase', 'absent', 'PipelineReporter'").replaceAll('__PHASE_VALUES__',"('phase'), ('absent'), ('PipelineReporter')");
    const expected=execute(v1Rendered);
    db.exec('DROP VIEW _callback_track_sets; DROP VIEW _callback_tracks; DROP VIEW _callback_selected;');
    const compact=execute(rendered);
    const csv=compact.map(t=>[t.header,...t.rows.map(r=>t.header.map(k=>r[k]))].map(row=>row.map(v=>v===null?'"[NULL]"':'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')).join('\n')+'\n';
    const {parseCallbackInventoryCompactV2Csv:parse,expandCallbackInventoryCompactV2:expand}=await import('./callback-inventory-compact-v2.mjs');
    const parsed=parse(Buffer.from(csv));
    assert.deepEqual(expand(parsed).map(t=>({header:t.header,rows:t.rows.map(r=>({...r}))})),expected);
    assert.equal(compact.length,8);
    assert.equal(new Set(compact[0].rows.map(r=>r.bytes_hex)).size,compact[0].rows.length);
    assert.ok(compact[0].rows.some(r=>r.bytes_hex===''));
    assert.ok(compact[0].rows.some(r=>r.bytes_hex===Buffer.from(nulText).toString('hex').toUpperCase()));
    // Zero selection still exports zero-inclusive names, without unused namespace constants.
    db.exec('DROP TABLE _callback_text; DROP TABLE _callback_stats; DROP VIEW _callback_names; DROP VIEW _callback_track_sets; DROP VIEW _callback_tracks; DROP VIEW _callback_selected; DELETE FROM slice; DELETE FROM stats;');
    const zeroExpected=execute(v1Rendered);
    db.exec('DROP VIEW _callback_track_sets; DROP VIEW _callback_tracks; DROP VIEW _callback_selected;');
    const zeroCompact=execute(rendered);
    const zeroCsv=zeroCompact.map(t=>[t.header,...t.rows.map(r=>t.header.map(k=>r[k]))].map(row=>row.map(v=>v===null?'"[NULL]"':'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')).join('\n')+'\n';
    assert.deepEqual(expand(parse(Buffer.from(zeroCsv))).map(t=>({header:t.header,rows:t.rows.map(r=>({...r}))})),zeroExpected);
    assert.equal(zeroCompact[0].rows.length,6);
    assert.ok(!zeroCompact[0].rows.some(r=>['736F75726365','64696D656E73696F6E'].includes(r.bytes_hex)));

  } finally {db.close();}
});

test('official callback smoke has independent deterministic authored protobuf and frozen schemas', async () => {
  const smoke = await import('./callback-inventory-compact-v2-smoke.mjs');
  assert.equal(typeof smoke.authoredCallbackInventoryCompactV2Fixture,'function');
  assert.equal(typeof smoke.runCallbackInventoryCompactV2Smoke,'function');
  assert.deepEqual(smoke.authoredCallbackInventoryCompactV2Fixture(),smoke.authoredCallbackInventoryCompactV2Fixture());
  assert.equal(smoke.CALLBACK_COMPACT_V2_HEADERS.length,8);
});

test('callback phase metacharacters remain literal and SQL/runner bounds and UTF8 refuse', async () => {
  const phases=['__PHASE_VALUES__','__PHASE_LITERALS__','$&','$`',"$'"];
  const {options}=await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const result=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...options,phases});
  assert.equal(result.status,'success',result.error);
  const sql=await readFile(join(options.out,'query.stdout'),'utf8');
  assert.ok(sql.includes("phases(name) AS (VALUES ('__PHASE_VALUES__'), ('__PHASE_LITERALS__'), ('$&'), ('$`'), ('$'''))"));
  for(const [name,bytes] of [['callback-inventory-compact-v2.sql',Buffer.from([255])],['callback-inventory-compact-v2.sql',Buffer.alloc(16385,32)],['callback-inventory-compact-v2-run.mjs',Buffer.alloc(65537,32)]]) {
    const root=await mkdtemp(join(tmpdir(),'callback-source-bounds-'));
    for(const file of ['callback-inventory-compact-v2-run.mjs','callback-inventory-compact-v2.sql'])await writeFile(join(root,file),await readFile(new URL(`./${file}`,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,'callback-inventory-compact-v2-run.mjs')).href);
    await writeFile(join(root,name),bytes);
    const {options:opts}=await fixture();const r=await copied.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(opts);
    authority(r);assert.equal(r.status,'failure');assert.deepEqual(r.processes,{});assert.equal(r.sourceBookends.stable,false);
  }
});

test('callback isolation preserves the legacy runner identity used by feedback v1', async () => {
  assert.equal(hash(await readFile(new URL('./run.mjs',import.meta.url))),'ae945c2874ef877363d30e763e973f1a3480d6e2c2613c3f75dfb4127220c305');
});

test('callback CLI retains normalized one-link bounded config refusal', async () => {
  const {symlink,link}=await import('node:fs/promises');
  const {root,options}=await fixture();
  const cli=new URL('./callback-inventory-compact-v2-run.mjs',import.meta.url).pathname;
  const config=join(root,'config.json');await writeFile(config,JSON.stringify(options));
  await symlink(config,join(root,'symbolic.json'));await link(config,join(root,'hard.json'));
  for(const path of [join(root,'symbolic.json'),join(root,'hard.json'),join(root,'child','..','config.json')])await assert.rejects(execFile(process.execPath,[cli,'--callback-inventory-compact-v2-config',path]),e=>{assert.equal(e.code,1);assert.match(e.stderr,/regular|normalized/);return true;});
  const large=join(root,'large.json');await writeFile(large,' '.repeat(16385));
  await assert.rejects(execFile(process.execPath,[cli,'--callback-inventory-compact-v2-config',large]),e=>{assert.equal(e.code,1);assert.match(e.stderr,/16 KiB/);return true;});
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


test('fixed source, executed SQL and lexically valid long phases retain independent ceilings', async()=>{
  const names=['callback-inventory-compact-v2-run.mjs','callback-inventory-compact-v2.sql'];
  const phases=["'".repeat(255)+'a',"'".repeat(255)+'b'];
  const {options}=await fixture();
  const long=await runner.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...options,phases:Array.from({length:16},(_,i)=>"'".repeat(255)+String.fromCharCode(65+i))});
  authority(long);assert.equal(long.status,'failure');assert.deepEqual(long.processes,{});assert.match(long.error,/size limit/);
  for(const [extent,expected] of [[16384,'success'],[16385,'failure']]) {
    const root=await mkdtemp(join(tmpdir(),'compact-render-boundary-'));
    for(const name of names)await writeFile(join(root,name),await readFile(new URL('./'+name,import.meta.url)));
    const copied=await import(pathToFileURL(join(root,names[0])).href);
    const token='__PHASE_LITERALS__';const replacement=phases.map(p=>"'"+p.replaceAll("'","''")+"'").join(', ');
    const source=token+' '.repeat(extent-replacement.length);
    assert.ok(Buffer.byteLength(source)<=16384);
    await writeFile(join(root,names[1]),source);
    const {options:opts}=await fixture();
    const result=await copied.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic({...opts,phases});
    authority(result);assert.equal(result.status,expected,result.error);
    assert.equal((await stat(join(opts.out,'diagnostic.sql'))).size,extent);
    if(expected==='failure')assert.deepEqual(result.processes,{});
  }
  const root=await mkdtemp(join(tmpdir(),'compact-source-exact-'));
  for(const name of names)await writeFile(join(root,name),await readFile(new URL('./'+name,import.meta.url)));
  const copied=await import(pathToFileURL(join(root,names[0])).href);
  await writeFile(join(root,names[1]),' '.repeat(16384));
  const {options:opts}=await fixture();const result=await copied.runAuthoredFixtureCallbackInventoryCompactV2Diagnostic(opts);
  assert.equal(result.status,'success',result.error);assert.equal(result.sourceBookends.before.sqlSource.bytes,16384);
});

test('production source closure excludes decoder and old sources remain byte-identical',async()=>{
  const source=await readFile(new URL('./callback-inventory-compact-v2-run.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"]\.\//);
  assert.ok(Buffer.byteLength(source)<=65536);
  const expected={'native-wheel-raw-census.node.mjs': 'cd0acef9daa4f5bd1d796d3620c701cfeb5e132c1912625fd88e5c89638c18e4', 'wheel-graph.node.mjs': '59a4093c05cff401b2aa52f1b0fe11e8dbfff6336486c5eff77023fca98125a2', 'feedback-observations-run.mjs': '6e94b9fd0470c61f59ba7a73a06434dc3aea879825e3407698403f98d68bc45a', 'wheel-graph.mjs': '787b5f6bac664b56eee6bb5b3194222b6dce5af9cf6427bf091c2b08ffc8da4f', 'feedback-observations-source-model-v1.json': '77b1958d1b39fa874baafaa5d813095b42c3d3cfa86daa3fe46740f05eadcd22', 'run.mjs': 'ae945c2874ef877363d30e763e973f1a3480d6e2c2613c3f75dfb4127220c305', 'smoke.mjs': 'b9c1aa29eb29db38dd69627558f4c37b1fe386d6318d2d2671e629d7da7acb7d', 'feedback-observations-run.node.mjs': '6a8094f7cc627faca431523b1de6b8d2eab1172b380d623b5833f1e625fa877f', 'callback-inventory.node.mjs': '4a74e0c803ddd62bc1e709ffee7f99cf1c64a8f98246b2424a41dd3b8642d030', 'run.node.mjs': 'e4c80b867f141d881dbb55f40308f704d6a632c248a4562ce3f7167f08358f5d', 'scope-inventory.sql': 'eb465cc5ecd17e15fc661399c146a419b386f9b389becc08c1d2a5d504d10af9', 'raw-metadata-ledger-v1.mjs': '4b1f08ccfd6d27cb022351ab5a30595966d3a1e3b808618a54ece6fa2ce42033', 'mainframe-lineage.node.mjs': 'b78e87a743110e9115f3807e5a26a3ef3c0977df018ea81a2427e78a84608414', 'wheel-carrier.node.mjs': '966aa53f65c873e3570d7347dbbb3eb2e3f200335278a013b9483f0b9c563fcd', 'wheel-carrier.sql': '38c518c37a87aed258f06670857fdfe0d4fd75dc4a309b576c4c35d7e2731b56', 'feedback-observations-core.node.mjs': '1f808bf21a801658b12fd2c104ded330ca017a3c9b0c97ac25ece63cdec523e1', 'mainframe-lineage.sql': 'c7b79b0bfe5f962fff283b08814c370d62c954204ad0e0672d6aa559254d3073', 'callback-inventory-smoke.mjs': '9ce9c6566b66c13364e3a523f4315caacd812e6d5f8600768e689a23b5ec709d', 'raw-metadata-ledger-v1.node.mjs': 'be5c7f6fa0d84b304dd7db62b368b84783403e6ca8b3d8983dbb64a59a9ffbf6', 'feedback-observations-fixtures.mjs': 'ff127110f9fb5d76a901b9e9b112c8b46c07d0ad14f75cc53427cc27f2dc6bc4', 'diagnostic.sql': '3fd0a09e586de21c3f62c672a60636b0895e25314eb11a3c5a8176c9e6211fde', 'feedback-observations-core.mjs': '978c090191b234be19eb404dec9200254121570c8791ecb89afdda1854688e33', 'native-wheel-raw-census.mjs': 'f0297da7323693aec99c714fa04099152d33b76612176fa9efc535a55efae949', 'inventory.sql': 'b60151196f3f21d268665e502ccaee12cfcd1cb642cff193076cd24a312c8284', 'callback-inventory.sql': '883df357eda22366ea32bbf57906aa6daa0198b1373daefae0b526eed1a03309', 'callback-inventory-run.mjs': '25c127d756b264d8024500898aa20a7a518644ef9c40ad2ae23da32d7b6b3bd5', 'target-inventory.sql': 'f1fe2faaadcc68c57933ef51fd087ea795bc704416f9375c7b115d888acf3db9'};
  for(const [name,digest] of Object.entries(expected))assert.equal(hash(await readFile(new URL('./'+name,import.meta.url))),digest,name);
});

// Pure bounded decoder controls; authored CSV only.
const compactDecoder=await import('./callback-inventory-compact-v2.mjs');
test('compact parser, raw expansion and optional strict text APIs exist',()=>{
 for(const key of ['parseCallbackInventoryCompactV2Csv','expandCallbackInventoryCompactV2','decodeCallbackInventoryCompactV2Text'])assert.equal(typeof compactDecoder[key],'function',key);
});
const compactHeaders=compactDecoder.CALLBACK_COMPACT_V2_HEADERS;
const compactCsv=(dictionary=[['1','41']], count=[['1','9007199254740995','0']])=>Buffer.from(compactHeaders.map((h,i)=>[h.join(','),...(i===0?dictionary:i===1?count:[]).map(r=>r.map(c=>c===null?'[NULL]':`"${c.replaceAll('"','""')}"`).join(','))].join('\n')).join('\n')+'\n');
test('raw roundtrip is frozen, cached, privately owned and lossless above 2^53',()=>{
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv());
 assert.ok(Object.isFrozen(parsed));assert.ok(Object.isFrozen(parsed.tables[0].rows[0]));
 const expanded=compactDecoder.expandCallbackInventoryCompactV2(parsed);
 assert.equal(expanded[0].rows[0].name_bytes_hex,'41');assert.equal(expanded[0].rows[0].event_count,'9007199254740995');
 assert.strictEqual(expanded,compactDecoder.expandCallbackInventoryCompactV2(parsed));
 assert.equal(compactDecoder.decodeCallbackInventoryCompactV2Text(parsed)[0].rows[0].name,'A');
 assert.throws(()=>compactDecoder.expandCallbackInventoryCompactV2({...parsed}),/owned/);
 assert.throws(()=>compactDecoder.expandCallbackInventoryCompactV2(new Proxy(parsed,{get(){throw Error('traversed proxy');}})),/owned/);
});
test('strict byte dictionary and references refuse atomic corruption',()=>{
 for(const bytes of [compactCsv([['0','41']]),compactCsv([['2','41']]),compactCsv([['1','4a']]),compactCsv([['1','41'],['2','41']]),compactCsv([['1','42'],['2','41']]),compactCsv([['1','41'],['2','42']]),compactCsv([['1','41']],[['2','1','0']]),compactCsv([['1','41']],[['[NULL]','1','0']]),compactCsv([['1','41']],[['1','NaN','0']])])assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(bytes));
});
test('invalid UTF8 is raw-valid; semantic refusal caches without changing raw; BOM preserves',()=>{
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1','FF']]));
 const raw=compactDecoder.expandCallbackInventoryCompactV2(parsed);assert.equal(raw[0].rows[0].name_bytes_hex,'FF');
 let first;try{compactDecoder.decodeCallbackInventoryCompactV2Text(parsed);}catch(e){first=e;}assert.ok(first);
 assert.throws(()=>compactDecoder.decodeCallbackInventoryCompactV2Text(parsed),e=>e===first);assert.strictEqual(raw,compactDecoder.expandCallbackInventoryCompactV2(parsed));
 const bom=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1','EFBBBF41']]));assert.equal(compactDecoder.decodeCallbackInventoryCompactV2Text(bom)[0].rows[0].name,'\uFEFFA');
});
test('empty bytes, embedded NUL, quote and sentinel remain distinct',()=>{
 for(const value of ['','410042','225B4E554C4C5D22','5B4E554C4C5D']){
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1',value]]));assert.equal(compactDecoder.expandCallbackInventoryCompactV2(parsed)[0].rows[0].name_bytes_hex,value);
 }
});
test('input cap and expanded byte bomb refuse',()=>{
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(Buffer.alloc(262145)),/input/);
 const bytes=compactCsv([['1','41'.repeat(1024)]],Array.from({length:513},()=>['1','1','0']));
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(bytes);assert.throws(()=>compactDecoder.expandCallbackInventoryCompactV2(parsed),/expanded text/);
});
test('NULL flags are mandatory booleans and stats rows cannot be zero',()=>{
 const bounds=Buffer.from(compactHeaders.map((h,i)=>[h.join(','),...(i===7?['1,2,[NULL],0']:[])].join('\n')).join('\n')+'\n');
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(bounds),/flag/);
 const stats=Buffer.from(compactHeaders.map((h,i)=>[h.join(','),...(i===0?['1,41']:i===6?['1,0,1,1,0,0,0,0,0,0']:[])].join('\n')).join('\n')+'\n');
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(stats),/zero stats/);
});
test('exact input and total-row caps admit, one-over refuses before interpretation',()=>{
 const base=compactCsv();const padded=Buffer.concat([base,Buffer.alloc(262144-base.length,10)]);
 assert.ok(compactDecoder.parseCallbackInventoryCompactV2Csv(padded));assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(Buffer.concat([padded,Buffer.from('\n')])),/input/);
 const at=Buffer.from(compactCsv([['1','41']],Array.from({length:32767},()=>['1','0','0'])).toString().replaceAll('"',''));assert.equal(compactDecoder.parseCallbackInventoryCompactV2Csv(at).tables[1].rows.length,32767);
 const over=Buffer.from(compactCsv([['1','41']],Array.from({length:32768},()=>['1','0','0'])).toString().replaceAll('"',''));assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(over),/row/);
});
test('expansion exact text-byte cap and cumulative cached views use one lifetime account',()=>{
 const at=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1','41'.repeat(1024)]],Array.from({length:512},()=>['1','1','0'])));
 const raw=compactDecoder.expandCallbackInventoryCompactV2(at);assert.equal(raw[0].rows.length,512);assert.throws(()=>compactDecoder.decodeCallbackInventoryCompactV2Text(at),/expanded text/);assert.strictEqual(raw,compactDecoder.expandCallbackInventoryCompactV2(at));
 const small=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv());const view=compactDecoder.decodeCallbackInventoryCompactV2Text(small);assert.strictEqual(view,compactDecoder.decodeCallbackInventoryCompactV2Text(small));
 let consumed=0;assert.throws(()=>{for(;consumed<4194305;consumed++)compactDecoder.expandCallbackInventoryCompactV2(small);},/logical work/);assert.ok(consumed>1000);assert.equal(view[0].rows[0].name,'A');
});
test('CSV schema, numbers, placeholders and NULL contradictions refuse',()=>{
 const normal=compactCsv();
 for(const bad of [normal.toString().replace('event_count,arg_set_count','arg_set_count,event_count'),normal.toString().replace('"9007199254740995"','"18446744073709551616"'),normal.toString()+'x,y\n',normal.toString().replace('"9007199254740995"','"01"'),normal.toString().replace('"41"','"4"'),normal.toString().replace('"41"','"GG"'),normal.toString().slice(0,-1)+'"'])assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(Buffer.from(bad)));
});
test('all returned raw and semantic scaffolding is frozen and cache-owned',()=>{
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv());
 const raw=compactDecoder.expandCallbackInventoryCompactV2(parsed),semantic=compactDecoder.decodeCallbackInventoryCompactV2Text(parsed);
 for(const view of [raw,semantic]){
   assert.ok(Object.isFrozen(view));assert.equal(view.length,7);
   for(const table of view){assert.ok(Object.isFrozen(table));assert.ok(Object.isFrozen(table.header));assert.ok(Object.isFrozen(table.rows));for(const row of table.rows)assert.ok(Object.isFrozen(row));}
 }
 assert.strictEqual(raw,compactDecoder.expandCallbackInventoryCompactV2(parsed));assert.strictEqual(semantic,compactDecoder.decodeCallbackInventoryCompactV2Text(parsed));
});
test('matched args require a nonNULL set and snapshotted stats require nonNULL nonzero value',()=>{
 const args=['0',null,'1','1',null,null,null,null,null,null,'1','1','1','1','1','1'];
 const stats=['1','0','1','1',null,'0','0','0','0','1'];
 for(const [index,row]of [[3,args],[6,stats]]){
 const text=compactHeaders.map((h,i)=>[h.join(','),...(i===0&&index===6?['1,41']:i===index?[row.map(x=>x??'[NULL]').join(',')]:[])].join('\n')).join('\n')+'\n';
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(Buffer.from(text)),/matched argument set|nonzero stats/);
 }
});
test('semantic budget includes retained raw hex plus added convenience text',()=>{
 const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1','41'.repeat(1024)]],Array.from({length:200},()=>['1','1','0'])));
 const raw=compactDecoder.expandCallbackInventoryCompactV2(parsed);assert.equal(raw[0].rows.length,200);
 assert.throws(()=>compactDecoder.decodeCallbackInventoryCompactV2Text(parsed),/expanded text/);assert.strictEqual(raw,compactDecoder.expandCallbackInventoryCompactV2(parsed));
 const exact=compactDecoder.parseCallbackInventoryCompactV2Csv(compactCsv([['1','41'.repeat(1024)]],Array.from({length:170},()=>['1','1','0'])));
 assert.equal(compactDecoder.decodeCallbackInventoryCompactV2Text(exact)[0].rows.length,170);
});
test('identifier and depth domains refuse negative values without narrowing timestamps or durations',()=>{
 const args=['0','-1','0','0',null,null,null,null,null,null,'1','1','1','1','1','1'];
 const text=compactHeaders.map((h,i)=>[h.join(','),...(i===3?[args.map(x=>x??'[NULL]').join(',')]:[])].join('\n')).join('\n')+'\n';
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(Buffer.from(text)),/negative/);
});
test('track argument namespace is exactly one fixed byte label',()=>{
 const row=['0','1',null,'1','0',null,null,null,null,null,null,'1','1','1','1','1','1'];
 const make=value=>Buffer.from(compactHeaders.map((h,i)=>[h.join(','),...(i===0?[`1,${value}`]:i===5?[row.map(x=>x??'[NULL]').join(',')]:[])].join('\n')).join('\n')+'\n');
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(make('41')),/namespace/);
 for(const valid of ['736F75726365','64696D656E73696F6E'])assert.ok(compactDecoder.parseCallbackInventoryCompactV2Csv(make(valid)));
});

test('pinned REAL infinities remain exact strings; other nonfinite spellings and decimal overflow refuse',()=>{
 const make=(value,flag=value===null?'1':'0')=>Buffer.from(compactHeaders.map((header,index)=>[header.join(','),...(index===3?[[ '0','0','0','1',null,null,null,null,null,value,'1','1','1','1','1',flag].map(cell=>cell??'[NULL]').join(',')]:[])].join('\n')).join('\n')+'\n');
 for(const value of ['inf','-inf','1.250000',null]){
   const parsed=compactDecoder.parseCallbackInventoryCompactV2Csv(make(value));
   const row=compactDecoder.expandCallbackInventoryCompactV2(parsed)[2].rows[0];
   assert.equal(row.real_value,value);assert.equal(row.real_value_is_null,value===null?'1':'0');
 }
 for(const value of ['+inf','Infinity','-Infinity','INF','nan','NaN','1e999'])assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(make(value)),/real numeric/);
 assert.throws(()=>compactDecoder.parseCallbackInventoryCompactV2Csv(make('inf','1')),/NULL consistency/);
});
