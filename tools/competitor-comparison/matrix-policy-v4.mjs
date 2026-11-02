import {closedData} from '../../competitors/shared/context.mjs';
import {MATRIX_V3_LIMITS} from './matrix-policy-v3.mjs';
export {MATRIX_V3_PROFILES,MATRIX_V3_LIMITS,MATRIX_V3_STAGE_MS,parseMatrixSelection,matrixCaseId,historyPrefixCharacters,matrixVerificationRoster} from './matrix-policy-v3.mjs';
export const MATRIX_V4_ACQUISITION=Object.freeze({contract:'matrix-acquisition-v4',nativeHistoryGesture:'visible-response-below-viewport-one-response-headroom-v4',orchestration:'matrix-active-acquisition-v1',sourceProtocol:'matrix-v3',sourceContextSchema:2});
const need=(value,reason)=>{if(!value)throw Error('matrix-v4-'+reason);};
export function nativeHistorySeekV4(input){
 const value=closedData(input,['clip','responseRect']),clip=closedData(value.clip,['left','top','right','bottom']),rect=closedData(value.responseRect,['left','top','right','bottom']);
 need([...Object.values(clip),...Object.values(rect)].every(Number.isFinite)&&clip.right>clip.left&&clip.bottom>clip.top&&rect.right>rect.left&&rect.bottom>rect.top,'seek-geometry');
 need(Math.min(clip.right,rect.right)>Math.max(clip.left,rect.left)&&Math.min(clip.bottom,rect.bottom)>Math.max(clip.top,rect.top),'response-not-visible');
 const desiredUp=Math.ceil(Math.max(600,clip.bottom+Math.max(clip.bottom-clip.top,rect.bottom-rect.top)-rect.top));
 need(Number.isSafeInteger(desiredUp)&&desiredUp<=MATRIX_V3_LIMITS.maxSeekPixels,'seek-bound');
 return Object.freeze({policy:MATRIX_V4_ACQUISITION.nativeHistoryGesture,desiredUp,deltaY:-desiredUp});
}
