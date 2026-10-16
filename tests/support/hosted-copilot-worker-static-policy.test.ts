import {describe,it,expect,vi} from 'vitest';
import {collectWorkerModuleImports,assertWorkerFrontendPrerequisite,classifyWorkerModuleSource} from './hosted-copilot-worker-static-policy.ts';
import {assertCompilerRuntimeOwnership} from './hosted-copilot-production-policy.ts';
import {createHash} from 'node:crypto';
import {MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_MODULE_BUILTINS} from './hosted-copilot-mounted-policy.ts';
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
   {type:'ExportAllDeclaration',source:lit('node:http')},{type:'ImportExpression',source:lit('zod'),options:null}]))).toEqual([
   {specifier:'rxjs',kind:'static'},{specifier:'rxjs',kind:'static'},{specifier:'node:http',kind:'static'},{specifier:'zod',kind:'dynamic-literal'}]);
 });
 it.each([...Object.keys(MOUNTED_MODULE_PACKAGE_SPECIFIERS),...MOUNTED_MODULE_BUILTINS])('admits existing public specifier %s',specifier=>{
  expect(collectWorkerModuleImports(program([imp(lit(specifier))]))).toEqual([{specifier,kind:'static'}]);
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
   {type:'ImportExpression',source:lit('zod'),attributes:[],phase:null,options:null}]))).toEqual([
   {specifier:'rxjs',kind:'static'},{specifier:'zod',kind:'dynamic-literal'}]);
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
