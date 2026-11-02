import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';
const api=await import('./matrix-readiness-v4.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const context={schema:2,profile:'vercel-ai-sdk',threadId:'thread',runId:'run',canonicalResponseId:'response',history:Array.from({length:100},(_,i)=>({id:`history-${i}`,role:i%2?'user':'assistant',text:String(i).padEnd(512,'x')})),workload:{seed:1,historyCount:100,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey:'history-reading'},digests:{sourceSha256:'0'.repeat(64),historySha256:'1'.repeat(64),responseSha256:'2'.repeat(64)}};
const ready=()=>({schema:'matrix-current-sample-v3',response:{id:'native-response',role:'assistant',text:'R'.repeat(512)},progress:{schema:1,messageCount:101,responseId:'native-response',responseCharacters:512,running:true,error:null,operation:{kind:'original-run-promise',status:'pending'}},dom:{schema:'matrix-dom-selected-v3',errors:[],clip:{left:0,top:0,right:1280,bottom:720},scroll:{top:1000,height:2000,clientHeight:720},items:[{nativeId:'native-response',identityAttribute:'data-message-id',text:'R'.repeat(512),visible:true,rect:{left:100,top:400,right:900,bottom:700},hitPoints:[12]}]}});
function harness(samples,options={}){
 let time=0,index=0;const calls=[],diagnostics=createMatrixDiagnostics({now:()=>time,origin:0});
 const ports={context,started:0,now:()=>time,remaining:()=>Math.max(0,(options.caseRemaining??100000)-time),diagnostics,
  acquire:async budget=>{calls.push(['sample',budget]);time+=options.sampleMs??1;const next=samples[index++];if(next instanceof Error)throw next;return next;},
  poll:async(ms,budget)=>{calls.push(['poll',ms,budget]);time+=options.pollMs??ms;},
 };
 return {ports,calls,diagnostics,advance:ms=>{time+=ms;},readTime:()=>time};
}
test('one atomic ready sample preserves actual object and fixed acquisition budget',async()=>{
 assert.equal(typeof api.acquireMatrixReadinessV4,'function');const sample=ready(),h=harness([sample]);
 const result=await api.acquireMatrixReadinessV4(h.ports);
 assert.strictEqual(result.sample,sample);assert.equal(result.readiness.responseId,'native-response');
 assert.deepEqual(h.calls,[['sample',4000]]);assert.equal(h.diagnostics.record.lastSample.summary.progress.running,true);
});
test('explicit pending/no response, short prefix and absent DOM consume one unchanged budget',async()=>{
 const absent=ready();absent.response=null;Object.assign(absent.progress,{messageCount:100,responseId:null,responseCharacters:null});absent.dom.items=[];
 const short=ready();short.response.text='R';short.progress.responseCharacters=1;short.dom.items[0].text='R';
 const hidden=ready();hidden.dom.items=[];const last=ready(),h=harness([absent,short,hidden,last]);
 const result=await api.acquireMatrixReadinessV4(h.ports);assert.strictEqual(result.sample,last);
 assert.deepEqual(h.calls.filter(x=>x[0]==='sample').map(x=>x[1]),[4000,3949,3898,3847]);
 assert.equal(h.calls.filter(x=>x[0]==='poll').length,3);assert.equal(h.diagnostics.record.sampleAttempts,4);
});
test('first completed state is terminal and cannot be hidden by a later active sample',async()=>{
 const completed=ready();Object.assign(completed.progress,{running:false,operation:{kind:'original-run-promise',status:'fulfilled'}});
 const h=harness([completed,ready()]);await assert.rejects(api.acquireMatrixReadinessV4(h.ports),/matrix-active-history-phase/);
 assert.equal(h.calls.length,1);assert.equal(h.diagnostics.record.lastSample.summary.progress.operationStatus,'fulfilled');
});
test('malformed response or selected DOM is terminal even before the prefix exists',async()=>{
 for(const mutate of [x=>{x.response=null;x.dom.errors=['bad'];},x=>{x.response.text='R';x.progress.responseCharacters=1;x.dom.items[0].rect.right=0;},x=>{x.response.id='unrelated';},x=>{x.response.role='user';},x=>{x.dom.items[0].hitPoints=[];}]){
  const bad=ready();mutate(bad);const h=harness([bad,ready()]);await assert.rejects(api.acquireMatrixReadinessV4(h.ports));assert.equal(h.calls.length,1);
 }
});
test('SDK rejection, public error and malformed progress are never polled again',async()=>{
 for(const mutate of [x=>{x.progress.operation.status='rejected';},x=>{x.progress.error='SDK failure';},x=>{x.progress.extra=true;}]){
  const bad=ready();mutate(bad);const h=harness([bad,ready()]);await assert.rejects(api.acquireMatrixReadinessV4(h.ports));assert.equal(h.calls.length,1);
 }
});
test('original acquisition rejection is propagated without retry or invented sample',async()=>{
 const original=Error('actual acquisition failed'),h=harness([original,ready()]);
 await assert.rejects(api.acquireMatrixReadinessV4(h.ports),error=>error===original);assert.equal(h.calls.length,1);
 assert.equal(h.diagnostics.record.lastSample.summary,null);
});
test('a ready acquisition settling at the exact original deadline is rejected',async()=>{
 const h=harness([ready()],{sampleMs:4000});await assert.rejects(api.acquireMatrixReadinessV4(h.ports),/matrix-v4-readiness-deadline/);
 assert.equal(h.calls.length,1);assert.equal(h.diagnostics.record.lastSample.status,'fulfilled');
});
test('case remaining time bounds the same deadline without extending the 4000ms stage',async()=>{
 const h=harness([ready()],{caseRemaining:25,sampleMs:25});await assert.rejects(api.acquireMatrixReadinessV4(h.ports),/matrix-v4-readiness-deadline/);
 assert.deepEqual(h.calls,[['sample',25]]);
 const expired=harness([ready()],{caseRemaining:0});await assert.rejects(api.acquireMatrixReadinessV4(expired.ports),/matrix-v4-readiness-deadline/);assert.equal(expired.calls.length,0);
});
test('polls never restart the budget and expiry dispatches no subsequent sample',async()=>{
 const notReady=ready();notReady.dom.items=[];const h=harness(Array.from({length:100},()=>notReady));
 await assert.rejects(api.acquireMatrixReadinessV4(h.ports),/matrix-v4-readiness-deadline/);
 const samples=h.calls.filter(x=>x[0]==='sample');assert.equal(samples.length,79);assert.ok(samples.every((x,i)=>x[1]===4000-i*51));
 assert.equal(h.diagnostics.record.sampleAttempts,79);assert.equal(h.diagnostics.record.firstSamples.length,8);assert.equal(h.diagnostics.record.lastSample.attempt,79);
});
test('readiness validation time also consumes the same deadline',async()=>{
 const h=harness([ready()]);let reads=0;h.ports.now=()=>[0,1,4000][Math.min(reads++,2)];
 await assert.rejects(api.acquireMatrixReadinessV4(h.ports),/matrix-v4-readiness-deadline/);assert.equal(h.calls.length,1);
});
test('time after the original start acknowledgment cannot mint a fresh readiness budget',async()=>{
 const h=harness([ready()]);h.advance(725);await api.acquireMatrixReadinessV4(h.ports);assert.deepEqual(h.calls,[['sample',3275]]);
 const expired=harness([ready()]);expired.advance(4000);await assert.rejects(api.acquireMatrixReadinessV4(expired.ports),/matrix-v4-readiness-deadline/);assert.equal(expired.calls.length,0);
});
