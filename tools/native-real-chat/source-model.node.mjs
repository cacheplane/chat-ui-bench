import {test} from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import {createLongThreadFixture,canonicalSerialize}from'../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture}from'../../tests/fixtures/aimock.ts';
import {projectCompiledHistory}from'./source-model.mjs';
const identity={threadId:'native-chat-source-A',runId:'native-chat-source-A',epochMs:0};
const sha=x=>createHash('sha256').update(canonicalSerialize(x)).digest('hex');
function fixture(){const source=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'});return{source,compiled:compileCanonicalHistoryRestoreFixture(source,identity)};}
test('actual AIMock three-event snapshot projects exact100 native history messages and source/events/history digests',()=>{const {source,compiled}=fixture(),r=projectCompiledHistory(source,compiled,identity);assert.deepEqual(r.history,source.history);assert.deepEqual(r.digests,compiled.digests);assert.equal(r.history.length,100);assert.deepEqual(compiled.events.map(e=>e.type),['RUN_STARTED','MESSAGES_SNAPSHOT','RUN_FINISHED']);assert.equal(r.status,'source-fixture-verified');assert.equal(r.authority,false);});
for(const [name,mutate]of [
 ['wrong source digest',(s,c)=>{c.digests.sourceSha256='0'.repeat(64);}],
 ['wrong events digest',(s,c)=>{c.digests.eventsSha256='0'.repeat(64);}],
 ['wrong history digest',(s,c)=>{c.digests.historySha256='0'.repeat(64);}],
 ['missing start',(s,c)=>{c.events.shift();}],
 ['duplicate snapshot',(s,c)=>{c.events.splice(2,0,structuredClone(c.events[1]));}],
 ['wrong event ordering',(s,c)=>{[c.events[0],c.events[2]]=[c.events[2],c.events[0]];}],
 ['changed content despite recomputed digests',(s,c)=>{c.events[1].messages[0].content='x'.repeat(512);c.digests.eventsSha256=sha(c.events);c.digests.historySha256=sha(c.events[1].messages);}],
 ['reordered snapshot despite recomputed digests',(s,c)=>{c.events[1].messages.reverse();c.digests.eventsSha256=sha(c.events);c.digests.historySha256=sha(c.events[1].messages);}],
 ['99 snapshot messages',(s,c)=>{c.events[1].messages.pop();}],
 ['101 snapshot messages',(s,c)=>{c.events[1].messages.push(structuredClone(c.events[1].messages[0]));}],
 ['wrong source profile',(s,c)=>{s.workload.seed=2;}],
 ['wrong start identity',(s,c)=>{c.events[0].threadId='foreign';}],
 ['wrong finish identity',(s,c)=>{c.events[2].runId='foreign';}],
 ['wrong restoration input',(s,c)=>{c.input.messages=[{id:'foreign',role:'user',content:'x'}];}],
 ['extra message field',(s,c)=>{c.events[1].messages[0].extra=true;}],
 ['extra event field',(s,c)=>{c.events[1].extra=true;}],
 ['wrong synthetic timestamp',(s,c)=>{c.events[1].timestamp=123;}]
])test('refuses '+name,()=>{const{source,compiled}=fixture();mutate(source,compiled);assert.throws(()=>projectCompiledHistory(source,compiled,identity),/native-chat-fixture/);});
test('identity primitives are checked before regular-expression coercion',()=>{const{source,compiled}=fixture();let calls=0;const id={...identity,threadId:{toString(){calls++;return 'coerced';}}};assert.throws(()=>projectCompiledHistory(source,compiled,id),/native-chat-fixture/);assert.equal(calls,0);});
test('compiled proxy is refused before descriptor reflection',()=>{const{source,compiled}=fixture();let calls=0;const value=new Proxy(compiled,{getOwnPropertyDescriptor(){calls++;throw Error('must not reflect');}});assert.throws(()=>projectCompiledHistory(source,value,identity),/native-chat-fixture/);assert.equal(calls,0);});
