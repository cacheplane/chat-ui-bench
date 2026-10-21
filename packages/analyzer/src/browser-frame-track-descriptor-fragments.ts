import { BodyReader, copyBody, signed64, WireBudget, WireError,newWholeWireBudget,wholeByteInputDenied, type WireField } from './browser-frame-protobuf-wire.js';

export const TRACK_DESCRIPTOR_BODY_POLICY = 'pinned-browser-frame-track-descriptor-body-fragments-v1';
export const TRACK_DESCRIPTOR_BODY_SOURCE = Object.freeze({ perfettoPin: '403906f4adfbf287a02e5546f8430dcc9d56b649' });
const LABELS = Object.freeze({ normalizationCapability: 'track-descriptor-body-fragments-only', processIncarnation: 'unestablished',
  parentAssociation: 'not_evaluated', clockAdmission: 'not_evaluated', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished',
  evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
type Scope = 'track_descriptor' | 'process_descriptor' | 'thread_descriptor';
export interface TrackDescriptorOccurrence { scope: Scope; fieldNumber: number; wireType: 0 | 1 | 2 | 5; start: number; valueStart: number; end: number }
export interface ProcessDescriptorFields { pid?: string; startTimestampNs?: string }
export interface ThreadDescriptorFields { pid?: string; tid?: string }
export interface TrackDescriptorFields { uuid?: string; parentUuid?: string; process?: ProcessDescriptorFields; thread?: ThreadDescriptorFields }
export interface TrackDescriptorBodyFragment extends Readonly<typeof LABELS> {
  status: 'decoded_track_descriptor_body_fragment'; fields: TrackDescriptorFields; source: typeof TRACK_DESCRIPTOR_BODY_SOURCE;
  descriptorAssociation: 'none' | 'process-only' | 'thread-only' | 'ambiguous-process-and-thread';
  bodyBytes: Uint8Array; occurrences: TrackDescriptorOccurrence[]; skippedFields: TrackDescriptorOccurrence[]; presentFieldNumbers: number[]; consumedBytes: number;
}
export interface TrackDescriptorBodyUnavailable { status: 'unavailable'; diagnostics: { code: string }[] }
interface Context { bytes: Uint8Array; budget: WireBudget; occurrences: TrackDescriptorOccurrence[]; skippedFields: TrackDescriptorOccurrence[] }
function visit(context: Context, start: number, end: number, scope: Scope, selected: (field: WireField) => boolean): void {
  const reader = new BodyReader(context.bytes, start, end, context.budget);
  while (!reader.complete) {
    const field = reader.next('root'), occurrence: TrackDescriptorOccurrence = { ...field.occurrence, scope };
    context.occurrences.push(occurrence);
    if (!selected(field)) context.skippedFields.push({ ...occurrence });
  }
}
function scalar(field: WireField): bigint {
  if (field.occurrence.wireType !== 0 || field.scalar === undefined) throw new WireError('selected-field-wrong-wire-type');
  return field.scalar;
}
function pid(field: WireField): string {
  const value = scalar(field);
  if (value <= 2147483647n) return value.toString();
  if (value >= 18446744071562067968n) return (value - 18446744073709551616n).toString();
  throw new WireError('int32-overflow');
}
function unique(seen: Set<number>, field: number): void {
  if (seen.has(field)) throw new WireError('duplicate-selected-field');
  seen.add(field);
}
/** Internal fixed whole-profile entry; no caller numeric limits. */
export function decodeWholeDescriptor(input:unknown):TrackDescriptorBodyFragment|TrackDescriptorBodyUnavailable{
 if(wholeByteInputDenied(input))return{status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]};
 return decodeDescriptor(input,TRACK_DESCRIPTOR_BODY_POLICY,true);
}
/** Standalone TrackDescriptor body only, not a packet/trace or resolved owner.
 * Fixed selected children: ProcessDescriptor(pid:int32,start_timestamp_ns:int64)
 * and ThreadDescriptor(pid:int32,tid:int64). Unknown bodies remain opaque.
 * Presence of both children is preserved as ambiguous, never first/last-wins.
 * start_timestamp_ns is a trace-clock field, not proof of OS process birth.
 * A parent UUID is retained without ancestry or thread/process inheritance.
 */
export function decodeBrowserFrameTrackDescriptorBody(input: unknown, policy: unknown): TrackDescriptorBodyFragment | TrackDescriptorBodyUnavailable {
 return decodeDescriptor(input,policy,false);
}
function decodeDescriptor(input:unknown,policy:unknown,whole:boolean):TrackDescriptorBodyFragment|TrackDescriptorBodyUnavailable{
  try {
    if (policy !== TRACK_DESCRIPTOR_BODY_POLICY) throw new WireError('unsupported-policy');
    const bytes = copyBody(input);
    const context: Context = { bytes, budget: whole?newWholeWireBudget():new WireBudget(), occurrences: [], skippedFields: [] };
    const fields: TrackDescriptorFields = {}, present = new Set<number>();
    visit(context, 0, bytes.byteLength, 'track_descriptor', field => {
      const o = field.occurrence, n = o.fieldNumber;
      if (![1, 3, 4, 5].includes(n)) return false;
      unique(present, n);
      if (n === 1) fields.uuid = scalar(field).toString();
      else if (n === 5) fields.parentUuid = scalar(field).toString();
      else {
        if (o.wireType !== 2) throw new WireError('selected-field-wrong-wire-type');
        // At most two singular selected child messages; no repeated registry.
        context.budget.chargeMember();
        const seen = new Set<number>();
        if (n === 3) {
          const child: ProcessDescriptorFields = {};
          visit(context, o.valueStart, o.end, 'process_descriptor', entry => {
            const k = entry.occurrence.fieldNumber;
            if (k !== 1 && k !== 7) return false;
            unique(seen, k);
            if (k === 1) child.pid = pid(entry);
            else child.startTimestampNs = signed64(scalar(entry));
            return true;
          });
          fields.process = child;
        } else {
          const child: ThreadDescriptorFields = {};
          visit(context, o.valueStart, o.end, 'thread_descriptor', entry => {
            const k = entry.occurrence.fieldNumber;
            if (k !== 1 && k !== 2) return false;
            unique(seen, k);
            if (k === 1) child.pid = pid(entry);
            else child.tid = signed64(scalar(entry));
            return true;
          });
          fields.thread = child;
        }
      }
      return true;
    });
    const descriptorAssociation = fields.process !== undefined ? (fields.thread !== undefined ? 'ambiguous-process-and-thread' : 'process-only')
      : fields.thread !== undefined ? 'thread-only' : 'none';
    return { status: 'decoded_track_descriptor_body_fragment', fields, source: TRACK_DESCRIPTOR_BODY_SOURCE, descriptorAssociation,
      bodyBytes: bytes, occurrences: context.occurrences, skippedFields: context.skippedFields, presentFieldNumbers: [...present].sort((a, b) => a - b),
      consumedBytes: bytes.byteLength, ...LABELS };
  } catch (error) {
    return { status: 'unavailable', diagnostics: [{ code: error instanceof WireError ? error.code : 'invalid-track-descriptor-body-input' }] };
  }
}
