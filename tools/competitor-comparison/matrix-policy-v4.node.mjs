import test from 'node:test';
import assert from 'node:assert/strict';
import * as v3 from './matrix-policy-v3.mjs';
const api=await import('./matrix-policy-v4.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const clip={left:0,top:0,right:1280,bottom:720};
const rect=(top,bottom)=>({left:100,top,right:900,bottom});
const identity={contract:'matrix-acquisition-v4',nativeHistoryGesture:'visible-response-below-viewport-one-response-headroom-v4',orchestration:'matrix-active-acquisition-v1',sourceProtocol:'matrix-v3',sourceContextSchema:2};
test('fixed frozen acquisition identity and explicit unchanged v3 selection/roster/limits',()=>{
 assert.deepEqual(api.MATRIX_V4_ACQUISITION,identity);assert.ok(Object.isFrozen(api.MATRIX_V4_ACQUISITION));
 for(const key of ['MATRIX_V3_PROFILES','MATRIX_V3_LIMITS','MATRIX_V3_STAGE_MS','parseMatrixSelection','matrixCaseId','historyPrefixCharacters','matrixVerificationRoster'])assert.equal(api[key],v3[key]);
 assert.equal(api.matrixVerificationRoster().length,49);assert.equal(api.matrixVerificationRoster().at(-1).omitDelta,100);
});
test('authored below-viewport gesture uses response headroom, ceil and unchanged bound',()=>{
 assert.equal(typeof api.nativeHistorySeekV4,'function');
 for(const [view,response,desiredUp] of [[clip,rect(-4000,600),9320],[clip,rect(600,900),840],[clip,rect(0,720),1440],[{...clip,bottom:100},rect(99,100),600],[{...clip,top:10.25,bottom:110.75},rect(-500.125,100.625),1212],[clip,rect(-523568,720),1048576]]){
  const actual=api.nativeHistorySeekV4({clip:view,responseRect:response});assert.deepEqual(actual,{policy:identity.nativeHistoryGesture,desiredUp,deltaY:-desiredUp});assert.ok(Object.isFrozen(actual));
 }
 for(const response of [rect(-523568.5,720),rect(-Number.MAX_VALUE,Number.MAX_VALUE)])assert.throws(()=>api.nativeHistorySeekV4({clip,responseRect:response}),/seek-bound/);
});
test('closed finite positive rectangles must strictly overlap on both axes',()=>{
 assert.equal(typeof api.nativeHistorySeekV4,'function');
 const good={clip,responseRect:rect(0,600)};
 for(const mutate of [x=>x.extra=true,x=>delete x.clip,x=>x.responseRect=null,x=>x.clip.extra=1,x=>delete x.responseRect.left,x=>x.clip.right=0,x=>x.clip.bottom=0,x=>x.responseRect.right=100,x=>x.responseRect.bottom=0,x=>x.responseRect.left=1280,x=>x.responseRect.right=0,x=>x.responseRect.top=720,x=>x.responseRect.bottom=0]){const wrong=structuredClone(good);mutate(wrong);assert.throws(()=>api.nativeHistorySeekV4(wrong));}
 for(const field of ['left','top','right','bottom'])for(const number of [NaN,Infinity,-Infinity])for(const side of ['clip','responseRect']){const wrong=structuredClone(good);wrong[side][field]=number;assert.throws(()=>api.nativeHistorySeekV4(wrong));}
});
test('translation preserves geometry; v3 output stays fixed; finite headroom cannot guarantee native history',()=>{
 assert.equal(typeof api.nativeHistorySeekV4,'function');
 const response=rect(-4000,600),base=api.nativeHistorySeekV4({clip,responseRect:response});
 for(const offset of [-10000,25.25,10000])assert.deepEqual(api.nativeHistorySeekV4({clip:{...clip,top:clip.top+offset,bottom:clip.bottom+offset},responseRect:{...response,top:response.top+offset,bottom:response.bottom+offset}}),base);
 assert.equal(v3.nativeHistorySeek({clip,responseRect:response}).desiredUp,4360);
 assert.equal(response.top+4360,360);assert.equal(response.top+base.desiredUp,5320);
 const short=rect(600,900);assert.equal(short.top+v3.nativeHistorySeek({clip,responseRect:short}).desiredUp-200,1000);assert.equal(short.top+api.nativeHistorySeekV4({clip,responseRect:short}).desiredUp-200,1240);
 const displacement=response.top+base.desiredUp-clip.top+1;assert.ok(response.top+base.desiredUp-displacement<clip.top);
});
