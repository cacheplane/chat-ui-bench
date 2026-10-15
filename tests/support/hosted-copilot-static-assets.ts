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
function containsImportMeta(v:unknown):boolean {const stack=[v];let count=0;while(stack.length){if(++count>500000)throw new Error('URL expression bound');const current=stack.pop();if(current&&typeof current==='object'){if(!Array.isArray(current)){const n=row(current);if(n.type==='MetaProperty'&&row(n.meta).name==='import'&&row(n.property).name==='meta')return true;}for(const child of Object.values(current))if(child&&typeof child==='object')stack.push(child);}}return false;}
export function collectJsReferences(value:unknown,sourceName?:string):string[] {
 const out:string[]=[],stack:{value:unknown;depth:number}[]=[{value,depth:1}];let nodes=0;
 while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++nodes>500000)throw new Error('AST traversal bound');const n=row(entry.value);
  if(n.type==='ImportDeclaration'||(n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration')&&n.source!==null&&n.source!==undefined)add(out,classifyJsReference({kind:n.type==='ImportDeclaration'?'import':'export',specifier:literal(n.source),base:null}));
  if(n.type==='ImportExpression'){if(n.options!==null&&n.options!==undefined)throw new Error('Unsupported import options');add(out,classifyJsReference({kind:'dynamic-import',specifier:constantResource(n.source,sourceName),base:null}));}
  if(n.type==='NewExpression'&&row(n.callee).type==='Identifier'&&row(n.callee).name==='URL'){const args=array(n.arguments);if(args.length===2&&importMetaUrl(args[1]))add(out,classifyJsReference({kind:'new-url',specifier:constantResource(args[0],sourceName),base:'import-meta-url'}));else if(args.some(containsImportMeta))throw new Error('Ambiguous import.meta URL resource');/* Other URL constructors are unqualified runtime graph, not static asset refs. */}
  for(const [key,v] of Object.entries(n)){if(key==='parent')throw new Error('Cyclic AST parent unsupported');if(v&&typeof v==='object'){if(Array.isArray(v)){for(let i=v.length-1;i>=0;i--){const x=v[i];if(x&&typeof x==='object'&&typeof row(x).type==='string')stack.push({value:x,depth:entry.depth+1});}}else if(typeof row(v).type==='string')stack.push({value:v,depth:entry.depth+1});}}
 }
 return out;
}
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
    if(kind==='artifact'&&name!=='api'&&name!=='dist'&&!name.startsWith('dist/')) throw new Error('Unexpected artifact directory');
    await walk(path);continue;
   }
   if(kind==='artifact') {
    const allowed=name.startsWith('dist/')||/^api\/[0-9]{2}\.(?:body\.bin|json)$/.test(name)||/^(?:intent|admission|admission-failure|installed-profile|build-mappings|static-assets|artifact-inventory)\.json$/.test(name)||/^step-(?:profile|install|audit|audit-high|contract|consumer|controls|helpers|vendor|build|inspect)(?:-(?:started|result)\.json|\.(?:stdout|stderr))$/.test(name);
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
 function reference(from:string,raw:string){occurrences=assertReferenceCount([occurrences,1]);parsedOccurrences++;if(raw.startsWith('data:')){const embeddedData=assertEmbeddedSvg(raw,++embedded);references.push({from,raw,target:null,embedded:true,fragment:null,sameDocument:false,embeddedData});}else {const ref=normalizeProductionReference(from,raw,names);references.push({from,raw,target:ref.target,embedded:false,fragment:ref.fragment,sameDocument:ref.sameDocument,embeddedData:null});}}
 const decode=(name:string,limit:number)=>{const raw=bytes.get(name);if(!raw||raw.length>limit)throw new Error('Text byte bound');return new TextDecoder('utf-8',{fatal:true}).decode(raw);};
 const manifestValue:unknown=JSON.parse(decode('.vite/manifest.json',256*1024)),manifest:ManifestRecord[]=[];
 const manifestObject=row(manifestValue);assertProductionCount('manifest-records',Object.keys(manifestObject).length);const manifestEntries=Object.entries(manifestObject);
 for(const [key,value] of manifestEntries){const n=row(value);const list=(k:string)=>n[k]===undefined?[]:array(n[k]).map(string);manifest.push({key,file:string(n.file),imports:list('imports'),dynamicImports:list('dynamicImports'),css:list('css'),assets:list('assets')});}
 const manifestFacts=assertProductionManifest(manifest,names);occurrences=assertReferenceCount([occurrences,manifestFacts.referenceCount]);for(const ref of manifestFacts.references)references.push({from:ref.from,raw:`/${ref.target}`,target:ref.target,embedded:false,fragment:null,sameDocument:false,embeddedData:null});
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
 function js(name:string,text:string){for(const raw of collectJsReferences(parseAst(text,null,name),name))reference(name,raw);}
 function css(name:string,text:string){const result=transform({filename:name,code:Buffer.from(text),analyzeDependencies:true,minify:false,sourceMap:false,errorRecovery:false,visitor:{StyleSheet:sheet=>{assertParserTreeBounds(sheet);}}});for(const raw of collectCssReferences(result.dependencies??[]))reference(name,raw);}
 for(const name of names){if(name.endsWith('.html')){const errors:unknown[]=[];const tree=parse(decode(name,256*1024),{sourceCodeLocationInfo:true,onParseError:error=>{errors.push(error);}});if(errors.length)throw new Error('HTML parser errors');const facts=collectHtmlReferences(tree);for(const raw of facts.references)reference(name,raw);for(const text of facts.scripts)js(name,text);for(const text of facts.styles)css(name,text);}else if(name.endsWith('.js')||name.endsWith('.mjs'))js(name,decode(name,16*1024*1024));else if(name.endsWith('.css'))css(name,decode(name,4*1024*1024));else if(name!=='.vite/manifest.json'&&!/\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/.test(name))throw new Error('Unsupported emitted asset type');}
 const referenceCharges=projectStaticReferenceCounts({metadataOccurrences:snapshot.metadataOccurrenceCount,manifestOwnerOccurrences:manifest.length,manifestEdgeOccurrences:manifestFacts.references.length,parsedEdgeOccurrences:parsedOccurrences});
 if(referenceCharges.referenceBudgetCharges!==occurrences||referenceCharges.staticGraphReferenceOccurrences!==references.length)throw new Error('Static reference accounting differs');
 return {schemaVersion:3 as const,compilerProfile:snapshot.compilerProfile,compilerRuntimeModules:snapshot.compilerRuntimeModules,files,references,metadataReferences:snapshot.metadataReferences,referenceCharges,staticGraphReferenceOccurrences:references.length,referenceBudgetCharges:occurrences,moduleMappings:hooks.modules,parserMicrocases:{count:16,passed:true as const},parserComplete:true as const,preloadHelperReferencesUnqualified:true as const,runtimeUrlConstructorsUnqualified:true as const,qualification:false as const,scope:'supported emitted AST and manifest resource forms only; Vite preload tables/helper calls, other URL constructors/runtime network/presentation remain unqualified'};
}

export function assertParserTreeBounds(value:unknown):void {const stack=[{value,depth:1}];let count=0;while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++count>500000)throw new Error('Parser tree bound');if(entry.value&&typeof entry.value==='object'){for(const child of Object.values(entry.value))if(child&&typeof child==='object')stack.push({value:child,depth:entry.depth+1});}}}
