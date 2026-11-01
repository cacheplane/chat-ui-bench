import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunctionalCase} from './fixtures.mjs';
const api=await import('./wire.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const collect=async source=>{const values=[];for await(const v of source)values.push(v);return values;};
test('UI SSE preserves every actual Aimock delta and exact lifecycle identities',async()=>{
 assert.equal(typeof api.uiSse,'function');const value=createFunctionalCase('vercel-ai-sdk','follow');
 const chunks=await collect(api.uiSse(value.continuation));const events=chunks.slice(0,-1).map(x=>JSON.parse(x.slice(6).trim()));
 assert.deepEqual(events[0],{type:'start',messageId:'response-100'});assert.deepEqual(events[1],{type:'text-start',id:'text-0'});
 assert.equal(events.filter(x=>x.type==='text-delta').length,200);assert.equal(events.filter(x=>x.type==='text-delta').map(x=>x.delta).join('').length,6400);
 assert.deepEqual(events.at(-2),{type:'text-end',id:'text-0'});assert.deepEqual(events.at(-1),{type:'finish',finishReason:'stop'});assert.equal(chunks.at(-1),'data: [DONE]\n\n');
});
test('UI stream refuses truncated or conflicting native lifecycle',async()=>{
 const value=createFunctionalCase('assistant-ui','follow');
 for(const events of [value.continuation.slice(0,-1),value.continuation.slice(1),value.continuation.map((e,i)=>i===3?{...e,messageId:'other'}:e)])await assert.rejects(collect(api.uiSse(events)));
});
test('scheduler uses absolute original synthetic offsets and exposes late emissions',async()=>{
 assert.equal(typeof api.scheduledPlayback,'function');const value=createFunctionalCase('copilotkit','follow');let now=100;const waits=[],receipts=[];
 const events=await collect(api.scheduledPlayback(value,'continuation',{signal:new AbortController().signal,now:()=>now,wait:async ms=>{waits.push(ms);now+=ms;},observe:r=>receipts.push(r)}));
 assert.equal(events.length,204);assert.equal(waits.reduce((a,b)=>a+b,0),10000);assert.equal(receipts.length,204);assert.equal(receipts.at(-1).scheduledMs,10000);assert.equal(receipts.at(-1).latenessMs,0);
});
test('omitted-delta fault changes actual delivery only; expected fixture remains intact',async()=>{
 const value=createFunctionalCase('copilotkit','follow');let now=0;const events=await collect(api.scheduledPlayback(value,'continuation',{signal:new AbortController().signal,now:()=>now,wait:async ms=>{now+=ms;},omitDelta:9}));
 assert.equal(events.filter(x=>x.type==='TEXT_MESSAGE_CONTENT').length,199);assert.equal(value.continuation.filter(x=>x.type==='TEXT_MESSAGE_CONTENT').length,200);
 assert.equal(value.fixture.events.filter(x=>x.type==='text-delta').map(x=>x.text).join('').length,6400);
});
test('cancellation stops the original scheduler rather than fabricating stream completion',async()=>{
 const value=createFunctionalCase('copilotkit','follow'),controller=new AbortController();let seen=0;
 await assert.rejects(async()=>{for await(const _ of api.scheduledPlayback(value,'continuation',{signal:controller.signal,now:()=>0,wait:async()=>{controller.abort();throw controller.signal.reason;}})){seen++;}});
 assert.equal(seen,2);
});
