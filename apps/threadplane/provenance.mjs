import * as filesystem from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
import {collectResolvedPackages,checkedRead,checkedJSON,checkedPath,containedKey,packagePath} from './dependency-closure.mjs';
import {commonBuildKeys,contractSourceKeys,contractCompiledKeys,snapshotFiles,hashes,assertFactsUnchanged,assertExactKeys,loadContract,workspaceRoot} from './probe-provenance.mjs';
export const nativeIdleHostVariant=Object.freeze({schemaVersion:1,id:'threadplane-0.3.2-idle-host-css-v1',basePackage:'@threadplane/chat@0.3.2',styleKey:'apps/threadplane/src/native-idle-host-css-v1.css',styleSha256:'e19ff7e4d8deeea0813bcb0023835307f94cd85aa63075e4f15f2889b8718923'});
export const nativeIdleHostVariantLabel='Threadplane 0.3.2 + benchmark idle-host CSS v1 (modified configuration)';
export const nativeIdleHostAngularSelection=Object.freeze({configuration:'production',styles:Object.freeze(['src/styles.css','src/native-idle-host-css-v1.css'])});
const nativeIdleHostBaseIntegrity='sha512-htsWljhDogT6fOsmZrOvC+wFDRPhiQR/rvfwTJ2dYd/H6MiwPm3twxSr+KdNbaNRnARb62kUvPaigm0VA3cuGw==';
export async function assertNativeIdleHostStyle(root,options={}){
 const {ops=filesystem,lifecycle}=options;lifecycle?.assertActive();const read=await checkedRead(root,join(root,nativeIdleHostVariant.styleKey),ops,lifecycle);lifecycle?.assertActive();
 if(read.byteLength!==77||read.sha256!==nativeIdleHostVariant.styleSha256)throw new Error('Native idle host style bytes differ');
}
export function parseNativeIdleHostProductRecord(bytes,contract){
 const envelope=JSON.parse(bytes.toString('utf8'));assertExactKeys(envelope,['kind','variant','angularSelection','build'],'native idle host product');
 if(envelope.kind!=='native-idle-host-css-product-v1')throw new Error('Unsupported native idle host product kind');
 assertExactKeys(envelope.variant,Object.keys(nativeIdleHostVariant),'native idle host variant');assertBuildMatches(envelope.variant,nativeIdleHostVariant);
 assertExactKeys(envelope.angularSelection,Object.keys(nativeIdleHostAngularSelection),'native idle host Angular selection');assertBuildMatches(envelope.angularSelection,nativeIdleHostAngularSelection);
 const build=contract.adapterBuildSchema.parse(envelope.build),packages=build.packages.filter(p=>p.name==='@threadplane/chat');
 if(packages.length!==1||packages[0].version!=='0.3.2'||packages[0].integrity!==nativeIdleHostBaseIntegrity||!packages[0].resolutionPath.split('/').includes('node_modules'))throw new Error('Native idle host base package identity differs');
 if(build.sourceHashes[nativeIdleHostVariant.styleKey]!==nativeIdleHostVariant.styleSha256||!Object.hasOwn(build.sourceHashes,'apps/threadplane/build.mjs'))throw new Error('Native idle host source hashes differ');
 if(!bytes.equals(Buffer.from(JSON.stringify({kind:envelope.kind,variant:nativeIdleHostVariant,angularSelection:nativeIdleHostAngularSelection,build},null,2)+'\n')))throw new Error('Noncanonical native idle host product record bytes');return build;
}
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
export async function productSourceKeys(root=workspaceRoot,options={}){const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const paths=await files(root,join(root,'apps/threadplane/src'),options);lifecycle?.assertActive();return [...commonBuildKeys,...contractSourceKeys,...paths.filter(path=>!path.endsWith('.test.ts')).map(path=>containedKey(root,path)).filter(key=>key!==nativeIdleHostVariant.styleKey)].sort();}
export async function nativeIdleHostProductSourceKeys(root=workspaceRoot,options={}){const keys=await productSourceKeys(root,options);await assertNativeIdleHostStyle(root,options);return [...keys,nativeIdleHostVariant.styleKey].sort();}
export async function snapshotProductInputs(root=workspaceRoot,options={}){return snapshotSelectedProductInputs(root,options,productSourceKeys);}
export async function snapshotNativeIdleHostProductInputs(root=workspaceRoot,options={}){return snapshotSelectedProductInputs(root,options,nativeIdleHostProductSourceKeys);}
async function snapshotSelectedProductInputs(root,options,sourceKeys){
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
 const facts=await snapshotFiles(root,await sourceKeys(root,options),options);
 const metadata=await snapshotFiles(root,packages.map(p=>`${p.resolutionPath}/package.json`),options);lifecycle?.assertActive();
 return {facts,metadata,packages,settings};
}
export async function assertProductInputsUnchanged(root,expected,options={}){options.lifecycle?.assertActive();const current=await snapshotProductInputs(root,options);options.lifecycle?.assertActive();assertFactsUnchanged(current,expected,'Product source/config/dependencies');}
export async function assertNativeIdleHostProductInputsUnchanged(root,expected,options={}){options.lifecycle?.assertActive();const current=await snapshotNativeIdleHostProductInputs(root,options);options.lifecycle?.assertActive();assertFactsUnchanged(current,expected,'Product source/config/dependencies');}
export async function productBuildInventory(root=workspaceRoot,options={}){return selectedProductBuildInventory(root,options,snapshotProductInputs);}
export async function nativeIdleHostProductBuildInventory(root=workspaceRoot,options={}){return selectedProductBuildInventory(root,options,snapshotNativeIdleHostProductInputs);}
async function selectedProductBuildInventory(root,options,snapshot){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const app=join(root,'apps/threadplane'),input=await snapshot(root,options),compiled=await snapshotFiles(root,contractCompiledKeys,options);
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
export async function nativeIdleHostBuildEvidence(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const path=join(root,'apps/threadplane/.build-evidence.json'),original=await checkedRead(root,path,ops,lifecycle),recorded=parseNativeIdleHostProductRecord(original.bytes,await loadContract(root,options));
 await assertNativeIdleHostStyle(root,options);const current=await nativeIdleHostProductBuildInventory(root,options);lifecycle?.assertActive();assertBuildMatches(current,recorded);
 assertBuildMatches(await nativeIdleHostProductBuildInventory(root,options),current);await assertNativeIdleHostStyle(root,options);const again=await checkedRead(root,path,ops,lifecycle);lifecycle?.assertActive();assertFactsUnchanged({identity:again.identity,sha256:again.sha256},{identity:original.identity,sha256:original.sha256},'Native idle host product record');return recorded;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--write-build-record')throw new Error('Build records are published only by the successful build.mjs sequence');
 else console.log(JSON.stringify(await threadplaneBuildEvidence(),null,2));
}

// Fixed STOCK 0.3.3 native family; legacy/modified parsers remain independent.
export const stock033Identity=Object.freeze({schemaVersion:1,id:'threadplane-stock-0.3.3',basePackage:'@threadplane/chat@0.3.3'});
export const stock033Label='Threadplane 0.3.3 (stock published packages)';
export const stock033PackageIntegrities=Object.freeze({"@threadplane/chat": "sha512-S6SqtNmORfklweqnGTI4L+8ZBSaQ825b1OtbsCvXjZxw7ywikda3ARfX1BMHwSDHCwtq/+H1N5Id4CCodWJdSw==", "@threadplane/a2ui": "sha512-9mjcroEaxwEgIWWwbpWsvCUr6+MheIdMyJCOKHrX+KaqpPqrY/juvlPjgU40OTJWkAVnB+dY95Ow070HHH+P8w==", "@threadplane/langgraph": "sha512-QHphnlzqWuYM2D1UfTyRpCqW5UnAIyEYE1bVGDWXyeUHBmozVydVQjL/rtYf9SMMMHLcT15YcaXM5P+bRGcBOg==", "@threadplane/render": "sha512-gUbUPOC5aqWc8cutMgceoa98iTJRGGOj39CiSD34AH82pvwtnqUlxKxppu5/h05C6VvnzcKdLfx0mHorabJLYw==", "@threadplane/telemetry": "sha512-D3t8G8OgWMfP7SvlJLf1h9aFJ7m4SaPLTWIgZ7SAOGJi3qH7AtPgDLHyzeawTWC9bqN9z9X5e/ZhZp4911yLiQ=="});
export function parseStock033ProductRecord(bytes,contract){
 const build=parseProductRecord(bytes,contract),selected=build.packages.filter(p=>p.name.startsWith('@threadplane/'));
 if(selected.length!==5||Object.entries(stock033PackageIntegrities).some(([name,integrity])=>{const rows=selected.filter(p=>p.name===name);return rows.length!==1||rows[0].version!=='0.3.3'||rows[0].integrity!==integrity||rows[0].resolutionPath!==`apps/threadplane/node_modules/${name}`;}))throw new Error('Stock 0.3.3 published package identity differs');
 if(build.framework.name!=='Angular'||build.settings.optimization!==true||build.settings.sourceMaps!==false||!Object.hasOwn(build.sourceHashes,'apps/threadplane/build.mjs')||!Object.hasOwn(build.sourceHashes,'apps/threadplane/angular.json')||Object.hasOwn(build.sourceHashes,nativeIdleHostVariant.styleKey)||Object.keys(build.copiedSourceHashes).length!==0||Object.keys(build.assetHashes).length!==12)throw new Error('Stock 0.3.3 production profile differs');
 return build;
}
