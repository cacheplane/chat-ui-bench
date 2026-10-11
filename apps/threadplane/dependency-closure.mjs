import * as filesystem from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join,relative,sep,resolve,isAbsolute} from 'node:path';
export function containedKey(root,path){
 const key=relative(root,path);
 if(!key||isAbsolute(key)||key==='..'||key.startsWith('..'+sep))throw new Error(`Path must be contained in workspace: ${path}`);
 return key.split(sep).join('/');
}
const identity=stat=>({dev:stat.dev,ino:stat.ino,size:stat.size,mtimeMs:stat.mtimeMs,ctimeMs:stat.ctimeMs});
/** Optional Node-only lifecycle matches ComparisonOwnershipContext without a runner import:
 * lifecycle.assertActive(): void;
 * lifecycle.adopt({name: string, close(): Promise<void>}): Promise<void>.
 * Resolver/loader internal I/O remains outside application-owned FD attestation.
 */
async function acquire(lifecycle,operation){lifecycle?.assertActive();const value=await operation();lifecycle?.assertActive();return value;}
export async function checkedPath(root,path,ops=filesystem,{directory=false}={},lifecycle){
 lifecycle?.assertActive();const requestedRoot=resolve(root),requestedStat=await acquire(lifecycle,()=>ops.lstat(requestedRoot));
 if(!requestedStat.isDirectory()||requestedStat.isSymbolicLink())throw new Error('Unsafe workspace root');
 const canonicalRoot=await acquire(lifecycle,()=>ops.realpath(requestedRoot));
 path=resolve(path);if(path.startsWith(requestedRoot+sep))path=join(canonicalRoot,containedKey(requestedRoot,path));
 root=canonicalRoot;const key=containedKey(root,path);
 const rootStat=await acquire(lifecycle,()=>ops.lstat(root));if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw new Error('Unsafe workspace root');
 const ancestors=[[root,identity(rootStat)]];let current=root;
 for(const part of key.split('/').slice(0,-1)){lifecycle?.assertActive();current=join(current,part);const stat=await acquire(lifecycle,()=>ops.lstat(current));if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error(`Unsafe ancestor ${current}`);ancestors.push([current,identity(stat)]);}
 const stat=await acquire(lifecycle,()=>ops.lstat(path));
 if(stat.isSymbolicLink()||!(directory?stat.isDirectory():stat.isFile()))throw new Error(`Expected regular ${directory?'directory':'file'} ${path}`);
 const canonicalPath=await acquire(lifecycle,()=>ops.realpath(path));lifecycle?.assertActive();
 if(canonicalPath!==path)throw new Error(`Noncanonical contained path ${path}`);
 return {root,path,key,identity:identity(stat),ancestors};
}
export async function recheckPath(check,ops=filesystem,lifecycle){
 lifecycle?.assertActive();for(const [path,expected] of check.ancestors){const stat=await acquire(lifecycle,()=>ops.lstat(path));if(!stat.isDirectory()||stat.isSymbolicLink()||stat.dev!==expected.dev||stat.ino!==expected.ino)throw new Error(`Ancestor changed ${path}`);}
 const stat=await acquire(lifecycle,()=>ops.lstat(check.path));
 if(!stat.isFile()||stat.isSymbolicLink()||JSON.stringify(identity(stat))!==JSON.stringify(check.identity))throw new Error(`Input changed ${check.path}`);
 const canonicalPath=await acquire(lifecycle,()=>ops.realpath(check.path));lifecycle?.assertActive();
 if(canonicalPath!==check.path)throw new Error(`Input changed ${check.path}`);
}
/** Application-owned explicit reads. Node/third-party loader internals are separate. */
export async function checkedRead(root,path,ops=filesystem,lifecycle){
 lifecycle?.assertActive();const check=await checkedPath(root,path,ops,{},lifecycle);let resource,primary,failed=false,bytes,count;
 try{
  lifecycle?.assertActive();const fd=await ops.open(check.path,constants.O_RDONLY|constants.O_NOFOLLOW);
  // Adoption is the first follow-up to open, including a late open. Cleanup
  // shares this exact actual-close promise, even when adoption itself rejects.
  let closePromise;resource={name:`checked-read:${check.key}`,close(){if(!closePromise)closePromise=Promise.resolve().then(()=>fd.close());return closePromise;}};
  if(lifecycle)await lifecycle.adopt(resource);
  lifecycle?.assertActive();const opened=await acquire(lifecycle,()=>fd.stat());
  if(!opened.isFile()||JSON.stringify(identity(opened))!==JSON.stringify(check.identity))throw new Error(`Input changed before read ${path}`);
  await recheckPath(check,ops,lifecycle);
  const chunks=[];count=0;
  for(;;){lifecycle?.assertActive();const buffer=Buffer.alloc(65536),{bytesRead}=await acquire(lifecycle,()=>fd.read(buffer,0,buffer.length,null));if(!bytesRead)break;count+=bytesRead;if(count>check.identity.size)throw new Error(`Input changed size ${path}`);chunks.push(buffer.subarray(0,bytesRead));}
  if(count!==check.identity.size||JSON.stringify(identity(await acquire(lifecycle,()=>fd.stat())))!==JSON.stringify(check.identity))throw new Error(`Input changed during read ${path}`);
  await recheckPath(check,ops,lifecycle);bytes=Buffer.concat(chunks,count);
 }catch(error){primary=error;failed=true;}
 if(resource)try{await resource.close();}catch(error){if(failed&&primary!==error)throw new AggregateError([primary,error],'Read and close failed');throw error;}
 if(failed)throw primary;
 lifecycle?.assertActive(); // Pure guard after actual close; cleanup never verifies source.
 return {...check,bytes,byteLength:count,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export const checkedJSON=async(root,path,ops,lifecycle)=>{lifecycle?.assertActive();const read=await checkedRead(root,path,ops,lifecycle);lifecycle?.assertActive();return JSON.parse(read.bytes.toString('utf8'));};
export async function packagePath(name,from,ops=filesystem,lifecycle){
 lifecycle?.assertActive();const require=createRequire(from);lifecycle?.assertActive();const directories=require.resolve.paths(name)??[];lifecycle?.assertActive();
 // Exports may hide package.json or provide import-only entry points. Node's
 // package search paths still identify the actual nearest physical installation.
 for(const directory of directories){lifecycle?.assertActive();
  const path=join(directory,name,'package.json');
  try{await acquire(lifecycle,()=>ops.access(path));const canonicalDirectory=await acquire(lifecycle,()=>ops.realpath(dirname(path)));lifecycle?.assertActive();return join(canonicalDirectory,'package.json');}catch(error){lifecycle?.assertActive();if(error.code!=='ENOENT')throw error;}
 }
 return null;
}
export async function collectResolvedPackages(root,manifestPath,ops=filesystem,lifecycle){
 lifecycle?.assertActive();const key=containedKey(resolve(root),resolve(manifestPath));root=await acquire(lifecycle,()=>ops.realpath(root));manifestPath=join(root,key);
 const manifest=await checkedJSON(root,manifestPath,ops,lifecycle),lock=await checkedJSON(root,join(root,'package-lock.json'),ops,lifecycle);
 const output=new Map(),walked=new Set();
 async function visit(name,from,{optional=false,pin,recursive=true}={}){
  lifecycle?.assertActive();const path=await packagePath(name,from,ops,lifecycle);lifecycle?.assertActive();
  if(!path){if(optional)return;throw new Error(`Missing required dependency ${name} from ${relative(root,from)}`);}
  const directory=dirname(path),resolutionPath=containedKey(root,directory),installed=await checkedJSON(root,path,ops,lifecycle);
  if(resolutionPath.startsWith('../')||resolutionPath.startsWith('/')||installed.name!==name)throw new Error(`Installed package name/path differs for ${name}`);
  if(pin!==undefined&&installed.version!==pin)throw new Error(`Installed version differs from exact pin ${name}`);
  if(resolutionPath.split('/').includes('node_modules')){
   const entry=lock.packages[resolutionPath];
   if(!entry)throw new Error(`Missing lock package ${resolutionPath}`);
   if(entry.version!==installed.version)throw new Error(`Installed/lock version differs for ${resolutionPath}`);
   if(entry.name!==undefined&&entry.name!==name)throw new Error(`Installed/lock name differs for ${resolutionPath}`);
   if(!/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/.test(entry.integrity??''))throw new Error(`Missing lock integrity for ${resolutionPath}`);
   output.set(resolutionPath,{name,version:installed.version,integrity:entry.integrity,resolutionPath});
  }else{
   const entry=lock.packages[resolutionPath];
   if(!entry||entry.name!==name||entry.version!==installed.version)throw new Error(`Missing or stale workspace lock identity ${resolutionPath}`);
  }
  if(!recursive||walked.has(path))return;
  walked.add(path);
  const dependencies={...installed.dependencies,...installed.optionalDependencies,...installed.peerDependencies};
  for(const child of Object.keys(dependencies).sort()){lifecycle?.assertActive();
   const optional=Object.hasOwn(installed.optionalDependencies??{},child)||(!Object.hasOwn(installed.dependencies??{},child)&&installed.peerDependenciesMeta?.[child]?.optional===true);
   await visit(child,path,{optional});
  }
 }
 for(const name of Object.keys(manifest.dependencies??{}).sort()){lifecycle?.assertActive();await visit(name,manifestPath,{pin:manifest.dependencies[name]});}
 // Compiler/build/test direct pins are part of build identity; their whole tool
 // trees are not asserted to be browser runtime dependencies.
 for(const name of Object.keys(manifest.devDependencies??{}).sort()){lifecycle?.assertActive();await visit(name,manifestPath,{pin:manifest.devDependencies[name],recursive:false});}
 lifecycle?.assertActive();
 return [...output.values()].sort((a,b)=>a.resolutionPath.localeCompare(b.resolutionPath));
}
