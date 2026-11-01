import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createMatrixCase} from './matrix-fixtures-v3.mjs';import {createFunctionalCase} from './fixtures.mjs';import {startFunctionalServer} from './server.mjs';import {launchCaseServer} from './process.mjs';
const matrix=(profile='vercel-ai-sdk')=>createMatrixCase({profile,historyCount:10000,responseBytes:262144,journey:'follow'});
async function assets(){const dir=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'matrix-server-')));await fs.writeFile(dir+'/index.html','assets');return dir;}
test('explicit matrix protocol serves actual H10000 context and validates entire >1MiB HTTP history', {timeout:20000},async()=>{
 const dir=await assets(),privateCase=matrix(),server=await startFunctionalServer({profile:'vercel-ai-sdk',assetsDirectory:dir,privateCase,protocol:'matrix-v3'});
 try{const response=await fetch(server.origin+'/context');assert.equal(response.headers.get('x-chat-ui-bench-protocol'),'matrix-v3');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),privateCase.publicContext);
 const c=privateCase.publicContext,body={id:c.threadId,runId:c.runId,trigger:'regenerate-message',messages:c.history.map(({id,role,text})=>({id,role,parts:[{type:'text',text}]}))};assert.ok(Buffer.byteLength(JSON.stringify(body))>1048576);
 body.messages.at(-1).parts[0].text='wrong';let r=await fetch(server.origin+'/stream/ui',{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,400);await r.text();assert.equal(server.getReport().sourceEmissions.length,0);body.messages.at(-1).parts[0].text=c.history.at(-1).text;
 r=await fetch(server.origin+'/stream/ui',{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,200);assert.ok((await r.text()).endsWith('data: [DONE]\n\n'));await server.close();const report=server.getReport();assert.equal(report.schema,2);assert.equal(report.protocol,'matrix-v3');assert.equal(report.sourceEmissions.length,204);assert.equal(report.closed,true);assert.equal(report.playbacks.continuation.completed,true);
 }finally{await server.close();await fs.rm(dir,{recursive:true,force:true});}
});
test('server protocol/schema refusals preserve v2 and matrix body cap before playback',async()=>{
 const dir=await assets();try{
 for(const options of [{privateCase:matrix()},{privateCase:matrix(),protocol:'other'},{privateCase:createFunctionalCase('vercel-ai-sdk','follow'),protocol:'matrix-v3'}]){
  let unexpected;try{await assert.rejects(async()=>{unexpected=await startFunctionalServer({profile:'vercel-ai-sdk',assetsDirectory:dir,...options});},/protocol|schema/);}finally{await unexpected?.close();}
 }
 const server=await startFunctionalServer({profile:'vercel-ai-sdk',assetsDirectory:dir,privateCase:matrix(),protocol:'matrix-v3'});try{const r=await fetch(server.origin+'/stream/ui',{method:'POST',body:'x'.repeat(8388609)});assert.equal(r.status,413);await r.text();assert.equal(server.getReport().sourceEmissions.length,0);}finally{await server.close();}
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('owned matrix child selects large fixture before open and retains original closure',{timeout:15000},async()=>{
 const dir=await assets(),bytes=Buffer.from(JSON.stringify(matrix()));await fs.writeFile(dir+'/case.json',bytes);assert.ok(bytes.length>1048576);const options={profile:'vercel-ai-sdk',assetsDirectory:dir,fixturePath:dir+'/case.json',sha256:createHash('sha256').update(bytes).digest('hex')};let server;
 try{await assert.rejects(launchCaseServer({...options,protocol:'unknown'}),/protocol/);await assert.rejects(launchCaseServer(options));server=await launchCaseServer({...options,protocol:'matrix-v3'});assert.equal((await(await fetch(server.origin+'/context')).json()).history.length,10000);const close=server.close();assert.equal(close,server.close());const result=await close;assert.deepEqual(result.exit,{code:0,signal:null});assert.deepEqual(result.close,{code:0,signal:null});assert.equal(result.disconnected,true);assert.equal(result.report.protocol,'matrix-v3');assert.equal(result.report.closed,true);for(const stream of Object.values(result.streams)){assert.equal(stream.end,true);assert.equal(stream.closed,true);}
 }finally{await server?.close();await fs.rm(dir,{recursive:true,force:true});}
});
test('matrix private file cap remains 32MiB and v2 context/report shape stays unchanged',async()=>{
 const dir=await assets();let server;
 try{const handle=await fs.open(dir+'/oversized.json','w');await handle.truncate(33554433);await handle.close();
 await assert.rejects(launchCaseServer({profile:'vercel-ai-sdk',assetsDirectory:dir,fixturePath:dir+'/oversized.json',sha256:'0'.repeat(64),protocol:'matrix-v3'}),error=>{assert.match(error.serverOutcome.stderr,/fixture-file/);assert.equal(error.serverOutcome.exit.code,1);assert.equal(error.serverOutcome.close.code,1);return true;});
 server=await startFunctionalServer({profile:'vercel-ai-sdk',assetsDirectory:dir,privateCase:createFunctionalCase('vercel-ai-sdk','follow')});const response=await fetch(server.origin+'/context');assert.equal(response.headers.get('x-chat-ui-bench-protocol'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).schema,1);await server.close();assert.equal(server.getReport().schema,1);assert.equal(Object.hasOwn(server.getReport(),'protocol'),false);
 }finally{await server?.close();await fs.rm(dir,{recursive:true,force:true});}
});
