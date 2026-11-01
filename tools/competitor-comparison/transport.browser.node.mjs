import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {createFunctionalCase} from './fixtures.mjs';
import {startFunctionalServer} from './server.mjs';
import {installOwnedNetworkGuard} from './network.mjs';
async function waitForObservedFinish(guard,url){const deadline=performance.now()+2000;for(;;){const observation=guard.read();if(observation.finished.some(x=>x.url===url))return observation;if(performance.now()>=deadline)throw Error('guard-finished-observation-deadline');await new Promise(resolve=>setTimeout(resolve,10));}}

test('guard refuses unsupported CDP before any navigation without fallback',async()=>{
 const page={url:()=> 'about:blank'},context={newCDPSession:async()=>{throw Error('authored unsupported CDP');}};
 await assert.rejects(installOwnedNetworkGuard({context,page,origin:'http://127.0.0.1:30001',onExternal:()=>{}}),/unsupported CDP/);
});
for(const omitDelta of [undefined,117])test(`owned incremental browser transport closes normally; omitted delta ${omitDelta??'none'}`,{timeout:20000},async()=>{
 const assets=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'competitor-transport-assets-')));await fs.writeFile(assets+'/index.html','<!doctype html><title>authored transport control</title>');
 let browser,server;try{
  server=await startFunctionalServer({profile:'vercel-ai-sdk',assetsDirectory:assets,privateCase:createFunctionalCase('vercel-ai-sdk','follow'),omitDelta});browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),external=[];
  const guard=await installOwnedNetworkGuard({context,page,origin:server.origin,onExternal:url=>external.push(url)});const events=[];
  page.on('requestfinished',request=>{if(request.url()===server.origin+'/stream/ui')events.push('finished');});page.on('requestfailed',request=>{if(request.url()===server.origin+'/stream/ui')events.push(request.failure()?.errorText??'failed');});
  await page.goto(server.origin+'/');assert.equal(await page.evaluate(async()=>{try{await fetch('https://example.invalid/authored-probe');return false;}catch{return true;}}),true);
  const clientDone=page.waitForEvent('requestfinished',{predicate:request=>request.url()===server.origin+'/stream/ui',timeout:13000});void clientDone.catch(()=>{});
  const result=await page.evaluate(async()=>{const c=await(await fetch('/context')).json(),response=await fetch('/stream/ui',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:c.threadId,runId:c.runId,trigger:'regenerate-message',messages:c.history.map(({id,role,text})=>({id,role,parts:[{type:'text',text}]}))})});const reader=response.body.getReader(),decoder=new TextDecoder();let text='';try{for(;;){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}return{cacheControl:response.headers.get('cache-control'),done:text.endsWith('data: [DONE]\n\n'),deltas:text.split('"type":"text-delta"').length-1};});
  assert.deepEqual(result,{cacheControl:'private,no-cache,max-age=0,must-revalidate',done:true,deltas:omitDelta===undefined?200:199});await clientDone;assert.deepEqual(events,['finished']);assert.deepEqual(external,['https://example.invalid/authored-probe']);
  const observation=await waitForObservedFinish(guard,server.origin+'/stream/ui');assert.equal(observation.overflow,false);assert.equal(observation.closed,false);assert.equal(observation.policy.version,'chromium-cdp-owned-origin-block-v1');assert.ok(observation.blocked.some(x=>x.blockedReason==='inspector'));assert.ok(observation.finished.some(x=>x.url===server.origin+'/stream/ui'));
  const report=server.getReport();assert.equal(report.sourceEmissions.length,omitDelta===undefined?204:203);assert.equal(report.playbacks.continuation.completed,true);const request=report.requests.find(x=>x.path==='/stream/ui');for(const key of['sourceEof','responseFinished','responseClosed'])assert.equal(request[key],true);assert.equal(request.clientAborted,false);
  await browser.close();browser=null;assert.equal(guard.read().closed,true);await server.close();assert.equal(server.getReport().closed,true);
 }finally{if(browser)await browser.close();if(server)await server.close();await fs.rm(assets,{recursive:true,force:true});}
});

test('inline data resource is retained locally while unknown schemes remain external',async()=>{
 const {EventEmitter}=await import('node:events'),session=new EventEmitter();session.send=async method=>method==='Browser.getVersion'?{product:'HeadlessChrome/156.0.8078.4',protocolVersion:'1.3',revision:'authored'}:{};
 const page={url:()=> 'about:blank',isClosed:()=>false,once:()=>{}};const external=[],guard=await installOwnedNetworkGuard({context:{newCDPSession:async()=>session},page,origin:'http://127.0.0.1:30001',onExternal:url=>external.push(url)});
 session.emit('Network.requestWillBeSent',{requestId:'font',timestamp:1,request:{url:'data:font/woff2;base64,'+'A'.repeat(9000)}});
 session.emit('Network.requestWillBeSent',{requestId:'unknown',timestamp:2,request:{url:'file:///authored-unowned'}});
 const report=guard.read();assert.equal(report.overflow,false);assert.equal(report.requested[0].localResource,true);assert.ok(report.requested[0].url.length<=256);assert.equal(report.requested[0].urlLength,9023);assert.deepEqual(external,['file:///authored-unowned']);
});
