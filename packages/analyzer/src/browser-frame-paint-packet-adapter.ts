import { createHash } from 'node:crypto';
import {
  BodyReader, copyBody, newWholeWireBudget, wholeByteInputDenied, WireError,
  type Occurrence,
} from './browser-frame-protobuf-wire.js';
import {
  canonicalInt32, createWholeFramePresentedPacketDecoder, requireBody, scalar,
  uint32, unique, type PacketFields, type PacketOccurrence,
} from './browser-frame-packet-fragments.js';
import {
  decodePaintTimingRBody, PAINT_TIMING_R_BODY_POLICY,
} from './browser-frame-paint-timing-r-fragments.js';

export const PAINT_PACKET_ADAPTER_POLICY = 'private-paint-packet-adapter-v1';
type Stage = 'input' | 'route' | 'old' | 'paint-shell' | 'paint-body' | 'extract';
export interface AdapterUnavailable {
  readonly status: 'unavailable';
  readonly code: string;
  readonly stage: Stage;
  readonly diagnostics: readonly Readonly<{ code: string; stage: Stage }>[];
}
function unavailable(code: string, stage: Stage): AdapterUnavailable {
  return Object.freeze({
    status: 'unavailable', code, stage,
    diagnostics: Object.freeze([Object.freeze({ code, stage })]),
  });
}
export interface PacketOperationReservation {
  wireByteReads: number; fieldChargeWork: number; memberChargeWork: number;
  callbackLocalWork: number; loopRecordWork: number; copyBytes: number;
  byteBufferOccupancy: number; hashBytes: number; utf8DecodeBytes: number;
  utf16Occupancy: number; terminalChecks: number; diagnosticRecords: number;
  packetResultRecords: number;
}
/** Pure source-derived worst work, separate from successful semantic usage. */
export function packetAdapterReservation(n: unknown): Readonly<PacketOperationReservation> | AdapterUnavailable {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > 262144)
    return unavailable('adapter-invalid-byte-length', 'input');
  const r = Math.min(8193, n + 1);
  const o = Math.min(24577, 2 * n + 1);
  const m = Math.min(12289, 2 * n + 1);
  const s = Math.min(8180, n + 1);
  const f = r + Math.max(o, s + 26);
  const b = Math.max(m, 10);
  const c = Math.max(Math.min(8193, 2 * n + 1), 2);
  const u = Math.min(32768, n);
  return Object.freeze({
    wireByteReads: 3 * n, fieldChargeWork: f, memberChargeWork: b,
    callbackLocalWork: c, loopRecordWork: 256 + 64 * (f + b + c),
    copyBytes: 4 * n, byteBufferOccupancy: 4 * n, hashBytes: 4 * n,
    utf8DecodeBytes: u, utf16Occupancy: 512 + 20 * (f + b) + u,
    terminalChecks: 4, diagnosticRecords: 1, packetResultRecords: 1,
  });
}
// Exact ordered 86-entry DATA roster from browser-frame-packet-fragments.ts.
const DATA = new Set([11,60,117,118,120,122,129,2,90,9,4,5,6,7,89,33,34,35,37,74,75,38,40,39,45,46,109,47,48,49,51,52,53,54,131,57,62,63,65,66,67,68,69,134,135,70,71,73,77,78,82,83,84,86,91,124,125,126,127,128,130,61,64,43,44,1,36,50,133,72,95,99,100,101,102,103,107,110,111,113,115,119,123,132,138,900]);
const OPAQUE = new Set([6,12,35,59,60]);
const SELECTED = new Set([8,58,10,13,42,98,79,41,87,11,...OPAQUE]);
const UNSUPPORTED = new Set([50,133,107,125]);
const LABELS = Object.freeze({
  normalizationCapability: 'shell-selected-validation-only',
  sequenceValidity: 'not_evaluated', internResolution: 'not_evaluated',
  clockAdmission: 'not_evaluated', targetBinding: 'not_evaluated',
  nativeSupported: false, qualification: false, evaluation: false,
  scoring: false, ranking: false, fpsEligibility: false,
  evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false,
} as const);
type OldPacket = Exclude<ReturnType<ReturnType<typeof createWholeFramePresentedPacketDecoder>>, { status: 'unavailable' }>;
type Paint = Exclude<ReturnType<typeof decodePaintTimingRBody>, { status: 'unavailable' }>;
/** Primitive and span snapshot consumed synchronously by the future ordered owner. */
export type PaintProjection = Pick<Paint,
  'bodySHA256' | 'nameIid' | 'trackUuid' | 'frame' | 'structuralVariant' |
  'categoryIids' | 'annotations' | 'occurrences' | 'directOccurrences' |
  'legacy' | 'skippedOpaqueLocations' | 'usage'>;
export interface RawPacketWindow extends PacketOccurrence {
  childValidity: 'not_evaluated';
  bytes: Uint8Array;
}
interface Common extends Readonly<typeof LABELS> {
  status: 'decoded_owned_packet'; policy: typeof PAINT_PACKET_ADAPTER_POLICY;
  bodyBytes: Uint8Array; packetSHA256: string; fields: PacketFields;
  occurrences: PacketOccurrence[]; skippedFields: PacketOccurrence[];
  opaquePayloads: PacketOccurrence[]; presentFieldNumbers: number[];
  rawWindows: RawPacketWindow[];
  usage: { fields: number; members: number; routeFields: number; oldCallbackWork: number };
}
export type OwnedPacketResult = Common & (
  { branch: 'old'; packet: OldPacket } |
  { branch: 'paint'; paint: Paint; paintProjection: PaintProjection; paintPacketOccurrences: PacketOccurrence[] }
);
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function rawWindows(bytes: Uint8Array, opaque: PacketOccurrence[]): RawPacketWindow[] {
  return opaque.filter(o => [59,12,6,60].includes(o.fieldNumber)).map(o => ({
    ...o, childValidity: 'not_evaluated', bytes: bytes.subarray(o.valueStart, o.end),
  }));
}
function shifted(o: Occurrence, event: Occurrence, length: number): PacketOccurrence {
  if (!Number.isSafeInteger(o.start) || !Number.isSafeInteger(o.valueStart) ||
      !Number.isSafeInteger(o.end) || o.start < 0 || o.start > o.valueStart ||
      o.valueStart > o.end || o.end > event.end - event.valueStart)
    throw new WireError('adapter-invalid-paint-span');
  const start = event.valueStart + o.start;
  const valueStart = event.valueStart + o.valueStart;
  const end = event.valueStart + o.end;
  if (!Number.isSafeInteger(end) || end > length)
    throw new WireError('adapter-invalid-paint-span');
  return { scope: 'track_event', fieldNumber: o.fieldNumber, wireType: o.wireType, start, valueStart, end };
}
/** No caller configuration, callback, budget, or externally supplied fragment seam. */
export function createPaintPacketAdapter() {
  const oldDecode = createWholeFramePresentedPacketDecoder();
  let failure: AdapterUnavailable | undefined;
  return Object.freeze({
    decode(input: unknown): OwnedPacketResult | AdapterUnavailable {
      if (failure) return failure;
      let stage: Stage = 'input';
      try {
        if (wholeByteInputDenied(input)) throw new WireError('unsupported-byte-view');
        const bytes = copyBody(input);
        stage = 'route';
        const routeBudget = newWholeWireBudget();
        const route = new BodyReader(bytes, 0, bytes.length, routeBudget);
        let event: Occurrence | undefined;
        let routeFields = 0;
        while (!route.complete) {
          const f = route.next('root');
          routeFields++;
          if (f.occurrence.fieldNumber === 11) {
            if (event) throw new WireError('adapter-route-duplicate-event');
            requireBody(f);
            event = f.occurrence;
          }
        }
        let legacy = 0;
        let annotations = 0;
        if (event) {
          const direct = new BodyReader(bytes, event.valueStart, event.end, routeBudget);
          while (!direct.complete) {
            const f = direct.next('root');
            routeFields++;
            if (f.occurrence.fieldNumber === 6) legacy++;
            if (f.occurrence.fieldNumber === 4) annotations++;
          }
        }
        if (!(legacy > 0 && annotations >= 2)) {
          stage = 'old';
          let callbackWork = 0;
          const cap = Math.max(Math.min(8193, 2 * bytes.length + 1), 2);
          const packet = oldDecode(bytes, units => {
            if (!Number.isSafeInteger(units) || units < 0 || units > cap - callbackWork)
              throw new WireError('adapter-callback-capacity');
            callbackWork += units;
          });
          if (packet.status === 'unavailable') throw new WireError(packet.diagnostics[0]!.code);
          const e = packet.event;
          // Provenance callback work alone represents fields absent from occurrences.
          const provenance = packet.occurrences.some(o => o.scope === 'packet' && o.fieldNumber === 124);
          return {
            ...LABELS, status: 'decoded_owned_packet', policy: PAINT_PACKET_ADAPTER_POLICY,
            branch: 'old', packet, bodyBytes: bytes, packetSHA256: hash(bytes),
            fields: packet.fields, occurrences: packet.occurrences,
            skippedFields: packet.skippedFields, opaquePayloads: packet.opaquePayloads,
            presentFieldNumbers: packet.presentFieldNumbers,
            rawWindows: rawWindows(bytes, packet.opaquePayloads),
            usage: { fields: packet.occurrences.length + (provenance ? callbackWork : 0),
              members: (e?.fields.categoryIids?.length ?? 0) + (e?.fields.categories?.length ?? 0) +
                (e?.annotations.length ?? 0) + (e?.graphics?.fields.surfaceTraceIds?.length ?? 0),
              routeFields, oldCallbackWork: callbackWork },
          };
        }
        stage = 'paint-shell';
        const budget = newWholeWireBudget();
        for (let i = 0; i < 13; i++) budget.chargeOccurrence();
        for (let i = 0; i < 5; i++) budget.chargeMember();
        const shell = new BodyReader(bytes, 0, bytes.length, budget);
        const fields: PacketFields = {};
        const occurrences: PacketOccurrence[] = [];
        const skippedFields: PacketOccurrence[] = [];
        const opaquePayloads: PacketOccurrence[] = [];
        const present = new Set<number>();
        let dataSeen = false;
        while (!shell.complete) {
          const f = shell.next('root');
          const o: PacketOccurrence = { ...f.occurrence, scope: 'packet' };
          occurrences.push(o);
          if (DATA.has(o.fieldNumber)) {
            if (dataSeen) throw new WireError('duplicate-data-oneof');
            dataSeen = true;
            requireBody(f);
          }
          if (UNSUPPORTED.has(o.fieldNumber))
            throw new WireError(`unsupported-packet-payload-field-${o.fieldNumber}`);
          if (!SELECTED.has(o.fieldNumber)) { skippedFields.push({ ...o }); continue; }
          unique(present, o.fieldNumber);
          if (OPAQUE.has(o.fieldNumber)) { requireBody(f); opaquePayloads.push({ ...o }); continue; }
          switch (o.fieldNumber) {
            case 8: fields.timestamp = scalar(f).toString(); break;
            case 58: fields.timestampClockId = uint32(f); break;
            case 10: fields.sequenceId = uint32(f); break;
            case 13: fields.sequenceFlags = uint32(f); break;
            case 42: fields.previousPacketDropped = uint32(f); break;
            case 98: fields.machineId = uint32(f); break;
            case 79: fields.trustedPid = canonicalInt32(f); break;
            case 41: case 87: {
              const value = scalar(f);
              if (value !== 0n && value !== 1n) throw new WireError('non-profile-bool');
              fields[o.fieldNumber === 41 ? 'incrementalStateCleared' : 'firstPacketOnSequence'] = value === 1n;
              break;
            }
            case 11: requireBody(f); break;
          }
        }
        stage = 'paint-body';
        const paint = decodePaintTimingRBody(bytes.subarray(event!.valueStart, event!.end), PAINT_TIMING_R_BODY_POLICY);
        if (paint.status === 'unavailable') throw new WireError(paint.code);
        stage = 'extract';
        const paintPacketOccurrences = paint.occurrences.map(o => shifted(o, event!, bytes.length));
        // Preserve the minted helper for its private comparator, while extracting
        // the bounded primitive/span arrays before any caller can run.
        const paintProjection: PaintProjection = {
          bodySHA256: paint.bodySHA256, nameIid: paint.nameIid,
          trackUuid: paint.trackUuid, frame: paint.frame,
          structuralVariant: paint.structuralVariant,
          categoryIids: [...paint.categoryIids],
          annotations: paint.annotations.map(a => ({
            ...a, occurrences: a.occurrences.map(o => ({ ...o })),
          })),
          occurrences: paint.occurrences.map(o => ({ ...o })),
          directOccurrences: paint.directOccurrences.map(o => ({ ...o })),
          legacy: { ...paint.legacy, phaseOccurrence: { ...paint.legacy.phaseOccurrence } },
          skippedOpaqueLocations: paint.skippedOpaqueLocations.map(o => ({ ...o })),
          usage: { ...paint.usage },
        };
        return {
          ...LABELS, status: 'decoded_owned_packet', policy: PAINT_PACKET_ADAPTER_POLICY,
          branch: 'paint', paint, paintProjection, paintPacketOccurrences, bodyBytes: bytes,
          packetSHA256: hash(bytes), fields, occurrences, skippedFields, opaquePayloads,
          presentFieldNumbers: [...present].sort((a,b) => a-b),
          rawWindows: rawWindows(bytes, opaquePayloads),
          usage: { fields: occurrences.length + paint.usage.fields, members: paint.usage.members,
            routeFields, oldCallbackWork: 0 },
        };
      } catch (error) {
        failure = unavailable(error instanceof WireError ? error.code : 'adapter-invalid-input', stage);
        return failure;
      }
    },
  });
}
