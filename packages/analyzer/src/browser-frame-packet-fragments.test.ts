import { expect, test } from 'vitest';
import { decodeBrowserFramePacket, PACKET_POLICY } from './browser-frame-packet-fragments.js';
import * as packetDecoders from './browser-frame-packet-fragments.js';
import { body, int32, join, tag, text, uint, vi } from './browser-frame-packet-fragments.test-helper.js';

test('empty standalone body retains absence and denies semantic eligibility', () => {
  const result = decodeBrowserFramePacket(new Uint8Array(), PACKET_POLICY);
  expect(result).toMatchObject({ status: 'decoded_packet_fragment', fields: {}, consumedBytes: 0,
    runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false });
});

function decoded(bytes: Uint8Array): any {
  const result = decodeBrowserFramePacket(bytes, PACKET_POLICY) as any;
  expect(result.status).toBe('decoded_packet_fragment');
  return result;
}
function denied(bytes: unknown, code: string, policy: unknown = PACKET_POLICY): void {
  expect(decodeBrowserFramePacket(bytes, policy)).toEqual({ status: 'unavailable', diagnostics: [{ code }] });
}
test('policy and ordinary owned byte-view boundary', () => {
  denied(new Uint8Array(), 'unsupported-policy', 'other');
  for (const value of [null, [], new Uint16Array(), Buffer.from([]), new (class extends Uint8Array {})()]) denied(value, 'unsupported-byte-view');
  denied(new Uint8Array(new SharedArrayBuffer(2)), 'unavailable-byte-storage');
  const detached = new Uint8Array(2); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  denied(detached, 'unavailable-byte-storage');
  denied(new Uint8Array(262145), 'byte-capacity');
});
test('native copying never calls view properties or iteration', () => {
  const input = uint(8, 9007199254740993n);
  for (const key of ['length', 'byteLength', 'buffer', 'slice', Symbol.iterator]) Object.defineProperty(input, key, { get() { throw new Error('caller accessor'); } });
  expect(decoded(input).fields.timestamp).toBe('9007199254740993');
});
test.each([8, 10, 13, 41, 42, 58, 79, 87, 98])('duplicate selected scalar %i denied', field => denied(join(uint(field, 0n), uint(field, 0n)), 'duplicate-selected-field'));
test.each([10, 13, 42, 58, 98])('uint32 field %i rejects overflow', field => denied(uint(field, 4294967296n), 'uint32-overflow'));
test.each([41, 87])('bool field %i rejects nonprofile value', field => denied(uint(field, 2n), 'non-profile-bool'));
test.each([8, 10, 13, 41, 42, 58, 79, 87, 98])('selected scalar %i rejects length wire', field => denied(body(field, new Uint8Array()), 'selected-field-wrong-wire-type'));
test.each([-2147483648n, -1n, 0n, 2147483647n])('canonical int32 %s retained exactly', value => expect(decoded(int32(79, value)).fields.trustedPid).toBe(value.toString()));
test.each([2147483648n, 4294967295n, 18446744071562067967n])('nonprofile int32 %s denied', value => denied(uint(79, value), 'int32-overflow'));
test('unknown flags and numeric loss mask are not boolean interpretations', () => {
  expect(decoded(join(uint(13, 4294967295n), uint(42, 257n), uint(98, 17n))).fields).toEqual({ sequenceFlags: '4294967295', previousPacketDropped: '257', machineId: '17' });
});
test.each([6, 12, 35, 59, 60])('opaque selected state body %i retains span only', field => {
  const result = decoded(body(field, Uint8Array.of(255)));
  expect(result.opaquePayloads).toEqual([{ fieldNumber: field, scope: 'packet', start: 0, valueStart: result.bodyBytes.length - 1, end: result.bodyBytes.length, wireType: 2 }]);
  expect(result.fields).toEqual({});
});
test.each([6, 12, 35, 59, 60])('duplicate opaque selected %i denied', field => denied(join(body(field, new Uint8Array()), body(field, new Uint8Array())), [6,35,60].includes(field) ? 'duplicate-data-oneof' : 'duplicate-selected-field'));
// Independently pinned TracePacket.data declarations; not imported from decoder constants.
const DATA_MEMBERS = [11,60,117,118,120,122,129,2,90,9,4,5,6,7,89,33,34,35,37,74,75,38,40,39,45,46,109,47,48,49,51,52,53,54,131,57,62,63,65,66,67,68,69,134,135,70,71,73,77,78,82,83,84,86,91,124,125,126,127,128,130,61,64,43,44,1,36,50,133,72,95,99,100,101,102,103,107,110,111,113,115,119,123,132,138,900];
test.each(DATA_MEMBERS.filter(n => ![50,133,107,124,125].includes(n)))('pinned data member %i participates in oneof guard', field => denied(join(body(field, new Uint8Array()), body(11, new Uint8Array())), 'duplicate-data-oneof'));
test.each([50,133,107,124,125])('unsupported packet payload %i denied', field => denied(body(field, new Uint8Array()), 'unsupported-packet-payload'));
const wholeTimingV3=(bytes:Uint8Array)=>{
  const decode=(packetDecoders as unknown as Record<string,any>).decodeWholeUserTimingPacketV3;
  expect(decode).toBeTypeOf('function');return decode(bytes,()=>{});
};
test.each([50,133,107,124,125])('V3 alone names refused payload field %i without changing admission or precedence',field=>{
  for(const input of [body(field,new Uint8Array()),uint(field,0n),join(body(6,new Uint8Array()),body(field,new Uint8Array()))]){
    expect(wholeTimingV3(input)).toEqual({status:'unavailable',diagnostics:[{code:'unsupported-packet-payload-field-'+field}]});
    expect(packetDecoders.decodeWholeAnnotationPacket(input,()=>{})).toEqual({status:'unavailable',diagnostics:[{code:'unsupported-packet-payload'}]});
    denied(input,'unsupported-packet-payload');
  }
  const truncated=join(tag(field,2),vi(2n),Uint8Array.of(0));
  expect(wholeTimingV3(truncated)).toEqual(packetDecoders.decodeWholeAnnotationPacket(truncated,()=>{}));
  denied(truncated,'out-of-bounds-length');
});
test('V3 packet entry preserves every other successful or failed projection',()=>{
  for(const input of [new Uint8Array(),uint(8,5n),body(19000,Uint8Array.of(255)),join(body(6,new Uint8Array()),body(11,new Uint8Array())),join(uint(8,1n),uint(8,2n))]){
    expect(wholeTimingV3(input)).toEqual(packetDecoders.decodeWholeAnnotationPacket(input,()=>{}));
  }
});
test('opaque unknown fields preserve source order and all supported wire types', () => {
  const input = join(uint(19000, 7n), join(tag(20001, 1), new Uint8Array(8)), body(20002, Uint8Array.of(255)), join(tag(20003, 5), new Uint8Array(4)));
  const result = decoded(input);
  expect(result.skippedFields.map((x: any) => [x.fieldNumber, x.wireType])).toEqual([[19000,0],[20001,1],[20002,2],[20003,5]]);
  expect(result.occurrences).toEqual(result.skippedFields);
  expect(result.consumedBytes).toBe(input.length);
});
test.each([[Uint8Array.of(0), 'invalid-field-number'], [Uint8Array.of(11), 'unsupported-wire-type'], [Uint8Array.of(128), 'truncated-varint'], [join(tag(20001,1), new Uint8Array(7)), 'truncated-fixed-field'], [join(tag(20001,2), vi(3n), new Uint8Array(2)), 'out-of-bounds-length']])('malformed tail denies all earlier fields %#', (tail, code) => denied(join(uint(8, 5n), tail as Uint8Array), code as string));
test('known data wrong wire rejects, future extensions stay opaque', () => {
  denied(uint(11, 0n), 'selected-field-wrong-wire-type');
  expect(decoded(join(body(1000, new Uint8Array()), body(1001, new Uint8Array()))).skippedFields).toHaveLength(2);
});

const eventPacket = (...parts: Uint8Array[]): Uint8Array => body(11, join(...parts));
test('modern empty event preserves its own absence inventory', () => expect(decoded(eventPacket()).event).toMatchObject({ fields: {}, presentFieldNumbers: [] }));
test('packed and unpacked category IIDs preserve order, duplicates and empty packed presence', () => {
  const result = decoded(eventPacket(uint(3, 0n), body(3, join(vi(9n), vi(9n))), body(3, new Uint8Array()), uint(3, 18446744073709551615n)));
  expect(result.event.fields.categoryIids).toEqual(['0','9','9','18446744073709551615']);
  expect(result.event.presentFieldNumbers).toEqual([3]);
  expect(decoded(eventPacket(body(3, new Uint8Array()))).event.fields.categoryIids).toEqual([]);
});
test.each(['', '\0', '\uFEFF', 'é', 'e\u0301', '😀'])('literal UTF8 %j retained exactly with categories', value => {
  expect(decoded(eventPacket(text(23, value), text(22, value), text(22, ''))).event.fields).toEqual({ name: value, categories: [value, ''] });
});
test.each([Uint8Array.of(128), Uint8Array.of(192,128), Uint8Array.of(226,130), Uint8Array.of(237,160,128), Uint8Array.of(244,144,128,128)])('bad UTF8 family %# fails atomically', value => denied(eventPacket(text(22, 'valid'), body(23, value)), 'invalid-utf8'));
test('literal and IID categories are not resolved or merged', () => {
  expect(decoded(eventPacket(uint(3, 0n), text(22,'literal'), uint(10,0n), uint(11,0n))).event.fields).toEqual({ categoryIids:['0'], categories:['literal'], nameIid:'0', trackUuid:'0' });
});
test.each([0n, 5n, 555n, -1n, -2147483648n])('raw event enum %s retained without labeling', value => expect(decoded(eventPacket(int32(9,value))).event.fields.type).toBe(value.toString()));
test.each([9,10,11,23])('duplicate event singular %i denied', field => {
  const value = field === 23 ? text(field,'') : uint(field,0n);
  denied(eventPacket(value,value), 'duplicate-selected-field');
});
test('both name oneof alternatives deny even zero and empty', () => denied(eventPacket(uint(10,0n),text(23,'')), 'duplicate-name-oneof'));
test.each([1,2,6,8,16,17,20])('legacy event field %i denied regardless of scalar content', field => denied(eventPacket(uint(field,0n)), 'unsupported-legacy-event'));
test('opaque annotation and deprecated reporter do not become typed fragments', () => {
  const result = decoded(eventPacket(body(4,Uint8Array.of(255)), body(32,Uint8Array.of(255))));
  expect(result.event.fields).toEqual({});
  expect(result.skippedFields.map((x:any) => [x.scope,x.fieldNumber])).toEqual([['track_event',4],['track_event',32]]);
});
test('individual and aggregate UTF8 byte budgets precede literal allocation', () => {
  expect(decoded(eventPacket(text(23,'x'.repeat(4096)))).event.fields.name).toHaveLength(4096);
  denied(eventPacket(text(23,'x'.repeat(4097))), 'string-capacity');
  const categories = Array.from({length:8}, () => text(22,'x'.repeat(4096)));
  expect(decoded(eventPacket(...categories)).event.fields.categories).toHaveLength(8);
  denied(eventPacket(...categories,text(22,'x')), 'string-total-capacity');
});
test('empty categories consume member budget', () => {
  const one = text(22,''); const bytes = join(...Array.from({length:16384}, () => one));
  expect(decoded(eventPacket(bytes)).event.fields.categories).toHaveLength(16384);
  denied(eventPacket(bytes,one),'member-capacity');
});

test('reporter2 and graphics retain separate delegated fragment labels', () => {
  const result = decoded(eventPacket(body(1075,join(uint(1,1n),uint(17,18446744073709551615n))),body(1052,join(uint(1,5n),body(2,join(uint(1,4294967295n),uint(2,0n))),uint(3,18446744073709551615n)))));
  expect(result.event.reporter2).toMatchObject({ status:'decoded_fragment', kind:'reporter2', fields:{state:{value:1,name:'presented_all'},surfaceTraceId:'-1'}, evaluationEligibility:false, scoringEligibility:false, rankingEligibility:false });
  expect(result.event.graphics.fields).toEqual({ step:{value:5,name:'receive_compositor_frame'},frameSinkId:{client:'4294967295',sink:'0'},displayTraceId:'-1' });
  expect(result.event.presentFieldNumbers).toEqual([1052,1075]);
  // Both typed extensions propagate the whole-file reference through the existing spread.
  for (const fragment of [result.event.reporter2, result.event.graphics]) {
    expect(fragment.source).toStrictEqual({
      chromiumPin: 'f842f52ef39fd97b449eb27cff414bf05a98ddce',
      perfettoPin: '403906f4adfbf287a02e5546f8430dcc9d56b649',
      provenanceVersion: 'whole-schema-files-v1',
      hashPreimage: 'complete-raw-file-bytes',
      chromiumSchemaPath: 'base/tracing/protos/chrome_track_event.proto',
      perfettoSchemaPath: 'protos/third_party/chromium/chrome_track_event.proto',
      wholeSchemaBytes: 126011,
      wholeSchemaSha256: '2a26c01cd9b70dc95fd3ba2630ea918ea57012295225b0d1626e57a105974e03',
    });
    expect(Object.keys(fragment.source).sort()).toStrictEqual([
      'chromiumPin', 'chromiumSchemaPath', 'hashPreimage', 'perfettoPin', 'perfettoSchemaPath',
      'provenanceVersion', 'wholeSchemaBytes', 'wholeSchemaSha256',
    ]);
    for (const key of ['graphicsBlockSha256', 'reporterBlockSha256', 'frameSinkBlockSha256']) expect(fragment.source).not.toHaveProperty(key);
    expect(Object.isFrozen(fragment.source)).toBe(true);
    expect(fragment).toMatchObject({ normalizationCapability: 'typed-payload-fragments-only', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false });
  }
});
test.each([1052,1075])('duplicate typed extension %i denies', field => denied(eventPacket(body(field,new Uint8Array()),body(field,new Uint8Array())),'duplicate-selected-field'));
test.each([1052,1075])('typed extension %i wrong wire denies', field => denied(eventPacket(uint(field,0n)),'selected-field-wrong-wire-type'));
test('delegated unknown enum is not silently treated as decoded', () => denied(eventPacket(body(1075,uint(1,9n))),'unknown-selected-enum'));
test('delegated malformed payload denies literal prefix and packet fields', () => denied(join(uint(8,5n),eventPacket(text(23,'valid'),body(1052,Uint8Array.of(128)))),'truncated-varint'));
test('delegated FrameSink range remains uint32', () => denied(eventPacket(body(1052,body(2,uint(1,4294967296n)))),'uint32-overflow'));
test('delegated duplicate FrameSink denies', () => denied(eventPacket(body(1052,body(2,join(uint(1,0n),uint(1,0n))))),'duplicate-selected-field'));
test('graphics packed and unpacked surface IDs preserve signed order', () => {
  expect(decoded(eventPacket(body(1052,join(uint(8,0n),body(8,join(vi(18446744073709551615n),vi(4n))),uint(8,4n))))).event.graphics.fields.surfaceTraceIds).toEqual(['0','-1','4','4']);
});
test('ordered depth-first inventories use absolute original body offsets', () => {
  const result = decoded(join(uint(8,5n),eventPacket(text(23,'A'),body(1052,join(body(2,join(uint(1,7n),uint(99,9n))),uint(88,0n)))),uint(20000,0n)));
  expect(result.occurrences.map((o:any) => [o.scope,o.fieldNumber])).toEqual([['packet',8],['packet',11],['track_event',23],['track_event',1052],['graphics',2],['frame_sink',1],['frame_sink',99],['graphics',88],['packet',20000]]);
  for (const occurrence of result.occurrences) {
    expect(occurrence.start).toBeGreaterThanOrEqual(0);
    expect(occurrence.end).toBeLessThanOrEqual(result.bodyBytes.length);
    expect(Array.from(result.bodyBytes.subarray(occurrence.start, occurrence.start + tag(occurrence.fieldNumber,occurrence.wireType).length))).toEqual(Array.from(tag(occurrence.fieldNumber,occurrence.wireType)));
  }
  expect(result.skippedFields.map((o:any) => [o.scope,o.fieldNumber])).toEqual([['frame_sink',99],['graphics',88],['packet',20000]]);
  expect(result.event.graphics.occurrences).toEqual(result.occurrences.filter((o:any) => o.scope==='graphics'||o.scope==='frame_sink'));
  expect(result.presentFieldNumbers).toEqual([8,11]);
});
test('whole-input byte limit accepts its exact boundary', () => {
  const bytes = body(20000,new Uint8Array(262138)); expect(bytes.length).toBe(262144);
  expect(decoded(bytes).consumedBytes).toBe(262144);
});
test('whole field capacity includes packet, event and delegated descendants', () => {
  const unknown = uint(20000,0n); const prefix = join(...Array.from({length:32765},()=>unknown));
  // packet32765 + event-container1 + extension-container1 + reporter-state1 =32768.
  const extension = eventPacket(body(1075,uint(1,1n)));
  expect(decoded(join(prefix,extension)).event.reporter2.fields.state.value).toBe(1);
  denied(join(prefix,unknown,extension),'field-capacity');
});
test('whole member capacity includes literal category, IID and graphics members', () => {
  const iids = body(3,new Uint8Array(16382)); const graphics = body(1052,uint(8,1n));
  expect(decoded(eventPacket(text(22,''),iids,graphics)).event.graphics.fields.surfaceTraceIds).toEqual(['1']);
  denied(eventPacket(text(22,''),iids,graphics,uint(3,2n)),'member-capacity');
});
test('outputs own raw bytes and mutable inventories per call', () => {
  const input = eventPacket(body(1052,uint(8,1n)),text(22,'original'));
  const a = decoded(input); const b = decoded(input);
  a.bodyBytes.fill(0);a.occurrences[0].start=999;a.event.graphics.fields.surfaceTraceIds.push('99');a.event.fields.categories[0]='mutated';
  expect(Array.from(b.bodyBytes)).toEqual(Array.from(input));
  expect(b.occurrences[0].start).toBe(0);expect(b.event.graphics.fields.surfaceTraceIds).toEqual(['1']);expect(b.event.fields.categories).toEqual(['original']);
});
test('malformed packet tail withholds a complete earlier delegated event', () => denied(join(eventPacket(body(1075,uint(1,1n))),Uint8Array.of(128)),'truncated-varint'));
test('standalone body never automatically extracts Trace-wrapper packet fields', () => {
  const result = decoded(body(1,uint(8,123n)));expect(result.fields).toEqual({});expect(result).not.toHaveProperty('event');expect(result.skippedFields[0].fieldNumber).toBe(1);
});
test('scalar zero, false and exact uint64 retain original presence', () => {
  const result = decodeBrowserFramePacket(join(uint(8, 18446744073709551615n), uint(58, 0n), uint(10, 0n), uint(42, 0n), uint(41, 0n), uint(87, 0n)), PACKET_POLICY);
  expect(result).toMatchObject({ status: 'decoded_packet_fragment', fields: { timestamp: '18446744073709551615', timestampClockId: '0', sequenceId: '0', previousPacketDropped: '0', incrementalStateCleared: false, firstPacketOnSequence: false }, presentFieldNumbers: [8, 10, 41, 42, 58, 87] });
});
