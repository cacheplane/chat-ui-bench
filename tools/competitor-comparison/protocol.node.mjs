import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./fixtures.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('four-stack functional fixtures are compiled through Aimock and expose no future response oracle',()=>{
 assert.equal(typeof api.createFunctionalCase,'function');
 const value=api.createFunctionalCase('vercel-ai-sdk','follow');
 assert.equal(value.fixture.history.length,100);assert.equal(value.fixture.events.length,202);
 assert.equal(value.historyRestore.length,3);assert.equal(value.continuation.length,204);
 assert.equal(value.historyRestore[1].type,'MESSAGES_SNAPSHOT');
 assert.equal(value.publicContext.history.length,100);assert.equal(value.publicContext.workload.deltaCount,200);
 assert.equal(value.publicContext.history.at(-1).role,'user');
 assert.equal(value.publicContext.fixture,undefined);assert.equal(value.publicContext.response,undefined);
 assert.equal(value.publicContext.events,undefined);assert.equal(value.publicContext.continuation,undefined);
 assert.equal(value.origin,'actual-aimock-compiler');
});
test('all profiles receive identical canonical history and continuation bytes',()=>{
 const values=['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].map(id=>api.createFunctionalCase(id,'history-reading'));
 for(const value of values){assert.deepEqual(value.fixture,values[0].fixture);assert.deepEqual(value.continuation,values[0].continuation);assert.deepEqual(value.publicContext.digests,values[0].publicContext.digests);}
 for(const id of ['unknown','../threadplane'])assert.throws(()=>api.createFunctionalCase(id,'follow'));
 assert.throws(()=>api.createFunctionalCase('threadplane','other'));
});
test('final validation conserves ordered history and records the actual generated response ID',()=>{
 const value=api.createFunctionalCase('assistant-ui','follow');
 const text=value.fixture.events.filter(x=>x.type==='text-delta').map(x=>x.text).join('');
 const snapshot={messages:[...value.publicContext.history,{id:'sdk-generated-001',role:'assistant',text}],running:false,error:null,responseId:'sdk-generated-001',operation:{kind:'public-runtime-state-transition',status:'fulfilled'}};
 assert.deepEqual(api.validateFinalSnapshot(value,snapshot),{canonicalId:'response-100',nativeId:'sdk-generated-001'});
 for(const mutate of [x=>x.messages.pop(),x=>x.messages[0].text+='x',x=>x.messages.reverse(),x=>x.messages.at(-1).text=x.messages.at(-1).text.slice(32),x=>x.responseId='other',x=>x.messages.at(-1).id=x.responseId='history-0',x=>x.running=true,x=>x.operation.status='pending',x=>x.error='SDK failed']){const wrong=structuredClone(snapshot);mutate(wrong);assert.throws(()=>api.validateFinalSnapshot(value,wrong));}
 const wrongKind=structuredClone(snapshot);wrongKind.operation.kind='original-run-promise';assert.throws(()=>api.validateFinalSnapshot(value,wrongKind));
});
test('public context has a closed bounded schema and cannot contain future events',async()=>{
 const {parsePublicContext}=await import('../../competitors/shared/context.mjs');const value=api.createFunctionalCase('copilotkit','follow');
 assert.equal(parsePublicContext(value.publicContext).history.length,100);
 for(const mutate of [x=>x.events=[],x=>x.workload.historyCount=1000,x=>x.history[0].role='system',x=>x.history[1].id=x.history[0].id,x=>x.history[0].text='x'.repeat(513),x=>x.runId='',x=>x.history.pop()]){const wrong=structuredClone(value.publicContext);mutate(wrong);assert.throws(()=>parsePublicContext(wrong));}
 const sparse=structuredClone(value.publicContext);delete sparse.history[4];assert.throws(()=>parsePublicContext(sparse));
});
