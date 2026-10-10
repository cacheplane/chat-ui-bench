import { expect, it } from "vitest";
import { aggregate, environmentIdentity } from "./report.js";
import { evidence } from "./fixtures.test-helper.js";
it("normalizes ephemeral profile identity but preserves meaningful flags and mode", () => {
  const a = evidence().manifest;
  const b = structuredClone(a);
  b.browser.flags = ["--enable-automation", "--user-data-dir=/tmp/b"];
  b.configuration.round = 2;
  b.adapter.configuration.repetition = "2-clean";
  expect(environmentIdentity(a)).toBe(environmentIdentity(b));
  b.browser.flags.push("--disable-gpu");
  expect(environmentIdentity(a)).not.toBe(environmentIdentity(b));
  b.browser.flags = a.browser.flags;
  b.mode = "headed";
  expect(environmentIdentity(a)).not.toBe(environmentIdentity(b));
});
it("groups comparable variants and retains all failures with median and range counts", () => {
  const manifest = evidence().manifest;
  const runs = [1, 3, 100].map((value, i) => ({
    id: String(i),
    manifest,
    validation: {
      status: i === 2 ? "failed" : "valid",
      reasons: i === 2 ? ["missing raw"] : [],
    },
    metrics: {
      metrics: {
        latency:
          i === 2
            ? { status: "unavailable", reason: "failed" }
            : { status: "available", value, unit: "ms", evidence: ["page"] },
      },
    },
  }));
  const result = aggregate(runs);
  expect(result.groups[0].metrics.latency).toEqual({
    median: 2,
    min: 1,
    max: 3,
    count: 2,
    unavailableCount: 1,
    unit: "ms",
  });
  expect(result.failures).toHaveLength(1);
});

import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { analyzeInvocation } from "./report.js";

it("offline analysis is deterministic and leaves every raw byte unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "offline-analysis-"));
  const repetition = join(directory, "repetitions", "1-clean");
  await mkdir(repetition, { recursive: true });
  const raw = evidence();
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(raw.manifest),
    "fixture.json": raw.fixtureText,
    "producer-events.jsonl": raw.producer
      .map((e) => JSON.stringify(e))
      .join("\n"),
    "page-observations.jsonl": raw.page
      .map((e) => JSON.stringify(e))
      .join("\n"),
    "evidence.json": JSON.stringify(raw.evidence),
    "final-probes.json": JSON.stringify(raw.final),
    "exceptions.json": "[]",
    "checkpoints.json": JSON.stringify(raw.checkpoints),
    "trace.json": JSON.stringify(raw.trace),
    "validation.json": JSON.stringify({
      schemaVersion: 1,
      status: "valid",
      reasons: [],
      checks: {},
    }),
  };
  for (const [name, bytes] of Object.entries(files))
    await writeFile(join(repetition, name), bytes);
  await writeFile(
    join(directory, "invocation.json"),
    JSON.stringify({
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      order: [{ id: "1-clean", round: 1, variant: "clean" }],
      repetitions: 1,
      status: "complete",
      results: [{ id: "1-clean", status: "valid" }],
    }),
  );
  const digest = (bytes: string) =>
    createHash("sha256").update(bytes).digest("hex");
  const first = await analyzeInvocation(directory);
  const second = await analyzeInvocation(directory);
  const { generatedAt: _firstTime, ...a } = first;
  const { generatedAt: _secondTime, ...b } = second;
  expect(a).toEqual(b);
  await writeFile(
    join(directory, "invocation.json"),
    JSON.stringify({
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      order: [{ id: "1-clean", round: 1, variant: "clean" }],
      repetitions: 1,
      status: "failed",
      results: [{ id: "1-clean", status: "valid" }],
    }),
  );
  const captureFailed = await analyzeInvocation(directory);
  expect(captureFailed.invocationValidation.reasons.join(" ")).toContain(
    "Capture invocation did not complete",
  );
  await writeFile(
    join(directory, "invocation.json"),
    JSON.stringify({
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      order: [{ id: "1-clean", round: 1, variant: "clean" }],
      repetitions: 1,
      status: "complete",
      results: [],
    }),
  );
  const resultMissing = await analyzeInvocation(directory);
  expect(resultMissing.invocationValidation.reasons.join(" ")).toContain(
    "Capture results do not exactly match",
  );
  expect(first.status).toBe("failed");
  expect(
    first.calibrations.filter(
      (c) => c.reason === "Missing required calibration repetition",
    ),
  ).toHaveLength(6);
  for (const [name, bytes] of Object.entries(files))
    expect(digest(await readFile(join(repetition, name), "utf8"))).toBe(
      digest(bytes),
    );
});

it("a listed repetition with no raw directory remains a reported failed sample", async () => {
  const directory = await mkdtemp(join(tmpdir(), "missing-offline-analysis-"));
  await writeFile(
    join(directory, "invocation.json"),
    JSON.stringify({
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      order: [{ id: "1-clean", round: 1, variant: "clean" }],
      repetitions: 1,
      status: "complete",
      results: [{ id: "1-clean", status: "valid" }],
    }),
  );
  const result = await analyzeInvocation(directory);
  expect(result.runs).toHaveLength(1);
  expect(result.runs[0]!.validation.status).toBe("failed");
  expect(result.failures[0]!.reasons.join(" ")).toContain("raw artifact");
});

it("normalizes only documented volatile GPU initialization duration while keeping device config", () => {
  const a = evidence().manifest;
  a.environment.gpu = {
    status: "available",
    value: {
      devices: [{ deviceString: "GPU" }],
      auxAttributes: { initializationTime: 0.03, skiaBackendType: "Metal" },
    },
  } as never;
  const b = structuredClone(a);
  (b.environment.gpu as any).value.auxAttributes.initializationTime = 0.04;
  expect(environmentIdentity(a)).toBe(environmentIdentity(b));
  (b.environment.gpu as any).value.auxAttributes.skiaBackendType = "Vulkan";
  expect(environmentIdentity(a)).not.toBe(environmentIdentity(b));
});

import { analyzeRepetition } from "./report.js";
import { observation } from "./fixtures.test-helper.js";
it("offline loader keeps unsupported retention valid with an explicit unvalidated reason", async () => {
  const directory = await mkdtemp(join(tmpdir(), "unsupported-retention-"));
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
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(raw.manifest),
    "fixture.json": raw.fixtureText,
    "producer-events.jsonl": raw.producer
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
    "page-observations.jsonl": raw.page
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
    "evidence.json": JSON.stringify(raw.evidence),
    "final-probes.json": JSON.stringify(raw.final),
    "exceptions.json": "[]",
    "checkpoints.json": JSON.stringify(raw.checkpoints),
    "trace.json": JSON.stringify(raw.trace),
    "validation.json": JSON.stringify({
      schemaVersion: 1,
      status: "valid",
      checks: {},
      reasons: [],
    }),
    "retention.json": JSON.stringify({
      status: "unavailable",
      reason: "HeapProfiler snapshot capability unavailable",
    }),
  };
  for (const [name, bytes] of Object.entries(files))
    await writeFile(join(directory, name), bytes);
  const result = await analyzeRepetition(directory, "1-retention-release");
  expect(result.validation.status).toBe("valid");
  expect(result.retention.status).toBe("unavailable");
  expect(result.metrics.metrics.retainedNativeBytesDelta!.status).toBe(
    "unavailable",
  );
  expect(JSON.stringify(result.retention)).toContain(
    "HeapProfiler snapshot capability unavailable",
  );
});

it("reports unavailable counts and reasons when a group has no scoreable samples", () => {
  const result = aggregate([
    {
      id: "bad",
      manifest: evidence().manifest,
      validation: { status: "invalid", reasons: ["wrong text"] },
      metrics: {
        metrics: {
          latency: { status: "unavailable", reason: "Run invalid: wrong text" },
        },
      },
    },
  ]);
  expect(result.groups[0]!.metrics.latency).toEqual({
    status: "unavailable",
    count: 0,
    unavailableCount: 1,
    reasons: ["Run invalid: wrong text"],
  });
});

function labeledEvidence(variant: string, round = 1) {
  const raw = evidence();
  const id = `${round}-${variant}`;
  raw.manifest.repetition = id;
  raw.manifest.configuration.variant = variant;
  raw.manifest.configuration.round = round;
  raw.manifest.adapter.configuration = {
    repetition: id,
    fault: variant === "omitted-delta" ? "omit" : variant,
  };
  for (const entry of [...raw.producer, ...raw.page]) entry.repetition = id;
  return raw;
}
async function writeKnownArtifacts(
  directory: string,
  raw: ReturnType<typeof evidence>,
  extra: Record<string, unknown> = {},
) {
  await mkdir(directory, { recursive: true });
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(raw.manifest),
    "fixture.json": raw.fixtureText,
    "producer-events.jsonl": raw.producer
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
    "page-observations.jsonl": raw.page
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
    "evidence.json": JSON.stringify(raw.evidence),
    "final-probes.json": JSON.stringify(raw.final),
    "exceptions.json": JSON.stringify(raw.exceptions),
    "checkpoints.json": JSON.stringify(raw.checkpoints),
    "trace.json": JSON.stringify(raw.trace),
    "validation.json": JSON.stringify({
      schemaVersion: 1,
      status: "valid",
      checks: {},
      reasons: [],
    }),
  };
  for (const [name, content] of Object.entries(extra))
    files[name] = JSON.stringify(content);
  for (const [name, content] of Object.entries(files))
    await writeFile(join(directory, name), content);
}
async function writeKnownInvocation(
  directory: string,
  order: { id: string; round: number; variant: string }[],
) {
  await writeFile(
    join(directory, "invocation.json"),
    JSON.stringify({
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      repetitions: 1,
      status: "complete",
      order,
      results: order.map((entry) => ({ id: entry.id, status: "valid" })),
    }),
  );
}

it("rejects a clean artifact substituted under a scroll repetition label", async () => {
  const directory = await mkdtemp(join(tmpdir(), "substituted-repetition-"));
  await writeKnownArtifacts(
    join(directory, "repetitions", "1-scroll"),
    evidence(),
  );
  await writeKnownInvocation(directory, [
    { id: "1-scroll", round: 1, variant: "scroll" },
  ]);
  const result = await analyzeInvocation(directory);
  expect(result.runs[0]!.validation.status).not.toBe("valid");
  expect(result.calibrations.find((c) => c.id === "1-scroll")!.status).toBe(
    "failed",
  );
});

it.each(["round", "variant", "fault", "adapter-repetition"])(
  "rejects inconsistent manifest %s identity",
  async (field) => {
    const directory = await mkdtemp(join(tmpdir(), "manifest-identity-"));
    const raw = evidence();
    if (field === "round") raw.manifest.configuration.round = 2;
    if (field === "variant") raw.manifest.configuration.variant = "stall";
    if (field === "fault") raw.manifest.adapter.configuration.fault = "stall";
    if (field === "adapter-repetition")
      raw.manifest.adapter.configuration.repetition = "2-clean";
    await writeKnownArtifacts(directory, raw);
    expect(
      (await analyzeRepetition(directory, "1-clean")).validation.status,
    ).not.toBe("valid");
  },
);

it.each(["entry-round", "entry-variant", "reordered", "duplicate"])(
  "rejects inconsistent invocation %s order",
  async (fault) => {
    const directory = await mkdtemp(join(tmpdir(), "invocation-order-"));
    const variants = [
      "clean",
      "stall",
      "delayed-display",
      "scroll",
      "omitted-delta",
      "retention-release",
      "retention-retain",
    ];
    const order = variants.map((variant) => ({
      id: `1-${variant}`,
      round: 1,
      variant,
    }));
    if (fault === "entry-round") order[0]!.round = 2;
    if (fault === "entry-variant") order[0]!.variant = "stall";
    if (fault === "reordered") [order[0], order[1]] = [order[1]!, order[0]!];
    if (fault === "duplicate") order[1] = order[0]!;
    await writeKnownInvocation(directory, order);
    const result = await analyzeInvocation(directory);
    expect(result.invocationValidation.reasons.join(" ")).toContain(
      "canonical interleaved calibration order",
    );
  },
);

it.each(["browser", "CPU", "assets", "mode", "configuration", "matched"])(
  "requires comparable clean and delayed-display manifests (%s)",
  async (change) => {
    const directory = await mkdtemp(join(tmpdir(), "control-comparability-"));
    const control = labeledEvidence("clean");
    control.page.find((entry) => entry.kind === "dom-backlog")!.data = {
      sample: "checkpoint",
      receivedSequence: 1,
      representedSequence: 1,
      backlog: 0,
    };
    const delayed = labeledEvidence("delayed-display");
    for (const entry of delayed.page)
      if (entry.kind === "dom-checkpoint") entry.timestampMs = 99;
    if (change === "browser")
      delayed.manifest.browser.version = "different-browser";
    if (change === "CPU")
      delayed.manifest.environment.cpu = {
        status: "available",
        value: "different-CPU",
      };
    if (change === "assets")
      delayed.manifest.assets["main.js"] = "b".repeat(64);
    if (change === "mode") delayed.manifest.mode = "headed";
    if (change === "configuration")
      (delayed.manifest.configuration as any).playwrightVersion =
        "different-version";
    await writeKnownArtifacts(
      join(directory, "repetitions", "1-clean"),
      control,
    );
    await writeKnownArtifacts(
      join(directory, "repetitions", "1-delayed-display"),
      delayed,
    );
    await writeKnownInvocation(directory, [
      { id: "1-clean", round: 1, variant: "clean" },
      { id: "1-delayed-display", round: 1, variant: "delayed-display" },
    ]);
    const result = await analyzeInvocation(directory);
    const conclusion = result.calibrations.find(
      (c) => c.id === "1-delayed-display",
    )!;
    expect(conclusion.status).toBe(
      change === "matched" ? "validated" : "failed",
    );
    if (change !== "matched")
      expect(conclusion.reason).toContain("not comparable");
  },
);

it.each(["invalid", "failed"])(
  "gates ownership output when repetition is %s",
  async (status) => {
    const directory = await mkdtemp(join(tmpdir(), "gated-retention-"));
    const raw = labeledEvidence("retention-release");
    raw.page.splice(
      raw.page.length - 1,
      0,
      observation("phase", null, 105, { phase: "retention" }, "retention"),
    );
    for (let i = 0; i < 5; i++)
      raw.page.splice(raw.page.length - 1, 0, {
        ...observation(
          "retention-reset",
          null,
          106 + i / 10,
          {
            allocatedBytes: 4194304,
            retainedBufferCount: 0,
            ownerClass: "ReferenceRetainedBufferOwner",
            ownerProperty: "retainedBuffers",
          },
          "retention",
        ),
        repetition: "1-retention-release",
      });
    raw.page.find(
      (entry) => entry.phase === "retention" && entry.kind === "phase",
    )!.repetition = "1-retention-release";
    if (status === "invalid") raw.final.displayedText = "wrong";
    else raw.manifest.analyzerVersion = "pending";
    const snapshot = {
      snapshot: {
        meta: {
          node_fields: ["type", "name", "id", "self_size", "edge_count"],
          node_types: [["synthetic", "object"], [], [], [], []],
          edge_fields: ["type", "name_or_index", "to_node"],
          edge_types: [["property", "element", "weak"], [], []],
        },
      },
      strings: [
        "root",
        "ReferenceRetainedBufferOwner",
        "Array",
        "referenceRetainedBufferOwner",
        "retainedBuffers",
      ],
      nodes: [0, 0, 1, 0, 1, 1, 1, 2, 8, 1, 1, 2, 3, 8, 0],
      edges: [0, 3, 5, 0, 4, 10],
    };
    await writeKnownArtifacts(directory, raw, {
      "retention.json": {
        status: "available",
        value: {
          baseline: "baseline.heapsnapshot",
          post: "post.heapsnapshot",
          resets: 5,
          ownershipAnalysis: "offline-required",
        },
      },
      "baseline.heapsnapshot": snapshot,
      "post.heapsnapshot": snapshot,
    });
    const result = await analyzeRepetition(directory, "1-retention-release");
    expect(result.validation.status).toBe(status);
    expect(result.retention.status).toBe("unavailable");
    expect(JSON.stringify(result.retention)).toContain(`Run ${status}`);
    expect(await readFile(join(directory, "summary.md"), "utf8")).not.toContain(
      '"nativeBytes":',
    );
  },
);

it("labels non-retention report ownership as not requested", async () => {
  const directory = await mkdtemp(join(tmpdir(), "not-requested-retention-"));
  await writeKnownArtifacts(directory, evidence());
  const result = await analyzeRepetition(directory, "1-clean");
  expect(result.validation.status).toBe("valid");
  expect(result.retention).toEqual({
    status: "unavailable",
    reason: "Retention diagnostic not requested for this variant",
  });
  expect(await readFile(join(directory, "summary.md"), "utf8")).toContain(
    "Retention ownership: Retention diagnostic not requested for this variant",
  );
});
