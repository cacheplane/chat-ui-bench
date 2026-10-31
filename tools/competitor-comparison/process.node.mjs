import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createFunctionalCase} from './fixtures.mjs';
const api=await import('./process.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
async function setup(){const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'competitor-child-authored-')));await fs.mkdir(dir+'/assets');await fs.writeFile(dir+'/assets/index.html','<!doctype html><title>Authored static</title>');const bytes=Buffer.from(JSON.stringify(createFunctionalCase('vercel-ai-sdk','follow')));await fs.writeFile(dir+'/fixture.json',bytes);return{dir,profile:'vercel-ai-sdk',assetsDirectory:dir+'/assets',fixturePath:dir+'/fixture.json',sha256:createHash('sha256').update(bytes).digest('hex')};}
test('the owned child publishes ready and original EOF/exit/close before closure succeeds',async()=>{
 assert.equal(typeof api.launchCaseServer,'function');const options=await setup();let server;
 try{server=await api.launchCaseServer(options);const response=await fetch(server.origin+'/context');assert.equal((await response.json()).history.length,100);const first=server.close();assert.equal(first,server.close());const result=await first;assert.deepEqual(result.exit,{code:0,signal:null});assert.deepEqual(result.close,{code:0,signal:null});assert.equal(result.disconnected,true);assert.equal(result.report.closed,true);}
 finally{if(server)await server.close().catch(()=>{});await fs.rm(options.dir,{recursive:true,force:true});}
});
test('wrong fixture pin preserves the original nonzero outcome instead of ready',async()=>{
 const options=await setup();try{await assert.rejects(api.launchCaseServer({...options,sha256:'a'.repeat(64)}),error=>{assert.equal(error.serverOutcome.exit.code,1);assert.equal(error.serverOutcome.close.code,1);return true;});}finally{await fs.rm(options.dir,{recursive:true,force:true});}
});
