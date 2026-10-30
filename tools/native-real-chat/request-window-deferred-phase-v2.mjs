import {admitStock033DataV2} from './roster-stock033-v2.mjs';
import {REQUEST_WINDOW_RUN_ID} from './request-window-core.mjs';
const unavailable=()=>Error('native-request-window-deferred-phase-unavailable');
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
// Authored structural projection only. Production invokes this solely on the
// genuine finish() return in the source-owned worker closure. This public DTO
// never grants a private capture or analysis capability.
export function projectAuthoredRequestWindowDeferredPhaseV2(receipt,originalIdentity){
 admitStock033DataV2(originalIdentity,256);if(Object.keys(originalIdentity).length!==2||!['dev','ino'].every(k=>Number.isSafeInteger(originalIdentity[k])&&originalIdentity[k]>=0))throw unavailable();
 admitStock033DataV2(receipt,65535);
 const r=receipt,t=r.transport,a=r.target?.before,b=r.target?.after;
 if(r.status!=='closed'||r.failureCount!==0||r.originalOperationsSettled!==true||!Array.isArray(r.operations)||r.operations.length>128||r.operations.some(op=>op.state!=='fulfilled')||r.operations.filter(op=>op.kind==='write-receipt').length!==1||!t||t.outcome!=='protocol-closed'||t.originalOperationsSettled!==true||t.completeClosureObserved!==true||!Array.isArray(t.pending)||t.pending.length||r.persistedWholeInput!=='verified'||!r.persisted||!Number.isSafeInteger(r.persisted.bytes)||r.persisted.bytes<1||r.persisted.bytes>33554432||typeof r.persisted.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.persisted.sha256)||!a||!b||JSON.stringify(a)!==JSON.stringify(b)||r.runner?.close!=='fulfilled'||r.runner.wait?.exitCode!==0||r.runner.wait.signal!==null)throw unavailable();
 for(const key of ['frameId','loaderId','targetId','browserContextId','url'])if(typeof a[key]!=='string'||!a[key]||Buffer.byteLength(a[key])>(key==='url'?2048:256))throw unavailable();
 if(!Array.isArray(r.marks)||r.marks.length!==2)throw unavailable();
 const marks={};for(const [i,phase]of ['start','end'].entries()){const row=r.marks[i];if(row.phase!==phase||row.state!=='fulfilled'||row.targetId!==a.targetId||row.runId!==REQUEST_WINDOW_RUN_ID||row.phaseId!=='history100-up'||typeof row.name!=='string'||!new RegExp('^native:'+REQUEST_WINDOW_RUN_ID+':history100-up:'+phase+':[a-f0-9]{16}$').test(row.name))throw unavailable();marks[phase]=row.name;}
 const result={policy:'source-owned-request-window-deferred-phase-v2',phaseInspectionPolicy:'request-window-postcapture-owned-v12-v1',status:'deferred',originalTraceIdentity:{dev:originalIdentity.dev,ino:originalIdentity.ino},target:{frameId:a.frameId,loaderId:a.loaderId,targetId:a.targetId},marks,trace:{...r.persisted},analysisEligible:false,FPS:null};
 if(Buffer.byteLength(JSON.stringify(result))>4096)throw unavailable();return freeze(result);
}
