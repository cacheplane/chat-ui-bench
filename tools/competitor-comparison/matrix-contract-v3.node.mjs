import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunctionalCase} from './fixtures.mjs';
import * as context from '../../competitors/shared/context.mjs';
const load=async name=>import(name).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const policy=await load('./matrix-policy-v3.mjs'),fixtures=await load('./matrix-fixtures-v3.mjs');
const selection=(historyCount=100,responseBytes=6400,profile='vercel-ai-sdk',journey='follow')=>({profile,historyCount,responseBytes,journey});

test('schema2 is explicit; schema1 retains its closed small workload and future-data refusal',()=>{
 const original=createFunctionalCase('vercel-ai-sdk','follow').publicContext;
 const matrix=structuredClone(original);matrix.schema=2;
 assert.equal(context.parsePublicContext(matrix).schema,2);
 assert.equal(context.parsePublicContext(original).schema,1);
 for(const mutate of [x=>x.schema=3,x=>x.events=[],x=>x.workload.seed=2,x=>x.workload.historyCount=101,x=>x.workload.responseBytes=6401,x=>delete x.history[4],x=>x.history[3].id=x.history[2].id]){
  const wrong=structuredClone(matrix);mutate(wrong);assert.throws(()=>context.parsePublicContext(wrong));
 }
 const wrong=structuredClone(original);wrong.workload.historyCount=1000;assert.throws(()=>context.parsePublicContext(wrong));
});
test('context text limits and schema dispatch are selected before parse, never inferred from data',()=>{
 assert.equal(typeof context.parsePublicContextText,'function');
 const original=createFunctionalCase('vercel-ai-sdk','follow').publicContext;
 assert.equal(context.parsePublicContextText(JSON.stringify(original)).schema,1);
 const matrix={...original,schema:2};
 assert.equal(context.parsePublicContextText(JSON.stringify(matrix),'matrix-v3').schema,2);
 assert.throws(()=>context.parsePublicContextText(JSON.stringify(matrix)));
 assert.throws(()=>context.parsePublicContextText(JSON.stringify(original),'matrix-v3'));
 assert.throws(()=>context.parsePublicContextText('{'.repeat(131073)),/context-cap/);
 assert.throws(()=>context.parsePublicContextText('漢'.repeat(2796203),'matrix-v3'),/context-cap/);
 assert.throws(()=>context.parsePublicContextText('{}','other'));
 assert.throws(()=>context.parsePublicContextText(JSON.stringify(original)+' '.repeat(200000),{toString:()=> 'matrix-v3'}),/context-protocol/);
});
test('matrix policy freezes all49 slots and independent caps without caller tuning',()=>{
 assert.equal(typeof policy.matrixVerificationRoster,'function');
 const slots=policy.matrixVerificationRoster();assert.equal(slots.length,49);assert.equal(new Set(slots.map(slot=>slot.id)).size,49);
 assert.deepEqual(slots[0].selection,selection(100,6400,'threadplane','follow'));
 assert.deepEqual(slots[47].selection,selection(10000,262144,'vercel-ai-sdk','history-reading'));
 assert.equal(slots[48].kind,'omitted-delta-100');assert.equal(slots[48].omitDelta,100);assert.deepEqual(slots[48].selection,selection(10000,262144));
 assert.ok(Object.isFrozen(slots)&&slots.every(Object.isFrozen));
 assert.equal(policy.MATRIX_V3_LIMITS.fixtureBytes,33554432);assert.equal(policy.MATRIX_V3_LIMITS.httpBodyBytes,8388608);
 assert.equal(policy.MATRIX_V3_LIMITS.caseBytes,83886080);assert.equal(policy.MATRIX_V3_LIMITS.invocationBytes,4294967296);
 assert.equal(policy.MATRIX_V3_LIMITS.caseMs,240000);assert.equal(policy.MATRIX_V3_LIMITS.invocationMs,1200000);
 for(const value of [{...selection(),historyCount:101},{...selection(),responseBytes:6401},{...selection(),forceCap:999},{...selection(),profile:'unknown'}])assert.throws(()=>policy.parseMatrixSelection(value));
});
test('shared native seek uses the exact clipped response geometry and never clamps overflow',()=>{
 assert.equal(typeof policy.nativeHistorySeek,'function');
 const clip={left:0,top:0,right:1280,bottom:720};
 assert.deepEqual(policy.nativeHistorySeek({clip,responseRect:{left:100,top:-4000,right:900,bottom:600}}),{policy:'visible-response-to-mid-viewport-v3',desiredUp:4360,deltaY:-4360});
 assert.equal(policy.nativeHistorySeek({clip,responseRect:{left:100,top:600,right:900,bottom:900}}).deltaY,-600);
 for(const value of [{clip,responseRect:{left:100,top:-2000000,right:900,bottom:600}},{clip:{...clip,bottom:0},responseRect:{left:100,top:0,right:900,bottom:600}},{clip,responseRect:{left:2000,top:0,right:3000,bottom:600}},{clip,responseRect:{left:100,top:NaN,right:900,bottom:600}}])assert.throws(()=>policy.nativeHistorySeek(value));
});
test('six actual Aimock matrix cells preserve200deltas/10seconds and equal logical bytes across profiles',()=>{
 assert.equal(typeof fixtures.createMatrixCase,'function');
 for(const historyCount of [100,1000,10000])for(const responseBytes of [6400,262144]){
  let first;
  for(const profile of ['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']){
   const value=fixtures.createMatrixCase(selection(historyCount,responseBytes,profile));
   assert.equal(value.origin,'actual-aimock-compiler');assert.equal(value.publicContext.schema,2);
   assert.equal(value.publicContext.history.length,historyCount);assert.equal(value.fixture.events.length,202);assert.equal(value.historyRestore.length,3);assert.equal(value.continuation.length,204);
   const deltas=value.continuation.filter(event=>event.type==='TEXT_MESSAGE_CONTENT');assert.equal(deltas.length,200);assert.equal(deltas.map(event=>event.delta).join('').length,responseBytes);
   assert.equal(deltas.at(-1).metadata.scheduledMs,10000);assert.ok(deltas.every(event=>event.delta.length<=2048));
   assert.equal(deltas.slice(0,16).reduce((sum,event)=>sum+event.delta.length,0),policy.historyPrefixCharacters(responseBytes));
   assert.equal(value.publicContext.fixture,undefined);assert.equal(value.publicContext.events,undefined);assert.equal(value.publicContext.response,undefined);
   assert.ok(Buffer.byteLength(JSON.stringify(value.publicContext))<=8388608);assert.ok(Buffer.byteLength(JSON.stringify(value,null,2))<=33554432);
   if(first){assert.deepEqual(value.fixture,first.fixture);assert.deepEqual(value.continuation,first.continuation);assert.deepEqual(value.publicContext.digests,first.publicContext.digests);}else first=value;
  }
 }
});
