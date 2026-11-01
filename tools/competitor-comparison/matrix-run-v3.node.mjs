import test from 'node:test';import assert from 'node:assert/strict';
import {parseMatrixArguments,runMatrixRoster,createMatrixDeadline} from './matrix-run-v3.mjs';

test('default invocation predeclares all49 immutable slots; debug filters keep frozen roster order',()=>{
 const full=parseMatrixArguments(['--out','/private/tmp/authored-matrix']);assert.equal(full.mode,'strict');assert.equal(full.slots.length,49);assert.equal(full.slots.at(-1).kind,'omitted-delta-100');
 const debug=parseMatrixArguments(['--out','/private/tmp/authored-matrix','--history-count','1000','--response-bytes','262144','--profile','copilotkit']);assert.equal(debug.mode,'debug');assert.deepEqual(debug.slots.map(x=>x.selection.journey),['follow','history-reading']);assert.equal(debug.slots.every(x=>x.selection.historyCount===1000),true);
});
test('CLI refuses arbitrary workloads, ambiguous filters and runtime limit overrides',()=>{
 for(const args of [['--out','relative'],['--out','/private/tmp/a','--history-count','101'],['--out','/private/tmp/a','--response-bytes','262145'],['--out','/private/tmp/a','--profile','foreign'],['--out','/private/tmp/a','--timeout','999'],['--out','/private/tmp/a','--out','/private/tmp/b'],['--out','/private/tmp/a','--verify','--journey','follow']])assert.throws(()=>parseMatrixArguments(args));
});
test('deadline never turns original settlement into success and respects global remaining time',async()=>{
 let now=0;const deadline=createMatrixDeadline({caseStarted:0,invocationStarted:0,now:()=>now});assert.equal(deadline.remaining(),240000);now=239999;assert.equal(deadline.remaining(),1);now=240000;assert.throws(()=>deadline.check(),/deadline/);
 const late=createMatrixDeadline({caseStarted:1199990,invocationStarted:0,now:()=>1200000});assert.throws(()=>late.check(),/deadline/);
 let release;const original=new Promise(resolve=>{release=resolve;});const clock=createMatrixDeadline({caseStarted:0,invocationStarted:0,now:()=>0});await assert.rejects(clock.wait(original,1,'authored-stage'),/authored-stage/);release('actual');assert.equal(await original,'actual');
});
test('roster preserves invalid attempts and marks later slots unattempted on unsafe custody',async()=>{
 const slots=parseMatrixArguments(['--out','/private/tmp/authored']).slots;let calls=0;
 const result=await runMatrixRoster({slots,invocationStarted:0,now:()=>0,execute:async slot=>{calls++;return{id:slot.id,status:'invalid',unsafeOutstanding:true,failure:{message:'held-original'}};}});
 assert.equal(calls,1);assert.equal(result.results.length,49);assert.equal(result.results[0].status,'invalid');assert.equal(result.results.slice(1).every(x=>x.status==='unattempted'),true);assert.equal(result.complete,false);
});
test('global deadline stops new cases and negative requires its distinct accepted outcome',async()=>{
 const slots=parseMatrixArguments(['--out','/private/tmp/authored']).slots;let now=0,calls=0;
 const partial=await runMatrixRoster({slots,invocationStarted:0,now:()=>now,execute:async slot=>{calls++;now=1200000;return{id:slot.id,status:'matrix-pass',unsafeOutstanding:false};}});assert.equal(calls,1);assert.equal(partial.results[1].status,'unattempted');assert.equal(partial.complete,false);
 const complete=await runMatrixRoster({slots,invocationStarted:0,now:()=>0,execute:async slot=>({id:slot.id,status:slot.kind==='positive'?'matrix-pass':'negative-pass',unsafeOutstanding:false})});assert.equal(complete.complete,true);
 const wrong=await runMatrixRoster({slots:slots.slice(-1),invocationStarted:0,now:()=>0,execute:async slot=>({id:slot.id,status:'matrix-pass',unsafeOutstanding:false})});assert.equal(wrong.complete,false);
});

test('trusted wheel cancelled by later bubble listener records final defaultPrevented and refuses custody',{timeout:15000},async()=>{
 const api=await import('./matrix-run-v3.mjs');assert.equal(typeof api.installMatrixWheelRecorder,'function');assert.equal(typeof api.requireMatrixWheelDelivery,'function');
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.setContent('<div id="scroller" style="overflow:auto;height:200px;width:400px"><div style="height:2000px">authored wheel control</div></div>');
 await page.evaluate(api.installMatrixWheelRecorder,'#scroller');await page.evaluate(()=>document.querySelector('#scroller').addEventListener('wheel',event=>event.preventDefault(),{passive:false}));await page.mouse.move(100,100);await page.mouse.wheel(0,-600);
 await page.waitForFunction(()=>window.__matrixWheel?.records.length>0&&window.__matrixWheel.records.every(row=>row.defaultPrevented!==null),{},{timeout:5000});
 const events=await page.evaluate(()=>window.__matrixWheel.records);assert.equal(events[0].trusted,true);assert.equal(events[0].defaultPrevented,true);assert.throws(()=>api.requireMatrixWheelDelivery(events,-600),/wheel/);
 }finally{await browser.close();}
});
test('publication failure preserves complete roster and stops further execution',async()=>{
 const slots=parseMatrixArguments(['--out','/private/tmp/authored']).slots;let calls=0;
 const result=await runMatrixRoster({slots,invocationStarted:0,now:()=>0,execute:async slot=>{calls++;return{id:slot.id,status:'matrix-pass',unsafeOutstanding:false};},onResult:async()=>{throw Error('authored-publication-failure');}});
 assert.equal(calls,1);assert.equal(result.results.length,49);assert.equal(result.results[0].status,'invalid');assert.equal(result.results[1].status,'unattempted');assert.equal(result.complete,false);
});
test('failed started run retains one actual final snapshot or its original rejection before disposal',async()=>{
 const api=await import('./matrix-run-v3.mjs');assert.equal(typeof api.captureMatrixFinalBookend,'function');
 const actual={messages:[{id:'corrupt-actual',role:'tool',text:'retained'}]},ref={path:'case/final.json',bytes:1,sha256:'a'.repeat(64)};let reads=0,writes=0;
 const capture=await api.captureMatrixFinalBookend({started:true,attempted:false,remaining:1,read:async()=>{reads++;return actual;},write:async value=>{writes++;assert.equal(value,actual);return ref;}});assert.equal(capture.snapshot,actual);assert.equal(capture.reference,ref);assert.equal(reads,1);assert.equal(writes,1);
 await api.captureMatrixFinalBookend({started:true,attempted:true,remaining:1,read:async()=>{throw Error('must not retry');},write:async()=>{throw Error('must not write');}});
 const rejection=Error('actual projection refusal');const rejected=await api.captureMatrixFinalBookend({started:true,attempted:false,remaining:1,read:async()=>{throw rejection;},write:async()=>{throw Error('must not manufacture snapshot');}});assert.equal(rejected.error,rejection);assert.equal(rejected.unavailable.attempted,true);
 const expired=await api.captureMatrixFinalBookend({started:true,attempted:false,remaining:0,read:async()=>{throw Error('over budget');},write:async()=>{throw Error('over budget');}});assert.equal(expired.attempted,false);assert.equal(expired.unavailable.reason,'matrix-deadline-exhausted');
});
test('deadline also rejects late original resolution when timer delivery is delayed',async()=>{
 let now=0;const clock=createMatrixDeadline({caseStarted:0,invocationStarted:0,now:()=>now});
 const lateStage=clock.wait(Promise.resolve('original resolved'),10,'authored-late-stage');now=11;await assert.rejects(lateStage,/authored-late-stage/);
 now=0;const lateGlobal=clock.wait(Promise.resolve('original resolved'),100,'authored-stage');now=240000;await assert.rejects(lateGlobal,/deadline/);
});
test('source bookends include actual generated contract modules imported by fixture compiler',async()=>{
 const api=await import('./matrix-run-v3.mjs');assert.equal(typeof api.collectMatrixProvenance,'function');
 const facts=await api.collectMatrixProvenance('vercel-ai-sdk');assert.ok(Array.isArray(facts.compiledContract));
 const index=facts.compiledContract.find(row=>row.path==='index.js');assert.ok(index);
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const bytes=await readFile(new URL('../../packages/contract/dist/index.js',import.meta.url));
 assert.equal(index.bytes,bytes.length);assert.equal(index.sha256,createHash('sha256').update(bytes).digest('hex'));
});
