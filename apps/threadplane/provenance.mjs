import * as filesystem from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
import {collectResolvedPackages,checkedRead,checkedJSON,checkedPath,containedKey,packagePath} from './dependency-closure.mjs';
import {commonBuildKeys,contractSourceKeys,contractCompiledKeys,snapshotFiles,hashes,assertFactsUnchanged,loadContract,workspaceRoot} from './probe-provenance.mjs';
/** Optional options.lifecycle: assertActive(): void;
 * adopt({name: string, close(): Promise<void>}): Promise<void>.
 * Uses ComparisonOwnershipContext's shape without importing runner code.
 */
async function acquire(lifecycle,operation){lifecycle?.assertActive();const value=await operation();lifecycle?.assertActive();return value;}
async function files(root,directory,options){
 const {ops=filesystem,lifecycle}=options;lifecycle?.assertActive();
 const before=await checkedPath(root,directory,ops,{directory:true},lifecycle),names=[];
 for(const entry of await acquire(lifecycle,()=>ops.readdir(directory,{withFileTypes:true}))){lifecycle?.assertActive();const path=join(directory,entry.name);if(entry.isDirectory())names.push(...await files(root,path,options));else if(entry.isFile()){await checkedPath(root,path,ops,{},lifecycle);names.push(path);}else throw new Error(`Unexpected build entry ${path}`);}
 const after=await checkedPath(root,directory,ops,{directory:true},lifecycle);lifecycle?.assertActive();assertFactsUnchanged(after,before,'Inventory directory');return names.sort();
}
export function productionSettings(configuration){
 const build=configuration.projects.threadplane.architect.build,production=build.configurations.production;
 if(build.options.aot!==true||production.optimization!==true||production.sourceMap!==false||production.outputHashing!=='all'||configuration.cli.analytics!==false)throw new Error('Production build configuration differs from declared profile');
 return {optimization:production.optimization,sourceMaps:production.sourceMap};
}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value;}
export function assertBuildMatches(current,recorded){if(JSON.stringify(stable(current))!==JSON.stringify(stable(recorded)))throw new Error('Current source, dependencies or assets differ from the recorded production build; rebuild before capture');}
export async function productSourceKeys(root=workspaceRoot,options={}){const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const paths=await files(root,join(root,'apps/threadplane/src'),options);lifecycle?.assertActive();return [...commonBuildKeys,...contractSourceKeys,...paths.filter(path=>!path.endsWith('.test.ts')).map(path=>containedKey(root,path))].sort();}
export async function snapshotProductInputs(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const app=join(root,'apps/threadplane');
 lifecycle?.assertActive();const appRequire=createRequire(join(app,'package.json'));lifecycle?.assertActive();
 const angularCore=await packagePath('@angular/core',join(app,'package.json'),ops,lifecycle);await checkedPath(root,angularCore,ops,{},lifecycle);
 for(const name of ['@threadplane/chat','@threadplane/langgraph','@threadplane/render','@threadplane/telemetry']){lifecycle?.assertActive();
  const metadata=await packagePath(name,join(app,'package.json'),ops,lifecycle);await checkedPath(root,metadata,ops,{},lifecycle);
  lifecycle?.assertActive();const resolved=appRequire.resolve(name);lifecycle?.assertActive();const entry=await acquire(lifecycle,()=>ops.realpath(resolved));containedKey(dirname(metadata),entry);
  if(await packagePath('@angular/core',entry,ops,lifecycle)!==angularCore)throw new Error(`Duplicate Angular core instance for ${name}; dedupe and rebuild`);
 }
 const configuration=await checkedJSON(root,join(app,'angular.json'),ops,lifecycle);
 const settings=productionSettings(configuration);
 const packages=await collectResolvedPackages(root,join(app,'package.json'),ops,lifecycle);
 const facts=await snapshotFiles(root,await productSourceKeys(root,options),options);
 const metadata=await snapshotFiles(root,packages.map(p=>`${p.resolutionPath}/package.json`),options);lifecycle?.assertActive();
 return {facts,metadata,packages,settings};
}
export async function assertProductInputsUnchanged(root,expected,options={}){options.lifecycle?.assertActive();const current=await snapshotProductInputs(root,options);options.lifecycle?.assertActive();assertFactsUnchanged(current,expected,'Product source/config/dependencies');}
export async function productBuildInventory(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const app=join(root,'apps/threadplane'),input=await snapshotProductInputs(root,options),compiled=await snapshotFiles(root,contractCompiledKeys,options);
 const sourceHashes={...hashes(input.facts),...hashes(compiled)};
 const assetFiles=await files(root,join(app,'dist'),options);lifecycle?.assertActive();
 if(assetFiles.some(path=>path.endsWith('.map')))throw new Error('Unexpected production source map');
 const assetHashes={};for(const path of assetFiles){lifecycle?.assertActive();assetHashes[relative(join(app,'dist'),path)]=(await checkedRead(root,path,ops,lifecycle)).sha256;}
 const {adapterBuildSchema}=await loadContract(root,options);lifecycle?.assertActive();
 return adapterBuildSchema.parse({packages:input.packages,framework:{name:'Angular',version:input.packages.find(p=>p.name==='@angular/core').version},production:true,sourceHashes,copiedSourceHashes:{},assetHashes,settings:input.settings});
}
export function parseProductRecord(bytes,contract){const recorded=contract.adapterBuildSchema.parse(JSON.parse(bytes.toString('utf8')));if(!bytes.equals(Buffer.from(JSON.stringify(recorded,null,2)+'\n')))throw new Error('Noncanonical generated product record bytes');return recorded;}
export async function threadplaneBuildEvidence(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const path=join(root,'apps/threadplane/.build-evidence.json'),original=await checkedRead(root,path,ops,lifecycle),recorded=parseProductRecord(original.bytes,await loadContract(root,options)),current=await productBuildInventory(root,options);lifecycle?.assertActive();assertBuildMatches(current,recorded);
 assertBuildMatches(await productBuildInventory(root,options),current);const again=await checkedRead(root,path,ops,lifecycle);lifecycle?.assertActive();assertFactsUnchanged({identity:again.identity,sha256:again.sha256},{identity:original.identity,sha256:original.sha256},'Product record');return recorded;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--write-build-record')throw new Error('Build records are published only by the successful build.mjs sequence');
 else console.log(JSON.stringify(await threadplaneBuildEvidence(),null,2));
}
