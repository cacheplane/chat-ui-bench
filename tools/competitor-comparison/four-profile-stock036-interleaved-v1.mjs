import path from 'node:path';
import {matrixVerificationRoster} from './matrix-policy-v5.mjs';
export const FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1=Object.freeze(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']);
const orders=[[0,1,3,2],[1,2,0,3],[2,3,1,0],[3,0,2,1]],parents=matrixVerificationRoster();
const roster=[];
for(let r=0;r<3;r++)for(let s=0;s<4;s++)for(const [i,p]of orders[(r+s)%4].entries()){
 const profile=FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1[p],historyCount=s<2?1000:10000,journey=s%2?'history-reading':'follow';
 const parent=parents.find(x=>x.kind==='positive'&&x.selection.profile===profile&&x.selection.historyCount===historyCount&&x.selection.responseBytes===6400&&x.selection.journey===journey);
 if(!parent||Object.hasOwn(parent,'omitDelta'))throw Error('interleaved-parent');
 roster.push(Object.freeze({...parent,parentId:parent.id,id:`${parent.id}-four-profile-stock036-interleaved-v1-round-${r+1}`,round:r+1,stratum:s,block:r*4+s+1,position:i+1,sourceFlavor:profile==='threadplane'?'registry-stock036':'published-competitor-v1'}));
}
Object.freeze(roster);
export const fourProfileStock036InterleavedRosterV1=()=>roster;
export function parseFourProfileStock036InterleavedArgumentsV1(args){if(!Array.isArray(args)||args.length!==2||args[0]!=='--out'||typeof args[1]!=='string'||!path.isAbsolute(args[1])||path.resolve(args[1])!==args[1]||args[1].includes('\0'))throw Error('interleaved-arguments');return{out:args[1]};}
import {types} from 'node:util';
import {MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
const own=(v,k)=>{if(!v||typeof v!=='object'||types.isProxy(v))return undefined;const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const same=(v,w)=>Object.entries(w).every(([k,x])=>own(v,k)===x);
export const INTERLEAVED_FLAGS_V1=Object.freeze({performance:false,scoringEligibility:false,FPS:null});
const flags=v=>same(v,INTERLEAVED_FLAGS_V1),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function qualification(results,buildHashes){try{
 if(!Array.isArray(results)||types.isProxy(results)||own(results,'length')!==48||!buildHashes||types.isProxy(buildHashes)||Object.keys(buildHashes).sort().join(',')!==[...FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1].sort().join(',')||FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1.some(p=>!hex(own(buildHashes,p))))return [];
 const qualified=roster.map((slot,i)=>{const r=own(results,String(i)),a=own(r,'admission'),e=own(r,'interleavedAttempt'),t=own(r,'traceDiagnostic'),f=own(e,'fixture'),d=own(r,'fixtureDigests'),p=slot.selection.profile,hash=own(buildHashes,p),isT=p==='threadplane';
 if(!(same(r,{schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',id:slot.id,kind:'positive',...slot.selection,status:'matrix-pass',failure:null,unsafeOutstanding:false,stopInvocation:false})&&own(r,'publicationUnavailable')===undefined&&flags(r)&&same(own(r,'acquisition'),MATRIX_V5_ACQUISITION)&&same(a,{schema:'four-stack-matrix-conformance-v5',profile:p,status:'functional-pass'})&&same(own(a,'workload'),{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50})&&flags(a)&&same(own(a,'acquisition'),MATRIX_V5_ACQUISITION)&&same(e,{schema:'four-profile-stock036-interleaved-attempt-v1',qualificationUnsafe:false,parentId:slot.parentId,round:slot.round,stratum:slot.stratum,block:slot.block,position:slot.position,sourceFlavor:slot.sourceFlavor,buildSha256:hash})&&flags(e)&&same(t,{schema:isT?'threadplane-aimock-trace-case-v2':'competitor-aimock-semantic-trace-case-v1',status:'complete',[isT?'stockBuildSha256':'competitorBuildSha256']:hash})&&(isT?own(t,'competitorBuildSha256')===undefined:own(t,'profile')===p&&own(t,'stockBuildSha256')===undefined)&&flags(t)&&own(f,'status')==='verified-canonical'))return false;
 const fields=['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'];if(fields.some(k=>!hex(own(f,k)))||fields.slice(0,3).some(k=>own(f,k)!==own(d,k)))return false;
 return true;
 });
 return qualified.map((ok,i)=>ok&&roster.every((s,j)=>s.stratum!==roster[i].stratum||!qualified[j]||['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'].every(k=>own(own(own(own(results,String(i)),'interleavedAttempt'),'fixture'),k)===own(own(own(own(results,String(j)),'interleavedAttempt'),'fixture'),k))));
 }catch{return [];}}
export function admitFourProfileStock036InterleavedV1(results,buildHashes){const q=qualification(results,buildHashes);return q.length===48&&q.every(Boolean);}
/** Called only after bounded hash-verified store.readJSON of the actual case fixture. */
export async function verifyInterleavedFixtureV1(source,result,slot){
 const [{validateCanonicalLongThreadFixture,canonicalSerialize},{createMatrixCase},{createHash}]=await Promise.all([import('../../packages/contract/dist/index.js'),import('./matrix-fixtures-v3.mjs'),import('node:crypto')]);
 const canonical=validateCanonicalLongThreadFixture(source?.fixture),expected=createMatrixCase(slot.selection);
 if(canonicalSerialize(source)!==canonicalSerialize(expected))throw Error('interleaved-actual-fixture-not-canonical');
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const facts={status:'verified-canonical',sourceSha256:hash(canonicalSerialize(canonical)),historySha256:hash(canonicalSerialize(canonical.history.map(({id,role,text})=>({id,role,content:text})))),responseSha256:hash(canonical.events.slice(1,-1).map(e=>e.text).join('')),sourceDeltaSha256:hash(canonicalSerialize(canonical.events))};
 for(const k of ['sourceSha256','historySha256','responseSha256'])if(facts[k]!==source.publicContext.digests[k]||facts[k]!==result.fixtureDigests?.[k])throw Error('interleaved-actual-fixture-digest');
 return Object.freeze(facts);
}

export function summarizeFourProfileStock036InterleavedV1(results,buildHashes){
 const q=qualification(results,buildHashes),rows=Array.isArray(results)?results:[];
 return {profiles:FOUR_PROFILE_STOCK036_INTERLEAVED_PROFILES_V1.map(profile=>{const indices=roster.flatMap((s,i)=>s.selection.profile===profile?[i]:[]);return{profile,planned:12,attempted:indices.filter(i=>rows[i]&&rows[i].status!=='unattempted').length,nativePass:indices.filter(i=>rows[i]?.status==='matrix-pass').length,traceComplete:indices.filter(i=>rows[i]?.traceDiagnostic?.status==='complete').length,qualified:indices.filter(i=>q[i]).length,plannedPositions:[1,2,3,4].map(p=>indices.filter(i=>roster[i].position===p).length),qualifiedPositions:[1,2,3,4].map(p=>indices.filter(i=>q[i]&&roster[i].position===p).length)};}),pairedBlocks:Array.from({length:12},(_,b)=>({block:b+1,round:Math.floor(b/4)+1,stratum:b%4,planned:4,attempted:[0,1,2,3].filter(p=>rows[b*4+p]&&rows[b*4+p].status!=='unattempted').length,nativePass:[0,1,2,3].filter(p=>rows[b*4+p]?.status==='matrix-pass').length,traceComplete:[0,1,2,3].filter(p=>rows[b*4+p]?.traceDiagnostic?.status==='complete').length,fullyQualified:[0,1,2,3].filter(p=>q[b*4+p]===true).length,qualified:[0,1,2,3].every(p=>q[b*4+p]===true)})),...INTERLEAVED_FLAGS_V1};
}
