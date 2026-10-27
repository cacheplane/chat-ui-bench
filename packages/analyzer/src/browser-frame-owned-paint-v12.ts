import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {TraceRootFramer,type RootFrame} from './browser-frame-trace-framer.js';
import {WireError} from './browser-frame-protobuf-wire.js';
import {createOwnedPaintKernelV12,OwnedPaintFailureV12,OWNED_PAINT_V12_POLICY,OWNED_PAINT_V12_AUTHORITY,OWNED_PAINT_V12_METRICS,type DiagnosticV12} from './browser-frame-owned-paint-v12-kernel.js';
import {OwnedPaintBudgetV12,OWNED_PAINT_V12_LIMITS as L,isOwnedPaintBudgetV12,cloneUsageV12,type UsageV12} from './browser-frame-owned-paint-v12-budget.js';
export {OWNED_PAINT_V12_POLICY,OWNED_PAINT_V12_AUTHORITY,OWNED_PAINT_V12_METRICS};
export type {UsageV12} from './browser-frame-owned-paint-v12-budget.js';
export interface AnchorV12 extends RootFrame {bodyBytes:number;bodySHA256:string}
type KernelSnapshot=ReturnType<ReturnType<typeof createOwnedPaintKernelV12>['snapshot']>;
export interface OwnedPaintStudyV12 extends KernelSnapshot {
 policy:typeof OWNED_PAINT_V12_POLICY;status:'complete-owned-selected-schema'|'unavailable';reason:string|null;
 inputRef:{bytes:number;sha256:string};framingBoundaryComplete:boolean;semanticProcessing:'complete-supported-schema'|'unavailable';
 sequenceStart:{raw:number;explained:number;unexplained:number;contradictions:number};supportedLegacyFramePresented:number;
 counters:Record<string,number>;usage:UsageV12;manifests:{packetSHA256:string;transitionSHA256:string;definitionSHA256:string;metadataSHA256:string;paintSHA256:string};
 anchors:AnchorV12[];diagnostics:DiagnosticV12[];authority:typeof OWNED_PAINT_V12_AUTHORITY;metrics:typeof OWNED_PAINT_V12_METRICS;
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),nativeLength=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,nativeBuffer=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,arrayLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength')!.get!,nativeSet=Uint8Array.prototype.set;
const knownWireCodes=new Set('unsupported-policy byte-capacity chunk-capacity unsupported-byte-view unavailable-byte-storage read-capacity stream-reentry stream-closed truncated-varint invalid-field-number unsupported-wire-type unsupported-trace-root-field uint64-varint-overflow out-of-bounds-length packet-body-capacity frame-capacity framer-closed framer-reentry truncated-fixed-field selected-field-wrong-wire-type duplicate-selected-field non-profile-bool uint32-overflow int32-overflow string-capacity string-total-capacity invalid-utf8 field-capacity member-capacity output-byte-capacity result-shape representation-release source-model-mismatch'.split(' '));
function diagnostic(error:unknown,phase:string,packetIndex:number|null):DiagnosticV12{
 if(error instanceof OwnedPaintFailureV12)return {code:error.code,phase,packetIndex,component:error.component,cause:error.causeCode};
 if(error instanceof WireError&&(knownWireCodes.has(error.code)||error.code.startsWith('capacity-')))return {code:error.code,phase,packetIndex,component:null,cause:null};
 return {code:'invalid-owned-input',phase,packetIndex,component:null,cause:null};
}
function extent(expectedBytes:number){if(typeof expectedBytes!=='number'||!Number.isSafeInteger(expectedBytes)||expectedBytes<0||expectedBytes>L.inputBytes)throw new WireError('byte-capacity');}
/** Exact public boundary. No budget/options/resolver or caller EOF is accepted. */
export function createOwnedPaintStudyV12(expectedBytes:number,policy:unknown){
 if(policy!==OWNED_PAINT_V12_POLICY)throw new WireError('unsupported-policy');extent(expectedBytes);
 return createOwnedPaintStudyV12ForReader(expectedBytes,new OwnedPaintBudgetV12());
}
/** Source-private composition only; a reader keeps this branded ledger private. */
export function createOwnedPaintStudyV12ForReader(expectedBytes:number,budget:OwnedPaintBudgetV12){
 extent(expectedBytes);if(!isOwnedPaintBudgetV12(budget))throw new WireError('invalid-owned-budget');
 const kernel=createOwnedPaintKernelV12(budget),rawHash=createHash('sha256');
 const anchors:AnchorV12[]=[],diagnostics:DiagnosticV12[]=[];
 let rawBytes=0,closed=false,active=false,rootFailed=false,semanticFailed=false,failure:string|null=null;
 let body:Uint8Array|null=null,bodyAt=0,bodyLease:(()=>void)|null=null,bodyHash=createHash('sha256');
 function fail(error:unknown,phase:string,packetIndex:number|null=null){
  if(failure===null){const d=diagnostic(error,phase,packetIndex);failure=d.code;diagnostics.push(d);}
  if(!semanticFailed){semanticFailed=true;kernel.withdraw();}
 }
 function releaseBody(){body=null;if(bodyLease){bodyLease();bodyLease=null;}}
 function physical(entries:Readonly<Record<string,number>>,phase:string,index:number|null=null){
  if(semanticFailed||rootFailed){budget.chargeBatch(entries,true);return;}
  try{budget.chargeBatch(entries);}catch(error){fail(error,phase,index);budget.chargeBatch(entries,true);}
 }
 const framer=new TraceRootFramer(expectedBytes,L.frames,L.packetBytes,{
  start(frame){
   bodyAt=0;physical({wrapperWork:16},'frame',frame.frameIndex);bodyHash=createHash('sha256');
   if(semanticFailed)return;
   try{const n=frame.bodyEnd-frame.bodyStart;bodyLease=budget.reserveTransient({bufferBytes:n});body=new Uint8Array(n);}
   catch(error){releaseBody();fail(error,'frame',frame.frameIndex);}
  },
  body(piece){
   physical({frameHashBytes:piece.byteLength},'frame');bodyHash.update(piece);
   if(body){try{budget.chargeCumulative('frameCopyBytes',piece.byteLength);nativeSet.call(body,piece,bodyAt);bodyAt+=piece.byteLength;}catch(error){releaseBody();fail(error,'frame');}}
  },
  end(frame){
   physical({wrapperWork:32},'frame',frame.frameIndex);const digest=bodyHash.digest('hex');kernel.counters.packets!++;
   if(anchors.length<L.anchors){const anchor={...frame,bodyBytes:frame.bodyEnd-frame.bodyStart,bodySHA256:digest};anchors.push(anchor);}
   const original=body;
   try{if(!semanticFailed&&original)kernel.process(original,frame);}catch(error){fail(error,'semantic',frame.frameIndex);}finally{releaseBody();}
  },
 });
 return Object.freeze({
  feed(input:unknown):void{
   if(active){rootFailed=true;fail(new WireError('stream-reentry'),'feed');throw new WireError('stream-reentry');}
   if(closed)throw new WireError('stream-closed');active=true;
   let chunkLease:(()=>void)|null=null;
   try{
    if(kernel.counters.feedCalls!>=L.readCalls)throw new WireError('read-capacity');kernel.counters.feedCalls!++;
    if(input===null||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Uint8Array.prototype)throw new WireError('unsupported-byte-view');
    let n:number;try{n=nativeLength.call(input);arrayLength.call(nativeBuffer.call(input));}catch{throw new WireError('unavailable-byte-storage');}
    if(n>L.chunkBytes)throw new WireError('chunk-capacity');if(n>expectedBytes-rawBytes)throw new WireError('byte-capacity');
    physical({inputCopyBytes:n,inputHashBytes:n},'feed');chunkLease=budget.reserveTransient({bufferBytes:n});
    const owned=new Uint8Array(n);try{nativeSet.call(owned,input as Uint8Array);}catch{throw new WireError('unavailable-byte-storage');}
    rawHash.update(owned);rawBytes+=n;if(!rootFailed)framer.feed(owned);
   }catch(error){rootFailed=true;releaseBody();fail(error,'feed');}finally{chunkLease?.();active=false;}
  },
  finish():OwnedPaintStudyV12{
   if(active||closed)throw new WireError('stream-closed');closed=true;
   let boundary=false;if(!rootFailed)try{framer.finish();boundary=true;}catch(error){rootFailed=true;fail(error,'framing');}
   if(rawBytes!==expectedBytes){boundary=false;fail(new OwnedPaintFailureV12('input-length'),'framing');}
   let manifests:ReturnType<typeof kernel.manifests>;
   try{manifests=kernel.manifests();}catch(error){fail(error,'closure');manifests=kernel.manifests();}
   if(failure!==null)budget.chargeClosure('wrapperWork',512);else budget.chargeFinalization('wrapperWork',512);
   const inputRef={bytes:rawBytes,sha256:rawHash.digest('hex')};
   function result():OwnedPaintStudyV12{
    const good=failure===null&&!semanticFailed&&!rootFailed,s=kernel.snapshot(good);
    return {policy:OWNED_PAINT_V12_POLICY,status:good?'complete-owned-selected-schema':'unavailable',reason:failure,inputRef,framingBoundaryComplete:boundary,semanticProcessing:good?'complete-supported-schema':'unavailable',markInventoryAdmission:s.markInventoryAdmission,paintInventoryAdmission:s.paintInventoryAdmission,state:s.state,evidence:s.evidence,rawDrop:s.rawDrop,sequenceStart:kernel.sequenceStart,candidates:s.candidates,paint:s.paint,supportedLegacyFramePresented:kernel.counters.supportedLegacyFramePresented!,counters:kernel.counters,usage:cloneUsageV12(budget.usage),manifests,anchors,diagnostics,authority:OWNED_PAINT_V12_AUTHORITY,metrics:OWNED_PAINT_V12_METRICS};
   }
   let out=result();
   try{budget.finalizeOutput(out,failure!==null);}catch(error){fail(error,'output');out=result();budget.finalizeOutput(out,true);}
   return out;
  },
 });
}
