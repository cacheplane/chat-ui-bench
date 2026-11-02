import {MATRIX_V5_ACQUISITION,MATRIX_V5_READINESS} from './matrix-policy-v5.mjs';
import {createMatrixScalarClassifierV5} from './matrix-readiness-scalars-v5.mjs';
import {createMatrixBrowserReadinessEvaluatorV5} from './matrix-readiness-browser-v5.mjs';
import {validateMatrixReadinessSample,matrixStreamingReadiness} from './matrix-admission-v4.mjs';

const envelopeKeys=['schema','phase','outcome','sample','sampleObservation','terminalCode','terminalMessage','errorPreview','observationCount','firstObservations','lastObservation','retainedObservationCount','droppedObservationCount','clock','performance','scoringEligibility','FPS'];
const observationKeys=['observation','documentObservedMs','responseAcquired','progressAcquired','domAcquired','responseId','responseCharacters','progressResponseId','progressResponseCharacters','messageCount','running','operationStatus','error','domItemCount','domErrorCount'];
const previewKeys=['text','trueCharacters','truncated'];
const need=(condition,code)=>{if(!condition)throw Error(code);};
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function closed(value,keys,code){
 need(value&&Object.getPrototypeOf(value)===Object.prototype,code);
 const actual=Reflect.ownKeys(value);need(actual.length===keys.length&&actual.every(k=>keys.includes(k)),code);
 const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);need(d&&Object.hasOwn(d,'value')&&d.enumerable,code);result[key]=d.value;}return result;
}
function array(value,cap,code){
 need(Array.isArray(value)&&value.length<=cap&&Reflect.ownKeys(value).length===value.length+1,code);
 for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));need(d&&Object.hasOwn(d,'value')&&d.enumerable,code);}return value;
}
function preview(value,limit=32){return typeof value==='string'?{text:value.slice(0,limit),trueCharacters:value.length,truncated:value.length>limit}:null;}
function validatePreview(value,limit,code){
 if(value===null)return null;
 const v=closed(value,previewKeys,code);need(typeof v.text==='string'&&integer(v.trueCharacters)&&v.text.length===Math.min(v.trueCharacters,limit)&&v.truncated===(v.trueCharacters>limit),code);return v;
}
function observation(value,clock,code,previewLimit=64){
 const v=closed(value,observationKeys,code);
 need(integer(v.observation,1,80)&&finite(v.documentObservedMs)&&v.documentObservedMs>=clock.startedMs&&v.documentObservedMs<=clock.endedMs,code);
 for(const key of ['responseAcquired','progressAcquired','domAcquired'])need(typeof v[key]==='boolean',code);
 need(!v.progressAcquired||v.responseAcquired,code);need(!v.domAcquired||v.progressAcquired,code);
 for(const key of ['responseId','progressResponseId','operationStatus','error'])validatePreview(v[key],previewLimit,code);
 for(const key of ['responseCharacters','progressResponseCharacters','messageCount','domItemCount','domErrorCount'])need(v[key]===null||integer(v[key]),code);
 need(v.running===null||typeof v.running==='boolean',code);
 need(v.domAcquired||v.domItemCount===null&&v.domErrorCount===null,code);
 return v;
}
function clockValue(input,budget,code){const c=closed(input,['label','startedMs','endedMs','budgetMs'],code);need(c.label==='document-browser-performance'&&finite(c.startedMs)&&c.startedMs>=0&&finite(c.endedMs)&&c.endedMs>=c.startedMs&&c.budgetMs===budget&&finite(budget)&&budget>0&&budget<=4000,code);return c;}
function validateEnvelope(input,phase,budget,allowance){
 const code='matrix-v5-envelope',v=closed(input,envelopeKeys,code);
 need(v.schema==='matrix-browser-local-readiness-v1'&&v.phase===phase&&['candidate','rejected'].includes(v.outcome)&&v.performance===false&&v.scoringEligibility===false&&v.FPS===null,code);
 const c=clockValue(v.clock,budget,code),n=v.observationCount;
 need(integer(n,0,allowance),code);
 const first=array(v.firstObservations,8,code);need(first.length===Math.min(n,8)&&v.retainedObservationCount===Math.min(n,8)+(n>8?1:0)&&v.droppedObservationCount===n-v.retainedObservationCount,code);
 let previous=c.startedMs;
 first.forEach((s,i)=>{const o=observation(s,c,code);need(o.observation===i+1&&o.documentObservedMs>=previous,code);previous=o.documentObservedMs;});
 if(n===0)need(v.lastObservation===null,code);
 else{const last=observation(v.lastObservation,c,code);need(last.observation===n&&last.documentObservedMs>=previous,code);if(n<=8)need(JSON.stringify(last)===JSON.stringify(first.at(-1)),code);}
 if(v.sample===null)need(v.sampleObservation===null,code);
 else need(integer(v.sampleObservation,1,n),code);
 const errorPreview=validatePreview(v.errorPreview,64,code);
 if(v.outcome==='candidate'){
  need(n>0&&v.sample!==null&&v.sampleObservation===n&&v.lastObservation.domAcquired&&v.terminalCode===null&&v.terminalMessage===null&&errorPreview===null&&c.endedMs-c.startedMs<budget,code);
 }else{
  need(typeof v.terminalCode==='string'&&/^(matrix-|competitor-)[a-z0-9-]{1,116}$/.test(v.terminalCode)&&typeof v.terminalMessage==='string'&&v.terminalMessage.length<=4096&&errorPreview!==null,code);
  need(errorPreview.trueCharacters>=v.terminalMessage.length&&errorPreview.text===v.terminalMessage.slice(0,64),code);
 }
 return v;
}
function own(value,key){try{const d=value&&Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}}
function candidateSummary(v){
 const code='matrix-v5-envelope',s=v.lastObservation,{response,progress,dom}=v.sample;
 need(s.responseCharacters===response.text.length&&s.progressResponseCharacters===progress.responseCharacters&&s.messageCount===progress.messageCount&&s.running===progress.running&&s.domItemCount===dom.items.length&&s.domErrorCount===dom.errors.length,code);
 for(const [key,value] of [['responseId',response.id],['progressResponseId',progress.responseId],['operationStatus',progress.operation.status],['error',progress.error]]){
  const expected=preview(value,64),actual=s[key];need(expected===null?actual===null:actual!==null&&previewKeys.every(k=>expected[k]===actual[k]),code);
 }
}
function errorText(error){const message=typeof error==='string'?error:own(error,'message');return typeof message==='string'?message:'matrix-v5-acquisition';}
function terminalCode(error){
 const message=errorText(error),match=/^(matrix-|competitor-)[a-z0-9-]{1,116}$/.exec(message);
 return match!==null&&match[0]===message?message:'matrix-v5-node-acquisition';
}
function freezeDeep(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freezeDeep(item);Object.freeze(value);}return value;}
const receiptKeys=['schema','acquisition','policy','clock','status','primaryError','observationCount','knownObservationCount','firstObservations','lastObservation','retainedObservationCount','droppedObservationCount','phases','preparation','owners','preWheelMs','unsafeOutstanding','previewLimit','performance','scoringEligibility','FPS'];

/** Source-bound ports only: the runner binds raw page.evaluate, deadline.wait,
 * deadline.remaining and performance.now once. No evidence can supply ports.
 * Construction prepares metadata once, before the original start ACK.
 */
export function createMatrixReadinessControllerV5({context,selectors,evaluate,wait,remaining,now}){
 need([evaluate,wait,remaining,now].every(fn=>typeof fn==='function'),'matrix-v5-ports');
 const metadata={profile:context.profile,historyCount:context.workload.historyCount,responseBytes:context.workload.responseBytes,historicalIds:context.history.map(row=>row.id)};
 const classify=createMatrixScalarClassifierV5(metadata);
 need(new TextEncoder().encode(JSON.stringify(metadata)).byteLength<=MATRIX_V5_READINESS.metadataBytes,'matrix-v5-metadata-bound');
 const projectedSelectors={scroller:selectors.scroller,message:selectors.message,messageContent:selectors.messageContent};
 need(Object.values(projectedSelectors).every(v=>typeof v==='string'&&v.length>0&&v.length<=2048),'matrix-v5-selectors');
 const evaluator=createMatrixBrowserReadinessEvaluatorV5();
 let ack=null,state='initial',failure=null,sealed=false,snapshot=null,preWheelMs=null,lastNodeMs=0;
 const phases=[],owners=[],preparation=[],firstObservations=[];let lastObservation=null,knownCount=0;
 // The Promise references stay private until cleanup; sealing never infers
 // cancellation/settlement from browser close or from attention timeout.
 const originals=[];
 function fail(error){if(failure===null)failure=error;return failure;}
 function elapsed(){const time=now();need(finite(time)&&ack!==null&&time>=ack,'matrix-v5-node-clock');const relative=time-ack;need(relative>=lastNodeMs,'matrix-v5-node-clock');lastNodeMs=relative;return relative;}
 function safeElapsed(){try{return ack===null?null:elapsed();}catch{return null;}}
 function check(){
  if(failure!==null)throw failure;
  need(!sealed,'matrix-v5-sealed');need(ack!==null,'matrix-v5-not-started');
  const ms=elapsed(),caseRemaining=remaining();need(finite(caseRemaining)&&caseRemaining>0&&ms<4000,'matrix-v5-node-deadline');return Math.min(4000-ms,caseRemaining);
 }
 function gate(expected){check();need(state===expected,'matrix-v5-order');}
 async function runOwned(kind,start,budget,label){
  const owner={kind,dispatchedMs:elapsed(),settledMs:null,originalStatus:'unknown',attentionStatus:'pending',attentionEndedMs:null};owners.push(owner);
  let original;
  try{
   original=start();
   // Attach reactions immediately on the exact raw Promise, before ANY
   // post-dispatch check or attention wait. Promise.prototype.then also
   // refuses arbitrary caller-controlled thenables as completion authority.
   originals.push(original);
   Promise.prototype.then.call(original,
    ()=>{try{if(!sealed){owner.originalStatus='fulfilled';owner.settledMs=safeElapsed();}}catch{}},
    ()=>{try{if(!sealed){owner.originalStatus='rejected';owner.settledMs=safeElapsed();}}catch{}});
  }catch(error){owner.originalStatus='rejected';owner.settledMs=safeElapsed();owner.attentionStatus='rejected';owner.attentionEndedMs=safeElapsed();throw error;}
  try{
   const afterDispatch=check();
   const result=await wait(original,Math.min(budget,afterDispatch),label);
   // Attention fulfillment is separate from original settlement. The actual
   // runner's wait races this original; no returned DTO can settle an owner.
   owner.attentionStatus='fulfilled';owner.attentionEndedMs=elapsed();check();return result;
  }catch(error){owner.attentionStatus='rejected';owner.attentionEndedMs=safeElapsed();throw error;}
 }
 function retain(v,phase){
  const project=s=>{const o={...s,phase,phaseObservation:s.observation,observation:knownCount+s.observation};for(const key of ['responseId','progressResponseId','operationStatus','error'])if(o[key]!==null)o[key]={text:o[key].text.slice(0,32),trueCharacters:o[key].trueCharacters,truncated:o[key].trueCharacters>32};return o;};
  const needed=8-firstObservations.length;for(const s of v.firstObservations.slice(0,needed))firstObservations.push(project(s));
  if(v.lastObservation!==null)lastObservation=project(v.lastObservation);
  knownCount+=v.observationCount;
 }
 return Object.freeze({
  start(ackMs){
   need(!sealed,'matrix-v5-sealed');need(ack===null,'matrix-v5-start-once');const current=now();need(finite(ackMs)&&finite(current)&&ackMs<=current,'matrix-v5-ack');ack=ackMs;
  },
  async acquire(phase){
   if(ack===null)throw Error('matrix-v5-not-started');
   let row;
   try{
    need(['initial','final'].includes(phase),'matrix-v5-order');gate(phase);
    const allowance=80-knownCount;need(allowance>0,'matrix-v5-observation-cap');const budget=check();
    row={phase,dispatchedMs:lastNodeMs,settledMs:null,acceptedMs:null,budgetMs:budget,observationCount:null,sampleObservation:null,candidateObserved:false,accepted:false,candidateResponseCharacters:null,browserClock:null,terminalCode:null};phases.push(row);
    // Reserve before invoking the raw dispatch callback: even a reentrant or
    // concurrent call cannot acquire a second independent phase allowance.
    state=phase+'-pending';
    const raw=await runOwned(phase,()=>evaluate(evaluator,{metadata,selectors:projectedSelectors,maxResponseCharacters:metadata.responseBytes,browserBudgetMs:budget,phase,observationAllowance:allowance}),budget,'matrix-v5-'+phase+'-readiness');
    row.settledMs=elapsed();check();const v=validateEnvelope(raw,phase,budget,allowance);
    row.observationCount=v.observationCount;row.sampleObservation=v.sampleObservation;row.browserClock={...v.clock};row.terminalCode=v.terminalCode;retain(v,phase);
    if(v.outcome==='rejected')throw Error(v.terminalMessage);
    // Preserve candidate bounds before the exact validators can reject it.
    row.candidateObserved=true;const text=own(own(v.sample,'response'),'text');row.candidateResponseCharacters=typeof text==='string'?text.length:null;
    check();
    validateMatrixReadinessSample(context,v.sample);
    classify(own(v.sample,'progress'),own(v.sample,'response'));
    const readiness=matrixStreamingReadiness(context,v.sample.progress,v.sample.response,v.sample.dom);
    candidateSummary(v);
    check();row.accepted=true;row.acceptedMs=lastNodeMs;state=phase==='initial'?'stability':'wheel';
    return {sample:v.sample,readiness};
   }catch(error){if(row&&row.terminalCode===null)row.terminalCode=terminalCode(error);throw fail(error);}
  },
  async prepare(kind,startCallback,stageMs,label){
   try{
    need(['stability','ticks'].includes(kind),'matrix-v5-order');gate(kind);need(typeof startCallback==='function'&&finite(stageMs)&&stageMs>0&&typeof label==='string','matrix-v5-preparation');
    const budget=Math.min(stageMs,check()),row={kind,mode:'owned',dispatchedMs:elapsed(),completedMs:null};preparation.push(row);
    state=kind+'-pending';
    const value=await runOwned(kind,startCallback,budget,label);check();row.completedMs=elapsed();state=kind==='stability'?'ticks':'final';return value;
   }catch(error){throw fail(error);}
  },
  skipStability(){try{gate('stability');const ms=elapsed();preparation.push({kind:'stability',mode:'skipped',dispatchedMs:ms,completedMs:ms});state='ticks';return {criterion:'active-bottom-follow-no-stationarity-required'};}catch(error){throw fail(error);}},
  assertBeforeWheel(){try{check();need(preWheelMs===null,'matrix-v5-wheel-once');need(state==='wheel','matrix-v5-order');preWheelMs=elapsed();check();state='dispatched';return preWheelMs;}catch(error){throw fail(error);}},
  seal(){
   if(snapshot!==null)return snapshot;
   const endedMs=safeElapsed(),unsafeOutstanding=owners.some(o=>o.originalStatus==='unknown');sealed=true;
   const count=phases.length>0&&phases.every(p=>p.observationCount!==null)?knownCount:null;
   const retained=firstObservations.length+(knownCount>8?1:0);
   const receipt={schema:'matrix-readiness-receipt-v5',acquisition:{...MATRIX_V5_ACQUISITION},policy:{...MATRIX_V5_READINESS},clock:{label:'node-performance-relative-to-start-ack',startedMs:ack===null?null:0,endedMs,budgetMs:4000},status:failure!==null?'rejected':state==='dispatched'?'accepted':'incomplete',primaryError:failure===null?null:preview(errorText(failure)),observationCount:count,knownObservationCount:knownCount,firstObservations,lastObservation,retainedObservationCount:retained,droppedObservationCount:knownCount-retained,phases,preparation,owners,preWheelMs,unsafeOutstanding,previewLimit:32,performance:false,scoringEligibility:false,FPS:null};
   // All receipt strings are closed small projections. Samples, terminal
   // messages, histories and raw Promise results are deliberately absent.
   const copy=JSON.parse(JSON.stringify(receipt));need(new TextEncoder().encode(JSON.stringify(copy)).byteLength<=16384,'matrix-v5-receipt-bound');
   snapshot=freezeDeep({receipt:copy,unsafeOutstanding});return snapshot;
  },
 });
}

/** Additive admission gate. Diagnostic timestamps corroborate source controls;
 * they never establish native delivery, exact SDK/DOM readiness or conformance.
 */
export function validateMatrixReadinessReceiptV5(input){
 const code='matrix-v5-receipt',r=closed(input,receiptKeys,code);
 need(r.schema==='matrix-readiness-receipt-v5'&&r.status==='accepted'&&r.primaryError===null&&r.unsafeOutstanding===false&&r.previewLimit===32&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null,code);
 for(const [key,expected] of [['acquisition',MATRIX_V5_ACQUISITION],['policy',MATRIX_V5_READINESS]]){const actual=closed(r[key],Object.keys(expected),code);need(Object.entries(expected).every(([k,v])=>actual[k]===v),code);}
 const clock=closed(r.clock,['label','startedMs','endedMs','budgetMs'],code);need(clock.label==='node-performance-relative-to-start-ack'&&clock.startedMs===0&&clock.budgetMs===4000&&finite(clock.endedMs)&&clock.endedMs>=0&&finite(r.preWheelMs)&&r.preWheelMs>=0&&r.preWheelMs<4000&&clock.endedMs>=r.preWheelMs,code);
 const ps=array(r.phases,2,code),prep=array(r.preparation,2,code),owners=array(r.owners,4,code);need(ps.length===2&&prep.length===2&&owners.length>=3,code);
 const time=n=>finite(n)&&n>=0&&n<4000;
 ps.forEach((raw,i)=>{const p=closed(raw,['phase','dispatchedMs','settledMs','acceptedMs','budgetMs','observationCount','sampleObservation','candidateObserved','accepted','candidateResponseCharacters','browserClock','terminalCode'],code);need(p.phase===(i?'final':'initial')&&p.accepted===true&&p.candidateObserved===true&&p.terminalCode===null&&time(p.dispatchedMs)&&time(p.settledMs)&&time(p.acceptedMs)&&p.dispatchedMs<=p.settledMs&&p.settledMs<=p.acceptedMs&&p.budgetMs<=4000-p.dispatchedMs&&integer(p.observationCount,1,80)&&p.sampleObservation===p.observationCount&&integer(p.candidateResponseCharacters,512,262144),code);const c=clockValue(p.browserClock,p.budgetMs,code);need(c.endedMs-c.startedMs<c.budgetMs,code);});
 prep.forEach((raw,i)=>{const p=closed(raw,['kind','mode','dispatchedMs','completedMs'],code);need(p.kind===(i?'ticks':'stability')&&(p.mode==='owned'||i===0&&p.mode==='skipped')&&time(p.dispatchedMs)&&time(p.completedMs)&&p.completedMs>=p.dispatchedMs&&(p.mode!=='skipped'||p.completedMs===p.dispatchedMs),code);});
 need(ps[0].acceptedMs<=prep[0].dispatchedMs&&prep[0].completedMs<=prep[1].dispatchedMs&&prep[1].completedMs<=ps[1].dispatchedMs&&ps[1].acceptedMs<=r.preWheelMs,code);
 const expected=['initial',...(prep[0].mode==='owned'?['stability']:[]),'ticks','final'];need(owners.length===expected.length,code);
 owners.forEach((raw,i)=>{const o=closed(raw,['kind','dispatchedMs','settledMs','originalStatus','attentionStatus','attentionEndedMs'],code);need(o.kind===expected[i]&&o.originalStatus==='fulfilled'&&o.attentionStatus==='fulfilled'&&time(o.dispatchedMs)&&time(o.settledMs)&&time(o.attentionEndedMs)&&o.dispatchedMs<=o.settledMs&&o.settledMs<=o.attentionEndedMs,code);const row=['initial','final'].includes(o.kind)?ps.find(p=>p.phase===o.kind):prep.find(p=>p.kind===o.kind);need(o.dispatchedMs>=row.dispatchedMs&&o.attentionEndedMs<=('acceptedMs'in row?row.acceptedMs:row.completedMs),code);});
 const n=ps[0].observationCount+ps[1].observationCount;need(integer(n,2,80)&&r.observationCount===n&&r.knownObservationCount===n,code);
 const first=array(r.firstObservations,8,code);need(first.length===Math.min(n,8)&&r.retainedObservationCount===Math.min(n,8)+(n>8?1:0)&&r.droppedObservationCount===n-r.retainedObservationCount,code);
 const checkSummary=(raw,ordinal)=>{const s=closed(raw,[...observationKeys,'phase','phaseObservation'],code),index=s.phase==='initial'?0:s.phase==='final'?1:-1;need(index>=0&&s.observation===ordinal&&s.phaseObservation===ordinal-(index?ps[0].observationCount:0)&&integer(s.phaseObservation,1,ps[index].observationCount),code);const {phase,phaseObservation,...o}=s;observation({...o,observation:phaseObservation},ps[index].browserClock,code,32);};
 first.forEach((s,i)=>checkSummary(s,i+1));checkSummary(r.lastObservation,n);if(n<=8)need(JSON.stringify(first.at(-1))===JSON.stringify(r.lastObservation),code);
 need(new TextEncoder().encode(JSON.stringify(r)).byteLength<=16384,code);return input;
}
