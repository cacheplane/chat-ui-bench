/** Fixed supplied ports for the pilot. No SDK or filesystem executes in this module. */
export type TrackerAOriginal = 'not-started'|'pending'|'fulfilled'|'rejected';
export type TrackerAFileRef = {path:'tracker-a-case-2-trace.json';bytes:number;sha256:string};
export type TrackerAProfileRef = {path:'tracker-a-profile.json';bytes:number;sha256:string};
export type TrackerACompletion = {stream?:unknown;traceFormat?:unknown;streamCompression?:unknown;dataLossOccurred?:unknown};
export type TrackerARead = {data:unknown;eof:unknown;base64Encoded?:unknown};
export interface TrackerATracePorts {
 profileRef:TrackerAProfileRef;
 clock:{now():number;deadlineHostMs:number;alarm(atHostMs:number,fire:()=>void):()=>void};
 start(config:unknown):Promise<void>; end():Promise<void>;
 read(handle:string,size:65536):Promise<TrackerARead>; closeIO(handle:string):Promise<void>; detach():Promise<void>;
 installTracingComplete(listener:(event:TrackerACompletion)=>void):void|Promise<void>;
 removeTracingComplete(listener:(event:TrackerACompletion)=>void):void|Promise<void>;
 installSessionClose(listener:(originalSessionMatch:boolean)=>void):void|Promise<void>;
 removeSessionClose(listener:(originalSessionMatch:boolean)=>void):void|Promise<void>;
 sink:{created:boolean;write(bytes:Uint8Array):Promise<void>;finish():Promise<TrackerAFileRef|null>;fsync:Promise<void>|null;fileClose:Promise<void>|null};
}
export const TRACKER_A_TRACE_CONFIG = Object.freeze({
 transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none',
 traceConfig:Object.freeze({recordMode:'recordUntilFull',traceBufferSizeInKb:32768,
  includedCategories:Object.freeze(['cc','benchmark','blink.user_timing','devtools.timeline','disabled-by-default-devtools.timeline'])})
});
type OperationKind='start'|'end'|'read'|'write'|'io-close'|'sink-finish'|'detach';
export type TrackerATraceOperation={ordinal:number;kind:OperationKind;requestedHostMs:number;settledHostMs:number|null;status:TrackerAOriginal;timedOut:boolean;handleOrdinal:1|2|null;bytes:number|null;eof:boolean|null;readOperationOrdinal:number|null};
type ListenerOriginal={status:TrackerAOriginal;requestedHostMs:number|null;settledHostMs:number|null};
type ListenerFact={registration:ListenerOriginal;removal:ListenerOriginal;ownedIdentityMatch:boolean|null};
function decodeRead(value:TrackerARead):Uint8Array {
 if(typeof value.data!=='string'||typeof value.eof!=='boolean'||(value.base64Encoded!==undefined&&typeof value.base64Encoded!=='boolean'))throw Error('Invalid trace read');
 let bytes:Uint8Array;
 if(value.base64Encoded===true){
  if(value.data.length>87384||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))throw Error('Noncanonical base64');
  const binary=atob(value.data);if(btoa(binary)!==value.data)throw Error('Noncanonical base64');bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 }else{
  if(value.data.length>65536)throw Error('Read byte capacity');
  for(let i=0;i<value.data.length;i++){const c=value.data.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.data.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('Invalid Unicode');}else if(c>=0xdc00&&c<=0xdfff)throw Error('Invalid Unicode');}
  bytes=new TextEncoder().encode(value.data);
 }
 if(bytes.length>65536||(!bytes.length&&!value.eof))throw Error('Invalid read progress or capacity');return bytes;
}
export function createMountedTrackerATrace(ports:TrackerATracePorts) {
 const enclosingDeadlineHostMs=ports.clock.deadlineHostMs,initialHostMs=ports.clock.now();
 if(!Number.isFinite(enclosingDeadlineHostMs)||!Number.isFinite(initialHostMs))throw Error('Invalid transport clock');
 const profile=Object.getOwnPropertyDescriptors(ports.profileRef);
 if(Reflect.ownKeys(profile).length!==3||!profile.path||!('value'in profile.path)||profile.path.value!=='tracker-a-profile.json'||!profile.bytes||!('value'in profile.bytes)||!Number.isSafeInteger(profile.bytes.value)||profile.bytes.value<0||profile.bytes.value>16384||!profile.sha256||!('value'in profile.sha256)||typeof profile.sha256.value!=='string'||!/^[0-9a-f]{64}$/.test(profile.sha256.value))throw Error('Invalid profile reference');
 const profileRef:TrackerAProfileRef={path:'tracker-a-profile.json',bytes:profile.bytes.value as number,sha256:profile.sha256.value as string};
 const operations:TrackerATraceOperation[]=[],originals:Promise<unknown>[]=[];
 const fact=():ListenerOriginal=>({status:'not-started',requestedHostMs:null,settledHostMs:null});
 const listenerFact=():ListenerFact=>({registration:fact(),removal:fact(),ownedIdentityMatch:null});
 const listeners={tracingComplete:listenerFact(),sessionClose:listenerFact()};
 const completion:{firstHostMs:number|null;overflowHostMs:number|null;format:'json'|'other'|null;compression:'none'|'other'|null;dataLoss:boolean|null}={firstHostMs:null,overflowHostMs:null,format:null,compression:null,dataLoss:null};
 const sessionClose:{firstHostMs:number|null;overflowHostMs:number|null;originalSessionMatch:boolean|null;timing:'unobserved'|'expected-detach'|'unexpected-loss'}={firstHostMs:null,overflowHostMs:null,originalSessionMatch:null,timing:'unobserved'};
 const handles:{ordinal:1|2;firstHostMs:number;role:'accepted'|'unexpected';closeOperationOrdinal:number|null}[]=[],handleValues:string[]=[];
 const sink:{created:boolean;finish:TrackerAOriginal;fsync:TrackerAOriginal;fileClose:TrackerAOriginal}={created:ports.sink.created,finish:'not-started',fsync:'not-started',fileClose:'not-started'};
 let knownReadBytes=0,readCalls=0,writtenBytes=0,ref:TrackerAFileRef|null=null,eof=false,finished=false,endRequested=false,detachRequested=false,safeDetach=false;
 let handleOverflow:{firstHostMs:number;ordinal:3}|null=null;
 let failed=false,primary:unknown,clockValid=true,lastHostMs=initialHostMs,activeDeadline=enclosingDeadlineHostMs;
 const remember=(error:unknown)=>{if(!failed){failed=true;primary=error;}};
 function hostNow(){const value=ports.clock.now();if(!Number.isFinite(value)||value<lastHostMs){clockValid=false;const error=Error('Invalid transport clock');remember(error);throw error;}lastHostMs=value;return value;}
 const refuse=(message:string)=>{const error=Error(message);remember(error);return error;};
 const check=()=>{if(failed)throw primary;if(hostNow()>=activeDeadline)throw refuse('Original transport deadline exceeded');};
 let completionResolve!:()=>void,closeResolve!:()=>void;
 const completed=new Promise<void>(resolve=>{completionResolve=resolve;}),closed=new Promise<void>(resolve=>{closeResolve=resolve;});
 let cleanupPromise:Promise<void>|null=null,startPromise:Promise<void>|null=null,finishPromise:Promise<void>|null=null;
 let fsyncOriginal:Promise<void>|null=null,fileCloseOriginal:Promise<void>|null=null,fsyncObserved:Promise<void>|null=null,fileCloseObserved:Promise<void>|null=null;
 function observeSink(){
  if(ports.sink.fsync!==null&&fsyncOriginal===null){fsyncOriginal=ports.sink.fsync;sink.fsync='pending';fsyncObserved=fsyncOriginal.then(()=>{sink.fsync='fulfilled';observeSink();queueMicrotask(observeSink);},error=>{sink.fsync='rejected';remember(error);observeSink();queueMicrotask(observeSink);});}
  if(ports.sink.fileClose!==null&&fileCloseOriginal===null){fileCloseOriginal=ports.sink.fileClose;sink.fileClose='pending';fileCloseObserved=fileCloseOriginal.then(()=>{sink.fileClose='fulfilled';},error=>{sink.fileClose='rejected';remember(error);});}
  if((fsyncOriginal!==null&&ports.sink.fsync!==fsyncOriginal)||(fileCloseOriginal!==null&&ports.sink.fileClose!==fileCloseOriginal))refuse('Sink original replaced');
 }
 function bounded<T>(work:Promise<T>,deadline:number,onTimeout?:()=>void):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   let done=false,cancel=()=>{};
   const timeout=()=>{if(done)return;done=true;for(const row of operations)if(row.status==='pending')row.timedOut=true;const error=refuse('Original transport deadline exceeded');onTimeout?.();reject(failed?primary:error);};
   void work.then(value=>{if(done)return;try{if(hostNow()>=deadline){timeout();return;}}catch(error){done=true;cancel();reject(error);return;}done=true;cancel();resolve(value);},error=>{if(done)return;done=true;cancel();reject(error);});
   try{if(hostNow()>=deadline)timeout();else cancel=ports.clock.alarm(deadline,timeout);}catch(error){done=true;reject(error);}
  });
 }
 const onCompletion=(event:TrackerACompletion)=>{
  try{
  const now=hostNow(),first=completion.firstHostMs===null;
  if(first){completion.firstHostMs=now;completion.format=event.traceFormat===undefined?null:event.traceFormat==='json'?'json':'other';completion.compression=event.streamCompression===undefined?null:event.streamCompression==='none'?'none':'other';completion.dataLoss=typeof event.dataLossOccurred==='boolean'?event.dataLossOccurred:null;}
  else{if(completion.overflowHostMs===null)completion.overflowHostMs=now;refuse('Unexpected tracing completion');}
  const validHandle=typeof event.stream==='string'&&event.stream.length>0&&event.stream.length<=4096&&new TextEncoder().encode(event.stream).length<=4096;
  if(validHandle){
   if(!handleValues.includes(event.stream as string)){
    if(handles.length<2){const accepted=first&&endRequested&&!failed;handleValues.push(event.stream as string);handles.push({ordinal:(handles.length+1) as 1|2,firstHostMs:now,role:accepted?'accepted':'unexpected',closeOperationOrdinal:null});}
    else if(handleOverflow===null)handleOverflow={firstHostMs:now,ordinal:3};
   }
  }else refuse('Invalid tracing handle');
  if(!first||!endRequested||completion.format!=='json'||completion.compression!=='none'||completion.dataLoss!==false)refuse('Unsupported tracing completion');
  completionResolve();
  }catch(error){remember(error);completionResolve();}
 };
 const onClose=(match:boolean)=>{
  try{
  if(sessionClose.firstHostMs===null){sessionClose.firstHostMs=hostNow();sessionClose.originalSessionMatch=match;sessionClose.timing=detachRequested&&safeDetach&&match?'expected-detach':'unexpected-loss';}
  else{if(sessionClose.overflowHostMs===null)sessionClose.overflowHostMs=hostNow();refuse('Duplicate session close');}
  if(!match||sessionClose.timing!=='expected-detach')refuse('Unexpected session close');closeResolve();
  }catch(error){remember(error);closeResolve();}
 };
 async function listener(row:ListenerOriginal,call:()=>void|Promise<void>){row.requestedHostMs=hostNow();row.status='pending';try{await call();row.status='fulfilled';}catch(error){row.status='rejected';remember(error);throw error;}finally{row.settledHostMs=hostNow();}}
 function invoke<T>(kind:OperationKind,call:()=>Promise<T>,handleOrdinal:1|2|null=null,bytes:number|null=null,readOperationOrdinal:number|null=null):Promise<T>{
  if(operations.length>=1031)return Promise.reject(refuse('Collector port capacity'));
  const row:TrackerATraceOperation={ordinal:operations.length+1,kind,requestedHostMs:hostNow(),settledHostMs:null,status:'pending',timedOut:false,handleOrdinal,bytes:null,eof:null,readOperationOrdinal};operations.push(row);if(kind==='read')readCalls++;
  let original:Promise<T>;
  try{original=call();if(kind==='sink-finish')observeSink();}catch(error){row.status='rejected';remember(error);try{row.settledHostMs=hostNow();}catch{}return Promise.reject(error);}
  const observed=original.then(value=>{row.status='fulfilled';row.settledHostMs=hostNow();if(kind==='write')row.bytes=bytes;observeSink();return value;},error=>{row.status='rejected';remember(error);try{row.settledHostMs=hostNow();}catch{}observeSink();throw error;});
  originals.push(observed);void observed.catch(()=>{});return observed;
 }
 function copyRawRef(value:TrackerAFileRef|null):TrackerAFileRef|null{
  if(value===null||typeof value!=='object')return null;
  const fields=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(fields).length!==3||!fields.path||!('value'in fields.path)||fields.path.value!=='tracker-a-case-2-trace.json'||!fields.bytes||!('value'in fields.bytes)||!Number.isSafeInteger(fields.bytes.value)||fields.bytes.value<0||fields.bytes.value>knownReadBytes||!fields.sha256||!('value'in fields.sha256)||typeof fields.sha256.value!=='string'||!/^[0-9a-f]{64}$/.test(fields.sha256.value))return null;
  return {path:'tracker-a-case-2-trace.json',bytes:fields.bytes.value as number,sha256:fields.sha256.value as string};
 }
 async function cleanup(){
  if(cleanupPromise)return cleanupPromise;
  const deadline=Math.min(enclosingDeadlineHostMs,hostNow()+1000);
  const work=(async()=>{
   // A timeout releases only the bounded waiter. Cleanup stays behind actual IO.
   for(const original of originals)try{await original;}catch{}
   if(!endRequested&&operations.find(row=>row.kind==='start')?.status==='fulfilled'){
    endRequested=true;try{await invoke('end',()=>ports.end());}catch{}
   }
   if(endRequested&&operations.find(row=>row.kind==='end')?.status==='fulfilled')await completed;
   await closeHandles();
   if(sink.created&&sink.finish==='not-started'&&operations.length<1031){
    sink.finish='pending';let result:TrackerAFileRef|null=null;
    try{result=await invoke('sink-finish',()=>ports.sink.finish());sink.finish='fulfilled';}catch{sink.finish='rejected';}
    observeSink();if(fsyncObserved)await fsyncObserved;await Promise.resolve();observeSink();if(fileCloseObserved)await fileCloseObserved;
    if(sink.finish==='fulfilled'&&(sink.fsync!=='fulfilled'||sink.fileClose!=='fulfilled'))refuse('Missing sink originals');
    const closedRef=sink.fileClose==='fulfilled'?copyRawRef(result):null;
    if(closedRef!==null)ref=closedRef;else if(result!==null)refuse('Invalid raw file reference');
   }
   if(!detachRequested&&operations.length<1031){safeDetach=eof&&handles.every(h=>h.closeOperationOrdinal!==null&&operations[h.closeOperationOrdinal-1]?.status==='fulfilled')&&sink.finish==='fulfilled'&&sink.fsync==='fulfilled'&&sink.fileClose==='fulfilled';detachRequested=true;try{await invoke('detach',()=>ports.detach());if(listeners.sessionClose.registration.status!=='not-started')await closed;}catch{}}
   await closeHandles();
   if(listeners.tracingComplete.registration.status!=='not-started')try{await listener(listeners.tracingComplete.removal,()=>ports.removeTracingComplete(onCompletion));}catch{}
   if(listeners.sessionClose.registration.status!=='not-started')try{await listener(listeners.sessionClose.removal,()=>ports.removeSessionClose(onClose));}catch{}
  })();cleanupPromise=bounded(work,deadline);void cleanupPromise.catch(()=>{});return cleanupPromise;
 }
 async function closeHandles(){
  for(let i=0;i<handles.length;i++){
   const handle=handles[i]!;if(handle.closeOperationOrdinal!==null)continue;
   if(operations.length>=1031){refuse('Pending handle close: port capacity');continue;}
   handle.closeOperationOrdinal=operations.length+1;try{await invoke('io-close',()=>ports.closeIO(handleValues[i]!),handle.ordinal);}catch{}
  }
 }
 const start=()=>{
  if(startPromise)return startPromise;activeDeadline=Math.min(enclosingDeadlineHostMs,hostNow()+10000);
  startPromise=bounded((async()=>{
  try{
   if(!sink.created||hostNow()>=enclosingDeadlineHostMs)throw refuse('Trace admission unavailable');
   await listener(listeners.tracingComplete.registration,()=>ports.installTracingComplete(onCompletion));listeners.tracingComplete.ownedIdentityMatch=true;check();
   await listener(listeners.sessionClose.registration,()=>ports.installSessionClose(onClose));listeners.sessionClose.ownedIdentityMatch=true;check();
   await invoke('start',()=>ports.start(TRACKER_A_TRACE_CONFIG));check();
  }catch(error){remember(error);try{await cleanup();}catch(error){remember(error);}throw primary;}
  })(),activeDeadline);return startPromise;
 };
 const finish=()=>{
  if(finishPromise)return finishPromise;activeDeadline=Math.min(enclosingDeadlineHostMs,hostNow()+10000);
  finishPromise=bounded((async()=>{
  try{
   if(!startPromise)throw refuse('Trace not started');await startPromise;check();endRequested=true;await invoke('end',()=>ports.end());await completed;check();
   const accepted=handles.findIndex(h=>h.role==='accepted');if(accepted<0)throw refuse('No accepted handle');
   for(;;){
    check();if(readCalls>=513)throw refuse('Trace read capacity');
    const data=await invoke('read',()=>ports.read(handleValues[accepted]!,65536),(accepted+1) as 1|2),read=operations.at(-1)!;
    if(typeof data.eof==='boolean')read.eof=data.eof;
    const bytes=decodeRead(data);read.bytes=bytes.length;knownReadBytes+=bytes.length;if(knownReadBytes>33554432)throw refuse('Raw byte capacity');
    check();if(bytes.length){await invoke('write',()=>ports.sink.write(bytes),(accepted+1) as 1|2,bytes.length,read.ordinal);writtenBytes+=bytes.length;}
    check();if(data.eof===true){eof=true;break;}
   }
  }catch(error){remember(error);}finally{try{await cleanup();}catch(error){remember(error);}finished=true;}
  if(!ref||ref.bytes!==knownReadBytes||writtenBytes!==knownReadBytes)refuse('Raw byte accounting');check();
  })(),activeDeadline,()=>{if(!operations.some(row=>row.status==='pending'&&['start','end','read','write'].includes(row.kind)))void cleanup().catch(()=>{});});return finishPromise;
 };
 const snapshot=()=>{
  const settled=operations.every(row=>row.status==='fulfilled'&&!row.timedOut),removed=Object.values(listeners).every(row=>row.registration.status==='fulfilled'&&row.removal.status==='fulfilled');
  const complete=finished&&!failed&&settled&&removed&&eof&&ref!==null&&sink.fsync==='fulfilled'&&sink.fileClose==='fulfilled'&&sessionClose.timing==='expected-detach';
  const containment=clockValid&&finished&&handles.every(h=>h.closeOperationOrdinal!==null&&operations[h.closeOperationOrdinal-1]?.status==='fulfilled')&&handleOverflow===null&&sink.fileClose==='fulfilled'&&operations.find(row=>row.kind==='detach')?.status==='fulfilled'&&sessionClose.originalSessionMatch===true&&removed;
  const rawRef=ref===null?null:{...ref};
  const raw=!sink.created?{status:'absent' as const,ref:null,extent:'unobserved' as const}:complete?{status:'complete-raw' as const,ref:rawRef,extent:'complete' as const}:{status:'known-prefix' as const,ref:rawRef,extent:'unknown' as const};
  return {schemaVersion:1 as const,kind:'tracker-a-transport' as const,mode:'tracker-json-a-pilot-v2' as const,profileRef:{...profileRef},raw,listeners:structuredClone(listeners),operations:structuredClone(operations),completion:{...completion},sessionClose:{...sessionClose},handles:structuredClone(handles),handleOverflow:handleOverflow===null?null:{...handleOverflow},sink:{...sink},portCalls:operations.length,readCalls,knownReadBytes,outcome:{capture:{status:complete?'complete' as const:'incomplete' as const,reason:complete?null:'transport' as const},containment:containment?'verified' as const:'unverified' as const},authority:{qualification:false as const,fps:'unavailable' as const,ratio:'unavailable' as const,scoring:false as const,ranking:false as const}};
 };
 return {start,finish,snapshot};
}
