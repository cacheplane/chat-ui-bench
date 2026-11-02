import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {observeMatrixDOM} from './matrix-observer-v3.mjs';
import {createMatrixScalarClassifierV5} from './matrix-readiness-scalars-v5.mjs';
import {validateMatrixReadinessSample,matrixStreamingReadiness} from './matrix-admission-v4.mjs';
const api=await import('./matrix-readiness-browser-v5.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const metadata={profile:'vercel-ai-sdk',historyCount:100,responseBytes:6400,historicalIds:Array.from({length:100},(_,i)=>'h'+i)};
const selectors={scroller:'#scroll',message:'.message',messageContent:'.content'};
const options=()=>({metadata:structuredClone(metadata),selectors,maxResponseCharacters:6400,browserBudgetMs:4000,phase:'initial',observationAllowance:80});
const rect={left:0,top:0,right:100,bottom:100};
const item=(text='R'.repeat(512),nativeId='actual')=>({nativeId,identityAttribute:nativeId===null?null:'data-message-id',text,visible:true,rect:{...rect},hitPoints:[0]});
function state(n=512,items=[item()]){return {response:{id:'actual',role:'assistant',text:'R'.repeat(n)},progress:{schema:1,messageCount:101,responseId:'actual',responseCharacters:n,running:true,error:null,operation:{kind:'original-run-promise',status:'pending'}},items};}
const context=()=>({schema:2,profile:metadata.profile,threadId:'thread',runId:'run',canonicalResponseId:'canonical',history:metadata.historicalIds.map((id,i)=>({id,role:i%2?'user':'assistant',text:String(i).padEnd(512,'x')})),workload:{seed:1,historyCount:100,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey:'history-reading'},digests:{sourceSha256:'0'.repeat(64),historySha256:'1'.repeat(64),responseSha256:'2'.repeat(64)}});
async function harness(states,{input=options(),origin=1000000,setup='',postWorkMs=0}={}){
 assert.equal(typeof api.createMatrixBrowserReadinessEvaluatorV5,'function');
 const scope=vm.createContext({TextEncoder,serialized:JSON.stringify({states,input,origin,postWorkMs})});
 vm.runInContext(`
  var config=JSON.parse(serialized),states=config.states,input=config.input,time=config.origin,index=0,current=states[0],log=[],timerCount=0,maxTimers=0,cleared=0,pending=new Set(),serial=0;
  var performance={now:()=>time};
  var setTimeout=(fn,ms)=>{const id=++serial;pending.add(id);timerCount++;maxTimers=Math.max(maxTimers,pending.size);log.push(['timer',ms]);Promise.resolve().then(()=>{if(pending.has(id)){time+=ms;fn();}});return id;};
  var clearTimeout=id=>{if(pending.delete(id))cleared++;};
  var window={competitorBench:{
   readResponse(){current=states[Math.min(index++,states.length-1)];log.push('response');time+=current.responseMs??0;if(current.throwResponse)throw Error(current.throwResponse);return current.response;},
   readProgress(){log.push('progress');time+=current.progressMs??0;Promise.resolve().then(()=>log.push('source-task'));if(current.throwProgress)throw Error(current.throwProgress);return current.progress;}
  }};
  var innerWidth=100,innerHeight=100,CSS={escape:x=>x};
  class HTMLElement{};
  var roots=[];
  class Root extends HTMLElement {
   constructor(row){super();this.row=row;}
   closest(){return this;}
   checkVisibility(){return this.row.visible;}
   getBoundingClientRect(){return this.row.rect;}
   hasAttribute(name){return this.row.nativeId!==null&&name===this.row.identityAttribute;}
   getAttribute(){return this.row.nativeId;}
   matches(){return true;}
   get textContent(){return this.row.text;}
  }
  var scroller=new HTMLElement();Object.assign(scroller,{scrollTop:1000,scrollHeight:2000,clientHeight:100,clientWidth:100,clientLeft:0,clientTop:0,contains:r=>roots.includes(r),getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:100,x:0,y:0,width:100,height:100}),querySelectorAll:()=>roots});
  var document={
   querySelectorAll(selector){log.push('dom');time+=config.postWorkMs;roots=current.items.map(row=>new Root(row));return current.missingScroller?[]:[scroller];},
   querySelector(selector){return roots.find(root=>selector.includes('="'+root.row.nativeId+'"'))??null;},
   elementFromPoint(x){return roots.length?roots[Math.min(roots.length-1,Math.floor(x/100*roots.length))]:null;}
  };
 `,scope);
 if(setup)vm.runInContext(setup,scope);
 scope.evaluate=vm.runInContext('('+api.createMatrixBrowserReadinessEvaluatorV5().toString()+')',scope);
 const result=await vm.runInContext('evaluate(input)',scope);
 return {result:JSON.parse(JSON.stringify(result)),log:JSON.parse(JSON.stringify(scope.log)),scope,pending:scope.pending.size,maxTimers:scope.maxTimers,cleared:scope.cleared,time:scope.time};
}
const receipt=result=>{const {sample,terminalMessage,...rest}=result;return rest;};
test('actual closure-free evaluator embeds identical observer and classifier bytes',async()=>{
 assert.equal(typeof api.createMatrixBrowserReadinessEvaluatorV5,'function');
 const callback=api.createMatrixBrowserReadinessEvaluatorV5(),source=callback.toString();
 assert.ok(source.includes(observeMatrixDOM.toString()));assert.ok(source.includes(createMatrixScalarClassifierV5.toString()));
 const h=await harness([state()]);assert.equal(h.result.outcome,'candidate');assert.equal(h.result.observationCount,1);assert.equal(h.result.sample.dom.items[0].text.length,512);
 assert.equal(h.result.sampleObservation,h.result.observationCount);
 assert.deepEqual(h.log.slice(0,3),['response','progress','dom']);assert.ok(h.log.indexOf('source-task')>h.log.indexOf('dom'));assert.equal(h.maxTimers,0);
 assert.equal(h.result.performance,false);assert.equal(h.result.scoringEligibility,false);assert.equal(h.result.FPS,null);
 assert.equal(h.result.clock.label,'document-browser-performance');assert.equal(h.result.clock.startedMs,1000000);
 validateMatrixReadinessSample(context(),h.result.sample);matrixStreamingReadiness(context(),h.result.sample.progress,h.result.sample.response,h.result.sample.dom);
});
test('prefix gate skips every DOM read until valid SDK prefix and preserves one read of each scalar',async()=>{
 const absent=state();absent.response=null;Object.assign(absent.progress,{messageCount:100,responseId:null,responseCharacters:null});
 const h=await harness([absent,state(1),state()]);assert.equal(h.result.outcome,'candidate');assert.equal(h.result.observationCount,3);
 assert.deepEqual(h.log.filter(x=>typeof x==='string'&&x!=='source-task'),['response','progress','response','progress','response','progress','dom']);
 assert.deepEqual(h.log.filter(Array.isArray),[['timer',50],['timer',50]]);assert.equal(h.pending,0);assert.equal(h.maxTimers,1);assert.equal(h.cleared,2);
 assert.deepEqual(h.result.firstObservations.map(x=>x.domAcquired),[false,false,true]);
});
test('actual evaluator honors every fixed profile/H/R scalar policy and exact 512/20976 prefixes',async()=>{
 for(const profile of ['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'])for(const historyCount of [100,1000,10000])for(const responseBytes of [6400,262144]){
  const minimum=responseBytes===6400?512:20976,m={profile,historyCount,responseBytes,historicalIds:Array.from({length:historyCount},(_,i)=>'h'+i)};
  const short=state(minimum-1),ready=state(minimum,[item('R'.repeat(minimum))]);
  for(const s of [short,ready]){s.progress.messageCount=historyCount+1;s.progress.operation.kind=profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise';}
  const h=await harness([short,ready],{input:{...options(),metadata:m,maxResponseCharacters:responseBytes}});
  assert.equal(h.result.outcome,'candidate');assert.equal(h.result.observationCount,2);assert.equal(h.result.sample.dom.items[0].text.length,minimum);assert.equal(h.log.filter(x=>x==='dom').length,1);
 }
});
test('DOM lag alone may poll locally and final phase retains the same bounded behavior',async()=>{
 const h=await harness([state(512,[]),state()],{input:{...options(),phase:'final',observationAllowance:2,browserBudgetMs:100}});
 assert.equal(h.result.outcome,'candidate');assert.equal(h.result.phase,'final');assert.equal(h.result.observationCount,2);assert.equal(h.result.clock.endedMs-h.result.clock.startedMs,50);
});
test('all coarse matches return full actual sample; only V4 decides identity and ambiguity',async()=>{
 for(const items of [[item('R'.repeat(512),'other')],[item('R'.repeat(512),null),item('R'.repeat(512),'actual')]]){
  const h=await harness([state(600,items)]);assert.equal(h.result.outcome,'candidate');assert.equal(h.result.sample.dom.items.length,items.length);assert.equal(h.result.observationCount,1);
  assert.throws(()=>matrixStreamingReadiness(context(),h.result.sample.progress,h.result.sample.response,h.result.sample.dom),/matrix-streaming-response-not-ready/);
 }
 const h=await harness([state(600,[item('R'.repeat(512),'h0'),item('R'.repeat(600),'actual')])]);
 const c=context();c.history[0].text='R'.repeat(512);validateMatrixReadinessSample(c,h.result.sample);
 assert.equal(matrixStreamingReadiness(c,h.result.sample.progress,h.result.sample.response,h.result.sample.dom).domCharacters,600);
});
test('malformed scalars, completed state and actual SDK throws are terminal before any DOM or later read',async()=>{
 const cases=[x=>x.progress.error='SDK',x=>x.progress.operation.status='rejected',x=>{x.progress.running=false;x.progress.operation.status='fulfilled';},x=>x.progress.extra=true,x=>x.response.role='user',x=>x.response.id='wrong',x=>x.response.text=null,x=>x.throwResponse='actual response throw',x=>x.throwProgress='actual progress throw'];
 for(const mutate of cases){const bad=state(1);mutate(bad);const h=await harness([bad,state()]);assert.equal(h.result.outcome,'rejected');assert.equal(h.result.observationCount,1);assert.equal(h.log.includes('dom'),false);assert.equal(h.maxTimers,0);assert.equal(h.result.sample,null);assert.ok(h.result.terminalCode);assert.ok(h.result.terminalMessage);}
 const h=await harness([state(1),state()],{setup:"Object.defineProperty(states[0].response,'text',{get(){throw Error('must not invoke getter')},enumerable:true});"});
 assert.equal(h.result.terminalMessage,'competitor-own-data');assert.equal(h.result.sample,null);
});
test('terminal code requires a full exact match while actual newline messages remain intact',async()=>{
 for(const message of ['matrix-code\n','competitor-code\n']){
  const bad=state();bad.throwResponse=message;const h=await harness([bad]);
  assert.equal(h.result.outcome,'rejected');assert.equal(h.result.terminalCode,'matrix-v5-browser-acquisition');
  assert.equal(h.result.terminalMessage,message);assert.deepEqual(h.result.errorPreview,{text:message,trueCharacters:message.length,truncated:false});
  assert.equal(h.result.observationCount,1);assert.equal(h.result.sample,null);assert.equal(h.log.includes('dom'),false);
 }
});
test('observer and geometry/identity errors are terminal after actual DOM acquisition',async()=>{
 for(const mutate of [x=>x.missingScroller=true,x=>x.items[0].rect.right=-1,x=>x.items[0].nativeId='',x=>x.items[0].text='Z'.repeat(6401),x=>x.items.push(item())]){
  const bad=state();mutate(bad);const h=await harness([bad,state()]);assert.equal(h.result.outcome,'rejected');assert.equal(h.result.observationCount,1);assert.ok(h.result.sample);assert.equal(h.result.lastObservation.domAcquired,true);assert.equal(h.maxTimers,0);
 }
});
test('structural validator retains exact V4 selectedDOM body and negative/error precedence',()=>{
 assert.equal(typeof api.createMatrixSelectedDOMValidatorV5,'function');
 const validate=api.createMatrixSelectedDOMValidatorV5(),base={schema:'matrix-dom-selected-v3',errors:[],clip:{...rect},items:[item()]};
 const mutations=[x=>x.schema='bad',x=>x.errors=['bad'],x=>x.clip.left=100,x=>x.clip.extra=1,x=>delete x.items[0],x=>x.items[0].extra=1,x=>x.items[0].visible=false,x=>x.items[0].rect.top=100,x=>x.items[0].text='x'.repeat(6401),x=>x.items[0].nativeId='',x=>x.items[0].identityAttribute='id',x=>x.items.push(item()),x=>x.items[0].hitPoints=[],x=>x.items[0].hitPoints=[0,0],x=>x.items[0].hitPoints=[27],x=>Object.defineProperty(x.items[0],'text',{get(){throw Error('getter invoked');},enumerable:true}),x=>Object.setPrototypeOf(x.items[0],{})];
 const errorOf=fn=>{try{fn();return null;}catch(error){return error.message;}};
 for(const mutate of mutations){const dom=structuredClone(base);mutate(dom);const s=state();assert.equal(errorOf(()=>validate(dom,6400)),errorOf(()=>validateMatrixReadinessSample(context(),{schema:'matrix-current-sample-v3',response:s.response,progress:s.progress,dom})));}
 const source=readFileSync(new URL('./matrix-admission-v4.mjs',import.meta.url),'utf8');const maintained=source.slice(source.indexOf('function selectedDOM('),source.indexOf('\nexport function matchMatrixVisible'));
 assert.ok(api.createMatrixSelectedDOMValidatorV5.toString().includes(maintained),'private selectedDOM body copied exactly');
 for(const name of ['dense','rectangle']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n',start);assert.ok(api.createMatrixSelectedDOMValidatorV5.toString().includes(source.slice(start,end)),name+' dependency copied exactly');}
 const contextSource=readFileSync(new URL('../../competitors/shared/context.mjs',import.meta.url),'utf8');
 const closed=contextSource.slice(contextSource.indexOf('export function closedData(')+7,contextSource.indexOf('\nfunction identity'));
 assert.ok(api.createMatrixSelectedDOMValidatorV5.toString().includes(closed),'closedData dependency copied exactly');
});
test('local deadline and post-work checks reject with no observation or candidate after end',async()=>{
 const h=await harness([state(1)],{input:{...options(),browserBudgetMs:75}});assert.equal(h.result.terminalCode,'matrix-v5-browser-deadline');assert.equal(h.result.observationCount,2);assert.deepEqual(h.log.filter(Array.isArray),[['timer',50],['timer',25]]);assert.equal(h.pending,0);
 for(const x of [state(),{...state(),responseMs:4000},{...state(),progressMs:4000}]){
  const h=await harness([x],{postWorkMs:x.responseMs||x.progressMs?0:4000});assert.equal(h.result.outcome,'rejected');assert.equal(h.result.terminalCode,'matrix-v5-browser-deadline');assert.equal(h.result.observationCount,1);
 }
 const h2=await harness([state()],{setup:'time+=4000;'});assert.equal(h2.result.outcome,'candidate');assert.equal(h2.result.clock.startedMs,1004000,'browser origin starts at actual callback entry, never Node dispatch');
});
test('candidate envelope construction cannot cross the local end after its post-work check',async()=>{
 const h=await harness([state()],{setup:'var clockReads=0;performance.now=()=>[1000000,1000000,1003999,1003999,1004000][Math.min(clockReads++,4)];'});
 assert.equal(h.result.outcome,'rejected');assert.equal(h.result.terminalCode,'matrix-v5-browser-deadline');
});
test('diagnostic descriptor traps cannot replace an already acquired scalar validation failure',async()=>{
 const h=await harness([state(1)],{setup:"var descriptorReads=0;states[0].progress=new Proxy({...states[0].progress,schema:2},{getOwnPropertyDescriptor(target,key){if(key==='messageCount')throw Error(descriptorReads++?'later diagnostic trap':'original trap');return Reflect.getOwnPropertyDescriptor(target,key);}});"});
 assert.equal(h.result.outcome,'rejected');assert.equal(h.result.terminalMessage,'original trap');
 // The classifier hits this trap first; later diagnostic reads must not escape
 // the bounded terminal envelope or replace the original exception.
});
test('fixed cap stops exactly at 80, retains first8 plus actual last, and clears every timer',async()=>{
 const h=await harness([state(1)]);assert.equal(h.result.terminalCode,'matrix-v5-browser-observation-cap');assert.equal(h.result.observationCount,80);assert.equal(h.result.firstObservations.length,8);assert.equal(h.result.lastObservation.observation,80);assert.equal(h.result.retainedObservationCount,9);assert.equal(h.result.droppedObservationCount,71);assert.equal(h.maxTimers,1);assert.equal(h.pending,0);assert.equal(h.cleared,79);assert.equal(h.time,1003950);
 const one=await harness([state(1)],{input:{...options(),observationAllowance:1}});assert.equal(one.result.observationCount,1);assert.equal(one.maxTimers,0);
});
test('later scalar failure preserves last actual full sample and does not reacquire',async()=>{
 const bad=state(1);bad.progress.error='SDK';const h=await harness([state(512,[]),bad,state()]);
 assert.equal(h.result.terminalMessage,'matrix-progress-runtime');assert.equal(h.result.observationCount,2);assert.ok(h.result.sample);assert.deepEqual(h.result.sample.dom.items,[]);assert.equal(h.result.lastObservation.domAcquired,false);assert.equal(h.pending,0);
 assert.equal(h.result.sampleObservation,1);
});
test('closed options reject before reads and hostile previews keep receipt projection under 16KiB',async()=>{
 for(const mutate of [x=>x.extra=1,x=>x.browserBudgetMs=4001,x=>x.browserBudgetMs=0,x=>x.observationAllowance=81,x=>x.observationAllowance=0,x=>x.phase='other',x=>x.selectors={...selectors,extra:'bad'},x=>x.maxResponseCharacters=262144]){const input=options();mutate(input);const h=await harness([state()],{input});assert.equal(h.result.outcome,'rejected');assert.equal(h.result.observationCount,0);assert.equal(h.log.length,0);}
 const hostile='\u0000'.repeat(64)+'x'.repeat(10000),states=Array.from({length:9},()=>state(1));states.at(-1).throwProgress=hostile;
 for(const s of states){s.response.id='\u0000'.repeat(64);s.progress.responseId=s.response.id;}
 const h=await harness(states);assert.equal(h.result.outcome,'rejected');assert.equal(h.result.errorPreview.trueCharacters,hostile.length);assert.equal(h.result.errorPreview.truncated,true);assert.equal(h.result.terminalMessage.length,4096);
 assert.ok(new TextEncoder().encode(JSON.stringify(receipt(h.result))).byteLength<=16384);
 assert.equal(h.result.firstObservations[0].responseId.trueCharacters,64);assert.equal(h.result.firstObservations[0].responseId.truncated,false);
 assert.equal(h.result.lastObservation.responseAcquired,true);assert.equal(h.result.lastObservation.progressAcquired,false);
});
test('maximum simultaneously retainable hostile scalar previews fit the fixed receipt cap',async()=>{
 const states=Array.from({length:9},()=>state(1));
 for(const s of states){s.response.id='\u0000'.repeat(128);s.progress.responseId=s.response.id;s.progress.responseCharacters=6400;}
 Object.assign(states.at(-1).progress,{error:'\u0000'.repeat(10000),messageCount:Number.MAX_SAFE_INTEGER,responseCharacters:Number.MAX_SAFE_INTEGER});states.at(-1).progress.operation.status='\u0000'.repeat(10000);
 const h=await harness(states),encoded=new TextEncoder().encode(JSON.stringify(receipt(h.result)));
 assert.equal(h.result.observationCount,9);assert.equal(h.result.retainedObservationCount,9);assert.equal(h.result.lastObservation.error.trueCharacters,10000);assert.equal(h.result.lastObservation.operationStatus.trueCharacters,10000);
 assert.ok(encoded.byteLength<=16384,`receipt bytes ${encoded.byteLength}`);
 assert.equal(h.result.firstObservations[0].responseId.text.length,64);assert.equal(h.result.firstObservations[0].responseId.trueCharacters,128);assert.equal(h.result.firstObservations[0].responseId.truncated,true);
 assert.ok(!JSON.stringify(receipt(h.result)).includes('RRRR'),'receipt never repeats response/DOM prose');
});
