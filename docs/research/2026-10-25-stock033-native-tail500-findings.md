# Stock Threadplane 0.3.3: fixed-tail native findings

A fresh 100-message AIMock cohort used stock `@threadplane/chat@0.3.3` on green source `4ed79ad73456b84e461d0d5a24f36d16ab17e18f` with the separate `native-post-phase-tail-500ms-v1` collection policy. Its actual owner receipt verifies a fulfilled 500 ms tail, bound through the original worker stdout to the request, manifest, source and trace. Preparation, capture, stream closure, process cleanup and source bookends passed. [Fixed-tail evidence](https://github.com/cacheplane/chat-ui-bench/releases/tag/stock033-native-tail500-verification-20261025-a).

The trace is **233,200 bytes**, SHA256 `936e52d56cf71b75a64e9440364f0838611ec95572ff633de7aa7198856ede95`. The fresh no-tail comparator used source `a62bd42b9f30c373a75a06a17d889344f1ec53c7` and trace SHA256 `4b65eff86ca03488d2d2a19f8daef285a5bd012efffa00576f9f9c6f812ac1ac`. Independently read archived bytes confirm identical history, compiled fixture and all 12 product assets. These are separate acquisitions, not paired operation identities. [No-tail evidence](https://github.com/cacheplane/chat-ui-bench/releases/tag/stock033-native-v2-baseline-20261025-b).

| Observed display groups | Fresh no-tail | Fixed tail |
|---|---:|---:|
| Groups with all six steps | 3 | 4 |
| Groups missing terminal steps | 1 | 0 |

The six steps are draw-and-swap, aggregation, send-buffer-swap, post-submit, finish-buffer-swap and swap-buffers-ACK. This records better continuation coverage; it does not prove causation or complete presentation.

Among 21 MainFrame.Draw invocations, four have explicit submissions and 17 have exact surface-bound non-production outcomes: 14 WAITING_ON_MAIN and three NO_DAMAGE. The **whole target export** instead contains 19 non-production records: 14 WAITING_ON_MAIN and five NO_DAMAGE. These scopes must remain distinct.

All 22 PipelineReporter records are retained: 13 STATE_DROPPED, five STATE_NO_UPDATE_DESIRED, two STATE_PRESENTED_ALL and two STATE_PRESENTED_PARTIAL. Matching-surface reporter multiplicities for the four submissions are **1, 2, 1, 0**; the duplicate match references two distinct displays. These states are not a dropped-frame count or an FPS denominator.

V6 completes with owned EOF/hash/identity/close checks, 4,982 packets and two literal phase marks. Official pinned Perfetto 59.1 target and compact-scope exports independently succeed within the unchanged 256 KiB stdout limit; 166 common records and 705 raw argument rows agree exactly. No selected/context imported duration is negative.

V7/V8 nevertheless correctly refuse at packet **4723**: the 129th of 152 snapshot/descriptor observations exceeds their unchanged 128-observation cap. The independent census finds 67 clock entries. V8 raw-drop counts and the clock3 interval remain unavailable; no prefix or V6 ledger rescues them. **FPS and generic duration remain null.** Temporal root ownership, clock normalization, phase/carry-in/out population, emission coverage and presentation qualification remain unresolved. Headless SwiftShader does not establish physical scanout. Historical b69, stock 0.3.2 and modified-layout results remain separate.

The fixed-tail archive has 353 members and SHA256 `e3398390255a23dabe50bb91a2e15a0710d99081ce751b1b9a3eb3713a2ffe47`; the no-tail archive has 342 members and SHA256 `8d9ac385bd7ca76e615403a3b9b4de66583966b339f10f04141963d78d5ff5ad`. Published downloads passed CRC and all-member hash verification. Exact versions, scoped counts, export hashes and archive names are in the [companion JSON](2026-10-25-stock033-native-tail500-findings.json).
