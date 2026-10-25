# Retained stock 0.3.3 CDP JSON inventory

Two complete offline inventory imports found graphics events in retained
Threadplane captures, but the pinned graphics module produced no rows because
its argument names differ from the imported CDP JSON names. These results do not
establish a presentation rate or FPS.

## Capture and analyzer provenance

Inputs are H07 cases 8 and 10 from [PR 143 run 40208864389, attempt 1](https://github.com/cacheplane/chat-ui-bench/actions/runs/40208864389),
[artifact 12604379612](https://github.com/cacheplane/chat-ui-bench/actions/runs/40208864389/artifacts/12604379612).
The capture snapshot records synthetic merge revision
`f69185f835ddb885e24a4251e9efa5db4372bea3`; the reported PR head is
`5f4bfbfaf710cc08cf65b1ee59664bca85f4626a`.

Both cases passed their retained conformance validation. They use the stock
Threadplane 0.3.3 production build and `threadplane-langgraph-custom-transport`
profile, one round with seed 1, headless Linux Chromium with SwiftShader. The
five used Threadplane package records are 0.3.3, with no modified idle-host CSS
configuration. These captures represent one adapter, not a competitor comparison.
They remain separate from earlier stock 0.3.2, modified configurations and native
protobuf captures.

The executed inventory analyzer was commit
`f88ee8a5d46619968477ce407daa67f0defd2d3f`. Its rebased equivalent is
`3f4dd4cc98cadd0394e95ae55e38e7140eb5bfb4`; their `tools/perfetto-import`
subtrees both have Git tree ID `fa826b283106aabd6928fad7b3c13b4a4e965306`.
The rebase is not a new execution or evidence from a later hosted run.

Both imports used official Mac ARM64 Perfetto v58.2, commit
`add693d8b338ba9599dbcbc3e300b1ab8c000897`, RPC API 14, through explicit
`inventory-v1` selection. Exact input/tool hashes and compact findings are in
[the companion facts](2026-10-25-stock033-cdp-json-inventory.json).

## Complete imported-file counts

Both workloads contain 10,000 historical messages and follow the response.
Counts below cover each complete imported file, including surrounding capture
activity. They are not phase-scoped, target-qualified frame populations.

| Event name | Case 8: 6,400 response bytes | Case 10: 262,144 response bytes |
| --- | ---: | ---: |
| `Graphics.Pipeline` | 3,095 | 3,363 |
| `PipelineReporter` | 717 | 727 |
| `DrawFrame` | 57 | 46 |
| `Display::DrawAndSwap` | 56 | 46 |
| `BeginFrame` | 670 | 682 |
| `FramePresented` | 0 | 0 |

The official surface-step, display-step and first-display mapping tables each
contain zero rows. The complete argument-key inventory instead contains
`args.chrome_graphics_pipeline.*` and `args.frame_reporter.*` keys.

The [exact pinned module](https://github.com/google/perfetto/blob/add693d8b338ba9599dbcbc3e300b1ab8c000897/src/trace_processor/perfetto_sql/stdlib/chrome/graphics_pipeline.sql#L40)
extracts bare `chrome_graphics_pipeline.*` keys and requires non-NULL extracted
IDs. Its aggregation join also selects the bare flat key. This namespace mismatch
explains the empty module tables. Their downstream zero unmatched-ID counts do
not demonstrate complete joins, and zero `FramePresented` name matches do not
demonstrate that no frames were presented.

All 717/727 reporter slices have a state key. Inventory exports key/type counts,
not argument values, so presented-all, partial, dropped and no-update populations
remain unknown. Renderer and Viz contexts are available, but page, layer-tree,
frame-sink, surface and display presentation identities have not been joined.

## Verification and limits

Both retained manifests report matching expected trace/tool hashes and stable
before/after identities. Original version/query processes exited zero, with
normal pipe EOF/close and no forced destruction. The audit independently checked
retained SQL and stdout/stderr hashes and byte counts. It did not rerun imports
or reread raw traces. The extracted artifact ZIP was not retained, so its provider
digest was not independently verified.

Complete query output was 6,738 and 6,827 bytes, within the unchanged 256 KiB
stdout limit. Earlier full-row exports failed that limit and retained SIGKILL /
forced-pipe-closure failures. Their prefixes remain failed evidence; inventory
was a separately requested policy, with no fallback or increased cap.

Seven of ten requested phase marks occur in each import. The missing marks are
setup instance 0 start/end and history-ready instance 1 start. Retained
`long-thread-capture.ts` bytes match snapshot before/copy/after hashes: it enters
history-ready at line 213, starts tracing in replay at line 231, then enters
streaming-follow at line 237. The three earlier marks predate collection; their
absence is not an import-loss finding.

Each nonzero stats inventory contains only two `info` / `analysis` entries:
trace-type detection and parsing time. These measure importer work. Absence of
nonzero error/data-loss stats is not proof of complete capture or category
coverage. Authority remains `nativeSupported: false`, `fps: null`,
`duration: null`, `scoring: false`.

## Next evidence needed

A separate fixed CDP JSON adapter can explicitly admit the observed `args.`
namespace, check types/presence and conflicting representations, and export
grouped state/frame-type/skipped-reason values plus relation and target-binding
coverage. It must preserve missing and ambiguous records and distinguish its
results from the official module's empty tables. A fresh native protobuf capture
is another path after preparation/accounting and maintained gates pass. Either
path still needs a defined target-associated presentation population and timing
evidence before reporting a rate.
