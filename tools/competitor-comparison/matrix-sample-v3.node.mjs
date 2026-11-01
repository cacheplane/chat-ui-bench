import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {observeMatrixDOM} from './matrix-observer-v3.mjs';
import {createMatrixCase} from './matrix-fixtures-v3.mjs';
import {matrixStreamingReadiness} from './matrix-admission-v3.mjs';

const context=createMatrixCase({profile:'vercel-ai-sdk',historyCount:100,responseBytes:6400,journey:'history-reading'}).publicContext;
const selectors={scroller:'#scroll',message:'.message',messageContent:'.content'};
const sampler=async()=>{
 const api=await import('./matrix-sample-v3.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
 assert.equal(typeof api.createMatrixSampleEvaluator,'function');return api.createMatrixSampleEvaluator();
};
async function setup(page){
 await page.setContent('<style>body{margin:0}#scroll{height:300px;width:700px;overflow:auto}.message{min-height:200px}.content{white-space:pre-wrap}</style><div id="scroll"><div class="message" data-message-id="actual"><div class="content"></div></div></div>');
 await page.evaluate(()=>{
  window.counts={response:0,progress:0,full:0,dom:0};window.didAdvance=false;
  const originalQuery=document.querySelectorAll.bind(document);document.querySelectorAll=selector=>{if(selector==='#scroll')window.counts.dom++;return originalQuery(selector);};
  const state={text:'a'.repeat(544)};document.querySelector('.content').textContent=state.text;
  const advance=()=>{state.text+='b'.repeat(32);document.querySelector('.content').textContent=state.text;window.didAdvance=true;};
  window.competitorBench={
   read(){window.counts.full++;throw Error('forbidden full transcript read');},
   readResponse(){window.counts.response++;return{id:'actual',role:'assistant',text:state.text};},
   readProgress(){window.counts.progress++;setTimeout(advance,0);return{schema:1,messageCount:101,responseId:'actual',responseCharacters:state.text.length,running:true,error:null,operation:{kind:'original-run-promise',status:'pending'}};},
  };
 });
}
async function withPage(callback){const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:900,height:600}});await setup(page);await callback(page);}finally{await browser.close();}}

test('cross-task544-to576 source advancement rejects the old separated observation',async()=>{
 await withPage(async page=>{
  const response=await page.evaluate(()=>window.competitorBench.readResponse());const progress=await page.evaluate(()=>window.competitorBench.readProgress());
  await page.waitForFunction(()=>window.didAdvance);
  const dom=await page.evaluate(observeMatrixDOM,{selectors,responseId:progress.responseId,maxResponseCharacters:6400});
  assert.equal(response.text.length,544);assert.equal(progress.responseCharacters,544);assert.equal(dom.items[0].text.length,576);
  assert.throws(()=>matrixStreamingReadiness(context,progress,response,dom),/streaming-response-not-ready/);
  assert.deepEqual(await page.evaluate(()=>window.counts),{response:1,progress:1,full:0,dom:1});
 });
});
test('closure-free synchronous sample reads actual SDK and selected DOM once before queued source task',async()=>{
 const evaluate=await sampler();assert.equal(evaluate.constructor.name,'Function');
 await withPage(async page=>{
  const sample=await page.evaluate(evaluate,{selectors,maxResponseCharacters:6400});
  assert.deepEqual(Object.keys(sample).sort(),['dom','progress','response','schema']);assert.equal(sample.schema,'matrix-current-sample-v3');
  assert.equal(sample.response.text.length,544);assert.equal(sample.progress.responseCharacters,544);assert.equal(sample.dom.items[0].text.length,544);
  const readiness=matrixStreamingReadiness(context,sample.progress,sample.response,sample.dom);assert.equal(readiness.responseId,'actual');assert.deepEqual(readiness.responseRect,sample.dom.items[0].rect);
  assert.deepEqual(await page.evaluate(()=>window.counts),{response:1,progress:1,full:0,dom:1});
  await page.waitForFunction(()=>window.didAdvance);assert.equal(await page.evaluate(()=>document.querySelector('.content').textContent.length),576);
 });
});
test('atomic sample retains unrelated DOM rejection and genuine SDK-render lag',async()=>{
 const evaluate=await sampler();
 await withPage(async page=>{
  await page.evaluate(()=>{document.querySelector('.content').textContent='unrelated'.repeat(70);});
  const unrelated=await page.evaluate(evaluate,{selectors,maxResponseCharacters:6400});assert.throws(()=>matrixStreamingReadiness(context,unrelated.progress,unrelated.response,unrelated.dom),/streaming-response-not-ready/);
 });
 await withPage(async page=>{
  await page.evaluate(()=>{document.querySelector('.content').textContent='a'.repeat(512);});
  const lagged=await page.evaluate(evaluate,{selectors,maxResponseCharacters:6400});assert.equal(lagged.response.text.length,544);assert.equal(lagged.dom.items[0].text.length,512);assert.equal(matrixStreamingReadiness(context,lagged.progress,lagged.response,lagged.dom).visible,true);
 });
});
