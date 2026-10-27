# Owned packet and state diagnostic

This local analyzer processes a complete persisted Perfetto protobuf trace using
the private `private-owned-whole-ordered-paint-r-v12` policy. It preserves packet
order, sequence resets, defaults, interned definitions and source locations. Its
paint records are diagnostic observations; they do not count presented frames.
FPS, rate, latency and duration remain `null`.

Build the analyzer before running the tool:

```sh
npm run build --workspace=@chat-ui-bench/analyzer
node --test tools/owned-paint-v12/run.node.mjs
```

Pass one canonical, compact JSON request on stdin. Use the following key order
and omit leading or trailing whitespace:

```json
{"policy":"private-owned-whole-ordered-paint-r-v12","trace":{"path":"/absolute/local/trace.pftrace","bytes":123,"sha256":"<64 lowercase hex characters>"},"compatibility":{"path":"/absolute/local/compatibility.json","bytes":456,"sha256":"<64 lowercase hex characters>"},"output":"/absolute/local/new-result.json"}
```

```sh
node tools/owned-paint-v12/run.mjs < /absolute/local/request.json
```

The compatibility record identifies the reviewed source, compiled files, build
inputs, imports and physical Node runtime. Its runtime member describes one
host. A different host needs a reviewed matching runtime record. Source or
compiled-file changes require a new reviewed compatibility record; recomputing
hashes alone does not establish that a change is correct.

The runner verifies source and runtime files before and after its single worker,
checks original process and stream closure, and writes an exclusive local result
with verified readback. An existing output path is refused. A sealed local result
may contain a semantic refusal: inspect the reader and study statuses separately
from file custody. Late custody, process or publication failure withdraws the
reader and bundle from the returned envelope.

Keep captured traces, diagnostic bundles and input-derived results local. Keep
stock, modified-input, modified-layout and authored DOM runs in separate cohorts.
A complete diagnostic does not establish capture authenticity, clock alignment,
target identity or a complete presentation population.
