import {closedData,PUBLIC_CONTEXT_LIMITS} from '../../competitors/shared/context.mjs';
export const MATRIX_V3_PROFILES=Object.freeze(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']);
export const MATRIX_V3_LIMITS=Object.freeze({contextBytes:PUBLIC_CONTEXT_LIMITS['matrix-v3'],httpBodyBytes:8388608,fixtureBytes:33554432,transcriptBytes:16777216,evidenceBytes:2097152,resultBytes:2097152,caseBytes:83886080,invocationBytes:4294967296,caseFailureReserveBytes:65536,invocationFailureReserveBytes:1048576,selectedRoots:32,caseMs:240000,invocationMs:1200000,cleanupMs:30000,maxSeekPixels:1048576});
export const MATRIX_V3_STAGE_MS=Object.freeze({childReady:30000,browserLaunch:30000,navigation:45000,hydration:120000,transcript:30000,progress:10000,readiness:4000,turnStability:2000,nativeMovement:5000,originalRun:30000,nativeReturn:10000,finalDOM:15000,publicDispose:10000,browserClose:10000,serverClose:10000});
const need=(value,reason)=>{if(!value)throw Error('matrix-v3-'+reason);};
export function parseMatrixSelection(input){
 const value=closedData(input,['profile','historyCount','responseBytes','journey']);
 need(MATRIX_V3_PROFILES.includes(value.profile)&&[100,1000,10000].includes(value.historyCount)&&[6400,262144].includes(value.responseBytes)&&['follow','history-reading'].includes(value.journey),'selection');
 return Object.freeze(value);
}
export function matrixCaseId(input){const value=parseMatrixSelection(input);return`${value.profile}-h${value.historyCount}-r${value.responseBytes}-${value.journey}`;}
export function historyPrefixCharacters(responseBytes){need([6400,262144].includes(responseBytes),'response-size');return 16*Math.floor(responseBytes/200)+Math.min(16,responseBytes%200);}
export function nativeHistorySeek(input){
 const value=closedData(input,['clip','responseRect']),clip=closedData(value.clip,['left','top','right','bottom']),rect=closedData(value.responseRect,['left','top','right','bottom']);
 need([...Object.values(clip),...Object.values(rect)].every(Number.isFinite)&&clip.right>clip.left&&clip.bottom>clip.top&&rect.right>rect.left&&rect.bottom>rect.top,'seek-geometry');
 need(Math.min(clip.right,rect.right)>Math.max(clip.left,rect.left)&&Math.min(clip.bottom,rect.bottom)>Math.max(clip.top,rect.top),'response-not-visible');
 const desiredUp=Math.ceil(Math.max(600,clip.top+(clip.bottom-clip.top)/2-rect.top));
 need(Number.isSafeInteger(desiredUp)&&desiredUp<=MATRIX_V3_LIMITS.maxSeekPixels,'seek-bound');
 return Object.freeze({policy:'visible-response-to-mid-viewport-v3',desiredUp,deltaY:-desiredUp});
}
const roster=[];
for(const historyCount of [100,1000,10000])for(const responseBytes of [6400,262144])for(const profile of MATRIX_V3_PROFILES)for(const journey of ['follow','history-reading']){
 const selection=parseMatrixSelection({profile,historyCount,responseBytes,journey});roster.push(Object.freeze({id:matrixCaseId(selection),kind:'positive',selection}));
}
const negative=parseMatrixSelection({profile:'vercel-ai-sdk',historyCount:10000,responseBytes:262144,journey:'follow'});
roster.push(Object.freeze({id:matrixCaseId(negative)+'-omitted-delta-100',kind:'omitted-delta-100',selection:negative,omitDelta:100}));
Object.freeze(roster);
export const matrixVerificationRoster=()=>roster;
