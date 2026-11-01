import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatrixCase} from './matrix-fixtures-v3.mjs';
import {readFileSync} from 'node:fs';
import {MATRIX_V4_ACQUISITION,nativeHistorySeekV4} from './matrix-policy-v4.mjs';
import {scheduledPlayback} from './wire.mjs';
const api=await import('./matrix-admission-v4.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const create=(profile='vercel-ai-sdk',historyCount=100,responseBytes=6400,journey='follow')=>createMatrixCase({profile,historyCount,responseBytes,journey});
const text=value=>value.continuation.filter(x=>x.type==='TEXT_MESSAGE_CONTENT').map(x=>x.delta).join('');
const op=(value,status)=>({kind:value.publicContext.profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise',status});
function snapshot(value,final=false,response=text(value)){return{messages:[...value.publicContext.history,...(final?[{id:'actual-native-response',role:'assistant',text:response}]:[])],running:false,error:null,responseId:final?'actual-native-response':null,operation:op(value,final?'fulfilled':'idle')};}
const rect={left:0,top:0,right:900,bottom:600};
function dom(message,count){return{schema:'matrix-dom-selected-v3',mountedCount:count,errors:[],clip:rect,scroll:{top:0,height:1000,clientHeight:600,rect:{x:0,y:0,width:900,height:600}},items:[{nativeId:message.id,identityAttribute:'data-message-id',text:message.text,visible:true,rect,hitPoints:[12]}],missingContentCount:0};}
async function complete(value,omitDelta){
 const sourceEmissions=[];let time=0;
 for(const kind of ['seed','continuation'])for await(const event of scheduledPlayback(value,kind,{signal:new AbortController().signal,now:()=>time,wait:async ms=>{time+=ms;},observe:row=>sourceEmissions.push(row),omitDelta:kind==='continuation'?omitDelta:undefined}))void event;
 const path='/stream/ui',complete={started:true,completed:true,aborted:false,error:null};
 const initial=snapshot(value),final=snapshot(value,true,omitDelta?value.continuation.filter((x)=>x.type==='TEXT_MESSAGE_CONTENT'&&x.metadata.scheduledMs!==omitDelta*50).map(x=>x.delta).join(''):text(value));
 return{initial,final,evidence:{schema:'four-stack-matrix-evidence-v4',acquisition:MATRIX_V4_ACQUISITION,capabilities:{rendering:'all-mounted',scrollPolicy:'bottom-follow',returnToResponse:'native-control'},domInitial:dom(initial.messages.at(-1),value.publicContext.history.length),domFinal:dom(final.messages.at(-1),value.publicContext.history.length+1),pageErrors:[],consoleErrors:[],network:{finished:[path],failed:[],external:[],resourceErrors:[]},networkGuardBeforeCleanup:{closed:false,overflow:false,policy:{version:'chromium-cdp-owned-origin-block-v1'}},networkGuardAfterCleanup:{closed:true,overflow:false,policy:{version:'chromium-cdp-owned-origin-block-v1'}},server:{schema:2,protocol:'matrix-v3',profile:value.publicContext.profile,sourceOrigin:'actual-aimock-compiler',closed:true,errors:[],sourceEmissions,playbacks:{seed:complete,continuation:complete},requests:[{path,method:'POST',status:200,sourceEof:true,responseFinished:true,responseClosed:true,clientAborted:false,error:null}]},cleanup:{publicDispose:{settled:true,fulfilled:true},browserClosed:true,serverExit:{code:0,signal:null},serverClose:{code:0,signal:null}}}};
}
test('all actual H/R bookends conserve every ordered message and complete response',()=>{
 assert.equal(typeof api.validateMatrixTranscript,'function');
 for(const h of [100,1000,10000])for(const r of [6400,262144]){
  const value=create('vercel-ai-sdk',h,r),initial=snapshot(value),final=snapshot(value,true);
  assert.equal(api.validateMatrixTranscript(value.publicContext,initial),null);
  assert.equal(api.validateMatrixTranscript(value.publicContext,final,{final:true}).nativeId,'actual-native-response');
  for(const mutate of [x=>x.messages[41]={...x.messages[41],text:'x'},x=>delete x.messages[41],x=>x.messages[41]=x.messages[42],x=>x.operation.status='pending',x=>x.messages.at(-1).text+='x']){
   const wrong=structuredClone(final);mutate(wrong);assert.throws(()=>api.validateMatrixTranscript(value.publicContext,wrong,{final:true}));
  }
 }
});
test('progress validates scalar actual state and refuses counterfeit completion/identity/errors',()=>{
 assert.equal(typeof api.validateMatrixProgress,'function');const value=create();
 const state={schema:1,messageCount:101,responseId:'opaque-native',responseCharacters:512,running:true,error:null,operation:op(value,'pending')};
 assert.deepEqual(api.validateMatrixProgress(value.publicContext,state),state);
 for(const mutate of [x=>x.responseCharacters=6401,x=>x.messageCount=102,x=>x.error='original-error',x=>x.operation.kind='unknown',x=>x.responseId=value.publicContext.history[0].id,x=>x.running=false,x=>x.responseCharacters=null,x=>x.extra=true]){const wrong=structuredClone(state);mutate(wrong);assert.throws(()=>api.validateMatrixProgress(value.publicContext,wrong));}
});
test('visible correspondence requires unique actual prose and refuses contradictory native ID',()=>{
 assert.equal(typeof api.matchMatrixVisible,'function');const value=create(),initial=snapshot(value),view=dom(initial.messages[0],100);
 assert.equal(api.matchMatrixVisible(view,initial.messages)[0].id,initial.messages[0].id);
 view.items[0].nativeId=initial.messages[1].id;assert.throws(()=>api.matchMatrixVisible(view,initial.messages));
 view.items[0].nativeId=null;view.items[0].identityAttribute=null;assert.equal(api.matchMatrixVisible(view,initial.messages)[0].identityEvidence,'unique-prose-correspondence');
 assert.throws(()=>api.matchMatrixVisible(view,[...initial.messages,{id:'duplicate-prose',role:'user',text:initial.messages[0].text}]));
 view.errors=['hidden-text-read'];assert.throws(()=>api.matchMatrixVisible(view,initial.messages));
});
test('render readiness uses sixteen canonical deltas at both response sizes',()=>{
 assert.equal(typeof api.matrixStreamingReadiness,'function');
 for(const r of [6400,262144]){
  const value=create('vercel-ai-sdk',100,r,'history-reading'),prefix=text(value).slice(0,r===6400?512:20976),response={id:'actual-native',role:'assistant',text:prefix};
  const progress={schema:1,messageCount:101,responseId:response.id,responseCharacters:prefix.length,running:true,error:null,operation:op(value,'pending')};
  const view=dom(response,null);assert.deepEqual(api.matrixStreamingReadiness(value.publicContext,progress,response,view).responseRect,rect);
  response.text=response.text.slice(0,-1);progress.responseCharacters--;view.items[0].text=response.text;assert.throws(()=>api.matrixStreamingReadiness(value.publicContext,progress,response,view),/matrix-streaming-response-not-ready/);
 }
});
test('selected DOM refuses offscreen, missing hits, excess historical text and absent response geometry',()=>{
 const value=create(),initial=snapshot(value),view=dom(initial.messages[0],100);
 for(const mutate of [x=>x.items[0].rect={left:2000,top:2000,right:2100,bottom:2100},x=>x.items[0].hitPoints=[],x=>x.items[0].hitPoints=[27],x=>x.items[0].text+=' '.repeat(6400),x=>delete x.items[0].rect,x=>x.clip.right=0,x=>x.items[0].identityAttribute='invented']){const wrong=structuredClone(view);mutate(wrong);assert.throws(()=>api.matchMatrixVisible(wrong,initial.messages));}
 const response={id:'actual-native',role:'assistant',text:text(value).slice(0,512)},progress={schema:1,messageCount:101,responseId:response.id,responseCharacters:512,running:true,error:null,operation:op(value,'pending')};
 const bad=dom(response,null);delete bad.items[0].rect;assert.throws(()=>api.matrixStreamingReadiness(value.publicContext,progress,response,bad));
});
test('whole admission requires original source/HTTP/browser/process custody',async()=>{
 assert.equal(typeof api.admitMatrixCase,'function');const value=create(),state=await complete(value);
 assert.equal(api.admitMatrixCase(value,state.evidence,state).status,'functional-pass');
 for(const mutate of [x=>x.cleanup.publicDispose.fulfilled=false,x=>x.cleanup.serverExit.signal='SIGTERM',x=>x.server.sourceEmissions[5].index++,x=>x.server.sourceEmissions[5].latenessMs=NaN,x=>x.server.requests[0].sourceEof=false,x=>x.network.failed.push({error:'net::ERR_ABORTED'}),x=>x.consoleErrors.push('late-error'),x=>x.server.schema=1,x=>x.networkGuardAfterCleanup.closed=false]){const wrong=structuredClone(state.evidence);mutate(wrong);assert.throws(()=>api.admitMatrixCase(value,wrong,state));}
});
test('honest original fractional timer receipts preserve exact schedule and measured monotonic time',async()=>{
 const value=create(),state=await complete(value),receipt=state.evidence.server.sourceEmissions.find(x=>x.kind==='continuation'&&x.scheduledMs===200);
 receipt.emittedMs=199.946833;receipt.latenessMs=0;
 assert.equal(api.admitMatrixCase(value,state.evidence,state).status,'functional-pass');
 receipt.emittedMs=-1;assert.throws(()=>api.admitMatrixCase(value,state.evidence,state),/source-event-custody/);
});
test('history anchor accepts verified current-response prefix while preserving every selected historical row',async()=>{
 const value=create('vercel-ai-sdk',100,6400,'history-reading'),state=await complete(value),response={...state.final.messages.at(-1),text:text(value).slice(0,512)},anchor=state.initial.messages.at(-1);
 Object.assign(state.evidence,{beforeWheelProgress:{schema:1,messageCount:101,responseId:response.id,responseCharacters:512,running:true,error:null,operation:op(value,'pending')},beforeWheelResponse:response,domBeforeWheel:dom(response,null),domAfterWheel:{...dom(anchor,null),items:[...dom(anchor,null).items,...dom(response,null).items]},domBeforeReturn:dom(anchor,null),scroll:{nativeDispatch:true,deltaY:-1200,desiredUp:1200,policy:'visible-response-below-viewport-one-response-headroom-v4',beforeTop:1000,afterTop:400,anchorId:anchor.id,returnClicked:true},wheelEvents:[{trusted:true,deltaY:-1200,defaultPrevented:false}]});
 assert.equal(api.admitMatrixCase(value,state.evidence,state).historicalAnchor,anchor.id);
 state.evidence.domAfterWheel.items[1].text='fabricated response prefix';assert.throws(()=>api.admitMatrixCase(value,state.evidence,state));
});
test('omission negative requires exact199 source/content and every other custody gate',async()=>{
 assert.equal(typeof api.admitMatrixCase,'function');const value=create('vercel-ai-sdk',10000,262144),state=await complete(value,100);
 assert.throws(()=>api.admitMatrixCase(value,state.evidence,state),/matrix-response-content/);
 assert.equal(api.admitMatrixCase(value,state.evidence,{...state,allowOmittedDelta:100}).status,'negative-control-pass');
 const wrong=structuredClone(state);wrong.final.messages.at(-1).text=wrong.final.messages.at(-1).text.slice(1);assert.throws(()=>api.admitMatrixCase(value,wrong.evidence,{...wrong,allowOmittedDelta:100}));
 state.evidence.cleanup.publicDispose.fulfilled=false;assert.throws(()=>api.admitMatrixCase(value,state.evidence,{...state,allowOmittedDelta:100}));
 assert.throws(()=>api.admitMatrixCase(value,state.evidence,{...state,allowOmittedDelta:99}));
 const offPolicy=create(),offState=await complete(offPolicy,100);assert.throws(()=>api.admitMatrixCase(offPolicy,offState.evidence,{...offState,allowOmittedDelta:100}),/matrix-negative-selection/);
});

test('v4 evidence identity gate precedes every historical functional check',async()=>{
 const value=create(),state=await complete(value),accepted=api.admitMatrixCase(value,state.evidence,state);
 assert.equal(accepted.schema,'four-stack-matrix-conformance-v4');assert.deepEqual(accepted.acquisition,MATRIX_V4_ACQUISITION);
 assert.equal(accepted.performance,false);assert.equal(accepted.scoringEligibility,false);assert.equal(accepted.FPS,null);
 for(const mutate of [x=>delete x.schema,x=>x.schema='four-stack-matrix-evidence-v3',x=>delete x.acquisition,x=>x.acquisition.contract='matrix-acquisition-v3',x=>x.acquisition.orchestration='other',x=>x.acquisition.sourceProtocol='matrix-v4',x=>x.acquisition.sourceContextSchema=1,x=>x.acquisition.extra=true]){
  const wrong=structuredClone(state.evidence);mutate(wrong);assert.throws(()=>api.admitMatrixCase(value,wrong,{allowOmittedDelta:99}),/matrix-acquisition-identity/);
 }
});
test('history v4 recomputes magnitude and preserves native/history/return custody',async()=>{
 const value=create('vercel-ai-sdk',100,6400,'history-reading'),state=await complete(value),response={...state.final.messages.at(-1),text:text(value).slice(0,512)},anchor=state.initial.messages.at(-1),seek=nativeHistorySeekV4({clip:rect,responseRect:rect});
 Object.assign(state.evidence,{beforeWheelProgress:{schema:1,messageCount:101,responseId:response.id,responseCharacters:512,running:true,error:null,operation:op(value,'pending')},beforeWheelResponse:response,domBeforeWheel:dom(response,null),domAfterWheel:dom(anchor,null),domBeforeReturn:dom(anchor,null),scroll:{nativeDispatch:true,...seek,beforeTop:3000,afterTop:1800,anchorId:anchor.id,returnClicked:true},wheelEvents:[{trusted:true,deltaY:seek.deltaY,defaultPrevented:false}]});
 assert.equal(api.admitMatrixCase(value,state.evidence,state).historicalAnchor,anchor.id);
 for(const mutate of [x=>x.scroll.policy='visible-response-to-mid-viewport-v3',x=>x.scroll.desiredUp=600,x=>x.scroll.deltaY=-600,x=>x.scroll.desiredUp++,x=>x.scroll.desiredUp=1048577,x=>x.domBeforeWheel.clip.bottom=599,x=>x.wheelEvents[0].trusted=false,x=>x.wheelEvents[0].defaultPrevented=true,x=>x.wheelEvents[0].deltaY++,x=>x.scroll.afterTop=x.scroll.beforeTop,x=>x.scroll.anchorId=response.id,x=>x.domBeforeReturn=dom(response,null),x=>x.scroll.returnClicked=false]){const wrong=structuredClone(state.evidence);mutate(wrong);assert.throws(()=>api.admitMatrixCase(value,wrong,state));}
});
test('readiness sample validates closed identity/progress/response/DOM before transient classification',()=>{
 assert.equal(typeof api.validateMatrixReadinessSample,'function');
 const value=create('vercel-ai-sdk',100,6400,'history-reading'),response={id:'native-response',role:'assistant',text:'short'},progress={schema:1,messageCount:101,responseId:response.id,responseCharacters:5,running:true,error:null,operation:op(value,'pending')};
 const sample={schema:'matrix-current-sample-v3',response,progress,dom:dom(response,null)};
 assert.deepEqual(api.validateMatrixReadinessSample(value.publicContext,sample),sample);
 assert.throws(()=>api.matrixStreamingReadiness(value.publicContext,progress,response,sample.dom),/streaming-response-not-ready/);
 const absent={...structuredClone(sample),response:null,progress:{...progress,messageCount:100,responseId:null,responseCharacters:null}};
 assert.deepEqual(api.validateMatrixReadinessSample(value.publicContext,absent),absent);
 for(const mutate of [x=>x.extra=true,x=>delete x.dom,x=>x.schema='other',x=>x.progress.extra=true,x=>x.response.id='different',x=>x.response.role='user',x=>x.response.text+='x',x=>x.response.text=1,x=>x.response.extra=true,x=>x.response.id=value.publicContext.history[0].id,x=>x.progress={...absent.progress}]){const wrong=structuredClone(sample);mutate(wrong);assert.throws(()=>api.validateMatrixReadinessSample(value.publicContext,wrong));}
 for(const original of [sample,absent])for(const mutate of [x=>x.dom.errors=['bad'],x=>x.dom.clip.right=0,x=>x.dom.items[0].hitPoints=[],x=>x.dom.items[0].text='x'.repeat(6401),x=>x.dom.items[0].rect.left=NaN,x=>x.dom.items[0].identityAttribute='invented']){const wrong=structuredClone(original);mutate(wrong);assert.throws(()=>api.validateMatrixReadinessSample(value.publicContext,wrong));}
});
test('every original admission byte and check order remains after the enumerated identity/import/result changes',()=>{
 const original=readFileSync(new URL('./matrix-admission-v3.mjs',import.meta.url),'utf8');
 let current=readFileSync(new URL('./matrix-admission-v4.mjs',import.meta.url),'utf8');
 const boundary='\nfunction validateMatrixAcquisition(evidence){';
 assert.equal(current.split(boundary).length,2);
 current=current.slice(0,current.indexOf(boundary));
 current=current.replace("import {historyPrefixCharacters,nativeHistorySeekV4 as nativeHistorySeek,MATRIX_V4_ACQUISITION} from './matrix-policy-v4.mjs';","import {historyPrefixCharacters,nativeHistorySeek} from './matrix-policy-v3.mjs';");
 assert.equal(current.split(' validateMatrixAcquisition(evidence);\n').length,2);
 current=current.replace(' validateMatrixAcquisition(evidence);\n','');
 current=current.replace("return{schema:'four-stack-matrix-conformance-v4',acquisition:MATRIX_V4_ACQUISITION,","return{schema:'four-stack-matrix-conformance-v3',");
 assert.equal(current,original);
});
test('v3 admitter refuses v4 history gesture and v4 keeps historical response conservation/final visibility',async()=>{
 const old=await import('./matrix-admission-v3.mjs'),value=create('vercel-ai-sdk',100,6400,'history-reading'),state=await complete(value),response={...state.final.messages.at(-1),text:text(value).slice(0,512)},anchor=state.initial.messages.at(-1),seek=nativeHistorySeekV4({clip:rect,responseRect:rect});
 Object.assign(state.evidence,{beforeWheelProgress:{schema:1,messageCount:101,responseId:response.id,responseCharacters:512,running:true,error:null,operation:op(value,'pending')},beforeWheelResponse:response,domBeforeWheel:dom(response,null),domAfterWheel:dom(anchor,null),domBeforeReturn:dom(anchor,null),scroll:{nativeDispatch:true,...seek,beforeTop:3000,afterTop:1800,anchorId:anchor.id,returnClicked:true},wheelEvents:[{trusted:true,deltaY:seek.deltaY,defaultPrevented:false}]});
 assert.throws(()=>old.admitMatrixCase(value,state.evidence,state),/native-history-scroll/);
 for(const mutate of [x=>x.final.messages[2].text='changed',x=>x.final.messages.at(-1).text+='x',x=>x.evidence.domFinal=dom(anchor,null),x=>x.evidence.server.requests[0].responseFinished=false,x=>x.evidence.server.closed=false,x=>x.evidence.cleanup.browserClosed=false]){const wrong=structuredClone(state);mutate(wrong);assert.throws(()=>api.admitMatrixCase(value,wrong.evidence,wrong));}
});
