import test from 'node:test';
import assert from 'node:assert/strict';
import * as v3 from './matrix-policy-v3.mjs';
import * as v4 from './matrix-policy-v4.mjs';
const api=await import('./matrix-policy-v5.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('V5 identity and new uniform acquisition caps are exact and frozen',()=>{
 assert.deepEqual(api.MATRIX_V5_ACQUISITION,{contract:'matrix-acquisition-v5',nativeHistoryGesture:'visible-response-below-viewport-one-response-headroom-v4',orchestration:'matrix-browser-local-readiness-v1',sourceProtocol:'matrix-v3',sourceContextSchema:2});
 assert.deepEqual(api.MATRIX_V5_READINESS,{budgetMs:4000,pollMs:50,maxObservations:80,metadataBytes:8388608,receiptBytes:16384});
 assert.ok(Object.isFrozen(api.MATRIX_V5_ACQUISITION));assert.ok(Object.isFrozen(api.MATRIX_V5_READINESS));
});
test('V5 reexports original selection, roster, caps and gesture by identity',()=>{
 for(const key of ['MATRIX_V3_PROFILES','MATRIX_V3_LIMITS','MATRIX_V3_STAGE_MS','parseMatrixSelection','matrixCaseId','historyPrefixCharacters','matrixVerificationRoster'])assert.equal(api[key],v3[key]);
 assert.equal(api.nativeHistorySeekV4,v4.nativeHistorySeekV4);assert.equal(api.matrixVerificationRoster().length,49);
 assert.equal(api.historyPrefixCharacters(6400),512);assert.equal(api.historyPrefixCharacters(262144),20976);
});
