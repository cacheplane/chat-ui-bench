import {expect,test} from 'vitest';
import * as fs from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import * as probe from './probe-provenance.mjs';
const api=await import('./build.mjs').catch(()=>({})) as any;
async function fixture({readOnlyStyleCopy=false,historicalIdleHost=false}={}){
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'build-lineage-')));
 for(const key of probe.probeSourceKeys){await fs.mkdir(join(root,key,'..'),{recursive:true});if(key==='apps/threadplane/build.mjs')await fs.writeFile(join(root,key),'build fixture');else await fs.copyFile(resolve(key),join(root,key));}
 await fs.cp(resolve('apps/threadplane/src'),join(root,'apps/threadplane/src'),{recursive:true});
 if(readOnlyStyleCopy)await fs.chmod(join(root,'apps/threadplane/src/native-idle-host-css-v1.css'),0o444);
 // fs.cp preserves source modes; only this owned fixture copy must permit mutation controls.
 await fs.chmod(join(root,'apps/threadplane/src/native-idle-host-css-v1.css'),0o600);
 const native=`@typescript/typescript-${process.platform}-${process.arch}`;
 for(const name of ['typescript',native]){const key=`node_modules/${name}/package.json`;await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.copyFile(resolve(key),join(root,key));}
 const exe=`node_modules/${native}/lib/tsc${process.platform==='win32'?'.exe':''}`;await fs.mkdir(join(root,exe,'..'),{recursive:true});await fs.writeFile(join(root,exe),'native fixture');
 const app=join(root,'apps/threadplane'),manifest=JSON.parse(await fs.readFile(join(app,'package.json'),'utf8')),lock=JSON.parse(await fs.readFile(join(root,'package-lock.json'),'utf8'));
 const names=['@angular/core','@threadplane/chat','@threadplane/langgraph','@threadplane/render','@threadplane/telemetry'];manifest.dependencies=Object.fromEntries(names.map(name=>[name,manifest.dependencies[name]]));manifest.devDependencies={typescript:'5.9.3','@angular/cli':'21.2.26'};
 // Modified fixtures retain their historical identity independently of active stock pins.
 if(historicalIdleHost)for(const name of names.filter(name=>name.startsWith('@threadplane/')))manifest.dependencies[name]='0.3.2';
 for(const name of [...names,'typescript','@angular/cli']){const version=manifest.devDependencies[name]??manifest.dependencies[name],directory=`apps/threadplane/node_modules/${name}`,integrity=name==='@threadplane/chat'?(historicalIdleHost?'sha512-htsWljhDogT6fOsmZrOvC+wFDRPhiQR/rvfwTJ2dYd/H6MiwPm3twxSr+KdNbaNRnARb62kUvPaigm0VA3cuGw==':lock.packages[directory].integrity):'sha512-YQ==';await fs.mkdir(join(root,directory),{recursive:true});await fs.writeFile(join(root,directory,'package.json'),JSON.stringify({name,version,main:'index.js'}));await fs.writeFile(join(root,directory,'index.js'),'');lock.packages[directory]={version,integrity};}
 await fs.mkdir(join(app,'node_modules/@angular/cli/bin'));await fs.writeFile(join(app,'node_modules/@angular/cli/bin/ng.js'),'authored CLI source fixture; never executed by mocked builds');
 lock.packages['apps/threadplane']={...lock.packages['apps/threadplane'],dependencies:manifest.dependencies,devDependencies:manifest.devDependencies};
 await fs.writeFile(join(root,'package-lock.json'),JSON.stringify(lock));await fs.writeFile(join(app,'package.json'),JSON.stringify(manifest));
 // Schema imports use genuine compiled contract modules, separately from command injection.
 await fs.cp(resolve('packages/contract/dist'),join(root,'packages/contract/dist'),{recursive:true});
 await fs.symlink(resolve('node_modules/zod'),join(root,'node_modules/zod'));
 return root;
}
async function emitted(root:string){for(const key of probe.probeCompiledKeys.filter(key=>key.startsWith('packages/runner/'))){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.writeFile(join(root,key),'emitted runner fixture');}}
async function assets(root:string){await fs.mkdir(join(root,'apps/threadplane/dist'),{recursive:true});await fs.writeFile(join(root,'apps/threadplane/dist/index.html'),'<html>actual fixture bytes</html>');}
const recordPaths=['apps/threadplane/.build-evidence.json',probe.probeRecordKey];
test('native idle host stock inactive style mutation stays outside exact stock hashes and cannot grant variant identity',async()=>{
 const root=await fixture();try{
  const p=await import('./provenance.mjs') as any,key=p.nativeIdleHostVariant.styleKey;
  const expected=(await p.productSourceKeys(root)).filter((value:string)=>value!==key).concat(probe.contractCompiledKeys).sort();
  const style=join(root,key),before=await fs.readFile(style);await fs.appendFile(style,' ');expect(await fs.readFile(style)).toEqual(Buffer.concat([before,Buffer.from(' ')]));
  const calls:any[]=[];const result=await api.buildThreadplane({root,runCommand:async(command:any)=>{calls.push(command);if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  expect(Object.keys(result.product.sourceHashes).sort()).toEqual(expected);expect(result.product.sourceHashes).not.toHaveProperty(key);
  expect(calls.at(-1).args).toEqual(['build','threadplane','--configuration','production']);expect(await p.threadplaneBuildEvidence(root)).toEqual(result.product);
  await expect(p.nativeIdleHostBuildEvidence(root)).rejects.toThrow();await expect(api.buildNativeIdleHostVariant({root,runCommand:async()=>{throw Error('must not run');}})).rejects.toThrow('style bytes');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('native idle host fixture permits byte mutation after a read-only stylesheet copy',async()=>{
 const key='apps/threadplane/src/native-idle-host-css-v1.css',source=resolve(key),before=await fs.readFile(source),sourceMode=(await fs.stat(source)).mode,root=await fixture({readOnlyStyleCopy:true,historicalIdleHost:true});
 try{
  const copied=join(root,key);expect((await fs.stat(copied)).mode&0o200).toBe(0o200);expect(await fs.readFile(copied)).toEqual(before);
  await fs.appendFile(copied,' ');expect(await fs.readFile(copied)).toEqual(Buffer.concat([before,Buffer.from(' ')]));expect(await fs.readFile(source)).toEqual(before);expect((await fs.stat(source)).mode).toBe(sourceMode);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('native idle host default runner uses the app-resolved CLI despite ambient ng',async()=>{
 expect(typeof api.runNativeIdleHostCommand).toBe('function');const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'native-cli-source-control-'))),app=join(root,'apps/threadplane'),cli=join(root,'node_modules/@angular/cli'),bin=join(root,'ambient'),receipt=join(root,'receipt.json'),ambient=join(root,'ambient-used'),prior=process.env.PATH;
 try{
  await fs.mkdir(app,{recursive:true});await fs.writeFile(join(app,'package.json'),'{}');await fs.mkdir(join(cli,'bin'),{recursive:true});await fs.writeFile(join(cli,'package.json'),JSON.stringify({name:'@angular/cli',version:'21.2.26',bin:{ng:'./bin/ng.js'}}));
  await fs.writeFile(join(cli,'bin/ng.js'),`require('node:fs').writeFileSync(${JSON.stringify(receipt)},JSON.stringify({execPath:process.execPath,argv:process.argv.slice(1)}));`);
  await fs.mkdir(bin);await fs.writeFile(join(bin,'ng'),`#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(ambient)},'ambient');`,{mode:0o755});process.env.PATH=bin+':'+prior;
  const args=['build','threadplane','--configuration','production','--styles','src/styles.css','src/native-idle-host-css-v1.css'];await api.runNativeIdleHostCommand({command:'ng',args,cwd:app});
  expect(JSON.parse(await fs.readFile(receipt,'utf8'))).toEqual({execPath:process.execPath,argv:[join(cli,'bin/ng.js'),...args]});await expect(fs.access(ambient)).rejects.toThrow();
  await api.runCommand({command:'ng',args:[],cwd:app});expect(await fs.readFile(ambient,'utf8')).toBe('ambient');
 }finally{process.env.PATH=prior;await fs.rm(root,{recursive:true,force:true});}
});
test('native idle host missing app CLI resolution invalidates evidence before any command',async()=>{
 const root=await fixture({historicalIdleHost:true});try{await fs.rm(join(root,'apps/threadplane/node_modules/@angular/cli/bin/ng.js'));for(const key of recordPaths)await fs.writeFile(join(root,key),'old');let calls=0;
  await expect(api.buildNativeIdleHostVariant({root,runCommand:async(command:any)=>{calls++;if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}})).rejects.toThrow();expect(calls).toBe(0);for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('native idle host selection is explicit and publishes a distinct closed product envelope',async()=>{
 expect(typeof api.buildNativeIdleHostVariant).toBe('function');const root=await fixture({historicalIdleHost:true});try{
  const calls:any[]=[];const result=await api.buildNativeIdleHostVariant({root,runCommand:async(command:any)=>{calls.push(command);if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  expect(calls.at(-1)).toEqual({command:'ng',args:['build','threadplane','--configuration','production','--styles','src/styles.css','src/native-idle-host-css-v1.css'],cwd:join(root,'apps/threadplane')});
  expect(calls.slice(0,-1).map(c=>c.args.at(-1))).toEqual(['@chat-ui-bench/contract','@chat-ui-bench/producer','@chat-ui-bench/analyzer','@chat-ui-bench/runner']);
  const p=await import('./provenance.mjs') as any,bytes=await fs.readFile(join(root,recordPaths[0]!));
  expect(JSON.parse(bytes.toString())).toEqual({kind:'native-idle-host-css-product-v1',variant:p.nativeIdleHostVariant,angularSelection:p.nativeIdleHostAngularSelection,build:result.product});
  const contract=await import('@chat-ui-bench/contract');expect(()=>p.parseProductRecord(bytes,contract)).toThrow();
  await expect(p.threadplaneBuildEvidence(root)).rejects.toThrow();
  expect(await p.nativeIdleHostBuildEvidence(root)).toEqual(result.product);
  const helper=await fs.readFile(resolve('packages/runner/src/comparison-browser.test-helper.ts'),'utf8'),stock47=JSON.parse(helper.match(/"product47": (\[[\s\S]*?\n  \])/ )![1]!);
  expect(Object.keys(result.product.sourceHashes).sort()).toEqual([...stock47,p.nativeIdleHostVariant.styleKey].sort());expect(result.product.sourceHashes[p.nativeIdleHostVariant.styleKey]).toBe(p.nativeIdleHostVariant.styleSha256);
  await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();
  expect(await (probe as any).comparisonNativeIdleHostInstrumentationBuildEvidence(root)).toEqual(result.probe);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['pre-Angular','probe-publication','product-publication'])('native idle host inventory rejects actual style mutation at %s bookend',async stage=>{
 const root=await fixture({historicalIdleHost:true});try{
  const p=await import('./provenance.mjs') as any,style=join(root,p.nativeIdleHostVariant.styleKey),before=await fs.readFile(style);let mutated=false,angular=false;
  const mutate=async()=>{await fs.appendFile(style,' ');expect(await fs.readFile(style)).toEqual(Buffer.concat([before,Buffer.from(' ')]));mutated=true;};
  const ops={...fs,rename:async(from:any,to:any)=>{await fs.rename(from,to);if(to===join(root,stage==='probe-publication'?recordPaths[1]!:recordPaths[0]!)&&stage!=='pre-Angular')await mutate();}};
  await expect(api.buildNativeIdleHostVariant({root,ops,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner'){await emitted(root);if(stage==='pre-Angular')await mutate();}if(command.command==='ng'){angular=true;await assets(root);}}})).rejects.toThrow('style bytes');
  expect(mutated).toBe(true);expect(angular).toBe(stage!=='pre-Angular');for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each([1,2])('native idle host reader rejects actual style mutation in current inventory %s',async inventory=>{
 const root=await fixture({historicalIdleHost:true});try{
  await api.buildNativeIdleHostVariant({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  const p=await import('./provenance.mjs') as any,style=join(root,p.nativeIdleHostVariant.styleKey),before=await fs.readFile(style);let reads=0,mutated=false;
  const ops={...fs,readdir:async(path:any,...args:any[])=>{const value=await (fs.readdir as any)(path,...args);if(path===join(root,'apps/threadplane/dist')&&++reads===inventory){await fs.appendFile(style,' ');expect(await fs.readFile(style)).toEqual(Buffer.concat([before,Buffer.from(' ')]));mutated=true;}return value;}};
  const records=await Promise.all(recordPaths.map(key=>fs.readFile(join(root,key))));await expect(p.nativeIdleHostBuildEvidence(root,{ops})).rejects.toThrow('style bytes');expect(mutated).toBe(true);expect(reads).toBe(inventory);expect(await Promise.all(recordPaths.map(key=>fs.readFile(join(root,key))))).toEqual(records);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['before','during','command'])('native idle host %s failure leaves no successful evidence',async stage=>{
 expect(typeof api.buildNativeIdleHostVariant).toBe('function');const root=await fixture({historicalIdleHost:true});try{
  for(const key of recordPaths)await fs.writeFile(join(root,key),'old');
  const style=join(root,'apps/threadplane/src/native-idle-host-css-v1.css'),original=await fs.readFile(style);let mutated=false;
  const mutate=async()=>{await fs.appendFile(style,' ');expect(await fs.readFile(style)).toEqual(Buffer.concat([original,Buffer.from(' ')]));mutated=true;};
  if(stage==='before')await mutate();
  let calls=0;await expect(api.buildNativeIdleHostVariant({root,runCommand:async(command:any)=>{calls++;if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng'){if(stage==='command')throw new Error('Angular failed');await assets(root);await mutate();}}})).rejects.toThrow();
  expect(mutated).toBe(stage!=='command');expect(calls).toBe(stage==='before'?0:5);for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('cold Node-only wrapper import needs no compiled workspace dependency',async()=>{
 expect(typeof api.buildThreadplane).toBe('function');const root=await fixture();try{
  await fs.rm(join(root,'packages/contract/dist'),{recursive:true});
  await fs.copyFile(resolve('apps/threadplane/build.mjs'),join(root,'apps/threadplane/build.mjs'));
  const child=spawn(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('file://'+join(root,'apps/threadplane/build.mjs')).href)})`],{cwd:root});
  expect(await new Promise(resolve=>child.once('exit',resolve))).toBe(0);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('orders prerequisite commands, checkpoints emits before Angular, and publishes genuine canonical records',async()=>{
 expect(typeof api.buildThreadplane).toBe('function');const root=await fixture();try{
  const calls:string[]=[];await api.buildThreadplane({root,runCommand:async(command:any)=>{calls.push(command.args.join(' '));if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  expect(calls).toEqual(['run build --workspace @chat-ui-bench/contract','run build --workspace @chat-ui-bench/producer','run build --workspace @chat-ui-bench/analyzer','run build --workspace @chat-ui-bench/runner','build threadplane --configuration production']);
  const instrumentation=await probe.comparisonInstrumentationBuildEvidence(root);expect(instrumentation).toMatchObject({compiler:{version:'7.0.2'}});
  const product=await (await import('./provenance.mjs')).threadplaneBuildEvidence(root);
 expect(product.packages.find((p:any)=>p.name==='@threadplane/chat').version).toBe('0.3.3');
  expect(product.packages.find((p:any)=>p.name==='typescript').version).toBe('5.9.3');
  for(const key of probe.contractCompiledKeys)expect(product.sourceHashes[key]).toBe(instrumentation.compiledHashes[key]);
  expect(Object.keys(product.sourceHashes).some(key=>key.startsWith('packages/runner/dist/'))).toBe(false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['prerequisite-1','prerequisite-2','prerequisite-3','prerequisite-4','angular','signal','packages/contract/src/comparison-buffer.ts','tsconfig.base.json','node_modules/typescript/package.json','apps/threadplane/node_modules/typescript/package.json','packages/contract/dist/comparison-buffer.js'])('invalidates old success before commands and aborts %s',async change=>{
 expect(typeof api.buildThreadplane).toBe('function');
  const root=await fixture();try{
   for(const key of recordPaths)await fs.writeFile(join(root,key),'old record');let calls=0;
   await expect(api.buildThreadplane({root,runCommand:async(command:any)=>{
    calls++;for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
    if(change.startsWith('prerequisite-')&&calls===Number(change.split('-')[1]))throw new Error('prerequisite failed');
    if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);
    if(command.command==='ng'){if(['angular','signal'].includes(change))throw new Error(change+' failed');await assets(root);const path=join(root,change),bytes=await fs.readFile(path);await fs.writeFile(path,Buffer.concat([bytes,Buffer.from(' ')]));}
   }})).rejects.toThrow();expect(calls).toBe(change.startsWith('prerequisite-')?Number(change.split('-')[1]):5);
   for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('checked invalidation failure aborts before compilation; a consistent prior pair cannot attest latest-command success',async()=>{
 expect(typeof api.buildThreadplane).toBe('function');const root=await fixture();try{
  await api.buildThreadplane({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  let calls=0;const denied=new Error('actual unlink denied');
  await expect(api.buildThreadplane({root,ops:{...fs,unlink:async()=>{throw denied;}},runCommand:async()=>{calls++;}})).rejects.toBe(denied);expect(calls).toBe(0);
  // Both unchanged records still truthfully describe the earlier successful sequence.
  expect(await probe.comparisonInstrumentationBuildEvidence(root)).toBeDefined();expect(await (await import('./provenance.mjs')).threadplaneBuildEvidence(root)).toBeDefined();
  await expect(api.buildThreadplane({root,ops:{...fs,unlink:async(path:any)=>{if(String(path).endsWith(probe.probeRecordKey))throw denied;return fs.unlink(path);}},runCommand:async()=>{calls++;}})).rejects.toBe(denied);expect(calls).toBe(0);
  await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();await expect(fs.access(join(root,recordPaths[0]!))).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['open','write','sync','rename','second-rename','directory-sync','close'])('publication %s errors are preserved and incomplete pair acquisition rejects',async stage=>{
 expect(typeof api.buildThreadplane).toBe('function');
 const root=await fixture();try{
  const failed=new Error(stage+' publication failure');const ops={...fs,
   open:async(path:any,...args:any[])=>{if(String(path).endsWith('.tmp')&&stage==='open')throw failed;const fd=await (fs.open as any)(path,...args);const temp=String(path).endsWith('.tmp');if(!temp&&!(stage==='directory-sync'&&String(path)===join(root,'packages/runner')))return fd;return {stat:()=>fd.stat(),read:(...a:any[])=>fd.read(...a),writeFile:async(...a:any[])=>{if(temp&&stage==='write'){await fd.writeFile(Buffer.from('partial'));throw failed;}return fd.writeFile(...a);},sync:async()=>{if(temp&&stage==='sync'||!temp&&stage==='directory-sync')throw failed;return fd.sync();},close:async()=>{await fd.close();if(temp&&stage==='close')throw failed;}};},
   rename:async(...args:any[])=>{if(stage==='rename'||stage==='second-rename'&&String(args[1]).endsWith('apps/threadplane/.build-evidence.json'))throw failed;return (fs.rename as any)(...args);}};
  await expect(api.buildThreadplane({root,ops,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}})).rejects.toBe(failed);
  await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('publication rejects same-byte temporary replacement rather than publishing a different file identity',async()=>{
 const root=await fixture();try{
  const ops={...fs,open:async(path:any,...args:any[])=>{const fd=await (fs.open as any)(path,...args);if(!String(path).endsWith('.tmp'))return fd;return {
   stat:()=>fd.stat(),read:(...a:any[])=>fd.read(...a),writeFile:async(bytes:any)=>{await fd.writeFile(bytes);await fs.rename(path,path+'.saved');await fs.writeFile(path,bytes);},sync:()=>fd.sync(),close:()=>fd.close(),
  };}};
  await expect(api.buildThreadplane({root,ops,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}})).rejects.toThrow('temporary');
  for(const key of recordPaths)await expect(fs.access(join(root,key))).rejects.toThrow();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('real command runner rejects nonzero exits and terminating signals',async()=>{
 expect(typeof api.runCommand).toBe('function');
 await expect(api.runCommand({command:process.execPath,args:['-e','process.exit(7)'],cwd:process.cwd()})).rejects.toThrow('7');
 await expect(api.runCommand({command:process.execPath,args:['-e',"process.kill(process.pid,'SIGTERM')"],cwd:process.cwd()})).rejects.toThrow('SIGTERM');
});
test.each(['old21','missing','extra','duplicate','missing-lf','whitespace'])('read-only acquisition rejects product record %s',async mode=>{
 const root=await fixture();try{
  await api.buildThreadplane({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  const productApi=await import('./provenance.mjs'),{canonicalSerialize}=await import('@chat-ui-bench/contract');
  const productPath=join(root,recordPaths[0]!),probePath=join(root,recordPaths[1]!),productBytes=await fs.readFile(productPath),probeBytes=await fs.readFile(probePath);
  const product=JSON.parse(productBytes.toString()),record=JSON.parse(probeBytes.toString());
   const altered=structuredClone(product);
   if(mode==='old21')altered.sourceHashes=Object.fromEntries(Object.entries(altered.sourceHashes).slice(0,21));
   if(mode==='missing')delete altered.sourceHashes['packages/contract/dist/comparison-buffer.js'];
   if(mode==='extra')altered.sourceHashes['fake-source.ts']='a'.repeat(64);
   let bytes=Buffer.from(JSON.stringify(altered,null,2)+'\n');
   if(mode==='duplicate')bytes=Buffer.from(productBytes.toString().replace('"production": true','"production": true, "production": true'));
   if(mode==='missing-lf')bytes=productBytes.subarray(0,productBytes.length-1);
   if(mode==='whitespace')bytes=Buffer.from(productBytes.toString()+' ');
   await fs.writeFile(productPath,bytes);await expect(productApi.threadplaneBuildEvidence(root)).rejects.toThrow();await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();await fs.writeFile(productPath,productBytes);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['missing','extra','duplicate','mismatch','no-product'])('read-only acquisition rejects probe record %s',async mode=>{
 const root=await fixture();try{
  await api.buildThreadplane({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  const productApi=await import('./provenance.mjs'),{canonicalSerialize}=await import('@chat-ui-bench/contract');
  const productPath=join(root,recordPaths[0]!),probePath=join(root,recordPaths[1]!),productBytes=await fs.readFile(productPath),probeBytes=await fs.readFile(probePath);
  const product=JSON.parse(productBytes.toString()),record=JSON.parse(probeBytes.toString());
   const altered=structuredClone(record);
   if(mode==='missing')delete altered.compiledHashes['packages/runner/dist/comparison-installer.js'];
   if(mode==='extra')altered.compiledHashes['nonexistent-future-worker.js']='a'.repeat(64);
   if(mode==='mismatch')altered.compiledHashes['packages/contract/dist/comparison-buffer.js']='b'.repeat(64);
   const bytes=mode==='duplicate'?Buffer.from(probeBytes.toString().replace('"formatVersion":1','"formatVersion":1,"formatVersion":1')):Buffer.from(canonicalSerialize(altered)+'\n');
   await fs.writeFile(probePath,bytes);if(mode==='no-product')await fs.unlink(productPath);
   await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();await fs.writeFile(probePath,probeBytes);await fs.writeFile(productPath,productBytes);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test.each(['packages/contract/src/comparison-buffer.ts','packages/contract/src/comparison-installer-options.ts','packages/contract/src/presentation.ts','packages/contract/dist/comparison-buffer.js','packages/runner/dist/comparison-installer.js'])('read-only acquisition rejects mutated input %s',async key=>{
 const root=await fixture();try{
  await api.buildThreadplane({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  const productApi=await import('./provenance.mjs');
   const path=join(root,key),bytes=await fs.readFile(path);await fs.writeFile(path,Buffer.concat([bytes,Buffer.from(' ')]));
   await expect(probe.comparisonInstrumentationBuildEvidence(root)).rejects.toThrow();
   if(!key.startsWith('packages/runner/'))await expect(productApi.threadplaneBuildEvidence(root)).rejects.toThrow();
   await fs.writeFile(path,bytes);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('read-only acquisition preserves the legacy app compiler metadata whitespace boundary',async()=>{
 const root=await fixture();try{
  await api.buildThreadplane({root,runCommand:async(command:any)=>{if(command.args.at(-1)==='@chat-ui-bench/runner')await emitted(root);if(command.command==='ng')await assets(root);}});
  const productApi=await import('./provenance.mjs');
  // Legacy AdapterBuild pins app tool name/version/lock integrity, not metadata bytes.
  const appTool=join(root,'apps/threadplane/node_modules/typescript/package.json'),metadata=await fs.readFile(appTool);await fs.writeFile(appTool,Buffer.concat([metadata,Buffer.from(' ')]));
  expect(await productApi.threadplaneBuildEvidence(root)).toBeDefined();expect(await probe.comparisonInstrumentationBuildEvidence(root)).toBeDefined();
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('physical duplicate Angular instance and unsafe generated record reject before compilation',async()=>{
 const root=await fixture();try{
  const productApi=await import('./provenance.mjs');
  const physical=join(root,'apps/threadplane/node_modules/@threadplane/chat/node_modules/@angular/core');await fs.mkdir(physical,{recursive:true});await fs.writeFile(join(physical,'package.json'),JSON.stringify({name:'@angular/core',version:'21.2.25'}));
  await expect(productApi.snapshotProductInputs(root)).rejects.toThrow('Duplicate Angular');await fs.rm(join(root,'apps/threadplane/node_modules/@threadplane/chat/node_modules'),{recursive:true});
  const outside=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'outside-record-')));try{
   await fs.writeFile(join(outside,'sentinel'),'unchanged outside bytes');await fs.symlink(join(outside,'sentinel'),join(root,recordPaths[0]!));let calls=0;
   await expect(api.buildThreadplane({root,runCommand:async()=>{calls++;}})).rejects.toThrow();expect(calls).toBe(0);expect(await fs.readFile(join(outside,'sentinel'),'utf8')).toBe('unchanged outside bytes');
  }finally{await fs.rm(outside,{recursive:true,force:true});}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
