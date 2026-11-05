# Stock Threadplane 0.3.5 native findings, 2026-11-05 UTC

Stock Threadplane 0.3.5 passes the fresh 12-case baseline and its 12 cases in
the separately declared four-profile run. There is still substantial renderer
long-task activity with 10,000 messages. The four-profile comparison is
incomplete: no four-profile block qualifies, so this report makes no ranking.
FPS and CPU time remain unavailable.

## Release and acquisition identity

[Threadplane PR 1437](https://github.com/cacheplane/threadplane/pull/1437)
merged at `1c22d08bca079f01519e3177fd6cc588ffc90411`. The
[0.3.5 stable release](https://github.com/cacheplane/threadplane/releases/tag/v0.3.5)
published all six packages; registry tarball identities, internal dependencies,
integrities and version/latest commit identities were independently checked.
The rendering change suppresses redundant empty-to-empty tool-call and
subagent observable publications. It retains extraction/projection and
nonempty updates, including mutations to existing objects. This report does
not establish the size of its performance effect.

Both native invocations used merged benchmark controller
`f7e9594b090d545722f59ff0cd0a0e94167b6ec9`, from
[PR 184](https://github.com/cacheplane/chat-ui-bench/pull/184). Its
[main CI](https://github.com/cacheplane/chat-ui-bench/actions/runs/41988281140)
passed the required checks. The separate advisory matrix remained incomplete;
it is not evidence that every competitor case passed.

The selected Threadplane app and lockfile use published 0.3.5, without local
library patches. The raw production build record SHA-256 is
`346186b999e4c0422e575e27414de843fd496df6c977f2d02b3f099fe92efd24`.
The canonical benchmark manifest remains on its prior default; selecting
0.3.5 is an explicit separate environment. All four production build records
were unchanged at the comparison bookend.

Fixtures come from the benchmark's canonical generator and pinned
`@copilotkit/aimock/agui` integration (1.45.1), using message snapshots and
scheduled playback. This is not an upstream Aimock compiler API. Each case
has 1,000 or 10,000 history messages and a 6,400-byte streamed response, with
follow and history-reading journeys. The browser reports `156.0.8078.4`, in
headless mode at 1280 by 720, device scale factor 1. This is a reported browser
version, not physical binary or display attestation. The capture profile is
`semantic-task-layout-v2`; functional, ownership, fixture, provenance and trace
checks were retained. Machine contention outside the invocation was not
controlled.

## Separate 12-case Threadplane baseline

The original invocation exited 0: all 12 cases were attempted and passed
functional admission with complete trace bindings; none had unsafe outstanding
operations. Independent auditing regenerated canonical fixture identities,
replayed admission, verified referenced bytes and build provenance, validated
renderer bindings and recomputed each metric from decoded raw trace events.

Each row below spans three repeats. Ranges are minima and maxima, not
confidence intervals. Task counts refer only to observed complete `X`
`RunTask` events on the bound renderer main thread; the threshold is 50 ms.

| History messages | Journey | Tasks at least 50 ms per run | Longest observed task, ms | Longest observed Layout, ms |
| ---: | --- | ---: | ---: | ---: |
| 1,000 | Follow | 0 | 28.713–32.091 | 2.538–3.532 |
| 1,000 | History reading | 0–1 | 44.325–64.186 | 2.617–3.315 |
| 10,000 | Follow | 79–80 | 190.810–205.207 | 35.591–48.236 |
| 10,000 | History reading | 74–76 | 254.055–264.583 | 31.922–34.544 |

This is whole-capture evidence, including scenario work and instrumentation.
It is neither a complete task population nor a streaming-only window. Wall
duration is not CPU time. Task, Layout and GC intervals may nest or overlap;
they must not be added. The data supports investigating the 10,000-message
rendering path; it does not attribute these durations to one Angular function.

## Separate fixed 48-case comparison

The original invocation exited 1 and remains incomplete. All 48 planned cases
were attempted; no replacement cases or filtered reruns were added. The
denominator is three rounds of four history/journey strata across four
profiles. Native functional admission and complete trace evidence are
different requirements.

| Profile | Planned | Functional pass | Complete trace | Fully qualified |
| --- | ---: | ---: | ---: | ---: |
| Stock Threadplane 0.3.5 | 12 | 12 | 12 | 12 |
| CopilotKit React 1.83.0, shipped default v2 Chat | 12 | 12 | 0 | 0 |
| assistant-ui React 0.15.32 + react-markdown 0.14.24, pinned official Thread/theme | 12 | 9 | 3 | 3 |
| @ai-sdk/react 4.0.163 + ai 7.0.159, benchmark-owned plain renderer | 12 | 12 | 12 | 12 |

CopilotKit's 12 captures report trace data loss. Six assistant-ui captures
also report data loss. The collector retains its 4 MiB Chrome trace buffer,
90-percent usage refusal, complete-stream and loss checks; these captures
cannot be admitted as successful prefixes. Assistant-ui's three
10,000-message history-reading cases fail initial readiness after trace start
and before the native history-reading gesture; cleanup does not yield a
complete trace. Its three complete traces are the 10,000-message follow cases. These
are outcomes of the pinned adapters and this protocol, not demonstrated
upstream defects.

No four-profile block qualifies: 0 of 12. Profile order rotates by round and
stratum; each profile occupies each position three times overall, but only
three of four positions within each stratum. This does not fully
counterbalance order or carryover and does not establish causal rankings.
In particular, the Vercel profile uses the benchmark's plain renderer with
the SDK, whereas CopilotKit and assistant-ui use their selected shipped chat
components. This is not an equivalence claim about default chat UI products.

## Custody, limits and next investigations

Raw traces, fixtures, source reports, package proofs and failed attempts remain
local. They were copied into two separate immutable archives with complete
byte/SHA-256 inventories and independent readback. These inventory identities
are custody references, not publicly downloadable evidence:

- Baseline: `fe35f13856f57380c7363382c401dbb3717e7534c319721bb6560f7073992f34`.
- Incomplete comparison: `2970a16d7fc94fb7f6525736e4bf95e38c7f0da3edef78e8a02686219c63adce`.

Older stock versions, modified 0.3.2, local source interventions and CPU
diagnostics remain separate. There is no matched old-version control in this
baseline, so it cannot establish a 0.3.5 speedup or regression.

The next Threadplane investigation is a separately declared sampled CPU
diagnostic against the same stock build, followed by a deterministic
regression test for any attributable unnecessary work. CPU sample counts
will not be relabeled as CPU time or benchmark speedups. Competitor trace
coverage needs a separately reviewed acquisition protocol; these incomplete
captures will remain incomplete. The assistant-ui readiness failures need
adapter/protocol investigation without upstream library changes. Presentation
associations remain unverified: FPS is `null` for every result in this report.
