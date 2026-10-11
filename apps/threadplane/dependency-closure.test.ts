import {expect,test} from 'vitest';
import * as fs from 'node:fs/promises';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
const api=await import('./dependency-closure.mjs') as any;
test('hashes checked bytes only after the real file descriptor close completes',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'close-before-hash-')),original=crypto.createHash,events:string[]=[];let closed=false;
 try{
  const file=join(root,'input');await fs.writeFile(file,'actual checked bytes');
  crypto.createHash=((...args:any[])=>{events.push(closed?'hash-after-close':'hash-before-close');return (original as any)(...args);}) as typeof original;syncBuiltinESMExports();
  const ops={...fs,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{await fd.close();closed=true;events.push('close-complete');}};}};
  expect((await api.checkedRead(root,file,ops)).bytes.toString()).toBe('actual checked bytes');
  expect(events).toEqual(['close-complete','hash-after-close']);
 }finally{crypto.createHash=original;syncBuiltinESMExports();await fs.rm(root,{recursive:true,force:true});}
});
test('does not hash acquired bytes when the real file descriptor close fails',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'close-failed-no-hash-')),original=crypto.createHash,events:string[]=[];
 try{
  const file=join(root,'input');await fs.writeFile(file,'actual checked bytes');
  crypto.createHash=((...args:any[])=>{events.push('hash');return (original as any)(...args);}) as typeof original;syncBuiltinESMExports();
  const closeFailure=new Error('actual close completion failed');
  const ops={...fs,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{await fd.close();events.push('close-failed');throw closeFailure;}};}};
  await expect(api.checkedRead(root,file,ops)).rejects.toBe(closeFailure);
  expect(events).toEqual(['close-failed']);
 }finally{crypto.createHash=original;syncBuiltinESMExports();await fs.rm(root,{recursive:true,force:true});}
});
test('checks containment and regular paths before application-owned reads',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'checked-input-')),outside=await fs.mkdtemp(join(tmpdir(),'outside-input-'));
 try {
  const file=join(root,'input');await fs.writeFile(file,'first');await fs.writeFile(join(outside,'sentinel'),'secret');
  expect(typeof api.checkedRead).toBe('function');
  expect((await api.checkedRead(root,file)).bytes.toString()).toBe('first');
  let opens=0;const ops={...fs,open:async(...args:any[])=>{opens++;return (fs.open as any)(...args);}};
  await expect(api.checkedRead(root,join(outside,'sentinel'),ops)).rejects.toThrow('contain');
  await fs.symlink(join(outside,'sentinel'),join(root,'link'));
  await expect(api.checkedRead(root,join(root,'link'),ops)).rejects.toThrow();expect(opens).toBe(0);
  await fs.symlink(outside,join(root,'dir'));
  await expect(api.checkedRead(root,join(root,'dir','sentinel'),ops)).rejects.toThrow();expect(opens).toBe(0);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});
test('detects same-size mutation and preserves genuine primary and close failures',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'checked-change-'));try{
  const file=join(root,'input');await fs.writeFile(file,'first');
  expect(typeof api.checkedRead).toBe('function');
  const ops={...fs,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:async(...readArgs:any[])=>{const result=await fd.read(...readArgs);await fs.writeFile(file,'other');return result;},close:()=>fd.close()};}};
  await expect(api.checkedRead(root,file,ops)).rejects.toThrow('changed');
  const primary=new Error('primary read failure'),close=new Error('close failure');
  const failed={...fs,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:async()=>{throw primary;},close:async()=>{await fd.close();throw close;}};}};
  await expect(api.checkedRead(root,file,failed)).rejects.toMatchObject({errors:[primary,close]});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('resolves physical workspace packages and rejects outside package metadata before controlled opens',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'checked-package-')),outside=await fs.mkdtemp(join(tmpdir(),'outside-package-'));
 try {
  await fs.mkdir(join(root,'node_modules'),{recursive:true});await fs.mkdir(join(root,'packages','p'),{recursive:true});
  const metadata={name:'p',version:'1.0.0'};await fs.writeFile(join(root,'packages/p/package.json'),JSON.stringify(metadata));
  await fs.symlink('../packages/p',join(root,'node_modules/p'));await fs.writeFile(join(root,'package.json'),JSON.stringify({dependencies:{p:'1.0.0'}}));
  await fs.writeFile(join(root,'package-lock.json'),JSON.stringify({packages:{'packages/p':metadata}}));
  expect(await api.collectResolvedPackages(root,join(root,'package.json'))).toEqual([]);
  await fs.unlink(join(root,'node_modules/p'));await fs.writeFile(join(outside,'package.json'),JSON.stringify(metadata));await fs.symlink(outside,join(root,'node_modules/p'));
  let outsideOpens=0;const ops={...fs,open:async(path:any,...args:any[])=>{if(String(path).startsWith(outside))outsideOpens++;return (fs.open as any)(path,...args);}};
  await expect(api.collectResolvedPackages(root,join(root,'package.json'),ops)).rejects.toThrow();expect(outsideOpens).toBe(0);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});
test('does not normalize a package.json symlink into an accepted regular metadata leaf',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'metadata-leaf-')));try{
  await fs.mkdir(join(root,'node_modules/p'),{recursive:true});await fs.writeFile(join(root,'node_modules/p/metadata.json'),JSON.stringify({name:'p',version:'1.0.0'}));await fs.symlink(join(root,'node_modules/p/metadata.json'),join(root,'node_modules/p/package.json'));
  await fs.writeFile(join(root,'package.json'),JSON.stringify({dependencies:{p:'1.0.0'}}));await fs.writeFile(join(root,'package-lock.json'),JSON.stringify({packages:{'node_modules/p':{version:'1.0.0',integrity:'sha512-YQ=='}}}));
  let metadataOpens=0;const ops={...fs,open:async(path:any,...args:any[])=>{if(String(path).endsWith('metadata.json'))metadataOpens++;return (fs.open as any)(path,...args);}};
  await expect(api.collectResolvedPackages(root,join(root,'package.json'),ops)).rejects.toThrow();expect(metadataOpens).toBe(0);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

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
