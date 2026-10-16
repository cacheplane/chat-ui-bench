import { createServer, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { AbstractAgent, type RunAgentInput } from '@ag-ui/client';
import type { BaseEvent } from '@ag-ui/core';
import { Observable } from 'rxjs';
import { startLongThreadReplay, type LongThreadReplaySession } from '../../../packages/producer/src/replay.js';
import type { LongThreadFixture } from '../../../packages/contract/src/long-thread.js';
import type { ComparisonObservation } from '../../../packages/contract/src/comparison.js';
import type { HistoryMessage, CaseIds } from '../src/controls.js';
import { AGENT_ID } from '../src/context.js';
import { boundedChunks, producerEvents, seedEvents, translateReplay } from './wire.js';
import type { FixtureSelection } from './fixture-selection.js';
import { OwnedOperations, boundedWait, diagnostic } from './ownership.js';

export interface BridgeSpec {
  readonly fixture: LongThreadFixture;
  readonly ids: CaseIds;
  readonly history: readonly HistoryMessage[];
  readonly response: HistoryMessage;
  readonly repetition: string;
  readonly fixtureSelection: FixtureSelection;
}
interface ProducerCompletion { readonly complete: boolean;readonly error: string|null }
interface OwnedProducer {
  readonly url: string;
  readonly writes: Promise<ProducerCompletion>;
  readonly state: string;
  readonly drains: number;
  readonly records: readonly ComparisonObservation[];
  close(): Promise<void>;
}

/** The existing independently timed producer writes its real HTTP response.
 * Its scheduling/emission clock is separate from bridge receipt observations.
 * This explicit allocator is never called by seed and has no module-level listener. */
async function createOwnedProducer(spec: BridgeSpec): Promise<OwnedProducer> {
  let session: LongThreadReplaySession|undefined,response: ServerResponse|undefined,connected=false,finished=false,drains=0;
  let closePromise: Promise<void>|undefined;
  const records: ComparisonObservation[]=[];
  let resolveWrites: (value: ProducerCompletion)=>void = ()=> {throw new Error('Producer completion not initialized');};
  const writes=new Promise<ProducerCompletion>(resolve=> {resolveWrites=resolve;});
  const server=createServer((request,res)=> {
    if(request.method!=='GET' || request.url!=='/replay') {res.writeHead(404);res.end();return;}
    if(connected) {res.writeHead(409);res.end();return;}
    connected=true;response=res;
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','connection':'keep-alive'});res.flushHeaders();
    res.on('drain',()=> {drains++;});
    res.once('finish',()=> {finished=true;resolveWrites({complete:session?.state==='complete',error:session?.state==='complete'?null:'Producer finished without successful original lifecycle'});});
    res.once('close',()=> {if(!finished) {session?.disconnect();resolveWrites({complete:false,error:'Original producer response closed before finish'});}});
    session=startLongThreadReplay(spec.fixture,{repetition:spec.repetition,writer:{write:frame=>res.write(frame),end:()=>res.end()},record:record=> {
      if(records.length>=204) throw new Error('Producer evidence bound exceeded');
      records.push(record);
    }});
  });
  await new Promise<void>((resolve,reject)=> {server.once('error',reject);server.listen(0,'127.0.0.1',()=> {server.off('error',reject);resolve();});});
  const address=server.address();if(!address || typeof address==='string') throw new Error('Expected owned loopback producer address');
  return {url:`http://127.0.0.1:${address.port}/replay`,writes,get state(){return session?.state??'waiting';},get drains(){return drains;},get records(){return records;},
    close() {
      if(closePromise) return closePromise;
      closePromise=(async()=> {
        session?.dispose();if(!finished) response?.destroy();server.closeAllConnections();
        await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
        if(!connected) resolveWrites({complete:false,error:'Owned producer never connected'});
      })();return closePromise;
    }};
}

export interface BridgeRunReceipt {
  readonly runId: string;
  readonly successful: boolean;
  readonly eof: boolean;
  readonly producerSettled: boolean;
  readonly readerSettled: boolean;
  readonly eventCount: number;
  readonly deltaCount: number;
  readonly responseBytes: number;
  readonly producerDrains: number;
}

/** No connect override: native SSE uses the public runner's committed replay.
 * Clone keeps the same owned case/operation domain without copying SDK fields. */
export class ProducerAgent extends AbstractAgent {
  private readonly receipts=new Map<string,BridgeRunReceipt>();
  private readonly cancellations=new Map<string,AbortController>();
  private readonly producerRecords: ComparisonObservation[]=[];
  private readonly receiptTimes: {sequence:number;receivedMs:number;clockDomain:'bridge-monotonic-ms'}[]=[];
  constructor(private readonly spec: BridgeSpec,private readonly operations: OwnedOperations,
    private readonly admittedRun: (input:RunAgentInput)=>void,
    private readonly shared: {receipts:Map<string,BridgeRunReceipt>;cancellations:Map<string,AbortController>;producerRecords:ComparisonObservation[];receiptTimes:{sequence:number;receivedMs:number;clockDomain:'bridge-monotonic-ms'}[]} | undefined=undefined) {
    super({agentId:AGENT_ID,description:'Owned canonical independent producer bridge'});
    if(shared) {this.receipts=shared.receipts;this.cancellations=shared.cancellations;this.producerRecords=shared.producerRecords;this.receiptTimes=shared.receiptTimes;}
  }
  override clone(): ProducerAgent {
    return new ProducerAgent(this.spec,this.operations,this.admittedRun,{receipts:this.receipts,cancellations:this.cancellations,producerRecords:this.producerRecords,receiptTimes:this.receiptTimes});
  }
  override run(input: RunAgentInput): Observable<BaseEvent> {
    this.admittedRun(input);
    return new Observable<BaseEvent>(subscriber=> {
      const cancellation=new AbortController();this.cancellations.set(input.runId,cancellation);
      const original=this.operations.run('bridge',`bridge:${input.runId}`,async()=> {
        let eof=false,producerSettled=false,readerSettled=false,eventCount=0,deltaCount=0,responseBytes=0,producerDrains=0;
        let producer: OwnedProducer|undefined,reader: ReadableStreamDefaultReader<Uint8Array>|undefined;
        const emit=(event:BaseEvent)=> {if(++eventCount>204) throw new Error('Translated event bound exceeded');subscriber.next(event);};
        try {
          if(input.runId===this.spec.ids.seedRunId) {
            for(const event of seedEvents(this.spec.fixtureSelection,input)) emit(event);
            eof=true;producerSettled=true;readerSettled=true;
          } else {
            const selected=this.spec.fixtureSelection.continuation(input);
            // Allocation occurs only after the runner admitted unchanged full H.
            producer=await createOwnedProducer(this.spec);
            const producerOperation=this.operations.start('producer','original-producer',()=>producer?.close()??Promise.resolve());
            const readerOperation=this.operations.start('reader','original-producer-reader',async()=> {await reader?.cancel();});
            try {
              const response=await fetch(producer.url,{signal:cancellation.signal});
              if(!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('text/event-stream')) throw new Error('Invalid owned producer response');
              reader=response.body.getReader();
              for await(const event of producerEvents(boundedChunks(reader,()=>{eof=true;},cancellation.signal),event=> {
                if(this.receiptTimes.length>=202) throw new Error('Receipt evidence bound exceeded');
                this.receiptTimes.push({sequence:event.sequence,receivedMs:performance.now(),clockDomain:'bridge-monotonic-ms'});
              })) {
                const expected=this.spec.fixture.events[event.sequence];
                if(!expected || event.sequence!==expected.sequence || event.type!==expected.type || event.messageId!==expected.messageId || event.scheduledMs!==expected.scheduledMs || event.text!==expected.text) throw new Error('Original producer differs from canonical event');
                if(event.type==='text-delta') {deltaCount++;responseBytes+=new TextEncoder().encode(event.text).byteLength;}
                for(const translated of translateReplay(selected,event)) emit(translated);
              }
              selected.complete();
              const writes=await boundedWait(producer.writes,10000,'Original producer finish');
              if(!writes.complete || producer.state!=='complete' || !eof || deltaCount!==200 || responseBytes!==6400 || eventCount!==204) throw new Error(writes.error??'Incomplete canonical producer receipt');
              await reader.cancel();reader.releaseLock();reader=undefined;readerSettled=true;readerOperation.succeed();
              await producer.close();producerSettled=true;producerOperation.succeed();producerDrains=producer.drains;
              if(producer.records.length!==202 || this.producerRecords.length!==0) throw new Error('Original producer emission record count mismatch');
              this.producerRecords.push(...producer.records);
            } catch(error) {
              if(!readerOperation.settled) readerOperation.fail(error);
              if(!producerOperation.settled) producerOperation.fail(error);
              throw error;
            }
          }
          this.receipts.set(input.runId,{runId:input.runId,successful:true,eof,producerSettled,readerSettled,eventCount,deltaCount,responseBytes,producerDrains});
        } catch(error) {
          this.receipts.set(input.runId,{runId:input.runId,successful:false,eof,producerSettled,readerSettled,eventCount,deltaCount,responseBytes,producerDrains});throw error;
        } finally {
          cancellation.abort();
          let cleanupFailed=false;
          if(reader) {try {await reader.cancel();}catch(error) {cleanupFailed=true;this.operations.cleanupFailure(error);}finally {reader.releaseLock();}}
          if(producer) {try {await producer.close();}catch(error) {cleanupFailed=true;this.operations.cleanupFailure(error);}}
          this.cancellations.delete(input.runId);
          if(cleanupFailed) throw new Error('Original bridge cleanup failed; case ownership retained');
        }
      },async()=> {cancellation.abort();});
      // Original remains owned by operations until its asynchronous finally closes
      // the reader and producer. Observable unsubscription only requests abort.
      original.then(()=>subscriber.complete(),error=>subscriber.error(error));
      return ()=> {cancellation.abort();};
    });
  }
  receipt(runId:string): BridgeRunReceipt|undefined {return this.receipts.get(runId);}
  cancelOwned(runId:string): void {this.cancellations.get(runId)?.abort();}
  evidence() {return {producer:[...this.producerRecords],receipts:[...this.receiptTimes]};}
}
