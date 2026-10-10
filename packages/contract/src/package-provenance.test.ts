import {expect,test} from 'vitest';
import {adapterBuildSchema} from './comparison.js';
const base={packages:[],framework:{name:'Angular',version:'21.2.25'},production:true,sourceHashes:{'app.ts':'a'.repeat(64)},copiedSourceHashes:{},assetHashes:{'index.html':'a'.repeat(64)},settings:{optimization:true,sourceMaps:false}};
const first={name:'p-queue',version:'6.6.2',integrity:'sha512-example',resolutionPath:'apps/threadplane/node_modules/p-queue'};
const second={...first,version:'9.3.3',resolutionPath:'apps/threadplane/node_modules/@langchain/core/node_modules/p-queue'};
test('identifies multiple installed versions by normalized physical package paths',()=>{
 expect(adapterBuildSchema.safeParse({...base,packages:[first,second]}).success).toBe(true);
 expect(adapterBuildSchema.safeParse({...base,packages:[first,{...second,resolutionPath:first.resolutionPath}]}).success).toBe(false);
 const {resolutionPath,...legacy}=first;
 expect(adapterBuildSchema.safeParse({...base,packages:[legacy]}).success).toBe(true);
 expect(adapterBuildSchema.safeParse({...base,packages:[legacy,legacy]}).success).toBe(false);
 for(const resolutionPath of ['/node_modules/p-queue','../node_modules/p-queue','node_modules/../p-queue','node_modules\\p-queue','node_modules/other','apps//node_modules/p-queue'])expect(adapterBuildSchema.safeParse({...base,packages:[{...first,resolutionPath}]}).success).toBe(false);
});
