import {comparisonObservationSchema,comparisonExceptionEntrySchema,comparisonBoundedBufferSchema} from '@chat-ui-bench/contract';
import type {ComparisonRuntimeIdentity as ComparisonIdentity} from './comparison-runtime-family.js';
import type {ComparisonOwnershipClock} from './comparison-ownership.js';
import type {ComparisonSlotContext} from './long-thread-run.js';
import type {DrainedPageEntry, PreNavigationTransferState} from './comparison-observations.js';
import type {LongThreadReplayServer} from '@chat-ui-bench/producer';
export interface ComparisonJournalPageSource {
  drain(maxEntries:number):Promise<readonly DrainedPageEntry[]>;
  transferPreNavigation(maxEntries:number):Promise<PreNavigationTransferState>;
  readPreNavigationTransfer():Promise<PreNavigationTransferState>;
  drainPreNavigation(maxEntries:number):Promise<readonly string[]>;
}
export interface ComparisonCaptureJournalOptions {identity:ComparisonIdentity;clock?:ComparisonOwnershipClock}
export interface ComparisonJournalStageOptions {context:ComparisonSlotContext;page:ComparisonJournalPageSource;producer:Pick<LongThreadReplayServer,'state'|'drain'>}
export interface ComparisonJournalSnapshot {pageRecords:number;producerRecords:number;serializedBytes:number;pageSerializedBytes:number;producerSerializedBytes:number;reasons:string[];transfer?:PreNavigationTransferState}
export interface ComparisonJournalTerminalSnapshot extends ComparisonJournalSnapshot {pageEmpty:boolean;producerEmpty:boolean}
export interface ComparisonCaptureJournal {
  startStage(options:ComparisonJournalStageOptions):Promise<void>;
  pauseStage():Promise<void>;
  finishStage():Promise<ComparisonJournalTerminalSnapshot>;
  snapshot():ComparisonJournalSnapshot;
  close():Promise<void>;
}
export function createComparisonCaptureJournal(options:ComparisonCaptureJournalOptions):ComparisonCaptureJournal {
  let stage:ComparisonJournalStageOptions|undefined,closed=false,periodic=false,failed=false;
  let pageTimer:ReturnType<typeof setTimeout>|undefined,producerTimer:ReturnType<typeof setTimeout>|undefined;
  let pageCycle:Promise<void>|undefined,producerCycle:Promise<void>|undefined,terminal:Promise<ComparisonJournalTerminalSnapshot>|undefined;
  let pageRecords=0,producerRecords=0,serializedBytes=0,pageEmpty=false,producerEmpty=false;
  let pageSerializedBytes=0,producerSerializedBytes=0;
  let transfer:PreNavigationTransferState|undefined;
  const reasons:string[]=[],operations=new Set<Promise<unknown>>();
  let writerTail:Promise<void>=Promise.resolve();
  let closePromise:Promise<void>|undefined;
  let terminalCancelled=false;
  const setTimer=options.clock?.setTimer??setTimeout,clearTimer=options.clock?.clearTimer??clearTimeout;
  const snapshot=():ComparisonJournalSnapshot=>({pageRecords,producerRecords,serializedBytes,pageSerializedBytes,producerSerializedBytes,reasons:[...reasons],...(transfer?{transfer:structuredClone(transfer)}:{})});
  function failure(error:unknown){failed=true;if(reasons.length<32)reasons.push((error instanceof Error?error.message:String(error)).slice(0,4096)||'Journal operation failed');}
  function active(){if(closed||!stage)throw new Error('Journal admission closed');stage.context.ownership.assertActive();}
  function terminalActive(){active();if(terminalCancelled)throw new Error('Terminal journal admission paused');}
  function transferSnapshot(value:unknown):PreNavigationTransferState {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid transfer result');
    const row=value as Record<string,unknown>,keys=['sourceFinal','attempted','accepted','rejected','failureReason','remainingEntries','remainingSerializedBytes','complete'];
    if(Object.keys(row).length!==8||keys.some(key=>!Object.hasOwn(row,key))||['attempted','accepted','rejected','remainingEntries','remainingSerializedBytes'].some(key=>!Number.isSafeInteger(row[key])||(row[key] as number)<0)||typeof row.complete!=='boolean'||row.failureReason!==null&&(typeof row.failureReason!=='string'||row.failureReason.length>4096)||(row.remainingEntries as number)>4096||(row.remainingSerializedBytes as number)>16777216||(row.attempted as number)!==(row.accepted as number)+(row.rejected as number))throw new Error('Invalid bounded transfer result');
    let sourceFinal:PreNavigationTransferState['sourceFinal']=null;
    if(row.sourceFinal!==null){
      if(!row.sourceFinal||typeof row.sourceFinal!=='object'||Array.isArray(row.sourceFinal))throw new Error('Invalid transfer source state');
      const source=row.sourceFinal as Record<string,unknown>;
      if(!Number.isSafeInteger(source.pendingEntries)||(source.pendingEntries as number)<0||(source.pendingEntries as number)>4096||!Number.isSafeInteger(source.pendingSerializedBytes)||(source.pendingSerializedBytes as number)<0||(source.pendingSerializedBytes as number)>16777216)throw new Error('Invalid transfer source pending state');
      const {pendingEntries,pendingSerializedBytes,...buffer}=source;
      const parsed=comparisonBoundedBufferSchema.parse(buffer);if(parsed.name!=='pre-navigation-errors')throw new Error('Invalid transfer source cohort');
      const {reason,...facts}=parsed;sourceFinal={...facts,pendingEntries:pendingEntries as number,pendingSerializedBytes:pendingSerializedBytes as number,...(reason===undefined?{}:{reason})};
    }
    return {sourceFinal,attempted:row.attempted as number,accepted:row.accepted as number,rejected:row.rejected as number,failureReason:row.failureReason as string|null,remainingEntries:row.remainingEntries as number,remainingSerializedBytes:row.remainingSerializedBytes as number,complete:row.complete};
  }
  function track<T>(task:Promise<T>):Promise<T>{operations.add(task);void task.then(()=>operations.delete(task),()=>operations.delete(task));return task;}
  function freeze(){periodic=false;if(pageTimer!==undefined)clearTimer(pageTimer);if(producerTimer!==undefined)clearTimer(producerTimer);pageTimer=producerTimer=undefined;}
  async function settled(){while(operations.size)await Promise.allSettled([...operations]);}
  function validate(serialized:unknown,cohort:'observation'|'exception',producer=false):string {
    if(typeof serialized!=='string'||serialized.length>4194304||Buffer.byteLength(serialized)>4194304||/[\r\n]/.test(serialized))throw new Error('Invalid bounded original journal string');
    const value:unknown=JSON.parse(serialized);
    if(cohort==='exception'){
      const record=comparisonExceptionEntrySchema.parse(value);
      if(!['page','console'].includes(record.source)||record.clockDomain!=='page-performance-ms'||record.stage!=='setup'&&record.stage!=='replay'||stage?.context.ownership.stage==='setup'&&record.stage!=='setup')throw new Error('Invalid page exception source, stage or clock');
    }else{
      const record=comparisonObservationSchema.parse(value);
      if(record.repetition!==options.identity.repetition||record.clockDomain!==(producer?'producer-monotonic-ms':'page-performance-ms'))throw new Error('Journal identity or clock differs');
      if(producer&&!['producer-emission','producer-failure'].includes(record.kind))throw new Error('Invalid producer record kind');
    }
    return serialized;
  }
  async function persist(path:string,records:readonly string[],producer=false){
    // Exactly two source controllers can wait for this lane, each retains one bounded batch.
    const prior=writerTail;let release!:()=>void;writerTail=new Promise<void>(resolve=>{release=resolve;});
    try{await prior;active();for(let offset=0;offset<records.length;){let bytes=0;const slice:string[]=[];
      while(offset<records.length&&slice.length<64){const text=records[offset]!,size=Buffer.byteLength(text)+1;if(bytes+size>16777216)break;slice.push(text);bytes+=size;offset++;}
      if(!slice.length)throw new Error('Journal slice exceeds append capacity');
      active();await track(producer?stage!.context.writer.append(path,slice.map(text=>JSON.parse(text) as unknown)):stage!.context.writer.appendSerialized(path,slice));active();
      serializedBytes+=bytes-slice.length;if(producer){producerRecords+=slice.length;producerSerializedBytes+=bytes-slice.length;}else{pageRecords+=slice.length;pageSerializedBytes+=bytes-slice.length;}
    }}finally{release();}
  }
  async function pageDrain(terminalWork=false):Promise<number>{if(terminalWork)terminalActive();else active();const result:unknown=await track(stage!.page.drain(64));active();
    if(!Array.isArray(result)||result.length>64)throw new Error('Invalid mixed page batch');
    let path='',records:string[]=[];
    for(const entry of result){if(!entry||typeof entry!=='object'||Object.keys(entry).length!==2||!['observation','exception'].includes(entry.cohort))throw new Error('Invalid mixed page cohort');
      const next=entry.cohort==='exception'?'page-exceptions.jsonl':'page.jsonl',text=validate(entry.serialized,entry.cohort);
      if(path&&next!==path){await persist(path,records);records=[];}path=next;records.push(text);
    }if(records.length)await persist(path,records);return result.length;
  }
  async function producerDrain(terminalWork=false):Promise<number>{if(terminalWork)terminalActive();else active();const result:unknown=stage!.producer.drain();
    if(!Array.isArray(result)||result.length>203)throw new Error('Invalid finite producer batch');
    const records=result.map(record=>validate(JSON.stringify(record),'observation',true));
    if(records.length)await persist('producer.jsonl',records,true);return records.length;
  }
  function pumpPage(){if(!periodic||failed||closed)return;pageCycle=(async()=>{try{await pageDrain();if(periodic&&transfer&&!transfer.complete&&!transfer.failureReason&&!transfer.rejected){active();transfer=transferSnapshot(await track(stage!.page.transferPreNavigation(64)));active();if(transfer.failureReason&&reasons.length<32)reasons.push(transfer.failureReason.slice(0,4096));}}catch(error){failure(error);}finally{if(periodic&&!failed&&!closed)pageTimer=setTimer(pumpPage,50);}})();void pageCycle.catch(failure);}
  function pumpProducer(){if(!periodic||failed||closed)return;producerCycle=(async()=>{try{await producerDrain();}catch(error){failure(error);}finally{if(periodic&&!failed&&!closed)producerTimer=setTimer(pumpProducer,50);}})();void producerCycle.catch(failure);}
  async function pauseStage(){freeze();terminalCancelled=true;await Promise.allSettled([pageCycle,producerCycle]);await settled();}
  function close():Promise<void>{if(closePromise)return closePromise;freeze();closed=true;closePromise=(async()=>{await Promise.allSettled([pageCycle,producerCycle]);await settled();})();return closePromise;}
  function finishStage():Promise<ComparisonJournalTerminalSnapshot>{
    if(terminal)return terminal;freeze();terminalCancelled=false;
    terminal=(async()=>{await Promise.allSettled([pageCycle,producerCycle]);await settled();
      if(terminalCancelled)failure('Terminal journal admission paused');
      if(!failed&&!closed){try{
        terminalActive();transfer=transferSnapshot(await track(stage!.page.readPreNavigationTransfer()));active();
        for(let count=0;count<65&&!transfer.complete&&!transfer.failureReason;count++){
          await pageDrain(true);terminalActive();transfer=transferSnapshot(await track(stage!.page.transferPreNavigation(64)));active();
        }
        if(transfer.failureReason||transfer.rejected){failure(transfer.failureReason??'Pre-navigation transfer rejected');
          for(let count=0;count<65;count++){terminalActive();const leftovers=await track(stage!.page.drainPreNavigation(64));active();if(!Array.isArray(leftovers)||leftovers.length>64)throw new Error('Invalid pre-navigation leftovers');if(!leftovers.length)break;await persist('page-exceptions.jsonl',leftovers.map(text=>validate(text,'exception')));}
          terminalActive();transfer=transferSnapshot(await track(stage!.page.readPreNavigationTransfer()));active();
        }else if(!transfer.complete)failure('Pre-navigation transfer did not complete within finite bound');
        for(let count=0;count<65;count++){if(await pageDrain(true)===0){pageEmpty=true;break;}}
        if(!pageEmpty)failure('Stopped page queue not empty within finite bound');
        if(stage!.producer.state==='complete'||stage!.producer.state==='failed')producerEmpty=await producerDrain(true)===0||(await producerDrain(true)===0);
        if(!producerEmpty)failure('Producer terminal collection unavailable');
      }catch(error){failure(error);}}
      return {...snapshot(),pageEmpty,producerEmpty};})();void terminal.catch(failure);return terminal;
  }
  return {async startStage(next){if(closed||periodic||operations.size||pageCycle||producerCycle)throw new Error('Journal stage is not settled');next.context.ownership.assertActive();stage=next;terminal=undefined;pageEmpty=producerEmpty=false;
      await next.context.ownership.adopt({name:'journal-underlying-settlement',close});
      next.context.ownership.signal.addEventListener('abort',freeze,{once:true});
      active();transfer=transferSnapshot(await track(next.page.readPreNavigationTransfer()));active();
      if(transfer.failureReason&&reasons.length<32)reasons.push(transfer.failureReason.slice(0,4096));
      else if(transfer.rejected&&reasons.length<32)reasons.push('Pre-navigation transfer rejected');
      if(transfer.sourceFinal?.status==='partial'&&reasons.length<32)reasons.push((transfer.sourceFinal.reason??'Pre-navigation source loss').slice(0,4096));
      periodic=true;pumpPage();pumpProducer();},
    async pauseStage(){await pauseStage();pageCycle=producerCycle=undefined;},finishStage,snapshot,
    close};
}
