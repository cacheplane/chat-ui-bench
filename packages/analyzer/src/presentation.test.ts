import { describe, expect, it } from 'vitest';
import { rendererPresentationSchema } from '@chat-ui-bench/contract';
import { parseRendererPresentation } from './presentation.js';
import { loadPresentationFixture, presentationFixtures, presentationIntervalGoldenIndex, type PresentationTraceEvent } from './presentation-fixtures.test-helper.js';

describe('unchanged independent bundled-handler goldens', () => {
  it.each(presentationFixtures)('$name', golden => {
    const trace = loadPresentationFixture(golden);
    const root = trace.traceEvents.find(e => e.name === 'TracingStartedInBrowser')!.args!.data.frames[0];
    const interval = presentationIntervalGoldenIndex.cases.find(c => c.name === golden.name)!;
    // Read from the retained spike identity/context, not inferred from arbitrary PID order.
    const target = { appURL: 'file:///private/tmp/chat-ui-bench-presentation-spike/v3-calibration/fixture.html', frameId: golden.expectedFromActualBundledHandler.mainFrameId };
    expect(root).toMatchObject({ url: target.appURL, frame: target.frameId });
    const result = parseRendererPresentation({ trace, target, phases: [{ phase: 'streaming-auto-follow', instanceId: '0', startMark: 'spike:start', endMark: 'spike:end' }] });
    expect(result.presentation.status).toBe('available');
    if (result.presentation.status !== 'available') throw new Error(result.presentation.reason);
    const phase = result.presentation.value.phases[0]!;
    expect(result.diagnostics!.wholeTracePairCount).toBe(golden.expectedFromActualBundledHandler.animationCount);
    expect(result.diagnostics!.identityMismatches).toBe(0);
    expect(result.diagnostics!.phases[0]!.eligiblePairCount).toBe(interval.eligiblePairs);
    expect(phase.target).toEqual({ frameId: root.frame, pid: golden.expectedPhaseAnalysis.identityChecks.targetPid, tid: interval.targetTid });
    expect(phase.durationUs).toBe(golden.expectedPhaseAnalysis.phase.durationUs);
    expect(phase.rendererVisualUpdateFps.status).toBe('available');
    if (phase.rendererVisualUpdateFps.status !== 'available') throw new Error('Missing FPS');
    expect(phase.rendererVisualUpdateFps.numerator).toBe(golden.expectedPhaseAnalysis.distinctPresentationTimestamps);
    expect(phase.rendererVisualUpdateFps.value).toBeCloseTo(golden.expectedPhaseAnalysis.rendererVisualUpdateFPS, 10);
    expect(phase.presentationIntervals).toMatchObject({ status: 'available', timestampsUs: interval.timestampsUs, intervalsUs: interval.intervalsUs, median: interval.medianUs, p95: interval.p95Us, max: interval.maxUs });
    expect(rendererPresentationSchema.safeParse(result.presentation).success).toBe(true);
  });
});

// Synthetic cases are deliberately separate from authentic positive fixtures.
type E = PresentationTraceEvent;
const event = (name: string, ph: string, ts: number, args: Record<string, any> = {}): E => ({ name, ph, ts, cat: 'blink.user_timing', pid: 10, tid: 20, args });
const begin = (id: string, ts: number): E => ({ ...event('AnimationFrame', 'b', ts, { id, animation_frame_timing_info: { begin_frame_id: { source_id: '18446744073709551615', sequence_number: 1 } } }), id2: { local: '0x1' } });
const end = (ts: number): E => ({ ...event('AnimationFrame', 'e', ts), id2: { local: '0x1' } });
const present = (id: string, ts: number): E => event('AnimationFrame::Presentation', 'n', ts, { id, begin_frame_id: { source_id: '18446744073709551615', sequence_number: 2 } });
function synthetic() {
  return { trace: { traceEvents: [event('TracingStartedInBrowser', 'I', 1, { data: { frames: [{ frame: 'root', url: 'https://app.test/', processId: 10, isInPrimaryMainFrame: true, isOutermostMainFrame: true }] } }), event('thread_name', 'M', 0, { name: 'CrRendererMain' }), event('start', 'I', 100), event('finish', 'I', 200), begin('a', 100), end(110), present('a', 120), begin('b', 140), end(150), present('b', 160)] }, target: { appURL: 'https://app.test/', frameId: 'root' }, phases: [{ phase: 'streaming-auto-follow' as const, instanceId: '0', startMark: 'start', endMark: 'finish' }] };
}
function phase(input = synthetic()) {
  const result = parseRendererPresentation(input);
  if (result.presentation.status !== 'available') throw new Error(result.presentation.reason);
  return result.presentation.value.phases[0]!;
}
describe('synthetic valid reduction cases', () => {
  it('ignores file order and same-named flow events', () => {
    const input = synthetic();
    const expected = parseRendererPresentation(input);
    input.trace.traceEvents.push(event('AnimationFrame', 's', 130), event('AnimationFrame', 'f', 155));
    input.trace.traceEvents.reverse();
    expect(parseRendererPresentation(input)).toEqual(expected);
  });
  it('coalesces different IDs at the same feedback timestamp and accepts unequal begin-frame sequences', () => {
    const input = synthetic(); input.trace.traceEvents[6]!.ts = 160;
    expect(phase(input).rendererVisualUpdateFps).toMatchObject({ status: 'available', numerator: 1, denominatorUs: 100, value: 10000 });
    expect(phase(input).presentationIntervals.status).toBe('unavailable');
  });
  it('preserves valid uint64 decimal string identities', () => {
    expect(phase().rendererVisualUpdateFps.status).toBe('available');
  });
  it('allows rendering end after the phase but excludes feedback at the end boundary', () => {
    const input = synthetic(); input.trace.traceEvents[8]!.ts = 210;
    expect(phase(input).rendererVisualUpdateFps).toMatchObject({ numerator: 2 });
    input.trace.traceEvents[9]!.ts = 200;
    expect(phase(input)).toMatchObject({ boundaryExcludedPairCount: 1, rendererVisualUpdateFps: { numerator: 1 } });
  });
  it.each([[90,120], [100,210], [90,210]])('excludes boundary-spanning pair %s/%s', (start, feedback) => {
    const input = synthetic(); input.trace.traceEvents[4]!.ts = start; input.trace.traceEvents[6]!.ts = feedback;
    expect(phase(input)).toMatchObject({ boundaryExcludedPairCount: 1, rendererVisualUpdateFps: { numerator: 1 } });
  });
  it('does not bridge phase gaps', () => {
    const input = synthetic(); input.trace.traceEvents[3]!.ts = 130;
    input.trace.traceEvents.push(event('start2', 'I', 135), event('finish2', 'I', 190));
    input.phases.push({ phase: 'streaming-auto-follow', instanceId: '1', startMark: 'start2', endMark: 'finish2' });
    const result = parseRendererPresentation(input);
    if (result.presentation.status !== 'available') throw new Error(result.presentation.reason);
    expect(result.presentation.value.phases.map(p => p.presentationIntervals.status)).toEqual(['unavailable', 'unavailable']);
  });
  it('retains valid non-presented pairs without assigning zero FPS', () => {
    const input = synthetic(); input.trace.traceEvents = input.trace.traceEvents.filter(e => e.name !== 'AnimationFrame::Presentation');
    expect(phase(input)).toMatchObject({ nonPresentedPairCount: 2, rendererVisualUpdateFps: { status: 'unavailable' }, presentationIntervals: { status: 'unavailable' } });
  });
  it('does not mutate input or retain mutable output across calls', () => {
    const input = synthetic(), original = structuredClone(input);
    const first = phase(input);
    if (first.rendererVisualUpdateFps.status === 'available') first.rendererVisualUpdateFps.evidence.push('caller mutation');
    expect(input).toEqual(original);
    const second = phase(input);
    expect(JSON.stringify(second)).not.toContain('caller mutation');
  });
  it('joins feedback using string args.id rather than the shared async track', () => {
    const input = synthetic(); input.trace.traceEvents[6]!.args!.id = 'b'; input.trace.traceEvents[9]!.args!.id = 'a';
    // The b feedback is before b begins: pairing by id2 alone would conceal this.
    expect(parseRendererPresentation(input).presentation.status).toBe('unavailable');
  });
  it('reports non-presented and boundary-excluded pairs independently', () => {
    const input = synthetic(); input.trace.traceEvents.splice(9, 1); input.trace.traceEvents[6]!.ts = 200;
    expect(phase(input)).toMatchObject({ nonPresentedPairCount: 1, boundaryExcludedPairCount: 1, rendererVisualUpdateFps: { status: 'unavailable' } });
  });
  it('ignores unrelated animation process events', () => {
    const input = synthetic(), expected = parseRendererPresentation(input);
    input.trace.traceEvents.push({ ...begin('other', 300), pid: 30, tid: 40 }, { ...present('other', 320), pid: 30, tid: 40 });
    expect(parseRendererPresentation(input)).toEqual(expected);
  });
});

const mutations: [string, (events: E[]) => void][] = [
  ['duplicate start', e => e.push(structuredClone(e[4]!))],
  ['duplicate end', e => e.push(structuredClone(e[5]!))],
  ['reused start ID', e => { e[7]!.args!.id = 'a'; }],
  ['exact duplicate presentation', e => e.push(structuredClone(e[6]!))],
  ['conflicting presentation', e => e.push({ ...structuredClone(e[6]!), ts: 125 })],
  ['cross-process presentation', e => { e[6]!.pid = 11; }],
  ['cross-thread presentation', e => { e[6]!.tid = 21; }],
  ['cross-process duplicate target start ID', e => e.push({ ...structuredClone(e[4]!), pid: 11 })],
  ['cross-thread duplicate target start ID', e => e.push({ ...structuredClone(e[4]!), tid: 21 })],
  ['missing start', e => { e.splice(4, 1); }],
  ['missing end', e => { e.splice(5, 1); }],
  ['orphan presentation', e => e.push(present('orphan', 180))],
  ['reversed pair', e => { e[5]!.ts = 99; }],
  ['overlap', e => { e[5]!.ts = 145; }],
  ['nested pair', e => { e[5]!.ts = 155; }],
  ['track mismatch', e => { e[5]!.id2.local = '0x2'; }],
  ['multiple tracks', e => { e[7]!.id2.local = '0x2'; e[8]!.id2.local = '0x2'; }],
  ['missing start ID', e => { delete e[4]!.args!.id; }],
  ['numeric start ID', e => { e[4]!.args!.id = 123; }],
  ['unknown target AnimationFrame phase', e => e.push(event('AnimationFrame', 'x', 170))],
  ['unsafe numeric async track', e => { e[4]!.id2.local = Number.MAX_SAFE_INTEGER + 1; }],
  ['out-of-range async track string', e => { e[4]!.id2.local = '18446744073709551616'; }],
  ['ambiguous async track keys', e => { e[4]!.id2.global = '0x1'; }],
  ['unsafe source ID', e => { e[4]!.args!.animation_frame_timing_info.begin_frame_id.source_id = Number.MAX_SAFE_INTEGER + 1; }],
  ['unsafe feedback sequence', e => { e[6]!.args!.begin_frame_id.sequence_number = Number.MAX_SAFE_INTEGER + 1; }],
  ['out-of-range uint64', e => { e[6]!.args!.begin_frame_id.source_id = '18446744073709551616'; }],
  ['unsafe timestamp', e => { e[6]!.ts = Number.MAX_SAFE_INTEGER + 1; }],
  ['nonfinite timestamp', e => { e[5]!.ts = Infinity; }],
  ['fractional timestamp', e => { e[4]!.ts = 100.5; }],
  ['negative timestamp', e => { e[4]!.ts = -1; }],
  ['feedback before begin', e => { e[6]!.ts = 99; }],
  ['wrong presentation phase', e => { e[6]!.ph = 'I'; }],
  ['duplicate mark', e => e.push(structuredClone(e[2]!))],
  ['missing mark', e => { e.splice(2, 1); }],
  ['reversed marks', e => { e[3]!.ts = 99; }],
  ['unsafe mark', e => { e[2]!.ts = Number.MAX_SAFE_INTEGER + 1; }],
  ['mark on wrong thread', e => { e[2]!.tid = 21; }],
  ['mark outside User Timing category', e => { e[2]!.cat = 'devtools.timeline'; }],
  ['thread metadata wrong phase', e => { e[1]!.ph = 'I'; }],
  ['malformed root flags', e => { e[0]!.args!.data.frames[0].isInPrimaryMainFrame = 'true'; }],
  ['missing thread metadata', e => { e.splice(1, 1); }],
  ['duplicate renderer thread', e => e.push(structuredClone(e[1]!))],
  ['second renderer thread', e => e.push({ ...structuredClone(e[1]!), tid: 21 })],
  ['missing frame metadata', e => { e.splice(0, 1); }],
  ['wrong URL', e => { e[0]!.args!.data.frames[0].url = 'https://wrong.test/'; }],
  ['wrong root identity', e => { e[0]!.args!.data.frames[0].frame = 'wrong'; }],
  ['child frame', e => e[0]!.args!.data.frames.push({ frame: 'child', parent: 'root', processId: 10, url: 'https://child.test/' })],
  ['competing root', e => e[0]!.args!.data.frames.push({ frame: 'other', processId: 10, url: 'https://other.test/' })],
  ['competing root in another process', e => e[0]!.args!.data.frames.push({ frame: 'other', processId: 11, url: 'https://other.test/' })],
  ['non-primary root', e => { e[0]!.args!.data.frames[0].isInPrimaryMainFrame = false; }],
  ['frame committed process migration', e => e.push(event('FrameCommittedInBrowser', 'I', 150, { data: { frame: 'root', processId: 11, url: 'https://app.test/' } }))],
  ['commit load same-URL reload', e => e.push(event('CommitLoad', 'I', 150, { data: { frame: 'root', url: 'https://app.test/' } }))],
  ['navigation start', e => e.push(event('navigationStart', 'R', 150, { frame: 'root', data: { documentLoaderURL: 'https://app.test/', navigationId: 'n' } }))],
  ['frame deletion', e => e.push(event('FrameDeletedInBrowser', 'I', 150, { data: { frame: 'root' } }))],
  ['process ready transition', e => e.push(event('ProcessReadyInBrowser', 'I', 150, { data: { frame: 'root', processId: 11 } }))],
  ['same-document navigation', e => e.push(event('RenderFrameHostImpl::DidCommitSameDocumentNavigation', 'X', 150, { url: 'https://app.test/#new', render_frame_host: { frame_type: 'PRIMARY_MAIN_FRAME' } }))],
];
describe('synthetic malformed/ambiguous mutations fail closed', () => {
  it.each(mutations)('%s', (_name, mutate) => {
    const input = synthetic(); mutate(input.trace.traceEvents);
    expect(parseRendererPresentation(input).presentation).toMatchObject({ status: 'unavailable', reason: expect.any(String) });
  });
  it.each([null, {}, { traceEvents: null }, { traceEvents: [null] }])('rejects unknown trace container %#', trace => {
    expect(parseRendererPresentation({ ...synthetic(), trace }).presentation.status).toBe('unavailable');
  });
  it('rejects overlapping phase instances', () => {
    const input = synthetic(); input.phases.push({ ...input.phases[0]!, instanceId: '1' });
    expect(parseRendererPresentation(input).presentation.status).toBe('unavailable');
  });
  it('rejects absent phases and duplicate phase identities', () => {
    const input = synthetic(); input.phases = [];
    expect(parseRendererPresentation(input).presentation.status).toBe('unavailable');
  });
});
