import { BodyReader, copyBody, signed64, WireBudget, WireError, type Occurrence, type WireField } from './browser-frame-protobuf-wire.js';

export const PAYLOAD_POLICY = 'pinned-chrome-frame-payload-fragments-v1';
/**
 * Pinned whole-schema references; both complete raw files have the same size and SHA256:
 * https://raw.githubusercontent.com/chromium/chromium/f842f52ef39fd97b449eb27cff414bf05a98ddce/base/tracing/protos/chrome_track_event.proto
 * https://raw.githubusercontent.com/google/perfetto/403906f4adfbf287a02e5546f8430dcc9d56b649/protos/third_party/chromium/chrome_track_event.proto
 * Hash preimage: all raw file bytes, before decoding, newline/BOM/whitespace normalization,
 * extraction or reserialization. This intentionally replaces the three old block-hash metadata
 * keys with an incompatible source shape, versioned separately from the unchanged decoder policy.
 * These are source references only: no runtime check, ABI coverage, frame ownership or FPS claim.
 */
export const PAYLOAD_SOURCE = Object.freeze({
  chromiumPin: 'f842f52ef39fd97b449eb27cff414bf05a98ddce', perfettoPin: '403906f4adfbf287a02e5546f8430dcc9d56b649',
  provenanceVersion: 'whole-schema-files-v1',
  hashPreimage: 'complete-raw-file-bytes',
  chromiumSchemaPath: 'base/tracing/protos/chrome_track_event.proto',
  perfettoSchemaPath: 'protos/third_party/chromium/chrome_track_event.proto',
  wholeSchemaBytes: 126011,
  wholeSchemaSha256: '2a26c01cd9b70dc95fd3ba2630ea918ea57012295225b0d1626e57a105974e03',
});
interface EnumValue { value: number; name: string }
interface FrameSinkFields { client?: string; sink?: string }
export interface PayloadFields {
  state?: EnumValue; frameSource?: string; frameSequence?: string; hostId?: string;
  surfaceTraceId?: string; displayTraceId?: string; frameType?: EnumValue;
  hasMissingContent?: boolean; checkerboardedNeedsRaster?: boolean; checkerboardedNeedsRecord?: boolean;
  step?: EnumValue; frameSinkId?: FrameSinkFields; surfaceTraceIds?: string[];
}
const LABELS = Object.freeze({ normalizationCapability: 'typed-payload-fragments-only', runtimeQualification: 'unestablished',
  sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
export interface DecodedFragment {
  status: 'decoded_fragment'; kind: 'reporter2' | 'graphics'; fields: PayloadFields;
  source: typeof PAYLOAD_SOURCE; presentFieldNumbers: number[]; occurrences: Occurrence[]; skippedFields: Occurrence[]; consumedBytes: number;
  normalizationCapability: typeof LABELS.normalizationCapability; runtimeQualification: typeof LABELS.runtimeQualification;
  sourceCoverage: typeof LABELS.sourceCoverage; evaluationEligibility: false; scoringEligibility: false; rankingEligibility: false;
}
export interface UnavailableFragment { status: 'unavailable'; diagnostics: { code: string }[] }
const STATES = ['no_update_desired', 'presented_all', 'presented_partial', 'dropped'] as const;
const FRAME_TYPES = ['forked', 'backfill'] as const;
const STEPS = ['unknown', 'did_not_produce_frame', 'generate_compositor_frame', 'generate_render_pass', 'issue_begin_frame',
  'receive_compositor_frame', 'receive_begin_frame', 'receive_begin_frame_discard', 'send_begin_main_frame', 'submit_compositor_frame',
  'surface_aggregation', 'send_buffer_swap', 'buffer_swap_post_submit', 'finish_buffer_swap', 'swap_buffers_ack',
  'exo_construct_compositor_frame', 'exo_submit_compositor_frame', 'exo_discard_compositor_frame', 'backend_send_buffer_swap',
  'backend_send_buffer_post_submit', 'backend_finish_buffer_swap', 'draw_and_swap', 'did_not_produce_compositor_frame',
  'send_on_begin_frame_mojo_message', 'send_on_standalone_begin_frame_mojo_message', 'send_submit_compositor_frame_mojo_message'] as const;
const REPORTER_FIELDS = new Set([1, 3, 4, 10, 11, 13, 15, 16, 17, 18]);
const GRAPHICS_FIELDS = new Set([1, 2, 3, 8, 10]);

function scalar(field: WireField): bigint {
  if (field.occurrence.wireType !== 0 || field.scalar === undefined) throw new WireError('selected-field-wrong-wire-type');
  return field.scalar;
}
function enumeration(field: WireField, names: readonly string[]): EnumValue {
  const value = scalar(field);
  if (value >= BigInt(names.length)) throw new WireError('unknown-selected-enum');
  const number = Number(value);
  return { value: number, name: names[number]! };
}
function boolean(field: WireField): boolean {
  const value = scalar(field);
  if (value !== 0n && value !== 1n) throw new WireError('non-profile-bool');
  return value === 1n;
}
function unique(seen: Set<number>, field: number): void {
  if (seen.has(field)) throw new WireError('duplicate-selected-field');
  seen.add(field);
}
function sink(bytes: Uint8Array, field: WireField, budget: WireBudget, occurrences: Occurrence[], skipped: Occurrence[]): FrameSinkFields {
  const o = field.occurrence;
  if (o.wireType !== 2) throw new WireError('selected-field-wrong-wire-type');
  // Sole message descent: Graphics root depth1 -> FrameSinkId depth2. Unknown children stay opaque.
  const reader = new BodyReader(bytes, o.valueStart, o.end, budget);
  const result: FrameSinkFields = {};
  const seen = new Set<number>();
  while (!reader.complete) {
    const child = reader.next('frame_sink'); const at = child.occurrence;
    occurrences.push(at);
    if (at.fieldNumber !== 1 && at.fieldNumber !== 2) { skipped.push({ ...at }); continue; }
    unique(seen, at.fieldNumber);
    const value = scalar(child);
    if (value > 4294967295n) throw new WireError('uint32-overflow');
    result[at.fieldNumber === 1 ? 'client' : 'sink'] = value.toString();
  }
  return result;
}
function members(bytes: Uint8Array, field: WireField, budget: WireBudget, values: string[]): void {
  const o = field.occurrence;
  if (o.wireType === 0) { budget.chargeMember(); values.push(signed64(scalar(field))); return; }
  if (o.wireType !== 2) throw new WireError('selected-field-wrong-wire-type');
  // Packed scalar values are a flat bounded window, not recursive messages or extra field occurrences.
  const reader = new BodyReader(bytes, o.valueStart, o.end, budget);
  while (!reader.complete) { budget.chargeMember(); values.push(signed64(reader.varint())); }
}
function reporter(fields: PayloadFields, field: WireField): void {
  switch (field.occurrence.fieldNumber) {
    case 1: fields.state = enumeration(field, STATES); break;
    case 3: fields.frameSource = scalar(field).toString(); break;
    case 4: fields.frameSequence = scalar(field).toString(); break;
    case 10: fields.hasMissingContent = boolean(field); break;
    case 11: fields.hostId = scalar(field).toString(); break;
    case 13: fields.frameType = enumeration(field, FRAME_TYPES); break;
    case 15: fields.checkerboardedNeedsRaster = boolean(field); break;
    case 16: fields.checkerboardedNeedsRecord = boolean(field); break;
    case 17: fields.surfaceTraceId = signed64(scalar(field)); break;
    case 18: fields.displayTraceId = signed64(scalar(field)); break;
  }
}

/** Decode an explicitly selected standalone body; success supplies no packet/clock/pair/target authority. */
export function decodeBrowserFramePayload(input: unknown, kind: unknown, policy: unknown): DecodedFragment | UnavailableFragment {
  try {
    if (policy !== PAYLOAD_POLICY) throw new WireError('unsupported-policy');
    if (kind !== 'reporter2' && kind !== 'graphics') throw new WireError('unsupported-payload-kind');
    const bytes = copyBody(input);
    const budget = new WireBudget(); const reader = new BodyReader(bytes, 0, bytes.byteLength, budget);
    const fields: PayloadFields = {};
    const occurrences: Occurrence[] = []; const skippedFields: Occurrence[] = [];
    const present = new Set<number>(); const selected = kind === 'reporter2' ? REPORTER_FIELDS : GRAPHICS_FIELDS;
    while (!reader.complete) {
      const field = reader.next('root'); const o = field.occurrence;
      occurrences.push(o);
      // Reserved declaration numbers19000..19999 are wire-readable opaque unknowns; never selected.
      if (!selected.has(o.fieldNumber)) { skippedFields.push({ ...o }); continue; }
      if (kind !== 'graphics' || o.fieldNumber !== 8) unique(present, o.fieldNumber);
      else present.add(8);
      if (kind === 'reporter2') { reporter(fields, field); continue; }
      switch (o.fieldNumber) {
        case 1: fields.step = enumeration(field, STEPS); break;
        case 2: fields.frameSinkId = sink(bytes, field, budget, occurrences, skippedFields); break;
        case 3: fields.displayTraceId = signed64(scalar(field)); break;
        case 8: fields.surfaceTraceIds ??= []; members(bytes, field, budget, fields.surfaceTraceIds); break;
        case 10: fields.surfaceTraceId = signed64(scalar(field)); break;
      }
    }
    return { status: 'decoded_fragment', kind, fields, source: PAYLOAD_SOURCE, presentFieldNumbers: [...present].sort((a, b) => a - b),
      occurrences, skippedFields, consumedBytes: bytes.byteLength, ...LABELS };
  } catch (error) {
    // One fixed diagnostic on denial; no prefix fields, arbitrary exception messages or caller evidence escape.
    return { status: 'unavailable', diagnostics: [{ code: error instanceof WireError ? error.code : 'invalid-payload-input' }] };
  }
}
