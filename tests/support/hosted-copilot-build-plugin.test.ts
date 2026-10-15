import {mkdtempSync,writeFileSync,symlinkSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describe,it,expect} from 'vitest';
import {projectHookFacts,readPhysicalSource,type HookFile} from './hosted-copilot-build-plugin.ts';
const row:HookFile={contentSha256:'b'.repeat(64),fileName:'assets/main.js',kind:'chunk',imports:[],dynamicImports:[],moduleIds:['/owned/source.js'],originalNames:[],facadeModuleId:'/owned/source.js'};
const module={id:'/owned/source.js',kind:'physical' as const,path:'source.js',sha256:'a'.repeat(64),external:false};
describe('module ownership is independent of resource references',()=>{
 const modules=(count:number)=>Array.from({length:count},(_,index)=>({id:`\0virtual:${index}`,kind:'virtual' as const,external:false}));
 it.each([9212,16384])('retains every one of %i chunk module IDs',count=>{const owned=modules(count),ids=owned.map(value=>value.id);const facts=projectHookFacts([{...row,moduleIds:ids,facadeModuleId:ids[0]!,imports:Array(2048).fill(row.fileName),dynamicImports:Array(2048).fill(row.fileName)}],owned);expect(facts.files[0]!.moduleIds).toEqual(ids);expect(facts.modules).toHaveLength(count);expect(facts.referenceCount).toBe(4096);expect(facts.qualification).toBe(false);});
 it('denies16385 chunk module IDs before reading elements',()=>{const owned=modules(16384),ids=Array<string>(16385).fill(owned[0]!.id);let reads=0;Object.defineProperty(ids,0,{get(){reads++;throw new Error('module ID accessed');}});expect(()=>projectHookFacts([{...row,moduleIds:ids,facadeModuleId:null}],owned)).toThrow('Array entry bound');expect(reads).toBe(0);});
 it('denies sparse module IDs inside the new capacity',()=>{const owned=modules(16384);expect(()=>projectHookFacts([{...row,moduleIds:new Array<string>(9212),facadeModuleId:null}],owned)).toThrow('Sparse array entries denied');});
 it('keeps original asset names bounded to4096',()=>{expect(projectHookFacts([{...row,originalNames:Array(4096).fill('source.js')}],[module]).files[0]!.originalNames).toHaveLength(4096);expect(()=>projectHookFacts([{...row,originalNames:Array(4097).fill('source.js')}],[module])).toThrow();});
 it('denies4097 combined resource occurrences with many owned modules',()=>{const owned=modules(9212);expect(()=>projectHookFacts([{...row,moduleIds:owned.map(value=>value.id),facadeModuleId:null,imports:Array(2048).fill(row.fileName),dynamicImports:Array(2049).fill(row.fileName)}],owned)).toThrow('Reference occurrence overflow');});
});
describe('supplied production bundle hook facts',()=>{
 it('owns input metadata without a factory or build',()=>{const v=projectHookFacts([row],[module]);expect(v.schemaVersion).toBe(1);expect(v.files[0]!.fileName).toBe(row.fileName);expect(Object.isFrozen(v.files[0])).toBe(true);});
 it('denies sparse output rows',()=>expect(()=>projectHookFacts(new Array(1),[module])).toThrow());
 it('denies unknown referenced chunk',()=>expect(()=>projectHookFacts([{...row,imports:['missing.js']}],[module])).toThrow());
 it('denies source-map/escape output names',()=>{expect(()=>projectHookFacts([{...row,fileName:'main.js.map'}],[module])).toThrow();expect(()=>projectHookFacts([{...row,fileName:'../main.js'}],[module])).toThrow();});
 it('denies unknown module IDs and duplicate file names',()=>{expect(()=>projectHookFacts([row],[])).toThrow();expect(()=>projectHookFacts([row,row],[module])).toThrow();});
 it('denies4097 hook reference occurrences',()=>expect(()=>projectHookFacts([{...row,imports:Array(4097).fill(row.fileName)}],[module])).toThrow());
});

describe('original physical module path metadata',()=>{
 it('rejects original-file symlink before canonicalization',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));writeFileSync(join(root,'real.js'),'export {}');symlinkSync('real.js',join(root,'alias.js'));expect(()=>readPhysicalSource(join(root,'alias.js'),root)).toThrow('symlink');});
 it('rejects an original ancestor symlink',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));mkdirSync(join(root,'real'));writeFileSync(join(root,'real','a.js'),'export {}');symlinkSync('real',join(root,'alias'));expect(()=>readPhysicalSource(join(root,'alias','a.js'),root)).toThrow('symlink');});
 it('hashes contained stable ordinary source bytes',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));writeFileSync(join(root,'a.js'),'export {}');expect(readPhysicalSource(join(root,'a.js'),root)).toMatchObject({path:'a.js',sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});});
});

describe('hook content bytes stay linked to final physical inventory',()=>{
 it('denies missing captured content hash',()=>expect(()=>projectHookFacts([{...row,contentSha256:undefined}],[module])).toThrow());
});

describe('production output capacity v3 hook rows',()=>{
 const outputs=(count:number)=>Array.from({length:count},(_,i)=>({...row,fileName:`assets/${i}.js`,moduleIds:[],facadeModuleId:null}));
 it('retains129 original chunk and asset rows',()=>{const facts=projectHookFacts(outputs(129),[]);expect(facts.files).toHaveLength(129);expect(facts.qualification).toBe(false);});
 it('admits1024 output rows',()=>expect(projectHookFacts(outputs(1024),[]).files).toHaveLength(1024));
 it('rejects1025 rows before projecting payload or reading elements',()=>{const input=outputs(1025);let reads=0;Object.defineProperty(input,0,{get(){reads++;throw Error('hook payload read');}});expect(()=>projectHookFacts(input,[])).toThrow('production-hook-files observed=1025 limit=1024');expect(reads).toBe(0);});
 it('rejects sparse rows inside expanded capacity',()=>{const input=outputs(129);delete input[64];expect(()=>projectHookFacts(input,[])).toThrow('Sparse');});
 it('preserves unknown-reference and source-map refusals at larger capacity',()=>{const input=outputs(129);input[0]!.imports=['missing.js'];expect(()=>projectHookFacts(input,[])).toThrow();input[0]!.imports=[];input[0]!.fileName='main.js.map';expect(()=>projectHookFacts(input,[])).toThrow();});
 it('preserves4096 reference cap',()=>{const input=outputs(129);input[0]!.imports=Array(2048).fill(input[0]!.fileName);input[0]!.dynamicImports=Array(2049).fill(input[0]!.fileName);expect(()=>projectHookFacts(input,[])).toThrow('Reference occurrence overflow');});
});

describe('bounded hook reference diagnostics v4',()=>{
 const prefix='Unknown emitted hook reference ';
 function diagnostic(input:readonly HookFile[]) {
  let failure:unknown;
  try{projectHookFacts(input,[module]);}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(Error);
  const message=(failure as Error).message;
  expect(message.startsWith(prefix)).toBe(true);
  expect(Buffer.byteLength(message)).toBeLessThanOrEqual(32768);
  return JSON.parse(message.slice(prefix.length));
 }
 it.each(['import','dynamic-import'] as const)('identifies the first missing %s reference and its original index',kind=>{
  const input={...row,imports:kind==='import'?[row.fileName,'missing.js']:[],dynamicImports:kind==='dynamic-import'?[row.fileName,'missing.js']:[]};
  expect(diagnostic([input])).toEqual({from:row.fileName,kind,index:1,reference:{type:'string',value:'missing.js',utf8Bytes:10,truncated:false},hookFilesObserved:1});
 });
 it('retains file order and imports-before-dynamic precedence',()=>{
  const input=[{...row,imports:['first.js'],dynamicImports:['later.js']},{...row,fileName:'assets/other.js',imports:['other.js']}];
  expect(diagnostic(input)).toMatchObject({from:row.fileName,kind:'import',index:0,reference:{value:'first.js'},hookFilesObserved:2});
  expect(diagnostic([{...row,dynamicImports:['first-dynamic.js']},input[1]!])).toMatchObject({from:row.fileName,kind:'dynamic-import',reference:{value:'first-dynamic.js'}});
 });
 it('JSON-escapes control characters, quotes and backslashes without changing the reference',()=>{
  const value='bad\n\r\t\0"\\name.js';
  expect(diagnostic([{...row,imports:[value]}]).reference).toEqual({type:'string',value,utf8Bytes:Buffer.byteLength(value),truncated:false});
 });
 it('retains all4096 UTF8 bytes even with worst-case JSON escaping and maximum owner length',()=>{
  const value='\0'.repeat(4096),fileName='a'.repeat(1024);
  expect(diagnostic([{...row,fileName,imports:[value]}])).toMatchObject({from:fileName,reference:{type:'string',value,utf8Bytes:4096,truncated:false}});
 });
 it('labels the bounded prefix for4097 UTF8 bytes without changing refusal',()=>{
  const value='\0'.repeat(4097);
  expect(diagnostic([{...row,imports:[value]}]).reference).toEqual({type:'string',value:value.slice(0,1024),utf8Bytes:4097,truncated:true});
 });
 it('uses UTF8 bytes for full-text admission and UTF16 units for the labeled prefix',()=>{
  const full='🙂'.repeat(1024),long=full+'🙂';
  expect(diagnostic([{...row,imports:[full]}]).reference).toEqual({type:'string',value:full,utf8Bytes:4096,truncated:false});
  expect(diagnostic([{...row,imports:[long]}]).reference).toEqual({type:'string',value:long.slice(0,1024),utf8Bytes:4100,truncated:true});
 });
 it.each([null,undefined,123,true,1n,Symbol('private')])('reports malformed primitive type only for %s',value=>{
  const imports:string[]=[];Object.defineProperty(imports,0,{value});
  expect(diagnostic([{...row,imports}]).reference).toEqual({type:value===null?'null':typeof value,value:null,utf8Bytes:null,truncated:false});
 });
 it('never coerces or serializes a malformed supplied object',()=>{
  let calls=0;const value={toString(){calls++;throw Error('coercion');},toJSON(){calls++;throw Error('serialization');}};
  const imports:string[]=[];Object.defineProperty(imports,0,{value});
  expect(diagnostic([{...row,imports}]).reference).toEqual({type:'object',value:null,utf8Bytes:null,truncated:false});expect(calls).toBe(0);
 });
 it('keeps valid static and dynamic facts identical and frozen',()=>{
  const input={...row,imports:[row.fileName],dynamicImports:[row.fileName]},facts=projectHookFacts([input],[module]);
  expect(facts).toEqual({schemaVersion:1,files:[input],modules:[module],referenceCount:2,qualification:false});
  expect(Object.isFrozen(facts.files[0]!.imports)).toBe(true);expect(Object.isFrozen(facts.files[0]!.dynamicImports)).toBe(true);
 });
 it('keeps original source-map, sparse-array and combined-reference precedence',()=>{
  expect(()=>projectHookFacts([{...row,fileName:'main.js.map',imports:['missing.js']}],[module])).toThrow('Output file ownership unavailable');
  expect(()=>projectHookFacts([{...row,imports:new Array<string>(1)}],[module])).toThrow('Sparse array entries denied');
  expect(()=>projectHookFacts([{...row,imports:Array(2048).fill('missing.js'),dynamicImports:Array(2049).fill('missing.js')}],[module])).toThrow('Reference occurrence overflow');
 });
});
