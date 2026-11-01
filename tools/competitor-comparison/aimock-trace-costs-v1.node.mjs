import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./aimock-trace-costs-v1.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const binding={frameId:'owned',pid:10,tid:20};
test('owned complete task and layout wall durations remain separate from nested work and foreign threads',()=>{
 assert.equal(typeof api.projectOwnedRendererCostsV1,'function');
 const events=[{ph:'X',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:10,tid:20,ts:100,dur:100000},{ph:'X',name:'RunMicrotasks',pid:10,tid:20,ts:101,dur:99000},{ph:'X',name:'Layout',cat:'devtools.timeline',pid:10,tid:20,ts:102,dur:3000},{ph:'X',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:11,tid:20,ts:100,dur:999999},{ph:'B',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:10,tid:20,ts:200},{ph:'X',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:10,tid:20,ts:200000,dur:10000}];
 const r=api.projectOwnedRendererCostsV1({traceEvents:events},binding);
 assert.equal(r.status,'available');assert.equal(r.tasks.observedCompleteEvents,2);assert.equal(r.tasks.longTaskEvents,1);assert.equal(r.tasks.longest[0].durationUs,100000);assert.equal(r.layouts.longest[0].durationUs,3000);
 assert.equal(r.tasks.longest[0].eventIndex,0);assert.equal(r.FPS,null);assert.equal(r.performance,false);assert.equal(r.scoringEligibility,false);assert.equal(r.cpuTime,null);assert.equal(r.presentationCoverage,'unverified');assert.equal(r.tasks.totalDurationUs,undefined);
});
test('missing ownership and malformed owned complete-event timing never produce costs',()=>{
 assert.equal(typeof api.projectOwnedRendererCostsV1,'function');
 for(const [trace,owner] of [[{traceEvents:[]},null],[{traceEvents:[{ph:'X',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:10,tid:20,ts:1,dur:-1}]},binding],[{traceEvents:[{ph:'X',name:'Layout',cat:'devtools.timeline',pid:10,tid:20,ts:Infinity,dur:1}]},binding]])assert.equal(api.projectOwnedRendererCostsV1(trace,owner).status,'unavailable');
});
test('no observed task is an unavailable task population, not a zero-cost result',()=>{
 assert.equal(typeof api.projectOwnedRendererCostsV1,'function');const r=api.projectOwnedRendererCostsV1({traceEvents:[]},binding);assert.equal(r.status,'unavailable');assert.equal(r.reason,'aimock-trace-no-owned-complete-tasks');
});

test('recognized owned event names with absent or foreign categories never qualify',()=>{for(const cat of [undefined,'foreign','toplevel','disabled-by-default-devtools.timeline,foreign']){const r=api.projectOwnedRendererCostsV1({traceEvents:[{ph:'X',name:'RunTask',cat,pid:10,tid:20,ts:1,dur:1}]},binding);assert.equal(r.status,'unavailable');}});
