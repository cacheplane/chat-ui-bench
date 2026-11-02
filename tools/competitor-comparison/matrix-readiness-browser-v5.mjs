import {createMatrixScalarClassifierV5} from './matrix-readiness-scalars-v5.mjs';
import {observeMatrixDOM} from './matrix-observer-v3.mjs';

/** Additive copy of V4's private selectedDOM and its three dependencies.
 * Node and browser execute this exact factory; this checks structure only.
 */
export function createMatrixSelectedDOMValidatorV5(){
const need=(value,reason)=>{if(!value)throw Error('matrix-'+reason);};
const fail=reason=>{throw Error('competitor-'+reason);};
function closedData(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('data-shape');
  const actual=Reflect.ownKeys(value);if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))fail('data-fields');
  return Object.fromEntries(keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail('own-data');return[key,d.value];}));
}
function dense(array,cap,label){need(Array.isArray(array)&&array.length<=cap,'array-'+label);for(let i=0;i<array.length;i++){const d=Object.getOwnPropertyDescriptor(array,String(i));need(d&&Object.hasOwn(d,'value'),'array-own-'+label);}return array;}
function rectangle(input){const rect=closedData(input,['left','top','right','bottom']);need(Object.values(rect).every(Number.isFinite)&&rect.right>rect.left&&rect.bottom>rect.top,'dom-geometry');return rect;}
function selectedDOM(dom,responseCap){
 need(dom?.schema==='matrix-dom-selected-v3'&&Array.isArray(dom.errors)&&dom.errors.length===0&&Array.isArray(dom.items)&&dom.items.length<=32,'dom-observation');
 const clip=rectangle(dom.clip);let characters=0;const ids=new Set();
 for(const raw of dense(dom.items,32,'dom')){
  const item=closedData(raw,['nativeId','identityAttribute','text','visible','rect','hitPoints']),rect=rectangle(item.rect);
  need(item.visible===true&&Math.min(rect.right,clip.right)>Math.max(rect.left,clip.left)&&Math.min(rect.bottom,clip.bottom)>Math.max(rect.top,clip.top),'dom-not-visible');
  need(typeof item.text==='string'&&item.text.length<=responseCap&&(characters+=item.text.length)<=responseCap+32*512,'dom-text-bound');
  need(item.nativeId===null?item.identityAttribute===null:typeof item.nativeId==='string'&&item.nativeId.length>0&&item.nativeId.length<=128&&['data-message-id','data-bench-message-id','data-bench-message'].includes(item.identityAttribute)&&!ids.has(item.nativeId),'dom-identity');
  if(item.nativeId!==null)ids.add(item.nativeId);
  dense(item.hitPoints,27,'hits');need(item.hitPoints.length>0&&new Set(item.hitPoints).size===item.hitPoints.length&&item.hitPoints.every(point=>Number.isInteger(point)&&point>=0&&point<=26),'dom-hit-evidence');
 }
 return dom.items;
}
return selectedDOM;
}

/** One original async evaluate per phase. All callback dependencies are bound
 * as source, with no window waiter, prearm, historical prose or SDK internals.
 * Document-clock limits are safety bounds, never Node deadline authority.
 */
export function createMatrixBrowserReadinessEvaluatorV5(){
 return new Function('options', `
 "use strict";
 const createClassifier=(${createMatrixScalarClassifierV5.toString()});
 const observe=(${observeMatrixDOM.toString()});
 const validateDOM=(${createMatrixSelectedDOMValidatorV5.toString()})();
 return (async()=>{
  const startedMs=performance.now();
  let phase=null,budgetMs=null,localEnd=null,pendingTimer=null,count=0,sample=null,sampleObservation=null,lastObservation=null;
  const firstObservations=[];
  const need=(value,code)=>{if(!value)throw Error(code);};
  const own=(value,key)=>{
   if(value===null||(typeof value!=='object'&&typeof value!=='function'))return undefined;
   try{const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;}catch{return undefined;}
  };
  const preview=value=>typeof value==='string'?{text:value.slice(0,64),trueCharacters:value.length,truncated:value.length>64}:null;
  const number=value=>Number.isSafeInteger(value)&&value>=0?value:null;
  const closed=(value,keys)=>{
   need(value&&Object.getPrototypeOf(value)===Object.prototype,'matrix-v5-browser-options');
   const actual=Reflect.ownKeys(value);need(actual.length===keys.length&&actual.every(key=>keys.includes(key)),'matrix-v5-browser-options');
   const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);need(d&&Object.hasOwn(d,'value')&&d.enumerable,'matrix-v5-browser-options');result[key]=d.value;}return result;
  };
  const checkEnd=()=>need(performance.now()<localEnd,'matrix-v5-browser-deadline');
  const summarize=(response,progress,responseAcquired,progressAcquired,dom,domAcquired)=>{
   const text=own(response,'text'),operation=own(progress,'operation');
   return {observation:count,documentObservedMs:performance.now(),responseAcquired,progressAcquired,domAcquired,
    responseId:preview(own(response,'id')),responseCharacters:typeof text==='string'?text.length:null,
    progressResponseId:preview(own(progress,'responseId')),progressResponseCharacters:number(own(progress,'responseCharacters')),
    messageCount:number(own(progress,'messageCount')),running:typeof own(progress,'running')==='boolean'?own(progress,'running'):null,
    operationStatus:preview(own(operation,'status')),error:preview(own(progress,'error')),
    domItemCount:domAcquired&&Array.isArray(own(dom,'items'))?own(dom,'items').length:null,
    domErrorCount:domAcquired&&Array.isArray(own(dom,'errors'))?own(dom,'errors').length:null};
  };
  const envelope=(outcome,error=null)=>{
   const endedMs=performance.now();
   if(outcome==='candidate')need(endedMs<localEnd,'matrix-v5-browser-deadline');
   // Public throws retain their actual own string message without invoking a
   // hostile message getter/toString. Receipts exclude terminalMessage/sample.
   const actual=typeof error==='string'?error:own(error,'message');
   const message=outcome==='candidate'?null:typeof actual==='string'?actual:'matrix-v5-browser-acquisition';
   const terminalCode=message===null?null:/^(matrix-|competitor-)[a-z0-9-]{1,116}$/.test(message)?message:'matrix-v5-browser-acquisition';
   const retainedObservationCount=Math.min(count,8)+(count>8?1:0);
   return {schema:'matrix-browser-local-readiness-v1',phase,outcome,sample,sampleObservation,terminalCode,terminalMessage:message===null?null:message.slice(0,4096),errorPreview:preview(message),
    observationCount:count,firstObservations,lastObservation,retainedObservationCount,droppedObservationCount:count-retainedObservationCount,
    clock:{label:'document-browser-performance',startedMs,endedMs,budgetMs},performance:false,scoringEligibility:false,FPS:null};
  };
  try{
   const input=closed(options,['metadata','selectors','maxResponseCharacters','browserBudgetMs','phase','observationAllowance']);
   need(['initial','final'].includes(input.phase),'matrix-v5-browser-options');phase=input.phase;
   need(Number.isFinite(input.browserBudgetMs)&&input.browserBudgetMs>0&&input.browserBudgetMs<=4000,'matrix-v5-browser-options');
   budgetMs=input.browserBudgetMs;localEnd=startedMs+budgetMs;
   need(Number.isInteger(input.observationAllowance)&&input.observationAllowance>=1&&input.observationAllowance<=80,'matrix-v5-browser-options');
   const selectors=closed(input.selectors,['scroller','message','messageContent']);
   need(Object.values(selectors).every(value=>typeof value==='string'&&value.length>0&&value.length<=2048),'matrix-v5-browser-options');
   const classify=createClassifier(input.metadata);
   const responseBytes=own(input.metadata,'responseBytes');
   need(input.maxResponseCharacters===responseBytes,'matrix-v5-browser-options');
   const minimum=16*Math.floor(responseBytes/200)+Math.min(16,responseBytes%200);
   const prose=text=>text.replace(/[ \\t\\n\\r\\f\\v]+/g,' ').replace(/^ | $/g,'');
   const api=window.competitorBench;
   need(api&&typeof api.readResponse==='function'&&typeof api.readProgress==='function','matrix-public-observer-absent');
   for(;;){
    checkEnd();need(count<input.observationAllowance,'matrix-v5-browser-observation-cap');count++;
    let response=null,progress=null,dom=null,responseAcquired=false,progressAcquired=false,domAcquired=false,candidate=false;
    try{
     response=api.readResponse();responseAcquired=true;
     progress=api.readProgress();progressAcquired=true;
     const classification=classify(progress,response);
     if(classification==='prefix-eligible'){
      dom=observe({selectors,responseId:progress.responseId,maxResponseCharacters:input.maxResponseCharacters});domAcquired=true;
      sample={schema:'matrix-current-sample-v3',response,progress,dom};sampleObservation=count;
      const items=validateDOM(dom,responseBytes),current=prose(response.text);
      candidate=items.some(item=>{const text=prose(item.text);return text.length>=minimum&&current.startsWith(text);});
     }
    }finally{
     lastObservation=summarize(response,progress,responseAcquired,progressAcquired,dom,domAcquired);
     if(firstObservations.length<8)firstObservations.push(lastObservation);
    }
    checkEnd();
    if(candidate)return envelope('candidate');
    need(count<input.observationAllowance,'matrix-v5-browser-observation-cap');
    const delay=Math.min(50,localEnd-performance.now());need(delay>0,'matrix-v5-browser-deadline');
    await new Promise(resolve=>{pendingTimer=setTimeout(resolve,delay);});
    clearTimeout(pendingTimer);pendingTimer=null;
   }
  }catch(error){return envelope('rejected',error);}
  finally{if(pendingTimer!==null)clearTimeout(pendingTimer);}
 })();
 `);
}
