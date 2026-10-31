import {parsePublicContext,closedData} from '../../competitors/shared/context.mjs';
import {validateFinalSnapshot} from './fixtures.mjs';
const need=(value,reason)=>{if(!value)throw Error('competitor-'+reason);};
const prose=text=>text.replace(/[ \t\n\r\f\v]+/g,' ').replace(/^ | $/g,'');
export function validateHistory(context,input){
 const snapshot=closedData(input,['messages','running','error','responseId','operation']);
 need(snapshot.running===false&&snapshot.error===null&&snapshot.responseId===null&&snapshot.operation.status==='idle','initial-runtime');
 need(Array.isArray(snapshot.messages)&&snapshot.messages.length===100,'initial-history-length');
 for(let i=0;i<100;i++){const actual=closedData(snapshot.messages[i],['id','role','text']),expected=context.history[i];need(actual.id===expected.id&&actual.role===expected.role&&actual.text===expected.text,'initial-history-content');}
}
export function matchVisible(dom,messages){
 need(dom&&Array.isArray(dom.errors)&&dom.errors.length===0&&Array.isArray(dom.items)&&dom.items.length<=256,'dom-observation');
 const result=[];
 for(const item of dom.items){
  if(!item.visible)continue;need(typeof item.text==='string'&&item.text.length<=8192,'dom-text-bound');if(!item.text.trim())continue;
  const matches=messages.filter(m=>prose(m.text)===prose(item.text));need(matches.length===1,'dom-content-correspondence');const match=matches[0];
  need(item.nativeId===null||item.nativeId===match.id,'dom-native-id-contradiction');
  result.push({id:match.id,role:match.role,identityEvidence:item.nativeId===null?'unique-prose-correspondence':'native-message-attribute',top:item.top,bottom:item.bottom});
 }
 need(result.length>0,'visible-dom-empty');return result;
}
export function continuationPath(profile){return profile==='copilotkit'?'/copilot/agent/default/run':profile==='threadplane'?'/stream/canonical':'/stream/ui';}
export function streamingReadiness(context,snapshot,dom){
 need(snapshot?.running===true&&snapshot.error===null&&snapshot.operation?.status==='pending','active-history-phase');
 const response=snapshot.messages?.at(-1);
 need(response?.role==='assistant'&&response.id===snapshot.responseId&&typeof response.text==='string'&&response.text.length>=512,'streaming-state');
 need(dom&&Array.isArray(dom.errors)&&dom.errors.length===0&&Array.isArray(dom.items),'streaming-dom');
 const candidates=dom.items.filter(item=>{
  if(!item.visible||typeof item.text!=='string'||item.text.length<512||item.text.length>8192)return false;
  const prefix=prose(item.text);if(prefix.length<512||!prose(response.text).startsWith(prefix)||item.nativeId!==null&&item.nativeId!==response.id)return false;
  return snapshot.messages.filter(message=>prose(message.text).startsWith(prefix)).length===1;
 });
 need(candidates.length===1&&!context.history.some(message=>message.id===response.id),'streaming-response-not-ready');
 return{responseId:response.id,sdkCharacters:response.text.length,domCharacters:candidates[0].text.length,visible:true,identityEvidence:candidates[0].nativeId===null?'unique-current-response-prefix':'native-message-attribute'};
}
export function admitFunctionalCase(value,evidence){
 need(Array.isArray(evidence.pageErrors)&&evidence.pageErrors.length===0&&Array.isArray(evidence.network?.resourceErrors)&&evidence.network.resourceErrors.length===0,'browser-errors');
 const guardBefore=evidence.networkGuardBeforeCleanup,guardAfter=evidence.networkGuardAfterCleanup;
 need(guardBefore?.closed===false&&guardBefore.overflow===false&&guardAfter?.closed===true&&guardAfter.overflow===false&&guardBefore.policy?.version==='chromium-cdp-owned-origin-block-v1'&&guardAfter.policy?.version===guardBefore.policy.version,'network-guard');
 const context=parsePublicContext(value.publicContext);validateHistory(context,evidence.initial);
 const responseIdentity=validateFinalSnapshot(value,evidence.final),initialVisible=matchVisible(evidence.domInitial,evidence.initial.messages),finalVisible=matchVisible(evidence.domFinal,evidence.final.messages);
 need(finalVisible.some(x=>x.id===responseIdentity.nativeId),'response-not-visible');
 if(evidence.capabilities.rendering==='all-mounted')need(evidence.domInitial.mountedCount===100&&evidence.domFinal.mountedCount===101,'all-mounted-count');
 else need(evidence.capabilities.rendering==='virtualized'&&evidence.domInitial.mountedCount>0&&evidence.domInitial.mountedCount<=100&&evidence.domFinal.mountedCount>0&&evidence.domFinal.mountedCount<=101,'virtualized-count');
 const source=evidence.server,playback=source?.playbacks?.continuation;
 need(Array.isArray(source?.errors)&&source.errors.length===0,'source-task-errors');
 need(source.closed===true&&playback?.started===true&&playback.completed===true&&playback.aborted===false&&playback.error===null,'source-original-completion');
 const emissions=source.sourceEmissions.filter(x=>x.kind==='continuation');need(emissions.length===204&&emissions.filter(x=>x.eventType==='TEXT_MESSAGE_CONTENT').length===200,'source-event-count');
 const path=continuationPath(context.profile),rows=source.requests.filter(x=>x.path===path&&x.method===(context.profile==='threadplane'?'GET':'POST'));
 need(rows.length===1&&rows[0].status===200&&rows[0].sourceEof===true&&rows[0].responseFinished===true&&rows[0].responseClosed===true&&rows[0].clientAborted===false&&rows[0].error===null,'original-http-completion');
 need(evidence.network.finished.includes(path)&&evidence.network.failed.length===0&&evidence.network.external.length===0,'browser-network-completion');
 const cleanup=evidence.cleanup;need(cleanup.publicDispose.settled===true&&cleanup.publicDispose.fulfilled===true&&cleanup.browserClosed===true&&cleanup.serverExit.code===0&&cleanup.serverExit.signal===null&&cleanup.serverClose.code===0&&cleanup.serverClose.signal===null,'original-cleanup');
 let anchor=null,readiness=null;
 if(context.workload.journey==='history-reading'){
  readiness=streamingReadiness(context,evidence.beforeWheelState,evidence.domBeforeWheel);
  const scroll=evidence.scroll;need(scroll?.nativeDispatch===true&&scroll.deltaY<0&&Number.isFinite(scroll.beforeTop)&&Number.isFinite(scroll.afterTop)&&scroll.afterTop<scroll.beforeTop-1&&scroll.returnClicked===true,'native-history-scroll');
  need(context.history.some(message=>message.id===scroll.anchorId),'historical-anchor');
  const after=matchVisible(evidence.domAfterWheel,evidence.final.messages),beforeReturn=matchVisible(evidence.domBeforeReturn,evidence.final.messages);
  need(after.some(x=>x.id===scroll.anchorId)&&beforeReturn.some(x=>x.id===scroll.anchorId),'historical-anchor');anchor=scroll.anchorId;
 }
 return{schema:'four-stack-functional-conformance-v2',profile:context.profile,journey:context.workload.journey,status:'functional-pass',responseIdentity,initialVisible,finalVisible,historicalAnchor:anchor,historyReadiness:readiness,scope:'Public SDK prose state, selected visible DOM correspondence, original source/HTTP/process closure; not pixel presentation or performance qualification',performance:false,scoringEligibility:false,FPS:null};
}
