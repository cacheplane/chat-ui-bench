import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,test,vi} from 'vitest';
import {createLongThreadFixture,createComparisonBuffer,type ComparisonIdentity} from '@chat-ui-bench/contract';
import {ComparisonArtifactWriter,type ComparisonScopedWriter} from './comparison-artifacts.js';
import {ComparisonOwnership} from './comparison-ownership.js';
import {createComparisonCaptureJournal,type ComparisonJournalPageSource,type ComparisonJournalStageOptions} from './comparison-capture-journal.js';
const identity:ComparisonIdentity={schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',adapterProfile:'threadplane-angular',repetition:'r',scenarioId:'s',round:1,caseIndex:0};
const transfer={sourceFinal:null,attempted:0,accepted:0,rejected:0,failureReason:null,remainingEntries:0,remainingSerializedBytes:0,complete:true};
const exception=(message:string)=>JSON.stringify({source:'page',stage:'setup',clockDomain:'page-performance-ms',timestampMs:1,message,stack:null,severity:'error'});
async function fixture(body:(journal:ReturnType<typeof createComparisonCaptureJournal>,directory:string)=>Promise<void>,page:ComparisonJournalPageSource,producer:ComparisonJournalStageOptions['producer']={state:'waiting',drain:()=>[]},wrapWriter:(writer:ComparisonScopedWriter)=>ComparisonScopedWriter=writer=>writer){
 const directory=await mkdtemp(join(tmpdir(),'g-journal-')),writer=await ComparisonArtifactWriter.create(directory),owner=new ComparisonOwnership();let failed=false,error:unknown;
 try{
  const outcome=await owner.run('setup',async ownership=>{try{const journal=createComparisonCaptureJournal({identity});await journal.startStage({context:{identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:'runs/r'},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:wrapWriter(writer.scoped(()=>ownership.assertActive()))},page,producer});await body(journal,directory);await journal.pauseStage();}catch(value){failed=true;error=value;throw value;}});
  if(failed)throw error;expect(outcome.status).toBe('complete');
 }finally{await owner.dispose();await owner.ownershipSettled;await rm(directory,{recursive:true,force:true});}
}
test('persists original mixed page strings with Unicode and escapes',async()=>{
 const original=exception('🙂\\nquoted " text');let first=true;
 await fixture(async(journal,directory)=>{await journal.pauseStage();expect(await readFile(join(directory,'page-exceptions.jsonl'),'utf8')).toBe(original+'\n');expect(journal.snapshot().pageRecords).toBe(1);},{drain:async()=>first?(first=false,[{cohort:'exception',serialized:original}]):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('rejects a replay exception admitted during setup without persisting it',async()=>{
 const original=exception('wrong stage').replace('"setup"','"replay"');let first=true;
 await fixture(async(journal,directory)=>{await journal.pauseStage();expect(journal.snapshot().reasons.join(';')).toContain('stage');await expect(readFile(join(directory,'page-exceptions.jsonl'))).rejects.toThrow();},{drain:async()=>first?(first=false,[{cohort:'exception',serialized:original}]):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('retains the genuine implicit transfer snapshot during setup pause',async()=>{
 const actual={...transfer,attempted:64,accepted:63,rejected:1,failureReason:'record rejected',remainingEntries:4095,remainingSerializedBytes:10,complete:false};
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().transfer).toEqual(actual);},{drain:async()=>[],transferPreNavigation:async()=>actual,readPreNavigationTransfer:async()=>actual,drainPreNavigation:async()=>[]});
});
for(const patch of [{source:'runner'},{clockDomain:'host-monotonic-ms'},{extra:true}])test(`rejects strict page exception ${JSON.stringify(patch)}`,async()=>{
 const original=JSON.stringify({...JSON.parse(exception('strict')),...patch});let first=true;
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().reasons.length).toBeGreaterThan(0);expect(journal.snapshot().pageRecords).toBe(0);},{drain:async()=>first?(first=false,[{cohort:'exception',serialized:original}]):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('rejects 65 mixed entries before writer admission',async()=>{
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().pageRecords).toBe(0);expect(journal.snapshot().reasons.join(';')).toContain('batch');},{drain:async()=>Array.from({length:65},()=>({cohort:'exception',serialized:exception('x')})),transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('implicit transfer rejection remains partial after pause',async()=>{
 const actual={...transfer,rejected:1,attempted:1,failureReason:'rejected consumed record'};
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().reasons).toContain('rejected consumed record');},{drain:async()=>[],transferPreNavigation:async()=>actual,readPreNavigationTransfer:async()=>actual,drainPreNavigation:async()=>[]});
});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});void promise.catch(()=>{});return {promise,resolve};}
test('producer drain is independent of held page acquisition; pause waits genuine release',async()=>{
 const held=deferred<readonly []>(),observed=deferred<void>();let drains=0;
 try{await fixture(async journal=>{await observed.promise;expect(drains).toBe(1);let paused=false;const pause=journal.pauseStage().then(()=>{paused=true;});void pause.catch(()=>{});try{await Promise.resolve();expect(paused).toBe(false);held.resolve([]);await pause;expect(paused).toBe(true);}finally{held.resolve([]);await pause;}},{drain:()=>held.promise,transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]},{state:'complete',drain:()=>{drains++;observed.resolve();return [];}});}finally{held.resolve([]);}
});
test('terminal calls share one admission barrier and retain genuine empty collections',async()=>{
 let pageDrains=0,producerDrains=0;
 await fixture(async journal=>{const first=journal.finishStage(),second=journal.finishStage();expect(first).toBe(second);const result=await first;expect(result.pageEmpty).toBe(true);expect(result.producerEmpty).toBe(true);expect(result.reasons).toEqual([]);await journal.pauseStage();expect(pageDrains).toBe(2);expect(producerDrains).toBe(2);},{drain:async()=>{pageDrains++;return [];},transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]},{state:'complete',drain:()=>{producerDrains++;return [];}});
});
test('setup drains destination before transferring a genuine remainder and retains progress',async()=>{
 let transfers=0;const order:string[]=[];
 await fixture(async journal=>{await new Promise<void>(resolve=>setImmediate(resolve));await journal.pauseStage();expect(transfers).toBe(1);expect(order.slice(0,2)).toEqual(['drain','transfer']);expect(journal.snapshot().transfer?.complete).toBe(true);},{drain:async()=>{order.push('drain');return [];},transferPreNavigation:async size=>{expect(size).toBe(64);order.push('transfer');transfers++;return {...transfer,attempted:65,accepted:65};},readPreNavigationTransfer:async()=>({...transfer,remainingEntries:1,remainingSerializedBytes:1,complete:false}),drainPreNavigation:async()=>[]});
});
test('splits four exact 4MiB records because the 16MiB append cap includes LF bytes',async()=>{
 const fixed=Buffer.byteLength(exception('')),original=exception('x'.repeat(4194304-fixed));expect(Buffer.byteLength(original)).toBe(4194304);let first=true;
 await fixture(async(journal,directory)=>{await journal.pauseStage();const bytes=await readFile(join(directory,'page-exceptions.jsonl'));expect(bytes.byteLength).toBe(16777216+4);expect(bytes.toString()).toBe((original+'\n').repeat(4));expect(journal.snapshot().serializedBytes).toBe(16777216);},{drain:async()=>first?(first=false,Array.from({length:4},()=>({cohort:'exception',serialized:original}))):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('UTF8 byte limit rejects multibyte text below the code unit cap',async()=>{
 const original=exception('🙂'.repeat(1048576));expect(original.length).toBeLessThan(4194304);expect(Buffer.byteLength(original)).toBeGreaterThan(4194304);let first=true;
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().pageRecords).toBe(0);expect(journal.snapshot().reasons.join(';')).toContain('bounded');},{drain:async()=>first?(first=false,[{cohort:'exception',serialized:original}]):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('a genuine page failure with falsy rejection is retained independently from error truthiness',async()=>{
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().reasons).toContain('undefined');expect(journal.snapshot().pageRecords).toBe(0);},{drain:async()=>{throw undefined;},transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('held writer permits one producer batch but no queued drains and terminal joins admitted bytes',async()=>{
 const release=deferred<void>(),admitted=deferred<void>();let producerDrains=0,writes=0,first=true;
 const producerRecord={schemaVersion:2,repetition:'r',phase:'streaming-follow',sequence:null,timestampMs:1,clockDomain:'producer-monotonic-ms',kind:'producer-failure',data:{stage:'replay',reason:'actual failure'}} as const;
 try{await fixture(async(journal,directory)=>{await admitted.promise;let terminalDone=false;const terminal=journal.finishStage().then(value=>{terminalDone=true;return value;});void terminal.catch(()=>{});
   try{await new Promise<void>(resolve=>setTimeout(resolve,120));expect(producerDrains).toBe(1);expect(writes).toBe(1);expect(terminalDone).toBe(false);release.resolve();const summary=await terminal;expect(summary.pageRecords).toBe(1);expect(summary.producerRecords).toBe(1);expect(summary.pageSerializedBytes).toBe(Buffer.byteLength(exception('held')));expect(summary.producerSerializedBytes).toBe(Buffer.byteLength(JSON.stringify(producerRecord)));expect(summary.pageEmpty).toBe(true);expect(await readFile(join(directory,'producer.jsonl'),'utf8')).toBe(JSON.stringify(producerRecord)+'\n');}
   finally{release.resolve();await terminal;}
 },{drain:async()=>first?(first=false,[{cohort:'exception',serialized:exception('held')} ]):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]},{state:'failed',drain:()=>++producerDrains===1?[producerRecord]:[]},writer=>({...writer,async appendSerialized(path,records){writes++;admitted.resolve();await release.promise;await writer.appendSerialized(path,records);}}));}
 finally{release.resolve();}
});
test('close memoizes its genuine first underlying settlement',async()=>{
 await fixture(async journal=>{const first=journal.close(),second=journal.close();expect(first).toBe(second);await first;},{drain:async()=>[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]});
});
test('invalid nonprimitive transfer result is rejected before it becomes acquired evidence',async()=>{
 await expect(fixture(async()=>{}, {drain:async()=>[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>({...transfer,remainingEntries:-1}),drainPreNavigation:async()=>[]})).rejects.toThrow('transfer');
});
for(const excess of [0,1])test(`exact append-cap boundary plus ${excess} UTF8 byte`,async()=>{
 const fixed=Buffer.byteLength(exception('')),record=exception('x'.repeat(4194303-fixed)),last=exception('x'.repeat(4194303-fixed+excess));let first=true;const sizes:number[]=[];
 const records=[record,record,record,last];expect(records.reduce((sum,text)=>sum+Buffer.byteLength(text)+1,0)).toBe(16777216+excess);
 await fixture(async(journal,directory)=>{await journal.pauseStage();expect(sizes).toEqual(excess?[12582912,4194305]:[16777216]);expect((await readFile(join(directory,'page-exceptions.jsonl'))).byteLength).toBe(16777216+excess);},{drain:async()=>first?(first=false,records.map(serialized=>({cohort:'exception',serialized}))):[],transferPreNavigation:async()=>transfer,readPreNavigationTransfer:async()=>transfer,drainPreNavigation:async()=>[]},undefined,writer=>({...writer,async appendSerialized(path,slice){sizes.push(slice.reduce((sum,text)=>sum+Buffer.byteLength(text)+1,0));await writer.appendSerialized(path,slice);}}));
});
test('expiry forbids held page suffix persistence and independent cleanup starts before its settlement',async()=>{
 vi.useFakeTimers();vi.setSystemTime(0);
 const directory=await mkdtemp(join(tmpdir(),'g-journal-expiry-')),writer=await ComparisonArtifactWriter.create(directory),owner=new ComparisonOwnership({now:Date.now}),pageHold=deferred<readonly {cohort:'exception';serialized:string}[]>(),bodyHold=deferred<void>(),started=deferred<void>();let journal:ReturnType<typeof createComparisonCaptureJournal>|undefined,independentClosed=false,failed=false,error:unknown;
 const stage=owner.run('setup',async ownership=>{try{
  await ownership.adopt({name:'independent-resource',close:async()=>{independentClosed=true;}});
  journal=createComparisonCaptureJournal({identity,clock:{now:Date.now}});
  await journal.startStage({context:{identity,descriptor:{...identity,seed:1,mode:'headless',artifactDirectory:'runs/r'},fixture:createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'follow'}),ownership,writer:writer.scoped(()=>ownership.assertActive())},page:{drain:()=>pageHold.promise,readPreNavigationTransfer:async()=>transfer,transferPreNavigation:async()=>transfer,drainPreNavigation:async()=>[]},producer:{state:'waiting',drain:()=>[]}});started.resolve();await bodyHold.promise;
 }catch(value){failed=true;error=value;throw value;}});void stage.catch(()=>{});
 try{await started.promise;await vi.advanceTimersByTimeAsync(60000);expect((await stage).status).toBe('expired');const disposal=owner.dispose();void disposal.catch(()=>{});await vi.advanceTimersByTimeAsync(10000);expect((await disposal).status).toBe('expired');expect(independentClosed).toBe(true);expect(owner.unsafeOutstanding).toBe(true);pageHold.resolve([{cohort:'exception',serialized:exception('late')}]);bodyHold.resolve();await owner.ownershipSettled;if(failed)throw error;expect(journal?.snapshot().pageRecords).toBe(0);expect(journal?.snapshot().reasons.join(';')).toContain('closed');await expect(readFile(join(directory,'page-exceptions.jsonl'))).rejects.toThrow();expect(owner.unsafeOutstanding).toBe(false);}
 finally{pageHold.resolve([]);bodyHold.resolve();await owner.ownershipSettled;vi.useRealTimers();await rm(directory,{recursive:true,force:true});}
});
test('successful transfer cannot erase genuine pre-source overflow',async()=>{
 const source=createComparisonBuffer('pre-navigation-errors');for(let i=0;i<4097;i++)source.enqueue('null');const actual={...transfer,sourceFinal:source.state()};
 await fixture(async journal=>{await journal.pauseStage();expect(journal.snapshot().transfer?.sourceFinal?.overflowCount).toBe(1);expect(journal.snapshot().reasons.join(';')).toContain('Pending entry');},{drain:async()=>[],transferPreNavigation:async()=>actual,readPreNavigationTransfer:async()=>actual,drainPreNavigation:async()=>[]});
});
test('persists stopped 4095 leftovers once after one consumed rejection, without retry or healing',async()=>{
 const source=createComparisonBuffer('pre-navigation-errors');for(let i=0;i<4096;i++)source.enqueue('null');const original=exception('leftover');let remaining=4095,transfers=0;
 const state=()=>({...transfer,sourceFinal:source.state(),attempted:1,rejected:1,failureReason:'consumed rejection',remainingEntries:remaining,remainingSerializedBytes:remaining*Buffer.byteLength(original),complete:remaining===0});
 await fixture(async(journal,directory)=>{const result=await journal.finishStage();expect(transfers).toBe(0);expect(result.pageRecords).toBe(4095);expect(result.transfer?.remainingEntries).toBe(0);expect(result.transfer?.rejected).toBe(1);expect(result.reasons).toContain('consumed rejection');expect(await readFile(join(directory,'page-exceptions.jsonl'),'utf8')).toBe((original+'\n').repeat(4095));},{drain:async()=>[],readPreNavigationTransfer:async()=>state(),transferPreNavigation:async()=>{transfers++;return state();},drainPreNavigation:async count=>{const length=Math.min(count,remaining);remaining-=length;return Array.from({length},()=>original);}},{state:'complete',drain:()=>[]});
});
test('concurrent pause cancels unadmitted terminal drains before joining held acquisition',async()=>{
 const held=deferred<readonly []>();let drains=0;
 try{await fixture(async journal=>{const terminal=journal.finishStage(),pause=journal.pauseStage();void terminal.catch(()=>{});void pause.catch(()=>{});try{held.resolve([]);await pause;const result=await terminal;expect(drains).toBe(1);expect(result.pageEmpty).toBe(false);expect(result.reasons.join(';')).toContain('paused');}finally{held.resolve([]);await Promise.allSettled([terminal,pause]);}},{drain:async()=>{drains++;return held.promise;},readPreNavigationTransfer:async()=>transfer,transferPreNavigation:async()=>transfer,drainPreNavigation:async()=>[]},{state:'complete',drain:()=>[]});}finally{held.resolve([]);}
});
