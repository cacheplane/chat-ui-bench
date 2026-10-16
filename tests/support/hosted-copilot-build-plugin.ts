/** Public build hook source; import has no Vite value or owned I/O. */
import type {Plugin} from 'vite';
import type {OutputOptions} from 'rolldown';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {assertDenseEntries,ordinaryPath,PRODUCTION_FILE_LIMITS,assertProductionCount} from './hosted-copilot-contract.ts';
import {assertMappings,assertCompilerProfile,assertCombinedModuleOwnershipCount,projectCompilerRuntimeModules,assertCompilerRuntimeOwnership,type CompilerRuntimeObservation,assertModuleOwnershipId,assertReferenceCount,classifyHookMetadata,MODULE_OWNERSHIP_LIMIT,type ModuleMapping} from './hosted-copilot-production-policy.ts';
import {readIntegratedAdmission} from './hosted-copilot-context.ts';
/** Explicit manual initial/syntax/diagram ESM treatment; each caller owns fresh option data. */
export function productionEsmOutputOptions():OutputOptions {
 return {strictExecutionOrder:true,codeSplitting:{groups:[
  {name:'production-initial',tags:['$initial'],priority:30,minSize:0,maxSize:262144,includeDependenciesRecursively:true},
  {name:'production-syntax-data',test:/(?:^|[\\/])node_modules[\\/]@shikijs[\\/](?:langs|themes)[\\/]/,priority:20,minSize:0,maxSize:262144,includeDependenciesRecursively:true,entriesAware:false},
  {name:'production-diagrams',test:/(?:^|[\\/])node_modules[\\/](?:mermaid[\\/]|@mermaid-js[\\/]parser[\\/])/,priority:10,minSize:0,maxSize:262144,includeDependenciesRecursively:true,entriesAware:false},
 ]}};
}
export interface HookFile {contentSha256?:string|undefined;fileName:string;kind:'chunk'|'asset';imports:readonly string[];dynamicImports:readonly string[];moduleIds:readonly string[];originalNames:readonly string[];facadeModuleId:string|null}
type IdDiagnostic=Readonly<{type:string;value:string|null;utf8Bytes:number|null;truncated:boolean}>;
type OwnershipSample=Readonly<{from:string;index?:number;id:IdDiagnostic}>;
type OwnershipDiagnostic=Readonly<{missingModuleOccurrences:number;missingFacadeOccurrences:number;moduleSamples:readonly OwnershipSample[];facadeSamples:readonly OwnershipSample[]}>;
type LookupSlot=Readonly<{category:'module'|'facade';sampleIndex:number;original:string|null;skipReason:'type'|'bound'|null}>;
function summarizeId(value:unknown,fullBytes:number,prefixUnits:number):IdDiagnostic {
 if(typeof value!=='string') return Object.freeze({type:value===null?'null':typeof value,value:null,utf8Bytes:null,truncated:false});
 const utf8Bytes=Buffer.byteLength(value);return Object.freeze({type:'string',value:utf8Bytes<=fullBytes?value:value.slice(0,prefixUnits),utf8Bytes,truncated:utf8Bytes>fullBytes});
}
function lookupSlot(category:LookupSlot['category'],sampleIndex:number,value:unknown):LookupSlot {
 const bounded=typeof value==='string'&&value.length>0&&value.length<=4096&&Buffer.byteLength(value)<=4096;
 return Object.freeze({category,sampleIndex,original:bounded?value:null,skipReason:bounded?null:typeof value==='string'?'bound':'type'});
}
function boundedErrorName(error:unknown):string {
 try {const name=(error as {name?:unknown}|null)?.name;return typeof name==='string'?name.slice(0,64):'Error';}catch{return 'Error';}
}
/** Private brand: only the strict ownership scan can create an enrichable denial. */
class OwnershipMismatch extends Error {
 readonly #slots:readonly LookupSlot[];
 readonly #diagnostic:OwnershipDiagnostic;
 readonly #prefix:string;
 constructor(prefix:string,diagnostic:OwnershipDiagnostic,slots:readonly LookupSlot[]) {
  super(prefix+' '+JSON.stringify(diagnostic));this.#prefix=prefix;this.#diagnostic=diagnostic;this.#slots=Object.freeze([...slots]);
 }
 enrich(lookup:(id:string)=>unknown):Error {
  const observations=this.#slots.map(slot=>{
   const base={category:slot.category,sampleIndex:slot.sampleIndex,external:null,externalAvailable:false};
   if(slot.original===null) return {...base,status:'skipped',skipReason:slot.skipReason,idMatches:null,codeType:null};
   try {
    const info=lookup(slot.original);
    if(info===null) return {...base,status:'missing',idMatches:null,codeType:null};
    if(typeof info!=='object'||info===null) throw new Error('Invalid module info');
    const {id,code} = info as {id?:unknown;code?:unknown};
    return {...base,status:'available',id:summarizeId(id,256,64),idMatches:id===slot.original,codeType:code===null?'null':code===undefined?'undefined':typeof code==='string'?'string':'other'};
   }catch(error){return {...base,status:'threw',idMatches:null,codeType:null,errorName:boundedErrorName(error)};}
  });
  // Four1024-ASCII owners + four512-byte IDs (at most6x JSON escaping),
  // four256-byte returned IDs and four64-unit names plus scalars stay below32KiB.
  // Formatting is informational: its failure must retain the original strict denial.
  try {
   const message=this.#prefix+' '+JSON.stringify({...this.#diagnostic,observations});
   return Buffer.byteLength(message)<32768?new Error(message):this;
  }catch{return this;}
 }
}
/** Pure supplied-callback observation; unrelated errors retain their identity. */
export function enrichOwnershipMismatch(error:Error,lookup:(id:string)=>unknown):Error {
 return error instanceof OwnershipMismatch?error.enrich(lookup):error;
}
function prepareHookFacts(input:readonly HookFile[],modules:readonly ModuleMapping[],suppliedProfile:unknown) {
 const compilerProfile=assertCompilerProfile(suppliedProfile);
 if(Array.isArray(input)) assertProductionCount('hook-files',input.length);
 assertDenseEntries(input,PRODUCTION_FILE_LIMITS.hookFiles);const names=new Set<string>();let referenceCount=0,runtimeReferenced=false;
 for(const file of input) {
  if(!ordinaryPath(file.fileName)||file.fileName.endsWith('.map')||names.has(file.fileName)||!['chunk','asset'].includes(file.kind)) throw new Error('Output file ownership unavailable');names.add(file.fileName);
  if(typeof file.contentSha256!=='string'||file.contentSha256.length!==64||! /^[a-f0-9]+$/.test(file.contentSha256)) throw new Error('Captured hook content hash unavailable');
  assertDenseEntries(file.moduleIds,MODULE_OWNERSHIP_LIMIT,true);
  runtimeReferenced ||= file.moduleIds.includes(compilerProfile.runtimeModuleId);
  for(const entries of [file.imports,file.dynamicImports,file.originalNames]) assertDenseEntries(entries,4096,true);
  referenceCount=assertReferenceCount([referenceCount,file.imports.length,file.dynamicImports.length]);
 }
 assertCombinedModuleOwnershipCount(modules,runtimeReferenced?1:0);assertMappings(modules);
 if(modules.some(module=>module.id===compilerProfile.runtimeModuleId))throw new Error('Compiler runtime appeared in source enumeration');
 const ids=new Set(modules.map(module=>module.id)),metadataReferences=classifyHookMetadata(input);
 let missingModuleOccurrences=0,missingFacadeOccurrences=0,firstPrefix='';
 const moduleSamples:OwnershipSample[]=[],facadeSamples:OwnershipSample[]=[],moduleSlots:LookupSlot[]=[],facadeSlots:LookupSlot[]=[];
 for(const file of input) {
  for(const [index,id] of file.moduleIds.entries()) if(!ids.has(id)&&!(file.kind==='chunk'&&id===compilerProfile.runtimeModuleId)) {
   missingModuleOccurrences++;firstPrefix||='Unknown emitted module ownership';
   if(moduleSamples.length<2) {moduleSlots.push(lookupSlot('module',moduleSamples.length,id));moduleSamples.push(Object.freeze({from:file.fileName,index,id:summarizeId(id,512,128)}));}
  }
  if(file.facadeModuleId!==null&&!ids.has(file.facadeModuleId)) {
   missingFacadeOccurrences++;firstPrefix||='Unknown facade module ownership';
   if(facadeSamples.length<2) {facadeSlots.push(lookupSlot('facade',facadeSamples.length,file.facadeModuleId));facadeSamples.push(Object.freeze({from:file.fileName,id:summarizeId(file.facadeModuleId,512,128)}));}
  }
 }
 if(firstPrefix) throw new OwnershipMismatch(firstPrefix,Object.freeze({missingModuleOccurrences,missingFacadeOccurrences,moduleSamples:Object.freeze(moduleSamples),facadeSamples:Object.freeze(facadeSamples)}),[...moduleSlots,...facadeSlots]);
 return {compilerProfile,runtimeReferenced,metadataReferences,referenceCount};
}
export function projectHookFacts(input:readonly HookFile[],modules:readonly ModuleMapping[],suppliedProfile:unknown,runtimeObservations:unknown) {
 if(!Array.isArray(runtimeObservations))throw new Error('Compiler runtime observations absent');
 assertDenseEntries(runtimeObservations,1,true);assertCombinedModuleOwnershipCount(modules,runtimeObservations.length);
 const prepared=prepareHookFacts(input,modules,suppliedProfile);
 return finishHookFacts(input,modules,prepared,runtimeObservations);
}
function finishHookFacts(input:readonly HookFile[],modules:readonly ModuleMapping[],prepared:ReturnType<typeof prepareHookFacts>,runtimeObservations:unknown) {
 const declared=projectCompilerRuntimeModules(prepared.compilerProfile,runtimeObservations);
 const {compilerProfile,compilerRuntimeModules}=assertCompilerRuntimeOwnership(input,modules,prepared.compilerProfile,declared);
 const files=input.map(file=> {
  return Object.freeze({...file,imports:Object.freeze([...file.imports]),dynamicImports:Object.freeze([...file.dynamicImports]),moduleIds:Object.freeze([...file.moduleIds]),originalNames:Object.freeze([...file.originalNames])});
 });
 return Object.freeze({schemaVersion:3 as const,files:Object.freeze(files),modules:Object.freeze(modules.map(module=>Object.freeze({...module}))),compilerProfile,compilerRuntimeModules,metadataReferences:prepared.metadataReferences,metadataOccurrenceCount:prepared.referenceCount,qualification:false as const});
}
/** Pure supplied callback observation; data alone does not authenticate native authority. */
export function observeCompilerRuntimeModule(suppliedProfile:unknown,referenced:boolean,lookup:(id:string)=>unknown):readonly Readonly<CompilerRuntimeObservation>[] {
 const profile=assertCompilerProfile(suppliedProfile);
 if(!referenced)return Object.freeze([]);
 let moduleInfo:unknown;try{moduleInfo=lookup(profile.runtimeModuleId);}catch{throw new Error('Compiler runtime module info lookup failed');}
 if(moduleInfo!==null)throw new Error('Compiler runtime module info must be null');
 return Object.freeze([Object.freeze({id:profile.runtimeModuleId,moduleInfo:null})]);
}
/** Pure callback seam. Preparation preserves V6 denial precedence before reserved lookup. */
export function projectHookFactsWithRuntimeLookup(input:readonly HookFile[],modules:readonly ModuleMapping[],suppliedProfile:unknown,lookup:(id:string)=>unknown) {
 const prepared=prepareHookFacts(input,modules,suppliedProfile);
 const observations=observeCompilerRuntimeModule(prepared.compilerProfile,prepared.runtimeReferenced,lookup);
 return finishHookFacts(input,modules,prepared,observations);
}
/** Only the future admitted Vite config invokes this factory/hook. */
export function createProductionBuildPlugin(options:{compilerProfile:unknown}):Plugin {
 const compilerProfile=assertCompilerProfile(options.compilerProfile);
 const admission=readIntegratedAdmission();let called=false;
 return {name:'copilot-production-owned-mappings',apply:'build',enforce:'post',
  generateBundle:{order:'post',handler(_options,bundle) {
   if(called) throw new Error('Production mapping hook is once-only');called=true;
   const modules:ModuleMapping[]=[];
   for(const id of this.getModuleIds()) {
    assertModuleOwnershipId(id,modules.length);
    if(id===compilerProfile.runtimeModuleId)throw new Error('Compiler runtime appeared in source enumeration');
    const info=this.getModuleInfo(id);if(!info||info.id!==id||typeof info.code!=='string') throw new Error('Unmapped/external/not-ready module source');
    if(id.startsWith('\0')||id.startsWith('virtual:')) modules.push({id,kind:'virtual',external:false});
    else {
     const source=readPhysicalSource(id,admission.repositoryRoot);
     modules.push({id,kind:'physical',...source,external:false});
    }
   }
   assertProductionCount('hook-files',Object.keys(bundle).length);
   const entries=Object.values(bundle);
   const files:HookFile[]=entries.map(entry=>entry.type==='chunk'?{
    contentSha256:createHash('sha256').update(entry.code).digest('hex'),fileName:entry.fileName,kind:'chunk',imports:[...entry.imports],dynamicImports:[...entry.dynamicImports],moduleIds:[...entry.moduleIds],originalNames:[],facadeModuleId:entry.facadeModuleId,
   }:{contentSha256:createHash('sha256').update(entry.source).digest('hex'),fileName:entry.fileName,kind:'asset',imports:[],dynamicImports:[],moduleIds:[],originalNames:[...entry.originalFileNames],facadeModuleId:null});
   let facts:ReturnType<typeof projectHookFacts>;
   try {facts=projectHookFactsWithRuntimeLookup(files,modules,compilerProfile,id=>this.getModuleInfo(id));}catch(error){
    if(error instanceof OwnershipMismatch) throw enrichOwnershipMismatch(error,id=>this.getModuleInfo(id));
    throw error;
   }
   const text=JSON.stringify(facts);
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
