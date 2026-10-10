import { expect, it } from "vitest";
import { elapsedBetween } from "@chat-ui-bench/contract";
import { deriveMetrics } from "./metrics.js";
import { validateRun } from "./validate.js";
import { evidence } from "./fixtures.test-helper.js";
it("computes 70ms producer lateness and 75ms page latency in separate clocks", () => {
  const raw = evidence();
  const m = deriveMetrics(raw, validateRun(raw)).metrics;
  expect(m.producerLatenessMaxMs.value).toBe(70);
  expect(m.receiveToDOMMaxMs.value).toBe(75);
  expect(m.domBacklogMax.value).toBe(1);
  expect(m.transportLatencyMs.status).toBe("unavailable");
});
it("rejects cross-clock subtraction", () =>
  expect(() =>
    elapsedBetween(
      { clockDomain: "producer-monotonic-ms", timestampMs: 20 },
      { clockDomain: "page-performance-ms", timestampMs: 95 },
    ),
  ).toThrow("clock"));
it("maps several prefixes to one checkpoint without losing samples", () => {
  const raw = evidence();
  expect(
    deriveMetrics(raw, validateRun(raw)).metrics.receiveToDOMSampleCount.value,
  ).toBe(3);
});
it("missing Event Timing and LoAF are unavailable, never zero", () => {
  const raw = evidence();
  const m = deriveMetrics(raw, validateRun(raw)).metrics;
  expect(m.inputDurationMaxMs.status).toBe("unavailable");
  expect(m.loafDurationMaxMs.status).toBe("unavailable");
  expect(m.presentationIntervalMs.status).toBe("unavailable");
});
it("invalid omitted output has no available scored values", () => {
  const raw = evidence();
  raw.final.displayedText = "x";
  const result = deriveMetrics(raw, validateRun(raw));
  expect(
    Object.values(result.metrics).every((m: any) => m.status === "unavailable"),
  ).toBe(true);
});
it("CDP counters have bytes and count scopes", () => {
  const raw = evidence();
  const m = deriveMetrics(raw, validateRun(raw)).metrics;
  expect(m.heapUsedBytes.value).toBe(150);
  expect(m.heapUsedBytes.unit).toBe("bytes");
  expect(m.domNodes.value).toBe(30);
  expect(m.domNodes.unit).toBe("count");
});

it("preserves collector capability reasons for unsupported counters and snapshots", () => {
  const raw = evidence();
  raw.manifest.repetition = "1-retention-release";
  raw.manifest.configuration.variant = "retention-release";
  raw.manifest.adapter.configuration = {
    repetition: "1-retention-release",
    fault: "retention-release",
  };
  raw.page.splice(
    raw.page.length - 1,
    0,
    observation("phase", null, 105, { phase: "retention" }, "retention"),
  );
  for (const entry of [...raw.producer, ...raw.page])
    entry.repetition = "1-retention-release";
  raw.checkpoints.streamingEnd.heap = {
    status: "unavailable",
    reason: "Runtime.getHeapUsage unsupported",
  } as never;
  raw.checkpoints.streamingEnd.dom = {
    status: "unavailable",
    reason: "Memory.getDOMCounters unsupported",
  } as never;
  const withRetention = {
    ...raw,
    retention: {
      status: "unavailable",
      reason: "HeapProfiler.takeHeapSnapshot unsupported",
    },
  };
  const m = deriveMetrics(withRetention, validateRun(withRetention)).metrics;
  expect(m.heapUsedBytes.reason).toContain("Runtime.getHeapUsage unsupported");
  expect(m.domNodes.reason).toContain("Memory.getDOMCounters unsupported");
  expect(m.retainedNativeBytesDelta.reason).toContain(
    "HeapProfiler.takeHeapSnapshot unsupported",
  );
});

import { observation } from "./fixtures.test-helper.js";
it("reports actual observed composer Event Timing and LoAF values", () => {
  const raw = evidence();
  raw.page.push(
    observation(
      "event-timing",
      null,
      7,
      { startTime: 7, duration: 24, observedAtMs: 150 },
      "composer-input",
    ),
  );
  raw.page.push(
    observation("long-animation-frame", null, 30, {
      startTime: 30,
      duration: 121,
    }),
  );
  const m = deriveMetrics(raw, validateRun(raw)).metrics;
  expect(m.inputDurationMaxMs.value).toBe(24);
  expect(m.loafDurationMaxMs.value).toBe(121);
});

it("labels non-retention metrics as not requested rather than a snapshot parsing failure", () => {
  const raw = evidence();
  const metrics = deriveMetrics(raw, validateRun(raw)).metrics;
  expect(metrics.retainedBufferCountDelta).toEqual({
    status: "unavailable",
    reason: "Retention diagnostic not requested for this variant",
  });
  expect(metrics.retainedNativeBytesDelta).toEqual({
    status: "unavailable",
    reason: "Retention diagnostic not requested for this variant",
  });
});
import { emptyPresentationEvidence } from './presentation-capability.test-helper.js';
import { runMetricsSchema } from '@chat-ui-bench/contract';
it('outputs analyzer 1.1 while preserving old presentation semantics', () => {
  const old = deriveMetrics(evidence(), validateRun(evidence()));
  expect(old.analyzerVersion).toBe('1.1.0');
  expect(old.metrics.presentationIntervalMs.status).toBe('unavailable');
});
it('keeps zero-feedback phases unavailable without a zero FPS', () => {
  const raw = emptyPresentationEvidence();
  const result = deriveMetrics(raw, validateRun(raw));
  expect(result.rendererPresentation?.status).toBe('available');
  if (result.rendererPresentation?.status !== 'available') throw new Error('phase capability absent');
  expect(result.rendererPresentation.value.phases).toHaveLength(3);
  expect(result.rendererPresentation.value.phases.every(p => p.rendererVisualUpdateFps.status === 'unavailable')).toBe(true);
  expect(runMetricsSchema.safeParse(result).success).toBe(true);
});
it.each(['mode', 'revision', 'category', 'missing-evidence', 'ownership', 'child', 'frame-mismatch', 'missing-end', 'wrong-marks', 'ordinal', 'lost'])('fails capability closed for %s', (fault) => {
  const raw = emptyPresentationEvidence();
  if (fault === 'mode') raw.manifest.mode = 'headless';
  if (fault === 'revision') raw.manifest.browser.revision = 'unknown';
  if (fault === 'category') raw.evidence.trace.categories.pop();
  if (fault === 'missing-evidence') delete raw.evidence.trace.presentation;
  if (fault === 'ownership') raw.evidence.trace.presentation.singleWorkloadPage = false;
  if (fault === 'child') raw.evidence.trace.presentation.frameTree.frameTree.childFrames = [{ frame: { id: 'child', url: 'http://localhost/child' } }];
  if (fault === 'frame-mismatch') raw.evidence.trace.presentation.frameTree.frameTree.frame.id = 'other';
  if (fault === 'missing-end') raw.page = raw.page.filter((e: any) => e.kind !== 'phase-end');
  if (fault === 'wrong-marks') raw.page.find((e: any) => e.data.instanceId === '0').data.startMark = 'wrong';
  if (fault === 'ordinal') raw.page.find((e: any) => e.data.instanceId === '0').data.instanceId = '7';
  if (fault === 'lost') raw.evidence.trace.lossReason = 'lost';
  const result = deriveMetrics(raw, validateRun(raw));
  expect(result.rendererPresentation?.status).toBe('unavailable');
  expect(JSON.stringify(result.rendererPresentation)).not.toContain('"value":');
  expect(runMetricsSchema.safeParse(result).success).toBe(true);
});
it.each(['invalid', 'failed'])('never scores nested presentation for %s correctness', (status) => {
  const raw = emptyPresentationEvidence();
  if (status === 'invalid') raw.final.displayedText = 'wrong';
  else raw.disposalError = { message: 'dispose failed' };
  const result = deriveMetrics(raw, validateRun(raw));
  expect(result.status).toBe(status);
  expect(result.rendererPresentation?.status).toBe('unavailable');
  expect(runMetricsSchema.safeParse(result).success).toBe(true);
});
it('accepts exact CDP Browser.getVersion product and revision spellings', () => {
  const raw = emptyPresentationEvidence();
  raw.manifest.browser.version = 'Chrome/' + raw.manifest.browser.version;
  raw.manifest.browser.revision = '@' + raw.manifest.browser.revision;
  expect(deriveMetrics(raw, validateRun(raw)).rendererPresentation?.status).toBe('available');
});
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
it.skipIf(!process.env.PRESENTATION_INTEGRATION_RUN)('scores immutable actual headed 1.1 capture and retains phase-local failures', async () => {
  const directory = process.env.PRESENTATION_INTEGRATION_RUN!;
  const json = async (name: string) => JSON.parse(await readFile(join(directory, name), 'utf8'));
  const lines = async (name: string) => (await readFile(join(directory, name), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const raw: any = { manifest: await json('manifest.json'), fixtureText: await readFile(join(directory, 'fixture.json'), 'utf8'), producer: await lines('producer-events.jsonl'), page: await lines('page-observations.jsonl'), evidence: await json('evidence.json'), final: await json('final-probes.json'), exceptions: await json('exceptions.json'), checkpoints: await json('checkpoints.json'), trace: await json('trace.json'), captureValidation: await json('validation.json') };
  const validation = validateRun(raw, { requireTrace: true });
  expect(validation.status).toBe('valid');
  const result = deriveMetrics(raw, validation);
  expect(runMetricsSchema.safeParse(result).success).toBe(true);
  expect(result.rendererPresentation?.status).toBe('available');
  if (result.rendererPresentation?.status !== 'available') throw new Error(JSON.stringify(result.rendererPresentation));
  expect(result.rendererPresentation.value.phases.map(p => p.rendererVisualUpdateFps.status === 'available' ? p.rendererVisualUpdateFps.numerator : null)).toEqual([11, 17, 240]);
  const phase = result.rendererPresentation.value.phases[0]!;
  raw.trace.traceEvents = raw.trace.traceEvents.filter((e: any) => e.name !== 'AnimationFrame::Presentation' || e.ts < phase.startUs || e.ts >= phase.endUs);
  const partial = deriveMetrics(raw, validateRun(raw));
  expect(partial.rendererPresentation?.status).toBe('available');
  if (partial.rendererPresentation?.status !== 'available') throw new Error('lost phase locality');
  expect(partial.rendererPresentation.value.phases.map(p => p.rendererVisualUpdateFps.status)).toEqual(['unavailable', 'available', 'available']);
  raw.final.displayedText = 'incorrect';
  expect(deriveMetrics(raw, validateRun(raw)).rendererPresentation?.status).toBe('unavailable');
});
it('rejects trace-only phase identities absent from page observations', () => {
  const raw = emptyPresentationEvidence();
  raw.trace.traceEvents.push({ name: 'bench:1-clean:phase:9:start', ph: 'I', ts: 999999, pid: 1, tid: 2, cat: 'blink.user_timing' });
  expect(deriveMetrics(raw, validateRun(raw)).rendererPresentation?.status).toBe('unavailable');
});
