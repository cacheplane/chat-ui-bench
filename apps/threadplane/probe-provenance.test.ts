import {expect,test} from 'vitest';
import * as fs from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const api=await import('./probe-provenance.mjs').catch(()=>({})) as any;
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
