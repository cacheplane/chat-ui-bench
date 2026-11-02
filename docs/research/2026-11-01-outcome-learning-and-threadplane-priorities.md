# Benchmark findings and Threadplane learning priorities

Recorded 2026-11-01. This is an authored findings summary. Raw traces, generated
fixtures, SDK snapshots, captured source and diagnostic bundles remain local.

## Purpose and scope

The primary purpose of this project is to learn how long chat histories affect
browser responsiveness and use that evidence to improve Threadplane. Competitor
implementations supply comparison points and expose useful failure modes. Their
failures are outcomes to record, not a requirement to repair their libraries.

Upstream implementation changes are limited to our own Threadplane repository,
located at ~/repos/angular-agent-framework. Do not change, patch or maintain a
fork of a competitor library. Keep competitors in the bench, using disclosed
versions and configurations. A failed or unavailable case stays labeled as such;
it must not become a passing result or acquire a performance score.

## Functional comparison so far

The audited, uninstrumented matrix-v5 cohort used controller revision
c0e08c537007fdc14065fea3b45ed3272f3d3d17, fresh Aimock-generated fixtures,
100/1,000/10,000 history messages, two response sizes and two journeys.

| Profile | Positive functional cases |
| --- | --- |
| Stock Threadplane 0.3.4 | 12/12 passed |
| CopilotKit React 1.83.0 | 12/12 passed |
| assistant-ui React 0.15.32 / core 0.3.32 | 10/12 passed |
| AI SDK UI 4.0.163 / ai 7.0.159 | 12/12 passed |

The separate deliberate source-omission negative control passed. These are
functional results, not FPS measurements or a performance ranking. Earlier stock
0.3.3, modified 0.3.2, stock 0.3.4 and versioned diagnostic cohorts retain their
original identities and outcomes.

## assistant-ui finding

The two unavailable cases were history-reading at 10,000 messages, for both
response sizes. They exceeded the original four-second readiness deadline before
wheel input. Keep those failures in the comparison; no upstream change is planned.

A separate debugger-plus-stack instrumented diagnostic reproduced the
10,000-message, 6,400-byte case. The fixture scheduled 200 deltas 50 ms apart;
actual emission intervals varied.
The diagnostic matched actual browser source to the unchanged callback and
verified its owned execution context and renderer. The installation stack
identified the callback's own 50 ms timer and its matching fire event. The
install-to-fire wall interval was 4,204.863 ms. Overlapping renderer task wall intervals included 1,049.315 ms,
967.679 ms, 808.426 ms and 802.063 ms. Nested microtask intervals describe
overlapping work and must not be added to their parent tasks.

The original readiness deadline still rejected the run. The retained callback
recorded one scalar observation with zero response characters and no selected-DOM
observation. The failed-final SDK snapshot remained pending with a response
prefix, although the owned source completed its emission schedule. Source
completion is not SDK completion.

Trace transport, source custody, callsite and timer lifetime were independently
revalidated. This establishes a responsiveness finding in this instrumented
configuration. It does not establish a particular SDK function's cost, CPU
utilization, an exclusive scheduling cause or clock alignment between Node,
the document and the trace. Debugger and stack collection add overhead; do not
compare these timings directly with uninstrumented performance results.

No FPS or performance eligibility follows from this diagnostic. The result
remains invalid for readiness, with performance and scoring eligibility false
and FPS null. Source review found no justified hot-path harness fix; that is not
proof of a specific assistant-ui defect.

## Next work

A separate maintained Aimock trace V1 cohort has now completed all six declared
H100/R6400 attempts (both journeys, three rounds) against stock 0.3.4. All six
passed functional admission, but every six-category trace exceeded the 1 MiB
compressed-data cap. They retain incomplete trace status and unavailable costs;
no partial trace was decoded for costs and no FPS follows. A separately versioned
V2 semantic task/layout profile requests two categories while preserving the
same caps, ownership, transport and completeness checks. Its fresh attempts
cannot replace V1 or be compared as equivalent instrumentation.

1. Establish fresh stock Threadplane 0.3.4 functional and repeated trace baselines,
   beginning with H100. Retain every declared case and attempt.
2. Use qualified task, layout and other supported cost evidence to identify
   Threadplane improvement opportunities. Do not make FPS availability a
   prerequisite for learning from independently supported diagnostics.
3. Compare separately identified Threadplane candidate builds with stock,
   using the same fixture protocol, environment and measurement method. Keep
   stock, candidate, modified and instrumented cohorts separate.
4. Continue presentation coverage and ownership verification. Report FPS only
   when actual trace evidence supports the relevant population and interval.
5. Separate required harness/Threadplane regression checks from competitor
   observation runs. Preserve strict admission, source/content/history checks,
   negative controls, cleanup custody, failed statuses and unsafe-stop behavior.
   A green Threadplane regression check must never mean the full matrix passed.

The CI separation is implemented as a distinct twelve-cell Threadplane cohort
and unchanged strict49 observation. Shared harness contracts still verify all
profile builds and preserve the existing refusal/negative controls. The full
matrix retains its actual result; a green Threadplane cohort does not qualify
it as passing. Repository required-check metadata is managed separately from
workflow names. Competitor failures guide analysis without requiring upstream
competitor changes before Threadplane work can continue.
