/** Diagnostic-only build helpers; SDK/compiler imports happen inside released build actions. */
import {join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,lstatSync} from 'node:fs';
import {mkdir,open,readFile,realpath,opendir} from 'node:fs/promises';
import type {Plugin,UserConfig} from 'vite';
import {productionAssetOptions,productionEsmOutputOptions,readPhysicalSource} from './hosted-copilot-build-plugin.ts';
import {ordinaryPath,assertProductionOutputInventory,PRODUCTION_FILE_LIMITS,type FileFact} from './hosted-copilot-contract.ts';
import {diagnosticHash} from './hosted-copilot-scroll-cause-artifact.ts';
import {workerStaticResolveOptions,workerStaticOutputOptions,collectWorkerModuleImports,observeWorkerRegisteredModule} from './hosted-copilot-worker-static-policy.ts';
import {MOUNTED_MODULE_BUILTINS,MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_PACKAGE_PINS,WORKER_ZOD_PUBLIC_BINDING,lookupWorkerPublicPackage} from './hosted-copilot-mounted-policy.ts';
import {transformScrollCause,reverseScrollCause,PINNED_MODULE,type ScrollCauseTransform} from './hosted-copilot-scroll-cause-transform.ts';
// Current diagnostic identity only. Historical mounted profiles keep their
// original package pins and cannot admit this security-updated Zod identity.
export const SCROLL_CAUSE_PACKAGE_PROFILE=Object.freeze({id:'scroll-cause-security-pins-v2',packages:Object.freeze({...MOUNTED_PACKAGE_PINS,
 'node_modules/zod':Object.freeze({version:'4.6.6',integrity:'sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA=='}),
})});
export function redirectScrollCauseHtml(html:string):string{
 const original="from '/src/main.tsx'";
 if(html.split(original).length!==2||html.includes('/src/scroll-cause-main.ts'))throw Error('diagnostic-html-entry');
 return html.replace(original,"from '/src/scroll-cause-main.ts'");
}
export function createScrollCauseFrontendPlugin(root:string){
 const bridge=join(root,'apps/copilotkit/src/scroll-cause-frontend.ts'),url=pathToFileURL(bridge).href,vendor=join(root,'node_modules',PINNED_MODULE);
 let transform:ScrollCauseTransform|null=null;
 const plugin={name:'unqualified-scroll-cause-exact-transform',enforce:'pre' as const,
  resolveId(id:string){if(id===url)return bridge;if(id.startsWith('file:'))throw Error('diagnostic-unowned-file-url');return null;},
  transform(code:string,id:string){if(id!==vendor)return null;if(transform)throw Error('diagnostic-transform-repeated');const result=transformScrollCause(code,PINNED_MODULE,url);reverseScrollCause(result);transform=result;return {code:result.code,map:null};},
  transformIndexHtml:{order:'pre' as const,handler:redirectScrollCauseHtml},
 };
 return {plugin,receipt(){if(!transform)throw Error('diagnostic-transform-unobserved');return transform;}};
}
type ModulePin={path:string;bytes:number;sha256:string;chunks:string[]};
export function diagnosticSourcePin(root:string,path:string){
 if(!ordinaryPath(path))throw Error('diagnostic-source-path');
 const value=readPhysicalSource(join(root,path),root),stat=lstatSync(join(root,path));
 if(!stat.isFile()||stat.nlink!==1||stat.size>16777216)throw Error('diagnostic-source-physical');
 return {path,bytes:stat.size,sha256:value.sha256};
}
const FRONTEND_VENDOR_PATHS=Object.freeze(['node_modules/@tanstack/virtual-core/dist/esm/index.js','node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js','node_modules/@tanstack/virtual-core/dist/esm/utils.js','node_modules/@copilotkit/react-core/dist/copilotkit-DgJj6xa0.mjs']);
/** Extra directory level belongs only to this fixed diagnostic launch layout. */
export const DIAGNOSTIC_ZOD_RAW_SPECIFIER='../../../../../node_modules/zod/index.js';
/** Only a privately owned analysis AST is adapted; emitted bytes never change. */
export function collectDiagnosticWorkerImports(ast:unknown){
 const stack:{value:unknown;depth:number}[]=[{value:ast,depth:1}],matches:{node:object;descriptor:PropertyDescriptor}[]=[];let visits=0;
 while(stack.length){const entry=stack.pop()!;if(entry.depth>256||++visits>500000)throw Error('diagnostic-parser-bound');const value=entry.value;if(value===null||typeof value!=='object')continue;
  const array=Array.isArray(value);if(Object.getPrototypeOf(value)!==(array?Array.prototype:Object.prototype)&&!(Object.getPrototypeOf(value)===null&&!array))throw Error('diagnostic-parser-shape');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(keys.length>500000)throw Error('diagnostic-parser-bound');
  const get=(key:string)=>descriptors[key]?.value as unknown,type=get('type');
  for(const key of keys){if(typeof key!=='string'||!('value'in descriptors[key]!))throw Error('diagnostic-parser-data');const child=descriptors[key]!.value;if(child!==null&&typeof child==='object'){
   // The unchanged full guard below validates this original RegExp literal.
   if(type==='Literal'&&key==='value'&&Object.getPrototypeOf(child)===RegExp.prototype)continue;
   stack.push({value:child,depth:entry.depth+1});}}
  if(type==='ImportDeclaration'||type==='ImportExpression'||type==='ExportNamedDeclaration'||type==='ExportAllDeclaration'){
   const source=get('source');if(source===null||typeof source!=='object')continue;const ds=Object.getOwnPropertyDescriptors(source),literal=ds.value?.value;
   if(literal===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier)throw Error('diagnostic-wrong-depth-binding');
   if(literal!==DIAGNOSTIC_ZOD_RAW_SPECIFIER)continue;
   if(type!=='ImportDeclaration'||ds.type?.value!=='Literal'||!ds.value||!('value'in ds.value)||get('options')!=null||get('phase')!=null||['attributes','assertions'].some(key=>get(key)!=null&&(!Array.isArray(get(key))||(get(key) as unknown[]).length!==0)))throw Error('diagnostic-zod-static-binding');
   matches.push({node:source,descriptor:ds.value});if(matches.length>1)throw Error('diagnostic-zod-binding-count');
  }
 }
 if(matches.length!==1)throw Error('diagnostic-zod-binding-count');const match=matches[0]!;
 Object.defineProperty(match.node,'value',{...match.descriptor,value:WORKER_ZOD_PUBLIC_BINDING.rawSpecifier});
 try{return collectWorkerModuleImports(ast).map(row=>row.specifier===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier?{...row,specifier:DIAGNOSTIC_ZOD_RAW_SPECIFIER}:row);}finally{Object.defineProperty(match.node,'value',match.descriptor);}
}
export function selectDiagnosticFrontendSource(root:string,id:string):string|null{
 if(!id.startsWith(root+'/'))return null;
 const path=relative(root,id.split('?')[0]!);
 if(path.includes('node_modules/'))return FRONTEND_VENDOR_PATHS.includes(path)?path:null;
 if(!ordinaryPath(path)||path.startsWith('..'))throw Error('diagnostic-module-path');
 return path;
}
export function createScrollCauseViteConfiguration(root:string,workspace:string):UserConfig{
 if(resolve(root)!==root||resolve(workspace)!==workspace)throw Error('diagnostic-build-path');
 const owned=createScrollCauseFrontendPlugin(root);
 const capture:Plugin={name:'unqualified-scroll-cause-emitted-proof',apply:'build',enforce:'post',generateBundle:{order:'post',async handler(_options,bundle){
  const ids=[...this.getModuleIds()];if(ids.length>16384||new Set(ids).size!==ids.length)throw Error('diagnostic-module-bound');
  const entries=Object.values(bundle);if(entries.length>PRODUCTION_FILE_LIMITS.hookFiles)throw Error('diagnostic-output-bound');
  const chunks=entries.filter(x=>x.type==='chunk').map(x=>({path:x.fileName,moduleIds:[...x.moduleIds]}));
  if(chunks.some(x=>!ordinaryPath(x.path)||x.moduleIds.length>16384))throw Error('diagnostic-chunk-bound');
  const pins=new Map<string,ModulePin>();
  for(const id of ids){
   const path=selectDiagnosticFrontendSource(root,id);if(path===null)continue;
   const pin=diagnosticSourcePin(root,path),names=chunks.filter(x=>x.moduleIds.includes(id)).map(x=>x.path);
   const existing=pins.get(path);
   if(existing){if(existing.sha256!==pin.sha256)throw Error('diagnostic-source-changed');existing.chunks=[...new Set([...existing.chunks,...names])];}
   else{if(pins.size>=256)throw Error('diagnostic-pin-bound');pins.set(path,{...pin,chunks:names});}
  }
  for(const path of FRONTEND_VENDOR_PATHS)if(!pins.has(path))throw Error('diagnostic-vendor-source-unobserved');
  const unique=(path:string)=>ids.filter(id=>id===join(root,path)).length;
  const sharedObserver={bridgeModules:unique('apps/copilotkit/src/scroll-cause-frontend.ts'),ledgerModules:unique('apps/copilotkit/src/scroll-cause-diagnostic.ts'),vendorModules:unique(FRONTEND_VENDOR_PATHS[0]!)};
  if(Object.values(sharedObserver).some(x=>x!==1)||['apps/copilotkit/src/scroll-cause-frontend.ts','apps/copilotkit/src/scroll-cause-diagnostic.ts',FRONTEND_VENDOR_PATHS[0]!].some(path=>!pins.get(path)?.chunks.length))throw Error('diagnostic-singleton-unobserved');
  const original=readFileSync(join(root,'apps/copilotkit/index.html'),'utf8'),redirected=redirectScrollCauseHtml(original);
  const result={schemaVersion:1,context:'LOCAL_TEST_OR_HOSTED_CALLER_BOUND_BUILD_BYTES_ONLY',coverage:'diagnostic-owned-and-instrumented-modules',fullDependencyGraph:'unqualified',sharedObserver,
   transform:owned.receipt(),html:{originalSha256:diagnosticHash(original),redirectedSha256:diagnosticHash(redirected),originalLaunchCalls:1},modules:[...pins.values()],
   emittedChunks:entries.filter(x=>x.type==='chunk').map(x=>({path:x.fileName,bytes:Buffer.byteLength(x.code),sha256:diagnosticHash(x.code)})),qualification:false};
  const raw=Buffer.from(JSON.stringify(result)+'\n');if(raw.length>1048576)throw Error('diagnostic-build-metadata-cap');
  const file=await open(join(workspace,'frontend-hook.json'),'wx',0o600);try{await file.writeFile(raw);await file.sync();}finally{await file.close();}
 }}};
 return {root:join(root,'apps/copilotkit'),mode:'production',plugins:[owned.plugin,capture],build:{...productionAssetOptions(),outDir:join(workspace,'dist'),emptyOutDir:false,minify:true,sourcemap:false,manifest:true,rolldownOptions:{output:productionEsmOutputOptions()}}};
}
export async function diagnosticFrontendInventory(root:string){
 const files:FileFact[]=[];let visited=0,total=0;
 async function visit(directory:string){
  const handle=await opendir(directory);
  for await(const item of handle){if(++visited>PRODUCTION_FILE_LIMITS.visitedEntries)throw Error('diagnostic-frontend-entries');const path=join(directory,item.name),stat=lstatSync(path);
   if(stat.isSymbolicLink())throw Error('diagnostic-frontend-symlink');if(stat.isDirectory()){await visit(path);continue;}
   if(!stat.isFile()||stat.nlink!==1||files.length>=PRODUCTION_FILE_LIMITS.outputFiles||stat.size>16777216||(total+=stat.size)>67108864)throw Error('diagnostic-frontend-bound');
   const name=relative(root,path);if(!ordinaryPath(name))throw Error('diagnostic-frontend-path');
   const raw=await readFile(path),after=lstatSync(path);if(raw.length!==stat.size||after.ino!==stat.ino||after.dev!==stat.dev||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs||after.nlink!==1)throw Error('diagnostic-frontend-changed');
   files.push({path:name,bytes:raw.length,sha256:diagnosticHash(raw),regular:true,contained:true,symlink:false});
  }
 }
 if(await realpath(root)!==root)throw Error('diagnostic-frontend-root');await visit(root);files.sort((a,b)=>a.path.localeCompare(b.path));return assertProductionOutputInventory(files);
}
export async function buildScrollCauseFrontend(root:string,workspace:string){
 if(await realpath(root)!==root||await realpath(workspace)!==workspace)throw Error('diagnostic-build-directory');
 const directory=await opendir(workspace);let empty=true;for await(const _item of directory){empty=false;break;}if(!empty)throw Error('diagnostic-build-not-fresh');
 await mkdir(join(workspace,'dist'));
 const {build,version}=await import('vite');const {VERSION}=await import('rolldown');
 const previous=process.env.SCROLL_CAUSE_BUILD_WORKSPACE;process.env.SCROLL_CAUSE_BUILD_WORKSPACE=workspace;
 try{await build({configFile:join(root,'apps/copilotkit/vite.scroll-cause.config.ts'),configLoader:'native'});}finally{if(previous===undefined)delete process.env.SCROLL_CAUSE_BUILD_WORKSPACE;else process.env.SCROLL_CAUSE_BUILD_WORKSPACE=previous;}
 const report=JSON.parse(await readFile(join(workspace,'frontend-hook.json'),'utf8')) as {context:string;sharedObserver:{bridgeModules:number;ledgerModules:number;vendorModules:number};html:{originalSha256:string;redirectedSha256:string;originalLaunchCalls:1};transform:ScrollCauseTransform;modules:ModulePin[];emittedChunks:{path:string;bytes:number;sha256:string}[];qualification:false};
 for(const pin of report.modules){const actual=diagnosticSourcePin(root,pin.path);if(actual.bytes!==pin.bytes||actual.sha256!==pin.sha256)throw Error('diagnostic-source-changed');}
 reverseScrollCause(report.transform);
 const inventory=await diagnosticFrontendInventory(join(workspace,'dist'));
 for(const chunk of report.emittedChunks){const file=inventory.files.find(f=>f.path===chunk.path);if(!file||file.bytes!==chunk.bytes||file.sha256!==chunk.sha256)throw Error('diagnostic-emitted-chunk-changed');}
 return {...report,compiler:{provider:'vite+rolldown',version:`${version}/${VERSION}`},inventory};
}
export async function buildScrollCauseWorker(root:string,runId:string){
 if(await realpath(root)!==root||!/^[1-9][0-9]{0,19}$/.test(runId))throw Error('diagnostic-worker-context');
 const entry=join(root,'apps/copilotkit/hosted-scroll-cause-entry.ts');diagnosticSourcePin(root,'apps/copilotkit/hosted-scroll-cause-entry.ts');
 const {rolldown,VERSION}=await import('rolldown');
 const allowed=(id:string)=>MOUNTED_MODULE_BUILTINS.some(x=>x===id)||Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,id);
 const modules:ModulePin[]=[],compilerDependencies:unknown[]=[],requested=new Set<string>();let observed=false,hookHash='',hookBytes=0,bundledDependencyModules=0;
 const external=(id:string)=>{const accepted=allowed(id);if(accepted)requested.add(id);return accepted;};
 const bundle=await rolldown({input:entry,cwd:root,platform:'node',tsconfig:false,preserveEntrySignatures:'strict',resolve:workerStaticResolveOptions(root),external,
  plugins:[{name:'unqualified-scroll-cause-worker-proof',generateBundle(_options,outputs){
   if(observed)throw Error('diagnostic-worker-repeated');observed=true;
   const entries=Object.values(outputs);if(entries.length!==1||entries[0]?.type!=='chunk'||entries[0].facadeModuleId!==entry||!entries[0].isEntry)throw Error('diagnostic-worker-output');
   const chunk=entries[0];hookHash=diagnosticHash(chunk.code);hookBytes=Buffer.byteLength(chunk.code);if(hookBytes<1||hookBytes>16777216)throw Error('diagnostic-worker-cap');
   const ids=[...this.getModuleIds()];if(ids.length>16384)throw Error('diagnostic-worker-module-bound');
   for(const [index,id] of ids.entries()){const info=this.getModuleInfo(id),observation=observeWorkerRegisteredModule(id,index,info,requested.has(id));
    if(observation.role==='configured-external')continue;
    if(observation.role==='compiler-registered-dependency'){compilerDependencies.push(observation);continue;}
    if(id.startsWith('\0')||id.startsWith('virtual:'))continue;
    if(!id.startsWith(root+'/'))throw Error('diagnostic-worker-unowned-module');
    if(id.includes('/node_modules/')){diagnosticSourcePin(root,relative(root,id));bundledDependencyModules++;continue;}
    if(modules.length>=256)throw Error('diagnostic-worker-pin-bound');modules.push({...diagnosticSourcePin(root,relative(root,id)),chunks:chunk.moduleIds.includes(id)?['worker.mjs']:[]});
   }
  }}]});
 let generated:Awaited<ReturnType<typeof bundle.generate>>;
 try{generated=await bundle.generate({...workerStaticOutputOptions(),paths:{zod:DIAGNOSTIC_ZOD_RAW_SPECIFIER}});}finally{await bundle.close();}
 if(!observed||generated.output.length!==1||generated.output[0]?.type!=='chunk')throw Error('diagnostic-worker-unobserved');
 const output=generated.output[0];if(diagnosticHash(output.code)!==hookHash||Buffer.byteLength(output.code)!==hookBytes)throw Error('diagnostic-worker-output-changed');
 const {parseAst}=await import('rolldown/parseAst'),imports=collectDiagnosticWorkerImports(parseAst(output.code));
 for(const row of imports)if(!MOUNTED_MODULE_BUILTINS.some(x=>x===row.specifier)&&row.specifier!==DIAGNOSTIC_ZOD_RAW_SPECIFIER&&(!lookupWorkerPublicPackage(row.specifier)||row.specifier===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier))throw Error('diagnostic-worker-import');
 if(!imports.some(row=>row.kind==='static'&&row.specifier===DIAGNOSTIC_ZOD_RAW_SPECIFIER)||!modules.some(p=>p.path===WORKER_ZOD_PUBLIC_BINDING.sourceParent))throw Error('diagnostic-worker-public-zod-binding');
 const accepted=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8')),installed=JSON.parse(await readFile(join(root,'node_modules/.package-lock.json'),'utf8')),packages=[];
 for(const [path,pin] of Object.entries(SCROLL_CAUSE_PACKAGE_PROFILE.packages)){
  const fact=diagnosticSourcePin(root,path+'/package.json'),manifest=JSON.parse(await readFile(join(root,path,'package.json'),'utf8'));
  if(manifest.version!==pin.version||accepted.packages?.[path]?.version!==pin.version||accepted.packages?.[path]?.integrity!==pin.integrity||installed.packages?.[path]?.version!==pin.version||installed.packages?.[path]?.integrity!==pin.integrity)throw Error('diagnostic-installed-package');packages.push({...fact,version:pin.version,integrity:pin.integrity});
 }
 let parent=root;
 for(const part of ['apps','copilotkit','artifacts','scroll-cause']){parent=join(parent,part);try{await mkdir(parent);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}const stat=lstatSync(parent);if(!stat.isDirectory()||stat.isSymbolicLink()||await realpath(parent)!==parent)throw Error('diagnostic-worker-directory');}
 const directory=join(parent,runId+'-1');await mkdir(directory);const worker=join(directory,'worker.mjs');
 if(new URL(DIAGNOSTIC_ZOD_RAW_SPECIFIER,pathToFileURL(worker)).href!==pathToFileURL(join(root,'node_modules/zod/index.js')).href)throw Error('diagnostic-worker-zod-path');
 diagnosticSourcePin(root,'node_modules/zod/index.js');
 const handle=await open(worker,'wx',0o600);try{await handle.writeFile(output.code);await handle.sync();}finally{await handle.close();}
 const launchPath=relative(root,worker),physical=diagnosticSourcePin(root,launchPath);if(physical.bytes!==hookBytes||physical.sha256!==hookHash)throw Error('diagnostic-worker-write-changed');
 for(const pin of modules){const actual=diagnosticSourcePin(root,pin.path);if(actual.bytes!==pin.bytes||actual.sha256!==pin.sha256)throw Error('diagnostic-worker-source-changed');}
 return {context:'LOCAL_TEST_OR_HOSTED_CALLER_BOUND_BUILD_BYTES_ONLY',packageProfile:SCROLL_CAUSE_PACKAGE_PROFILE.id,launchPath,launchFileUrl:pathToFileURL(worker).href,artifactPath:'diagnostic-worker.mjs',bytes:physical.bytes,sha256:physical.sha256,modules,imports,packages,compilerDependencies,bundledDependencyModules,importGuard:{scope:'diagnostic-binding-adapter-and-unchanged-loader-syntax-guard',normalAdmission:false},compiler:{provider:'rolldown',version:VERSION},qualification:false,fullDependencyGraph:'unqualified'};
}
export async function validateDiagnosticInstalledPackages(root:string){
 const accepted=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8')),installed=JSON.parse(await readFile(join(root,'node_modules/.package-lock.json'),'utf8')),packages=[];
 for(const [path,pin] of Object.entries(SCROLL_CAUSE_PACKAGE_PROFILE.packages)){
  const fact=diagnosticSourcePin(root,path+'/package.json'),manifest=JSON.parse(await readFile(join(root,path,'package.json'),'utf8'));
  if(manifest.version!==pin.version||accepted.packages?.[path]?.version!==pin.version||accepted.packages?.[path]?.integrity!==pin.integrity||installed.packages?.[path]?.version!==pin.version||installed.packages?.[path]?.integrity!==pin.integrity)throw Error('diagnostic-installed-package');packages.push({...fact,version:pin.version,integrity:pin.integrity});
 }return packages;
}
