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
rows authorize no assets or routes. V9 build, STATIC and runtime outcomes await
fresh admitted original evidence.
