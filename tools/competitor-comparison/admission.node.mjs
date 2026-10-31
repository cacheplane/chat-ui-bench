import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunctionalCase} from './fixtures.mjs';
const api=await import('./admission.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
function authored(journey='follow'){
 const value=createFunctionalCase('vercel-ai-sdk',journey),history=value.publicContext.history;
 const response={id:'response-100',role:'assistant',text:value.fixture.events.filter(x=>x.type==='text-delta').map(x=>x.text).join('')};
 const initial={messages:history,running:false,error:null,responseId:null,operation:{kind:'original-run-promise',status:'idle'}};
 const final={messages:[...history,response],running:false,error:null,responseId:response.id,operation:{kind:'original-run-promise',status:'fulfilled'}};
 const dom=message=>({mountedCount:100,errors:[],items:[{nativeId:message.id,text:message.text,visible:true,top:100,bottom:200}]});
 const evidence={pageErrors:[],initial,final,capabilities:{rendering:'all-mounted',scrollPolicy:'bottom-follow',returnToResponse:'native-control'},domInitial:dom(history[99]),domFinal:{...dom(response),mountedCount:101},server:{closed:true,errors:[],playbacks:{continuation:{started:true,completed:true,aborted:false,error:null}},sourceEmissions:value.continuation.map(x=>({kind:'continuation',eventType:x.type})),requests:[{method:'POST',path:'/stream/ui',status:200,sourceEof:true,responseFinished:true,responseClosed:true,clientAborted:false,error:null}]},network:{finished:['/stream/ui'],failed:[],external:[],resourceErrors:[]},cleanup:{publicDispose:{settled:true,fulfilled:true},browserClosed:true,serverExit:{code:0,signal:null},serverClose:{code:0,signal:null}}};
 if(journey==='history-reading'){evidence.domAfterWheel=dom(history[98]);evidence.domBeforeReturn=dom(history[98]);evidence.scroll={deltaY:-600,beforeTop:1200,afterTop:600,anchorId:'history-98',nativeDispatch:true,returnClicked:true};}
 evidence.networkGuardBeforeCleanup={closed:false,overflow:false,policy:{version:'chromium-cdp-owned-origin-block-v1'}};evidence.networkGuardAfterCleanup={closed:true,overflow:false,policy:{version:'chromium-cdp-owned-origin-block-v1'}};return{value,evidence};
}
test('functional admission preserves unavailable performance/FPS meaning',()=>{
 assert.equal(typeof api.admitFunctionalCase,'function');const{value,evidence}=authored();const out=api.admitFunctionalCase(value,evidence);
 assert.equal(out.status,'functional-pass');assert.equal(out.performance,false);assert.equal(out.FPS,null);assert.equal(out.scoringEligibility,false);
});
test('history reading requires actual native movement, a preserved visible anchor and native return',()=>{
 {const{value,evidence}=authored('history-reading');assert.equal(api.admitFunctionalCase(value,evidence).status,'functional-pass');}
 for(const change of [x=>x.scroll.afterTop=1400,x=>x.scroll.nativeDispatch=false,x=>x.scroll.returnClicked=false,x=>x.domBeforeReturn.items=[]]){const{value,evidence}=authored('history-reading');change(evidence);assert.throws(()=>api.admitFunctionalCase(value,evidence));}
});
test('full text and original promise fulfillment cannot replace normal source/HTTP/client completion',()=>{
 for(const change of [x=>x.server.playbacks.continuation.completed=false,x=>x.server.sourceEmissions.pop(),x=>x.server.requests[0].sourceEof=false,x=>x.server.requests[0].clientAborted=true,x=>x.server.requests[0].responseFinished=false,x=>x.network.finished=[],x=>x.network.failed=['/stream/ui'],x=>x.cleanup.publicDispose.settled=false,x=>x.cleanup.serverExit.code=1,x=>x.final.error='aborted']){const{value,evidence}=authored();change(evidence);assert.throws(()=>api.admitFunctionalCase(value,evidence));}
});
test('visible prose matching refuses foreign/contradictory content rather than assuming SDK state proves DOM',()=>{
 for(const change of [x=>x.domFinal.items[0].text='not rendered canonical response',x=>x.domFinal.items[0].nativeId='history-3',x=>x.domFinal.items[0].visible=false,x=>x.domFinal.errors=['content absent']]){const{value,evidence}=authored();change(evidence);assert.throws(()=>api.admitFunctionalCase(value,evidence));}
});
test('a visible response cannot stand in for a preserved historical anchor',()=>{
 const{value,evidence}=authored('history-reading');
 evidence.scroll.anchorId=evidence.final.responseId;
 evidence.domAfterWheel=evidence.domFinal;evidence.domBeforeReturn=evidence.domFinal;
 assert.throws(()=>api.admitFunctionalCase(value,evidence),/historical-anchor/);
});
test('unhandled source task errors invalidate otherwise complete observations',()=>{
 const{value,evidence}=authored();evidence.server.errors=['unhandled source task'];
 assert.throws(()=>api.admitFunctionalCase(value,evidence),/source-task-errors/);
});
test('late browser errors remain fatal after otherwise successful cleanup',()=>{
 const{value,evidence}=authored();evidence.pageErrors=['unmount failure'];
 assert.throws(()=>api.admitFunctionalCase(value,evidence),/browser-errors/);
});
test('network guard must remain bounded and live through validation, then close originally',()=>{
 for(const change of [x=>x.networkGuardBeforeCleanup.closed=true,x=>x.networkGuardAfterCleanup.closed=false,x=>x.networkGuardAfterCleanup.overflow=true]){
  const{value,evidence}=authored();change(evidence);assert.throws(()=>api.admitFunctionalCase(value,evidence),/network-guard/);
 }
});
