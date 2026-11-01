import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./operation.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
test('the public original run promise remains the completion object and start is once-only',async()=>{
 assert.equal(typeof api.createRunOperation,'function');let finish;const original=new Promise(resolve=>finish=resolve);
 const op=api.createRunOperation(()=>original,async()=>{},()=>{});assert.equal(op.state().status,'idle');assert.throws(()=>op.wait());
 op.start();assert.equal(op.wait(),original);assert.equal(op.state().status,'pending');assert.throws(()=>op.start());finish();await op.wait();assert.equal(op.state().status,'fulfilled');
});
test('original rejection stays rejected through read and disposal',async()=>{
 const error=new Error('original SDK failure');const op=api.createRunOperation(()=>Promise.reject(error),async()=>{},()=>{});op.start();await assert.rejects(op.wait(),/original SDK failure/);assert.equal(op.state().status,'rejected');assert.equal(op.error(),error);await assert.rejects(op.dispose());assert.equal(op.error(),error);
});
test('dispose aborts, unmounts and awaits the original run before settling',async()=>{
 let finish,unmounted=false,closed=false;const original=new Promise(resolve=>finish=resolve);const op=api.createRunOperation(()=>original,async()=>{finish();},()=>{unmounted=true;});op.start();const pending=op.dispose().then(()=>{closed=true;});assert.equal(closed,false);await pending;assert.equal(unmounted,true);assert.equal(closed,true);assert.equal(op.state().status,'fulfilled');assert.equal(op.dispose(),op.dispose());
});
test('stop failure cannot skip unmount or original-run settlement',async()=>{
 let unmounted=false;const original=Promise.resolve();const op=api.createRunOperation(()=>original,async()=>{throw Error('stop failed');},()=>{unmounted=true;});op.start();await assert.rejects(op.dispose());assert.equal(unmounted,true);await op.wait();assert.equal(op.state().status,'fulfilled');
});
