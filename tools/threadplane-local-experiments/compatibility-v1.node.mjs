import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as fixed from '../threadplane-local-shared-signals/fixed-experiment-v1.mjs';
import * as selector from '../threadplane-local-shared-signals/select-v1.mjs';
import * as build from '../competitor-comparison/threadplane-local-shared-signals-build-v1.mjs';
import * as coordinator from '../competitor-comparison/aimock-local-shared-signals-v1.mjs';

// Captured from the actual pre-extraction pure helpers at ac9c05e. These models
// contain no real source/build receipts and grant no runtime authority. Do not
// regenerate the golden to accommodate a change to legacy behavior.
const golden=JSON.parse(await readFile(new URL('./compatibility-v1.golden.json',import.meta.url),'utf8'));
const clone=value=>structuredClone(value);
const byteFact=bytes=>({bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});
const input={
  rootManifestBytes:await readFile(new URL('../../package.json',import.meta.url)),
  appManifestBytes:await readFile(new URL('../../apps/threadplane/package.json',import.meta.url)),
  stockLockBytes:await readFile(new URL('../../package-lock.json',import.meta.url)),
};
const unavailable={message:'local-shared-signals-identity-unavailable'};

test('legacy named modules retain their exact public export sets',()=>{
  for(const [name,api] of Object.entries({fixed,selector,build,coordinator})){
    assert.deepEqual(Object.keys(api).sort(),golden.exports[name],name);
  }
});

test('legacy roster retains all 24 complete slot values, order and frozen membership',()=>{
  const actual=fixed.localSharedSignalsRosterV1();
  assert.deepEqual(actual,golden.roster);
  assert.ok(Object.isFrozen(actual));
  for(let ordinal=0;ordinal<24;ordinal++){
    assert.equal(fixed.localSharedSignalsSlotV1(ordinal),actual[ordinal]);
    assert.ok(Object.isFrozen(actual[ordinal]));
    assert.ok(Object.isFrozen(actual[ordinal].selection));
  }
  assert.throws(()=>fixed.localSharedSignalsRosterV1(undefined),{message:'local-shared-signals-arguments'});
  for(const args of [[],[-1],[24],[0,undefined],['0'],[NaN]]){
    assert.throws(()=>fixed.localSharedSignalsSlotV1(...args),{message:'local-shared-signals-ordinal'});
  }
});

test('legacy pure selection retains exact byte hashes, output schema, six artifacts and five local runtime URLs',()=>{
  const selection=clone(golden.selectionModel);
  const actual=selector.deriveLocalSharedSignalsSelectionV1(input,selection);
  const {appManifestBytes,selectedLockBytes,artifacts,...metadata}=actual;
  const {appManifestBytes:expectedApp,selectedLockBytes:expectedLock,...expectedMetadata}=golden.selection;
  assert.deepEqual(metadata,expectedMetadata);
  assert.deepEqual(byteFact(appManifestBytes),expectedApp);
  assert.deepEqual(byteFact(selectedLockBytes),expectedLock);
  assert.deepEqual(artifacts,golden.selectionModel.artifacts);
  const lock=JSON.parse(selectedLockBytes);
  const local=Object.entries(lock.packages).filter(([,row])=>row.resolved?.startsWith('file:local-packages/local-shared-signals/'));
  assert.deepEqual(local.map(([key])=>key).sort(),fixed.LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1.map(name=>'apps/threadplane/node_modules/'+name).sort());
  assert.equal(artifacts.length,6);
});

test('legacy preparation/execution join retains the exact v2 receipt bytes and returned build',()=>{
  const facts=clone(golden.facts),execution=clone(golden.execution);
  assert.deepEqual(build.assertLocalSharedSignalsExecutionFactsV1(facts,execution,facts.build),golden.joinedBuild);
  assert.equal(build.assertLocalSharedSignalsExecutionFactsV1(facts,execution,facts.build),facts.build);
  for(const key of Object.keys(execution)){
    const changed={...execution,[key]:key==='buildRecordBytes'?11:'b'.repeat(64)};
    assert.throws(()=>build.assertLocalSharedSignalsExecutionFactsV1(facts,changed,facts.build),{message:'local-shared-signals-build-identity'},key);
  }
  const changed=clone(facts);changed.schema='threadplane-local-shared-signals-preparation-facts-v1';
  assert.throws(()=>build.assertLocalSharedSignalsExecutionFactsV1(changed,execution,changed.build),{message:'local-shared-signals-build-identity'});
});

test('legacy admission accepts the frozen native/fixture/trace envelope and refuses authority/schema swaps',()=>{
  assert.equal(coordinator.admitLocalSharedSignalsCaseV1(clone(golden.admission)),true);
  for(const mutate of [
    value=>{delete value.result.localSharedSignals;},
    value=>{value.result.localOwnedMarkdown=value.result.localSharedSignals;delete value.result.localSharedSignals;},
    value=>{value.identity.role='candidate';},
    value=>{value.result.localSharedSignals.guard={};},
    value=>{value.result.localSharedSignals.sourceFlavor='local-source-built-owned-markdown-v1';},
    value=>{value.result.publicationUnavailable=true;},
    value=>{value.result.unsafeOutstanding=true;},
    value=>{value.traceValid=false;},
    value=>{value.fixture.sourceDeltaSha256=null;},
    value=>{value.root='/private/tmp/untrusted';},
  ]){
    const value=clone(golden.admission);mutate(value);
    assert.equal(coordinator.admitLocalSharedSignalsCaseV1(value),false);
  }
});

for(const [name,inputKey,outputKey] of [['benefit','rows','benefit'],['eligible HOLD','holdRows','hold'],['ineligible HOLD',null,'ineligible']]){
  test('legacy '+name+' retains the complete report, flags, failures, pairs and ranges',()=>{
    const rows=inputKey?clone(golden[inputKey]):[];
    assert.deepEqual(coordinator.decideLocalSharedSignalsBenefitV1(rows),golden[outputKey]);
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
  for(const name of ['assertLocalSharedSignalsSelectionsReadyV1','assertLocalSharedSignalsExecutionsReadyV1','localSharedSignalsSelectionIdentityV1','localSharedSignalsExecutionIdentityV1','localSharedSignalsRoleRootV1']){
    for(const args of [[],[traps.proxy],[traps.getter],[traps.proxy,traps.getter,traps.fail]])assert.throws(()=>fixed[name](...args),unavailable,name);
  }
  assert.equal(traps.effects(),0);
});

test('legacy NULL selector/build/coordinator routes reject before inspecting any supplied arguments or ports',async()=>{
  const traps=hostileInputs();
  const routes=[selector.selectLocalSharedSignalsDependenciesV1,build.readLocalSharedSignalsPreparationFactsV1,build.createLocalSharedSignalsBuildGuardV1,coordinator.runAimockLocalSharedSignalsInvocationV1];
  const argsSets=[[],[traps.proxy],[traps.getter],[undefined],[[],traps.getter,traps.fail],[['--role','control','--root','/private/tmp/untrusted','--expected-checkout','a'.repeat(40),'--module','untrusted'],traps.getter]];
  for(const route of routes)for(const args of argsSets)await assert.rejects(route(...args),unavailable,route.name);
  assert.equal(traps.effects(),0);
});

test('legacy pure admission and decision refuse proxy/getter models without executing caller code',()=>{
  const traps=hostileInputs();
  for(const value of [traps.proxy,traps.getter]){
    assert.equal(coordinator.admitLocalSharedSignalsCaseV1(value),false);
    assert.deepEqual(coordinator.decideLocalSharedSignalsBenefitV1(value),{...golden.ineligible,failures:['local-shared-signals-own-data']});
  }
  assert.equal(traps.effects(),0);
});

test('legacy pure selection refuses selection proxies and role getters with exact errors before caller code',()=>{
  const traps=hostileInputs();
  assert.throws(()=>selector.deriveLocalSharedSignalsSelectionV1(input,traps.proxy),{message:'local-shared-signals-selection-passive-selection'});
  const selection=clone(golden.selectionModel);
  Object.defineProperty(selection,'role',{get:traps.fail});
  assert.throws(()=>selector.deriveLocalSharedSignalsSelectionV1(input,selection),{message:'local-shared-signals-selection-passive-role'});
  assert.equal(traps.effects(),0);
});

test('legacy canonical input model refuses getter/proxy and extra root/module/callback fields exactly',()=>{
  const traps=hostileInputs(),selection=clone(golden.selectionModel);
  assert.throws(()=>selector.deriveLocalSharedSignalsSelectionV1(traps.proxy,selection),{message:'local-shared-signals-selection-passive-input'});
  const getter={...input};Object.defineProperty(getter,'stockLockBytes',{get:traps.fail});
  for(const value of [getter,...['root','module','callback','policy','loader'].map(key=>({...input,[key]:traps.fail}))]){
    assert.throws(()=>selector.deriveLocalSharedSignalsSelectionV1(value,selection),{message:'local-shared-signals-selection-passive-input-fields'});
  }
  assert.equal(traps.effects(),0);
});

test('legacy successful pure model operations leave the production policy inactive',async()=>{
  selector.deriveLocalSharedSignalsSelectionV1(input,clone(golden.selectionModel));
  build.assertLocalSharedSignalsExecutionFactsV1(golden.facts,golden.execution,golden.facts.build);
  assert.equal(coordinator.admitLocalSharedSignalsCaseV1(clone(golden.admission)),true);
  assert.deepEqual(coordinator.decideLocalSharedSignalsBenefitV1(clone(golden.rows)),golden.benefit);
  assert.equal(fixed.LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1,null);
  assert.deepEqual(fixed.LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles,{control:null,candidate:null});
  await assert.rejects(coordinator.runAimockLocalSharedSignalsInvocationV1([]),unavailable);
  await assert.rejects(selector.selectLocalSharedSignalsDependenciesV1([]),unavailable);
  await assert.rejects(build.createLocalSharedSignalsBuildGuardV1('control'),unavailable);
});
