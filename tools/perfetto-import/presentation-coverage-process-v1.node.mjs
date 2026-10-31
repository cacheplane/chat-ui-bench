// Authored original-process controls. Run after coordinated native capture pause.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {basicCoverageGraph,encodeCoverageGraph} from './presentation-coverage-fixtures-v1.mjs';
import {runAuthoredPresentationCoverageDiagnosticV1,inspectPresentationCoverageRunV1,EXPECTED_VERSION} from './presentation-coverage-run-v1.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function harness(mode='ok') {
  const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'authored-presentation-coverage-')));
  const trace=join(root,'authored-trace'),processor=join(root,'authored-processor');
  const bytes=Buffer.from('authored process control; never native data');
  await fs.writeFile(trace,bytes,{flag:'wx'});
  const csv=encodeCoverageGraph(basicCoverageGraph()).toString();
  const script=`#!${process.execPath}\nconst version=process.argv.includes('--version');if(version)process.stdout.write(${JSON.stringify(mode==='version'?'wrong':EXPECTED_VERSION+'\n')});else {process.stdout.write(${JSON.stringify(csv)});${mode==='exit'?'process.exitCode=1;':''}${mode==='signal'?`process.kill(process.pid,'SIGTERM');`:''}${mode==='stdout'?'process.stdout.write("X".repeat(2097153));':''}${mode==='stderr'?'process.stderr.write("S".repeat(65537));':''}${mode==='deadline'?'setInterval(()=>{},1000);':''}${mode==='source-drift'?`require('node:fs').appendFileSync(${JSON.stringify(join(root,'source','presentation-coverage-v1.sql'))},'--authored-source-change');`:''}${mode==='sql-drift'?`require('node:fs').appendFileSync(process.argv[process.argv.indexOf('-f')+1],'--changed');`:''}${mode==='trace-drift'?`require('node:fs').appendFileSync(process.argv.at(-1),'changed');`:''}${mode==='publication'?`require('node:fs').mkdirSync(require('node:path').join(require('node:path').dirname(process.argv[process.argv.indexOf('-f')+1]),'result.json'));`:''}${mode==='eof'?`require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore',1,2]});`:''}}\n`;
  await fs.writeFile(processor,script,{flag:'wx',mode:0o700});
  if(mode==='source-drift') {
    await fs.mkdir(join(root,'source'));
    for(const name of ['presentation-coverage-v1.sql','presentation-coverage-wire-v1.mjs','presentation-coverage-core-v1.mjs','presentation-coverage-source-model-v1.json','presentation-coverage-run-v1.mjs']) {
      let bytes=await fs.readFile(new URL('./'+name,import.meta.url));
      if(name==='presentation-coverage-run-v1.mjs')bytes=Buffer.from(bytes.toString().replace("'../native-real-chat/request-window-run-v2.mjs'",JSON.stringify(new URL('../native-real-chat/request-window-run-v2.mjs',import.meta.url).href)));
      await fs.writeFile(join(root,'source',name),bytes,{flag:'wx'});
    }
  }
  return {root,raw:JSON.stringify({schema:'browser-presentation-coverage-inventory-run-v1',policy:'whole-selected-presentation-coverage-v1',trace:{path:trace,bytes:bytes.length,sha256:hash(bytes)},processor:{path:processor,sha256:hash(script)},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:join(root,'out'),deadlineMs:mode==='deadline'||mode==='eof'?150:5000})};
}
test('authored process closes exact fixed SQL export without obtaining official/native brand',async()=>{
  const h=await harness();
  try {
    const r=await runAuthoredPresentationCoverageDiagnosticV1(h.raw);
    assert.equal(r.status,'diagnostic',r.reason);
    assert.equal(r.executionEvidence,'authored-executable-process-control');
    assert.equal(r.traceOrigin,'caller-supplied-persisted-trace');
    assert.throws(()=>inspectPresentationCoverageRunV1(r));
    assert.ok(Object.values(r.authorities).every(v=>v===false||v===null));
    const manifest=JSON.parse(await fs.readFile(r.processManifest.path));
    assert.equal(manifest.officialProcessor,false);
    assert.equal(manifest.canonicalInputs.configJSON,h.raw);
    assert.equal(manifest.canonicalInputs.configSha256,hash(h.raw));
    assert.deepEqual(r.canonicalInputs,manifest.canonicalInputs);
    assert.equal(r.canonicalInputs.selectorSha256,hash(r.canonicalInputs.selectorJSON));
    for(const record of Object.values(manifest.processes)) {
      assert.equal(record.closed,true);
      assert.equal(record.groupAbsent,true);
      assert.deepEqual(record.exit,{code:0,signal:null});
      assert.deepEqual(record.close,{code:0,signal:null});
      for(const stream of Object.values(record.streams)) {
        assert.equal(stream.eof,true);assert.equal(stream.closed,true);assert.equal(stream.forcedDestroy,false);
      }
    }
    const raw=await fs.readFile(r.graphProof.path);
    assert.equal(hash(raw),r.graphProof.sha256);
    assert.equal(raw.length,r.graphProof.bytes);
    const sql=await fs.readFile(join(h.root,'out','diagnostic.sql'),'utf8');
    assert.ok(sql.includes("('start'),('end')"));
    assert.equal(sql.includes('__PHASE_VALUES__'),false);
  } finally { await fs.rm(h.root,{recursive:true,force:true}); }
});
for(const mode of ['version','exit','signal','stdout','stderr','deadline','eof','source-drift','sql-drift','trace-drift','publication'])test('authored process '+mode+' failure withholds success receipt',async()=>{
  const h=await harness(mode);
  try {
    const run=mode==='source-drift'?(await import(pathToFileURL(join(h.root,'source','presentation-coverage-run-v1.mjs')).href)).runAuthoredPresentationCoverageDiagnosticV1:runAuthoredPresentationCoverageDiagnosticV1;
    const r=await run(h.raw);
    assert.equal(r.status,'unavailable');assert.equal(r.publication,null);assert.equal(r.authorities.fps,null);
    if(mode==='version')assert.equal(r.reason,'processor-version');
    if(['exit','signal','stdout','stderr','deadline','eof'].includes(mode))assert.equal(r.reason,'processor-process');
    if(mode==='publication'){assert.equal(r.stage,'publication');assert.ok((await fs.stat(join(h.root,'out','manifest.json'))).isFile());}
    if(['source-drift','sql-drift','trace-drift'].includes(mode))assert.equal(r.stage,'custody');
  } finally { await fs.rm(h.root,{recursive:true,force:true}); }
});

for(const mode of ['stale-output','symlink-trace'])test('authored file custody rejects '+mode,async()=>{
 const h=await harness();try{
  const c=JSON.parse(h.raw);
  if(mode==='stale-output')await fs.mkdir(c.out);
  else {await fs.rename(c.trace.path,c.trace.path+'.original');await fs.symlink(c.trace.path+'.original',c.trace.path);}
  const r=await runAuthoredPresentationCoverageDiagnosticV1(h.raw);
  assert.equal(r.status,'unavailable');assert.equal(r.publication,null);assert.equal(r.stage,mode==='stale-output'?'output':'source');
 }finally{await fs.rm(h.root,{recursive:true,force:true});}
});
test('original capture checks elapsed close time even when timeout callback never fires',async()=>{
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8');
 const pidLine=source.split('\n').find(line=>line.startsWith('function originalPid('));
 const captureLine=source.split('\n').find(line=>line.startsWith('async function capture('));
 const cp=await import('node:child_process'),{dirname}=await import('node:path');
 let reads=0;
 const capture=Function('cp','same','bad','hash','dirname','performance',pidLine+'\n'+captureLine+';return capture;')(cp,(a,b)=>JSON.stringify(a)===JSON.stringify(b),()=>Error('unavailable'),hash,dirname,{now(){return ++reads<=2?0:1001;}});
 const clock={check(){},onAbort(){return()=>{};},remaining(){return 1000;}};
 const actual=await capture(process.execPath,['-e',"process.stdout.write('authored')"],1000,clock,1024);
 assert.equal(actual.record.closed,true);assert.equal(actual.record.timedOut,false);
 assert.equal(actual.record.elapsedDeadlineExceeded,true);assert.equal(actual.record.error,'process-deadline-exceeded');
 assert.equal(actual.record.groupAbsent,true);
});
