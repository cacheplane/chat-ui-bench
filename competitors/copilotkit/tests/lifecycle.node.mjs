import test from 'node:test';
import assert from 'node:assert/strict';
const api=()=>import('../src/lifecycle.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('once-only start retains actual public promise until original fulfillment',async()=>{
 const {createLifecycle}=await api(),run=deferred();let starts=0,aborts=0,unmounts=0;
 const life=createLifecycle(()=>{starts++;return run.promise;},async()=>{aborts++;},()=>{unmounts++;});
 assert.deepEqual(life.operation(),{kind:'original-run-promise',status:'idle'});
 life.start();assert.equal(starts,1);assert.equal(life.operation().status,'pending');assert.throws(()=>life.start(),/once/);
 let finished=false;const waiter=life.waitForRun().then(()=>{finished=true;});await Promise.resolve();assert.equal(finished,false);
 run.resolve();await waiter;assert.equal(life.operation().status,'fulfilled');await life.dispose();await life.dispose();assert.equal(aborts,1);assert.equal(unmounts,1);
});
test('public run rejection is retained and cleanup does not replace it',async()=>{
 const {createLifecycle}=await api(),run=deferred(),failure=Error('authored SDK rejection');let unmounted=false;
 const life=createLifecycle(()=>run.promise,async()=>{},()=>{unmounted=true;});life.start();run.reject(failure);
 await assert.rejects(life.waitForRun(),error=>error===failure);assert.equal(life.operation().status,'rejected');assert.equal(life.error(),'authored SDK rejection');await life.dispose();assert.equal(unmounted,true);
});
test('dispose closes admission and awaits owned cancellation before unmount',async()=>{
 const {createLifecycle}=await api(),cancel=deferred();let unmounted=false;
 const life=createLifecycle(()=>Promise.resolve(),()=>cancel.promise,()=>{unmounted=true;});const disposal=life.dispose();assert.throws(()=>life.start(),/closed/);await Promise.resolve();assert.equal(unmounted,false);cancel.resolve();await disposal;assert.equal(unmounted,true);
});
