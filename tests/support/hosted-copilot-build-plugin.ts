/** Public build hook source; import has no Vite value or owned I/O. */
import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {assertDenseEntries,ordinaryPath,LIMITS} from './hosted-copilot-contract.ts';
import {assertMappings,assertModuleOwnershipId,assertReferenceCount,MODULE_OWNERSHIP_LIMIT,type ModuleMapping} from './hosted-copilot-production-policy.ts';
import {readIntegratedAdmission} from './hosted-copilot-context.ts';
export interface HookFile {contentSha256?:string|undefined;fileName:string;kind:'chunk'|'asset';imports:readonly string[];dynamicImports:readonly string[];moduleIds:readonly string[];originalNames:readonly string[];facadeModuleId:string|null}
export function projectHookFacts(input:readonly HookFile[],modules:readonly ModuleMapping[]) {
 assertDenseEntries(input,LIMITS.files);assertMappings(modules);const names=new Set<string>(),ids=new Set(modules.map(module=>module.id));let referenceCount=0;
 for(const file of input) {
  if(!ordinaryPath(file.fileName)||file.fileName.endsWith('.map')||names.has(file.fileName)||!['chunk','asset'].includes(file.kind)) throw new Error('Output file ownership unavailable');names.add(file.fileName);
  if(typeof file.contentSha256!=='string'||file.contentSha256.length!==64||! /^[a-f0-9]+$/.test(file.contentSha256)) throw new Error('Captured hook content hash unavailable');
  assertDenseEntries(file.moduleIds,MODULE_OWNERSHIP_LIMIT,true);
  for(const entries of [file.imports,file.dynamicImports,file.originalNames]) assertDenseEntries(entries,4096,true);
  referenceCount=assertReferenceCount([referenceCount,file.imports.length,file.dynamicImports.length]);
 }
 const files=input.map(file=> {
  for(const name of [...file.imports,...file.dynamicImports]) if(!names.has(name)) throw new Error('Unknown emitted hook reference');
  for(const id of file.moduleIds) if(!ids.has(id)) throw new Error('Unknown emitted module ownership');
  if(file.facadeModuleId!==null&&!ids.has(file.facadeModuleId)) throw new Error('Unknown facade module ownership');
  return Object.freeze({...file,imports:Object.freeze([...file.imports]),dynamicImports:Object.freeze([...file.dynamicImports]),moduleIds:Object.freeze([...file.moduleIds]),originalNames:Object.freeze([...file.originalNames])});
 });
 return Object.freeze({schemaVersion:1 as const,files:Object.freeze(files),modules:Object.freeze(modules.map(module=>Object.freeze({...module}))),referenceCount,qualification:false as const});
}
/** Only the future admitted Vite config invokes this factory/hook. */
export function createProductionBuildPlugin():Plugin {
 const admission=readIntegratedAdmission();let called=false;
 return {name:'copilot-production-owned-mappings',apply:'build',enforce:'post',
  generateBundle:{order:'post',handler(_options,bundle) {
   if(called) throw new Error('Production mapping hook is once-only');called=true;
   const modules:ModuleMapping[]=[];
   for(const id of this.getModuleIds()) {
    assertModuleOwnershipId(id,modules.length);
    const info=this.getModuleInfo(id);if(!info||info.id!==id||typeof info.code!=='string') throw new Error('Unmapped/external/not-ready module source');
    if(id.startsWith('\0')||id.startsWith('virtual:')) modules.push({id,kind:'virtual',external:false});
    else {
     const source=readPhysicalSource(id,admission.repositoryRoot);
     modules.push({id,kind:'physical',...source,external:false});
    }
   }
   const entries=Object.values(bundle);if(entries.length>LIMITS.files) throw new Error('Emitted output file bound');
   const files:HookFile[]=entries.map(entry=>entry.type==='chunk'?{
    contentSha256:createHash('sha256').update(entry.code).digest('hex'),fileName:entry.fileName,kind:'chunk',imports:[...entry.imports],dynamicImports:[...entry.dynamicImports],moduleIds:[...entry.moduleIds],originalNames:[],facadeModuleId:entry.facadeModuleId,
   }:{contentSha256:createHash('sha256').update(entry.source).digest('hex'),fileName:entry.fileName,kind:'asset',imports:[],dynamicImports:[],moduleIds:[],originalNames:[...entry.originalFileNames],facadeModuleId:null});
   const facts=projectHookFacts(files,modules),text=JSON.stringify(facts);
   if(Buffer.byteLength(text)>4*1024*1024) throw new Error('Mapping evidence byte bound');
   writeFileSync(join(admission.artifactDirectory,'build-mappings.json'),text+'\n',{flag:'wx'});
  }}};
}

export function readPhysicalSource(id:string,root:string):{path:string;sha256:string} {
 const original=id.split('?')[0]!,canonicalRoot=realpathSync(root),path=relative(canonicalRoot,original);
 if(!isAbsolute(original)||resolve(original)!==original||!ordinaryPath(path)) throw new Error('Module source escapes checkout');
 let ancestor=canonicalRoot;
 for(const part of path.split('/')) {ancestor=join(ancestor,part);if(lstatSync(ancestor).isSymbolicLink()) throw new Error('Original module source symlink denied');}
 if(realpathSync(original)!==original) throw new Error('Original module source ownership differs');
 const before=lstatSync(original);if(!before.isFile()||before.size>16*1024*1024) throw new Error('Module physical file bound');
 const raw=readFileSync(original),after=lstatSync(original);
 if(raw.byteLength!==before.size||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs) throw new Error('Module bytes changed');
 return {path,sha256:createHash('sha256').update(raw).digest('hex')};
}
