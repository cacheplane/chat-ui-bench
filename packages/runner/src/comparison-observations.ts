import type {createComparisonBuffer, ComparisonPrimitiveToken, ComparisonBufferState, ComparisonBoundedBuffer, ComparisonInstrumentation, ComparisonPhase, ComparisonPhaseInstance, ComparisonOpenPhase, ComparisonCheckpoints, ComparisonGeometry, ComparisonRect, ComparisonHostFrameGuard, ComparisonExceptions, CaptureCandidate, CaptureCandidates, CaptureAvailability, LongThreadCaptureHost} from '@chat-ui-bench/contract';
import type {PreNavigationOptions,MainOptions,freshMainOptionsSchema} from '@chat-ui-bench/contract';
type FreshMainOptions=typeof freshMainOptionsSchema['_output'];
export type PageException=ComparisonExceptions['exceptions'][number];
export type DrainedPageEntry={readonly cohort:'observation'|'exception';readonly serialized:string};
export type ScrollSnapshot=ComparisonCheckpoints['scroll'][number];
export interface PreNavigationState {drain(maxEntries?:number):string[];state():ComparisonBufferState;stop():void;}
export interface PreNavigationTransferState {sourceFinal:ComparisonBufferState|null;attempted:number;accepted:number;rejected:number;failureReason:string|null;remainingEntries:number;remainingSerializedBytes:number;complete:boolean;}
type BufferFactory=typeof createComparisonBuffer;
type Tokens=ComparisonPrimitiveToken[];
type PageGlobals=Window&typeof globalThis&{comparisonPreNavigation?:PreNavigationState;comparisonCapture?:ComparisonPageState;benchHost?:LongThreadCaptureHost};

/** All live helpers are nested so these compiled bytes require no module closure. */
export function installComparisonPreNavigation(createComparisonBuffer:BufferFactory,options:PreNavigationOptions):PreNavigationState {
  const page=window as PageGlobals;if(page[options.stateGlobal])throw new Error('Pre-navigation capture already installed');
  const queue=createComparisonBuffer('pre-navigation-errors'),limits=queue.limits;let stopped=false;
  function cap(value:string,max:number):string {const suffix='[diagnostic truncated]';return value.length>max?value.slice(0,max-suffix.length)+suffix:value;}
  function diagnostic(value:unknown):{message:string;stack:string|null} {
    if(value===null)return {message:'null',stack:null};
    if(typeof value==='string')return {message:cap(value,limits.maxDiagnosticFieldCodeUnits),stack:null};
    if(typeof value==='bigint')return {message:'[bigint diagnostic value]',stack:null};
    if(typeof value==='number'||typeof value==='boolean'||typeof value==='undefined')return {message:cap(String(value),limits.maxDiagnosticFieldCodeUnits),stack:null};
    const intrinsic=(Error as ErrorConstructor&{isError?:(value:unknown)=>boolean}).isError;
    if(typeof intrinsic==='function')try {if(intrinsic(value)) {
      const m=Object.getOwnPropertyDescriptor(value,'message'),k=Object.getOwnPropertyDescriptor(value,'stack');
      return {message:m&&'value' in m&&typeof m.value==='string'?cap(m.value,limits.maxDiagnosticFieldCodeUnits):'[Error message unavailable]',stack:k&&'value' in k&&typeof k.value==='string'?cap(k.value,limits.maxDiagnosticStackCodeUnits):null};
    }}catch{}
    return {message:'[opaque diagnostic value]',stack:null};
  }
  function append(source:'page'|'console',severity:'error'|'warning',message:string,stack:string|null):void {
    if(stopped)return;const timestampMs=performance.now();if(!Number.isFinite(timestampMs)||timestampMs<0)return;
    queue.enqueue('object',7,'source','string',source,'stage','string','setup','clockDomain','string','page-performance-ms','timestampMs','number',timestampMs,'message','string',cap(message||'[empty diagnostic]',limits.maxDiagnosticMessageCodeUnits),'stack',...(stack===null?['null']:['string',cap(stack,limits.maxDiagnosticStackCodeUnits)]) as Tokens,'severity','string',severity);
  }
  function error(event:ErrorEvent):void {const d=diagnostic(event.error);append('page','error',typeof event.message==='string'&&event.message?cap(event.message,limits.maxDiagnosticMessageCodeUnits):d.message,d.stack);}
  function rejection(event:PromiseRejectionEvent):void {const d=diagnostic(event.reason);append('page','error',d.message,d.stack);}
  const originals={warn:console.warn,error:console.error};
  function wrapper(kind:'warn'|'error'){return function(this:Console,...args:unknown[]):void {
    if(!stopped){let message='',stack:string|null=null;for(let i=0;i<Math.min(args.length,limits.maxConsoleArguments);i++){const d=diagnostic(args[i]);message=cap(message+(i?' ':'')+d.message,limits.maxDiagnosticMessageCodeUnits);if(stack===null)stack=d.stack;}append('console',kind==='warn'?'warning':'error',message,stack);}
    Reflect.apply(originals[kind],this,args);
  };}
  const wrappers={warn:wrapper('warn'),error:wrapper('error')};
  addEventListener('error',error);addEventListener('unhandledrejection',rejection);console.warn=wrappers.warn;console.error=wrappers.error;
  function drain(maxEntries=1):string[]{if(!Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>64)throw new Error('Invalid pre-navigation drain size');return (queue.drain as (size:number)=>string[])(maxEntries);}
  function stop():void {
    if(stopped)return;stopped=true;
    let failed=false,firstFailure:unknown;
    function attempt(cleanup:()=>void):void{try{cleanup();}catch(error){if(!failed){failed=true;firstFailure=error;}}}
    attempt(()=>removeEventListener('error',error));attempt(()=>removeEventListener('unhandledrejection',rejection));
    attempt(()=>{if(console.warn===wrappers.warn)console.warn=originals.warn;});attempt(()=>{if(console.error===wrappers.error)console.error=originals.error;});
    // Fail closed only after every cleanup attempt; the source queue remains retrievable.
    if(failed)throw firstFailure;
  }
  const state={drain,state:queue.state,stop};page[options.stateGlobal]=state;return state;
}

export function installComparisonObservations(createComparisonBuffer:BufferFactory,options:MainOptions|FreshMainOptions) {
  const page=window as PageGlobals;if(page[options.stateGlobal])throw new Error('Page capture already installed');
  const queue=createComparisonBuffer('page-observations'),limits=queue.limits,bridge=page[options.bridgeGlobal];
  let stopped=false,stopInProgress=false,timer:ReturnType<typeof setTimeout>|null=null,stage:PageException['stage']='setup';
  const instances:ComparisonPhaseInstance[]=[];let open:ComparisonOpenPhase|null=null,phaseFailure:string|null=null;
  const phases:ComparisonPhase[]=['setup','history-ready','streaming-follow','composer-input','history-reading','return-to-response','replay-end','validation','disposal'];
  function cap(value:string,max:number=limits.maxDiagnosticFieldCodeUnits):string {const suffix='[diagnostic truncated]';return value.length>max?value.slice(0,max-suffix.length)+suffix:value;}
  function failureMessage(value:unknown):string{if(typeof value==='string')return cap(value);const d=diagnostic(value);return d.message==='[opaque diagnostic value]'?'[capture operation failed]':d.message;}
  function s(value:string):Tokens{return ['string',value];}function n(value:number):Tokens{return ['number',value];}function b(value:boolean):Tokens{return ['boolean',value];}
  function nullable(value:string|number|null):Tokens{return value===null?['null']:typeof value==='string'?s(value):n(value);}
  /** Explicit owned field pairs only, never arbitrary object traversal. */
  function object(...fields:[string,Tokens][]):Tokens{const out:Tokens=['object',fields.length];for(const [key,value] of fields)out.push(key,...value);return out;}
  function array(values:Tokens[]):Tokens{const out:Tokens=['array',values.length];for(const value of values)out.push(...value);return out;}
  function project(state:ComparisonBufferState|ComparisonBoundedBuffer):ComparisonBoundedBuffer{return {name:state.name,maxEntries:state.maxEntries,maxSerializedBytes:state.maxSerializedBytes,highWaterEntries:state.highWaterEntries,highWaterSerializedBytes:state.highWaterSerializedBytes,overflowCount:state.overflowCount,rejectedRecordCount:state.rejectedRecordCount,status:state.status,...(state.reason===undefined?{}:{reason:state.reason})};}
  function attribute(time:number){const match=instances.find(v=>time>=v.startMs&&time<v.endMs)??(open&&time>=open.startMs?open:null);return match?{phase:match.phase,phaseInstanceId:match.instanceId,attributionReason:null}:{phase:null,phaseInstanceId:null,attributionReason:'No actual phase interval contains the page timestamp'};}
  function observation(kind:string,data:Tokens,timestampMs=performance.now(),sequence:number|null=null):boolean {
    const a=attribute(timestampMs);return queue.enqueue(...object(['cohort',s('observation')],['record',object(['schemaVersion',n(2)],['repetition',s(options.identity.repetition)],['phase',nullable(a.phase)],['sequence',nullable(sequence)],['timestampMs',n(timestampMs)],['phaseInstanceId',nullable(a.phaseInstanceId)],['attributionReason',nullable(a.attributionReason)],['clockDomain',s('page-performance-ms')],['kind',s(kind)],['data',data])]));
  }
  function unavailable(probe:'runtime'|'dom'|'candidates'|'geometry'|'native-input',reason:string,time=performance.now()):void{observation('probe-unavailable',object(['probe',s(probe)],['reason',s(cap(reason)||'Probe unavailable')]),time);}
  function phaseRecord(boundary:'start'|'end',phase:ComparisonPhase,instanceId:string,time:number):void {
    queue.enqueue(...object(['cohort',s('observation')],['record',object(['schemaVersion',n(2)],['repetition',s(options.identity.repetition)],['phase',s(phase)],['sequence',['null']],['timestampMs',n(time)],['clockDomain',s('page-performance-ms')],['phaseInstanceId',s(instanceId)],['kind',s('phase')],['data',object(['boundary',s(boundary)],['markName',s(`bench:comparison:${phase}:${instanceId}:${boundary}`)])])]));
  }
  function closePhase():void {
    if(stopped)throw new Error('Capture stopped');if(!open)return;
    try{if(!bridge)throw new Error('Bridge unavailable');const boundary=bridge.markPhase(open.phase,'end');
      if(boundary.phase!==open.phase||boundary.instanceId!==open.instanceId||boundary.boundary!=='end'||!Number.isFinite(boundary.timestampMs)||boundary.timestampMs<=open.startMs)throw new Error('Invalid actual closing boundary');
      const closed={...open,endMs:boundary.timestampMs,endMark:`bench:comparison:${open.phase}:${open.instanceId}:end`};instances.push(closed);open=null;phaseRecord('end',closed.phase,closed.instanceId,closed.endMs);
    }catch(error){phaseFailure=failureMessage(error);throw error;}
  }
  function setPhase(phase:ComparisonPhase):void {
    if(stopped)throw new Error('Capture stopped');if(!phases.includes(phase))throw new Error('Unknown phase');
    if(instances.length+(open?1:0)>=limits.maxPendingEntries)throw new Error('Phase registry entry limit exceeded');if(open)closePhase();
    try{if(!bridge)throw new Error('Bridge unavailable');const boundary=bridge.markPhase(phase,'start');
      if(boundary.phase!==phase||boundary.boundary!=='start'||typeof boundary.instanceId!=='string'||!/^(0|[1-9][0-9]*)$/.test(boundary.instanceId)||boundary.instanceId.length>limits.maxDiagnosticFieldCodeUnits||instances.some(v=>v.instanceId===boundary.instanceId)||!Number.isFinite(boundary.timestampMs)||boundary.timestampMs<0||(instances.length>0&&boundary.timestampMs<instances[instances.length-1]!.endMs))throw new Error('Invalid actual starting boundary');
      open={phase,instanceId:boundary.instanceId,startMs:boundary.timestampMs,startMark:`bench:comparison:${phase}:${boundary.instanceId}:start`};stage=phase==='setup'||phase==='history-ready'?'setup':phase==='validation'?'validation':phase==='disposal'?'disposal':'replay';phaseRecord('start',phase,boundary.instanceId,boundary.timestampMs);
    }catch(error){phaseFailure=failureMessage(error);throw error;}
  }
  function readPhases(){return {instances:instances.map(v=>({...v})),openPhase:open?{...open}:null,status:phaseFailure!==null||open!==null?'partial' as const:'complete' as const,...(phaseFailure!==null||open!==null?{reason:phaseFailure??'Actual phase remains open'}:{})};}
  const pre=page[options.preNavigationGlobal];let sourceFinal:ComparisonBufferState|null=null,attempted=0,accepted=0,rejected=0,transferFailure:string|null=null;
  if(pre){pre.stop();sourceFinal=Object.freeze({...pre.state()});}
  function readPreNavigationTransfer():PreNavigationTransferState{const current=pre?.state();return {sourceFinal:sourceFinal?{...sourceFinal}:null,attempted,accepted,rejected,failureReason:transferFailure,remainingEntries:current?.pendingEntries??0,remainingSerializedBytes:current?.pendingSerializedBytes??0,complete:pre!==undefined&&current?.pendingEntries===0};}
  function transferPreNavigation(maxEntries=64):PreNavigationTransferState {
    if(!Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>64)throw new Error('Invalid transfer size');if(!pre){transferFailure='Pre-navigation source unavailable';return readPreNavigationTransfer();}
    for(let i=0;i<maxEntries;i++){const record=pre.drain(1)[0];if(record===undefined)break;attempted++;
      try{if(typeof record!=='string'||record.length>limits.maxRecordSerializedBytes)throw new Error('Invalid owned source string');const v=JSON.parse(record) as PageException;
        if(v===null||typeof v!=='object'||Array.isArray(v)||Object.keys(v).join(',')!=='source,stage,clockDomain,timestampMs,message,stack,severity'||(v.source!=='page'&&v.source!=='console')||v.stage!=='setup'||v.clockDomain!=='page-performance-ms'||!Number.isFinite(v.timestampMs)||v.timestampMs<0||typeof v.message!=='string'||v.message.length===0||v.message.length>limits.maxDiagnosticMessageCodeUnits||(v.stack!==null&&(typeof v.stack!=='string'||v.stack.length>limits.maxDiagnosticStackCodeUnits))||(v.severity!=='error'&&v.severity!=='warning'))throw new Error('Invalid owned source exception');
        if(queue.enqueue(...object(['cohort',s('exception')],['serialized',s(record)])))accepted++;else{rejected++;transferFailure=queue.state().reason??'Destination rejected transfer';break;}
      }catch{rejected++;transferFailure='Owned pre-navigation source integrity failure';break;}
    }return readPreNavigationTransfer();
  }
  transferPreNavigation();
  function diagnostic(value:unknown):{message:string;stack:string|null} {
    if(value===null)return {message:'null',stack:null};if(typeof value==='string')return {message:cap(value),stack:null};
    if(typeof value==='bigint')return {message:'[bigint diagnostic value]',stack:null};
    if(typeof value==='number'||typeof value==='boolean'||typeof value==='undefined')return {message:cap(String(value)),stack:null};
    const intrinsic=(Error as ErrorConstructor&{isError?:(v:unknown)=>boolean}).isError;
    if(typeof intrinsic==='function')try{if(intrinsic(value)){const m=Object.getOwnPropertyDescriptor(value,'message'),k=Object.getOwnPropertyDescriptor(value,'stack');return {message:m&&'value' in m&&typeof m.value==='string'?cap(m.value):'[Error message unavailable]',stack:k&&'value' in k&&typeof k.value==='string'?cap(k.value,limits.maxDiagnosticStackCodeUnits):null};}}catch{}
    return {message:'[opaque diagnostic value]',stack:null};
  }
  function exception(source:'page'|'console',severity:'warning'|'error',message:string,stack:string|null):void {
    if(stopped)return;const time=performance.now();if(!Number.isFinite(time)||time<0)return;
    queue.enqueue(...object(['cohort',s('exception')],['record',object(['source',s(source)],['stage',s(stage)],['clockDomain',s('page-performance-ms')],['timestampMs',n(time)],['message',s(cap(message||'[empty diagnostic]',limits.maxDiagnosticMessageCodeUnits))],['stack',nullable(stack===null?null:cap(stack,limits.maxDiagnosticStackCodeUnits))],['severity',s(severity)])]));
  }
  function onError(event:ErrorEvent):void{const d=diagnostic(event.error);exception('page','error',typeof event.message==='string'&&event.message?cap(event.message,limits.maxDiagnosticMessageCodeUnits):d.message,d.stack);}
  function onRejection(event:PromiseRejectionEvent):void{const d=diagnostic(event.reason);exception('page','error',d.message,d.stack);}
  const originalConsole={warn:console.warn,error:console.error};
  function consoleWrapper(kind:'warn'|'error'){return function(this:Console,...args:unknown[]):void {
    if(!stopped){let message='',stack:string|null=null;for(let i=0;i<Math.min(args.length,limits.maxConsoleArguments);i++){const d=diagnostic(args[i]);message=cap(message+(i?' ':'')+d.message,limits.maxDiagnosticMessageCodeUnits);if(stack===null)stack=d.stack;}exception('console',kind==='warn'?'warning':'error',message,stack);}Reflect.apply(originalConsole[kind],this,args);
  };}
  const wrappers={warn:consoleWrapper('warn'),error:consoleWrapper('error')};addEventListener('error',onError);addEventListener('unhandledrejection',onRejection);console.warn=wrappers.warn;console.error=wrappers.error;
  function utf8(value:string,max:number):number{let bytes=0;for(let i=0;i<value.length;i++){const code=value.charCodeAt(i);if(code<128)bytes++;else if(code<2048)bytes+=2;else if(code>=0xd800&&code<=0xdbff&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}else bytes+=3;if(bytes>max)throw new Error('Text UTF8 limit exceeded');}return bytes;}
  function meaningful(value:unknown,maxUnits:number,maxBytes:number):string{if(typeof value!=='string'||value.length>maxUnits)throw new Error('Text code-unit limit exceeded');utf8(value,maxBytes);return value;}
  function id(value:unknown):string{if(typeof value!=='string'||value.length===0||value.length>limits.maxDiagnosticFieldCodeUnits)throw new Error('Candidate identity unavailable');return value;}
  function mutationGuard(){
    let observer:MutationObserver|null=null,dirty=false,reason:string|null=null;
    const watched=new Set<Element>();
    try{if(typeof MutationObserver==='undefined')throw new Error('Mutation assurance API unavailable');observer=new MutationObserver(()=>{dirty=true;});}catch(error){reason=failureMessage(error);}
    function watch(element:Element,subtree=false):void {
      if(reason!==null||observer===null)throw new Error('Mutation assurance unavailable: '+(reason??'Observer missing'));
      if(watched.has(element))return;
      // At most 65 owned content roots plus the shared 256 geometry ancestors.
      if(watched.size>=limits.maxHistoricalCandidates+1+limits.maxAncestorsPerCallback)throw new Error('Mutation watch budget exhausted before registration');
      try{observer.observe(element,{attributes:true,characterData:true,childList:true,subtree});watched.add(element);}catch(error){reason=failureMessage(error);throw new Error('Mutation assurance registration unavailable: '+reason);}
    }
    function assert():void {if(reason!==null||observer===null)throw new Error('Mutation assurance unavailable');if(observer.takeRecords().length>0)dirty=true;if(dirty)throw new Error('Owned prose or geometry mutated during callback');}
    function stop():void{const owned=observer;observer=null;watched.clear();owned?.disconnect();}
    return {watch,assert,stop};
  }
  interface Budget {nodes:number;ancestors:number;rects:number;historicalUnits:number;historicalBytes:number;mutations:ReturnType<typeof mutationGuard>;assertActive:()=>void;}
  function budget(assertActive:()=>void=()=>{}):Budget{assertActive();return {nodes:0,ancestors:0,rects:0,historicalUnits:0,historicalBytes:0,mutations:mutationGuard(),assertActive};}
  function candidates():CaptureCandidates {
    if(!bridge?.readCaptureCandidates)throw new Error('Bounded candidate API unavailable');const result=bridge.readCaptureCandidates(limits.maxHistoricalCandidates);if(result.status!=='available')throw new Error(cap(result.reason));
    if(!Array.isArray(result.value.historical)||result.value.historical.length>limits.maxHistoricalCandidates)throw new Error('Historical candidate limit exceeded');for(const c of result.value.historical){id(c.id);if(c.role!=='user'&&c.role!=='assistant')throw new Error('Candidate role unavailable');}
    if(result.value.active){id(result.value.active.id);if(result.value.active.role!=='assistant')throw new Error('Active owner must be assistant');}return result.value;
  }
  interface TextSample {text:string;nodes:{node:Text;data:string}[];candidate:CaptureCandidate;historical:boolean;}
  function sample(candidate:CaptureCandidate,historical:boolean,work:Budget):TextSample {
    work.assertActive();
    const content=candidate.contentElement;if(!candidate.hostElement.isConnected||!content?.isConnected)throw new Error('Content disconnected or unmounted');
    work.mutations.watch(content,true);
    const walker=document.createTreeWalker(content,NodeFilter.SHOW_ALL),nodes:{node:Text;data:string}[]=[];let units=0,bytes=0,text='',visited=0;
    const maxUnits=historical?limits.maxHistoricalDomCodeUnits:limits.maxActiveDomCodeUnits,maxBytes=historical?limits.maxHistoricalDomUtf8Bytes:limits.maxActiveDomUtf8Bytes;
    while(true){work.assertActive();if(visited>=limits.maxNodesPerSample||work.nodes>=limits.maxNodesPerCallback)throw new Error('Node budget exhausted before next traversal');const next=walker.nextNode();work.assertActive();if(!next)break;work.nodes++;visited++;if(next.nodeType!==3)continue;const node=next as Text;
      const length=node.length;if(!Number.isSafeInteger(length)||length<0||length>maxUnits-units||(historical&&length>limits.maxHistoricalCallbackCodeUnits-work.historicalUnits))throw new Error('DOM text length limit exceeded before data read');
      let parent=node.parentElement,ancestors=0,excluded=false;
      while(parent&&parent!==content){if(ancestors>=limits.maxAncestorsPerGeometry||work.ancestors>=limits.maxAncestorsPerCallback)throw new Error('Prose ancestry budget exhausted before ancestor inspection');ancestors++;work.ancestors++;
        if(['BUTTON','INPUT','TEXTAREA','SELECT','OPTION','TIME','SCRIPT','STYLE','NOSCRIPT'].includes(parent.tagName)||parent.getAttribute?.('role')==='button'){excluded=true;break;}parent=parent.parentElement;
      }if(excluded)continue;
      work.assertActive();const data=node.data;work.assertActive();if(typeof data!=='string'||data.length!==length)throw new Error('Text mutated during traversal');const size=utf8(data,Math.min(maxBytes-bytes,historical?limits.maxHistoricalCallbackUtf8Bytes-work.historicalBytes:maxBytes));
      units+=length;bytes+=size;if(historical){work.historicalUnits+=length;work.historicalBytes+=size;}if(!node.isConnected||!content.contains(node))throw new Error('Text disconnected during traversal');nodes.push({node,data});text+=data;
    }if(!candidate.hostElement.isConnected||!content.isConnected)throw new Error('Content disconnected during traversal');work.mutations.assert();return {text,nodes,candidate,historical};
  }
  function runtime(time:number):void {
    try{if(!bridge?.readCaptureProgress)throw new Error('Bounded runtime API unavailable');const result=bridge.readCaptureProgress({maxRuntimeCodeUnits:limits.maxRuntimeCodeUnits,maxRuntimeUtf8Bytes:limits.maxRuntimeUtf8Bytes});if(result.status!=='available')throw new Error(cap(result.reason));const p=result.value,m=p.activeMessage;
      if(m){id(m.id);meaningful(m.text,limits.maxRuntimeCodeUnits,limits.maxRuntimeUtf8Bytes);if(m.role!=='assistant'||(m.status!=='streaming'&&m.status!=='complete'))throw new Error('Runtime message invalid');}
      if(!['idle','streaming','complete','aborted','error'].includes(p.delivery)||(p.outcome!==null&&!['success','error','aborted'].includes(p.outcome))||typeof p.loading!=='boolean'||(p.error!==null&&typeof p.error!=='string'))throw new Error('Runtime state invalid');
      observation('runtime-checkpoint',object(['activeMessage',m?object(['id',s(m.id)],['role',s(m.role)],['text',s(m.text)],['status',s(m.status)]):['null']],['delivery',s(p.delivery)],['outcome',nullable(p.outcome)],['loading',b(p.loading)],['error',nullable(p.error===null?null:cap(p.error))],['matchedSequences',['array',0]]),time);
    }catch(error){unavailable('runtime',failureMessage(error),time);}
  }
  function dom(time:number,cs:CaptureCandidates|null,work:Budget):{active:TextSample|null;history:TextSample[]} {
    let active:TextSample|null=null;const history:TextSample[]=[];
    try{if(!cs)throw new Error('Candidates unavailable');
      if(cs.active?.contentElement)active=sample(cs.active,false,work);for(const c of cs.historical)history.push(sample(c,true,work));
      // Keep the same bounded fresh samples for independent geometry even if count admission fails.
      if(!bridge?.readCaptureMountedMessageCount)throw new Error('Mounted count API unavailable');const count=bridge.readCaptureMountedMessageCount();if(count.status!=='available'||!Number.isSafeInteger(count.value)||count.value<0)throw new Error('Mounted count unavailable or invalid');
      const visible=history.map(v=>{const rect=layout(work,{rects:0},()=>v.candidate.hostElement.getBoundingClientRect());return object(['id',s(v.candidate.id)],['text',s(v.text)],['topCssPx',n(rect.top)],['bottomCssPx',n(rect.bottom)]);});
      work.mutations.assert();observation('dom-checkpoint',object(['matchedSequences',['array',0]],['activeMessageId',nullable(cs.active?.id??null)],['mounted',b(active!==null)],['text',nullable(active?.text??null)],['visibleMessages',array(visible)],['mountedMessageCount',n(count.value)]),time);
    }catch(error){unavailable('dom',failureMessage(error),time);}return {active,history};
  }
  function rectangle(value:{left:number;top:number;right:number;bottom:number}):ComparisonRect {const {left,top,right,bottom}=value;if(![left,top,right,bottom].every(Number.isFinite)||right<left||bottom<top)throw new Error('Invalid layout rectangle');return {left,top,right,bottom};}
  function layout(work:Budget,per:{rects:number},read:()=>DOMRect|ComparisonRect):ComparisonRect{work.assertActive();if(per.rects>=limits.maxRectsPerSample||work.rects>=limits.maxRectsPerCallback)throw new Error('Rectangle budget exhausted before layout query');per.rects++;work.rects++;const value=read();work.assertActive();return rectangle(value);}
  function client(element:Element,work:Budget,per:{rects:number}):ComparisonRect{const r=layout(work,per,()=>element.getBoundingClientRect()),left=r.left+element.clientLeft,top=r.top+element.clientTop;return rectangle({left,top,right:left+element.clientWidth,bottom:top+element.clientHeight});}
  function intersect(a:ComparisonRect|null,r:ComparisonRect,x=true,y=true):ComparisonRect|null{if(a===null)return null;const left=x?Math.max(a.left,r.left):a.left,right=x?Math.min(a.right,r.right):a.right,top=y?Math.max(a.top,r.top):a.top,bottom=y?Math.min(a.bottom,r.bottom):a.bottom;return right<=left||bottom<=top?null:{left,top,right,bottom};}
  function geometry(sampled:TextSample,scroller:Element,work:Budget):{geometry:ComparisonGeometry;visible:boolean} {
    work.assertActive();
    const c=sampled.candidate,content=c.contentElement!,per={rects:0};if(!c.hostElement.isConnected||!content.isConnected||!scroller.isConnected)throw new Error('Geometry owner disconnected');
    const ownerId=c.id,ownerRole=c.role,host=c.hostElement;
    function assertOwner(item?:TextSample['nodes'][number]):void {
      work.assertActive();
      const current=candidates(),owners=sampled.historical?current.historical:(current.active?[current.active]:[]);
      work.assertActive();
      if(c.id!==ownerId||c.role!==ownerRole||c.hostElement!==host||c.contentElement!==content||!host.isConnected||!content.isConnected||!scroller.isConnected||!owners.some(v=>v.id===ownerId&&v.role===ownerRole&&v.hostElement===host&&v.contentElement===content))throw new Error('Geometry owner changed during range query');
      if(item&&(!item.node.isConnected||!content.contains(item.node)||item.node.length!==item.data.length||item.node.data!==item.data))throw new Error('Prose mutated during geometry');
      work.mutations.assert();
    }
    function proseRange<T>(item:TextSample['nodes'][number],start:number,end:number,read:(range:Range)=>T):T {
      let range:Range|null=null,primaryPresent=false,primary:unknown,result:T|undefined;const cleanup:unknown[]=[];
      try{assertOwner(item);range=document.createRange();work.assertActive();range.setStart(item.node,start);work.assertActive();range.setEnd(item.node,end);work.assertActive();result=read(range);assertOwner(item);}catch(error){primaryPresent=true;primary=error;}
      finally{if(range!==null)try{range.detach();}catch(error){cleanup.push(error);}}
      if(primaryPresent){if(cleanup.length)throw new AggregateError([primary,...cleanup],'Prose range query and cleanup failed');throw primary;}
      if(cleanup.length)throw cleanup[0];
      assertOwner(item);return result!;
    }
    work.assertActive();work.mutations.assert();work.mutations.watch(c.hostElement);work.mutations.watch(scroller);
    // One reported clip chain cannot describe different inner branches. Check every
    // eligible text branch before any positive short circuit and reject inner clipping.
    for(const item of sampled.nodes){let inner=item.node.parentElement,depth=0;
      while(inner&&inner!==content){if(depth>=limits.maxAncestorsPerGeometry||work.ancestors>=limits.maxAncestorsPerCallback)throw new Error('Inner ancestor budget exhausted before style read');depth++;work.ancestors++;
        work.assertActive();if(!inner.isConnected)throw new Error('Inner prose ancestor disconnected');work.mutations.watch(inner);work.assertActive();const style=getComputedStyle(inner);work.assertActive();
        if(style.transform&&style.transform!=='none'||style.clipPath&&style.clipPath!=='none'||style.overflowClipMargin&&style.overflowClipMargin!=='0px'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')throw new Error('Unsupported inner prose geometry');
        if(['hidden','clip','scroll','auto'].includes(style.overflowX)||['hidden','clip','scroll','auto'].includes(style.overflowY))throw new Error('Inner prose clipping cannot be represented by one geometry chain');
        inner=inner.parentElement;
      }if(inner!==content)throw new Error('Prose branch is outside owned content');
    }
    work.mutations.assert();
    const hostRect=layout(work,per,()=>c.hostElement.getBoundingClientRect()),viewportRect=rectangle({left:0,top:0,right:innerWidth,bottom:innerHeight}),scrollerRect=client(scroller,work,per);
    let effective:ComparisonRect|null=intersect(viewportRect,scrollerRect),ancestor=content as Element|null,ancestors=0;const clippingAncestorRects:ComparisonRect[]=[],clippingAncestorAxes:{clipX:boolean;clipY:boolean}[]=[];
    while(ancestor){if(ancestors>=limits.maxAncestorsPerGeometry||work.ancestors>=limits.maxAncestorsPerCallback)throw new Error('Ancestor budget exhausted before style read');ancestors++;work.ancestors++;
      work.assertActive();work.mutations.watch(ancestor);work.assertActive();const style=getComputedStyle(ancestor);work.assertActive();if(style.transform&&style.transform!=='none'||style.clipPath&&style.clipPath!=='none'||style.overflowClipMargin&&style.overflowClipMargin!=='0px')throw new Error('Unsupported transform/clip-path/overflow-clip-margin');if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')throw new Error('Unsupported hidden prose geometry');
      const clips=(axis:string)=>axis==='hidden'||axis==='clip'||axis==='scroll'||axis==='auto',clipX=clips(style.overflowX),clipY=clips(style.overflowY);
      if(clipX||clipY){const r=client(ancestor,work,per);clippingAncestorRects.push(r);clippingAncestorAxes.push({clipX,clipY});effective=intersect(effective,r,clipX,clipY);}ancestor=ancestor.parentElement;
    }
    const contentRects:ComparisonRect[]=[];let visible=false;
    for(const item of sampled.nodes){const {node,data}=item;if(!node.isConnected||node.length!==data.length||node.data!==data)throw new Error('Prose mutated during geometry');let left=0,right=data.length,fromLeft=true;
      if(data.length>0){
        if(limits.maxRectsPerSample-per.rects<2||limits.maxRectsPerCallback-work.rects<2)throw new Error('Prose rectangle budget exhausted before envelope query');
        per.rects+=2;work.rects+=2;
        const envelope=proseRange(item,0,data.length,range=>rectangle(range.getBoundingClientRect()));
        if(envelope.right<=envelope.left||envelope.bottom<=envelope.top||intersect(effective,envelope)===null)continue;
      }
      function forward(offset:number):number{const code=data.charCodeAt(offset),next=data.charCodeAt(offset+1);return code>=0xd800&&code<=0xdbff&&next>=0xdc00&&next<=0xdfff?2:1;}
      function backward(offset:number):number{const code=data.charCodeAt(offset-1),previous=data.charCodeAt(offset-2);return code>=0xdc00&&code<=0xdfff&&previous>=0xd800&&previous<=0xdbff?2:1;}
      while(left<right){const end=left+forward(left);if(!/^\s$/u.test(data.slice(left,end)))break;left=end;}
      while(left<right){const start=right-backward(right);if(!/^\s$/u.test(data.slice(start,right)))break;right=start;}
      while(left<right){let start:number,end:number;if(fromLeft){start=left;end=left+forward(left);left=end;}else{end=right;start=right-backward(right);right=start;}fromLeft=!fromLeft;if(/^\s$/u.test(data.slice(start,end)))continue;
        if(per.rects>=limits.maxRectsPerSample||work.rects>=limits.maxRectsPerCallback)throw new Error('Prose rectangle budget exhausted before range query');per.rects++;work.rects++;
        proseRange(item,start,end,range=>{const rects=range.getClientRects();
          if(!Number.isSafeInteger(rects.length)||rects.length<0||rects.length>limits.maxRectsPerSample-per.rects||rects.length>limits.maxRectsPerCallback-work.rects)throw new Error('DOMRectList exceeds remaining budget before iteration');
          for(let i=0;i<rects.length;i++){const r=rectangle(rects[i]!);per.rects++;work.rects++;contentRects.push(r);if(r.right>r.left&&r.bottom>r.top&&intersect(effective,r)!==null)visible=true;}
        });if(visible)break;
      }if(visible)break;
    }
    if(!c.hostElement.isConnected||!content.isConnected||sampled.nodes.some(v=>!v.node.isConnected||!content.contains(v.node)||v.node.length!==v.data.length||v.node.data!==v.data))throw new Error('Prose changed during geometry');
    assertOwner();return {geometry:{status:'available',value:{messageId:ownerId,role:ownerRole,hostRect,contentRects,viewportRect,scrollerRect,clippingAncestorRects,clippingAncestorAxes,effectiveClipRect:effective}},visible};
  }
  let anchorId:string|null=null,scroll:CaptureAvailability<ScrollSnapshot>={status:'unavailable',reason:'Scroll probe has not run'};
  type AnchorOwner=Pick<CaptureCandidate,'id'|'role'|'hostElement'|'contentElement'>;
  let pollAnchorOwner:AnchorOwner|null=null;
  function calculateScroll(time:number,samples:{active:TextSample|null;history:TextSample[]},work:Budget,cs:CaptureCandidates|null,originalAnchorId:string|null,originalAnchorOwner:AnchorOwner|null):{availability:CaptureAvailability<ScrollSnapshot>;nextAnchorId:string|null;nextAnchorOwner:AnchorOwner|null;primaryPresent:boolean;primary:unknown} {
    let anchorId=originalAnchorId;
    let anchorOwner=originalAnchorOwner;
    let geometryPrimaryPresent=false,geometryPrimary:unknown;
    const missing=(reason:string):ComparisonGeometry=>({status:'unavailable',reason});
    try{work.assertActive();if(!bridge)throw new Error('Bridge unavailable');const scroller=document.querySelector(bridge.locators.scroller) as HTMLElement|null;work.assertActive();if(!scroller?.isConnected)throw new Error('Scroller unavailable');const scrollTop=scroller.scrollTop,scrollHeight=scroller.scrollHeight,clientHeight=scroller.clientHeight;work.assertActive();if(![scrollTop,scrollHeight,clientHeight].every(Number.isFinite)||scrollHeight<0||clientHeight<0)throw new Error('Scroll dimensions unavailable');
      if(cs===null)throw new Error('Active candidates unavailable for visibility');
      if(cs.active===null){if(!bridge.readActiveHost)throw new Error('Active host API unavailable');const host=bridge.readActiveHost();if(host.activeMessageId!==null||host.hostMounted)throw new Error('Active prose unavailable for visibility');}
      else if(samples.active===null)throw new Error('Active prose unavailable for visibility');
      let activeGeometry:ComparisonGeometry=missing('No active assistant'),activeVisible=false;
      if(samples.active)try{const r=geometry(samples.active,scroller,work);activeGeometry=r.geometry;activeVisible=r.visible;}catch(error){geometryPrimaryPresent=true;geometryPrimary=error;const reason=failureMessage(error);activeGeometry=missing(reason);}
      if(cs.active!==null&&activeGeometry.status==='unavailable')throw new Error('Active visibility not established: '+activeGeometry.reason);
      let anchorGeometry:ComparisonGeometry=missing('Historical anchor unavailable'),anchorTopCssPx:number|null=null;const existing=anchorId===null?null:samples.history.find(v=>v.candidate.id===anchorId);
      if(existing)try{const owner=existing.candidate;if(!anchorOwner||owner.role!==anchorOwner.role||owner.hostElement!==anchorOwner.hostElement||owner.contentElement!==anchorOwner.contentElement)throw new Error('Historical anchor owner changed');const r=geometry(existing,scroller,work);anchorGeometry=r.geometry;if(r.geometry.status==='available')anchorTopCssPx=r.geometry.value.hostRect.top-r.geometry.value.scrollerRect.top;}catch(error){anchorGeometry=missing(failureMessage(error));}
      else if(anchorId===null)for(const historical of samples.history)try{const r=geometry(historical,scroller,work);if(r.visible&&r.geometry.status==='available'){anchorId=historical.candidate.id;anchorOwner={id:anchorId,role:historical.candidate.role,hostElement:historical.candidate.hostElement,contentElement:historical.candidate.contentElement};anchorGeometry=r.geometry;anchorTopCssPx=r.geometry.value.hostRect.top-r.geometry.value.scrollerRect.top;break;}}catch(error){anchorGeometry=missing(failureMessage(error));break;}
      const value:ScrollSnapshot={timestampMs:time,clockDomain:'page-performance-ms',scrollTop,scrollHeight,clientHeight,anchorId,anchorTopCssPx,activeVisible,followArmed:null,pinThresholdCssPx:null,geometry:activeGeometry,anchorGeometry};return {availability:{status:'available',value},nextAnchorId:anchorId,nextAnchorOwner:anchorOwner,primaryPresent:false,primary:undefined};
    }catch(error){return {availability:{status:'unavailable',reason:failureMessage(error)},nextAnchorId:anchorId,nextAnchorOwner:anchorOwner,primaryPresent:true,primary:geometryPrimaryPresent?geometryPrimary:error};}
  }
  function captureScroll(time:number,samples:{active:TextSample|null;history:TextSample[]},work:Budget,cs:CaptureCandidates|null):void{const result=calculateScroll(time,samples,work,cs,anchorId,pollAnchorOwner);anchorId=result.nextAnchorId;pollAnchorOwner=result.nextAnchorOwner;scroll=result.availability;if(scroll.status==='unavailable')unavailable('geometry',scroll.reason,time);}
  function readScroll():CaptureAvailability<ScrollSnapshot>{if(scroll.status==='unavailable')return {...scroll};function copy(g:ComparisonGeometry):ComparisonGeometry{return g.status==='unavailable'?{...g}:{status:'available',value:{...g.value,hostRect:{...g.value.hostRect},viewportRect:{...g.value.viewportRect},scrollerRect:{...g.value.scrollerRect},effectiveClipRect:g.value.effectiveClipRect?{...g.value.effectiveClipRect}:null,contentRects:g.value.contentRects.map(v=>({...v})),clippingAncestorRects:g.value.clippingAncestorRects.map(v=>({...v})),clippingAncestorAxes:g.value.clippingAncestorAxes.map(v=>({...v}))}};}return {status:'available',value:{...scroll.value,geometry:copy(scroll.value.geometry),anchorGeometry:copy(scroll.value.anchorGeometry)}};}
  function emitScroll(value:ScrollSnapshot):void{observation('scroll-checkpoint',object(['scrollTop',n(value.scrollTop)],['scrollHeight',n(value.scrollHeight)],['clientHeight',n(value.clientHeight)],['anchorId',nullable(value.anchorId)],['anchorTopCssPx',nullable(value.anchorTopCssPx)],['activeVisible',b(value.activeVisible)],['followArmed',['null']]),value.timestampMs);}
  let scoredAnchorId:string|null=null,scoredScroll:CaptureAvailability<ScrollSnapshot>={status:'unavailable',reason:'Scroll probe has not run'},freshGeneration=0,freshAdmissionClosed=false;
  let scoredAnchorOwner:AnchorOwner|null=null;
  const freshStats={callbacks:0,total:0,last:null as number|null,gap:null as number|null,invalidClock:false,incompleteReason:null as string|null};
  type FreshRequest={generation:number;settled:boolean;timer:ReturnType<typeof setTimeout>|null;callbacks:number;last:number|null;resolve:(value:CaptureAvailability<ScrollSnapshot>)=>void};
  let freshPending:FreshRequest|null=null;
  function finishFresh(record:FreshRequest,value:CaptureAvailability<ScrollSnapshot>):void {
    if(record.settled)return;record.settled=true;if(freshPending===record)freshPending=null;const owned=record.timer;record.timer=null;
    let failed=false,failure:unknown;try{if(owned!==null)clearTimeout(owned);}catch(error){failed=true;failure=error;}
    if(failed){observation('failure',object(['stage',s(stage)],['reason',s('Capture cleanup failed: '+failureMessage(failure))]),record.last??0);if(value.status==='available')value={status:'unavailable',reason:failureMessage(failure)};}
    scoredScroll=value;record.resolve(value);
  }
  function readScrollFresh(request:{notBeforePageMs:number|null}):Promise<CaptureAvailability<ScrollSnapshot>> {
    if(stopped||freshAdmissionClosed)return Promise.resolve({status:'unavailable',reason:'Fresh scroll acquisition stopped'});
    if(freshPending!==null)return Promise.resolve({status:'unavailable',reason:'Fresh scroll acquisition already pending'});
    return new Promise(resolve=>{
      const record:FreshRequest={generation:freshGeneration,settled:false,timer:null,callbacks:0,last:null,resolve};freshPending=record;
      function assertRequestActive():void{if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed)throw new Error('Fresh scroll acquisition stopped');}
      function fail(reason:string):void{if(record.settled)return;if(record.last!==null)unavailable('geometry',reason,record.last);finishFresh(record,{status:'unavailable',reason});}
      let target:number|null;
      try{
        if(request===null||typeof request!=='object')throw new Error('Fresh scroll minimum timestamp invalid');
        const keys=Object.keys(request);assertRequestActive();if(keys.join(',')!=='notBeforePageMs')throw new Error('Fresh scroll minimum timestamp invalid');
        target=request.notBeforePageMs;assertRequestActive();if(target!==null&&(typeof target!=='number'||!Number.isFinite(target)||target<0))throw new Error('Fresh scroll minimum timestamp invalid');
      }catch(error){fail(failureMessage(error));return;}
      function admit():void {
        if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed)return;
        let time:number;
        try{time=performance.now();}catch{fail('Fresh scroll page clock unavailable');return;}
        if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed)return;
        if(!Number.isFinite(time)||time<0||(record.last!==null&&time<=record.last)){fail('Fresh scroll page clock unavailable');return;}record.last=time;
        if(target!==null&&time<target){
          if(record.callbacks>=64){fail('Fresh scroll wait callback limit exceeded');return;}
          try{record.timer=setTimeout(()=>{if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed)return;record.timer=null;record.callbacks++;admit();},Math.max(1,Math.ceil(target-time)));
            if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed){const acquired=record.timer;record.timer=null;try{clearTimeout(acquired);}catch(error){observation('failure',object(['stage',s(stage)],['reason',s('Capture cleanup failed: '+failureMessage(error))]),record.last??0);}}
          }
          catch(error){observation('failure',object(['stage',s(stage)],['reason',s('Fresh scroll timer setup failed; cancellation unverified: '+failureMessage(error))]),time);fail(failureMessage(error));}return;
        }
        freshStats.callbacks++;let primaryPresent=false,primary:unknown;const cleanup:unknown[]=[];let work:Budget|null=null,result:ReturnType<typeof calculateScroll>|null=null;
        try{
          if(freshStats.last!==null){const gap=time-freshStats.last;if(!Number.isFinite(gap)||gap<0)throw new Error('Fresh scroll page clock unavailable');freshStats.gap=Math.max(freshStats.gap??0,gap);}freshStats.last=time;
          work=budget(assertRequestActive);assertRequestActive();const cs=candidates();assertRequestActive();const active=cs.active?.contentElement?sample(cs.active,false,work):null,history=cs.historical.map(value=>sample(value,true,work!));assertRequestActive();result=calculateScroll(time,{active,history},work,cs,scoredAnchorId,scoredAnchorOwner);assertRequestActive();
          if(result.primaryPresent){primaryPresent=true;primary=result.primary;}
        }catch(error){primaryPresent=true;primary=error;}
        finally{try{work?.mutations.stop();}catch(error){cleanup.push(error);}}
        if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed){freshStats.incompleteReason='Fresh scroll acquisition stopped';if(cleanup.length)observation('failure',object(['stage',s(stage)],['reason',s('Capture cleanup failed: '+failureMessage(primaryPresent?new AggregateError([primary,...cleanup],'Fresh scroll acquisition and cleanup failed'):cleanup[0]))]),record.last??0);return;}
        try{const end=performance.now();if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed){freshStats.incompleteReason='Fresh scroll acquisition stopped';return;}const duration=end-time,total=freshStats.total+duration;if(!Number.isFinite(end)||duration<0||!Number.isFinite(total))throw new Error('Fresh scroll page clock unavailable');freshStats.total=total;}catch(error){if(record.settled||record.generation!==freshGeneration||stopped||freshAdmissionClosed){freshStats.incompleteReason='Fresh scroll acquisition stopped';observation('failure',object(['stage',s(stage)],['reason',s('Capture cleanup failed: '+failureMessage(error))]),record.last??0);return;}freshStats.invalidClock=true;if(primaryPresent)cleanup.push(error);else{primaryPresent=true;primary=error;}}
        if(primaryPresent||cleanup.length){const error=primaryPresent?(cleanup.length?new AggregateError([primary,...cleanup],'Fresh scroll acquisition and cleanup failed'):primary):cleanup[0];fail(failureMessage(error));return;}
        scoredAnchorId=result!.nextAnchorId;scoredAnchorOwner=result!.nextAnchorOwner;const value=result!.availability;if(value.status==='available')emitScroll(value.value);else unavailable('geometry',value.reason,time);finishFresh(record,value);
      }
      admit();
    });
  }
  let armed=false,frameRequest:number|null=null,guardElement:HTMLElement|null=null,guardId:string|null=null;
  let hostObservation:ComparisonHostFrameGuard['hostObservation']|null=null,firstFrame:ComparisonHostFrameGuard['frames'][0]|null=null;
  let guard:{status:'pending'}|{status:'unavailable';reason:string}|{status:'ready';value:ComparisonHostFrameGuard}={status:'pending'};
  function guardFail(reason:string):void{try{if(frameRequest!==null)cancelAnimationFrame(frameRequest);}finally{frameRequest=null;guardElement=null;guardId=null;guard={status:'unavailable',reason:cap(reason)};}}
  function frame(timestamp:number):void {
    frameRequest=null;if(stopped){guardFail('Capture stopped');return;}
    try{if(!bridge?.readActiveHost)throw new Error('Active host API unavailable');const active=bridge.readActiveHost(),cs=candidates(),c=cs.active;
      if(typeof active.hostMounted!=='boolean'||(active.activeMessageId!==null&&typeof active.activeMessageId!=='string')||active.activeMessageId===null&&active.hostMounted)throw new Error('Active host snapshot invalid');
      if(guardElement===null){if(active.activeMessageId!==null)id(active.activeMessageId);if(!active.hostMounted||!c){frameRequest=requestAnimationFrame(frame);return;}if(c.id!==active.activeMessageId||!c.hostElement.isConnected)throw new Error('Active host and candidate disagree');
        const time=performance.now();if(!Number.isFinite(time)||time<0)throw new Error('Host page clock unavailable');guardElement=c.hostElement;guardId=c.id;hostObservation={clockDomain:'page-performance-ms',timestampMs:time,hostMounted:true,contentMounted:c.contentElement?.isConnected===true};
        observation('assistant-host',object(['messageId',s(c.id)],['hostMounted',b(true)],['contentMounted',b(hostObservation.contentMounted)]),time);runtime(time);frameRequest=requestAnimationFrame(frame);return;
      }
      if(!c||c.id!==guardId||active.activeMessageId!==guardId||!active.hostMounted||c.hostElement!==guardElement||!guardElement.isConnected)throw new Error('Original streaming host removed or replaced');
      if(!Number.isFinite(timestamp)||timestamp<0)throw new Error('Distinct chronological rAF timestamp unavailable');
      if(firstFrame===null&&timestamp<hostObservation!.timestampMs){frameRequest=requestAnimationFrame(frame);return;}
      if(timestamp<hostObservation!.timestampMs||firstFrame&&timestamp<=firstFrame.timestampMs)throw new Error('Distinct chronological rAF timestamp unavailable');
      const ordinal=firstFrame===null?1:2;observation('animation-frame-checkpoint',object(['messageId',s(guardId!)],['ordinal',n(ordinal)]),timestamp);
      if(firstFrame===null){firstFrame={ordinal:1,clockDomain:'page-performance-ms',timestampMs:timestamp};frameRequest=requestAnimationFrame(frame);}else{guard={status:'ready',value:{messageId:guardId!,hostObservation:{...hostObservation!},frames:[{...firstFrame},{ordinal:2,clockDomain:'page-performance-ms',timestampMs:timestamp}]}};guardElement=null;guardId=null;}
    }catch(error){guardFail(failureMessage(error));}
  }
  function armHostGuard():void{if(armed||stopped)throw new Error('Host guard can be armed once before replay');armed=true;frameRequest=requestAnimationFrame(frame);}
  function readHostGuard(){return guard.status==='ready'?{status:'ready' as const,value:{...guard.value,hostObservation:{...guard.value.hostObservation},frames:[{...guard.value.frames[0]},{...guard.value.frames[1]}] as ComparisonHostFrameGuard['frames']}}:{...guard};}
  function targetRole(target:EventTarget|null):'composer'|'return-control'|'scroller'|'other'|'unknown' {
    if(!bridge||target===null)return 'unknown';const composer=document.querySelector(bridge.locators.composer),returnControl=bridge.locators.returnToResponse===null?null:document.querySelector(bridge.locators.returnToResponse),scroller=document.querySelector(bridge.locators.scroller);
    if(composer&&(target===composer||composer.contains(target as Node)))return 'composer';if(returnControl&&(target===returnControl||returnControl.contains(target as Node)))return 'return-control';if(scroller&&(target===scroller||scroller.contains(target as Node)))return 'scroller';return 'other';
  }
  const nativeTypes=['wheel','keydown','keyup','beforeinput','input','click'] as const;
  function native(event:Event):void {
    if(stopped||event.isTrusted!==true)return;const observedAtMs=performance.now(),timestamp=event.timeStamp;
    try{if(!Number.isFinite(timestamp)||timestamp<0||!Number.isFinite(observedAtMs)||timestamp>observedAtMs)throw new Error('Native clock is not page-performance-ms');const type=event.type as typeof nativeTypes[number],role=targetRole(event.target),wheel=type==='wheel';
      const recipeId=wheel&&role==='scroller'?options.nativeRecipeIds.wheel:role==='composer'&&['keydown','keyup','beforeinput','input'].includes(type)?options.nativeRecipeIds.composer:type==='click'&&role==='return-control'?'comparison-return-control-v1':'comparison-other-native-v1';
      let key:string|null=null,code:string|null=null,inputType:string|null=null,value:string|null=null,dx:number|null=null,dy:number|null=null,mode:number|null=null;
      if(wheel){const e=event as WheelEvent;dx=e.deltaX;dy=e.deltaY;mode=e.deltaMode;if(!Number.isFinite(dx)||!Number.isFinite(dy)||![0,1,2].includes(mode))throw new Error('Wheel fields unavailable');}
      if(type==='keydown'||type==='keyup'){key=meaningful((event as KeyboardEvent).key,limits.maxDiagnosticFieldCodeUnits,limits.maxRuntimeUtf8Bytes);code=meaningful((event as KeyboardEvent).code,limits.maxDiagnosticFieldCodeUnits,limits.maxRuntimeUtf8Bytes);}
      if(type==='input'||type==='beforeinput')inputType=meaningful((event as InputEvent).inputType,limits.maxDiagnosticFieldCodeUnits,limits.maxRuntimeUtf8Bytes);
      if(role==='composer'){const element=document.querySelector(bridge!.locators.composer) as HTMLTextAreaElement|null;if(!element)throw new Error('Composer unavailable');value=meaningful(element.value,limits.maxRuntimeCodeUnits,limits.maxRuntimeUtf8Bytes);}
      observation('native-input',object(['recipeId',s(recipeId)],['type',s(type)],['eventTimestampMs',n(timestamp)],['observedAtMs',n(observedAtMs)],['isTrusted',b(event.isTrusted)],['targetRole',s(role)],['deltaX',nullable(dx)],['deltaY',nullable(dy)],['deltaMode',nullable(mode)],['key',nullable(key)],['code',nullable(code)],['inputType',nullable(inputType)],['value',nullable(value)]),timestamp);
    }catch(error){unavailable('native-input',failureMessage(error),observedAtMs);}
  }
  for(const type of nativeTypes)addEventListener(type,native,{passive:true,capture:true});
  type ObserverSlot={type:'event'|'long-animation-frame';observer:PerformanceObserver|null;supported:boolean;registration:'registered'|'failed'|'unsupported';reason:string|null;registeredAt:number|null;entries:number;callbacks:number;finalTakeRecords:boolean;invalid:boolean};
  function observerState(slot:ObserverSlot,dropped?:number):void {
    const time=performance.now(),drop=Number.isSafeInteger(dropped)&&dropped!>=0?object(['status',s('available')],['value',n(dropped!)]):object(['status',s('unavailable')],['reason',s('Dropped-entry count unavailable')]);
    observation('observer-state',object(['entryType',s(slot.type)],['supported',b(slot.supported)],['registration',s(slot.registration)],['reason',nullable(slot.reason)],['buffered',b(slot.type==='event'?options.observers.eventTiming.buffered:options.observers.loaf.buffered)],['requestedDurationThresholdMs',nullable(slot.type==='event'?options.observers.eventTiming.durationThresholdMs:null)],['droppedEntriesCount',drop],['observedAtMs',n(time)]),time);
  }
  function entries(slot:ObserverSlot,list:PerformanceEntry[]):void {
    // Native arrays are owned by the observer; reject a flood before touching its entries.
    if(list.length>limits.maxPendingEntries){slot.invalid=true;slot.registration='failed';slot.reason='Observer entry processing budget exceeded';observation('failure',object(['stage',s(stage)],['reason',s(slot.reason)]));observerState(slot);return;}
    for(const entry of list){const observedAtMs=performance.now();slot.entries++;
      try{const start=entry.startTime,duration=entry.duration;if(!Number.isFinite(start)||start<0||!Number.isFinite(duration)||duration<0||observedAtMs<start)throw new Error('Performance entry times unavailable');
        if(slot.type==='event'){const e=entry as PerformanceEntry&{processingStart:number;processingEnd:number;cancelable:boolean;interactionId:number;target:EventTarget|null};
          if(e.entryType!=='event'||typeof e.name!=='string'||e.name.length===0||e.name==='wheel'||e.name.length>limits.maxDiagnosticFieldCodeUnits||!Number.isFinite(e.processingStart)||e.processingStart<start||!Number.isFinite(e.processingEnd)||e.processingEnd<e.processingStart||typeof e.cancelable!=='boolean'||!Number.isSafeInteger(e.interactionId)||e.interactionId<0)throw new Error('Event Timing required field unavailable');const role=targetRole(e.target);
          observation('event-timing',object(['entryType',s('event')],['name',s(e.name)],['startTime',n(start)],['duration',n(duration)],['processingStart',n(e.processingStart)],['processingEnd',n(e.processingEnd)],['cancelable',b(e.cancelable)],['interactionId',n(e.interactionId)],['observedAtMs',n(observedAtMs)],['targetRole',s(role==='scroller'?'other':role)]),start);
        }else{const e=entry as PerformanceEntry&{renderStart:number;styleAndLayoutStart:number;blockingDuration:number;firstUIEventTimestamp:number};if(e.entryType!=='long-animation-frame'||e.name!=='long-animation-frame'||![e.renderStart,e.styleAndLayoutStart,e.blockingDuration,e.firstUIEventTimestamp].every(v=>Number.isFinite(v)&&v>=0))throw new Error('LoAF required field unavailable');
          observation('long-animation-frame',object(['entryType',s(e.entryType)],['name',s(e.name)],['startTime',n(start)],['duration',n(duration)],['renderStart',n(e.renderStart)],['styleAndLayoutStart',n(e.styleAndLayoutStart)],['blockingDuration',n(e.blockingDuration)],['firstUIEventTimestamp',n(e.firstUIEventTimestamp)],['observedAtMs',n(observedAtMs)]),start);
        }
      }catch(error){slot.invalid=true;slot.registration='failed';slot.reason=failureMessage(error);observation('failure',object(['stage',s(stage)],['reason',s(slot.reason)]),observedAtMs);observerState(slot);}
    }
  }
  function register(type:ObserverSlot['type']):ObserverSlot {
    const slot:ObserverSlot={type,observer:null,supported:false,registration:'unsupported',reason:'PerformanceObserver entry type unsupported',registeredAt:null,entries:0,callbacks:0,finalTakeRecords:false,invalid:false};
    try{if(typeof PerformanceObserver!=='undefined'&&Array.isArray(PerformanceObserver.supportedEntryTypes)&&PerformanceObserver.supportedEntryTypes.includes(type)){
      slot.supported=true;slot.registration='failed';slot.reason='Observer registration failed';slot.observer=new PerformanceObserver((list:PerformanceObserverEntryList,_observer:PerformanceObserver,report?:{droppedEntriesCount?:number})=>{if(stopped)return;slot.callbacks++;observerState(slot,report?.droppedEntriesCount);entries(slot,list.getEntries());});
      if(type==='event')slot.observer.observe({type,buffered:options.observers.eventTiming.buffered,durationThreshold:options.observers.eventTiming.durationThresholdMs} as PerformanceObserverInit);else slot.observer.observe({type,buffered:options.observers.loaf.buffered});slot.registeredAt=performance.now();slot.registration='registered';slot.reason=null;
    }}catch(error){slot.reason=failureMessage(error);try{slot.observer?.disconnect();}catch(cleanupError){slot.reason=cap(slot.reason+'; '+failureMessage(cleanupError));}finally{slot.observer=null;}}observerState(slot);return slot;
  }
  const eventTiming=register('event'),loaf=register('long-animation-frame');
  function observerSnapshot(slot:ObserverSlot):ComparisonInstrumentation['eventTiming']{if(slot.registration!=='registered'||slot.registeredAt===null||slot.invalid)return {status:'unavailable',reason:slot.reason??'Observer acquisition failed'};return {status:'available',value:{entryType:slot.type,buffered:true,requestedDurationThresholdMs:slot.type==='event'?options.observers.eventTiming.durationThresholdMs:null,registrationTimestampMs:slot.registeredAt,observedEntries:slot.entries,callbackCount:slot.callbacks,droppedEntriesCount:{status:'unavailable',reason:'Individual callback dropped reports have unknown cumulative semantics'},finalTakeRecords:slot.finalTakeRecords}};}
  const stats={runtimeProbe:{callbacks:0,total:0,last:null as number|null,gap:null as number|null},domProbe:{callbacks:0,total:0,last:null as number|null,gap:null as number|null},scrollProbe:{callbacks:0,total:0,last:null as number|null,gap:null as number|null},transportDrain:{callbacks:0,total:0,last:null as number|null,gap:null as number|null}};
  function measured(name:keyof typeof stats,fn:()=>void):void{const start=performance.now(),stat=stats[name];stat.callbacks++;if(stat.last!==null)stat.gap=Math.max(stat.gap??0,start-stat.last);stat.last=start;try{fn();}finally{stat.total+=Math.max(0,performance.now()-start);}}
  function transport():void {
    try{if(!bridge)throw new Error('Bridge unavailable');if(!bridge.readCaptureBufferState)observation('failure',object(['stage',s(stage)],['reason',s('Transport buffer-state API unavailable')]));for(const event of bridge.drainCaptureEvents()){
      if(event.kind==='translation')observation('translation',object(['protocolEvent',s(event.data.protocolEvent)],['messageId',s(event.data.messageId)],['text',s(event.data.text)]),event.timestampMs,event.sequence);
      else{const e=event.data.event;observation('receipt',object(['event',object(['type',s(e.type)],['sequence',n(e.sequence)],['scheduledMs',n(e.scheduledMs)],['messageId',s(e.messageId)],['text',s(e.text)])]),event.timestampMs,event.sequence);}
    }}catch(error){observation('failure',object(['stage',s(stage)],['reason',s('Transport drain unavailable: '+failureMessage(error))]));}
  }
  function poll():void {
    timer=null;if(stopped)return;const time=performance.now(),work=budget();let primaryPresent=false,primary:unknown;const cleanup:unknown[]=[];
    try{let cs:CaptureCandidates|null=null;try{cs=candidates();}catch(error){unavailable('candidates',failureMessage(error),time);}let samples:{active:TextSample|null;history:TextSample[]}={active:null,history:[]};measured('runtimeProbe',()=>runtime(time));measured('domProbe',()=>{samples=dom(time,cs,work);});measured('scrollProbe',()=>captureScroll(time,samples,work,cs));measured('transportDrain',transport);}catch(error){primaryPresent=true;primary=error;}
    finally{try{work.mutations.stop();}catch(error){cleanup.push(error);}}
    if(primaryPresent||cleanup.length){const failure=primaryPresent?(cleanup.length?new AggregateError([primary,...cleanup],'Probe acquisition and cleanup failed'):primary):cleanup[0];scroll={status:'unavailable',reason:failureMessage(failure)};unavailable('geometry',scroll.reason,time);}
    else if(scroll.status==='available')emitScroll(scroll.value);
    if(!stopped)timer=setTimeout(poll,options.probeIntervalMs);
  }
  function readInstrumentation() {
    if(freshStats.incompleteReason!==null)throw new Error(freshStats.incompleteReason);
    if(freshStats.invalidClock)throw new Error('Fresh scroll page clock unavailable');
    function stat(name:keyof typeof stats){const v=stats[name];return {intervalMs:options.probeIntervalMs,callbacks:v.callbacks,callbackDurationTotalMs:v.total,maximumObservedGapMs:v.gap===null?{status:'unavailable' as const,reason:'At least two actual callbacks are needed'}:{status:'available' as const,value:v.gap}};}
    const buffers:ComparisonBoundedBuffer[]=[];if(bridge?.readCaptureBufferState)try{const state=bridge.readCaptureBufferState();if(state.name==='transport')buffers.push(project(state));}catch{}buffers.push(project(queue.state()));if(sourceFinal)buffers.push(project(sourceFinal));
    const instrumentation={runtimeProbe:stat('runtimeProbe'),domProbe:{...stat('domProbe'),selectionStrategy:'bounded-visible-candidates' as const},scrollProbe:stat('scrollProbe'),transportDrain:stat('transportDrain'),eventTiming:observerSnapshot(eventTiming),loaf:observerSnapshot(loaf),buffers};
    return 'scoredScrollSampling' in options?{...instrumentation,freshScrollProbe:{samplingMode:'on-demand' as const,callbacks:freshStats.callbacks,callbackDurationTotalMs:freshStats.total,maximumObservedGapMs:freshStats.gap===null?{status:'unavailable' as const,reason:'At least two actual callbacks are needed'}:{status:'available' as const,value:freshStats.gap}}}:instrumentation;
  }
  function drain(maxEntries=64):DrainedPageEntry[] {
    if(!Number.isSafeInteger(maxEntries)||maxEntries<0||maxEntries>64)throw new Error('Invalid unified drain size');return (queue.drain as (size:number)=>string[])(maxEntries).map(serialized=>{
      const observationPrefix='{"cohort":"observation","record":',exceptionPrefix='{"cohort":"exception","record":';if(serialized.startsWith(observationPrefix)&&serialized.endsWith('}'))return {cohort:'observation' as const,serialized:serialized.slice(observationPrefix.length,-1)};if(serialized.startsWith(exceptionPrefix)&&serialized.endsWith('}'))return {cohort:'exception' as const,serialized:serialized.slice(exceptionPrefix.length,-1)};
      const value=JSON.parse(serialized) as {cohort:unknown;serialized:unknown};if(Object.keys(value).join(',')!=='cohort,serialized'||value.cohort!=='exception'||typeof value.serialized!=='string')throw new Error('Owned cohort envelope integrity failure');return {cohort:'exception' as const,serialized:value.serialized};
    });
  }
  function stop(options?:{drainTransport:true}):void {
    if(stopped||stopInProgress)return;stopInProgress=true;
    freshAdmissionClosed=true;freshGeneration++;const pending=freshPending;if(pending)finishFresh(pending,{status:'unavailable',reason:'Fresh scroll acquisition stopped'});
    const failures:unknown[]=[];let recordingFailed=false;
    function attempt(cleanup:()=>void):void{try{cleanup();}catch(error){failures.push(error);try{observation('failure',object(['stage',s(stage)],['reason',s('Capture cleanup failed: '+failureMessage(error))]));}catch(recordingError){recordingFailed=true;failures.push(recordingError);}}}
    if(timer!==null)attempt(()=>clearTimeout(timer!));timer=null;
    // Only the owned normal terminal capture transfers remaining bridge evidence.
    // Cleanup stop performs no new destructive transport read after revocation.
    if(options?.drainTransport===true)attempt(()=>measured('transportDrain',transport));
    if(armed&&guard.status==='pending')attempt(()=>guardFail('Capture stopped before host readiness'));
    // Final acquisition precedes disconnect for each observer; every cleanup is attempted.
    for(const slot of [eventTiming,loaf])if(slot.observer){
      try{entries(slot,slot.observer.takeRecords());slot.finalTakeRecords=true;}catch(error){slot.invalid=true;slot.registration='failed';slot.reason=failureMessage(error);}
      try{slot.observer.disconnect();}catch(error){slot.invalid=true;slot.registration='failed';slot.reason=(slot.reason===null?'':slot.reason+'; ')+failureMessage(error);}finally{slot.observer=null;}
    }
    stopped=true;
    for(const type of nativeTypes)attempt(()=>removeEventListener(type,native,{capture:true}));
    attempt(()=>removeEventListener('error',onError));attempt(()=>removeEventListener('unhandledrejection',onRejection));
    attempt(()=>{if(console.warn===wrappers.warn)console.warn=originalConsole.warn;});attempt(()=>{if(console.error===wrappers.error)console.error=originalConsole.error;});guardElement=null;guardId=null;
    if(recordingFailed)throw new AggregateError(failures,'Capture cleanup and failure recording failed');
  }
  const state={drain,setPhase,closePhase,readPhases,armHostGuard,readHostGuard,readScroll,readScrollFresh,readInstrumentation,transferPreNavigation,readPreNavigationTransfer,stop};page[options.stateGlobal]=state;timer=setTimeout(poll,options.probeIntervalMs);return state;
}
export type ComparisonPageState=ReturnType<typeof installComparisonObservations>;
