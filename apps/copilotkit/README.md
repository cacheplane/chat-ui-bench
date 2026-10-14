# CopilotKit React adapter preparation

This workspace is a source-only candidate, excluded from the benchmark registry.
The checkpoint contains the default public React provider/chat, a bounded host and
probe, and explicit native runtime/independent-producer factories. These sources
have been compiled without mounting React or executing the SDK, server or producer.

## Dependency and public API boundary

Direct pins are CopilotKit `react-core`, `core`, `runtime` **1.78.0**; AG-UI
`client`, `core`, `encoder` **1.0.2**; React/ReactDOM and their type packages
**19.3.0**; Hono **4.13.13**; `@hono/node-server` **1.19.17**; RxJS **7.8.1**.
The root supplies TypeScript **7.0.2** and Node types **24.10.1**.

The consumed public surfaces are:

| Public import | Inspected declaration or asset |
| --- | --- |
| `@copilotkit/react-core/v2` | `dist/v2/index.d.mts`: provider, chat, `useAgent`, `useCopilotKit` |
| `@copilotkit/react-core/v2/styles.css` | `dist/v2/index.css` |
| `@copilotkit/core` | `dist/index.d.mts`: public core and run API |
| `@copilotkit/runtime/v2` | `dist/v2/index.d.mts`: runtime and `InMemoryAgentRunner` |
| `@copilotkit/runtime/v2/hono` | `dist/v2/hono.d.mts`: `createCopilotHonoHandler` |
| `@ag-ui/client`, `@ag-ui/core`, `@ag-ui/encoder` | `dist/index.d.mts`: agent, messages/input and encoder |
| `hono`, `@hono/node-server`, `rxjs` | Public index declarations: Hono, serve and Observable |
| `react-dom/client` | `@types/react-dom/client.d.ts`: `createRoot` |

Export maps, adjacent ESM declarations, exact installed versions and lock
integrities were inspected statically without importing these modules. Runtime
resolves within this application workspace; other dependencies may be hoisted.
Physical resolution and inherited lock changes must be reviewed with any later
dependency remediation. This is not a production asset or executed import closure.

The original compile-only checkpoint lock had SHA-256
`f816e3d6d9321f044764f2913e46f0dc975c0f76afa3e1f852aa18bc7c9de237`.
A fresh `npm ci --ignore-scripts --no-audit --no-fund` completed successfully
without changing that lock or any of the eight package manifests at that adoption
checkpoint. The later approved app script adds the separate vendor compiler. Installed
ancestor resolution and lock integrity checks verified both provider-utils 3.0.41
copies use root Undici 6.29.0; obsolete Undici 5 and Busboy 2 copies are absent.
The root-scoped overrides also retain LangSmith 0.10.11/ip-address 10.7.3 for the
reviewed inherited consumers. Use locked installation for this reviewed graph.

The fresh full `npm audit --json` returned exit 1 with **9 low, 0 moderate,
0 high, 0 critical** package findings. The repository's
`npm audit --audit-level=high` returned exit 0. These nine low findings propagate
the KaTeX advisory through its consumers, including Threadplane's newly available
optional KaTeX peer. The previously recorded seven low React findings remain
visible within that closure. Original failing audits (9 low, 5 moderate, 2 high)
and the unsuccessful resolver attempts are preserved separately. No advisory
suppression or broad forced update was applied.

Provider-utils consumes public CommonJS Undici `Agent`/`fetch`, `connect.lookup`
and the fetch dispatcher option. Installed Undici 6.29.0 exposes those APIs.
This is a static source compatibility inference for the reviewed scoped override,
which crosses the declared Undici 5 range; no provider fetch or SDK code was run.

The four-record security projection preserves the pre-repair candidate graph
apart from the two repaired provider-utils edges. Historical identity presence
does not prove all historical consumer mappings are unchanged. Root separately
accepted three preexisting compatible tool resolutions: two Angular build/CLI
`ajv-formats@3.0.1` consumers now resolve Ajv 8.20.0 instead of 8.18.0, and one
Angular CLI `zod-to-json-schema@3.25.2` consumer resolves Zod 4.6.5 instead of
4.3.6. Those differences predate the security projection. Of 1,607 resolvable
historical physical consumer pairs, 1,604 retain equivalent target identities;
61 unresolved historical requirements remain unproven. Optional KaTeX presence
is also a declared dependency effect. Prior transport/browser evidence remains
bound to its original commits and locks; the changed graph requires fresh CI,
asset/provenance and later runtime qualification.

## Inert controls and verification

`src/controls.ts` imports no SDK, React, AIMock, producer, server or fixture
generator. It owns frozen full history and admitted identities, supplies immutable
validated requests to allocation callbacks, and validates a canonical assistant
projection while bounding recognized metadata separately. String bounds count
UTF-8 bytes after a finite character preflight, including replacement bytes for
lone surrogates. History is bounded to the H100 profile, and the expected canonical
assistant projection to R6400. Identity records admit exactly four owned scalar
fields; run requests admit exactly the three owned `threadId`, `runId`, `messages`
fields before history validation. The future bridge must project SDK input into
that envelope. Identity, run request, message and metadata array descriptors reject accessors before
reading values. History messages must
have exactly their own `id`, `role`, `content` fields in their original order.

The domain controller requires empty public storage before a case, full original
seed settlement and exact committed H before mount admission, and independent
mounted H before one continuation. Original operation handles settle once.
Closing admission or observing idle does not replace original run settlement.
Global clear requires complete owned run/connection/HTTP/producer/reader/bridge
settlement; successful clear, public post-clear emptiness and both registered
server/harness disposal outcomes precede reuse. Incomplete or failed cleanup
retains ownership and blocks another case. A controller object or caller-supplied
receipt does not prove exclusive process-global SDK storage or actual settlement;
the later reviewed allocation graph and hosted original-operation receipts must
establish those facts. The pure controls themselves perform no SDK operation.

The targeted `npx vitest run tests/copilotkit-controls.test.ts --no-color` passed
48 inert tests following recorded functional failures. The consumer app and pure
controls `tsc --noEmit` checks pass with `strict`, `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`. The consumer app explicitly uses `skipLibCheck:true`:
it checks our sources against imported public APIs while skipping declaration-file
consistency checks. Controls explicitly retain `skipLibCheck:false`. The separate
`npm run typecheck:vendor --workspace @chat-ui-bench/copilotkit` uses false and
fails on installed vendor declarations. This reduces type-system accuracy; it
does not establish a clean vendor closure. See the official
[TypeScript skipLibCheck guidance](https://www.typescriptlang.org/tsconfig/skipLibCheck.html).
Original vendor diagnostics and a compiler-only negative probe rejecting numeric
provider `runtimeUrl` and core `runId` are preserved. The probe checks those selected
contracts, not every vendor type. Root build/browser scripts are unchanged.

## Source allocation and lifecycle

The HTML explicitly calls `launchPage`; importing our frontend module alone does
not start an owned mount. It fetches the bounded committed context before mounting
the public `CopilotKitProvider` and default `CopilotChat`, with fixed agent/thread
and no renderer, children, throttle or virtualization override. The probe reads
the same public agent. Readiness and final transcript validation inspect exact H
outside scored work; streamed progress reads only bounded assistant/scalar state.
The host exposes separate original-run waiting and unscored `validateCompletion()`.

The explicit server factory owns one case runtime and listener. One public
`InMemoryAgentRunner` and native Hono handler serve fixed same-origin `/copilot`.
Seed travels through native HTTP/SSE and requires terminal success plus full EOF,
public Observable completion, bridge completion and actual persisted exact H/idle
before context admission. A cold native connect replays committed state through
the original public runner. One continuation starts the independent repository
producer, validates its 202 original SSE events and 200 ASCII deltas, and translates
them into 204 AG-UI events. Producer and bridge receipt clocks remain distinct.
The bridge does not override connect.

Original handler, response-reader, public Observable, bridge task, producer finish,
producer close, page run/detach and server close outcomes are retained separately.
Stop and idle alone cannot settle them. Disposal closes admission first, uses a
shared bounded wait, and preserves failures/incomplete ownership. Global clear
requires successful completion and all owned original work, followed by public
empty-store checks and both harness/server disposal outcomes before reuse. A
module lease prevents this factory's concurrent allocation; exclusive SDK global
storage still requires the future reviewed single-worker/import graph. Runner
limits bound retained storage, excluding active buffers and per-thread guarantees.

The route allowlist admits native info/run/cold connect and fixed-thread exact-run
stop; wildcard stop and external clear/delete are rejected. Default UI behavior,
other endpoint needs, production asset serving, SDK telemetry configuration before
imports and actual network/import closure require later runtime qualification.
The server accepts an explicit future production-assets owner; no asset build or
server startup occurred here. Geometry locators remain unqualified and visible
message reads fail until a separately qualified geometry implementation exists.

Production build and the two serial hosted H100/R6400 mounted cases require
separate concrete reviewed releases.

No React mount, runtime restoration, virtualization, production build, native
geometry, browser conformance, timed workload, FPS or ranking is established by
this checkpoint. Registry/profile integration remains deferred.

## Prepared hosted production/static source

`build:hosted` and `hosted-copilot-production.yml` prepare one separately reviewed
exact-source hosted release. The source guard requires the fixed existing tag,
actual Git/workflow source, first attempt and observed GitHub provider history
before installing locked dependencies or loading Vite/configuration. Provider
history and release observations have bounded pagination, explicit draft visibility
and acquisition-window limits; they supply no atomic lease against later activity.
The root-reviewed original metadata acceptance added only direct development
parents for parse5 7.3.0, Rolldown 1.2.13 and LightningCSS 1.33.0. All 2,060 non-root
lock records remain unchanged; npm sorted only the new parent keys. The accepted
current lock SHA is `c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56`.

The prepared builder keeps the real default HTML/React/chat/CSS and creates a
minified production bundle without source maps. Public build mappings, emitted
physical byte hashes and actual HTML/JS/CSS parsers must agree. Raw embedded
checkbox SVG/CSS bytes are retained; only the exact reviewed decoded SVG identity
is admitted. Literal import-meta asset URLs are supported; other URL constructors
and arbitrary endpoint/eval/fetch strings remain unexecuted runtime graph gaps.
Computed import-meta asset forms and unsupported resource syntax deny static
coverage. Opaque binary image/font files carry byte identity only.

Artifacts share a 128-file/32 MiB bound and references count every occurrence
before deduplication within 4,096. Original process close, output EOF and file
retention are separate from timers/signals. Overflow or incomplete retention denies
complete upload/qualification. Original full audit and vendor declaration exit 1
remain recorded failures even when their exact reviewed continuation predicates
allow later production steps. Owned helper types retain full declaration checking.

The first hosted production build, run 38644135221 at source
`534e72ed0f499b532ae7d99e3ced5cff5055e9c7`, failed after Vite reported
9,212 transformed modules. The owned mapping hook reported its shared module
count/ID-length bound; the original log does not identify which branch failed.
The next prepared release uses the fixed identity
`hosted-copilot-react-production-build-v2` and bounds module ownership records
and per-chunk module IDs separately at 16,384. ID strings and resource references
retain their 4,096 limits, mapping evidence stays within 4 MiB, and the shared
artifact bound stays unchanged. Count and ID failures now have distinct bounded
messages. The owned upload includes hidden files so the mandatory Vite manifest
can be retained; its actual presence and byte identity still require artifact
verification. The first failure is preserved, and this preparation does not
establish that the second build or static inspection will succeed.

This checkpoint has source compilation and inert supplied-data checks only. No
local Vite/config/plugin/native parser, SDK, browser or provider acquisition was
executed. The hosted build/static artifact still requires a separate dispatch gate
and original root/peer verification. Actual browser requests, telemetry, mounted
H100/R6400, store/lifecycle/geometry, FPS and ranking remain pending separate gates.
