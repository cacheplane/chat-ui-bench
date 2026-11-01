# Four-stack functional comparison

The first slice verifies identical Aimock-generated prose fixtures across stock
Threadplane 0.3.4, CopilotKit React 1.83.0, assistant-ui 0.15.32, and AI SDK UI
4.0.163 / ai 7.0.159. Each case starts a fresh browser and owned Node server.
Independent npm projects under `competitors/` keep competitor dependencies out of
the root workspace graph. Existing profiles, modified results, and native trace
series remain separate. Fresh stock 0.3.4 v2 and matrix cohorts require new
absolute output directories, retain every attempt, and use the unchanged strict
functional gates. Historical 0.3.3 reports keep their original identities; no
native trace or FPS qualification follows from this version migration.

| Profile | Renderer and scroll ownership |
| --- | --- |
| Threadplane | Existing stock Angular chat and public benchmark host; all mounted, bottom follow |
| CopilotKit React | Default v2 Provider/Chat, shipped styles and virtualizer, native bottom follow |
| assistant-ui | Complete pinned official Thread source and theme; all mounted with content visibility, top turn anchoring |
| AI SDK UI | Public hooks and default transport; benchmark-owned plain-text renderer and bottom follow |

The fixture has 100 history messages, a 6,400-byte response, and 200 deltas
scheduled 50 ms apart. Both follow and history-reading journeys are functional
controls. The version 2 history-reading protocol requires at least 512 visible
current-response characters matching a prefix of actual public SDK text during
the active run, with native identity or unique prose correspondence. A response
ID or an SDK length alone cannot establish rendered readiness. Pointer movement
precedes the final two-animation-callback readiness fence; the same actual response is checked
again immediately before the original single -600 native wheel gesture.
Turn anchoring additionally requires three
stable scroll-position intervals within a two-second setup bound, separating
the gesture from stock run-start anchoring. Bottom following remains active
and may move continuously; these samples are not frame performance measurements. It uses native
wheel input, requires upward movement and
a preserved visible historical message, and clicks the native return control.
Return means response visibility under the profile's declared scroll policy;
it does not impose bottom alignment on turn anchoring.

Admission conserves ordered public SDK history and complete response text,
actual response identity, selected visible DOM correspondence, actual source
emissions, normal source and HTTP completion, browser request completion, and
original public/process cleanup. Matching text plus overlapping DOM geometry
does not establish painted glyphs or displayed frames. Timeout and cleanup
success cannot substitute for completion of the original operation.

Synthetic SSE routes use `Cache-Control: private, no-cache, max-age=0,
must-revalidate`; context and static assets retain `no-store`. This is an explicit
fixture-server configuration: Chromium has an upstream-reported
[no-store streaming EOF defect](https://github.com/microsoft/playwright/issues/42742).
The runner still requires normal browser request completion and rejects aborts.
Every case has a fresh browser context and server, a once-only source playback,
and independently counted source/HTTP requests. It does not reuse cached fixture
delivery or reinterpret any historical result.

The headless Chromium network guard uses a pinned CDP allow/block policy before
navigation, blocks service workers, and bounds observations for its one page
target. It leaves owned streams outside Fetch interception. Embedded `data:`
resources are recorded as local resources; external requests fail admission.
This is not a process-wide firewall or a guarantee about arbitrary worker targets.

Build the existing stock app from the repository root and install/build each
competitor independently, using its README. Root contract output must exist
before fixture tests. Run shared controls and fresh browser cases from the root:

```sh
node --test tools/competitor-comparison/*.node.mjs
node tools/competitor-comparison/run.mjs --out /absolute/new/local-directory
```

Optional `--profile` selects one of `threadplane`, `copilotkit`, `assistant-ui`,
or `vercel-ai-sdk`; `--journey` selects `follow` or `history-reading`.
`--omit-delta 100` deliberately omits one actual source delta while leaving
expected fixture bytes unchanged. Such an invocation must fail admission.
Output directories must be fresh. Failures are retained without hidden retries.
Version 1 outcomes keep their original meaning and remain separate. Failure logs
include bounded scalar geometry, rendered-prefix length, wheel delivery counts,
and native-control availability, without raw message prose or captured traces.

The output includes private fixtures, public SDK snapshots, selected DOM prose,
source/HTTP receipts, build asset hashes, and process closure. Keep this evidence
local; do not upload it as CI or release artifacts. No existing captured traces
are read by this runner. Results explicitly have `performance: false`,
`scoringEligibility: false`, and `FPS: null`.

The separate **matrix v3** protocol expands the functional workload to 100,
1,000 and 10,000 history messages and 6,400 or 262,144 response bytes, across
all four profiles and both journeys: 48 positive cases. Its 49th case omits
source delta 100 from Vercel/H10000/R262144/follow and requires the exact
resulting content mismatch with otherwise complete original-operation custody.
Matrix contexts use schema 2; the preceding functional v2 workload and bounds
keep their original meaning.

```sh
node tools/competitor-comparison/matrix-run-v3.mjs --verify --out /absolute/new/local-matrix
```

For explicit development subsets, omit `--verify` and supply any of `--profile`,
`--history-count` (100/1000/10000), `--response-bytes` (6400/262144) or
`--journey`. Subset manifests say `debug`; they cannot establish full-matrix
success. Every selected slot is declared before execution. Failure, unavailable
ownership or exhausted budgets remain visible, including unattempted slots;
there are no automatic retries or alternate configurations.

Matrix observation acquires the complete actual public SDK transcript once
before and once after the run into separate hashed local files. Intermediate
polling reads actual scalar SDK progress; response prose is sampled separately
for functional DOM correspondence. A fixed 5×5 viewport hit-test grid and up to
two identified response/anchor centers select visible message roots, with at
most 32 selected roots. Hidden descendants are not read. Full mounted counts
are collected only at bookends. This reduces additional observer work; it does
not imply constant-cost SDK internals.

History reading waits for the first 16 canonical deltas' cumulative character
budget (512 or 20,976), observed in actual SDK and visible DOM prose. From the
same final clipped viewport and response rectangle, it requests one native
upward wheel of `ceil(max(600, viewportMidpointY - responseTop))` pixels. Values
over 1,048,576 are rejected. Trusted input, final cancellation state, actual
upward movement, historical anchor preservation and native return remain
required. This is a normalized history-seek functional control, separate from
v2's fixed -600-pixel gesture and any sustained-scroll performance workload.

Matrix-only envelopes are explicit: 8 MiB context and request body, 32 MiB
private fixture, 16 MiB per transcript, 2 MiB per evidence/result, 80 MiB per
case and 4 GiB per invocation with reserved failure publication space. A case
has 240 seconds plus at most 30 seconds of original cleanup; the invocation
has 1,200 seconds. A deadline cannot turn an unsettled operation into success.
Output files are exclusively created, byte bounded and hash referenced.

These functional protocols do not qualify timing, memory, rendering cost,
presentation coverage, FPS or rankings. Repeated native measurements, trace
binding, and presentation verification remain separate work. Keep all private
matrix evidence local as well.
