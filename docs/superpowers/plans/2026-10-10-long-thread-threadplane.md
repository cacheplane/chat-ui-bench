# Long-thread Threadplane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. The user authorized autonomous spec, implementation, reviews, PRs, and merges on green. Preserve a review boundary per task and use one logical finished implementation commit per PR.

**Goal:** Establish green repository CI, then ship the approved twelve-case long-thread suite using released Threadplane runtime and UI.

**Architecture:** Version 1 calibration remains unchanged. A version 2 workload/adapter contract separates canonical replay, runtime state, visible DOM and default scroll behavior. A stack-independent runner and offline analyzer capture and validate a production Angular adapter with reproducible dependencies.

**Tech Stack:** npm workspaces, TypeScript, Vitest, Playwright/CDP, Angular production build, Threadplane 0.3.2, GitHub Actions.

## Task 0: Repository CI and foundation merge

Files: create `.github/workflows/ci.yml`; update `README.md` reproduction/CI notes.

- [ ] Specify one read-only CI workflow for PR and main push, pinned actions, Node 24, npm ci, unit/typecheck/build, pinned Chromium install and sequential browser tests. Preserve failed test logs/artifacts as workflow artifacts; CI is conformance, not hardware benchmarking.
- [ ] Verify configuration, run local checks, obtain independent spec and quality review, push foundation PR, observe checks for exact head SHA.
- [ ] Make PR ready and merge only once every required check is green. Verify main workflow and fresh clean checkout. Configure required checks after the workflow exists without bypassing CI.

## Task 1: Version 2 workload and runtime observation contract

Files: create `packages/contract/src/long-thread.ts`, `long-thread.test.ts`, `comparison.ts`, `comparison.test.ts`; modify `packages/contract/src/index.ts`.

- [ ] Write tests first for all twelve deterministic cases: 100/1000/10000 history × 6400/262144 response bytes × follow/history-reading. Default seed 1, 512-byte prose history, 200 deltas at 50ms, exact IDs/roles/bytes, canonical hashes and ordered matrix. Test invalid/duplicate/malformed payloads and split fidelity.
- [ ] Run focused Vitest and confirm RED. Implement generator and strict version 2 fixture/manifest/invocation/observation types without changing version 1 semantics. Normalize whitespace only for content-only DOM projections, never runtime text; prove omission remains detectable and Unicode translation fidelity.
- [ ] Define adapter host operations/load/reset/dispose, lightweight replay status, visible-ID/content locators, declared all-mounted/virtualized coverage, native return control and scroll policy. Runtime checkpoints may cover several canonical sequence prefixes. Supply types and validators that runner/analyzer can share.
- [ ] Run contract tests/typecheck/build, then spec review and quality review. Resolve findings before Task 2.

## Task 1b: Versioned independent producer

Files: modify `packages/producer/src/replay.ts`, `server.ts`, `index.ts`; extend `replay.test.ts`, `server.test.ts`.

- [ ] RED tests prove v2 fixture acceptance, versioned observation suite/repetition identity, original monotonic deadlines, no acknowledgment scheduling, backpressure recording, terminal disconnection and malformed version rejection. Existing v1 replay tests remain unchanged.
- [ ] Add an explicit v2 producer entry point using the same independently timed scheduling engine. Strictly validate the canonical v2 fixture before opening SSE and emit v2 producer evidence with the correct suite identity. Do not coerce artifacts into v1 or create a second competing clock scheduler.
- [ ] Run producer unit/typecheck/build and v1 regression checks. Spec then quality review. This task must finish before Task 2 real-browser replay conformance.

## Task 2: Released Threadplane Angular application and replay bridge

Files: create `apps/threadplane/package.json`, Angular configuration, `src/main.ts`, `src/app.ts`, `src/replay-transport.ts`, `src/host.ts`, focused tests; update root scripts/lockfile only for required build integration.

- [ ] Verify installed release exports and peers; pin exact compatible framework/dependency versions with npm lock. Use @threadplane/chat and @threadplane/langgraph 0.3.2; production zoneless Angular, default chat CSS/renderer, telemetry false. No workspace aliases or mockAgent.
- [ ] RED tests: real runtime history restoration through getHistory/switchThread; submit(null) adds no optimistic user; messages-tuple metadata accumulates chunks; supported root terminal event plus refreshed history preserves response; omitted translated delta remains absent in terminal/history; abort/error terminates; reset/dispose releases lifecycle ownership.
- [ ] Implement independent SSE parse/translation bridge without ACK-driven producer timing. Terminal/history are reconstructed from actual translated content, not repaired from expected fixture. Observe public runtime signals and real scoped DOM; tag product hosts/actual scroller/composer without proxy text or overriding scroll.
- [ ] Await complete delivery/success/loading settled, verify exact full logical history outside scored phases. Native control returns response; begin history gesture after response mounts. Provide metadata/capabilities for future adapters and asset/source provenance.
- [ ] Run production build + real-browser adapter conformance with smallest/largest histories and short/long responses, omission rejection, native scroll. Run relevant tests, spec review, then quality review; fix findings.

## Task 3: Generic long-thread capture, artifacts and offline analysis

Files: create `packages/runner/src/long-thread-run.ts`, `long-thread-capture.ts`, tests; create `packages/analyzer/src/comparison-validate.ts`, `comparison-metrics.ts`, `comparison-report.ts`, tests; modify CLI/scripts and docs.

- [ ] RED unit tests for complete explicit matrix identity, version dispatch, failed/partial evidence preservation, dependency/assets identity, clock isolation and batched runtime/DOM checkpoints. Existing v1 artifact reanalysis must retain identical semantics.
- [ ] Explicitly test simulated virtualized visible coverage, offscreen historical sampling, and intentionally unmounted active-response freshness as unavailable.
- [ ] Implement separate bench:long-thread command with adapter selection, headed/headless, rounds/output and declared cases. New process/profile per run; 60s history setup,30s replay,10s disposal. Capture independent producer/translated/runtime/DOM evidence, raw trace, renderer counters and visible-policy checkpoints. No retries or silent workload reduction.
- [ ] Observe composer input in both journeys, four -100px wheel inputs at50ms in history journey, overlap anchor updates, native return. Wrong scroller/boundary/missing overlap invalidates journey; drift remains a measured policy result rather than an imposed calibration tolerance. Unmounted active content yields phase-specific unavailable DOM freshness.
- [ ] Analyzer independently validates logical transcript and visible projection, all matrix/schema/provenance identities, delivery and raw ordering. Runtime probes come from product state, not mirror transcript. Failed/invalid samples have no scored numeric values. Keep every run and unavailable count. Presentation stays unavailable until separately validated.
- [ ] Write JSON/Markdown descriptive summaries, same-stack repeat grouping with fixture/assets/build/env identity. Distinct future adapter asset identities remain recorded, never normalized into false equivalence. No rankings/confidence or synthetic retention leak claims.
- [ ] Verify v1 and v2 offline analysis determinism and raw hashes; run unit/typecheck/build and relevant real-browser cases. Spec and quality review before release.

## Task 4: Release and merged-build verification

- [ ] Run fresh npm ci, all unit/typecheck/build, nine foundation browser tests plus new conformance cases sequentially; run the 12-case matrix for 3 rounds. Preserve all failed results and report capabilities truthfully.
- [ ] Reanalyze twice, compare metrics excluding generation timestamps, verify raw hashes unchanged. Inspect diff and reviewed requirements. Update README/instrumentation docs with supported commands and actual limits.
- [ ] Independent final review, then one finished commit/PR. Attach PR to task, wait exact-head CI green, merge. Fetch main into fresh temporary checkout and run installed production build/conformance; inspect main CI. No other repo mutations.

## Parallel research: Presentation precision

Use an isolated diagnostic directory, preserve foundation raw traces, compare only browser-target/page-target tracing sessions in headed clean/scroll/stall. Validate emitted frame metadata and unchanged import with matching frontend. A later reviewed spec/plan must define actual presentation intervals, dropped-frame denominators, phase attribution and injected presentation-sensitive calibration before numerical FPS. If evidence is inadequate, retain unavailable and design a versioned alternative collector. Successful import alone is not a metric.
