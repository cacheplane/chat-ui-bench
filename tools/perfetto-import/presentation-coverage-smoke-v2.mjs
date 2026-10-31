// Official pinned processor, maintained authored stress protobuf only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import cp from 'node:child_process';
import {authoredDenseCoverageProtobufV2} from './presentation-coverage-fixtures-v2.mjs';
import {authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
import {createPresentationCoverageAccountV2,parsePresentationCoverageCSVV2,inspectPresentationCoverageWireV2} from './presentation-coverage-wire-v2.mjs';
import {runPresentationCoverageDiagnosticV2,inspectPresentationCoverageRunV2,verifyPresentationCoverageRunV2,PROCESSOR_PINS} from './presentation-coverage-run-v2.mjs';
import {inspectPresentationCoverageRunV1} from './presentation-coverage-run-v1.mjs';
const SELF=fileURLToPath(import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function verifySQLDifferential(processor,out){
 const old=await fs.readFile(new URL('./presentation-coverage-v1.sql',import.meta.url),'utf8'),next=await fs.readFile(new URL('./presentation-coverage-v2.sql',import.meta.url),'utf8');
 assert.equal(next,old.replace('CREATE PERFETTO VIEW _pc_selected AS','CREATE PERFETTO TABLE _pc_selected AS').replace('CREATE PERFETTO VIEW _pc_context AS','CREATE PERFETTO TABLE _pc_context AS'));
 const render=(sql,prefix)=>sql.replaceAll('_pc_',prefix).replace('__PHASE_VALUES__',"('start'),('end')");
 // Both relational forms execute in ONE pinned processor on the same imported
 // rich fixture, including duplicate args and parent-track/context closure.
 const sql=Buffer.from(render(old,'_pc_baseline_')+'\n'+render(next,'_pc_capacity_'));assert.ok(sql.length<=65536);
 const sqlPath=join(out,'authored-same-process-differential.sql'),trace=join(out,'authored-rich-differential.pftrace');await fs.writeFile(sqlPath,sql,{flag:'wx',mode:0o600});await fs.writeFile(trace,await authoredCoverageProtobufV1(),{flag:'wx',mode:0o600});
 const source=await fs.readFile(new URL('./presentation-coverage-run-v2.mjs',import.meta.url),'utf8');
 const pidLine=source.split('\n').find(line=>line.startsWith('function originalPid(')),captureLine=source.split('\n').find(line=>line.startsWith('async function capture('));assert.ok(pidLine&&captureLine);
 // Exact maintained original-process observer. No alternate shell/query policy
 // is introduced into the production API; this is an authored SQL control.
 const capture=Function('cp','same','bad','hash','dirname',pidLine+'\n'+captureLine+';return capture;')(cp,(a,b)=>JSON.stringify(a)===JSON.stringify(b),()=>Error('authored-process-unavailable'),hash,dirname);
 const start=performance.now(),clock={check(){assert.ok(performance.now()-start<240000);},onAbort(){return()=>{};},remaining(){return Math.max(1,240000-(performance.now()-start));}};
 const observed=await capture(processor,['query','-f',sqlPath,trace],60000,clock,2097152);
 await fs.writeFile(join(out,'differential-process.json'),JSON.stringify(observed.record),{flag:'wx',mode:0o600});assert.equal(observed.record.error,null,JSON.stringify(observed.record));assert.equal(observed.record.groupAbsent,true);
 const raw=observed.stdout;assert.ok(raw.length>0);await fs.writeFile(join(out,'differential.stdout'),raw,{flag:'wx',mode:0o600});const first=raw.subarray(0,raw.indexOf(10)+1),split=raw.indexOf(first,first.length);assert.ok(split>0);assert.equal(raw.indexOf(first,split+first.length),-1);
 // The CLI separates successive result groups with an empty line, but does
 // not append that separator after its final group. Remove exactly this one
 // known separator byte, preserving every CSV cell/header/newline and stat.
 assert.equal(raw[split-1],10);assert.equal(raw[split-2],10);
 const baseline=raw.subarray(0,split-1),optimized=raw.subarray(split);assert.ok(baseline.equals(optimized),'all thirteen tables must match exact CSV bytes, including stats');
 const parse=bytes=>inspectPresentationCoverageWireV2(parsePresentationCoverageCSVV2(bytes,createPresentationCoverageAccountV2())).tables;
 const baselineTables=parse(baseline),tables=parse(optimized);assert.equal(baselineTables.length,13);assert.equal(tables.length,13);assert.deepEqual(tables.map(t=>t.length),[76,18,8,6,21,3,6,6,24,1,1,3,1]);
 const bounds=baselineTables[12][0],ending=Buffer.from('"start_ts","end_ts"\n'+bounds.start_ts+','+bounds.end_ts+'\n');assert.ok(baseline.subarray(-ending.length).equals(ending));assert.ok(optimized.subarray(-ending.length).equals(ending));assert.ok(raw.subarray(split,split+first.length).equals(first));
 const result={authoredInput:true,sameOriginalProcess:true,allThirteenTablesExactCSV:true,baselineRawGroupBytes:split,optimizedGroupBytes:optimized.length,cliStatementSeparatorLF:1,rows:tables.map(t=>t.length),bytes:optimized.length,sha256:hash(optimized),nativeSupported:false,fps:null};await fs.writeFile(join(out,'sql-differential.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});return result;
}
export async function runPresentationCoverageSmokeV2({processor,out}){
 assert.ok(isAbsolute(processor)&&resolve(processor)===processor);assert.ok(isAbsolute(out)&&resolve(out)===out);assert.equal(await fs.realpath(dirname(out)),dirname(out));
 const processorHash=hash(await fs.readFile(processor));assert.equal(processorHash,PROCESSOR_PINS[process.platform+'-'+process.arch]);
 await fs.mkdir(out,{mode:0o700});const differential=await verifySQLDifferential(processor,out);const bytes=await authoredDenseCoverageProtobufV2(12000),trace=join(out,'new-authored-dense-coverage.pftrace');await fs.writeFile(trace,bytes,{flag:'wx',mode:0o600});
 const original=await runPresentationCoverageDiagnosticV2(JSON.stringify({schema:'browser-presentation-coverage-inventory-run-v2',policy:'whole-selected-presentation-coverage-v2',trace:{path:trace,bytes:bytes.length,sha256:hash(bytes)},processor:{path:processor,sha256:processorHash},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:join(out,'inventory'),deadlineMs:60000}));
 assert.equal(original.status,'diagnostic',original.reason);assert.equal(original.executionEvidence,'source-owned-official-import');
 const summary=inspectPresentationCoverageRunV2(original);assert.deepEqual(await verifyPresentationCoverageRunV2(original),summary);
 assert.ok(original.diagnostic.selectedGraph.slices>=12000);assert.equal(original.diagnostic.trackers.length,2);
 const dense=original.diagnostic.trackers.find(t=>t.nestedSliceIds.length>=12000);assert.ok(dense);assert.equal(dense.counters.filter(c=>c.field==='expected').length,12000);
 assert.ok(original.publication.bytes>262144);assert.ok(original.publication.bytes<=4194304);assert.ok(original.graphProof.bytes<=8388608);assert.ok(Object.values(original.authorities).every(x=>x===false||x===null));
 assert.throws(()=>inspectPresentationCoverageRunV1(original));for(const copy of [{...original},JSON.parse(JSON.stringify(original)),null])assert.throws(()=>inspectPresentationCoverageRunV2(copy));
 const manifest=JSON.parse(await fs.readFile(original.processManifest.path));assert.equal(manifest.officialProcessor,true);assert.equal(manifest.authoredExecutable,false);
 for(const p of Object.values(manifest.processes)){assert.equal(p.closed,true);assert.equal(p.groupAbsent,true);assert.deepEqual(p.exit,{code:0,signal:null});assert.deepEqual(p.close,{code:0,signal:null});for(const s of Object.values(p.streams)){assert.equal(s.eof,true);assert.equal(s.closed,true);assert.equal(s.forcedDestroy,false);}}
 // All checks above and final receipt verification share the original account.
 assert.deepEqual(await verifyPresentationCoverageRunV2(original),summary);
 const result={schema:'presentation-coverage-official-authored-smoke-v2',status:'success',authoredInput:true,nativeSupported:false,fps:null,coverageQualified:false,originalBrandVerified:true,finalVerifyPassed:true,allThirteenTablesExactCSV:differential.allThirteenTablesExactCSV,selectedSlices:original.diagnostic.selectedGraph.slices,denseCounters:dense.counters.length,tableRows:original.diagnostic.selectedGraph.tableRows,csvBytes:original.graphProof.bytes,resultBytes:original.publication.bytes,manifestBytes:original.processManifest.bytes,publication:original.publication};
 // Mutate only these newly generated authored bytes. Withdrawal is irreversible.
 const raw=await fs.readFile(original.graphProof.path);await fs.appendFile(original.graphProof.path,'\n');await assert.rejects(verifyPresentationCoverageRunV2(original));assert.throws(()=>inspectPresentationCoverageRunV2(original));await fs.writeFile(original.graphProof.path,raw);await assert.rejects(verifyPresentationCoverageRunV2(original));
 result.ownOutputMutationRefused=true;await fs.writeFile(join(out,'smoke.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--processor'||args[2]!=='--out')throw Error('usage: --processor /absolute/pinned-tool --out /absolute/fresh-authored-output');try{process.stdout.write(JSON.stringify(await runPresentationCoverageSmokeV2({processor:args[1],out:args[3]}))+'\n');}catch(error){process.stderr.write(String(error?.message??'authored smoke unavailable')+'\n');process.exitCode=1;}}
