// Official pinned processor and maintained authored bytes only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
import {authoredUint64CoverageProtobufV3,AUTHORED_UINT64_BOUNDARIES} from './presentation-coverage-fixtures-v3.mjs';
import {parsePresentationCoverageCSVV2,inspectPresentationCoverageWireV2,createPresentationCoverageAccountV2} from './presentation-coverage-wire-v2.mjs';
import model from './presentation-coverage-source-model-v2.json' with {type:'json'};
import {EXPORT_CONTRACT,PROCESSOR_PINS,runPresentationCoverageDiagnosticV3,inspectPresentationCoverageRunV3,verifyPresentationCoverageRunV3} from './presentation-coverage-run-v3.mjs';
import {inspectPresentationCoverageRunV2} from './presentation-coverage-run-v2.mjs';
const SELF=fileURLToPath(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
const tables=bytes=>inspectPresentationCoverageWireV2(parsePresentationCoverageCSVV2(bytes,createPresentationCoverageAccountV2())).tables;
const boundaryValues=rows=>rows.filter(x=>x.key?.startsWith('debug.boundary-uint-')).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(x=>x.int_value);
async function differential(processor,out,withUint){
 const old=await fs.readFile(new URL('./presentation-coverage-v2.sql',import.meta.url),'utf8'),next=await fs.readFile(new URL('./presentation-coverage-v3.sql',import.meta.url),'utf8');
 const render=(s,p)=>s.replaceAll('_pc_',p).replace('__PHASE_VALUES__',"('start'),('end')");
 const query=Buffer.from(render(old,'_pc_old_')+'\n'+render(next,'_pc_new_'));assert.ok(query.length<=32768);
 const stem=withUint?'uint':'rich',sql=join(out,stem+'-differential.sql'),trace=join(out,stem+'-differential.pftrace');
 await fs.writeFile(sql,query,{flag:'wx',mode:0o600});await fs.writeFile(trace,withUint?await authoredUint64CoverageProtobufV3():await authoredCoverageProtobufV1(),{flag:'wx',mode:0o600});
 const source=await fs.readFile(new URL('./presentation-coverage-run-v3.mjs',import.meta.url),'utf8'),pidLine=source.split('\n').find(s=>s.startsWith('function originalPid(')),captureLine=source.split('\n').find(s=>s.startsWith('async function capture('));assert.ok(pidLine&&captureLine);
 const capture=Function('cp','same','bad','hash','dirname',pidLine+'\n'+captureLine+';return capture;')(cp,(a,b)=>JSON.stringify(a)===JSON.stringify(b),()=>Error('authored-process-unavailable'),hash,dirname);
 const start=performance.now(),clock={check(){assert.ok(performance.now()-start<240000);},onAbort(){return()=>{};},remaining(){return Math.max(1,240000-(performance.now()-start));}};
 const observed=await capture(processor,['query','-f',sql,trace],60000,clock,2097152);
 await fs.writeFile(join(out,stem+'-differential-process.json'),JSON.stringify(observed.record)+'\n',{flag:'wx',mode:0o600});assert.equal(observed.record.error,null,JSON.stringify(observed.record));assert.equal(observed.record.groupAbsent,true);
 const raw=observed.stdout;await fs.writeFile(join(out,stem+'-differential.stdout'),raw,{flag:'wx',mode:0o600});
 const first=raw.subarray(0,raw.indexOf(10)+1),split=raw.indexOf(first,first.length);assert.ok(split>0);assert.equal(raw.indexOf(first,split+first.length),-1);assert.equal(raw[split-1],10);assert.equal(raw[split-2],10);
 // Exactly one CLI statement-group separator LF; no value/stat normalization.
 const baseline=raw.subarray(0,split-1),exported=raw.subarray(split),a=structuredClone(tables(baseline)),b=tables(exported);assert.equal(a.length,13);assert.equal(b.length,13);
 for(const [bytes,t]of [[baseline,a],[exported,b]]){const bounds=t[12][0],ending=Buffer.from('"start_ts","end_ts"\n'+bounds.start_ts+','+bounds.end_ts+'\n');assert.ok(bytes.subarray(-ending.length).equals(ending));}
 let changed=0;
 if(withUint){
  for(const ti of [4,8]){
   for(const row of a[ti])if(row.value_type==='uint'&&row.int_value!==null){const n=BigInt(row.int_value);if(n<0n){row.int_value=String(n+(1n<<64n));changed++;}}
   a[ti].sort((x,y)=>{for(const key of model.fieldPolicies.rowOrder[ti]){const av=x[key],bv=y[key];if(av===bv)continue;if(av===null)return-1;if(bv===null)return 1;return BigInt(av)<BigInt(bv)?-1:1;}return 0;});
  }
  assert.equal(changed,4);assert.ok(isDeepStrictEqual(a,structuredClone(b)),'only declared typed uint cell normalization and its numeric ordering may differ');
  assert.deepEqual(boundaryValues(b[4]),AUTHORED_UINT64_BOUNDARIES);
 }else assert.ok(baseline.equals(exported),'no-high-bit-uint fixture retains all13 exact CSV tables');
 const report={sameOriginalProcess:true,authoredOnly:true,withUint,changedTypedUintCells:changed,allThirteenTablesCompared:true,exactCSV:!withUint,rows:b.map(t=>t.length),cliStatementSeparatorLF:1,FPS:null};
 await fs.writeFile(join(out,stem+'-differential.json'),JSON.stringify(report)+'\n',{flag:'wx',mode:0o600});return report;
}
export async function runPresentationCoverageSmokeV3({processor,out}){
 assert.ok(isAbsolute(processor)&&resolve(processor)===processor);assert.ok(isAbsolute(out)&&resolve(out)===out);assert.equal(await fs.realpath(dirname(out)),dirname(out));
 const processorHash=hash(await fs.readFile(processor));assert.equal(processorHash,PROCESSOR_PINS[process.platform+'-'+process.arch]);await fs.mkdir(out,{mode:0o700});
 const differentials=[await differential(processor,out,false),await differential(processor,out,true)];
 const bytes=await authoredUint64CoverageProtobufV3(true),trace=join(out,'new-authored-dense-uint.pftrace');await fs.writeFile(trace,bytes,{flag:'wx',mode:0o600});
 const original=await runPresentationCoverageDiagnosticV3(JSON.stringify({schema:'browser-presentation-coverage-inventory-run-v3',policy:'whole-selected-presentation-coverage-v2',exportPolicy:EXPORT_CONTRACT.exportPolicy,trace:{path:trace,bytes:bytes.length,sha256:hash(bytes)},processor:{path:processor,sha256:processorHash},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:join(out,'inventory'),deadlineMs:60000}));
 assert.equal(original.status,'diagnostic',original.reason);assert.equal(original.executionEvidence,'source-owned-official-import');assert.equal(original.exportPolicy,EXPORT_CONTRACT.exportPolicy);assert.equal(original.diagnostic.schema,EXPORT_CONTRACT.inventorySchema);assert.equal(original.diagnostic.policy,EXPORT_CONTRACT.inventoryPolicy);
 const summary=inspectPresentationCoverageRunV3(original);assert.equal(summary.exportPolicy,EXPORT_CONTRACT.exportPolicy);assert.deepEqual(await verifyPresentationCoverageRunV3(original),summary);
 const graph=tables(await fs.readFile(original.graphProof.path));assert.deepEqual(boundaryValues(graph[4]),AUTHORED_UINT64_BOUNDARIES);
 const dense=original.diagnostic.trackers.find(t=>t.nestedSliceIds.length>=12000);assert.ok(dense);assert.equal(dense.counters.filter(c=>c.field==='expected').length,12000);assert.ok(original.publication.bytes>262144&&original.publication.bytes<=4194304);assert.ok(original.graphProof.bytes<=8388608);assert.ok(Object.values(original.authorities).every(x=>x===false||x===null));
 assert.throws(()=>inspectPresentationCoverageRunV2(original));for(const copy of [{...original},JSON.parse(JSON.stringify(original)),null])assert.throws(()=>inspectPresentationCoverageRunV3(copy));
 const manifest=JSON.parse(await fs.readFile(original.processManifest.path));assert.equal(manifest.exportPolicy,EXPORT_CONTRACT.exportPolicy);assert.equal(manifest.policy,EXPORT_CONTRACT.inventoryPolicy);assert.equal(manifest.officialProcessor,true);assert.equal(manifest.authoredExecutable,false);
 for(const p of Object.values(manifest.processes)){assert.equal(p.closed,true);assert.equal(p.groupAbsent,true);assert.deepEqual(p.exit,{code:0,signal:null});assert.deepEqual(p.close,{code:0,signal:null});for(const s of Object.values(p.streams)){assert.equal(s.eof,true);assert.equal(s.closed,true);assert.equal(s.forcedDestroy,false);}}
 assert.deepEqual(await verifyPresentationCoverageRunV3(original),summary);
 const result={schema:'presentation-coverage-official-authored-smoke-v3',status:'success',authoredInput:true,exportPolicy:original.exportPolicy,inventoryPolicy:original.policy,originalBrandVerified:true,finalVerifyPassed:true,differentials,selectedSlices:original.diagnostic.selectedGraph.slices,denseCounters:dense.counters.length,csvBytes:original.graphProof.bytes,resultBytes:original.publication.bytes,manifestBytes:original.processManifest.bytes,nativeSupported:false,FPS:null};
 const raw=await fs.readFile(original.graphProof.path);await fs.appendFile(original.graphProof.path,'\n');await assert.rejects(verifyPresentationCoverageRunV3(original));assert.throws(()=>inspectPresentationCoverageRunV3(original));await fs.writeFile(original.graphProof.path,raw);await assert.rejects(verifyPresentationCoverageRunV3(original));result.ownOutputMutationRefused=true;
 await fs.writeFile(join(out,'smoke.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--processor'||args[2]!=='--out')throw Error('usage: --processor /absolute/pinned-tool --out /absolute/fresh-authored-output');try{process.stdout.write(JSON.stringify(await runPresentationCoverageSmokeV3({processor:args[1],out:args[3]}))+'\n');}catch(error){process.stderr.write(String(error?.message??'authored smoke unavailable')+'\n');process.exitCode=1;}}
