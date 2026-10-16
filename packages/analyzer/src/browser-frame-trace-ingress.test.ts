import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { decodeBrowserFrameTrace } from './browser-frame-trace-ingress.js';
import { WireError } from './browser-frame-protobuf-wire.js';
import { body, int32, join, tag, uint, vi } from './browser-frame-packet-fragments.test-helper.js';

const POLICY = 'pinned-trace-packet-ingress-diagnostic-v1';
const LABELS = {
  normalizationCapability: 'structural-trace-container-fragments-only', inputOrder: 'byte-order',
  captureCompleteness: 'unestablished', clockAdmission: 'not_evaluated', targetLifetime: 'unestablished',
  sourceCoverage: 'unestablished', runtimeQualification: 'unestablished', evaluationEligibility: false,
  scoringEligibility: false, rankingEligibility: false, nativeSupported: false,
};
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function decoded(bytes: Uint8Array) {
  const result = decodeBrowserFrameTrace(bytes, POLICY);
  expect(result.status).toBe('decoded_trace_container_fragments');
  if (result.status !== 'decoded_trace_container_fragments') throw new Error('expected-authored-wrapper');
  expect(result).toMatchObject(LABELS);
  expect(result).not.toHaveProperty('fps');
  expect(result.inputRef).toEqual({ status: 'owned', bytes: bytes.length, sha256: hash(bytes) });
  return result;
}
function denied(bytes: unknown, code: string, extra: object = {}, policy: unknown = POLICY) {
  const result = decodeBrowserFrameTrace(bytes, policy);
  expect(result).toMatchObject({ ...LABELS, status: 'unavailable', ...extra });
  if (result.status !== 'unavailable') throw new Error('expected-denial');
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({ code });
  expect(result).not.toHaveProperty('frames');
  expect(result).not.toHaveProperty('frameCount');
  expect(JSON.stringify(result)).not.toContain('secret-caller-error');
  for (const d of result.diagnostics) {
    expect(d.code).toMatch(/^[\x20-\x7e]{1,64}$/);
    if (d.cause !== undefined) expect(d.cause).toMatch(/^[\x20-\x7e]{1,64}$/);
    if (d.offset !== undefined) expect(Number.isInteger(d.offset) && d.offset >= 0 && d.offset <= 262144).toBe(true);
    if (d.frameIndex !== undefined) expect(Number.isInteger(d.frameIndex) && d.frameIndex >= 0 && d.frameIndex <= 1024).toBe(true);
  }
  return result;
}
const wrap = (...packets: Uint8Array[]) => join(...packets.map(packet => body(1, packet)));
const event = (...parts: Uint8Array[]) => body(11, join(...parts));

test('literal repeated packet wrappers retain absolute half-open spans and body-relative occurrences', () => {
  const bytes = Uint8Array.of(10,9,64,5,90,5,154,67,2,8,0,10,7,90,5,226,65,2,8,5);
  const result = decoded(bytes);
  expect(result.inputRef).toEqual({status:'owned',bytes:20,sha256:'f1bec0298fd95488f1ff2db71abc1d7138a30f0647b1aeb11565aebb3b3cab86'});
  expect(result.structuralContainerEOF).toBe(true);
  expect(result.frameCount).toBe(2);
  expect(result.frames.map(({ packet, ...frame }) => frame)).toEqual([
    { frameIndex:0,keyStart:0,keyEnd:1,lengthStart:1,lengthEnd:2,bodyStart:2,bodyEnd:11,bodyBytes:9,bodySha256:'2dc34a3f149b84b9918294c1d77f2cbaf64e2e46d899fe9d1b8f266d3369b3af' },
    { frameIndex:1,keyStart:11,keyEnd:12,lengthStart:12,lengthEnd:13,bodyStart:13,bodyEnd:20,bodyBytes:7,bodySha256:'8e136667813702ace5089c159fab5c4552d05b208fc1d8966246bdeeaea653a9' },
  ]);
  expect(Array.from(result.frames[0]!.packet.bodyBytes)).toEqual([64,5,90,5,154,67,2,8,0]);
  expect(result.frames[0]!.packet.fields).toEqual({timestamp:'5'});
  expect(result.frames[0]!.packet.occurrences).toEqual([
    {scope:'packet',fieldNumber:8,wireType:0,start:0,valueStart:1,end:2},
    {scope:'packet',fieldNumber:11,wireType:2,start:2,valueStart:4,end:9},
    {scope:'track_event',fieldNumber:1075,wireType:2,start:4,valueStart:7,end:9},
    {scope:'reporter2',fieldNumber:1,wireType:0,start:7,valueStart:8,end:9},
  ]);
  expect(result.frames[0]!.packet.event!.reporter2!.fields.state).toEqual({value:0,name:'no_update_desired'});
  expect(result.frames[1]!.packet.event!.graphics!.fields.step).toEqual({value:5,name:'receive_compositor_frame'});
  expect(result.frames[1]!.packet.occurrences[2]).toEqual({scope:'graphics',fieldNumber:1,wireType:0,start:5,valueStart:6,end:7});
  expect(result.frames[0]!.packet.evaluationEligibility).toBe(false);
});
test('empty Trace and empty packet assert structural emptiness only', () => {
  expect(decoded(new Uint8Array())).toMatchObject({structuralContainerEOF:true,frameCount:0,frames:[]});
  const result = decoded(Uint8Array.of(10,0));
  expect(result.frames[0]).toMatchObject({bodyStart:2,bodyEnd:2,bodyBytes:0,bodySha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'});
  expect(result.frames[0]!.packet.fields).toEqual({});
});
test('nonminimal key and length preserve encoded spans instead of canonicalizing', () => {
  const result = decoded(Uint8Array.of(138,0,128,0));
  expect(result.frames[0]).toMatchObject({keyStart:0,keyEnd:2,lengthStart:2,lengthEnd:4,bodyStart:4,bodyEnd:4});
  expect(result.inputRef).toEqual({status:'owned',bytes:4,sha256:'f26c95216b108cdff95dedfa20faf732e9a78a2a4246d31afcc1a0e3eb6687ff'});
});
test('ten-byte nonminimal uint64 encodings terminate within the supplied window', () => {
  const key = Uint8Array.of(138,128,128,128,128,128,128,128,128,0);
  const length = Uint8Array.of(128,128,128,128,128,128,128,128,128,0);
  expect(decoded(join(key,length)).frames[0]).toMatchObject({keyEnd:10,lengthStart:10,lengthEnd:20,bodyStart:20,bodyEnd:20});
});
test('multi-byte length window retains original body bytes', () => {
  const packet = body(20000,new Uint8Array(128));
  const result = decoded(wrap(packet));
  expect(result.frames[0]).toMatchObject({keyEnd:1,lengthStart:1,lengthEnd:3,bodyStart:3,bodyEnd:packet.length+3});
  expect(result.frames[0]!.packet.bodyBytes).toEqual(packet);
});
test.each([
  [[128],'truncated-varint'], [[10],'truncated-varint'],
  [[10,128],'truncated-varint'], [[10,2,0],'out-of-bounds-length'],
  [[0],'invalid-field-number'], [[128,128,128,128,16],'invalid-field-number'],
  [[8,0],'unsupported-trace-root-field'], [[9],'unsupported-trace-root-field'], [[13],'unsupported-trace-root-field'],
  [[11],'unsupported-wire-type'], [[12],'unsupported-wire-type'], [[14],'unsupported-wire-type'], [[15],'unsupported-wire-type'],
  [[18,0],'unsupported-trace-root-field'], [[64,1],'unsupported-trace-root-field'],
  [[123,125],'unsupported-wire-type'], [[31,139],'unsupported-wire-type'],
  [[255,255,255,255,255,255,255,255,255,2],'uint64-varint-overflow'],
  [[10,255,255,255,255,255,255,255,255,255,2],'uint64-varint-overflow'],
  [[10,255,255,255,255,255,255,255,255,255,1],'out-of-bounds-length'],
])('malformed authored root suffix %# rejects whole container before packet decoding', (tail, code) => {
  // An invalid earlier body proves first-pass framing dominates packet rejection.
  denied(join(Uint8Array.of(10,1,0),Uint8Array.from(tail)),code as string,{structuralContainerEOF:false});
});
test('valid wrapper with invalid later body discards earlier complete frame', () => {
  denied(Uint8Array.of(10,0,10,1,128),'packet-unavailable',{
    structuralContainerEOF:true, diagnostics:[{code:'packet-unavailable',frameIndex:1,cause:'truncated-varint'}],
  });
});
test('whole wrapper byte cap is exactly 262144 before any packet delegation', () => {
  const bytes = wrap(body(20000,new Uint8Array(262134)));
  expect(bytes.length).toBe(262144);
  expect(decoded(bytes).frameCount).toBe(1);
  denied(new Uint8Array(262145),'byte-capacity',{inputRef:{status:'unavailable'},structuralContainerEOF:false});
});
test('frame count is bounded at 1024 including zero-length bodies', () => {
  expect(decoded(join(...Array.from({length:1024},()=>Uint8Array.of(10,0)))).frameCount).toBe(1024);
  denied(join(...Array.from({length:1025},()=>Uint8Array.of(10,0))),'frame-capacity',{structuralContainerEOF:false});
});
test('aggregate occurrences accept exact ceiling and reject individually valid excess', () => {
  const occurrences = (n: number) => join(...Array.from({length:n},()=>uint(20000,0n)));
  expect(decoded(wrap(occurrences(16384),occurrences(16384))).frames.map(f=>f.packet.occurrences.length)).toEqual([16384,16384]);
  denied(wrap(occurrences(16384),occurrences(16385)),'aggregate-field-capacity',{structuralContainerEOF:true});
});
test('aggregate members count IID, literal category and typed graphics values', () => {
  const first = event(body(3,new Uint8Array(8192)));
  const second = event(body(22,new Uint8Array()),body(1052,body(8,new Uint8Array(8191))));
  expect(decoded(wrap(first,second)).frameCount).toBe(2);
  denied(wrap(first,join(second,uint(20000,0n)),event(uint(3,0n))),'aggregate-member-capacity',{structuralContainerEOF:true});
});
test('per-body limits retain bounded cause without partial results', () => {
  denied(wrap(new Uint8Array(),event(body(3,new Uint8Array(16385)))),'packet-unavailable',{
    structuralContainerEOF:true, diagnostics:[{code:'packet-unavailable',frameIndex:1,cause:'member-capacity'}],
  });
});
test('raw uint64, signed PID, clocks, sequence and loss flags retain presence', () => {
  const packet = join(uint(8,18446744073709551615n),uint(58,0n),uint(10,17n),uint(13,4294967295n),
    uint(42,257n),uint(98,3n),int32(79,-1n),uint(41,0n),uint(87,1n));
  const result = decoded(wrap(packet,new Uint8Array()));
  expect(result.frames[0]!.packet.fields).toEqual({timestamp:'18446744073709551615',timestampClockId:'0',sequenceId:'17',
    sequenceFlags:'4294967295',previousPacketDropped:'257',machineId:'3',trustedPid:'-1',incrementalStateCleared:false,firstPacketOnSequence:true});
  expect(result.frames[1]!.packet.fields).toEqual({});
});
test('opaque state locations and absent typed state remain packet-relative and unqualified', () => {
  const packet = join(body(6,Uint8Array.of(255)),body(12,Uint8Array.of(254)),body(59,Uint8Array.of(253)));
  const result = decoded(wrap(packet,event(body(1075,new Uint8Array()))));
  expect(result.frames[0]!.packet.opaquePayloads.map(o=>[o.fieldNumber,o.start,o.valueStart,o.end])).toEqual([[6,0,2,3],[12,3,5,6],[59,6,9,10]]);
  expect(result.frames[1]!.packet.event!.reporter2!.fields).toEqual({});
  expect(result.frames[1]!.packet.event!.reporter2!.source).toMatchObject({
    chromiumPin:'f842f52ef39fd97b449eb27cff414bf05a98ddce', perfettoPin:'403906f4adfbf287a02e5546f8430dcc9d56b649',
  });
});
test.each([9n,18446744073709551615n])('unknown typed enum %s stays unavailable', value => {
  denied(wrap(event(body(1075,uint(1,value)))),'packet-unavailable',{structuralContainerEOF:true,diagnostics:[{code:'packet-unavailable',frameIndex:0,cause:'unknown-selected-enum'}]});
});
test('strict primitive policy does not coerce objects or accept completion receipts', () => {
  const policy = {toString(){throw new Error('secret-caller-error');}};
  denied(new Uint8Array(),'unsupported-policy',{inputRef:{status:'unavailable'}},policy);
  denied({bytes:new Uint8Array(),loss:false,eof:true},'unsupported-byte-view',{inputRef:{status:'unavailable'}});
});
test('unsupported storage never claims owned hash', () => {
  for (const input of [null,[],new Uint16Array(),Buffer.from([]),new (class extends Uint8Array {})()]) {
    denied(input,'unsupported-byte-view',{inputRef:{status:'unavailable'},structuralContainerEOF:false});
  }
  denied(new Proxy(new Uint8Array(),{}),'unavailable-byte-storage',{inputRef:{status:'unavailable'}});
  denied(new Uint8Array(new SharedArrayBuffer(2)),'unavailable-byte-storage',{inputRef:{status:'unavailable'}});
  const detached = new Uint8Array(2); structuredClone(detached.buffer,{transfer:[detached.buffer]});
  denied(detached,'unavailable-byte-storage',{inputRef:{status:'unavailable'}});
});
test('hostile getPrototypeOf trap and hostile thrown-value inspection never escape', () => {
  const hostile = new Proxy({}, {getPrototypeOf(){throw new Error('secret-caller-error');},get(){throw new Error('secret-caller-error');}});
  let traps = 0;
  const input = new Proxy(new Uint8Array(),{getPrototypeOf(){traps++; throw hostile;}});
  expect(()=>denied(input,'invalid-trace-input',{inputRef:{status:'unavailable'}})).not.toThrow();
  expect(traps).toBe(1);
});
test.each(['secret-caller-error','truncated-varint-secret'])('caller-thrown WireError code %s has no diagnostic authority', code => {
  const input = new Proxy(new Uint8Array(),{getPrototypeOf(){throw new WireError(code);}});
  denied(input,'invalid-trace-input',{inputRef:{status:'unavailable'},structuralContainerEOF:false});
});
test.each(['huge-string','object'])('forged WireError changing code getter is read once before %s third value', kind => {
  let reads = 0;
  const third: unknown = kind === 'huge-string' ? 'secret-caller-error'.repeat(65536) : {secret:'secret-caller-error'};
  const error: unknown = Object.create(WireError.prototype,{
    code:{get(){reads++; return reads <= 2 ? 'truncated-varint' : third;}},
  });
  const input = new Proxy(new Uint8Array(),{getPrototypeOf(){throw error;}});
  const result = decodeBrowserFrameTrace(input,POLICY);
  // Check the count first so a regression never prints the deliberately large third value.
  expect(reads).toBe(1);
  expect(result).toMatchObject({...LABELS,status:'unavailable',inputRef:{status:'unavailable'},structuralContainerEOF:false,
    diagnostics:[{code:'truncated-varint'}]});
  if (result.status !== 'unavailable') throw new Error('expected-bounded-diagnostic');
  expect(typeof result.diagnostics[0]!.code).toBe('string');
  expect(JSON.stringify(result)).not.toContain('secret-caller-error');
  expect(result).not.toHaveProperty('frames');
});
test('native ownership ignores caller properties and snapshots caller mutation', () => {
  const input = Uint8Array.of(10,2,64,5);
  for (const key of ['length','byteLength','buffer','slice',Symbol.iterator]) Object.defineProperty(input,key,{get(){throw new Error('secret-caller-error');}});
  const result = decodeBrowserFrameTrace(input,POLICY);
  expect(result.status).toBe('decoded_trace_container_fragments');
  if (result.status !== 'decoded_trace_container_fragments') throw new Error('expected-owned-wrapper');
  input.fill(0);
  expect(Array.from(result.frames[0]!.packet.bodyBytes)).toEqual([64,5]);
  expect(result.frames[0]!.packet.fields).toEqual({timestamp:'5'});
});

/** Finite TEST ONLY partitions; does not add a production reader or prove I/O EOF. */
function reassemble(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length > 1024) throw new Error('partition-capacity');
  let bytes = 0;
  for (const chunk of chunks) {
    if (Object.getPrototypeOf(chunk) !== Uint8Array.prototype || chunk.length === 0) throw new Error('no-progress');
    bytes += chunk.length;
    if (bytes > 262144) throw new Error('partition-byte-capacity');
  }
  return join(...chunks);
}
test('bounded authored partitions split multi-byte key, length and body identically', () => {
  const packet = body(20000,new Uint8Array(128));
  const whole = join(Uint8Array.of(138,0),vi(BigInt(packet.length)),packet);
  const chunks = [whole.subarray(0,1),whole.subarray(1,3),whole.subarray(3,5),whole.subarray(5)];
  expect(decoded(reassemble(chunks))).toEqual(decoded(whole));
  expect(decoded(reassemble([])).frameCount).toBe(0);
  expect(reassemble(Array.from({length:1024},()=>Uint8Array.of(0)))).toHaveLength(1024);
  expect(()=>reassemble(Array.from({length:1025},()=>Uint8Array.of(0)))).toThrow('partition-capacity');
  expect(()=>reassemble([Uint8Array.of(10),new Uint8Array()])).toThrow('no-progress');
  expect(()=>reassemble([new Uint8Array(262144),Uint8Array.of(0)])).toThrow('partition-byte-capacity');
});
