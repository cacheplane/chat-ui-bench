import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {DefaultChatTransport} from 'ai';
import {act} from 'react';
const api=await import('./app.ts').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('real AI SDK continuation retains all100 users/assistants and adds no extra user',async()=>{
 assert.equal(typeof api.mountBench,'function');
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});const prior=new Map();
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 let bench;
 try{
  const history=Array.from({length:100},(_,i)=>({id:'history-'+i,role:i%2?'user':'assistant',text:('History '+i+' ').padEnd(512,'x')}));
  const context={schema:1,profile:'vercel-ai-sdk',threadId:'thread',runId:'run',canonicalResponseId:'response-100',history,workload:{seed:1,historyCount:100,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey:'follow'},digests:{sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),responseSha256:'c'.repeat(64)}};
  const events=[{type:'start',messageId:'response-100'},{type:'text-start',id:'text-0'},...Array.from({length:200},()=>({type:'text-delta',id:'text-0',delta:'x'.repeat(32)})),{type:'text-end',id:'text-0'},{type:'finish',finishReason:'stop'}];
  let requests=0;const transport=new DefaultChatTransport({api:'/stream/ui',fetch:async(_url,init)=>{requests++;const body=JSON.parse(init.body);assert.equal(body.messages.length,100);assert.equal(body.messages.at(-1).role,'user');return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}});}});
  assert.throws(()=>api.mountBench({...context,profile:'threadplane'},document.getElementById('root'),transport),/vercel-profile/);
  let mounting;await act(async()=>{mounting=api.mountBench(context,document.getElementById('root'),transport);});bench=await mounting;
  assert.deepEqual(bench.read().messages,history);await act(async()=>{bench.start();assert.throws(()=>bench.start());await bench.waitForRun();});
  const deadline=Date.now()+5000;while(bench.read().running||bench.read().messages.length!==101){if(Date.now()>deadline)throw Error('SDK commit deadline');await new Promise(r=>setTimeout(r,5));}
  const result=bench.read();assert.equal(requests,1);assert.deepEqual(result.messages.slice(0,100),history);assert.equal(result.messages.at(-1).text,'x'.repeat(6400));assert.equal(result.responseId,'response-100');assert.equal(result.operation.kind,'original-run-promise');assert.equal(result.operation.status,'fulfilled');assert.equal(result.error,null);
  await act(async()=>{await bench.dispose();});bench=undefined;
  const broken=new DefaultChatTransport({api:'/stream/ui',fetch:async()=>new Response(new ReadableStream({start(controller){controller.error(Error('authored original reader failure'));}}),{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}})});
  let errorMount;await act(async()=>{errorMount=api.mountBench({...context,threadId:'thread-error'},document.getElementById('root'),broken);});bench=await errorMount;
  // AI SDK settles the ORIGINAL promise on this error; public error is separate.
  await act(async()=>{bench.start();await bench.waitForRun();});
  assert.equal(bench.read().operation.status,'fulfilled');assert.match(bench.read().error,/authored original reader failure/);assert.equal(bench.read().running,false);assert.equal(bench.read().messages.length,100);
  await act(async()=>{await bench.dispose();});bench=undefined;
  const aborted=new DefaultChatTransport({api:'/stream/ui',fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(events.slice(0,-1).map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')));setTimeout(()=>controller.error(new DOMException('authored late abort','AbortError')),0);}}),{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}})});
  let abortMount;await act(async()=>{abortMount=api.mountBench({...context,threadId:'thread-abort'},document.getElementById('root'),aborted);});bench=await abortMount;
  await act(async()=>{bench.start();await bench.waitForRun();});
  assert.equal(bench.read().operation.status,'fulfilled');assert.equal(bench.read().messages.at(-1).text.length,6400);assert.match(bench.read().error,/aborted/);
 }finally{if(bench)await act(async()=>{await bench.dispose();});dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
