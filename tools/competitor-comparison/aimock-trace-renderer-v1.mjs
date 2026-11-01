// Pure post-seal metadata projection. Event-emitter PID never supplies ownership.
const own=(o,k)=>{try{const d=Object.getOwnPropertyDescriptor(o,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
const id=x=>typeof x==='string'&&x.length>0&&x.length<=128;
const integer=x=>Number.isSafeInteger(x)&&x>0;
const freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
function witnesses(){let total=0,latest=null;const first8=[],identities=new Set();return {add(value,key){total++;latest=value;identities.add(key);if(first8.length<8)first8.push(value);},snapshot(){const retained=Math.min(total,8)+(total>8?1:0);return {totalCount:total,distinctIdentities:identities.size,duplicateCount:total-identities.size,first8,latest,retainedCount:retained,droppedCount:total-retained,truncated:total>retained};}};}
export function mapAimockTraceRendererV1(trace,rootFrameId){
 const frames=witnesses(),threads=witnesses(),pids=new Set(),tids=new Set();let malformed=0,foreignFrames=0,foreignThreads=0;
 const events=own(trace,'traceEvents'),eventCount=own(events,'length');let reason=null;
 if(!id(rootFrameId)||!Array.isArray(events)||!Number.isSafeInteger(eventCount)||eventCount<0)reason='invalid-mapping-input';
 else{
  for(let ei=0;ei<eventCount;ei++){
   const e=own(events,String(ei));if(own(e,'name')!=='TracingStartedInBrowser')continue;
   const category=own(e,'cat');if(own(e,'ph')!=='I'||typeof category!=='string'||category.length>4096||!category.split(',').includes('disabled-by-default-devtools.timeline')){malformed++;continue;}
   const records=own(own(own(e,'args'),'data'),'frames');if(!Array.isArray(records)){malformed++;continue;}
   const recordCount=own(records,'length');if(!Number.isSafeInteger(recordCount)||recordCount<0){malformed++;continue;}
   for(let fi=0;fi<recordCount;fi++){
    const record=own(records,String(fi)),frameId=own(record,'frame'),processId=own(record,'processId');
    if(!id(frameId)||!integer(processId)){malformed++;continue;}
    if(frameId!==rootFrameId){foreignFrames++;continue;}
    pids.add(processId);frames.add({eventIndex:ei,frameRecordIndex:fi,frameId,nestedProcessId:processId},String(processId));
   }
  }
  for(let ei=0;ei<eventCount;ei++){
   const e=own(events,String(ei));if(own(e,'name')!=='thread_name')continue;
   const name=own(own(e,'args'),'name');if(typeof name!=='string'){malformed++;continue;}if(name!=='CrRendererMain')continue;
   const pid=own(e,'pid'),tid=own(e,'tid');if(own(e,'ph')!=='M'||!integer(pid)||!integer(tid)){malformed++;continue;}
   if(!pids.has(pid)){foreignThreads++;continue;}
   tids.add(`${pid}:${tid}`);threads.add({eventIndex:ei,pid,tid},`${pid}:${tid}`);
  }
  reason=malformed?'malformed-relevant-metadata':pids.size>1?'conflicting-owned-frame-processes':pids.size===0?'owned-frame-missing':tids.size>1?'conflicting-renderer-main-threads':tids.size===0?'owned-renderer-main-missing':null;
 }
 const f=frames.snapshot(),t=threads.snapshot();const binding=reason?null:{frameId:rootFrameId,nestedProcessId:f.first8[0].nestedProcessId,pid:t.first8[0].pid,tid:t.first8[0].tid,frameEventIndex:f.first8[0].eventIndex,frameRecordIndex:f.first8[0].frameRecordIndex,threadEventIndex:t.first8[0].eventIndex};
 return freeze({schema:'aimock-trace-renderer-v1',status:reason?'unavailable':'available',reason,binding,frameWitnesses:f,threadWitnesses:t,foreignFrameCount:foreignFrames,foreignRendererMainCount:foreignThreads,malformedRelevantCount:malformed,performance:false,scoringEligibility:false,FPS:null});
}

