import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {types} from 'node:util';

const source=await readFile(new URL('./aimock-stock037-v1.mjs',import.meta.url),'utf8').catch(()=> '');
const pinSource=await readFile(new URL('./aimock-stock037-pins-v1.mjs',import.meta.url),'utf8').catch(()=> '');
const hostSource=await readFile(new URL('./aimock-stock034-v1.mjs',import.meta.url),'utf8');
const hostHashes=vm.runInNewContext(hostSource.slice(0,hostSource.indexOf('export const STOCK034_INTEGRITIES')).replace('export const','const')+';STOCK034_SOURCE_HASHES_V1');
const names=['a2ui','chat','langgraph','render','telemetry'];
const fixture=()=>({schema:'threadplane-published-stock037-pins-v1',version:'0.3.7',selectedSourceHashes:null,packages:names.map(name=>({name:`@threadplane/${name}`,version:'0.3.7',resolved:`https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.7.tgz`,integrity:'sha512-'+Buffer.alloc(64,7).toString('base64')}))});
const selected=()=>({'package.json':'cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579','package-lock.json':'a'.repeat(64),'apps/threadplane/package.json':'b'.repeat(64)});
const exports=['validateStock037PinsV1','stock037PublishedIdentityV1','waitStock037BuildOriginalV1','assertStock037BuildV1'];
function load(pins=null){return vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\n;({'+exports.join(',')+'})',{types,Buffer,Error,STOCK034_SOURCE_HASHES_V1:hostHashes,STOCK037_PUBLISHED_PINS_V1:pins});}
test('stock037 exact guard and literal unavailable pins surfaces',()=>{
 assert.deepEqual([...source.matchAll(/export (?:async )?function (\w+)/g)].map(m=>m[1]).sort(),[...exports].sort());
 assert.equal(source.match(/export /g)?.length,4);
 assert.match(pinSource,/^\s*(?:\/\/[^\n]*\n)*export const STOCK037_PUBLISHED_PINS_V1\s*=\s*null;\s*$/);
});
test('stock037 closed parser accepts authored five consumed packages only and grants no authority',()=>{const api=load(),f=fixture();assert.equal(api.validateStock037PinsV1(f),f);f.selectedSourceHashes=selected();assert.equal(api.validateStock037PinsV1(f),f);assert.throws(()=>api.stock037PublishedIdentityV1(),/published-identity-unavailable/);});
test('stock037 parser refuses malformed releases packages integrity paths and source key shapes',()=>{
 const api=load();assert.throws(()=>api.validateStock037PinsV1(null),/unavailable/);
 for(const mutate of [v=>v.schema='threadplane-published-stock036-pins-v1',v=>v.version='0.3.6',v=>v.version='0.3.7-rc.1',v=>v.packages.pop(),v=>v.packages.push(v.packages[0]),v=>v.packages[1]=v.packages[0],v=>v.packages[0].name='@threadplane/ag-ui',v=>v.packages[0].version='0.3.6',v=>v.packages[0].resolved='file:local.tgz',v=>v.packages[0].resolved+='?x',v=>v.packages[0].integrity='sha512-'+Buffer.alloc(63).toString('base64'),v=>v.packages[0].integrity='sha512-'+('A'.repeat(85))+'B==',v=>v.packages[0].extra=true,v=>v.extra=true,v=>delete v.selectedSourceHashes,v=>v.selectedSourceHashes={'package-lock.json':'a'.repeat(64)},v=>{v.selectedSourceHashes=selected();v.selectedSourceHashes.extra='a'.repeat(64);},v=>{v.selectedSourceHashes=selected();v.selectedSourceHashes['package.json']='c'.repeat(64);}]){const f=fixture();mutate(f);assert.throws(()=>api.validateStock037PinsV1(f));}
 let observed=false;const f=fixture();Object.defineProperty(f,'version',{enumerable:true,get(){observed=true;throw Error('getter');}});assert.throws(()=>api.validateStock037PinsV1(f),/pins-keys/);assert.equal(observed,false);
 assert.throws(()=>api.validateStock037PinsV1(new Proxy(fixture(),{})),/pins-record/);
});
test('stock037 NULL guard refuses before build getters or supplied override can be observed',()=>{
 const api=load();let observed=0;const build=new Proxy({}, {get(){observed++;throw Error('build observed');}});assert.throws(()=>api.assertStock037BuildV1(build,fixture()),/published-identity-unavailable/);assert.equal(observed,0);
});
test('stock037 parser refuses accessor or decorated package arrays before observing their members',()=>{
 const api=load();let observed=0;const f=fixture();Object.defineProperty(f.packages,'0',{enumerable:true,get(){observed++;return fixture().packages[0];}});assert.throws(()=>api.validateStock037PinsV1(f),/pins-package-array/);assert.equal(observed,0);
 const extra=fixture();extra.packages.authority=true;assert.throws(()=>api.validateStock037PinsV1(extra),/pins-package-array/);
 const sparse=fixture();delete sparse.packages[0];assert.throws(()=>api.validateStock037PinsV1(sparse),/pins-package-array/);
});
test('stock037 closed metadata rejects symbol keys at every record boundary',()=>{
 const api=load();for(const decorate of [v=>v[Symbol('authority')]=true,v=>v.packages[0][Symbol('authority')]=true,v=>{v.selectedSourceHashes=selected();v.selectedSourceHashes[Symbol('authority')]=true;}]){const f=fixture();decorate(f);assert.throws(()=>api.validateStock037PinsV1(f),/pins-keys/);}
});
test('stock037 authored source VM preserves private frozen authority and physical build joins',()=>{
 const f=fixture();f.selectedSourceHashes=selected();const api=load(f),pins=api.stock037PublishedIdentityV1();assert.ok(Object.isFrozen(pins)&&Object.isFrozen(pins.packages)&&pins.packages.every(Object.isFrozen)&&Object.isFrozen(pins.selectedSourceHashes));
 f.packages[0].integrity='changed';assert.notEqual(pins.packages[0].integrity,'changed');
 const good={production:true,framework:{name:'Angular',version:'21.2.25'},settings:{optimization:true,sourceMaps:false},sourceHashes:{...hostHashes,...selected()},packages:pins.packages.map(p=>({...p,resolutionPath:`apps/threadplane/node_modules/${p.name}`}))};assert.equal(api.assertStock037BuildV1(good),good);
 for(const mutate of [v=>v.production=false,v=>v.framework.version='21.2.24',v=>v.settings.optimization=false,v=>v.settings.sourceMaps=true,v=>v.packages.pop(),v=>v.packages.push(v.packages[0]),v=>v.packages[0].version='0.3.6',v=>v.packages[0].integrity='changed',v=>v.packages[0].resolutionPath='node_modules/local',v=>v.sourceHashes['apps/threadplane/src/app.ts']='changed',v=>v.sourceHashes['package-lock.json']='changed']){const b=structuredClone(good);mutate(b);assert.throws(()=>api.assertStock037BuildV1(b));}
});
test('stock037 build attention retains unsettled original and preserves actual failures',async()=>{
 const api=load(),pending=new Promise(()=>{}),timeout=Error('attention');await assert.rejects(api.waitStock037BuildOriginalV1(pending,()=>Promise.reject(timeout),1,'build'),e=>e===timeout&&e.unsafeOutstanding===true);
 const failure=Error('actual');await assert.rejects(api.waitStock037BuildOriginalV1(Promise.reject(failure),p=>p,1,'build'),e=>e===failure&&e.unsafeOutstanding!==true);assert.equal(await api.waitStock037BuildOriginalV1(Promise.resolve('actual'),p=>p,1,'build'),'actual');
});
