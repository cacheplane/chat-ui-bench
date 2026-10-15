import {describe,it,expect} from 'vitest';
import {collectJsReferences,collectHtmlReferences,collectCssReferences,assertParserTreeBounds} from './hosted-copilot-static-assets.ts';
const literal=(value:unknown)=>({type:'Literal',value});
const program=(body:unknown[])=>({type:'Program',body});
describe('inert complete supported asset projections',()=>{
 it('collects duplicate static and dynamic module occurrences',()=>expect(collectJsReferences(program([{type:'ImportDeclaration',source:literal('./a.js')},{type:'ExportNamedDeclaration',source:literal('./a.js')},{type:'ImportExpression',source:literal('./b.js')}]))).toEqual(['./a.js','./a.js','./b.js']));
 it('rejects computed dynamic import',()=>expect(()=>collectJsReferences(program([{type:'ImportExpression',source:{type:'Identifier',name:'x'}}]))).toThrow());
 it('ignores ordinary endpoint strings',()=>expect(collectJsReferences(program([{type:'Literal',value:'https://endpoint.invalid'}]))).toEqual([]));
 it('retains explicit import-meta new URL assets',()=>expect(collectJsReferences(program([{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[literal('./icon.png'),{type:'MemberExpression',computed:false,object:{type:'MetaProperty',meta:{name:'import'},property:{name:'meta'}},property:{type:'Identifier',name:'url'}}]}]))).toEqual(['./icon.png']));
 it('denies computed import-meta URL specifiers',()=>expect(()=>collectJsReferences(program([{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Identifier',name:'x'},{type:'MemberExpression',computed:false,object:{type:'MetaProperty',meta:{name:'import'},property:{name:'meta'}},property:{type:'Identifier',name:'url'}}]}]))).toThrow());
 it('walks template content and inline scripts/styles',()=>expect(collectHtmlReferences({nodeName:'#document',childNodes:[{tagName:'template',attrs:[],content:{childNodes:[{tagName:'img',attrs:[{name:'src',value:'./x.png'}]}]}},{tagName:'script',attrs:[{name:'type',value:'module'}],childNodes:[{nodeName:'#text',value:'import "./x.js"'}]},{tagName:'style',attrs:[],childNodes:[{nodeName:'#text',value:'.x{}'}]}]})).toEqual({references:['./x.png'],scripts:['import "./x.js"'],styles:['.x{}']}));
 for(const attr of ['srcset','srcdoc','onload']) it(`denies HTML ${attr}`,()=>expect(()=>collectHtmlReferences({tagName:'img',attrs:[{name:attr,value:'x'}]})).toThrow());
 it('denies base elements',()=>expect(()=>collectHtmlReferences({tagName:'base',attrs:[]})).toThrow());
 it('retains CSS import and URL occurrences',()=>expect(collectCssReferences([{type:'import',url:'./a.css'},{type:'url',url:'#mask'}])).toEqual(['./a.css','#mask']));
 it('denies unsupported CSS dependencies',()=>expect(()=>collectCssReferences([{type:'glob',glob:'**'}])).toThrow());
 it('denies reference occurrence overflow',()=>expect(()=>collectJsReferences(program(Array.from({length:4097},()=>({type:'ImportDeclaration',source:literal('./a.js')}))))).toThrow());
 it('denies excessive depth',()=>{let ast:unknown=program([]);for(let i=0;i<258;i++)ast={type:'BlockStatement',body:[ast]};expect(()=>collectJsReferences(ast)).toThrow();});
});

it('bounds every CSS projected object and nested array',()=>{let value:unknown={};for(let i=0;i<258;i++)value={value};expect(()=>assertParserTreeBounds(value)).toThrow();});

it('denies HTML refresh and scripting-disabled resource ambiguity',()=>{expect(()=>collectHtmlReferences({tagName:'meta',attrs:[{name:'http-equiv',value:'refresh'},{name:'content',value:'0;url=https://x.invalid'}]})).toThrow();expect(()=>collectHtmlReferences({tagName:'noscript',attrs:[],childNodes:[]})).toThrow();});

describe('recognized static URL candidates exclude ordinary endpoint construction',()=>{
 it('leaves an ordinary endpoint URL constructor outside static asset references',()=>expect(collectJsReferences({type:'Program',body:[{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Identifier',name:'runtimePath'},{type:'Identifier',name:'runtimeBase'}]}]})).toEqual([]));
 it('denies computed import.meta member bases rather than dropping asset intent',()=>expect(()=>collectJsReferences({type:'Program',body:[{type:'NewExpression',callee:{type:'Identifier',name:'URL'},arguments:[{type:'Literal',value:'./x.png'},{type:'MemberExpression',computed:true,object:{type:'MetaProperty',meta:{type:'Identifier',name:'import'},property:{type:'Identifier',name:'meta'}},property:{type:'Identifier',name:'which'}}]}]})).toThrow());
 it('denies dynamic import options',()=>expect(()=>collectJsReferences({type:'Program',body:[{type:'ImportExpression',source:{type:'Literal',value:'./x.js'},options:{type:'ObjectExpression',properties:[]}}]})).toThrow());
});

import * as productionAssets from './hosted-copilot-static-assets.ts';
import * as productionContract from './hosted-copilot-contract.ts';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
describe('production output capacity v3 owned collectors',()=>{
 async function owned(action:(root:string)=>Promise<void>){const raw=await mkdtemp(join(tmpdir(),'copilot-production-capacity-v3-')),root=await realpath(raw);try{await action(root);}finally{await rm(root,{recursive:true,force:true});}}
 it('collects129 tiny files through output and artifact paths without parsers or admission',async()=>owned(async root=>{await mkdir(join(root,'dist','assets'),{recursive:true});for(let i=0;i<129;i++)await writeFile(join(root,'dist','assets',`${i}.js`),'x');const output=await productionAssets.collectProductionOutput(join(root,'dist')),artifact=await productionAssets.collectProductionArtifact(root);expect(output.files).toHaveLength(129);expect(output.visitedEntries).toBe(130);expect(artifact.files).toHaveLength(129);expect(artifact.visitedEntries).toBe(131);expect(artifact.bytes).toBe(129);expect(output.byteMap.get('assets/0.js')).toEqual(Buffer.from('x'));expect(output.files[0]!.sha256).toBe(createHash('sha256').update('x').digest('hex'));expect('byteMap' in artifact).toBe(false);}));
 it('collects the reserved hidden output manifest path as an ordinary owned file',async()=>owned(async root=>{await mkdir(join(root,'.vite'));await writeFile(join(root,'.vite','manifest.json'),'{}');const output=await productionAssets.collectProductionOutput(root);expect(output.files.map(value=>value.path)).toEqual(['.vite/manifest.json']);expect(output.visitedEntries).toBe(2);}));
 it('rejects symlink output root and child without following them',async()=>owned(async root=>{await mkdir(join(root,'actual'));await writeFile(join(root,'actual','a.js'),'x');await symlink('actual',join(root,'alias'));await expect(productionAssets.collectProductionOutput(join(root,'alias'))).rejects.toThrow();await expect(productionAssets.collectProductionOutput(root)).rejects.toThrow();}));
 it('rejects artifact filenames and directories outside existing whitelist',async()=>owned(async root=>{await writeFile(join(root,'unexpected.txt'),'x');await expect(productionAssets.collectProductionArtifact(root)).rejects.toThrow();await rm(join(root,'unexpected.txt'));await mkdir(join(root,'unexpected'));await expect(productionAssets.collectProductionArtifact(root)).rejects.toThrow();}));
 it('refuses an already-present final inventory before publication',async()=>owned(async root=>{await writeFile(join(root,'artifact-inventory.json'),'{}');const collected=await productionAssets.collectProductionArtifact(root);expect(()=>productionContract.assertProductionFinalInventory(collected.files,collected.visitedEntries,10)).toThrow('pre-existing');}));
});

import {projectHookFacts as projectHookFactsWithProfile,type HookFile} from './hosted-copilot-build-plugin.ts';
const compilerProfile={provider:'rolldown' as const,version:'1.2.13' as const,runtimeModuleId:'\0rolldown/runtime.js'};
function projectHookFacts(input:readonly HookFile[],modules:Parameters<typeof projectHookFactsWithProfile>[1]){return projectHookFactsWithProfile(input,modules,compilerProfile,[]);}
import * as metadataPolicy from './hosted-copilot-production-policy.ts';
describe('supported static graph v5',()=>{
 const owner='assets/main.js',missing='assets/katex.min-BuSKZrD3.js';
 const hook:HookFile={fileName:owner,kind:'chunk',contentSha256:'b'.repeat(64),imports:[],dynamicImports:[missing],moduleIds:[],originalNames:[],facadeModuleId:null};
 const file=(path:string)=>({path,bytes:1,sha256:'b'.repeat(64),regular:true,contained:true,symlink:false});
 const output=[file(owner),file('.vite/manifest.json')];
 const facts=()=>projectHookFacts([hook],[]);
 it('recomputes metadata against hook names rather than final manifest filename',()=>{
  const h=projectHookFacts([{...hook,imports:['.vite/manifest.json']}],[]),verified=productionAssets.assertHookSnapshot(h,output);
  expect(verified.metadataReferences[0]).toMatchObject({raw:'.vite/manifest.json',membership:'absent-from-hook-snapshot'});expect(verified.metadataOccurrenceCount).toBe(2);
 });
 it('retains metadata-only absence while transformed supplied code has no import',()=>{
  const h=productionAssets.assertHookSnapshot(facts(),output),ast=program([{type:'ExpressionStatement',expression:{type:'CallExpression',callee:{type:'MemberExpression',object:{type:'Identifier',name:'Promise'},property:{type:'Identifier',name:'resolve'}},arguments:[{type:'ObjectExpression',properties:[]}]}}]);
  expect(h.metadataOccurrenceCount).toBe(1);expect(collectJsReferences(ast)).toEqual([]);
 });
 it.each(['import','dynamic-import'])('still rejects an actual missing %s from the same supplied AST normalizer',kind=>{
  const ast=program([kind==='import'?{type:'ImportDeclaration',source:literal('./katex.min-BuSKZrD3.js')}:{type:'ImportExpression',source:literal('./katex.min-BuSKZrD3.js')}]);
  const raw=collectJsReferences(ast);expect(raw).toEqual(['./katex.min-BuSKZrD3.js']);
  expect(()=>raw.map(value=>metadataPolicy.normalizeProductionReference(owner,value,output.map(f=>f.path)))).toThrow('Unresolved');
 });
 it('denies external and computed actual imports without consulting metadata',()=>{
  expect(()=>collectJsReferences(program([{type:'ImportExpression',source:literal('https://outside.invalid/x.js')}]))).toThrow();
  expect(()=>collectJsReferences(program([{type:'ImportExpression',source:{type:'Identifier',name:'x'}}]))).toThrow();
 });
 it('rejects omitted classifications even when caller also changes declared count',()=>{
  const h=facts();expect(()=>productionAssets.assertHookSnapshot({...h,metadataReferences:[],metadataOccurrenceCount:0},output)).toThrow();
 });
 it('rejects altered membership, raw name, index, owner, kind and extra classification keys',()=>{
  const h=facts();for(const change of [{membership:'present-in-hook-snapshot'},{raw:'other.js'},{index:1},{from:'other.js'},{kind:'import'},{extra:true}]) {const declared=h.metadataReferences.map(r=>({...r}));for(const [key,value]of Object.entries(change))Object.defineProperty(declared[0]!,key,{value,enumerable:true});expect(()=>productionAssets.assertHookSnapshot({...h,metadataReferences:declared},output)).toThrow();}
 });
 it('rejects changed raw arrays, reordered occurrences and wrong declared count',()=>{
  const h=projectHookFacts([{...hook,imports:['x.js','y.js']}],[]);
  expect(()=>productionAssets.assertHookSnapshot({...h,files:[{...hook,imports:['changed.js']}]},output)).toThrow();
  expect(()=>productionAssets.assertHookSnapshot({...h,metadataReferences:[...h.metadataReferences].reverse()},output)).toThrow();
  expect(()=>productionAssets.assertHookSnapshot({...h,metadataOccurrenceCount:0},output)).toThrow();
 });
 it('preserves final physical hash, hook-set, module and facade refusals',()=>{
  const h=facts();expect(()=>productionAssets.assertHookSnapshot(h,[{...file(owner),sha256:'a'.repeat(64)},file('.vite/manifest.json')])).toThrow('physical bytes');
  expect(()=>productionAssets.assertHookSnapshot(h,[file('.vite/manifest.json')])).toThrow();
  expect(()=>productionAssets.assertHookSnapshot(h,[...output,file('extra.js')])).toThrow('hook inventory');
  expect(()=>productionAssets.assertHookSnapshot({...h,files:[{...hook,moduleIds:['unknown']}]},output)).toThrow();
  expect(()=>productionAssets.assertHookSnapshot({...h,files:[{...hook,facadeModuleId:'unknown'}]},output)).toThrow();
 });
 it('separates graph edges from metadata and manifest-owner budget charges',()=>{
  expect(metadataPolicy.projectStaticReferenceCounts({metadataOccurrences:1,manifestOwnerOccurrences:1,manifestEdgeOccurrences:1,parsedEdgeOccurrences:4093})).toEqual({metadataOccurrences:1,manifestOwnerOccurrences:1,manifestEdgeOccurrences:1,parsedEdgeOccurrences:4093,referenceBudgetCharges:4096,staticGraphReferenceOccurrences:4094});
  expect(()=>metadataPolicy.projectStaticReferenceCounts({metadataOccurrences:1,manifestOwnerOccurrences:1,manifestEdgeOccurrences:1,parsedEdgeOccurrences:4094})).toThrow('Reference occurrence overflow');
 });
 it('keeps manifest owners and actual targets strict',()=>{
  const record={key:'entry',file:owner,imports:['absent-key'],dynamicImports:[],css:[],assets:[]};
  expect(()=>metadataPolicy.assertProductionManifest([record],output.map(f=>f.path))).toThrow('key missing');
  expect(()=>metadataPolicy.assertProductionManifest([{...record,imports:[],css:['missing.css']}],output.map(f=>f.path))).toThrow('resource missing');
 });
 it('does not invent complete preload-helper coverage from arbitrary strings',()=>{
  expect(collectJsReferences(program([{type:'VariableDeclaration',declarations:[{type:'VariableDeclarator',init:{type:'ArrayExpression',elements:[literal('missing.css')]}}]}]))).toEqual([]);
 });
});

describe('compiler runtime static snapshot v7',()=>{
 const marker=compilerProfile.runtimeModuleId,name='assets/any-compiler-chunk.js',hook:HookFile={fileName:name,kind:'chunk',contentSha256:'b'.repeat(64),imports:[],dynamicImports:[],moduleIds:[marker,marker],originalNames:[],facadeModuleId:null};
 const physical=(path:string)=>({path,bytes:1,sha256:'b'.repeat(64),regular:true,contained:true,symlink:false}),files=[physical(name),physical('.vite/manifest.json')];
 const facts=()=>projectHookFactsWithProfile([hook],[],compilerProfile,[{id:marker,moduleInfo:null}]);
 it('recomputes separate owner identity while preserving all raw occurrences and zero resource charge',()=>{
  const hooks=facts(),snapshot=productionAssets.assertHookSnapshot(hooks,files);expect(snapshot.compilerProfile).toEqual(compilerProfile);expect(snapshot.compilerRuntimeModules).toEqual(hooks.compilerRuntimeModules);expect(snapshot.metadataOccurrenceCount).toBe(0);expect(hooks.files[0]!.moduleIds).toEqual([marker,marker]);
  expect(metadataPolicy.projectStaticReferenceCounts({metadataOccurrences:0,manifestOwnerOccurrences:1,manifestEdgeOccurrences:0,parsedEdgeOccurrences:0}).referenceBudgetCharges).toBe(1);
 });
 it('rejects schema2 and missing/extra/duplicate/altered owner state or profile',()=>{
  const hooks=facts(),owner=hooks.compilerRuntimeModules[0]!;
  for(const changed of [{schemaVersion:2},{compilerProfile:{...compilerProfile,version:'wrong'}},{compilerRuntimeModules:[]},{compilerRuntimeModules:[owner,owner]},{compilerRuntimeModules:[{...owner,id:'unknown'}]},{compilerRuntimeModules:[{...owner,moduleInfo:{}}]},{compilerRuntimeModules:[{...owner,external:false}]},{compilerRuntimeModules:[{...owner,sourceEnumeration:'present'}]},{compilerRuntimeModules:[{...owner,extra:true}]}])expect(()=>productionAssets.assertHookSnapshot({...hooks,...changed} as unknown as productionAssets.HookFacts,files)).toThrow();
  expect(()=>productionAssets.assertHookSnapshot({...hooks,files:[{...hook,moduleIds:[]}]},files)).toThrow();
 });
 it('rejects source-registry overlap, runtime facade, unknown ID and original physical hash tamper',()=>{
  const hooks=facts();for(const changed of [{modules:[{id:marker,kind:'virtual',external:false}]},{files:[{...hook,facadeModuleId:marker}]},{files:[{...hook,moduleIds:[marker,'unknown']}]}])expect(()=>productionAssets.assertHookSnapshot({...hooks,...changed} as unknown as productionAssets.HookFacts,files)).toThrow();
  expect(()=>productionAssets.assertHookSnapshot(hooks,[{...files[0]!,sha256:'a'.repeat(64)},files[1]!])).toThrow('physical bytes');
 });
 it('applies identical missing static/dynamic resource resolution to runtime chunks',()=>{
  for(const type of ['ImportDeclaration','ImportExpression']){const refs=collectJsReferences(program([{type,source:literal('./missing.js')}]));expect(refs).toEqual(['./missing.js']);expect(()=>refs.map(raw=>metadataPolicy.normalizeProductionReference(name,raw,files.map(f=>f.path)))).toThrow('Unresolved');}
  expect(()=>collectJsReferences(program([{type:'ImportExpression',source:{type:'Identifier',name:'computed'}}]))).toThrow();
  expect(()=>metadataPolicy.assertProductionManifest([{key:'runtime',file:name,imports:[],dynamicImports:[],css:['missing.css'],assets:[]}],files.map(f=>f.path))).toThrow();
 });
});
