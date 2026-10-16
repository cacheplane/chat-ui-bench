/** Supplied AST/data and explicit compiler-info observations only.
 * Never imports a parser, compiler, SDK or worker. */
import {createHash} from 'node:crypto';
import {assertProductionOutputInventory,PRODUCTION_FILE_LIMITS,type FileFact} from './hosted-copilot-contract.ts';
import {assertModuleOwnershipId,assertMappings,MODULE_OWNERSHIP_LIMIT,type ModuleMapping} from './hosted-copilot-production-policy.ts';
import {MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_MODULE_BUILTINS,MOUNTED_POLICY_LIMITS,type NativeImport} from './hosted-copilot-mounted-policy.ts';
/** Diagnostic formatting only; no resolution, coercion or policy decision. */
export function formatWorkerPublicResolutionDiagnostic(specifier:unknown,expectedPackagePath:unknown,workerParentUrl:unknown,resolvedEntryPath:unknown):string {
 const unavailable='{"workerPublicResolutionDiagnostic":{"status":"unavailable","reason":"invalid-or-oversized-input"}}';
 const primitive=(value:unknown,maximum:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=maximum&&/^[\x20-\x7e]+$/.test(value)&&Buffer.byteLength(value,'utf8')<=maximum;
 if(!primitive(specifier,128)||!primitive(expectedPackagePath,256)||!primitive(workerParentUrl,1024)||!primitive(resolvedEntryPath,4096))return unavailable;
 const line=JSON.stringify({workerPublicResolutionDiagnostic:{status:'observed',specifier,expectedPackagePath,workerParentUrl,resolvedEntryPath}});
 return Buffer.byteLength(line,'utf8')<=16384?line:unavailable;
}
export function createWorkerImporterDiagnostic(): {
 observe(id:unknown,parent:unknown,resolved:unknown,allowed:unknown):void;
 snapshot():WorkerCallbackSnapshot;
 rethrow(error:unknown,id:unknown,emit:(line:string)=>void):never;
} {
 // Diagnostic transport only. These are original callback observations, not
 // emitted ownership or a complete importer graph. No compiler API is called.
 const observations: {parent: {status:string;sha256?:string;preview?:string;byteLength?:number;exactRuntimeMarkerMatch?:boolean};isResolved:boolean|'invalid';returnedAllowed:boolean|'invalid'}[]=[];
 const full:WorkerCallbackObservation[]=[];
 let omitted=false;
 return Object.freeze({
  observe(id:unknown,parent:unknown,resolved:unknown,allowed:unknown):void {
   if(id!=='node:module')return;
   if(observations.length===8){omitted=true;return;}
   try {
    let fact:{status:string;sha256?:string;preview?:string;byteLength?:number;exactRuntimeMarkerMatch?:boolean};
    if(parent===undefined)fact={status:'absent'};
    else if(parent===null)fact={status:'null'};
    else if(typeof parent!=='string')fact={status:'invalid'};
    else if(parent.length>4096||Buffer.byteLength(parent,'utf8')>4096)fact={status:'bound'};
    else fact={status:'valid',sha256:createHash('sha256').update(parent).digest('hex'),preview:parent.slice(0,96),byteLength:Buffer.byteLength(parent,'utf8'),exactRuntimeMarkerMatch:parent==='\0rolldown/runtime.js'};
    observations.push(Object.freeze({parent:Object.freeze(fact),isResolved:typeof resolved==='boolean'?resolved:'invalid',returnedAllowed:typeof allowed==='boolean'?allowed:'invalid'}));
    full.push(Object.freeze({parent:fact.status==='valid'?parent as string:null,parentStatus:fact.status,isResolved:typeof resolved==='boolean'?resolved:'invalid',returnedAllowed:typeof allowed==='boolean'?allowed:'invalid'}));
   } catch {omitted=true;} // Observation failure cannot change externalization.
  },
  snapshot():WorkerCallbackSnapshot {
   return Object.freeze({target:'node:module',scope:'original external callback observations only',observations:Object.freeze(full.map(row=>Object.freeze({...row}))),omitted,
    callbackCountKnown:!omitted,retainedCallbackCount:full.length,complete:!omitted});
  },
  rethrow(error:unknown,id:unknown,emit:(line:string)=>void):never {
   if(id==='node:module')try {
    // Never inspect the thrown value, code, ast, or arbitrary module members.
    const line=JSON.stringify({workerImporterDiagnostic:{target:'node:module',scope:'original external callback observations only',codeObservation:'see original refusal',observations,omitted,callbackCountKnown:!omitted,retainedCallbackCount:observations.length,complete:!omitted}})+'\n';
    if(Buffer.byteLength(line,'utf8')<=16384)emit(line);
   } catch {/* Best effort only; retain the exact original failure below. */}
   throw error;
  }
 });
}
type Row=Record<string,unknown>;
type WorkerImport=Readonly<Pick<NativeImport,'specifier'>&{kind:'static'|'dynamic-literal'}>;
function deny(message:string):never {throw new Error(message);}
/** Fixed loader-free ES generation profile; callers cannot supply overrides. */
export function workerStaticOutputOptions(){
 return Object.freeze({format:'es' as const,codeSplitting:false as const,entryFileNames:'worker.mjs',sourcemap:false as const,minify:false as const,strictExecutionOrder:true as const,polyfillRequire:false as const});
}
/** Observe normalized public compiler scalars, without coercion or value echo. */
export function observeWorkerOutputPolicy(format:unknown,polyfillRequire:unknown){
 if(format!=='es'||polyfillRequire!==false)return deny('Worker output policy denied');
 return Object.freeze({format:'es' as const,polyfillRequire:false as const});
}
/** Fixed successful-report projection; accessors and additional keys are denied. */
export function readWorkerOutputPolicy(value:unknown){
 const row=data(value,'Worker output policy denied');
 if(Reflect.ownKeys(row).length!==2)return deny('Worker output policy denied');
 return observeWorkerOutputPolicy(own(row,'format','Worker output policy denied'),own(row,'polyfillRequire','Worker output policy denied'));
}
/** Exact configured externals are identified by this build's prior callback
 * decision, never by a code-null sentinel. An external code getter is not read.
 * Other modules still require one string-code observation, then the caller's
 * unchanged physical/virtual and final emitted-chunk ownership checks. */
function observeWorkerSource(id:unknown,index:unknown,info:unknown,requestedExternal:unknown){
 const requested=requestedExternal===true;let allowed=false,idMatches=false,codeKind='not-read';
 const fail=():never=>{
  // Only primitive facts are serialized. No module code, error, toJSON or
  // string coercion is used; even invalid caller IDs have bounded work/output.
  const boundedId=typeof id==='string'&&id.length<=4096&&Buffer.byteLength(id,'utf8')<=4096;
  const facts={idSha256:boundedId?createHash('sha256').update(id).digest('hex'):null,idPreview:typeof id==='string'?id.slice(0,96):null,
   codeKind,allowed,requested,index:typeof index==='number'&&Number.isSafeInteger(index)&&index>=0&&index<MODULE_OWNERSHIP_LIMIT?index:null,idMatches};
  return deny('Worker module source denied: '+JSON.stringify(facts));
 };
 if(typeof index!=='number'||!Number.isSafeInteger(index)||index<0||index>=MODULE_OWNERSHIP_LIMIT)return fail();
 try{assertModuleOwnershipId(id,index);}catch{return fail();}
 allowed=Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,id)||MOUNTED_MODULE_BUILTINS.includes(id);
 if(typeof requestedExternal!=='boolean'||info===null||typeof info!=='object')return fail();
 try{const descriptor=Object.getOwnPropertyDescriptor(info,'id');idMatches=Boolean(descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.value===id);}catch{return fail();}
 if(!idMatches)return fail();
 if(allowed&&requested)return {id,index,codeKind,allowed,requested,fail};
 let code:unknown;try{code=Reflect.get(info,'code');}catch{codeKind='getter-threw';return fail();}
 codeKind=code===null?'null':typeof code;
 return {id,index,codeKind,allowed,requested,fail};
}
export function classifyWorkerModuleSource(id:unknown,index:unknown,info:unknown,requestedExternal:unknown):'configured-external'|'owned'{
 const observation=observeWorkerSource(id,index,info,requestedExternal);
 if(observation.allowed&&observation.requested)return 'configured-external';
 if(observation.codeKind!=='string')return observation.fail();
 return 'owned';
}
/** Actual code is observed once here, before the whole graph is authorized.
 * Null is retained only for the exact prospective dependency; it is not owned. */
export function observeWorkerRegisteredModule(id:unknown,index:unknown,info:unknown,requestedExternal:unknown){
 const {fail,...facts}=observeWorkerSource(id,index,info,requestedExternal);
 if(facts.allowed&&facts.requested)return {...facts,role:'configured-external' as const};
 if(id==='node:module'){
  if(facts.codeKind!=='null'||facts.allowed||facts.requested)return fail();
  if(own(info as Row,'isEntry',graphDenied)!==false)return fail();
  if(own(info as Row,'inputFormat',graphDenied)!=='unknown')return fail();
  return {...facts,role:'compiler-registered-dependency' as const,isEntry:false,inputFormat:'unknown'};
 }
 if(facts.codeKind==='string')return {...facts,role:'normal-source' as const,
  importedIds:own(info as Row,'importedIds',graphDenied),dynamicallyImportedIds:own(info as Row,'dynamicallyImportedIds',graphDenied)};
 return fail();
}
function data(value:unknown,message:string):Row {
 if(value===null||typeof value!=='object'||Array.isArray(value))return deny(message);
 const prototype=Object.getPrototypeOf(value);
 if(prototype!==Object.prototype&&prototype!==null)return deny(message);
 return value as Row;
}
function own(value:Row,key:string,message:string):unknown {
 const d=Object.getOwnPropertyDescriptor(value,key);
 if(d&&!Object.hasOwn(d,'value'))return deny(message);
 return d?.value;
}
type WorkerCallbackObservation=Readonly<{parent:string|null;parentStatus:string;isResolved:boolean|'invalid';returnedAllowed:boolean|'invalid'}>;
type WorkerCallbackSnapshot=Readonly<{target:'node:module';scope:'original external callback observations only';observations:readonly WorkerCallbackObservation[];omitted:boolean;callbackCountKnown:boolean;retainedCallbackCount:number;complete:boolean}>;
const graphDenied='Worker registered graph denied';
function closed(value:unknown,keys:readonly string[]):Row {
 const row=data(value,graphDenied),actual=Reflect.ownKeys(row);
 if(actual.length!==keys.length||!keys.every(key=>Object.hasOwn(row,key)))deny(graphDenied);
 for(const key of keys)own(row,key,graphDenied);
 return row;
}
function arrayLength(value:unknown,cap:number):number {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)deny(graphDenied);
 const length=Object.getOwnPropertyDescriptor(value,'length');
 if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<0||length.value>cap)deny(graphDenied);
 return length.value as number;
}
function element(value:unknown,index:number):unknown {
 const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
 if(!descriptor||!Object.hasOwn(descriptor,'value'))deny(graphDenied);
 return descriptor.value;
}
function graphId(value:unknown):string {
 // Character preflight precedes UTF8 scanning, hashing and lookup.
 if(typeof value!=='string'||value.length===0||value.length>4096)deny(graphDenied);
 if(Buffer.byteLength(value,'utf8')>4096)deny(graphDenied);
 return value;
}
/** Capture complete normal relations before filesystem hashing; shared work
 * includes the already reserved complete registered cohort. */
export function observeWorkerResolvedRelations(imported:unknown,dynamic:unknown,usedWork:number){
 if(!Number.isSafeInteger(usedWork)||usedWork<0||usedWork>MODULE_OWNERSHIP_LIMIT)deny(graphDenied);
 const importedLength=arrayLength(imported,4096),dynamicLength=arrayLength(dynamic,4096),work=usedWork+importedLength+dynamicLength;
 if(work>MODULE_OWNERSHIP_LIMIT)deny(graphDenied);
 const read=(value:unknown,count:number)=>{
  denseKeys(value,count);const copy:string[]=[];
  for(let i=0;i<count;i++){const id=graphId(element(value,i));if(id==='node:module')deny(graphDenied);copy.push(id);}
  return Object.freeze(copy);
 };
 const importedIds=read(imported,importedLength),dynamicallyImportedIds=read(dynamic,dynamicLength);
 return Object.freeze({importedIds,dynamicallyImportedIds,work});
}
function denseKeys(value:unknown,length:number):void {
 if(Reflect.ownKeys(value as object).length!==length+1)deny(graphDenied);
}
function literalProfile(value:unknown,expected:Row):Readonly<Row> {
 const row=closed(value,Object.keys(expected)),copy:Row={};
 for(const key of Object.keys(expected)){if(own(row,key,graphDenied)!==expected[key])deny(graphDenied);copy[key]=expected[key];}
 return Object.freeze(copy);
}
export const WORKER_STATIC_COMPONENT_PATHS=Object.freeze(['tools/hosted-copilot-worker-static.mjs','tests/support/hosted-copilot-worker-static-policy.ts',
 'tests/support/hosted-copilot-build-plugin.ts','tests/support/hosted-copilot-production-policy.ts','tests/support/hosted-copilot-mounted-policy.ts',
 'tests/support/hosted-copilot-contract.ts','tests/support/hosted-copilot-context.ts']);
/** Compare reports only against the caller's actual physical fixed components. */
export function assertWorkerComponentPins(physical:unknown,reported:unknown):void {
 const read=(value:unknown)=>{
  const count=arrayLength(value,WORKER_STATIC_COMPONENT_PATHS.length);if(count!==WORKER_STATIC_COMPONENT_PATHS.length)deny('Worker component pins differ');denseKeys(value,count);
  const pins=[];
  for(let i=0;i<count;i++){
   const row=closed(element(value,i),['path','bytes','sha256']),path=own(row,'path',graphDenied),bytes=own(row,'bytes',graphDenied),sha256=own(row,'sha256',graphDenied);
   if(path!==WORKER_STATIC_COMPONENT_PATHS[i]||typeof bytes!=='number'||!Number.isSafeInteger(bytes)||bytes<1||bytes>4*1024*1024||typeof sha256!=='string'||!(/^[a-f0-9]{64}$/.test(sha256)))deny('Worker component pins differ');
   pins.push({path,bytes,sha256});
  }
  return pins;
 };
 if(JSON.stringify(read(physical))!==JSON.stringify(read(reported)))deny('Worker component pins differ');
}
function readWorkerCallbackSnapshot(input:unknown):WorkerCallbackSnapshot {
 const raw=closed(input,['target','scope','observations','omitted','callbackCountKnown','retainedCallbackCount','complete']);
 for(const [key,value] of Object.entries({target:'node:module',scope:'original external callback observations only',omitted:false,callbackCountKnown:true,complete:true}))if(own(raw,key,graphDenied)!==value)deny(graphDenied);
 const values=own(raw,'observations',graphDenied),count=arrayLength(values,8);denseKeys(values,count);
 if(own(raw,'retainedCallbackCount',graphDenied)!==count)deny(graphDenied);
 const observations:WorkerCallbackObservation[]=[];
 for(let i=0;i<count;i++){
  const row=closed(element(values,i),['parent','parentStatus','isResolved','returnedAllowed']);
  if(own(row,'parent',graphDenied)!=='\0rolldown/runtime.js'||own(row,'parentStatus',graphDenied)!=='valid'||own(row,'isResolved',graphDenied)!==false||own(row,'returnedAllowed',graphDenied)!==false)deny(graphDenied);
  observations.push(Object.freeze({parent:'\0rolldown/runtime.js',parentStatus:'valid',isResolved:false,returnedAllowed:false}));
 }
 return Object.freeze({target:'node:module',scope:'original external callback observations only',observations:Object.freeze(observations),omitted:false,callbackCountKnown:true,retainedCallbackCount:count,complete:true});
}
/** Compare complete bounded observations at the hook, generate and close
 * boundaries; later lifetime claims are outside this STATIC scope. */
export function assertWorkerCallbackSnapshotStable(hook:unknown,settled:unknown):void {
 const original=readWorkerCallbackSnapshot(hook),current=readWorkerCallbackSnapshot(settled);
 if(original.retainedCallbackCount!==current.retainedCallbackCount)deny('Worker callback observations changed');
}
/** Original generation and close each settle once before acceptance. Preserve
 * every primary throw, including null/undefined, without inspecting it. */
export async function settleWorkerStaticGeneration<T>(generate:()=>Promise<T>,close:()=>Promise<unknown>,assertStable:()=>void):Promise<T>{
 let generated:T|undefined,primary:unknown,failed=false;
 try{generated=await generate();assertStable();}catch(error){failed=true;primary=error;}
 finally{try{await close();}catch(error){if(!failed){failed=true;primary=error;}}}
 if(failed)throw primary;
 assertStable();return generated as T;
}
export function readWorkerChunkMetadata(input:unknown){
 const chunk=closed(input,['kind','fileName','format','isEntry','moduleIds','facadeModuleId','bytes','sha256']);
 for(const [key,value] of Object.entries({kind:'chunk',fileName:'worker.mjs',format:'es',isEntry:true}))if(own(chunk,key,graphDenied)!==value)deny(graphDenied);
 const members=own(chunk,'moduleIds',graphDenied),count=arrayLength(members,MODULE_OWNERSHIP_LIMIT);denseKeys(members,count);
 const moduleIds:string[]=[],seen=new Set<string>();
 for(let i=0;i<count;i++){const id=graphId(element(members,i));if(id==='node:module'||seen.has(id))deny(graphDenied);seen.add(id);moduleIds.push(id);}
 const rawFacade=own(chunk,'facadeModuleId',graphDenied),facadeModuleId=rawFacade===null?null:graphId(rawFacade);
 if(facadeModuleId==='node:module')deny(graphDenied);
 const bytes=own(chunk,'bytes',graphDenied),sha256=own(chunk,'sha256',graphDenied);
 if(typeof bytes!=='number'||!Number.isSafeInteger(bytes)||bytes<1||bytes>16*1024*1024||typeof sha256!=='string'||!(/^[a-f0-9]{64}$/.test(sha256)))deny(graphDenied);
 return Object.freeze({kind:'chunk' as const,fileName:'worker.mjs' as const,format:'es' as const,isEntry:true as const,moduleIds:Object.freeze(moduleIds),facadeModuleId,bytes,sha256});
}
export function assertWorkerChunkMetadataStable(hook:unknown,final:unknown):void {
 if(JSON.stringify(readWorkerChunkMetadata(hook))!==JSON.stringify(readWorkerChunkMetadata(final)))deny('Worker generated metadata changed');
}
/** Replay validates complete producer observations, not a fresh native graph.
 * Every accepted object/array is a fresh, closed, frozen JSON-safe projection. */
export function validateWorkerRegisteredGraph(input:unknown){
 const root=closed(input,['compilerProfile','buildProfile','workerOutputPolicy','rows','callbacks','chunks','counts']);
 const compilerProfile=literalProfile(own(root,'compilerProfile',graphDenied),{provider:'rolldown',version:'1.2.13',runtimeModuleId:'\0rolldown/runtime.js'});
 const buildProfile=literalProfile(own(root,'buildProfile',graphDenied),{entry:'apps/copilotkit/hosted-native-entry.ts',platform:'node',tsconfig:false,hmr:false,userResolverPlugins:false});
 const workerOutputPolicy=readWorkerOutputPolicy(own(root,'workerOutputPolicy',graphDenied));
 const supplied=own(root,'rows',graphDenied),length=arrayLength(supplied,MODULE_OWNERSHIP_LIMIT);denseKeys(supplied,length);
 let work=length,relations=0,normalSources=0,configuredExternals=0,compilerRegisteredDependencies=0;
 const ids=new Set<string>(),normalIds=new Set<string>();
 const rows:Readonly<Row>[]=[];
 for(let i=0;i<length;i++){
  const raw=data(element(supplied,i),graphDenied),id=graphId(own(raw,'id',graphDenied)),role=own(raw,'role',graphDenied);
  if(ids.has(id)||id==='\0rolldown/runtime.js'||own(raw,'index',graphDenied)!==i)deny(graphDenied);ids.add(id);
  const allowed=Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,id)||MOUNTED_MODULE_BUILTINS.includes(id),requested=own(raw,'requested',graphDenied);
  if(typeof requested!=='boolean'||own(raw,'allowed',graphDenied)!==allowed)deny(graphDenied);
  const common=['id','index','role','codeKind','allowed','requested'],base={index:i,id,role,codeKind:own(raw,'codeKind',graphDenied),allowed,requested};
  if(role==='configured-external'){
   closed(raw,common);if(!allowed||!requested||base.codeKind!=='not-read')deny(graphDenied);configuredExternals++;rows.push(Object.freeze(base));
  }else if(role==='normal-source'){
   closed(raw,[...common,'source','importedIds','dynamicallyImportedIds']);if(id==='node:module'||allowed&&requested||base.codeKind!=='string')deny(graphDenied);
   const sourceValue=data(own(raw,'source',graphDenied),graphDenied),kind=own(sourceValue,'kind',graphDenied);
   closed(sourceValue,kind==='physical'?['id','kind','external','path','sha256']:['id','kind','external']);
   const source=Object.fromEntries(Object.keys(sourceValue).map(key=>[key,own(sourceValue,key,graphDenied)])) as unknown as ModuleMapping;
   if(source.id!==id)deny(graphDenied);assertMappings([source]);
   const resolved=observeWorkerResolvedRelations(own(raw,'importedIds',graphDenied),own(raw,'dynamicallyImportedIds',graphDenied),work);
   relations+=resolved.work-work;work=resolved.work;const {importedIds,dynamicallyImportedIds}=resolved;
   normalSources++;normalIds.add(id);rows.push(Object.freeze({...base,source:Object.freeze(source),importedIds,dynamicallyImportedIds}));
  }else if(role==='compiler-registered-dependency'){
   closed(raw,[...common,'isEntry','inputFormat']);
   if(id!=='node:module'||allowed||requested||base.codeKind!=='null'||own(raw,'isEntry',graphDenied)!==false||own(raw,'inputFormat',graphDenied)!=='unknown')deny(graphDenied);
   compilerRegisteredDependencies++;rows.push(Object.freeze({...base,isEntry:false,inputFormat:'unknown'}));
  }else deny(graphDenied);
 }
 const callbacks=readWorkerCallbackSnapshot(own(root,'callbacks',graphDenied));
 if(compilerRegisteredDependencies===1&&callbacks.retainedCallbackCount===0||compilerRegisteredDependencies===0&&callbacks.retainedCallbackCount!==0)deny(graphDenied);
 const chunkValues=own(root,'chunks',graphDenied);if(arrayLength(chunkValues,1)!==1)deny(graphDenied);denseKeys(chunkValues,1);
 const chunk=readWorkerChunkMetadata(element(chunkValues,0));
 for(const id of chunk.moduleIds)if(!normalIds.has(id)&&id!=='\0rolldown/runtime.js')deny(graphDenied);
 if(chunk.facadeModuleId!==null&&!normalIds.has(chunk.facadeModuleId))deny(graphDenied);
 const chunks=Object.freeze([chunk]);
 const counts=literalProfile(own(root,'counts',graphDenied),{registeredRows:length,normalSources,configuredExternals,compilerRegisteredDependencies,relations,work});
 return Object.freeze({compilerProfile,buildProfile,workerOutputPolicy,rows:Object.freeze(rows),callbacks,chunks,counts});
}
const importDenied='Worker module import denied',loaderDenied='Worker loader form denied',astDenied='Worker AST data denied';
const loaderNames=new Set(['require','createRequire','eval','Function','importScripts','Worker','SharedWorker']);
const regexpSource=Object.getOwnPropertyDescriptor(RegExp.prototype,'source')!.get!;
const regexpFlags=Object.entries({d:'hasIndices',g:'global',i:'ignoreCase',m:'multiline',s:'dotAll',u:'unicode',v:'unicodeSets',y:'sticky'})
 .map(([flag,name])=>({flag,get:Object.getOwnPropertyDescriptor(RegExp.prototype,name)!.get!}));
/** Rolldown's JSON-AST fixup puts a native RegExp in Literal.value. Inspect
 * native internal slots only, never overridden source/flags property getters. */
function checkedRegExp(value:object,metadata:unknown):boolean {
 try{
  if(Object.getPrototypeOf(value)!==RegExp.prototype||Reflect.ownKeys(value).length!==1)return false;
  const last=Object.getOwnPropertyDescriptor(value,'lastIndex');if(!last||!Object.hasOwn(last,'value')||last.value!==0)return false;
  const regex=data(metadata,astDenied);if(Reflect.ownKeys(regex).length!==2)return false;
  const pattern=own(regex,'pattern',astDenied),flags=own(regex,'flags',astDenied);
  if(typeof pattern!=='string'||typeof flags!=='string'||flags.length>regexpFlags.length||new Set(flags).size!==flags.length||[...flags].some(f=>!regexpFlags.some(r=>r.flag===f)))return false;
  return regexpSource.call(value)===pattern&&regexpFlags.filter(r=>r.get.call(value)).map(r=>r.flag).join('')===regexpFlags.filter(r=>flags.includes(r.flag)).map(r=>r.flag).join('');
 }catch{return false;}
}
function neutralIdentifier(parent:Row|null,key:string):boolean {
 if(!parent)return false;
 const type=parent.type;if(typeof type!=='string')return false;
 if((parent.type==='MemberExpression'||parent.type==='OptionalMemberExpression')&&key==='property'&&parent.computed===false)return true;
 if((parent.type==='Property'||parent.type==='PropertyDefinition'||parent.type==='MethodDefinition')&&key==='key'&&parent.computed!==true&&parent.shorthand!==true)return true;
 if(key==='id'&&['VariableDeclarator','FunctionDeclaration','FunctionExpression','ClassDeclaration','ClassExpression'].includes(type))return true;
 if(['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(type))return true;
 return parent.type==='ExportSpecifier'&&key==='exported';
}
/** Same full-tree depth256/visit500000 limits as assertParserTreeBounds.
 * This finite loader policy is not a general reflective-JavaScript sandbox. */
export function collectWorkerModuleImports(ast:unknown):readonly WorkerImport[] {
 const output:WorkerImport[]=[],stack:{value:unknown;depth:number;parent:Row|null;key:string}[]=[{value:ast,depth:1,parent:null,key:''}];let visits=0;
 while(stack.length){
  const entry=stack.pop()!;
  if(entry.depth>256||++visits>500000)deny('Parser tree bound');
  const v=entry.value;if(v===null||typeof v!=='object')continue;
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);
  if(prototype!==(array?Array.prototype:Object.prototype)&&!(prototype===null&&!array))deny(astDenied);
  const keys=Reflect.ownKeys(v);if(keys.length>500000)deny('Parser tree bound');
  const values=new Map<string,unknown>();
  for(const key of keys){
   if(typeof key!=='string')deny(astDenied);
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))deny(astDenied);
   values.set(key,d.value);
  }
  if(array){
   const length=values.get('length');
   if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||keys.length!==length+1)deny(astDenied);
   for(let i=length-1;i>=0;i--){if(!values.has(String(i)))deny(astDenied);const child=values.get(String(i));if(child!==null&&typeof child==='object')stack.push({value:child,depth:entry.depth+1,parent:null,key:String(i)});}
   continue;
  }
  // Copy descriptors before interpreting node fields; supplied getters never run.
  const n=Object.fromEntries(values) as Row;
  if(n.type!==undefined&&typeof n.type!=='string')deny(astDenied);
  if(n.type==='Identifier'&&typeof n.name!=='string')deny(astDenied);
  if(n.type==='ImportDeclaration'||n.type==='ImportExpression'||(n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration')&&n.source!=null){
   for(const key of ['attributes','assertions'])if(n[key]!=null&&(!Array.isArray(n[key])||n[key].length!==0))deny(importDenied);
   if(n.options!=null||n.phase!=null)deny(importDenied);
   const source=data(n.source,importDenied),specifier=own(source,'value',importDenied);
   if(own(source,'type',importDenied)!=='Literal'||typeof specifier!=='string'||(!Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,specifier)&&!MOUNTED_MODULE_BUILTINS.includes(specifier)))deny(importDenied);
   if(output.length>=MOUNTED_POLICY_LIMITS.imports)deny('Worker import occurrence overflow');
   output.push(Object.freeze({specifier,kind:n.type==='ImportExpression'?'dynamic-literal':'static'}));
  }else if(n.type==='ImportAttribute'||n.type==='ImportExpression'||n.type==='ImportDeclaration')deny(importDenied);
  if(n.type==='Identifier'&&typeof n.name==='string'&&loaderNames.has(n.name)&&!neutralIdentifier(entry.parent,entry.key))deny(loaderDenied);
  if(n.type==='MemberExpression'||n.type==='OptionalMemberExpression'){
   const object=data(n.object,astDenied),property=data(n.property,astDenied);
   const objectType=own(object,'type',astDenied),propertyType=own(property,'type',astDenied);
   if(typeof objectType!=='string'||typeof propertyType!=='string'||typeof n.computed!=='boolean')deny(astDenied);
   const name=objectType==='Identifier'?own(object,'name',astDenied):null;
   if(objectType==='Identifier'&&typeof name!=='string')deny(astDenied);
   const root=typeof name==='string'?name:null,meta=objectType==='MetaProperty';
   let key:string|null=null;
   if(n.computed){const value=propertyType==='Literal'?own(property,'value',astDenied):null;if(typeof value==='string')key=value;}
   else {const value=own(property,'name',astDenied);if(typeof value!=='string')deny(astDenied);key=value;}
   if(((root!==null&&['module','process','globalThis','global'].includes(root))||meta)&&key===null)deny(loaderDenied);
   if(root==='module'&&key==='require'||root==='require'&&key==='resolve'||root==='process'&&key!==null&&['getBuiltinModule','dlopen','binding','_linkedBinding','mainModule'].includes(key)||
    (root==='globalThis'||root==='global')&&key!==null&&[...loaderNames,'process','module'].includes(key)||meta&&key==='resolve')deny(loaderDenied);
  }
  const children=[...values.entries()].filter(([key,child])=>{
   if(child===null||typeof child!=='object')return false;
   if(n.type==='Literal'&&key==='value'&&Object.getPrototypeOf(child)===RegExp.prototype){if(!checkedRegExp(child,n.regex))deny(astDenied);return false;}
   return true;
  });
  for(let i=children.length-1;i>=0;i--){const [key,child]=children[i]!;stack.push({value:child,depth:entry.depth+1,parent:n,key});}
 }
 return Object.freeze(output);
}
/** Required same-job supplied receipt/report fields only, not peer qualification. */
export function assertWorkerFrontendPrerequisite(sourceSha:string,receipt:unknown,staticReport:unknown):void {
 const message='Worker frontend prerequisite denied';
 try{
  if(!/^[a-f0-9]{40}$/.test(sourceSha))deny(message);
  const r=data(receipt,message),s=data(staticReport,message),micro=data(own(s,'parserMicrocases',message),message);
  if(own(r,'step',message)!=='inspect'||own(r,'sourceSha',message)!==sourceSha||own(r,'policyAccepted',message)!==true||own(r,'originalClosed',message)!==true||
   own(s,'schemaVersion',message)!==4||own(s,'parserComplete',message)!==true||own(s,'qualification',message)!==false||own(micro,'count',message)!==22||own(micro,'passed',message)!==true)deny(message);
  const files=own(s,'files',message);if(!Array.isArray(files)||files.length<1||files.length>PRODUCTION_FILE_LIMITS.outputFiles)deny(message);
  const copied:FileFact[]=[];
  for(let i=0;i<files.length;i++){
   const d=Object.getOwnPropertyDescriptor(files,String(i));if(!d||!Object.hasOwn(d,'value'))deny(message);
   const f=data(d.value,message);
   copied.push(Object.fromEntries(['path','bytes','sha256','regular','contained','symlink'].map(k=>[k,own(f,k,message)])) as unknown as FileFact);
  }
  assertProductionOutputInventory(copied);
 }catch{deny(message);}
}
