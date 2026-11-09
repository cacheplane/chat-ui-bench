// Candidate-only TWO-slot diagnostic bound to reviewed, unreleased SDK source.
// Published activation/selection/execution remain NIL.
import {types} from 'node:util';
import path from 'node:path';
import {createHash} from 'node:crypto';
const need=(v,label='record')=>{if(!v)throw Error('local-postfix-two-slot-v1-'+label);};
const hex=(v,n=64)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const names=['a2ui','ag-ui','chat','langgraph','render','telemetry'].map(n=>'@threadplane/'+n),runtime=names.filter(n=>n!=='@threadplane/ag-ui');
export const LOCAL_POSTFIX_ROLES_V1=Object.freeze(['candidate']);
export const LOCAL_POSTFIX_RUNTIME_NAMES_V1=Object.freeze(runtime);
export const LOCAL_POSTFIX_PACKAGE_NAMES_V1=Object.freeze(names);
export const LOCAL_POSTFIX_SOURCE_COMMIT_V1="7e0787edbf740c81911421f9dc9730c44cfac228";
export const LOCAL_POSTFIX_SOURCE_TREE_V1="1e35b14597179dff81e89b153f0a3f4e8ae5e470";
export const LOCAL_POSTFIX_DECLARATION_SHA256_V1="b450dcda89e5f84301c6bbe69d4d89df5fe90a1fc63c2654dfc80ca4a6533318";
export const LOCAL_POSTFIX_ACTIVE_SOURCE_V1=null;
function exact(v,keys){need(v!==null&&typeof v==='object'&&!Array.isArray(v)&&!types.isProxy(v)&&Object.getPrototypeOf(v)===Object.prototype);const d=Object.getOwnPropertyDescriptors(v);need(Reflect.ownKeys(d).every(k=>typeof k==='string'));need(Object.keys(d).sort().join('\0')===[...keys].sort().join('\0')&&Object.values(d).every(p=>Object.hasOwn(p,'value')));}
function jsonData(v,depth=0,budget={n:0}){need(depth<=32&&++budget.n<=200000&&!types.isProxy(v));if(v===null||typeof v==='boolean'||typeof v==='string'){if(typeof v==='string')need(v.length<=1048576);return;}if(typeof v==='number'){need(Number.isFinite(v));return;}need(typeof v==='object');const ds=Object.getOwnPropertyDescriptors(v);need(Reflect.ownKeys(ds).every(k=>typeof k==='string'));need(Object.values(ds).every(d=>Object.hasOwn(d,'value')));if(Array.isArray(v)){need(Object.getPrototypeOf(v)===Array.prototype);need(v.length<=24576&&Object.keys(ds).filter(k=>k!=='length').length===v.length);for(let i=0;i<v.length;i++){need(Object.hasOwn(ds,String(i)));jsonData(ds[i].value,depth+1,budget);}}else{need(Object.getPrototypeOf(v)===Object.prototype);for(const[k,d]of Object.entries(ds)){need(k!=='__proto__'&&k!=='constructor'&&k!=='prototype');jsonData(d.value,depth+1,budget);}}}
function rel(v){need(typeof v==='string'&&v.length>0&&v.length<=1024&&!v.includes('\\')&&!v.includes('\0')&&!path.isAbsolute(v)&&v.split('/').every(s=>s&&s!=='.'&&s!=='..'));}
function ref(v){exact(v,['path','bytes','sha256']);need(typeof v.path==='string'&&path.isAbsolute(v.path)&&path.resolve(v.path)===v.path&&!v.path.includes('\0')&&Number.isSafeInteger(v.bytes)&&v.bytes>=0&&v.bytes<=67108864&&hex(v.sha256));}
const hashKeys=['package.json','apps/threadplane/package.json','package-lock.json'];
function hashes(v){exact(v,hashKeys);need(Object.values(v).every(x=>hex(x)));}
function selection(s,role){exact(s,['schema','role','sourceCommit','sourceTree','sourceOrigin','sourceClean','sourceProofSha256','benchmarkBaseCommit','canonicalInputs','registry037Inputs','selectedSourceHashes','runtimePackageNames','artifacts','vendorPackagesSha256','sourceProofRefs']);need(s.schema==='threadplane-local-postfix-diagnostic-selection-identity-v1'&&s.role===role&&hex(s.sourceCommit,40)&&hex(s.sourceTree,40)&&hex(s.benchmarkBaseCommit,40)&&s.sourceClean===true&&['git@github.com:cacheplane/threadplane.git','https://github.com/cacheplane/threadplane.git'].includes(s.sourceOrigin)&&hex(s.sourceProofSha256)&&hex(s.vendorPackagesSha256));need(role==='candidate');hashes(s.canonicalInputs);hashes(s.registry037Inputs);hashes(s.selectedSourceHashes);need(s.selectedSourceHashes['package.json']===s.registry037Inputs['package.json']&&s.selectedSourceHashes['apps/threadplane/package.json']===s.registry037Inputs['apps/threadplane/package.json']);need(JSON.stringify(s.runtimePackageNames)===JSON.stringify(runtime)&&Array.isArray(s.artifacts)&&s.artifacts.length===6);need(Array.isArray(s.sourceProofRefs)&&s.sourceProofRefs.length>0&&s.sourceProofRefs.length<=512);let proofBytes=0;for(const r of s.sourceProofRefs){ref(r);need(r.bytes<=8388608&&(proofBytes+=r.bytes)<=67108864);}need(s.sourceProofRefs.some(r=>r.sha256===s.sourceProofSha256));
 for(let i=0;i<6;i++){const a=s.artifacts[i];exact(a,['name','version','sourceRef','relativeTarballPath','bytes','sha256','integrity','files','manifest']);need(a.name===names[i]&&a.version==='0.3.7');ref(a.sourceRef);need(Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes<=8388608&&hex(a.sha256)&&a.sourceRef.bytes===a.bytes&&a.sourceRef.sha256===a.sha256&&typeof a.integrity==='string'&&/^sha512-[A-Za-z0-9+/]{86}==$/.test(a.integrity));rel(a.relativeTarballPath);need(a.relativeTarballPath===`local-packages/local-postfix-two-slot-v1/${role}/${a.name.slice(13)}.tgz`);need(Array.isArray(a.files)&&a.files.length>0&&a.files.length<=4096);const seen=new Set();let total=0;for(const f of a.files){exact(f,['path','bytes','sha256']);rel(f.path);need(!seen.has(f.path)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0&&f.bytes<=16777216&&hex(f.sha256)&&(total+=f.bytes)<=67108864);seen.add(f.path);}need(a.files.some(f=>f.path==='package.json'));need(a.manifest?.name===a.name&&a.manifest?.version==='0.3.7');}
}
function execution(e,role){exact(e,['schema','role','buildRecordRelativePath','buildRecordBytes','buildRecordSha256','parsedBuildSha256','probeRecordSha256','preparationProofSha256']);need(e.schema==='threadplane-local-postfix-diagnostic-execution-identity-v1'&&e.role===role&&e.buildRecordRelativePath==='apps/threadplane/.build-evidence.json'&&Number.isSafeInteger(e.buildRecordBytes)&&e.buildRecordBytes>0&&e.buildRecordBytes<=1048576&&['buildRecordSha256','parsedBuildSha256','probeRecordSha256','preparationProofSha256'].every(k=>hex(e[k])));}

/** Passive candidate-only data shape, never source/runtime qualification. */
export function validateLocalPostfixDiagnosticRecordV1(value){
 jsonData(value);exact(value,['schema','diagnosticId','declarationSha256','version','sourceCommit','sourceTree','candidate']);
 need(value.schema==='threadplane-local-postfix-diagnostic-fixed-v1'&&value.diagnosticId==='local-postfix-two-slot-v1'&&value.version==='0.3.7');
 for(const [v,pin,n]of [[value.sourceCommit,LOCAL_POSTFIX_SOURCE_COMMIT_V1,40],[value.sourceTree,LOCAL_POSTFIX_SOURCE_TREE_V1,40],[value.declarationSha256,LOCAL_POSTFIX_DECLARATION_SHA256_V1,64]])need(pin===null?(v===null||hex(v,n)):v===pin);
 need((value.sourceCommit===null)===(value.sourceTree===null));
 if(value.candidate!==null){need(hex(value.sourceCommit,40)&&hex(value.sourceTree,40)&&hex(value.declarationSha256));exact(value.candidate,['selection','execution']);selection(value.candidate.selection,'candidate');need(value.candidate.selection.sourceCommit===value.sourceCommit&&value.candidate.selection.sourceTree===value.sourceTree);if(value.candidate.execution!==null)execution(value.candidate.execution,'candidate');}
 return value;
}
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
export function immutableLocalPostfixDiagnosticRecordV1(value){validateLocalPostfixDiagnosticRecordV1(value);return freeze(structuredClone(value));}
export const LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1=immutableLocalPostfixDiagnosticRecordV1({"schema":"threadplane-local-postfix-diagnostic-fixed-v1","diagnosticId":"local-postfix-two-slot-v1","declarationSha256":"b450dcda89e5f84301c6bbe69d4d89df5fe90a1fc63c2654dfc80ca4a6533318","version":"0.3.7","sourceCommit":"7e0787edbf740c81911421f9dc9730c44cfac228","sourceTree":"1e35b14597179dff81e89b153f0a3f4e8ae5e470","candidate":null});
export function assertLocalPostfixSelectionsReadyV1(){need(hex(LOCAL_POSTFIX_SOURCE_COMMIT_V1,40)&&hex(LOCAL_POSTFIX_SOURCE_TREE_V1,40)&&hex(LOCAL_POSTFIX_DECLARATION_SHA256_V1)&&LOCAL_POSTFIX_ACTIVE_SOURCE_V1===LOCAL_POSTFIX_SOURCE_COMMIT_V1&&LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1.candidate!==null,'identity-unavailable');validateLocalPostfixDiagnosticRecordV1(LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1);}
export function assertLocalPostfixExecutionsReadyV1(){assertLocalPostfixSelectionsReadyV1();need(LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1.candidate.execution!==null,'identity-unavailable');}
function roleCheck(role){need(role==='candidate','role');}
export function localPostfixSelectionIdentityV1(role){assertLocalPostfixSelectionsReadyV1();roleCheck(role);return LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1.candidate.selection;}
export function localPostfixExecutionIdentityV1(role){assertLocalPostfixExecutionsReadyV1();roleCheck(role);return LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1.candidate.execution;}
export const localPostfixDigestV1=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function localPostfixGitExecutableV1(){need(arguments.length===0,'arguments');if(process.platform==='darwin')return '/Library/Developer/CommandLineTools/usr/bin/git';need(process.platform==='linux','platform');return '/usr/bin/git';}
const ROOT='/private/tmp/chat-ui-bench-postfix-two-slot-candidate-native-20261108-invocation01';
export function localPostfixRoleRootV1(role){assertLocalPostfixExecutionsReadyV1();roleCheck(role);return ROOT;}
const ROSTER=freeze(['follow','history-reading'].map(journey=>({id:`threadplane-h10000-r6400-${journey}-local-postfix-two-slot-v1-candidate`,kind:'positive',selection:{profile:'threadplane',historyCount:10000,responseBytes:6400,journey},role:'candidate',stock:false})));
export function localPostfixRosterV1(){need(arguments.length===0,'arguments');return ROSTER;}
export function localPostfixSlotV1(ordinal){need(arguments.length===1&&Number.isSafeInteger(ordinal)&&ordinal>=0&&ordinal<2,'ordinal');return ROSTER[ordinal];}

/** Pure source join, not activation authority. Only two JSON data RHSs may differ. */
export function assertLocalPostfixActivationSourceV1(baseSource,activeSource){
 const fail=()=>{throw Error('local-postfix-two-slot-v1-activation-source');};
 try{
  if(arguments.length!==2||typeof baseSource!=='string'||typeof activeSource!=='string'||Buffer.byteLength(baseSource)>1048576||Buffer.byteLength(activeSource)>1048576)fail();
  const declarations=[
   ['LOCAL_POSTFIX_ACTIVE_SOURCE_V1','export const LOCAL_POSTFIX_ACTIVE_SOURCE_V1=',';'],
   ['LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1','export const LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1=immutableLocalPostfixDiagnosticRecordV1(',');'],
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
  validateLocalPostfixDiagnosticRecordV1(baseRecord);validateLocalPostfixDiagnosticRecordV1(activeRecord);
  if(baseCandidate!==null||baseRecord.candidate!==null||(activeCandidate!==null&&!hex(activeCandidate,40))||activeCandidate!==LOCAL_POSTFIX_ACTIVE_SOURCE_V1||JSON.stringify(activeRecord)!==JSON.stringify(LOCAL_POSTFIX_FIXED_DIAGNOSTIC_V1)||base.normalized!==active.normalized)fail();
 }catch{fail();}
}
