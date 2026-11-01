import test from 'node:test';import assert from 'node:assert/strict';
const api=()=>import('../src/messages.ts');
test('projection keeps actual SDK text/IDs and records one stable native response identity',async()=>{
 const {createMessageProjection}=await api(),projection=createMessageProjection(['h']);
 const source=[{id:'h',role:'assistant',content:'actual history'},{id:'native-response',role:'assistant',content:'partial'}];
 assert.deepEqual(projection.read(source),[{id:'h',role:'assistant',text:'actual history'},{id:'native-response',role:'assistant',text:'partial'}]);assert.equal(projection.responseId(),'native-response');assert.equal(source[1].id,'native-response');
 assert.throws(()=>projection.read([{...source[0]},{...source[1],id:'replacement'}]),/identity/);
});
test('projection rejects extra, duplicate, non-prose and unbounded public state',async()=>{
 const {createMessageProjection}=await api();
 for(const rows of [[{id:'a',role:'assistant',content:'a'},{id:'a',role:'assistant',content:'b'}],[{id:'new-user',role:'user',content:'unexpected'}],[{id:'a',role:'assistant',content:[]}],[{id:'a',role:'assistant',content:'x'.repeat(6401)}],Array(102).fill({id:'a',role:'assistant',content:'a'})])assert.throws(()=>createMessageProjection(['h']).read(rows));
});
test('matrix projection validates expanded full history and cheap actual tail without traversal',async()=>{
 const {createMessageProjection}=await api();
 for(const count of [100,1000,10000]){
  const history=Array.from({length:count},(_,i)=>({id:'h'+i,role:i%2?'user':'assistant',content:'h'.repeat(512)}));
  const projection=createMessageProjection(history.map(x=>x.id),262144),response={id:'native',role:'assistant',content:'x'.repeat(262144)};
  assert.equal(projection.read([...history,response]).length,count+1);
  const poisoned=[...history,response];Object.defineProperty(poisoned,0,{get(){throw Error('history traversed');}});poisoned.map=()=>{throw Error('map traversed');};poisoned.find=()=>{throw Error('find traversed');};
  assert.deepEqual(projection.readProgress(poisoned),{messageCount:count+1,responseId:'native',responseCharacters:262144});
  assert.deepEqual(projection.readResponse(poisoned),{id:'native',role:'assistant',text:response.content});
  assert.throws(()=>projection.read([...history].reverse()),/history/);
  for(const tail of [{...response,id:'changed'},{...response,role:'user'},{...response,content:[]},{...response,content:'x'.repeat(262145)},{...response,id:'h0'}])assert.throws(()=>projection.readProgress([...history,tail]));
 }
});
test('progress has null actual response on history and retains strict default cap',async()=>{
 const {createMessageProjection}=await api(),projection=createMessageProjection(['h']);
 assert.deepEqual(projection.readProgress([{id:'h',role:'assistant',content:'history'}]),{messageCount:1,responseId:null,responseCharacters:null});
 assert.equal(projection.readResponse([{id:'h',role:'assistant',content:'history'}]),null);
 assert.throws(()=>projection.readProgress([{id:'h',role:'assistant',content:'history'},{id:'new',role:'assistant',content:'x'.repeat(6401)}]));
});
test('scalar and sparse reads reject tool-bearing current messages',async()=>{
 const {createMessageProjection}=await api(),projection=createMessageProjection(['h']);
 const rows=[{id:'h',role:'assistant',content:'history'},{id:'response',role:'assistant',content:'text',toolCalls:[{id:'tool',type:'function',function:{name:'x',arguments:'{}'}}]}];
 assert.throws(()=>projection.readProgress(rows),/prose/);assert.throws(()=>projection.readResponse(rows),/prose/);assert.throws(()=>projection.read(rows),/prose/);
});
test('full actual projection rejects sparse SDK histories',async()=>{
 const {createMessageProjection}=await api(),projection=createMessageProjection(['h0','h1']);
 const rows=Array(2);rows[1]={id:'h1',role:'user',content:'history'};
 assert.throws(()=>projection.read(rows),/data|sparse/);
});

for (const schema of [1,2]) {
 test(`actual canonical schema${schema} idle progress reads actual public tail`,async()=>{
  const {createMessageProjection}=await api();
  const {createFunctionalCase}=await import('../../../tools/competitor-comparison/fixtures.mjs');
  const {createMatrixCase}=await import('../../../tools/competitor-comparison/matrix-fixtures-v3.mjs');
  const context=(schema===1?createFunctionalCase('copilotkit','follow'):createMatrixCase({profile:'copilotkit',historyCount:10000,responseBytes:262144,journey:'follow'})).publicContext;
  const rows=context.history.map(({id,role,text})=>({id,role,content:text})),projection=createMessageProjection(context.history.map(message=>message.id),context.workload.responseBytes);
  assert.deepEqual(projection.readProgress(rows),{messageCount:context.history.length,responseId:null,responseCharacters:null});assert.equal(projection.readResponse(rows),null);
 });
 test(`actual canonical schema${schema} history projects completely and reports idle progress`,async()=>{
  const {createMessageProjection}=await api();
  const {createFunctionalCase}=await import('../../../tools/competitor-comparison/fixtures.mjs');
  const {createMatrixCase}=await import('../../../tools/competitor-comparison/matrix-fixtures-v3.mjs');
  const context=(schema===1?createFunctionalCase('copilotkit','follow'):createMatrixCase({profile:'copilotkit',historyCount:10000,responseBytes:262144,journey:'follow'})).publicContext;
  const rows=context.history.map(({id,role,text})=>({id,role,content:text})),projection=createMessageProjection(context.history.map(message=>message.id),context.workload.responseBytes);
  assert.equal(rows[0].role,'assistant');assert.equal(rows[1].role,'user');
  assert.deepEqual(projection.read(rows),context.history);
  assert.deepEqual(projection.readProgress(rows),{messageCount:context.history.length,responseId:null,responseCharacters:null});assert.equal(projection.readResponse(rows),null);
  const wrongRole=rows.map(message=>({...message}));wrongRole[0].role='user';assert.throws(()=>projection.read(wrongRole),/history/);
  const wrongTail=rows.map(message=>({...message}));wrongTail.at(-1).role='assistant';assert.throws(()=>projection.readProgress(wrongTail),/history/);
  const wrongOrder=[...rows];[wrongOrder[0],wrongOrder[1]]=[wrongOrder[1],wrongOrder[0]];assert.throws(()=>projection.read(wrongOrder),/history/);
 });
}
