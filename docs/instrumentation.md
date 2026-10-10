# Instrumentation contract

The producer, reference, capture runner, and analyzer are separate npm packages.
The analyzer depends on the shared contract and captured files. It never launches
a browser, loads the reference application, or schedules the producer. The
runner CLI invokes analysis after capture; runner core has no analyzer dependency
in its runtime imports. Build order is contract, producer, reference, analyzer,
then runner. Raw schema 1 supports explicit collector/analyzer version pairs
1.0.0/1.0.0 and 1.1.0/1.1.0; the current derived analyzer version is 1.1.0.
Raw manifests are never rewritten. Unsupported schema, collector, suite, and analyzer versions
fail analysis. Historical manifests that identify analyzer `pending` need an
explicit migration decision and are never silently rewritten.

## Capture

A calibration fixture has 100 complete alternating history messages and 200 text
deltas at 50 ms intervals, bracketed by start and completion events (202 events).
Three rounds interleave clean, stall, delayed-display, scroll, omitted-delta,
retention-release, retention-retain: 21 runs. Variants inject one exclusive fault.
The producer runs in Node and schedules against its original monotonic origin,
without waiting for rendering. Its logs retain scheduled/actual timestamps,
UTF-8 payload sizes, and write backpressure. Transport disconnection terminates
the run; there is no reconnect or replacement retry.

The reference serves a production Vite build with local CSS and system font
fallbacks, no CDN fonts/assets. Every run uses a new Chromium process and empty
temporary profile/cache. Assets load before streaming measurement; this is a
cold-cache policy, not a cold-start timing claim. The viewport is 1280 × 800,
device scale 1. Setup and disposal each have 10 s deadlines; replay has 30 s.
Retention forced GC and snapshots have separate diagnostic deadlines and occur
after the replay trace ends. No GC is forced inside scored interaction phases.

Phases are setup, streaming-auto-follow, composer-input, gesture-scroll,
return-to-bottom, validation, retention, and disposal. Scroll and retention
phases exist only for their variants. Input entries are assigned by their
`startTime` against the phase timeline, not observer callback arrival time.
Performance marks identify phases in the trace. Lightweight receipt/application
and active-message checks avoid copying the historical transcript during replay;
full transcript and DOM text checks run during validation.

Recording logs, PerformanceObservers, MutationObserver, User Timing, and CDP
tracing all add instrumentation overhead. Results describe this instrumented
reference, not instrumentation-free application performance. No overhead
correction is claimed. DOM observation work is bounded to the active response;
its sequence-to-prefix length/UTF-8 mapping allows one mutation to satisfy several
received prefixes at the same timestamp.

## Evidence and independent gates

Each invocation contains `invocation.json` with order, mode, repetitions,
collector version, statuses/results, and a unique output directory. Each
`repetitions/<round>-<variant>/` directory retains:

| Raw file | Content |
| --- | --- |
| `manifest.json` | Suite/analyzer/collector/schema, Git revision/dirty state, exact browser executable/version/revision/flags, OS/architecture/CPU/GPU availability, fixture/assets, adapter/configuration, viewport, cache policy |
| `fixture.json` | Exact canonical fixture bytes covered by SHA-256 |
| `producer-events.jsonl` | Independent ordered sends and producer failures |
| `page-observations.jsonl` | Receipts, applications/active identity, DOM prefixes/backlog, phase markers, Event Timing/LoAF availability and entries, fault/reset evidence |
| `trace.json` | Unmodified CDP JSON trace |
| `evidence.json` | Collector version, file mapping, trace format/categories/completion/loss |
| `final-probes.json` | Exact logical transcript, displayed text, completion, active ID, last sequence |
| `checkpoints.json` | Setup/end renderer heap and DOM counters; scroll movement/anchor/follow checkpoints |
| `exceptions.json` | Browser page and console errors |
| `calibration.json` | Raw collector observations about stall, input, presentation |
| `validation.json` | Capture-time checks, including capture/disposal failures; never overwritten by analysis |
| `retention.json` | Snapshot availability and five-reset metadata for retention variants |
| `baseline.heapsnapshot`, `post.heapsnapshot` | Raw V8 snapshots after diagnostic GC when supported |

Partial captures keep the files produced before failure. The analyzer reports
missing/malformed raw files as failed samples. Its own validation is included in
derived per-run `metrics.json` (with metric values, reasons, ownership paths) and
`summary.md`; the invocation has the same derived filenames with every run,
calibration conclusion, and aggregation. Offline reanalysis writes only those
derived files, including a missing repetition's derived failure report.

Analysis validates schemas/versions, canonical fixture bytes/hash, scenario,
clock domains and repetition identities, exact ordered sends/receipts/applications,
event type/payload evidence, receipt-before-application, active message identity
during and after replay, exact final transcript/display text, completion, phase
boundaries, console exceptions, stream failures, and requested trace integrity.
It independently reconstructs expected behavior rather than accepting the
capture-time correctness verdict. Requested trace loss prevents scoring; absence
of optional instrumentation only makes the dependent metric unavailable.

The manifest repetition, canonical round/variant ID, adapter repetition/fault,
directory ID, and invocation entry must agree. Omitted-delta maps to the adapter's
`omit` fault. Invocation order must match the complete interleaved calibration
matrix; duplicates, substituted labels, inconsistent rounds, and reordered runs
fail analysis. Invalid/failed reports withhold retention ownership values and
paths as well as scored metrics.

The scroll variant must move 350–450 CSS px in the intended container. Its same
visible historical message must drift no more than 2 CSS px while later updates
overlap. Auto-follow pauses on upward wheel input and is explicitly rearmed by
return-to-bottom; the final checkpoint must reach bottom. Boundary gestures that
move zero distance are invalid. Invalid/failed runs contain no available scored
performance metrics, including the intentional omitted-delta variant.

## Metric meanings

- Producer lateness is actual minus scheduled send time, entirely in
  `producer-monotonic-ms`. Example: scheduled 100, actual 170 means 70 ms.
- Receive-to-DOM latency is page receipt to the first supported prefix checkpoint,
  entirely in `page-performance-ms`. Receipt 20 and checkpoint 95 means 75 ms.
  Missing/inconsistent prefix evidence makes the metric unavailable; partial
  prefixes are not silently sampled. DOM checkpoints are not painted pixels.
- DOM backlog is received sequence minus represented sequence at observed receipt
  and checkpoint samples. It does not count unseen transport queues.
- Transport latency is unavailable because clock synchronization is unvalidated.
  The shared arithmetic rejects subtracting different clock domains.
- Composer input uses observed Event Timing durations with the configured accepted
  16 ms threshold. Unsupported/below-threshold absence is unavailable, never zero;
  these events do not establish field INP or scrolling responsiveness.
- LoAF reports actual feature-detected entries. It does not count every missed
  presentation deadline. Stall calibration requires an entry spanning the injected
  fault, or independently supported trace fallback: CrRendererMain metadata,
  consistent phase User Timing alignment, and a RunTask spanning that fault.
  Arbitrary long trace events are not a fallback. Neither source means unvalidated.
- CDP Runtime heap counters are bytes for renderer V8 used/total size. DOM counters
  are counts of renderer documents, nodes, and JS event listeners. Neither is
  total browser memory.
- Retention compares baseline/post strongly reachable named paths:
  `referenceRetainedBufferOwner → ReferenceRetainedBufferOwner → retainedBuffers
  → Array element → Uint8Array → buffer → ArrayBuffer → internal backing_store
  → native system / JSArrayBufferData`. Parser offsets and types come from each
  snapshot's metadata. Weak edges are excluded, and distinct buffers/stores are
  counted once. Reported bytes sum native backing-store self sizes; these are not
  dominator retained-size estimates. Empty supported holders yield zero; unknown
  schemas, missing names/paths, or unsupported snapshots yield unavailable.
  Five retained 4 MiB buffers mean 5 / 20,971,520 bytes; the releasing control
  means 0 / 0. No 20 MiB JS heap-used increase is assumed.
- Headed collector 1.1 `rendererVisualUpdateFps` measures delivered target renderer
  visual updates, using pinned Chromium 156.0.8078.4, browser revision
  f842f52ef39fd97b449eb27cff414bf05a98ddce, and matching DevTools frontend
  2d671c506c4e5f8958b027e26047deb0acfbd7f9. AnimationFrame begin/end pairs join
  feedback by exact string `args.id`; `id2.local` identifies the async track,
  and begin-frame source/sequence are not presentation join keys. Feedback trace
  timestamps describe presentation, not callback execution time.
  Both animation begin and feedback must fall in the phase's [start,end) trace
  microsecond interval. Equal feedback timestamps coalesce to one delivery.
  The numerator is distinct eligible deliveries; the denominator is the complete
  phase duration, including idle periods. Intervals are consecutive distinct
  feedback differences within that phase, with ordinary median, nearest-rank p95,
  and maximum. Repeated phase ordinals remain separate; intervals are never pooled
  or bridged between phases. A 20 updates/s input cadence can be healthy at 20;
  the contract specifies no universal 60 FPS target.
  Scoring requires valid correctness, headed mode, pinned identity, required
  categories, complete loss-free trace, an isolated single workload page/root
  document, one renderer/main thread, and no ambiguous or changing topology.
  Boundary exclusions and non-presented pairs are diagnostics, not dropped-frame
  percentages. Zero eligible feedback is unavailable; headless presentation,
  compositor-only scrolling, global compositor FPS, and monitor refresh are
  unavailable. Old 1.0 artifacts retain unavailable presentation semantics.

The original browser-target capture failed DevTools import with “No frames found
in trace data.” The [pinned Chromium TracingHandler](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/content/browser/devtools/protocol/tracing_handler.cc) obtains frame-tree metadata
from the session's WebContents; browser-target sessions lacked that workload tree.
Collector 1.1 uses the workload page CDP session and retains the real frame-tree
response before tracing. The installed Chrome viewer revision mismatch was an
earlier unproven hypothesis, not the established cause. Legacy DevTools Frames
counts are retained separately as unscored diagnostics.

## Reporting and capability checklist

Keep headed/headless separate. Comparable group identity includes variant/fault,
fixture hash, assets, browser versions/executable, meaningful launch flags, OS,
architecture, hardware availability, suite/analyzer/collector, Git state,
viewport, cache policy, and meaningful configuration. Only repetition ID, round,
the `--user-data-dir=` ephemeral temporary value, and GPU `auxAttributes.initializationTime` (per-process startup duration, not device/config identity) are normalized. Actual raw
flags/manifests are preserved. Summaries retain all invalid/failed samples and
available sample counts, medians, ranges, and unavailable counts. Three rounds
validate instrumentation; they do not establish statistically defensible rankings.

Check supported receipt/DOM latency and backlog, independent omission rejection,
scroll correctness, observed LoAF/aligned task stall, Event Timing support and
threshold, renderer counter support, named retention paths, and presentation
contract separately. Delayed display must increase mean DOM latency/backlog over
its matched control. Unexpected invalid/failed runs and missing required variants
cause nonzero CLI exit. Unsupported stall or snapshot sources are explicitly
unvalidated, permitted as documented capability limits, never labeled passes.
Supported retention evidence must satisfy expected counts/native bytes.

The delayed-display comparison requires matching fixture/assets, browser,
hardware, mode, versions, and workload configuration. Its control identity
normalizes only the injected variant/fault in addition to the documented
ephemeral fields above. A mismatch produces a failed comparison conclusion.

Use `npm run bench:analyze -- --artifact-dir /absolute/path` to reanalyze retained
raw artifacts. Identical analyzer versions produce identical derived metrics
except recursively omitted JSON `generatedAt`; summaries compare exact bytes. Preserve raw evidence to make analysis changes
reviewable. Output directories are ignored by Git.

```sh
npm run build
node scripts/check-offline-artifacts.mjs --artifact-dir /absolute/path/to/calibration-directory
node scripts/check-renderer-presentation.mjs --artifact-dir /absolute/path/to/calibration-directory --out /absolute/external/path/presentation-check.json
```

The offline check streams SHA-256 for every raw file/path, runs the built analyzer
twice, and verifies raw inventory after each pass and all derived run/invocation
reports. It neither captures, migrates, nor requires a complete 21-slot invocation.
Unknown versions fail meaningfully after proving raw unchanged. The independent
bundled checker launches this repository's pinned Playwright Chromium inspector
only after capture completes, checks Browser.getVersion and actual trace.js and
handlers.js SHA-256, parses the unchanged trace with the full TraceModel, and
uses actual Meta frame/process/thread identities. It resets the actual
AnimationFramesHandler, reapplies its enabled configuration, feeds every original
event, and finalizes before independently applying phase arithmetic. It compares
each available phase's target, numerator, full denominator, FPS, timestamps,
differences and quantiles against already-derived production metrics. Output must
be outside the artifact directory. Unsupported/invalid/failed samples carry
explicit skip reasons and retained parser errors, with no fabricated passes.
Run inspector checks exclusively with no active workload capture. CI headless
conformance remains an instrumentation check, not a hardware baseline or ranking.
