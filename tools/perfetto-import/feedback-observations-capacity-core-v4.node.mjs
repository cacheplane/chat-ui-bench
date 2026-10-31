import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {authoredGraph,selector,csv,argument} from './feedback-observations-fixtures.mjs';
import {exportCompactGraphV2} from './feedback-observations-compact-fixtures-v2.mjs';
import {makePackedFeedbackAuthoredFixtureV1} from './feedback-packed-authored-fixture-v1.mjs';
import {evaluateBrowserFeedbackObservationsCapacityV3 as historical} from './feedback-observations-capacity-core-v3.mjs';
import * as codec from './feedback-observations-packed-result-v1.mjs';
const url = name => new URL(name, import.meta.url);
const text = name => readFileSync(url(name),'utf8');
const model = () => JSON.parse(text('feedback-observations-capacity-source-model-v4.json'));
const load = () => import('./feedback-observations-capacity-core-v4.mjs');
const C={schema:'browser-presentation-feedback-observations-capacity-v4',capacityProfile:'whole-graph-packed-result-capacity-v4',wireFormat:'compact-v2',resultFormat:'browser-feedback-packed-result-v1'};
const B={fps:null,exhaustivePopulation:false,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false};
const limits={canonicalJSONBytes:4194304,nodes:262144,edges:262143,maxDepth:64,stringBytes:4194304,eventOffsets:8192,pathOffsets:64,offsetEntries:8256,offsetBytes:132096};
const acquisition={path:'feedback-observations-capacity-source-model-v3.json',bytes:15907,sha256:'02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca',schema:'browser-presentation-feedback-observations-capacity-v3',capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2'};
const unavailable=(stage,reason,diagnosticsProof=null)=>({...C,status:'unavailable',stage,reason,proof:null,diagnosticsProof,count:null,interval:null,observedHz:null,events:[],...B});
// Test-only full materialization. Never used by production or for admission.
function materialize(e){
 let p=0;function uint(){const end=e.body.indexOf(':',p);assert.ok(end>=p);const n=Number(e.body.slice(p,end));p=end+1;return n;}
 function value(){const tag=e.body[p++];if(tag==='z')return null;if(tag==='t')return true;if(tag==='f')return false;const n=uint();if(tag==='s')return e.strings[n];if(tag==='n'){const v=Number(e.body.slice(p,p+n));p+=n;return v;}if(tag==='a')return Array.from({length:n},value);assert.equal(tag,'o');const v={};for(const key of e.shapes[n])Object.defineProperty(v,e.strings[key],{value:value(),enumerable:true,writable:true,configurable:true});return v;}
 const v=value();assert.equal(p,e.body.length);return v;
}
function normalize(v){const {schema,capacityProfile,wireFormat,...rest}=v;return {schema:C.schema,capacityProfile:C.capacityProfile,wireFormat:C.wireFormat,resultFormat:C.resultFormat,...rest};}
function evaluate(m,g=authoredGraph()){const f=exportCompactGraphV2(g);return m.evaluateBrowserFeedbackObservationsCapacityV4(f.target.bytes,f.scope.bytes,selector);}
function assertObserved(r){assert.deepEqual(Object.keys(r),[...Object.keys(C),'status','stage','reason','proof','diagnosticsProof',...Object.keys(B)]);assert.equal(r.status,'observed',JSON.stringify(r));assert.equal(r.stage,null);assert.equal(r.reason,null);assert.equal(r.diagnosticsProof,null);assert.ok(Object.isFrozen(r));for(const [k,v]of Object.entries(B))assert.equal(r[k],v);assert.equal(r.count,undefined);}
test('V4 evaluator and exactly four internal operations are available',async()=>{
 const m=await load();assert.deepEqual(Object.keys(m).sort(),['evaluateBrowserFeedbackObservationsCapacityV4','inspectBrowserFeedbackCapacityV4','readBrowserFeedbackCapacityEventV4','meterBrowserFeedbackCapacityCompositionV4','chargeBrowserFeedbackCapacityWorkV4'].sort());
});
test('V4 complete model changes only result identity and representation',()=>{
 const m=model(),old=JSON.parse(text(acquisition.path));for(const[k,v]of Object.entries(C))assert.equal(m[k],v);
 assert.deepEqual(m.logicalResultLimits,limits);assert.deepEqual(m.inputAcquisitionModel,acquisition);assert.deepEqual(Object.keys(m.inputAcquisitionModel),Object.keys(acquisition));assert.deepEqual(Object.keys(m.logicalResultLimits),Object.keys(limits));
 assert.ok(m.resultRepresentation.grammar.includes('uint'));assert.ok(m.resultRepresentation.domain.includes('safe integers'));assert.ok(m.resultRepresentation.canonicalUnicode.includes('UTF-16'));assert.ok(m.resultRepresentation.fullProof.includes('ENTIRE V3'));
 const{schema,capacityProfile,wireFormat,resultFormat,resultRepresentation,logicalResultLimits,inputAcquisitionModel,...rest}=m;const{schema:a,capacityProfile:b,wireFormat:c,...oldRest}=old;assert.deepEqual(rest,oldRest);
});
const replacements=[["import policy from \"./feedback-observations-capacity-source-model-v3.json\" with { type: \"json\" };", "import policy from \"./feedback-observations-capacity-source-model-v4.json\" with { type: \"json\" };\nimport {\n  PACKED_RESULT_LIMITS_V1, PackedResultError, createPackedResultAccountV1,\n  chargePackedResultWorkV1, packFeedbackResultV1, validatePackedResultV1,\n  meterPackedCompositionV1, readPackedFeedbackSummaryV1, readPackedFeedbackEventV1,\n} from \"./feedback-observations-packed-result-v1.mjs\";\n"], ["function budget() {\n  let remaining = L.workUnits;\n  return (n) => {\n    need(\n      Number.isSafeInteger(n) && n >= 0 && remaining >= n,\n      \"limits\",\n      \"logical-work-limit\",\n    );\n    remaining -= n;\n  };\n}\n", "function budget(account) {\n  return (n) => chargePackedResultWorkV1(account, n);\n}\n"], ["    wireFormat: policy.wireFormat,", "    wireFormat: policy.wireFormat,\n    resultFormat: policy.resultFormat,"], ["function outputCheck(result, work) {\n  let nodes = 0,\n    strings = 0,\n    width = 0;\n  const stack = [result];\n  while (stack.length) {\n    const v = stack.pop();\n    work(1);\n    need(++nodes <= L.resultNodes, \"limits\", \"result-nodes\");\n    if (typeof v === \"string\") {\n      strings += utf8bytes(v);\n      width += 2;\n      for (let i = 0; i < v.length; i++) {\n        work(1);\n        const c = v.charCodeAt(i);\n        width +=\n          c < 32\n            ? 6\n            : c === 34 || c === 92\n              ? 2\n              : c < 128\n                ? 1\n                : c < 2048\n                  ? 2\n                  : 3;\n      }\n    } else if (v === null) width += 4;\n    else if (typeof v === \"boolean\") width += v ? 4 : 5;\n    else if (typeof v === \"number\") width += String(v).length;\n    else {\n      const values = Array.isArray(v)\n        ? v\n        : Object.entries(v).flatMap(([k, x]) => [k, x]);\n      width += 2 + values.length * 2;\n      for (const x of values) stack.push(x);\n    }\n    need(\n      strings <= L.resultStringBytes && width <= L.resultBytes,\n      \"limits\",\n      \"result-width\",\n    );\n  }\n}\n", "// Packed output boundaries only. Original graph semantics and work sites stay above/below unchanged.\nconst originals = new WeakMap();\nfunction outputBase() {\n  return {\n    schema: policy.schema,\n    capacityProfile: policy.capacityProfile,\n    wireFormat: policy.wireFormat,\n    resultFormat: policy.resultFormat,\n  };\n}\nfunction authority() {\n  return {\n    fps: null,\n    exhaustivePopulation: false,\n    nativeSupported: false,\n    captureQualified: false,\n    evaluationEligibility: false,\n    scoringEligibility: false,\n    rankingEligibility: false,\n  };\n}\nfunction unavailable(stage, reason, diagnosticsProof) {\n  return {\n    ...outputBase(), status: \"unavailable\", stage, reason, proof: null,\n    diagnosticsProof, count: null, interval: null, observedHz: null,\n    events: Object.freeze([]), ...authority(),\n  };\n}\nfunction diagnosticsCache(diagnostics, account) {\n  const envelope = packFeedbackResultV1({ diagnostics }, account);\n  const view = validatePackedResultV1(envelope, account);\n  const envelopeCounters = meterPackedCompositionV1(view, envelope);\n  const skeletonCounters = meterPackedCompositionV1(view, unavailable(null, null, null));\n  return { envelope, envelopeCounters, skeletonCounters };\n}\nfunction boundedAdd(a, b) {\n  return Number.isSafeInteger(a) && a >= 0 && Number.isSafeInteger(b) &&\n    b >= 0 && b <= Number.MAX_SAFE_INTEGER - a ? a + b : Infinity;\n}\nfunction cachedFailureProof(cache, stage, reason) {\n  if (!cache) return null;\n  // Only source-inventoried fixed ASCII literals reach this closure. No graph\n  // access, codec call, string scan, fresh account, or recursive freeze occurs.\n  const e = cache.envelopeCounters, s = cache.skeletonCounters;\n  const names = boundedAdd(stage.length, reason.length);\n  const bytes = boundedAdd(boundedAdd(s.bytes - 6, names), e.bytes - 5);\n  const nodes = boundedAdd(s.nodes - 1, e.nodes);\n  const strings = boundedAdd(boundedAdd(s.stringBytes, names), e.stringBytes);\n  return bytes <= PACKED_RESULT_LIMITS_V1.wireBytes &&\n    nodes <= PACKED_RESULT_LIMITS_V1.wireNodes &&\n    strings <= PACKED_RESULT_LIMITS_V1.wireStringBytes ? cache.envelope : null;\n}\nfunction observed(result, account) {\n  const proof = packFeedbackResultV1(result, account);\n  const view = validatePackedResultV1(proof, account);\n  const dto = {\n    ...outputBase(), status: \"observed\", stage: null, reason: null,\n    proof, diagnosticsProof: null, ...authority(),\n  };\n  meterPackedCompositionV1(view, dto);\n  // Pay the native fixed DTO freeze scan before the final positive guard.\n  chargePackedResultWorkV1(account, 16);\n  chargePackedResultWorkV1(account, 1);\n  Object.freeze(dto);\n  originals.set(dto, { view, account });\n  return dto;\n}\nfunction original(value) {\n  const owned = originals.get(value);\n  if (!owned) throw new PackedResultError();\n  chargePackedResultWorkV1(owned.account, 1);\n  return owned;\n}\nexport function inspectBrowserFeedbackCapacityV4(value) {\n  const owned = original(value);\n  const s = readPackedFeedbackSummaryV1(owned.view);\n  const dto = { status: s.status, count: s.count, interval: s.interval,\n    eventCount: s.eventCount, ...authority() };\n  chargePackedResultWorkV1(owned.account, 11);\n  chargePackedResultWorkV1(owned.account, 1);\n  return Object.freeze(dto);\n}\nexport function readBrowserFeedbackCapacityEventV4(value, index) {\n  const owned = original(value);\n  const event = readPackedFeedbackEventV1(owned.view, index);\n  chargePackedResultWorkV1(owned.account, 1);\n  return event;\n}\nexport function meterBrowserFeedbackCapacityCompositionV4(value, composition) {\n  const owned = original(value);\n  const counters = meterPackedCompositionV1(owned.view, composition);\n  chargePackedResultWorkV1(owned.account, 3);\n  chargePackedResultWorkV1(owned.account, 1);\n  return Object.freeze(counters);\n}\nexport function chargeBrowserFeedbackCapacityWorkV4(value, units) {\n  const owned = original(value);\n  chargePackedResultWorkV1(owned.account, units);\n}\n"], ["export function evaluateBrowserFeedbackObservationsCapacityV3(", "export function evaluateBrowserFeedbackObservationsCapacityV4("], ["  const work = budget(),\n    result = base();\n  let failureDiagnostics = {};", "  const account = createPackedResultAccountV1(),\n    work = budget(account),\n    result = base();\n  let failureDiagnostics = null;"], ["    outputCheck({ diagnostics: result.diagnostics }, work);\n    failureDiagnostics = result.diagnostics;", "    failureDiagnostics = diagnosticsCache(result.diagnostics, account);"], ["    outputCheck(result, work);\n    return freeze(result);", "    return observed(result, account);"], ["    const refusal = base();\n    refusal.diagnostics = failureDiagnostics;\n    refusal.stage = error instanceof Refusal ? error.stage : \"input\";\n    refusal.reason =\n      error instanceof Refusal ? error.reason : \"unsupported-input\"; // Fixed failure closure remains available even after the logical budget is exhausted.\n    return freeze(refusal);", "    const authentic = error instanceof Refusal || error instanceof PackedResultError;\n    const stage = authentic ? error.stage : \"input\";\n    const reason = authentic ? error.reason : \"unsupported-input\";\n    return Object.freeze(unavailable(stage, reason,\n      cachedFailureProof(failureDiagnostics, stage, reason)));"]];
test('frozen historical pins and complete source whitelist protect every semantic byte and work call',()=>{
 const old=text('feedback-observations-capacity-core-v3.mjs');assert.equal(createHash('sha256').update(old).digest('hex'),'eca4313c09dc65b8fe9e40fb822cbad3834666327888292458b97c3d6d344697');assert.equal(createHash('sha256').update(text(acquisition.path)).digest('hex'),acquisition.sha256);assert.equal(Buffer.byteLength(text(acquisition.path)),acquisition.bytes);
 let expected=old;for(const[a,b]of replacements){assert.equal(expected.split(a).length-1,1,'unique literal anchor');expected=expected.replace(a,b);}assert.equal(text('feedback-observations-capacity-core-v4.mjs'),expected);
 const workSites=s=>[...s.matchAll(/\bwork\([^;]*?\)/gs)].map(m=>m[0]);const removed=replacements.filter(([a])=>a.startsWith('function budget')||a.startsWith('function outputCheck')).map(([a])=>a).join('');const protectedOld=old.replace(replacements[1][0],'').replace(replacements[3][0],'');const protectedNew=expected.replace(replacements[1][1],'').replace(replacements[3][1],'');assert.deepEqual(workSites(protectedNew),workSites(protectedOld));assert.ok(removed.includes('work(1)'));
});
test('complete proof reproduces every historical field, key order, repeated relation and origin',async()=>{
 const m=await load();for(const mutate of [()=>{},g=>{g.stats=[['authored_é_😀',null,'info','trace','1']];g.scopeStats=structuredClone(g.stats);},g=>{g.nodes.find(n=>n.name==='PipelineReporter').args.find(a=>a.key==='frame_reporter.state').s='STATE_DROPPED';}]){
 const g=authoredGraph();mutate(g);const f=exportCompactGraphV2(g),old=historical(f.target.bytes,f.scope.bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.target.bytes,f.scope.bytes,selector);assertObserved(r);const decoded=materialize(r.proof);assert.equal(JSON.stringify(decoded),JSON.stringify(normalize(old)));assert.equal(decoded.executionEvidence,'untrusted-supplied-compact-csv');assert.equal(decoded.traceOrigin,'unestablished');assert.ok(Object.isFrozen(r.proof));
 }
});
for(const n of [120,240])test('packed representation admits complete authored '+n+'x24 while retaining real V3 refusal',async()=>{
 const m=await load(),f=makePackedFeedbackAuthoredFixtureV1({presentations:n,aggregateMembers:24}),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.targetCSV,f.scopeCSV,f.selector);assert.equal(f.legacyResult.status,'unavailable');assertObserved(r);assert.equal(JSON.stringify(materialize(r.proof)),JSON.stringify(normalize(f.canonicalCandidate)));assert.equal(m.inspectBrowserFeedbackCapacityV4(r).eventCount,n);for(let i=0;i<n;i++)assert.deepEqual(m.readBrowserFeedbackCapacityEventV4(r,i),{index:i,displayTraceId:f.canonicalCandidate.events[i].displayTraceId,terminalTs:f.canonicalCandidate.events[i].terminalTs});for(let pass=0;pass<2;pass++)assert.ok(m.meterBrowserFeedbackCapacityCompositionV4(r,{core:r,wrapper:{elapsedMs:12.375,authored:true,pass}}).bytes<=1048576);
});
test('complete authored480 refuses packed-wire-strings with no escaped metrics or brand',async()=>{
 const m=await load(),f=makePackedFeedbackAuthoredFixtureV1({presentations:480,aggregateMembers:24}),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.targetCSV,f.scopeCSV,f.selector);assert.equal(r.reason,'packed-wire-strings');assert.deepEqual(r,unavailable('limits','packed-wire-strings',r.diagnosticsProof));assert.throws(()=>m.inspectBrowserFeedbackCapacityV4(r),codec.PackedResultError);
});
test('unavailable exact DTO and original primitive/selector guard reasons are preserved',async()=>{
 const m=await load(),f=exportCompactGraphV2(authoredGraph());for(const [a,b,s]of [[Buffer.from('bad'),f.scope.bytes,selector],[null,f.scope.bytes,selector],[new DataView(new ArrayBuffer(8)),f.scope.bytes,selector],[f.target.bytes,f.scope.bytes,'{}'],[f.target.bytes,f.scope.bytes,selector+' '.repeat(16777216)]]){const old=historical(a,b,s),r=m.evaluateBrowserFeedbackObservationsCapacityV4(a,b,s);assert.deepEqual(r,unavailable(old.stage,old.reason));assert.deepEqual(Object.keys(r),Object.keys(unavailable(old.stage,old.reason)));assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.events));}
});
test('old hostile graph guards retain stage/reason when shared budget reaches them',async()=>{
 const m=await load();for(const mutate of [g=>{g.nodes[2].args.find(a=>a.key==='debug.data.navigationId').s='wrong';},g=>{g.nodes.find(n=>n.name==='DrawFrame').parent='999';},g=>{g.nodes.find(n=>n.name==='PipelineReporter').args.push(argument('frame_reporter.display_trace_id','int','99'));},g=>{g.nodes.find(n=>n.name==='PipelineReporter').pid='99';},g=>{g.stats=[['clock_sync_mixed_clock_sources',null,'error','trace','1']];g.scopeStats=structuredClone(g.stats);}]){
 const g=authoredGraph();mutate(g);const f=exportCompactGraphV2(g),old=historical(f.target.bytes,f.scope.bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.target.bytes,f.scope.bytes,selector);assert.equal(old.status,'unavailable');assert.equal(r.stage,old.stage);assert.equal(r.reason,old.reason);assert.equal(r.proof,null);if(Object.keys(old.diagnostics).length)assert.deepEqual(materialize(r.diagnosticsProof),{diagnostics:old.diagnostics});
 }
 const f=exportCompactGraphV2(authoredGraph());f.target.tables[0][0][0]='2';let r=m.evaluateBrowserFeedbackObservationsCapacityV4(csv(f.target.tables,f.target.headers),f.scope.bytes,selector);assert.equal(r.reason,'dictionary-id');assert.equal(r.diagnosticsProof,null);
});
test('original brand alone admits frozen summary/event/composition and finite wrapper floats',async()=>{
 const m=await load(),r=evaluate(m),d=materialize(r.proof),s=m.inspectBrowserFeedbackCapacityV4(r);assert.deepEqual(s,{status:'observed',count:d.count,interval:d.interval,eventCount:d.events.length,...B});assert.deepEqual(Object.keys(s),['status','count','interval','eventCount',...Object.keys(B)]);assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.interval));assert.deepEqual(m.readBrowserFeedbackCapacityEventV4(r,0),{index:0,displayTraceId:d.events[0].displayTraceId,terminalTs:d.events[0].terminalTs});assert.ok(Object.isFrozen(m.readBrowserFeedbackCapacityEventV4(r,0)));const counters=m.meterBrowserFeedbackCapacityCompositionV4(r,{core:r,elapsed:0.125});assert.deepEqual(Object.keys(counters),['bytes','nodes','stringBytes']);assert.ok(Object.isFrozen(counters));assert.equal(m.chargeBrowserFeedbackCapacityWorkV4(r,0),undefined);
});
test('all forged brands and Proxy inputs refuse before any trap',async()=>{
 const m=await load(),r=evaluate(m),account=codec.createPackedResultAccountV1(),view=codec.validatePackedResultV1(r.proof,account);let traps=0;const proxy=new Proxy(r,{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();}});for(const fake of [{...r},JSON.parse(JSON.stringify(r)),proxy,account,view,null,1,unavailable('input','unsupported-input')])for(const fn of [()=>m.inspectBrowserFeedbackCapacityV4(fake),()=>m.readBrowserFeedbackCapacityEventV4(fake,0),()=>m.meterBrowserFeedbackCapacityCompositionV4(fake,{}),()=>m.chargeBrowserFeedbackCapacityWorkV4(fake,1)])assert.throws(fn,codec.PackedResultError);assert.equal(traps,0);
});
test('invalid charges deplete sticky and old frozen observed remains unchanged across every operation',async()=>{
 const m=await load();for(const units of [-1,NaN,Infinity,1.25,Number.MAX_SAFE_INTEGER,{},undefined]){const r=evaluate(m),before=JSON.stringify(r);assert.throws(()=>m.chargeBrowserFeedbackCapacityWorkV4(r,units),e=>e.reason==='logical-work-limit');for(const fn of [()=>m.inspectBrowserFeedbackCapacityV4(r),()=>m.readBrowserFeedbackCapacityEventV4(r,0),()=>m.meterBrowserFeedbackCapacityCompositionV4(r,{}),()=>m.chargeBrowserFeedbackCapacityWorkV4(r,0)])assert.throws(fn,e=>e.reason==='logical-work-limit');assert.equal(JSON.stringify(r),before);}
 const r=evaluate(m);for(const index of [-0,-1,1,1.5,NaN])assert.throws(()=>m.readBrowserFeedbackCapacityEventV4(r,index),codec.PackedResultError);
});

// Authored, hash-controlled source-copy harness. These exports never exist in
// production; only the existing charger is faulted, never replaced or reset.
async function harness(){
 let cs=text('feedback-observations-packed-result-v1.mjs');
 const state='let __phase="initial",__fault=null,__created=0,__last=null,__calls=0,__afterFault=0,__tripped=false;\nexport function __setPhase(p){__phase=p;}\nexport function __control(f){__fault=f;__calls=0;__afterFault=0;__tripped=false;}\nexport function __snapshot(){return {phase:__phase,created:__created,calls:__calls,afterFault:__afterFault,left:__last?.left,failed:__last?.failed};}\n';
 cs=state+cs;
 const unique=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'unique instrumentation anchor');return s.replace(a,b);};
 cs=unique(cs,'  const token = Object.freeze({});','  __created++;\n  const token = Object.freeze({});');
 cs=unique(cs,'  const a = accounts.get(token);','  const a = accounts.get(token);\n  __last=a;__calls++;if(__tripped)__afterFault++;\n  if(__fault && __fault.phase===__phase && --__fault.nth===0){__tripped=true;if(__fault.invalid)fail();n=Number.MAX_SAFE_INTEGER;}');
 const codecURL='data:text/javascript;base64,'+Buffer.from(cs).toString('base64');
 const c=await import(codecURL);
 let s=text('feedback-observations-capacity-core-v4.mjs');
 s=unique(s,'"./feedback-observations-capacity-source-model-v4.json"',JSON.stringify(url('feedback-observations-capacity-source-model-v4.json').href));
 s=unique(s,'"./feedback-observations-packed-result-v1.mjs"',JSON.stringify(codecURL));
 s='import {__setPhase} from '+JSON.stringify(codecURL)+';\n'+s;
 for(const [anchor,phase]of [
 ['  const envelope = packFeedbackResultV1({ diagnostics }, account);','early-pack'],
 ['  const view = validatePackedResultV1(envelope, account);','early-validate'],
 ['  const envelopeCounters = meterPackedCompositionV1(view, envelope);','early-meter-envelope'],
 ['  const skeletonCounters = meterPackedCompositionV1(view, unavailable(null, null, null));','early-meter-skeleton'],
 ['  return { envelope, envelopeCounters, skeletonCounters };','semantic-after-cache'],
 ['  const proof = packFeedbackResultV1(result, account);','final-pack'],
 ['  const view = validatePackedResultV1(proof, account);','final-validate'],
 ['  meterPackedCompositionV1(view, dto);','final-meter'],
 ['  chargePackedResultWorkV1(account, 16);','final-freeze'],
 ['  chargePackedResultWorkV1(account, 1);','final-guard'],
 ['    if (typeof selectorJSON === "string") work(selectorJSON.length * 4);','semantic-initial'],
 ])s=unique(s,anchor,'  __setPhase('+JSON.stringify(phase)+');\n'+anchor);
 s+='\nexport {cachedFailureProof as __cachedFailureProof,unavailable as __unavailable,diagnosticsCache as __diagnosticsCache};\n';
 return {m:await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64')),c};
}
test('one sticky account covers every semantic/output pass; all exhausted closures are traversal-free',async()=>{
 const {m,c}=await harness();let created=0;
 for(const phase of ['semantic-initial','early-pack','early-validate','early-meter-envelope','early-meter-skeleton','semantic-after-cache','final-pack','final-validate','final-meter','final-freeze','final-guard']){
  c.__control({phase,nth:phase==='final-guard'||phase==='final-freeze'?1:2});
  const r=evaluate(m),s=c.__snapshot();created++;assert.equal(s.created,created);assert.equal(s.failed,true,phase);assert.equal(s.afterFault,0,phase+' has no post-exhaustion work');assert.equal(r.status,'unavailable',phase);assert.equal(r.reason,'logical-work-limit',phase);assert.equal(r.proof,null);assert.equal(r.count,null);assert.equal(r.interval,null);assert.equal(r.observedHz,null);assert.deepEqual(r.events,[]);
  const cached=['semantic-after-cache','final-pack','final-validate','final-meter','final-freeze','final-guard'].includes(phase);assert.equal(r.diagnosticsProof!==null,cached,phase);assert.throws(()=>m.inspectBrowserFeedbackCapacityV4(r));
 }
});
test('authentic invalid-proof failures map output and incomplete diagnostics caches never escape',async()=>{
 const {m,c}=await harness();for(const phase of ['early-pack','early-validate','early-meter-envelope','early-meter-skeleton','final-pack','final-validate','final-meter']){
 c.__control({phase,nth:2,invalid:true});const r=evaluate(m);assert.equal(r.stage,'output');assert.equal(r.reason,'packed-invalid-proof');assert.equal(r.diagnosticsProof!==null,phase.startsWith('final'));assert.equal(r.proof,null);assert.equal(c.__snapshot().afterFault,0);
 }
});
test('early representation failure precedes timestamp guard, completed cache retains later diagnostics',async()=>{
 const {m,c}=await harness(),g=authoredGraph();g.stats=[['clock_sync_mixed_clock_sources',null,'error','trace','1']];g.scopeStats=structuredClone(g.stats);
 for(const phase of ['early-pack','early-validate','early-meter-envelope','early-meter-skeleton']){c.__control({phase,nth:2,invalid:true});const r=evaluate(m,g);assert.deepEqual(r,unavailable('output','packed-invalid-proof'));}
 c.__control(null);const r=evaluate(m,g);assert.equal(r.stage,'timestamps');assert.equal(r.reason,'known-timestamp-corruption');assert.ok(r.diagnosticsProof);assert.equal(materialize(r.diagnosticsProof).diagnostics.stats.target[0].name,'clock_sync_mixed_clock_sources');
});
test('charge entry1 plus units, zero and final guard debit exactly; no new account on later operations',async()=>{
 const {m,c}=await harness();c.__control(null);const r=evaluate(m),count=c.__snapshot().created;
 for(const [units,cost]of [[0,1],[7,8],[1,2]]){const before=c.__snapshot().left;assert.equal(m.chargeBrowserFeedbackCapacityWorkV4(r,units),undefined);assert.equal(before-c.__snapshot().left,cost);assert.equal(c.__snapshot().created,count);}
 // Leave enough for precisely one paid inspect; a second inspect must refuse.
 const before=c.__snapshot().left;m.inspectBrowserFeedbackCapacityV4(r);const inspectCost=before-c.__snapshot().left;
 m.chargeBrowserFeedbackCapacityWorkV4(r,c.__snapshot().left-inspectCost-1);assert.equal(c.__snapshot().left,inspectCost);m.inspectBrowserFeedbackCapacityV4(r);assert.equal(c.__snapshot().left,0);const unchanged=JSON.stringify(r);assert.throws(()=>m.inspectBrowserFeedbackCapacityV4(r),e=>e.reason==='logical-work-limit');assert.equal(JSON.stringify(r),unchanged);assert.equal(c.__snapshot().created,count);
});
test('late event and composition queries share retained account and exhaust without budget recovery',async()=>{
 const {m,c}=await harness();for(const operation of [r=>m.readBrowserFeedbackCapacityEventV4(r,0),r=>m.meterBrowserFeedbackCapacityCompositionV4(r,{core:r,elapsed:1.125})]){
  c.__control(null);const r=evaluate(m),before=c.__snapshot().left,created=c.__snapshot().created;operation(r);const cost=before-c.__snapshot().left;m.chargeBrowserFeedbackCapacityWorkV4(r,c.__snapshot().left-cost-1);operation(r);assert.equal(c.__snapshot().left,0);assert.throws(()=>operation(r),e=>e.reason==='logical-work-limit');assert.throws(()=>m.chargeBrowserFeedbackCapacityWorkV4(r,0),e=>e.reason==='logical-work-limit');assert.equal(c.__snapshot().created,created);
 }
});

// Independent unbounded TEST-ONLY implementation of the wire occurrence metric.
// Unlike the production walker, it can report cap+1 for comparison before depletion.
function referenceWire(value){
 const m={bytes:0,nodes:0,stringBytes:0};
 const string=s=>{m.bytes+=Buffer.byteLength(JSON.stringify(s));m.stringBytes+=Buffer.byteLength(s);};
 function visit(v){m.nodes++;if(v===null||typeof v==='boolean'){m.bytes+=5;return;}if(typeof v==='string'){string(v);return;}if(typeof v==='number'){m.bytes+=String(v).length;return;}const keys=Object.keys(v),array=Array.isArray(v);m.nodes+=keys.length;m.bytes+=2+(keys.length+(array?1:0))*3;for(const key of keys)string(key);for(const key of keys)visit(v[key]);}
 visit(value);return m;
}
test('cached failure arithmetic equals independent full meter at every cap and cap+1 after exhaustion',async()=>{
 const {m,c}=await harness();c.__control(null);const core=evaluate(m),view=c.validatePackedResultV1(core.proof,c.createPackedResultAccountV1()),stage='timestamps',reason='known-timestamp-corruption';
 const skeleton=m.__unavailable(null,null,null),s=referenceWire(skeleton);assert.deepEqual(c.meterPackedCompositionV1(view,skeleton),s);
 // Shapes of ordinary packed envelopes have fixed depth; these synthetic trusted
 // metadata envelopes vary each wire dimension independently for exact cap tests.
 const samples=[];
 // String cap: ordinary ASCII payload has canonical bytes well below wire cap.
 const empty={schema:'browser-feedback-packed-result-v1',strings:[],shapes:[],body:''};
 const base=referenceWire(m.__unavailable(stage,reason,empty));
 for(const delta of [0,1])samples.push({cap:'stringBytes',value:{...empty,body:'x'.repeat(524288-base.stringBytes+delta)},delta});
 // Byte cap: NUL controls use six JSON bytes per one UTF-8 string byte.
 const prefix='\0'.repeat(Math.floor((1048576-base.bytes)/6)),baseBytes=referenceWire(m.__unavailable(stage,reason,{...empty,body:prefix}));
 for(const delta of [0,1])samples.push({cap:'bytes',value:{...empty,body:prefix+'x'.repeat(1048576-baseBytes.bytes+delta)},delta});
 // Wire occurrence counts are always odd (root + two per edge). Exact65536
 // is unreachable; nearest admitted65535 and refused65537 straddle its cap.
 for(const delta of [0,1]){let value={...empty,shapes:[Array(32000).fill(0)]},dto=m.__unavailable(stage,reason,value),initial=referenceWire(dto).nodes;const remaining=(delta?65537:65535)-initial;value.shapes[0].push(...Array(Math.floor(remaining/2)).fill(0));assert.equal(remaining%2,0);samples.push({cap:'nodes',value,delta});}
 const measurements=samples.map(sample=>({...sample,envelopeCounters:referenceWire(sample.value),full:referenceWire(m.__unavailable(stage,reason,sample.value))}));
 for(const sample of measurements){const cap={bytes:1048576,nodes:65536,stringBytes:524288}[sample.cap];assert.equal(sample.full[sample.cap],sample.cap==='nodes'?(sample.delta?65537:65535):cap+sample.delta);const fits=sample.full.bytes<=1048576&&sample.full.nodes<=65536&&sample.full.stringBytes<=524288;assert.equal(fits,!sample.delta,sample.cap+' isolate cap');if(fits)assert.deepEqual(c.meterPackedCompositionV1(view,m.__unavailable(stage,reason,sample.value)),sample.full);else assert.throws(()=>c.meterPackedCompositionV1(view,m.__unavailable(stage,reason,sample.value)));}
 // Use the original core's exhausted account. Failure closure may only select
 // already completed counters/envelope; no metering or descriptor traversal.
 m.chargeBrowserFeedbackCapacityWorkV4(core,0);m.chargeBrowserFeedbackCapacityWorkV4(core,c.__snapshot().left-1);assert.throws(()=>m.chargeBrowserFeedbackCapacityWorkV4(core,0));const calls=c.__snapshot().calls;
 for(const sample of measurements){let traps=0;const envelope=new Proxy(sample.value,{get(){traps++;throw Error('traversed');},ownKeys(){traps++;throw Error('traversed');}});const cache={envelope,envelopeCounters:sample.envelopeCounters,skeletonCounters:s};const actual=m.__cachedFailureProof(cache,stage,reason);assert.equal(actual,sample.delta?null:envelope);assert.equal(traps,0);assert.equal(c.__snapshot().calls,calls);}
});

test('fixed source inventory proves every refusal stage/reason has bounded unescaped ASCII width',async()=>{
 const {parseAst}=await import('rolldown/parseAst');const old=text('feedback-observations-capacity-core-v3.mjs'),ast=parseAst(old),pairs=[],direct=[];
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='CallExpression'&&n.callee?.name==='need'){assert.equal(n.arguments[1].type,'Literal');assert.equal(n.arguments[2].type,'Literal');pairs.push([n.arguments[1].value,n.arguments[2].value]);}if(n.type==='NewExpression'&&n.callee?.name==='Refusal')direct.push(n.arguments);for(const [key,value]of Object.entries(n))if(key!=='parent')if(Array.isArray(value))value.forEach(walk);else walk(value);}
 walk(ast);assert.equal(pairs.length,148);assert.equal(direct.length,4);const forward=direct.filter(a=>a[0].type==='Identifier');assert.equal(forward.length,1);assert.deepEqual(forward[0].map(a=>a.name),['stage','reason']);for(const a of direct.filter(a=>a[0].type==='Literal'))pairs.push(a.map(a=>a.value));
 pairs.push(['input','unsupported-input']);for(const r of ['packed-invalid-proof','logical-work-limit','packed-wire-bytes','packed-wire-nodes','packed-wire-strings','packed-logical-bytes','packed-logical-nodes','packed-logical-strings','packed-logical-depth','packed-offsets'])pairs.push([r==='packed-invalid-proof'?'output':'limits',r]);
 for(const[stage,reason]of pairs){assert.match(stage,/^[a-z][a-z0-9-]*$/);assert.match(reason,/^[a-z][a-z0-9-]*$/);assert.ok(stage.length>=3&&reason.length>=4);assert.ok(stage.length+reason.length<=42);}
 assert.equal(new Set(pairs.flat()).size,163);
});
const variants=[
 ['baseline',()=>{}],
 ['partial/forked reporter',g=>{const n=structuredClone(g.nodes.at(-1));n.id='20';n.argSet='20';n.args.find(a=>a.key==='frame_reporter.state').s='STATE_PRESENTED_PARTIAL';g.nodes.push(n);}],
 ...['0','-2','-9223372036854775808'].map(id=>['signed display '+id,g=>{for(const n of g.nodes)for(const a of n.args)if(a.key.endsWith('display_trace_id'))a.i=id;g.derived=[['51',id]];}]),
 ...[100,400,450].map(terminal=>['half-open terminal '+terminal,g=>{g.nodes.at(-1).dur=String(terminal-90);}]),
 ['outside positive missing submit',g=>{g.nodes.at(-1).dur='400';g.nodes=g.nodes.filter(n=>!n.args.some(a=>a.s==='STEP_SUBMIT_COMPOSITOR_FRAME'));}],
 ['foreign tree coverage',g=>{g.nodes.at(-1).args.find(a=>a.key.endsWith('layer_tree_host_id')).i='8';}],
 ...['clock_sync_cache_miss','track_event_parser_errors','unknown_future_error'].map(name=>['warning '+name,g=>{g.stats=[[name,'0','error','trace','1']];g.scopeStats=structuredClone(g.stats);}]),
 ['quoted multiline/literalNULL/Unicode',g=>{g.nodes.at(-1).args.push(argument('authored.note','string','[NULL]'),argument('authored.multiline','string','a,"b"\nc_é_😀'));}],
 ['matched NULL value channel',g=>{g.nodes.at(-1).args.push({flat:null,key:null,type:'null',i:null,s:null,r:null});}],
 ['typed foreign reporter',g=>{const n=structuredClone(g.nodes.at(-1));n.id='30';n.argSet='30';n.pid='999';n.upid='999';n.dur='-1';g.nodes.push(n);}],
 ...['0','-2','-9223372036854775808'].map(id=>['signed surface '+id,g=>{for(const n of g.nodes)for(const a of n.args)if((a.key.endsWith('surface_frame_trace_id')||a.key.endsWith('aggregated_surface_frame_trace_ids[0]'))&&a.i==='51')a.i=id;g.derived=[[id,'61']];}]),
];
for(const[name,mutate]of variants)test('complete common admitted proof: '+name,async()=>{
 const m=await load(),g=authoredGraph();mutate(g);const f=exportCompactGraphV2(g),old=historical(f.target.bytes,f.scope.bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.target.bytes,f.scope.bytes,selector);assert.equal(old.status,'observed');assertObserved(r);assert.equal(JSON.stringify(materialize(r.proof)),JSON.stringify(normalize(old)));const summary=m.inspectBrowserFeedbackCapacityV4(r);assert.equal(summary.eventCount,old.events.length);for(let i=0;i<old.events.length;i++)assert.deepEqual(m.readBrowserFeedbackCapacityEventV4(r,i),{index:i,displayTraceId:old.events[i].displayTraceId,terminalTs:old.events[i].terminalTs});
});
for(const[name,mutate]of [
 ['missing tree',g=>{g.nodes.at(-1).args=g.nodes.at(-1).args.filter(a=>!a.key.endsWith('layer_tree_host_id'));}],
 ['wrong typed tree',g=>{g.nodes.at(-1).args.find(a=>a.key.endsWith('layer_tree_host_id')).type='int';}],
 ['unclosed positive',g=>{g.nodes.at(-1).dur='-1';}],
 ['wrong loader',g=>{g.nodes.find(n=>n.name==='authored:start').args[0].s='other';}],
 ['wrong imported lifetime',g=>{g.nodes.find(n=>n.name==='DrawFrame').upid='9';}],
 ['missing submit',g=>{g.nodes=g.nodes.filter(n=>!n.args.some(a=>a.s==='STEP_SUBMIT_COMPOSITOR_FRAME'));}],
 ['duplicate aggregate member',g=>{g.nodes.find(n=>n.args.some(a=>a.s==='STEP_SURFACE_AGGREGATION')).args.at(-1).i='51';}],
 ['gapped aggregate array',g=>{g.nodes.find(n=>n.args.some(a=>a.s==='STEP_SURFACE_AGGREGATION')).args.at(-1).key='chrome_graphics_pipeline.aggregated_surface_frame_trace_ids[3]';}],
 ['conflicting display terminal',g=>{const n=structuredClone(g.nodes.at(-1));n.id='20';n.argSet='20';n.dur='211';g.nodes.push(n);}],
 ['endpoint overflow',g=>{g.nodes.at(-1).dur='9223372036854775807';}],
 ['wrong phase family',g=>{g.nodes.find(n=>n.name==='authored:start').name='other:start';}],
 ['wrong target frame',g=>{g.nodes.find(n=>n.name==='SetLayerTreeId').args.find(a=>a.key==='debug.data.frame').s='OTHER_FRAME';}],
 ['conflicting indexed process',g=>{g.nodes[0].args.push(argument('debug.data.frames[1].frame','string','AUTHORED_FRAME'),argument('debug.data.frames[1].processId','int',999));}],
 ['late invalid positive',g=>{const n=structuredClone(g.nodes.at(-1));n.id='30';n.argSet='30';n.args.find(a=>a.key.endsWith('display_trace_id')).i='62';g.nodes.push(n);}],
 ])test('complete hostile guard parity: '+name,async()=>{
 const m=await load(),g=authoredGraph();mutate(g);const f=exportCompactGraphV2(g),old=historical(f.target.bytes,f.scope.bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f.target.bytes,f.scope.bytes,selector);assert.equal(old.status,'unavailable',name);assert.equal(r.stage,old.stage);assert.equal(r.reason,old.reason);assert.equal(r.proof,null);if(Object.keys(old.diagnostics).length)assert.deepEqual(materialize(r.diagnosticsProof),{diagnostics:old.diagnostics});else assert.equal(r.diagnosticsProof,null);
});
test('cross-export derived mismatch and raw graph mismatch preserve pre-diagnostics refusal',async()=>{
 const m=await load(),first=exportCompactGraphV2(authoredGraph()),g=authoredGraph();g.derived=[['51','62']];let second=exportCompactGraphV2(g);for(const f of [[first.target,second.scope],[second.target,first.scope]]){const old=historical(f[0].bytes,f[1].bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(f[0].bytes,f[1].bytes,selector);assert.equal(old.status,'unavailable');assert.deepEqual(r,unavailable(old.stage,old.reason));}
 g.derived=[['51','61']];g.nodes.find(n=>n.name==='Graphics.Pipeline').trackName='OTHER_TRACK';second=exportCompactGraphV2(g);const old=historical(first.target.bytes,second.scope.bytes,selector),r=m.evaluateBrowserFeedbackObservationsCapacityV4(first.target.bytes,second.scope.bytes,selector);assert.equal(old.status,'unavailable');assert.deepEqual(r,unavailable(old.stage,old.reason));
});

test('standalone diagnostics admission succeeds even when its later optional failure wrapper cannot fit',async()=>{
 const {m,c}=await harness();c.__control(null);
 const empty=c.packFeedbackResultV1({diagnostics:{payload:''}},c.createPackedResultAccountV1()),emptyCounters=referenceWire(empty),skeleton=m.__unavailable(null,null,null),stage='timestamps',reason='known-timestamp-corruption';
 // Body/dictionary structure is independent of this string's content and width.
 const n=524288-emptyCounters.stringBytes-100;
 const account=c.createPackedResultAccountV1(),cache=m.__diagnosticsCache({payload:'x'.repeat(n)},account);
 assert.equal(cache.envelopeCounters.stringBytes,524188);
 assert.deepEqual(cache.envelopeCounters,referenceWire(cache.envelope));
 assert.deepEqual(cache.skeletonCounters,referenceWire(skeleton));
 const full=referenceWire(m.__unavailable(stage,reason,cache.envelope));assert.ok(full.stringBytes>524288);assert.equal(m.__cachedFailureProof(cache,stage,reason),null);
 // Actual meter agrees BEFORE depletion; it refuses only the optional future
 // composition. This does not retroactively reject the standalone admission.
 const view=c.validatePackedResultV1(cache.envelope,account);assert.throws(()=>c.meterPackedCompositionV1(view,m.__unavailable(stage,reason,cache.envelope)),e=>e.reason==='packed-wire-strings');
 assert.throws(()=>c.chargePackedResultWorkV1(account,Number.MAX_SAFE_INTEGER),e=>e.reason==='logical-work-limit');
});
test('failure arithmetic checked-add rejects overflow and synthetic unreachable even node boundary correctly',async()=>{
 const {m}=await harness(),stage='input',reason='unsupported-input',envelope=Object.freeze({}),skeletonCounters={bytes:100,nodes:101,stringBytes:60};
 // Native wire trees are odd. These exact even counters are explicitly synthetic
 // arithmetic controls, not a claim that a65536-node wire tree can be produced.
 for(const nodes of [65536,65537]){const cache={envelope,envelopeCounters:{bytes:50,nodes:nodes-100,stringBytes:10},skeletonCounters};assert.equal(m.__cachedFailureProof(cache,stage,reason),nodes===65536?envelope:null);}
 for(const key of ['bytes','nodes','stringBytes'])for(const value of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER]){const e={bytes:50,nodes:1,stringBytes:10,[key]:value};assert.equal(m.__cachedFailureProof({envelope,envelopeCounters:e,skeletonCounters},stage,reason),null);}
});
test('test-only materialization preserves own __proto__ data property without changing prototypes',()=>{
 const v={};Object.defineProperty(v,'__proto__',{value:{authored:true},enumerable:true});const envelope=codec.packFeedbackResultV1(v,codec.createPackedResultAccountV1()),decoded=materialize(envelope);assert.equal(Object.getPrototypeOf(decoded),Object.prototype);assert.ok(Object.hasOwn(decoded,'__proto__'));assert.deepEqual(decoded.__proto__,{authored:true});
});
