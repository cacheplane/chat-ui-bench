import { expect, test } from 'vitest';
import {createOwnedPaintStudyV12,OWNED_PAINT_V12_POLICY} from './browser-frame-owned-paint-v12.js';
import {
  stateBodyReservationV12, descriptorReservationV12, comparatorReservationV12,
  referenceJSONReservationV12, measureOwnedJSONV12,
  OwnedPaintBudgetV12, OWNED_PAINT_V12_LIMITS,
} from './browser-frame-owned-paint-v12-budget.js';

test('startup pools are separate, prepaid once, and reader physical disclosure consumes its original credit', () => {
  for (const mode of ['study', 'reader'] as const) {
    const budget = new OwnedPaintBudgetV12(mode);
    const expected = 1073741824 + 268435456 + (mode === 'reader' ? 2147483648 : 0);
    expect(budget.usage.cumulative.closureReservedWork).toBe(expected);
    expect(budget.usage.cumulative.totalLogicalWork).toBe(expected);
    budget.chargeClosure('wrapperWork', 7);
    budget.chargeFinalization('outputPreflightNodes', 11);
    if (mode === 'reader') {
      budget.chargeReader('requestedReadBytes', 65536);
      budget.chargeReader('acknowledgedReadBytes', 1);
    }
    expect(budget.usage.cumulative.totalLogicalWork).toBe(expected);
    expect(budget.usage.cumulative.wrapperWork).toBe(7);
    expect(budget.usage.cumulative.outputPreflightNodes).toBe(11);
  }
});

test('transient shared representation and cumulative allocations deny atomically before allocation', () => {
  const budget = new OwnedPaintBudgetV12();
  const baseline = structuredClone(budget.usage);
  expect(() => budget.reserveTransient({ bufferBytes: OWNED_PAINT_V12_LIMITS.currentLogicalBytes })).toThrow();
  expect(budget.usage).toEqual(baseline);
  const release = budget.reserveTransient({ bufferBytes: 65536, utf16Units: 13, logicalSlots: 3 });
  expect(budget.usage.current.bufferBytes).toBe(baseline.current.bufferBytes + 65536);
  expect(budget.usage.cumulative.allocatedBufferBytes).toBe(baseline.cumulative.allocatedBufferBytes + 65536);
  const allocated = budget.usage.cumulative.allocatedBufferBytes;
  release();
  expect(budget.usage.current).toEqual(baseline.current);
  expect(budget.usage.cumulative.allocatedBufferBytes).toBe(allocated);
  expect(() => release()).toThrow('representation-release');
});

test('every fixed successful and retained dimension accepts exact capacity and first excess is atomic', () => {
  const caps=OWNED_PAINT_V12_LIMITS as Record<string,number>;
  for(const key of Object.keys(new OwnedPaintBudgetV12().usage.successful)){
    const b=new OwnedPaintBudgetV12(),cap=caps[key]!;
    expect(Number.isSafeInteger(cap)).toBe(true);b.addSuccessful(key,cap);
    expect(b.usage.successful[key]).toBe(cap);const prior=structuredClone(b.usage);
    expect(()=>b.addSuccessful(key,1)).toThrow('capacity-'+key);expect(b.usage).toEqual(prior);
  }
  for(const key of Object.keys(new OwnedPaintBudgetV12().usage.retained)){
    const b=new OwnedPaintBudgetV12(),cap=key==='indexKeyUTF8'?caps.sequenceKeyUTF8!:key==='metadataUTF8'?caps.metadataCanonicalBytes!+caps.metadataKeyBytes!+caps.metadataOccurrenceBytes!:caps[key]!;
    expect(Number.isSafeInteger(cap)).toBe(true);b.addRetained(key,cap);const prior=structuredClone(b.usage);
    expect(()=>b.addRetained(key,1)).toThrow('capacity-'+key);expect(b.usage).toEqual(prior);
  }
});

test('every fixed cumulative dimension denies first excess before counter or global work mutation', () => {
  const L=OWNED_PAINT_V12_LIMITS;
  const caps:Record<string,number>={requestedReadBytes:L.chunkBytes*L.readCalls,readCalls:L.readCalls,acknowledgedReadBytes:L.inputBytes,inputCopyBytes:L.inputBytes,inputHashBytes:L.inputBytes,frameCopyBytes:L.inputBytes,frameHashBytes:L.inputBytes,manifestBytes:L.manifestBytes,manifestUpdates:L.manifestUpdates,utf8WidthScanUnits:L.utf8WidthScanUnits,canonicalPreflightNodes:L.canonicalPreflightNodes,canonicalPreflightStringUnits:L.canonicalPreflightStringUnits,canonicalGeneratedBytes:L.canonicalGeneratedBytes,canonicalHashBytes:L.canonicalHashBytes,canonicalComparisonBytes:L.canonicalComparisonBytes,fullMetadataRowBytes:L.fullMetadataRowBytes,metadataFactKeyBytes:L.metadataKeyBytes,metadataOccurrenceBytes:L.metadataOccurrenceBytes,allocatedBufferBytes:L.cumulativeBufferBytes,allocatedUTF16Units:L.cumulativeUTF16Units,allocatedLogicalSlots:L.cumulativeLogicalSlots,wrapperWork:L.totalLogicalWork,outputPreflightNodes:4*L.outputNodes,outputStringUnits:4*L.outputUTF16Units,outputEncodedBytes:4*L.outputBytes,outputWriteBytes:L.outputWriteBytes,outputReadbackBytes:L.outputReadbackBytes,sourceReadBytes:L.sourceBytes*L.sourcePasses,sourceHashBytes:L.sourceBytes*L.sourcePasses,runtimeReadBytes:L.runtimeBytes*L.runtimePasses,runtimeHashBytes:L.runtimeBytes*L.runtimePasses,closureReservedWork:L.normalOutputReservedWork+L.closureReservedWork+L.readerReservedWork,totalLogicalWork:L.totalLogicalWork};
  for(const key of Object.keys(new OwnedPaintBudgetV12().usage.cumulative)){
    const b=new OwnedPaintBudgetV12(),prior=structuredClone(b.usage),cap=caps[key]!;
    expect(Number.isSafeInteger(cap)).toBe(true);
    expect(()=>b.chargeCumulative(key,cap+1)).toThrow();expect(b.usage).toEqual(prior);
  }
});

test('state helper reservation pays terminal attempts independently from successful semantic usage', () => {
  for (const m of [0, 1, 262144]) for (const kind of ['defaults', 'interned_names', 'clock_snapshot'] as const) {
    const f = Math.min(8193, m + 1), b = Math.min(4097, m + 1), u = kind === 'interned_names' ? Math.min(32768, m) : 0;
    const reservation = stateBodyReservationV12(m, kind);
    expect(Object.isFrozen(reservation)).toBe(true);
    expect(reservation).toMatchObject({ wireByteReads: m, fieldChargeWork: f,
      memberChargeWork: b, loopRecordWork: 256 + 64 * (f + b), copyBytes: m,
      reservedByteBufferOccupancy: m, utf8DecodeBytes: u,
      reservedUTF16Occupancy: 512 + 20 * (f + b) + u, terminalChecks: 4, resultRecords: 1 });
    expect(Object.values(reservation).every(n => Number.isSafeInteger(n) && n >= 0)).toBe(true);
  }
});

test('descriptor v3 reserves both selected member attempts and includes them in slot and UTF16 bounds', () => {
  for (const m of [0, 1, 2, 262144]) {
    const f = Math.min(8193, m + 1), b = Math.min(2, m), reservation = descriptorReservationV12(m);
    expect(reservation).toMatchObject({ wireByteReads: m, fieldChargeWork: f, memberChargeWork: b,
      loopRecordWork: 256 + 64 * (f + b), copyBytes: m, reservedByteBufferOccupancy: m,
      utf8DecodeBytes: 0, reservedUTF16Occupancy: 512 + 20 * (f + b), terminalChecks: 4, resultRecords: 1 });
    expect(Object.isFrozen(reservation)).toBe(true);
  }
});

test('reservation primitive length guards do not inspect or coerce caller objects', () => {
  let traps = 0;
  const hostile = new Proxy({}, { get() { traps++; throw Error('caller'); }, getPrototypeOf() { traps++; throw Error('caller'); } });
  for (const m of [hostile, {}, '0', null, undefined, NaN, Infinity, -1, 0.5, 262145, Number.MAX_SAFE_INTEGER]) {
    expect(() => stateBodyReservationV12(m as number, 'defaults')).toThrow('invalid-helper-byte-length');
    expect(() => descriptorReservationV12(m as number)).toThrow('invalid-helper-byte-length');
  }
  expect(traps).toBe(0);
});

test('comparator has a separate full parse/keys/join/stringify/rules reservation', () => {
  const reservation = comparatorReservationV12();
  expect(reservation).toMatchObject({ parserAndOutputScanUnits: 16384, parsedNodes: 4096,
    logicalSlots: 32768, dynamicUTF16Units: 32768, comparisonScanUnits: 16384,
    structuralWork: 131072, totalLogicalWork: 212992, terminalChecks: 4, resultRecords: 1 });
  expect(Object.isFrozen(reservation)).toBe(true);
  expect(referenceJSONReservationV12()).toMatchObject({ parserAndOutputScanUnits: 131072,
    parsedNodes: 32768, logicalSlots: 262144, dynamicUTF16Units: 262144,
    comparisonScanUnits: 131072, structuralWork: 1048576, totalLogicalWork: 1703936 });
});

test('owned JSON sizing counts JSON escapes and UTF8 widths including lone and paired surrogates exactly', () => {
  for (const value of [null, false, 0, ['\0\b\t\n\f\r', '"\\', 'é', '中', '😀', '\ud800', '\udc00'],
    { a: '\ud800😀\udc00', b: [1, true, null], c: 'x' }]) {
    const measured = measureOwnedJSONV12(value);
    expect(measured.escapedBytes).toBe(Buffer.byteLength(JSON.stringify(value)));
    expect(measured.depth).toBeLessThanOrEqual(16);
  }
});

test('owned output sizing refuses proxies, accessors, toJSON, cycles and sparse arrays without caller hooks', () => {
  let traps = 0; const trap = () => { traps++; throw Error('caller'); };
  const proxy = new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap });
  const accessor = Object.defineProperty({}, 'x', { get: trap, enumerable: true });
  const custom = { toJSON: trap };
  const cycle: unknown[] = []; cycle.push(cycle);
  for (const value of [proxy, accessor, custom, cycle, new Array(1), { x: undefined }, { x: NaN }])
    expect(() => measureOwnedJSONV12(value)).toThrow('result-shape');
  expect(traps).toBe(0);
});

test('inherited serialization hooks are refused by descriptor without executing the hook', () => {
  let calls = 0;
  for (const prototype of [Object.prototype, Array.prototype]) {
    Object.defineProperty(prototype, 'toJSON', { configurable: true, value() { calls++; return 'caller'; } });
    try { expect(() => measureOwnedJSONV12(prototype === Array.prototype ? [] : {})).toThrow('result-shape'); }
    finally { Reflect.deleteProperty(prototype, 'toJSON'); }
  }
  expect(calls).toBe(0);
});

test.each([
  (v:any)=>{v.status='invented';},(v:any)=>{v.evidence.occurrences=[[]];},(v:any)=>{v.counters.packets='x';},
  (v:any)=>{v.framingBoundaryComplete='true';},(v:any)=>{v.evidence.codec=1;},
  (v:any)=>{v.markInventoryAdmission='resolved';},(v:any)=>{v.usage.coverage='invented';},
  (v:any)=>{v.anchors=[{frameIndex:0,keyStart:0,keyEnd:1,lengthStart:1,lengthEnd:2,bodyStart:2,bodyEnd:2,bodyBytes:'0',bodySHA256:'0'.repeat(64)}];},
  (v:any)=>{v.state.sequences=[{sequenceIndex:0,machine:{status:'present',id:'00'},sequenceId:'0',valid:true,epoch:0,defaultsVersionIndex:null}];},
  (v:any)=>{v.evidence.facts=[{kind:'track_descriptor',fields:{uuid:null,parentUuid:null,process:null,thread:null},propertyOrder:['uuid','uuid']}];},
  (v:any)=>{v.evidence.facts=[{kind:'clock_snapshot_layout',primaryTraceClock:null,clocks:[[['timestamp','0']]]}];},
  (v:any)=>{v.evidence.facts=[{kind:'clock_snapshot_layout',primaryTraceClock:null,clocks:[[['timestamp'],['timestamp']]]}];},
  (v:any)=>{v.inputRef.bytes=33554433;},(v:any)=>{v.reason='invented';},
])('exact final schema rejects scalar domain/type and fixed tuple corruption %#', mutate=>{
  const original=createOwnedPaintStudyV12(0,OWNED_PAINT_V12_POLICY).finish();
  const corrupted=structuredClone(original);mutate(corrupted);
  expect(()=>new OwnedPaintBudgetV12().finalizeOutput(corrupted)).toThrow('result-shape');
});
