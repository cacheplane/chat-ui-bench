import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./aimock-stock034-v1.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('stock build guard requires production configuration and exact reviewed packages/configuration',()=>{
 assert.equal(typeof api.assertStock034BuildV1,'function');
 const good={production:true,framework:{name:'Angular',version:'21.2.25'},settings:{optimization:true,sourceMaps:false},sourceHashes:{...api.STOCK034_SOURCE_HASHES_V1},packages:Object.entries(api.STOCK034_INTEGRITIES_V1).map(([name,integrity])=>({name,integrity,version:'0.3.4',resolutionPath:`apps/threadplane/node_modules/${name}`}))};
 assert.equal(api.assertStock034BuildV1(good),good);
 for(const mutate of [x=>x.production=false,x=>x.settings.sourceMaps=true,x=>x.packages[0].version='0.3.3',x=>x.packages[0].integrity='sha512-other',x=>x.packages.push(x.packages[0]),x=>x.sourceHashes['apps/threadplane/src/styles.css']='modified',x=>x.packages[0].resolutionPath='candidate-build']){const x=structuredClone(good);mutate(x);assert.throws(()=>api.assertStock034BuildV1(x));}
});
