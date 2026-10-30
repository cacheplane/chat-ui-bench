import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const filename=new URL('./request-window-preroll-v1.mjs',import.meta.url);
async function control({samples=[0n,1000000000n],dispatchError=false,cleanupError=false}={}){
 const source=await fs.readFile(filename,'utf8');let reads=0,dispatches=0,clears=0;
 const context=vm.createContext({process:{hrtime:{bigint(){return samples[reads++];}}},setTimeout(fn,ms){dispatches++;assert.equal(ms,1000);if(dispatchError)throw Error('dispatch');queueMicrotask(fn);return 7;},clearTimeout(handle){clears++;assert.equal(handle,7);if(cleanupError)throw Error('cleanup');}});
 vm.runInContext(source.replace('export async function','async function')+';globalThis.wait=waitRequestWindowPrerollV1;',context);
 return {wait:context.wait,counts:()=>({reads,dispatches,clears})};
}
for(const elapsed of [1000000000n,2000000000n])test('fixed original wait accepts inclusive ns boundary '+elapsed,async()=>{const c=await control({samples:[0n,elapsed]}),receipt=await c.wait();assert.equal(JSON.stringify(receipt),JSON.stringify({policy:'request-window-trace-preroll-1000-v1',requestedMs:1000,elapsedNs:String(elapsed),state:'fulfilled'}));assert.equal(Object.isFrozen(receipt),true);assert.deepEqual(c.counts(),{reads:2,dispatches:1,clears:1});});
for(const end of [999999000n,2000001000n,-1n,NaN,Infinity,Number.MAX_SAFE_INTEGER*1000000*2])test('refuses invalid original elapsed '+String(end),async()=>{const c=await control({samples:[0n,end]});await assert.rejects(c.wait());assert.equal(c.counts().dispatches,1);assert.equal(c.counts().clears,1);});
for(const start of [-0,-1n,NaN,Infinity,Number.MAX_SAFE_INTEGER*1000000*2])test('refuses invalid start before dispatch '+String(start),async()=>{const c=await control({samples:[start,1000000000n]});await assert.rejects(c.wait());assert.equal(c.counts().dispatches,0);});
test('dispatch refusal never retries',async()=>{const c=await control({dispatchError:true});await assert.rejects(c.wait());assert.equal(c.counts().dispatches,1);});
test('cleanup refusal cannot fulfill',async()=>{const c=await control({cleanupError:true});await assert.rejects(c.wait());assert.equal(c.counts().clears,1);});
test('production exposes no injection arguments',async()=>{const source=await fs.readFile(filename,'utf8');assert.match(source,/waitRequestWindowPrerollV1\(\)/);assert.match(source,/Number\(process\.hrtime\.bigint\(\)\)\/1000000/);assert.equal(source.includes('options'),false);});
