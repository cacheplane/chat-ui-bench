import {expect,test} from 'vitest';
import * as fs from 'node:fs/promises';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
const api=await import('./dependency-closure.mjs') as any;
const {ComparisonOwnership}=await import('../../packages/runner/dist/comparison-ownership.js');
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
function controls(expireAt=Infinity){
 let active=true;const revoked=new Error('test generation revoked'),ledger:string[]=[],resources:any[]=[];
 const lifecycle={assertActive(){if(!active)throw revoked;},async adopt(resource:any){resources.push(resource);if(!active){await resource.close();throw revoked;}}};
 const acquire=async(name:string,operation:()=>Promise<any>)=>{ledger.push(name);expect(active,`acquisition after revocation: ${name}`).toBe(true);try{return await operation();}finally{if(ledger.length===expireAt)active=false;}};
 const ops={...fs,...Object.fromEntries(['lstat','realpath','access','readdir'].map(name=>[name,(...args:any[])=>acquire(name,()=> (fs as any)[name](...args))])),open:(...args:any[])=>acquire('open',async()=>{const fd=await (fs.open as any)(...args);return {stat:()=>acquire('stat',()=>fd.stat()),read:(...args:any[])=>acquire('read',()=>fd.read(...args)),close:()=>fd.close()};})};
 return {ops,lifecycle,ledger,resources,revoked,revoke(){active=false;}};
}
test.each(['checkedPath','recheckPath','packagePath'])('owned checker %s rejects terminal wrapper continuation revoked between microtasks',async name=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-terminal-'))),leaf=join(root,'leaf'),packageDirectory=join(root,'node_modules/p');
 try{
  await fs.writeFile(leaf,'real bytes');await fs.mkdir(packageDirectory,{recursive:true});await fs.writeFile(join(packageDirectory,'package.json'),JSON.stringify({name:'p',version:'1.0.0'}));
  const check=await api.checkedPath(root,leaf),target=name==='packagePath'?packageDirectory:leaf,revoked=new Error('terminal generation revoked'),ledger:string[]=[];let active=true,revocationIndex=-1;
  const lifecycle={assertActive(){ledger.push(`assert:${active}`);if(!active)throw revoked;},async adopt(){throw new Error('terminal path operations open no FD');}};
  const ops={...fs,...Object.fromEntries(['lstat','access'].map(operation=>[operation,async(path:any)=>{expect(active).toBe(true);ledger.push(`${operation}:${path}`);return (fs as any)[operation](path);} ])),async realpath(path:any){
   expect(active).toBe(true);ledger.push(`realpath:${path}`);const result=await fs.realpath(path);
   if(path===target)queueMicrotask(()=>queueMicrotask(()=>{active=false;revocationIndex=ledger.length;ledger.push('revoked');}));
   return result;
  }};
  const operation=name==='checkedPath'?api.checkedPath(root,leaf,ops,{},lifecycle):name==='recheckPath'?api.recheckPath(check,ops,lifecycle):api.packagePath('p',leaf,ops,lifecycle);
  await expect(operation).rejects.toBe(revoked);expect(active).toBe(false);expect(revocationIndex).toBeGreaterThan(0);expect(ledger.slice(revocationIndex)).toContain('assert:false');expect(ledger.slice(revocationIndex).some(entry=>/^(lstat|realpath|access):/.test(entry))).toBe(false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker already revoked entry acquires nothing and directory options remain separate',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-entry-')));try{
  const path=join(root,'input');await fs.writeFile(path,'{}');await fs.mkdir(join(root,'directory'));
  const check=await api.checkedPath(root,path),c=controls();c.revoke();
  for(const run of [()=>api.checkedPath(root,path,c.ops,{},c.lifecycle),()=>api.recheckPath(check,c.ops,c.lifecycle),()=>api.checkedRead(root,path,c.ops,c.lifecycle),()=>api.checkedJSON(root,path,c.ops,c.lifecycle),()=>api.packagePath('p',path,c.ops,c.lifecycle),()=>api.collectResolvedPackages(root,path,c.ops,c.lifecycle)])await expect(run()).rejects.toBe(c.revoked);
  expect(c.ledger).toEqual([]);const live=controls();expect((await api.checkedPath(root,join(root,'directory'),live.ops,{directory:true},live.lifecycle)).key).toBe('directory');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['path','recheck','read','packages'])('owned checker guards every reached %s acquisition after expiry',async(kind)=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-edges-')));try{
  await fs.mkdir(join(root,'node_modules/p/node_modules/q'),{recursive:true});await fs.mkdir(join(root,'node_modules/r'),{recursive:true});
  for(const [key,value] of Object.entries({'input':'x'.repeat(131073),'package.json':JSON.stringify({dependencies:{p:'1.0.0'},devDependencies:{r:'1.0.0'}}),'node_modules/p/package.json':JSON.stringify({name:'p',version:'1.0.0',dependencies:{q:'1.0.0'},optionalDependencies:{'owned-missing-optional-package':'1.0.0'}}),'node_modules/p/node_modules/q/package.json':JSON.stringify({name:'q',version:'1.0.0'}),'node_modules/r/package.json':JSON.stringify({name:'r',version:'1.0.0'}),'package-lock.json':JSON.stringify({packages:{'node_modules/p':{version:'1.0.0',integrity:'sha512-YQ=='},'node_modules/p/node_modules/q':{version:'1.0.0',integrity:'sha512-YQ=='},'node_modules/r':{version:'1.0.0',integrity:'sha512-YQ=='}}})}))await fs.writeFile(join(root,key),value);
  const check=await api.checkedPath(root,join(root,'input'));
  const run=(c:ReturnType<typeof controls>)=>kind==='path'?api.checkedPath(root,join(root,'input'),c.ops,{},c.lifecycle):kind==='recheck'?api.recheckPath(check,c.ops,c.lifecycle):kind==='read'?api.checkedRead(root,join(root,'input'),c.ops,c.lifecycle):api.collectResolvedPackages(root,join(root,'package.json'),c.ops,c.lifecycle);
  const baseline=controls();await run(baseline);
  for(let index=1;index<=baseline.ledger.length;index++){const c=controls(index);await expect(run(c),`expiry at ${kind} ${index} ${baseline.ledger[index-1]}`).rejects.toBe(c.revoked);expect(c.ledger).toEqual(baseline.ledger.slice(0,index));for(const resource of c.resources)await resource.close();}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker adopts an actual late opened FD before stat or active assertion',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-late-'))),opened=deferred(),release=deferred();let closes=0,stats=0,fd:any;
 try{
  const path=join(root,'input');await fs.writeFile(path,'late');const c=controls();
  const ops={...c.ops,open:async(...args:any[])=>{fd=await (fs.open as any)(...args);opened.resolve();await release.promise;return {stat:()=>{stats++;return fd.stat();},read:(...args:any[])=>fd.read(...args),close:async()=>{closes++;await fd.close();}};}};
  const result=api.checkedRead(root,path,ops,c.lifecycle);const rejected=expect(result).rejects.toBe(c.revoked);await opened.promise;c.revoke();release.resolve();await rejected;
  expect(stats).toBe(0);expect(c.resources).toHaveLength(1);await expect(fd.stat()).rejects.toMatchObject({code:'EBADF'});await c.resources[0].close();expect(closes).toBe(1);
 }finally{release.resolve();if(fd?.fd!==-1)await fd?.close();await fs.rm(root,{recursive:true,force:true});}
});
test.each([false,true])('owned checker shares actual pending and rejected close with disposal (failure=%s)',async(fail)=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-close-'))),closing=deferred(),release=deferred();let closes=0,settled=false,fd:any;
 try{
  const path=join(root,'input');await fs.writeFile(path,'bytes');const c=controls(),failure=new Error('actual close failure');
  const ops={...c.ops,open:async(...args:any[])=>{fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{closes++;closing.resolve();await release.promise;await fd.close();if(fail)throw failure;}};}};
  const result=api.checkedRead(root,path,ops,c.lifecycle);void result.then(()=>{settled=true;},()=>{settled=true;});await closing.promise;
  expect(c.resources).toHaveLength(1);const first=c.resources[0].close(),second=c.resources[0].close();expect(first).toBe(second);expect(settled).toBe(false);
  const proof=fail?expect(result).rejects.toBe(failure):expect(result).resolves.toMatchObject({byteLength:5});const closeProof=fail?expect(first).rejects.toBe(failure):first;
  release.resolve();await proof;await closeProof;expect(closes).toBe(1);if(fail)await expect(c.resources[0].close()).rejects.toBe(failure);
 }finally{release.resolve();if(fd?.fd!==-1)await fd?.close();await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker close completed after revocation cannot create a successful hash',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-post-close-'))),closing=deferred(),release=deferred(),original=crypto.createHash;let hashes=0,fd:any;
 try{
  const path=join(root,'input');await fs.writeFile(path,'bytes');const c=controls();
  crypto.createHash=((...args:any[])=>{hashes++;return (original as any)(...args);}) as typeof original;syncBuiltinESMExports();
  const ops={...c.ops,open:async(...args:any[])=>{fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{closing.resolve();await release.promise;await fd.close();}};}};
  const read=api.checkedRead(root,path,ops,c.lifecycle),proof=expect(read).rejects.toBe(c.revoked);await closing.promise;const acquisitions=[...c.ledger];c.revoke();release.resolve();await proof;
  expect(hashes).toBe(0);expect(c.ledger).toEqual(acquisitions);await expect(fd.stat()).rejects.toMatchObject({code:'EBADF'});
 }finally{release.resolve();crypto.createHash=original;syncBuiltinESMExports();if(fd?.fd!==-1)await fd?.close();await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker preserves primary and distinct close failure without duplicating identical causes',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-errors-')));try{
  const path=join(root,'input');await fs.writeFile(path,'bytes');const primary=new Error('read failed'),close=new Error('close failed');
  for(const same of [false,true]){
   const c=controls(),ops={...c.ops,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args);return {stat:()=>fd.stat(),read:async()=>{throw primary;},close:async()=>{await fd.close();throw same?primary:close;}};}};
   const read=api.checkedRead(root,path,ops,c.lifecycle);if(same)await expect(read).rejects.toBe(primary);else await expect(read).rejects.toMatchObject({errors:[primary,close]});
   await expect(c.resources[0].close()).rejects.toBe(same?primary:close);
  }
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker actual ownership starts independent FD closes while one close remains pending and unsafe',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-independent-'))),firstClosing=deferred(),secondClosed=deferred(),release=deferred();let now=0,closes=0,settled=false;const failure=new Error('first close failed');
 const owner=new ComparisonOwnership({now:()=>now});let operation:any,disposal:any;
 try{
  await fs.writeFile(join(root,'a'),'first');await fs.writeFile(join(root,'b'),'second');
  const ops={...fs,open:async(...args:any[])=>{const fd=await (fs.open as any)(...args),first=String(args[0]).endsWith('/a');return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{closes++;if(first){firstClosing.resolve();await release.promise;}await fd.close();if(first)throw failure;secondClosed.resolve();}};}};
  operation=owner.run('setup',async context=>Promise.allSettled([api.checkedRead(root,join(root,'a'),ops,context),api.checkedRead(root,join(root,'b'),ops,context)]));
  await firstClosing.promise;now=60000;disposal=owner.dispose();void owner.ownershipSettled.then(()=>{settled=true;});await secondClosed.promise;expect(settled).toBe(false);expect(closes).toBe(2);
  release.resolve();await operation;expect((await disposal).status).toBe('failed');await owner.ownershipSettled;expect(owner.canContinue).toBe(false);expect(owner.failures.some((row:any)=>row.message===failure.message)).toBe(true);expect(closes).toBe(2);
 }finally{release.resolve();await operation;await disposal;await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker actual late adoption retains rejected close despite owner failure tracking',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-owner-late-'))),opened=deferred(),release=deferred();let now=0,fd:any,closes=0;const owner=new ComparisonOwnership({now:()=>now}),failure=new Error('late actual close failed');let observed:any,operation:any;
 try{
  const path=join(root,'input');await fs.writeFile(path,'late');const ops={...fs,open:async(...args:any[])=>{fd=await (fs.open as any)(...args);opened.resolve();await release.promise;return {stat:()=>fd.stat(),read:(...args:any[])=>fd.read(...args),close:async()=>{closes++;await fd.close();throw failure;}};}};
  operation=owner.run('setup',async context=>{try{return await api.checkedRead(root,path,ops,context);}catch(error){observed=error;throw error;}});await opened.promise;now=60000;release.resolve();expect((await operation).status).toBe('failed');
  expect(observed.errors[1]).toBe(failure);expect(closes).toBe(1);expect((await owner.dispose()).status).toBe('failed');expect(owner.canContinue).toBe(false);await expect(fd.stat()).rejects.toMatchObject({code:'EBADF'});
 }finally{release.resolve();await operation;if(fd?.fd!==-1)await fd?.close();await fs.rm(root,{recursive:true,force:true});}
});
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
