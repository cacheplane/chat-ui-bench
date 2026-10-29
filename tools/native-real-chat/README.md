# Real chat native capture

## Fixed request-window scroll (separate experimental profile)

`native-stock033-request-window-scroll-v1` uses stock published Threadplane
0.3.3 with one browser-paced `Input.synthesizeScrollGesture`: mouse input,
1,600 CSS pixels upward, speed 800, no fling, no repeats. This input recipe
has its own preparation, acquisition, result and analysis identities. Keep its
results separate from the ordinary wheel, nonce-wheel and modified-layout
families.

The start mark creates an owned native Promise with a fixed two-second guard.
The end mark requires the fulfilled original guard and disposes its timer.
An early timer, changed execution context, failed gesture, changed geometry,
changed transcript, missing original process/pipe closure or failed bookend
refuses the run. There is no adaptive duration, retry or smaller-history fallback.
The authored maximum-bootstrap facade uses 78 Runtime calls, including all
64 bootstrap attempts and three original handle releases, under the existing
80-call ceiling. These authored controls are not performance measurements.

Use the source-owned preparation pair in the same trusted process:

```js
import {
  generateStock033RequestWindowPreparationInputsV1,
  runStock033RequestWindowPreparationOwnerV1
} from './prepare-owner-stock033-v2.mjs';

const fixtureProfile = 'native-history1000-v1';
const generated = await generateStock033RequestWindowPreparationInputsV1({
  fixtureProfile, inputDirectory, preparedDirectory,
  compilationDirectory, evidenceDirectory
});
const prepared = await runStock033RequestWindowPreparationOwnerV1({
  fixtureProfile, config: generated.config, generation: generated
});
```

The fixed fixture profiles are `native-history100-v1`,
`native-history1000-v1` and `native-history10000-v1`. All use genuine
`@copilotkit/aimock` history restoration, seed 1, 512-byte canonical messages,
the history-reading journey and a separately identified 6,400-byte continuation
fixture. This collection loads history; it does not replay that continuation.
The larger profiles retain ordered 100-message chunks, each at most 65,536
bytes, with complete canonical source, event, history and projection digests.
Production chunk access requires the actual compiler invocation's private
admission. Authored structural projections and serialized copies cannot obtain it.

The source-owned worker reconstructs every admitted chunk and checks the full
projection. Its page-local comparison checks every actual transcript message
against that owned history and returns a boolean; it does not trust an
application-provided equality flag. Sending the complete history as a CDP
argument and browser layout remain trusted platform work. Runtime response
limits do not bound that argument's encoding, native layout CPU, RSS or GC.
The 8 MiB preparation serialization, 16 MiB archive, 1,024-member archive,
17-second capture and 19-second finalization ceilings remain in force. A named
profile can still refuse those budgets or fail to render in time.

After reviewing genuine preparation and its original completion, use
`runStock033RequestWindowOriginalV1` from `request-window-run.mjs` under the
one-use `NATIVE_REAL_CHAT_ONCE_RELEASE` value
`source-reviewed-native-stock033-request-window-scroll-v1`. Its explicit CLI
selector is `--prepared-stock033-request-window-scroll-v1`. Retain the original
successful acquisition return in the same process for analysis. Parsing its
persisted receipt does not recreate the private acquisition capability.

`runRequestWindowFeedbackV1` in
`../perfetto-import/request-window-feedback-run.mjs` composes the unchanged
successful V1 feedback diagnostic with that original acquisition. It obtains
unique normalized owner start/end timestamps from the genuine V1 interval,
requires at least two seconds, and selects exactly
`[start + 500 ms, start + 1,500 ms)`. This is a **request-anchored** window that
includes startup and queue effects. It establishes neither controller-running
time nor continuous input delivery. A V1 refusal cannot yield an interior rate.

All captured traces, histories, diagnostic bundles and derived native results
stay local. The result retains the full original V1 diagnostic and labels any
rate as observed successful browser feedback per second. It does not establish
an exhaustive frame population, successful target-scroller presentations,
qualification, comparison eligibility or FPS; FPS remains null.

This is a source-reviewed diagnostic path under development. Source controls do
not launch a browser. An actual acquisition requires a separately reviewed,
single-use outer release and closed input records.

The fixture entry invokes `@copilotkit/aimock/agui` through the repository's
canonical history-restore compiler. Its 100-message snapshot is projected
losslessly to Threadplane's history API. Canonical source/events/history digests
remain distinct from the SHA-256 of the serialized projected history file.

## Source controls

For native preparation, install the locked dependencies with
`npm ci --ignore-scripts`. Esbuild's postinstall normally hardlinks its CLI alias
to the platform binary; the native custody policy requires a one-link platform
file. Skipping install scripts retains the packaged CLI shim and the unchanged
optional platform binary as separate files. The ordinary stock build still runs
through the maintained generator; this setup does not modify Threadplane.

Build the contract, producer, analyzer, and runner workspaces, in that order.
Then run:

```sh
node --test tools/native-real-chat/*.node.mjs
```

Controls use authored sessions, trace packets, processes, streams, and protocol
responses. They test the genuine existing capture owner's original finish
promise and cached inspector without collecting a browser trace.

The worker explicitly selects the V6 UserTiming diagnostic. V6 retains bounded
counter-default metadata diagnostics and validates the fixed packet-default
shape. It explains sequence initialization only for an explicit first-packet flag
with no prior state for the same sequence key; later losses or contradictions
still refuse. This diagnostic establishes no physical qualification,
clock/target admission or FPS authority.

## Fixed stock 0.3.3 native family

### Versioned preparation with exact named membership

`generateStock033PreparationInputsV2` and `runStock033PreparationOwnerV2` in
`prepare-owner-stock033-v2.mjs` form the maintained preparation-only pipeline.
Use both in one process for a fresh cohort:

```js
const generated = await generateStock033PreparationInputsV2({
  inputDirectory, preparedDirectory, compilationDirectory, evidenceDirectory
});
const prepared = await runStock033PreparationOwnerV2({
  config: generated.config, generation: generated
});
```

All four directories must be distinct fresh absolute paths outside this checkout,
with existing real parents. The generator binds its source root to this module's
checkout, requires a clean reviewed HEAD on Darwin ARM64, and performs the ordinary
stock build through fixed Node/npm/Angular command paths. Each original command
must exit zero and close both original pipes normally. The opaque ordinary build
is a prerequisite outside the preparation admission clock and source I/O ledger.
The generator then joins the successful original `{product, probe}` return to
closed canonical record bytes, retains the actual fixture metafile, and derives
the eight exact named roles. Counts are measured output, never padding targets.

The library continuation is internally branded and retains cumulative counters
through generation, parent and original child preparation. Its receipt says
`accountingBoundary: 'generator-through-owner'`. The separate CLI
`node tools/native-real-chat/prepare-owner-stock033-v2.mjs --config <absolute-path>`
accepts a trusted prepared-input handoff and counts its own original reads and
preparation ownership; its boundary is `owner-inputs-only`. It does not reconstruct
earlier generator counters or authenticate arbitrary caller hashes as build origin.

Both boundaries use four full platform passes: generator (or CLI input admission),
two child preparation bookends, and one parent bookend. The distinct five-file
platform set includes Node, the native compiler, esbuild, pinned headless-shell,
and Playwright's core bundle. Their repeated reads count each time; referenced
bytes count the same exact set once. Parent finalization capacity is reserved
before child dispatch, and child counters are reconciled only after its original
nonce-bound IPC result, successful exit, normal pipe EOF/close and IPC disconnect.
The parent reruns the v2 verifier over the original and archived members, asset
joins, template/manifest facts and platform set, then persists the exact returned
reference. No preparation step imports or launches capture.

The owner starts its 60s forward/65s final refusal clock before its first config
read. Original operations that outlive a mapped deadline remain pending; timeout,
forced pipe destruction or absent original closure cannot yield success. A failure
receipt is attempted only while bounded original I/O remains available. The
persisted terminal receipt marks its own write pending and records counters before
that write; the returned fulfilled receipt additionally reports its actual completed
write/readback counters. The caller must retain the original owner return/exit/EOF.

V2 preserves the archive/byte limits and all v1 behavior. Its exact modes and
reference policy contain `stock-033-v2`; v1 runners reject that family. Authored
cross-platform controls carry explicit authored markers and provide no production
reference. Every preparation receipt keeps native support/scoring false and FPS
null. Fresh native acquisition remains a separate explicit action.

After genuine preparation and its original closure/accounting have been reviewed,
`runStock033OriginalV2` in `run.mjs` accepts that original template/reference under
the separate single-use release `source-reviewed-native-chat-stock-033-v2`. Its
CLI selects `--prepared-stock-033-v2 <prepared-root> --reference <reference-path>`.
The reference file must be joined to the trusted original owner return and exit;
parsing it alone establishes no origin. This entry preserves the existing lean
V6 worker request, 17s capture/19s finalization bounds, and false/null authority.
Its persisted receipt family is `native-stock-033-result-v2`. Preparation never
sets this release or dispatches the entry automatically.

`prepareActualStock033` authenticates the canonical, unwrapped production build
record with the existing closed build schema. It requires the five used published
Threadplane packages (`chat`, `a2ui`, `langgraph`, `render`, `telemetry`) at exactly
0.3.3 with fixed published integrity values, joined to the original package
metadata and lock entries. Modified envelopes, the idle-host CSS production hash,
and the modified Angular style selection are rejected. The fixed source roster
has 1,004 current rows and exactly 12 served assets; a natural stock build has no
separate statistics output. Historical `records/` inputs are rejected before
fixture compilation or output creation. Earlier stock and modified archives stay
separate. The archive ceiling remains 1,024 rows, and all file and byte limits
remain unchanged.

The fixture compiler checks its returned module's intrinsic byte length and the
metafile's encoded JSON size, including its final newline, before copying or
serializing them. The existing 2 MiB module and 1 MiB metafile limits still
apply. Successful output bytes and original input identity checks are preserved;
compiler internals remain trusted platform operations.

The source-owned preparation owner retains the original `{template, reference}`
return, actual exit and pipe EOF. Stock uses the distinct
`source-owned-preparation-reference-stock-033-v1` policy and product identity
`threadplane-stock-0.3.3`. `verifyStock033Preparation` independently joins the
owned template and manifest, source-hash roster, original product/config/package
files, fixture compiler inputs, platform/runtime identities and asset membership.
`runStock033Original` requires that admission and retains the existing full
original/archive/platform byte checks before worker creation and after closure.
It requires the separate one-use release
`source-reviewed-native-chat-stock-033-v1`. Its explicit CLI selector is
`--prepared-stock-033-v1 <directory> --reference <reference-file>`.

The worker receives the existing fixed request recipe after parent admission.
The outer receipt uses `native-stock-033-result-v1` and the stock 0.3.3 label.
The original worker ownership, promises, deadlines, request/output/runtime bounds
and V6 selection remain unchanged. This does not authorize acquisition. New stock
authentication adds source and metadata checks; resource validation must count
all actual operations before a fresh cohort. Previous stock
0.3.2 and modified 0.3.2 accounting and results cannot authenticate this family.

## Modified idle-host functional checks

The opt-in configuration is **Threadplane 0.3.2 + benchmark idle-host CSS v1
(modified configuration)**. It uses the published `@threadplane/chat@0.3.2`
package without changing its version. In a fresh checkout with locked
dependencies installed, run either:

```sh
npm run build:threadplane:idle-host-css
npm run test:browser:threadplane:idle-host-css
```

The first command invokes the named modified-build API, including its package
prerequisites. The second builds that configuration and runs only its explicit
functional browser config. Run stock checks and these modified checks in
separate fresh checkouts with separately owned outputs: the modified build uses
`apps/threadplane/dist` and replaces the product/probe build records in its own
checkout. The CI job `Modified idle-host layout conformance` retains its logs
and temporary `functional-build-bookends.json` independently of stock Serial
browser evidence. The Unit job runs the Node-only authentication and authored
visibility fault controls once.

The two typing-presentation cases hold the response before assistant-start and
explicitly scroll the pending indicator into view. They then require positive
viewport intersection, visible dots and running animations, and reject hidden
or transparent mutations. This setup makes no automatic-follow claim.

These are functional checks, not native acquisition or performance evidence.
FPS remains null; they establish no native-support or maintained comparison
profile claim. A subsequent layout change requires the original Unit, Serial,
Instrumentation, Native, and Custody gates plus the modified-layout job, all
from the original attempt on the exact reviewed head. The existing trace PR
retains its original five gates.

The test-only `functional-build.mjs`, `functional-build.node.mjs`,
`functional-fixture.ts`, and
`vitest.threadplane.native-idle-host.browser.config.ts` stay outside runtime
copy rosters and compiler inputs. This README remains tracked, reviewed and in
the runtime-copy roster. The variant CSS replaces only the unserved build
statistics file in that roster under the separate helper proof.

## Owned preparation and acquisition

`prepareActual` executes the fixed fixture entry in a separate preparation
process. Its caller supplies the exact closed source roster, successful build
reference, compiler-input roster, platform identities, and fresh output paths.
Preparation copies and verifies the inputs and returns `{template, reference}`.
The outer owner must retain that original return, actual process exit, and pipe
EOF before starting the lean worker. A parsed template or a freshly calculated
hash cannot authenticate that preparation origin. These are trusted source-owned
capabilities, not an API for authenticating arbitrary caller DTOs.

The outer owner supplies its retained reference through the explicit reference
file when invoking `run.mjs --prepared <directory> --reference <reference-file>`.
The command requires its separate one-use release environment. No import starts
preparation or browser acquisition. The reference file is bounded to 4 KiB and
contains the fixed `source-owned-preparation-reference-v1` policy plus original
created-file facts for the template and manifest. Each fact contains byte length,
SHA-256, and descriptor identity. The eventual outer record must join this
reference to the actual preparation; the reference is not a signature.

The parent authenticates the template, manifest, original/copied source files,
generated history and bundle, and pinned platform files. It creates the request
exclusively and passes its original created-file reference privately to the
worker. The worker checks that reference before parsing the request, then checks
the history's created identity and projected-file hash before use.

The worker serves only the twelve authenticated emitted assets. One explicit
empty favicon 404 is allowed. It awaits the original `loadHistory` call, reads
the actual transcript envelope, and checks exact message content. A native wheel
request, its observed trusted negative wheel event, and measured negative scroll
movement are separate requirements. Two RAF callbacks provide sequencing only.

The existing owner starts collection; explicit start/end marks bracket the
gesture. Its same original finish promise performs final queries, detach, and
the original runner close/wait. That wait requires original process/pipe closure
and browser-group absence. Application buffers and history become unreachable
before the cached private inspector runs. The parent additionally verifies both
original groups are absent after the worker exits.

## Bounds and authority

The new application archive has a proposed fixed 1,024-file/16-MiB ceiling and an
exact literal member list. Its platform table has at most 1,024 named references
and 512 MiB of aggregate referenced content; these are pinned trusted platform
operations, not copied binary payload or a VM CPU theorem. Existing comparison
and synthetic custody archive limits remain unchanged. Browser physical output
has two 256-KiB pipe roles and one 64-KiB metadata role. Pipe custody means original
ordered writes, byte counts, fsync/close, and observed EOF; it is not a raw-content
hash or uninterrupted inode-identity claim.

The Runtime budget includes every Runtime method: at most 75 function calls,
one promise wait, three object releases, and one enable. Source response caps
apply after trusted platform decoding. Navigation generations distinguish stale
initial contexts from the selected current default context. Context observation
continues until original owner-safe detach invocation; this does not establish
a complete browser target lifetime.

Capture has an original 17-second deadline. Successful cleanup and finalization
must complete by the anchored 19-second boundary. A timed-out wait never settles
its original operation. Cleanup still dispatches owned closes; pending or late
originals cannot produce success. A persisted outer receipt records its own
terminal write as pending; the outer process's actual return/exit/EOF must join
that final write.

Pinned Node, compiler, SDK, filesystem, hash, and decoder internals are explicit
platform trust. Source work, cells, and character reservations are logical
source-owned accounting, not V8 allocation, RSS, native instructions, or a total
page-application CPU bound. Final resource acceptance and actual acquisition
remain separate gates. Results remain unscored: clock and frame population are
not admitted, native support is false, and FPS is null.

The private worker reports one bounded58-byte failure line with two-digit `observedAt` and `cleanupAt` stages. These are the last instrumented forward operation and cleanup failure, not authenticated causes or completions. Cleanup never replaces the forward location;00 means no cleanup failure was observed. Original import/entry parsing or successful-result serialization failures outside the existing rejection arm are not covered. Codes01–15 cover worker admission/setup,20–25 navigation/bootstrap/owner setup,30–39 and41–46 capture operations,47–57 the post-wheel geometry boundaries below, and90–93 cleanup failure observations. Positive output, original promises and errors, all deadlines/caps, and unscored authority are unchanged. Historical generic failures and display-link warnings do not identify a stage or establish cause.

The former stage40 span is split into47 before local identity,48 before the awaited geometry port chain (including its identity, backend-node check, remote call, and primitive projection), and49 before local geometry admission. On admitted geometry,50 reports unchanged top and51 increased top after the original `>=` refusal. Codes52–57 report the first mismatch in height, extent, x, y, width, and rectHeight, preserving the original comparison order. These boundaries do not establish settlement, gesture causation, presentation, or FPS.

After both geometry copies pass admission, a failure at50–57 also emits one
`scroll-layout-bits-v2` JSON line to existing stdout, bounded to1024 bytes.
The original stderr line and exitCode1 precede this packet. `beforeAfter`
contains fourteen IEEE754 big-endian doubles as fixed sixteen-character hex
strings, before then after, in the recorded `order`. This preserves admitted
Number bits including negative zero. `ui` contains before then after triples:
typing-host presence, computed bottom padding, and host rectangle height.
Absent hosts use false/null/null; present measurements use the same hex format.
The host must be a connected direct-child HTMLElement with repeated selector
identity. Padding accepts only bounded nonnegative decimal px strings.

These reads share the existing geometry calls; they add no wait or application
write. Runtime response byte counters include their observer footprint. Earlier
failures emit no geometry packet. Success result construction stays unchanged.
DOM/style/layout primitives remain trusted platform operations; source limits
do not bound native layout CPU, RSS, or GC. Matching layout observations can
support a hypothesis but cannot establish timing, input settlement, or cause.

The separately selected tail500 preparation uses
`generateStock033PreparationInputsV2Tail500` and
`runStock033PreparationOwnerV2Tail500` in the existing preparation owner module.
Its CLI is `--config-tail500-v1 /absolute/config.json`; `--config` keeps the
original v2 selection. The preparer is `prepareActualStock033V2Tail500`, with
mode `real-chat-history100-stock-033-v2-tail500-v1` and the exact
`collectionPolicy: 'native-post-phase-tail-500ms-v1'`. Config, release, child
envelopes, template, manifest, reference and owner result each carry this
separate selection. No duration is caller supplied. The corresponding authored
controls remain explicitly prefixed and cannot enter production verification.

`verifyStock033Tail500PreparationV2` checks original custody and privately retains
the observed manifest hash and reviewed source revision for
`inspectStock033Tail500PreparationV2`. A copied template does not retain that
admission. The source/compiled member sets, compiler and platform metadata,
original build joins and all existing byte, operation and deadline ceilings
remain fixed; fresh preparation recomputes content hashes and roster counts.
The extra selectors consume existing envelope capacity and can therefore cause
an otherwise valid long-path request to refuse before child dispatch.

The separately admitted `native-post-phase-tail-500ms-v1` collection uses
`createProtoNativeUserTimingCaptureV6Tail500` through `createTail500ChatPorts`.
The unchanged end mark must fulfill, then all three Runtime handles release,
then owner finish starts its one fixed500ms wait, and only a fulfilled wait can
reach the original `Tracing.end`. Wheel dispatch, two RAFs, geometry checks,
phase boundaries and the V6 reader remain unchanged. Retained Runtime/navigation
watchers and page/context/browser identity checks remain active through the
wait and the original detach entry. Context loss or an additional default
context cancels immediately. Original detach permits its intentional teardown
only after that entry check; post-detach receipt verification uses the original
worker deadline without querying the torn-down page.

Tail entry requires at least500ms remaining under the original17-second worker
clock. It does not renew either the17-second capture or19-second finalization
clock. An early timer, unhealthy identity, cancellation, overflow or late
original settlement refuses; there is no adaptive extension or retry. This
experimental interval is an observation opportunity, not a guarantee that
asynchronous compositor work completes within500ms.

This Tail500 worker mode emits bounded `nativeCollection`, inspected from the
registered actual owner and its original-owned intent/receipt files. The outer
bridge admits one canonical newline-terminated success record only after the
original process/pipe/write/close/group/source joins. Its new receipt records
`observedCollection.nativeCollection` and the exact acknowledged original
stdout byte count/SHA256. Expected preparation policy alone cannot populate
observed facts. A fulfilled tail or normal EOF grants no terminal completeness,
presentation, clock, root lifetime, rate or FPS authority; native support stays
false and FPS stays null. Existing modes retain their original result shapes.
The separate wheel diagnostic below reuses this raw collection component.

## Stock 0.3.3 with diagnostic wheel input

The separate `native-wheel-carrier-v1` recipe uses stock published Threadplane
0.3.3 packages and a modified diagnostic input. Keep its results separate from
ordinary-input stock captures and earlier modified-layout captures. It adds a
bounded numeric carrier to the CDP wheel command and retains the actual trusted
DOM observation. This changes input instrumentation and grants no performance
comparability, gesture-jank, latency, frame-population, ranking, or FPS authority.

Create a fresh preparation through the named source-owned entrypoints:

```js
import {
  generateStock033PreparationInputsV2WheelCarrierTail500,
  runStock033PreparationOwnerV2WheelCarrierTail500
} from './prepare-owner-stock033-v2.mjs';

const generated = await generateStock033PreparationInputsV2WheelCarrierTail500({
  inputDirectory, preparedDirectory, compilationDirectory, evidenceDirectory
});
const prepared = await runStock033PreparationOwnerV2WheelCarrierTail500({
  config: generated.config, generation: generated
});
```

The same fresh-directory, clean-source, ordinary-build, AIMock fixture,
platform, ledger, original-child and closure requirements apply. New config,
release, template, manifest, reference and owner records require the exact
`inputRecipe: 'native-wheel-carrier-v1'`. Separate private generation and
preparation admissions reject old-family, authored and serialized-clone
handoffs. Sharing the unchanged raw Tail500 transport does not admit either
complete input family into the other.

The owner CLI selects `--config-tail500-wheel-v1 /absolute/config.json`.
After reviewing genuine preparation and its original completion, acquisition
uses `runStock033WheelCarrierTail500OriginalV2` with the original
`prepared.prepared.template` and `prepared.prepared.reference`, under the
single-use release `source-reviewed-native-stock033-tail500-wheel-v1` in
`NATIVE_REAL_CHAT_ONCE_RELEASE`. Its CLI selects
`--prepared-stock033-tail500-wheel-v1 <prepared-root> --reference <reference-path>`.
Parsing a reference file does not authenticate its original preparation or
completion. Keep the actual successful owner/acquisition returns and their
trusted original execution observations alongside the persisted evidence.

Acquisition derives `clickCount = 1 + parseInt(requestNonce.slice(0, 7), 16)`
from a fresh 32-character lowercase hexadecimal request nonce. The range is
1 through 268435456 inclusive. This integer is a noncryptographic carrier with
possible collisions; the full nonce labels the listener and marker ledger and
does not travel through the browser input. The source-selected scroller's first
wheel callback must have the observed matching detail, trusted wheel type,
connected/contained target, finite deltas and negative vertical movement. A
wrong first event refuses rather than searching for another. Its default
`performance.mark` call records the returned mark and uses the separate
`native-wheel-witness-v1:` prefix outside the two collection phase marks.

The new worker record retains closed `inputTrace` data: observed selected
context/backend identity, before/after geometry, actual issued move/wheel
parameters and original send states, and actual wheel/mark observations.
Persistence has three distinct stages:

1. Before worker fork, the owned request file durably contains the nonce,
   recipe, derived carrier and marker name.
2. Before each original send, complete geometry-derived parameters are frozen
   in RAM and those same parameters supply the send. Full parameters are not
   durably journaled before dispatch.
3. After successful collection, the original worker stdout carries the actual
   issued and observed record. The parent writes, syncs, closes and hashes that
   stdout before exposing `observedInput` in the new
   `native-stock033-tail500-wheel-result-v1` result.

A failed or crashed run may lack the final input record and remains unavailable;
missing observations are never filled from expected parameters. Persisted
terminal receipts retain their pending-write snapshot; the original returned
fulfilled state is separate evidence. The inputTrace has a 4096-byte sub-bound
inside the unchanged 65536-byte stdout and outer envelopes. Request, Runtime,
navigation, trace, preparation, 17-second capture, 19-second finalization and
fixed 500 ms tail limits remain unchanged. Extra selectors consume existing
capacity and can cause refusal.

A returned PerformanceMark does not prove trace emission. Collection success
means a persisted trusted DOM carrier witness; actual raw ancestry must still
be independently verified before associating it with a Chrome wheel latency
ID. That verifier must require the exact marker, supported synchronous raw
semantics and same-thread parent chain through `LatencyInfo.Flow` with
`STEP_HANDLE_INPUT_EVENT_MAIN` and an enclosing MouseWheel handler. Neither
nearby timestamps nor an expected ID can supply missing evidence.

Chrome can coalesce wheel inputs while retaining the latest detail. One
isolated dispatch per fresh browser limits scope but does not prove general
one-to-one behavior. Chrome may also synthesize a phase-ended raw wheel without
a second DOM dispatch; preserve extra raw occurrences without assigning their
role from counts or timing. Even verified wheel association leaves wheel-to-GSU
and gesture-jank linkage unavailable and supports no FPS claim.
