import {mkdtempSync,writeFileSync,symlinkSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describe,it,expect} from 'vitest';
import {projectHookFacts,enrichOwnershipMismatch,readPhysicalSource,type HookFile} from './hosted-copilot-build-plugin.ts';
const row:HookFile={contentSha256:'b'.repeat(64),fileName:'assets/main.js',kind:'chunk',imports:[],dynamicImports:[],moduleIds:['/owned/source.js'],originalNames:[],facadeModuleId:'/owned/source.js'};
const module={id:'/owned/source.js',kind:'physical' as const,path:'source.js',sha256:'a'.repeat(64),external:false};
describe('module ownership is independent of resource references',()=>{
 const modules=(count:number)=>Array.from({length:count},(_,index)=>({id:`\0virtual:${index}`,kind:'virtual' as const,external:false}));
 it.each([9212,16384])('retains every one of %i chunk module IDs',count=>{const owned=modules(count),ids=owned.map(value=>value.id);const facts=projectHookFacts([{...row,moduleIds:ids,facadeModuleId:ids[0]!,imports:Array(2048).fill(row.fileName),dynamicImports:Array(2048).fill(row.fileName)}],owned);expect(facts.files[0]!.moduleIds).toEqual(ids);expect(facts.modules).toHaveLength(count);expect(facts.metadataOccurrenceCount).toBe(4096);expect(facts.qualification).toBe(false);});
 it('denies16385 chunk module IDs before reading elements',()=>{const owned=modules(16384),ids=Array<string>(16385).fill(owned[0]!.id);let reads=0;Object.defineProperty(ids,0,{get(){reads++;throw new Error('module ID accessed');}});expect(()=>projectHookFacts([{...row,moduleIds:ids,facadeModuleId:null}],owned)).toThrow('Array entry bound');expect(reads).toBe(0);});
 it('denies sparse module IDs inside the new capacity',()=>{const owned=modules(16384);expect(()=>projectHookFacts([{...row,moduleIds:new Array<string>(9212),facadeModuleId:null}],owned)).toThrow('Sparse array entries denied');});
 it('keeps original asset names bounded to4096',()=>{expect(projectHookFacts([{...row,originalNames:Array(4096).fill('source.js')}],[module]).files[0]!.originalNames).toHaveLength(4096);expect(()=>projectHookFacts([{...row,originalNames:Array(4097).fill('source.js')}],[module])).toThrow();});
 it('denies4097 combined resource occurrences with many owned modules',()=>{const owned=modules(9212);expect(()=>projectHookFacts([{...row,moduleIds:owned.map(value=>value.id),facadeModuleId:null,imports:Array(2048).fill(row.fileName),dynamicImports:Array(2049).fill(row.fileName)}],owned)).toThrow('Reference occurrence overflow');});
});
describe('supplied production bundle hook facts',()=>{
 it('owns input metadata without a factory or build',()=>{const v=projectHookFacts([row],[module]);expect(v.schemaVersion).toBe(2);expect(v.files[0]!.fileName).toBe(row.fileName);expect(Object.isFrozen(v.files[0])).toBe(true);});
 it('denies sparse output rows',()=>expect(()=>projectHookFacts(new Array(1),[module])).toThrow());
 it('retains absent bundler metadata independently of emitted resources',()=>expect(projectHookFacts([{...row,imports:['missing.js']}],[module]).metadataReferences[0]!.membership).toBe('absent-from-hook-snapshot'));
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
 it('retains absent metadata and source-map refusal at larger capacity',()=>{const input=outputs(129);input[0]!.imports=['missing.js'];expect(projectHookFacts(input,[]).metadataOccurrenceCount).toBe(1);input[0]!.imports=[];input[0]!.fileName='main.js.map';expect(()=>projectHookFacts(input,[])).toThrow();});
 it('preserves4096 reference cap',()=>{const input=outputs(129);input[0]!.imports=Array(2048).fill(input[0]!.fileName);input[0]!.dynamicImports=Array(2049).fill(input[0]!.fileName);expect(()=>projectHookFacts(input,[])).toThrow('Reference occurrence overflow');});
});

describe('bounded unsupported hook metadata diagnostics v5',()=>{
 const prefix='Unsupported hook metadata reference ';
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
  const input={...row,imports:kind==='import'?[row.fileName,'../missing.js']:[],dynamicImports:kind==='dynamic-import'?[row.fileName,'../missing.js']:[]};
  expect(diagnostic([input])).toEqual({from:row.fileName,kind,index:1,reference:{type:'string',value:'../missing.js',utf8Bytes:13,truncated:false},hookFilesObserved:1});
 });
 it('retains file order and imports-before-dynamic precedence',()=>{
  const input=[{...row,imports:['../first.js'],dynamicImports:['../later.js']},{...row,fileName:'assets/other.js',imports:['../other.js']}];
  expect(diagnostic(input)).toMatchObject({from:row.fileName,kind:'import',index:0,reference:{value:'../first.js'},hookFilesObserved:2});
  expect(diagnostic([{...row,dynamicImports:['../first-dynamic.js']},input[1]!])).toMatchObject({from:row.fileName,kind:'dynamic-import',reference:{value:'../first-dynamic.js'}});
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
  expect(facts).toEqual({schemaVersion:2,files:[input],modules:[module],metadataReferences:[{from:row.fileName,kind:'import',index:0,raw:row.fileName,membership:'present-in-hook-snapshot'},{from:row.fileName,kind:'dynamic-import',index:0,raw:row.fileName,membership:'present-in-hook-snapshot'}],metadataOccurrenceCount:2,qualification:false});
  expect(Object.isFrozen(facts.files[0]!.imports)).toBe(true);expect(Object.isFrozen(facts.files[0]!.dynamicImports)).toBe(true);
 });
 it('keeps original source-map, sparse-array and combined-reference precedence',()=>{
  expect(()=>projectHookFacts([{...row,fileName:'main.js.map',imports:['../missing.js']}],[module])).toThrow('Output file ownership unavailable');
  expect(()=>projectHookFacts([{...row,imports:new Array<string>(1)}],[module])).toThrow('Sparse array entries denied');
  expect(()=>projectHookFacts([{...row,imports:Array(2048).fill('../missing.js'),dynamicImports:Array(2049).fill('../missing.js')}],[module])).toThrow('Reference occurrence overflow');
 });
});

// Supplied hook data only; these cases never create a plugin or run a build.
describe('hook metadata v5',()=>{
 it('retains absent dynamic metadata without claiming an emitted resource',()=>{
  const raw='assets/katex.min-BuSKZrD3.js',facts=projectHookFacts([{...row,dynamicImports:[raw]}],[module]);
  expect(facts.schemaVersion).toBe(2);expect(facts.files[0]!.dynamicImports).toEqual([raw]);
  expect(facts.metadataReferences).toEqual([{from:row.fileName,kind:'dynamic-import',index:0,raw,membership:'absent-from-hook-snapshot'}]);
  expect(facts.metadataOccurrenceCount).toBe(1);expect(facts.qualification).toBe(false);
 });
 it('preserves file order, per-kind indexes, duplicates and exact names',()=>{
  const second={...row,fileName:'assets/other.js',imports:[row.fileName]},first={...row,imports:[second.fileName,'missing.js',second.fileName],dynamicImports:['missing.js']};
  const facts=projectHookFacts([first,second],[module]);
  expect(facts.metadataReferences).toEqual([
   {from:row.fileName,kind:'import',index:0,raw:second.fileName,membership:'present-in-hook-snapshot'},
   {from:row.fileName,kind:'import',index:1,raw:'missing.js',membership:'absent-from-hook-snapshot'},
   {from:row.fileName,kind:'import',index:2,raw:second.fileName,membership:'present-in-hook-snapshot'},
   {from:row.fileName,kind:'dynamic-import',index:0,raw:'missing.js',membership:'absent-from-hook-snapshot'},
   {from:second.fileName,kind:'import',index:0,raw:row.fileName,membership:'present-in-hook-snapshot'}]);
  expect(facts.metadataOccurrenceCount).toBe(5);
 });
 it('admits an ordinary1024-character absent name and rejects1025',()=>{
  expect(projectHookFacts([{...row,imports:['a'.repeat(1024)]}],[module]).metadataReferences[0]!.raw).toHaveLength(1024);
  expect(()=>projectHookFacts([{...row,imports:['a'.repeat(1025)]}],[module])).toThrow();
 });
 it.each(['../escape.js','https://outside.invalid/x.js','//outside/x.js','/root.js','a//b.js','a/./b.js','a/../b.js','a?x','a#x','a\\b.js','a\0b.js',''])('denies unsupported metadata name %s',raw=>expect(()=>projectHookFacts([{...row,imports:[raw]}],[module])).toThrow());
 it('charges all4096 raw occurrences including absent duplicates',()=>{
  const facts=projectHookFacts([{...row,imports:Array(2048).fill('missing.js'),dynamicImports:Array(2048).fill('missing.js')}],[module]);
  expect(facts.metadataOccurrenceCount).toBe(4096);expect(facts.metadataReferences).toHaveLength(4096);
  expect(()=>projectHookFacts([{...row,imports:Array(2048).fill('missing.js'),dynamicImports:Array(2049).fill('missing.js')}],[module])).toThrow('Reference occurrence overflow');
 });
 it('owns and freezes metadata independently of caller arrays',()=>{
  const imports=['missing.js'],facts=projectHookFacts([{...row,imports}],[module]);imports[0]='changed.js';
  expect(facts.files[0]!.imports).toEqual(['missing.js']);expect(facts.metadataReferences[0]!.raw).toBe('missing.js');expect(Object.isFrozen(facts.metadataReferences)).toBe(true);expect(Object.isFrozen(facts.metadataReferences[0])).toBe(true);
 });
});

// Supplied literals and callbacks only; no factory, SDK or bundler invocation.
describe('bounded emitted ownership diagnostics v6',()=>{
 function failure(input:readonly HookFile[]):Error {try{projectHookFacts(input,[module]);}catch(error){return error as Error;}throw Error('Expected ownership denial');}
 function report(error:Error) {expect(Buffer.byteLength(error.message)).toBeLessThan(32768);return JSON.parse(error.message.slice(error.message.indexOf('{')));}
 const missing=(ids:unknown[],facade:unknown=null):HookFile=>({...row,moduleIds:ids as string[],facadeModuleId:facade as string|null});
 it('counts duplicate occurrences and retains two ordered samples in both categories without mutation',()=>{
  const input=[missing(['a','a','b'],'f'),{...missing(['c'],'g'),fileName:'other.js'},{...missing(['d'],'h'),fileName:'third.js'}],before=JSON.stringify(input),error=failure(input),data=report(error);
  expect(error.message.startsWith('Unknown emitted module ownership ')).toBe(true);
  expect(data).toMatchObject({missingModuleOccurrences:5,missingFacadeOccurrences:3,moduleSamples:[{from:row.fileName,index:0,id:{value:'a'}},{from:row.fileName,index:1,id:{value:'a'}}],facadeSamples:[{from:row.fileName,id:{value:'f'}},{from:'other.js',id:{value:'g'}}]});
  expect(data.moduleSamples).toHaveLength(2);expect(data.facadeSamples).toHaveLength(2);expect(JSON.stringify(input)).toBe(before);
 });
 it('preserves first interleaved facade error before a later missing module',()=>{
  const error=failure([missing([],'first'),{...missing(['later']),fileName:'other.js'}]);
  expect(error.message.startsWith('Unknown facade module ownership ')).toBe(true);expect(report(error)).toMatchObject({missingModuleOccurrences:1,missingFacadeOccurrences:1});
 });
 it.each(['\0'.repeat(512),'🙂'.repeat(128),'bad\n\r\t\0"\\'])('retains full512 UTF8 bytes and escaped values',value=>{
  expect(report(failure([missing([value])])).moduleSamples[0].id).toEqual({type:'string',value,utf8Bytes:Buffer.byteLength(value),truncated:false});
 });
 it.each(['x'.repeat(513),'🙂'.repeat(129),'x'.repeat(127)+'🙂'.repeat(200)])('bounds over512 bytes to128 UTF16 units',value=>{
  expect(report(failure([missing([value])])).moduleSamples[0].id).toEqual({type:'string',value:value.slice(0,128),utf8Bytes:Buffer.byteLength(value),truncated:true});
 });
 it.each([null,undefined,123,true,1n,Symbol('private')])('retains malformed primitive type only',value=>{
  expect(report(failure([missing([value],value)])).moduleSamples[0].id).toEqual({type:value===null?'null':typeof value,value:null,utf8Bytes:null,truncated:false});
 });
 it('does not coerce or serialize malformed objects',()=>{
  let calls=0;const value={toString(){calls++;throw Error('coercion');},toJSON(){calls++;throw Error('serialization');}};
  expect(report(failure([missing([value],value)])).facadeSamples[0].id.type).toBe('object');expect(calls).toBe(0);
 });
 it('keeps all earlier shape, mapping, hash, metadata and capacity refusals',()=>{
  for(const input of [[{...missing(['unknown']),contentSha256:undefined}],[{...missing(['unknown']),imports:['../bad']}],[missing(new Array(1))],[missing(Array(16385).fill('unknown'))]]) {
   const error=failure(input);expect(error.message).not.toMatch(/^Unknown (emitted|facade)/);
  }
  expect(()=>projectHookFacts([missing(['unknown'])],[{...module,external:true}])).toThrow();
 });
 it('preserves exact successful schema2 facts and freezes caller-independent copies',()=>{
  const input={...row,imports:['missing.js']},facts=projectHookFacts([input],[module]);
  expect(JSON.stringify(facts)).toBe(JSON.stringify({schemaVersion:2,files:[input],modules:[module],metadataReferences:[{from:row.fileName,kind:'import',index:0,raw:'missing.js',membership:'absent-from-hook-snapshot'}],metadataOccurrenceCount:1,qualification:false}));
  expect(Object.isFrozen(facts)).toBe(true);expect(Object.isFrozen(facts.files)).toBe(true);expect(Object.isFrozen(facts.files[0]!.moduleIds)).toBe(true);expect(Object.isFrozen(facts.modules[0])).toBe(true);
 });
 it('queries at most four exact full originals, including4096 bytes, never diagnostic prefixes',()=>{
  const full='x'.repeat(4096),error=failure([missing([full,'second','unretained'],'facade'),{...missing([],'last'),fileName:'other.js'}]),seen:string[]=[];
  const enriched=enrichOwnershipMismatch(error,id=>{seen.push(id);return {id,code:null,isEntry:true,isExternal:true};});
  expect(seen).toEqual([full,'second','facade','last']);expect(report(enriched).observations).toHaveLength(4);
  expect(report(enriched).observations[0]).toMatchObject({category:'module',sampleIndex:0,status:'available',idMatches:true,codeType:'null',external:null,externalAvailable:false});
  expect(enriched.message.startsWith('Unknown emitted module ownership ')).toBe(true);expect(report(enriched).missingModuleOccurrences).toBe(3);
 });
 it('skips empty, malformed, over4096 units and over4096 UTF8 originals',()=>{
  const cases:unknown[]=['',{},'x'.repeat(4097),'🙂'.repeat(1025)];
  for(const id of cases){let calls=0;const data=report(enrichOwnershipMismatch(failure([missing([id])]),()=>{calls++;return null;}));expect(calls).toBe(0);expect(data.observations[0]).toMatchObject({status:'skipped',external:null,externalAvailable:false});}
 });
 it('captures missing lookup and bounded returned ID and code types without external inference',()=>{
  for(const code of [null,undefined,'secret',{},42]) {
   const data=report(enrichOwnershipMismatch(failure([missing(['unknown'])]),()=>({id:'🙂'.repeat(65),code})));
   expect(data.observations[0]).toMatchObject({status:'available',idMatches:false,codeType:code===null?'null':code===undefined?'undefined':typeof code==='string'?'string':'other',external:null,externalAvailable:false,id:{value:('🙂'.repeat(65)).slice(0,64),utf8Bytes:260,truncated:true}});
   expect(JSON.stringify(data)).not.toContain('secret');
  }
  expect(report(enrichOwnershipMismatch(failure([missing(['a'])]),()=>null)).observations[0].status).toBe('missing');
  expect(report(enrichOwnershipMismatch(failure([missing(['a'])]),()=>({id:'z'.repeat(256),code:''}))).observations[0].id.truncated).toBe(false);
 });
 it('cannot mask refusal with lookup or returned-info projection exceptions or malformed info',()=>{
  const lookups=[()=>{throw {name:'n'.repeat(100),message:'private'};},()=>({get id(){throw Error('private');}}),()=>42,()=>{throw {get name(){throw Error('private');}};}];
  for(const lookup of lookups){const error=enrichOwnershipMismatch(failure([missing(['a'],'b')]),lookup);expect(error.message.startsWith('Unknown emitted module ownership ')).toBe(true);const data=report(error);expect(data.missingModuleOccurrences).toBe(1);expect(data.missingFacadeOccurrences).toBe(1);expect(data.observations[0].status).toBe('threw');expect(data.observations[0].errorName.length).toBeLessThanOrEqual(64);expect(error.message).not.toContain('private');}
 });
 it('leaves unrelated error identity unchanged without lookup',()=>{
  const error=Error('other');let calls=0;expect(enrichOwnershipMismatch(error,()=>{calls++;return null;})).toBe(error);expect(calls).toBe(0);
 });
 it('keeps worst escaped owners, IDs, returned IDs and error names below32KiB',()=>{
  const owner='a'.repeat(1024),id='\0'.repeat(512),input=[{...missing([id,id],id),fileName:owner},{...missing([],id),fileName:'b'.repeat(1024)}];
  const error=failure(input),data=report(error);expect(data.moduleSamples[0].from).toHaveLength(1024);
  report(enrichOwnershipMismatch(error,()=>({id:'\0'.repeat(256),code:''})));
  report(enrichOwnershipMismatch(error,()=>{throw {name:'\0'.repeat(64)};}));
 });
});
