import { createHash } from 'node:crypto';
import {TraceRootFramer} from './browser-frame-trace-framer.js';
import { copyBody, WIRE_LIMITS, WireError } from './browser-frame-protobuf-wire.js';
import { decodeBrowserFramePacket, decodeBrowserFramePacketWithMembers, PACKET_POLICY, type PacketFragment, type PacketFragmentWithMembers } from './browser-frame-packet-fragments.js';
import {ProfileError,type Budget} from './browser-frame-ordered-state.js';

export const TRACE_INGRESS_POLICY = 'pinned-trace-packet-ingress-diagnostic-v1';
const LABELS = {
  normalizationCapability: 'structural-trace-container-fragments-only', inputOrder: 'byte-order',
  captureCompleteness: 'unestablished', clockAdmission: 'not_evaluated', targetLifetime: 'unestablished',
  sourceCoverage: 'unestablished', runtimeQualification: 'unestablished', evaluationEligibility: false,
  scoringEligibility: false, rankingEligibility: false, nativeSupported: false,
} as const;
type OwnedInputRef = { status: 'owned'; bytes: number; sha256: string };
type InputRef = OwnedInputRef | { status: 'unavailable' };
export interface TraceFrame {
  frameIndex: number; keyStart: number; keyEnd: number; lengthStart: number; lengthEnd: number;
  bodyStart: number; bodyEnd: number; bodyBytes: number; bodySha256: string; packet: PacketFragment;
}
export interface TraceIngressDiagnostic extends Readonly<typeof LABELS> {
  status: 'decoded_trace_container_fragments'; inputRef: OwnedInputRef; structuralContainerEOF: true;
  frameCount: number; frames: TraceFrame[];
}
export interface TraceIngressUnavailable extends Readonly<typeof LABELS> {
  status: 'unavailable'; inputRef: InputRef; structuralContainerEOF: boolean;
  diagnostics: { code: string; offset?: number; frameIndex?: number; cause?: string }[];
}
export interface SliceTraceFrame extends Omit<TraceFrame,'packet'> {packet:PacketFragmentWithMembers}
export interface SliceTraceIngress extends Omit<TraceIngressDiagnostic,'frames'> {frames:SliceTraceFrame[]}
/** Internal owned composition; the caller creates the one whole-call ledger. */
export function decodeBrowserFrameTraceForSlices(input:Uint8Array,budget:Budget):SliceTraceIngress|TraceIngressUnavailable {
 return decodeTrace(input,TRACE_INGRESS_POLICY,budget) as SliceTraceIngress|TraceIngressUnavailable;
}
type FrameWindow = Omit<TraceFrame, 'bodySha256' | 'bodyBytes' | 'packet'>;
const FRAME_LIMIT = 1024;
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const INPUT_AND_ROOT_CODES = new Set([
  'unsupported-policy', 'unsupported-byte-view', 'unavailable-byte-storage', 'byte-capacity',
  'truncated-varint', 'uint64-varint-overflow', 'invalid-field-number', 'unsupported-wire-type',
  'unsupported-trace-root-field', 'out-of-bounds-length', 'frame-capacity',
]);

/** Never inspect arbitrary thrown values without a second guard: even instanceof can trap. */
function errorCode(error: unknown): string {
  try {
    if (error instanceof WireError) {
      const code: unknown = error.code;
      if (typeof code === 'string' && code.length <= 64 && /^[\x20-\x7e]{1,64}$/.test(code) && INPUT_AND_ROOT_CODES.has(code)) return code;
    }
  } catch { /* Hostile thrown values carry no diagnostic authority. */ }
  return 'invalid-trace-input';
}

/** Whole supplied Trace bytes only. Structural EOF provides no capture or semantic authority. */
export function decodeBrowserFrameTrace(input: unknown, policy: unknown): TraceIngressDiagnostic | TraceIngressUnavailable {
 return decodeTrace(input,policy);
}
function decodeTrace(input:unknown,policy:unknown,sliceBudget?:Budget):TraceIngressDiagnostic|TraceIngressUnavailable {
  let inputRef: InputRef = { status: 'unavailable' };
  let structuralContainerEOF = false;
  let offset: number | undefined;
  let frameIndex: number | undefined;
  const unavailable = (code: string, cause?: string): TraceIngressUnavailable => ({ ...LABELS,
    status: 'unavailable', inputRef, structuralContainerEOF, diagnostics: [{ code,
      ...(offset === undefined ? {} : { offset }), ...(frameIndex === undefined ? {} : { frameIndex }),
      ...(cause === undefined ? {} : { cause }) }],
  });
  try {
    if (policy !== TRACE_INGRESS_POLICY) throw new WireError('unsupported-policy');
    const bytes = copyBody(input);
    inputRef = { status: 'owned', bytes: bytes.byteLength, sha256: hash(bytes) };
    const windows: FrameWindow[] = [];
    // Complete the entire narrow wrapper before any packet decoding or body allocation.
    const framer=new TraceRootFramer(bytes.byteLength,FRAME_LIMIT,WIRE_LIMITS.bytes,{end:frame=>windows.push(frame)});
    try{framer.feed(bytes);framer.finish();}finally{offset=framer.offset;frameIndex=framer.frameIndex;}
    structuralContainerEOF = true;
    const frames: TraceFrame[] = [];
    let occurrences = 0;
    let members = 0;
    for (const window of windows) {
      frameIndex = window.frameIndex;
      offset = window.bodyStart;
      const body = bytes.subarray(window.bodyStart, window.bodyEnd);
      const packet = sliceBudget===undefined?decodeBrowserFramePacket(body, PACKET_POLICY):decodeBrowserFramePacketWithMembers(body);
      if (packet.status === 'unavailable') {
        const cause = packet.diagnostics[0]?.code;
        return unavailable('packet-unavailable', typeof cause === 'string' && /^[\x20-\x7e]{1,64}$/.test(cause) ? cause : 'invalid-packet-input');
      }
      const event = packet.event;
      const packetMembers = (event?.fields.categoryIids?.length ?? 0) + (event?.fields.categories?.length ?? 0)
        + (event?.reporter2?.fields.surfaceTraceIds?.length ?? 0) + (event?.graphics?.fields.surfaceTraceIds?.length ?? 0);
      if (packet.occurrences.length > WIRE_LIMITS.occurrences - occurrences) return unavailable('aggregate-field-capacity');
      if (packetMembers > WIRE_LIMITS.members - members) return unavailable('aggregate-member-capacity');
      occurrences += packet.occurrences.length;
      members += packetMembers;
      if(sliceBudget!==undefined){
        const retainedEvent=(packet as PacketFragmentWithMembers).event;
        const shiftedMembers=(retainedEvent?.reporter2?.members.length??0)+(retainedEvent?.graphics?.members.length??0);
        sliceBudget.fieldsVisited(packet.occurrences.length,frameIndex);
        // The opt-in span shift is an additional pass, including for one large packed field.
        sliceBudget.repeatedWork(1+packetMembers+shiftedMembers,frameIndex);
      }
      // Packet owns its copy; hashes describe this snapshot, not future mutable output authority.
      frames.push({ ...window, bodyBytes: body.byteLength, bodySha256: hash(body), packet });
    }
    return { ...LABELS, status: 'decoded_trace_container_fragments', inputRef,
      structuralContainerEOF: true, frameCount: frames.length, frames };
  } catch (error) {
    if(sliceBudget!==undefined&&error instanceof ProfileError)return unavailable(error.code);
    return unavailable(errorCode(error));
  }
}
