# Stock 0.3.3 Preparation v2 Implementation Plan

> **For agentic workers:** use the repository's applicable test-first and verification guidance; execute this plan task by task with spec and quality review. Do not launch acquisition during implementation.

**Goal:** replace padding-dependent preparation for a new v2 family with exact named role membership and a maintained preparation-process owner, preserving all v1 behavior and caps.

**Architecture:** a named membership module authenticates the deduplicated file union; a v2 preparation adapter reuses only stable bounded custody primitives; an explicit outer owner joins the original preparation return with exit, pipe EOF and handle closure. The first slice prepares inputs only.

**Tech stack:** Node 24 built-ins, existing esbuild fixture compilation, existing stock build/probe provenance records and Node test controls.

**Spec:** `../specs/2026-10-25-stock033-preparation-v2-design.md`.

All implementation paths below are relative to the isolated benchmark worktree. The user has authorized infrastructure implementation, independent review, PR creation and merge on green.

## Task 1: Freeze approved membership inputs and red controls

Files: create `tools/native-real-chat/stock033-v2.node.mjs`; inspect existing `apps/threadplane/{provenance,probe-provenance,dependency-closure}.mjs` and native preparation modules.

- [ ] Enumerate approved role keys from source-reviewed current build evidence; 239 union/133 fixture inputs are current observations, never cardinality acceptance checks. Use the design amendment’s literal native-owner/native-runtime lists including runner transport descendants and analyzer internal-reader sources/JS. Regenerate and retain the actual133-name write:false fixture metafile and268-candidate named union using the amended exact lineage; neither prior list was retained. Record exact names/roles and original facts; verify provenance from the retained build invocation. Do not fabricate release authentication from recomputed caller hashes.
- [ ] Write authored tiny-fixture tests for exact sorted union, shared-role deduplication, separate role/unique counts, same-count missing/extra swaps, role duplicate/conflict, historical/test member refusal and fixed native key membership.
- [ ] Run `node --test tools/native-real-chat/stock033-v2.node.mjs`; expect failure because the v2 module/API is absent, not because dependencies or imports are broken.

## Task 2: Implement the small named roster module

Files: create `tools/native-real-chat/roster-stock033-v2.mjs`; update v2 tests.

- [ ] Export a frozen literal production native-module roster and v2 role schema; no recursive glob or all-Git-files selection.
- [ ] Implement inert owned data admission, bounded sorted per-role sets, exact expected/observed membership joins, consistent duplicate facts, role lists and canonical roster digest. Compare names and hashes; counts are report output only.
- [ ] Reuse maintained product/probe key definitions; validate authenticated record maps rather than trusting caller-supplied arbitrary additions.
- [ ] Add red cap tests then enforce the unchanged file/string/byte bounds before retention/serialization. Exercise archive/platform separation without reading actual large binaries.
- [ ] Rerun the focused test to green. Inspect that no module import starts I/O, compilation, subprocesses or a browser.

## Task 3: Add isolated v2 preparation and verification

Authored physical tests use the separate branded control facade described in the design so Linux source checks need no Darwin binary. Production entry points must reject authored modes/references/ledgers and retain the actual host gate. An explicit authored SDK forwarder proves that compiler resolution starts from the authenticated source root; it supplies no genuine build or native provenance.

Files: create `tools/native-real-chat/prepare-stock033-v2.mjs`; minimally modify `tools/native-real-chat/prepare.mjs` only if sharing internal custody primitives; update v2 tests and keep `stock033.node.mjs` unchanged.

- [ ] Write red tests for new mode/reference isolation, root product/probe facts, package/lock/config/style/asset joins, compiler-input drift and unchanged cap boundaries. Explicitly assert v1 still rejects short rosters and v2 references.
- [ ] Add `prepareActualStock033V2`/`verifyStock033PreparationV2` around exact role union validation. Apply existing authentic stock033 checks while removing the 1,004 literal only for v2; do not widen v1 options or result schemas.
- [ ] Validate fixture compiler actual metafile against approved named inputs AND each input byte count (stronger than existing compileActualFixture name-only comparison); preserve module/metafile pre-copy caps. Archive exact unique rows once, with compact role evidence in the existing manifest budget. Keep history/module/template/reference original created identities and fresh exclusive outputs.
- [ ] Platform references include the reviewed large Playwright bundle under existing 512 MiB referenced-content accounting; no claims that static metafile analysis closes dynamic runtime loading.
- [ ] Run `node --test tools/native-real-chat/stock033-v2.node.mjs tools/native-real-chat/stock033.node.mjs tools/native-real-chat/compile.node.mjs`; expect all pass, v1 output contracts unchanged.

## Task 4: Implement preparation-only original process ownership

Files: create `tools/native-real-chat/prepare-owner-stock033-v2.mjs`; update v2 tests. Use one source file with explicit parent/child entry dispatch if this keeps the fixed worker identity clear; otherwise one tiny fixed child module is acceptable and must enter native membership.

- [ ] Write red authored process/stream tests: single nonce-bound original success IPC, wrong/duplicate IPC, success then nonzero exit, spawn/timeout/overflow, inherited pipes, normal EOF versus forced closure, close/write errors, and late pending originals.
- [ ] Implement explicit bounded config/release input admission and original child ownership. Parent returns genuine preparation value only after original exit/close, normal pipe EOF/close and owned handle settlement; retain bounded failure receipts. Do not parse template stdout as authority.
- [ ] Implement the exact appended config/release/IPC/receipt schemas and numeric budget table in the design: 1MiB config/release, 8KiB result IPC, 64KiB pipes, 60s forward/65s final deadline, operation/handle slots, distinct archive/external/platform ledgers. Do not widen any cap.
- [ ] Keep CLI/library import inert. Test that successful preparation neither sets an acquisition release nor forks/imports native capture/browser work.
- [ ] Rerun focused authored controls to green; review process ownership and cleanup independently.

## Task 5: Verification, documentation and concrete accounting

Files: update `tools/native-real-chat/README.md`; optional focused workflow integration only through an existing source-test job. No browser job in this slice.

- [ ] Document exact new modes, named role union/dedup counts, preparation-only owner entry, external trusted platform boundary, unchanged limits and v1 preservation. Do not describe 239/133 as eternal accepted row counts.
- [ ] Build in maintained order: `npm run build --workspace @chat-ui-bench/contract`, producer, analyzer, runner. Then run `node --test tools/native-real-chat/*.node.mjs` and scoped workspace typechecks. Preserve actual command evidence and failures.
- [ ] Review full diff and fresh tests; compare v1 source controls/result shapes, ensure worker remains V6, and check no automatic acquisition/environment release wiring.
- [ ] Perform independent spec review then quality review. Group finished implementation in one logical commit; no mid-task commits or generated reports in the repository.
- [ ] After source review passes, run one fresh source-only v2 preparation from the reviewed green main build through the maintained owner. Retain original owner return/exit/EOF, fixtures/metafile and role/union/platform/byte/operation totals under a new temporary evidence root. Inspect any drift without padding or cap changes.

## Later acquisition slice (outside this implementation)

- [ ] Add an explicit `--prepared-stock-033-v2`/`runStock033OriginalV2` gate only after preparation outputs and accounting pass review; require distinct one-use `source-reviewed-native-chat-stock-033-v2` and exact v2 verifier. Preserve v1 and the unchanged lean worker/V6 request recipe.
- [ ] Acquire at most the explicitly authorized fresh cohort after main checks are green, with original process/stream/group/file closure and before/after custody. Keep failed attempts and origin distinct; never repurpose the lost historical native identity.
- [ ] Inspect retained raw evidence through the fixed diagnostic analyzer; report unavailable FPS unless clock/target/frame population evidence actually supports the defined rate. No VM CPU, physical qualification or presentation theorem is introduced by preparation.


## Independent review amendments (mandatory acceptance checklist)

- [ ] Implement the design's closed CLI/library config and trusted release handoff exactly. Retain build-created facts, reviewed revision/dirty state and original IPC reference in the owner receipt; do not hardcode self-referential implementation hashes.
- [ ] Cover all13 literal native-owner modules and13 native-runtime compiled keys with their13 fixed corresponding source keys. Assert probeCompiledKeys alone is insufficient for native capture; test unexpected runtime import/missing named descendant refusal. Include the13native-runtime TS counterparts and three new production modules as genuine additions; derive final counts from named union. Include exact eight Mac metadata keys from the design. No dependency crawler or padding.
- [ ] Test byte cap/preflight at1MiB config/release,8KiB coupled success IPC including its scalar accounting summary,64KiB each pipe,4,096 combined chunks,64stages/16ownedoperations/8sourcehandles; exact60s/65s anchor using an injected clock, without real minute waits in tests.
- [ ] Account source-dispatched filesystem operations/read/hash/write bytes and every platform pass. Test no-dispatch boundary refusal,4platformpass maximum,3GiB read/hash total and8MiB external evidence writes while preserving archiveTotal+manifest+262144≤16MiB. Small authored fixtures inject counters near limits; tests need no large allocation/binary.
- [ ] Test child original IPC send callback then disconnect, successful message followed by failed exit, original file close pending beyond deadline, forced pipe destroy, and compiler-like inherited service ownership. Normal compiler completion awaits esbuild.stop; deadline kills only the recorded original child group and records unavailable pending work, without grandchild-universe claims.
- [ ] Run the source-only real preparation only after the reviewed implementation and current main gates are green and other queued maintained browser/CLI jobs have completed. It must emit actual accounting and exact role union; compare against the fixed budgets without changing caps or claiming success from a timeout.
- [ ] A later already-authorized acquisition task may be a minimal compatible v2 alias/verifier selecting the existing worker/V6 recipe, with distinct one-use v2 release and unchanged null/false native authority. It need not be a new framework or separate PR; preparation never auto-dispatches it.
