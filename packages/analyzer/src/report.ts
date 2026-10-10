import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import {
  canonicalSerialize,
  runMetricsSchema,
  type Manifest,
  type RunMetrics,
  type Validation,
  type Metric,
} from "@chat-ui-bench/contract";
import {
  ANALYZER_VERSION,
  CALIBRATION_VARIANTS,
  validateRun,
  type RawRun,
} from "./validate.js";
import { deriveMetrics } from "./metrics.js";
import { retentionDelta, retentionForVariant } from "./retention.js";
export interface AnalysisRun {
  id: string;
  manifest: Manifest | null;
  validation: Validation;
  metrics: RunMetrics;
  retention: ReturnType<typeof retentionDelta>;
}
export interface MetricAggregate {
  median: number;
  min: number;
  max: number;
  count: number;
  unavailableCount: number;
  unit: string;
}
export interface UnavailableAggregate {
  status: "unavailable";
  count: 0;
  unavailableCount: number;
  reasons: string[];
}
/** Only documented per-run facts are removed. The raw manifest always retains them. */
export function environmentIdentity(manifest: Manifest): string {
  const identity = structuredClone(manifest);
  identity.browser.flags = identity.browser.flags.map((flag) =>
    flag.startsWith("--user-data-dir=")
      ? "--user-data-dir=<ephemeral-profile>"
      : flag,
  );
  delete identity.adapter.configuration.repetition;
  delete identity.configuration.round;
  if (identity.environment.gpu.status === "available") {
    const gpu = identity.environment.gpu.value as {
      auxAttributes?: Record<string, unknown>;
    } | null;
    if (gpu && typeof gpu === "object" && gpu.auxAttributes)
      delete gpu.auxAttributes.initializationTime;
  }
  const { repetition: _repetition, ...stable } = identity;
  return createHash("sha256").update(canonicalSerialize(stable)).digest("hex");
}
/** Matched fault/control comparisons must differ only by the injected variant/fault. */
export function matchedControlIdentity(manifest: Manifest): string {
  const matched = structuredClone(manifest);
  delete matched.configuration.variant;
  delete matched.adapter.configuration.fault;
  return environmentIdentity(matched);
}
export function aggregate(
  runs: readonly {
    id: string;
    manifest: Manifest | null;
    validation: Pick<Validation, "status" | "reasons">;
    metrics: { metrics: Record<string, Metric> };
  }[],
) {
  const grouped = new Map<string, (typeof runs)[number][]>();
  for (const run of runs) {
    const key = run.manifest
      ? environmentIdentity(run.manifest)
      : `missing-manifest:${run.id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), run]);
  }
  const groups = [...grouped].map(([identity, samples]) => {
    const metrics: Record<string, MetricAggregate | UnavailableAggregate> = {};
    const names = new Set(
      samples.flatMap((sample) => Object.keys(sample.metrics.metrics)),
    );
    for (const name of names) {
      const values = samples.flatMap((sample) => {
        const metric = sample.metrics.metrics[name];
        return sample.validation.status === "valid" &&
          metric?.status === "available"
          ? [metric]
          : [];
      });
      if (!values.length) {
        metrics[name] = {
          status: "unavailable",
          count: 0,
          unavailableCount: samples.length,
          reasons: [
            ...new Set(
              samples.map((sample) => {
                const metric = sample.metrics.metrics[name];
                return metric?.status === "unavailable"
                  ? metric.reason
                  : `Run ${sample.validation.status}: ${sample.validation.reasons.join("; ")}`;
              }),
            ),
          ],
        };
        continue;
      }
      const sorted = values.map((m) => m.value).sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2
          ? sorted[middle]!
          : (sorted[middle - 1]! + sorted[middle]!) / 2;
      metrics[name] = {
        median,
        min: sorted[0]!,
        max: sorted.at(-1)!,
        count: sorted.length,
        unavailableCount: samples.length - sorted.length,
        unit: values[0]!.unit,
      };
    }
    return {
      identity,
      variant: samples[0]!.manifest?.configuration.variant ?? "unknown",
      mode: samples[0]!.manifest?.mode ?? "unknown",
      sampleCount: samples.length,
      validCount: samples.filter((s) => s.validation.status === "valid").length,
      invalidCount: samples.filter((s) => s.validation.status === "invalid")
        .length,
      failedCount: samples.filter((s) => s.validation.status === "failed")
        .length,
      metrics,
    };
  });
  return {
    groups,
    failures: runs
      .filter((r) => r.validation.status !== "valid")
      .map((r) => ({
        id: r.id,
        status: r.validation.status,
        reasons: r.validation.reasons,
      })),
  };
}
const readJSON = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8"));
const readLines = async (path: string): Promise<unknown[]> =>
  (await readFile(path, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
function artifactPath(directory: string, file: string): string {
  const path = resolve(directory, file);
  const delta = relative(directory, path);
  if (isAbsolute(delta) || delta.startsWith(".."))
    throw new Error("Artifact path escapes repetition directory");
  return path;
}
export async function analyzeRepetition(
  directory: string,
  id: string,
  expected?: { round: number; variant: string },
): Promise<AnalysisRun> {
  let manifest: Manifest | null = null;
  let raw: RawRun | undefined;
  let validation: Validation;
  try {
    const manifestJSON = await readJSON(join(directory, "manifest.json"));
    // validateRun owns schema validation; preserve the original object for an error report.
    const loaded = {
      manifest: manifestJSON,
      fixtureText: await readFile(join(directory, "fixture.json"), "utf8"),
      producer: await readLines(join(directory, "producer-events.jsonl")),
      page: await readLines(join(directory, "page-observations.jsonl")),
      evidence: await readJSON(join(directory, "evidence.json")),
      final: await readJSON(join(directory, "final-probes.json")),
      exceptions: await readJSON(join(directory, "exceptions.json")),
      checkpoints: await readJSON(join(directory, "checkpoints.json")),
      trace: await readJSON(join(directory, "trace.json")),
      captureValidation: await readJSON(join(directory, "validation.json")),
    };
    raw = loaded;
    try {
      raw.disposalError = await readJSON(
        join(directory, "page-disposal-error.json"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // Schema checked independently before treating a manifest as an aggregation identity.
    const { manifestSchema } = await import("@chat-ui-bench/contract");
    const parsed = manifestSchema.safeParse(manifestJSON);
    if (parsed.success) manifest = parsed.data;
    if (
      manifest &&
      (manifest.repetition !== id ||
        (expected &&
          (manifest.configuration.round !== expected.round ||
            manifest.configuration.variant !== expected.variant)))
    )
      throw new Error(
        "Artifact identity mismatch: manifest repetition, variant, or round differs from its directory/invocation entry",
      );
    if (String(manifest?.configuration.variant).startsWith("retention-")) {
      raw.retention = await readJSON(join(directory, "retention.json"));
      const ret = raw.retention as {
        status?: string;
        value?: { baseline?: string; post?: string; resets?: number };
      };
      if (
        ret.status === "available" &&
        ret.value?.baseline &&
        ret.value.post &&
        ret.value.resets === 5
      ) {
        raw.baseline = await readJSON(
          artifactPath(directory, ret.value.baseline),
        );
        raw.post = await readJSON(artifactPath(directory, ret.value.post));
      } else if (ret.status !== "unavailable")
        throw new Error(
          "Invalid retention evidence or missing five-reset contract",
        );
    }
    validation = validateRun(raw, { requireTrace: true });
  } catch (error) {
    validation = {
      schemaVersion: 1,
      status: "failed",
      checks: {},
      reasons: [
        `Missing, malformed, or incomplete raw artifact: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  const metrics = raw
    ? deriveMetrics(raw, validation!)
    : {
        schemaVersion: 1 as const,
        analyzerVersion: ANALYZER_VERSION,
        status: validation!.status,
        metrics: {},
        diagnostics: {},
      };
  runMetricsSchema.parse(metrics);
  const run: AnalysisRun = {
    id,
    manifest,
    validation: validation!,
    metrics,
    retention:
      validation!.status === "valid"
        ? retentionForVariant(
            manifest?.configuration.variant,
            raw?.baseline,
            raw?.post,
            raw?.retention,
          )
        : {
            status: "unavailable",
            reason: `Run ${validation!.status}: ${validation!.reasons.join("; ")}`,
          },
  };
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "metrics.json"),
    JSON.stringify(run, null, 2) + "\n",
  );
  await writeFile(join(directory, "summary.md"), runMarkdown(run));
  return run;
}
function runMarkdown(run: AnalysisRun): string {
  return [
    `# ${run.id}`,
    `Status: ${run.validation.status}`,
    `Analyzer: ${ANALYZER_VERSION}`,
    ...run.validation.reasons.map((r) => `- ${r}`),
    "",
    "| Metric | Value or unavailable reason |",
    "| --- | --- |",
    ...Object.entries(run.metrics.metrics).map(
      ([name, m]) =>
        `| ${name} | ${m.status === "available" ? `${m.value} ${m.unit}` : m.reason.replaceAll("|", "\\|")} |`,
    ),
    "",
    `Retention ownership: ${run.retention.status === "available" ? JSON.stringify(run.retention.value) : run.retention.reason}`,
    "",
  ].join("\n");
}
interface Invocation {
  schemaVersion: number;
  collectorVersion: string;
  order: { id: string; round: number; variant: string }[];
  repetitions: number;
  status: string;
  results?: { id: string; status: string }[];
}
function calibrations(runs: readonly AnalysisRun[], invocation: Invocation) {
  const conclusions: {
    id: string;
    status: "validated" | "unvalidated" | "failed";
    reason: string;
  }[] = [];
  const expected = CALIBRATION_VARIANTS;
  for (let round = 1; round <= invocation.repetitions; round++) {
    const find = (variant: string) =>
      runs.find((run) => run.id === `${round}-${variant}`);
    for (const variant of expected)
      if (!find(variant))
        conclusions.push({
          id: `${round}-${variant}`,
          status: "failed",
          reason: "Missing required calibration repetition",
        });
    const control = find("clean");
    const delay = find("delayed-display");
    const value = (run: AnalysisRun | undefined, name: string) => {
      const metric = run?.metrics.metrics[name];
      return metric?.status === "available" ? metric.value : undefined;
    };
    if (delay && control) {
      const comparable =
        !!control.manifest &&
        !!delay.manifest &&
        matchedControlIdentity(control.manifest) ===
          matchedControlIdentity(delay.manifest);
      const c = value(control, "receiveToDOMMeanMs");
      const d = value(delay, "receiveToDOMMeanMs");
      const cb = value(control, "domBacklogMax");
      const db = value(delay, "domBacklogMax");
      conclusions.push({
        id: delay.id,
        status:
          comparable &&
          c !== undefined &&
          d !== undefined &&
          cb !== undefined &&
          db !== undefined &&
          d > c &&
          db > cb
            ? "validated"
            : "failed",
        reason: comparable
          ? "Delayed display must increase page-domain mean receive-to-DOM latency and DOM backlog over the matched clean control"
          : "Clean and delayed-display evidence is not comparable: fixture/assets, browser, hardware, versions, mode, or workload configuration differ",
      });
    }
    const omit = find("omitted-delta");
    if (omit)
      conclusions.push({
        id: omit.id,
        status:
          omit.validation.status === "invalid" &&
          omit.validation.reasons.includes(
            "exact final transcript and displayed text",
          )
            ? "validated"
            : "failed",
        reason:
          "Intentional omitted delta must be rejected independently, with no scored metrics",
      });
    const stall = find("stall");
    if (stall)
      conclusions.push({
        id: stall.id,
        status:
          value(stall, "mainThreadStallMs") !== undefined
            ? "validated"
            : "unvalidated",
        reason:
          stall.metrics.metrics.mainThreadStallMs?.status === "unavailable"
            ? stall.metrics.metrics.mainThreadStallMs.reason
            : "Observed supported LoAF or aligned renderer main-thread task spanning the fault",
      });
    for (const variant of ["retention-release", "retention-retain"]) {
      const run = find(variant);
      if (!run) continue;
      const bytes = value(run, "retainedNativeBytesDelta");
      const count = value(run, "retainedBufferCountDelta");
      conclusions.push({
        id: run.id,
        status:
          bytes === undefined || count === undefined
            ? "unvalidated"
            : bytes === (variant === "retention-retain" ? 20971520 : 0) &&
                count === (variant === "retention-retain" ? 5 : 0)
              ? "validated"
              : "failed",
        reason:
          run.retention.status === "unavailable"
            ? run.retention.reason
            : "Named strongly reachable holder paths and native backing-store byte deltas after five resets",
      });
    }
    const scroll = find("scroll");
    if (scroll)
      conclusions.push({
        id: scroll.id,
        status: scroll.validation.status === "valid" ? "validated" : "failed",
        reason:
          "400 CSS px gesture, <=2 CSS px anchor drift while updates overlap, follow paused and returned to bottom",
      });
  }
  return conclusions;
}
export async function analyzeInvocation(directory: string) {
  directory = resolve(directory);
  const invocation = (await readJSON(
    join(directory, "invocation.json"),
  )) as Invocation;
  if (
    invocation.schemaVersion !== 1 ||
    invocation.collectorVersion !== "1.0.0" ||
    !Array.isArray(invocation.order) ||
    !Number.isInteger(invocation.repetitions) ||
    invocation.repetitions < 1
  )
    throw new Error("Unsupported or incomplete invocation schema");
  const runs: AnalysisRun[] = [];
  for (const entry of invocation.order) {
    if (!entry.id || entry.id.includes("/") || entry.id.includes(".."))
      throw new Error("Unsafe repetition ID");
    runs.push(
      await analyzeRepetition(
        join(directory, "repetitions", entry.id),
        entry.id,
        entry,
      ),
    );
  }
  const stats = aggregate(runs);
  const invocationReasons: string[] = [];
  const canonicalOrder = Array.from(
    { length: invocation.repetitions },
    (_, index) =>
      CALIBRATION_VARIANTS.map((variant) => ({
        id: `${index + 1}-${variant}`,
        round: index + 1,
        variant,
      })),
  ).flat();
  if (
    canonicalSerialize(invocation.order) !== canonicalSerialize(canonicalOrder)
  )
    invocationReasons.push(
      "Capture order does not match canonical interleaved calibration order",
    );
  if (invocation.status !== "complete")
    invocationReasons.push("Capture invocation did not complete");
  if (
    new Set(invocation.order.map((entry) => entry.id)).size !==
    invocation.order.length
  )
    invocationReasons.push("Duplicate capture order entries");
  if (
    !invocation.results ||
    invocation.results.length !== invocation.order.length ||
    invocation.results.some(
      (result, index) => result.id !== invocation.order[index]!.id,
    )
  )
    invocationReasons.push(
      "Capture results do not exactly match ordered repetitions",
    );
  if (invocation.results?.some((result) => result.status === "failed"))
    invocationReasons.push("Capture results include a failed repetition");
  const invocationValidation = {
    status: invocationReasons.length ? "failed" : "valid",
    reasons: invocationReasons,
  };
  const conclusions = calibrations(runs, invocation);
  const unexpected = runs.filter(
    (run) =>
      run.validation.status === "failed" ||
      (run.validation.status === "invalid" &&
        !run.id.endsWith("-omitted-delta")),
  );
  const status =
    invocationReasons.length ||
    unexpected.length ||
    conclusions.some((c) => c.status === "failed")
      ? "failed"
      : "complete";
  const result = {
    schemaVersion: 1,
    analyzerVersion: ANALYZER_VERSION,
    generatedAt: new Date().toISOString(),
    directory,
    status,
    runs,
    ...stats,
    calibrations: conclusions,
    invocationValidation,
  };
  await writeFile(
    join(directory, "metrics.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  const summary = [
    `# Instrumentation calibration`,
    `Analysis: ${status}; analyzer ${ANALYZER_VERSION}`,
    ...invocationReasons.map((reason) => `- Invocation failure: ${reason}`),
    `Runs: ${runs.length}; valid ${runs.filter((r) => r.validation.status === "valid").length}; invalid ${runs.filter((r) => r.validation.status === "invalid").length}; failed ${runs.filter((r) => r.validation.status === "failed").length}`,
    "",
    "## Calibration conclusions",
    ...conclusions.map((c) => `- ${c.id}: ${c.status} — ${c.reason}`),
    "",
    "## Every repetition",
    ...runs.map(
      (r) =>
        `- [${r.id}](repetitions/${r.id}/summary.md): ${r.validation.status}${r.validation.reasons.length ? ` — ${r.validation.reasons.join("; ")}` : ""}`,
    ),
    "",
    "## Comparable groups (variant, mode, fixture and environment)",
    ...stats.groups.map(
      (g) =>
        `- ${g.variant} / ${g.mode}: ${g.validCount}/${g.sampleCount} valid; identity ${g.identity}\n  ${JSON.stringify(g.metrics)}`,
    ),
    "",
    "Presentation: unavailable in this milestone; failed DevTools frame import prevents a validated presentation contract. No comparative readiness or rankings are claimed.",
    "",
  ].join("\n");
  await writeFile(join(directory, "summary.md"), summary);
  return result;
}
