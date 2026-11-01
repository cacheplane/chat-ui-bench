import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {matrixVerificationRoster,matrixCaseId,MATRIX_V5_ACQUISITION,MATRIX_V5_READINESS,MATRIX_V3_LIMITS as LIMITS,MATRIX_V3_STAGE_MS as STAGES} from './matrix-policy-v5.mjs';
import {runMatrixCase,runMatrixRoster,createMatrixDeadline} from './matrix-run-v5.mjs';
import {createMatrixArtifactStore} from './matrix-artifacts-v3.mjs';

export const THREADPLANE_REGRESSION_V1=Object.freeze({schema:'threadplane-functional-regression-v1',purpose:'harness-and-threadplane-functional-regression'});
const slots=Object.freeze(matrixVerificationRoster().filter(slot=>slot.kind==='positive'&&slot.selection.profile==='threadplane'));
const expected=[];
for(const historyCount of [100,1000,10000])for(const responseBytes of [6400,262144])for(const journey of ['follow','history-reading'])expected.push(matrixCaseId({profile:'threadplane',historyCount,responseBytes,journey}));
if(slots.length!==12||new Set(slots.map(s=>s.id)).size!==12||slots.some((s,i)=>s.id!==expected[i]||s.kind!=='positive'||Object.hasOwn(s,'omitDelta')))throw Error('matrix-threadplane-regression-roster');
export const threadplaneRegressionRosterV1=()=>slots;
const need=(v,code)=>{if(!v)throw Error(code);};
export function parseThreadplaneRegressionArgumentsV1(args){
 need(Array.isArray(args),'matrix-threadplane-regression-arguments');let verify=false,out=null;
 for(let i=0;i<args.length;i++){const key=args[i];if(key==='--verify'){need(!verify,'matrix-threadplane-regression-arguments');verify=true;}else if(key==='--out'){need(out===null&&typeof args[i+1]==='string','matrix-threadplane-regression-arguments');out=args[++i];}else throw Error('matrix-threadplane-regression-arguments');}
 need(verify,'matrix-threadplane-regression-verification-required');need(typeof out==='string'&&path.isAbsolute(out)&&path.resolve(out)===out,'matrix-absolute-output-required');return Object.freeze({out,mode:'strict'});
}
function own(value,key){if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}
const flags=value=>own(value,'performance')===false&&own(value,'scoringEligibility')===false&&own(value,'FPS')===null;
const acquisition=value=>Object.keys(MATRIX_V5_ACQUISITION).every(key=>own(value,key)===MATRIX_V5_ACQUISITION[key]);
/** Cohort closure only. The unchanged runMatrixCase owns all case admission. */
export function validateThreadplaneRegressionExecutionV1(value){
 try{const results=own(value,'results');if(own(value,'complete')!==true||own(value,'stopReason')!==null||!Array.isArray(results)||types.isProxy(results)||own(results,'length')!==12)return false;
  return slots.every((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission');return own(r,'schema')==='four-stack-matrix-case-v5'&&own(r,'id')===slot.id&&own(r,'kind')==='positive'&&Object.entries(slot.selection).every(([key,v])=>own(r,key)===v)&&own(r,'purpose')==='functional-conformance-development'&&own(r,'status')==='matrix-pass'&&own(r,'failure')===null&&own(r,'unsafeOutstanding')===false&&own(r,'stopInvocation')===false&&own(r,'publicationUnavailable')===undefined&&acquisition(own(r,'acquisition'))&&flags(r)&&own(a,'schema')==='four-stack-matrix-conformance-v5'&&own(a,'profile')==='threadplane'&&own(a,'status')==='functional-pass'&&acquisition(own(a,'acquisition'))&&flags(a);});
 }catch{return false;}
}
export async function executeThreadplaneRegressionV1({execute,invocationStarted,now=()=>performance.now(),onResult=async()=>{}}){
 const result=await runMatrixRoster({slots,execute,invocationStarted,now,onResult});return {...result,complete:validateThreadplaneRegressionExecutionV1(result)};
}
/** The CLI uses these original production ports. Overrides permit pure tests;
 * they never select a roster, alter admission, or appear in command arguments. */
export async function runThreadplaneRegressionV1(args,ports={}){
 for(const key of Object.keys(ports))need(['execute','now','createStore'].includes(key),'matrix-threadplane-regression-port');
 const {execute=runMatrixCase,now=()=>performance.now(),createStore=createMatrixArtifactStore}=ports,selected=parseThreadplaneRegressionArgumentsV1(args),invocationStarted=now(),setup=createMatrixDeadline({caseStarted:invocationStarted,invocationStarted,now});
 const store=await setup.wait(createStore({directory:selected.out}),STAGES.progress,'matrix-invocation-directory');
 const manifest={...THREADPLANE_REGRESSION_V1,acquisition:MATRIX_V5_ACQUISITION,readinessPolicy:MATRIX_V5_READINESS,mode:'strict',selection:slots.map(({id,kind,selection})=>({id,kind,selection})),policy:{caseMs:LIMITS.caseMs,invocationMs:LIMITS.invocationMs,cleanupMs:LIMITS.cleanupMs},performance:false,scoringEligibility:false,FPS:null};
 await setup.wait(store.writeManifest('manifest-initial.json',{...manifest,status:'planned'}),STAGES.progress,'matrix-initial-manifest');
 const execution=await executeThreadplaneRegressionV1({invocationStarted,now,execute:slot=>execute({slot,store,out:selected.out,invocationStarted})});
 const final={...manifest,status:execution.complete?'complete':'incomplete',...execution,storage:store.stats()};
 const originalPublication=store.writeManifest('manifest-final.json',final);let timer;
 try{await Promise.race([originalPublication,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('matrix-final-manifest-publication-unsettled')),Math.max(1,Math.min(STAGES.progress,invocationStarted+LIMITS.invocationMs+LIMITS.cleanupMs-now())));})]);}finally{clearTimeout(timer);}
 return final;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)runThreadplaneRegressionV1(process.argv.slice(2)).then(result=>{if(!result.complete)process.exitCode=1;},()=>{console.error('matrix-threadplane-regression-entry-failed');process.exitCode=1;});
