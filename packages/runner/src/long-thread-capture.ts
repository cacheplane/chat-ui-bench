import type {ComparisonSlotDriver,ComparisonSlotContext} from './long-thread-run.js';
import {validateLongThreadConfiguration,type LongThreadConfiguration} from './long-thread-cli.js';
import {canonicalSerialize,COMPARISON_CAPTURE_LIMITS,comparisonScheduledRunSchema,preNavigationOptionsSchema,mainOptionsSchema,type ComparisonAdapter} from '@chat-ui-bench/contract';
import {createComparisonProvenanceSession,type ComparisonProvenanceSession,type ComparisonAcquiredInstrumentation,type ComparisonServingFacts} from './comparison-provenance.js';
import {resolveComparisonThreadplaneProfile} from './comparison-threadplane.js';
import {chromium,type Browser,type BrowserContext,type Page,type CDPSession,type Route} from 'playwright';
import {collectComparisonEnvironment,type ComparisonEnvironmentCapture} from './environment.js';
import {recheckComparisonThreadplaneProfile} from './comparison-threadplane.js';
import {serveAssets} from './server.js';
import {createLongThreadReplayServer,type LongThreadReplayServer} from '@chat-ui-bench/producer';
import {join} from 'node:path';
import type {ComparisonPageState,PreNavigationState} from './comparison-observations.js';
import type {LongThreadCaptureHost} from '@chat-ui-bench/contract';
import {createComparisonCaptureJournal,type ComparisonCaptureJournal} from './comparison-capture-journal.js';
import {createComparisonCounterCapture,type ComparisonCounterCapture} from './comparison-counters.js';
import {comparisonInstrumentationSchema,comparisonManifestSchema,comparisonCaptureMetadataSchema,comparisonFinalRuntimeSchema,comparisonVisibleValidationSchema,type ComparisonInstrumentation,type ComparisonCaptureMetadata,type ComparisonPhase} from '@chat-ui-bench/contract';
import {createHash} from 'node:crypto';
import {createComparisonTraceCapture,type ComparisonTraceCapture} from './comparison-trace.js';
import {createComparisonNativeInput,type ComparisonNativeInput} from './comparison-native-input.js';
import {comparisonInputRecipeSchema,comparisonCheckpointsSchema,comparisonHostFrameGuardSchema,comparisonPhasesSchema,comparisonNativeDispatchResultsSchema,comparisonTraceAuxiliarySchema,comparisonValidationSchema,comparisonCaptureStatusSchema,runtimeProgressSchema,validateRuntimeTranscript,type ComparisonInputRecipe,type ComparisonHostFrameGuard,type ComparisonCheckpoints} from '@chat-ui-bench/contract';
import type {ComparisonOwnershipClock} from './comparison-ownership.js';
import type {ComparisonJournalTerminalSnapshot} from './comparison-capture-journal.js';
import type {ComparisonSlotCapture,ComparisonSlotFinalization} from './long-thread-run.js';
import type {ComparisonPayloadFile} from './comparison-artifacts.js';
import {requireHistoryWindowExperiment,type HistoryWindowExperiment} from './history-window-experiment.js';
export interface LongThreadCaptureOptions {originalRoot:string;configuration:LongThreadConfiguration;historyExperiment?:HistoryWindowExperiment}
export interface AcquiredSlot {readonly identity:ComparisonSlotContext['identity']}
export interface LongThreadCaptureDependencies {createProvenanceSession?:typeof createComparisonProvenanceSession;acquireInstrumentation?:(session:ComparisonProvenanceSession,pre:string,main:string,diagnosticMode?:'none'|'history-window-diagnostic-v1')=>Promise<ComparisonAcquiredInstrumentation>;resolveProfile?:typeof resolveComparisonThreadplaneProfile;recheckProfile?:typeof recheckComparisonThreadplaneProfile;recheckServing?:(session:ComparisonProvenanceSession)=>Promise<ComparisonServingFacts>;collectEnvironment?:typeof collectComparisonEnvironment;launch?:typeof chromium.launch;serveAssets?:typeof serveAssets;createReplayServer?:typeof createLongThreadReplayServer;createTrace?:typeof createComparisonTraceCapture;clock?:ComparisonOwnershipClock}
type CaptureWindow=Window&{comparisonCapture?:ComparisonPageState;comparisonPreNavigation?:PreNavigationState;benchHost?:LongThreadCaptureHost;benchSetupError?:unknown};
interface SlotEntry {state:AcquiredSlot;experimentManifest?:ReturnType<ComparisonRuntimeSchemas['comparisonManifestSchema']['parse']>;session?:ComparisonProvenanceSession;pair?:ComparisonAcquiredInstrumentation;profile?:ComparisonAdapter;browser?:Browser;browserContext?:BrowserContext;page?:Page;environmentSession?:CDPSession;environment?:ComparisonEnvironmentCapture;assets?:Awaited<ReturnType<typeof serveAssets>>;producer?:LongThreadReplayServer;pending:Set<Promise<unknown>>;timers:Map<ReturnType<typeof setTimeout>,()=>void>;closures:Map<string,()=>Promise<void>>;closed:boolean;hostInstalled:boolean;captureInstalled:boolean;stop?:Promise<void>;hostDispose?:Promise<void>;pageStopClose?:Promise<void>;currentContext?:ComparisonSlotContext;reasons:string[];routePending:Set<Promise<void>>;journal?:ComparisonCaptureJournal;counter?:ComparisonCounterCapture;counterSession?:CDPSession;instrumentation?:ComparisonInstrumentation;finalInstrumentation?:ComparisonInstrumentation;metadata?:ReturnType<ComparisonRuntimeSchemas['comparisonCaptureMetadataSchema']['parse']>;trace?:ComparisonTraceCapture;native?:ComparisonNativeInput;recipe?:ComparisonInputRecipe;guards:ComparisonHostFrameGuard[];scroll:ComparisonCheckpoints['scroll'];terminal?:ComparisonJournalTerminalSnapshot;payloads:Set<string>}
/** This complete callback is serialized by Playwright; it has no host closure. */
function collectFullPage(args:{responseId:string|null;candidateLimit:number}){
 const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Actual host unavailable for full validation');
 const timestampMs=performance.now(),snapshot=host.readTranscript(),scroller=document.querySelector(host.locators.scroller),contentSelector='.chat-message__bubble, .chat-message__assistant-body > chat-streaming-md';
 const hosts=Array.from(document.querySelectorAll<HTMLElement>('chat chat-message-list > chat-message'));
 const contentFacts:{element:Element;content:Element;id:string;role:string;text:string}[]=[],messages:{id:string;text:string}[]=[],rows:{id:string;role:string;visible:boolean;known:boolean}[]=[];
 let unavailable:string|null=null,contradiction:string|null=null;
 function intersectsContent(element:Element):{visible:boolean;known:boolean}{
   if(!scroller||!element.isConnected||!scroller.isConnected||!scroller.contains(element)||!(scroller instanceof HTMLElement))return {visible:false,known:false};
   const scrollerBox=scroller.getBoundingClientRect(),clip={left:Math.max(0,scrollerBox.left+scroller.clientLeft),top:Math.max(0,scrollerBox.top+scroller.clientTop),right:Math.min(innerWidth,scrollerBox.left+scroller.clientLeft+scroller.clientWidth),bottom:Math.min(innerHeight,scrollerBox.top+scroller.clientTop+scroller.clientHeight)};
   const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node:Node|null;let visible=false;
   while((node=walker.nextNode())){
     if(!node.textContent?.length)continue;const range=document.createRange();range.selectNodeContents(node);
     let nodeClip={...clip},hidden=false;
     for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement){
       const style=getComputedStyle(ancestor);
       if(style.transform!=='none'||style.perspective!=='none'||style.clipPath!=='none'||style.filter!=='none'||style.contain.includes('paint'))return {visible:false,known:false};
       if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')hidden=true;
       if(!(ancestor instanceof HTMLElement))return {visible:false,known:false};
       const box=ancestor.getBoundingClientRect(),left=box.left+ancestor.clientLeft,top=box.top+ancestor.clientTop;
       if(/^(hidden|clip|auto|scroll)$/.test(style.overflowX)){nodeClip.left=Math.max(nodeClip.left,left);nodeClip.right=Math.min(nodeClip.right,left+ancestor.clientWidth);}
       if(/^(hidden|clip|auto|scroll)$/.test(style.overflowY)){nodeClip.top=Math.max(nodeClip.top,top);nodeClip.bottom=Math.min(nodeClip.bottom,top+ancestor.clientHeight);}
     }
     if(!hidden)for(const rect of range.getClientRects())if([rect.left,rect.top,rect.right,rect.bottom].every(Number.isFinite)&&Math.min(rect.right,nodeClip.right)>Math.max(rect.left,nodeClip.left)&&Math.min(rect.bottom,nodeClip.bottom)>Math.max(rect.top,nodeClip.top))visible=true;
     range.detach();
   }
   return {visible,known:true};
 }
 for(const element of hosts){
   const id=element.getAttribute('data-bench-message-id'),role=element.getAttribute('data-role'),content=element.querySelector(contentSelector);
   if(!id||!['user','assistant'].includes(role??'')||!content||!element.isConnected||!content.isConnected){unavailable='Mounted content identity/geometry unavailable';continue;}
   const text=content.textContent;if(text===null){unavailable='Actual mounted prose unavailable';continue;}
   contentFacts.push({element,content,id,role:role!,text});messages.push({id,text});const geometry=intersectsContent(content);rows.push({id,role:role!,...geometry});if(!geometry.known)unavailable='Unsupported actual content geometry';
 }
 const candidates=host.readCaptureCandidates?.(args.candidateLimit);
 if(!candidates||candidates.status!=='available')unavailable=candidates?.status==='unavailable'?candidates.reason:'Actual public candidate selection unavailable';
 else{
   const selected=[...candidates.value.historical,...(candidates.value.active?[candidates.value.active]:[])];
   if(selected.length>args.candidateLimit+1||new Set(selected.map(value=>value.id)).size!==selected.length)contradiction='Public candidate selection identity/capacity contradiction';
   for(const row of rows)if(row.known&&row.visible&&!selected.some(candidate=>candidate.id===row.id&&candidate.role===row.role))contradiction='Visible prose omitted from actual bounded candidate selection';
   for(const candidate of selected){const retained=contentFacts.find(fact=>fact.element===candidate.hostElement&&fact.id===candidate.id&&fact.role===candidate.role);if(!retained||retained.content!==candidate.contentElement||!candidate.hostElement.isConnected||candidate.hostElement.getAttribute('data-bench-message-id')!==candidate.id||candidate.hostElement.getAttribute('data-role')!==candidate.role||!candidate.contentElement?.isConnected||!candidate.hostElement.contains(candidate.contentElement))unavailable='Candidate identity mutated or content disconnected';}
 }
 if(contentFacts.some(fact=>!fact.element.isConnected||!fact.content.isConnected||!fact.element.contains(fact.content)||fact.element.querySelector(contentSelector)!==fact.content||fact.element.getAttribute('data-bench-message-id')!==fact.id||fact.element.getAttribute('data-role')!==fact.role||fact.content.textContent!==fact.text))unavailable='Mounted content changed during synchronous validation';
 if(hosts.length!==document.querySelectorAll('chat chat-message-list > chat-message').length||rows.some((row,index)=>hosts[index]?.getAttribute('data-bench-message-id')!==row.id))unavailable='Mounted identity changed during synchronous validation';
 if(hosts.length!==snapshot.transcript.length||messages.length===hosts.length&&snapshot.transcript.some((message,index)=>messages[index]?.id!==message.id||messages[index]?.text!==message.text||rows[index]?.role!==message.role))contradiction='Actual mounted content/runtime identity or prose differs';
 const response=args.responseId===null?undefined:messages.find(message=>message.id===args.responseId);
 return {timestampMs,clockDomain:'page-performance-ms' as const,snapshot,coverage:{mode:'all-mounted' as const,messages,activeResponse:response??{status:'unavailable' as const,reason:'Actual response content not mounted'}},geometry:{available:unavailable===null,contradiction,reason:unavailable}};
}
export function createLongThreadCaptureDriver(_options:LongThreadCaptureOptions,_dependencies?:LongThreadCaptureDependencies):ComparisonSlotDriver<AcquiredSlot>{
 const experiment=_options.historyExperiment===undefined?null:requireHistoryWindowExperiment(_options.historyExperiment);
 const configuration=validateLongThreadConfiguration(_options.configuration),dependencies=_dependencies??{};
 if(typeof _options.originalRoot!=='string'||!_options.originalRoot||_options.originalRoot.includes('\0'))throw new Error('Invalid original root');
 let entry:SlotEntry|undefined;
 const clock=dependencies.clock??{now:()=>performance.now()};
 function admission(context:ComparisonSlotContext,state:SlotEntry){context.ownership.assertActive();if(state.closed)throw new Error('Capture operation controller closed');if(state.currentContext!==context)throw new Error('Capture authority differs from original current context');}
 function track<T>(state:SlotEntry,task:Promise<T>):Promise<T>{state.pending.add(task);void task.then(()=>state.pending.delete(task),()=>state.pending.delete(task));return task;}
 async function operation<T>(context:ComparisonSlotContext,state:SlotEntry,call:()=>Promise<T>):Promise<T>{context.ownership.assertActive();if(state.closed)throw new Error('Capture operation controller closed');let promise:Promise<T>;try{promise=call();}catch(error){promise=Promise.reject(error);}const value=await track(state,promise);context.ownership.assertActive();if(state.closed)throw new Error('Capture operation controller closed');return value;}
 async function resource<T>(context:ComparisonSlotContext,state:SlotEntry,name:string,create:()=>Promise<T>,dispose:(value:T)=>Promise<void>):Promise<T>{
   context.ownership.assertActive();if(state.closed)throw new Error('Capture resource controller closed');let factory:Promise<T>;try{factory=create();}catch(error){factory=Promise.reject(error);}
   const acquired=factory.then(async value=>{let first:Promise<void>|undefined,owned:T|undefined=value;const close=()=>{if(first)return first;try{first=dispose(owned!).finally(()=>{owned=undefined;});}catch(error){owned=undefined;first=Promise.reject(error);}void first.catch(()=>{});return first;};state.closures.set(name,close);const adoption=context.ownership.adopt({name,close});void adoption.catch(()=>{});if(state.closed){const closing=close();void closing.catch(()=>{});}await adoption;return value;});
   void acquired.catch(()=>{});const value=await track(state,acquired);context.ownership.assertActive();if(state.closed)throw new Error('Capture resource controller closed');return value;
 }
 function stopPage(state:SlotEntry):Promise<void>{
   if(state.pageStopClose)return state.pageStopClose;
   if(state.captureInstalled&&state.page&&!state.stop){state.stop=state.page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Installed page capture disappeared during cleanup');capture.stop();});void state.stop.catch(()=>{});}
   if(state.hostInstalled&&state.page&&!state.hostDispose){state.hostDispose=state.page.evaluate(async()=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Installed host disappeared during cleanup');await host.dispose();});void state.hostDispose.catch(()=>{});}
   state.pageStopClose=(async()=>{const results=await Promise.allSettled([state.stop,state.hostDispose]);for(const result of results)if(result.status==='rejected')throw result.reason;})();void state.pageStopClose.catch(()=>{});return state.pageStopClose;
 }
 function reason(state:SlotEntry,error:unknown){if(state.reasons.length<32)state.reasons.push((error instanceof Error?error.message:String(error)).slice(0,4096)||'Empty operation rejection');}
 function closeIndependent(state:SlotEntry){for(const close of state.closures.values()){let task:Promise<void>;try{task=close();}catch(error){task=Promise.reject(error);}void task.catch(error=>reason(state,error));}}
 const nativeGuards=new WeakMap<SlotEntry,{escape:Promise<void>;release:()=>void}>();
 const traceNativeClosers=new WeakMap<SlotEntry,()=>Promise<void>>();
 function nativeParents(state:SlotEntry,children:readonly(()=>Promise<void>)[],close:()=>Promise<void>):Promise<void>{
   if(!children.length)return close();
   let guard=nativeGuards.get(state);
   if(!guard){let release!:()=>void;const escape=new Promise<void>(resolve=>{release=resolve;});const timer=(clock.setTimer??setTimeout)(release,1000);guard={escape,release:()=>{(clock.clearTimer??clearTimeout)(timer);release();}};nativeGuards.set(state,guard);}
   const pending=children.map(child=>{try{return child();}catch(error){return Promise.reject(error);}});
   // Only native child settlement orders parents. Owned child failures remain original failures.
   return Promise.race([Promise.allSettled(pending),guard.escape]).then(close);
 }
 function acquiredClosers(state:SlotEntry,names:readonly string[]):(()=>Promise<void>)[]{return names.flatMap(name=>{const close=state.closures.get(name);return close?[close]:[];});}
 async function installRoutes(context:ComparisonSlotContext,state:SlotEntry){
   const browserContext=state.browserContext!,assetOrigin=new URL(state.assets!.url).origin,replayUrl=state.producer!.url;
   let registration:Awaited<ReturnType<BrowserContext['route']>>|undefined,registerPromise:Promise<Awaited<ReturnType<BrowserContext['route']>>>|undefined,closed=false,removal:Promise<void>|undefined,dispose:Promise<void>|undefined,closing:Promise<void>|undefined,rejectedAbort:Promise<void>|undefined,failed=false,firstError:unknown;
   function disposeRegistration(){if(dispose)return dispose;if(!registration)return Promise.resolve();try{dispose=registration.dispose();}catch(error){dispose=Promise.reject(error);}void dispose.catch(()=>{});return dispose;}
   function close(){if(closing)return closing;closed=true;
     closing=(async()=>{const terminal=rejectedAbort?await Promise.allSettled([rejectedAbort]):[];try{removal=browserContext.unrouteAll({behavior:'wait'});}catch(error){removal=Promise.reject(error);}void removal.catch(()=>{});
       const results=await Promise.allSettled([removal,registerPromise]);const lateDisposal=await Promise.allSettled([disposeRegistration()]);await Promise.allSettled([...state.routePending]);for(const result of [...terminal,...results,...lateDisposal])if(result.status==='rejected')throw result.reason;if(failed)throw firstError;})();void closing.catch(()=>{});return closing;
   }
   function fail(error:unknown){if(!failed){failed=true;firstError=error;}reason(state,error);const removing=close();void removing.catch(()=>{});closeIndependent(state);}
   await context.ownership.adopt({name:'route-registration-and-handlers',close});state.closures.set('route-registration-and-handlers',close);
   const handler=async(route:Route)=>{const authority=state.currentContext;let attempted=false,continued=false;
     try{if(closed||!authority)throw new Error('Route admission during ownership handoff gap');authority.ownership.assertActive();if(state.routePending.size>=64)throw new Error('Route pending operation capacity exceeded');const url=new URL(route.request().url());if(url.origin!==assetOrigin&&url.href!==replayUrl)throw new Error('Unexpected request origin or replay URL');
       let actual:Promise<void>;attempted=true;try{actual=route.continue();}catch(error){actual=Promise.reject(error);}const observed=actual.then(()=>{continued=true;authority.ownership.assertActive();if(state.currentContext!==authority)throw new Error('Route authority changed after request settlement');});state.routePending.add(observed);void observed.then(()=>state.routePending.delete(observed),()=>state.routePending.delete(observed));await observed;
     }catch(error){
       if(!attempted&&!failed){try{rejectedAbort=route.abort();}catch(abortError){rejectedAbort=Promise.reject(abortError);}void rejectedAbort.catch(()=>{});fail(error);try{await rejectedAbort;}catch(abortError){reason(state,abortError);throw abortError;}}
       else{fail(error);if(!continued)throw error;}
     }
   };
   context.ownership.assertActive();registerPromise=browserContext.route('**/*',handler).then(async value=>{registration=value;return value;});void registerPromise.catch(fail);await track(state,registerPromise);context.ownership.assertActive();
 }
 function waitUntil(context:ComparisonSlotContext,state:SlotEntry,target:number):Promise<void>{
   context.ownership.assertActive();if(state.closed)throw new Error('Capture timer controller closed');let timer:ReturnType<typeof setTimeout>|undefined;
   let reject!: (error:unknown)=>void;
   const promise=new Promise<void>((resolve,fail)=>{reject=fail;timer=(clock.setTimer??setTimeout)(()=>{if(timer!==undefined)state.timers.delete(timer);try{context.ownership.assertActive();resolve();}catch(error){fail(error);}},Math.max(0,target-clock.now()));});
   const abort=()=>{if(timer!==undefined){state.timers.delete(timer);(clock.clearTimer??clearTimeout)(timer);}reject(new Error('Capture timer ownership revoked'));};if(timer!==undefined)state.timers.set(timer,abort);context.ownership.signal.addEventListener('abort',abort,{once:true});
   void promise.then(()=>context.ownership.signal.removeEventListener('abort',abort),()=>context.ownership.signal.removeEventListener('abort',abort));return track(state,promise);
 }
 async function phase(context:ComparisonSlotContext,state:SlotEntry,value:ComparisonPhase){await operation(context,state,()=>state.page!.evaluate(value=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.setPhase(value);},value));}
 async function scroll(context:ComparisonSlotContext,state:SlotEntry,notBeforePageMs:number|null=null,anchorWindow?:Parameters<ComparisonPageState['readScrollFresh']>[0]['anchorWindow'],diagnosticRole?:'before'|'post'|'later'){const result=await operation(context,state,()=>state.page!.evaluate(request=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');if(!request.fresh)return capture.readScroll();const input={notBeforePageMs:request.notBeforePageMs,...(request.anchorWindow===undefined?{}:{anchorWindow:request.anchorWindow})};return request.diagnosticRole===undefined?capture.readScrollFresh(input):capture.readScrollFresh(input,request.diagnosticRole);},{fresh:context.comparisonVersion==='2.1.0',notBeforePageMs,...(anchorWindow===undefined?{}:{anchorWindow}),...(diagnosticRole===undefined?{}:{diagnosticRole})}));
   if(result.status==='unavailable'){reason(state,result.reason);return undefined;}
   const parsed=comparisonContextFamily(context).comparisonCheckpointsSchema.shape.scroll.element.parse({...result.value,pinThresholdCssPx:state.profile!.configuration.pinThresholdCssPx,followArmed:null});
   if(state.scroll.length>=12)throw new Error('Fixed checkpoint capacity exceeded');state.scroll.push(parsed);if(parsed.geometry.status==='unavailable'||parsed.anchorGeometry.status==='unavailable'&&context.fixture.workload.journey==='history-reading')reason(state,'Scored scroll geometry unavailable');return parsed;
 }
 async function acquireTrace(context:ComparisonSlotContext,state:SlotEntry){
   let session:CDPSession|undefined,creation:Promise<CDPSession>|undefined,closed=false,transferred=false,detach:Promise<void>|undefined;
   const nativeDetach=()=>{if(detach)return detach;if(!session)return Promise.resolve();try{detach=session.detach();}catch(error){detach=Promise.reject(error);}void detach.catch(()=>{});return detach;};
   const firstDetach=()=>transferred?Promise.resolve():nativeDetach();
   let closing:Promise<void>|undefined;const close=()=>{if(closing)return closing;closed=true;const initial=firstDetach();closing=(async()=>{const results=await Promise.allSettled([initial,creation]);await firstDetach();for(const result of results)if(result.status==='rejected')throw result.reason;})();void closing.catch(()=>{});return closing;};state.closures.set('trace-session-before-transfer',close);await context.ownership.adopt({name:'trace-session-before-transfer',close});
   admission(context,state);try{creation=state.browserContext!.newCDPSession(state.page!);}catch(error){creation=Promise.reject(error);}
   const observed=creation.then(async value=>{session=value;if(closed||state.closed){await firstDetach();throw new Error('Late trace session detached before transfer');}return value;});void observed.catch(()=>{});
   const actual=await track(state,observed);try{admission(context,state);
     const forwarded=new Proxy(actual,{get(target,key){if(key==='detach')return nativeDetach;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
     state.trace=(dependencies.createTrace??createComparisonTraceCapture)({context,session:forwarded,isolatedBrowserProcess:true,singleWorkloadPage:true,now:clock.now});transferred=true;
     traceNativeClosers.set(state,()=>{const closing=state.trace!.close();void closing.catch(()=>{});return nativeDetach();});
     state.closures.set('transferred-trace',()=>state.trace!.close());if(state.closed){void state.trace.close().catch(()=>{});admission(context,state);}}catch(error){const closing=firstDetach();void closing.catch(()=>{});throw error;}
 }
 return {async setup(context){
   experiment?.validateSlot(context);
   context.ownership.assertActive();if(entry)throw new Error('An earlier slot is still retained');
   const descriptor=comparisonContextFamily(context).comparisonScheduledRunSchema.parse(context.descriptor);
   if((['schemaVersion','suite','suiteVersion','collectorVersion','analyzerVersion','repetition','scenarioId','round','caseIndex','adapterProfile'] as const).some(field=>context.identity[field]!==descriptor[field]))throw new Error('Slot identity differs from its actual descriptor');
   if(descriptor.mode!==configuration.configuration.mode||descriptor.seed!==configuration.configuration.seed||descriptor.adapterProfile!==configuration.configuration.adapterProfiles[0]||configuration.configuration.caseOrder[descriptor.caseIndex]!==descriptor.scenarioId)throw new Error('Slot configuration differs');
   const state:AcquiredSlot={identity:structuredClone(context.identity)};entry={state,pending:new Set(),timers:new Map(),closures:new Map(),closed:false,hostInstalled:false,captureInstalled:false,currentContext:context,reasons:[],routePending:new Set(),guards:[],scroll:[],payloads:new Set()};const current=entry;
   let underlyingClose:Promise<void>|undefined;
   const closeUnderlying=()=>{if(underlyingClose)return underlyingClose;current.closed=true;for(const cancel of [...current.timers.values()])cancel();underlyingClose=(async()=>{while(current.pending.size)await Promise.allSettled([...current.pending]);})();void underlyingClose.catch(()=>{});return underlyingClose;};
   await context.ownership.adopt({name:'capture-underlying-settlement',close:closeUnderlying});current.closures.set('capture-underlying-settlement',closeUnderlying);
   await context.writer.text('page-exceptions.jsonl','');current.payloads.add('page-exceptions.jsonl');context.ownership.assertActive();
   const identity={repetition:descriptor.repetition,round:descriptor.round,artifactDirectory:descriptor.artifactDirectory,scenarioId:descriptor.scenarioId,caseIndex:descriptor.caseIndex,adapterProfile:descriptor.adapterProfile,seed:descriptor.seed,mode:descriptor.mode};
   const pre=canonicalSerialize(comparisonContextFamily(context).preNavigationOptionsSchema.parse({optionsVersion:1,identity,limits:COMPARISON_CAPTURE_LIMITS,stateGlobal:'comparisonPreNavigation'}));
   const main=canonicalSerialize(comparisonContextFamily(context).mainOptionsSchema.parse({optionsVersion:1,identity,limits:COMPARISON_CAPTURE_LIMITS,probeIntervalMs:50,bridgeGlobal:'benchHost',stateGlobal:'comparisonCapture',preNavigationGlobal:'comparisonPreNavigation',observers:{eventTiming:{buffered:true,durationThresholdMs:16},loaf:{buffered:true}},nativeRecipeIds:{wheel:'comparison-wheel-up-v1',composer:'comparison-composer-calibrate-v1'},...(context.comparisonVersion==='2.1.0'?{scoredScrollSampling:{mode:'fresh-page-acquisition',minimumPostToLaterPageMs:800,maxWaitCallbacks:64}}:{})}));
   entry.session=(dependencies.createProvenanceSession??createComparisonProvenanceSession)(context,_options.originalRoot);
   entry.pair=await operation(context,current,()=>experiment?(dependencies.acquireInstrumentation??((session,pre,main,mode)=>session.acquire(pre,main,mode)))(current.session!,pre,main,'history-window-diagnostic-v1'):(dependencies.acquireInstrumentation??((session,pre,main)=>session.acquire(pre,main)))(current.session!,pre,main));
   current.profile=await operation(context,current,()=> (dependencies.resolveProfile??resolveComparisonThreadplaneProfile)(current.session!));
   current.browser=await resource(context,current,'browser',()=> (dependencies.launch??chromium.launch.bind(chromium))({headless:descriptor.mode==='headless',args:['--enable-automation']}),browser=>nativeParents(current,acquiredClosers(current,['browser-context','environment-CDP']),()=>browser.close()).finally(()=>nativeGuards.get(current)?.release()));
   current.browserContext=await resource(context,current,'browser-context',()=>current.browser!.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),browserContext=>nativeParents(current,acquiredClosers(current,['workload-page']),()=>browserContext.close()));
   await context.ownership.adopt({name:'page-stop-host-dispose',close:()=>stopPage(current)});
   current.closures.set('page-stop-host-dispose',()=>stopPage(current));
   current.page=await resource(context,current,'workload-page',()=>current.browserContext!.newPage(),page=>{const children=acquiredClosers(current,['counter-CDP']),trace=traceNativeClosers.get(current);if(trace)children.push(trace);return nativeParents(current,children,()=>page.close());});
   current.environmentSession=await resource(context,current,'environment-CDP',()=>current.browser!.newBrowserCDPSession(),session=>session.detach());
   current.environment=await operation(context,current,()=> (dependencies.collectEnvironment??collectComparisonEnvironment)(current.session!,current.environmentSession!,configuration.purpose));
   const serving=await operation(context,current,()=> (dependencies.recheckServing??(session=>session.recheckBeforeServing()))(current.session!));
   const servingProfile=await operation(context,current,()=> (dependencies.recheckProfile??recheckComparisonThreadplaneProfile)(current.session!));
   const environment=await operation(context,current,()=>current.environment!.recheckBeforeServing());
   if(canonicalSerialize(serving.build)!==canonicalSerialize(current.profile.build)||canonicalSerialize(servingProfile)!==canonicalSerialize(current.profile)||canonicalSerialize(environment.assets)!==canonicalSerialize(serving.assets)||canonicalSerialize(environment.assets)!==canonicalSerialize(current.profile.build.assetHashes))throw new Error('Serving provenance/profile/environment agreement differs');
   current.assets=await resource(context,current,'asset-server',()=> (dependencies.serveAssets??serveAssets)(join(_options.originalRoot,'apps/threadplane/dist')),assets=>assets.close());
   current.producer=await resource(context,current,'producer-server',()=> (dependencies.createReplayServer??createLongThreadReplayServer)({fixture:context.fixture,repetition:context.identity.repetition}),producer=>producer.close());
   await installRoutes(context,current);
   await operation(context,current,()=>current.page!.addInitScript(current.pair!.preNavigation));
   await operation(context,current,()=>current.page!.goto(current.assets!.url,{timeout:context.ownership.remainingMs()}));
   await operation(context,current,()=>current.page!.waitForFunction(()=>Boolean((window as CaptureWindow).benchHost)||(window as CaptureWindow).benchSetupError!==undefined,undefined,{timeout:context.ownership.remainingMs()}));
   await operation(context,current,()=>current.page!.evaluate(()=>{const page=window as CaptureWindow;if(page.benchSetupError!==undefined)throw new Error('Actual Threadplane host setup failed');if(!page.benchHost)throw new Error('Actual Threadplane host is absent');}));current.hostInstalled=true;
   await operation(context,current,()=>current.page!.evaluate(current.pair!.main));current.captureInstalled=true;
   current.instrumentation=comparisonContextFamily(context).comparisonInstrumentationSchema.parse(await operation(context,current,()=>current.page!.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readInstrumentation();})));
   current.counterSession=await resource(context,current,'counter-CDP',()=>current.browserContext!.newCDPSession(current.page!),session=>session.detach());
   admission(context,current);const counterCall=<T>(call:()=>Promise<T>)=>{const authority=current.currentContext;if(!authority)throw new Error('Counter authority unavailable during handoff');admission(authority,current);return operation(authority,current,call);};
   current.counter=createComparisonCounterCapture({now:clock.now,pageNow:()=>counterCall(()=>current.page!.evaluate(()=>performance.now())),commands:{getHeapUsage:()=>counterCall(()=>current.counterSession!.send('Runtime.getHeapUsage')),getDOMCounters:()=>counterCall(()=>current.counterSession!.send('Memory.getDOMCounters'))}});
   admission(context,current);await current.counter.capture(context.ownership,'baseline');admission(context,current);
   admission(context,current);current.journal=createComparisonCaptureJournal({identity:context.identity,clock});current.closures.set('capture-journal',()=>current.journal!.close());await current.journal.startStage({context,producer:current.producer!,page:{
     drain:max=>current.page!.evaluate(max=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.drain(max);},max),
     readPreNavigationTransfer:()=>current.page!.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readPreNavigationTransfer();}),
     transferPreNavigation:max=>current.page!.evaluate(max=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.transferPreNavigation(max);},max),
     drainPreNavigation:max=>current.page!.evaluate(max=>{const pre=(window as CaptureWindow).comparisonPreNavigation;if(!pre)throw new Error('Pre-navigation source absent');return pre.drain(max);},max),
   }});
   await operation(context,current,()=>current.page!.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.setPhase('setup');}));
   await operation(context,current,()=>current.page!.evaluate(async history=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Host absent');await host.loadHistory(history);},context.fixture.history));
   const full=await operation(context,current,()=>current.page!.evaluate(collectFullPage,{responseId:null,candidateLimit:COMPARISON_CAPTURE_LIMITS.maxHistoricalCandidates}));
   const initial=comparisonContextFamily(context).comparisonFinalRuntimeSchema.parse({...context.identity,timestampMs:full.timestampMs,clockDomain:full.clockDomain,snapshot:full.snapshot});
   comparisonContextFamily(context).comparisonVisibleValidationSchema.parse({...context.identity,timestampMs:full.timestampMs,clockDomain:full.clockDomain,coverage:full.coverage});
   if(initial.snapshot.transcript.length!==context.fixture.history.length||initial.snapshot.transcript.some((message,index)=>{const expected=context.fixture.history[index];return !expected||message.id!==expected.id||message.role!==expected.role||message.text!==expected.text;}))throw new Error('Actual runtime history differs');
   if(full.coverage.messages.length!==context.fixture.history.length||full.coverage.messages.some((message,index)=>message.id!==context.fixture.history[index]?.id||message.text!==context.fixture.history[index]?.text))throw new Error('Actual mounted setup history differs or is unavailable');
   admission(context,current);await current.counter.capture(context.ownership,'history-ready');admission(context,current);
   await operation(context,current,()=>current.page!.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.setPhase('history-ready');}));
   const {adapterProfile:_adapterProfile,...manifestIdentity}=context.identity;
   const originalManifest=comparisonContextFamily(context).comparisonManifestSchema.parse({...manifestIdentity,git:environment.git,fixture:{sha256:createHash('sha256').update(canonicalSerialize(context.fixture)).digest('hex'),file:'fixture.json'},browser:environment.browser,environment:environment.environment,mode:descriptor.mode,viewport:{width:1280,height:800,deviceScaleFactor:1},cachePolicy:'fresh-profile-empty-cache-assets-preloaded',fonts:'local-system',caseOrder:configuration.configuration.caseOrder,workload:context.fixture.workload,adapter:servingProfile});
   await operation(context,current,()=>context.writer.json('manifest.json',originalManifest));if(experiment)current.experimentManifest=originalManifest;
   current.metadata=comparisonContextFamily(context).comparisonCaptureMetadataSchema.parse({...context.identity,browserProtocol:environment.browserProtocol,chromiumDownloadRevision:environment.chromiumDownloadRevision,playwrightVersion:environment.playwrightVersion,instrumentation:{sourceHashes:serving.probe.sourceHashes,installerSha256:current.pair!.installerSha256,probeIntervalMs:50,limits:COMPARISON_CAPTURE_LIMITS}});
   await operation(context,current,()=>context.writer.json('capture-metadata.json',current.metadata));
   current.payloads.add('manifest.json');current.payloads.add('capture-metadata.json');
   await current.journal.pauseStage();await Promise.allSettled([...current.routePending]);context.ownership.assertActive();if(current.reasons.length||current.journal.snapshot().reasons.length)throw new Error([...current.reasons,...current.journal.snapshot().reasons].join('; '));delete current.currentContext;
   return state;
 },async replay(context,state):Promise<ComparisonSlotCapture>{
   const current=entry;if(!current||current.state!==state||canonicalSerialize(state.identity)!==canonicalSerialize(context.identity)||!current.journal||!current.page||!current.producer||!current.profile)throw new Error('Replay requires its actual acquired slot');
   context.ownership.assertActive();current.currentContext=context;
   const page=current.page;await current.journal.startStage({context,producer:current.producer,page:{
     drain:max=>page.evaluate(max=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.drain(max);},max),
     readPreNavigationTransfer:()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readPreNavigationTransfer();}),
     transferPreNavigation:max=>page.evaluate(max=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.transferPreNavigation(max);},max),
     drainPreNavigation:max=>page.evaluate(max=>{const pre=(window as CaptureWindow).comparisonPreNavigation;if(!pre)throw new Error('Pre-navigation source absent');return pre.drain(max);},max),
   }});
   await acquireTrace(context,current);await current.trace!.start();
   const locators=await operation(context,current,()=>page.evaluate(()=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Host absent');return {scroller:host.locators.scroller,composer:host.locators.composer,returnToResponse:host.locators.returnToResponse};}));
   if(typeof locators.scroller!=='string'||!locators.scroller||typeof locators.composer!=='string'||!locators.composer||locators.returnToResponse!==null&&typeof locators.returnToResponse!=='string')throw new Error('Actual native locators unavailable');
   current.recipe=comparisonInputRecipeSchema.parse({wheel:{recipeId:'comparison-wheel-up-v1',deltasCssPx:[-100,-100,-100,-100],cadenceMs:50},composer:{recipeId:'comparison-composer-calibrate-v1',text:'calibrate',cadenceMs:35,submit:false}});
   admission(context,current);const scroller=page.locator(locators.scroller),composer=page.locator(locators.composer),returnControl=locators.returnToResponse===null?null:page.locator(locators.returnToResponse);
   current.native=createComparisonNativeInput({identity:context.identity,comparisonVersion:context.comparisonVersion??'2.0.0',comparisonSchemas:comparisonContextFamily(context),recipe:current.recipe,ownership:context.ownership,clock,controls:{mouse:{move:(x,y)=>operation(context,current,()=>page.mouse.move(x,y)),wheel:(x,y)=>operation(context,current,()=>page.mouse.wheel(x,y))},keyboard:{press:key=>operation(context,current,()=>page.keyboard.press(key)),up:key=>page.keyboard.up(key)},scroller:{boundingBox:options=>operation(context,current,()=>scroller.boundingBox(options))},composer:{click:options=>operation(context,current,()=>composer.click(options))},returnControl:returnControl===null?null:{isVisible:options=>operation(context,current,()=>returnControl.isVisible(options)),click:options=>operation(context,current,()=>returnControl.click(options))}}});current.closures.set('native-input',()=>current.native!.close());
   await phase(context,current,'streaming-follow');
   await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.armHostGuard();}));
   const producerTerminal=(async()=>{for(;;){context.ownership.assertActive();const state=current.producer!.state;if(state==='complete')return;if(state==='failed')throw new Error('Actual producer failed');if(state==='disposed')throw new Error('Producer disposed before captured terminal state');await waitUntil(context,current,clock.now()+50);}})();void producerTerminal.catch(()=>{});
   await operation(context,current,()=>page.evaluate(async url=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Host absent');await host.connectReplay(url);},current.producer!.url));
   const hostWait=operation(context,current,()=>page.evaluate(async()=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Host absent');await host.waitForReplay();}));void hostWait.catch(()=>{});
   for(;;){const guard=await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readHostGuard();}));if(guard.status==='ready'){current.guards.push(comparisonHostFrameGuardSchema.parse(guard.value));break;}if(guard.status==='unavailable'){reason(current,guard.reason);break;}await waitUntil(context,current,clock.now()+50);}
   if(context.fixture.workload.journey==='history-reading'){
     await phase(context,current,'history-reading');const before=await scroll(context,current,null,undefined,experiment?'before':undefined),beforeReceipt=clock.now();
     const wheel=current.native.wheel();void wheel.catch(()=>{});let origin:number|undefined;
     while(origin===undefined){context.ownership.assertActive();const dispatch=current.native.snapshot().hostDispatches.find(value=>value.kind==='wheel'&&value.index===0);if(dispatch){origin=dispatch.hostMonotonicMs-dispatch.actualOffsetMs;if(before&&beforeReceipt>dispatch.hostMonotonicMs)reason(current,'Recipe-start sample did not precede actual dispatch');break;}await waitUntil(context,current,clock.now()+50);}
     const fresh=context.comparisonVersion==='2.1.0';if(fresh)await wheel;
     await waitUntil(context,current,origin+200);const post=await scroll(context,current,null,fresh?'begin-history-window':undefined,experiment?'post':undefined);await waitUntil(context,current,origin+1000);
     const minimum=post?post.timestampMs+800:null,validMinimum=minimum!==null&&Number.isFinite(minimum)&&minimum>post!.timestampMs;
     const later=fresh?(validMinimum?await scroll(context,current,minimum,'preserve-history-window',experiment?'later':undefined):undefined):await scroll(context,current);
     if(!before||!post||!later||before.clockDomain!=='page-performance-ms'||post.clockDomain!=='page-performance-ms'||later.clockDomain!=='page-performance-ms'||post.timestampMs<=before.timestampMs||later.timestampMs-post.timestampMs<800)reason(current,fresh?'Actual fresh samples do not cover the required 800ms window':'Actual cached samples do not cover the required 800ms window');
     if(!fresh)await wheel;await phase(context,current,'return-to-response');await scroll(context,current);await current.native.returnControl();await scroll(context,current);
     if(!current.native.snapshot().hostDispatches.some(value=>value.kind==='return-control'))reason(current,'Declared return control did not dispatch');await phase(context,current,'streaming-follow');
   }
   await phase(context,current,'composer-input');await current.native.composer();await phase(context,current,'streaming-follow');
   await Promise.all([producerTerminal,hostWait]);
   const product=runtimeProgressSchema.parse(await operation(context,current,()=>page.evaluate(()=>{const host=(window as CaptureWindow).benchHost;if(!host)throw new Error('Host absent');return host.readProgress();})));
   if(product.delivery!=='complete'||product.outcome!=='success'||product.loading||product.error!==null)throw new Error('Actual product delivery did not complete successfully');
   await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.closePhase();}));
   current.stop=operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');capture.stop({drainTransport:true});}));void current.stop.catch(()=>{});await current.stop;
   current.terminal=await current.journal.finishStage();current.reasons.push(...current.terminal.reasons.slice(0,32-current.reasons.length));
   current.instrumentation=comparisonContextFamily(context).comparisonInstrumentationSchema.parse(await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readInstrumentation();})));
   current.finalInstrumentation=current.instrumentation;
   const phases=comparisonContextFamily(context).comparisonPhasesSchema.parse({...context.identity,...await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture)throw new Error('Page capture absent');return capture.readPhases();}))});
   admission(context,current);await current.counter!.capture(context.ownership,'replay-end');admission(context,current);await current.trace!.finish();
   const full=await operation(context,current,()=>page.evaluate(collectFullPage,{responseId:context.fixture.events[0]!.messageId,candidateLimit:COMPARISON_CAPTURE_LIMITS.maxHistoricalCandidates}));
   const runtime=comparisonContextFamily(context).comparisonFinalRuntimeSchema.parse({...context.identity,timestampMs:full.timestampMs,clockDomain:full.clockDomain,snapshot:full.snapshot}),visible=comparisonContextFamily(context).comparisonVisibleValidationSchema.parse({...context.identity,timestampMs:full.timestampMs,clockDomain:full.clockDomain,coverage:full.coverage});
   const contradictions=validateRuntimeTranscript(context.fixture,runtime.snapshot);if(full.geometry.contradiction)contradictions.push(full.geometry.contradiction);if(!full.geometry.available)reason(current,full.geometry.reason??'Independent content geometry unavailable');
   for(const [path,value] of [['phases.json',phases],['final-runtime.json',runtime],['visible-validation.json',visible]] as const){await operation(context,current,()=>context.writer.json(path,value));current.payloads.add(path);}
   const native=current.native.snapshot(),trace=current.trace!.snapshot();if(native.status!=='complete')reason(current,'Native invocation group incomplete');if(trace.trace.status!=='available'||!trace.trace.complete||trace.traceEof.status!=='available')reason(current,'Actual trace collection incomplete');if(!current.terminal.pageEmpty||!current.terminal.producerEmpty)reason(current,'Terminal drain collection unavailable');if(current.instrumentation.buffers.some(value=>value.status==='partial'))reason(current,'Instrumentation contains actual loss');
   if(experiment){try{await operation(context,current,()=>page.evaluate(()=>{const capture=(window as CaptureWindow).comparisonCapture;if(!capture?.takeHistoryWindowDiagnostic)throw new Error('Installed diagnostic transfer absent');return capture.takeHistoryWindowDiagnostic();}).then(value=>{admission(context,current);experiment.transfer(value);admission(context,current);}));}catch(error){experiment.fail(error);context.ownership.assertActive();}}
   await stopPage(current);context.ownership.assertActive();delete current.currentContext;
   const reasons=[...new Set([...contradictions,...current.reasons])].slice(0,32),status=contradictions.length?'invalid':reasons.length?'failed':'valid';
   return {validation:comparisonContextFamily(context).comparisonValidationSchema.parse({...context.identity,status,reasons,checks:[{name:'actual-runtime-content',passed:contradictions.length===0,reason:contradictions.length?contradictions.join('; '):null,evidencePaths:['final-runtime.json','visible-validation.json']},{name:'independent-candidate-content-geometry',passed:full.geometry.available&&!full.geometry.contradiction,reason:full.geometry.available&&!full.geometry.contradiction?null:full.geometry.contradiction??full.geometry.reason??'Geometry unavailable',evidencePaths:['visible-validation.json','page.jsonl']},{name:'capture-lifecycle',passed:current.reasons.length===0,reason:current.reasons.length?current.reasons.join('; '):null,evidencePaths:['page.jsonl','producer.jsonl','trace.json']}]})};
 },async finalize(context,capture):Promise<ComparisonSlotFinalization>{
   const current=entry;if(!current||canonicalSerialize(current.state.identity)!==canonicalSerialize(context.identity))throw new Error('Filesystem finalizer requires its actual retained slot');
   try{
     const native=current.native?.snapshot(),trace=current.trace?.snapshot(),journal=current.journal?.snapshot(),acquisition=current.session?.snapshotAcquisition();
     if(acquisition)await context.writer.json('provenance/acquisition.json',acquisition.acquisition);
     if(native){await context.writer.json('native-dispatch-results.json',comparisonContextFamily(context).comparisonNativeDispatchResultsSchema.parse(native));current.payloads.add('native-dispatch-results.json');}
     if(trace){await context.writer.json('trace-auxiliary.json',comparisonContextFamily(context).comparisonTraceAuxiliarySchema.parse(trace.auxiliary));current.payloads.add('trace-auxiliary.json');}
     if(current.recipe&&current.instrumentation){await context.writer.json('checkpoints.json',comparisonContextFamily(context).comparisonCheckpointsSchema.parse({...context.identity,inputRecipe:current.recipe,hostDispatches:native?.hostDispatches??[],hostFrameGuards:current.guards,scroll:current.scroll,counters:current.counter?.snapshot()??[],deadlines:context.deadlines}));current.payloads.add('checkpoints.json');}
     const missing=(reason:string)=>({status:'unavailable' as const,reason}),reasons=[...new Set([...(capture?.validation.reasons??[]),...current.reasons,...(journal?.reasons??[]),...(!capture?['Capture did not complete']:[])])].slice(0,32);
     const collectionReasons=[...current.reasons,...(journal?.reasons??[]),...(!capture?['Capture did not complete']:[]),...(!current.metadata?['Capture metadata not acquired']:[]),...(!current.finalInstrumentation?['Stopped terminal page instrumentation not acquired']:[]),...(!current.terminal?.pageEmpty?['Terminal page collection not completed']:[]),...(!current.terminal?.producerEmpty?['Terminal producer collection not completed']:[]),...(acquisition?.acquisition.status!=='complete'?['Original provenance acquisition incomplete']:[]),...(native?.status!=='complete'?['Native collection incomplete']:[]),...(trace?.trace.status!=='available'||!trace.trace.complete||trace.traceEof.status!=='available'||trace.auxiliary.status!=='complete'?['Actual trace collection incomplete']:[]),...(context.deadlines.some(value=>value.outcome!=='complete')?['Owned stage or cleanup did not complete safely']:[])];
     if(current.finalInstrumentation?.buffers.some(value=>value.status==='partial'))collectionReasons.push('Instrumentation contains actual loss');
     if(['manifest.json','capture-metadata.json','phases.json','final-runtime.json','visible-validation.json'].some(path=>!current.payloads.has(path)))collectionReasons.push('Required capture payload persistence incomplete');
     const collectionComplete=collectionReasons.length===0,collectionReason=[...new Set(collectionReasons)].join('; ').slice(0,4096);
     const evidence=current.instrumentation&&trace?{...context.identity,status:collectionComplete?'complete' as const:'partial' as const,...(collectionComplete?{}:{reason:collectionReason}),trace:trace.trace,instrumentation:current.instrumentation,unavailableFiles:[]}:undefined;
     const payloadFiles:ComparisonPayloadFile[]=[...current.payloads].map(path=>({path,status:'complete' as const}));if(trace)payloadFiles.push(trace.payload);
     if(acquisition)payloadFiles.push({path:'provenance/acquisition.json',status:acquisition.acquisition.status==='complete'?'complete':'partial',...(acquisition.acquisition.status==='complete'?{}:{reason:acquisition.acquisition.reason??'Original acquisition incomplete'})});
     const captureStatus=comparisonContextFamily(context).comparisonCaptureStatusSchema.parse({...context.identity,status:collectionComplete?'complete':'partial',reasons:collectionComplete?[]:[...new Set([...reasons,...collectionReasons])].slice(0,32),captureMetadata:current.metadata?{status:'available',value:current.metadata}:missing('Capture metadata not acquired'),evidenceMetadata:evidence?{status:'available'}:missing('Required instrumentation/trace metadata not acquired'),payloads:[],unavailablePaths:[],terminalPageDrain:current.terminal?.pageEmpty?{status:'available',value:{entries:current.terminal.pageRecords,serializedBytes:current.terminal.pageSerializedBytes}}:missing('Terminal page collection not completed'),terminalProducerDrain:current.terminal?.producerEmpty?{status:'available',value:{entries:current.terminal.producerRecords,serializedBytes:current.terminal.producerSerializedBytes}}:missing('Terminal producer collection not completed'),finalPageInstrumentation:current.finalInstrumentation?{status:'available',value:current.finalInstrumentation}:missing('Stopped terminal page instrumentation not acquired'),traceEof:trace?.traceEof??missing('Trace EOF not acquired')});
     if(experiment){try{
       const disposal=context.deadlines.find(value=>value.stage==='disposal');
       if(!disposal)experiment.fail(new Error('Actual original disposal deadline unavailable'));
       else await experiment.finish({canonicalRoot:configuration.out,deadline:disposal,clock,canonicalSettled:current.closed&&current.pending.size===0&&current.routePending.size===0&&context.deadlines.every(value=>value.outcome==='complete'&&value.finishedAtHostMs!==null),facts:[
         {key:'identity',value:context.identity},{key:'configuration',value:configuration.configuration},{key:'captureValidation',value:capture?.validation??null},
         {key:'captureMetadata',value:current.metadata??null},{key:'inputRecipe',value:current.recipe??null},
         {key:'installerSha256',value:current.pair?.installerSha256??null},{key:'installerPreNavigationBytes',value:current.pair?String(current.pair.preNavigationByteLength):null},{key:'installerMainBytes',value:current.pair?String(current.pair.mainByteLength):null},
         {key:'originalProvenanceAcquisition',value:acquisition?.acquisition??null},{key:'build',value:current.profile?.build??null},
         {key:'environment.os',value:current.environment?.facts.environment.os??null},{key:'environment.architecture',value:current.environment?.facts.environment.architecture??null},
         {key:'browser',value:current.environment?.facts.browser??null},{key:'git',value:current.environment?.facts.git??null},
         {key:'fixture',value:current.experimentManifest?.fixture??null},{key:'workload',value:current.experimentManifest?.workload??null},{key:'caseOrder',value:current.experimentManifest?.caseOrder??null},
         {key:'viewport',value:current.experimentManifest?.viewport??null},{key:'fonts',value:current.experimentManifest?.fonts??null},{key:'mode',value:current.experimentManifest?.mode??null},{key:'cachePolicy',value:current.experimentManifest?.cachePolicy??null},
         {key:'fixtureFileFact',value:null},{key:'parentInvocationIdentity',value:null},{key:'displayCapability',value:null},
       ]});
     }catch(error){experiment.fail(error);}}
     return {payloadFiles,captureStatus,...(evidence?{evidence}:{})};
   }finally{current.closures.clear();current.pending.clear();current.timers.clear();current.routePending.clear();delete current.currentContext;delete current.browser;delete current.browserContext;delete current.page;delete current.environmentSession;delete current.counterSession;delete current.assets;delete current.producer;delete current.session;delete current.trace;delete current.native;delete current.journal;delete current.counter;entry=undefined;}
 }};
}
import {comparisonContextFamily,type ComparisonRuntimeSchemas} from './comparison-runtime-family.js';
