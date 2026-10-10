import {
  canonicalSerialize,
  payloadBytes,
  type Observation,
} from "@chat-ui-bench/contract";
import { createHash } from "node:crypto";
export const observation = (
  kind: string,
  sequence: number | null,
  timestampMs: number,
  data: Observation["data"] = {},
  phase: Observation["phase"] = "streaming-auto-follow",
): Observation => ({
  schemaVersion: 1,
  kind,
  sequence,
  timestampMs,
  data,
  phase,
  repetition: "1-clean",
  clockDomain: kind.startsWith("producer")
    ? "producer-monotonic-ms"
    : "page-performance-ms",
});
export function evidence() {
  const fixture = {
    schemaVersion: 1,
    scenarioId: "test",
    history: [],
    events: [
      {
        sequence: 0,
        scheduledMs: 0,
        messageId: "a",
        type: "assistant-start",
        text: "",
      },
      {
        sequence: 1,
        scheduledMs: 100,
        messageId: "a",
        type: "text-delta",
        text: "🙂x",
      },
      {
        sequence: 2,
        scheduledMs: 100,
        messageId: "a",
        type: "assistant-complete",
        text: "",
      },
    ],
  };
  const fixtureText = canonicalSerialize(fixture);
  const page = [
    observation("phase", null, 0, { phase: "setup" }, "setup"),
    observation("phase", null, 1, { phase: "streaming-auto-follow" }),
    observation(
      "phase",
      null,
      5,
      { phase: "composer-input" },
      "composer-input",
    ),
    observation("phase", null, 10, { phase: "streaming-auto-follow" }),
  ];
  fixture.events.forEach((e, i) => {
    page.push(
      observation("receipt", e.sequence, 20 + i, {
        eventType: e.type,
        messageId: "a",
        payloadBytes: payloadBytes(e.text),
      }),
    );
    page.push(
      observation("application", e.sequence, 21 + i, {
        eventType: e.type,
        omitted: false,
        activeMessageId: i === 2 ? null : "a",
      }),
    );
    page.push(
      observation("dom-checkpoint", e.sequence, 95, {
        receiptMs: 20 + i,
        characterLength: i ? 3 : 0,
        utf8Bytes: i ? 5 : 0,
      }),
    );
  });
  page.push(
    observation("dom-backlog", 1, 40, {
      sample: "receipt",
      receivedSequence: 1,
      representedSequence: 0,
      backlog: 1,
    }),
    observation("phase", null, 100, { phase: "validation" }, "validation"),
    observation("phase", null, 110, { phase: "disposal" }, "disposal"),
  );
  return {
    fixtureText,
    fixture,
    manifest: {
      schemaVersion: 1,
      suiteVersion: "0.1.0",
      analyzerVersion: "1.0.0",
      collectorVersion: "1.0.0",
      repetition: "1-clean",
      scenarioId: "test",
      git: { revision: "abc", dirty: false },
      fixture: {
        sha256: createHash("sha256").update(fixtureText).digest("hex"),
        file: "fixture.json",
      },
      assets: { "main.js": "a".repeat(64) },
      browser: {
        executable: "/chrome",
        version: "156",
        revision: "r",
        flags: ["--enable-automation", "--user-data-dir=/tmp/a"],
      },
      environment: {
        os: "test",
        architecture: "x64",
        cpu: { status: "available", value: "CPU" },
        gpu: { status: "unavailable", reason: "none" },
      },
      adapter: {
        id: "reference",
        configuration: { repetition: "1-clean", fault: "clean" },
      },
      configuration: {
        variant: "clean",
        round: 1,
        playwrightVersion: "1.64.0",
      },
      mode: "headless",
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
      cachePolicy: "fresh-profile-empty-cache-assets-preloaded",
    },
    evidence: {
      schemaVersion: 1,
      collectorVersion: "1.0.0",
      files: { trace: "trace.json" },
      trace: {
        format: "cdp-json",
        categories: ["blink.user_timing"],
        complete: true,
      },
    },
    producer: fixture.events.map((e) =>
      observation("producer-send", e.sequence, e.sequence ? 170 : 0, {
        actualMs: e.sequence ? 170 : 0,
        scheduledMs: e.scheduledMs,
        payloadBytes: payloadBytes(e.text),
      }),
    ),
    page,
    final: {
      transcript: [
        { id: "a", role: "assistant", status: "complete", text: "🙂x" },
      ],
      displayedText: "🙂x",
      activeMessageId: null,
      lastAppliedSequence: 2,
      replayState: "complete",
    },
    exceptions: [],
    checkpoints: {
      setup: {
        heap: { status: "available", value: { usedSize: 100, totalSize: 200 } },
        dom: {
          status: "available",
          value: { documents: 1, nodes: 20, jsEventListeners: 3 },
        },
      },
      streamingEnd: {
        heap: { status: "available", value: { usedSize: 150, totalSize: 250 } },
        dom: {
          status: "available",
          value: { documents: 1, nodes: 30, jsEventListeners: 4 },
        },
      },
      scroll: null,
    },
    trace: {
      traceEvents: [
        {
          ph: "M",
          name: "thread_name",
          pid: 1,
          tid: 2,
          args: { name: "CrRendererMain" },
        },
      ],
    },
  };
}
