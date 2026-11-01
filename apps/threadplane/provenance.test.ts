import { expect, test } from 'vitest';
import { adapterBuildSchema } from '@chat-ui-bench/contract';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const probe=await import('./probe-provenance.mjs');
const {ComparisonOwnership}=await import('../../packages/runner/dist/comparison-ownership.js');
async function productFixture(){
 const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'owned-product-'))),app=join(root,'apps/threadplane');
 for(const key of [...probe.commonBuildKeys,...probe.contractSourceKeys]){await fs.mkdir(join(root,key,'..'),{recursive:true});await fs.copyFile(resolve(key),join(root,key));}
 await fs.mkdir(join(app,'src/nested'),{recursive:true});await fs.writeFile(join(app,'src/host.ts'),'source');await fs.writeFile(join(app,'src/nested/child.ts'),'child');await fs.writeFile(join(app,'src/host.test.ts'),'excluded');
 await fs.mkdir(join(app,'dist'),{recursive:true});await fs.writeFile(join(app,'dist/index.html'),'fixture asset');
 const packages:Record<string,any>={},dependencies:Record<string,string>={};
 for(const name of ['@angular/core','@threadplane/chat','@threadplane/langgraph','@threadplane/render','@threadplane/telemetry']){
  const key=`node_modules/${name}`;await fs.mkdir(join(root,key),{recursive:true});await fs.writeFile(join(root,key,'package.json'),JSON.stringify({name,version:'1.0.0',exports:'./index.js'}));await fs.writeFile(join(root,key,'index.js'),'');packages[key]={version:'1.0.0',integrity:'sha512-YQ=='};dependencies[name]='1.0.0';
 }
 await fs.writeFile(join(app,'package.json'),JSON.stringify({dependencies}));await fs.writeFile(join(root,'package-lock.json'),JSON.stringify({packages}));
 await fs.writeFile(join(app,'angular.json'),JSON.stringify({cli:{analytics:false},projects:{threadplane:{architect:{build:{options:{aot:true},configurations:{production:{optimization:true,sourceMap:false,outputHashing:'all'}}}}}}}));
 await fs.cp(resolve('packages/contract/dist'),join(root,'packages/contract/dist'),{recursive:true});await fs.symlink(resolve('node_modules/zod'),join(root,'node_modules/zod'));
 return root;
}
function productControls(target?:[string,string]){
 let active=true,hit=false;const revoked=new Error('product generation revoked'),ledger:string[]=[],resources:any[]=[];
 const lifecycle={assertActive(){if(!active)throw revoked;},async adopt(resource:any){resources.push(resource);if(!active){await resource.close();throw revoked;}}};
 const acquire=async(name:string,path:any,operation:()=>Promise<any>)=>{expect(active,`after revoke ${name} ${path}`).toBe(true);ledger.push(`${name}:${path}`);const value=await operation();if(target&&name===target[0]&&String(path).endsWith(target[1])){hit=true;active=false;}return value;};
 const ops={...fs,...Object.fromEntries(['realpath','lstat','readdir','access'].map(name=>[name,(path:any,...args:any[])=>acquire(name,path,()=> (fs as any)[name](path,...args))])),open:(path:any,...args:any[])=>acquire('open',path,async()=>{const fd=await (fs.open as any)(path,...args);return {stat:()=>acquire('stat',path,()=>fd.stat()),read:(...args:any[])=>acquire('read',path,()=>fd.read(...args)),close:()=>fd.close()};})};
 return {ops,lifecycle,ledger,resources,revoked,revoke(){active=false;},get hit(){return hit;}};
}
test('owned checker product revoked entry does not resolve roots or open records',async()=>{
 const c=productControls();c.revoke();for(const call of [()=>api.productSourceKeys(process.cwd(),c),()=>api.snapshotProductInputs(process.cwd(),c),()=>api.assertProductInputsUnchanged(process.cwd(),{},c),()=>api.productBuildInventory(process.cwd(),c),()=>api.threadplaneBuildEvidence(process.cwd(),c)])await expect(call()).rejects.toBe(c.revoked);expect(c.ledger).toEqual([]);
});
test.each([['realpath',''],['readdir','/src'],['readdir','/nested'],['access','/@threadplane/chat/package.json'],['realpath','/@threadplane/render/index.js'],['open','/angular.json'],['open','/package-lock.json'],['open','/@threadplane/telemetry/package.json'],['open','/src/host.ts'],['open','/packages/contract/dist/index.js'],['readdir','/dist'],['open','/dist/index.html']])('owned checker product expiry at %s %s blocks further acquisition',async(name,key)=>{
 const root=await productFixture();try{const c=productControls([name,key]);await expect(api.productBuildInventory(root,c)).rejects.toBe(c.revoked);expect(c.hit).toBe(true);for(const resource of c.resources)await resource.close();}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker product default and empty options retain fixture keys and facts',async()=>{
 const root=await productFixture();try{expect(await api.productSourceKeys(root,{})).toEqual(await api.productSourceKeys(root));expect(await api.snapshotProductInputs(root,{})).toEqual(await api.snapshotProductInputs(root));const c=productControls();expect(await api.productBuildInventory(root,c)).toEqual(await api.productBuildInventory(root));expect(c.resources.length).toBeGreaterThan(0);for(const resource of c.resources)await resource.close();}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned checker changed fixture source remains invalid under lifecycle options',async()=>{
 const root=await productFixture();try{const c=productControls(),before=await api.snapshotProductInputs(root,c);await fs.writeFile(join(root,'apps/threadplane/src/host.ts'),'mutate');await expect(api.assertProductInputsUnchanged(root,before,c)).rejects.toThrow('changed');}finally{await fs.rm(root,{recursive:true,force:true});}
});
async function genuineProduct(scenario='equality'){
 const root=await fs.realpath(process.cwd()),path=join(root,'apps/threadplane/.build-evidence.json'),before=await fs.readFile(path),resources:any[]=[],handles:any[]=[];let now=0,recordOpens=0;
 const owner=new ComparisonOwnership({now:()=>now}),failure=new Error('genuine product actual close failed');
 const outcome=await owner.run('setup',async context=>{
  const lifecycle={assertActive:()=>context.assertActive(),async adopt(resource:any){resources.push(resource);await context.adopt(resource);}};
  const ops={...fs,writeFile:async()=>{throw new Error('read-only checker wrote');},rename:async()=>{throw new Error('read-only checker renamed');},unlink:async()=>{throw new Error('read-only checker unlinked');},open:async(file:any,...args:any[])=>{
   context.assertActive();const fd=await (fs.open as any)(file,...args),row={fd,closes:0};handles.push(row);if(file===path){recordOpens++;if(scenario==='record-reread-expiry'&&recordOpens===2)now=context.deadlineAtHostMs;}
   return {stat:()=>{context.assertActive();return fd.stat();},read:(...args:any[])=>{context.assertActive();return fd.read(...args);},close:async()=>{row.closes++;await fd.close();if(file===path&&recordOpens===1){if(scenario==='record-close-expiry')now=context.deadlineAtHostMs;if(scenario==='record-close-failure')throw failure;}}};
  }};
  return api.threadplaneBuildEvidence(root,{ops,lifecycle});
 });
 const disposal=await owner.dispose();for(const resource of resources){expect(resource.close()).toBe(resource.close());if(scenario==='record-close-failure')await resource.close().catch(()=>{});else await resource.close();}
 for(const row of handles){expect(row.closes).toBe(1);await expect(row.fd.stat()).rejects.toMatchObject({code:'EBADF'});}expect(resources).toHaveLength(handles.length);expect(await fs.readFile(path)).toEqual(before);
 return {outcome,disposal,failure,owner};
}
test('actual optimized product default and owned checker equality',async()=>{
 const expected=await api.threadplaneBuildEvidence();const {outcome,disposal}=await genuineProduct();expect(outcome.status).toBe('complete');expect(outcome.value).toEqual(expected);expect(disposal.status).toBe('complete');
});
test.each(['record-reread-expiry','record-close-expiry','record-close-failure'])('actual optimized product default and owned checker equality (%s rejects)',async scenario=>{
 const {outcome,disposal,owner,failure}=await genuineProduct(scenario);expect(outcome.status).toBe('failed');if(scenario==='record-close-failure'){expect(disposal.status).toBe('failed');expect(owner.failures.some((row:any)=>row.message===failure.message)).toBe(true);expect(owner.canContinue).toBe(false);}else expect(disposal.status).toBe('complete');
});
test('released renderer and app resolve the same physical Angular core instance',()=>{
    const appRequire=createRequire(resolve('apps/threadplane/package.json'));
    const productRequire=createRequire(appRequire.resolve('@threadplane/chat/package.json'));
    expect(productRequire.resolve('@angular/core/package.json')).toBe(appRequire.resolve('@angular/core/package.json'));
});
test('rejects stale asset/source/package inventories rather than relabeling an old build',()=>{
    expect(typeof api.assertBuildMatches).toBe('function');
    const recorded={framework:{name:'Angular',version:'21.1.6'},assetHashes:{'main.js':'old'},sourceHashes:{'app.ts':'old'}};
    expect(()=>api.assertBuildMatches({...recorded,framework:{name:'Angular',version:'21.2.25'}},recorded)).toThrow('build');
    expect(()=>api.assertBuildMatches({...recorded,assetHashes:{'main.js':'new'}},recorded)).toThrow('build');
    expect(()=>api.assertBuildMatches({...recorded,sourceHashes:{'app.ts':'new'}},recorded)).toThrow('build');
    expect(()=>api.assertBuildMatches(recorded,structuredClone(recorded))).not.toThrow();
});
const api = await import('./provenance.mjs').catch(() => ({})) as any;
test('native idle host stock inventory preserves exact original membership and named variant adds only its fixed style',async()=>{
 const helper=await fs.readFile(resolve('packages/runner/src/comparison-browser.test-helper.ts'),'utf8');
 const product47=JSON.parse(helper.match(/"product47": (\[[\s\S]*?\n  \])/ )![1]!);
 const source34=product47.filter((key:string)=>!probe.contractCompiledKeys.includes(key));
 expect(await api.productSourceKeys()).toEqual(source34);
 expect(await api.nativeIdleHostProductSourceKeys()).toEqual([...source34,api.nativeIdleHostVariant.styleKey].sort());
 expect([...await api.productSourceKeys(),...probe.contractCompiledKeys].sort()).toEqual(product47);
 for(const [name,actual] of [['probe31',probe.probeSourceKeys],['compiled16',probe.probeCompiledKeys]] as const)expect(actual).toEqual(JSON.parse(helper.match(new RegExp('"'+name+'": (\\[[\\s\\S]*?\\n  \\])'))![1]!));
});
test('native idle host named inventory entry points preserve revoked lifecycle acquisition protections',async()=>{
 const c=productControls();c.revoke();for(const call of [()=>api.nativeIdleHostProductSourceKeys(process.cwd(),c),()=>api.snapshotNativeIdleHostProductInputs(process.cwd(),c),()=>api.assertNativeIdleHostProductInputsUnchanged(process.cwd(),{},c),()=>api.nativeIdleHostProductBuildInventory(process.cwd(),c)])await expect(call()).rejects.toBe(c.revoked);expect(c.ledger).toEqual([]);
});
test('native idle host inactive stock stylesheet exclusion still refuses a nonregular entry',async()=>{
 const root=await productFixture();try{const path=join(root,api.nativeIdleHostVariant.styleKey);await fs.symlink(join(root,'apps/threadplane/src/host.ts'),path);await expect(api.productSourceKeys(root)).rejects.toThrow('Unexpected build entry');await expect(api.nativeIdleHostProductSourceKeys(root)).rejects.toThrow('Unexpected build entry');}finally{await fs.rm(root,{recursive:true,force:true});}
});
const idleDescriptor={schemaVersion:1,id:'threadplane-0.3.2-idle-host-css-v1',basePackage:'@threadplane/chat@0.3.2',styleKey:'apps/threadplane/src/native-idle-host-css-v1.css',styleSha256:'e19ff7e4d8deeea0813bcb0023835307f94cd85aa63075e4f15f2889b8718923'};
function idleEnvelope(){return {kind:'native-idle-host-css-product-v1',variant:{...idleDescriptor},angularSelection:{configuration:'production',styles:['src/styles.css','src/native-idle-host-css-v1.css']},build:adapterBuildSchema.parse({packages:[{name:'@threadplane/chat',version:'0.3.2',integrity:'sha512-htsWljhDogT6fOsmZrOvC+wFDRPhiQR/rvfwTJ2dYd/H6MiwPm3twxSr+KdNbaNRnARb62kUvPaigm0VA3cuGw==',resolutionPath:'apps/threadplane/node_modules/@threadplane/chat'}],framework:{name:'Angular',version:'21.2.25'},production:true,sourceHashes:{[idleDescriptor.styleKey]:idleDescriptor.styleSha256,'apps/threadplane/build.mjs':'a'.repeat(64)},copiedSourceHashes:{},assetHashes:{'index.html':'b'.repeat(64)},settings:{optimization:true,sourceMaps:false}})};}
test('native idle host descriptor and exact style bytes are fixed',async()=>{
 expect(api.nativeIdleHostVariant).toEqual(idleDescriptor);expect(api.nativeIdleHostVariantLabel).toBe('Threadplane 0.3.2 + benchmark idle-host CSS v1 (modified configuration)');
 expect(await fs.readFile(resolve(idleDescriptor.styleKey),'utf8')).toBe('bench-app chat .chat-scroll > chat-typing-indicator:empty { display: none; }\n');
});
test('native idle host explicit parser unwraps only canonical selected evidence',()=>{
 expect(typeof api.parseNativeIdleHostProductRecord).toBe('function');const value=idleEnvelope(),bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');expect(api.parseNativeIdleHostProductRecord(bytes,{adapterBuildSchema})).toEqual(value.build);expect(()=>api.parseProductRecord(bytes,{adapterBuildSchema})).toThrow();
});
test('native idle host owned reader rejects a revoked entry without acquisitions',async()=>{
 expect(typeof api.nativeIdleHostBuildEvidence).toBe('function');const c=productControls();c.revoke();await expect(api.nativeIdleHostBuildEvidence(process.cwd(),c)).rejects.toBe(c.revoked);expect(c.ledger).toEqual([]);
});
test('native idle host parser rejects a well-formed integrity for a different package archive',()=>{
 const value=idleEnvelope();value.build.packages[0].integrity='sha512-Yg==';expect(()=>api.parseNativeIdleHostProductRecord(Buffer.from(JSON.stringify(value,null,2)+'\n'),{adapterBuildSchema})).toThrow('package');
});
test.each(['id','descriptor-extra','selection-missing','styles-order','selection-extra','style-hash-missing','style-hash-wrong','wrapper-missing','package-version','package-integrity','package-missing','envelope-extra','stock','duplicate','whitespace'])('native idle host parser rejects %s',mode=>{
 expect(typeof api.parseNativeIdleHostProductRecord).toBe('function');const value:any=idleEnvelope();
 if(mode==='id')value.variant.id='stock';if(mode==='descriptor-extra')value.variant.extra=true;if(mode==='selection-missing')delete value.angularSelection;if(mode==='styles-order')value.angularSelection.styles.reverse();if(mode==='selection-extra')value.angularSelection.command='ng';
 if(mode==='style-hash-missing')delete value.build.sourceHashes[idleDescriptor.styleKey];if(mode==='style-hash-wrong')value.build.sourceHashes[idleDescriptor.styleKey]='a'.repeat(64);if(mode==='wrapper-missing')delete value.build.sourceHashes['apps/threadplane/build.mjs'];if(mode==='package-version')value.build.packages[0].version='0.3.1';if(mode==='package-integrity')value.build.packages[0].integrity='';if(mode==='package-missing')value.build.packages=[];if(mode==='envelope-extra')value.extra=true;
 let bytes=Buffer.from(JSON.stringify(mode==='stock'?value.build:value,null,2)+'\n');if(mode==='duplicate')bytes=Buffer.from(bytes.toString().replace('"schemaVersion": 1','"schemaVersion": 1, "schemaVersion": 1'));if(mode==='whitespace')bytes=Buffer.concat([bytes,Buffer.from(' ')]);
 expect(()=>api.parseNativeIdleHostProductRecord(bytes,{adapterBuildSchema})).toThrow();
});
test('cold product declarations preserve old keys and cover all contract sources and build helpers',async()=>{
 const keys=await api.productSourceKeys();
 for(const key of ['package.json','package-lock.json','apps/threadplane/provenance.mjs','apps/threadplane/dependency-closure.mjs','packages/contract/src/fixture.ts','packages/contract/src/comparison.ts','packages/contract/src/capture-bridge.ts','packages/contract/src/index.ts','apps/threadplane/src/main.ts','apps/threadplane/src/host.ts'])expect(keys).toContain(key);
 for(const key of ['comparison-buffer','comparison-installer-options','artifact','adapter','long-thread','presentation','comparison-artifact','comparison-presentation'])expect(keys).toContain(`packages/contract/src/${key}.ts`);
 for(const key of ['tsconfig.base.json','packages/contract/tsconfig.json','apps/threadplane/build.mjs','apps/threadplane/probe-provenance.mjs'])expect(keys).toContain(key);
 expect(keys.some((key:string)=>key.startsWith('packages/runner/dist/'))).toBe(false);
});
test('ordinary standalone current-dist record blessing is retired',async()=>{
 const child=spawn(process.execPath,['apps/threadplane/provenance.mjs','--write-build-record'],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',bytes=>{error+=bytes.toString();});
 expect(await new Promise(resolve=>child.once('exit',resolve))).toBe(1);expect(error).toContain('successful build.mjs sequence');
});
test('preserves exact pretty product record bytes while rejecting duplicate keys and alternate encoding',async()=>{
 const contract=await import('@chat-ui-bench/contract');
 const record=contract.adapterBuildSchema.parse({packages:[{name:'typescript',version:'5.9.3',integrity:'sha512-YQ==',resolutionPath:'apps/threadplane/node_modules/typescript'}],framework:{name:'Angular',version:'21.2.25'},production:true,sourceHashes:{'package.json':'a'.repeat(64)},copiedSourceHashes:{},assetHashes:{'index.html':'b'.repeat(64)},settings:{optimization:true,sourceMaps:false}});
 const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');expect(api.parseProductRecord(bytes,contract)).toEqual(record);
 for(const altered of [bytes.subarray(0,bytes.length-1),Buffer.from(JSON.stringify(record)+'\n'),Buffer.from(bytes.toString().replace('"production": true','"production": true, "production": true')),Buffer.from(bytes.toString()+' ')])expect(()=>api.parseProductRecord(altered,contract)).toThrow();
});
test('rejects production configuration that could mislabel unoptimized or source-mapped assets',async()=>{
    expect(typeof api.productionSettings).toBe('function');
    const base={cli:{analytics:false},projects:{threadplane:{architect:{build:{options:{aot:true},configurations:{production:{optimization:true,sourceMap:false,outputHashing:'all'}}}}}}};
    expect(api.productionSettings(base)).toEqual({optimization:true,sourceMaps:false});
    for(const field of ['optimization','sourceMap','outputHashing']){
        const copy=structuredClone(base);(copy.projects.threadplane.architect.build.configurations.production as any)[field]=field==='sourceMap'?true:false;
        expect(()=>api.productionSettings(copy)).toThrow('configuration');
    }
});
test('inventories actual optimized assets, released package integrities and isolated compiler versions', async () => {
    expect(typeof api.threadplaneBuildEvidence).toBe('function');
    const evidence = await api.threadplaneBuildEvidence();
    expect(adapterBuildSchema.safeParse(evidence).success).toBe(true);
    expect(evidence.framework.version).toBe('21.2.25');
    expect(evidence.packages.find((p: any) => p.name === 'typescript').version).toBe('5.9.3');
    expect(evidence.packages.find((p: any) => p.name === '@threadplane/chat').version).toBe('0.3.4');
    expect(evidence.packages.filter((p:any)=>p.name==='p-queue').map((p:any)=>p.version).sort()).toEqual(['6.6.2','9.3.3']);
    expect(evidence.packages.every((p:any)=>typeof p.resolutionPath==='string')).toBe(true);
    expect(Object.keys(evidence.assetHashes)).toContain('index.html');
    expect(Object.keys(evidence.assetHashes).some(n => n.endsWith('.map'))).toBe(false);
    expect(evidence.sourceHashes['package-lock.json']).toMatch(/^[a-f0-9]{64}$/);
});
