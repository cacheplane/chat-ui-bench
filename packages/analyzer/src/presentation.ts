import { phaseInstanceIdSchema, scoredPresentationPhaseSchema, type PresentationPhaseInput, type RendererPresentation, type RendererPresentationPhase } from '@chat-ui-bench/contract';

export interface RendererPresentationInput {
  trace: unknown;
  target: { appURL: string; frameId: string };
  phases: PresentationPhaseInput[];
}
export interface PresentationPairDiagnostics {
  wholeTracePairCount: number;
  wholeTraceNonPresentedPairCount: number;
  identityMismatches: number;
  phases: { phase: PresentationPhaseInput['phase']; instanceId: string; eligiblePairCount: number; distinctDeliveryCount: number }[];
}
export interface RendererPresentationResult {
  presentation: RendererPresentation;
  diagnostics?: PresentationPairDiagnostics;
}
type ObjectValue = Record<string, unknown>;
interface Event extends ObjectValue { name: string; ph: string; ts: number; pid: number; tid: number }
interface Pair { begin: Event; end: Event; feedback?: Event }
function object(value: unknown): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed trace object');
  return value as ObjectValue;
}
function safeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Unsafe ${label}`);
  return value;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing or malformed ${label}`);
  return value;
}
function args(event: Event): ObjectValue { return object(event.args); }
function uint64(value: unknown): string {
  // Never stringify a rounded uint64 JSON number. Decimal strings retain all bits.
  if (typeof value === 'number') return String(safeInteger(value, 'uint64 identity'));
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value) > 18446744073709551615n) throw new Error('Unsafe uint64 identity');
  return value;
}
function validateBeginFrame(value: unknown): void {
  if (value === undefined) return;
  const id = object(value);
  uint64(id.source_id); uint64(id.sequence_number);
}
function track(event: Event): string {
  const id2 = object(event.id2), keys = Object.keys(id2);
  if (keys.length !== 1 || (keys[0] !== 'local' && keys[0] !== 'global')) throw new Error('Malformed animation async track');
  const value = id2[keys[0]!];
  if (typeof value === 'number') return `${keys[0]}:${safeInteger(value, 'async track')}`;
  if (typeof value !== 'string' || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value) || BigInt(value) > 18446744073709551615n) throw new Error('Unsafe animation async track');
  return `${keys[0]}:${value}`;
}
function validateEvent(event: Event): void {
  safeInteger(event.ts, 'trace timestamp'); safeInteger(event.pid, 'process identity'); safeInteger(event.tid, 'thread identity');
}
const evidence = ['Pinned renderer AnimationFrame begin/end pairs joined to AnimationFrame::Presentation by exact args.id; phase-local trace microseconds'];

/** Original bounded offline algorithm, following the pinned DevTools handler:
 * https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/AnimationFramesHandler.ts
 * Unlike the permissive upstream handler, ambiguity/incomplete target pairs fail closed.
 * Collector/mode/revision/correctness guards belong to the production caller.
 */
export function parseRendererPresentation(input: RendererPresentationInput): RendererPresentationResult {
  try { return parseSupported(input); }
  catch (error) { return { presentation: { status: 'unavailable', reason: `Unsupported renderer presentation trace: ${error instanceof Error ? error.message : 'malformed input'}` } }; }
}
function parseSupported(input: RendererPresentationInput): RendererPresentationResult {
  const container = object(input.trace);
  if (!Array.isArray(container.traceEvents)) throw new Error('Missing traceEvents array');
  const events = container.traceEvents.map(value => {
    const event = object(value);
    text(event.name, 'event name'); text(event.ph, 'event phase');
    return event as Event;
  });
  const appURL = text(input.target.appURL, 'target URL'), frameId = text(input.target.frameId, 'target frame');
  const started = events.filter(e => e.name === 'TracingStartedInBrowser');
  if (started.length !== 1) throw new Error('Expected one TracingStartedInBrowser metadata record');
  validateEvent(started[0]!);
  const frames = object(args(started[0]!).data).frames;
  if (!Array.isArray(frames) || frames.length !== 1) throw new Error('Expected a single root document without children or competing documents');
  const root = object(frames[0]);
  for (const flag of ['isInPrimaryMainFrame', 'isOutermostMainFrame']) if (root[flag] !== undefined && typeof root[flag] !== 'boolean') throw new Error('Malformed root frame flags');
  if (root.frame !== frameId || root.url !== appURL || root.parent || root.isInPrimaryMainFrame === false || root.isOutermostMainFrame === false) throw new Error('Target URL/frame does not resolve to the primary root document');
  const pid = safeInteger(root.processId, 'target renderer process');
  const mainThreads = events.filter(e => e.name === 'thread_name' && e.pid === pid && args(e).name === 'CrRendererMain');
  if (mainThreads.length !== 1) throw new Error('Expected unique CrRendererMain metadata');
  validateEvent(mainThreads[0]!);
  if (mainThreads[0]!.ph !== 'M') throw new Error('Malformed CrRendererMain metadata phase');
  const tid = mainThreads[0]!.tid;
  const onTarget = (e: Event) => e.pid === pid && e.tid === tid;

  // Pinned MetaHandler reads FrameCommittedInBrowser.args.data (frame/processId/url),
  // CommitLoad.args.data (frame/url with event.pid), navigationStart.args.frame and
  // args.data.documentLoaderURL, plus PRIMARY_MAIN_FRAME same-document commits.
  // Pinned Chromium tracing_handler.cc emits FrameDeletedInBrowser.args.data.frame
  // and ProcessReadyInBrowser.args.data.{frame,processId}. Both are unsupported here.
  // Even identical frame/URL/PID on a commit cannot prove an unchanged document:
  // same-URL reloads must not be confused with stable snapshot metadata.
  for (const event of events) {
    if (['FrameCommittedInBrowser', 'CommitLoad', 'navigationStart', 'FrameDeletedInBrowser', 'ProcessReadyInBrowser', 'RenderFrameHostImpl::DidCommitSameDocumentNavigation'].includes(event.name)) {
      throw new Error(`Document lifecycle transition ${event.name}`);
    }
  }
  if (!Array.isArray(input.phases) || input.phases.length === 0) throw new Error('No scored phase instances');
  const identities = new Set<string>(), markNames = new Set<string>();
  const phases = input.phases.map(phase => {
    scoredPresentationPhaseSchema.parse(phase.phase); phaseInstanceIdSchema.parse(phase.instanceId);
    if (identities.has(phase.instanceId)) throw new Error('Duplicate phase instance identity');
    identities.add(phase.instanceId);
    const mark = (name: string) => {
      text(name, 'phase mark name');
      if (markNames.has(name)) throw new Error('Reused phase mark name');
      markNames.add(name);
      const matches = events.filter(e => e.name === name);
      if (matches.length !== 1) throw new Error(`Missing or duplicate phase mark ${name}`);
      const event = matches[0]!; validateEvent(event);
      if (!onTarget(event) || !['I', 'R'].includes(event.ph) || typeof event.cat !== 'string' || !event.cat.split(',').includes('blink.user_timing')) throw new Error('Phase mark disagrees with target renderer main thread or User Timing category');
      return event.ts;
    };
    const startUs = mark(phase.startMark), endUs = mark(phase.endMark);
    if (endUs <= startUs) throw new Error('Reversed or empty phase interval');
    return { ...phase, startUs, endUs };
  });
  const chronological = [...phases].sort((a, b) => a.startUs - b.startUs);
  for (let i = 1; i < chronological.length; i++) if (chronological[i]!.startUs < chronological[i - 1]!.endUs) throw new Error('Overlapping phase intervals');

  if (events.some(e => e.name === 'AnimationFrame' && onTarget(e) && !['b', 'e', 's', 'f'].includes(e.ph))) throw new Error('Unsupported target AnimationFrame event phase');
  const starts = events.filter(e => e.name === 'AnimationFrame' && e.ph === 'b' && onTarget(e)).sort((a, b) => a.ts - b.ts);
  const ends = events.filter(e => e.name === 'AnimationFrame' && e.ph === 'e' && onTarget(e)).sort((a, b) => a.ts - b.ts);
  if (starts.length !== ends.length) throw new Error('Incomplete/orphan target AnimationFrame pairs');
  const ids = new Set<string>(), tracks = new Set<string>();
  for (const start of starts) {
    validateEvent(start); const id = text(args(start).id, 'start args.id');
    if (ids.has(id)) throw new Error('Duplicate target AnimationFrame start ID');
    ids.add(id); tracks.add(track(start));
    const timing = args(start).animation_frame_timing_info;
    if (timing !== undefined) validateBeginFrame(object(timing).begin_frame_id);
  }
  if (tracks.size > 1) throw new Error('Multiple target animation async tracks');
  // Unrelated processes do not affect pairing, but reuse of a target string ID does.
  for (const event of events.filter(e => e.name === 'AnimationFrame' && e.ph === 'b' && !onTarget(e))) {
    if (event.args !== undefined && ids.has(String(args(event).id))) throw new Error('Target start ID reused across process/thread');
  }
  const feedback = new Map<string, Event>();
  for (const event of events.filter(e => e.name === 'AnimationFrame::Presentation')) {
    const a = event.args === undefined ? {} : args(event), id = a.id;
    if (!onTarget(event) && (typeof id !== 'string' || !ids.has(id))) continue;
    validateEvent(event);
    const key = text(id, 'presentation args.id');
    if (event.ph !== 'n' || !onTarget(event)) throw new Error('Presentation identity/thread mismatch');
    if (!ids.has(key)) throw new Error('Orphan target presentation ID');
    if (feedback.has(key)) throw new Error('Duplicate/conflicting presentation ID');
    validateBeginFrame(a.begin_frame_id);
    feedback.set(key, event);
  }
  const pairs: Pair[] = starts.map((begin, i) => {
    const end = ends[i]!; validateEvent(end);
    if (end.ts < begin.ts || (i > 0 && begin.ts < ends[i - 1]!.ts)) throw new Error('Reversed, overlapping or nested AnimationFrame pairs');
    if (i > 0 && (begin.ts === starts[i - 1]!.ts || end.ts === ends[i - 1]!.ts)) throw new Error('Duplicate AnimationFrame boundary');
    if (track(begin) !== track(end)) throw new Error('AnimationFrame begin/end async track mismatch');
    const presentation = feedback.get(text(args(begin).id, 'start args.id'));
    if (presentation && presentation.ts < begin.ts) throw new Error('Presentation precedes animation begin');
    return { begin, end, ...(presentation ? { feedback: presentation } : {}) };
  });
  const diagnostics: PresentationPairDiagnostics = { wholeTracePairCount: pairs.length, wholeTraceNonPresentedPairCount: pairs.filter(p => !p.feedback).length, identityMismatches: 0, phases: [] };
  const output = phases.map(phase => {
    const inside = (ts: number) => ts >= phase.startUs && ts < phase.endUs;
    const eligible = pairs.filter(p => inside(p.begin.ts) && p.feedback && inside(p.feedback.ts));
    const timestampsUs = [...new Set(eligible.map(p => p.feedback!.ts))].sort((a, b) => a - b);
    const durationUs = phase.endUs - phase.startUs;
    // A pair touching/spanning the phase but failing dual-boundary eligibility is excluded.
    const boundaryExcludedPairCount = pairs.filter(p => p.feedback && !(inside(p.begin.ts) && inside(p.feedback.ts)) && (inside(p.begin.ts) || inside(p.feedback.ts) || (p.begin.ts < phase.startUs && p.feedback.ts >= phase.endUs))).length;
    const nonPresentedPairCount = pairs.filter(p => !p.feedback && inside(p.begin.ts)).length;
    diagnostics.phases.push({ phase: phase.phase, instanceId: phase.instanceId, eligiblePairCount: eligible.length, distinctDeliveryCount: timestampsUs.length });
    const intervalsUs = timestampsUs.slice(1).map((ts, i) => ts - timestampsUs[i]!);
    const sorted = [...intervalsUs].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    const result: RendererPresentationPhase = {
      phase: phase.phase, instanceId: phase.instanceId, startUs: phase.startUs, endUs: phase.endUs, durationUs,
      target: { frameId, pid, tid }, boundaryExcludedPairCount, nonPresentedPairCount,
      rendererVisualUpdateFps: timestampsUs.length ? { status: 'available', value: timestampsUs.length * 1e6 / durationUs, unit: 'updates/s', evidence: [...evidence], numerator: timestampsUs.length, denominatorUs: durationUs } : { status: 'unavailable', reason: 'No eligible renderer presentation feedback in this phase' },
      presentationIntervals: intervalsUs.length ? { status: 'available', timestampsUs, intervalsUs, median: sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2, p95: sorted[Math.ceil(sorted.length * .95) - 1]!, max: sorted.at(-1)!, unit: 'us', evidence: [...evidence] } : { status: 'unavailable', reason: 'At least two distinct eligible presentation timestamps are required for intervals' },
    };
    return result;
  });
  return { presentation: { status: 'available', value: { scope: 'target renderer visual updates', phases: output } }, diagnostics };
}
