import {describe,it,expect} from 'vitest';
import {createStoreDomain} from '../apps/copilotkit/src/controls.ts';
import {OwnedOperations,cleanupOriginalBridge} from '../apps/copilotkit/runtime/ownership.ts';

type Reader={cancel():Promise<unknown>;releaseLock():void};
type Producer={close():Promise<void>};
const cleanup=cleanupOriginalBridge;
const prefix='Original bridge cleanup failed; case ownership retained';

function fixture(cancelError?:unknown,closeError?:unknown,releaseError?:unknown){
 const ids={threadId:'thread',seedRunId:'seed',continuationRunId:'continue',responseId:'response'};
 const history=[{id:'history',role:'user' as const,content:'history'}];
 const domain=createStoreDomain(),controls=domain.beginCase(ids,history,[]),operations=new OwnedOperations(controls);
 const calls:string[]=[];
 const reader:Reader={cancel:async()=>{calls.push('reader-cancel');if(cancelError!==undefined)throw cancelError;},releaseLock:()=>{calls.push('reader-release');if(releaseError!==undefined)throw releaseError;}};
 const producer:Producer={close:async()=>{calls.push('producer-close');if(closeError!==undefined)throw closeError;}};
 const cancellation={abort:()=>{calls.push('abort');}},forget=()=>{calls.push('forget');};
 const run=(r:Reader|undefined=reader,p:Producer|undefined=producer)=>operations.run('bridge','original-bridge',()=>cleanup(r,p,operations,cancellation,forget));
 function dispose(){
  const server=operations.start('server-disposal','server'),harness=operations.start('harness-disposal','harness');server.succeed();harness.succeed();operations.closeAdmission();controls.observeIdle(true);
 }
 function retained(){dispose();let clears=0;expect(()=>controls.clearStore(()=>{clears++;})).toThrow('Complete owned settlement');expect(clears).toBe(0);expect(()=>controls.finishDisposal()).toThrow();expect(()=>domain.beginCase(ids,history,[])).toThrow('Previous case');}
 return {calls,reader,producer,operations,controls,domain,run,dispose,retained,ids,history};
}

describe('original bridge cleanup diagnostics',()=>{
 it.each([
  [true,false,'reader-cancel'],[false,true,'producer-close'],[true,true,'reader-cancel,producer-close'],
 ] as const)('publishes only closed caught-operation labels cancel=%s close=%s',async(cancel,close,labels)=>{
  const f=fixture(cancel?Error('private cancel payload'):undefined,close?Error('private close payload'):undefined);
  await expect(f.run()).rejects.toThrow(`${prefix} [${labels}]`);
  expect(f.calls).toEqual(['abort','reader-cancel','reader-release','producer-close','forget']);
  const failures=f.operations.failures();expect(failures.primary).toEqual([`${prefix} [${labels}]`]);expect(failures.cleanup).toHaveLength(Number(cancel)+Number(close));
  expect(failures.primary.join('')).not.toContain('private');f.retained();await expect(f.operations.awaitOriginals(true)).rejects.toThrow('Owned operation failure');
 });
 it('permits store clear and domain reuse after actual successful settlement',async()=>{
  const f=fixture();await f.run();expect(f.calls).toEqual(['abort','reader-cancel','reader-release','producer-close','forget']);expect(f.operations.failures()).toEqual({primary:[],cleanup:[]});
  f.dispose();await f.operations.awaitOriginals(true);let clears=0;f.controls.clearStore(()=>{clears++;});f.controls.observeEmptyAfterClear([]);f.controls.finishDisposal();expect(clears).toBe(1);expect(()=>f.domain.beginCase(f.ids,f.history,[])).not.toThrow();
 });
 it('skips absent resources and still aborts and forgets',async()=>{
  const f=fixture();await f.operations.run('bridge','absent',()=>cleanup(undefined,undefined,f.operations,{abort:()=>{f.calls.push('abort');}},()=>{f.calls.push('forget');}));expect(f.calls).toEqual(['abort','forget']);
 });
 it('preserves releaseLock rejection identity and prevents later close and forget',async()=>{
  const abrupt=Error('release abrupt'),f=fixture(undefined,undefined,abrupt);await expect(f.run()).rejects.toBe(abrupt);expect(f.calls).toEqual(['abort','reader-cancel','reader-release']);expect(f.operations.failures().cleanup).toEqual([]);f.retained();
 });
 it('preserves releaseLock overriding a caught cancel failure',async()=>{
  const abrupt=Error('release wins'),f=fixture(Error('cancel original'),undefined,abrupt);await expect(f.run()).rejects.toBe(abrupt);expect(f.calls).toEqual(['abort','reader-cancel','reader-release']);expect(f.operations.failures().cleanup).toEqual(['cancel original']);f.retained();
 });
 it('preserves abrupt diagnostic getter and reader finally without attempting producer close',async()=>{
  const abrupt=Error('diagnostic abrupt'),error=new Error();let gets=0;Object.defineProperty(error,'message',{get(){gets++;throw abrupt;}});const f=fixture(error);await expect(f.run()).rejects.toBe(abrupt);expect(gets).toBe(1);expect(f.calls).toEqual(['abort','reader-cancel','reader-release']);expect(f.operations.failures().cleanup).toEqual([]);f.retained();
 });
 it('waits for original cancel before releasing or attempting producer close',async()=>{
  const f=fixture();let reject!:(error:unknown)=>void;f.reader.cancel=()=>{f.calls.push('reader-cancel');return new Promise((_resolve,no)=>{reject=no;});};const run=f.run();expect(f.calls).toEqual(['abort','reader-cancel']);reject(Error('late original cancel'));await expect(run).rejects.toThrow(`${prefix} [reader-cancel]`);expect(f.calls).toEqual(['abort','reader-cancel','reader-release','producer-close','forget']);f.retained();
 });
 it('keeps existing diagnostic count and byte bounds without hiding outward labels',async()=>{
  const f=fixture(Error('c'.repeat(1000)),Error('p'.repeat(1000)));for(let n=0;n<31;n++)f.operations.cleanupFailure('existing');await expect(f.run()).rejects.toThrow(`${prefix} [reader-cancel,producer-close]`);const failures=f.operations.failures();expect(failures.cleanup).toHaveLength(32);expect(failures.cleanup[31]).toBe('c'.repeat(256));expect(failures.primary).toEqual([`${prefix} [reader-cancel,producer-close]`]);f.retained();
 });
});
