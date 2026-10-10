# Shared long-thread workload and Threadplane adapter

Date: 2026-10-10
Status: Proposed; awaiting user approval

## Scope and recommendation

The next milestone makes the existing calibration foundation usable with a real
chat stack. It adds a versioned long-thread workload, an adapter host boundary,
and the public Threadplane chat composition through its actual LangGraph runtime.
It prepares the contract for competitor adapters; it does not publish rankings,
implement competitors, add a dashboard, or schedule monitoring.

Three approaches were considered:

1. Shared workload plus Threadplane first: selected. Validate one actual runtime
   and expose equivalence problems before repeating them across competitors.
2. All adapters together: faster breadth, but mixes five integration protocols,
   framework builds, renderer policies, and correctness failures in one change.
3. Resolve presentation first: needed before public smoothness claims, but the
   existing DOM freshness and renderer-counter evidence can proceed independently.

The subsequent first competitor should be assistant-ui LocalRuntime with its
official default Thread kit. Its documented virtualized composition is a separate
configuration, not a shipped virtualized component or a default configuration.
AI SDK/AI Elements/Streamdown and both CopilotKit frameworks stay in the lineup.

## Workload

Define `long-thread-prose-v1` with a deterministic generator and default seed 1.
An explicitly selected seed is stored in every fixture and comparison identity. Generate
100, 1,000, and 10,000 completed alternating user/assistant messages, each exactly
512 UTF-8 bytes of one-paragraph ASCII prose with stable IDs. The last history
message is a user message. Content has no Markdown syntax, links, images, tools,
code, reasoning, remote assets, or model calls. Use the library's normal text
renderer on this inert prose; do not replace its Markdown component for speed.

Independently vary the assistant response: 6,400 or 262,144 UTF-8 bytes, split
deterministically into 200 nonempty deltas, each containing visible non-whitespace
characters. Start at time zero, send deltas at 50 ms intervals, and complete after
delta 200. Splitting preserves exact text and event order; it must not depend on
render acknowledgments. Store canonical fixtures, hashes, byte totals, generator
version, seed, history count, response size, and chunk distribution.

Run two journeys for each size combination: streaming with the default follow
policy, and reading history during streaming then returning to the response.
This yields twelve cases per adapter configuration. Each round orders history
counts ascending, then response sizes ascending, then follow/history-reading;
record the full order and retain every repetition. Composer typing overlaps
streaming in both. Keep the existing 1280 × 800 viewport, device scale 1, local
system fonts, fresh browser/profile per repetition, independent producer clocks,
and separate headed/headless groups.

The matrix is an explicit workload, not a representation of every agent chat.
Model context size is not a browser input: only retained client history and
rendered content are varied. Markdown/code/tools require later fixture classes.

## Runtime and adapter host

Keep the reference calibration command and its seven fault variants intact.
Add a separate long-thread command and explicit suite discriminator. The new
host owns lifecycle, locators, receipt observations, phases, and runtime probes;
the stack owns its state, renderer, composer, and scrolling. The host may map
IDs and tag existing elements; it must not render a replacement message list,
inject a benchmark scroll writer, or declare its own correctness verdict.

Use version 2 contracts for the new suite, with explicit analyzer dispatch and
continued support for version 1 calibration artifacts. Unknown versions fail.
Define strict workload, adapter, build provenance, capability, and journey
metadata rather than inferring a comparison from calibration variant labels.

Receipt, transport translation, runtime observation, and DOM observation are
distinct events in the page clock domain. A yielded transport event is not proof
that the runtime applied it. Record a bounded observation of the actual active
runtime message and delivery state. Batched state or DOM updates can satisfy
several sequence prefixes at one observation timestamp. Do not require one
framework commit for every producer event. Keep transcript-wide reads outside
scored phases and avoid mapping history inside the runner's polling loop.

The adapter exposes loadHistory, connectReplay, resetThread, dispose, lightweight
replay progress, and read-only runtime transcript snapshots for validation. It
also exposes an adapter-defined content-only locator for each visible message,
the actual scroller, composer, and the library's return-to-response control.
Capabilities describe rendering coverage and default scroll policy explicitly.
Unsupported capability means unavailable evidence, not fabricated success.

## Threadplane integration

Test `@threadplane/chat@0.3.2` ChatComponent with
`@threadplane/langgraph@0.3.2` using public `provideAgent`/`injectAgent` and
`AgentTransport`. Name the profile `threadplane-langgraph-custom-transport` so
the tested integration is clear. Preserve default Markdown, chat CSS, composer,
message identities, and scroll behavior. Do not use mockAgent, mutate internal
subjects, or supply a simplified application-owned Agent as this runtime profile.

The custom transport reads the independently scheduled local SSE fixture and
translates its events to the runtime's supported StreamEvent protocol. Hydrate
history through `getHistory` and `switchThread`, awaiting public thread loading
and the projected history. Begin an assistant continuation
through `submit(null)` so no unrecorded optimistic user message is appended.
Delta messages require the public message metadata that selects chunk
accumulation. Completion emits a supported root terminal event and updates the
transport's history before closing, because the runtime refreshes history at
final sync. Both terminal/history content must be assembled from the events
actually translated, never repaired from the fixture's expected response.
Completion must be established from complete delivery, successful outcome,
settled loading, and no runtime error after the transport ends, not merely from
receipt of assistant-complete or iterator close.
Record translation evidence so an incorrect mapper cannot masquerade as a fast
renderer. Abort and disconnection terminate the run without reconnect/retry.

Use the actual component's return-to-bottom control/API and default 150 CSS px
pin threshold. Add no virtualization or benchmark-specific memoization. The
private `@threadplane/angular` text transcript is a different implementation and
is outside this profile.

Resolve all framework and peer dependencies to compatible exact versions and
commit the lockfile. Use a production Angular build with development telemetry
disabled through supported configuration. Record the selected telemetry setting.
Record package versions/integrities, framework version, build settings, adapter
source and copied-source hashes, production asset hashes, and benchmark Git SHA.
Prefer released npm artifacts; no ambient workspace aliases or mutable local
package paths. If released APIs cannot satisfy this design, report the concrete
gap and revise the design rather than silently switching to private source APIs.

## Correctness and visible coverage

Validate exact raw runtime message content, IDs, order, roles, history count,
active message identity, and completed delivery against the fixture. Do not
validate against a parallel benchmark transcript. During scored streaming,
check only the active runtime response and lightweight progress.

DOM validation is independent of logical transcript validation. For this prose
suite, define a documented projection that collapses ASCII whitespace and trims
paragraph boundaries for both expected text and content-only DOM text. It does
not remove words, punctuation, or IDs. Validate every required visible message
against its projected expected content; final active-response text must match.
Apply the same projection to cumulative streaming prefixes. This is DOM text
freshness, not pixel presentation. A Unicode/malformed-event conformance fixture
outside the performance matrix checks translation fidelity and rejected input.

Rendering coverage has two declared modes: all-mounted and virtualized. Exact
offscreen DOM presence is not a common correctness requirement. A virtualized
adapter must expose and verify visible IDs/content and sample previously unseen
history after scrolling outside scored phases. Its full logical transcript still
must be exact. Mounted DOM counts are diagnostics, not evidence of missing data.

Begin historical reading only after the assistant message has mounted, so the
library's new-message jump cannot invalidate the initial anchor. The
history-reading journey drives the same four upward 100 CSS px wheel inputs
at 50 ms cadence. Check actual movement, find a visible historical anchor, and
observe that anchor during overlapping response updates. Record movement and
drift; do not erase a run merely because anchoring drifts. Zero movement at a
boundary, wrong scroller, missing anchor, or no overlapping updates makes the
journey invalid. Report an observed scroll-policy failure separately from
transcript correctness. This differs deliberately from the reference's injected
scroll calibration, which must meet its known 2 CSS px tolerance.

Declare the library's default follow/turn-anchoring policy. Verify return through
the native control brings the active response into view, and record whether the
default policy re-arms. Do not force a competitor to bottom-follow if its default
is turn anchoring. Receive-to-DOM metrics require the active content to be mounted;
when intentionally unmounted during historical reading, report that phase as
unavailable. Follow and history-reading phases never share a pooled score.

## Evidence, reporting, and errors

Reuse the raw artifact and failure-preservation model. Add setup/history-ready
and replay-end renderer counters, runtime/translation evidence, actual visible
coverage and policy checkpoints, and strict adapter build metadata. Initial
history setup has an explicit 60 s deadline; replay remains 30 s and disposal
10 s. Timeout is a failed sample retained in the matrix, never a retry or silent
history-size reduction. No cold-start timing or calibrated memory-leak claim is
introduced. Synthetic retained-buffer fault diagnostics remain reference-only.

Report per-run and per-case receive-to-DOM latency, backlog, observed Event Timing,
LoAF, producer lateness, heap/DOM counters, movement, and anchor drift wherever
their evidence is supported. Presentation, FPS, dropped frames, transport latency,
and total browser memory remain unavailable. Full-history setup counters measure
the renderer, not the whole browser or retained dominator size.

Within-adapter repeat grouping includes identical fixture, assets, dependency
provenance, browser/hardware, mode, viewport, cache policy, and configuration.
Future cross-adapter comparison must match the common workload/environment while
retaining distinct adapter/build identities; different asset hashes are expected
across stacks and must never be discarded from provenance. This milestone emits
descriptive results only, with failures and unavailable counts, no winner or
confidence claim. Three interleaved rounds are conformance smoke validation,
not independent statistical evidence for public rankings. A later publication
protocol fixes sample size, primary metrics, uncertainty, and failure treatment.

## Verification and acceptance

- Fixture tests prove byte sizes, independent axes, determinism, canonical hashes,
  valid event lifecycle, and exact reconstructed response for all twelve cases.
- Adapter conformance proves real runtime history hydration, unchanged message
  IDs, ordered streaming, completion, reset/disposal, and translation fidelity.
- Deliberate omission in a browser conformance case is rejected independently
  even if the adapter declares completion. An invalid runtime transcript yields
  no scored performance values.
- Visible validation supports all-mounted and simulated virtualized coverage;
  unmounted active content never gets a fabricated DOM freshness value.
- Real browser checks exercise both journeys, smallest/largest history,
  short/large response, composer input, and retained failed artifacts.
- Run the full twelve-case Threadplane matrix for three interleaved rounds on
  one pinned browser/mode. Keep every result; report any failed case accurately.
  This establishes suite execution, not a performance threshold.
- Existing 137 foundation unit tests and nine browser tests remain passing.
- Fresh typecheck/build, relevant new unit/browser checks, and repeated offline
  analysis pass. Reanalysis preserves raw hashes and deterministic derived values
  apart from generation timestamps.

## Research and next decisions

Published Threadplane artifacts expose the required public component and
transport APIs. The inspected clean source revision is
`a3e5452c45369e4caba69cb51b0c1c8b186216c1`; the implementation must still check the
installed release declarations and behavior before using source-specific detail.

The presentation investigation found a concrete metadata concern: the existing
headed trace's TracingStartedInBrowser event has empty args rather than frame
topology data. Current DevTools MetaHandler has a matching import failure branch.
This is a source-aligned explanation, not a validated fix or proof about missing
presented-frame samples. Chromium's tracing handler emits frame-tree metadata
when its target has WebContents; the current browser-target tracing session is
a plausible cause. A separate bounded experiment should use the capture
browser's matching DevTools frontend and compare browser-target versus page-target
tracing for headed clean/scroll/stall cases, changing only that session. Verify
real document-frame metadata and unchanged-trace import before separately
validating actual presentation identities/timestamps and a presentation-sensitive
fault. Successful import alone is insufficient. Only then consider a
category/collector change or a separately designed Crossbench capture path.

Competitor integration constraints for later designs:

- assistant-ui LocalRuntime accepts initial history and cumulative async-generator
  output; its official default kit already uses content-visibility. Preserve it.
  Its virtualized example owns scrolling and needs separately pinned source.
- AI SDK should use its actual transport protocol and state processing; copied
  AI Elements components need source provenance, and Streamdown plugins/settings
  belong in the profile.
- CopilotKit React's current v2 path and Angular's first-party package differ.
  Validate compatible exact versions and actual agent processing. Production
  support for direct self-managed agents has conflicting documentation; prefer
  the normal runtime-backed deterministic agent or explicitly qualify the profile.

Primary references:

- https://registry.npmjs.org/@threadplane/chat/0.3.2
- https://registry.npmjs.org/@threadplane/langgraph/0.3.2
- https://www.assistant-ui.com/docs/runtimes/custom/local-runtime
- https://www.assistant-ui.com/docs/guides/virtualization
- https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- https://elements.ai-sdk.dev/components/conversation
- https://streamdown.ai/docs/code-blocks
- https://docs.copilotkit.ai/reference/v2/components/CopilotChat
- https://docs.copilotkit.ai/reference/angular
- https://docs.copilotkit.ai/angular/backend/self-managed-agents
- https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/trace/handlers/MetaHandler.ts
- https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/trace/handlers/FramesHandler.ts
- https://github.com/chromium/chromium/blob/main/content/browser/devtools/protocol/tracing_handler.cc
- https://perfetto.dev/docs/getting-started/chrome-tracing
- https://github.com/google/tachometer

Tachometer's round-robin and uncertainty reporting inform the later publication
protocol; its repository is now archived, so this design adds no runner dependency.
