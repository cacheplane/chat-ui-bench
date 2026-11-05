# Stock Threadplane 0.3.6: native diagnostic findings, 2026-11-05

Stock Threadplane 0.3.6 completed all 12 baseline native journeys with 12 valid semantic traces. The measurements show mixed changes relative to a separately audited 0.3.5 baseline, rather than an established overall native performance improvement. The 10,000-message workload still has substantial observed renderer tasks. FPS and CPU time remain unavailable.

This is an authored aggregate report. Raw traces, synthetic histories, transcripts, diagnostic profiles and original process records remain local. No raw diagnostic bundle accompanies this document.

## What was measured

The benchmark controller is merged revision `6aad498e0fd06e9834d6a63b89567d5c1dd56d34` (tree `1a92b75241d115fce2e47e129151df7741a0fdb7`). Threadplane is the published, unmodified 0.3.6 release from source `f34eca5f57fade29d39bcf2bf2511af8e304b04a`, signed tag `v0.3.6`. All six synchronized npm packages were verified; the benchmark consumes five of them. Selection binds exact registry URLs, SHA-512 integrities and selected manifest/lock hashes. Fresh installs, genuine production builds, actual default readers and before/after source/build bookends passed.

The fixed baseline declares two history sizes (1,000 and 10,000 messages), two journeys (follow and history-reading), a 6,400-byte response and three serial rounds: 12 attempts, with none omitted or retried. The canonical synthetic workload uses seed 1 and 200 scheduled deltas at 50 ms through the pinned `@copilotkit/aimock` 1.45.1 / AG-UI integration and benchmark-owned canonical fixtures. This does not imply an upstream Aimock fixture-compiler API. All 12 history/response/source-delta fixture digests and workload selections match their separate 0.3.5 baseline counterparts.

The actual baseline used Darwin 25.5.0 on arm64, Node 24.20.0, npm 11.19.0 and headless Chromium 156.0.8078.4, with a 1280×720 viewport and device scale factor 1. Threadplane's benchmark Angular runtime is 21.2.25. This is not a cross-machine result or a verified physical display measurement.

Capture profile `semantic-task-layout-v2` requests only `devtools.timeline` and `disabled-by-default-devtools.timeline`, with the existing 4,096 KiB Chrome buffer, 1 MiB retained compressed limit and 16 MiB decoded limit. Native gestures, readiness, source/fixture/network/DOM/transcript checks, 240-second case / 1,200-second invocation / 30-second cleanup limits and no-loss/EOF/original-ownership checks are unchanged.

## Audited 12-case baseline

All 12 native cases and all 12 trace diagnostics passed independent raw/reference/fixture/source/build/renderer-binding/cost audits. The original CLI closed with exit 0. There were no unattempted cases or unsafe outstanding originals.

Each range below spans three runs. A maximum is the longest observed complete-X event of that class in that run; it is not a percentile or the duration of the full journey. Counts are whole-capture observations on the bound renderer main thread, including scenario and observer work.

| History | Journey | Valid traces | Per-run maximum RunTask, range (ms) | Observed RunTask ≥50 ms per run | Per-run maximum Layout, range (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| 1,000 | Follow | 3/3 | 25.333–26.976 | 0 | 2.422–2.908 |
| 1,000 | History-reading | 3/3 | 25.801–59.574 | 0–1 | 2.687–2.853 |
| 10,000 | Follow | 3/3 | 187.113–190.490 | 82–84 | 33.731–34.497 |
| 10,000 | History-reading | 3/3 | 264.456–573.668 | 69–77 | 32.496–50.475 |

The 573.668 ms RunTask observation is retained. It belongs to round 3 of 10,000-message history-reading, whose trace passed the same validation and renderer binding checks. The three round maxima were 278.189, 264.456 and 573.668 ms. It was not discarded, retried or replaced; these records do not establish its cause.

These trace intervals are not CPU time, a complete task population, a streaming-only window or additive task/layout/GC totals. Headless conformance and semantic event traces do not establish displayed frames or FPS. Native results retain literal `performance:false`, `scoringEligibility:false` and `FPS:null`; cost-diagnostic artifacts additionally retain `cpuTime:null`. The native case JSON does not itself contain a CPU-time field.

## Separate 0.3.5 versus 0.3.6 descriptives

Both baselines have three qualified runs per stratum and matching workload/fixture digests. They are separate serial cohorts, without randomized release alternation or an otherwise controlled unique-fix counterfactual. The table reports the median of three **per-run maxima**, not the median duration of all tasks.

| History / journey | Median maximum RunTask, 0.3.5 → 0.3.6 (ms) | Median count of observed RunTask ≥50 ms, 0.3.5 → 0.3.6 | Median maximum Layout, 0.3.5 → 0.3.6 (ms) |
| --- | ---: | ---: | ---: |
| 1,000 / follow | 30.753 → 26.006 | 0 → 0 | 3.260 → 2.577 |
| 1,000 / history-reading | 59.065 → 47.980 | 1 → 0 | 2.648 → 2.762 |
| 10,000 / follow | 202.605 → 189.809 | 80 → 83 | 47.555 → 34.095 |
| 10,000 / history-reading | 263.497 → 278.189 | 75 → 73 | 32.694 → 33.046 |

Some observed maxima decreased, while the 10,000-message follow count increased and history-reading maximum statistics worsened. Three repetitions per stratum and this mixed pattern do not establish an overall native gain or justify combining metrics into a speed score.

Release 0.3.6 includes a deterministic Angular unit regression showing shared transcript reads reduced from 15,007 to 7 for one 10,000-message tail update. That source-level work reduction is distinct from browser latency. The release also includes other changes, including token-scale styling and transcript approvals. These separate baseline observations cannot isolate the causal effect of the shared-read fix or establish a release-wide regression cause. No FPS or CPU-time estimate is derived from them.

## Separately audited four-profile fixed48

This invocation has its own completed independent raw/reference/fixture/source/build/original/trace audit. The baseline12 above remains a separate cohort; its measurements are not pooled with these 48 attempts.

The fixed48 declares all four profiles × two histories × two journeys × three rounds, always R6400. All 48 slots were attempted. Independent replay confirmed 45 native passes, 27 complete/fully qualified trace cases, zero fully matched four-profile blocks out of 12, and no unsafe outstanding originals or unattempted slots. All original owners settled. The original CLI closed with exit 1 and aggregate status incomplete; the successful audit verifies that incomplete outcome, rather than changing it into a pass.

| Configuration | Planned / attempted | Native passes | Complete qualified traces |
| --- | ---: | ---: | ---: |
| Stock Threadplane 0.3.6, Angular 21.2.25 | 12/12 | 12 | 12 |
| CopilotKit React 1.83.0, shipped default v2 Chat | 12/12 | 12 | 0 |
| @assistant-ui/react 0.15.32 + @assistant-ui/react-markdown 0.14.24, pinned official Thread/theme | 12/12 | 9 | 3 |
| @ai-sdk/react 4.0.163 + ai 7.0.159, benchmark-owned plain-text renderer | 12/12 | 12 | 12 |

The React configurations use React/ReactDOM 19.3.1. These are concrete renderer/configuration results, not equivalent UI feature sets or universal library capabilities. No competitor upstream modification or fork was used. Trace availability and native correctness are separate outcomes: an unavailable trace is not zero work, and a valid trace cannot rescue failed native admission. The 45 native passes have validated final SDK/source/transcript facts. The three assistant-ui refusals retain pending/partial final transcript facts; this is not all-48 final SDK conservation.

All 12 CopilotKit traces and six assistant-ui H1000 traces report Chrome event loss and remain unavailable. Nine of the CopilotKit captures and all six lossy assistant-ui captures stopped for buffer usage; the other three CopilotKit captures reached the functional-body boundary but still reported loss. A below-threshold sampled highwater cannot override the independent loss flag. Retained gzip payloads being within the configured cap does not establish completeness.

The other three assistant-ui cases are H10000 history-reading, one per round, rejected by `matrix-v5-initial-readiness-deadline`. Trace start and public replay were acknowledged before that refusal. Cleanup did not deliver tracingComplete/EOF/IO close before page/browser disconnection: all three retained zero payload bytes, with data-loss status unknown. Their finish/trace-complete originals rejected and settled; they are not unsafe pending originals, successful zero-cost traces, or evidence of zero browser work. No upstream library defect or universal incapability is inferred from this one configuration and unchanged readiness budget.

With no fully qualified four-profile block, there is no defensible full four-profile ranking from this invocation. Successful subsets do not replace its 48-case denominator. The fixed Latin schedule balances each profile's position three times overall, but each stratum covers only three of four positions; it does not eliminate order, warmup, thermal, load, renderer or carryover effects.

## Separate stock036 CPU diagnostic

A separately declared CPU-profile diagnostic completed two H10000/R6400 follow-at-bottom replays with 3,637 and 3,652 samples. Both attempts and original process closure passed independent audit. This diagnostic performs no native wheel/history-reading verification and does not add samples to either native cohort.

Audited optimized-asset body inspection and structural matching to installed Angular/released source—not minified function names alone—identified recurring component/view change detection, transplanted-view refresh traversal, property-binding checks and signal dependency-link bookkeeping. The dependency-link path is not itself proof of computed-value recomputation. The 1,567 and 1,542 `(program)` samples remain unattributed to a particular application operation; they must not be assigned to rendering or treated as idle time by assumption.

These sampled stacks identify work to investigate in Threadplane. They are not CPU-time measurements, FPS, an explanation for the separate history-reading 573.668 ms event, or a causal overall performance estimate. They motivate a future local view-work reduction candidate; no result from such a candidate is reported here. The next priority is to validate that candidate locally with deterministic behavior/work regressions and a controlled diagnostic before considering another release. Competitor capture capacity remains a separate proposed future V3 protocol, unmeasured and unapplied to these V2 records.

## Reproduction and actual preparation

Use a fresh disposable checkout of the reviewed revision and fresh output directories. The original genuine preparation was built at reviewed candidate `fe6a86b6112640abacf9acdfb0f8d5a9d491f271`, then rebound to actual merged `6aad498e0fd06e9834d6a63b89567d5c1dd56d34`. Their trees are identical; all four actual default build readers returned the same raw build digests after rebinding. No rebuild or install was used to rescue drift.

The following are the actual proven command forms, with checkout/output paths supplied explicitly. Pin Node 24.20.0 / npm 11.19.0. The selector's `--expected-checkout` must be the full SHA of the disposable checkout being selected; it was `fe6a86b6112640abacf9acdfb0f8d5a9d491f271` in the original preparation. The selected app manifest and lock must match the fixed 0.3.6 hashes before proceeding.

With the disposable checkout as working directory:

```sh
node tools/threadplane-stock036/select-v1.mjs --root /absolute/disposable/checkout --expected-checkout <full-actual-checkout-sha>
npm ci
NODE_ENV=production npm run build --workspace @chat-ui-bench/contract
NODE_ENV=production npm run build --workspace @chat-ui-bench/threadplane
```

The explicit contract-first step was performed in the audited preparation. The Threadplane app build also builds contract, producer, analyzer and runner internally before Angular and build-record publication. Source inspection does not establish that the README's shorter app-build command is broken; this report includes the actual preparatory sequence instead of assuming an untested bootstrap path.

For each isolated competitor, run `npm ci --workspaces=false` with that competitor directory as working directory: `competitors/copilotkit`, then `competitors/assistant-ui`, then `competitors/vercel-ai-sdk`. Run each genuine build from the checkout root after its install, serially:

```sh
NODE_ENV=production node tools/competitor-comparison/competitor-build-v1.mjs --build --profile copilotkit
node tools/competitor-comparison/competitor-build-v1.mjs --verify --profile copilotkit
NODE_ENV=production node tools/competitor-comparison/competitor-build-v1.mjs --build --profile assistant-ui
node tools/competitor-comparison/competitor-build-v1.mjs --verify --profile assistant-ui
NODE_ENV=production node tools/competitor-comparison/competitor-build-v1.mjs --build --profile vercel-ai-sdk
node tools/competitor-comparison/competitor-build-v1.mjs --verify --profile vercel-ai-sdk
```

Use the actual default Threadplane reader and closed version guard, as in preparation:

```sh
node --input-type=module <<'JS'
import {threadplaneBuildEvidence} from './apps/threadplane/provenance.mjs';
import {assertStock036BuildV1} from './tools/competitor-comparison/aimock-stock036-v1.mjs';
console.log(JSON.stringify(assertStock036BuildV1(await threadplaneBuildEvidence()), null, 2));
JS
```

Both pre/post default reads must agree with genuine records, current source, compiled contract and assets. The audited preparation also rejected five live altered-manifest/lock/local-URL/unrelated-graph controls and restored identical positives. Physical primary entries and lock registry integrities were verified after fresh npm ci. These facts trust the ordinary locked install and recorded primary-entry bookends; they are not complete vendor-byte or publisher-security attestation, nor an audit gate on the shared dependency graph.

Only after current main/release/build gates, source binding and independent preparation review are green, invoke the separate closed entry points with fresh local output directories, without concurrent owned heavy jobs:

```sh
node tools/competitor-comparison/aimock-stock036-growth-v1.mjs --out /absolute/new-local-stock036-baseline
node tools/competitor-comparison/four-profile-stock036-interleaved-run-v1.mjs --out /absolute/other-new-local-stock036-fixed48
```

Do not retry, replace, filter or reorder failed attempts. Preserve original CLI exits and all planned statuses, verify actual process closure and independently audit raw/reference/fixture/source/build/trace joins before reporting metrics. The short `tools/threadplane-stock036/README.md` recipe covers stock selection/app preparation; a complete four-profile reproduction needs the explicit isolated installs, genuine wrappers and all default readers above. A future documentation correction should add that full preparation sequence without changing benchmark source or verification rules.

## Separate records and next decisions

The stock036 baseline12, stock036 interleaved48, historical stock035 baseline/interleaved results, older stock/modified/local diagnostics and CI strict49 are separate cohorts. Main's non-gating strict49 result was 46 matrix passes, one negative pass and two assistant-ui H10000 history-reading initial-readiness refusals. That job uses the unchanged canonical stock034 workspace/lock and does not select stock036. CI is a distinct functional configuration and environment, not another sample of the local stock036 native baseline or a substitute for its trace evidence.

The primary next priority is a locally validated Threadplane view-work reduction candidate before another release. Separately, address the audited trace-coverage/native-refusal limits without weakening checks and decide whether a future versioned common capture protocol can improve full competitor trace coverage. No larger-buffer protocol has been measured or applied to these V2 records. Competitor upstream changes, successful-subset ranking, lossy-prefix extrapolation and unsupported FPS claims are outside these findings.
