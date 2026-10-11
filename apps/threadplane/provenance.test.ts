import { expect, test } from 'vitest';
import { adapterBuildSchema } from '@chat-ui-bench/contract';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
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
    expect(evidence.packages.find((p: any) => p.name === '@threadplane/chat').version).toBe('0.3.2');
    expect(evidence.packages.filter((p:any)=>p.name==='p-queue').map((p:any)=>p.version).sort()).toEqual(['6.6.2','9.3.3']);
    expect(evidence.packages.every((p:any)=>typeof p.resolutionPath==='string')).toBe(true);
    expect(Object.keys(evidence.assetHashes)).toContain('index.html');
    expect(Object.keys(evidence.assetHashes).some(n => n.endsWith('.map'))).toBe(false);
    expect(evidence.sourceHashes['package-lock.json']).toMatch(/^[a-f0-9]{64}$/);
});
