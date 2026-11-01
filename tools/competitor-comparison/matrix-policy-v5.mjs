export {MATRIX_V3_PROFILES,MATRIX_V3_LIMITS,MATRIX_V3_STAGE_MS,parseMatrixSelection,matrixCaseId,historyPrefixCharacters,matrixVerificationRoster} from './matrix-policy-v3.mjs';
export {nativeHistorySeekV4} from './matrix-policy-v4.mjs';
export const MATRIX_V5_ACQUISITION=Object.freeze({contract:'matrix-acquisition-v5',nativeHistoryGesture:'visible-response-below-viewport-one-response-headroom-v4',orchestration:'matrix-browser-local-readiness-v1',sourceProtocol:'matrix-v3',sourceContextSchema:2});
// Explicit new uniform transport/observation refusals; no existing cap changes.
export const MATRIX_V5_READINESS=Object.freeze({budgetMs:4000,pollMs:50,maxObservations:80,metadataBytes:8388608,receiptBytes:16384});
