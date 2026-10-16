import {test,expect} from 'vitest';
import * as tool from '../tools/hosted-copilot-mounted-bootstrap.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const bootstrapPath=fileURLToPath(new URL('../tools/hosted-copilot-mounted-bootstrap.mjs',import.meta.url));
const sha='a'.repeat(40),digest='b'.repeat(64);
function fixtures(){return {expected:{sourceSha:sha,originalRunId:'123',artifactId:'456',archiveSha256:digest},run:{id:123,run_attempt:1,head_sha:sha,event:'workflow_dispatch',workflow_id:384492100,status:'completed',conclusion:'success',repository:{full_name:'cacheplane/chat-ui-bench'},jobs_url:'unused'},artifact:{id:456,name:'copilot-production-123-1',expired:false,size_in_bytes:100,digest:'sha256:'+digest,workflow_run:{id:123,head_sha:sha}}};}
function check(){const f=tool.validateNativePrerequisiteProvider;expect(f,'provider validator export').toBeTypeOf('function');return f;}
test('accepts exact successful same-source original STATIC identity without upgrading review authority',()=>{const f=fixtures();expect(check()(f.expected,f.run,f.artifact)).toMatchObject({sourceSha:sha,qualification:false});});
test.each([{run_attempt:2},{head_sha:'c'.repeat(40)},{conclusion:'failure'},{status:'in_progress'},{event:'push'},{workflow_id:1}])('rejects original STATIC mismatch %#',change=>{const f=fixtures(),validate=check();expect(()=>validate(f.expected,{...f.run,...change},f.artifact)).toThrow();});
test.each([{expired:true},{id:457},{digest:'sha256:'+'c'.repeat(64)},{name:'wrong'},{size_in_bytes:33554433}])('rejects artifact mismatch %#',change=>{const f=fixtures(),validate=check();expect(()=>validate(f.expected,f.run,{...f.artifact,...change})).toThrow();});
test('settings commitment binds source, config, helper and lock in fixed order',()=>{const f=tool.frontendSettingsCommitment;expect(f,'settings commitment export').toBeTypeOf('function');const source={commitSha:sha,files:[{path:'package-lock.json',sha256:'4'.repeat(64)},{path:'tests/support/hosted-copilot-build-plugin.ts',sha256:'3'.repeat(64)},{path:'apps/copilotkit/vite.config.ts',sha256:'2'.repeat(64)}]};const result=f(source);expect(result.tuple).toEqual([['source',sha],['apps/copilotkit/vite.config.ts','2'.repeat(64)],['tests/support/hosted-copilot-build-plugin.ts','3'.repeat(64)],['package-lock.json','4'.repeat(64)]]);expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);source.files[1]!.sha256='5'.repeat(64);expect(f(source).sha256).not.toBe(result.sha256);});
function ownerInputs(){
 const make=(action:string,exitCode:number,seen:number)=>({argv:[process.execPath,'--experimental-import-meta-resolve',bootstrapPath,action],original:{exitCode,signal:null,stdoutBytes:seen,stderrBytes:0,stdoutRetainedBytes:seen,stderrRetainedBytes:0,closed:true,streamsComplete:true},exitObserved:true,exit:{exitCode,signal:null},closeObserved:true,streamFacts:{stdout:{readableEOF:true,writerFinish:true,writerClose:true,writerError:false,seen,retained:seen,retainedBytesKnown:true},stderr:{readableEOF:true,writerFinish:true,writerClose:true,writerError:false,seen:0,retained:0,retainedBytesKnown:true}}});
 return {parent:make('parent',7,150),partial:{applicationCommand:make('child',3,20),cases:[],originals:[{label:'parentWorkerClose',status:'pending'}],stdio:[]}};
}
function ownerCheck(){const f=tool.nativeGlobalClosureInput;expect(f,'separate owner projection export').toBeTypeOf('function');return f;}
test('global parent coverage uses separate outer parent capture while application exit uses inner original exit',()=>{const f=ownerCheck(),{parent,partial}=ownerInputs(),r=f(parent,partial);expect(r).toMatchObject({parentCommand:{original:{exitCode:7},stdout:{seen:150}},applicationExit:{exitCode:3},originals:[{label:'parentWorkerClose',status:'fulfilled'}]});expect(partial.originals[0]!.status).toBe('pending');});
test('cannot borrow the application capture as parent command',()=>{const f=ownerCheck(),{partial}=ownerInputs();expect(()=>f(partial.applicationCommand,partial)).toThrow();});
test('missing parent partial cannot fabricate a global closure input',()=>{const f=ownerCheck(),{parent}=ownerInputs();expect(()=>f(parent,null)).toThrow();});
test('outer close without original writer EOF leaves parentWorkerClose pending',()=>{const f=ownerCheck(),{parent,partial}=ownerInputs();parent.original.streamsComplete=false;parent.streamFacts.stdout.writerClose=false;expect(f(parent,partial)).toMatchObject({originals:[{label:'parentWorkerClose',status:'pending'}]});});
test('missing inner exit cannot use outer exit as application success',()=>{const f=ownerCheck(),{parent,partial}=ownerInputs();partial.applicationCommand.exitObserved=false;expect(f(parent,partial)).toMatchObject({applicationExit:{exitCode:null,signal:null}});});
test.each(['run','artifact','artifact-run'])('rejects string API numeric identity %s',slot=>{const f=fixtures(),validate=check();const run=slot==='run'?{...f.run,id:'123'}:f.run,artifact=slot==='artifact'?{...f.artifact,id:'456'}:slot==='artifact-run'?{...f.artifact,workflow_run:{...f.artifact.workflow_run,id:'123'}}:f.artifact;expect(()=>validate(f.expected,run,artifact)).toThrow();});
test('rejects rounded unsafe provider run identity even if every string comparison matches',()=>{const f=fixtures(),validate=check(),unsafe=9007199254740992;f.expected.originalRunId=String(unsafe);f.run.id=unsafe;f.artifact.workflow_run.id=unsafe;f.artifact.name='copilot-production-'+String(unsafe)+'-1';expect(()=>validate(f.expected,f.run,f.artifact)).toThrow();});
test('rejects rounded unsafe provider artifact identity even when its string matches',()=>{const f=fixtures(),validate=check(),unsafe=9007199254740992;f.expected.artifactId=String(unsafe);f.artifact.id=unsafe;expect(()=>validate(f.expected,f.run,f.artifact)).toThrow();});

// This runs only the embedded stdlib data extractor against tiny generated ZIPs.
// It never invokes a bootstrap action, provider, SDK, browser or application.
const extractionCases=['implicit-directory-overflow','file-parent-conflict','long-normalized-name','directory-mode-on-file-name','regular-mode-on-directory-name','duplicate-normalized-name','file-count-overflow','complete-admitted','bad-crc'];
test.each(extractionCases)('embedded extractor: %s',name=>{
 const script=fileURLToPath(new URL('./support/hosted-copilot-mounted-extraction-fixtures.py',import.meta.url));
 const original=spawnSync('/usr/bin/python3',['-I','-S','-B',script,bootstrapPath,name],{encoding:'utf8',timeout:15000,maxBuffer:65536});
 expect(original.error).toBeUndefined();expect(original.signal).toBeNull();expect(original.status,original.stderr).toBe(0);
 const result=JSON.parse(original.stdout);expect(result.name).toBe(name);expect(result.passed).toBe(true);expect(result.syntheticOnly).toBe(true);
},20000);
