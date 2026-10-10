import {
  elapsedBetween,
  payloadBytes,
  type Metric,
  type RunMetrics,
  type Validation,
} from "@chat-ui-bench/contract";
import { ANALYZER_VERSION, parsedRun, type RawRun } from "./validate.js";
import { traceStall, PRESENTATION_REASON } from "./trace.js";
import { retentionForVariant } from "./retention.js";
import { rendererPresentationForRun } from './presentation-capability.js';
const unavailable = (reason: string): Metric => ({
  status: "unavailable",
  reason,
});
const available = (value: number, unit: string, evidence: string[]): Metric =>
  Number.isFinite(value)
    ? { status: "available", value, unit, evidence }
    : unavailable("Nonfinite derived value");
export function deriveMetrics(raw: RawRun, validation: Validation): RunMetrics {
  const metrics: Record<string, Metric> = {};
  const result: RunMetrics = {
    schemaVersion: 1,
    analyzerVersion: ANALYZER_VERSION,
    status: validation.status,
    metrics,
    diagnostics: {},
    rendererPresentation: rendererPresentationForRun(raw, validation),
  };
  const names = [
    "producerLatenessMaxMs",
    "producerLatenessMeanMs",
    "receiveToDOMMaxMs",
    "receiveToDOMMeanMs",
    "receiveToDOMSampleCount",
    "domBacklogMax",
    "inputDurationMaxMs",
    "loafDurationMaxMs",
    "mainThreadStallMs",
    "transportLatencyMs",
    "presentationIntervalMs",
    "heapUsedBytes",
    "heapTotalBytes",
    "domDocuments",
    "domNodes",
    "domJSListeners",
    "retainedBufferCountDelta",
    "retainedNativeBytesDelta",
    "scrollMovementCssPx",
    "scrollAnchorDriftCssPx",
  ];
  for (const name of names)
    metrics[name] = unavailable(
      validation.status === "valid"
        ? "Evidence not recorded"
        : `Run ${validation.status}: ${validation.reasons.join("; ")}`,
    );
  if (validation.status !== "valid") return result;
  const { manifest, fixture, producer, page } = parsedRun(raw);
  const summarize = (
    values: number[],
    max: string,
    mean?: string,
    unit = "ms",
    evidence = ["page-observations.jsonl"],
  ) => {
    if (values.length) {
      metrics[max] = available(Math.max(...values), unit, evidence);
      if (mean)
        metrics[mean] = available(
          values.reduce((a, b) => a + b, 0) / values.length,
          unit,
          evidence,
        );
    }
  };
  const lateness = producer
    .filter((e) => e.kind === "producer-send")
    .map((e) =>
      elapsedBetween(
        { clockDomain: e.clockDomain, timestampMs: Number(e.data.scheduledMs) },
        e,
      ),
    );
  summarize(lateness, "producerLatenessMaxMs", "producerLatenessMeanMs", "ms", [
    "producer-events.jsonl",
  ]);
  let prefix = "";
  const mapping = new Map(
    fixture.events.map((event) => {
      prefix += event.text;
      return [
        event.sequence,
        { length: prefix.length, bytes: payloadBytes(prefix) },
      ];
    }),
  );
  const receipt = page.filter((e) => e.kind === "receipt");
  const checkpoints = page.filter((e) => e.kind === "dom-checkpoint");
  const latencies: number[] = [];
  let complete = true;
  for (const r of receipt) {
    const expected = mapping.get(r.sequence!)!;
    const checkpoint = checkpoints
      .filter(
        (c) =>
          c.sequence === r.sequence &&
          c.timestampMs >= r.timestampMs &&
          c.data.receiptMs === r.timestampMs &&
          c.data.characterLength === expected.length &&
          c.data.utf8Bytes === expected.bytes,
      )
      .sort((a, b) => a.timestampMs - b.timestampMs)[0];
    if (!checkpoint) {
      complete = false;
      break;
    }
    latencies.push(elapsedBetween(r, checkpoint));
  }
  if (complete && latencies.length) {
    summarize(latencies, "receiveToDOMMaxMs", "receiveToDOMMeanMs");
    metrics.receiveToDOMSampleCount = available(latencies.length, "count", [
      "page-observations.jsonl",
      "fixture.json",
    ]);
  } else
    for (const name of [
      "receiveToDOMMaxMs",
      "receiveToDOMMeanMs",
      "receiveToDOMSampleCount",
    ])
      metrics[name] = unavailable(
        "Missing or inconsistent first DOM prefix checkpoints; no partial latency scoring",
      );
  const backlog = page.filter((e) => e.kind === "dom-backlog");
  const validBacklog = backlog.every(
    (e) =>
      typeof e.data.backlog === "number" &&
      e.data.backlog >= 0 &&
      e.data.backlog ===
        Number(e.data.receivedSequence) -
          Number(e.data.representedSequence ?? 0),
  );
  if (validBacklog)
    summarize(
      backlog.map((e) => Number(e.data.backlog)),
      "domBacklogMax",
      undefined,
      "sequence count",
    );
  metrics.inputDurationMaxMs = unavailable(
    "No observed composer Event Timing entries; unsupported or below the configured 16ms threshold; absence is not zero",
  );
  summarize(
    page
      .filter((e) => e.kind === "event-timing" && e.phase === "composer-input")
      .map((e) => Number(e.data.duration)),
    "inputDurationMaxMs",
  );
  metrics.loafDurationMaxMs = unavailable(
    "No observed Long Animation Frame entries; support and threshold limit observability",
  );
  summarize(
    page
      .filter(
        (e) =>
          e.kind === "long-animation-frame" &&
          !["setup", "validation", "retention", "disposal"].includes(e.phase),
      )
      .map((e) => Number(e.data.duration)),
    "loafDurationMaxMs",
  );
  const fault = page.find((e) => e.kind === "fault-stall");
  const loaf =
    fault &&
    page.find(
      (e) =>
        e.kind === "long-animation-frame" &&
        Number(e.data.duration) >= 120 &&
        e.timestampMs <= fault.timestampMs &&
        e.timestampMs + Number(e.data.duration) >=
          fault.timestampMs + Number(fault.data.durationMs) - 1,
    );
  metrics.mainThreadStallMs = loaf
    ? available(Number(loaf.data.duration), "ms", [
        "page-observations.jsonl: long-animation-frame spanning fault-stall",
      ])
    : traceStall(raw.trace, page);
  metrics.transportLatencyMs = unavailable(
    "Producer and page clocks are independent; no validated clock synchronization",
  );
  metrics.presentationIntervalMs = unavailable(manifest.collectorVersion === '1.0.0' ? PRESENTATION_REASON : 'See rendererPresentation phases for phase-local feedback intervals; no whole-run interval is scored');
  const counters = (
    raw.checkpoints as {
      streamingEnd?: {
        heap?: {
          status: string;
          value?: { usedSize: number; totalSize: number };
          reason?: string;
        };
        dom?: {
          status: string;
          value?: {
            documents: number;
            nodes: number;
            jsEventListeners: number;
          };
          reason?: string;
        };
      };
    }
  )?.streamingEnd;
  if (counters?.heap?.status === "available" && counters.heap.value) {
    metrics.heapUsedBytes = available(counters.heap.value.usedSize, "bytes", [
      "checkpoints.json: streamingEnd.heap.usedSize; renderer V8 heap, excludes total browser memory",
    ]);
    metrics.heapTotalBytes = available(counters.heap.value.totalSize, "bytes", [
      "checkpoints.json: streamingEnd.heap.totalSize; renderer V8 heap",
    ]);
  }
  if (counters?.heap?.status === "unavailable") {
    for (const name of ["heapUsedBytes", "heapTotalBytes"])
      metrics[name] = unavailable(
        counters.heap.reason ?? "Renderer heap counters unavailable",
      );
  }
  if (counters?.dom?.status === "available" && counters.dom.value) {
    for (const [name, field] of [
      ["domDocuments", "documents"],
      ["domNodes", "nodes"],
      ["domJSListeners", "jsEventListeners"],
    ] as const)
      metrics[name] = available(counters.dom.value[field], "count", [
        `checkpoints.json: streamingEnd.dom.${field}; renderer counters`,
      ]);
  }
  if (counters?.dom?.status === "unavailable") {
    for (const name of ["domDocuments", "domNodes", "domJSListeners"])
      metrics[name] = unavailable(
        counters.dom.reason ?? "Renderer DOM counters unavailable",
      );
  }
  const scroll = (
    raw.checkpoints as {
      scroll?: { movementCssPx: number; anchorDriftCssPx: number };
    }
  )?.scroll;
  if (scroll) {
    metrics.scrollMovementCssPx = available(scroll.movementCssPx, "CSS px", [
      "checkpoints.json: scroll",
    ]);
    metrics.scrollAnchorDriftCssPx = available(
      scroll.anchorDriftCssPx,
      "CSS px",
      ["checkpoints.json: scroll"],
    );
  }
  const retention = retentionForVariant(
    manifest.configuration.variant,
    raw.baseline,
    raw.post,
    raw.retention,
  );
  if (retention.status === "available") {
    metrics.retainedBufferCountDelta = available(
      retention.value.retainedCountDelta,
      "count",
      ["baseline.heapsnapshot", "post.heapsnapshot"],
    );
    metrics.retainedNativeBytesDelta = available(
      retention.value.nativeBytesDelta,
      "bytes",
      ["baseline.heapsnapshot", "post.heapsnapshot"],
    );
  } else {
    metrics.retainedBufferCountDelta = unavailable(retention.reason);
    metrics.retainedNativeBytesDelta = unavailable(retention.reason);
  }
  return result;
}
