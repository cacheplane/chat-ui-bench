import {expect,test} from 'vitest';
test('closed family constructor source and compiled bytes are mandatory probe and product inputs',async()=>{
 const source='packages/contract/src/comparison-version-families.ts',compiled='packages/contract/dist/comparison-version-families.js';
 expect(api.contractSourceKeys).toContain(source);expect(api.contractCompiledKeys).toContain(compiled);expect(api.probeSourceKeys).toContain(source);expect(api.probeCompiledKeys).toContain(compiled);
 const product=await import('./provenance.mjs');expect(await product.productSourceKeys()).toContain(source);
 const root=await fixture();try{
   const before=await api.snapshotProbeInputs(root);expect(before.facts[source]).toBeDefined();const original=await fs.readFile(join(root,source)),changed=Buffer.from(original);changed[0]^=1;await fs.writeFile(join(root,source),changed);await expect(api.assertProbeInputsUnchanged(root,before)).rejects.toThrow('changed during build');await fs.writeFile(join(root,source),original);
   for(const key of api.probeCompiledKeys){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.writeFile(join(root,key),'synthetic emitted checkpoint');}
   const emitted=await api.snapshotCompiledInputs(root);expect(emitted[compiled]).toBeDefined();await fs.writeFile(join(root,compiled),'replaced emitted checkpoint');await expect(api.assertCompiledInputsUnchanged(root,emitted)).rejects.toThrow('changed during build');
   const contract=await api.loadContract(),value={kind:'comparison-instrumentation-build',formatVersion:1,...api.probeRecordInputs(before),compiledHashes:api.hashes(emitted)};
   expect(api.parseProbeRecord(Buffer.from(contract.canonicalSerialize(value)+'\n'),contract)).toEqual(value);
   for(const [field,key] of [['sourceHashes',source],['compiledHashes',compiled]]){const missing=structuredClone(value);delete missing[field][key];expect(()=>api.parseProbeRecord(Buffer.from(contract.canonicalSerialize(missing)+'\n'),contract)).toThrow('Unsupported probe');}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('saved exact original 29/14 canonical record is stale after real worker admission',async()=>{
 const bytes=Buffer.from('eyJjb21waWxlZEhhc2hlcyI6eyJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2FkYXB0ZXIuanMiOiJjZDU5MjQ1MjJkYWI4ZGVkZjIwMjIyYjAyM2RhNTAxNDI3Nzg4OTNkZTI2YzQ3OGY2YWUyODdjOGNkNDExMGNiIiwicGFja2FnZXMvY29udHJhY3QvZGlzdC9hcnRpZmFjdC5qcyI6Ijg0ZDNmODA0ZTM0OWVhZWI5ZGExNGJmMDNhZDIwNmZlZjJlODlhNDBhNjllZmI1YWU3NDYyNWM1ZjA2Njk2NjkiLCJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2NhcHR1cmUtYnJpZGdlLmpzIjoiYjRmNmZkYjYwNGVkZTRiN2U5N2ZmZWRhNmRhMDA2NDQzNmMyYjdjNmQ4ZDRjNGYzNzMzZWRlZDI1YzE2M2RlYSIsInBhY2thZ2VzL2NvbnRyYWN0L2Rpc3QvY29tcGFyaXNvbi1hcnRpZmFjdC5qcyI6ImM5NjZjMmIxNjc2NjAyZTM4NGNhMmM0M2E0NTQ0YmRkMTRmYmI1ZDM1Nzg3MmMzYWFkYjA4Y2M2N2FmNTM2ODYiLCJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2NvbXBhcmlzb24tYnVmZmVyLmpzIjoiMjM4MWEwMGYxNzdjODVmMjJhY2JlZmFiYzBiYTNhYmIyMjNiNGRhNzIzYmY0YzY0ODgxN2E0MGIxMmY0MWJjMyIsInBhY2thZ2VzL2NvbnRyYWN0L2Rpc3QvY29tcGFyaXNvbi1pbnN0YWxsZXItb3B0aW9ucy5qcyI6ImZiMWYyZjJjY2IxMGUyODEwN2FiZTA0OWM3ZWU5OWE1MTFlNDIyNmY1ZjEyYTY4MTE1MWEzZWJmNzU0YzUxMWQiLCJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2NvbXBhcmlzb24tcHJlc2VudGF0aW9uLmpzIjoiOTRlZjhhYjE0MjJjZjNlNjk5NzdiZTMxNmQ0MzhlNWRhZGY0YmI3ZTkxNDAxNDAxZTM5NDBiZTAyMTM2OGI2NiIsInBhY2thZ2VzL2NvbnRyYWN0L2Rpc3QvY29tcGFyaXNvbi5qcyI6Ijg3YmE0YzY2ZjE3OTVlMzA3NTVmMjUzZTA3YTNhMzI0ZDE4NjllMDJiMzM4NGUwZDI5MjY1NTc2YjE4MDkxNzEiLCJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2ZpeHR1cmUuanMiOiIwODFiN2FkMzY2YWZlNjhkMDBhYzAyZDMyOTEzNzM2NDQwODYxMDg5YWVlNDFlYWEwZGUxZDBhYjNkOTAzNmU0IiwicGFja2FnZXMvY29udHJhY3QvZGlzdC9pbmRleC5qcyI6IjRkZjNkODllOTUyMTI1OTg5YjEyYzUzN2IzNTE1ODhlNjdkZmNmN2ZjZmVlOTMyMDM2MTY3ZGY0NWFhOGZjZTEiLCJwYWNrYWdlcy9jb250cmFjdC9kaXN0L2xvbmctdGhyZWFkLmpzIjoiODM5ZDgyMmZlMDk4MDFmMjFlNGJlZTA0OTE4NzkwMjEwNGNkMDc0MzgyMmQyODY4ZmJiMjRhNDM1MDZlZGUwNyIsInBhY2thZ2VzL2NvbnRyYWN0L2Rpc3QvcHJlc2VudGF0aW9uLmpzIjoiMjM5OTFiNTRkOGQ5OGI5NDliZjg2OGY4N2Q1MTc2Y2JlNmJmMTliMTdhM2JlYzhhYjdjNDRjOWU2OGQyNjVhMyIsInBhY2thZ2VzL3J1bm5lci9kaXN0L2NvbXBhcmlzb24taW5zdGFsbGVyLmpzIjoiMTQ3NjFmMzgyZTFmYTg0MzllNjkzMjZkZTkyZDBiMmE4NjRkY2Q4OGZhM2JkZTFiZDA1MThmYzlkMGMyYTBmOCIsInBhY2thZ2VzL3J1bm5lci9kaXN0L2NvbXBhcmlzb24tb2JzZXJ2YXRpb25zLmpzIjoiZmFmZTQ1NGUzY2I0OTRmMmUxZTNlNzBkYWQwOGE1MzY3ZWQ0YWFhNGUwNDY1NjVkOTM0NzY0ZGE0NWNiNWUxMyJ9LCJjb21waWxlciI6eyJpbnRlZ3JpdHkiOiJzaGE1MTItOEZZYXU5Nm8zTktPaGJqS2kvcU52Ry9XNWpoenhrYmRtNXNqOUFiWi81VDVzV3FuM2hKZ0xmR3gyN3NSS1pXVHZ5ekNQOGRMUkJUZjV0QlRTUlZVTkE9PSIsIm5hbWUiOiJ0eXBlc2NyaXB0Iiwibm9kZVZlcnNpb24iOiJ2MjQuMjAuMCIsInJlc29sdXRpb25QYXRoIjoibm9kZV9tb2R1bGVzL3R5cGVzY3JpcHQiLCJ2ZXJzaW9uIjoiNy4wLjIifSwiY29tcGlsZXJQYWNrYWdlTWV0YWRhdGEiOnsiYnl0ZUxlbmd0aCI6MzA4Nywic2hhMjU2IjoiMzcyMmIzMDIxMDYxNmExM2EzMjEzZGVkMTE1NzViYTZiMmRiYWIxMGMzMmE1ZWY2N2FmY2E4NTEzZTI3MDE3ZSJ9LCJmb3JtYXRWZXJzaW9uIjoxLCJraW5kIjoiY29tcGFyaXNvbi1pbnN0cnVtZW50YXRpb24tYnVpbGQiLCJuYXRpdmVDb21waWxlciI6eyJhcmNoaXRlY3R1cmUiOiJhcm02NCIsImV4ZWN1dGFibGVQYXRoIjoibm9kZV9tb2R1bGVzL0B0eXBlc2NyaXB0L3R5cGVzY3JpcHQtZGFyd2luLWFybTY0L2xpYi90c2MiLCJpbnRlZ3JpdHkiOiJzaGE1MTItZ293emFyOU13Uy9hUldwNmYzYTRLVXF6UmpBWmpPc21HTkNNNkxjVGdYdW0rZEJmZ3NCVk1OK0Fndk9DQ2JndVh5aWNrNkxKaHBCc3p4TWViSjhzeUE9PSIsIm5hbWUiOiJAdHlwZXNjcmlwdC90eXBlc2NyaXB0LWRhcndpbi1hcm02NCIsInBsYXRmb3JtIjoiZGFyd2luIiwicmVzb2x1dGlvblBhdGgiOiJub2RlX21vZHVsZXMvQHR5cGVzY3JpcHQvdHlwZXNjcmlwdC1kYXJ3aW4tYXJtNjQiLCJ2ZXJzaW9uIjoiNy4wLjIifSwibmF0aXZlQ29tcGlsZXJQYWNrYWdlTWV0YWRhdGEiOnsiYnl0ZUxlbmd0aCI6MTA0OCwic2hhMjU2IjoiZTg4NTU4ZTIyZTNkYjZjNGRhOTIwZTE1YTYwZWIyYmJlYTgwMTczMmI5NGFlZGI2N2U5NzJiZTJhN2Y0ODViOCJ9LCJzb3VyY2VIYXNoZXMiOnsiYXBwcy90aHJlYWRwbGFuZS9hbmd1bGFyLmpzb24iOiIyZjQ0ZTNiYmYwZDM0ZGJmM2M1YzlmNDY3ZDdiZWU2MzhjY2E3YzRjODMyZDkxZjE0NDhkMjc0NWZiYzE0ODM4IiwiYXBwcy90aHJlYWRwbGFuZS9idWlsZC5tanMiOiIzZjg2MzNmZmI1NjA0YjU3NmQ0YjJhMjNkZTg0OTY0MzU2MTg4YzFhN2QzNGU5ZjRjN2ZjODI4Y2ZhMjAwZGVkIiwiYXBwcy90aHJlYWRwbGFuZS9kZXBlbmRlbmN5LWNsb3N1cmUubWpzIjoiMTM2NWIzZWMzN2FhNTE2NGI4ZWNjYzZkNTI5Y2JlYzkzZTcxZGFhOWQ1ZGJiYmFmMzBlZjBhY2E1YjBiMWM3NSIsImFwcHMvdGhyZWFkcGxhbmUvcGFja2FnZS5qc29uIjoiZTE4MjU3MDNiMGYwODNiMjBiOTA1MWE4ZmZjNGU5ODAyOGUxZmZhN2ZmNDFmMjRjMDU4OTBiMmZlYTQ5ZTgyZiIsImFwcHMvdGhyZWFkcGxhbmUvcHJvYmUtcHJvdmVuYW5jZS5tanMiOiI5ZWE0NDQ5ZDk5MTcyZmUyNDUwY2ZjYjgyMGYxOTAwNTI3MzRhMmFhMmYzYTg1MTdlZDUxMGI3YjZiMzg1OWYwIiwiYXBwcy90aHJlYWRwbGFuZS9wcm92ZW5hbmNlLm1qcyI6IjI4OWZmMDljY2QxZDI1NmFkNzJiMzNmMDljYmQ4NTY0MTRmNTZkMmI4ZTRhNDE3MDI4NTViMzg4YjgyNTk0NzciLCJhcHBzL3RocmVhZHBsYW5lL3RzY29uZmlnLmFwcC5qc29uIjoiMmMyNjQ1MTVkZmE5MjI2ZmE5M2MwYzAyMjllMjNlZmUwMzYzNTdhMjk3MmI4N2ZlZTY4MTRjOTk4OGRjYTdkYiIsImFwcHMvdGhyZWFkcGxhbmUvdHNjb25maWcuanNvbiI6ImE0NDdkNzg1YmM3Zjk2ZGMwZWU0MTkwODRjNWQ2ZjQ1ODJlMmRjZDllMzljYjM0MDEwNWQwOTA5ZDM2NTBhYzAiLCJwYWNrYWdlLWxvY2suanNvbiI6ImQ0MDhmYjA1ZTljNjZhNDM4NmM5NDIwNjRkMmE3MzY0YWYzZTU0YTc1ZjI2NDlhM2JmOWU5YzlmZjNhNGZhNzciLCJwYWNrYWdlLmpzb24iOiIzYTVjM2E4MmYwOWMwNzA3OWNhNTUwYjU3ZDdkMmViZDY3YWI0ZmJkMjg4MTQ2OTAxZWJjMDg0OWE0OTY5ZTFhIiwicGFja2FnZXMvY29udHJhY3QvcGFja2FnZS5qc29uIjoiYzExNDkxN2MwMTFkZGI2MDNjZDU0YTBmMDlkNjFjZDFkM2QyMzNiOTZlZDEwZDNhNDVlNTBlOTZhOGQxZTM1NSIsInBhY2thZ2VzL2NvbnRyYWN0L3NyYy9hZGFwdGVyLnRzIjoiMWM3N2Y3OTQ3Y2Q2NTk0Zjc1YzY2NTBiNzUzYjE1YTM4MTQ4MmE4MmM1ZDg3NTI2NDM3NzQxN2QzYTU0NWYxZiIsInBhY2thZ2VzL2NvbnRyYWN0L3NyYy9hcnRpZmFjdC50cyI6IjNkYTg3ZjE2NzhhMzRjYmQyY2ZmYWNkYzMyMjFlYzZmOWY1MGY5MGFlYTVmNjRlMjFlM2U4ZDVmMWNhZWJjNTkiLCJwYWNrYWdlcy9jb250cmFjdC9zcmMvY2FwdHVyZS1icmlkZ2UudHMiOiI1NjcxNDE5ODRkM2Y0ZjI4MWMwZTQxYmQzNTczZjQwNjFkYTA0Y2NhMWZkOGM3ZmY4ODEzYjc0ZDkyODJlNWYyIiwicGFja2FnZXMvY29udHJhY3Qvc3JjL2NvbXBhcmlzb24tYXJ0aWZhY3QudHMiOiI2MTQxODE4OTVlN2U2M2VhYzI3MDIzNDJmZGI5YjBmZTUzMmI5MWEzZTBkMzUxMmE0OGYyMGMyMjExOGM2NzJjIiwicGFja2FnZXMvY29udHJhY3Qvc3JjL2NvbXBhcmlzb24tYnVmZmVyLnRzIjoiYzJkM2Q4NWZhNjViZTU3YTgwZmVkMGY1YTVkMzBhMzk2MWZiYTE3MmQ4YjYxZjAzYWU2ZDA4ZGUzYWNmNTk4MyIsInBhY2thZ2VzL2NvbnRyYWN0L3NyYy9jb21wYXJpc29uLWluc3RhbGxlci1vcHRpb25zLnRzIjoiZGI3YjU5NzJhMTg0NWRjMTNmMzNlNTM1Nzk3MmMwOWRiNTJhODRmZWVmZDdkYmI3ODZjMTIxNzRmOGU0ZDU4MyIsInBhY2thZ2VzL2NvbnRyYWN0L3NyYy9jb21wYXJpc29uLXByZXNlbnRhdGlvbi50cyI6IjEzMzY2OThiODY2OGNhYjI1ZGZmZjI3NDc1ZTg3YjJjOTA2MTI0ZmIxNDViYjY1MTE4ODIyNTc3NmIyN2JkNzciLCJwYWNrYWdlcy9jb250cmFjdC9zcmMvY29tcGFyaXNvbi50cyI6ImI0ZGMzYjBlZjNiNTNkOTBjYmZiY2NiNjFmNDc1NjVkYzVmZTg3NWI5ODYxMGI2MDhlOGE0YmFkYjRkYmE2ZmQiLCJwYWNrYWdlcy9jb250cmFjdC9zcmMvZml4dHVyZS50cyI6IjNhOGY4NDQwN2M0MGFhNmRkZDcwMDJhMWQyYjBiNmUzY2NhNDJmZTE0YjVlYjhkMjUxYzY3YjE3YjU0ODRjMWIiLCJwYWNrYWdlcy9jb250cmFjdC9zcmMvaW5kZXgudHMiOiI1ZDU4N2VmZmYxZmFkMGY1ZDdiZTkxMTEwYTQ5MDc4OTU4YzY2NTBkYTYwNTNlY2M1NzhkMjJmYzAwMDk1MGE5IiwicGFja2FnZXMvY29udHJhY3Qvc3JjL2xvbmctdGhyZWFkLnRzIjoiZTE3YmI5ZGVmNmMyNDQxMGE1OWM4OGRjNzRmMjk0MGQ5ZWQ0ZDI5NjVhOWU4ZjljNGNjNDlkNGVkNTRiZTFjYiIsInBhY2thZ2VzL2NvbnRyYWN0L3NyYy9wcmVzZW50YXRpb24udHMiOiI5ZjI0MWRhYWZhNjc4NTEwZjkwNjNlMDIyM2MzMTE2NGQxMTEzZDBiNTY1YzJiYmQ2YzhiMjZhZTM4NmRmODQ0IiwicGFja2FnZXMvY29udHJhY3QvdHNjb25maWcuanNvbiI6ImE2Y2Q4ZmYzN2VjODhkYjBkYmZkMzlmYzc2YTEyZTViNjhlNWQ1NGQ0ZjU0MzcwZDQ0NzhlYzhjZjUxMzk4ZmQiLCJwYWNrYWdlcy9ydW5uZXIvcGFja2FnZS5qc29uIjoiNDFlNGZlNDliMGM2NmU2MmQ0Mjc0YTRjZWY0ODRmZThiZWVkYTJiNjY1ODE0OTNlYzNkZWNhZTQ4ZDQyZGQ0OSIsInBhY2thZ2VzL3J1bm5lci9zcmMvY29tcGFyaXNvbi1pbnN0YWxsZXIudHMiOiJhN2YzZWQ4YTFjMzliZmUyMjA2YjJmYzVjZjcwNTI5MmVlNWNjMzAyNDdiMGExZDVmNTgyMTM4ZjgxNTVkY2JmIiwicGFja2FnZXMvcnVubmVyL3NyYy9jb21wYXJpc29uLW9ic2VydmF0aW9ucy50cyI6IjBhZTYwYmVkZTJiM2ZmZjhiYTU5ZGM4MzI1ZjMyNzQ0MTM5NDBjNzc4MDlmOWU2OTJiOGZlODg2NmRjZjM0N2UiLCJwYWNrYWdlcy9ydW5uZXIvdHNjb25maWcuanNvbiI6IjRkNWFiNDM5YjRiYTE4NTYwYjJhYjViYjJlZmE3OGI4N2NhMjA1Yjk1YzU0MjdiZDY1NjVmNDE1ODY0NDE0ZTUiLCJ0c2NvbmZpZy5iYXNlLmpzb24iOiJhZDMxODZlYjJjMTBmNjMyNjMxNGIyMzg0NWMxMGVkNGVmMzQxYzRhM2QwNzU4YmQ1NTk3MmQ4NDllYTM5OWI2In19Cg==','base64');
 expect(bytes.length).toBe(5500);expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('9c8ff5edbfed435ad80074cd25952eff6fbfd537451f52d9e52037456a6739a7');
 const old=JSON.parse(bytes.toString('utf8'));expect(Object.keys(old.sourceHashes)).toHaveLength(29);expect(Object.keys(old.compiledHashes)).toHaveLength(14);
 const contract=await api.loadContract(process.cwd());expect(()=>api.parseProbeRecord(bytes,contract)).toThrow('Unsupported probe source keys');
});
import * as fs from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
const api=await import('./probe-provenance.mjs').catch(()=>({})) as any;
test('native idle host probe selection has a separate explicit entry and unchanged stock key declaration',()=>{
 expect(typeof api.comparisonNativeIdleHostInstrumentationBuildEvidence).toBe('function');expect(api.probeSourceKeys).toHaveLength(31);expect(api.probeSourceKeys).toContain('apps/threadplane/build.mjs');expect(api.probeSourceKeys).toContain('apps/threadplane/provenance.mjs');
});
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
 const root=await fixture();try{const expected=await api.snapshotProbeInputs(root);expect(await api.snapshotProbeInputs(root,{})).toEqual(expected);const c=probeControls();expect(await api.snapshotProbeInputs(root,c)).toEqual(expected);expect(c.resources.length).toBeGreaterThan(29);for(const resource of c.resources)await resource.close();expect(api.probeSourceKeys).toHaveLength(31);expect(api.probeCompiledKeys).toHaveLength(16);expect(api.contractCompiledKeys).toHaveLength(13);expect(api.probeSourceKeys.filter((key:string)=>key.includes('worker'))).toEqual(['packages/runner/src/comparison-assembly-worker.ts']);expect(api.probeCompiledKeys.filter((key:string)=>key.includes('worker'))).toEqual(['packages/runner/dist/comparison-assembly-worker.js']);expect([...api.probeSourceKeys,...api.probeCompiledKeys].some((key:string)=>/\.test\./.test(key))).toBe(false);}finally{await fs.rm(root,{recursive:true,force:true});}
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
 expect(api.contractSourceKeys).toHaveLength(13);expect(api.probeCompiledKeys).toHaveLength(16);
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
