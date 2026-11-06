# Bounded semantic trace comparisons V3

V3 adds a separate acquisition protocol for stock Threadplane 0.3.6, CopilotKit React, assistant-ui and Vercel AI SDK UI. It keeps the existing native V5 checks, fixtures, scroll/readiness behavior and two trace categories. It does not reinterpret earlier traces or alter the V1/V2 paths. Stock, modified and older release cohorts remain separate.

## Fixed runs and prerequisites

The pilot declares 16 positive cases: four profiles across H1000/H10000 and follow/history-reading. The full comparison declares 48 cases, repeating that arrangement for three rounds. Both use R6400, seed 1, and 200 Aimock deltas at 50 ms. The full schedule preserves the [stock036 interleaved order](four-profile-stock036-interleaved-v1.md), with separately versioned case IDs. Position balance remains incomplete within each stratum; machine load, warmup, thermal and carryover effects remain.

Actual captures require the reviewed published 0.3.6 pins, exact selected source/lock identities, fresh ordinary builds and passing genuine build readers described in that protocol. Installing the repository's default dependencies alone does not select this cohort. Each invocation checks the actual Node executable, seven fixed decoder sources, platform ps executable and all four typed build records before and after execution.

The only CLI argument is a fresh canonical absolute output directory:

```sh
node tools/competitor-comparison/semantic-large-v3-pilot-run.mjs --out /absolute/new-local-pilot
node tools/competitor-comparison/four-profile-stock036-large-run-v3.mjs --out /absolute/new-local-comparison
```

These are separate invocations. Neither launches the other. Review actual pilot evidence before choosing to run the full comparison; a data-only eligibility flag does not authorize a launch. There are no retries, filters, resume, replacement cases or fallback. Every planned case stays in the denominator after a stop.

## Acquisition and qualification

The fixed policy uses a 16 MiB browser trace buffer, 4 MiB compressed/64 MiB decoded limits and one isolated decoder child. A 512 MiB Node old-space setting is distinct from the observed 1 GiB RSS refusal threshold; neither is an OS-enforced memory ceiling. Loss, 90% buffer usage, missing EOF, unfinished I/O, deadline equality and unresolved owners still refuse qualification. Case/invocation/cleanup budgets remain 240/1200/30 seconds. The store reserves 1539 MiB for the pilot or 4611 MiB for the comparison within its 6144 MiB budget, with an additional 1 GiB free-space margin checked before creation and before each case.

Immediately after each case, the runner hash-verifies its raw wrapper, decoder originals, validation record and actual Aimock fixture through the existing artifact store, under the original case/invocation bounds. It validates full raw keys before removing only payloadBase64, checks the complete originals/validation before copying, and retains a bounded private join record. It releases consumed full raw/fixture promises and values before the next case. Final aggregation never rereads expired cases or emits the private join working set.

Native pass, validated trace completion and full qualification are separate counts. A paired block qualifies only with all four counterparts. The pilot's sole diagnostic advancement exception is assistant-ui's exact H10000/history-reading initial-readiness refusal at ordinal 15, position 3; its native result remains failed/unqualified. All 16 traces, other 15 native passes, fixtures, source/build bookends and resource/publication checks remain required. No corresponding full-comparison exception exists.

Pending originals remain distinct from expired waits. Unknown ownership stops further reads, cases and file publication; bounded terminal diagnostics preserve every planned outcome. Safely settled failures cannot rescue late qualification. Completion is returned only after the actual final publication settles.

## Interpretation and local custody

Available costs describe observed complete-X RunTask, Layout and MinorGC wall durations on the metadata-bound owned renderer over the whole capture, including instrumentation. They do not establish CPU time, a complete task population, a streaming-only window or displayed-frame presentation. All new results keep `performance: false`, `scoringEligibility: false`, `FPS: null` and `cpuTime: null`. No FPS or ranking is inferred from these diagnostics.

Keep captured traces, fixtures, originals and diagnostic bundles local. Pure/source tests and synthetic child/RSS controls establish implementation checks; they do not establish installed builds, actual captures, release availability or performance findings. CI runs the twelve V3 control suites explicitly and propagates Node failures through its logging pipeline.
