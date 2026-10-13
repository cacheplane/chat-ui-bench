# Chat UI Bench

Reproducible browser instrumentation for long, streaming agent conversations.
Maintained by Cacheplane for future Threadplane regression checks and chat-stack
comparisons. It measures a reference chat with controlled faults and captures
Threadplane long-thread evidence. Competitor adapters, a dashboard, and
comparative rankings are not implemented.

The npm workspace contains a deterministic replay contract, independent Node SSE
producer, local browser reference, Playwright/CDP capture runner, and offline
analyzer. It validates exact transcript completion, receipt/application ordering,
active message identity, scroll movement/anchoring, and evidence integrity before
scoring any sample. Failed and invalid repetitions remain in reports.

## Run it

Use Node 24+ and npm 11+; dependencies and Playwright Chromium are pinned in the
lockfile. No global browser or Python installation is required.

```sh
npm ci
npx playwright install chromium
npm run build
npm test
npm run typecheck
npm run test:browser
npm run bench:calibrate -- --mode headless --repetitions 3 --out artifacts
npm run bench:calibrate -- --mode headed --repetitions 3 --out artifacts
npm run bench:analyze -- --artifact-dir /absolute/path/to/artifacts/calibration-directory
```

`bench:calibrate` captures then analyzes, printing its new artifact directory.
`bench:analyze` reads existing raw evidence without opening a browser or starting
an SSE producer. It rewrites only derived `metrics.json` and `summary.md` files.
A successful calibration expects the three intentional omitted-delta repetitions
to be invalid, with all other repetitions valid. Unexpected invalid/failed runs
or missing required calibrations produce a nonzero exit. Supported calibration
measurements must satisfy their checks; unsupported stall/snapshot capabilities
remain explicitly **unvalidated**, with reasons, rather than fabricated passes.

Each three-round invocation interleaves seven exclusive variants: clean, stall,
delayed-display, scroll, omitted-delta, retention-release, and retention-retain.
That is 21 repetitions with 100 history messages and 200 deltas at 50 ms intervals.
Each repetition uses a fresh Chromium process/profile with local assets loaded
before measurement. Headed and headless results are grouped separately.

## Measurements and limits

CI runs on pull requests, pushes to `main`, and manual dispatches using Node 24
and npm 11. It installs locked dependencies and builds the workspaces before
running unit tests and typechecking, because workspace exports resolve to built
`dist` files. It then runs the browser conformance suite sequentially with pinned
Playwright Chromium. Failed runs retain command logs and available browser
evidence for seven days. These shared-runner checks validate instrumentation
conformance; they do not establish hardware performance baselines or rank chat
stacks.

Available evidence can derive producer lateness, page receive-to-DOM latency,
DOM backlog, observed composer Event Timing and Long Animation Frames, scroll
movement and anchoring, renderer V8 heap/DOM counters, and named retained buffer
ownership after five resets. Every metric carries its unit and evidence or an
unavailable reason. The analyzer reports comparable group medians, ranges,
sample counts, and every failure.

DOM observations approximate text freshness; they do not prove pixel
presentation. Producer/page clocks are independent, so transport latency is
unavailable. Event Timing absence below the configured 16 ms threshold is
unavailable, not zero latency, and these scripted events are not field INP.
Heap counters are not total browser memory. Retention uses strong named heap
paths and native backing storage, not a guessed JS heap increase.

Collector 1.1 supports **headed target renderer visual updates** through the
phase-local `rendererVisualUpdateFps` capability. Each phase counts distinct
presentation feedback timestamps whose animation begin and feedback both fall
inside its trace-clock boundaries, divided by the full phase duration. Reports
include consecutive feedback intervals, median, nearest-rank p95, and maximum.
Correctness, pinned browser identity, complete traces, and supported single-page
topology gate scoring. A workload supplying 20 updates/s can have a healthy
20 updates/s rate; this is not a 60 FPS target. Headless presentation, global
compositor FPS, monitor refresh, and dropped-frame percentages remain unavailable.
Old collector 1.0 artifacts retain their original unavailable presentation meaning.

The original DevTools import failure came from browser-target CDP tracing lacking
the workload WebContents frame tree. Pinned Chromium's TracingHandler uses the
page session to identify that tree; collector 1.1 captures through the workload
page session. The historical viewer/capture revision mismatch was an unproven
hypothesis. Independent bundled-parser checks now verify retained traces without
recapturing or changing raw evidence.

After building, reproduce determinism and the independent headed bundled check:

```sh
node scripts/check-offline-artifacts.mjs --artifact-dir /absolute/path/to/calibration-directory
node scripts/check-renderer-presentation.mjs --artifact-dir /absolute/path/to/calibration-directory --out /absolute/external/path/presentation-check.json
```

The offline checker opens no browser. It hashes every raw artifact before and
after two analyses and compares every derived report, ignoring only JSON
`generatedAt`. The bundled checker launches the pinned inspector after capture,
verifies runtime Chromium and both bundled resource hashes, and compares actual
DevTools handler output to already-derived production metrics. Run it exclusively
with no workload capture in progress. Partial/failed invocations remain failures
in analysis; determinism checks do not certify a complete calibration or ranking.

See [instrumentation and artifact contract](docs/instrumentation.md) for evidence,
clock domains, grouping, capability checks, overhead, and reanalysis limits.
The [approved design](docs/superpowers/specs/2026-10-09-instrumentation-foundation-design.md)
sets the milestone boundaries. Reference calibration results are instrumentation
checks and do not rank chat stacks.

## Planned comparison adapters

The shared version 2 workload contract and independent replay producer are
implemented. The canonical matrix contains 100, 1,000, or 10,000 historical
messages; 6,400 or 262,144 response bytes; and follow or history-reading journeys.
Each case has 200 deltas scheduled at 50 ms intervals. Canonical validation
regenerates every ID and content byte from the declared seed before replay.

The contract exports `createLongThreadFixture`, `createLongThreadMatrix`, and
`validateCanonicalLongThreadFixture`. The producer exports
`startLongThreadReplay` and `createLongThreadReplayServer`, preserving independent
deadlines and recording actual emission timing, backpressure, and terminal
failures. Runtime and visible-DOM evidence have separate contracts so future
virtualized adapters can report their actual coverage.

The Threadplane Angular custom-transport profile is implemented with pinned
`@threadplane/*` 0.3.2 and Angular 21.2.25. It uses the published packages and a
local deterministic SSE replay transport. This profile is distinct from a
default deployment connected to a model backend.

After building, collect long-thread evidence in a fresh output directory:

```sh
npm run bench:long-thread -- --mode headless --rounds 1 --seed 1 --out /absolute/path/to/new-conformance-directory
npm run bench:long-thread -- --mode headed --rounds 3 --seed 1 --out /absolute/path/to/new-publication-directory
npm run test:browser:threadplane
npm run test:browser:comparison
```

The capture command preserves every scheduled slot, raw evidence, correctness
result, and finalization status. Headed collection requires all three rounds
(36 slots); headless collection is for conformance. Collection returns a failure
when a slot fails its checks. The reference `bench:analyze` command does not
analyze these version 2 artifacts. Long-thread offline analysis, presentation
eligibility, competitor adapters, and comparative reports remain in development;
these capture commands do not establish published FPS results or rankings.

Private offline renderer diagnostics describe matched target Blink
`AnimationFrame` lifecycle records and their emitted presentation callbacks
inside admitted trace windows. They include short monitored frames, but coverage
of all compositor or display frames is unverified. Callbacks can coalesce onto
one later compositor feedback or use fallback swap/failure timestamps. Legacy
`rendererVisualUpdateFps` field names and the `updates/s` unit label remain for
compatibility; they do not qualify display FPS or complete renderer updates.
Conditional parser availability does not establish source execution, coverage,
an independent oracle or scoring eligibility. Historical reports stay unchanged.

The private offline comparison CLI accepts the explicit opt-in
`--trace-policy streamed-renderer-events-v1`. Its default keeps the original
8,388,608 JSON work limit. The new policy validates the complete JSON stream
under a separate 16,777,216 work ceiling and retains bounded original renderer,
metadata, lifecycle and canonical mark records for the same parser. It never
falls back from a failed default load. Reports distinguish scanner EOF, stopped
prefix statistics and independently closed physical bytes, retain every admitted
slot and reported verdict, and remain ineligible for scoring. Read buffers are
at most 65,536 raw bytes; transient decoded strings are bounded in UTF16 code
units, not physical heap bytes. This policy does not establish frame coverage,
source execution, origin equivalence or FPS.

New CLI captures use collector/analyzer family 2.1.0. Scored scroll checkpoints
acquire current page geometry on demand; the later history checkpoint waits
until at least 800 ms after the original post-wheel sample on the same page
clock. Polling observations remain separate. Instrumentation records fresh
callback counts, duration, and observed gaps. A whole-text range can reject
offscreen content, but an overlapping bounding box never proves visible glyphs.
Native range queries can force layout and enumerate text fragments, so fewer
JavaScript queries alone do not establish lower rendering overhead.

| Stack | Planned configurations |
| --- | --- |
| Threadplane Angular | Implemented custom transport; documented default planned separately |
| assistant-ui React | Default kit and documented virtualized composition |
| AI SDK + AI Elements + Streamdown | Documented chat composition |
| CopilotKit Angular | Compatible released Angular configuration |
| CopilotKit React | Documented React chat composition |

Each future comparison must disclose exact library/framework versions, content
features, renderer, configuration, and build revision. Defaults and optimized
configurations will be reported separately after their equivalence is verified.
