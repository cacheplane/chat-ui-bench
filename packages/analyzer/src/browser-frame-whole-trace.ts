import {createHash}from'node:crypto';
import {types}from'node:util';
import {TraceRootFramer,type RootFrame}from'./browser-frame-trace-framer.js';
import {decodeBrowserFramePacket,PACKET_POLICY}from'./browser-frame-packet-fragments.js';
import {WireError}from'./browser-frame-protobuf-wire.js';
export const D0_POLICY='pinned-whole-trace-stream-structural-diagnostic-v1';
export const D0_LIMITS=Object.freeze({bytes:33554432,chunk:65536,packet:262144,packets:131072,reads:4096,occurrences:1048576,members:524288,anchors:128,diagnostics:32,resultBytes:262144,resultNodes:32768,resultStringBytes:65536});
export const D0_WORK=Object.freeze({reservation:14906603520,ceiling:15000000000});
const AUTHORITY=Object.freeze({annotations:'not_evaluated',orderedState:'not_evaluated',clock:'not_evaluated',marks:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',metric:'not_evaluated',captureCompleteness:'unestablished',evaluationEligibility:false,nativeGO:false,nativeSupported:false,performance:false,scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'}as const);
const typed=Object.getPrototypeOf(Uint8Array.prototype),nativeLength=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,nativeBuffer=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,arrayLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength')!.get!,nativeSet=Uint8Array.prototype.set;
export const D0_AUTHORITY=AUTHORITY;
const asciiJSON='66666666222622666666666666666666112111111111111111111111111111111111111111111111111111111111211111111111111111111111111111111111';
/** Size and native storage checked BEFORE allocating the new fixed-profile copy. */
function chunk(input:unknown):Uint8Array {
 if(input===null||typeof input!=='object'||types.isProxy(input)||Object.getPrototypeOf(input)!==Uint8Array.prototype)throw new WireError('unsupported-byte-view');
 const n:number=nativeLength.call(input);arrayLength.call(nativeBuffer.call(input));
 if(n>D0_LIMITS.chunk)throw new WireError('chunk-capacity');
 const out=new Uint8Array(n);nativeSet.call(out,input as Uint8Array);return out;
}
function code(error:unknown):string {
 try{if(error instanceof WireError&&typeof error.code==='string'&&/^[a-z0-9-]{1,64}$/.test(error.code))return error.code;}catch{}
 return 'invalid-stream-input';
}
export interface D0Anchor extends RootFrame {bodyBytes:number;bodySHA256:string}
export interface D0Result {
 policy:typeof D0_POLICY;status:'structural-study'|'unavailable';inputRef:{bytes:number;sha256:string};
 framingBoundaryComplete:boolean;structuralContainerEOF:false;physicalEOF:false;packetProjection:'complete'|'unavailable';
 packets:number;decodedPackets:number;occurrences:number;members:number;feedCalls:number;manifestSHA256:string;
 anchors:D0Anchor[];anchorsOmitted:number;diagnostics:{code:string;frameIndex?:number}[];authority:typeof AUTHORITY;
}
/** Final records are internal ordinary data; validate the complete JSON, not caller serialization hooks. */
export function encodeD0Result(value:unknown):Uint8Array {
 let nodes=0,records=0,strings=0,encoded=1;const seen=new Set<object>();
 function stringSize(text:string):void{
  encoded+=2;
  for(let i=0;i<text.length;i++){
   const c=text.charCodeAt(i);
   if(c<128)encoded+=asciiJSON.charCodeAt(c)-48;
   else if(c<2048)encoded+=2;
   else if(c>=55296&&c<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){encoded+=4;i++;}
   else encoded+=c>=55296&&c<=57343?6:3;
   if(encoded>D0_LIMITS.resultBytes)throw new WireError('result-capacity');
  }
 }
 function visit(v:unknown,depth:number):void{
  // Closed D0 records fit4096 nodes/256 objects, inside the profile's wider maxima.
  if(++nodes>4096||depth>12)throw new WireError('result-capacity');
  if(v===null||typeof v==='boolean'){encoded+=v===false?5:4;return;}
  if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)throw new WireError('result-shape');encoded+=String(v).length;return;}
  if(typeof v==='string'){if(v.length>D0_LIMITS.resultStringBytes)throw new WireError('result-capacity');strings+=Buffer.byteLength(v);if(strings>D0_LIMITS.resultStringBytes)throw new WireError('result-capacity');stringSize(v);return;}
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v))throw new WireError('result-shape');if(++records>256)throw new WireError('result-capacity');seen.add(v);
  const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))throw new WireError('result-shape');
  const names=Reflect.ownKeys(v);if(names.length>D0_LIMITS.resultNodes)throw new WireError('result-capacity');
  encoded+=2+Math.max(0,names.length-(array?2:1));
  if(array){const len=Object.getOwnPropertyDescriptor(v,'length')?.value;if(!Number.isInteger(len)||len<0||len>D0_LIMITS.resultNodes||names.length!==len+1)throw new WireError('result-shape');for(let i=0;i<len;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!('value'in d))throw new WireError('result-shape');visit(d.value,depth+1);}}
  else for(const k of names){if(typeof k!=='string'||k==='toJSON'||k.length>128)throw new WireError('result-shape');strings+=Buffer.byteLength(k);if(strings>D0_LIMITS.resultStringBytes)throw new WireError('result-capacity');stringSize(k);encoded++;const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))throw new WireError('result-shape');visit(d.value,depth+1);}
  seen.delete(v);
 }
 visit(value,0);if(encoded>D0_LIMITS.resultBytes)throw new WireError('result-capacity');const b=Buffer.from(JSON.stringify(value)+'\n');if(b.length!==encoded)throw new WireError('result-shape');return b;
}
/** No physical-reader arguments or EOF booleans. Synthetic use is always a study. */
export function createD0StructuralStudy(expectedBytes:number,policy:unknown){
 if(policy!==D0_POLICY)throw new WireError('unsupported-policy');
 if(!Number.isSafeInteger(expectedBytes)||expectedBytes<0||expectedBytes>D0_LIMITS.bytes)throw new WireError('byte-capacity');
 const rawHash=createHash('sha256'),manifest=createHash('sha256').update('D0 packet-manifest-v1\n');
 let rawBytes=0,feedCalls=0,closed=false,active=false,rootFailed=false,inputDenied=false,failure:string|null=null,projectionFailed=false;
 let body:Uint8Array|null=null,bodyAt=0,bodyHash=createHash('sha256'),packets=0,decodedPackets=0,occurrences=0,members=0;
 const anchors:D0Anchor[]=[],diagnostics:{code:string;frameIndex?:number}[]=[];
 function fail(reason:string,frameIndex?:number){failure??=reason;if(diagnostics.length===0)diagnostics.push({code:reason,...(frameIndex===undefined?{}:{frameIndex})});}
 const framer=new TraceRootFramer(expectedBytes,D0_LIMITS.packets,D0_LIMITS.packet,{
  start(frame){bodyHash=createHash('sha256');bodyAt=0;body=projectionFailed?null:new Uint8Array(frame.bodyEnd-frame.bodyStart);},
  body(piece){bodyHash.update(piece);if(body){nativeSet.call(body,piece,bodyAt);bodyAt+=piece.byteLength;}},
  end(frame){
   const digest=bodyHash.digest('hex'),n=frame.bodyEnd-frame.bodyStart;
   const record=`${frame.frameIndex},${frame.keyStart},${frame.keyEnd},${frame.lengthStart},${frame.lengthEnd},${frame.bodyStart},${frame.bodyEnd},${n},${digest}\n`;
   if(record.length>192)throw new WireError('manifest-capacity');manifest.update(record,'ascii');packets++;
   if(anchors.length<D0_LIMITS.anchors)anchors.push({...frame,bodyBytes:n,bodySHA256:digest});
   const current=body;body=null;
   if(projectionFailed||!current)return;
   const packet=decodeBrowserFramePacket(current,PACKET_POLICY);decodedPackets++;
   if(packet.status==='unavailable'){projectionFailed=true;fail('packet-unavailable',frame.frameIndex);return;}
   const event=packet.event,count=(event?.fields.categoryIids?.length??0)+(event?.fields.categories?.length??0)+(event?.reporter2?.fields.surfaceTraceIds?.length??0)+(event?.graphics?.fields.surfaceTraceIds?.length??0);
   if(packet.occurrences.length>D0_LIMITS.occurrences-occurrences||count>D0_LIMITS.members-members){projectionFailed=true;fail('aggregate-projection-capacity',frame.frameIndex);return;}
   occurrences+=packet.occurrences.length;members+=count;
  },
 });
 return Object.freeze({
  feed(input:unknown):void{
   if(active){rootFailed=true;fail('stream-reentry');throw new WireError('stream-reentry');}
   if(closed||inputDenied)throw new WireError('stream-closed');active=true;
   try{
    if(feedCalls>=D0_LIMITS.reads){inputDenied=true;throw new WireError('read-capacity');}feedCalls++;
    const owned=chunk(input);if(owned.byteLength>D0_LIMITS.bytes-rawBytes||owned.byteLength>expectedBytes-rawBytes)throw new WireError('byte-capacity');
    rawHash.update(owned);rawBytes+=owned.byteLength;
    if(!rootFailed)framer.feed(owned);
   }catch(error){rootFailed=true;body=null;fail(code(error));}finally{active=false;}
  },
  finish():D0Result{
   if(active||closed)throw new WireError('stream-closed');closed=true;let boundary=false;
   if(!rootFailed)try{framer.finish();boundary=true;}catch(error){rootFailed=true;fail(code(error));}
   if(rawBytes!==expectedBytes){boundary=false;fail('input-length');}
   const result:D0Result={policy:D0_POLICY,status:failure===null?'structural-study':'unavailable',inputRef:{bytes:rawBytes,sha256:rawHash.digest('hex')},framingBoundaryComplete:boundary,structuralContainerEOF:false,physicalEOF:false,packetProjection:projectionFailed||rootFailed?'unavailable':'complete',packets,decodedPackets,occurrences,members,feedCalls,manifestSHA256:manifest.digest('hex'),anchors,anchorsOmitted:packets-anchors.length,diagnostics,authority:AUTHORITY};
   encodeD0Result(result);body=null;return result;
  },
 });
}

/** Fixed-profile native chunk copy reused by the whole annotation study. */
export function copyWholeAnnotationChunk(input:unknown):Uint8Array{return chunk(input);}
