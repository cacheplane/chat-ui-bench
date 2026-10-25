# Pinned Perfetto import diagnostic

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
node --test tools/perfetto-import/run.node.mjs
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
