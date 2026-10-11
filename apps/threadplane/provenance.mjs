import {readdir,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
import {collectResolvedPackages,checkedRead,checkedJSON,checkedPath,containedKey,packagePath} from './dependency-closure.mjs';
import {commonBuildKeys,contractSourceKeys,contractCompiledKeys,snapshotFiles,hashes,assertFactsUnchanged,loadContract,workspaceRoot} from './probe-provenance.mjs';
async function files(root,directory){
 const before=await checkedPath(root,directory,undefined,{directory:true}),names=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())names.push(...await files(root,path));else if(entry.isFile()){await checkedPath(root,path);names.push(path);}else throw new Error(`Unexpected build entry ${path}`);}
 const after=await checkedPath(root,directory,undefined,{directory:true});assertFactsUnchanged(after,before,'Inventory directory');return names.sort();
}
export function productionSettings(configuration){
 const build=configuration.projects.threadplane.architect.build,production=build.configurations.production;
 if(build.options.aot!==true||production.optimization!==true||production.sourceMap!==false||production.outputHashing!=='all'||configuration.cli.analytics!==false)throw new Error('Production build configuration differs from declared profile');
 return {optimization:production.optimization,sourceMaps:production.sourceMap};
}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
export function assertBuildMatches(current,recorded){if(JSON.stringify(stable(current))!==JSON.stringify(stable(recorded)))throw new Error('Current source, dependencies or assets differ from the recorded production build; rebuild before capture');}
export async function productSourceKeys(root=workspaceRoot){root=await realpath(root);return [...commonBuildKeys,...contractSourceKeys,...(await files(root,join(root,'apps/threadplane/src'))).filter(path=>!path.endsWith('.test.ts')).map(path=>containedKey(root,path))].sort();}
export async function snapshotProductInputs(root=workspaceRoot){
 root=await realpath(root);const app=join(root,'apps/threadplane');
 const appRequire=createRequire(join(app,'package.json'));
 const angularCore=await packagePath('@angular/core',join(app,'package.json'));await checkedPath(root,angularCore);
 for(const name of ['@threadplane/chat','@threadplane/langgraph','@threadplane/render','@threadplane/telemetry']){
  const metadata=await packagePath(name,join(app,'package.json'));await checkedPath(root,metadata);
  const entry=await realpath(appRequire.resolve(name));containedKey(dirname(metadata),entry);
  if(await packagePath('@angular/core',entry)!==angularCore)throw new Error(`Duplicate Angular core instance for ${name}; dedupe and rebuild`);
 }
 const configuration=await checkedJSON(root,join(app,'angular.json'));
 const settings=productionSettings(configuration);
 const packages=await collectResolvedPackages(root,join(app,'package.json'));
 const facts=await snapshotFiles(root,await productSourceKeys(root));
 const metadata=await snapshotFiles(root,packages.map(p=>`${p.resolutionPath}/package.json`));
 return {facts,metadata,packages,settings};
}
export async function assertProductInputsUnchanged(root,expected){assertFactsUnchanged(await snapshotProductInputs(root),expected,'Product source/config/dependencies');}
export async function productBuildInventory(root=workspaceRoot){
 root=await realpath(root);const app=join(root,'apps/threadplane'),input=await snapshotProductInputs(root),compiled=await snapshotFiles(root,contractCompiledKeys);
 const sourceHashes={...hashes(input.facts),...hashes(compiled)};
 const assetFiles=await files(root,join(app,'dist'));
 if(assetFiles.some(path=>path.endsWith('.map')))throw new Error('Unexpected production source map');
 const assetHashes={};for(const path of assetFiles)assetHashes[relative(join(app,'dist'),path)]=(await checkedRead(root,path)).sha256;
 const {adapterBuildSchema}=await loadContract(root);
 return adapterBuildSchema.parse({packages:input.packages,framework:{name:'Angular',version:input.packages.find(p=>p.name==='@angular/core').version},production:true,sourceHashes,copiedSourceHashes:{},assetHashes,settings:input.settings});
}
export function parseProductRecord(bytes,contract){const recorded=contract.adapterBuildSchema.parse(JSON.parse(bytes.toString('utf8')));if(!bytes.equals(Buffer.from(JSON.stringify(recorded,null,2)+'\n')))throw new Error('Noncanonical generated product record bytes');return recorded;}
export async function threadplaneBuildEvidence(root=workspaceRoot){
 root=await realpath(root);const path=join(root,'apps/threadplane/.build-evidence.json'),original=await checkedRead(root,path),recorded=parseProductRecord(original.bytes,await loadContract(root)),current=await productBuildInventory(root);assertBuildMatches(current,recorded);
 assertBuildMatches(await productBuildInventory(root),current);const again=await checkedRead(root,path);assertFactsUnchanged({identity:again.identity,sha256:again.sha256},{identity:original.identity,sha256:original.sha256},'Product record');return recorded;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--write-build-record')throw new Error('Build records are published only by the successful build.mjs sequence');
 else console.log(JSON.stringify(await threadplaneBuildEvidence(),null,2));
}
