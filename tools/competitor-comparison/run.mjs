import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createFunctionalCase} from './fixtures.mjs';
import {launchCaseServer} from './process.mjs';
import {admitFunctionalCase,validateHistory,matchVisible,continuationPath,streamingReadiness} from './admission.mjs';
import {installOwnedNetworkGuard} from './network.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const PROFILES=['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const message=error=>String(error?.message??error).slice(0,4096);
async function write(dir,name,value){const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');if(bytes.length>2097152)throw Error('functional-evidence-cap');await fs.writeFile(path.join(dir,name),bytes,{flag:'wx',mode:0o600});return{path:name,bytes:bytes.length,sha256:sha(bytes)};}
function bounded(original,ms,label){let timer;return Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
const evaluate=(page,...args)=>bounded(page.evaluate(...args),45000,'functional-page-evaluation-deadline');
function assetsFor(profile){return path.join(ROOT,profile==='threadplane'?'apps/threadplane/dist':'competitors/'+profile+'/dist');}
async function assetFacts(directory){
 const rows=[];let total=0;
 async function walk(current){for(const name of (await fs.readdir(current)).sort()){
  const file=path.join(current,name),s=await fs.lstat(file);if(s.isSymbolicLink())throw Error('functional-asset-symlink');
  if(s.isDirectory()){await walk(file);continue;}if(!s.isFile()||s.nlink!==1||s.size>16777216||rows.length>=1024||(total+=s.size)>67108864)throw Error('functional-asset-cap');
  const bytes=await fs.readFile(file);if(bytes.length!==s.size)throw Error('functional-asset-drift');rows.push({path:path.relative(directory,file),bytes:bytes.length,sha256:sha(bytes)});
 }}await walk(directory);if(!rows.some(x=>x.path==='index.html'))throw Error('functional-index-absent');return rows;
}

/** Serialized as a complete observer, without expected/future response content. */
export function collectDOM(selectors){
 const scroller=document.querySelector(selectors.scroller),errors=[],items=[];
 if(!(scroller instanceof HTMLElement))return{mountedCount:0,errors:['scroller-absent'],items};
 const box=scroller.getBoundingClientRect(),clip={left:Math.max(0,box.left+scroller.clientLeft),top:Math.max(0,box.top+scroller.clientTop),right:Math.min(innerWidth,box.left+scroller.clientLeft+scroller.clientWidth),bottom:Math.min(innerHeight,box.top+scroller.clientTop+scroller.clientHeight)};
 const nodes=Array.from(document.querySelectorAll(selectors.message));if(nodes.length>256)return{mountedCount:nodes.length,errors:['mounted-node-cap'],items};
 for(const element of nodes){
  if(!(element instanceof HTMLElement)||!scroller.contains(element)){errors.push('message-outside-scroller');continue;}
  const content=element.matches(selectors.messageContent)?element:element.querySelector(selectors.messageContent);if(!content){errors.push('message-content-absent');continue;}
  const text=content.textContent??'';if(text.length>8192){errors.push('message-text-cap');continue;}
  const rect=content.getBoundingClientRect(),style=getComputedStyle(content);
  const visible=content.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true,opacityProperty:true})&&style.display!=='none'&&Math.min(rect.right,clip.right)>Math.max(rect.left,clip.left)&&Math.min(rect.bottom,clip.bottom)>Math.max(rect.top,clip.top);
  items.push({nativeId:element.getAttribute('data-message-id')??element.getAttribute('data-bench-message-id')??element.getAttribute('data-bench-message'),text,visible,top:rect.top,bottom:rect.bottom});
 }
 return{mountedCount:nodes.length,errors,items,scroll:{top:scroller.scrollTop,height:scroller.scrollHeight,clientHeight:scroller.clientHeight,rect:{x:box.x,y:box.y,width:box.width,height:box.height}}};
}

async function installThreadplaneBridge(page,source,origin){
 await page.waitForFunction(()=>window.benchHost||window.benchSetupError,{},{timeout:45000});
 await evaluate(page,async({history,origin})=>{
  if(window.benchSetupError)throw Error(window.benchSetupError);const host=window.benchHost;if(!host)throw Error('stock-threadplane-host-absent');
  await host.loadHistory(history);let operation={kind:'original-run-promise',status:'idle'},original=null,disposed=false;
  window.competitorBench={
   capabilities:host.capabilities,
   selectors:{scroller:host.locators.scroller,composer:host.locators.composer,message:'chat chat-message-list > chat-message',messageContent:'.chat-message__bubble, .chat-message__assistant-body > chat-streaming-md',returnToResponse:host.locators.returnToResponse},
   read(){if(disposed)throw Error('stock-host-disposed');const runtime=host.readTranscript(),progress=host.readProgress(),messages=runtime.transcript.map(({id,role,text})=>({id,role,text}));return{messages,running:progress.loading,error:progress.error,responseId:messages.length>history.length?messages.at(-1).id:null,operation:{...operation}};},
   start(){if(operation.status!=='idle')throw Error('stock-original-run-once');operation.status='pending';host.connectReplay(origin+'/stream/canonical');original=host.waitForReplay();original.then(()=>{operation.status='fulfilled';},()=>{operation.status='rejected';});},
   waitForRun(){if(!original)throw Error('stock-run-not-started');return original;},
   async dispose(){disposed=true;await host.dispose();if(original)await original;},
  };
 },{history:source.fixture.history,origin});
}

export async function runFunctionalCase({profile,journey,out,omitDelta}){
 if(!PROFILES.includes(profile)||!['follow','history-reading'].includes(journey)||!path.isAbsolute(out)||path.resolve(out)!==out)throw Error('functional-case-selection');
 await fs.mkdir(out,{mode:0o700});
 const source=createFunctionalCase(profile,journey),fixture=await write(out,'fixture-private.json',source),assetsDirectory=assetsFor(profile);
 const beforeAssets=await assetFacts(assetsDirectory),evidence={network:{finished:[],failed:[],external:[],resourceErrors:[]},cleanup:{publicDispose:{settled:false,fulfilled:false},browserClosed:false,serverExit:null,serverClose:null}};
 let server,browser,originalLaunch,page,networkGuard,selectors,serverOutcome,failure=null,unsafeOutstanding=false;
 const pageErrors=[],consoleErrors=[];
 try{
  server=await launchCaseServer({profile,assetsDirectory,fixturePath:path.join(out,fixture.path),sha256:fixture.sha256,omitDelta});
  originalLaunch=chromium.launch({headless:true});
  browser=await bounded(originalLaunch,30000,'functional-browser-launch-deadline');
  evidence.browser={version:browser.version(),mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1}};
  const context=await bounded(browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}),10000,'functional-browser-context-deadline');
  page=await bounded(context.newPage(),10000,'functional-browser-page-deadline');
  networkGuard=await bounded(installOwnedNetworkGuard({context,page,origin:server.origin,onExternal:url=>evidence.network.external.push(url.slice(0,1024))}),10000,'functional-browser-network-policy-deadline');
  page.on('pageerror',error=>{if(pageErrors.length<32)pageErrors.push(message(error));});
  page.on('console',event=>{if(event.type()==='error'&&consoleErrors.length<32)consoleErrors.push(event.text().slice(0,4096));});
  let validating=true;
  let clientFinished,clientFailed;
  const clientCompletion=new Promise((resolve,reject)=>{clientFinished=resolve;clientFailed=reject;});
  void clientCompletion.catch(()=>{});
  const isContinuation=request=>request.url()===server.origin+continuationPath(profile)&&request.method()===(profile==='threadplane'?'GET':'POST');
  page.on('requestfinished',request=>{if(validating&&request.url().startsWith(server.origin+'/'))evidence.network.finished.push(new URL(request.url()).pathname);if(isContinuation(request))clientFinished();});
  page.on('requestfailed',request=>{if(validating)evidence.network.failed.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText??'unknown'});if(isContinuation(request))clientFailed(Error('functional-browser-continuation-failed'));});
  page.on('response',response=>{if(validating&&response.status()>=400&&['document','script','stylesheet','font'].includes(response.request().resourceType()))evidence.network.resourceErrors.push({path:new URL(response.url()).pathname,status:response.status()});});
  await page.goto(server.origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
  if(profile==='threadplane')await installThreadplaneBridge(page,source,server.origin);
  await page.waitForFunction(()=>{
   if(window.competitorBenchError)return true;const api=window.competitorBench;if(!api)return false;
   try{const state=api.read();return state.error!==null||state.messages.length===100&&!state.running;}catch{return true;}
  },{},{timeout:45000});
  const startup=await evaluate(page,()=>window.competitorBenchError??null);if(startup)throw Error(startup);
  evidence.initial=await evaluate(page,()=>window.competitorBench.read());validateHistory(source.publicContext,evidence.initial);
  const adapter=await evaluate(page,()=>({selectors:window.competitorBench.selectors,capabilities:window.competitorBench.capabilities}));selectors=adapter.selectors;evidence.capabilities=adapter.capabilities;
  if(await page.locator(selectors.scroller).count()!==1||await page.locator(selectors.composer).count()!==1)throw Error('functional-unique-native-locators');
  // Explicit preparation only. The active history journey uses trusted native wheel/click.
  await page.locator(selectors.scroller).evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await page.waitForFunction(selector=>{const node=document.querySelector(selector);return node&&Math.abs(node.scrollHeight-node.scrollTop-node.clientHeight)<=1;},selectors.scroller,{timeout:10000});
  await evaluate(page,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  evidence.domInitial=await evaluate(page,collectDOM,selectors);matchVisible(evidence.domInitial,evidence.initial.messages);
  await evaluate(page,()=>window.competitorBench.start());
  await page.waitForFunction(()=>{const state=window.competitorBench.read();return state.error!==null||state.responseId!==null;},{},{timeout:15000});
  evidence.streaming=await evaluate(page,()=>window.competitorBench.read());if(evidence.streaming.error)throw Error(evidence.streaming.error);
  if(journey==='history-reading'){
   // Use the same observed prose gate across profiles. An empty assistant ID
   // can precede stock run-start anchoring; wheel input must follow that stage.
   await page.waitForFunction(()=>{const state=window.competitorBench.read();return state.error!==null||state.messages.at(-1)?.text.length>=512;},{},{timeout:10000});
   const pointerDOM=await evaluate(page,collectDOM,selectors),pointerRect=pointerDOM.scroll.rect;
   if(pointerRect.width<=0||pointerRect.height<=0)throw Error('functional-scroll-geometry');
   const x=pointerRect.x+pointerRect.width/2,y=pointerRect.y+Math.min(pointerRect.height/3,120);await page.mouse.move(x,y);
   await evaluate(page,selector=>{
    const node=document.querySelector(selector),records=[];window.__functionalWheel=records;
    node.addEventListener('wheel',event=>{if(records.length>=32)return;const row={trusted:event.isTrusted,deltaY:event.deltaY,target:event.target instanceof Element?event.target.tagName:null,beforeTop:node.scrollTop,defaultPrevented:null};records.push(row);queueMicrotask(()=>{row.defaultPrevented=event.defaultPrevented;});},{capture:true,passive:true});
   },selectors.scroller);
   const readinessDeadline=performance.now()+5000;let rendered=false;
   while(performance.now()<readinessDeadline){
    evidence.domBeforeWheel=await evaluate(page,collectDOM,selectors);
    evidence.beforeWheelState=await evaluate(page,()=>window.competitorBench.read());
    try{evidence.renderedReadiness=streamingReadiness(source.publicContext,evidence.beforeWheelState,evidence.domBeforeWheel);rendered=true;break;}
    catch(error){if(message(error)!=='competitor-streaming-response-not-ready')throw error;}
    await page.waitForTimeout(50);
   }
   if(!rendered)throw Error('functional-rendered-response-readiness-deadline');
   evidence.wheelReadiness=evidence.capabilities.scrollPolicy==='turn-anchoring'?await evaluate(page,selector=>new Promise((resolve,reject)=>{
    const node=document.querySelector(selector),samples=[];let stable=0,last=null,stopped=false;
    const timer=setTimeout(()=>{stopped=true;reject(Error('functional-native-scroll-not-settled'));},2000);
    const observe=timestamp=>{
     if(stopped)return;
     const top=node.scrollTop;samples.push({timestamp,top});stable=last!==null&&Math.abs(top-last)<=0.5?stable+1:0;last=top;
     if(stable>=3){clearTimeout(timer);resolve({criterion:'three-consecutive-stable-scrollTop-intervals',samples});return;}
     if(samples.length>=128){clearTimeout(timer);reject(Error('functional-scroll-readiness-bound'));return;}requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
   }),selectors.scroller):{criterion:'active-bottom-follow-no-stationarity-required'};
   await evaluate(page,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const before=await evaluate(page,collectDOM,selectors),rect=before.scroll.rect;
   evidence.domBeforeWheel=before;
   evidence.beforeWheelState=await evaluate(page,()=>window.competitorBench.read());
   evidence.renderedReadiness=streamingReadiness(source.publicContext,evidence.beforeWheelState,before);
   if(rect.width<=0||rect.height<=0||x<rect.x||x>=rect.x+rect.width||y<rect.y||y>=rect.y+rect.height)throw Error('functional-scroll-geometry');
   await page.mouse.wheel(0,-600);
   try{await page.waitForFunction(({selector,top})=>document.querySelector(selector).scrollTop<top-1,{selector:selectors.scroller,top:before.scroll.top},{timeout:5000});}
   finally{evidence.wheelEvents=await evaluate(page,()=>window.__functionalWheel);evidence.domAfterWheel=await evaluate(page,collectDOM,selectors);}
   await evaluate(page,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   evidence.domAfterWheel=await evaluate(page,collectDOM,selectors);
   const actual=await evaluate(page,()=>window.competitorBench.read()),visible=matchVisible(evidence.domAfterWheel,actual.messages),anchor=visible.find(x=>source.publicContext.history.some(m=>m.id===x.id));
   if(!anchor)throw Error('functional-visible-history-anchor');
   evidence.scroll={nativeDispatch:true,deltaY:-600,beforeTop:before.scroll.top,afterTop:evidence.domAfterWheel.scroll.top,anchorId:anchor.id,returnClicked:false};
  }
  await bounded(evaluate(page,()=>window.competitorBench.waitForRun()),30000,'functional-original-run-deadline');
  evidence.afterOriginalRun=await evaluate(page,()=>window.competitorBench.read());
  await bounded(clientCompletion,5000,'functional-browser-original-completion-deadline');
  await page.waitForFunction(()=>{const s=window.competitorBench.read();return s.error!==null||!s.running&&s.messages.length===101;},{},{timeout:10000});
  evidence.final=await evaluate(page,()=>window.competitorBench.read());
  if(evidence.streaming.responseId!==null&&evidence.final.responseId!==evidence.streaming.responseId)throw Error('functional-response-id-drift');
  await evaluate(page,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  if(journey==='history-reading'){
   evidence.domBeforeReturn=await evaluate(page,collectDOM,selectors);
   if(!selectors.returnToResponse)throw Error('functional-native-return-unsupported');
   evidence.returnControl=await evaluate(page,selector=>{const nodes=Array.from(document.querySelectorAll(selector));return{count:nodes.length,visibleCount:nodes.filter(node=>node.checkVisibility({visibilityProperty:true,opacityProperty:true})).length};},selectors.returnToResponse);
   if(!matchVisible(evidence.domBeforeReturn,evidence.final.messages).some(item=>item.id===evidence.scroll.anchorId))throw Error('functional-historical-anchor-lost-before-return');
   await page.locator(selectors.returnToResponse).click({timeout:10000});evidence.scroll.returnClicked=true;
  }
   const response=evidence.final.messages.find(message=>message.id===evidence.final.responseId);
   const until=performance.now()+10000;let visible=false;
   while(performance.now()<until){
    const dom=await evaluate(page,collectDOM,selectors);
    if(response&&dom.errors.length===0&&dom.items.some(item=>item.visible&&item.text===response.text&&(item.nativeId===null||item.nativeId===response.id))){visible=true;break;}
    await page.waitForTimeout(50);
   }
   if(!visible)throw Error('functional-complete-response-not-visible');
   await evaluate(page,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  evidence.domFinal=await evaluate(page,collectDOM,selectors);
  evidence.networkGuardBeforeCleanup=networkGuard.read();
  if(evidence.networkGuardBeforeCleanup.closed||evidence.networkGuardBeforeCleanup.overflow||context.pages().length!==1)throw Error('functional-network-observation-invalid');
  if(pageErrors.length||evidence.network.resourceErrors.length)throw Error('functional-page-or-resource-error');
  validating=false;
 }catch(error){failure={message:message(error)};unsafeOutstanding=error.unsafeOutstanding===true;if(error.serverOutcome)serverOutcome=error.serverOutcome;}
 finally{
  if(!browser&&originalLaunch)try{browser=await bounded(originalLaunch,10000,'functional-original-browser-launch-unsettled');}catch(error){if(message(error).includes('unsettled'))unsafeOutstanding=true;}
  if(page){
   try{await bounded(evaluate(page,async()=>{if(window.competitorBench)await window.competitorBench.dispose();}),10000,'functional-public-dispose-deadline');evidence.cleanup.publicDispose={settled:true,fulfilled:true};}
   catch(error){evidence.cleanup.publicDispose={settled:!message(error).includes('deadline'),fulfilled:false,error:message(error)};}
  }
  if(browser)try{await bounded(browser.close(),10000,'functional-browser-close-deadline');evidence.cleanup.browserClosed=true;}catch(error){unsafeOutstanding=true;failure??={message:message(error)};}
  if(networkGuard)evidence.networkGuardAfterCleanup=networkGuard.read();
  if(server)try{serverOutcome=await server.close();}catch(error){serverOutcome=error.serverOutcome;unsafeOutstanding||=error.unsafeOutstanding===true;failure??={message:message(error)};}
  if(serverOutcome){evidence.server=serverOutcome.report;evidence.cleanup.serverExit=serverOutcome.exit;evidence.cleanup.serverClose=serverOutcome.close;await write(out,'server-process.json',serverOutcome);}
 }
 evidence.pageErrors=pageErrors;evidence.consoleErrors=consoleErrors;
 try{const afterAssets=await assetFacts(assetsDirectory);if(JSON.stringify(beforeAssets)!==JSON.stringify(afterAssets))throw Error('functional-assets-changed');}catch(error){failure??={message:message(error)};}
 let admission=null;
 try{if(failure)throw Error(failure.message);admission=admitFunctionalCase(source,evidence);}catch(error){failure??={message:message(error)};}
 await write(out,'evidence.json',evidence);
 if(failure)failure.diagnostics={renderedReadiness:evidence.renderedReadiness??null,beforeWheel:evidence.domBeforeWheel?.scroll??null,afterWheel:evidence.domAfterWheel?.scroll??null,beforeReturn:evidence.domBeforeReturn?.scroll??null,returnControl:evidence.returnControl??null,wheelEventCount:evidence.wheelEvents?.length??0,trustedWheelCount:evidence.wheelEvents?.filter(event=>event.trusted).length??0,wheelDeltaY:evidence.wheelEvents?.reduce((sum,event)=>sum+event.deltaY,0)??0};
 const result={schema:'four-stack-functional-case-v2',profile,journey,purpose:'functional-conformance-development',fixtureDigests:source.publicContext.digests,fixture,assets:beforeAssets,status:failure?'invalid':'functional-pass',failure,admission,unsafeOutstanding,performance:false,scoringEligibility:false,FPS:null};
 await write(out,'result.json',result);return result;
}

async function main(args){
 const values={};for(let i=0;i<args.length;i+=2){if(!['--out','--profile','--journey','--omit-delta'].includes(args[i])||values[args[i]]!==undefined||args[i+1]===undefined)throw Error('functional-arguments');values[args[i]]=args[i+1];}
 const out=values['--out'];if(!out||!path.isAbsolute(out)||path.resolve(out)!==out)throw Error('functional-absolute-output-required');await fs.mkdir(out,{mode:0o700});
 const profiles=values['--profile']?[values['--profile']]:PROFILES,journeys=values['--journey']?[values['--journey']]:['follow','history-reading'];
 if(profiles.some(p=>!PROFILES.includes(p))||journeys.some(j=>!['follow','history-reading'].includes(j)))throw Error('functional-case-selection');
 const omit=values['--omit-delta']===undefined?undefined:Number(values['--omit-delta']);if(omit!==undefined&&(!Number.isInteger(omit)||omit<1||omit>200))throw Error('functional-fault-selection');
 const results=[];
 for(const profile of profiles)for(const journey of journeys){
  const result=await runFunctionalCase({profile,journey,out:path.join(out,profile+'-'+journey),omitDelta:omit});results.push(result);console.log(JSON.stringify({profile,journey,status:result.status,failure:result.failure,FPS:null}));if(result.unsafeOutstanding)throw Error('functional-original-ownership-unsettled');
 }
 await write(out,'summary.json',{schema:'four-stack-functional-invocation-v2',mode:'headless',historyCount:100,responseBytes:6400,results:results.map(({profile,journey,status,failure})=>({profile,journey,status,failure})),performance:false,FPS:null});
 if(results.some(x=>x.status!=='functional-pass'))process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(error=>{console.error(message(error));process.exitCode=1;});
