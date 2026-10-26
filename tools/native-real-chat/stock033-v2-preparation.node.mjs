import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import crypto,{createHash} from 'node:crypto';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import * as rosterApi from './roster-stock033-v2.mjs';
import {commonBuildKeys,contractSourceKeys,contractCompiledKeys,probeSourceKeys,probeCompiledKeys} from '../../apps/threadplane/probe-provenance.mjs';
import {stock033PackageIntegrities} from '../../apps/threadplane/provenance.mjs';
import * as contract from '../../packages/contract/dist/index.js';

const production=await import('./prepare-stock033-v2.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const api={...production,...production.createStock033AuthoredControlV2?.()};
const hash=b=>createHash('sha256').update(b).digest('hex');
test('tail500 preparation is separately selected and verifier retains observed custody',context=>authored(async({options})=>{
 const tail=production.createStock033AuthoredControlV2Tail500();
 const policy='native-post-phase-tail-500ms-v1';
 options.mode+='-tail500-v1';options.collectionPolicy=policy;options.release.policy+='-tail500-v1';options.release.collectionPolicy=policy;
 const result=await tail.prepareActualStock033V2Tail500(options);
 assert(Buffer.byteLength(JSON.stringify({type:'prepared',nonce:'a'.repeat(32),collectionPolicy:policy,template:result.template,reference:result.reference,accounting:{totals:tail.createStock033PreparationLedgerV2().totals(),platformSetSha256:'a'.repeat(64),peakHandles:8,peakOperations:16,stages:64},authoredControl:true})+'\n')<=8192);
 assert.equal(result.template.collectionPolicy,policy);assert.equal(result.reference.policy,'authored-preparation-reference-stock-033-v2-tail500-v1');
 const manifestBytes=await fs.readFile(options.outputDirectory+'/app-manifest.json'),manifest=JSON.parse(manifestBytes);
 assert.equal(manifest.mode,'authored-real-chat-source-custody-stock-033-v2-tail500-v1');assert.equal(manifest.collectionPolicy,policy);
 const owned=await tail.verifyStock033Tail500PreparationV2(options.outputDirectory,result.template,result.reference);
 const admission=tail.inspectStock033Tail500PreparationV2(owned),t=owned,lean={mode:'real-chat-history100-tail500-v1',collectionPolicy:policy,manifestSha256:admission.manifestSha256,sourceRevision:admission.sourceRevision,root:t.root,nonce:'a'.repeat(32),runtime:t.runtime,assets:t.assets,fixture:t.fixture,history:t.history,manifest:t.manifest,originNs:Number(process.hrtime.bigint())};
 const leanBytes=Buffer.byteLength(JSON.stringify(lean)+'\n');assert(leanBytes<=4096,'real authored tail500 lean request '+leanBytes+' bytes');context.diagnostic('actual authored tail500 lean request: '+leanBytes+' bytes including newline');
 assert.deepEqual(tail.inspectStock033Tail500PreparationV2(owned),{manifestSha256:hash(manifestBytes),sourceRevision:'a'.repeat(40),collectionPolicy:policy});
 assert.throws(()=>production.inspectStock033Tail500PreparationV2(owned));assert.throws(()=>tail.inspectStock033Tail500PreparationV2(structuredClone(owned)));
 for(const field of ['collectionPolicy','mode']){const wrong=structuredClone(result.template);delete wrong[field];await assert.rejects(tail.verifyStock033Tail500PreparationV2(options.outputDirectory,wrong,result.reference));}
 const foreign=structuredClone(result.reference);foreign.collectionPolicy='foreign';await assert.rejects(tail.verifyStock033Tail500PreparationV2(options.outputDirectory,result.template,foreign));
 await assert.rejects(api.verifyStock033PreparationV2(options.outputDirectory,result.template,result.reference));
 await assert.rejects(production.verifyStock033Tail500PreparationV2(options.outputDirectory,result.template,result.reference));
}));
test('tail500 rejects crossed or missing policy before source I/O',async()=>{
 const tail=production.createStock033AuthoredControlV2Tail500(),ledger=tail.createStock033PreparationLedgerV2();
 for(const options of [{mode:'authored-real-chat-history100-stock-033-v2'}, {mode:'authored-real-chat-history100-stock-033-v2-tail500-v1'}, {mode:'authored-real-chat-history100-stock-033-v2-tail500-v1',collectionPolicy:'foreign'}])await assert.rejects(tail.prepareActualStock033V2Tail500({...options,ledger}));
 assert.equal(ledger.snapshot().operations,0);
});
test('tail500 release and legacy preparation cannot cross selection before I/O',()=>authored(async({options})=>{
 const tail=production.createStock033AuthoredControlV2Tail500(),ledger=tail.createStock033PreparationLedgerV2(),selected={...options,mode:options.mode+'-tail500-v1',collectionPolicy:'native-post-phase-tail-500ms-v1',ledger};
 await assert.rejects(tail.prepareActualStock033V2Tail500(selected));assert.equal(ledger.snapshot().operations,0);
 selected.release={...options.release,policy:options.release.policy+'-tail500-v1',collectionPolicy:'native-post-phase-tail-500ms-v1'};
 await assert.rejects(api.prepareActualStock033V2(selected));assert.equal(ledger.snapshot().operations,0);
 selected.release.collectionPolicy='foreign';await assert.rejects(tail.prepareActualStock033V2Tail500(selected));assert.equal(ledger.snapshot().operations,0);
}));
test('reusable inert admission bounds data without invoking getters',()=>{
 assert.equal(typeof rosterApi.admitStock033DataV2,'function');let invoked=false;assert.throws(()=>rosterApi.admitStock033DataV2({get bad(){invoked=true;}}));assert.equal(invoked,false);assert.throws(()=>rosterApi.admitStock033DataV2({oversize:'x'.repeat(1048576)}));
});
test('bounded inert admission applies small exact serialized limits before construction',()=>{
 assert.throws(()=>rosterApi.admitStock033DataV2({x:'a'.repeat(4096)},4096));assert.doesNotThrow(()=>rosterApi.admitStock033DataV2({x:'a'.repeat(4088)},4096));
});
test('roster digest bytes are measured as part of the pure membership result',()=>authored(async({options,product,probe})=>{
 const roles=options.release.roles,rootAuthority={product,probe,productSourceKeys:Object.keys(product.sourceHashes),fixtureInputs:options.release.fixtureInputs,platform:'darwin',architecture:'arm64'},result=rosterApi.assembleStock033RosterV2({roles,observedRoles:roles,rootAuthority});
 const tuples=Object.keys(roles).sort().flatMap(role=>[...roles[role]].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(row=>[role,row.key,row.bytes,row.sha256]));assert.equal(result.digestBytes,Buffer.byteLength('native-stock033-roster-v2\0'+JSON.stringify(tuples)));
}));
test('failed original file close remains retained as unresolved owned custody',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2(),original=fs.open;let retained;
 fs.open=async(...args)=>{const file=await original(...args),close=file.close.bind(file);retained=close;file.close=()=>Promise.reject(Error('authored close rejection'));return file;};
 try{await assert.rejects(api.writeStock033FileV2(root+'/input',Buffer.from('x'),64,ledger),/authored close rejection/);assert(ledger.pending().some(name=>name.includes('handle')));}finally{fs.open=original;await retained?.();}
}));
test('isolated v2 preparation and source I/O APIs exist',()=>{
 for(const key of ['prepareActualStock033V2','verifyStock033PreparationV2','createStock033PreparationLedgerV2','readStock033FileV2','writeStock033FileV2','verifyStock033PlatformsV2'])assert.equal(typeof api[key],'function',key);
});
async function temporary(action){const root=await fs.realpath(await fs.mkdtemp(tmpdir()+'/stock033-v2-physical-'));try{return await action(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
test('owned physical read/write returns original identities and exact dispatched accounting',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2(),bytes=Buffer.from('authored physical bytes');
 const fact=await api.writeStock033FileV2(root+'/input',bytes,64,ledger,'external');
 assert.deepEqual((await api.readStock033FileV2(root+'/input',64,ledger,fact)).bytes,bytes);
 const counters=ledger.snapshot();assert(counters.operations>10);assert.equal(counters.writeBytes,bytes.length);assert.equal(counters.readBytes,2*bytes.length);assert.equal(counters.hashBytes,3*bytes.length);assert.equal(counters.peakHandles,1);assert.equal(ledger.pending().length,0);
 await fs.writeFile(root+'/replacement',bytes);await fs.rename(root+'/replacement',root+'/input');
 await assert.rejects(api.readStock033FileV2(root+'/input',64,ledger,fact),/stock033-v2/);
}));
test('physical custody refuses symlink, hardlink and oversize before open/read',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2();await fs.writeFile(root+'/regular','tiny');await fs.symlink(root+'/regular',root+'/symlink');await fs.link(root+'/regular',root+'/hardlink');
 for(const filename of ['regular','hardlink','symlink'])await assert.rejects(api.readStock033FileV2(root+'/'+filename,3,ledger),/stock033-v2/);
 assert.equal(ledger.snapshot().readBytes,0);assert.equal(ledger.snapshot().peakHandles,0);
}));
test('ledger refuses operations, read/hash/write totals, stages and deadlines before dispatch',async()=>{
 for(const [counter,cap]of [['operations',131072],['readBytes',3221225472],['hashBytes',3221225472],['externalWriteBytes',8388608]]){
  const ledger=api.createStock033PreparationLedgerV2({initial:{[counter]:cap}});let dispatched=false;
  if(counter==='operations')await assert.rejects(ledger.operation('authored',()=>{dispatched=true;}),/stock033-v2/);
  else assert.throws(()=>ledger.charge(counter,1),/stock033-v2/);
  assert.equal(dispatched,false);
 }
 let now=0;const ledger=api.createStock033PreparationLedgerV2({now:()=>now});now=60000;assert.throws(()=>ledger.assertActive(),/deadline/);assert.doesNotThrow(()=>ledger.assertFinal());now=65000;assert.throws(()=>ledger.assertFinal(),/deadline/);
 const stages=api.createStock033PreparationLedgerV2();for(let i=0;i<64;i++)stages.stage('s'+i);assert.throws(()=>stages.stage('overflow'),/stock033-v2/);
});
test('platform passes stream exact content under separate distinct and repeated-read ledgers',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2();const fact=await api.writeStock033FileV2(root+'/platform',Buffer.from('platform'),64,ledger,'external');const rows=[{key:'platform/node',path:root+'/platform',...fact}];
 for(let i=0;i<4;i++)await api.verifyStock033PlatformsV2(rows,ledger);
 assert.equal(ledger.snapshot().platformPasses,4);assert.equal(ledger.totals().platformReadBytes,32);assert.equal(ledger.totals().platformReferencedBytes,8);
 const before=ledger.snapshot().operations;await assert.rejects(api.verifyStock033PlatformsV2(rows,ledger),/stock033-v2/);assert.equal(ledger.snapshot().operations,before);
}));
test('v2 rejects v1 options/reference and unsafe release data without filesystem dispatch',async()=>{
 const ledger=api.createStock033PreparationLedgerV2();
 await assert.rejects(api.prepareActualStock033V2({mode:'real-chat-history100-stock-033-v1',ledger}),/stock033-v2/);
 await assert.rejects(api.verifyStock033PreparationV2('/tmp/not-created',{mode:'real-chat-history100-stock-033-v1'},{policy:'source-owned-preparation-reference-stock-033-v1'},{ledger}),/stock033-v2/);
 assert.equal(ledger.snapshot().operations,0);
});

async function authored(action){return temporary(async root=>{
 const sourceRoot=root+'/source',values=new Map(),put=(key,value)=>values.set(key,Buffer.from(value)),fixtureKey='tools/native-real-chat/fixture-entry.mjs';
 const source=contract.createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'}),messages=source.history.map(({id,role,text})=>({id,role,content:text}));
 const clock=i=>({timestamp:i,metadata:{clock:'synthetic-canonical-history-restore-ms',epochMs:0,scheduledMs:i}}),events=[{type:'RUN_STARTED',threadId:'native-chat-source-A',runId:'native-chat-source-A',...clock(0)},{type:'MESSAGES_SNAPSHOT',messages,...clock(1)},{type:'RUN_FINISHED',threadId:'native-chat-source-A',runId:'native-chat-source-A',...clock(2)}];
 const fixture={status:'source-fixture-verified',history:source.history.map(message=>({...message,status:'complete'})),digests:{sourceSha256:hash(contract.canonicalSerialize(source)),eventsSha256:hash(contract.canonicalSerialize(events)),historySha256:hash(contract.canonicalSerialize(messages))},authority:false};
 const productKeys=[...commonBuildKeys,...contractSourceKeys,...contractCompiledKeys,'apps/threadplane/src/styles.css'].sort();
 const packages=Object.entries(stock033PackageIntegrities).map(([name,integrity])=>({name,integrity,version:'0.3.3',resolutionPath:'apps/threadplane/node_modules/'+name}));
 const metadata=[...new Set([...rosterApi.stock033CoreMetadataKeys,...rosterApi.stock033MacMetadataKeys,...packages.map(p=>p.resolutionPath+'/package.json')])].sort();
 for(const key of new Set([...productKeys,...probeSourceKeys,...probeCompiledKeys,...rosterApi.nativeOwnerKeys,...rosterApi.nativeRuntimeCompiledKeys,...rosterApi.nativeRuntimeSourceKeys,...metadata]))put(key,key.endsWith('.json')?'{}':'// authored named member\n');
 put(fixtureKey,'export function compileSourceFixture(){return '+JSON.stringify(fixture)+';}');
 const actualConfig=await fs.readFile(new URL('../../apps/threadplane/angular.json',import.meta.url));put('apps/threadplane/angular.json',actualConfig);
 const metadataNames={'node_modules/typescript/package.json':['typescript','7.0.2'],'node_modules/@typescript/typescript-darwin-arm64/package.json':['@typescript/typescript-darwin-arm64','7.0.2'],'node_modules/esbuild/package.json':['esbuild','0.28.1'],'node_modules/@esbuild/darwin-arm64/package.json':['@esbuild/darwin-arm64','0.28.1'],'node_modules/playwright/package.json':['playwright','1.64.0'],'node_modules/playwright-core/package.json':['playwright-core','1.64.0']};
 const lock={packages:{}};for(const p of packages){put(p.resolutionPath+'/package.json',JSON.stringify({name:p.name,version:p.version}));lock.packages[p.resolutionPath]={version:p.version,integrity:p.integrity};}
 for(const [key,[name,version]]of Object.entries(metadataNames)){put(key,JSON.stringify({name,version,...(name==='esbuild'?{main:'authored-forward.cjs'}:{}),optionalDependencies:{'@typescript/typescript-darwin-arm64':'7.0.2','@esbuild/darwin-arm64':'0.28.1'},os:['darwin'],cpu:['arm64']}));lock.packages[key.slice(0,-13)]={name,version,integrity:'sha512-YXV0aG9yZWQ='};}
 put('node_modules/esbuild/authored-forward.cjs','// Authored compiler-private forwarding boundary, never genuine Mac origin.\nmodule.exports=require('+JSON.stringify(createRequire(import.meta.url).resolve('esbuild'))+');');
 put('node_modules/playwright-core/browsers.json',JSON.stringify({browsers:[{name:'chromium-headless-shell',revision:'1248',browserVersion:'156.0.8078.4'}]}));
 put('package.json',JSON.stringify({devDependencies:{typescript:'7.0.2',esbuild:'0.28.1',playwright:'1.64.0'}}));put('package-lock.json',JSON.stringify(lock));
 put('packages/analyzer/package.json',JSON.stringify({name:'@chat-ui-bench/analyzer',exports:{'./internal/whole-annotation':'./dist/browser-frame-whole-trace-reader.js'}}));
 const assetHashes={};for(let i=0;i<12;i++){const name='asset'+i+'.js';put('apps/threadplane/dist/'+name,'asset '+i);assetHashes[name]=hash(values.get('apps/threadplane/dist/'+name));}
 const product={packages,framework:{name:'Angular',version:'21.2.26'},production:true,sourceHashes:Object.fromEntries(productKeys.map(key=>[key,hash(values.get(key))])),copiedSourceHashes:{},assetHashes,settings:{optimization:true,sourceMaps:false}};
 // Authored build record and tiny Mac-shaped platform files; never genuine native origin.
 const probe={kind:'comparison-instrumentation-build',formatVersion:1,compiler:{name:'typescript',version:'7.0.2',resolutionPath:'node_modules/typescript',integrity:'sha512-YXV0aG9yZWQ=',nodeVersion:process.version},nativeCompiler:{name:'@typescript/typescript-darwin-arm64',version:'7.0.2',resolutionPath:'node_modules/@typescript/typescript-darwin-arm64',integrity:'sha512-YXV0aG9yZWQ=',platform:'darwin',architecture:'arm64',executablePath:'node_modules/@typescript/typescript-darwin-arm64/lib/tsc'}};
 probe.sourceHashes=Object.fromEntries(probeSourceKeys.map(key=>[key,hash(values.get(key))]));probe.compiledHashes=Object.fromEntries(probeCompiledKeys.map(key=>[key,hash(values.get(key))]));
 for(const [field,key]of [['compilerPackageMetadata','node_modules/typescript/package.json'],['nativeCompilerPackageMetadata','node_modules/@typescript/typescript-darwin-arm64/package.json']])probe[field]={byteLength:values.get(key).length,sha256:hash(values.get(key))};
 for(const selected of [probe.compiler,probe.nativeCompiler])lock.packages[selected.resolutionPath].integrity=selected.integrity;
 put('package-lock.json',JSON.stringify(lock));product.sourceHashes['package-lock.json']=hash(values.get('package-lock.json'));probe.sourceHashes['package-lock.json']=hash(values.get('package-lock.json'));
 put('apps/threadplane/.build-evidence.json',JSON.stringify(contract.adapterBuildSchema.parse(product),null,2)+'\n');put('packages/runner/.comparison-build-evidence.json',contract.canonicalSerialize(probe)+'\n');
 const fact=key=>({key,bytes:values.get(key).length,sha256:hash(values.get(key))});
 const roles={'product-source':productKeys.map(fact),'probe-source':probeSourceKeys.map(fact),'probe-compiled':probeCompiledKeys.map(fact),'fixture-input':[fact(fixtureKey)],'native-owner':rosterApi.nativeOwnerKeys.map(fact),'native-runtime':[...rosterApi.nativeRuntimeCompiledKeys,...rosterApi.nativeRuntimeSourceKeys].map(fact),metadata:metadata.map(fact),'served-asset':Object.keys(assetHashes).map(name=>fact('apps/threadplane/dist/'+name))};
 for(const [key,bytes]of values){await fs.mkdir(sourceRoot+'/'+key.slice(0,key.lastIndexOf('/')),{recursive:true});await fs.writeFile(sourceRoot+'/'+key,bytes);}
 const ledger=api.createStock033PreparationLedgerV2(),build={};for(const [name,key]of [['product','apps/threadplane/.build-evidence.json'],['probe','packages/runner/.comparison-build-evidence.json']])build[name]={key,fact:(await api.readStock033FileV2(sourceRoot+'/'+key,262144,ledger)).fact};
 const nodeStat=await fs.stat(process.execPath),nodeHash=createHash('sha256'),nodeFile=await fs.open(process.execPath,'r');try{const buffer=Buffer.alloc(65536);for(let offset=0;offset<nodeStat.size;){const n=Math.min(buffer.length,nodeStat.size-offset),result=await nodeFile.read(buffer,0,n,offset);assert.equal(result.bytesRead,n);nodeHash.update(buffer.subarray(0,n));offset+=n;}}finally{await nodeFile.close();}
 const platformRows=[{key:'platform/node',path:process.execPath,bytes:nodeStat.size,sha256:nodeHash.digest('hex'),identity:{dev:nodeStat.dev,ino:nodeStat.ino,size:nodeStat.size,mtimeMs:nodeStat.mtimeMs,ctimeMs:nodeStat.ctimeMs}}];
 for(const [i,filename]of [sourceRoot+'/'+probe.nativeCompiler.executablePath,sourceRoot+'/node_modules/@esbuild/darwin-arm64/bin/esbuild',root+'/browser',sourceRoot+'/node_modules/playwright-core/lib/coreBundle.js'].entries()){await fs.mkdir(filename.slice(0,filename.lastIndexOf('/')),{recursive:true});platformRows.push({key:['platform/typescript','platform/esbuild','platform/browser','platform/playwright-core'][i],path:filename,...await api.writeStock033FileV2(filename,Buffer.from('platform '+i),64,ledger,'external')});}
 const runtime={executablePath:platformRows[3].path,expectedExecutableBytes:platformRows[3].bytes,expectedExecutableSha256:platformRows[3].sha256,playwrightVersion:'1.64.0',browserRevision:'1248',expectedProduct:'HeadlessChrome/156.0.8078.4',expectedRevision:'@f842f52ef39fd97b449eb27cff414bf05a98ddce',launchFlags:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-automation'],headless:true};
 const sourceObservation={revision:'a'.repeat(40),dirty:false},release={schema:1,policy:'source-reviewed-stock033-preparation-inputs-v2',source:sourceObservation,build,roles,fixtureInputs:roles['fixture-input'],runtime,platformRows};
 const options={mode:'authored-real-chat-history100-stock-033-v2',sourceRoot,outputDirectory:root+'/prepared',compilationDirectory:root+'/compiled',release,sourceObservation};
 return action({root,options,values,fixture,product,probe,put,fact,async update(key,value){put(key,value);await fs.writeFile(sourceRoot+'/'+key,values.get(key));},async refresh(){for(const rows of Object.values(roles))for(const row of rows)Object.assign(row,fact(row.key));for(const item of Object.values(build))item.fact=(await api.readStock033FileV2(sourceRoot+'/'+item.key,262144,ledger)).fact;}});
});}
test('v2 prepares the exact named unique union, compiles actual input bytes and independently verifies custody',()=>authored(async({options,fixture})=>{
 const ledger=api.createStock033PreparationLedgerV2();const result=await api.prepareActualStock033V2({...options,ledger});
 assert.equal(result.template.mode,options.mode);assert.equal(result.reference.policy,'authored-preparation-reference-stock-033-v2');assert.equal(result.template.product.id,'threadplane-stock-0.3.3');assert.equal(result.authoredControl,true);assert.equal(result.template.authoredControl,true);assert.equal(result.reference.authoredControl,true);
 assert.deepEqual(await api.verifyStock033PreparationV2(options.outputDirectory,result.template,result.reference,{ledger}),result.template);
 const manifest=JSON.parse(await fs.readFile(options.outputDirectory+'/app-manifest.json'));assert.equal(manifest.records.length,new Set(Object.values(options.release.roles).flat().map(r=>r.key)).size);assert(manifest.records.length<1004);assert.equal(manifest.roster.unionCount,manifest.records.length);assert(manifest.records.every(row=>row.roles.length>0));assert.equal(ledger.pending().length,0);assert(ledger.snapshot().operations<131072);
 assert.deepEqual(JSON.parse(await fs.readFile(options.outputDirectory+'/history.json')),fixture.history);
}));
test('v2 refuses original build identity, observed source, metadata, config and runtime import drift before outputs',()=>authored(async({options,update,refresh})=>{
 const original=structuredClone(options.release.build.product.fact);options.release.build.product.fact.sha256='f'.repeat(64);await assert.rejects(api.prepareActualStock033V2(options),/stock033-v2/);options.release.build.product.fact=original;
 await assert.rejects(api.prepareActualStock033V2({...options,sourceObservation:{revision:'b'.repeat(40),dirty:false}}),/stock033-v2/);
 await update('packages/runner/dist/comparison-proto-trace.js',"import './unapproved-local.js';");await refresh();await assert.rejects(api.prepareActualStock033V2(options),/stock033-v2/);await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});await assert.rejects(fs.stat(options.compilationDirectory),{code:'ENOENT'});
}));
test('esbuild selection follows authenticated lock metadata when root has no direct esbuild dependency',()=>authored(async({options,update,refresh,product,probe,values})=>{
 const manifest=JSON.parse(values.get('package.json'));delete manifest.devDependencies.esbuild;await update('package.json',JSON.stringify(manifest));product.sourceHashes['package.json']=hash(values.get('package.json'));probe.sourceHashes['package.json']=hash(values.get('package.json'));
 await update('apps/threadplane/.build-evidence.json',JSON.stringify(contract.adapterBuildSchema.parse(product),null,2)+'\n');await update('packages/runner/.comparison-build-evidence.json',contract.canonicalSerialize(probe)+'\n');await refresh();
 const result=await api.prepareActualStock033V2(options);assert.equal(result.template.mode,options.mode);
}));
test('fixture input role is an exact fact set independent of caller row order',()=>authored(async({options,update,refresh,values,fact})=>{
 const key='tools/native-real-chat/fixture-entry.mjs';await update(key,"import './source-model.mjs';\n"+values.get(key));await refresh();options.release.roles['fixture-input']=[fact('tools/native-real-chat/source-model.mjs'),fact(key)];options.release.fixtureInputs=options.release.roles['fixture-input'];
 const result=await api.prepareActualStock033V2(options);assert.deepEqual(await api.verifyStock033PreparationV2(options.outputDirectory,result.template,result.reference),result.template);
}));
test('admitted preparation DTOs are copied before asynchronous physical observations',()=>authored(async({options})=>{
 const original=fs.lstat;let mutated=false;fs.lstat=async(...args)=>{if(!mutated){mutated=true;options.release.source.revision='b'.repeat(40);}return original(...args);};
 try{const result=await api.prepareActualStock033V2(options);assert.equal(result.template.mode,options.mode);const manifest=JSON.parse(await fs.readFile(options.outputDirectory+'/app-manifest.json'));assert.equal(manifest.custody.sourceObservation.revision,'a'.repeat(40));}finally{fs.lstat=original;}
}));
test('platform pass refuses a same-size distinct set substitution before filesystem dispatch',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2(),fact=await api.writeStock033FileV2(root+'/input',Buffer.from('x'),8,ledger),rows=[{key:'platform/a',path:root+'/input',...fact}];await api.verifyStock033PlatformsV2(rows,ledger);const before=ledger.snapshot().operations;
 await assert.rejects(api.verifyStock033PlatformsV2([{...rows[0],key:'platform/swapped'}],ledger),/stock033-v2/);assert.equal(ledger.snapshot().operations,before);
}));
test('an opened original retains one close operation when the dispatch budget is exhausted',()=>temporary(async root=>{
 await fs.writeFile(root+'/input','x');const ledger=api.createStock033PreparationLedgerV2(),original=fs.open;let actualClosed=false;
 fs.open=async(...args)=>{const file=await original(...args),close=file.close.bind(file);ledger.charge('operations',131072-ledger.snapshot().operations-1);file.close=async()=>{await close();actualClosed=true;};return file;};
 try{await assert.rejects(api.readStock033FileV2(root+'/input',8,ledger),/stock033-v2/);assert.equal(actualClosed,true);assert.equal(ledger.pending().length,0);}finally{fs.open=original;}
}));
test('short original reads charge their actual returned bytes while refusing custody',()=>temporary(async root=>{
 await fs.writeFile(root+'/input','authored');const ledger=api.createStock033PreparationLedgerV2(),original=fs.open;
 fs.open=async(...args)=>{const file=await original(...args),read=file.read.bind(file);file.read=(buffer,offset,length,position)=>read(buffer,offset,Math.min(length,1),position);return file;};
 try{await assert.rejects(api.readStock033FileV2(root+'/input',64,ledger),/short read/);assert.equal(ledger.snapshot().readBytes,1);assert.equal(ledger.pending().length,0);}finally{fs.open=original;}
}));
test('short original writes retain actual returned byte counts and refuse preparation custody',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2(),original=fs.open;fs.open=async(...args)=>{const file=await original(...args),write=file.write.bind(file);file.write=(buffer,offset,length,position)=>write(buffer,offset,Math.min(length,1),position);return file;};
 try{await assert.rejects(api.writeStock033FileV2(root+'/input',Buffer.from('authored'),64,ledger),/short write/);assert.equal(ledger.snapshot().writeBytes,1);assert.equal(ledger.totals().externalWriteBytes,1);assert.equal(ledger.pending().length,0);}finally{fs.open=original;}
}));
test('post-compiler product source enumeration refuses a newly inserted same-root source key',()=>authored(async({options,update,refresh,values})=>{
 const key='tools/native-real-chat/fixture-entry.mjs';await update(key,"import fs from 'node:fs';\n"+values.get(key).toString().replace('return ',"fs.writeFileSync("+JSON.stringify(options.sourceRoot+'/apps/threadplane/src/unapproved.css')+",'unexpected');return "));await refresh();
 await assert.rejects(api.prepareActualStock033V2(options),/stock033-v2/);await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});
}));
test('actual compiler metafile byte drift refuses before any output directory is created',()=>authored(async({options})=>{
 const original=fs.open,target=options.sourceRoot+'/tools/native-real-chat/fixture-entry.mjs';let changed=false;
 fs.open=async(filename,...args)=>{const file=await original(filename,...args);if(filename===target&&!changed){const close=file.close.bind(file);file.close=async()=>{await close();if(!changed){changed=true;await fs.appendFile(target,';');}};}return file;};
 try{await assert.rejects(api.prepareActualStock033V2(options),/fixture metafile bytes/);await assert.rejects(fs.stat(options.compilationDirectory),{code:'ENOENT'});await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});}finally{fs.open=original;}
}));
test('all retained operation and handle slots refuse their next dispatch before calling it',async()=>{
 const ledger=api.createStock033PreparationLedgerV2(),releases=Array.from({length:8},()=>ledger.handle());assert.throws(()=>ledger.handle(),/stock033-v2/);for(const release of releases)release();
 let finish;const wait=new Promise(resolve=>{finish=resolve;}),operations=Array.from({length:16},(_,i)=>ledger.operation('pending '+i,()=>wait));let dispatched=false;await assert.rejects(ledger.operation('extra',()=>{dispatched=true;}),/stock033-v2/);assert.equal(dispatched,false);assert.equal(ledger.pending().length,16);finish();await Promise.all(operations);assert.equal(ledger.pending().length,0);
});
test('bounded physical helpers refuse invalid cap and accessor facts before filesystem dispatch',()=>temporary(async root=>{
 const ledger=api.createStock033PreparationLedgerV2();for(const [i,cap]of [undefined,NaN,-1,2097153].entries())await assert.rejects(api.writeStock033FileV2(root+'/never-created'+i,Buffer.from('x'),cap,ledger),/stock033-v2/);
 let called=false;const fact={bytes:1,sha256:'a'.repeat(64),get identity(){called=true;return {};}};await assert.rejects(api.readStock033FileV2(root+'/never-created',8,ledger,fact),/stock033-v2/);assert.equal(called,false);assert.equal(ledger.snapshot().operations,0);
}));
test('metadata, authenticated lock, stock styles and actual served asset membership reject drift',()=>authored(async({options,update,refresh,values,product,probe})=>{
 async function reseal(){for(const map of [product.sourceHashes,probe.sourceHashes])for(const key of Object.keys(map))map[key]=hash(values.get(key));await update('apps/threadplane/.build-evidence.json',JSON.stringify(contract.adapterBuildSchema.parse(product),null,2)+'\n');await update('packages/runner/.comparison-build-evidence.json',contract.canonicalSerialize(probe)+'\n');await refresh();}
 for(const [key,mutate,expected]of [
  ['apps/threadplane/node_modules/@threadplane/chat/package.json',value=>{value.version='0.3.2';},/product package lock metadata/],
  ['package-lock.json',value=>{value.packages['apps/threadplane/node_modules/@threadplane/chat'].integrity='sha512-ZHJpZnQ=';},/product package lock metadata/],
  ['apps/threadplane/angular.json',value=>{value.projects.threadplane.architect.build.options.styles.push('src/native-idle-host-css-v1.css');},/stock styles/]
 ]){const before=Buffer.from(values.get(key)),changed=JSON.parse(before);mutate(changed);await update(key,JSON.stringify(changed));await reseal();await assert.rejects(api.prepareActualStock033V2(options),expected);await assert.rejects(fs.stat(options.outputDirectory),{code:'ENOENT'});await update(key,before);await reseal();}
 await fs.writeFile(options.sourceRoot+'/apps/threadplane/dist/unapproved.js','extra');await assert.rejects(api.prepareActualStock033V2(options),/physical asset membership/);
}));
test('independent verification refuses replacement of a copied archive member with the same bytes',()=>authored(async({options})=>{
 const prepared=await api.prepareActualStock033V2(options),filename=options.outputDirectory+'/inputs/tools/native-real-chat/fixture-entry.mjs',bytes=await fs.readFile(filename);await fs.writeFile(filename+'.swap',bytes);await fs.rename(filename+'.swap',filename);await assert.rejects(api.verifyStock033PreparationV2(options.outputDirectory,prepared.template,prepared.reference),/stock033-v2/);
}));
test('importing physical v2 code starts no source I/O, compiler process or browser',async()=>{
 const cp=await import('node:child_process'),originals=[];let calls=0;for(const [object,names]of [[fs,['open','readFile','mkdir','lstat','realpath','readdir']],[cp.default,['spawn','fork','exec','execFile']]])for(const key of names){originals.push([object,key,object[key]]);object[key]=()=>{calls++;throw Error('unexpected side effect');};}
 try{await import('./prepare-stock033-v2.mjs?inert-control');assert.equal(calls,0);}finally{for(const [object,key,value]of originals)object[key]=value;}
});
test('roster hashing cannot dispatch before reserving its admitted worst-case hash budget',()=>authored(async({options})=>{
 const ledger=api.createStock033PreparationLedgerV2({initial:{hashBytes:3221225472-1048576}}),original=crypto.createHash;let rosterHashes=0;
 crypto.createHash=(...args)=>{const h=original(...args),update=h.update;h.update=function(value,...rest){if(typeof value==='string'&&value.startsWith('native-stock033-roster-v2\0'))rosterHashes++;return Reflect.apply(update,this,[value,...rest]);};return h;};syncBuiltinESMExports();
 try{await assert.rejects(api.prepareActualStock033V2({...options,ledger}),/hashBytes/);assert.equal(rosterHashes,0);}finally{crypto.createHash=original;syncBuiltinESMExports();}
}));
test('exact own-data facts accept field reordering across the authenticated handoff',()=>authored(async({options})=>{
 function reorder(value){if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return value.map(reorder);return Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)]));}
 const result=await api.prepareActualStock033V2(reorder(options));assert.equal(result.template.mode,options.mode);
}));
test('production entry points refuse authored reference and branded control ledger',()=>authored(async({options})=>{
 assert.equal(typeof production.createStock033AuthoredControlV2,'function');const prepared=await api.prepareActualStock033V2(options),ledger=api.createStock033PreparationLedgerV2();await assert.rejects(production.verifyStock033PreparationV2(options.outputDirectory,prepared.template,prepared.reference),/stock033-v2/);await assert.rejects(production.prepareActualStock033V2({...options,mode:'real-chat-history100-stock-033-v2',ledger}),/stock033-v2/);assert.equal(ledger.snapshot().operations,0);
}));
test('fixture compiler resolves from the authenticated source root through an explicit authored SDK forwarder',()=>authored(async({options,values,update,root})=>{
 const key='node_modules/esbuild/authored-forward.cjs';await update(key,'require("node:fs").writeFileSync('+JSON.stringify(root+'/compiler-selected')+',"authored");\n'+values.get(key));await api.prepareActualStock033V2(options);assert.equal(await fs.readFile(root+'/compiler-selected','utf8'),'authored');
}));

async function resealAuthored(options,prepared,mutate){
 const manifest=JSON.parse(await fs.readFile(options.outputDirectory+'/app-manifest.json')),template=structuredClone(prepared.template),reference=structuredClone(prepared.reference);mutate(manifest,template);
 const ledger=api.createStock033PreparationLedgerV2();await fs.unlink(options.outputDirectory+'/app-manifest.json');reference.manifest=await api.writeStock033FileV2(options.outputDirectory+'/app-manifest.json',Buffer.from(JSON.stringify(manifest)+'\n'),1048576,ledger);template.manifest=reference.manifest;await fs.unlink(options.outputDirectory+'/template.json');reference.template=await api.writeStock033FileV2(options.outputDirectory+'/template.json',Buffer.from(JSON.stringify(template)+'\n'),4096,ledger);return{template,reference};
}
test('declared unique archive overbudget refuses preparation before any filesystem dispatch',()=>authored(async({options})=>{
 const large=new Set(rosterApi.nativeOwnerKeys.slice(0,8));for(const rows of Object.values(options.release.roles))for(const row of rows)if(large.has(row.key))row.bytes=2097152;for(const row of options.release.fixtureInputs)if(large.has(row.key))row.bytes=2097152;
 const ledger=api.createStock033PreparationLedgerV2();await assert.rejects(api.prepareActualStock033V2({...options,ledger}),/archive budget/);assert.equal(ledger.snapshot().operations,0);assert.equal(ledger.snapshot().readBytes,0);
}));
test('verifier preflights complete declared archive and owned totals before source or copy reads',()=>authored(async({options})=>{
 const prepared=await api.prepareActualStock033V2(options),resealed=await resealAuthored(options,prepared,manifest=>{for(const row of manifest.records.slice(0,8)){row.bytes=2097152;row.identity.size=2097152;row.archivedIdentity.size=2097152;}manifest.totalBytes=manifest.records.reduce((sum,row)=>sum+row.bytes,0)+manifest.owned.reduce((sum,row)=>sum+row.bytes,0);});
 const original=fs.open;let memberOpens=0;fs.open=async(filename,...args)=>{if(filename.startsWith(options.sourceRoot+'/')||filename.startsWith(options.outputDirectory+'/inputs/'))memberOpens++;return original(filename,...args);};try{await assert.rejects(api.verifyStock033PreparationV2(options.outputDirectory,resealed.template,resealed.reference),/archive budget/);assert.equal(memberOpens,0);}finally{fs.open=original;}
}));
test('verifier refuses owned total drift before any archive member read',()=>authored(async({options})=>{
 const prepared=await api.prepareActualStock033V2(options),resealed=await resealAuthored(options,prepared,manifest=>{manifest.owned.find(row=>row.key==='fixture-compiled.mjs').bytes++;manifest.owned.find(row=>row.key==='fixture-compiled.mjs').identity.size++;});const original=fs.open;let memberOpens=0;fs.open=async(filename,...args)=>{if(filename.startsWith(options.sourceRoot+'/')||filename.startsWith(options.outputDirectory+'/inputs/'))memberOpens++;return original(filename,...args);};try{await assert.rejects(api.verifyStock033PreparationV2(options.outputDirectory,resealed.template,resealed.reference),/archive total/);assert.equal(memberOpens,0);}finally{fs.open=original;}
}));
test('runtime parser copies reserve serialized capacity before any owned metafile construction',()=>authored(async({options})=>{
 const ledger=api.createStock033PreparationLedgerV2({initial:{serializedBytes:8388608-3145728+1}}),stringify=JSON.stringify;let constructions=0;JSON.stringify=function(value,...args){if(value&&typeof value==='object'&&Object.hasOwn(value,'inputs')&&Object.hasOwn(value,'outputs'))constructions++;return Reflect.apply(stringify,JSON,[value,...args]);};
 try{await assert.rejects(api.prepareActualStock033V2({...options,ledger}),/serializedBytes/);assert.equal(constructions,0);}finally{JSON.stringify=stringify;}
}));
test('fixture-output serialization reserves the ledger before JSON or Buffer constructors',()=>authored(async({options})=>{
 const ledger=api.createStock033PreparationLedgerV2(),open=fs.open,stringify=JSON.stringify,from=Buffer.from;let reads=0,json=0,copies=0;fs.open=async(filename,flags,...args)=>{const file=await open(filename,flags,...args);if(filename===options.compilationDirectory+'/fixture-compiled.mjs'&&!(flags&1)&&++reads===3){const close=file.close.bind(file);file.close=async()=>{await close();ledger.charge('serializedBytes',8388608-ledger.totals().serializedBytes);};}return file;};JSON.stringify=function(value,...args){if(value?.status==='source-fixture-verified')json++;return Reflect.apply(stringify,JSON,[value,...args]);};Buffer.from=function(value,...args){if(typeof value==='string'&&value.startsWith('{"status":"source-fixture-verified"'))copies++;return Reflect.apply(from,Buffer,[value,...args]);};
 try{await assert.rejects(api.prepareActualStock033V2({...options,ledger}),/serializedBytes/);assert.equal(reads,3);assert.equal(json,0);assert.equal(copies,0);}finally{fs.open=open;JSON.stringify=stringify;Buffer.from=from;}
}));
test('public clock and anchor injections create authored ledgers rejected by production before filesystem dispatch',()=>authored(async({options,root})=>{
 for(const [i,clock]of [{now:()=>0},{startedAt:0}].entries()){const ledger=production.createStock033PreparationLedgerV2(clock);await assert.rejects(production.prepareActualStock033V2({...options,mode:'real-chat-history100-stock-033-v2',outputDirectory:root+'/production'+i,compilationDirectory:root+'/production-compiled'+i,ledger}),/authored ledger boundary/);assert.equal(ledger.snapshot().operations,0);}
 const ledger=production.createStock033PreparationLedgerV2({initial:{readBytes:9}});await assert.rejects(production.verifyStock033PreparationV2('/private/tmp/never',{}, {},{ledger}),error=>!error.message.includes('authored ledger boundary'));assert.equal(ledger.snapshot().readBytes,9);
}));
test('resealed asset claims must exactly join authenticated product and served roster facts',()=>authored(async({options})=>{
 const prepared=await api.prepareActualStock033V2(options),base=structuredClone(prepared.template.assets);
 for(const mutate of [assets=>{assets[0].bytes++;},assets=>{assets[0].sha256='0'.repeat(64);},assets=>{assets.pop();},assets=>{assets[1]=structuredClone(assets[0]);}]){
  const resealed=await resealAuthored(options,prepared,(manifest,template)=>{const assets=structuredClone(base);mutate(assets);manifest.assets=assets;template.assets=assets;});
  await assert.rejects(api.verifyStock033PreparationV2(options.outputDirectory,resealed.template,resealed.reference),/served asset join/);
 }
}));
