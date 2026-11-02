import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {threadplaneBuildEvidence} from '../../apps/threadplane/provenance.mjs';
import {assertStock034BuildV1} from './aimock-stock034-v1.mjs';
import {matrixVerificationRoster,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {createMatrixDeadline,runMatrixRoster} from './matrix-run-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';

const flags={performance:false,scoringEligibility:false,FPS:null};
const roster=Object.freeze([1,2,3].flatMap(round=>matrixVerificationRoster().filter(row=>row.kind==='positive'&&row.selection.profile==='threadplane'&&row.selection.historyCount===100&&row.selection.responseBytes===6400).map(row=>Object.freeze({...row,id:`${row.id}-aimock-trace-v1-round-${round}`,round}))));
export const aimockTraceRosterV1=()=>roster;
export function parseAimockTraceArgumentsV1(args){
 if(args.length!==2||args[0]!=='--out'||typeof args[1]!=='string'||!path.isAbsolute(args[1])||path.resolve(args[1])!==args[1]||args[1].includes('\0'))throw Error('aimock-trace-arguments');
 return {out:args[1]};
}
export function admitAimockTraceCohortV1(results){
 return Array.isArray(results)&&results.length===roster.length&&results.every((r,i)=>r?.id===roster[i].id&&r.status==='matrix-pass'&&r.unsafeOutstanding===false&&r.stopInvocation===false&&r.traceDiagnostic?.status==='complete'&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null);
}
export async function runAimockTraceInvocationV1(args){
 const {out}=parseAimockTraceArgumentsV1(args),invocationStarted=performance.now(),deadline=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted});
 const {runMatrixCase}=await deadline.wait(import('./matrix-case-trace-v1.mjs'),STAGES.progress,'aimock-trace-modules');
 const store=await deadline.wait(createMatrixArtifactStore({directory:out}),STAGES.progress,'aimock-trace-directory');
 const build=assertStock034BuildV1(await deadline.wait(threadplaneBuildEvidence(),STAGES.transcript,'aimock-stock034-build'));
 const manifest={schema:'threadplane-aimock-trace-invocation-v1',purpose:'instrumented-diagnostic-baseline',stockVersion:'0.3.4',fixtureProtocol:'aimock-matrix-v3',build,environment:{platform:os.platform(),release:os.release(),architecture:os.arch(),node:process.version,mode:'headless',viewport:{width:1280,height:720,deviceScaleFactor:1},physicalPresentation:'unverified'},roster:roster.map(({id,round,selection})=>({id,round,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},...flags};
 await deadline.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'aimock-trace-initial');
 const execution=await runMatrixRoster({slots:roster,invocationStarted,execute:slot=>runMatrixCase({slot,store,out,invocationStarted})});
 const buildSha256=createHash('sha256').update(JSON.stringify(build)).digest('hex');
 const complete=execution.complete&&admitAimockTraceCohortV1(execution.results)&&execution.results.every(r=>r.traceDiagnostic?.stockBuildSha256===buildSha256),final={...manifest,...execution,complete,status:complete?'complete':'incomplete',storage:store.stats()};
 const original=store.writeManifest('manifest-final.json',final);let timer;
 try{await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('aimock-trace-final-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-performance.now())));})]);}finally{clearTimeout(timer);}
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runAimockTraceInvocationV1(process.argv.slice(2)).then(value=>{console.log(JSON.stringify({schema:value.schema,complete:value.complete,cases:value.results.map(r=>({id:r.id,status:r.status,trace:r.traceDiagnostic?.status??'unavailable'})),FPS:null}));if(!value.complete)process.exitCode=1;},()=>{console.error('aimock-trace-invocation-failed details-retained-locally');process.exitCode=1;});
