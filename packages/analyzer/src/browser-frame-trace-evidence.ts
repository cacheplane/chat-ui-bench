import {createHash} from 'node:crypto';
import {copyBody,WireError} from './browser-frame-protobuf-wire.js';
import {decodeBrowserFrameTrace,TRACE_INGRESS_POLICY} from './browser-frame-trace-ingress.js';
import {projectOrderedBrowserFrameEvidence,ORDERED_STATE_V2_POLICY,type OrderedEvidenceProjection} from './browser-frame-ordered-state.js';
export const TRACE_EVIDENCE_POLICY='whole-supplied-browser-frame-trace-evidence-v1';
const LABELS={normalizationCapability:'whole-supplied-trace-evidence-only',inputOrder:'byte-order',captureCompleteness:'unestablished',clockAdmission:'not_evaluated',targetLifetime:'unestablished',sourceCoverage:'unestablished',runtimeQualification:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,nativeSupported:false} as const;
type InputRef={status:'owned';bytes:number;sha256:string}|{status:'unavailable'};
interface FrameMetadata {frameIndex:number;packetIndex:number;keyStart:number;keyEnd:number;lengthStart:number;lengthEnd:number;bodyStart:number;bodyEnd:number;bodyBytes:number;bodySha256:string}
interface Diagnostic {stage:'input'|'ingress'|'ordered'|'composition';code:string;offset?:number;frameIndex?:number;packetIndex?:number;bodyStart?:number;component?:string;cause?:string}
export interface TraceEvidenceProjection extends Readonly<typeof LABELS> {status:'projected_trace_evidence';inputRef:Extract<InputRef,{status:'owned'}>;structuralContainerEOF:true;nestedOffsets:'packet-relative';frameCount:number;frames:readonly FrameMetadata[];ordered:OrderedEvidenceProjection}
export interface TraceEvidenceUnavailable extends Readonly<typeof LABELS> {status:'unavailable';inputRef:InputRef;structuralContainerEOF:boolean;diagnostics:readonly Diagnostic[]}
function freezeOwned<T>(value:T):T {
 // Only owned JSON metadata/results reach this traversal, never caller values
 // or packet byte views. Ordered evidence is already deeply frozen.
 if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freezeOwned(child);Object.freeze(value);
 }
 return value;
}
function inputCode(error:unknown):string {
 try{if(error instanceof WireError){const code:unknown=error.code;if(code==='unsupported-byte-view'||code==='unavailable-byte-storage'||code==='byte-capacity')return code;}}catch{/* Arbitrary thrown values confer no diagnostic authority. */}
 return 'invalid-trace-evidence-input';
}
/** Whole caller-supplied bytes only, not acquisition/persistence/presentation.
 * Frame offsets describe the wrapper. Nested ordered offsets stay relative to
 * their packet body; add frames[packetIndex].bodyStart for a whole-input anchor.
 * The fixed domain is merely a diagnostic grouping label. Container byte order
 * does not upgrade the ordered projector's caller_declared capture semantics.
 * No byte views are returned. Inherited bounded copies/decoding and final JSON
 * admission checks do not promise a transient-allocation limit. */
export function projectBrowserFrameTraceEvidence(input:unknown,policy:unknown):TraceEvidenceProjection|TraceEvidenceUnavailable {
 let inputRef:InputRef={status:'unavailable'},structuralContainerEOF=false;
 const unavailable=(diagnostic:Diagnostic):TraceEvidenceUnavailable=>freezeOwned({...LABELS,status:'unavailable',inputRef,structuralContainerEOF,diagnostics:[diagnostic]});
 if(policy!==TRACE_EVIDENCE_POLICY)return unavailable({stage:'input',code:'unsupported-policy'});
 let bytes:Uint8Array;try{bytes=copyBody(input);}catch(error){return unavailable({stage:'input',code:inputCode(error)});}
 inputRef={status:'owned',bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};
 try{
  const ingress=decodeBrowserFrameTrace(bytes,TRACE_INGRESS_POLICY);structuralContainerEOF=ingress.structuralContainerEOF;
  if(ingress.status==='unavailable')return unavailable({stage:'ingress',...ingress.diagnostics[0]!});
  if(ingress.inputRef.bytes!==inputRef.bytes||ingress.inputRef.sha256!==inputRef.sha256||ingress.frameCount!==ingress.frames.length)return unavailable({stage:'composition',code:'input-reference-mismatch'});
  const ordered=projectOrderedBrowserFrameEvidence({domain:'whole-supplied-trace-diagnostic-group-v1',packets:ingress.frames.map(f=>f.packet.bodyBytes)},ORDERED_STATE_V2_POLICY);
  if(ordered.status==='unavailable'){
   const diagnostic=ordered.diagnostics[0]!,frame=diagnostic.packetIndex===undefined?undefined:ingress.frames[diagnostic.packetIndex];
   return unavailable({stage:'ordered',...diagnostic,...(frame===undefined?{}:{bodyStart:frame.bodyStart})});
  }
  if(ordered.bodies.length!==ingress.frames.length||ordered.bodies.some((b,i)=>{const f=ingress.frames[i]!;return b.packetIndex!==i||f.frameIndex!==i||b.bytes!==f.bodyBytes||b.sha256!==f.bodySha256||f.bodyEnd-f.bodyStart!==f.bodyBytes;}))return unavailable({stage:'composition',code:'packet-reference-mismatch'});
  const frames:FrameMetadata[]=ingress.frames.map(f=>({frameIndex:f.frameIndex,packetIndex:f.frameIndex,keyStart:f.keyStart,keyEnd:f.keyEnd,lengthStart:f.lengthStart,lengthEnd:f.lengthEnd,bodyStart:f.bodyStart,bodyEnd:f.bodyEnd,bodyBytes:f.bodyBytes,bodySha256:f.bodySha256}));
  const result:TraceEvidenceProjection={...LABELS,status:'projected_trace_evidence',inputRef,structuralContainerEOF:true,nestedOffsets:'packet-relative',frameCount:frames.length,frames,ordered};
  // Same4MiB final ceiling as ordered evidence, including wrapper overhead.
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>4194304)return unavailable({stage:'composition',code:'output-byte-capacity'});
  return freezeOwned(result);
 }catch{return unavailable({stage:'composition',code:'trace-evidence-composition-failed'});}
}
