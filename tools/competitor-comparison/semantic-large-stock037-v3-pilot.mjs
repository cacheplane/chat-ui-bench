// Fixed16 data predicates; advancement eligibility is never launch permission.
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
import {SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';
import {FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3,SEMANTIC_LARGE_FLAGS_V3,parseFourProfileStock036LargeArgumentsV3,validateSemanticLargeTraceRecordV3} from './four-profile-stock036-large-v3.mjs';
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const need=(v,c)=>{if(!v)throw Error('timeline-owner-'+c);};
function keys(v,ks,c){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,c);const names=Reflect.ownKeys(v);need(names.length===ks.length&&ks.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&d.enumerable;}),c);}
const sha=b=>createHash('sha256').update(b).digest('hex');
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
function boundedJSON(value,cap){
 let bytes=0;const seen=new Set(),add=n=>{bytes+=n;need(bytes<=cap,'bound');};
 function visit(v){if(v===null){add(4);return;}if(typeof v==='boolean'){add(v?4:5);return;}if(typeof v==='number'){need(Number.isFinite(v),'own-data');add(String(v).length);return;}if(typeof v==='string'){need(v.length<=cap,'bound');add(Buffer.byteLength(JSON.stringify(v)));return;}
 need(v&&typeof v==='object'&&!types.isProxy(v)&&!seen.has(v),'own-data');seen.add(v);
 const array=Array.isArray(v);need(array||Object.getPrototypeOf(v)===Object.prototype,'own-data');const names=Reflect.ownKeys(v);need(names.every(k=>typeof k==='string'),'own-data');add(2);let count=0;
 if(array){const length=Object.getOwnPropertyDescriptor(v,'length').value;need(length<=cap&&names.length===length+1,'own-data');for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);visit(d.value);}}
 else for(const k of names){const d=Object.getOwnPropertyDescriptor(v,k);need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);add(Buffer.byteLength(JSON.stringify(k))+1);visit(d.value);}
 seen.delete(v);
 }visit(value);return bytes;
}
const SOURCES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
function sources(facts){boundedJSON(facts,4096);keys(facts,['decoderSources','rssExecutableSha256']);const s=facts.decoderSources;keys(s,['nodeExecutableSha256','files']);need(digest(s.nodeExecutableSha256)&&digest(facts.rssExecutableSha256)&&Array.isArray(s.files)&&s.files.length===7,'source');need(Object.keys(s).join(',')==='nodeExecutableSha256,files','source');for(let i=0;i<7;i++){const f=s.files[i];keys(f,['path','sha256']);need(Object.keys(f).join(',')==='path,sha256'&&f.path==='tools/competitor-comparison/'+SOURCES[i]&&digest(f.sha256),'source');}return {nodeExecutableSha256:s.nodeExecutableSha256,decoderClosureSha256:sha(JSON.stringify(s)),rssExecutableSha256:facts.rssExecutableSha256};}

const roster=freeze([
 {"ordinal":1,"id":"threadplane-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"threadplane-h1000-r6400-follow","round":1,"stratum":0,"block":1,"position":1,"selection":{"profile":"threadplane","historyCount":1000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"registry-stock037","kind":"positive"},
 {"ordinal":2,"id":"copilotkit-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"copilotkit-h1000-r6400-follow","round":1,"stratum":0,"block":1,"position":2,"selection":{"profile":"copilotkit","historyCount":1000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":3,"id":"vercel-ai-sdk-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"vercel-ai-sdk-h1000-r6400-follow","round":1,"stratum":0,"block":1,"position":3,"selection":{"profile":"vercel-ai-sdk","historyCount":1000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":4,"id":"assistant-ui-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"assistant-ui-h1000-r6400-follow","round":1,"stratum":0,"block":1,"position":4,"selection":{"profile":"assistant-ui","historyCount":1000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":5,"id":"copilotkit-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"copilotkit-h1000-r6400-history-reading","round":1,"stratum":1,"block":2,"position":1,"selection":{"profile":"copilotkit","historyCount":1000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":6,"id":"assistant-ui-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"assistant-ui-h1000-r6400-history-reading","round":1,"stratum":1,"block":2,"position":2,"selection":{"profile":"assistant-ui","historyCount":1000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":7,"id":"threadplane-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"threadplane-h1000-r6400-history-reading","round":1,"stratum":1,"block":2,"position":3,"selection":{"profile":"threadplane","historyCount":1000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"registry-stock037","kind":"positive"},
 {"ordinal":8,"id":"vercel-ai-sdk-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"vercel-ai-sdk-h1000-r6400-history-reading","round":1,"stratum":1,"block":2,"position":4,"selection":{"profile":"vercel-ai-sdk","historyCount":1000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":9,"id":"assistant-ui-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"assistant-ui-h10000-r6400-follow","round":1,"stratum":2,"block":3,"position":1,"selection":{"profile":"assistant-ui","historyCount":10000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":10,"id":"vercel-ai-sdk-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"vercel-ai-sdk-h10000-r6400-follow","round":1,"stratum":2,"block":3,"position":2,"selection":{"profile":"vercel-ai-sdk","historyCount":10000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":11,"id":"copilotkit-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"copilotkit-h10000-r6400-follow","round":1,"stratum":2,"block":3,"position":3,"selection":{"profile":"copilotkit","historyCount":10000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":12,"id":"threadplane-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"threadplane-h10000-r6400-follow","round":1,"stratum":2,"block":3,"position":4,"selection":{"profile":"threadplane","historyCount":10000,"responseBytes":6400,"journey":"follow"},"sourceFlavor":"registry-stock037","kind":"positive"},
 {"ordinal":13,"id":"vercel-ai-sdk-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"vercel-ai-sdk-h10000-r6400-history-reading","round":1,"stratum":3,"block":4,"position":1,"selection":{"profile":"vercel-ai-sdk","historyCount":10000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":14,"id":"threadplane-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"threadplane-h10000-r6400-history-reading","round":1,"stratum":3,"block":4,"position":2,"selection":{"profile":"threadplane","historyCount":10000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"registry-stock037","kind":"positive"},
 {"ordinal":15,"id":"assistant-ui-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"assistant-ui-h10000-r6400-history-reading","round":1,"stratum":3,"block":4,"position":3,"selection":{"profile":"assistant-ui","historyCount":10000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"},
 {"ordinal":16,"id":"copilotkit-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1","parentId":"copilotkit-h10000-r6400-history-reading","round":1,"stratum":3,"block":4,"position":4,"selection":{"profile":"copilotkit","historyCount":10000,"responseBytes":6400,"journey":"history-reading"},"sourceFlavor":"published-competitor-v1","kind":"positive"}
]);
const PROFILES=FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3,ATTEMPT_SCHEMA='semantic-large-stock037-pilot-attempt-v3';
export function semanticLargeStock037PilotRosterV3(){if(arguments.length)throw Error('semantic-large-stock037-pilot-roster-arguments');return roster;}
export function parseSemanticLargeStock037PilotArgumentsV3(args){if(arguments.length!==1)throw Error('semantic-large-stock037-pilot-arguments');return parseFourProfileStock036LargeArgumentsV3(args);}

const legacyFlags={performance:false,scoringEligibility:false,FPS:null};
const matches=(v,w)=>v&&Object.entries(w).every(([k,x])=>v[k]===x);

// Only inspect array envelope descriptors here; joined context has separate
// per-record bounds and is never copied into an aggregate array check.
function resultArray(value,max){
 try{if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype)return false;
 const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!Object.hasOwn(length,'value')||!integer(length.value)||length.value>max)return false;
 const names=Reflect.ownKeys(value);if(names.length!==length.value+1)return false;
 for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return false;}return true;
 }catch{return false;}
}

function qualification(results,buildHashes,context){
 const empty=()=>roster.map(()=>({attempted:false,native:false,trace:false,qualified:false,base:false}));
 try{
 if(!resultArray(results,roster.length))return empty();
 boundedJSON(buildHashes,1024);keys(buildHashes,PROFILES);need(PROFILES.every(p=>digest(buildHashes[p])),'build');
 need(context&&!types.isProxy(context),'context');keys(context,['decoderSources','rssExecutableSha256','cases']);const facts={decoderSources:context.decoderSources,rssExecutableSha256:context.rssExecutableSha256};sources(facts);
 need(context.cases&&!types.isProxy(context.cases),'cases');keys(context.cases,roster.map(s=>s.id));need(Object.keys(context.cases).join(',')===roster.map(s=>s.id).join(','),'cases-order');
 const rows=roster.map((slot,i)=>{const descriptor=Object.getOwnPropertyDescriptor(results,String(i));if(!descriptor||!Object.hasOwn(descriptor,'value')||descriptor.value===null)return {attempted:false,native:false,trace:false,qualified:false,base:false};const r=descriptor.value;try{boundedJSON(r,2097152);
 const e=r.semanticLargeAttempt,f=e?.fixture,d=r.fixtureDigests,p=slot.selection.profile,hash=buildHashes[p];
 const identity={id:slot.id,...slot.selection,stockVersion:p==='threadplane'?'0.3.7':null,buildSha256:hash};
 const t=r.traceDiagnostic,record=context.cases[slot.id];let trace=false;
 try{if(t){keys(t,['schema','profile','status','failure','buildSha256','rawCapture','decoderOriginals','validation','policySha256',...Object.keys(P.flags)]);trace=matches(t,{schema:p==='threadplane'?'threadplane-aimock-trace-case-v3':'competitor-aimock-semantic-trace-case-v3',profile:p,status:'complete',failure:null,buildSha256:hash,policySha256:POLICY_SHA,...P.flags})&&validateSemanticLargeTraceRecordV3(record,identity,facts)&&same(t.rawCapture,record.raw.reference)&&same(t.decoderOriginals,record.originals.reference)&&same(t.validation,record.validation.reference);}}catch{trace=false;}
 let base=matches(r,{schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',id:slot.id,kind:'positive',...slot.selection,unsafeOutstanding:false,stopInvocation:false,...legacyFlags})&&!Object.hasOwn(r,'publicationUnavailable')&&same(r.acquisition,MATRIX_V5_ACQUISITION);
 if(!e)base=false;else {keys(e,['schema','parentId','round','stratum','block','position','sourceFlavor','buildSha256','fixture','originalCall','qualificationUnsafe',...Object.keys(P.flags)]);const call=e.originalCall;keys(call,['clock','dispatched','settled']);base=base&&matches(e,{schema:ATTEMPT_SCHEMA,parentId:slot.parentId,round:slot.round,stratum:slot.stratum,block:slot.block,position:slot.position,sourceFlavor:slot.sourceFlavor,buildSha256:hash,qualificationUnsafe:false,...P.flags})&&call.clock==='controller-monotonic'&&finite(call.dispatched)&&finite(call.settled)&&call.settled>=call.dispatched;}
 const fields=['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'];if(f)keys(f,['status',...fields]);base=base&&f&&matches(f,{status:'verified-canonical'})&&fields.every(k=>digest(f[k]))&&d&&fields.slice(0,3).every(k=>f[k]===d[k]);
 const a=r.admission,native=base&&matches(r,{status:'matrix-pass',failure:null})&&matches(a,{schema:'four-stack-matrix-conformance-v5',profile:p,status:'functional-pass',...legacyFlags})&&same(a.acquisition,MATRIX_V5_ACQUISITION)&&matches(a.workload,{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50});
 return {attempted:r.status!=='unattempted',native:!!native,trace:!!trace,base:!!base,qualified:!!native&&!!trace};}catch{return {attempted:true,native:false,trace:false,qualified:false,base:false};}});
 const fields=['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'];
 const baseRows=rows.map(r=>r.base);for(let i=0;i<rows.length;i++)if(baseRows[i])for(let j=0;j<rows.length;j++)if(baseRows[j]&&roster[i].stratum===roster[j].stratum&&!fields.every(k=>results[i].semanticLargeAttempt.fixture[k]===results[j].semanticLargeAttempt.fixture[k])){rows[i].qualified=false;rows[i].base=false;}
 return rows;
 }catch{return empty();}}
function summary(results,buildHashes,context){const q=qualification(results,buildHashes,context);
 // Observed native statuses are separate counts, never substituted for joined qualification.
 for(let i=0;i<roster.length;i++){
 q[i].attempted=false;q[i].native=false;
 try{if(!Array.isArray(results)||types.isProxy(results))continue;const d=Object.getOwnPropertyDescriptor(results,String(i)),r=d&&Object.hasOwn(d,'value')?d.value:null;boundedJSON(r,2097152);
 const slot=roster[i],identity=matches(r,{id:slot.id,kind:'positive',...slot.selection});q[i].attempted=!!identity&&['invalid','matrix-pass'].includes(r.status);
 const a=r?.admission;q[i].native=!!identity&&matches(r,{schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',status:'matrix-pass',failure:null,unsafeOutstanding:false,...legacyFlags})&&!Object.hasOwn(r,'publicationUnavailable')&&same(r.acquisition,MATRIX_V5_ACQUISITION)&&matches(a,{schema:'four-stack-matrix-conformance-v5',profile:slot.selection.profile,status:'functional-pass',...legacyFlags})&&same(a.acquisition,MATRIX_V5_ACQUISITION)&&matches(a.workload,{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50});
 }catch{}}

 return {profiles:PROFILES.map(profile=>{const indices=roster.flatMap((s,i)=>s.selection.profile===profile?[i]:[]),count=k=>indices.filter(i=>q[i][k]).length;return {profile,planned:indices.length,attempted:count('attempted'),nativePass:count('native'),traceComplete:count('trace'),qualified:count('qualified'),plannedPositions:[1,2,3,4].map(p=>indices.filter(i=>roster[i].position===p).length),qualifiedPositions:[1,2,3,4].map(p=>indices.filter(i=>q[i].qualified&&roster[i].position===p).length)};}),pairedBlocks:Array.from({length:roster.length/4},(_,b)=>{const rows=q.slice(b*4,b*4+4),count=k=>rows.filter(r=>r[k]).length;return {block:b+1,round:Math.floor(b/4)+1,stratum:b%4,planned:4,attempted:count('attempted'),nativePass:count('native'),traceComplete:count('trace'),fullyQualified:count('qualified'),qualified:rows.every(r=>r.qualified)};}),...P.flags};}

export function admitSemanticLargeStock037PilotV3(results,buildHashes,traceRecords){return arguments.length===3&&resultArray(results,16)&&results.length===16&&qualification(results,buildHashes,traceRecords).every(r=>r.qualified);}
export function summarizeSemanticLargeStock037PilotV3(results,buildHashes,traceRecords){return summary(results,buildHashes,traceRecords);}
/** Source-bound readbacks/bookends remain the fixed runner's separate duty. */
export function semanticLargeStock037PilotAdvancementV3(results,buildHashes,traceRecords){
 const q=qualification(results,buildHashes,traceRecords),all=arguments.length===3&&resultArray(results,16)&&results.length===16;
 const pilotComplete=all&&q.every(r=>r.qualified);
 let exceptional=false;
 if(all&&!pilotComplete&&q.every(r=>r.trace&&r.base)&&q.every((r,i)=>i===14||r.qualified))try{
 const slot=roster[14],r=results[14];
 exceptional=slot.ordinal===15&&slot.id==='assistant-ui-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1'&&slot.selection.profile==='assistant-ui'&&slot.selection.historyCount===10000&&slot.selection.responseBytes===6400&&slot.selection.journey==='history-reading'&&slot.round===1&&slot.stratum===3&&slot.block===4&&slot.position===3&&r.status==='invalid'&&r.admission===null&&same(r.failure,{message:'matrix-v5-initial-readiness-deadline'});
 }catch{exceptional=false;}
 return {pilotComplete,boundedDiagnosticAdvancementEligible:pilotComplete||exceptional,...SEMANTIC_LARGE_FLAGS_V3};
}
