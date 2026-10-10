import type { Metric, Observation } from "@chat-ui-bench/contract";
export const PRESENTATION_REASON =
  "Presentation contract unvalidated: unchanged headed CDP trace was rejected by Chrome DevTools Performance import (Recording failed: No frames found in trace data). Capture Chrome 156.0.8078.4 and viewer Chrome 154.0.8037.98 differ; this is a possible factor, not a proven cause. No frame/presentation numbers are computed in this milestone.";
interface TraceEvent {
  ph?: string;
  name?: string;
  cat?: string;
  pid?: number;
  tid?: number;
  ts?: number;
  dur?: number;
  args?: { name?: string };
}
export function traceStall(
  trace: unknown,
  page: readonly Observation[],
): Metric {
  const unavailable = (reason: string): Metric => ({
    status: "unavailable",
    reason,
  });
  if (
    !trace ||
    !Array.isArray((trace as { traceEvents?: unknown }).traceEvents)
  )
    return unavailable(
      "Trace missing or unknown schema; no renderer task stall analysis",
    );
  const events = (trace as { traceEvents: TraceEvent[] }).traceEvents;
  const fault = page.find((e) => e.kind === "fault-stall");
  if (!fault) return unavailable("Main-thread stall calibration not requested");
  const threads = events.filter(
    (e) =>
      e.ph === "M" &&
      e.name === "thread_name" &&
      e.args?.name === "CrRendererMain",
  );
  for (const thread of threads) {
    const aligned = page
      .filter(
        (e) =>
          e.kind === "phase" &&
          !["validation", "retention", "disposal", "setup"].includes(e.phase),
      )
      .flatMap((phase) =>
        events
          .filter(
            (e) =>
              e.name === `bench:${phase.repetition}:${phase.phase}` &&
              e.cat?.includes("blink.user_timing") &&
              e.pid === thread.pid &&
              e.tid === thread.tid &&
              Number.isFinite(e.ts),
          )
          .map((e) => ({ phase, offset: e.ts! / 1000 - phase.timestampMs })),
      );
    if (!aligned.length) continue;
    const offset = aligned[0]!.offset;
    if (aligned.some((a) => Math.abs(a.offset - offset) > 5)) continue;
    const start = (fault.timestampMs + offset) * 1000;
    const end = start + Number(fault.data.durationMs) * 1000;
    const task = events.find(
      (e) =>
        e.ph === "X" &&
        e.name === "RunTask" &&
        e.pid === thread.pid &&
        e.tid === thread.tid &&
        Number.isFinite(e.ts) &&
        Number.isFinite(e.dur) &&
        e.ts! <= start + 1000 &&
        e.ts! + e.dur! >= end - 1000 &&
        e.dur! >= 120000,
    );
    if (task)
      return {
        status: "available",
        value: task.dur! / 1000,
        unit: "ms",
        evidence: [
          "trace.json: CrRendererMain metadata, aligned bench User Timing marker, RunTask spanning fault-stall",
        ],
      };
  }
  return unavailable(
    "Unvalidated stall: no supported CrRendererMain metadata + consistent User Timing alignment + spanning RunTask; arbitrary duration events are not a fallback",
  );
}
