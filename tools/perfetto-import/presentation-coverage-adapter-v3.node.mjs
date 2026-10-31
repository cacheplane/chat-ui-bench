// Authored source-copy boundary harness with injected acquisition/phase owners.
// It never creates a genuine native original or grants native authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {createPresentationCoverageAccountV2,chargePresentationCoverageWorkV2} from './presentation-coverage-wire-v2.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function adapterHarness(mode='good') {
 const source=await fs.readFile(new URL('./presentation-coverage-run-v3.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("import * as acquisition from '../native-real-chat/request-window-run-v2.mjs';"));
 const native=await fs.readFile(new URL('../native-real-chat/request-window-run-v2.mjs',import.meta.url),'utf8');
 const inspect=native.slice(native.indexOf('export function inspectRequestWindowAcquisitionV2('),native.indexOf('\nexport function inspectRequestWindowClosedCaptureV2('));
 const phase=native.slice(native.indexOf('export async function inspectRequestWindowPhaseQualificationV2('),native.indexOf('\nexport async function qualifyRequestWindowAcquisitionV2('));
 const admissions=new WeakMap(),phaseBrands=new WeakMap(),original=Object.freeze({status:'original-process-closed'}),phaseOriginal=Object.freeze({status:'original-phase-closed'});
 const trace={path:'/authored/trace',bytes:1,sha256:'a'.repeat(64),identity:{dev:1,ino:2,size:1,mtimeMs:1,ctimeMs:1}};
 const facts=Object.freeze({trace,publication:{...trace,path:'/authored/acquisition'},binding:{nonce:'a'.repeat(32)},fixtureProfile:'authored',target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'}});
 const phaseState={facts:structuredClone(facts),publication:{...trace,path:'/authored/phase',identity:['1','2','3','1','1','1','1']}};
 if(mode==='crossed-target')phaseState.facts.target.frameId='foreign';
 if(mode==='crossed-trace')phaseState.facts.trace.sha256='b'.repeat(64);
 if(mode==='crossed-binding')phaseState.facts.binding.nonce='b'.repeat(32);
 let acquisitionStable=true,phaseStable=true,seenContext;
 admissions.set(original,{facts,phaseOriginal});phaseBrands.set(phaseOriginal,phaseState);
 const owner={async verifyRequestWindowPhaseOwnerV2(value){if(!phaseStable||!phaseBrands.has(value))throw Error('phase-withdrawn');return phaseBrands.get(value);}};
 const api=Function('admissions','unavailable','verifyClosed','loadPhase',inspect.replaceAll('export ','').replace("import('./request-window-phase-owner-v2.mjs')",'loadPhase()')+'\n'+phase.replaceAll('export ','').replace("import('./request-window-phase-owner-v2.mjs')",'loadPhase()')+';return {inspectRequestWindowAcquisitionV2,verifyRequestWindowAcquisitionV2,inspectRequestWindowPhaseQualificationV2};')(admissions,()=>Error('original-required'),async owned=>{if(!acquisitionStable)throw Error('acquisition-withdrawn');return owned.facts;},async()=>owner);
 const originals=new WeakMap(),need=(ok,reason)=>{if(!ok)throw Error(reason);};
 const ownedStart=source.indexOf('function owned('),ownedEnd=source.indexOf('\nexport function runPresentationCoverageDiagnosticV3',ownedStart);
 const receipts=Function('originals','need','types','chargePresentationCoverageWorkV2','inspectPresentationCoverageCoreV2',source.slice(ownedStart,ownedEnd).replaceAll('export ','')+';return {inspect:inspectPresentationCoverageRunV3,verify:verifyPresentationCoverageRunV3};')(originals,need,types,chargePresentationCoverageWorkV2,()=>{});
 const start=source.indexOf('export async function runPresentationCoverageFromAcquisitionV3('),end=source.indexOf('\nif(process.argv[1]',start);
 const fn=Function('EXPORT_CONTRACT','model','acquisition','entryContext','textWork','need','sameOwned','snapshotAcquisitionFile','snapshot','hash','run','refused',source.slice(start,end).replace('export ','')+';return runPresentationCoverageFromAcquisitionV3;')({exportPolicy:'typed-uint64-decimal-export-v3'},{policy:'whole-selected-presentation-coverage-v2'},api,()=>{seenContext={clock:{check(){}},account:createPresentationCoverageAccountV2()};return seenContext;},(s,a)=>chargePresentationCoverageWorkV2(a,s.length*8+1),(ok,reason)=>{if(!ok)throw Error(reason);},(a,b)=>JSON.stringify(a)===JSON.stringify(b),async(path,cap,c,expected)=>({fact:expected}),async()=>{},hash,async(raw,authored,binding,context)=>{assert.equal(context,seenContext);assert.equal(authored,false);await binding.verify();const receipt={status:'diagnostic',binding,raw,context};originals.set(receipt,{clock:context.clock,account:context.account,core:{},verify:binding.verify,summary:{status:'diagnostic'}});return receipt;},(stage,reason)=>({status:'unavailable',stage,reason}));
 const raw=JSON.stringify({schema:'browser-presentation-coverage-from-acquisition-v3',policy:'whole-selected-presentation-coverage-v2',exportPolicy:'typed-uint64-decimal-export-v3',processor:{path:'/authored/processor',sha256:'a'.repeat(64)},out:'/authored/out',deadlineMs:60000});
 return {fn,original,raw,...receipts,restore(){acquisitionStable=true;phaseStable=true;},withdrawAcquisition(){acquisitionStable=false;},withdrawPhase(){phaseStable=false;}};
}
test('authored injected-owner adapter derives original target/trace/binding and shares context',async()=>{
 const h=await adapterHarness(),result=await h.fn(h.original,h.raw);assert.equal(result.status,'diagnostic');
 const c=JSON.parse(result.raw);assert.equal(c.exportPolicy,'typed-uint64-decimal-export-v3');assert.deepEqual(c.target,{frameId:'frame',loaderId:'loader'});assert.equal(c.trace.path,'/authored/trace');assert.equal(result.binding.facts.binding.nonce,'a'.repeat(32));assert.equal(result.binding.configJSON,h.raw);assert.equal(result.binding.configSha256,hash(h.raw));
 for(const dto of [{...h.original},JSON.parse(JSON.stringify(h.original)),null])assert.equal((await h.fn(dto,h.raw)).status,'unavailable');
});
for(const mode of ['crossed-target','crossed-trace','crossed-binding'])test('authored adapter rejects '+mode,async()=>{const h=await adapterHarness(mode);assert.equal((await h.fn(h.original,h.raw)).status,'unavailable');});
test('V3 native adapter requires its distinct exporter policy on the original-only path',async()=>{const h=await adapterHarness();for(const policy of [undefined,null,'whole-selected-presentation-coverage-v2','other']){const c=JSON.parse(h.raw);if(policy===undefined)delete c.exportPolicy;else c.exportPolicy=policy;const result=await h.fn(h.original,JSON.stringify(c));assert.equal(result.status,'unavailable');assert.equal(result.reason,'invalid-config');}});
for(const withdraw of ['withdrawAcquisition','withdrawPhase'])test('authored adapter permanently withdraws receipt after '+withdraw,async()=>{const h=await adapterHarness(),r=await h.fn(h.original,h.raw);assert.equal(r.status,'diagnostic');h[withdraw]();await assert.rejects(h.verify(r));assert.throws(()=>h.inspect(r));h.restore();assert.throws(()=>h.inspect(r));await assert.rejects(h.verify(r));});
