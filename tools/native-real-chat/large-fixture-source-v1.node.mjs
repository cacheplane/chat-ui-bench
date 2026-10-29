import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLongThreadFixture,canonicalSerialize} from '../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture} from '../../tests/fixtures/aimock.ts';
const api=await import('./large-fixture-source-v1.mjs').catch(()=>({}));
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const count of [1000,10000])test(`actual AIMock ${count} source preserves every message in bounded owned chunks`,()=>{
 assert.equal(typeof api[`compileHistory${count}SourceFixtureV1`],'function');
 const admitted=api[`compileHistory${count}SourceFixtureV1`]();
 const profile=`native-history${count}-v1`,manifest=api.inspectLargeFixtureV1(admitted,profile);
 const expected=createLongThreadFixture({seed:1,historyCount:count,responseBytes:6400,journey:'history-reading'});
 const compiled=compileCanonicalHistoryRestoreFixture(expected,manifest.identity);
 for(const key of ['sourceSha256','eventsSha256','historySha256'])assert.equal(manifest.digests[key],compiled.digests[key]);
 assert.equal(manifest.digests.chunksSha256,hash(canonicalSerialize({schema:1,profile,historyCount:count,chunks:manifest.chunks})));
 const restored=[];
 for(let index=0;index<count/100;index++){
  const bytes=api.readLargeFixtureChunkV1(admitted,profile,index),fact=manifest.chunks[index];
  assert.ok(bytes.length<=65536);assert.equal(bytes.length,fact.bytes);assert.equal(hash(bytes),fact.sha256);assert.equal(fact.start,index*100);assert.equal(fact.count,100);
  restored.push(...JSON.parse(bytes));bytes.fill(0);assert.notEqual(api.readLargeFixtureChunkV1(admitted,profile,index)[0],0);
 }
 assert.deepEqual(restored,expected.history);assert.equal(manifest.digests.projectionSha256,hash(JSON.stringify(restored)));assert.equal(manifest.digests.projectionBytes,Buffer.byteLength(JSON.stringify(restored)));assert.equal(manifest.digests.sourceSha256,hash(canonicalSerialize(expected)));assert.ok(Buffer.byteLength(JSON.stringify(manifest))<=65536);
 assert.throws(()=>api.inspectLargeFixtureV1(structuredClone(admitted),profile));assert.throws(()=>api.inspectLargeFixtureV1(admitted,`native-history${count===1000?10000:1000}-v1`));
 for(const index of [-1,count/100,NaN,'0'])assert.throws(()=>api.readLargeFixtureChunkV1(admitted,profile,index));
 assert.ok(Object.isFrozen(manifest));assert.ok(Object.isFrozen(manifest.chunks[0]));
});
for(const count of [1000,10000])test(`${count} projector refuses altered source, event, snapshot and identity even with recomputed digests`,()=>{
 assert.equal(typeof api[`projectHistory${count}SourceFixtureV1`],'function');
 const fresh=()=>{const source=createLongThreadFixture({seed:1,historyCount:count,responseBytes:6400,journey:'history-reading'}),identity={threadId:`native-history${count}-source-v1`,runId:`native-history${count}-restore-v1`,epochMs:0};return {source,compiled:compileCanonicalHistoryRestoreFixture(source,identity)};};
 const project=api[`projectHistory${count}SourceFixtureV1`];
 for(const mutate of [
  (s,c)=>{s.workload.seed=2;},(s,c)=>{c.events[1].messages.at(-1).content='x'.repeat(512);c.digests.eventsSha256=hash(canonicalSerialize(c.events));c.digests.historySha256=hash(canonicalSerialize(c.events[1].messages));},
  (s,c)=>{c.events[0].threadId='foreign';},(s,c)=>{c.events.reverse();},(s,c)=>{c.events[1].messages.pop();},(s,c)=>{c.events[1].messages[0].extra=true;},(s,c)=>{c.input.messages.push({id:'foreign',role:'user',content:'x'});},(s,c)=>{c.digests.sourceSha256='0'.repeat(64);}
 ]){const{source,compiled}=fresh();mutate(source,compiled);assert.throws(()=>project(source,compiled),/large-fixture/);}
 const{source,compiled}=fresh();let reads=0;const proxy=new Proxy(source,{ownKeys(){reads++;throw Error();}});assert.throws(()=>project(proxy,compiled));assert.equal(reads,0);
 const hostile={};Object.defineProperty(hostile,'input',{get(){reads++;throw Error();}});assert.throws(()=>project(source,hostile));assert.equal(reads,0);
});
test('canonical caller projection cannot acquire genuine AIMock invocation admission',()=>{
 const source=createLongThreadFixture({seed:1,historyCount:1000,responseBytes:6400,journey:'history-reading'});
 const compiled=compileCanonicalHistoryRestoreFixture(source,{threadId:'native-history1000-source-v1',runId:'native-history1000-restore-v1',epochMs:0});
 compiled.fixture={events:[],match:{predicate:()=>false}};compiled.foreign=true;
 const authored=api.projectHistory1000SourceFixtureV1(source,compiled);
 assert.equal(authored.authority,false);
 assert.throws(()=>api.inspectLargeFixtureV1(authored,'native-history1000-v1'));
 assert.throws(()=>api.readLargeFixtureChunkV1(authored,'native-history1000-v1',0));
 const genuine=api.compileHistory1000SourceFixtureV1();
 assert.equal(api.inspectLargeFixtureV1(genuine,'native-history1000-v1'),genuine);
 assert.throws(()=>api.inspectLargeFixtureV1(structuredClone(genuine),'native-history1000-v1'));
});
