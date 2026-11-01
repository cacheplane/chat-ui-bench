// Controller observation only. No browser/source/OS clock conversion, CPU, paint,
// or FPS claim. Synchronous bookkeeping never owns or wraps an async operation.
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const PREVIEW_LIMITS=Object.freeze({units:'UTF-16-code-units',id:64,error:128,label:48,operationStatus:32,selectedItems:32});
const stringFields = (key,value,cap) => ({[key]:typeof value === 'string' ? value.slice(0,cap) : null,
 [key+'Chars']:typeof value === 'string' ? value.length : null,[key+'Truncated']:typeof value === 'string' ? value.length>cap : false});
const rect = value => value == null ? null : Object.fromEntries(['left','top','right','bottom'].map(key => [key,number(value[key])]));
const summarize = value => ({
 progress: value?.progress == null ? null : {
  messageCount:number(value.progress.messageCount), responseCharacters:number(value.progress.responseCharacters),
  ...stringFields('responseId',value.progress.responseId,PREVIEW_LIMITS.id), running:typeof value.progress.running === 'boolean' ? value.progress.running : null,
  ...stringFields('error',value.progress.error,PREVIEW_LIMITS.error), ...stringFields('operationStatus',value.progress.operation?.status,PREVIEW_LIMITS.operationStatus),
 },
 response:value?.response == null ? null : {...stringFields('id',value.response.id,PREVIEW_LIMITS.id),textChars:typeof value.response.text === 'string' ? value.response.text.length : null},
 dom:value?.dom == null ? null : {
  clip:rect(value.dom.clip),scroll:value.dom.scroll == null ? null : {top:number(value.dom.scroll.top),height:number(value.dom.scroll.height),clientHeight:number(value.dom.scroll.clientHeight)},
  itemsObserved:Array.isArray(value.dom.items) ? value.dom.items.length : null,
  itemsOmitted:Array.isArray(value.dom.items) ? Math.max(0,value.dom.items.length-PREVIEW_LIMITS.selectedItems) : null,
  items:Array.isArray(value.dom.items) ? value.dom.items.slice(0,PREVIEW_LIMITS.selectedItems).map(row => ({...stringFields('nativeId',row?.nativeId,PREVIEW_LIMITS.id),visible:typeof row?.visible === 'boolean' ? row.visible : null,rect:rect(row?.rect),textChars:typeof row?.text === 'string' ? row.text.length : null})) : [],
 },
});

/** Fixed retention: first eight + last sample, first31 + latest stage (32 rows).
 * Preview lengths count UTF-16 code units and never imply identity equality.
 * Original lengths and clipping flags distinguish capped invalid data. Strings and all
 * collections are bounded even for invalid samples; text bodies are never copied.
 * `now` is the once-bound controller performance.now; `origin` is caseStarted.
 */
export function createMatrixDiagnostics({now,origin}) {
 const record={schema:'matrix-observer-diagnostics-v1',clock:'node-controller-performance.now-relative-to-case-start',
  meaning:'Parent-observed dispatch/settlement elapsed ms; includes harness/roundtrip delay. Independent clock domains are not equated.',
  previewLimits:PREVIEW_LIMITS,performance:false,scoringEligibility:false,FPS:null,stages:[],droppedStages:0,sampleAttempts:0,droppedSamples:0,firstSamples:[],lastSample:null,terminalError:null};
 const elapsed=()=>number(now()-origin);
 let pendingStage=null,pendingSample=null;
 return {
  record,
  dispatched(name){
   const row={...stringFields('name',name,PREVIEW_LIMITS.label),dispatchElapsedMs:elapsed(),status:'pending'};
   pendingStage=row;
   if(record.stages.length<32)record.stages.push(row);else{record.stages[31]=row;record.droppedStages++;}
  },
  fulfilled(){if(pendingStage){pendingStage.fulfilledElapsedMs=elapsed();pendingStage.status='fulfilled';pendingStage=null;}},
  stageRejected(error){
   if(pendingStage){pendingStage.rejectedElapsedMs=elapsed();pendingStage.status='rejected';Object.assign(pendingStage,stringFields('error',String(error?.message??error),PREVIEW_LIMITS.error));pendingStage=null;}
  },
  sampleDispatched(name){
   const row={attempt:++record.sampleAttempts,...stringFields('stage',name,PREVIEW_LIMITS.label),dispatchElapsedMs:elapsed(),status:'pending',summary:null};
   if(record.firstSamples.length<8)record.firstSamples.push(row);
   record.lastSample=row;pendingSample=row;
   record.droppedSamples=Math.max(0,record.sampleAttempts-record.firstSamples.length-(record.sampleAttempts>8?1:0));
  },
  sampleFulfilled(value){
   if(pendingSample){pendingSample.fulfilledElapsedMs=elapsed();pendingSample.status='fulfilled';pendingSample.summary=summarize(value);pendingSample=null;}
  },
  terminal(error){record.terminalError??={elapsedMs:elapsed(),...stringFields('message',String(error?.message??error),PREVIEW_LIMITS.error)};},
  rejected(error){
   const at=elapsed(),reason=String(error?.message??error);
   for(const row of [pendingStage,pendingSample])if(row){row.rejectedElapsedMs=at;row.status='rejected';Object.assign(row,stringFields('error',reason,PREVIEW_LIMITS.error));}
   pendingStage=null;pendingSample=null;
   record.terminalError??={elapsedMs:at,...stringFields('message',reason,PREVIEW_LIMITS.error)};
  },
  // Preserve the terminal sample within the existing 64KiB failure reserve,
  // including the existing failure envelope's 4096-character error allowance.
  // Full retained rows remain in ordinary evidence when it is published.
  failureRecord(){const {firstSamples,stages,...rest}=record;return {...rest,firstSamplesOmitted:firstSamples.length,stagesOmitted:Math.max(0,stages.length-1),lastStage:stages.at(-1)??null};},
 };
}
