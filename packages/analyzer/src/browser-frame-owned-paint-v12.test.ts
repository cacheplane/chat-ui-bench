import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { createOwnedPaintStudyV12, OWNED_PAINT_V12_POLICY } from './browser-frame-owned-paint-v12.js';
import {OwnedPaintBudgetV12} from './browser-frame-owned-paint-v12-budget.js';
import { body, join, text, uint } from './browser-frame-packet-fragments.test-helper.js';

// These builders author protobuf source bytes. No decoded record, inventory,
// resolver, budget or adapter substitute crosses the owned study boundary.
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const packet = (...parts: Uint8Array[]) => join(uint(10, 6n), ...parts);
const root = (...packets: Uint8Array[]) => join(...packets.map(p => body(1, p)));
const def = (table: number, iid: bigint, value: string) => body(table, join(uint(1, iid), text(2, value)));
const intern = (...entries: Uint8Array[]) => body(12, join(...entries));
const reset = uint(13, 1n);
const categories = () => [def(1, 1n, 'loading'), def(1, 2n, 'rail'), def(1, 3n, 'devtools.timeline')];
const paintDefs = (name = 'firstMeaningfulPaint', annotation = 'afterUserInput') => intern(
  ...categories(), def(2, 43n, name), def(3, 17n, 'frame'), def(3, 18n, annotation),
);
function paint(variant: 0 | 1 | 2 = 2, frame = 'original-frame') {
  return body(11, join(uint(3, 1n), uint(3, 2n), uint(3, 3n), uint(10, 43n), uint(11, 0n),
    body(4, join(uint(1, 17n), text(variant === 1 ? 8 : 6, variant === 1 ? 'opaque\0é' : frame))),
    body(4, join(uint(1, 18n), variant === 2 ? uint(3, 1n) : text(variant === 1 ? 6 : 11, variant === 1 ? frame : 'opaque\0é'))),
    body(6, uint(2, 82n))));
}
function study(packets: Uint8Array[], split?: number) {
  const bytes = root(...packets), owner = createOwnedPaintStudyV12(bytes.length, OWNED_PAINT_V12_POLICY);
  if (split === undefined) for(let at=0;at<bytes.length;at+=65536) owner.feed(bytes.subarray(at,at+65536));
  else { owner.feed(bytes.subarray(0, split)); owner.feed(bytes.subarray(split)); }
  return owner.finish();
}
function complete(packets: Uint8Array[]) {
  const result = study(packets);
  expect(result.status).toBe('complete-owned-selected-schema');
  return result;
}
function withdrawn(result: ReturnType<typeof study>, reason?: string) {
  expect(result).toMatchObject({ status: 'unavailable', semanticProcessing: 'unavailable',
    markInventoryAdmission: 'not_evaluated', paintInventoryAdmission: 'not_evaluated',
    state: { sequences: [], definitions: [], defaults: [] }, candidates: [], paint: [],
    evidence: { status: 'unavailable', facts: [], occurrences: [] },
    rawDrop: { status: 'unavailable', facts: [] }, usage: { coverage: 'partial' },
    metrics: { FPS: null, rate: null, latency: null, duration: null } });
  if (reason !== undefined) expect(result.reason).toBe(reason);
}
const channels = ['eventName', 'category0', 'category1', 'category2', 'annotation0', 'annotation1'];

test('fixed output counters and usage have no arbitrary or trace-string dictionary keys', () => {
  const result = complete([packet(reset, paintDefs(), paint())]);
  expect(Object.keys(result)).toEqual(['policy', 'status', 'reason', 'inputRef', 'framingBoundaryComplete',
    'semanticProcessing', 'markInventoryAdmission', 'paintInventoryAdmission', 'state', 'evidence', 'rawDrop',
    'sequenceStart', 'candidates', 'paint', 'supportedLegacyFramePresented', 'counters', 'usage', 'manifests',
    'anchors', 'diagnostics', 'authority', 'metrics']);
  expect(Object.keys(result.counters)).toEqual(('packets processedPackets decodedPackets oldPackets paintPackets opaqueNoStatePackets metadataPackets trackEvents ordinaryTrackEvents ordinaryEventsWithAnnotations ordinaryAnnotationEntries ordinaryResolvedRootInventories ordinaryWithheldRootInventories markAbsent markLiteral markWithheld paintMatched paintWithheld paintResolvedReferences paintWithheldReferences resets losses sequenceKeys newDefinitions repeatedDefinitions defaultsVersions disclosures clockSnapshots metadataFacts metadataOccurrences clockChildren rawDropDeclarations explainedRawDropDeclarations unexplainedRawDropDeclarations firstContradictions supportedLegacyFramePresented feedCalls').split(' '));
  const u = result.usage;
  expect(Object.keys(u)).toEqual(['coverage', 'successful', 'reserved', 'cumulative', 'retained', 'current', 'highwater', 'finalOutput']);
  expect(Object.keys(u.successful)).toEqual(('semanticFields semanticMembers routeFields oldCallbackWork repeatedWork references internUpdates resetReleaseVisits sequenceKeys historyDefinitions defaultsVersions metadataFacts metadataOccurrences clockChildren timestampSlots layoutEntrySlots candidateRows paintRows rawDropRows').split(' '));
  expect(Object.keys(u.reserved)).toEqual(['packet', 'state', 'descriptor', 'comparator', 'referenceJSON']);
  const operationKeys = ('calls wireByteReads fieldChargeWork memberChargeWork callbackLocalWork loopRecordWork copyBytes hashBytes utf8DecodeBytes terminalChecks resultRecords diagnosticRecords parserAndOutputScanUnits parsedNodes logicalSlots dynamicUTF16Units comparisonScanUnits structuralWork totalLogicalWork reservedByteBufferOccupancy reservedUTF16Occupancy').split(' ');
  for (const operation of Object.values(u.reserved)) expect(Object.keys(operation)).toEqual(operationKeys);
  expect(Object.keys(u.cumulative)).toEqual(('requestedReadBytes readCalls acknowledgedReadBytes inputCopyBytes inputHashBytes frameCopyBytes frameHashBytes manifestBytes manifestUpdates utf8WidthScanUnits canonicalPreflightNodes canonicalPreflightStringUnits canonicalGeneratedBytes canonicalHashBytes canonicalComparisonBytes fullMetadataRowBytes metadataFactKeyBytes metadataOccurrenceBytes allocatedBufferBytes allocatedUTF16Units allocatedLogicalSlots wrapperWork outputPreflightNodes outputStringUnits outputEncodedBytes outputWriteBytes outputReadbackBytes sourceReadBytes sourceHashBytes runtimeReadBytes runtimeHashBytes closureReservedWork totalLogicalWork').split(' '));
  expect(Object.keys(u.retained)).toEqual(('liveInternEntries liveInternUTF8 liveInternUTF16 historyUTF8 historyUTF16 defaultsUTF8 metadataUTF8 candidateUTF8 paintUTF8 indexKeyUTF8').split(' '));
  for (const role of ['current', 'highwater'] as const) expect(Object.keys(u[role])).toEqual(['bufferBytes', 'utf16Units', 'logicalSlots', 'fixedRecordBytes', 'logicalBytes']);
  expect(Object.keys(u.finalOutput)).toEqual(['nodes', 'objects', 'keys', 'utf8Bytes', 'utf16Units', 'escapedBytes', 'depth']);
  for (const key of ['requestedReadBytes', 'readCalls', 'acknowledgedReadBytes', 'outputWriteBytes', 'outputReadbackBytes', 'sourceReadBytes', 'sourceHashBytes', 'runtimeReadBytes', 'runtimeHashBytes'] as const)
    expect(u.cumulative[key]).toBe(0);
});

test('actual sequence-key capacity accepts128 exact scoped keys then withdraws on129', () => {
  const packets = Array.from({length:128},(_,i)=>uint(10,BigInt(i+1)));
  expect(complete(packets).state.sequences).toHaveLength(128);
  const failed=study([...packets,uint(10,129n)]);withdrawn(failed,'capacity-sequenceKeys');
  expect(failed.counters.sequenceKeys).toBe(128);
});

test('new metadata fact capacity accepts4096 and4097 withdraws every retained row', () => {
  const packets=Array.from({length:4096},(_,i)=>body(60,join(uint(1,0n),uint(5,BigInt(i+1)))));
  const exact=complete(packets);expect(exact.evidence.facts).toHaveLength(4096);
  expect(exact.evidence.occurrences).toHaveLength(4096);
  const failed=study([...packets,body(60,join(uint(1,0n),uint(5,4097n)))]);withdrawn(failed,'capacity-metadataFacts');
  expect(failed.counters.metadataFacts).toBe(4096);
});

test('definition history8192 cannot renew across resets and first excess withdraws history', () => {
  const packets=Array.from({length:16},(_,batch)=>packet(reset,intern(...Array.from({length:512},(_,i)=>def(2,BigInt(i+1),'v'+batch)))));
  const exact=complete(packets);expect(exact.state.definitions).toHaveLength(8192);
  const failed=study([...packets,packet(reset,intern(def(2,1n,'last')))]);withdrawn(failed,'capacity-historyDefinitions');
  expect(failed.counters.newDefinitions).toBe(8192);
});

test('live map2048 first excess refuses before insertion, while reset releases outstanding credits', () => {
  const first=packet(reset,intern(...Array.from({length:1024},(_,i)=>def(2,BigInt(i+1),'v'))));
  const second=packet(intern(...Array.from({length:1024},(_,i)=>def(2,BigInt(i+1025),'v'))));
  expect(complete([first,second]).usage.retained.liveInternEntries).toBe(2048);
  withdrawn(study([first,second,packet(intern(def(2,2049n,'v')))]),'capacity-liveInternEntries');
  const resetResult=complete([first,second,packet(reset,intern(def(2,2049n,'v')))]);
  expect(resetResult.usage.retained.liveInternEntries).toBe(1);
  expect(resetResult.usage.successful.resetReleaseVisits).toBe(2048);
});

test('private original-byte API has no caller-supplied consume seam and carries no metric authority', () => {
  const owner = createOwnedPaintStudyV12(0, OWNED_PAINT_V12_POLICY);
  expect(Object.keys(owner)).toEqual(['feed', 'finish']);
  const result = owner.finish();
  expect(result).toMatchObject({ policy: 'private-owned-whole-ordered-paint-r-v12',
    status: 'complete-owned-selected-schema', reason: null, framingBoundaryComplete: true,
    markInventoryAdmission: 'absent', paintInventoryAdmission: 'absent',
    metrics: { FPS: null, rate: null, latency: null, duration: null },
    authority: { nativeSupported: false, qualificationEligibility: false,
      evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false,
      clock: 'not_evaluated', target: 'not_evaluated', presentation: 'not_evaluated',
      population: 'not_evaluated', inputOrigin: 'not_authenticated' } });
  expect(Object.keys(result.authority)).toHaveLength(10);
  expect(result.inputRef).toEqual({ bytes: 0, sha256: sha(new Uint8Array()) });
  expect(() => owner.finish()).toThrow('stream-closed');
  expect(() => owner.feed(new Uint8Array())).toThrow('stream-closed');
});

test('expected byte extent and policy admit only exact primitive bounded values without caller reflection', () => {
  let traps = 0;
  const hostile = new Proxy({}, { get() { traps++; throw Error('caller'); }, getPrototypeOf() { traps++; throw Error('caller'); } });
  for (const extent of [hostile, '0', null, undefined, NaN, Infinity, -1, 0.5, 33554433])
    expect(() => createOwnedPaintStudyV12(extent as number, OWNED_PAINT_V12_POLICY)).toThrow();
  for (const policy of [hostile, null, undefined, 'other'])
    expect(() => createOwnedPaintStudyV12(0, policy)).toThrow('unsupported-policy');
  expect(traps).toBe(0);
});

test('empty packets still traverse the real adapter and no-state packets do not invent sequences', () => {
  const result = complete([new Uint8Array(), uint(8, 0n), uint(98, 0n)]);
  expect(result.state.sequences).toEqual([]);
  expect(result.counters).toMatchObject({ packets: 3, decodedPackets: 3, oldPackets: 3, opaqueNoStatePackets: 3 });
  expect(result.usage.reserved.packet.calls).toBe(3);
});

test.each([
  [body(11, new Uint8Array()), 'missing-sequence-id'],
  [body(59, new Uint8Array()), 'missing-sequence-id'],
  [body(12, new Uint8Array()), 'missing-sequence-id'],
  [uint(41, 0n), 'missing-sequence-id'], [uint(87, 0n), 'missing-sequence-id'],
  [join(uint(10, 0n), paint()), 'zero-sequence-id'],
] as const)('stateful and explicit-zero sequence headers fail before admission %#', (p, code) => {
  withdrawn(study([p]), code);
});

test('first-on-sequence alone is invalid; reset wins loss and raw declaration stays independently explained', () => {
  const initial = complete([packet(uint(87, 1n), paintDefs(), paint())]);
  expect(initial.state.sequences[0]).toMatchObject({ valid: false, epoch: 0 });
  expect(initial.paintInventoryAdmission).toBe('withheld');
  expect(initial.state.definitions).toEqual([]);
  const result = complete([packet(reset, uint(42, 1n), uint(87, 1n), paintDefs(), paint())]);
  expect(result.sequenceStart).toEqual({ raw: 0, explained: 0, unexplained: 0, contradictions: 0 });
  expect(result.rawDrop.facts[0]).toMatchObject({ priorSeen: false, classification: 'explained',
    headers: { previousPacketDropped: '1', firstPacketOnSequence: true } });
  expect(result.counters).toMatchObject({ rawDropDeclarations: 1, explainedRawDropDeclarations: 1, resets: 1, losses: 0 });
});

test('repeated first-on-sequence is terminal after reset and before malformed defaults', () => {
  const result = study([packet(reset), packet(reset, uint(87, 1n), body(59, Uint8Array.of(128)))]);
  withdrawn(result);
  expect(result.counters).toMatchObject({ resets: 2, firstContradictions: 1 });
  expect(result.usage.reserved.state.calls).toBe(0);
});

test('repeated first-on-sequence contradiction precedes effective-loss start accounting and state helper', () => {
  const result=study([packet(reset),packet(uint(42,1n),uint(87,1n),body(59,Uint8Array.of(128)))]);
  withdrawn(result,'invalid-whole-annotation-input');
  expect(result.sequenceStart).toEqual({raw:0,explained:0,unexplained:0,contradictions:1});
  expect(result.counters.losses).toBe(1);
  expect(result.usage.reserved.state.calls).toBe(0);
});

test('defaults precede intern and event regardless wire order, retaining presence and counter counts', () => {
  const defaults = body(59, join(uint(58, 3n), body(11, join(uint(11, 0n), body(31, Uint8Array.of(1, 2)), body(45, new Uint8Array())))));
  const result = complete([packet(paint(), paintDefs(), defaults, reset)]);
  expect(result.paint[0]).toMatchObject({ context: { defaultsVersionIndex: 0,
    clock: { status: 'selected', source: 'defaults', value: '3', defaultsVersionIndex: 0, reason: null },
    track: { status: 'selected', source: 'event', value: '0', defaultsVersionIndex: null, reason: null } } });
  expect(result.state.defaults[0]).toMatchObject({ timestampClockId: '3', trackEventDefaultsPresent: true,
    trackUuid: '0', counterTrackUuidsPresent: true, counterTrackUuidCount: 2,
    doubleCounterTrackUuidsPresent: true, doubleCounterTrackUuidCount: 0 });
});

test('malformed defaults refuse before intern decode and successful suffix cannot restart semantic work', () => {
  const result = study([packet(reset, paint(), paintDefs(), body(59, Uint8Array.of(128))), packet(reset, paintDefs(), paint())]);
  withdrawn(result, 'fragment-unavailable');
  expect(result.diagnostics[0]).toMatchObject({ component: 'defaults', cause: 'truncated-varint' });
  expect(result.usage.reserved.state.calls).toBe(1);
  expect(result.counters.decodedPackets).toBe(1);
  expect(result.framingBoundaryComplete).toBe(true);
});

test('body-local duplicate IID is validated even in invalid state; identical valid repeats retain one definition', () => {
  const duplicate = intern(def(2, 43n, 'x'), def(2, 43n, 'x'));
  const failed = study([packet(duplicate)]); withdrawn(failed, 'fragment-unavailable');
  expect(failed.diagnostics[0]).toMatchObject({ component: 'interned_names', cause: 'duplicate-intern-iid' });
  const result = complete([packet(reset, paintDefs()), packet(paintDefs(), paint())]);
  expect(result.state.definitions).toHaveLength(6);
  expect(result.counters).toMatchObject({ newDefinitions: 6, repeatedDefinitions: 6 });
  expect(result.paint[0]!.references.every(r => r.definition.source.packetIndex === 0)).toBe(true);
});

test.each([false, true])('IID43 reset chain resolves same-packet name and annotation18 in either physical order (%s)', eventFirst => {
  const before = packet(reset, intern(def(2, 43n, 'LayerTreeHost::WaitForCommitCompletion')));
  const definingEntries = [...categories(), def(2, 43n, 'firstMeaningfulPaint'), def(3, 17n, 'frame'), def(3, 18n, 'afterUserInput')];
  const definingBody = join(...definingEntries), state = body(12, definingBody), event = paint();
  const selected = eventFirst ? [event, state] : [state, event];
  const after = packet(reset, ...selected);
  const result = complete([before, after]);
  expect(result.paintInventoryAdmission).toBe('resolved-supported-source-roots');
  expect(result.markInventoryAdmission).toBe('absent');
  expect(result.paint).toHaveLength(1);
  const row = result.paint[0]!;
  expect(row).toMatchObject({ status: 'matched', domain: 'owned-ordered-paint-r-v12',
    family: 'direct-first-meaningful-paint',
    context: { machine: { status: 'absent', id: null }, sequenceId: '6', sequenceIndex: 0,
      epoch: 2, defaultsVersionIndex: null, source: { packetIndex: 1, packetBytes: after.length, packetSHA256: sha(after) } },
    shape: { variant: 'frame-uint', frame: 'original-frame', afterUserInput: '1', opaque: null,
      legacy: { phase: 82 } }, rule: { ownerPolicy: OWNED_PAINT_V12_POLICY } });
  expect(row.references.map(r => r.channel)).toEqual(channels);
  expect(row.references.map(r => r.iid)).toEqual(['43', '1', '2', '3', '17', '18']);
  expect(row.references.map(r => r.definition.value)).toEqual([
    'firstMeaningfulPaint', 'loading', 'rail', 'devtools.timeline', 'frame', 'afterUserInput',
  ]);
  expect(result.state.definitions[0]).toMatchObject({ value: 'LayerTreeHost::WaitForCommitCompletion', epoch: 1 });
  expect(result.state.definitions).toHaveLength(7);
  const rootBodyStart = body(1, before).length + body(1, after).length - after.length;
  expect(row.context.source.rootBodyStart).toBe(rootBodyStart);
  const stateStart = uint(10, 6n).length + reset.length + (eventFirst ? event.length : 0);
  let definitionStart = stateStart + state.length - definingBody.length;
  const exactDefinitionSpans = definingEntries.map((entry, i) => {
    const inner = join(uint(1, BigInt([1, 2, 3, 43, 17, 18][i]!)), text(2, ['loading', 'rail', 'devtools.timeline', 'firstMeaningfulPaint', 'frame', 'afterUserInput'][i]!));
    const span = { packetIndex: 1, scope: 'interned_data', fieldNumber: [1, 1, 1, 2, 3, 3][i],
      wireType: 2, start: definitionStart, valueStart: definitionStart + entry.length - inner.length, end: definitionStart + entry.length };
    definitionStart += entry.length;
    return span;
  });
  expect(result.state.definitions.slice(1).map(d => d.definedAt)).toEqual(exactDefinitionSpans);
  const eventStart = uint(10, 6n).length + reset.length + (eventFirst ? 0 : state.length);
  expect(row.context.eventLocation.start).toBe(eventStart);
  expect(row.context.eventLocation.end).toBe(eventStart + event.length);
  for (const ref of row.references) {
    const d = ref.definition;
    expect(d).toMatchObject({ sequenceIndex: 0, epoch: 2, source: row.context.source,
      definedAt: { packetIndex: 1 } });
    expect(d.definedAt.start).toBeGreaterThanOrEqual(0);
    expect(d.definedAt.end).toBeLessThanOrEqual(after.length);
    expect(ref.location).toMatchObject({ packetIndex: 1, scope: 'track_event', wireType: 0 });
    expect(ref.location.start).toBeGreaterThanOrEqual(row.context.eventLocation.valueStart);
    expect(ref.location.end).toBeLessThanOrEqual(row.context.eventLocation.end);
    expect(after.subarray(ref.location.start, ref.location.end)).toEqual(uint(
      ref.channel === 'eventName' ? 10 : ref.channel.startsWith('category') ? 3 : 1, BigInt(ref.iid)));
    expect(result.state.definitions[d.definitionIndex]).toMatchObject({ iid: ref.iid,
      table: d.table, value: d.value, source: d.source, definedAt: d.definedAt });
  }
  expect(row.references.map(r => r.definition.table)).toEqual([
    'event_names', 'event_categories', 'event_categories', 'event_categories', 'debug_annotation_names', 'debug_annotation_names',
  ]);
  expect(result.counters).toMatchObject({ resets: 2, paintPackets: 1, paintMatched: 1,
    paintResolvedReferences: 6, ordinaryTrackEvents: 0, markAbsent: 0, markLiteral: 0,
    markWithheld: 0, supportedLegacyFramePresented: 0 });
  expect(result.usage.reserved.comparator.calls).toBe(1);
});

test('all source-supported paint variants use original opaque bytes and retain exact shape commitments', () => {
  for (const variant of [0, 1, 2] as const) {
    const name = variant === 1 ? 'largestContentfulPaint::Candidate' : 'firstMeaningfulPaint';
    const annotations = variant === 1 ? ['data', 'frame'] : ['frame', variant === 2 ? 'afterUserInput' : 'data'];
    const p = packet(reset, intern(...categories(), def(2, 43n, name),
      def(3, 17n, annotations[0]!), def(3, 18n, annotations[1]!)), paint(variant, '\uFEFFframe\0é'));
    const result = complete([p]), row = result.paint[0]!;
    expect(row.status).toBe('matched');
    expect(row.shape.frame).toBe('\uFEFFframe\0é');
    if (variant === 2) expect(row.shape.opaque).toBeNull();
    else {
      const opaque = row.shape.opaque!;
      expect(opaque.sha256).toBe(sha(p.subarray(opaque.location.valueStart, opaque.location.end)));
      expect(opaque.bytes).toBe(opaque.location.end - opaque.location.valueStart);
      expect(row.shape.afterUserInput).toBeNull();
    }
  }
});

test.each([0, 1, 2, 3, 4, 5])('missing channel %s stays withheld even when a future packet defines it', missing => {
  const entries = [def(2, 43n, 'firstMeaningfulPaint'), ...categories(), def(3, 17n, 'frame'), def(3, 18n, 'afterUserInput')];
  const result = complete([packet(reset, intern(...entries.filter((_, i) => i !== missing)), paint()),
    packet(intern(entries[missing]!))]);
  expect(result.paintInventoryAdmission).toBe('withheld');
  expect(result.paint).toHaveLength(1);
  expect(result.paint[0]).toMatchObject({ status: 'withheld', family: null });
  const refs = result.paint[0]!.references;
  expect(refs.map(r => r.channel)).toEqual(channels);
  expect(refs[missing]).toMatchObject({ status: 'withheld', definition: null, reason: 'missing-definition' });
  expect(result.usage.reserved.comparator.calls).toBe(0);
  expect(result.counters).toMatchObject({ paintMatched: 0, paintWithheld: 1, paintResolvedReferences: 5, paintWithheldReferences: 1 });
});

test('same IID on another sequence, another machine or before reset cannot resolve source roots', () => {
  const initial = packet(reset, paintDefs());
  for (const later of [join(uint(10, 7n), reset, paint()), packet(uint(98, 0n), reset, paint()), packet(reset, paint())]) {
    const result = complete([initial, later]);
    expect(result.paintInventoryAdmission).toBe('withheld');
    expect(result.paint[0]).toMatchObject({ status: 'withheld', family: null });
    expect(result.paint[0]!.references.every(r => 'status' in r && r.status === 'withheld')).toBe(true);
  }
});

test('loss with incremental dependency withholds all six refs and reset never repairs earlier paint', () => {
  const result = complete([packet(reset, paintDefs()), packet(uint(42, 1n), uint(13, 2n), paint()), packet(reset, paintDefs())]);
  expect(result.paintInventoryAdmission).toBe('withheld');
  expect(result.paint[0]!.references.every(r => 'reason' in r && r.reason === 'incremental-dependency')).toBe(true);
  expect(result.counters).toMatchObject({ losses: 1, resets: 2, paintMatched: 0, paintWithheld: 1 });
});

test.each(['wrong-event', 'wrong-category', 'wrong-annotation'])('resolved comparator mismatch %s withdraws the entire successful prefix', kind => {
  const bad = intern(def(2, 43n, kind === 'wrong-event' ? 'FramePresented' : 'firstMeaningfulPaint'),
    def(1, 1n, kind === 'wrong-category' ? 'cc' : 'loading'), def(1, 2n, 'rail'), def(1, 3n, 'devtools.timeline'),
    def(3, 17n, 'frame'), def(3, 18n, kind === 'wrong-annotation' ? 'data' : 'afterUserInput'));
  const result = study([packet(reset, paintDefs(), paint()), packet(reset, bad, paint()), packet(reset, paintDefs(), paint())]);
  withdrawn(result);
  expect(result.framingBoundaryComplete).toBe(true);
  expect(result.counters.packets).toBe(3);
  expect(result.counters.paintMatched).toBe(1);
  expect(result.counters.decodedPackets).toBe(2);
  expect(result.usage.successful.paintRows).toBe(1);
});

test('failed live insertion does not report a successful history row',()=>{
  const packets=[packet(reset,intern(...Array.from({length:1024},(_,i)=>def(2,BigInt(i+1),'v')))),packet(intern(...Array.from({length:1024},(_,i)=>def(2,BigInt(i+1025),'v')))),packet(intern(def(2,2049n,'v')))];
  const result=study(packets);withdrawn(result,'capacity-liveInternEntries');
  expect(result.usage.successful.historyDefinitions).toBe(2048);
});

test('candidate UTF8 first excess does not count the refused row as successfully created',()=>{
  const event=body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'m'.repeat(4096))));
  const result=study(Array.from({length:20},(_,i)=>packet(...(i===0?[reset]:[]),event)));
  withdrawn(result,'capacity-candidateUTF8');
  expect(result.usage.successful.candidateRows).toBe(result.counters.markLiteral!-1);
});

test.each([
  (v:any)=>{v.paint[0].context.source=null;},(v:any)=>{v.state.definitions[0].definitionIndex=null;},
  (v:any)=>{v.state.definitions[0].value=null;},(v:any)=>{v.state.definitions[0].source=null;},
  (v:any)=>{v.paint[0].references[0].definition.source=null;},(v:any)=>{v.paint[0].references[0].definition.definedAt.packetIndex=null;},
])('final output nullability belongs to exact roles, not shared leaf names %#',mutate=>{
  const original=complete([packet(reset,paintDefs(),paint())]),corrupted=structuredClone(original);mutate(corrupted);
  expect(()=>new OwnedPaintBudgetV12().finalizeOutput(corrupted)).toThrow('result-shape');
});

test('late intern conflict withdraws retained history, defaults, metadata and paint while draining hashes', () => {
  const p = packet(reset, paintDefs(), body(59, uint(58, 3n)), paint());
  const bytes = root(p, packet(intern(def(2, 43n, 'changed'))), packet(paint()));
  const owner = createOwnedPaintStudyV12(bytes.length, OWNED_PAINT_V12_POLICY);
  for (let at = 0; at < bytes.length; at += 7) owner.feed(bytes.subarray(at, at + 7));
  const result = owner.finish();
  withdrawn(result, 'intern-conflict');
  expect(result.inputRef).toEqual({ bytes: bytes.length, sha256: sha(bytes) });
  expect(result.framingBoundaryComplete).toBe(true);
});

test('all root key, length and body chunk splits preserve original identities and rows', () => {
  const packets = [packet(reset, paintDefs(), paint())], bytes = root(...packets), baseline = study(packets);
  for (let split = 0; split <= bytes.length; split++) {
    const result = study(packets, split);
    expect(result.status).toBe('complete-owned-selected-schema');
    expect(result.manifests).toEqual(baseline.manifests);
    expect(result.paint).toEqual(baseline.paint);
    expect(result.state).toEqual(baseline.state);
    expect(result.anchors).toEqual(baseline.anchors);
    expect(result.inputRef).toEqual(baseline.inputRef);
  }
});

test('hostile, shared, detached, subclass and oversized chunks deny before input ownership', () => {
  let traps = 0;
  const proxy = new Proxy(new Uint8Array(), { get() { traps++; throw Error('caller'); }, getPrototypeOf() { traps++; throw Error('caller'); } });
  const detached = new Uint8Array(1); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const input of [proxy, new Uint8Array(new SharedArrayBuffer(0)), detached, new (class extends Uint8Array {})(), new Uint8Array(65537)]) {
    const owner = createOwnedPaintStudyV12(65537, OWNED_PAINT_V12_POLICY); owner.feed(input);
    const result = owner.finish(); withdrawn(result); expect(result.inputRef.bytes).toBe(0);
  }
  expect(traps).toBe(0);
});

test('instance getters never replace intrinsic byte access and owned bytes survive caller mutation', () => {
  const bytes = root(packet(reset, paintDefs(), paint()));
  const owner = createOwnedPaintStudyV12(bytes.length, OWNED_PAINT_V12_POLICY);
  let traps = 0; const trap = () => { traps++; throw Error('caller'); };
  Object.defineProperties(bytes, { length: { get: trap }, byteLength: { get: trap }, buffer: { get: trap }, [Symbol.iterator]: { value: trap } });
  owner.feed(bytes); bytes.fill(0);
  const result = owner.finish(); expect(result.status).toBe('complete-owned-selected-schema');
  expect(result.paint[0]!.shape.frame).toBe('original-frame'); expect(traps).toBe(0);
});

test('truncated root suffix withdraws an earlier matched paint and never admits a prefix', () => {
  const bytes = join(root(packet(reset, paintDefs(), paint())), Uint8Array.of(10, 128));
  const owner = createOwnedPaintStudyV12(bytes.length, OWNED_PAINT_V12_POLICY); owner.feed(bytes);
  const result = owner.finish(); withdrawn(result); expect(result.framingBoundaryComplete).toBe(false);
});

test('ordinary unresolved roots latch mark withholding before absent selection; paint cannot change it', () => {
  for (const type of [1n, 3n]) {
    const ordinary = body(11, join(uint(9, type), text(23, 'ordinary'), text(22, 'other'),
      body(4, join(uint(1, 999n), text(6, 'x')))));
    const result = complete([packet(reset, paintDefs(), paint()), packet(ordinary), packet(paint())]);
    expect(result.markInventoryAdmission).toBe('withheld');
    expect(result.paintInventoryAdmission).toBe('resolved-supported-source-roots');
    expect(result.candidates).toEqual([]);
    expect(result.counters).toMatchObject({ ordinaryTrackEvents: 1, ordinaryWithheldRootInventories: 1,
      markAbsent: 1, markLiteral: 0, markWithheld: 0, paintMatched: 2 });
  }
});

test('duplicate ordinary root spelling also latches withholding for a non-blink event', () => {
  const event = body(11, join(uint(9, 3n), text(23, 'ordinary'), text(22, 'other'),
    body(4, join(text(10, 'same'), text(6, 'a'))), body(4, join(text(10, 'same'), text(6, 'b')))));
  const result = complete([packet(reset, event)]);
  expect(result.markInventoryAdmission).toBe('withheld');
  expect(result.counters).toMatchObject({ markAbsent: 1, markWithheld: 0, ordinaryWithheldRootInventories: 1 });
});

test('mixed literal modern mark, legacy FramePresented and paint retain distinct populations', () => {
  const mark = body(11, join(uint(9, 3n), text(22, 'blink.user_timing'), text(23, 'literal-mark')));
  const presented = body(11, join(uint(3, 4n), uint(3, 5n), uint(10, 44n), uint(11, 0n),
    body(4, join(uint(1, 19n), text(6, 'browser'))), body(6, uint(2, 82n))));
  const definitions = intern(...categories(), def(1, 4n, 'cc'), def(1, 5n, 'benchmark'),
    def(2, 43n, 'firstMeaningfulPaint'), def(2, 44n, 'FramePresented'),
    def(3, 17n, 'frame'), def(3, 18n, 'afterUserInput'), def(3, 19n, 'environment'));
  const result = complete([packet(reset, definitions, mark), packet(presented), packet(paint())]);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({ kind: 'literal_string', representation: 'event_name', value: 'literal-mark' });
  expect(result.supportedLegacyFramePresented).toBe(1);
  expect(result.counters).toMatchObject({ trackEvents: 3, ordinaryTrackEvents: 2, ordinaryEventsWithAnnotations: 1,
    ordinaryAnnotationEntries: 1, ordinaryResolvedRootInventories: 2, markAbsent: 1, markLiteral: 1,
    markWithheld: 0, paintMatched: 1, supportedLegacyFramePresented: 1 });
  expect(result.metrics).toEqual({ FPS: null, rate: null, latency: null, duration: null });
});

test('annotation representation retains annotation-name provenance independently of performance.mark name', () => {
  for (const internName of [false, true]) {
    const event = body(11, join(uint(9, 3n), text(22, 'blink.user_timing'), uint(10, 43n),
      body(4, join(internName ? uint(1, 18n) : text(10, 'markName'), text(6, 'selected-mark')))));
    const result = complete([packet(reset, intern(def(2, 43n, 'performance.mark'), def(3, 18n, 'markName')), event)]);
    expect(result.candidates[0]).toMatchObject({representation: 'annotation', value: 'selected-mark',
      nameSource: internName ? 'intern' : 'literal', definitionIndex: internName ? 1 : null});
  }
});

test('ordinary annotation lookup charges its facade reference once and paint charges six separate references', () => {
  const ordinary=body(11,join(uint(9,1n),text(22,'other'),text(23,'ordinary'),body(4,join(uint(1,17n),text(6,'x')))));
  const result=complete([packet(reset,paintDefs(),ordinary),packet(paint())]);
  expect(result.usage.successful.references).toBe(7);
  expect(result.counters.paintResolvedReferences).toBe(6);
});

test('final usage includes finalization and every retained output record is deeply frozen', () => {
  const result = complete([packet(reset, paintDefs(), paint())]);
  expect(result.usage.finalOutput.escapedBytes).toBe(Buffer.byteLength(JSON.stringify(result)));
  expect(result.usage.finalOutput.nodes).toBeGreaterThan(0);
  expect(result.usage.cumulative.outputPreflightNodes).toBeGreaterThan(0);
  expect(result.usage.cumulative.outputEncodedBytes).toBeGreaterThan(0);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.paint)).toBe(true);
  expect(Object.isFrozen(result.paint[0]!.references[0]!.definition!.source)).toBe(true);
  expect(Object.isFrozen(result.usage.reserved.packet)).toBe(true);
});

test('codec2 shares clock layout across timestamps but preserves zero/false and selected order', () => {
  const clock = (timestamp: bigint, reverse = false) => body(6, join(uint(2, 0n), body(1, join(
    ...(reverse ? [uint(2, timestamp), uint(1, 64n)] : [uint(1, 64n), uint(2, timestamp)]), uint(3, 0n), uint(4, 0n)))));
  const result = complete([clock(0n), clock(9007199254740993n), clock(1n, true)]);
  expect(result.evidence).toMatchObject({ status: 'complete-supported-compact-observations', codec: 2,
    domain: 'owned-paint-clock-layout-v12' });
  expect(result.evidence.facts).toHaveLength(2);
  expect(result.evidence.facts[0]).toEqual({ kind: 'clock_snapshot_layout', primaryTraceClock: '0',
    clocks: [[['clockId', '64'], ['timestamp'], ['isIncremental', false], ['unitMultiplierNs', '0']]] });
  expect(result.evidence.occurrences.map(o => o[0])).toEqual([0, 0, 1]);
  expect(result.evidence.occurrences.map(o => o[6])).toEqual([['0'], ['9007199254740993'], ['1']]);
  expect(result.evidence.occurrences.every(o => o[3] === null)).toBe(true);
});

test('metadata pays exact original selected full observation even though output uses compact layout', () => {
  const p=body(6,join(uint(2,0n),body(1,join(uint(1,64n),uint(2,7n),uint(3,0n)))));
  const result=complete([p]);
  const row={packetIndex:0,bodySha256:sha(p),machineContext:{status:'absent'},sequenceContext:{status:'absent'},
    packetFields:{},location:{packetIndex:0,scope:'packet',fieldNumber:6,wireType:2,start:0,valueStart:2,end:p.length},
    kind:'clock_snapshot',primaryTraceClock:'0',clocks:[{clockId:'64',timestamp:'7',isIncremental:false}]};
  expect(result.usage.cumulative.fullMetadataRowBytes).toBe(Buffer.byteLength(JSON.stringify(row)));
});

test('codec2 preserves signed primary clock enum without normalizing it into an unsigned identifier',()=>{
  const result=complete([body(6,uint(2,18446744073709551615n))]);
  expect(result.evidence.facts[0]).toMatchObject({kind:'clock_snapshot_layout',primaryTraceClock:'-1',clocks:[]});
});

test('descriptor codec retains selected presence and root/child insertion order', () => {
  const a = body(60, join(uint(1, 1n), body(3, join(uint(1, 0n), uint(7, 0n)))));
  const b = body(60, join(body(3, join(uint(7, 0n), uint(1, 0n))), uint(1, 1n)));
  const result = complete([a, a, b, body(60, body(4, new Uint8Array()))]);
  expect(result.evidence.facts).toHaveLength(3);
  expect(result.evidence.facts[0]).toEqual({ kind: 'track_descriptor',
    fields: { uuid: '1', parentUuid: null, process: { pid: '0', startTimestampNs: '0' }, thread: null },
    propertyOrder: ['uuid', 'process', 'process.pid', 'process.startTimestampNs'] });
  expect(result.evidence.facts[1]).toHaveProperty('propertyOrder', ['process', 'process.startTimestampNs', 'process.pid', 'uuid']);
  expect(result.evidence.occurrences.map(o => o[0])).toEqual([0, 0, 1, 2]);
  expect(result.evidence.occurrences.every(o => o[6] === null)).toBe(true);
  expect(result.usage.successful.semanticMembers).toBe(4);
});

test.each([
  [new Uint8Array(), 0], [body(3, new Uint8Array()), 1], [body(4, new Uint8Array()), 1],
  [join(body(3, new Uint8Array()), body(4, new Uint8Array())), 2],
  [body(3, uint(1, 1n)), 1], [body(4, join(uint(1, 1n), uint(2, 2n))), 1],
] as const)('descriptor successful selected-child members are charged from original bytes %#', (descriptor, members) => {
  const result = complete([body(60, descriptor)]);
  expect(result.usage.successful.semanticMembers).toBe(members);
  expect(result.usage.reserved.descriptor.calls).toBe(1);
  expect(result.usage.reserved.descriptor.memberChargeWork).toBe(Math.min(2, descriptor.length));
});

test.each([
  body(3, Uint8Array.of(128)), body(4, Uint8Array.of(128)), Uint8Array.of(26, 2, 8),
  uint(3, 0n), uint(4, 0n), join(body(3, new Uint8Array()), body(3, new Uint8Array())),
  join(body(4, new Uint8Array()), body(4, new Uint8Array())),
  join(body(3, uint(1, 1n)), body(4, Uint8Array.of(128))),
  join(body(4, uint(1, 1n)), body(3, Uint8Array.of(128))),
])('descriptor helper refusal retains prepaid reservation but invents no successful members %#', descriptor => {
  const result = study([body(60, descriptor)]); withdrawn(result);
  expect(result.usage.successful.semanticMembers).toBe(0);
  expect(result.usage.reserved.descriptor.calls).toBe(1);
  expect(result.usage.reserved.descriptor.memberChargeWork).toBe(Math.min(2, descriptor.length));
});
