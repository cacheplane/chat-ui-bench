import {performance} from 'node:perf_hooks';
import {comparisonCounterCheckpointSchema,type ComparisonCounterCheckpoint} from '@chat-ui-bench/contract';
import type {ComparisonOwnershipContext} from './comparison-ownership.js';
export interface ComparisonCounterCommands {getHeapUsage():Promise<unknown>;getDOMCounters():Promise<unknown>}
export interface ComparisonCounterCaptureOptions {commands:ComparisonCounterCommands;pageNow():Promise<unknown>;now?:()=>number}
export interface ComparisonCounterCapture {
 capture(ctx:ComparisonOwnershipContext,lifecycle:ComparisonCounterCheckpoint['lifecycle']):Promise<ComparisonCounterCheckpoint>;
 snapshot():readonly ComparisonCounterCheckpoint[];
}
const missing=(reason:string)=>({status:'unavailable' as const,reason});
function field(value:unknown,key:string):unknown {if(typeof value!=='object'||value===null)return undefined;const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&'value' in descriptor?descriptor.value:undefined;}
function count(v:unknown):v is number {return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;}
function timestamp(v:unknown):v is number {return typeof v==='number'&&Number.isFinite(v)&&v>=0;}
export function createComparisonCounterCapture(o:ComparisonCounterCaptureOptions):ComparisonCounterCapture {
 const now=o.now??(()=>performance.now()), checkpoints:ComparisonCounterCheckpoint[]=[];
 const order=['baseline','history-ready','replay-end'] as const;
 let capturing=false;
 return {
  async capture(ctx,lifecycle) {
   if(capturing||order[checkpoints.length]!==lifecycle)throw new Error('Counter lifecycle must be ordered, unique and sequential');
   if(ctx.stage!==(lifecycle==='replay-end'?'replay':'setup'))throw new Error('Counter lifecycle ownership stage mismatch');
   ctx.assertActive();capturing=true;
   const checkpoint:ComparisonCounterCheckpoint={lifecycle,pageRequestBracket:missing('page request bracket unavailable: missing or invalid endpoint'),hostReceipt:{heap:missing('Heap response not received'),dom:missing('DOM response not received')},data:{heap:missing('Heap data unavailable'),dom:missing('DOM data unavailable')}};
   checkpoints.push(checkpoint);
   const pending=new Set<Promise<unknown>>();let closed=false,closing:Promise<void>|undefined;
   function track<T>(call:()=>Promise<T>):Promise<T>{let promise:Promise<T>;try{promise=call();}catch(error){promise=Promise.reject(error);}pending.add(promise);void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));return promise;}
   function active(){if(closed)throw new Error('Counter capture closed');ctx.assertActive();}
   function close(){if(closing)return closing;closed=true;closing=(async()=>{while(pending.size)await Promise.allSettled([...pending]);})();return closing;}
   const adoption=ctx.adopt({name:`comparison-counter:${lifecycle}`,close});void adoption.catch(()=>{});
   async function pageEndpoint():Promise<unknown>{try{return await track(o.pageNow);}catch{return undefined;}}
   try {
    await adoption;active();const before=await pageEndpoint();active();
    // Both requests are invoked before either response is awaited. Their receipt
    // callbacks run independently, including numeric-validation failures.
    const heap=track(()=>{
     active();
     let response:Promise<unknown>;try{response=o.commands.getHeapUsage();}catch(error){response=Promise.reject(error);}
     return response.then(value=>{checkpoint.hostReceipt.heap={status:'available',value:{timestampMs:now(),clockDomain:'host-monotonic-ms'}};const used=field(value,'usedSize');if(count(used))checkpoint.data.heap={status:'available',value:{jsHeapUsedBytes:used}};},()=>{checkpoint.hostReceipt.heap=missing('Heap transport rejected');});
    });
    const dom=track(()=>{
     active();
     let response:Promise<unknown>;try{response=o.commands.getDOMCounters();}catch(error){response=Promise.reject(error);}
     return response.then(value=>{checkpoint.hostReceipt.dom={status:'available',value:{timestampMs:now(),clockDomain:'host-monotonic-ms'}};const nodes=field(value,'nodes'),documents=field(value,'documents'),listeners=field(value,'jsEventListeners');if(count(nodes)&&count(documents)&&count(listeners))checkpoint.data.dom={status:'available',value:{nodes,documents,eventListeners:listeners}};},()=>{checkpoint.hostReceipt.dom=missing('DOM transport rejected');});
    });
    await Promise.allSettled([heap,dom]);
    let after:unknown;try{active();after=await pageEndpoint();}catch{/* No new page call after revocation. */}
    if(timestamp(before)&&timestamp(after)&&before<=after)checkpoint.pageRequestBracket={status:'available',value:{clockDomain:'page-performance-ms',beforeMs:before,afterMs:after}};
    return comparisonCounterCheckpointSchema.parse(checkpoint);
   }finally{capturing=false;}
  },
  snapshot(){return checkpoints.map(v=>comparisonCounterCheckpointSchema.parse(v));},
 };
}
