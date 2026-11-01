import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),script=new URL('../scripts/verify-isolation.mjs',import.meta.url);
test('own tool/SDK/lock guard exists and accepts this exact independent install',async()=>{
 let exists=true;try{await fs.access(script);}catch{exists=false;}assert.equal(exists,true,'missing own dependency guard');
 const result=spawnSync(process.execPath,[script.pathname],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
test('missing own dependencies cannot fall back to the ancestor project tools',async()=>{
 const dir=await fs.mkdtemp(new URL('../.isolation-authored-',import.meta.url).pathname);
 try{await fs.mkdir(dir+'/scripts');for(const name of ['package.json','package-lock.json'])await fs.copyFile(new URL('../'+name,import.meta.url),dir+'/'+name);await fs.copyFile(script,dir+'/scripts/verify-isolation.mjs');
 const result=spawnSync(process.execPath,[dir+'/scripts/verify-isolation.mjs'],{cwd:dir,encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/own-dependency/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
