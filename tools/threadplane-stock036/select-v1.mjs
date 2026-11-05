import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstat,mkdir,readFile,realpath,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {STOCK034_INTEGRITIES_V1} from '../competitor-comparison/aimock-stock034-v1.mjs';
import {validateStock036PinsV1,stock036PublishedIdentityV1} from '../competitor-comparison/aimock-stock036-v1.mjs';

const hashes=Object.freeze({rootManifestBytes:'cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579',appManifestBytes:'aa2e1ff97c71ed46de6c1551b4234650ede1093b051d8b967cd1480fc6589edc',stockLockBytes:'e7cddcd2aa8a768818b1c513b818759c9094b4b07bbd01df4fb9ca1b6eb5cef4'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(value,label)=>{if(!value)throw Error('stock036-selection-'+label);};
const json=value=>JSON.stringify(value,null,2)+'\n';

/** Pure derivation model. It never installs, writes files or grants stock/build
 * admission. The real selector below supplies its fixed published source pin. */
export function deriveStock036SelectionV1(input,publishedPins){
 const pins=validateStock036PinsV1(publishedPins);
 need(input&&Object.keys(input).sort().join(',')===Object.keys(hashes).sort().join(','),'inputs');
 for(const[key,expected]of Object.entries(hashes))need((typeof input[key]==='string'||Buffer.isBuffer(input[key]))&&sha(input[key])===expected,'source-hash-'+key);
 const root=JSON.parse(input.rootManifestBytes),app=JSON.parse(input.appManifestBytes),lock=JSON.parse(input.stockLockBytes);
 need(lock.lockfileVersion===3&&!Object.hasOwn(lock,'threadplaneModifiedDependencies'),'source-lock');
 const names=pins.packages.map(p=>p.name),currentPins=Object.keys(app.dependencies??{}).filter(n=>n.startsWith('@threadplane/')).sort();need(JSON.stringify(currentPins)===JSON.stringify([...names].sort()),'app-packages');
 for(const pin of pins.packages){
  const key=`apps/threadplane/node_modules/${pin.name}`,entry=lock.packages?.[key],short=pin.name.slice('@threadplane/'.length);
  need(app.dependencies[pin.name]==='0.3.4'&&lock.packages?.['apps/threadplane']?.dependencies?.[pin.name]==='0.3.4'&&entry?.version==='0.3.4'&&entry.integrity===STOCK034_INTEGRITIES_V1[pin.name]&&entry.resolved===`https://registry.npmjs.org/${pin.name}/-/${short}-0.3.4.tgz`,'source-package');
  app.dependencies[pin.name]='0.3.6';lock.packages['apps/threadplane'].dependencies[pin.name]='0.3.6';entry.version='0.3.6';entry.resolved=pin.resolved;entry.integrity=pin.integrity;
  for(const kind of ['dependencies','peerDependencies','optionalDependencies'])for(const[name,range]of Object.entries(entry[kind]??{}))if(names.includes(name)){need(range==='0.3.4'||range==='^0.3.4','source-internal-range');entry[kind][name]=range.replace('0.3.4','0.3.6');}
 }
 need(JSON.stringify(lock.packages[''].dependencies)===JSON.stringify(root.dependencies),'root-relationships');
 const appManifestBytes=json(app),selectedLockBytes=json(lock);
 return{selection:'registry-stock036-v1',version:'0.3.6',appManifestBytes,selectedLockBytes,sourceRootManifestSha256:sha(input.rootManifestBytes),sourceAppManifestSha256:sha(input.appManifestBytes),sourceLockSha256:sha(input.stockLockBytes),selectedAppManifestSha256:sha(appManifestBytes),selectedLockSha256:sha(selectedLockBytes),selectedSourceHashes:{'package.json':sha(input.rootManifestBytes),'apps/threadplane/package.json':sha(appManifestBytes),'package-lock.json':sha(selectedLockBytes)},pins:pins.packages,publishedStockEvidence:false};
}
async function regularFile(root,name){
 const parts=name.split('/');for(let i=1;i<=parts.length;i++){const stat=await lstat(path.join(root,...parts.slice(0,i)));need(i===parts.length?stat.isFile():stat.isDirectory(),'regular-path');}
 return readFile(path.join(root,name),'utf8');
}
/** Explicit disposable-checkout operation. No caller pin/verification override. */
export async function selectStock036DependenciesV1(root,expectedCheckout){
 const publishedPins=stock036PublishedIdentityV1(); // no writes before real immutable identity exists
 need(typeof root==='string'&&path.isAbsolute(root)&&path.resolve(root)===root&&await realpath(root)===root&&/^[a-f0-9]{40}$/.test(expectedCheckout),'arguments');
 const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();need(checkout===expectedCheckout,'checkout');
 const readInputs=async()=>({rootManifestBytes:await regularFile(root,'package.json'),appManifestBytes:await regularFile(root,'apps/threadplane/package.json'),stockLockBytes:await regularFile(root,'package-lock.json')});
 const input=await readInputs(),result=deriveStock036SelectionV1(input,publishedPins),transaction=path.join(root,'.threadplane-stock036-selection');
 need(Object.entries(result.selectedSourceHashes).every(([key,hash])=>publishedPins.selectedSourceHashes[key]===hash),'fixed-selected-source');
 await mkdir(transaction,{mode:0o700});let keep=false;
 try{
  await writeFile(path.join(transaction,'original-app.json'),input.appManifestBytes,{flag:'wx',mode:0o600});await writeFile(path.join(transaction,'original-lock.json'),input.stockLockBytes,{flag:'wx',mode:0o600});
  await writeFile(path.join(transaction,'app.json'),result.appManifestBytes,{flag:'wx',mode:0o600});await writeFile(path.join(transaction,'lock.json'),result.selectedLockBytes,{flag:'wx',mode:0o600});
  need(JSON.stringify(await readInputs())===JSON.stringify(input),'changed-inputs');
  await rename(path.join(transaction,'app.json'),path.join(root,'apps/threadplane/package.json'));
  try{await rename(path.join(transaction,'lock.json'),path.join(root,'package-lock.json'));}catch(error){try{await rename(path.join(transaction,'original-app.json'),path.join(root,'apps/threadplane/package.json'));}catch(rollback){keep=true;throw new AggregateError([error,rollback],'stock036-selection-lock-and-rollback-failed');}throw error;}
  const after=await readInputs();need(after.rootManifestBytes===input.rootManifestBytes&&after.appManifestBytes===result.appManifestBytes&&after.stockLockBytes===result.selectedLockBytes,'publication');
  return{schema:'registry-stock036-selection-v1',checkout,selection:result.selection,version:result.version,sourceRootManifestSha256:result.sourceRootManifestSha256,sourceAppManifestSha256:result.sourceAppManifestSha256,sourceLockSha256:result.sourceLockSha256,selectedAppManifestSha256:result.selectedAppManifestSha256,selectedLockSha256:result.selectedLockSha256,pins:result.pins,publishedStockEvidence:false,requiredNext:'ordinary npm ci, genuine production build and default035guard; selection alone is not stock admission'};
 }catch(error){keep=true;throw error;}finally{if(!keep)await rm(transaction,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{need(process.argv.length===6&&process.argv[2]==='--root'&&process.argv[4]==='--expected-checkout','arguments');console.log(JSON.stringify(await selectStock036DependenciesV1(process.argv[3],process.argv[5])));}catch(error){console.error(String(error?.message??error));process.exitCode=1;}
}
