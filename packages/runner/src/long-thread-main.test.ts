import {expect,test,vi} from 'vitest';
import {runLongThreadCaptureMain} from './long-thread-main.js';
import {createLongThreadCaptureDriver} from './long-thread-capture.js';
import {runLongThreadInvocation,type ComparisonInvocationExecution} from './long-thread-run.js';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});void promise.catch(()=>{});return {promise,resolve};}
test('pure help returns success without loading capture runtime or acquiring resources',async()=>{
 const messages:string[]=[],errors:string[]=[],loadRuntime=vi.fn(async()=>{throw new Error('Forbidden runtime load');});
 expect(await runLongThreadCaptureMain(['--help'],{loadRuntime,stdout:value=>messages.push(value),stderr:value=>errors.push(value)})).toBe(0);
 expect(loadRuntime).not.toHaveBeenCalled();expect(messages.join('\n')).toContain('bench:long-thread');expect(errors).toEqual([]);
});
for(const args of [[],['--help','--out','/private/tmp/unused'],['--out','/private/tmp/unused','--adapter','copilotkit'],['--out','/private/tmp/unused','--mode','headless','--rounds','4'],['--out','/private/tmp/unused','--mode','headed','--rounds','1'],['--out','/private/tmp/unused','--case','subset']])test(`invalid configuration ${JSON.stringify(args)} rejects before runtime load`,async()=>{
 const errors:string[]=[],messages:string[]=[],loadRuntime=vi.fn(async()=>{throw new Error('Forbidden runtime load');});
 expect(await runLongThreadCaptureMain(args,{loadRuntime,stderr:value=>errors.push(value),stdout:value=>messages.push(value)})).toBe(1);expect(loadRuntime).not.toHaveBeenCalled();expect(messages).toEqual([]);expect(errors).toHaveLength(1);expect(errors[0]!.length).toBeGreaterThan(0);
});
test('valid whole configuration reaches the lazy actual runtime boundary and retains its actual failure',async()=>{
 const errors:string[]=[],loadRuntime=vi.fn(async()=>{throw false;});
 expect(await runLongThreadCaptureMain(['--out','/private/tmp/unused','--mode','headless','--rounds','1'],{loadRuntime,stderr:value=>errors.push(value),stdout:()=>{}})).toBe(1);expect(loadRuntime).toHaveBeenCalledOnce();expect(errors).toEqual(['false']);
});
test('actual main awaits genuine root ownership settlement and finalization and returns nonzero for sealed failed collection',async()=>{
 vi.useFakeTimers({toFake:['Date','setTimeout','clearTimeout']});vi.setSystemTime(0);
 const directory=await mkdtemp(join(tmpdir(),'g-main-root-')),entered=deferred<void>(),hold=deferred<void>(),disposalArmed=deferred<void>(),executionSeen=deferred<ComparisonInvocationExecution>(),messages:string[]=[],errors:string[]=[];let attempts=0,factories=0,loads=0,finished=false;
 const main=runLongThreadCaptureMain(['--out',directory,'--mode','headless','--rounds','1'],{stdout:value=>messages.push(value),stderr:value=>errors.push(value),async loadRuntime(){loads++;return {
   createLongThreadCaptureDriver(options){factories++;expect(options.originalRoot).toBe(fileURLToPath(new URL('../../../',import.meta.url)));expect(options.configuration.configuration.caseOrder).toHaveLength(12);expect(options.configuration.purpose).toBe('conformance');return createLongThreadCaptureDriver(options,{async acquireInstrumentation(session){attempts++;expect(session.snapshotAcquisition().acquisition.status).toBe('partial');entered.resolve();await hold.promise;throw false;},async launch(){throw new Error('Forbidden browser after acquire rejection');}});},
   async runLongThreadInvocation(configuration,driver){const execution=await runLongThreadInvocation(configuration,driver,{clock:{now:Date.now,setTimer(callback,delay){if(delay===10000)disposalArmed.resolve();return setTimeout(callback,delay);},clearTimer:clearTimeout}});executionSeen.resolve(execution);return execution;}
 };}}).finally(()=>{finished=true;});void main.catch(()=>{});
 try{
   await entered.promise;await vi.advanceTimersByTimeAsync(60000);await disposalArmed.promise;await vi.advanceTimersByTimeAsync(10000);const execution=await executionSeen.promise;
   expect(loads).toBe(1);expect(factories).toBe(1);expect(attempts).toBe(1);expect(execution.unsafeOutstanding).toBe(true);expect(execution.finalized).toBe(false);expect(finished).toBe(false);await expect(readFile(join(directory,'dataset-seal.json'))).rejects.toMatchObject({code:'ENOENT'});
   hold.resolve();expect(await main).toBe(1);expect(execution.unsafeOutstanding).toBe(false);expect(execution.finalized).toBe(true);expect(execution.invocation.runs.every(row=>row.status==='failed')).toBe(true);expect(JSON.parse(await readFile(join(directory,'dataset-seal.json'),'utf8')).status).toBe('sealed');expect(errors).toEqual([]);expect(messages).toEqual([`Long-thread conformance collection failed: ${directory}`]);expect(attempts).toBe(1);
 }finally{hold.resolve();await main;vi.useRealTimers();await rm(directory,{recursive:true,force:true});}
});
