import test from 'node:test';
import assert from 'node:assert/strict';
test('versioned acquisition exposes collection and qualification APIs without accepting DTO origin',async()=>{
 const api=await import('./request-window-run-v2.mjs');
 for(const key of ['runStock033RequestWindowOriginalV2','inspectRequestWindowClosedCaptureV2','qualifyRequestWindowAcquisitionV2'])assert.equal(typeof api[key],'function',key);
 for(const value of [{},null,{status:'original-process-closed',phaseInspectionPolicy:'request-window-postcapture-owned-v12-v1'}]){
  assert.throws(()=>api.inspectRequestWindowClosedCaptureV2(value));
  await assert.rejects(api.qualifyRequestWindowAcquisitionV2(value,{out:'/never'}));
 }
});
test('V2 refuses old preparation and selection before dispatch',async()=>{
 const api=await import('./request-window-run-v2.mjs'),previous=process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;
 process.env.NATIVE_REAL_CHAT_ONCE_RELEASE='source-reviewed-native-stock033-request-window-scroll-v2';
 try{await assert.rejects(api.runStock033RequestWindowOriginalV2('/never',{mode:'real-chat-stock033-request-window-scroll-v1'},{}));}finally{if(previous===undefined)delete process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;else process.env.NATIVE_REAL_CHAT_ONCE_RELEASE=previous;}
});
async function authoredV2(){
 const fs=await import('node:fs/promises'),core=await import('./request-window-core.mjs'),source=await fs.readFile(new URL('./request-window-acquisition.node.mjs',import.meta.url),'utf8');
 const a=source.indexOf('function authored(){'),b=source.indexOf('\ntest(',a);
 const f=Function('recipe','runId','createRequestWindowInput','createRequestWindowGesture',source.slice(a,b)+';return authored();')(core.REQUEST_WINDOW_RECIPE,core.REQUEST_WINDOW_RUN_ID,core.createRequestWindowInput,core.createRequestWindowGesture);
 f.request.mode='real-chat-stock033-request-window-scroll-v2';f.request.phaseInspectionPolicy=f.custody.phaseInspectionPolicy='request-window-postcapture-owned-v12-v1';
 f.value.phase={policy:'source-owned-request-window-deferred-phase-v2',phaseInspectionPolicy:f.request.phaseInspectionPolicy,status:'deferred',originalTraceIdentity:{dev:1,ino:2},target:{frameId:'frame',loaderId:'loader',targetId:'cdp-target'},marks:{...f.value.input.marks},trace:{bytes:f.value.collection.trace.bytes,sha256:f.value.collection.trace.sha256},analysisEligible:false,FPS:null};return f;
}
test('V2 closed collection remains ineligible until separate whole-trace inspection',async()=>{const {projectAuthoredRequestWindowWorkerResultV2:project,projectAuthoredRequestWindowWorkerResultV1:old}=await import('./request-window-result.mjs'),f=await authoredV2();assert.equal(project(f.raw(),f.request,f.requestFact,f.custody).analysisEligible,false);assert.throws(()=>old(f.raw(),f.request,f.requestFact,f.custody));});
for(const mutate of [f=>f.request.phaseInspectionPolicy='wrong',f=>f.custody.phaseInspectionPolicy='wrong',f=>f.value.phase.analysisEligible=true,f=>f.value.phase.FPS=60,f=>f.value.phase.status='phase-registry-inventory-diagnostic',f=>f.value.phase.rows=[],f=>f.value.phase.originalTraceIdentity.ino=3,f=>f.value.phase.target.frameId='other',f=>f.value.phase.target.loaderId='other',f=>f.value.phase.marks.start=f.value.phase.marks.end,f=>f.value.phase.trace.sha256='0'.repeat(64)])test('V2 strict deferred result refuses crossed binding '+mutate,async()=>{const {projectAuthoredRequestWindowWorkerResultV2:project}=await import('./request-window-result.mjs'),f=await authoredV2();mutate(f);assert.throws(()=>project(f.raw(),f.request,f.requestFact,f.custody));});
async function qualificationHarness(mode='good'){
 const fs=await import('node:fs/promises'),{admitStock033DataV2}=await import('./roster-stock033-v2.mjs'),source=await fs.readFile(new URL('./request-window-run-v2.mjs',import.meta.url),'utf8');
 const a=source.indexOf('export async function qualifyRequestWindowAcquisitionV2('),b=source.indexOf('\nasync function verifyClosed(',a),closed=new WeakMap(),attempts=new WeakMap(),analysis=new WeakMap(),phaseBrands=new WeakMap(),original=Object.freeze({status:'original-process-closed'}),facts={phaseNames:{start:'original-start',end:'original-end'},binding:{nonce:'a'.repeat(32)}};
 closed.set(original,{facts});let verifications=0,calls=0,configSeen;
 const phase={facts:structuredClone(facts),phase:{policy:'source-owned-request-window-phase-inventory-diagnostic-v2',status:'phase-registry-inventory-diagnostic',rows:[{name:facts.phaseNames.start},{name:facts.phaseNames.end}]},publication:{path:'/authored'}};
 if(mode==='crossed-facts')phase.facts.binding.nonce='b'.repeat(32);if(mode==='unavailable')phase.phase.status='unavailable';if(mode==='wrong-policy')phase.phase.policy='old';if(mode==='wrong-name')phase.phase.rows[0].name='other';
 const capsule={async runRequestWindowPhaseOwnerV2(f,c){calls++;configSeen=c;const result={status:'original-phase-closed'};phaseBrands.set(result,phase);return mode==='copied-return'?{...result}:result;},inspectRequestWindowPhaseOwnerV2(r){const value=phaseBrands.get(r);if(!value)throw Error('unregistered');return value;}};
 const fn=Function('closedCapturesV2','qualificationAttemptsV2','admissions','unavailable','admitStock033DataV2','freeze','verifyClosed','loadPhase',source.slice(a,b).replace(/^export /,'').replace("import('./request-window-phase-owner-v2.mjs')",'loadPhase()')+';return qualifyRequestWindowAcquisitionV2;')(closed,attempts,analysis,()=>Error('unavailable'),admitStock033DataV2,v=>Object.freeze(v),async()=>{verifications++;if(mode==='late-bookend'&&verifications===2)throw Error('changed');},async()=>capsule);
 return{fn,original,analysis,calls:()=>calls,verifications:()=>verifications,config:()=>configSeen};
}
test('V2 qualification requires both original collection and original phase-owner capabilities',async()=>{const h=await qualificationHarness(),config={out:'/original'};const pending=h.fn(h.original,config);config.out='/mutated';assert.equal(await pending,h.original);assert.equal(h.analysis.has(h.original),true);assert.equal(h.config().out,'/original');assert.equal(h.verifications(),2);assert.equal(await h.fn(h.original,{out:'/second'}),h.original);assert.equal(h.calls(),1);await assert.rejects(h.fn({...h.original},{out:'/forged'}));});
for(const mode of ['crossed-facts','unavailable','wrong-policy','wrong-name','copied-return','late-bookend'])test('V2 qualification withholds private analysis on '+mode,async()=>{const h=await qualificationHarness(mode);await assert.rejects(h.fn(h.original,{out:'/authored'}));assert.equal(h.analysis.has(h.original),false);await assert.rejects(h.fn(h.original,{out:'/retry'}));assert.equal(h.calls(),1);});
