import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import path from 'node:path';
import vm from 'node:vm';

const source=await readFile(new URL('./select-v1.mjs',import.meta.url),'utf8').catch(()=> '');
const guardSource=await readFile(new URL('../competitor-comparison/aimock-stock037-v1.mjs',import.meta.url),'utf8');
const oldSource=await readFile(new URL('../competitor-comparison/aimock-stock034-v1.mjs',import.meta.url),'utf8');
const old=vm.runInNewContext(oldSource.replace(/export /g,'')+';({STOCK034_SOURCE_HASHES_V1,STOCK034_INTEGRITIES_V1})');
const names=['a2ui','chat','langgraph','render','telemetry'].map(n=>'@threadplane/'+n);
const pins=()=>({schema:'threadplane-published-stock037-pins-v1',version:'0.3.7',selectedSourceHashes:null,packages:names.map(name=>({name,version:'0.3.7',resolved:`https://registry.npmjs.org/${name}/-/${name.slice(13)}-0.3.7.tgz`,integrity:'sha512-'+Buffer.alloc(64,9).toString('base64')}))});
const hashes={rootManifestBytes:'cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579',appManifestBytes:'aa2e1ff97c71ed46de6c1551b4234650ede1093b051d8b967cd1480fc6589edc',stockLockBytes:'e7cddcd2aa8a768818b1c513b818759c9094b4b07bbd01df4fb9ca1b6eb5cef4'};
function inputs(){const dependencies=Object.fromEntries(names.map(n=>[n,'0.3.4']));return{rootManifestBytes:JSON.stringify({dependencies:{angular:'21.2.25'}}),appManifestBytes:JSON.stringify({dependencies}),stockLockBytes:JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{angular:'21.2.25'}},'apps/threadplane':{dependencies:{...dependencies}},...Object.fromEntries(names.map(name=>[`apps/threadplane/node_modules/${name}`,{version:'0.3.4',resolved:`https://registry.npmjs.org/${name}/-/${name.slice(13)}-0.3.4.tgz`,integrity:old.STOCK034_INTEGRITIES_V1[name],dependencies:{[names[0]]:'^0.3.4',external:'^1.0.0'},peerDependencies:{[names[1]]:'0.3.4'}}]))}})};}
function guard(published=null){return vm.runInNewContext(guardSource.replace(/^import .*;\n/gm,'').replace(/export /g,'')+';({validateStock037PinsV1,stock037PublishedIdentityV1})',{types,Buffer,Error,STOCK034_SOURCE_HASHES_V1:old.STOCK034_SOURCE_HASHES_V1,STOCK037_PUBLISHED_PINS_V1:published});}
// Hash substitutions are confined to this source-VM authored graph; production
// has the literal canonical034 hashes and the real node:crypto binding only.
function load({input=inputs(),published=null,fs={},events=[]}={}){
 const syntheticHashes=new Map(Object.entries(input).map(([k,v])=>[v,hashes[k]]));
 const hash=algorithm=>{let bytes;return{update(value){bytes=value;return this;},digest(format){return syntheticHashes.get(bytes)??createHash(algorithm).update(bytes).digest(format);}};};
 const bindings={Buffer,Error,AggregateError,types,path,createHash:hash,...old,...guard(published),execFileSync(){events.push('git');return 'd'.repeat(40);},...Object.fromEntries(['lstat','mkdir','readFile','realpath','rename','rm','writeFile'].map(n=>[n,async()=>{events.push(n);throw Error('unexpected-'+n);} ])),...fs};
 return vm.runInNewContext(source.split('\nif(process.argv[1]')[0].replace(/^import .*;\n/gm,'').replace(/export /g,'')+';({deriveStock037SelectionV1,selectStock037DependenciesV1})',bindings);
}
test('stock037 selector has exactly two fixed APIs and closed CLI with canonical input pins',()=>{assert.deepEqual([...source.matchAll(/export (?:async )?function (\w+)/g)].map(m=>m[1]),['deriveStock037SelectionV1','selectStock037DependenciesV1']);assert.equal(source.match(/export /g)?.length,2);for(const h of Object.values(hashes))assert.ok(source.includes(h));assert.match(source,/process.argv.length===6&&process.argv\[2\]==='--root'&&process.argv\[4\]==='--expected-checkout'/);});
test('stock037 pure authored derivation fixes five rows and ranges without granting publication evidence',()=>{
 const input=inputs(),before=structuredClone(input),r=load({input}).deriveStock037SelectionV1(input,pins()),app=JSON.parse(r.appManifestBytes),lock=JSON.parse(r.selectedLockBytes);assert.deepEqual(input,before);assert.equal(r.publishedStockEvidence,false);assert.equal(r.selection,'registry-stock037-v1');assert.equal(r.version,'0.3.7');
 for(const p of pins().packages){assert.equal(app.dependencies[p.name],'0.3.7');assert.equal(lock.packages['apps/threadplane'].dependencies[p.name],'0.3.7');const row=lock.packages[`apps/threadplane/node_modules/${p.name}`];assert.equal(row.version,'0.3.7');assert.equal(row.integrity,p.integrity);assert.equal(row.resolved,p.resolved);assert.equal(row.dependencies[names[0]],'^0.3.7');assert.equal(row.peerDependencies[names[1]],'0.3.7');assert.equal(row.dependencies.external,'^1.0.0');}
});
test('stock037 pure input refuses wrong bytes keys graphs and unsupported reviewed transformations',()=>{
 const valid=inputs(),api=load({input:valid});for(const key of Object.keys(valid)){const changed={...valid,[key]:valid[key]+' '};assert.throws(()=>api.deriveStock037SelectionV1(changed,pins()),/source-hash/);}
 assert.throws(()=>api.deriveStock037SelectionV1({...valid,override:true},pins()),/inputs/);
 for(const mutate of [v=>v.lock.lockfileVersion=2,v=>v.lock.threadplaneModifiedDependencies={},v=>delete v.app.dependencies[names[0]],v=>v.app.dependencies['@threadplane/ag-ui']='0.3.4',v=>v.app.dependencies[names[0]]='0.3.6',v=>v.lock.packages[`apps/threadplane/node_modules/${names[0]}`].integrity='changed',v=>v.lock.packages[`apps/threadplane/node_modules/${names[0]}`].dependencies[names[0]]='latest',v=>v.lock.packages[''].dependencies.angular='changed']){const v={app:JSON.parse(valid.appManifestBytes),lock:JSON.parse(valid.stockLockBytes)};mutate(v);const input={...valid,appManifestBytes:JSON.stringify(v.app),stockLockBytes:JSON.stringify(v.lock)};assert.throws(()=>load({input}).deriveStock037SelectionV1(input,pins()));}
 const invalid=pins();invalid.packages[1]=invalid.packages[0];assert.throws(()=>api.deriveStock037SelectionV1(valid,invalid));
});
test('stock037 NULL selector refuses before argument getters filesystem git or mutation',async()=>{const events=[],api=load({events}),arg=new Proxy({}, {get(){events.push('argument');throw Error('getter');}});await assert.rejects(api.selectStock037DependenciesV1(arg,arg),/published-identity-unavailable/);assert.deepEqual(events,[]);});
test('stock037 pure input is closed data without accessor or symbol override ports',()=>{
 const input=inputs(),api=load({input});let observed=0;const accessor={...input};Object.defineProperty(accessor,'rootManifestBytes',{enumerable:true,get(){observed++;return input.rootManifestBytes;}});assert.throws(()=>api.deriveStock037SelectionV1(accessor,pins()),/inputs/);assert.equal(observed,0);
 const extra={...input,[Symbol('override')]:true};assert.throws(()=>api.deriveStock037SelectionV1(extra,pins()),/inputs/);assert.throws(()=>api.deriveStock037SelectionV1(new Proxy(input,{}),pins()),/inputs/);
});
function transaction({failLock=false,failRollback=false,badReadback=false,checkout='d'.repeat(40),badPath=false,wrongSelectedPin=false,changedInput=false}={}){
 const input=inputs(),result=load({input}).deriveStock037SelectionV1(input,pins()),published=pins();published.selectedSourceHashes={...result.selectedSourceHashes};const events=[],root='/authored-disposable',files=new Map([[root+'/package.json',input.rootManifestBytes],[root+'/apps/threadplane/package.json',input.appManifestBytes],[root+'/package-lock.json',input.stockLockBytes]]);let renamed=0;
 if(wrongSelectedPin)published.selectedSourceHashes['package-lock.json']='a'.repeat(64);
 const fs={realpath:async p=>{events.push('realpath');return p;},lstat:async p=>{events.push('lstat');return{isFile:()=>!badPath,isDirectory:()=>true};},readFile:async p=>{events.push('read');return (badReadback&&renamed===2||changedInput&&events.includes('write'))&&p.endsWith('/package-lock.json')?'bad':files.get(p);},mkdir:async()=>{events.push('mkdir');},writeFile:async(p,b)=>{events.push('write');files.set(p,b);},rename:async(a,b)=>{events.push('rename:'+a.split('/').at(-1));if(a.endsWith('/lock.json')&&failLock)throw Error('lock-failed');if(a.endsWith('/original-app.json')&&failRollback)throw Error('rollback-failed');files.set(b,files.get(a));files.delete(a);renamed++;},rm:async()=>events.push('rm'),execFileSync:()=>{events.push('git');return checkout;}};
 return{api:load({input,published,fs,events}),root,files,events,input,result};
}
test('stock037 authored transaction checks checkout regular paths and pinned output before mutation',async()=>{for(const options of [{checkout:'a'.repeat(40)},{badPath:true}]){const t=transaction(options);await assert.rejects(t.api.selectStock037DependenciesV1(t.root,'d'.repeat(40)));assert.equal(t.events.includes('mkdir'),false);}const t=transaction();await assert.rejects(t.api.selectStock037DependenciesV1('relative','d'.repeat(40)),/arguments/);assert.equal(t.events.length,0);});
test('stock037 authored transaction refuses selected pin drift and changed input before first rename',async()=>{const pin=transaction({wrongSelectedPin:true});await assert.rejects(pin.api.selectStock037DependenciesV1(pin.root,'d'.repeat(40)),/fixed-selected-source/);assert.equal(pin.events.includes('mkdir'),false);const changed=transaction({changedInput:true});await assert.rejects(changed.api.selectStock037DependenciesV1(changed.root,'d'.repeat(40)),/changed-inputs/);assert.equal(changed.events.some(e=>e.startsWith('rename:')),false);assert.equal(changed.files.get(changed.root+'/apps/threadplane/package.json'),changed.input.appManifestBytes);assert.equal(changed.events.includes('rm'),false);});
test('stock037 authored transaction publishes readback once and rolls app back on failed lock rename',async()=>{
 const ok=transaction();const r=await ok.api.selectStock037DependenciesV1(ok.root,'d'.repeat(40));assert.equal(r.publishedStockEvidence,false);assert.equal(ok.files.get(ok.root+'/package-lock.json'),ok.result.selectedLockBytes);assert.equal(ok.events.at(-1),'rm');assert.ok(ok.events.indexOf('git')<ok.events.indexOf('read'));
 const t=transaction({failLock:true});await assert.rejects(t.api.selectStock037DependenciesV1(t.root,'d'.repeat(40)),/lock-failed/);assert.equal(t.files.get(t.root+'/apps/threadplane/package.json'),t.input.appManifestBytes);assert.equal(t.files.get(t.root+'/package-lock.json'),t.input.stockLockBytes);assert.equal(t.events.includes('rm'),false);
 const b=transaction({failLock:true,failRollback:true});await assert.rejects(b.api.selectStock037DependenciesV1(b.root,'d'.repeat(40)),e=>e.message==='stock037-selection-lock-and-rollback-failed'&&e.errors.length===2);assert.equal(b.events.includes('rm'),false);
 const readback=transaction({badReadback:true});await assert.rejects(readback.api.selectStock037DependenciesV1(readback.root,'d'.repeat(40)),/publication/);assert.equal(readback.events.includes('rm'),false);
});
