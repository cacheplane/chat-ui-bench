import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./aimock-trace-costs-v2.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('V2 costs require independently complete profile-qualified capture, without prefix decoding',()=>{
 assert.equal(typeof api.analyzeAimockTraceCostsV2,'function');
 for(const snapshot of [{},{receipt:{schema:'aimock-trace-capture-v1',complete:true},payloadBase64:''},{receipt:{schema:'aimock-trace-capture-v2',complete:false},payloadBase64:''}]){const r=api.analyzeAimockTraceCostsV2(snapshot);assert.equal(r.status,'unavailable');assert.equal(r.FPS,null);assert.equal(r.scoringEligibility,false);}
});
