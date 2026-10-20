import { expect, test } from 'vitest';
import * as naturalDrainRuntime from '../apps/copilotkit/runtime/mounted-native.ts';
const drainView={hasPrimary:true,firstFailure:{code:'opposing-offset' as const,ordinal:3,previousOrdinal:2,slot:0},hostT0Ms:700,captureTailFulfilled:true,inputDrainFulfilled:true,traceClosed:true,pendingOriginal:false,completionAttempted:false};
test('natural drain retains the actual cleanup original before invoking completion exactly once',async()=>{
 expect(naturalDrainRuntime).toHaveProperty('createPostCaptureDrainOwner');
 let release!:()=>void,cleanups=0,completions=0;
 const cleanup=new Promise<void>(yes=>{release=yes;});
 const owner=naturalDrainRuntime.createPostCaptureDrainOwner({deadline:100,now:()=>10,started:()=>true,attempted:()=>false,admitted:()=>true,cleanup:()=>{cleanups++;return cleanup;},complete:async()=>{completions++;}});
 const run=owner.attempt(drainView);for(let i=0;i<10;i++)await Promise.resolve();expect(completions).toBe(0);release();await run;await owner.attempt(drainView);
 expect(cleanups).toBe(1);expect(completions).toBe(1);expect(owner.receipt).toMatchObject({eligibility:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'fulfilled'});
});
test.each(['throw','replay','validation'] as const)('natural drain charges %s completion failure once',async kind=>{
 expect(naturalDrainRuntime).toHaveProperty('createPostCaptureDrainOwner');
 const failure=Object.freeze({kind});let calls=0;
 const owner=naturalDrainRuntime.createPostCaptureDrainOwner({deadline:100,now:()=>10,started:()=>true,attempted:()=>false,admitted:()=>true,cleanup:async()=>{},complete:()=>{calls++;if(kind==='throw')throw failure;return Promise.reject(failure);}});
 await owner.attempt(drainView);await owner.attempt(drainView);expect(calls).toBe(1);expect(owner.receipt).toMatchObject({original:'rejected',waiter:'rejected',outcome:'rejected'});
});
test('natural drain never promotes a timed out original after late success',async()=>{
 expect(naturalDrainRuntime).toHaveProperty('createPostCaptureDrainOwner');
 let finish!:()=>void,calls=0;
 const owner=naturalDrainRuntime.createPostCaptureDrainOwner({deadline:100,now:()=>10,started:()=>true,attempted:()=>false,admitted:()=>true,cleanup:async()=>{},complete:()=>{calls++;return new Promise<void>(yes=>{finish=yes;});},wait:async(work,phase)=>{if(phase==='cleanup')return work;throw Error('deadline');}});
 await owner.attempt(drainView);expect(owner.receipt).toMatchObject({original:'pending',waiter:'timed-out',outcome:'timed-out'});finish();for(let i=0;i<10;i++)await Promise.resolve();await owner.attempt(drainView);expect(calls).toBe(1);expect(owner.receipt).toMatchObject({original:'fulfilled',waiter:'timed-out',outcome:'timed-out'});
});
test.each(['cleanup-rejected','cleanup-timeout','completion-attempted','pending-original'] as const)('natural drain refuses %s without invoking completion',async reason=>{
 expect(naturalDrainRuntime).toHaveProperty('createPostCaptureDrainOwner');let calls=0;
 const owner=naturalDrainRuntime.createPostCaptureDrainOwner({deadline:100,now:()=>10,started:()=>true,attempted:()=>reason==='completion-attempted',admitted:()=>true,cleanup:()=>reason==='cleanup-rejected'?Promise.reject(null):Promise.resolve(),complete:async()=>{calls++;},wait:async(work)=>{if(reason==='cleanup-timeout')throw Error('deadline');return work;}});
 await owner.attempt({...drainView,pendingOriginal:reason==='pending-original'});await owner.attempt(drainView);expect(calls).toBe(0);expect(owner.receipt).toMatchObject({eligibility:'ineligible',reason,original:'not-started'});
});

test('postcapture receipt copies closed own data and refuses inconsistent late success and accessors',()=>{
 expect(naturalDrainRuntime).toHaveProperty('copyPostCaptureDrainReceipt');
 const valid={schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'fulfilled',requestedHostMs:10,targetHostMs:100,settledHostMs:20};
 expect(naturalDrainRuntime.copyPostCaptureDrainReceipt(valid)).toEqual(valid);
 for(const changed of [{outcome:'fulfilled',waiter:'timed-out'},{original:'pending'},{settledHostMs:NaN},{unknown:true},{eligibility:'ineligible'},{reason:'foreign'}])expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({...valid,...changed})).toThrow();
 let reads=0;expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({...valid,get reason(){reads++;return 'eligible';}})).toThrow();expect(reads).toBe(0);
});

test('actual pilot cleanup original remains held after its ordinary one-second waiter',async()=>{
 expect(naturalDrainRuntime).toHaveProperty('bindNativeTrackerA');
 const {vi}=await import('vitest');vi.useFakeTimers();
 let release!:(value:unknown)=>void,evaluations=0,completions=0;
 const held=new Promise<unknown>(yes=>{release=yes;});
 const page={evaluate:()=>++evaluations===1?held:Promise.resolve({handlerGates:[],wheelEvents:[],scrollEvents:[],motionEvents:[],overflows:{wheel:null,scroll:null,motion:null}})};
 const binding=naturalDrainRuntime.bindNativeTrackerA({page:()=>page as never,context:()=>undefined,deadline:performance.now()+100000,publication:{} as never,check(){},owner:{} as never,geometry:async()=>{throw null;},active:async()=>null,returned:async()=>{}});
 try{
  const baseline=binding.captureBaseline();await binding.history.observations();
  const original=binding.cleanupOriginal();expect(binding.cleanupOriginal()).toBe(original);
  const ordinary=binding.dispose();const refused=expect(ordinary).rejects.toThrow('Original pilot trace cleanup');await vi.advanceTimersByTimeAsync(1000);await refused;
  const drain=naturalDrainRuntime.createPostCaptureDrainOwner({deadline:performance.now()+100000,started:()=>true,attempted:()=>false,admitted:()=>true,cleanup:()=>binding.cleanupOriginal(),complete:async()=>{completions++;}});
  const run=drain.attempt(drainView);for(let i=0;i<10;i++)await Promise.resolve();expect(completions).toBe(0);
  release({original:'baseline'});await baseline;await original;await run;
  expect(completions).toBe(1);expect(evaluations).toBe(2);expect(drain.receipt.outcome).toBe('fulfilled');await binding.dispose();
 }finally{vi.useRealTimers();}
});

test.each(['success','replay-reject','validation-reject','public-error'] as const)('actual postcapture callback awaits original replay, validates once and reads idle progress: %s',async mode=>{
 expect(naturalDrainRuntime).toHaveProperty('readPostCapturePublicCompletion');
 const prior=Object.getOwnPropertyDescriptor(globalThis,'window'),calls:string[]=[],failure=Object.freeze({mode});let release!:()=>void;
 const replay=new Promise<void>(yes=>{release=yes;});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{__copilotkitBenchHost:{async waitForReplay(){calls.push('replay');await replay;if(mode==='replay-reject')throw failure;},async validateCompletion(){calls.push('validate');if(mode==='validation-reject')throw failure;},readProgress(){calls.push('progress');return {loading:false,outcome:'success',error:mode==='public-error'?'original':null};}}}});
 try{
  const original=naturalDrainRuntime.readPostCapturePublicCompletion();const result=mode==='replay-reject'||mode==='validation-reject'?expect(original).rejects.toBe(failure):expect(original).resolves.toBe(mode==='success');
  await Promise.resolve();expect(calls).toEqual(['replay']);release();await result;
  expect(calls).toEqual(mode==='replay-reject'?['replay']:mode==='validation-reject'?['replay','validate']:['replay','validate','progress']);
 }finally{if(prior)Object.defineProperty(globalThis,'window',prior);else Reflect.deleteProperty(globalThis,'window');}
});

test.each([
 {eligibility:'ineligible',reason:'no-measured-failure',original:'not-started',waiter:'fulfilled',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null},
 {eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'pending',requestedHostMs:10,targetHostMs:100,settledHostMs:20},
 {eligibility:'eligible',reason:'eligible',original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null},
])('receipt rejects impossible completed or ineligible waiter state %#',receipt=>{expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({schemaVersion:1,...receipt})).toThrow();});

test.each(['cleanup-timeout','cleanup-rejected'] as const)('receipt requires the actual %s waiter and operation timestamps',reason=>{
 const base={schemaVersion:1,eligibility:'ineligible',reason,original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null};
 expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt(base)).toThrow();
 expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({...base,waiter:reason==='cleanup-timeout'?'timed-out':'rejected',outcome:reason==='cleanup-timeout'?'timed-out':'ineligible'})).toThrow();
});
test('receipt refuses successful completion settled at or beyond its fixed deadline',()=>{
 for(const settledHostMs of [100,101])expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({schemaVersion:1,eligibility:'eligible',reason:'eligible',original:'fulfilled',waiter:'fulfilled',outcome:'fulfilled',requestedHostMs:10,targetHostMs:100,settledHostMs})).toThrow();
});

test('receipt requires paired operation timestamps and no timestamps for early ineligibility',()=>{
 const receipt={schemaVersion:1,eligibility:'ineligible',reason:'no-measured-failure',original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null};
 for(const change of [{requestedHostMs:10},{targetHostMs:100},...['no-measured-failure','continuation-not-started','capture-incomplete','pending-original','deadline'].map(reason=>({reason,requestedHostMs:10,targetHostMs:100}))])expect(()=>naturalDrainRuntime.copyPostCaptureDrainReceipt({...receipt,...change})).toThrow();
});

test('native receipt refuses a transparent Proxy before invoking any reflection trap',()=>{
 const receipt={schemaVersion:1,eligibility:'ineligible',reason:'no-measured-failure',original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null};
 const traps:string[]=[];
 const proxy=new Proxy(receipt,{getPrototypeOf(target){traps.push('getPrototypeOf');return Reflect.getPrototypeOf(target);},ownKeys(target){traps.push('ownKeys');return Reflect.ownKeys(target);},getOwnPropertyDescriptor(target,key){traps.push('getOwnPropertyDescriptor');return Reflect.getOwnPropertyDescriptor(target,key);},get(target,key,receiver){traps.push('get');return Reflect.get(target,key,receiver);}});
 let refused=false;try{naturalDrainRuntime.copyPostCaptureDrainReceipt(proxy);}catch{refused=true;}
 expect(traps).toEqual([]);expect(refused).toBe(true);
 expect(naturalDrainRuntime.copyPostCaptureDrainReceipt(receipt)).toEqual(receipt);
});
