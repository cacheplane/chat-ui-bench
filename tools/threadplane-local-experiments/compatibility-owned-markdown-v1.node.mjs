import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as fixed from '../threadplane-local-owned-markdown/fixed-experiment-v1.mjs';
import * as selector from '../threadplane-local-owned-markdown/select-v1.mjs';
import * as build from '../competitor-comparison/threadplane-local-owned-markdown-build-v1.mjs';
import * as coordinator from '../competitor-comparison/aimock-local-owned-markdown-v1.mjs';

// Captured from actual owned-v1 pure helpers at qualified bef4f2b before v2 code. These models
// contain no real source/build receipts and grant no runtime authority. Do not
// regenerate the golden to accommodate a change to legacy behavior.
const golden=JSON.parse(await readFile(new URL('./compatibility-owned-markdown-v1.golden.json',import.meta.url),'utf8'));
const clone=value=>structuredClone(value);
const byteFact=bytes=>({bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
const input={
  rootManifestBytes:await readFile(new URL('../../package.json',import.meta.url)),
  appManifestBytes:await readFile(new URL('../../apps/threadplane/package.json',import.meta.url)),
  stockLockBytes:await readFile(new URL('../../package-lock.json',import.meta.url)),
};
const unavailable={message:'local-owned-markdown-identity-unavailable'};

test('legacy named modules retain their exact public export sets',()=>{
  for(const [name,api] of Object.entries({fixed,selector,build,coordinator})){
    assert.deepEqual(Object.keys(api).sort(),golden.exports[name],name);
  }
});

test('legacy roster retains all 24 complete slot values, order and frozen membership',()=>{
  const actual=fixed.localOwnedMarkdownRosterV1();
  assert.deepEqual(actual,golden.roster);
  assert.ok(Object.isFrozen(actual));
  for(let ordinal=0;ordinal<24;ordinal++){
    assert.equal(fixed.localOwnedMarkdownSlotV1(ordinal),actual[ordinal]);
    assert.ok(Object.isFrozen(actual[ordinal]));
    assert.ok(Object.isFrozen(actual[ordinal].selection));
  }
  assert.throws(()=>fixed.localOwnedMarkdownRosterV1(undefined),{message:'local-owned-markdown-arguments'});
  for(const args of [[],[-1],[24],[0,undefined],['0'],[NaN]]){
    assert.throws(()=>fixed.localOwnedMarkdownSlotV1(...args),{message:'local-owned-markdown-ordinal'});
  }
});

test('legacy pure selection retains exact byte hashes, output schema, six artifacts and five local runtime URLs',()=>{
  const selection=clone(golden.selectionModel);
  const actual=selector.deriveLocalOwnedMarkdownSelectionV1(input,selection);
  const {appManifestBytes,selectedLockBytes,artifacts,...metadata}=actual;
  const {appManifestBytes:expectedApp,selectedLockBytes:expectedLock,...expectedMetadata}=golden.selection;
  assert.deepEqual(metadata,expectedMetadata);
  assert.deepEqual(byteFact(appManifestBytes),expectedApp);
  assert.deepEqual(byteFact(selectedLockBytes),expectedLock);
  assert.deepEqual(artifacts,golden.selectionModel.artifacts);
  const lock=JSON.parse(selectedLockBytes);
  const local=Object.entries(lock.packages).filter(([,row])=>row.resolved?.startsWith('file:local-packages/local-owned-markdown/'));
  assert.deepEqual(local.map(([key])=>key).sort(),fixed.LOCAL_OWNED_MARKDOWN_RUNTIME_NAMES_V1.map(name=>'apps/threadplane/node_modules/'+name).sort());
  assert.equal(artifacts.length,6);
});

test('legacy preparation/execution join retains the exact v2 receipt bytes and returned build',()=>{
  const facts=clone(golden.facts),execution=clone(golden.execution);
  assert.deepEqual(build.assertLocalOwnedMarkdownExecutionFactsV1(facts,execution,facts.build),golden.joinedBuild);
  assert.equal(build.assertLocalOwnedMarkdownExecutionFactsV1(facts,execution,facts.build),facts.build);
  for(const key of Object.keys(execution)){
    const changed={...execution,[key]:key==='buildRecordBytes'?11:'b'.repeat(64)};
    assert.throws(()=>build.assertLocalOwnedMarkdownExecutionFactsV1(facts,changed,facts.build),{message:'local-owned-markdown-build-identity'},key);
  }
  const changed=clone(facts);changed.schema='threadplane-local-owned-markdown-preparation-facts-v1';
  assert.throws(()=>build.assertLocalOwnedMarkdownExecutionFactsV1(changed,execution,changed.build),{message:'local-owned-markdown-build-identity'});
});

test('legacy admission accepts the frozen native/fixture/trace envelope and refuses authority/schema swaps',()=>{
  assert.equal(coordinator.admitLocalOwnedMarkdownCaseV1(clone(golden.admission)),true);
  for(const mutate of [
    value=>{delete value.result.localOwnedMarkdown;},
    value=>{value.result.localSharedSignals=value.result.localOwnedMarkdown;delete value.result.localOwnedMarkdown;},
    value=>{value.identity.role='candidate';},
    value=>{value.result.localOwnedMarkdown.guard={};},
    value=>{value.result.localOwnedMarkdown.sourceFlavor='local-source-built-shared-signals-v1';},
    value=>{value.result.publicationUnavailable=true;},
    value=>{value.result.unsafeOutstanding=true;},
    value=>{value.traceValid=false;},
    value=>{value.fixture.sourceDeltaSha256=null;},
    value=>{value.root='/private/tmp/untrusted';},
  ]){
    const value=clone(golden.admission);mutate(value);
    assert.equal(coordinator.admitLocalOwnedMarkdownCaseV1(value),false);
  }
});

for(const [name,inputKey,outputKey] of [['benefit','rows','benefit'],['eligible HOLD','holdRows','hold'],['ineligible HOLD',null,'ineligible']]){
  test('legacy '+name+' retains the complete report, flags, failures, pairs and ranges',()=>{
    const rows=inputKey?clone(golden[inputKey]):[];
    assert.deepEqual(coordinator.decideLocalOwnedMarkdownBenefitV1(rows),golden[outputKey]);
  });
}

function hostileInputs(){
  let effects=0;
  const fail=()=>{effects++;throw Error('caller effect');};
  const proxy=new Proxy([],{get:fail,ownKeys:fail,getOwnPropertyDescriptor:fail,getPrototypeOf:fail});
  const getter={};
  for(const key of ['role','root','module','loader','callback','guard','length','policy'])Object.defineProperty(getter,key,{get:fail,enumerable:true});
  return{proxy,getter,fail,effects:()=>effects};
}

test('legacy NULL fixed accessors reject exact readiness before proxy/getter or extra authority arguments',()=>{
  const traps=hostileInputs();
  for(const name of ['assertLocalOwnedMarkdownSelectionsReadyV1','assertLocalOwnedMarkdownExecutionsReadyV1','localOwnedMarkdownSelectionIdentityV1','localOwnedMarkdownExecutionIdentityV1','localOwnedMarkdownRoleRootV1']){
    for(const args of [[],[traps.proxy],[traps.getter],[traps.proxy,traps.getter,traps.fail]])assert.throws(()=>fixed[name](...args),unavailable,name);
  }
  assert.equal(traps.effects(),0);
});

test('legacy NULL selector/build/coordinator routes reject before inspecting any supplied arguments or ports',async()=>{
  const traps=hostileInputs();
  const routes=[selector.selectLocalOwnedMarkdownDependenciesV1,build.readLocalOwnedMarkdownPreparationFactsV1,build.createLocalOwnedMarkdownBuildGuardV1,coordinator.runAimockLocalOwnedMarkdownInvocationV1];
  const argsSets=[[],[traps.proxy],[traps.getter],[undefined],[[],traps.getter,traps.fail],[['--role','control','--root','/private/tmp/untrusted','--expected-checkout','a'.repeat(40),'--module','untrusted'],traps.getter]];
  for(const route of routes)for(const args of argsSets)await assert.rejects(route(...args),unavailable,route.name);
  assert.equal(traps.effects(),0);
});

test('legacy pure admission and decision refuse proxy/getter models without executing caller code',()=>{
  const traps=hostileInputs();
  for(const value of [traps.proxy,traps.getter]){
    assert.equal(coordinator.admitLocalOwnedMarkdownCaseV1(value),false);
    assert.deepEqual(coordinator.decideLocalOwnedMarkdownBenefitV1(value),{...golden.ineligible,failures:['local-owned-markdown-own-data']});
  }
  assert.equal(traps.effects(),0);
});

test('legacy pure selection refuses selection proxies and role getters with exact errors before caller code',()=>{
  const traps=hostileInputs();
  assert.throws(()=>selector.deriveLocalOwnedMarkdownSelectionV1(input,traps.proxy),{message:'local-owned-markdown-selection-passive-selection'});
  const selection=clone(golden.selectionModel);
  Object.defineProperty(selection,'role',{get:traps.fail});
  assert.throws(()=>selector.deriveLocalOwnedMarkdownSelectionV1(input,selection),{message:'local-owned-markdown-selection-passive-role'});
  assert.equal(traps.effects(),0);
});

test('legacy canonical input model refuses getter/proxy and extra root/module/callback fields exactly',()=>{
  const traps=hostileInputs(),selection=clone(golden.selectionModel);
  assert.throws(()=>selector.deriveLocalOwnedMarkdownSelectionV1(traps.proxy,selection),{message:'local-owned-markdown-selection-passive-input'});
  const getter={...input};Object.defineProperty(getter,'stockLockBytes',{get:traps.fail});
  for(const value of [getter,...['root','module','callback','policy','loader'].map(key=>({...input,[key]:traps.fail}))]){
    assert.throws(()=>selector.deriveLocalOwnedMarkdownSelectionV1(value,selection),{message:'local-owned-markdown-selection-passive-input-fields'});
  }
  assert.equal(traps.effects(),0);
});

test('legacy successful pure model operations leave the production policy inactive',async()=>{
  selector.deriveLocalOwnedMarkdownSelectionV1(input,clone(golden.selectionModel));
  build.assertLocalOwnedMarkdownExecutionFactsV1(golden.facts,golden.execution,golden.facts.build);
  assert.equal(coordinator.admitLocalOwnedMarkdownCaseV1(clone(golden.admission)),true);
  assert.deepEqual(coordinator.decideLocalOwnedMarkdownBenefitV1(clone(golden.rows)),golden.benefit);
  assert.equal(fixed.LOCAL_OWNED_MARKDOWN_CANDIDATE_SOURCE_V1,null);
  assert.deepEqual(fixed.LOCAL_OWNED_MARKDOWN_FIXED_EXPERIMENT_V1.roles,{control:null,candidate:null});
  await assert.rejects(coordinator.runAimockLocalOwnedMarkdownInvocationV1([]),unavailable);
  await assert.rejects(selector.selectLocalOwnedMarkdownDependenciesV1([]),unavailable);
  await assert.rejects(build.createLocalOwnedMarkdownBuildGuardV1('control'),unavailable);
});

test('owned-v1 frozen actual function names and argument counts remain identical',()=>{for(const [family,api]of Object.entries({fixed,selector,build,coordinator}))for(const [name,fact]of Object.entries(golden.functionMetadata[family]))assert.deepEqual({name:api[name].name,length:api[name].length},fact,family+':'+name);});
