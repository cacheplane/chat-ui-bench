import { ownHistory, validateResponse, type CaseIds, type HistoryMessage } from './controls.js';

export const AGENT_ID = 'benchmark';
export const RUNTIME_URL = '/copilot';
export const CONTEXT_URL = '/__bench/context';
export const MOUNTED_URL = '/__bench/mounted';
export const COMPLETED_URL = '/__bench/completed';
export const CONTINUATION_URL = '/__bench/continuation';
export interface CaseContext {
  readonly agentId: typeof AGENT_ID;
  readonly ids: CaseIds;
  readonly history: readonly HistoryMessage[];
  readonly response: HistoryMessage;
  readonly seedCommitted: true;
  readonly continuationUrl: typeof CONTINUATION_URL;
}

export function dataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if(typeof value!=='object' || value===null || Array.isArray(value) || Object.getPrototypeOf(value)!==Object.prototype) throw new Error('Expected admitted data record');
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length || own.some(key=>typeof key!=='string' || !keys.includes(key))) throw new Error('Unexpected data fields');
  const result: Record<string,unknown>={};
  for(const key of keys) {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor || !('value' in descriptor)) throw new Error('Expected own data field');
    Object.defineProperty(result,key,{value:descriptor.value,enumerable:true});
  }
  return result;
}
function identity(value: unknown): string {
  if(typeof value!=='string' || value.length===0 || value.length>128 || new TextEncoder().encode(value).byteLength>128) throw new Error('Identity exceeds bound');
  return value;
}
/** JSON is supplied only by the owned same-origin server after its original seed
 * EOF/bridge/public commitment gate. This receipt alone does not admit continuation;
 * the mounted host independently checks full public H and idle/error state. */
export function parseCaseContext(value: unknown): CaseContext {
  const r=dataRecord(value,['agentId','ids','history','response','seedCommitted','continuationUrl']);
  if(r.agentId!==AGENT_ID || r.seedCommitted!==true || r.continuationUrl!==CONTINUATION_URL) throw new Error('Uncommitted or unsupported context');
  const id=dataRecord(r.ids,['threadId','seedRunId','continuationRunId','responseId']);
  const ids=Object.freeze({threadId:identity(id.threadId),seedRunId:identity(id.seedRunId),continuationRunId:identity(id.continuationRunId),responseId:identity(id.responseId)});
  const history=ownHistory(r.history);
  if(history.length!==100 || history.some(message=>message.content.length!==512 || !/^[\x20-\x7e]+$/.test(message.content))) throw new Error('Expected full H100 ASCII history');
  const raw=dataRecord(r.response,['id','role','content']);
  if(raw.role!=='assistant' || typeof raw.content!=='string' || raw.content.length!==6400 || !/^[\x20-\x7e]+$/.test(raw.content)) throw new Error('Expected R6400 ASCII assistant');
  const response: HistoryMessage=Object.freeze({id:identity(raw.id),role:'assistant',content:raw.content});
  if(response.id!==ids.responseId) throw new Error('Response identity differs');
  validateResponse(response,response);
  return Object.freeze({agentId:AGENT_ID,ids,history,response,seedCommitted:true,continuationUrl:CONTINUATION_URL});
}
