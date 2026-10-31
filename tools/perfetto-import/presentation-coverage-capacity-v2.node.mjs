// Authored capacity controls only. No capture/cohort input is accepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basicCoverageGraph,encodeCoverageGraph,SELECTOR,slice} from './presentation-coverage-fixtures-v1.mjs';
const api=()=>import('./presentation-coverage-core-v2.mjs');
const wire=()=>import('./presentation-coverage-wire-v2.mjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const expectedV1={
 'presentation-coverage-run-v1.mjs':'a48126cf988a177704963bbacc4248cf166abc2adde47e70b73fc6a749faa35c',
 'presentation-coverage-source-model-v1.json':'0bbbc5bf2e96eea8fcededd30978df64595a1ecf45c8922b85da1ddf6d271983',
 'presentation-coverage-v1.sql':'f34249cdfb8a003b24e9e342dd09f1e92a0c943a49dd9e239dadd28c9480822e',
 'presentation-coverage-wire-v1.mjs':'bfebdc94bf606437eba03559c9caa3d76c42cbf0b29b65499c2e46461ef24cbb',
 'presentation-coverage-core-v1.mjs':'4dc156bc6afdf628d0a30631f720393631c2137d20ec28deb4bf33df5508d2a6'
};
function graph(count,lateMalformed=false){const g=basicCoverageGraph();for(let i=3;i<count;i++)g.slices.push(slice(i+1,'BeginFrame',[],{ts:String(1000+i),...(lateMalformed&&i===count-1?{track_id:'999'}:{})}));return g;}
function normalize(v){return JSON.parse(JSON.stringify(v).replaceAll('browser-presentation-coverage-inventory-v2','browser-presentation-coverage-inventory-v1').replaceAll('whole-selected-presentation-coverage-v2','whole-selected-presentation-coverage-v1'));}
test('V1 five-file production closure stays byte-identical',async()=>{for(const [name,sha]of Object.entries(expectedV1))assert.equal(hash(await fs.readFile(new URL(name,import.meta.url))),sha,name);});
test('V2 selects the reviewed fixed finite capacity model',async()=>{
 const {default:m}=await import('./presentation-coverage-source-model-v2.json',{with:{type:'json'}});
 assert.equal(m.schema,'browser-presentation-coverage-inventory-v2');assert.equal(m.policy,'whole-selected-presentation-coverage-v2');
 for(const [k,v]of Object.entries({slices:32768,csvBytes:8388608,resultBytes:4194304,work:536870912,edges:1048575,nodes:524288,diagnosticEntries:65536}))assert.equal(m.limits[k],v,k);
 const {default:old}=await import('./presentation-coverage-source-model-v1.json',{with:{type:'json'}});
 for(const k of Object.keys(old.limits).filter(k=>!['slices','csvBytes','resultBytes','work','edges','nodes','diagnosticEntries'].includes(k)))assert.equal(m.limits[k],old.limits[k],k);
 const sql=await fs.readFile(new URL('presentation-coverage-v2.sql',import.meta.url));assert.equal(m.sql.bytes,sql.length);assert.equal(m.sql.sha256,hash(sql));
 const normalized=structuredClone(m);normalized.schema=old.schema;normalized.policy=old.policy;normalized.sql.path=old.sql.path;normalized.sql.bytes=old.sql.bytes;normalized.sql.sha256=old.sql.sha256;for(const k of ['slices','csvBytes','resultBytes','work','edges','nodes','diagnosticEntries'])normalized.limits[k]=old.limits[k];assert.deepEqual(normalized,old);
});
test('small graph typed semantic output matches V1 under explicit identity normalization',async()=>{const old=await import('./presentation-coverage-core-v1.mjs'),next=await api();for(const n of [3,15,100]){const bytes=encodeCoverageGraph(graph(n));const a=old.evaluatePresentationCoverageV1(bytes,SELECTOR),b=next.evaluatePresentationCoverageV2(bytes,SELECTOR);assert.equal(b.status,'diagnostic',b.reason);assert.deepEqual(normalize(b),a);}});
test('V1 refuses its original slice bound while V2 admits 32K wire and refuses 32K plus one',async()=>{
 const old=await import('./presentation-coverage-core-v1.mjs'),w=await wire();assert.equal(old.evaluatePresentationCoverageV1(encodeCoverageGraph(graph(8193)),SELECTOR).reason,'graph-row-limit');
 for(const n of [8192,8193,16384,32768]){const parsed=w.parsePresentationCoverageCSVV2(encodeCoverageGraph(graph(n)),w.createPresentationCoverageAccountV2());assert.equal(w.inspectPresentationCoverageWireV2(parsed).tables[2].length,n);}
 assert.throws(()=>w.parsePresentationCoverageCSVV2(encodeCoverageGraph(graph(32769)),w.createPresentationCoverageAccountV2()),/graph-row-limit/);
});
test('late malformed selected slice remains a refusal at the full 32K bound',async()=>{const r=(await api()).evaluatePresentationCoverageV2(encodeCoverageGraph(graph(32768,true)),SELECTOR);assert.equal(r.status,'unavailable');assert.equal(r.reason,'missing-track');assert.ok(Object.values(r.authorities).every(x=>x===false||x===null));});
test('V2 work is prepaid, irreversible and cannot accept a V1 account',async()=>{const w=await wire(),old=await import('./presentation-coverage-wire-v1.mjs');const a=w.createPresentationCoverageAccountV2();w.chargePresentationCoverageWorkV2(a,536870912);assert.throws(()=>w.chargePresentationCoverageWorkV2(a,1),/logical-work-limit/);assert.throws(()=>w.chargePresentationCoverageWorkV2(a,0),/logical-work-limit/);assert.throws(()=>w.parsePresentationCoverageCSVV2(encodeCoverageGraph(basicCoverageGraph()),old.createPresentationCoverageAccountV1()),/invalid-work-account/);});
test('12K authored tracker descendants retain counters and a result above the old physical cap',async()=>{
 const {denseCoverageGraphV2}=await import('./presentation-coverage-fixtures-v2.mjs');const csv=encodeCoverageGraph(denseCoverageGraphV2(12000)),r=(await api()).evaluatePresentationCoverageV2(csv,SELECTOR);
 assert.equal(r.status,'diagnostic',r.reason);assert.equal(r.selectedGraph.slices,12004);assert.equal(r.trackers[0].nestedSliceIds.length,12001);assert.equal(r.trackers[0].counters.length,12000);assert.ok(Buffer.byteLength(JSON.stringify(r))>262144);assert.ok(Object.values(r.authorities).every(x=>x===false||x===null));
});
test('V2 production algorithms differ only at explicit owned identities, pins and role capacities',async()=>{
 const normalizeSource=source=>source
  .replaceAll(/presentation-coverage-(source-model|wire|core|run)-v2/g,'presentation-coverage-$1-v1')
  .replaceAll('presentation-coverage-v2.sql','presentation-coverage-v1.sql')
  .replaceAll(/(PresentationCoverage[A-Za-z]*)V2/g,'$1V1').replaceAll('PRESENTATION_COVERAGE_HEADERS_V2','PRESENTATION_COVERAGE_HEADERS_V1')
  .replaceAll('browser-presentation-coverage-inventory-run-v2','browser-presentation-coverage-inventory-run-v1').replaceAll('browser-presentation-coverage-from-acquisition-v2','browser-presentation-coverage-from-acquisition-v1').replaceAll('presentation-coverage-process-manifest-v2','presentation-coverage-process-manifest-v1')
  .replace('bound<=25165824','bound<=1572864').replace('Buffer.byteLength(text)<=4194304','Buffer.byteLength(text)<=262144')
  .replace("stdoutCap=name==='query'?8388608:262144","stdoutCap=name==='query'?2097152:262144").replace('stdoutCap+65536,8388608+65536','stdoutCap+65536,2097152+65536')
  .replace("files['query.stdout'],8388608","files['query.stdout'],2097152")
  .replace("key==='query.stdout'?8388608:key.endsWith('stderr')?65536:['manifest','result'].includes(key)?4194304:262144","key==='query.stdout'?2097152:key.endsWith('stderr')?65536:262144")
  .replace('serialize(manifest,account),4194304','serialize(manifest,account),262144').replace('payload,4194304','payload,262144');
 for(const role of ['wire','core','run']){
  let old=await fs.readFile(new URL('presentation-coverage-'+role+'-v1.mjs',import.meta.url),'utf8'),next=await fs.readFile(new URL('presentation-coverage-'+role+'-v2.mjs',import.meta.url),'utf8');
  if(role==='run'){
   const pins=JSON.parse(next.match(/const SOURCE_PINS=Object.freeze\((\{[\s\S]*?\})\);/)[1]);
   assert.deepEqual(Object.keys(pins),['presentation-coverage-v2.sql','presentation-coverage-wire-v2.mjs','presentation-coverage-core-v2.mjs','presentation-coverage-source-model-v2.json']);
   for(const [name,pin]of Object.entries(pins)){const raw=await fs.readFile(new URL(name,import.meta.url));assert.deepEqual(pin,{bytes:raw.length,sha256:hash(raw)});}
   // Remove only the independently checked exact four-member pin literal.
   old=old.replace(/const SOURCE_PINS=Object.freeze\(\{[\s\S]*?\}\);/,'const SOURCE_PINS=VERIFIED;');next=next.replace(/const SOURCE_PINS=Object.freeze\(\{[\s\S]*?\}\);/,'const SOURCE_PINS=VERIFIED;');
  }
  assert.equal(normalizeSource(next),old,role+' algorithm parity');
 }
 const oldSQL=await fs.readFile(new URL('presentation-coverage-v1.sql',import.meta.url),'utf8'),newSQL=await fs.readFile(new URL('presentation-coverage-v2.sql',import.meta.url),'utf8');
 assert.equal(newSQL,oldSQL.replace('CREATE PERFETTO VIEW _pc_selected AS','CREATE PERFETTO TABLE _pc_selected AS').replace('CREATE PERFETTO VIEW _pc_context AS','CREATE PERFETTO TABLE _pc_context AS'));
});
test('runner serializer admits its exact 4MiB role bound and refuses an additional byte',async()=>{
 const source=await fs.readFile(new URL('presentation-coverage-run-v2.mjs',import.meta.url),'utf8'),start=source.indexOf('function serialize('),end=source.indexOf('\nfunction sameOwned(',start);assert.ok(start>0&&end>start);
 const w=await wire(),serialize=Function('chargePresentationCoverageWorkV2','need',source.slice(start,end)+';return serialize;')(w.chargePresentationCoverageWorkV2,(ok,reason)=>{if(!ok)throw Error(reason);});
 const overhead=Buffer.byteLength(JSON.stringify({padding:''})),value={padding:'x'.repeat(4194304-overhead)};assert.equal(serialize(value,w.createPresentationCoverageAccountV2()).length,4194304);
 assert.throws(()=>serialize({padding:value.padding+'x'},w.createPresentationCoverageAccountV2()),/result-byte-limit|result-capacity/);
 const exhausted=w.createPresentationCoverageAccountV2();w.chargePresentationCoverageWorkV2(exhausted,536870912-1);assert.throws(()=>serialize(value,exhausted),/logical-work-limit/);assert.throws(()=>w.chargePresentationCoverageWorkV2(exhausted,0),/logical-work-limit/);
});
