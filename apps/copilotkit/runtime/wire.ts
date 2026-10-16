import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { EventSchema } from '@ag-ui/core/schemas';
import { EventEncoder } from '@ag-ui/encoder';
import type { ReplayEvent } from '../../../packages/contract/src/fixture.js';
import { parseReplaySse } from '../../threadplane/src/sse.js';
import type { CaseIds } from '../src/controls.js';
import type { LongThreadFixture } from '../../../packages/contract/src/long-thread.js';
import {compileCanonicalHistoryRestoreFixture,compileCanonicalLongThreadFixture} from '../../../tests/fixtures/aimock.js';
import {findFixture,matchesFixture} from '@copilotkit/aimock/agui';
import {createFixtureSelection,type FixtureSelection,type ContinuationFixtureReader,type SelectedFixtureEvent} from './fixture-selection.js';

export const MAX_REQUEST_BYTES=128*1024;
export const MAX_NATIVE_BYTES=512*1024;
/** Actual public AIMock data compilation/matching; no mock HTTP server or no-op
 * registration. Synthetic epoch is fixture provenance, never producer pacing. */
export function createNativeFixtureSelection(fixture:LongThreadFixture,ids:CaseIds):FixtureSelection {
  const seed=compileCanonicalHistoryRestoreFixture(fixture,{threadId:ids.threadId,runId:ids.seedRunId,epochMs:0});
  const continuation=compileCanonicalLongThreadFixture(fixture,{threadId:ids.threadId,runId:ids.continuationRunId,epochMs:0});
  return createFixtureSelection({threadId:ids.threadId,seedRunId:ids.seedRunId,continuationRunId:ids.continuationRunId,
    history:fixture.history.map(m=>({id:m.id,role:m.role,content:m.text})),events:fixture.events,epochMs:0},
    {seed:seed.fixture,continuation:continuation.fixture},{findFixture,matchesFixture});
}
function nativeEvents(events:readonly SelectedFixtureEvent[]):BaseEvent[] {
  return events.map(event=>({...event,type:EventSchema.parse(event).type}));
}
export function seedEvents(selection:FixtureSelection,input:RunAgentInput):BaseEvent[] {
  return nativeEvents(selection.seed(input));
}
export function translateReplay(selection:ContinuationFixtureReader,event:ReplayEvent):BaseEvent[] {
  return nativeEvents(selection.next(event));
}
export async function readBoundedJson(request: Request): Promise<unknown> {
  if(!request.body) throw new Error('Missing owned JSON request');
  const reader=request.body.getReader(); const decoder=new TextDecoder('utf-8',{fatal:true}); let total=0,text='';
  let cancellation:Promise<void>|undefined;
  const abort=()=> {cancellation=reader.cancel(request.signal.reason);};
  request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted) abort();
  try { while(true) { request.signal.throwIfAborted();const item=await reader.read();request.signal.throwIfAborted();if(item.done) break; total+=item.value.byteLength; if(total>MAX_REQUEST_BYTES) throw new Error('Request byte bound exceeded'); text+=decoder.decode(item.value,{stream:true}); } text+=decoder.decode(); return JSON.parse(text); }
  finally { request.signal.removeEventListener('abort',abort);await (cancellation??reader.cancel()); reader.releaseLock(); }
}
/** The producer decoder requires its actual EOF before yielding completion. */
export function producerEvents(chunks: AsyncIterable<Uint8Array>, receipt: (event: ReplayEvent)=>void): AsyncGenerator<ReplayEvent> {
  return parseReplaySse(chunks,receipt);
}
export async function* boundedChunks(reader: ReadableStreamDefaultReader<Uint8Array>,onEof: ()=>void,signal: AbortSignal): AsyncGenerator<Uint8Array> {
  let bytes=0;
  while(true) { signal.throwIfAborted(); const item=await reader.read(); if(item.done) {onEof();return;} bytes+=item.value.byteLength; if(bytes>MAX_NATIVE_BYTES) throw new Error('Owned stream byte bound exceeded'); yield item.value; }
}
/** Seed client consumes the original native HTTP body completely, independently
 * of the runner's public observable completion and bridge task outcomes. */
export async function consumeNativeSeed(response: Response,threadId: string,runId: string): Promise<{eof:true;terminalSuccess:true;events:number}> {
  const encoder=new EventEncoder({accept:'text/event-stream'});
  if(!response.ok || !response.body || !response.headers.get('content-type')?.startsWith(encoder.getContentType().split(';')[0]??'text/event-stream')) throw new Error('Invalid native seed response');
  const reader=response.body.getReader(); const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,buffer='',count=0,finished=false;
  function frame(value: string) {
    const data=value.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
    if(!data) return;
    const event=EventSchema.parse(JSON.parse(data));
    if(finished || ++count>3) throw new Error('Unexpected seed lifecycle');
    if(count===1 && (event.type!==EventType.RUN_STARTED || event.threadId!==threadId || event.runId!==runId)) throw new Error('Wrong seed run start');
    if(count===2 && event.type!==EventType.MESSAGES_SNAPSHOT) throw new Error('Missing seed snapshot');
    if(count===3) { if(event.type!==EventType.RUN_FINISHED || event.threadId!==threadId || event.runId!==runId || event.outcome?.type!=='success') throw new Error('Wrong seed terminal'); finished=true; }
  }
  try {
    while(true) {
      const item=await reader.read(); if(item.done) break;
      bytes+=item.value.byteLength;if(bytes>MAX_NATIVE_BYTES) throw new Error('Seed byte bound exceeded');
      buffer+=decoder.decode(item.value,{stream:true}); let delimiter: RegExpExecArray|null;
      while((delimiter=/\r?\n\r?\n/.exec(buffer))!==null) { frame(buffer.slice(0,delimiter.index));buffer=buffer.slice(delimiter.index+delimiter[0].length); }
    }
    buffer+=decoder.decode(); if(buffer.trim() || !finished || count!==3) throw new Error('Incomplete original seed EOF');
    return {eof:true,terminalSuccess:true,events:count};
  } finally { await reader.cancel();reader.releaseLock(); }
}
export function isSuccessfulTerminal(event: BaseEvent): boolean {
  return event.type===EventType.RUN_FINISHED && 'outcome' in event && typeof event.outcome==='object' && event.outcome!==null && 'type' in event.outcome && event.outcome.type==='success';
}
