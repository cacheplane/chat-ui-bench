# Chrome 156 CPU-profile V2 data contract

`tools/competitor-comparison/aimock-cpu-profile-v2.mjs` exports the pure function `analyzeChrome156CpuProfileV2(profileJson, bindingJson)` and frozen `CPU_PROFILE_V2_LIMITS`. It returns sampled-node counts and bounded diagnostic hashes. It does not acquire a profile, admit a benchmark case, or establish runtime identity.

Both inputs are primitive, compact canonical JSON strings: each must equal `JSON.stringify(JSON.parse(input))`. Inputs are rejected rather than normalized. Duplicate keys, alternate encodings and object coercion hooks cannot silently change their meaning. `profileJson` is the exact `JSON.stringify(reply.profile)` form from `Profiler.stop`; a future capture driver must retain and hash that original string.

The binding has exactly these fields:

```json
{"schema":"chrome156-cpu-source-context-v2","browserVersion":"156.0.8078.4","chromiumRevision":"f842f52ef39fd97b449eb27cff414bf05a98ddce","origin":"https://bench.test","assetHashes":{"assets/main.js":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}
```

Unknown versions or revisions refuse validation. This tuple is a data constraint, not proof: a caller can author JSON. A separately reviewed acquisition driver must bind actual owned browser/version/target facts, physical executable and source bytes, production assets, raw profile hash, original operations, deadlines and cleanup. That driver must also join the returned data to its actual capture receipt; the pure helper has no authority override or lifecycle ports.

## Why signed deltas have a separate version

[Chromium's pinned DEPS](https://github.com/chromium/chromium/blob/f842f52ef39fd97b449eb27cff414bf05a98ddce/DEPS) selects V8 `b976f35da8356fcf4e5e176d1d810ba6a6f05718` and DevTools `2d671c506c4e5f8958b027e26047deb0acfbd7f9`. The [pinned V8 serializer](https://github.com/v8/v8/blob/b976f35da8356fcf4e5e176d1d810ba6a6f05718/src/inspector/v8-profiler-agent-impl.cc#L94-L114) writes aligned sample IDs and adjacent timestamp differences, anchored to profile start. The [pinned DevTools model](https://github.com/ChromeDevTools/devtools-frontend/blob/2d671c506c4e5f8958b027e26047deb0acfbd7f9/front_end/models/cpu_profile/CPUProfileDataModel.ts#L240-L261) orders paired reconstructed timestamps and IDs.

V2 accepts only signed-int32 deltas whose exact cumulative timestamps remain inside the **original** safe-integer start/end window. It never copies DevTools' native-node remapping, program substitution, endpoint normalization or duration estimates. This implementation evidence does not explain why a particular sampler produced a backstep or attest the binary's build provenance. V1 and all existing failed or incomplete V1 results remain unchanged. There is no automatic fallback, migration or retrospective qualification.

## Checks and conservation

The original node tree must be single-rooted, connected, acyclic and free of duplicate IDs, edges and parents. Unknown profile/node/frame/tick fields refuse validation. Optional pinned node fields are `children`, `hitCount`, `positionTicks` and `deoptReason`. Coordinates are safe integers at least −1; position-tick lines are positive integers and tick counts are nonnegative integers.

Every sample must name an original node. For each original index, V2 reconstructs `startTime + prefixSum(timeDeltas)` and checks every prefix, even when later deltas would return it inside the window. It derives a permutation ordered by `(timestamp, originalIndex)`, preserving equal-time ties, repeated sample IDs and every signed delta/ID/index pair. It never mutates or sorts the original arrays, filters records, clamps values, repairs missing samples, shifts endpoints or invents a final sample.

Per-node self counts are counted once per original sample. Inclusive counts use an iterative reverse tree traversal, avoiding per-sample ancestor walks and recursion. Top self rows order by self count descending, inclusive count descending, node ID ascending; top inclusive rows reverse the two count priorities. At most eight of each are returned.

The result has schema `chrome156-sampled-stacks-v2` and status `validated-data-only`. Its conservation hashes use these UTF-8 encodings:

- Original and ordered pairs: newline-terminated compact JSON arrays `[originalIndex,nodeID,signedDelta,timestamp]`, in original or derived order respectively.
- Permutation: newline-terminated base-10 original indexes in derived order.
- Frequencies: newline-terminated compact JSON `[nodeID,count]` rows for sampled IDs, sorted by numeric node ID.
- Graph: compact JSON for the complete original node array. Source rows: newline-terminated JSON `[nodeID,parentID,callFrame,assetPath,assetSHA256]` in original node order. Source map: newline-terminated JSON `[path,SHA256]` rows in lexical path order.

Full pair/permutation ledgers are not returned. Display text is bounded and retains the complete canonical JSON-string hash/byte count and a truncation flag. Nonempty script URLs must be exact canonical same-origin asset URLs with pinned hashes. Encoded paths, dot segments, backslashes, prototype-like map keys, query/hash suffixes, external/injected scripts and aliases refuse validation. Internal lookups use `Map`; no inherited property grants a binding. Empty-URL nodes remain explicitly unattributed, including root/program/idle/garbage-collector categories.

## Fixed resource bounds and limits of interpretation

| Bound | Limit |
|---|---:|
| Profile UTF-8 bytes | 2 MiB |
| Binding UTF-8 bytes | 64 KiB |
| Original nodes | 100,000 |
| Original samples | 200,000 |
| Original profile window | 240,000,000 µs |
| Total optional position-tick records | 200,000 |
| Result UTF-8 bytes | 32 KiB |

There are no caller policy overrides. All bounds apply together: a fully shaped 100,000-node tree cannot fit the 2 MiB raw limit. Node and tick counts are additional defensive limits, not promises that every count-limit shape is jointly admissible. The 240-second data window does not extend any acquisition or native deadline. Input profiles are already received before this analyzer runs; its byte limit is not a transport-memory guarantee.

Raw window/delta facts and sample counts are not CPU time, utilization, sample-weighted durations or FPS. Optimized frames can be absent or merged; counts include whatever workload and instrumentation the acquisition window contained. Output always keeps `performance:false`, `scoringEligibility:false`, `FPS:null` and `cpuTime:null`. Qualified future stacks may inform hypotheses; native outcome measurements and runtime capture qualification remain separate work.

Run the synthetic controls with Node 24:

```sh
node --test tools/competitor-comparison/aimock-cpu-profile-v2.node.mjs
```
