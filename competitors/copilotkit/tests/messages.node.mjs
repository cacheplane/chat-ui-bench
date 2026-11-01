import test from 'node:test';import assert from 'node:assert/strict';
const api=()=>import('../src/messages.ts');
test('projection keeps actual SDK text/IDs and records one stable native response identity',async()=>{
 const {createMessageProjection}=await api(),projection=createMessageProjection(['h']);
 const source=[{id:'h',role:'user',content:'actual history'},{id:'native-response',role:'assistant',content:'partial'}];
 assert.deepEqual(projection.read(source),[{id:'h',role:'user',text:'actual history'},{id:'native-response',role:'assistant',text:'partial'}]);assert.equal(projection.responseId(),'native-response');assert.equal(source[1].id,'native-response');
 assert.throws(()=>projection.read([{...source[0]},{...source[1],id:'replacement'}]),/identity/);
});
test('projection rejects extra, duplicate, non-prose and unbounded public state',async()=>{
 const {createMessageProjection}=await api();
 for(const rows of [[{id:'a',role:'assistant',content:'a'},{id:'a',role:'assistant',content:'b'}],[{id:'new-user',role:'user',content:'unexpected'}],[{id:'a',role:'assistant',content:[]}],[{id:'a',role:'assistant',content:'x'.repeat(6401)}],Array(102).fill({id:'a',role:'assistant',content:'a'})])assert.throws(()=>createMessageProjection(['h']).read(rows));
});
