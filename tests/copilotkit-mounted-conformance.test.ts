import {describe,it,expect} from 'vitest';
import {runMountedConformance,createMountedSnapshotReader,type MountedPrerequisites,type MountedConformancePorts,type MountedCaseOwner} from '../apps/copilotkit/runtime/mounted-conformance.ts';
import {MOUNTED_PACKAGE_PINS} from './support/hosted-copilot-mounted-policy.ts';
import {evaluateMountedGeometry} from '../apps/copilotkit/src/geometry-policy.ts';
import type {GeometrySnapshot} from '../apps/copilotkit/src/geometry.ts';
import type {CaseRecord,CaseJourney} from './support/hosted-copilot-mounted-policy.ts';
import * as ownership from '../apps/copilotkit/runtime/ownership.ts';


const sha='a'.repeat(40),hash='b'.repeat(64),lock='c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56';
function prerequisites():MountedPrerequisites {
 const intent:MountedPrerequisites['intent']={schemaVersion:1,kind:'pre-install-intent',purpose:'hosted-copilot-mounted-default-react-only',context:{candidateSha:sha,checkoutSha:sha,githubSha:sha,workflowSha:sha,tagSha:sha,repository:'cacheplane/chat-ui-bench',releaseId:'hosted-copilot-react-h100-r6400-v1',githubRef:'refs/tags/hosted-copilot-react-h100-r6400-v1',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-mounted.yml@refs/tags/hosted-copilot-react-h100-r6400-v1',eventName:'workflow_dispatch',actions:'true',platform:'linux',runnerOs:'Linux',runnerMarker:'ubuntu-24.04-hosted-copilot-mounted',attempt:'1'},source:{commitSha:sha,treeSha:sha,lockSha256:lock,files:['package-lock.json','.github/workflows/hosted-copilot-mounted.yml','tools/hosted-copilot-mounted-bootstrap.mjs','apps/copilotkit/hosted-native-entry.ts','apps/copilotkit/src/geometry-policy.ts'].map(path=>({path,bytes:1,sha256:path==='package-lock.json'?lock:hash,regular:true,contained:true,symlink:false}))},prerequisite:{originalRunId:'3',attempt:1,sourceSha:sha,artifactId:'4',archiveSha256:hash,qualifiedRootReceiptSha256:hash,qualifiedPeerReceiptSha256:hash,frontendSettingsSha256:hash},profile:{nodeVersion:'v24.20.0',npmVersion:'11.19.0',telemetryDisabled:'true',doNotTrack:'1'}};
 return {intent,installed:{schemaVersion:1,kind:'post-install-admission',intent,originalInstall:{exitCode:0,signal:null,stdoutBytes:0,stderrBytes:0,stdoutRetainedBytes:0,stderrRetainedBytes:0,closed:true,streamsComplete:true},installedProfile:{sourceSha:sha,lockSha256:lock,originalInstallReceiptSha256:hash,hiddenLockReceiptSha256:hash,checkedInstalledRecords:19,packages:Object.entries(MOUNTED_PACKAGE_PINS).map(([path,pin])=>({path,...pin,manifestSha256:hash,regular:true,contained:true,symlink:false}))}},module:{schemaVersion:1,sourceSha:sha,runId:'3',workerPath:'apps/copilotkit/.hosted-mounted/3-1/worker.mjs',emitted:[{path:'apps/copilotkit/.hosted-mounted/3-1/worker.mjs',kind:'chunk',format:'es',entry:true,bytes:1,sha256:hash}],imports:[{specifier:'node:http',kind:'static',resolutionIndex:null}],resolutions:[],executedCopySha256:hash}};
}
const labels=['seedReaderEOF','coldReaderEOF','mountedACK','publicRun','successfulTerminal','completionACK','bridge','producerFinish','producerReaderEOF','nativeOriginClose','producerOriginClose','remoteCloseAdmission','hostDispose','rootUnmount','pageClose','contextClose','storeClear','publicStoreEmpty','caseDomainRelease'];
function record(journey:CaseJourney,n:1|2):CaseRecord{return {caseNumber:n,journey,threadId:`thread-${n}`,seedRunId:`seed-${n}`,continuationRunId:`continue-${n}`,repetition:`rep-${n}`,completed:true,publicIdle:true,storeEmpty:true,domainReleased:true,originals:labels.map(label=>({label,status:'fulfilled'}))};}
function snapshot(phase:'restored-history'|'streaming'|'completed',time=0,id='R',prefix='R'):GeometrySnapshot {
 const frame={schemaVersion:1 as const,scopeId:'thread',clockDomain:'page-performance-ms' as const,observedAtPageMs:time,phase,expectedHistory:Array.from({length:100},(_,i)=>({id:`H${i}`,role:'user' as const,text:'H'.repeat(512)})),expectedResponse:{id:'R',role:'assistant' as const,text:'R'.repeat(6400)},responseProgress:phase==='restored-history'?{active:false,prefix:''}:phase==='completed'?{active:false,prefix:'R'.repeat(6400)}:{active:true,prefix},viewport:{x:0,y:0,width:100,height:100},nativeViewport:{x:0,y:0,width:100,height:100},rows:[{id:phase==='restored-history'?'H0':id,role:phase==='restored-history'||id!=='R'?'user' as const:'assistant' as const,presence:'mounted' as const,ownerToken:1,observedText:phase==='restored-history'||id!=='R'?'H'.repeat(512):phase==='completed'?'R'.repeat(6400):prefix,textRects:[{x:0,y:10,width:20,height:20}],ancestorClips:[]}]};
 return {status:'available',frame,evaluation:evaluateMountedGeometry(frame),visibleMessages:[],scroll:{scrollTop:0,scrollHeight:100,clientHeight:100}};
}
function supplied(){const calls:string[]=[];let fail:string|null=null;const ports:MountedConformancePorts={connect:async()=>{calls.push('connect');},closeClient:async()=>{calls.push('client-close');},openCase:async(journey,n)=>{calls.push(`open-${n}`);const snap=(...args:Parameters<typeof snapshot>)=>{const s=snapshot(...args);if(s.status==='available')return {...s,frame:{...s.frame,scopeId:`thread-${n}`}};return s;};return {seed:async()=>{calls.push(`seed-${n}`);},restore:async()=>snap('restored-history'),startContinuation:async()=>{calls.push(`start-${n}`);},exercise:async()=>{if(fail==='exercise')throw Error('hostile private error');return journey==='follow'?{samples:[snap('streaming',0),snap('streaming',800,'R','RR')],anchorId:null,returned:null,wheel:null}:{samples:[snap('streaming',0,'H0'),snap('streaming',800,'H0','RR')],anchorId:'H0',returned:snap('streaming',900,'R','RRR'),wheel:{isTrusted:true,deltaY:-600,beforeScrollTop:900,afterScrollTop:300}};},complete:async()=>{calls.push(`complete-${n}`);return snap('completed');},close:async()=>{calls.push(`close-${n}`);if(fail==='close')throw Error('cleanup error');return record(journey,n);}};}};return {calls,ports,setFailure:(f:string)=>{fail=f;}};}

// Supplied data only. Installed graph/module/admission defaults are refused;
// successful cases pass the actual existing pure policy validators, never an SDK.
describe('mounted conformance admission order',()=>{
 it.each(['original-run','source-file-digest'] as const)('denies same-SHA mixed installed intent: %s before ports',async kind=>{
  const p=prerequisites(),f=supplied(),base=structuredClone(p.intent);
  const other=kind==='original-run'?{...base,prerequisite:{...base.prerequisite,originalRunId:'99'}}:
   {...base,source:{...base.source,files:base.source.files.map((file,i)=>i===1?{...file,sha256:'d'.repeat(64)}:file)}};
  p.installed={...p.installed,intent:other};
  expect((await runMountedConformance(p,f.ports)).primaryFailure).toBe('prerequisite');expect(f.calls).toEqual([]);
 });
 it.each([['follow',4],['history-reading',5]] as const)('refuses full snapshot call beyond %s budget before callback',async(journey,limit)=>{
  let calls=0;const read=createMountedSnapshotReader(journey,async()=>{calls++;return snapshot('restored-history');});
  for(let i=0;i<limit;i++)await read();
  await expect(read()).rejects.toThrow();expect(calls).toBe(limit);
 });
 it('charges failed full snapshot calls before invoking their original callback',async()=>{
  let calls=0;const read=createMountedSnapshotReader('follow',async()=>{calls++;throw Error('unavailable');});
  for(let i=0;i<4;i++)await expect(read()).rejects.toThrow();
  await expect(read()).rejects.toThrow();expect(calls).toBe(4);
 });
 it('never evaluates a hostile Error.message getter while retaining hook failure',()=>{
  let calls=0;const error=new Error();Object.defineProperty(error,'message',{get(){calls++;throw Error('secret getter');}});
  const operations=new ownership.OwnedOperations({} as ownership.CaseControls);
  expect(()=>ownership.notifyNativeCase({observe:()=>{throw error;}},operations,{kind:'witness',label:'caseDomainRelease',status:'fulfilled'})).not.toThrow();expect(calls).toBe(0);expect(operations.failures().cleanup).toEqual(['Native observation callback failed']);
 });
 it('rejects successful final publication when a last callback recorded cleanup failure',async()=>{
  const operations=new ownership.OwnedOperations({} as ownership.CaseControls);
  ownership.notifyNativeCase({observe:()=>{throw Error('failed after real release');}},operations,{kind:'witness',label:'caseDomainRelease',status:'fulfilled'});
  await expect(operations.awaitOriginals(true)).rejects.toThrow('Owned operation failure');
 });
 it('retains observation callback failure without stranding the original operation',()=>{
  const notify=(ownership as {notifyNativeCase?:unknown}).notifyNativeCase;
  expect(notify).toBeTypeOf('function');if(typeof notify!=='function')throw Error('Expected native callback helper');
  const failures:unknown[]=[];const event={kind:'witness',label:'bridge',status:'fulfilled'};
  expect(()=>notify({observe:()=>{throw Error('observer failed');}}, {cleanupFailure:(e:unknown)=>failures.push(e)},event)).not.toThrow();expect(failures).toHaveLength(1);
 });
 it('denies absent prerequisites before connecting or allocating anything',async()=>{
  let calls=0;const ports={connect:async()=>{calls++;},openCase:async()=>{calls++;throw Error('not admitted');},closeClient:async()=>{calls++;}};
  const result=await runMountedConformance({} as MountedPrerequisites,ports);
  expect(result.status).toBe('incomplete');expect(result.primaryFailure).toBe('prerequisite');expect(calls).toBe(0);expect(result.fps).toBe('unavailable');expect(result.qualification).toBe(false);
 });
});

describe('serial supplied-port native conformance',()=>{
 it('validates both journeys and closes case1 before allocating case2',async()=>{const f=supplied(),r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('complete');expect(r.cases.map(c=>c.journey)).toEqual(['follow','history-reading']);expect(f.calls.indexOf('close-1')).toBeLessThan(f.calls.indexOf('open-2'));expect(f.calls.at(-1)).toBe('client-close');expect(r.qualification).toBe(false);expect(r.fps).toBe('unavailable');});
 it('does not evaluate SDK ports for cross-source STATIC data',async()=>{const f=supplied(),p=prerequisites();p.intent={...p.intent,prerequisite:{...p.intent.prerequisite,sourceSha:'c'.repeat(40)}};const r=await runMountedConformance(p,f.ports);expect(r.primaryFailure).toBe('prerequisite');expect(f.calls).toEqual([]);});
 it('preserves primary failure, closes original case/client and never starts case2',async()=>{const f=supplied();f.setFailure('exercise');const r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('incomplete');expect(r.primaryFailure).toBe('case-conformance');expect(f.calls).toContain('close-1');expect(f.calls).not.toContain('open-2');expect(f.calls.at(-1)).toBe('client-close');});
 it('refuses reuse when original cleanup rejects',async()=>{const f=supplied();f.setFailure('close');const r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('incomplete');expect(r.cleanupFailures).toContain('case-close');expect(f.calls.filter(x=>x==='close-1')).toHaveLength(1);expect(f.calls).not.toContain('open-2');});
});

describe('actual native gesture and case binding requirements',()=>{
 it('caps returned sample cardinality before walking extra supplied entries',async()=>{
  const f=supplied(),open=f.ports.openCase;let reads=0;
  f.ports.openCase=async(j,n)=>{const owner=await open(j,n),exercise=owner.exercise;owner.exercise=async journey=>{const observations=await exercise(journey),samples=[...observations.samples];Object.defineProperty(samples,2,{get(){reads++;throw Error('must preflight sample count');}});return {...observations,samples};};return owner;};
  expect((await runMountedConformance(prerequisites(),f.ports)).status).toBe('incomplete');expect(reads).toBe(0);
 });
 it.each(['untrusted','no-movement'] as const)('refuses %s history input even when anchor geometry looks valid',async(kind)=>{const f=supplied(),open=f.ports.openCase;f.ports.openCase=async(j,n)=>{const owner=await open(j,n),exercise=owner.exercise;owner.exercise=async journey=>{const observations=await exercise(journey);return journey==='history-reading'?{...observations,wheel:{isTrusted:kind!=='untrusted',deltaY:-600,beforeScrollTop:900,afterScrollTop:kind==='no-movement'?900:300}}:observations;};return owner;};const r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('incomplete');expect(r.primaryFailure).toBe('case-conformance');});
 it('refuses a successful case record whose thread differs from original geometry scope',async()=>{const f=supplied(),open=f.ports.openCase;f.ports.openCase=async(j,n)=>{const owner=await open(j,n),close=owner.close;owner.close=async()=>({...await close(),threadId:'foreign-thread'});return owner;};const r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('incomplete');expect(f.calls).not.toContain('open-2');});
});

describe('final rendered response conformance',()=>{
 it('denies public completion whose final DOM sample is not completed exact response text',async()=>{const f=supplied(),open=f.ports.openCase;f.ports.openCase=async(j,n)=>{const owner=await open(j,n);owner.complete=async()=>snapshot('streaming');return owner;};const r=await runMountedConformance(prerequisites(),f.ports);expect(r.status).toBe('incomplete');expect(f.calls).not.toContain('open-2');});
});
