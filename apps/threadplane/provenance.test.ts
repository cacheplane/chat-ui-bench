import { expect, test } from 'vitest';
import { adapterBuildSchema } from '@chat-ui-bench/contract';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
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
