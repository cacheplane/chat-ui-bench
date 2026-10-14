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

Collector 1.1 retains the phase-local `rendererVisualUpdateFps` capability for
compatibility. Its numerator counts distinct emitted feedback timestamps joined
to matched target Blink `AnimationFrame` lifecycle records whose begin and
feedback both fall inside the phase's trace-clock boundaries; its denominator
is the full phase duration. Reports include consecutive timestamp intervals,
median, nearest-rank p95, and maximum. This is a conditional trace association
rate. Coverage of all renderer, compositor, or display frames is unverified.
Callbacks can share one later compositor feedback, and failure paths can use
fallback swap timestamps. Correctness, pinned identity, complete traces, and
supported topology validate parser prerequisites; they do not establish display
FPS or timestamp origin. Existing field names, numbers, and historical scoring
gates remain unchanged. Headless presentation, global compositor FPS, monitor
refresh, and dropped-frame percentages remain unavailable. Old collector 1.0
artifacts retain their original unavailable presentation meaning.

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

## Release-only direct HttpAgent transport preparation

`tests/support/hosted-httpagent-contract.test.ts` checks inert admission, bounds,
projection and ownership data without loading the SDK, AIMock, fixtures or allocating
transport helper. Run those controls with
`npm test -- tests/support/hosted-httpagent-contract.test.ts --no-color`.
`npm run typecheck:fixtures` also checks the hosted matrix, helper, dedicated
configuration and public consumer signatures with strict `noEmit`; it resolves
installed types without executing their values. The consumer configuration retains
`skipLibCheck` for dependency declarations.

Default and browser test configurations explicitly exclude `tests/hosted/**`.
The guarded `test:hosted:httpagent` script is reserved for a separately reviewed
hosted release; do not invoke it locally, including to exercise a denial path.
Its first guard reads actual inert `.ts` source using Node 24 native TypeScript
stripping, before Vitest loading. The dedicated configuration admits before test
discovery, and the module independently admits before dynamically loading the
complete SDK/AIMock/fixture/allocating graph. No compiled guard or dependency
loader substitutes for the native pre-dependency check.

The manual-only `Hosted HttpAgent conformance` workflow uses Ubuntu 24.04, Node
24.20.0, npm 11, pinned action revisions and the existing lockfile. A root-reviewed
release supplies only `candidate_sha` and `release_id`; its unused immutable tag
is `hosted-httpagent-${release_id}`. Checkout, trigger, workflow source and resolved
tag commits must all equal the candidate, with exact full tag/workflow references
and first attempt. Flags prevent accidental execution; they do not prove root
authorization or historical single use. Root verifies the actual published source
and remote immutable tag immediately before the one later dispatch. Never move,
overwrite, reuse, retry or dispatch another attempt of that release.

Actual hosted SDK qualification is pending. The prepared serial profile has eight
HTTP operations: SDK restoration, same-agent continuation, deterministic protocol
error, SDK content mismatch, SDK recognized metadata mismatch, raw wrong ID,
settled-reset raw restoration miss and raw continuation miss. It uses H100/R6400,
15-second operation and 10-second disposal limits, 512,000-byte bodies and 8 MiB
retained capture. These are fixed liveness choices, not measured timing findings.
Raw matcher failures are labeled separately from SDK evidence. Callback projections
remain small; full wire/history oracles and actual raw publication live outside
callbacks. SDK public promise disposition, finalization notification and idle state
are distinct from harness-owned original/resource settlement. Boundary byte equality
borrows captured chunks across arbitrary segmentation and hashes them incrementally;
only the original semantic request and client wire response need joined copies.
Raw-file and normal-receipt publication witnesses reuse one prepaid 64 KiB scratch
buffer with serial no-follow regular-file reads, exact EOF/hash checks and observed
original close. These observations occur outside the disposed transport horizon,
within the same matrix deadline. Bounded terminal decoding retains its own charges.
Public SDK observations do not prove
inaccessible private SDK finalizer or cancellation promise completion.

Success/failure artifacts retain initial incomplete workflow evidence, full normal
observations and raw bytes, separate reduced terminal summaries, bounded command
logs and actual exit status. A summary records its own publication as pending;
the outside driver must await its original write and verify the actual artifacts.
Missing artifacts, incomplete settlement, log overflow or hard termination remain
failure. A shallow fixed-file inventory admits no symlinks or recursion and bounds
all actual uploaded files together to 8 MiB. On inventory failure it retains the
original files and bounded job diagnostics and denies upload; that failure never
claims successful cleanup. A later passing run could qualify only the pinned direct
Node/Linux AG-UI
profile. React/provider/entitlement, browser origin/rendering, native closure,
presentation timing, FPS and ranking remain deferred.

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

Shared chat/agent test fixtures use the pinned development dependency
`@copilotkit/aimock` 1.45.1 through `tests/fixtures/aimock.ts`:

```ts
import { AGUIMock } from '@copilotkit/aimock/agui';
import { createLongThreadFixture } from '@chat-ui-bench/contract';
import { registerCanonicalLongThreadFixture } from './tests/fixtures/aimock.js';

const mock = new AGUIMock();
const compiled = registerCanonicalLongThreadFixture(mock,
  createLongThreadFixture({ historyCount: 100, responseBytes: 6400, journey: 'follow' }),
  { threadId: 'chat-thread', runId: 'chat-run', epochMs: 1700000000000 });
const url = await mock.start();
try {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(compiled.input), signal: AbortSignal.timeout(3000),
  });
  const sse = await response.text(); // Drain the response before stopping.
} finally { await mock.stop(); }
```

The compiler validates canonical generator provenance, projects the complete
ordered history, preserves response identity and all 200 deltas, and exposes
separate SHA-256 digests for canonical source JSON, event JSON, and response text.
Thread/run IDs must contain 1–128 ASCII letters, digits, or `._:-`, beginning
with a letter or digit. Explicit timestamps and metadata describe a synthetic
clock over the canonical 10-second schedule. AIMock sends these 204 SSE events
without deadline pacing; benchmark timing still uses the independent producer.
No upstream recording is configured. A separately named
`registerDeterministicErrorFixture` provides a small agent error case.
Run fixture conformance with `npm test -- tests/fixtures/aimock.test.ts`.

`compileCanonicalHistoryRestoreFixture` and
`registerCanonicalHistoryRestoreFixture` provide a separate empty-history run
with `RUN_STARTED`, a complete `MESSAGES_SNAPSHOT`, and `RUN_FINISHED`, using
the public AIMock snapshot builder. Supply a distinct restore run ID and use the
wire snapshot as history for the existing canonical continuation run. Restoration
timestamps use the synthetic clock at epoch + 0, 1, and 2 ms and inherit the
canonical compiler's safe epoch + 10000 bound. Digests cover source, restoration
events, and ordered projected history. These transport fixtures do not establish
SDK connection or UI lifecycle conformance; those checks remain separate.

`tests/fixtures/copilotkit-httpagent.ts` provides pure configuration checked
against the public `@ag-ui/client` 1.0.2 types used by CopilotKit 1.78.0. It admits
one owned canonical source, requires a shared thread and distinct restoration
and continuation runs, and returns an empty constructor history, separate run
parameters, complete projected expected history, and copied digests. Its
nonblank endpoint string is preserved as data; it does not establish URL safety
or request authorization. No SDK is constructed or executed by this helper.
These checks establish consumer configuration compatibility, not SDK history
restoration, transport, React, or performance conformance.

After building, run `npm run typecheck:fixtures` for the strict compile-only
public-type controls and AIMock/helper files; root `npm run typecheck` includes
this check after workspace typechecking. Vendor declaration bodies retain
`skipLibCheck`; consumer usage is checked. Run the pure helper tests with
`npm test -- tests/fixtures/copilotkit-httpagent.test.ts`.

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
