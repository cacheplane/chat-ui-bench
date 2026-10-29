import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './prepare-stock033-v2.mjs';
import * as roster from './roster-stock033-v2.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {authoredRequestTree} from './request-window-preparation.test-helper.mjs';
test('request-window preparation exports remain separate from legacy and authored admission',async()=>{
 for(const key of ['prepareActualStock033RequestWindowV1','verifyStock033RequestWindowPreparationV1','inspectStock033RequestWindowPreparationV1','createStock033RequestWindowAuthoredControlV1'])assert.equal(typeof api[key],'function',key);
 const authored=api.createStock033RequestWindowAuthoredControlV1('native-history100-v1');
 const ledger=authored.createStock033PreparationLedgerV2();
 for(const options of [{}, {mode:'real-chat-history100-stock-033-v2'}, {mode:'authored-real-chat-stock033-request-window-scroll-v1',inputRecipe:'foreign',fixtureProfile:'native-history100-v1'}])await assert.rejects(authored.prepareActualStock033RequestWindowV1({...options,ledger}));
 assert.equal(ledger.snapshot().operations,0);
 assert.throws(()=>api.inspectStock033RequestWindowPreparationV1({}));
 assert.throws(()=>api.createStock033RequestWindowAuthoredControlV1('foreign'));
 assert.ok(Object.isFrozen(roster.requestWindowNativeOwnerKeys));
 assert.ok(roster.requestWindowNativeOwnerKeys.includes('tools/native-real-chat/request-window-worker.mjs'));
 assert.ok(!roster.nativeOwnerKeys.includes('tools/native-real-chat/request-window-worker.mjs'));
});
for(const profile of ['native-history100-v1','native-history1000-v1','native-history10000-v1'])test(`authored ${profile} complete preparation, original chunk custody and private admission`,()=>authoredRequestTree(profile,async({options})=>{
 const control=api.createStock033RequestWindowAuthoredControlV1(profile),result=await control.prepareActualStock033RequestWindowV1(options);
 assert.ok(Buffer.byteLength(JSON.stringify(result.template)+'\n')<=4096);
 const owned=await control.verifyStock033RequestWindowPreparationV1(options.outputDirectory,result.template,result.reference),custody=control.inspectStock033RequestWindowPreparationV1(owned);
 assert.equal(custody.fixtureProfile,profile);assert.equal(custody.inputRecipe,'native-stock033-request-window-scroll-v1');
 assert.throws(()=>api.inspectStock033RequestWindowPreparationV1(owned));assert.throws(()=>control.inspectStock033RequestWindowPreparationV1(structuredClone(owned)));
 const manifest=JSON.parse(await fs.readFile(options.outputDirectory+'/app-manifest.json'));
 assert.ok(manifest.records.length+manifest.owned.length<=1024);
 assert.equal(result.template.fixture.profile,profile);
 if(profile!=='native-history100-v1'){
  const history=JSON.parse(await fs.readFile(options.outputDirectory+'/history-manifest.json'));
  assert.equal(history.chunks.length,profile==='native-history1000-v1'?10:100);
  for(const row of history.chunks)assert.ok(row.bytes<=65536);
  const first=history.chunks[0],filename=options.outputDirectory+'/'+first.name,b=await fs.readFile(filename);await fs.writeFile(filename+'.replacement',b);await fs.rename(filename+'.replacement',filename);
  await assert.rejects(control.verifyStock033RequestWindowPreparationV1(options.outputDirectory,result.template,result.reference));
 }
}));
test('retained fixture, unique file and archive budgets refuse before any fixture output construction',()=>{
 const control=api.createStock033RequestWindowAuthoredControlV1('native-history10000-v1');
 for(const [row,initial] of [[{unionCount:923,archiveBytes:0},{}],[{unionCount:1,archiveBytes:16777216},{}],[{unionCount:1,archiveBytes:0},{serializedBytes:8388608}]]){
  const ledger=control.createStock033PreparationLedgerV2({initial});assert.throws(()=>control.reserveFixture(row,1,ledger));assert.equal(ledger.snapshot().operations,0);
 }
});
test('fixed canonical 10000 serialization reserves exact retained chunk bytes within unchanged aggregate cap',()=>{
 const control=api.createStock033RequestWindowAuthoredControlV1('native-history10000-v1'),ledger=control.createStock033PreparationLedgerV2({initial:{serializedBytes:1876934}});
 assert.equal(control.reserveFixture({unionCount:1,archiveBytes:0},938467,ledger),5803990);
 assert.equal(ledger.totals().serializedBytes,7680924);
});
test('canonical events and history digests refuse jointly resealed authored manifests and template claims',()=>authoredRequestTree('native-history1000-v1',async({options})=>{
 const control=api.createStock033RequestWindowAuthoredControlV1('native-history1000-v1'),prepared=await control.prepareActualStock033RequestWindowV1(options),root=options.outputDirectory;
 const baseManifest=JSON.parse(await fs.readFile(root+'/app-manifest.json')),baseHistory=JSON.parse(await fs.readFile(root+'/history-manifest.json'));
 async function overwrite(name,value,cap){await fs.writeFile(root+'/'+name,JSON.stringify(value)+'\n');return(await api.readStock033FileV2(root+'/'+name,cap,control.createStock033PreparationLedgerV2())).fact;}
 for(const [digest,evidence]of [['eventsSha256','events'],['historySha256','history']]){
  const manifest=structuredClone(baseManifest),history=structuredClone(baseHistory),template=structuredClone(prepared.template),reference=structuredClone(prepared.reference);
  history.source.digests[digest]='0'.repeat(64);manifest.fixture[evidence]='0'.repeat(64);template.fixture[evidence]='0'.repeat(64);
  const fact=await overwrite('history-manifest.json',history,65536),row=manifest.owned.find(row=>row.key==='history-manifest.json');manifest.totalBytes+=fact.bytes-row.bytes;Object.assign(row,fact);template.history.manifest=fact;
  const manifestFact=await overwrite('app-manifest.json',manifest,1048576);reference.manifest=manifestFact;template.manifest=manifestFact;reference.template=await overwrite('template.json',template,4096);
  await assert.rejects(control.verifyStock033RequestWindowPreparationV1(root,template,reference),/canonical AIMock digests/);
 }
}));
test('10000 preparation fits retained counter with genuine two-module baseline and exact inert metadata serialization',()=>authoredRequestTree('native-history10000-v1',async({options})=>{
 const control=api.createStock033RequestWindowAuthoredControlV1('native-history10000-v1');options.ledger=control.createStock033PreparationLedgerV2({initial:{serializedBytes:1876934}});
 const prepared=await control.prepareActualStock033RequestWindowV1(options);assert.ok(options.ledger.totals().serializedBytes<=8388608);assert.equal(prepared.template.fixture.profile,'native-history10000-v1');
}));
test('new runtime import audit validates intrinsic module bounds and metadata before retaining only metadata bytes',()=>{
 const control=api.createStock033RequestWindowAuthoredControlV1('native-history100-v1');
 const fixture=contents=>({outputFiles:[{contents}],metafile:{inputs:{},outputs:{x:{imports:[]}}}});
 const ledger=control.createStock033PreparationLedgerV2(),result=control.runtimeMetadata(fixture(new Uint8Array([1,2,3])),ledger);
 assert.equal(result.toString(),JSON.stringify(fixture(new Uint8Array()).metafile)+'\n');assert.equal(ledger.totals().serializedBytes,result.length);
 let getters=0;const oversized=new Uint8Array(2097153);Object.defineProperty(oversized,'byteLength',{get(){getters++;return 1;}});
 for(const value of [fixture(oversized),fixture(new Proxy(new Uint8Array(),{})),{...fixture(new Uint8Array()),metafile:{oversized:'x'.repeat(1048576)}}]){
  const l=control.createStock033PreparationLedgerV2();assert.throws(()=>control.runtimeMetadata(value,l));assert.equal(l.totals().serializedBytes,0);
 }
 assert.equal(getters,0);
});
