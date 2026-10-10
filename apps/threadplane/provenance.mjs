import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join,relative} from 'node:path';
import {adapterBuildSchema,canonicalSerialize} from '@chat-ui-bench/contract';
import {collectResolvedPackages} from './dependency-closure.mjs';
const app=dirname(fileURLToPath(import.meta.url)),root=resolve(app,'../..');
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
async function files(directory){const names=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())names.push(...await files(path));else if(entry.isFile())names.push(path);else throw new Error(`Unexpected build entry ${path}`);}return names.sort();}
export function productionSettings(configuration){
 const build=configuration.projects.threadplane.architect.build,production=build.configurations.production;
 if(build.options.aot!==true||production.optimization!==true||production.sourceMap!==false||production.outputHashing!=='all'||configuration.cli.analytics!==false)throw new Error('Production build configuration differs from declared profile');
 return {optimization:production.optimization,sourceMaps:production.sourceMap};
}
export function assertBuildMatches(current,recorded){if(canonicalSerialize(current)!==canonicalSerialize(recorded))throw new Error('Current source, dependencies or assets differ from the recorded production build; rebuild before capture');}
async function inventory(){
 const appRequire=createRequire(join(app,'package.json'));
 const angularCore=appRequire.resolve('@angular/core/package.json');
 for(const name of ['@threadplane/chat','@threadplane/langgraph','@threadplane/render','@threadplane/telemetry']){
  const productRequire=createRequire(appRequire.resolve(name));
  if(productRequire.resolve('@angular/core/package.json')!==angularCore)throw new Error(`Duplicate Angular core instance for ${name}; dedupe and rebuild`);
 }
 const configuration=JSON.parse(await readFile(join(app,'angular.json'),'utf8'));
 const settings=productionSettings(configuration);
 const packages=await collectResolvedPackages(root,join(app,'package.json'));
 const sourceFiles=[join(root,'package.json'),join(root,'package-lock.json'),join(app,'package.json'),join(app,'angular.json'),join(app,'tsconfig.json'),join(app,'tsconfig.app.json'),join(app,'provenance.mjs'),join(app,'dependency-closure.mjs'),join(root,'packages/contract/package.json'),...['fixture.ts','comparison.ts','capture-bridge.ts','index.ts'].map(name=>join(root,'packages/contract/src',name)),...(await files(join(app,'src'))).filter(path=>!path.endsWith('.test.ts'))];
 const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[relative(root,path),await hash(path)])));
 const assetFiles=await files(join(app,'dist'));
 if(assetFiles.some(path=>path.endsWith('.map')))throw new Error('Unexpected production source map');
 const assetHashes=Object.fromEntries(await Promise.all(assetFiles.map(async path=>[relative(join(app,'dist'),path),await hash(path)])));
 return adapterBuildSchema.parse({packages,framework:{name:'Angular',version:packages.find(p=>p.name==='@angular/core').version},production:true,sourceHashes,copiedSourceHashes:{},assetHashes,settings});
}
const recordPath=join(app,'.build-evidence.json');
export async function threadplaneBuildEvidence(){const current=await inventory(),recorded=adapterBuildSchema.parse(JSON.parse(await readFile(recordPath,'utf8')));assertBuildMatches(current,recorded);return recorded;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--write-build-record')await writeFile(recordPath,JSON.stringify(await inventory(),null,2)+'\n');
 else console.log(JSON.stringify(await threadplaneBuildEvidence(),null,2));
}
