import { createHash } from 'node:crypto';
import { copyBody, WIRE_LIMITS, WireError } from './browser-frame-protobuf-wire.js';
import { decodeBrowserFramePacket, PACKET_POLICY, type PacketFragment } from './browser-frame-packet-fragments.js';

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
    let cursor = 0;
    function varint(): bigint {
      let value = 0n;
      for (let index = 0; index < 10; index++) {
        if (cursor >= bytes.byteLength) throw new WireError('truncated-varint');
        const byte = bytes[cursor++]!;
        if (index === 9 && byte > 1) throw new WireError('uint64-varint-overflow');
        value |= BigInt(byte & 0x7f) << BigInt(index * 7);
        if ((byte & 0x80) === 0) return value;
      }
      throw new WireError('uint64-varint-overflow');
    }
    const windows: FrameWindow[] = [];
    // Complete the entire narrow wrapper before any packet decoding or body allocation.
    while (cursor < bytes.byteLength) {
      offset = cursor;
      frameIndex = windows.length;
      if (windows.length >= FRAME_LIMIT) throw new WireError('frame-capacity');
      const keyStart = cursor;
      const key = varint();
      const keyEnd = cursor;
      const field = key >> 3n;
      const wire = key & 7n;
      if (field < 1n || field > 536870911n) throw new WireError('invalid-field-number');
      if (wire !== 0n && wire !== 1n && wire !== 2n && wire !== 5n) throw new WireError('unsupported-wire-type');
      if (field !== 1n || wire !== 2n) throw new WireError('unsupported-trace-root-field');
      const lengthStart = cursor;
      const length = varint();
      const lengthEnd = cursor;
      if (length > BigInt(bytes.byteLength - cursor)) throw new WireError('out-of-bounds-length');
      const bodyStart = cursor;
      cursor += Number(length); // Bounded by the remaining owned byte window above.
      windows.push({ frameIndex, keyStart, keyEnd, lengthStart, lengthEnd, bodyStart, bodyEnd: cursor });
    }
    structuralContainerEOF = true;
    const frames: TraceFrame[] = [];
    let occurrences = 0;
    let members = 0;
    for (const window of windows) {
      frameIndex = window.frameIndex;
      offset = window.bodyStart;
      const body = bytes.subarray(window.bodyStart, window.bodyEnd);
      const packet = decodeBrowserFramePacket(body, PACKET_POLICY);
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
      // Packet owns its copy; hashes describe this snapshot, not future mutable output authority.
      frames.push({ ...window, bodyBytes: body.byteLength, bodySha256: hash(body), packet });
    }
    return { ...LABELS, status: 'decoded_trace_container_fragments', inputRef,
      structuralContainerEOF: true, frameCount: frames.length, frames };
  } catch (error) {
    return unavailable(errorCode(error));
  }
}
