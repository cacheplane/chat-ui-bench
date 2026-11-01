import {createHash} from 'node:crypto';
import {parsePublicContext,closedData} from '../../competitors/shared/context.mjs';
import {historyPrefixCharacters,nativeHistorySeek} from './matrix-policy-v3.mjs';
import {continuationPath} from './admission.mjs';
const need=(value,reason)=>{if(!value)throw Error('matrix-'+reason);};
const prose=text=>text.replace(/[ \t\n\r\f\v]+/g,' ').replace(/^ | $/g,'');
const sha=text=>createHash('sha256').update(text).digest('hex');
const contexts=new WeakMap(),indexes=new WeakMap(),historyProse=new WeakMap();
function contextFor(input){let parsed=contexts.get(input);if(!parsed){parsed=parsePublicContext(input);need(parsed.schema===2,'context-schema');contexts.set(input,parsed);contexts.set(parsed,parsed);}return parsed;}
function contextIndex(context){let index=indexes.get(context.history);if(!index){index=new Map(context.history.map(message=>[message.id,message]));indexes.set(context.history,index);}return index;}
function operation(context,input,status){const value=closedData(input,['kind','status']);need(value.kind===(context.profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise'),'operation-kind');need((status?[status]:['idle','pending','fulfilled','rejected']).includes(value.status),'operation-status');return value;}
function dense(array,cap,label){need(Array.isArray(array)&&array.length<=cap,'array-'+label);for(let i=0;i<array.length;i++){const d=Object.getOwnPropertyDescriptor(array,String(i));need(d&&Object.hasOwn(d,'value'),'array-own-'+label);}return array;}
function message(input){const value=closedData(input,['id','role','text']);need(typeof value.id==='string'&&value.id.length>0&&value.id.length<=128&&['assistant','user'].includes(value.role)&&typeof value.text==='string','message');return value;}
/** Bookends only. Every actual historical row is compared in order. */
export function validateMatrixTranscript(input,state,{final=false,expectedResponse}={}){
 const context=contextFor(input),snapshot=closedData(state,['messages','running','error','responseId','operation']),h=context.history.length;
 operation(context,snapshot.operation,final?'fulfilled':'idle');need(snapshot.running===false&&snapshot.error===null,'runtime-completion');
 dense(snapshot.messages,h+1,'transcript');need(snapshot.messages.length===h+(final?1:0),'transcript-length');
 const seen=new Set();
 for(let i=0;i<snapshot.messages.length;i++){
  const actual=message(snapshot.messages[i]);need(!seen.has(actual.id),'duplicate-message');seen.add(actual.id);
  if(i<h){const expected=context.history[i];need(actual.id===expected.id&&actual.role===expected.role&&actual.text===expected.text,'history-conservation');}
  else{need(actual.id===snapshot.responseId&&actual.role==='assistant','response-identity');need(expectedResponse===undefined?actual.text.length===context.workload.responseBytes&&sha(actual.text)===context.digests.responseSha256:actual.text===expectedResponse,'response-content');}
 }
 if(!final){need(snapshot.responseId===null,'initial-response');return null;}
 return{canonicalId:context.canonicalResponseId,nativeId:snapshot.responseId};
}
/** Scalar metadata from the actual SDK; no historical projection in this path. */
export function validateMatrixProgress(input,state){
 const context=contextFor(input),value=closedData(state,['schema','messageCount','responseId','responseCharacters','running','error','operation']),h=context.history.length;
 need(value.schema===1&&typeof value.running==='boolean'&&value.error===null,'progress-runtime');operation(context,value.operation);
 need(Number.isSafeInteger(value.messageCount)&&(value.messageCount===h||value.messageCount===h+1),'progress-count');
 if(value.messageCount===h)need(value.responseId===null&&value.responseCharacters===null,'progress-no-response');
 else need(typeof value.responseId==='string'&&value.responseId.length>0&&value.responseId.length<=128&&!contextIndex(context).has(value.responseId)&&Number.isSafeInteger(value.responseCharacters)&&value.responseCharacters>=0&&value.responseCharacters<=context.workload.responseBytes,'progress-response');
 need(value.operation.status!=='rejected','progress-rejected');
 if(value.operation.status==='idle')need(!value.running&&value.messageCount===h,'progress-idle');
 if(value.operation.status==='pending')need(value.running,'progress-pending');
 if(value.operation.status==='fulfilled')need(!value.running&&value.messageCount===h+1,'progress-fulfilled');
 return value;
}
const visibleIndexes=new WeakMap();
function visibleIndex(messages){let result=visibleIndexes.get(messages);if(!result){result=new Map();for(const raw of dense(messages,10001,'messages')){const value=message(raw),key=prose(value.text),rows=result.get(key)??[];rows.push(value);result.set(key,rows);}visibleIndexes.set(messages,result);}return result;}
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
export function matchMatrixVisible(dom,messages,{responsePrefixId=null}={}){
 const index=visibleIndex(messages),result=[];
 const response=responsePrefixId===null?null:messages.find(row=>row.id===responsePrefixId);
 for(const item of selectedDOM(dom,262144)){
  if(!item.text.trim())continue;
  const normalized=prose(item.text),matches=[...(index.get(normalized)??[])];
  if(response&&response.role==='assistant'&&normalized.length>0&&normalized!==prose(response.text)&&prose(response.text).startsWith(normalized))matches.push(response);
  need(matches.length===1,'dom-content-correspondence');const actual=matches[0];
  need(item.text.length<=actual.text.length,'dom-message-text-bound');
  need(item.nativeId===null||item.nativeId===actual.id,'dom-native-id-contradiction');
  need(item.rect&&Object.values(item.rect).every(Number.isFinite)&&item.rect.right>item.rect.left&&item.rect.bottom>item.rect.top,'dom-geometry');
  result.push({id:actual.id,role:actual.role,identityEvidence:item.nativeId===null?'unique-prose-correspondence':'native-message-attribute',rect:item.rect});
 }
 need(result.length>0,'visible-dom-empty');return result;
}
export function matrixStreamingReadiness(input,progress,response,dom){
 const context=contextFor(input);validateMatrixProgress(context,progress);
 need(progress.running&&progress.operation.status==='pending','active-history-phase');
 const minimum=historyPrefixCharacters(context.workload.responseBytes);
 need(response!==null&&response?.role==='assistant'&&response.id===progress.responseId&&typeof response.text==='string'&&response.text.length>=minimum&&response.text.length<=progress.responseCharacters,'streaming-response-not-ready');
 let historical=historyProse.get(context);if(!historical){historical=new Set(context.history.map(row=>prose(row.text)));historyProse.set(context,historical);}
 const current=prose(response.text),candidates=selectedDOM(dom,context.workload.responseBytes).filter(item=>{
  if(item.visible!==true||typeof item.text!=='string'||item.text.length<minimum||item.text.length>context.workload.responseBytes||item.nativeId!==null&&item.nativeId!==response.id)return false;
  const prefix=prose(item.text);return prefix.length>=minimum&&current.startsWith(prefix)&&!historical.has(prefix);
 });
 need(candidates.length===1,'streaming-response-not-ready');
 return{responseId:response.id,sdkCharacters:response.text.length,domCharacters:candidates[0].text.length,visible:true,identityEvidence:candidates[0].nativeId===null?'unique-current-response-prefix':'native-message-attribute',responseRect:candidates[0].rect};
}
function validateSource(value,source,omission){
 const context=contextFor(value.publicContext);need(source?.schema===2&&source.protocol==='matrix-v3'&&source.profile===context.profile&&source.sourceOrigin==='actual-aimock-compiler','source-protocol');
 need(source.closed===true&&Array.isArray(source.errors)&&source.errors.length===0,'source-task-errors');
 const expected=[];
 for(const [kind,events] of [['seed',value.historyRestore],['continuation',value.continuation]]){
  const playback=source.playbacks?.[kind];
  // All profiles compile the same seed. Only Copilot's reconnect fetch plays it.
  const required=kind==='continuation'||context.profile==='copilotkit';
  if(!required&&playback?.started===false){need(playback.completed===false&&playback.aborted===false&&playback.error===null,'unused-seed');continue;}
  need(playback?.started===true&&playback.completed===true&&playback.aborted===false&&playback.error===null,'source-original-completion');
  for(let index=0;index<events.length;index++){const event=events[index];if(kind==='continuation'&&event.type==='TEXT_MESSAGE_CONTENT'&&event.metadata.scheduledMs===omission*50)continue;expected.push({kind,index,eventType:event.type,scheduledMs:event.metadata.scheduledMs});}
 }
 dense(source.sourceEmissions,207,'source-emissions');need(source.sourceEmissions.length===expected.length,'source-event-count');
 let previous=new Map();
 for(let i=0;i<expected.length;i++){
  const actual=closedData(source.sourceEmissions[i],['kind','index','eventType','scheduledMs','emittedMs','latenessMs']),row=expected[i];
  need(Object.entries(row).every(([key,v])=>actual[key]===v)&&Number.isFinite(actual.emittedMs)&&actual.emittedMs>=(previous.get(row.kind)??0)&&Number.isFinite(actual.latenessMs)&&actual.latenessMs===Math.max(0,actual.emittedMs-actual.scheduledMs),'source-event-custody');previous.set(row.kind,actual.emittedMs);
 }
}
export function admitMatrixCase(value,evidence,{initial,final,allowOmittedDelta}={}){
 need(allowOmittedDelta===undefined||allowOmittedDelta===100,'negative-selection');const context=contextFor(value.publicContext);
 if(allowOmittedDelta!==undefined)need(context.profile==='vercel-ai-sdk'&&context.workload.historyCount===10000&&context.workload.responseBytes===262144&&context.workload.journey==='follow','negative-selection');
 validateMatrixTranscript(context,initial);
 const expectedResponse=allowOmittedDelta===undefined?undefined:value.continuation.filter(x=>x.type==='TEXT_MESSAGE_CONTENT'&&x.metadata.scheduledMs!==allowOmittedDelta*50).map(x=>x.delta).join('');
 const responseIdentity=validateMatrixTranscript(context,final,{final:true,expectedResponse});
 need(Array.isArray(evidence.pageErrors)&&evidence.pageErrors.length===0&&Array.isArray(evidence.consoleErrors)&&evidence.consoleErrors.length===0&&Array.isArray(evidence.network?.resourceErrors)&&evidence.network.resourceErrors.length===0,'browser-errors');
 const before=evidence.networkGuardBeforeCleanup,after=evidence.networkGuardAfterCleanup;
 need(before?.closed===false&&before.overflow===false&&after?.closed===true&&after.overflow===false&&before.policy?.version==='chromium-cdp-owned-origin-block-v1'&&after.policy?.version===before.policy.version,'network-guard');
 const initialVisible=matchMatrixVisible(evidence.domInitial,initial.messages),finalVisible=matchMatrixVisible(evidence.domFinal,final.messages);
 need(finalVisible.some(x=>x.id===responseIdentity.nativeId),'response-not-visible');
 const h=context.history.length;
 if(evidence.capabilities?.rendering==='all-mounted')need(evidence.domInitial.mountedCount===h&&evidence.domFinal.mountedCount===h+1,'all-mounted-count');
 else need(evidence.capabilities?.rendering==='virtualized'&&Number.isInteger(evidence.domInitial.mountedCount)&&evidence.domInitial.mountedCount>0&&evidence.domInitial.mountedCount<=h&&Number.isInteger(evidence.domFinal.mountedCount)&&evidence.domFinal.mountedCount>0&&evidence.domFinal.mountedCount<=h+1,'virtualized-count');
 validateSource(value,evidence.server,allowOmittedDelta);
 const endpoint=continuationPath(context.profile),rows=evidence.server.requests.filter(x=>x.path===endpoint&&x.method===(context.profile==='threadplane'?'GET':'POST'));
 need(rows.length===1&&rows[0].status===200&&rows[0].sourceEof===true&&rows[0].responseFinished===true&&rows[0].responseClosed===true&&rows[0].clientAborted===false&&rows[0].error===null,'original-http-completion');
 need(evidence.network.finished.includes(endpoint)&&evidence.network.failed.length===0&&evidence.network.external.length===0,'browser-network-completion');
 const cleanup=evidence.cleanup;need(cleanup?.publicDispose?.settled===true&&cleanup.publicDispose.fulfilled===true&&cleanup.browserClosed===true&&cleanup.serverExit?.code===0&&cleanup.serverExit.signal===null&&cleanup.serverClose?.code===0&&cleanup.serverClose.signal===null,'original-cleanup');
 let readiness=null,anchor=null;
 if(context.workload.journey==='history-reading'){
  readiness=matrixStreamingReadiness(context,evidence.beforeWheelProgress,evidence.beforeWheelResponse,evidence.domBeforeWheel);
  const seek=nativeHistorySeek({clip:evidence.domBeforeWheel.clip,responseRect:readiness.responseRect}),scroll=evidence.scroll;
  need(scroll?.nativeDispatch===true&&scroll.policy===seek.policy&&scroll.desiredUp===seek.desiredUp&&scroll.deltaY===seek.deltaY&&Number.isFinite(scroll.beforeTop)&&Number.isFinite(scroll.afterTop)&&scroll.afterTop<scroll.beforeTop-1&&scroll.returnClicked===true,'native-history-scroll');
  need(Array.isArray(evidence.wheelEvents)&&evidence.wheelEvents.length>0&&evidence.wheelEvents.length<=32&&evidence.wheelEvents.every(event=>event.trusted===true&&Number.isFinite(event.deltaY)&&event.deltaY<0&&event.defaultPrevented===false)&&evidence.wheelEvents.reduce((sum,event)=>sum+event.deltaY,0)===scroll.deltaY,'native-wheel-custody');
  need(contextIndex(context).has(scroll.anchorId),'historical-anchor');
  need(matchMatrixVisible(evidence.domAfterWheel,final.messages,{responsePrefixId:responseIdentity.nativeId}).some(x=>x.id===scroll.anchorId)&&matchMatrixVisible(evidence.domBeforeReturn,final.messages).some(x=>x.id===scroll.anchorId),'historical-anchor');anchor=scroll.anchorId;
 }
 return{schema:'four-stack-matrix-conformance-v3',profile:context.profile,workload:context.workload,status:allowOmittedDelta===undefined?'functional-pass':'negative-control-pass',responseIdentity,initialVisible,finalVisible,historicalAnchor:anchor,historyReadiness:readiness,scope:'Actual public SDK state, selected DOM prose, original source/HTTP/process closure; no pixel presentation or performance authority',performance:false,scoringEligibility:false,FPS:null};
}
