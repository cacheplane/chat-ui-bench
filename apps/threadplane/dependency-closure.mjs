import {readFile,realpath,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,relative,sep} from 'node:path';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
async function packagePath(name,from){
 const require=createRequire(from);
 try{return await realpath(require.resolve(`${name}/package.json`));}
 catch(error){if(!['ERR_PACKAGE_PATH_NOT_EXPORTED','MODULE_NOT_FOUND','ERR_PACKAGE_IMPORT_NOT_DEFINED'].includes(error.code))throw error;}
 // Exports may hide package.json or provide import-only entry points. Node's
 // package search paths still identify the actual nearest physical installation.
 for(const directory of require.resolve.paths(name)??[]){
  const path=join(directory,name,'package.json');
  try{await access(path);return await realpath(path);}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return null;
}
export async function collectResolvedPackages(root,manifestPath){
 root=await realpath(root);
 const manifest=await json(manifestPath),lock=await json(join(root,'package-lock.json'));
 const output=new Map(),walked=new Set();
 async function visit(name,from,{optional=false,pin,recursive=true}={}){
  const path=await packagePath(name,from);
  if(!path){if(optional)return;throw new Error(`Missing required dependency ${name} from ${relative(root,from)}`);}
  const installed=await json(path),directory=dirname(path),resolutionPath=relative(root,directory).split(sep).join('/');
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
