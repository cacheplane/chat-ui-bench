import {expect,test} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const api=await import('./dependency-closure.mjs').catch(()=>({})) as any;
test('captures multiple physical versions, hidden package metadata and workspace production closure; rejects missing or stale closure',async()=>{
 const root=await mkdtemp(join(tmpdir(),'threadplane-dependency-test-'));
 try{
  const packages:Record<string,any>={};
  async function pkg(path:string,name:string,version:string,extra:any={}){
   await mkdir(join(root,path),{recursive:true});await writeFile(join(root,path,'package.json'),JSON.stringify({name,version,exports:{'.':'./index.js'},...extra}));await writeFile(join(root,path,'index.js'),'');packages[path]={version,integrity:'sha512-example'};
  }
  await pkg('node_modules/a','a','1.0.0',{dependencies:{queue:'1.0.0'},optionalDependencies:{absent:'1.0.0'}});
  await pkg('node_modules/a/node_modules/queue','queue','1.0.0');
  await pkg('node_modules/b','b','1.0.0',{dependencies:{queue:'2.0.0'}});
  await pkg('node_modules/b/node_modules/queue','queue','2.0.0');
  await mkdir(join(root,'packages/contract'),{recursive:true});await writeFile(join(root,'packages/contract/package.json'),JSON.stringify({name:'@fixture/contract',version:'1.0.0',dependencies:{workspaceChild:'1.0.0'}}));
  packages['packages/contract']={name:'@fixture/contract',version:'1.0.0'};
  await mkdir(join(root,'node_modules/@fixture'),{recursive:true});await symlink(join(root,'packages/contract'),join(root,'node_modules/@fixture/contract'));
  await pkg('node_modules/workspaceChild','workspaceChild','1.0.0');
  await mkdir(join(root,'apps/app'),{recursive:true});
  const manifestPath=join(root,'apps/app/package.json');await writeFile(manifestPath,JSON.stringify({dependencies:{a:'1.0.0',b:'1.0.0','@fixture/contract':'1.0.0'}}));
  const lockPath=join(root,'package-lock.json');const save=()=>writeFile(lockPath,JSON.stringify({packages}));await save();
  expect(typeof api.collectResolvedPackages).toBe('function');
  const result=await api.collectResolvedPackages(root,manifestPath);
  expect(result.some((p:any)=>p.name==='workspaceChild')).toBe(true);expect(result.some((p:any)=>p.name==='@fixture/contract')).toBe(false);
  expect(result.filter((p:any)=>p.name==='queue')).toEqual([{name:'queue',version:'1.0.0',integrity:'sha512-example',resolutionPath:'node_modules/a/node_modules/queue'},{name:'queue',version:'2.0.0',integrity:'sha512-example',resolutionPath:'node_modules/b/node_modules/queue'}]);
  packages['node_modules/b/node_modules/queue'].version='3.0.0';await save();await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('version');
  packages['node_modules/b/node_modules/queue'].version='2.0.0';delete packages['node_modules/b/node_modules/queue'].integrity;await save();await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('integrity');
  packages['node_modules/b/node_modules/queue'].integrity='sha512-example';packages['node_modules/b/node_modules/queue'].name='wrong';await save();await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('name');delete packages['node_modules/b/node_modules/queue'].name;await save();
  await writeFile(join(root,'node_modules/a/package.json'),JSON.stringify({name:'a',version:'1.0.0',dependencies:{queue:'1.0.0',requiredPeer:'1.0.0'},peerDependencies:{requiredPeer:'1.0.0'},peerDependenciesMeta:{requiredPeer:{optional:true}}}));
  await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('Missing required dependency requiredPeer');
  await writeFile(join(root,'node_modules/a/package.json'),JSON.stringify({name:'a',version:'1.0.0',dependencies:{queue:'1.0.0'}}));
  packages['node_modules/b/node_modules/queue'].version='2.0.0';delete packages['node_modules/a/node_modules/queue'];await save();await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('lock');
  await rm(join(root,'node_modules/a/node_modules/queue'),{recursive:true});await expect(api.collectResolvedPackages(root,manifestPath)).rejects.toThrow('Missing required');
 }finally{await rm(root,{recursive:true,force:true});}
});
