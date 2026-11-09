import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import*as fixed from'./fixed-experiment-v1.mjs';import{POSTFIX_DIAGNOSTIC_POLICY_V1}from'../threadplane-local-experiments/closed-policies-v1.mjs';import{input,selection,registry,sha}from'./model.node-fixture.mjs';import{deriveLocalOwnedMarkdownSelectionV2}from'../threadplane-local-owned-markdown/select-v2.mjs';
const u=new URL('./select-v1.mjs',import.meta.url),m=fs.existsSync(u)?await import(u.href):{};
// Never substitute a test-only declaration/factory. Matching derivation must
// use the actual exported pure API and real public policy pins.
function requirePublishedBinding(){
 for(const [key,length]of[['LOCAL_POSTFIX_SOURCE_COMMIT_V1',40],['LOCAL_POSTFIX_SOURCE_TREE_V1',40],['LOCAL_POSTFIX_DECLARATION_SHA256_V1',64]]){assert.equal(typeof fixed[key],'string');assert.match(fixed[key],new RegExp('^[a-f0-9]{'+length+'}$'));}
 assert.equal(POSTFIX_DIAGNOSTIC_POLICY_V1.decisionSha256,fixed.LOCAL_POSTFIX_DECLARATION_SHA256_V1);
}
const differentHex=value=>(value[0]==='0'?'1':'0')+value.slice(1);
test('actual new selector NIL refuses args proxy before writes',async()=>{assert.equal(typeof m.selectLocalPostfixDependenciesV1,'function','API absence');let touched=0;await assert.rejects(m.selectLocalPostfixDependenciesV1(new Proxy([],{get(){touched++;throw Error('args');}})),/identity-unavailable/);assert.equal(touched,0);});
test('actual exported pure derivation accepts bound6tar5runtime model and exact stock037 lock delta',()=>{
 assert.equal(typeof m.deriveLocalPostfixSelectionV1,'function','API absence');requirePublishedBinding();
 const s=selection();assert.equal(s.sourceCommit,fixed.LOCAL_POSTFIX_SOURCE_COMMIT_V1);assert.equal(s.sourceTree,fixed.LOCAL_POSTFIX_SOURCE_TREE_V1);
 const r=m.deriveLocalPostfixSelectionV1(input,s);assert.equal(r.role,'candidate');assert.equal(r.artifacts.length,6);assert.deepEqual(r.artifacts.map(a=>a.name),fixed.LOCAL_POSTFIX_PACKAGE_NAMES_V1);assert.equal(s.runtimePackageNames.length,5);assert.equal(r.publishedStockEvidence,false);
 const expected=JSON.parse(registry.selectedLockBytes),changed=[];
 for(const a of s.artifacts.filter(a=>s.runtimePackageNames.includes(a.name))){const key='apps/threadplane/node_modules/'+a.name,row=expected.packages[key];row.resolved='file:'+a.relativeTarballPath;row.integrity=a.integrity;changed.push(key);}
 assert.equal(changed.length,5);assert.deepEqual(JSON.parse(r.selectedLockBytes),expected);assert.equal(r.appManifestBytes,registry.appManifestBytes);assert.deepEqual(r.selectedSourceHashes,{...registry.selectedSourceHashes,'package-lock.json':sha(r.selectedLockBytes)});
 const actual=JSON.parse(r.selectedLockBytes),stock=JSON.parse(registry.selectedLockBytes);assert.deepEqual(Object.keys(actual.packages).filter(key=>JSON.stringify(actual.packages[key])!==JSON.stringify(stock.packages[key])),changed);assert.deepEqual(actual.packages['apps/threadplane/node_modules/@threadplane/ag-ui'],stock.packages['apps/threadplane/node_modules/@threadplane/ag-ui']);
});
for(const[name,change]of Object.entries({control:s=>s.role='control',oldschema:s=>s.schema='threadplane-local-owned-markdown-selection-identity-v2',source:s=>s.sourceCommit=differentHex(s.sourceCommit),tree:s=>s.sourceTree=differentHex(s.sourceTree),declaration:s=>s.declarationSha256=differentHex(fixed.LOCAL_POSTFIX_DECLARATION_SHA256_V1),tarRole:s=>s.artifacts[0].relativeTarballPath=s.artifacts[0].relativeTarballPath.replace('/candidate/','/control/'),peer:s=>s.artifacts[0].manifest.peerDependencies={unrelated:'*'},hash:s=>s.artifacts[0].sourceRef.sha256='0'.repeat(64)}))test('actual exported pure derivation refuses '+name+' after a matching bound model succeeds',()=>{
 assert.equal(typeof m.deriveLocalPostfixSelectionV1,'function');requirePublishedBinding();m.deriveLocalPostfixSelectionV1(input,selection());const s=selection();change(s);assert.throws(()=>m.deriveLocalPostfixSelectionV1(input,s));
});
test('new model never routes through old paired validator or activates a copied model',async()=>{assert.equal(typeof m.deriveLocalPostfixSelectionV1,'function');assert.throws(()=>deriveLocalOwnedMarkdownSelectionV2(input,selection()),/local-owned-markdown-v2/);await assert.rejects(m.selectLocalPostfixDependenciesV1(['--role','candidate','--root','/private/tmp/MUST-NOT-CREATE','--expected-checkout','a'.repeat(40)]),/identity-unavailable/);});
test('actual exported pure candidate source descriptor rejects getter before caller effects',()=>{let touched=0;for(const key of['sourceCommit','sourceTree']){const s=selection();Object.defineProperty(s,key,{enumerable:true,get(){touched++;throw Error('source getter');}});assert.throws(()=>m.deriveLocalPostfixSelectionV1(input,s));}assert.equal(touched,0);});
