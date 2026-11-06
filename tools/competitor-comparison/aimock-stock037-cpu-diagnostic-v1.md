# Stock037 sampled-stack diagnostic

This separately identified local diagnostic runs exactly one Threadplane stock0.3.7 H10000/r6400/follow Aimock case against the genuine production assets. It adds page-scoped CPU sampling alongside the unchanged strict semantic V3 timeline collector and decoder. Its output directory must be fresh, exclusive and absolute; the only CLI option is `--out`.

Use the fixed `aimock-stock037-cpu-diagnostic-v1.mjs` runner only after focused Node checks and independent implementation review. Existing user authorization covers owned profiling; implementation tests do not themselves prove browser acquisition. Never select a different fixture, retry a failed capture automatically, increase caps, rebuild a debug bundle, or change competitor code through this path.

Qualification requires native case admission, strict V3 trace custody/decoder checks, CPU acquisition/source/closure checks, and the unchanged CPU data analyzer on canonical hash-joined readbacks. Data validation alone cannot qualify acquisition. New artifacts use a separate one-slot store and existing storage budgets; old16/48 ids and evidence remain closed.

Unknown CPU-operation ownership can also prevent trace raw/decoder publication through the existing unsafe gate. Both collectors still attempt cleanup and sealing; failed acquisitions need not produce fully decoded traces.

The CPU raw profile cap is 2MiB, binding64KiB and analyzer result32KiB. These bound retained/analyzed JSON, not CDP transport or Chromium internal memory: `Profiler.stop` returns the complete object. No filtering, normalization, truncated profile, repaired deltas or larger cap is admitted.

Profiling adds overhead to the simultaneous trace. Its task/layout durations must never be pooled with or treated as equivalent to the original closed48 baseline. Report actual sampled-stack counts/source attribution only, with `performance:false`, `scoringEligibility:false`, `FPS:null`, `cpuTime:null`. This diagnostic neither converts samples into CPU time nor establishes a production optimization or release speedup.
