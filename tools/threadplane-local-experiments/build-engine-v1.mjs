import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFile} from 'node:child_process';
import {promisify,types} from 'node:util';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {probeRecordKey} from '../../apps/threadplane/probe-provenance.mjs';
import {STOCK034_SOURCE_HASHES_V1 as STOCK037_SOURCE_HASHES_V1} from '../competitor-comparison/aimock-stock034-v1.mjs';
import {validateLocalSharedSignalsInstallTransformV1} from '../competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs';
import * as sharedSignalsFixed from '../threadplane-local-shared-signals/fixed-experiment-v1.mjs';
import {SHARED_SIGNALS_POLICY_V1,OWNED_MARKDOWN_POLICY_V1,OWNED_MARKDOWN_POLICY_V2,POSTFIX_DIAGNOSTIC_POLICY_V1} from './closed-policies-v1.mjs';
import * as ownedMarkdownFixed from '../threadplane-local-owned-markdown/fixed-experiment-v1.mjs';
import * as ownedMarkdownV2Fixed from '../threadplane-local-owned-markdown/fixed-experiment-v2.mjs';
import * as postfixFixed from '../threadplane-local-postfix-diagnostic/fixed-experiment-v1.mjs';
// Policy handles and factories are private to this module instance.
const bindings=new WeakMap();
const sharedSignalsHandle=Object.freeze({});
bindings.set(sharedSignalsHandle,Object.freeze({policy:SHARED_SIGNALS_POLICY_V1,assertLocalSharedSignalsSelectionsReadyV1:sharedSignalsFixed.assertLocalSharedSignalsSelectionsReadyV1,assertLocalSharedSignalsExecutionsReadyV1:sharedSignalsFixed.assertLocalSharedSignalsExecutionsReadyV1,localSharedSignalsSelectionIdentityV1:sharedSignalsFixed.localSharedSignalsSelectionIdentityV1,localSharedSignalsExecutionIdentityV1:sharedSignalsFixed.localSharedSignalsExecutionIdentityV1,localSharedSignalsDigestV1:sharedSignalsFixed.localSharedSignalsDigestV1,localSharedSignalsRoleRootV1:sharedSignalsFixed.localSharedSignalsRoleRootV1,localSharedSignalsGitExecutableV1:sharedSignalsFixed.localSharedSignalsGitExecutableV1,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1:sharedSignalsFixed.LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1}));
const ownedMarkdownHandle=Object.freeze({});
bindings.set(ownedMarkdownHandle,Object.freeze({policy:OWNED_MARKDOWN_POLICY_V1,assertLocalSharedSignalsSelectionsReadyV1:ownedMarkdownFixed.assertLocalOwnedMarkdownSelectionsReadyV1,assertLocalSharedSignalsExecutionsReadyV1:ownedMarkdownFixed.assertLocalOwnedMarkdownExecutionsReadyV1,localSharedSignalsSelectionIdentityV1:ownedMarkdownFixed.localOwnedMarkdownSelectionIdentityV1,localSharedSignalsExecutionIdentityV1:ownedMarkdownFixed.localOwnedMarkdownExecutionIdentityV1,localSharedSignalsDigestV1:ownedMarkdownFixed.localOwnedMarkdownDigestV1,localSharedSignalsRoleRootV1:ownedMarkdownFixed.localOwnedMarkdownRoleRootV1,localSharedSignalsGitExecutableV1:ownedMarkdownFixed.localOwnedMarkdownGitExecutableV1,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1:ownedMarkdownFixed.LOCAL_OWNED_MARKDOWN_RUNTIME_NAMES_V1}));
const ownedMarkdownV2Handle=Object.freeze({});
bindings.set(ownedMarkdownV2Handle,Object.freeze({policy:OWNED_MARKDOWN_POLICY_V2,assertLocalSharedSignalsSelectionsReadyV1:ownedMarkdownV2Fixed.assertLocalOwnedMarkdownSelectionsReadyV2,assertLocalSharedSignalsExecutionsReadyV1:ownedMarkdownV2Fixed.assertLocalOwnedMarkdownExecutionsReadyV2,localSharedSignalsSelectionIdentityV1:ownedMarkdownV2Fixed.localOwnedMarkdownSelectionIdentityV2,localSharedSignalsExecutionIdentityV1:ownedMarkdownV2Fixed.localOwnedMarkdownExecutionIdentityV2,localSharedSignalsDigestV1:ownedMarkdownV2Fixed.localOwnedMarkdownDigestV2,localSharedSignalsRoleRootV1:ownedMarkdownV2Fixed.localOwnedMarkdownRoleRootV2,localSharedSignalsGitExecutableV1:ownedMarkdownV2Fixed.localOwnedMarkdownGitExecutableV2,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1:ownedMarkdownV2Fixed.LOCAL_OWNED_MARKDOWN_RUNTIME_NAMES_V2}));
const postfixHandle=Object.freeze({});
bindings.set(postfixHandle,Object.freeze({policy:POSTFIX_DIAGNOSTIC_POLICY_V1,assertLocalSharedSignalsSelectionsReadyV1:postfixFixed.assertLocalPostfixSelectionsReadyV1,localSharedSignalsSelectionIdentityV1:postfixFixed.localPostfixSelectionIdentityV1,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1:postfixFixed.LOCAL_POSTFIX_RUNTIME_NAMES_V1,assertLocalSharedSignalsExecutionsReadyV1:postfixFixed.assertLocalPostfixExecutionsReadyV1,localSharedSignalsExecutionIdentityV1:postfixFixed.localPostfixExecutionIdentityV1,localSharedSignalsDigestV1:postfixFixed.localPostfixDigestV1,localSharedSignalsRoleRootV1:postfixFixed.localPostfixRoleRootV1,localSharedSignalsGitExecutableV1:postfixFixed.localPostfixGitExecutableV1}));
function createBuildEngine(handle){
 const binding=bindings.get(handle);if(!binding)throw Error('closed-local-policy');
 const {policy,assertLocalSharedSignalsSelectionsReadyV1,assertLocalSharedSignalsExecutionsReadyV1,localSharedSignalsSelectionIdentityV1,localSharedSignalsExecutionIdentityV1,localSharedSignalsDigestV1,localSharedSignalsRoleRootV1,localSharedSignalsGitExecutableV1,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1}=binding;
const ROOT=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=v=>{if(!v)throw Error((policy.prefix+'-build-identity'));};
const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
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
function inspectLocalSharedSignalsTarV1(bytes){
 const tar=gunzipSync(bytes,{maxOutputLength:67108864}),files=[];let offset=0,total=0,ended=false;
 while(offset+512<=tar.length){const h=tar.subarray(offset,offset+512);offset+=512;if(h.every(b=>b===0)){need(tar.subarray(offset).every(b=>b===0));ended=true;break;}
  const str=(start,end)=>h.subarray(start,end).toString('utf8').split('\0')[0],oct=(start,end)=>{const s=str(start,end).trim();need(/^[0-7]+$/.test(s));return parseInt(s,8);};
  const checksum=oct(148,156);need([...h].reduce((sum,b,i)=>sum+(i>=148&&i<156?32:b),0)===checksum);
  const prefix=str(345,500),name=(prefix?prefix+'/':'')+str(0,100);need(name.startsWith('package/')&&['0',''].includes(str(156,157)));const key=relative(name.slice(8)),size=oct(124,136);need(size<=16777216&&offset+size<=tar.length&&files.length<4096&&(total+=size)<=67108864&&!files.some(f=>f.path===key));
  const data=tar.subarray(offset,offset+size);files.push({path:key,bytes:size,sha256:sha(data),data});offset+=Math.ceil(size/512)*512;
 }need(ended&&files.length>0);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
async function installedInventory(directory,expectedFiles){
 need(await fs.realpath(directory)===directory&&Array.isArray(expectedFiles)&&expectedFiles.length>0&&expectedFiles.length<=4096);
 const allowedFiles=new Set(),allowedDirectories=new Set();
 for(const f of expectedFiles){relative(f.path);const parts=f.path.split('/');need(parts.length<=32&&!allowedFiles.has(f.path));allowedFiles.add(f.path);for(let i=1;i<parts.length;i++){allowedDirectories.add(parts.slice(0,i).join('/'));need(allowedDirectories.size<=4096);}}
 need([...allowedDirectories].every(key=>!allowedFiles.has(key)));const rows=[];let total=0,entries=0;
 async function walk(dir,depth){need(depth<=32&&await fs.realpath(dir)===dir);const before=await fs.lstat(dir);need(before.isDirectory()&&!before.isSymbolicLink());const stream=await fs.opendir(dir,{bufferSize:32});
  for await(const entry of stream){need(++entries<=8192&&!entry.isSymbolicLink());const file=path.join(dir,entry.name),key=path.relative(directory,file).split(path.sep).join('/');if(entry.isDirectory()){need(allowedDirectories.has(key));await walk(file,depth+1);}else{need(entry.isFile()&&allowedFiles.has(key)&&rows.length<4096);const bytes=await read(file,16777216);need((total+=bytes.length)<=67108864);rows.push({path:key,bytes:bytes.length,sha256:sha(bytes)});}}
  const after=await fs.lstat(dir);need(after.isDirectory()&&before.dev===after.dev&&before.ino===after.ino&&await fs.realpath(dir)===dir);
 }
 await walk(directory,0);need(rows.length===allowedFiles.size);return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
/** Attention never fabricates original settlement or changes a failed outcome. */
async function waitLocalSharedSignalsOriginalV1(original,wait,ms,label){
 let state='pending',actualValue,actualError;void original.then(v=>{state='fulfilled';actualValue=v;},e=>{state='rejected';actualError=e;});
 try{await wait(original,ms,label);if(state==='pending'){const e=Error((policy.prefix+'-original-not-settled'));e.unsafeOutstanding=true;throw e;}if(state==='rejected')throw actualError;return actualValue;}catch(error){if(state==='pending'){const e=error instanceof Error?error:Error((policy.prefix+'-attention'),{cause:error});e.unsafeOutstanding=true;throw e;}if(state==='rejected')throw actualError;throw error;}
}
async function fixedBaseInputs(selection){
 const execute=promisify(execFile),result={};
 for(const[key,name]of [['rootManifestBytes','package.json'],['appManifestBytes','apps/threadplane/package.json'],['stockLockBytes','package-lock.json']]){const{stdout}=await execute(localSharedSignalsGitExecutableV1(),['show',`${selection.benchmarkBaseCommit}:${name}`],{cwd:ROOT,encoding:'buffer',maxBuffer:4194304,timeout:10000});need(sha(stdout)===selection.canonicalInputs[name]);result[key]=stdout;}
 return result;
}
async function collectActual(role){
 const s=localSharedSignalsSelectionIdentityV1(role);
 const fixedRoot=role==='control'?policy.roots.control:policy.roots.candidate;
 need(ROOT===fixedRoot&&await fs.realpath(ROOT)===ROOT);
 const selector=await import(new URL('../../'+policy.selectorModule,import.meta.url));const deriveLocalSharedSignalsSelectionV1=selector[policy.deriveExport];
 const derived=deriveLocalSharedSignalsSelectionV1(await fixedBaseInputs(s),s);
 const refs=[];for(const ref of s.sourceProofRefs){const bytes=await read(ref.path,Math.min(8388608,ref.bytes));need(bytes.length===ref.bytes&&sha(bytes)===ref.sha256);refs.push(ref);}
 need(refs.some(r=>r.sha256===s.sourceProofSha256));
 for(const[key,hash]of Object.entries(s.selectedSourceHashes))need(sha(await read(path.join(ROOT,key),4194304))===hash);
 const actualLock=JSON.parse(await read(path.join(ROOT,'package-lock.json'),4194304));need(equal(actualLock,JSON.parse(derived.selectedLockBytes)));
 const tarballRefs=[],installedInventoryDigests={},installedInventories={},installTransformWitnesses=[];
 for(const a of s.artifacts){const source=await read(a.sourceRef.path,8388608),bytes=await read(path.join(ROOT,a.relativeTarballPath),8388608);need(source.equals(bytes)&&bytes.length===a.bytes&&sha(bytes)===a.sha256&&'sha512-'+createHash('sha512').update(bytes).digest('base64')===a.integrity);const inventory=inspectLocalSharedSignalsTarV1(bytes);need(equal(inventory.map(({data,...r})=>r),a.files));const metadata=JSON.parse(inventory.find(f=>f.path==='package.json').data);need(equal(metadata,a.manifest));tarballRefs.push({path:a.relativeTarballPath,bytes:bytes.length,sha256:sha(bytes)});
  if(LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1.includes(a.name)){const key=`apps/threadplane/node_modules/${a.name}`,row=actualLock.packages[key];need(row.version==='0.3.7'&&row.resolved==='file:'+a.relativeTarballPath&&row.integrity===a.integrity);for(const k of ['dependencies','optionalDependencies','peerDependencies','peerDependenciesMeta'])need(equal(metadata[k]??{},row[k]??{}));need(Boolean(row.hasInstallScript)===Boolean(metadata.scripts?.postinstall));const installed=await installedInventory(path.join(ROOT,key),a.files);
   if(['@threadplane/chat','@threadplane/langgraph','@threadplane/render'].includes(a.name)){
    const modulePath='.install-collector/development-install.mjs',tarModule=inventory.find(f=>f.path===modulePath);need(tarModule);
    const installedModule=await read(path.join(ROOT,key,modulePath),74);
    installTransformWitnesses.push(validateLocalSharedSignalsInstallTransformV1({name:a.name,version:a.version,path:modulePath,postinstall:metadata.scripts?.postinstall,tarInventory:a.files,installedInventory:installed,tarModuleBytes:tarModule.data,installedModuleBytes:installedModule}));
   }else need(equal(installed,a.files));
   installedInventories[key]=installed;installedInventoryDigests[key]=localSharedSignalsDigestV1(installed);}
 }
 const raw=await read(path.join(ROOT,'apps/threadplane/.build-evidence.json'),1048576),probe=await read(path.join(ROOT,probeRecordKey),1048576),build=await threadplaneBuildEvidence();
 need(build.production===true&&build.framework.name==='Angular'&&build.framework.version==='21.2.25'&&build.settings.optimization===true&&build.settings.sourceMaps===false&&build.packages.length===50);
 for(const[k,h]of Object.entries({...STOCK037_SOURCE_HASHES_V1,...s.selectedSourceHashes}))need(build.sourceHashes[k]===h);
 const vendors=build.packages.filter(p=>!p.name.startsWith('@threadplane/')).sort((a,b)=>a.resolutionPath.localeCompare(b.resolutionPath));need(vendors.length===45&&localSharedSignalsDigestV1(vendors)===s.vendorPackagesSha256);
 const selected=build.packages.filter(p=>p.name.startsWith('@threadplane/'));need(selected.length===5);
 for(const a of s.artifacts.filter(a=>LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1.includes(a.name)))need(selected.some(p=>equal(p,{name:a.name,version:'0.3.7',integrity:a.integrity,resolutionPath:`apps/threadplane/node_modules/${a.name}`})));
 need(equal(JSON.parse(raw),build));
 return{schema:policy.schemas.preparation,role,selectionDigest:localSharedSignalsDigestV1(s),sourceCommit:s.sourceCommit,selectedSourceHashes:s.selectedSourceHashes,tarballRefs,installedInventories,installedInventoryDigests,installTransformWitnesses,vendorPackagesSha256:s.vendorPackagesSha256,buildRecordRef:{path:'apps/threadplane/.build-evidence.json',bytes:raw.length,sha256:sha(raw)},parsedBuildSha256:localSharedSignalsDigestV1(build),probeRecordRef:{path:probeRecordKey,bytes:probe.length,sha256:sha(probe)},build};
}
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
/** Selection-only actual facts; this never returns execution or stock admission. */
async function readLocalSharedSignalsPreparationFactsV1(role){assertLocalSharedSignalsSelectionsReadyV1();localSharedSignalsSelectionIdentityV1(role);const before=await collectActual(role),after=await collectActual(role);need(equal(before,after)&&Buffer.byteLength(JSON.stringify(after,null,2)+'\n')<=1048576);return freeze(after);}
async function createLocalSharedSignalsBuildGuardV1(role){
 assertLocalSharedSignalsExecutionsReadyV1();const s=localSharedSignalsSelectionIdentityV1(role),e=localSharedSignalsExecutionIdentityV1(role),toolingSourceHashes=await snapshotToolingSources();
 need(ROOT===localSharedSignalsRoleRootV1(role));
 const identity=freeze({schema:policy.schemas.build,experimentId:policy.id,role,sourceCommit:s.sourceCommit,sourceTree:s.sourceTree,fixedRoot:ROOT,selectionDigest:localSharedSignalsDigestV1(s),executionDigest:localSharedSignalsDigestV1(e),toolingSourceHashes,label:policy.label,stock:false});
 async function verify(build){assertLocalSharedSignalsToolingBookendsV1(await snapshotToolingSources(),toolingSourceHashes);const facts=await readLocalSharedSignalsPreparationFactsV1(role);assertLocalSharedSignalsToolingBookendsV1(await snapshotToolingSources(),toolingSourceHashes);return assertLocalSharedSignalsExecutionFactsV1(facts,e,build);}
 return Object.freeze({identity,verify});
}

/** Pure join model only. Production guard always obtains actual closed reader facts. */
function assertLocalSharedSignalsExecutionFactsV1(facts,e,build){need(facts!==null&&typeof facts==='object'&&!types.isProxy(facts)&&Object.getPrototypeOf(facts)===Object.prototype&&Object.getOwnPropertyDescriptor(facts,'schema')?.value===policy.schemas.preparation);need(equal(facts.build,build)&&facts.buildRecordRef.bytes===e.buildRecordBytes&&facts.buildRecordRef.sha256===e.buildRecordSha256&&facts.parsedBuildSha256===e.parsedBuildSha256&&facts.probeRecordRef.sha256===e.probeRecordSha256&&sha(Buffer.from(JSON.stringify(facts,null,2)+'\n'))===e.preparationProofSha256);return build;}

const TOOLING_KEYS=policy.toolingKeys;
function validToolingHashes(value){need(value!==null&&typeof value==='object'&&!types.isProxy(value)&&!Array.isArray(value));const d=Object.getOwnPropertyDescriptors(value);need(Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(d).every(k=>typeof k==='string'));need(Object.keys(d).sort().join(',')===[...TOOLING_KEYS].sort().join(',')&&Object.values(d).every(x=>Object.hasOwn(x,'value')&&typeof x.value==='string'&&/^[a-f0-9]{64}$/.test(x.value)));}
/** Pure strict join, not initial code authority. Controller declaration owns pre-load hashes. */
function assertLocalSharedSignalsToolingBookendsV1(actual,expected){validToolingHashes(actual);validToolingHashes(expected);need(TOOLING_KEYS.every(key=>actual[key]===expected[key]));}
async function snapshotToolingSources(){const hashes={};for(const key of TOOLING_KEYS)hashes[key]=sha(await read(path.join(ROOT,key),1048576));return Object.freeze(hashes);}

 return Object.freeze({inspectLocalSharedSignalsTarV1,waitLocalSharedSignalsOriginalV1,readLocalSharedSignalsPreparationFactsV1,createLocalSharedSignalsBuildGuardV1,assertLocalSharedSignalsExecutionFactsV1,assertLocalSharedSignalsToolingBookendsV1});
}
const sharedSignals=createBuildEngine(sharedSignalsHandle);
export const inspectSharedSignalsTarV1=sharedSignals.inspectLocalSharedSignalsTarV1;
export const waitSharedSignalsOriginalV1=sharedSignals.waitLocalSharedSignalsOriginalV1;
export const readSharedSignalsPreparationFactsV1=sharedSignals.readLocalSharedSignalsPreparationFactsV1;
export const createSharedSignalsBuildGuardV1=sharedSignals.createLocalSharedSignalsBuildGuardV1;
export const assertSharedSignalsExecutionFactsV1=sharedSignals.assertLocalSharedSignalsExecutionFactsV1;
export const assertSharedSignalsToolingBookendsV1=sharedSignals.assertLocalSharedSignalsToolingBookendsV1;

const ownedMarkdown=createBuildEngine(ownedMarkdownHandle);
export const inspectOwnedMarkdownTarV1=ownedMarkdown.inspectLocalSharedSignalsTarV1;
export const waitOwnedMarkdownOriginalV1=ownedMarkdown.waitLocalSharedSignalsOriginalV1;
export const readOwnedMarkdownPreparationFactsV1=ownedMarkdown.readLocalSharedSignalsPreparationFactsV1;
export const createOwnedMarkdownBuildGuardV1=ownedMarkdown.createLocalSharedSignalsBuildGuardV1;
export const assertOwnedMarkdownExecutionFactsV1=ownedMarkdown.assertLocalSharedSignalsExecutionFactsV1;
export const assertOwnedMarkdownToolingBookendsV1=ownedMarkdown.assertLocalSharedSignalsToolingBookendsV1;

const ownedMarkdownV2=createBuildEngine(ownedMarkdownV2Handle);
export const inspectOwnedMarkdownTarV2=ownedMarkdownV2.inspectLocalSharedSignalsTarV1;
export const waitOwnedMarkdownOriginalV2=ownedMarkdownV2.waitLocalSharedSignalsOriginalV1;
export const readOwnedMarkdownPreparationFactsV2=ownedMarkdownV2.readLocalSharedSignalsPreparationFactsV1;
export const createOwnedMarkdownBuildGuardV2=ownedMarkdownV2.createLocalSharedSignalsBuildGuardV1;
export const assertOwnedMarkdownExecutionFactsV2=ownedMarkdownV2.assertLocalSharedSignalsExecutionFactsV1;
export const assertOwnedMarkdownToolingBookendsV2=ownedMarkdownV2.assertLocalSharedSignalsToolingBookendsV1;

const postfix=createBuildEngine(postfixHandle);
export const inspectPostfixTarV1=postfix.inspectLocalSharedSignalsTarV1;
export const waitPostfixOriginalV1=postfix.waitLocalSharedSignalsOriginalV1;
export const readPostfixPreparationFactsV1=postfix.readLocalSharedSignalsPreparationFactsV1;
export const createPostfixBuildGuardV1=postfix.createLocalSharedSignalsBuildGuardV1;
export const assertPostfixExecutionFactsV1=postfix.assertLocalSharedSignalsExecutionFactsV1;
export const assertPostfixToolingBookendsV1=postfix.assertLocalSharedSignalsToolingBookendsV1;
