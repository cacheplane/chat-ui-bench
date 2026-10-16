/** Hosted SOURCE adapter, never invoked by local tests or STATIC inspection. */
import {runMountedConformance,mountedPrerequisitesAccepted,createMountedSnapshotReader,type MountedPrerequisites,type MountedConformanceResult,type MountedCaseOwner,type JourneyObservations} from './mounted-conformance.ts';
import {evaluateMountedOriginPolicy,MOUNTED_CASE_WITNESS_LABELS,type CaseRecord,type Witness,type OriginLease,type OriginalStatus} from '../../../tests/support/hosted-copilot-mounted-policy.ts';
import {assertProductionOutputInventory,ordinaryPath,type FileFact} from '../../../tests/support/hosted-copilot-contract.ts';
import type {NativeCaseObservation,NativeCaseWitness} from './ownership.ts';
import {boundedWait} from './ownership.ts';
import type {GeometrySnapshot} from '../src/geometry.ts';
import type {OwnedFrontendHost} from '../src/host.ts';

export interface NativeMountedOptions {prerequisites:MountedPrerequisites;browserEndpoint:string;assets:Readonly<{root:string;files:readonly FileFact[]}>}
export interface NativeMountedResult extends MountedConformanceResult {originals:readonly Witness[];browserVersion:string|null;caseEvidence:readonly CaseRecord[]}
/** Caller bootstrap must authenticate source/provider/archive/physical graph
 * BEFORE importing the emitted worker. These policies remain supplied-data only. */
export async function runNativeMountedConformance(options:NativeMountedOptions):Promise<NativeMountedResult>{
 const p=options.prerequisites;
 if(!mountedPrerequisitesAccepted(p))
  throw Error('Native prerequisites denied before SDK imports');
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
 const result=await runMountedConformance(p,{
  async connect(){
   checkDeadline();browser=await chromium.connect(options.browserEndpoint,{timeout:30000});
   // Public event and close promise remain distinct originals.
   disconnect=new Promise<void>(resolve=>browser!.once('disconnected',()=>{markGlobal('clientDisconnected');resolve();}));
   if(!browser.isConnected())throw Error('Original browser disconnected before bind');browserVersion=browser.version();markGlobal('browserConnect');
  },
  async openCase(journey,number):Promise<MountedCaseOwner>{
   checkDeadline();if(!browser)throw Error('No original browser');
   const fixture=contract.createLongThreadFixture({historyCount:100,responseBytes:6400,journey,seed:1});
   const ids={threadId:`native-thread-${number}`,seedRunId:`native-seed-${number}`,continuationRunId:`native-continuation-${number}`,responseId:fixture.events[0]!.messageId};
   const repetition=`native-repetition-${number}`;
   const witnesses:{label:string;status:OriginalStatus}[]=MOUNTED_CASE_WITNESS_LABELS.map(label=>({label,status:'pending'}));
   const mark=(label:NativeCaseWitness)=>{const w=witnesses.find(x=>x.label===label)!;if(w.status!=='pending')throw Error('Duplicate original witness');w.status='fulfilled';};
   let history:readonly OriginLease[]=[],leases:readonly OriginLease[]=[],recordingFailed=false,localClosed=false;
   let page:import('playwright').Page|undefined,context:import('playwright').BrowserContext|undefined;
   let remoteAdmission:Promise<void>|undefined,originalClose:Promise<CaseRecord>|undefined,completed=false,publicIdle=false;
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
   return {
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
     mark('mountedACK');return read();
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
    close(){if(originalClose)return originalClose;originalClose=(async()=>{try{await server.close();if(recordingFailed)throw Error('Native observation failed');return rawRecord();}finally{caseEvidence.push(rawRecord());}})();return originalClose;}
   };
  },
  async closeClient(){if(browser){const original=browser.close();await boundedWait(original,10000,'Original browser client close');markGlobal('clientClose');if(!disconnect)throw Error('Original disconnect listener absent');await boundedWait(disconnect,10000,'Original browser disconnect');}}
 });
 return {...result,originals,browserVersion,caseEvidence};
}
