// Semantic V3 instrumented Aimock case. Functional V5 bytes are checked independently.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertStock036BuildV1,stock036PublishedIdentityV1,waitStock036BuildOriginalV1} from './aimock-stock036-v1.mjs';
import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION,nativeHistorySeekV4 as nativeHistorySeek} from './matrix-policy-v5.mjs';
import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';
import {createMatrixReadinessControllerV5} from './matrix-readiness-v5.mjs';
import {createMatrixDeadline,collectMatrixProvenance,captureMatrixFinalBookend,createMatrixReadinessPortV5,installMatrixWheelRecorder,requireMatrixWheelDelivery} from './matrix-run-v5.mjs';
import {createAimockTraceCaptureV3,createAimockTraceRawEvidenceV3} from './aimock-trace-capture-v3.mjs';
import {runAimockTraceDecoderOwnerV3} from './aimock-trace-decoder-owner-v3.mjs';
import {SEMANTIC_LARGE_V3_POLICY as TRACE_POLICY,SEMANTIC_LARGE_V3_POLICY_SHA256 as TRACE_POLICY_SHA256} from './semantic-large-v3-policy.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const message=error=>String(error?.message??error).slice(0,4096);
function assetsFor(profile){return path.join(ROOT,profile==='threadplane'?'apps/threadplane/dist':`competitors/${profile}/dist`);}
async function installMatrixThreadplaneBridge(page,source,origin,wait){
 await wait(page.waitForFunction(()=>window.benchHost||window.benchSetupError,{},{timeout:STAGES.navigation}),STAGES.navigation,'matrix-threadplane-host');
 await wait(page.evaluate(async({history,origin})=>{
  if(window.benchSetupError)throw Error(window.benchSetupError);const host=window.benchHost;if(!host)throw Error('matrix-threadplane-host-absent');
  await host.loadMatrixHistory(history);let original=null,disposed=false;
  window.competitorBench={
   capabilities:host.capabilities,
   selectors:{scroller:host.locators.scroller,composer:host.locators.composer,message:'chat chat-message-list > chat-message',messageContent:'.chat-message__bubble, .chat-message__assistant-body > chat-streaming-md',returnToResponse:host.locators.returnToResponse},
   read(){if(disposed)throw Error('matrix-host-disposed');const runtime=host.readTranscript(),progress=host.readMatrixProgress();return{messages:runtime.transcript.map(({id,role,text})=>({id,role,text})),running:progress.running,error:progress.error,responseId:progress.responseId,operation:progress.operation};},
   readProgress(){if(disposed)throw Error('matrix-host-disposed');return host.readMatrixProgress();},
   readResponse(){if(disposed)throw Error('matrix-host-disposed');return host.readMatrixResponse();},
   start(){if(original)throw Error('matrix-original-run-once');original=host.connectMatrixReplay(origin+'/stream/canonical');void original.catch(()=>{});},
   waitForRun(){if(!original)throw Error('matrix-run-not-started');return original;},
   async dispose(){disposed=true;await host.disposeMatrix();},
  };
 },{history:source.fixture.history,origin}),STAGES.hydration,'matrix-threadplane-history');
}

export async function runMatrixCase(args){
 stock036PublishedIdentityV1();
 return runMatrixCaseOriginal(args);
}

async function runMatrixCaseOriginal({slot,store,out,invocationStarted}){
 const started=performance.now(),deadline=createMatrixDeadline({caseStarted:started,invocationStarted}),wait=(original,ms,label)=>deadline.wait(original,ms,label);
 const diagnostics=createMatrixDiagnostics({now:performance.now.bind(performance),origin:started});
 const [{createMatrixCase},{launchCaseServer},{observeMatrixDOM},{validateMatrixTranscript,validateMatrixProgress,matchMatrixVisible,matrixStreamingReadiness,validateMatrixReadinessSample,admitMatrixCase},{installOwnedNetworkGuard},{chromium},{createMatrixSampleEvaluator}]=await wait(Promise.all([
  import('./matrix-fixtures-v3.mjs'),import('./process.mjs'),import('./matrix-observer-v3.mjs'),import('./matrix-admission-v5.mjs'),import('./network.mjs'),import('playwright'),import('./matrix-sample-v3.mjs'),
 ]),STAGES.transcript,'matrix-modules');
 const {profile,journey,responseBytes,historyCount}=slot.selection,source=createMatrixCase(slot.selection);deadline.check();
 const artifacts=await wait(store.beginCase(slot.id),STAGES.progress,'matrix-case-reservation');
 const evidence={schema:'four-stack-matrix-evidence-v5',acquisition:MATRIX_V5_ACQUISITION,network:{finished:[],failed:[],external:[],resourceErrors:[]},cleanup:{publicDispose:{settled:false,fulfilled:false},browserClosed:false,serverExit:null,serverClose:null},pageErrors:[],consoleErrors:[]};
 evidence.observerDiagnostics=diagnostics.record;
 evidence.readinessV5=null;
 const readinessCapture={open:true,ack:null};let readinessController=null,readinessReceiptRef=null;
 let server,browser,page,networkGuard,serverOriginal,browserOriginal,serverOutcome,selectors,initial,final,fixture,initialRef,finalRef,beforeFacts,failure=null,unsafeOutstanding=false,stopInvocation=false,runOriginal,runStarted=null,runSettledAt=null,finalReadAttempted=false;
 let validating=true;
 // TRACE-V3-BEGIN create
 if(slot.selection.profile!=='threadplane')throw Error('aimock-stock036-profile');
 stock036PublishedIdentityV1();
 let trace=null,traceIdentity=null,traceSnapshot=null,traceFailure=null,traceBuild=null,tracePublicationStop=false,traceCleanupEnd=null;
 const traceOperations=[];
 const traceRetain=original=>{const operation={original,status:'pending',value:null,error:null};traceOperations.push(operation);original.then(value=>{operation.status='fulfilled';operation.value=value;},error=>{operation.status='rejected';operation.error=error;});return operation;};
 // TRACE-V3-END create
 const fail=error=>{diagnostics.terminal(error);failure??={message:message(error)};unsafeOutstanding||=error?.unsafeOutstanding===true;};
 const evaluate=(callback,arg,stage=STAGES.progress,label='matrix-evaluate')=>wait(page.evaluate(callback,arg),stage,label);
 const progress=async()=>{const value=await evaluate(()=>window.competitorBench.readProgress());validateMatrixProgress(source.publicContext,value);return value;};
 const dom=(countMounted=false,anchorId=null,responseId=null)=>evaluate(observeMatrixDOM,{selectors,responseId,anchorId,countMounted,maxResponseCharacters:responseBytes},STAGES.progress,'matrix-selected-dom');
 const sampleEvaluator=createMatrixSampleEvaluator();
 const currentSample=(budget=STAGES.progress)=>evaluate(sampleEvaluator,{selectors,maxResponseCharacters:responseBytes},Math.min(STAGES.progress,budget),'matrix-current-sample');
 const ticks=()=>evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const poll=async(predicate,ms,label)=>wait(page.waitForFunction(predicate,{},{timeout:Math.max(1,Math.min(ms,deadline.remaining()))}),ms,label);
 let clientResolve,clientReject;const clientOriginal=new Promise((resolve,reject)=>{clientResolve=resolve;clientReject=reject;});void clientOriginal.catch(()=>{});
 try{
  deadline.check();fixture=await wait(artifacts.writeJSON('fixture-private.json',source,{kind:'private-case'}),STAGES.transcript,'matrix-fixture-write');
  beforeFacts=await wait(collectMatrixProvenance(profile),STAGES.transcript,'matrix-provenance-before');
  serverOriginal=launchCaseServer({profile,assetsDirectory:assetsFor(profile),fixturePath:path.join(out,fixture.path),sha256:fixture.sha256,protocol:'matrix-v3',...(slot.omitDelta?{omitDelta:slot.omitDelta}:{})});void serverOriginal.catch(()=>{});
  server=await wait(serverOriginal,STAGES.childReady,'matrix-server-ready');
  browserOriginal=chromium.launch({headless:true});void browserOriginal.catch(()=>{});browser=await wait(browserOriginal,STAGES.browserLaunch,'matrix-browser-launch');
  evidence.browser={version:browser.version(),mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1}};
  const context=await wait(browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}),STAGES.progress,'matrix-browser-context');
  page=await wait(context.newPage(),STAGES.progress,'matrix-browser-page');
  networkGuard=await wait(installOwnedNetworkGuard({context,page,origin:server.origin,onExternal:url=>{if(evidence.network.external.length<512)evidence.network.external.push(url.slice(0,1024));else throw Error('matrix-network-cap');}}),STAGES.progress,'matrix-network-policy');
  page.on('pageerror',error=>{if(evidence.pageErrors.length<32)evidence.pageErrors.push(message(error));else fail(Error('matrix-page-error-cap'));});
  page.on('console',event=>{if(event.type()==='error'&&evidence.consoleErrors.length<32)evidence.consoleErrors.push(event.text().slice(0,4096));});
  const continuation=profile==='copilotkit'?'/copilot/agent/default/run':profile==='threadplane'?'/stream/canonical':'/stream/ui';
  const isContinuation=request=>request.url()===server.origin+continuation&&request.method()===(profile==='threadplane'?'GET':'POST');
  const record=(array,value)=>{if(array.length>=512){fail(Error('matrix-network-cap'));return;}array.push(value);};
  page.on('requestfinished',request=>{if(validating&&request.url().startsWith(server.origin+'/'))record(evidence.network.finished,new URL(request.url()).pathname);if(isContinuation(request))clientResolve();});
  page.on('requestfailed',request=>{if(validating)record(evidence.network.failed,{path:new URL(request.url()).pathname,error:request.failure()?.errorText??'unknown'});if(isContinuation(request))clientReject(Error('matrix-browser-continuation-failed'));});
  page.on('response',response=>{if(validating&&response.status()>=400&&['document','script','stylesheet','font'].includes(response.request().resourceType()))record(evidence.network.resourceErrors,{path:new URL(response.url()).pathname,status:response.status()});});
  await wait(page.goto(server.origin+'/',{waitUntil:'domcontentloaded',timeout:Math.max(1,Math.min(STAGES.navigation,deadline.remaining()))}),STAGES.navigation,'matrix-navigation');
  if(profile==='threadplane')await installMatrixThreadplaneBridge(page,source,server.origin,wait);
  await wait(page.waitForFunction(count=>{
   if(window.competitorBenchError)return true;const api=window.competitorBench;if(!api)return false;
   if(typeof api.readProgress!=='function'||typeof api.readResponse!=='function')throw Error('matrix-public-observer-absent');
   const state=api.readProgress();return state.error!==null||state.messageCount===count&&!state.running;
  },historyCount,{timeout:Math.max(1,Math.min(STAGES.hydration,deadline.remaining()))}),STAGES.hydration,'matrix-sdk-hydration');
  const startup=await evaluate(()=>window.competitorBenchError??null);if(startup)throw Error(startup);
  evidence.initialProgress=await progress();
  initial=await evaluate(()=>window.competitorBench.read(),undefined,STAGES.transcript,'matrix-initial-transcript');
  initialRef=await wait(artifacts.writeJSON('transcript-initial.json',initial,{kind:'transcript'}),STAGES.transcript,'matrix-initial-transcript-write');validateMatrixTranscript(source.publicContext,initial);
  const adapter=await evaluate(()=>({selectors:window.competitorBench.selectors,capabilities:window.competitorBench.capabilities}));selectors=adapter.selectors;evidence.capabilities=adapter.capabilities;
  if(await wait(page.locator(selectors.scroller).count(),STAGES.progress,'matrix-scroller-count')!==1||await wait(page.locator(selectors.composer).count(),STAGES.progress,'matrix-composer-count')!==1)throw Error('matrix-unique-native-locators');
  await wait(page.locator(selectors.scroller).evaluate(node=>{node.scrollTop=node.scrollHeight;}),STAGES.progress,'matrix-idle-preparation');
  await wait(page.waitForFunction(selector=>{const node=document.querySelector(selector);return node&&Math.abs(node.scrollHeight-node.scrollTop-node.clientHeight)<=1;},selectors.scroller,{timeout:Math.max(1,Math.min(STAGES.nativeReturn,deadline.remaining()))}),STAGES.nativeReturn,'matrix-idle-bottom');
  await ticks();evidence.domInitial=await dom(true);matchMatrixVisible(evidence.domInitial,initial.messages);
  let historyPointer=null;
  if(journey==='history-reading'){
   const clip=evidence.domInitial.clip,x=(clip.left+clip.right)/2,y=clip.top+Math.min((clip.bottom-clip.top)/3,120);
   if(![x,y].every(Number.isFinite)||clip.right<=clip.left||clip.bottom<=clip.top)throw Error('matrix-pointer-geometry');
   historyPointer={x,y};
   diagnostics.dispatched('pointer-move');
   await wait(page.mouse.move(x,y),STAGES.progress,'matrix-pointer-move');
   diagnostics.fulfilled();
   diagnostics.dispatched('wheel-recorder');
   await evaluate(installMatrixWheelRecorder,selectors.scroller);
   diagnostics.fulfilled();
   readinessController=createMatrixReadinessControllerV5({context:source.publicContext,selectors,evaluate:createMatrixReadinessPortV5({page,evidence,diagnostics,capture:readinessCapture,now:performance.now.bind(performance),remaining:deadline.remaining}),wait:deadline.wait,remaining:deadline.remaining,now:performance.now.bind(performance)});
  }
 // TRACE-V3-BEGIN setup
  const traceBuildRead=traceRetain(threadplaneBuildEvidence());
  traceBuild=assertStock036BuildV1(await waitStock036BuildOriginalV1(traceBuildRead.original,wait,STAGES.transcript,'aimock-stock036-before'));
  traceIdentity={id:slot.id,profile,historyCount,responseBytes,journey,stockVersion:'0.3.6',buildSha256:createHash('sha256').update(JSON.stringify(traceBuild)).digest('hex')};
  trace=createAimockTraceCaptureV3({now:performance.now.bind(performance),origin:started,identity:traceIdentity,wait,remaining:()=>Math.min(deadline.remaining(),traceCleanupEnd===null?Infinity:traceCleanupEnd-performance.now()),stageMs:STAGES.progress});
  await trace.setup({browser,context,page,expectedOrigin:server.origin});
  trace.assertBeforeStart();
 // TRACE-V3-END setup
  diagnostics.dispatched('start');
  runStarted=performance.now();await evaluate(()=>window.competitorBench.start());
  const readinessAck=performance.now();
  if(readinessController){readinessCapture.ack=readinessAck;readinessController.start(readinessAck);}
 // TRACE-V3-BEGIN ack
  trace.markPublicAck();
 // TRACE-V3-END ack
  diagnostics.fulfilled();
  diagnostics.dispatched('run-promise-dispatch');
  runOriginal=page.evaluate(()=>window.competitorBench.waitForRun());void runOriginal.then(()=>{runSettledAt=performance.now();},()=>{runSettledAt=performance.now();});
  diagnostics.fulfilled();
  if(journey!=='history-reading'){
   diagnostics.dispatched('response-id-wait');
   await poll(()=>{const state=window.competitorBench.readProgress();return state.error!==null||state.responseId!==null;},STAGES.progress,'matrix-response-start');
   diagnostics.fulfilled();
   diagnostics.dispatched('streaming-progress');
   evidence.streamingProgress=await progress();
   diagnostics.fulfilled();
  }
  if(journey==='history-reading'){
   const {x,y}=historyPointer;
   diagnostics.dispatched('active-readiness-v5');
   const acquired=await readinessController.acquire('initial');
   evidence.streamingProgress=acquired.sample.progress;
   diagnostics.fulfilled();
   diagnostics.dispatched('turn-stability');
   evidence.wheelReadiness=evidence.capabilities.scrollPolicy==='turn-anchoring'?await readinessController.prepare('stability',()=>page.evaluate(selector=>new Promise((resolve,reject)=>{
    const node=document.querySelector(selector),samples=[];let stable=0,last=null,stopped=false;const timer=setTimeout(()=>{stopped=true;reject(Error('matrix-native-scroll-not-settled'));},2000);
    const observe=timestamp=>{if(stopped)return;const top=node.scrollTop;samples.push({timestamp,top});stable=last!==null&&Math.abs(top-last)<=0.5?stable+1:0;last=top;if(stable>=3){clearTimeout(timer);resolve({criterion:'three-consecutive-stable-scrollTop-intervals',samples});return;}if(samples.length>=128){clearTimeout(timer);reject(Error('matrix-scroll-readiness-bound'));return;}requestAnimationFrame(observe);};requestAnimationFrame(observe);
   }),selectors.scroller),STAGES.turnStability,'matrix-turn-stability'):readinessController.skipStability();
   diagnostics.fulfilled();
   diagnostics.dispatched('pre-wheel-ticks');
   await readinessController.prepare('ticks',()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))),STAGES.progress,'matrix-pre-wheel-ticks');
   diagnostics.fulfilled();
   diagnostics.sampleDispatched('pre-wheel');
   const finalAcquired=await readinessController.acquire('final'),beforeWheel=finalAcquired.sample;
   diagnostics.sampleFulfilled(beforeWheel);
   evidence.beforeWheelResponse=beforeWheel.response;evidence.beforeWheelProgress=beforeWheel.progress;evidence.domBeforeWheel=beforeWheel.dom;
   evidence.renderedReadiness=finalAcquired.readiness;
   const seek=nativeHistorySeek({clip:evidence.domBeforeWheel.clip,responseRect:evidence.renderedReadiness.responseRect});
   if(x<evidence.domBeforeWheel.clip.left||x>=evidence.domBeforeWheel.clip.right||y<evidence.domBeforeWheel.clip.top||y>=evidence.domBeforeWheel.clip.bottom)throw Error('matrix-pointer-left-clip');
   evidence.scroll={nativeDispatch:false,...seek,beforeTop:evidence.domBeforeWheel.scroll.top,afterTop:null,anchorId:null,returnClicked:false};
   diagnostics.dispatched('single-wheel-dispatch-ack');
   readinessController.assertBeforeWheel();
   const originalWheel=page.mouse.wheel(0,seek.deltaY);await wait(originalWheel,STAGES.nativeMovement,'matrix-original-wheel');evidence.scroll.nativeDispatch=true;
   diagnostics.fulfilled();
   diagnostics.dispatched('wheel-upward-movement');
   try{await wait(page.waitForFunction(({selector,top})=>document.querySelector(selector).scrollTop<top-1,{selector:selectors.scroller,top:evidence.scroll.beforeTop},{timeout:Math.max(1,Math.min(STAGES.nativeMovement,deadline.remaining()))}),STAGES.nativeMovement,'matrix-native-upward-movement');
    diagnostics.fulfilled();
   }catch(error){diagnostics.stageRejected(error);throw error;}
   finally{
    diagnostics.dispatched('wheel-event-completion');
    await poll(()=>window.__matrixWheel?.records.length>0&&window.__matrixWheel.records.every(row=>row.defaultPrevented!==null),STAGES.nativeMovement,'matrix-wheel-event-completion');
    diagnostics.fulfilled();
    diagnostics.dispatched('wheel-events');
    evidence.wheelEvents=await evaluate(()=>{if(window.__matrixWheel.overflow)throw Error('matrix-wheel-event-cap');return window.__matrixWheel.records;});
    diagnostics.fulfilled();
    requireMatrixWheelDelivery(evidence.wheelEvents,seek.deltaY);
    diagnostics.sampleDispatched('wheel-finally');
    const wheelFinally=await currentSample();
    diagnostics.sampleFulfilled(wheelFinally);
    evidence.domAfterWheel=wheelFinally.dom;
   }
   diagnostics.dispatched('after-wheel-ticks');
   await ticks();
   diagnostics.fulfilled();
   diagnostics.sampleDispatched('after-wheel');
   const afterWheel=await currentSample();
   diagnostics.sampleFulfilled(afterWheel);
   evidence.domAfterWheel=afterWheel.dom;
   const afterWheelResponse=afterWheel.response;
   const visible=matchMatrixVisible(evidence.domAfterWheel,[...source.publicContext.history,...(afterWheelResponse?[afterWheelResponse]:[])],{responsePrefixId:afterWheelResponse?.id}),historyIds=new Set(source.publicContext.history.map(row=>row.id)),anchor=visible.find(row=>historyIds.has(row.id));
   if(!anchor)throw Error('matrix-visible-history-anchor');evidence.scroll.anchorId=anchor.id;evidence.scroll.afterTop=evidence.domAfterWheel.scroll.top;
  }
  const runRemaining=STAGES.originalRun-(performance.now()-runStarted);
  if(runRemaining<=0&&(runSettledAt===null||runSettledAt>runStarted+STAGES.originalRun))throw Error('matrix-original-run-deadline');
  diagnostics.dispatched('full-completion-wait');
  await wait(runOriginal,Math.max(1,runRemaining),'matrix-original-run');
  diagnostics.fulfilled();
  if(runSettledAt>runStarted+STAGES.originalRun)throw Error('matrix-original-run-deadline');
  diagnostics.dispatched('after-run-progress');
  evidence.afterOriginalRunProgress=await progress();
  diagnostics.fulfilled();
  diagnostics.dispatched('http-completion');
  await wait(clientOriginal,STAGES.nativeMovement,'matrix-browser-original-completion');
  diagnostics.fulfilled();
  diagnostics.dispatched('final-public-transition');
  await poll(()=>{const state=window.competitorBench.readProgress();return state.error!==null||!state.running&&state.operation.status==='fulfilled';},STAGES.progress,'matrix-final-public-transition');
  diagnostics.fulfilled();
  diagnostics.dispatched('final-progress');
  evidence.finalProgress=await progress();finalReadAttempted=true;
  diagnostics.fulfilled();
  diagnostics.dispatched('final-transcript');
  final=await evaluate(()=>window.competitorBench.read(),undefined,STAGES.transcript,'matrix-final-transcript');
  diagnostics.fulfilled();
  finalRef=await wait(artifacts.writeJSON('transcript-final.json',final,{kind:'transcript'}),STAGES.transcript,'matrix-final-transcript-write');
  await ticks();
  if(journey==='history-reading'){
   evidence.domBeforeReturn=await dom(false,evidence.scroll.anchorId,final.responseId);if(!selectors.returnToResponse)throw Error('matrix-native-return-unsupported');
   if(!matchMatrixVisible(evidence.domBeforeReturn,final.messages).some(row=>row.id===evidence.scroll.anchorId))throw Error('matrix-historical-anchor-lost-before-return');
   evidence.returnControl=await evaluate(selector=>{const nodes=Array.from(document.querySelectorAll(selector));return{count:nodes.length,visibleCount:nodes.filter(node=>node.checkVisibility({visibilityProperty:true,opacityProperty:true})).length};},selectors.returnToResponse);
   await wait(page.locator(selectors.returnToResponse).click({timeout:Math.max(1,Math.min(STAGES.nativeReturn,deadline.remaining()))}),STAGES.nativeReturn,'matrix-original-return');evidence.scroll.returnClicked=true;
  }
  const finalResponse=final.messages.find(row=>row.id===final.responseId),until=performance.now()+Math.min(STAGES.finalDOM,deadline.remaining());let converged=false;
  while(performance.now()<until){const sample=await dom(false,null,final.responseId);if(finalResponse&&sample.errors.length===0&&sample.items.some(row=>row.visible&&row.text===finalResponse.text&&(row.nativeId===null||row.nativeId===finalResponse.id))){converged=true;break;}await wait(page.waitForTimeout(50),STAGES.progress,'matrix-final-dom-poll');}
  if(!converged)throw Error('matrix-complete-response-not-visible');await ticks();evidence.domFinal=await dom(true,null,final.responseId);
  evidence.networkGuardBeforeCleanup=networkGuard.read();if(evidence.networkGuardBeforeCleanup.closed||evidence.networkGuardBeforeCleanup.overflow||context.pages().length!==1)throw Error('matrix-network-observation-invalid');
  if(evidence.pageErrors.length||evidence.network.resourceErrors.length)throw Error('matrix-page-or-resource-error');deadline.check();
 // TRACE-V3-BEGIN finish
  try{await trace.finish();}catch{traceFailure='aimock-trace-finish-unavailable';}
 // TRACE-V3-END finish
 }catch(error){diagnostics.rejected(error);fail(error);if(error.serverOutcome)serverOutcome=error.serverOutcome;}
 finally{
  // A failed original run still has actual public state worth retaining. Never
  // replace a rejected projection or retry a failed full-transcript acquisition.
  if(page&&runStarted!==null&&!finalReadAttempted){
   const capture=await captureMatrixFinalBookend({started:true,attempted:finalReadAttempted,remaining:deadline.remaining(),
    read:()=>evaluate(()=>window.competitorBench.read(),undefined,STAGES.transcript,'matrix-failed-final-transcript'),
    write:value=>wait(artifacts.writeJSON('transcript-final.json',value,{kind:'transcript'}),STAGES.transcript,'matrix-failed-final-transcript-write'),
   });
   finalReadAttempted=capture.attempted;final=capture.snapshot;finalRef=capture.reference;
   if(capture.unavailable)evidence.finalTranscriptUnavailable=capture.unavailable;
   if(capture.error)fail(capture.error);
  }
  validating=false;const cleanupStarted=performance.now();
  const cleanupWait=async(original,ms,label)=>{let timer;try{return await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-unsettled')),Math.max(1,Math.min(ms,LIMITS.cleanupMs-(performance.now()-cleanupStarted))));})]);}finally{clearTimeout(timer);}};
  if(!server&&serverOriginal)try{server=await cleanupWait(serverOriginal,STAGES.serverClose,'matrix-original-server-start');}catch(error){unsafeOutstanding||=message(error).includes('-unsettled')||error.unsafeOutstanding===true;fail(error);if(error.serverOutcome)serverOutcome=error.serverOutcome;}
  if(!browser&&browserOriginal)try{browser=await cleanupWait(browserOriginal,STAGES.browserClose,'matrix-original-browser-launch');}catch(error){unsafeOutstanding||=message(error).includes('-unsettled');fail(error);}
  if(page){const originalDispose=page.evaluate(async()=>{if(window.competitorBench)await window.competitorBench.dispose();});void originalDispose.catch(()=>{});try{await cleanupWait(originalDispose,STAGES.publicDispose,'matrix-public-dispose');evidence.cleanup.publicDispose={settled:true,fulfilled:true};}catch(error){const unsettled=message(error).includes('-unsettled');evidence.cleanup.publicDispose={settled:!unsettled,fulfilled:false,error:message(error)};unsafeOutstanding||=unsettled;fail(error);}}
 // TRACE-V3-BEGIN cleanup-stop
  traceCleanupEnd??=cleanupStarted+LIMITS.cleanupMs;
  if(trace)try{const traceFinishAttention=trace.beforeBrowserClose();if(traceFinishAttention!==null)await cleanupWait(traceFinishAttention,STAGES.progress,'aimock-trace-before-browser-close');}catch{traceFailure??='aimock-trace-stop-unavailable';}
 // TRACE-V3-END cleanup-stop
  if(browser){const originalClose=browser.close();void originalClose.catch(()=>{});try{await cleanupWait(originalClose,STAGES.browserClose,'matrix-browser-close');evidence.cleanup.browserClosed=true;}catch(error){unsafeOutstanding=true;fail(error);}}
  if(networkGuard)evidence.networkGuardAfterCleanup=networkGuard.read();
  if(server){const originalClose=server.close();void originalClose.catch(()=>{});try{serverOutcome=await cleanupWait(originalClose,STAGES.serverClose,'matrix-server-close');}catch(error){unsafeOutstanding=true;fail(error);if(error.serverOutcome)serverOutcome=error.serverOutcome;}}
  if(serverOutcome){evidence.server=serverOutcome.report;evidence.cleanup.serverExit=serverOutcome.exit;evidence.cleanup.serverClose=serverOutcome.close;}
  // Seal the history receipt after original cleanup, before any publication.
  readinessCapture.open=false;
  if(readinessController)try{const sealed=readinessController.seal();evidence.readinessV5=sealed.receipt;unsafeOutstanding||=sealed.unsafeOutstanding;}catch(error){unsafeOutstanding=true;fail(error);}
 // TRACE-V3-BEGIN cleanup-seal
  if(trace)try{trace.afterBrowserClose();traceSnapshot=trace.seal();unsafeOutstanding||=traceSnapshot.receipt.unsafeOutstanding;}catch{unsafeOutstanding=true;traceFailure??='aimock-trace-seal-unavailable';}
 // TRACE-V3-END cleanup-seal
 }
 let admission=null,status='invalid';
 try{
  deadline.check();const afterFacts=await wait(collectMatrixProvenance(profile),STAGES.transcript,'matrix-provenance-after');evidence.provenance={before:beforeFacts,after:afterFacts};if(JSON.stringify(beforeFacts)!==JSON.stringify(afterFacts))throw Error('matrix-source-assets-or-locks-changed');
  if(failure)throw Error(failure.message);
  if(slot.kind==='positive'){admission=admitMatrixCase(source,evidence,{initial,final});status='matrix-pass';}
  else{
   let rejected=null;try{admitMatrixCase(source,evidence,{initial,final});}catch(error){rejected=message(error);}if(rejected!=='matrix-response-content')throw Error('matrix-negative-wrong-rejection:'+String(rejected));
   admission=admitMatrixCase(source,evidence,{initial,final,allowOmittedDelta:100});status='negative-pass';
  }
 }catch(error){fail(error);}
 evidence.transcripts={initial:initialRef??null,final:finalRef??null,finalReadAttempted};
 const result={schema:'four-stack-matrix-case-v5',acquisition:MATRIX_V5_ACQUISITION,id:slot.id,kind:slot.kind,...slot.selection,purpose:'functional-conformance-development',fixture:fixture??null,fixtureDigests:source.publicContext.digests,transcripts:evidence.transcripts,status:failure?'invalid':status,failure,admission,unsafeOutstanding,performance:false,scoringEligibility:false,FPS:null};
 // TRACE-V3-BEGIN publish
 const P=TRACE_POLICY,POLICY_SHA=TRACE_POLICY_SHA256;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const need=(v,c)=>{if(!v)throw Error('timeline-owner-'+c);};
function keys(v,ks,c){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,c);const names=Reflect.ownKeys(v);need(names.length===ks.length&&ks.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&d.enumerable;}),c);}
function validateIdentity(v){keys(v,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256'],'arguments');for(const k of ['id','profile','journey'])need(typeof v[k]==='string'&&Buffer.byteLength(v[k])>0&&Buffer.byteLength(v[k])<=256,'arguments');need(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v.id)&&['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].includes(v.profile)&&v.stockVersion===(v.profile==='threadplane'?'0.3.6':null)&&integer(v.historyCount)&&integer(v.responseBytes)&&digest(v.buildSha256),'arguments');}
const REASONS=new Set(['preflight','deadline','sources','platform','reservation','space','request','spawn','protocol','result','pipe','process','rss','cleanup','originals-bound','publication','publication-unsettled','internal'].map(c=>'timeline-owner-'+c));
const CHILD_REASONS=new Set(['buffer-ledger','buffer-usage','capture-facts','decoder-arguments','decompressed-cap','event-category','fields','gzip-utf8-or-json-invalid','identity','inventory','json-duplicate-key','own-data','owner-clock','owner-facts','payload-base64','payload-integrity','phase-clock','raw-bound','raw-header','receipt-bound','required-metadata','result-bound','support-facts','trace-event','trace-json','trace-process','trace-time','child-input-cap','child-frame','child-order','child-request','child-sources','child-raw-read','child-raw-json','child-raw-join','child-output','child-internal'].map(c=>'timeline-'+c));
const sha=b=>createHash('sha256').update(b).digest('hex');
const code=e=>REASONS.has(e?.message)?e.message:'timeline-owner-internal';
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
function preview(v){keys(v,['text','trueCharacters','truncated'],'result');need(typeof v.text==='string'&&integer(v.trueCharacters)&&v.text.length===Math.min(64,v.trueCharacters)&&v.truncated===(v.trueCharacters>64),'result');}
function binding(v,count){keys(v,['frameId','nestedProcessId','pid','tid','frameEventIndex','frameRecordIndex','threadEventIndex'],'result');need(typeof v.frameId==='string'&&v.frameId.length>0&&v.frameId.length<=128&&[v.pid,v.tid,v.nestedProcessId].every(x=>integer(x)&&x>0)&&v.nestedProcessId===v.pid&&[v.frameEventIndex,v.threadEventIndex].every(x=>integer(x)&&x<count)&&integer(v.frameRecordIndex),'result');}
function witnesses(v,frame,count){
 keys(v,['totalCount','distinctIdentities','duplicateCount','first8','latest','retainedCount','droppedCount','truncated'],'result');need([v.totalCount,v.distinctIdentities,v.duplicateCount,v.retainedCount,v.droppedCount].every(integer)&&v.distinctIdentities<=v.totalCount&&v.duplicateCount===v.totalCount-v.distinctIdentities&&Array.isArray(v.first8)&&v.first8.length===Math.min(v.totalCount,8)&&v.retainedCount===Math.min(v.totalCount,8)+(v.totalCount>8?1:0)&&v.droppedCount===v.totalCount-v.retainedCount&&v.truncated===(v.totalCount>v.retainedCount),'result');
 const rows=[...v.first8,...(v.latest===null?[]:[v.latest])];need((v.totalCount===0)===(v.latest===null),'result');for(const r of rows){keys(r,frame?['eventIndex','frameRecordIndex','frameId','nestedProcessId']:['eventIndex','pid','tid'],'result');need(integer(r.eventIndex)&&r.eventIndex<count,'result');if(frame)need(integer(r.frameRecordIndex)&&typeof r.frameId==='string'&&r.frameId.length>0&&r.frameId.length<=128&&integer(r.nestedProcessId)&&r.nestedProcessId>0,'result');else need(integer(r.pid)&&r.pid>0&&integer(r.tid)&&r.tid>0,'result');}if(v.totalCount&&v.totalCount<=8)need(same(v.latest,v.first8.at(-1)),'result');
 // Mapper visits each thread event once, but can visit many frame records in it.
 if(!frame)need(v.totalCount<=count,'result');let previous=null;
 for(const r of [...v.first8,...(v.totalCount>8?[v.latest]:[])]){need(!previous||r.eventIndex>previous.eventIndex||(frame&&r.eventIndex===previous.eventIndex&&r.frameRecordIndex>previous.frameRecordIndex),'result');previous=r;}
}
function mapping(v,count){
 keys(v,['schema','status','reason','binding','frameWitnesses','threadWitnesses','foreignFrameCount','foreignRendererMainCount','malformedRelevantCount','performance','scoringEligibility','FPS'],'result');need(v.schema==='aimock-trace-renderer-v1'&&v.performance===false&&v.scoringEligibility===false&&v.FPS===null&&[v.foreignFrameCount,v.foreignRendererMainCount,v.malformedRelevantCount].every(integer),'result');witnesses(v.frameWitnesses,true,count);witnesses(v.threadWitnesses,false,count);
 if(v.status==='available'){need(v.reason===null&&v.frameWitnesses.distinctIdentities===1&&v.threadWitnesses.distinctIdentities===1&&v.malformedRelevantCount===0,'result');binding(v.binding,count);const f=v.frameWitnesses.first8[0],t=v.threadWitnesses.first8[0];need(f&&t&&f.nestedProcessId===v.binding.pid&&f.frameId===v.binding.frameId&&f.eventIndex===v.binding.frameEventIndex&&f.frameRecordIndex===v.binding.frameRecordIndex&&t.pid===v.binding.pid&&t.tid===v.binding.tid&&t.eventIndex===v.binding.threadEventIndex,'result');}
 else {const reason=v.malformedRelevantCount?'malformed-relevant-metadata':v.frameWitnesses.distinctIdentities>1?'conflicting-owned-frame-processes':v.frameWitnesses.distinctIdentities===0?'owned-frame-missing':v.threadWitnesses.distinctIdentities>1?'conflicting-renderer-main-threads':v.threadWitnesses.distinctIdentities===0?'owned-renderer-main-missing':null;need(v.status==='unavailable'&&v.binding===null&&reason!==null&&v.reason===reason,'result');}
 if(v.status==='available'){for(const f of [...v.frameWitnesses.first8,v.frameWitnesses.latest])need(f.nestedProcessId===v.binding.pid&&f.frameId===v.binding.frameId,'result');for(const t of [...v.threadWitnesses.first8,v.threadWitnesses.latest])need(t.pid===v.binding.pid&&t.tid===v.binding.tid,'result');}
 const frameEvents=new Set([...v.frameWitnesses.first8,...(v.frameWitnesses.latest?[v.frameWitnesses.latest]:[])].map(r=>r.eventIndex));for(const t of [...v.threadWitnesses.first8,...(v.threadWitnesses.latest?[v.threadWitnesses.latest]:[])])need(!frameEvents.has(t.eventIndex),'result');
}
function costs(v,m,count){
 const base=['schema','status','reason','performance','scoringEligibility','FPS','cpuTime','presentationCoverage'];
 keys(v,v.status==='available'?[...base,'scope','clock','binding','tasks','layouts','minorGC','limitations']:base,'result');need(v.schema==='aimock-owned-renderer-costs-v1'&&v.performance===false&&v.scoringEligibility===false&&v.FPS===null&&v.cpuTime===null&&v.presentationCoverage==='unverified','result');
 if(v.status==='unavailable'){need(['aimock-trace-owned-renderer-unavailable','aimock-trace-owned-event-category-unrecognized','aimock-trace-owned-event-time-invalid','aimock-trace-no-owned-complete-tasks'].includes(v.reason),'result');return;}
 need(v.status==='available'&&m.status==='available'&&same(v.binding,m.binding)&&v.reason===null&&v.scope==='whole-capture-observed-complete-X-events'&&v.clock==='trace-timeTicks-microseconds'&&same(v.limitations,['not-a-complete-task-population','not-a-streaming-only-window','wall-duration-is-not-CPU-time','nested-and-overlapping-classes-not-additive','headless-conformance-is-not-display-presentation']),'result');
 const occupied=new Set([...m.frameWitnesses.first8,...m.threadWitnesses.first8,m.frameWitnesses.latest,m.threadWitnesses.latest].map(r=>r.eventIndex));
 for(const k of ['tasks','layouts','minorGC']){const p=v[k];keys(p,k==='tasks'?['observedCompleteEvents','longTaskEvents','longest']:['observedCompleteEvents','longest'],'result');need(integer(p.observedCompleteEvents)&&p.observedCompleteEvents<=count&&Array.isArray(p.longest)&&p.longest.length===Math.min(p.observedCompleteEvents,8),'result');if(k==='tasks')need(p.observedCompleteEvents>0&&integer(p.longTaskEvents)&&p.longTaskEvents<=p.observedCompleteEvents,'result');let previous=null;const seen=new Set();for(const row of p.longest){keys(row,['eventIndex','timestampUs','durationUs'],'result');need(integer(row.eventIndex)&&row.eventIndex<count&&!seen.has(row.eventIndex)&&!occupied.has(row.eventIndex)&&finite(row.timestampUs)&&finite(row.durationUs)&&row.timestampUs+row.durationUs<=Number.MAX_SAFE_INTEGER&&(!previous||previous.durationUs>row.durationUs||(previous.durationUs===row.durationUs&&previous.eventIndex<row.eventIndex)),'result');previous=row;seen.add(row.eventIndex);occupied.add(row.eventIndex);}if(k==='tasks'){const retainedLong=p.longest.filter(r=>r.durationUs>=50000).length;need(p.longTaskEvents>=retainedLong&&(p.observedCompleteEvents>8||p.longTaskEvents===retainedLong),'result');}}
 need(v.tasks.observedCompleteEvents+v.layouts.observedCompleteEvents+v.minorGC.observedCompleteEvents<=count,'result');
}
function validateResult(v,id,ref){
 keys(v,['schema','status','reason','identity','policySha256','rawReference','compressedBytes','compressedSha256','decodedBytes','decodedSha256','traceEventCount','metadataEventCount','emittedCategories','rendererMapping','costs',...Object.keys(P.flags)],'result');need(v.schema===P.schemas.decoded&&v.policySha256===POLICY_SHA&&same(v.rawReference,ref)&&Object.keys(P.flags).every(k=>v[k]===P.flags[k]),'result');
 const fields=['identity','compressedBytes','compressedSha256','decodedBytes','decodedSha256','traceEventCount','metadataEventCount','emittedCategories','rendererMapping','costs'];
 if(v.status==='invalid'){need(CHILD_REASONS.has(v.reason)&&fields.every(k=>v[k]===null),'result');return v;}
 need(v.status==='valid'&&v.reason===null&&same(v.identity,id)&&integer(v.compressedBytes)&&v.compressedBytes<=4194304&&integer(v.decodedBytes)&&v.decodedBytes<=67108864&&digest(v.compressedSha256)&&digest(v.decodedSha256)&&integer(v.traceEventCount)&&integer(v.metadataEventCount)&&v.metadataEventCount>0&&v.metadataEventCount<=v.traceEventCount,'result');
 const e=v.emittedCategories;keys(e,['count','sha256','first16','truncated','requested'],'result');need(integer(e.count)&&digest(e.sha256)&&Array.isArray(e.first16)&&e.first16.length===Math.min(e.count,16),'result');e.first16.forEach(preview);need(e.truncated===(e.count>16||e.first16.some(p=>p.truncated))&&Array.isArray(e.requested)&&e.requested.length===P.config.traceConfig.includedCategories.length,'result');
 for(let i=0;i<e.requested.length;i++){const r=e.requested[i];keys(r,['category','observed','meaning'],'result');need(r.category===P.config.traceConfig.includedCategories[i]&&typeof r.observed==='boolean'&&r.meaning===(r.observed?'actual-event-category-token':'not-observed-in-this-trace; support-unknown'),'result');}
 if(!e.truncated){const names=e.first16.map(p=>p.text);need(same(names,[...new Set(names)].sort())&&sha(JSON.stringify(names))===e.sha256&&e.requested.every(r=>r.observed===names.includes(r.category)),'result');}
 mapping(v.rendererMapping,v.traceEventCount);costs(v.costs,v.rendererMapping,v.traceEventCount);return v;
}

const receiptKeys=['schema','identity','nodeClock','setupClock','finishClock','sealedMs','publicAckMs','config','limits','protocolSupport','inventory','startDispatched','startAcknowledged','stopDispatched','stopReason','tracingCompleteSeen','completion','dataLossOccurred','bufferUsage','eof','ioClosed','truncated','retainedBytes','receivedBytes','totalOriginalCompressedBytes','payloadSha256','owners','issues','complete','unsafeOutstanding','performance','scoringEligibility','FPS','bufferNotificationsV3'];
const limits={compressedBytes:4194304,chunkBytes:65536,maxReads:4096,decodedBytes:67108864,receiptBytes:16384,wrapperOverheadBytes:65536,base64Characters:5592408,wrapperBytes:6291456,evidenceBytes:2097152};
const ownerKinds=['browser-session','page-session','frame-tree','target-info','trace-start','active-page-categories','trace-end','trace-complete','stream-drain','finish','io-read','io-close','page-detach','browser-detach'];
function receiptPreview(v,limit=64,hashed=false){keys(v,hashed?['text','trueCharacters','truncated','sha256']:['text','trueCharacters','truncated']);need(typeof v.text==='string'&&v.text.length<=limit&&integer(v.trueCharacters)&&v.trueCharacters>=v.text.length&&typeof v.truncated==='boolean'&&v.truncated===(v.trueCharacters>limit)&&v.text.length===Math.min(v.trueCharacters,limit),'timeline-inventory');if(hashed)need(digest(v.sha256)&& (v.truncated||v.sha256===sha(v.text)),'timeline-inventory');}
function ledger(r){
 const b=r.bufferUsage,l=r.bufferNotificationsV3;keys(b,['count','first','last','max']);keys(l,['totalCount','first8','last8','retainedCount','droppedCount','truncated']);
 need(integer(b.count)&&l.totalCount===b.count&&Array.isArray(l.first8)&&Array.isArray(l.last8)&&l.first8.length===Math.min(b.count,8)&&l.last8.length===Math.min(Math.max(b.count-8,0),8)&&l.retainedCount===Math.min(b.count,16)&&l.droppedCount===b.count-l.retainedCount&&l.truncated===(l.droppedCount>0),'timeline-buffer-ledger');
 if(!b.count){need(b.first===null&&b.last===null&&b.max===null,'timeline-buffer-ledger');return;}
 need(finite(b.first)&&finite(b.last)&&finite(b.max)&&b.max<.9&&b.first<=b.max&&b.last<=b.max,'timeline-buffer-usage');
 const rows=[...l.first8,...l.last8];let previous=-1,retainedMax=0;
 for(let i=0;i<rows.length;i++){const row=rows[i],ordinal=i<l.first8.length?i+1:b.count-l.last8.length+i-l.first8.length+1;need(Array.isArray(row)&&row.length===5&&row[0]===ordinal&&finite(row[1])&&row[1]>=previous&&row[1]<=r.sealedMs,'timeline-buffer-ledger');previous=row[1];need((row[2]!==null||row[3]!==null)&&[row[2],row[3]].every(x=>x===null||(finite(x)&&x<=1))&&(row[4]===null||integer(row[4])),'timeline-buffer-ledger');const amount=Math.max(row[2]??0,row[3]??0);retainedMax=Math.max(retainedMax,amount);need(amount<=b.max,'timeline-buffer-ledger');if(i===0)need(amount===b.first,'timeline-buffer-ledger');if(i===rows.length-1)need(amount===b.last,'timeline-buffer-ledger');}
 if(l.droppedCount===0)need(b.max===retainedMax,'timeline-buffer-ledger');
}
function receipt(r,raw){
 keys(r,receiptKeys);validateIdentity(r.identity);need(same(r.identity,raw.identity),'timeline-identity');
 need(Buffer.byteLength(JSON.stringify(r))<=16384,'timeline-receipt-bound');
 need(r.schema===P.schemas.receipt&&r.nodeClock==='node-performance-relative-to-case-start'&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null&&r.complete===true&&r.startDispatched===true&&r.startAcknowledged===true&&r.stopDispatched===true&&r.tracingCompleteSeen===true&&r.dataLossOccurred===false&&r.eof===true&&r.ioClosed===true&&r.truncated===false&&r.unsafeOutstanding===false&&Array.isArray(r.issues)&&r.issues.length===0&&['functional-body-complete','before-browser-close'].includes(r.stopReason),'timeline-capture-facts');
 need(same(r.config,P.config)&&same(r.limits,limits),'timeline-capture-facts');
 keys(r.completion,['observedMs','dataLossOccurred','traceFormat','streamCompression']);need(r.completion.dataLossOccurred===false&&r.completion.traceFormat==='json'&&r.completion.streamCompression==='gzip','timeline-capture-facts');
 for(const clock of [r.setupClock,r.finishClock]){keys(clock,['startedMs','deadlineMs','budgetMs']);need(finite(clock.startedMs)&&finite(clock.deadlineMs)&&finite(clock.budgetMs)&&clock.budgetMs>0&&clock.budgetMs<=10000&&clock.deadlineMs>clock.startedMs&&Math.abs(clock.deadlineMs-clock.startedMs-clock.budgetMs)<.000001,'timeline-phase-clock');}
 need(finite(r.publicAckMs)&&r.publicAckMs>=r.setupClock.startedMs&&r.finishClock.startedMs>=r.publicAckMs&&finite(r.sealedMs)&&r.sealedMs>=r.finishClock.startedMs&&finite(r.completion.observedMs)&&r.completion.observedMs>=r.finishClock.startedMs&&r.completion.observedMs<r.finishClock.deadlineMs&&r.completion.observedMs<=r.sealedMs,'timeline-phase-clock');
 need(Array.isArray(r.owners)&&r.owners.length===14&&new Set(r.owners.map(o=>o.kind)).size===14&&ownerKinds.every(k=>r.owners.some(o=>o.kind===k)),'timeline-owner-facts');
 for(const o of r.owners){keys(o,['kind','dispatched','fulfilled','rejected','pending','lastStatus','lastDispatchedMs','lastSettledMs','attentionStatus','attentionDeadlineMs','attentionSettledMs','error']);need(integer(o.dispatched)&&o.dispatched>=1&&o.dispatched<=(o.kind==='io-read'?4096:1)&&o.fulfilled===o.dispatched&&o.rejected===0&&o.pending===0&&o.lastStatus==='fulfilled'&&o.attentionStatus==='fulfilled'&&o.error===null,'timeline-owner-facts');const c=ownerKinds.indexOf(o.kind)<6?r.setupClock:r.finishClock;need(finite(o.lastDispatchedMs)&&finite(o.lastSettledMs)&&finite(o.attentionDeadlineMs)&&finite(o.attentionSettledMs)&&o.lastDispatchedMs>=c.startedMs&&o.lastSettledMs>=o.lastDispatchedMs&&o.attentionSettledMs>=o.lastSettledMs&&o.attentionSettledMs<o.attentionDeadlineMs&&o.attentionDeadlineMs<=c.deadlineMs+.000001&&o.attentionSettledMs<=r.sealedMs,'timeline-owner-clock');}
 const s=r.protocolSupport;keys(s,['stage','requested','supportedRequested','returnedCount','returnedSha256','returnedFirst8','originalSettledMs','setupDeadlineMs']);need(s.stage==='active-page-categories'&&same(s.requested,P.config.traceConfig.includedCategories)&&same(s.supportedRequested,P.config.traceConfig.includedCategories)&&integer(s.returnedCount)&&s.returnedCount>=2&&s.returnedCount<=4096&&digest(s.returnedSha256)&&Array.isArray(s.returnedFirst8)&&s.returnedFirst8.length===Math.min(s.returnedCount,8)&&finite(s.originalSettledMs)&&s.originalSettledMs<s.setupDeadlineMs&&s.setupDeadlineMs===r.setupClock.deadlineMs,'timeline-support-facts');for(const p of s.returnedFirst8)receiptPreview(p,32);need(s.originalSettledMs===r.owners.find(o=>o.kind==='active-page-categories').lastSettledMs,'timeline-support-facts');
 const inv=r.inventory;keys(inv,['oneOwnedPage','mainFrameId','targetId','documentURL','origin','browserVersion','rendererMapping']);need(inv.oneOwnedPage===true&&['mainFrameId','targetId'].every(k=>typeof inv[k]==='string'&&inv[k].length>0&&inv[k].length<=128)&&inv.rendererMapping==='unavailable-until-actual-trace-metadata','timeline-inventory');receiptPreview(inv.documentURL,64,true);receiptPreview(inv.origin,64,true);receiptPreview(inv.browserVersion);ledger(r);
 need(integer(r.retainedBytes)&&r.retainedBytes===raw.retainedCompressedBytes&&r.retainedBytes===r.receivedBytes&&r.receivedBytes===r.totalOriginalCompressedBytes&&r.payloadSha256===raw.compressedSha256,'timeline-payload-integrity');
}
 function reference(ref,name,value,cap){
  keys(ref,['path','bytes','sha256'],'reference');need(ref.path===slot.id+'/'+name&&integer(ref.bytes)&&ref.bytes<=cap&&digest(ref.sha256),'reference');
  if(value!==undefined){const text=JSON.stringify(value);need(ref.bytes===Buffer.byteLength(text)&&ref.sha256===sha(text),'reference');}
 }
 const literalFlags=value=>need(Object.keys(P.flags).every(k=>value[k]===P.flags[k]),'flags');
 const successGate=()=>{deadline.check();need(!unsafeOutstanding&&!traceOwnerReceipt?.unsafeOutstanding&&!storeUnknown(),'publication-ownership');need(performance.now()<Math.min(started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs,traceOwnerEnd),'publication-deadline');};
 const observe=async(record,label)=>{const value=await wait(record.original,STAGES.progress,label);successGate();return value;};
 const publishOperation=async(start,label)=>{successGate();return observe(traceRetain(start()),label);};
 const storeUnknown=()=>{try{const s=store.stats();return !!(s.pendingOriginals||s.pendingWriters||s.unsafeWriter);}catch{return true;}};
 function processOriginal(record,kind,owner){
  keys(record,['ownerId','kind','pid','parentPid','startWitness','dispatchMs','deadlineMs','spawn','exit','close','stdin','stdout','stderr','attention','cleanup'],'original');
  const clock=owner.clock,validTime=t=>finite(t)&&t>=record.dispatchMs&&t<record.deadlineMs;
  need(record.kind===kind&&typeof record.ownerId==='string'&&record.ownerId.length>0&&record.ownerId.length<=128&&integer(record.pid)&&record.pid>0&&integer(record.parentPid)&&record.parentPid>0&&typeof record.startWitness==='string'&&/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|[12][0-9]|3[01]) ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9] [0-9]{4}$/.test(record.startWitness)&&finite(record.dispatchMs)&&record.dispatchMs>=clock.dispatchedMs&&finite(record.deadlineMs)&&record.deadlineMs<=clock.successDeadlineMs&&record.dispatchMs<record.deadlineMs,'original');
  for(const name of ['spawn','exit','close','attention']){const o=record[name];keys(o,['status','observedMs','code','signal','reason'],'original');need(o.status==='fulfilled'&&validTime(o.observedMs)&&o.reason===null&&o.signal===null&&o.code===(name==='exit'||name==='close'?0:null),'original');}
  need(record.spawn.observedMs<=record.exit.observedMs&&record.exit.observedMs<=record.close.observedMs&&record.attention.observedMs>=record.close.observedMs,'original-clock');
  const cleanup=record.cleanup;keys(cleanup,['termDispatchedMs','termAccepted','killDispatchedMs','killAccepted','originalsClosedMs','reason'],'original');need(cleanup.termDispatchedMs===null&&cleanup.termAccepted===null&&cleanup.killDispatchedMs===null&&cleanup.killAccepted===null&&cleanup.reason===null&&validTime(cleanup.originalsClosedMs)&&cleanup.originalsClosedMs>=record.close.observedMs&&cleanup.originalsClosedMs<=record.attention.observedMs,'original');
  for(const name of ['stdin','stdout','stderr']){
   const pipe=record[name];keys(pipe,['status','observedBytes','retainedPrefixBase64','droppedBytes','completeSha256','endMs','finishMs','closeMs','writeDispatchedMs','writeSettledMs','reason'],'pipe');
   const cap=name==='stdin'?16384:kind==='decoder'?(name==='stdout'?262144:65536):(name==='stdout'?4096:8192),prefixCap=name==='stdout'?256:1024;
   need(pipe.status==='fulfilled'&&pipe.reason===null&&integer(pipe.observedBytes)&&pipe.observedBytes<=cap&&integer(pipe.droppedBytes)&&typeof pipe.retainedPrefixBase64==='string'&&digest(pipe.completeSha256)&&validTime(pipe.closeMs)&&pipe.closeMs<=cleanup.originalsClosedMs,'pipe');
   const prefix=Buffer.from(pipe.retainedPrefixBase64,'base64');need(prefix.toString('base64')===pipe.retainedPrefixBase64&&prefix.length===(name==='stdin'?0:Math.min(pipe.observedBytes,prefixCap))&&pipe.droppedBytes===pipe.observedBytes-prefix.length,'pipe');
   if(name==='stdin'){
    need(pipe.endMs===null&&validTime(pipe.finishMs)&&pipe.finishMs<=pipe.closeMs,'pipe');
    if(kind==='decoder')need(validTime(pipe.writeDispatchedMs)&&validTime(pipe.writeSettledMs)&&pipe.writeDispatchedMs<=pipe.writeSettledMs&&pipe.writeSettledMs<=pipe.finishMs&&pipe.observedBytes>0,'pipe');
    else need(pipe.writeDispatchedMs===null&&pipe.writeSettledMs===null&&pipe.observedBytes===0&&pipe.completeSha256===sha(Buffer.alloc(0)),'pipe');
   }else need(pipe.finishMs===null&&pipe.writeDispatchedMs===null&&pipe.writeSettledMs===null&&validTime(pipe.endMs)&&pipe.endMs<=pipe.closeMs,'pipe');
   if(pipe.droppedBytes===0)need(pipe.completeSha256===sha(prefix),'pipe');
  }
 }
 function originalsEvidence(originals,owner,rawReference){
  keys(originals,['schema','identity','policySha256','rawReference','nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256','decoder','queries','unsafeOutstanding',...Object.keys(P.flags)],'originals');
  need(Buffer.byteLength(JSON.stringify(originals))<=1048576&&originals.schema===P.schemas.originals&&same(originals.identity,traceIdentity)&&originals.policySha256===POLICY_SHA&&same(originals.rawReference,rawReference)&&originals.unsafeOutstanding===false,'originals');literalFlags(originals);
  for(const k of ['nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256'])need(digest(originals[k])&&originals[k]===owner[k],'source-join');
  processOriginal(originals.decoder,'decoder',owner);need(originals.decoder.parentPid===process.pid&&originals.decoder.dispatchMs===owner.clock.dispatchedMs&&originals.decoder.deadlineMs===owner.clock.successDeadlineMs,'original-clock');
  const queries=originals.queries,rss=owner.rss;need(Array.isArray(queries)&&queries.length>=2&&queries.length<=128&&queries.length===rss.attempted&&rss.samples.length===queries.length,'rss');
  const pids=new Set([originals.decoder.pid]),ids=new Set([originals.decoder.ownerId]);let latest=originals.decoder.cleanup.originalsClosedMs,previous=null;
  for(let i=0;i<queries.length;i++){
   const q=queries[i],sample=rss.samples[i];processOriginal(q,'rss-query',owner);need(!pids.has(q.pid)&&!ids.has(q.ownerId)&&q.parentPid===originals.decoder.parentPid&&q.startWitness===originals.decoder.startWitness&&q.stderr.observedBytes===0&&q.deadlineMs===Math.min(q.dispatchMs+250,owner.clock.successDeadlineMs)&&q.dispatchMs>=originals.decoder.spawn.observedMs&&q.cleanup.originalsClosedMs<originals.decoder.exit.observedMs&&(!previous||q.dispatchMs>=previous.cleanup.originalsClosedMs),'rss-original');pids.add(q.pid);ids.add(q.ownerId);
   need(Array.isArray(sample)&&sample.length===4&&sample[0]===(i===0?0:i===queries.length-1?2:1)&&sample[1]===q.dispatchMs&&finite(sample[2])&&sample[2]>=q.cleanup.originalsClosedMs&&sample[2]<q.deadlineMs&&sample[2]<originals.decoder.exit.observedMs&&integer(sample[3])&&sample[3]<=1073741824,'rss-sample');
   // Query stdout fits in its bounded prefix on accepted one-row ps output.
   need(q.stdout.droppedBytes===0,'rss-original');const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(q.stdout.retainedPrefixBase64,'base64'));
   const row=/^[ \t]*([0-9]+)[ \t]+([0-9]+)[ \t]+([0-9]+)[ \t]+([^\n]+?)[ \t]*\n?$/.exec(text);
   need(row&&Number(row[1])===originals.decoder.pid&&Number(row[2])===originals.decoder.parentPid&&Number.isSafeInteger(Number(row[3]))&&Number(row[3])*1024===sample[3]&&row[4]===q.startWitness,'rss-original');
   latest=Math.max(latest,q.cleanup.originalsClosedMs);previous=q;
  }
  need(latest===owner.clock.originalsClosedMs&&rss.peakBytes===Math.max(...rss.samples.map(s=>s[3])),'rss-join');
 }
 const traceDiagnostic={schema:'threadplane-aimock-trace-case-v3',profile,status:'unavailable',failure:traceFailure,buildSha256:traceIdentity?.buildSha256??null,rawCapture:null,decoderOriginals:null,validation:null,policySha256:POLICY_SHA,performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
 result.traceDiagnostic=traceDiagnostic;
 let traceOwnerEnd=Infinity,traceOwnerReceipt=null,traceOwnerOperation=null,tracePublicationError=null;
 try{
  const traceAfterRead=traceRetain(threadplaneBuildEvidence());
  const traceAfter=assertStock036BuildV1(await waitStock036BuildOriginalV1(traceAfterRead.original,wait,STAGES.transcript,'aimock-stock036-after'));
  need(traceBuild&&same(traceAfter,traceBuild)&&sha(JSON.stringify(traceAfter))===traceIdentity?.buildSha256,'build-drift');
  need(traceSnapshot,'snapshot-unavailable');
  successGate();const wrapper=createAimockTraceRawEvidenceV3(traceSnapshot);
  keys(wrapper,['schema','captureProfile','policySha256','identity','traceFormat','compression','payloadEncoding','receipt','retainedCompressedBytes','compressedSha256','payloadBase64',...Object.keys(P.flags)],'raw');literalFlags(wrapper);
  need(wrapper.schema===P.schemas.raw&&wrapper.captureProfile===P.captureProfile&&wrapper.policySha256===POLICY_SHA&&same(wrapper.identity,traceIdentity)&&same(wrapper.receipt,traceSnapshot.receipt)&&wrapper.traceFormat==='json'&&wrapper.compression==='gzip'&&wrapper.payloadEncoding==='base64','raw');
  const compressed=Buffer.from(wrapper.payloadBase64,'base64');need(compressed.toString('base64')===wrapper.payloadBase64&&compressed.length===wrapper.retainedCompressedBytes&&compressed.length<=4194304&&wrapper.payloadBase64.length<=5592408&&sha(compressed)===wrapper.compressedSha256&&Buffer.byteLength(JSON.stringify(wrapper))<=6291456&&Buffer.byteLength(JSON.stringify({...wrapper,payloadBase64:''}))<=65536,'raw');
  const rawReference=await publishOperation(()=>artifacts.writeJSON('aimock-trace-v3-private.json',wrapper,{kind:'trace-v3'}),'aimock-trace-raw-write');reference(rawReference,'aimock-trace-v3-private.json',wrapper,6291456);traceDiagnostic.rawCapture=rawReference;
  const rawRead=await publishOperation(()=>store.readJSON(rawReference,{kind:'trace-v3'}),'aimock-trace-raw-read');need(same(rawRead,wrapper),'raw-readback');
  successGate();traceOwnerOperation=traceRetain(runAimockTraceDecoderOwnerV3({identity:traceIdentity,store,artifacts,caseStarted:started,invocationStarted}));
  const owned=await observe(traceOwnerOperation,'aimock-trace-decoder-owner');
  keys(owned,['decoderResult','decoderOwner','decoderOriginals'],'owner-return');const {decoderResult,decoderOwner,decoderOriginals}=owned;traceOwnerReceipt=decoderOwner;
  keys(decoderOwner,['schema','status','reason','clock','originalsReference','nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256','rss','unsafeOutstanding',...Object.keys(P.flags)],'owner');literalFlags(decoderOwner);
  need(Buffer.byteLength(JSON.stringify(decoderOwner))<=16384&&decoderOwner.schema===P.schemas.owner&&['complete','unavailable'].includes(decoderOwner.status)&&(decoderOwner.status==='complete'?decoderOwner.reason===null:REASONS.has(decoderOwner.reason))&&typeof decoderOwner.unsafeOutstanding==='boolean'&&same(decoderOwner.originalsReference,decoderOriginals),'owner');
  keys(decoderOwner.clock,['basis','dispatchedMs','successDeadlineMs','cleanupDeadlineMs','originalsClosedMs'],'owner-clock');
  const clock=decoderOwner.clock;need(clock.basis==='parent-node-performance'&&finite(clock.dispatchedMs)&&clock.dispatchedMs>=started&&clock.dispatchedMs<=performance.now()&&(clock.originalsClosedMs===null||(finite(clock.originalsClosedMs)&&clock.originalsClosedMs<=performance.now()))&&clock.successDeadlineMs===Math.min(clock.dispatchedMs+10000,started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)&&clock.cleanupDeadlineMs===Math.min(started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)+LIMITS.cleanupMs,'owner-clock');
  traceOwnerEnd=clock.successDeadlineMs;successGate();
  if(decoderResult!==null)validateResult(decoderResult,traceIdentity,rawReference);
  if(decoderOriginals!==null){reference(decoderOriginals,'aimock-trace-v3-decoder-originals.json',undefined,1048576);traceDiagnostic.decoderOriginals=decoderOriginals;
   const originalRead=await publishOperation(()=>store.readJSON(decoderOriginals,{kind:'evidence'}),'aimock-trace-originals-read');reference(decoderOriginals,'aimock-trace-v3-decoder-originals.json',originalRead,1048576);
   if(decoderOwner.status==='complete')originalsEvidence(originalRead,decoderOwner,rawReference);
  }
  need(!decoderOwner.unsafeOutstanding&&!storeUnknown(),'owner-unsafe');
  const validation={schema:P.schemas.validation,identity:traceIdentity,policySha256:POLICY_SHA,rawReference,decoderResult,decoderOwner,performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
  need(Buffer.byteLength(JSON.stringify(validation))<=2097152,'validation-bound');
  const validationRef=await publishOperation(()=>artifacts.writeJSON('aimock-trace-v3-validation.json',validation,{kind:'evidence'}),'aimock-trace-validation-write');reference(validationRef,'aimock-trace-v3-validation.json',validation,2097152);traceDiagnostic.validation=validationRef;
  const validationRead=await publishOperation(()=>store.readJSON(validationRef,{kind:'evidence'}),'aimock-trace-validation-read');need(same(validationRead,validation),'validation-readback');
  receipt(wrapper.receipt,wrapper);
  need(!traceFailure&&decoderOwner.status==='complete'&&decoderOwner.reason===null&&decoderOriginals!==null&&decoderResult?.status==='valid'&&decoderResult.compressedBytes===wrapper.retainedCompressedBytes&&decoderResult.compressedSha256===wrapper.compressedSha256&&decoderResult.rendererMapping.status==='available'&&decoderResult.rendererMapping.binding.frameId===wrapper.receipt.inventory.mainFrameId&&decoderResult.costs.status==='available','qualification');
  const rss=decoderOwner.rss;keys(rss,['thresholdBytes','attempted','fulfilled','rejected','missed','pending','peakBytes','initialSeen','terminalSeen','samples'],'rss');
  need(rss.thresholdBytes===1073741824&&integer(rss.attempted)&&rss.attempted>=2&&rss.attempted<=128&&rss.fulfilled===rss.attempted&&rss.rejected===0&&rss.missed===0&&rss.pending===0&&rss.initialSeen===true&&rss.terminalSeen===true&&integer(rss.peakBytes)&&rss.peakBytes<=rss.thresholdBytes&&Array.isArray(rss.samples)&&finite(clock.originalsClosedMs)&&clock.originalsClosedMs>=clock.dispatchedMs&&clock.originalsClosedMs<clock.successDeadlineMs,'rss');
  successGate();need(!storeUnknown()&&!unsafeOutstanding,'publication-closure');traceDiagnostic.status='complete';
 }catch(error){tracePublicationError=error;traceFailure??='aimock-trace-publication-or-validation-unavailable';traceDiagnostic.failure??=traceFailure;tracePublicationStop=true;}
 if(tracePublicationStop||traceOwnerReceipt?.unsafeOutstanding||unsafeOutstanding||storeUnknown()){
  // An attention is not its original. Observe only operations already acquired,
  // clipped to native cleanup and original case/invocation ends, never now+30s.
  const end=Math.min(Math.min(started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)+LIMITS.cleanupMs,traceCleanupEnd===null?Infinity:traceCleanupEnd);
  for(const record of traceOperations)if(record.status==='pending'&&performance.now()<end){let timer;try{await Promise.race([record.original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('aimock-trace-original-unsettled')),Math.max(0,end-performance.now()));})]);}catch{}finally{clearTimeout(timer);}}
  let ownerUnknown=false;
  if(traceOwnerOperation?.status==='fulfilled')try{const settled=traceOwnerOperation.value;keys(settled,['decoderResult','decoderOwner','decoderOriginals'],'owner-return');const receipt=settled.decoderOwner;need(receipt&&receipt.schema===P.schemas.owner&&['complete','unavailable'].includes(receipt.status)&&typeof receipt.unsafeOutstanding==='boolean','owner');ownerUnknown=receipt.unsafeOutstanding;}catch{ownerUnknown=true;}
  if(traceOperations.some(r=>r.status==='pending'||(r.status==='rejected'&&r.error?.unsafeOutstanding===true))||storeUnknown()||traceOwnerReceipt?.unsafeOutstanding||ownerUnknown||unsafeOutstanding){
   unsafeOutstanding=true;result.unsafeOutstanding=true;const unsafeOutstandingError=Error(failure?.message??'aimock-trace-publication-unsettled',{cause:tracePublicationError??Error('aimock-trace-ownership-unavailable')});unsafeOutstandingError.unsafeOutstanding=true;throw unsafeOutstandingError;
  }
 }
 // TRACE-V3-END publish
 try{deadline.check();if(evidence.readinessV5)readinessReceiptRef=await wait(artifacts.writeJSON('readiness-receipt.json',evidence.readinessV5,{kind:'evidence'}),STAGES.progress,'matrix-readiness-receipt-write');if(serverOutcome)await wait(artifacts.writeJSON('server-process.json',serverOutcome,{kind:'evidence'}),STAGES.progress,'matrix-server-receipt-write');await wait(artifacts.writeJSON('evidence.json',evidence,{kind:'evidence'}),STAGES.transcript,'matrix-evidence-write');await wait(artifacts.writeJSON('result.json',result,{kind:'result'}),STAGES.progress,'matrix-result-write');}
 catch(error){
  fail(error);result.status='invalid';result.failure=failure;stopInvocation=artifacts.stats().failed||store.stats().stopped;
  const originalFailureWrite=artifacts.writeJSON('failure.json',{schema:'four-stack-matrix-failure-v5',acquisition:MATRIX_V5_ACQUISITION,id:slot.id,status:'invalid',failure,unsafeOutstanding,transcripts:evidence.transcripts,readinessV5:readinessReceiptRef,observerDiagnostics:diagnostics.failureRecord(),performance:false,scoringEligibility:false,FPS:null},{kind:'failure'});void originalFailureWrite.catch(()=>{});
  let timer;
  try{await Promise.race([originalFailureWrite,new Promise((_,reject)=>{const remaining=Math.min(STAGES.progress,Math.min(started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)+LIMITS.cleanupMs-performance.now());timer=setTimeout(()=>reject(Error('matrix-failure-publication-unsettled')),Math.max(1,remaining));})]);}
  catch(publication){result.publicationUnavailable=message(publication);unsafeOutstanding||=message(publication).includes('-unsettled');stopInvocation=true;}
  finally{clearTimeout(timer);}
 }
 // TRACE-V3-BEGIN stop
 stopInvocation ||= tracePublicationStop||traceDiagnostic.status!=='complete'||unsafeOutstanding;
 // TRACE-V3-END stop
 result.unsafeOutstanding=unsafeOutstanding;result.stopInvocation=stopInvocation;return result;
}
