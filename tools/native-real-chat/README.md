# Real chat native capture

This is a source-reviewed diagnostic path under development. Source controls do
not launch a browser. An actual acquisition requires a separately reviewed,
single-use outer release and closed input records.

The fixture entry invokes `@copilotkit/aimock/agui` through the repository's
canonical history-restore compiler. Its 100-message snapshot is projected
losslessly to Threadplane's history API. Canonical source/events/history digests
remain distinct from the SHA-256 of the serialized projected history file.

## Source controls

Build the contract, producer, analyzer, and runner workspaces, in that order.
Then run:

```sh
node --test tools/native-real-chat/*.node.mjs
```

Controls use authored sessions, trace packets, processes, streams, and protocol
responses. They test the genuine existing capture owner's original finish
promise and cached inspector without collecting a browser trace.

## Owned preparation and acquisition

`prepareActual` executes the fixed fixture entry in a separate preparation
process. Its caller supplies the exact closed source roster, successful build
reference, compiler-input roster, platform identities, and fresh output paths.
Preparation copies and verifies the inputs and returns `{template, reference}`.
The outer owner must retain that original return, actual process exit, and pipe
EOF before starting the lean worker. A parsed template or a freshly calculated
hash cannot authenticate that preparation origin. These are trusted source-owned
capabilities, not an API for authenticating arbitrary caller DTOs.

The outer owner supplies its retained reference through the explicit reference
file when invoking `run.mjs --prepared <directory> --reference <reference-file>`.
The command requires its separate one-use release environment. No import starts
preparation or browser acquisition. The reference file is bounded to 4 KiB and
contains the fixed `source-owned-preparation-reference-v1` policy plus original
created-file facts for the template and manifest. Each fact contains byte length,
SHA-256, and descriptor identity. The eventual outer record must join this
reference to the actual preparation; the reference is not a signature.

The parent authenticates the template, manifest, original/copied source files,
generated history and bundle, and pinned platform files. It creates the request
exclusively and passes its original created-file reference privately to the
worker. The worker checks that reference before parsing the request, then checks
the history's created identity and projected-file hash before use.

The worker serves only the twelve authenticated emitted assets. One explicit
empty favicon 404 is allowed. It awaits the original `loadHistory` call, reads
the actual transcript envelope, and checks exact message content. A native wheel
request, its observed trusted negative wheel event, and measured negative scroll
movement are separate requirements. Two RAF callbacks provide sequencing only.

The existing owner starts collection; explicit start/end marks bracket the
gesture. Its same original finish promise performs final queries, detach, and
the original runner close/wait. That wait requires original process/pipe closure
and browser-group absence. Application buffers and history become unreachable
before the cached private inspector runs. The parent additionally verifies both
original groups are absent after the worker exits.

## Bounds and authority

The new application archive has a proposed fixed 1,024-file/16-MiB ceiling and an
exact literal member list. Its platform table has at most 1,024 named references
and 512 MiB of aggregate referenced content; these are pinned trusted platform
operations, not copied binary payload or a VM CPU theorem. Existing comparison
and synthetic custody archive limits remain unchanged. Browser physical output
has two 256-KiB pipe roles and one 64-KiB metadata role. Pipe custody means original
ordered writes, byte counts, fsync/close, and observed EOF; it is not a raw-content
hash or uninterrupted inode-identity claim.

The Runtime budget includes every Runtime method: at most 75 function calls,
one promise wait, three object releases, and one enable. Source response caps
apply after trusted platform decoding. Navigation generations distinguish stale
initial contexts from the selected current default context. Context observation
continues until original owner-safe detach invocation; this does not establish
a complete browser target lifetime.

Capture has an original 17-second deadline. Successful cleanup and finalization
must complete by the anchored 19-second boundary. A timed-out wait never settles
its original operation. Cleanup still dispatches owned closes; pending or late
originals cannot produce success. A persisted outer receipt records its own
terminal write as pending; the outer process's actual return/exit/EOF must join
that final write.

Pinned Node, compiler, SDK, filesystem, hash, and decoder internals are explicit
platform trust. Source work, cells, and character reservations are logical
source-owned accounting, not V8 allocation, RSS, native instructions, or a total
page-application CPU bound. Final resource acceptance and actual acquisition
remain separate gates. Results remain unscored: clock and frame population are
not admitted, native support is false, and FPS is null.

The private worker reports one bounded58-byte failure line with two-digit `observedAt` and `cleanupAt` stages. These are the last instrumented forward operation and cleanup failure, not authenticated causes or completions. Cleanup never replaces the forward location;00 means no cleanup failure was observed. Original import/entry parsing or successful-result serialization failures outside the existing rejection arm are not covered. Codes01–15 cover worker admission/setup,20–25 navigation/bootstrap/owner setup,30–46 capture operations, and90–93 cleanup failure observations. Positive output, original promises and errors, all deadlines/caps, and unscored authority are unchanged. Historical generic failures and display-link warnings do not identify a stage or establish cause.
