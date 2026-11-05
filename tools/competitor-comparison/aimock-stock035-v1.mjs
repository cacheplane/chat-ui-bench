import {types} from 'node:util';
import {STOCK034_SOURCE_HASHES_V1} from './aimock-stock034-v1.mjs';
import {STOCK035_PUBLISHED_PINS_V1} from './aimock-stock035-pins-v1.mjs';

// Same reviewed public host/configuration; a distinct published package identity.
export const STOCK035_SOURCE_HASHES_V1=Object.freeze({...STOCK034_SOURCE_HASHES_V1});
const names=Object.freeze(['a2ui','chat','langgraph','render','telemetry'].map(name=>'@threadplane/'+name));
const need=(value,label)=>{if(!value)throw Error('aimock-stock035-'+label);};
function exact(value,keys){need(value!==null&&typeof value==='object'&&!types.isProxy(value)&&!Array.isArray(value),'pins-record');const descriptors=Object.getOwnPropertyDescriptors(value);need(Object.keys(descriptors).sort().join(',')===[...keys].sort().join(',')&&Object.values(descriptors).every(d=>Object.hasOwn(d,'value')),'pins-keys');}
/** Closed data parser only. Synthetic parser tests grant no build authority. */
export function validateStock035PinsV1(value){
 need(value!==null,'published-identity-unavailable');exact(value,['schema','version','packages','selectedSourceHashes']);need(value.schema==='threadplane-published-stock035-pins-v1'&&value.version==='0.3.5'&&Array.isArray(value.packages)&&!types.isProxy(value.packages)&&value.packages.length===5,'pins-identity');
 // null is useful only for pure registry-to-lock preparation. The production
 // accessor below refuses it before any build/browser or selector mutation.
 if(value.selectedSourceHashes!==null){exact(value.selectedSourceHashes,['package.json','package-lock.json','apps/threadplane/package.json']);need(Object.values(value.selectedSourceHashes).every(hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash))&&value.selectedSourceHashes['package.json']==='cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579','pins-selected-source');}
 const seen=new Set();
 for(const row of value.packages){exact(row,['name','version','resolved','integrity']);need(names.includes(row.name)&&!seen.has(row.name)&&row.version==='0.3.5','pins-package');seen.add(row.name);const short=row.name.slice('@threadplane/'.length);need(row.resolved===`https://registry.npmjs.org/${row.name}/-/${short}-0.3.5.tgz`&&typeof row.integrity==='string'&&/^sha512-[A-Za-z0-9+/]{86}==$/.test(row.integrity)&&Buffer.from(row.integrity.slice(7),'base64').length===64,'pins-registry');}
 need(seen.size===5,'pins-package');return value;
}
/** Real default guard has one fixed source authority and no verifier/pins port. */
export function immutableStock035PinsV1(value){const validated=validateStock035PinsV1(value);return Object.freeze({...validated,selectedSourceHashes:validated.selectedSourceHashes===null?null:Object.freeze({...validated.selectedSourceHashes}),packages:Object.freeze(validated.packages.map(row=>Object.freeze({...row})))});}
const publishedIdentity=STOCK035_PUBLISHED_PINS_V1===null?null:immutableStock035PinsV1(STOCK035_PUBLISHED_PINS_V1);
export function stock035PublishedIdentityV1(){need(publishedIdentity!==null&&publishedIdentity.selectedSourceHashes!==null,'published-identity-unavailable');return publishedIdentity;}
/** Attention expiry never counts as settlement of a real asynchronous build read. */
export async function waitStock035BuildOriginalV1(original,wait,ms,label){let pending=true;void original.then(()=>{pending=false;},()=>{pending=false;});try{return await wait(original,ms,label);}catch(error){if(pending){const failure=error instanceof Error?error:Error('aimock-stock035-build-attention',{cause:error});failure.unsafeOutstanding=true;throw failure;}throw error;}}
export function assertStock035BuildV1(build){
 const pins=stock035PublishedIdentityV1();
 need(build?.production===true&&build.framework?.name==='Angular'&&build.framework.version==='21.2.25'&&build.settings?.optimization===true&&build.settings.sourceMaps===false&&Array.isArray(build.packages),'build-identity');
 for(const[key,hash]of Object.entries(STOCK035_SOURCE_HASHES_V1))need(build.sourceHashes?.[key]===hash,'build-configuration');
 for(const[key,hash]of Object.entries(pins.selectedSourceHashes))need(build.sourceHashes?.[key]===hash,'build-selected-source');
 const selected=build.packages.filter(row=>row.name.startsWith('@threadplane/'));need(selected.length===5,'build-packages');
 for(const pin of pins.packages){const rows=selected.filter(row=>row.name===pin.name);need(rows.length===1&&rows[0].version==='0.3.5'&&rows[0].integrity===pin.integrity&&rows[0].resolutionPath===`apps/threadplane/node_modules/${pin.name}`,'build-package-identity');}
 return build;
}
