import { PRESENTATION_BROWSER_REVISION, PRESENTATION_BROWSER_VERSION, PRESENTATION_TRACE_CATEGORIES, presentationPhaseMarks } from '@chat-ui-bench/contract';
import { evidence, observation } from './fixtures.test-helper.js';

/** Synthetic negative-only fixture: no feedback exists, so it cannot validate FPS. */
export function emptyPresentationEvidence(): any {
  const raw: any = evidence();
  raw.manifest.collectorVersion = raw.manifest.analyzerVersion = raw.evidence.collectorVersion = '1.1.0';
  raw.manifest.mode = 'headed';
  raw.manifest.browser.version = PRESENTATION_BROWSER_VERSION;
  raw.manifest.browser.revision = PRESENTATION_BROWSER_REVISION;
  raw.evidence.trace.categories = [...PRESENTATION_TRACE_CATEGORIES];
  raw.evidence.trace.presentation = { capability: 'rendererVisualUpdateFps', contractVersion: '1.1.0', sessionTarget: 'page', targetId: 'target', appURL: 'http://localhost/app', frameTree: { frameTree: { frame: { id: 'frame', url: 'http://localhost/app' } } }, frameTreeCapturePoint: 'before-tracing', isolatedBrowserProcess: true, singleWorkloadPage: true };
  const phases = raw.page.filter((e: any) => e.kind === 'phase');
  const traceEvents: any[] = [{ name: 'TracingStartedInBrowser', ph: 'I', ts: 0, pid: 9, tid: 9, args: { data: { frames: [{ frame: 'frame', url: 'http://localhost/app', processId: 1 }] } } }, { name: 'thread_name', ph: 'M', ts: 0, pid: 1, tid: 2, args: { name: 'CrRendererMain' } }];
  let ordinal = 0;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (!['streaming-auto-follow', 'composer-input'].includes(phase.phase)) continue;
    const identity = { phase: phase.phase, instanceId: String(ordinal++), ...presentationPhaseMarks('1-clean', String(ordinal - 1)) };
    phase.data = identity;
    const end = observation('phase-end', null, phases[i + 1].timestampMs, identity, phase.phase);
    raw.page.splice(raw.page.indexOf(phases[i + 1]), 0, end);
    for (const [name, ts] of [[identity.startMark, phase.timestampMs * 1000], [identity.endMark, end.timestampMs * 1000]]) traceEvents.push({ name, ph: 'I', ts, pid: 1, tid: 2, cat: 'blink.user_timing' });
  }
  raw.trace = { traceEvents };
  return raw;
}
