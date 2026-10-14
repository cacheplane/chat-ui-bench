// This module is inert: it imports no SDK, React, producer or server code.
export interface HistoryMessage { readonly id: string; readonly role: 'user' | 'assistant'; readonly content: string }
export interface CaseIds { readonly threadId: string; readonly seedRunId: string; readonly continuationRunId: string; readonly responseId: string }
export interface RunRequest { readonly threadId: string; readonly runId: string; readonly messages: unknown }
export interface OwnedRunRequest { readonly threadId: string; readonly runId: string; readonly messages: readonly HistoryMessage[] }
export type OperationKind = 'native-connect' | 'http' | 'producer' | 'reader' | 'bridge' | 'public-operation' | 'server-disposal' | 'harness-disposal';
export interface SeedReceipt { readonly terminalSuccess: boolean; readonly eof: boolean; readonly bridgeSettled: boolean; readonly publicSettled: boolean; readonly idle: boolean; readonly messages: unknown }
export interface MountedReceipt { readonly idle: boolean; readonly error: unknown; readonly messages: unknown }
// First mounted release profile: H100/R6400; larger matrices need new admission.
const MAX_HISTORY = 100;
const MAX_CONTENT = 512;
function requireFact(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(value: unknown): Record<string, unknown> {
  requireFact(typeof value === 'object' && value !== null && !Array.isArray(value), 'Expected record');
  const prototype: unknown = Object.getPrototypeOf(value);
  requireFact(prototype === Object.prototype || prototype === null, 'Expected plain record');
  requireFact(Reflect.ownKeys(value).length <= 64, 'Record key bound');
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireFact(descriptor && 'value' in descriptor, 'Accessors are not admitted');
    if (typeof key === 'string') Object.defineProperty(result,key,{value:descriptor.value,enumerable:true});
    else Object.defineProperty(result,key,{value:descriptor.value});
  }
  return result;
}
function string(value: unknown, max: number): asserts value is string {
  // Character preflight bounds the walk. Count UTF-8 without an encoded allocation;
  // lone surrogates encode as the three-byte replacement character.
  requireFact(typeof value === 'string' && value.length <= max, 'String character preflight exceeded');
  let bytes=0;
  for(let i=0;i<value.length;i++) {
    const unit=value.charCodeAt(i);
    if(unit<=0x7f) bytes++;
    else if(unit<=0x7ff) bytes+=2;
    else if(unit>=0xd800 && unit<=0xdbff && i+1<value.length && value.charCodeAt(i+1)>=0xdc00 && value.charCodeAt(i+1)<=0xdfff) { bytes+=4; i++; }
    else bytes+=3;
    requireFact(bytes<=max,'UTF-8 byte bound exceeded');
  }
}
function ownIds(value: CaseIds): CaseIds {
  const r=record(value);
  requireFact(Reflect.ownKeys(r).length===4 && ['threadId','seedRunId','continuationRunId','responseId'].every(key=>Object.hasOwn(r,key)),'Exactly four admitted identity fields required');
  string(r.threadId,128); string(r.seedRunId,128); string(r.continuationRunId,128); string(r.responseId,128);
  requireFact(r.threadId.length>0 && r.seedRunId.length>0 && r.continuationRunId.length>0 && r.responseId.length>0,'Empty identity');
  return Object.freeze({threadId:r.threadId,seedRunId:r.seedRunId,continuationRunId:r.continuationRunId,responseId:r.responseId});
}
function message(value: unknown, maxContent = MAX_CONTENT): HistoryMessage {
  const r = record(value);
  requireFact(Reflect.ownKeys(r).length === 3 && ['id','role','content'].every(k => Object.hasOwn(r,k)), 'History requires exactly id/role/content');
  string(r.id,128); requireFact(r.id.length > 0,'Empty ID'); string(r.content,maxContent);
  requireFact(r.role === 'user' || r.role === 'assistant','History role');
  return Object.freeze({id:r.id,role:r.role,content:r.content});
}
export function ownHistory(value: unknown): readonly HistoryMessage[] {
  requireFact(Array.isArray(value) && value.length > 0 && value.length <= MAX_HISTORY,'Full bounded history required');
  const seen = new Set<string>();
  const owned: HistoryMessage[]=[];
  for(let i=0;i<value.length;i++) {
    const descriptor=Object.getOwnPropertyDescriptor(value,String(i));
    requireFact(descriptor && 'value' in descriptor,'Missing history element or accessor');
    const m=message(descriptor.value); requireFact(!seen.has(m.id),'Duplicate history ID'); seen.add(m.id); owned.push(m);
  }
  return Object.freeze(owned);
}
function arrayItem(value: readonly unknown[], index: number): unknown {
  const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
  requireFact(descriptor && 'value' in descriptor,'Missing array element or accessor');
  return descriptor.value;
}
function exactHistory(value: unknown, expected: readonly HistoryMessage[], hasResponse = false): void {
  requireFact(Array.isArray(value) && value.length === expected.length + (hasResponse ? 1 : 0),'History length mismatch');
  for(let i=0;i<expected.length;i++) {
    const actual=message(arrayItem(value,i)); const target=expected[i];
    requireFact(target && actual.id===target.id && actual.role===target.role && actual.content===target.content,'History mismatch');
  }
}
// Bounds are checked while walking, before serialization or metadata retention.
function boundedMetadata(value: unknown): void {
  let budget=4096; let nodes=0; const seen=new Set<object>();
  function visit(v: unknown, depth: number): void {
    requireFact(depth<=8 && ++nodes<=256,'Metadata structure bound');
    // A JSON escape may consume six bytes per UTF-16 code unit.
    if(typeof v==='string') budget-=v.length*6+2;
    else if(v===null || typeof v==='boolean') budget-=5;
    else if(typeof v==='number') { requireFact(Number.isFinite(v),'Metadata number'); budget-=24; }
    else {
      requireFact(typeof v==='object' && v!==null && !seen.has(v),'Metadata must be acyclic JSON'); seen.add(v);
      if(Array.isArray(v)) {
        requireFact(v.length<=256 && Object.getPrototypeOf(v)===Array.prototype && Reflect.ownKeys(v).length===v.length+1,'Metadata array shape/bound');
        budget-=2+Math.max(0,v.length-1);
        for(let i=0;i<v.length;i++) visit(arrayItem(v,i),depth+1);
      }
      else { const r=record(v); budget-=2; requireFact(Reflect.ownKeys(r).length<=64,'Metadata keys bound'); for(const key of Reflect.ownKeys(r)) { requireFact(typeof key==='string','Metadata symbol'); budget-=key.length*6+4; visit(r[key],depth+1); } }
    }
    requireFact(budget>=0,'Metadata byte budget');
  }
  visit(value,0);
}
export function validateResponse(value: unknown, expected: HistoryMessage): void {
  const canonical=message(expected,6400);
  const r=record(value);
  requireFact(canonical.role==='assistant' && r.id===canonical.id && r.role==='assistant' && r.content===canonical.content,'Assistant projection mismatch');
  // Public AG-UI AssistantMessage fields: this canonical text response admits no tool calls.
  const keys=new Set(['id','role','content','metadata','name','encryptedValue','subagentRunId']);
  const extras: Record<string,unknown>={};
  for(const key of Reflect.ownKeys(r)) {
    requireFact(typeof key==='string' && keys.has(key),'Unknown assistant field');
    if(key!=='id' && key!=='role' && key!=='content') {
      if(key!=='metadata') string(r[key],512);
      else record(r[key]);
      extras[key]=r[key];
    }
  }
  boundedMetadata(extras);
}

/** One future reviewed application/store domain must own this controller. Creating
 * this object does not establish actual process-global exclusivity. Runtime
 * allocation/import graph review and hosted receipts must establish that fact. */
export function createStoreDomain() {
  let occupied=false;
  return {
    beginCase(identity: CaseIds, history: unknown, threadsBeforeSeed: readonly unknown[]) {
      requireFact(!occupied,'Previous case not fully disposed');
      requireFact(threadsBeforeSeed.length===0,'Unexpected global store; do not clear');
      const h=ownHistory(history); const ids=ownIds(identity);
      requireFact(ids.seedRunId!==ids.continuationRunId && !h.some(m=>m.id===ids.responseId),'Conflicting identities');
      occupied=true;
      let closed=false, disposed=false, seed=false, committed=false, mount=false, mounted=false, continuation=false;
      let continuationSettled=false;
      let idle=false, clearStarted=false, cleared=false, postEmpty=false;
      const pending=new Set<object>();
      const disposals=new Set<object>();
      const disposalKinds=new Set<OperationKind>();
      function open() { requireFact(!closed && !disposed,'Admission closed'); }
      function request(value: RunRequest, runId: string): RunRequest {
        const r=record(value);
        requireFact(Reflect.ownKeys(r).length===3 && ['threadId','runId','messages'].every(key=>Object.hasOwn(r,key)),'Exactly three run envelope fields required');
        string(r.threadId,128); string(r.runId,128);
        requireFact(r.threadId===ids.threadId && r.runId===runId,'Wrong admitted identity');
        // The future SDK bridge must explicitly project its input into this envelope.
        return Object.freeze({threadId:r.threadId,runId:r.runId,messages:r.messages});
      }
      return {
        admitSeed<T>(r: RunRequest, allocate: (request: OwnedRunRequest) => T): T {
          open(); requireFact(!seed,'Seed already admitted'); const admitted=request(r,ids.seedRunId);
          requireFact(Array.isArray(admitted.messages) && admitted.messages.length===0,'Seed input must be empty');
          seed=true; idle=false; return allocate(Object.freeze({threadId:ids.threadId,runId:ids.seedRunId,messages:Object.freeze([])}));
        },
        observeSeed(receipt: SeedReceipt) {
          requireFact(!disposed && seed && !committed,'Seed receipt not admissible');
          requireFact(receipt.terminalSuccess && receipt.eof && receipt.bridgeSettled && receipt.publicSettled && receipt.idle,'Original seed not settled');
          exactHistory(receipt.messages,h); committed=true; idle=true;
        },
        admitMount() { open(); requireFact(committed && !mount,'Seed commitment required'); mount=true; },
        observeMounted(receipt: MountedReceipt) {
          open(); requireFact(mount && !mounted && receipt.idle && receipt.error===null,'Mounted idle/error gate');
          exactHistory(receipt.messages,h); mounted=true;
        },
        admitContinuation<T>(r: RunRequest, allocate: (request: OwnedRunRequest) => T): T {
          open(); requireFact(mounted && !continuation,'Independent mounted H and once-only continuation required');
          const admitted=request(r,ids.continuationRunId); exactHistory(admitted.messages,h); continuation=true; idle=false;
          return allocate(Object.freeze({threadId:ids.threadId,runId:ids.continuationRunId,messages:h}));
        },
        observeContinuation(receipt: SeedReceipt & { producerSettled: boolean; readerSettled: boolean }, expected: HistoryMessage) {
          requireFact(!disposed && continuation && !continuationSettled,'Continuation receipt not admissible');
          requireFact(receipt.terminalSuccess && receipt.eof && receipt.bridgeSettled && receipt.publicSettled && receipt.producerSettled && receipt.readerSettled && receipt.idle,'Original continuation not settled');
          const canonical=message(expected,6400);
          requireFact(canonical.id===ids.responseId,'Wrong response identity');
          requireFact(Array.isArray(receipt.messages) && receipt.messages.length===h.length+1,'Final transcript length');
          exactHistory(receipt.messages,h,true); validateResponse(arrayItem(receipt.messages,h.length),canonical);
          continuationSettled=true; idle=true;
        },
        ownOperation(kind: OperationKind) {
          open(); const token={};
          const isDisposal=kind==='server-disposal' || kind==='harness-disposal';
          if(isDisposal) { requireFact(!disposalKinds.has(kind),'Disposal already owned'); disposalKinds.add(kind); }
          const operations=isDisposal ? disposals : pending;
          requireFact(operations.size<32,'Owned operation bound'); operations.add(token);
          return Object.freeze({settle() { requireFact(operations.delete(token),'Original operation already settled'); }});
        },
        closeAdmission() { requireFact(!disposed,'Already disposed'); closed=true; },
        observeIdle(value: boolean) { requireFact(!disposed,'Already disposed'); idle=value; },
        clearStore(clear: () => void | Promise<void>): void | Promise<void> {
          requireFact(closed && !disposed && idle && pending.size===0 && disposalKinds.size===2 && (!seed || committed) && (!continuation || continuationSettled) && !clearStarted,'Complete owned settlement required for global clear');
          clearStarted=true;
          const result=clear();
          if(result) return result.then(()=> {cleared=true;});
          cleared=true;
        },
        observeEmptyAfterClear(threads: readonly unknown[]) { requireFact(cleared && !disposed && threads.length===0,'Post-clear public empty store required'); postEmpty=true; },
        finishDisposal() { requireFact(closed && cleared && postEmpty && pending.size===0 && disposals.size===0 && disposalKinds.size===2 && !disposed,'Complete cleanup required'); disposed=true; occupied=false; },
      };
    },
  };
}
