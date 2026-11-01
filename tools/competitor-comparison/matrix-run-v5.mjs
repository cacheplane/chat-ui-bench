import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,matrixVerificationRoster,nativeHistorySeekV4 as nativeHistorySeek,MATRIX_V5_ACQUISITION,MATRIX_V5_READINESS} from './matrix-policy-v5.mjs';
import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';
import {createMatrixReadinessControllerV5} from './matrix-readiness-v5.mjs';
import {matrixCIFailureAnnotation} from './matrix-ci-summary-v1.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const message=error=>String(error?.message??error).slice(0,4096);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exec=promisify(execFile);
const absolute=value=>typeof value==='string'&&path.isAbsolute(value)&&path.resolve(value)===value;
export function parseMatrixArguments(args){
 const values={};let verify=false;
 for(let i=0;i<args.length;i++){
  const key=args[i];if(key==='--verify'){if(verify)throw Error('matrix-arguments');verify=true;continue;}
  if(!['--out','--profile','--history-count','--response-bytes','--journey'].includes(key)||Object.hasOwn(values,key)||typeof args[i+1]!=='string'||args[i+1].startsWith('--'))throw Error('matrix-arguments');values[key]=args[++i];
 }
 if(!absolute(values['--out']))throw Error('matrix-absolute-output-required');
 const filters=[['--profile','profile',['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']],['--history-count','historyCount',['100','1000','10000']],['--response-bytes','responseBytes',['6400','262144']],['--journey','journey',['follow','history-reading']]];
 const selected=filters.filter(([key])=>Object.hasOwn(values,key));if(verify&&selected.length)throw Error('matrix-strict-filters');
 for(const[key,,allowed]of selected)if(!allowed.includes(values[key]))throw Error('matrix-selection');
 const slots=matrixVerificationRoster().filter(slot=>selected.every(([key,field])=>String(slot.selection[field])===values[key]));
 return Object.freeze({out:values['--out'],mode:selected.length?'debug':'strict',slots:Object.freeze(slots)});
}
/** Timers bound attention only; callers retain and drain each original owner. */
export function createMatrixDeadline({caseStarted,invocationStarted,now=()=>performance.now()}){
 const remaining=()=>Math.max(0,Math.min(caseStarted+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)-now());
 const check=()=>{if(remaining()<=0)throw Error('matrix-global-or-case-deadline');};
 return Object.freeze({remaining,check,async wait(original,stageMs,label){
  check();let timer;const began=now(),limit=Math.min(stageMs,remaining());
  try{
   const result=await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+'-deadline')),limit);})]);
   check();if(now()-began>stageMs)throw Error(label+'-deadline');return result;
  }finally{clearTimeout(timer);}
 }});
}
export async function runMatrixRoster({slots,execute,invocationStarted,now=()=>performance.now(),onResult=async()=>{}}){
 const results=[];let stop=null;
 for(const slot of slots){
  if(!stop&&now()-invocationStarted>=LIMITS.invocationMs)stop='matrix-invocation-deadline';
  if(stop){results.push({id:slot.id,kind:slot.kind,selection:slot.selection,status:'unattempted',reason:stop,acquisition:MATRIX_V5_ACQUISITION,performance:false,scoringEligibility:false,FPS:null});continue;}
  let result;
  try{result=await execute(slot);}catch(error){result={id:slot.id,kind:slot.kind,selection:slot.selection,status:'invalid',failure:{message:message(error)},unsafeOutstanding:true,acquisition:MATRIX_V5_ACQUISITION,performance:false,scoringEligibility:false,FPS:null};}
  results.push(result);
  try{await onResult(result);}catch(error){result.status='invalid';result.failure??={message:message(error)};result.stopInvocation=true;}
  if(result.unsafeOutstanding)stop='matrix-original-ownership-unsettled';
  else if(result.stopInvocation)stop='matrix-publication-or-storage-unavailable';
 }
 return{results,complete:results.length===slots.length&&results.every((result,i)=>result.status===(slots[i].kind==='positive'?'matrix-pass':'negative-pass')&&!result.unsafeOutstanding),stopReason:stop};
}

/** Capture first; inspect cancellation after the complete trusted dispatch task. */
export function installMatrixWheelRecorder(selector){
 const node=document.querySelector(selector);if(!node)throw Error('matrix-wheel-scroller-absent');
 const recorder={records:[],overflow:false};window.__matrixWheel=recorder;
 node.addEventListener('wheel',event=>{
  if(recorder.records.length>=32){recorder.overflow=true;return;}
  const row={trusted:event.isTrusted,deltaY:event.deltaY,target:event.target instanceof Element?event.target.tagName:null,beforeTop:node.scrollTop,defaultPrevented:null};recorder.records.push(row);
  setTimeout(()=>{row.defaultPrevented=event.defaultPrevented;},0);
 },{capture:true,passive:true});
}
export function requireMatrixWheelDelivery(events,deltaY){
 if(!Array.isArray(events)||events.length<1||events.length>32||events.some(row=>row.trusted!==true||row.defaultPrevented!==false||!Number.isFinite(row.deltaY)||row.deltaY>=0)||events.reduce((sum,row)=>sum+row.deltaY,0)!==deltaY)throw Error('matrix-native-wheel-custody');
 return events;
}
export async function captureMatrixFinalBookend({started,attempted,remaining,read,write}){
 if(!started||attempted)return{attempted};
 if(remaining<=0)return{attempted:false,unavailable:{attempted:false,reason:'matrix-deadline-exhausted'}};
 let snapshot;
 try{snapshot=await read();return{attempted:true,snapshot,reference:await write(snapshot)};}
 catch(error){return{attempted:true,snapshot,error,unavailable:{attempted:true,reason:message(error)}};}
}

/** Observe the exact original transport promise without wrapping it or granting
 * its DTO any input authority. Only on-time final full-sample evidence
 * is retained; the controller independently applies every strong validator.
 */
export function createMatrixReadinessPortV5({page,evidence,diagnostics,capture,now,remaining}){
 const sourceEvaluate=page.evaluate.bind(page);
 const own=(value,key)=>{const descriptor=value&&Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))throw Error('matrix-v5-capture-unavailable');return descriptor.value;};
 const ordinal=value=>Number.isSafeInteger(value)&&value>=1&&value<=80?value:null;
 return (callback,options)=>{
  const original=sourceEvaluate(callback,options);
  // Register before the controller attaches its owner reaction. Retained data
  // is diagnostic only; the controller remains the sole input authority.
  Promise.prototype.then.call(original,value=>{
   try{
    if(!capture.open||options.phase!=='final'||capture.ack===null)return;
    const elapsed=now()-capture.ack,left=remaining();if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=4000||!Number.isFinite(left)||left<=0)return;
    const outcome=own(value,'outcome');if(outcome!=='candidate'&&outcome!=='rejected')return;
    const sample=own(value,'sample');if(sample===null)return;
    // Playwright's returned DTO already owns isolated data. Read descriptors
    // without getters and retain references without cloning/serializing prose.
    const response=own(sample,'response'),progress=own(sample,'progress'),dom=own(sample,'dom');
    const metadata={phase:'final',outcome,sampleObservation:ordinal(own(value,'sampleObservation')),observationCount:ordinal(own(value,'observationCount'))};
    evidence.beforeWheelResponse=response;evidence.beforeWheelProgress=progress;evidence.domBeforeWheel=dom;evidence.readinessFinalSample=metadata;
    diagnostics.sampleFulfilled(sample);
   }catch{ /* Evidence observation must never replace the primary outcome. */ }
  },()=>{});
  return original;
 };
}

function assetsFor(profile){return path.join(ROOT,profile==='threadplane'?'apps/threadplane/dist':`competitors/${profile}/dist`);}
async function fileFacts(directory,{assets=false}={}){
 const rows=[];let total=0;
 const walk=async current=>{for(const name of (await fs.readdir(current)).sort()){
  const file=path.join(current,name),stat=await fs.lstat(file);if(stat.isSymbolicLink())throw Error('matrix-facts-symlink');
  if(stat.isDirectory()){await walk(file);continue;}
  if(!stat.isFile()||stat.nlink!==1||stat.size>16777216||rows.length>=4096||(total+=stat.size)>67108864)throw Error('matrix-facts-cap');
  const bytes=await fs.readFile(file);if(bytes.length!==stat.size)throw Error('matrix-facts-drift');rows.push({path:path.relative(directory,file),bytes:bytes.length,sha256:sha(bytes)});
 }};await walk(directory);if(assets&&!rows.some(row=>row.path==='index.html'))throw Error('matrix-index-absent');return rows;
}
export async function collectMatrixProvenance(profile){
 const git=async args=>(await exec('git',args,{cwd:ROOT,encoding:'utf8',timeout:STAGES.progress,maxBuffer:262144})).stdout;
 const [commitText,statusText,listing]=await Promise.all([
  git(['rev-parse','HEAD']),git(['status','--porcelain=v1','--untracked-files=normal']),
  git(['ls-files','--cached','--others','--exclude-standard','-z','--','tools/competitor-comparison','competitors/shared','packages/contract','apps/threadplane',...(profile==='threadplane'?[]:[`competitors/${profile}`]),'tests/fixtures/aimock.ts','package.json','package-lock.json']),
 ]);
 const commit=commitText.trim();if(!/^[0-9a-f]{40}$/.test(commit))throw Error('matrix-source-commit');
 const names=[...new Set(listing.split('\0').filter(Boolean))].sort();if(names.length>4096)throw Error('matrix-source-file-cap');
 const source=[];let total=0;
 for(const name of names){
  if(!name||path.isAbsolute(name)||name.split('/').some(part=>['..','node_modules','dist','.git'].includes(part)))throw Error('matrix-source-path');
  const file=path.join(ROOT,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.nlink!==1||stat.size>16777216||(total+=stat.size)>67108864)throw Error('matrix-source-file');
  const bytes=await fs.readFile(file);if(bytes.length!==stat.size)throw Error('matrix-source-drift');source.push({path:name,bytes:bytes.length,sha256:sha(bytes)});
 }
 const lockNames=new Set(['package.json','package-lock.json',...(profile==='threadplane'?[]:[`competitors/${profile}/package.json`,`competitors/${profile}/package-lock.json`])]);
 return{controller:{commit,dirty:statusText.length>0},source,locks:source.filter(row=>lockNames.has(row.path)),compiledContract:await fileFacts(path.join(ROOT,'packages/contract/dist')),assets:await fileFacts(assetsFor(profile),{assets:true})};
}
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

export async function runMatrixCase({slot,store,out,invocationStarted}){
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
  diagnostics.dispatched('start');
  runStarted=performance.now();await evaluate(()=>window.competitorBench.start());
  const readinessAck=performance.now();
  if(readinessController){readinessCapture.ack=readinessAck;readinessController.start(readinessAck);}
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
  if(browser){const originalClose=browser.close();void originalClose.catch(()=>{});try{await cleanupWait(originalClose,STAGES.browserClose,'matrix-browser-close');evidence.cleanup.browserClosed=true;}catch(error){unsafeOutstanding=true;fail(error);}}
  if(networkGuard)evidence.networkGuardAfterCleanup=networkGuard.read();
  if(server){const originalClose=server.close();void originalClose.catch(()=>{});try{serverOutcome=await cleanupWait(originalClose,STAGES.serverClose,'matrix-server-close');}catch(error){unsafeOutstanding=true;fail(error);if(error.serverOutcome)serverOutcome=error.serverOutcome;}}
  if(serverOutcome){evidence.server=serverOutcome.report;evidence.cleanup.serverExit=serverOutcome.exit;evidence.cleanup.serverClose=serverOutcome.close;}
  // Seal the history receipt after original cleanup, before any publication.
  readinessCapture.open=false;
  if(readinessController)try{const sealed=readinessController.seal();evidence.readinessV5=sealed.receipt;unsafeOutstanding||=sealed.unsafeOutstanding;}catch(error){unsafeOutstanding=true;fail(error);}
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
 try{deadline.check();if(evidence.readinessV5)readinessReceiptRef=await wait(artifacts.writeJSON('readiness-receipt.json',evidence.readinessV5,{kind:'evidence'}),STAGES.progress,'matrix-readiness-receipt-write');if(serverOutcome)await wait(artifacts.writeJSON('server-process.json',serverOutcome,{kind:'evidence'}),STAGES.progress,'matrix-server-receipt-write');await wait(artifacts.writeJSON('evidence.json',evidence,{kind:'evidence'}),STAGES.transcript,'matrix-evidence-write');await wait(artifacts.writeJSON('result.json',result,{kind:'result'}),STAGES.progress,'matrix-result-write');}
 catch(error){
  fail(error);result.status='invalid';result.failure=failure;stopInvocation=artifacts.stats().failed||store.stats().stopped;
  const originalFailureWrite=artifacts.writeJSON('failure.json',{schema:'four-stack-matrix-failure-v5',acquisition:MATRIX_V5_ACQUISITION,id:slot.id,status:'invalid',failure,unsafeOutstanding,transcripts:evidence.transcripts,readinessV5:readinessReceiptRef,observerDiagnostics:diagnostics.failureRecord(),performance:false,scoringEligibility:false,FPS:null},{kind:'failure'});void originalFailureWrite.catch(()=>{});
  let timer;
  try{await Promise.race([originalFailureWrite,new Promise((_,reject)=>{const remaining=Math.min(STAGES.progress,Math.min(started+LIMITS.caseMs,invocationStarted+LIMITS.invocationMs)+LIMITS.cleanupMs-performance.now());timer=setTimeout(()=>reject(Error('matrix-failure-publication-unsettled')),Math.max(1,remaining));})]);}
  catch(publication){result.publicationUnavailable=message(publication);unsafeOutstanding||=message(publication).includes('-unsettled');stopInvocation=true;}
  finally{clearTimeout(timer);}
 }
 result.unsafeOutstanding=unsafeOutstanding;result.stopInvocation=stopInvocation;return result;
}

export async function runMatrixInvocation(options){
 const selected=parseMatrixArguments(options),invocationStarted=performance.now();
 const setup=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted});
 const {createMatrixArtifactStore}=await setup.wait(import('./matrix-artifacts-v3.mjs'),STAGES.transcript,'matrix-artifact-module');
 const store=await setup.wait(createMatrixArtifactStore({directory:selected.out}),STAGES.progress,'matrix-invocation-directory');
 const manifest={schema:'four-stack-matrix-invocation-v5',acquisition:MATRIX_V5_ACQUISITION,readinessPolicy:MATRIX_V5_READINESS,mode:selected.mode,selection:selected.slots.map(({id,kind,selection})=>({id,kind,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},performance:false,scoringEligibility:false,FPS:null};
 await setup.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'matrix-initial-manifest');
 const execution=await runMatrixRoster({slots:selected.slots,invocationStarted,execute:slot=>runMatrixCase({slot,store,out:selected.out,invocationStarted}),onResult:async result=>{console.log(JSON.stringify({id:result.id,status:result.status,failure:result.failure??null,FPS:null}));if(process.env.GITHUB_ACTIONS==='true'){const annotation=matrixCIFailureAnnotation(result);if(annotation)console.log(annotation);}}});
 const final={...manifest,status:execution.complete?'complete':'incomplete',...execution,storage:store.stats()};
 const originalPublication=store.writeManifest('manifest-final.json',final);let timer;
 try{await Promise.race([originalPublication,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('matrix-final-manifest-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-performance.now())));})]);}finally{clearTimeout(timer);}
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runMatrixInvocation(process.argv.slice(2)).then(result=>{if(!result.complete)process.exitCode=1;},error=>{console.error(message(error));process.exitCode=1;});
