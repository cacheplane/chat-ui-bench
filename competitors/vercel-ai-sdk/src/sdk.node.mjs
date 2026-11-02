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
  assert.match(bench.readProgress().error,/authored original reader failure/);assert.equal(bench.readProgress().responseCharacters,null);assert.equal(bench.readResponse(),null);
  await act(async()=>{await bench.dispose();});bench=undefined;
  const aborted=new DefaultChatTransport({api:'/stream/ui',fetch:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(events.slice(0,-1).map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')));setTimeout(()=>controller.error(new DOMException('authored late abort','AbortError')),0);}}),{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}})});
  let abortMount;await act(async()=>{abortMount=api.mountBench({...context,threadId:'thread-abort'},document.getElementById('root'),aborted);});bench=await abortMount;
  await act(async()=>{bench.start();await bench.waitForRun();});
  assert.equal(bench.read().operation.status,'fulfilled');assert.equal(bench.read().messages.at(-1).text.length,6400);assert.match(bench.read().error,/aborted/);
  assert.equal(bench.readProgress().operation.status,'fulfilled');assert.match(bench.readProgress().error,/aborted/);assert.equal(bench.readProgress().responseCharacters,6400);
 }finally{if(bench)await act(async()=>{await bench.dispose();});dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});

test('matrix projection reads actual scalar state without traversing history or joining response',async()=>{
 const projection=await import('./projection.ts').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
 assert.equal(typeof projection.readSdkProgress,'function');
 const {publicContext}=await import('../../../tools/competitor-comparison/matrix-fixtures-v3.mjs').then(m=>m.createMatrixCase({profile:'vercel-ai-sdk',historyCount:10000,responseBytes:262144,journey:'follow'}));
 const response={id:'opaque-sdk-native-id',role:'assistant',parts:[{type:'text',text:'abc'},{type:'text',text:'defg'}]};
 for(const method of ['map','filter','join','slice'])Object.defineProperty(response.parts,method,{get(){throw Error('poison response copy: '+method);},configurable:true});
 const messages=new Proxy(new Array(10001),{get(target,key){if(key==='length')return target.length;if(key==='at')return index=>{assert.equal(index,-1);return response;};throw Error('poison history access: '+String(key));}});
 const sdk={messages,status:'streaming',error:undefined},original={kind:'original-run-promise',status:'pending'};
 assert.deepEqual(projection.readSdkProgress(sdk,publicContext,original,null),{schema:1,messageCount:10001,responseId:'opaque-sdk-native-id',responseCharacters:7,running:true,error:null,operation:original});
 for(const method of ['map','filter','join','slice'])delete response.parts[method];
 assert.deepEqual(projection.readSdkResponse(sdk,publicContext),{id:'opaque-sdk-native-id',role:'assistant',text:'abcdefg'});
 response.parts=[];assert.equal(projection.readSdkProgress(sdk,publicContext,original,null).responseCharacters,0);
 response.role='user';assert.throws(()=>projection.readSdkProgress(sdk,publicContext,original,null),/non-prose/);
 response.role='assistant';response.parts=[{type:'reasoning',text:'hidden'}];assert.throws(()=>projection.readSdkResponse(sdk,publicContext),/non-prose/);assert.throws(()=>projection.readSdkProgress(sdk,publicContext,original,null),/non-prose/);
 response.parts=[{type:'text',text:'x'.repeat(262145)}];assert.throws(()=>projection.readSdkProgress(sdk,publicContext,original,null),/response-cap/);
 const initial={messages:{length:10000},status:'ready',error:Error('original source error')};assert.equal(projection.readSdkResponse(initial,publicContext),null);assert.equal(projection.readSdkProgress(initial,publicContext,original,'finish-error').error,'original source error');
 let accesses=0,actual=initial.messages;const live={get messages(){accesses++;return actual;},status:'ready'};
 assert.equal(projection.readSdkProgress(live,publicContext,original,null).messageCount,10000);actual=messages;response.parts=[];
 assert.equal(projection.readSdkProgress(live,publicContext,original,null).responseCharacters,0);assert.equal(accesses,2);
 assert.throws(()=>projection.readSdkProgress({...sdk,messages:{length:9999}},publicContext,original,null),/message-count/);
 assert.throws(()=>projection.readSdkProgress({...sdk,messages:{length:10002}},publicContext,original,null),/message-count/);
});

test('mounted installed SDK exposes matrix progress and full H1000/R262144 default transport state',async()=>{
 const {publicContext:context,fixture}=await import('../../../tools/competitor-comparison/matrix-fixtures-v3.mjs').then(m=>m.createMatrixCase({profile:'vercel-ai-sdk',historyCount:1000,responseBytes:262144,journey:'follow'}));
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),prior=new Map();
 for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 let bench,requests=0;
 try{
 const events=[{type:'start',messageId:'opaque-installed-sdk-response'},{type:'text-start',id:'part'},...fixture.events.slice(1,-1).map(e=>({type:'text-delta',id:'part',delta:e.text})),{type:'text-end',id:'part'},{type:'finish',finishReason:'stop'}];
 const transport=new DefaultChatTransport({api:'/stream/ui',body:{runId:context.runId},fetch:async(_url,init)=>{requests++;const body=JSON.parse(init.body);assert.equal(body.runId,context.runId);assert.deepEqual(body.messages.map(m=>({id:m.id,role:m.role,text:m.parts.map(p=>p.text).join('')})),context.history);return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}});}});
 let mounting;await act(async()=>{mounting=api.mountBench(context,document.getElementById('root'),transport);});bench=await mounting;
 assert.equal(typeof bench.readProgress,'function');assert.equal(typeof bench.readResponse,'function');assert.deepEqual(bench.read().messages,context.history);assert.equal(bench.readProgress().messageCount,1000);assert.equal(bench.readResponse(),null);
 await act(async()=>{bench.start();await bench.waitForRun();});
 const final=bench.read(),response=bench.readResponse(),progress=bench.readProgress();assert.equal(requests,1);assert.equal(final.error,null);assert.equal(final.operation.status,'fulfilled');assert.deepEqual(final.messages.slice(0,1000),context.history);assert.equal(progress.messageCount,1001);assert.equal(progress.responseId,'opaque-installed-sdk-response');assert.equal(progress.responseCharacters,262144);assert.equal(progress.running,false);assert.equal(progress.error,null);assert.deepEqual(response,final.messages.at(-1));assert.equal(response.text,fixture.events.slice(1,-1).map(e=>e.text).join(''));
 await act(async()=>{await bench.dispose();});assert.throws(()=>bench.readProgress(),/disposed/);assert.throws(()=>bench.readResponse(),/disposed/);bench=undefined;
 const nonproseEvents=[{type:'start',messageId:'opaque-reasoning-response'},{type:'reasoning-start',id:'reasoning'},{type:'reasoning-delta',id:'reasoning',delta:'not prose'},{type:'reasoning-end',id:'reasoning'},{type:'finish',finishReason:'stop'}];
 const nonproseTransport=new DefaultChatTransport({api:'/stream/ui',fetch:async()=>new Response(nonproseEvents.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1'}})});
 await act(async()=>{mounting=api.mountBench({...context,threadId:context.threadId+'-nonprose'},document.getElementById('root'),nonproseTransport);});bench=await mounting;
 await act(async()=>{bench.start();await bench.waitForRun();});assert.throws(()=>bench.read(),/non-prose/);assert.throws(()=>bench.readProgress(),/non-prose/);assert.throws(()=>bench.readResponse(),/non-prose/);
 }finally{if(bench)await act(async()=>{await bench.dispose();});dom.window.close();for(const[k,d]of prior)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});

test('context loader uses protocol-selected shared bulk parser',async()=>{
 const source=await import('node:fs/promises').then(fs=>fs.readFile(new URL('./main.ts',import.meta.url),'utf8'));
 assert.match(source,/parsePublicContextText\(text,response.headers.get\(PUBLIC_CONTEXT_PROTOCOL_HEADER\)\?\?'functional-v2'\)/);
 assert.match(source,/await response.text\(\)/);assert.doesNotMatch(source,/getReader\(/);
});
