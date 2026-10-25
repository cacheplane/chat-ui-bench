# Pinned Perfetto import diagnostic

Optional Node 24, built-in-only diagnostic. Importing `run.mjs` has no execution or
filesystem side effects. This does not capture a browser, calculate a frame rate,
qualify native traces, or change the manual V6/V7 analyzers. Every result has
`diagnosticOnly: true`, `nativeSupported: false`, `fps: null`, `duration: null`, and
`scoring: false`. A successful import is not performance or completeness evidence.

Run explicitly with a fresh absolute output directory:

```sh
node tools/perfetto-import/run.mjs --config /absolute/config.json
node --test tools/perfetto-import/run.node.mjs
```

Configuration shape (replace all paths and trace facts with your own retained inputs):

```json
{
  "trace": { "path": "/absolute/authored.pftrace", "bytes": 153, "sha256": "<64 lowercase hex characters>" },
  "processor": { "path": "/absolute/trace_processor_shell", "sha256": "d29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa" },
  "phases": ["authored-start", "authored-end"],
  "out": "/absolute/fresh-diagnostic-directory"
}
```

There is no default processor, executable discovery, download, shell, inherited
environment, or caller SQL. The production library `runDiagnostic(config)` and CLI
enforce the runtime platform pin as well as the exact version and RPC API 14.
Unsupported platforms fail closed. Only these official v58.2 assets are pinned:

| Platform | Official release archive | Archive SHA256 | Executable SHA256 |
| --- | --- | --- | --- |
| darwin-arm64 | [mac-arm64.zip](https://github.com/google/perfetto/releases/download/v58.2/mac-arm64.zip) | `9dbd484a32c9833c95cf58ca5ef86d2c9ad4767149054ad4eaa52bdf027d1507` | `d29864d1ba3b36855527bb1b0ca3aa7f703cdce338b9680bb922c5c151b358fa` |
| linux-x64 | [linux-amd64.zip](https://github.com/google/perfetto/releases/download/v58.2/linux-amd64.zip) | `32c739f71b2d39721afd294c0b038f2499a44a71b5b6bcdd85b83faca0b240b9` | `58042408e6cc861fb1a731c26bb082dc222285561eaa4e12a48a8b2b90dca7b9` |

Version is `Perfetto v58.2-add693d8b`, full commit
`add693d8b338ba9599dbcbc3e300b1ab8c000897`. Archive/member checksums were
independently checked against the official release during development. Mac ARM64
was smoke-tested with an authored 153-byte clock fixture; Linux was not executed
on macOS. The runner verifies the executable bytes, not an archive at runtime.

`runAuthoredFixtureDiagnostic(config)` is an explicit low-level test entrypoint
for locally authored executable fixtures. It checks the caller's executable hash
and version text but does not enforce official platform identity. Its reports
always say `authoredFixture: true`, `officialProcessor: false`. The production CLI
never uses this entrypoint. Authored fixture results cannot attest official tools.

Inputs must be one-link regular files opened with nofollow, with trace <=32 MiB
and processor <=64 MiB. Bounded reads hash original handles, checking descriptor
and path identities before/after reading and after analysis. This assumes a trusted
local filesystem and trusted native process execution. Bookends do not prove an
absence of transient changes or provide a sandbox or general CPU/resource proof.

Version and query each have a maximum 60-second deadline anchored at process
creation, <=256 KiB stdout and <=64 KiB stderr. A library-only `deadlineMs` can
lower that deadline (never raise it). Overflow, timeout, spawn/stream errors, and
nonzero original exit fail closed. The runner kills only its still-owned live
child and awaits the original close plus pipe closure. It retains bounded original
bytes with byte counts and SHA256, original code/signal, and the first process
failure reason. Failure cleanup also destroys still-open owned pipes, including
pipes held by descendants after the original child exits. Stream records retain
EOF, close, error and forced-destroy flags. Success requires normal EOF and close
on both streams, original exit zero and no process or stream error. No replacement
wait process is treated as success.

The output directory must not exist. Files use exclusive creation. The output
contains exact executed SQL/hash, version/query stdout and stderr, and a manifest
with expected inputs, observed file identities/hashes, process arguments and
failure reasons. Input/process failures retain a failure manifest; an output
write/close failure rejects the operation and cannot guarantee a persisted
manifest on a broken filesystem. Never interpret a partial output as success.

Fixed SQL includes `chrome.graphics_pipeline`, literal phase slice/track rows,
all nonzero stats with severity/source, trace bounds, and counts for six fixed
event names. Phase names are distinct UTF-8 strings <=256 bytes, 2..16 names;
control characters are refused and single quotes are doubled. Empty marker/frame
results are retained rather than labeled qualified. Informational import timing
stats are not native performance metrics. Later qualification must independently
establish clock/source/target ownership, completeness and frame population before
any specifically named presentation-rate calculation.

## Maintained authored smoke and CI

```sh
node tools/perfetto-import/smoke.mjs --processor /absolute/trace_processor_shell --out /absolute/fresh-smoke-output
```

The import-inert smoke module authors the fixed 153-byte clock trace, verifies its
SHA256, runs the production pinned diagnostic, requires original process success
and normal EOF/close, and checks CSV markers at 1,001,000 and 1,021,000 ns, bounds,
and zero `Graphics.Pipeline` events. Its synthetic fixture has no native authority.
The smoke output includes the authored fixture, diagnostic artifacts and a small
`smoke.json` result. It never downloads a processor.

The standalone `perfetto-import.yml` workflow uses Ubuntu 24.04 and Node 24.20.0,
without npm installation. It explicitly downloads the fixed Linux release ZIP
with a 15 MB/60-second transfer cap, checks the archive and selected executable
hashes, and runs the authored tests and smoke. Only small authored evidence and
test logs are uploaded for 14 days; the ZIP and executable are excluded. Linux
execution is to be verified by that workflow; local macOS verification does not
establish Linux compatibility.
