import {performance} from 'node:perf_hooks';
import type {CDPSession} from 'playwright';
import {COMPARISON_CAPTURE_LIMITS,PRESENTATION_CAPABILITY,PRESENTATION_CONTRACT_VERSION,PRESENTATION_TRACE_CATEGORIES,presentationEvidenceSchema,comparisonTraceSchema,comparisonTraceAuxiliarySchema,type ComparisonTrace,type ComparisonTraceAuxiliary,type ComparisonCaptureStatus} from '@chat-ui-bench/contract';
import type {ComparisonSlotContext} from './long-thread-run.js';
import type {ComparisonPayloadFile,ComparisonRawStream} from './comparison-artifacts.js';

export interface ComparisonTraceCaptureOptions {context:ComparisonSlotContext;session:CDPSession;isolatedBrowserProcess:boolean;singleWorkloadPage:boolean;now?:()=>number}
export interface ComparisonTraceSnapshot {trace:ComparisonTrace;auxiliary:ComparisonTraceAuxiliary;traceEof:ComparisonCaptureStatus['traceEof'];payload:ComparisonPayloadFile}
export interface ComparisonTraceCapture {start():Promise<void>;finish():Promise<void>;snapshot():ComparisonTraceSnapshot;close():Promise<void>}
export interface ComparisonTraceProtocolBoundary {
 send(method:'Page.getFrameTree'|'Target.getTargetInfo'|'Tracing.end'):Promise<unknown>;
 send(method:'Tracing.start',params:{categories:string;transferMode:'ReturnAsStream';streamFormat:'json';streamCompression:'none'}):Promise<unknown>;
 send(method:'IO.read',params:{handle:string;size:65536}):Promise<unknown>;
 send(method:'IO.close',params:{handle:string}):Promise<unknown>;
 on(event:'Tracing.bufferUsage'|'Tracing.tracingComplete',listener:(payload:unknown)=>void):unknown;
 on(event:'close',listener:()=>void):unknown;
 off(event:'Tracing.bufferUsage'|'Tracing.tracingComplete',listener:(payload:unknown)=>void):unknown;
 off(event:'close',listener:()=>void):unknown;
 detach():Promise<void>;
}
export interface ComparisonTraceProtocolFixtureOptions {context:ComparisonSlotContext;protocol:ComparisonTraceProtocolBoundary;isolatedBrowserProcess:boolean;singleWorkloadPage:boolean;now?:()=>number}
function makeTraceCommands(protocol:ComparisonTraceProtocolBoundary) {
 return {
  getFrameTree:()=>protocol.send('Page.getFrameTree'),getTargetInfo:()=>protocol.send('Target.getTargetInfo'),
  start:()=>protocol.send('Tracing.start',{categories:PRESENTATION_TRACE_CATEGORIES.join(','),transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'none'}),
  end:()=>protocol.send('Tracing.end'),read:(handle:string)=>protocol.send('IO.read',{handle,size:65536}),closeHandle:(handle:string)=>protocol.send('IO.close',{handle}),detach:()=>protocol.detach(),
  onBufferUsage:(cb:(payload:unknown)=>void)=>{protocol.on('Tracing.bufferUsage',cb);},offBufferUsage:(cb:(payload:unknown)=>void)=>{protocol.off('Tracing.bufferUsage',cb);},
  onComplete:(cb:(payload:unknown)=>void)=>{protocol.on('Tracing.tracingComplete',cb);},offComplete:(cb:(payload:unknown)=>void)=>{protocol.off('Tracing.tracingComplete',cb);},
  onClosed:(cb:()=>void)=>{protocol.on('close',cb);},offClosed:(cb:()=>void)=>{protocol.off('close',cb);},
 };
}
const missing=(reason:string)=>({status:'unavailable' as const,reason});
function field(value:unknown,key:string):unknown {if(typeof value!=='object'||value===null)return undefined;const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&'value' in descriptor?descriptor.value:undefined;}
function finite(v:unknown):v is number {return typeof v==='number'&&Number.isFinite(v)&&v>=0;}
function text(v:unknown):v is string {return typeof v==='string'&&v.length>0&&v.length<=4096;}
function diagnostic(error:unknown):string {const v=error instanceof Error?error.message||error.name:String(error);return v.length>4096?v.slice(0,4075)+' [message truncated]':v||'Empty rejection';}

/** CDP allocates plain protocol JSON before this boundary. This bounds our
 * traversal/retention; it does not sandbox hostile proxies or engine enumerators. */
function admitTopology(root:unknown):boolean {
 const limits=COMPARISON_CAPTURE_LIMITS;
 let tokens=0,bytes=0,verificationWork=0;
 const ancestors=new Set<object>();
 function charge(t:number,b:number){if(t>limits.maxRecordTokens-tokens||b>limits.maxRecordSerializedBytes-bytes)throw new Error('Topology budget');tokens+=t;bytes+=b;}
 function stringBytes(value:string){if(value.length+2>limits.maxRecordSerializedBytes-bytes)throw new Error('Topology string budget');charge(0,2);
  for(let i=0;i<value.length;i++) {const c=value.charCodeAt(i);let size:number;
   if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)size=2;
   else if(c<32)size=6;else if(c<128)size=1;else if(c<2048)size=2;
   else if(c>=0xd800&&c<=0xdbff&&i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){size=4;i++;}
   else if(c>=0xd800&&c<=0xdfff)size=6;else size=3;
   charge(0,size);
  }
 }
 function* keys(object:object):Generator<string> {for(const key in object)if(Object.hasOwn(object,key))yield key;}
 type Frame={object:object;depth:number;iterator:Generator<string>;length:number|null;index:number;comma:boolean};
 const stack:Frame[]=[];
 function enter(value:unknown,depth:number) {
  if(depth>limits.maxRecordDepth)throw new Error('Topology depth');
  if(value===null){charge(1,4);return;}
  if(typeof value==='string'){charge(2,0);stringBytes(value);return;}
  if(typeof value==='boolean'){charge(2,value?4:5);return;}
  if(typeof value==='number'&&Number.isFinite(value)){charge(2,String(value).length);return;}
  if(typeof value!=='object'||value===null)throw new Error('Topology non JSON');
  if(ancestors.has(value))throw new Error('Topology cycle');
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
  if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)throw new Error('Topology nonplain');
  charge(2,2);
  let length:number|null=null;
  if(array){const descriptor=Object.getOwnPropertyDescriptor(value,'length');const actualLength:unknown=descriptor&&'value' in descriptor?descriptor.value:undefined;if(typeof actualLength!=='number'||!Number.isSafeInteger(actualLength)||actualLength<0)throw new Error('Topology array length');length=actualLength;
   if(length!>limits.maxRecordTokens-tokens||length!+Math.max(0,length!-1)>limits.maxRecordSerializedBytes-bytes)throw new Error('Topology array lower bound');
  }
  ancestors.add(value);stack.push({object:value,depth,iterator:keys(value),length,index:0,comma:false});
 }
 function childCapacity(frame:Frame){if(frame.depth>=limits.maxRecordDepth||tokens>=limits.maxRecordTokens||bytes>=limits.maxRecordSerializedBytes)throw new Error('Topology child budget');}
 try {
  enter(root,0);
  while(stack.length){const current=stack[stack.length-1]!;let key:string;
   if(current.length!==null) {
    if(current.index>=current.length){
     while(true){if(verificationWork>=limits.maxRecordTokens)throw new Error('Topology array verification budget');const next=current.iterator.next();if(next.done)break;verificationWork++;const candidate=next.value;
      if(candidate.length>10||!/^(0|[1-9][0-9]*)$/.test(candidate)||Number(candidate)>=current.length)throw new Error('Topology array extra field');
     }
     stack.pop();ancestors.delete(current.object);continue;
    }
    childCapacity(current);key=String(current.index++);if(current.comma)charge(0,1);current.comma=true;
   } else {
    const next=current.iterator.next();if(next.done){stack.pop();ancestors.delete(current.object);continue;}
    childCapacity(current);key=next.value;charge(1,current.comma?2:1);current.comma=true;stringBytes(key);
   }
   // No getter executes. Capacity/key work is charged before descriptor access.
   childCapacity(current);const descriptor=Object.getOwnPropertyDescriptor(current.object,key);
   if(!descriptor||!descriptor.enumerable||!('value' in descriptor))throw new Error('Topology unsupported property');
   enter(descriptor.value,current.depth+1);
  }
  return true;
 }catch{return false;}
}
function chunkBytes(value:unknown):{bytes:Uint8Array;eof:boolean} {
 const data=field(value,'data'),eof=field(value,'eof'),encoded=field(value,'base64Encoded');
 if(typeof data!=='string'||typeof eof!=='boolean'||encoded!==undefined&&typeof encoded!=='boolean')throw new Error('Invalid IO.read payload');
 if(encoded) {
  if(data.length>87384||data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw new Error('Invalid bounded base64');
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',padding=data.endsWith('==')?2:data.endsWith('=')?1:0;
  if(padding===2&&(alphabet.indexOf(data[data.length-3]!)&15)!==0||padding===1&&(alphabet.indexOf(data[data.length-2]!)&3)!==0)throw new Error('Noncanonical base64 padding');
  const length=data.length/4*3-padding;if(length>65536)throw new Error('Decoded chunk exceeds read bound');
  return {bytes:Buffer.from(data,'base64'),eof};
 }
 if(data.length>65536)throw new Error('UTF8 chunk exceeds read bound');let length=0;
 for(let i=0;i<data.length;i++){const c=data.charCodeAt(i);if(c<128)length++;else if(c<2048)length+=2;else if(c>=0xd800&&c<=0xdbff){const next=data.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw new Error('Lone surrogate in trace chunk');length+=4;}else if(c>=0xdc00&&c<=0xdfff)throw new Error('Lone surrogate in trace chunk');else length+=3;if(length>65536)throw new Error('UTF8 chunk exceeds read bound');}
 return {bytes:Buffer.from(data,'utf8'),eof};
}
function createCapture(o:Omit<ComparisonTraceProtocolFixtureOptions,'protocol'>,commands:ReturnType<typeof makeTraceCommands>):ComparisonTraceCapture {
 const ctx=o.context.ownership,now=o.now??(()=>performance.now());
 if(ctx.stage!=='replay')throw new Error('Trace capture requires replay ownership');ctx.assertActive();
 let closed=false,started=false,finished=false,finishSettled=false,complete=false,sessionClosed=false;
 let closeListening=false,usageListening=false,completeListening=false;
 let closeAttempt:Promise<void>|undefined,detachAttempt:Promise<void>|undefined,rawComplete:Promise<void>|undefined,raw:ComparisonRawStream|undefined;
 let failed=false,firstError:unknown,reason='Trace acquisition incomplete',overflowFailure:Error|undefined;const cleanupErrors:unknown[]=[];
 const pending=new Set<Promise<unknown>>();
 type Lane={handle:string;close:Promise<void>|undefined};let primary:Lane|undefined,unexpected:Lane|undefined;
 const usage:Extract<ComparisonTrace,{status:'available'}>['bufferUsage']=[];
 let observed=0,invalid=0,dropped=0,completionReceived=false;
 let completion:ComparisonTraceAuxiliary['completion']=missing('Tracing completion not received');
 let tracingComplete:Extract<ComparisonTrace,{status:'available'}>['tracingComplete']=missing('Tracing completion not received');
 let presentation:Extract<ComparisonTrace,{status:'available'}>['presentation']=missing('Before-tracing topology unavailable');
 let traceEof:ComparisonCaptureStatus['traceEof']=missing('Trace EOF not received');
 let resolveCompletion!:()=>void,resolveClosed!:()=>void;
 const completionEvent=new Promise<void>(resolve=>{resolveCompletion=resolve;}),closedEvent=new Promise<void>(resolve=>{resolveClosed=resolve;});
 function fail(error:unknown){if(!failed){failed=true;firstError=error;reason=diagnostic(error);}complete=false;}
 function track<T>(invoke:()=>Promise<T>,cleanup=false):Promise<T>{let promise:Promise<T>;try{promise=invoke();}catch(error){promise=Promise.reject(error);}const task=promise.then(v=>v,error=>{fail(error);if(cleanup&&cleanupErrors.length<8)cleanupErrors.push(error);throw error;});pending.add(task);void task.then(()=>pending.delete(task),()=>pending.delete(task));return task;}
 function active(){if(closed)throw new Error('Trace collector closed');ctx.assertActive();}
 function closeLane(lane:Lane){if(!lane.close){lane.close=track(()=>commands.closeHandle(lane.handle).then(()=>{}),true);void lane.close.catch(()=>{});}return lane.close;}
 function completeRaw(){if(raw&&!rawComplete){rawComplete=track(()=>raw!.complete(),true);void rawComplete.catch(()=>{});}return rawComplete;}
 function detach(){if(!detachAttempt){detachAttempt=track(commands.detach,true);void detachAttempt.catch(()=>{});}return detachAttempt;}
 function onClosed(){sessionClosed=true;resolveClosed();resolveCompletion();if(!completionReceived)fail(new Error('Session closed before tracing completion'));}
 function onUsage(payload:unknown) {
  if(observed===Number.MAX_SAFE_INTEGER){fail(new Error('Trace callback count overflow'));return;}observed++;
  if(observed>256){dropped++;fail(new Error('Trace usage callback admission overflow'));return;}
  const entry:typeof usage[number]={observedAtHostMs:now()};let valid=finite(entry.observedAtHostMs)&&typeof payload==='object'&&payload!==null;
  for(const key of ['percentFull','value','eventCount'] as const){const v=field(payload,key);if(v!==undefined){if(finite(v)&&(key==='eventCount'||v<=1))entry[key]=v;else valid=false;}}
  if(valid)usage.push(entry);else {invalid++;fail(new Error('Invalid trace usage callback'));}
 }
 function onComplete(payload:unknown) {
  const handle=field(payload,'stream');
  if(completionReceived){fail(new Error('Duplicate tracing completion'));if(text(handle)){
    if(primary?.handle===handle)closeLane(primary);else if(unexpected?.handle===handle)closeLane(unexpected);
    else if(!unexpected){unexpected={handle,close:undefined};closeLane(unexpected);}
    else {overflowFailure??=new Error('Unexpected trace handle overflow; additional identifiers omitted and containment unverified');fail(overflowFailure);reason=overflowFailure.message;}
   } else fail(new Error('Unverified unexpected tracing handle'));
   void detach();return;
  }
  completionReceived=true;
  const fact:Extract<ComparisonTraceAuxiliary['completion'],{status:'available'}>['value']={observedAtHostMs:now()};
  const loss=field(payload,'dataLossOccurred'),format=field(payload,'traceFormat'),compression=field(payload,'streamCompression');
  if(typeof loss==='boolean')fact.dataLossOccurred=loss;else if(loss!==undefined)fail(new Error('Invalid dataLossOccurred'));
  if(text(handle)){fact.stream=handle;primary={handle,close:undefined};}else fail(new Error('Missing or invalid trace stream'));
  if(format==='json'||format==='proto')fact.traceFormat=format;else if(format!==undefined)fail(new Error('Invalid trace format'));
  if(compression==='none'||compression==='gzip')fact.streamCompression=compression;else if(compression!==undefined)fail(new Error('Invalid stream compression'));
  completion={status:'available',value:fact};
  if(fact.dataLossOccurred===undefined)tracingComplete=missing('missing dataLossOccurred');else tracingComplete={status:'available',value:{dataLossOccurred:fact.dataLossOccurred,...(fact.stream?{stream:fact.stream}:{}),...(fact.traceFormat?{traceFormat:fact.traceFormat}:{}),...(fact.streamCompression?{streamCompression:fact.streamCompression}:{})}};
  if(loss!==false)fail(new Error(loss===undefined?'missing dataLossOccurred':'Trace data loss or invalid loss state'));
  if(format==='proto'||compression==='gzip')fail(new Error('Unsupported trace format or compression'));
  resolveCompletion();
  if(closed&&primary)closeLane(primary);
 }
 function close():Promise<void> {
  if(closeAttempt)return closeAttempt;closed=true;complete=complete&&!failed;
  if(primary)closeLane(primary);if(unexpected)closeLane(unexpected);completeRaw();detach();
  closeAttempt=(async()=>{
   while(pending.size)await Promise.allSettled([...pending]);
   if((closeListening||usageListening||completeListening)&&!sessionClosed){await closedEvent;while(pending.size)await Promise.allSettled([...pending]);}
   if(sessionClosed){
    function remove(invoke:()=>void){try{invoke();}catch(error){fail(error);if(cleanupErrors.length<8)cleanupErrors.push(error);}}
    if(usageListening)remove(()=>commands.offBufferUsage(onUsage));
    if(completeListening)remove(()=>commands.offComplete(onComplete));
    if(closeListening)remove(()=>commands.offClosed(onClosed));
    usageListening=false;completeListening=false;closeListening=false;
   }
   ctx.signal.removeEventListener('abort',abort);
   if(failed)throw new AggregateError([firstError,...(overflowFailure?[overflowFailure]:[]),...cleanupErrors],'Trace acquisition or cleanup failed');
  })();void closeAttempt.catch(()=>{});return closeAttempt;
 }
 function abort(){if(!finishSettled){complete=false;fail(new Error('Trace ownership revoked'));}void close().catch(()=>{});}
 const adoption=ctx.adopt({name:'comparison-trace',close});void adoption.catch(fail);ctx.signal.addEventListener('abort',abort,{once:true});
 async function operation(body:()=>Promise<void>){try{await adoption;active();await body();}catch(error){fail(error);void close().catch(()=>{});throw error;}}
 return {
  async start(){if(started)throw new Error('Trace start cannot be retried');started=true;await operation(async()=>{
   // Observe genuine closure before any subsequent registration can fail. Mark
   // each attempted registration independently, including install-then-throw.
   closeListening=true;commands.onClosed(onClosed);
   usageListening=true;commands.onBufferUsage(onUsage);
   completeListening=true;commands.onComplete(onComplete);
   let frames:unknown=await track(commands.getFrameTree);active();const frameAdmitted=admitTopology(frames);if(!frameAdmitted)frames=undefined;active();
   let targets:unknown=await track(commands.getTargetInfo);active();const targetAdmitted=admitTopology(targets);if(!targetAdmitted)targets=undefined;active();
   if(frameAdmitted&&targetAdmitted){const info=field(targets,'targetInfo');try{presentation={status:'available',value:presentationEvidenceSchema.parse({capability:PRESENTATION_CAPABILITY,contractVersion:PRESENTATION_CONTRACT_VERSION,sessionTarget:field(info,'type'),targetId:field(info,'targetId'),appURL:field(info,'url'),frameTree:frames,frameTreeCapturePoint:'before-tracing',isolatedBrowserProcess:o.isolatedBrowserProcess,singleWorkloadPage:o.singleWorkloadPage})};}catch{presentation=missing('Before-tracing topology unavailable');}}
   else presentation=missing('Before-tracing topology exceeds bounded JSON admission or is unsupported');
   frames=undefined;targets=undefined;active();
   raw=await track(()=>o.context.writer.stream('trace.json').then(value=>{raw=value;if(closed)completeRaw();return value;}));active();await track(commands.start);active();
  });},
  async finish(){if(finished)throw new Error('Trace finish cannot be retried');finished=true;if(!started)throw new Error('Trace has not started');await operation(async()=>{
   await track(commands.end);active();await completionEvent;active();if(!primary)throw new Error('Tracing completion stream unavailable');
   if(failed)throw firstError;
   while(true){active();let receipt=0;const response=await track(()=>commands.read(primary!.handle).then(v=>{receipt=now();return v;}));const chunk=chunkBytes(response);
    if(chunk.eof)traceEof={status:'available',value:{observedAtHostMs:receipt,clockDomain:'host-monotonic-ms'}};
    active();
    if(chunk.bytes.length){if(!raw)throw new Error('Trace raw stream unavailable');await track(()=>raw!.write(chunk.bytes));active();}
    if(chunk.eof)break;
   }
   // Start both independent operations before awaiting either.
   const io=closeLane(primary),persistence=completeRaw();await Promise.allSettled([io,persistence]);active();if(failed)throw firstError;
   finishSettled=true;
   complete=presentation.status==='available'&&o.isolatedBrowserProcess===true&&o.singleWorkloadPage===true&&completion.status==='available'&&completion.value.dataLossOccurred===false&&traceEof.status==='available'&&!!persistence;
   if(!complete)reason='Trace acquired but required presentation or completion facts unavailable';
  });},
  snapshot(){const isComplete=complete&&!failed;const partialReason=reason;
   const trace=comparisonTraceSchema.parse({status:'available',format:'cdp-json',file:'trace.json',categories:[...PRESENTATION_TRACE_CATEGORIES],complete:isComplete,...(isComplete?{}:{reason:partialReason}),tracingComplete,bufferUsage:usage,presentation});
   const auxiliary=comparisonTraceAuxiliarySchema.parse({...o.context.identity,cap:256,observedCallbacks:observed,retainedCallbacks:usage.length,droppedCallbacks:dropped,invalidCallbacks:invalid,status:isComplete?'complete':'partial',...(isComplete?{}:{reason:partialReason}),completion});
   return {trace,auxiliary,traceEof:structuredClone(traceEof),payload:{path:'trace.json',status:isComplete?'complete':'partial',...(isComplete?{}:{reason:partialReason})}};
  },close,
 };
}
export function createComparisonTraceCapture(o:ComparisonTraceCaptureOptions):ComparisonTraceCapture {return createCapture(o,makeTraceCommands(o.session));}
export function createComparisonTraceCaptureForProtocolFixture(o:ComparisonTraceProtocolFixtureOptions):ComparisonTraceCapture {return createCapture(o,makeTraceCommands(o.protocol));}
