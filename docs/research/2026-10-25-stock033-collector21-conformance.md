# Stock Threadplane 0.3.3: collector 2.1 conformance evidence

This fresh, headless, one-round collection retained **eight valid cases and four failed cases**. The invocation is failed; its dataset is sealed. Collector and analyzer were explicitly 2.1.0, seed 1, using `threadplane-langgraph-custom-transport`. This cohort is separate from the earlier collector 2.0 CI cohort, earlier native traces, stock 0.3.2, and modified-CSS experiments.

Audit kind: retained metadata/schema/content joins and exact file custody. This document curates the independent audit at 2026-10-25T17:53:33.461922+00:00 and the case 1 source review; it does not rerun scoring, capture, or semantic trace analysis. [Compact machine facts](2026-10-25-stock033-collector21-conformance.json) retain original fixture/trace sizes and SHA256 values for every case.

## Source, environment, and custody

Capture source was clean `e3d306149bea680f6c2314e96c91a86fc10ae20d`, before and after the audit. All five retained Threadplane packages (`a2ui`, `chat`, `langgraph`, `render`, `telemetry`) were 0.3.3, with package metadata and lock joins checked. Angular was 21.2.25; Playwright 1.64.0 used Chromium download 1248, HeadlessChrome/156.0.8078.4, revision `@f842f52ef39fd97b449eb27cff414bf05a98ddce`. The host was macOS with Darwin kernel 25.5.0, arm64, Apple M1 Max with 10 logical CPUs. Viewport was 1280 × 800 at device scale 1. GPU metadata identified ANGLE/SwiftShader software rendering and `disabled_software` GPU compositing. These describe headless software-backend conformance, not physical-GPU or native-prototype qualification.

The audit verified all 2,174 seal members (818,376,397 bytes) against their exact sizes and SHA256 values, including every original trace. There were no missing or extra files/directories; the three declared absent root candidates were absent. Claim/configuration and final-ledger bindings agreed. Including `dataset-seal.json`, the dataset contains 2,175 files and 818,983,787 bytes. The seal is 607,390 bytes, SHA256 `fdf6ed9b2c797117994ea6e84bd02be5db07f2d568abc5283d7bf5df9c3125b6`.

The [published reproducibility prerelease](https://github.com/cacheplane/chat-ui-bench/releases/tag/stock033-collector21-conformance-20261025-a) contains a ZIP of **87,422,086 bytes**, SHA256 `a221ca02193afc182883e06061d1c10a0e8c25b3b57bb2d091df025c999e9b42`, with all 2,175 members / 818,983,787 uncompressed bytes. The collection owner verified every ZIP member CRC, checked the GitHub asset size/digest, then independently downloaded the published ZIP and matched its exact size and SHA256. The release targets the capture revision; it preserves the failed invocation and does not claim FPS.

## Retained cases

| Case | History | Response bytes | Journey | Validation / capture | Final mounted | Trace bytes | Fits 32 MiB input cap |
| --- | ---: | ---: | --- | --- | ---: | ---: | --- |
| 0 | 100 | 6400 | follow | valid / complete | 101 | 49717770 | no |
| 1 | 100 | 6400 | history-reading | failed / partial | 101 | 52477773 | no |
| 2 | 100 | 262144 | follow | valid / complete | 101 | 58230911 | no |
| 3 | 100 | 262144 | history-reading | valid / complete | 101 | 54535870 | no |
| 4 | 1000 | 6400 | follow | valid / complete | 1001 | 49647816 | no |
| 5 | 1000 | 6400 | history-reading | valid / complete | 1001 | 52112702 | no |
| 6 | 1000 | 262144 | follow | valid / complete | 1001 | 44047122 | no |
| 7 | 1000 | 262144 | history-reading | failed / partial | 1001 | 45435621 | no |
| 8 | 10000 | 6400 | follow | valid / complete | 10001 | 19821826 | yes |
| 9 | 10000 | 6400 | history-reading | failed / partial | 10001 | 19158539 | yes |
| 10 | 10000 | 262144 | follow | valid / complete | 10001 | 21356343 | yes |
| 11 | 10000 | 262144 | history-reading | failed / partial | 10001 | 21907468 | yes |

Cases **1, 9, and 11** retain both `Scored scroll geometry unavailable` and `Declared return control did not dispatch`. Case **7** retains `Scored scroll geometry unavailable`. The four failed cases remain partial captures. Neither complete content delivery nor a sealed dataset upgrades them.

All twelve fixtures contain 202 ordered events. Producer emissions, page receipts, translation sequence/IDs/text, final runtime transcripts, active response text, and all-mounted content match the retained fixtures. Final counts are 101, 1,001, or 10,001 mounted messages as applicable. Runtime delivery ends successfully with loading false and error null. Collector matched-sequence claims remain empty.

All 207 selected root/case metadata files and 12,205 page records passed the applicable metadata schemas and case identity joins. Runner/page exception cohorts were empty, producer failures were zero, and the three instrumentation buffers were complete without overflow or rejection in every case. Some probes were unavailable, including DOM text-length refusal before reading in cases 6, 7, 10, and 11; these results do not imply that every probe succeeded.

All 36 retained setup/replay/disposal outcomes were complete within declared budgets. All twelve retained trace EOF facts were available, with trace auxiliary completion reporting `dataLossOccurred:false`. Retained ownership settlement and finalization success were true. These are checked source-owned closure facts, not independent instrumentation of original resource closure. The original process exit 1 came from the collection owner; the retained log independently reports conformance failure.

## Whole-page renderer gauges

For the 6,400-byte follow case at each history scale, these are `Runtime.getHeapUsage` usedSize and DOM node/document/event-listener gauges. They describe sampled whole-page renderer state, not chat-specific allocations, memory peaks, leaks, process RSS, CPU use, or rates. One run per scale supplies no competitor ranking.

| Case / history | Heap bytes: baseline → history-ready → replay-end | DOM nodes/documents/listeners: baseline → history-ready → replay-end |
| --- | --- | --- |
| 0 / 100 | 8892436 → 14209708 → 19613160 | 75/4/33 → 3304/4/451 → 3384/4/488 |
| 4 / 1000 | 8899180 → 42380460 → 74609736 | 75/4/33 → 31608/1/4031 → 31688/1/4068 |
| 8 / 10000 | 8899068 → 250021332 → 372157388 | 75/4/33 → 315134/1/40031 → 315214/1/40068 |

## Observed sampling gaps

These are periodic scroll observations in page-performance milliseconds. The table rounds to 0.001 ms; it does not infer a sampling rate, interpolate gaps, or measure frame presentation. Fresh on-demand checkpoint counts are separate.

| Case | Periodic observations | First → last page ms | Largest observed gap ms | Fresh checkpoints |
| --- | ---: | --- | ---: | ---: |
| 0 | 194 | 203.000 → 10390.900 | 395.600 | 0 |
| 1 | 197 | 153.300 → 10299.400 | 67.900 | 5 |
| 2 | 174 | 160.300 → 10290.100 | 79.400 | 0 |
| 3 | 179 | 155.400 → 10281.400 | 79.500 | 5 |
| 4 | 191 | 384.200 → 10653.900 | 398.500 | 0 |
| 5 | 196 | 380.500 → 10646.400 | 1522.400 | 5 |
| 6 | 123 | 379.700 → 10718.000 | 450.000 | 0 |
| 7 | 135 | 378.700 → 10693.000 | 1563.300 | 5 |
| 8 | 54 | 2462.600 → 14101.600 | 2348.400 | 0 |
| 9 | 60 | 2392.000 → 14052.600 | 5689.800 | 5 |
| 10 | 48 | 2442.200 → 14156.500 | 2534.400 | 0 |
| 11 | 54 | 2417.600 → 14155.000 | 3555.500 | 5 |

## Case 1: bounded anchor evidence, unresolved scroll cause

The scored before/post/later page times were 335.30000000074506, 563.5999999996275, and 1366 ms. Post-to-later elapsed 802.4000000003725 ms, satisfying the fresh 800 ms window. Post scrollTop was 22,270 with maximum 22,370 (100 px from bottom); later was 22,498 with maximum 22,524 (26 px). Across that window top increased 228 px and extent increased 154 px, despite four observed trusted wheel events each carrying deltaY −100.

Stock 0.3.3 defines pinned as bottom gap strictly below 150 px. Its streaming effect writes the bottom while pinned or on a new message; its scroll handler skips pin recalculation while a programmatic-scroll counter is positive. This makes continued auto-follow a concrete candidate, not causal proof: private pin state, actual write call sites, and browser anchoring were not observed. The inspected installed chat bundle was 938,918 bytes, SHA256 `f2162b354971143a70ed8fbe9db9d93391192202ebd98b1fac69653188187c4e`, at `apps/threadplane/node_modules/@threadplane/chat/fesm2022/threadplane-chat.mjs` (pin helper lines 10959–10960, streaming writes 11400–11422, scroll guard 11580–11588). Component CSS has no explicit anchoring override; that does not establish native anchoring ran.

History-97 moved outside the scroller clip by page time 946.9000000003725 ms and was omitted from the IO-derived admitted candidate set by 998.5 ms. The later checkpoint retained its identity but could not obtain anchor geometry. Final mounted-content validation still included it: omission is not deletion or unmounting proof. The benchmark return-control path can skip an absent or invisible control; the actual visibility decision was not retained.

The maintained history-window diagnostic API can admit this exact case as trial 0, but exports only before/post/later owner/membership snapshots and requires independent source-graph review for publication. There is no maintained single-case or diagnostic CLI flag. If pursued later, actual JavaScript scroller setter/method call attribution must be separately reviewed and explicitly unscored, with bounded page-time/target/call-site evidence, original delegation, and cleanup. Missing observed writes alone would not prove native browser anchoring. Preserve the scored gesture, threshold, original anchor, and failed result.

## Limits and next analysis boundary

Original trace bytes were streamed only for hashing. No semantic trace parsing or Perfetto imports were performed in this audit. Only cases **8–11** fit the maintained **33,554,432-byte** importer cap; fitting establishes no import success or metric eligibility, and cases 9/11 remain failed. Cases 0–7 exceed the cap; no cropping or cap increase was attempted.

No FPS, display-frame rate, presentation/target binding, physical/native qualification, or competitor performance ranking is established. Package metadata, retained lock, and emitted-byte provenance checks do not attest npm tarball executable semantics. The raw sealed artifacts preserve full context; this summary deliberately omits machine-local paths and bulky launch-flag inventories.

## Later offline inventory imports

This is a separate analysis after the original metadata/custody audit, whose `traceImportPerformed:false` scope remains unchanged. The original sealed case 8 and 10 traces were subsequently imported using clean analysis revision `510e8b3010f04723869ebde2a7130611af3d2210`, distinct from capture revision `e3d306149bea680f6c2314e96c91a86fc10ae20d`. Pinned official Perfetto v58.2/add693d8b (RPC 14) completed both diagnostic imports. Independent review parsed all ten complete small CSV result tables per import and verified config/SQL/stream hashes, normal process/pipe completion facts, before/after input bookends, and the original sealed trace bindings. No queries were rerun by that review.

| Case | Graphics.Pipeline | PipelineReporter | DrawFrame | Display::DrawAndSwap | BeginFrame | FramePresented | Overlap spill error/analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 3169 | 723 | 90 | 89 | 638 | 0 | 4 |
| 10 | 3126 | 722 | 78 | 77 | 645 | 0 | 5 |

The normalized surface-step, display-step and surface-to-first-display mapping tables were empty in both imports; their associated zero unmatched/NULL-ID counts are consequently vacuous. Both complete argument inventories contain `args.chrome_graphics_pipeline.*`, `args.current_task.*` and `args.frame_reporter.*` keys. The [pinned graphics module](https://github.com/google/perfetto/blob/add693d8b338ba9599dbcbc3e300b1ab8c000897/src/trace_processor/perfetto_sql/stdlib/chrome/graphics_pipeline.sql) uses unprefixed keys. This is a concrete compatibility gap consistent with the empty normalized tables, not proof that it is their sole cause or that zero frames were produced. No replacement SQL or key normalization was used.

Each import also retains two info/analysis import-timing stats and `slice_spill_overlapping_complete_event` at error/analysis severity, with values 4 and 5. The [official pinned statistic definition](https://github.com/google/perfetto/blob/add693d8b338ba9599dbcbc3e300b1ab8c000897/src/trace_processor/storage/stats.h#L748) describes overlapping complete events moved to overflow tracks with ambiguous nesting. This statistic is not a dropped-frame count or a global completeness check. Import success does not qualify clocks, target/frame population, physical presentation or FPS, and does not upgrade failed cases 1, 7, 9 or 11. The machine facts record this later analysis separately, including original trace and output hashes; no new capture, cropping or cap increase occurred.

The [separate published inventory archive](https://github.com/cacheplane/chat-ui-bench/releases/download/stock033-collector21-conformance-20261025-a/chat-ui-bench-stock033-collector21-inventory-main510e8b-20261025.zip) retains both complete manifests, executed SQL, version/query stdout/stderr and compact analysis facts. It is 12,775 bytes, SHA256 `7d5cdac1cde316b9af06d0cdeec5523fc9ea592bf6dd0f4d3c2d46619bc3233d`; the owner independently downloaded and verified the published bytes. It contains no additional raw trace or capture.
