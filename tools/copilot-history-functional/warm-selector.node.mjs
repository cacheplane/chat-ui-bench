import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createWarmSelector} from './warm-selector.mjs';

// Exact accepted portable extraction, evaluated only in this Node source test.
const original=fs.readFileSync(new URL('../../node_modules/@tanstack/virtual-core/dist/esm/index.js',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(original),'06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09');
const seam=s=>{const at=original.indexOf(s);assert.ok(at>=0);assert.equal(original.indexOf(s,at+1),-1);return at;};
const source='// Exact pinned original declarations; flat lanes1 only used by preparation.\n'+original.slice(seam('const defaultRangeExtractor ='),seam('\nconst observeElementRect'))+'\n'+original.slice(seam('const findNearestBinarySearch ='),seam('\nexport {'))+'\nexport{calculateRangeImpl,defaultRangeExtractor};\n';
assert.equal(sha(source),'5a1fa22deb4e13919dee14e0652a1f556b0697b4683134f18c2d776af3289672');
const kernel=Function(source.replace('export{calculateRangeImpl,defaultRangeExtractor};','return{calculateRangeImpl,defaultRangeExtractor};'))();
const rows=Array.from({length:100},(_,i)=>i);
const input=(change={})=>({flat:rows.flatMap(i=>[i*200,200]),mask:rows.map(()=>0),keys:rows.map(i=>'history-'+i),viewport:500,overscan:5,...change});
const prepare=i=>createWarmSelector(kernel).prepare(i);
const fields=['status','reason','gapStart','gapEnd','partition','targets','finalLow','finalHigh','steps','rangeCalls'];

test('pinned original ranges produce one bounded compact plan without readiness or arrays',()=>{
 const i=input(),r=prepare(i);assert.equal(r.status,'prepared-structural-only');assert.deepEqual(Object.keys(r),fields);assert.equal(r.reason,null);assert.equal(r.gapStart,0);assert.equal(r.gapEnd,99);assert.equal(r.partition,49);assert.equal(r.finalLow,44);assert.equal(r.finalHigh,56);assert.equal(r.steps,11);assert.equal(r.rangeCalls,13);assert.equal(r.targets,'99,89,79,69,62,0,10,20,30,40,49');assert.ok(Object.isFrozen(r));assert.ok(Object.values(r).every(v=>!Array.isArray(v)));assert.ok(i.mask.some(x=>x&16),'owned mask evolves in place');
});
test('fractional original geometry and viewport stay exact',()=>{
 const i=input({flat:rows.flatMap(j=>[j*200.25,200.25]),viewport:500.125});assert.equal(prepare(i).status,'prepared-structural-only');
});
test('cached rows without origin never gain historical credit from visits',()=>{
 const r=prepare(input({mask:rows.map(i=>i>=10&&i<=29?0:1)}));assert.equal(r.reason,'coverage-gap');assert.deepEqual(Object.keys(r),fields);assert.equal(r.targets,'');assert.equal(r.steps,0);assert.equal(r.gapStart,null);
});
test('widest gap lowest tie is selected without another partition',()=>{
 const r=prepare(input({mask:rows.map(i=>i>=10&&i<=29||i>=50&&i<=69?0:3)}));assert.equal(r.status,'prepared-structural-only');assert.equal(r.gapStart,10);assert.equal(r.gapEnd,29);assert.equal(r.partition,19);
});
test('a wider unsafe gap refuses instead of falling back to narrower safe gap',()=>{
 const r=prepare(input({mask:rows.map(i=>i>=10&&i<=25||i>=80?0:3)}));assert.equal(r.reason,'unsafe-join');assert.equal(r.rangeCalls,1);
});
test('bottom clamp is refused before a second extractor vector can overlap',()=>{
 let calls=0;const selector=createWarmSelector({...kernel,defaultRangeExtractor:r=>{calls++;return kernel.defaultRangeExtractor(r);}});
 const r=selector.prepare(input({mask:rows.map(i=>i<50?3:0),viewport:2000}));assert.equal(r.reason,'unsafe-join');assert.equal(r.rangeCalls,1);assert.equal(calls,1);
});
test('late historical coverage failure does not publish a chosen route',()=>{
 const r=prepare(input({viewport:1,overscan:0}));assert.equal(r.reason,'coverage-gap');assert.ok(r.rangeCalls>2);assert.equal(r.targets,'');assert.equal(r.finalLow,null);
});
test('reused canonical identity and invalid provenance refuse before kernel calls',()=>{
 let calls=0;const selector=createWarmSelector({...kernel,calculateRangeImpl(...args){calls++;return kernel.calculateRangeImpl(...args);}});
 for(const change of [{keys:rows.map(i=>'history-'+(i===99?98:i))},{mask:rows.map(()=>2)},{mask:rows.map(()=>8)},{viewport:0},{viewport:Infinity},{flat:rows.flatMap(i=>[i*0.5,0.5])}])assert.equal(selector.prepare(input(change)).reason,'invalid-input');assert.equal(calls,0);
});
test('prospective first visits never fabricate an original measurement or origin',()=>{
 const i=input(),r=prepare(i);assert.equal(r.status,'prepared-structural-only');assert.ok(i.mask.every(x=>(x&3)===0));assert.ok(i.mask.some(x=>x&32));
 const cached=input({mask:rows.map(j=>j>=10&&j<=29?0:1)});assert.equal(prepare(cached).reason,'coverage-gap');assert.ok(cached.mask.every(x=>!(x&2)));assert.ok(cached.mask.every(x=>!(x&8)));
});
test('no eligible gap produces canonical refusal without a range call',()=>{
 for(const mask of [rows.map(()=>3),rows.map(i=>i>=10&&i<25?0:3)]){const r=prepare(input({mask}));assert.equal(r.reason,'no-gap');assert.equal(r.rangeCalls,0);for(const k of ['gapStart','gapEnd','partition','finalLow','finalHigh'])assert.equal(r[k],null);assert.equal(r.targets,'');assert.equal(r.steps,0);}
});
test('five maximal gaps use one lowest tied partition and at most twelve stops',()=>{
 const r=prepare(input({mask:rows.map(i=>i<85&&i%17<16?0:3),viewport:200}));assert.equal(r.status,'prepared-structural-only');assert.equal(r.gapStart,0);assert.equal(r.gapEnd,15);assert.equal(r.steps,12);assert.equal(r.rangeCalls,14);assert.ok(r.targets.length<=35);
});
