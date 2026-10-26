# Addendum v1: pinned first-display projection rule

Policy `stock033-first-display-source-clarification-v1` adds source interpretation to the immutable presentation-origin-associations draft. No trace query, capture, SDK, normalizer, or authority changed.

[Perfetto v59.1 graphics_pipeline.sql](https://raw.githubusercontent.com/google/perfetto/v59.1/src/trace_processor/perfetto_sql/stdlib/chrome/graphics_pipeline.sql), SHA256 `ee1441cd6268d2d21433cfb9095b6c69a58e8b0ce46e3f87b0c9f6d11959c921`, defines the exact rule:

1. Lines100–129 deduplicate display steps per `(display_trace_id,step,utid)` by descending imported `ts`, keeping row_number1; there is no additional tie breaker.
2. Lines143–155 join surviving aggregation steps to their slice and repeated argument rows, obtaining surface ID, display ID, and `slice.ts`.
3. Lines157–162 group by surface ID while selecting `first_value(display_trace_id) OVER (PARTITION BY surface_frame_trace_id ORDER BY ts)`.

The explicit window ordering is imported slice `ts`, **not numeric trace ID**. The outer export sorts rows by IDs for presentation only. Neither clause establishes native chronology here.

There is a significant SQL limit: grouping reduces the result to one row per surface before window evaluation. Under [SQLite grouping semantics](https://www.sqlite.org/lang_select.html#bare_columns_in_an_aggregate_query), unaggregated values come from an unspecified member of the group; [window functions operate on result rows](https://www.sqlite.org/windowfunctions.html). Consequently, this expression cannot select among all original membership occurrences after they have been grouped away. This is a SQL-semantic interpretation of the pinned definition, supported by current official SQLite documentation; the documentation is not binary-pinned. The exact planner/scan choice producing extra0271's final-display row remains unproven. Do not describe it as guaranteed first, guaranteed last, MIN/MAX, map overwrite, or ID ordering.

Raw exports still preserve extra0271 in aggregation slices645/903/1085/2275, while the derived table selects display`-1273753029367220588`. Preserve all eight raw membership occurrences; treat the one-row projection as its own derived artifact.

[Exact-pinned Chromium trace_id_helper.cc12–15](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/base/trace_event/trace_id_helper.cc#12), SHA256 `0a28a03fc161c66261c4085f10ecde35fffccd4bc7618e84055ae99eff941309`, combines a process-random uint64 with an atomic sequence value using XOR. This is not a numeric monotonicity guarantee and supplies no timestamp or cross-process order. No global ID construction, high-bit restoration, physical-presentation inference, duration, rate, or FPS admission follows.

The companion JSON retains source hashes/URLs and prior artifact hashes. Resolving the implementation-specific representative choice would require pinned processor/SQLite planner evidence; it is unnecessary to preserve the raw occurrence graph and was not pursued through additional queries.
