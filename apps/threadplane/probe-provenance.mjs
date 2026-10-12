import * as filesystem from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkedRead,checkedJSON,checkedPath,packagePath,containedKey} from './dependency-closure.mjs';

export const workspaceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const probeRecordKey='packages/runner/.comparison-build-evidence.json';
export const contractSourceKeys=Object.freeze(['index','fixture','artifact','adapter','long-thread','comparison','presentation','capture-bridge','comparison-artifact','comparison-presentation','comparison-buffer','comparison-installer-options','comparison-version-families'].map(name=>`packages/contract/src/${name}.ts`).sort());
export const contractCompiledKeys=Object.freeze(contractSourceKeys.map(key=>key.replace('/src/','/dist/').replace(/\.ts$/,'.js')));
export const commonBuildKeys=Object.freeze(['package.json','package-lock.json','tsconfig.base.json','packages/contract/package.json','packages/contract/tsconfig.json','apps/threadplane/package.json','apps/threadplane/angular.json','apps/threadplane/tsconfig.json','apps/threadplane/tsconfig.app.json','apps/threadplane/provenance.mjs','apps/threadplane/dependency-closure.mjs','apps/threadplane/build.mjs','apps/threadplane/probe-provenance.mjs'].sort());
export const probeSourceKeys=Object.freeze([...commonBuildKeys,...contractSourceKeys,'packages/runner/package.json','packages/runner/tsconfig.json','packages/runner/src/comparison-installer.ts','packages/runner/src/comparison-observations.ts','packages/runner/src/comparison-assembly-worker.ts'].sort());
export const probeCompiledKeys=Object.freeze([...contractCompiledKeys,'packages/runner/dist/comparison-installer.js','packages/runner/dist/comparison-observations.js','packages/runner/dist/comparison-assembly-worker.js'].sort());

export function assertExactKeys(values,keys,label){if(JSON.stringify(Object.keys(values).sort())!==JSON.stringify([...keys].sort()))throw new Error(`Unsupported ${label} keys`);}
/** Optional options.lifecycle: assertActive(): void;
 * adopt({name: string, close(): Promise<void>}): Promise<void>.
 * Uses ComparisonOwnershipContext's shape without importing runner code.
 */
async function acquire(lifecycle,operation){lifecycle?.assertActive();const value=await operation();lifecycle?.assertActive();return value;}
export async function snapshotFiles(root,keys,options={}){
 const {ops=filesystem,lifecycle}=options;lifecycle?.assertActive();const facts={};for(const key of [...keys].sort()){lifecycle?.assertActive();const read=await checkedRead(root,join(root,key),ops,lifecycle);lifecycle?.assertActive();facts[key]={sha256:read.sha256,identity:read.identity,path:read.path,ancestors:read.ancestors.map(([path,stat])=>({path,dev:stat.dev,ino:stat.ino}))};}return facts;
}
export const hashes=facts=>Object.fromEntries(Object.entries(facts).map(([key,fact])=>[key,fact.sha256]));
export function assertFactsUnchanged(actual,expected,label){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`${label} changed during build; rebuild before capture`);}
export async function loadContract(root=workspaceRoot,options={}){const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));return acquire(lifecycle,()=>import(pathToFileURL(join(root,'packages/contract/dist/index.js')).href));}
async function tool(root,name,from,pin,lock,options){
 const {ops=filesystem,lifecycle}=options;lifecycle?.assertActive();const path=await packagePath(name,from,ops,lifecycle);lifecycle?.assertActive();if(!path)throw new Error(`Missing compiler ${name}`);
 const resolutionPath=containedKey(root,dirname(path)); // before controlled metadata open
 const read=await checkedRead(root,path,ops,lifecycle);lifecycle?.assertActive();const metadata=JSON.parse(read.bytes.toString('utf8')),row=lock.packages[resolutionPath];
 if(metadata.name!==name||metadata.version!==pin||!row||row.version!==pin||row.name!==undefined&&row.name!==name||!/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/.test(row.integrity??''))throw new Error(`Compiler direct pin/lock identity differs ${name}`);
 return {identity:{name,version:metadata.version,resolutionPath,integrity:row.integrity},metadata,measurement:{byteLength:read.byteLength,sha256:read.sha256},file:{path:read.path,identity:read.identity}};
}
export async function snapshotProbeInputs(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const facts=await snapshotFiles(root,probeSourceKeys,options),manifest=await checkedJSON(root,join(root,'package.json'),ops,lifecycle),lock=await checkedJSON(root,join(root,'package-lock.json'),ops,lifecycle);
 if(manifest.devDependencies.typescript!=='7.0.2')throw new Error('Unsupported root compiler direct pin');
 const compiler=await tool(root,'typescript',join(root,'package.json'),manifest.devDependencies.typescript,lock,options);lifecycle?.assertActive();
 const name=`@typescript/typescript-${process.platform}-${process.arch}`,pin=compiler.metadata.optionalDependencies?.[name];
 if(pin!==compiler.identity.version)throw new Error('Native compiler optional pin differs');
 const native=await tool(root,name,join(root,compiler.identity.resolutionPath,'package.json'),pin,lock,options);lifecycle?.assertActive();
 if(!native.metadata.os?.includes(process.platform)||!native.metadata.cpu?.includes(process.arch))throw new Error('Native compiler platform differs');
 const executablePath=`${native.identity.resolutionPath}/lib/tsc${process.platform==='win32'?'.exe':''}`,executable=await checkedPath(root,join(root,executablePath),ops,{},lifecycle);lifecycle?.assertActive();
 return {facts,compiler:{...compiler.identity,nodeVersion:process.version},nativeCompiler:{...native.identity,platform:process.platform,architecture:process.arch,executablePath},compilerPackageMetadata:compiler.measurement,nativeCompilerPackageMetadata:native.measurement,toolFiles:[compiler.file,native.file,{path:executable.path,identity:executable.identity}]};
}
export function probeRecordInputs(snapshot){return {sourceHashes:hashes(snapshot.facts),compiler:snapshot.compiler,nativeCompiler:snapshot.nativeCompiler,compilerPackageMetadata:snapshot.compilerPackageMetadata,nativeCompilerPackageMetadata:snapshot.nativeCompilerPackageMetadata};}
export async function assertProbeInputsUnchanged(root,expected,options={}){options.lifecycle?.assertActive();const current=await snapshotProbeInputs(root,options);options.lifecycle?.assertActive();assertFactsUnchanged(current,expected,'Source/config/compiler inputs');}
export const snapshotCompiledInputs=(root=workspaceRoot,options={})=>snapshotFiles(root,probeCompiledKeys,options);
export async function assertCompiledInputsUnchanged(root,expected,options={}){options.lifecycle?.assertActive();const current=await snapshotCompiledInputs(root,options);options.lifecycle?.assertActive();assertFactsUnchanged(current,expected,'Compiled inputs');}
export function parseProbeRecord(bytes,contract){
 const parsed=contract.comparisonInstrumentationBuildSchema.parse(JSON.parse(bytes.toString('utf8')));
 assertExactKeys(parsed.sourceHashes,probeSourceKeys,'probe source');assertExactKeys(parsed.compiledHashes,probeCompiledKeys,'probe compiled');
 if(!bytes.equals(Buffer.from(contract.canonicalSerialize(parsed)+'\n')))throw new Error('Noncanonical generated instrumentation record bytes');
 return parsed;
}
/** Read-only reacquisition; never manufactures a fresh build record from current dist. */
export async function comparisonInstrumentationBuildEvidence(root=workspaceRoot,options={}){
 const {ops=filesystem,lifecycle}=options;root=await acquire(lifecycle,()=>ops.realpath(root));const original=await checkedRead(root,join(root,probeRecordKey),ops,lifecycle),contract=await loadContract(root,options);lifecycle?.assertActive();const record=parseProbeRecord(original.bytes,contract);
 const source=await snapshotProbeInputs(root,options),compiled=await snapshotCompiledInputs(root,options);lifecycle?.assertActive();
 const current={kind:'comparison-instrumentation-build',formatVersion:1,...probeRecordInputs(source),compiledHashes:hashes(compiled)};
 if(contract.canonicalSerialize(current)!==contract.canonicalSerialize(record))throw new Error('Current instrumentation inputs differ from recorded build');
 await assertProbeInputsUnchanged(root,source,options);await assertCompiledInputsUnchanged(root,compiled,options);
 const again=await checkedRead(root,join(root,probeRecordKey),ops,lifecycle);lifecycle?.assertActive();assertFactsUnchanged({identity:again.identity,sha256:again.sha256},{identity:original.identity,sha256:original.sha256},'Instrumentation record');
 const {threadplaneBuildEvidence}=await acquire(lifecycle,()=>import('./provenance.mjs')),product=await threadplaneBuildEvidence(root,options);lifecycle?.assertActive();
 for(const [key,digest] of Object.entries(record.sourceHashes)){lifecycle?.assertActive();if(Object.hasOwn(product.sourceHashes,key)&&product.sourceHashes[key]!==digest)throw new Error('Product/probe shared source differs');}
 for(const key of contractCompiledKeys){lifecycle?.assertActive();if(product.sourceHashes[key]!==record.compiledHashes[key])throw new Error('Product/probe shared compiled input differs');}
 await assertProbeInputsUnchanged(root,source,options);await assertCompiledInputsUnchanged(root,compiled,options);
 const final=await checkedRead(root,join(root,probeRecordKey),ops,lifecycle);lifecycle?.assertActive();assertFactsUnchanged({identity:final.identity,sha256:final.sha256},{identity:original.identity,sha256:original.sha256},'Instrumentation record');
 return record;
}
