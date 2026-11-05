# Competitor semantic trace capability v1

This additive path instruments the current three isolated competitor profiles
with the same `semantic-task-layout-v2` collector used by Threadplane diagnostics:

| Profile | Configuration |
| --- | --- |
| CopilotKit React | 1.83.0 shipped default v2 Chat, styles, virtualizer, bottom follow and native return control |
| assistant-ui | react 0.15.32 / react-markdown 0.14.24, complete pinned official Thread/theme, content visibility and top turn anchoring |
| AI SDK UI | @ai-sdk/react 4.0.163 / ai 7.0.159 public hooks with the explicitly benchmark-owned plain-text renderer, bottom follow and return button |

All three retain their own manifest, lockfile, node_modules and unchanged profile
sources, styles and public SDK bridges. This adds no competitor fork or upstream
change. Existing functional, stock 0.3.4, stock 0.3.5, modified and local-build results
retain their original identities.

## Genuine build preparation

Use Node 24.20.0 / npm 11.19.0. Install each isolated project's committed lock using
its README. Then run these commands from the benchmark root:

```sh
node tools/competitor-comparison/competitor-build-v1.mjs --build --profile copilotkit
node tools/competitor-comparison/competitor-build-v1.mjs --build --profile assistant-ui
node tools/competitor-comparison/competitor-build-v1.mjs --build --profile vercel-ai-sdk
```

The wrapper runs each unchanged ordinary `npm run build --workspaces=false`
with explicit `NODE_ENV=production`, telemetry disabled and a controlled build
environment. It refuses profile `.env`, `.env.local`, `.env.production` and
`.env.production.local` overrides. It invalidates its old ignored local
`.build-evidence.json` before building, requires the real successful build
original exit/close and closed output streams, rechecks its inputs, inventories
the actual output and exclusively publishes the new record. Failed commands
retain their actual original outcome in the local CLI output; unknown originals
never become successful builds.

Fixed source declarations bind each complete canonical profile source roster,
its own manifest/lock, shared dependency-free context/protocol, exact direct
package versions/registry URLs/SRIs and actual installed metadata. Explicit SDK
subpaths include Copilot v2/styles and runtime v2/Hono, AG-UI/RxJS, public
assistant-ui/markdown/Base UI, AI SDK hooks/transport, and ReactDOM/client.
Node require-resolution entry bytes and physical owned roots are checked;
the unchanged Vite isolation hooks separately verify frontend module roots.
Fresh ordinary `npm ci` supplies registry integrity verification. These facts do
not cryptographically inventory every byte in all installed vendor archives.

The existing Copilot generated manifest records registered physical frontend
module isolation. Vercel's generated manifest binds its selected `generateBundle`
asset rows. Its CSS snapshot includes Vite 8.3.4's exact trailing 12-byte
`/*$vite$:1*/` hash-update marker, which a later pinned hook removes. The wrapper
accepts that specific CSS relationship or exact final bytes, retains both hashes,
and rejects other differences. The actual installed Vite implementation file is
hash-pinned and included in the build inputs; final assets remain independently
inventoried. assistant-ui has source-pinned isolation/typecheck/build
hooks and no preexisting generated receipt. The new wrapper observes their
actual ordinary builds rather than treating partial plugin DTOs as full
compiler attestations. All configs explicitly disable source maps; only Vercel
explicitly declares `es2022`. No other compiler-default claim is added.

Verify a prepared profile without rebuilding:

```sh
node tools/competitor-comparison/competitor-build-v1.mjs --verify --profile copilotkit
```

Successful build receipts record actual monotonic dispatch, exit, close and
attention timestamps. Both the command helper and reader reject an original or
attention observed at or after its fixed deadline, even if a late original wins
the timer race. Attention expiry never becomes original-operation settlement.

The default reader rechecks current source, own manifest/lock, installed physical
metadata/entries, generated profile manifest when present, wrapper/toolchain
inputs and every dist asset. It accepts no caller root, record, pins or verifier
override. A changed implementation or build input requires a fresh genuine
build. The guard pins own isolated locks rather than a global root 0.3.4 lock;
actual V5 per-case provenance separately binds the current global root graph,
controller/fixture/compiled-contract source and asset bookends.

## Declared native and trace cohort

For the current release comparison, wait until stable Threadplane 0.3.5 and all
six published packages have been verified before authorizing any fresh native
captures. Prepare a root-reviewed declaration, fixed runtime/build identities
and new local output path. Then:

```sh
node tools/competitor-comparison/aimock-competitor-growth-v1.mjs --out /absolute/new/local-competitor-cohort
```

This declares 36 attempts: the three competitor profiles × H1000/H10000 × R6400
× follow/history-reading × three rounds. It uses canonical round-major roster
order, without filters, retries, replacement cases or resetting the original
1200-second invocation budget. Every native V5 functional byte remains unchanged
outside the existing eight trace/build seams. Readiness, native wheel/return,
source/SDK conservation, original operations, cleanup, all deadlines and storage
caps remain mandatory. Safe native refusals remain separate from trace status;
unsafe owners or trace publication failure stop continuation and preserve
unattempted slots. A trace cannot rescue a failed functional journey.

Before/after actual build records join each case and the aggregate to the exact
selected profile build hash. V2 tracing still requires original complete event,
no loss, EOF, stream close, session release and bound owned renderer. It requests
exactly `devtools.timeline` and `disabled-by-default-devtools.timeline`; V1/V2
transport, validators and cost decoder retain their original limits and checks.

Observed complete-X task/Layout/MinorGC intervals and counts describe the whole
capture, including observers. They do not establish CPU time, a complete event
population, displayed frames or FPS. Every result retains `performance:false`,
`scoringEligibility:false` and `FPS:null`. This capability does not establish a
ranking or repair known competitor readiness refusals.

Separate Threadplane 12-case and competitor 36-case blocks do not remove order, time or
thermal confounding. A later comparative outer cohort must be separately
declared and reviewed, interleave four profiles per workload, rotate profile
order across rounds and fit the unchanged invocation budget. If that 48-case
budget is infeasible, retain explicitly limited separate cohorts rather than
widen caps or claim balanced comparisons.

Keep generated build records, raw fixtures/traces, source/package evidence and
failed attempts local. Unit fixtures and synthetic orchestration controls are
not genuine build or native measurement evidence.
