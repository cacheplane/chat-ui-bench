import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import {MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
const source=await readFile(new URL('./matrix-case-stock037-trace-v3.mjs',import.meta.url),'utf8');
const seam=name=>{const begin=' // TRACE-V3-BEGIN '+name+'\n',end=' // TRACE-V3-END '+name+'\n',a=source.indexOf(begin),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);assert.equal(source.indexOf(begin,a+begin.length),-1);return source.slice(a+begin.length,b);};
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const specRoster=()=>Array.from({length:3},(_,round)=>Array.from({length:4},(_,stratum)=>((round+stratum)%2?['candidate','control']:['control','candidate']).map(role=>({id:`threadplane-h${stratum<2?1000:10000}-r6400-${stratum%2?'history-reading':'follow'}-local-owned-markdown-v2-${role}-round-${round+1}`,selection:{profile:'threadplane',historyCount:stratum<2?1000:10000,responseBytes:6400,journey:stratum%2?'history-reading':'follow'}})))).flat(2);
function nativePrelude(){
 const a=source.indexOf('async function runMatrixCaseOriginal('),b=source.indexOf(' // TRACE-V3-END create\n',a);assert.ok(a>=0&&b>a);
 let actual=source.slice(a,b+' // TRACE-V3-END create\n'.length);
 const imports="await wait(Promise.all([",end="]),STAGES.transcript,'matrix-modules')",i=actual.indexOf(imports),j=actual.indexOf(end,i);assert.ok(i>0&&j>i);
 // Replace only the actual dynamic module-read expression inside this authored
 // closure. Native fixture creation, reservation and CREATE statements are intact.
 actual=actual.slice(0,i)+'modules'+actual.slice(j+end.length);
 assert.doesNotMatch(actual,/\bimport\(/);return actual;
}
function authoredPorts(events){
 const fixture={createMatrixCase:selection=>{events.push('pure-fixture-create');return{selection};}};
 const modules=[fixture,{}, {}, {}, {}, {}, {}];
 const store={beginCase:async id=>{events.push('case-reservation');return{writeJSON:async(name,value)=>{events.push('fixture-write');return{path:id+'/'+name,sha256:'a'.repeat(64)};}};}};
 const parameters={modules,store,events,MATRIX_V5_ACQUISITION,performance:{now:()=>1},createMatrixDeadline:()=>({check(){},wait:async value=>value,remaining:()=>240000}),createMatrixDiagnostics:()=>({record:{}}),STAGES:{transcript:10000,progress:10000},stock037PublishedIdentityV1:()=>{events.push('stock-identity');}};
 return parameters;
}
function ordinaryCreateBoundary(){
 const writeStart=source.indexOf("  deadline.check();fixture=await wait(artifacts.writeJSON('fixture-private.json'"),writeEnd=source.indexOf('\n  beforeFacts=',writeStart);assert.ok(writeStart>0&&writeEnd>writeStart);
 const actual=nativePrelude()+source.slice(writeStart,writeEnd)+'\nreturn {written:true};\n}';
 return vm.runInThisContext('(function(p){const {modules,events,MATRIX_V5_ACQUISITION,performance,createMatrixDeadline,createMatrixDiagnostics,STAGES,stock037PublishedIdentityV1}=p,STOCK037_CPU_TOKEN=Symbol("authoredCPU");'+actual+';return runMatrixCaseOriginal;})');
}
test('ordinary stock actual native CREATE/fixture boundary is live for a stock ID',async()=>{
 const events=[],ports=authoredPorts(events),run=ordinaryCreateBoundary()(ports);
 assert.deepEqual(await run({slot:{id:'ordinary-stock-control',selection:{profile:'threadplane',historyCount:1000,responseBytes:6400,journey:'follow'}},store:ports.store,out:'/authored/no-fs',invocationStarted:0}),{written:true});
 assert.deepEqual(events,['pure-fixture-create','case-reservation','stock-identity','fixture-write']);
});
for(const slot of specRoster())test('actual ordinary CREATE refuses v2 ID before first real fixture-write statement: '+slot.id,async()=>{
 const events=[],ports=authoredPorts(events),run=ordinaryCreateBoundary()(ports);
 await assert.rejects(run({slot,store:ports.store,out:'/authored/no-fs',invocationStarted:0}),/local-owned-markdown-v2-ordinary-entry/);
 assert.deepEqual(events,['pure-fixture-create','case-reservation'],'pure fixture creation/reservation precede CREATE; no stock guard, fixture write or later trace work');
});
test('ordinary boundary still refuses legacy shared and owned-v1 IDs before fixture writes',async()=>{
 for(const family of ['local-shared-signals-v1','local-owned-markdown-v1'])for(const role of ['control','candidate']){
  const events=[],ports=authoredPorts(events),run=ordinaryCreateBoundary()(ports),slot={id:'threadplane-h1000-r6400-follow-'+family+'-'+role+'-round-1',selection:{profile:'threadplane',historyCount:1000,responseBytes:6400,journey:'follow'}};
  await assert.rejects(run({slot,store:ports.store,out:'/authored/no-fs',invocationStarted:0}),/ordinary-entry/);assert.deepEqual(events,['pure-fixture-create','case-reservation']);
 }
});
test('v2 native NIL gate rejects before caller getter or extra authority fields',async()=>{
 const api=await import('./matrix-case-stock037-trace-v3.mjs');assert.equal(typeof api.runLocalOwnedMarkdownCaseV2,'function','API absence only: v2 named native gate is not implemented');let effects=0;
 const trap=new Proxy({},{get(){effects++;throw Error('caller get');},getPrototypeOf(){effects++;throw Error('caller prototype');},ownKeys(){effects++;throw Error('caller keys');}});
 await assert.rejects(api.runLocalOwnedMarkdownCaseV2(trap),/local-owned-markdown-v2-identity-unavailable/);assert.equal(effects,0);
});
async function activeThreePolicyRealm(includeV2=true){
 const api=await import('./matrix-case-stock037-trace-v3.mjs');if(includeV2)assert.equal(typeof api.runLocalOwnedMarkdownCaseV2,'function','API absence only: matching/cross-policy behavior requires v2 native entry');
 const catalog=await import('../threadplane-local-experiments/closed-policies-v1.mjs');if(includeV2)assert.ok(catalog.OWNED_MARKDOWN_POLICY_V2,'API absence only: v2 closed descriptor');
 const plans=[['shared','SharedSignals','shared-signals',1,catalog.SHARED_SIGNALS_POLICY_V1],['owned1','OwnedMarkdown','owned-markdown',1,catalog.OWNED_MARKDOWN_POLICY_V1],...(includeV2?[['owned2','OwnedMarkdown','owned-markdown',2,catalog.OWNED_MARKDOWN_POLICY_V2]]:[])];
 const events=[],ports=authoredPorts(events),build=Object.freeze({genuine:'authored-source-only-build',assetHashes:{}}),slots={},policies={},imports=new Map(),captured=[];
 for(const[kind,casing,directory,version,policy]of plans){
  policies[kind]=policy;const suffix='V'+version,fp='../threadplane-local-'+directory+'/fixed-experiment-v'+version+'.mjs',bp='./threadplane-local-'+directory+'-build-v'+version+'.mjs';
  const actual=await import(fp),actualBuild=await import(bp);slots[kind]=actual['local'+casing+'Roster'+suffix]();
  imports.set(fp,{...actual,['assertLocal'+casing+'ExecutionsReady'+suffix](){events.push(['ready',kind]);},['local'+casing+'Slot'+suffix](ordinal){assert.ok(Number.isInteger(ordinal)&&ordinal>=0&&ordinal<24);return slots[kind][ordinal];},['local'+casing+'RoleRoot'+suffix](role){return policy.roots[role];}});
  imports.set(bp,{...actualBuild,['createLocal'+casing+'BuildGuard'+suffix]:async role=>{events.push(['guard-create',kind,role]);return Object.freeze({identity:Object.freeze({experimentId:policy.id,role,stock:false}),verify:async value=>{events.push(['guard-verify',kind]);assert.equal(value,build);return value;}});},['waitLocal'+casing+'Original'+suffix]:async original=>original});
 }
 const common={'./matrix-run-v5.mjs':{createMatrixDeadline:ports.createMatrixDeadline},'./matrix-diagnostics-v1.mjs':{createMatrixDiagnostics:ports.createMatrixDiagnostics},'../../apps/threadplane/provenance.mjs':{threadplaneBuildEvidence:async()=>{events.push('build-read');return build;}},'./aimock-stock037-v1.mjs':{stock037PublishedIdentityV1:ports.stock037PublishedIdentityV1,assertStock037BuildV1:()=>{events.push('stock-build');throw Error('stock cannot authorize local');}},'./aimock-trace-capture-v3.mjs':{createAimockTraceCaptureV3:options=>{events.push('capture');return{setup:async()=>events.push('capture-setup'),assertBeforeStart:()=>events.push('capture-ready')};}},'node:perf_hooks':{performance:ports.performance}};
 const prefixEnd=source.indexOf('\nasync function installMatrixThreadplaneBridge(');assert.ok(prefixEnd>0);let prefix=source.slice(0,prefixEnd);const bindings={};
 for(const match of prefix.matchAll(/^import (.+?) from '([^']+)';$/gm)){
  const[,declaration,specifier]=match,ns=imports.get(specifier)??{...await import(specifier),...common[specifier]};
  if(declaration.startsWith('{'))for(const item of declaration.slice(1,-1).split(',')){const[exported,local=exported]=item.trim().split(/\s+as\s+/);assert.ok(Object.hasOwn(ns,exported),'actual import resolves '+specifier+' '+exported);bindings[local]=ns[exported];}
  else if(declaration.startsWith('* as '))bindings[declaration.slice(5)]=ns;else bindings[declaration]=ns.default;
 }
 prefix=prefix.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');assert.equal(prefix.match(/^const ROOT=.*;$/gm)?.length,1);prefix=prefix.replace(/^const ROOT=.*;$/m,'let ROOT=initialRoot;');
 // Exact native prelude/CREATE plus SETUP live in the SAME closure as the real
 // entry prefix/private WeakMaps. Browser/server gap is authored; no real IO.
 const original=nativePrelude()+`server=probeServer;browser={};page={};const context={};\n${seam('setup')}\ncaptured.push({input:arguments[0],token:arguments[1]});return{cpuMode,traceIdentity,ordinal:localContext.ordinal};\n}`;
 const parameters={...bindings,Buffer,modules:ports.modules,events,captured,initialRoot:policies.shared.roots.control,probeServer:{get origin(){events.push('server-origin');return'http://127.0.0.1:1234';}}};
 const program='(function('+Object.keys(parameters).join(',')+'){'+prefix+'\nconst STOCK037_CPU_TOKEN=Symbol("authored CPU");\n'+original+'\nreturn{original:runMatrixCaseOriginal,entries:{shared:runLocalSharedSignalsCaseV1,owned1:runLocalOwnedMarkdownCaseV1,owned2:'+(includeV2?'runLocalOwnedMarkdownCaseV2':'undefined')+'},setRoot(value){ROOT=value;}};})';
 const realm=vm.runInThisContext(program)(...Object.values(parameters));
 return{events,slots,async probe(slot,token){return realm.original({slot,store:ports.store,out:'/authored/no-fs',invocationStarted:0},token);},async issue(kind,ordinal=0){
  const slot=slots[kind][ordinal];realm.setRoot(policies[kind].roots[slot.role]);const callerInput={ordinal,store:ports.store,out:'/authored/no-fs',invocationStarted:0},before=captured.length;
  const result=await realm.entries[kind](callerInput);assert.equal(captured.length,before+1);const issued=captured.at(-1);assert.equal(issued.input.slot,slot);assert.ok(issued.token&&typeof issued.token==='object');return{...issued,callerInput,slot,ordinal,result};
 }};
}
async function refused(realm,slot,token){const before=realm.events.length;await assert.rejects(realm.probe(slot,token),/local-(?:shared-signals|owned-markdown(?:-v2)?)-/);assert.equal(realm.events.slice(before).some(e=>Array.isArray(e)?e[0]==='guard-verify':['capture','capture-setup','server-origin','fixture-write'].includes(e)),false,'no foreign verifier, server/capture or fixture write; pure fixture/reservation may occur');}
for(const kind of ['shared','owned1','owned2'])test('actual '+kind+' entry/original closure issues matching token only after its guard',async()=>{const r=await activeThreePolicyRealm(),issued=await r.issue(kind);assert.equal(issued.result.cpuMode,false);assert.equal(issued.result.ordinal,0);assert.equal(issued.result.traceIdentity.id,issued.slot.id);assert.equal(issued.result.traceIdentity.stockVersion,'0.3.7');assert.deepEqual(r.events.filter(e=>Array.isArray(e)&&e[0]==='guard-verify'),[['guard-verify',kind],['guard-verify',kind]]);assert.ok(r.events.findIndex(e=>Array.isArray(e)&&e[0]==='guard-verify')<r.events.indexOf('pure-fixture-create'));assert.equal(r.events.filter(e=>e==='capture').length,1);});
for(const from of ['shared','owned1','owned2'])for(const to of ['shared','owned1','owned2'].filter(v=>v!==from))test('genuine '+from+' token refuses '+to+' slot with memberships retained',async()=>{const r=await activeThreePolicyRealm(),a=await r.issue(from),b=await r.issue(to);await refused(r,b.slot,a.token);assert.equal((await r.probe(a.slot,a.token)).ordinal,0);assert.equal((await r.probe(b.slot,b.token)).ordinal,0);});
for(const kind of ['shared','owned1','owned2'])test(kind+' token fixes exact slot and original ordinal despite caller mutation',async()=>{const r=await activeThreePolicyRealm(),a=await r.issue(kind),b=await r.issue(kind,3);a.callerInput.ordinal=3;await refused(r,b.slot,a.token);await refused(r,{...a.slot},a.token);assert.equal((await r.probe(a.slot,a.token)).ordinal,0);assert.equal((await r.probe(b.slot,b.token)).ordinal,3);});
for(const kind of ['shared','owned1','owned2'])test(kind+' genuine token refuses another module realm using identical source roster objects',async()=>{const a=await activeThreePolicyRealm(),b=await activeThreePolicyRealm(),x=await a.issue(kind),y=await b.issue(kind);assert.equal(x.slot,y.slot);await refused(b,y.slot,x.token);assert.equal((await a.probe(x.slot,x.token)).ordinal,0);assert.equal((await b.probe(y.slot,y.token)).ordinal,0);});
for(const kind of ['shared','owned1','owned2'])test(kind+' clone/forged/getter/Proxy token executes no caller or foreign guard code',async()=>{const r=await activeThreePolicyRealm(),a=await r.issue(kind);let effects=0;const foreign=()=>{effects++;throw Error('foreign verifier');},fake={slot:a.slot,ordinal:0,policyHandle:{},guard:{verify:foreign}},getter={};for(const k of ['slot','ordinal','policyHandle','guard'])Object.defineProperty(getter,k,{get(){effects++;throw Error('getter');}});const proxy=new Proxy(fake,{get(){effects++;throw Error('Proxy');},getPrototypeOf(){effects++;throw Error('Proxy prototype');},ownKeys(){effects++;throw Error('Proxy keys');}});for(const token of [undefined,null,{},structuredClone(a.token),{...a.token},fake,getter,proxy])await refused(r,a.slot,token);assert.equal(effects,0);assert.equal((await r.probe(a.slot,a.token)).ordinal,0);});

for(const kind of ['shared','owned1'])test('current production legacy '+kind+' matching original/prelude harness is live before any v2 implementation',async()=>{const r=await activeThreePolicyRealm(false),a=await r.issue(kind);assert.equal(a.result.ordinal,0);assert.equal(a.result.cpuMode,false);assert.equal(a.result.traceIdentity.id,a.slot.id);assert.equal((await r.probe(a.slot,a.token)).ordinal,0);});
test('current production two-policy cross-token original/prelude harness refuses while both matching paths remain live',async()=>{const r=await activeThreePolicyRealm(false),a=await r.issue('shared'),b=await r.issue('owned1');await refused(r,b.slot,a.token);await refused(r,a.slot,b.token);assert.equal((await r.probe(a.slot,a.token)).ordinal,0);assert.equal((await r.probe(b.slot,b.token)).ordinal,0);});
