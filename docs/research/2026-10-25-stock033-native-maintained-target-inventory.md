# Maintained target inventory on the retained stock 0.3.3 native trace

## Scope and completed checks

The explicit `target-inventory-v1` mode completed on the existing stock Threadplane 0.3.3 `history100-up` protobuf. Capture revision remains `b69dadc4e3bd12eeb8f15db26343363ce58e52a2`; analysis revision is `85d06a671f01602214f17aa2fcc103ee9ad7681c`, based on merged `308751ad7b483db78932a79d7cea8d7e295769b2`. No new browser capture, preparation, fixture replay or application modification occurred.

Input: **208,730 bytes**, SHA256 `a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8`. Processor: official Mac Perfetto 59.1, SHA256 `8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4`. Fixed target SQL SHA256 `f1fe2faaadcc68c57933ef51fd087ea795bc704416f9375c7b115d888acf3db9`. Root observed the original CLI exit zero. Independent audit verified admitted input/tool hashes, stable file identities/bookends, exact source/executed SQL, every process stream hash/length and normal original exit/EOF/close. That audit did not independently observe the historical CLI session.

Source controls passed 40/40. A fresh post-rebase official Mac smoke passed the unchanged 153-byte clock, 308-byte graphics full/inventory, and separate 1,238-byte target fixture (SHA256 `ed2b0047fdc87b33174d23cce2d34c21e9cdf900df66db403315d848bd311de0`). Strict Python CSV independently parsed all four outputs; original version/query completion and all 16 stream envelopes matched. These authored inputs validate tool/query semantics, not native application performance. Linux fourth-case validation remains a required changed-head CI gate.

## Complete selected-scope export

Output was **155,238 bytes**, SHA256 `e75f22e10a77548af8ee7cf19737fa7e13e7b17a6cd10edcdf8a2169e49c22a3`, within the unchanged 256 KiB stdout cap. Every result table was retained:

| Table | Rows |
| --- | ---: |
| Fixed family counts | 8 |
| Selected slice context | 183 |
| Selected raw arguments, including fanout | 772 |
| Complete grouped keys/types | 50 |
| Nonzero stats | 21 |
| Trace bounds | 1 |
| Normalized surface-to-first-display mapping | 5 |

The selected scope includes the eight fixed event families and both exact caller phase literals. It has 145 Graphics.Pipeline, 5 PipelineReporter, 20 BeginFrame, 10 SetLayerTreeId and 1 TracingStartedInBrowser slices, plus both marks. FrameCommittedInBrowser, FrameDeletedInBrowser and ProcessReadyInBrowser have zero recorded slices. This is an absence inventory, not proof that no lifetime transition occurred. Selected slices and pipeline steps are not presented-frame counts.

All 772 argument rows and 50 groups were independently recomputed from 183 slices. The 150 graphics/reporter contexts and 696 arguments match the prior full 59.1 export; all 13 metadata slices / 36 arguments and grouped keys match the earlier standalone probe. Ten SetLayerTreeId events share one arg_set and all ten survive; raw row fanout is preserved rather than deduplicated by arg_set_id.

Both marks retain loader navigation IDs. Indexed `frames[0]` keys preserve the specific frame/renderer association, distinct from indexless flat_key. Browser metadata emitter PID13799 is context, while renderer PID13804 is an argument; neither replaces the other. Three selected reporter surface IDs join sink-bearing graphics records for frame-sink `(4,10)`. These positive associations do not admit all twenty surface IDs, continuous/exclusive target lifetime or a presentation population. Import-local slice/arg_set IDs remain scoped to input, tool and SQL lineage.

## Text and numeric fidelity

Official 59.1's [formatter](https://github.com/google/perfetto/blob/1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d/src/trace_processor/shell/csv_result_formatter.cc#L61) wraps strings without doubling interior quotes. A strict reader rejected the initial quoted synthetic output. A fixture-specific permissive parser was rejected. The new fixed SQL doubles quotes only in final text projections before that renderer wraps them, allowing a strict CSV reader to recover supported processor-visible text. Raw WHERE/JOIN/GROUP BY/qualified ORDER BY, numeric columns, NULL tests and all seven schemas remain unchanged. Old full/inventory SQL is unchanged.

Official-tool tests preserve quotes in names/keys/phase names, commas, `left",right`, Unicode, LF/CRLF and embedded blank lines. Empty strings and literal `[NULL]` remain distinguishable through explicit NULL flags. Integer/uint values above 2^53 remain exact CSV text; no JavaScript Number or REAL conversion is used. Embedded NUL, malformed UTF-8 and rounded REAL rendering remain explicit limits. This export does not attest original producer bytes or generic future-processor formatting.

## Loss-ledger interpretation

A separate whole-wire census found fourteen nonzero `previous_packet_dropped` declarations in this same 4,396-packet input. Every declaration has value 1, an explicit first-packet marker and no prior observation of the exact machine/sequence key. Thirteen coexist with reset flags; the last does not. Root independently recomputed this result and verified the [published census](https://github.com/cacheplane/chat-ui-bench/releases/download/stock033-native-v2-verification-20261025-a/chat-ui-bench-native-stock033-b69dadc-a-raw-drop-inventory.json) download.

The original V6/V7 `sequenceStart` ledger remains `raw:1, explained:1, unexplained:0, contradictions:0`: reset handling takes precedence over its state-loss branch. That ledger was not an exhaustive raw-header census. Fourteen declarations are not fourteen dropped frames, and first-packet signals do not prove missing captured packets. A future clock profile requiring every later raw drop to be rejected needs an additive versioned inventory; it must not infer that guarantee from V7's ledger or silently weaken it. The new target mode makes no raw-loss completeness or clock-admission claim.

## Evidence and authority

The [separate maintained target archive](https://github.com/cacheplane/chat-ui-bench/releases/download/stock033-native-v2-verification-20261025-a/chat-ui-bench-stock033-native-target-inventory-head85d06a6-20261025-a.zip) is **50,949 bytes**, SHA256 `a6108cc0fa7e8a49458bee9c9490dda7fbfccabf3b9843b3635aefdfb484c542`, with 43 members / 303,647 uncompressed bytes. CRCs and all 41 manifest member hashes passed, followed by an independent release download matching length/hash. It retains original native-target outputs/config, the independent audit, source SQL/hash references and authored Mac validation; it contains no tool binary or duplicate raw trace.

All qualification/capture/evaluation/scoring/ranking/native-support flags remain false; clock admission remains `not_evaluated`; **FPS and duration remain null**. Clock interpretation, lifetime/scope coverage, identity reuse, population, terminal outcomes and completeness still require their own explicit rules. Keep this analysis separate from older 58.2/59.1 full/inventory outputs, older stock/modified cohorts and the 10k CDP JSON browser cohort.
