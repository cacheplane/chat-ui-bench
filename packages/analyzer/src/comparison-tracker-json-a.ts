import {createHash} from 'node:crypto';
import {copyBody, WireError} from './browser-frame-protobuf-wire.js';
import {StreamedTraceAdmission, TRACKER_JSON_A_POLICY, isStreamedTraceFailure, type TrackerJsonRecord, type TrackerNumberToken} from './comparison-trace-stream.js';

type Segment = {status: 'complete' | 'open' | 'ambiguous' | 'unsupported'; beginEventIndex: number | null; endEventIndex: number | null; reason: string | null};
type Endpoint = {record: TrackerJsonRecord; ts: TrackerNumberToken; time: bigint; pid: bigint; tid: bigint; identity: string};
type RawTuple = {expected: TrackerNumberToken; dropped_v3: TrackerNumberToken; dropped_v4: TrackerNumberToken; beginEventIndex: number; endEventIndex: number;
  window: {start: TrackerNumberToken; end: TrackerNumberToken; unit: 'microseconds'; windowMeaning: 'exported-tracker-window'; externalPhaseAlignment: 'unestablished'}};
const qualification = () => ({source: false, capture: false, coverage: false, target: false, clock: false, runtime: false, evaluation: false, scoring: false, ranking: false, externalOriginalProvenance: 'unestablished' as const});
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string) => Object.hasOwn(value, key);
const nestedFrame = (name: unknown) => name === 'Frame' || name === 'Frame ' || name === 'Frame   ';
function integer(token: TrackerNumberToken | undefined, bits: 32 | 64): bigint | null {
  if (!token || !/^-?(?:0|[1-9][0-9]*)$/.test(token.lexeme)) return null;
  const value = BigInt(token.lexeme), extent = 1n << BigInt(bits - 1);
  return value < -extent || value >= extent ? null : value;
}

/** Pure supplied-wrapper projection. EOF establishes syntax, never capture provenance or physical closure.
 * A valid caller-crafted selected-only wrapper cannot be distinguished here; external original-byte
 * authentication is mandatory before any later runtime use. Fixtures for this profile are prospective.
 */
export function projectTrackerJsonACapability(input: unknown, policy: unknown) {
  const scanner = new StreamedTraceAdmission(TRACKER_JSON_A_POLICY);
  let inputReference: {byteLength: number; sha256: string; meaning: 'supplied-wrapper-bytes'} | null = null;
  try {
    if (policy !== TRACKER_JSON_A_POLICY) throw new Error('unsupported-profile');
    const bytes = copyBody(input);
    inputReference = {byteLength: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'), meaning: 'supplied-wrapper-bytes'};
    scanner.feed(bytes); scanner.finish();
    const visit = () => scanner.chargeTrackerProjectionVisit();
    const records: TrackerJsonRecord[] = [];
    for (const record of scanner.trackerRecords()) {visit(); records.push(record);}
    const segments: Segment[] = [];
    const stacks = new Map<string, {pid: bigint; tid: bigint; lastTime: bigint; reuseAmbiguous: boolean; stack: Endpoint[]}>();
    const candidates: RawTuple[] = []; let ambiguous = false; let wheelPairs = 0;
    const token = (record: TrackerJsonRecord, slot: TrackerNumberToken['slot']) => {
      for (const value of record.numberTokens) {visit(); if (value.slot === slot) return value;}
      return undefined;
    };
    const unsupported = (record: TrackerJsonRecord, reason: string) => {
      visit(); ambiguous = true;
      segments.push({status: 'unsupported', beginEventIndex: record.event.ph === 'b' ? record.eventIndex : null, endEventIndex: record.event.ph === 'b' ? null : record.eventIndex, reason});
    };
    const endpoint = (record: TrackerJsonRecord): Endpoint | null => {
      const event = record.event, ts = token(record, 'ts'), time = integer(ts, 64), pid = integer(token(record, 'pid'), 32), tid = integer(token(record, 'tid'), 32);
      if (!ts || time === null || pid === null || tid === null) return null;
      const scope = own(event, 'scope') ? event.scope : undefined;
      if (scope !== undefined && (typeof scope !== 'string' || Buffer.byteLength(scope) > 4096) || own(event, 'scope') && scope === undefined) return null;
      let kind: 'local' | 'global', id: unknown;
      if (own(event, 'id') && !own(event, 'id2')) {kind = 'global'; id = event.id;}
      else if (!own(event, 'id') && object(event.id2) && Object.keys(event.id2).length === 1 && own(event.id2, 'local')) {kind = 'local'; id = event.id2.local;}
      else return null;
      if (typeof id !== 'string' || id.length === 0 || Buffer.byteLength(id) > 256) return null;
      // JSON encodes the finite identity components without delimiter collisions. Absent scope differs from empty.
      const identity = JSON.stringify([kind, id, own(event, 'scope'), scope ?? null, kind === 'local' ? pid.toString() : null]);
      return {record, ts, time, pid, tid, identity};
    };
    for (const record of records) {
      visit(); const event = record.event;
      if (!(typeof event.name === 'string' && event.name.startsWith('FrameSequenceTracker')) && !nestedFrame(event.name)) continue;
      if (event.name !== 'FrameSequenceTrackerV3' && !nestedFrame(event.name) || event.ph !== 'b' && event.ph !== 'e'
        || event.cat !== 'cc,benchmark' && event.cat !== 'benchmark,cc') {unsupported(record, 'unsupported-family-phase-or-category'); continue;}
      const point = endpoint(record);
      if (!point) {unsupported(record, 'unsupported-exported-identity-or-integer'); continue;}
      let state = stacks.get(point.identity);
      if (!state) {state = {pid: point.pid, tid: point.tid, lastTime: point.time - 1n, reuseAmbiguous: false, stack: []}; stacks.set(point.identity, state);}
      if (state.pid !== point.pid || state.tid !== point.tid || point.time <= state.lastTime) {unsupported(record, 'identity-collision-or-nonincreasing-time'); continue;}
      state.lastTime = point.time;
      if (event.ph === 'b') {
        // Only exact Frame variants may nest within an occupied exported identity. A second
        // tracker BEGIN makes that identity ambiguous even when its type is not WheelScroll.
        if (state.stack.length && !nestedFrame(event.name)) {
          visit(); ambiguous = true; state.reuseAmbiguous = true;
          segments.push({status: 'ambiguous', beginEventIndex: record.eventIndex, endEventIndex: null, reason: 'concurrent-tracker-identity-reuse'});
        }
        visit(); state.stack.push(point); continue;
      }
      const start = state.stack.at(-1);
      if (!start) {unsupported(record, 'orphan-end'); continue;}
      visit();
      if (start.record.event.name !== event.name || start.record.event.cat !== event.cat) {
        ambiguous = true; segments.push({status: 'ambiguous', beginEventIndex: start.record.eventIndex, endEventIndex: record.eventIndex, reason: 'endpoint-mismatch'}); continue;
      }
      state.stack.pop();
      if (state.reuseAmbiguous) {
        ambiguous = true; segments.push({status: 'ambiguous', beginEventIndex: start.record.eventIndex, endEventIndex: record.eventIndex, reason: 'concurrent-tracker-identity-reuse'}); continue;
      }
      if (!object(event.args) || Object.keys(event.args).length !== 0 || !object(start.record.event.args)) {
        ambiguous = true; segments.push({status: 'unsupported', beginEventIndex: start.record.eventIndex, endEventIndex: record.eventIndex, reason: 'unsupported-generated-arguments'}); continue;
      }
      segments.push({status: 'complete', beginEventIndex: start.record.eventIndex, endEventIndex: record.eventIndex, reason: null});
      if (event.name !== 'FrameSequenceTrackerV3') continue;
      if (typeof start.record.event.args.name !== 'string' || !start.record.event.args.name) {ambiguous = true; continue;}
      if (start.record.event.args.name !== 'WheelScroll') continue;
      wheelPairs++;
      const expected = token(start.record, 'expected'), dropped_v3 = token(start.record, 'dropped_v3'), dropped_v4 = token(start.record, 'dropped_v4');
      const e = integer(expected, 32), d3 = integer(dropped_v3, 32), d4 = integer(dropped_v4, 32);
      if (!expected || !dropped_v3 || !dropped_v4 || e === null || d3 === null || d4 === null || e <= 0n || d3 < 0n || d4 < 0n || d3 > e) continue;
      candidates.push({expected, dropped_v3, dropped_v4, beginEventIndex: start.record.eventIndex, endEventIndex: record.eventIndex,
        window: {start: start.ts, end: point.ts, unit: 'microseconds', windowMeaning: 'exported-tracker-window', externalPhaseAlignment: 'unestablished'}});
    }
    for (const state of stacks.values()) for (const point of state.stack) {
      visit(); ambiguous = true; segments.push({status: 'open', beginEventIndex: point.record.eventIndex, endEventIndex: null, reason: 'unclosed-exported-begin'});
    }
    const rawTuple = !ambiguous && wheelPairs === 1 && candidates.length === 1 ? candidates[0]! : null;
    const result = {status: 'available' as const, policy: TRACKER_JSON_A_POLICY, inputReference, rawJson: new TextDecoder('utf8', {fatal: true, ignoreBOM: true}).decode(bytes),
      records, segments, associationStatus: ambiguous ? 'unavailable' as const : 'complete' as const, rawTupleStatus: rawTuple ? 'available' as const : 'unavailable' as const, rawTuple,
      qualification: qualification(), statistics: scanner.statistics()};
    // Fixed result-schema ledger, including every repeated raw/event/token representation. The input
    // cap is not a heap cap or output-fit promise. Unknown JSON event fields are counted without pruning.
    let nodes = 0, stringBytes = 0, jsonBytes = 0;
    const addBytes = (count: number) => {jsonBytes += count; if (jsonBytes > 4 * 1024 * 1024) throw new Error('output-json-capacity');};
    const string = (value: string) => {
      stringBytes += Buffer.byteLength(value); if (stringBytes > 524288) throw new Error('output-string-capacity');
      addBytes(Buffer.byteLength(JSON.stringify(value)));
    };
    const account = (value: unknown): void => {
      visit(); if (++nodes > 262144) throw new Error('output-node-capacity');
      if (typeof value === 'string') string(value);
      else if (Array.isArray(value)) {addBytes(2 + Math.max(0, value.length - 1)); for (const child of value) account(child);}
      else if (object(value)) {
        const entries = Object.entries(value); addBytes(2 + Math.max(0, entries.length - 1));
        for (const [key, child] of entries) {visit(); if (++nodes > 262144) throw new Error('output-node-capacity'); string(key); addBytes(1); account(child);}
      } else addBytes(value === null ? 4 : typeof value === 'boolean' ? value ? 4 : 5 : String(value).length);
    };
    const priorWork = result.statistics.observedPrefix!.retainedWork;
    account(result); visit();
    // Only this numeric value changes when taking the final statistics snapshot. Account its
    // serialized digit delta as well; no repeated raw/event representation is omitted to fit.
    result.statistics = scanner.statistics();
    addBytes(String(result.statistics.observedPrefix!.retainedWork).length - String(priorWork).length);
    return result;
  } catch (error) {
    const failure = isStreamedTraceFailure(error) ? error.failure.limitName ?? 'malformed-json'
      : error instanceof WireError ? error.code
      : error instanceof Error && ['unsupported-profile', 'output-json-capacity', 'output-string-capacity', 'output-node-capacity'].includes(error.message) ? error.message : 'projection-unavailable';
    return {status: 'unavailable' as const, policy: TRACKER_JSON_A_POLICY, inputReference, failure, statistics: scanner.statistics(), qualification: qualification()};
  } finally {scanner.dispose();}
}
