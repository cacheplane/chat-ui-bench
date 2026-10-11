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
export async function checkedPath(root,path,ops=filesystem,{directory=false}={}){
 const requestedRoot=resolve(root),requestedStat=await ops.lstat(requestedRoot);
 if(!requestedStat.isDirectory()||requestedStat.isSymbolicLink())throw new Error('Unsafe workspace root');
 const canonicalRoot=await ops.realpath(requestedRoot);
 path=resolve(path);if(path.startsWith(requestedRoot+sep))path=join(canonicalRoot,containedKey(requestedRoot,path));
 root=canonicalRoot;const key=containedKey(root,path);
 const rootStat=await ops.lstat(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw new Error('Unsafe workspace root');
 const ancestors=[[root,identity(rootStat)]];let current=root;
 for(const part of key.split('/').slice(0,-1)){current=join(current,part);const stat=await ops.lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error(`Unsafe ancestor ${current}`);ancestors.push([current,identity(stat)]);}
 const stat=await ops.lstat(path);
 if(stat.isSymbolicLink()||!(directory?stat.isDirectory():stat.isFile()))throw new Error(`Expected regular ${directory?'directory':'file'} ${path}`);
 if(await ops.realpath(path)!==path)throw new Error(`Noncanonical contained path ${path}`);
 return {root,path,key,identity:identity(stat),ancestors};
}
export async function recheckPath(check,ops=filesystem){
 for(const [path,expected] of check.ancestors){const stat=await ops.lstat(path);if(!stat.isDirectory()||stat.isSymbolicLink()||stat.dev!==expected.dev||stat.ino!==expected.ino)throw new Error(`Ancestor changed ${path}`);}
 const stat=await ops.lstat(check.path);
 if(!stat.isFile()||stat.isSymbolicLink()||JSON.stringify(identity(stat))!==JSON.stringify(check.identity)||await ops.realpath(check.path)!==check.path)throw new Error(`Input changed ${check.path}`);
}
/** Application-owned explicit reads. Node/third-party loader internals are separate. */
export async function checkedRead(root,path,ops=filesystem){
 const check=await checkedPath(root,path,ops);let fd,primary,bytes,count;
 try{
  fd=await ops.open(check.path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const opened=await fd.stat();
  if(!opened.isFile()||JSON.stringify(identity(opened))!==JSON.stringify(check.identity))throw new Error(`Input changed before read ${path}`);
  await recheckPath(check,ops);
  const chunks=[];count=0;
  for(;;){const buffer=Buffer.alloc(65536),{bytesRead}=await fd.read(buffer,0,buffer.length,null);if(!bytesRead)break;count+=bytesRead;if(count>check.identity.size)throw new Error(`Input changed size ${path}`);chunks.push(buffer.subarray(0,bytesRead));}
  if(count!==check.identity.size||JSON.stringify(identity(await fd.stat()))!==JSON.stringify(check.identity))throw new Error(`Input changed during read ${path}`);
  await recheckPath(check,ops);bytes=Buffer.concat(chunks,count);
 }catch(error){primary=error;}
 if(fd)try{await fd.close();}catch(error){if(primary)throw new AggregateError([primary,error],'Read and close failed');throw error;}
 if(primary)throw primary;
 return {...check,bytes,byteLength:count,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export const checkedJSON=async(root,path,ops)=>JSON.parse((await checkedRead(root,path,ops)).bytes.toString('utf8'));
export async function packagePath(name,from,ops=filesystem){
 const require=createRequire(from);
 // Exports may hide package.json or provide import-only entry points. Node's
 // package search paths still identify the actual nearest physical installation.
 for(const directory of require.resolve.paths(name)??[]){
  const path=join(directory,name,'package.json');
  try{await ops.access(path);return join(await ops.realpath(dirname(path)),'package.json');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return null;
}
export async function collectResolvedPackages(root,manifestPath,ops=filesystem){
 const key=containedKey(resolve(root),resolve(manifestPath));root=await ops.realpath(root);manifestPath=join(root,key);
 const manifest=await checkedJSON(root,manifestPath,ops),lock=await checkedJSON(root,join(root,'package-lock.json'),ops);
 const output=new Map(),walked=new Set();
 async function visit(name,from,{optional=false,pin,recursive=true}={}){
  const path=await packagePath(name,from,ops);
  if(!path){if(optional)return;throw new Error(`Missing required dependency ${name} from ${relative(root,from)}`);}
  const directory=dirname(path),resolutionPath=containedKey(root,directory),installed=await checkedJSON(root,path,ops);
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
  for(const child of Object.keys(dependencies).sort()){
   const optional=Object.hasOwn(installed.optionalDependencies??{},child)||(!Object.hasOwn(installed.dependencies??{},child)&&installed.peerDependenciesMeta?.[child]?.optional===true);
   await visit(child,path,{optional});
  }
 }
 for(const name of Object.keys(manifest.dependencies??{}).sort())await visit(name,manifestPath,{pin:manifest.dependencies[name]});
 // Compiler/build/test direct pins are part of build identity; their whole tool
 // trees are not asserted to be browser runtime dependencies.
 for(const name of Object.keys(manifest.devDependencies??{}).sort())await visit(name,manifestPath,{pin:manifest.devDependencies[name],recursive:false});
 return [...output.values()].sort((a,b)=>a.resolutionPath.localeCompare(b.resolutionPath));
}
