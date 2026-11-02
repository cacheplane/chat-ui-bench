import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';
import {acquireMatrixReadinessV4} from './matrix-readiness-v4.mjs';
import {nativeHistorySeekV4 as nativeHistorySeek,MATRIX_V4_ACQUISITION} from './matrix-policy-v4.mjs';
import {matrixStreamingReadiness,validateMatrixReadinessSample} from './matrix-admission-v4.mjs';
const source=await readFile(new URL('./matrix-run-v4.mjs',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return'';throw error;});
const baseline=await readFile(new URL('./matrix-run-v3.mjs',import.meta.url),'utf8');
const context={schema:2,profile:'vercel-ai-sdk',threadId:'thread',runId:'run',canonicalResponseId:'response',history:Array.from({length:100},(_,i)=>({id:`history-${i}`,role:i%2?'user':'assistant',text:String(i).padEnd(512,'x')})),workload:{seed:1,historyCount:100,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey:'history-reading'},digests:{sourceSha256:'0'.repeat(64),historySha256:'1'.repeat(64),responseSha256:'2'.repeat(64)}};
const sample=()=>({schema:'matrix-current-sample-v3',response:{id:'native-response',role:'assistant',text:'R'.repeat(512)},progress:{schema:1,messageCount:101,responseId:'native-response',responseCharacters:512,running:true,error:null,operation:{kind:'original-run-promise',status:'pending'}},dom:{schema:'matrix-dom-selected-v3',errors:[],clip:{left:0,top:0,right:1280,bottom:720},scroll:{top:1000,height:2000,clientHeight:720},items:[{nativeId:'native-response',identityAttribute:'data-message-id',text:'R'.repeat(512),visible:true,rect:{left:100,top:400,right:900,bottom:700},hitPoints:[12]}]}});
function flow(samples,options={}){
 const start=source.indexOf('  let historyPointer=null;'),end=source.indexOf("   diagnostics.dispatched('single-wheel-dispatch-ack');",start);
 assert.ok(start>=0&&end>start,'actual maintained v4 history flow exists');
 const names=['page','evidence','selectors','wait','evaluate','diagnostics','performance','journey','deadline','source','acquireMatrixReadinessV4','currentSample','ticks','matrixStreamingReadiness','validateMatrixReadinessSample','nativeHistorySeek','STAGES','installMatrixWheelRecorder','poll','progress'];
 const factory=new Function(...names,`return (async()=>{let runStarted,runOriginal,runSettledAt;${source.slice(start,end)}\n } return evidence;})();`);
 const calls=[],evidence={domInitial:{clip:{left:0,top:0,right:1280,bottom:720}},capabilities:{scrollPolicy:options.turn?'turn-anchoring':'bottom-follow'}},window={competitorBench:{start:()=>{calls.push('start');},waitForRun:()=>{calls.push('run');return Promise.resolve();}}};
 const page={mouse:{move:async()=>{calls.push('move');if(options.moveError)throw options.moveError;}},evaluate:async callback=>{calls.push('run-dispatch');return callback();},waitForTimeout:async()=>{calls.push('poll');}};
 const evaluate=async callback=>{const text=callback.toString();if(text.includes('competitorBench.start'))return window.competitorBench.start();if(text.includes('matrix-native-scroll-not-settled')){calls.push('stability');return{};}calls.push('recorder');};
 // waitForRun's callback has a browser-global reference, as in the actual runner.
 page.evaluate=async callback=>{calls.push('run-dispatch');assert.match(callback.toString(),/competitorBench.waitForRun/);return window.competitorBench.waitForRun();};
 const now=()=>100,diagnostics=createMatrixDiagnostics({now,origin:0}),currentSample=async()=>{calls.push('sample');return samples.shift();};
 const promise=factory(page,evidence,{scroller:'.scroller'},async original=>original,evaluate,diagnostics,{now},'history-reading',{remaining:()=>100000},{publicContext:context},acquireMatrixReadinessV4,currentSample,async()=>{calls.push('ticks');if(options.tickError)throw options.tickError;},matrixStreamingReadiness,validateMatrixReadinessSample,nativeHistorySeek,{progress:10000,turnStability:2000},()=>{},()=>{throw Error('redundant poll');},()=>{throw Error('redundant progress');});
 return{promise,calls,evidence};
}
test('v4 has separate acquisition identities and exactly one original native wheel',()=>{
 assert.match(source,/four-stack-matrix-invocation-v4/);assert.match(source,/four-stack-matrix-evidence-v4/);assert.match(source,/four-stack-matrix-case-v4/);assert.match(source,/four-stack-matrix-failure-v4/);
 assert.equal((source.match(/page\.mouse\.wheel\(/g)??[]).length,1);assert.ok((source.match(/acquisition:MATRIX_V4_ACQUISITION/g)??[]).length>=4);
 assert.match(source,/protocol:'matrix-v3'/);assert.match(source,/createMatrixSampleEvaluator/);
});
test('actual history flow prepares pointer and recorder before one start and fresh post-ticks readiness',async()=>{
 const h=flow([sample(),sample()],{turn:true});await h.promise;
 assert.deepEqual(h.calls,['move','recorder','start','run-dispatch','run','sample','stability','ticks','sample']);
 assert.equal(h.evidence.scroll.policy,'visible-response-below-viewport-one-response-headroom-v4');
 assert.equal(h.evidence.streamingProgress.operation.status,'pending');
});
test('prepared pointer failure prevents starting the original operation',async()=>{
 const original=Error('pointer failed'),h=flow([sample()],{moveError:original});await assert.rejects(h.promise,error=>error===original);assert.deepEqual(h.calls,['move']);
});
test('completion during ticks is rejected by final fresh sample with no fallback retry',async()=>{
 const completed=sample();Object.assign(completed.progress,{running:false,operation:{kind:'original-run-promise',status:'fulfilled'}});const h=flow([sample(),completed,sample()]);
 await assert.rejects(h.promise,/matrix-active-history-phase/);assert.equal(h.calls.filter(x=>x==='sample').length,2);
});
test('changed clip cannot silently recenter the already prepared pointer',async()=>{
 const shifted=sample();shifted.dom.clip={left:900,top:0,right:1280,bottom:720};shifted.dom.items[0].rect={left:910,top:400,right:1200,bottom:700};const h=flow([sample(),shifted]);
 await assert.rejects(h.promise,/matrix-pointer-left-clip/);assert.equal(h.calls.filter(x=>x==='move').length,1);
});
test('stability/ticks errors propagate before a final read or wheel',async()=>{
 const original=Error('actual tick error'),h=flow([sample(),sample()],{tickError:original});await assert.rejects(h.promise,error=>error===original);assert.equal(h.calls.filter(x=>x==='sample').length,1);
});
test('all original movement, anchor, return, full content, source and closure operations remain byte-identical',()=>{
 const marker='   const originalWheel=page.mouse.wheel',end='export async function runMatrixInvocation';
 const before=baseline.slice(baseline.indexOf(marker),baseline.indexOf(end));
 const after=source.slice(source.indexOf(marker),source.indexOf(end)).replaceAll(',acquisition:MATRIX_V4_ACQUISITION','').replaceAll('four-stack-matrix-case-v4','four-stack-matrix-case-v3').replaceAll('four-stack-matrix-failure-v4','four-stack-matrix-failure-v3');
 assert.ok(before.length>9000);assert.equal(after,before);
});
test('versioned failure identity and hostile terminal diagnostics fit the unchanged 64KiB reserve',t=>{
 const raw='\u0000'.repeat(100000),extreme=Number.MAX_VALUE,d=createMatrixDiagnostics({now:()=>extreme,origin:0}),s=sample();
 Object.assign(s.progress,{responseId:raw,error:raw,messageCount:extreme,responseCharacters:-extreme,operation:{status:raw}});s.response.id=raw;
 s.dom.clip={left:-extreme,top:Number.MIN_VALUE,right:extreme,bottom:-Number.MIN_VALUE};s.dom.scroll={top:-extreme,height:extreme,clientHeight:Number.MIN_VALUE};
 s.dom.items=Array.from({length:33},()=>({nativeId:raw,visible:false,rect:s.dom.clip,text:raw}));
 for(let i=0;i<40;i++){d.dispatched(raw);d.stageRejected(Error(raw));}
 for(let i=0;i<9;i++){d.sampleDispatched(raw);d.sampleFulfilled(s);}d.terminal(Error(raw));
 const ref={path:'\u0000'.repeat(257),bytes:16777216,sha256:'\u0000'.repeat(64)};
 const envelope={schema:'four-stack-matrix-failure-v4',acquisition:MATRIX_V4_ACQUISITION,id:'\u0000'.repeat(128),status:'invalid',failure:{message:'\u0000'.repeat(4096)},unsafeOutstanding:false,transcripts:{initial:ref,final:ref,finalReadAttempted:true},observerDiagnostics:d.failureRecord(),performance:false,scoringEligibility:false,FPS:null};
 const bytes=Buffer.byteLength(JSON.stringify(envelope));t.diagnostic(`Complete v4 failure envelope ${bytes}/65536 bytes.`);assert.ok(bytes<65536);
});
