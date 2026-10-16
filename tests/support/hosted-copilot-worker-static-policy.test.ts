import {describe,it,expect,vi} from 'vitest';
import {collectWorkerModuleImports,assertWorkerFrontendPrerequisite,classifyWorkerModuleSource} from './hosted-copilot-worker-static-policy.ts';
import {assertCompilerRuntimeOwnership} from './hosted-copilot-production-policy.ts';
import {createHash} from 'node:crypto';
import {MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_MODULE_BUILTINS} from './hosted-copilot-mounted-policy.ts';
import * as outputPolicy from './hosted-copilot-worker-static-policy.ts';
const zodAlias='../../../../node_modules/zod/index.js';
const bindingProfile={logicalZodSpecifier:'zod',emittedZodSpecifier:zodAlias,zodPublicSourceParent:'packages/contract/src/fixture.ts'};
describe('fixed public-root paths and original Zod importer cohort',()=>{
 const paths=()=>({zod:zodAlias});
 it.each([undefined,null,{},[],()=>zodAlias,{zod:'zod'},{zod:zodAlias,rxjs:'other'},{zod:zodAlias,[Symbol('extra')]:1},Object.create({zod:zodAlias})])('refuses a nonexact actual hook mapping %#',value=>{
  expect(()=>outputPolicy.observeWorkerOutputPolicy('es',false,value)).toThrow();
 });
 it('reads only own data once and owns immutable hook paths, including later mutation',()=>{
  let reads=0;expect(()=>outputPolicy.observeWorkerOutputPolicy('es',false,{get zod(){reads++;return zodAlias;}})).toThrow();expect(reads).toBe(0);
  const input=paths(),value=outputPolicy.observeWorkerOutputPolicy('es',false,input);input.zod='wrong';expect(value.paths).toEqual(paths());expect(Object.isFrozen(value.paths)).toBe(true);
  expect(()=>outputPolicy.readWorkerOutputPolicy({format:'es',polyfillRequire:false,paths:input})).toThrow();
 });
 it('retains a static raw alias and denies bare/dynamic/near alias without broadening relative imports',()=>{
  expect(collectWorkerModuleImports(program([imp(lit(zodAlias))]))).toEqual([{specifier:zodAlias,kind:'static'}]);
  for(const raw of ['zod','../../../node_modules/zod/index.js',zodAlias+'?x','../../../../node_modules/zod/v4/index.js'])expect(()=>collectWorkerModuleImports(program([imp(lit(raw))]))).toThrow();
  expect(()=>collectWorkerModuleImports(program([{type:'ImportExpression',source:lit(zodAlias)}]))).toThrow();
 });
 const physical=(path:string,index:number)=>{const id='/repo/'+path;return {index,id,role:'normal-source',codeKind:'string',allowed:false,requested:false,source:{id,kind:'physical',external:false,path,sha256:'b'.repeat(64)},importedIds:['zod'],dynamicallyImportedIds:[]};};
 const fixture=():any=>({compilerProfile:{provider:'rolldown',version:'1.2.13',runtimeModuleId:'\0rolldown/runtime.js'},
  buildProfile:{entry:'apps/copilotkit/hosted-native-entry.ts',platform:'node',tsconfig:false,hmr:false,userResolverPlugins:false,...bindingProfile},workerOutputPolicy:{format:'es',polyfillRequire:false,paths:paths()},
  rows:[physical('packages/contract/src/fixture.ts',0),{index:1,id:'zod',role:'configured-external',codeKind:'not-read',allowed:true,requested:true}],
  callbacks:{target:'node:module',scope:'original external callback observations only',observations:[],omitted:false,callbackCountKnown:true,retainedCallbackCount:0,complete:true},
  chunks:[{kind:'chunk',fileName:'worker.mjs',format:'es',isEntry:true,moduleIds:['/repo/packages/contract/src/fixture.ts'],facadeModuleId:'/repo/packages/contract/src/fixture.ts',bytes:10,sha256:'a'.repeat(64)}],
  counts:{registeredRows:2,normalSources:1,configuredExternals:1,compilerRegisteredDependencies:0,relations:1,work:3}});
 const recount=(f:any)=>{const normal=f.rows.filter((r:any)=>r.role==='normal-source');const relations=normal.reduce((n:number,r:any)=>n+r.importedIds.length+r.dynamicallyImportedIds.length,0);f.rows.forEach((r:any,i:number)=>r.index=i);f.counts={registeredRows:f.rows.length,normalSources:normal.length,configuredExternals:f.rows.length-normal.length,compilerRegisteredDependencies:0,relations,work:f.rows.length+relations};return f;};
 const validate=(value:unknown)=>outputPolicy.validateWorkerRegisteredGraph(value);
 it.each(['fixture','artifact','long-thread','capture-bridge','comparison-presentation','comparison-artifact','comparison-installer-options','presentation','comparison'])('admits real static incoming source %s without requiring unused sources to exist',name=>{
  const f=fixture();if(name!=='fixture')f.rows.push(physical('packages/contract/src/'+name+'.ts',2));expect(validate(recount(f)).counts.configuredExternals).toBe(1);
 });
 it.each(['node_modules/sdk/src/agent.js','apps/copilotkit/node_modules/zod/index.js','packages/contract/src/other.ts','packages/contract/dist/fixture.js'])('rejects foreign or unreviewed unrendered original importer %s',path=>{
  const f=fixture();f.rows.push(physical(path,2));expect(()=>validate(recount(f))).toThrow();
 });
 it('rejects virtual/dynamic/omitted-known-edge/orphan Zod regardless of chunk rendering',()=>{
  for(const mutate of [(f:any)=>{const r=f.rows[0];r.id='virtual:fixture';r.source={id:r.id,kind:'virtual',external:false};},
   (f:any)=>{f.rows[0].importedIds=[];f.rows[0].dynamicallyImportedIds=['zod'];},(f:any)=>f.rows[0].importedIds=[],
   (f:any)=>f.rows.pop(),(f:any)=>{f.rows[0]=physical('packages/contract/src/artifact.ts',0);},
   (f:any)=>f.rows[0].source.id='/other/fixture.ts',(f:any)=>f.rows[0].source.path='packages/contract/src/artifact.ts']){
   const f=fixture();mutate(f);f.chunks[0].moduleIds=[];f.chunks[0].facadeModuleId=null;expect(()=>validate(recount(f))).toThrow();
  }
 });
 it.each(['logicalZodSpecifier','emittedZodSpecifier','zodPublicSourceParent'])('rejects missing or changed fixed profile fact %s',key=>{
  const f=fixture();delete f.buildProfile[key];expect(()=>validate(f)).toThrow();f.buildProfile[key]='wrong';expect(()=>validate(f)).toThrow();
 });
 describe('original Zod origin refusal diagnostic',()=>{
  const run=(f:any,sink?:(line:string)=>void)=>outputPolicy.validateWorkerRegisteredGraph(recount(f),sink);
  const foreign=()=>{const f=fixture();f.rows.push(physical('packages/contract/dist/fixture.js',2));return f;};
  const stringFact=(value:string)=>({status:'exact',value,codeUnits:value.length,utf8Bytes:Buffer.byteLength(value,'utf8'),sha256:createHash('sha256').update(value).digest('hex')});
  const observe=(f:any)=>{const lines:string[]=[];expect(()=>run(f,line=>lines.push(line))).toThrow('Worker registered graph denied');expect(lines).toHaveLength(1);expect(lines[0]!.endsWith('\n')).toBe(true);expect(Buffer.byteLength(lines[0]!)).toBeLessThanOrEqual(16384);const parsed=JSON.parse(lines[0]!);expect(Object.keys(parsed)).toEqual(['workerZodOriginRefusalDiagnostic']);return parsed.workerZodOriginRefusalDiagnostic;};
  it('reports the actual first refused unrendered physical row and exact predicate facts',()=>{
   const f=foreign(),r=f.rows[2],record=observe(f);
   expect(record).toEqual({status:'observed',scope:'first refused normalized normal-source Zod origin row only',rowIndex:2,id:stringFact(r.id),sourceKind:'physical',sourcePath:stringFact(r.source.path),sourceHash:stringFact(r.source.sha256),knownOrigin:false,physical:true,absoluteId:true,idPathSuffix:true,staticZod:true,dynamicZod:false});
  });
  it('reports absent virtual source fields without inventing a physical path or hash',()=>{
   const f=fixture();f.rows[0].id='virtual:fixture';f.rows[0].source={id:'virtual:fixture',kind:'virtual',external:false};
   expect(observe(f)).toMatchObject({rowIndex:0,id:stringFact('virtual:fixture'),sourceKind:'virtual',sourcePath:{status:'absent'},sourceHash:{status:'absent'},knownOrigin:false,physical:false,absoluteId:false,idPathSuffix:false,staticZod:true,dynamicZod:false});
  });
  it.each(['relative','suffix'])('retains the precise %s predicate rather than guessing an importer cause',kind=>{
   const f=fixture(),id=kind==='relative'?'relative/packages/contract/src/fixture.ts':'/repo/different.ts';f.rows[0].id=id;f.rows[0].source.id=id;
   expect(observe(f)).toMatchObject({rowIndex:0,id:stringFact(id),knownOrigin:true,physical:true,absoluteId:kind!=='relative',idPathSuffix:kind!=='suffix',staticZod:true,dynamicZod:false});
  });
  it('leaves valid normalized graph data frozen, unchanged and silent',()=>{
   const f=fixture(),before=run(f),lines:string[]=[],after=run(f,line=>lines.push(line));expect(after).toEqual(before);expect(Object.isFrozen(after)).toBe(true);expect(Object.isFrozen(after.rows)).toBe(true);expect(lines).toEqual([]);
  });
  it.each(['profile','dynamic','known-edge','orphan','source-root','oversized-id'])('keeps other %s denials silent',kind=>{
   const f=fixture();
   if(kind==='profile')f.compilerProfile.version='wrong';
   if(kind==='dynamic'){f.rows[0].importedIds=[];f.rows[0].dynamicallyImportedIds=['zod'];}
   if(kind==='known-edge')f.rows[0].importedIds=[];
   if(kind==='orphan')f.rows.pop();
   if(kind==='source-root'){const r=physical('packages/contract/src/artifact.ts',2);r.id='/other/'+r.source.path;r.source.id=r.id;f.rows.push(r);}
   if(kind==='oversized-id'){f.rows[0].id='x'.repeat(4097);f.rows[0].source.id=f.rows[0].id;}
   const lines:string[]=[];expect(()=>run(f,line=>lines.push(line))).toThrow();expect(lines).toEqual([]);
  });
  it('keeps hostile supplied getters out of the diagnostic path',()=>{
   const f=fixture();let getters=0,emits=0;Object.defineProperty(f.rows[0].source,'path',{get(){getters++;throw Error('getter');}});expect(()=>run(f,()=>{emits++;})).toThrow();expect(getters).toBe(0);expect(emits).toBe(0);
  });
  it('does no diagnostic formatting when the optional sink is absent',()=>{
   let formats=0;const native=JSON.stringify,spy=vi.spyOn(JSON,'stringify').mockImplementation(((value:any,...args:any[])=>{if(value&&Object.hasOwn(value,'workerZodOriginRefusalDiagnostic'))formats++;return (native as any)(value,...args);}) as any);
   try{expect(()=>run(foreign())).toThrow('Worker registered graph denied');expect(formats).toBe(0);}finally{spy.mockRestore();}
  });
  it.each(['sink','formatter'])('preserves the same owned Error through a hostile %s throw',stage=>{
   const NativeError=globalThis.Error,nativeStringify=JSON.stringify,owned:Error[]=[];let foreignReads=0,emits=0,formats=0,caught:unknown;
   const hostile={get message(){foreignReads++;throw new NativeError('foreign');},get code(){foreignReads++;throw new NativeError('foreign');},get stack(){foreignReads++;throw new NativeError('foreign');}};
   const ctor=vi.spyOn(globalThis,'Error').mockImplementation((function(message?:string){const e=new NativeError(message);if(message==='Worker registered graph denied')owned.push(e);return e;}) as any);
   const stringify=vi.spyOn(JSON,'stringify').mockImplementation(((value:any,...args:any[])=>{if(value&&Object.hasOwn(value,'workerZodOriginRefusalDiagnostic')){formats++;if(stage==='formatter')throw hostile;}return (nativeStringify as any)(value,...args);}) as any);
   try{try{run(foreign(),()=>{emits++;throw hostile;});}catch(error){caught=error;}}finally{stringify.mockRestore();ctor.mockRestore();}
   expect(formats).toBe(1);expect(emits).toBe(stage==='sink'?1:0);expect(foreignReads).toBe(0);expect(owned).toHaveLength(1);expect(caught).toBe(owned[0]);expect((caught as Error).message).toBe('Worker registered graph denied');
  });
  it.each(['exact-1024','preview-1025','ascii-4096','escaped-controls','unicode-byte-bound','surrogate-preview'])('bounds %s string facts with full original UTF8 hashes',kind=>{
   const f=foreign(),path=f.rows[2].source.path,suffix='/'+path;
   let id:string;
   if(kind==='exact-1024'||kind==='preview-1025'||kind==='ascii-4096'){const size=kind==='exact-1024'?1024:kind==='preview-1025'?1025:4096;id='/'+ 'x'.repeat(size-1-suffix.length)+suffix;}
   else if(kind==='escaped-controls')id='/'+ '\x01'.repeat(900)+suffix;
   else if(kind==='unicode-byte-bound'){const prefix='/'+ '😀'.repeat(1000);id=prefix+'x'.repeat(4096-Buffer.byteLength(prefix)-Buffer.byteLength(suffix))+suffix;}
   else id='/'+ 'x'.repeat(94)+'😀'+'x'.repeat(1100)+suffix;
   f.rows[2].id=id;f.rows[2].source.id=id;
   const record=observe(f),actual=record.id;expect(actual.codeUnits).toBe(id.length);expect(actual.utf8Bytes).toBe(Buffer.byteLength(id));expect(actual.sha256).toBe(createHash('sha256').update(id).digest('hex'));
   if(id.length<=1024&&Buffer.byteLength(id)<=1024)expect(actual).toEqual(stringFact(id));
   else{expect(actual.status).toBe('preview');expect(actual.value).toBeUndefined();expect(actual.preview.length).toBeLessThanOrEqual(96);expect(actual.previewCodeUnits).toBe(actual.preview.length);expect(actual.previewUtf8Bytes).toBe(Buffer.byteLength(actual.preview));expect(id.startsWith(actual.preview)).toBe(true);const last=actual.preview.charCodeAt(actual.preview.length-1);expect(last>=0xd800&&last<=0xdbff).toBe(false);}
  });
  it('refuses publication if complete serialized output exceeds16KiB',()=>{
   const native=JSON.stringify;let formats=0,emits=0,caught:unknown;
   const spy=vi.spyOn(JSON,'stringify').mockImplementation(((value:any,...args:any[])=>{if(value&&Object.hasOwn(value,'workerZodOriginRefusalDiagnostic')){formats++;return 'x'.repeat(16384);}return (native as any)(value,...args);}) as any);
   try{try{run(foreign(),()=>{emits++;});}catch(error){caught=error;}}finally{spy.mockRestore();}
   expect(formats).toBe(1);expect(emits).toBe(0);expect((caught as Error).message).toBe('Worker registered graph denied');
  });
 });
});
describe('bounded public-resolution refusal diagnostic',()=>{
 const unavailable='{"workerPublicResolutionDiagnostic":{"status":"unavailable","reason":"invalid-or-oversized-input"}}';
 const format=outputPolicy.formatWorkerPublicResolutionDiagnostic;
 it('retains all four exact supplied primitive bindings without claiming the failing import identity',()=>{
  const specifier='zod',expectedPackagePath='node_modules/zod',workerParentUrl='file:///repo/apps/copilotkit/.hosted-mounted/123-1/worker.mjs',resolvedEntryPath='apps/copilotkit/node_modules/zod/index.js';
  expect(outputPolicy.formatWorkerPublicResolutionDiagnostic(specifier,expectedPackagePath,workerParentUrl,resolvedEntryPath)).toBe(JSON.stringify({workerPublicResolutionDiagnostic:{status:'observed',specifier,expectedPackagePath,workerParentUrl,resolvedEntryPath}}));
 });
 it.each([0,1,2,3])('admits exact independent boundary and refuses plusone without a partial record at position%i',index=>{
  const limits=[128,256,1024,4096],values=['zod','node_modules/zod','file:///worker.mjs','node_modules/zod/index.js'];
  values[index]='x'.repeat(limits[index]!);
  const parsed=JSON.parse(format(values[0],values[1],values[2],values[3]));
  expect(parsed).toEqual({workerPublicResolutionDiagnostic:{status:'observed',specifier:values[0],expectedPackagePath:values[1],workerParentUrl:values[2],resolvedEntryPath:values[3]}});
  values[index]+='x';expect(format(values[0],values[1],values[2],values[3])).toBe(unavailable);
 });
 it('retains all maximum primitive values including JSON quotes and backslashes within the complete output bound',()=>{
  const values=['"'.repeat(128),'\\'.repeat(256),'"'.repeat(1024),'\\'.repeat(4096)];
  const line=format(values[0],values[1],values[2],values[3]);
  expect(Buffer.byteLength(line,'utf8')).toBeLessThanOrEqual(16384);expect(line).not.toContain('\n');
  expect(JSON.parse(line)).toEqual({workerPublicResolutionDiagnostic:{status:'observed',specifier:values[0],expectedPackagePath:values[1],workerParentUrl:values[2],resolvedEntryPath:values[3]}});
  expect(JSON.parse(format(' ',' ',' ',' ')).workerPublicResolutionDiagnostic.status).toBe('observed');
 });
 it('refuses empty, control, nonASCII and nonstring inputs at every position without arbitrary stringification',()=>{
  let calls=0;
  const object={get toJSON(){calls++;throw Error('secret');},toString(){calls++;throw Error('secret');},valueOf(){calls++;throw Error('secret');},get message(){calls++;throw Error('secret');}};
  const invalid:unknown[]=['','\0','a\nb','\t','\x1f','\x7f','é','😀','\ud800',undefined,null,false,true,0,NaN,Infinity,1n,Symbol('secret'),()=>{calls++;},object,new String('zod'),[],new Map()];
  for(const value of invalid)for(let index=0;index<4;index++){
   const values:unknown[]=['zod','node_modules/zod','file:///worker.mjs','node_modules/zod/index.js'];values[index]=value;
   expect(format(values[0],values[1],values[2],values[3])).toBe(unavailable);
  }
  expect(calls).toBe(0);
 });
 it('does not inspect hostile proxy getters, descriptors, keys or prototypes, including revoked proxies',()=>{
  let calls=0;const trap=():never=>{calls++;throw Error('secret');};
  const proxy=new Proxy({}, {get:trap,getPrototypeOf:trap,getOwnPropertyDescriptor:trap,ownKeys:trap,has:trap});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  for(const input of [proxy,revoked.proxy])for(let index=0;index<4;index++){
   const values:unknown[]=['zod','node_modules/zod','file:///worker.mjs','node_modules/zod/index.js'];values[index]=input;
   expect(format(values[0],values[1],values[2],values[3])).toBe(unavailable);
  }
  expect(calls).toBe(0);
 });
 it('checks primitive character and byte bounds before any JSON serialization',()=>{
  const spy=vi.spyOn(JSON,'stringify');let calls:number;
  let line:string;
  try{line=format('zod','node_modules/zod','file:///worker.mjs','x'.repeat(4097));calls=spy.mock.calls.length;}finally{spy.mockRestore();}
  expect(calls!).toBe(0);expect(line!).toBe(unavailable);
 });
});
describe('complete worker registered graph',()=>{
 const profile={provider:'rolldown',version:'1.2.13',runtimeModuleId:'\0rolldown/runtime.js'};
 const build={entry:'apps/copilotkit/hosted-native-entry.ts',platform:'node',tsconfig:false,hmr:false,userResolverPlugins:false,...bindingProfile};
 const normal=(index=0,id='virtual:entry')=>({index,id,role:'normal-source',codeKind:'string',allowed:false,requested:false,
  source:{id,kind:'virtual',external:false},importedIds:[],dynamicallyImportedIds:[]});
 const fixture=():any=>({compilerProfile:{...profile},buildProfile:{...build},workerOutputPolicy:{format:'es',polyfillRequire:false,paths:{zod:zodAlias}},
  rows:[normal(),{index:1,id:'node:module',role:'compiler-registered-dependency',codeKind:'null',allowed:false,requested:false,isEntry:false,inputFormat:'unknown'}],
  callbacks:{target:'node:module',scope:'original external callback observations only',observations:[{parent:'\0rolldown/runtime.js',parentStatus:'valid',isResolved:false,returnedAllowed:false}],omitted:false,callbackCountKnown:true,retainedCallbackCount:1,complete:true},
  chunks:[{kind:'chunk',fileName:'worker.mjs',format:'es',isEntry:true,moduleIds:['virtual:entry'],facadeModuleId:'virtual:entry',bytes:10,sha256:'a'.repeat(64)}],
  counts:{registeredRows:2,normalSources:1,configuredExternals:0,compilerRegisteredDependencies:1,relations:0,work:2}});
 const validate=(value:unknown)=>outputPolicy.validateWorkerRegisteredGraph(value);
 it('accepts the complete conditional fixture as a fresh deeply frozen JSON projection',()=>{
  const input=fixture(),result=validate(input);expect(result).toEqual(input);expect(result).not.toBe(input);
  expect(Object.isFrozen(result.rows)).toBe(true);expect(Object.isFrozen(result.rows[0])).toBe(true);
  input.rows[0].importedIds.push('node:module');expect(JSON.parse(JSON.stringify(result))).toEqual(fixture());
 });
 it.each(['importedIds','dynamicallyImportedIds'])('denies a resolved alias target in %s even with only the runtime callback and an unrendered parent',key=>{
  const f=fixture();f.rows[0][key]=['node:module'];f.chunks[0].moduleIds=[];f.chunks[0].facadeModuleId=null;
  f.counts.relations=1;f.counts.work=3;expect(()=>validate(f)).toThrow();
 });
 it.each(['importedIds','dynamicallyImportedIds'])('requires every normal own dense %s without evaluating accessors',key=>{
  for(const bad of [undefined,null,new Array(1),Object.assign(Object.create(['safe']),{length:1}),[{}]]){
   const f=fixture();f.rows[0][key]=bad;expect(()=>validate(f)).toThrow();
  }
  let calls=0;const f=fixture();Object.defineProperty(f.rows[0],key,{get(){calls++;return [];}});expect(()=>validate(f)).toThrow();
  const g=fixture(),array=['safe'];Object.defineProperty(array,'0',{get(){calls++;return 'safe';}});g.rows[0][key]=array;expect(()=>validate(g)).toThrow();expect(calls).toBe(0);
 });
 it.each([{codeKind:'undefined'},{codeKind:'getter-threw'},{isEntry:true},{inputFormat:undefined},{inputFormat:'unavailable'},{inputFormat:'esm'},{allowed:true},{requested:true},{id:'module'}])('rejects candidate contradiction %#',change=>{
  const f=fixture();Object.assign(f.rows[1],change);expect(()=>validate(f)).toThrow();
 });
 it('rejects duplicate roles, unclaimed rows, configured overlap, normal null and extra keys',()=>{
  for(const change of [(f:any)=>f.rows.push({...f.rows[1],index:2}),(f:any)=>f.rows[0].role='unclaimed',(f:any)=>f.rows[1].role='configured-external',
   (f:any)=>f.rows[0].codeKind='null',(f:any)=>f.rows[0].extra=true,(f:any)=>f.extra=true,(f:any)=>f.rows[1].index=0]){
   const f=fixture();change(f);expect(()=>validate(f)).toThrow();
  }
 });
 it.each([(f:any)=>f.compilerProfile.version='1.2.14',(f:any)=>f.buildProfile.tsconfig=true,(f:any)=>f.buildProfile.userResolverPlugins=true,
  (f:any)=>f.workerOutputPolicy.polyfillRequire=true,(f:any)=>f.counts.work=3,(f:any)=>f.rows[0].source.id='virtual:other'])('rejects fixed profile, mapping or count changes %#',change=>{
  const f=fixture();change(f);expect(()=>validate(f)).toThrow();
 });
 it.each([(f:any)=>f.chunks[0].moduleIds.push('node:module'),(f:any)=>f.chunks[0].facadeModuleId='node:module',
  (f:any)=>delete f.chunks[0].moduleIds,(f:any)=>f.chunks[0].fileName='other.mjs',(f:any)=>f.chunks[0].isEntry=false])('requires actual complete expected chunk absence %#',change=>{
  const f=fixture();change(f);expect(()=>validate(f)).toThrow();
 });
 it.each([(f:any)=>f.callbacks.observations=[],(f:any)=>f.callbacks.observations[0].parent='virtual:normal',
  (f:any)=>f.callbacks.observations[0].isResolved=true,(f:any)=>f.callbacks.observations[0].returnedAllowed=true,
  (f:any)=>f.callbacks.complete=false,(f:any)=>f.callbacks.omitted=true,(f:any)=>f.callbacks.observations=Array(9).fill(f.callbacks.observations[0])])('requires complete bounded matching runtime callbacks %#',change=>{
  const f=fixture();change(f);expect(()=>validate(f)).toThrow();
 });
 it('retains repeated actual calls rather than deduplicating witnesses',()=>{
  const f=fixture();f.callbacks.observations.push({...f.callbacks.observations[0]});f.callbacks.retainedCallbackCount=2;
  expect(validate(f).callbacks.retainedCallbackCount).toBe(2);
 });
 it('admits exactly16384 shared units and rejects16385 before indexed descriptors',()=>{
  const f=fixture();f.rows=[normal(0),normal(1,'virtual:b'),normal(2,'virtual:c'),normal(3,'virtual:d'),normal(4,'virtual:e'),{...f.rows[1],index:5}];
  for(let i=0;i<3;i++)f.rows[i].importedIds=Array(4096).fill('safe');f.rows[3].importedIds=Array(4090).fill('safe');
  f.counts={registeredRows:6,normalSources:5,configuredExternals:0,compilerRegisteredDependencies:1,relations:16378,work:16384};expect(validate(f).counts.work).toBe(16384);
  let indexed=0;const array=new Proxy(Array(4091).fill('safe'),{getOwnPropertyDescriptor(target,key){if(key==='0')indexed++;return Reflect.getOwnPropertyDescriptor(target,key);}});
  f.rows[3].importedIds=array;expect(()=>validate(f)).toThrow();expect(indexed).toBe(0);
 });
 it('bounds each array before reading indices and IDs before byte scanning or coercion',()=>{
  let reads=0;const f=fixture();f.rows[0].importedIds=new Proxy(Array(4097),{getOwnPropertyDescriptor(target,key){if(key==='0')reads++;return Reflect.getOwnPropertyDescriptor(target,key);}});
  expect(()=>validate(f)).toThrow();expect(reads).toBe(0);
  for(const id of ['x'.repeat(4097),'é'.repeat(2049),{toString(){reads++;return 'safe';}}]){const g=fixture();g.rows[0].importedIds=[id];expect(()=>validate(g)).toThrow();}expect(reads).toBe(0);
  for(const id of ['x'.repeat(4096),'é'.repeat(2048)]){const g=fixture();g.rows[0].importedIds=[id];g.counts.relations=1;g.counts.work=3;expect(validate(g).counts.relations).toBe(1);}
 });
 it('reserves both normal arrays before either indexed descriptor when their combined work overflows',()=>{
  let reads=0;const imported=new Proxy(['safe'],{getOwnPropertyDescriptor(target,key){if(key==='0')reads++;return Reflect.getOwnPropertyDescriptor(target,key);}});
  expect(()=>outputPolicy.observeWorkerResolvedRelations(imported,['safe'],16383)).toThrow();expect(reads).toBe(0);
 });
 it('captures actual source code once including null candidate and never ast or error properties',()=>{
  let reads=0;const info={id:'node:module',get code(){reads++;return null;},isEntry:false,inputFormat:'unknown',get ast(){throw Error('ast');}};
  expect(outputPolicy.observeWorkerRegisteredModule('node:module',1,info,false)).toEqual(fixture().rows[1]);expect(reads).toBe(1);
  expect(()=>classifyWorkerModuleSource('node:module',1,info,false)).toThrow();expect(reads).toBe(2);
  for(const code of [undefined,{},1])expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',1,{id:'node:module',code,isEntry:false,inputFormat:'unknown'},false)).toThrow();
 });
 it('checks own id before code and leaves configured external code unread',()=>{
  let reads=0;expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,{id:'wrong',get code(){reads++;return null;}},false)).toThrow();
  expect(outputPolicy.observeWorkerRegisteredModule('rxjs',0,{id:'rxjs',get code(){reads++;throw Error();}},true)).toEqual({id:'rxjs',index:0,role:'configured-external',codeKind:'not-read',allowed:true,requested:true});expect(reads).toBe(0);
 });
 it('fails candidate scalar contradictions immediately without inspecting later fields',()=>{
  let reads=0;const bad={id:'node:module',code:null,isEntry:true,get inputFormat(){reads++;return 'unknown';}};
  expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,bad,false)).toThrow();expect(reads).toBe(0);
  for(const info of [{id:'node:module',code:null,isEntry:false},{id:'node:module',code:null,isEntry:false,inputFormat:'unavailable'},
   {id:'node:module',code:'',importedIds:[],dynamicallyImportedIds:[]}])expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,info,false)).toThrow();
 });
 it('snapshots are fresh immutable full-parent projections and expose late/overflow changes',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module','\0rolldown/runtime.js',false,false);
  const first=d.snapshot();expect(first).toEqual(fixture().callbacks);expect(Object.isFrozen(first.observations[0])).toBe(true);
  expect(first).not.toBe(d.snapshot());d.observe('node:module','\0rolldown/runtime.js',false,false);expect(d.snapshot()).not.toEqual(first);
  for(let i=0;i<7;i++)d.observe('node:module','\0rolldown/runtime.js',false,false);expect(d.snapshot()).toMatchObject({omitted:true,complete:false,callbackCountKnown:false});
 });
 it.each(['generate','close'])('denies a callback arriving after the %s boundary snapshot',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module','\0rolldown/runtime.js',false,false);const hook=d.snapshot();
  expect(()=>outputPolicy.assertWorkerCallbackSnapshotStable(hook,d.snapshot())).not.toThrow();
  d.observe('node:module','\0rolldown/runtime.js',false,false);expect(()=>outputPolicy.assertWorkerCallbackSnapshotStable(hook,d.snapshot())).toThrow();
 });
 it('compares actual final output membership and facade with the hook metadata',()=>{
  const chunk=fixture().chunks[0];expect(()=>outputPolicy.assertWorkerChunkMetadataStable(chunk,{...chunk,moduleIds:[...chunk.moduleIds]})).not.toThrow();
  for(const changed of [{...chunk,moduleIds:[]},{...chunk,facadeModuleId:null},{...chunk,moduleIds:['node:module']},{...chunk,fileName:'changed.mjs'}])
   expect(()=>outputPolicy.assertWorkerChunkMetadataStable(chunk,changed)).toThrow();
 });
 it('preserves the16384 actual chunk membership cap independently of the4096 relation cap',()=>{
  const chunk=fixture().chunks[0];chunk.moduleIds=Array.from({length:16384},(_,i)=>'virtual:'+i);
  expect(outputPolicy.readWorkerChunkMetadata(chunk).moduleIds).toHaveLength(16384);
  chunk.moduleIds.push('virtual:overflow');expect(()=>outputPolicy.readWorkerChunkMetadata(chunk)).toThrow();
 });
 it('retains full bounded parents and distinct invalid argument states in immutable snapshots',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();for(const parent of [undefined,null,{},'x'.repeat(4097),'é'.repeat(2048)])d.observe('node:module',parent,false,false);
  const snapshot=d.snapshot();expect(snapshot.observations.map(row=>row.parentStatus)).toEqual(['absent','null','invalid','bound','valid']);
  expect(snapshot.observations[4]!.parent).toBe('é'.repeat(2048));expect(Object.isFrozen(snapshot)).toBe(true);
 });
 it('authenticates only the fixed component paths and rejects changed source pins',()=>{
  const pins=outputPolicy.WORKER_STATIC_COMPONENT_PATHS.map(path=>({path,bytes:10,sha256:'a'.repeat(64)}));
  expect(()=>outputPolicy.assertWorkerComponentPins(pins,structuredClone(pins))).not.toThrow();
  for(const change of [(p:any)=>p[0].sha256='b'.repeat(64),(p:any)=>p[0].path='arbitrary.ts',(p:any)=>p[0].bytes=11,(p:any)=>p[0].extra=true,(p:any)=>p.pop()]){
   const changed=structuredClone(pins);change(changed);expect(()=>outputPolicy.assertWorkerComponentPins(pins,changed)).toThrow();
  }
 });
 it('accepts every configured external role without extending the16-specifier universe',()=>{
  const f=fixture(),configured=[...Object.keys(MOUNTED_MODULE_PACKAGE_SPECIFIERS),...MOUNTED_MODULE_BUILTINS];
  for(const id of configured)f.rows.push({id,index:f.rows.length,role:'configured-external',codeKind:'not-read',allowed:true,requested:true});
  const id='/repo/packages/contract/src/fixture.ts';f.rows.push({id,index:f.rows.length,role:'normal-source',codeKind:'string',allowed:false,requested:false,
   source:{id,kind:'physical',external:false,path:'packages/contract/src/fixture.ts',sha256:'a'.repeat(64)},importedIds:['zod'],dynamicallyImportedIds:[]});
  f.counts.registeredRows+=17;f.counts.normalSources++;f.counts.configuredExternals=16;f.counts.relations=1;f.counts.work+=18;expect(validate(f).counts.configuredExternals).toBe(16);
  const ordinary=fixture();ordinary.rows.pop();ordinary.callbacks.observations=[];ordinary.callbacks.retainedCallbackCount=0;
  ordinary.counts={registeredRows:1,normalSources:1,configuredExternals:0,compilerRegisteredDependencies:0,relations:0,work:1};expect(validate(ordinary).counts.compilerRegisteredDependencies).toBe(0);
 });
 it.each([...Object.keys(MOUNTED_MODULE_PACKAGE_SPECIFIERS),...MOUNTED_MODULE_BUILTINS])('never reads configured code for graph observation %s',id=>{
  let reads=0;expect(outputPolicy.observeWorkerRegisteredModule(id,0,{id,get code(){reads++;throw Error('secret');}},true).role).toBe('configured-external');expect(reads).toBe(0);
 });
 it('captures a normal source code once and replay never touches original info',()=>{
  let reads=0;const info={id:'virtual:entry',get code(){reads++;return '';},importedIds:['safe'],dynamicallyImportedIds:[],get ast(){throw Error('ast');}};
  const observed=outputPolicy.observeWorkerRegisteredModule(info.id,0,info,false);expect(reads).toBe(1);
  const f=fixture();f.rows[0]={...observed,source:{id:info.id,kind:'virtual',external:false}};f.counts.relations=1;f.counts.work=3;
  const graph=validate(f);validate(graph);expect(reads).toBe(1);
  expect(()=>outputPolicy.observeWorkerRegisteredModule('virtual:normal',0,{id:'virtual:normal',code:null},false)).toThrow();
 });
 it('requires own candidate scalars and preserves thrown code identity without reading error members',()=>{
  let reads=0;const error={get message(){reads++;throw Error('secret');},get toJSON(){reads++;throw Error('secret');}};
  expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,{id:'node:module',get code(){throw error;}},false)).toThrow('Worker module source denied');
  for(const key of ['isEntry','inputFormat']){
   const info:any={id:'node:module',code:null,isEntry:false,inputFormat:'unknown'};delete info[key];
   Object.setPrototypeOf(info,{[key]:key==='isEntry'?false:'unknown'});expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,info,false)).toThrow();
   Object.defineProperty(info,key,{get(){reads++;return key==='isEntry'?false:'unknown';}});expect(()=>outputPolicy.observeWorkerRegisteredModule('node:module',0,info,false)).toThrow();
  }
  expect(reads).toBe(0);
 });
 it('admits exactly16384 registered rows and rejects16385 before any indexed row descriptor',()=>{
  const f=fixture(),candidate=f.rows[1];f.rows=Array.from({length:16383},(_,i)=>normal(i,'virtual:'+i));f.rows.push({...candidate,index:16383});
  f.chunks[0].moduleIds=['virtual:0'];f.chunks[0].facadeModuleId='virtual:0';f.counts={registeredRows:16384,normalSources:16383,configuredExternals:0,compilerRegisteredDependencies:1,relations:0,work:16384};
  expect(validate(f).counts.registeredRows).toBe(16384);let reads=0;
  f.rows=new Proxy(Array(16385),{getOwnPropertyDescriptor(target,key){if(key==='0')reads++;return Reflect.getOwnPropertyDescriptor(target,key);}});
  expect(()=>validate(f)).toThrow();expect(reads).toBe(0);
 });
 it('preflights registered ID characters before byte scanning, allowlist lookup or source-code reads',()=>{
  let bytes=0,lookups=0,reads=0;const originalBytes=Buffer.byteLength,originalOwn=Object.hasOwn;
  const b=vi.spyOn(Buffer,'byteLength').mockImplementation((value,encoding)=>{bytes++;return originalBytes(value,encoding);});
  const o=vi.spyOn(Object,'hasOwn').mockImplementation((object,key)=>{if(object===MOUNTED_MODULE_PACKAGE_SPECIFIERS)lookups++;return originalOwn(object,key);});
  try{expect(()=>outputPolicy.observeWorkerRegisteredModule('x'.repeat(4097),0,{get code(){reads++;return null;}},false)).toThrow();expect(bytes).toBe(0);expect(lookups).toBe(0);expect(reads).toBe(0);}
  finally{b.mockRestore();o.mockRestore();}
 });
 it('rejects inherited relation elements, extra row symbols and mismatched physical source IDs without coercion',()=>{
  let calls=0;const array=new Array(1);Object.setPrototypeOf(array,Object.assign(Object.create(Array.prototype),{0:'safe'}));
  const f=fixture();f.rows[0].importedIds=array;expect(()=>validate(f)).toThrow();
  const g=fixture();g.rows[0][Symbol('extra')]=true;expect(()=>validate(g)).toThrow();
  const h=fixture();h.rows[0].source={id:'different',kind:'physical',external:false,path:{toString(){calls++;return 'a.ts';}},sha256:'a'.repeat(64)};expect(()=>validate(h)).toThrow();expect(calls).toBe(0);
 });
 it('refuses the reserved compiler-runtime marker in the registered source cohort',()=>{
  const f=fixture();f.rows[0]=normal(0,'\0rolldown/runtime.js');f.chunks[0].moduleIds=['\0rolldown/runtime.js'];f.chunks[0].facadeModuleId=null;
  expect(()=>validate(f)).toThrow();
 });
 it('rejects invalid and overflowing snapshots even when a late snapshot is otherwise equal',()=>{
  for(const parent of [undefined,null,{},'normal','\0rolldown/runtime.js-suffix']){
   const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module',parent,false,false);expect(()=>outputPolicy.assertWorkerCallbackSnapshotStable(d.snapshot(),d.snapshot())).toThrow();
  }
  const d=outputPolicy.createWorkerImporterDiagnostic();for(let i=0;i<9;i++)d.observe('node:module','\0rolldown/runtime.js',false,false);
  expect(()=>outputPolicy.assertWorkerCallbackSnapshotStable(d.snapshot(),d.snapshot())).toThrow();
 });
 it('binds chunk metadata to bounded actual emitted bytes and hash',()=>{
  const chunk={...fixture().chunks[0],bytes:10,sha256:'a'.repeat(64)};
  expect(()=>outputPolicy.readWorkerChunkMetadata(chunk)).not.toThrow();
  for(const change of [{bytes:0},{bytes:16*1024*1024+1},{sha256:'invalid'},{sha256:{toString(){throw Error('secret');}}}])
   expect(()=>outputPolicy.readWorkerChunkMetadata({...chunk,...change})).toThrow();
  expect(()=>outputPolicy.assertWorkerChunkMetadataStable(chunk,{...chunk,sha256:'b'.repeat(64)})).toThrow();
 });
 it('settles original generate then original close once and retains result identity',async()=>{
  const value={},order:string[]=[];
  const result=await outputPolicy.settleWorkerStaticGeneration(()=>{order.push('generate');return Promise.resolve(value);},()=>{order.push('close');return Promise.resolve();},()=>{order.push('snapshot');});
  expect(result).toBe(value);expect(order).toEqual(['generate','snapshot','close','snapshot']);
 });
 it.each([null,undefined,{},'primary'])('preserves any original rejection even if close also rejects %#',async original=>{
  let close=0,checks=0,caught=false;
  try{await outputPolicy.settleWorkerStaticGeneration(()=>Promise.reject(original),()=>{close++;return Promise.reject({secondary:true});},()=>{checks++;});}
  catch(error){caught=true;expect(error).toBe(original);}
  expect(caught).toBe(true);expect(close).toBe(1);expect(checks).toBe(0);
 });
 it('denies an original close rejection without reading error properties or returning a value',async()=>{
  let reads=0,checks=0,caught=false;const error={get message(){reads++;throw Error();},get toJSON(){reads++;throw Error();}};
  try{await outputPolicy.settleWorkerStaticGeneration(()=>Promise.resolve({}),()=>Promise.reject(error),()=>{checks++;});}
  catch(actual){caught=true;expect(actual).toBe(error);}
  expect(caught).toBe(true);expect(reads).toBe(0);expect(checks).toBe(1);
 });
 it.each(['generate','close'])('rejects actual observation changes during the %s promise boundary',async boundary=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module','\0rolldown/runtime.js',false,false);const hook=d.snapshot();let closes=0;
  const late=()=>d.observe('node:module','\0rolldown/runtime.js',false,false);
  await expect(outputPolicy.settleWorkerStaticGeneration(()=>Promise.resolve().then(()=>{if(boundary==='generate')late();return {};}),()=>Promise.resolve().then(()=>{closes++;if(boundary==='close')late();}),()=>outputPolicy.assertWorkerCallbackSnapshotStable(hook,d.snapshot()))).rejects.toThrow('Worker callback observations changed');
  expect(closes).toBe(1);
 });
});
describe('bounded original node module callback diagnostic',()=>{
 const capture=(d:ReturnType<typeof outputPolicy.createWorkerImporterDiagnostic>,error:unknown={})=>{
  let line='';try{d.rethrow(error,'node:module',value=>{line=value;});}catch(e){expect(e).toBe(error);}
  expect(Buffer.byteLength(line)).toBeLessThanOrEqual(16384);return JSON.parse(line).workerImporterDiagnostic;
 };
 it('has no effects until observed and reports no acquisition/edge authority',()=>{
  const result=capture(outputPolicy.createWorkerImporterDiagnostic());
  expect(result).toMatchObject({target:'node:module',observations:[],omitted:false,scope:'original external callback observations only',codeObservation:'see original refusal'});
 });
 it('retains exact callback arguments and decisions without interpreting ownership',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module','\0rolldown/runtime.js',false,false);
  expect(capture(d).observations).toEqual([{parent:{status:'valid',sha256:createHash('sha256').update('\0rolldown/runtime.js').digest('hex'),preview:'\0rolldown/runtime.js',byteLength:20,exactRuntimeMarkerMatch:true},isResolved:false,returnedAllowed:false}]);
 });
 it('retains first8 original calls and saturates omission without claiming an exact total',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();for(let i=0;i<12;i++)d.observe('node:module',String(i),true,false);
  const v=capture(d);expect(v.observations).toHaveLength(8);expect(v.omitted).toBe(true);expect(v.observations[7].parent.preview).toBe('7');expect(v).not.toHaveProperty('total');
 });
 it('does not coerce unrelated IDs, parent fields, or boolean fields',()=>{
  let calls=0;const hostile={toString(){calls++;throw Error('secret');},toJSON(){calls++;throw Error('secret');}};
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe(hostile,hostile,hostile,hostile);d.observe('node:module',hostile,hostile,hostile);
  expect(capture(d).observations).toEqual([{parent:{status:'invalid'},isResolved:'invalid',returnedAllowed:'invalid'}]);expect(calls).toBe(0);
 });
 it.each([[undefined,'absent'],[null,'null'],['x'.repeat(4097),'bound'],['é'.repeat(2049),'bound']])('preserves parent status %#',(parent,status)=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module',parent,true,false);expect(capture(d).observations[0].parent).toEqual({status});
 });
 it('admits inclusive parent bounds and bounds escaped output for8 hostile-looking previews',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();for(let i=0;i<8;i++)d.observe('node:module','\0'.repeat(4096),false,false);
  const v=capture(d);expect(v.observations[0].parent.status).toBe('valid');expect(v.omitted).toBe(false);
 });
 it('never accesses error properties, code or arbitrary module getters',()=>{
  let calls=0;const error={get message(){calls++;throw Error('secret');},get code(){calls++;throw Error('secret');},get toJSON(){calls++;throw Error('secret');}};
  capture(outputPolicy.createWorkerImporterDiagnostic(),error);expect(calls).toBe(0);
 });
 it('does not reread classifier code and preserves the exact original refusal object',()=>{
  let calls=0,error:unknown;try{classifyWorkerModuleSource('node:module',44,{id:'node:module',get code(){calls++;return null;}},false);}catch(e){error=e;}
  expect(error).toBeInstanceOf(Error);capture(outputPolicy.createWorkerImporterDiagnostic(),error);expect(calls).toBe(1);
 });
 it('preserves original failure when the supplied emitter throws',()=>{
  const original={};let caught:unknown,calls=0;try{outputPolicy.createWorkerImporterDiagnostic().rethrow(original,'node:module',()=>{calls++;throw Error('emit');});}catch(e){caught=e;}
  expect(caught).toBe(original);expect(calls).toBe(1);
 });
 it('does not emit diagnostic for other refused IDs or coerce them',()=>{
  let calls=0;const d=outputPolicy.createWorkerImporterDiagnostic(),original={};
  try{d.rethrow(original,{toString(){calls++;return 'node:module';}},()=>{calls++;});}catch(e){expect(e).toBe(original);}expect(calls).toBe(0);
 });
 it('reports known zero matching callbacks without claiming no graph importers',()=>{
  expect(capture(outputPolicy.createWorkerImporterDiagnostic())).toMatchObject({callbackCountKnown:true,retainedCallbackCount:0,complete:true,scope:'original external callback observations only'});
 });
 it('makes the ninth matching callback partial with unknown total',()=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();for(let i=0;i<9;i++)d.observe('node:module',undefined,false,false);
  expect(capture(d)).toMatchObject({callbackCountKnown:false,retainedCallbackCount:8,complete:false,omitted:true});
 });
 it.each([['\0rolldown/runtime.js',true],['\0rolldown/runtime.js-suffix',false],['é',false]])('retains byte length and exact runtime marker comparison %#',(parent,match)=>{
  const d=outputPolicy.createWorkerImporterDiagnostic();d.observe('node:module',parent,false,false);
  expect(capture(d).observations[0].parent).toMatchObject({byteLength:Buffer.byteLength(parent),exactRuntimeMarkerMatch:match});
 });
});
describe('worker loader-free ES output profile',()=>{
 it('retains the fixed generation profile and explicitly disables the require polyfill',()=>{
  expect(typeof outputPolicy.workerStaticOutputOptions).toBe('function');
  const options=outputPolicy.workerStaticOutputOptions();
  expect(options).toEqual({format:'es',codeSplitting:false,entryFileNames:'worker.mjs',sourcemap:false,minify:false,strictExecutionOrder:true,polyfillRequire:false,paths:{zod:zodAlias}});
  expect(Object.isFrozen(options)).toBe(true);
  expect(Reflect.set(options,'polyfillRequire',true)).toBe(false);
  expect(Reflect.apply(outputPolicy.workerStaticOutputOptions,null,[{polyfillRequire:true}])).toEqual(options);
 });
 it('retains only accepted normalized scalar metadata',()=>{
  expect(typeof outputPolicy.observeWorkerOutputPolicy).toBe('function');
  const observed=outputPolicy.observeWorkerOutputPolicy('es',false,{zod:zodAlias});
  expect(observed).toEqual({format:'es',polyfillRequire:false,paths:{zod:zodAlias}});expect(Object.isFrozen(observed)).toBe(true);expect(Object.isFrozen(observed.paths)).toBe(true);
 });
 it.each([['es',true],['es',undefined],['es',null],['esm',false],['cjs',false],[undefined,false]])('refuses normalized scalar mismatch %#',(format,polyfill)=>{
  expect(typeof outputPolicy.observeWorkerOutputPolicy).toBe('function');
  expect(()=>outputPolicy.observeWorkerOutputPolicy(format,polyfill)).toThrow('Worker output policy denied');
 });
 it('never coerces hostile scalar arguments or echoes their values',()=>{
  expect(typeof outputPolicy.observeWorkerOutputPolicy).toBe('function');
  let calls=0;const hostile={toString(){calls++;throw Error('secret');},get toJSON(){calls++;throw Error('secret');}};
  expect(()=>outputPolicy.observeWorkerOutputPolicy(hostile,false)).toThrow(/^Worker output policy denied$/);
  expect(()=>outputPolicy.observeWorkerOutputPolicy('es',hostile)).toThrow(/^Worker output policy denied$/);expect(calls).toBe(0);
 });
 it('accepts only the three own-data report fields and returns a fresh frozen projection',()=>{
  expect(typeof outputPolicy.readWorkerOutputPolicy).toBe('function');
  const source={format:'es',polyfillRequire:false,paths:{zod:zodAlias}};const result=outputPolicy.readWorkerOutputPolicy(source);
  expect(result).toEqual(source);expect(result).not.toBe(source);expect(Object.isFrozen(result)).toBe(true);
  source.polyfillRequire=true;expect(result.polyfillRequire).toBe(false);
 });
 it.each([{}, {format:'es'}, {format:'es',polyfillRequire:false,extra:1}, {format:'es',polyfillRequire:true}, {format:'cjs',polyfillRequire:false}, null, []])('refuses malformed report policy %#',value=>{
  expect(typeof outputPolicy.readWorkerOutputPolicy).toBe('function');expect(()=>outputPolicy.readWorkerOutputPolicy(value)).toThrow();
 });
 it('refuses accessor, inherited and symbol report members without invoking getters',()=>{
  expect(typeof outputPolicy.readWorkerOutputPolicy).toBe('function');let calls=0;
  const accessor={get format(){calls++;return 'es';},polyfillRequire:false};
  for(const value of [accessor,Object.create({format:'es',polyfillRequire:false}),{format:'es',polyfillRequire:false,[Symbol('extra')]:1}])expect(()=>outputPolicy.readWorkerOutputPolicy(value)).toThrow();
  expect(calls).toBe(0);
 });
});
const id=(name:string)=>({type:'Identifier',name});
const lit=(value:unknown)=>({type:'Literal',value});
const program=(body:unknown[])=>({type:'Program',body});
const imp=(source:unknown)=>({type:'ImportDeclaration',source,specifiers:[]});
const call=(callee:unknown)=>({type:'CallExpression',callee,arguments:[]});
const member=(object:unknown,property:unknown,computed=false)=>({type:'MemberExpression',object,property,computed});
describe('worker configured external classification',()=>{
 it.each([['oversized-id','x'.repeat(4097),0],['invalid-index','rxjs',16384]] as const)('preflights %s before allowlist lookup or module getters',(_name,id,index)=>{
  let lookups=0,idReads=0,codeReads=0,message='';const original=Object.hasOwn;
  const spy=vi.spyOn(Object,'hasOwn').mockImplementation((object,key)=>{if(object===MOUNTED_MODULE_PACKAGE_SPECIFIERS)lookups++;return original(object,key);});
  try{classifyWorkerModuleSource(id,index,{get id(){idReads++;return id;},get code(){codeReads++;return null;}},true);}catch(e){if(e instanceof Error)message=e.message;}
  finally{spy.mockRestore();}
  expect(lookups).toBe(0);expect(idReads).toBe(0);expect(codeReads).toBe(0);expect(message).toMatch(/^Worker module source denied: /);expect(Buffer.byteLength(message)).toBeLessThanOrEqual(1024);
 });
 it.each([...Object.keys(MOUNTED_MODULE_PACKAGE_SPECIFIERS),...MOUNTED_MODULE_BUILTINS])('uses exact configured specifier %s with no code getter',id=>{
  let calls=0;expect(classifyWorkerModuleSource(id,0,{id,get code(){calls++;throw Error('not read');}},true)).toBe('configured-external');expect(calls).toBe(0);
 });
 it.each([null,undefined,'unexpected source'])('classifies exact requested external without reading code %#',value=>{
  let calls=0;const info={id:'rxjs',get code(){calls++;return value;}};
  expect(classifyWorkerModuleSource('rxjs',0,info,true)).toBe('configured-external');expect(calls).toBe(0);
 });
 it('does not invoke a throwing code getter on a configured external',()=>{
  let calls=0;const info={id:'node:http',get code(){calls++;throw Error('private');}};
  expect(classifyWorkerModuleSource('node:http',0,info,true)).toBe('configured-external');expect(calls).toBe(0);
 });
 it.each([['rxjs',false,null],['unknown',true,undefined],['/owned/a.ts',false,null]] as const)('requires string code for unclassified ID %s', (id,requested,code)=>{
  expect(()=>classifyWorkerModuleSource(id,0,{id,code},requested)).toThrow();
 });
 it('reads owned code exactly once before physical/virtual ownership continues',()=>{
  let calls=0;expect(classifyWorkerModuleSource('/owned/a.ts',1,{id:'/owned/a.ts',get code(){calls++;return 'export const x=1';}},false)).toBe('owned');expect(calls).toBe(1);
 });
 it('rejects info ID mismatch before configured classification/code access',()=>{
  let calls=0;expect(()=>classifyWorkerModuleSource('rxjs',2,{id:'zod',get code(){calls++;return null;}},true)).toThrow();expect(calls).toBe(0);
 });
 it('does not execute an info ID accessor or borrow missing info as an external',()=>{
  let calls=0;expect(()=>classifyWorkerModuleSource('rxjs',0,{get id(){calls++;return 'rxjs';}},true)).toThrow();expect(calls).toBe(0);
  expect(()=>classifyWorkerModuleSource('rxjs',0,null,true)).toThrow();
 });
 it('redacts a failing owned code getter without reading its thrown message',()=>{
  let calls=0,reads=0;const error={get message(){reads++;throw Error('secret');}};let message='';
  try{classifyWorkerModuleSource('/owned/a.ts',0,{id:'/owned/a.ts',get code(){calls++;throw error;}},false);}catch(e){if(e instanceof Error)message=e.message;}
  expect(message).toContain('"codeKind":"getter-threw"');expect(message).not.toContain('secret');expect(calls).toBe(1);expect(reads).toBe(0);
 });
 it('returns bounded primitive diagnostic facts without evaluating hostile code objects',()=>{
  let calls=0;const hostile={toJSON(){calls++;throw Error('private');},toString(){calls++;throw Error('private');},[Symbol.toPrimitive](){calls++;throw Error('private');}};
  let message='';try{classifyWorkerModuleSource('/owned/a.ts',3,{id:'/owned/a.ts',code:hostile},false);}catch(e){if(e instanceof Error)message=e.message;}
  expect(message).toMatch(/^Worker module source denied: /);expect(Buffer.byteLength(message)).toBeLessThanOrEqual(1024);
  expect(JSON.parse(message.slice('Worker module source denied: '.length))).toMatchObject({idSha256:createHash('sha256').update('/owned/a.ts').digest('hex'),codeKind:'object',allowed:false,requested:false,index:3,idMatches:true});expect(calls).toBe(0);expect(message).not.toContain('private');
 });
 it('bounds escaped diagnostic preview for a4096-character ID',()=>{
  const id='\0'.repeat(4096);let message='';try{classifyWorkerModuleSource(id,4,{id,code:null},false);}catch(e){if(e instanceof Error)message=e.message;}
  expect(Buffer.byteLength(message)).toBeLessThanOrEqual(1024);expect(message).toContain(createHash('sha256').update(id).digest('hex'));
 });
 it('keeps final ownership refusal when a configured external appears in emitted owned modules',()=>{
  expect(classifyWorkerModuleSource('rxjs',0,{id:'rxjs',code:null},true)).toBe('configured-external');
  expect(()=>assertCompilerRuntimeOwnership([{kind:'chunk',moduleIds:['rxjs'],facadeModuleId:null}],[],{provider:'rolldown',version:'1.2.13',runtimeModuleId:'\0rolldown/runtime.js'},[])).toThrow();
 });
});
describe('worker STATIC supplied AST only',()=>{
 it('retains static, export-from and dynamic occurrences in original order',()=>{
  expect(collectWorkerModuleImports(program([imp(lit('rxjs')),{type:'ExportNamedDeclaration',source:lit('rxjs'),specifiers:[]},
   {type:'ExportAllDeclaration',source:lit('node:http')},{type:'ImportExpression',source:lit('@ag-ui/client'),options:null}]))).toEqual([
   {specifier:'rxjs',kind:'static'},{specifier:'rxjs',kind:'static'},{specifier:'node:http',kind:'static'},{specifier:'@ag-ui/client',kind:'dynamic-literal'}]);
 });
 it.each([...Object.keys(MOUNTED_MODULE_PACKAGE_SPECIFIERS),...MOUNTED_MODULE_BUILTINS])('admits existing public specifier %s',specifier=>{
  const raw=specifier==='zod'?zodAlias:specifier;expect(collectWorkerModuleImports(program([imp(lit(raw))]))).toEqual([{specifier:raw,kind:'static'}]);
 });
 it.each(['./x.js','/x.js','file:///x.js','data:text/javascript,x','https://outside/x','@ag-ui/encoder','node:module','node:vm','node:worker_threads','@copilotkit/runtime/private'])('refuses unsupported import %s',s=>{
  expect(()=>collectWorkerModuleImports(program([imp(lit(s))]))).toThrow('Worker module import denied');
 });
 it('retains all64 occurrences and refuses65',()=>{
  expect(collectWorkerModuleImports(program(Array.from({length:64},()=>imp(lit('rxjs')))))).toHaveLength(64);
  expect(()=>collectWorkerModuleImports(program(Array.from({length:65},()=>imp(lit('rxjs')))))).toThrow('Worker import occurrence overflow');
 });
 it('permits empty attributes/assertions and null default phase/options',()=>{
  expect(collectWorkerModuleImports(program([{...imp(lit('rxjs')),attributes:[],assertions:[],phase:null},
   {type:'ImportExpression',source:lit('@ag-ui/client'),attributes:[],phase:null,options:null}]))).toEqual([
   {specifier:'rxjs',kind:'static'},{specifier:'@ag-ui/client',kind:'dynamic-literal'}]);
 });
 it.each([id('source'),{type:'TemplateLiteral',expressions:[],quasis:[]}])('refuses nonliteral dynamic source %#',source=>{
  expect(()=>collectWorkerModuleImports(program([{type:'ImportExpression',source}]))).toThrow('Worker module import denied');
 });
 it.each([{options:{}},{attributes:[{}]},{assertions:[{}]},{phase:'source'}])('refuses dynamic import extensions %#',extra=>{
  expect(()=>collectWorkerModuleImports(program([{type:'ImportExpression',source:lit('rxjs'),...extra}]))).toThrow('Worker module import denied');
 });
 it('also refuses static import attributes and unsupported module syntax',()=>{
  for(const node of [{...imp(lit('rxjs')),attributes:[{}]},{type:'ImportAttribute',key:id('type'),value:lit('json')},
   {type:'ImportDeclaration',source:lit('rxjs'),phase:'defer'}])expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker module import denied');
 });
 it.each(['require','createRequire','eval','Function','importScripts','Worker','SharedWorker'])('refuses loader value references and aliases %s',name=>{
  for(const node of [call(id(name)),{type:'VariableDeclarator',id:id('alias'),init:id(name)},{type:'UnaryExpression',operator:'typeof',argument:id(name)}])
   expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker loader form denied');
 });
 it.each([['module','require'],['require','resolve'],['process','getBuiltinModule'],['process','dlopen'],['process','binding'],['process','_linkedBinding'],['process','mainModule'],['globalThis','eval'],['global','Function']])('refuses member loader %s.%s',(root,key)=>{
  for(const computed of [false,true])expect(()=>collectWorkerModuleImports(program([call(member(id(root),computed?lit(key):id(key),computed))]))).toThrow('Worker loader form denied');
 });
 it('refuses import.meta.resolve and unknown computed loader-root access',()=>{
  const meta={type:'MetaProperty',meta:id('import'),property:id('meta')};
  expect(()=>collectWorkerModuleImports(program([call(member(meta,id('resolve')))]))).toThrow('Worker loader form denied');
  for(const root of ['module','process','globalThis','global'])expect(()=>collectWorkerModuleImports(program([member(id(root),id('key'),true)]))).toThrow('Worker loader form denied');
 });
 it('permits neutral property keys and local CommonJS exports but scans wrapper bodies',()=>{
  const wrapper={type:'FunctionDeclaration',id:id('require_encoder'),params:[id('module')],body:{type:'BlockStatement',body:[
   {type:'AssignmentExpression',operator:'=',left:member(id('module'),id('exports')),right:lit(1)},
   {type:'ObjectExpression',properties:[{type:'Property',key:id('eval'),value:lit(1),computed:false,shorthand:false}]}]}};
  expect(collectWorkerModuleImports(program([wrapper,call(id('require_encoder'))]))).toEqual([]);
  wrapper.body.body.push(call(id('require')) as never);
  expect(()=>collectWorkerModuleImports(program([wrapper]))).toThrow('Worker loader form denied');
 });
 it('scans optional/indirect loader references and shorthand values',()=>{
  for(const node of [{...call(id('eval')),optional:true},{type:'SequenceExpression',expressions:[lit(0),id('eval')]},
   {type:'Property',key:id('eval'),value:id('eval'),computed:false,shorthand:true}])expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker loader form denied');
 });
 it('bounds depth and total visits without parser execution',()=>{
  let deep:unknown=id('safe');for(let i=0;i<257;i++)deep={type:'BlockStatement',child:deep};
  expect(()=>collectWorkerModuleImports(deep)).toThrow('Parser tree bound');
  expect(()=>collectWorkerModuleImports(program(Array(500000).fill(id('safe'))))).toThrow('Parser tree bound');
 });
 it('refuses accessor AST data without invoking it',()=>{
  let reads=0;const node=imp(lit('rxjs'));Object.defineProperty(node,'source',{get(){reads++;throw Error('secret');}});
  expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker AST data denied');expect(reads).toBe(0);
 });
 it('refuses sparse child arrays',()=>expect(()=>collectWorkerModuleImports(program(new Array(1)))).toThrow('Worker AST data denied'));
 it.each(['toString','toPrimitive'])('never coerces hostile Identifier.name through %s',form=>{
  let calls=0;const name:unknown=form==='toString'?{toString(){calls++;return 'process';}}:{[Symbol.toPrimitive](){calls++;return 'process';}};
  const node={type:'MemberExpression',object:{type:'Identifier',name},property:id('binding'),computed:false};
  expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker AST data denied');expect(calls).toBe(0);
 });
 it('never coerces a hostile member name',()=>{
  let calls=0;const name={[Symbol.toPrimitive](){calls++;return 'binding';}};
  expect(()=>collectWorkerModuleImports(program([member(id('process'),{type:'Identifier',name})]))).toThrow('Worker AST data denied');expect(calls).toBe(0);
 });
 it('never coerces hostile parent/node types while checking neutral Identifier positions',()=>{
  let calls=0;const type={toString(){calls++;return 'VariableDeclarator';},[Symbol.toPrimitive](){calls++;return 'VariableDeclarator';}};
  for(const node of [{type,id:id('eval')},{type,child:member(id('process'),id('binding'))}])
   expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker AST data denied');
  expect(calls).toBe(0);
 });
 it('treats the parser native RegExp Literal value as a checked opaque leaf',()=>{
  expect(collectWorkerModuleImports(program([{type:'Literal',regex:{pattern:'x+',flags:'ig'},value:/x+/ig,raw:'/x+/ig'}]))).toEqual([]);
 });
 it('refuses RegExp outside Literal.value or with contradictory metadata',()=>{
  for(const node of [/x/,{type:'Literal',value:/x/},{type:'Literal',value:/x/,regex:{pattern:'y',flags:''}},
   {type:'Literal',value:/x/i,regex:{pattern:'x',flags:''}},{type:'Literal',value:Object.create(RegExp.prototype),regex:{pattern:'x',flags:''}}])
   expect(()=>collectWorkerModuleImports(program([node]))).toThrow('Worker AST data denied');
 });
 it('rejects accessor regex metadata without reading it and scans other Literal children',()=>{
  let calls=0;const regex={pattern:'x',flags:''};Object.defineProperty(regex,'pattern',{get(){calls++;return 'x';}});
  expect(()=>collectWorkerModuleImports(program([{type:'Literal',value:/x/,regex}]))).toThrow('Worker AST data denied');expect(calls).toBe(0);
  expect(()=>collectWorkerModuleImports(program([{type:'Literal',value:/x/,regex:{pattern:'x',flags:''},child:call(id('eval'))}]))).toThrow('Worker loader form denied');
 });
 it('never invokes overridden source/flags getters on a Literal RegExp value',()=>{
  let calls=0;const value=/x/;Object.defineProperty(value,'source',{get(){calls++;return 'x';}});
  expect(()=>collectWorkerModuleImports(program([{type:'Literal',value,regex:{pattern:'x',flags:''}}]))).toThrow('Worker AST data denied');expect(calls).toBe(0);
 });
});
const sha='a'.repeat(40);
const receipt=()=>({step:'inspect',sourceSha:sha,policyAccepted:true,originalClosed:true});
const report=()=>({schemaVersion:4,parserComplete:true,parserMicrocases:{count:22,passed:true},qualification:false,
 files:[{path:'index.html',bytes:1,sha256:'b'.repeat(64),regular:true,contained:true,symlink:false}]});
describe('worker same-source frontend supplied prerequisite only',()=>{
 it('allows callback only after a complete successful same-source prerequisite',()=>{
  let calls=0;assertWorkerFrontendPrerequisite(sha,receipt(),report());calls++;expect(calls).toBe(1);
 });
 it.each([{step:'build'},{sourceSha:'c'.repeat(40)},{policyAccepted:false},{originalClosed:false}])('refuses receipt contradiction %#',change=>{
  let calls=0;expect(()=>{assertWorkerFrontendPrerequisite(sha,{...receipt(),...change},report());calls++;}).toThrow('Worker frontend prerequisite denied');expect(calls).toBe(0);
 });
 it.each([{schemaVersion:3},{parserComplete:false},{qualification:true},{parserMicrocases:{count:21,passed:true}},{parserMicrocases:{count:22,passed:false}},{files:[]}])('refuses incomplete static report %#',change=>{
  expect(()=>assertWorkerFrontendPrerequisite(sha,receipt(),{...report(),...change})).toThrow('Worker frontend prerequisite denied');
 });
 it('refuses missing prerequisites, malformed source identity and bad inventory',()=>{
  for(const args of [[sha,null,report()],[sha,receipt(),null],['invalid',receipt(),report()],
   [sha,receipt(),{...report(),files:[{...report().files[0],symlink:true}]}]])expect(()=>Reflect.apply(assertWorkerFrontendPrerequisite,null,args)).toThrow('Worker frontend prerequisite denied');
 });
 it('does not invoke prerequisite field accessors',()=>{
  let reads=0;const r=receipt();Object.defineProperty(r,'policyAccepted',{get(){reads++;return true;}});
  expect(()=>assertWorkerFrontendPrerequisite(sha,r,report())).toThrow('Worker frontend prerequisite denied');expect(reads).toBe(0);
 });
});
