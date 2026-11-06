import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const directory=new URL('./',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,directory),'utf8');
const candidate=new URL('matrix-case-competitor-trace-v3.mjs',directory);
// RED uses the actual previous case, so failure is a missing behavior, never a
// missing module or an attempted runtime import of a native engine.
const source=fs.existsSync(candidate)?fs.readFileSync(candidate,'utf8'):read('matrix-case-competitor-trace-v1.mjs');
const order=['create','setup','ack','finish','cleanup-stop','cleanup-seal','publish','stop'];
function seams(text){
 const blocks={},outside=[];let active=null,index=0;
 for(const line of text.match(/[^\n]*\n|[^\n]+$/g)??[]){
  if(line.includes('TRACE-V3')){
   const match=/^ \/\/ TRACE-V3-(BEGIN|END) ([a-z-]+)\n$/.exec(line);
   assert.ok(match,'exact whole-line marker');const [,kind,name]=match;
   if(kind==='BEGIN'){assert.equal(active,null,'no nested seam');assert.equal(name,order[index],'ordered unique seams');active=name;blocks[name]='';}
   else{assert.equal(name,active,'matched end');active=null;index++;}
  }else if(active)blocks[active]+=line;else outside.push(line);
 }
 assert.equal(active,null,'no open seam');assert.equal(index,8,'exact eight seams');
 return {blocks,outside:outside.join('')};
}
const native=text=>text.slice(text.indexOf('export async function runMatrixCase('),text.indexOf('\nexport async function runMatrixInvocation(')>-1?text.indexOf('\nexport async function runMatrixInvocation('):text.length);
const bridge=text=>text.slice(text.indexOf('async function installMatrixThreadplaneBridge('),text.indexOf('\nexport async function runMatrixCase('));
test('V3 diagnostic uses the closed semantic schema and flags',()=>{
 assert.match(source,/schema:'competitor-aimock-semantic-trace-case-v3'/);
 assert.match(source,/rawCapture:null,decoderOriginals:null,validation:null/);
 assert.match(source,/cpuTime:null/);
 assert.doesNotMatch(source,/validateAimockTraceV[12]|analyzeAimockTraceCostsV[12]/);
});
test('eight seam subtraction is exact native V5 bytes and unchanged bridge',()=>{
 const stripped=seams(source).outside,v5=read('matrix-run-v5.mjs');
 assert.equal(native(stripped),native(v5));assert.equal(bridge(source),bridge(v5));
 assert.equal(createHash('sha256').update(native(stripped)).digest('hex'),createHash('sha256').update(native(v5)).digest('hex'));
});
test('seam parser rejects nested, mismatched, duplicate, missing and ninth markers',()=>{
 const valid=order.map(name=>` // TRACE-V3-BEGIN ${name}\nx\n // TRACE-V3-END ${name}\n`).join('');
 assert.equal(Object.keys(seams(valid).blocks).length,8);
 for(const bad of [valid.replace('x\n',' // TRACE-V3-BEGIN setup\nx\n'),valid.replace('END create','END setup'),valid+valid,valid.replace(' // TRACE-V3-END stop\n',''),valid+' // TRACE-V3-BEGIN ninth\n // TRACE-V3-END ninth\n',valid.replace('BEGIN create','BEGIN create extra')])assert.throws(()=>seams(bad));
});
test('publisher binds actual stores, strict source/resource originals and five actual owner inputs',()=>{
 assert.match(source,/runAimockTraceDecoderOwnerV3\(\{identity:traceIdentity,store,artifacts,caseStarted:started,invocationStarted\}\)/);
 for(const literal of ['aimock-trace-v3-private.json','aimock-trace-v3-validation.json','aimock-trace-v3-decoder-originals.json','originalsClosedMs','startWitness','pendingOriginals','pendingWriters','unsafeWriter','successDeadlineMs','retainedPrefixBase64','completeSha256'])assert.ok(source.includes(literal),literal);
 assert.match(source,/await cleanupWait\(traceFinishAttention,STAGES.progress,'aimock-trace-before-browser-close'\)/);
 assert.match(source,/stockVersion:null,buildSha256:/);
 assert.doesNotMatch(source,/gunzip|inflate|node:child_process/);
});

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const clone=value=>JSON.parse(JSON.stringify(value));
const sha=value=>createHash('sha256').update(value).digest('hex');
const flags={performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
const policy={captureProfile:'semantic-task-layout-large-v3',flags,schemas:{receipt:'aimock-trace-capture-v3',raw:'aimock-semantic-large-raw-snapshot-v3',decoded:'aimock-semantic-large-decoded-v3',owner:'aimock-decoder-owner-v3',originals:'aimock-decoder-originals-v3',validation:'aimock-semantic-large-validation-evidence-v3'},config:{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',tracingBackend:'chrome',bufferUsageReportingInterval:1000,traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:16384,enableSampling:false,enableSystrace:false,includedCategories:['devtools.timeline','disabled-by-default-devtools.timeline']}}};
const policySha='a'.repeat(64);
const limits={caseMs:240000,invocationMs:1200000,cleanupMs:30000};
const stages={progress:10000,transcript:10000};
function deferred(){let resolve,reject;const original=new Promise((a,b)=>{resolve=a;reject=b;});return {original,resolve,reject};}
async function execute(text,ports){return new AsyncFunction(...Object.keys(ports),text)(...Object.values(ports));}
function base(profile='copilotkit'){
 const state={time:100,constructorCalls:0,guardCalls:[],reads:[],writes:[],ownerCalls:[],nativeWrites:0,stats:{pendingOriginals:0,pendingWriters:0,unsafeWriter:false}};
 const selection={profile,historyCount:10,responseBytes:100,journey:'history-reading'},slot={id:'case-1',selection};
 const build={schema:'authored-genuine-build',profile,packages:[{name:'example-sdk',version:'actual'}],assets:[{sha256:'d'.repeat(64)}]};
 const ports={...selection,slot,createHash,Buffer,TextDecoder,process:{pid:1001},started:0,invocationStarted:0,LIMITS:limits,STAGES:stages,TRACE_POLICY:policy,TRACE_POLICY_SHA256:policySha,
  performance:{now:()=>state.time},deadline:{remaining:()=>240000-state.time,check(){if(state.time>=240000)throw Error('case-deadline');}},
  wait:async original=>original,competitorStockProfileV1(profile){if(!['copilotkit','assistant-ui','vercel-ai-sdk'].includes(profile))throw Error('profile');return {profile,doNotHash:'pin'};},
  competitorBuildEvidenceV1:async profile=>{state.reads.push(profile);return clone(build);},
  waitCompetitorBuildOriginalV1:async(original,wait,ms,label)=>{state.guardCalls.push(label);return wait(original,ms,label);},
  createAimockTraceCaptureV3(options){state.constructorCalls++;state.options=options;return {setup:async()=>{},assertBeforeStart(){},markPublicAck(){},finish:async()=>{},beforeBrowserClose:()=>null,afterBrowserClose(){},seal:()=>state.snapshot};},
  browser:{},context:{},page:{},server:{origin:'http://127.0.0.1'},failure:null,unsafeOutstanding:false,result:{status:'matrix-pass',failure:null},
  store:{stats:()=>state.stats,readJSON:async ref=>clone(state.files.get(ref.path))},
  artifacts:{writeJSON:async(name,value,{kind})=>{state.writes.push({name,kind});const text=JSON.stringify(value),ref={path:slot.id+'/'+name,bytes:Buffer.byteLength(text),sha256:sha(text)};state.files.set(ref.path,clone(value));return ref;}},
  createAimockTraceRawEvidenceV3:snapshot=>clone(state.wrapper),
  runAimockTraceDecoderOwnerV3:async input=>{state.ownerCalls.push(input);return clone(state.owned);},
 };
 state.files=new Map();return {state,ports,build};
}
const snippets=()=>seams(source).blocks;
const tail=`return {trace,traceIdentity,traceBuild,traceFailure,tracePublicationStop,traceCleanupEnd,unsafeOutstanding,result,traceOperations};`;
const setupText=()=>snippets().create+snippets().setup;
function completeModel(model){
 const {state,ports,build}=model,id={id:ports.slot.id,...ports.slot.selection,stockVersion:null,buildSha256:sha(JSON.stringify(build))};
 const receiptLimits={compressedBytes:4194304,chunkBytes:65536,maxReads:4096,decodedBytes:67108864,receiptBytes:16384,wrapperOverheadBytes:65536,base64Characters:5592408,wrapperBytes:6291456,evidenceBytes:2097152};
 const kinds=['browser-session','page-session','frame-tree','target-info','trace-start','active-page-categories','trace-end','trace-complete','stream-drain','finish','io-read','io-close','page-detach','browser-detach'];
 const r={schema:policy.schemas.receipt,identity:id,nodeClock:'node-performance-relative-to-case-start',setupClock:{startedMs:0,deadlineMs:10000,budgetMs:10000},finishClock:{startedMs:10,deadlineMs:10010,budgetMs:10000},sealedMs:100,publicAckMs:5,config:clone(policy.config),limits:receiptLimits,protocolSupport:{stage:'active-page-categories',requested:clone(policy.config.traceConfig.includedCategories),supportedRequested:clone(policy.config.traceConfig.includedCategories),returnedCount:2,returnedSha256:sha('categories'),returnedFirst8:policy.config.traceConfig.includedCategories.map(text=>({text:text.slice(0,32),trueCharacters:text.length,truncated:text.length>32})),originalSettledMs:2,setupDeadlineMs:10000},inventory:{oneOwnedPage:true,mainFrameId:'frame',targetId:'target',documentURL:{text:'http://127.0.0.1',trueCharacters:16,truncated:false,sha256:sha('http://127.0.0.1')},origin:{text:'http://127.0.0.1',trueCharacters:16,truncated:false,sha256:sha('http://127.0.0.1')},browserVersion:{text:'fake',trueCharacters:4,truncated:false},rendererMapping:'unavailable-until-actual-trace-metadata'},startDispatched:true,startAcknowledged:true,stopDispatched:true,stopReason:'functional-body-complete',tracingCompleteSeen:true,completion:{observedMs:12,dataLossOccurred:false,traceFormat:'json',streamCompression:'gzip'},dataLossOccurred:false,bufferUsage:{count:0,first:null,last:null,max:null},eof:true,ioClosed:true,truncated:false,retainedBytes:1,receivedBytes:1,totalOriginalCompressedBytes:1,payloadSha256:sha('x'),owners:kinds.map((kind,i)=>({kind,dispatched:1,fulfilled:1,rejected:0,pending:0,lastStatus:'fulfilled',lastDispatchedMs:i<6?1:11,lastSettledMs:i<6?2:12,attentionStatus:'fulfilled',attentionDeadlineMs:i<6?10000:10010,attentionSettledMs:i<6?3:13,error:null})),issues:[],complete:true,unsafeOutstanding:false,performance:false,scoringEligibility:false,FPS:null,bufferNotificationsV3:{totalCount:0,first8:[],last8:[],retainedCount:0,droppedCount:0,truncated:false}};
 state.snapshot={receipt:r,payloadBase64:Buffer.from('x').toString('base64')};
 state.wrapper={schema:policy.schemas.raw,captureProfile:policy.captureProfile,policySha256:policySha,identity:id,traceFormat:'json',compression:'gzip',payloadEncoding:'base64',receipt:r,retainedCompressedBytes:1,compressedSha256:sha('x'),payloadBase64:state.snapshot.payloadBase64,...flags};
 const rawText=JSON.stringify(state.wrapper),rawReference={path:ports.slot.id+'/aimock-trace-v3-private.json',bytes:Buffer.byteLength(rawText),sha256:sha(rawText)};
 const binding={frameId:'frame',nestedProcessId:2001,pid:2001,tid:3,frameEventIndex:0,frameRecordIndex:0,threadEventIndex:1};
 const witness=(row)=>({totalCount:1,distinctIdentities:1,duplicateCount:0,first8:[row],latest:row,retainedCount:1,droppedCount:0,truncated:false});
 const mapping={schema:'aimock-trace-renderer-v1',status:'available',reason:null,binding,frameWitnesses:witness({eventIndex:0,frameRecordIndex:0,frameId:'frame',nestedProcessId:2001}),threadWitnesses:witness({eventIndex:1,pid:2001,tid:3}),foreignFrameCount:0,foreignRendererMainCount:0,malformedRelevantCount:0,performance:false,scoringEligibility:false,FPS:null};
 const costs={schema:'aimock-owned-renderer-costs-v1',status:'available',reason:null,...flags,presentationCoverage:'unverified',scope:'whole-capture-observed-complete-X-events',clock:'trace-timeTicks-microseconds',binding,tasks:{observedCompleteEvents:1,longTaskEvents:0,longest:[{eventIndex:2,timestampUs:1,durationUs:1}]},layouts:{observedCompleteEvents:0,longest:[]},minorGC:{observedCompleteEvents:0,longest:[]},limitations:['not-a-complete-task-population','not-a-streaming-only-window','wall-duration-is-not-CPU-time','nested-and-overlapping-classes-not-additive','headless-conformance-is-not-display-presentation']};
 const names=[...policy.config.traceConfig.includedCategories].sort();
 const decoded={schema:policy.schemas.decoded,status:'valid',reason:null,identity:id,policySha256:policySha,rawReference,compressedBytes:1,compressedSha256:sha('x'),decodedBytes:42,decodedSha256:sha('authored decoded'),traceEventCount:3,metadataEventCount:2,emittedCategories:{count:2,sha256:sha(JSON.stringify(names)),first16:names.map(text=>({text,trueCharacters:text.length,truncated:false})),truncated:false,requested:policy.config.traceConfig.includedCategories.map(category=>({category,observed:true,meaning:'actual-event-category-token'}))},rendererMapping:mapping,costs,...flags};
 const observation=(time,code=null)=>({status:'fulfilled',observedMs:time,code,signal:null,reason:null});
 const start='Fri Nov  6 00:00:00 2026';
 function original(kind,pid,dispatch,exit,close,closed,stdout){
  const pipe=(name,text)=>({status:'fulfilled',observedBytes:Buffer.byteLength(text),retainedPrefixBase64:name==='stdin'?'':Buffer.from(text).toString('base64'),droppedBytes:name==='stdin'?Buffer.byteLength(text):0,completeSha256:sha(text),endMs:name==='stdin'?null:close,finishMs:name==='stdin'?exit:null,closeMs:close,writeDispatchedMs:name==='stdin'&&kind==='decoder'?dispatch+1:null,writeSettledMs:name==='stdin'&&kind==='decoder'?dispatch+2:null,reason:null});
  return {ownerId:kind+'-'+pid,kind,pid,parentPid:1001,startWitness:start,dispatchMs:dispatch,deadlineMs:kind==='decoder'?10020:dispatch+250,spawn:observation(dispatch),exit:observation(exit,0),close:observation(close,0),stdin:pipe('stdin',kind==='decoder'?'request':''),stdout:pipe('stdout',stdout),stderr:pipe('stderr',''),attention:observation(closed),cleanup:{termDispatchedMs:null,termAccepted:null,killDispatchedMs:null,killAccepted:null,originalsClosedMs:closed,reason:null}};
 }
 const decoder=original('decoder',2001,20,50,52,54,'result'),queries=[original('rss-query',2002,23,24,25,26,`2001 1001 1 ${start}\n`),original('rss-query',2003,32,33,34,35,`2001 1001 2 ${start}\n`)];
 const originals={schema:policy.schemas.originals,identity:id,policySha256:policySha,rawReference,nodeExecutableSha256:'1'.repeat(64),decoderClosureSha256:'2'.repeat(64),rssExecutableSha256:'3'.repeat(64),decoder,queries,unsafeOutstanding:false,...flags};
 const originalText=JSON.stringify(originals),originalsReference={path:ports.slot.id+'/aimock-trace-v3-decoder-originals.json',bytes:Buffer.byteLength(originalText),sha256:sha(originalText)};
 state.files.set(originalsReference.path,clone(originals));
 state.owned={decoderResult:decoded,decoderOriginals:originalsReference,decoderOwner:{schema:policy.schemas.owner,status:'complete',reason:null,clock:{basis:'parent-node-performance',dispatchedMs:20,successDeadlineMs:10020,cleanupDeadlineMs:270000,originalsClosedMs:54},originalsReference,nodeExecutableSha256:originals.nodeExecutableSha256,decoderClosureSha256:originals.decoderClosureSha256,rssExecutableSha256:originals.rssExecutableSha256,rss:{thresholdBytes:1073741824,attempted:2,fulfilled:2,rejected:0,missed:0,pending:0,peakBytes:2048,initialSeen:true,terminalSeen:true,samples:[[0,23,27,1024],[2,32,36,2048]]},unsafeOutstanding:false,...flags}};
 state.owned=clone(state.owned);return model;
}
async function publish(model,extra=''){
 return execute(setupText()+`traceSnapshot=state.snapshot;traceCleanupEnd=state.time;`+extra+snippets().publish+tail,{...model.ports,state:model.state});
}
for(const profile of ['copilotkit','assistant-ui','vercel-ai-sdk'])test(`actual typed ${profile} build result creates flat null-version identity`,async()=>{
 const model=base(profile),out=await execute(setupText()+tail,model.ports);
 assert.equal(out.traceIdentity.profile,profile);assert.equal(out.traceIdentity.stockVersion,null);assert.deepEqual(Object.keys(out.traceIdentity),['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256']);assert.equal(out.traceIdentity.buildSha256,sha(JSON.stringify(model.build)));assert.equal(model.state.constructorCalls,1);assert.deepEqual(model.state.guardCalls,['aimock-competitor-build-before']);
 model.state.time=240001;assert.ok(model.state.options.remaining()<0);
});
test('pending genuine build creates no collector before actual fulfillment',async()=>{
 const model=base(),pending=deferred();model.ports.competitorBuildEvidenceV1=()=>pending.original;
 const out=execute(setupText()+tail,model.ports);await Promise.resolve();assert.equal(model.state.constructorCalls,0);pending.resolve(model.build);assert.equal((await out).traceIdentity.buildSha256,sha(JSON.stringify(model.build)));
});
test('rejected genuine build and disallowed Threadplane profile never construct collector',async()=>{
 for(const model of [base(),base('threadplane')]){model.ports.competitorBuildEvidenceV1=async()=>{throw Error('genuine-build-refused');};await assert.rejects(execute(setupText()+tail,model.ports));assert.equal(model.state.constructorCalls,0);}
});
test('complete trace publishes three bound references under actual owner five-input call',async()=>{
 const model=completeModel(base()),out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'complete',out.result.traceDiagnostic.failure??'unexpected unavailable');assert.deepEqual(model.state.writes.map(r=>r.name),['aimock-trace-v3-private.json','aimock-trace-v3-validation.json']);assert.deepEqual(Object.keys(model.state.ownerCalls[0]),['identity','store','artifacts','caseStarted','invocationStarted']);assert.equal(model.state.ownerCalls[0].store,model.ports.store);assert.equal(model.state.ownerCalls[0].artifacts,model.ports.artifacts);assert.equal(out.result.status,'matrix-pass');
 assert.deepEqual(Object.keys(out.result.traceDiagnostic),['schema','profile','status','failure','buildSha256','rawCapture','decoderOriginals','validation','policySha256','performance','scoringEligibility','FPS','cpuTime']);
});

test('unknown unavailable-owner reason is refused before validation publication',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.status='unavailable';model.state.owned.decoderOwner.reason='invented-reason';const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.result.traceDiagnostic.validation,null);
});

const expectedImports=[
 "import path from 'node:path';",
 "import {fileURLToPath} from 'node:url';",
 "import {performance} from 'node:perf_hooks';",
 "import {createHash} from 'node:crypto';",
 "import {competitorBuildEvidenceV1,waitCompetitorBuildOriginalV1} from './competitor-build-v1.mjs';",
 "import {competitorStockProfileV1} from './competitor-stock-pins-v1.mjs';",
 "import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION,nativeHistorySeekV4 as nativeHistorySeek} from './matrix-policy-v5.mjs';",
 "import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';",
 "import {createMatrixReadinessControllerV5} from './matrix-readiness-v5.mjs';",
 "import {createMatrixDeadline,collectMatrixProvenance,captureMatrixFinalBookend,createMatrixReadinessPortV5,installMatrixWheelRecorder,requireMatrixWheelDelivery} from './matrix-run-v5.mjs';",
 "import {createAimockTraceCaptureV3,createAimockTraceRawEvidenceV3} from './aimock-trace-capture-v3.mjs';",
 "import {runAimockTraceDecoderOwnerV3} from './aimock-trace-decoder-owner-v3.mjs';",
 "import {SEMANTIC_LARGE_V3_POLICY as TRACE_POLICY,SEMANTIC_LARGE_V3_POLICY_SHA256 as TRACE_POLICY_SHA256} from './semantic-large-v3-policy.mjs';",
];
test('complete import allowlist and production exports stay closed',()=>{
 assert.deepEqual(source.split('\n').filter(line=>line.startsWith('import ')),expectedImports);assert.deepEqual([...source.matchAll(/^export .*$/gm)].map(m=>m[0]),['export async function runMatrixCase({slot,store,out,invocationStarted}){']);assert.doesNotMatch(source,/testPort|testHarness|createRequire|node:zlib|gunzipSync|inflateSync/);
});
test('absent snapshot still executes genuine postbuild guard once and stops',async()=>{
 const model=base(),out=await execute(snippets().create+snippets().publish+tail,model.ports);assert.deepEqual(model.state.guardCalls,['aimock-competitor-build-after']);assert.deepEqual(model.state.reads,['copilotkit']);assert.equal(out.tracePublicationStop,true);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.writes.length,0);
});
test('build drift refuses before raw publication',async()=>{
 const model=completeModel(base());let n=0;model.ports.competitorBuildEvidenceV1=async()=>++n===1?clone(model.build):{...clone(model.build),changed:true};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.writes.length,0);assert.equal(out.tracePublicationStop,true);
});
test('cleanup awaits exact finish attention before browser close and clips once to original cleanup start',async()=>{
 const model=base(),attention=deferred();let call=0;model.ports.createAimockTraceCaptureV3=options=>{model.state.options=options;return {setup:async()=>{},assertBeforeStart(){},beforeBrowserClose(){call++;return attention.original;}};};
 const events=[],entered=deferred();model.ports.cleanupStarted=50;model.ports.cleanupWait=async original=>{assert.equal(original,attention.original);events.push('await');entered.resolve();return original;};model.ports.close=()=>events.push('browser-close');
 const task=execute(setupText()+snippets()['cleanup-stop']+'close();'+tail,model.ports);await entered.original;assert.deepEqual(events,['await']);attention.resolve();const out=await task;assert.equal(out.traceCleanupEnd,30050);assert.deepEqual(events,['await','browser-close']);assert.equal(call,1);model.state.time=30051;assert.equal(model.state.options.remaining(),-1);
});
test('no collector cleanup has no synthetic finish; rejected attention remains failed',async()=>{
 const model=base();model.ports.cleanupStarted=1;let consumed=0;model.ports.cleanupWait=async()=>{consumed++;};const out=await execute(snippets().create+snippets()['cleanup-stop']+tail,model.ports);assert.equal(consumed,0);assert.equal(out.traceCleanupEnd,30001);
 model.ports.createAimockTraceCaptureV3=()=>({setup:async()=>{},assertBeforeStart(){},beforeBrowserClose:()=>Promise.reject(Error('same-finish-refusal'))});model.ports.cleanupWait=async original=>original;const rejected=await execute(setupText()+`traceFailure='aimock-trace-finish-unavailable';`+snippets()['cleanup-stop']+tail,model.ports);assert.equal(rejected.traceFailure,'aimock-trace-finish-unavailable');
});
function rebind(model){
 const {state,ports}=model,text=JSON.stringify(state.wrapper),ref={path:ports.slot.id+'/aimock-trace-v3-private.json',bytes:Buffer.byteLength(text),sha256:sha(text)};
 state.owned.decoderResult.rawReference=clone(ref);
 const originalPath=ports.slot.id+'/aimock-trace-v3-decoder-originals.json',originals=state.files.get(originalPath);originals.rawReference=clone(ref);const originalText=JSON.stringify(originals),originalRef={path:originalPath,bytes:Buffer.byteLength(originalText),sha256:sha(originalText)};state.owned.decoderOriginals=originalRef;state.owned.decoderOwner.originalsReference=clone(originalRef);
}
const corruptions={
 'raw loss below90':m=>{m.state.wrapper.receipt.dataLossOccurred=true;},
 'raw90 buffer usage':m=>{m.state.wrapper.receipt.bufferUsage={count:1,first:.9,last:.9,max:.9};},
 'missing EOF':m=>{m.state.wrapper.receipt.eof=false;},
 'missing IO close':m=>{m.state.wrapper.receipt.ioClosed=false;},
 'truncated prefix':m=>{m.state.wrapper.receipt.truncated=true;},
 'receipt issue':m=>{m.state.wrapper.receipt.issues=['timeline-loss'];},
 'receipt identity':m=>{m.state.wrapper.receipt.identity={...m.state.wrapper.identity,id:'foreign'};},
 'child identity':m=>{m.state.owned.decoderResult.identity.profile='assistant-ui';},
 'child schema':m=>{m.state.owned.decoderResult.schema='v2';},
 'child source flags':m=>{m.state.owned.decoderResult.performance=true;},
 'child build digest':m=>{m.state.owned.decoderResult.identity.buildSha256='b'.repeat(64);},
 'child compressed hash':m=>{m.state.owned.decoderResult.compressedSha256='b'.repeat(64);},
 'child missing metadata':m=>{m.state.owned.decoderResult.metadataEventCount=0;},
 'child frame binding':m=>{m.state.owned.decoderResult.rendererMapping.binding.frameId='foreign';},
 'child cost event reuse':m=>{m.state.owned.decoderResult.costs.tasks.longest[0].eventIndex=0;},
 'owner schema':m=>{m.state.owned.decoderOwner.schema='v2';},
 'owner unknown field':m=>{m.state.owned.decoderOwner.extra=true;},
 'owner FPS':m=>{m.state.owned.decoderOwner.FPS=60;},
 'owner current clock':m=>{m.state.owned.decoderOwner.clock.originalsClosedMs=101;},
 'owner hard end':m=>{m.state.owned.decoderOwner.clock.successDeadlineMs++;},
 'owner missed RSS':m=>{m.state.owned.decoderOwner.rss.missed=1;},
 'owner RSS overflow':m=>{m.state.owned.decoderOwner.rss.peakBytes=1073741825;},
 'owner missing initial RSS':m=>{m.state.owned.decoderOwner.rss.initialSeen=false;},
 'originals schema':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').schema='v2';},
 'originals identity':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').identity.profile='assistant-ui';},
 'originals node hash':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').nodeExecutableSha256='9'.repeat(64);},
 'originals PPID actual':m=>{const o=m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json');o.decoder.parentPid=42;for(const q of o.queries)q.parentPid=42;},
 'originals process exit':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').decoder.exit.code=1;},
 'originals stdout EOF':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').decoder.stdout.endMs=null;},
 'originals write callback':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').decoder.stdin.writeSettledMs=null;},
 'originals query PID':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').queries[0].pid=2001;},
 'originals query witness':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').queries[0].startWitness='Fri Nov  6 00:00:01 2026';},
 'originals query sample binding':m=>{m.state.owned.decoderOwner.rss.samples[0][1]++;},
 'originals query strict deadline':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').queries[0].attention.observedMs=273;},
 'originals flags':m=>{m.state.files.get('case-1/aimock-trace-v3-decoder-originals.json').cpuTime=1;},
};
for(const [name,corrupt] of Object.entries(corruptions))test(`${name} cannot qualify`,async()=>{
 const model=completeModel(base());corrupt(model);rebind(model);if(name==='owner schema'){await assert.rejects(publish(model),e=>e.unsafeOutstanding===true);return;}const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.equal(out.result.status,'matrix-pass');
});
test('native initial readiness refusal remains unchanged with independently complete trace',async()=>{
 const model=completeModel(base()),failure={message:'matrix-readiness-v5-initial-unavailable'};model.ports.failure=failure;model.ports.result={status:'invalid',failure};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'complete');assert.deepEqual(out.result.failure,failure);assert.equal(out.result.status,'invalid');
});
for(const phase of ['aimock-trace-raw-write','aimock-trace-raw-read','aimock-trace-decoder-owner','aimock-trace-originals-read','aimock-trace-validation-write','aimock-trace-validation-read'])test(`${phase} unresolved original rejects before subsequent native files`,async()=>{
 const model=completeModel(base()),pending=deferred();let intercepted=false;
 const write=model.ports.artifacts.writeJSON,read=model.ports.store.readJSON,owner=model.ports.runAimockTraceDecoderOwnerV3;
 if(phase.endsWith('write'))model.ports.artifacts.writeJSON=(name,...args)=>name===(phase.includes('raw')?'aimock-trace-v3-private.json':'aimock-trace-v3-validation.json')?pending.original:write(name,...args);
 else if(phase==='aimock-trace-decoder-owner')model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 else model.ports.store.readJSON=(ref,...args)=>ref.path.endsWith(phase.includes('raw')?'aimock-trace-v3-private.json':phase.includes('originals')?'aimock-trace-v3-decoder-originals.json':'aimock-trace-v3-validation.json')?pending.original:read(ref,...args);
 model.ports.wait=async(original,ms,label)=>{if(label===phase){intercepted=true;throw Error('attention-expired');}return original;};
 await assert.rejects(execute(setupText()+`traceSnapshot=state.snapshot;traceCleanupEnd=state.time;`+snippets().publish+'state.nativeWrites++;'+tail,{...model.ports,state:model.state}),error=>error.unsafeOutstanding===true&&error.cause.message==='attention-expired');assert.equal(intercepted,true);assert.equal(model.state.nativeWrites,0);pending.reject(Error('late original refusal'));await Promise.resolve();assert.equal(model.state.nativeWrites,0);
});
test('safely settled rejection stays unavailable, stops and allows original native continuation',async()=>{
 const model=completeModel(base());model.ports.artifacts.writeJSON=async()=>{throw Error('settled-write-refusal');};const out=await execute(setupText()+`traceSnapshot=state.snapshot;traceCleanupEnd=state.time;`+snippets().publish+'state.nativeWrites++;'+tail,{...model.ports,state:model.state});assert.equal(out.tracePublicationStop,true);assert.equal(out.unsafeOutstanding,false);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.nativeWrites,1);
});
test('owner settled with unknown inner writer rejects without further file dispatch',async()=>{
 const model=completeModel(base());model.ports.runAimockTraceDecoderOwnerV3=async()=>{model.state.stats.pendingWriters=1;return clone(model.state.owned);};let reads=0;const read=model.ports.store.readJSON;model.ports.store.readJSON=(...args)=>{reads++;return read(...args);};await assert.rejects(publish(model),e=>e.unsafeOutstanding===true);assert.equal(reads,1);assert.equal(model.state.writes.length,1);
});
test('late owner unsafe receipt cannot be cleared by owner promise settlement or empty store stats',async()=>{
 const model=completeModel(base()),pending=deferred();model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner'){queueMicrotask(()=>pending.resolve({...clone(model.state.owned),decoderOwner:{...clone(model.state.owned.decoderOwner),unsafeOutstanding:true}}));throw Error('owner-attention-expired');}return original;};await assert.rejects(publish(model),e=>e.unsafeOutstanding===true);assert.equal(model.state.writes.length,1);
});
test('unsafe rejection preserves exact known native refusal message and actual trace cause',async()=>{
 const model=completeModel(base()),pending=deferred(),native='matrix-readiness-v5-initial-unavailable';model.ports.failure={message:native};model.ports.artifacts.writeJSON=()=>pending.original;model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-raw-write')throw Error('actual-trace-cause');return original;};await assert.rejects(publish(model),e=>e.message===native&&e.unsafeOutstanding===true&&e.cause.message==='actual-trace-cause');pending.resolve(null);await Promise.resolve();
});

for(const phase of ['raw','originals','validation'])test(`${phase} outer readback mutation refuses qualification`,async()=>{
 const model=completeModel(base()),read=model.ports.store.readJSON;model.ports.store.readJSON=async(ref,...args)=>{const value=await read(ref,...args);if(ref.path.endsWith(phase==='raw'?'aimock-trace-v3-private.json':phase==='originals'?'aimock-trace-v3-decoder-originals.json':'aimock-trace-v3-validation.json'))value.policySha256='f'.repeat(64);return value;};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);
});
for(const field of ['path','bytes','sha256'])test(`raw reference ${field} exact join is mandatory`,async()=>{
 const model=completeModel(base()),write=model.ports.artifacts.writeJSON;model.ports.artifacts.writeJSON=async(...args)=>{const ref=await write(...args);if(args[0]==='aimock-trace-v3-private.json')ref[field]=field==='bytes'?ref.bytes+1:field==='path'?'foreign/aimock-trace-v3-private.json':'0'.repeat(64);return ref;};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.ownerCalls.length,0);
});
test('owner exact end equality cannot dispatch originals read or validation write',async()=>{
 const model=completeModel(base()),read=model.ports.store.readJSON;let reads=0;model.ports.store.readJSON=(...args)=>{reads++;return read(...args);};model.ports.runAimockTraceDecoderOwnerV3=async()=>{model.state.time=10020;return clone(model.state.owned);};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(reads,1);assert.deepEqual(model.state.writes.map(w=>w.name),['aimock-trace-v3-private.json']);
});
test('safely unavailable owner preserves valid observed child aggregate once in validation',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.status='unavailable';model.state.owned.decoderOwner.reason='timeline-owner-process';const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');const validation=model.state.files.get('case-1/aimock-trace-v3-validation.json');assert.equal(validation.decoderResult.status,'valid');assert.equal(validation.decoderOwner.status,'unavailable');assert.equal(Object.hasOwn(out.result.traceDiagnostic,'decoderResult'),false);
});
test('unavailable owner with null child result never fabricates aggregate success',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.status='unavailable';model.state.owned.decoderOwner.reason='timeline-owner-result';model.state.owned.decoderResult=null;const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.files.get('case-1/aimock-trace-v3-validation.json').decoderResult,null);
});
test('pending actual postbuild read is retained even without a collector and unsafe rejects before native writes',async()=>{
 const model=base(),pending=deferred();model.ports.competitorBuildEvidenceV1=()=>pending.original;model.ports.wait=async()=>{throw Error('typed-after-attention');};await assert.rejects(execute(snippets().create+'traceCleanupEnd=state.time;'+snippets().publish+'state.nativeWrites++;'+tail,{...model.ports,state:model.state}),e=>e.unsafeOutstanding===true&&e.cause.message==='typed-after-attention');assert.equal(model.state.nativeWrites,0);assert.deepEqual(model.state.guardCalls,['aimock-competitor-build-after']);pending.reject(Error('late-read'));await Promise.resolve();
});
test('late safe owner closure does not rescue availability or retry any files',async()=>{
 const model=completeModel(base()),pending=deferred();model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner'){queueMicrotask(()=>pending.resolve(clone(model.state.owned)));throw Error('owner-attention-expired');}return original;};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.deepEqual(model.state.writes.map(w=>w.name),['aimock-trace-v3-private.json']);
});

test('actual old V2 publication negative control exposes attention expiry continuing native writes',async()=>{
 const old=read('matrix-case-competitor-trace-v1.mjs'),start=old.indexOf(' // TRACE-V2-BEGIN publish\n')+' // TRACE-V2-BEGIN publish\n'.length,end=old.indexOf(' // TRACE-V2-END publish\n'),oldPublish=old.slice(start,end),pending=deferred(),state={nativeWrites:0};
 const model=base();model.ports.wait=async()=>{throw Error('old-attention-expired');};
 await execute(oldPublish+'state.nativeWrites++;return result;',{
  ...model.ports,state,traceFailure:null,traceCompetitorBuild:model.build,traceSnapshot:{receipt:{}},tracePublicationStop:false,
  competitorBuildEvidenceV1:async()=>model.build,waitCompetitorBuildOriginalV1:async original=>original,
  validateAimockTraceV1:()=>({status:'valid',rendererMapping:{status:'available'}}),createAimockTraceEvidenceV1:()=>({bounded:'raw'}),analyzeAimockTraceCostsV1:()=>({status:'available'}),
  artifacts:{writeJSON:()=>pending.original},
 });
 assert.equal(state.nativeWrites,1,'old unsafe continuation is observable in this exact extracted choreography');pending.reject(Error('late-old-writer'));pending.original.catch(()=>{});
});

test('settled original rejection carrying actual unsafe ownership cannot be cleared by empty store statistics',async()=>{
 const model=completeModel(base());model.ports.runAimockTraceDecoderOwnerV3=async()=>{throw Object.assign(Error('actual-owner-unsafe-rejection'),{unsafeOutstanding:true});};await assert.rejects(publish(model),e=>e.unsafeOutstanding===true&&e.cause.message==='actual-owner-unsafe-rejection');assert.equal(model.state.writes.length,1);
});

// Finite fake timers exercise the actual positive-time retained-original race.
// Timer ports are lexical AsyncFunction arguments; global timers stay untouched.
async function timerObservationProbe(){
 const model=completeModel(base()),pending=deferred(),timers=new Map(),scheduled=[],cleared=[];
 const nativeFailure={message:'matrix-active-readiness-deadline',stage:'active',details:{original:true}},attentionError=Error('owner-attention-expired');
 model.ports.failure=nativeFailure;model.ports.result={status:'invalid',failure:nativeFailure,admission:{native:true}};
 model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner')throw attentionError;return original;};
 let next=0,outcome;
 const ports={...model.ports,state:model.state,cleanupStarted:50,cleanupWait:async original=>original,
  setTimeout(callback,delay){const timer={id:++next,callback,delay,at:model.state.time+delay};timers.set(timer.id,timer);scheduled.push(timer);return timer.id;},
  clearTimeout(id){cleared.push(id);timers.delete(id);}};
 const task=execute(setupText()+snippets()['cleanup-stop']+`traceSnapshot=state.snapshot;state.time=30000;state.operations=traceOperations;let stopInvocation=false;`+snippets().publish+snippets().stop+'state.stopInvocation=stopInvocation;state.nativeWrites++;'+tail,ports);
 task.then(value=>{outcome={value};},error=>{outcome={error};});
 const flush=async()=>{for(let n=0;n<80;n++)await Promise.resolve();};
 await flush();
 assert.equal(outcome,undefined,'publication remains suspended at positive-time observation entry');
 assert.equal(scheduled.length,1,'the retained-original Promise.race arms exactly one timer');
 assert.equal(scheduled[0].delay,50,'timer clips to original cleanupStarted + cleanupMs, without a renewed clock');
 assert.equal(scheduled[0].at,30050);
 assert.equal(model.state.operations.at(-1).original,pending.original);
 assert.equal(model.state.operations.at(-1).status,'pending','actual original is pending when the observation race is entered');
 assert.equal(model.state.nativeWrites,0);
 function fire(){const timer=[...timers.values()].sort((a,b)=>a.at-b.at)[0];assert.ok(timer,'controlled next timer exists');timers.delete(timer.id);model.state.time=timer.at;timer.callback();return timer;}
 return {model,pending,timers,scheduled,cleared,nativeFailure,attentionError,flush,fire,get outcome(){return outcome;},schedule:ports.setTimeout};
}
for(const unsafe of [false,true])test(`positive-time retained owner settles from controlled timer with unsafe=${unsafe}`,async()=>{
 const probe=await timerObservationProbe(),{model}=probe;
 probe.schedule(()=>probe.pending.resolve({...clone(model.state.owned),decoderOwner:{...clone(model.state.owned.decoderOwner),unsafeOutstanding:unsafe}}),20);
 assert.equal(probe.fire().at,30020);await probe.flush();
 assert.ok(probe.outcome,'timer settlement completes observation without waiting for the cleanup end');
 assert.deepEqual(probe.cleared,[probe.scheduled[0].id]);assert.equal(probe.timers.size,0);
 assert.equal(probe.scheduled.length,2,'settlement never starts another observation clock');
 assert.equal(model.state.operations.at(-1).status,'fulfilled');
 assert.deepEqual(model.state.writes.map(w=>w.name),['aimock-trace-v3-private.json'],'late closure never retries or qualifies publication');
 assert.deepEqual(model.state.stats,{pendingOriginals:0,pendingWriters:0,unsafeWriter:false});
 assert.equal(model.ports.result.status,'invalid');assert.deepEqual(model.ports.result.failure,probe.nativeFailure);assert.deepEqual(model.ports.result.admission,{native:true});
 if(unsafe){assert.equal(probe.outcome.error?.unsafeOutstanding,true);assert.equal(probe.outcome.error?.message,probe.nativeFailure.message);assert.equal(probe.outcome.error?.cause,probe.attentionError);assert.equal(model.ports.result.unsafeOutstanding,true);assert.equal(model.state.nativeWrites,0);}
 else{const out=probe.outcome.value;assert.ok(out);assert.equal(out.traceCleanupEnd,30050);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.equal(out.unsafeOutstanding,false);assert.equal(model.state.stopInvocation,true);assert.equal(model.state.nativeWrites,1);}
});
test('positive-time retained original expires at established cleanup end and late safe closure cannot rescue it',async()=>{
 const probe=await timerObservationProbe(),{model}=probe;
 assert.equal(probe.fire().at,30050);await probe.flush();
 assert.ok(probe.outcome,'expiry terminates observation at the original cleanup end');
 const error=probe.outcome.error;assert.equal(error?.unsafeOutstanding,true);assert.equal(error?.message,probe.nativeFailure.message);assert.equal(error?.cause,probe.attentionError);
 assert.equal(model.state.operations.at(-1).status,'pending');assert.equal(model.ports.result.unsafeOutstanding,true);assert.equal(model.state.nativeWrites,0);
 assert.equal(probe.scheduled.length,1,'expiry does not renew a timer');assert.deepEqual(probe.cleared,[probe.scheduled[0].id]);assert.equal(probe.timers.size,0);
 probe.schedule(()=>probe.pending.resolve(clone(model.state.owned)),10);assert.equal(probe.fire().at,30060);await probe.flush();
 assert.equal(probe.outcome.error,error);assert.equal(model.state.operations.at(-1).status,'fulfilled');assert.equal(model.state.nativeWrites,0);assert.equal(model.ports.result.unsafeOutstanding,true);
 assert.deepEqual(model.state.writes.map(w=>w.name),['aimock-trace-v3-private.json']);assert.equal(model.ports.result.status,'invalid');assert.deepEqual(model.ports.result.failure,probe.nativeFailure);assert.deepEqual(model.ports.result.admission,{native:true});assert.equal(probe.timers.size,0);
});
