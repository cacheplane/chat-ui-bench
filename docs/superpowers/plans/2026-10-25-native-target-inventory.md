# Native Target Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed, bounded target-evidence inventory to the maintained Perfetto importer while preserving all non-authority and existing-mode contracts.

**Architecture:** Add an explicit third internal policy and SQL file to the existing importer, then exercise it through a separate authored fixture and official semantic smoke. Export seven complete result tables under the current bounds. Defer every ownership, lifetime, clock and population evaluator.

**Tech Stack:** Node 24 built-ins (`node:test`, `node:sqlite`), fixed Perfetto SQL, official pinned Perfetto 59.1 executables, existing Linux GitHub Actions smoke.

**Amendment status:** Before further implementation, independently review the pinned CSV renderer correction in the design. The earlier 39-test target prototype used a limited literal-quote heuristic and is not acceptance evidence. Preserve its logs separately; do not carry that parser behavior forward. This amendment changes only the new policy's final text projections and smoke-only strict parsing, with no changes to old SQL, seven schemas, pins, caps or headers.

---

Read the normative contract first: `docs/superpowers/specs/2026-10-25-native-target-inventory-design.md`. This plan intentionally does not predict a protobuf fixture hash, generated SQL output size or synthetic importer IDs. Freeze those from the actual independently checked output during implementation. Explicit user authorization covers specification/implementation and subagents; do not insert new permission gates. This plan groups finished reviewed work in one logical commit.

## File responsibilities

| File | Action and responsibility |
|---|---|
| `tools/perfetto-import/run.mjs` | Add two explicit APIs, internal third-policy dispatch, new-mode labels and CLI flag; preserve process/input/output machinery |
| `tools/perfetto-import/target-inventory.sql` | New single scope view and seven fixed complete SELECT tables; final text projections compensate for the pinned renderer |
| `tools/perfetto-import/run.node.mjs` | Add focused API/CLI/SQL semantics/adversarial regression controls |
| `tools/perfetto-import/smoke.mjs` | Separate authored target fixture, smoke-only strict standard CSV record parser and production semantic smoke; preserve existing bytes/cases |
| `tools/perfetto-import/README.md` | Document explicit mode, table/value contract, limits and non-authority |
| `.github/workflows/perfetto-import.yml` | Inspect; normally unchanged because it already executes the smoke file on actual Linux |
| Existing `diagnostic.sql`, `inventory.sql`, V6/V7, application/capture sources | No edits |

Use `workdir` for the supplied isolated checkout, currently `/private/tmp/chat-ui-bench-native-target-inventory-20261025`. Do not assume the surrounding Angular repository instructions describe this separate package's commands: use the files inspected here. No new package installation or SDK.

## Task 1: Establish baseline and explicit API selection (red/green)

**Files:** modify/test `tools/perfetto-import/run.node.mjs`; modify `tools/perfetto-import/run.mjs`.

- [x] Inspect `git status --short`, `git rev-parse HEAD`, importer, tests, smoke, both SQL policies and CI. Record baseline SQL digests externally or with assertions; preserve user changes. Confirm PR 147 lineage; delay final rebase/PR until that prerequisite merges.
- [x] Run `node --version` (expected Node 24) and `node --test tools/perfetto-import/run.node.mjs` (expected all existing controls pass). If failures occur, investigate before introducing changes; do not weaken them.
- [x] Add failing assertions that both new exports exist, importing modules remains inert, and the authored target entrypoint selects only the new fixed SQL despite caller `sql`, `queryPolicy`, filters and authority properties. Assert existing APIs cannot select the new mode with those properties.
- [x] Run `node --test --test-name-pattern='target inventory|target policy' tools/perfetto-import/run.node.mjs`; confirm failure is missing new behavior.
- [x] Add only these wrappers, matching existing style:

```js
export async function runTargetInventoryDiagnostic(options) {
  return run(options, false, 'target-inventory');
}
export async function runAuthoredFixtureTargetInventoryDiagnostic(options) {
  return run(options, true, 'target-inventory');
}
```

- [x] Extend internal source selection with explicit `'target-inventory' -> './target-inventory.sql'`, leaving full/inventory paths unchanged. Initialize new-mode-only labels before validation:

```js
if (policy === 'target-inventory') {
  Object.assign(manifest, {
    queryPolicy: 'target-inventory-v1', rawRowsExported: true,
    qualification: false, captureQualified: false, fpsEligibility: false,
    evaluationEligibility: false, scoringEligibility: false,
    rankingEligibility: false, clockAdmission: 'not_evaluated',
  });
}
```

- [x] Add the SQL file in Task 2 before expecting successful execution tests. Keep this intermediate state uncommitted. API existence tests should pass; report SQL-file absence as expected pending work, never as completed functionality.

## Task 2: Seven complete SQL tables (red/green)

**Files:** create `tools/perfetto-import/target-inventory.sql`; modify/test `tools/perfetto-import/run.node.mjs`.

- [x] Add a failing local SQLite semantic test following existing inventory tests. Create source tables with exact columns used by the design: slice/track/context/args/stats/bounds and normalized mapping. Execute setup statements separately from SELECT statements so view creation does not count as a result table.
- [x] Populate two explicit fixture states: initially seed seven fixed families plus literal phases while leaving `FrameDeletedInBrowser` absent, then assert its fixed-name count is zero. Insert one `FrameDeletedInBrowser` slice and rerun, asserting selection and count one so all eight families receive positive coverage. Across these states include a phase/family name collision; an unrelated event that must stay excluded; two same-arg_set host slices; missing context; unmatched args; matched NULL keys/types/values and mixed NULL group; indexed frame `[0]` and `[1]` sharing one flat_key; distinct frame tokens with one renderer PID; browser emitter with another PID; empty and literal `[NULL]` strings; wrong-type layerTreeId; integer `9007199254740993` inserted using SQL integer text/BigInt. Add nonzero and zero stats, bounds and mapping rows. Include repeated identical argument rows to test occurrence counts.
- [x] Assert the seven ordered schemas and full expected row multisets from the spec; zero counts for absent families; no excluded event; no deduplication of host slices; occurrence counts based on matched arg_set; preserved NULL flags. Use SQLite `setReadBigInts(true)` where integer rows exceed Number safety, comparing to BigInt rather than forcing Number.
- [x] Retain the actual official 59.1 strict-CSV rejection as red evidence. Verify `/private/tmp/target-v59-csv_result_formatter.cc` SHA256 `7dc89d78b72f2333b0652ad6b62d154e641a5a8c916d5c32be0f7798b6994733` against the design's exact source URL and inspect `FormatRow`: it quotes raw strings without doubling interior quotes. Add failing projection/round-trip assertions for `left",right`, `"quoted"`, comma, `é🧪`, LF/CRLF and embedded blank lines. Include quoted dynamic names/keys/context and stats values, so escaping only string_value cannot pass.
- [x] For direct SQLite results, assert quote-doubled projected text (for example source `left",right` yields projected `left"",right`), unchanged NULLs/flags and untouched numeric types. Add a separate full rendering/strict parsing round-trip test that uses the pinned formatter's wrapping semantics and expects original processor-visible text. Test raw ordering with values whose order would change under escaped aliases, and raw grouping with duplicate occurrences. Do not weaken payload expectations to match malformed output.
- [x] Add static assertions: exactly one phase placeholder; exact eight fixed families; module include; no LIMIT/LIKE, REAL casts, ID arithmetic, target/phase-time filtering, caller-SQL tokens or evaluator outputs. Run the focused tests and confirm meaningful failure before implementing SQL.
- [x] Implement the scope using one view, in this shape (use Perfetto-supported view syntax and normalize only the keyword in SQLite tests if needed):

```sql
INCLUDE PERFETTO MODULE chrome.graphics_pipeline;
CREATE PERFETTO VIEW _target_inventory_selected AS
SELECT id, ts, dur, name, track_id, arg_set_id FROM slice
WHERE name IN ('SetLayerTreeId', 'TracingStartedInBrowser',
  'FrameCommittedInBrowser', 'FrameDeletedInBrowser',
  'ProcessReadyInBrowser', 'BeginFrame', 'PipelineReporter',
  'Graphics.Pipeline') OR name IN (__PHASE_LITERALS__);
```

- [x] Implement the seven SELECTs exactly as specified in the design's SQL contract. Use one complete context table and one argument table to avoid repeating context on every argument row. Use `a.arg_set_id IS NOT NULL AS arg_present` and `COUNT(a.arg_set_id)`, never nullable-key presence tests or COUNT(*) for occurrence counts. Add NULL flags, deterministic ordering and full mapping rows.
- [x] In final TEXT projections only, use `REPLACE(qualified_column, '"', '""') AS original_column_name` for every dynamic text column: selected/argument/group names, track/process/thread names, argument/group flat_key/key/value_type, string_value, and stats name/severity/source. Apply uniformly to constant family names if desired. Preserve numeric projections and raw qualified WHERE/JOIN/GROUP BY/ORDER BY expressions. In particular use `FROM stats st ... ORDER BY st.name, st.idx`, never escaped aliases. Keep all seven schemas unchanged; add no codec, header, profile or runtime output repair. Existing full/inventory SQL remains byte-identical.
- [x] Re-run focused API and SQL tests, then `node --test tools/perfetto-import/run.node.mjs`; expect all controls pass. Review both existing SQL files for unchanged bytes.

## Task 3: CLI and unchanged failure boundaries (red/green)

**Files:** modify `tools/perfetto-import/run.mjs`; modify/test `tools/perfetto-import/run.node.mjs`.

- [x] Add failing controls for `--target-inventory-config`: relative/FIFO config rejection, authored processor refusal before launch, and no authored bypass through JSON. Assert the new policy labels on a production refusal manifest and unchanged old CLI behavior.
- [x] Extend only the accepted CLI flag list/usage text and explicit dispatch mapping. Keep config-file bounded reads, regular-file checks and existing effective property surface unchanged; no new arbitrary policy field.
- [x] Extend previous official-pin refusal and authored previous-version controls to the new entrypoints. Assert the complete former 58.2 version exits normally, retains bytes, and fails before query; a former platform pin fails before any process launch.
- [x] Exercise the new authored policy against existing fixture executable failure bodies: stdout overflow, stderr overflow, deadline, original exit nonzero, inherited pipes after original exit, trace mutation, symlink/multiple-link refusal and output reuse. Reuse narrow helpers/table-driven loops rather than duplicate capture implementation. Check bounded retained bytes, unchanged bookends where appropriate, original process/stream flags and failure manifests.
- [x] Verify an echoing fixture observes exactly `source.replace('__PHASE_LITERALS__', "'begin''quoted', 'end'")`, matching executed/source hashes; assert all old full/inventory manifest fields unchanged and new-policy markers absent there.
- [x] Run `node --test tools/perfetto-import/run.node.mjs`; expect all tests pass. No production CLI success is inferred from authored executable tests.

## Task 4: Separate authored target fixture and official semantic smoke

**Files:** modify `tools/perfetto-import/smoke.mjs`; modify/test `tools/perfetto-import/run.node.mjs`; inspect `.github/workflows/perfetto-import.yml`.

- [x] Add failing fixture export/byte-contract and semantic assertions without changing old fixture checks. Extend production smoke to call `runTargetInventoryDiagnostic` for a separate `target-inventory/` output and report it separately in `smoke.json` with `authoredOnly: true` and unchanged non-authority fields.
- [x] Add a strict standard CSV record parser only to the smoke module, with tests for doubled quotes, embedded comma/LF/CRLF/blank lines, quoted empty strings, literal `[NULL]` versus NULL flags, and multiple result tables. Treat blank records as table separators only outside quoted fields. Reject bare interior quotes, unexpected characters after closing quotes and truncated quoted fields. Use explicit quote/field/record states; remove the earlier interior-quote heuristic entirely. Keep all cells as strings and keep the runtime importer uninvolved in parsing.
- [x] Author `authoredTargetFixture()` using the existing pure protobuf byte helpers and exact pinned 59.1 schema forms established by local source evidence. Avoid a second runtime decoder. Use modern debug annotations/nested forms accepted by the pinned importer to produce indexed `debug.data.frames[0/1]` keys, direct host metadata and phase navigationId. Retain existing 153/308-byte fixture functions verbatim; composing their bytes into a new fixture does not alter them.
- [x] Include two frames with a common renderer argument PID, browser emitter PID different from that PID, two identical SetLayerTreeId payloads at distinct slice timestamps, one argument-less selected event, wrong-type expected field, empty/`[NULL]` strings, signed/unsigned integer values above 2^53, and graphics mapping 43 -> 58 through existing graphics fixture composition. Add exact adversarial payloads `left",right`, comma, `"quoted"`, `é🧪`, LF, CRLF and embedded blank lines; quoted keys and process names; and a quoted phase name accepted by existing validation. Do not add control characters to phase names. Keep truly matched SQL NULL tests in SQLite when protobuf cannot encode them. The unmerged 1,052-byte target prototype may change; preserve its old logs separately and freeze only the actual replacement fixture bytes after strict official semantics pass.
- [x] Run the official retained Mac processor smoke using a fresh output directory:

```sh
node tools/perfetto-import/smoke.mjs --processor /absolute/already-retained/trace_processor_shell --out /private/tmp/perfetto-target-smoke-unique
```

Resolve the actual retained path from parent-provided evidence; do not download or discover executables. Expect the initial incomplete smoke to fail on a specific missing semantic assertion. If the source form flattens differently, verify pinned source and correct the fixture; do not lower acceptance to fit accidental output.
- [x] Inspect original `target-inventory/query.stdout` and manifest through the strict record parser. Pin the new fixture's actual byte length/SHA256 only after all adversarial text round trips equal the original processor-visible payloads. Assert both frame indices, exact string/integer text, distinct emitter/argument PIDs, the two host slices sharing one arg_set with full argument fanout, all seven schemas/counts, zero transition-family counts as applicable, complete normalized mapping and normal original process/pipe completion. Cross-check actual output with strict Python CSV parsing when available. Scope comparisons by table headers and avoid assumptions about unrelated synthetic IDs. Embedded NUL and malformed UTF-8 remain explicitly unsupported round-trip cases under SDK C-string rendering/text decoding; REAL decimal output remains rounded. Do not claim producer-wire equality or broaden fixture expectations to include corruption.
- [x] Assert new fixture module import remains inert and old clock/graphics bytes/hashes unchanged. Re-run all Node controls and the full official Mac smoke; expect all old plus new cases pass, no dependency install.
- [x] Verify the existing Linux workflow invokes the updated smoke and retains small authored evidence. Keep its source version, raw executable pin, acquisition caps and exclusion of executable artifacts unchanged. Actual Linux workflow success is required later; Mac output cannot substitute for it.

## Task 5: Documentation, independent review and retained native check

**Files:** modify `tools/perfetto-import/README.md`; verify complete diff.

- [x] Document new CLI/API names and example using the same config shape, fixed eight-name scope plus phases, seven tables, rawRowsExported meaning, NULL and integer representation, imported ID scope, first-display mapping limits and complete-output failure behavior. Explain new-policy-only quote-doubled SQL text projections plus pinned renderer wrapping, standard CSV record parsing for comma/quotes/newlines, and the embedded-NUL/malformed-UTF-8/rounded-REAL limitations. Describe supported text as processor-visible text, never producer-wire byte attestation. State false authority and no fallback/download/evaluator. Do not rewrite historical findings into new lineage or imply old full/inventory CSV was repaired.
- [x] Run `git diff --check` and review `git diff --stat`/full diff. Confirm no existing SQL, fixture bytes, process machinery, pins/caps, decoder, capture or application code changed. Check whether this standalone repository has a relevant docs generator; run none unless actually required by local scripts for this README change.
- [x] Request independent code/spec review with only the exact spec/plan/diff and safety contract. Resolve actionable findings, verify them personally, and rerun only relevant controls after changes. Do not repeat a reviewer's conclusions without inspection.
- [x] After review, use the maintained new CLI on the retained native trace with exact facts:

```json
{
  "trace": { "path": "/private/tmp/cub-033v2-b69dadc-a/p/capture/trace.pftrace", "bytes": 208730, "sha256": "a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8" },
  "processor": { "path": "/absolute/already-retained/trace_processor_shell", "sha256": "8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4" },
  "phases": ["native:native-real-chat-v1:history100-up:start:f529cf848ece4cd1", "native:native-real-chat-v1:history100-up:end:5c975785801a27ab"],
  "out": "/private/tmp/native-target-inventory-unique"
}
```

Write this only as an untracked external config after replacing the retained executable path and choosing a genuinely fresh output. Run `node tools/perfetto-import/run.mjs --target-inventory-config /absolute/local-config.json`. Verify trace identity against the prototype manifest before using it. Retain the exact results externally; never commit native raw rows/configs.
- [x] Inspect all seven complete tables and hashes if successful; confirm ten shared-argset host slices, indexed browser metadata, phase navigationId and original process completion. Preserve actual measured row/byte counts. If output exceeds 256 KiB, report the whole-run failure with retained bookends; do not raise caps, crop SQL, remove evidence or claim a successful native inventory. No result grants graph/clock/FPS authority.
- [x] Run fresh `node --test tools/perfetto-import/run.node.mjs`, official Mac full smoke and `git diff --check`; retain command/output evidence. Keep conclusions limited to what ran.

## Task 6: Follow-up PR and green integration (parent-owned)

- [ ] Confirm PR 147 merged, fetch/rebase this follow-up onto its actual merged main state and resolve only relevant conflicts. Do not create PR 148 before that prerequisite. Re-run relevant Node/Mac checks after rebase.
- [ ] Create one logical finished commit with no agent/co-author metadata, then the separate follow-up PR describing concrete new diagnostic behavior and actual validation. Attach the PR with the app artifact tool. PR number 148 is anticipated, not assumed.
- [ ] Wait for actual Linux official exact-version/semantic smoke and all required checks; inspect failure diagnostics and fix without weakening tests. Re-review any changes and merge only green under the user's standing authorization. No merge, PR creation, code edits, capture or download is part of the current document-authoring task.

Acceptance requires maintained mode tests and official Mac/Linux semantics; retained-native success remains a measured outcome, not a precondition for relaxing the exporter. Future typed graph/lifetime/clock qualification is a separately specified task.
