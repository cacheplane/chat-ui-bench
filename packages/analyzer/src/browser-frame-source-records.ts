export const POLICY = 'normalized-browser-frame-source-records-v1';
export const CHROMIUM_PIN = 'f842f52ef39fd97b449eb27cff414bf05a98ddce';
export const PERFETTO_PIN = '403906f4adfbf287a02e5546f8430dcc9d56b649';
export const LIMITS = Object.freeze({ repetitions: 3, phases: 6, records: 4096, identities: 4096, members: 16384, diagnostics: 32 });
export function decimal(value: unknown, domain: 'int64' | 'ns' | 'uint64' | 'uint32'): bigint | null {
  if (typeof value !== 'string' || value.length > (domain === 'uint32' ? 10 : 20) || !/^(0|-?[1-9][0-9]*)$/.test(value)) return null;
  const n = BigInt(value);
  const min = domain === 'int64' ? -9223372036854775808n : 0n;
  const max = domain === 'uint32' ? 4294967295n : domain === 'uint64' ? 18446744073709551615n : 9223372036854775807n;
  return n >= min && n <= max ? n : null;
}

export interface Phase { id: string; startNs: string; endNs: string; clockDomain: string }
export interface Descriptor { id: string; processIncarnation: string; clockId: string }
export interface Lifetime { id: string; processIncarnation: string; startNs: string; endNs: string }
export interface Pair extends Lifetime { kind: 'reporter' | 'aggregation'; descriptorId: string; clockId: string; lifetimeId: string }
interface Common { id: string; traceNamespace: string; descriptorId: string; processIncarnation: string; clockId: string; lifetimeId: string;
  source: { typed: true; location: string; fields: string[] } }
export interface Reporter extends Common { kind: 'reporter'; pairId: string; hostId: string; frameSource: string; frameSequence: string; surfaceTraceId: string;
  // Pinned source values: NO_UPDATE_DESIRED=0, PRESENTED_ALL=1, PRESENTED_PARTIAL=2, DROPPED=3.
  // This contract admits declared normalized names only; it is not a protobuf adapter.
  displayTraceId?: string; startNs: string; endNs: string; state: 'no_update_desired' | 'presented_all' | 'presented_partial' | 'dropped';
  // Pinned FORKED=0 / BACKFILL=1; an absent key remains ordinary optional absence.
  frameType?: 'forked' | 'backfill'; hasMissingContent?: boolean; checkerboardedNeedsRaster?: boolean; checkerboardedNeedsRecord?: boolean }
export interface Mapping extends Common { kind: 'mapping'; pageSession: string; rootFrame: string; hostId: string; ns: string }
export interface Transition extends Common { kind: 'transition'; rootFrame: string; ns: string; transition: 'commit' | 'delete' | 'reattach' | 'process' | 'source_loss' }
export interface Receive extends Common { kind: 'receive'; surfaceTraceId: string; frameSinkClient: string; frameSinkSink: string; ns: string; rejected?: boolean }
export interface Aggregation extends Common { kind: 'aggregation'; pairId: string; displayTraceId: string; surfaceTraceIds: string[]; startNs: string; endNs: string }
export interface DisplayEvent extends Common { kind: 'draw' | 'swap'; displayTraceId: string; ns: string }
export type SourceRecord = Reporter | Mapping | Transition | Receive | Aggregation | DisplayEvent;
export interface Repetition {
  id: string; traceNamespace: string; clockDomain: string; horizon: { startNs: string; endNs: string };
  target: { pageSession: string; rootFrame: string; processIncarnation: string; hostId: string; lifetimeId: string };
  phases: Phase[]; descriptors: Descriptor[]; clocks: { id: string; normalizedDomain: string; evidence: 'manual-synthetic-only' }[];
  lifetimes: Lifetime[]; pairs: Pair[]; records: SourceRecord[];
  lifecycleAuthority: { rootFrame: string; lifetimeId: string; clockDomain: string; startNs: string; endNs: string; noOmittedTransitions: true };
}
export interface Envelope { origin: string; chromiumPin: string; perfettoPin: string; normalizationContract: string; stateMapping: string; normalizationEvidence: string; repetitions: Repetition[] }
export interface Diagnostic { code: string; repetition?: string; record?: string; phase?: string }
export class Diagnostics {
  private retained: Diagnostic[] = [];
  private count = 0;
  add(value: Diagnostic): void { this.count++; if (this.retained.length < LIMITS.diagnostics) this.retained.push({ ...value }); }
  result(): { samples: Diagnostic[]; additionalIssueCount: number } {
    return { samples: this.retained.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), additionalIssueCount: this.count - this.retained.length };
  }
}
type ObjectValue = Record<string, unknown>;
type Rule = (value: unknown) => boolean;
const identity: Rule = v => typeof v === 'string' && v.length > 0 && v.length <= 128 && /^[\x21-\x7e]+$/.test(v);
const ns: Rule = v => decimal(v, 'ns') !== null;
const signed: Rule = v => decimal(v, 'int64') !== null;
const uint: Rule = v => decimal(v, 'uint64') !== null;
const host: Rule = v => uint(v) && v !== '0';
const u32: Rule = v => decimal(v, 'uint32') !== null;
const bool: Rule = v => typeof v === 'boolean';
const literal = (...allowed: unknown[]): Rule => v => allowed.includes(v);
const array = (rule: Rule, limit: number): Rule => v => Array.isArray(v) && v.length <= limit && v.every(rule);
function object(v: unknown): v is ObjectValue { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function shape(v: unknown, required: Record<string, Rule>, optional: Record<string, Rule> = {}): boolean {
  return object(v) && Object.keys(v).every(k => Object.hasOwn(required, k) || Object.hasOwn(optional, k))
    && Object.entries(required).every(([k, rule]) => Object.hasOwn(v, k) && rule(v[k]))
    && Object.entries(optional).every(([k, rule]) => !Object.hasOwn(v, k) || rule(v[k]));
}

/** Copy inert data without reading a property value through an accessor. Preflight work is bounded before decimal parsing. */
function inertCopy(input: unknown): unknown {
  let nodes = 0;
  const seen = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    if (++nodes > 180000 || depth > 12) throw new Error('preflight-capacity');
    if (typeof v === 'string') { if (v.length > 128) throw new Error('string-capacity'); return v; }
    if (v === null || typeof v === 'boolean' || typeof v === 'number' || v === undefined) return v;
    if (typeof v !== 'object' || seen.has(v)) throw new Error('non-inert-input');
    const arr = Array.isArray(v);
    if (Object.getPrototypeOf(v) !== (arr ? Array.prototype : Object.prototype) && Object.getPrototypeOf(v) !== null) throw new Error('nonplain-input');
    seen.add(v);
    // Inspect the native length data descriptor before enumerating array members.
    if (arr && Object.getOwnPropertyDescriptor(v, 'length')!.value > LIMITS.members) throw new Error('array-capacity-or-holes');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some(k => typeof k !== 'string')) throw new Error('symbol-input');
    if (arr && (descriptors.length?.value > LIMITS.members || keys.length !== descriptors.length?.value + 1)) throw new Error('array-capacity-or-holes');
    if (!arr && keys.length > 32) throw new Error('object-capacity');
    const out: unknown[] | ObjectValue = arr ? [] : Object.create(null);
    for (const k of keys as string[]) {
      if (arr && k === 'length') continue;
      if (k.length > 128 || !Object.hasOwn(descriptors[k]!, 'value') || !descriptors[k]!.enumerable) throw new Error('accessor-or-hidden-input');
      if (arr && !/^(0|[1-9][0-9]*)$/.test(k)) throw new Error('array-properties');
      Object.defineProperty(out, k, { value: copy(descriptors[k]!.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    seen.delete(v);
    return out;
  }
  return copy(input, 0);
}
const common = { id: identity, traceNamespace: identity, descriptorId: identity, processIncarnation: identity, clockId: identity, lifetimeId: identity,
  source: (v: unknown) => shape(v, { typed: literal(true), location: identity, fields: array(identity, 24) }) };
const pairShape = { id: identity, kind: literal('reporter', 'aggregation'), descriptorId: identity, processIncarnation: identity, clockId: identity, lifetimeId: identity, startNs: ns, endNs: ns };
const schemas: Record<SourceRecord['kind'], { required: Record<string, Rule>; optional?: Record<string, Rule> }> = {
  mapping: { required: { pageSession: identity, rootFrame: identity, hostId: host, ns } },
  transition: { required: { rootFrame: identity, ns, transition: literal('commit', 'delete', 'reattach', 'process', 'source_loss') } },
  reporter: { required: { pairId: identity, hostId: host, frameSource: uint, frameSequence: uint, surfaceTraceId: signed, startNs: ns, endNs: ns,
    state: literal('no_update_desired', 'presented_all', 'presented_partial', 'dropped') },
    optional: { displayTraceId: signed, frameType: literal('forked', 'backfill'), hasMissingContent: bool, checkerboardedNeedsRaster: bool, checkerboardedNeedsRecord: bool } },
  receive: { required: { surfaceTraceId: signed, frameSinkClient: u32, frameSinkSink: u32, ns }, optional: { rejected: bool } },
  aggregation: { required: { pairId: identity, displayTraceId: signed, surfaceTraceIds: array(signed, LIMITS.members), startNs: ns, endNs: ns } },
  draw: { required: { displayTraceId: signed, ns } }, swap: { required: { displayTraceId: signed, ns } },
};
function recordShape(v: unknown): boolean {
  if (!object(v) || typeof v.kind !== 'string' || !Object.hasOwn(schemas, v.kind)) return false;
  const schema = schemas[v.kind as SourceRecord['kind']];
  if (!shape(v, { ...common, kind: literal(v.kind), ...schema.required }, schema.optional)) return false;
  const fields = (v.source as { fields: string[] }).fields;
  const payload = Object.keys(v).filter(k => k !== 'kind' && !Object.hasOwn(common, k));
  if (fields.length !== new Set(fields).size || fields.length !== payload.length || !payload.every(k => fields.includes(k))) return false;
  return !(Object.hasOwn(v, 'hasMissingContent') && Object.hasOwn(v, 'checkerboardedNeedsRaster') && Object.hasOwn(v, 'checkerboardedNeedsRecord'))
    || v.hasMissingContent === (v.checkerboardedNeedsRaster || v.checkerboardedNeedsRecord);
}
const timeRange = { startNs: ns, endNs: ns };
function repetitionShape(v: unknown): boolean {
  return shape(v, {
    id: identity, traceNamespace: identity, clockDomain: identity, horizon: v => shape(v, timeRange),
    target: v => shape(v, { pageSession: identity, rootFrame: identity, processIncarnation: identity, hostId: host, lifetimeId: identity }),
    phases: array(v => shape(v, { id: identity, ...timeRange, clockDomain: identity }), LIMITS.phases),
    descriptors: array(v => shape(v, { id: identity, processIncarnation: identity, clockId: identity }), LIMITS.identities),
    clocks: array(v => shape(v, { id: identity, normalizedDomain: identity, evidence: literal('manual-synthetic-only') }), LIMITS.identities),
    lifetimes: array(v => shape(v, { id: identity, processIncarnation: identity, ...timeRange }), LIMITS.identities),
    pairs: array(v => shape(v, pairShape), LIMITS.identities), records: array(recordShape, LIMITS.records),
    lifecycleAuthority: v => shape(v, { rootFrame: identity, lifetimeId: identity, clockDomain: identity, ...timeRange, noOmittedTransitions: literal(true) }),
  });
}
function unique(values: readonly { id: string }[]): boolean { return new Set(values.map(v => v.id)).size === values.length; }
function cardinalityPreflight(value: unknown): boolean {
  if (!object(value) || !Array.isArray(value.repetitions) || value.repetitions.length > LIMITS.repetitions) return false;
  for (const r of value.repetitions) {
    if (!object(r)) return false;
    const groups = ['records', 'descriptors', 'clocks', 'lifetimes', 'pairs'] as const;
    let identities = 0;
    for (const key of groups) {
      if (!Array.isArray(r[key])) return false;
      identities += r[key].length;
    }
    if (identities > LIMITS.identities || !Array.isArray(r.phases) || r.phases.length > LIMITS.phases) return false;
    let members = 0;
    for (const record of r.records as unknown[]) {
      if (object(record) && record.kind === 'aggregation' && Array.isArray(record.surfaceTraceIds)) members += record.surfaceTraceIds.length;
      if (members > LIMITS.members) return false;
    }
  }
  return true;
}
function relationships(r: Repetition): boolean {
  const identities = r.records.length + r.descriptors.length + r.clocks.length + r.lifetimes.length + r.pairs.length;
  if (identities > LIMITS.identities || ![r.records, r.descriptors, r.clocks, r.lifetimes, r.pairs, r.phases].every(unique)) return false;
  if (!r.phases.length || !r.clocks.length || !r.lifetimes.length) return false;
  if (r.records.reduce((n, v) => n + (v.kind === 'aggregation' ? v.surfaceTraceIds.length : 0), 0) > LIMITS.members) return false;
  const lo = BigInt(r.horizon.startNs), hi = BigInt(r.horizon.endNs);
  const range = (v: { startNs: string; endNs: string }, positive = false) => BigInt(v.startNs) >= lo && BigInt(v.endNs) <= hi && (positive ? BigInt(v.startNs) < BigInt(v.endNs) : BigInt(v.startNs) <= BigInt(v.endNs));
  if (lo >= hi || !r.phases.every(p => range(p, true) && p.clockDomain === r.clockDomain) || !r.lifetimes.every(l => range(l)) || !r.pairs.every(p => range(p))) return false;
  const phases = r.phases.slice().sort((a, b) => BigInt(a.startNs) < BigInt(b.startNs) ? -1 : 1);
  if (phases.some((p, i) => i > 0 && BigInt(phases[i - 1]!.endNs) > BigInt(p.startNs))) return false;
  const descriptors = new Map(r.descriptors.map(d => [d.id, d]));
  const clocks = new Map(r.clocks.map(c => [c.id, c]));
  const lifetimes = new Map(r.lifetimes.map(l => [l.id, l]));
  const pairs = new Map(r.pairs.map(p => [p.id, p]));
  if (!r.clocks.every(c => c.normalizedDomain === r.clockDomain) || !r.descriptors.every(d => clocks.has(d.clockId))) return false;
  const authority = r.lifecycleAuthority;
  if (authority.rootFrame !== r.target.rootFrame || authority.lifetimeId !== r.target.lifetimeId || authority.clockDomain !== r.clockDomain || authority.startNs !== r.horizon.startNs || authority.endNs !== r.horizon.endNs) return false;
  const targetLifetime = lifetimes.get(r.target.lifetimeId);
  if (!targetLifetime || targetLifetime.processIncarnation !== r.target.processIncarnation || BigInt(targetLifetime.startNs) > lo || BigInt(targetLifetime.endNs) < hi) return false;
  function refs(v: { descriptorId: string; processIncarnation: string; clockId: string; lifetimeId: string }): boolean {
    const d = descriptors.get(v.descriptorId);
    return !!d && d.processIncarnation === v.processIncarnation && d.clockId === v.clockId && clocks.has(v.clockId) && lifetimes.has(v.lifetimeId);
  }
  if (!r.pairs.every(refs)) return false;
  const usedPairs = new Set<string>();
  for (const v of r.records) {
    if (!refs(v) || v.traceNamespace !== r.traceNamespace) return false;
    const l = lifetimes.get(v.lifetimeId)!;
    const times = 'ns' in v ? [v.ns] : [v.startNs, v.endNs];
    if (times.some(t => BigInt(t) < lo || BigInt(t) > hi || BigInt(t) < BigInt(l.startNs) || BigInt(t) > BigInt(l.endNs))) return false;
    if ((v.kind === 'reporter' || v.kind === 'mapping' || v.kind === 'transition') && l.processIncarnation !== v.processIncarnation) return false;
    if ('pairId' in v) {
      const p = pairs.get(v.pairId);
      if (!p || usedPairs.has(p.id) || p.kind !== v.kind || p.startNs !== v.startNs || p.endNs !== v.endNs || p.descriptorId !== v.descriptorId || p.processIncarnation !== v.processIncarnation || p.clockId !== v.clockId || p.lifetimeId !== v.lifetimeId) return false;
      usedPairs.add(p.id);
    }
  }
  return usedPairs.size === pairs.size;
}
export function admitSourceRecords(input: unknown, policy: unknown): { status: 'admitted'; envelope: Envelope } | { status: 'unavailable'; diagnostics: ReturnType<Diagnostics['result']> } {
  const diagnostics = new Diagnostics();
  try {
    if (policy !== POLICY) throw new Error('unsupported-policy');
    const value = inertCopy(input);
    if (!cardinalityPreflight(value)) throw new Error('cardinality-capacity');
    if (!shape(value, { origin: literal('manual-synthetic-source-records-v1'), chromiumPin: literal(CHROMIUM_PIN), perfettoPin: literal(PERFETTO_PIN),
      normalizationContract: literal('normalized-source-v1'), stateMapping: literal('chrome-frame-reporter2-v1'), normalizationEvidence: literal('manual-synthetic-only'),
      repetitions: array(repetitionShape, LIMITS.repetitions) })) throw new Error('invalid-envelope');
    const envelope = value as unknown as Envelope;
    if (!envelope.repetitions.length || !unique(envelope.repetitions) || !envelope.repetitions.every(relationships)) throw new Error('declaration-disagreement');
    return { status: 'admitted', envelope };
  } catch (error) {
    diagnostics.add({ code: error instanceof Error ? error.message : 'invalid-envelope' });
    return { status: 'unavailable', diagnostics: diagnostics.result() };
  }
}
