import * as filesystem from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {checkedRead,checkedPath,recheckPath,containedKey} from './dependency-closure.mjs';
import {workspaceRoot,probeRecordKey,snapshotProbeInputs,assertProbeInputsUnchanged,snapshotCompiledInputs,assertCompiledInputsUnchanged,probeRecordInputs,hashes,loadContract,parseProbeRecord,contractCompiledKeys} from './probe-provenance.mjs';
import {snapshotProductInputs,assertProductInputsUnchanged,productBuildInventory,snapshotNativeIdleHostProductInputs,assertNativeIdleHostProductInputsUnchanged,nativeIdleHostProductBuildInventory,parseProductRecord,assertBuildMatches,nativeIdleHostVariant,nativeIdleHostAngularSelection,assertNativeIdleHostStyle,parseNativeIdleHostProductRecord} from './provenance.mjs';

export async function runCommand({command,args,cwd}){
 await new Promise((accept,reject)=>{
  const child=spawn(command,args,{cwd,stdio:'inherit'});child.once('error',reject);
  child.once('exit',(code,signal)=>code===0&&signal===null?accept():reject(new Error(`${command} ${args.join(' ')} failed: ${signal??code}`)));
 });
}
function nativeIdleHostCLI(app){return createRequire(join(app,'package.json')).resolve('@angular/cli/bin/ng.js');}
/** Logical ng selection is executed by this process's Node and the app-resolved CLI, never ambient ng. */
export async function runNativeIdleHostCommand({command,args,cwd}){
 return runCommand(command==='ng'?{command:process.execPath,args:[nativeIdleHostCLI(cwd),...args],cwd}:{command,args,cwd});
}
async function snapshotNativeIdleHostCLI(root,productInputs){
 const app=join(root,'apps/threadplane'),require=createRequire(join(app,'package.json'));
 const metadata=await checkedRead(root,require.resolve('@angular/cli/package.json')),cli=await checkedRead(root,nativeIdleHostCLI(app)),parsed=JSON.parse(metadata.bytes.toString('utf8'));
 containedKey(dirname(metadata.path),cli.path);const key=containedKey(root,dirname(metadata.path)),pin=productInputs.packages.find(p=>p.resolutionPath===key);
 if(parsed.name!=='@angular/cli'||parsed.version!=='21.2.26'||pin?.name!==parsed.name||pin.version!==parsed.version)throw new Error('Native idle host CLI package differs from pinned product inputs');
 return Object.fromEntries([metadata,cli].map(read=>[read.key,{sha256:read.sha256,identity:read.identity,path:read.path,ancestors:read.ancestors.map(([path,stat])=>({path,dev:stat.dev,ino:stat.ino}))}]));
}
async function absent(path,ops){try{await ops.lstat(path);}catch(error){if(error.code==='ENOENT')return;throw error;}throw new Error(`Generated record destination already exists ${path}`);}
async function invalidate(root,path,ops){
 let read;try{read=await checkedRead(root,path,ops);}catch(error){if(error.code==='ENOENT')return;throw error;}
 await recheckPath(read,ops);await ops.unlink(path);await absent(path,ops);
}
async function publish(root,path,bytes,ops){
 const parent=await checkedPath(root,dirname(path),ops,{directory:true});await absent(path,ops);
 const checkParent=async()=>{
  const current=await checkedPath(root,dirname(path),ops,{directory:true});
  if(current.identity.dev!==parent.identity.dev||current.identity.ino!==parent.identity.ino||current.ancestors.some(([path,stat],i)=>path!==parent.ancestors[i]?.[0]||stat.dev!==parent.ancestors[i]?.[1].dev||stat.ino!==parent.ancestors[i]?.[1].ino))throw new Error('Publication directory changed');
  return current;
 };
 const temporary=`${path}.${randomUUID()}.tmp`;let fd,primary,opened;
 try{
  fd=await ops.open(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  opened=await fd.stat();const pathCheck=await checkedPath(root,temporary,ops);await checkParent();
  if(!opened.isFile()||opened.dev!==pathCheck.identity.dev||opened.ino!==pathCheck.identity.ino)throw new Error('Generated record temporary identity differs before write');
  await fd.writeFile(bytes);await fd.sync();
 }catch(error){primary=error;}
 if(fd)try{await fd.close();}catch(error){primary=primary?new AggregateError([primary,error],'Publication write and close failed'):error;}
 if(primary)throw primary;
 const read=await checkedRead(root,temporary,ops);if(!read.bytes.equals(bytes)||read.identity.dev!==opened.dev||read.identity.ino!==opened.ino)throw new Error('Generated record temporary differs');
 const currentParent=await checkParent();
 await recheckPath(read,ops);await absent(path,ops);await ops.rename(temporary,path);
 const directory=await ops.open(dirname(path),constants.O_RDONLY|constants.O_NOFOLLOW);let syncError;
 try{const stat=await directory.stat();if(!stat.isDirectory()||stat.dev!==currentParent.identity.dev||stat.ino!==currentParent.identity.ino)throw new Error('Publication directory FD changed');await directory.sync();}catch(error){syncError=error;}
 try{await directory.close();}catch(error){if(syncError)throw new AggregateError([syncError,error],'Directory sync and close failed');throw error;}
 if(syncError)throw syncError;
 await checkParent();
 const published=await checkedRead(root,path,ops);if(!published.bytes.equals(bytes)||published.identity.dev!==read.identity.dev||published.identity.ino!==read.identity.ino)throw new Error('Published record changed');
}
/** Only this successful sequence publishes evidence. Injected command tests establish order, not compiler attestation. */
export async function buildThreadplane(options={}){return buildSelected(options,false);}
export async function buildNativeIdleHostVariant(options={}){
 try{return await buildSelected({...options,runCommand:options.runCommand??runNativeIdleHostCommand},true);}catch(error){
  const {root=workspaceRoot,ops=filesystem}=options;
  try{await invalidate(root,join(root,'apps/threadplane/.build-evidence.json'),ops);await invalidate(root,join(root,probeRecordKey),ops);}catch(cleanup){throw new AggregateError([error,cleanup],'Native idle host build and invalidation failed');}throw error;
 }
}
async function buildSelected({root=workspaceRoot,runCommand:execute=runCommand,ops=filesystem}={},nativeIdleHost){
 const snapshot=nativeIdleHost?snapshotNativeIdleHostProductInputs:snapshotProductInputs,assertUnchanged=nativeIdleHost?assertNativeIdleHostProductInputsUnchanged:assertProductInputsUnchanged,inventory=nativeIdleHost?nativeIdleHostProductBuildInventory:productBuildInventory;
 root=await ops.realpath(root);const app=join(root,'apps/threadplane'),productPath=join(app,'.build-evidence.json'),probePath=join(root,probeRecordKey);
 // A failed invalidation aborts before any compilation. Separate files are not a transaction.
 await invalidate(root,productPath,ops);await invalidate(root,probePath,ops);
 if(nativeIdleHost)await assertNativeIdleHostStyle(root);
 const source=await snapshotProbeInputs(root),productInputs=await snapshot(root);
 const cli=nativeIdleHost?await snapshotNativeIdleHostCLI(root,productInputs):null;
 for(const name of ['contract','producer','analyzer','runner'])await execute({command:'npm',args:['run','build','--workspace',`@chat-ui-bench/${name}`],cwd:root});
 const compiled=await snapshotCompiledInputs(root); // immediately BEFORE Angular consumes these modules
 await assertProbeInputsUnchanged(root,source);await assertUnchanged(root,productInputs);
 if(nativeIdleHost)assertBuildMatches(await snapshotNativeIdleHostCLI(root,productInputs),cli);
 await execute({command:'ng',args:['build','threadplane','--configuration','production',...(nativeIdleHost?['--styles',...nativeIdleHostAngularSelection.styles]:[])],cwd:app});
 const unchanged=async()=>{await assertProbeInputsUnchanged(root,source);await assertUnchanged(root,productInputs);await assertCompiledInputsUnchanged(root,compiled);if(nativeIdleHost)assertBuildMatches(await snapshotNativeIdleHostCLI(root,productInputs),cli);};
 await unchanged();const contract=await loadContract(root);
 const probe=contract.comparisonInstrumentationBuildSchema.parse({kind:'comparison-instrumentation-build',formatVersion:1,...probeRecordInputs(source),compiledHashes:hashes(compiled)});
 const product=await inventory(root);
 for(const key of contractCompiledKeys)if(product.sourceHashes[key]!==probe.compiledHashes[key])throw new Error('Product compiled input differs from pre-Angular checkpoint');
 const probeBytes=Buffer.from(contract.canonicalSerialize(probe)+'\n'),productBytes=Buffer.from(JSON.stringify(nativeIdleHost?{kind:'native-idle-host-css-product-v1',variant:nativeIdleHostVariant,angularSelection:nativeIdleHostAngularSelection,build:product}:product,null,2)+'\n');
 parseProbeRecord(probeBytes,contract);(nativeIdleHost?parseNativeIdleHostProductRecord:parseProductRecord)(productBytes,contract);
 const publicationCheck=async()=>{await unchanged();assertBuildMatches(await inventory(root),product);};
 await publicationCheck();await publish(root,probePath,probeBytes,ops);
 await publicationCheck();await publish(root,productPath,productBytes,ops);
 await publicationCheck();return {product,probe};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildThreadplane();
