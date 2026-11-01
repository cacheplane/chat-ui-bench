import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {closedData} from '../../competitors/shared/context.mjs';
import {historyPrefixCharacters} from './matrix-policy-v3.mjs';

const module = await import('./matrix-diagnostics-v1.mjs').catch(()=>({}));
const create = options => { assert.equal(typeof module.createMatrixDiagnostics,'function','bounded diagnostics recorder exists');return module.createMatrixDiagnostics(options); };
const sample = (text='secret body',status='pending') => ({progress:{schema:1,messageCount:1001,responseId:'r',responseCharacters:text.length,running:status==='pending',error:null,operation:{kind:'original-run-promise',status}},response:{id:'r',role:'assistant',text},dom:{clip:{left:0,top:0,right:10,bottom:20},scroll:{top:100,height:200,clientHeight:20},items:[{nativeId:'r',identityAttribute:'data-message-id',hitPoints:[0],visible:true,rect:{left:0,top:0,right:10,bottom:20},text}]}});
test('sample summaries retain first eight and actual terminal value before rejection, with Node-relative timing',()=>{
 let time=1000;const d=create({now:()=>time,origin:900});
 for(let i=0;i<30;i++){d.sampleDispatched('readiness');time+=5;d.sampleFulfilled(sample('secret body',i===29?'fulfilled':'pending'));}
 d.rejected(Error('matrix-active-history-phase'));
 const r=d.record;
 assert.equal(r.schema,'matrix-observer-diagnostics-v1');assert.equal(r.clock,'node-controller-performance.now-relative-to-case-start');
 assert.equal(r.performance,false);assert.equal(r.scoringEligibility,false);assert.equal(r.FPS,null);
 assert.equal(r.sampleAttempts,30);assert.equal(r.droppedSamples,21);assert.equal(r.firstSamples.length,8);assert.equal(r.lastSample.attempt,30);
 assert.equal(r.firstSamples[0].dispatchElapsedMs,100);assert.equal(r.firstSamples[0].fulfilledElapsedMs,105);
 assert.equal(r.lastSample.summary.progress.operationStatus,'fulfilled');assert.equal(r.terminalError.message,'matrix-active-history-phase');
 assert.equal(r.lastSample.summary.response.textChars,11);assert.ok(!JSON.stringify(r).includes('secret body'));
});
test('rejected acquisition retains prior actual sample and rejected terminal attempt without fabricating response',()=>{
 let time=30;const d=create({now:()=>time,origin:10});d.sampleDispatched('readiness');d.sampleFulfilled(sample());
 d.sampleDispatched('pre-wheel');time=40;const e=Error('original sample failure');d.rejected(e);
 assert.equal(d.record.lastSample.status,'rejected');assert.equal(d.record.lastSample.rejectedElapsedMs,30);assert.equal(d.record.lastSample.summary,null);
 assert.equal(d.record.firstSamples[0].summary.response.id,'r');assert.equal(d.record.lastSample.error,'original sample failure');
});
test('fixed-size hostile scalar, sample and stage data cannot retain raw payload or exceed finite byte bounds',()=>{
 let time=0;const d=create({now:()=>++time,origin:0});const huge='\u0000'.repeat(100000);
 for(let i=0;i<1000;i++){d.dispatched(huge);d.fulfilled();const s=sample(huge);s.progress.error=huge;s.progress.responseId=huge;s.response.id=huge;s.dom.clip={left:-Number.MAX_VALUE,top:Number.MIN_VALUE,right:Number.MAX_VALUE,bottom:Number.MIN_VALUE};s.dom.items[0].rect=s.dom.clip;s.dom.items=Array.from({length:50},()=>({...s.dom.items[0],nativeId:huge}));d.sampleDispatched(huge);d.sampleFulfilled(s);}
 d.rejected(Error(huge));
 assert.equal(d.record.stages.length,32);assert.equal(d.record.droppedStages,968);assert.equal(d.record.lastSample.summary.dom.items.length,32);
 assert.ok(Buffer.byteLength(JSON.stringify(d.record))<524288);assert.ok(Buffer.byteLength(JSON.stringify(d.failureRecord()))<60000);
 assert.ok(Buffer.byteLength(JSON.stringify({schema:'four-stack-matrix-failure-v3',id:'x'.repeat(128),status:'invalid',failure:{message:'\u0000'.repeat(4096)},unsafeOutstanding:false,transcripts:{initial:null,final:null,finalReadAttempted:true},observerDiagnostics:d.failureRecord(),performance:false,scoringEligibility:false,FPS:null}))<65536);
 assert.ok(!JSON.stringify(d.record).includes(huge));
});
test('stage markers record dispatch and fulfillment/rejection in controller clock only',()=>{
 let time=50;const d=create({now:()=>time,origin:40});d.dispatched('start');time=60;d.fulfilled();d.dispatched('response-id-wait');time=90;d.rejected(Error('timeout'));
 assert.deepEqual(d.record.stages.map(({name,dispatchElapsedMs,fulfilledElapsedMs,rejectedElapsedMs})=>({name,dispatchElapsedMs,fulfilledElapsedMs,rejectedElapsedMs})),[{name:'start',dispatchElapsedMs:10,fulfilledElapsedMs:20,rejectedElapsedMs:undefined},{name:'response-id-wait',dispatchElapsedMs:20,fulfilledElapsedMs:undefined,rejectedElapsedMs:50}]);
});

// Exact tools/competitor-comparison/matrix-run-v3.mjs bytes from public commit
// 4f0f2cfb068af660c030f4c9cfb9fed08f816f49, before diagnostics were added.
// Pin the authored source fixture so shallow checkouts retain the same baseline.
const baselineBytes=await fs.readFile(new URL('./fixtures/matrix-run-v3-pre-diagnostics.source.txt',import.meta.url));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'a2044a0924ec14bf01f94493501edfd2a19478bb9d408db38af7b73cf5a06cf5','exact pre-diagnostics baseline source');
const baseline=baselineBytes.toString('utf8');
const current=await fs.readFile(new URL('./matrix-run-v3.mjs',import.meta.url),'utf8');
test('runner persists diagnostics and captures sample before readiness validation',()=>{
 assert.ok(current.includes("import {createMatrixDiagnostics}"),'runner imports recorder');
 assert.ok(current.includes('evidence.observerDiagnostics=diagnostics.record;'));
 assert.ok(current.includes('observerDiagnostics:diagnostics.failureRecord()'));
 assert.match(current,/const sample=await currentSample\(\);\s*diagnostics.sampleFulfilled\(sample\);\s*try\{matrixStreamingReadiness/);
});
const admissionSource=await fs.readFile(new URL('./matrix-admission-v3.mjs',import.meta.url),'utf8');
// Execute the maintained pure validators without importing fixture/build/browser modules.
const realReadiness=new Function('closedData','historyPrefixCharacters','prose',`const contextFor=x=>x,need=(value,reason)=>{if(!value)throw Error('matrix-'+reason);},indexes=new WeakMap(),historyProse=new WeakMap(); ${admissionSource.slice(admissionSource.indexOf('function contextIndex'),admissionSource.indexOf('function validateSource')).replaceAll('export function','function')} return matrixStreamingReadiness;`)(closedData,historyPrefixCharacters,text=>text.replace(/[ \t\n\r\f\v]+/g,' ').replace(/^ | $/g,''));
const context={profile:'threadplane',history:Array.from({length:1000},(_,i)=>({id:'history-'+i,role:'user',text:'historical-'+i})),workload:{responseBytes:6400}};
async function exerciseLoop(source,states){
 const code=source.slice(source.indexOf('   const readyUntil='),source.indexOf('   evidence.wheelReadiness='));
 const calls=[];let time=0,index=0;const d=create({now:()=>time,origin:0});
 const currentSample=()=>{calls.push('sample');const value=states[index++];if(value instanceof Error)return Promise.reject(value);return Promise.resolve(value);};
 const validate=(context,progress,response,dom)=>{calls.push('validate:'+progress.operation.status);return realReadiness(context,progress,response,dom);};
 let error=null;
 try{await new Function('performance','STAGES','deadline','currentSample','matrixStreamingReadiness','source','message','wait','page','diagnostics','sampleStage',`return (async()=>{${code}})();`)({now:()=>time},{readiness:1000,progress:1000},{remaining:()=>1000},currentSample,validate,{publicContext:context},e=>e.message,p=>p,{waitForTimeout:()=>{calls.push('poll');time+=50;return Promise.resolve();}},d,'readiness');}catch(e){d.rejected(e);error=e.message;}
 return {calls,error,record:d.record};
}
test('source-owned readiness loop keeps exact call/poll/error behavior for transient, completed and acquisition failure',async()=>{
 for(const states of [[sample('x'.repeat(512))],[{...sample(),response:null},sample('x'.repeat(512))],[sample('x','fulfilled')],[{...sample(),response:null},sample('x','fulfilled')],[sample('x','rejected')],[{...sample(),progress:{...sample().progress,error:'actual SDK error'}}],[Error('actual-acquisition-failed')],Array.from({length:20},()=>({...sample(),response:null}))]){
  const before=await exerciseLoop(baseline,states),after=await exerciseLoop(current,states);
  assert.deepEqual(after.calls,before.calls);assert.equal(after.error,before.error);
  assert.equal(after.record.sampleAttempts,after.calls.filter(c=>c==='sample').length);
  if(after.error==='matrix-active-history-phase')assert.equal(after.record.lastSample.summary.progress.operationStatus,'fulfilled');
  if(after.error==='actual-acquisition-failed')assert.equal(after.record.lastSample.status,'rejected');
 }
});

test('removing synchronous diagnostic statements leaves original acquisition/validation/cleanup source unchanged',()=>{
 const stripped=current
  .replace(/^import \{createMatrixDiagnostics\}.*\n/m,'')
  .replace(/^ const diagnostics=createMatrixDiagnostics.*\n/m,'')
  .replace(/^ evidence\.observerDiagnostics=diagnostics\.record;\n/m,'')
  .replace(/^\s*diagnostics\.(?:dispatched|fulfilled|sampleDispatched|sampleFulfilled)\([^\n]*\);\n/gm,'\n')
  .replace('diagnostics.terminal(error);','')
  .replace('diagnostics.rejected(error);','')
  .replace('}catch(error){diagnostics.stageRejected(error);throw error;}','}')
  .replace('observerDiagnostics:diagnostics.failureRecord(),','')
  .replace(/const wheelFinally=await currentSample\(\);\s*evidence\.domAfterWheel=wheelFinally\.dom;/,'evidence.domAfterWheel=(await currentSample()).dom;');
 assert.equal(stripped.replace(/\s+/g,''),baseline.replace(/\s+/g,''));
});

test('nested movement rejection records actual error without changing eventual terminal precedence',()=>{
 let time=0;const d=create({now:()=>time,origin:0});d.dispatched('wheel-upward-movement');time=15;
 assert.equal(typeof d.stageRejected,'function');d.stageRejected(Error('original movement rejection'));
 d.dispatched('wheel-event-completion');time=20;d.rejected(Error('finally error wins'));
 assert.equal(d.record.stages[0].status,'rejected');assert.equal(d.record.stages[0].error,'original movement rejection');
 assert.equal(d.record.terminalError.message,'finally error wins');
});

test('independent callback failure never mislabels an in-flight successful sample as rejected',()=>{
 const d=create({now:()=>1,origin:0});d.sampleDispatched('readiness');
 assert.equal(typeof d.terminal,'function');d.terminal(Error('matrix-network-cap'));d.sampleFulfilled(sample());
 assert.equal(d.record.lastSample.status,'fulfilled');assert.equal(d.record.terminalError.message,'matrix-network-cap');
});

test('final pre-wheel one-shot retains actual rejected readiness sample without any extra calls',async()=>{
 async function exercise(source,value){
  const start=source.indexOf('   await ticks();',source.indexOf('   evidence.wheelReadiness='));
  const code=source.slice(start,source.indexOf('   const seek=',start));
  const calls=[],evidence={},d=create({now:()=>10,origin:0});let error;
  try{await new Function('ticks','currentSample','evidence','source','matrixStreamingReadiness','diagnostics',`return (async()=>{${code}})();`)(()=>{calls.push('ticks');return Promise.resolve();},()=>{calls.push('sample');return value instanceof Error?Promise.reject(value):Promise.resolve(value);},evidence,{publicContext:context},realReadiness,d);}catch(e){d.rejected(e);error=e.message;}
  return {calls,error,record:d.record};
 }
 const missing=sample('x'.repeat(576));missing.dom.items=[{...missing.dom.items[0],nativeId:'history-999',text:'historical-999'}];
 for(const value of [missing,sample('x','fulfilled'),Error('pre-wheel rejected')]){
  const before=await exercise(baseline,value),after=await exercise(current,value);
  assert.deepEqual(after.calls,before.calls);assert.equal(after.error,before.error);assert.deepEqual(after.calls,['ticks','sample']);
  assert.equal(after.record.lastSample.stage,'pre-wheel');
  if(!(value instanceof Error)){assert.equal(after.record.lastSample.summary.response.textChars,value.response.text.length);assert.equal(after.record.lastSample.summary.dom.items[0].nativeId,value.dom.items[0].nativeId);}
  else assert.equal(after.record.lastSample.status,'rejected');
 }
});

test('native wheel finally keeps original error precedence and operation order on success and both failure paths',async()=>{
 async function exercise(source,{movementError=false,finallyError=false}){
  const start=source.indexOf('   const originalWheel='),end=source.indexOf('   const afterWheelResponse=',start),code=source.slice(start,end);
  const calls=[],d=create({now:()=>1,origin:0}),evidence={scroll:{nativeDispatch:false,beforeTop:100}},events=[{trusted:true,defaultPrevented:false,deltaY:-10}],value=sample('x'.repeat(512));let error;
  const page={mouse:{wheel:()=>{calls.push('wheel');return Promise.resolve();}},waitForFunction:()=>{calls.push('movement');return movementError?Promise.reject(Error('movement-failed')):Promise.resolve();}};
  try{await new Function('page','seek','wait','STAGES','deadline','selectors','evidence','poll','evaluate','requireMatrixWheelDelivery','currentSample','ticks','diagnostics',`return(async()=>{${code}})();`)(page,{deltaY:-10},p=>p,{nativeMovement:100},{remaining:()=>100},{scroller:'.scroller'},evidence,()=>{calls.push('event-poll');return finallyError?Promise.reject(Error('finally-failed')):Promise.resolve();},()=>{calls.push('events');return Promise.resolve(events);},()=>calls.push('validate-wheel'),()=>{calls.push('sample');return Promise.resolve(value);},()=>{calls.push('ticks');return Promise.resolve();},d);}catch(e){d.rejected(e);error=e.message;}
  return{calls,error};
 }
 for(const options of [{},{movementError:true},{movementError:true,finallyError:true},{finallyError:true}])assert.deepEqual(await exercise(current,options),await exercise(baseline,options));
});

test('every bounded string and selected-item collection truthfully reports original size and truncation',()=>{
 const d=create({now:()=>1,origin:0});
 for(const length of [32,33,48,49,64,65,128,129,256,257]){
  const raw='z'.repeat(length),s=sample();s.response.id=raw;s.progress.responseId=raw;s.progress.error=raw;s.progress.operation.status=raw;s.dom.items[0].nativeId=raw;
  d.dispatched(raw);d.stageRejected(Error(raw));d.sampleDispatched(raw);d.sampleFulfilled(s);
  const summary=d.record.lastSample.summary;
  for(const [object,key,limit] of [[summary.response,'id',64],[summary.progress,'responseId',64],[summary.progress,'error',128],[summary.progress,'operationStatus',32],[summary.dom.items[0],'nativeId',64],[d.record.lastSample,'stage',48],[d.record.stages.at(-1),'name',48],[d.record.stages.at(-1),'error',128]]){
   assert.equal(object[key+'Chars'],length);assert.equal(object[key+'Truncated'],length>limit);assert.equal(object[key].length,Math.min(length,limit));
  }
  const rejected=create({now:()=>1,origin:0});rejected.sampleDispatched(raw);rejected.rejected(Error(raw));assert.equal(rejected.record.lastSample.errorChars,length);assert.equal(rejected.record.lastSample.errorTruncated,length>128);
 }
 for(const length of [32,33]){const s=sample();s.dom.items=Array.from({length},()=>s.dom.items[0]);d.sampleDispatched('readiness');d.sampleFulfilled(s);assert.equal(d.record.lastSample.summary.dom.itemsObserved,length);assert.equal(d.record.lastSample.summary.dom.itemsOmitted,length-32);}
 d.terminal(Error('e'.repeat(257)));assert.equal(d.record.terminalError.messageChars,257);assert.equal(d.record.terminalError.messageTruncated,true);
 assert.deepEqual(d.record.previewLimits,{units:'UTF-16-code-units',id:64,error:128,label:48,operationStatus:32,selectedItems:32});
});

test('stage retention keeps first31 plus actual latest after the 32-row cap',()=>{
 let time=0;const d=create({now:()=>++time,origin:0});
 for(let i=1;i<=40;i++){d.dispatched('stage-'+i);d.fulfilled();}
 assert.equal(d.record.stages.length,32);assert.deepEqual(d.record.stages.slice(0,31).map(row=>row.name),Array.from({length:31},(_,i)=>'stage-'+(i+1)));
 assert.equal(d.record.stages[31].name,'stage-40');assert.equal(d.record.stages[31].status,'fulfilled');assert.equal(d.record.droppedStages,8);
 assert.equal(d.failureRecord().lastStage.name,'stage-40');
});

test('worst escaped terminal diagnostics plus original 4096-character failure and two wide refs fit unchanged 64KiB reserve',t=>{
 const control='\u0000'.repeat(100000),extreme=Number.MAX_VALUE,d=create({now:()=>extreme,origin:0}),s=sample(control);
 s.progress.responseId=control;s.progress.error=control;s.progress.operation.status=control;s.progress.messageCount=extreme;s.progress.responseCharacters=-extreme;
 s.response.id=control;s.dom.clip={left:-extreme,top:Number.MIN_VALUE,right:extreme,bottom:-Number.MIN_VALUE};s.dom.scroll={top:-extreme,height:extreme,clientHeight:Number.MIN_VALUE};
 s.dom.items=Array.from({length:33},()=>({nativeId:control,visible:false,rect:s.dom.clip,text:control}));
 for(let i=0;i<40;i++){d.dispatched(control);d.stageRejected(Error(control));}
 for(let i=0;i<9;i++){d.sampleDispatched(control);d.sampleFulfilled(s);}
 d.terminal(Error(control));
 const ref={path:'\u0000'.repeat(257),bytes:16777216,sha256:'\u0000'.repeat(64)};
 const envelope={schema:'four-stack-matrix-failure-v3',id:'\u0000'.repeat(128),status:'invalid',failure:{message:'\u0000'.repeat(4096)},unsafeOutstanding:false,transcripts:{initial:ref,final:ref,finalReadAttempted:true},observerDiagnostics:d.failureRecord(),performance:false,scoringEligibility:false,FPS:null};
 const fullBytes=Buffer.byteLength(JSON.stringify(d.record)),failureBytes=Buffer.byteLength(JSON.stringify(envelope));
 t.diagnostic(`Full bounded record ${fullBytes}/524288 bytes; failure envelope ${failureBytes}/65536 bytes (${65536-failureBytes} spare).`);
 assert.ok(fullBytes<524288);assert.ok(failureBytes<65536);
});
