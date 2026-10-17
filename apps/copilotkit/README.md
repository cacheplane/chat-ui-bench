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

The owned seed and continuation payloads come from `@copilotkit/aimock/agui`
fixture data. The native binding compiles the canonical fixtures and calls the
public `findFixture` and `matchesFixture` functions; it consumes the selected
event arrays rather than registering unused mocks or starting another HTTP
server. Selection validates exact history, identities and all future events
before returning a slice. Only a validated successful terminal gains the native
success outcome. The continuation reader maps the independent producer's 202
records to 204 selected events and closes after completion or failure.
Synthetic fixture timestamps describe provenance, not producer pacing or
transport latency. The producer retains its original schedule, backpressure and
EOF checks. Pure supplied-port tests verify this selection logic; actual SDK
execution and mounted behavior still require separately qualified hosted output.

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

Production artifacts use the explicit file profiles below and retain a 32 MiB
aggregate byte bound. References count every occurrence
before deduplication within 4,096. Original process close, output EOF and file
retention are separate from timers/signals. Overflow or incomplete retention denies
complete upload/qualification. Original full audit and vendor declaration exit 1
remain recorded failures even when their exact reviewed continuation predicates
allow later production steps. Owned helper types retain full declaration checking.

The first hosted production build, run 38644135221 at source
`534e72ed0f499b532ae7d99e3ced5cff5055e9c7`, failed after Vite reported
9,212 transformed modules. The owned mapping hook reported its shared module
count/ID-length bound; the original log does not identify which branch failed.
The second original release used the fixed identity
`hosted-copilot-react-production-build-v2` and bounded module ownership records
and per-chunk module IDs separately at 16,384. ID strings and resource references
retain their 4,096 limits, mapping evidence stays within 4 MiB, and the shared
artifact bound stays unchanged. Count and ID failures now have distinct bounded
messages. The owned upload includes hidden files so the mandatory Vite manifest
can be retained; its actual presence and byte identity still require artifact
verification. Both original failures are preserved. The second build outcome and the next
prepared profile are described below.

This correction has local source compilation, supplied-data and tiny owned-file
checks only. No local Vite build, plugin factory, installed parser, SDK, browser
or provider acquisition was executed. The hosted build/static artifact still requires a separate dispatch gate
and original root/peer verification. Actual browser requests, telemetry, mounted
H100/R6400, store/lifecycle/geometry, FPS and ranking remain pending separate gates.


### Production output capacity profile v3

The original v2 run 38669171308 at source `a91f21ec` failed its required build
after Vite reported 9,212 transformed modules. The owned hook rejected more than
128 bundle output records. Its unique count branch supports a minimum of 129
records; the exact count was not retained. No final output or supported static
graph was qualified. The v2 tag, run and original evidence remain immutable.

The fixed v3 profile allows 1,024 hook outputs, 1,025 physical output files
(including the possible hook-absent `.vite/manifest.json`), 1,024 manifest records,
1,152 artifact files including the final inventory, and 4,096 visited filesystem
entries including that inventory entry. Generic, selected-source and mounted
inventories remain 128. The successful writer cohort satisfies `48 + 2N + D`,
where `N <= 14` and `D <= 1,025`, giving at most 1,101 files. The 1,152 ceiling
provides headroom; it is not a measured required count or a guarantee that later
byte, parser or reference checks pass.

The aggregate 32 MiB includes the final inventory's measured UTF8 JSON and
newline. Mapping and static evidence remain bounded to 4 MiB and 8 MiB,
resource occurrences to 4,096, and module ownership to 16,384. Traversal limits
bound visited entries after `readdir` enumeration, not its heap allocation or
filesystem concurrency. Collectors preserve ordinary containment, artifact
names, log bounds and original capture outcomes. Only admitted hosted inspection
loads installed parsers.

The v3 ZIP qualification profile separately admits at most 1,152 regular files
and 4,096 entries, with unchanged compressed/expanded 32 MiB, containment, CRC
and exclusive extraction rules. Existing v2 archive limits and evidence remain
unchanged.

The original v3 run `38678632204` at source
`a0fdaab748069aa1dd185a2fbe409aa227b422e1` failed in the build hook with
`Unknown emitted hook reference` after Vite reported 9,212 transformed modules.
The original error does not identify the missing reference, its owner or its
import kind. Inspection did not run; this does not qualify a static output graph.
The original v3 identity and failure remain unchanged.

## Bounded hook-reference diagnostics

The fixed experiment identity `hosted-copilot-react-production-build-v4`
preserves the exact missing-reference rejection and adds JSON identifying the
first offending owner filename, import or dynamic-import kind, zero-based index
within that array, and observed hook-file count. References of at most 4,096 UTF8
bytes are retained in full. Larger strings retain only their first 1,024 UTF16
code units, with explicit truncation and the full original UTF8-byte count.
A truncated prefix is incomplete and does not uniquely identify the full string.
Malformed nonstring references retain only their type; diagnostics never coerce
or serialize the supplied value. The complete error text stays below 32 KiB.

This changes diagnostic detail, not accepted references, normalization or any
build/asset capacity. Counting original UTF8 bytes scans the input string; the
output bound is not a constant-time processing guarantee.

The original v4 run `38688289415` at source
`671dd3ca235b4ffdef68f72a2bc77f82d682dd89` failed on dynamic-import metadata
index 3 from `assets/index-FC4hQth_.js` to `assets/katex.min-BuSKZrD3.js`.
The full 28-byte reference was absent from 466 hook files, after Vite reported
9,212 transformed modules. Inspection did not run. Pinned Vite source can remove
CSS-only JavaScript placeholders and rewrite import expressions; that mechanism
does not prove the origin of this particular hashed reference.

## Bundler metadata and supported static resources

The fixed identity `hosted-copilot-react-production-build-v5` separates
bundler observations from final resource obligations. Hook schema 2 retains
original imports and dynamic-import arrays, including order and duplicates.
Each occurrence records its owner, kind, per-array index, raw name and literal
membership in the complete hook snapshot. An absent metadata name is not called
a deleted file, an external dependency or a resolved resource. Metadata names
must satisfy the existing ordinary relative-path policy, including its 1,024
character limit. Unsupported names and malformed values still receive bounded
refusal diagnostics; there is no filename allowlist or fallback resolution.

Inspection independently recomputes these classifications and checks captured
hook hashes against final physical files. Only supported emitted JavaScript,
HTML and CSS parser forms and manifest obligations create static resource edges.
An actual missing or external import, computed import, missing manifest key or
asset remains a refusal. Raw hook metadata is retained separately and never
silently dropped or treated as a final parser reference.

The shared 4,096 occurrence budget charges metadata occurrences, manifest owner
rows, manifest edges and parsed edges. `referenceBudgetCharges` reports that
total; `staticGraphReferenceOccurrences` counts only actual edge rows. The report
also retains the separate charges and metadata classifications. File, module,
mapping, static-evidence and aggregate byte limits remain unchanged.

This supported-syntax graph excludes complete Vite `__vite__mapDeps`, preload
tables, helper-call and runtime URL/network coverage. The six installed-parser
microcases do not establish those additional forms.

The original v5 run `38697619613`, at source
`17e9885fcfa85992e03a4491ba1dd283f08d75b7`, failed with
`Unknown emitted module ownership` after metadata classification. Its actual
missing module ID was not retained, and the cause of that mismatch remains
unknown. Vite reported 9,212 transformed modules; that number is not an ownership
mapping count. Supported STATIC inspection did not run, and mounted/runtime/frame/
FPS results remain unavailable. The v5 tag, run and artifact remain immutable.

## Bounded emitted ownership diagnostics

The fixed identity `hosted-copilot-react-production-build-v6` adds diagnostic
observations at the existing emitted-module ownership boundary. It still refuses
any emitted module or facade ID absent from the collected ownership mappings.
After existing shape, cap, hash, mapping and metadata checks, it counts every
missing occurrence, including duplicates, and retains the first two module and
two facade samples in input order. Samples identify the owner filename and, for
module occurrences, the original zero-based index. The first encountered module
or facade refusal family is preserved across files.

String IDs of at most 512 UTF8 bytes are retained in full; larger IDs retain at
most 128 UTF16 code units with explicit truncation and the original byte count.
Malformed IDs retain only their primitive type. Supplied objects are never
coerced or serialized. A truncated prefix cannot identify the complete ID.

In a future admitted hosted build, the same hook queries `getModuleInfo` for at
most four retained original string IDs, only when nonempty and at most 4,096
UTF16 units and UTF8 bytes. It never queries a diagnostic prefix. Bounded
observations distinguish available, missing, thrown and skipped lookups, compare
the returned ID and record only the code type. Returned IDs use a 256 UTF8-byte
full-value limit or a 64 UTF16-unit prefix. Lookup or projection failures retain
only an error name of at most 64 UTF16 units and cannot replace the ownership
refusal. External classification is always unavailable/null: the pinned public
module-info API does not expose it, and null code cannot establish it.

The full error stays below 32 KiB, with a fallback to the original bounded
refusal if enrichment formatting fails. These observations establish neither
ownership nor provenance and do not add mappings, bypass admission, change
successful schema 2 facts, or expand any capacity, dependency or parser support.
UTF8 counting scans supplied strings; the output bound is not a constant-time
processing guarantee. The actual v5 missing ID and its cause remain unretained;
the later v6 evidence below supplies a separate source-specific observation.
Supported STATIC success
and separate mounted/runtime/frame/FPS qualification remain required before
publishing performance or competitive results.

## Separate compiler-runtime ownership

The original v6 run `38708386484`, at source
`05680be054bcb52c3f3caf35f2a1b3e254fe1e75`, retained exactly one missing module
occurrence: `\0rolldown/runtime.js`, at index 0 in
`assets/rolldown-runtime-Dd_uD5pT.js`. Its same-hook `getModuleInfo` lookup returned
null; there was no missing facade. The marker matches the pinned Rolldown public
`RUNTIME_MODULE_ID` export. The 9,212 transformed modules are not a source-mapping
count. The build failed before supported STATIC inspection, and runtime/frame/FPS
qualification remains unavailable. The v6 tag, run and artifact remain immutable.

The fixed identity `hosted-copilot-react-production-build-v7` uses hook and static
report schema 3. The admitted Vite config supplies Rolldown's actual public
`RUNTIME_MODULE_ID` and `VERSION` exports. The reviewed profile accepts exactly
provider `rolldown`, version `1.2.13`, and that full marker. Supplied pure-test
profiles or serialized claims alone do not authenticate native export authority.

Ordinary physical/virtual source mappings retain their existing code-ready,
source-enumerated semantics. A separate `compilerRuntimeModules` inventory has
zero or one owner: it exists exactly when at least one emitted chunk module ID
references the marker. Repeated occurrences in the same or different chunks all
resolve to that one owner and remain in their original raw order. The marker
must be absent from ordinary source enumeration and must never be a facade or
an asset-row module ID. An unused owner, duplicate owner, different marker,
version, or unknown ordinary module still refuses admission.

When referenced, the hook queries the exact marker once and requires a strictly
null result. The separate owner records the public-export origin, version,
absent source enumeration, and null module-info/external classification. It
fabricates no physical path, source hash, code contents or `external:false`
source mapping. Unrelated missing-module/facade diagnostics retain their bounded
V6 evidence and first-encountered family before the reserved runtime lookup.

Ordinary mappings plus the runtime owner share the existing 16,384 distinct-owner
cap. Repeated raw module occurrences retain the per-chunk 16,384 limit; runtime
identity creates no resource edge or discount against the shared 4,096 reference
budget. Output counts, byte limits, dependencies and supported parser forms are
unchanged. Historical schema 2 artifacts retain their original source; the new
inspector requires schema 3 and recomputes exact profile/owner integrity.

Every emitted runtime JavaScript file still receives the same final inventory,
physical byte-hash, fatal UTF8 decode, actual supported AST reference collection,
and manifest/resource validation as other emitted JavaScript. No hashed filename
or URL bypass is admitted. Marker ownership supplies no full runtime provenance,
external classification, preload/helper/runtime-URL completeness or execution
qualification. The original v7 run `38721939849`, at source
`0e717e04e488fc0d1ad8ad9caafb19eb2f1f1d23`, built successfully: the original npm
process took 4045.332059ms (the Vite message reported 3.44s). Its 525 retained
artifact files include 466 final output files and 9,211 ordinary module mappings
plus one compiler-runtime owner. Inspection then failed with
`Computed resource expression`; no complete STATIC report or browser/FPS result
was produced. These build times are neither rendering measurements nor competitor
comparisons. The v7 tag, run and artifact remain immutable.

## Constant template resource forms

The fixed identity `hosted-copilot-react-production-build-v8` additionally accepts
zero-expression, single-quasi template literals in dynamic imports and the
existing `new URL(specifier, import.meta.url)` resource form. The pinned
Rolldown/OXC parser's string cooked value supplies the resource; raw text is never
evaluated or substituted for an invalid cooked value. Ordinary quoted static
import/export grammar remains strict. Interpolation, tagged templates,
concatenation, missing/invalid cooked values and dynamic import options still
refuse admission. Scalar byte limits, reference charges, traversal/output caps,
final hashes, source ownership and manifest target validation remain unchanged.

The hosted inspector keeps its original six parser microcases and adds ten
constant-template/escape/refusal cases. They run only under future explicit
hosted admission; supplied-AST local tests do not prove the actual parser ABI or
qualify emitted graph completeness. Unsupported computed-resource diagnostics
retain the original error prefix with a bounded source label, node type and
parser offsets, without source body contents. Vite preload helper tables and
other runtime URL construction remain unqualified. The original v8 run
`38734456206`, artifact `11970554810`, built successfully (exit 0), then the
in-process inspector refused a computed Identifier in an emitted Vite preload
helper. It produced no qualified STATIC report. That failed original is immutable;
runtime, performance and FPS outcomes remain unqualified.

The fixed identity `hosted-copilot-react-production-build-v9` adds a bounded,
explicitly unresolved inventory for exactly `new URL(Identifier, import.meta.url)`
and `new URL(import.meta.resolve(Identifier))`. Only direct, nonoptional,
noncomputed forms with those exact argument counts qualify for this inventory.
`collectJsResourceFacts` returns constant resource candidates and ordered runtime
occurrences separately. The legacy `collectJsReferences` API and inline HTML
scripts still refuse these computed resources. Computed imports, unsupported
templates and ambiguous import-meta syntax remain denied; constants still require
normalization and final inventory membership, including missing-asset refusal.

Inspector result schema 4 (hook schema 3 remains unchanged) binds each runtime
occurrence to its complete canonical emitted path, physical source SHA256,
standalone-module unit kind and SHA256 of the decoded string passed to the parser.
Locations are relative to that parsed string, with UTF16 code-unit semantics
conditional on the future actual-parser Unicode control; they are not raw byte
offsets. No expression text, identifier name, caller or target is inferred.

Each runtime occurrence consumes the same shared4096 budget as metadata,
manifest owners and edges, and parsed edges, before retention; unresolved rows
are excluded from resolved static edge counts. The collector accepts only a
remaining-occurrence credit bounded by that existing limit. Duplicates stay
charged. Six additional hosted parser microcases bring the total to22, including
both forms, strict compatibility, mixed occurrences, computed import and ambiguous
base refusals, and a Unicode span control. They remain unexecuted locally.
Parser completion covers only the declared syntax. Preload helper coverage,
runtime targets, network enforcement and presentation remain unqualified; these
rows authorize no assets or routes. The original V9 run `38804206921`, artifact
`12004689860`, built successfully (exit 0) in 2788.827789 ms, emitting 466 files
with a 2174916-byte main JavaScript file. Its inspector then refused with the
generic `AST traversal bound` error. The failing file, traversal phase and whether
depth or visits caused the refusal remain unknown. No STATIC, runtime or FPS
outcome is qualified.

The original V10 run `38817154354`, source
`f4032ab3e518c112c87b9f9b5baaa35c4cd0824c`, artifact `12012015026`, built
successfully. Its inspector then refused at `assets/index-FC4hQth_.js` with
`AST traversal bound`: resource-walk, visits, depth7, visited500001,
TemplateElement span1681754..1681757. The shared visited count includes resource
walk and import-meta probe work; their composition remains unknown. The cutoff
does not establish a unique-node count, remaining work or the cause of excess
work. No STATIC, runtime or FPS outcome is qualified.

The fixed identity `hosted-copilot-react-production-build-v11` adds diagnostic
composition fields only: `resourcePops`, `probePops` and `probeCalls`. Pops include
the rejected item and count work occurrences; probe calls count actual calls,
including repeated arguments. The existing bounded source label, phase, reason,
depth, shared visited count, safe node type and parser offsets remain. Projection
failure retains the original prefix without expression text or identifier names.
The depth and visit limits, traversal order, shared counter and first-refusal
behavior remain unchanged. The original [V11 run `38843510351`](https://github.com/cacheplane/chat-ui-bench/actions/runs/38843510351),
attempt 1, built successfully (exit 0) in 3960.675440 ms. Its inspector then refused
at `assets/index-FC4hQth_.js`: resource-walk, visits, depth 7, visited 500001,
resourcePops 499943, probePops 58 and probeCalls 28. The full resource walk accounts
for most charged work. No STATIC, runtime or FPS outcome is qualified.

The next proposed custom bundler policy is
`manual-initial-and-bounded-syntax-diagram-v1`. The pure
`productionEsmOutputOptions()` helper supplies `build.rolldownOptions.output`
with `strictExecutionOrder:true` and three groups in priority order:
`production-initial` uses the `$initial` tag at priority 30;
`production-syntax-data` matches `node_modules/@shikijs/langs/` and
`node_modules/@shikijs/themes/` package boundaries at priority 20;
`production-diagrams` matches `node_modules/mermaid/` and
`node_modules/@mermaid-js/parser/` package boundaries at priority 10.
The selectors accept POSIX and backslash separators. Higher priority reserves
initial modules first; unmatched modules retain automatic chunking. Both dynamic
groups explicitly set `entriesAware:false`. All three use minSize 0, maxSize
262144 bytes and recursive dependency inclusion. This size is a grouping target,
not a physical chunk cap or AST visit guarantee: indivisible modules, dependency
constraints and emitted wrappers can exceed it.

The original V12 used the earlier `manual-initial-esm-256k-order-v1` policy.
Its STATIC inspection failed with `Reference occurrence overflow`; the original
release and failure remain preserved. The proposed treatment has no measured
graph-fit or performance outcome.

The SDK entry/API, dependency inputs and full emitted resource/ownership checks
remain unchanged. All features, languages, themes and diagrams are retained;
the treatment removes no imports and adds no aliases or externals.
Each parsed unit still shares 500000 visits across resource
walk and probes, with depth 256; the graph retains 4096 reference occurrences,
1024 hook files, 1025 output files, 1024 manifest records, 16384 module owners and
32 MiB total bytes. All emitted units and compiler runtime owners still require
validation. Existing source/build mappings bind the exact config/helper source
digests; the compiler profile records compiler provenance rather than default
output settings.

Manual grouping can co-load other family members when one language, theme or
diagram is requested. It changes lazy-loading granularity, request/cache topology,
wrapper bytes and fetch, parse, compile and initialization costs. Recursive
inclusion can also move shared dependencies. The execution-order guard alone
does not establish identical application behavior. Any future competitor
comparison must predeclare matched build policies
and actual compiler/version/options provenance; unmatched controls cannot support
that comparison. The new profile still requires a separately admitted hosted
build and full frontend and worker STATIC qualification before mounted runtime
or FPS work. The policy alone establishes no speedup or performance ranking.

The proposed V14 profile adds `external-assets-no-inline-v1` alongside the
manual initial/syntax/diagram grouping. The pure `productionAssetOptions()`
helper supplies `build.assetsInlineLimit:0`: imported fonts and other assets
are emitted as separate resources instead of automatic small-asset data URLs.
Vite's raw-asset size threshold can otherwise produce a larger base64 resource
string than the unchanged 4096-byte resource limit. Explicit source data URLs
and forced-inline imports still undergo the same inspection; this setting is
not a whitelist.
All fonts and features remain included. Separate files can add requests and
change caching, CSS/output sizes and startup behavior; they also consume the
unchanged output-file and artifact-byte budgets. Fresh hosted output must
establish actual fit and behavior. This is a custom build profile, with no
performance or default-profile equivalence claim. V12/V13 results remain
preserved; their outputs are not rewritten by this source change.

The proposed V14 STATIC stage adds an export-only `hosted-native-entry.ts` for
the existing `createCaseServer` factory. In the same hosted job, successful
frontend inspection precedes worker emission and inspection; both worker actions
also check the same-source frontend receipt and parser report. This stage never
imports the emitted worker, starts the SDK or a server, or launches a browser.

The worker uses the public pinned Rolldown API to produce one ES module, with
the existing 16 MiB, 64 raw import and 10 public resolution limits. Encoder and
owned contract/replay code remain bundled. Installed SDK imports use the existing
public subpath allowlist. Worker compilation explicitly disables tsconfig
discovery so consumer typecheck aliases cannot redirect public package exports.
The STATIC inspector uses Node's explicit
`--experimental-import-meta-resolve` flag and the actual app-local worker URL as
the resolution parent; it measures resolved entry bytes without importing them.
The retained worker copy, reports and original command logs share the existing
artifact limits, including directory visits. Compiler ownership records retain
physical source hashes and paths, virtual module identities, the distinct
compiler runtime observation, and exact allowlisted external callback/enumeration
observations. An enumerated external must match the exact public/builtin allowlist
and this build's prior true external callback decision, after matching module
info and ID. Its code getter is not read. This records configured external
classification, not proof from a null/undefined code sentinel. Other modules
require one string-code observation before physical/virtual ownership; final
chunk ownership still rejects a configured external emitted as an owned module.

The worker AST check covers supported static/export-from/literal dynamic imports
and a finite set of loader forms under the existing traversal limits. It is not
a general JavaScript sandbox or an evaluation of external package side effects.
Unsupported syntax and unknown closure fail inspection. Generated contract
modules and their related tracked sources retain distinct ownership identities.
This stage has no measured output-fit, runtime or FPS outcome until its original
hosted artifacts receive independent review.

The V16 geometry integration adds an explicitly unscored full H100
DOM collector to the original frontend host. Canonical ID host uniqueness and
role-specific content ownership are checked before text-node ranges are read.
Eligible text determines membership; returned message bounds come from the row
host, while historical anchors retain the pure policy's raw text-top semantics.
Unmounted or fully clipped rows can yield valid empty visibility. Unsupported,
inconsistent or incomplete mounted observations return unavailable instead of
successful empty or partial results.

This first collector retains common ancestor clip chains, the existing geometry
limits and a 4096 node-visit work refusal. It supports unscaled CSS coordinates
and pure 2D translation used by virtualized rows; other transforms, zoom domains,
heterogeneous text clipping and unsupported CSS fail collection. Native DOM list
creation is not claimed to have an allocation bound. Raw scroll metrics remain
separate from following intent; no DOM mutation, scroll write, observer, timer or
additional SDK subscription is introduced. One collector belongs to the original
host and releases its mutable ownership on admission close. The frontend's
geometry qualification remains unqualified. A future scored candidate index and
actual hosted frontend/worker/runtime conformance remain necessary before FPS
or competitor comparisons.

Source inspection of the pinned `@copilotkit/react-core 1.78.0` message view shows virtualization
above 50 rendered messages when a scroll container is available and no children
override is supplied, with an overscan setting of five and translated wrappers.
H100 exceeds that source threshold; actual mounted behavior remains to be observed.
`npm run typecheck:copilot-geometry` checks the collector and its supplied tests
with the strict browser-source type profile and `skipLibCheck:false` as part of CI.

## Prepared native conformance source

The `hosted-copilot-mounted.yml` workflow and inert
`runNativeMountedConformance` worker export now prepare a fresh V51
frontend/worker STATIC release. After ROOT and peer qualify that completed
original artifact, the separate fixed `hosted-copilot-react-h100-r6400-v12`
native tag must point to the same commit. The native dispatch supplies the
verified original STATIC run/artifact/archive and review hashes; these are
caller review assertions, not cryptographic certification by the pure policy.
No SDK, server, producer or browser effect is admitted by STATIC acceptance alone.

The preserved native V1 attempt failed on its first restored-history geometry
read, before `publicRun` started; independent retained-data validation records it
as incomplete. The retained generic `policy` reason cannot identify the cause.
V32 changes diagnostic reasons only: unavailable viewport, empty text, text
mismatch, no positive text rectangles, host bounds and scroll scalars have six
fixed `policy-` literals. Every failure still contains only `status` and `reason`.
Global invalid input retains `invalid` / `policy`; acceptance, all-or-nothing
collection, DOM reads, readiness, timing and retries remain unchanged. This does
not establish a fix, native conformance, FPS or ranking result. The historical
V1 attempt and its failed outcome remain preserved.

The preserved native V2 attempt completed its first follow case with all nineteen
original witnesses and four available geometry snapshots. Its second history
case failed before mounted acknowledgement or any snapshots; application stderr
reported `Only admitted native cold connect is permitted`. Response-reader EOF
alone proves neither admitted replay nor connect count or request ordering.

V34 tested the source-supported provisional-to-registered startup hypothesis by
rendering the identical default Chat from Probe only when its existing public
`useAgent` hook reports ready. Provider discovery, ready-only host attachment and
cleanup remain unchanged, as does the runtime's exact once-only cold-connect
admission. The V2 failure does not prove that startup sequence occurred or that
this gate fixes it. Native V3 subsequently failed its first restored-history
geometry read with `policy-empty-text`, before continuation and case2. No failed
row or renderer transition was retained, so the proposed rendered-text boundary
remains a source-supported hypothesis.

The preflight checks original public idle history and bounded mounted text after
mountedACK. It performs at most120 sequential observations with existing50ms spacing;
empty/all-unmounted content may wait, while mismatch/structure/cap failures refuse.
Pending observations never read boxes/styles/ranges. The first ready observation
captures the unchanged authoritative restored geometry in the same synchronous
browser callback, before publishing the readiness summary. That operation consumes
the first shared geometry attempt, including failure; unavailable geometry is not
retried. This closes a scheduling gap without guaranteeing renderer or compositor
atomicity. Strict geometry and4/5 snapshot limits remain authoritative. The default
Chat and canonical producer are unchanged. A dedicated bootstrap-owned, separately
typed argument attempts one
readiness summary per attempted case, at most two compact JSON lines≤4096 UTF8
bytes including LF through original application stdout. It preserves first/last
validated scalars and actual attempted count, without text or arbitrary error
details. An awaited write callback is separate from parent retained bytes and
original EOF/writer-close; partial/missing diagnostics or publication failure do
not supply successful case closure. All existing stdout/archive caps apply.
Fresh native V12 must independently complete both original serial cases after
qualification of same-source full STATIC V51. Content readiness and pure tests
establish no geometry, runtime conformance, FPS or ranking result.

The separate experimental `hosted-copilot-react-tracker-json-a-v5` workflow requires
independently qualified same-source STATIC V51 and successful ordinary-native V12
original artifacts. It authenticates the native prerequisite archive as opaque
bytes. Its five tracker roles are `tracker-a-profile.json`,
`tracker-a-case-2-input.json`, `tracker-a-case-2-trace.json`,
`tracker-a-case-2-transport.json`, and `tracker-a-result.json`. Raw JSON capture
stays bounded to 4 MiB, 64 reads and 133 operations; a separate pure projection
requires the complete raw file to fit 256 KiB. Child/parent exit code 2 denotes an
originally closed incomplete report; required incompleteness keeps the outer
runtime unsuccessful. Pilot inventory runs only after actual runtime success,
and upload only after inventory success, so incomplete or early-failure pilot
artifacts are not uploaded; original workflow logs remain diagnostic evidence.
After required outer reports are published, an incomplete run emits one diagnostic
line of at most 16 KiB with finite stages, original-command facts and receipt
statuses. It excludes message content, URLs, arbitrary errors and raw trace data.
An exception marker of at most 512 bytes leaves publication unestablished;
diagnostic writes do not change the failure exit or artifact gates.

Incomplete diagnostics may also show selected observed scalar/timing relations,
last-read EOF and byte facts, and original session-close ordering. These facts
do not establish the first functional cause, complete trace, clock or presentation
qualification, or performance.

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

`frontendSettingsSha256` is SHA256 of the UTF8 bytes of
`JSON.stringify([['source', candidateSha], ['apps/copilotkit/vite.config.ts', configSha], ['tests/support/hosted-copilot-build-plugin.ts', helperSha], ['package-lock.json', lockSha]])`,
with that exact tuple order and no trailing newline. Each file digest is the
SHA256 of its same-source checkout bytes; `candidateSha` is the immutable source
commit SHA. The bootstrap retains the exact tuple in `frontend-settings.json`.
This binds the source, build settings and locked toolchain; supplied ROOT/peer
review hashes are ordinary review assertions, not signatures or self-authenticated
approvals.

The prepared harness runs only two fresh serial H100/R6400 cases, follow then
history-reading. It keeps the default UI, uses actual DOM geometry and native
wheel/return-control actions, and requires advancing public response progress.
The history case checks an observed trusted upward wheel and actual scrollTop
movement, then evaluates the same-element historical anchor pair. Signed anchor
displacement is retained without a universal pixel score. Full geometry scans
are unscored and limited before invocation to four attempts for follow and five
for history-reading, including failed attempts. Readiness polling reads only
public progress scalars and one response/scroller box, without full history scans.
This source is not an installed comparison capture adapter and
cannot publish FPS, presentation, scoring or ranking results.

The public AIMock fixture-data/matching integration supplies owned selected
events to the seed/continuation bridge. The independent repository producer still
supplies real pacing.
Synthetic fixture timestamps remain provenance, and no AIMock HTTP server or
model-key requirement is introduced. The integration must receive fresh
same-source STATIC qualification after all source changes are combined.

The native case's combined assets/runtime origin and the independent producer
are the only two HTTP origins. Static asset requests use the exact qualified
file inventory and fresh byte checks separately from the native protocol-route
policy. One parent-owned BrowserServer supplies the exact control endpoint;
the worker connects once. Every case requires its original page/host/root,
context/server/producer, public state and domain disposal outcomes before reuse.
A callback recorder failure is an owned cleanup failure and blocks publication.
`browserServerClose` means the pre-registered actual BrowserServer close event;
`publicServerClose` means its retained once-only public `close()` promise.
Neither slot represents an extra HTTP listener or is filled from the other.

The parent owns original child exit/close and complete streams. Browser process
stdio has only honest post-bind coverage. Native geometry results are written
to bounded artifact files rather than pushed through the 256KiB application
stdio allowance. Unsupported geometry, missing original closure, network
refusals, timeouts or budget overflow remain incomplete failures. No actual
native conformance outcome is established by this source preparation.

CI includes 23 supplied-data bootstrap regressions and nine tiny synthetic ZIP
cases using the exact embedded stdlib extractor. These tests run no bootstrap
action or SDK/browser effects. Strict mounted conformance and bootstrap test
typing run through the repository typecheck commands.

The V18 worker profile explicitly sets Rolldown `polyfillRequire: false` for
its fixed ES output. The normalized public `format` and `polyfillRequire`
observations must be exactly `es` and `false` before module enumeration. That
accepted two-field observation is retained in original worker-build stdout and,
on successful emission, `worker-compiler-profile.json`; inspection requires its
exact own-data shape. All existing loader denials (including `require`,
`createRequire`, and `node:module`), ownership checks, externals and caps remain
unchanged. V16 refused a `node:module` enumeration, but its precise insertion
provenance remains unknown. This explicit profile tests the documented compiler
default hypothesis; pure checks do not establish successful hosted emission or
native conformance.

## Prepared V30 worker contract source resolution

`hosted-copilot-react-production-build-v30` retains an explicit output path for the
worker's external Zod import. The original contract imports Zod in root package scope;
flattening that import into the app-local worker changes its package lookup scope.
V24's original inspection refused the captured app-local entry instead of the
required root entry. Its failed original remains preserved.

The unchanged Rolldown output profile sets exactly
`paths: {zod: '../../../../node_modules/zod/index.js'}`. The actual normalized
hook mapping and final parser-observed static import must agree. The filename is
accepted only when resolving that literal from the actual worker URL equals
resolving public `zod` from the original `packages/contract/src/fixture.ts` URL.
Inspection checks the root Zod 4.6.5 pin, manifest and entry bytes. The native
bootstrap repeats both resolutions and byte checks before native effects.
Other public dependencies retain their actual worker-parent lookup scope.

The complete registered graph must bind every Zod import, including imports in
unrendered modules, to one of the nine reviewed physical contract sources in the
same directory. Foreign, virtual, dynamic, orphaned or missing known relations
are refused. `fixture.ts` must be an actual owned physical source. This limits
the rewrite to contract consumers with the reviewed root lookup context.

`worker-module.json` retains the raw emitted `specifier` and `entryPath`, plus
mandatory `publicSpecifier` and `publicEntryPath`. Both entry paths must agree;
they are derived observations rather than separate raw resolver-call receipts.
All 19 installed package pins, the existing lock commitment and loader denials
remain required. The profile permits only the exact static Zod literal, and the
actual worker must contain it. Source tests establish no hosted inspection,
native conformance, frame rate or performance outcome.

Original V26 emission failed at the normal-row Zod-origin predicate before worker
inspection. The refused row was not retained, so the exact failing subpredicate
and whether its source was SRC, dist, SDK or query-related remain unknown.
The retained V28 diagnostic passes a synchronous sink only at the original generation hook.
That one refusal can publish the already-normalized row index/ID, source kind,
path/hash and predicate booleans. Strings are exact when bounded or explicitly
labelled previews with full UTF8 lengths and hashes; the complete line including
its newline must fit 16 KiB before publication. Best-effort diagnostic failures
throw the same owned refusal. Default policy/replay callers, successful graphs
and other denial branches remain silent. The nine-origin gate, public maps,
19 pins, lock, loader denials, AST coverage and resource caps are unchanged.
V28's first reported refusal identified physical
`packages/contract/dist/comparison-artifact.js` with a static Zod edge and a false
known-origin predicate. Its full incoming graph and other Zod origins were not
retained; this does not retrospectively identify V26's cause.

V30 uses the builtin worker input `resolve.alias` with the single fixed key
`@chat-ui-bench/contract$` and an absolute target constructed from the admitted
repository root plus `packages/contract/src/index.ts`. It deliberately compiles
the owned source barrel instead of the package's published dist runtime entry.
No resolver plugin is added, and the frontend/default profile, lock, package pins
and external maps are unchanged. Terminal `$` matches the resolver's parsed path;
it does not prove raw query/fragment requests avoid the alias. The profile's
`contractAliasFind` and `contractAliasTarget` fields declare configuration rather
than inventing a normalized input observation unavailable in the public API.

The original emit/final/inspect and native bootstrap checks require the rooted
physical index and at least one actual static incoming edge from the reviewed
bare-root importers: `apps/threadplane/src/sse.ts`, `tests/fixtures/aimock.ts` or
`packages/producer/src/replay.ts`. Every present known importer must have its
selected SOURCE hash and static edge to that same index, without a dynamic edge
to it. Authenticated source bytes establish bare-package import intent; the graph
retains resolved edges, not raw resolver-call receipts. Unused importers need not
exist. All graph rows and the nine-origin Zod predicate remain covered. Bootstrap
retains its final fresh SOURCE snapshot after physical and resolution checks.
Pure tests prove no actual compiler resolution or emission. Fresh same-source
full frontend and worker STATIC qualification is still required before native
admission; no native conformance or performance outcome is claimed.
