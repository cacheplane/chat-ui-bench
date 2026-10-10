import {
  canonicalSerialize, evidenceSchema, PRESENTATION_BROWSER_REVISION, PRESENTATION_BROWSER_VERSION,
  PRESENTATION_TRACE_CATEGORIES, presentationPhaseMarks, scoredPresentationPhaseSchema,
  type Observation, type PresentationPhaseInput, type RendererPresentation, type Validation,
} from '@chat-ui-bench/contract';
import { parsedRun, type RawRun } from './validate.js';
import { parseRendererPresentation } from './presentation.js';

/** Identity hints retain unavailable/failed samples in per-phase reports without scoring. */
export function presentationPhaseIdentities(page: readonly Observation[]): Pick<PresentationPhaseInput, 'phase' | 'instanceId'>[] {
  let ordinal = 0;
  return page.filter(e => e.kind === 'phase' && scoredPresentationPhaseSchema.safeParse(e.phase).success)
    .map(e => ({ phase: scoredPresentationPhaseSchema.parse(e.phase), instanceId: String(ordinal++) }));
}

function observedPhases(page: readonly Observation[], repetition: string): PresentationPhaseInput[] {
  const phases: PresentationPhaseInput[] = [];
  let active: { phase: PresentationPhaseInput; timestampMs: number } | undefined;
  let lastTimestamp = -Infinity;
  for (const entry of page) {
    if (entry.kind !== 'phase' && entry.kind !== 'phase-end') continue;
    if (entry.timestampMs < lastTimestamp) throw new Error('Nonmonotonic phase observation timestamps');
    lastTimestamp = entry.timestampMs;
    if (entry.kind === 'phase' && !scoredPresentationPhaseSchema.safeParse(entry.phase).success) {
      if (active) throw new Error('Scored phase not closed before next phase');
      continue;
    }
    const ordinal = entry.kind === 'phase' ? phases.length : phases.length - 1;
    const instanceId = String(ordinal);
    const phase = scoredPresentationPhaseSchema.parse(entry.phase);
    const identity = { phase, instanceId, ...presentationPhaseMarks(repetition, instanceId) };
    if (canonicalSerialize(entry.data) !== canonicalSerialize(identity)) throw new Error('Phase observation identity or exact unique marks disagree');
    if (entry.sequence !== null) throw new Error('Phase observation must have no sequence');
    if (entry.kind === 'phase') {
      if (active) throw new Error('Unbalanced phase start');
      active = { phase: identity, timestampMs: entry.timestampMs };
      phases.push(identity);
    } else {
      if (!active || canonicalSerialize(active.phase) !== canonicalSerialize(identity) || entry.timestampMs < active.timestampMs) throw new Error('Unbalanced phase end');
      active = undefined;
    }
  }
  if (active || !phases.length) throw new Error('Missing closed scored phases');
  return phases;
}

export function rendererPresentationForRun(raw: RawRun, validation: Validation): RendererPresentation {
  const unavailable = (reason: string): RendererPresentation => ({ status: 'unavailable', reason });
  if (validation.status !== 'valid') return unavailable(`Run ${validation.status}: ${validation.reasons.join('; ')}`);
  try {
    const { manifest, page } = parsedRun(raw);
    if (manifest.collectorVersion !== '1.1.0') return unavailable('Collector 1.0.0 has no validated renderer presentation capture contract');
    if (manifest.mode !== 'headed') throw new Error('Headed mode required');
    // Browser.getVersion returns a product prefix and an @ revision marker.
    const version = manifest.browser.version.replace(/^Chrome\//, '');
    const revision = manifest.browser.revision.replace(/^@/, '');
    if (version !== PRESENTATION_BROWSER_VERSION || revision !== PRESENTATION_BROWSER_REVISION) throw new Error('Unsupported pinned Chromium version or revision');
    const trace = evidenceSchema.parse(raw.evidence).trace;
    if (!trace?.complete || trace.lossReason) throw new Error('Complete loss-free trace required');
    if (trace.categories.length !== PRESENTATION_TRACE_CATEGORIES.length || new Set(trace.categories).size !== trace.categories.length || PRESENTATION_TRACE_CATEGORIES.some(category => !trace.categories.includes(category))) throw new Error('Unsupported presentation category contract');
    const capture = trace.presentation;
    if (!capture) throw new Error('Missing page-session presentation evidence');
    if (!capture.isolatedBrowserProcess || !capture.singleWorkloadPage) throw new Error('Isolated browser and single workload page ownership required');
    const tree = capture.frameTree.frameTree;
    if (tree.frame.url !== capture.appURL || tree.frame.parentId !== undefined || tree.childFrames?.length) throw new Error('Unsupported pretrace frame topology: one root and no children required');
    const phases = observedPhases(page, manifest.repetition);
    const marks = new Set(phases.flatMap(p => [p.startMark, p.endMark]));
    const events = (raw.trace as { traceEvents?: { name?: unknown }[] } | undefined)?.traceEvents;
    if (Array.isArray(events) && events.some(e => typeof e?.name === 'string' && e.name.startsWith(`bench:${manifest.repetition}:phase:`) && !marks.has(e.name))) throw new Error('Trace phase identity absent from page observations');
    const parsed = parseRendererPresentation({ trace: raw.trace, target: { appURL: capture.appURL, frameId: tree.frame.id }, phases });
    if (parsed.presentation.status === 'available') {
      // Both clocks are checked only within their own domain. Never subtract them.
      const traceOrder = [...parsed.presentation.value.phases].sort((a, b) => a.startUs - b.startUs);
      if (traceOrder.some((phase, index) => phase.instanceId !== String(index))) throw new Error('Trace phase order disagrees with observed local ordinals');
    }
    return parsed.presentation;
  } catch (error) {
    return unavailable(`Renderer presentation capability unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
