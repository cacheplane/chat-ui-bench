# Official Perfetto 59.1 fixed-pin qualification

## Decision and scope

Qualify the official 59.1 prebuilt, then upgrade the maintained import diagnostic's two fixed platform pins and exact version admission. This is a reviewed tool upgrade using the same retained stock Threadplane 0.3.3 native artifact. Keep the published `b69dadc4e3bd12eeb8f15db26343363ce58e52a2` / Perfetto 58.2 evidence immutable and reproducible from that source pin and its retained official processor. Do not add profiles, a version selector, automatic downloads, fallback, custom SQL, a fork, or a new capture.

The exact official source tag is `v59.1`, commit `1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d`. Its Chromium schema includes `scroll_jank_v4` field 15, `vsync_interval_type`, value 1 `CURRENT_OS_PROVIDED`, matching the exact captured Chromium revision's definition. Source support motivates binary qualification; it does not establish its result. The tagged convenience launcher still fetches 58.2. Use the direct official GCS distribution documented by that commit's `tools/release/roll-prebuilts`, line 138.

## Binary admission and provenance

| Platform | Official object | Exact bytes | Observed GCS generation | HEAD MD5 (base64) |
| --- | --- | ---: | --- | --- |
| darwin-arm64 | `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/v59.1/mac-arm64/trace_processor_shell` | 14376168 | `1792781823182096` | `L4hRxW4rySPu7bbJat813Q==` |
| linux-x64 | `https://commondatastorage.googleapis.com/perfetto-luci-artifacts/v59.1/linux-amd64/trace_processor_shell` | 15885448 | `1792780866926111` | `ESZSklEk/Lt1Ry5jTiNHpg==` |

These are raw executable objects, not ZIP archives. At design review, 59.1 SHA256/version observations were still pending. The recorded qualification below supplies them. Before authoring pins, retain official response metadata, download each object into isolated fresh storage with its exact byte ceiling and a 60-second transfer deadline, verify exact length, generation and MD5 against the retained HEAD metadata, and compute SHA256. Fail on mismatch; investigate changed metadata rather than silently refreshing expected facts. Record the original Mac `--version` process output, exit and normal stdout/stderr EOF/close before installing or running imports. Record and require the actual exact version/source commit/RPC output; do not invent the expected string from a tag. Linux can be hashed on Darwin but must execute and pass exact-version and semantic fixture checks in Linux CI.

A locally computed first-use SHA256 pins observed bytes; it is not independent publisher attestation or proof that a binary was built from the named source. Retain the official distribution and existing publisher/vendor-build assumptions explicitly.

## Minimal repository change

- `tools/perfetto-import/run.mjs`: replace only `EXPECTED_VERSION` and the two `PROCESSOR_PINS` values with qualified observations. Keep fail-closed unsupported-platform admission and import inertness.
- `tools/perfetto-import/run.node.mjs`: update authored version fixtures and add behavioral rejection of old official pins and the complete old version before query launch. Verify new pin/version literals against external download observations and actual official semantic smoke, without tests that only duplicate constants.
- `tools/perfetto-import/smoke.mjs`: preserve existing 153-byte clock and 308-byte graphics fixture bytes/hashes and semantic assertions; update version-specific commentary only where needed. Any observed semantic difference requires source investigation and review, not weakened expectations.
- `.github/workflows/perfetto-import.yml`: replace Linux ZIP download/unzip/archive checks with the one raw official object, exact length `15885448`, exact maximum transfer bytes `15885448`, and observed executable SHA256 before chmod/execution. This explicit format-specific adjustment replaces the old 15000000-byte compressed ZIP cap; it is not an unbounded cap increase. Preserve HTTPS, transfer deadline, pinned actions/runtime, authored tests/smoke, small evidence-only uploads and 14-day retention.
- `tools/perfetto-import/README.md`: document the new distribution/version/hash provenance, local Mac versus CI Linux execution evidence, trust limits, and the old source/evidence reproduction path.

Do not change `diagnostic.sql`, `inventory.sql`, capture, manual V6/V7 analyzers, policy selection, or manifest shapes. Schema `1` and query policy `inventory-v1` remain valid because their shapes and SQL are unchanged. Source revision, expected/observed tool version, executable SHA256 and SQL hashes distinguish lineage. Never combine old and new outputs under one lineage.

## Preserved invariants

Processor input remains <=64 MiB; trace <=32 MiB; each process <=60 seconds; stdout <=256 KiB; stderr <=64 KiB. Original process exit/EOF/close, failure cleanup, identity bookends, one-link/nofollow inputs, exclusive fresh outputs, complete rather than prefix exports and full/inventory separation all remain unchanged. Tests must retain these controls and prove old version rejection independently of hash rejection through the authored-only entrypoint. Production never admits authored fixture identity.

Every result remains diagnostic-only with `nativeSupported: false`, `fps: null`, `duration: null`, `scoring: false`. The update cannot qualify clock admission, target lifetime, target→process→layer/frame-sink→surface/display binding, completeness, or presentation population.

## Same-input comparison and acceptance

After source review and authored verification (including green Linux CI as appropriate), run the maintained full and inventory entrypoints with the qualified Mac pin against the retained native protobuf: 208730 bytes, SHA256 `a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8`. Use its original literal phase names and fresh separately labeled 59.1 output directories. Keep the original captured checkout and old outputs untouched. No new native acquisition or preparation is needed.

Audit original process completion and every output/input/SQL hash; inspect all thirteen full and ten inventory tables, bounds, phase ownership, all nonzero stats, module inventories, raw context and argument schemas. Report the actual `unknown_extension_fields` observation (including absent versus zero under nonzero-only SQL), never infer it solely from source support. Explain any differences against 58.2 using pinned upstream source. Revisit the disclosed clock, target, layer/surface, population and completeness gaps; unchanged absence remains a gap. Preserve separation from older native cohorts and the collector/analyzer 2.1 browser cohort.

Acceptance requires qualified binary provenance, red-first fixed-admission controls, all existing authored controls and semantic smoke passing on Mac and Linux, unchanged SQL/shapes/resource limits, independent review, and honest separate same-input findings. Any failure blocks upgrade completion; it does not trigger fallback or relaxed tests. PR/merge follows green required checks under the user's existing authorization.

## Recorded initial qualification

Official objects were downloaded into isolated temporary storage with their exact transfer ceilings. Response generations, exact lengths and MD5 matched the table. Computed first-use SHA256 values:

- Mac arm64: `8488edbefadfc4be152cda1d42d9bfcede8b47638295eb85eb3bad8cd148fdf4`.
- Linux amd64: `2434129a3af4dc9e2034a476f7b76447b490975213e301769310d3bd0d5d6458`.

The original Mac version probe exited zero with empty stderr and exact stdout `Perfetto v59.1-1e9c61e98 (1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d)` followed by `Trace Processor RPC API version: 14`. This establishes the admission literals; the maintained bounded semantic smoke still must verify actual version/query process envelopes and fixture behavior. Linux has only download/hash evidence until its CI execution passes. These observations retain the stated publisher/vendor-build assumption.
