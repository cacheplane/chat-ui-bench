import { describe, expect, it } from 'vitest';
import { decodeBrowserFramePayload, PAYLOAD_POLICY } from './browser-frame-protobuf-fragments.js';

// All small wire fixtures and expected values are authored directly from wire arithmetic.
// No encoder, runtime, SDK, trace tool or retained corpus supplies an oracle.
function bytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.trim() ? hex.trim().split(/\s+/).map(v => Number.parseInt(v, 16)) : []);
}
function decoded(hex: string, kind: 'reporter2' | 'graphics' = 'reporter2') {
  const result = decodeBrowserFramePayload(bytes(hex), kind, PAYLOAD_POLICY);
  expect(result.status).toBe('decoded_fragment');
  if (result.status !== 'decoded_fragment') throw new Error('expected decoded fragment');
  return result;
}
function denied(hex: string, kind: 'reporter2' | 'graphics' = 'reporter2') {
  const result = decodeBrowserFramePayload(bytes(hex), kind, PAYLOAD_POLICY);
  expect(result.status).toBe('unavailable');
  expect(result).not.toHaveProperty('fields');
  return result;
}

describe('pinned payload fields and exact body provenance', () => {
  it('decodes independently written Reporter2 values and relative spans', () => {
    const r = decoded('08 01 18 01 20 02 58 01 88 01 01 90 01 02');
    expect(r.fields).toEqual({ state: { value: 1, name: 'presented_all' }, frameSource: '1', frameSequence: '2', hostId: '1', surfaceTraceId: '1', displayTraceId: '2' });
    expect(r.presentFieldNumbers).toEqual([1, 3, 4, 11, 17, 18]);
    expect(r.occurrences).toEqual([
      { scope: 'root', fieldNumber: 1, wireType: 0, start: 0, valueStart: 1, end: 2 },
      { scope: 'root', fieldNumber: 3, wireType: 0, start: 2, valueStart: 3, end: 4 },
      { scope: 'root', fieldNumber: 4, wireType: 0, start: 4, valueStart: 5, end: 6 },
      { scope: 'root', fieldNumber: 11, wireType: 0, start: 6, valueStart: 7, end: 8 },
      { scope: 'root', fieldNumber: 17, wireType: 0, start: 8, valueStart: 10, end: 11 },
      { scope: 'root', fieldNumber: 18, wireType: 0, start: 11, valueStart: 13, end: 14 },
    ]);
    expect(r.consumedBytes).toBe(14);
  });
  it('retains absent versus explicit zero enums and bools', () => {
    expect(decoded('').fields).toEqual({});
    expect(decoded('08 00 68 00 50 00').fields).toEqual({ state: { value: 0, name: 'no_update_desired' }, frameType: { value: 0, name: 'forked' }, hasMissingContent: false });
    expect(decoded('68 01 50 01 78 00 80 01 01').fields).toEqual({ frameType: { value: 1, name: 'backfill' }, hasMissingContent: true, checkerboardedNeedsRaster: false, checkerboardedNeedsRecord: true });
  });
  it.each([['08 00', 'no_update_desired'], ['08 01', 'presented_all'], ['08 02', 'presented_partial'], ['08 03', 'dropped']])('maps literal state %s', (hex, name) => {
    expect(decoded(hex).fields.state).toMatchObject({ name });
  });
  it('preserves uint64 max, adjacent unsafe values, host zero and signed int64 limits', () => {
    expect(decoded('18 ff ff ff ff ff ff ff ff ff 01').fields.frameSource).toBe('18446744073709551615');
    expect(decoded('18 80 80 80 80 80 80 80 10 20 81 80 80 80 80 80 80 10 58 00').fields).toEqual({ frameSource: '9007199254740992', frameSequence: '9007199254740993', hostId: '0' });
    expect(decoded('88 01 ff ff ff ff ff ff ff ff ff 01').fields.surfaceTraceId).toBe('-1');
    expect(decoded('88 01 80 80 80 80 80 80 80 80 80 01').fields.surfaceTraceId).toBe('-9223372036854775808');
    expect(decoded('90 01 ff ff ff ff ff ff ff ff 7f').fields.displayTraceId).toBe('9223372036854775807');
  });
  it('preserves content contradictions for later semantic admission', () => {
    expect(decoded('50 00 78 01 80 01 00').fields).toEqual({ hasMissingContent: false, checkerboardedNeedsRaster: true, checkerboardedNeedsRecord: false });
  });
  it('decodes draw, send and receive without inventing acceptance or outcome', () => {
    expect(decoded('08 0b 18 02', 'graphics').fields).toEqual({ step: { value: 11, name: 'send_buffer_swap' }, displayTraceId: '2' });
    expect(decoded('08 15 18 02', 'graphics').fields.step).toEqual({ value: 21, name: 'draw_and_swap' });
    const r = decoded('08 05 12 04 08 01 10 02 50 03', 'graphics');
    expect(r.fields).toEqual({ step: { value: 5, name: 'receive_compositor_frame' }, frameSinkId: { client: '1', sink: '2' }, surfaceTraceId: '3' });
    expect(r.occurrences.filter(v => v.scope === 'frame_sink')).toEqual([
      { scope: 'frame_sink', fieldNumber: 1, wireType: 0, start: 4, valueStart: 5, end: 6 },
      { scope: 'frame_sink', fieldNumber: 2, wireType: 0, start: 6, valueStart: 7, end: 8 },
    ]);
    expect(r).not.toHaveProperty('rejected'); expect(r).not.toHaveProperty('reportedSuccessEndNs');
  });
  it.each([
    ['08 00', 0, 'unknown'], ['08 01', 1, 'did_not_produce_frame'], ['08 02', 2, 'generate_compositor_frame'],
    ['08 03', 3, 'generate_render_pass'], ['08 04', 4, 'issue_begin_frame'], ['08 05', 5, 'receive_compositor_frame'],
    ['08 06', 6, 'receive_begin_frame'], ['08 07', 7, 'receive_begin_frame_discard'], ['08 08', 8, 'send_begin_main_frame'],
    ['08 09', 9, 'submit_compositor_frame'], ['08 0a', 10, 'surface_aggregation'], ['08 0b', 11, 'send_buffer_swap'],
    ['08 0c', 12, 'buffer_swap_post_submit'], ['08 0d', 13, 'finish_buffer_swap'], ['08 0e', 14, 'swap_buffers_ack'],
    ['08 0f', 15, 'exo_construct_compositor_frame'], ['08 10', 16, 'exo_submit_compositor_frame'], ['08 11', 17, 'exo_discard_compositor_frame'],
    ['08 12', 18, 'backend_send_buffer_swap'], ['08 13', 19, 'backend_send_buffer_post_submit'], ['08 14', 20, 'backend_finish_buffer_swap'],
    ['08 15', 21, 'draw_and_swap'], ['08 16', 22, 'did_not_produce_compositor_frame'], ['08 17', 23, 'send_on_begin_frame_mojo_message'],
    ['08 18', 24, 'send_on_standalone_begin_frame_mojo_message'], ['08 19', 25, 'send_submit_compositor_frame_mojo_message'],
  ])('preserves pinned Graphics step %s as a fragment only', (hex, value, name) => {
    expect(decoded(hex, 'graphics').fields).toEqual({ step: { value, name } });
  });
  it('preserves aggregation begin/end payloads separately and ordered packed/unpacked duplicates', () => {
    expect(decoded('08 0a 18 02', 'graphics').fields).toEqual({ step: { value: 10, name: 'surface_aggregation' }, displayTraceId: '2' });
    expect(decoded('42 02 01 02', 'graphics').fields).toEqual({ surfaceTraceIds: ['1', '2'] });
    expect(decoded('40 01 40 02', 'graphics').fields).toEqual({ surfaceTraceIds: ['1', '2'] });
    const r = decoded('42 00 40 02 42 02 01 02', 'graphics');
    expect(r.fields.surfaceTraceIds).toEqual(['2', '1', '2']); expect(r.presentFieldNumbers).toEqual([8]);
    expect(r.occurrences.map(v => [v.start, v.valueStart, v.end])).toEqual([[0, 2, 2], [2, 3, 4], [4, 6, 8]]);
    expect(decoded('42 00', 'graphics').fields.surfaceTraceIds).toEqual([]);
    expect(decoded('40 ff ff ff ff ff ff ff ff ff 01', 'graphics').fields.surfaceTraceIds).toEqual(['-1']);
  });
  it('enforces nested uint32 boundaries while preserving absence', () => {
    expect(decoded('12 00', 'graphics').fields.frameSinkId).toEqual({});
    expect(decoded('12 06 08 ff ff ff ff 0f', 'graphics').fields.frameSinkId).toEqual({ client: '4294967295' });
    denied('12 06 08 80 80 80 80 10', 'graphics');
  });
  it('uses relative offsets for a nonzero-offset view without changing caller bytes', () => {
    const backing = bytes('ff 08 01 ff'); const before = [...backing];
    const r = decodeBrowserFramePayload(backing.subarray(1, 3), 'reporter2', PAYLOAD_POLICY);
    expect(r).toMatchObject({ status: 'decoded_fragment', consumedBytes: 2, occurrences: [{ start: 0, valueStart: 1, end: 2 }] });
    expect([...backing]).toEqual(before);
  });
  it('allows nonminimal uint64 encoding without claiming canonical source bytes', () => {
    expect(decoded('18 81 00').fields.frameSource).toBe('1');
  });
});

describe('wire denial and opaque unknown evidence', () => {
  it.each(['00 00', '80 80 80 80 10 00', '0b', '0c', '0e', '0f', '08', '80', '18 80 80 80 80 80 80 80 80 80 02', '18 80 80 80 80 80 80 80 80 80 80 00', 'a2 01 02 00', 'a2 01 ff ff ff ff ff ff ff ff ff 01'])('denies malformed wire %s without a prefix', hex => { denied(hex); denied(`08 01 ${hex}`); });
  it.each(['08 04', '68 02', '50 02', '0a 00', '08 01 08 01', '08 01 08 02'])('denies enum/bool/type/duplicate ambiguity %s', hex => { denied(hex); });
  it.each(['08 1a', '12 04 08 01 08 01', '12 00 12 00', '12 02 0a 00', '42 01 80', '40 80'])('denies graphics ambiguity or packed truncation %s', hex => { denied(hex, 'graphics'); });
  it.each([
    ['f8 ff ff ff 0f 00', 536870911], ['b8 a3 09 00', 18999], ['c0 a3 09 00', 19000], ['f8 e1 09 00', 19999], ['80 e2 09 00', 20000],
  ])('preserves legal opaque field literal %s as %s', (hex, number) => {
    const r = decoded(hex); expect(r.fields).toEqual({}); expect(r.presentFieldNumbers).toEqual([]);
    expect(r.skippedFields).toEqual([{ scope: 'root', fieldNumber: number, wireType: 0, start: 0, valueStart: hex.split(' ').length - 1, end: hex.split(' ').length }]);
  });
  it('retains unknown and known-unselected wire0/1/2/5 spans', () => {
    const r = decoded('10 01 a1 01 00 00 00 00 00 00 00 00 a2 01 02 00 ff a5 01 00 00 00 00');
    expect(r.fields).toEqual({}); expect(r.skippedFields.map(v => [v.fieldNumber, v.wireType, v.start, v.end])).toEqual([[2, 0, 0, 2], [20, 1, 2, 12], [20, 2, 12, 17], [20, 5, 17, 23]]);
    denied('a1 01 00'); denied('a5 01 00'); denied('a0 01 80');
  });
  it('descends only selected FrameSink and leaves apparent nested messages opaque', () => {
    expect(decoded('a2 01 02 00 ff').skippedFields).toHaveLength(1);
    const r = decoded('12 05 1a 03 00 0b ff', 'graphics');
    expect(r.fields.frameSinkId).toEqual({});
    expect(r.skippedFields).toEqual([{ scope: 'frame_sink', fieldNumber: 3, wireType: 2, start: 2, valueStart: 4, end: 7 }]);
    expect(r.occurrences).toHaveLength(2);
    // Reporter field2 is an unselected scalar schema field, so these bytes stay opaque.
    expect(decoded('12 02 00 ff').fields).toEqual({});
  });
  it('denies unsupported policy, kind, byte views and shared mutable storage', () => {
    expect(decodeBrowserFramePayload(bytes(''), 'reporter2', 'unknown').status).toBe('unavailable');
    expect(decodeBrowserFramePayload(bytes(''), 'unknown', PAYLOAD_POLICY).status).toBe('unavailable');
    for (const input of [[], new Uint16Array(1), new DataView(new ArrayBuffer(1)), new Uint8Array(new SharedArrayBuffer(1))]) expect(decodeBrowserFramePayload(input, 'reporter2', PAYLOAD_POLICY).status).toBe('unavailable');
  });
  it('copies the native byte view without invoking overridden properties or methods', () => {
    const input = bytes('08 01'); let calls = 0;
    for (const key of ['length', 'byteLength', 'buffer', 'slice', 'constructor']) Object.defineProperty(input, key, { get() { calls++; throw new Error('override'); } });
    Object.defineProperty(input, Symbol.iterator, { get() { calls++; throw new Error('iterator'); } });
    expect(decodeBrowserFramePayload(input, 'reporter2', PAYLOAD_POLICY)).toMatchObject({ status: 'decoded_fragment', fields: { state: { value: 1, name: 'presented_all' } } });
    expect(calls).toBe(0);
  });
  it('denies detached byte storage rather than calling it an empty body', () => {
    const input = bytes('08 01'); structuredClone(input.buffer, { transfer: [input.buffer] });
    expect(decodeBrowserFramePayload(input, 'reporter2', PAYLOAD_POLICY).status).toBe('unavailable');
  });
});

describe('bounded work, output ownership and qualification', () => {
  it('checks byte limit before scanning and accepts the exact body size as opaque data', () => {
    // field20 wire2, literal length262139 plus 5-byte header =262144.
    const at = new Uint8Array(262144);
    at.set(bytes('a2 01 fb ff 0f'));
    expect(decodeBrowserFramePayload(at, 'reporter2', PAYLOAD_POLICY)).toMatchObject({ status: 'decoded_fragment', consumedBytes: 262144 });
    expect(decodeBrowserFramePayload(new Uint8Array(262145), 'reporter2', PAYLOAD_POLICY).status).toBe('unavailable');
  });
  it('charges all repeated field occurrences before output', () => {
    const at = new Uint8Array(32768 * 2); for (let i = 0; i < at.length; i += 2) at.set([0x10, 0x00], i);
    const r = decodeBrowserFramePayload(at, 'reporter2', PAYLOAD_POLICY); expect(r).toMatchObject({ status: 'decoded_fragment' });
    if (r.status === 'decoded_fragment') expect(r.occurrences).toHaveLength(32768);
    const over = new Uint8Array(at.length + 2); over.set(at); over.set([0x10, 0x00], at.length);
    expect(decodeBrowserFramePayload(over, 'reporter2', PAYLOAD_POLICY).status).toBe('unavailable');
  });
  it('shares one root+FrameSink occurrence budget including opaque child fields', () => {
    // 16384 root unknowns + container +16383 child unknowns =32768.
    const root = new Uint8Array(32768); for (let i = 0; i < root.length; i += 2) root.set([0x60, 0x00], i);
    const child = new Uint8Array(32766); for (let i = 0; i < child.length; i += 2) child.set([0x18, 0x00], i);
    const at = new Uint8Array(root.length + 4 + child.length); at.set(root); at.set([0x12, 0xfe, 0xff, 0x01], root.length); at.set(child, root.length + 4);
    expect(decodeBrowserFramePayload(at, 'graphics', PAYLOAD_POLICY).status).toBe('decoded_fragment');
    const over = new Uint8Array(at.length + 2); over.set(at); over.set([0x60, 0x00], at.length);
    expect(decodeBrowserFramePayload(over, 'graphics', PAYLOAD_POLICY).status).toBe('unavailable');
  });
  it('charges packed and unpacked duplicate members at the exact bound', () => {
    const at = new Uint8Array(16384 * 2); for (let i = 0; i < at.length; i += 2) at.set([0x40, 0x01], i);
    const r = decodeBrowserFramePayload(at, 'graphics', PAYLOAD_POLICY); expect(r.status).toBe('decoded_fragment');
    if (r.status === 'decoded_fragment') expect(r.fields.surfaceTraceIds).toHaveLength(16384);
    const over = new Uint8Array(at.length + 2); over.set(at); over.set([0x40, 0x01], at.length); expect(decodeBrowserFramePayload(over, 'graphics', PAYLOAD_POLICY).status).toBe('unavailable');
    const packed = new Uint8Array(16388); packed.set([0x42, 0x80, 0x80, 0x01]); packed.fill(1, 4);
    expect(decodeBrowserFramePayload(packed, 'graphics', PAYLOAD_POLICY).status).toBe('decoded_fragment');
    const packedOver = new Uint8Array(16389); packedOver.set([0x42, 0x81, 0x80, 0x01]); packedOver.fill(1, 4); expect(decodeBrowserFramePayload(packedOver, 'graphics', PAYLOAD_POLICY).status).toBe('unavailable');
  });
  it('owns fresh fields/spans across calls and preserves values across field order', () => {
    const first = decoded('08 01 18 02'); const reordered = decoded('18 02 08 01');
    expect(first.fields).toEqual(reordered.fields); expect(first.occurrences).not.toEqual(reordered.occurrences);
    first.presentFieldNumbers.push(999); first.occurrences[0]!.end = 999;
    expect(decoded('08 01 18 02').presentFieldNumbers).toEqual([1, 3]); expect(decoded('08 01 18 02').occurrences[0]!.end).toBe(2);
    const members = decoded('40 01', 'graphics'); members.fields.surfaceTraceIds!.push('999'); expect(decoded('40 01', 'graphics').fields.surfaceTraceIds).toEqual(['1']);
  });
  it('never fabricates contextual evaluator eligibility, origin or rates', () => {
    const r = decoded('08 01 18 01 20 02 58 01 88 01 01 90 01 02');
    expect(r).toMatchObject({ normalizationCapability: 'typed-payload-fragments-only', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false });
    for (const key of ['origin', 'normalizationEvidence', 'repetitions', 'rate', 'processIncarnation', 'clockId', 'lifetimeId', 'pairId', 'traceEof']) expect(r).not.toHaveProperty(key);
  });
});
