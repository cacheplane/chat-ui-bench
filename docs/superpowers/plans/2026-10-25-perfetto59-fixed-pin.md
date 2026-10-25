# Perfetto 59.1 Fixed-Pin Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify official 59.1 raw prebuilts and replace the two maintained fixed pins while retaining diagnostic-only authority and immutable 58.2 evidence.

**Architecture:** Change constants and distribution checks in place, without adding a processor abstraction or SQL/policy changes. Establish binary provenance before authoring literal hashes/version. Use existing authored controls and production semantic smoke, then compare separately retained imports of the same native input.

**Tech Stack:** Node 24 built-in modules, Node test runner, pinned GitHub Actions, official Perfetto raw GCS prebuilts.

**Spec:** [Fixed-pin design](../specs/2026-10-25-perfetto59-fixed-pin-design.md).

---

## File map

Modify `tools/perfetto-import/run.mjs` (fixed admission), `run.node.mjs` (authored controls), `smoke.mjs` (only necessary version commentary), `README.md` (provenance), and `.github/workflows/perfetto-import.yml` (raw Linux distribution). Existing `diagnostic.sql` and `inventory.sql` are unchanged. The owner maintains bounded findings in `docs/research/2026-10-25-stock033-native-v2-verification.md` and its JSON companion; do not overwrite historical 58.2 facts. Keep temporary binaries, configs and diagnostic output outside tracked source. Group finished related work into one logical commit, with no mid-task commits.

## Task 1: Qualify exact official bytes before defining pins

- [x] Read the spec's two exact objects and retained official metadata. In isolated fresh storage download Mac and Linux raw objects using HTTPS, 60-second transfer limit, and ceilings 14376168 / 15885448 bytes respectively. Verify exact lengths, retained generations and MD5 values; retain original metadata and calculate SHA256. Stop on discrepancy. Do not use the tagged launcher or a GitHub ZIP.
- [x] Execute only the verified Mac original binary with `--version`, retaining bounded stdout/stderr, original exit zero and normal EOF/close. Confirm full source correspondence to `1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d` and record the exact admitted version/RPC text. Linux hash observation is not Linux execution evidence.
- [x] Write the concrete observed hashes/version into the working implementation notes and README provenance draft. No placeholder, guessed digest, or assumed RPC version may reach admission constants. Explain publisher/vendor assumptions and first-use SHA limitations.

## Task 2: Write failing admission controls, then change constants

**Files:** `tools/perfetto-import/run.node.mjs`, `tools/perfetto-import/run.mjs`.

- [x] Review both new hashes and the exact version against independent download/version observations. Actual official Mac smoke and Linux CI must exercise the admitted new tool; avoid tests that only duplicate constant literals.
- [x] Add a production rejection case for the old pin on the current supported platform through both full and inventory entrypoints. Expect `status: 'failure'`, platform-pin error and empty processes. Existing authored executable rejection remains.
- [x] Add an authored-only executable returning the complete old 58.2 version (`Perfetto v58.2-add693d8b (add693d8b338ba9599dbcbc3e300b1ab8c000897)` plus RPC API 14). Rehash that fixture; expect version mismatch, retained normal version-process evidence and no query launch in full and inventory modes. This isolates version admission from production hash admission.
- [x] Run `node --test tools/perfetto-import/run.node.mjs` under Node 24. Expect old-pin/version rejection assertions to fail against old admission. Record the intended failure before updating shared authored success-version fixtures.
- [x] Replace only the two pin literals and `EXPECTED_VERSION`; update authored success-version fixture text to the independent exact observed text. Run the same test command again; require the full suite to pass, including overflow, deadline, descendant-held pipe, EOF, mutation, identity, NULL aggregation, policy separation and authority cases.

## Task 3: Replace the bounded CI ZIP acquisition with the raw Linux object

**Files:** `.github/workflows/perfetto-import.yml`, `tools/perfetto-import/README.md`, optionally version commentary in `smoke.mjs`.

- [x] Use exactly the Linux URL in the spec with `curl --fail --location --proto '=https' --tlsv1.2 --max-time 60 --max-filesize 15885448`, writing directly to the fresh tool directory's `trace_processor_shell`. Require `stat -c '%s'` equality with `15885448` and `sha256sum --check --strict` against Task 1's literal digest before `chmod 700`. Remove ZIP/archive/unzip logic. Do not widen runner input or output caps.
- [x] Retain existing pinned actions, Node 24.20.0, Ubuntu 24.04, tests and smoke command. Keep binaries out of evidence uploads; retain bounded authored logs, status and fixture diagnostics for 14 days. The production smoke must perform exact version admission on Linux; a matching hash without execution is insufficient.
- [x] Update README's example processor hash, platform table, exact version/source and distribution/trust description. Record the old 58.2 source pin and immutable evidence reproduction path. Preserve fixture bytes/hashes and semantic assertions; investigate differences rather than accepting arbitrary new output.
- [x] Run `node --test tools/perfetto-import/run.node.mjs`. Run `node tools/perfetto-import/smoke.mjs --processor <verified-absolute-Mac-processor> --out <fresh-absolute-output>` with concrete local paths at execution time. Require success of clock full, graphics full and graphics inventory imports, exact timestamps/rows/keys, normal original processes and false/null authority.

## Task 4: Review, verify Linux, and compare the retained native input

- [x] Review `git diff --check` and the complete diff; confirm SQL bytes, schema 1, `inventory-v1`, resource caps, capture and manual analyzers are unchanged. Request independent spec/implementation review and fix actionable findings. The document author must not substitute their own review for the requested independent review.
- [ ] Create the authorized PR with finished changes and concrete local verification evidence. Require green required checks, including actual official Linux exact-version/semantic smoke. Inspect CI logs/artifacts; a workflow declaration is not execution evidence. Do not merge a failure.
- [x] From the reviewed source, run separate production full and inventory diagnostics against the retained 208730-byte native input with SHA256 `a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8`, its original phase names and fresh 59.1-only output directories. Use `node tools/perfetto-import/run.mjs --config <absolute-full-config>` and `--inventory-config <absolute-inventory-config>`. Configs name the verified absolute Mac processor and exact hash. Keep the original captured source checkout and prior evidence untouched; do not recapture.
- [x] Independently audit input/tool/SQL/stream hashes, identity bookends and original process completion. Inspect all thirteen full/ten inventory tables and actual unknown-field status; review bounds, phases, context, module counts and every nonzero stat. Explain differences from 58.2 with exact source references. Record remaining clock, lifetime, surface/population and completeness gaps without FPS/duration/native-support/scoring claims.
- [ ] Update bounded findings with explicit new source/version/hash lineage and same-input comparison, preserving historical statements and cohort separation. Re-run relevant authored checks only if implementation changes. Review final diff and findings, then merge only with green required checks under existing authorization. Report exact commands/results, Linux evidence and unresolved limitations.

No fresh capture, source fork, generalized profiles, fallback, SQL changes, performance calculation, or reclassification of old evidence belongs to this plan.
