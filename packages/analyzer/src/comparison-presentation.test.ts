import { describe, expect, it } from 'vitest';
import { comparisonPhaseMarks, comparisonRendererPresentationSchema, comparisonScoredPresentationPhaseSchema } from '@chat-ui-bench/contract';
import { parseComparisonRendererPresentation, type ComparisonRendererPresentationInput } from './comparison-presentation.js';
import { loadPresentationFixture, presentationFixtures, presentationIntervalGoldenIndex } from './presentation-fixtures.test-helper.js';
import { parseRendererPresentation } from './presentation.js';
import {admitPresentationNumericSlots} from './presentation-core.js';
import {StreamedTraceAdmission} from './comparison-trace-stream.js';

describe('streamed numeric preallocation boundary', () => {
  it('admits exact43690 aggregate slots and rejects next slot before allocation', () => {
    expect(admitPresentationNumericSlots(1, 21845)).toBe(43690);
    expect(() => admitPresentationNumericSlots(2, 21845)).toThrow(/numeric slots/);
  });
  it.each([-1, NaN, Infinity, 1.5])('rejects invalid prior or delivery cardinality%s', value => {
    expect(() => admitPresentationNumericSlots(value, 1)).toThrow();
    expect(() => admitPresentationNumericSlots(0, value)).toThrow();
  });
});

const phases = comparisonScoredPresentationPhaseSchema.options;
function authentic(index = 0, phase = phases[0]!): ComparisonRendererPresentationInput {
  const golden = presentationFixtures[index]!;
  const trace = loadPresentationFixture(golden);
  const marks = comparisonPhaseMarks(phase, '0');
  for (const e of trace.traceEvents) {
    if (e.name === 'spike:start') e.name = marks.startMark;
    if (e.name === 'spike:end') e.name = marks.endMark;
  }
  return {trace, target: {appURL: 'file:///private/tmp/chat-ui-bench-presentation-spike/v3-calibration/fixture.html', frameId: golden.expectedFromActualBundledHandler.mainFrameId}, phases: [{phase, instanceId: '0', ...marks}], evidencePaths: ['trace.json']};
}
function available(input = authentic()) {
  const result = parseComparisonRendererPresentation(input);
  if (result.presentation.status !== 'available') throw new Error(result.presentation.reason);
  expect(comparisonRendererPresentationSchema.safeParse(result.presentation).success).toBe(true);
  return result;
}
describe('comparison wrapper authentic independently recorded fields', () => {
  for (const [i, golden] of presentationFixtures.entries()) it.each(phases)(`${golden.name}: %s`, phase => {
    const input = authentic(i, phase), result = available(input);
    if (result.presentation.status !== 'available') throw new Error('unavailable');
    const p = result.presentation.value.phases[0]!, interval = presentationIntervalGoldenIndex.cases.find(c => c.name === golden.name)!;
    expect(p).toMatchObject({...golden.expectedPhaseAnalysis.phase, target: {frameId: input.target.frameId, pid: golden.expectedPhaseAnalysis.identityChecks.targetPid, tid: interval.targetTid}});
    expect(result.diagnostics).toMatchObject({wholeTracePairCount: golden.expectedFromActualBundledHandler.animationCount, identityMismatches: 0, phases: [{phase, instanceId: '0', eligiblePairCount: interval.eligiblePairs, distinctDeliveryCount: interval.distinctDeliveries}]});
    expect(p.rendererVisualUpdateFps).toMatchObject({status: 'available', numerator: interval.distinctDeliveries, denominatorUs: p.durationUs, evidence: ['trace.json']});
    if (p.rendererVisualUpdateFps.status === 'available') expect(p.rendererVisualUpdateFps.value).toBeCloseTo(golden.expectedPhaseAnalysis.rendererVisualUpdateFPS, 10);
    expect(p.presentationIntervals).toMatchObject({status: 'available', timestampsUs: interval.timestampsUs, intervalsUs: interval.intervalsUs, median: interval.medianUs, p95: interval.p95Us, max: interval.maxUs});
    // Remaining diagnostics/exclusions parity is a legacy production baseline, not independent oracle fields.
    const legacy = parseRendererPresentation({...input, phases: [{...input.phases[0]!, phase: 'streaming-auto-follow'}]});
    expect(result.diagnostics).toEqual({...legacy.diagnostics, phases: legacy.diagnostics!.phases.map(p => ({...p, phase}))});
    if (legacy.presentation.status !== 'available') throw new Error('legacy unavailable');
    expect(p.boundaryExcludedPairCount).toBe(legacy.presentation.value.phases[0]!.boundaryExcludedPairCount);
    expect(p.nonPresentedPairCount).toBe(legacy.presentation.value.phases[0]!.nonPresentedPairCount);
  });
});
describe('comparison strict wrapper', () => {
  it.each(['', 'unknown', 'setup', 'validation', 'disposal', 'streaming-auto-follow', 'gesture-scroll', 'return-to-bottom'])('rejects %s without partial numbers', phase => {
    const input = authentic(); Object.assign(input.phases[0]!, {phase});
    expect(parseComparisonRendererPresentation(input)).toEqual({presentation: {status: 'unavailable', reason: expect.any(String)}});
  });
  it.each([[], ['../trace.json'], ['/trace.json'], ['trace.json', 'bad path']].map(evidencePaths => ({evidencePaths})))('rejects absent/unsafe evidence %#', ({evidencePaths}) => {
    expect(parseComparisonRendererPresentation({...authentic(), evidencePaths}).presentation.status).toBe('unavailable');
  });
  it('rejects wrong marks and unknown phase fields', () => {
    const input = authentic(); input.phases[0]!.startMark = 'spike:start';
    expect(parseComparisonRendererPresentation(input).presentation.status).toBe('unavailable');
    const extra = authentic(); Object.assign(extra.phases[0]!, {extra: true});
    expect(parseComparisonRendererPresentation(extra).presentation.status).toBe('unavailable');
  });
  it('does not mutate source or retain output across calls', () => {
    const input = authentic(), before = structuredClone(input), first = available(input);
    if (first.presentation.status === 'available') first.presentation.value.phases[0]!.target.pid = 99;
    expect(input).toEqual(before);
    expect(available(input)).not.toEqual(first);
  });
  it('fails whole-trace corruption outside scored phases', () => {
    const input = authentic(), trace = input.trace as ReturnType<typeof loadPresentationFixture>;
    const start = trace.traceEvents.find(e => e.name === 'AnimationFrame' && e.ph === 'b')!;
    trace.traceEvents.push({...structuredClone(start), ts: 1});
    expect(parseComparisonRendererPresentation(input).presentation.status).toBe('unavailable');
  });
});

function syntheticComparison() {
  const marks = comparisonPhaseMarks('streaming-follow', '0');
  const event = (name: string, ph: string, ts: number, args: Record<string, any> = {}) => ({name, ph, ts, pid: 10, tid: 20, cat: 'blink.user_timing', args, id2: {local: '0x1'}});
  return {trace: {traceEvents: [event('TracingStartedInBrowser', 'I', 1, {data: {frames: [{frame: 'root', url: 'https://app.test/', processId: 10}]}}), event('thread_name', 'M', 0, {name: 'CrRendererMain'}), event(marks.startMark, 'I', 100), event(marks.endMark, 'I', 200), event('AnimationFrame', 'b', 100, {id: 'a'}), event('AnimationFrame', 'e', 110), event('AnimationFrame::Presentation', 'n', 120, {id: 'a'}), event('AnimationFrame', 'b', 140, {id: 'b'}), event('AnimationFrame', 'e', 150), event('AnimationFrame::Presentation', 'n', 160, {id: 'b'})]}, target: {appURL: 'https://app.test/', frameId: 'root'}, phases: [{phase: 'streaming-follow' as const, instanceId: '0', ...marks}], evidencePaths: ['trace.json']};
}
type Synthetic = ReturnType<typeof syntheticComparison>;
function firstSynthetic(input = syntheticComparison()) {
  const result = available(input);
  if (result.presentation.status !== 'available') throw new Error('Unavailable');
  return result.presentation.value.phases[0]!;
}
describe('comparison boundary and whole-trace safety', () => {
  it('retains repeated instances, gaps, and original order without pooled intervals', () => {
    const input = syntheticComparison(); input.trace.traceEvents[3]!.ts = 130;
    const marks = comparisonPhaseMarks('streaming-follow', '1');
    input.trace.traceEvents.push({...input.trace.traceEvents[2]!, name: marks.startMark, ts: 135}, {...input.trace.traceEvents[3]!, name: marks.endMark, ts: 190});
    input.phases.push({phase: 'streaming-follow', instanceId: '1', ...marks});
    const result = available(input);
    if (result.presentation.status !== 'available') throw new Error('Unavailable');
    expect(result.presentation.value.phases.map(p => [p.instanceId, p.rendererVisualUpdateFps, p.presentationIntervals.status])).toMatchObject([['0', {numerator: 1, denominatorUs: 30}, 'unavailable'], ['1', {numerator: 1, denominatorUs: 55}, 'unavailable']]);
    input.phases.reverse();
    expect(parseComparisonRendererPresentation(input).presentation.status).toBe('unavailable'); // strict v2 requires chronological original order
  });
  it('coalesces feedback and never fabricates empty feedback zero', () => {
    const input = syntheticComparison(); input.trace.traceEvents[6]!.ts = 160;
    expect(firstSynthetic(input)).toMatchObject({rendererVisualUpdateFps: {numerator: 1, value: 10000}, presentationIntervals: {status: 'unavailable'}});
    input.trace.traceEvents = input.trace.traceEvents.filter(e => e.name !== 'AnimationFrame::Presentation');
    expect(firstSynthetic(input)).toMatchObject({nonPresentedPairCount: 2, rendererVisualUpdateFps: {status: 'unavailable'}});
  });
  it('allows end after phase and excludes feedback exactly at exclusive end', () => {
    const input = syntheticComparison(); input.trace.traceEvents[8]!.ts = 210;
    expect(firstSynthetic(input).rendererVisualUpdateFps).toMatchObject({numerator: 2});
    input.trace.traceEvents[9]!.ts = 200;
    expect(firstSynthetic(input)).toMatchObject({boundaryExcludedPairCount: 1, rendererVisualUpdateFps: {numerator: 1}});
  });
  const mutations: [string, (input: Synthetic) => void][] = [
    ['missing mark', i => {i.trace.traceEvents.splice(2, 1);}],
    ['duplicate mark', i => {i.trace.traceEvents.push(structuredClone(i.trace.traceEvents[2]!));}],
    ['wrong-thread mark', i => {i.trace.traceEvents[2]!.tid = 21;}],
    ['non-User-Timing mark', i => {i.trace.traceEvents[2]!.cat = 'other';}],
    ['duplicate identity', i => {i.phases.push({...i.phases[0]!});}],
    ['overlap', i => {const marks = comparisonPhaseMarks('streaming-follow', '1'); i.phases.push({phase: 'streaming-follow', instanceId: '1', ...marks}); i.trace.traceEvents.push({...i.trace.traceEvents[2]!, name: marks.startMark}, {...i.trace.traceEvents[3]!, name: marks.endMark});}],
    ['unsafe uint64', i => {i.trace.traceEvents[6]!.args.begin_frame_id = {source_id: '18446744073709551616', sequence_number: 1};}],
    ['exact ID mismatch', i => {i.trace.traceEvents[6]!.args.id = 'b'; i.trace.traceEvents[9]!.args.id = 'a';}],
    ['orphan feedback', i => {i.trace.traceEvents[6]!.args.id = 'orphan';}],
    ['incomplete whole trace', i => {i.trace.traceEvents.splice(5, 1);}],
    ['target mismatch', i => {i.target.frameId = 'other';}],
    ['cross-thread reuse', i => {i.trace.traceEvents.push({...structuredClone(i.trace.traceEvents[4]!), tid: 21});}],
    ['missing evidence', i => {Reflect.deleteProperty(i, 'evidencePaths');}],
  ];
  it.each(mutations)('rejects %s without partial scored output', (_name, mutate) => {
    const input = syntheticComparison(); mutate(input);
    expect(parseComparisonRendererPresentation(input)).toEqual({presentation: {status: 'unavailable', reason: expect.any(String)}});
  });
  it.each(mutations)('streamed selector preserves original %s rejection', (_name, mutate) => {
    const canonical = syntheticComparison();
    expect(parseComparisonRendererPresentation(canonical).presentation.status).toBe('available');
    const input = syntheticComparison(); mutate(input);
    const legacy = parseComparisonRendererPresentation(input), scanner = new StreamedTraceAdmission(), bytes = Buffer.from(JSON.stringify(input.trace));
    try {
      for (let offset = 0; offset < bytes.length; offset += 65536) scanner.feed(bytes.subarray(offset, offset + 65536)); scanner.finish();
      expect(parseComparisonRendererPresentation({...input, trace: scanner.trace()}, 'streamed-renderer-events-v1')).toEqual(legacy);
    } finally {scanner.dispose();}
  });
});
