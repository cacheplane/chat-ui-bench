import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import * as api from './prepare.mjs';
import * as supervisor from './run.mjs';
import * as provenance from '../../apps/threadplane/provenance.mjs';

const published={
 chat:'sha512-S6SqtNmORfklweqnGTI4L+8ZBSaQ825b1OtbsCvXjZxw7ywikda3ARfX1BMHwSDHCwtq/+H1N5Id4CCodWJdSw==',
 a2ui:'sha512-9mjcroEaxwEgIWWwbpWsvCUr6+MheIdMyJCOKHrX+KaqpPqrY/juvlPjgU40OTJWkAVnB+dY95Ow070HHH+P8w==',
 langgraph:'sha512-QHphnlzqWuYM2D1UfTyRpCqW5UnAIyEYE1bVGDWXyeUHBmozVydVQjL/rtYf9SMMMHLcT15YcaXM5P+bRGcBOg==',
 render:'sha512-gUbUPOC5aqWc8cutMgceoa98iTJRGGOj39CiSD34AH82pvwtnqUlxKxppu5/h05C6VvnzcKdLfx0mHorabJLYw==',
 telemetry:'sha512-D3t8G8OgWMfP7SvlJLf1h9aFJ7m4SaPLTWIgZ7SAOGJi3qH7AtPgDLHyzeawTWC9bqN9z9X5e/ZhZp4911yLiQ=='
};
test('stock033 exposes separate fixed preparation, parent admission, and product parser',()=>{
 for(const name of ['prepareStock033','prepareActualStock033','verifyStock033Preparation'])assert.equal(typeof api[name],'function',name);
 assert.equal(typeof supervisor.runStock033Original,'function');assert.equal(typeof provenance.parseStock033ProductRecord,'function');
});

async function authored(action){
 const root=await fs.realpath(await fs.mkdtemp(tmpdir()+'/stock033-authored-')),sourceRoot=root+'/source',assetRoot=sourceRoot+'/apps/threadplane/dist',outputDirectory=root+'/prepared',values=new Map(),put=(key,b)=>values.set(key,Buffer.from(b));
 const packages=Object.entries(published).map(([short,integrity])=>({name:'@threadplane/'+short,version:'0.3.3',integrity,resolutionPath:'apps/threadplane/node_modules/@threadplane/'+short}));
 for(const p of packages)put(p.resolutionPath+'/package.json',JSON.stringify({name:p.name,version:p.version}));
 put('package-lock.json',JSON.stringify({packages:Object.fromEntries(packages.map(p=>[p.resolutionPath,{version:p.version,integrity:p.integrity}]))}));
 put('apps/threadplane/build.mjs','// stock builder');put('apps/threadplane/angular.json',await fs.readFile(new URL('../../apps/threadplane/angular.json',import.meta.url)));
 const history=Array.from({length:100},(_,i)=>({id:'m'+i,role:'user',text:'authored',status:'complete'})),fixture={status:'source-fixture-verified',authority:false,history,digests:{sourceSha256:'a'.repeat(64),eventsSha256:'b'.repeat(64),historySha256:'c'.repeat(64)}};
 const fixtureKey='tools/native-real-chat/fixture-entry.mjs';put(fixtureKey,'export function compileSourceFixture(){return '+JSON.stringify(fixture)+';}');
 const assetHashes={};for(let i=0;i<12;i++){const name='asset'+i+'.js';put('apps/threadplane/dist/'+name,'// asset '+i);assetHashes[name]=api.sha(values.get('apps/threadplane/dist/'+name));}
 const sourceHashes=Object.fromEntries(['apps/threadplane/build.mjs','apps/threadplane/angular.json'].map(key=>[key,api.sha(values.get(key))]));
 const product={packages,framework:{name:'Angular',version:'21.2.26'},production:true,sourceHashes,copiedSourceHashes:{},assetHashes,settings:{optimization:true,sourceMaps:false}},productKey='apps/threadplane/.build-evidence.json';put(productKey,JSON.stringify(product,null,2)+'\n');
 while(values.size<1004)put('authored/file'+values.size+'.txt','authored');
 const roster=[];for(const[key,b]of values){await fs.mkdir(sourceRoot+'/'+key.slice(0,key.lastIndexOf('/')),{recursive:true});await fs.writeFile(sourceRoot+'/'+key,b);roster.push({key,bytes:b.length,sha256:api.sha(b)});}
 const platformRows=[];for(let i=0;i<4;i++){const p=root+'/platform'+i;platformRows.push({key:'platform/file'+i,path:p,...await api.writeClosed(p,Buffer.from('platform'),32)});}
 const runtime={executablePath:platformRows[0].path,expectedExecutableBytes:platformRows[0].bytes,expectedExecutableSha256:platformRows[0].sha256,playwrightVersion:'1.64.0',browserRevision:'1248',expectedProduct:'HeadlessChrome/156.0.8078.4',expectedRevision:'@f842f52ef39fd97b449eb27cff414bf05a98ddce',launchFlags:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-automation'],headless:true};
 const options={mode:'real-chat-history100-stock-033-v1',sourceRoot,assetRoot,outputDirectory,roster,runtime,productRecord:sourceRoot+'/'+productKey,platformRows,compilationDirectory:root+'/compilation',expectedFixtureInputs:[{...roster.find(r=>r.key===fixtureKey)}]};
 async function update(key,b){b=Buffer.from(b);await fs.writeFile(sourceRoot+'/'+key,b);Object.assign(roster.find(r=>r.key===key),{bytes:b.length,sha256:api.sha(b)});}
 async function rewrite(mutator){const next=structuredClone(product);mutator(next);await update(productKey,JSON.stringify(next,null,2)+'\n');}
 const open=fs.open;fs.open=async(filename,...args)=>{const file=await open(filename,...args);if(filename.startsWith(outputDirectory+'/inputs/'))file.sync=async()=>{};return file;};
 try{return await action({root,options,product,rewrite,update});}finally{fs.open=open;await fs.rm(root,{recursive:true});}
}

test('stock033 exact authentic production admission and original reference joins',()=>authored(async({options})=>{
 const prepared=await api.prepareActualStock033(options);assert.equal(prepared.template.mode,options.mode);assert.equal(prepared.reference.policy,'source-owned-preparation-reference-stock-033-v1');
 assert.deepEqual(await api.verifyStock033Preparation(options.outputDirectory,prepared.template,prepared.reference),prepared.template);
 assert.equal((await api.verifyOriginals(options.outputDirectory,prepared.reference.manifest)).files,1004);
 assert.equal(prepared.template.assets.length,12);assert.equal(prepared.template.product.id,'threadplane-stock-0.3.3');
}));

test('stock033 refuses short and legacy-sized input rosters before output',()=>authored(async({options})=>{
 const extra=Array.from({length:12},(_,i)=>({key:'authored/extra'+i+'.txt',bytes:0,sha256:api.sha(Buffer.alloc(0))}));
 for(const roster of [options.roster.slice(0,-1),[...options.roster,...extra]]){
  await assert.rejects(api.prepareActualStock033({...options,roster}));
  await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});
  await assert.rejects(fs.stat(options.compilationDirectory),{code:'ENOENT'});
 }
}));

test('stock033 refuses historical records even at the correct input count before compilation',()=>authored(async({options})=>{
 const roster=options.roster.map(row=>({...row})),row=roster.find(row=>row.key.startsWith('authored/'));
 const bytes=await fs.readFile(options.sourceRoot+'/'+row.key);row.key='records/fixture-output.json';
 await fs.mkdir(options.sourceRoot+'/records');await fs.writeFile(options.sourceRoot+'/'+row.key,bytes);
 assert.equal(roster.length,1004);
 await assert.rejects(api.prepareActualStock033({...options,roster}));
 await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});
 await assert.rejects(fs.stat(options.compilationDirectory),{code:'ENOENT'});
}));

test('stock033 product identity refuses a different physical installed package location',()=>authored(async({product})=>{
 const contract=await import('../../packages/contract/dist/index.js'),bytes=Buffer.from(JSON.stringify(product,null,2)+'\n');assert.deepEqual(provenance.parseStock033ProductRecord(bytes,contract),product);
 const altered=structuredClone(product);altered.packages[0].resolutionPath='node_modules/'+altered.packages[0].name;assert.throws(()=>provenance.parseStock033ProductRecord(Buffer.from(JSON.stringify(altered,null,2)+'\n'),contract));
}));

test('stock033 refuses old versions, integrity mismatch, modified envelopes, source hashes and asset membership before output',()=>authored(async({options,rewrite})=>{
 for(const fault of [p=>p.packages[0].version='0.3.2',p=>p.packages[0].integrity='sha512-YQ==',p=>p.packages.pop(),p=>p.variant={},p=>p.kind='native-idle-host-css-product-v1',p=>p.sourceHashes['apps/threadplane/src/native-idle-host-css-v1.css']='a'.repeat(64),p=>p.sourceHashes['apps/threadplane/build.mjs']='0'.repeat(64),p=>p.assetHashes['absent.js']=p.assetHashes['asset0.js'],p=>delete p.assetHashes['asset0.js']]){
  await rewrite(fault);await assert.rejects(api.prepareActualStock033(options));await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});
 }
}));

test('stock033 refuses metadata-lock mismatch and modified Angular configuration',()=>authored(async({options,update,product,rewrite})=>{
 const p=product.packages[1];await update(p.resolutionPath+'/package.json',JSON.stringify({name:p.name,version:'0.3.2'}));await assert.rejects(api.prepareActualStock033(options));await update(p.resolutionPath+'/package.json',JSON.stringify({name:p.name,version:p.version}));
 await update('package-lock.json',JSON.stringify({packages:{}}));await assert.rejects(api.prepareActualStock033(options));
 await update('package-lock.json',JSON.stringify({packages:Object.fromEntries(product.packages.map(p=>[p.resolutionPath,{version:p.version,integrity:p.integrity}]))}));
 const config=JSON.parse(await fs.readFile(options.sourceRoot+'/apps/threadplane/angular.json'));config.projects.threadplane.architect.build.options.styles.push('src/native-idle-host-css-v1.css');const b=JSON.stringify(config);await update('apps/threadplane/angular.json',b);await rewrite(p=>p.sourceHashes['apps/threadplane/angular.json']=api.sha(b));await assert.rejects(api.prepareActualStock033(options));
}));

test('stock033 rejects cross-family references, hostile DTOs and altered originals before parent fork',()=>authored(async({options})=>{
 const {template,reference}=await api.prepareActualStock033(options),fork=cp.fork,release=process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;let forks=0,traps=0;cp.fork=()=>{forks++;throw Error('forbidden');};process.env.NATIVE_REAL_CHAT_ONCE_RELEASE='source-reviewed-native-chat-stock-033-v1';
 try{
  for(const policy of ['source-owned-preparation-reference-v1','source-owned-preparation-reference-idle-host-css-v1'])await assert.rejects(supervisor.runStock033Original(options.outputDirectory,template,{...reference,policy}));
  const hostile=new Proxy({},{get(){traps++;throw Error('proxy');},ownKeys(){traps++;throw Error('proxy');}});await assert.rejects(supervisor.runStock033Original(options.outputDirectory,hostile,reference));assert.equal(traps,0);
  await fs.writeFile(options.sourceRoot+'/apps/threadplane/build.mjs','changed');await assert.rejects(supervisor.runStock033Original(options.outputDirectory,template,reference));assert.equal(forks,0);
 }finally{cp.fork=fork;if(release===undefined)delete process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;else process.env.NATIVE_REAL_CHAT_ONCE_RELEASE=release;}
}));

test('stock033 refuses custom fixture and platform array serialization before invoking user hooks',()=>authored(async({options})=>{
 let hooks=0;for(const key of ['expectedFixtureInputs','platformRows'])for(const kind of ['own-method','prototype']){
  const rows=options[key].slice(),toJSON=()=>{hooks++;return [];};
  if(kind==='own-method')Object.defineProperty(rows,'toJSON',{value:toJSON});else Object.setPrototypeOf(rows,Object.assign(Object.create(Array.prototype),{toJSON}));
  await assert.rejects(api.prepareActualStock033({...options,[key]:rows}),key+' '+kind);assert.equal(hooks,0);
  await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});
 }
}));

test('stock033 parent projects the unchanged worker request and preserves original closure receipt semantics',()=>authored(async({options})=>{
 const {template,reference}=await api.prepareActualStock033(options),fork=cp.fork,ps=cp.execFileSync,kill=process.kill,release=process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;let request,environment,forks=0,projectionError;
 process.env.NATIVE_REAL_CHAT_ONCE_RELEASE='source-reviewed-native-chat-stock-033-v1';
 cp.execFileSync=(_command,args)=>{const pid=Number(args[2]);return `${pid} ${pid===123?process.pid:123} ${pid} Mon Oct 1 00:00:00 2026\n`;};
 process.kill=(_pid,signal)=>{if(signal==='SIGKILL')return true;const error=Error('authored-absent');error.code='ESRCH';throw error;};
 cp.fork=(_module,args,config)=>{forks++;environment=config.env;const child=new EventEmitter;Object.assign(child,{pid:123,exitCode:null,stdout:new EventEmitter,stderr:new EventEmitter,kill(){return true;},send(_message,callback){callback?.();}});
  queueMicrotask(async()=>{try{const bytes=await fs.readFile(args[0]);request=JSON.parse(bytes);assert.equal(api.sha(bytes),JSON.parse(args[1]).sha256);}catch(error){projectionError=error;}
   child.emit('message',{type:'browser-born',nonce:request?.nonce,pid:456});for(const stream of [child.stdout,child.stderr]){stream.emit('end');stream.emit('close');}child.emit('exit',0,null);child.emit('close',0,null);
  });return child;
 };
 try{
  const result=await supervisor.runStock033Original(options.outputDirectory,template,reference);assert.equal(projectionError,undefined);assert.equal(forks,1);assert.equal(request.mode,'real-chat-history100-v1');assert.deepEqual(Object.keys(request),['mode','root','nonce','runtime','assets','fixture','history','manifest','originNs']);assert.equal(environment.NATIVE_REAL_CHAT_SOURCE_RELEASE,'source-reviewed-native-chat-v1');assert.equal(result.kind,'native-stock-033-result-v1');assert.deepEqual(result.product,template.product);assert.equal(result.status,'original-process-closed');assert.equal(result.captureDeadlineMs,17000);assert.equal(result.cleanupAndFinalizationDeadlineMs,19000);assert.ok(result.operations.every(row=>row.state==='fulfilled'&&!row.timedOut));assert.equal(result.sourceBookends.stable,true);assert.equal(result.stdout.end,true);assert.equal(result.stdout.close,true);assert.equal(result.authority.nativeSupported,false);assert.equal(result.authority.FPS,null);const saved=JSON.parse(await fs.readFile(options.outputDirectory+'/outer.json'));assert.equal(saved.kind,result.kind);assert.equal(saved.status,'candidate-process-closed');
 }finally{cp.fork=fork;cp.execFileSync=ps;process.kill=kill;if(release===undefined)delete process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;else process.env.NATIVE_REAL_CHAT_ONCE_RELEASE=release;}
}));
