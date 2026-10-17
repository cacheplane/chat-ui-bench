/** Hosted SOURCE adapter, never invoked by local tests or STATIC inspection. */
import {runMountedConformance,mountedPrerequisitesAccepted,createMountedSnapshotReader,awaitRestoredHistoryContent,closeAfterHistoryReadinessPublication,type MountedPrerequisites,type MountedConformanceResult,type MountedCaseOwner,type JourneyObservations} from './mounted-conformance.ts';
import {evaluateMountedOriginPolicy,MOUNTED_CASE_WITNESS_LABELS,type CaseRecord,type Witness,type OriginLease,type OriginalStatus} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {assertProductionOutputInventory,ordinaryPath,type FileFact} from '../../../tests/support/hosted-copilot-contract.ts';
import type {NativeCaseObservation,NativeCaseWitness} from './ownership.ts';
import {boundedWait} from './ownership.ts';
import type {GeometrySnapshot,RestoredHistoryDiagnosticPort} from '../src/geometry.ts';
import type {OwnedFrontendHost} from '../src/host.ts';
import type {CDPSession,Page,BrowserContext,Frame} from 'playwright';
import {evaluateMountedTrackerAPilotPrerequisites,type MountedTrackerAPilotPrerequisites} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {runMountedTrackerA,type TrackerAHistoryOwner,type TrackerASequencerResult,type TrackerAScalar} from './mounted-tracker-a.ts';
import {createMountedTrackerATrace,TRACKER_A_TRACE_CONFIG,type TrackerATracePorts,type TrackerAProfileRef} from './mounted-tracker-a-trace.ts';

export interface NativeMountedOptions {prerequisites:MountedPrerequisites;browserEndpoint:string;assets:Readonly<{root:string;files:readonly FileFact[]}>}
export interface NativeMountedResult extends MountedConformanceResult {originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[]}
export interface NativeMountedTrackerAPilotOptions extends Omit<NativeMountedOptions,'prerequisites'> {prerequisites:MountedTrackerAPilotPrerequisites}
/** Owned closures are passed directly by the application bootstrap, never serialized. */
export interface NativeMountedTrackerAPublication {profileRef:TrackerAProfileRef;reserveTraceSink():Promise<TrackerATracePorts['sink']>}
export interface NativeMountedTrackerAPilotResult {pilot:TrackerASequencerResult;originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[]}
/** Caller bootstrap must authenticate source/provider/archive/physical graph
 * BEFORE importing the emitted worker. These policies remain supplied-data only. */
export async function runNativeMountedConformance(options:NativeMountedOptions,diagnostics:RestoredHistoryDiagnosticPort):Promise<NativeMountedResult>{
 if(!mountedPrerequisitesAccepted(options.prerequisites))
  throw Error('Native prerequisites denied before SDK imports');
 return runNativeMountedOwner(options,diagnostics,{kind:'ordinary'});
}
export async function runNativeMountedTrackerAPilot(options:NativeMountedTrackerAPilotOptions,diagnostics:RestoredHistoryDiagnosticPort,publication:NativeMountedTrackerAPublication):Promise<NativeMountedTrackerAPilotResult>{
 if(evaluateMountedTrackerAPilotPrerequisites(options.prerequisites).status!=='accepted')throw Error('Fixed pilot prerequisites denied before SDK imports');
 const descriptors=Object.getOwnPropertyDescriptors(publication.profileRef);
 if(Reflect.ownKeys(descriptors).length!==3||descriptors.path?.value!=='tracker-a-profile.json'||!Number.isSafeInteger(descriptors.bytes?.value)||descriptors.bytes.value<0||descriptors.bytes.value>16384||typeof descriptors.sha256?.value!=='string'||!/^[0-9a-f]{64}$/.test(descriptors.sha256.value)||typeof publication.reserveTraceSink!=='function')throw Error('Pilot publication denied before SDK imports');
 return runNativeMountedOwner(options,diagnostics,{kind:'pilot',publication});
}
type NativeMode={kind:'ordinary'}|{kind:'pilot';publication:NativeMountedTrackerAPublication};
function runNativeMountedOwner(options:NativeMountedOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:{kind:'ordinary'}):Promise<NativeMountedResult>;
function runNativeMountedOwner(options:NativeMountedTrackerAPilotOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:{kind:'pilot';publication:NativeMountedTrackerAPublication}):Promise<NativeMountedTrackerAPilotResult>;
async function runNativeMountedOwner(options:NativeMountedOptions|NativeMountedTrackerAPilotOptions,diagnostics:RestoredHistoryDiagnosticPort,mode:NativeMode):Promise<NativeMountedResult|NativeMountedTrackerAPilotResult>{
 const p=options.prerequisites;
 if(evaluateMountedOriginPolicy({schemaVersion:1,kind:'control-connect',boundEndpoint:options.browserEndpoint,requestedEndpoint:options.browserEndpoint,priorConnectCount:0}).status!=='accepted')throw Error('Native browser endpoint denied');
 const assetInventory=assertProductionOutputInventory(options.assets.files);
 const files=new Map(assetInventory.files.map(f=>[f.path,f]));if(!files.has('index.html'))throw Error('Qualified frontend entry absent');
 const [{chromium},{createCaseServer},contract,fs,path,crypto]=await Promise.all([import('playwright'),import('./server.js'),import('../../../packages/contract/src/long-thread.js'),import('node:fs/promises'),import('node:path'),import('node:crypto')]);
 const root=await fs.realpath(options.assets.root);
 if(root!==options.assets.root)throw Error('Qualified assets root must be real absolute path');
 const originals:{label:string;status:OriginalStatus}[]=['browserConnect','clientClose','clientDisconnected'].map(label=>({label,status:'pending'}));
 const markGlobal=(label:string)=>{originals.find(w=>w.label===label)!.status='fulfilled';};
 let browser:Awaited<ReturnType<typeof chromium.connect>>|undefined,browserVersion:string|null=null,disconnect:Promise<void>|undefined;
 const caseEvidence:CaseRecord[]=[];
 const overallDeadline=performance.now()+180000;
 const checkDeadline=()=>{if(performance.now()>=overallDeadline)throw Error('Native matrix deadline exceeded');};
 async function assets(request:Request):Promise<Response>{
  const url=new URL(request.url),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const fact=files.get(name);if(request.method!=='GET'||!ordinaryPath(name)||!fact)return new Response('Not found',{status:404});
  let ancestor=root;for(const part of name.split('/')){ancestor=path.join(ancestor,part);if((await fs.lstat(ancestor)).isSymbolicLink())throw Error('Asset symlink denied');}
  const handle=await fs.open(path.join(root,name),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let bytes:Uint8Array;
  try{const before=await handle.stat();if(!before.isFile()||before.size!==fact.bytes)throw Error('Asset size/owner changed');bytes=await handle.readFile();const after=await handle.stat();if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==fact.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==fact.sha256)throw Error('Asset bytes changed');}finally{await handle.close();}
  const ext=path.extname(name),mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
  return new Response(new Uint8Array(bytes),{headers:{'content-type':mime[ext]??'application/octet-stream','cache-control':'no-store'}});
 }
 const nativePorts={
  async connect(){
   checkDeadline();browser=await chromium.connect(options.browserEndpoint,{timeout:30000});
   // Public event and close promise remain distinct originals.
   disconnect=new Promise<void>(resolve=>browser!.once('disconnected',()=>{markGlobal('clientDisconnected');resolve();}));
   if(!browser.isConnected())throw Error('Original browser disconnected before bind');browserVersion=browser.version();markGlobal('browserConnect');
  },
  async openCase(journey:'follow'|'history-reading',number:1|2):Promise<MountedCaseOwner&{pilot?:TrackerAHistoryOwner}>{
   checkDeadline();if(!browser)throw Error('No original browser');
   const fixture=contract.createLongThreadFixture({historyCount:100,responseBytes:6400,journey,seed:1});
   const ids={threadId:`native-thread-${number}`,seedRunId:`native-seed-${number}`,continuationRunId:`native-continuation-${number}`,responseId:fixture.events[0]!.messageId};
   const repetition=`native-repetition-${number}`;
   const witnesses:{label:string;status:OriginalStatus}[]=MOUNTED_CASE_WITNESS_LABELS.map(label=>({label,status:'pending'}));
   const mark=(label:NativeCaseWitness)=>{const w=witnesses.find(x=>x.label===label)!;if(w.status!=='pending')throw Error('Duplicate original witness');w.status='fulfilled';};
   let history:readonly OriginLease[]=[],leases:readonly OriginLease[]=[],recordingFailed=false,localClosed=false,publicationFailed=false;
   let page:import('playwright').Page|undefined,context:import('playwright').BrowserContext|undefined;
   let remoteAdmission:Promise<void>|undefined,originalClose:Promise<CaseRecord>|undefined,completed=false,publicIdle=false;
   let pilot:ReturnType<typeof bindNativeTrackerA>|undefined;
   const observe=(event:NativeCaseObservation)=>{
    try{
     if(event.kind==='witness'){const w=witnesses.find(x=>x.label===event.label)!;if(w.status!=='pending')throw Error('Duplicate source witness');w.status=event.status;return;}
     const action=event.action==='listen'?{kind:'register' as const,role:event.role,origin:event.origin,listenObserved:true}:event.action==='close'?{kind:'release' as const,role:event.role,origin:event.origin,originalClose:'fulfilled' as const}:{kind:'request' as const,role:event.role,origin:event.origin,channel:'native-fetch' as const,method:event.method!,path:event.path!};
     const evaluation=evaluateMountedOriginPolicy({schemaVersion:1,kind:'origin-transition',caseId:journey,threadId:ids.threadId,registrationHistory:history,leases,action});
     if(evaluation.status!=='accepted'||!evaluation.facts||!('kind' in evaluation.facts)||evaluation.facts.kind!=='origin-transition')throw Error('Actual original origin denied');history=evaluation.facts.registrationHistory;leases=evaluation.facts.leases;
    }catch(error){recordingFailed=true;throw error;}
   };
   const remoteCloseAdmission=()=>{
    localClosed=true;if(!page||remoteAdmission)return;
    const original=page.evaluate(()=>{const host=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!host)throw Error('Original page host absent');host.closeAdmission();});
    remoteAdmission=original.then(()=>{mark('remoteCloseAdmission');});remoteAdmission.catch(()=>{recordingFailed=true;});
   };
   const mountedOwner={closeAdmission:remoteCloseAdmission,async dispose(){
    remoteCloseAdmission();const failures:unknown[]=[];
    // Trace cleanup is owned independently of the sequencer's bounded waiter.
    // Ordinary disposal always follows, including on rejection or pending IO.
    if(pilot)try{await pilot.dispose();}catch(e){failures.push(e);}
    try{if(!remoteAdmission)throw Error('Original remote admission absent');await remoteAdmission;}catch(e){failures.push(e);}
    if(page){try{await page.evaluate(()=>{const w=window as unknown as {__copilotkitNativeWheel?:{remove():void}};w.__copilotkitNativeWheel?.remove();delete w.__copilotkitNativeWheel;});}catch(e){failures.push(e);}
     try{await page.evaluate(async()=>{const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');await h.dispose();});mark('hostDispose');}catch(e){failures.push(e);}
     try{if(!await page.evaluate(()=>document.getElementById('root')?.childElementCount===0))throw Error('Root remains mounted');mark('rootUnmount');}catch(e){failures.push(e);}
     try{await page.close();mark('pageClose');}catch(e){failures.push(e);}}
    if(context)try{await context.close();mark('contextClose');}catch(e){failures.push(e);}
    if(failures.length)throw Error('Original mounted disposal incomplete');
   }};
   const server=await createCaseServer({fixture,ids,repetition,mountedOwner,assets,hooks:{observe}});
   const rawRecord=():CaseRecord=>({caseNumber:number,journey,threadId:ids.threadId,seedRunId:ids.seedRunId,continuationRunId:ids.continuationRunId,repetition,completed,publicIdle,storeEmpty:witnesses.find(w=>w.label==='publicStoreEmpty')!.status==='fulfilled',domainReleased:witnesses.find(w=>w.label==='caseDomainRelease')!.status==='fulfilled',originals:witnesses.map(w=>({...w}))});
   const read=createMountedSnapshotReader(journey,async():Promise<GeometrySnapshot>=>{checkDeadline();if(localClosed||recordingFailed||!page)throw Error('Case admission closed');return page.evaluate(()=>{const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');return h.readGeometrySnapshot();});});
   // Readiness polling never invokes the full H100 geometry collector. Only one
   // response box and the scroller box are read; these scalars confer no geometry eligibility.
   async function progress(){
    checkDeadline();if(localClosed||recordingFailed||!page)throw Error('Case admission closed');
    return page.evaluate(responseId=>{
     const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');
     const p=h.readProgress(),scroller=document.querySelector<HTMLElement>(h.locators.scroller);
     if(!scroller)throw Error('Original scroller absent');
     const response=document.querySelector<HTMLElement>(h.locators.messageContent(responseId)),box=response?.getBoundingClientRect(),clip=scroller.getBoundingClientRect();
     return {active:p.loading&&p.delivery==='streaming'&&p.activeMessage!==null,prefixLength:p.activeMessage?.text.length??0,
      loading:p.loading,outcome:p.outcome,error:p.error!==null,now:performance.now(),scrollTop:scroller.scrollTop,
      responseOnscreen:Boolean(box&&box.width>0&&box.height>0&&box.bottom>Math.max(0,clip.top)&&box.top<Math.min(innerHeight,clip.bottom)&&box.right>Math.max(0,clip.left)&&box.left<Math.min(innerWidth,clip.right))};
    },ids.responseId);
   }
   type Progress=Awaited<ReturnType<typeof progress>>;
   async function until(test:(s:Progress)=>boolean):Promise<Progress>{for(let i=0;i<120;i++){const s=await progress();if(s.error)throw Error('Original public progress failed');if(test(s))return s;await page!.waitForTimeout(50);}throw Error('Native scalar readiness not established within bounded observations');}
   const responseVisible=(s:Progress)=>s.responseOnscreen&&s.active;
   const owner:MountedCaseOwner&{pilot?:TrackerAHistoryOwner}={
    async seed(){await server.seed();},
    async restore(){
     context=await browser!.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
     await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(url.origin===server.url&&request.method()==='GET'&&files.has(name)){await route.continue();return;}
      const policy=evaluateMountedOriginPolicy({schemaVersion:1,kind:'origin-transition',caseId:journey,threadId:ids.threadId,registrationHistory:history,leases,action:{kind:'request',role:'native-case',origin:url.origin,channel:'page-http',method:request.method(),path:url.pathname}});
      if(policy.status!=='accepted'){recordingFailed=true;await route.abort();return;}await route.continue();
     });
     await context.routeWebSocket('**/*',socket=>{recordingFailed=true;socket.close();});
     page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
     await page.goto(server.url,{waitUntil:'load'});await page.waitForFunction(()=>Boolean((window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost));
     const committed=server.context();if(!committed)throw Error('Seed context missing');
     await page.evaluate(async history=>{await (window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.loadHistory(history.map(m=>({id:m.id,role:m.role,text:m.content,status:'complete' as const})));},committed.history);
     mark('mountedACK');
     await awaitRestoredHistoryContent({caseNumber:number,journey,threadId:ids.threadId,history:fixture.history},{
      check:()=>performance.now()>=overallDeadline?'deadline':localClosed?'admission-closed':recordingFailed?'source-error':null,
      observe:()=>page!.evaluate(()=>{const h=(window as Window&{__copilotkitBenchHost?:OwnedFrontendHost}).__copilotkitBenchHost;if(!h)throw Error('Original host absent');return h.readRestoredHistoryContentReadiness();}),
      pause:()=>page!.waitForTimeout(50),
      publish:async record=>{try{await diagnostics.emitReadinessSummary(record);}catch(error){publicationFailed=true;throw error;}}
     });
     const restored=await read();
     if(pilot)await pilot.captureBaseline();
     return restored;
    },
    async startContinuation(){await page!.evaluate(()=>{const original=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.connectReplay('/__bench/continuation');Promise.resolve(original).catch(()=>{});});},
    async exercise(selected):Promise<JourneyObservations>{
     if(selected==='follow'){
      await until(responseVisible);const first=await read();if(first.status!=='available')throw Error('Original response geometry unavailable');
      await until(s=>responseVisible(s)&&s.now>=first.frame.observedAtPageMs+800&&s.prefixLength>first.frame.responseProgress.prefix.length);
      const second=await read();return {samples:[first,second],anchorId:null,returned:null,wheel:null};
     }
     await until(responseVisible);const selector=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.scroller);
     const box=await page!.locator(selector).boundingBox();if(!box)throw Error('Native scroller absent');await page!.mouse.move(box.x+box.width/2,box.y+box.height/2);
     // Registration is acknowledged before the native wheel is requested.
     // The owned listener is once-only and is removed during disposal on failure.
     await page!.evaluate(selector=>{
      const w=window as unknown as {__copilotkitNativeWheel?:{value:{isTrusted:boolean;deltaY:number;beforeScrollTop:number}|null;remove():void}};
      if(w.__copilotkitNativeWheel)throw Error('Original native input already registered');
      const scroller=document.querySelector<HTMLElement>(selector);if(!scroller)throw Error('Original scroller absent');
      const handler=(event:WheelEvent)=>{w.__copilotkitNativeWheel!.value={isTrusted:event.isTrusted,deltaY:event.deltaY,beforeScrollTop:scroller.scrollTop};};
      w.__copilotkitNativeWheel={value:null,remove:()=>scroller.removeEventListener('wheel',handler)};
      scroller.addEventListener('wheel',handler,{once:true,passive:true});
     },selector);
     await page!.mouse.wheel(0,-600);
     await page!.waitForFunction(()=>Boolean((window as unknown as {__copilotkitNativeWheel?:{value:unknown}}).__copilotkitNativeWheel?.value),undefined,{timeout:5000});
     const wheelEvent=await page!.evaluate(()=>{
      const w=window as unknown as {__copilotkitNativeWheel?:{value:{isTrusted:boolean;deltaY:number;beforeScrollTop:number}|null;remove():void}};
      const original=w.__copilotkitNativeWheel;if(!original?.value)throw Error('Original native wheel absent');original.remove();delete w.__copilotkitNativeWheel;return original.value;
     });
     await until(s=>s.active&&s.scrollTop<wheelEvent.beforeScrollTop);const first=await read();
     if(first.status!=='available')throw Error('Original anchor unavailable');const anchor=first.evaluation.rows.find(r=>r.id!==ids.responseId&&r.geometryEligibility==='eligible');if(!anchor)throw Error('Original anchor unavailable');const anchorId=anchor.id;
     await until(s=>s.active&&s.now>=first.frame.observedAtPageMs+800&&s.prefixLength>first.frame.responseProgress.prefix.length);const second=await read();
     const control=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.returnToResponse);
     if(!control)throw Error('Native return control absent');await page!.locator(control).click({scroll:'none'});await until(s=>s.responseOnscreen);const returned=await read();return {samples:[first,second],anchorId,returned,wheel:{...wheelEvent,afterScrollTop:first.scroll.scrollTop}};
    },
    async complete(){await page!.evaluate(async()=>{const h=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost;await h.waitForReplay();await h.validateCompletion();});completed=server.completed();publicIdle=await page!.evaluate(()=>{const p=(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.readProgress();return !p.loading&&p.outcome==='success'&&p.error===null;});mark('completionACK');if(!completed||!publicIdle||recordingFailed)throw Error('Original completion failed');await until(s=>s.responseOnscreen&&!s.loading&&s.outcome==='success');return read();},
    close(){if(originalClose)return originalClose;originalClose=(async()=>{try{return await closeAfterHistoryReadinessPublication(async()=>{await server.close();if(recordingFailed)throw Error('Native observation failed');return rawRecord();},()=>publicationFailed);}finally{caseEvidence.push(rawRecord());}})();return originalClose;}
   };
   if(mode.kind==='pilot'&&number===2){
    pilot=bindNativeTrackerA({page:()=>page,context:()=>context,deadline:overallDeadline,publication:mode.publication,check:checkDeadline,owner,geometry:read,active:async()=>{const s=await until(s=>s.active&&s.prefixLength>0);return {active:s.active,prefixLength:s.prefixLength};},returned:async()=>{
     const control=await page!.evaluate(()=>(window as unknown as {__copilotkitBenchHost:OwnedFrontendHost}).__copilotkitBenchHost.locators.returnToResponse);
     if(!control)throw Error('Native return control absent');await page!.locator(control).click({scroll:'none'});await until(s=>s.responseOnscreen);
    }});owner.pilot=pilot.history;
   }
   return owner;
  },
  async closeClient(){if(browser){const original=browser.close();await boundedWait(original,10000,'Original browser client close');markGlobal('clientClose');if(!disconnect)throw Error('Original disconnect listener absent');await boundedWait(disconnect,10000,'Original browser disconnect');}}
 };
 if(mode.kind==='pilot'){
  const pilot=await runMountedTrackerA({profileRef:mode.publication.profileRef,clock:nativeClock(overallDeadline),connect:nativePorts.connect,openFollow:()=>nativePorts.openCase('follow',1),openHistory:async()=>{const owner=await nativePorts.openCase('history-reading',2);if(!owner.pilot)throw Error('Original pilot owner absent');return owner.pilot;},closeClient:nativePorts.closeClient});
  return {pilot,originals,browserVersion,caseEvidence};
 }
 const result=await runMountedConformance(p,nativePorts);
 return {...result,originals,browserVersion,caseEvidence};
}

function nativeClock(deadlineHostMs:number){
 return {now:()=>performance.now(),deadlineHostMs,alarm(at:number,fire:()=>void){const timer=setTimeout(fire,Math.max(0,at-performance.now()));return ()=>clearTimeout(timer);},waitUntil(at:number){return new Promise<void>(resolve=>{const wake=()=>{const remaining=at-performance.now();if(remaining>0)setTimeout(wake,remaining);else resolve();};wake();});}};
}
type NativeLoss={firstHostMs:number;firstOverflowHostMs:number|null};
type PilotWheel={ordinal:number;pageNowMs:number;eventTimeStampMs:number;isTrusted:boolean;deltaX:number;deltaY:number;deltaMode:number;targetContained:boolean;currentTargetIsScroller:boolean};
type PilotScroll={ordinal:number;pageNowMs:number;eventTimeStampMs:number;currentTargetIsScroller:boolean;scrollTop:number;scrollHeight:number;clientHeight:number};
type PilotMotion={ordinal:number;kind:'animationstart'|'transitionrun';pageNowMs:number;eventTimeStampMs:number;targetContained:boolean};
type PilotDOMName='wheel'|'scroll'|'animationstart'|'transitionrun';
type PilotPageState={baseline:TrackerAScalar;scalar():TrackerAScalar;install(name:PilotDOMName):boolean;remove(name:PilotDOMName):boolean;drain():{wheelEvents:PilotWheel[];scrollEvents:PilotScroll[];motionEvents:PilotMotion[];overflows:{wheel:{ordinal:41}|null;scroll:{ordinal:257}|null;motion:{ordinal:33}|null}}};
type PilotWindow=Window&{__copilotkitBenchHost?:OwnedFrontendHost;__copilotkitTrackerA?:PilotPageState};
type PrivateOriginal={status:'not-started'|'pending'|'fulfilled'|'rejected';requestedHostMs:number|null;settledHostMs:number|null;promise:Promise<unknown>|null;value:unknown};
/** Fixed SDK JSON protocol responses only: no arbitrary JS object/parser claim.
 * Bounds cover retained data and explicit copies, not SDK/engine heap internals.
 * The two topology responses are diagnostic originals, never artifact data. */
function boundedPrivateTopology(value:unknown):void{
 let tokens=0,bytes=0;const ancestors=new Set<object>();
 const charge=(n:number)=>{bytes+=n;if(bytes>4194304)throw Error('Private topology byte capacity');};
 const stringBytes=(text:string)=>{
  if(text.length>4194304)throw Error('Private topology byte capacity');charge(2);
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c===34||c===92)charge(2);else if(c<32)charge(c===8||c===9||c===10||c===12||c===13?2:6);else if(c<128)charge(1);else if(c<2048)charge(2);else if(c>=0xd800&&c<=0xdbff){const next=text.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Private topology Unicode');charge(4);}else if(c>=0xdc00&&c<=0xdfff)throw Error('Private topology Unicode');else charge(3);}
 };
 const walk=(v:unknown,depth:number):void=>{
  if(depth>32||++tokens>65536)throw Error('Private topology record capacity');
  if(v===null){charge(4);return;}if(typeof v==='string'){stringBytes(v);return;}if(typeof v==='boolean'){charge(v?4:5);return;}
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Private topology finite value');charge(JSON.stringify(v).length);return;}
  if(typeof v!=='object'||ancestors.has(v))throw Error('Private topology data required');
  const array=Array.isArray(v);if(!array&&Object.getPrototypeOf(v)!==Object.prototype)throw Error('Private topology plain record');
  charge(2);ancestors.add(v);
  if(array){
   // Guard own length BEFORE indexed traversal or enumeration. No key array is
   // materialized; the protocol contract supplies dense enumerable JSON data.
   const length=Object.getOwnPropertyDescriptor(v,'length');
   if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||length.value>65536-tokens)throw Error('Private topology array capacity');
   for(let i=0;i<length.value;i++){if(i)charge(1);const entry=Object.getOwnPropertyDescriptor(v,String(i));if(!entry||!entry.enumerable||!('value'in entry))throw Error('Private topology dense array');walk(entry.value,depth+1);}
   let entries=0;for(const key in v){if(!Object.hasOwn(v,key)||key!==String(entries)||entries>=length.value)throw Error('Private topology dense enumerable keys');entries++;}
   if(entries!==length.value)throw Error('Private topology dense enumerable keys');
  }else{
   let entries=0;for(const key in v){
    if(!Object.hasOwn(v,key))throw Error('Private topology own enumerable key');
    if(entries++)charge(1);walk(key,depth+1);charge(1);
    const entry=Object.getOwnPropertyDescriptor(v,key);if(!entry||!entry.enumerable||!('value'in entry))throw Error('Private topology own enumerable value');walk(entry.value,depth+1);
   }
  }
  ancestors.delete(v);
 };walk(value,0);
 // The complete serialization is allocated only after exact bounded traversal.
 if(new TextEncoder().encode(JSON.stringify(value)).length!==bytes)throw Error('Private topology serialized extent');
}
function topologyText(value:unknown,cap:number,allowEmpty=false):string{if(typeof value!=='string'||(!allowEmpty&&value.length===0)||value.length>cap||new TextEncoder().encode(value).length>cap)throw Error('Private topology selected field capacity');return value;}
function bindNativeTrackerA(ports:{page():Page|undefined;context():BrowserContext|undefined;deadline:number;publication:NativeMountedTrackerAPublication;check():void;owner:MountedCaseOwner;geometry():Promise<GeometrySnapshot>;active():Promise<unknown>;returned():Promise<void>}){
 const clock=nativeClock(ports.deadline),fresh=():PrivateOriginal=>({status:'not-started',requestedHostMs:null,settledHostMs:null,promise:null,value:undefined});
 const baselineOriginal=fresh(),reservationOriginal=fresh(),sessionOriginal=fresh(),sessionCloseRegistration=fresh(),sessionCloseRemoval=fresh(),targetOriginal=fresh(),frameOriginal=fresh(),drainOriginal=fresh();
 let targetDiagnostic:unknown,frameDiagnostic:unknown,session:CDPSession|undefined,sink:TrackerATracePorts['sink']|undefined,trace:ReturnType<typeof createMountedTrackerATrace>|undefined;
 let acquisition:Promise<ReturnType<typeof createMountedTrackerATrace>>|undefined,cleanup:Promise<void>|undefined,cleanupRequested=false,drained=false,pointerMoved=false,scalarCalls=0;
 let publicCloseInstalled=false,publicCloseRemoved=false,sessionDidClose=false,completionRemovalAttempted=false,detachAttempted=false,detachOriginal:Promise<void>|undefined;
 let firstSessionCloseMatch:boolean|null=null,consumerAttempted=false,consumerEverBound=false,detachStatus:'not-started'|'pending'|'fulfilled'|'rejected'='not-started',physicalOffOriginal:Promise<void>|undefined;
 let completeCallback:Parameters<TrackerATracePorts['installTracingComplete']>[0]|undefined,closeCallback:Parameters<TrackerATracePorts['installSessionClose']>[0]|undefined;
 let attemptedCloseCallback:Parameters<TrackerATracePorts['installSessionClose']>[0]|undefined;
 let closeResolve!:()=>void;const publicClosed=new Promise<void>(resolve=>{closeResolve=resolve;});
 let detachInvokedResolve!:()=>void;const detachInvoked=new Promise<void>(resolve=>{detachInvokedResolve=resolve;});
 const losses:Record<'navigation'|'context'|'page'|'session',NativeLoss|null>={navigation:null,context:null,page:null,session:null};
 const loss=(name:keyof typeof losses)=>{const first=losses[name];if(first!==null&&first.firstOverflowHostMs!==null)return;const at=performance.now();if(first===null)losses[name]={firstHostMs:at,firstOverflowHostMs:null};else first.firstOverflowHostMs=at;};
 const page=()=>{const p=ports.page();if(!p)throw Error('Original pilot page absent');return p;};
 const context=()=>{const c=ports.context();if(!c)throw Error('Original pilot context absent');return c;};
 const admitted=()=>{ports.check();if(cleanupRequested)throw Error('Original pilot admission closed');};
 function retain(call:()=>Promise<unknown>,fact:PrivateOriginal):Promise<unknown>{
  fact.requestedHostMs=performance.now();fact.status='pending';
  let original:Promise<unknown>;try{original=call();}catch(error){original=Promise.reject(error);}fact.promise=original;
  const observed=original.then(value=>{fact.status='fulfilled';fact.settledHostMs=performance.now();return value;},error=>{fact.status='rejected';fact.settledHostMs=performance.now();throw error;});void observed.catch(()=>{});return observed;
 }
 const completion=(event:Parameters<NonNullable<typeof completeCallback>>[0])=>{completeCallback?.(event);};
 const publicClose=(actual:CDPSession)=>{
  if(!sessionDidClose)firstSessionCloseMatch=actual===session;
  sessionDidClose=true;closeResolve();
  closeCallback?.(actual===session);
  if(!closeCallback||trace?.snapshot().sessionClose.timing!=='expected-detach')loss('session');
 };
 const registrations:{[K in PilotDOMName|'navigation'|'contextClose'|'pageClose']:{installAttempted:boolean;removeAttempted:boolean;installOriginal:Promise<boolean>|undefined;removeOriginal:Promise<boolean>|undefined}}={wheel:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},scroll:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},animationstart:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},transitionrun:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},navigation:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},contextClose:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined},pageClose:{installAttempted:false,removeAttempted:false,installOriginal:undefined,removeOriginal:undefined}};
 // Every frame navigation is conservatively invalidating, including child frames.
 let firstNavigation:{frame:Frame;ownedPage:boolean;mainFrame:boolean;parent:Frame|null}|undefined,overflowNavigation:typeof firstNavigation;
 const navigation=(frame:Frame)=>{if(!firstNavigation||!overflowNavigation){const diagnostic={frame,ownedPage:frame.page()===ports.page(),mainFrame:frame===ports.page()?.mainFrame(),parent:frame.parentFrame()};if(!firstNavigation)firstNavigation=diagnostic;else overflowNavigation=diagnostic;}loss('navigation');},contextClose=()=>loss('context'),pageClose=()=>loss('page');
 const detach=():Promise<void>=>{if(detachAttempted)return detachOriginal!;detachAttempted=true;detachStatus='pending';try{if(!session)throw Error('Original session absent');detachOriginal=session.detach();}catch(error){detachOriginal=Promise.reject(error);}void detachOriginal.then(()=>{detachStatus='fulfilled';},()=>{detachStatus='rejected';});detachInvokedResolve();return detachOriginal;};
 const physicalOff=():Promise<void>=>{
  if(publicCloseRemoved)return physicalOffOriginal!;publicCloseRemoved=true;
  physicalOffOriginal=retain(()=>{if(!session)throw Error('Original session absent');session.off('close',publicClose);return Promise.resolve();},sessionCloseRemoval).then(()=>{});
  void physicalOffOriginal.catch(()=>{});return physicalOffOriginal;
 };
 function listener(name:keyof typeof registrations){
  const row=registrations[name];
  return {install():Promise<boolean>{
   if(row.installAttempted)return row.installOriginal??Promise.reject(Error('Original listener install threw'));row.installAttempted=true;
   try{admitted();
    if(name==='navigation'){page().on('framenavigated',navigation);row.installOriginal=Promise.resolve(true);}
    else if(name==='contextClose'){context().on('close',contextClose);row.installOriginal=Promise.resolve(true);}
    else if(name==='pageClose'){page().on('close',pageClose);row.installOriginal=Promise.resolve(true);}
    else row.installOriginal=page().evaluate(name=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.install(name);},name);
   }catch(error){row.installOriginal=Promise.reject(error);}void row.installOriginal.catch(()=>{});return row.installOriginal;
  },remove():Promise<boolean>{
   if(row.removeAttempted)return row.removeOriginal??Promise.reject(Error('Original listener removal threw'));row.removeAttempted=true;
   try{
    if(name==='navigation'){page().off('framenavigated',navigation);row.removeOriginal=Promise.resolve(true);}
    else if(name==='contextClose'){context().off('close',contextClose);row.removeOriginal=Promise.resolve(true);}
    else if(name==='pageClose'){page().off('close',pageClose);row.removeOriginal=Promise.resolve(true);}
    else row.removeOriginal=page().evaluate(name=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.remove(name);},name);
   }catch(error){row.removeOriginal=Promise.reject(error);}void row.removeOriginal.catch(()=>{});return row.removeOriginal;
  }};
 }
 const listeners={wheel:listener('wheel'),scroll:listener('scroll'),animationstart:listener('animationstart'),transitionrun:listener('transitionrun'),navigation:listener('navigation'),contextClose:listener('contextClose'),pageClose:listener('pageClose')};
 const history:TrackerAHistoryOwner={baseline:undefined,seed:()=>ports.owner.seed(),restore:()=>ports.owner.restore(),listeners,startContinuation:()=>ports.owner.startContinuation(),waitActivePrefix:()=>ports.active(),geometry:()=>ports.geometry(),complete:()=>ports.owner.complete(),close:()=>ports.owner.close(),returnToResponse:()=>ports.returned(),
  movePointer(x,y){admitted();if(pointerMoved)throw Error('Original pointer already charged');pointerMoved=true;return page().mouse.move(x,y);},
  scalar(){admitted();if(scalarCalls>=82)throw Error('Original scalar capacity');scalarCalls++;return page().evaluate(()=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.scalar();});},
  wheel(x,y){admitted();if(x!==0||y!==-12)throw Error('Original pilot wheel denied');return page().mouse.wheel(0,-12);},
  acquireTrace(){
   if(acquisition)return acquisition;
   acquisition=(async()=>{
    admitted();sink=await retain(()=>ports.publication.reserveTraceSink(),reservationOriginal) as TrackerATracePorts['sink'];admitted();
    const original=retain(()=>context().newCDPSession(page()),sessionOriginal);
    const adopted=original.then(async value=>{const actual=value as CDPSession;session=actual;await retain(()=>{publicCloseInstalled=true;actual.on('close',publicClose);return Promise.resolve();},sessionCloseRegistration);return actual;});
    session=await adopted;
    const actual=session;
    trace=createMountedTrackerATrace({profileRef:ports.publication.profileRef,clock,sink,
     start:async config=>{admitted();if(config!==TRACKER_A_TRACE_CONFIG)throw Error('Original fixed trace config required');await actual.send('Tracing.start',{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:32768,includedCategories:['cc','benchmark','blink.user_timing','devtools.timeline','disabled-by-default-devtools.timeline']}});},
     end:async()=>{await actual.send('Tracing.end');},read:(handle,size)=>actual.send('IO.read',{handle,size}),closeIO:async handle=>{await actual.send('IO.close',{handle});},detach,
     installTracingComplete(callback){if(completeCallback)throw Error('Original completion listener already installed');completeCallback=callback;actual.on('Tracing.tracingComplete',completion);},
     removeTracingComplete(callback){if(completionRemovalAttempted)throw Error('Original completion removal already attempted');completionRemovalAttempted=true;if(completeCallback!==callback)throw Error('Original completion identity');actual.off('Tracing.tracingComplete',completion);completeCallback=undefined;},
     // This port binds the transport consumer to the one already-owned physical
     // callback. Its ListenerFact times this binding, not the earlier SDK on().
     // Early close is retained privately and refuses binding; it is never replayed.
     installSessionClose(callback){
      if(consumerAttempted)throw Error('Original session consumer already attempted');consumerAttempted=true;attemptedCloseCallback=callback;
      // Preserve the attempted identity BEFORE any admission guard can throw.
      // A rejected registration still belongs to Task1's own removal path.
      admitted();if(sessionDidClose||sessionCloseRegistration.status!=='fulfilled')throw Error('Original session already closed or registered');closeCallback=callback;consumerEverBound=true;
     },
     async removeSessionClose(callback){if(!consumerAttempted||attemptedCloseCallback!==callback)throw Error('Original session callback identity');await physicalOff();closeCallback=undefined;}
    });
    admitted();const target=await retain(()=>actual.send('Target.getTargetInfo'),targetOriginal) as {targetInfo:{targetId:string;type:string;url:string}};boundedPrivateTopology(target);targetOriginal.value=target;
    targetDiagnostic={targetId:topologyText(target.targetInfo.targetId,4096),type:topologyText(target.targetInfo.type,64),url:topologyText(target.targetInfo.url,4096)};
    admitted();const frame=await retain(()=>actual.send('Page.getFrameTree'),frameOriginal) as {frameTree:{frame:{id:string;parentId?:string;loaderId:string;url:string;urlFragment?:string};childFrames?:unknown[]}};boundedPrivateTopology(frame);frameOriginal.value=frame;
    if(frame.frameTree.childFrames!==undefined&&!Array.isArray(frame.frameTree.childFrames))throw Error('Private topology child population');
    const root=frame.frameTree.frame;frameDiagnostic={id:topologyText(root.id,4096),parentId:root.parentId===undefined?null:topologyText(root.parentId,4096),loaderId:topologyText(root.loaderId,4096),url:topologyText(root.url,4096),urlFragment:root.urlFragment===undefined?null:topologyText(root.urlFragment,4096,true),directChildCount:frame.frameTree.childFrames?.length??0};
    admitted();return trace;
   })();void acquisition.catch(()=>{});return acquisition;
  },
  async observations(){
   if(drained)throw Error('Original pilot drain already charged');drained=true;
   const result=await retain(()=>page().evaluate(()=>{const s=(window as PilotWindow).__copilotkitTrackerA;if(!s)throw Error('Original pilot state absent');return s.drain();}),drainOriginal) as ReturnType<PilotPageState['drain']>,receivedHostMs=drainOriginal.settledHostMs!;
   // Refuse oversized/absent transferred populations before native mapping;
   // Task2 independently performs its closed own-data copier and validation.
   if(!result||!Array.isArray(result.wheelEvents)||result.wheelEvents.length>40||!Array.isArray(result.scrollEvents)||result.scrollEvents.length>256||!Array.isArray(result.motionEvents)||result.motionEvents.length>32||!result.overflows)throw Error('Original drain population capacity');
   if((result.overflows.wheel!==null&&result.overflows.wheel.ordinal!==41)||(result.overflows.scroll!==null&&result.overflows.scroll.ordinal!==257)||(result.overflows.motion!==null&&result.overflows.motion.ordinal!==33))throw Error('Original drain overflow capacity');
   return {wheelEvents:result.wheelEvents.map(row=>({...row,receivedHostMs})),scrollEvents:result.scrollEvents.map(row=>({...row,receivedHostMs})),motionEvents:result.motionEvents.map(row=>({...row,receivedHostMs})),losses:{navigation:losses.navigation,context:losses.context,page:losses.page,session:losses.session},overflows:{wheel:result.overflows.wheel===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.wheel.ordinal},scroll:result.overflows.scroll===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.scroll.ordinal},motion:result.overflows.motion===null?null:{firstHostMs:receivedHostMs,ordinal:result.overflows.motion.ordinal}}};
  }
 };
 return {history,async captureBaseline(){
  if(baselineOriginal.status!=='not-started')throw Error('Original baseline already charged');admitted();
  const original=retain(()=>page().evaluate(()=>{
   const w=window as PilotWindow,h=w.__copilotkitBenchHost;if(!h||w.__copilotkitTrackerA)throw Error('Original pilot baseline unavailable');
   const selector=h.locators.scroller,elements=document.querySelectorAll<HTMLElement>(selector),scroller=elements[0];if(elements.length!==1||!scroller?.isConnected)throw Error('Original pilot scroller unavailable');
   const originalURL=location.href,box=scroller.getBoundingClientRect(),rect={x:box.x,y:box.y,width:box.width,height:box.height};
   const baseline:TrackerAScalar={pageNowMs:performance.now(),url:originalURL,sameOriginalScroller:true,connected:scroller.isConnected,uniqueSelector:true,innerWidth,innerHeight,devicePixelRatio,rect,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight};
   const wheelEvents:PilotWheel[]=[],scrollEvents:PilotScroll[]=[],motionEvents:PilotMotion[]=[],overflows:ReturnType<PilotPageState['drain']>['overflows']={wheel:null,scroll:null,motion:null};
   let wheelCount=0,scrollCount=0,motionCount=0,drainAttempted=false;
   const contained=(target:EventTarget|null)=>target instanceof Node&&(target===scroller||scroller.contains(target));
   const wheel=(event:WheelEvent)=>{if(wheelCount>=40){if(overflows.wheel===null)overflows.wheel={ordinal:41};return;}const ordinal=++wheelCount;wheelEvents.push({ordinal,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,isTrusted:event.isTrusted,deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,targetContained:contained(event.target),currentTargetIsScroller:event.currentTarget===scroller});};
   const scroll=(event:Event)=>{if(scrollCount>=256){if(overflows.scroll===null)overflows.scroll={ordinal:257};return;}const ordinal=++scrollCount;scrollEvents.push({ordinal,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,currentTargetIsScroller:event.currentTarget===scroller,scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight});};
   const motion=(kind:'animationstart'|'transitionrun',event:Event)=>{if(motionCount>=32){if(overflows.motion===null)overflows.motion={ordinal:33};return;}const ordinal=++motionCount;motionEvents.push({ordinal,kind,pageNowMs:performance.now(),eventTimeStampMs:event.timeStamp,targetContained:contained(event.target)});};
   const animationstart=(event:Event)=>motion('animationstart',event),transitionrun=(event:Event)=>motion('transitionrun',event);
   const names={wheel:{owner:scroller,callback:wheel as EventListener},scroll:{owner:scroller,callback:scroll},animationstart:{owner:document,callback:animationstart},transitionrun:{owner:document,callback:transitionrun}};
   const installed={wheel:false,scroll:false,animationstart:false,transitionrun:false},removed={wheel:false,scroll:false,animationstart:false,transitionrun:false};
   w.__copilotkitTrackerA={baseline,scalar(){
    const matches=document.querySelectorAll(selector),current=scroller.getBoundingClientRect(),url=location.href;
    const value:TrackerAScalar={pageNowMs:performance.now(),url,sameOriginalScroller:matches[0]===scroller,connected:scroller.isConnected,uniqueSelector:matches.length===1,innerWidth,innerHeight,devicePixelRatio,rect:{x:current.x,y:current.y,width:current.width,height:current.height},scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight};
    // Return actual finite observations; the sequencer retains them before guards.
    return value;
   },install(name){if(installed[name])throw Error('Original DOM listener already charged');installed[name]=true;const registration=names[name];registration.owner.addEventListener(name,registration.callback,{passive:true});return true;},remove(name){if(removed[name])throw Error('Original DOM removal already charged');removed[name]=true;const registration=names[name];registration.owner.removeEventListener(name,registration.callback);return installed[name];},drain(){if(drainAttempted)throw Error('Original page drain already charged');drainAttempted=true;return {wheelEvents:wheelEvents.slice(),scrollEvents:scrollEvents.slice(),motionEvents:motionEvents.slice(),overflows:{wheel:overflows.wheel,scroll:overflows.scroll,motion:overflows.motion}};}};
   return baseline;
  }),baselineOriginal);
  history.baseline=await original;
 },async dispose(){
  cleanupRequested=true;
  if(!cleanup){
   cleanup=(async()=>{
    const failures:unknown[]=[];
    if(baselineOriginal.promise)try{await baselineOriginal.promise;}catch(error){failures.push(error);}
    if(acquisition)try{await acquisition;}catch(error){failures.push(error);}
    if(trace){try{await trace.finish();}catch(error){failures.push(error);}const result=trace.snapshot();if(result.outcome.containment!=='verified'||result.outcome.capture.status!=='complete')failures.push(Error('Original trace containment incomplete'));}
    else if(sink){
     try{await sink.finish();}catch(error){failures.push(error);}
     const fsync=sink.fsync;if(fsync)try{await fsync;}catch(error){failures.push(error);}else failures.push(Error('Original sink fsync absent'));
     const fileClose=sink.fileClose;if(fileClose)try{await fileClose;}catch(error){failures.push(error);}else failures.push(Error('Original sink file close absent'));
    }
    if(session&&!trace){
     // Only sessions never handed to Task1 have native fallback cleanup.
     if(!detachAttempted)detach();
     if(detachOriginal)try{await detachOriginal;}catch(error){failures.push(error);}
     await publicClosed;
     if(publicCloseInstalled)try{await physicalOff();}catch(error){failures.push(error);}
    }else if(session&&trace){
     // A rejected bounded finish waiter does not release Task1 ownership.
     // Observe only already-retained originals; never dispatch an unledgered
     // detach or remove the callback ahead of Task1's pending IO/sink cleanup.
     // The private signal is coordination only, never original outcome evidence.
     // A missing quota-admitted detach leaves this chain pending, not successful.
     if(!consumerAttempted&&!consumerEverBound&&trace.snapshot().listeners.sessionClose.registration.status==='not-started')await detachInvoked;
     if(detachOriginal)try{await detachOriginal;}catch(error){failures.push(error);}
     if(detachAttempted)await publicClosed;
     // Cleanup permanently closed binding/start admission before any await.
     // Only this never-attempted/not-started callback remains native-owned.
     // Detach is already Task1's fulfilled original; this exception is OFF only.
     const registration=trace.snapshot().listeners.sessionClose.registration;
     if(cleanupRequested&&!consumerAttempted&&!consumerEverBound&&registration.status==='not-started'&&detachStatus==='fulfilled'&&firstSessionCloseMatch===true&&publicCloseInstalled){try{await physicalOff();}catch(error){failures.push(error);}}
    }
    for(const name of ['wheel','scroll','animationstart','transitionrun','navigation','contextClose','pageClose'] as const){const row=registrations[name];if(row.installAttempted){try{await listeners[name].remove();}catch(error){failures.push(error);}if(row.installOriginal)try{await row.installOriginal;}catch(error){failures.push(error);}}}
    if(drained&&drainOriginal.promise)try{await drainOriginal.promise;}catch(error){failures.push(error);}
    if(!drained||drainOriginal.status!=='fulfilled')failures.push(Error('Original input drain incomplete'));
    // Keep private originals/diagnostic views alive through final cleanup.
    void targetDiagnostic;void frameDiagnostic;void sessionOriginal;void targetOriginal;void frameOriginal;
    if(failures.length)throw Error('Original pilot cleanup incomplete',{cause:failures});
   })();void cleanup.catch(()=>{});
  }
  await boundedWait(cleanup,Math.max(0,Math.min(1000,ports.deadline-performance.now())),'Original pilot trace cleanup');
 }};
}
