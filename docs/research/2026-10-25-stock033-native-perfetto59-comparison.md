# Same native input: official Perfetto 59.1 comparison

## Scope and verified tool execution

This is later offline analysis of the stock Threadplane 0.3.3 `history100-up` native protobuf captured from source `b69dadc4e3bd12eeb8f15db26343363ce58e52a2`. The new importer source is reviewed PR147 candidate `19af098698c31ad69097185f81fbd4cc2e15bb84`. There was no new capture or preparation. Preserve the [original 58.2 findings](2026-10-25-stock033-native-v2-verification.md) and their immutable evidence separately.

Input remains **208,730 bytes**, SHA256 `a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8`. Official tool: `Perfetto v59.1-1e9c61e98`, full source `1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d`, RPC14. Mac executable SHA256 `8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4`; Linux `2434129a3af4dc9e2034a476f7b76447b490975213e301769310d3bd0d5d6458`. Exact official object lengths, generation and MD5 matched before these first-use hashes were recorded. This retains the publisher/vendor-build assumption; computed hashes are not independent publisher attestations.

All three real Mac semantic smoke imports passed. [Actual Linux CI40230295671](https://github.com/cacheplane/chat-ui-bench/actions/runs/40230295671) also passed all three imports with the unchanged authored 153-byte clock and 308-byte graphics fixtures. Downloaded CI manifests identify the exact official Linux pin/version, successful original version/query processes and normal EOF/close. Every retained stdout/stderr length and SHA256 was independently verified against its manifest. These are tool-compatibility checks on authored inputs, not a Linux native application measurement.

## Same-input results

Separate maintained inventory and full 59.1 imports succeeded. Independent audit verified equal input/tool identity bookends, input/tool/SQL hashes and every original process stream envelope. All ten inventory and thirteen full CSV tables were retained completely. Full stdout is 139,450 bytes and inventory stdout 6,809, within the unchanged caps. SQL, manifest schema, query policy and authority did not change.

| Nonzero-stat export | Perfetto 58.2 | Perfetto 59.1 |
| --- | ---: | --- |
| unknown_extension_fields | 1, error/trace | Row absent |
| clock_sync_cache_miss | 49, info/analysis | 49, info/analysis |
| Total nonzero-stat rows | 22 | 21 |

The query filters `value != 0`; **absence is not an explicitly exported zero**. There are no error-severity rows in the new nonzero-stats tables. The only other stat differences are importer instrumentation timings (`guess_trace_type_duration_ns`, `parse_trace_duration_ns`), which are not capture or frame durations. The ARM64 syscall warning remains recorded. The source schema difference identified in the original report is resolved by the official tool upgrade without a fork or suppressed counter.

Every non-stat inventory table value is identical. In full output, 110 raw slice rows and 475 argument rows change only importer-local `arg_set_id`; changed slice values shift by one. Internal slice/argument joins remain consistent. Removing only that column makes every other exported non-stat row exactly equal, including slice IDs, timestamps, durations, process/thread context, argument keys/types/values, surface/display rows and mapping IDs. The precise allocation cause was not instrumented. Do not treat these opaque IDs as stable identifiers across tool versions.

Graphics inventories remain 145 Graphics.Pipeline, five PipelineReporter, twenty BeginFrame, four DrawFrame, four Display::DrawAndSwap and zero FramePresented slices; 124 surface steps, 21 display steps and five first-display mappings. Reporter states remain four `STATE_NO_UPDATE_DESIRED` and one `STATE_PRESENTED_ALL`. These span the imported file and do not define a scored phase or presented-frame population. The prior unmatched-surface and boundary limitations remain.

## Retained target evidence and next qualification

A separate whole-TrackEvent pinned-schema investigation found explicit joins already present in the retained artifact:

- Both mark packets801/1429 carry `data.navigationId` matching the owned CDP loader.
- `TracingStartedInBrowser` packet4151 explicitly pairs the owned frame/URL with OS renderer PID13804. Wire packet order is not timestamp order; this is not automatically a post-phase lifetime observation.
- Ten `SetLayerTreeId` packets pair the exact frame with layer-tree host2.
- Three reporter surface IDs join Graphics.Pipeline events carrying frame-sink `(4,10)`. Two matches are did-not-produce events; one is receive-compositor-frame work. This does not admit all twenty surface IDs.

The [exact captured Chromium frame/loader identifier source](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/inspector/identifiers_factory.cc#84), [browser frame metadata emitter](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/content/browser/devtools/protocol/tracing_handler.cc#212), and [SetLayerTreeId emitter](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/third_party/blink/renderer/core/inspector/inspector_trace_events.cc#1608) support those field meanings under the existing vendor-build correspondence assumption. Raw packet/body anchors and source hashes are retained in the separate investigation.

The earlier gap inventory understated these positive associations. The required qualification rule is still missing: machine/process generation, clocks, interval/category/subscriber coverage, conflicting or reused identities and layer/sink lifetime must be handled explicitly. Matching bookends or same-PID observations cannot substitute for those rules. Build a bounded retained-evidence ownership diagnostic before requesting a new capture for information that is already present.

**FPS and duration remain unavailable.** Native support, evaluation, scoring and ranking remain false. Resolving the tool schema mismatch and finding positive joins do not qualify clocks, continuous/exclusive target lifetime, population, terminal outcomes or physical presentation.

## Reproducibility

The [separate comparison and target-inventory archive](https://github.com/cacheplane/chat-ui-bench/releases/download/stock033-native-v2-verification-20261025-a/chat-ui-bench-stock033-native-perfetto59-target-inventory-20261025-a.zip) retains both original 59.1 imports/configs, the independent comparison audit, official tool metadata, actual Linux authored-smoke evidence and separately labeled exploratory target inventories/source references. It is **201,510 bytes**, SHA256 `a88e755e24d25b2d49a9afbdc5ee3e62750f333e21a62c1c09ae40e3c3595eae`, 57 members / 2,321,334 uncompressed bytes. All CRCs and manifest-listed hashes were checked; an independent release download matched size/hash. No new raw trace or tool binary is included. The original capture remains in the primary archive.
