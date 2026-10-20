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
lockfile. These benchmark commands need no global browser or Python installation.
The optional [hosted failure inspector](docs/hosted-failure-inspection.md) and
[retained scroll-cause inspector](docs/scroll-cause-retained-inspection.md) use
Python 3.12 or newer and its standard library on POSIX.

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

The [direct HttpAgent transport prerelease](https://github.com/cacheplane/chat-ui-bench/releases/tag/hosted-httpagent-direct-agui-h100-r6400-v1)
qualifies the exercised public AG-UI HttpAgent 1.0.2 transport with AIMock 1.45.1
on Node 24.20.0 and hosted Ubuntu 24.04. Mounted CopilotKit React, browser geometry,
FPS and private SDK finalizer settlement remain unqualified. Its serial profile has eight
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

The next CopilotKit production STATIC release uses the separate fixed identity
`hosted-copilot-react-production-build-v58`. Its worker policy checks the complete
registered graph separately from emitted chunk ownership. The conditional
compiler dependency requires complete bounded runtime callbacks, absence from
every normal module's resolved dependencies, and absence from emitted chunk
membership. Report replay also checks the current policy component hashes.
The profile explicitly binds the contract's emitted Zod import to the root public entry.
The inspector and native bootstrap must resolve the emitted literal from the
actual worker and the public package from the original contract source parent,
and require the same entry bytes and pinned package. Reports retain the emitted
literal separately from the public specifier and both resolved entry paths.
Every original Zod importer must belong to the reviewed contract source family;
the complete registered graph also covers unrendered modules.
The original V24 inspection failed: its bounded diagnostic recorded
`apps/copilotkit/node_modules/zod/index.js` where the root package was required.
The original V26 worker emission failed at the normal-row Zod-origin predicate.
It did not retain the refused row, so its exact subpredicate and importer cause
remain unknown. V28 added one bounded diagnostic at that original refusal only:
normalized row identity, source path/hash and predicate facts, with exact or
explicit preview string values. Diagnostic failure preserves the same refusal;
successful graphs and other denial branches stay silent. No origin is newly
admitted. V28's first reported refusal was the physical
`packages/contract/dist/comparison-artifact.js` row with a static Zod edge outside
the reviewed source-origin set. That observation does not establish the full
incoming graph or retrospectively explain V26.

V30 declares a worker-only builtin input alias from the exact parsed package path
`@chat-ui-bench/contract$` to the admitted repository's
`packages/contract/src/index.ts`. This deliberately replaces the owned package's
published dist entry for this worker; frontend defaults and dependencies do not
change. The retained profile records the fixed alias key and relative target.
The complete graph must bind the physical source index and every present known
bare-root importer to selected SOURCE hashes and actual static resolved edges,
with at least one such importer present. Resolved edges and authenticated source
intent are separate facts; the profile does not claim an observed raw resolver
request or query/fragment exclusion. The unchanged nine-origin Zod gate covers
all original rows, including unrendered modules. V57 requires fresh full frontend
and worker inspection under this profile.
Existing loader denials and resource bounds remain in force. These STATIC
checks grant no native execution or FPS eligibility by themselves.

V32 adds only fixed geometry failure reasons for unavailable viewports, empty
text, text mismatch, no positive text rectangles, host bounds and scroll scalars.
Failures retain exactly `status` and `reason`; acceptance, DOM reads, timing and
retries are unchanged. The preserved native V1 attempt failed on its first
restored-history geometry read, before `publicRun` started; independent retained-data
validation records it as incomplete. Its generic `policy` reason cannot identify
the cause. The preserved native V2 attempt completed its first follow case with
all nineteen original witnesses and four available geometry snapshots, then
failed its second history case before mounted acknowledgement or any snapshots.
Its application stderr reported `Only admitted native cold connect is permitted`.
Response-reader EOF alone does not establish admitted replay, connect count or
request ordering.

V34 tested the source-supported provisional-to-registered agent startup hypothesis:
the existing public `useAgent` readiness gates the identical default Chat
inside Probe, with its ready-only attachment and cleanup unchanged. The runtime's
exact once-only cold-connect gate remains unchanged. The observed V2 failure does
not prove that startup sequence occurred or that this change fixes it. Fresh
native V3 completed setup but failed its first restored-history geometry read with
`policy-empty-text`, before continuation or case2. The failed row and actual renderer
timing were not retained; this does not prove a particular Streamdown transition.

The restored-history preflight starts after mounted acknowledgement. At most120
sequential observations with existing50ms spacing check the original public idle
history and exact mounted canonical text, without box/style/range reads or geometry
polling while content is pending. Empty content may wait; structural, mismatch and
cap failures refuse. The first ready observation captures the unchanged authoritative
geometry in the same synchronous browser callback, before diagnostic publication.
The capture consumes the first shared geometry attempt; unavailable geometry refuses
without another capture. This closes a scheduling gap without guaranteeing renderer
or compositor atomicity.
At most two bounded readiness JSON lines are attempted through original application
stdout, each including LF≤4096 bytes. Awaited child write callbacks do not prove
parent retention or stream closure. These diagnostics share the existing stdout and
archive caps, and cannot promote geometry or lifecycle success. Default Chat,
canonical workload, strict geometry and its4/5 read budgets remain unchanged.
Fresh native preparation uses `hosted-copilot-react-h100-r6400-v19` only after
independent qualification of same-source full STATIC V58. Neither pure checks nor
content readiness establish recovery, native conformance, FPS or ranking.

The separate experimental `hosted-copilot-react-tracker-json-a-v12` workflow requires
independently qualified same-source STATIC V58 and successful ordinary-native V19
original artifacts. Pilot startup uses the shared capture helper; serialized
`capture` stage keys remain unchanged. It authenticates the native prerequisite archive as opaque
bytes. Its five tracker roles are `tracker-a-profile.json`,
`tracker-a-case-2-input.json`, `tracker-a-case-2-trace.json`,
`tracker-a-case-2-transport.json`, and `tracker-a-result.json`. Raw JSON capture
stays bounded to 32 MiB, 513 reads and 1,031 operations, with EOF still required;
the pilot's complete physical union is bounded to 128 MiB. A separate pure projection
requires the complete raw file to fit 256 KiB. Child/parent exit code 2 denotes an
originally closed incomplete report; required incompleteness keeps the outer
runtime unsuccessful. Normal pilot inventory runs only after actual runtime
success, and normal upload only after that inventory succeeds. A separate
`tracker-a-failure-inventory.json` can admit closed incomplete child/parent
publications after runtime failure, retaining the safe original subset as
`copilot-tracker-a-failure-<run>-<attempt>`. Its qualification, native GO and
performance flags are false; it cannot satisfy normal artifact or prerequisite
identities. Missing claimed originals, unknown paths, open writers or absent
authenticated child closure refuse diagnostic retention. Explicitly uncreated
input/transport/raw roles may remain absent. Both paths retain the same per-role
caps and 128 MiB/128-file union, with exclusive creation and no retries.

After runtime failure, independent command-forensic admission can retain the eight
`parent` and `application` started/result JSON and stdout/stderr files, even when
child publication is absent. It authenticates direct command closure, exact argv,
exit facts, stream byte counts and whole-file hashes, then copies only those files
into a fresh sibling `copilot-tracker-a-forensic-<run>-<attempt>` artifact. Its
`tracker-a-command-forensics.json` manifest is published last. Each command JSON
file and the manifest have a 16 KiB cap; parent streams have a 4 MiB cap each and
application streams a 256 KiB cap each. Admission conservatively reserves the
maximum 8,978,432 copied bytes plus 16 KiB for the manifest, alongside the entire
original namespace, within the existing 128 MiB/128-file union. Changed files,
links, open writers and interrupted staging refuse upload. The original job stays
failed; cases, descendants and trace remain unknown, and all qualification and
performance authority stays false. This cannot recover artifacts lost in earlier
runs.

After required outer reports are published, an incomplete run emits one diagnostic
line of at most 16 KiB with finite stages, original-command facts and receipt
statuses. It excludes message content, URLs, arbitrary errors and raw trace data.
An exception marker of at most 512 bytes leaves publication unestablished;
diagnostic writes do not change the failure exit or normal artifact gates.
A separate authenticated `tracker-a-first-failure.json` capsule is at most 4 KiB.
It preserves the first owned scalar guard's closed code, ordinal, previous
ordinal and slot. Earlier external or timeout failures remain unclassified,
including when a later scalar guard fails. It excludes arbitrary errors and
stacks, and grants no qualification or performance authority. Case witnesses
can remain incomplete while authenticated child/browser/process/stdio and file
writer closures independently establish diagnostic retention safety. Failures
before authenticated closed child publication remain available only in logs.

Incomplete diagnostics may also show selected observed scalar/timing relations,
last-read EOF and byte facts, and original session-close ordering. These facts
do not establish the first functional cause, complete trace, clock or presentation
qualification, or performance.

The V10 handler gate profile uses schema 3 and mode
`tracker-a-anchor-handler-gate-v1`, with the unchanged strict mode recorded separately.
Each measured BEFORE arms its gate inside the existing scalar evaluation. The
existing AFTER evaluation waits for the same retained original wheel handler
before taking its one raw scalar; wheel API completion still means dispatch
completion. Entry is unchanged. Input schema 2 retains at most forty
`handlerGates` rows joined to the actual raw events. Success requires forty
observed, claimed gates, timely original AFTER fulfillment and the unchanged
strict handler-in-scalar bracket and offset laws. The child report's
`tracker.inputDrain` copies the original final drain receipt. Both archive paths
require that drain to fulfill and refuse any armed gate; partial closed evidence
cannot supply successful phase coverage.

The wait changes sampling timing and consumes the original slot budget; anchor
probes retain their DOM observer cost. Gate sampling adds no evaluation, listener,
DOM read, timer, polling or clock read. The original 82 measured scalars, forty
50 ms measured slots, 41 total wheel dispatches and 4/5 full geometry reads remain
fixed, with the same global deadline and phase boundary. These observations grant
no compensation, presentation or FPS authority.

One child-owned `tracker-a-anchor-scalars-v1.json` file is bounded to 64 KiB
inside the existing 128 MiB/128-file union. It joins each attempted scalar to
the original G1-selected text owner and records the minimum viewport Y of
positive-area text rectangles, page-clock probe bounds and whether the original
raw offset equals the post-probe offset. Raw scalar retention and the original
strict guard run before diagnostic validation. Identity changes release the
original lease; unavailable samples and malformed diagnostic contracts remain
distinct. Original case, input, transport, child and first-failure publications
close before the diagnostic copier runs. Both inventory paths authenticate the
new role; missing or malformed claimed evidence still refuses an artifact.
These additional DOM reads have observer cost. Samples do not establish
compensation causality, continuous visual stability, presentation timing or FPS.

Pilot mode `tracker-json-a-pilot-v2` explicitly enters history reading with one
trusted −600 wheel before the forty measured −12 wheels. It retains entry samples
and all 41 wheel events, requires settled history detachment, and checks every
measured event against its original slot. All scroll and motion events remain in
the artifact; direction and competing-motion checks include every event whose
creation-to-handler interval overlaps the conservative closed page-clock bracket
around the measured phase. Impossible creation timestamps fail globally. A separate
capture tail ends two seconds after the fixed phase boundary; full response
completion and its own closing tail remain mandatory. This changes the workload
from V5's immediate live-edge escape; it does not retroactively pass that failure.

If a measurement guard fails after the fixed capture target is established, the
pilot still attempts that same capture-tail wait before ending tracing. It keeps
the original failure and missing scenario work; retaining the tail cannot pass a
failed phase. An unresolved native operation, unsafe clock, expired deadline or
failed tail wait still refuses coverage and triggers trace cleanup. Tail waits
are never retried or rebased.

Timing, scenario, FPS, ratio and ranking claims remain unavailable. Dispatch is
held until fresh immutable-source prerequisites and independent qualification
are complete; pure checks do not establish hosted runtime performance.

Native V4 retained two content-ready diagnostics but no case or child result files;
those diagnostics do not establish completed cases or accepted geometry. The next
source observes already-started disposal promises even when their existing deadline
has expired. It still refuses at the same deadline and never marks settlement or
releases ownership. The original V4 budget state and bridge cleanup reason remain
unretained, so this SOURCE fix does not establish that cause or successful recovery.

The pinned default scroll view has a distinct outer scrollport and inner content
node. Native V5 retained full-content heights and zero scroll range from the
selected inner node. The next source corrects only the harness locator to the
outer scrollport, preserving default Chat, CSS and the existing trusted-wheel,
scroll-decrease and geometry requirements. V5 did not retain its exact failing
exercise stage; this correction still requires fresh two-case native conformance
and establishes no FPS result.

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

The SDK-free `tests/support/direct-cost-diagnostics.ts` foundation assesses
supplied observations and sequences fixed CDP calls through caller-owned ports.
It separates explicit `threadTicks` CPU-time deltas from `timeTicks` elapsed
task durations, retains missing measurements as unavailable, and preserves
signed heap and DOM gauge changes. Session continuity, isolate identity and
cleanup outcomes remain explicit. Reply artifacts contain bounded supported
fields, not complete protocol wire bytes. Native session wiring is not yet
integrated; this helper supplies no FPS or competitor ranking.

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
