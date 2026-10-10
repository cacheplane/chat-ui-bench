# Chat UI Bench

Reproducible browser benchmarks for long, streaming agent conversations.

Chat UI Bench will measure how chat implementations behave as conversation
history, active response size, content complexity, and event frequency grow.
It is maintained by Cacheplane to monitor Threadplane and publish reproducible
comparisons with other chat stacks.

**Status:** design stage. No benchmark runner or comparative results are
available yet. The choices below describe the intended scope, not implemented
capabilities or measured performance claims.

The first milestone is specified in the
[instrumentation foundation design](docs/superpowers/specs/2026-10-09-instrumentation-foundation-design.md),
currently a draft for review.

## Initial comparison stacks

| Stack | Configurations |
| --- | --- |
| Threadplane Angular | Current documented default |
| assistant-ui React | Default kit and documented virtualized composition |
| AI SDK + AI Elements + Streamdown | Documented chat composition |
| CopilotKit Angular | Compatible released Angular configuration |
| CopilotKit React | Documented React chat composition |

Every result must identify exact library and framework versions, renderer,
configuration, and build revision. Documented defaults and optimized
configurations will be reported separately. Framework compatibility must be
verified before versions are selected.

## Initial workloads

- Restore a populated conversation at increasing history sizes.
- Scroll through history while an assistant response streams.
- Type in the composer and operate controls during streaming.
- Switch between populated conversations and measure cleanup.

Further workloads may cover one enormous response, rich Markdown, many tool
calls, expanding cards, and prepending earlier history.

History size, mounted content, active response size, chunk size, and event rate
are separate workload dimensions. Model context-window size alone does not
define the browser workload.

## Measurement principles

- Use deterministic fixtures and replay; exclude live model variability from
  controlled frontend comparisons.
- Pace the event producer independently of the page's main thread and record
  delivery timing so stalls cannot silently reduce the offered workload.
- Measure the full browser pipeline. V8 profiling explains JavaScript and
  allocation costs; Chromium traces are needed for rendering and presentation.
- Report scroll smoothness, input responsiveness, streaming freshness, and
  memory separately. Average FPS alone is insufficient.
- Do not equate animation callbacks or DOM mutations with presented frames.
  INP does not measure scrolling, and Long Animation Frames do not capture every
  missed frame deadline.
- Validate content and scroll correctness. Missing content, broken anchoring,
  or incomplete captures must not appear as performance wins.
- Allow supported virtualization and batching, with their configuration,
  content delay, and functional tradeoffs disclosed.
- Separate production-build measurements, cold/warm conditions, natural-GC
  interaction runs, and forced-GC retention diagnostics.
- Repeat and interleave comparisons; report uncertainty and failures, not only
  the fastest sample.

## Proposed tooling

The leading option is a TypeScript runner using Playwright and Chrome DevTools
Protocol, with versioned Perfetto analysis. Chromium Crossbench should also be
evaluated for automated trace collection before the capture approach is fixed.

The first technical milestone is instrumentation validation against a pinned
browser: demonstrate that controlled stalls, delayed updates, scrolling, and
retained allocations produce the expected measurements. Unsupported metrics
must be marked unavailable rather than reported as zero.

## Reproducing published results

Future publications should include adapter source, fixture hashes, lockfiles,
raw samples, browser traces, analyzer version, and the commands used to run them.
Hardware, OS, browser revision, GPU configuration, viewport, typography,
enabled features, and cache conditions must be disclosed.

Results should show scaling curves and where each stack degrades. A single
aggregate ranking is not the initial goal. Browser upgrades and library changes
must be distinguishable in regression history.

## Research references

- [V8 real-world performance methodology](https://v8.dev/blog/real-world-performance)
- [Chrome frame classifications](https://developer.chrome.com/docs/devtools/performance/reference)
- [Interaction to Next Paint](https://web.dev/articles/inp)
- [Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames)
- [Perfetto Chrome tracing](https://perfetto.dev/docs/getting-started/chrome-tracing)
- [Perfetto SQL standard library](https://perfetto.dev/docs/analysis/stdlib-docs)
- [Chromium Crossbench](https://chromium.googlesource.com/crossbench)
- [Tachometer](https://github.com/google/tachometer)
- [assistant-ui virtualization](https://www.assistant-ui.com/docs/guides/virtualization)
- [AI Elements Conversation](https://elements.ai-sdk.dev/components/conversation)
- [Streamdown memoization](https://streamdown.ai/docs/memoization)
- [CopilotKit Angular](https://docs.copilotkit.ai/angular)
