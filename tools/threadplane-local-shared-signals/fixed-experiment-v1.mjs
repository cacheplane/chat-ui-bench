import {types} from 'node:util';
import path from 'node:path';
import {createHash} from 'node:crypto';
const need=(v,label='record')=>{if(!v)throw Error('local-shared-signals-'+label);};
const hex=(v,n=64)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const names=['a2ui','ag-ui','chat','langgraph','render','telemetry'].map(n=>'@threadplane/'+n);
const runtime=names.filter(n=>n!=='@threadplane/ag-ui');
export const LOCAL_SHARED_SIGNALS_ROLES_V1=Object.freeze(['control','candidate']);
export const LOCAL_SHARED_SIGNALS_RUNTIME_NAMES_V1=Object.freeze(runtime);
export const LOCAL_SHARED_SIGNALS_PACKAGE_NAMES_V1=Object.freeze(names);
export const LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1='ea0c0a1851f86f4e2c2a03fdb88611e21766653b';
export const LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1=null;
export const LOCAL_SHARED_SIGNALS_DECISION_SHA256_V1='4aeb8b7928090073430b99feb4c708b483c9a76ca6531d1eaba414bfdbf7e68c';
function exact(v,keys){need(v!==null&&typeof v==='object'&&!Array.isArray(v)&&!types.isProxy(v)&&Object.getPrototypeOf(v)===Object.prototype);const d=Object.getOwnPropertyDescriptors(v);need(Reflect.ownKeys(d).every(k=>typeof k==='string'));need(Object.keys(d).sort().join('\0')===[...keys].sort().join('\0')&&Object.values(d).every(p=>Object.hasOwn(p,'value')));}
function jsonData(v,depth=0,budget={n:0}){need(depth<=32&&++budget.n<=200000&&!types.isProxy(v));if(v===null||typeof v==='boolean'||typeof v==='string'){if(typeof v==='string')need(v.length<=1048576);return;}if(typeof v==='number'){need(Number.isFinite(v));return;}need(typeof v==='object');const ds=Object.getOwnPropertyDescriptors(v);need(Reflect.ownKeys(ds).every(k=>typeof k==='string'));need(Object.values(ds).every(d=>Object.hasOwn(d,'value')));if(Array.isArray(v)){need(Object.getPrototypeOf(v)===Array.prototype);need(v.length<=24576&&Object.keys(ds).filter(k=>k!=='length').length===v.length);for(let i=0;i<v.length;i++){need(Object.hasOwn(ds,String(i)));jsonData(ds[i].value,depth+1,budget);}}else{need(Object.getPrototypeOf(v)===Object.prototype);for(const[k,d]of Object.entries(ds)){need(k!=='__proto__'&&k!=='constructor'&&k!=='prototype');jsonData(d.value,depth+1,budget);}}}
function rel(v){need(typeof v==='string'&&v.length>0&&v.length<=1024&&!v.includes('\\')&&!v.includes('\0')&&!path.isAbsolute(v)&&v.split('/').every(s=>s&&s!=='.'&&s!=='..'));}
function ref(v){exact(v,['path','bytes','sha256']);need(typeof v.path==='string'&&path.isAbsolute(v.path)&&path.resolve(v.path)===v.path&&!v.path.includes('\0')&&Number.isSafeInteger(v.bytes)&&v.bytes>=0&&v.bytes<=67108864&&hex(v.sha256));}
const hashKeys=['package.json','apps/threadplane/package.json','package-lock.json'];
function hashes(v){exact(v,hashKeys);need(Object.values(v).every(x=>hex(x)));}
function selection(s,role){exact(s,['schema','role','sourceCommit','sourceTree','sourceOrigin','sourceClean','sourceProofSha256','benchmarkBaseCommit','canonicalInputs','registry037Inputs','selectedSourceHashes','runtimePackageNames','artifacts','vendorPackagesSha256','sourceProofRefs']);need(s.schema==='threadplane-local-shared-signals-selection-identity-v1'&&s.role===role&&hex(s.sourceCommit,40)&&hex(s.sourceTree,40)&&hex(s.benchmarkBaseCommit,40)&&s.sourceClean===true&&['git@github.com:cacheplane/threadplane.git','https://github.com/cacheplane/threadplane.git'].includes(s.sourceOrigin)&&hex(s.sourceProofSha256)&&hex(s.vendorPackagesSha256));if(role==='control')need(s.sourceCommit===LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1);hashes(s.canonicalInputs);hashes(s.registry037Inputs);hashes(s.selectedSourceHashes);need(s.selectedSourceHashes['package.json']===s.registry037Inputs['package.json']&&s.selectedSourceHashes['apps/threadplane/package.json']===s.registry037Inputs['apps/threadplane/package.json']);need(JSON.stringify(s.runtimePackageNames)===JSON.stringify(runtime)&&Array.isArray(s.artifacts)&&s.artifacts.length===6);need(Array.isArray(s.sourceProofRefs)&&s.sourceProofRefs.length>0&&s.sourceProofRefs.length<=512);let proofBytes=0;for(const r of s.sourceProofRefs){ref(r);need(r.bytes<=8388608&&(proofBytes+=r.bytes)<=67108864);}need(s.sourceProofRefs.some(r=>r.sha256===s.sourceProofSha256));
 for(let i=0;i<6;i++){const a=s.artifacts[i];exact(a,['name','version','sourceRef','relativeTarballPath','bytes','sha256','integrity','files','manifest']);need(a.name===names[i]&&a.version==='0.3.7');ref(a.sourceRef);need(Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes<=8388608&&hex(a.sha256)&&a.sourceRef.bytes===a.bytes&&a.sourceRef.sha256===a.sha256&&typeof a.integrity==='string'&&/^sha512-[A-Za-z0-9+/]{86}==$/.test(a.integrity));rel(a.relativeTarballPath);need(a.relativeTarballPath===`local-packages/local-shared-signals/${role}/${a.name.slice(13)}.tgz`);need(Array.isArray(a.files)&&a.files.length>0&&a.files.length<=4096);const seen=new Set();let total=0;for(const f of a.files){exact(f,['path','bytes','sha256']);rel(f.path);need(!seen.has(f.path)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=16777216&&hex(f.sha256)&&(total+=f.bytes)<=67108864);seen.add(f.path);}need(a.files.some(f=>f.path==='package.json'));need(a.manifest?.name===a.name&&a.manifest?.version==='0.3.7');}
}
function execution(e,role){exact(e,['schema','role','buildRecordRelativePath','buildRecordBytes','buildRecordSha256','parsedBuildSha256','probeRecordSha256','preparationProofSha256']);need(e.schema==='threadplane-local-shared-signals-execution-identity-v1'&&e.role===role&&e.buildRecordRelativePath==='apps/threadplane/.build-evidence.json'&&Number.isSafeInteger(e.buildRecordBytes)&&e.buildRecordBytes>0&&e.buildRecordBytes<=1048576&&['buildRecordSha256','parsedBuildSha256','probeRecordSha256','preparationProofSha256'].every(k=>hex(e[k])));}
/** Pure shape validation: no filesystem, execution, preparation or stock authority. */
export function validateLocalSharedSignalsExperimentRecordV1(value){jsonData(value);exact(value,['schema','experimentId','decisionSha256','version','controlSourceCommit','roles']);need(value.schema==='threadplane-local-shared-signals-fixed-experiment-v1'&&value.experimentId==='local-shared-signals-v1'&&value.decisionSha256===LOCAL_SHARED_SIGNALS_DECISION_SHA256_V1&&value.version==='0.3.7'&&value.controlSourceCommit===LOCAL_SHARED_SIGNALS_CONTROL_SOURCE_V1);exact(value.roles,LOCAL_SHARED_SIGNALS_ROLES_V1);for(const role of LOCAL_SHARED_SIGNALS_ROLES_V1){const r=value.roles[role];if(r!==null){exact(r,['selection','execution']);selection(r.selection,role);if(r.execution!==null)execution(r.execution,role);}}return value;}
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
export function immutableLocalSharedSignalsExperimentRecordV1(value){validateLocalSharedSignalsExperimentRecordV1(value);return freeze(structuredClone(value));}
export const LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1=immutableLocalSharedSignalsExperimentRecordV1({"schema":"threadplane-local-shared-signals-fixed-experiment-v1","experimentId":"local-shared-signals-v1","decisionSha256":"4aeb8b7928090073430b99feb4c708b483c9a76ca6531d1eaba414bfdbf7e68c","version":"0.3.7","controlSourceCommit":"ea0c0a1851f86f4e2c2a03fdb88611e21766653b","roles":{"control":null,"candidate":null}});
/** No-argument gates must precede even explicit role/ports inspection. */
export function assertLocalSharedSignalsSelectionsReadyV1(){need(LOCAL_SHARED_SIGNALS_ROLES_V1.every(role=>LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles[role]!==null)&&hex(LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1,40)&&LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles.candidate.selection.sourceCommit===LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1,'identity-unavailable');}
export function assertLocalSharedSignalsExecutionsReadyV1(){assertLocalSharedSignalsSelectionsReadyV1();need(LOCAL_SHARED_SIGNALS_ROLES_V1.every(role=>LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles[role].execution!==null),'identity-unavailable');}
function roleCheck(role){need(LOCAL_SHARED_SIGNALS_ROLES_V1.includes(role),'role');}
export function localSharedSignalsSelectionIdentityV1(role){assertLocalSharedSignalsSelectionsReadyV1();roleCheck(role);return LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles[role].selection;}
export function localSharedSignalsExecutionIdentityV1(role){assertLocalSharedSignalsExecutionsReadyV1();roleCheck(role);return LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1.roles[role].execution;}
export const localSharedSignalsDigestV1=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Closed implementation path only; callers retain their existing authority gates. */
export function localSharedSignalsGitExecutableV1(){
 need(arguments.length===0,'arguments');
 if(process.platform==='darwin')return '/Library/Developer/CommandLineTools/usr/bin/git';
 need(process.platform==='linux','platform');return '/usr/bin/git';
}

const ROOTS=Object.freeze({control:'/private/tmp/chat-ui-bench-shared-signals-control-native-20261107-invocation01',candidate:'/private/tmp/chat-ui-bench-shared-signals-candidate-native-20261107-invocation01'});
/** Runtime roots are inaccessible until both real executions are activated. */
export function localSharedSignalsRoleRootV1(role){assertLocalSharedSignalsExecutionsReadyV1();roleCheck(role);return ROOTS[role];}
const roster=[];
for(let roundIndex=0;roundIndex<3;roundIndex++)for(let stratum=0;stratum<4;stratum++){
 const historyCount=stratum<2?1000:10000,journey=stratum%2?'history-reading':'follow',first=(roundIndex+stratum)%2===0?'control':'candidate';
 const order=first==='control'?LOCAL_SHARED_SIGNALS_ROLES_V1:[...LOCAL_SHARED_SIGNALS_ROLES_V1].reverse();
 for(let i=0;i<2;i++){const role=order[i],parentId=`threadplane-h${historyCount}-r6400-${journey}`;roster.push({id:`${parentId}-local-shared-signals-v1-${role}-round-${roundIndex+1}`,parentId,kind:'positive',selection:{profile:'threadplane',historyCount,responseBytes:6400,journey},role,round:roundIndex+1,stratum,block:roundIndex*4+stratum+1,position:i+1,stock:false});}
}
const ROSTER=freeze(roster);
/** Pure schedule data grants no selection or execution authority. */
export function localSharedSignalsRosterV1(){need(arguments.length===0,'arguments');return ROSTER;}
export function localSharedSignalsSlotV1(ordinal){need(arguments.length===1&&Number.isSafeInteger(ordinal)&&ordinal>=0&&ordinal<24,'ordinal');return ROSTER[ordinal];}

/** Pure source join, not activation authority. Only two JSON data RHSs may differ. */
export function assertLocalSharedSignalsActivationSourceV1(baseSource,activeSource){
 const fail=()=>{throw Error('local-shared-signals-activation-source');};
 try{
  if(arguments.length!==2||typeof baseSource!=='string'||typeof activeSource!=='string'||Buffer.byteLength(baseSource)>1048576||Buffer.byteLength(activeSource)>1048576)fail();
  const declarations=[
   ['LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1','export const LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1=',';'],
   ['LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1','export const LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1=immutableLocalSharedSignalsExperimentRecordV1(',');'],
  ];
  function split(source){
   const lines=source.split('\n'),values=[];
   for(const [name,prefix,suffix]of declarations){
    const markers=lines.map((line,index)=>new RegExp('^[ \\t]*export[ \\t]+const[ \\t]+'+name+'\\b').test(line)?index:-1).filter(index=>index>=0);
    if(markers.length!==1)fail();const index=markers[0],line=lines[index];
    if(!line.startsWith(prefix)||!line.endsWith(suffix))fail();
    const text=line.slice(prefix.length,-suffix.length),value=JSON.parse(text);jsonData(value);
    if(JSON.stringify(value)!==text)fail();values.push(value);lines[index]=prefix+'<fixed-json-data>'+suffix;
   }
   return{values,normalized:lines.join('\n')};
  }
  const base=split(baseSource),active=split(activeSource),[baseCandidate,baseRecord]=base.values,[activeCandidate,activeRecord]=active.values;
  validateLocalSharedSignalsExperimentRecordV1(baseRecord);validateLocalSharedSignalsExperimentRecordV1(activeRecord);
  if(baseCandidate!==null||LOCAL_SHARED_SIGNALS_ROLES_V1.some(role=>baseRecord.roles[role]!==null)||(activeCandidate!==null&&!hex(activeCandidate,40))||activeCandidate!==LOCAL_SHARED_SIGNALS_CANDIDATE_SOURCE_V1||JSON.stringify(activeRecord)!==JSON.stringify(LOCAL_SHARED_SIGNALS_FIXED_EXPERIMENT_V1)||base.normalized!==active.normalized)fail();
 }catch{fail();}
}
