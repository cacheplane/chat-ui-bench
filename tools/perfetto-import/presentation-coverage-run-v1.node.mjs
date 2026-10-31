import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';import {types} from 'node:util';import {tmpdir} from 'node:os';import {join} from 'node:path';
const api=()=>import('./presentation-coverage-run-v1.mjs');
test('runner rejects arbitrary policy/SQL before touching inputs',async()=>{const m=await api(),r=await m.runPresentationCoverageDiagnosticV1(JSON.stringify({schema:'browser-presentation-coverage-inventory-run-v1',policy:'arbitrary-sql',sql:'/never'}));assert.equal(r.status,'unavailable');assert.equal(r.stage,'config');assert.equal(r.authorities.fps,null);});
test('same-process adapter and inspectors refuse parsed/copied original capabilities',async()=>{const m=await api();for(const value of [{},null,{status:'diagnostic'}]){assert.throws(()=>m.inspectPresentationCoverageRunV1(value));await assert.rejects(m.verifyPresentationCoverageRunV1(value));const r=await m.runPresentationCoverageFromAcquisitionV1(value,'{}');assert.equal(r.status,'unavailable');assert.equal(r.authorities.nativeSupported,false);}});
test('unchanged process and custody helper bodies retain Capacity V3 exact text',async()=>{const old=await fs.readFile(new URL('./feedback-observations-capacity-export-v3.mjs',import.meta.url),'utf8'),source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8');const names=['clock','snapshot','write','originalPid','capture'];for(const name of names){const re=new RegExp('(?:async )?function '+name+'\\('),start=old.search(re),next=old.indexOf('\n',start),line=old.slice(start,next);assert.ok(start>=0&&line.includes('{'),'maintained helper '+name);assert.ok(source.includes(line),'exact unchanged '+name);}});
test('new SQL is full-selected and has one fixed phase-values insertion',async()=>{const sql=await fs.readFile(new URL('./presentation-coverage-v1.sql',import.meta.url),'utf8');assert.equal(sql.split('__PHASE_VALUES__').length,2);for(const token of ['FrameSequenceTrackerV3','_pc_track_args','_pc_processes','_pc_threads','_pc_stats','WITH RECURSIVE'])assert.ok(sql.includes(token));assert.equal(/\bLIMIT\s+\d|\bOFFSET\s+\d/.test(sql),false);});
test('all new production sources have exact runner pins and SQL agrees with the model',async()=>{const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),match=/const SOURCE_PINS=Object\.freeze\(([\s\S]*?)\);/.exec(source);assert.ok(match);const pins=JSON.parse(match[1]);for(const[name,pin]of Object.entries(pins)){const bytes=await fs.readFile(new URL('./'+name,import.meta.url));assert.equal(bytes.length,pin.bytes,name);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,name);}const model=JSON.parse(await fs.readFile(new URL('./presentation-coverage-source-model-v1.json',import.meta.url)));assert.equal(model.sql.bytes,pins[model.sql.path].bytes);assert.equal(model.sql.sha256,pins[model.sql.path].sha256);});
test('CLI config reads use bounded custody rather than unbounded readFile',async()=>{const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8');assert.equal(source.includes("fs.readFile(args[1]"),false);assert.ok(source.includes('snapshot(args[1],16384'));});
test('acquisition numeric identity is compared through original numeric Stats without nanosecond conversion',async()=>{const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),start=source.indexOf('async function snapshotAcquisitionFile('),end=source.indexOf('\nfunction freeze(',start);assert.ok(start>=0&&end>start,'separate acquisition identity helper');const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'authored-coverage-identity-'))),path=join(root,'authored');try{await fs.writeFile(path,'authored',{flag:'wx'});const numeric=await fs.stat(path),ns=await fs.stat(path,{bigint:true}),id=Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(ns[k])])),expected={path,bytes:8,sha256:'a'.repeat(64),identity:Object.fromEntries(['dev','ino','size','mtimeMs','ctimeMs'].map(k=>[k,numeric[k]]))},snapshot=async(p,cap,c,e)=>{assert.equal(p,path);assert.equal(e.identity,undefined);return{fact:{path,bytes:8,sha256:expected.sha256,identity:id}};},need=(ok,reason)=>{if(!ok)throw Error(reason);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),identity=s=>Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])])),fn=Function('snapshot','fs','constants','need','same','identity','types',source.slice(start,end)+'\nreturn snapshotAcquisitionFile;')(snapshot,fs,constants,need,same,identity,types),clock={check(){}};assert.deepEqual((await fn(path,32,clock,expected)).fact.identity,id);await assert.rejects(fn(path,32,clock,{...expected,identity:{...expected.identity,mtimeMs:expected.identity.mtimeMs+1}}));}finally{await fs.rm(root,{recursive:true,force:true});}});
async function receiptHarness() {
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function owned('),end=source.indexOf('\nexport function runPresentationCoverageDiagnosticV1',start),originals=new WeakMap(),original={};
 let failed=false;
 const e={clock:{check(){}},account:{},core:{},summary:{status:'diagnostic'},verify:async()=>{if(failed)throw Error('late-custody-drift');}};
 originals.set(original,e);
 const api=Function('originals','need','types','chargePresentationCoverageWorkV1','inspectPresentationCoverageCoreV1',source.slice(start,end).replaceAll('export ','')+';return {inspectPresentationCoverageRunV1,verifyPresentationCoverageRunV1};')(originals,(ok,reason)=>{if(!ok)throw Error(reason);},types,()=>{},()=>{});
 return {...api,original,fail(){failed=true;},restore(){failed=false;}};
}
test('observed custody failure permanently withdraws the original receipt after restoration',async()=>{
 const h=await receiptHarness();assert.equal(h.inspectPresentationCoverageRunV1(h.original).status,'diagnostic');
 h.fail();await assert.rejects(h.verifyPresentationCoverageRunV1(h.original));
 assert.throws(()=>h.inspectPresentationCoverageRunV1(h.original));
 h.restore();assert.throws(()=>h.inspectPresentationCoverageRunV1(h.original));await assert.rejects(h.verifyPresentationCoverageRunV1(h.original));
});
test('production deadline is fixed while explicitly authored entry accepts shorter deadline',async()=>{
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8');
 const start=source.indexOf('function configOf('),end=source.indexOf('\nasync function sources(',start);
 const fn=Function('need','pathOK','SHA','model','PROCESSOR_PINS','process','SELF','SOURCE_PINS','BASE','join',source.slice(start,end)+';return configOf;')((ok,reason)=>{if(!ok)throw Error(reason);},()=>true,/^[a-f0-9]{64}$/, {policy:'p'}, {'darwin-arm64':'a'.repeat(64)}, {platform:'darwin',arch:'arm64',execPath:'/node'}, '/runner',{},'/base',join);
 const c={schema:'browser-presentation-coverage-inventory-run-v1',policy:'p',trace:{path:'/trace',bytes:0,sha256:'a'.repeat(64)},processor:{path:'/processor',sha256:'a'.repeat(64)},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:'/out',deadlineMs:5000};
 assert.throws(()=>fn(JSON.stringify(c)));assert.equal(fn(JSON.stringify(c),true).deadlineMs,5000);c.deadlineMs=60000;assert.equal(fn(JSON.stringify(c)).deadlineMs,60000);
});
test('evaluation inspection and publication consume one terminal shared account',async()=>{
 const {createPresentationCoverageAccountV1,chargePresentationCoverageWorkV1}=await import('./presentation-coverage-wire-v1.mjs');
 const {evaluatePresentationCoverageV1,inspectPresentationCoverageCoreV1}=await import('./presentation-coverage-core-v1.mjs');
 const {basicCoverageGraph,encodeCoverageGraph,SELECTOR}=await import('./presentation-coverage-fixtures-v1.mjs');
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),a=source.indexOf('function serialize('),b=source.indexOf('\nfunction configOf(',a);
 const serialize=Function('chargePresentationCoverageWorkV1','need',source.slice(a,b)+';return serialize;')(chargePresentationCoverageWorkV1,(ok,reason)=>{if(!ok)throw Error(reason);});
 const account=createPresentationCoverageAccountV1();
 chargePresentationCoverageWorkV1(account,67108864-100000);
 const core=evaluatePresentationCoverageV1(encodeCoverageGraph(basicCoverageGraph()),SELECTOR,account);assert.equal(core.status,'diagnostic',core.reason);
 inspectPresentationCoverageCoreV1(core);
 assert.throws(()=>serialize({diagnostic:core,publicationPadding:'x'.repeat(20000)},account),/logical-work-limit/);
 assert.throws(()=>inspectPresentationCoverageCoreV1(core),/logical-work-limit/);
 assert.throws(()=>chargePresentationCoverageWorkV1(account,0),/logical-work-limit/);
});
test('generated artifact wrappers prepay bounded passes and refuse before I/O on exhaustion',async()=>{
 const {createPresentationCoverageAccountV1,chargePresentationCoverageWorkV1}=await import('./presentation-coverage-wire-v1.mjs');
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),a=source.indexOf('function generatedWork('),b=source.indexOf('\nfunction configOf(',a);
 let writes=0,reads=0;
 const api=Function('need','chargePresentationCoverageWorkV1','write','snapshot',source.slice(a,b)+';return {generatedWork,writeGenerated,readGenerated};')((ok,reason)=>{if(!ok)throw Error(reason);},chargePresentationCoverageWorkV1,async()=>{writes++;},async()=>{reads++;});
 for(const bytes of [NaN,Infinity,-1,-0,1.5,33])assert.throws(()=>api.generatedWork(createPresentationCoverageAccountV1(),bytes,32,4),/generated-byte-capacity/);
 const account=createPresentationCoverageAccountV1();chargePresentationCoverageWorkV1(account,67108864-2);
 await assert.rejects(api.writeGenerated('/authored',Buffer.from('x'),32,{},account),/logical-work-limit/);
 assert.equal(writes,0);await assert.rejects(api.readGenerated({path:'/authored',bytes:1},32,{},account),/logical-work-limit/);assert.equal(reads,0);
 assert.throws(()=>api.generatedWork(account,0,32,4),/logical-work-limit/);
});
test('combined entry work refuses before spawning when capture reservation cannot fit',async()=>{
 const {createPresentationCoverageAccountV1,chargePresentationCoverageWorkV1}=await import('./presentation-coverage-wire-v1.mjs');
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),a=source.indexOf('async function run(raw,'),b=source.indexOf('\nexport async function runPresentationCoverageFromAcquisitionV1',a),g=source.indexOf('function generatedWork('),h=source.indexOf('\nasync function writeGenerated(',g);
 const need=(ok,reason)=>{if(!ok)throw Error(reason);},generatedWork=Function('need','chargePresentationCoverageWorkV1',source.slice(g,h)+';return generatedWork;')(need,chargePresentationCoverageWorkV1);
 const account=createPresentationCoverageAccountV1();chargePresentationCoverageWorkV1(account,67108864-1000000);let captures=0;
 const c={out:'/authored/out',trace:{path:'/authored/trace'},processor:{path:'/authored/processor'},phaseNames:{start:'start',end:'end'},target:{frameId:'frame',loaderId:'loader'},deadlineMs:5000};
 const fn=Function('join','need','fs','dirname','textWork','configOf','chargePresentationCoverageWorkV1','hash','sources','snapshot','writeGenerated','generatedWork','capture','refused',source.slice(a,b)+';return run;')(join,need,{realpath:async path=>path,mkdir:async()=>{}},()=>'/authored',(raw,token)=>chargePresentationCoverageWorkV1(token,raw.length*8+1),()=>c,chargePresentationCoverageWorkV1,()=> 'a'.repeat(64),async()=>({'presentation-coverage-v1.sql':{path:'/authored/source.sql',bytes:16}}),async(path,cap,clock,expected,retain)=>({fact:{path,bytes:16},contents:retain?Buffer.from('__PHASE_VALUES__'):null}),async path=>({path,bytes:16}),generatedWork,async()=>{captures++;},(stage,reason)=>({status:'unavailable',stage,reason}));
 const r=await fn('{}',true,null,{clock:{check(){}},account});
 assert.deepEqual(r,{status:'unavailable',stage:'process',reason:'logical-work-limit'});assert.equal(captures,0);assert.throws(()=>chargePresentationCoverageWorkV1(account,0),/logical-work-limit/);
});
test('runner key enumeration and freezing receive fresh prepayment before built-ins',async()=>{
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),start=source.indexOf('function freeze('),end=source.indexOf('\nfunction sameOwned(',start),log=[];let paid=0;
 const charge=(account,n)=>{paid=n;log.push('pay');};
 const check=(name,n)=>{assert.equal(log.at(-1),'pay',name+' requires fresh prepayment');assert.ok(paid>=n,name+' debit size');log.push(name);};
 const objects={keys(v){check('keys',Object.keys(v).length+1);return Object.keys(v);},freeze(v){check('freeze',Object.keys(v).length+(Array.isArray(v)?2:1));return Object.freeze(v);}};
 const api=Function('chargePresentationCoverageWorkV1','need','Object',source.slice(start,end)+';return {freeze,serialize};')(charge,(ok,reason)=>{if(!ok)throw Error(reason);},objects);
 api.freeze({one:['a','b'],two:'c'},{});api.serialize({one:['a','b'],two:'c'},{});
 assert.equal(log.filter(x=>x==='keys').length,4);assert.equal(log.filter(x=>x==='freeze').length,2);
});
test('exhausted runner accounts stop before key enumeration and object freezing',async()=>{
 const source=await fs.readFile(new URL('./presentation-coverage-run-v1.mjs',import.meta.url),'utf8'),start=source.indexOf('function freeze('),end=source.indexOf('\nfunction sameOwned(',start);
 for(const method of ['freeze','serialize']) {
  let keys=0,freezes=0;
  const objects={keys(v){keys++;return Object.keys(v);},freeze(v){freezes++;return Object.freeze(v);}};
  const api=Function('chargePresentationCoverageWorkV1','need','Object',source.slice(start,end)+';return {freeze,serialize};')(()=>{throw Error('logical-work-limit');},(ok,reason)=>{if(!ok)throw Error(reason);},objects);
  assert.throws(()=>api[method]({one:'value'},{}),/logical-work-limit/);assert.equal(keys,0,method);assert.equal(freezes,0,method);
 }
});
