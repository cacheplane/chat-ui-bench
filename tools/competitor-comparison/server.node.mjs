import os from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {createFunctionalCase} from './fixtures.mjs';
const api=()=>import('./server.mjs');
async function fixture(profile='assistant-ui'){const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'competitor-server-')));await fs.writeFile(path.join(dir,'index.html'),'<h1>authored assets</h1>');return{dir,privateCase:createFunctionalCase(profile,'follow')};}
test('public context contains no future oracle and static traversal/symlink requests refuse',async()=>{
 const {startFunctionalServer}=await api(),f=await fixture(),server=await startFunctionalServer({profile:'assistant-ui',assetsDirectory:f.dir,privateCase:f.privateCase});
 try{const c=await(await fetch(server.origin+'/context')).json();assert.deepEqual(c,f.privateCase.publicContext);assert.equal('continuation'in c,false);assert.equal('fixture'in c,false);assert.equal((await fetch(server.origin+'/')).status,200);
 assert.equal((await fetch(server.origin+'/%2e%2e%2foutside')).status,400);await fs.symlink('/etc/hosts',f.dir+'/link');assert.equal((await fetch(server.origin+'/link')).status,403);
 }finally{await server.close();await fs.rm(f.dir,{recursive:true,force:true});}assert.equal(server.getReport().closed,true);
});
test('wrong identity and oversized body refuse before source playback',async()=>{
 const {startFunctionalServer}=await api(),f=await fixture(),server=await startFunctionalServer({profile:'assistant-ui',assetsDirectory:f.dir,privateCase:f.privateCase});
 try{for(const body of [{id:'wrong',runId:f.privateCase.publicContext.runId,trigger:'regenerate-message'},'x'.repeat(1048577)]){const r=await fetch(server.origin+'/stream/ui',{method:'POST',headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});assert.equal(r.status,typeof body==='string'?413:400);await r.text();}assert.equal(server.getReport().sourceEmissions.length,0);
 }finally{await server.close();await fs.rm(f.dir,{recursive:true,force:true});}
});
test('client cancellation aborts the original source and does not report normal EOF',async()=>{
 const {startFunctionalServer}=await api(),f=await fixture(),server=await startFunctionalServer({profile:'assistant-ui',assetsDirectory:f.dir,privateCase:f.privateCase});
 try{const c=f.privateCase.publicContext,r=await fetch(server.origin+'/stream/ui',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:c.threadId,runId:c.runId,trigger:'regenerate-message'})});const reader=r.body.getReader();await reader.read();await reader.cancel();await server.close();const report=server.getReport();assert.equal(report.playbacks.continuation.completed,false);assert.equal(report.playbacks.continuation.aborted,true);assert.equal(report.requests.find(x=>x.path==='/stream/ui').responseFinished,false);
 }finally{await server.close();await fs.rm(f.dir,{recursive:true,force:true});}
});
test('normal UI stream retains actual source count and normal HTTP EOF separately', {timeout:15000},async()=>{
 const {startFunctionalServer}=await api(),f=await fixture(),server=await startFunctionalServer({profile:'assistant-ui',assetsDirectory:f.dir,privateCase:f.privateCase});
 try{const c=f.privateCase.publicContext,body=JSON.stringify({id:c.threadId,runId:c.runId,trigger:'regenerate-message'});const r=await fetch(server.origin+'/stream/ui',{method:'POST',headers:{'content-type':'application/json'},body});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private,no-cache,max-age=0,must-revalidate');assert.ok((await r.text()).endsWith('data: [DONE]\n\n'));await new Promise(resolve=>setImmediate(resolve));const report=server.getReport();assert.equal(report.sourceEmissions.length,204);assert.equal(report.playbacks.continuation.completed,true);const http=report.requests.find(x=>x.path==='/stream/ui');assert.equal(http.sourceEof,true);assert.equal(http.responseFinished,true);assert.equal(http.clientAborted,false);assert.equal((await fetch(server.origin+'/stream/ui',{method:'POST',headers:{'content-type':'application/json'},body})).status,409);
 }finally{await server.close();await fs.rm(f.dir,{recursive:true,force:true});}
});

test('owned CLI verifies fixture hash then reports ready, close and natural exit', {timeout:10000},async()=>{
 const {fork}=await import('node:child_process'),{createHash}=await import('node:crypto');const f=await fixture();const fixturePath=path.join(f.dir,'case.json'),bytes=JSON.stringify(f.privateCase);await fs.writeFile(fixturePath,bytes);const sha=createHash('sha256').update(bytes).digest('hex');
 async function child(hash){const process=fork(new URL('./serve.mjs',import.meta.url),['--profile','assistant-ui','--assets',f.dir,'--fixture',fixturePath,'--sha256',hash],{stdio:['ignore','ignore','pipe','ipc']});let stderr='';process.stderr.on('data',x=>{stderr+=x;});const exit=new Promise(resolve=>process.once('exit',(code,signal)=>resolve({code,signal,stderr})));return{process,exit};}
 try{const good=await child(sha);const ready=await new Promise((resolve,reject)=>{good.process.once('message',resolve);void good.exit.then(x=>reject(Error(JSON.stringify(x))));});assert.equal(ready.type,'ready');assert.equal((await fetch(ready.origin+'/context')).status,200);good.process.send({type:'close'});const closed=await new Promise(resolve=>good.process.once('message',resolve));assert.equal(closed.type,'closed');assert.equal(closed.report.closed,true);assert.equal((await good.exit).code,0);
 const bad=await child('0'.repeat(64));assert.equal((await bad.exit).code,1);
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('canonical text end without native RUN_FINISHED never publishes completion', {timeout:15000},async()=>{
 const {startFunctionalServer}=await api(),f=await fixture('threadplane');f.privateCase.continuation.at(-1).type='RUN_STARTED';const server=await startFunctionalServer({profile:'threadplane',assetsDirectory:f.dir,privateCase:f.privateCase});
 try{const response=await fetch(server.origin+'/stream/canonical');let text='',failed=false;const reader=response.body.getReader();try{for(;;){const item=await reader.read();if(item.done)break;text+=new TextDecoder().decode(item.value);}}catch{failed=true;}finally{reader.releaseLock();}assert.equal(text.includes('assistant-complete'),false);assert.equal(failed,true);const row=server.getReport().requests.find(x=>x.path==='/stream/canonical');assert.equal(row.sourceEof,false);assert.equal(row.responseFinished,false);
 }finally{await server.close();await fs.rm(f.dir,{recursive:true,force:true});}
});

test('owned Web reader abort retains and awaits its first original cancel promise',async()=>{
 const {pipeOwnedWebResponse}=await api();assert.equal(typeof pipeOwnedWebResponse,'function');let release,cancelCalls=0,settled=false;
 const held=new Promise(resolve=>{release=resolve;});const source=new ReadableStream({pull(){},cancel(){cancelCalls++;return held;}});const controller=new AbortController();const response={writeHead(){},write(){return true;},end(){throw Error('aborted response ended');}};const row={status:null,responseBytes:0,sourceEof:false};
 const original=pipeOwnedWebResponse(response,new Response(source),controller.signal,row);void original.then(()=>{settled=true;},()=>{settled=true;});await new Promise(resolve=>setImmediate(resolve));controller.abort();await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelCalls,1);assert.equal(settled,false);assert.equal(row.sourceEof,false);release();await assert.rejects(original);assert.equal(cancelCalls,1);
});
