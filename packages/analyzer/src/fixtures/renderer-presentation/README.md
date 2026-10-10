# Renderer presentation evidence

`reduced-golden.json` and the six `*.reduced.json` files are copied byte-for-byte
from the retained diagnostic spike `/private/tmp/chat-ui-bench-presentation-spike`.
Their event objects are authentic. The spike reducer regenerated subset JSON
containers and formatting; these are not full original capture bytes. Source
indices identify each event's position in the original full `traceEvents` array.
No positive event field has been repaired or synthesized.

The original full traces remain outside this repository in the spike's
`v3-calibration/` directory. Every retained object was compared to the original
indexed event, full and reduced hashes checked, and counts verified on 2026-10-10.
External command/result evidence: `/private/tmp/presentation-task1-fixture-proof.json`.
Reproducible command: `python3 /private/tmp/verify-presentation-task1-fixtures.py`;
successful output: `/private/tmp/presentation-task1-fixture-verification.txt`.
This manual verification is not presented as a unit oracle requiring local raw files.
The committed integrity tests verify copied bytes, indices and declared counts.

| Case | Full raw SHA256 | Reduced SHA256 | Events |
| --- | --- | --- | --- |
| 1-clean-page | fdb589c035f67386635ef5fd1870a1469cde81db3c4557fd8244c914f11bac1e | de9ad75c5434ae81614b43f5454e10e8fa688d53dfba2e44aed79909aa5e33a4 | 939 |
| 1-stall-page | 0782c7e2d95754b61e44eeddb2a08a226c6eb6925af08143d325749d796de9ef | 63a5ed2179e079e53cd842e04cbbc8ec72e49849ba7f1b3e0bac0f5c1f3daede | 899 |
| 2-clean-page | b625fa306156cf2c0ad76dae43f7f67d7e09c658ed2bef5b46215f339bb10d17 | 4ba7b7f69722a7d7975dc6fb2582c03adcb14160fd60a6c0d2fa2633fb3e6bcf | 937 |
| 2-stall-page | ad56109b61641553ca593591aa108778dd0780acf4f4e390c1d0bd7852c99c83 | 5fb7ae6bd0bfb9d44b2b08beeb4e9775783d6eae1ae105877c4ad4db2a6a1c1b | 903 |
| 3-clean-page | b0f6d96c8bf4c4f3af4e8d6864b74738c85ea8b95dcd57c28f1f3c57f594273c | 598eb26cec726d545491e5f139866e7056d681111525e6948a184d3ba2016a89 | 936 |
| 3-stall-page | ce2b98e4aefecae28a12d935e8cea2bbb4703d64703b685f3293b11d25ce8c0c | b7ef2025e2c730ff2d458addd8a34c5849b418c0b3f1aa3c6c9b3557eb2cf69b | 906 |

Copied golden-index SHA256: `62e3e14c3f273fdd205f6c7c43b5ea6b91df6f853ece7d19823ef224c93c3fff`.

Pinned Chromium: `f842f52ef39fd97b449eb27cff414bf05a98ddce`
(156.0.8078.4). Matching DevTools frontend:
`2d671c506c4e5f8958b027e26047deb0acfbd7f9`.
Bundled `models/trace/trace.js` SHA256:
`9ac5c69d2a98606fdfe9c1118881f353c8e7389b3e24929468374b171c357488`.
Bundled `models/trace/handlers/handlers.js` SHA256:
`4315ac8bc6195af18e65a53fe1681ab4852fbf9e2aa5c41c2f88ff38b88ca072`.

Whole-trace pairs: 300, 285, 299, 287, 299, 288. Eligible phase pairs:
295, 281, 294, 283, 295, 284. Distinct phase deliveries:
292, 269, 278, 265, 268, 260. Exact full phase denominators, rates and maximum
intervals are retained in the copied `expectedPhaseAnalysis` entries.

`interval-golden.json` is an additional independent oracle calculated from actual
bundled-handler `targetPairs` in
`v3-calibration/bundled-animation-parser-results.json`, SHA256
`0655e417de26af767c1628066b0b4b09767df7c64a14b88fad1f312009bd5f12`. The spike imported Chromium's actual bundled trace
module and reset/configured its AnimationFrames handler before forwarding original
events and finalizing. The independent Python derivation filters the golden target
PID, start and feedback timestamps within the golden `[startUs,endUs)` bounds,
deduplicates/sorts delivery timestamps, and subtracts consecutive timestamps.
Median uses the ordinary midpoint; p95 uses sorted intervals at
`ceil(0.95*n)-1`. No production parser was imported or used to derive expected values.
The additional file stores timestamps and intervals so this arithmetic is auditable.

| Case | Median (us) | p95 (us) | Maximum (us) |
| --- | --- | --- | --- |
| 1-clean-page | 8333 | 8334 | 16666 |
| 1-stall-page | 8333 | 16666 | 116664 |
| 2-clean-page | 8333 | 16666 | 16667 |
| 2-stall-page | 8333 | 16666 | 108331 |
| 3-clean-page | 8333 | 16666 | 16667 |
| 3-stall-page | 8333 | 16666 | 116664 |

Pinned primary sources:

- https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/content/browser/devtools/protocol/tracing_handler.cc
- https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/frame/animation_frame_timing_monitor.cc
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/AnimationFramesHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/MetaHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/handlers/FramesHandler.ts
- https://chromium.googlesource.com/devtools/devtools-frontend/+/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/trace/Processor.ts
