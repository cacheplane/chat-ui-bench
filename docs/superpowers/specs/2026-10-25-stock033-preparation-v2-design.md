# Stock 0.3.3 preparation v2 design

Status: independently reviewed design; implementation in progress. No acquisition is authorized by preparation success.

Goal: prepare one fresh canonical stock033 history100 input through a maintained owner and an exact named file union, without retaining the historical 1,004-row padding requirement. Keep every v1 preparation/reference/acquisition behavior and historical artifact interpretation unchanged.

## Choice and scope

Use three small modules: `roster-stock033-v2.mjs` assembles and verifies named roles; `prepare-stock033-v2.mjs` authenticates and prepares that family; `prepare-owner-stock033-v2.mjs` owns the original preparation subprocess. Add one Node test file covering these modules. Existing `prepare.mjs` may expose a narrow internal shared stock archive primitive; keep its v1 admission and public exports unchanged. Do not copy the whole preparation engine, add a generic policy framework, or extend acquisition in the first slice.

Alternatives rejected: increasing the literal 1,004 to a new count merely repeats drift; taking all tracked files adds unrelated tests/tool outputs and still says nothing about dynamic dependencies. A named role union gives reviewable membership and distinct operational totals. Current audited 239-member union and 133 compiler inputs are observations, not new magic constants. The actual approved key sets/digests are authoritative.

## Root authorization and exact membership

The trusted outer owner supplies a closed, retained release input from the reviewed checkout/build invocation: real source root, product and probe build-record created-file facts, reviewed source revision/dirty state, the approved role membership and fixture compiler-input key list, platform facts, and fresh output paths. A caller recomputing hashes of arbitrary build JSON does not establish this origin. The release record is provenance retained by the owner, not a signature or independently self-authenticating DTO. Changes require a new reviewed release, never automatic acceptance of newly discovered paths.

Named archive roles:

- `product-source`: exact keys/hashes from the authenticated ordinary production build's source map. Apply existing stock033 package/integrity, config/styles, ordinary build schema and modified-CSS exclusion checks.
- `probe-source` and `probe-compiled`: exact keys/hashes from the authenticated probe build record, checked against maintained probe key definitions and the reviewed record. Do not trust arbitrary extra map entries.
- `fixture-input`: exact approved metafile inputs (currently 133), each joined to original bytes; esbuild's actual input key set and per-input bytes must equal the approved set. These may overlap product/probe keys.
- `native-owner`: fixed literal list of production preparation/owner/worker modules plus source-model, fixture entry and README. Enumerate exact native files, never a directory glob. Include the new v2 modules and any explicit shared helper it imports. Exclude `*.node.mjs`, functional-build/fixture files and unrelated tools.
- `metadata`: exact package metadata selected by authenticated product/probe/fixture roles, plus required root/workspace manifests, build records, lock and configs. Package resolution paths must agree with lock and retained installed metadata; no alternate physical location or recursive package crawl.
- `served-asset`: exactly the 12 stock emitted asset names and digests, joined to the build record and physical dist membership. Reject extra dist rows, absent assets, duplicate names, modified styles, historical `records/` members and path escapes.

Each role has a sorted unique list. Reject duplicate entries within a role; shared keys across roles are allowed only with identical byte/hash facts. Produce one lexically sorted deduplicated union with a per-key role list. Compare expected and observed lists exactly; do not select by expected count, add filler or silently discard drift. Retain role counts, summed role memberships, unique union count and overlap count separately. Bind canonical role/key/hash tuples with a domain-separated roster SHA256. Record key/byte/hash and original/archive identity per union row as existing custody does. Zero arbitrary extras are accepted.

The known union of 239 plus explicit native modules must be re-enumerated against the reviewed head. Do not assume addition is disjoint or calculate the final count from 239 plus a guessed native count. A new analyzer test does not automatically enter this runtime union.

## Trusted platform boundary

Keep the original 1,024-file archive ceiling, 16 MiB total including owned files/manifest reserve, 2 MiB per copied file/module, 1 MiB compiler metafile, 12 assets, 256 fixture inputs, 1,024 platform rows and 512 MiB aggregate referenced platform bytes. Apply the existing template/reference/worker/output limits as well. Runtime remains the fixed Playwright 1.64.0 / browser revision 1248 / Chromium f842f52e recipe and unchanged launch flags.

The roughly 3.58 MB Playwright core bundle is an explicit referenced trusted platform file outside the copied archive, checked by original descriptor identity/size/hash and charged to platform totals. Include the actual Node, compiler/esbuild, browser and reviewed Playwright runtime references needed by this invocation. This classification is an explicit trust boundary, not a way to evade the archive cap: archive roles may not be moved to platform merely because they overflow.

Static bundler/metafile validation establishes the explicit fixture compiler input contract only. Dynamic `require`, native libraries, OS loading, package internals and compiler internals remain trusted platform operations; do not claim a complete executable read closure, VM CPU/RSS bound, complete dependency universe or physical qualification.

## Versioned preparation and ownership

Proposed APIs: `prepareActualStock033V2(options)` and `verifyStock033PreparationV2(root, template, reference)`. New exact modes: `real-chat-history100-stock-033-v2`, `real-chat-source-custody-stock-033-v2`, and `source-owned-preparation-reference-stock-033-v2`. Preserve product identity `threadplane-stock-0.3.3`; the family/contract version changes, not the published package.

V2 manifest adds bounded roster-contract evidence: contract version, roster digest, role counts and exact role-key membership (or compact per-row roles, stored once). Admit added serialization to the existing 1 MiB manifest and 16 MiB aggregate; do not enlarge either. Template and reference retain the existing small shape with v2 modes/policy and original created-file facts; derive roster evidence through the manifest reference. Root-authenticated release input is retained as bounded external preparation evidence outside worker recipe inputs and identified in the outer preparation receipt. Never send large role lists through IPC.

The explicit preparation owner reads a bounded closed config/release file, rejects proxies/accessors in library calls, validates membership before compilation/output creation, and forks its own fixed child entry with no shell. Apply the concrete config, IPC, pipe, handle, I/O and deadline contract below. Child invokes the v2 API and sends exactly one nonce-bound success IPC return containing the genuine `{template, reference}` or a fixed bounded refusal. Parent accepts only its original child, requires original exit zero, normal stdout/stderr EOF/close, one valid IPC result, and all original owned file handles settled. Nonzero exit, duplicate/late IPC, timeout, pipe overflow or forced closure refuses success; kill only still-owned processes, join originals, and persist bounded failure provenance where possible. Completion must not be inferred from a replacement wait or parsed output file. Reference identities remain actual created facts.

Owner action is preparation only. No worker import, browser launch, environment release setting or acquisition dispatch follows success. Future explicit acquisition selection must use a distinct one-use release `source-reviewed-native-chat-stock-033-v2` and an isolated v2 verifier/CLI branch, keeping v1 byte contracts and V6 capture recipe unchanged. Do not make the old runner accept a v2 template.

## Resource accounting and acceptance

Count actual operations by role/stage: root release reads, product/probe parsing and authentication, original/hash bookends, duplicate-role joins, compilation input reads and output checks, archive mkdir/write/fsync/close/readback, generated history/module/manifest/template, platform verification before/after, IPC and parent result/reference persistence. Retain operation counts and bytes separately for original source reads, copied bytes, platform referenced/read bytes and serialized records. Include all new membership traversals and owner I/O. Preserve existing checked numeric bounds; do not claim checks bound native compiler work or OS internals.

Success means preparation files are source-owned, membership-exact, bounded, and the original child/handles closed. It never means trace completeness, clock admission, target/frame population, native-supported status, physical presentation, benchmark duration or FPS. Every new receipt retains false eligibility and null metrics.

## Minimal negative controls

Reject an unapproved extra/missing key even when total count is unchanged; swapped key/hash; duplicate role entry; conflicting cross-role facts; wrong root/build facts; product/probe hash drift; fixture metafile extra/missing input; incomplete metadata/lock join; substituted package path/version/integrity; modified CSS/config; extra/missing asset; historical records and test-only native member; wrong platform identity; archive/platform misclassification; all existing cap boundaries. Owner controls cover forged/wrong nonce/duplicate IPC, success IPC followed by failed exit, timeout, output overflow, inherited pipes, handle close/write failure and late originals. Importing every new module is inert and no preparation success dispatches acquisition.

## Rollout

Source-only red/green controls and independent spec/quality review first. Then a fresh exact-head source-only preparation exercises the 133-input compiler contract and records real role/union/byte totals. Review those concrete outputs and operation accounting; only then implement/use the separate explicit v2 acquisition gate after main is green. Historical v1 archives, native traces and CI JSON cohorts remain separate and unchanged.


## Implementation-ready inventory amendment

This amendment resolves the independent review in `/private/tmp/chat-ui-bench-stock033-preparation-v2-independent-review.md`. Use the lists and contracts here instead of any earlier open-ended instruction to derive owner limits. Measurements below are admission limits, not claimed measured runtime duration or VM CPU bounds.

The literal `native-owner` archive role is:

```text
tools/native-real-chat/README.md
tools/native-real-chat/fixture-entry.mjs
tools/native-real-chat/prepare.mjs
tools/native-real-chat/prepare-owner-stock033-v2.mjs
tools/native-real-chat/prepare-stock033-v2.mjs
tools/native-real-chat/roster-stock033-v2.mjs
tools/native-real-chat/run.mjs
tools/native-real-chat/source-model.mjs
tools/native-real-chat/worker-core.mjs
tools/native-real-chat/worker-io.mjs
tools/native-real-chat/worker-physical.mjs
tools/native-real-chat/worker-ports.mjs
tools/native-real-chat/worker.mjs
```

The literal `native-runtime` archive role admits the following compiled files AND the corresponding `.ts` sources obtained only by the fixed `/dist/` → `/src/`, `.js` → `.ts` mapping. No recursive import discovery changes this list at runtime:

```text
packages/runner/dist/comparison-proto-native-capture.js
packages/runner/dist/comparison-proto-public-ports.js
packages/runner/dist/comparison-proto-trace.js
packages/analyzer/dist/browser-frame-ordered-state.js
packages/analyzer/dist/browser-frame-packet-fragments.js
packages/analyzer/dist/browser-frame-protobuf-fragments.js
packages/analyzer/dist/browser-frame-protobuf-wire.js
packages/analyzer/dist/browser-frame-state-fragments.js
packages/analyzer/dist/browser-frame-trace-framer.js
packages/analyzer/dist/browser-frame-track-descriptor-fragments.js
packages/analyzer/dist/browser-frame-track-event-fragments.js
packages/analyzer/dist/browser-frame-whole-trace-reader.js
packages/analyzer/dist/browser-frame-whole-trace.js
```

These paths follow the maintained runner imports and the analyzer internal whole-annotation entry; the latter is loaded through `createRequire`. Authenticate package exports with literal `packages/{runner,analyzer,contract}/package.json` metadata rows. Existing product/probe/fixture roles already admit contract JS inputs; exact role joins must demonstrate this rather than assume it. Include native-runtime in the prepared union now, so a later acquisition alias cannot skip it. Test native-runtime import drift against an authored unexpected local import; refuse and update the literal list through reviewed source changes. Hashes are measured/bound by the trusted root on the reviewed implementation head, not compiled into the same files they hash.

Metadata role has literal root/workspace keys `package.json`, `package-lock.json`, `tsconfig.base.json`, `apps/threadplane/{package.json,angular.json,tsconfig.json,tsconfig.app.json,.build-evidence.json}`, `packages/{contract,producer,analyzer,runner}/package.json`, and `packages/runner/.comparison-build-evidence.json`. Additional package metadata names come only from approved product package resolution paths and approved fixture/probe compiler package resolution paths, each joined to the authenticated lock and expected role key list. The selected compiler native executable/launcher and Playwright internals are named platform references, never an implicit metadata crawl.

## Closed config, release, IPC and receipt contract

All schema objects are exact own-data objects: reject unknown keys, accessors, proxies, holes and duplicate role keys. Paths are normalized absolute paths with existing real parents; root/output paths ≤256 UTF-8 bytes, file paths ≤512, role keys ≤192, SHA256 lowercase64, identity is the existing `{dev,ino,size,mtimeMs,ctimeMs}`. Relative key names forbid `..`, empty segments and `records/`. No arbitrary executable or child entry selector is accepted.

- Config, ≤1 MiB: `{schema:1, policy:'native-stock033-preparation-owner-v2', sourceRoot, preparedDirectory, compilationDirectory, evidenceDirectory, release:{path,fact}}`. `fact` is the existing created-file `{bytes,sha256,identity}` from the trusted outer caller. The three output directories must be distinct/fresh, outside sourceRoot, and have real existing parents. The CLI is `node tools/native-real-chat/prepare-owner-stock033-v2.mjs --config <absolute-config-path>`; library invocation additionally takes the trusted original config fact rather than calling arbitrary DTOs authenticated.
- Release, ≤1 MiB: `{schema:1, policy:'source-reviewed-stock033-preparation-inputs-v2', source:{revision,dirty:false}, build:{product:{key,fact},probe:{key,fact}}, roles, fixtureInputs, runtime, platformRows}`. Revision is lowercase40-hex verified against the root's original reviewed checkout observation. `roles` has exactly product-source/probe-source/probe-compiled/fixture-input/native-owner/native-runtime/metadata/served-asset arrays of `{key,bytes,sha256}`; their exact authority rules are above. `fixtureInputs` is the same approved fixture role restricted to `{key,bytes,sha256}` and joined to every actual metafile input's `bytes`, not just names. Runtime and platform row shapes are the existing closed stock033 shapes. Root-authenticated build facts refer to canonical product/probe records retained from the successful original build. This is a trusted-source handoff, not a new cryptographic authority.
- Parent-to-child IPC: exactly one `{type:'prepare',nonce,config:{path,fact},sourceObservation:{revision,dirty:false}}`, ≤1 KiB. Nonce is fresh32-hex. Fixed child is the same owner module in an internal child entry with no public child-path/config policy switch. Config/release original facts are rechecked by the child.
- Child-to-parent IPC: exactly one `{type:'prepared',nonce,template,reference,accounting}` ≤8 KiB TOTAL; the existing 4 KiB template/reference individual limits are coupled with IPC overhead. Failure sends no success IPC and emits one bounded fixed error code. Both sides retain original `send` callback result and IPC disconnect state. Child awaits original send callback before disconnecting and exiting. Wrong nonce, extra message, result before admission, send error, premature disconnect, exit failure or absent result refuses.
- Parent external receipt ≤64 KiB: `{schema:1,policy:'native-stock033-preparation-owner-result-v2',status,terminalReceiptWrite,source,config,release,build,roster:{digest,roleCounts,unionCount,overlapCount},child:{pid,pgid,start,nonce,send,ipc,exit,close},stdout,stderr,stages,pending,io,prepared:{template,reference}|null,error,authority}`. Config/release/build are the exact retained original facts; source repeats the reviewed revision/dirty=false. Success keeps the original IPC value in `prepared`, not reparsed template content. `authority` is `{nativeSupported:false,clock:'not_evaluated',population:'not_evaluated',FPS:null,scoringEligibility:false}`. A persisted receipt uses `terminalReceiptWrite:'pending'`; actual returned owner value may set it fulfilled only after its original write/fsync/close/readback. The caller must join actual owner exit/stdout EOF for external receipt completion.
- Parent reference file ≤4 KiB contains the exact original returned reference only, created exclusively after all success gates. No new caller reference is fabricated. A root-owner result binds its created fact in the receipt. Write failure refuses; partial files never become success.

## Numeric ownership and I/O limits

| Surface | Fixed v2 bound and counting |
| --- | --- |
| Admission clock | Start monotonic anchor BEFORE config open/read. Forward preparation through original child exit/pipe completion ends within60,000ms. Cleanup, bookends, reference and receipt original persistence must finish within65,000ms from the same anchor. These are refusal deadlines, not a prediction of fsync/compiler completion. |
| IPC | One request ≤1KiB, one success result ≤8KiB; no additional messages accepted. |
| Child stdout/stderr | ≤65,536 bytes EACH, ≤4,096 data callbacks combined. Each pipe success requires original end+close without error/destroy. Preserve exact ordered bytes and SHA/count. |
| Source accounting | ≤131,072 dispatched filesystem operations (including chunk reads/stats/hash-read inputs/write/fsync/close/readbacks) across parent and child; count aggregates, not one retained JSON object per read. ≤64 retained stage rows and ≤16 simultaneously owned original operation slots per process; ≤8 simultaneously owned source file handles per process. Reject before dispatch/retention that would exceed a bound. Compiler/platform-private handles stay explicit trusted internals. |
| Role admission | Eight roles; ≤1,024 entries per role, ≤8,192 role references TOTAL before dedup; ≤1,024 unique archive keys; release/config JSON preflight ≤65,536 nodes each and ≤1MiB encoded bytes each. Existing192-byte keys and2MiB member limits apply. |
| Platform passes | ≤4 full referenced-platform hash passes, each distinct referenced set ≤512MiB/1,024 rows. Charge actual read bytes per pass, so four passes may read2GiB; do not conflate that with the512MiB distinct-content ceiling. No gratuitous extra pass. |
| Source read/hash totals | ≤3GiB source-dispatched read bytes and independently ≤3GiB bytes fed to source-owned hashes across preparation+owner bookends, including the≤2GiB platform passes, archive originals/copies and bounded external evidence. Account repeated reads separately. Native hashing/compiler/loader instructions are not counted CPU. |
| Copied archive | Preserve `archiveTotal + manifestBytes +262144 ≤16777216`; no change to2MiB per member/module,1MiB manifest/metafile,64KiB history,4KiB template/reference, twelve assets≤2MiB aggregate. |
| External preparation evidence | Separate ≤8MiB aggregate source writes and ≤8MiB serialized retention: config copy≤1MiB, release copy≤1MiB, compiler module≤2MiB, metafile≤1MiB, fixture-output≤128KiB, logs≤128KiB, reference≤4KiB, receipt≤64KiB, plus existing bounded template/result accounting. Charge their reads/write/fsync/close/readback in the global operation/read ledgers. These files do not enlarge or bypass archive membership. |

Use fixed-size counters and checked integer additions. All counters are shared/logically reconciled between child accounting returned through bounded owner-stage summary and parent accounting; the IPC envelope must stay within8KiB. The original success result includes the closed `accounting` summary already named in the IPC schema: scalar counters `{operations,readBytes,hashBytes,writeBytes,peakHandles,peakOperations,stages,platformPasses}`, ≤512 bytes; the receipt records it. No large role lists are sent by IPC.

Normal completion invokes and awaits existing `esbuild.stop()` before sending success. Parent creates a detached preparation-child process group, records its original PID/PGID/start identity through bounded `/bin/ps`, and checks that identity before timeout containment. On deadline it may kill only this owned original group (including the inherited compiler service); it must not guess process names or kill unrelated esbuild instances. Retain original child exit/close and pipe state. Destroy a still-open owned pipe only as failure cleanup; never label that normal EOF. A mapped wait timeout does not settle an original file write/close; record pending originals and return unavailable. No claim covers detached grandchildren or an arbitrary process universe; source acceptance requires no unresolved owned work. Authored controls cover an inherited compiler-like process, not a new general process theorem.

Parent external evidence directory creation/config read/copy occurs within the same admission clock. Before spawning the child, preflight the worst-case remaining bound from admitted rows/chunk counts and reserve terminal64KiB receipt+4KiB reference capacity; if current source accounting cannot fit, refuse. Source-only real preparation then measures actual counts; do not loosen limits automatically if a platform cannot finish within the deadline.


## Exact current closure lineage and platform metadata amendment

Authored source controls may use the explicitly separate `createStock033AuthoredControlV2()` facade on Linux or another test host. This private fixed host mode exercises real local filesystem operations and the host's esbuild SDK through an explicit tiny fixture forwarder; its Mac-shaped platform files and build record are authored data, never genuine native origin. Its result, template, reference and manifest carry `authoredControl:true` and distinct `authored-*` modes/policy. Production APIs reject these references and branded control ledgers, always use the actual Darwin ARM64 host, and expose no CLI selector for this boundary. Both paths resolve esbuild from the authenticated source root's `package.json`; the production owner must bind that root to its own reviewed checkout and fixed environment.

The implementation audit's current candidate is268 unique paths/5,518,899bytes/max member1,183,611bytes. This is a measured prior-head candidate, NOT v2 acceptance cardinality. Its base239 was sorted union of actual fixture133 + authenticated product.sourceHashes47 + probe.sourceHashes31 + probe.compiledHashes16 + product.packages50 `/resolutionPath/package.json` metadata +12 emitted assets +2raw build records. Role overlaps explain why the sum exceeds239. Native worker adds8, prep/run add2, internal reader adds10, README adds1, selected metadata adds8. Consult maintained `packages/runner/src/comparison-provenance.ts:130–160` for existing original-facts product/probe/metadata/compiled/raw-record lineage, rather than independently inventing a similar dependency algorithm.

The audit did not retain its133-path metafile or268-path list. Task1 must regenerate and retain both named lists from the reviewed source/build in a source-only probe, then bind their original facts in the trusted release before preparation. Exact compiler settings are existing compileActualFixture: entry `tools/native-real-chat/fixture-entry.mjs`, absWorkingDir sourceRoot, bundle=true, platform=node, format=esm, target=node24, write=false, metafile=true, logLevel=silent, existing createRequire banner. Always esbuild.stop in finally. The prior audit module879,089bytes/metafile52,957bytes are observations only. V2 adds its three production modules and13native-runtime TS counterparts explicitly for source/compiled lineage; those are genuine named-role additions, not padding. Freeze the resulting sorted names and rerun comparison against the actual emitted metafile; no same-count substitution is accepted.

The selected eight additional metadata keys for this Mac platform are exactly:

```text
packages/analyzer/package.json
node_modules/typescript/package.json
node_modules/@typescript/typescript-darwin-arm64/package.json
node_modules/esbuild/package.json
node_modules/@esbuild/darwin-arm64/package.json
node_modules/playwright/package.json
node_modules/playwright-core/package.json
node_modules/playwright-core/browsers.json
```

For this slice admit only the reviewed Darwin ARM64 platform; refuse other platforms rather than invent paths. The corresponding actual native compiler/esbuild executables, Node, browser and Playwright core bundle references are root-retained platform facts measured at the reviewed physical paths. Do not add the3.58MB Playwright bundle to metadata/archive roles. Future platform support requires an explicit reviewed literal metadata/reference selection, not automatic fallback resolution.

## Original source observation handoff

The parent owns bounded fixed Git observations of HEAD and clean tracked/untracked state before preparation dispatch, retaining original command exit and pipe completion. Its observed `{revision,dirty:false}` must equal the trusted release source declaration. The physical preparation API requires this separate `sourceObservation` input, and the original nonce-bound parent-to-child request carries it within the unchanged1KiB total request cap. The child compares it to the admitted release; it does not spawn Git or claim arbitrary DTO origin authentication. Parent repeats source observation after child closure and refuses drift. Command/process work and bytes enter the owner ledger; no inferred successful observation from a timeout or replacement wait. A final-head role fact rebuild is still required; this handoff cannot authenticate the earlier dirty diagnostic inventory.
