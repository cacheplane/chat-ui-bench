import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readSourceSnapshot, readHostedCopilotContext } from './hosted-copilot-context.ts';
import { assertContext, assertInventory, assertParsedAssetReferences, assertOriginalCommand, releaseTag, type HostedCopilotContext } from './hosted-copilot-contract.ts';
const sha='a'.repeat(40), hash='b'.repeat(64);
const good:HostedCopilotContext={candidateSha:sha,checkoutSha:sha,githubSha:sha,workflowSha:sha,tagSha:sha,repository:'cacheplane/chat-ui-bench',releaseId:'hosted-copilot-react-production-build-v1',githubRef:'refs/tags/hosted-copilot-react-production-build-v1',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-production.yml@refs/tags/hosted-copilot-react-production-build-v1',eventName:'workflow_dispatch',actions:'true',platform:'linux',runnerOs:'Linux',runnerMarker:'ubuntu-24.04-hosted-copilot-production',attempt:'1'};
const file=()=>({path:'assets/main.js',bytes:10,sha256:hash,regular:true,contained:true,symlink:false});
describe('hosted production source context policy',()=>{
 it('returns frozen declared facts with unused release unverified',()=>{const v=assertContext(good);expect(Object.isFrozen(v)).toBe(true);expect(v.unusedRelease).toBe('unverified');expect(v.qualification).toBe(false);});
 for(const [key,value] of Object.entries({candidateSha:'A'.repeat(40),checkoutSha:'c'.repeat(40),githubSha:'c'.repeat(40),workflowSha:'c'.repeat(40),tagSha:'c'.repeat(40),repository:'other/repo',releaseId:'../bad',githubRef:'refs/heads/main',workflowRef:'wrong',eventName:'push',actions:'false',platform:'darwin',runnerOs:'macOS',runnerMarker:'generic',attempt:'2'})) it(`denies ${key}`,()=>expect(()=>assertContext({...good,[key]:value})).toThrow());
 it.each(['', 'x'.repeat(65), 'bad\n', 'A-tag', '../tag'])('denies release identity %s',id=>expect(()=>releaseTag(id)).toThrow());
 it('requires exact predefined build-stage identity prefix',()=>expect(()=>releaseTag('hosted-copilot-react-mounted-v1')).toThrow());
});
describe('bounded ordinary file inventory',()=>{
 it('owns immutable inventory facts',()=>{const input=[file()];const v=assertInventory(input);input[0]!.bytes=99;expect(v.files[0]!.bytes).toBe(10);expect(Object.isFrozen(v.files[0])).toBe(true);});
 for(const [key,value] of Object.entries({path:'../outside',bytes:-1,sha256:'bad',regular:false,contained:false,symlink:true})) it(`denies ${key}`,()=>expect(()=>assertInventory([{...file(),[key]:value}])).toThrow());
 it.each(['a//b','a/./b','/absolute','a\\b','https://remote/a','a/../b','a\u0000b'])('denies path %s',path=>expect(()=>assertInventory([{...file(),path}])).toThrow());
 it('denies duplicate names',()=>expect(()=>assertInventory([file(),file()])).toThrow());
 it('denies 129 files',()=>expect(()=>assertInventory(Array.from({length:129},(_,i)=>({...file(),path:`assets/${i}.js`})))).toThrow());
 it('accepts exact aggregate boundary',()=>expect(assertInventory([{...file(),bytes:32*1024*1024}]).bytes).toBe(32*1024*1024));
 it('denies aggregate overflow',()=>expect(()=>assertInventory([{...file(),bytes:32*1024*1024+1}])).toThrow());
 it('denies unsafe byte integer',()=>expect(()=>assertInventory([{...file(),bytes:Number.MAX_SAFE_INTEGER+1}])).toThrow());
 it('denies empty inventory',()=>expect(()=>assertInventory([])).toThrow());
});
describe('parser supplied asset references only',()=>{
 const files=[file(),{...file(),path:'index.html'}];
 it('admits explicitly complete parsed local graph',()=>expect(assertParsedAssetReferences({parserComplete:true,references:[{from:'index.html',target:'assets/main.js'}]},files).qualification).toBe(false));
 it('denies incomplete parser coverage',()=>expect(()=>assertParsedAssetReferences({parserComplete:false,references:[]},files)).toThrow());
 it.each(['https://external/file.js','//external/file.js','data:text/javascript,a','missing.js','../escape'])('denies unresolved/external target %s',target=>expect(()=>assertParsedAssetReferences({parserComplete:true,references:[{from:'index.html',target}]},files)).toThrow());
 it('denies unowned source',()=>expect(()=>assertParsedAssetReferences({parserComplete:true,references:[{from:'unknown',target:'assets/main.js'}]},files)).toThrow());
});
describe('original command outcomes remain independent from upload eligibility',()=>{
 const result={exitCode:1,signal:null,stdoutBytes:100,stderrBytes:20,stdoutRetainedBytes:100,stderrRetainedBytes:20,closed:true,streamsComplete:true};
 it('preserves known vendor/audit original exit1',()=>{const v=assertOriginalCommand(result);expect(v.exitCode).toBe(1);expect(v.success).toBe(false);expect(v.uploadEligible).toBe(true);});
 it('truncated overflow cannot qualify or upload',()=>{const v=assertOriginalCommand({...result,stdoutBytes:33*1024*1024,stdoutRetainedBytes:1024,streamsComplete:false});expect(v.streamsComplete).toBe(false);expect(v.uploadEligible).toBe(false);expect(v.success).toBe(false);});
 it('signal does not imply original success',()=>expect(assertOriginalCommand({...result,exitCode:null,signal:'SIGABRT'}).success).toBe(false));
 it('unclosed process cannot qualify',()=>expect(assertOriginalCommand({...result,exitCode:0,closed:false}).success).toBe(false));
 it('zero exit complete original succeeds',()=>expect(assertOriginalCommand({...result,exitCode:0}).success).toBe(true));
 it('denies contradictory complete stream byte counts',()=>expect(()=>assertOriginalCommand({...result,stdoutRetainedBytes:99})).toThrow());
});

function trackedFixture(){const d=mkdtempSync(join(tmpdir(),'copilot-policy-tracked-'));writeFileSync(join(d,'source.txt'),'owned');execFileSync('git',['init','--quiet',d]);execFileSync('git',['-C',d,'add','.']);const tree=execFileSync('git',['-C',d,'write-tree'],{encoding:'utf8'}).trim();const commit=execFileSync('git',['-C',d,'-c','user.name=Policy test','-c','user.email=policy@example.invalid','commit-tree',tree,'-m','Inert source fixture'],{encoding:'utf8'}).trim();execFileSync('git',['-C',d,'update-ref','HEAD',commit]);return d;}
describe('native source metadata retains Git ownership',()=>{
 it('binds an existing clean tracked file to HEAD/tree and owned bytes',()=>{const v=readSourceSnapshot(trackedFixture(),['source.txt']);expect(v.files[0]!.path).toBe('source.txt');expect(v.commitSha).toMatch(/^[a-f0-9]{40}$/);expect(v.treeSha).toMatch(/^[a-f0-9]{40}$/);expect(v.qualification).toBe(false);});
 it('denies an untracked source file',()=>{const d=trackedFixture();writeFileSync(join(d,'untracked.txt'),'new');expect(()=>readSourceSnapshot(d,['untracked.txt'])).toThrow();});
 it('denies path escape before filesystem access',()=>expect(()=>readSourceSnapshot(process.cwd(),['../package.json'])).toThrow());
 it('denies duplicate selected paths',()=>expect(()=>readSourceSnapshot(process.cwd(),['package.json','package.json'])).toThrow());
 it('denies missing Git repository',()=>{const d=mkdtempSync(join(tmpdir(),'copilot-policy-empty-'));expect(()=>readSourceSnapshot(d,['package.json'])).toThrow();});
 it('denies absent hosted context without running SDK',()=>expect(()=>readHostedCopilotContext(process.cwd(),{})).toThrow());
 it('native guard default remains denied before Task2 integration',()=>{try {execFileSync(process.execPath,['tools/hosted-copilot-admission.mjs'],{cwd:process.cwd(),env:{PATH:process.env.PATH??''},encoding:'utf8',stdio:['ignore','pipe','pipe']});throw new Error('unexpected guard success');}catch(error){expect((error as {status?:number}).status).toBe(1);}});
 it('denies selected ancestor symlink in a real temporary Git tree',()=>{const d=mkdtempSync(join(tmpdir(),'copilot-policy-link-'));mkdirSync(join(d,'real'));writeFileSync(join(d,'real','source.txt'),'owned');symlinkSync('real',join(d,'link'));execFileSync('git',['init','--quiet',d]);execFileSync('git',['-C',d,'add','.']);const tree=execFileSync('git',['-C',d,'write-tree'],{encoding:'utf8'}).trim();const commit=execFileSync('git',['-C',d,'-c','user.name=Policy test','-c','user.email=policy@example.invalid','commit-tree',tree,'-m','Inert source fixture'],{encoding:'utf8'}).trim();execFileSync('git',['-C',d,'update-ref','HEAD',commit]);expect(()=>readSourceSnapshot(d,['link/source.txt'])).toThrow();});
});
describe('anchored scalars cannot contain trailing newline',()=>{
 it('denies otherwise valid release newline',()=>expect(()=>releaseTag(good.releaseId+'\n')).toThrow());
 it('denies otherwise valid path newline',()=>expect(()=>assertInventory([{...file(),path:'assets/main.js\n'}])).toThrow());
 it('denies otherwise valid sha newline',()=>expect(()=>assertInventory([{...file(),sha256:hash+'\n'}])).toThrow());
});

describe('source snapshot refuses ignored tracked changes',()=>{

 it('denies actual dirty tracked bytes',()=>{const d=trackedFixture();writeFileSync(join(d,'source.txt'),'changed');expect(()=>readSourceSnapshot(d,['source.txt'])).toThrow();});
 it('denies assume-unchanged even without modified bytes',()=>{const d=trackedFixture();execFileSync('git',['-C',d,'update-index','--assume-unchanged','source.txt']);expect(()=>readSourceSnapshot(d,['source.txt'])).toThrow();});
 it('denies skip-worktree even without modified bytes',()=>{const d=trackedFixture();execFileSync('git',['-C',d,'update-index','--skip-worktree','source.txt']);expect(()=>readSourceSnapshot(d,['source.txt'])).toThrow();});
});

describe('sparse public array input denial',()=>{
 it('denies hole-only inventory',()=>expect(()=>assertInventory(new Array<ReturnType<typeof file>>(1))).toThrow('Sparse'));
 it('denies inventory with a middle hole',()=>{const values=[file(),file(),{...file(),path:'assets/last.js'}];delete values[1];expect(()=>assertInventory(values)).toThrow('Sparse');});
 it('denies inherited inventory entry',()=>{const values=new Array<ReturnType<typeof file>>(1);Object.setPrototypeOf(values,{0:file(),map:Array.prototype.map});expect(()=>assertInventory(values)).toThrow('Sparse');});
 it('denies hole-only source paths before any Git/filesystem lookup',()=>expect(()=>readSourceSnapshot('/nonexistent-sparse-policy-root',new Array<string>(1))).toThrow('Sparse'));
 it('denies middle source path hole before Git lookup',()=>{const values=['package.json','placeholder','second'];delete values[1];expect(()=>readSourceSnapshot('/nonexistent-sparse-policy-root',values)).toThrow('Sparse');});
 it('denies hole-only parsed references explicitly',()=>expect(()=>assertParsedAssetReferences({parserComplete:true,references:new Array<{from:string;target:string}>(1)},[file()])).toThrow('Sparse'));
 it('denies middle parsed reference hole',()=>{const values=[{from:'assets/main.js',target:'assets/main.js'},{from:'assets/main.js',target:'assets/main.js'}];delete values[0];expect(()=>assertParsedAssetReferences({parserComplete:true,references:values},[file()])).toThrow('Sparse');});
 it('permits an explicitly empty parsed reference list',()=>expect(assertParsedAssetReferences({parserComplete:true,references:[]},[file()]).referenceCount).toBe(0));
});
