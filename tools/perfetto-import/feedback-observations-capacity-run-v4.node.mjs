import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./feedback-observations-capacity-run-v4.mjs').catch(()=>({}));
const C={schema:'browser-presentation-feedback-observations-capacity-v4',capacityProfile:'whole-graph-packed-result-capacity-v4',wireFormat:'compact-v2',resultFormat:'browser-feedback-packed-result-v1'};
const B={fps:null,exhaustivePopulation:false,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false};
test('V4 primitive boundary refuses before any supplied traps and emits exact closed failure',async()=>{
 assert.equal(typeof api.runBrowserPresentationFeedbackObservationsCapacityV4,'function');let touched=0;
 for(const value of[{},null,undefined,new String('{}'),new Proxy({},{get(){touched++;throw Error();},ownKeys(){touched++;throw Error();}})]){
  assert.deepEqual(await api.runBrowserPresentationFeedbackObservationsCapacityV4(value),{status:'unavailable',stage:'config',reason:'invalid-config',publication:null,observation:{...C,status:'unavailable',executionEvidence:'untrusted-supplied-csv',inputOrigin:'caller-supplied-csv',traceOrigin:'unestablished',clockContract:'supplied-imported-nanoseconds',core:null,evidence:null,count:null,interval:null,observedHz:null,events:[],...B}});
 }
 assert.equal(touched,0);
});
test('original wrapper APIs refuse all forgeries before properties',async()=>{
 let touched=0;const hostile=new Proxy({},{get(){touched++;throw Error();},ownKeys(){touched++;throw Error();}});
 for(const value of[null,{},hostile]){
  assert.throws(()=>api.inspectFeedbackCapacityRunV4(value));
  assert.throws(()=>api.readFeedbackCapacityEventV4(value,0));
  await assert.rejects(()=>api.verifyFeedbackCapacityRunV4(value));
 }
 assert.equal(touched,0);
});

import {mkdtemp,readFile,readdir,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {authoredGraph,selector,argument} from './feedback-observations-fixtures.mjs';
import {exportCompactGraphV2} from './feedback-observations-compact-fixtures-v2.mjs';
import {makePackedFeedbackAuthoredFixtureV1} from './feedback-packed-authored-fixture-v1.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const config=root=>({...C,trace:{path:join(root,'trace'),bytes:2,sha256:hash('{}')},processor:{path:join(root,'processor'),sha256:hash('authored processor')},...JSON.parse(selector),out:join(root,'out'),deadlineMs:1000});
function refused(r){assert.equal(r.status,'unavailable');assert.equal(r.publication,null);assert.equal(r.observation.count,null);assert.equal(r.observation.observedHz,null);assert.equal(r.observation.interval,null);assert.equal(r.observation.evidence,null);assert.deepEqual(r.observation.events,[]);for(const[k,v]of Object.entries(B))assert.equal(r.observation[k],v);}
// Fabricated exporter brands stay exclusively inside a fresh authored copy.
async function authoredHarness(mode='ok',options={}){
 const root=await mkdtemp(join(tmpdir(),'packed-wrapper-authored-')),base=join(root,'source');await mkdir(base);const wrapper=join(base,'feedback-observations-capacity-run-v4.mjs');
 for(const name of['feedback-observations-capacity-source-model-v3.json','feedback-observations-capacity-source-model-v4.json','feedback-observations-capacity-core-v4.mjs','feedback-observations-packed-result-v1.mjs','feedback-target-compact-v2.sql','feedback-scope-compact-v2.sql'])await copyFile(new URL(name,import.meta.url),join(base,name));
 await writeFile(join(root,'trace'),'{}');await writeFile(join(root,'processor'),'authored processor');const c=config(root);
 if(options.longOut){const parent=join(root,'p'.repeat(200));await mkdir(parent);c.out=join(parent,'out');}
 const modelPath=join(base,'feedback-observations-capacity-source-model-v4.json'),model=JSON.parse(await readFile(modelPath));for(const key of Object.keys(model.importer.processorPins))model.importer.processorPins[key]=c.processor.sha256;if(options.model)options.model(model);const modelBytes=JSON.stringify(model,null,2)+'\n';await writeFile(modelPath,modelBytes);
 const fixture=options.presentations?makePackedFeedbackAuthoredFixtureV1({presentations:options.presentations}):null;
 const graph=authoredGraph();if(options.graph)options.graph(graph);
 const encoded=fixture?null:exportCompactGraphV2(graph);const authoredCSV={target:(fixture?fixture.targetCSV:encoded.target.bytes).toString(),scope:(fixture?fixture.scopeCSV:encoded.scope.bytes).toString()};await writeFile(join(root,'authored-csv.json'),JSON.stringify(authoredCSV));
 const exporterPath=join(base,'feedback-observations-capacity-export-v3.mjs');
await writeFile(exporterPath,`
 import fs from 'node:fs/promises';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import{dirname,join}from'node:path';
 const BASE=dirname(fileURLToPath(import.meta.url)),authoredCSV=${authoredCSV?'JSON.parse(await fs.readFile('+JSON.stringify(join(root,'authored-csv.json'))+'))':'null'},mode=${JSON.stringify(mode)},brands=new WeakMap();let verifies=0;export let calls=0;
 export const EXPECTED_VERSION=${JSON.stringify(model.importer.versionText)},PROCESSOR_PINS=${JSON.stringify(model.importer.processorPins)};
 const hash=b=>createHash('sha256').update(b).digest('hex');async function fact(path){const h=await fs.open(path),s=await h.stat({bigint:true}),digest=createHash('sha256'),buffer=Buffer.alloc(65536);let size=0;try{for(;;){const n=(await h.read(buffer,0,buffer.length,size)).bytesRead;if(!n)break;size+=n;digest.update(buffer.subarray(0,n));}}finally{await h.close();}return{path,bytes:size,sha256:digest.digest('hex'),identity:Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]))};}
 async function put(path,bytes){await fs.writeFile(path,bytes);return fact(path);}
 async function run(role,o){if(o.schema!=='browser-presentation-feedback-observations-capacity-v3'||o.capacityProfile!=='whole-graph-capacity-v3'||o.wireFormat!=='compact-v2')throw Error('fixed-export-config');calls++;if(mode==='scope-refusal'&&role==='scope')return{status:'failure'};await fs.mkdir(o.out);const model=JSON.parse(await fs.readFile(join(BASE,'feedback-observations-capacity-source-model-v3.json'))),spec=model.sql[role],source=await fs.readFile(join(BASE,spec.path),'utf8'),sql=Buffer.from(source.replace('__PHASE_LITERALS__',o.phases.map(s=>"'"+s.replaceAll("'","''")+"'").join(', '))),files={};files.sql=await put(join(o.out,'diagnostic.sql'),sql);const before={trace:await fact(o.trace.path),processor:await fact(o.processor.path)},runtime={before:await fact(process.execPath)},sources={exporter:await fact(fileURLToPath(import.meta.url)),modelSource:await fact(join(BASE,'feedback-observations-capacity-source-model-v3.json')),sqlSource:await fact(join(BASE,spec.path)),executedSql:files.sql};const processes={};for(const [name,args]of[['version',['--version']],['query',['query','-f',files.sql.path,o.trace.path]]]){const record={args,code:0,signal:null,closed:true,error:null,exit:{code:mode==='exit-claim'?1:0,signal:null},close:{code:0,signal:null},timedOut:mode==='timeout-claim',elapsedDeadlineExceeded:mode==='elapsed-claim',closeElapsedMs:1,elapsedMs:2,groupAbsent:true,original:{pid:123,ppid:process.pid,pgid:123},streams:{}};for(const stream of['stdout','stderr']){const bytes=Buffer.from(stream==='stderr'?'':name==='version'?EXPECTED_VERSION:mode==='csv-overflow'?Buffer.alloc(2097153,65):authoredCSV?authoredCSV[role]:'authored compact CSV');files[name+'.'+stream]=await put(join(o.out,name+'.'+stream),bytes);record.streams[stream]={eof:true,closed:true,error:null,forcedDestroy:false,bytes:bytes.length,observedBytes:bytes.length,chunks:mode==='chunk-claim'?8193:(bytes.length?1:0),sha256:hash(bytes)};}processes[name]=record;}runtime.after=runtime.before;const manifest={capacityProfile:mode==='mixed-profile'&&role==='scope'?'old-compact-v2':'whole-graph-capacity-v3',wireFormat:mode==='mixed-wire'&&role==='scope'?'expanded-v1':'compact-v2',rawRowsExported:mode==='raw-rows',compactWholeGraph:true,status:'success',authoredFixture:false,officialProcessor:true,platform:process.platform+'-'+process.arch,queryPolicy:role+'-feedback-compact-v2',expectedVersion:EXPECTED_VERSION,observedVersion:EXPECTED_VERSION,expected:{trace:o.trace,processor:o.processor},phases:o.phases,before,after:before,runtime,sourceBookends:{before:sources,after:sources,stable:true},sql:{path:files.sql.path,sha256:files.sql.sha256,sourceSha256:spec.sha256},processes,fps:null,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false};files.manifest=await put(join(o.out,'manifest.json'),JSON.stringify(manifest)+'\\n');const entry={manifest,files};if(mode!=='unbranded')brands.set(manifest,entry);if(mode==='stale-file')await fs.appendFile(files['query.stdout'].path,'changed');return mode==='copied-original'?structuredClone(manifest):manifest;}
 export function runTargetFeedbackCapacityExportV3(o){return run('target',o);}export function runScopeFeedbackCapacityExportV3(o){return run('scope',o);}export function inspectFeedbackCapacityExportV3(original){if(!brands.has(original))throw Error('original-exporter-capability');return brands.get(original);}export async function verifyFeedbackCapacityExportV3(original){if(mode==='late-verifier'&&++verifies>=5)throw Error('late-exporter-custody');return inspectFeedbackCapacityExportV3(original);}
 `);
 let source=await readFile(new URL('./feedback-observations-capacity-run-v4.mjs',import.meta.url),'utf8');
 if(options.exporter)await writeFile(exporterPath,options.exporter(await readFile(exporterPath,'utf8')));
 const exporter=await readFile(exporterPath);source=source.replace("const MODEL_HASH='f15d05b82985895349b04c046a0f4c585919e7bbd2102f80e2d9cdd26a106d00';",`const MODEL_HASH='${hash(modelBytes)}';`).replace('bytes:18202','bytes:'+Buffer.byteLength(modelBytes)).replace('2d202948c18ddcfe5cd24b55802683c8b4f6a2a2814a1c96a331e0be1cbf2fa9',hash(exporter)).replace('bytes:17275','bytes:'+exporter.length);
 if(options.source)source=options.source(source,{root,base});
 await writeFile(wrapper,source);return{root,base,api:await import(pathToFileURL(wrapper).href),config:JSON.stringify(c),exporter:await import(pathToFileURL(exporterPath).href)};
}
test('authored original exporters and genuine V4 core seal exact receipt and queries',async()=>{
 const h=await authoredHarness(),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);
 assert.deepEqual(Object.keys(r),['status','stage','reason','publication','observation']);assert.deepEqual(Object.keys(r.observation),[...Object.keys(C),'status','executionEvidence','inputOrigin','traceOrigin','clockContract','core','evidence',...Object.keys(B)]);
 const bytes=await readFile(r.publication.path);assert.equal(hash(bytes),r.publication.sha256);assert.equal(bytes.length,r.publication.bytes);assert.deepEqual(JSON.parse(bytes),{...C,publicationState:'provisional-snapshot-requires-original-returned-receipt',observation:r.observation});
 assert.deepEqual(Object.keys(r.observation.evidence.sourcesBefore),['wrapper','core','model','codec','originalExporter','inputModel','targetSQL','scopeSQL']);assert.deepEqual(r.observation.evidence.executions.target.originalReturnedManifest.sourceBookends.before.modelSource,r.observation.evidence.sourcesBefore.inputModel);assert.equal(r.observation.evidence.executions.target.originalReturnedManifest.capacityProfile,'whole-graph-capacity-v3');
 const s=h.api.inspectFeedbackCapacityRunV4(r);assert.equal(s.count,'1');assert.equal(s.eventCount,1);assert.deepEqual(s,await h.api.verifyFeedbackCapacityRunV4(r));assert.equal(h.api.readFeedbackCapacityEventV4(r,0).index,0);assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.observation.evidence.runtime.versions));assert.ok(Object.isFrozen(s.publication));
 let touched=0;for(const value of[structuredClone(r),JSON.parse(JSON.stringify(r)),new Proxy(r,{get(){touched++;throw Error();}})]){assert.throws(()=>h.api.inspectFeedbackCapacityRunV4(value));await assert.rejects(()=>h.api.verifyFeedbackCapacityRunV4(value));assert.throws(()=>h.api.readFeedbackCapacityEventV4(value,0));}assert.equal(touched,0);
});
for(const mode of['unbranded','copied-original','stale-file','scope-refusal','late-verifier','timeout-claim','raw-rows','mixed-profile','mixed-wire','elapsed-claim','csv-overflow','exit-claim','chunk-claim'])test('V4 preserves original exporter refusal '+mode,async()=>{const h=await authoredHarness(mode),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);});

for(const [name,change,reason]of[
 ['crossed V4 model',s=>s.replace("modelSource:await fact(join(BASE,'feedback-observations-capacity-source-model-v3.json'))","modelSource:await fact(join(BASE,'feedback-observations-capacity-source-model-v4.json'))"),'exporter-wrapper-source-join'],
 ['missing input model',s=>s.replace("modelSource:await fact(join(BASE,'feedback-observations-capacity-source-model-v3.json')),",''),'exporter-source-membership'],
 ['extra input model',s=>s.replace('sqlSource:await fact','inputModel:{},sqlSource:await fact'),'exporter-source-membership'],
 ['model fact order',s=>s.replace('const processes={};',"sources.modelSource={bytes:sources.modelSource.bytes,path:sources.modelSource.path,sha256:sources.modelSource.sha256,identity:sources.modelSource.identity};const processes={};"),'exporter-wrapper-source-join'],
 ['model fact old bytes',s=>s.replace('const processes={};','sources.modelSource={...sources.modelSource,bytes:15906};const processes={};'),'exporter-wrapper-source-join'],
 ['model fact hash',s=>s.replace('const processes={};',"sources.modelSource={...sources.modelSource,sha256:'0'.repeat(64)};const processes={};"),'exporter-wrapper-source-join'],
 ['asymmetric model after',s=>s.replace('after:sources,stable:true',"after:{...sources,modelSource:{...sources.modelSource,bytes:1}},stable:true"),'exporter-source-runtime-bookends'],
 ['float elapsed retained',s=>s.replace('closeElapsedMs:1,elapsedMs:2','closeElapsedMs:0.125,elapsedMs:0.75'),null],
 ['pipe EOF',s=>s.replace('eof:true','eof:false'),'process-stream-evidence'],
 ['pipe forced destroy',s=>s.replace('forcedDestroy:false','forcedDestroy:true'),'process-stream-evidence'],
 ['original process group',s=>s.replace('groupAbsent:true','groupAbsent:false'),'original-process-closure'],
 ['executed sql file',s=>s.replace("if(mode==='stale-file')", "if(true)"),'file-commitment'],
])test('authored source joins and original process guard: '+name,async()=>{
 const h=await authoredHarness('ok',{exporter:change}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);
 if(reason){refused(r);assert.equal(r.reason,reason);}else{assert.equal(r.status,'observed',r.reason);assert.equal(r.observation.evidence.executions.target.originalReturnedManifest.processes.query.elapsedMs,0.75);}
});
for(const presentations of[120,240,480])test('complete authored '+presentations+' proof includes full runtime/source/execution evidence',async t=>{
 const h=await authoredHarness('ok',{presentations}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);
 if(presentations===480){refused(r);assert.equal(r.reason,'packed-wire-strings');assert.equal(r.observation.core.stage,'limits');assert.equal(r.observation.core.diagnosticsProof,null);return;}
 assert.equal(r.status,'observed',r.reason);
 const s=h.api.inspectFeedbackCapacityRunV4(r);assert.equal(s.count,String(presentations));assert.equal(s.eventCount,presentations);assert.equal(r.observation.evidence.runtime.before.path,process.execPath);assert.equal(Object.keys(r.observation.evidence.sourcesBefore).length,8);assert.ok(r.observation.evidence.executions.scope.files.manifest.bytes>1000);
 t.diagnostic(JSON.stringify({presentations,status:r.status,publicationBytes:r.publication.bytes,completeProvisional:independentWire(JSON.parse(await readFile(r.publication.path))),completeActual:independentWire(r)}));
});
test('canonical V4 config rejects aliases, extra controls and missing result identity before IO',async()=>{
 const root=await mkdtemp(join(tmpdir(),'packed-config-')),c=config(root);
 for(const value of[{...c,resultFormat:undefined},{...c,resultFormat:'compact-v2'},{...c,schema:'browser-presentation-feedback-observations-capacity-v3'},{...c,capacityProfile:'whole-graph-capacity-v3'},{...c,extra:true},{...c,deadlineMs:60001},{...c,trace:{...c.trace,bytes:33554433}},{...c,out:root},{...c,target:{...c.target,frameId:'\ud800'}},{...c,phaseNames:{...c.phaseNames,start:'Graphics.Pipeline'}}]){const r=await api.runBrowserPresentationFeedbackObservationsCapacityV4(JSON.stringify(value));refused(r);assert.equal(r.stage,'config');}assert.deepEqual(await readdir(root),[]);
});

function instrumentNative(source){
 source=source.replace('chargeBrowserFeedbackCapacityWorkV4 }','chargeBrowserFeedbackCapacityWorkV4 as originalCharge }');
 source+='\nexport const authoredNativeLog=[];function chargeBrowserFeedbackCapacityWorkV4(core,units){originalCharge(core,units);authoredNativeLog.push(["charge",units]);}\n';
 for(const [before,after]of[
  ['const text = JSON.stringify(value);','authoredNativeLog.push(["stringify",meter.bytes]); const text = JSON.stringify(value);'],
  ["const bytes = Buffer.byteLength(text, 'utf8');",'authoredNativeLog.push(["byteLength",text.length]); const bytes = Buffer.byteLength(text, \'utf8\');'],
  ["return Buffer.from(text, 'utf8');",'authoredNativeLog.push(["buffer",bytes]); return Buffer.from(text, \'utf8\');'],
  ['const payloadHash = hash(payload);','authoredNativeLog.push(["hash",payload.length]); const payloadHash = hash(payload);'],
  ['const n = (await handle.write(payload, offset, payload.length - offset, offset)).bytesWritten;','authoredNativeLog.push(["write",payload.length-offset]); const n = (await handle.write(payload, offset, payload.length - offset, offset)).bytesWritten;'],
  ['const keys = Reflect.ownKeys(v);','authoredNativeLog.push(["keys"]); const keys = Reflect.ownKeys(v);'],
  ['Object.freeze(v);','authoredNativeLog.push(["freeze",1+keys.length,Array.isArray(v)]); Object.freeze(v);'],
 ]){assert.ok(source.includes(before),before);source=source.replace(before,after);}
 return source;
}
test('every native output pass is prepaid separately; array freeze includes builtin length',async()=>{
 const h=await authoredHarness('ok',{source:instrumentNative}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);
 const logs=h.api.authoredNativeLog;for(const op of['stringify','byteLength','buffer','hash','write','freeze']){const entries=logs.filter(x=>x[0]===op);assert.ok(entries.length>0,op);for(let i=0;i<logs.length;i++)if(logs[i][0]===op)assert.deepEqual(logs[i-1],['charge',logs[i][1]],op);}
 assert.ok(logs.some(x=>x[0]==='freeze'&&x[2]&&x[1]>=2));
});
for(const [name,marker,late]of[
 ['enumeration','pay(meter.nodes);',false],
 ['stringify','chargeBrowserFeedbackCapacityWorkV4(core, meter.bytes);',false],
 ['UTF16 measurement','chargeBrowserFeedbackCapacityWorkV4(core, text.length);',false],
 ['UTF8 allocation','chargeBrowserFeedbackCapacityWorkV4(core, bytes);',false],
 ['payload hash','chargeBrowserFeedbackCapacityWorkV4(result, payload.length);',false],
 ['payload write','check(); chargeBrowserFeedbackCapacityWorkV4(result, payload.length - offset);',true],
 ['complete actual return meter','prepare(result, returned);',true],
 ['final positive guard','check(); chargeBrowserFeedbackCapacityWorkV4(result, 1);',true],
])test('sticky genuine-account exhaustion before '+name+' with '+(late?'retained':'no')+' provisional file',async()=>{
 const source=s=>{assert.ok(s.includes(marker));const token=marker.includes('core,')||marker==='pay(meter.nodes);'?'core':'result';return s.replace(marker,`chargeBrowserFeedbackCapacityWorkV4(${token},67108864);\n${marker}`);};
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'core');assert.equal(r.reason,'logical-work-limit');assert.equal((await readdir(join(h.root,'out'))).includes('result.json'),late);assert.throws(()=>h.api.inspectFeedbackCapacityRunV4(r));
});
test('partial payload writes pay each requested length again before retry',async()=>{
 const source=s=>instrumentNative(s).replace('await handle.write(payload, offset, payload.length - offset, offset)','await handle.write(payload, offset, Math.min(1024,payload.length - offset), offset)');
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);
 const writes=h.api.authoredNativeLog.filter(x=>x[0]==='write');assert.ok(writes.length>2);assert.equal(writes[0][1],r.publication.bytes);for(let i=1;i<writes.length;i++)assert.equal(writes[i][1],writes[i-1][1]-1024);
});
test('write retry depletion leaves owned provisional artifact and no receipt',async()=>{
 const source=s=>s.replace('let offset = 0;','let offset = 0;let authoredWrites=0;').replace('const n = (await handle.write(payload, offset, payload.length - offset, offset)).bytesWritten;',"if(++authoredWrites===2)chargeBrowserFeedbackCapacityWorkV4(result,67108864);const n = (await handle.write(payload, offset, Math.min(1,payload.length - offset), offset)).bytesWritten;");
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.reason,'logical-work-limit');assert.equal((await readFile(join(h.root,'out','result.json'))).length,1);
});
test('inspect, event and verification retain the original deadline without restarting it',async()=>{
 const source=s=>'let authoredTime=0;export function authoredExpire(){authoredTime=240001;}\n'+s.replaceAll('performance.now()','authoredTime');
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);h.api.authoredExpire();assert.throws(()=>h.api.inspectFeedbackCapacityRunV4(r),/elapsed-budget-exceeded/);assert.throws(()=>h.api.readFeedbackCapacityEventV4(r,0),/elapsed-budget-exceeded/);await assert.rejects(()=>h.api.verifyFeedbackCapacityRunV4(r),/elapsed-budget-exceeded/);
});
for(const marker of['await handle.close(); check();','await publicationCustody();','await custody();'])test('late deadline '+marker+' retains failed file and withdraws metrics',async()=>{
 const source=s=>'let authoredTime=0;\n'+s.replaceAll('performance.now()','authoredTime').replace(marker,marker+'authoredTime=240001;check();');
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.ok((await readdir(join(h.root,'out'))).includes('result.json'));
});
for(const file of['trace','processor','source/feedback-observations-capacity-source-model-v3.json','source/feedback-observations-capacity-source-model-v4.json','source/feedback-observations-packed-result-v1.mjs','out/target/query.stdout','out/result.json'])test('original verification rechecks '+file,async()=>{
 const h=await authoredHarness(),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);await writeFile(join(h.root,file),'authored replacement');await assert.rejects(()=>h.api.verifyFeedbackCapacityRunV4(r));
});
test('repeated original summary/event/verification consumes one sticky account',async()=>{
 const h=await authoredHarness(),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);
 const core=await import(pathToFileURL(join(h.base,'feedback-observations-capacity-core-v4.mjs')).href);
 h.api.inspectFeedbackCapacityRunV4(r);h.api.readFeedbackCapacityEventV4(r,0);await h.api.verifyFeedbackCapacityRunV4(r);
 assert.throws(()=>core.chargeBrowserFeedbackCapacityWorkV4(r.observation.core,67108864),/logical-work-limit/);
 assert.throws(()=>h.api.inspectFeedbackCapacityRunV4(r),/logical-work-limit/);assert.throws(()=>h.api.readFeedbackCapacityEventV4(r,0),/logical-work-limit/);await assert.rejects(()=>h.api.verifyFeedbackCapacityRunV4(r),/logical-work-limit/);
});

// Independent occurrence census for trusted authored JSON. Array indices count
// as wire keys; null/boolean and punctuation retain the conservative V3 bound.
function independentWire(value){
 const m={bytes:0,nodes:0,stringBytes:0},stack=[value];while(stack.length){const v=stack.pop();m.nodes++;
 if(v===null||typeof v==='boolean')m.bytes+=5;
 else if(typeof v==='number')m.bytes+=String(v).length;
 else if(typeof v==='string'){m.bytes+=Buffer.byteLength(JSON.stringify(v));m.stringBytes+=Buffer.byteLength(v);}
 else{const entries=Object.entries(v),array=Array.isArray(v);m.nodes+=entries.length;m.bytes+=2+3*(entries.length+(array?1:0));for(const[k,child]of entries){m.bytes+=Buffer.byteLength(JSON.stringify(k));m.stringBytes+=Buffer.byteLength(k);stack.push(child);}}
 }return m;
}
test('independent meter covers complete provisional and actual DTO with original FileFact',async t=>{
 const h=await authoredHarness(),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);const provisional=JSON.parse(await readFile(r.publication.path));
 const core=await import(pathToFileURL(join(h.base,'feedback-observations-capacity-core-v4.mjs')).href);
 for(const value of[provisional,r]){const expected=independentWire(value);assert.deepEqual(core.meterBrowserFeedbackCapacityCompositionV4(r.observation.core,value),expected);assert.ok(Buffer.byteLength(JSON.stringify(value))<=expected.bytes);assert.ok(expected.bytes<=1048576&&expected.nodes<=65536&&expected.stringBytes<=524288);}
 const before=independentWire(provisional),after=independentWire(r);t.diagnostic(JSON.stringify({completeProvisional:before,completeActual:after,actualFileFact:r.publication}));
});

test('complete actual receipt addition crosses unchanged wire nodes cap after admitted provisional',async t=>{
 const pilot=await authoredHarness(),pr=await pilot.api.runBrowserPresentationFeedbackObservationsCapacityV4(pilot.config);assert.equal(pr.status,'observed',pr.reason);const base=independentWire(JSON.parse(await readFile(pr.publication.path))),n=Math.floor((65536-base.nodes-4)/4);
 // Authored exporter source adds bounded ordinary manifest metadata. This is a
 // composition boundary vector, not a claim the frozen exporter emits this pad.
 const h=await authoredHarness('ok',{exporter:s=>s.replace('const manifest={',`const manifest={authoredPadding:Array(${n}).fill(null),`)}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'publication');assert.equal(r.reason,'packed-wire-nodes');
 const provisional=JSON.parse(await readFile(join(h.root,'out','result.json'))),before=independentWire(provisional);assert.ok(before.nodes<=65536);assert.ok(before.nodes+4>65536);t.diagnostic(JSON.stringify({qualifiedAuthoredMetadata:true,provisional:before,actualNodes:before.nodes+4}));
});
test('complete actual receipt FileFact crosses unchanged string cap after admitted provisional',async t=>{
 const pilot=await authoredHarness('ok',{longOut:true}),pr=await pilot.api.runBrowserPresentationFeedbackObservationsCapacityV4(pilot.config);assert.equal(pr.status,'observed',pr.reason);const base=independentWire(JSON.parse(await readFile(pr.publication.path))),delta=independentWire(pr).stringBytes-base.stringBytes,n=Math.floor((524288-base.stringBytes-64)/2);assert.ok(delta>0);
 const h=await authoredHarness('ok',{longOut:true,exporter:s=>s.replace('observedVersion:EXPECTED_VERSION,',`observedVersion:EXPECTED_VERSION+' '.repeat(${n}),`)}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.reason,'packed-wire-strings');assert.equal(r.stage,'publication');
 const c=JSON.parse(h.config),provisional=JSON.parse(await readFile(join(c.out,'result.json'))),before=independentWire(provisional);assert.ok(before.stringBytes<=524288);assert.ok(before.stringBytes+delta>524288);t.diagnostic(JSON.stringify({qualifiedAuthoredVersionPadding:true,provisional:before,actualStringDelta:delta}));
});

test('exhausted unavailable core becomes fixed code-only bounded failure without touching diagnostics',async()=>{
 const source=s=>{
  s=s.replace('const result = evaluateBrowserFeedbackObservationsCapacityV4(', 'const authoredCore = evaluateBrowserFeedbackObservationsCapacityV4(');
  const at='const bookends = async () => {';
  return s.replace(at,`let exhausted=false;try{chargeBrowserFeedbackCapacityWorkV4(authoredCore,67108864);}catch{exhausted=true;}ensure(exhausted,'authored-exhaustion');const result={...C,status:'unavailable',stage:'limits',reason:'logical-work-limit',proof:null,get diagnosticsProof(){authoredDiagnosticTouches++;throw Error('unused-diagnostics');},count:null,interval:null,observedHz:null,events:[],...B};\n${at}`)+'\nexport let authoredDiagnosticTouches=0;';
 };
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'core');assert.equal(r.reason,'logical-work-limit');assert.equal(h.api.authoredDiagnosticTouches,0);
 assert.equal(Object.getOwnPropertyDescriptor(r.observation.core,'diagnosticsProof').value,null);
 assert.deepEqual(r.observation.core,{...C,status:'unavailable',stage:'limits',reason:'logical-work-limit',proof:null,diagnosticsProof:null,count:null,interval:null,observedHz:null,events:[],...B});
 const counters=independentWire(r);assert.ok(counters.bytes<4096&&counters.nodes<256&&counters.stringBytes<2048);
});

test('complete original FileFact crosses unchanged byte cap for genuine control-string proof',async t=>{
 const source=s=>s.replace('const meter = prepare(result, provisional);','authoredProvisional=provisional;const meter = prepare(result, provisional);').replace('prepare(result, returned);','authoredReturned=returned;prepare(result, returned);')+'\nexport let authoredProvisional,authoredReturned;';
 const graph=total=>g=>{const n=g.nodes.find(x=>x.name==='PipelineReporter');for(let i=0;i<24;i++){const chars=Math.floor(total/24)+(i<total%24?1:0);n.args.push(argument('authored_control_'+i,'string',String(i)+'\u0001'.repeat(chars)));}for(let i=0;i<12000;i++)n.args.push(argument('authored_repeated_int','int','123456789012345678'));};
 const pilot=await authoredHarness('ok',{longOut:true,source,graph:graph(120000)}),pr=await pilot.api.runBrowserPresentationFeedbackObservationsCapacityV4(pilot.config);assert.ok(pilot.api.authoredProvisional,pr.reason);
 const initial=independentWire(pilot.api.authoredProvisional),total=120000-Math.ceil((initial.bytes-1048576+80)/6);
 const h=await authoredHarness('ok',{longOut:true,source,graph:graph(total)}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'publication');assert.equal(r.reason,'packed-wire-bytes');
 const before=independentWire(h.api.authoredProvisional),after=independentWire(h.api.authoredReturned);assert.ok(before.bytes<=1048576);assert.ok(after.bytes>1048576);assert.ok(before.nodes<65536&&after.nodes<65536&&before.stringBytes<524288&&after.stringBytes<524288);assert.ok(await readFile(join(JSON.parse(h.config).out,'result.json')));t.diagnostic(JSON.stringify({genuineProofControlCharacters:total,completeProvisional:before,completeActual:after}));
});

for(const [name,change]of[
 ['missing',m=>delete m.inputAcquisitionModel],['extra',m=>m.inputAcquisitionModel.extra=true],['old bytes',m=>m.inputAcquisitionModel.bytes=15906],['old SHA',m=>m.inputAcquisitionModel.sha256='0'.repeat(64)],['new model path',m=>m.inputAcquisitionModel.path='feedback-observations-capacity-source-model-v4.json'],['reordered',m=>{const x=m.inputAcquisitionModel;m.inputAcquisitionModel={bytes:x.bytes,path:x.path,sha256:x.sha256,schema:x.schema,capacityProfile:x.capacityProfile,wireFormat:x.wireFormat};}],
])test('literal V3 acquisition metadata refuses '+name,async()=>{const h=await authoredHarness('ok',{model:change}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'source');assert.equal(r.reason,'source-input-model');assert.equal(h.exporter.calls,0);});
for(const [name,change]of[
 ['logical policy',m=>m.logicalResultLimits.nodes++],['representation policy',m=>m.resultRepresentation.envelope.reverse()],['result identity',m=>m.resultFormat='compact-v2'],
])test('V4 result model refuses '+name,async()=>{const h=await authoredHarness('ok',{model:change}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.stage,'source');assert.equal(h.exporter.calls,0);});
for(const [name,extra]of[['wrapper',262145],['targetSQL',16385],['scopeSQL',16385]])test('source cap applies before reading '+name,async()=>{
 const h=await authoredHarness('ok',{source:name==='wrapper'?s=>s+'\n/*'+'x'.repeat(extra)+'*/':undefined});if(name!=='wrapper')await writeFile(join(h.base,name==='targetSQL'?'feedback-target-compact-v2.sql':'feedback-scope-compact-v2.sql'),'x'.repeat(extra));const r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(h.exporter.calls,0);assert.equal(r.reason,'file-custody');
});
test('all eight roles count in bounded closure total; pinned roles make total overflow unreachable',async t=>{
 const h=await authoredHarness(),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);assert.equal(r.status,'observed',r.reason);const roles=r.observation.evidence.sourcesBefore;let total=0;for(const[k,f]of Object.entries(roles)){total+=f.bytes;assert.ok(f.bytes<=(k.endsWith('SQL')?16384:262144));}assert.equal(Object.keys(roles).length,8);assert.ok(total<=1048576);
 // With seven literal immutable dependencies, only wrapper can grow. The real
 // profile cannot reach total cap without first breaking a source pin/cap.
 const pinnedTotal=54402+18202+23405+17275+15907+9542+10477;assert.ok(pinnedTotal+262144<1048576);t.diagnostic(JSON.stringify({actualEightRoleBytes:total,maximumUnderLiteralPins:pinnedTotal+262144,totalCap:1048576}));
});
test('exclusive publication refuses without overwriting caller-owned file',async()=>{
 const exporter=s=>s.replace('runtime.after=runtime.before;',"if(role==='scope')await fs.writeFile(join(dirname(o.out),'result.json'),'caller-owned');runtime.after=runtime.before;");
 const h=await authoredHarness('ok',{exporter}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal((await readFile(join(h.root,'out','result.json'),'utf8')),'caller-owned');
});
test('post-meter full failure skeleton remains bounded with worst fixed ASCII code widths',async()=>{
 const source=s=>s.replace('const result = evaluateBrowserFeedbackObservationsCapacityV4(', 'const authoredCore = evaluateBrowserFeedbackObservationsCapacityV4(').replace('const bookends = async () => {',"const result={...C,status:'unavailable',stage:'a'.repeat(96),reason:'a'.repeat(96),diagnosticsProof:{strings:['x'.repeat(524000)],shapes:[],body:'z'}};const bookends = async () => {");
 const h=await authoredHarness('ok',{source}),r=await h.api.runBrowserPresentationFeedbackObservationsCapacityV4(h.config);refused(r);assert.equal(r.observation.core.diagnosticsProof,null);assert.equal(r.observation.core.stage.length,96);assert.equal(r.observation.core.reason.length,96);const m=independentWire(r);assert.ok(m.bytes<4096&&m.nodes<256&&m.stringBytes<2048);
});

test('snapshot/process/SQL/input/exporter guards remain frozen except approved model join',async()=>{
 const old=await readFile(new URL('./feedback-observations-capacity-run-v3.mjs',import.meta.url),'utf8'),current=await readFile(new URL('./feedback-observations-capacity-run-v4.mjs',import.meta.url),'utf8');
 const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
 assert.equal(section(current,'async function snapshot','// Only trusted'),section(old,'async function snapshot','function boundedJSON'));
 assert.equal(section(current,'function validateProcess','async function admit'),section(old,'function validateProcess','async function admit'));
 assert.equal(section(current,'async function admit','async function recheckFiles'),section(old,'async function admit','async function recheckFiles').replace("['modelSource',sources.model]","['modelSource',sources.inputModel]"));
 assert.equal(section(current,'async function recheckFiles','// Production composition'),section(old,'async function recheckFiles','// Production composition'));
 assert.doesNotMatch(current,/createPackedResultAccount|validatePackedResult|readPackedFeedback|\b(?:setTimeout|unlink)\s*\(|evaluateBrowserFeedbackObservationsCapacityV3/);
});
test('production closure pins exact reviewed new dependency and frozen acquisition bytes',async()=>{
 const pins=[['feedback-observations-capacity-core-v4.mjs',54402,'60c0c879ff77eafb867fc745478ec2bd3ddb8652f42bacd9b2303ec9dd54e669'],['feedback-observations-capacity-source-model-v4.json',18202,'f15d05b82985895349b04c046a0f4c585919e7bbd2102f80e2d9cdd26a106d00'],['feedback-observations-packed-result-v1.mjs',23405,'04cc81394cd535909ad245425f59eb82e8c1c7a8c2a9cc47e4c6bf5b18eeedbe'],['feedback-observations-capacity-export-v3.mjs',17275,'2d202948c18ddcfe5cd24b55802683c8b4f6a2a2814a1c96a331e0be1cbf2fa9'],['feedback-observations-capacity-source-model-v3.json',15907,'02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca'],['feedback-target-compact-v2.sql',9542,'ddec24b51eca013800a209acaa6f544c9cc4acfc6e9354a7353f246efc11e27a'],['feedback-scope-compact-v2.sql',10477,'cdb643939620ed2e8985ee48eb95d1d6397caf349dfb632ae728f1eee992c10d']];
 const source=await readFile(new URL('./feedback-observations-capacity-run-v4.mjs',import.meta.url),'utf8');for(const[name,bytes,sha]of pins){const b=await readFile(new URL(name,import.meta.url));assert.equal(b.length,bytes);assert.equal(hash(b),sha);assert.ok(source.includes(sha));}
});
