/** Source-only native adapter: installed parsers load only inside explicit hosted admission. */
import {createHash} from 'node:crypto';
import {lstat,readdir,readFile,realpath} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {assertDenseEntries,assertInventory,LIMITS,ordinaryPath} from './hosted-copilot-contract.ts';
import {assertEmbeddedSvg,assertManifest,assertMappings,assertReferenceCount,classifyJsReference,normalizeReference,type ManifestRecord,type ModuleMapping} from './hosted-copilot-production-policy.ts';
import {readIntegratedAdmission} from './hosted-copilot-context.ts';
type Row=Record<string,unknown>;
function row(v:unknown):Row {if(v===null||typeof v!=='object'||Array.isArray(v))throw new Error('Parser object absent');return v as Row;}
function string(v:unknown):string {if(typeof v!=='string'||v.length===0||Buffer.byteLength(v)>4096)throw new Error('Resource scalar bound');return v;}
function add(out:string[],v:unknown):void {out.push(string(v));assertReferenceCount([out.length]);}
function array(v:unknown):unknown[]{if(!Array.isArray(v))throw new Error('Parser array absent');assertDenseEntries(v,500000,true);return v;}
function literal(v:unknown):string {const n=row(v);if(n.type!=='Literal'||typeof n.value!=='string')throw new Error('Computed resource expression');return string(n.value);}
function importMetaUrl(v:unknown):boolean {const n=row(v);if(n.type!=='MemberExpression'||n.computed!==false)return false;const o=row(n.object),p=row(n.property);return o.type==='MetaProperty'&&row(o.meta).name==='import'&&row(o.property).name==='meta'&&p.type==='Identifier'&&p.name==='url';}
function containsImportMeta(v:unknown):boolean {const stack=[v];let count=0;while(stack.length){if(++count>500000)throw new Error('URL expression bound');const current=stack.pop();if(current&&typeof current==='object'){if(!Array.isArray(current)){const n=row(current);if(n.type==='MetaProperty'&&row(n.meta).name==='import'&&row(n.property).name==='meta')return true;}for(const child of Object.values(current))if(child&&typeof child==='object')stack.push(child);}}return false;}
export function collectJsReferences(value:unknown):string[] {
 const out:string[]=[],stack:{value:unknown;depth:number}[]=[{value,depth:1}];let nodes=0;
 while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++nodes>500000)throw new Error('AST traversal bound');const n=row(entry.value);
  if(n.type==='ImportDeclaration'||(n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration')&&n.source!==null&&n.source!==undefined)add(out,classifyJsReference({kind:n.type==='ImportDeclaration'?'import':'export',specifier:literal(n.source),base:null}));
  if(n.type==='ImportExpression'){if(n.options!==null&&n.options!==undefined)throw new Error('Unsupported import options');add(out,classifyJsReference({kind:'dynamic-import',specifier:literal(n.source),base:null}));}
  if(n.type==='NewExpression'&&row(n.callee).type==='Identifier'&&row(n.callee).name==='URL'){const args=array(n.arguments);if(args.length===2&&importMetaUrl(args[1]))add(out,classifyJsReference({kind:'new-url',specifier:literal(args[0]),base:'import-meta-url'}));else if(args.some(containsImportMeta))throw new Error('Ambiguous import.meta URL resource');/* Other URL constructors are unqualified runtime graph, not static asset refs. */}
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
export interface HookFile {contentSha256?:string;fileName:string;kind:'chunk'|'asset';imports:string[];dynamicImports:string[];moduleIds:string[];originalNames:string[];facadeModuleId:string|null}
export interface HookFacts {schemaVersion:1;files:HookFile[];modules:ModuleMapping[]}
export async function inspectStaticAssets(input:{outputRoot:string;hookFiles:HookFacts}) {
 const admission=readIntegratedAdmission();if(resolve(input.outputRoot)!==resolve(admission.outputDirectory))throw new Error('Output differs from admitted source');
 const root=resolve(input.outputRoot);if(await realpath(root)!==root||(await lstat(root)).isSymbolicLink())throw new Error('Output root physical ownership absent');
 const files:{path:string;bytes:number;sha256:string;regular:true;contained:true;symlink:false}[]=[],bytes=new Map<string,Uint8Array>();let total=0,entries=0;
 async function walk(directory:string):Promise<void>{for(const entry of await readdir(directory,{withFileTypes:true})){if(++entries>512)throw new Error('Output directory-entry bound');const path=join(directory,entry.name),name=relative(root,path).split('\\').join('/'),stat=await lstat(path);if(!ordinaryPath(name)||stat.isSymbolicLink()||await realpath(path)!==path)throw new Error('Output containment/type');if(stat.isDirectory()){await walk(path);continue;}if(!stat.isFile()||files.length>=LIMITS.files||!Number.isSafeInteger(stat.size)||stat.size<0||(total+=stat.size)>LIMITS.bytes)throw new Error('Output aggregate bound');const raw=await readFile(path);const after=await lstat(path);if(raw.length!==stat.size||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ino!==stat.ino)throw new Error('Output changed while reading');files.push({path:name,bytes:raw.length,regular:true,contained:true,symlink:false,sha256:createHash('sha256').update(raw).digest('hex')});bytes.set(name,raw);}}
 await walk(root);assertInventory(files);files.sort((a,b)=>a.path.localeCompare(b.path));const names=files.map(f=>f.path);
 const hooks=input.hookFiles;if(hooks.schemaVersion!==1)throw new Error('Hook schema');assertDenseEntries(hooks.files,LIMITS.files);assertMappings(hooks.modules);const mapped=new Set<string>();let occurrences=0;
 const references:{from:string;raw:string;target:string|null;embedded:boolean;fragment:string|null;sameDocument:boolean;embeddedData:ReturnType<typeof assertEmbeddedSvg>|null}[]=[];let embedded=0;
 function reference(from:string,raw:string){occurrences=assertReferenceCount([occurrences,1]);if(raw.startsWith('data:')){const embeddedData=assertEmbeddedSvg(raw,++embedded);references.push({from,raw,target:null,embedded:true,fragment:null,sameDocument:false,embeddedData});}else {const ref=normalizeReference(from,raw,names);references.push({from,raw,target:ref.target,embedded:false,fragment:ref.fragment,sameDocument:ref.sameDocument,embeddedData:null});}}
 for(const file of hooks.files){if(mapped.has(file.fileName)||!names.includes(file.fileName)||!['chunk','asset'].includes(file.kind))throw new Error('Hook emitted file unavailable/duplicate');if(file.contentSha256!==files.find(actual=>actual.path===file.fileName)?.sha256)throw new Error('Final physical bytes differ from captured hook bytes');mapped.add(file.fileName);for(const list of [file.imports,file.dynamicImports,file.moduleIds,file.originalNames])assertDenseEntries(list,4096,true);for(const raw of [...file.imports,...file.dynamicImports])reference(file.fileName,raw.startsWith('.')?raw:`/${raw}`);for(const id of file.moduleIds)if(!hooks.modules.some(m=>m.id===id))throw new Error('Hook module mapping missing');if(file.facadeModuleId!==null&&!hooks.modules.some(m=>m.id===file.facadeModuleId))throw new Error('Facade module mapping missing');}
 for(const name of names)if(name!=='.vite/manifest.json'&&!mapped.has(name))throw new Error('Output absent from hook inventory');
 const decode=(name:string,limit:number)=>{const raw=bytes.get(name);if(!raw||raw.length>limit)throw new Error('Text byte bound');return new TextDecoder('utf-8',{fatal:true}).decode(raw);};
 const manifestValue:unknown=JSON.parse(decode('.vite/manifest.json',256*1024)),manifest:ManifestRecord[]=[];
 for(const [key,value] of Object.entries(row(manifestValue))){const n=row(value);const list=(k:string)=>n[k]===undefined?[]:array(n[k]).map(string);manifest.push({key,file:string(n.file),imports:list('imports'),dynamicImports:list('dynamicImports'),css:list('css'),assets:list('assets')});}
 const manifestFacts=assertManifest(manifest,names);occurrences=assertReferenceCount([occurrences,manifestFacts.referenceCount]);for(const ref of manifestFacts.references)references.push({from:ref.from,raw:`/${ref.target}`,target:ref.target,embedded:false,fragment:null,sameDocument:false,embeddedData:null});
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
 function js(name:string,text:string){for(const raw of collectJsReferences(parseAst(text,null,name)))reference(name,raw);}
 function css(name:string,text:string){const result=transform({filename:name,code:Buffer.from(text),analyzeDependencies:true,minify:false,sourceMap:false,errorRecovery:false,visitor:{StyleSheet:sheet=>{assertParserTreeBounds(sheet);}}});for(const raw of collectCssReferences(result.dependencies??[]))reference(name,raw);}
 for(const name of names){if(name.endsWith('.html')){const errors:unknown[]=[];const tree=parse(decode(name,256*1024),{sourceCodeLocationInfo:true,onParseError:error=>{errors.push(error);}});if(errors.length)throw new Error('HTML parser errors');const facts=collectHtmlReferences(tree);for(const raw of facts.references)reference(name,raw);for(const text of facts.scripts)js(name,text);for(const text of facts.styles)css(name,text);}else if(name.endsWith('.js')||name.endsWith('.mjs'))js(name,decode(name,16*1024*1024));else if(name.endsWith('.css'))css(name,decode(name,4*1024*1024));else if(name!=='.vite/manifest.json'&&!/\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/.test(name))throw new Error('Unsupported emitted asset type');}
 return {schemaVersion:1 as const,files,references,referenceOccurrences:occurrences,moduleMappings:hooks.modules,parserMicrocases:{count:6,passed:true as const},parserComplete:true as const,runtimeUrlConstructorsUnqualified:true as const,qualification:false as const,scope:'supported emitted static resource graph; other URL constructors/runtime network/presentation remain unqualified'};
}

export function assertParserTreeBounds(value:unknown):void {const stack=[{value,depth:1}];let count=0;while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++count>500000)throw new Error('Parser tree bound');if(entry.value&&typeof entry.value==='object'){for(const child of Object.values(entry.value))if(child&&typeof child==='object')stack.push({value:child,depth:entry.depth+1});}}}
