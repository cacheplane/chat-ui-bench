import { BodyReader, copyBody, WireBudget, WireError,newWholeWireBudget,wholeByteInputDenied, type WireField } from './browser-frame-protobuf-wire.js';
import { decodeModernTrackEvent, decodeModernTrackEventWithMembers,decodeAnnotationTrackEvent, type EventFragment, type EventFragmentWithMembers,type AnnotationEventFragment } from './browser-frame-track-event-fragments.js';
import type {AnnotationWork} from './browser-frame-trace-framer.js';
export const PACKET_POLICY = 'pinned-browser-frame-packet-fragments-v1';
export const PACKET_SOURCE = Object.freeze({ perfettoPin: '403906f4adfbf287a02e5546f8430dcc9d56b649', chromiumPin: 'f842f52ef39fd97b449eb27cff414bf05a98ddce' });
export const PACKET_LABELS = Object.freeze({ normalizationCapability: 'structural-packet-fragments-only', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
export interface PacketOccurrence { scope: 'packet' | 'track_event' | 'reporter2' | 'graphics' | 'frame_sink'; fieldNumber: number; wireType: 0 | 1 | 2 | 5; start: number; valueStart: number; end: number }
export interface ProjectionContext { bytes: Uint8Array; budget: WireBudget; occurrences: PacketOccurrence[]; skippedFields: PacketOccurrence[] }
export interface PacketFields { timestamp?: string; timestampClockId?: string; sequenceId?: string; sequenceFlags?: string; previousPacketDropped?: string; machineId?: string; trustedPid?: string; incrementalStateCleared?: boolean; firstPacketOnSequence?: boolean }
export interface PacketFragment extends Readonly<typeof PACKET_LABELS> {
  status: 'decoded_packet_fragment'; fields: PacketFields; event?: EventFragment; source: typeof PACKET_SOURCE;
  bodyBytes: Uint8Array; opaquePayloads: PacketOccurrence[]; occurrences: PacketOccurrence[]; skippedFields: PacketOccurrence[]; presentFieldNumbers: number[]; consumedBytes: number;
}
export interface PacketUnavailable { status: 'unavailable'; diagnostics: { code: string }[] }
export interface PacketFragmentWithMembers extends Omit<PacketFragment,'event'> {event?:EventFragmentWithMembers}
export interface AnnotationPacketFragment extends Omit<PacketFragment,'event'>{event?:AnnotationEventFragment}
/** Internal restricted-profile path; no additional selected payload fields. */
export function decodeBrowserFramePacketWithMembers(input:unknown):PacketFragmentWithMembers|PacketUnavailable {
 return decodePacket(input,PACKET_POLICY,true) as PacketFragmentWithMembers|PacketUnavailable;
}
// Exactly the 86 data-oneof declarations at the pinned schema. Future unknown fields are opaque.
const DATA = new Set([11,60,117,118,120,122,129,2,90,9,4,5,6,7,89,33,34,35,37,74,75,38,40,39,45,46,109,47,48,49,51,52,53,54,131,57,62,63,65,66,67,68,69,134,135,70,71,73,77,78,82,83,84,86,91,124,125,126,127,128,130,61,64,43,44,1,36,50,133,72,95,99,100,101,102,103,107,110,111,113,115,119,123,132,138,900]);
const UNSUPPORTED = new Set([50,133,107,124,125]);
const OPAQUE = new Set([6,12,35,59,60]);
const SELECTED = new Set([8,58,10,13,42,98,79,41,87,11,...OPAQUE]);
// Private profiles: 0 standalone, 1 legacy whole input, 2 V3 refusal detail.
const WHOLE_PROFILE=1,WHOLE_TIMING_V3_PROFILE=2;
const WHOLE_PROVENANCE_PROFILE=3,PROVENANCE_FIELDS=32,PROVENANCE_REFUSAL='unsupported-packet-payload-field-124';
const decodePacket=createPacketDecoder();
export function scalar(field: WireField): bigint {
  if (field.occurrence.wireType !== 0 || field.scalar === undefined) throw new WireError('selected-field-wrong-wire-type');
  return field.scalar;
}
export function uint32(field: WireField): string {
  const value = scalar(field);
  if (value > 4294967295n) throw new WireError('uint32-overflow');
  return value.toString();
}
export function canonicalInt32(field: WireField): string {
  const value = scalar(field);
  if (value <= 2147483647n) return value.toString();
  if (value >= 18446744071562067968n) return (value - 18446744073709551616n).toString();
  throw new WireError('int32-overflow');
}
export function requireBody(field: WireField): void {
  if (field.occurrence.wireType !== 2) throw new WireError('selected-field-wrong-wire-type');
}
export function unique(seen: Set<number>, number: number): void {
  if (seen.has(number)) throw new WireError('duplicate-selected-field');
  seen.add(number);
}
function boolean(field: WireField): boolean {
  const value = scalar(field);
  if (value !== 0n && value !== 1n) throw new WireError('non-profile-bool');
  return value === 1n;
}
/** Explicit standalone body: body EOF supplies no Trace/capture EOF or semantic admission. */
export function decodeBrowserFramePacket(input: unknown, policy: unknown): PacketFragment | PacketUnavailable {
  return decodePacket(input,policy,false);
}
export function decodeBrowserFrameAnnotationPacket(input:unknown,work:AnnotationWork):AnnotationPacketFragment|PacketUnavailable{return decodePacket(input,PACKET_POLICY,false,work) as AnnotationPacketFragment|PacketUnavailable;}
/** Internal fixed whole-profile entry; no caller numeric limits. */
export function decodeWholeAnnotationPacket(input:unknown,work:AnnotationWork):AnnotationPacketFragment|PacketUnavailable{
 if(wholeByteInputDenied(input))return{status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]};
 return decodePacket(input,PACKET_POLICY,false,work,WHOLE_PROFILE) as AnnotationPacketFragment|PacketUnavailable;
}
/** Internal V3-only entry: distinguish fixed refused payloads without admitting them. */
export function decodeWholeUserTimingPacketV3(input:unknown,work:AnnotationWork):AnnotationPacketFragment|PacketUnavailable{
 if(wholeByteInputDenied(input))return{status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]};
 return decodePacket(input,PACKET_POLICY,false,work,WHOLE_TIMING_V3_PROFILE) as AnnotationPacketFragment|PacketUnavailable;
}
/** A fresh whole-study gate; callers cannot renew it at packet/sequence boundaries. */
export function createWholeProvenancePacketDecoder(){
 const decode=createPacketDecoder();
 return function(input:unknown,work:AnnotationWork):AnnotationPacketFragment|PacketUnavailable{
  if(wholeByteInputDenied(input))return{status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]};
  return decode(input,PACKET_POLICY,false,work,WHOLE_PROVENANCE_PROFILE) as AnnotationPacketFragment|PacketUnavailable;
 };
}
function createPacketDecoder(){
 let provenanceSeen=false;
 return function decodePacket(input:unknown,policy:unknown,retainMembers:boolean,annotationWork?:AnnotationWork,whole=0):PacketFragment|PacketUnavailable {
  try {
    if (policy !== PACKET_POLICY) throw new WireError('unsupported-policy');
    const bytes = copyBody(input); const budget = whole?newWholeWireBudget():new WireBudget();
    const context: ProjectionContext = { bytes, budget, occurrences: [], skippedFields: [] };
    const reader = new BodyReader(bytes, 0, bytes.byteLength, budget);
    const fields: PacketFields = {}; const present = new Set<number>(); const opaquePayloads: PacketOccurrence[] = [];
    let dataSeen = false; let event: EventFragment | undefined;
    while (!reader.complete) {
      const field = reader.next('root'); const o: PacketOccurrence = { ...field.occurrence, scope: 'packet' };
      context.occurrences.push(o);
      if (UNSUPPORTED.has(o.fieldNumber)) {
       if(whole===WHOLE_PROVENANCE_PROFILE&&o.fieldNumber===124){
        if(provenanceSeen)throw new WireError(PROVENANCE_REFUSAL);
        provenanceSeen=true;provenanceSubset(bytes,field,budget,annotationWork!);
       }else{
        if(whole>=WHOLE_TIMING_V3_PROFILE)switch(o.fieldNumber){
          case 50:throw new WireError('unsupported-packet-payload-field-50');
          case 133:throw new WireError('unsupported-packet-payload-field-133');
          case 107:throw new WireError('unsupported-packet-payload-field-107');
          case 124:throw new WireError('unsupported-packet-payload-field-124');
          case 125:throw new WireError('unsupported-packet-payload-field-125');
        }
        throw new WireError('unsupported-packet-payload');
       }
      }
      if (DATA.has(o.fieldNumber)) {
        if (dataSeen) throw new WireError('duplicate-data-oneof');
        dataSeen = true; requireBody(field);
      }
      if (!SELECTED.has(o.fieldNumber)) { context.skippedFields.push({ ...o }); continue; }
      unique(present, o.fieldNumber);
      if (OPAQUE.has(o.fieldNumber)) { requireBody(field); opaquePayloads.push({ ...o }); continue; }
      switch (o.fieldNumber) {
        case 8: fields.timestamp = scalar(field).toString(); break;
        case 58: fields.timestampClockId = uint32(field); break;
        case 10: fields.sequenceId = uint32(field); break;
        case 13: fields.sequenceFlags = uint32(field); break;
        case 42: fields.previousPacketDropped = uint32(field); break;
        case 98: fields.machineId = uint32(field); break;
        case 79: fields.trustedPid = canonicalInt32(field); break;
        case 41: fields.incrementalStateCleared = boolean(field); break;
        case 87: fields.firstPacketOnSequence = boolean(field); break;
        case 11: event = annotationWork?decodeAnnotationTrackEvent(context,o.valueStart,o.end,annotationWork):retainMembers?decodeModernTrackEventWithMembers(context,o.valueStart,o.end):decodeModernTrackEvent(context, o.valueStart, o.end); break;
      }
    }
    return { status: 'decoded_packet_fragment', fields, ...(event === undefined ? {} : { event }), source: PACKET_SOURCE,
      bodyBytes: bytes, opaquePayloads, occurrences: context.occurrences, skippedFields: context.skippedFields,
      presentFieldNumbers: [...present].sort((a,b) => a-b), consumedBytes: bytes.byteLength, ...PACKET_LABELS };
  } catch (error) {
    return { status: 'unavailable', diagnostics: [{ code: error instanceof WireError ? error.code : 'invalid-packet-input' }] };
  }
 };
}

/** Closed emitter-shaped subset, not a general TraceProvenance implementation. */
function provenanceSubset(bytes:Uint8Array,payload:WireField,budget:WireBudget,work:AnnotationWork):void{
 const outer=new BodyReader(bytes,0,bytes.byteLength,budget);let mask=0,visits=0,count=0;
 while(!outer.complete){
  if(++visits>6)throw new WireError(PROVENANCE_REFUSAL);
  work(1);const f=outer.next('root');let bit=0;
  switch(f.occurrence.fieldNumber){
   case 3:canonicalInt32(f);bit=1;break;
   case 8:scalar(f);bit=2;break;
   case 10:if(scalar(f)!==1n)throw new WireError(PROVENANCE_REFUSAL);bit=4;break;
   case 58:if(scalar(f)!==6n)throw new WireError(PROVENANCE_REFUSAL);bit=8;break;
   case 124:requireBody(f);bit=16;break;
   default:throw new WireError(PROVENANCE_REFUSAL);
  }
  if(mask&bit)throw new WireError(PROVENANCE_REFUSAL);mask|=bit;
 }
 if(mask!==31)throw new WireError(PROVENANCE_REFUSAL);
 function window(f:WireField){return new BodyReader(bytes,f.occurrence.valueStart,f.occurrence.end,budget);}
 function next(reader:BodyReader){if(++count>PROVENANCE_FIELDS)throw new WireError(PROVENANCE_REFUSAL);work(1);return reader.next('root');}
 const provenance=window(payload);
 while(!provenance.complete){
  const f=next(provenance);if(f.occurrence.fieldNumber!==2||f.occurrence.wireType!==2)throw new WireError(PROVENANCE_REFUSAL);
  const buffer=window(f);
  while(!buffer.complete){
   const entry=next(buffer);if(entry.occurrence.fieldNumber!==1||entry.occurrence.wireType!==2)throw new WireError(PROVENANCE_REFUSAL);
   const sequence=window(entry);let seen=0;
   while(!sequence.complete){
    const value=next(sequence),number=value.occurrence.fieldNumber;
    if(number!==1&&number!==2)throw new WireError(PROVENANCE_REFUSAL);
    if(seen&number)throw new WireError(PROVENANCE_REFUSAL);seen|=number;
    if(number===1)uint32(value);else canonicalInt32(value);
   }
   if(seen!==3)throw new WireError(PROVENANCE_REFUSAL);
  }
 }
}
