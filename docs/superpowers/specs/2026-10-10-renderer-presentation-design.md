# Validated renderer visual-update FPS

Date: 2026-10-10
Status: Independently specification-reviewed and approved within the user's
authorized autonomous research/build/review/merge scope. Implementation still
requires independent specification and quality reviews before release.

## Decision and scope

Implement a narrowly named headed `rendererVisualUpdateFps` capability using
actual presentation feedback joined to target-renderer animation-frame identities.
The user requires analytical precision and FPS. This is a separate prerequisite
change alongside the long-thread adapter milestone, not a competitor ranking.
Headless presentation, global compositor FPS, monitor refresh, and dropped-frame
percentage remain unavailable until their own evidence contracts are verified.

Three approaches were considered: a small offline source-faithful parser of the
pinned trace events (selected), vendoring the DevTools engine (unnecessary browser
dependencies and reset/config behavior), and a Perfetto/Crossbench replacement
collector (still useful for future compositor smoothness, but not required for
the validated renderer-feedback evidence). Keep one production capture path.

## Evidence established

Pinned capture browser: Chromium 156.0.8078.4, revision
`f842f52ef39fd97b449eb27cff414bf05a98ddce`.
Matching bundled DevTools revision from Chromium DEPS:
`2d671c506c4e5f8958b027e26047deb0acfbd7f9`.
Bundled trace.js SHA256:
`9ac5c69d2a98606fdfe9c1118881f353c8e7389b3e24929468374b171c357488`;
handlers.js:
`4315ac8bc6195af18e65a53fe1681ab4852fbf9e2aa5c41c2f88ff38b88ca072`.

Six loss-free headed captures changed only browser-target versus page-target CDP
tracing. Browser captures emitted empty TracingStartedInBrowser args; page captures
emitted actual frame-tree metadata. The matching bundled engine reproduced the
browser import error and parsed all three unchanged page traces. Pinned Chromium
source confirms WebContents is required to emit the frame tree.

Adding `disabled-by-default-devtools.timeline.frame` enabled the bundled legacy
frame analyzer. Its frame records are not interchangeable with renderer-feedback
FPS. The bundled AnimationFrames handler needs configuration after reset; a
small offline parser avoids that initialization problem and its permissive ID
overwrite/truncated pairing behavior.

Three further interleaved clean/stall rounds with continuous main-thread visual
updates were parsed by the actual bundled handlers, then independently paired.
All matched PID/TID/args.id checks passed. Clean maximum distinct feedback
intervals were 16.666–16.667 ms; stall maxima were 108.331–116.664 ms and overlapped
the injected 119.976–120.013 ms stall. The earlier slow clean capture remains
preserved; it was not replaced or hidden. This validates the narrow timing and
identity contract, not a universal application performance threshold.

## Collector changes and compatibility

Version the new calibration collector/analyzer as 1.1.0. Preserve explicit support
for version 1.0.0 raw artifacts with their existing unavailable presentation
semantics. Never reinterpret old captures as validated or rewrite raw files.
Unknown versions continue to fail analysis. The separate long-thread v2 suite
will reuse this capability through its own strict artifact adapter later.

New captures use the existing page CDP session for Tracing.start/end/stream I/O;
browser environment collection stays on the browser session. Add the explicit
frame category, record the target/session and category set in evidence, and
retain complete/loss status. Record actual Page.getFrameTree evidence and app URL;
require one main document and no child frames for this capability. Use fresh
isolated browser processes with one workload page. Do not synthesize metadata.

Record unique trace User Timing start/end marks for every scored phase instance,
including repeated streaming phases, and explicitly close the last phase before
ending capture. Preserve existing marks used by stall analysis. These extra
marks and categories add overhead; report instrumented behavior without a
numerical overhead correction. Existing transcript, failure, and clock gates
remain mandatory. Headed and headless are never pooled.

## Offline parser

Use a small original TypeScript module with links to the exact upstream revisions
and independently validated event subsets. No browser launch, downloaded parser,
or mutable frontend dependency is permitted during offline analysis.

Support only the pinned browser revision and the declared capability/category
contract. Resolve the primary frame and renderer from real frame topology;
confirm one CrRendererMain thread against phase-mark PID/TID. Fail capability
closed on ambiguous roots, child frames, competing same-renderer documents,
navigation/process transitions, missing metadata, malformed or lost evidence.

Gather AnimationFrame `ph:b` starts and `ph:e` ends separately by PID/TID. Ignore
same-named `ph:s/f` flow records. Sort each array by timestamp and pair by index,
as the pinned handler does; this is not a stack parser. Require complete,
sequential target-thread pairs, matching async track identities and no reversed,
overlapping/nested frames. Reject duplicate starts, orphan ends, unsafe timestamps,
ambiguous args.id, and conflicting or exact-duplicate presentation records.

Join AnimationFrame::Presentation through the start's string `args.id`, not
id2.local or a rounded numeric surface ID. Require matching PID/TID, safe finite
trace timestamps, end not preceding start, and presentation not preceding start.
Do not require file order or equal begin-frame sequence on start and feedback:
coalescing can legitimately change the presented sequence. Preserve any uint64
identity exactly or report unsupported precision. An unpresented valid pair is
not automatically a dropped frame.

Pinned Chromium emits presentation event time from
presentation_details.presentation_feedback.timestamp. It is not the callback
execution time. All rate arithmetic uses trace microseconds and exact marks;
page performance.now and producer clocks are never subtracted into it.

## Metric definition

For each exact scored phase interval `[start,end)`, include only complete paired
renderer frames whose start and presentation timestamps both lie in the interval.
Pair the whole trace before filtering. Exclude boundary-spanning pairs instead
of shifting them into a phase. Coalesce identical presentation timestamps across
distinct valid render IDs, because one visual delivery can acknowledge multiple
updates.

`rendererVisualUpdateFps = distinct eligible feedback timestamps / phase seconds`.
Use the complete phase duration, not the span between the first and last feedback
event. Report its scope, unit, numerator, denominator, target identities, phase
boundaries and boundary exclusions. Emit phase-local consecutive distinct
presentation intervals and their median/p95/max; never bridge separate phases.
No usable presentations means unavailable, not zero FPS.

This measures delivered renderer visual updates under the supplied workload.
Twenty streamed deltas per second do not demand sixty renderer updates per
second, and idle time is not a missed-frame diagnosis. Pure compositor scrolling
can continue without renderer feedback, so this metric does not establish global
scrolling smoothness. Keep dropped/partial/opportunity data separate and unscored
until a precise opportunity denominator and idle/partial reduction are specified.
Do not derive dropped frames from 60 minus FPS or count requestAnimationFrame.

## Reporting and validity

Available presentation metrics require supported metadata, category/collector
revision, headed mode, valid phase marks and raw loss-free trace, plus all existing
correctness gates. Unsupported evidence yields an explicit capability reason;
invalid/failed runs contain no scored FPS or interval numbers. Preserve failures,
unavailable counts, phase identity and per-run evidence. Never aggregate different
phases, collector revisions, browser modes, or environments into one rate.

The offline metric may be available for one phase and unavailable for another.
Current 1.0.0 artifacts remain unavailable. Existing reference calibration remains
an instrumentation check and new results do not rank libraries. Documentation
must distinguish the now-validated renderer capability from remaining compositor
and dropped-frame limitations.

## Tests and acceptance

- Commit reduced positive event fixtures retaining original event objects, full
  raw hashes, subset hashes, source indices and matching bundled-handler expected
  pair/phase counts. Clearly disclose regenerated subset containers.
- Red/green tests cover six bundled-engine goldens, shuffled file order, ignored
  flows, simultaneous deliveries, duplicate/conflicting IDs, PID/TID mismatches,
  missing/reversed/overlapping pairs, safe identity precision, unsupported mode
  or revision, lost trace, child/navigation ambiguity, and exact phase boundaries.
- Exact FPS/interval values match independently obtained bundled goldens within
  floating arithmetic tolerance; no synthetic trace fields repair a positive case.
- Capture integration tests prove page-target tracing, category/evidence policy,
  unique/closed phase marks, frame tree, and old artifact compatibility.
- Run unit/typecheck/build and existing browser conformance. Run fresh headed
  calibration without overlapping local browser measurements, inspect unchanged
  new traces with the actual matching bundled engine, and compare parser outputs.
- Reanalyze old and new artifacts twice; metrics remain deterministic excluding
  generation timestamps and every raw SHA256 stays unchanged.
- Independent spec and quality review, exact-head CI green, PR/merge, then fresh
  merged production build verification. Update README and instrumentation limits.

## Pinned primary sources

- https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/content/browser/devtools/protocol/tracing_handler.cc
- https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/frame/animation_frame_timing_monitor.cc
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/AnimationFramesHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/MetaHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/FramesHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/Processor.ts
