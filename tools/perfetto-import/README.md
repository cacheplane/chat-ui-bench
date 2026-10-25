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
