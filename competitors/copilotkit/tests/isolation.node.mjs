import os from 'node:os';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
test('physical frontend module admission rejects foreign node_modules and symlink escape',async()=>{
 const {assertIsolatedModule}=await import('../build-isolation.mjs'),tmp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'copilot-isolation-'))),own=path.join(tmp,'copilotkit'),foreign=path.join(tmp,'foreign');
 try{await fs.mkdir(own+'/node_modules/pkg',{recursive:true});await fs.mkdir(foreign+'/node_modules/pkg',{recursive:true});await fs.writeFile(own+'/node_modules/pkg/index.js','own');await fs.writeFile(foreign+'/node_modules/pkg/index.js','foreign');
 assert.equal(assertIsolatedModule(own+'/node_modules/pkg/index.js',own),own+'/node_modules/pkg/index.js');
 assert.throws(()=>assertIsolatedModule(foreign+'/node_modules/pkg/index.js',own),/foreign/);
 await fs.symlink(foreign+'/node_modules/pkg/index.js',own+'/node_modules/escaped.js');assert.throws(()=>assertIsolatedModule(own+'/node_modules/escaped.js',own),/foreign/);
 assert.equal(assertIsolatedModule('\0vite/preload-helper.js',own),null);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
