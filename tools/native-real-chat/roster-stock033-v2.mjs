// Pure membership checks only. Import does not read files, load a compiler or own a process.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {commonBuildKeys,contractSourceKeys,contractCompiledKeys,probeSourceKeys,probeCompiledKeys} from '../../apps/threadplane/probe-provenance.mjs';

export const stock033Roles=Object.freeze(['product-source','probe-source','probe-compiled','fixture-input','native-owner','native-runtime','metadata','served-asset']);
export const nativeOwnerKeys=Object.freeze([
 'tools/native-real-chat/README.md','tools/native-real-chat/fixture-entry.mjs','tools/native-real-chat/prepare.mjs',
 'tools/native-real-chat/prepare-owner-stock033-v2.mjs','tools/native-real-chat/prepare-stock033-v2.mjs','tools/native-real-chat/roster-stock033-v2.mjs',
 'tools/native-real-chat/run.mjs','tools/native-real-chat/source-model.mjs','tools/native-real-chat/worker-core.mjs','tools/native-real-chat/worker-io.mjs',
 'tools/native-real-chat/worker-physical.mjs','tools/native-real-chat/worker-ports.mjs','tools/native-real-chat/worker.mjs'
].sort());
export const nativeRuntimeCompiledKeys=Object.freeze([
 'packages/runner/dist/comparison-proto-native-capture.js','packages/runner/dist/comparison-proto-public-ports.js','packages/runner/dist/comparison-proto-trace.js',
 'packages/analyzer/dist/browser-frame-ordered-state.js','packages/analyzer/dist/browser-frame-packet-fragments.js',
 'packages/analyzer/dist/browser-frame-protobuf-fragments.js','packages/analyzer/dist/browser-frame-protobuf-wire.js',
 'packages/analyzer/dist/browser-frame-state-fragments.js','packages/analyzer/dist/browser-frame-trace-framer.js',
 'packages/analyzer/dist/browser-frame-track-descriptor-fragments.js','packages/analyzer/dist/browser-frame-track-event-fragments.js',
 'packages/analyzer/dist/browser-frame-whole-trace-reader.js','packages/analyzer/dist/browser-frame-whole-trace.js'
].sort());
export const nativeRuntimeSourceKeys=Object.freeze(nativeRuntimeCompiledKeys.map(key=>key.replace('/dist/','/src/').replace(/\.js$/,'.ts')).sort());
export const stock033CoreMetadataKeys=Object.freeze([
 'package.json','package-lock.json','tsconfig.base.json','apps/threadplane/package.json','apps/threadplane/angular.json',
 'apps/threadplane/tsconfig.json','apps/threadplane/tsconfig.app.json','apps/threadplane/.build-evidence.json',
 'packages/contract/package.json','packages/producer/package.json','packages/analyzer/package.json','packages/runner/package.json',
 'packages/runner/.comparison-build-evidence.json'
].sort());
export const stock033MacMetadataKeys=Object.freeze([
 'packages/analyzer/package.json','node_modules/typescript/package.json','node_modules/@typescript/typescript-darwin-arm64/package.json',
 'node_modules/esbuild/package.json','node_modules/@esbuild/darwin-arm64/package.json','node_modules/playwright/package.json',
 'node_modules/playwright-core/package.json','node_modules/playwright-core/browsers.json'
].sort());
const fail=label=>{throw Error('stock033-v2 roster: '+label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=values=>[...values].sort();
const integer=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function object(value){if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('own data object');}
function closed(value,keys){object(value);if(!same(sorted(Reflect.ownKeys(value)),sorted(keys)))fail('object keys');for(const key of keys)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail('accessor');}
function array(value,max){
 if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)fail('array bound/shape');
 for(let i=0;i<value.length;i++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,String(i))??{},'value'))fail('array hole/accessor');
}
// Bound traversal before copying, sorting or serializing caller-owned structures.
function preflight(value){
 let nodes=0,bytes=0;const active=new Set(),stack=[];
 const pay=n=>{bytes+=n;if(bytes>1048576)fail('encoded byte bound');};
 // Exact JSON string width, without allocating an escaped copy. Lone surrogates
 // become six-byte escapes; paired surrogates become four UTF8 bytes.
 function string(text){
  pay(2);for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);
   if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)pay(2);
   else if(c<32)pay(6);
   else if(c>=0xd800&&c<=0xdbff){const next=text.charCodeAt(i+1);if(next>=0xdc00&&next<=0xdfff){pay(4);i++;}else pay(6);}
   else if(c>=0xdc00&&c<=0xdfff)pay(6);
   else pay(c<128?1:c<2048?2:3);
  }
 }
 function* children(current,isArray){
  const keys=Reflect.ownKeys(current);if(keys.length>65536)fail('node bound');let first=true;
  for(const key of keys){
   if(typeof key!=='string')fail('symbol');const d=Object.getOwnPropertyDescriptor(current,key);
   if(!Object.hasOwn(d,'value')||(!d.enumerable&&!(isArray&&key==='length')))fail('accessor/nonenumerable');
   if(isArray&&key==='length')continue;
   if(!first)pay(1);first=false;if(!isArray){string(key);pay(1);}yield d.value;
  }
 }
 function enter(current){
  if(++nodes>65536)fail('node bound');
  if(current===null){pay(4);return;}
  if(typeof current==='boolean'){pay(current?4:5);return;}
  if(typeof current==='string'){string(current);return;}
  if(typeof current==='number'){if(!Number.isFinite(current))fail('number');pay(String(current).length);return;}
  if(typeof current!=='object'||types.isProxy(current))fail('own data');
  const isArray=Array.isArray(current);if(isArray)array(current,8192);else object(current);
  if(active.has(current))fail('cycle');
  // Later bounded serialization must not call a hook, including an inherited one.
  for(let p=current;p!==null;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,'toJSON');if(d){if(!Object.hasOwn(d,'value')||typeof d.value==='function')fail('serialization hook');break;}}
  pay(2);active.add(current);return {value:current,iterator:children(current,isArray)};
 }
 for(;;){const frame=enter(value);if(frame)stack.push(frame);let next;
  while(stack.length){const top=stack.at(-1);next=top.iterator.next();if(!next.done)break;active.delete(top.value);stack.pop();}
  if(!stack.length)return;value=next.value;
 }
}
function keyName(key){
 if(typeof key!=='string'||Buffer.byteLength(key)>192||! /^[A-Za-z0-9_@.-]+(?:\/[A-Za-z0-9_@.-]+)*$/.test(key)||key.split('/').some(part=>part==='.'||part==='..'||part==='records')||/(?:\.node\.mjs|\.test\.[^/]+|\.spec\.[^/]+)$/.test(key))fail('key');
 return key;
}
function rows(values,max=1024){
 array(values,max);const result=new Map();
 for(const row of values){closed(row,['key','bytes','sha256']);keyName(row.key);if(!integer(row.bytes,2097152)||!sha(row.sha256)||result.has(row.key))fail('row fact/duplicate');result.set(row.key,{key:row.key,bytes:row.bytes,sha256:row.sha256});}
 return result;
}
function hashMap(map){object(map);if(Reflect.ownKeys(map).length>1024)fail('hash map bound');for(const [key,digest]of Object.entries(map)){keyName(key);if(!sha(digest))fail('hash');}return sorted(Object.keys(map));}
function equalKeys(actual,expected,label){if(!same(sorted(actual),sorted(expected)))fail(label+' membership');}
function roleMaps(roles){
 closed(roles,stock033Roles);let references=0;
 for(const role of stock033Roles){array(roles[role],1024);references+=roles[role].length;if(references>8192)fail('role reference bound');}
 return Object.fromEntries(stock033Roles.map(role=>[role,rows(roles[role])]));
}
export function assertStock033ArchiveBudgetV2(value){
 preflight(value);closed(value,['archiveBytes','manifestBytes']);
 if(!integer(value.archiveBytes,16777216)||!integer(value.manifestBytes,1048576)||value.archiveBytes+value.manifestBytes+262144>16777216)fail('archive budget');
}

/** Root-trusted handoff, NOT authentication of arbitrary caller DTOs.
 * The outer owner must authenticate product/probe records against their original build-created facts,
 * validate ordinary stock033 schemas/package/lock/config/style provenance, and retain the reviewed
 * productSourceKeys() inventory plus contractCompiledKeys and approved fixture metafile facts.
 * No expectedRoles override exists. This function verifies names/facts; it neither discovers names
 * nor proves the authority/origin of rootAuthority. Physical original/archive identities stay with custody.
 */
export function assembleStock033RosterV2(input){
 preflight(input);closed(input,['roles','observedRoles','rootAuthority']);
 const expected=roleMaps(input.roles),observed=roleMaps(input.observedRoles),authority=input.rootAuthority;
 closed(authority,['product','probe','productSourceKeys','fixtureInputs','platform','architecture']);
 if(authority.platform!=='darwin'||authority.architecture!=='arm64')fail('reviewed platform');
 object(authority.product);object(authority.probe);
 const productKeys=hashMap(authority.product.sourceHashes),probeKeys=hashMap(authority.probe.sourceHashes),compiledKeys=hashMap(authority.probe.compiledHashes);
 array(authority.productSourceKeys,1024);const approvedProduct=authority.productSourceKeys.map(keyName);
 if(new Set(approvedProduct).size!==approvedProduct.length)fail('product key duplicate');
 equalKeys(productKeys,approvedProduct,'product source');equalKeys(probeKeys,probeSourceKeys,'probe source');equalKeys(compiledKeys,probeCompiledKeys,'probe compiled');
 for(const key of [...commonBuildKeys,...contractSourceKeys,...contractCompiledKeys])if(!productKeys.includes(key))fail('required product input');
 if(productKeys.includes('apps/threadplane/src/native-idle-host-css-v1.css'))fail('modified CSS');
 const fixture=rows(authority.fixtureInputs,256);
 array(authority.product.packages,1024);
 const packageMetadata=[];
 for(const p of authority.product.packages){object(p);keyName(p.resolutionPath);if(!/(^|\/)node_modules\/(?:@[^/]+\/)?[^/]+$/.test(p.resolutionPath))fail('package resolution');packageMetadata.push(p.resolutionPath+'/package.json');}
 const assets=hashMap(authority.product.assetHashes);if(assets.length!==12||assets.some(name=>! /^[A-Za-z0-9_.-]{1,192}$/.test(name)))fail('assets');
 const names={
  'product-source':productKeys,'probe-source':probeSourceKeys,'probe-compiled':probeCompiledKeys,'fixture-input':[...fixture.keys()],
  'native-owner':nativeOwnerKeys,'native-runtime':[...nativeRuntimeCompiledKeys,...nativeRuntimeSourceKeys],
  metadata:[...new Set([...stock033CoreMetadataKeys,...stock033MacMetadataKeys,...packageMetadata])],
  'served-asset':assets.map(name=>'apps/threadplane/dist/'+name)
 };
 const union=new Map(),tuples=[],roleCounts={};let membershipCount=0,archiveBytes=0,assetBytes=0;
 for(const role of sorted(stock033Roles)){
  const expectedRows=expected[role],actualRows=observed[role];equalKeys([...expectedRows.keys()],names[role],role);equalKeys([...actualRows.keys()],names[role],role+' observed');
  roleCounts[role]=expectedRows.size;membershipCount+=expectedRows.size;
  for(const key of sorted(expectedRows.keys())){
   const expectedRow=expectedRows.get(key),actualRow=actualRows.get(key);
   if(!same(expectedRow,actualRow))fail('observed fact drift');
   const digest=role==='product-source'?authority.product.sourceHashes[key]:role==='probe-source'?authority.probe.sourceHashes[key]:role==='probe-compiled'?authority.probe.compiledHashes[key]:role==='served-asset'?authority.product.assetHashes[key.slice('apps/threadplane/dist/'.length)]:undefined;
   if(digest!==undefined&&expectedRow.sha256!==digest)fail('build hash drift');
   if(role==='fixture-input'&&!same(expectedRow,fixture.get(key)))fail('fixture fact drift');
   if(role==='served-asset'){assetBytes+=expectedRow.bytes;if(expectedRow.bytes<1||assetBytes>2097152)fail('asset byte bound');}
   const previous=union.get(key);
   if(previous){if(previous.bytes!==expectedRow.bytes||previous.sha256!==expectedRow.sha256)fail('cross-role fact conflict');previous.roles.push(role);}
   else{if(union.size>=1024)fail('unique archive bound');archiveBytes+=expectedRow.bytes;assertStock033ArchiveBudgetV2({archiveBytes,manifestBytes:0});union.set(key,{...expectedRow,roles:[role]});}
   tuples.push([role,key,expectedRow.bytes,expectedRow.sha256]);
  }
 }
 const resultRows=sorted(union.keys()).map(key=>{const row=union.get(key);return Object.freeze({...row,roles:Object.freeze(row.roles)});});
 // Preserve public role declaration order; lexical tuple order is the hash contract.
 const counts=Object.fromEntries(stock033Roles.map(role=>[role,roleCounts[role]]));
 return Object.freeze({contract:'native-stock033-roster-v2',digest:createHash('sha256').update('native-stock033-roster-v2\0'+JSON.stringify(tuples)).digest('hex'),rows:Object.freeze(resultRows),roleCounts:Object.freeze(counts),membershipCount,unionCount:union.size,overlapCount:membershipCount-union.size,archiveBytes});
}

/** Compiler-private loading is trusted platform work. This joins only explicit metafile inputs. */
export function assertStock033FixtureInputsV2(approved,metafile){
 preflight(approved);preflight(metafile);const expected=rows(approved,256);object(metafile);object(metafile.inputs);
 equalKeys(Object.keys(metafile.inputs),[...expected.keys()],'fixture metafile');
 for(const [key,row]of expected){object(metafile.inputs[key]);if(metafile.inputs[key].bytes!==row.bytes)fail('fixture metafile bytes');}
}
/** Caller supplies reviewed explicit local runtime import targets; never treats discovery as approval. */
export function assertStock033RuntimeImportsV2(imports,roster){
 preflight(imports);preflight(roster);array(imports,1024);object(roster);array(roster.rows,1024);
 const approved=new Set(roster.rows.map(row=>row.key));for(const key of imports){keyName(key);if(!approved.has(key))fail('unapproved local runtime import');}
}
