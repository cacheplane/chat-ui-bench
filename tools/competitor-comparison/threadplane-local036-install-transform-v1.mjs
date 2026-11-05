import {createHash} from 'node:crypto';
import {types} from 'node:util';

const need=value=>{if(!value)throw Error('local036-install-transform-invalid');};
const modulePath='.install-collector/development-install.mjs';
const placeholder=Buffer.from('export const installationToken = null;\n');
const placeholderSHA='a69938ff45c56be138849066563917e17169fc7e0d9143e95801af40f472cbe4';
const names=Object.freeze(['@threadplane/chat','@threadplane/langgraph','@threadplane/render']);
const producers=Object.freeze([
 ['bridge',1248,'7e35d136e1c0da49eda76ef7ca6c53891cf3fb5aaecc4fba8ae0adcc0c275c74'],
 ['collector',4045,'dad9a55018c34610cd6fdad3b3d87aa133c6bdc52aed791476587cc23e42f6df'],
 ['files',839,'178aba8b167b12644bc7ed080da7afd0fc07fa384cd1d3481bf26f35d1b49f83'],
 ['git-context',7187,'d1b557b46a17559bf6a7c07d20af85941d6973f2522224fce3a7a07f04758ec5'],
 ['identity',1511,'1084fead3297056492b71d9f2a3c3cb61dd7a60a919c535fd3ca307556a13847'],
 ['policy',1692,'f6233be49dd7d21ae1a8294501c3262b75995db37da1547e5d47f4710ba24012'],
 ['postinstall',536,'d23262fee7a9aafd8f69d9cef74602064e57bf98bb9a54476b5514be7168b743'],
].map(([name,bytes,sha256])=>Object.freeze({path:`install/${name}.cjs`,bytes,sha256})));
const typedLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'length').get;
const typedSet=Uint8Array.prototype.set;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function data(value,keys){
 need(value!==null&&typeof value==='object'&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Object.prototype);
 const descriptors=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(descriptors);
 need(actual.every(key=>typeof key==='string')&&actual.sort().join('\0')===[...keys].sort().join('\0')&&Object.values(descriptors).every(d=>Object.hasOwn(d,'value')));
 return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}
function bytes(value,cap){
 need(!types.isProxy(value)&&Buffer.isBuffer(value)&&Object.getPrototypeOf(value)===Buffer.prototype);
 const count=Reflect.apply(typedLength,value,[]);need(count<=cap);const owned=Buffer.alloc(count);Reflect.apply(typedSet,owned,[value]);return owned;
}
function inventory(value){
 need(!types.isProxy(value)&&Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 need(keys.every(key=>typeof key==='string')&&Object.values(descriptors).every(d=>Object.hasOwn(d,'value')));
 const count=descriptors.length.value;need(Number.isSafeInteger(count)&&count>0&&count<=4096&&keys.length===count+1);
 const rows=[];let total=0;
 for(let i=0;i<count;i++){
  need(Object.hasOwn(descriptors,String(i)));const row=data(descriptors[i].value,['path','bytes','sha256']);
  need(typeof row.path==='string'&&row.path.length>0&&row.path.length<=1024&&!row.path.includes('\\')&&!row.path.includes('\0')&&row.path.split('/').every(part=>part&&part!=='.'&&part!=='..'));
  need(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=16777216&&(total+=row.bytes)<=67108864&&typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256));
  need(i===0||rows[i-1].path.localeCompare(row.path)<0);rows.push(row);
 }
 return rows;
}
const same=(a,b)=>a.path===b.path&&a.bytes===b.bytes&&a.sha256===b.sha256;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
/** Pure known036 output-language validation. This grants no build or execution authority. */
export function validateLocal036InstallTransformV1(input){
 const value=data(input,['name','version','path','postinstall','tarInventory','installedInventory','tarModuleBytes','installedModuleBytes']);
 need(names.includes(value.name)&&value.version==='0.3.6'&&value.path===modulePath&&value.postinstall==='node install/postinstall.cjs');
 const expected=inventory(value.tarInventory),actual=inventory(value.installedInventory);
 need(expected.length===actual.length);
 for(let i=0;i<expected.length;i++){need(expected[i].path===actual[i].path);if(expected[i].path!==modulePath)need(same(expected[i],actual[i]));}
 const expectedProducers=expected.filter(row=>row.path.startsWith('install/')&&row.path.endsWith('.cjs'));
 need(expectedProducers.length===producers.length&&producers.every((row,i)=>same(row,expectedProducers[i])));
 const tar=bytes(value.tarModuleBytes,40),installed=bytes(value.installedModuleBytes,74);
 need(tar.equals(placeholder)&&sha(tar)===placeholderSHA);
 const sourceRow=expected.find(row=>row.path===modulePath),observedRow=actual.find(row=>row.path===modulePath);
 need(sourceRow&&observedRow&&sourceRow.bytes===39&&sourceRow.sha256===placeholderSHA&&observedRow.bytes===installed.length&&observedRow.sha256===sha(installed));
 let observedKind;
 if(installed.equals(placeholder))observedKind='null';
 else{
  need(installed.length===73);for(const byte of installed)need(byte<=127);
  need(/^export const installationToken = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";\n$/.test(installed.toString('utf8')));observedKind='uuidv4';
 }
 return freeze({schema:'threadplane-local036-install-transform-v1',name:value.name,version:'0.3.6',path:modulePath,postinstall:'node install/postinstall.cjs',producerFiles:producers.map(row=>({...row})),placeholder:{bytes:39,sha256:placeholderSHA},observed:{bytes:installed.length,sha256:sha(installed)},observedKind});
}
