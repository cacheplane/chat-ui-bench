import { expect, it } from "vitest";
import { traceStall } from "./trace.js";
import { observation } from "./fixtures.test-helper.js";
const page = [
  observation("phase", null, 20, { phase: "streaming-auto-follow" }),
  observation("fault-stall", 50, 100, { durationMs: 120 }),
];
it("requires renderer metadata and aligned User Timing, then a spanning RunTask", () => {
  const trace = {
    traceEvents: [
      {
        ph: "M",
        name: "thread_name",
        pid: 1,
        tid: 2,
        args: { name: "CrRendererMain" },
      },
      {
        ph: "I",
        name: "bench:1-clean:streaming-auto-follow",
        cat: "blink.user_timing",
        pid: 1,
        tid: 2,
        ts: 1020000,
      },
      { ph: "X", name: "RunTask", pid: 1, tid: 2, ts: 1099000, dur: 122000 },
    ],
  };
  expect(traceStall(trace, page).status).toBe("available");
});
it("does not infer a stall from arbitrary duration events", () =>
  expect(
    traceStall(
      { traceEvents: [{ name: "Something", ts: 100000, dur: 200000 }] },
      page,
    ).status,
  ).toBe("unavailable"));
