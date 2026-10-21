import { BodyReader, copyBody, WireBudget, WireError, type WireField } from './browser-frame-protobuf-wire.js';
export const STATE_BODY_POLICY = 'pinned-browser-frame-state-body-fragments-v1';
export const STATE_BODY_SOURCE = Object.freeze({ perfettoPin: '403906f4adfbf287a02e5546f8430dcc9d56b649' });
const LABELS = Object.freeze({ normalizationCapability: 'state-body-fragments-only', sequenceValidity: 'not_evaluated', defaultEpoch: 'not_evaluated', internResolution: 'not_evaluated', clockAdmission: 'not_evaluated', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
type Kind = 'defaults' | 'interned_names' | 'clock_snapshot';
type Scope = 'defaults' | 'track_defaults' | 'interned_data' | 'event_category' | 'event_name' | 'clock_snapshot' | 'clock';
export interface StateOccurrence { scope: Scope; fieldNumber: number; wireType: 0 | 1 | 2 | 5; start: number; valueStart: number; end: number }
export interface TrackDefaults { trackUuid?: string; counterTrackUuids?: string[]; doubleCounterTrackUuids?: string[] }
export interface InternEntry { table: 'event_categories' | 'event_names'; iid: string; name: string }
export interface AnnotationInternEntry extends Omit<InternEntry,'table'>{table:InternEntry['table']|'debug_annotation_names'}
export interface ClockFields { clockId?: string; timestamp?: string; isIncremental?: boolean; unitMultiplierNs?: string }
export interface StateFields { timestampClockId?: string; trackEventDefaults?: TrackDefaults; entries?: InternEntry[]; clocks?: ClockFields[]; primaryTraceClock?: string }
export interface AnnotationStateFields extends Omit<StateFields,'entries'>{entries?:AnnotationInternEntry[]}
export interface StateBodyFragment extends Readonly<typeof LABELS> {
  status: 'decoded_state_body_fragment'; kind: Kind; fields: StateFields; source: typeof STATE_BODY_SOURCE;
  bodyBytes: Uint8Array; occurrences: StateOccurrence[]; skippedFields: StateOccurrence[]; presentFieldNumbers: number[]; consumedBytes: number;
}
export interface StateBodyUnavailable { status: 'unavailable'; diagnostics: { code: string }[] }
export interface AnnotationStateBodyFragment extends Omit<StateBodyFragment,'fields'>{fields:AnnotationStateFields}
interface Context { bytes: Uint8Array; budget: WireBudget; occurrences: StateOccurrence[]; skippedFields: StateOccurrence[] }
function visit(context: Context, start: number, end: number, scope: Scope, selected: (field: WireField) => boolean): void {
  const reader = new BodyReader(context.bytes, start, end, context.budget);
  while (!reader.complete) {
    const field = reader.next('root'); const o: StateOccurrence = { ...field.occurrence, scope };
    context.occurrences.push(o);
    if (!selected(field)) context.skippedFields.push({ ...o });
  }
}
function scalar(field: WireField): bigint {
  if (field.occurrence.wireType !== 0 || field.scalar === undefined) throw new WireError('selected-field-wrong-wire-type');
  return field.scalar;
}
function uint32(field: WireField): string {
  const value = scalar(field); if (value > 4294967295n) throw new WireError('uint32-overflow'); return value.toString();
}
function int32(field: WireField): string {
  const value = scalar(field);
  if (value <= 2147483647n) return value.toString();
  if (value >= 18446744071562067968n) return (value - 18446744073709551616n).toString();
  throw new WireError('int32-overflow');
}
function boolean(field: WireField): boolean {
  const value = scalar(field); if (value !== 0n && value !== 1n) throw new WireError('non-profile-bool'); return value === 1n;
}
function requireBody(field: WireField): void {
  if (field.occurrence.wireType !== 2) throw new WireError('selected-field-wrong-wire-type');
}
function unique(seen: Set<number>, field: number): void {
  if (seen.has(field)) throw new WireError('duplicate-selected-field'); seen.add(field);
}
function members(context: Context, field: WireField, values: string[]): void {
  const o = field.occurrence;
  if (o.wireType === 0) { context.budget.chargeMember(); values.push(scalar(field).toString()); return; }
  requireBody(field); const packed = new BodyReader(context.bytes, o.valueStart, o.end, context.budget);
  while (!packed.complete) { context.budget.chargeMember(); values.push(packed.varint().toString()); }
}
function defaults(context: Context, fields: Omit<StateFields,'entries'>, present: Set<number>): void {
  visit(context, 0, context.bytes.byteLength, 'defaults', field => {
    const o = field.occurrence;
    if (o.fieldNumber !== 58 && o.fieldNumber !== 11) return false;
    unique(present, o.fieldNumber);
    if (o.fieldNumber === 58) fields.timestampClockId = uint32(field);
    else {
      requireBody(field); const child: TrackDefaults = {}; const seen = new Set<number>();
      visit(context, o.valueStart, o.end, 'track_defaults', entry => {
        const n = entry.occurrence.fieldNumber;
        if (n === 11) { unique(seen,n); child.trackUuid = scalar(entry).toString(); }
        else if (n === 31) { child.counterTrackUuids ??= []; members(context,entry,child.counterTrackUuids); }
        else if (n === 45) { child.doubleCounterTrackUuids ??= []; members(context,entry,child.doubleCounterTrackUuids); }
        else return false;
        return true;
      });
      fields.trackEventDefaults = child;
    }
    return true;
  });
}
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function interned(context: Context, fields: AnnotationStateFields, present: Set<number>,annotations=false): void {
  let entryCount = 0; let stringBytes = 0;
  const categoryIds = new Set<string>(); const nameIds = new Set<string>();const annotationIds=new Set<string>();
  visit(context, 0, context.bytes.byteLength, 'interned_data', field => {
    const o = field.occurrence;
    if (o.fieldNumber !== 1 && o.fieldNumber !== 2&&!(annotations&&o.fieldNumber===3)) return false;
    context.budget.chargeMember();
    if (++entryCount > 4096) throw new WireError('intern-entry-capacity');
    requireBody(field); present.add(o.fieldNumber);
    const table = o.fieldNumber === 1 ? 'event_categories' :o.fieldNumber===2? 'event_names':'debug_annotation_names';
    const seen = new Set<number>(); let iid: string | undefined; let name: string | undefined;
    visit(context, o.valueStart, o.end, table === 'event_categories' ? 'event_category' : 'event_name', entry => {
      const at = entry.occurrence;
      if (at.fieldNumber !== 1 && at.fieldNumber !== 2) return false;
      unique(seen, at.fieldNumber);
      if (at.fieldNumber === 1) {
        const value = scalar(entry);
        if (value === 0n) throw new WireError('invalid-intern-iid'); iid = value.toString();
      } else {
        requireBody(entry); const length = at.end - at.valueStart;
        if (length > 4096) throw new WireError('string-capacity');
        if ((stringBytes += length) > 32768) throw new WireError('string-total-capacity');
        try { name = utf8.decode(context.bytes.subarray(at.valueStart,at.end)); }
        catch { throw new WireError('invalid-utf8'); }
      }
      return true;
    });
    if (iid === undefined) throw new WireError('missing-intern-iid');
    if (name === undefined) throw new WireError('missing-intern-name');
    const ids = table === 'event_categories' ? categoryIds :table==='event_names'? nameIds:annotationIds;
    // Explicit body-only stricter policy, including identical repeats; no sequence lookup.
    if (ids.has(iid)) throw new WireError('duplicate-intern-iid'); ids.add(iid);
    (fields.entries ??= []).push({ table, iid, name });
    return true;
  });
}
function clocks(context: Context, fields: Omit<StateFields,'entries'>, present: Set<number>): void {
  let childCount = 0; const clockIds = new Set<string>();
  visit(context, 0, context.bytes.byteLength, 'clock_snapshot', field => {
    const o = field.occurrence;
    if (o.fieldNumber === 2) { unique(present,2); fields.primaryTraceClock = int32(field); return true; }
    if (o.fieldNumber !== 1) return false;
    context.budget.chargeMember();
    if (++childCount > 1024) throw new WireError('clock-child-capacity');
    requireBody(field); present.add(1);
    const clock: ClockFields = {}; const seen = new Set<number>();
    visit(context,o.valueStart,o.end,'clock',entry => {
      const n = entry.occurrence.fieldNumber;
      if (n < 1 || n > 4) return false;
      unique(seen,n);
      if (n === 1) clock.clockId = uint32(entry);
      else if (n === 2) clock.timestamp = scalar(entry).toString();
      else if (n === 3) clock.isIncremental = boolean(entry);
      else clock.unitMultiplierNs = scalar(entry).toString();
      return true;
    });
    if (clock.clockId !== undefined) {
      if (clockIds.has(clock.clockId)) throw new WireError('duplicate-clock-id'); clockIds.add(clock.clockId);
    }
    (fields.clocks ??= []).push(clock); return true;
  });
}
/** Explicit standalone body only; success establishes no parent packet or capture origin. */
export function decodeBrowserFrameStateBody(input: unknown, kind: unknown, policy: unknown): StateBodyFragment | StateBodyUnavailable {return decodeState(input,kind,policy,false) as StateBodyFragment|StateBodyUnavailable;}
export function decodeBrowserFrameAnnotationStateBody(input:unknown):AnnotationStateBodyFragment|StateBodyUnavailable{return decodeState(input,'interned_names',STATE_BODY_POLICY,true);}
function decodeState(input: unknown, kind: unknown, policy: unknown,annotations:boolean): AnnotationStateBodyFragment | StateBodyUnavailable {
  try {
    if (policy !== STATE_BODY_POLICY) throw new WireError('unsupported-policy');
    if (kind !== 'defaults' && kind !== 'interned_names' && kind !== 'clock_snapshot') throw new WireError('unsupported-state-body-kind');
    const bytes = copyBody(input); const context: Context = { bytes, budget: new WireBudget(), occurrences: [], skippedFields: [] };
    const fields: AnnotationStateFields = {}; const present = new Set<number>();
    if (kind === 'defaults') defaults(context,fields,present);
    else if (kind === 'interned_names') interned(context,fields,present,annotations);
    else clocks(context,fields,present);
    return { status: 'decoded_state_body_fragment', kind, fields, source: STATE_BODY_SOURCE, bodyBytes: bytes,
      occurrences: context.occurrences, skippedFields: context.skippedFields, presentFieldNumbers: [...present].sort((a,b)=>a-b), consumedBytes: bytes.byteLength, ...LABELS };
  } catch (error) {
    return { status: 'unavailable', diagnostics: [{ code: error instanceof WireError ? error.code : 'invalid-state-body-input' }] };
  }
}
