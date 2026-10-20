import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, cpSync, symlinkSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runnerURL = new URL('./run.mjs', import.meta.url);
const runner = existsSync(runnerURL) ? await import(runnerURL) : null;
test('portable runner exists and imports without creating output', () => {
  assert.ok(runner, 'portable runner is missing');
});
test('runtime refusal precedes source reads', () => {
  assert.ok(runner);
  for (const runtime of [{node:'22.0.0',platform:'linux'}, {node:'24.1.0',platform:'win32'}]) {
    assert.throws(() => runner.prepare('/missing-source', runtime), /runtime/);
  }
});
test('CLI defaults to the owned repository and permits only exclusive absolute outputs', () => {
  assert.ok(runner);
  assert.deepEqual(runner.parseArgs([]), {mode:'test',sourceRoot:resolve(fileURLToPath(new URL('../..',import.meta.url)))});
  assert.equal(runner.parseArgs(['--preflight']).mode,'preflight');
  for (const args of [['--out','relative'], ['--out','/tmp/../bad'], ['--source-root','/tmp'], ['--preflight','--out','/tmp/out']]) assert.throws(() => runner.parseArgs(args));
});
test('bounded cleanup kills a remaining process group even after child close', async () => {
  assert.ok(runner);
  const signals=[];
  let alive=true;
  const result=await runner.closeGroup(42,{
    exists:()=>alive,
    kill:(_pid,signal)=>{signals.push(signal);alive=false;},
    now:()=>0,
    delay:async()=>{}
  });
  assert.equal(result,false);
  assert.deepEqual(signals,['SIGKILL']);
});
test('relocated checkout and temporary roots execute independently of cwd', {timeout:120000}, () => {
  assert.ok(runner);
  const parent=mkdtempSync(join(tmpdir(),'h100-portability-relocated-'));
  const relocated=join(parent,'checkout');
  const ownedRoot=resolve(fileURLToPath(new URL('../..',import.meta.url)));
  cpSync(ownedRoot,relocated,{recursive:true,filter:path=>{
    const relative=path.slice(ownedRoot.length);
    return relative===''||relative==='/tools'||relative.startsWith('/tools/h100-observer');
  }});
  symlinkSync(join(runner.parseArgs([]).sourceRoot,'node_modules'),join(relocated,'node_modules'),'dir');
  const cli=join(relocated,'tools/h100-observer/run.mjs');
  const invoke=args=>spawnSync(process.execPath,[cli,...args],{cwd:tmpdir(),encoding:'utf8',timeout:120000,maxBuffer:1048576});
  const preflight=invoke(['--preflight']);
  assert.equal(preflight.status,0,preflight.stderr);
  assert.deepEqual(readdirSync(relocated).sort(),['node_modules','tools']);
  const out=join(parent,'exclusive-output');
  const completed=invoke(['--out',out]);
  assert.equal(completed.status,0,completed.stderr);
  const receipt=JSON.parse(readFileSync(join(out,'receipt.json')));
  assert.equal(receipt.sourceBefore.runtime.execPath,process.execPath);
  assert.equal(receipt.inventory.variants,39);
  assert.match(readFileSync(join(out,'stdout.bin'),'utf8'),/tests 65/);
  assert.ok(readFileSync(join(out,'fixtures/index-1.mjs'),'utf8').includes(out));
  assert.equal(invoke(['--out',out]).status,1);
  for (const name of ['observer-base.mjs','source-pins.json']) {
    const path=join(relocated,'tools/h100-observer',name),original=readFileSync(path);
    appendFileSync(path,' ');
    const refused=invoke(['--preflight']);
    assert.equal(refused.status,1,`${name} drift must refuse before vendor import`);
    writeFileSync(path,original);
  }
});
test('default temporary parent contains an exclusively created run child', () => {
  assert.ok(runner);
  const parent = mkdtempSync(join(tmpdir(),'h100-portability-parent-'));
  const output = runner.allocateOutput(undefined, () => parent);
  assert.equal(output,join(parent,'run'));
  assert.deepEqual(readdirSync(parent),['run']);
  assert.throws(() => runner.allocateOutput(output), /EEXIST/);
});
test('fixed profile derives exactly two guarded legacy substitutions', () => {
  assert.ok(runner);
  const prepared = runner.prepare(runner.parseArgs([]).sourceRoot);
  assert.equal(prepared.workCeiling,393216);
  assert.equal(prepared.legacyObserver.bytes,25223);
  assert.equal(prepared.legacyObserver.sha256,'b24787211944d896a02f7856bec7350e699c3e670301ed9a57f68ef3bf7806fc');
  assert.equal(prepared.runtime.execPath,process.execPath);
  assert.equal(prepared.runtime.node,process.versions.node);
  assert.equal(prepared.vendorExecuted,false);
});
