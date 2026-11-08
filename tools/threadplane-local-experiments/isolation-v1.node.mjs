import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as registry from './closed-policies-v1.mjs';
import * as selection from './selection-engine-v1.mjs';
import * as build from './build-engine-v1.mjs';
import * as coordinator from './coordinator-engine-v1.mjs';
import * as native from '../competitor-comparison/matrix-case-stock037-trace-v3.mjs';
import * as stores from '../competitor-comparison/matrix-artifacts-trace-v3.mjs';
import * as oldFixed from '../threadplane-local-shared-signals/fixed-experiment-v1.mjs';
const fn=(api,name)=>{assert.equal(typeof api[name],'function','API absence only: existing module namespace lacks '+name);return api[name];};
const ownedPolicy=()=>{assert.ok(registry.OWNED_MARKDOWN_POLICY_V1,'API absence only: source-authored owned descriptor is absent');return registry.OWNED_MARKDOWN_POLICY_V1;};
async function ownedFixed(){fn(selection,'deriveOwnedMarkdownSelectionV1');return import('../threadplane-local-owned-markdown/fixed-experiment-v1.mjs');}
const commonPaths=['closed-policies-v1.mjs','selection-engine-v1.mjs','build-engine-v1.mjs','coordinator-engine-v1.mjs'].map(n=>'tools/threadplane-local-experiments/'+n);
const ownedPaths=['tools/threadplane-local-owned-markdown/fixed-experiment-v1.mjs','tools/threadplane-local-owned-markdown/select-v1.mjs','tools/threadplane-stock037/select-v1.mjs','tools/competitor-comparison/threadplane-local-owned-markdown-build-v1.mjs','tools/competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs',...commonPaths];
const trap=counter=>new Proxy(Object.create(null),{get(){counter.calls++;throw Error('caller get');},ownKeys(){counter.calls++;throw Error('caller ownKeys');},getPrototypeOf(){counter.calls++;throw Error('caller prototype');}});
test('closed existing namespaces add only source-authored named owned routes',()=>{
 for(const [api,names]of [[selection,['deriveOwnedMarkdownSelectionV1','selectOwnedMarkdownV1']],[build,['inspectOwnedMarkdownTarV1','waitOwnedMarkdownOriginalV1','readOwnedMarkdownPreparationFactsV1','createOwnedMarkdownBuildGuardV1','assertOwnedMarkdownExecutionFactsV1','assertOwnedMarkdownToolingBookendsV1']],[coordinator,['admitOwnedMarkdownCaseV1','decideOwnedMarkdownBenefitV1','runOwnedMarkdownInvocationV1']],[native,['runLocalOwnedMarkdownCaseV1']],[stores,['createLocalOwnedMarkdown24StoreV1']]])for(const name of names)fn(api,name);
 assert.deepEqual(Object.keys(registry).sort(),['OWNED_MARKDOWN_POLICY_V1','OWNED_MARKDOWN_POLICY_V2','SHARED_SIGNALS_POLICY_V1']);
 assert.deepEqual(Object.keys(selection).sort(),['deriveSharedSignalsSelectionV1','selectSharedSignalsV1','deriveOwnedMarkdownSelectionV1','selectOwnedMarkdownV1','deriveOwnedMarkdownSelectionV2','selectOwnedMarkdownV2'].sort());
 assert.deepEqual(Object.keys(build).sort(),['inspectSharedSignalsTarV1','waitSharedSignalsOriginalV1','readSharedSignalsPreparationFactsV1','createSharedSignalsBuildGuardV1','assertSharedSignalsExecutionFactsV1','assertSharedSignalsToolingBookendsV1','inspectOwnedMarkdownTarV1','waitOwnedMarkdownOriginalV1','readOwnedMarkdownPreparationFactsV1','createOwnedMarkdownBuildGuardV1','assertOwnedMarkdownExecutionFactsV1','assertOwnedMarkdownToolingBookendsV1','inspectOwnedMarkdownTarV2','waitOwnedMarkdownOriginalV2','readOwnedMarkdownPreparationFactsV2','createOwnedMarkdownBuildGuardV2','assertOwnedMarkdownExecutionFactsV2','assertOwnedMarkdownToolingBookendsV2'].sort());
 assert.deepEqual(Object.keys(coordinator).sort(),['admitSharedSignalsCaseV1','decideSharedSignalsBenefitV1','runSharedSignalsInvocationV1','admitOwnedMarkdownCaseV1','decideOwnedMarkdownBenefitV1','runOwnedMarkdownInvocationV1','admitOwnedMarkdownCaseV2','decideOwnedMarkdownBenefitV2','runOwnedMarkdownInvocationV2'].sort());
 for(const api of [selection,build,coordinator,registry,native,stores])for(const key of Object.keys(api))assert.doesNotMatch(key,/^(register|resolve|createPolicy|create.*Engine|bindings|.*Handle|configure)/);
});
test('inactive owned capability cannot disable old module import or alter its live NULL authority',async()=>{
 assert.equal(typeof selection.deriveSharedSignalsSelectionV1,'function');
 assert.throws(()=>oldFixed.assertLocalSharedSignalsExecutionsReadyV1(),{message:'local-shared-signals-identity-unavailable'});
 let calls=0;const input=new Proxy({},{get(){calls++;throw Error('caller');}});
 await assert.rejects(selection.selectSharedSignalsV1(input,input),{message:'local-shared-signals-identity-unavailable'});assert.equal(calls,0);
});
test('owned descriptor is frozen passive data with exact independent roots, schemas, labels and nine tooling keys',()=>{
 const p=ownedPolicy();assert.equal(p.id,'local-owned-markdown-v1');assert.equal(p.prefix,'local-owned-markdown');assert.equal(p.envelopeKey,'localOwnedMarkdown');assert.equal(p.diagnosticKey,'localOwnedMarkdownDiagnostic');assert.equal(p.sourceFlavor,'local-source-built-owned-markdown-v1');assert.equal(p.label,'local-source-built-owned-markdown-037');
 assert.deepEqual(p.roots,{control:'/private/tmp/chat-ui-bench-owned-markdown-control-native-20261108-invocation01',candidate:'/private/tmp/chat-ui-bench-owned-markdown-candidate-native-20261108-invocation01'});
 assert.equal(p.decisionPath,'/private/tmp/THREADPLANE-OWNED-MARKDOWN-PROSPECTIVE-DECISION-V1-20261108.json');assert.equal(p.decisionSha256,'fda4958afce1597ec1e3e0e1387335456cdc34bf126eec595ebdb36750987b63');
 assert.equal(p.packageDirectory,'local-packages/local-owned-markdown');assert.deepEqual(p.toolingKeys,ownedPaths);assert.ok(p.toolingKeys.length<=16);
 assert.equal(p.schemas.envelope,'threadplane-local-owned-markdown-case-v1');assert.equal(p.schemas.preparation,'threadplane-local-owned-markdown-preparation-facts-v2');
 for(const item of [p,p.roots,p.schemas,p.toolingKeys])assert.ok(Object.isFrozen(item));
 assert.notDeepEqual(p.roots,registry.SHARED_SIGNALS_POLICY_V1.roots);
});
for(const [api,name]of [[selection,'selectOwnedMarkdownV1'],[build,'readOwnedMarkdownPreparationFactsV1'],[build,'createOwnedMarkdownBuildGuardV1'],[coordinator,'runOwnedMarkdownInvocationV1'],[native,'runLocalOwnedMarkdownCaseV1']])test('NULL precedes forged handles, ports, getters and argument inspection: '+name,async()=>{
 const route=fn(api,name),count={calls:0},hostile=trap(count);
 const data=ownedPolicy();
 for(const input of [data,structuredClone(data),Object.freeze({}),hostile,{policy:data,root:hostile,loader:hostile,guard:hostile,verifier:hostile,workflow:hostile,env:hostile}])for(const args of [[input],[input,hostile],[input,hostile,hostile]])await assert.rejects(route(...args),{message:'local-owned-markdown-identity-unavailable'});
 assert.equal(count.calls,0);
});
test('named wrapper aliases preserve the exact common function object and public argument path',async()=>{
 const pairs=[['../threadplane-local-owned-markdown/select-v1.mjs',selection,{deriveLocalOwnedMarkdownSelectionV1:'deriveOwnedMarkdownSelectionV1',selectLocalOwnedMarkdownDependenciesV1:'selectOwnedMarkdownV1'}],['../competitor-comparison/threadplane-local-owned-markdown-build-v1.mjs',build,{inspectLocalOwnedMarkdownTarV1:'inspectOwnedMarkdownTarV1',waitLocalOwnedMarkdownOriginalV1:'waitOwnedMarkdownOriginalV1',readLocalOwnedMarkdownPreparationFactsV1:'readOwnedMarkdownPreparationFactsV1',createLocalOwnedMarkdownBuildGuardV1:'createOwnedMarkdownBuildGuardV1',assertLocalOwnedMarkdownExecutionFactsV1:'assertOwnedMarkdownExecutionFactsV1',assertLocalOwnedMarkdownToolingBookendsV1:'assertOwnedMarkdownToolingBookendsV1'}],['../competitor-comparison/aimock-local-owned-markdown-v1.mjs',coordinator,{admitLocalOwnedMarkdownCaseV1:'admitOwnedMarkdownCaseV1',decideLocalOwnedMarkdownBenefitV1:'decideOwnedMarkdownBenefitV1',runAimockLocalOwnedMarkdownInvocationV1:'runOwnedMarkdownInvocationV1'}]];
 for(const [file,engine,names]of pairs){for(const name of Object.values(names))fn(engine,name);const wrapper=await import(file);assert.deepEqual(Object.keys(wrapper).sort(),Object.keys(names).sort());for(const [alias,name]of Object.entries(names))assert.equal(wrapper[alias],engine[name]);}
});
test('fixed module independently binds exact prospective SHA, control and NULL candidate/roles; roster digest matches declared schedule',async()=>{
 const m=await ownedFixed();assert.equal(m.LOCAL_OWNED_MARKDOWN_CONTROL_SOURCE_V1,'331b3b2d4cfc1e9b8e44c94ec867103a4693db2c');assert.equal(m.LOCAL_OWNED_MARKDOWN_CANDIDATE_SOURCE_V1,null);assert.equal(m.LOCAL_OWNED_MARKDOWN_DECISION_SHA256_V1,'fda4958afce1597ec1e3e0e1387335456cdc34bf126eec595ebdb36750987b63');assert.deepEqual(m.LOCAL_OWNED_MARKDOWN_FIXED_EXPERIMENT_V1.roles,{control:null,candidate:null});
 const roster=m.localOwnedMarkdownRosterV1();assert.equal(createHash('sha256').update(JSON.stringify(roster)).digest('hex'),'e34937aca0f08488be91a7da0ac1d5dba7f7f1de43812f2c70e4ebac474d3851');assert.ok(roster.every(s=>s.stock===false));assert.equal(new Set(roster.map(s=>s.id)).size,24);
 for(const s of roster)assert.equal(s.id.includes('-local-shared-signals-'),false);
});
test('pure fixed schema never accepts old policy digest/control/schema or cross-policy activation source',async()=>{
 const m=await ownedFixed(),record=m.LOCAL_OWNED_MARKDOWN_FIXED_EXPERIMENT_V1;
 for(const delta of [{schema:oldFixed.LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.schema},{experimentId:'local-shared-signals-v1'},{decisionSha256:oldFixed.LOCAL_SHARED_SIGNALS_DECISION_SHA256_V1},{controlSourceCommit:oldFixed.LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1}])assert.throws(()=>m.validateLocalOwnedMarkdownExperimentRecordV1({...record,...delta}),/local-owned-markdown-record/);
 assert.throws(()=>oldFixed.validateLocalSharedSignalsExperimentRecordV1(record),/local-shared-signals-record/);
 const old=await readFile(new URL('../threadplane-local-shared-signals/fixed-experiment-v1.mjs',import.meta.url),'utf8'),owned=await readFile(new URL('../threadplane-local-owned-markdown/fixed-experiment-v1.mjs',import.meta.url),'utf8');
 assert.throws(()=>m.assertLocalOwnedMarkdownActivationSourceV1(old,owned),/activation-source/);assert.throws(()=>oldFixed.assertLocalSharedSignalsActivationSourceV1(owned,old),/activation-source/);
});
test('private factories refuse unknown cloned Proxy and getter handles without touching them',async()=>{
 ownedPolicy();
 for(const [file,name]of [['selection-engine-v1.mjs','createSelectionEngine'],['build-engine-v1.mjs','createBuildEngine'],['coordinator-engine-v1.mjs','createCoordinatorEngine']]){
  const source=await readFile(new URL(file,import.meta.url),'utf8'),start=source.indexOf('function '+name+'(handle){'),end=source.indexOf('\nconst sharedSignals=',start);assert.ok(start>=0&&end>start);
  // VM scripts lack module metadata; preserve the actual source module URL as inert data.
  const factory=source.slice(start,end).replaceAll('import.meta.url',JSON.stringify(new URL(file,import.meta.url).href));
  const make=vm.runInNewContext('(function(bindings){'+factory+';return '+name+';})',{})(new WeakMap());
  const count={calls:0};for(const forged of [ownedPolicy(),structuredClone(ownedPolicy()),Object.freeze({}),trap(count)])assert.throws(()=>make(forged),/closed-local-policy/);assert.equal(count.calls,0);
 }
});
