import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {types} from 'node:util';
import {lstat,mkdir,realpath,rename,rm,writeFile,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deriveStock037SelectionV1} from '../threadplane-stock037/select-v1.mjs';
import {stock037PublishedIdentityV1} from '../competitor-comparison/aimock-stock037-v1.mjs';
import {assertLocalSharedSignalsSelectionsReadyV1,localSharedSignalsSelectionIdentityV1,validateLocalSharedSignalsExperimentRecordV1,LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1,LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1} from './fixed-experiment-v1.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,label)=>{if(!v)throw Error('local-shared-signals-selection-'+label);};
const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const json=v=>JSON.stringify(v,null,2)+'\n';
const byteLengthGetter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'length').get,copyTypedBytes=Uint8Array.prototype.set;
function passiveCanonicalInputs(input){
 need(input!==null&&typeof input==='object'&&!types.isProxy(input)&&Object.getPrototypeOf(input)===Object.prototype,'passive-input');const fields=['rootManifestBytes','appManifestBytes','stockLockBytes'],d=Object.getOwnPropertyDescriptors(input);need(Reflect.ownKeys(d).every(k=>typeof k==='string')&&Object.keys(d).sort().join(',')===[...fields].sort().join(',')&&Object.values(d).every(x=>Object.hasOwn(x,'value')),'passive-input-fields');const owned={};
 for(const key of fields){const value=d[key].value;if(typeof value==='string'){need(Buffer.byteLength(value)<=4194304,'input-cap');owned[key]=value;}else{need(!types.isProxy(value)&&Buffer.isBuffer(value)&&Object.getPrototypeOf(value)===Buffer.prototype,'passive-input-bytes');const length=Reflect.apply(byteLengthGetter,value,[]);need(length<=4194304,'input-cap');const copy=Buffer.alloc(length);Reflect.apply(copyTypedBytes,copy,[value]);owned[key]=copy;}}
 return owned;
}
/** Pure model only: synthetic selections never activate production accessors. */
export function deriveLocalSharedSignalsSelectionV1(input,selection){
 need(selection!==null&&typeof selection==='object'&&!types.isProxy(selection)&&!Array.isArray(selection),'passive-selection');const descriptor=Object.getOwnPropertyDescriptor(selection,'role');need(descriptor&&Object.hasOwn(descriptor,'value'),'passive-role');const role=descriptor.value;need(role==='control'||role==='candidate','role');validateLocalSharedSignalsExperimentRecordV1({schema:'threadplane-local-shared-signals-fixed-experiment-v1',experimentId:'local-shared-signals-v1',decisionSha256:'4aeb8b7928090073430b99feb4c708b483c9a76ca6531d1eaba414bfdbf7e68c',version:'0.3.7',controlSourceCommit:LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1,roles:{control:role==='control'?{selection,execution:null}:null,candidate:role==='candidate'?{selection,execution:null}:null}});
 input=passiveCanonicalInputs(input);const registry=deriveStock037SelectionV1(input,stock037PublishedIdentityV1());need(equal(registry.selectedSourceHashes,selection.registry037Inputs),'registry-inputs');
 for(const[key,name]of [['rootManifestBytes','package.json'],['appManifestBytes','apps/threadplane/package.json'],['stockLockBytes','package-lock.json']])need(sha(input[key])===selection.canonicalInputs[name],'canonical-inputs');
 const lock=JSON.parse(registry.selectedLockBytes);
 for(const a of selection.artifacts.filter(a=>LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1.includes(a.name))){const row=lock.packages[`apps/threadplane/node_modules/${a.name}`];need(row?.version==='0.3.7','runtime-row');for(const k of ['dependencies','optionalDependencies','peerDependencies','peerDependenciesMeta'])need(equal(a.manifest[k]??{},row[k]??{}),'manifest-maps');need(Boolean(row.hasInstallScript)===Boolean(a.manifest.scripts?.postinstall),'install-script');row.resolved='file:'+a.relativeTarballPath;row.integrity=a.integrity;}
 const selectedLockBytes=json(lock);return{selection:'local-source-built-shared-signals-037-v1',role,version:'0.3.7',appManifestBytes:registry.appManifestBytes,selectedLockBytes,selectedSourceHashes:{...registry.selectedSourceHashes,'package-lock.json':sha(selectedLockBytes)},artifacts:selection.artifacts,publishedStockEvidence:false};
}
async function checked(file,cap){need(await realpath(file)===file,'regular-path');const before=await lstat(file);need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=cap,'file-cap');const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const opened=await fd.stat();need(opened.dev===before.dev&&opened.ino===before.ino&&opened.size===before.size,'open-identity');const chunks=[];let count=0;for(;;){const chunk=Buffer.alloc(Math.min(65536,before.size+1-count));const{bytesRead}=await fd.read(chunk,0,chunk.length,null);if(bytesRead===0)break;count+=bytesRead;need(count<=before.size&&count<=cap,'read-cap');chunks.push(chunk.subarray(0,bytesRead));}const bytes=Buffer.concat(chunks,count);need(bytes.length===before.size,'read-length');const after=await fd.stat(),current=await lstat(file);need(['dev','ino','size','mtimeMs','ctimeMs','nlink'].every(k=>before[k]===after[k]&&before[k]===current[k]),'read-drift');return bytes;}finally{await fd.close();}}
export async function selectLocalSharedSignalsDependenciesV1(args){
 assertLocalSharedSignalsSelectionsReadyV1();
 need(Array.isArray(args)&&args.length===6&&args[0]==='--role'&&args[2]==='--root'&&args[4]==='--expected-checkout','arguments');
 const[,_role,,root,,expectedCheckout]=args,s=localSharedSignalsSelectionIdentityV1(_role);const fixedRoot=_role==='control'?'/private/tmp/chat-ui-bench-shared-signals-control-native-20261107-invocation01':'/private/tmp/chat-ui-bench-shared-signals-candidate-native-20261107-invocation01';need(root===fixedRoot,'fixed-root');need(typeof root==='string'&&path.isAbsolute(root)&&path.resolve(root)===root&&await realpath(root)===root&&/^[a-f0-9]{40}$/.test(expectedCheckout),'arguments');
 const git=(...argv)=>execFileSync('git',argv,{cwd:root,encoding:'utf8',maxBuffer:4194304,timeout:10000}).trim();need(git('rev-parse','HEAD')===expectedCheckout&&git('rev-parse','--show-toplevel')===root&&git('status','--porcelain')==='','checkout');need(['git@github.com:cacheplane/chat-ui-bench.git','https://github.com/cacheplane/chat-ui-bench.git'].includes(git('remote','get-url','origin')),'origin');
 const readInputs=async()=>({rootManifestBytes:await checked(path.join(root,'package.json'),1048576),appManifestBytes:await checked(path.join(root,'apps/threadplane/package.json'),1048576),stockLockBytes:await checked(path.join(root,'package-lock.json'),4194304)}),input=await readInputs(),result=deriveLocalSharedSignalsSelectionV1(input,s);
 need(equal(result.selectedSourceHashes,s.selectedSourceHashes),'fixed-selected-hashes');
 const tarballs=[];for(const a of s.artifacts){const bytes=await checked(a.sourceRef.path,8388608);need(bytes.length===a.bytes&&sha(bytes)===a.sha256&&a.sourceRef.sha256===a.sha256&&'sha512-'+createHash('sha512').update(bytes).digest('base64')===a.integrity,'tarball-source');tarballs.push(bytes);}
 const transaction=path.join(root,'.threadplane-local-shared-signals-selection');await mkdir(transaction,{mode:0o700});let retain=false;
 try{
  await writeFile(path.join(transaction,'original-app.json'),input.appManifestBytes,{flag:'wx',mode:0o600});await writeFile(path.join(transaction,'original-lock.json'),input.stockLockBytes,{flag:'wx',mode:0o600});
  await mkdir(path.join(root,'local-packages'),{mode:0o700});await mkdir(path.join(root,'local-packages/local-shared-signals'),{mode:0o700});await mkdir(path.join(root,`local-packages/local-shared-signals/${_role}`),{mode:0o700});
  for(let i=0;i<s.artifacts.length;i++){const a=s.artifacts[i],destination=path.join(root,a.relativeTarballPath);await writeFile(destination,tarballs[i],{flag:'wx',mode:0o400});need((await checked(destination,8388608)).equals(tarballs[i])&&(await checked(a.sourceRef.path,8388608)).equals(tarballs[i]),'copied-tarball');}
  await writeFile(path.join(transaction,'app.json'),result.appManifestBytes,{flag:'wx',mode:0o600});await writeFile(path.join(transaction,'lock.json'),result.selectedLockBytes,{flag:'wx',mode:0o600});
  const current=await readInputs();need(Object.keys(input).every(k=>input[k].equals(current[k])),'changed-inputs');
  await rename(path.join(transaction,'app.json'),path.join(root,'apps/threadplane/package.json'));
  try{await rename(path.join(transaction,'lock.json'),path.join(root,'package-lock.json'));}catch(error){try{await rename(path.join(transaction,'original-app.json'),path.join(root,'apps/threadplane/package.json'));}catch(rollback){throw new AggregateError([error,rollback],'local-shared-signals-selection-lock-and-rollback-failed');}throw error;}
  const after=await readInputs();need(Object.entries(result.selectedSourceHashes).every(([key,hash])=>sha(key==='package.json'?after.rootManifestBytes:key==='package-lock.json'?after.stockLockBytes:after.appManifestBytes)===hash),'publication');
  return{schema:'threadplane-local-shared-signals-selection-v1',role:_role,checkout:expectedCheckout,sourceCommit:s.sourceCommit,selectedSourceHashes:result.selectedSourceHashes,tarballs:6,runtimePackages:5,publishedStockEvidence:false,requiredNext:'ordinary npm ci, genuine production build, closed preparation reader and independently reviewed execution activation'};
 }catch(error){retain=true;throw error;}finally{if(!retain)await rm(transaction,{recursive:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await selectLocalSharedSignalsDependenciesV1(process.argv.slice(2))));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}}
