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
