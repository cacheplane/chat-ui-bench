import test from 'node:test';
import {stock037PublishedIdentityV1} from './aimock-stock037-v1.mjs';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import vm from 'node:vm';
const location=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,location),'utf8');
const filename='four-profile-stock037-large-run-v3.mjs',candidate=new URL(filename,location);
// The real legacy source is a behavioral RED target, never a missing dependency.
const source=read(existsSync(candidate)?filename:'four-profile-stock036-large-run-v3.mjs');
const policyText=read('semantic-large-v3-policy.mjs');
const P=JSON.parse(JSON.stringify(vm.runInNewContext(policyText.slice(policyText.indexOf('const MiB'),policyText.indexOf('export const SEMANTIC_LARGE_V3_POLICY_JSON')).replace(/^export /gm,'').replace('export const SEMANTIC_LARGE_V3_POLICY','const SEMANTIC_LARGE_V3_POLICY')+';JSON.parse(JSON.stringify(SEMANTIC_LARGE_V3_POLICY));')));
const flags=P.flags,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const roster=JSON.parse(/const roster=freeze\((\[.*?\])\);/s.exec(read('four-profile-stock037-large-v3.mjs'))[1]);
const count=48,exportName='runFourProfileStock037LargeInvocationV3',storeName='createSemanticLargeStock03748StoreV3';
const frozen=read('matrix-artifacts-trace-v3.mjs');
test('fixed roster is exactly the complete ordered store denominator',()=>{
 const ids=JSON.parse(JSON.stringify(vm.runInNewContext(new RegExp('const STOCK037_FULL_IDS = Object.freeze\\((\\[.*?\\])\\);','s').exec(frozen)[1])));assert.deepEqual(roster.map(s=>s.id),ids);assert.equal(roster.length,count);
});
test('closed one-argument export, fixed V3 imports/store/grant and immediate acquisition replace legacy ports',()=>{
 assert.match(source,new RegExp('export async function '+exportName+'\\(args\\)'));assert.deepEqual([...source.matchAll(/^export (?:async )?function (\w+)/gm)].map(m=>m[1]),[exportName]);
 assert.doesNotMatch(source,/ports\s*=|createMatrixArtifactStore|matrix-case-.*trace-v1|beginCase\(|child_process|spawn\(|gunzip|inflate|rssQuery|full48|retry/i);
 assert.match(source,new RegExp(storeName+'\\(\\{directory:out,invocationStarted\\}\\)'));
 assert.match(source,/requireSpaceBeforeNextCaseV3\(slot.id\)/);assert.match(source,/validateSemanticLargeTraceRecordV3\(record,identity,sourceFacts\)/);
 assert.match(source,/import\('\.\/matrix-case-stock037-trace-v3.mjs'\)/);assert.match(source,/import\('\.\/matrix-case-competitor-trace-v3.mjs'\)/);
 for(const s of ['O_NOFOLLOW','65536','mtimeNs','ctimeNs','nlink','process.execPath',"'/bin/ps'","'/usr/bin/ps'",'writeInvocationFailureV3','payloadBase64','invocationCleanupEnd'])assert.ok(source.includes(s),s);
});
function deferred(){let resolve,reject;const original=new Promise((a,b)=>{resolve=a;reject=b;});return {original,resolve,reject};}
test('shared schema validation precedes copies of actual originals and validation readbacks',async()=>{
 const m=model({validate(record,identity){assert.equal(record.originals.value,m.files.get(identity.id+'/aimock-trace-v3-decoder-originals.json'));assert.equal(record.validation.value,m.files.get(identity.id+'/aimock-trace-v3-validation.json'));return true;}}),out=await finished(m);assert.equal(out.value.complete,true);
 const start=source.indexOf('const record={raw:rawRecord'),predicate=source.indexOf('validateSemanticLargeTraceRecordV3(record,identity,sourceFacts)',start),copy=source.indexOf('value:detach(originals',start);assert.ok(start>=0&&predicate>start&&copy>predicate);
});
function model(options={}){
 let time=100,next=0,outcome,owned;const timers=new Map(),events=[],files=new Map(),records=[];
 const stats={pendingOriginals:0,pendingWriters:0,unsafeWriter:false,stopped:false},build={actual:'typed-build'},buildHashes=Object.fromEntries(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].map(p=>[p,sha(build)]));
 const stat={dev:1n,ino:2n,size:6n,mtimeNs:3n,ctimeNs:4n,nlink:1n,isFile:()=>true,isSymbolicLink:()=>false};
 let opens=0,closes=0,buildReads=0,verifications=0,sourceCalls=0;
 const fs={realpath:async name=>{sourceCalls++;events.push(['source',name]);if(options.source)await options.source(name,sourceCalls,{setTime:v=>time=v,stats,stat});return name;},lstat:async()=>({...stat}),open:(name,mode)=>{opens++;events.push(['open',name,mode]);const h={stat:async()=>({...stat}),read:async(buffer,offset,length,position)=>{const text=Buffer.from('source');if(position<text.length){text.copy(buffer);return {bytesRead:text.length};}return {bytesRead:0};},close:async()=>{closes++;events.push(['close',name]);}};return options.open?options.open(h,name):Promise.resolve(h);}};
 const ref=(id,name,value)=>{const reference={path:id+'/'+name,bytes:Buffer.byteLength(JSON.stringify(value)),sha256:sha(value)};files.set(reference.path,value);return reference;};
 function native(slot){const identity={id:slot.id,...slot.selection,stockVersion:slot.selection.profile==='threadplane'?(existsSync(candidate)?'0.3.7':'0.3.6'):null,buildSha256:buildHashes[slot.selection.profile]},payload=Buffer.from('gzip-model');
 const raw={schema:P.schemas.raw,captureProfile:P.captureProfile,policySha256:'a'.repeat(64),identity,traceFormat:'json',compression:'gzip',payloadEncoding:'base64',payloadBase64:payload.toString('base64'),receipt:{model:true},retainedCompressedBytes:payload.length,compressedSha256:sha(payload),...flags};
 const originals={model:'originals',identity},validation={model:'validation',identity},fixture={model:'fixture'};
 const result={schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',id:slot.id,kind:slot.kind,...slot.selection,status:'matrix-pass',failure:null,admission:{actual:'native',schema:'four-stack-matrix-conformance-v5',profile:slot.selection.profile,status:'functional-pass',workload:{seed:1,...slot.selection,deltaCount:200,deltaIntervalMs:50},acquisition:{actual:'v5'},performance:false,scoringEligibility:false,FPS:null},acquisition:{actual:'v5'},fixtureDigests:{sourceSha256:'b'.repeat(64),historySha256:'b'.repeat(64),responseSha256:'b'.repeat(64)},unsafeOutstanding:false,stopInvocation:false,performance:false,scoringEligibility:false,FPS:null,fixture:ref(slot.id,'fixture-private.json',fixture),traceDiagnostic:{schema:slot.selection.profile==='threadplane'?'threadplane-aimock-trace-case-v3':'competitor-aimock-semantic-trace-case-v3',profile:slot.selection.profile,status:'complete',failure:null,buildSha256:buildHashes[slot.selection.profile],policySha256:'a'.repeat(64),...flags,rawCapture:ref(slot.id,'aimock-trace-v3-private.json',raw),decoderOriginals:ref(slot.id,'aimock-trace-v3-decoder-originals.json',originals),validation:ref(slot.id,'aimock-trace-v3-validation.json',validation)}};
 options.native?.(result,slot,{files,ref,stats,setTime:v=>time=v});return result;}
 const store={stats:()=>({...stats}),requireSpaceBeforeNextCaseV3:async id=>{events.push(['grant',id]);return options.grant?.(id,{stats,setTime:v=>time=v});},readJSON:async(reference,{kind})=>{events.push(['read',reference.path,kind]);if(options.read)return options.read(reference,kind,{files,setTime:v=>time=v,stats});return files.get(reference.path);},writeManifest:async(name,value)=>{events.push(['manifest',name]);if(options.manifest)return options.manifest(name,value,{stats,setTime:v=>time=v});return {path:name,bytes:10,sha256:'c'.repeat(64)};},writeInvocationFailureV3:async value=>{events.push(['invocation-failure',value]);if(options.failure)return options.failure(value);return {path:'invocation-failure-v3.json',bytes:10,sha256:'c'.repeat(64)};}};
 const engine={runMatrixCase(args){events.push(['engine',args.slot.id]);assert.deepEqual(Object.keys(args),['slot','store','out','invocationStarted']);const result=native(args.slot);records.push(result);return options.engine?options.engine(result,args.slot,{stats,setTime:v=>time=v}):Promise.resolve(result);}};
 const context={observeOwnership:own=>{owned=own;},console,Buffer,TextDecoder,URL,Error,Object,Array,Set,Map,Reflect,JSON,Promise,Number,String,Math,BigInt,createHash,types,fs,constants:{O_RDONLY:0,O_NOFOLLOW:256},path:{resolve:x=>x},pathToFileURL:x=>new URL('file://'+x),fileURLToPath:x=>new URL(x).pathname,performance:{now:()=>time},process:{platform:options.platform??'linux',execPath:'/actual/node',argv:[]},P,POLICY_SHA:'a'.repeat(64),FLAGS:flags,LIMITS:P.timing,STAGES:{progress:10000,transcript:10000},MATRIX_V5_ACQUISITION:{actual:'v5'},PROFILES:['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'],
 stock037PublishedIdentityV1:()=>{events.push(['accessor']);if(options.accessor)options.accessor();},parseArgumentsV3:args=>{assert.deepEqual(Array.from(args),['--out','/exclusive/output']);return {out:'/exclusive/output'};},rosterV3:()=>roster,
 threadplaneBuildEvidence:async()=>{buildReads++;events.push(['build','threadplane',buildReads]);return options.build?options.build('threadplane',buildReads,{setTime:v=>time=v}):build;},assertStock037BuildV1:x=>x,competitorBuildEvidenceV1:async profile=>{buildReads++;events.push(['build',profile,buildReads]);return options.build?options.build(profile,buildReads,{setTime:v=>time=v}):build;},
 [storeName]:async args=>{events.push(['store',args]);assert.deepEqual(Object.keys(args),['directory','invocationStarted']);return store;},stockEngine:engine,competitorEngine:engine,
 validateSemanticLargeTraceRecordV3:(record,identity,facts)=>{events.push(['validate',identity.id]);assert.equal(Object.keys(record.raw.value).includes('payloadBase64'),false);assert.deepEqual(Object.keys(facts),['decoderSources','rssExecutableSha256']);assert.deepEqual(Object.keys(record),['raw','originals','validation']);return options.validate?options.validate(record,identity,facts):true;},
 verifySemanticLargeFixtureV3:(source,result,slot)=>{verifications++;events.push(['fixture-verify',slot.id]);return options.fixture?options.fixture(source,result,slot,{setTime:v=>time=v,stats}):{status:'verified-canonical',sourceSha256:'b'.repeat(64),historySha256:'b'.repeat(64),responseSha256:'b'.repeat(64),sourceDeltaSha256:'b'.repeat(64)};},
 admitV3:(rows,hashes,ctx)=>{events.push(['admit']);assert.equal(rows.length,count);assert.deepEqual(Object.keys(ctx.cases),roster.map(s=>s.id));return rows.every(r=>r.status==='matrix-pass'&&ctx.cases[r.id]);},summarizeV3:(rows,hashes,ctx)=>({profiles:['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].map(profile=>({profile,nativePass:rows.filter(r=>r.profile===profile&&r.status==='matrix-pass'&&r.admission?.actual==='native'&&!r.unsafeOutstanding).length})),planned:count,attempted:rows.filter(r=>r.status!=='unattempted').length,traceComplete:Object.values(ctx.cases).filter(Boolean).length,...flags}),advancementV3:(rows)=>({pilotComplete:rows.every(r=>r.status==='matrix-pass'),boundedDiagnosticAdvancementEligible:rows.every((r,i)=>r.status==='matrix-pass'||i===14&&r.failure?.message==='matrix-v5-initial-readiness-deadline'),...flags}),
 setTimeout(callback,delay){const id=++next;timers.set(id,{callback,at:time+delay,delay});return id;},clearTimeout:id=>timers.delete(id),};
  if(options.strictMetadata){
  const text=read('four-profile-stock037-large-v3.mjs').replace(/^import .*\n/gm,'').replace(/^export /gm,''),names=['types','createHash','MATRIX_V5_ACQUISITION','P','POLICY_SHA','FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3','SEMANTIC_LARGE_FLAGS_V3','validateSemanticLargeTraceRecordV3'];
  const api=vm.runInThisContext('(function('+names.join(',')+'){'+text+';return [admitFourProfileStock037LargeV3,summarizeFourProfileStock037LargeV3];})')(types,createHash,context.MATRIX_V5_ACQUISITION,P,context.POLICY_SHA,context.PROFILES,flags,context.validateSemanticLargeTraceRecordV3);
  context.admitV3=api[0];context.summarizeV3=api[1];
 }
 context.createSemanticLarge48StoreV3=context[storeName];context.stock036PublishedIdentityV1=context.stock037PublishedIdentityV1;context.assertStock036BuildV1=context.assertStock037BuildV1;
 const executable=source.replace('const own=ownership(invocationEnd,invocationCleanupEnd),roster=', 'const own=ownership(invocationEnd,invocationCleanupEnd);observeOwnership(own);const roster=').replace(/^import .*\n/gm,'').replace(/^export /gm,'').split("if(process.argv[1]")[0].replaceAll('import.meta.url',JSON.stringify(candidate.href)).replace("import('./matrix-case-stock037-trace-v3.mjs')",'Promise.resolve(stockEngine)').replace("import('./matrix-case-stock036-trace-v3.mjs')",'Promise.resolve(stockEngine)').replace("import('./matrix-case-competitor-trace-v3.mjs')",'Promise.resolve(competitorEngine)');
 context.run=vm.runInThisContext('(function('+Object.keys(context).join(',')+'){'+executable+';return '+(source.includes('export async function '+exportName+'(')?exportName:'runFourProfileStock036LargeInvocationV3')+';})')(...Object.values(context));
 const task=context.run(options.args??['--out','/exclusive/output']);task.then(value=>outcome={value},error=>outcome={error});
 const flush=async()=>{for(let n=0;n<3000;n++)await Promise.resolve();};
 return {events,files,records,stats,timers,context,task,flush,buildHashes,schedule:context.setTimeout,get owned(){return owned;},get time(){return time;},setTime:v=>time=v,get outcome(){return outcome;},get opens(){return opens;},get closes(){return closes;},get buildReads(){return buildReads;},get verifications(){return verifications;},fire(){const entry=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];assert.ok(entry,'finite controlled timer exists');timers.delete(entry[0]);time=entry[1].at;entry[1].callback();return time;}};
}
async function finished(m){await m.flush();assert.ok(m.outcome,'finite fake-only execution settled');return m.outcome;}
test('actual legacy choreography RED exposes missing grant and immediate trace readback',async()=>{
 const old=read('four-profile-stock036-interleaved-run-v1.mjs'),start=old.indexOf(' const executeSlot=async slot=>{'),end=old.indexOf('\n // This outer stop',start),slice=old.slice(start,end);
 const events=[],slot=roster[0],native={status:'matrix-pass',fixture:null,traceDiagnostic:{status:'complete'}};
 const run=Object.getPrototypeOf(async()=>{}).constructor('now','stock','competitor','originalWait','waitEnd','LIMITS','buildHashes','FLAGS','store','out','invocationStarted',slice+';return executeSlot('+JSON.stringify(slot)+');');
 await run(()=>100,{runMatrixCase:async()=>{events.push('engine');return native;}},{},async p=>p,()=>{},P.timing,{[slot.selection.profile]:'b'.repeat(64)},flags,{},'/exclusive/output',100);
 assert.deepEqual(events,['engine'],'the extracted real old case choreography has no grant or trace acquisition');
});
test('full fixed execution immediately verifies every case and source/build bookends before one final publication',async()=>{
 const m=model(),out=await finished(m);assert.equal(out.error,undefined);assert.equal(out.value.complete,true);assert.equal(out.value.results.length,count);assert.equal(out.value.summary.traceComplete,count);assert.equal(m.verifications,count);assert.equal(m.buildReads,8);assert.equal(m.opens,18);assert.equal(m.closes,18);
 assert.equal(m.events[0][0],'accessor');assert.equal(m.events.filter(e=>e[0]==='grant').length,count);assert.deepEqual(m.events.filter(e=>e[0]==='manifest').map(e=>e[1]),['manifest-initial.json','manifest-final.json']);
 for(let i=0;i<count;i++){const id=roster[i].id,engine=m.events.findIndex(e=>e[0]==='engine'&&e[1]===id),reads=m.events.filter(e=>e[0]==='read'&&e[1].startsWith(id+'/'));assert.equal(m.events[engine-1][0],'grant');assert.deepEqual(reads.map(e=>[e[1].slice(id.length+1),e[2]]),[['aimock-trace-v3-private.json','trace-v3'],['aimock-trace-v3-decoder-originals.json','evidence'],['aimock-trace-v3-validation.json','evidence'],['fixture-private.json','private-case']]);assert.equal(out.value.results[i].semanticLargeAttempt.originalCall.settled,100);}
 assert.equal(JSON.stringify(out.value).includes('payloadBase64'),false);assert.equal(JSON.stringify(out.value).includes('"originals":{"reference"'),false);
});
for(const mode of ['missing','wrong-path','unknown-raw','wrong-build','read-hash','validator'])test(`${mode} trace refuses qualification and preserves full suffix`,async()=>{
 const m=model({native(r,s,{files}){if(roster.indexOf(s)!==0)return;if(mode==='missing')r.traceDiagnostic.decoderOriginals=null;if(mode==='wrong-path')r.traceDiagnostic.rawCapture.path='other/aimock-trace-v3-private.json';if(mode==='unknown-raw')files.get(r.traceDiagnostic.rawCapture.path).extra=true;if(mode==='wrong-build')files.get(r.traceDiagnostic.rawCapture.path).identity.buildSha256='0'.repeat(64);if(mode==='read-hash')files.get(r.traceDiagnostic.decoderOriginals.path).changed=true;},validate:()=>mode!=='validator'}),out=await finished(m);
 assert.equal(out.error,undefined);assert.equal(out.value.complete,false);assert.equal(out.value.results.length,count);assert.equal(out.value.results[1].status,'unattempted');assert.equal(out.value.results[0].status,'matrix-pass');assert.equal(out.value.results[0].semanticLargeAttempt.qualificationUnsafe,false);assert.equal(m.events.filter(e=>e[0]==='engine').length,1);
});
test('native failure remains intact while trace and fixture independently validate',async()=>{
 const failure={message:'matrix-v5-initial-readiness-deadline'},m=model({native(r,s){if(roster.indexOf(s)===14){r.status='invalid';r.admission=null;r.failure=failure;}}}),out=await finished(m);assert.equal(out.error,undefined);assert.equal(out.value.complete,false);assert.equal(out.value.results[14].failure,failure);assert.equal(out.value.results[14].admission,null);assert.equal(out.value.summary.traceComplete,count);

});
for(const mode of ['reject','late','pending'])test(`fixture ${mode} keeps validated trace but permanently stops qualification`,async()=>{
 const pending=deferred(),m=model({fixture(source,r,s,{setTime}){if(mode==='reject')throw Error('canonical-refusal');if(mode==='late'){setTime(10100);return {status:'verified-canonical'};}return pending.original;}});
 await m.flush();if(mode==='pending'){assert.equal(m.outcome,undefined);m.fire();await m.flush();assert.equal(m.outcome,undefined,'actual fixture original remains pending during bounded observation');m.fire();}
 const out=await finished(m);if(mode==='pending'){assert.equal(out.error?.diagnostic.unsafeOutstanding,true);assert.equal(out.error.diagnostic.attempts.length,count);assert.equal(m.events.filter(e=>e[0]==='manifest').length,1);pending.resolve({status:'verified-canonical'});await m.flush();assert.equal(m.events.filter(e=>e[0]==='engine').length,1);}
 else{assert.equal(out.value.summary.traceComplete,1);assert.equal(out.value.results[0].semanticLargeAttempt.fixture.status,'unavailable');assert.equal(out.value.results[1].status,'unattempted');}
});
for(const mode of ['pending-writer','native-unsafe','unsafe-rejection'])test(`${mode} stops without new verification, bookend or terminal I/O`,async()=>{
 const m=model({engine(r,s,{stats}){if(mode==='pending-writer')stats.pendingWriters=1;if(mode==='native-unsafe')r.unsafeOutstanding=true;if(mode==='unsafe-rejection')return Promise.reject(Object.assign(Error('unsafe-original'),{unsafeOutstanding:true}));return Promise.resolve(r);}}),out=await finished(m);
 assert.equal(out.error?.diagnostic.unsafeOutstanding,true);assert.equal(out.error.diagnostic.attempts.length,count);assert.equal(m.events.filter(e=>e[0]==='read').length,0);assert.equal(m.events.filter(e=>e[0]==='manifest').length,1);assert.equal(m.buildReads,4);assert.equal(m.opens,9);
});
for(const mode of ['reject','pending','late-safe','late-unsafe'])test(`engine ${mode} uses retained actual original and original observation end`,async()=>{
 const pending=deferred(),m=model({engine(){return mode==='reject'?Promise.reject(Error('safe-engine-refusal')):pending.original;}});await m.flush();
 if(mode!=='reject'){assert.equal(m.outcome,undefined);assert.equal(m.fire(),270100);await m.flush();if(mode.startsWith('late-')){pending.resolve({...m.records[0],unsafeOutstanding:mode==='late-unsafe'});await m.flush();}}
 const out=await finished(m);if(mode==='reject'){assert.equal(out.value.results[0].status,'invalid');assert.equal(out.value.results[1].status,'unattempted');assert.equal(out.value.results[0].semanticLargeAttempt.originalCall.settled,100);}else{assert.equal(out.error?.diagnostic.unsafeOutstanding,true);assert.equal(m.events.filter(e=>e[0]==='manifest').length,1);}
 assert.equal(m.events.filter(e=>e[0]==='engine').length,1);assert.equal(m.events.filter(e=>e[0]==='read').length,0);
});
for(const mode of ['drift','late','pending'])test(`terminal build ${mode} cannot complete or rescue bookends`,async()=>{
 const pending=deferred(),m=model({build(p,n,{setTime}){if(n<=4)return {actual:'typed-build'};if(mode==='drift')return {actual:'different'};if(mode==='late'){setTime(10100);return {actual:'typed-build'};}return pending.original;}});await m.flush();if(mode==='pending'){m.fire();await m.flush();m.fire();}const out=await finished(m);assert.equal(out.value?.complete??false,false);if(mode==='pending')assert.equal(out.error?.diagnostic.unsafeOutstanding,true);else assert.ok(out.value.buildBookends.some(b=>b.status!=='unchanged'));
});
for(const mode of ['reject','pending','stopped'])test(`final publication ${mode} has once-only charged safe failure semantics`,async()=>{
 const pending=deferred(),m=model({manifest(name,v,{stats}){if(name==='manifest-initial.json')return {path:name,bytes:1,sha256:'c'.repeat(64)};if(mode==='pending')return pending.original;if(mode==='stopped')stats.stopped=true;throw Error('final-safely-refused');}});await m.flush();if(mode==='pending'){m.fire();await m.flush();m.fire();}const out=await finished(m);assert.ok(out.error);assert.equal(out.error.diagnostic.attempts.length,count);assert.equal(out.error.diagnostic.complete,false);assert.equal(m.events.filter(e=>e[0]==='manifest'&&e[1]==='manifest-final.json').length,1);assert.equal(m.events.filter(e=>e[0]==='invocation-failure').length,mode==='pending'?0:1);
});

test('engine synchronous prefix preserves the exact before-call dispatch stamp',async()=>{
 const m=model({engine(r,s,{setTime}){setTime(120);return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.value.complete,true);assert.deepEqual(out.value.results[0].semanticLargeAttempt.originalCall,{clock:'controller-monotonic',dispatched:100,settled:120});
});
test('engine settlement at conservative case equality cannot dispatch verification',async()=>{
 const m=model({engine(r,s,{setTime}){setTime(240100);return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.value.complete,false);assert.equal(m.events.filter(e=>e[0]==='read').length,0);assert.equal(out.value.results[0].status,'matrix-pass');assert.equal(out.value.results[0].semanticLargeAttempt.originalCall.dispatched,100);assert.equal(out.value.results[0].semanticLargeAttempt.originalCall.settled,240100);assert.equal(out.value.results[1].status,'unattempted');
});
for(const mode of ['getter','proxy','overcap','late-getter'])test(`invalid native ${mode} is refused before property access, copy or terminal serialization`,async()=>{
 let accesses=0;const pending=deferred(),invalid=r=>{if(mode==='overcap')return {...r,oversized:'x'.repeat(2097152)};if(mode==='proxy')return new Proxy(r,{get(target,key){if(key==='then')return undefined;accesses++;throw Error('native-proxy-trap');}});const value={...r};Object.defineProperty(value,'unsafeOutstanding',{enumerable:true,get(){accesses++;throw Error('native-getter');}});return value;};
 const m=model({engine(r){return mode==='late-getter'?pending.original:Promise.resolve(invalid(r));}});await m.flush();if(mode==='late-getter'){m.fire();await m.flush();pending.resolve(invalid(m.records[0]));await m.flush();}
 const out=await finished(m);assert.equal(accesses,0);assert.equal(out.value?.complete??false,false);const row=out.value?.results[0]??out.error.diagnostic.attempts[0];assert.equal(row.status,'invalid');assert.equal(JSON.stringify(out.value??out.error.diagnostic).includes('oversized'),false);assert.equal(m.events.filter(e=>e[0]==='read').length,0);assert.equal(m.events.filter(e=>e[0]==='engine').length,1);
});
test('settled raw and fixture payload promises are released before the next case',async()=>{
 let checked=0;const m=model({engine(r,s){if(s===roster[1]){const oldRaw=m.files.get(roster[0].id+'/aimock-trace-v3-private.json'),oldFixture=m.files.get(roster[0].id+'/fixture-private.json');assert.ok(m.owned.records.every(record=>record.value!==oldRaw&&record.value!==oldFixture));assert.ok(m.owned.records.filter(record=>record.status==='fulfilled').every(record=>record.original===null&&record.value===null),'consumed fulfilled originals no longer keep payloads alive');checked++;}return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.value.complete,true);assert.equal(checked,1);
});
test('all verification reads share one absolute stage end, with no new fixture time',async()=>{
 let read=0;const m=model({read(ref,kind,{files,setTime}){setTime(100+4000*(++read));return files.get(ref.path);}}),out=await finished(m);assert.equal(out.value.complete,false);assert.equal(read,3);assert.equal(m.verifications,0);assert.equal(out.value.summary.traceComplete,0);assert.equal(out.value.results[1].status,'unattempted');
});
test('verification read equality refuses before the next acquisition',async()=>{
 const m=model({read(ref,kind,{files,setTime}){setTime(10100);return files.get(ref.path);}}),out=await finished(m);assert.equal(out.value.complete,false);assert.equal(m.events.filter(e=>e[0]==='read').length,1);assert.equal(m.verifications,0);
});
for(const mode of ['safe-resolve','safe-reject','unsafe-reject','expire'])test(`positive-time retained fixture observation ${mode} stays within the original slot end`,async()=>{
 const pending=deferred(),m=model({fixture(){return pending.original;}});await m.flush();assert.equal(m.fire(),10100);await m.flush();assert.equal(m.outcome,undefined);assert.equal(m.owned.records.at(-1).original,pending.original);assert.equal(m.owned.records.at(-1).status,'pending');assert.equal([...m.timers.values()][0].at,270100);
 if(mode==='expire'){assert.equal(m.fire(),270100);await m.flush();const out=await finished(m);assert.equal(out.error.diagnostic.unsafeOutstanding,true);assert.equal(m.timers.size,0,'slot expiry cannot re-observe under invocation cleanup');const eventCount=m.events.length;m.schedule(()=>pending.resolve({status:'verified-canonical'}),1);m.fire();await m.flush();assert.equal(m.events.length,eventCount);assert.equal(out.error.diagnostic.unsafeOutstanding,true);assert.equal(m.owned.records.at(-1).status,'fulfilled');return;}
 m.schedule(()=>{if(mode==='safe-resolve')pending.resolve({status:'verified-canonical'});else pending.reject(Object.assign(Error('late-fixture-refusal'),mode==='unsafe-reject'?{unsafeOutstanding:true}:{}));},50);assert.equal(m.fire(),10150);await m.flush();const out=await finished(m);
 if(mode==='unsafe-reject'){assert.equal(out.error?.diagnostic.unsafeOutstanding,true);assert.equal(m.events.filter(e=>e[0]==='manifest').length,1);}else{assert.equal(out.value.complete,false);assert.equal(out.value.results[0].semanticLargeAttempt.fixture.status,'unavailable');assert.equal(out.value.results[0].semanticLargeAttempt.qualificationUnsafe,false);assert.equal(out.value.summary.traceComplete,1);assert.equal(out.value.results[1].status,'unattempted');}
 assert.equal(m.events.filter(e=>e[0]==='engine').length,1);assert.equal(m.timers.size,0);
});
for(const mode of ['refused','pending','stopped'])test(`one consumed next-case grant ${mode} never dispatches or invents an engine original`,async()=>{
 const pending=deferred(),m=model({grant(id,{stats}){if(mode==='pending')return pending.original;if(mode==='stopped')stats.stopped=true;throw Error('grant-refused');}});await m.flush();if(mode==='pending'){assert.equal(m.fire(),10100);await m.flush();assert.equal(m.fire(),40100);}
 const out=await finished(m),rows=out.value?.results??out.error.diagnostic.attempts;assert.equal(rows.length,count);assert.ok(rows.every(row=>row.status==='unattempted'));assert.equal(m.events.filter(e=>e[0]==='grant').length,1);assert.equal(m.events.filter(e=>e[0]==='engine').length,0);if(mode==='pending'){assert.equal(out.error.diagnostic.unsafeOutstanding,true);assert.equal(m.events.filter(e=>e[0]==='manifest').length,1);}else assert.equal(out.value.complete,false);
});
for(const mode of ['unsupported','initial-equality','terminal-drift','terminal-late'])test(`source bookend ${mode} refuses without invented source equality`,async()=>{
 const m=model({platform:mode==='unsupported'?'win32':'linux',source(name,n,{setTime,stat}){if(mode==='initial-equality'&&n===3)setTime(10100);if(mode==='terminal-late'&&n===19)setTime(10100);if(mode==='terminal-drift'&&n===19)stat.ino=3n;}}),out=await finished(m);assert.equal(out.value?.complete??false,false);
 if(mode==='unsupported'||mode==='initial-equality'){assert.equal(m.events.filter(e=>e[0]==='engine').length,0);assert.equal(out.error.diagnostic.attempts.length,count);}else{assert.equal(out.value.sourceBookends.status,'unavailable');assert.equal(m.events.filter(e=>e[0]==='engine').length,count);}
});
for(const mode of ['late-safe','expire'])test(`late-open descriptor ${mode} retains its actual original and bounded close handler`,async()=>{
 const pending=deferred();let handle;const m=model({open(h){handle=h;return pending.original;}});await m.flush();assert.equal(m.opens,1);assert.equal(m.fire(),10100);await m.flush();assert.equal(m.outcome,undefined);assert.equal(m.owned.records.at(-1).original,pending.original);assert.equal(m.owned.records.at(-1).status,'pending');assert.equal([...m.timers.values()][0].at,40100);
 if(mode==='late-safe'){m.schedule(()=>pending.resolve(handle),50);assert.equal(m.fire(),10150);await m.flush();const out=await finished(m);assert.equal(out.error.diagnostic.unsafeOutstanding,false);assert.equal(m.closes,1);assert.equal(m.owned.descriptors.size,0);}else{assert.equal(m.fire(),40100);const out=await finished(m);assert.equal(out.error.diagnostic.unsafeOutstanding,true);assert.equal(m.timers.size,0);m.schedule(()=>pending.resolve(handle),1);m.fire();await m.flush();assert.equal(m.closes,0,'no new close is dispatched beyond its original observation end');assert.equal(m.owned.descriptors.size,1);assert.equal(out.error.diagnostic.unsafeOutstanding,true);}
 assert.equal(m.events.filter(e=>e[0]==='engine').length,0);assert.equal(m.events.filter(e=>e[0]==='manifest').length,0);
});
test('source acquisition uses actual Node/ps and seven fixed ordered regular-file descriptors',async()=>{
 const m=model(),out=await finished(m);assert.equal(out.value.complete,true);const initial=m.events.filter(e=>e[0]==='open').slice(0,9),names=initial.map(e=>e[1].split('/').at(-1));assert.deepEqual(names,['node','aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs','ps']);assert.equal(initial[0][1],'/actual/node');assert.equal(initial[8][1],'/usr/bin/ps');assert.ok(initial.every(e=>e[2]===256));
});

test('terminal nativePass count comes from strict shared summary rather than a bare native status',async()=>{
 const m=model({engine(r,s,{stats}){r.admission=null;stats.pendingWriters=1;return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.error.diagnostic.counts.nativePass,0);assert.equal(out.error.diagnostic.counts.planned,count);assert.equal(out.error.diagnostic.counts.attempted,1);assert.equal(out.error.diagnostic.counts.unattempted,count-1);
});
test('source descriptor metadata mismatch closes the acquired descriptor before refusing engines',async()=>{
 const m=model({open(h){h.stat=async()=>({dev:1n,ino:99n,size:6n,mtimeNs:3n,ctimeNs:4n,nlink:1n});return Promise.resolve(h);}}),out=await finished(m);assert.equal(out.error.diagnostic.complete,false);assert.equal(out.error.diagnostic.unsafeOutstanding,false);assert.equal(m.opens,1);assert.equal(m.closes,1);assert.equal(m.events.filter(e=>e[0]==='engine').length,0);
});
for(const mode of ['initial','final','failure'])test(`${mode} publication cap/refusal remains observable with full planned denominator`,async()=>{
 const m=model({manifest(name){if(mode==='initial'&&name==='manifest-initial.json')throw Error('matrix-artifact-manifest-budget');if(mode!=='initial'&&name==='manifest-final.json')throw Error('matrix-artifact-manifest-budget');return {path:name,bytes:1,sha256:'c'.repeat(64)};},failure:mode==='failure'?()=>{throw Error('matrix-artifact-invocation-failure-budget');}:null}),out=await finished(m);const report=out.error?.diagnostic??out.value;assert.equal(report.complete,false);assert.equal((report.attempts??report.results).length,count);assert.equal(m.events.filter(e=>e[0]==='manifest'&&e[1]==='manifest-final.json').length,1);assert.equal(m.events.filter(e=>e[0]==='invocation-failure').length,mode==='initial'?0:1);
});

test('exact production import allowlist stays closed',()=>{assert.deepEqual(source.split('\n').filter(line=>line.startsWith('import ')),["import fs from 'node:fs/promises';", "import {constants} from 'node:fs';", "import path from 'node:path';", "import {fileURLToPath,pathToFileURL} from 'node:url';", "import {performance} from 'node:perf_hooks';", "import {createHash} from 'node:crypto';", "import {types} from 'node:util';", "import {fourProfileStock037LargeRosterV3 as rosterV3,parseFourProfileStock037LargeArgumentsV3 as parseArgumentsV3,admitFourProfileStock037LargeV3 as admitV3,summarizeFourProfileStock037LargeV3 as summarizeV3} from './four-profile-stock037-large-v3.mjs';", "import {FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3 as PROFILES,SEMANTIC_LARGE_FLAGS_V3 as FLAGS,validateSemanticLargeTraceRecordV3,verifySemanticLargeFixtureV3} from './four-profile-stock036-large-v3.mjs';", "import {MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES,MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';", "import {SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';", "import {createSemanticLargeStock03748StoreV3} from './matrix-artifacts-trace-v3.mjs';", "import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';", "import {assertStock037BuildV1,stock037PublishedIdentityV1} from './aimock-stock037-v1.mjs';", "import {competitorBuildEvidenceV1} from './competitor-build-v1.mjs';"]);});

// New cohort controls execute only source-extracted runner code with authored facts.
test('stock037 published identity refusal precedes argument getters and all side effects',async()=>{
 let getters=0;const args=new Proxy([],{get(){getters++;throw Error('argument-getter');}}),m=model({args,accessor(){throw Error('stock037-published-identity-unavailable');}}),out=await finished(m);
 assert.equal(out.error?.message,'stock037-published-identity-unavailable');assert.equal(getters,0);assert.deepEqual(m.events,[['accessor']]);assert.equal(m.opens,0);assert.equal(m.buildReads,0);
 const published=stock037PublishedIdentityV1();assert.equal(published.schema,'threadplane-published-stock037-pins-v1');assert.equal(published.version,'0.3.7');assert.notEqual(published.selectedSourceHashes,null);
});
test('stock037 fixed runner emits exact distinct manifest and attempt schemas',async()=>{
 const m=model(),out=await finished(m);assert.equal(out.value?.schema,'four-profile-stock037-large-invocation-v3');assert.ok(out.value.results.every(r=>r.semanticLargeAttempt.schema==='four-profile-stock037-large-attempt-v3'));
 assert.ok(out.value.roster.every(s=>s.sourceFlavor===(s.selection.profile==='threadplane'?'registry-stock037':'published-competitor-v1')));
});
test('stock037 terminal failure schema is exact and keeps complete denominator',async()=>{
 const m=model({engine(r,s,{stats}){stats.pendingWriters=1;return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.error?.diagnostic.schema,'four-profile-stock037-large-terminal-failure-v3');assert.equal(out.error.diagnostic.counts.planned,count);
});
for(const cohort of ['0.3.6','0.3.8'])test(`stock037 refuses self-consistent ${cohort} raw identity before shared validation`,async()=>{
 const m=model({native(r,s,{files,ref}){if(s!==roster[0])return;const raw=files.get(r.traceDiagnostic.rawCapture.path);raw.identity.stockVersion=cohort;r.traceDiagnostic.rawCapture=ref(s.id,'aimock-trace-v3-private.json',raw);}}),out=await finished(m);
 assert.equal(out.value.complete,false);assert.equal(out.value.stopReason,'semantic-large-raw-identity');assert.equal(m.events.filter(e=>e[0]==='validate').length,0);assert.equal(out.value.results[1].status,'unattempted');
});
test('stock037 refuses rehashed prior-cohort raw ID without normalizing it',async()=>{
 const m=model({native(r,s,{files,ref}){if(s!==roster[0])return;const raw=files.get(r.traceDiagnostic.rawCapture.path);raw.identity.id=raw.identity.id.replace('stock037','stock036');r.traceDiagnostic.rawCapture=ref(s.id,'aimock-trace-v3-private.json',raw);}}),out=await finished(m);
 assert.equal(out.value.complete,false);assert.equal(out.value.stopReason,'semantic-large-raw-identity');assert.equal(m.events.filter(e=>e[0]==='validate').length,0);
});
test('stock037 ordered IDs are disjoint from all prior runner IDs',()=>{
 const old=JSON.parse(JSON.stringify(vm.runInNewContext(new RegExp('const FULL_IDS = Object.freeze\\((\\[.*?\\])\\);','s').exec(frozen)[1]))).map(id=>({id}));assert.ok(roster.every(s=>!old.some(x=>x.id===s.id)));assert.equal(new Set(roster.map(s=>s.id)).size,count);
});

test('stock037 real fixed metadata joins every authored runner readback and counts the full denominator',async()=>{
 const m=model({strictMetadata:true}),out=await finished(m);assert.equal(out.value.complete,true);assert.equal(out.value.summary.profiles.reduce((n,p)=>n+p.qualified,0),count);assert.equal(out.value.summary.profiles.reduce((n,p)=>n+p.nativePass,0),count);
});

test('stock037 full48 has no readiness diagnostic exception or advancement surface',async()=>{
 const m=model({strictMetadata:true,native(r,s){if(s===roster[14]){r.status='invalid';r.admission=null;r.failure={message:'matrix-v5-initial-readiness-deadline'};}}}),out=await finished(m);assert.equal(out.value.complete,false);assert.equal(Object.hasOwn(out.value,'advancement'),false);assert.equal(out.value.summary.profiles.reduce((n,p)=>n+p.nativePass,0),47);assert.equal(out.value.summary.profiles.reduce((n,p)=>n+p.qualified,0),47);assert.equal(out.value.summary.profiles.reduce((n,p)=>n+p.traceComplete,0),48);
});

test('stock037 executable choreography equals reviewed036 after only finite binding normalization',()=>{
 const clean=text=>text.replace(/^import .*\n/gm,''),pairs=[
 ['runSemanticLargeStock037PilotInvocationV3','runSemanticLargePilotInvocationV3'],['runFourProfileStock037LargeInvocationV3','runFourProfileStock036LargeInvocationV3'],['stock037PublishedIdentityV1','stock036PublishedIdentityV1'],['assertStock037BuildV1','assertStock036BuildV1'],['createSemanticLargeStock03716StoreV3','createSemanticLarge16StoreV3'],['createSemanticLargeStock03748StoreV3','createSemanticLarge48StoreV3'],['matrix-case-stock037-trace-v3.mjs','matrix-case-stock036-trace-v3.mjs'],["?'registry-stock037':","?'registry-stock036':"],["?'0.3.7':null","?'0.3.6':null"],['semantic-large-stock037-pilot-invocation-v3','semantic-large-pilot-invocation-v3'],['semantic-large-stock037-pilot-attempt-v3','semantic-large-pilot-attempt-v3'],['semantic-large-stock037-pilot-terminal-failure-v3','semantic-large-pilot-terminal-failure-v3'],['four-profile-stock037-large-invocation-v3','four-profile-stock036-large-invocation-v3'],['four-profile-stock037-large-attempt-v3','four-profile-stock036-large-attempt-v3'],['four-profile-stock037-large-terminal-failure-v3','four-profile-stock036-large-terminal-failure-v3']];
 let normalized=clean(source);for(const [newBinding,oldBinding] of pairs)normalized=normalized.replaceAll(newBinding,oldBinding);assert.equal(normalized,clean(read('four-profile-stock036-large-run-v3.mjs')));
});
test('stock037 strict metadata terminal native counter refuses status-only forged admission',async()=>{
 const m=model({strictMetadata:true,engine(r,s,{stats}){r.admission=null;stats.pendingWriters=1;return Promise.resolve(r);}}),out=await finished(m);assert.equal(out.error.diagnostic.counts.nativePass,0);assert.equal(out.error.diagnostic.counts.planned,count);assert.equal(out.error.diagnostic.counts.attempted,1);assert.equal(out.error.diagnostic.counts.unattempted,count-1);
});
