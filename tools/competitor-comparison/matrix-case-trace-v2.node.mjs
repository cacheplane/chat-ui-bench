import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const original=await readFile(new URL('./matrix-run-v5.mjs',import.meta.url),'utf8');
const traced=await readFile(new URL('./matrix-case-trace-v2.mjs',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const body=(s,start,end)=>{const a=s.indexOf(start),b=end?s.indexOf(end,a):s.length;assert.ok(a>=0&&b>a);return s.slice(a,b).trimEnd();};
test('traced case retains every functional V5 byte outside named additive capture seams',()=>{
 assert.ok(traced.length>0,'maintained trace case exists');
 let actual=body(traced,'export async function runMatrixCase(');
 const found=[];actual=actual.replace(/^ *\/\/ TRACE-V2-BEGIN ([a-z-]+)\n[\s\S]*?^ *\/\/ TRACE-V2-END \1\n/gm,(block,name)=>{found.push(name);return '';});
 assert.deepEqual(found,['create','setup','ack','finish','cleanup-stop','cleanup-seal','publish','stop']);
 const expected=body(original,'export async function runMatrixCase(','\nexport async function runMatrixInvocation');
 assert.equal(actual,expected);
});
test('stock bridge is byte-identical and trace operations cannot enter the readiness path',()=>{
 const start='async function installMatrixThreadplaneBridge(',end='\nexport async function runMatrixCase(';
 assert.equal(body(traced,start,end),body(original,start,end));
 assert.ok(traced.indexOf('await trace.setup(')<traced.indexOf("diagnostics.dispatched('start')"));
 assert.match(traced,/trace\.assertBeforeStart\(\);\n \/\/ TRACE-V2-END setup\n  diagnostics\.dispatched\('start'\);/);
 assert.ok(traced.indexOf('await trace.finish(')>traced.indexOf("throw Error('matrix-page-or-resource-error')"));
 assert.ok(traced.indexOf('trace.beforeBrowserClose(')<traced.indexOf('const originalClose=browser.close()'));
 assert.ok(traced.indexOf('trace.seal(')>traced.indexOf('const originalClose=browser.close()'));
 assert.doesNotMatch(traced,/bindEvaluate|Debugger\.|Profiler\.|Runtime\.evaluate/);
});

test('trace publication stop is reapplied after inherited publication handling',()=>{const assignment=traced.indexOf('stopInvocation=artifacts.stats().failed||store.stats().stopped;');const final=traced.indexOf('stopInvocation ||= tracePublicationStop;');assert.ok(assignment>0&&final>assignment);assert.ok(final<traced.indexOf('result.unsafeOutstanding=unsafeOutstanding;result.stopInvocation=stopInvocation;return result;'));assert.ok(traced.indexOf('trace.beforeBrowserClose();')>traced.indexOf('const originalDispose=page.evaluate'));});

test('actual publication tail retains stop after trace attention rejection and successful failure reserve',async()=>{
 const start=traced.indexOf(' const traceDiagnostic=');
 const end=traced.indexOf('\n}',start);
 assert.ok(start>0&&end>start);
 const execute=Object.getPrototypeOf(async()=>{}).constructor('ports',`
  const {wait,artifacts,deadline,store,createHash}=ports;
  let traceFailure=null,tracePublicationStop=false,stopInvocation=false,unsafeOutstanding=false;
  const traceSnapshot={},traceStockBuild={},result={},evidence={transcripts:{}},serverOutcome=null;
  const threadplaneBuildEvidence=async()=>({}),assertStock034BuildV1=value=>value;
  const validateAimockTraceV1=()=>({status:'valid',rendererMapping:{status:'available'}});
  const createAimockTraceEvidenceV1=()=>({}),analyzeAimockTraceCostsV1=()=>({status:'available'});
  const STAGES={progress:10000,transcript:10000},LIMITS={caseMs:240000,invocationMs:1200000,cleanupMs:10000};
  const started=performance.now(),invocationStarted=started,slot={id:'pure-publication-control'};
  const MATRIX_V5_ACQUISITION='control',readinessReceiptRef=null;
  const diagnostics={failureRecord:()=>({})},message=error=>String(error.message);
  let failure=null;const fail=error=>{failure??={message:message(error)};};
  ${traced.slice(start,end)}
 `);
 const attempts=[];
 const artifacts={stats:()=>({failed:false}),writeJSON(name){attempts.push(name);return Promise.resolve({path:name});}};
 const result=await execute({
  artifacts,store:{stats:()=>({stopped:false})},
  deadline:{check(){throw Error('case-deadline');}},
  async wait(original,ms,label){await original;if(label==='aimock-trace-write')throw Error('trace-write-deadline');return {};},
  createHash:()=>({update(){return this;},digest(){return 'a'.repeat(64);}}),
 });
 assert.deepEqual(attempts,['aimock-trace-private.json','failure.json']);
 assert.equal(result.traceDiagnostic.failure,'aimock-trace-publication-or-validation-unavailable');
 assert.equal(result.failure.message,'case-deadline');
 assert.equal(result.unsafeOutstanding,false);
 assert.equal(result.stopInvocation,true);
});
