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
import { emptyPresentationEvidence } from './presentation-capability.test-helper.js';
import { deriveMetrics } from './metrics.js';
import { validateRun } from './validate.js';
it('retains unavailable phase samples separately by phase, ordinal and environment', () => {
  const raw = emptyPresentationEvidence();
  const metrics = deriveMetrics(raw, validateRun(raw));
  const hints = [{ phase: 'streaming-auto-follow', instanceId: '0' }, { phase: 'composer-input', instanceId: '1' }, { phase: 'streaming-auto-follow', instanceId: '2' }] as const;
  const a = { id: 'a', manifest: raw.manifest, validation: { status: 'valid' as const, reasons: [] }, metrics, presentationPhases: [...hints] };
  const b = { ...a, id: 'b', validation: { status: 'failed' as const, reasons: ['missing trace'] }, metrics: { metrics: {}, rendererPresentation: { status: 'unavailable' as const, reason: 'missing trace' } } };
  const c = { ...a, id: 'c', manifest: { ...raw.manifest, mode: 'headless' } };
  const result = aggregate([a, b, c]);
  expect(result.presentationGroups).toHaveLength(6);
  const first = result.presentationGroups.find(g => g.instanceId === '0' && g.mode === 'headed')!;
  expect(first).toMatchObject({ phase: 'streaming-auto-follow', sampleCount: 2, validCount: 1, failedCount: 1, invalidCount: 0, unavailableCount: 2 });
  expect(first.reasons.join(' ')).toContain('missing trace');
});
it('accepts 1.1 invocation and rejects invocation/manifest collector disagreement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'presentation-invocation-'));
  const raw = emptyPresentationEvidence();
  await writeKnownArtifacts(join(directory, 'repetitions', '1-clean'), raw);
  await writeKnownInvocation(directory, [{ id: '1-clean', round: 1, variant: 'clean' }]);
  const mismatch = await analyzeInvocation(directory);
  expect(mismatch.runs[0]!.validation.status).toBe('failed');
  const invocation = JSON.parse(await readFile(join(directory, 'invocation.json'), 'utf8'));
  invocation.collectorVersion = '1.1.0';
  await writeFile(join(directory, 'invocation.json'), JSON.stringify(invocation));
  const result = await analyzeInvocation(directory);
  expect(result.runs[0]!.validation.status).toBe('valid');
  expect(result.presentationGroups).toHaveLength(3);
  expect(await readFile(join(directory, 'repetitions', '1-clean', 'summary.md'), 'utf8')).toContain('target renderer visual updates');
  expect(await readFile(join(directory, 'summary.md'), 'utf8')).not.toContain('failed DevTools frame import prevents');
});
import { unlink } from 'node:fs/promises';
it('retains phase identities when the requested raw trace file is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'missing-presentation-trace-'));
  await writeKnownArtifacts(directory, emptyPresentationEvidence());
  await unlink(join(directory, 'trace.json'));
  const run = await analyzeRepetition(directory, '1-clean');
  expect(run.validation.status).toBe('failed');
  const groups = aggregate([run]).presentationGroups;
  expect(groups).toHaveLength(3);
  expect(groups.every(g => g.failedCount === 1 && g.unavailableCount === 1)).toBe(true);
});
it('aggregates available rates without scoring invalid samples or merging ordinals', () => {
  const raw = emptyPresentationEvidence();
  const metrics = deriveMetrics(raw, validateRun(raw));
  if (metrics.rendererPresentation?.status !== 'available') throw new Error('phase scope missing');
  const phase = metrics.rendererPresentation.value.phases[0]!;
  phase.rendererVisualUpdateFps = { status: 'available', value: 250, unit: 'updates/s', evidence: ['aggregation unit input, not capture evidence'], numerator: 1, denominatorUs: 4000 };
  const run = { id: 'a', manifest: raw.manifest, metrics, validation: { status: 'valid' as const, reasons: [] } };
  const bad = { ...run, id: 'bad', validation: { status: 'invalid' as const, reasons: ['wrong text'] } };
  const result = aggregate([run, bad]);
  expect(result.presentationGroups).toHaveLength(3);
  expect(result.presentationGroups[0]).toMatchObject({ availableCount: 1, invalidCount: 1, unavailableCount: 1, rendererVisualUpdateFps: { median: 250, min: 250, max: 250 } });
  expect(result.presentationGroups[0]!.samples[1]).not.toHaveProperty('evidence');
  expect(result.presentationGroups[0]!.samples[1]).not.toHaveProperty('rendererVisualUpdateFps');
});
it('summarizes per-run interval statistics with separate availability counts, never pooled intervals', () => {
  const raw = emptyPresentationEvidence();
  const multiple = deriveMetrics(raw, validateRun(raw));
  if (multiple.rendererPresentation?.status !== 'available') throw new Error('phase scope missing');
  const p = multiple.rendererPresentation.value.phases[0]!;
  p.rendererVisualUpdateFps = { status: 'available', value: 500, unit: 'updates/s', evidence: ['aggregation unit input'], numerator: 2, denominatorUs: 4000 };
  p.presentationIntervals = { status: 'available', timestampsUs: [2000, 3000], intervalsUs: [1000], median: 1000, p95: 1000, max: 1000, unit: 'us', evidence: ['aggregation unit input'] };
  const single = structuredClone(multiple);
  if (single.rendererPresentation?.status !== 'available') throw new Error('phase scope missing');
  single.rendererPresentation.value.phases[0]!.rendererVisualUpdateFps = { ...p.rendererVisualUpdateFps, value: 250, numerator: 1 };
  single.rendererPresentation.value.phases[0]!.presentationIntervals = { status: 'unavailable', reason: 'At least two distinct eligible presentation timestamps are required for intervals' };
  const run = { id: 'multiple', manifest: raw.manifest, metrics: multiple, validation: { status: 'valid' as const, reasons: [] } };
  const result = aggregate([run, { ...run, id: 'single', metrics: single }, { ...run, id: 'zero', metrics: deriveMetrics(raw, validateRun(raw)) }, { ...run, id: 'invalid', validation: { status: 'invalid' as const, reasons: ['wrong text'] } }]);
  const group = result.presentationGroups[0]!;
  expect(group.availableCount).toBe(2);
  for (const name of ['median', 'p95', 'max'] as const) {
    expect(group.presentationIntervals[name]).toMatchObject({ status: 'available', median: 1000, min: 1000, max: 1000, count: 1, unavailableCount: 3, unit: 'us' });
    expect(group.presentationIntervals[name].reasons.join(' ')).toContain('wrong text');
    expect(group.presentationIntervals[name].reasons.join(' ')).toContain('At least two distinct');
  }
});
import { runMetricsSchema } from '@chat-ui-bench/contract';
// Hash every raw artifact, including invocation metadata and extra retained files.
// Derived JSON ignores only generatedAt; Markdown is compared byte-for-byte.
import { inventory, assertEqual } from '../../../scripts/artifact-checks.mjs';
it.each(['1.0.0', '1.1.0'])('preserves the complete %s raw inventory across deterministic derived runs', async (version) => {
  const directory = await mkdtemp(join(tmpdir(), 'all-raw-offline-'));
  const raw = version === '1.0.0' ? evidence() : emptyPresentationEvidence();
  await writeKnownArtifacts(join(directory, 'repetitions', '1-clean'), raw, { 'extra-retained.json': { untouched: true } });
  await writeKnownInvocation(directory, [{ id: '1-clean', round: 1, variant: 'clean' }]);
  const invocation = JSON.parse(await readFile(join(directory, 'invocation.json'), 'utf8'));
  invocation.collectorVersion = version;
  await writeFile(join(directory, 'invocation.json'), JSON.stringify(invocation));
  const before = await inventory(directory, 'raw');
  await analyzeInvocation(directory);
  assertEqual(await inventory(directory, 'raw'), before, 'raw after first analysis');
  const derived = await inventory(directory, 'derived');
  expect(Object.keys(derived)).toEqual(['metrics.json', 'repetitions/1-clean/metrics.json', 'repetitions/1-clean/summary.md', 'summary.md']);
  await analyzeInvocation(directory);
  assertEqual(await inventory(directory, 'raw'), before, 'raw after second analysis');
  assertEqual(await inventory(directory, 'derived'), derived, 'all derived outputs');
});
it('rejects unknown invocation versions without changing any raw artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'unknown-offline-version-'));
  await writeKnownArtifacts(join(directory, 'repetitions', '1-clean'), evidence());
  await writeKnownInvocation(directory, [{ id: '1-clean', round: 1, variant: 'clean' }]);
  const invocation = JSON.parse(await readFile(join(directory, 'invocation.json'), 'utf8'));
  invocation.collectorVersion = '99.0.0';
  await writeFile(join(directory, 'invocation.json'), JSON.stringify(invocation));
  const before = await inventory(directory, 'raw');
  await expect(analyzeInvocation(directory)).rejects.toThrow(/version|Unsupported/);
  assertEqual(await inventory(directory, 'raw'), before, 'unknown-version raw');
});
it.each(['fixture.json', 'page-observations.jsonl', 'evidence.json'])('emits unavailable renderer capability for a 1.1 run missing %s before raw loading completes', async (file) => {
  const directory = await mkdtemp(join(tmpdir(), 'incomplete-presentation-raw-'));
  await writeKnownArtifacts(directory, emptyPresentationEvidence());
  await unlink(join(directory, file));
  const run = await analyzeRepetition(directory, '1-clean');
  expect(run.manifest?.collectorVersion).toBe('1.1.0');
  expect(run.validation.status).toBe('failed');
  expect(run.metrics.rendererPresentation).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('Run failed:') });
  expect(JSON.stringify(run.metrics.rendererPresentation)).not.toContain('"value":');
  expect(runMetricsSchema.safeParse(run.metrics).success).toBe(true);
  expect(aggregate([run]).presentationGroups).toHaveLength(file === 'page-observations.jsonl' ? 0 : 3);
});
