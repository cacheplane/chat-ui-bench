import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as prep from './prepare-stock033-v2.mjs';
import * as owner from './prepare-owner-stock033-v2.mjs';
import * as roster from './roster-stock033-v2.mjs';
import {authoredRequestTree} from './request-window-preparation.test-helper.mjs';
const policy='request-window-postcapture-owned-v12-v1';
test('V2 compact counter wire preserves all original counters and rejects malformed indexed tuples',()=>{
 const control=owner.createStock033RequestWindowOwnerAuthoredControlV2('native-history10000-v1');
 const totals=control.requestLedger().totals(),keys=Object.keys(totals);keys.forEach((key,i)=>totals[key]=i+1);
 const wire=control.encodeCounterTuple(totals);assert.deepEqual(wire,keys.map((key,i)=>[i,totals[key]]));assert.deepEqual(control.decodeCounterTuple(wire),totals);
 for(const mutate of [x=>x.pop(),x=>x.push([10,0]),x=>{[x[0],x[1]]=[x[1],x[0]];},x=>x[0][0]=1,x=>x[0][0]=-0,x=>x[0][1]=-0,x=>x[0][1]=-1,x=>x[0].push(0),x=>x[0][1]=Number.MAX_SAFE_INTEGER+1,x=>Object.defineProperty(x[0],'1',{get(){throw Error('accessor');}})]){const bad=structuredClone(wire);mutate(bad);assert.throws(()=>control.decodeCounterTuple(bad));}
 assert.throws(()=>control.encodeCounterTuple({...totals,extra:0}));const missing={...totals};delete missing.operations;assert.throws(()=>control.encodeCounterTuple(missing));
 const huge=structuredClone(wire);huge[0][1]=131073;assert.throws(()=>control.transferRequestLedger({totals:control.decodeCounterTuple(huge),platformSetSha256:'a'.repeat(64),reservation:Object.fromEntries(keys.map(key=>[key,0]))}),/transfer counter/);
 const envelope=control.requestEnvelope('/Users/blove/.cache/chat-ui-bench/rw10000v2a/i/config.json',2000000);assert.ok(Array.isArray(envelope.request.budget.totals));assert.deepEqual(control.decodeCounterTuple(envelope.request.budget.totals),envelope.baseline.totals);assert.ok(Buffer.byteLength(JSON.stringify(envelope.request))<=1023);
 assert.ok(!Array.isArray(owner.createStock033RequestWindowOwnerAuthoredControlV1('native-history10000-v1').requestEnvelope('/authored/config').request.budget.totals));
});
test('explicit V2 entry points select the fixed phase policy before source work',async()=>{
 for(const key of ['prepareActualStock033RequestWindowV2','verifyStock033RequestWindowPreparationV2','inspectStock033RequestWindowPreparationV2','createStock033RequestWindowAuthoredControlV2','verifyRequestWindowOriginalsV2'])assert.equal(typeof prep[key],'function',key);
 for(const key of ['generateStock033RequestWindowPreparationInputsV2','runStock033RequestWindowPreparationOwnerV2','createStock033RequestWindowOwnerAuthoredControlV2'])assert.equal(typeof owner[key],'function',key);
 const control=owner.createStock033RequestWindowOwnerAuthoredControlV2('native-history100-v1'),request=control.requestEnvelope('/authored/config').request,result=control.resultEnvelope('x');
 assert.equal(request.type,'prepare-request-window-scroll-v2');assert.equal(request.phaseInspectionPolicy,policy);assert.equal(result.phaseInspectionPolicy,policy);assert.equal(result.template.phaseInspectionPolicy,policy);assert.equal(result.reference.phaseInspectionPolicy,policy);
 await assert.rejects(owner.generateStock033RequestWindowPreparationInputsV2({fixtureProfile:'foreign'}));
 assert.equal(owner.createStock033RequestWindowOwnerAuthoredControlV1('native-history100-v1').requestEnvelope('/authored/config').request.phaseInspectionPolicy,undefined);
});
test('V12 closure is exact and only the V2 request family gains new names',()=>{
 assert.ok(Array.isArray(roster.requestWindowV2NativeOwnerKeys));
 assert.equal(roster.nativeRuntimeCompiledKeys.length,13);assert.equal(roster.nativeRuntimeSourceKeys.length,13);
 assert.equal(roster.requestWindowNativeOwnerKeys.length,21);
 assert.equal(roster.requestWindowV2NativeOwnerKeys.length,27);
 for(const name of ['request-window-phase-v2','request-window-phase-owner-v2','request-window-phase-worker-v2','request-window-deferred-phase-v2','request-window-run-v2','request-window-worker-v2']){const key='tools/native-real-chat/'+name+'.mjs';assert.ok(roster.requestWindowV2NativeOwnerKeys.includes(key));assert.ok(!roster.requestWindowNativeOwnerKeys.includes(key));assert.ok(!roster.nativeOwnerKeys.includes(key));}
 assert.equal(roster.requestWindowV2NativeRuntimeCompiledKeys.length,19);assert.equal(new Set(roster.requestWindowV2NativeRuntimeCompiledKeys).size,19);
 for(const name of ['browser-frame-owned-paint-v12-budget','browser-frame-owned-paint-v12-kernel','browser-frame-owned-paint-v12','browser-frame-owned-paint-v12-reader','browser-frame-paint-packet-adapter','browser-frame-paint-timing-r-fragments'])assert.ok(roster.requestWindowV2NativeRuntimeCompiledKeys.includes('packages/analyzer/dist/'+name+'.js'));
 assert.equal(typeof roster.assembleStock033RequestWindowRosterV2,'function');
});
test('V2 authored child closes original process and retains fixed policy on both handoff DTOs',async()=>{
 const result=await owner.createStock033RequestWindowOwnerAuthoredControlV2('native-history100-v1').run('success');
 assert.deepEqual(result.child.exit,{code:0,signal:null});assert.deepEqual(result.child.close,{code:0,signal:null});assert.equal(result.child.ipc,true);assert.equal(result.child.send,'fulfilled');
 for(const stream of [result.stdout,result.stderr]){assert.equal(stream.end,true);assert.equal(stream.close,true);}
 assert.equal(result.request.type,'authored-request-window-scroll-v2');assert.equal(result.request.phaseInspectionPolicy,policy);assert.equal(result.prepared.template.phaseInspectionPolicy,policy);assert.equal(result.prepared.reference.phaseInspectionPolicy,policy);
});
for(const profile of ['native-history100-v1','native-history1000-v1','native-history10000-v1'])test('authored V2 '+profile+' original archive and private policy admission',()=>authoredRequestTree(profile,async({options})=>{
 const control=prep.createStock033RequestWindowAuthoredControlV2(profile);assert.equal(options.phaseInspectionPolicy,policy);assert.equal(options.release.phaseInspectionPolicy,policy);
 const prepared=await control.prepareActualStock033RequestWindowV2(options);assert.equal(prepared.template.mode,'authored-real-chat-stock033-request-window-scroll-v2');assert.equal(prepared.template.phaseInspectionPolicy,policy);assert.equal(prepared.reference.phaseInspectionPolicy,policy);
 const original=await control.verifyStock033RequestWindowPreparationV2(options.outputDirectory,prepared.template,prepared.reference),facts=control.inspectStock033RequestWindowPreparationV2(original);assert.equal(facts.phaseInspectionPolicy,policy);
 assert.throws(()=>prep.inspectStock033RequestWindowPreparationV2(original));assert.throws(()=>control.inspectStock033RequestWindowPreparationV2(structuredClone(original)));assert.throws(()=>prep.createStock033RequestWindowAuthoredControlV1(profile).inspectStock033RequestWindowPreparationV1(original));
 await assert.rejects(prep.createStock033RequestWindowAuthoredControlV1(profile).verifyStock033RequestWindowPreparationV1(options.outputDirectory,prepared.template,prepared.reference));
 const manifest=JSON.parse(await fs.readFile(options.outputDirectory+'/app-manifest.json'));assert.equal(manifest.phaseInspectionPolicy,policy);assert.equal(manifest.roster.contract,'native-stock033-request-window-roster-v2');assert.ok(manifest.records.some(x=>x.key==='tools/native-real-chat/request-window-phase-worker-v2.mjs'));assert.ok(manifest.records.some(x=>x.key==='packages/analyzer/dist/browser-frame-owned-paint-v12-reader.js'));
},2));
test('V2 runtime import audit joins the actual added direct reader edge',()=>authoredRequestTree('native-history100-v1',async({options,update,refresh})=>{
 await update('tools/native-real-chat/request-window-phase-worker-v2.mjs',"import {readOwnedPaintTraceV12ForWorker} from '../../packages/analyzer/dist/browser-frame-owned-paint-v12-reader.js';\n");await refresh();const control=prep.createStock033RequestWindowAuthoredControlV2('native-history100-v1');await control.prepareActualStock033RequestWindowV2(options);
},2));
test('legacy request import audit refuses the V12 reader edge without gaining its closure',()=>authoredRequestTree('native-history100-v1',async({options,update,refresh})=>{
 await update('tools/native-real-chat/request-window-worker.mjs',"import '../../packages/analyzer/dist/browser-frame-owned-paint-v12-reader.js';\n");await refresh();await assert.rejects(prep.createStock033RequestWindowAuthoredControlV1('native-history100-v1').prepareActualStock033RequestWindowV1(options),/unapproved local runtime import/);
}));
test('V2 policy mutation refuses before any preparation IO',()=>{
 assert.equal(typeof prep.createStock033RequestWindowAuthoredControlV2,'function');const control=prep.createStock033RequestWindowAuthoredControlV2('native-history100-v1'),ledger=control.createStock033PreparationLedgerV2();
 return assert.rejects(control.prepareActualStock033RequestWindowV2({fixtureProfile:'native-history100-v1',phaseInspectionPolicy:'foreign',ledger})).then(()=>assert.equal(ledger.snapshot().operations,0));
});
test('10000 V2 retained serialization stays within unchanged aggregate and archive caps',()=>authoredRequestTree('native-history10000-v1',async({options})=>{
 const control=prep.createStock033RequestWindowAuthoredControlV2('native-history10000-v1');options.ledger=control.createStock033PreparationLedgerV2({initial:{serializedBytes:1876934}});const prepared=await control.prepareActualStock033RequestWindowV2(options);assert.equal(prepared.template.fixture.profile,'native-history10000-v1');assert.ok(options.ledger.totals().serializedBytes<=8388608);assert.ok(options.ledger.totals().archiveWriteBytes<=16777216);assert.ok(options.ledger.totals().operations<=131072);
},2));
