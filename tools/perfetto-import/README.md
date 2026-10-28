# Pinned Perfetto import diagnostic

## Browser presentation-feedback observations

`feedback-observations-run.mjs` runs the pinned target and scope exports, then
counts distinct successful display-feedback observations for a selected frame
and loader. It includes partial and forked reporters, deduplicates display IDs,
and uses reporter terminal times in the half-open phase interval `[start,end)`.
The output's `observedHz` is an exact rational observation rate. **It is not FPS**:
`fps` stays null, the population is explicitly nonexhaustive, and native,
capture, evaluation, scoring and ranking eligibility remain false.

Create a canonical compact config with `JSON.stringify`, preserving this key
order. Replace the illustrative paths, hashes, selectors and byte count with
original capture facts and the platform processor pin documented below:

```js
const config = {
  schema: 'browser-presentation-feedback-observations-v1',
  trace: {path: '/absolute/trace.pftrace', bytes: 1234, sha256: '<original SHA256>'},
  processor: {path: '/absolute/trace_processor_shell', sha256: '<platform pin>'},
  target: {frameId: 'AUTHORED_FRAME', loaderId: 'AUTHORED_LOADER'},
  phaseNames: {start: 'authored:start', end: 'authored:end'},
  out: '/absolute/fresh-output',
  deadlineMs: 60000,
};
// Write JSON.stringify(config) without whitespace or a trailing newline.
```

```sh
node tools/perfetto-import/feedback-observations-run.mjs --config /absolute/config.json
node --test tools/perfetto-import/feedback-observations-core.node.mjs tools/perfetto-import/feedback-observations-run.node.mjs
```

The wrapper verifies the original tool returns, complete output files and
persisted source bookends. Audited use assumes a fresh trusted Node process and
no concurrent local file mutation; disk hashes do not attest cached module
memory. Generated SQL is verified after execution, with no in-query SQL
bookends. The saved result is provisional: require the original returned
publication receipt, matching file hash, and original command completion.
Late custody failures withdraw numerical results. Refused runs retain their
available evidence and do not retry with a narrower export.

The source model targets the documented Chromium producer and official
Perfetto revisions, with vendor build correspondence assumed. Preserve importer
warnings and coverage disclosures; successful feedback records can be delayed
until reporter destruction. The pure core accepts authored CSV for controls and
always labels it untrusted. Keep captured traces and derived results local and
keep stock, modified and authored cohorts separate.

The separate `inspectNativeWheelRawCensusV1({path, bytes, sha256})` library in
`native-wheel-raw-census.mjs` inspects a persisted trace with the fixed V11 reader
and one additional bounded raw pass. Build the contract and analyzer first; run
its authored controls with
`node --test tools/perfetto-import/native-wheel-raw-census.node.mjs`.
Importing the helper performs no file inspection, capture, SQL or subprocess work.

This source-shaped diagnostic requires exactly one literal
`native-wheel-witness-v1:` event, its supported modern instant/core fields,
resolved `blink.user_timing` category and initialized default thread, exact V11
packet/body/event anchors, and prior consistent thread/process descriptors. Every
matching descriptor occurrence remains represented, including identical repeats.
It scans literal names across all event types and all EventName definitions;
unused prefixed definitions and filtered `performance.mark`/`performance.measure`
sentinels refuse. The fixed packet roster excludes translation, VM, compressed,
remote and unknown carriers, permits only metadata in ChromeEventBundle, and
requires empty ChromeMetadata and ExtensionDescriptor payloads. No caller prefix,
policy, module path, decoder callback, relaxed mode or fallback is accepted.

The helper pins the ten transitive analyzer source and compiled module pairs;
missing or different builds refuse rather than executing source or rebuilding.
It checks before/after one-link, nofollow/nonblock source and trace descriptors,
hashes and EOF/close. Source-role limits are 256 KiB per analyzer file, 64 KiB for
the helper/small build metadata and 2 MiB for the lockfile, with at most 4 MiB per
source bookend. Returned source facts identify local persisted bytes; they do not
attest cached module memory or original collector execution. Use a fresh trusted
Node process and reviewed build for audited use.

The original 32 MiB trace, 256 KiB packet and 4,096-read ceilings remain fixed.
The additional pass and retained report spend the remaining original V11 global
field, repeated-work and persistence allowances; budgets never renew per packet.
Later file/source/state/shape/cap failures withdraw all witness and descriptor
anchors. The existing whole-result byte/node/string validator also applies.

Success means a unique supported **raw structural witness**, with
`association: 'not_evaluated'`, `originalExecution: 'not_evaluated'`,
`importerAdmission: 'not_evaluated'`, false native/evaluation/scoring/FPS eligibility
and `FPS: null`. Trusted original request/callback/owner closure, fresh official
importer custody and error/loss statistics, preserved imported-row/descriptor
mapping and typed immediate wheel ancestry remain separate requirements. The
helper establishes no target identity, wheel ID, clock alignment, rate or FPS.

Optional Node 24, built-in-only diagnostic. Importing `run.mjs` has no execution or
filesystem side effects. This does not capture a browser, calculate a frame rate,
qualify native traces, or change the manual V6/V7 analyzers. Every result has
`diagnosticOnly: true`, `nativeSupported: false`, `fps: null`, `duration: null`, and
`scoring: false`. A successful import is not performance or completeness evidence.

Run explicitly with a fresh absolute output directory:

```sh
node tools/perfetto-import/run.mjs --config /absolute/config.json
node tools/perfetto-import/run.mjs --inventory-config /absolute/inventory-config.json
node tools/perfetto-import/run.mjs --target-inventory-config /absolute/target-inventory-config.json
node tools/perfetto-import/run.mjs --scope-inventory-config /absolute/scope-inventory-config.json
node tools/perfetto-import/run.mjs --mainframe-lineage-config /absolute/mainframe-lineage-config.json
node tools/perfetto-import/run.mjs --wheel-carrier-config /absolute/wheel-carrier-config.json
node --test tools/perfetto-import/run.node.mjs tools/perfetto-import/mainframe-lineage.node.mjs tools/perfetto-import/wheel-carrier.node.mjs
node --test tools/perfetto-import/wheel-graph.node.mjs
```

Configuration shape (replace all paths and trace facts with your own retained inputs):

```json
{
  "trace": { "path": "/absolute/authored.pftrace", "bytes": 153, "sha256": "<64 lowercase hex characters>" },
  "processor": { "path": "/absolute/trace_processor_shell", "sha256": "8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4" },
  "phases": ["authored-start", "authored-end"],
  "out": "/absolute/fresh-diagnostic-directory"
}
```

There is no default processor, executable discovery, download, shell, inherited
environment, or caller SQL. The production library `runDiagnostic(config)` and CLI
enforce the runtime platform pin as well as the exact version and RPC API 14.
Unsupported platforms fail closed. Only these official v59.1 raw executables are pinned:

| Platform | Official raw executable | Exact bytes | Executable SHA256 |
| --- | --- | --- | --- |
| darwin-arm64 | [mac-arm64/trace_processor_shell](https://commondatastorage.googleapis.com/perfetto-luci-artifacts/v59.1/mac-arm64/trace_processor_shell) | `14376168` | `8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4` |
| linux-x64 | [linux-amd64/trace_processor_shell](https://commondatastorage.googleapis.com/perfetto-luci-artifacts/v59.1/linux-amd64/trace_processor_shell) | `15885448` | `2434129a3af4dc9e2034a476f7b76447b490975213e301769310d3bd0d5d6458` |

The admitted text is:

```text
Perfetto v59.1-1e9c61e98 (1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d)
Trace Processor RPC API version: 14
```

The original Mac process reported this exact text with exit zero, empty stderr and normal stdout/stderr
EOF and close. The official raw distribution is documented by
[the pinned release script](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/tools/release/roll-prebuilts#L138);
the tagged convenience launcher still selects 58.2 and is not the acquisition path.
Qualification checked exact lengths, response generations and MD5 values against
retained official metadata before calculating these SHA256 values. The observed
Mac/Linux generations were `1792781823182096` / `1792780866926111`, with MD5
`L4hRxW4rySPu7bbJat813Q==` / `ESZSklEk/Lt1Ry5jTiNHpg==` respectively.
These computed first-use SHA256 pins identify observed bytes; they are not
independent publisher attestations or proof of the binary's source. Trust still
depends on the official HTTPS distribution and publisher/vendor build. Linux
bytes were hashed on macOS, which is not Linux execution evidence. Actual Linux
exact-version and all three semantic smoke imports passed in [run40230295671](https://github.com/cacheplane/chat-ui-bench/actions/runs/40230295671) on reviewed source `19af098698c31ad69097185f81fbd4cc2e15bb84`; downloaded process/stream manifests and hashes were verified.
Local Mac verification passed all authored controls and the unchanged clock full,
graphics full and graphics inventory semantic smoke imports with these pins.

Historical 58.2 evidence remains reproducible from source revision
`b69dadc4e3bd12eeb8f15db26343363ce58e52a2` and its retained official processor,
whose Mac SHA256 is `d29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa`.
Use that revision's runner, README distribution checks, retained input and fresh
outputs to reproduce 58.2; its published findings and original outputs remain
immutable. See the separately labeled
[native verification findings](../../docs/research/2026-10-25-stock033-native-v2-verification.md).
Never combine 58.2 and 59.1 outputs under one lineage.

`runAuthoredFixtureDiagnostic(config)` is an explicit low-level test entrypoint
for locally authored executable fixtures. It checks the caller's executable hash
and version text but does not enforce official platform identity. Its reports
always say `authoredFixture: true`, `officialProcessor: false`. The production CLI
never uses this entrypoint. Authored fixture results cannot attest official tools.

Inputs must be one-link regular files opened with nofollow, with trace <=32 MiB
and processor <=64 MiB. Bounded reads hash original handles, checking descriptor
and path identities before/after reading and after analysis. This assumes a trusted
local filesystem and trusted native process execution. Bookends do not prove an
absence of transient changes or provide a sandbox or general CPU/resource proof.

Version and query each have a maximum 60-second deadline anchored at process
creation, <=256 KiB stdout and <=64 KiB stderr. A library-only `deadlineMs` can
lower that deadline (never raise it). Overflow, timeout, spawn/stream errors, and
nonzero original exit fail closed. The runner kills only its still-owned live
child and awaits the original close plus pipe closure. It retains bounded original
bytes with byte counts and SHA256, original code/signal, and the first process
failure reason. Failure cleanup also destroys still-open owned pipes, including
pipes held by descendants after the original child exits. Stream records retain
EOF, close, error and forced-destroy flags. Success requires normal EOF and close
on both streams, original exit zero and no process or stream error. No replacement
wait process is treated as success.

The output directory must not exist. Files use exclusive creation. The output
contains exact executed SQL/hash, version/query stdout and stderr, and a manifest
with expected inputs, observed file identities/hashes, process arguments and
failure reasons. Input/process failures retain a failure manifest; an output
write/close failure rejects the operation and cannot guarantee a persisted
manifest on a broken filesystem. Never interpret a partial output as success.

Fixed SQL includes `chrome.graphics_pipeline`, literal phase slice/track rows,
all nonzero stats with severity/source, trace bounds, and counts for six fixed
event names. Phase names are distinct UTF-8 strings <=256 bytes, 2..16 names;
control characters are refused and single quotes are doubled. Empty marker/frame
results are retained rather than labeled qualified. Informational import timing
stats are not native performance metrics. Later qualification must independently
establish clock/source/target ownership, completeness and frame population before
any specifically named presentation-rate calculation.

The fixed [v59.1 graphics module source](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/perfetto_sql/stdlib/chrome/graphics_pipeline.sql)
also supplies exported surface/display step rows: full counts, counts grouped by
step, and every row in deterministic order. First-display mappings and a count
of distinct non-NULL surface IDs lacking a mapping are retained. A separate
`surface_steps_without_surface_id` count retains the number of surface-step rows
with NULL IDs. The pinned module converts invalid `-1` surface IDs to NULL;
full exports preserve these rows without treating NULL as a valid ID. Display step
rows select the latest row per `(display_trace_id, step, utid)`; the mapping
records only the first display for a surface. These module rows do not bind a
target, and neither raw nor deduplicated rows establish a frame population.

Raw `PipelineReporter` and `Graphics.Pipeline` slices are exported independently,
with thread/process context and every argument key/value/type. No argument prefix
is assumed. Phase rows also include thread/process context. Left joins preserve
slices with NULL context or arguments. There is no row limit or successful prefix
export: exceeding the existing stdout cap fails the whole diagnostic.

The explicit `--inventory-config` CLI and `runInventoryDiagnostic(config)` library
entrypoint select the separate fixed `inventory.sql` policy. Configuration has the
same shape and must name a fresh output directory. Its manifest adds
`queryPolicy: 'inventory-v1'` and `rawRowsExported: false`. The existing `--config`,
`runDiagnostic(config)`, full SQL and full manifest shape remain unchanged. Policy
selection is internal to the entrypoints; configuration cannot supply SQL or
choose a policy. A failed full export never falls back to inventory mode.

Inventory retains every matching literal phase row with track/process/thread
context, all nonzero stats with severity/source, trace bounds, the six event-name
counts, complete module and per-step counts, distinct unmapped non-NULL surface
IDs and NULL surface-step counts. Raw reporter/graphics slices are represented by
complete counts grouped by name and track/process/thread context. Argument counts
group by slice name, `flat_key`, `key` and `value_type`, without exporting argument
values. Left joins preserve NULL context and argument groups. `arg_occurrence_count`
uses `COUNT(a.arg_set_id)`: the equality join guarantees this ID is non-NULL for
matched arguments, including arguments whose keys are NULL. Unmatched slices
contribute zero occurrences. A NULL-key group can therefore have a positive count
from matched arguments, and a wholly NULL group may also include unmatched slices.
`slice_count` separately counts all distinct slices represented by each argument
group, including unmatched slices in mixed NULL groups.
No raw step, mapping or reporter/graphics slice rows are exported by this policy.

These aggregates do not establish a target or frame population. Inventory retains
the same input and tool pins, identity bookends, process completion requirements,
deadlines and byte caps. There is no row limit or successful prefix: an inventory
with too many groups also fails as a whole. Every inventory result remains
`nativeSupported: false`, `fps: null`, `duration: null`, `scoring: false`.
`runAuthoredFixtureInventoryDiagnostic(config)` is the separate authored-executable
test entrypoint, with the same untrusted identity labels as the full fixture API;
the production CLI never uses either authored-executable entrypoint.

The explicit `--target-inventory-config` CLI and
`runTargetInventoryDiagnostic(config)` API select `target-inventory.sql` with the
same configuration shape and a fresh output directory. Its manifest adds
`queryPolicy: 'target-inventory-v1'`, `rawRowsExported: true`,
`qualification: false`, `captureQualified: false`, `fpsEligibility: false`,
`evaluationEligibility: false`, `scoringEligibility: false`,
`rankingEligibility: false` and `clockAdmission: 'not_evaluated'`.
`runAuthoredFixtureTargetInventoryDiagnostic(config)` is the explicit test API for
authored executables, with `authoredFixture: true`, `officialProcessor: false`;
the production CLI uses the official platform pin. Caller SQL or policy fields
cannot select or alter this mode.

This policy selects exactly `SetLayerTreeId`, `TracingStartedInBrowser`,
`FrameCommittedInBrowser`, `FrameDeletedInBrowser`, `ProcessReadyInBrowser`,
`BeginFrame`, `PipelineReporter`, `Graphics.Pipeline`, and the literal phase names.
One shared scope selects a family/phase collision once, without phase-time or
target filtering. It emits seven complete tables in order:

1. All eight fixed family counts, including zero counts and distinct arg-set counts.
2. Every selected slice with track/process/thread context and explicit NULL flags.
3. Every selected argument value/type and unmatched placeholder with NULL flags.
4. Complete name/flat-key/indexed-key/type groups with occurrence and slice counts.
5. All nonzero stats with severity and source.
6. Complete trace bounds.
7. The module's complete normalized first-display mapping.

`rawRowsExported` describes imported rows, not raw packet anchors. Shared arg sets
fan out for each referring slice; repeated host slices remain distinct. Indexed
keys such as `debug.data.frames[0].frame` and `[1].frame` retain separate records
even when they share a flat key or renderer argument PID. Emitter PID comes from
slice context and cannot substitute for an argument PID. `arg_present` distinguishes
an unmatched argument from a matched NULL-key argument. NULL flags distinguish
missing values from empty strings and literal `[NULL]` strings. Group occurrence
counts count matched arguments; distinct-slice counts also retain unmatched slices.

The exact stdout bytes are the canonical export. Keep int64/uint64 values as CSV
text or BigInt; JavaScript Number or numeric JSON reserialization can lose bits.
`value_type` retains signed/unsigned/bool distinctions. REAL values retain the
processor's decimal rendering, which may round and supplies no producer-double
identity or clock evidence. The pinned shell wraps string cells in quotes but
emits interior quotes literally. This policy doubles embedded quotes in every
final TEXT projection before the shell wraps it, producing standard CSV whose
parsed cells recover processor-visible text, including commas, quotes, UTF-8 and
quoted LF/CRLF. Scope, joins, grouping, ordering, NULL tests and numeric columns
continue to use the original values. Parse records with a strict CSV parser;
splitting physical lines loses multiline cells and embedded blank lines.
This compensation applies only to the new policy and exact pinned renderer;
the existing full and inventory policies remain unchanged. It cannot recover
producer-wire text identity, embedded NUL or malformed UTF-8 that the importer or
renderer cannot preserve. Keep NULL flags and the canonical stdout bytes.
Imported slice/arg-set/track/process/thread IDs are scoped to this import and its
input, processor and SQL hashes. They are not global identities or packet offsets.
The normalized mapping supplies first display only, without target membership.

This is an inventory for later evaluation. It contains no ownership, lifetime,
clock, population or performance evaluator, and retains `fps: null`,
`duration: null`, `nativeSupported: false` and `scoring: false`. The same pins,
bookends, deadlines and byte caps apply. A complete export exceeding the cap fails
as a whole; there is no row limit, successful prefix, fallback or download.

## Bounded scope inventory

`--scope-inventory-config` and `runScopeInventoryDiagnostic(config)` select the
fixed `scope-inventory.sql` policy with the same config, pins and fresh-output
requirements. The explicit untrusted executable-test API is
`runAuthoredFixtureScopeInventoryDiagnostic(config)`; the CLI always enforces the
official platform pin. Caller SQL, filters and policy extras cannot change selection.
The manifest copies all target-inventory non-authority labels, including failures
before validation, with `queryPolicy: 'scope-inventory-compact-v1'` and `rawRowsExported: true`.

Selection includes exactly `MainFrame.Draw`, `Scheduler::BeginFrame`,
`Scheduler::BeginImplFrame`, `DrawFrame`, `Graphics.Pipeline`, and configured literal
phases. A family/phase collision selects once. An ID-only recursive UNION adds all
distinct existing ancestors, including selected ancestors and ancestors on another
track, without multiplying shared paths. It terminates cycles. There is no time,
target, source, sequence or ownership association. Six complete tables appear in order:

1. Five exact family counts, including zero counts and distinct arg-set counts.
2. Selected nodes and complete distinct ancestor context, raw depth and immediate
   parent edges, `is_selected`, track/thread/process context and text NULL flags.
3. Every selected node's imported argument values and NULL flags with dictionary references;
   unmatched nodes retain one placeholder. Shared sets fan out for each selected
   node and repeated imported argument rows remain repeated.
4. Complete selected-only name/key/type dictionary, matched occurrence and distinct-slice counts.
5. All nonzero stats, without severity suppression, plus nullable text flags.
6. Complete importer trace bounds.

`parent_status` is `no_parent`, `missing_parent` or `parent_present` according to the
actual parent reference and row presence. Missing parent IDs remain on the child;
nonexistent ancestors are never invented. `duration_status` is `unclosed` only for
dur=-1, `other_negative` for other negatives, otherwise `nonnegative`. Raw depth is
never rebased. These statuses do not certify consistent edges, balanced producer
emission or capture completeness. Context-only ancestors expose `arg_set_id` but
their payloads are deliberately unexpanded in both argument tables.

The pinned importer's normalized slices supply ts/dur, depth, IDs and merged
begin/end arguments. They do not preserve original TrackEvent type, endpoint
provenance, original clock IDs or packet anchors. In particular dur=0 cannot
distinguish instant input from a zero-length begin/end pair. This exporter trusts
the pinned importer for supported clock decoding and slice construction; it is not
a second packet/clock decoder. `clockAdmission: 'not_evaluated'` remains literal.
All qualification/eligibility/native/scoring flags stay false and fps/duration
stay null. No ownership, FPS, interval or presentation admission occurs here.

Table 3 has columns `slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null`.
Table 4 has columns `arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null`.
Dictionary IDs are artifact-local decimal references assigned after raw grouping,
with binary text ordering and explicit NULL-first ordering. They are not frame,
packet, source, clock or target identities. Keep IDs as exact CSV strings or BigInt.
After complete successful parsing, index the dictionary by ID, reject duplicate
dictionary IDs and missing references, and allow repeated table 3 references.
For each table 3 row in order, restore name, flat_key, key, value_type and their
three NULL flags from its dictionary row. All other original argument fields
come directly from table 3. This restores the original 16 parsed cells and every
duplicate/shared-set row. `arg_present` comes from the original matched arg set;
matched NULL-key rows can share a group with unmatched placeholders. Counts do
not imply presence. REAL values retain the processor's decimal-rendering limits.

The unreleased expanded prototype is preserved at commit `6e888e3455b2af48184a0a825c4fb02214350065`;
its failed native export and prefix diagnostic are archived under
`/private/tmp/chat-ui-bench-native-scope-failure-package-20261025`. That prefix is
incomplete. Repeated text in it motivated this representation amendment; it does
not establish that a complete native compact export will fit the unchanged cap.
The API and CLI select only the compact policy. There is no prototype-mode switch.

Scope uses the same final TEXT quote compensation as target mode, preserving NULL
flags, grouping and ordering on raw values. Parse canonical stdout with strict CSV
and retain integer cells as decimal text or BigInt. The same 32MiB trace, 64MiB
processor, 16KiB config, 60s child deadline, 256KiB total stdout and 64KiB stderr caps
apply across all six tables. Overflow fails the whole export, with no LIMIT,
successful prefix, split query, cap increase or fallback.

Cross-mode ID comparison is conditional: first establish shared-ID determinism
under the identical trace bytes/length/SHA256, processor bytes/exact version and
import invocation options. Retain each complete successful manifest and its own
policy/source/executed SQL hashes; different policies have different SQL hashes.
This change's five smoke imports do not establish cross-mode scope/target ID
determinism on identical input. IDs are import-local, not global IDs or packet
offsets. Matching names, timestamps, paths or sequence numbers cannot substitute
for that evidence, and the exporter performs no target join.

## Maintained authored smoke and CI

```sh
node tools/perfetto-import/smoke.mjs --processor /absolute/trace_processor_shell --out /absolute/fresh-smoke-output
```

The import-inert smoke module authors the fixed 153-byte clock trace, verifies its
SHA256, runs the production pinned diagnostic, requires original process success
and normal EOF/close, and checks CSV markers at 1,001,000 and 1,021,000 ns, bounds,
and zero `Graphics.Pipeline` events. Its synthetic fixture has no native authority.
It also verifies zero module/mapping inventories and the full export schemas.
The smoke output includes the authored fixture, diagnostic artifacts and a small
`smoke.json` result. It never downloads a processor.

The standalone `perfetto-import.yml` workflow uses Ubuntu 24.04 and Node 24.20.0,
without npm installation. It explicitly downloads the fixed Linux raw executable
with an exact `15885448`-byte maximum and 60-second transfer deadline, requires
exact length equality and checks its SHA256 before chmod or execution. This raw
artifact contract replaces the former `15000000`-byte compressed ZIP cap and its
archive/member checks. Runner input/output caps remain unchanged. It runs the
authored tests and production exact-version/semantic smoke. Only small authored
evidence and test logs are uploaded for 14 days; the executable is excluded. Linux
execution is verified by the linked run; each future changed head still requires its own green workflow. Local macOS verification alone does not establish Linux compatibility.

The smoke also authors a separate corrected 308-byte graphics fixture and imports
it into `graphics-diagnostic/`. The clock fixture and its hash remain unchanged.
This second case verifies populated surface/display rows, first-display mapping
`43 → 58`, three raw slices with thread/process context, and the exact flattened
`frame_reporter` state, host, source, sequence and trace-ID argument values. Its
`Graphics.Pipeline` surface ID uses protobuf field 10; field 2 is a FrameSinkId
message. The fixed corrected bytes have SHA256
`2060e02191ec0f00325e024007de9080ab4224467d325e80c2261a28e1b8c542`.
Both cases require the official pin, normal process/stream completion and fixed
false native/scoring eligibility. Authored state names and IDs establish schema
coverage only, with no native presentation or performance authority.

The same 308-byte graphics file is also imported separately into
`graphics-inventory/` through the production inventory entrypoint. The smoke checks
complete module/per-step counts, both raw context groups, all ten argument key/type
groups and their occurrence/distinct-slice counts, policy labels and absence of
raw export schemas. It adds no fixture bytes or processor binary. The Node controls
also execute the inventory statements against authored in-memory SQLite tables to
verify repeated arguments, matched NULL-key arguments with positive occurrence
counts, unmatched NULL argument groups with zero occurrences, mixed NULL groups,
and missing track/process/thread context. The official authored fixture has
arguments on all three raw graphics/reporter slices, so it does not itself exercise
the unmatched argument case. `smoke.json` labels the separate inventory result and
records the shared fixture hash. Both existing full imports remain in the smoke.

A fourth production import uses a separate 1,238-byte authored target fixture in
`target-inventory/`, SHA256
`ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0`.
It composes the unchanged graphics bytes with modern nested debug annotations,
two indexed frame records sharing renderer PID 4242, browser emitter PID 900,
two identical host payloads sharing an imported arg set at distinct timestamps,
a phase loader navigationId, an argument-less event, a wrong-type layerTreeId,
empty/literal-NULL strings, adversarial `left",right` and `comma,"quoted"` values,
UTF-8, LF/CRLF and embedded blank lines, quoted key/phase/process/thread/track
names, and exact signed/unsigned integers above 2^53. The smoke parses all four
cases with strict CSV rules and rejects malformed quoting. It checks all seven
target schemas and row counts, mapping
`43 → 58`, values, types, NULL flags, multiplicity and all non-authority labels.
Matched SQL NULL keys/types/values remain covered by in-memory SQLite controls.
`smoke.json` labels the target fixture `authoredOnly: true`; `officialProcessor:
true` identifies the actual tool, not native qualification of the input.

The four-case official macOS 59.1 smoke passed locally. Actual Linux execution of
the added target case remains pending CI; prior Linux evidence for the original
three imports does not establish this fourth case. The existing workflow already
runs the updated smoke and retains its small authored evidence without uploading
the processor executable.

A fifth production import writes `scope-inventory/` from an independent 1,927-byte
authored scope fixture, SHA256
`8e5fa01db67d7c2ea70f955d86ba8d36f333a850bee964b275d621e173d84726`.
Its six table row counts are 5/13/38/27/3/1. It checks two unselected ancestor levels,
nested MainFrame.Draw/Graphics scopes, host-bearing DrawFrame, authored full-width
scheduler-shaped source/sequence/frame-time values with two sources sharing sequence 7,
another thread, equivalent shared argument sets, phase/family collision, quoted
multiline Unicode and exact integers above 2^53. Explicit builtin clocks 3/6 and
sequence-scoped clock 64 (1000ns units) normalize to expected ns timestamps/durations.
The pinned importer merges end arguments, collapses repeated producer annotation
keys to the final value, drops the unmatched end without a slice or bounds entry,
and retains the EOF-open DrawFrame with dur=-1. Arbitrary missing/cyclic/self/cross-track
parent graphs and repeated imported args are tested separately in authored SQLite.
The five-case official macOS smoke passes; changed-head Linux CI remains pending.
None of these authored inputs is a native capture or ownership/clock admission.

The scope fixture tests export precision; it does not establish production emitter
width. In the captured Chromium revision, [BeginFrameArgs serialization](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/components/viz/common/frame_sinks/begin_frame_args.cc#185)
passes source and sequence through [SetInteger(int)](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/base/trace_event/traced_value.h#41).
The exporter preserves the emitted value and does not restore missing source-generation bits.

The explicit `--mainframe-lineage-config` CLI and
`runMainframeLineageDiagnostic(config)` API select the separate fixed
[mainframe-lineage.sql](mainframe-lineage.sql) policy. Its manifest uses
`queryPolicy: 'mainframe-lineage-compact-v1'`, the same six compact scope-table
schemas, full raw occurrence export, and the same false qualification, capture,
FPS, evaluation, scoring and ranking flags. Clock admission remains
`not_evaluated`; FPS and duration remain null. The configuration, official
processor identity, custody bookends, process/stream completion, deadlines and
byte limits are unchanged. An oversized export fails as a whole without a prefix
or fallback. Existing full, inventory, target and scope APIs and SQL remain
separate. The explicit authored test API is
`runAuthoredFixtureMainframeLineageDiagnostic(config)`; the CLI cannot invoke it.

This policy selects exactly these eleven names, plus the literal phase names:
`ProxyMain::BeginMainFrame`, `ProxyMain::BeginMainFrame::commit`,
`ProxyImpl::ReadyToCommit`, `ProxyImpl::Commit`,
`LayerTreeHostImpl::CommitComplete`, `ProxyImpl::ReadyToActivate`,
`LayerTreeHostImpl::ActivateSyncTree`, `ActivateLayerTree`, `Commit`,
`MainFrame.Draw`, and `DrawFrame`. Family counts retain zero rows. A phase/family
collision selects each slice once. It exports all selected imported typed
arguments through the compact dictionary, preserving repeated references, NULL
flags and context-only ancestors without expanding ancestor arguments. Scheduler
and Graphics families are outside this selection; their existing exports are
complementary evidence, not an automatic fallback.

Names do not establish identity. In particular, `Commit` is emitted on different
tracks for different purposes; category, track, parent and full argument context
must remain attached. Exact emitted `main_frame_pipeline.main_frame_id` values
can support candidate relationships across commit/activation/draw records.
Repeated IDs across processes or tracks are retained, not automatically joined.
Conditional `last_begin_frame_id_during_first_draw` fields are exported when
present; missing fields are not synthesized. Never join reporter origins,
submission tokens or target ownership by nearest timestamp or sequence alone.
Pinned [ProxyImpl emission sites](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/cc/trees/proxy_impl.cc)
and [activation emission](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/cc/trees/layer_tree_host_impl.cc)
explain the main-frame fields. These records do not expose the controller's full
submission-token queue or reporter adoption/destruction population. A successful
export, a closed slice, and a longer capture tail do not prove that population
complete, nor do they qualify presentation rate or physical scanout.

The sixth official semantic smoke import uses an independent authored lineage
fixture. It exercises actual `MainFramePipeline` protobuf fields, full-width
integer IDs, first-draw source/sequence presence on only the first of two draws,
shared argument sets across distinct tracks, both `Commit` contexts and a
context-only `PipelineReporter` ancestor. This validates importer/exporter shape,
not production identity or performance. Changed-head Linux execution is supplied
by the existing pinned-processor workflow; local macOS evidence alone is not
Linux verification.

The explicit `--wheel-carrier-config` CLI and
`runWheelCarrierDiagnostic(config)` API select [wheel-carrier.sql](wheel-carrier.sql),
with `queryPolicy: 'wheel-carrier-compact-v1'`. Configuration uses the same trace,
processor, phases and fresh output fields. This exports imported graph facts;
qualification, capture, FPS, evaluation, scoring and ranking flags remain false,
clock admission remains `not_evaluated`, and FPS/duration remain null. The
separate `runAuthoredFixtureWheelCarrierDiagnostic(config)` test API cannot be
selected by the CLI and never attests an official processor.

Wheel selection includes every exact `LatencyInfo.Flow`,
`WidgetBaseInputHandler::OnHandleInputEvent`, `EventDispatch`,
`InputLatency::MouseWheel`, and `EventLatency` slice, every supplied literal phase,
and every literal name beginning `native-wheel-witness-v1:`. The prefix is fixed
and case sensitive. No expected nonce, step, ID, thread or time window narrows the
export. Binary name comparisons retain case-distinct siblings. Counts include
zero rows for absent fixed families and phases, plus all actual prefix names.
Phase/family/prefix collisions produce one name-count row and select each slice
once; repeated slices and argument occurrences remain distinct.

Its six tables use the compact scope schemas: name counts, selected nodes and
their complete existing parent closure, all selected arguments, the typed
argument dictionary, all nonzero importer statistics, and full trace bounds.
Missing parents, cycles, cross-track ancestry, extra wheels and conflicting typed
arguments remain visible. Flow and Widget arguments are expanded because those
families are selected; context-only ancestor arguments are not expanded. These
facts require a separate verifier before any request-to-wheel association.

This policy alone adds before/after bounded identity/hash snapshots of the fixed
`run.mjs` (64 KiB), fixed SQL source (16 KiB) and executed `diagnostic.sql` (16 KiB).
Source bytes and decoded SQL are read through bounded nofollow/nonblock original
handles; executed SQL must match the rendered hash. Any failed or changed source
bookend fails the diagnostic. `sourceBookends.stable` describes only these three
files' observed local stability; it does not authenticate review, creator
execution, Node's dependency closure or native collection provenance. Trace/tool
bookends and process limits remain unchanged: trace 32 MiB, processor 64 MiB,
stdout 256 KiB, stderr 64 KiB and each original process at most 60 seconds.

The seventh official smoke import uses a separate authored wheel fixture. It
checks a nested marker/dispatch/main-input-Flow/MouseWheel-Widget chain, a second
wheel Flow and prefix sibling on another thread, signed 64-bit trace IDs and
source-defined latency step strings. Its producer schema is
[ChromeLatencyInfo at 403906](https://github.com/google/perfetto/blob/403906f4adfbf287a02e5546f8430dcc9d56b649/protos/perfetto/trace/track_event/chrome_latency_info.proto).
Successful authored import does not establish native provenance, raw marker
correspondence, wheel-to-scroll-update causality, presentation population or FPS.
## Pure wheel CSV and parent graph diagnostic

`wheel-graph.mjs` adds two explicit pure APIs, with no file reads or subprocesses:
`parseWheelCarrierCsvV1(bytes, { phases })` and
`evaluateWheelCarrierGraphV1(parsed, { phaseNames, markerName })`. The parser
accepts a `Buffer` or ordinary `Uint8Array` containing the complete fixed
`wheel-carrier-compact-v1` six-table CSV. It rejects malformed UTF-8/CSV, incomplete
or reordered schemas, contradictory NULL flags, noncanonical/out-of-range
integers, inconsistent counts, dictionary references or argument multiplicities,
and unsupported typed channels. It preserves repeated equal arguments and
shared argument sets. IDs and SQL integers use `BigInt`; ordering uses UTF-8
binary comparison. CSV quote decoding is performed once, matching the fixed
query's compensation for the pinned renderer.

The parser's immutable facade is privately owned by this module. The evaluator
accepts only an original successfully parsed facade, with exactly the same
two phase names. Expected phases must have the native wheel recipe's start/end
grammar; the marker's nonce/carrier relation is recomputed. It requires exactly
one prefix witness in the entire exported graph and follows its immediate
parents, retaining intermediaries. Missing, cyclic, cross-thread, unclosed or
inconsistently nested relevant ancestry refuses. Exactly one enclosing main
`LatencyInfo.Flow` and one MouseWheel Widget must supply unique correctly typed
arguments. Negative signed trace IDs are supported; `-1`, aliases and repeated
required arguments refuse.

The facade also exposes deeply frozen `stats` and `traceBounds` snapshots with
canonical decimal integer strings and explicit nullable values, so a separate
wrapper can inspect all statistics without reparsing CSV. Snapshots and cloned
facades cannot be submitted as parsed ownership or authentication evidence.

The private facade proves only that these caller-supplied bytes passed this
grammar. It does not authenticate the exporter, native execution, raw instant
type, importer correspondence, browser target, clock or complete frame
population. Even `imported-wheel-parent-graph-consistent` remains
`inputOrigin: 'caller-supplied-csv'`, with native/qualification/FPS/scoring
eligibility false and FPS, rate, latency and duration null. All nonzero stats are
retained; `statsAdmission: 'not_evaluated'` means this pure evaluator does not
admit loss/error conditions for a native result. A successful graph must still
pass separate original-execution, raw-event and importer checks before any
native association claim.

The parser keeps the exporter's 256 KiB byte ceiling and adds refusal ceilings:
4096 rows each for counts, nodes and dictionary; 8192 argument rows; 1024 stats;
one bounds row; 24576 total records; 16 KiB decoded UTF-8 per cell and 256 KiB
total decoded text. Malformed suffixes withdraw the entire result. No caller
prefix, argument keys, policy, callbacks or relaxed mode are accepted. Argument
types/channels follow pinned v59.1
[`Variadic`](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/types/variadic.h)
and
[`GlobalArgsTracker`](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/importers/common/global_args_tracker.h).

## Raw metadata ledger v1

`raw-metadata-ledger-v1.mjs` exports the fixed internal diagnostic function
`await writeRawMetadataLedgerV1({trace: {path, bytes, sha256}, out})`. Paths must
be canonical physical absolute paths; `out` must be a fresh directory outside
the checkout and must not contain the input. The function creates directory
mode 0700 and file mode 0600. It takes no caller limits, decoders or callbacks.

This additive tool visits the complete Trace root and every packet's top-level
wire fields, and applies the unchanged strict local decoders to every field 6
ClockSnapshot and field 60 TrackDescriptor occurrence. It preserves repeated
or conflicting metadata and raw headers in their original order. All other
payloads and selected decoder-skipped fields remain opaque, with exact byte
windows and hashes. Even descriptor name field 10 is opaque; this projection
makes no selected-string UTF8 claim. False, zero, absence, signed/unsigned
integer strings and clock order survive unchanged.

Each ASCII record is `ordinal:payloadByteLength:payloadSHA256<TAB>JSON<LF>`.
The compact JSON tuple kinds are HEADER 0, PACKET 1, METADATA 2 and FOOTER 3.
The header binds the original input byte/hash pair and fixed source manifest;
the footer binds counts and ordered packet/record commitments. No fact
dictionary, UUID map, whole-trace inventory or write queue is retained.

A private synchronous fd worker owns parsing, pending ledger writes, input
physical EOF/hash/close, and one sequential ledger verification pass. Its
asynchronous supervisor requires original child exit/close and both output
streams' EOF/close before final file/source checks and admission. Fixed ceilings
include 32 MiB input, 256 KiB packet, 131072 packets, 131072 metadata records,
1048576 total field visits, 524288 member operations, 262144 total records,
256 MiB ledger and 4 Gi byte/step work units. Exact JSON byte preflight also
enforces `recordBytes <= 512 + 128 * recordOccurrences`; a valid local fragment
may still exceed the enclosing resource reservation and be refused. The 60 s
original deadline and 5 s owned-child cleanup grace are resource guards, never
benchmark durations. Source facts assume trusted fresh reviewed execution;
local hashes cannot attest loaded memory or historical execution.

The 4 Gi counter covers `ledgerSourceClosureLogicalWork`, including conservative
reservations for the unchanged decoder
scans and original read/write requests. Each short-write retry pays its entire
remaining requested byte window before the original call; acknowledged bytes
alone advance the ledger offset. Zero/error writes refuse. Final closure
prepays exactly 4194304 work units once within the unchanged 4 Gi ceiling, then
snapshots the seal counters.
Its local account guards JSON preflight steps, generated UTF8/allocation/copy
bytes, requested seal write/read bytes, equality/hash bytes and each original
asynchronous final operation before execution. Exhaustion refuses admission;
unused credit is never refunded or used to renew a guard. This reservation is
not measured CPU work. The result's `closureConsumedBeforeResultEncoding`
reports the explicitly named snapshot cutoff, excluding any later caller
encoding or return transport. The seal is never rewritten to predict itself.
Seal writes use original checked `FileHandle.write` acknowledgments; each retry
pays its remaining requested window, zero/error writes refuse, and the original
close is prepaid for cleanup even after a capacity refusal. Final identity
serialization/comparison scans and bounded stat formatting also pay the local
account. The original output directory's dev/inode/mode and physical canonical
path are rechecked throughout final creation, renames and return; changing
directory entry ctime/mtime is expected, while ancestor symlinks refuse.

Closed protocol transport has its own fixed bounds outside that logical-work
counter; the counter is not total process CPU, allocation or all JSON work.
There is one request serialization/parse (16384 bytes), one worker response
serialization/parse (262144 bytes), and at most 65536 opaque stderr bytes. Owned
JSON byte/shape preflight precedes encoding; fatal UTF8 decoding and a depth-8,
4096-node structural scan precede parsing. Malformed, extra or oversized messages
refuse; there are no alternate messages or protocol retries. Per process, at
most eight times the message byte cap bounds simultaneous payload, UTF16 text
and parsed-string representations, plus the fixed node bound and at most one
stream fragment per admitted payload byte. Request/result protocol scans are
explicitly excluded from the ledger/source/closure logical-work counter. They
carry no trace inventory, and there is no numeric guard renewal or cap increase.

`ledger.pending` and `seal.pending` are nonadmitted. Complete results reference
both final `ledger.jsonl` and `seal.json`; consumers must require a valid seal
and verify the whole final ledger hash. A final ledger alone is an orphan.
The seal explicitly labels its original pending ledger identity. Rename may
change ctime: the compact result's publication facts retain acknowledged rename
and full pre/post identities; dev/inode/mode/link count/extent/mtime must remain
equal through rename, and each new postrename identity including ctime is then
checked again. Late failure withdraws the transaction's own final seal into
`seal.failed`. Existing destinations are never reused or overwritten.

Success means `complete-raw-metadata-ledger-diagnostic` and complete
`selectedMetadataProjection`. Full packet schema, data-oneof, ordered state,
annotations, marks, clock conversion, correspondence, association and original
execution are not admitted. Native/qualification/evaluation/scoring/ranking/FPS
eligibility is false; FPS/rate/latency/duration are null. This tool does not
replace V11, change its limits or convert a V11 refusal into a result.

After building the analyzer, run the authored unit controls with
`node --test tools/perfetto-import/raw-metadata-ledger-v1.node.mjs`. Any real
control replay needs a separately frozen independent complete row oracle and
reviewed source/build execution. No performance feasibility or metrics claim
follows from these unit controls.

## Callback inventory v1

Run the additive fixed policy with:

```sh
node tools/perfetto-import/callback-inventory-run.mjs --callback-inventory-config /absolute/config.json
```

Configuration has the existing `trace: {path, bytes, sha256}`, `processor:
{path, sha256}`, 2..16 distinct literal `phases`, fresh absolute `out`, and
optional `deadlineMs` (1..60000) fields. The separate importable APIs are
`runCallbackInventoryDiagnostic(config)` and the explicitly untrusted
`runAuthoredFixtureCallbackInventoryDiagnostic(config)` in
[callback-inventory-run.mjs](callback-inventory-run.mjs). Import has no side
effects. Caller SQL, policy, cap and authority overrides have no effect.
The independent runner preserves the byte identity of legacy `run.mjs`, which
is attested by the existing feedback v1 source closure; maintaining these bounded
execution mechanisms independently avoids silently changing that contract.

[callback-inventory.sql](callback-inventory.sql) selects exact binary names
`Graphics.Pipeline.DrawAndSwap`, `Display::FrameDisplayed`, `Graphics.Pipeline`,
`PipelineReporter`, and literal phases. Family/phase collisions select once;
absent names retain zero counts. No time, duration, outcome, target or ID filters,
row limits, semantic joins, identity inversion or outcome classification apply.
Every selected imported slice, its argument occurrences, selected track metadata,
source/dimension argument occurrences, all nonzero importer stats and trace bounds
are exported. Unclosed/negative spans, cancellations, partial/dropped reporters,
repeated arguments and shared argument sets remain visible. Empty, NULL and
literal `[NULL]` text differ through explicit NULL flags. Integers remain exact
CSV decimal strings; consumers must avoid JavaScript Number conversion above
2^53. Every text projection exports its original bytes as hex.

Coverage is selected tracks only. Raw slice/track `parent_id` is descriptive;
referenced parents are not expanded or certified. The verified public `track`
view exposes id/name/type/dimension_arg_set_id/parent_id/source_arg_set_id/
machine_id/track_group_id. An exact ID join to `__intrinsic_track` supplies
`event_type`, `counter_unit`, `utid` and `upid`. Each track's `source` and
`dimension` memberships expand independently, even for the same arg set; each
absent match has a placeholder with `arg_present=0`. No arguments are deduplicated.
The public view and intrinsic columns are checked by the independent official
[authored smoke](callback-inventory-smoke.mjs), including merged process/thread
tracks, both argument namespaces and an actual embedded-NUL protobuf annotation. Pinned importer debug annotation key
overwrite can precede export: only imported occurrences are claimed.

All textual projections, including fixed namespace labels, use nullable
`<name>_bytes_hex` columns: SQL NULL remains NULL; every non-NULL value is uppercase,
even-length `HEX(CAST(value AS BLOB))`, including an empty hex string for empty text.
The original `<name>_is_null` flags remain authoritative where present. This
preserves embedded NUL, quotes, CR/LF, Unicode, BOM and any imported byte sequence
without depending on the pinned CSV renderer's NUL-truncating text behavior.
Numeric columns are unchanged. Decode hex to bytes before interpreting text;
invalid UTF8 is still losslessly exported. The authored smoke's convenience parser
validates the exact raw headers, canonical hex and NULL consistency, retains all
raw hex properties, and adds decoded base properties using fatal UTF8. Invalid
UTF8 refuses that convenience text view separately from raw export success.

The seven output tables have these frozen raw header orders (NULL flag 1 means
SQL NULL; 0 includes empty and literal sentinel text):

```text
name_bytes_hex,event_count,arg_set_count
id,ts,dur,depth,parent_id,name_bytes_hex,category_bytes_hex,track_id,arg_set_id,track_name_bytes_hex,utid,tid,upid,pid,process_name_bytes_hex,thread_name_bytes_hex,ts_is_null,dur_is_null,depth_is_null,parent_id_is_null,name_is_null,category_is_null,track_id_is_null,arg_set_id_is_null,track_name_is_null,utid_is_null,tid_is_null,upid_is_null,pid_is_null,process_name_is_null,thread_name_is_null
slice_id,arg_set_id,arg_set_id_is_null,arg_present,flat_key_bytes_hex,key_bytes_hex,value_type_bytes_hex,int_value,string_value_bytes_hex,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null
id,name_bytes_hex,type_bytes_hex,parent_id,machine_id,source_arg_set_id,dimension_arg_set_id,track_group_id,event_type_bytes_hex,counter_unit_bytes_hex,utid,upid,name_is_null,type_is_null,parent_id_is_null,machine_id_is_null,source_arg_set_id_is_null,dimension_arg_set_id_is_null,track_group_id_is_null,event_type_is_null,counter_unit_is_null,utid_is_null,upid_is_null
track_id,namespace_bytes_hex,arg_set_id,arg_set_id_is_null,arg_present,flat_key_bytes_hex,key_bytes_hex,value_type_bytes_hex,int_value,string_value_bytes_hex,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null
name_bytes_hex,idx,severity_bytes_hex,source_bytes_hex,value,name_is_null,idx_is_null,severity_is_null,source_is_null,value_is_null
start_ts,end_ts,start_ts_is_null,end_ts_is_null
```

The manifest is `queryPolicy: 'callback-inventory-v1'`, `diagnosticOnly: true`,
with all existing native/qualification/capture/FPS/evaluation/scoring/ranking
authorities false and FPS/duration null on success and failure.
`displayIdentityAdmission`, `callbackOutcomeAdmission`, `populationCompleteness`
and `clockAdmission` remain `not_evaluated`. Imported duration is not evidence of
callback success; merged track metadata cannot establish per-event display
identity. Successful export does not establish the producer callback population.

The same three-role source bookends cover the new runner (64 KiB), fixed SQL
source (16 KiB) and rendered executed SQL (16 KiB), with fatal UTF8 decoding and
bounded original handles. Trace/tool limits remain 32/64 MiB; stdout/stderr are
256/64 KiB. Each original child has at most 60 seconds and must close normally
with both original pipes at EOF/close. Byte/hash/identity bookends, fixed official
processor version/hash, full input EOF and exclusive output remain mandatory.
Hex encoding can increase output size; the fixed caps are unchanged.
Overflow fails the entire export; there is no clipping success or narrower retry.
Source stability attests only observed local files, not loaded execution history.

Schema source: pinned importer
[track tables](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/tables/track_tables.py)
verified SHA256 `10f38f0d8600d05a26cb76123f1fbfc36f76a7794d8e6dcdf52da61bee52e37d`;
[public track view](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/perfetto_sql/stdlib/prelude/after_eof/tracks.sql),
verified SHA256 `73758f268351788cee1987fcf0d326ff8347f32284ad73ccabce141f34f4026a`.
The producer's
[display callback sites](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/components/viz/service/display/display.cc)
end spans on cancellation or sanitized callbacks without serialized success flags.
[PipelineReporter destructor emission](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/cc/metrics/compositor_frame_reporter.cc)
and the pinned
[track importer](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/importers/proto/track_event_tracker.cc)
explain why a retained row is not an outcome or display-identity admission.

Run authored controls with
`node --test tools/perfetto-import/callback-inventory.node.mjs` and official
verification with `node tools/perfetto-import/callback-inventory-smoke.mjs
--processor /absolute/pinned/trace_processor_shell --out /absolute/fresh/smoke`.
CI preserves all legacy controls and smoke steps and adds these source/authored
checks after the pinned processor fetch. Only authored fixtures and verification
evidence are published; captured traces and derived results remain local.


## Compact callback inventory v2

The separate fixed `callback-inventory-compact-v2` policy exports the same four
exact binary callback families and 2..16 literal phases as V1. V1 stays unchanged.
Only distinct non-NULL text byte values are deduplicated. Every argument occurrence,
NULL flag, numeric cell, original ordering and source/dimension membership remains.
The first table is one global dictionary; the following seven tables replace each
`*_bytes_hex` column in place with `*_text_id`. SQL NULL references remain NULL;
positive contiguous IDs include a distinct empty value. ID zero is invalid.

The frozen eight raw headers, in output order, are:

```text
text_id,bytes_hex
name_text_id,event_count,arg_set_count
id,ts,dur,depth,parent_id,name_text_id,category_text_id,track_id,arg_set_id,track_name_text_id,utid,tid,upid,pid,process_name_text_id,thread_name_text_id,ts_is_null,dur_is_null,depth_is_null,parent_id_is_null,name_is_null,category_is_null,track_id_is_null,arg_set_id_is_null,track_name_is_null,utid_is_null,tid_is_null,upid_is_null,pid_is_null,process_name_is_null,thread_name_is_null
slice_id,arg_set_id,arg_set_id_is_null,arg_present,flat_key_text_id,key_text_id,value_type_text_id,int_value,string_value_text_id,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null
id,name_text_id,type_text_id,parent_id,machine_id,source_arg_set_id,dimension_arg_set_id,track_group_id,event_type_text_id,counter_unit_text_id,utid,upid,name_is_null,type_is_null,parent_id_is_null,machine_id_is_null,source_arg_set_id_is_null,dimension_arg_set_id_is_null,track_group_id_is_null,event_type_is_null,counter_unit_is_null,utid_is_null,upid_is_null
track_id,namespace_text_id,arg_set_id,arg_set_id_is_null,arg_present,flat_key_text_id,key_text_id,value_type_text_id,int_value,string_value_text_id,real_value,flat_key_is_null,key_is_null,value_type_is_null,int_value_is_null,string_value_is_null,real_value_is_null
name_text_id,idx,severity_text_id,source_text_id,value,name_is_null,idx_is_null,severity_is_null,source_is_null,value_is_null
start_ts,end_ts,start_ts_is_null,end_ts_is_null
```

The pinned authored capability gate rejects BLOB storage in materialized Perfetto
tables. V2 therefore fixes one canonical uppercase even-length ASCII hex pool,
materialized once, using explicit BINARY equality/order. Hex is injective and
preserves byte ordering, including NUL and invalid UTF8. There is no runtime
capability fallback. Final joins use this unique byte representation and never
deduplicate occurrence rows. Nonzero stats are snapshotted once before the pool;
the same snapshot supplies dictionary values and final rows. This is V2's explicit
stats observation point. Independently imported engine analysis values can vary;
every original nonzero snapshot row and value is retained.

Run the production API `runCallbackInventoryCompactV2Diagnostic(config)` or CLI:

```sh
node tools/perfetto-import/callback-inventory-compact-v2-run.mjs --callback-inventory-compact-v2-config /absolute/config.json
node --test tools/perfetto-import/callback-inventory-compact-v2.node.mjs
node tools/perfetto-import/callback-inventory-compact-v2-smoke.mjs --processor /absolute/pinned/trace_processor_shell --out /absolute/fresh/smoke
```

`runAuthoredFixtureCallbackInventoryCompactV2Diagnostic` is an explicitly untrusted
fixture API unavailable through the CLI. Callers cannot override SQL, policy, caps
or authority flags. The runner imports no decoder. Its three source roles remain
the runner (65536 bytes), fixed SQL source (16384 bytes) and rendered executed SQL
(16384 bytes), with fatal UTF8 and before/after byte/hash/identity observations.
Lexically valid long quote-heavy phases may exceed the separate rendered-SQL
ceiling and refuse before spawning. Trace/tool caps stay 33554432/67108864 bytes;
stdout/stderr stay 262144/65536 bytes; version and query each have 1..60000 ms.
Original children and both original pipes must close normally with EOF. Inputs
are fully read and hashed; output directories are exclusive. Overflow refuses the
whole export without narrowing, retries or automatic V1/V2 fallback.

The inert pure module exports `parseCallbackInventoryCompactV2Csv(bytes)`,
`expandCallbackInventoryCompactV2(parsed)` and optional
`decodeCallbackInventoryCompactV2Text(parsed)`. The privately owned frozen facade
contains `tables`, each with `header` and object `rows`. Expansion returns seven
raw V1-shaped hex tables. Numeric cells remain original strings without Number
rounding. Pinned REAL values `inf` and `-inf` are preserved literally; authored
NaN imports as SQL NULL with its original NULL flag. Unobserved nonfinite aliases
and finite-decimal overflow such as `1e999` refuse. Semantic decode retains hex and adds base-name text properties using
fatal UTF8 with BOM preservation. Invalid UTF8 refuses only that convenience view;
a valid compact facade and completed raw expansion remain valid. Copied/proxy
facades are rejected. Results/refusals are cached per owned facade.

Fixed decoder ceilings (no overrides): 262144 raw input bytes; 16384 dictionary
entries; 32768 dictionary plus data rows; 131072 text-reference cells; 262144 parsed
field cells; 524288 returned field slots across concurrently retained expanded and
semantic views; 524288 cumulatively referenced original text bytes (at most 1048576
hex characters); and one private monotonic 4194304-unit logical work account
spanning parse, cached expansion and optional cached text decode. Units charge
scans, field visits, byte validation, lookup/comparison, preflight, creation and
freezing. Repeated calls never reset the account or create a second raw expansion.
A successful bounded raw export can separately refuse interpretation capacity.

Every success/failure manifest stays diagnosticOnly with qualification, capture,
FPS/evaluation/scoring/ranking and native authorities false; FPS and duration are
null. Clock, display identity, callback outcome and population completeness remain
`not_evaluated`. The compact export supplies raw selected imported evidence and
cannot establish callback success, producer population or FPS. CI adds source
controls and separate official authored small/repeated-text smoke while preserving
all previous steps. Only authored fixtures/evidence are published; captured data
and derived results stay local.
