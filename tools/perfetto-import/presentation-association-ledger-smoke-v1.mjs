// New maintained authored protobuf; official import, no native capture claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {authoredCoverageProtobufV1} from './presentation-coverage-fixtures-v1.mjs';
import {EXPORT_CONTRACT,PROCESSOR_PINS,runPresentationCoverageDiagnosticV3,inspectPresentationCoverageRunV3,verifyPresentationCoverageRunV3} from './presentation-coverage-run-v3.mjs';
import {buildPresentationAssociationLedgerV1,inspectPresentationAssociationLedgerV1,PRESENTATION_ASSOCIATION_CONTRACT_V1} from './presentation-association-ledger-v1.mjs';
const SELF=fileURLToPath(import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');

// Whole pinned ChromeTrackEvent schema:126011 bytes,
// SHA2a26c01cd9b70dc95fd3ba2630ea918ea57012295225b0d1626e57a105974e03.
// Same maintained packet/clock encoders as the existing official authored smoke.
export async function authoredAssociationLedgerProtobufV1(){
 const {join:concat,uint,body,text}=await import('../../packages/analyzer/src/browser-frame-packet-fragments.test-helper.ts');
 const packet=(...fields)=>body(1,concat(uint(10,1n),...fields));
 const event=(type,name,ts,track,extra=Buffer.alloc(0))=>packet(uint(8,ts),uint(58,64n),body(11,concat(uint(9,type),uint(11,track),text(22,'cc,graphics.pipeline'),...(name===null?[]:[text(23,name)]),extra)));
 const reporter=(state,display,surface=43n)=>body(1075,concat(uint(1,state),uint(3,1n),uint(4,7n),uint(11,7n),uint(17,surface),...(display===null?[]:[uint(18,display)])));
 const graphics=(step,surface,display=null,aggregate=false)=>body(1052,concat(uint(1,step),...(surface===null?[]:[uint(10,surface)]),...(display===null?[]:[uint(3,display)]),...(aggregate?[uint(8,43n)]:[])));
 const U=1n<<64n;
 return Buffer.from(concat(await authoredCoverageProtobufV1(),
  packet(body(60,concat(uint(1,190n),body(3,concat(uint(1,84n),text(6,'Authored GPU')))))),
  packet(body(60,concat(uint(1,191n),body(4,concat(uint(1,84n),uint(2,85n),text(5,'Authored GPU thread')))))),
  packet(body(60,concat(uint(1,192n),uint(5,191n),text(2,'authored-gpu')))),
  event(1n,'PipelineReporter',2000n,92n,reporter(1n,58n)),
  event(1n,'PipelineReporter',2001n,92n,reporter(2n,58n)),
  event(2n,null,2010n,92n),event(2n,null,2010n,92n),
  event(1n,'PipelineReporter',2020n,92n,reporter(3n,59n,44n)),event(2n,null,2025n,92n),
  event(1n,'PipelineReporter',2030n,92n,reporter(0n,null,U-1n)),event(2n,null,2035n,92n),
  event(3n,'Graphics.Pipeline',2002n,192n,graphics(23n,43n)),
  event(3n,'Graphics.Pipeline',2003n,92n,graphics(25n,43n)),
  event(3n,'Graphics.Pipeline',2004n,192n,graphics(5n,43n)),
  event(3n,'Graphics.Pipeline',2005n,192n,graphics(21n,null,58n)),
  event(3n,'Graphics.Pipeline',2006n,192n,graphics(10n,null,58n,true)),
  event(3n,'Graphics.Pipeline',2007n,192n,graphics(24n,43n)),
  event(3n,'Graphics.Pipeline',2040n,92n,graphics(25n,null)),
  event(3n,'Graphics.Pipeline',2041n,92n,graphics(25n,U-1n))
 ));
}
export async function runPresentationAssociationLedgerSmokeV1({processor,out}){
 assert.ok(isAbsolute(processor)&&resolve(processor)===processor);assert.ok(isAbsolute(out)&&resolve(out)===out);assert.equal(await fs.realpath(dirname(out)),dirname(out));
 const processorHash=hash(await fs.readFile(processor));assert.equal(processorHash,PROCESSOR_PINS[process.platform+'-'+process.arch]);
 const sourcePath=fileURLToPath(new URL('./presentation-association-ledger-v1.mjs',import.meta.url)),source=await fs.readFile(sourcePath),sourceFact={path:sourcePath,bytes:source.length,sha256:hash(source)};
 await fs.mkdir(out,{mode:0o700});const bytes=await authoredAssociationLedgerProtobufV1(),trace=join(out,'new-authored-associations.pftrace');await fs.writeFile(trace,bytes,{flag:'wx',mode:0o600});
 const coverage=await runPresentationCoverageDiagnosticV3(JSON.stringify({schema:'browser-presentation-coverage-inventory-run-v3',policy:'whole-selected-presentation-coverage-v2',exportPolicy:EXPORT_CONTRACT.exportPolicy,trace:{path:trace,bytes:bytes.length,sha256:hash(bytes)},processor:{path:processor,sha256:processorHash},target:{frameId:'frame',loaderId:'loader'},phaseNames:{start:'start',end:'end'},out:join(out,'coverage'),deadlineMs:60000}));
 assert.equal(coverage.status,'diagnostic',coverage.reason);assert.equal(coverage.traceOrigin,'caller-supplied-persisted-trace');assert.equal(coverage.executionEvidence,'source-owned-official-import');
 const coverageSummary=inspectPresentationCoverageRunV3(coverage);assert.deepEqual(await verifyPresentationCoverageRunV3(coverage),coverageSummary);
 const ledger=buildPresentationAssociationLedgerV1(coverage.diagnostic);assert.equal(ledger.status,'diagnostic',ledger.reason);const summary=inspectPresentationAssociationLedgerV1(ledger);assert.notEqual(summary,ledger);assert.equal(summary.input.inputAuthority,'original-core-brand-only');
 assert.equal(ledger.displayAssociations.length,1);assert.equal(ledger.displayAssociations[0].displayTraceId,'58');assert.equal(ledger.displayAssociations[0].groupRefs.length,2);assert.equal(ledger.counts.duplicateReporterTerminalGroups,1);
 assert.equal(ledger.sourceStepAnnotations.filter(x=>x.classification==='source-recognized-send').length,2);assert.equal(ledger.sourceStepAnnotations.filter(x=>x.classification==='known-send-unusable-surface').length,2);
 assert.deepEqual(ledger.counts.rawReporterRecordsByState,{STATE_NO_UPDATE_DESIRED:1,STATE_PRESENTED_ALL:1,STATE_PRESENTED_PARTIAL:1,STATE_DROPPED:1,unclassified:0});assert.equal(ledger.displayAssociations[0].processIdentity,'distinct-known-processes');
 assert.ok(ledger.graphicEvidence.some(x=>x.step==='STEP_SEND_ON_STANDALONE_BEGIN_FRAME_MOJO_MESSAGE'));assert.ok(ledger.groups.some(x=>x.failedReporterSliceIds.length));assert.ok(ledger.groups.some(x=>x.nonPresentedReporterSliceIds.length));
 assert.deepEqual(ledger.groups,coverage.diagnostic.candidates);assert.deepEqual(ledger.reporterEvidence,coverage.diagnostic.reconciliation.reporterEvidence);assert.ok(Object.values(ledger.authorities).every(x=>x===false||x===null));
 for(const dto of [structuredClone(coverage.diagnostic),{}])assert.equal(buildPresentationAssociationLedgerV1(dto).status,'unavailable');for(const copy of [{...ledger},structuredClone(ledger)])assert.throws(()=>inspectPresentationAssociationLedgerV1(copy));assert.equal(buildPresentationAssociationLedgerV1(coverage.diagnostic).reason,'original-core-already-attempted');
 await fs.writeFile(join(out,'ledger.json'),JSON.stringify(ledger)+'\n',{flag:'wx',mode:0o600});assert.deepEqual(await verifyPresentationCoverageRunV3(coverage),coverageSummary);assert.deepEqual(inspectPresentationAssociationLedgerV1(ledger),summary);assert.equal(hash(await fs.readFile(sourcePath)),sourceFact.sha256);
 const result={schema:'presentation-association-ledger-official-authored-smoke-v1',status:'success',authoredInput:true,sourceOwnedOfficialImport:true,nativeExecutionPremise:false,policy:PRESENTATION_ASSOCIATION_CONTRACT_V1.policy,sourceFact,counts:summary.counts,originalCoverageReceiptVerified:true,originalCoreAndLedgerBrandsVerified:true,allOriginalGroupsRetained:true,sourceStepAnnotationsVerified:true,authorities:ledger.authorities,FPS:null};
 // Mutate only this fresh authored output; pure ledger branding is not file custody.
 const graph=await fs.readFile(coverage.graphProof.path);await fs.appendFile(coverage.graphProof.path,'\n');await assert.rejects(verifyPresentationCoverageRunV3(coverage));assert.throws(()=>inspectPresentationCoverageRunV3(coverage));await fs.writeFile(coverage.graphProof.path,graph);await assert.rejects(verifyPresentationCoverageRunV3(coverage));
 assert.equal(inspectPresentationAssociationLedgerV1(ledger).input.inputAuthority,'original-core-brand-only');result.parentOutputDriftIrreversiblyRefused=true;result.pureLedgerDoesNotAssertFileCustody=true;
 await fs.writeFile(join(out,'smoke.json'),JSON.stringify(result)+'\n',{flag:'wx',mode:0o600});return result;
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--processor'||args[2]!=='--out')throw Error('usage: --processor /absolute/pinned-tool --out /absolute/fresh-authored-output');try{process.stdout.write(JSON.stringify(await runPresentationAssociationLedgerSmokeV1({processor:args[1],out:args[3]}))+'\n');}catch(error){process.stderr.write(String(error?.message??'authored smoke unavailable')+'\n');process.exitCode=1;}}
