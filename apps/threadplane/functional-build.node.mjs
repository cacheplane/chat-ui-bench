import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFunctionalBuild,authenticateFunctionalBuild,recheckFunctionalBuild} from './functional-build.mjs';
const selector='threadplane-0.3.2-idle-host-css-v1';
const facts={product:{sha256:'a',identity:{ino:1}},probe:{sha256:'b',identity:{ino:2}}};
const product={assetHashes:{'index.html':'a'}},probe={compiledHashes:{'contract.js':'b'}};
function readers(){const calls=[];return {calls,readers:{product:async()=>{calls.push('product');return product;},probe:async()=>{calls.push('probe');return probe;},facts:async()=>structuredClone(facts)}};}
test('stock has no selected functional build; unknown selectors reject',()=>{
 assert.equal(selectFunctionalBuild(undefined),undefined);
 for(const value of ['', 'stock', '../dist', {}, null])assert.throws(()=>selectFunctionalBuild(value),/Unsupported functional build selector/);
 assert.equal(selectFunctionalBuild(selector).id,selector);
});
test('authenticates both strict readers and retains descriptor, build facts and file identities',async()=>{
 const r=readers(),result=await authenticateFunctionalBuild(selector,r.readers);
 assert.deepEqual(r.calls,['product','probe']);assert.equal(result.descriptor.id,selector);assert.deepEqual(result.product,product);assert.deepEqual(result.probe,probe);assert.deepEqual(result.facts,facts);
 await recheckFunctionalBuild(result,r.readers);assert.deepEqual(r.calls,['product','probe','product','probe']);
});
test('failed product or probe authentication rejects without fallback',async()=>{
 for(const failed of ['product','probe']){const r=readers();r.readers[failed]=async()=>{throw Error('strict '+failed+' rejected');};await assert.rejects(authenticateFunctionalBuild(selector,r.readers),new RegExp('strict '+failed+' rejected'));}
});
test('rejects record identity drift during authentication and changed facts on reacquisition',async()=>{
 const r=readers();let n=0;r.readers.facts=async()=>({...structuredClone(facts),revision:n++});await assert.rejects(authenticateFunctionalBuild(selector,r.readers),/record facts changed/);
 const s=readers(),before=await authenticateFunctionalBuild(selector,s.readers);
 s.readers.product=async()=>({...product,assetHashes:{'index.html':'changed'}});await assert.rejects(recheckFunctionalBuild(before,s.readers),/Functional build changed/);
 const t=readers(),original=await authenticateFunctionalBuild(selector,t.readers);t.readers.facts=async()=>({...facts,probe:{sha256:'b',identity:{ino:3}}});await assert.rejects(recheckFunctionalBuild(original,t.readers),/Functional build changed/);
});

// Authored measurement fault controls only; real CSS mutants remain DOM-pending.
const {assertVisibleTypingDots}=await import('./functional-build.mjs');
const visibleDots=()=>Array.from({length:3},()=>({box:{width:8,height:8},display:'inline-block',visibility:'visible',effectiveOpacity:0.6,visibleWidth:8,visibleHeight:8,animation:'typing',running:true}));
test('accepts three measured visible animated typing dots',()=>assert.doesNotThrow(()=>assertVisibleTypingDots(visibleDots())));
for(const [name,fault] of [
 ['hidden dot',{visibility:'hidden'}],['transparent dot or ancestor',{effectiveOpacity:0}],['fully clipped dot',{visibleWidth:0}],['offscreen dot',{visibleHeight:0}]
])test('rejects allocated animated '+name,()=>{
 const dots=visibleDots();Object.assign(dots[1],fault);assert.throws(()=>assertVisibleTypingDots(dots),/Typing dot .* fails visibility\/style\/geometry checks/);
});
