import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import {probeSourceKeys,probeCompiledKeys,commonBuildKeys,contractSourceKeys,contractCompiledKeys} from '../../apps/threadplane/probe-provenance.mjs';

// Missing v2 API is an assertion failure during the initial red run.
const api=await import('./roster-stock033-v2.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const hash=value=>createHash('sha256').update(value).digest('hex');
const row=key=>({key,bytes:1,sha256:hash(key)});
const ownerNames=['README.md','fixture-entry.mjs','prepare.mjs','prepare-owner-stock033-v2.mjs','prepare-stock033-v2.mjs','roster-stock033-v2.mjs','run.mjs','source-model.mjs','worker-core.mjs','worker-io.mjs','worker-physical.mjs','worker-ports.mjs','worker.mjs'];
const runtimeNames=[
 'packages/runner/dist/comparison-proto-native-capture.js','packages/runner/dist/comparison-proto-public-ports.js','packages/runner/dist/comparison-proto-trace.js',
 ...['ordered-state','packet-fragments','protobuf-fragments','protobuf-wire','state-fragments','trace-framer','track-descriptor-fragments','track-event-fragments','whole-trace-reader','whole-trace'].map(name=>'packages/analyzer/dist/browser-frame-'+name+'.js')
].sort();
const coreMetadata=['package.json','package-lock.json','tsconfig.base.json',...['package.json','angular.json','tsconfig.json','tsconfig.app.json','.build-evidence.json'].map(name=>'apps/threadplane/'+name),...['contract','producer','analyzer','runner'].map(name=>'packages/'+name+'/package.json'),'packages/runner/.comparison-build-evidence.json'];
const macMetadata=['packages/analyzer/package.json','node_modules/typescript/package.json','node_modules/@typescript/typescript-darwin-arm64/package.json','node_modules/esbuild/package.json','node_modules/@esbuild/darwin-arm64/package.json','node_modules/playwright/package.json','node_modules/playwright-core/package.json','node_modules/playwright-core/browsers.json'];
function authored(){
 const productSourceKeys=[...new Set([...commonBuildKeys,...contractSourceKeys,...contractCompiledKeys,'apps/threadplane/src/main.ts'])].sort();
 const fixtureInputs=['tools/native-real-chat/fixture-entry.mjs','packages/contract/dist/fixture.js'].map(row);
 const product={sourceHashes:Object.fromEntries(productSourceKeys.map(key=>[key,hash(key)])),packages:[{resolutionPath:'apps/threadplane/node_modules/@threadplane/chat'}],assetHashes:Object.fromEntries(Array.from({length:12},(_,i)=>['asset'+i+'.js',hash('apps/threadplane/dist/asset'+i+'.js')]))};
 const probe={sourceHashes:Object.fromEntries(probeSourceKeys.map(key=>[key,hash(key)])),compiledHashes:Object.fromEntries(probeCompiledKeys.map(key=>[key,hash(key)]))};
 const roles={
  'product-source':productSourceKeys.map(row),'probe-source':probeSourceKeys.map(row),'probe-compiled':probeCompiledKeys.map(row),'fixture-input':fixtureInputs,
  'native-owner':ownerNames.map(name=>row('tools/native-real-chat/'+name)),
  'native-runtime':[...runtimeNames,...runtimeNames.map(key=>key.replace('/dist/','/src/').replace(/\.js$/,'.ts'))].map(row),
  metadata:[...new Set([...coreMetadata,...macMetadata,...product.packages.map(p=>p.resolutionPath+'/package.json')])].map(row),
  'served-asset':Object.keys(product.assetHashes).map(name=>row('apps/threadplane/dist/'+name))
 };
 return {roles,observedRoles:structuredClone(roles),rootAuthority:{product,probe,productSourceKeys,fixtureInputs:structuredClone(fixtureInputs),platform:'darwin',architecture:'arm64'}};
}
const assemble=input=>{assert.equal(typeof api.assembleStock033RosterV2,'function','v2 roster API must exist');return api.assembleStock033RosterV2(input);};
test('fixed native roster includes every owner, runtime descendant and corresponding TS source',()=>{
 assert.deepEqual(api.nativeOwnerKeys,ownerNames.map(name=>'tools/native-real-chat/'+name).sort());
 assert.deepEqual(api.nativeRuntimeCompiledKeys,runtimeNames);
 assert.deepEqual(api.nativeRuntimeSourceKeys,runtimeNames.map(key=>key.replace('/dist/','/src/').replace(/\.js$/,'.ts')).sort());
 assert.equal(Object.isFrozen(api.nativeOwnerKeys),true);
});
test('exact union is sorted, deduplicated and domain-bound with separate operational counts',()=>{
 const input=authored(),result=assemble(input),all=Object.values(input.roles).flat(),keys=[...new Set(all.map(r=>r.key))].sort();
 assert.deepEqual(result.rows.map(r=>r.key),keys);
 assert.equal(result.unionCount,keys.length);assert.equal(result.membershipCount,all.length);assert.equal(result.overlapCount,all.length-keys.length);
 assert.deepEqual(result.roleCounts,Object.fromEntries(Object.entries(input.roles).map(([role,rows])=>[role,rows.length])));
 assert.deepEqual(result.rows.find(r=>r.key==='package.json').roles,['metadata','probe-source','product-source']);
 const tuples=Object.entries(input.roles).sort(([a],[b])=>a<b?-1:1).flatMap(([role,rows])=>[...rows].sort((a,b)=>a.key<b.key?-1:1).map(r=>[role,r.key,r.bytes,r.sha256]));
 assert.equal(result.digest,hash('native-stock033-roster-v2\0'+JSON.stringify(tuples)));
 const reversed=structuredClone(input);for(const rows of Object.values(reversed.roles))rows.reverse();for(const rows of Object.values(reversed.observedRoles))rows.reverse();
 assert.equal(assemble(reversed).digest,result.digest);
});
test('same-count key substitutions and fact changes fail exact observed joins',()=>{
 for(const change of [r=>{r.key='apps/threadplane/src/substituted.ts';},r=>{r.sha256='f'.repeat(64);},r=>{r.bytes++;}]){
  const input=authored();change(input.observedRoles['product-source'].at(-1));assert.throws(()=>assemble(input));
 }
});
test('root roles cannot approve arbitrary product, probe, owner, metadata or asset extras',()=>{
 for(const role of ['product-source','probe-source','probe-compiled','native-owner','native-runtime','metadata','served-asset']){
  const input=authored();input.roles[role][0]=row('unapproved/same-count.mjs');input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input),role);
 }
 const input=authored();input.rootAuthority.probe.sourceHashes['unapproved/extra.ts']=hash('x');input.roles['probe-source'].push(row('unapproved/extra.ts'));input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input));
});
test('duplicate role rows, cross-role conflicting bytes/hash, unknown roles and missing fixed members fail',()=>{
 const changes=[i=>i.roles.metadata.push(i.roles.metadata[0]),i=>i.roles['fixture-input'].find(r=>r.key.endsWith('fixture.js')).bytes++,i=>{i.roles.other=[];},i=>i.roles['native-runtime'].pop(),i=>i.roles['native-owner'].pop(),i=>i.roles.metadata.pop(),i=>i.roles['served-asset'].pop()];
 for(const change of changes){const input=authored();change(input);input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input));}
});
test('historical, test, escaped, noncanonical and overlong members cannot be approved even as fixture inputs',()=>{
 for(const key of ['records/old.json','nested/records/old.json','tools/native-real-chat/control.node.mjs','a.test.ts','../outside','a//b','/absolute','a/./b','a\\b','x'.repeat(193)]){
  const input=authored();input.rootAuthority.fixtureInputs=[row(key)];input.roles['fixture-input']=[row(key)];input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input),key);
 }
});
test('fixture and trusted product inventories preserve the archive ASCII key allowlist',()=>{
 for(const key of ['apps/threadplane/src/has space.ts','apps/threadplane/src/has:colon.ts','apps/threadplane/src/é.ts'])for(const role of ['fixture-input','product-source']){
  const input=authored(),fact=row(key);
  if(role==='fixture-input'){input.rootAuthority.fixtureInputs.push(fact);input.roles[role].push(fact);}
  else{input.rootAuthority.productSourceKeys.push(key);input.rootAuthority.product.sourceHashes[key]=fact.sha256;input.roles[role].push(fact);}
  input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input),role+' '+key);
 }
});
test('fixture compiler must emit approved names and each actual input byte count',()=>{
 const input=authored(),metafile={inputs:Object.fromEntries(input.rootAuthority.fixtureInputs.map(r=>[r.key,{bytes:r.bytes,imports:[]}]))};
 assert.equal(typeof api.assertStock033FixtureInputsV2,'function');
 api.assertStock033FixtureInputsV2(input.rootAuthority.fixtureInputs,metafile);
 const swapped=structuredClone(metafile);const key=Object.keys(swapped.inputs)[0];delete swapped.inputs[key];swapped.inputs['unapproved/input.js']={bytes:1};assert.throws(()=>api.assertStock033FixtureInputsV2(input.rootAuthority.fixtureInputs,swapped));
 metafile.inputs[key].bytes++;assert.throws(()=>api.assertStock033FixtureInputsV2(input.rootAuthority.fixtureInputs,metafile));
});
test('runtime imports must belong to approved union; probe compiled alone cannot substitute runtime descendants',()=>{
 assert.equal(typeof api.assertStock033RuntimeImportsV2,'function');const roster=assemble(authored());
 api.assertStock033RuntimeImportsV2(runtimeNames,roster);
 assert.throws(()=>api.assertStock033RuntimeImportsV2([...runtimeNames,'packages/analyzer/dist/unexpected-local-import.js'],roster));
 const input=authored();input.roles['native-runtime']=probeCompiledKeys.map(row);input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input));
});
test('owned-data admission rejects proxies, accessors and sparse arrays without invoking them',()=>{
 for(const change of [i=>{i.roles=new Proxy(i.roles,{ownKeys(){throw Error('trap invoked');}});},i=>Object.defineProperty(i.roles,'metadata',{get(){throw Error('getter invoked');}}),i=>{delete i.roles.metadata[0];}]){
  const input=authored();change(input);assert.throws(()=>assemble(input),error=>!/(trap|getter) invoked/.test(error.message));
 }
});
test('before-retention role/reference/key/member bounds and archive caps remain unchanged',()=>{
 const input=authored();input.roles.metadata=Array(1025).fill(row('package.json'));assert.throws(()=>assemble(input));
 const oversized=authored();oversized.roles['native-owner'][0].bytes=2097153;assert.throws(()=>assemble(oversized));
 assert.equal(typeof api.assertStock033ArchiveBudgetV2,'function');
 api.assertStock033ArchiveBudgetV2({archiveBytes:16777216-262144-1048576,manifestBytes:1048576});
 for(const value of [{archiveBytes:16777216-262144-1048576+1,manifestBytes:1048576},{archiveBytes:1,manifestBytes:1048577},{archiveBytes:Number.MAX_SAFE_INTEGER,manifestBytes:1}])assert.throws(()=>api.assertStock033ArchiveBudgetV2(value));
 const platform=authored();platform.roles.metadata.push(row('node_modules/playwright-core/lib/coreBundle.js'));platform.observedRoles=structuredClone(platform.roles);assert.throws(()=>assemble(platform));
});
test('unique archive ceiling accepts its boundary and refuses the next actual named key',()=>{
 const input=authored(),initial=assemble(input).unionCount;
 for(let i=initial;i<1024;i++){
  const fact=row('apps/threadplane/src/approved-'+i+'.ts');input.roles['product-source'].push(fact);input.rootAuthority.productSourceKeys.push(fact.key);input.rootAuthority.product.sourceHashes[fact.key]=fact.sha256;
 }
 input.observedRoles=structuredClone(input.roles);assert.equal(assemble(input).unionCount,1024);
 const fact=row('apps/threadplane/src/approved-over-limit.ts');input.roles['product-source'].push(fact);input.rootAuthority.productSourceKeys.push(fact.key);input.rootAuthority.product.sourceHashes[fact.key]=fact.sha256;input.observedRoles=structuredClone(input.roles);
 assert.throws(()=>assemble(input),/unique archive bound/);
});
test('copied byte budget uses deduplicated bytes and excludes oversized platform binaries',()=>{
 const input=authored(),fact=input.roles['native-owner'].find(r=>r.key.endsWith('/worker.mjs'));fact.bytes=2097152;input.observedRoles=structuredClone(input.roles);
 const result=assemble(input);assert.equal(result.archiveBytes,result.unionCount-1+2097152);
 fact.bytes++;input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input),/row fact/);
 const full=authored();for(const r of full.roles['native-owner'].filter(r=>!r.key.endsWith('/fixture-entry.mjs')).slice(0,8))r.bytes=2097152;
 full.observedRoles=structuredClone(full.roles);assert.throws(()=>assemble(full),/archive budget/);
});
test('wrong platform, forged fixture approval, conflicting shared hashes and build map drift fail',()=>{
 for(const change of [i=>{i.rootAuthority.platform='linux';},i=>{i.rootAuthority.architecture='x64';},i=>{i.rootAuthority.fixtureInputs[0].bytes++;},i=>{i.rootAuthority.product.sourceHashes['package.json']='f'.repeat(64);},i=>{i.roles['fixture-input'][1].sha256='a'.repeat(64);i.rootAuthority.fixtureInputs[1].sha256='a'.repeat(64);}]){
  const input=authored();change(input);input.observedRoles=structuredClone(input.roles);assert.throws(()=>assemble(input));
 }
});
test('import remains inert for filesystem and child-process APIs',async()=>{
 const originals=[];let calls=0;
 for(const [target,names]of [[fs,['open','readFile','writeFile','mkdir','readdir','stat','lstat','realpath']],[cp,['spawn','fork','exec','execFile']]])for(const name of names){originals.push([target,name,target[name]]);target[name]=()=>{calls++;throw Error('import side effect');};}
 try{const imported=await import('./roster-stock033-v2.mjs?inert-control');assert.equal(typeof imported.assembleStock033RosterV2,'function');assert.equal(calls,0);}finally{for(const [target,name,original]of originals)target[name]=original;}
});
test('preflight refuses aggregate string bytes before whole DTO serialization',()=>{
 const metafile={inputs:{},one:'x'.repeat(400000),two:'y'.repeat(400000),three:'z'.repeat(400000)},original=JSON.stringify;let serialized=false;
 JSON.stringify=function(value,...args){if(value===metafile){serialized=true;throw Error('whole DTO serialization');}return Reflect.apply(original,JSON,[value,...args]);};
 try{assert.throws(()=>api.assertStock033FixtureInputsV2([],metafile),/encoded byte bound/);assert.equal(serialized,false);}finally{JSON.stringify=original;}
});
test('plain-object length is traversed and refuses nested hooks, proxies and cycles',()=>{
 for(const make of [
  ()=>new Proxy({},{ownKeys(){throw Error('proxy trap invoked');}}),
  ()=>Object.defineProperty({},'hidden',{enumerable:true,get(){throw Error('getter invoked');}}),
  ()=>{const value={};value.self=value;return value;}
 ])assert.throws(()=>api.assertStock033FixtureInputsV2([],{inputs:{},length:make()}),error=>/^stock033-v2 roster:/.test(error.message));
});
test('exact encoded-byte admission allows the 1MiB ASCII boundary and counts escaped UTF8 correctly',()=>{
 for(const nested of [null,{length:['\u0000\b\t\n\f\r"\\','é水😀','\ud800','\udc00',-0,1e-7,1e21,true,false,null]},String.fromCharCode(...Array.from({length:65536},(_,i)=>i))]){
  const metafile={inputs:{},length:nested,padding:''},overhead=Buffer.byteLength(JSON.stringify(metafile));
  metafile.padding='a'.repeat(1048576-overhead);assert.equal(Buffer.byteLength(JSON.stringify(metafile)),1048576);api.assertStock033FixtureInputsV2([],metafile);
  metafile.padding+='a';assert.throws(()=>api.assertStock033FixtureInputsV2([],metafile),/encoded byte bound/);
 }
});
