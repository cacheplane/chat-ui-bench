/** Source-only native adapter: installed parsers load only inside explicit hosted admission. */
import {createHash} from 'node:crypto';
import {lstat,readdir,readFile,realpath} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {assertDenseEntries,assertProductionOutputInventory,assertProductionArtifactInventory,assertProductionCount,LIMITS,ordinaryPath,type FileFact} from './hosted-copilot-contract.ts';
import {assertEmbeddedSvg,assertProductionManifest,assertCompilerRuntimeOwnership,type CompilerProfile,type CompilerRuntimeModule,assertReferenceCount,assertHookMetadataIntegrity,projectStaticReferenceCounts,classifyJsReference,MODULE_OWNERSHIP_LIMIT,normalizeProductionReference,type HookMetadataReference,type ManifestRecord,type ModuleMapping} from './hosted-copilot-production-policy.ts';
import {readIntegratedAdmission} from './hosted-copilot-context.ts';
type Row=Record<string,unknown>;
function row(v:unknown):Row {if(v===null||typeof v!=='object'||Array.isArray(v))throw new Error('Parser object absent');return v as Row;}
function string(v:unknown):string {if(typeof v!=='string'||v.length===0||Buffer.byteLength(v)>4096)throw new Error('Resource scalar bound');return v;}
function add(out:string[],v:unknown):void {out.push(string(v));assertReferenceCount([out.length]);}
function array(v:unknown):unknown[]{if(!Array.isArray(v))throw new Error('Parser array absent');assertDenseEntries(v,500000,true);return v;}
function literal(v:unknown):string {const n=row(v);if(n.type!=='Literal'||typeof n.value!=='string')throw new Error('Computed resource expression');return string(n.value);}
function computedResource(v:unknown,sourceName:string|undefined):never {
 let message='Computed resource expression';
 try {
  const n=row(v);let source:string|null=null,sourceTruncated=false;
  if(typeof sourceName==='string') {
   source='';let consumed=0;
   for(const point of sourceName){const next:string=source+point;if(Buffer.byteLength(next)>128||Buffer.byteLength(JSON.stringify(next))>128)break;source=next;consumed+=point.length;}
   sourceTruncated=consumed<sourceName.length;
  }
  const offset=(value:unknown)=>Number.isSafeInteger(value)&&typeof value==='number'&&value>=0&&value<=16*1024*1024?value:null;
  const nodeType=typeof n.type==='string'&&/^[A-Za-z0-9_]{1,32}$/.test(n.type)?n.type:null;
  const detail=JSON.stringify({source,sourceTruncated,nodeType,start:offset(n.start),end:offset(n.end)});
  if(Buffer.byteLength(message+' '+detail)<=512)message+=' '+detail;
 } catch {/* Diagnostic projection cannot replace the original refusal. */}
 throw new Error(message);
}
function astTraversalBound(value:unknown,sourceName:string|undefined,phase:'resource-walk'|'import-meta-probe',reason:'depth'|'visits',depth:number,visited:number,resourcePops:number,probePops:number,probeCalls:number):never {
 let message='AST traversal bound';
 try {
  const n=value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:null;let source:string|null=null,sourceTruncated=false;
  if(typeof sourceName==='string') {
   source='';let consumed=0;
   for(const point of sourceName){const next:string=source+point;if(Buffer.byteLength(next)>128||Buffer.byteLength(JSON.stringify(next))>128)break;source=next;consumed+=point.length;}
   sourceTruncated=consumed<sourceName.length;
  }
  const offset=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=16*1024*1024?v:null;
  const rawType=n?.type,nodeType=typeof rawType==='string'&&/^[A-Za-z0-9_]{1,32}$/.test(rawType)?rawType:null;
  const detail=JSON.stringify({source,sourceTruncated,phase,reason,depth,visited,nodeType,start:offset(n?.start),end:offset(n?.end),resourcePops,probePops,probeCalls});
  if(Buffer.byteLength(message+' '+detail)<=512)message+=' '+detail;
 } catch {/* Diagnostic projection cannot replace the original refusal. */}
 throw new Error(message);
}
/** Only the two dynamic resource positions admit a zero-expression template. */
function constantResource(v:unknown,sourceName:string|undefined):string {
 const n=row(v);if(n.type==='Literal')return literal(v);
 if(n.type!=='TemplateLiteral'||!Array.isArray(n.expressions)||n.expressions.length!==0||!Array.isArray(n.quasis)||n.quasis.length!==1)computedResource(v,sourceName);
 assertDenseEntries(n.expressions,0,true);assertDenseEntries(n.quasis,1);
 const quasi=row(n.quasis[0]);if(quasi.type!=='TemplateElement'||quasi.tail!==true)computedResource(v,sourceName);
 const value=row(quasi.value);if(typeof value.raw!=='string'||Buffer.byteLength(value.raw)>4096||typeof value.cooked!=='string')computedResource(v,sourceName);
 return string(value.cooked);
}
function importMetaUrl(v:unknown):boolean {const n=row(v);if(n.type!=='MemberExpression'||n.computed!==false)return false;const o=row(n.object),p=row(n.property);return o.type==='MetaProperty'&&row(o.meta).name==='import'&&row(o.property).name==='meta'&&p.type==='Identifier'&&p.name==='url';}
function importMetaResolve(v:unknown):Row|null {const n=row(v);if(n.type!=='CallExpression'||n.optional===true)return null;const callee=row(n.callee);if(callee.type!=='MemberExpression'||callee.computed!==false||callee.optional===true)return null;const o=row(callee.object),p=row(callee.property);if(o.type!=='MetaProperty'||row(o.meta).name!=='import'||row(o.property).name!=='meta'||p.type!=='Identifier'||p.name!=='resolve')return null;const args=array(n.arguments);return args.length===1&&row(args[0]).type==='Identifier'?row(args[0]):null;}
export interface UnqualifiedRuntimeUrl {form:'import-meta-url-identifier'|'import-meta-resolve-identifier';nodeType:'Identifier';start:number|null;end:number|null}
/** Supplied AST facts only. Positions describe the parse unit, never physical file bytes. */
export function collectJsResourceFacts(value:unknown,sourceName?:string,remainingOccurrences=4096):{references:string[];unqualifiedRuntimeUrls:UnqualifiedRuntimeUrl[]} {
 return collectJsResources(value,sourceName,remainingOccurrences,'facts');
}
function collectJsResources(value:unknown,sourceName:string|undefined,remainingOccurrences:number,mode:'strict'|'facts'):{references:string[];unqualifiedRuntimeUrls:UnqualifiedRuntimeUrl[]} {
 assertReferenceCount([remainingOccurrences]);
 const out:string[]=[],unqualifiedRuntimeUrls:UnqualifiedRuntimeUrl[]=[],stack:{value:unknown;depth:number}[]=[{value,depth:1}];let nodes=0,resourcePops=0,probePops=0,probeCalls=0;
 const charge=()=>{const count=assertReferenceCount([out.length,unqualifiedRuntimeUrls.length,1]);if(count>remainingOccurrences)throw new Error('Reference occurrence overflow');};
 function reference(v:unknown){charge();add(out,v);}
 function containsImportMeta(v:unknown,depth:number):boolean {probeCalls++;const pending=[{value:v,depth}];while(pending.length){const entry=pending.pop()!;probePops++;if(entry.depth>256||++nodes>500000)astTraversalBound(entry.value,sourceName,'import-meta-probe',entry.depth>256?'depth':'visits',entry.depth,nodes,resourcePops,probePops,probeCalls);const current=entry.value;if(current&&typeof current==='object'){if(!Array.isArray(current)){const n=row(current);if(n.type==='MetaProperty'&&row(n.meta).name==='import'&&row(n.property).name==='meta')return true;}for(const [key,child] of Object.entries(current)){if(key==='parent')throw new Error('Cyclic AST parent unsupported');if(child&&typeof child==='object')pending.push({value:child,depth:entry.depth+1});}}}return false;}
 function retain(n:Row,form:UnqualifiedRuntimeUrl['form']) {if(mode==='strict')computedResource(n,sourceName);charge();const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=16*1024*1024;const {start,end}=n;if(start===undefined&&end===undefined){unqualifiedRuntimeUrls.push({form,nodeType:'Identifier',start:null,end:null});return;}if(!valid(start)||!valid(end)||end<start)throw new Error('Runtime URL span invalid');unqualifiedRuntimeUrls.push({form,nodeType:'Identifier',start,end});}
 while(stack.length){const entry=stack.pop()!;resourcePops++;if(entry.depth>256||++nodes>500000)astTraversalBound(entry.value,sourceName,'resource-walk',entry.depth>256?'depth':'visits',entry.depth,nodes,resourcePops,probePops,probeCalls);const n=row(entry.value);
  if(n.type==='ImportDeclaration'||(n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration')&&n.source!==null&&n.source!==undefined)reference(classifyJsReference({kind:n.type==='ImportDeclaration'?'import':'export',specifier:literal(n.source),base:null}));
  if(n.type==='ImportExpression'){if(n.options!==null&&n.options!==undefined)throw new Error('Unsupported import options');reference(classifyJsReference({kind:'dynamic-import',specifier:constantResource(n.source,sourceName),base:null}));}
  if(n.type==='NewExpression'&&row(n.callee).type==='Identifier'&&row(n.callee).name==='URL'){const args=array(n.arguments);if(n.optional===true&&args.some(arg=>containsImportMeta(arg,entry.depth+1)))throw new Error('Ambiguous import.meta URL resource');if(args.length===2&&importMetaUrl(args[1])&&row(args[1]).optional!==true){const source=row(args[0]);if(source.type==='Identifier')retain(source,'import-meta-url-identifier');else {charge();add(out,classifyJsReference({kind:'new-url',specifier:constantResource(source,sourceName),base:'import-meta-url'}));}}else {const source=args.length===1?importMetaResolve(args[0]):null;if(source)retain(source,'import-meta-resolve-identifier');else if(args.some(arg=>containsImportMeta(arg,entry.depth+1)))throw new Error('Ambiguous import.meta URL resource');}/* Other URL constructors remain unqualified and uninventoried. */}
  for(const [key,v] of Object.entries(n)){if(key==='parent')throw new Error('Cyclic AST parent unsupported');if(v&&typeof v==='object'){if(Array.isArray(v)){for(let i=v.length-1;i>=0;i--){const x=v[i];if(x&&typeof x==='object'&&typeof row(x).type==='string')stack.push({value:x,depth:entry.depth+1});}}else if(typeof row(v).type==='string')stack.push({value:v,depth:entry.depth+1});}}
 }
 assertReferenceCount([out.length,unqualifiedRuntimeUrls.length]);
 return {references:out,unqualifiedRuntimeUrls};
}
/** Compatibility callers, including inline HTML scripts, retain strict refusal. */
export function collectJsReferences(value:unknown,sourceName?:string):string[] {return collectJsResources(value,sourceName,4096,'strict').references;}
export function collectHtmlReferences(value:unknown):{references:string[];scripts:string[];styles:string[]} {
 const references:string[]=[],scripts:string[]=[],styles:string[]=[],stack=[{value,depth:1}];let count=0;
 while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++count>500000)throw new Error('HTML traversal bound');const n=row(entry.value),tag=typeof n.tagName==='string'?n.tagName:'';const attrs=new Map<string,string>();
  if(n.attrs!==undefined)for(const a of array(n.attrs)){const attr=row(a),name=string(attr.name).toLowerCase();if(attrs.has(name))throw new Error('Duplicate HTML attribute');attrs.set(name,typeof attr.value==='string'?attr.value:(()=>{throw new Error('HTML attribute value');})());}
  if(['base','iframe','frame','embed','object','svg','math','noscript','applet','portal'].includes(tag))throw new Error('Unsupported resource-bearing HTML element');
  if(tag==='meta'&&attrs.has('http-equiv'))throw new Error('Unsupported HTML pragma resource semantics');
  for(const [name,v] of attrs){if(name==='srcset'||name==='imagesrcset'||name==='srcdoc'||name==='ping'||name==='background'||name==='manifest'||['archive','code','codebase','classid','profile','longdesc','lowsrc','dynsrc','usemap','cite'].includes(name)||name.startsWith('on')||name==='xlink:href')throw new Error('Unsupported HTML resource form');if(name==='style')styles.push(`x{${v}}`);if(['src','href','poster','data','action','formaction'].includes(name))add(references,v);}
  const children=n.childNodes===undefined?[]:array(n.childNodes);
  if(tag==='script'){const type=attrs.get('type')??'';if(!['','module','text/javascript','application/javascript'].includes(type))throw new Error('Unsupported script type');if(!attrs.has('src'))scripts.push(children.map(c=>{const t=row(c);if(t.nodeName!=='#text'||typeof t.value!=='string')throw new Error('Unsupported script child');return t.value;}).join(''));}
  if(tag==='style')styles.push(children.map(c=>{const t=row(c);if(t.nodeName!=='#text'||typeof t.value!=='string')throw new Error('Unsupported style child');return t.value;}).join(''));
  for(let i=children.length-1;i>=0;i--)stack.push({value:children[i],depth:entry.depth+1});if(n.content!==undefined)stack.push({value:n.content,depth:entry.depth+1});
 }
 return {references,scripts,styles};
}
export function collectCssReferences(value:unknown):string[]{const out:string[]=[];for(const dep of array(value)){const n=row(dep);if(n.type!=='import'&&n.type!=='url')throw new Error('Unsupported CSS dependency form');add(out,n.url);}return out;}
export interface HookFile {contentSha256?:string|undefined;fileName:string;kind:'chunk'|'asset';imports:readonly string[];dynamicImports:readonly string[];moduleIds:readonly string[];originalNames:readonly string[];facadeModuleId:string|null}
export interface HookFacts {schemaVersion:3;compilerProfile:Readonly<CompilerProfile>;compilerRuntimeModules:readonly Readonly<CompilerRuntimeModule>[];files:readonly HookFile[];modules:readonly ModuleMapping[];metadataReferences:readonly HookMetadataReference[];metadataOccurrenceCount:number;qualification:false}
/** Supplied inventory/hook consistency only; no I/O or installed parser call. */
export function assertHookSnapshot(hooks:HookFacts,files:readonly FileFact[]) {
 if(hooks.schemaVersion!==3||hooks.qualification!==false)throw new Error('Hook schema');
 const inventory=assertProductionOutputInventory(files),names=new Set(inventory.files.map(file=>file.path));
 const metadataReferences=assertHookMetadataIntegrity(hooks.files,hooks.metadataReferences,hooks.metadataOccurrenceCount);
 const mapped=new Set<string>();
 for(const file of hooks.files) {
  if(mapped.has(file.fileName)||!names.has(file.fileName)||file.fileName.endsWith('.map')||!['chunk','asset'].includes(file.kind))throw new Error('Hook emitted file unavailable/duplicate');
  if(file.contentSha256!==inventory.files.find(actual=>actual.path===file.fileName)?.sha256)throw new Error('Final physical bytes differ from captured hook bytes');mapped.add(file.fileName);
  assertDenseEntries(file.moduleIds,MODULE_OWNERSHIP_LIMIT,true);for(const list of [file.imports,file.dynamicImports,file.originalNames])assertDenseEntries(list,4096,true);
 }
 for(const name of names)if(name!=='.vite/manifest.json'&&!mapped.has(name))throw new Error('Output absent from hook inventory');
 const compilerOwnership=assertCompilerRuntimeOwnership(hooks.files,hooks.modules,hooks.compilerProfile,hooks.compilerRuntimeModules);
 return Object.freeze({metadataReferences,metadataOccurrenceCount:metadataReferences.length,...compilerOwnership});
}
interface CollectedFiles {files:readonly Readonly<FileFact>[];bytes:number;visitedEntries:number;qualification:false}
interface CollectedOutput extends CollectedFiles {byteMap:Map<string,Uint8Array>}
/** Explicit owned filesystem reads only; no source admission, installed parser or SDK calls. */
export function collectProductionOutput(root:string):Promise<CollectedOutput> {return collectProductionFiles(root,'output');}
export function collectProductionArtifact(root:string):Promise<CollectedFiles> {return collectProductionFiles(root,'artifact');}
function collectProductionFiles(inputRoot:string,kind:'output'):Promise<CollectedOutput>;
function collectProductionFiles(inputRoot:string,kind:'artifact'):Promise<CollectedFiles>;
async function collectProductionFiles(inputRoot:string,kind:'output'|'artifact'):Promise<CollectedFiles|CollectedOutput> {
 const root=resolve(inputRoot),rootStat=await lstat(root);
 if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||await realpath(root)!==root) throw new Error('Production collection root containment/type');
 const files:FileFact[]=[],byteMap=kind==='output'?new Map<string,Uint8Array>():null;let total=0,visitedEntries=0;
 async function walk(directory:string):Promise<void> {
  // This caps visited work, not the allocation made internally by readdir.
  for(const entry of await readdir(directory,{withFileTypes:true})) {
   assertProductionCount('visited-entries',++visitedEntries);
   const path=join(directory,entry.name),name=relative(root,path).split('\\').join('/'),before=await lstat(path);
   if(!ordinaryPath(name)||before.isSymbolicLink()||await realpath(path)!==path) throw new Error('Production file containment/type');
   if(before.isDirectory()) {
    if(kind==='artifact'&&name!=='api'&&name!=='dist'&&name!=='worker'&&!name.startsWith('dist/')) throw new Error('Unexpected artifact directory');
    await walk(path);continue;
   }
   if(kind==='artifact') {
    const allowed=name.startsWith('dist/')||name==='worker/worker.mjs'||/^worker-(?:module|module-policy|owned-modules|installed-packages|resolution-files|compiler-profile)\.json$/.test(name)||/^api\/[0-9]{2}\.(?:body\.bin|json)$/.test(name)||/^(?:intent|admission|admission-failure|installed-profile|build-mappings|static-assets|artifact-inventory)\.json$/.test(name)||/^step-(?:profile|install|audit|audit-high|contract|consumer|controls|helpers|vendor|build|inspect|worker-build|worker-inspect)(?:-(?:started|result)\.json|\.(?:stdout|stderr))$/.test(name);
    if(!allowed) throw new Error('Unexpected artifact file');
    if(/\.(?:stdout|stderr)$/.test(name)&&before.size>4*1024*1024) throw new Error('Original command log overflow; retained originals not uploaded');
   }
   assertProductionCount(kind==='output'?'output-files':'artifact-files',files.length+1);
   if(!before.isFile()||!Number.isSafeInteger(before.size)||before.size<0||(total+=before.size)>LIMITS.bytes) throw new Error('Production file aggregate bound/type');
   const raw=await readFile(path),after=await lstat(path);
   if(raw.length!==before.size||after.dev!==before.dev||after.ino!==before.ino||after.size!==before.size||after.mtimeMs!==before.mtimeMs) throw new Error('Production file bytes changed');
   files.push({path:name,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),regular:true,contained:true,symlink:false});
   byteMap?.set(name,raw);
  }
 }
 await walk(root);const inventory=kind==='output'?assertProductionOutputInventory(files):assertProductionArtifactInventory(files);
 if(byteMap) return Object.freeze({...inventory,visitedEntries,byteMap});
 return Object.freeze({...inventory,visitedEntries});
}
export async function inspectStaticAssets(input:{outputRoot:string;hookFiles:HookFacts}) {
 const admission=readIntegratedAdmission();if(resolve(input.outputRoot)!==resolve(admission.outputDirectory))throw new Error('Output differs from admitted source');
 const collected=await collectProductionOutput(input.outputRoot),files=[...collected.files].sort((a,b)=>a.path.localeCompare(b.path)),bytes=collected.byteMap,names=files.map(f=>f.path);
 const hooks=input.hookFiles,snapshot=assertHookSnapshot(hooks,files);let occurrences=snapshot.metadataOccurrenceCount,parsedOccurrences=0;
 const references:{from:string;raw:string;target:string|null;embedded:boolean;fragment:string|null;sameDocument:boolean;embeddedData:ReturnType<typeof assertEmbeddedSvg>|null}[]=[];let embedded=0;
 const unqualifiedRuntimeUrls:(UnqualifiedRuntimeUrl&{from:string;sourceSha256:string;parsedTextSha256:string;unitKind:'standalone-module'})[]=[];
 const parsedUnits=new Map<string,{sourceSha256:string;parsedTextSha256:string;length:number}>();
 function reference(from:string,raw:string){occurrences=assertReferenceCount([occurrences,1]);parsedOccurrences++;if(raw.startsWith('data:')){const embeddedData=assertEmbeddedSvg(raw,++embedded);references.push({from,raw,target:null,embedded:true,fragment:null,sameDocument:false,embeddedData});}else {const ref=normalizeProductionReference(from,raw,names);references.push({from,raw,target:ref.target,embedded:false,fragment:ref.fragment,sameDocument:ref.sameDocument,embeddedData:null});}}
 const decode=(name:string,limit:number)=>{const raw=bytes.get(name);if(!raw||raw.length>limit)throw new Error('Text byte bound');return new TextDecoder('utf-8',{fatal:true}).decode(raw);};
 const manifestValue:unknown=JSON.parse(decode('.vite/manifest.json',256*1024)),manifest:ManifestRecord[]=[];
 const manifestObject=row(manifestValue);assertProductionCount('manifest-records',Object.keys(manifestObject).length);const manifestEntries=Object.entries(manifestObject);
 for(const [key,value] of manifestEntries){const n=row(value);const list=(k:string)=>n[k]===undefined?[]:array(n[k]).map(string);manifest.push({key,file:string(n.file),imports:list('imports'),dynamicImports:list('dynamicImports'),css:list('css'),assets:list('assets')});}
 const manifestFacts=assertProductionManifest(manifest,names);
 occurrences=projectStaticReferenceCounts({metadataOccurrences:snapshot.metadataOccurrenceCount,manifestOwnerOccurrences:manifest.length,manifestEdgeOccurrences:manifestFacts.references.length,parsedEdgeOccurrences:0,unqualifiedRuntimeUrlOccurrences:0}).referenceBudgetCharges;
 for(const ref of manifestFacts.references)references.push({from:ref.from,raw:`/${ref.target}`,target:ref.target,embedded:false,fragment:null,sameDocument:false,embeddedData:null});
 const {parse}=await import('parse5');const {parseAst}=await import('rolldown/parseAst');const {transform}=await import('lightningcss');
 function expectDenied(action:()=>unknown){let denied=false;try{action();}catch{denied=true;}if(!denied)throw new Error('Actual parser ambiguity microcase accepted');}
 const microJs=collectJsReferences(parseAst('import "./a.js";export * from "./a.js";import("./b.js");new URL("./x.png",import.meta.url)',null,'microcase.js'));
 if(JSON.stringify(microJs)!==JSON.stringify(['./a.js','./a.js','./b.js','./x.png']))throw new Error('Actual JS parser resource microcase differs');
 expectDenied(()=>collectJsReferences(parseAst('import(variable)',null,'computed.js')));
 expectDenied(()=>collectJsReferences(parseAst('new URL(variable,import.meta.url)',null,'computed-url.js')));
 const microHtml=collectHtmlReferences(parse('<!doctype html><html><head></head><body><template><img src="./x.png"></template><script type="module">import "./x.js"</script><style>.x{color:red}</style></body></html>'));
 if(JSON.stringify(microHtml)!==JSON.stringify({references:['./x.png'],scripts:['import "./x.js"'],styles:['.x{color:red}']}))throw new Error('Actual HTML parser microcase differs');
 expectDenied(()=>collectHtmlReferences(parse('<base href="/">')));
 const microCss=transform({filename:'microcase.css',code:Buffer.from('@import "./a.css";.x{background:url("./x.png")}'),analyzeDependencies:true,minify:false,sourceMap:false,errorRecovery:false});
 if(JSON.stringify(collectCssReferences(microCss.dependencies??[]))!==JSON.stringify(['./a.css','./x.png']))throw new Error('Actual CSS parser microcase differs');
 const constantCases=[['import(`./a.js`)','./a.js'],['new URL(`./x.png`,import.meta.url)','./x.png'],['import(`./\\u0061.js`)','./a.js'],['new URL(`./\\u0078.png`,import.meta.url)','./x.png']] as const;
 for(const [code,expected]of constantCases)if(JSON.stringify(collectJsReferences(parseAst(code,null,'constant-template.js')))!==JSON.stringify([expected]))throw new Error('Actual constant template parser microcase differs');
 for(const code of ['import(`./${name}.js`)','new URL(`./${name}.png`,import.meta.url)','import(tag`./a.js`)','import("./"+name)','import(`\\u{}`)','import(`./a.js`,{with:{type:"json"}})'])expectDenied(()=>collectJsReferences(parseAst(code,null,'computed-template.js')));
 for(const [code,form]of [['new URL(value,import.meta.url)','import-meta-url-identifier'],['new URL(import.meta.resolve(value))','import-meta-resolve-identifier']]as const){const ast=parseAst(code,null,'runtime-url.js'),facts=collectJsResourceFacts(ast);if(facts.references.length||facts.unqualifiedRuntimeUrls.length!==1||facts.unqualifiedRuntimeUrls[0]?.form!==form)throw new Error('Actual runtime URL parser microcase differs');expectDenied(()=>collectJsReferences(ast));}
 const mixedFacts=collectJsResourceFacts(parseAst('new URL("./x.png",import.meta.url);new URL(value,import.meta.url);new URL(value,import.meta.url)',null,'mixed-runtime.js'));
 if(JSON.stringify(mixedFacts.references)!==JSON.stringify(['./x.png'])||mixedFacts.unqualifiedRuntimeUrls.length!==2)throw new Error('Actual runtime occurrence microcase differs');
 expectDenied(()=>collectJsResourceFacts(parseAst('import(value)',null,'computed-import.js')));
 expectDenied(()=>collectJsResourceFacts(parseAst('new URL(value,import.meta[base])',null,'ambiguous-base.js')));
 const unicodeCode='/* é🙂 */new URL(value,import.meta.url)',unicodeFacts=collectJsResourceFacts(parseAst(unicodeCode,null,'unicode-runtime.js')),unicodeStart=unicodeCode.indexOf('value');
 if(unicodeFacts.unqualifiedRuntimeUrls[0]?.start!==unicodeStart||unicodeFacts.unqualifiedRuntimeUrls[0]?.end!==unicodeStart+'value'.length||unicodeFacts.unqualifiedRuntimeUrls.length!==1)throw new Error('Actual parser UTF16 parse-unit span microcase differs');
 function js(name:string,text:string,standalone:boolean){const ast=parseAst(text,null,name);if(!standalone){for(const raw of collectJsReferences(ast,name))reference(name,raw);return;}const facts=collectJsResourceFacts(ast,name,4096-occurrences),owner=files.find(file=>file.path===name);if(!ordinaryPath(name)||!owner||parsedUnits.has(name))throw new Error('Runtime URL source owner invalid');const parsedTextSha256=createHash('sha256').update(text).digest('hex');parsedUnits.set(name,{sourceSha256:owner.sha256,parsedTextSha256,length:text.length});for(const raw of facts.references)reference(name,raw);for(const fact of facts.unqualifiedRuntimeUrls){occurrences=assertReferenceCount([occurrences,1]);if(fact.start===null||fact.end===null||fact.end>text.length)throw new Error('Runtime URL parse-unit span absent/out of bounds');unqualifiedRuntimeUrls.push({...fact,from:name,sourceSha256:owner.sha256,parsedTextSha256,unitKind:'standalone-module'});}}
 function css(name:string,text:string){const result=transform({filename:name,code:Buffer.from(text),analyzeDependencies:true,minify:false,sourceMap:false,errorRecovery:false,visitor:{StyleSheet:sheet=>{assertParserTreeBounds(sheet);}}});for(const raw of collectCssReferences(result.dependencies??[]))reference(name,raw);}
 for(const name of names){if(name.endsWith('.html')){const errors:unknown[]=[];const tree=parse(decode(name,256*1024),{sourceCodeLocationInfo:true,onParseError:error=>{errors.push(error);}});if(errors.length)throw new Error('HTML parser errors');const facts=collectHtmlReferences(tree);for(const raw of facts.references)reference(name,raw);for(const text of facts.scripts)js(name,text,false);for(const text of facts.styles)css(name,text);}else if(name.endsWith('.js')||name.endsWith('.mjs'))js(name,decode(name,16*1024*1024),true);else if(name.endsWith('.css'))css(name,decode(name,4*1024*1024));else if(name!=='.vite/manifest.json'&&!/\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/.test(name))throw new Error('Unsupported emitted asset type');}
 for(const fact of unqualifiedRuntimeUrls){const unit=parsedUnits.get(fact.from),owner=files.find(file=>file.path===fact.from);if(!unit||!owner||owner.sha256!==fact.sourceSha256||unit.sourceSha256!==fact.sourceSha256||unit.parsedTextSha256!==fact.parsedTextSha256||fact.unitKind!=='standalone-module'||fact.start===null||fact.end===null||fact.start<0||fact.end<fact.start||fact.end>unit.length)throw new Error('Runtime URL source binding differs');}
 const referenceCharges=projectStaticReferenceCounts({metadataOccurrences:snapshot.metadataOccurrenceCount,manifestOwnerOccurrences:manifest.length,manifestEdgeOccurrences:manifestFacts.references.length,parsedEdgeOccurrences:parsedOccurrences,unqualifiedRuntimeUrlOccurrences:unqualifiedRuntimeUrls.length});
 if(referenceCharges.referenceBudgetCharges!==occurrences||referenceCharges.staticGraphReferenceOccurrences!==references.length)throw new Error('Static reference accounting differs');
 return {schemaVersion:4 as const,compilerProfile:snapshot.compilerProfile,compilerRuntimeModules:snapshot.compilerRuntimeModules,files,references,unqualifiedRuntimeUrls,unqualifiedRuntimeUrlOccurrences:unqualifiedRuntimeUrls.length,metadataReferences:snapshot.metadataReferences,referenceCharges,staticGraphReferenceOccurrences:references.length,referenceBudgetCharges:occurrences,moduleMappings:hooks.modules,parserMicrocases:{count:22,passed:true as const},parserComplete:true as const,preloadHelperReferencesUnqualified:true as const,runtimeUrlConstructorsUnqualified:true as const,qualification:false as const,scope:'supported emitted AST and manifest resource forms; standalone-module Identifier import.meta URL forms inventoried with unresolved targets and UTF16 parse-unit spans; inline scripts remain strict; Vite preload tables/helper calls, other URL constructors/runtime network/presentation remain unqualified'};
}

export function assertParserTreeBounds(value:unknown):void {const stack=[{value,depth:1}];let count=0;while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++count>500000)throw new Error('Parser tree bound');if(entry.value&&typeof entry.value==='object'){for(const child of Object.values(entry.value))if(child&&typeof child==='object')stack.push({value:child,depth:entry.depth+1});}}}
