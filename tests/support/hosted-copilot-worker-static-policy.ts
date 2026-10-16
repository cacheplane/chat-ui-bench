/** Supplied AST/data and explicit compiler-info observations only.
 * Never imports a parser, compiler, SDK or worker. */
import {createHash} from 'node:crypto';
import {assertProductionOutputInventory,PRODUCTION_FILE_LIMITS,type FileFact} from './hosted-copilot-contract.ts';
import {assertModuleOwnershipId,MODULE_OWNERSHIP_LIMIT} from './hosted-copilot-production-policy.ts';
import {MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_MODULE_BUILTINS,MOUNTED_POLICY_LIMITS,type NativeImport} from './hosted-copilot-mounted-policy.ts';
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
export function classifyWorkerModuleSource(id:unknown,index:unknown,info:unknown,requestedExternal:unknown):'configured-external'|'owned'{
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
 if(allowed&&requested)return 'configured-external';
 let code:unknown;try{code=Reflect.get(info,'code');}catch{codeKind='getter-threw';return fail();}
 codeKind=code===null?'null':typeof code;
 if(typeof code!=='string')return fail();
 return 'owned';
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
