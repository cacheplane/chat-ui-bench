import * as filesystem from 'node:fs/promises';
import {constants} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedRead,checkedPath,recheckPath} from './dependency-closure.mjs';
import {workspaceRoot,probeRecordKey,snapshotProbeInputs,assertProbeInputsUnchanged,snapshotCompiledInputs,assertCompiledInputsUnchanged,probeRecordInputs,hashes,loadContract,parseProbeRecord,contractCompiledKeys} from './probe-provenance.mjs';
import {snapshotProductInputs,assertProductInputsUnchanged,productBuildInventory,parseProductRecord,assertBuildMatches} from './provenance.mjs';

export async function runCommand({command,args,cwd}){
 await new Promise((accept,reject)=>{
  const child=spawn(command,args,{cwd,stdio:'inherit'});child.once('error',reject);
  child.once('exit',(code,signal)=>code===0&&signal===null?accept():reject(new Error(`${command} ${args.join(' ')} failed: ${signal??code}`)));
 });
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
export async function buildThreadplane({root=workspaceRoot,runCommand:execute=runCommand,ops=filesystem}={}){
 root=await ops.realpath(root);const app=join(root,'apps/threadplane'),productPath=join(app,'.build-evidence.json'),probePath=join(root,probeRecordKey);
 // A failed invalidation aborts before any compilation. Separate files are not a transaction.
 await invalidate(root,productPath,ops);await invalidate(root,probePath,ops);
 const source=await snapshotProbeInputs(root),productInputs=await snapshotProductInputs(root);
 for(const name of ['contract','producer','analyzer','runner'])await execute({command:'npm',args:['run','build','--workspace',`@chat-ui-bench/${name}`],cwd:root});
 const compiled=await snapshotCompiledInputs(root); // immediately BEFORE Angular consumes these modules
 await assertProbeInputsUnchanged(root,source);await assertProductInputsUnchanged(root,productInputs);
 await execute({command:'ng',args:['build','threadplane','--configuration','production'],cwd:app});
 const unchanged=async()=>{await assertProbeInputsUnchanged(root,source);await assertProductInputsUnchanged(root,productInputs);await assertCompiledInputsUnchanged(root,compiled);};
 await unchanged();const contract=await loadContract(root);
 const probe=contract.comparisonInstrumentationBuildSchema.parse({kind:'comparison-instrumentation-build',formatVersion:1,...probeRecordInputs(source),compiledHashes:hashes(compiled)});
 const product=await productBuildInventory(root);
 for(const key of contractCompiledKeys)if(product.sourceHashes[key]!==probe.compiledHashes[key])throw new Error('Product compiled input differs from pre-Angular checkpoint');
 const probeBytes=Buffer.from(contract.canonicalSerialize(probe)+'\n'),productBytes=Buffer.from(JSON.stringify(product,null,2)+'\n');
 parseProbeRecord(probeBytes,contract);parseProductRecord(productBytes,contract);
 const publicationCheck=async()=>{await unchanged();assertBuildMatches(await productBuildInventory(root),product);};
 await publicationCheck();await publish(root,probePath,probeBytes,ops);
 await publicationCheck();await publish(root,productPath,productBytes,ops);
 await publicationCheck();return {product,probe};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildThreadplane();
