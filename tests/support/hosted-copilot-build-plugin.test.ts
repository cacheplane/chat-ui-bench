import {mkdtempSync,writeFileSync,symlinkSync,mkdirSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describe,it,expect} from 'vitest';
import {projectHookFacts,readPhysicalSource,type HookFile} from './hosted-copilot-build-plugin.ts';
const row:HookFile={contentSha256:'b'.repeat(64),fileName:'assets/main.js',kind:'chunk',imports:[],dynamicImports:[],moduleIds:['/owned/source.js'],originalNames:[],facadeModuleId:'/owned/source.js'};
const module={id:'/owned/source.js',kind:'physical' as const,path:'source.js',sha256:'a'.repeat(64),external:false};
describe('supplied production bundle hook facts',()=>{
 it('owns input metadata without a factory or build',()=>{const v=projectHookFacts([row],[module]);expect(v.schemaVersion).toBe(1);expect(v.files[0]!.fileName).toBe(row.fileName);expect(Object.isFrozen(v.files[0])).toBe(true);});
 it('denies sparse output rows',()=>expect(()=>projectHookFacts(new Array(1),[module])).toThrow());
 it('denies unknown referenced chunk',()=>expect(()=>projectHookFacts([{...row,imports:['missing.js']}],[module])).toThrow());
 it('denies source-map/escape output names',()=>{expect(()=>projectHookFacts([{...row,fileName:'main.js.map'}],[module])).toThrow();expect(()=>projectHookFacts([{...row,fileName:'../main.js'}],[module])).toThrow();});
 it('denies unknown module IDs and duplicate file names',()=>{expect(()=>projectHookFacts([row],[])).toThrow();expect(()=>projectHookFacts([row,row],[module])).toThrow();});
 it('denies4097 hook reference occurrences',()=>expect(()=>projectHookFacts([{...row,imports:Array(4097).fill(row.fileName)}],[module])).toThrow());
});

describe('original physical module path metadata',()=>{
 it('rejects original-file symlink before canonicalization',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));writeFileSync(join(root,'real.js'),'export {}');symlinkSync('real.js',join(root,'alias.js'));expect(()=>readPhysicalSource(join(root,'alias.js'),root)).toThrow('symlink');});
 it('rejects an original ancestor symlink',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));mkdirSync(join(root,'real'));writeFileSync(join(root,'real','a.js'),'export {}');symlinkSync('real',join(root,'alias'));expect(()=>readPhysicalSource(join(root,'alias','a.js'),root)).toThrow('symlink');});
 it('hashes contained stable ordinary source bytes',()=>{const root=realpathSync(mkdtempSync(join(tmpdir(),'copilot-module-')));writeFileSync(join(root,'a.js'),'export {}');expect(readPhysicalSource(join(root,'a.js'),root)).toMatchObject({path:'a.js',sha256:expect.stringMatching(/^[a-f0-9]{64}$/)});});
});

describe('hook content bytes stay linked to final physical inventory',()=>{
 it('denies missing captured content hash',()=>expect(()=>projectHookFacts([{...row,contentSha256:undefined}],[module])).toThrow());
});
