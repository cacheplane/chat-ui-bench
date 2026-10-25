# Fresh stock Threadplane 0.3.3 native verification

## Disposition and provenance

Fresh preparation and native acquisition completed normally from merged main `b69dadc4e3bd12eeb8f15db26343363ce58e52a2` after all seven PR and postmerge main checks passed. This is one headless `history100-up` native protobuf diagnostic. Keep it separate from the collector/analyzer 2.1 browser cohort, including its 10,000-message measurements, and from every older stock/modified/native cohort.

**FPS and duration remain unavailable.** Native support, evaluation, scoring and ranking remain false. Capture and decoder verification establish useful evidence without admitting a frame population or normalized clock.

The [published evidence prerelease](https://github.com/cacheplane/chat-ui-bench/releases/tag/stock033-native-v2-verification-20261025-a) retains generated inputs, exact prepared source archive, original acquisition/preparation logs, independent audits, raw protobuf and both pinned imports. ZIP: **1,995,699 bytes**, SHA256 `946e26c65ee886358a9f99ba6664c711f417e1bc48a9cfed57261c8022fd7584`, 338 members / 8,908,679 uncompressed bytes. Every ZIP CRC and all 336 manifest-listed member hashes were verified, followed by an independent download with matching length and SHA256. Original absolute file identities remain historical evidence; the ZIP is not a portable authenticated preparation handoff.

## Preparation and original closure

The maintained generator and original preparation owner joined 285 unique files across 348 memberships in eight exact named roles, with 63 overlaps and 133 fixture inputs. These are observed counts, never cardinality acceptance rules. Five used Threadplane package metadata records and lock entries all identify 0.3.3. Stock builds and packages were unmodified.

The original preparation request was 824 bytes against 1 KiB; coupled child response 4,084 bytes against 8 KiB; child accounting 400 bytes against 512. Final accounting reported 81,656 operations, 1,398,467,892 read bytes and 1,406,974,985 hashed bytes. The five-file toolchain set was 336,488,895 bytes; four verification passes account for 1,345,955,580 platform read bytes. Those totals describe preparation I/O, not V8 memory or rendering work. All existing preparation caps passed.

The collecting owner observed original preparation session 6743 and acquisition session 78901 complete with exit zero. Retained child/worker/browser records show normal zero exits, original pipe EOF and close, no pending preparation operations, absent worker/browser groups and stable source bookends. Independent audits verified artifact/hash/nonce/source joins; they did not independently observe the historical process sessions. Persisted terminal receipts correctly snapshot their own writes as pending; original successful returns report fulfillment after completion.

## Whole-file decoder findings

Raw protobuf: **208,730 bytes**, SHA256 `a7b8dd7230bd33a6c0e78c497c506fd9e58bf20f0c457eb90cc5e9d0264de4d8`. Strict V6 and V7 readers independently verified physical EOF, original file closure, identity and whole-file hash. Both processed all 4,396 packets, including 4,285 TrackEvents, and recovered exactly two literal event-name phase marks. Their packet/transition manifests agree with the genuine worker's V6 phase result.

Sequence-start accounting is `raw:1, explained:1, unexplained:0, contradictions:0`. The raw loss signal remains disclosed. The explicit first-packet initialization explanation does not forgive a later loss or contradiction. There are 13 resets. V7 retained 98 complete supported observations: 15 clock snapshots and 83 descriptors. An independent raw walk verified all 98 observation-body hashes and both mark-body hashes.

Both marks identify clock 3 and default track UUID `3190708990060870962`. Descriptor and imported thread context join the marks to renderer PID 13804 / main TID 1423320. Their timestamps remain raw-unqualified. Stable CDP target/frame/loader bookends and this renderer correspondence do not establish a complete native target lifetime or frame/surface ownership chain.

## Pinned Perfetto 58.2 results

Official processor `v58.2-add693d8b`, full source `add693d8b338ba9599dbcbc3e300b1ab8c000897`, executable SHA256 `d29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa`. Separate maintained inventory and full imports both completed with normal original version/query process and stream closure. Full output was 139,504 bytes, below the unchanged 256 KiB stdout cap. Audits verified tool/SQL/stream hashes and all ten inventory / thirteen full CSV tables.

| Whole imported trace inventory | Count |
| --- | ---: |
| Graphics.Pipeline slices | 145 |
| PipelineReporter slices | 5 |
| BeginFrame slices | 20 |
| DrawFrame slices | 4 |
| Display::DrawAndSwap slices | 4 |
| FramePresented slices | 0 |
| Normalized surface steps | 124 |
| Normalized display steps | 21 |
| Surface-to-first-display mappings | 5 |

Native unprefixed argument keys bind to the official graphics module. The earlier CDP JSON import's prefixed-key compatibility gap is a separate cohort finding. These counts span the imported file and are not a phase-filtered presented-frame population.

Surface steps cover 20 distinct IDs; display steps cover four. Five mapping rows include one aggregated surface absent from the surface-step rows. Sixteen surface-step IDs lack a first-display mapping, and all sixteen have did-not-produce steps. Raw skip-reason counts are 14 waiting on main and two no damage. **Sixteen unmatched surfaces are not sixteen dropped frames.** Reporter states are four `STATE_NO_UPDATE_DESIRED` and one `STATE_PRESENTED_ALL`; some reporter work begins before the phase. The last display lacks exported terminal swap steps. Neither missing steps nor zero FramePresented slices establish a terminal or physical presentation outcome.

## Schema gap and remaining work

Both imports retain `unknown_extension_fields=1` at error/trace severity and `clock_sync_cache_miss=49` at info/analysis severity. Import success does not erase them. A separate pinned-schema walk of the retained file found one descriptor-missing occurrence: packet 2615, `TrackEvent.scroll_jank_v4`, nested field 15, raw varint 1, absolute bytes `[100300,100302)`. The [exact captured Chromium revision](https://chromium.googlesource.com/chromium/src/+/f842f52ef39fd97b449eb27cff414bf05a98ddce/base/tracing/protos/chrome_track_event.proto#1203) defines this as `vsync_interval_type=CURRENT_OS_PROVIDED`; the [pinned Perfetto schema](https://github.com/google/perfetto/blob/add693d8b338ba9599dbcbc3e300b1ab8c000897/protos/third_party/chromium/chrome_track_event.proto#L914) lacks it. This source correspondence is under the existing vendor-build assumption. The production importer was not instrumented to identify that packet; the unique offline finding is consistent with its aggregate counter.

The informational clock-cache counter is not a count of failed conversions. Clock admission still requires an explicit rule for machine/sequence domains, units, incrementality, resets and phase/event alignment. Target admission needs a lifetime-scoped target/frame/loader → trace process → layer-tree/frame-sink → surface/display chain. A population policy must then define presentation terminals, membership, deduplication, boundary censoring and completeness. A tool schema update alone admits none of these.

Official Perfetto 59.1 source supports the field. Its convenience launcher still embeds 58.2; a separate official binary qualification must use the exact upstream artifact and record its actual version/hash. The current 58.2 results remain immutable.

The [separate schema investigation archive](https://github.com/cacheplane/chat-ui-bench/releases/download/stock033-native-v2-verification-20261025-a/chat-ui-bench-stock033-native-v2-schema-gap-20261025-a.zip) retains the raw-field finding, exact source-schema hashes/URLs, version comparison and official distribution headers. It is 12,886 bytes, SHA256 `8e9fab731ef288ae2d35e3c41cf9586e92d8089d50b1e56217dc155909789035`; an independent release download matched both. This later investigation contains no additional capture or performance measurement.
