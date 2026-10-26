import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
const execFile = promisify(callback);
const runner = await import('./run.mjs');
const smoke = await import('./smoke.mjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const version = 'Perfetto v59.1-1e9c61e98 (1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d)\nTrace Processor RPC API version: 14\n';
const families = ['ProxyMain::BeginMainFrame', 'ProxyMain::BeginMainFrame::commit', 'ProxyImpl::ReadyToCommit', 'ProxyImpl::Commit', 'LayerTreeHostImpl::CommitComplete', 'ProxyImpl::ReadyToActivate', 'LayerTreeHostImpl::ActivateSyncTree', 'ActivateLayerTree', 'Commit', 'MainFrame.Draw', 'DrawFrame'];
function authority(result) {
  assert.equal(result.queryPolicy, 'mainframe-lineage-compact-v1');
  assert.equal(result.rawRowsExported, true);
  for (const key of ['qualification', 'captureQualified', 'fpsEligibility', 'evaluationEligibility', 'scoringEligibility', 'rankingEligibility', 'nativeSupported', 'scoring']) assert.equal(result[key], false, key);
  assert.equal(result.fps, null); assert.equal(result.duration, null); assert.equal(result.clockAdmission, 'not_evaluated');
}
async function fixture(body = "process.stdout.write('rows\\n');") {
  const root = await mkdtemp(join(tmpdir(), 'mainframe-lineage-test-'));
  const trace = Buffer.from('authored trace');
  const source = `#!${process.execPath}\nimport fs from 'node:fs';\nif (process.argv.includes('--version')) process.stdout.write(${JSON.stringify(version)}); else { ${body} }\n`;
  const path = join(root, 'processor.mjs'); await writeFile(path, source); await chmod(path, 0o700);
  const tracePath = join(root, 'trace'); await writeFile(tracePath, trace);
  return {root, options: { trace: {path: tracePath, bytes: trace.length, sha256: hash(trace)}, processor: {path, sha256: hash(source)}, phases: ["begin'quoted", 'DrawFrame'], out: join(root, 'out') }};
}
test('lineage exposes separate official and authored entrypoints', () => {
  assert.equal(typeof runner.runMainframeLineageDiagnostic, 'function');
  assert.equal(typeof runner.runAuthoredFixtureMainframeLineageDiagnostic, 'function');
});
test('lineage selects fixed SQL with escaped phases and cannot accept authority overrides', async () => {
  const {options} = await fixture('process.stdout.write(fs.readFileSync(process.argv[4]));');
  const result = await runner.runAuthoredFixtureMainframeLineageDiagnostic({...options, sql:'SELECT caller', queryPolicy:'full', authoredFixture:false, qualification:true, fps:60});
  assert.equal(result.status, 'success', result.error); authority(result);
  assert.equal(result.authoredFixture, true); assert.equal(result.officialProcessor, false);
  const source = await readFile(new URL('./mainframe-lineage.sql', import.meta.url), 'utf8');
  const sql = source.replace('__PHASE_LITERALS__', "'begin''quoted', 'DrawFrame'");
  assert.equal(await readFile(join(options.out,'query.stdout'),'utf8'), sql);
  assert.equal(await readFile(join(options.out,'diagnostic.sql'),'utf8'), sql);
  assert.equal(result.sql.sourceSha256, hash(source)); assert.deepEqual(result.before,result.after);
  await assert.rejects(runner.runAuthoredFixtureMainframeLineageDiagnostic(options), /EEXIST/);
});
test('lineage production and CLI refuse a self-declared tool before launch', async () => {
  const {root,options} = await fixture();
  const result = await runner.runMainframeLineageDiagnostic({...options,authoredFixture:true});
  assert.equal(result.status,'failure'); authority(result); assert.equal(result.authoredFixture,false); assert.equal(result.officialProcessor,false); assert.deepEqual(result.processes,{}); assert.match(result.error,/platform pin/);
  options.out=join(root,'cli-out'); const config=join(root,'config.json'); await writeFile(config,JSON.stringify({...options,authoredFixture:true}));
  await assert.rejects(execFile(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,'--mainframe-lineage-config',config]),error=>{assert.equal(error.code,1);assert.match(error.stdout,/platform pin/);return true;});
  const saved=JSON.parse(await readFile(join(options.out,'manifest.json'))); authority(saved); assert.equal(saved.authoredFixture,false);
});
test('lineage retains whole-run refusals, original process closure, stream caps and bookends', async () => {
  for (const [name,body,pattern,limit] of [
    ['stdout', 'process.stdout.write(Buffer.alloc(300000));setInterval(()=>{},1000);', /stdout limit/,262144],
    ['stderr', 'process.stderr.write(Buffer.alloc(70000));setInterval(()=>{},1000);', /stderr limit/,65536],
    ['deadline','setInterval(()=>{},1000);',/deadline/],
    ['exit',"process.stdout.write('partial');process.exitCode=7;",/unsuccessfully/],
    ['mutation',"fs.appendFileSync(process.argv.at(-1),'changed');",/changed|mismatch/],
  ]) {
    const {options}=await fixture(body);
    const result=await runner.runAuthoredFixtureMainframeLineageDiagnostic({...options,deadlineMs:name==='deadline'?700:60000});
    assert.equal(result.status,'failure',name); authority(result); assert.match(result.error,pattern); assert.equal(result.processes.query.closed,true);
    if(limit) assert.equal((await stat(join(options.out,`query.${name}`))).size,limit);
    if(name!=='mutation')assert.deepEqual(result.before,result.after);
    const saved=JSON.parse(await readFile(join(options.out,'manifest.json')));authority(saved);assert.equal(saved.status,'failure');
  }
  const {options}=await fixture();options.trace.bytes++;
  const result=await runner.runAuthoredFixtureMainframeLineageDiagnostic(options);authority(result);assert.equal(result.status,'failure');assert.equal(result.processes.query,undefined);
});
test('lineage SQL preserves exact families, overloaded Commit contexts and typed occurrence multiplicity', async () => {
  const sql=await readFile(new URL('./mainframe-lineage.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/\bLIMIT\b|\bUNION ALL\b|\bLIKE\b|\bGLOB\b/i);
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE slice(id,ts,dur,depth,parent_id,name,category,track_id,arg_set_id);
      CREATE TABLE track(id,name);CREATE TABLE thread_or_process_slice(id,utid,tid,upid,pid,process_name,thread_name);
      CREATE TABLE args(arg_set_id,flat_key,key,value_type,int_value,string_value,real_value);
      CREATE TABLE stats(name,idx,severity,source,value);CREATE TABLE trace_bounds(start_ts,end_ts);
      INSERT INTO slice VALUES
      (1,1,100,0,NULL,'PipelineReporter','reporter',1,500),
      (2,2,0,1,1,'Commit','reporter',1,100),
      (3,3,0,0,NULL,'Commit','devtools',2,101),
      (4,4,0,0,NULL,'ProxyImpl::Commit','cc',3,102),
      (5,5,0,0,NULL,'ProxyImpl::Commit','cc',4,102),
      (6,6,-1,9,888,'DrawFrame',NULL,2,NULL),
      (7,7,0,2,8,'ProxyImpl::ReadyToActivate','cc',3,103),
      (8,8,0,3,7,'cycle ancestor',NULL,3,500),
      (9,9,0,0,9,'MainFrame.Draw','cc',3,104),
      (10,10,0,0,NULL,'phase','phase',2,105),
      (11,11,0,0,NULL,'Graphics.Pipeline','excluded',3,500),
      (12,12,0,0,NULL,'ProxyImpl::CommitExtra','excluded',3,500);
      INSERT INTO args VALUES
      (500,'ancestorOnly','ancestorOnly','string',NULL,'excluded',NULL),
      (100,'legacy_event.passthrough_utid','legacy_event.passthrough_utid','uint',1,NULL,NULL),
      (101,'debug.frameSeqId','debug.frameSeqId','uint',9007199254740993,NULL,NULL),
      (102,'main_frame_pipeline.main_frame_id','main_frame_pipeline.main_frame_id','uint',9007199254740995,NULL,NULL),
      (102,'main_frame_pipeline.main_frame_id','main_frame_pipeline.main_frame_id','uint',9007199254740995,NULL,NULL),
      (103,NULL,NULL,NULL,NULL,NULL,NULL),
      (104,'empty','empty','string',NULL,'',NULL),
      (104,'literal','literal','string',NULL,'[NULL]',NULL),
      (105,'unicode','quote"key','string',NULL,'é🧪'||char(10)||'line',NULL);
      INSERT INTO track VALUES(1,'reporter'),(2,'main'),(3,'impl'),(4,'other');
      INSERT INTO thread_or_process_slice VALUES(3,1,2,3,4,'process','main'),(4,2,3,3,4,'process','impl'),(5,3,4,5,6,'other','impl');
      INSERT INTO trace_bounds VALUES(1,12);`);
    const tables=[];
    for(const statement of sql.replace(/--[^\n]*/g,'').replace('INCLUDE PERFETTO MODULE chrome.graphics_pipeline;','').replaceAll('CREATE PERFETTO VIEW','CREATE VIEW').replace('__PHASE_LITERALS__',"'phase', 'Commit'").split(';').filter(s=>s.trim())){
      if(/^\s*CREATE VIEW/i.test(statement))db.exec(statement);
      else{const q=db.prepare(statement);q.setReadBigInts(true);tables.push(q.all().map(r=>({...r})));}
    }
    assert.equal(tables.length,6);const[counts,nodes,compact,dictionary]=tables;
    assert.deepEqual(counts.map(r=>r.name),families.toSorted());
    assert.deepEqual(counts.filter(r=>r.event_count!==0n).map(r=>[r.name,r.event_count]),[['Commit',2n],['DrawFrame',1n],['MainFrame.Draw',1n],['ProxyImpl::Commit',2n],['ProxyImpl::ReadyToActivate',1n]]);
    assert.deepEqual(nodes.map(r=>r.id),[1n,2n,3n,4n,5n,6n,7n,8n,9n,10n]);
    assert.equal(nodes.find(r=>r.id===1n).is_selected,0n);assert.equal(nodes.find(r=>r.id===8n).is_selected,0n);
    assert.deepEqual(nodes.filter(r=>r.name==='Commit').map(r=>[r.category,r.track_id,r.parent_id]),[['reporter',1n,1n],['devtools',2n,null]]);
    assert.equal(nodes.find(r=>r.id===6n).parent_status,'missing_parent');assert.equal(nodes.find(r=>r.id===6n).duration_status,'unclosed');
    const expanded=smoke.reconstructScopeArguments(compact,dictionary);
    assert.equal(expanded.some(r=>r.key==='ancestorOnly'),false);
    assert.deepEqual(expanded.filter(r=>r.key==='main_frame_pipeline.main_frame_id').map(r=>[r.slice_id,r.int_value]),[[4n,9007199254740995n],[4n,9007199254740995n],[5n,9007199254740995n],[5n,9007199254740995n]]);
    assert.equal(expanded.find(r=>r.slice_id===7n).arg_present,1n);assert.equal(expanded.find(r=>r.slice_id===6n).arg_present,0n);
    assert.equal(expanded.find(r=>r.key==='empty').string_value,'');assert.equal(expanded.find(r=>r.key==='literal').string_value,'[NULL]');
    assert.equal(expanded.find(r=>r.key==='quote""key').string_value,'é🧪\nline');
    const group=dictionary.find(r=>r.key==='main_frame_pipeline.main_frame_id');assert.equal(group.arg_occurrence_count,4n);assert.equal(group.slice_count,2n);
    for(const r of expanded)for(const key of ['flat_key','key','value_type','int_value','string_value','real_value'])assert.equal(r[`${key}_is_null`],r[key]===null?1n:0n);
  } finally {db.close();}
});
test('lineage owns a deterministic independent authored fixture with actual pipeline fields', () => {
  assert.equal(typeof smoke.authoredMainframeLineageFixture,'function');
  const bytes=smoke.authoredMainframeLineageFixture();assert.ok(Buffer.isBuffer(bytes));assert.deepEqual(bytes,smoke.authoredMainframeLineageFixture());
  assert.equal(bytes.length,1367);assert.equal(hash(bytes),'126b0d2ce9a85a519ab4f8b790b0a35c9154306c00b1313e332735488efa0cb7');
  assert.ok(bytes.includes(Buffer.from('ProxyImpl::ReadyToCommit')));assert.ok(bytes.includes(Buffer.from('PipelineReporter')));
  // MainFramePipeline.last_begin_frame_id_during_first_draw (5) contains
  // BeginFrameId.source_id (1)=4294967297 and sequence_number (2)=123.
  assert.ok(bytes.includes(Buffer.from('2a08088180808010107b','hex')));
});
