# Stock Threadplane 0.3.7 and three competitor adapters: native diagnostic findings

2026-11-06. The fixed 48-case invocation attempted every planned case once: 48 valid semantic traces, 45 qualified native cases. Threadplane, CopilotKit React and Vercel AI SDK each qualified 12/12. Assistant-ui qualified 9/12; its three 10,000-message history-reading cases failed initial readiness. The invocation closed with exit 1 and remains incomplete. No exception qualifies those failed cases.

These are authored aggregate diagnostic findings. Raw traces, synthetic histories, transcripts, decoder originals and diagnostic bundles remain local. This report does not publish a performance ranking. FPS and CPU time remain unavailable.

## Configuration and custody

Controller revision `d638692057fbe9eae4562fdcf6b6cc76996c7d3c`, tree `2cf08bbdd531767eb717ef5def5b44c139a62565`, from [PR #194](https://github.com/cacheplane/chat-ui-bench/pull/194). Threadplane is the unmodified published 0.3.7 release at source `055ac2e7416ee9b83a694d74421dec2e9b26c827`, signed tag `v0.3.7`. All six synchronized npm packages were verified, including tarball integrity, packed assets and cryptographic npm provenance tied to the actual [Publish run](https://github.com/cacheplane/threadplane/actions/runs/42261350683). The benchmark consumes five packages.

The adapters use CopilotKit React/core/runtime 1.83.0, assistant-ui React 0.15.32 / React Markdown 0.14.24, and Vercel AI SDK React 4.0.163 / AI 7.0.159. These are the recorded versions, not a claim about the latest releases. The Vercel result measures this repository's UI built on its SDK; the adapters are different rendered implementations, not interchangeable products. See their [CopilotKit](../competitors/copilotkit/README.md), [assistant-ui](../competitors/assistant-ui/README.md) and [Vercel](../competitors/vercel-ai-sdk/README.md) adapter documentation and the [versioned acquisition protocol](../tools/competitor-comparison/semantic-large-stock037-v3.md).

CopilotKit mounts its shipped public v2 `CopilotChat`, which owns virtualization. Assistant-ui uses its pinned official Thread kit with all messages mounted and `content-visibility: auto`. The Vercel adapter uses public state/streaming hooks with a benchmark-owned **plain-text** renderer, composer and scroll behavior; it is not AI Elements, Streamdown or a stock chat renderer. These rendering/content differences are part of each measured configuration and prevent treating the table as equivalent renderer work.

A fresh isolated checkout selected the fixed registry pins before ordinary root and isolated competitor installs and genuine production builds. Actual default readers, all four build records, all 980 tracked source-file hashes, and the Node/ps/seven decoder-source executable facts matched before/after capture. Build identity is separate from controller identity. No shared dependency-graph security audit is being asserted by those reproducibility checks.

The host was an Apple M1 Max MacBookPro18,4 with 32 GiB RAM, arm64 macOS 26.5 / Darwin 25.5.0. Node was 24.20.0, npm 11.19.0, Playwright 1.64.0, headless Chromium 156.0.8078.4, viewport 1280×720, scale factor 1. Threadplane's production Angular runtime was 21.2.25. A fresh short private TMPDIR was set for preparation and the parent capture/browser processes. The case server retained its existing restricted environment, which does not inherit TMPDIR. External finite compiler/test jobs were absent at the pre/post snapshots. Long-lived background services remained; four observed service processes accumulated 0.02–0.06 CPU seconds each over roughly 94 seconds before launch. This is not a dedicated-host or continuously idle-host claim.

## Fixed schedule and qualification

The [existing protocol](../tools/competitor-comparison/semantic-large-stock037-v3.md) uses canonical fixtures generated through pinned `@copilotkit/aimock` 1.45.1 and the benchmark's AG-UI integration: seed 1, histories of 1,000 and 10,000 messages, 6,400 response bytes, 200 scheduled deltas at 50 ms, follow and history-reading journeys. Three serial rounds retain the fixed four-profile interleaving. No attempts were retried, omitted, replaced or reordered.

The earlier fixed16 pilot was a separate invocation: 16 valid traces, 15 qualified cases, exit 1. Its exact predeclared assistant-ui 10,000-message history-reading refusal permitted diagnostic advancement. That failed pilot row stays unqualified. Full48 has no exception and is not pooled with the pilot.

| Profile | Planned / attempted | Valid traces | Qualified native cases |
| --- | ---: | ---: | ---: |
| Threadplane | 12 / 12 | 12 | 12 |
| CopilotKit React | 12 / 12 | 12 | 12 |
| assistant-ui | 12 / 12 | 12 | 9 |
| Vercel AI SDK UI | 12 / 12 | 12 | 12 |

All three assistant-ui history-reading cases at 10,000 messages failed exactly `matrix-v5-initial-readiness-deadline`, with null admission. Their traces are valid diagnostic records of failed attempts, not successful journey measurements. Nine of twelve four-profile blocks fully qualified; the three corresponding history-reading blocks did not. No unsafe outstanding work or stop-invocation condition remained. This finding concerns the tested adapter/configuration and does not establish an upstream assistant-ui defect. No competitor upstream changes are planned.

## Observed task and layout durations

Each numeric median below is the median of **three per-run maxima**, in milliseconds. It is not a median event duration, P95, CPU time or journey latency. Native-success rows retain all three runs. A dash is unavailable because no native run in that stratum qualified. The failed assistant-ui stratum remains in the denominator.

| Adapter | History | Journey | Native pass | Median per-run maximum RunTask (ms) | Median per-run maximum Layout (ms) | Observed RunTask ≥50 ms, each round |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Threadplane 0.3.7 | 1,000 | follow | 3/3 | 28.846 | 1.909 | 0, 0, 0 |
| Threadplane 0.3.7 | 1,000 | history-reading | 3/3 | 63.644 | 1.994 | 1, 1, 1 |
| Threadplane 0.3.7 | 10,000 | follow | 3/3 | 177.406 | 24.043 | 92, 89, 90 |
| Threadplane 0.3.7 | 10,000 | history-reading | 3/3 | 214.427 | 22.427 | 90, 87, 85 |
| CopilotKit React 1.83.0 | 1,000 | follow | 3/3 | 23.043 | 1.068 | 0, 0, 0 |
| CopilotKit React 1.83.0 | 1,000 | history-reading | 3/3 | 54.675 | 1.289 | 1, 1, 0 |
| CopilotKit React 1.83.0 | 10,000 | follow | 3/3 | 512.249 | 1.584 | 4, 4, 4 |
| CopilotKit React 1.83.0 | 10,000 | history-reading | 3/3 | 648.228 | 1.134 | 4, 4, 5 |
| assistant-ui 0.15.32 | 1,000 | follow | 3/3 | 76.965 | 7.994 | 1, 1, 1 |
| assistant-ui 0.15.32 | 1,000 | history-reading | 3/3 | 74.175 | 8.147 | 2, 1, 1 |
| assistant-ui 0.15.32 | 10,000 | follow | 3/3 | 1049.524 | 52.950 | 32, 33, 31 |
| assistant-ui 0.15.32 | 10,000 | history-reading | 0/3 | — | — | Unavailable: failed readiness |
| Vercel AI SDK React 4.0.163 | 1,000 | follow | 3/3 | 12.854 | 2.294 | 0, 0, 0 |
| Vercel AI SDK React 4.0.163 | 1,000 | history-reading | 3/3 | 62.094 | 2.877 | 1, 1, 1 |
| Vercel AI SDK React 4.0.163 | 10,000 | follow | 3/3 | 128.980 | 6.345 | 2, 2, 2 |
| Vercel AI SDK React 4.0.163 | 10,000 | history-reading | 3/3 | 122.916 | 7.157 | 3, 2, 3 |

These are observed complete-X events on the owned renderer main thread across the **whole trace capture**, including public start/readiness, historical-identity and DOM scans, native input, return/final transcript checks and other observer work. Initial navigation and history hydration precede capture. Observer overhead has not been isolated. Event classes overlap; task/layout/GC values cannot be added as exclusive costs. Only top-eight duration observations per class are retained by the cost summary; they do not support population percentiles or totals.

The capture profile requests `devtools.timeline` and `disabled-by-default-devtools.timeline`, with policy SHA `bce01bad127db70b2469209a669b7258f9fa6615e3ef92d5d6c08a763d9b95c5`. Existing loss, completion, ownership, sequence, resource, source, fixture and native verification checks were preserved. All 48 stored validation references passed size/SHA-256 checks and reported valid decoding. The invocation preserves `performance:false`, `scoringEligibility:false`, `FPS:null` and `cpuTime:null`.

Headless semantic traces and renderer ownership do not establish target-surface display presentations. No frame rate is inferred from animation callbacks, trace duration, task counts or reciprocal task durations.

## What this prioritizes for Threadplane

Threadplane qualified every native journey, including all six 10,000-message cases. However, those cases observed 85–92 RunTask events of at least 50 ms per capture. Follow per-run task maxima were 168.842, 177.406 and 187.199 ms; history-reading maxima were 211.023, 214.427 and 216.197 ms. Their per-run maximum layouts were approximately 22–25 ms. At 1,000 messages, follow observed no tasks ≥50 ms and maximum layouts near 1.9–2.1 ms.

The leading work item is to attribute the 10,000-message repeated task and layout cost between live Angular view work, DOM/layout growth and benchmark observer scans. These traces alone do not assign causality or prove a particular fix. A separate profiling diagnostic should preserve this stock baseline, identify call sites, and produce a deterministic regression test for the chosen Threadplane change before a new candidate cohort. Candidate and stock observations must stay separate.

CopilotKit's 10,000-message captures show larger maximum tasks but fewer observed tasks ≥50 ms, illustrating why a single maximum is insufficient to rank the implementations. Different adapter content/layout and readiness paths also matter. The incomplete four-profile history-reading blocks preclude an all-profile successful-stratum claim. No successful-subset score is published.

Historical stock 0.3.3/0.3.5/0.3.6 and modified candidates remain separate. Controller/environment/protocol differences and intervening release changes prevent attributing a cross-version difference to one optimization. This report makes no 0.3.6→0.3.7 speedup claim.

## Reproduce without publishing raw evidence

Use the exact controller revision above in a fresh full-history checkout, verified 0.3.7 pins, the recorded toolchain, and a short initially empty private TMPDIR. Follow the [stock037 protocol](../tools/competitor-comparison/semantic-large-stock037-v3.md): selector, ordinary root install/build, each isolated competitor install/build/verify, and all four genuine default readers. Preserve controller, executable and build bookends separately. Then run the existing fixed16 CLI once into a fresh local directory, inspect its actual advancement facts, and conditionally run the existing full48 CLI once into another fresh local directory. Preserve failed rows, original process closure and complete denominators. Do not retry to obtain a passing report.

The original full48 Node process ran 2026-11-06 20:12:14–20:24:22 UTC and closed with exit 1. The retained final-manifest SHA-256 is `071171b4c26cbd780e803dc0f78134d8c5e6190ba6ae895f249eb8cd2b0f612f`. Raw evidence is deliberately local, so this public aggregate is not an independently downloadable trace dataset; reproducibility requires a fresh separately identified invocation.
