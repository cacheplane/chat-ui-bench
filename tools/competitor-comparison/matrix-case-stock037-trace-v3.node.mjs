import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {createStock037CpuCaptureV1} from './aimock-stock037-cpu-capture-v1.mjs';
import {types} from 'node:util';
console.log('stock037-v3-pure-source-test-pid',process.pid);
const read=name=>readFile(new URL('./'+name,import.meta.url),'utf8');
const source=await read('matrix-case-stock037-trace-v3.mjs');
const native=await read('matrix-run-v5.mjs');
const names=['create','setup','ack','finish','cleanup-stop','cleanup-seal','publish','stop'];
function parse(text){
 const lines=text.split(/(?<=\n)/),seams={},kept=[];let open=null,next=0;
 for(const line of lines){
  if(!line.includes('TRACE-V3')){if(open)seams[open]+=line;else kept.push(line);continue;}
  const m=/^ \/\/ TRACE-V3-(BEGIN|END) ([a-z-]+)\n$/.exec(line);
  assert.ok(m,'exact marker line');
  if(m[1]==='BEGIN'){assert.equal(open,null,'no nested seam');assert.equal(m[2],names[next],'ordered unique seam');open=m[2];seams[open]='';}
  else{assert.equal(m[2],open,'matched seam');open=null;next++;}
 }
 assert.equal(open,null);assert.equal(next,8,'exactly eight seams');return{seams,native:kept.join('')};
}
const body=(s,start,end)=>{const a=s.indexOf(start),b=end?s.indexOf(end,a):s.length;assert.ok(a>=0&&b>a);return s.slice(a,b);};
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
test('new local shared-signal entry is closed and separate from ordinary stock and CPU wrappers',()=>{
 assert.match(source,/export async function runLocalSharedSignalsCaseV1\(input\)/);
 assert.match(source,/assertLocalSharedSignalsExecutionsReadyV1\(\)/);
 assert.match(source,/localSharedSignalsSlotV1\(ordinal\)/);
 assert.match(source,/localSharedSignalsRoleRootV1\(slot.role\)/);
});
test('real local NULL gate precedes even caller property inspection',async()=>{
 const api=await import('./matrix-case-stock037-trace-v3.mjs');let touched=0;
 await assert.rejects(api.runLocalSharedSignalsCaseV1(new Proxy({},{get(){touched++;throw Error('caller-read');},getPrototypeOf(){touched++;throw Error('caller-prototype');}})),/identity-unavailable/);
 assert.equal(touched,0);
});
test('source-extracted local entry verifies its genuine guard before native acquisition',async()=>{
 const entry=body(source,'export async function runLocalSharedSignalsCaseV1(input){','\nasync function installMatrixThreadplaneBridge(').replace('export async function','async function');
 const slot={id:'fixed-local',role:'control'},events=[],tokens=new WeakMap();let resolve;const original=new Promise(r=>resolve=r);
 const run=AsyncFunction('p',`const {path,slot,tokens}=p,ROOT='/fixed/control/',LOCAL_SHARED_SIGNALS_TOKENS=tokens,SHARED_SIGNALS_NATIVE_HANDLE=Object.freeze({}),performance={now:()=>1},STAGES={transcript:10000},assertLocalSharedSignalsExecutionsReadyV1=()=>{},localSharedSignalsSlotV1=i=>{if(i!==0)throw Error('ordinal');return slot;},localSharedSignalsRoleRootV1=()=>'/fixed/control',createMatrixDeadline=()=>({wait:async x=>x,remaining:()=>240000}),waitLocalSharedSignalsOriginalV1=p.wait,createLocalSharedSignalsBuildGuardV1=p.guard,threadplaneBuildEvidence=p.read,runMatrixCaseOriginal=p.native;${entry};return runLocalSharedSignalsCaseV1(p.input);`);
 const input={ordinal:0,store:{},out:'/out',invocationStarted:0},pending=run({path,slot,tokens,input,wait:async x=>x,guard:async()=>({identity:{stock:false},verify:async build=>{events.push('guard-verify');return original;}}),read:async()=>({genuine:true}),native:async(args,token)=>{events.push('native');assert.equal(args.slot,slot);assert.equal(tokens.get(token).ordinal,0);return{complete:true};}});
 await new Promise(setImmediate);assert.deepEqual(events,['guard-verify']);resolve({genuine:true});assert.deepEqual(await pending,{complete:true});assert.deepEqual(events,['guard-verify','native']);
});
test('ordinary stock entry refuses every local ID before native fixture acquisition',async()=>{
 const {seams}=parse(source),run=AsyncFunction('slot',`const stock037PublishedIdentityV1=()=>{};${seams.create};return true;`);
 for(const role of ['control','candidate'])await assert.rejects(run({id:'threadplane-h1000-r6400-follow-local-shared-signals-v1-'+role+'-round-1',selection:{profile:'threadplane'}}),/local-shared-signals-ordinary-entry/);
});
test('private local mode uses actual guard and numeric compatibility wire without enabling CPU sampling',async()=>{
 const {seams}=parse(source),token={},policyHandle=Object.freeze({}),tokens=new WeakMap(),slot={id:'threadplane-h1000-r6400-follow-local-shared-signals-v1-control-round-1',role:'control',selection:{profile:'threadplane'}},build={genuine:'default-production',assetHashes:{}},events=[];
 tokens.set(token,{policyHandle,slot,ordinal:0,guard:{identity:{stock:false},verify:async value=>{events.push('verify');assert.equal(value,build);return value;}}});
 const run=AsyncFunction('p','token',`const LOCAL_SHARED_SIGNALS_TOKENS=p.tokens,LOCAL_NATIVE_BINDINGS=new WeakMap([[p.policyHandle,{policy:{id:"local-shared-signals-v1",prefix:"local-shared-signals"},slot:()=>p.slot,wait:async x=>x}]]),STOCK037_CPU_TOKEN=Symbol('cpu'),{slot,build}=p,{createHash}=p,profile='threadplane',historyCount=1000,responseBytes=6400,journey='follow',started=0,performance={now:()=>1},deadline={remaining:()=>240000},STAGES={transcript:10000,progress:10000},wait=async x=>x,browser={},context={},page={},server={origin:'http://localhost'},stock037PublishedIdentityV1=()=>{throw Error('published-guard-must-not-authorize-local');},threadplaneBuildEvidence=async()=>build,waitLocalSharedSignalsOriginalV1=async x=>x,waitStock037BuildOriginalV1=async()=>{throw Error('stock-wait');},assertStock037BuildV1=()=>{throw Error('stock-build');},createAimockTraceCaptureV3=options=>{p.events.push('capture');return{setup:async()=>{},assertBeforeStart(){}};};${seams.create}${seams.setup};return{cpuMode,traceIdentity};`);
 const out=await run({tokens,policyHandle,slot,build,createHash,events},token);assert.equal(out.cpuMode,false);assert.equal(out.traceIdentity.stockVersion,'0.3.7');assert.equal(out.traceIdentity.buildSha256,sha(JSON.stringify(build)));assert.deepEqual(events,['verify','capture']);
});
test('strict eight-seam parser and exact native V5/wrapper/bridge bytes',()=>{
 const parsed=parse(source);let actual=body(parsed.native,'async function runMatrixCaseOriginal(');
 assert.equal(actual.split('async function runMatrixCaseOriginal(').length,2);
 actual=actual.replace('async function runMatrixCaseOriginal(','export async function runMatrixCase(');
 assert.equal(actual,body(native,'export async function runMatrixCase(','\nexport async function runMatrixInvocation'));
 assert.equal(sha(actual),'92fc187e53a8ac30684ebbfc6987b1ebbed66de395ee61ab15455af28bd463ef');
 const wrapper='export async function runMatrixCase(args){\n stock037PublishedIdentityV1();\n return runMatrixCaseOriginal(args);\n}';assert.ok(source.includes(wrapper));
 const bridge=body(source,'async function installMatrixThreadplaneBridge(','\nexport async function runMatrixCase(');
 assert.equal(bridge,body(native,'async function installMatrixThreadplaneBridge(','\nexport async function runMatrixCase('));
 assert.equal(sha(bridge),'58154a50b158bb11ff5d708d5165ce6b1e5ab61ddb3ddbc85a12d01d93f74823');
 for(const malformed of [source.replace('TRACE-V3-END ack','TRACE-V3-END setup'),source.replace('TRACE-V3-END ack','TRACE-V3-BEGIN ack'),source.replace('TRACE-V3-BEGIN ack','TRACE-V3-BEGIN ninth'),source+'// TRACE-V3-BEGIN ninth\n'])assert.throws(()=>parse(malformed));
 for(const malformed of [source+' // TRACE-V3-BEGIN ninth\n // TRACE-V3-END ninth\n',source.replace(' // TRACE-V3-END stop\n',''),source.replace(' // TRACE-V3-BEGIN ack\n',''),source.replace(' // TRACE-V3-BEGIN ack\n',' // TRACE-V3-BEGIN finish\n')])assert.throws(()=>parse(malformed));
});
test('case has only fixed local, ordinary and fixed CPU exports and remains fixed037 at its local identity gate',async()=>{
 assert.deepEqual([...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(m=>m[1]),['runLocalOwnedMarkdownCaseV1','runLocalSharedSignalsCaseV1','runMatrixCase','runStock037CpuDiagnosticCaseV1']);
 const {seams}=parse(source),prefix=seams.publish.slice(0,seams.publish.indexOf(' const traceDiagnostic='));
 const check=AsyncFunction('value','createHash','TRACE_POLICY','TRACE_POLICY_SHA256',prefix+'validateIdentity(value);return true;');
 const identity={id:'stock037-case',profile:'threadplane',historyCount:10,responseBytes:100,journey:'history-reading',stockVersion:'0.3.7',buildSha256:'a'.repeat(64)};
 assert.equal(await check(identity,createHash,policy,'a'.repeat(64)),true);
 for(const stockVersion of ['0.3.6','0.3.8',null])await assert.rejects(check({...identity,stockVersion},createHash,policy,'a'.repeat(64)),/arguments/);
});
test('fixture write failure preserves the native pre-server dispatch boundary',async()=>{
 const start=source.indexOf("  deadline.check();fixture=await wait(artifacts.writeJSON('fixture-private.json'");
 const end=source.indexOf('  serverOriginal=launchCaseServer(',start);assert.ok(start>=0&&end>start);
 let reads=0;const failure=Error('authored-fixture-write-refused');
 const run=AsyncFunction('p',`const deadline={check(){}},wait=async x=>x,STAGES={transcript:10},artifacts={writeJSON:()=>Promise.reject(p.failure)},source={},profile='threadplane';let fixture,beforeFacts;const collectMatrixProvenance=()=>{p.read();};${source.slice(start,end)}`);
 await assert.rejects(run({failure,read(){reads++;}}),e=>e===failure);assert.equal(reads,0);
});
test('V3 closed diagnostic, raw and five-input source-bound owner replace V2 synchronous decoding',()=>{
 assert.match(source,/schema:'threadplane-aimock-trace-case-v3'/);
 assert.match(source,/runAimockTraceDecoderOwnerV3\(\{identity:traceIdentity,store,artifacts,caseStarted:started,invocationStarted\}\)/);
 assert.match(source,/createAimockTraceRawEvidenceV3\(traceSnapshot\)/);
 assert.doesNotMatch(source,/validateAimockTraceV[12]|analyzeAimockTraceCostsV[12]|inflate|gunzip|decoder-child-v3/);
});
test('typed genuine build is awaited and hashed before the delayed collector constructor',async()=>{
 const {seams}=parse(source);let resolve,constructs=0,reads=0;
 const pending=new Promise(r=>{resolve=r;});const build={typed:'actual-build',dependencies:{sdk:'0.3.7'}};
 const run=AsyncFunction('p',`const {createHash}=p,slot={id:'stock-case',selection:{profile:'threadplane'}},profile='threadplane',historyCount=8,responseBytes=128,journey='history-reading',started=10,performance={now:()=>20},deadline={remaining:()=>100},STAGES={progress:10,transcript:10},wait=p.wait,browser={},context={},page={},server={origin:'http://localhost'};const stock037PublishedIdentityV1=()=>{},threadplaneBuildEvidence=p.read,waitStock037BuildOriginalV1=(value)=>value,assertStock037BuildV1=x=>x,createAimockTraceCaptureV3=p.capture;${seams.create}${seams.setup}return{traceIdentity,traceBuild,trace};`);
 const result=run({createHash,read:()=>{reads++;return pending;},wait:x=>x,capture:options=>{constructs++;assert.equal(options.identity.buildSha256,createHash('sha256').update(JSON.stringify(build)).digest('hex'));return{setup:async()=>{},assertBeforeStart(){}};}});
 await Promise.resolve();assert.equal(reads,1);assert.equal(constructs,0);resolve(build);
 const value=await result;assert.equal(constructs,1);assert.deepEqual(value.traceIdentity,{id:'stock-case',profile:'threadplane',historyCount:8,responseBytes:128,journey:'history-reading',stockVersion:'0.3.7',buildSha256:createHash('sha256').update(JSON.stringify(build)).digest('hex')});
});
test('complete imports are closed, with no child, guard override or alternate decoding dependency',()=>{
 assert.deepEqual(source.split('\n').filter(line=>line.startsWith('import ')),[
 "import path from 'node:path';",
 "import {fileURLToPath} from 'node:url';",
 "import {performance} from 'node:perf_hooks';",
 "import {createHash} from 'node:crypto';",
 "import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';",
 "import {assertStock037BuildV1,stock037PublishedIdentityV1,waitStock037BuildOriginalV1} from './aimock-stock037-v1.mjs';",
 "import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION,nativeHistorySeekV4 as nativeHistorySeek} from './matrix-policy-v5.mjs';",
 "import {createMatrixDiagnostics} from './matrix-diagnostics-v1.mjs';",
 "import {createMatrixReadinessControllerV5} from './matrix-readiness-v5.mjs';",
 "import {createMatrixDeadline,collectMatrixProvenance,captureMatrixFinalBookend,createMatrixReadinessPortV5,installMatrixWheelRecorder,requireMatrixWheelDelivery} from './matrix-run-v5.mjs';",
 "import {createAimockTraceCaptureV3,createAimockTraceRawEvidenceV3} from './aimock-trace-capture-v3.mjs';",
 "import {runAimockTraceDecoderOwnerV3} from './aimock-trace-decoder-owner-v3.mjs';",
 "import {createStock037CpuCaptureV1} from './aimock-stock037-cpu-capture-v1.mjs';",
 "import {SEMANTIC_LARGE_V3_POLICY as TRACE_POLICY,SEMANTIC_LARGE_V3_POLICY_SHA256 as TRACE_POLICY_SHA256} from './semantic-large-v3-policy.mjs';",
 "import {assertLocalSharedSignalsExecutionsReadyV1,localSharedSignalsSlotV1,localSharedSignalsRoleRootV1} from '../threadplane-local-shared-signals/fixed-experiment-v1.mjs';",
 "import {createLocalSharedSignalsBuildGuardV1,waitLocalSharedSignalsOriginalV1} from './threadplane-local-shared-signals-build-v1.mjs';",
 "import {assertLocalOwnedMarkdownExecutionsReadyV1,localOwnedMarkdownSlotV1,localOwnedMarkdownRoleRootV1} from '../threadplane-local-owned-markdown/fixed-experiment-v1.mjs';",
 "import {createLocalOwnedMarkdownBuildGuardV1,waitLocalOwnedMarkdownOriginalV1} from './threadplane-local-owned-markdown-build-v1.mjs';",
 "import {SHARED_SIGNALS_POLICY_V1,OWNED_MARKDOWN_POLICY_V1} from '../threadplane-local-experiments/closed-policies-v1.mjs';",
 ]);
 const active=source.slice(source.indexOf('const readinessAck='),source.indexOf('readinessController.assertBeforeWheel();'));
 assert.doesNotMatch(active,/assertStock037|threadplaneBuildEvidence|runAimockTraceDecoderOwner/);
});
test('public wrapper accessor refuses before any argument property is touched',async()=>{
 const wrapper=body(source,'export async function runMatrixCase(args){','\n\nconst STOCK037_CPU_TOKEN').replace('export async function','async function');let reads=0;
 const run=AsyncFunction('stock037PublishedIdentityV1','runMatrixCaseOriginal',wrapper+';return runMatrixCase(new Proxy({},{get(){throw Error("property-touched");}}));');
 await assert.rejects(run(()=>{throw Error('stock037-published-identity-unavailable');},()=>{reads++;}),/stock037-published-identity-unavailable/);assert.equal(reads,0);
});
test('rejected typed build or guard never constructs a collector',async()=>{
 const {seams}=parse(source);let constructs=0;
 const run=AsyncFunction('p',`const {createHash}=p,slot={id:'stock-case',selection:{profile:'threadplane'}},profile='threadplane',historyCount=8,responseBytes=128,journey='history-reading',started=10,performance={now:()=>20},deadline={remaining:()=>100},STAGES={progress:10,transcript:10},wait=x=>x,browser={},context={},page={},server={origin:'http://localhost'},stock037PublishedIdentityV1=()=>{},threadplaneBuildEvidence=p.read,waitStock037BuildOriginalV1=x=>x,assertStock037BuildV1=p.guard,createAimockTraceCaptureV3=p.capture;${seams.create}${seams.setup}`);
 for(const p of [{read:()=>Promise.reject(Error('typed-read')),guard:x=>x},{read:()=>Promise.resolve({}),guard:()=>{throw Error('typed-guard');}}])await assert.rejects(run({...p,createHash,capture:()=>{constructs++;}}),/typed-(read|guard)/);
 assert.equal(constructs,0);
});
async function cleanupProbe({hook=null,clock=110,repeat=false,reject=false}={}){
 const {seams}=parse(source),calls=[];let end;
 const run=AsyncFunction('p',`const cleanupStarted=100,LIMITS={cleanupMs:30},STAGES={progress:10};let traceCleanupEnd=null,traceFailure=null,cpuFailure=null;const cpu=null,trace=p.trace,cleanupWait=p.wait;${seams['cleanup-stop']}${repeat?seams['cleanup-stop']:''}p.browserClose();return{traceCleanupEnd,traceFailure};`);
 const original=hook;const result=run({trace:hook===false?null:{beforeBrowserClose(){calls.push('hook');return original;}},wait(value){assert.equal(value,original);calls.push('await');return reject?Promise.reject(Error('finish-rejected')):value;},browserClose(){calls.push('browser-close');end=clock;}});
 return{result,calls,get end(){return end;}};
}
test('cleanup awaits the exact returned finish attention before native browser close',async()=>{
 let resolve;const original=new Promise(r=>{resolve=r;});const p=await cleanupProbe({hook:original});await Promise.resolve();assert.deepEqual(p.calls,['hook','await']);resolve();const result=await p.result;assert.deepEqual(p.calls,['hook','await','browser-close']);assert.equal(result.traceCleanupEnd,130);
});
test('cleanup null/no collector creates no finish and rejection stays unavailable',async()=>{
 for(const hook of [null,false]){const p=await cleanupProbe({hook});const result=await p.result;assert.equal(result.traceFailure,null);assert.ok(!p.calls.includes('await'));}
 const p=await cleanupProbe({hook:Promise.resolve(),reject:true,repeat:true});const result=await p.result;assert.equal(result.traceFailure,'aimock-trace-stop-unavailable');assert.equal(result.traceCleanupEnd,130);
 assert.equal((parse(source).seams['cleanup-stop'].match(/cleanupStarted\+LIMITS.cleanupMs/g)??[]).length,1);
});
test('remaining closure preserves negative deadline facts and cleanup derives only once from native start',()=>{
 const {seams}=parse(source);assert.match(seams.setup,/remaining:\(\)=>Math.min\(deadline.remaining\(\),traceCleanupEnd===null\?Infinity:traceCleanupEnd-performance.now\(\)\)/);
 assert.match(seams['cleanup-stop'],/traceCleanupEnd\?\?=cleanupStarted\+LIMITS.cleanupMs;/);
 assert.doesNotMatch(seams['cleanup-stop'],/void|Promise.resolve|cleanupStarted\s*=|Math.max|performance.now/);
 assert.match(seams['cleanup-seal'],/if\(trace\)try\{trace.afterBrowserClose\(\);traceSnapshot=trace.seal\(\)/);
});
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const flags={performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
const policy={schemas:{raw:'aimock-semantic-large-raw-snapshot-v3',receipt:'aimock-trace-capture-v3',decoded:'aimock-semantic-large-decoded-v3',owner:'aimock-decoder-owner-v3',originals:'aimock-decoder-originals-v3',validation:'aimock-semantic-large-validation-evidence-v3'},flags,captureProfile:'semantic-task-layout-large-v3',config:{traceConfig:{includedCategories:['devtools.timeline','disabled-by-default-devtools.timeline']}}};
async function publishProbe(options={}){
 const {seams}=parse(source),writes=[],reads=[],build={actual:'typed-default-build'},nativeFailure=options.nativeFailure??null;let nativeWrites=0,clock=options.clock??1000;
 const values=new Map();const p={createHash,TRACE_POLICY:policy,TRACE_POLICY_SHA256:'a'.repeat(64),build,snapshot:options.snapshot??null,clock:()=>clock,readBuild:()=>{reads.push('build');return options.afterRead??Promise.resolve(options.afterBuild??build);},guard:x=>x,wait:async(original,ms,label)=>{if(options.expire?.(label)){clock=options.expiredClock??270000;throw Error('attention-unsettled');}return original;},raw:s=>s,owner:options.owner??(async()=>{throw Error('owner-refused');}),store:{stats:()=>options.storeStats??({pendingOriginals:0,pendingWriters:0,unsafeWriter:false}),readJSON:async ref=>{reads.push(ref.path);return options.read?options.read(ref,values):structuredClone(values.get(ref.path));}},artifacts:{stats:()=>({}),writeJSON(name,value,kind){writes.push({name,value,kind});values.set('stock-case/'+name,structuredClone(value));if(options.write)return options.write(name,value,kind);return Promise.resolve({path:'stock-case/'+name,bytes:Buffer.byteLength(JSON.stringify(value)),sha256:sha(value)});}},nativeWrite:()=>{nativeWrites++;}};
 const run=AsyncFunction('p',`const {createHash,TRACE_POLICY,TRACE_POLICY_SHA256,store,artifacts}=p,slot={id:'stock-case',selection:{profile:'threadplane'}},profile='threadplane',historyCount=8,responseBytes=128,journey='history-reading',started=0,invocationStarted=0,performance={now:p.clock},deadline={remaining:()=>240000-p.clock(),check(){}},LIMITS={caseMs:240000,invocationMs:1200000,cleanupMs:30000},STAGES={progress:10,transcript:10},wait=p.wait,stock037PublishedIdentityV1=()=>{},threadplaneBuildEvidence=p.readBuild,waitStock037BuildOriginalV1=(x,wait,ms,label)=>wait(x,ms,label),assertStock037BuildV1=p.guard,createAimockTraceRawEvidenceV3=p.raw,runAimockTraceDecoderOwnerV3=p.owner;let failure=p.nativeFailure??null,unsafeOutstanding=false,stopInvocation=false;const result={status:failure?'invalid':'matrix-pass',failure,admission:{native:true}};${seams.create}traceBuild=p.build;traceIdentity={id:slot.id,profile,historyCount,responseBytes,journey,stockVersion:'0.3.7',buildSha256:createHash('sha256').update(JSON.stringify(traceBuild)).digest('hex')};traceSnapshot=p.snapshot;traceCleanupEnd=p.cleanupEnd??270000;${seams.publish}${seams.stop}p.nativeWrite();return{result,unsafeOutstanding,stopInvocation};`);
 p.nativeFailure=nativeFailure;p.cleanupEnd=options.cleanupEnd;
 try{return{value:await run(p),error:null,writes,reads,nativeWrites};}catch(error){return{value:null,error,writes,reads,nativeWrites};}
}
test('postbuild genuine guard executes without snapshot and refuses absence/drift without native rewrite',async()=>{
 const value=await publishProbe({nativeFailure:{message:'matrix-rendered-readiness-unavailable'}});assert.deepEqual(value.reads,['build']);assert.equal(value.value.result.status,'invalid');assert.equal(value.value.result.failure.message,'matrix-rendered-readiness-unavailable');assert.equal(value.value.result.traceDiagnostic.status,'unavailable');assert.equal(value.value.stopInvocation,true);assert.equal(value.writes.length,0);
 const drift=await publishProbe({afterBuild:{actual:'different'}});assert.equal(drift.value.result.traceDiagnostic.status,'unavailable');assert.equal(drift.writes.length,0);
});
test('pending typed after-read original rejects unsafe before unchanged native writes, preserving native refusal',async()=>{
 const value=await publishProbe({nativeFailure:{message:'matrix-active-readiness-deadline'},afterRead:new Promise(()=>{}),expire:label=>label==='aimock-stock037-after'});
 assert.equal(value.error?.unsafeOutstanding,true);assert.equal(value.error?.message,'matrix-active-readiness-deadline');assert.ok(value.error?.cause);assert.equal(value.nativeWrites,0);assert.equal(value.writes.length,0);
});
test('safely rejected typed postbuild read remains unavailable and stops without fabricating unsafe',async()=>{
 const value=await publishProbe({afterRead:Promise.reject(Error('typed-read-refused'))});assert.equal(value.error,null);assert.equal(value.value.unsafeOutstanding,false);assert.equal(value.value.stopInvocation,true);assert.equal(value.value.result.traceDiagnostic.status,'unavailable');
});

// Independently exercised authored DTO model; no real guards, processes or event decoder.
{
const seams=text=>({blocks:parse(text).seams});
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
function base(profile='threadplane'){
 const state={time:100,constructorCalls:0,guardCalls:[],reads:[],writes:[],ownerCalls:[],nativeWrites:0,stats:{pendingOriginals:0,pendingWriters:0,unsafeWriter:false}};
 const selection={profile,historyCount:10,responseBytes:100,journey:'history-reading'},slot={id:'case-1',selection};
 const build={schema:'authored-genuine-build',profile,packages:[{name:'example-sdk',version:'actual'}],assets:[{sha256:'d'.repeat(64)}]};
 const ports={...selection,slot,createHash,Buffer,TextDecoder,process:{pid:1001},started:0,invocationStarted:0,LIMITS:limits,STAGES:stages,TRACE_POLICY:policy,TRACE_POLICY_SHA256:policySha,
  performance:{now:()=>state.time},deadline:{remaining:()=>240000-state.time,check(){if(state.time>=240000)throw Error('case-deadline');}},
  wait:async original=>original,stock037PublishedIdentityV1(){return {version:'0.3.7',doNotHash:'pin'};},assertStock037BuildV1:x=>x,
  threadplaneBuildEvidence:async profile=>{state.reads.push(profile);return clone(build);},
  waitStock037BuildOriginalV1:async(original,wait,ms,label)=>{state.guardCalls.push(label);return wait(original,ms,label);},
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
async function authoredGuard(){
 const guardSource=await read('aimock-stock037-v1.mjs'),hostSource=await read('aimock-stock034-v1.mjs');
 const hostHashes=vm.runInNewContext(hostSource.slice(0,hostSource.indexOf('export const STOCK034_INTEGRITIES')).replace('export const','const')+';STOCK034_SOURCE_HASHES_V1');
 const selected={'package.json':'cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579','package-lock.json':'a'.repeat(64),'apps/threadplane/package.json':'b'.repeat(64)};
 const pins={schema:'threadplane-published-stock037-pins-v1',version:'0.3.7',selectedSourceHashes:selected,packages:['a2ui','chat','langgraph','render','telemetry'].map(name=>({name:'@threadplane/'+name,version:'0.3.7',resolved:`https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.7.tgz`,integrity:'sha512-'+Buffer.alloc(64,7).toString('base64')}))};
 const load=value=>vm.runInNewContext(guardSource.replace(/^import .*;\n/gm,'').replace(/export /g,'')+';({assertStock037BuildV1,stock037PublishedIdentityV1,waitStock037BuildOriginalV1})',{types,Buffer,Error,STOCK034_SOURCE_HASHES_V1:hostHashes,STOCK037_PUBLISHED_PINS_V1:value});
 const build={production:true,framework:{name:'Angular',version:'21.2.25'},settings:{optimization:true,sourceMaps:false},sourceHashes:{...hostHashes,...selected},packages:pins.packages.map(p=>({...p,resolutionPath:`apps/threadplane/node_modules/${p.name}`})),authoredRetainedExtra:{asset:'complete-record-hashed'}};
 return {api:load(pins),load,pins,build};
}
test('source-VM typed037 guard binds exact complete actual record before collector and after publication',async()=>{
 const {api,build}=await authoredGuard(),model=base();Object.assign(model.ports,api,{threadplaneBuildEvidence:async()=>build});
 const out=await execute(setupText()+tail,model.ports);assert.equal(out.traceBuild,build);assert.equal(out.traceIdentity.stockVersion,'0.3.7');assert.equal(out.traceIdentity.buildSha256,sha(JSON.stringify(build)));assert.notEqual(out.traceIdentity.buildSha256,sha(JSON.stringify(api.stock037PublishedIdentityV1())));
 for(const version of ['0.3.6','0.3.8']){
  const wrong=clone(build);wrong.packages.forEach(p=>p.version=version);
  const before=base();Object.assign(before.ports,api,{threadplaneBuildEvidence:async()=>wrong});
  await assert.rejects(execute(setupText()+tail,before.ports),/build-package-identity/);assert.equal(before.state.constructorCalls,0);
  const after=completeModel(base());let calls=0;
  after.ports.assertStock037BuildV1=value=>{if(++calls===2)return api.assertStock037BuildV1(wrong);return value;};
  const result=await publish(after);assert.equal(result.result.traceDiagnostic.status,'unavailable');assert.equal(after.state.writes.length,0);
 }
});
test('unavailable source-VM authority refuses before argument or browser/IO work, and wrong release pins refuse',async()=>{
 const {load,pins}=await authoredGuard(),api=load(null);let properties=0,work=0;
 const wrapper=body(source,'export async function runMatrixCase(args){','\n\nconst STOCK037_CPU_TOKEN').replace('export async function','async function');
 const run=AsyncFunction('stock037PublishedIdentityV1','runMatrixCaseOriginal','args',wrapper+';return runMatrixCase(args);');
 await assert.rejects(run(api.stock037PublishedIdentityV1,()=>{work++;},new Proxy({},{get(){properties++;}})),/published-identity-unavailable/);
 assert.equal(properties,0);assert.equal(work,0);
 for(const version of ['0.3.6','0.3.8']){const wrong=clone(pins);wrong.version=version;assert.throws(()=>load(wrong),/pins-identity/);}
});
function completeModel(model){
 const {state,ports,build}=model,id={id:ports.slot.id,...ports.slot.selection,stockVersion:'0.3.7',buildSha256:sha(JSON.stringify(build))};
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
 return model;
}
async function publish(model,extra=''){
 return execute(setupText()+`traceSnapshot=state.snapshot;traceCleanupEnd=state.time;`+extra+snippets().publish+'state.nativeWrites++;'+tail,{...model.ports,state:model.state});
}

test('stock authored complete aggregate joins raw, actual owner handles, originals and validation',async()=>{
 const model=completeModel(base()),out=await publish(model);
 assert.equal(out.result.traceDiagnostic.status,'complete',out.result.traceDiagnostic.failure??'unexpected unavailable');
 assert.deepEqual(model.state.writes.map(r=>[r.name,r.kind]),[['aimock-trace-v3-private.json','trace-v3'],['aimock-trace-v3-validation.json','evidence']]);
 const call=model.state.ownerCalls[0];assert.deepEqual(Object.keys(call),['identity','store','artifacts','caseStarted','invocationStarted']);assert.equal(call.store,model.ports.store);assert.equal(call.artifacts,model.ports.artifacts);assert.equal(call.identity.stockVersion,'0.3.7');
 assert.deepEqual(Object.keys(out.result.traceDiagnostic),['schema','profile','status','failure','buildSha256','rawCapture','decoderOriginals','validation','policySha256','performance','scoringEligibility','FPS','cpuTime']);
 for(const key of Object.keys(flags))assert.equal(out.result.traceDiagnostic[key],flags[key]);
 assert.equal(out.result.traceDiagnostic.schema,'threadplane-aimock-trace-case-v3');
});
test('native readiness refusal remains byte-exact with independently complete trace',async()=>{
 const model=completeModel(base());model.ports.failure={message:'matrix-active-readiness-deadline'};model.ports.result={status:'invalid',failure:model.ports.failure,admission:null};
 const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'complete');assert.deepEqual(out.result.failure,{message:'matrix-active-readiness-deadline'});assert.equal(out.result.status,'invalid');assert.equal(out.result.admission,null);
});
test('native fixture or source refusal remains unchanged even when trace evidence is complete',async()=>{
 for(const message of ['matrix-fixture-write-refused','matrix-source-assets-or-locks-changed']){
  const model=completeModel(base()),failure={message,details:{native:true}};
  model.ports.failure=failure;model.ports.result={status:'invalid',failure,admission:null};
  const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'complete');assert.equal(out.result.status,'invalid');assert.equal(out.result.failure,failure);assert.equal(out.result.admission,null);
 }
});
for(const [label,mutate]of [
 ['data-loss',m=>m.state.snapshot.receipt.dataLossOccurred=true],
 ['missing-EOF',m=>m.state.snapshot.receipt.eof=false],
 ['missing-IO-close',m=>m.state.snapshot.receipt.ioClosed=false],
 ['truncation',m=>m.state.snapshot.receipt.truncated=true],
 ['capture-owner-pending',m=>m.state.snapshot.receipt.owners[0].pending=1],
 ['ninety-percent',m=>{const r=m.state.snapshot.receipt;r.bufferUsage={count:1,first:.9,last:.9,max:.9};r.bufferNotificationsV3={totalCount:1,first8:[[1,1,.9,null,null]],last8:[],retainedCount:1,droppedCount:0,truncated:false};}],
 ['wrong-policy',m=>m.state.wrapper.policySha256='b'.repeat(64)],
 ['wrong-raw-identity',m=>m.state.wrapper.identity={...m.state.wrapper.identity,buildSha256:'b'.repeat(64)}],
 ['raw-stock036',m=>m.state.wrapper.identity={...m.state.wrapper.identity,stockVersion:'0.3.6'}],
 ['raw-stock038',m=>m.state.wrapper.identity={...m.state.wrapper.identity,stockVersion:'0.3.8'}],
 ['decoded-stock036',m=>m.state.owned.decoderResult.identity={...m.state.owned.decoderResult.identity,stockVersion:'0.3.6'}],
 ['decoded-stock038',m=>m.state.owned.decoderResult.identity={...m.state.owned.decoderResult.identity,stockVersion:'0.3.8'}],
 ['child-extra',m=>m.state.owned.decoderResult.events=[]],
 ['child-flag',m=>m.state.owned.decoderResult.performance=true],
 ['child-cost-binding',m=>m.state.owned.decoderResult.costs.binding={...m.state.owned.decoderResult.costs.binding,pid:42}],
 ['child-mapper-extra',m=>m.state.owned.decoderResult.rendererMapping.extra=1],
 ['owner-original-ref',m=>m.state.owned.decoderOwner.originalsReference={...m.state.owned.decoderOriginals,sha256:'b'.repeat(64)}],
 ['owner-resource',m=>m.state.owned.decoderOwner.rss.pending=1],
 ['owner-source',m=>m.state.owned.decoderOwner.nodeExecutableSha256='b'.repeat(64)],
 ['owner-clock',m=>m.state.owned.decoderOwner.clock.successDeadlineMs++],
 ['owner-flag',m=>m.state.owned.decoderOwner.cpuTime=0],
])test('stock strict qualification refuses '+label,async()=>{
 const model=completeModel(base());mutate(model);const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.equal(out.result.status,'matrix-pass');assert.ok(model.state.writes.filter(r=>r.name==='aimock-trace-v3-private.json').length<=1);
});

function mutateOriginals(model,mutate){const ref=model.state.owned.decoderOriginals,value=model.state.files.get(ref.path);mutate(value);const text=JSON.stringify(value),updated={path:ref.path,bytes:Buffer.byteLength(text),sha256:sha(text)};model.state.files.set(ref.path,value);model.state.owned.decoderOriginals=updated;model.state.owned.decoderOwner.originalsReference=updated;}
for(const [label,mutate]of [
 ['wrong-schema',v=>v.schema='aimock-decoder-originals-v2'],['extra',v=>v.events=[]],['identity',v=>v.identity.buildSha256='b'.repeat(64)],['flags',v=>v.scoringEligibility=true],
 ['decoder-PID',v=>v.decoder.pid=9],['parent-PID',v=>{v.decoder.parentPid=9;v.queries.forEach(q=>q.parentPid=9);}],['spawn-pending',v=>v.decoder.spawn.status='pending'],['exit-nonzero',v=>v.decoder.exit.code=7],['process-close-missing',v=>v.decoder.close.observedMs=null],
 ['pipe-EOF-missing',v=>v.decoder.stdout.endMs=null],['pipe-close-missing',v=>v.decoder.stderr.closeMs=null],['stdin-callback-missing',v=>v.decoder.stdin.writeSettledMs=null],['stdin-finish-missing',v=>v.decoder.stdin.finishMs=null],['pipe-hash',v=>v.decoder.stdout.completeSha256='b'.repeat(64)],
 ['query-witness',v=>v.queries[1].startWitness='Fri Nov  6 00:00:01 2026'],['query-PID-duplicate',v=>v.queries[1].pid=v.queries[0].pid],['query-stdout-hash',v=>v.queries[0].stdout.completeSha256='b'.repeat(64)],['query-clock-equality',v=>v.queries[0].exit.observedMs=v.queries[0].deadlineMs],['cleanup-signal',v=>v.decoder.cleanup.termAccepted=true],
])test('stock revalidates actual originals rather than trusting compact owner: '+label,async()=>{
 const model=completeModel(base());mutateOriginals(model,mutate);const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);
});
test('unknown unavailable owner reason cannot enter approved validation evidence',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.status='unavailable';model.state.owned.decoderOwner.reason='timeline-owner-invented';const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.writes.some(r=>r.name==='aimock-trace-v3-validation.json'),false);
});
for(const [phase,label]of [['raw-write','aimock-trace-raw-write'],['raw-read','aimock-trace-raw-read'],['owner','aimock-trace-decoder-owner'],['originals-read','aimock-trace-originals-read'],['validation-write','aimock-trace-validation-write'],['validation-read','aimock-trace-validation-read']])test('pending '+phase+' original prevents all subsequent native-file dispatch',async()=>{
 const model=completeModel(base()),pending=deferred(),write=model.ports.artifacts.writeJSON,read=model.ports.store.readJSON;
 model.ports.artifacts.writeJSON=(name,...rest)=>(phase==='raw-write'&&name==='aimock-trace-v3-private.json'||phase==='validation-write'&&name==='aimock-trace-v3-validation.json')?pending.original:write(name,...rest);
 model.ports.store.readJSON=(ref,...rest)=>(phase==='raw-read'&&ref.path.endsWith('private.json')||phase==='originals-read'&&ref.path.endsWith('decoder-originals.json')||phase==='validation-read'&&ref.path.endsWith('validation.json'))?pending.original:read(ref,...rest);
 if(phase==='owner')model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 model.ports.wait=async(original,ms,actual)=>{if(actual===label)throw Error('attention-unsettled');return original;};
 model.ports.failure={message:'matrix-active-readiness-deadline'};
 await assert.rejects(publish(model),error=>error.unsafeOutstanding===true&&error.message==='matrix-active-readiness-deadline'&&error.cause?.message==='attention-unsettled');assert.equal(model.state.nativeWrites,0);
 const count=model.state.writes.length;pending.resolve(model.state.owned);await Promise.resolve();assert.equal(model.state.writes.length,count);
});
test('owner operation settlement does not certify an inner pending store writer',async()=>{
 const model=completeModel(base());model.ports.runAimockTraceDecoderOwnerV3=async()=>{model.state.stats.pendingWriters=1;model.state.owned.decoderOwner.unsafeOutstanding=true;return model.state.owned;};
 await assert.rejects(publish(model),error=>error.unsafeOutstanding===true);assert.equal(model.state.nativeWrites,0);assert.equal(model.state.writes.some(r=>r.name==='aimock-trace-v3-validation.json'),false);
});
test('safe owner failure retains actually observed valid child DTO once but never qualifies',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.status='unavailable';model.state.owned.decoderOwner.reason='timeline-owner-process';const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.equal(model.state.nativeWrites,1);
 const validation=model.state.files.get('case-1/aimock-trace-v3-validation.json');assert.equal(validation.decoderResult.status,'valid');assert.equal(validation.decoderOwner.status,'unavailable');assert.ok(!Object.hasOwn(out.result.traceDiagnostic,'decoderResult'));
});
test('late settled owner unsafe remains unsafe independently of clear store statistics',async()=>{
 const model=completeModel(base()),pending=deferred();model.state.owned.decoderOwner.unsafeOutstanding=true;model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner'){queueMicrotask(()=>pending.resolve(model.state.owned));throw Error('owner-attention-expired');}return original;};
 await assert.rejects(publish(model,'traceCleanupEnd=150;'),error=>error.unsafeOutstanding===true);assert.equal(model.state.nativeWrites,0);assert.equal(model.state.writes.length,1);assert.equal(model.state.stats.pendingWriters,0);
});
test('late safely closed owner cannot rescue trace or dispatch validation after failed attention',async()=>{
 const model=completeModel(base()),pending=deferred();model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner'){queueMicrotask(()=>pending.resolve(model.state.owned));throw Error('owner-attention-expired');}return original;};
 const out=await publish(model,'traceCleanupEnd=150;');assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);assert.equal(model.state.writes.length,1);assert.equal(model.state.nativeWrites,1);assert.equal(out.unsafeOutstanding,false);
});
test('late safely rejected original remains unavailable without invented pending work or retry',async()=>{
 const model=completeModel(base()),pending=deferred();model.ports.runAimockTraceDecoderOwnerV3=()=>pending.original;
 model.ports.wait=async(original,ms,label)=>{if(label==='aimock-trace-decoder-owner'){queueMicrotask(()=>pending.reject(Error('owner-original-refused')));throw Error('owner-attention-expired');}return original;};
 const out=await publish(model,'traceCleanupEnd=150;');assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.unsafeOutstanding,false);assert.equal(model.state.nativeWrites,1);assert.equal(model.state.writes.length,1);
});
test('strict receipt checks distinguish loss below usage limit, ninety percent, EOF and IO close',async()=>{
 const model=completeModel(base()),prefix=snippets().publish.slice(0,snippets().publish.indexOf(' const traceDiagnostic='));
 const check=value=>execute(prefix+'receipt(value.receipt,value);return true;',{...model.ports,value});
 await check(clone(model.state.wrapper));
 for(const [mutate,reason]of [[r=>r.dataLossOccurred=true,'capture-facts'],[r=>r.eof=false,'capture-facts'],[r=>r.ioClosed=false,'capture-facts'],[r=>r.truncated=true,'capture-facts'],[r=>{r.bufferUsage={count:1,first:.9,last:.9,max:.9};r.bufferNotificationsV3={totalCount:1,first8:[[1,1,.9,null,null]],last8:[],retainedCount:1,droppedCount:0,truncated:false};},'buffer-usage']]){const value=clone(model.state.wrapper);mutate(value.receipt);await assert.rejects(check(value),error=>error.message.includes(reason));}
});
test('owner strict end equality prevents originals and validation dispatch',async()=>{
 const model=completeModel(base()),owner=model.ports.runAimockTraceDecoderOwnerV3;model.ports.runAimockTraceDecoderOwnerV3=async input=>{const out=await owner(input);model.state.time=out.decoderOwner.clock.successDeadlineMs;return out;};
 let originalsReads=0;const read=model.ports.store.readJSON;model.ports.store.readJSON=(ref,...args)=>{if(ref.path.endsWith('decoder-originals.json'))originalsReads++;return read(ref,...args);};
 const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(originalsReads,0);assert.equal(model.state.writes.length,1);
});
test('future owner closure facts refuse without a validation publication',async()=>{
 const model=completeModel(base());model.state.owned.decoderOwner.clock.originalsClosedMs=model.state.time+1;const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.writes.length,1);
});
for(const phase of ['raw-read','validation-read'])test('wrong '+phase+' complete readback refuses publication',async()=>{
 const model=completeModel(base()),read=model.ports.store.readJSON;model.ports.store.readJSON=async(ref,...args)=>{const v=await read(ref,...args);if(phase==='raw-read'&&ref.path.endsWith('private.json')||phase==='validation-read'&&ref.path.endsWith('validation.json'))v.policySha256='b'.repeat(64);return v;};
 const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(out.tracePublicationStop,true);
});
test('exclusive raw reference must match actual current case bytes and digest',async()=>{
 for(const change of [ref=>ref.path='other/aimock-trace-v3-private.json',ref=>ref.bytes++,ref=>ref.sha256='b'.repeat(64)]){const model=completeModel(base()),write=model.ports.artifacts.writeJSON;model.ports.artifacts.writeJSON=async(...args)=>{const ref=await write(...args);change(ref);return ref;};const out=await publish(model);assert.equal(out.result.traceDiagnostic.status,'unavailable');assert.equal(model.state.ownerCalls.length,0);}
});
test('terminal ownership observer is bounded by original and native cleanup facts with no renewed clock',()=>{
 const text=snippets().publish;
 assert.match(text,/Math.min\(Math.min\(started\+LIMITS.caseMs,invocationStarted\+LIMITS.invocationMs\)\+LIMITS.cleanupMs,traceCleanupEnd===null\?Infinity:traceCleanupEnd\)/);
 assert.match(text,/Error\(failure\?\.message\?\?'aimock-trace-publication-unsettled',\{cause:/);
 assert.match(text,/unsafeOutstandingError.unsafeOutstanding=true;throw unsafeOutstandingError;/);
 assert.doesNotMatch(text,/now\(\)\s*\+\s*(30000|LIMITS.cleanupMs)|nativeResult|failure.json|events\s*:|traceEvents\s*:/);
});
test('settled rejected actual owner original retains unsafe ownership despite clear store facts',async()=>{
 const model=completeModel(base()),originalFailure=Error('actual-owner-ownership-unknown');originalFailure.unsafeOutstanding=true;
 model.ports.failure={message:'matrix-active-readiness-deadline'};
 model.ports.runAimockTraceDecoderOwnerV3=async()=>{throw originalFailure;};
 await assert.rejects(publish(model),error=>error.unsafeOutstanding===true&&error.message==='matrix-active-readiness-deadline'&&error.cause===originalFailure);
 assert.equal(model.state.nativeWrites,0);assert.equal(model.state.stats.pendingWriters,0);assert.equal(model.state.stats.pendingOriginals,0);assert.equal(model.state.writes.length,1);
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

}

test('fixed CPU entry constructs only its literal slot without changing the ordinary wrapper', async () => {
 assert.match(source, /export async function runStock037CpuDiagnosticCaseV1\(/);
 const fixed=body(source,'export async function runStock037CpuDiagnosticCaseV1(','\n\nasync function runMatrixCaseOriginal(').replace('export async function','async function');
 const token={},calls=[];
 const run=AsyncFunction('stock037PublishedIdentityV1','runMatrixCaseOriginal','STOCK037_CPU_TOKEN',fixed+';return runStock037CpuDiagnosticCaseV1({store:1,out:2,invocationStarted:3});');
 await run(()=>{},(...args)=>calls.push(args),token);
 assert.equal(calls.length,1);assert.equal(calls[0][1],token);
 assert.deepEqual(calls[0][0],{store:1,out:2,invocationStarted:3,slot:{id:'threadplane-h10000-r6400-follow-stock037-cpu-samples-v1',kind:'positive',selection:{profile:'threadplane',historyCount:10000,responseBytes:6400,journey:'follow'}}});
});
test('CPU finish rejection cannot skip strict timeline finish', async () => {
 const fragment=parse(source).seams.finish;
 assert.match(fragment,/cpu\.finish\(\)/);
 const calls=[];
 const run=AsyncFunction('cpu','trace','message',`let cpuFailure=null,traceFailure=null;${fragment};return {cpuFailure,traceFailure};`);
 const value=await run({finish:async()=>{calls.push('cpu');throw Error('cpu-refused');}},{finish:async()=>calls.push('trace')},e=>e.message);
 assert.deepEqual(calls,['cpu','trace']);assert.equal(value.cpuFailure,'cpu-refused');assert.equal(value.traceFailure,null);
});
test('CPU cleanup and seal failures cannot skip existing strict trace release', async () => {
 const seams=parse(source).seams,calls=[];
 assert.match(seams['cleanup-stop'],/cpu\.beforeBrowserClose\(\)/);
 assert.match(seams['cleanup-seal'],/cpu\.seal\(\)/);
 const run=AsyncFunction('cpu','trace','message',`const cleanupStarted=100,LIMITS={cleanupMs:30},STAGES={progress:10},cleanupWait=async p=>p;let traceCleanupEnd=null,traceFailure=null,cpuFailure=null,cpuSnapshot=null,traceSnapshot=null,unsafeOutstanding=false;${seams['cleanup-stop']}${seams['cleanup-seal']};return {cpuFailure,unsafeOutstanding};`);
 const value=await run({beforeBrowserClose(){calls.push('cpu-stop');throw Error('cpu-stop-refused');},afterBrowserClose(){calls.push('cpu-after');},seal(){calls.push('cpu-seal');throw Error('cpu-seal-refused');}},{beforeBrowserClose(){calls.push('trace-stop');return null;},afterBrowserClose(){calls.push('trace-after');},seal(){calls.push('trace-seal');return{receipt:{unsafeOutstanding:false}};}},e=>e.message);
 assert.deepEqual(calls,['cpu-stop','trace-stop','cpu-after','cpu-seal','trace-after','trace-seal']);assert.equal(value.unsafeOutstanding,true);
});

test('fixed CPU entry rejects extra ports before dispatching the private case', async () => {
 const fixed=body(source,'export async function runStock037CpuDiagnosticCaseV1(','\n\nasync function runMatrixCaseOriginal(').replace('export async function','async function');
 let calls=0;const run=AsyncFunction('stock037PublishedIdentityV1','runMatrixCaseOriginal','STOCK037_CPU_TOKEN','value',fixed+';return runStock037CpuDiagnosticCaseV1(value);');
 for(const key of ['slot','selection','verify','browser','retry','timeout'])await assert.rejects(run(()=>{},()=>{calls++;},{},{store:1,out:2,invocationStarted:3,[key]:true}),/arguments/);
 assert.equal(calls,0);
});

async function cpuPublicationProbe({mutateRead=false,pendingWrite=false,invalidOwner=false,failure=null,absentData=false,unsafe=false,sealedSnapshot=null}={}){
 const block=parse(source).seams.publish;
 const cpuBlock=block.slice(block.lastIndexOf('\n if(cpuMode){'));
 const values=new Map(),writes=[],raw={nodes:[{id:1,unknown:'preserved'}],samples:[1],timeDeltas:[-1,0]},binding={schema:'binding-authored',assetHashes:{'0':'a','main.js':'b'}};
 const rawJson=JSON.stringify(raw),bindingJson=JSON.stringify(binding);
 const receipt={complete:!invalidOwner&&!failure,unsafeOutstanding:unsafe,issues:failure?[failure]:[],raw:{bytes:Buffer.byteLength(rawJson),sha256:sha(rawJson)},binding:{bytes:Buffer.byteLength(bindingJson),sha256:sha(bindingJson)}};
 if(absentData){receipt.raw=null;receipt.binding=null;}
 const p={failure,snapshot:sealedSnapshot??{rawJson:absentData?null:rawJson,bindingJson:absentData?null:bindingJson,receipt},writes,store:{readJSON:async ref=>{const value=values.get(ref.path);return mutateRead?{...value,changed:true}:value;}},artifacts:{writeJSON:async(name,value)=>{writes.push({name,value});if(pendingWrite)return new Promise(()=>{});const text=JSON.stringify(value),ref={path:'id/'+name,bytes:Buffer.byteLength(text),sha256:sha(text)};values.set(ref.path,structuredClone(value));return ref;}}};
 const run=AsyncFunction('p',`const {store,artifacts}=p,cpuMode=true,cpuFailure=p.failure,cpuSnapshot=p.snapshot,result={},STAGES={progress:10},deadline={check(){},remaining:()=>100},message=e=>e.message,sha=p.sha,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),need=(v,c)=>{if(!v)throw Error(c)},reference=(ref,name,value,cap)=>{need(ref.path==='id/'+name&&ref.bytes===Buffer.byteLength(JSON.stringify(value))&&ref.bytes<=cap&&ref.sha256===sha(JSON.stringify(value)),'reference');},storeUnknown=()=>false;let unsafeOutstanding=false,stopInvocation=false;const records=[];const traceRetain=original=>{const row={original,status:'pending'};records.push(row);original.then(()=>row.status='fulfilled',error=>{row.status='rejected';row.error=error;});return row;};const wait=async original=>{if(p.pendingWrite)throw Error('attention-expired');return original;};${cpuBlock};return{result,stopInvocation};`);
 try{return{value:await run({...p,sha,pendingWrite}),writes};}catch(error){return{error,writes};}
}
test('CPU publication uses exact canonical evidence readbacks and owner hash references without filtering unknown fields',async()=>{
 const value=await cpuPublicationProbe();assert.equal(value.error,undefined);
 assert.equal(value.value.result.cpuDiagnostic.status,'complete');
 assert.deepEqual(value.writes.map(w=>w.name),['stock037-cpu-owner-v1.json','stock037-cpu-profile-v1.json','stock037-cpu-binding-v1.json']);
 assert.equal(value.writes[1].value.nodes[0].unknown,'preserved');assert.deepEqual(value.writes[1].value.timeDeltas,[-1,0]);
});
test('CPU publication refuses changed readback or unavailable owner rather than promoting data success',async()=>{
 for(const options of [{mutateRead:true},{invalidOwner:true}]){
  const value=await cpuPublicationProbe(options);assert.equal(value.value.result.cpuDiagnostic.status,'unavailable');assert.equal(value.value.stopInvocation,true);
 }
});
test('pending original CPU writer prohibits subsequent native publication',async()=>{
 const value=await cpuPublicationProbe({pendingWrite:true});assert.equal(value.error?.unsafeOutstanding,true);assert.equal(value.writes.length,1);
});

test('CPU setup refusal leaves strict trace setup/prestart active; ordinary mode never creates CPU owner',async()=>{
 const seams=parse(source).seams;
 const setup=seams.setup;
 const run=AsyncFunction('p','token',`const STOCK037_CPU_TOKEN=p.token,{createHash}=p,slot={id:'stock-case',selection:{profile:'threadplane'}},profile='threadplane',historyCount=10000,responseBytes=6400,journey='follow',started=10,performance={now:()=>20},deadline={remaining:()=>100},STAGES={progress:10,transcript:10},wait=async x=>x,browser={},context={},page={},server={origin:'http://localhost'},stock037PublishedIdentityV1=()=>{},threadplaneBuildEvidence=async()=>({assetHashes:{'main.js':'a'.repeat(64)}}),waitStock037BuildOriginalV1=x=>x,assertStock037BuildV1=x=>x,createAimockTraceCaptureV3=p.trace,createStock037CpuCaptureV1=p.cpu,message=e=>e.message;${seams.create}${setup};return{cpuFailure,cpuMode};`);
 for(const mode of [true,false]){
  const calls=[],token={},p={token,createHash,cpu:()=>({setup:async()=>{calls.push('cpu-setup');throw Error('cpu-setup-refused');}}),trace:()=>({setup:async()=>calls.push('trace-setup'),assertBeforeStart:()=>calls.push('trace-prestart')})};
  const result=mode?await run(p,token):await run(p);
  assert.equal(result.cpuMode,mode);assert.equal(result.cpuFailure,mode?'cpu-setup-refused':null);
  assert.deepEqual(calls,mode?['cpu-setup','trace-setup','trace-prestart']:['trace-setup','trace-prestart']);
 }
});

test('safe CPU enable/start/stop deadline failures retain sealed owner facts exactly once without qualification',async()=>{
 for(const failure of ['cpu-enable-refused','cpu-start-deadline','cpu-stop-deadline']){
  const value=await cpuPublicationProbe({failure,absentData:failure!=='cpu-stop-deadline'});
  assert.equal(value.error,undefined);const d=value.value.result.cpuDiagnostic;
  assert.equal(d.status,'unavailable');assert.equal(d.failure,failure);assert.equal(value.value.stopInvocation,true);
  assert.ok(d.ownerReceipt);assert.equal(value.writes.filter(w=>w.name==='stock037-cpu-owner-v1.json').length,1);
  const receipt=value.writes.find(w=>w.name==='stock037-cpu-owner-v1.json').value;
  assert.equal(receipt.complete,false);assert.deepEqual(receipt.issues,[failure]);
  if(failure!=='cpu-stop-deadline'){assert.equal(d.rawCapture,null);assert.equal(d.binding,null);}
  else{assert.ok(d.rawCapture);assert.ok(d.binding);}
 }
});
test('unsafe CPU receipt never permits artifact writes',async()=>{
 const value=await cpuPublicationProbe({failure:'cpu-stop-unsettled',unsafe:true});
 assert.equal(value.writes.length,0);assert.equal(value.value.result.cpuDiagnostic.status,'unavailable');
});

test('real CPU owner sealed enable/start/stop deadline refusals survive actual case publication unchanged',async()=>{
 for(const fault of ['enable','start','stop']){
  let time=0;const session=new EventEmitter(),page=new EventEmitter(),context=new EventEmitter(),browser=new EventEmitter(),frame={};
  page.mainFrame=()=>frame;context.pages=()=>[page];context.newCDPSession=async()=>session;session.detach=async()=>{};
  session.send=async method=>{
   if(method==='Profiler.enable'&&fault==='enable')throw Error('authored-enable-rejection');
   if(method==='Browser.getVersion')return{product:'Chrome/156.0.8078.4',revision:'@f842f52ef39fd97b449eb27cff414bf05a98ddce',protocolVersion:'1.3',userAgent:'authored',jsVersion:'authored'};
   if(method==='Page.getFrameTree')return{frameTree:{frame:{id:'frame',url:'http://127.0.0.1:1234/'}}};
   if(method==='Target.getTargetInfo')return{targetInfo:{targetId:'target',type:'page',url:'http://127.0.0.1:1234/'}};
   if(method==='Profiler.stop')return{profile:{nodes:[{id:1,callFrame:{functionName:'(root)',scriptId:'0',url:'',lineNumber:-1,columnNumber:-1}}],startTime:0,endTime:10,samples:[1],timeDeltas:[1]}};
   return{};
  };
  const owner=createStock037CpuCaptureV1({now:()=>time,origin:0,identity:{id:'threadplane-h10000-r6400-follow-stock037-cpu-samples-v1',profile:'threadplane',historyCount:10000,responseBytes:6400,journey:'follow',stockVersion:'0.3.7',buildSha256:'a'.repeat(64)},wait:async(original,ms,label)=>{const value=await original;if(label==='stock037-cpu-'+fault&&fault!=='enable')time+=ms;return value;},remaining:()=>100000-time,stageMs:10000,assetHashes:{'main.js':'a'.repeat(64)}});
  let failure=null;
  try{await owner.setup({browser,context,page,expectedOrigin:'http://127.0.0.1:1234'});await owner.start();owner.markPublicAck();await owner.finish();}catch(error){failure=error.message;}
  try{await owner.beforeBrowserClose();}catch{}owner.afterBrowserClose();const snapshot=owner.seal();
  assert.equal(snapshot.receipt.complete,false);assert.equal(snapshot.receipt.unsafeOutstanding,false);assert.ok(failure);
  const result=await cpuPublicationProbe({failure,sealedSnapshot:snapshot});assert.equal(result.error,undefined);
  const diagnostic=result.value.result.cpuDiagnostic;assert.equal(diagnostic.status,'unavailable');assert.equal(diagnostic.failure,failure);assert.ok(diagnostic.ownerReceipt);
  const retained=result.writes.find(w=>w.name==='stock037-cpu-owner-v1.json');assert.deepEqual(retained.value,snapshot.receipt);
  assert.equal(result.writes.filter(w=>w.name==='stock037-cpu-owner-v1.json').length,1);
  assert.equal(!!diagnostic.rawCapture,snapshot.rawJson!==null);assert.equal(!!diagnostic.binding,snapshot.bindingJson!==null);
 }
});

// Additive owned capability contracts. Existing eight-seam/native assertions above
// remain intact; these tests never launch a browser or open a runtime root.
test('owned native capability is a named one-input route on the existing module',async()=>{
 const api=await import('./matrix-case-stock037-trace-v3.mjs');
 assert.equal(typeof api.runLocalOwnedMarkdownCaseV1,'function','API absence only: existing native module lacks owned route');
 assert.equal(api.runLocalOwnedMarkdownCaseV1.length,1);
 let effects=0;const hostile=new Proxy({},{get(){effects++;throw Error('caller get');},ownKeys(){effects++;throw Error('caller keys');},getPrototypeOf(){effects++;throw Error('caller prototype');}});
 for(const args of [[hostile],[hostile,hostile]])await assert.rejects(api.runLocalOwnedMarkdownCaseV1(...args),{message:'local-owned-markdown-identity-unavailable'});
 assert.equal(effects,0);
});
test('ordinary native entry refuses both local namespaces and forged token data before acquiring fixtures',async()=>{
 const {seams}=parse(source),run=AsyncFunction('slot','token',`const STOCK037_CPU_TOKEN=Symbol('cpu'),stock037PublishedIdentityV1=()=>{};${seams.create};return true;`);
 for(const namespace of ['local-shared-signals-v1','local-owned-markdown-v1'])for(const role of ['control','candidate']){
  const slot={id:'threadplane-h1000-r6400-follow-'+namespace+'-'+role+'-round-1',selection:{profile:'threadplane'}};
  for(const token of [undefined,Object.freeze({}),{slot,ordinal:0,guard:{verify(){throw Error('forged verifier');}}}])await assert.rejects(run(slot,token),new RegExp(namespace.replace('-v1','')+'-ordinary-entry'));
 }
});

// Active token boundary model. The production entry prefix and CREATE/SETUP
// seams execute in one closure, retaining their genuine private WeakMaps and
// policy handles. Import substitutions below are confined to this authored VM:
// they provide readiness/build facts, never production activation or test ports.
async function activeLocalTokenRealm(){
 const production=await import('./matrix-case-stock037-trace-v3.mjs');
 assert.equal(typeof production.runLocalOwnedMarkdownCaseV1,'function','API absence only: active token behavior requires the named owned native entry');
 const registry=await import('../threadplane-local-experiments/closed-policies-v1.mjs');
 assert.ok(registry.OWNED_MARKDOWN_POLICY_V1,'API absence only: active token behavior requires the source-authored owned policy');
 const policies={shared:registry.SHARED_SIGNALS_POLICY_V1,owned:registry.OWNED_MARKDOWN_POLICY_V1},events=[],captured=[],build=Object.freeze({genuine:'source-only-build-model',assetHashes:{}}),slots={};
 const importNamespaces=new Map();
 for(const [kind,casing,upper,directory]of [['shared','SharedSignals','SHARED_SIGNALS','shared-signals'],['owned','OwnedMarkdown','OWNED_MARKDOWN','owned-markdown']]){
  const fixedPath='../threadplane-local-'+directory+'/fixed-experiment-v1.mjs',actual=await import(fixedPath),policy=policies[kind];
  slots[kind]=actual['local'+casing+'RosterV1']();
  const fixed={...actual,
   ['assertLocal'+casing+'ExecutionsReadyV1'](){events.push(['ready',kind]);},
   ['local'+casing+'SlotV1'](ordinal){events.push(['slot',kind,ordinal]);assert.ok(Number.isInteger(ordinal)&&ordinal>=0&&ordinal<24);return slots[kind][ordinal];},
   ['local'+casing+'RoleRootV1'](role){events.push(['root',kind,role]);assert.ok(role==='control'||role==='candidate');return policy.roots[role];},
  };
  importNamespaces.set(fixedPath,fixed);
  const buildPath='./threadplane-local-'+directory+'-build-v1.mjs',actualBuild=await import(buildPath);
  importNamespaces.set(buildPath,{...actualBuild,
   ['createLocal'+casing+'BuildGuardV1']:async role=>{events.push(['guard-create',kind,role]);return Object.freeze({identity:Object.freeze({experimentId:policy.id,role,stock:false}),verify:async value=>{events.push(['guard-verify',kind]);assert.equal(value,build);return value;}});},
   ['waitLocal'+casing+'OriginalV1']:async original=>original,
  });
 }
 const common={
  './matrix-run-v5.mjs':{createMatrixDeadline:()=>({wait:async original=>original,remaining:()=>240000})},
  '../../apps/threadplane/provenance.mjs':{threadplaneBuildEvidence:async()=>{events.push(['build-read']);return build;}},
  './aimock-stock037-v1.mjs':{stock037PublishedIdentityV1:()=>{events.push(['stock-identity']);return{};},assertStock037BuildV1:()=>{events.push(['stock-build']);throw Error('stock verifier cannot authorize local');}},
  './aimock-trace-capture-v3.mjs':{createAimockTraceCaptureV3:options=>{events.push(['capture',options.identity.id]);return{setup:async()=>events.push(['capture-setup']),assertBeforeStart:()=>events.push(['capture-ready'])};}},
  'node:perf_hooks':{performance:{now:()=>1}},
 };
 const prefixEnd=source.indexOf('\nasync function installMatrixThreadplaneBridge(');assert.ok(prefixEnd>0,'unchanged bridge marks private-entry prefix');
 let prefix=source.slice(0,prefixEnd),bindings={};
 for(const match of prefix.matchAll(/^import (.+?) from '([^']+)';$/gm)){
  const [,declaration,specifier]=match;
  const namespace=importNamespaces.get(specifier)??{...await import(specifier),...common[specifier]};
  if(declaration.startsWith('{')){
   for(const item of declaration.slice(1,-1).split(',')){const [exported,local=exported]=item.trim().split(/\s+as\s+/);assert.ok(Object.hasOwn(namespace,exported),'source import resolves '+specifier+' '+exported);bindings[local]=namespace[exported];}
  }else if(declaration.startsWith('* as '))bindings[declaration.slice(5)]=namespace;
  else bindings[declaration]=namespace.default;
 }
 prefix=prefix.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const rootMatches=prefix.match(/^const ROOT=.*;$/gm);assert.equal(rootMatches?.length,1,'one source-owned native root binding');
 prefix=prefix.replace(/^const ROOT=.*;$/m,'let ROOT=initialRoot;');
 const {seams}=parse(source),server={get origin(){events.push(['server-origin']);return'http://127.0.0.1:1234';}};
 const parameters={...bindings,Buffer,initialRoot:policies.shared.roots.control,events,captured,server,
  runMatrixCaseOriginal:async(input,token)=>{events.push(['private-original',input.slot.id]);captured.push({input,token});return{captured:true};},
 };
 const program=`(function(${Object.keys(parameters).join(',')}){${prefix}
  const STOCK037_CPU_TOKEN=Symbol('model CPU token');
  async function probe(slot,token){
   const {profile,historyCount,responseBytes,journey}=slot.selection,started=0,wait=async original=>original,deadline={remaining:()=>240000},browser={},context={},page={};
   ${seams.create}${seams.setup}
   return{cpuMode,traceIdentity,ordinal:localContext.ordinal};
  }
  return{probe,entries:{shared:runLocalSharedSignalsCaseV1,owned:runLocalOwnedMarkdownCaseV1},setRoot(value){ROOT=value;}};
 })`;
 const realm=vm.runInThisContext(program)(...Object.values(parameters));
 return{events,slots,captured,probe:realm.probe,async issue(kind,ordinal=0){
  const slot=slots[kind][ordinal];realm.setRoot(policies[kind].roots[slot.role]);
  const input={ordinal,store:{},out:'/authored/token-output',invocationStarted:0},before=captured.length;
  const result=await realm.entries[kind](input);assert.deepEqual(result,{captured:true});assert.equal(captured.length,before+1);
  const issued=captured.at(-1);assert.equal(issued.input.slot,slot);assert.ok(issued.token&&typeof issued.token==='object');
  return{...issued,callerInput:input,slot,kind,ordinal};
 }};
}
for(const kind of ['shared','owned'])test('active '+kind+' entry genuinely issues a private token only after its own guard, then matching CREATE/SETUP captures',async()=>{
 const realm=await activeLocalTokenRealm(),issued=await realm.issue(kind),before=realm.events.length;
 assert.deepEqual(realm.events.filter(e=>e[0]==='guard-verify'),[['guard-verify',kind]]);
 const verifyIndex=realm.events.findIndex(e=>e[0]==='guard-verify'),originalIndex=realm.events.findIndex(e=>e[0]==='private-original');assert.ok(verifyIndex>=0&&originalIndex>verifyIndex);
 const result=await realm.probe(issued.slot,issued.token),events=realm.events.slice(before);assert.equal(result.cpuMode,false);assert.equal(result.ordinal,0);assert.equal(result.traceIdentity.id,issued.slot.id);assert.equal(result.traceIdentity.stockVersion,'0.3.7');
 assert.deepEqual(events.filter(e=>e[0]==='guard-verify'),[['guard-verify',kind]]);assert.equal(events.filter(e=>e[0]==='capture').length,1);assert.equal(events.filter(e=>e[0]==='capture-setup').length,1);assert.equal(events.some(e=>e[0]==='stock-build'),false);
});
async function assertLocalTokenRefusal(realm,slot,token){
 const before=realm.events.length;await assert.rejects(realm.probe(slot,token),/local-(?:shared-signals|owned-markdown)-/);
 const effects=realm.events.slice(before);assert.equal(effects.some(e=>['guard-verify','capture','capture-setup','server-origin','fixture-write','browser-create'].includes(e[0])),false,'refuse before foreign guard/capture/server/browser/fixture writes; pure fixture creation/reservation is outside these seams');
}
for(const [from,to]of [['shared','owned'],['owned','shared']])test('genuine '+from+' opaque token cannot authorize '+to+' slot in the same private module instance',async()=>{
 const realm=await activeLocalTokenRealm(),first=await realm.issue(from),second=await realm.issue(to);await assertLocalTokenRefusal(realm,second.slot,first.token);
 // A refusal must not destroy the genuine memberships or make the model inert.
 assert.equal((await realm.probe(first.slot,first.token)).ordinal,0);assert.equal((await realm.probe(second.slot,second.token)).ordinal,0);
});
for(const kind of ['shared','owned'])test('genuine '+kind+' token binds exact source slot object and original ordinal, not caller mutations',async()=>{
 const realm=await activeLocalTokenRealm(),issued=await realm.issue(kind,0),other=await realm.issue(kind,3);issued.callerInput.ordinal=3;
 await assertLocalTokenRefusal(realm,other.slot,issued.token);await assertLocalTokenRefusal(realm,{...issued.slot},issued.token);
 const result=await realm.probe(issued.slot,issued.token);assert.equal(result.ordinal,0);assert.equal(result.traceIdentity.id,issued.slot.id);assert.equal((await realm.probe(other.slot,other.token)).ordinal,3);
});
for(const kind of ['shared','owned'])test('genuine '+kind+' token from another module instance cannot use even the same source roster object',async()=>{
 const first=await activeLocalTokenRealm(),second=await activeLocalTokenRealm(),a=await first.issue(kind),b=await second.issue(kind);assert.equal(a.slot,b.slot);
 await assertLocalTokenRefusal(second,b.slot,a.token);assert.equal((await first.probe(a.slot,a.token)).ordinal,0);assert.equal((await second.probe(b.slot,b.token)).ordinal,0);
});
for(const kind of ['shared','owned'])test('cloned forged Proxy and getter '+kind+' tokens cannot execute caller traps or foreign verifiers',async()=>{
 const realm=await activeLocalTokenRealm(),issued=await realm.issue(kind);let touches=0;
 const foreign=()=>{touches++;throw Error('foreign verifier');},fake={slot:issued.slot,ordinal:0,policyHandle:{},guard:{verify:foreign}},getter={};
 for(const key of ['slot','ordinal','policyHandle','guard'])Object.defineProperty(getter,key,{enumerable:true,get(){touches++;throw Error('token getter');}});
 const proxy=new Proxy(fake,{get(){touches++;throw Error('token Proxy get');},getPrototypeOf(){touches++;throw Error('token Proxy prototype');},ownKeys(){touches++;throw Error('token Proxy keys');}});
 for(const token of [undefined,null,Object.freeze({}),structuredClone(issued.token),{...issued.token},fake,getter,proxy])await assertLocalTokenRefusal(realm,issued.slot,token);
 assert.equal(touches,0);assert.equal((await realm.probe(issued.slot,issued.token)).ordinal,0);
});
