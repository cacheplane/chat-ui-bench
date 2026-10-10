import { createHash } from "node:crypto";
import {
  canonicalSerialize,
  availabilitySchema,
  evidenceSchema,
  fixtureSchema,
  manifestSchema,
  observationSchema,
  validationSchema,
  payloadBytes,
  type Validation,
  type Fixture,
  type Manifest,
  type Observation,
} from "@chat-ui-bench/contract";
import { z } from "zod";
export const ANALYZER_VERSION = "1.0.0";
export const CALIBRATION_VARIANTS = [
  "clean",
  "stall",
  "delayed-display",
  "scroll",
  "omitted-delta",
  "retention-release",
  "retention-retain",
] as const;
export interface RawRun {
  manifest: unknown;
  fixtureText: string;
  producer: unknown;
  page: unknown;
  evidence: unknown;
  final: unknown;
  exceptions: unknown;
  checkpoints: unknown;
  trace?: unknown;
  retention?: unknown;
  baseline?: unknown;
  post?: unknown;
  captureValidation?: unknown;
  disposalError?: unknown;
}
export const finalSchema = z.object({
  transcript: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      status: z.literal("complete"),
      text: z.string(),
    }),
  ),
  displayedText: z.string(),
  activeMessageId: z.null(),
  lastAppliedSequence: z.number().int(),
  replayState: z.literal("complete"),
});
export const scrollSchema = z.object({
  movementCssPx: z.number().finite(),
  anchorDriftCssPx: z.number().finite(),
  initial: z.object({ scrollTop: z.number().finite() }),
  before: z.object({
    sequence: z.number().int(),
    scrollTop: z.number().finite(),
    autoFollow: z.boolean(),
    anchorId: z.string(),
    anchorOffsetCssPx: z.number().finite(),
  }),
  after: z.object({
    sequence: z.number().int(),
    anchorId: z.string(),
    anchorOffsetCssPx: z.number().finite(),
  }),
  returned: z.object({
    autoFollow: z.boolean(),
    scrollTop: z.number().finite(),
    scrollHeight: z.number().finite(),
    clientHeight: z.number().finite(),
  }),
  followDisabled: z.boolean(),
  followRearmed: z.boolean(),
});
export function parsedRun(raw: RawRun): {
  manifest: Manifest;
  fixture: Fixture;
  producer: Observation[];
  page: Observation[];
} {
  return {
    manifest: manifestSchema.parse(raw.manifest),
    fixture: fixtureSchema.parse(JSON.parse(raw.fixtureText)),
    producer: z.array(observationSchema).parse(raw.producer),
    page: z.array(observationSchema).parse(raw.page),
  };
}
export function validateRun(
  raw: RawRun,
  options: { requireTrace?: boolean } = {},
): Validation {
  const checks: Record<string, boolean> = {};
  const reasons: string[] = [];
  const check = (name: string, pass: boolean) => {
    checks[name] = pass;
    if (!pass) reasons.push(name);
  };
  try {
    if (raw.retention !== undefined) availabilitySchema.parse(raw.retention);
    if (raw.captureValidation !== undefined) {
      const capture = validationSchema.parse(raw.captureValidation);
      if (capture.status === "failed")
        throw new Error(`Collector failed: ${capture.reasons.join("; ")}`);
    }
    if (raw.disposalError !== undefined)
      throw new Error(
        `Page disposal failed: ${canonicalSerialize(raw.disposalError)}`,
      );
    const { manifest, fixture, producer, page } = parsedRun(raw);
    const evidence = evidenceSchema.parse(raw.evidence);
    if (
      manifest.suiteVersion !== "0.1.0" ||
      manifest.collectorVersion !== "1.0.0" ||
      evidence.collectorVersion !== "1.0.0" ||
      manifest.analyzerVersion !== ANALYZER_VERSION
    )
      throw new Error(
        "Unsupported suite, collector, or analyzer version (pending capture manifests require an explicit migration; raw files are never rewritten)",
      );
    check(
      "fixture hash and canonical bytes",
      createHash("sha256").update(raw.fixtureText).digest("hex") ===
        manifest.fixture.sha256 &&
        canonicalSerialize(fixture) === raw.fixtureText,
    );
    check("fixture scenario", fixture.scenarioId === manifest.scenarioId);
    const variant = manifest.configuration.variant;
    const round = manifest.configuration.round;
    check(
      "canonical calibration manifest identity",
      typeof variant === "string" &&
        (CALIBRATION_VARIANTS as readonly string[]).includes(variant) &&
        typeof round === "number" &&
        Number.isInteger(round) &&
        round > 0 &&
        manifest.repetition === `${round}-${variant}` &&
        manifest.adapter.configuration.repetition === manifest.repetition &&
        manifest.adapter.configuration.fault ===
          (variant === "omitted-delta" ? "omit" : variant),
    );
    check(
      "observation identity and clock domains",
      producer.every(
        (e) =>
          e.repetition === manifest.repetition &&
          e.clockDomain === "producer-monotonic-ms",
      ) &&
        page.every(
          (e) =>
            e.repetition === manifest.repetition &&
            e.clockDomain === "page-performance-ms",
        ),
    );
    for (const [kind, log] of [
      ["producer-send", producer],
      ["receipt", page],
      ["application", page],
    ] as const) {
      const entries = log.filter((e) => e.kind === kind);
      check(
        `${kind} exact ordered sequence`,
        entries.length === fixture.events.length &&
          entries.every(
            (entry, i) => entry.sequence === fixture.events[i]!.sequence,
          ),
      );
      check(
        `${kind} monotonic timestamps`,
        entries.every(
          (entry, i) =>
            i === 0 || entry.timestampMs >= entries[i - 1]!.timestampMs,
        ),
      );
      check(
        `${kind} event integrity`,
        entries.every((entry, i) => {
          const event = fixture.events[i];
          if (!event) return false;
          if (kind === "producer-send")
            return (
              entry.data.scheduledMs === event.scheduledMs &&
              entry.data.actualMs === entry.timestampMs &&
              entry.data.payloadBytes === payloadBytes(event.text) &&
              entry.timestampMs >= event.scheduledMs
            );
          if (kind === "receipt")
            return (
              entry.data.eventType === event.type &&
              entry.data.messageId === event.messageId &&
              entry.data.payloadBytes === payloadBytes(event.text)
            );
          return (
            entry.data.eventType === event.type &&
            entry.data.omitted === false &&
            entry.data.activeMessageId ===
              (event.type === "assistant-complete" ? null : event.messageId)
          );
        }),
      );
    }
    check(
      "receipt precedes application",
      fixture.events.every((event) => {
        const r = page.find(
          (e) => e.kind === "receipt" && e.sequence === event.sequence,
        );
        const a = page.find(
          (e) => e.kind === "application" && e.sequence === event.sequence,
        );
        return !!r && !!a && r.timestampMs <= a.timestampMs;
      }),
    );
    const final = finalSchema.safeParse(raw.final);
    check(
      "final completion and probes",
      final.success &&
        final.data.lastAppliedSequence === fixture.events.at(-1)!.sequence,
    );
    const text = fixture.events.map((e) => e.text).join("");
    const expected = [
      ...fixture.history,
      {
        id: fixture.events[0]!.messageId,
        role: "assistant",
        status: "complete",
        text,
      },
    ];
    check(
      "exact final transcript and displayed text",
      final.success &&
        canonicalSerialize(final.data.transcript) ===
          canonicalSerialize(expected) &&
        final.data.displayedText === text,
    );
    check(
      "no console or page exceptions",
      Array.isArray(raw.exceptions) && raw.exceptions.length === 0,
    );
    check(
      "no replay failure or stream disconnect",
      ![...producer, ...page].some(
        (e) => e.kind === "producer-failure" || e.kind === "replay-failure",
      ),
    );
    const boundaries = page.filter((e) => e.kind === "phase");
    const streamingStart = boundaries.find(
      (entry) => entry.phase === "streaming-auto-follow",
    )?.timestampMs;
    const inputStart = boundaries.find(
      (entry) => entry.phase === "composer-input",
    )?.timestampMs;
    const validationStart = boundaries.find(
      (entry) => entry.phase === "validation",
    )?.timestampMs;
    const replayEntries = page.filter(
      (entry) => entry.kind === "receipt" || entry.kind === "application",
    );
    check(
      "phase boundaries bracket replay and input",
      streamingStart !== undefined &&
        inputStart !== undefined &&
        validationStart !== undefined &&
        streamingStart <= inputStart &&
        inputStart < validationStart &&
        replayEntries.every(
          (entry) =>
            entry.timestampMs >= streamingStart &&
            entry.timestampMs <= validationStart,
        ),
    );
    const required = [
      "setup",
      "streaming-auto-follow",
      "composer-input",
      "validation",
      "disposal",
    ];
    if (manifest.configuration.variant === "scroll")
      required.push("gesture-scroll", "return-to-bottom");
    if (String(manifest.configuration.variant).startsWith("retention-"))
      required.push("retention");
    if (
      String(manifest.configuration.variant).startsWith("retention-") &&
      (raw.retention as { status?: string })?.status !== "unavailable"
    ) {
      const resets = page.filter((entry) => entry.kind === "retention-reset");
      check(
        "five actual named retention resets",
        resets.length === 5 &&
          resets.every(
            (entry, index) =>
              entry.phase === "retention" &&
              entry.data.allocatedBytes === 4194304 &&
              entry.data.ownerClass === "ReferenceRetainedBufferOwner" &&
              entry.data.ownerProperty === "retainedBuffers" &&
              entry.data.retainedBufferCount ===
                (manifest.configuration.variant === "retention-retain"
                  ? index + 1
                  : 0),
          ),
      );
    }
    check(
      "complete phase boundaries",
      required.every((phase) =>
        boundaries.some((e) => e.phase === phase && e.data.phase === phase),
      ) &&
        boundaries.every(
          (e, i) => i === 0 || e.timestampMs >= boundaries[i - 1]!.timestampMs,
        ) &&
        boundaries[0]?.phase === "setup" &&
        boundaries.at(-1)?.phase === "disposal",
    );
    if (options.requireTrace) {
      const traceSchema = z.object({
        traceEvents: z
          .array(
            z
              .object({
                name: z.string(),
                ph: z.string(),
                pid: z.number().int(),
                tid: z.number().int(),
                ts: z.number().finite().optional(),
                dur: z.number().finite().nonnegative().optional(),
                cat: z.string().optional(),
                args: z.record(z.string(), z.unknown()).optional(),
              })
              .passthrough(),
          )
          .min(1),
      });
      if (!traceSchema.safeParse(raw.trace).success)
        throw new Error("Unsupported CDP trace event schema");
      check(
        "requested trace complete without loss",
        !!evidence.trace?.complete &&
          !evidence.trace.lossReason &&
          Array.isArray((raw.trace as { traceEvents?: unknown })?.traceEvents),
      );
    }
    if (manifest.configuration.variant === "scroll") {
      const scroll = scrollSchema.safeParse(
        (raw.checkpoints as { scroll?: unknown })?.scroll,
      );
      check(
        "scroll movement and anchoring",
        scroll.success &&
          scroll.data.movementCssPx >= 350 &&
          scroll.data.movementCssPx <= 450 &&
          Math.abs(
            scroll.data.initial.scrollTop -
              scroll.data.before.scrollTop -
              scroll.data.movementCssPx,
          ) <= 1 &&
          scroll.data.anchorDriftCssPx <= 2 &&
          Math.abs(
            scroll.data.before.anchorOffsetCssPx -
              scroll.data.after.anchorOffsetCssPx,
          ) <= 2 &&
          scroll.data.before.anchorId === scroll.data.after.anchorId &&
          scroll.data.after.sequence > scroll.data.before.sequence &&
          !scroll.data.before.autoFollow &&
          scroll.data.returned.autoFollow &&
          scroll.data.followDisabled &&
          scroll.data.followRearmed &&
          Math.abs(
            scroll.data.returned.scrollTop -
              (scroll.data.returned.scrollHeight -
                scroll.data.returned.clientHeight),
          ) <= 2,
      );
    }
    return {
      schemaVersion: 1,
      status: reasons.length ? "invalid" : "valid",
      checks,
      reasons,
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      status: "failed",
      checks,
      reasons: [
        ...reasons,
        `Analysis validation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
