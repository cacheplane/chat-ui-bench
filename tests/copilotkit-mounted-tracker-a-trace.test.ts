import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createMountedTrackerATrace,type TrackerATracePorts,type TrackerACompletion} from '../apps/copilotkit/runtime/mounted-tracker-a-trace.ts';

function fixture() {
 let completion:(event:TrackerACompletion)=>void=()=>{},close:(match:boolean)=>void=()=>{};
 const calls:string[]=[],writes:Uint8Array[]=[],configs:unknown[]=[];
 const ports:TrackerATracePorts={
  profileRef:{path:'tracker-a-profile.json',bytes:100,sha256:'0'.repeat(64)},
  clock:{now:()=>0,deadlineHostMs:30000,alarm:()=>()=>{}},
  start:async config=>{calls.push('start');configs.push(config);},
  end:async()=>{calls.push('end');completion({stream:'trace',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});},
  read:async(_handle,size)=>{calls.push('read:'+size);return {data:'{}',eof:true};},
  closeIO:async()=>{calls.push('io-close');},detach:async()=>{calls.push('detach');close(true);},
  installTracingComplete:listener=>{calls.push('install-complete');completion=listener;},
  removeTracingComplete:()=>{calls.push('remove-complete');},
  installSessionClose:listener=>{calls.push('install-close');close=listener;},removeSessionClose:()=>{calls.push('remove-close');},
  sink:{created:true,fsync:null,fileClose:null,write:async bytes=>{calls.push('write');writes.push(bytes);},finish:()=>{calls.push('finish');ports.sink.fsync=Promise.resolve();ports.sink.fileClose=Promise.resolve();return Promise.resolve({path:'tracker-a-case-2-trace.json',bytes:2,sha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'});}}
 };
 return {ports,calls,writes,configs,completion:(event:TrackerACompletion)=>completion(event),close:(match:boolean)=>close(match)};
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function turns(){for(let i=0;i<40;i++)await Promise.resolve();}
function virtualClock(deadlineHostMs=30000){let now=0;const alarms=new Set<{at:number;fire:()=>void}>();return {now:()=>now,deadlineHostMs,alarm:(at:number,fire:()=>void)=>{const item={at,fire};alarms.add(item);return()=>{alarms.delete(item);};},jump:(time:number)=>{now=time;},advance:(time:number)=>{now=time;for(const item of [...alarms])if(item.at<=now){alarms.delete(item);item.fire();}}};}
describe('fixed Tracker-A trace transport',()=>{
 it.each(['empty-eof','byte-plus-one','missing-eof'] as const)('retains 32MiB exactly and closes original handles for %s',async kind=>{
  const f=fixture();let reads=0;f.ports.read=async()=>{reads++;return reads<=512?{data:'x'.repeat(65536),eof:false}:{data:kind==='byte-plus-one'?'x':'',eof:kind!=='missing-eof'};};
  const finish=f.ports.sink.finish;f.ports.sink.finish=()=>{finish();return Promise.resolve({path:'tracker-a-case-2-trace.json',bytes:33554432,sha256:createHash('sha256').update('x'.repeat(33554432)).digest('hex')});};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();if(kind==='empty-eof')await owner.finish();else await expect(owner.finish()).rejects.toThrow();
  const report=owner.snapshot();expect(reads).toBe(513);expect(f.writes).toHaveLength(512);expect(f.writes.reduce((sum,row)=>sum+row.length,0)).toBe(33554432);expect(report.readCalls).toBe(513);expect(report.portCalls).toBeLessThanOrEqual(1031);
  expect(report.raw.status).toBe(kind==='empty-eof'?'complete-raw':'known-prefix');expect(f.calls.filter(row=>row==='io-close')).toHaveLength(1);expect(f.calls.filter(row=>row==='detach')).toHaveLength(1);
  if(kind==='empty-eof'){expect(report.portCalls).toBe(1030);expect(report.operations.filter(row=>row.kind==='read').at(-1)).toMatchObject({bytes:0,eof:true});}
 });
 it('registers before the exact JSON/none start and retains EOF with data through original closure',async()=>{
  const f=fixture(),owner=createMountedTrackerATrace(f.ports);await owner.start();await owner.finish();
  expect(f.configs).toEqual([{transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:32768,includedCategories:['cc','benchmark','blink.user_timing','devtools.timeline','disabled-by-default-devtools.timeline']}}]);
  expect(f.calls).toEqual(['install-complete','install-close','start','end','read:65536','write','io-close','finish','detach','remove-complete','remove-close']);
  expect([...f.writes[0]!]).toEqual([123,125]);
  expect(owner.snapshot().mode).toBe('tracker-json-a-pilot-v2');
  expect(owner.snapshot()).toMatchObject({portCalls:7,readCalls:1,knownReadBytes:2,raw:{status:'complete-raw',extent:'complete'},outcome:{capture:{status:'complete',reason:null},containment:'verified'},sink:{finish:'fulfilled',fsync:'fulfilled',fileClose:'fulfilled'}});
 });
 it.each([
  {traceFormat:undefined},{traceFormat:'proto'},{streamCompression:undefined},{streamCompression:'gzip'},
  {dataLossOccurred:undefined},{dataLossOccurred:true},{stream:''},{stream:7}
 ])('refuses unsupported or missing completion facts %j',async change=>{
  const f=fixture();f.ports.end=async()=>{f.completion({stream:'trace',traceFormat:'json',streamCompression:'none',dataLossOccurred:false,...change});};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();
  expect(owner.snapshot()).toMatchObject({raw:{status:'known-prefix'},outcome:{capture:{status:'incomplete'}}});expect(f.writes).toHaveLength(0);
 });
 it.each([
  {data:'x',eof:undefined},{data:'x',eof:1},{data:7,eof:true},{data:'\ud800',eof:true},
  {data:'eA',base64Encoded:true,eof:true},{data:'eB==',base64Encoded:true,eof:true},
  {data:'eA==\n',base64Encoded:true,eof:true},{data:'x',base64Encoded:'true',eof:true},
  {data:'',eof:false},{data:'x'.repeat(65537),eof:true}
 ])('refuses malformed read bytes without a write case %#',async data=>{
  const f=fixture();let n=0;f.ports.read=async()=>++n===1?data:{data:'',eof:true};const owner=createMountedTrackerATrace(f.ports);await owner.start();
  await expect(owner.finish()).rejects.toThrow();expect(f.writes).toHaveLength(0);expect(owner.snapshot()).toMatchObject({readCalls:1,raw:{status:'known-prefix'}});
 });
 it('decodes canonical base64 bytes and keeps empty EOF read without a write',async()=>{
  const f=fixture();let n=0;f.ports.read=async()=>++n===1?{data:'e30=',base64Encoded:true,eof:false}:{data:'',eof:true};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await owner.finish();
  expect(f.writes.map(bytes=>[...bytes])).toEqual([[123,125]]);expect(owner.snapshot()).toMatchObject({readCalls:2,knownReadBytes:2,portCalls:8});
 });
 it('charges the throwing original before invocation and preserves rejection identity',async()=>{
  const f=fixture(),reason=Object.freeze({original:true});let snapshot:()=>unknown=()=>null;
  f.ports.start=()=>{expect(snapshot()).toMatchObject({portCalls:1,operations:[{kind:'start',status:'pending'}]});throw reason;};
  const owner=createMountedTrackerATrace(f.ports);snapshot=owner.snapshot;await expect(owner.start()).rejects.toBe(reason);
  expect(owner.snapshot().operations[0]).toMatchObject({kind:'start',status:'rejected'});
 });
 it('does not admit the 514th read and preserves all 513 successful read/write rows',async()=>{
  const f=fixture();let n=0;f.ports.read=async()=>({data:'x',eof:++n===514});const owner=createMountedTrackerATrace(f.ports);await owner.start();
  await expect(owner.finish()).rejects.toThrow();expect(n).toBe(513);expect(f.writes).toHaveLength(513);
  expect(owner.snapshot()).toMatchObject({readCalls:513,knownReadBytes:513,portCalls:1031,raw:{status:'known-prefix'}});
 });
 it('refuses a completion before end and never reads that handle',async()=>{
  const f=fixture();f.ports.start=async()=>{f.completion({stream:'early',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});};
  const owner=createMountedTrackerATrace(f.ports);await expect(owner.start()).rejects.toThrow();expect(f.calls).not.toContain('read:65536');
 });
 it('retains two bounded handles and one overflow witness without extra identifiers',async()=>{
  const f=fixture(),closed:string[]=[];f.ports.closeIO=async handle=>{closed.push(handle);};
  f.ports.end=async()=>{for(const stream of ['trace','extra','third','fourth','extra'])f.completion({stream,traceFormat:'json',streamCompression:'none',dataLossOccurred:false});};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();
  const report=owner.snapshot();expect(report).toMatchObject({handles:[{ordinal:1,role:'accepted'},{ordinal:2,role:'unexpected'}],handleOverflow:{ordinal:3},outcome:{containment:'unverified'}});
  expect(report.handles).toHaveLength(2);expect(closed).toEqual(['trace','extra']);expect(JSON.stringify(report)).not.toContain('third');
 });
 it.each(['start','end','read','write','io-close','sink-finish','detach'] as const)('retains held %s original through its clipped deadline and late rejection',async kind=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<never>(),reason=Object.freeze({lateOriginal:kind});f.ports.clock=clock;
  if(kind==='start')f.ports.start=()=>hold.promise;
  if(kind==='end')f.ports.end=()=>hold.promise;
  if(kind==='read')f.ports.read=()=>hold.promise;
  if(kind==='write')f.ports.sink.write=()=>hold.promise;
  if(kind==='io-close')f.ports.closeIO=()=>hold.promise;
  if(kind==='sink-finish')f.ports.sink.finish=()=>hold.promise;
  if(kind==='detach')f.ports.detach=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);let settled=false;
  const result=kind==='start'?owner.start():(await owner.start(),owner.finish());void result.then(()=>{settled=true;},()=>{settled=true;});await turns();
  expect(owner.snapshot().operations.find(row=>row.kind===kind)).toMatchObject({status:'pending',settledHostMs:null});
  clock.advance(['io-close','sink-finish','detach'].includes(kind)?1000:10000);await turns();const deadlineReturned=settled;
  const pendingAtDeadline=owner.snapshot().operations.find(row=>row.kind===kind);hold.reject(reason);await turns();
  expect(deadlineReturned).toBe(true);expect(pendingAtDeadline).toMatchObject({status:'pending',timedOut:true,settledHostMs:null});
  expect(owner.snapshot().operations.find(row=>row.kind===kind)).toMatchObject({status:'rejected',timedOut:true});expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it('clips a held start to the remaining enclosing deadline',async()=>{
  const f=fixture(),clock=virtualClock(23),hold=deferred<void>();f.ports.clock=clock;f.ports.start=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);let returned=false;void owner.start().catch(()=>{returned=true;});await turns();clock.advance(22);await turns();expect(returned).toBe(false);
  clock.advance(23);await turns();const atDeadline=returned;hold.resolve();await turns();expect(atDeadline).toBe(true);expect(owner.snapshot().operations[0]).toMatchObject({status:'fulfilled',timedOut:true,settledHostMs:23});
 });
 it('queues sink physical closure behind the held original write, retaining late successful byte accounting',async()=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<void>();f.ports.clock=clock;f.ports.sink.write=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);await owner.start();let returned=false;void owner.finish().catch(()=>{returned=true;});await turns();clock.advance(10000);await turns();
  const atDeadline=returned;expect(f.calls).not.toContain('finish');hold.resolve();await turns();
  expect(atDeadline).toBe(true);expect(f.calls).toContain('finish');expect(owner.snapshot()).toMatchObject({knownReadBytes:2,raw:{status:'known-prefix'},operations:expect.arrayContaining([{...owner.snapshot().operations.find(row=>row.kind==='write'),status:'fulfilled',timedOut:true}])});
 });
 it.each(['fsync','fileClose'] as const)('retains actual held %s even when finish itself already fulfills',async kind=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<void>();f.ports.clock=clock;const originalFinish=f.ports.sink.finish;
  f.ports.sink.finish=()=>{const original=originalFinish();f.ports.sink[kind]=hold.promise;return original;};const owner=createMountedTrackerATrace(f.ports);await owner.start();let returned=false;void owner.finish().catch(()=>{returned=true;});await turns();
  expect(owner.snapshot().sink).toMatchObject({finish:'fulfilled',[kind]:'pending'});clock.advance(1000);await turns();const atDeadline=returned;hold.resolve();await turns();
  expect(atDeadline).toBe(true);expect(owner.snapshot().sink[kind]).toBe('fulfilled');expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it('does not infer public session close from a fulfilled detach acknowledgment',async()=>{
  const f=fixture(),clock=virtualClock();f.ports.clock=clock;f.ports.detach=async()=>{};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();let returned=false;void owner.finish().catch(()=>{returned=true;});await turns();
  expect(owner.snapshot()).toMatchObject({sessionClose:{firstHostMs:null,timing:'unobserved'},operations:expect.arrayContaining([expect.objectContaining({kind:'detach',status:'fulfilled'})])});
  clock.advance(1000);await turns();const atDeadline=returned;f.close(true);await turns();expect(atDeadline).toBe(true);expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it('rolls back both attempted listener installs even if the second installed then threw',async()=>{
  const f=fixture(),reason=Object.freeze({registration:true}),install=f.ports.installSessionClose;f.ports.installSessionClose=callback=>{install(callback);throw reason;};
  const owner=createMountedTrackerATrace(f.ports);await expect(owner.start()).rejects.toBe(reason);
  expect(f.calls).not.toContain('start');expect(f.calls).toContain('remove-complete');expect(f.calls).toContain('remove-close');
  expect(owner.snapshot()).toMatchObject({listeners:{sessionClose:{registration:{status:'rejected'},removal:{status:'fulfilled'}}}});
 });
 it.each([false,true])('rejects public close before safe detach (identity %s)',async match=>{
  const f=fixture();f.ports.read=async()=>{f.close(match);return {data:'{}',eof:true};};const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();expect(owner.snapshot().sessionClose.timing).toBe('unexpected-loss');
 });
 it('captures the 512th EOF-with-data at exactly 32MiB and 1029 charged calls',async()=>{
  const f=fixture();let reads=0;f.ports.read=async()=>({data:'x'.repeat(65536),eof:++reads===512});const finish=f.ports.sink.finish;
  f.ports.sink.finish=()=>{finish();return Promise.resolve({path:'tracker-a-case-2-trace.json',bytes:33554432,sha256:createHash('sha256').update('x'.repeat(33554432)).digest('hex')});};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();const pending=owner.finish();expect(owner.finish()).toBe(pending);await pending;
  const report=owner.snapshot();expect(report).toMatchObject({portCalls:1029,readCalls:512,knownReadBytes:33554432,raw:{status:'complete-raw',ref:{bytes:33554432}},outcome:{containment:'verified'}});
  expect(report.operations.filter(row=>row.kind==='read').at(-1)).toMatchObject({ordinal:1025,bytes:65536,eof:true});
  expect(report.operations.filter(row=>row.kind==='write').map(row=>row.readOperationOrdinal)).toEqual(report.operations.filter(row=>row.kind==='read').map(row=>row.ordinal));
 });
 it('leaves an unexpected second handle honestly unclosed at call 1031 without a 1032nd dispatch',async()=>{
  const f=fixture(),closed:string[]=[];let n=0;f.ports.read=async()=>({data:'x',eof:++n===513});const finish=f.ports.sink.finish;
  f.ports.sink.finish=()=>{finish();return Promise.resolve({path:'tracker-a-case-2-trace.json',bytes:513,sha256:createHash('sha256').update('x'.repeat(513)).digest('hex')});};
  f.ports.closeIO=async handle=>{closed.push(handle);};f.ports.detach=async()=>{f.completion({stream:'unexpected',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});f.close(true);};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();
  expect(closed).toEqual(['trace']);expect(owner.snapshot()).toMatchObject({portCalls:1031,handles:[{ordinal:1,closeOperationOrdinal:1029},{ordinal:2,role:'unexpected',closeOperationOrdinal:null}],outcome:{containment:'unverified'},raw:{status:'known-prefix'}});
 });
 it('closes a second handle arriving during detach exactly once while the ledger still has room',async()=>{
  const f=fixture(),closed:string[]=[];f.ports.closeIO=async handle=>{closed.push(handle);};f.ports.detach=async()=>{f.completion({stream:'second',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});f.close(true);};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();expect(closed).toEqual(['trace','second']);expect(owner.snapshot().handles[1]?.closeOperationOrdinal).not.toBe(null);
 });
 it('rolls back a late registration after start deadline without starting tracing or installing more listeners',async()=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<void>();f.ports.clock=clock;const install=f.ports.installTracingComplete;
  f.ports.installTracingComplete=callback=>{install(callback);return hold.promise;};const owner=createMountedTrackerATrace(f.ports);void owner.start().catch(()=>{});await turns();clock.advance(10000);await turns();hold.resolve();await turns();
  expect(f.calls).not.toContain('start');expect(f.calls).not.toContain('install-close');expect(f.calls).toContain('remove-complete');expect(owner.snapshot().listeners.tracingComplete.registration.status).toBe('fulfilled');
 });
 it('refuses tracing when the exclusive sink was not created',async()=>{
  const f=fixture();f.ports.sink.created=false;const owner=createMountedTrackerATrace(f.ports);await expect(owner.start()).rejects.toThrow();expect(f.calls).not.toContain('start');expect(owner.snapshot().raw).toEqual({status:'absent',ref:null,extent:'unobserved'});
 });
 it('refuses new start dispatch at the exact enclosing deadline',async()=>{
  const f=fixture();f.ports.clock=virtualClock(0);const owner=createMountedTrackerATrace(f.ports);await expect(owner.start()).rejects.toThrow();await turns();expect(f.calls).not.toContain('start');expect(f.calls).not.toContain('install-complete');
 });
 it.each([undefined,null,false,Object.freeze({original:'primary'})])('preserves primary rejection identity despite sink cleanup rejection case %#',async reason=>{
  const f=fixture();f.ports.start=()=>Promise.reject(reason);f.ports.sink.finish=()=>Promise.reject(Object.freeze({cleanup:true}));
  const owner=createMountedTrackerATrace(f.ports);await expect(owner.start()).rejects.toBe(reason);expect(owner.snapshot().sink.finish).toBe('rejected');
 });
 it('retains fsync and physical close separately when finish rejects before the close original is exposed',async()=>{
  const f=fixture(),clock=virtualClock(),sync=deferred<void>(),physical=deferred<void>(),reason=Object.freeze({finish:true});f.ports.clock=clock;
  f.ports.sink.finish=()=>{f.ports.sink.fsync=sync.promise;void sync.promise.then(()=>{f.ports.sink.fileClose=physical.promise;});return Promise.reject(reason);};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();let error:unknown;void owner.finish().catch(value=>{error=value;});await turns();
  expect(owner.snapshot().sink).toMatchObject({finish:'rejected',fsync:'pending',fileClose:'not-started'});clock.advance(1000);await turns();expect(error).toBe(reason);
  sync.resolve();await turns();expect(owner.snapshot().sink.fileClose).toBe('pending');physical.reject(Object.freeze({physicalClose:true}));await turns();
  expect(owner.snapshot().sink).toMatchObject({finish:'rejected',fsync:'fulfilled',fileClose:'rejected'});expect(owner.snapshot().outcome.containment).toBe('unverified');
 });
 it('treats end acknowledgment without completion as pending and accepts no late read lane',async()=>{
  const f=fixture(),clock=virtualClock();f.ports.clock=clock;f.ports.end=async()=>{};const owner=createMountedTrackerATrace(f.ports);await owner.start();let returned=false;void owner.finish().catch(()=>{returned=true;});await turns();
  clock.advance(10000);await turns();expect(returned).toBe(true);expect(owner.snapshot().completion.firstHostMs).toBe(null);
  f.completion({stream:'late',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});await turns();expect(f.calls).not.toContain('read:65536');expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it('retains the fixed profile reference by value and exports only the closed transport keys',async()=>{
  const f=fixture(),owner=createMountedTrackerATrace(f.ports);const expected={...f.ports.profileRef};f.ports.profileRef.bytes=999;
  await owner.start();await owner.finish();const snapshot=owner.snapshot();expect(snapshot.profileRef).toEqual(expected);
  expect(Object.keys(snapshot)).toEqual(['schemaVersion','kind','mode','profileRef','raw','listeners','operations','completion','sessionClose','handles','handleOverflow','sink','portCalls','readCalls','knownReadBytes','outcome','authority']);
 });
 it.each([{path:'other.json'},{bytes:16385},{bytes:-1},{bytes:0.1},{sha256:'A'.repeat(64)},{extra:true}])('refuses invalid closed profile reference before dispatch case %#',change=>{
  const f=fixture();Object.assign(f.ports.profileRef,change);expect(()=>createMountedTrackerATrace(f.ports)).toThrow();expect(f.calls).toEqual([]);
 });
 it('refuses profile accessors without reading them and refuses inherited required fields',()=>{
  const f=fixture();let getters=0;Object.defineProperty(f.ports.profileRef,'sha256',{get(){getters++;return '0'.repeat(64);}});expect(()=>createMountedTrackerATrace(f.ports)).toThrow();expect(getters).toBe(0);
  const g=fixture(),profile={...g.ports.profileRef};Reflect.deleteProperty(g.ports.profileRef,'path');Object.setPrototypeOf(g.ports.profileRef,{path:profile.path});expect(()=>createMountedTrackerATrace(g.ports)).toThrow();
 });
 it.each(['accessor','inherited','extra'] as const)('refuses %s raw file reference without invoking getters',async kind=>{
  const f=fixture(),finish=f.ports.sink.finish;let getters=0;
  f.ports.sink.finish=()=>{finish();const ref={path:'tracker-a-case-2-trace.json' as const,bytes:2,sha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'};
   if(kind==='accessor')Object.defineProperty(ref,'bytes',{get(){getters++;return 2;}});
   if(kind==='inherited'){Reflect.deleteProperty(ref,'path');Object.setPrototypeOf(ref,{path:'tracker-a-case-2-trace.json'});}
   if(kind==='extra')Object.assign(ref,{unbounded:'refused'});return Promise.resolve(ref);
  };const owner=createMountedTrackerATrace(f.ports);await owner.start();let refused=false;try{await owner.finish();}catch{refused=true;}
  expect(getters).toBe(0);expect(refused).toBe(true);expect(owner.snapshot().raw).toMatchObject({status:'known-prefix',ref:null});
 });
 it('returns raw file references by value so a consumer cannot mutate retained evidence',async()=>{
  const f=fixture(),owner=createMountedTrackerATrace(f.ports);await owner.start();await owner.finish();const first=owner.snapshot();if(first.raw.ref)first.raw.ref.bytes=99;expect(owner.snapshot().raw.ref?.bytes).toBe(2);
 });
 it('does not refresh the start budget after synchronous listener installation consumes time',async()=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<void>();f.ports.clock=clock;const install=f.ports.installTracingComplete;
  f.ports.installTracingComplete=callback=>{install(callback);clock.jump(9000);};f.ports.start=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);let returned=false;void owner.start().catch(()=>{returned=true;});await turns();clock.advance(10000);await turns();const atOriginalDeadline=returned;hold.resolve();await turns();expect(atOriginalDeadline).toBe(true);
 });
 it('refuses a read at the absolute finish boundary even when the timer wakeup was delayed',async()=>{
  const f=fixture(),clock=virtualClock();f.ports.clock=clock;const end=f.ports.end;
  f.ports.end=async()=>{clock.jump(10000);await end();};const owner=createMountedTrackerATrace(f.ports);await owner.start();let refused=false;try{await owner.finish();}catch{refused=true;}
  expect(f.calls).not.toContain('read:65536');expect(refused).toBe(true);expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it('retains a fulfilled detach while its original listener removal stays pending through cleanup timeout',async()=>{
  const f=fixture(),clock=virtualClock(),hold=deferred<void>();f.ports.clock=clock;f.ports.removeTracingComplete=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);await owner.start();let returned=false;void owner.finish().catch(()=>{returned=true;});await turns();clock.advance(1000);await turns();expect(returned).toBe(true);
  expect(owner.snapshot().listeners.tracingComplete.removal).toMatchObject({status:'pending',settledHostMs:null});hold.resolve();await turns();expect(owner.snapshot().listeners.tracingComplete.removal).toMatchObject({status:'fulfilled',settledHostMs:1000});expect(owner.snapshot().raw.status).toBe('known-prefix');
 });
 it.each(['resolve','reject'] as const)('reports only an acknowledged whole write length after original %s',async settlement=>{
  const f=fixture(),hold=deferred<void>(),reason=Object.freeze({partialWrite:true});f.ports.sink.write=()=>hold.promise;
  const owner=createMountedTrackerATrace(f.ports);await owner.start();const result=owner.finish();void result.catch(()=>{});await turns();
  const before=owner.snapshot().operations.find(row=>row.kind==='write');if(settlement==='resolve')hold.resolve();else hold.reject(reason);await turns();
  expect(before).toMatchObject({status:'pending',bytes:null,readOperationOrdinal:3});
  if(settlement==='resolve'){await result;expect(owner.snapshot().operations.find(row=>row.kind==='write')).toMatchObject({status:'fulfilled',bytes:2});}
  else{await expect(result).rejects.toBe(reason);expect(owner.snapshot().operations.find(row=>row.kind==='write')).toMatchObject({status:'rejected',bytes:null});}
 });
 it.each([NaN,Infinity,-Infinity])('refuses a nonfinite enclosing deadline before dispatch case %#',deadline=>{
  const f=fixture();f.ports.clock.deadlineHostMs=deadline;expect(()=>createMountedTrackerATrace(f.ports)).toThrow();expect(f.calls).toEqual([]);
 });
 it.each([NaN,Infinity,-Infinity])('refuses a nonfinite initial clock before dispatch case %#',time=>{
  const f=fixture();f.ports.clock.now=()=>time;expect(()=>createMountedTrackerATrace(f.ports)).toThrow();expect(f.calls).toEqual([]);
 });
 it.each(['read','listener','completion'] as const)('refuses a nonfinite %s time without serializing nonfinite evidence',async phase=>{
  const f=fixture();let invalid=false;f.ports.clock.now=()=>invalid?NaN:0;
  if(phase==='read')f.ports.read=async()=>{invalid=true;return {data:'{}',eof:true};};
  if(phase==='listener'){const install=f.ports.installTracingComplete;f.ports.installTracingComplete=callback=>{install(callback);invalid=true;};}
  if(phase==='completion')f.ports.end=async()=>{invalid=true;f.completion({stream:'trace',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});};
  const owner=createMountedTrackerATrace(f.ports);let refused=false;try{await owner.start();await owner.finish();}catch{refused=true;}
  expect(refused).toBe(true);const snapshot=owner.snapshot();expect(snapshot.raw.status).toBe('known-prefix');expect(snapshot.outcome.containment).toBe('unverified');
  JSON.stringify(snapshot,(_key,value:unknown)=>{if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);return value;});
 });
 it('refuses a backwards host settlement instead of qualifying a contradictory operation bracket',async()=>{
  const f=fixture(),clock=virtualClock();clock.jump(10);f.ports.clock=clock;f.ports.read=async()=>{clock.jump(9);return {data:'{}',eof:true};};
  const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();expect(owner.snapshot().raw.status).toBe('known-prefix');expect(owner.snapshot().outcome.containment).toBe('unverified');
 });
 it('preflights the handle code-unit bound before encoding any oversized identifier',async()=>{
  const f=fixture(),encode=vi.spyOn(TextEncoder.prototype,'encode');f.ports.end=async()=>{f.completion({stream:'h'.repeat(4097),traceFormat:'json',streamCompression:'none',dataLossOccurred:false});};
  try{const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();expect(encode.mock.calls.some(args=>typeof args[0]==='string'&&args[0].length>4096)).toBe(false);expect(owner.snapshot().handles).toHaveLength(0);}finally{encode.mockRestore();}
 });
 it('counts no read when the request timestamp is refused before its row and original dispatch',async()=>{
  const f=fixture();let armed=false,clockReads=0,reads=0;f.ports.clock.now=()=>armed&&++clockReads>=4?NaN:0;
  f.ports.end=async()=>{f.completion({stream:'trace',traceFormat:'json',streamCompression:'none',dataLossOccurred:false});armed=true;};
  f.ports.read=async()=>{reads++;return {data:'{}',eof:true};};const owner=createMountedTrackerATrace(f.ports);await owner.start();await expect(owner.finish()).rejects.toThrow();
  const snapshot=owner.snapshot();expect(reads).toBe(0);expect(snapshot.operations.filter(row=>row.kind==='read')).toHaveLength(0);expect(snapshot.readCalls).toBe(0);expect(snapshot.portCalls).toBe(snapshot.operations.length);
 });
});
