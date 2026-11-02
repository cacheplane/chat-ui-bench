import {createLongThreadFixture} from '../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture,compileCanonicalLongThreadFixture} from '../../tests/fixtures/aimock.ts';
import {parsePublicContext} from '../../competitors/shared/context.mjs';
import {parseMatrixSelection} from './matrix-policy-v3.mjs';

export function createMatrixCase(input){
 const selection=parseMatrixSelection(input),{profile,historyCount,responseBytes,journey}=selection;
 const fixture=createLongThreadFixture({seed:1,historyCount,responseBytes,journey});
 const key=`h${historyCount}-r${responseBytes}-${journey}`,threadId='competitor-thread-matrix-v3-'+key,runId='competitor-run-matrix-v3-'+key,seedRunId='competitor-seed-matrix-v3-'+key;
 const restored=compileCanonicalHistoryRestoreFixture(fixture,{threadId,runId:seedRunId,epochMs:0}),continued=compileCanonicalLongThreadFixture(fixture,{threadId,runId,epochMs:0});
 const publicContext=parsePublicContext({schema:2,profile,threadId,runId,canonicalResponseId:fixture.events[0].messageId,history:fixture.history.map(({id,role,text})=>({id,role,text})),workload:{seed:1,historyCount,responseBytes,deltaCount:200,deltaIntervalMs:50,journey},digests:{sourceSha256:continued.digests.sourceSha256,historySha256:restored.digests.historySha256,responseSha256:continued.digests.responseSha256}});
 return{origin:'actual-aimock-compiler',publicContext,fixture,historyRestore:restored.events,continuation:continued.events,seedRunId};
}
