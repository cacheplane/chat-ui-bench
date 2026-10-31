// Authored representation controls only. No cohort inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basicCoverageGraph,encodeCoverageGraph,arg,SELECTOR} from './presentation-coverage-fixtures-v1.mjs';
import {evaluatePresentationCoverageV2} from './presentation-coverage-core-v2.mjs';
import {parsePresentationCoverageCSVV2,inspectPresentationCoverageWireV2,createPresentationCoverageAccountV2} from './presentation-coverage-wire-v2.mjs';
const read=name=>fs.readFile(new URL(name,import.meta.url),'utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
const exportPolicy='typed-uint64-decimal-export-v3';
const boundaries=['0','1','9007199254740991','9007199254740992','9223372036854775807','9223372036854775808','9223372036854775809','18446744073709551614','18446744073709551615'];
function uintGraph(value){const g=basicCoverageGraph();g.slices[0].args.push(arg('debug.unmodeled',value,'uint'));g.tracks[0].source_arg_set_id='100';g.tracks[0].dimension_arg_set_id='101';for(const id of ['100','101'])g.trackArgs.push({arg_set_id:id,...arg('uint-track',value,'uint')});return g;}
test('immutable V2 reader admits complete thirteen-table uint64 slice/source/dimension graphs',()=>{
 for(const value of boundaries){const bytes=encodeCoverageGraph(uintGraph(value)),w=inspectPresentationCoverageWireV2(parsePresentationCoverageCSVV2(bytes,createPresentationCoverageAccountV2()));assert.equal(w.tables.length,13);assert.equal(w.tables[4].find(a=>a.key==='debug.unmodeled').int_value,value);assert.deepEqual(w.tables[8].map(a=>a.int_value),[value,value]);const r=evaluatePresentationCoverageV2(bytes,SELECTOR);assert.equal(r.status,'diagnostic',r.reason);assert.ok(Object.values(r.authorities).every(x=>x===false||x===null));}
});
test('complete thirteen-table slice and track registries retain same-key unsigned numeric order',()=>{const g=uintGraph('0');g.slices[0].args=g.slices[0].args.filter(a=>a.key!=='debug.unmodeled');for(const value of [...boundaries].reverse())g.slices[0].args.push(arg('debug.unmodeled',value,'uint'));g.trackArgs=[];for(const id of ['100','101'])for(const value of [...boundaries].reverse())g.trackArgs.push({arg_set_id:id,...arg('uint-track',value,'uint')});const bytes=encodeCoverageGraph(g),w=inspectPresentationCoverageWireV2(parsePresentationCoverageCSVV2(bytes,createPresentationCoverageAccountV2()));assert.deepEqual(w.tables[4].filter(a=>a.key==='debug.unmodeled').map(a=>a.int_value),boundaries);for(const id of ['100','101'])assert.deepEqual(w.tables[8].filter(a=>a.arg_set_id===id).map(a=>a.int_value),boundaries);assert.equal(evaluatePresentationCoverageV2(bytes,SELECTOR).status,'diagnostic');});
for(const [label,change,reason] of [
 ['negative uint',a=>a.int_value='-1','argument-uint'],
 ['uint overflow',a=>a.int_value='18446744073709551616','integer-range'],
 ['null uint',a=>a.int_value=null,'argument-value-type'],
 ['bool two',a=>{a.value_type='bool';a.int_value='2';},'argument-bool'],
 ['signed overflow',a=>{a.value_type='int';a.int_value='9223372036854775808';},'argument-int-range']
])for(const role of ['slice','track'])test('strict V2 reader still refuses '+role+' '+label,()=>{const g=uintGraph('1'),a=role==='slice'?g.slices[0].args.at(-1):g.trackArgs[0];change(a);const r=evaluatePresentationCoverageV2(encodeCoverageGraph(g),SELECTOR);assert.equal(r.status,'unavailable');assert.equal(r.reason,reason);});
test('V3 SQL changes exactly both typed uint projections and unsigned sort buckets',async()=>{
 const old=await read('presentation-coverage-v2.sql'),next=await read('presentation-coverage-v3.sql');
 assert.equal(old.split('s.int_value AS int_value').length,3);
 assert.equal(old.split('s.value_type COLLATE BINARY,s.int_value,').length,3);
 assert.equal(next,old.replaceAll('s.int_value AS int_value',"CASE WHEN s.value_type='uint' AND TYPEOF(s.int_value)='integer' AND s.int_value<0 THEN printf('%llu',s.int_value) ELSE s.int_value END AS int_value").replaceAll('s.value_type COLLATE BINARY,s.int_value,',"s.value_type COLLATE BINARY,CASE WHEN s.value_type='uint' AND s.int_value<0 THEN 1 ELSE 0 END,s.int_value,"));
});
test('V3 exporter contract names immutable V2 inventory and exact executed SQL',async()=>{
 const api=await import('./presentation-coverage-run-v3.mjs'),c=api.EXPORT_CONTRACT;
 const sql=Buffer.from(await read('presentation-coverage-v3.sql'));
 assert.deepEqual(c,{schema:'presentation-coverage-export-contract-v3',exportPolicy,inventorySchema:'browser-presentation-coverage-inventory-v2',inventoryPolicy:'whole-selected-presentation-coverage-v2',inventoryModel:'presentation-coverage-source-model-v2.json',sql:{path:'presentation-coverage-v3.sql',bytes:sql.length,sha256:hash(sql)},argumentEncoding:'typed-uint64-canonical-decimal-other-cells-unchanged'});
 assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.sql));
});
test('V3 refuses missing export policy and reports both contract layers',async()=>{
 const api=await import('./presentation-coverage-run-v3.mjs');
 const r=await api.runPresentationCoverageDiagnosticV3('{}');
 assert.equal(r.status,'unavailable');assert.equal(r.reason,'invalid-config');
 assert.equal(r.schema,'browser-presentation-coverage-inventory-run-v3');
 assert.equal(r.policy,'whole-selected-presentation-coverage-v2');assert.equal(r.exportPolicy,exportPolicy);
 assert.ok(Object.values(r.authorities).every(x=>x===false||x===null));
});
test('V3 canonical config requires the fixed export policy without extra SQL/cap options',async()=>{
 const source=await read('presentation-coverage-run-v3.mjs'),a=source.indexOf('function configOf('),b=source.indexOf('\nasync function sources(',a),{EXPORT_CONTRACT}=await import('./presentation-coverage-run-v3.mjs');
 const fn=Function('need','pathOK','SHA','model','EXPORT_CONTRACT','PROCESSOR_PINS','process','SELF','SOURCE_PINS','BASE','join',source.slice(a,b)+';return configOf;')((ok,r)=>{if(!ok)throw Error(r);},()=>true,/^[a-f0-9]{64}$/, {policy:'whole-selected-presentation-coverage-v2'},EXPORT_CONTRACT,{'darwin-arm64':'a'.repeat(64)},{platform:'darwin',arch:'arm64',execPath:'/node'},'/runner',{},'/base',(a,b)=>a+'/'+b);
 const c={schema:'browser-presentation-coverage-inventory-run-v3',policy:'whole-selected-presentation-coverage-v2',exportPolicy,trace:{path:'/trace',bytes:0,sha256:'a'.repeat(64)},processor:{path:'/processor',sha256:'a'.repeat(64)},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:'/out',deadlineMs:60000};assert.deepEqual(fn(JSON.stringify(c)),c);
 for(const change of [x=>delete x.exportPolicy,x=>x.exportPolicy='other',x=>x.exportPolicy=null,x=>x.sql='/other',x=>x.caps={},x=>x.deadlineMs=60001,x=>x.deadlineMs=5000]){const wrong=structuredClone(c);change(wrong);assert.throws(()=>fn(JSON.stringify(wrong)),/invalid-config/);}
});
test('V3 runner retains exact V2 algorithms outside explicit exporter identities and policy fields',async()=>{
 const old=await read('presentation-coverage-run-v2.mjs'),next=await read('presentation-coverage-run-v3.mjs');
 const pattern=/const SOURCE_PINS=Object.freeze\((\{[\s\S]*?\})\);/;
 const pins=JSON.parse(next.match(pattern)[1]);assert.deepEqual(Object.keys(pins),['presentation-coverage-v3.sql','presentation-coverage-wire-v2.mjs','presentation-coverage-core-v2.mjs','presentation-coverage-source-model-v2.json']);
 for(const [name,pin]of Object.entries(pins)){const b=Buffer.from(await read(name));assert.deepEqual(pin,{bytes:b.length,sha256:hash(b)});}
 const contract=next.match(/\/\/ V3 versions the exporter only;[^]*?\n\}\);\n/);assert.ok(contract);
 assert.equal(contract[0],`// V3 versions the exporter only; the imported inventory model/core remain V2.
// model.sql identifies the legacy V2 query; EXPORT_CONTRACT.sql is executed.
export const EXPORT_CONTRACT=Object.freeze({
  schema:'presentation-coverage-export-contract-v3',exportPolicy:'typed-uint64-decimal-export-v3',inventorySchema:'browser-presentation-coverage-inventory-v2',inventoryPolicy:model.policy,inventoryModel:'presentation-coverage-source-model-v2.json',sql:Object.freeze({path:'presentation-coverage-v3.sql',bytes:${pins['presentation-coverage-v3.sql'].bytes},sha256:'${pins['presentation-coverage-v3.sql'].sha256}'}),argumentEncoding:'typed-uint64-canonical-decimal-other-cells-unchanged'
});
`);
 let normalized=next.replace(contract[0],'').replace(pattern,'const SOURCE_PINS=VERIFIED;');
 for(const name of ['runPresentationCoverageDiagnostic','runAuthoredPresentationCoverageDiagnostic','inspectPresentationCoverageRun','verifyPresentationCoverageRun','runPresentationCoverageFromAcquisition'])normalized=normalized.replaceAll(name+'V3',name+'V2');
 for(const name of ['browser-presentation-coverage-inventory-run','presentation-coverage-process-manifest','browser-presentation-coverage-from-acquisition'])normalized=normalized.replaceAll(name+'-v3',name+'-v2');
 normalized=normalized.replaceAll('presentation-coverage-v3.sql','presentation-coverage-v2.sql')
  .replaceAll('exportPolicy:EXPORT_CONTRACT.exportPolicy,','').replaceAll('exportPolicy:c.exportPolicy,','').replaceAll('exportPolicy:returned.exportPolicy,','')
  .replaceAll('&&c.exportPolicy===EXPORT_CONTRACT.exportPolicy','')
  .replace('schema:result.schema,policy:result.policy,exportPolicy:result.exportPolicy,status:result.status,','schema:result.schema,status:result.status,');
 assert.equal(normalized,old.replace(pattern,'const SOURCE_PINS=VERIFIED;'));
});
test('the immutable V2 five-file production closure remains exact',async()=>{
 const pins={'presentation-coverage-run-v2.mjs':'bc956e196c1a8c79835f93f48b8195aeb7f3f96e280e18b5e0ce9d5562d9c218','presentation-coverage-source-model-v2.json':'1248549504a954ac87ea91af9b3292d72c65d6a374fa9d8dcb68bc02156048a8','presentation-coverage-v2.sql':'7c15673b8dc5946794f714baf93dd49b6dd6df285b1302f3833685072bfcce2e','presentation-coverage-wire-v2.mjs':'bc33c1e69d7134de6579ed6385bc27b0a45b50aa16effc8cd13c07176000104a','presentation-coverage-core-v2.mjs':'49f9f01a6e2b4e3e416f37fdc04127addf347afeaa4268d503c87c6d28a03eb6'};
 for(const [name,pin]of Object.entries(pins))assert.equal(hash(await read(name)),pin,name);
});
