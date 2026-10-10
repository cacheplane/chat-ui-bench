import { beforeAll, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCalibration, variants } from "./index.js";
let directory: string;
const json = async (variant: string, name: string) =>
  JSON.parse(
    await readFile(
      join(directory, "repetitions", `1-${variant}`, name),
      "utf8",
    ),
  );
const lines = async (variant: string, name: string) =>
  (await readFile(join(directory, "repetitions", `1-${variant}`, name), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
beforeAll(async () => {
  directory = await runCalibration({
    mode: "headless",
    repetitions: 1,
    out: await mkdtemp(join(tmpdir(), "bench-browser-")),
  });
}, 180000);
it("clean control has exact transcript and completion with ordered independent producer logs", async () => {
  const validation = await json("clean", "validation.json");
  expect(validation.status).toBe("valid");
  expect(Object.values(validation.checks).every(Boolean)).toBe(true);
  const producer = await lines("clean", "producer-events.jsonl");
  const sent = producer.filter((entry) => entry.kind === "producer-send");
  expect(sent.map((entry) => entry.sequence)).toEqual(
    Array.from({ length: 202 }, (_, i) => i),
  );
  const observations = await lines("clean", "page-observations.jsonl");
  expect(observations.filter((entry) => entry.kind === "receipt")).toHaveLength(
    202,
  );
  expect(
    observations.some(
      (entry) => entry.kind === "dom-checkpoint" && entry.sequence === 201,
    ),
  ).toBe(true);
  const manifest = await json("clean", "manifest.json");
  expect(manifest.browser.executable).toContain("chrome");
  expect(manifest.browser.flags).toContain("--enable-automation");
  expect(manifest.configuration.chromiumDownloadRevision).toBe("1248");
});
it("omitted delta invalidates correctness rather than producing a clean result", async () => {
  const validation = await json("omitted-delta", "validation.json");
  expect(validation.status).toBe("invalid");
  expect(validation.checks.transcriptExact).toBe(false);
});
it("delayed display preserves correctness and records page-clock delay/backlog", async () => {
  expect((await json("delayed-display", "validation.json")).status).toBe(
    "valid",
  );
  const observations = await lines(
    "delayed-display",
    "page-observations.jsonl",
  );
  expect(
    observations.some(
      (entry) =>
        entry.kind === "dom-checkpoint" &&
        entry.timestampMs - entry.data.receiptMs >= 100,
    ),
  ).toBe(true);
  expect(
    observations.some(
      (entry) => entry.kind === "dom-backlog" && entry.data.backlog >= 3,
    ),
  ).toBe(true);
});
it("stall matches a supported LoAF or is explicitly unvalidated", async () => {
  expect((await json("stall", "validation.json")).status).toBe("valid");
  const calibration = await json("stall", "calibration.json");
  expect(["validated", "unvalidated"]).toContain(calibration.stall.status);
  if (calibration.stall.status === "validated") {
    expect(calibration.stall.source).toBe("long-animation-frame");
    expect(calibration.stall.durationMs).toBeGreaterThanOrEqual(120);
  } else expect(calibration.stall.reason).toBeTruthy();
  const observations = await lines("stall", "page-observations.jsonl");
  expect(
    observations.some(
      (entry) => entry.kind === "fault-stall" && entry.data.durationMs >= 120,
    ),
  ).toBe(true);
});
it("scroll moves 400 CSS px and anchors visible history while updates overlap", async () => {
  expect((await json("scroll", "validation.json")).status).toBe("valid");
  const scroll = (await json("scroll", "checkpoints.json")).scroll;
  expect(scroll.movementCssPx).toBeGreaterThan(350);
  expect(scroll.movementCssPx).toBeLessThanOrEqual(450);
  expect(scroll.anchorDriftCssPx).toBeLessThanOrEqual(2);
  expect(scroll.after.sequence).toBeGreaterThan(scroll.before.sequence);
  expect(scroll.followDisabled).toBe(true);
  expect(scroll.followRearmed).toBe(true);
});
it.each(["retention-release", "retention-retain"])(
  "%s captures raw snapshots around five resets, with no GC inside the replay trace",
  async (variant) => {
    expect((await json(variant, "validation.json")).status).toBe("valid");
    const evidence = await json(variant, "retention.json");
    expect(evidence.status).toBe("available");
    expect(evidence.value.resets).toBe(5);
    for (const name of ["baseline", "post"]) {
      const snapshot = await json(variant, `${name}.heapsnapshot`);
      expect(snapshot.snapshot.meta.node_fields).toContain("self_size");
      expect(snapshot.nodes.length).toBeGreaterThan(0);
    }
    const observations = await lines(variant, "page-observations.jsonl");
    const resets = observations.filter(
      (entry) => entry.kind === "retention-reset",
    );
    expect(resets).toHaveLength(5);
    expect(resets.every((entry) => entry.phase === "retention")).toBe(true);
    expect(resets.at(-1).data.retainedBufferCount).toBe(
      variant === "retention-retain" ? 5 : 0,
    );
  },
);
it("every trace completes and missing below-threshold input remains explicitly unavailable", async () => {
  const profiles = [];
  for (const variant of variants) {
    expect((await json(variant, "evidence.json")).trace.complete).toBe(true);
    expect(
      (await json(variant, "trace.json")).traceEvents.length,
    ).toBeGreaterThan(0);
    const calibration = await json(variant, "calibration.json");
    if (calibration.input.status === "unavailable")
      expect(calibration.input.reason).toContain("threshold");
    const manifest = await json(variant, "manifest.json");
    const profile = manifest.browser.flags.find((flag: string) =>
      flag.startsWith("--user-data-dir="),
    );
    expect(profile).toBeTruthy();
    profiles.push(profile);
  }
  expect(new Set(profiles).size).toBe(7);
});

import { analyzeInvocation } from "@chat-ui-bench/analyzer";
it("offline ANALYZED results gate validity and validate independent calibration measurements", async () => {
  const analysis = await analyzeInvocation(directory);
  expect(analysis.status).toBe("complete");
  const find = (variant: string) =>
    analysis.runs.find((run) => run.id === `1-${variant}`)!;
  expect(find("clean").validation.status).toBe("valid");
  expect(find("omitted-delta").validation.status).toBe("invalid");
  expect(
    Object.values(find("omitted-delta").metrics.metrics).every(
      (metric) => metric.status === "unavailable",
    ),
  ).toBe(true);
  expect(find("clean").metrics.metrics.transportLatencyMs!.status).toBe(
    "unavailable",
  );
  expect(find("clean").metrics.metrics.presentationIntervalMs!.status).toBe(
    "unavailable",
  );
  const value = (variant: string, name: string) => {
    const metric = find(variant).metrics.metrics[name]!;
    expect(metric.status).toBe("available");
    return metric.status === "available" ? metric.value : NaN;
  };
  expect(value("delayed-display", "receiveToDOMMeanMs")).toBeGreaterThan(
    value("clean", "receiveToDOMMeanMs"),
  );
  expect(value("delayed-display", "domBacklogMax")).toBeGreaterThan(
    value("clean", "domBacklogMax"),
  );
  for (const variant of ["retention-release", "retention-retain"]) {
    const run = find(variant);
    if (run.retention.status === "available") {
      expect(run.retention.value.retainedCountDelta).toBe(
        variant === "retention-retain" ? 5 : 0,
      );
      expect(run.retention.value.nativeBytesDelta).toBe(
        variant === "retention-retain" ? 20971520 : 0,
      );
      if (variant === "retention-retain")
        expect(run.retention.value.post.paths).toHaveLength(5);
    } else expect(run.retention.reason).toBeTruthy();
  }
  const stall = find("stall").metrics.metrics.mainThreadStallMs!;
  if (stall.status === "available")
    expect(stall.value).toBeGreaterThanOrEqual(120);
  else expect(stall.reason).toBeTruthy();
}, 30000);
