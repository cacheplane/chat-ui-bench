// Explicit authored protobuf only. No captured trace argument or native capture.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPresentationCoverageAccountV1,parsePresentationCoverageCSVV1,inspectPresentationCoverageWireV1} from './presentation-coverage-wire-v1.mjs';
import {authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
import {runPresentationCoverageDiagnosticV1,inspectPresentationCoverageRunV1,verifyPresentationCoverageRunV1,PROCESSOR_PINS} from './presentation-coverage-run-v1.mjs';
const SELF=fileURLToPath(import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function runPresentationCoverageSmokeV1({processor,out}) {
  assert.ok(isAbsolute(processor)&&resolve(processor)===processor);
  assert.ok(isAbsolute(out)&&resolve(out)===out);
  assert.equal(await fs.realpath(dirname(out)),dirname(out));
  const processorHash=hash(await fs.readFile(processor));
  assert.equal(processorHash,PROCESSOR_PINS[process.platform+'-'+process.arch]);
  await fs.mkdir(out,{mode:0o700});
  const bytes=await authoredCoverageProtobufV1(),path=join(out,'new-authored-coverage.pftrace');
  await fs.writeFile(path,bytes,{flag:'wx',mode:0o600});
  const original=await runPresentationCoverageDiagnosticV1(JSON.stringify({
    schema:'browser-presentation-coverage-inventory-run-v1',policy:'whole-selected-presentation-coverage-v1',
    trace:{path,bytes:bytes.length,sha256:hash(bytes)},processor:{path:processor,sha256:processorHash},
    target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:join(out,'inventory'),deadlineMs:60000,
  }));
  assert.equal(original.status,'diagnostic',original.reason);
  const summary=inspectPresentationCoverageRunV1(original);
  assert.deepEqual(await verifyPresentationCoverageRunV1(original),summary);
  for(const copy of [{...original},JSON.parse(JSON.stringify(original)),null])assert.throws(()=>inspectPresentationCoverageRunV1(copy));
  assert.equal(original.diagnostic.trackers.length,1);
  assert.equal(original.diagnostic.trackers[0].observedTermination,true);
  assert.ok(original.diagnostic.trackers[0].counters.length>0);
  assert.ok(original.diagnostic.candidates.some(c=>c.state==='candidate-without-successful-reporter'));
  assert.ok(original.diagnostic.candidates.some(c=>c.state==='unresolved'));
  assert.equal(original.diagnostic.closure.producerEmissionCompleteness,'unproved');
  assert.ok(Object.values(original.authorities).every(value=>value===false||value===null));
  const raw=await fs.readFile(original.graphProof.path);
  assert.equal(raw.length,original.graphProof.bytes);
  assert.equal(hash(raw),original.graphProof.sha256);
  const {tables}=inspectPresentationCoverageWireV1(parsePresentationCoverageCSVV1(raw,createPresentationCoverageAccountV1()));
  assert.equal(tables.length,13);
  assert.deepEqual(tables.map(rows=>rows.length),[76,18,8,6,21,3,6,6,24,1,1,3,1]);
  assert.deepEqual(tables.map(rows=>rows.length),original.diagnostic.selectedGraph.tableRows);
  const census=new Map(tables[1].map(row=>[row.name,row]));
  for(const name of ['FrameSequenceTracker','PipelineReporter','Graphics.Pipeline.DrawAndSwap','BeginFrame']) {
    assert.equal(census.get(name).event_count,'0');assert.equal(census.get(name).arg_set_count,'0');
  }
  assert.equal(census.get('FrameSequenceTrackerV3').event_count,'1');
  assert.equal(census.get('Graphics.Pipeline').event_count,'2');
  const outer=tables[2].find(row=>row.name==='FrameSequenceTrackerV3');
  const nested=tables[2].find(row=>row.name==='Frame ');
  assert.equal(nested.parent_id,outer.id);assert.equal(nested.depth,'1');
  assert.equal(outer.utid,null);assert.equal(outer.tid,null);assert.notEqual(outer.upid,null);
  assert.equal(nested.utid,null);assert.equal(nested.upid,outer.upid);
  const trackerTrack=tables[5].find(row=>row.name==='FrameSequenceTrackerV3');
  const parentTrack=tables[5].find(row=>row.name==='authored-tracker-parent');
  assert.equal(trackerTrack.parent_id,parentTrack.id);
  assert.equal(tables[2].some(row=>row.track_id===parentTrack.id),false);
  const parentSets=[parentTrack.source_arg_set_id,parentTrack.dimension_arg_set_id];
  assert.ok(parentSets.every(id=>tables[7].some(row=>row.arg_set_id===id)));
  assert.ok(parentSets.every(id=>tables[8].some(row=>row.arg_set_id===id)));
  const repeated=tables[4].filter(row=>row.flat_key==='debug.repeated');
  assert.equal(repeated.length,2);
  assert.deepEqual(repeated.map(row=>row.key),['debug.repeated[0]','debug.repeated[1]']);
  assert.ok(repeated.every(row=>row.string_value==='a'));
  assert.equal(tables[6].length,tables[5].length*2);
  assert.ok(tables[8].some(row=>row.key==='parent_track_uuid'&&row.int_value==='90'));
  assert.ok(tables[8].some(row=>row.key==='parent_track_uuid'&&row.int_value==='91'));
  assert.ok(tables[4].some(row=>row.key==='debug.empty'&&row.string_value===''));
  assert.ok(tables[4].some(row=>row.key==='debug.literalNull'&&row.string_value==='[NULL]'));
  // Mutate only this newly generated authored proof; late custody must refuse.
  await fs.appendFile(original.graphProof.path,'\n');
  await assert.rejects(verifyPresentationCoverageRunV1(original));
  assert.throws(()=>inspectPresentationCoverageRunV1(original));
  await fs.writeFile(original.graphProof.path,raw);
  assert.throws(()=>inspectPresentationCoverageRunV1(original));
  await assert.rejects(verifyPresentationCoverageRunV1(original));
  const result={schema:'presentation-coverage-official-authored-smoke-v1',status:'success',authoredInput:true,nativeSupported:false,fps:null,coverageQualified:false,originalBrandVerified:true,copyRefused:true,ownOutputMutationRefused:true,publication:original.publication};
  await fs.writeFile(join(out,'smoke.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF) {
  const args=process.argv.slice(2);
  if(args.length!==4||args[0]!=='--processor'||args[2]!=='--out')throw Error('usage: --processor /absolute/pinned-tool --out /absolute/fresh-output');
  try { process.stdout.write(JSON.stringify(await runPresentationCoverageSmokeV1({processor:args[1],out:args[3]}))+'\n'); }
  catch(error) { process.stderr.write(String(error?.message??'authored smoke unavailable')+'\n');process.exitCode=1; }
}
