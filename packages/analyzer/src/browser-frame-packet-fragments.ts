import { BodyReader, copyBody, WireBudget, WireError, type WireField } from './browser-frame-protobuf-wire.js';
import { decodeModernTrackEvent, type EventFragment } from './browser-frame-track-event-fragments.js';
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
// Exactly the 86 data-oneof declarations at the pinned schema. Future unknown fields are opaque.
const DATA = new Set([11,60,117,118,120,122,129,2,90,9,4,5,6,7,89,33,34,35,37,74,75,38,40,39,45,46,109,47,48,49,51,52,53,54,131,57,62,63,65,66,67,68,69,134,135,70,71,73,77,78,82,83,84,86,91,124,125,126,127,128,130,61,64,43,44,1,36,50,133,72,95,99,100,101,102,103,107,110,111,113,115,119,123,132,138,900]);
const UNSUPPORTED = new Set([50,133,107,124,125]);
const OPAQUE = new Set([6,12,35,59,60]);
const SELECTED = new Set([8,58,10,13,42,98,79,41,87,11,...OPAQUE]);
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
  try {
    if (policy !== PACKET_POLICY) throw new WireError('unsupported-policy');
    const bytes = copyBody(input); const budget = new WireBudget();
    const context: ProjectionContext = { bytes, budget, occurrences: [], skippedFields: [] };
    const reader = new BodyReader(bytes, 0, bytes.byteLength, budget);
    const fields: PacketFields = {}; const present = new Set<number>(); const opaquePayloads: PacketOccurrence[] = [];
    let dataSeen = false; let event: EventFragment | undefined;
    while (!reader.complete) {
      const field = reader.next('root'); const o: PacketOccurrence = { ...field.occurrence, scope: 'packet' };
      context.occurrences.push(o);
      if (UNSUPPORTED.has(o.fieldNumber)) throw new WireError('unsupported-packet-payload');
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
        case 11: event = decodeModernTrackEvent(context, o.valueStart, o.end); break;
      }
    }
    return { status: 'decoded_packet_fragment', fields, ...(event === undefined ? {} : { event }), source: PACKET_SOURCE,
      bodyBytes: bytes, opaquePayloads, occurrences: context.occurrences, skippedFields: context.skippedFields,
      presentFieldNumbers: [...present].sort((a,b) => a-b), consumedBytes: bytes.byteLength, ...PACKET_LABELS };
  } catch (error) {
    return { status: 'unavailable', diagnostics: [{ code: error instanceof WireError ? error.code : 'invalid-packet-input' }] };
  }
}
