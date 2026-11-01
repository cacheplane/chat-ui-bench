import {createLongThreadFixture} from '../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture,compileCanonicalLongThreadFixture} from '../../tests/fixtures/aimock.ts';
import {parsePublicContext,closedData} from '../../competitors/shared/context.mjs';

export function createFunctionalCase(profile,journey){
  if(!['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].includes(profile)||!['follow','history-reading'].includes(journey))throw Error('competitor-case-selection');
  const fixture=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey});
  const threadId='competitor-thread-v1',runId='competitor-continuation-v1',seedRunId='competitor-seed-v1';
  const restored=compileCanonicalHistoryRestoreFixture(fixture,{threadId,runId:seedRunId,epochMs:0});
  const continued=compileCanonicalLongThreadFixture(fixture,{threadId,runId,epochMs:0});
  const publicContext=parsePublicContext({schema:1,profile,threadId,runId,canonicalResponseId:fixture.events[0].messageId,
    history:fixture.history.map(({id,role,text})=>({id,role,text})),
    workload:{seed:1,historyCount:100,responseBytes:6400,deltaCount:200,deltaIntervalMs:50,journey},
    digests:{sourceSha256:continued.digests.sourceSha256,historySha256:restored.digests.historySha256,responseSha256:continued.digests.responseSha256}});
  return {origin:'actual-aimock-compiler',publicContext,fixture,historyRestore:restored.events,continuation:continued.events,seedRunId};
}
export function validateFinalSnapshot(value,input){
  const context=parsePublicContext(value.publicContext);
  const snapshot=closedData(input,['messages','running','error','responseId','operation']);
  const operation=closedData(snapshot.operation,['kind','status']);
  if(operation.kind!==(context.profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise'))throw Error('competitor-operation-kind');
  if(!['original-run-promise','public-runtime-state-transition'].includes(operation.kind)||operation.status!=='fulfilled'||snapshot.running!==false||snapshot.error!==null)throw Error('competitor-original-completion');
  if(!Array.isArray(snapshot.messages)||snapshot.messages.length!==101)throw Error('competitor-final-length');
  const seen=new Set();
  for(let i=0;i<snapshot.messages.length;i++){
    const actual=closedData(snapshot.messages[i],['id','role','text']);
    if(typeof actual.id!=='string'||actual.id.length===0||actual.id.length>128||seen.has(actual.id)||typeof actual.text!=='string')throw Error('competitor-final-message');
    seen.add(actual.id);
    if(i<100){const expected=context.history[i];if(actual.id!==expected.id||actual.role!==expected.role||actual.text!==expected.text)throw Error('competitor-history-conservation');}
    else{
      const response=value.fixture.events.filter(x=>x.type==='text-delta').map(x=>x.text).join('');
      if(actual.role!=='assistant'||actual.id!==snapshot.responseId||actual.text!==response)throw Error('competitor-response-content');
    }
  }
  return {canonicalId:context.canonicalResponseId,nativeId:snapshot.responseId};
}
