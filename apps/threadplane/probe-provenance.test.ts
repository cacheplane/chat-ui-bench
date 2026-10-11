import {expect,test} from 'vitest';
import * as fs from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
const api=await import('./probe-provenance.mjs').catch(()=>({})) as any;
const {ComparisonOwnership}=await import('../../packages/runner/dist/comparison-ownership.js');
function probeControls(target?:[string,string]){
 let active=true,hit=false;const revoked=new Error('probe generation revoked'),ledger:string[]=[],resources:any[]=[];
 const lifecycle={assertActive(){if(!active)throw revoked;},async adopt(resource:any){resources.push(resource);if(!active){await resource.close();throw revoked;}}};
 const acquire=async(name:string,path:any,operation:()=>Promise<any>)=>{expect(active,`after revoke ${name} ${path}`).toBe(true);ledger.push(`${name}:${path}`);const value=await operation();if(target&&name===target[0]&&String(path).endsWith(target[1])){hit=true;active=false;}return value;};
 const ops={...fs,...Object.fromEntries(['realpath','lstat','access','readdir'].map(name=>[name,(path:any,...args:any[])=>acquire(name,path,()=> (fs as any)[name](path,...args))])),open:(path:any,...args:any[])=>acquire('open',path,async()=>{const fd=await (fs.open as any)(path,...args);return {stat:()=>acquire('stat',path,()=>fd.stat()),read:(...args:any[])=>acquire('read',path,()=>fd.read(...args)),close:()=>fd.close()};})};
 return {ops,lifecycle,ledger,resources,revoked,revoke(){active=false;},get hit(){return hit;}};
}
test('owned checker probe revoked entries have no source tool record or import acquisitions',async()=>{
 const c=probeControls();c.revoke();for(const call of [()=>api.snapshotFiles(process.cwd(),[],c),()=>api.snapshotProbeInputs(process.cwd(),c),()=>api.assertProbeInputsUnchanged(process.cwd(),{},c),()=>api.snapshotCompiledInputs(process.cwd(),c),()=>api.assertCompiledInputsUnchanged(process.cwd(),{},c),()=>api.loadContract(process.cwd(),c),()=>api.comparisonInstrumentationBuildEvidence(process.cwd(),c)])await expect(call()).rejects.toBe(c.revoked);expect(c.ledger).toEqual([]);
});
test.each([['realpath',''],['open','/apps/threadplane/angular.json'],['open','/packages/runner/src/comparison-observations.ts'],['open','/package.json'],['open','/package-lock.json'],['access','/node_modules/typescript/package.json'],['open','/node_modules/typescript/package.json'],['open',`/node_modules/@typescript/typescript-${process.platform}-${process.arch}/package.json`],['lstat',`/lib/tsc${process.platform==='win32'?'.exe':''}`]])('owned checker probe expiry at %s %s blocks later source and tool work',async(name,key)=>{
 const root=await fixture();try{const c=probeControls([name,key]);await expect(api.snapshotProbeInputs(root,c)).rejects.toBe(c.revoked);expect(c.hit).toBe(true);for(const resource of c.resources)await resource.close();}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker compiled loop expiry prevents acquisition of the next key',async()=>{
 const root=await fixture();try{for(const key of api.probeCompiledKeys){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.writeFile(join(root,key),'actual snapshot fixture bytes');}const c=probeControls(['read',`/${api.probeCompiledKeys[0]}`]);await expect(api.snapshotCompiledInputs(root,c)).rejects.toBe(c.revoked);expect(c.hit).toBe(true);expect(c.resources).toHaveLength(1);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker probe default and empty options preserve cold facts and exact declarations',async()=>{
 const root=await fixture();try{const expected=await api.snapshotProbeInputs(root);expect(await api.snapshotProbeInputs(root,{})).toEqual(expected);const c=probeControls();expect(await api.snapshotProbeInputs(root,c)).toEqual(expected);expect(c.resources.length).toBeGreaterThan(29);for(const resource of c.resources)await resource.close();expect(api.probeSourceKeys).toHaveLength(29);expect(api.probeCompiledKeys).toHaveLength(14);expect(api.contractCompiledKeys).toHaveLength(12);expect([...api.probeSourceKeys,...api.probeCompiledKeys].some((key:string)=>/worker|\.test\./.test(key))).toBe(false);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker contract import checks original lifecycle after real module resolution',async()=>{
 const revoked=new Error('contract return revoked');let assertions=0;
 const lifecycle={assertActive(){if(++assertions===4)throw revoked;},async adopt(){throw new Error('no explicit contract-loader FD');}};
 await expect(api.loadContract(process.cwd(),{lifecycle})).rejects.toBe(revoked);expect(assertions).toBe(4);
});
test.each(['apps/threadplane/angular.json','node_modules/typescript/package.json',`node_modules/@typescript/typescript-${process.platform}-${process.arch}/package.json`])('owned checker source or tool close at %s remains pending and cannot hash after revocation',async key=>{
 const root=await fixture(),original=crypto.createHash;let release!:()=>void,closing!:()=>void,hashes=0,settled=false;
 const pending=new Promise<void>(r=>{release=r;}),entered=new Promise<void>(r=>{closing=r;});
 try{
  const c=probeControls(),ops={...c.ops,open:async(file:any,...args:any[])=>{const fd=await c.ops.open(file,...args);return {...fd,close:async()=>{if(file===join(root,key)){closing();await pending;}await fd.close();}};}};
  crypto.createHash=((...args:any[])=>{hashes++;return (original as any)(...args);}) as typeof original;syncBuiltinESMExports();
  const read=api.snapshotProbeInputs(root,{ops,lifecycle:c.lifecycle}),proof=expect(read).rejects.toBe(c.revoked);void read.then(()=>{settled=true;},()=>{settled=true;});await entered;
  expect(settled).toBe(false);const before=hashes,acquisitions=[...c.ledger];c.revoke();release();await proof;expect(hashes).toBe(before);expect(c.ledger).toEqual(acquisitions);for(const resource of c.resources)await resource.close();
 }finally{release();crypto.createHash=original;syncBuiltinESMExports();await fs.rm(root,{recursive:true,force:true});}
});
async function genuineProbe(scenario='equality'){
 const root=await fs.realpath(process.cwd()),probePath=join(root,api.probeRecordKey),productPath=join(root,'apps/threadplane/.build-evidence.json'),before=await Promise.all([fs.readFile(probePath),fs.readFile(productPath)]),resources:any[]=[],handles:any[]=[],ledger:string[]=[];let now=0,probeOpens=0,observed:any,auxiliaryClosed=false;
 const failure=new Error('nested product actual close failed'),owner=new ComparisonOwnership({now:()=>now});
 const outcome=await owner.run('setup',async context=>{
  // A separate actual handle proves later cleanup continues after nested failure.
  const auxiliary=await fs.open(productPath,'r');let closePromise:Promise<void>|undefined;await context.adopt({name:'test-only independent existing record FD',close(){return closePromise??=auxiliary.close().then(()=>{auxiliaryClosed=true;});}});
  const lifecycle={assertActive:()=>context.assertActive(),async adopt(resource:any){resources.push(resource);await context.adopt(resource);}};
  const acquire=async(name:string,file:any,operation:()=>Promise<any>)=>{context.assertActive();ledger.push(`${name}:${file}`);const value=await operation();
   if(file===productPath&&scenario==='nested-read-expiry'&&name==='read')now=context.deadlineAtHostMs;
   return value;
  };
  const ops={...fs,...Object.fromEntries(['realpath','lstat','access','readdir'].map(name=>[name,(file:any,...args:any[])=>acquire(name,file,()=> (fs as any)[name](file,...args))])),writeFile:async()=>{throw new Error('read-only checker wrote');},rename:async()=>{throw new Error('read-only checker renamed');},unlink:async()=>{throw new Error('read-only checker unlinked');},open:async(file:any,...args:any[])=>{
   const fd=await acquire('open',file,()=> (fs.open as any)(file,...args)),row={fd,closes:0};handles.push(row);
   if(file===probePath){probeOpens++;if(scenario==='probe-reread-expiry'&&probeOpens===2||scenario==='probe-final-expiry'&&probeOpens===3)now=context.deadlineAtHostMs;}
   if(file===productPath&&scenario==='nested-late-open')now=context.deadlineAtHostMs;
   return {stat:()=>acquire('stat',file,()=>fd.stat()),read:(...args:any[])=>acquire('read',file,()=>fd.read(...args)),close:async()=>{row.closes++;await fd.close();if(file===productPath){if(scenario==='nested-close-expiry')now=context.deadlineAtHostMs;if(scenario==='nested-close-failure')throw failure;}}};
  }};
  try{return await api.comparisonInstrumentationBuildEvidence(root,{ops,lifecycle});}catch(error){observed=error;throw error;}
 });
 const disposal=await owner.dispose();expect(auxiliaryClosed).toBe(true);for(const resource of resources){expect(resource.close()).toBe(resource.close());await resource.close().catch(()=>{});}
 for(const row of handles){expect(row.closes).toBe(1);await expect(row.fd.stat()).rejects.toMatchObject({code:'EBADF'});}expect(resources).toHaveLength(handles.length);expect(await Promise.all([fs.readFile(probePath),fs.readFile(productPath)])).toEqual(before);
 if(scenario==='nested-late-open')expect(ledger.filter(value=>value.endsWith(productPath))).toEqual(expect.arrayContaining([`open:${productPath}`]));
 return {outcome,disposal,owner,failure,observed,ledger,productPath};
}
test('actual optimized probe product pair default and owned checker equality',async()=>{
 const expected=await api.comparisonInstrumentationBuildEvidence();const {outcome,disposal}=await genuineProbe();expect(outcome.status).toBe('complete');expect(outcome.value).toEqual(expected);expect(disposal.status).toBe('complete');
});
test.each(['probe-reread-expiry','probe-final-expiry','nested-late-open','nested-read-expiry','nested-close-expiry','nested-close-failure'])('actual optimized probe product pair default and owned checker equality (%s rejects)',async scenario=>{
 const {outcome,disposal,owner,failure,observed,ledger,productPath}=await genuineProbe(scenario);expect(outcome.status).toBe('failed');
 if(scenario==='nested-late-open'){expect(ledger.some(value=>value===`stat:${productPath}`||value===`read:${productPath}`)).toBe(false);expect(observed.message).toContain('Late resource');}
 if(scenario==='nested-close-failure'){expect(observed).toBe(failure);expect(disposal.status).toBe('failed');expect(owner.canContinue).toBe(false);expect(owner.failures.some((row:any)=>row.message===failure.message)).toBe(true);}else expect(disposal.status).toBe('complete');
});
export async function fixture(){
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'probe-lineage-')));
 for(const key of api.probeSourceKeys){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.copyFile(resolve(key),join(root,key));}
 for(const key of ['node_modules/typescript/package.json',`node_modules/@typescript/typescript-${process.platform}-${process.arch}/package.json`]){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.copyFile(resolve(key),join(root,key));}
 const exe=`node_modules/@typescript/typescript-${process.platform}-${process.arch}/lib/tsc${process.platform==='win32'?'.exe':''}`;
 await fs.mkdir(join(root,exe,'..'),{recursive:true});await fs.writeFile(join(root,exe),'executable fixture');
 return root;
}
test('declares exact original sources and emitted modules without loading absent dist',async()=>{
 expect(Array.isArray(api.probeSourceKeys)).toBe(true);
 expect(api.contractSourceKeys).toHaveLength(12);expect(api.probeCompiledKeys).toHaveLength(14);
 for(const key of ['comparison-buffer','comparison-installer-options','adapter','presentation'])expect(api.contractSourceKeys).toContain(`packages/contract/src/${key}.ts`);
 const root=await fixture();try{expect(await api.snapshotProbeInputs(root)).toMatchObject({compiler:{version:'7.0.2'},nativeCompiler:{version:'7.0.2',platform:process.platform,architecture:process.arch}});await expect(fs.access(join(root,'packages/contract/dist'))).rejects.toThrow();}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('source/config and same-size compiler metadata changes invalidate the initial snapshot',async()=>{
 expect(typeof api.snapshotProbeInputs).toBe('function');
 const root=await fixture();try{
  const before=await api.snapshotProbeInputs(root);
  for(const key of ['packages/contract/src/comparison-buffer.ts','packages/contract/src/comparison-installer-options.ts','packages/contract/src/presentation.ts','tsconfig.base.json','node_modules/typescript/package.json']){
   const path=join(root,key),original=await fs.readFile(path);const changed=key==='node_modules/typescript/package.json'?Buffer.from(original.toString().replace('    ','  \t ')):Buffer.from(original);
   if(key==='node_modules/typescript/package.json'){expect(changed.length).toBe(original.length);expect(JSON.parse(changed.toString())).toEqual(JSON.parse(original.toString()));}else changed[changed.length-2]^=1;
   await fs.writeFile(path,changed);
   await expect(api.assertProbeInputsUnchanged(root,before)).rejects.toThrow();await fs.writeFile(path,original);
  }
  expect(before.compilerPackageMetadata.sha256).toMatch(/^[a-f0-9]{64}$/);expect(before.compilerPackageMetadata.sha256).not.toBe(before.compiler.integrity);
  expect(before.compiler.resolutionPath).toBe('node_modules/typescript');expect(before.nativeCompiler.executablePath).toContain('/lib/tsc');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('exact emitted checkpoint rejects replacement with unchanged TypeScript',async()=>{
 expect(typeof api.snapshotCompiledInputs).toBe('function');const root=await fixture();try{
  for(const key of api.probeCompiledKeys){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.writeFile(join(root,key),'original JS');}
  const checkpoint=await api.snapshotCompiledInputs(root);await fs.writeFile(join(root,'packages/contract/dist/comparison-buffer.js'),'replaced JS');
  await expect(api.assertCompiledInputsUnchanged(root,checkpoint)).rejects.toThrow('changed');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('input snapshots pin root and ancestor identity independently of unchanged leaf bytes',async()=>{
 const root=await fixture(),moved=root+'-moved';try{
  const before=await api.snapshotProbeInputs(root);await fs.rename(root,moved);await fs.mkdir(root);
  for(const name of await fs.readdir(moved))await fs.rename(join(moved,name),join(root,name));
  await expect(api.assertProbeInputsUnchanged(root,before)).rejects.toThrow('changed');
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(moved,{recursive:true,force:true});}
});
test('strict generated probe bytes reject duplicate/missing/extra keys and noncanonical encodings',async()=>{
 expect(typeof api.parseProbeRecord).toBe('function');
 const {comparisonInstrumentationBuildSchema,canonicalSerialize}=await import('@chat-ui-bench/contract');
 const root=await fixture();try{
  const snapshot=await api.snapshotProbeInputs(root),record={kind:'comparison-instrumentation-build',formatVersion:1,...api.probeRecordInputs(snapshot),compiledHashes:Object.fromEntries(api.probeCompiledKeys.map((key:string)=>[key,'a'.repeat(64)]))};
  const bytes=Buffer.from(canonicalSerialize(record)+'\n');expect(api.parseProbeRecord(bytes,{comparisonInstrumentationBuildSchema,canonicalSerialize})).toEqual(record);
  const alterations=[bytes.subarray(0,bytes.length-1),Buffer.from(JSON.stringify(record)+'\n'),Buffer.from(bytes.toString().replace('"formatVersion":1','"formatVersion":1,"formatVersion":1'))];
  for(const altered of alterations)expect(()=>api.parseProbeRecord(altered,{comparisonInstrumentationBuildSchema,canonicalSerialize})).toThrow();
  for(const field of ['sourceHashes','compiledHashes'])for(const mode of ['missing','extra']){const altered=structuredClone(record);if(mode==='missing')delete altered[field][Object.keys(altered[field])[0]!];else altered[field]['fake.ts']='a'.repeat(64);expect(()=>api.parseProbeRecord(Buffer.from(canonicalSerialize(altered)+'\n'),{comparisonInstrumentationBuildSchema,canonicalSerialize})).toThrow('keys');}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
