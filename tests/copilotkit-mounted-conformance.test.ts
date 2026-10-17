import {describe,it,expect,vi} from 'vitest';
import {runMountedConformance,createMountedSnapshotReader,type MountedPrerequisites,type MountedConformancePorts,type MountedCaseOwner} from '../apps/copilotkit/runtime/mounted-conformance.ts';
import {MOUNTED_PACKAGE_PINS} from './support/hosted-copilot-mounted-policy.ts';
import {evaluateMountedGeometry} from '../apps/copilotkit/src/geometry-policy.ts';
import type {GeometrySnapshot} from '../apps/copilotkit/src/geometry.ts';
import type {CaseRecord,CaseJourney} from './support/hosted-copilot-mounted-policy.ts';
import * as ownership from '../apps/copilotkit/runtime/ownership.ts';
import * as readiness from '../apps/copilotkit/runtime/mounted-conformance.ts';
import type {RestoredHistoryContentScalar,RestoredHistoryReadinessDiagnostic} from '../apps/copilotkit/src/geometry.ts';

describe('runtime disposal original observation',()=>{
 const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
 function expired(){const clock=vi.spyOn(performance,'now').mockReturnValueOnce(0).mockReturnValue(10001);return {budget:new ownership.SettlementBudget(),restore:()=>clock.mockRestore()};}
 it('retains synchronous deadline refusal and observes the later original rejection',async()=>{
  let reject!:(reason:unknown)=>void;const original=new Promise<void>((_resolve,no)=>{reject=no;});const f=expired();
  try{expect(()=>f.budget.wait(original,'original mounted disposal')).toThrow('Original cleanup deadline exceeded; ownership retained');}finally{f.restore();}
  await turn();reject(Error('Late runtime disposal original rejection'));await turn();await turn();
 });
 it.each([null,undefined,false,Object.freeze({original:true})])('preserves a normal original rejection by identity %j',async reason=>{
  await expect(new ownership.SettlementBudget().wait(Promise.reject(reason),'original')).rejects.toBe(reason);
 });
 it('preserves fulfillment value and refuses an already fulfilled original after expiry',async()=>{
  const value=Object.freeze({value:true});expect(await new ownership.SettlementBudget().wait(Promise.resolve(value),'original')).toBe(value);const f=expired();
  try{expect(()=>f.budget.wait(Promise.resolve(value),'original')).toThrow('Original cleanup deadline exceeded');}finally{f.restore();}
 });
 it('keeps an original pending after deadline until its independent outcome',async()=>{
  let reject!:(reason:unknown)=>void,settled=false;const original=new Promise<void>((_resolve,no)=>{reject=no;});const reason=Object.freeze({late:true});
  const own=original.then(()=>{settled=true;},error=>{settled=true;expect(error).toBe(reason);});const f=expired();
  try{expect(()=>f.budget.wait(original,'original')).toThrow('Original cleanup deadline exceeded');}finally{f.restore();}
  expect(settled).toBe(false);reject(reason);await own;expect(settled).toBe(true);
 });
 it('observes the late rejection after a positive-budget timeout without an independent catch',async()=>{
  let reject!:(reason:unknown)=>void;const original=new Promise<void>((_resolve,no)=>{reject=no;});
  const clock=vi.spyOn(performance,'now').mockReturnValueOnce(0).mockReturnValue(9999);const budget=new ownership.SettlementBudget();let waiting:Promise<void>;
  try{waiting=budget.wait(original,'original');}finally{clock.mockRestore();}
  await expect(waiting!).rejects.toThrow('original settlement deadline exceeded');reject(Error('Late original after runtime race'));await turn();await turn();
 });
});

describe('bounded original history readiness preflight',()=>{
 const history=[{id:'history-0',role:'assistant' as const}],context={caseNumber:1 as const,journey:'follow' as const,threadId:'native-thread-1',history};
 const pending:RestoredHistoryContentScalar={status:'pending',reason:'empty-text',mountedRows:1,emptyRows:1,firstRowId:'history-0',firstRowRole:'assistant'};
 const ready:RestoredHistoryContentScalar={status:'ready',reason:'content-ready',mountedRows:1,emptyRows:0,firstRowId:null,firstRowRole:null};
 function setup(){let calls=0,pauses=0;const records:RestoredHistoryReadinessDiagnostic[]=[];return {records,get calls(){return calls;},get pauses(){return pauses;},ports:{check:()=>null,observe:async():Promise<unknown>=>{calls++;return calls===1?pending:ready;},pause:async()=>{pauses++;},publish:async(r:RestoredHistoryReadinessDiagnostic)=>{records.push(r);}}};}
 it('publishes first/last before authoritative geometry and does not consume snapshot budget',async()=>{const f=setup(),events:string[]=[];const publish=f.ports.publish;f.ports.publish=async r=>{events.push('publish');await publish(r);};await readiness.awaitRestoredHistoryContent(context,f.ports);events.push('geometry');expect(events).toEqual(['publish','geometry']);expect(f.calls).toBe(2);expect(f.pauses).toBe(1);expect(f.records).toEqual([{kind:'copilot-mounted-history-readiness-v1',caseNumber:1,journey:'follow',threadId:'native-thread-1',attemptCount:2,outcome:'ready',reason:'content-ready',first:pending,last:ready,qualification:false}]);});
 it('stops after120 pending originals and publishes honest attempt limit',async()=>{const f=setup();f.ports.observe=async()=>{return pending;};await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toThrow();expect(f.records[0]).toMatchObject({attemptCount:120,outcome:'unavailable',reason:'attempt-limit',first:pending,last:pending});expect(f.pauses).toBe(119);});
 it.each([1,2])('preserves rejected original observation identity at attempt%i',async at=>{const f=setup(),error=Object.freeze({foreign:true});let n=0;f.ports.observe=async()=>{if(++n===at)throw error;return pending;};await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toBe(error);expect(f.records[0]).toMatchObject({attemptCount:at,reason:'observation-rejected',first:at===1?null:pending,last:at===1?null:pending});});
 it('does not fabricate an attempt or line before admission check',async()=>{const f=setup();f.ports.check=()=>{throw Error('closed');};await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toThrow();expect(f.calls).toBe(0);expect(f.records).toEqual([]);});
 it('rejects invalid wire keys without retaining them as last scalar',async()=>{const f=setup();f.ports.observe=async()=>({...pending,text:'must not retain'});await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toThrow();expect(f.records[0]).toMatchObject({attemptCount:1,reason:'scalar-contract',first:null,last:null});});
 it('keeps pending publication owned and never overlaps evaluation',async()=>{const f=setup();let settle!:()=>void;f.ports.observe=async()=>ready;f.ports.publish=()=>new Promise<void>(resolve=>{settle=resolve;});let done=false;const original=readiness.awaitRestoredHistoryContent(context,f.ports).then(()=>{done=true;});await Promise.resolve();await Promise.resolve();expect(done).toBe(false);settle();await original;expect(done).toBe(true);});
 it('owns a held observation without scheduling another observation or sleep',async()=>{const f=setup();let settle!:(v:unknown)=>void,calls=0;f.ports.observe=()=>{calls++;return new Promise(resolve=>{settle=resolve;});};let done=false;const original=readiness.awaitRestoredHistoryContent(context,f.ports).then(()=>{done=true;});await Promise.resolve();await Promise.resolve();expect(calls).toBe(1);expect(f.pauses).toBe(0);expect(f.records).toEqual([]);expect(done).toBe(false);settle(ready);await original;expect(calls).toBe(1);});
 it.each(['deadline','admission-closed','source-error'] as const)('retains validated first/last after later %s',async reason=>{const f=setup();let checks=0;const ports={...f.ports,check:()=>++checks===1?null:reason,observe:async()=>pending};await expect(readiness.awaitRestoredHistoryContent(context,ports)).rejects.toThrow();expect(f.records[0]).toMatchObject({attemptCount:1,outcome:'unavailable',reason,first:pending,last:pending});});
 it('runs original case cleanup and client close after publication failure with no continuation or case2',async()=>{const f=supplied(),open=f.ports.openCase;f.ports.openCase=async(j,n)=>{const owner=await open(j,n);let publicationFailed=false;const close=owner.close;owner.restore=async()=>{await readiness.awaitRestoredHistoryContent(context,{check:()=>null,observe:async()=>ready,pause:async()=>{},publish:async()=>{publicationFailed=true;throw Error('sink');}});return snapshot('restored-history');};owner.close=()=>readiness.closeAfterHistoryReadinessPublication(close,()=>publicationFailed);return owner;};const result=await runMountedConformance(prerequisites(),f.ports);expect(f.calls).toEqual(['connect','open-1','seed-1','close-1','client-close']);expect(result.primaryFailure).toBe('case-conformance');expect(result.cleanupFailures).toEqual(['case-close']);expect(result.snapshots).toEqual([]);});
 it('preserves earlier primary when original publication also rejects',async()=>{const f=setup(),primary=Object.freeze({primary:true}),sink=Object.freeze({sink:true});f.ports.observe=async()=>{throw primary;};f.ports.publish=async()=>{throw sink;};await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toBe(primary);});
 it('refuses ready progression on publication failure',async()=>{const f=setup(),sink=Object.freeze({sink:true});f.ports.observe=async()=>ready;f.ports.publish=async()=>{throw sink;};await expect(readiness.awaitRestoredHistoryContent(context,f.ports)).rejects.toBe(sink);});
 it('awaits ordinary cleanup before local publication latch refusal and preserves cleanup rejection',async()=>{const events:string[]=[];await expect(readiness.closeAfterHistoryReadinessPublication(async()=>{events.push('cleanup');return 1;},()=>true)).rejects.toThrow();expect(events).toEqual(['cleanup']);const original=Object.freeze({cleanup:true});await expect(readiness.closeAfterHistoryReadinessPublication(async()=>{throw original;},()=>true)).rejects.toBe(original);});
});


const sha='a'.repeat(40),hash='b'.repeat(64),lock='c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56';
function prerequisites():MountedPrerequisites {
 const intent:MountedPrerequisites['intent']={schemaVersion:1,kind:'pre-install-intent',purpose:'hosted-copilot-mounted-default-react-only',context:{candidateSha:sha,checkoutSha:sha,githubSha:sha,workflowSha:sha,tagSha:sha,repository:'cacheplane/chat-ui-bench',releaseId:'hosted-copilot-react-h100-r6400-v6',githubRef:'refs/tags/hosted-copilot-react-h100-r6400-v6',workflowRef:'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-mounted.yml@refs/tags/hosted-copilot-react-h100-r6400-v6',eventName:'workflow_dispatch',actions:'true',platform:'linux',runnerOs:'Linux',runnerMarker:'ubuntu-24.04-hosted-copilot-mounted',attempt:'1'},source:{commitSha:sha,treeSha:sha,lockSha256:lock,files:['package-lock.json','.github/workflows/hosted-copilot-mounted.yml','tools/hosted-copilot-mounted-bootstrap.mjs','apps/copilotkit/hosted-native-entry.ts','apps/copilotkit/src/geometry-policy.ts'].map(path=>({path,bytes:1,sha256:path==='package-lock.json'?lock:hash,regular:true,contained:true,symlink:false}))},prerequisite:{originalRunId:'3',attempt:1,sourceSha:sha,artifactId:'4',archiveSha256:hash,qualifiedRootReceiptSha256:hash,qualifiedPeerReceiptSha256:hash,frontendSettingsSha256:hash},profile:{nodeVersion:'v24.20.0',npmVersion:'11.19.0',telemetryDisabled:'true',doNotTrack:'1'}};
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
