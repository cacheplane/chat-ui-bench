import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {STOCK034_SOURCE_HASHES_V1} from './aimock-stock034-v1.mjs';
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=value=>sha(JSON.stringify(value));
const HEX=/^[a-f0-9]{64}$/;
const need=value=>{if(!value)throw Error('threadplane-local-build-identity');};
const exact=(value,keys)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('\0')===[...keys].sort().join('\0'));
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const names=['a2ui','chat','langgraph','render','telemetry'];
export const LOCAL_BUILD_PROFILE_V1=Object.freeze({
 benchmarkBaseCommit:'59829cd2989176e43bf115c6cb4f53d32a9a33a3',
 baseLockSha256:'e7cddcd2aa8a768818b1c513b818759c9094b4b07bbd01df4fb9ca1b6eb5cef4',
 vendorClosureSha256:'2c845754f9a7654757dc6d317ec41f01342a83d09528a1989117925bafc21c4a',
 manifestHashes:Object.freeze({'package.json':'cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579','apps/threadplane/package.json':'aa2e1ff97c71ed46de6c1551b4234650ede1093b051d8b967cd1480fc6589edc'}),
 vendorPaths:Object.freeze(['apps/threadplane/node_modules/@angular/build','apps/threadplane/node_modules/@angular/cli','apps/threadplane/node_modules/@angular/common','apps/threadplane/node_modules/@angular/compiler','apps/threadplane/node_modules/@angular/compiler-cli','apps/threadplane/node_modules/@angular/core','apps/threadplane/node_modules/@angular/platform-browser','apps/threadplane/node_modules/@angular/router','apps/threadplane/node_modules/@cacheplane/partial-json','apps/threadplane/node_modules/@cacheplane/partial-markdown','apps/threadplane/node_modules/@json-render/core','apps/threadplane/node_modules/@langchain/core','apps/threadplane/node_modules/@langchain/core/node_modules/langsmith','apps/threadplane/node_modules/@langchain/langgraph-sdk','apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue','apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue/node_modules/p-timeout','apps/threadplane/node_modules/marked','apps/threadplane/node_modules/rxjs','apps/threadplane/node_modules/typescript','apps/threadplane/node_modules/vitest','node_modules/@cfworker/json-schema','node_modules/@langchain/protocol','node_modules/@opentelemetry/api','node_modules/@standard-schema/spec','node_modules/@types/json-schema','node_modules/base64-js','node_modules/commander','node_modules/eventemitter3','node_modules/is-network-error','node_modules/js-tiktoken','node_modules/katex','node_modules/mustache','node_modules/openai','node_modules/p-finally','node_modules/p-queue','node_modules/p-queue/node_modules/eventemitter3','node_modules/p-retry','node_modules/p-timeout','node_modules/react','node_modules/react-dom','node_modules/scheduler','node_modules/tslib','node_modules/undici','node_modules/ws','node_modules/zod']),
});
function absolute(file){need(typeof file==='string'&&path.isAbsolute(file)&&path.resolve(file)===file&&!file.includes('\0'));return file;}
function relative(file){need(typeof file==='string'&&file.length>0&&!path.isAbsolute(file)&&!file.includes('\\')&&!file.includes('\0')&&file.split('/').every(s=>s&&s!=='.'&&s!=='..'));return file;}
async function read(file,cap){
 absolute(file);need(await fs.realpath(file)===file);const before=await fs.lstat(file),keys=['dev','ino','size','mtimeMs','ctimeMs'];need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=cap);
 const fd=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW),chunks=[];let count=0;
 try{const opened=await fd.stat();need(opened.isFile()&&opened.nlink===1&&keys.every(k=>opened[k]===before[k]));
  for(;;){const buffer=Buffer.alloc(Math.min(65536,before.size+1-count));const {bytesRead}=await fd.read(buffer,0,buffer.length,null);if(bytesRead===0)break;count+=bytesRead;need(count<=before.size&&count<=cap);chunks.push(buffer.subarray(0,bytesRead));}
  need(count===before.size);const after=await fd.stat();need(after.nlink===1&&keys.every(k=>after[k]===before[k]));
 }finally{await fd.close();}
 const current=await fs.lstat(file);need(current.isFile()&&!current.isSymbolicLink()&&current.nlink===1&&keys.every(k=>current[k]===before[k])&&await fs.realpath(file)===file);return Buffer.concat(chunks,count);
}
function unpack(bytes){
 const tar=gunzipSync(bytes,{maxOutputLength:67108864}),files=[];let offset=0,total=0,ended=false;
 while(offset+512<=tar.length){const h=tar.subarray(offset,offset+512);offset+=512;if(h.every(b=>b===0)){need(tar.subarray(offset).every(b=>b===0));ended=true;break;}
  const str=(start,end)=>h.subarray(start,end).toString('utf8').split('\0')[0],oct=(start,end)=>{const s=str(start,end).trim();need(/^[0-7]+$/.test(s));return parseInt(s,8);};
  const checksum=oct(148,156);need([...h].reduce((sum,b,i)=>sum+(i>=148&&i<156?32:b),0)===checksum);
  const prefix=str(345,500),name=(prefix?prefix+'/':'')+str(0,100);need(name.startsWith('package/')&&['0',''].includes(str(156,157)));const key=relative(name.slice(8)),size=oct(124,136);need(size<=16777216&&offset+size<=tar.length&&files.length<4096&&(total+=size)<=67108864&&!files.some(f=>f.path===key));
  const data=tar.subarray(offset,offset+size);files.push({path:key,bytes:size,sha256:sha(data),data});offset+=Math.ceil(size/512)*512;
 }need(ended&&files.length>0);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
async function installedInventory(directory){need(await fs.realpath(directory)===directory);const rows=[];let total=0;async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);need(!entry.isSymbolicLink());if(entry.isDirectory())await walk(file);else{need(entry.isFile()&&rows.length<4096);const bytes=await read(file,16777216);need((total+=bytes.length)<=67108864);rows.push({path:path.relative(directory,file).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)});}}}await walk(directory);return rows.sort((a,b)=>a.path.localeCompare(b.path));}
/** Guard I/O is new custody: an attention timeout cannot hide its still-pending original. */
export async function waitThreadplaneLocalBuildOriginalV1(original,wait,ms,label){let pending=true;void original.then(()=>{pending=false;},()=>{pending=false;});try{return await wait(original,ms,label);}catch(error){if(pending){const failure=error instanceof Error?error:Error('threadplane-local-guard-attention',{cause:error});failure.unsafeOutstanding=true;throw failure;}throw error;}}
/** Pinned local-only artifact identity. Ordinary production build evidence remains mandatory. */
export async function createThreadplaneLocalBuildGuardV1({manifestPath,manifestSha256,root=ROOT}){
 absolute(root);need(HEX.test(manifestSha256));const manifestBytes=await read(manifestPath,1048576);need(sha(manifestBytes)===manifestSha256);const m=JSON.parse(manifestBytes);
 exact(m,['schema','role','sourceCommit','benchmarkBaseCommit','baseLockPath','baseLockSha256','selectedLockSha256','artifacts']);
 need(m.schema==='threadplane-local-pack-manifest-v1'&&['current-main-control','render-fix-candidate'].includes(m.role)&&/^[a-f0-9]{40}$/.test(m.sourceCommit)&&m.benchmarkBaseCommit===LOCAL_BUILD_PROFILE_V1.benchmarkBaseCommit&&m.baseLockSha256===LOCAL_BUILD_PROFILE_V1.baseLockSha256&&HEX.test(m.selectedLockSha256));
 if(m.role==='current-main-control')need(m.sourceCommit==='16f356bf1473fd306c97e2083543d392a31d7307');
 need(Array.isArray(m.artifacts)&&m.artifacts.length===5);const seen=new Set();
 for(const a of m.artifacts){exact(a,['name','version','installedPath','resolved','tarballPath','sha256','integrity','files']);need(names.some(n=>a.name==='@threadplane/'+n)&&!seen.has(a.name));seen.add(a.name);need(a.version==='0.3.4'&&a.installedPath===`apps/threadplane/node_modules/${a.name}`&&typeof a.resolved==='string'&&a.resolved.startsWith('file:'));relative(a.resolved.slice(5));absolute(a.tarballPath);need(HEX.test(a.sha256)&&/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(a.integrity)&&Array.isArray(a.files)&&a.files.length>0&&a.files.length<=4096);const keys=new Set();for(const f of a.files){exact(f,['path','bytes','sha256']);relative(f.path);need(!keys.has(f.path)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=16777216&&HEX.test(f.sha256));keys.add(f.path);}a.files.sort((x,y)=>x.path.localeCompare(y.path));}
 const identity=Object.freeze({schema:'threadplane-local-build-identity-v1',role:m.role,sourceCommit:m.sourceCommit,manifestSha256});
 async function verify(build){
  need((await read(manifestPath,1048576)).equals(manifestBytes));const baseBytes=await read(m.baseLockPath,4194304);need(sha(baseBytes)===LOCAL_BUILD_PROFILE_V1.baseLockSha256);const base=JSON.parse(baseBytes),selectedBytes=await read(path.join(root,'package-lock.json'),4194304);need(sha(selectedBytes)===m.selectedLockSha256);const selected=JSON.parse(selectedBytes),expected=structuredClone(base);
  for(const [key,hash] of Object.entries(LOCAL_BUILD_PROFILE_V1.manifestHashes))need(sha(await read(path.join(root,key),1048576))===hash);
  for(const [key,hash] of Object.entries(STOCK034_SOURCE_HASHES_V1))need(sha(await read(path.join(root,key),1048576))===hash&&build?.sourceHashes?.[key]===hash);
  need(build?.production===true&&build.framework?.name==='Angular'&&build.framework.version==='21.2.25'&&build.settings?.optimization===true&&build.settings.sourceMaps===false&&Array.isArray(build.packages)&&build.packages.length===50);
  const vendors=build.packages.filter(p=>!p.name.startsWith('@threadplane/')).sort((a,b)=>a.resolutionPath.localeCompare(b.resolutionPath));need(digest(vendors)===LOCAL_BUILD_PROFILE_V1.vendorClosureSha256);
  for(const a of m.artifacts){const bytes=await read(a.tarballPath,8388608);need(sha(bytes)===a.sha256&&'sha512-'+createHash('sha512').update(bytes).digest('base64')===a.integrity);need((await read(path.join(root,a.resolved.slice(5)),8388608)).equals(bytes));const files=unpack(bytes);need(equal(files.map(({data,...row})=>row),a.files));const packageFile=files.find(f=>f.path==='package.json');need(packageFile);const metadata=JSON.parse(packageFile.data);need(metadata.name===a.name&&metadata.version===a.version);const entry=expected.packages[a.installedPath];need(entry&&entry.version===a.version);for(const key of ['dependencies','optionalDependencies','peerDependencies','peerDependenciesMeta'])need(equal(metadata[key]??{},entry[key]??{}));need(Boolean(entry.hasInstallScript)===Boolean(metadata.scripts?.postinstall));entry.resolved=a.resolved;entry.integrity=a.integrity;
   const rows=build.packages.filter(p=>p.name===a.name);need(rows.length===1&&equal(rows[0],{name:a.name,version:a.version,integrity:a.integrity,resolutionPath:a.installedPath}));need(equal(await installedInventory(path.join(root,a.installedPath)),a.files));
  }need(equal(selected,expected));return build;
 }
 return Object.freeze({identity,verify});
}
