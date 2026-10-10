# Chat UI Bench instrumentation foundation

Date: 2026-10-09
Status: Draft for user review
Repository: https://github.com/cacheplane/chat-ui-bench

## Purpose and decisions already established

Build an open, reproducible benchmark suite for long, streaming agent chats.
The immediate product goal is credible public competitor comparisons; the same
workloads will later monitor Threadplane regressions. The user selected a
standalone public repository in the Cacheplane organization and approved this
comparison lineup:

- Threadplane Angular.
- assistant-ui React, default and documented virtualized compositions.
- AI SDK with AI Elements and Streamdown.
- CopilotKit Angular.
- CopilotKit React.

This spec covers one prerequisite milestone: prove the measurement and replay
contract using a small reference chat. It does not implement the five competitor
adapters, a hosted dashboard, scheduled monitoring, or real-user telemetry.
Those are subsequent milestones with their own plans. Reference results are
instrumentation checks, not competitor rankings.

## Alternatives and selected direction

1. TypeScript, Playwright, CDP, and a versioned trace analyzer: selected for the
   foundation because it supports scripted interactions and correctness checks
   in one runner, and aligns with Threadplane's existing browser tooling.
2. Chromium Crossbench as the main runner: credible alternative for native
   Perfetto capture, browser controls, and future device expansion. Evaluate
   its capture path only if the initial CDP trace cannot support the required
   presentation measurements. Do not maintain two runners in this milestone.
3. Tachometer as the main runner: useful for defined timing comparisons and
   repeated sampling, but the chat journeys require additional interaction and
   trace collection. Adopt interleaved runs and explicit uncertainty later.

A failed capture experiment must narrow the published capabilities rather than
create a guessed FPS or dropped-frame metric. A switch to Crossbench requires a
small separate design decision explaining the missing evidence and cost.

## Foundation deliverable

An npm workspace with a TypeScript command-line runner, a local fixture producer,
a minimal browser reference chat, a versioned artifact schema, and automated
validation. Use one pinned Playwright Chromium revision for automated smoke
runs. Record the actual executable, browser version, and launch arguments.
Support headed execution on local hardware for presentation validation; classify
headless output separately and never combine those samples.

Use TypeScript, npm workspaces, Playwright, Vite for the reference page, and
Vitest for deterministic unit tests. Do not introduce Nx for this small
standalone repository. Exact dependency versions will be selected and locked
during implementation; all capture-dependent APIs must be checked against the
installed versions, not tip-of-tree documentation alone.

## Components and boundaries

| Unit | Responsibility | Dependencies |
| --- | --- | --- |
| Contract | Validate fixture, adapter metadata, observations, and run artifacts | TypeScript and schema validation |
| Producer | Replay ordered events from an independent monotonic schedule | Contract, Node HTTP server |
| Reference chat | Render messages, expose stable locators and read-only checkpoints, inject controlled faults | Contract, browser APIs |
| Runner | Own lifecycle, drive input, bracket phases, collect observations and traces | Contract, Playwright/CDP |
| Analyzer | Derive available metrics, enforce evidence requirements, emit JSON and Markdown summaries | Contract, captured artifacts |

The analyzer never launches a browser. The producer never waits for a render
acknowledgment before scheduling the next event. The adapter cannot declare
correctness or timing results; the runner checks observable outcomes.

## Workload and adapter contract

A fixture contains a schema version, stable scenario ID, generator version and
seed when generated, initial history, and events with sequence number, relative
scheduled time in milliseconds, message ID, event type, and text payload.
Initial event types are assistant-start, text-delta, and assistant-complete.
Chunks are exact strings; report UTF-8 byte counts independently of string
length. Fixture SHA-256 covers canonical serialized content. Store that exact
serialized fixture with each run.

No provider tokenization or network model call is needed. Message IDs and event
ordering are deterministic. Invalid schedules, duplicate sequence numbers,
events after completion, and unknown message IDs fail validation before launch.

Reference adapter operations are loadHistory, connectReplay, resetThread, and
dispose. Read-only probes return the logical transcript, active message ID, and
last applied sequence. Stable browser locators identify the scroll container,
composer, message IDs, and active response. These operations are semantic
requirements for future adapters; they must eventually use supported runtime
APIs rather than replace a competitor's runtime with the benchmark's state.

The producer sends sequence-tagged events over SSE from a local Node process.
It records planned and actual send times, payload bytes, and backpressure.
Send deadlines are relative to the producer's monotonic clock. Late sends are
logged and sent in sequence without shifting later deadlines. Disconnection
terminates that repetition; it is not silently resumed or retried.

Record scheduled and actual send times in the producer clock domain and receipt
and application times in the page clock domain. Do not subtract different clock
domains. Producer lateness is actual minus scheduled send time; receive-to-DOM
latency is measured entirely in the page. Transport latency is unavailable in
this milestone, unless a later spec defines validated clock synchronization.

## Calibration scenarios

Use 100 completed alternating messages and one active assistant message, with
fixed local styles, font fallbacks, a 1280 by 800 viewport, and device scale 1.
Use a fixture totaling 200 deltas, one every 50 ms, with exact expected text.
The reference implements no framework and serves only as a calibration target.

Run a clean control and independent variants:

- Main-thread stall: a 120 ms busy interval begins after delta 50 is applied.
- Delayed display: continue receiving events but flush visible text every 200 ms.
- Retention: retain a 4 MiB Uint8Array in a module-owned collection on each of
  five thread resets; the matched control releases those buffers.
- Scroll: drive a fixed-distance, fixed-speed upward gesture while replay is
  active, followed by a return-to-bottom action.
- Correctness fault: intentionally omit one delta to prove incorrect output
  cannot receive a valid performance result.

Run scroll distances within available content and verify that the scroller
actually moved; a gesture on an already reached boundary is an invalid scenario.
The reference pauses auto-follow on upward user input and resumes it only on
return-to-bottom. During historical reading, identify a visible message and
measure its viewport offset before and after updates; allowed drift is 2 CSS px
after settling. The stall is a synchronous fault injection, not a model of every
real browser bottleneck.

The main-thread stall also delays SSE receipt callbacks. Consequently,
receive-to-DOM latency can stay low when queued events are received and applied
immediately after the stall. This variant validates LoAF/trace stall detection;
it does not require DOM backlog to increase. The delayed-display variant
independently validates receive-to-DOM latency and backlog detection.

## Observations and metric definitions

| Metric | Evidence and interpretation |
| --- | --- |
| Producer lateness | Per-event actual minus scheduled send timestamp in Node |
| Receive-to-DOM latency | Page receipt to first observed DOM checkpoint containing that sequence's text prefix; approximation, not pixel presentation |
| Visible backlog | Received sequence minus last sequence represented in DOM at a checkpoint; label as DOM backlog |
| Input response | Event Timing entries for scripted composer key presses; per-event timings, not a field INP claim |
| Long Animation Frames | Feature-detected entries exceeding the API threshold; diagnostic, not all missed frames |
| Scroll movement and anchoring | Scroller movement and stable message offset, measured at phase checkpoints |
| Heap and DOM | Supported CDP values with units and scope; JS heap is not total browser memory |
| Retained buffers | Post-GC heap snapshots inspected for retained ArrayBuffers in a separate retention diagnostic |
| Scroll presentation | Versioned trace-derived presentation intervals and jank only when required events and supported analysis are verified |

Receive-to-DOM observations use a MutationObserver and sequence-to-prefix-length
mapping on the reference response. One mutation may satisfy several sequences;
all receive the same observation timestamp. No render-time paint claim follows.
Bound observer work to the active response. Perform full transcript validation
outside scored phases; do not scan history on every delta.

Use PerformanceObserver for Event Timing and LoAF when supported. Record the
configured Event Timing duration threshold, and mark below-threshold events as
not observed, not zero latency. Do not use requestAnimationFrame callbacks to
count presented frames. Streaming auto-follow and synthetic user scrolling must
have distinct phase IDs because Chrome gesture-scroll analysis does not
necessarily describe programmatic scroll writes.

V8 CPU profiles and allocation sampling are optional diagnostic reruns. Heap
snapshots and forced GC belong only to retention diagnostics. They must not run
inside the scored streaming or input phases. Uint8Array backing storage cannot
be assumed to appear in JSHeapUsedSize; retained-buffer calibration uses snapshot
evidence rather than demanding a 20 MiB JS heap counter increase.

## Trace collection validation

Collect a browser trace through CDP with a pinned category set covering user
timing, timeline work, input, compositor/frame events, and V8/GC where supported.
Keep screenshots and expensive profiling out of the standard score run. Store
trace format, category configuration, and collector version with the raw trace.

Implementation must first inspect a headed calibration trace and verify its
phase markers, renderer identity, gesture input events, and frame/presentation
evidence. Ordinary CDP JSON must not be assumed to contain every native Perfetto
field. Pin the analyzer and, if used, the Perfetto Trace Processor version and
binary hash. Query required data and reject unsupported trace schemas.

The foundation may ship with presentation metrics unavailable if collection
cannot be validated. Such output must state the reason, must omit FPS claims,
and is not ready for a public smoothness comparison. The remaining latency,
replay, correctness, and retention capabilities remain independently testable.

## Execution and artifacts

Intended commands are npm run bench:calibrate for capture, npm run bench:analyze
with an artifact-directory argument for offline reanalysis, npm test, npm run
typecheck, and npm run build. The planning stage will define their exact CLI
options. No global browser or Python installation is needed for ordinary smoke
runs; optional trace analysis has explicit installation and version instructions.

Every invocation creates a new output directory. A run manifest includes schema
and suite versions, Git revision and dirty status, fixture and asset hashes,
adapter configuration, repetitions, browser executable/version/revision/flags,
mode, OS/architecture, available CPU/GPU information, viewport, scale, and cache
policy. Unavailable environment fields carry an explicit reason.

Store fixture JSON, producer event log, page observations, raw trace, run manifest,
validation results, metrics JSON, and Markdown summary. Outputs are ignored by
Git. Record all repetitions including failures; never replace a failed run with
a passing retry. Incomplete artifacts remain inspectable but cannot be scored.

Use fresh browser processes per repetition and record an explicit cold policy:
empty profile/cache, with local assets loaded before the scored streaming phase.
This milestone does not claim cold startup performance. Run each calibration
variant three times in interleaved order on the same hardware, and report each
sample plus median and range. Three repetitions validate instrumentation only;
they do not establish statistically defensible competitor rankings.

## Errors and correctness

Run status is valid, invalid, or failed. Each metric independently has available
or unavailable status; unavailable metrics have a reason and no numeric value.
Invalid means the scenario ran but violated its workload, correctness, or
capture requirements. Failed means launch, transport, collection, or analysis
could not finish. The runner always closes browser and server resources.

Timeouts are explicit phase limits, not successful completions. A 30-second
replay deadline and 10-second setup/disposal limits bound the foundation. The
analysis must reject duplicate events, wrong final text, missing completion,
wrong active message, zero-distance scroll, console exceptions, disconnected
streams, and trace loss when a trace-derived metric is requested. Instrumentation
absence only makes that metric unavailable unless the scenario requires it.

## Verification and acceptance

- Unit tests cover schema rejection, deterministic fixtures/hashes, sequence
  prefix mapping, same-clock timing arithmetic, metric availability, and artifact
  rejection. Tests exercise failure cases rather than mirror data structures.
- Browser checks prove the control's final transcript is exact and the deliberate
  omitted delta produces an invalid result.
- The 120 ms fault produces a matching LoAF or trace main-thread stall when
  supported. If neither source is available, stall detection remains explicitly
  unvalidated. Do not infer absence of a stall from low receive-to-DOM latency.
- The 200 ms batching fault increases receive-to-DOM delay/backlog while preserving
  final text. Delivery logs show that the producer did not intentionally throttle
  to wait for rendering.
- The retention diagnostic distinguishes reachable retained buffers from the
  releasing control after five resets. If snapshot support is unavailable, this
  calibration cannot claim retention measurement is validated.
- Scrolling moves the intended container and reading position stays within the
  declared tolerance while new content arrives.
- Reanalysis from stored artifacts produces identical metrics for the same
  analyzer version, excluding explicitly recorded generation timestamps.
- Headed presentation evidence is inspected and cross-checked against Chrome
  DevTools before any presentation metric is labeled validated. If no compatible
  headed environment is available, document the capability as unvalidated.
- Type checking, unit tests, build, and browser calibration run successfully,
  with actual limitations recorded in the delivery report.

Do not hard-code an FPS threshold, publish rankings, or assert Threadplane is
faster during this milestone. Subsequent adapter designs must define equivalent
content/features, production configurations, history scaling, and sufficient
independent repetitions before comparison publication.

## Follow-on order

1. Instrumentation foundation described here.
2. Threadplane adapter plus the shared long-thread workload contract.
3. Competitor adapters using that same contract, including CopilotKit React.
4. Dedicated-hardware comparison runs and a reproducible public report.
5. Regression monitoring reusing pinned workloads and environment identities.

## Primary references

- https://playwright.dev/docs/api/class-cdpsession
- https://developer.chrome.com/docs/devtools/performance/reference
- https://developer.chrome.com/docs/web-platform/long-animation-frames
- https://web.dev/articles/inp
- https://developer.chrome.com/docs/devtools/memory-problems
- https://perfetto.dev/docs/getting-started/chrome-tracing
- https://perfetto.dev/docs/analysis/stdlib-docs
- https://chromium.googlesource.com/crossbench
- https://github.com/google/tachometer
- https://www.assistant-ui.com/docs/guides/virtualization
- https://elements.ai-sdk.dev/components/conversation
- https://streamdown.ai/docs/memoization
- https://docs.copilotkit.ai/angular
