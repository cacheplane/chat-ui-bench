import { expect, it } from "vitest";
import { validateRun } from "./validate.js";
import { evidence, observation } from "./fixtures.test-helper.js";
it("accepts exact independent evidence without trusting capture verdict", () =>
  expect(validateRun(evidence()).status).toBe("valid"));
it.each([
  "hash",
  "send-duplicate",
  "receipt-missing",
  "application-duplicate",
  "text",
  "completion",
  "active-during",
  "active-after",
  "disconnect",
  "exception",
  "phase",
  "version",
  "collector",
  "analyzer",
  "schema",
  "loss",
])("rejects %s", (fault) => {
  const raw = evidence();
  if (fault === "hash") raw.manifest.fixture.sha256 = "b".repeat(64);
  if (fault === "send-duplicate") raw.producer.push(raw.producer[1]!);
  if (fault === "receipt-missing")
    raw.page = raw.page.filter(
      (e) => !(e.kind === "receipt" && e.sequence === 1),
    );
  if (fault === "application-duplicate")
    raw.page.push(raw.page.find((e) => e.kind === "application")!);
  if (fault === "text") raw.final.displayedText = "wrong";
  if (fault === "completion") raw.final.replayState = "streaming";
  if (fault === "active-during")
    raw.page.find(
      (e) => e.kind === "application" && e.sequence === 1,
    )!.data.activeMessageId = "wrong";
  if (fault === "active-after") raw.final.activeMessageId = "wrong" as never;
  if (fault === "disconnect")
    raw.producer.push(
      observation("producer-failure", null, 101, { reason: "disconnect" }),
    );
  if (fault === "exception")
    raw.exceptions.push({ kind: "console-error", message: "boom" } as never);
  if (fault === "phase")
    raw.page = raw.page.filter((e) => e.phase !== "disposal");
  if (fault === "version") raw.manifest.suiteVersion = "999";
  if (fault === "collector") raw.manifest.collectorVersion = "999";
  if (fault === "analyzer") raw.manifest.analyzerVersion = "pending";
  if (fault === "schema") raw.manifest.schemaVersion = 9;
  if (fault === "loss") raw.evidence.trace.complete = false;
  expect(validateRun(raw, { requireTrace: true }).status).not.toBe("valid");
});
it.each([0, 3])(
  "rejects zero movement or excess anchor drift (%s)",
  (value) => {
    const raw = evidence();
    raw.manifest.configuration.variant = "scroll";
    raw.checkpoints.scroll = {
      movementCssPx: value === 0 ? 0 : 400,
      anchorDriftCssPx: value,
      initial: { scrollTop: 900 },
      before: {
        sequence: 1,
        scrollTop: 500,
        autoFollow: false,
        anchorId: "history",
        anchorOffsetCssPx: 10,
      },
      after: {
        sequence: 2,
        anchorId: "history",
        anchorOffsetCssPx: 10 + value,
      },
      returned: {
        autoFollow: true,
        scrollTop: 900,
        scrollHeight: 1700,
        clientHeight: 800,
      },
      followDisabled: true,
      followRearmed: true,
    } as never;
    expect(validateRun(raw).status).toBe("invalid");
  },
);
it("optional trace absence only makes trace metrics unavailable", () => {
  const raw = evidence();
  delete (raw.evidence as any).trace;
  expect(validateRun(raw).status).toBe("valid");
});

it("honors capture failure even when correctness probes are complete", () => {
  const raw = {
    ...evidence(),
    captureValidation: {
      schemaVersion: 1,
      status: "failed",
      checks: {},
      reasons: ["browser disposal timed out after 10000ms"],
    },
  };
  const result = validateRun(raw);
  expect(result.status).toBe("failed");
  expect(result.reasons.join(" ")).toContain("browser disposal timed out");
});

it("does not turn malformed raw evidence into metric exceptions", () => {
  const raw = { ...evidence(), manifest: { schemaVersion: 99 } };
  const validation = validateRun(raw);
  expect(validation.status).toBe("failed");
  expect(() => deriveMetrics(raw, validation)).not.toThrow();
});

import { deriveMetrics } from "./metrics.js";

it.each([
  "send-missing",
  "receipt-duplicate",
  "application-missing",
  "trace-loss",
  "trace-schema",
])("rejects additional integrity fault %s", (fault) => {
  const raw = evidence();
  if (fault === "send-missing") raw.producer = raw.producer.slice(1);
  if (fault === "receipt-duplicate")
    raw.page.push(raw.page.find((entry) => entry.kind === "receipt")!);
  if (fault === "application-missing")
    raw.page = raw.page.filter(
      (entry) => !(entry.kind === "application" && entry.sequence === 1),
    );
  if (fault === "trace-loss")
    (raw.evidence.trace as any).lossReason = "CDP data loss";
  if (fault === "trace-schema") raw.trace = { traceEvents: [null] } as never;
  expect(validateRun(raw, { requireTrace: true }).status).not.toBe("valid");
});

it("requires validation after replay rather than accepting phase names in any order", () => {
  const raw = evidence();
  const validation = raw.page.find(
    (entry) => entry.kind === "phase" && entry.phase === "validation",
  )!;
  raw.page = raw.page.filter((entry) => entry !== validation);
  validation.timestampMs = 0.5;
  raw.page.splice(1, 0, validation);
  expect(validateRun(raw).status).toBe("invalid");
});

it("requires five actual retention reset observations rather than trusting summary metadata", () => {
  const raw = evidence();
  raw.manifest.configuration.variant = "retention-release";
  raw.page.splice(
    raw.page.length - 1,
    0,
    observation("phase", null, 105, { phase: "retention" }, "retention"),
  );
  expect(validateRun(raw).status).toBe("invalid");
});

it("rejects empty requested trace as incomplete evidence", () => {
  const raw = evidence();
  raw.trace.traceEvents = [];
  expect(validateRun(raw, { requireTrace: true }).status).not.toBe("valid");
});
it("requires a reason for unavailable retention metadata", () => {
  const raw = { ...evidence(), retention: { status: "unavailable" } };
  expect(validateRun(raw).status).toBe("failed");
});
import { emptyPresentationEvidence } from './presentation-capability.test-helper.js';
it('dispatches old and new capture pairs independently of output analyzer version', () => {
  expect(validateRun(evidence()).status).toBe('valid');
  expect(validateRun(emptyPresentationEvidence()).status).toBe('valid');
});
it.each([['1.0.0', '1.1.0'], ['1.1.0', '1.0.0'], ['2.0.0', '2.0.0']])('rejects capture pair %s/%s', (collector, analyzer) => {
  const raw = emptyPresentationEvidence();
  raw.manifest.collectorVersion = raw.evidence.collectorVersion = collector;
  raw.manifest.analyzerVersion = analyzer;
  expect(validateRun(raw).status).toBe('failed');
});
it('rejects manifest/evidence collector disagreement', () => {
  const raw = emptyPresentationEvidence();
  raw.evidence.collectorVersion = '1.0.0';
  expect(validateRun(raw).status).toBe('failed');
});
