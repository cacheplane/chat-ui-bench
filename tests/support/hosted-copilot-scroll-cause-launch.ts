/** Fixed diagnostic launch ownership. Imports are inert; no SDK/browser at module load. */
import {constants,createWriteStream} from 'node:fs';
import {open,realpath,lstat,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,type ChildProcess} from 'node:child_process';
import {diagnosticRecord,diagnosticHash,diagnosticRef,readDiagnosticPhysical,readDiagnosticRole,writeDiagnosticRole,writeDiagnosticJson,parseDiagnosticJson,captureDiagnosticCommand,assertDiagnosticCommandClosure,encodeDiagnosticFooter,parseDiagnosticFooter,packDiagnosticFrontend,publishDiagnosticInventory,verifyDiagnosticInventory,cleanDiagnosticEnvironment,SCROLL_CAUSE_ROLE_CAPS,type DiagnosticRole} from './hosted-copilot-scroll-cause-artifact.ts';
import {buildScrollCauseFrontend,buildScrollCauseWorker,diagnosticSourcePin,diagnosticFrontendInventory,validateDiagnosticInstalledPackages} from './hosted-copilot-scroll-cause-build.ts';
import {reverseScrollCause,type ScrollCauseTransform} from './hosted-copilot-scroll-cause-transform.ts';
import {copyHistoryReadinessDiagnostic,type RestoredHistoryDiagnosticPort} from '../../apps/copilotkit/src/geometry.ts';
import type {NativeMountedScrollCauseOptions,NativeMountedScrollCausePublication} from '../../apps/copilotkit/runtime/mounted-native.ts';
export const SCROLL_CAUSE_RELEASE='hosted-copilot-react-scroll-cause-v1';
function need(ok:unknown,code='diagnostic-launch-refused'):asserts ok{if(!ok)throw Error(code);}
export function selectScrollCauseHostedContext(value:unknown){
 const c=diagnosticRecord(value,['sourceSha','checkoutSha','tagSha','githubSha','workflowSha','repository','runId','attempt','ref','workflowRef','event','actions','platform','runner','node','npm','execArgv']);
 need(typeof c.sourceSha==='string'&&/^[a-f0-9]{40}$/.test(c.sourceSha)&&['checkoutSha','tagSha','githubSha','workflowSha'].every(k=>c[k]===c.sourceSha),'diagnostic-source-context');
 need(c.repository==='cacheplane/chat-ui-bench'&&typeof c.runId==='string'&&/^[1-9][0-9]{0,19}$/.test(c.runId)&&c.attempt==='1'&&c.ref==='refs/tags/'+SCROLL_CAUSE_RELEASE&&c.workflowRef===`cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-scroll-cause.yml@refs/tags/${SCROLL_CAUSE_RELEASE}`&&c.event==='workflow_dispatch'&&c.actions==='true'&&c.platform==='linux'&&c.runner==='Linux'&&c.node==='v24.20.0'&&c.npm==='11.19.0'&&JSON.stringify(c.execArgv)==='["--experimental-import-meta-resolve"]','diagnostic-hosted-context');
 return {sourceSha:c.sourceSha,runId:c.runId};
}
/** No network/provider query: supplied Actions context plus fresh original Git outputs. */
export async function checkScrollCauseHostedContext(root:string){
 need(resolve(root)===root&&await realpath(root)===root,'diagnostic-checkout-path');
 const originals:{argv:string[];exitCode:0;signal:null;stdout:{bytes:number;sha256:string;text:string};stderr:{bytes:number;sha256:string;text:string};coverage:string}[]=[];
 const capture=(argv:string[],env:Record<string,string>)=>{const r=spawnSync(argv[0]!,argv.slice(1),{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:262144,timeout:10000,env});need(r.error===undefined&&r.status===0&&r.signal===null&&r.stdout.length<=262144&&r.stderr.length<=262144,'diagnostic-source-command');const stream=(raw:Buffer)=>({bytes:raw.length,sha256:diagnosticHash(raw),text:new TextDecoder('utf-8',{fatal:true}).decode(raw)});originals.push({argv,exitCode:0,signal:null,stdout:stream(r.stdout),stderr:stream(r.stderr),coverage:'synchronous-command-return; descendants-unqualified'});return originals.at(-1)!.stdout.text.trim();};
 const git=(args:string[])=>capture(['git',...args],{PATH:'/usr/bin:/bin'});
 const checkoutSha=git(['rev-parse','HEAD']),treeSha=git(['rev-parse','HEAD^{tree}']),tagSha=git(['rev-parse','--verify',`refs/tags/${SCROLL_CAUSE_RELEASE}^{commit}`]),status=git(['status','--porcelain=v1','--untracked-files=all']);need(status==='','diagnostic-clean-checkout');
 const npmCli=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');await readDiagnosticPhysical(npmCli,262144);
 const context={sourceSha:process.env.SCROLL_CAUSE_SOURCE_SHA,checkoutSha,tagSha,githubSha:process.env.GITHUB_SHA,workflowSha:process.env.GITHUB_WORKFLOW_SHA,repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,ref:process.env.GITHUB_REF,workflowRef:process.env.GITHUB_WORKFLOW_REF,event:process.env.GITHUB_EVENT_NAME,actions:process.env.GITHUB_ACTIONS,platform:process.platform,runner:process.env.RUNNER_OS,node:process.version,npm:capture([process.execPath,npmCli,'--version'],{PATH:dirname(process.execPath)+':/usr/bin:/bin'}),execArgv:process.execArgv};
 const selected=selectScrollCauseHostedContext(context),lock=await readDiagnosticPhysical(join(root,'package-lock.json'),16777216);need(/^[a-f0-9]{40}$/.test(treeSha),'diagnostic-tree');
 return {source:{commitSha:selected.sourceSha,treeSha,lockSha256:lock.sha256},run:{repository:'cacheplane/chat-ui-bench' as const,runId:selected.runId,attempt:1 as const,tag:SCROLL_CAUSE_RELEASE as typeof SCROLL_CAUSE_RELEASE},context,git:{checkoutSha,treeSha,tagSha,porcelain:status,originals},qualification:false};
}
export interface DiagnosticRawState {attempted:boolean;created:boolean;closed:boolean}
/** Same original sequential sink ownership, separately named and bounded. */
export async function reserveDiagnosticTrace(directory:string,state:DiagnosticRawState){
 need(!state.attempted,'diagnostic-raw-reserve-once');state.attempted=true;need(await realpath(directory)===directory,'diagnostic-raw-directory');
 const handle=await open(join(directory,'tracker-a-case-2-trace.json'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);state.created=true;
 let retained=0,writing=false,failed=false,lastWrite:Promise<void>=Promise.resolve(),finished:Promise<{path:'tracker-a-case-2-trace.json';bytes:number;sha256:string}>|null=null;
 const sink:{created:true;fsync:Promise<void>|null;fileClose:Promise<void>|null;write(bytes:Uint8Array):Promise<void>;finish():Promise<{path:'tracker-a-case-2-trace.json';bytes:number;sha256:string}>}={created:true,fsync:null,fileClose:null,
  write(bytes){if(finished||writing||failed||!(bytes instanceof Uint8Array)||!bytes.length||retained+bytes.length>33554432)return Promise.reject(Error('diagnostic-raw-write'));retained+=bytes.length;writing=true;lastWrite=handle.writeFile(bytes).then(()=>{writing=false;},()=>{writing=false;failed=true;throw Error('diagnostic-raw-write');});void lastWrite.catch(()=>{});return lastWrite;},
  finish(){if(finished)return finished;finished=(async()=>{await lastWrite.catch(()=>{failed=true;});sink.fsync=handle.sync();try{await sink.fsync;}catch{failed=true;}finally{sink.fileClose=handle.close().then(()=>{state.closed=true;});try{await sink.fileClose;}catch{failed=true;}}
   need(!failed,'diagnostic-raw-writer');const f=await readDiagnosticRole(directory,'tracker-a-case-2-trace.json');need(f.bytes===retained,'diagnostic-raw-byte-join');return {path:'tracker-a-case-2-trace.json',bytes:f.bytes,sha256:f.sha256};})();void finished.catch(()=>{});return finished;},
 };return sink;
}
/** Post-bind public stdio only. Protocol pipes are never read or written. */
export function observeDiagnosticBrowserStdio(directory:string,child:ChildProcess){
 const rows:{index:number;kind:'stdout'|'stderr'|'protocol';attached:true;coverage:'post-bind-only';status:'pending'|'fulfilled'|'rejected';readableEOF:boolean|null;writerFinish:boolean|null;writerClose:boolean|null;writerError:boolean|null;overflow:boolean|null;seen:number|null;retained:number|null}[]=[],closed:Promise<void>[]=[];
 for(const [index,stream] of child.stdio.entries()){
  if(index===0||stream==null)continue;need(index<8,'diagnostic-browser-stdio-count');const kind:'stdout'|'stderr'|'protocol'=index===1?'stdout':index===2?'stderr':'protocol';
  const row={index,kind,attached:true as const,coverage:'post-bind-only' as const,status:'pending' as 'pending'|'fulfilled'|'rejected',readableEOF:kind==='protocol'?null:false,writerFinish:kind==='protocol'?null:false,writerClose:kind==='protocol'?null:false,writerError:kind==='protocol'?null:false,overflow:kind==='protocol'?null:false,seen:kind==='protocol'?null:0,retained:kind==='protocol'?null:0};rows.push(row);
  if(stream.destroyed||stream.closed)continue;
  if(kind==='protocol'){closed.push(new Promise(done=>stream.once('close',()=>{row.status='fulfilled';done();})));continue;}
  need('readableEnded'in stream&&!stream.readableEnded,'diagnostic-browser-already-ended');
  const readable=stream as NodeJS.ReadableStream,sink=createWriteStream(join(directory,`browser-${kind}.bin`),{flags:'wx',mode:0o600,flush:true});
  closed.push(new Promise(done=>sink.once('close',()=>{row.writerClose=true;row.status=row.readableEOF&&row.writerFinish&&!row.writerError&&!row.overflow&&row.seen===row.retained?'fulfilled':'rejected';done();})));
  sink.once('finish',()=>{row.writerFinish=true;});sink.on('error',()=>{row.writerError=true;readable.resume();});
  readable.on('data',(raw:Buffer)=>{row.seen!+=raw.length;if(row.seen!>262144)row.overflow=true;const kept=raw.subarray(0,Math.max(0,262144-row.retained!));if(!row.writerError){row.retained!+=kept.length;if(kept.length&&!sink.write(kept)){readable.pause();sink.once('drain',()=>readable.resume());}}});
  readable.once('end',()=>{row.readableEOF=true;sink.end();});readable.once('error',()=>{row.writerError=true;sink.end();});readable.once('close',()=>{if(!row.readableEOF){row.writerError=true;sink.end();}});
 }
 return {rows,closed:()=>Promise.all(closed)};
}

const COMPONENTS=Object.freeze(['package.json','package-lock.json','.github/workflows/hosted-copilot-scroll-cause.yml','tools/hosted-copilot-scroll-cause.mjs','apps/copilotkit/vite.scroll-cause.config.ts','apps/copilotkit/hosted-scroll-cause-entry.ts','apps/copilotkit/index.html','apps/copilotkit/src/main.tsx','apps/copilotkit/src/scroll-cause-main.ts','apps/copilotkit/src/scroll-cause-frontend.ts','apps/copilotkit/src/scroll-cause-diagnostic.ts','apps/copilotkit/runtime/mounted-native.ts','apps/copilotkit/runtime/mounted-tracker-a.ts','apps/copilotkit/runtime/mounted-tracker-a-trace.ts','tests/support/hosted-copilot-scroll-cause-transform.ts','tests/support/hosted-copilot-scroll-cause-build.ts','tests/support/hosted-copilot-scroll-cause-artifact.ts','tests/support/hosted-copilot-scroll-cause-launch.ts','tests/support/hosted-copilot-worker-static-policy.ts','tests/support/hosted-copilot-build-plugin.ts']);
const authority={qualification:false,nativeGO:false,performance:false,fps:'unavailable'} as const;
const gate={protocol:'tracker-a-wheel-handler-after-gate-v1',maxGates:40,entry:'unchanged',arm:'measured-before-existing-evaluate',wait:'measured-after-existing-evaluate',event:'same-original-wheel-listener'} as const;
const anchor={protocol:'tracker-a-anchor-scalars-v1',role:'tracker-a-anchor-scalars-v1.json',cap:65536,maxObservations:82,g1Purpose:'tracker-a-G1-anchor-diagnostic-v1',metric:'min-positive-text-rect-viewport-y'} as const;
const record=(v:unknown)=>{need(v!==null&&typeof v==='object'&&!Array.isArray(v),'diagnostic-data');return v as Record<string,unknown>;};
async function roleJson(directory:string,path:DiagnosticRole){return record(parseDiagnosticJson((await readDiagnosticRole(directory,path)).raw));}
async function roleRef(directory:string,path:DiagnosticRole){return diagnosticRef(await readDiagnosticRole(directory,path));}
function command(root:string,action:'parent'|'child'){return [process.execPath,'--experimental-import-meta-resolve',join(root,'tools/hosted-copilot-scroll-cause.mjs'),action];}
async function sourcePins(root:string){return COMPONENTS.map(path=>diagnosticSourcePin(root,path));}
async function verifyPins(root:string,pins:unknown){need(Array.isArray(pins)&&pins.length<=256,'diagnostic-module-pins');for(const row of pins){const p=record(row);need(typeof p.path==='string','diagnostic-source-pin');const actual=diagnosticSourcePin(root,p.path);need(actual.bytes===p.bytes&&actual.sha256===p.sha256,'diagnostic-source-changed');}}
async function buildDiagnostic(root:string,directory:string,workspace:string,current:Awaited<ReturnType<typeof checkScrollCauseHostedContext>>){
 await mkdir(directory);await mkdir(workspace);const components=await sourcePins(root);await writeDiagnosticJson(directory,'diagnostic-source.json',{...current,components,scope:'hosted-checkout-and-diagnostic-components',...authority});
 const recipe=await writeDiagnosticJson(directory,'diagnostic-profile.json',{schemaVersion:1,kind:'unqualified-scroll-cause-prebuild-recipe',source:current.source,run:current.run,protocol:'scroll-cause-attribution-v1',strictMode:'tracker-json-a-pilot-v2',limits:SCROLL_CAUSE_ROLE_CAPS,components,build:{frontendConfig:'apps/copilotkit/vite.scroll-cause.config.ts',workerEntry:'apps/copilotkit/hosted-scroll-cause-entry.ts',namedEntry:'scroll-cause-main.ts',originalLaunchCalls:1},...authority});
 await validateDiagnosticInstalledPackages(root);const frontend=await buildScrollCauseFrontend(root,workspace),worker=await buildScrollCauseWorker(root,current.run.runId);
 await verifyPins(root,components);const launchPath=join(root,worker.launchPath),original=await readDiagnosticPhysical(launchPath,16777216);need(original.bytes===worker.bytes&&original.sha256===worker.sha256,'diagnostic-worker-source');
 const copied=await writeDiagnosticRole(directory,'diagnostic-worker.mjs',original.raw),again=await readDiagnosticPhysical(launchPath,16777216);need(again.sha256===copied.sha256&&JSON.stringify(again.identity)===JSON.stringify(original.identity),'diagnostic-worker-copy-changed');
 const transform=await writeDiagnosticJson(directory,'diagnostic-transform.json',frontend.transform);
 const inventory=await writeDiagnosticJson(directory,'diagnostic-frontend-inventory.json',{source:current.source,run:current.run,files:frontend.inventory.files,bytes:frontend.inventory.bytes,...authority});
 const archive=await writeDiagnosticRole(directory,'diagnostic-frontend.zip',await packDiagnosticFrontend(join(workspace,'dist'),frontend.inventory.files));
 need(new Set([...frontend.modules,...worker.modules].map(row=>row.path)).size<=256,'diagnostic-combined-module-bound');
 const modules=await writeDiagnosticJson(directory,'diagnostic-module-pins.json',{schemaVersion:1,kind:'unqualified-scroll-cause-module-pins',coverage:'diagnostic-owned-and-instrumented-modules',fullDependencyGraph:'unqualified',components,frontend:frontend.modules,worker:worker.modules,packages:worker.packages,imports:worker.imports,importGuard:worker.importGuard,compilerDependencies:worker.compilerDependencies,bundledDependencyModules:worker.bundledDependencyModules,sharedObserver:frontend.sharedObserver,html:frontend.html,emittedChunks:frontend.emittedChunks,...authority});
 const receipt=await writeDiagnosticJson(directory,'diagnostic-build.json',{schemaVersion:1,kind:'unqualified-scroll-cause-build',source:current.source,run:current.run,profilePath:'diagnostic-profile.json',profileSha256:recipe.sha256,compiler:frontend.compiler,transform:{originalPath:'node_modules/@tanstack/virtual-core/dist/esm/index.js',originalBytes:54156,originalSha256:frontend.transform.originalSha256,transformedSha256:frontend.transform.transformedSha256,observerPath:'apps/copilotkit/src/scroll-cause-frontend.ts',observerSha256:diagnosticSourcePin(root,'apps/copilotkit/src/scroll-cause-frontend.ts').sha256,insertionsRef:diagnosticRef(transform)},frontend:{inventoryRef:diagnosticRef(inventory),archiveRef:diagnosticRef(archive)},worker:{launchPath,launchFileUrl:worker.launchFileUrl,artifactPath:'diagnostic-worker.mjs',bytes:worker.bytes,sha256:worker.sha256,modulePinsRef:diagnosticRef(modules)},...authority});
 await writeDiagnosticJson(directory,'tracker-a-profile.json',{schemaVersion:1,kind:'unqualified-scroll-cause-tracker-profile',source:current.source,run:current.run,strictMode:'tracker-json-a-pilot-v2',recipeRef:diagnosticRef(recipe),buildRef:diagnosticRef(receipt),wheelHandlerAfterGate:gate,anchorDiagnostic:anchor,attribution:{protocol:'scroll-cause-attribution-v1',exportTimeoutMs:2000},...authority});
 await authenticateDiagnosticBuild(root,directory,current);
}
async function authenticateDiagnosticBuild(root:string,directory:string,current:Awaited<ReturnType<typeof checkScrollCauseHostedContext>>){
 await validateDiagnosticInstalledPackages(root);const build=await roleJson(directory,'diagnostic-build.json'),source=await roleJson(directory,'diagnostic-source.json'),modules=await roleJson(directory,'diagnostic-module-pins.json'),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 need(same(build.source,current.source)&&same(build.run,current.run)&&same(source.source,current.source)&&same(source.run,current.run),'diagnostic-build-context');need(same(source.components,await sourcePins(root))&&same(modules.components,source.components),'diagnostic-component-closure');await verifyPins(root,source.components);for(const lane of ['frontend','worker','packages'])await verifyPins(root,modules[lane]);
 diagnosticRecord(build,['schemaVersion','kind','source','run','profilePath','profileSha256','compiler','transform','frontend','worker','qualification','nativeGO','performance','fps']);need(build.schemaVersion===1&&build.kind==='unqualified-scroll-cause-build'&&build.qualification===false&&build.nativeGO===false&&build.performance===false&&build.fps==='unavailable','diagnostic-build-schema');
 const frontend=record(build.frontend),worker=record(build.worker),assetRoot=join(process.env.RUNNER_TEMP!,`copilot-scroll-cause-build-${current.run.runId}-1/dist`);need(typeof worker.launchPath==='string'&&worker.launchPath===join(root,'apps/copilotkit/artifacts/scroll-cause',current.run.runId+'-1/worker.mjs')&&worker.launchFileUrl===pathToFileURL(worker.launchPath).href,'diagnostic-worker-layout');
 const launch=await readDiagnosticPhysical(worker.launchPath,16777216),copy=await readDiagnosticRole(directory,'diagnostic-worker.mjs');need(launch.sha256===worker.sha256&&launch.bytes===worker.bytes&&copy.sha256===launch.sha256&&copy.bytes===launch.bytes,'diagnostic-worker-original-copy');
 const expected=await roleJson(directory,'diagnostic-frontend-inventory.json'),actual=await diagnosticFrontendInventory(assetRoot);need(same(actual.files,expected.files),'diagnostic-served-assets');
 const transform=record(build.transform),original=await readDiagnosticPhysical(join(root,'node_modules/@tanstack/virtual-core/dist/esm/index.js'),262144);need(transform.originalPath==='node_modules/@tanstack/virtual-core/dist/esm/index.js'&&transform.originalBytes===original.bytes&&transform.originalSha256===original.sha256&&transform.observerPath==='apps/copilotkit/src/scroll-cause-frontend.ts'&&transform.observerSha256===diagnosticSourcePin(root,'apps/copilotkit/src/scroll-cause-frontend.ts').sha256,'diagnostic-transform-source');
 const insertion=await roleJson(directory,'diagnostic-transform.json'),reversed=reverseScrollCause(insertion as unknown as ScrollCauseTransform);need(diagnosticHash(reversed)===original.sha256&&transform.transformedSha256===insertion.transformedSha256,'diagnostic-transform-reversal');
 for(const [value,path] of [[frontend.inventoryRef,'diagnostic-frontend-inventory.json'],[frontend.archiveRef,'diagnostic-frontend.zip'],[worker.modulePinsRef,'diagnostic-module-pins.json'],[transform.insertionsRef,'diagnostic-transform.json']] as const)need(same(value,await roleRef(directory,path)),'diagnostic-build-reference');
 need(build.profilePath==='diagnostic-profile.json'&&build.profileSha256===(await roleRef(directory,'diagnostic-profile.json')).sha256,'diagnostic-recipe-reference');
 const tracker=await roleJson(directory,'tracker-a-profile.json');need(same(tracker.recipeRef,await roleRef(directory,'diagnostic-profile.json'))&&same(tracker.buildRef,await roleRef(directory,'diagnostic-build.json'))&&same(tracker.source,current.source)&&same(tracker.run,current.run),'diagnostic-tracker-reference');
 return {build,worker,assets:{root:assetRoot,files:actual.files}};
}
function historyDiagnostics():RestoredHistoryDiagnosticPort{
 const used=new Set<number>();let writing=false;const history=Array.from({length:100},(_,i)=>({id:`history-${i}`,role:i%2===0?'assistant' as const:'user' as const}));
 return {async emitReadinessSummary(value){const d=Object.getOwnPropertyDescriptor(value,'caseNumber'),number=d&&'value'in d?d.value:undefined;need(number===1||number===2,'diagnostic-readiness-case');const copied=copyHistoryReadinessDiagnostic(value,{caseNumber:number,journey:number===1?'follow':'history-reading',threadId:`native-thread-${number}`,history});const raw=Buffer.from(JSON.stringify(copied)+'\n');need(raw.length<=4096&&!writing&&!used.has(number)&&used.size<2,'diagnostic-readiness-once');used.add(number);writing=true;try{await new Promise<void>((done,fail)=>process.stdout.write(raw,error=>error?fail(error):done()));}finally{writing=false;}}};
}
async function childDiagnostic(root:string,directory:string,current:Awaited<ReturnType<typeof checkScrollCauseHostedContext>>){
 const loaded=await authenticateDiagnosticBuild(root,directory,current),endpoint=process.env.SCROLL_CAUSE_ENDPOINT;need(typeof endpoint==='string'&&/^ws:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\//.test(endpoint),'diagnostic-browser-endpoint');
 const profile=await roleRef(directory,'tracker-a-profile.json'),rawState={attempted:false,created:false,closed:false};
 const imported=await import(loaded.worker.launchFileUrl as string) as typeof import('../../apps/copilotkit/hosted-scroll-cause-entry.ts');need(typeof imported.runNativeMountedScrollCauseDiagnostic==='function'&&typeof imported.projectScrollCauseEvidence==='function','diagnostic-worker-exports');
 const publication:NativeMountedScrollCausePublication={profileRef:{...profile,path:'tracker-a-profile.json'},wheelHandlerAfterGate:gate,anchorDiagnostic:anchor,reserveTraceSink:()=>reserveDiagnosticTrace(directory,rawState),attribution:{protocol:'scroll-cause-attribution-v1',exportTimeoutMs:2000}};
 const options:NativeMountedScrollCauseOptions={kind:'scroll-cause-diagnostic-options',schemaVersion:1,source:current.source,run:current.run,browserEndpoint:endpoint,assets:loaded.assets,buildRef:{...await roleRef(directory,'diagnostic-build.json'),path:'diagnostic-build.json'}};
 const result=await imported.runNativeMountedScrollCauseDiagnostic(options,historyDiagnostics(),publication),projection=imported.projectScrollCauseEvidence(result,publication.profileRef);
 for(const row of projection.cases)await writeDiagnosticJson(directory,`native-case-${row.caseNumber}.json`,row.value);
 for(const [path,value] of [['tracker-a-case-2-input.json',projection.input],['tracker-a-case-2-transport.json',projection.transport],['scroll-cause-ledger.json',projection.ledger],['scroll-cause-export.json',projection.exportOriginal]] as const)if(value!==null)await writeDiagnosticJson(directory,path,value);
 const strict=await writeDiagnosticJson(directory,'diagnostic-strict-result.json',projection.strictResult);
 if(projection.firstFailure!==null)await writeDiagnosticJson(directory,'diagnostic-first-failure.json',{schemaVersion:1,kind:'unqualified-scroll-cause-first-failure',source:current.source,run:current.run,diagnosticStrictResultRef:diagnosticRef(strict),firstFailure:projection.firstFailure,...authority});
 await authenticateDiagnosticBuild(root,directory,current);need(!rawState.created||rawState.closed,'diagnostic-raw-still-open');
 const footer=encodeDiagnosticFooter({protocol:'scroll-cause-child-publication-v1',source:current.source.commitSha,run:current.run.runId,rawTrace:{created:rawState.created,closed:rawState.closed},strictResultRef:diagnosticRef(strict)});await new Promise<void>((done,fail)=>process.stdout.write(footer,error=>error?fail(error):done()));
 if(result.strict.status!=='complete'||result.strict.hasPrimary)process.exitCode=2;
}
async function parentDiagnostic(root:string,directory:string,current:Awaited<ReturnType<typeof checkScrollCauseHostedContext>>){
 await authenticateDiagnosticBuild(root,directory,current);const clean=cleanDiagnosticEnvironment();for(const key of Object.keys(process.env))if(!Object.hasOwn(clean,key))delete process.env[key];Object.assign(process.env,clean);
 const {chromium}=await import('playwright');const server=await chromium.launchServer({headless:true,host:'127.0.0.1',port:0});let eventStatus='pending',promiseStatus='not-started',failed=false,strictFailed=false,childPublication:unknown=null;
 const event=new Promise<void>(done=>server.once('close',()=>{eventStatus='fulfilled';done();})),browser=server.process();let stdio:ReturnType<typeof observeDiagnosticBrowserStdio>|undefined;
 try{
  stdio=observeDiagnosticBrowserStdio(directory,browser);const registry=await readDiagnosticPhysical(join(root,'node_modules/playwright-core/browsers.json'),262144);await writeDiagnosticRole(directory,'diagnostic-browser-registry.json',registry.raw);
  const commandResult=await captureDiagnosticCommand(directory,'application',command(root,'child'),150000,{SCROLL_CAUSE_SOURCE_SHA:current.source.commitSha,SCROLL_CAUSE_ENDPOINT:server.wsEndpoint()});
  const stdout=await readDiagnosticRole(directory,'application.stdout'),stderr=await readDiagnosticRole(directory,'application.stderr');assertDiagnosticCommandClosure(await roleJson(directory,'application-started.json'),commandResult,{stdout,stderr},command(root,'child'));
  childPublication=parseDiagnosticFooter(stdout.raw,{source:current.source.commitSha,run:current.run.runId,strictResultRef:await roleRef(directory,'diagnostic-strict-result.json')});need(!commandResult.timedOut&&!commandResult.terminationRequested&&commandResult.close.signal===null&&[0,2].includes(commandResult.close.exitCode!),'diagnostic-child-infrastructure');strictFailed=commandResult.close.exitCode===2;
 }catch{failed=true;}
 finally{promiseStatus='pending';try{await server.close();promiseStatus='fulfilled';}catch{promiseStatus='rejected';failed=true;}await event;await stdio?.closed();}
 await writeDiagnosticJson(directory,'diagnostic-browser-process.json',{source:current.source,run:current.run,pid:browser.pid??null,spawnfile:browser.spawnfile,spawnargs:browser.spawnargs,configuredExecutablePath:chromium.executablePath(),registryRef:await roleRef(directory,'diagnostic-browser-registry.json'),launchProfile:{headless:true,host:'127.0.0.1',port:0},coverage:'post-bind-only',binaryByteIdentity:'unestablished',descendants:'unqualified',closePromise:promiseStatus,closeEvent:eventStatus,stdio:stdio?.rows??[],childPublication,...authority});
 await authenticateDiagnosticBuild(root,directory,current);if(failed||!stdio||stdio.rows.some(row=>row.status!=='fulfilled'))process.exitCode=1;else if(strictFailed)process.exitCode=2;
}
/** Only this fixed action dispatcher is called by the tiny executable entry. */
export async function runScrollCauseAction(action:unknown){
 need(['preflight','build','run','parent','child','inventory','finalcheck'].includes(action as string),'diagnostic-action');const root=await realpath(process.cwd()),current=await checkScrollCauseHostedContext(root);if(action==='preflight')return;const temp=process.env.RUNNER_TEMP;need(typeof temp==='string'&&resolve(temp)===temp&&await realpath(temp)===temp,'diagnostic-temp');
 const directory=join(temp,`copilot-scroll-cause-${current.run.runId}-1`),workspace=join(temp,`copilot-scroll-cause-build-${current.run.runId}-1`);
 if(action==='build')return buildDiagnostic(root,directory,workspace,current);
 const loaded=await authenticateDiagnosticBuild(root,directory,current);
 if(action==='child')return childDiagnostic(root,directory,current);if(action==='parent')return parentDiagnostic(root,directory,current);
 if(action==='run'){const result=await captureDiagnosticCommand(directory,'parent',command(root,'parent'),210000,{SCROLL_CAUSE_SOURCE_SHA:current.source.commitSha});if(result.close.exitCode===2&&result.close.signal===null&&result.streamsComplete&&!result.timedOut&&!result.terminationRequested)process.exitCode=2;else if(result.close.exitCode!==0||result.close.signal!==null||!result.streamsComplete||result.timedOut||result.terminationRequested)process.exitCode=1;return;}
 const context={source:current.source,run:current.run,parentArgv:command(root,'parent'),childArgv:command(root,'child'),launchWorker:loaded.worker.launchPath as string};
 if(action==='inventory')await publishDiagnosticInventory(directory,context);else await verifyDiagnosticInventory(directory,context);
}
