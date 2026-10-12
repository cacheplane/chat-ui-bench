import {expect,test,vi} from 'vitest';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {createLongThreadCaptureDriver} from './long-thread-capture.js';
import {ComparisonOwnership} from './comparison-ownership.js';
import {ComparisonArtifactWriter,type ComparisonFileOperations} from './comparison-artifacts.js';
import {createLongThreadLedger,runLongThreadInvocation} from './long-thread-run.js';
import {createLongThreadFixture,mainOptionsSchema,preNavigationOptionsSchema,canonicalSerialize,comparisonAdapterSchema,comparisonInstrumentationBuildSchema,comparisonInstrumentationSchema} from '@chat-ui-bench/contract';
import {chromium,type Browser,type BrowserContext,type Page,type CDPSession} from 'playwright';
import {assembleComparisonInstaller} from './comparison-installer.js';
import {createComparisonTraceCapture} from './comparison-trace.js';
import {mkdtemp,rm,readFile,open,stat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const actualTimer=setTimeout;
const actualClearTimer=clearTimeout;
test('default comparison launch explicitly requests genuine browser command-line identity',async()=>{
 let directory:string|undefined,owner:ComparisonOwnership|undefined,writer:ComparisonArtifactWriter|undefined,restore:(()=>void)|undefined;
 let primaryFailed=false,primaryError:unknown;
 const cleanupErrors:unknown[]=[];
 try{
   directory=await mkdtemp(join(tmpdir(),'g-capture-launch-'));owner=new ComparisonOwnership();writer=await ComparisonArtifactWriter.create(directory);
   const config=configuration(),slot=createLongThreadLedger(config).runs[0]!;
   const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
   const sentinel=new Error('Observed original default launch boundary'),launch=vi.spyOn(chromium,'launch');restore=()=>launch.mockRestore();launch.mockRejectedValue(sentinel);
   const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(_session,pre,main){return assembleComparisonInstaller(pre,main);},async resolveProfile(){return profile();}});
   const actualWriter=writer;let operationFailed=false,operationError:unknown;
   const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:actualWriter.scoped(()=>ownership.assertActive())});}catch(value){operationFailed=true;operationError=value;throw value;}});
   expect(result.status).toBe('failed');expect(operationFailed).toBe(true);expect(operationError).toBe(sentinel);expect(launch).toHaveBeenCalledExactlyOnceWith({headless:true,args:['--enable-automation']});
 }catch(error){primaryFailed=true;primaryError=error;}
 finally{
   // Restore the real launch method even if another cleanup operation fails.
   try{restore?.();}catch(error){cleanupErrors.push(error);}
   const closing:Promise<unknown>[]=[];
   function start(call:()=>Promise<unknown>){try{const task=call();void task.catch(()=>{});closing.push(task);}catch(error){cleanupErrors.push(error);}}
   if(owner){const actualOwner=owner;start(()=>actualOwner.dispose());start(()=>actualOwner.ownershipSettled);}
   if(writer){const actualWriter=writer;start(()=>actualWriter.drain());}
   const results=await Promise.allSettled(closing);for(const result of results)if(result.status==='rejected')cleanupErrors.push(result.reason);
   if(directory){try{await rm(directory,{recursive:true,force:true});}catch(error){cleanupErrors.push(error);}}
 }
 if(primaryFailed){if(cleanupErrors.length)console.error('Default-launch regression cleanup failures',cleanupErrors);throw primaryError;}
 if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Default-launch regression cleanup failed');
});
const actualImmediate=setImmediate;
async function settleFreshReplay<T>(order:string[],replay:Promise<T>,finished:()=>boolean,afterPump?:()=>void,settlementMs=1000):Promise<T>{
 for(let index=0;index<1000&&!order.includes('phase:history-reading');index++)await new Promise<void>(resolve=>actualImmediate(resolve));
 for(let index=0;index<200&&!finished();index++){await vi.advanceTimersByTimeAsync(50);await new Promise<void>(resolve=>actualTimer(resolve,1));}
 afterPump?.();
 // The pump advances page-time assertions; real artifact IO still belongs to replay.
 let timer:ReturnType<typeof actualTimer>|undefined;
 const timeout=new Promise<never>((_resolve,reject)=>{timer=actualTimer(()=>reject(new Error(`Original fresh replay did not settle within ${settlementMs}ms`)),settlementMs);});
 try{return await Promise.race([replay,timeout]);}finally{if(timer!==undefined)actualClearTimer(timer);}
}
test('fresh replay completion joins held final writer IO before fixture cleanup',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);
 const entered=deferred<void>(),hold=deferred<void>(),pumped=deferred<void>();let delegated=0;
 try{await lifecycleFixture(async({driver,owner,context,order,directory})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined,finished=false,completionSettled=false;
   const setup=await owner.run('setup',async ownership=>{state=await driver.setup(context(ownership));});expect(setup.status).toBe('complete');
   const replay=owner.run('replay',ownership=>driver.replay(context(ownership),state!)).finally(()=>{finished=true;});void replay.catch(()=>{});
   const completion=settleFreshReplay(order,replay,()=>finished,()=>pumped.resolve());void completion.then(()=>{completionSettled=true;},()=>{completionSettled=true;});
   try{
     await entered.promise;await pumped.promise;await Promise.resolve();
     expect(finished).toBe(false);expect(completionSettled).toBe(false);expect(delegated).toBe(0);
     hold.resolve();const result=await completion;expect(result.status).toBe('complete');expect(finished).toBe(true);expect(delegated).toBe(1);
     expect(JSON.parse(await readFile(join(directory,'phases.json'),'utf8')).status).toBe('complete');
   }finally{hold.resolve();await Promise.allSettled([completion,replay]);}
 },{history:true,comparisonVersion:'2.1.0',freshPostDelayMs:400,io:{async rename(from,to){if(String(to).endsWith('/phases.json')){entered.resolve();await hold.promise;await rename(from,to);delegated++;return;}await rename(from,to);}}});}
 finally{hold.resolve();vi.useRealTimers();}
});
test('fresh replay real settlement timeout retains primary and joins held writer cleanup',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);
 const entered=deferred<void>(),hold=deferred<void>(),pumped=deferred<void>();let delegated=0;
 try{await lifecycleFixture(async({driver,owner,context,order})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined,finished=false,failed=false,error:unknown,disposalSettled=false;
   const setup=await owner.run('setup',async ownership=>{state=await driver.setup(context(ownership));});expect(setup.status).toBe('complete');
   const replay=owner.run('replay',ownership=>driver.replay(context(ownership),state!)).finally(()=>{finished=true;});void replay.catch(()=>{});
   const completion=settleFreshReplay(order,replay,()=>finished,()=>pumped.resolve(),20);void completion.catch(()=>{});
   let disposal:Promise<unknown>|undefined;
   // Rescue only the deliberately broken helper in the RED: never leave its original IO hanging.
   let rescue:ReturnType<typeof actualTimer>|undefined;
   try{
     await entered.promise;await pumped.promise;
     rescue=actualTimer(()=>hold.resolve(),1000);
     try{await completion;}catch(value){failed=true;error=value;}
     expect(failed).toBe(true);expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe('Original fresh replay did not settle within 20ms');
     expect(finished).toBe(false);expect(delegated).toBe(0);
     disposal=owner.dispose();void disposal.then(()=>{disposalSettled=true;},()=>{disposalSettled=true;});await Promise.resolve();
     expect(disposalSettled).toBe(false);expect(finished).toBe(false);
     hold.resolve();await Promise.allSettled([replay,disposal]);expect(finished).toBe(true);expect(disposalSettled).toBe(true);expect(delegated).toBe(1);
   }finally{if(rescue!==undefined)actualClearTimer(rescue);hold.resolve();await Promise.allSettled([completion,replay,...(disposal?[disposal]:[])]);}
 },{history:true,comparisonVersion:'2.1.0',freshPostDelayMs:400,io:{async rename(from,to){if(String(to).endsWith('/phases.json')){entered.resolve();await hold.promise;await rename(from,to);delegated++;return;}await rename(from,to);}}});}
 finally{hold.resolve();vi.useRealTimers();}
});
test('fresh family waits on original delayed post page timestamp rather than nominal host1000',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const requests:{notBeforePageMs:number|null}[]=[];
 try{await lifecycleFixture(async({driver,owner,context,order,scrollReads})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,failed=false,error:unknown,finished=false;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});
   try{await settleFreshReplay(order,replay,()=>finished);
     expect(finished,order.join(',')).toBe(true);const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status,JSON.stringify(capture?.validation.reasons)).toBe('valid');
     expect(requests.length).toBeGreaterThanOrEqual(5);expect(requests.slice(0,3)).toEqual([{notBeforePageMs:null},{notBeforePageMs:null},{notBeforePageMs:scrollReads[1]!.pageMs+800}]);expect(scrollReads[2]!.pageMs-scrollReads[1]!.pageMs).toBeGreaterThanOrEqual(800);
   }finally{if(!finished){const disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);}else await replay;}
 },{history:true,comparisonVersion:'2.1.0',freshRequests:requests,freshPostDelayMs:400});}finally{vi.useRealTimers();}
});
const configuration=()=>{const parsed=parseLongThreadArgs(['--out','/private/tmp/g-test-unused','--mode','headless','--rounds','1']);if(parsed.help)throw new Error('Unexpected help');return parsed;};
for(const failure of ['missing-post','ignored-target'] as const)test('fresh window '+failure+' never promotes unavailable or early actual samples',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const requests:{notBeforePageMs:number|null}[]=[];
 try{await lifecycleFixture(async({driver,owner,context,order,scrollReads})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,failed=false,error:unknown,finished=false;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});
   try{await settleFreshReplay(order,replay,()=>finished);
     expect(finished,order.join(',')).toBe(true);const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status).toBe('failed');expect(capture?.validation.reasons).toContain('Actual fresh samples do not cover the required 800ms window');
     if(failure==='missing-post')expect(requests.every(request=>request.notBeforePageMs===null)).toBe(true);else{expect(requests[2]).toEqual({notBeforePageMs:scrollReads[1]!.pageMs+800});expect(scrollReads[2]!.pageMs-scrollReads[1]!.pageMs).toBeLessThan(800);}
   }finally{if(!finished){const disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);}else await replay;}
 },{history:true,comparisonVersion:'2.1.0',freshRequests:requests,freshPostDelayMs:400,freshUnavailablePost:failure==='missing-post',freshIgnoreMinimum:failure==='ignored-target'});}finally{vi.useRealTimers();}
});
test('factory validates configuration and original root before any acquisition',()=>{
 expect(()=>createLongThreadCaptureDriver({originalRoot:'',configuration:configuration()})).toThrow('root');
 expect(()=>createLongThreadCaptureDriver({originalRoot:'/private/tmp',configuration:{...configuration(),purpose:'publication'}})).toThrow('purpose');
});
test('setup rejects identity differing from its actual descriptor before provenance acquisition',async()=>{
 const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-identity-')),owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(directory);let acquisitions=0,failed=false,error:unknown;
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(){acquisitions++;throw false;}});
 try{const result=await owner.run('setup',async ownership=>{try{await driver.setup({identity:{...identity,repetition:'different'},descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});expect(result.status).toBe('failed');expect(failed).toBe(true);expect(String(error)).toContain('Slot identity differs');expect(acquisitions).toBe(0);}
 finally{await owner.dispose();await owner.ownershipSettled;await rm(directory,{recursive:true,force:true});}
});
test('initial instrumentation cannot stand in for an actual stopped terminal read after setup failure',async()=>{
 const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-initial-')),owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(directory);
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
 const unavailable={status:'unavailable',reason:'fixture'},probe={intervalMs:50,callbacks:0,callbackDurationTotalMs:0,maximumObservedGapMs:unavailable},instrumentation=comparisonInstrumentationSchema.parse({runtimeProbe:probe,domProbe:{...probe,selectionStrategy:'bounded-visible-candidates'},scrollProbe:probe,transportDrain:probe,eventTiming:unavailable,loaf:unavailable,buffers:[]});
 const adapter=profile(),build=comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(new URL('../.comparison-build-evidence.json',import.meta.url),'utf8')));
 const facts={git:{revision:'fixture',dirty:false},assets:adapter.build.assetHashes,browser:{executable:'/fixture',version:'fixture',revision:'fixture',flags:[]},environment:{os:'fixture',architecture:'fixture',cpu:{status:'unavailable' as const,reason:'fixture'},gpu:{status:'unavailable' as const,reason:'fixture'}},browserProtocol:{protocolVersion:'fixture',product:'fixture',revision:'fixture',userAgent:'fixture',jsVersion:'fixture'},chromiumDownloadRevision:'fixture',playwrightVersion:'fixture'};
 let reads=0,stops=0,disposes=0,failed=false,error:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
 const dispose=()=>disposal??=owner.dispose();
 const transfer={sourceFinal:null,attempted:0,accepted:0,rejected:0,failureReason:null,remainingEntries:0,remainingSerializedBytes:0,complete:true};
 const capture={readInstrumentation(){reads++;return instrumentation;},stop(){stops++;},readPreNavigationTransfer(){return transfer;},drain(){return [];},setPhase(){}},host={async loadHistory(){throw false;},async dispose(){disposes++;}},counter={async send(method:string){return method==='Runtime.getHeapUsage'?{usedSize:1}:{nodes:1,documents:1,jsEventListeners:1};},async detach(){}} as unknown as CDPSession;
 const page={async close(){},async addInitScript(){},async goto(){},async waitForFunction(){},async evaluate(callback:unknown,arg:unknown){if(typeof callback==='string')return;vi.stubGlobal('window',{comparisonCapture:capture,benchHost:host});try{return await (callback as (arg:unknown)=>unknown)(arg);}finally{vi.unstubAllGlobals();}}} as unknown as Page;
 const browserContext={async close(){},async newPage(){return page;},async newCDPSession(){return counter;},async route(){return {async dispose(){}};},async unrouteAll(){}} as unknown as BrowserContext;
 const browser={async close(){},async newContext(){return browserContext;},async newBrowserCDPSession(){return counter;}} as unknown as Browser;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(_session,pre,main){return assembleComparisonInstaller(pre,main);},async resolveProfile(){return adapter;},async launch(){return browser;},async collectEnvironment(){return {facts,async recheckBeforeServing(){return facts;}};},async recheckServing(){return {originalRoot:directory,build:adapter.build,probe:build,assets:adapter.build.assetHashes};},async recheckProfile(){return adapter;},async serveAssets(){return {url:'http://localhost:4010/',async close(){}};},async createReplayServer(){return {url:'http://localhost:4011/replay',state:'idle',drain(){return [];},async close(){}} as unknown as Awaited<ReturnType<NonNullable<import('./long-thread-capture.js').LongThreadCaptureDependencies['createReplayServer']>>>;}});
 try{
   const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});
   expect(result.status).toBe('failed');expect(failed).toBe(true);expect(error).toBe(false);await dispose();await owner.ownershipSettled;
   const final=await driver.finalize!({identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},null);expect(final).toBeDefined();if(!final)throw new Error('Missing real finalization');
   expect(reads).toBe(1);expect(stops).toBe(1);expect(disposes).toBe(1);expect(final.captureStatus.finalPageInstrumentation.status).toBe('unavailable');
 }finally{await dispose();await owner.ownershipSettled;vi.unstubAllGlobals();await rm(directory,{recursive:true,force:true});}
});
test('actual root retains an unsafe held acquisition before genuine settlement and seals failed not-started rows afterward',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);
 const directory=await mkdtemp(join(tmpdir(),'g-capture-root-')),config={...configuration(),out:directory},entered=deferred<void>(),hold=deferred<void>(),disposalArmed=deferred<void>();let attempts=0;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(session){attempts++;expect(session.snapshotAcquisition().acquisition.status).toBe('partial');entered.resolve();await hold.promise;throw false;},async launch(){throw new Error('Forbidden browser acquisition after failure');}});
 const run=runLongThreadInvocation(config,driver,{clock:{now:Date.now,setTimer(callback,delay){if(delay===10000)disposalArmed.resolve();return setTimeout(callback,delay);},clearTimer:clearTimeout}});void run.catch(()=>{});
 try{
   await entered.promise;await vi.advanceTimersByTimeAsync(60000);await disposalArmed.promise;await vi.advanceTimersByTimeAsync(10000);const result=await run;
   expect(result.finalized).toBe(false);expect(result.unsafeOutstanding).toBe(true);expect(attempts).toBe(1);await expect(readFile(join(directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});expect(result.invocation.runs.every(row=>row.status==='failed')).toBe(true);
   hold.resolve();await result.ownershipSettled;await result.finalize();expect(result.finalized).toBe(true);expect(result.unsafeOutstanding).toBe(false);expect(attempts).toBe(1);
   const row=result.invocation.runs[0]!,root=join(directory,row.artifactDirectory),status=JSON.parse(await readFile(join(root,'capture-status.json'),'utf8')),acquisition=JSON.parse(await readFile(join(root,'provenance/acquisition.json'),'utf8'));
   expect(status.status).toBe('partial');for(const field of ['captureMetadata','evidenceMetadata','terminalPageDrain','terminalProducerDrain','finalPageInstrumentation','traceEof'])expect(status[field].status).toBe('unavailable');expect(acquisition.status).toBe('partial');expect(acquisition.members).toEqual([]);expect(status.reasons).toContain('Capture did not complete');expect(status.reasons).not.toContain('Offline analysis not performed');
   const exceptions=JSON.parse(await readFile(join(root,'exceptions.json'),'utf8'));expect(JSON.stringify(exceptions)).toContain('absolute deadline');expect(JSON.parse(await readFile(join(directory,'dataset-seal.json'),'utf8')).status).toBe('sealed');
   expect(result.invocation.runs.slice(1)).toHaveLength(11);for(const pending of result.invocation.runs.slice(1))expect(pending.reasons.join(';')).toContain('unsafe outstanding ownership');
 }finally{hold.resolve();const result=await run;await result.ownershipSettled;vi.useRealTimers();await rm(directory,{recursive:true,force:true});}
});
test('retains a genuine branded session before the first acquire and admits exact canonical options',async()=>{
 const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-')),owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(directory);
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
 let acquired=false,failed=false,error:unknown;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(session,pre,main){acquired=true;expect(session.snapshotAcquisition().acquisition.status).toBe('partial');expect(canonicalSerialize(preNavigationOptionsSchema.parse(JSON.parse(pre)))).toBe(pre);expect(canonicalSerialize(mainOptionsSchema.parse(JSON.parse(main)))).toBe(main);throw false;}});
 try{const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});expect(result.status).toBe('failed');expect(acquired).toBe(true);expect(failed).toBe(true);expect(error).toBe(false);expect(owner.failures.map(row=>row.message)).toContain('false');}
 finally{await owner.dispose();await owner.ownershipSettled;await rm(directory,{recursive:true,force:true});}
});
test('filesystem finalization releases the single retained registry for a second genuine failed slot',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'g-capture-reuse-')),config=configuration(),slots=createLongThreadLedger(config).runs;let attempts=0;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(session){expect(session.snapshotAcquisition().acquisition.status).toBe('partial');throw attempts++===0?false:0;}});
 try{for(let index=0;index<2;index++){
   const slot=slots[index]!,owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(join(directory,String(index))),identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;let failed=false,error:unknown;
   try{const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:index===0?'follow':'history-reading'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});expect(result.status).toBe('failed');expect(failed).toBe(true);expect(error).toBe(index===0?false:0);}
   finally{await owner.dispose();await owner.ownershipSettled;}
   const final=await driver.finalize!({identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},null);expect(final?.captureStatus.status).toBe('partial');expect(final?.captureStatus.finalPageInstrumentation.status).toBe('unavailable');expect(owner.unsafeOutstanding).toBe(false);
 }expect(attempts).toBe(2);}finally{await rm(directory,{recursive:true,force:true});}
});
test('profile operation follows retained original acquisition and fails before browser launch',async()=>{
 const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-order-')),owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(directory),order:string[]=[];
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;let failed=false,error:unknown;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(_session,pre,main){order.push('acquire');return assembleComparisonInstaller(pre,main);},async resolveProfile(session){order.push('profile');expect(typeof session.snapshotAcquisition).toBe('function');throw new Error('profile rejected');}});
 try{const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});expect(result.status).toBe('failed');expect(failed).toBe(true);expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe('profile rejected');expect(order).toEqual(['acquire','profile']);}
 finally{await owner.dispose();await owner.ownershipSettled;await rm(directory,{recursive:true,force:true});}
});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});void promise.catch(()=>{});return {promise,resolve};}
const profile=()=>comparisonAdapterSchema.parse({id:'threadplane',profile:'threadplane-langgraph-custom-transport',capabilities:{rendering:'all-mounted',scrollPolicy:'bottom-follow',returnToResponse:'native-control'},configuration:{markdown:'default',pinThresholdCssPx:150,telemetry:'disabled'},build:{packages:[{name:'@threadplane/chat',version:'0.3.2',integrity:'sha512-example'}],framework:{name:'Angular',version:'21.2.25'},production:true,sourceHashes:{'adapter.ts':'a'.repeat(64)},copiedSourceHashes:{},assetHashes:{'main.js':'a'.repeat(64)},settings:{optimization:true,sourceMaps:false}}});
/** Individual browser/host/protocol operations, never a substituted G capture/evidence verdict. */
async function lifecycleFixture(body:(fixture:{driver:ReturnType<typeof createLongThreadCaptureDriver>;owner:ComparisonOwnership;writer:ComparisonArtifactWriter;directory:string;context:(ownership:import('./comparison-ownership.js').ComparisonOwnershipContext)=>import('./long-thread-run.js').ComparisonSlotContext;order:string[];pageCalls:()=>number;scrollReads:{hostMs:number;pageMs:number}[];wheelDispatches:number[];pendingDriverTimers:()=>number[];request:(url:string,completion?:Promise<void>)=>Promise<void>;producerStateReads:number[];structuralObservations:{oldConnected:boolean;oldText:string;currentText:string;selectedHostMounted:boolean;hostContainsSelected:boolean;oldStillCurrent:boolean}[]})=>Promise<void>,options:{freshUnavailablePost?:boolean;freshIgnoreMinimum?:boolean;comparisonVersion?:'2.0.0'|'2.1.0';freshRequests?:{notBeforePageMs:number|null}[];freshPostDelayMs?:number;lateOriginLookupMs?:number;observeLocatorOptions?:(value:unknown)=>void;geometryCase?:string;missingReturn?:boolean;invisibleReturn?:boolean;producerState?:'failed'|'disposed';hostWaitHold?:Promise<void>;io?:ComparisonFileOperations;boundary?:string;boundaryHold?:Promise<void>;boundaryNth?:number;observeDetach?:(task:Promise<void>)=>void;traceDetachRejection?:{value:unknown};routeRegistrationHold?:Promise<void>;routeDisposalHold?:Promise<void>;routeDisposalRejection?:{value:unknown};routeRemovalRejection?:{value:unknown};routeRemovalHold?:Promise<void>;routeAbortHold?:Promise<void>;routeAbortRejection?:{value:unknown};pressHold?:Promise<void>;counterEndpointHold?:Promise<void>;counterEndpointEntered?:()=>void;pageAcquireHold?:Promise<void>;pageCloseHold?:Promise<void>;navigationRoute?:string;producerCompletionHold?:Promise<void>;connectionHold?:Promise<void>;productProgress?:unknown;traceFactoryRejection?:{value:unknown};traceAcquireHold?:Promise<void>;traceDetachHold?:Promise<void>;stopHold?:Promise<void>;disposeRejection?:{value:unknown};guardPending?:boolean;history?:boolean;preparationMs?:number;wheelHold?:Promise<void>;stalePostScroll?:boolean;staleScroll?:boolean;unavailableScrollGeometry?:boolean;unknownResponseGeometry?:boolean;visibleUnselectedHistory?:boolean;omitActiveCandidate?:boolean;wrongResponseProse?:boolean}={}){
 let acquiredDirectory:string|undefined,acquiredOwner:ComparisonOwnership|undefined,firstDisposal:ReturnType<ComparisonOwnership['dispose']>|undefined,bodyFailed=false,bodyError:unknown;
 const cleanupErrors:unknown[]=[];
 try{
 const directory=await mkdtemp(join(tmpdir(),'g-capture-lifecycle-'));acquiredDirectory=directory;
 const config=configuration(),slot=createLongThreadLedger(config).runs[options.history?1:0]!,owner=new ComparisonOwnership({now:Date.now});acquiredOwner=owner;
 const writer=await ComparisonArtifactWriter.create(directory,options.io),order:string[]=[];
 const nativeDispose=owner.dispose.bind(owner);
 owner.dispose=()=>{const actual=nativeDispose();void actual.catch(()=>{});firstDisposal??=actual;return actual;};
 const schemas=comparisonRuntimeFamily(options.comparisonVersion),identity={...schemas.versions,repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile},fixture=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:options.history?'history-reading':'follow'});
 const response={id:fixture.events[0]!.messageId,role:'assistant' as const,text:fixture.events.filter(event=>event.type==='text-delta').map(event=>event.text).join(''),status:'complete' as const};
 const adapter=profile(),build=comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(new URL('../.comparison-build-evidence.json',import.meta.url),'utf8'))),unavailable={status:'unavailable' as const,reason:'fixture'},probe={intervalMs:50,callbacks:0,callbackDurationTotalMs:0,maximumObservedGapMs:unavailable},instrumentation=schemas.comparisonInstrumentationSchema.parse({runtimeProbe:probe,domProbe:{...probe,selectionStrategy:'bounded-visible-candidates'},scrollProbe:probe,transportDrain:probe,eventTiming:unavailable,loaf:unavailable,buffers:[],...(options.comparisonVersion==='2.1.0'?{freshScrollProbe:{samplingMode:'on-demand',callbacks:0,callbackDurationTotalMs:0,maximumObservedGapMs:unavailable}}:{})});
 let messages:typeof response[]=[],completed=false,pageClosed=false,calls=0,tick=0,producerReady=!options.producerCompletionHold;const producerStateReads:number[]=[];if(options.producerCompletionHold)void options.producerCompletionHold.then(()=>{producerReady=true;});
 let gateCount=0,exceptionDrained=false,traceReads=0,postDelayed=false;async function gate(name:string){if(options.boundary===name&&++gateCount===(options.boundaryNth??1)){order.push('held:'+name);await options.boundaryHold;}}
 const now=()=>Date.now()+(++tick)/100;
 let mutated=false;class ElementFixture {
   get isConnected(){return !(options.geometryCase==='disconnected-scroller'&&!this.message||options.geometryCase==='disconnected-content'&&this.content&&this.message?.id===response.id);}clientLeft=0;clientTop=0;clientWidth=1280;clientHeight=800;parentElement:ElementFixture|null=null;contentNode:ElementFixture|null=null;
   constructor(readonly message:typeof response|null,readonly content=false){if(content&&message?.id===response.id){if(options.geometryCase==='clip-x')this.clientWidth=0;if(options.geometryCase==='clip-y')this.clientHeight=0;}}
   get textContent(){return (this.message?.text??'')+(mutated&&options.geometryCase==='mutation-text'&&this.message?.id===fixture.history[0]!.id?' changed':'')+(options.wrongResponseProse&&this.message?.id===response.id?' tampered':'');}
   getAttribute(name:string){return name==='data-bench-message-id'?this.message?(this.message.id+(mutated&&options.geometryCase==='mutation-id'&&this.message.id===fixture.history[0]!.id?'-changed':'')):null:name==='data-role'?mutated&&options.geometryCase==='mutation-role'&&this.message?.id===fixture.history[0]!.id?(this.message.role==='assistant'?'user':'assistant'):this.message?.role??null:null;}
   querySelector(){if(!this.contentNode){this.contentNode=new ElementFixture(this.message,true);this.contentNode.parentElement=this;this.parentElement??=scroller;}return this.contentNode;}
   contains(element:ElementFixture){for(let node:ElementFixture|null=element;node;node=node.parentElement)if(node===this)return true;return false;}
   getBoundingClientRect(){if(this.content&&this.message?.id===response.id&&options.geometryCase==='host-only')return {left:0,top:-100,right:1280,bottom:-80};return {left:0,top:this.message?.id===response.id||options.visibleUnselectedHistory&&this.message?.id===fixture.history[0]!.id?20:this.message?-100:0,right:1280,bottom:this.message?.id===response.id||options.visibleUnselectedHistory&&this.message?.id===fixture.history[0]!.id?40:this.message?-80:800};}
 }
 const structuralObservations:{oldConnected:boolean;oldText:string;currentText:string;selectedHostMounted:boolean;hostContainsSelected:boolean;oldStillCurrent:boolean}[]=[];const scroller=new ElementFixture(null);let mounted:ElementFixture[]=[];
 const host={locators:{scroller:'#scroller',composer:'#composer',returnToResponse:options.missingReturn?null:'#return'},async loadHistory(history:typeof fixture.history){order.push('hydrate');messages=history.map(message=>({...message,status:'complete' as const}));mounted=messages.map(message=>new ElementFixture(message));await gate('hydrate');},async connectReplay(){order.push('connect');messages.push(response);mounted.push(new ElementFixture(response));completed=true;if(options.connectionHold)await options.connectionHold;},async waitForReplay(){order.push('host-wait');if(options.hostWaitHold)await options.hostWaitHold;},readProgress(){return options.productProgress??{activeMessage:null,delivery:'complete',outcome:'success',loading:false,error:null};},readTranscript(){order.push('full-runtime');return {transcript:messages,activeMessageId:null,delivery:completed?'complete':'idle',outcome:completed?'success':null,loading:false,error:null};},readCaptureCandidates(){order.push('candidates');if(completed&&options.geometryCase?.startsWith('mutation-'))mutated=true;const active=completed&&!options.omitActiveCandidate?mounted.at(-1)!:null;let selectedHost=active,selectedContent=active?.querySelector()??null;
     if(active&&['replacement-content','foreign-content','foreign-host'].includes(options.geometryCase??'')){const original=active.querySelector();if(options.geometryCase==='replacement-content'){original.parentElement=scroller;active.contentNode=new ElementFixture(response,true);active.contentNode.parentElement=active;selectedContent=active.querySelector();}else if(options.geometryCase==='foreign-content'){selectedContent=new ElementFixture(response,true);selectedContent.parentElement=scroller;}else{selectedHost=new ElementFixture(response);selectedHost.parentElement=scroller;selectedContent=selectedHost.querySelector();}structuralObservations.push({oldConnected:original.isConnected,oldText:original.textContent,currentText:selectedContent!.textContent,selectedHostMounted:mounted.includes(selectedHost!),hostContainsSelected:selectedHost!.contains(selectedContent!),oldStillCurrent:active.querySelector()===original});}
     return {status:'available',value:{historical:[],active:active?{id:response.id,role:'assistant',hostElement:selectedHost!,contentElement:selectedContent}:null}};},async dispose(){order.push('host-dispose');if(options.disposeRejection)throw options.disposeRejection.value;}};
 const transfer={sourceFinal:null,attempted:0,accepted:0,rejected:0,failureReason:null,remainingEntries:0,remainingSerializedBytes:0,complete:true};
 const scrollReads:{hostMs:number;pageMs:number}[]=[],wheelDispatches:number[]=[],rect={left:0,top:0,right:1280,bottom:800},geometry={status:'available' as const,value:{messageId:response.id,role:'assistant' as const,hostRect:rect,contentRects:[rect],viewportRect:rect,scrollerRect:rect,clippingAncestorRects:[],clippingAncestorAxes:[],effectiveClipRect:rect}};
 const capture={async readScrollFresh(request:{notBeforePageMs:number|null}){options.freshRequests?.push(request);if(options.freshUnavailablePost&&scrollReads.length===1)return {status:'unavailable',reason:'Controlled post unavailable'};if(!options.freshIgnoreMinimum&&request.notBeforePageMs!==null&&now()<request.notBeforePageMs)await new Promise<void>(resolve=>setTimeout(resolve,Math.ceil(request.notBeforePageMs!-now())));return this.readScroll();},readScroll(){const timestampMs=options.staleScroll?1:options.stalePostScroll&&scrollReads.length===1?scrollReads[0]!.pageMs:now();scrollReads.push({hostMs:Date.now(),pageMs:timestampMs});return {status:'available',value:{timestampMs,clockDomain:'page-performance-ms',scrollTop:0,scrollHeight:1000,clientHeight:800,anchorId:response.id,anchorTopCssPx:0,activeVisible:!options.unavailableScrollGeometry,followArmed:null,pinThresholdCssPx:150,geometry:options.unavailableScrollGeometry?unavailable:geometry,anchorGeometry:geometry}};},readInstrumentation(){order.push('instrumentation');return instrumentation;},stop(){order.push('stop');},readPreNavigationTransfer(){return transfer;},drain(){order.push('page-drain');if(completed&&options.boundary==='writer-append'&&!exceptionDrained){exceptionDrained=true;return [{cohort:'exception',serialized:JSON.stringify({source:'page',stage:'replay',clockDomain:'page-performance-ms',timestampMs:now(),message:'append-boundary',stack:null,severity:'error'})}];}return [];},setPhase(phase:string){order.push('phase:'+phase);},closePhase(){order.push('phase-close');},armHostGuard(){order.push('guard-arm');},readHostGuard(){if(options.guardPending)return {status:'pending'};return {status:'ready',value:{messageId:response.id,hostObservation:{clockDomain:'page-performance-ms',timestampMs:1,hostMounted:true,contentMounted:true},frames:[{ordinal:1,clockDomain:'page-performance-ms',timestampMs:2},{ordinal:2,clockDomain:'page-performance-ms',timestampMs:3}]}};},readPhases(){return {status:'complete',instances:[],openPhase:null};}};
 const listeners=new Map<string,(value:unknown)=>void>();
 const traceSession={on(event:string,listener:(value:unknown)=>void){listeners.set(event,listener);},off(event:string){listeners.delete(event);},async send(method:string){order.push(method);if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'root',url:'http://localhost:4010/'}}};if(method==='Target.getTargetInfo')return {targetInfo:{targetId:'root',type:'page',url:'http://localhost:4010/'}};if(method==='Tracing.end'){await gate('trace-completion');listeners.get('Tracing.tracingComplete')?.({stream:'stream',dataLossOccurred:false,traceFormat:'json',streamCompression:'none'});}if(method==='IO.read'){if(options.boundary==='trace-eof'&&traceReads++===0)return {data:'{"traceEvents":[',eof:false};await gate('trace-eof');if(options.boundary==='trace-eof')throw false;return {data:options.boundary==='trace-eof'?'{}]}':'{"traceEvents":[]}',eof:true};}return {};},detach(){order.push('trace-detach');const actual=(async()=>{listeners.get('close')?.(undefined);if(options.traceDetachHold)await options.traceDetachHold;if(options.traceDetachRejection)throw options.traceDetachRejection.value;})();void actual.catch(()=>{});options.observeDetach?.(actual);return actual;}} as unknown as CDPSession;
 const counter={async send(method:string){order.push(method);return method==='Runtime.getHeapUsage'?{usedSize:1}:{nodes:1,documents:1,jsEventListeners:1};},async detach(){order.push('counter-detach');}} as unknown as CDPSession;
 const locator={async boundingBox(value:unknown){options.observeLocatorOptions?.(value);order.push('wheel-prepare');await gate('native-preparation');if(options.preparationMs)await new Promise<void>(resolve=>setTimeout(resolve,options.preparationMs));return {x:0,y:0,width:1280,height:800};},async click(value:unknown){options.observeLocatorOptions?.(value);order.push('native-click');},async isVisible(){return !options.invisibleReturn;}};
 const page={async close(){pageClosed=true;order.push('page-close');if(options.pageCloseHold)await options.pageCloseHold;},async addInitScript(){order.push('pre-install');await gate('pre-install');},async goto(){order.push('navigation');await gate('navigation');if(options.navigationRoute)await request(options.navigationRoute);},async waitForFunction(){},locator(){return locator;},mouse:{async move(){},async wheel(){order.push('wheel');wheelDispatches.push(Date.now());if(wheelDispatches.length===1&&options.wheelHold)await options.wheelHold;}},keyboard:{async press(key:string){order.push('press:'+key);if(options.pressHold)await options.pressHold;},async up(){}},async evaluate(callback:unknown,arg:unknown){calls++;if(pageClosed)throw new Error('Page call after actual close');if(typeof callback==='string'){order.push('main-install');await gate('main-install');return;}if(String(callback).includes('.readScroll(')){await gate('checkpoint-before');if(scrollReads.length===1&&options.freshPostDelayMs&&!postDelayed){postDelayed=true;await new Promise<void>(resolve=>setTimeout(resolve,options.freshPostDelayMs));}}const result=await Function('arg',`return (${String(callback)})(arg)`)(arg);if(String(callback).includes('.readHostGuard('))await gate('guard');if(String(callback).includes('.readScroll('))await gate('checkpoint');if(String(callback).includes('.drain(')&&completed)await gate('page-drain');if(String(callback).includes('Actual host unavailable for full validation')&&arg&&typeof arg==='object'&&Reflect.get(arg,'responseId')!==null)await gate('coverage');if(String(callback).includes('performance.now()')&&options.counterEndpointHold){order.push('counter-endpoint');options.counterEndpointEntered?.();await options.counterEndpointHold;}if(String(callback).includes('capture.stop(')&&options.stopHold)await options.stopHold;return result;}} as unknown as Page;
 let sessions=0,routeHandler:((route:import('playwright').Route)=>Promise<void>)|undefined;
 const request=async(url:string,completion:Promise<void>=Promise.resolve())=>{if(!routeHandler)throw new Error('Route handler not actually registered');await routeHandler({request(){return {url(){return url;}};},continue(){order.push('route-continue');return completion;},async abort(){order.push('route-abort');if(options.routeAbortHold)await options.routeAbortHold;if(options.routeAbortRejection)throw options.routeAbortRejection.value;}} as unknown as import('playwright').Route);};
 const browserContext={async close(){order.push('context-close');},async newPage(){if(options.pageAcquireHold){order.push('page-acquire');await options.pageAcquireHold;}return page;},async newCDPSession(){if(sessions++===0)return counter;order.push('trace-acquire');if(options.traceAcquireHold)await options.traceAcquireHold;return traceSession;},async route(_pattern:string,handler:(route:import('playwright').Route)=>Promise<void>){routeHandler=handler;order.push('route-register');if(options.routeRegistrationHold)await options.routeRegistrationHold;return {async dispose(){order.push('route-dispose');if(options.routeDisposalHold)await options.routeDisposalHold;if(options.routeDisposalRejection)throw options.routeDisposalRejection.value;}};},async unrouteAll(){order.push('unroute');if(options.routeRemovalHold)await options.routeRemovalHold;if(options.routeRemovalRejection)throw options.routeRemovalRejection.value;}} as unknown as BrowserContext;
 const browser={async close(){order.push('browser-close');},async newContext(){return browserContext;},async newBrowserCDPSession(){return counter;}} as unknown as Browser;
 const facts={git:{revision:'fixture',dirty:false},assets:adapter.build.assetHashes,browser:{executable:'/fixture',version:'fixture',revision:'fixture',flags:[]},environment:{os:'fixture',architecture:'fixture',cpu:unavailable,gpu:unavailable},browserProtocol:{protocolVersion:'fixture',product:'fixture',revision:'fixture',userAgent:'fixture',jsVersion:'fixture'},chromiumDownloadRevision:'fixture',playwrightVersion:'fixture'};
 let lateOriginApplied=false;const driverTimers=new Map<ReturnType<typeof setTimeout>,number>();
 const driverClock={now:Date.now,setTimer(callback:()=>void,delay:number){if(options.lateOriginLookupMs&&!lateOriginApplied&&delay===50&&String(callback).includes('.timers.delete')&&order.includes('phase:history-reading')&&wheelDispatches.length===0){lateOriginApplied=true;order.push('late-origin-lookup');delay=options.lateOriginLookupMs;}let timer:ReturnType<typeof setTimeout>;const fire=()=>{if(!driverTimers.has(timer))return;driverTimers.delete(timer);callback();};timer=setTimeout(fire,delay);driverTimers.set(timer,delay);return timer;},clearTimer(timer:ReturnType<typeof setTimeout>){driverTimers.delete(timer);clearTimeout(timer);}};
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{clock:driverClock,createTrace(traceOptions){order.push('trace-factory');if(options.traceFactoryRejection)throw options.traceFactoryRejection.value;return createComparisonTraceCapture(traceOptions);},async acquireInstrumentation(_session,pre,main){return assembleComparisonInstaller(pre,main,options.comparisonVersion);},async resolveProfile(){return adapter;},async launch(){return browser;},async collectEnvironment(){return {facts,async recheckBeforeServing(){return facts;}};},async recheckServing(){return {originalRoot:directory,build:adapter.build,probe:build,assets:adapter.build.assetHashes};},async recheckProfile(){return adapter;},async serveAssets(){return {url:'http://localhost:4010/',async close(){order.push('assets-close');}};},async createReplayServer(){return {url:'http://localhost:4011/replay',get state(){producerStateReads.push(Date.now());return options.producerState??(completed&&producerReady?'complete':'waiting');},drain(){order.push('producer-drain');return [];},async close(){order.push('producer-close');}} as unknown as Awaited<ReturnType<NonNullable<import('./long-thread-capture.js').LongThreadCaptureDependencies['createReplayServer']>>>;}});
 const context=(ownership:import('./comparison-ownership.js').ComparisonOwnershipContext)=>({comparisonVersion:options.comparisonVersion,comparisonSchemas:schemas,identity,descriptor:{...identity,seed:1,mode:'headless' as const,artifactDirectory:slot.artifactDirectory},fixture,ownership,writer:writer.scoped(()=>ownership.assertActive())});
 vi.stubGlobal('window',{benchHost:host,comparisonCapture:capture});vi.stubGlobal('document',{querySelector(){return scroller;},querySelectorAll(){return mounted;},createTreeWalker(element:ElementFixture){let read=false;return {nextNode(){if(read)return null;read=true;return {textContent:element.textContent,parentElement:element};}};},createRange(){let node:{parentElement:ElementFixture}|undefined;return {selectNodeContents(value:typeof node){node=value;},getClientRects(){return [node!.parentElement.getBoundingClientRect()];},detach(){}};}});vi.stubGlobal('HTMLElement',ElementFixture);vi.stubGlobal('NodeFilter',{SHOW_TEXT:4});vi.stubGlobal('innerWidth',1280);vi.stubGlobal('innerHeight',800);vi.stubGlobal('getComputedStyle',(element:ElementFixture)=>({transform:options.unknownResponseGeometry&&element.message?.id===response.id?'matrix(1,0,0,1,0,0)':'none',perspective:'none',clipPath:'none',filter:'none',contain:'none',display:'block',visibility:'visible',overflowX:options.geometryCase==='clip-x'&&element.content?'hidden':'visible',overflowY:options.geometryCase==='clip-y'&&element.content?'hidden':'visible'}));vi.stubGlobal('performance',{now});
 await body({driver,owner,writer,directory,context,order,pageCalls:()=>calls,scrollReads,wheelDispatches,pendingDriverTimers:()=>[...driverTimers.values()],request,producerStateReads,structuralObservations});
 }catch(error){bodyFailed=true;bodyError=error;}
 const closing:Promise<unknown>[]=[];
 if(acquiredOwner){try{closing.push(firstDisposal??acquiredOwner.dispose());}catch(error){cleanupErrors.push(error);}try{closing.push(acquiredOwner.ownershipSettled);}catch(error){cleanupErrors.push(error);}}
 for(const result of await Promise.allSettled(closing))if(result.status==='rejected')cleanupErrors.push(result.reason);
 // These dependent restorations follow original operation settlement, even if disposal failed.
 try{vi.unstubAllGlobals();}catch(error){cleanupErrors.push(error);}
 if(acquiredDirectory)try{await rm(acquiredDirectory,{recursive:true,force:true});}catch(error){cleanupErrors.push(error);}
 if(bodyFailed)throw bodyError;if(cleanupErrors.length===1)throw cleanupErrors[0];if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Lifecycle fixture cleanup failed');
}
for(const [label,value] of [['undefined',undefined],['null',null],['false',false],['zero',0],['empty','']] as const)test(`lifecycle cleanup preserves ${label} body failure while first native disposal is pending`,async()=>{
 const hold=deferred<void>(),originalWindow=Reflect.get(globalThis,'window');let first:ReturnType<ComparisonOwnership['dispose']>|undefined,owned:ComparisonOwnership|undefined,directory:string|undefined,firstSettled=false,pendingAtRetry=false,bodyExitPending=false,settledAtEscape=false,unsafeAtEscape=true,globalsRestoredAtEscape=false,directoryAbsentAtEscape=false,failed=false,error:unknown,attempts=0,closeCalls=0;
 try{
   try{await lifecycleFixture(async({owner,context,directory:actualDirectory})=>{
     owned=owner;directory=actualDirectory;const nativeDispose=owner.dispose.bind(owner);
     owner.dispose=()=>{attempts++;if(first&&!firstSettled)pendingAtRetry=true;const actual=nativeDispose();void actual.catch(()=>{});return actual;};
     let callbackFailed=false,callbackError:unknown;
     const setup=await owner.run('setup',async ownership=>{try{context(ownership);await ownership.adopt({name:'fixture-pending-disposal',async close(){closeCalls++;await hold.promise;}});}catch(caught){callbackFailed=true;callbackError=caught;throw caught;}});
     if(callbackFailed)throw callbackError;expect(setup.status).toBe('complete');
     first=owner.dispose();void first.then(()=>{firstSettled=true;},()=>{firstSettled=true;});
     try{bodyExitPending=!firstSettled&&owner.unsafeOutstanding;throw value;}
     finally{actualImmediate(()=>hold.resolve());}
   });}catch(caught){failed=true;error=caught;settledAtEscape=firstSettled;unsafeAtEscape=owned?.unsafeOutstanding??true;globalsRestoredAtEscape=Reflect.get(globalThis,'window')===originalWindow;if(directory)try{await stat(directory);}catch(checkError){if(checkError&&typeof checkError==='object'&&Reflect.get(checkError,'code')==='ENOENT')directoryAbsentAtEscape=true;else throw checkError;}}
 }finally{hold.resolve();if(first)await first;if(owned)await owned.ownershipSettled;vi.unstubAllGlobals();if(directory)await rm(directory,{recursive:true,force:true});}
 expect(bodyExitPending).toBe(true);expect(firstSettled).toBe(true);expect(closeCalls).toBe(1);if(attempts>1)expect(pendingAtRetry).toBe(true);expect(failed).toBe(true);expect(error).toBe(value);expect(settledAtEscape).toBe(true);expect(unsafeAtEscape).toBe(false);expect(globalsRestoredAtEscape).toBe(true);expect(directoryAbsentAtEscape).toBe(true);expect(attempts).toBe(1);expect(pendingAtRetry).toBe(false);
});
test('lifecycle cleanup retains exact native Promise and explicit second body disposal still rejects',async()=>{
 let first:ReturnType<ComparisonOwnership['dispose']>|undefined,second:ReturnType<ComparisonOwnership['dispose']>|undefined,failed=false,error:unknown,attempts=0;
 await lifecycleFixture(async({owner})=>{
   const nativeDispose=owner.dispose.bind(owner);owner.dispose=()=>{attempts++;const actual=nativeDispose();void actual.catch(()=>{});if(!first)first=actual;else second=actual;return actual;};
   const returned=owner.dispose();expect(returned).toBe(first);await returned;
   const repeated=owner.dispose();expect(repeated).toBe(second);expect(repeated).not.toBe(first);
   try{await repeated;}catch(caught){failed=true;error=caught;}
 });
 expect(attempts).toBe(2);expect(failed).toBe(true);expect(error).toBeInstanceOf(Error);expect(String(error)).toContain('Disposal cannot be retried');
});
for(const boundary of ['native-journal-trace','counter-endpoint','pre-F-transfer'] as const)test(`route failure freezes ${boundary} while original ownership remains active`,async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const hold=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,pageCalls,request})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const call=(ownership:import('./comparison-ownership.js').ComparisonOwnershipContext)=>driver.setup(context(ownership));
   let stage:ReturnType<ComparisonOwnership['run']>,original:import('./comparison-ownership.js').ComparisonOwnershipContext|undefined;
   if(boundary!=='counter-endpoint'){const setup=await owner.run('setup',async ownership=>{try{state=await call(ownership);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');}
   stage=owner.run(boundary==='counter-endpoint'?'setup':'replay',async ownership=>{original=ownership;try{return boundary==='counter-endpoint'?await call(ownership):await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});void stage.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     const marker=boundary==='counter-endpoint'?'counter-endpoint':boundary==='pre-F-transfer'?'trace-acquire':'press:c';
     for(let index=0;index<1000&&!order.includes(marker)&&!failed;index++){await vi.advanceTimersByTimeAsync(1);await new Promise<void>(resolve=>actualTimer(resolve,1));}if(failed)throw error;expect(order).toContain(marker);original!.assertActive();
     await request('https://unexpected.example/active');await new Promise<void>(resolve=>actualImmediate(resolve));original!.assertActive();
     const calls=pageCalls(),commands=order.filter(value=>value.startsWith('press:')||value==='page-drain'||value==='producer-drain'||value==='Runtime.getHeapUsage'||value==='Memory.getDOMCounters'||value==='Tracing.start').length;
     expect(order).toContain('context-close');expect(order).toContain('browser-close');
     await vi.advanceTimersByTimeAsync(400);expect(pageCalls()).toBe(calls);expect(order.filter(value=>value.startsWith('press:')||value==='page-drain'||value==='producer-drain'||value==='Runtime.getHeapUsage'||value==='Memory.getDOMCounters'||value==='Tracing.start')).toHaveLength(commands);
     hold.resolve();for(let index=0;index<100;index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order.filter(value=>value==='Tracing.start')).toHaveLength(boundary==='native-journal-trace'?1:0);expect(order.filter(value=>value==='Runtime.getHeapUsage')).toHaveLength(boundary==='counter-endpoint'?0:2);expect(pageCalls()).toBe(calls);expect(failed).toBe(true);
     expect(order.filter(value=>value==='trace-detach')).toHaveLength(boundary==='counter-endpoint'?0:1);if(boundary==='pre-F-transfer')expect(order).not.toContain('trace-factory');
   }finally{disposal=owner.dispose();void disposal.catch(()=>{});hold.resolve();await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([stage,disposal]);await owner.ownershipSettled;}
   expect((await stage).status).toBe('failed');expect(failed).toBe(true);expect(error).toBeDefined();expect(owner.unsafeOutstanding).toBe(false);
 },boundary==='counter-endpoint'?{counterEndpointHold:hold.promise}:boundary==='pre-F-transfer'?{traceAcquireHold:hold.promise}:{pressHold:hold.promise});}finally{hold.resolve();vi.useRealTimers();}
});
test('pre-F first detach retains its actual falsy rejection without retry or trace ownership transfer',async()=>{
 const attempts:Promise<void>[]=[];await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});expect(replay.status).toBe('failed');expect(failed).toBe(true);expect(error).toBe(undefined);expect(attempts).toHaveLength(1);await expect(attempts[0]).rejects.toBe(false);
   const disposal=await owner.dispose();await owner.ownershipSettled;expect(disposal.status).toBe('failed');expect(attempts).toHaveLength(1);expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(order).not.toContain('Tracing.start');
 },{traceFactoryRejection:{value:undefined},traceDetachRejection:{value:false},observeDetach:task=>attempts.push(task)});
});
test('late actual route Disposable begins its first held disposal and stays owned after independent closes',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const registration=deferred<void>(),removal=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   const setup=owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});void setup.catch(()=>{});
   try{
     for(let index=0;index<1000&&!order.includes('route-register')&&!failed;index++)await new Promise<void>(resolve=>actualTimer(resolve,1));if(failed)throw error;expect(order).toContain('route-register');
     await vi.advanceTimersByTimeAsync(60000);expect((await setup).status).toBe('expired');disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(0);expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(order).toContain('unroute');
     registration.resolve();for(let index=0;index<1000&&!order.includes('route-dispose');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);
     await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);removal.resolve();await owner.ownershipSettled;expect(failed).toBe(true);expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);expect(order).not.toContain('pre-install');
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});registration.resolve();removal.resolve();await Promise.allSettled([setup,disposal]);await owner.ownershipSettled;}
 },{routeRegistrationHold:registration.promise,routeDisposalHold:removal.promise});}finally{registration.resolve();removal.resolve();vi.useRealTimers();}
});
for(const rejection of ['removal','disposal'] as const)test(`route ${rejection} first rejection cannot discard a genuinely held admitted continue`,async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const connection=deferred<void>(),continuation=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,request})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});void replay.catch(()=>{});let admitted:Promise<void>|undefined;
   try{
     for(let index=0;index<1000&&!order.includes('connect');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order).toContain('connect');admitted=request('http://localhost:4010/pending',continuation.promise);void admitted.catch(()=>{});await request('https://unexpected.example/rejected');const failureAt=Date.now();await new Promise<void>(resolve=>actualImmediate(resolve));expect(Date.now()).toBe(failureAt);expect(order).toContain('context-close');expect(order).toContain('browser-close');
     connection.resolve();expect((await replay).status).toBe('failed');expect(failed).toBe(true);disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);
     continuation.resolve();await admitted;await owner.ownershipSettled;expect(owner.unsafeOutstanding).toBe(false);expect(order.filter(value=>value==='unroute')).toHaveLength(1);expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);expect(owner.failures.some(row=>row.message==='false')).toBe(true);
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});connection.resolve();continuation.resolve();await Promise.allSettled([replay,disposal,admitted]);await owner.ownershipSettled;}
 },{connectionHold:connection.promise,...(rejection==='removal'?{routeRemovalRejection:{value:false}}:{routeDisposalRejection:{value:false}})});}finally{connection.resolve();continuation.resolve();vi.useRealTimers();}
});
test('an admitted continue settled after original setup revocation cannot borrow the replay authority',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const endpoint=deferred<void>(),continuation=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,request})=>{
   let failed=false,error:unknown,admitted:Promise<void>|undefined,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined,replayAdmissions=0;
   const setup=owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});void setup.catch(()=>{});
   try{
     for(let index=0;index<1000&&!order.includes('counter-endpoint')&&!failed;index++)await new Promise<void>(resolve=>actualTimer(resolve,1));if(failed)throw error;expect(order).toContain('counter-endpoint');
     admitted=request('http://localhost:4010/original',continuation.promise);void admitted.catch(()=>{});expect(order.filter(value=>value==='route-continue')).toHaveLength(1);
     await vi.advanceTimersByTimeAsync(60000);expect((await setup).status).toBe('expired');await expect(owner.run('replay',async()=>{replayAdmissions++;})).rejects.toThrow('unsettled');expect(replayAdmissions).toBe(0);
     continuation.resolve();await admitted;const failureAt=Date.now();await new Promise<void>(resolve=>actualImmediate(resolve));expect(Date.now()).toBe(failureAt);expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(order).not.toContain('connect');
     disposal=owner.dispose();void disposal.catch(()=>{});endpoint.resolve();await disposal;await owner.ownershipSettled;expect(failed).toBe(true);expect(String(error)).toContain('Counter capture closed');expect(owner.failures.some(row=>row.message.includes('revoked'))).toBe(true);
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});continuation.resolve();endpoint.resolve();await Promise.allSettled([setup,disposal,admitted]);await owner.ownershipSettled;}
 },{counterEndpointHold:endpoint.promise});}finally{endpoint.resolve();continuation.resolve();vi.useRealTimers();}
});
for(const boundary of ['pre-install','navigation','main-install','hydrate','guard','native-preparation','checkpoint','page-drain','writer-append','trace-completion','trace-eof','coverage'] as const)test(`G orchestration expiry retains actual partial facts at ${boundary}`,async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const hold=deferred<void>();let appendArmed=false,appendStarted=false;
 const partial='partial-page-tail';const io:ComparisonFileOperations={async open(...args){const handle=await open(...args);if(boundary!=='writer-append'||!appendArmed||!String(args[0]).endsWith('page-exceptions.jsonl'))return handle;return new Proxy(handle,{get(target,key){if(key==='writeFile')return async()=>{if(appendStarted)throw new Error('Append unexpectedly retried');appendStarted=true;await target.write(Buffer.from(partial));await hold.promise;throw false;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}};
 const stageName=['pre-install','navigation','main-install','hydrate'].includes(boundary)?'setup':'replay';
 try{await lifecycleFixture(async({driver,owner,context,order,pageCalls,writer,directory,wheelDispatches})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,slotIdentity:import('./long-thread-run.js').ComparisonSlotContext['identity']|undefined,finalized=false;
   if(stageName==='replay'){const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');appendArmed=true;}
   const stage=owner.run(stageName,async ownership=>{try{const actual=context(ownership);slotIdentity=actual.identity;if(stageName==='setup')state=await driver.setup(actual);else capture=await driver.replay(actual,state!);}catch(value){failed=true;error=value;throw value;}});void stage.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     for(let index=0;index<1500&&!order.includes('held:'+boundary)&&!appendStarted&&!failed;index++){await vi.advanceTimersByTimeAsync(1);await new Promise<void>(resolve=>actualTimer(resolve,1));}if(failed)throw error;expect(boundary==='writer-append'?appendStarted:order.includes('held:'+boundary)).toBe(true);
     const ownedBudget=stageName==='setup'?60000:30000;await vi.advanceTimersByTimeAsync(Math.max(0,ownedBudget-Date.now()));expect((await stage).status).toBe('expired');if(boundary==='native-preparation')expect(wheelDispatches).toEqual([]);disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(0);
     expect(order).toContain('browser-close');expect(order).toContain('context-close');expect(order).toContain('page-close');expect(order).toContain('assets-close');expect(order).toContain('producer-close');const calls=pageCalls();
     await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);expect(capture).toBe(undefined);expect(finalized).toBe(false);await expect(owner.run('replay',async()=>{throw new Error('Forbidden later stage');})).rejects.toThrow();
     hold.resolve();await owner.ownershipSettled;expect(owner.unsafeOutstanding).toBe(false);expect(failed).toBe(true);expect(pageCalls()).toBe(calls);expect(capture).toBe(undefined);
     const final=await driver.finalize!({identity:slotIdentity!,deadlines:owner.deadlines,writer:writer.scoped(()=>{})},null);finalized=true;expect(final?.captureStatus.status).toBe('partial');expect(final?.captureStatus.reasons).toContain('Capture did not complete');expect(pageCalls()).toBe(calls);
     expect(final?.captureStatus.finalPageInstrumentation.status).toBe(['coverage','trace-completion','trace-eof'].includes(boundary)?'available':'unavailable');if(boundary==='trace-completion'||boundary==='trace-eof')expect(final?.captureStatus.traceEof.status).toBe('unavailable');
     if(boundary==='trace-eof')expect(await readFile(join(directory,'trace.json'),'utf8')).toBe('{"traceEvents":[');if(boundary==='writer-append'){expect(await readFile(join(directory,'page-exceptions.jsonl'),'utf8')).toBe(partial);expect(appendStarted).toBe(true);expect((await writer.reconcilePayloadCandidates()).present).toContainEqual({path:'page-exceptions.jsonl',status:'partial',reason:'Artifact operation failed'});}
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});hold.resolve();await Promise.allSettled([stage,disposal]);await owner.ownershipSettled;}
 },{boundary,boundaryHold:hold.promise,history:boundary==='native-preparation'||boundary==='checkpoint',io});}finally{hold.resolve();vi.useRealTimers();}
});
test('G filesystem finalizer retains its first write rejection and releases its local registry without retry',async()=>{
 let armed=false,writes=0;const io:ComparisonFileOperations={async open(...args){const handle=await open(...args);if(!armed||!String(args[0]).includes('acquisition.json'))return handle;return new Proxy(handle,{get(target,key){if(key==='writeFile')return async()=>{writes++;throw false;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}};
 await lifecycleFixture(async({driver,owner,context,writer})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined,failed=false,error:unknown;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');await owner.dispose();await owner.ownershipSettled;armed=true;
   await expect(driver.finalize!({identity:state!.identity,deadlines:owner.deadlines,writer:writer.scoped(()=>{})},null)).rejects.toBe(false);expect(writes).toBe(1);
   const nextOwner=new ComparisonOwnership();let nextFailed=false,nextError:unknown;try{const result=await nextOwner.run('setup',async ownership=>{try{await driver.setup({...context(ownership),writer:writer.scoped(()=>ownership.assertActive())});}catch(value){nextFailed=true;nextError=value;throw value;}});expect(result.status).toBe('failed');expect(nextFailed).toBe(true);expect(String(nextError)).not.toContain('earlier slot');expect(writes).toBe(1);}finally{await nextOwner.dispose();await nextOwner.ownershipSettled;}
 },{io});
});
test('full follow replay uses real F protocol/native operations and stops after final collection before page closure',async()=>{
 await lifecycleFixture(async({driver,owner,context,order,pageCalls,writer})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   let capture:Awaited<ReturnType<typeof driver.replay>>|undefined,finished=false;
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});
   for(let iteration=0;iteration<1000&&!finished;iteration++)await new Promise<void>(resolve=>actualTimer(resolve,1));
   if(!finished)throw new Error('Replay still pending after bounded fixture pump: '+order.join(','));
   const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status,JSON.stringify(capture?.validation.reasons)).toBe('valid');
   expect(order.indexOf('Tracing.start')).toBeLessThan(order.indexOf('phase:streaming-follow'));expect(order.indexOf('guard-arm')).toBeLessThan(order.indexOf('connect'));
   expect(order.indexOf('phase-close')).toBeLessThan(order.indexOf('stop'));expect(order.indexOf('stop')).toBeLessThan(order.lastIndexOf('instrumentation'));expect(order.lastIndexOf('Runtime.getHeapUsage')).toBeLessThan(order.indexOf('Tracing.end'));expect(order.indexOf('IO.close')).toBeLessThan(order.lastIndexOf('full-runtime'));expect(order.lastIndexOf('candidates')).toBeLessThan(order.indexOf('host-dispose'));
   expect(order.filter(value=>value.startsWith('press:'))).toEqual([...'calibrate'].map(key=>'press:'+key));expect(order.filter(value=>value==='stop')).toHaveLength(1);expect(order.filter(value=>value==='host-dispose')).toHaveLength(1);expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);
   await owner.dispose();await owner.ownershipSettled;const before=pageCalls();const final=await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},capture!);expect(pageCalls()).toBe(before);expect(final?.captureStatus.finalPageInstrumentation.status).toBe('available');expect(order.filter(value=>value==='stop')).toHaveLength(1);expect(order.filter(value=>value==='host-dispose')).toHaveLength(1);
   expect(final?.captureStatus.status).toBe('partial');expect(final?.captureStatus.reasons).toContain('Original provenance acquisition incomplete');expect(final?.captureStatus.reasons).not.toContain('Offline analysis not performed');expect(final?.evidence?.reason).toContain('Original provenance acquisition incomplete');
 });
});
for(const scenario of [
 {name:'unknown independent geometry alone is a failed measurement',options:{unknownResponseGeometry:true},status:'failed',reason:'Unsupported actual content geometry'},
 {name:'visible unselected prose remains invalid with other unknown geometry',options:{unknownResponseGeometry:true,visibleUnselectedHistory:true},status:'invalid',reason:'Visible prose omitted from actual bounded candidate selection'},
 {name:'actual visible response omitted from bounded candidates is invalid',options:{omitActiveCandidate:true},status:'invalid',reason:'Visible prose omitted from actual bounded candidate selection'},
 {name:'actual mounted response prose contradiction is invalid',options:{wrongResponseProse:true},status:'invalid',reason:'Actual mounted content/runtime identity or prose differs'},
] as const)test(scenario.name,async()=>{
 await lifecycleFixture(async({driver,owner,context})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(capture?.validation.status).toBe(scenario.status);expect(capture?.validation.reasons).toContain(scenario.reason);
 },scenario.options);
});
test('a rejected route Disposable still owns only its genuinely held admitted continue',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const endpoint=deferred<void>(),continuation=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,request})=>{
  let failed=false,error:unknown,settled=false;
  const setup=owner.run('setup',async ownership=>{try{return await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});void setup.catch(()=>{});let ownership:Promise<void>|undefined;let admitted:Promise<void>|undefined,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
  try{
   for(let index=0;index<1000&&!order.includes('counter-endpoint');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order).toContain('counter-endpoint');expect(order).not.toContain('trace-factory');admitted=request('http://localhost:4010/held',continuation.promise);void admitted.catch(()=>{});await request('https://bad.invalid/');endpoint.resolve();expect((await setup).status).toBe('failed');expect(failed).toBe(true);expect(String(error)).toContain('Capture operation controller closed');disposal=owner.dispose();void disposal.catch(()=>{});ownership=owner.ownershipSettled.then(()=>{settled=true;});void ownership.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await disposal;expect(settled).toBe(false);expect(owner.unsafeOutstanding).toBe(true);
   continuation.resolve();await admitted;await ownership;expect(owner.failures.some(row=>row.message==='false')).toBe(true);
  }finally{disposal??=owner.dispose();void disposal.catch(()=>{});endpoint.resolve();continuation.resolve();await Promise.allSettled([setup,disposal,admitted]);await ownership;}
 },{counterEndpointHold:endpoint.promise,routeDisposalRejection:{value:false}});}finally{endpoint.resolve();continuation.resolve();vi.useRealTimers();}
});
test('native locator operations retain the actual remaining ownership timeout',async()=>{
 const observed:unknown[]=[];await lifecycleFixture(async({driver,owner,context})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{return await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(observed.length).toBeGreaterThanOrEqual(3);for(const value of observed)expect(value).toEqual({timeout:expect.any(Number)});
 },{history:true,observeLocatorOptions:value=>observed.push(value)});
});
for(const geometryCase of ['host-only','clip-x','clip-y','disconnected-content','disconnected-scroller','mutation-text','mutation-role','mutation-id'] as const)test(`independent synchronous geometry ${geometryCase}`,async()=>{
 await lifecycleFixture(async({driver,owner,context})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');
  expect(capture?.validation.status,JSON.stringify(capture?.validation.reasons)).toBe(['host-only','clip-x','clip-y'].includes(geometryCase)?'valid':'failed');expect(capture?.validation.checks.find(check=>check.name==='independent-candidate-content-geometry')?.passed).toBe(['host-only','clip-x','clip-y'].includes(geometryCase));
 },{geometryCase,omitActiveCandidate:['host-only','clip-x','clip-y'].includes(geometryCase)});
});
for(const structuralCase of ['replacement-content','foreign-content','foreign-host','replacement-content-with-visible-omission'] as const)test(`structural content identity ${structuralCase}`,async()=>{
 const geometryCase=structuralCase==='replacement-content-with-visible-omission'?'replacement-content':structuralCase;
 await lifecycleFixture(async({driver,owner,context,structuralObservations})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(structuralObservations).toHaveLength(1);const observed=structuralObservations[0]!;expect(observed.oldConnected).toBe(true);expect(observed.oldText).toBe(observed.currentText);expect(observed.selectedHostMounted).toBe(geometryCase!=='foreign-host');expect(observed.hostContainsSelected).toBe(geometryCase!=='foreign-content');expect(observed.oldStillCurrent).toBe(geometryCase!=='replacement-content');
  expect(capture?.validation.status,JSON.stringify(capture?.validation.reasons)).toBe(structuralCase==='replacement-content-with-visible-omission'?'invalid':'failed');expect(capture?.validation.checks.find(check=>check.name==='independent-candidate-content-geometry')?.passed).toBe(false);if(structuralCase==='replacement-content-with-visible-omission')expect(capture?.validation.reasons).toContain('Visible prose omitted from actual bounded candidate selection');
 },{geometryCase,visibleUnselectedHistory:structuralCase==='replacement-content-with-visible-omission'});
});
for(const terminal of ['producer-failed','producer-disposed','product-aborted','product-loading'] as const)test(`actual terminal gate rejects ${terminal}`,async()=>{
 await lifecycleFixture(async({driver,owner,context,order})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{return await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});expect(replay.status).toBe('failed');expect(failed).toBe(true);expect(String(error)).toContain(terminal==='producer-failed'?'Actual producer failed':terminal==='producer-disposed'?'Producer disposed':'Actual product delivery did not complete successfully');expect(order).not.toContain('phase-close');
 },terminal.startsWith('producer-')?{producerState:terminal==='producer-failed'?'failed':'disposed'}:{productProgress:{activeMessage:null,delivery:'complete',outcome:terminal==='product-aborted'?'aborted':'success',loading:terminal==='product-loading',error:null}});
});
for(const missing of [true,false])test(`history return admission preserves no dispatch for ${missing?'missing':'invisible'} actual control`,async()=>{
 await lifecycleFixture(async({driver,owner,context,writer,directory})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(capture?.validation.status).toBe('failed');await owner.dispose();await owner.ownershipSettled;await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},capture!);const native=JSON.parse(await readFile(join(directory,'checkpoints.json'),'utf8'));expect(native.hostDispatches.some((row:{kind:string})=>row.kind==='return-control')).toBe(false);
 },{history:true,missingReturn:missing,invisibleReturn:!missing});
});
test('producer state-only polling is independent of a held page connect and successful host wait still needs actual producer completion',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const producer=deferred<void>(),connection=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,producerStateReads})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,finished=false;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     for(let index=0;index<1000&&!order.includes('connect');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('connect');await vi.advanceTimersByTimeAsync(250);expect(producerStateReads).toEqual([0,50,100,150,200,250]);expect(order).not.toContain('host-wait');expect(finished).toBe(false);
     connection.resolve();await vi.advanceTimersByTimeAsync(400);expect(order).toContain('host-wait');expect(order).not.toContain('phase-close');expect(finished).toBe(false);expect(producerStateReads.at(-1)).toBe(650);
     producer.resolve();for(let index=0;index<200&&!finished;index++){await vi.advanceTimersByTimeAsync(50);await new Promise<void>(resolve=>actualTimer(resolve,1));}expect(finished,order.join(',')).toBe(true);const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status).toBe('valid');expect(order).toContain('phase-close');
   }finally{producer.resolve();connection.resolve();if(!finished){disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);}else await replay;}
 },{producerCompletionHold:producer.promise,connectionHold:connection.promise});}finally{producer.resolve();connection.resolve();vi.useRealTimers();}
});
test('history window starts at genuine dispatch after 900ms preparation and samples independently of held wheel acknowledgment',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const held=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,scrollReads,wheelDispatches,writer,directory})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,finished=false;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});
   try{
     for(let index=0;index<1000&&!order.includes('wheel-prepare');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('wheel-prepare');expect(Date.now()).toBe(0);expect(scrollReads).toHaveLength(1);
     await vi.advanceTimersByTimeAsync(901);expect(wheelDispatches).toEqual([901]);await vi.advanceTimersByTimeAsync(199);expect(scrollReads.map(read=>read.hostMs)).toEqual([0,1100]);
     await vi.advanceTimersByTimeAsync(800);expect(scrollReads.map(read=>read.hostMs)).toEqual([0,1100,1900]);expect(wheelDispatches).toEqual([901,950,1000,1050]);expect(finished).toBe(false);expect(order).not.toContain('phase:return-to-response');
     held.resolve();for(let index=0;index<200&&!finished;index++){await vi.advanceTimersByTimeAsync(50);await new Promise<void>(resolve=>actualTimer(resolve,1));}
     expect(finished,order.join(',')).toBe(true);const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status,JSON.stringify(capture?.validation.reasons)).toBe('valid');expect(order).toContain('phase:return-to-response');
   }finally{held.resolve();if(!finished){const disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);}else await replay;}
   await owner.dispose();await owner.ownershipSettled;await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},capture!);
   const dispatches=JSON.parse(await readFile(join(directory,'native-dispatch-results.json'),'utf8')).hostDispatches;expect(dispatches[0]).toMatchObject({hostMonotonicMs:901,actualOffsetMs:1});expect(dispatches[0].hostMonotonicMs-dispatches[0].actualOffsetMs).toBe(900);
 },{history:true,preparationMs:900,wheelHold:held.promise});}finally{held.resolve();vi.useRealTimers();}
});
for(const boundary of ['late-origin','held-post','host-wait'] as const)test(`actual independent window and terminal boundary ${boundary}`,async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const hold=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,scrollReads,wheelDispatches,writer,directory})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined,finished=false;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}}).finally(()=>{finished=true;});void replay.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
  try{
   for(let index=0;index<1000&&!order.includes(boundary==='host-wait'?'host-wait':'wheel-prepare');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));
   if(boundary==='held-post'){await vi.advanceTimersByTimeAsync(200);expect(order).toContain('held:checkpoint-before');expect(scrollReads.map(row=>row.hostMs)).toEqual([0]);await vi.advanceTimersByTimeAsync(300);hold.resolve();await vi.advanceTimersByTimeAsync(0);expect(scrollReads.map(row=>row.hostMs)).toEqual([0,500]);await vi.advanceTimersByTimeAsync(500);}
   else await vi.advanceTimersByTimeAsync(1000);
   if(boundary==='late-origin'){expect(order).toContain('late-origin-lookup');expect(wheelDispatches).toEqual([0,50,100,150]);expect(scrollReads.slice(0,3).map(row=>row.hostMs)).toEqual([0,401,1000]);}
   if(boundary==='host-wait'){expect(order).not.toContain('phase-close');expect(finished).toBe(false);hold.resolve();}
   for(let index=0;index<200&&!finished;index++){await vi.advanceTimersByTimeAsync(50);await new Promise<void>(resolve=>actualTimer(resolve,1));}expect(finished,order.join(',')).toBe(true);expect((await replay).status).toBe('complete');if(failed)throw error;expect(capture?.validation.status).toBe(boundary==='host-wait'?'valid':'failed');
   if(boundary!=='host-wait'){expect(capture?.validation.reasons).toContain('Actual cached samples do not cover the required 800ms window');disposal=owner.dispose();void disposal.catch(()=>{});await disposal;await owner.ownershipSettled;await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},capture!);const checkpoints=JSON.parse(await readFile(join(directory,'checkpoints.json'),'utf8'));const first=checkpoints.hostDispatches.find((row:{kind:string;index:number})=>row.kind==='wheel'&&row.index===0);expect(first.hostMonotonicMs-first.actualOffsetMs).toBe(0);}
  }finally{disposal??=owner.dispose();void disposal.catch(()=>{});hold.resolve();await Promise.allSettled([replay,disposal]);await owner.ownershipSettled;}
 },boundary==='late-origin'?{history:true,lateOriginLookupMs:400}:boundary==='held-post'?{history:true,boundary:'checkpoint-before',boundaryNth:2,boundaryHold:hold.promise}:{hostWaitHold:hold.promise});}finally{hold.resolve();vi.useRealTimers();}
});
test('independent controller close cancels admitted G state timers before joining genuine body settlement',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);
 try{await lifecycleFixture(async({driver,owner,context,order,pendingDriverTimers})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,bodyFailed=false,bodyError:unknown;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){bodyFailed=true;bodyError=value;throw value;}});void replay.catch(()=>{});
   let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     for(let index=0;index<1000&&!order.includes('host-wait');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('host-wait');expect(pendingDriverTimers()).toContain(50);
     disposal=owner.dispose();void disposal.catch(()=>{});await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(Date.now()).toBe(0);expect(pendingDriverTimers()).toEqual([]);
   }finally{
     disposal??=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);await owner.ownershipSettled;
   }
   expect(bodyFailed).toBe(true);expect(bodyError).toBeInstanceOf(Error);expect((await replay).status).toBe('failed');expect(owner.unsafeOutstanding).toBe(false);
 },{guardPending:true});}finally{vi.useRealTimers();}
});
test('native parent cleanup waits for one acquired trace detach without waiting for unrelated closes',async()=>{
 const detach=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,pendingDriverTimers})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
   const setup=await owner.run('setup',async ownership=>{state=await driver.setup(context(ownership));});expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',ownership=>driver.replay(context(ownership),state!));expect(replay.status).toBe('complete');
     disposal=owner.dispose();void disposal.catch(()=>{});await new Promise<void>(resolve=>actualImmediate(resolve));
     expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(order).toContain('assets-close');expect(order).toContain('producer-close');expect(order).toContain('unroute');
     for(const parent of ['page-close','context-close','browser-close'])expect(order).not.toContain(parent);
     expect(pendingDriverTimers()).toEqual([1000]);
   }finally{detach.resolve();disposal??=owner.dispose();await Promise.allSettled([disposal,owner.ownershipSettled]);}
   for(const parent of ['page-close','context-close','browser-close'])expect(order.filter(value=>value===parent)).toHaveLength(1);
   expect(order.indexOf('page-close')).toBeLessThan(order.indexOf('context-close'));expect(order.indexOf('context-close')).toBeLessThan(order.indexOf('browser-close'));
   expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(pendingDriverTimers()).toEqual([]);
 },{traceDetachHold:detach.promise});}finally{detach.resolve();}
});
test('one shared native cleanup escape does not replace original disposal expiry or release held ownership',async()=>{
 const detach=deferred<void>();
 try{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);await lifecycleFixture(async({driver,owner,context,order,pendingDriverTimers})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined,settled=false,settlement:Promise<void>|undefined,replay:ReturnType<ComparisonOwnership['run']>|undefined,primaryFailed=false;
   try{
   expect((await owner.run('setup',async ownership=>{state=await driver.setup(context(ownership));})).status).toBe('complete');
   let replayFinished=false;replay=owner.run('replay',ownership=>driver.replay(context(ownership),state!));void replay.then(()=>{replayFinished=true;},()=>{replayFinished=true;});
   for(let index=0;index<200&&!replayFinished;index++){await vi.advanceTimersByTimeAsync(50);await new Promise<void>(resolve=>actualTimer(resolve,1));}
   expect(replayFinished).toBe(true);expect((await replay).status).toBe('complete');
   disposal=owner.dispose();void disposal.catch(()=>{});settlement=owner.ownershipSettled.then(()=>{settled=true;});void settlement.catch(()=>{});
     await vi.advanceTimersByTimeAsync(999);for(const parent of ['page-close','context-close','browser-close'])expect(order).not.toContain(parent);
     expect(pendingDriverTimers()).toEqual([1000]);await vi.advanceTimersByTimeAsync(1);
     for(const parent of ['page-close','context-close','browser-close'])expect(order.filter(value=>value===parent)).toHaveLength(1);
     expect(settled).toBe(false);expect(pendingDriverTimers()).toEqual([]);await vi.advanceTimersByTimeAsync(9000);
     expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);expect(settled).toBe(false);
   }catch(error){primaryFailed=true;throw error;}finally{detach.resolve();disposal??=owner.dispose();void disposal.catch(()=>{});const cleanup=await Promise.allSettled([vi.advanceTimersByTimeAsync(10000),disposal,replay,settlement??owner.ownershipSettled]);if(!primaryFailed)for(const result of cleanup)if(result.status==='rejected')throw result.reason;}
   expect((await disposal!).status).toBe('expired');expect(owner.deadlines.at(-1)?.outcome).toBe('expired');expect(owner.canContinue).toBe(false);expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(false);
 },{traceDetachHold:detach.promise});}finally{detach.resolve();vi.useRealTimers();}
});
test('native parent cleanup does not wait for a held stop RPC during disposal',async()=>{
 const hold=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order})=>{
   let state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   expect((await owner.run('setup',async ownership=>{state=await driver.setup(context(ownership));})).status).toBe('complete');
   const replay=owner.run('replay',ownership=>driver.replay(context(ownership),state!));void replay.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{for(let index=0;index<1000&&!order.includes('stop');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order).toContain('stop');
     disposal=owner.dispose();void disposal.catch(()=>{});await new Promise<void>(resolve=>actualImmediate(resolve));
     for(const parent of ['page-close','context-close','browser-close'])expect(order).toContain(parent);expect(order).toContain('assets-close');expect(order).toContain('producer-close');
   }finally{hold.resolve();disposal??=owner.dispose();await Promise.allSettled([replay,disposal,owner.ownershipSettled]);}
   expect(order.filter(value=>value==='stop')).toHaveLength(1);expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);
 },{stopHold:hold.promise});}finally{hold.resolve();}
});
test('normal held stop retains its first RPC and disposes the host only after subsequent final collection',async()=>{
 const hold=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});void replay.catch(()=>{});
   try{for(let index=0;index<1000&&!order.includes('stop');index++)await new Promise<void>(resolve=>actualTimer(resolve,1));expect(order).toContain('stop');expect(order).not.toContain('host-dispose');expect(order).not.toContain('Tracing.end');hold.resolve();const result=await replay;if(failed)throw error;expect(result.status).toBe('complete');expect(capture?.validation.status).toBe('valid');expect(order.lastIndexOf('candidates')).toBeLessThan(order.indexOf('host-dispose'));expect(order.filter(value=>value==='stop')).toHaveLength(1);}
   finally{hold.resolve();await replay;}
 },{stopHold:hold.promise});}finally{hold.resolve();}
});
for(const rejection of [undefined,null,false,0,''])test(`first actual host disposal rejection ${String(rejection)} remains failed and is not retried`,async()=>{
 await lifecycleFixture(async({driver,owner,context,order,writer})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   let replay:Awaited<ReturnType<ComparisonOwnership['run']>>|undefined,ownerRejected=false,ownerError:unknown;
   try{replay=await owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});}catch(value){ownerRejected=true;ownerError=value;}
   if(rejection===''){expect(ownerRejected,String(ownerError)).toBe(false);expect(replay).toMatchObject({status:'failed',deadline:{reason:'Thrown empty string'}});expect(owner.failures.some(failure=>failure.message==='Thrown empty string')).toBe(true);}
   else{expect(ownerRejected).toBe(false);expect(replay?.status).toBe('failed');}
   expect(failed).toBe(true);expect(error).toBe(rejection);
   const disposal=await owner.dispose();await owner.ownershipSettled;expect(disposal.status).toBe('failed');expect(order.filter(value=>value==='host-dispose')).toHaveLength(1);expect(order.filter(value=>value==='stop')).toHaveLength(1);
   const final=await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},null);expect(final?.captureStatus.status).toBe('partial');expect(final?.captureStatus.reasons).toContain('Capture did not complete');expect(final?.captureStatus.finalPageInstrumentation.status).toBe('available');expect(order.filter(value=>value==='host-dispose')).toHaveLength(1);
 },{disposeRejection:{value:rejection}});
});
test('trace factory throw before synchronous transfer detaches the actual untransferred session exactly once',async()=>{
 await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});expect(replay.status).toBe('failed');expect(failed).toBe(true);expect(error).toBe(false);expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(order).not.toContain('Tracing.start');
   await owner.dispose();await owner.ownershipSettled;expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(false);
 },{traceFactoryRejection:{value:false}});
});
test('persistent route controller rejects the actual setup/replay handoff gap by closing the owned context',async()=>{
 await lifecycleFixture(async({driver,owner,context,order,request})=>{
   let failed=false,error:unknown;
   const setup=await owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   await request('http://localhost:4010/main.js');await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).not.toContain('route-continue');expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(order.filter(value=>value==='unroute')).toHaveLength(1);expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);
   const disposal=await owner.dispose();await owner.ownershipSettled;expect(disposal.status).toBe('failed');expect(owner.failures.some(row=>row.message.includes('handoff gap'))).toBe(true);
 });
});
test('unexpected setup origin freezes G admissions before any following page RPC while original setup context remains active',async()=>{
 await lifecycleFixture(async({driver,owner,context,order,pageCalls})=>{
   let failed=false,error:unknown;
   const setup=await owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});expect(setup.status).toBe('failed');expect(failed).toBe(true);expect(String(error)).toContain('Capture operation controller closed');expect(pageCalls()).toBe(0);await new Promise<void>(resolve=>actualImmediate(resolve));expect(pageCalls()).toBe(0);expect(order).not.toContain('route-continue');expect(order).not.toContain('main-install');expect(order).toContain('context-close');expect(order).toContain('browser-close');
 },{navigationRoute:'https://unexpected.example/blocked'});
});
test('native rejected-route abort stays owned before removal while independent closes start',async()=>{
 const endpoint=deferred<void>(),abort=deferred<void>();
 try{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);await lifecycleFixture(async({driver,owner,context,order,request})=>{
   let bodyFailed=false,bodyError:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined,rejected:Promise<void>|undefined;
   const setup=owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(error){bodyFailed=true;bodyError=error;throw error;}});void setup.catch(()=>{});
   try{
     for(let index=0;index<1000&&!order.includes('counter-endpoint')&&!bodyFailed;index++)await new Promise<void>(resolve=>actualTimer(resolve,1));if(bodyFailed)throw bodyError;expect(order).toContain('counter-endpoint');
     rejected=request('https://unexpected.example/rejected');void rejected.catch(()=>{});await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='route-abort')).toHaveLength(1);expect(order).not.toContain('route-continue');expect(order).not.toContain('unroute');expect(order).not.toContain('route-dispose');expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(Date.now()).toBe(0);
     disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);expect(order).not.toContain('unroute');
     abort.resolve();await rejected;await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='unroute')).toHaveLength(1);expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(true);
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});abort.resolve();endpoint.resolve();await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([setup,disposal,rejected]);await owner.ownershipSettled;}
   expect(owner.unsafeOutstanding).toBe(false);expect(owner.failures.some(row=>row.message.includes('Unexpected request origin'))).toBe(true);
 },{counterEndpointHold:endpoint.promise,routeAbortHold:abort.promise});}finally{abort.resolve();endpoint.resolve();vi.useRealTimers();}
});
test('native route removal settles before registration disposal without holding independent closes',async()=>{
 const removal=deferred<void>();
 try{vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{const setup=await owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   disposal=owner.dispose();void disposal.catch(()=>{});await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='unroute')).toHaveLength(1);expect(order).not.toContain('route-dispose');expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(Date.now()).toBe(0);}
   finally{disposal??=owner.dispose();void disposal.catch(()=>{});removal.resolve();await Promise.allSettled([disposal]);await owner.ownershipSettled;}
   expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(false);
 },{routeRemovalHold:removal.promise});}finally{removal.resolve();vi.useRealTimers();}
});
for(const nativeFailure of ['abort','continue'] as const)test(`native route ${nativeFailure} rejection preserves false without duplicate terminal handling`,async()=>{
 const endpoint=deferred<void>(),counterEntered=deferred<void>(),writeEntered=deferred<void>(),writeRelease=deferred<void>();let writeHeld=false;
 const io:ComparisonFileOperations={async open(...args){const handle=await open(...args);if(!String(args[0]).includes('page-exceptions.jsonl')||writeHeld)return handle;return new Proxy(handle,{get(target,key){if(key==='writeFile')return async(...values:Parameters<typeof handle.writeFile>)=>{writeHeld=true;writeEntered.resolve();await writeRelease.promise;return target.writeFile(...values);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});}};
 try{await lifecycleFixture(async({driver,owner,context,order,request,writer})=>{
   let failed=false,error:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined,identity:import('./long-thread-run.js').ComparisonSlotContext['identity']|undefined;
   let original:import('./comparison-ownership.js').ComparisonOwnershipContext|undefined;const setup=owner.run('setup',async ownership=>{original=ownership;try{const actual=context(ownership);identity=actual.identity;await driver.setup(actual);}catch(value){failed=true;error=value;throw value;}});void setup.catch(()=>{});
   try{
     await Promise.race([writeEntered.promise,setup]);if(failed)throw error;expect(writeHeld).toBe(true);original!.assertActive();
     // Original immediate-turn count is a controlled delay witness, never a readiness bound.
     for(let index=0;index<1000;index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).not.toContain('counter-endpoint');expect(failed).toBe(false);original!.assertActive();
     writeRelease.resolve();await Promise.race([counterEntered.promise,setup]);if(failed)throw error;expect(order).toContain('counter-endpoint');original!.assertActive();
     await expect(request(nativeFailure==='abort'?'https://unexpected.example/rejected':'http://localhost:4010/rejected',nativeFailure==='continue'?Promise.reject(false):Promise.resolve())).rejects.toBe(false);
     expect(order.filter(value=>value==='route-abort')).toHaveLength(nativeFailure==='abort'?1:0);expect(order.filter(value=>value==='route-continue')).toHaveLength(nativeFailure==='continue'?1:0);await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('context-close');expect(order).toContain('browser-close');
   }finally{writeRelease.resolve();disposal??=owner.dispose();void disposal.catch(()=>{});endpoint.resolve();await Promise.allSettled([setup,disposal]);await owner.ownershipSettled;}
   expect(owner.failures.some(row=>row.message==='false')).toBe(true);if(nativeFailure==='abort'){const final=await driver.finalize!({identity:identity!,deadlines:owner.deadlines,writer:writer.scoped(()=>{})},null);expect(final?.captureStatus.reasons).toContain('Unexpected request origin or replay URL');expect(final?.captureStatus.reasons).toContain('false');}
 },{io,counterEndpointHold:endpoint.promise,counterEndpointEntered:()=>counterEntered.resolve(),...(nativeFailure==='abort'?{routeAbortRejection:{value:false}}:{})});}finally{writeRelease.resolve();endpoint.resolve();}
});
test('64 real pending route continues are retained and the 65th begins independent context closure before joining',async()=>{
 const connection=deferred<void>(),continuation=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,request})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,bodyFailed=false;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){bodyFailed=true;throw value;}});void replay.catch(()=>{});const operations:Promise<void>[]=[];let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     for(let index=0;index<1000&&!order.includes('connect');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('connect');
     for(let index=0;index<64;index++){const task=request('http://localhost:4010/'+index,continuation.promise);void task.catch(()=>{});operations.push(task);}expect(order.filter(value=>value==='route-continue')).toHaveLength(64);
     await request('http://localhost:4010/overflow');await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='route-continue')).toHaveLength(64);expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(order.filter(value=>value==='unroute')).toHaveLength(1);
     disposal=owner.dispose();void disposal.catch(()=>{});expect(owner.unsafeOutstanding).toBe(true);
   }finally{disposal??=owner.dispose();void disposal.catch(()=>{});connection.resolve();continuation.resolve();await Promise.allSettled([replay,disposal,...operations]);await owner.ownershipSettled;}
   expect(bodyFailed).toBe(true);expect((await replay).status).toBe('failed');expect(owner.failures.some(row=>row.message.includes('capacity exceeded'))).toBe(true);expect(order.filter(value=>value==='route-dispose')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(false);
 },{connectionHold:connection.promise});}finally{connection.resolve();continuation.resolve();}
});
test('fulfilled host wait cannot prove success when actual public product outcome is error',async()=>{
 await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});expect(replay.status).toBe('failed');expect(failed).toBe(true);expect(String(error)).toContain('Actual product delivery did not complete successfully');expect(order).toContain('host-wait');expect(order).not.toContain('phase-close');
 },{productProgress:{activeMessage:null,delivery:'complete',outcome:'error',loading:false,error:null}});
});
test('malformed actual public progress is rejected rather than using four unchecked terminal fields',async()=>{
 await lifecycleFixture(async({driver,owner,context})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});expect(replay.status).toBe('failed');expect(failed).toBe(true);expect(error).toBeInstanceOf(Error);expect((error as Error).name).toBe('ZodError');
 },{productProgress:{delivery:'complete',outcome:'success',loading:false,error:null,unrecognized:true}});
});
test('duplicate pre-input and post cached page sample cannot prove a window despite genuinely fresh later evidence',async()=>{
 await lifecycleFixture(async({driver,owner,context,scrollReads,writer,directory})=>{
  let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
  const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
  const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(scrollReads.length).toBeGreaterThanOrEqual(3);const [before,post,later]=scrollReads;expect(post!.pageMs).toBe(before!.pageMs);expect(later!.pageMs-post!.pageMs).toBeGreaterThanOrEqual(800);expect(capture?.validation.checks.find(check=>check.name==='independent-candidate-content-geometry')?.passed).toBe(true);
  await owner.dispose();await owner.ownershipSettled;await driver.finalize!({identity:state!.identity,writer:writer.scoped(()=>{}),deadlines:owner.deadlines},capture!);const checkpoints=JSON.parse(await readFile(join(directory,'checkpoints.json'),'utf8'));expect(checkpoints.scroll.slice(0,3).map((row:{timestampMs:number})=>row.timestampMs)).toEqual([before!.pageMs,post!.pageMs,later!.pageMs]);expect(checkpoints.scroll.slice(0,3).every((row:{geometry:{status:string}})=>row.geometry.status==='available')).toBe(true);expect(checkpoints.hostDispatches.filter((row:{kind:string})=>row.kind==='wheel')).toHaveLength(4);
  expect(capture?.validation.status).toBe('failed');expect(capture?.validation.reasons).toContain('Actual cached samples do not cover the required 800ms window');
 },{history:true,stalePostScroll:true});
});
for(const scenario of [
 {name:'cached scroll timestamps do not prove the actual 800ms history observation window',options:{history:true,staleScroll:true},reason:'Actual cached samples do not cover the required 800ms window'},
 {name:'raw activeVisible false with unavailable geometry cannot prove response absence',options:{history:true,unavailableScrollGeometry:true},reason:'Scored scroll geometry unavailable'},
] as const)test(scenario.name,async()=>{
 await lifecycleFixture(async({driver,owner,context})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,capture:Awaited<ReturnType<typeof driver.replay>>|undefined;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=await owner.run('replay',async ownership=>{try{capture=await driver.replay(context(ownership),state!);}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(replay.status).toBe('complete');expect(capture?.validation.status).toBe('failed');expect(capture?.validation.reasons).toContain(scenario.reason);expect(capture?.validation.checks.find(check=>check.name==='independent-candidate-content-geometry')?.passed).toBe(true);
 },scenario.options);
});
test('late untransferred trace acquisition and held first detach remain genuinely owned after independent closes',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const acquisition=deferred<void>(),detach=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order})=>{
   let failed=false,error:unknown,state:Awaited<ReturnType<typeof driver.setup>>|undefined,bodyFailed=false,bodyError:unknown;
   const setup=await owner.run('setup',async ownership=>{try{state=await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});if(failed)throw error;expect(setup.status).toBe('complete');
   const replay=owner.run('replay',async ownership=>{try{await driver.replay(context(ownership),state!);}catch(value){bodyFailed=true;bodyError=value;throw value;}});void replay.catch(()=>{});let disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   try{
     for(let index=0;index<1000&&!order.includes('trace-acquire');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order).toContain('trace-acquire');await vi.advanceTimersByTimeAsync(30000);expect((await replay).status).toBe('expired');disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(0);expect(order).toContain('context-close');expect(order).toContain('browser-close');expect(order).not.toContain('Tracing.start');
     acquisition.resolve();await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);detach.resolve();await owner.ownershipSettled;expect(bodyFailed).toBe(true);expect(String(bodyError)).toContain('Late trace session');expect(order.filter(value=>value==='trace-detach')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(false);
   }finally{acquisition.resolve();detach.resolve();disposal??=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);await Promise.allSettled([replay,disposal]);await owner.ownershipSettled;}
 },{traceAcquireHold:acquisition.promise,traceDetachHold:detach.promise});}finally{acquisition.resolve();detach.resolve();vi.useRealTimers();}
});
test('pre-page controller retains a late page and its first held close without claiming installation or cleanup RPCs',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);const acquisition=deferred<void>(),close=deferred<void>();
 try{await lifecycleFixture(async({driver,owner,context,order,pageCalls})=>{
   let failed=false,error:unknown,disposal:ReturnType<ComparisonOwnership['dispose']>|undefined;
   const setup=owner.run('setup',async ownership=>{try{await driver.setup(context(ownership));}catch(value){failed=true;error=value;throw value;}});void setup.catch(()=>{});
   try{
     for(let index=0;index<1000&&!order.includes('page-acquire')&&!failed;index++)await new Promise<void>(resolve=>actualTimer(resolve,1));if(failed)throw error;expect(order).toContain('page-acquire');
     await vi.advanceTimersByTimeAsync(60000);expect((await setup).status).toBe('expired');disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(0);
     expect(order).toContain('browser-close');expect(order).toContain('context-close');expect(order).not.toContain('page-close');expect(pageCalls()).toBe(0);
     await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);
     acquisition.resolve();for(let index=0;index<1000&&!order.includes('page-close');index++)await new Promise<void>(resolve=>actualImmediate(resolve));expect(order.filter(value=>value==='page-close')).toHaveLength(1);expect(owner.unsafeOutstanding).toBe(true);
     expect(order).not.toContain('pre-install');expect(order).not.toContain('stop');expect(order).not.toContain('host-dispose');expect(pageCalls()).toBe(0);
     close.resolve();await owner.ownershipSettled;expect(failed).toBe(true);expect(String(error)).toContain('Late resource');expect(owner.unsafeOutstanding).toBe(false);expect(order.filter(value=>value==='page-close')).toHaveLength(1);
   }finally{acquisition.resolve();close.resolve();disposal??=owner.dispose();void disposal.catch(()=>{});await Promise.allSettled([setup,disposal]);await owner.ownershipSettled;}
 },{pageAcquireHold:acquisition.promise,pageCloseHold:close.promise});}finally{acquisition.resolve();close.resolve();vi.useRealTimers();}
});
test('late browser acquisition is adopted and genuinely closed without stale context creation',async()=>{
 vi.useFakeTimers();vi.setSystemTime(0);const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-late-')),owner=new ComparisonOwnership({now:Date.now}),writer=await ComparisonArtifactWriter.create(directory),launched=deferred<void>(),launch=deferred<Browser>(),close=deferred<void>();let closes=0,contexts=0,failed=false,error:unknown;
 const browser={async close(){closes++;await close.promise;},async newContext(){contexts++;throw new Error('stale context');}} as unknown as Browser;
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(_session,pre,main){return assembleComparisonInstaller(pre,main);},async resolveProfile(){return profile();},async launch(){launched.resolve();return launch.promise;}});
 const stage=owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});void stage.catch(()=>{});
 try{await launched.promise;await vi.advanceTimersByTimeAsync(60000);expect((await stage).status).toBe('expired');const disposal=owner.dispose();void disposal.catch(()=>{});launch.resolve(browser);await vi.advanceTimersByTimeAsync(0);expect(closes).toBe(1);expect(contexts).toBe(0);await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(owner.unsafeOutstanding).toBe(true);close.resolve();await owner.ownershipSettled;expect(failed).toBe(true);expect(String(error)).toContain('Late resource');expect(contexts).toBe(0);expect(closes).toBe(1);}
 finally{launch.resolve(browser);close.resolve();await owner.ownershipSettled;vi.useRealTimers();await rm(directory,{recursive:true,force:true});}
});
for(const rejected of ['serving','profile','environment'] as const)test(`all live gates precede serving; ${rejected} failure prevents assets/navigation`,async()=>{
 const config=configuration(),slot=createLongThreadLedger(config).runs[0]!,directory=await mkdtemp(join(tmpdir(),'g-capture-gate-')),owner=new ComparisonOwnership(),writer=await ComparisonArtifactWriter.create(directory),order:string[]=[];
 const probe=comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(new URL('../.comparison-build-evidence.json',import.meta.url),'utf8'))),adapter=profile();
 const facts={git:{revision:'fixture-revision',dirty:false},assets:adapter.build.assetHashes,browser:{executable:'/fixture-browser',version:'fixture',revision:'fixture',flags:[]},environment:{os:'fixture',architecture:'fixture',cpu:{status:'unavailable' as const,reason:'fixture'},gpu:{status:'unavailable' as const,reason:'fixture'}},browserProtocol:{protocolVersion:'fixture',product:'fixture',revision:'fixture',userAgent:'fixture',jsVersion:'fixture'},chromiumDownloadRevision:'fixture',playwrightVersion:'1.64.0'};
 const page={async close(){order.push('page-close');},async goto(){order.push('navigate');}} as unknown as Page,session={async detach(){order.push('detach');}} as unknown as CDPSession,context={async close(){order.push('context-close');},async newPage(){return page;}} as unknown as BrowserContext,browser={async close(){order.push('browser-close');},async newContext(){return context;},async newBrowserCDPSession(){return session;}} as unknown as Browser;
 let failed=false,error:unknown;
 const driver=createLongThreadCaptureDriver({originalRoot:directory,configuration:config},{async acquireInstrumentation(_session,pre,main){order.push('acquire');return assembleComparisonInstaller(pre,main);},async resolveProfile(){return adapter;},async launch(){return browser;},async collectEnvironment(){return {facts,async recheckBeforeServing(){order.push('environment');if(rejected==='environment')throw new Error('environment gate rejected');return facts;}};},async recheckServing(){order.push('serving');if(rejected==='serving')throw new Error('serving gate rejected');return {originalRoot:directory,build:adapter.build,probe,assets:adapter.build.assetHashes};},async recheckProfile(){order.push('profile');if(rejected==='profile')throw new Error('profile gate rejected');return adapter;},async serveAssets(){order.push('assets');throw new Error('unexpected assets');}});
 const identity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:slot.repetition,scenarioId:slot.scenarioId,round:slot.round,caseIndex:slot.caseIndex,adapterProfile:slot.adapterProfile} as const;
 try{const result=await owner.run('setup',async ownership=>{try{return await driver.setup({identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:slot.artifactDirectory},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())});}catch(value){failed=true;error=value;throw value;}});expect(result.status).toBe('failed');expect(failed).toBe(true);expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe(rejected+' gate rejected');expect(order).not.toContain('assets');expect(order).not.toContain('navigate');expect(order.slice(0,order.indexOf(rejected)+1)).toEqual(['acquire',...['serving','profile','environment'].slice(0,['serving','profile','environment'].indexOf(rejected)+1)]);}
 finally{await owner.dispose();await owner.ownershipSettled;await rm(directory,{recursive:true,force:true});}
});
import {comparisonRuntimeFamily} from './comparison-runtime-family.js';
