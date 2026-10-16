// Hosted STATIC tooling only: never import the generated worker or an SDK.
import {createHash} from 'node:crypto';
import {mkdir,lstat,readFile,realpath,readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readIntegratedAdmission} from '../tests/support/hosted-copilot-context.ts';
import {ordinaryPath,assertDenseEntries} from '../tests/support/hosted-copilot-contract.ts';
import {readPhysicalSource,observeCompilerRuntimeModule} from '../tests/support/hosted-copilot-build-plugin.ts';
import {assertCompilerProfile,assertCompilerRuntimeOwnership,assertMappings,assertModuleOwnershipId,projectCompilerRuntimeModules} from '../tests/support/hosted-copilot-production-policy.ts';
import {MOUNTED_MODULE_PACKAGE_SPECIFIERS,MOUNTED_MODULE_BUILTINS,MOUNTED_PACKAGE_PINS,evaluateMountedModulePolicy} from '../tests/support/hosted-copilot-mounted-policy.ts';
import {collectWorkerModuleImports,assertWorkerFrontendPrerequisite,classifyWorkerModuleSource} from '../tests/support/hosted-copilot-worker-static-policy.ts';

const action=process.argv[2];
if(process.argv.length!==3||!['emit','inspect'].includes(action))throw new Error('Fixed worker STATIC action required');
const admission=readIntegratedAdmission(),root=admission.repositoryRoot,artifacts=admission.artifactDirectory;
const runId=process.env.GITHUB_RUN_ID,workerPath=`apps/copilotkit/.hosted-mounted/${runId}-1/worker.mjs`;
if(!/^[1-9][0-9]{0,19}$/.test(runId??''))throw new Error('Fixed worker run identity required');
const worker=join(root,workerPath),workerDirectory=join(worker,'..');
const hash=raw=>createHash('sha256').update(raw).digest('hex');
async function physical(path,cap) {
 if(!ordinaryPath(path))throw new Error('Worker physical path denied');
 let ancestor=root;
 for(const part of path.split('/')){ancestor=join(ancestor,part);if((await lstat(ancestor)).isSymbolicLink())throw new Error('Worker source/resolution symlink denied');}
 const absolute=join(root,path),before=await lstat(absolute);
 if(!before.isFile()||before.size<1||before.size>cap||await realpath(absolute)!==absolute)throw new Error('Worker physical file bound/containment');
 const raw=await readFile(absolute),after=await lstat(absolute);
 if(raw.length!==before.size||before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('Worker physical bytes changed');
 return {raw,fact:{path,bytes:raw.length,sha256:hash(raw),regular:true,contained:true,symlink:false}};
}
async function readJson(path,cap){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode((await physical(path,cap)).raw));}
// Artifacts are under runner.temp rather than checkout; bind their actual owner.
async function artifactBytes(name,cap) {
 if(!ordinaryPath(name))throw new Error('Worker artifact name denied');
 const absolute=join(artifacts,name),before=await lstat(absolute);
 if(!before.isFile()||before.isSymbolicLink()||before.size>cap||await realpath(absolute)!==absolute)throw new Error('Worker prerequisite/report file bound');
 const raw=await readFile(absolute),after=await lstat(absolute);
 if(raw.length!==before.size||before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('Worker prerequisite/report bytes changed');
 return raw;
}
async function artifactJson(name,cap){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await artifactBytes(name,cap)));}
async function report(name,value,cap=4*1024*1024) {
 const raw=JSON.stringify(value)+'\n';if(Buffer.byteLength(raw)>cap)throw new Error('Worker report byte bound');
 await writeFile(join(artifacts,name),raw,{flag:'wx'});
}
assertWorkerFrontendPrerequisite(admission.source.commitSha,await artifactJson('step-inspect-result.json',256*1024),await artifactJson('static-assets.json',8*1024*1024));

if(action==='emit') {
 // Public compiler imports occur only after the actual same-source prerequisite.
 const {rolldown,VERSION,RUNTIME_MODULE_ID}=await import('rolldown');
 const compilerProfile=assertCompilerProfile({provider:'rolldown',version:VERSION,runtimeModuleId:RUNTIME_MODULE_ID});
 const owned=[],files=[],requestedExternals=new Set(),enumeratedExternals=new Set();let runtimeModules,observed=false;
 const allowed=id=>MOUNTED_MODULE_BUILTINS.includes(id)||Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,id);
 const external=id=>{if(!allowed(id))return false;requestedExternals.add(id);return true;};
 const bundle=await rolldown({input:join(root,'apps/copilotkit/hosted-native-entry.ts'),cwd:root,platform:'node',tsconfig:false,preserveEntrySignatures:'strict',external,
  plugins:[{name:'worker-static-owned-modules',generateBundle(_options,outputs){
   if(observed)throw new Error('Worker mapping hook repeated');observed=true;
   let index=0;
   for(const id of this.getModuleIds()) {
    assertModuleOwnershipId(id,index++);
    if(id===RUNTIME_MODULE_ID)throw new Error('Compiler runtime appeared in source enumeration');
    const info=this.getModuleInfo(id);
    // Configuration-first classification after exact info/id checks. A prior
    // true external callback is distinct from any null/undefined code sentinel.
    if(classifyWorkerModuleSource(id,index-1,info,requestedExternals.has(id))==='configured-external'){enumeratedExternals.add(id);continue;}
    owned.push(id.startsWith('\0')||id.startsWith('virtual:')?{id,kind:'virtual',external:false}:{id,kind:'physical',...readPhysicalSource(id,root),external:false});
   }
   assertMappings(owned);
   const entries=Object.values(outputs);
   if(entries.length!==1||entries[0].type!=='chunk'||entries[0].fileName!=='worker.mjs'||!entries[0].isEntry)throw new Error('One worker ES entry required');
   const chunk=entries[0];
   assertDenseEntries(chunk.moduleIds,16384,true);
   files.push({kind:'chunk',moduleIds:[...chunk.moduleIds],facadeModuleId:chunk.facadeModuleId});
   runtimeModules=observeCompilerRuntimeModule(compilerProfile,chunk.moduleIds.includes(RUNTIME_MODULE_ID),id=>this.getModuleInfo(id));
   runtimeModules=assertCompilerRuntimeOwnership(files,owned,compilerProfile,projectCompilerRuntimeModules(compilerProfile,runtimeModules)).compilerRuntimeModules;
  }}]});
 let generated,primaryFailure;
 try{generated=await bundle.generate({format:'es',codeSplitting:false,entryFileNames:'worker.mjs',sourcemap:false,minify:false,strictExecutionOrder:true});}
 catch(error){primaryFailure=error;throw error;}
 finally{try{await bundle.close();}catch(error){if(primaryFailure)console.error('Compiler close also failed after original failure',error);else throw error;}}
 if(!observed||!runtimeModules||generated.output.length!==1)throw new Error('Original worker compiler output absent');
 const output=generated.output[0];
 if(output.type!=='chunk'||output.fileName!=='worker.mjs'||!output.isEntry||Buffer.byteLength(output.code)<1||Buffer.byteLength(output.code)>16*1024*1024)throw new Error('Worker emitted output bound');
 await mkdir(workerDirectory,{recursive:true});
 if((await readdir(workerDirectory)).length!==0||await realpath(workerDirectory)!==workerDirectory)throw new Error('Fresh worker directory required');
 await writeFile(worker,output.code,{flag:'wx'});
 const original=await physical(workerPath,16*1024*1024);
 await mkdir(join(artifacts,'worker'));
 await writeFile(join(artifacts,'worker/worker.mjs'),original.raw,{flag:'wx'});
 await report('worker-owned-modules.json',owned);
 await report('worker-compiler-profile.json',{compilerProfile,compilerRuntimeModules:runtimeModules,files,requestedExternals:[...requestedExternals],enumeratedExternals:[...enumeratedExternals]});
 readIntegratedAdmission();
 console.log(JSON.stringify({workerPath,bytes:original.fact.bytes,sha256:original.fact.sha256,ownedModules:owned.length,qualification:false,scope:'emitted STATIC bytes only; worker never imported'}));
} else {
 if(process.execArgv.length!==1||process.execArgv[0]!=='--experimental-import-meta-resolve')throw new Error('Fixed worker resolver flag required');
 const original=await physical(workerPath,16*1024*1024);
 if((await readdir(workerDirectory)).length!==1)throw new Error('Extra worker output denied');
 const copy=await artifactBytes('worker/worker.mjs',16*1024*1024);
 if(copy.length!==original.raw.length||hash(copy)!==original.fact.sha256)throw new Error('Worker artifact copy differs');
 const owned=await artifactJson('worker-owned-modules.json',4*1024*1024),compiler=await artifactJson('worker-compiler-profile.json',4*1024*1024);
 if(Object.keys(compiler).sort().join(',')!=='compilerProfile,compilerRuntimeModules,enumeratedExternals,files,requestedExternals'||!Array.isArray(compiler.files)||compiler.files.length!==1||compiler.files[0].kind!=='chunk')throw new Error('Worker compiler report shape differs');
 for(const names of [compiler.requestedExternals,compiler.enumeratedExternals]){assertDenseEntries(names,16,true);if(new Set(names).size!==names.length||names.some(id=>!MOUNTED_MODULE_BUILTINS.includes(id)&&!Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,id)))throw new Error('Worker compiler external observations differ');}
 if(compiler.enumeratedExternals.some(id=>!compiler.requestedExternals.includes(id)))throw new Error('Unrequested worker external observation');
 assertCompilerRuntimeOwnership(compiler.files,owned,compiler.compilerProfile,compiler.compilerRuntimeModules);
 for(const module of owned)if(module.kind==='physical'&&readPhysicalSource(module.id,root).sha256!==module.sha256)throw new Error('Worker owned source changed');
 const packages=[],accepted=await readJson('package-lock.json',4*1024*1024),hidden=await readJson('node_modules/.package-lock.json',4*1024*1024);
 for(const [path,pin] of Object.entries(MOUNTED_PACKAGE_PINS)) {
  const actual=await physical(path+'/package.json',256*1024),value=JSON.parse(actual.raw.toString('utf8'));
  if(value.name!==path.split('node_modules/').at(-1)||value.version!==pin.version||hidden.packages?.[path]?.version!==pin.version||hidden.packages?.[path]?.integrity!==pin.integrity||accepted.packages?.[path]?.version!==pin.version||accepted.packages?.[path]?.integrity!==pin.integrity)throw new Error('Worker installed package pin differs');
  packages.push({path,version:value.version,integrity:pin.integrity,manifestSha256:actual.fact.sha256,regular:true,contained:true,symlink:false});
 }
 const {parseAst}=await import('rolldown/parseAst');
 const imports=collectWorkerModuleImports(parseAst(new TextDecoder('utf-8',{fatal:true}).decode(original.raw),null,'worker.mjs'));
 const resolutions=[],resolutionFiles=[],rows=[];
 for(const item of imports) {
  if(MOUNTED_MODULE_BUILTINS.includes(item.specifier)){rows.push({...item,resolutionIndex:null});continue;}
  let index=resolutions.findIndex(row=>row.specifier===item.specifier);
  if(index<0) {
   if(resolutions.length>=10)throw new Error('Worker resolution count bound');
   const packagePath=MOUNTED_MODULE_PACKAGE_SPECIFIERS[item.specifier];if(!packagePath)throw new Error('Worker public import denied');
   const url=new URL(import.meta.resolve(item.specifier,pathToFileURL(worker).href));
   if(url.protocol!=='file:'||url.search||url.hash)throw new Error('Worker public resolution URL denied');
   const entryPath=relative(root,fileURLToPath(url));if(!entryPath.startsWith(packagePath+'/'))throw new Error('Worker public resolution package differs');
   const actual=await physical(entryPath,16*1024*1024),pin=MOUNTED_PACKAGE_PINS[packagePath];
   resolutions.push({specifier:item.specifier,packagePath,version:pin.version,integrity:pin.integrity,entryPath,regular:true,contained:true,symlink:false});
   resolutionFiles.push(actual.fact);index=resolutions.length-1;
  }
  rows.push({...item,resolutionIndex:index});
 }
 const input={schemaVersion:1,sourceSha:admission.source.commitSha,runId,workerPath,emitted:[{path:workerPath,kind:'chunk',format:'es',entry:true,bytes:original.fact.bytes,sha256:original.fact.sha256}],imports:rows,resolutions,executedCopySha256:hash(copy)};
 const policy=evaluateMountedModulePolicy(input);
 await report('worker-module.json',input);await report('worker-module-policy.json',policy);await report('worker-installed-packages.json',packages);await report('worker-resolution-files.json',resolutionFiles);
 if(policy.status!=='accepted')throw new Error('Worker module STATIC policy refused: '+policy.reason);
 if((await physical(workerPath,16*1024*1024)).fact.sha256!==original.fact.sha256)throw new Error('Worker bytes changed after inspection');
 if(hash(await artifactBytes('worker/worker.mjs',16*1024*1024))!==original.fact.sha256)throw new Error('Worker artifact copy changed after inspection');
 for(const item of packages)if((await physical(item.path+'/package.json',256*1024)).fact.sha256!==item.manifestSha256)throw new Error('Worker installed manifest changed');
 for(const file of resolutionFiles)if((await physical(file.path,16*1024*1024)).fact.sha256!==file.sha256)throw new Error('Worker public resolution changed');
 readIntegratedAdmission();
 console.log(JSON.stringify({workerPath,sha256:original.fact.sha256,importOccurrences:rows.length,packageResolutions:resolutions.length,qualification:false,scope:'supported owned worker syntax and public resolution bytes only; SDK/worker never imported; external package evaluation unqualified'}));
}
