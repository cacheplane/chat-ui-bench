# Inspect retained scroll-cause diagnostic evidence offline

This optional inspector checks selected byte and data joins in already retained
v3 diagnostic archives. It never captures a run, downloads evidence, starts a
browser, extracts a ZIP or executes archived code. It uses Python 3.12 or newer
and only its standard library on POSIX with `O_NOFOLLOW` and `O_NONBLOCK` input
operations; unsupported platforms refuse without a weaker fallback. npm is only
a convenience wrapper, and installed JavaScript dependencies are unnecessary.

```sh
python3 -I -S -B tools/inspect-scroll-cause.py --zip /evidence/v3/original.zip --parameters /evidence/v3/parameters.json
npm run bench:inspect:scroll-cause -- --zip /evidence/v3/original.zip --parameters /evidence/v3/parameters.json
npm run test:scroll-cause-inspector
```

The direct Python command emits one JSON report to stdout. npm adds its own
command banner; use the direct command when redirecting machine-readable JSON.
The inspector writes no files. Exit 0 means only
`selected-retained-byte-data-joins-verified`; exit 2 means refusal (including
unsupported input/platform or an output limit), and exit 1 means an internal
error. Refusals expose finite reason codes, not arbitrary input or exception
messages. CLI usage errors use argparse's ordinary usage output and exit 2.

## Historical contract and input provenance

The default and only `--contract` value is
`scroll-cause-retained-v3-c169fd35-v1`. The tool loads the contract relative to
its own file and verifies its exact SHA-256
`cc18e8e863f7c0a50bc00b0c1b339d03d542f6779fcdd8a5f6935af606033a83`.
It describes the historical producer commit
`c169fd3543b29178a237ca6c9c9c34c678c04a2c` and tree
`108aad99100a82b46e222e3d7fabb34b8c4e5987`. The consumer checkout containing
this inspector has a different HEAD. No historical source checkout or Git
command is required, and current publisher code does not redefine this contract.
A contract change requires a new reviewed ID.

Supply the original retained provider ZIP and a parameters JSON file. CLI paths
may be relative; each original receipt `path` must be absolute and point to a
single-link regular file. Symlinks, hardlinks and changed inputs refuse. Keep
original receipt bytes unchanged: hashes cover whole files before any `select`
view is taken. A selected object is a derived view, not a new authenticated
original receipt. Parameters have exactly `expected` and `originalReceipts`.
All seven references below are required. Each reference has `path`, `bytes`,
`sha256`, and optionally a bounded `select` path of object keys/array indexes.

Obtain these original provider responses and helper receipts independently from
the archive, together with the independently retained expected source/run/argv
context. The inspector joins supplied bytes; it cannot authenticate their remote
origin. Reconstructing a receipt or deriving expected argv from the payload does
not establish original provenance. If originals are unavailable, inspection must
remain unavailable; do not substitute rewritten JSON or fabricate receipts.

The complete example below describes actual historical run `39388317339`,
attempt 1, artifact `12248387700` (`copilot-scroll-cause-39388317339-1`). Its
original ZIP was 5,755,693 bytes with SHA-256
`cf4d7367bdc45a2a3a485f3a9e07606d26674297ebc8158f54a5ebd25fe2b5f6`.
The `/evidence/v3` paths are example local placements for the exact originals;
no files are bundled or fetched. Historical retention does not promise current
provider availability. Save this as `/evidence/v3/parameters.json` only if those
exact original bytes and independent context are available:

```json
{
  "expected": {
    "source": {
      "commitSha": "c169fd3543b29178a237ca6c9c9c34c678c04a2c",
      "treeSha": "108aad99100a82b46e222e3d7fabb34b8c4e5987",
      "lockSha256": "c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56"
    },
    "run": {
      "repository": "cacheplane/chat-ui-bench",
      "runId": "39388317339",
      "attempt": 1,
      "tag": "hosted-copilot-react-scroll-cause-v3"
    },
    "parentArgv": [
      "/opt/hostedtoolcache/node/24.20.0/x64/bin/node",
      "--experimental-import-meta-resolve",
      "/home/runner/work/chat-ui-bench/chat-ui-bench/tools/hosted-copilot-scroll-cause.mjs",
      "parent"
    ],
    "childArgv": [
      "/opt/hostedtoolcache/node/24.20.0/x64/bin/node",
      "--experimental-import-meta-resolve",
      "/home/runner/work/chat-ui-bench/chat-ui-bench/tools/hosted-copilot-scroll-cause.mjs",
      "child"
    ]
  },
  "originalReceipts": {
    "run": {
      "path": "/evidence/v3/run-response.json",
      "bytes": 37948,
      "sha256": "9c7dbfc31f148361d6cf8e7aba1cb837278fbcf63c9b1d8bc3b10d89ca0a0911",
      "select": [
        "workflow_runs",
        0
      ]
    },
    "artifact": {
      "path": "/evidence/v3/artifacts-response.json",
      "bytes": 775,
      "sha256": "4fe85e6fd577bd07509c0ae35f315112cb1113e3d86c8cf523757a878b8caa7e",
      "select": [
        "artifacts",
        0
      ]
    },
    "tag": {
      "path": "/evidence/v3/tag-response.json",
      "bytes": 452,
      "sha256": "4b589d85115a059867f0d2f7dc050e311c61bb08869293c030d70e5f191db816"
    },
    "dispatch": {
      "path": "/evidence/v3/dispatch-intent.json",
      "bytes": 521,
      "sha256": "73772631bf5f82e4af7446f66c5c97d71c7baf4552e30df112201f356c1bf605"
    },
    "job": {
      "path": "/evidence/v3/jobs-response.json",
      "bytes": 4204,
      "sha256": "e605a86376a8125f1d0491c577d1ca0c2699556a8dfb04d765e4fed88f09e48b",
      "select": [
        "jobs",
        0
      ]
    },
    "download": {
      "path": "/evidence/v3/download-receipt.json",
      "bytes": 601,
      "sha256": "650530bdbfb844f513fe235633831d004bd86438ef948d94b61c36b5c26a4e5b"
    },
    "downloadIntent": {
      "path": "/evidence/v3/download-intent.json",
      "bytes": 363,
      "sha256": "2d80e7efcd0025da6a7b03f2ea69e9a0307a1fea31150184d784445c4c0471a9"
    }
  }
}
```

The `/opt/hostedtoolcache` and `/home/runner/work` argv entries above are literal
historical producer data, never local executable or checkout locations to open.
Likewise a retained producer worker declaration such as
`/home/runner/work/chat-ui-bench/chat-ui-bench/apps/copilotkit/artifacts/scroll-cause/39388317339-1/worker.mjs`
is not a local alias. Do not create a fake hosted worker path or infer hosted
inode identity from local copied files. The report records whole original receipt
pins and distinguishes each derived selection.

## What a successful result establishes

Both full and command-forensics branches verify the frozen contract, supplied
receipt byte joins, whole ZIP join and bounded flat role ZIP integrity. The full
branch additionally checks selected manifest census, explicit absence witnesses,
source/run/profile/build/worker-copy joins, postcapture drain data laws, strict
command outcome relationships, persisted role references and literal coverage
equality. The forensic branch checks its separate manifest/reference joins,
command declarations and literal outcomes. Failed or timed-out original forensic
commands remain visible. A full branch requires original commands to agree on
exit 0 or 2 as required by the strict result; it does not convert a strict refusal
to success.

The JSON report has `schemaVersion: 1`,
`kind: "scroll-cause-retained-inspection"`, contract identity, selected source/run,
whole archive and member pins, literal command outcomes, `verifiedChecks`,
`producerAssertions` and `unavailable`. Its success status means only the listed
selected checks. `diagnosticArtifactAdmission` remains `"not-established"`;
`qualification`, `nativeGO`, `performance`, `scoring` and `ranking` are always
false, and `fps` is always `"unavailable"`, including refusal reports.

The inspector leaves these checks explicitly unavailable: hosted physical
identity/namespace/inode continuity; provider-origin authentication; independent
hosted provenance beyond supplied receipt/context joins; full publisher schema
and writerClosure semantics; browser/raw/client/case closure and child footer
replay; nested frontend ZIP/HTML/renderer joins; reverse transform proof and
module/component/package pins; anchor/scalar/ledger/coverage recomputation; and
native scenario admission. Producer identity, runtime/compiler metadata and
closure declarations beyond the selected checks remain assertions. Opaque
payload retention and byte equality do not prove those semantics.

This is separate from the older
[hosted failure inspector](hosted-failure-inspection.md) and its protocol. It
changes no collector, fixed v3 tag, AIMock chat fixture or application workload.
Synthetic ZIP unit fixtures test the inspector and are not benchmark workloads.

## Bounds and tests

Source role caps remain those of the immutable 31-role contract, including the
32 MiB raw role and 128 MiB/128-file source limits. The role sum is 104,468,480
bytes; the conservative union reservation is 130,240,512 bytes and 41 files.
Command forensics has exactly eight command roles and its separate manifest
(maximum 16,384 bytes). No cap or capture deadline is increased.

The external archive cap is 135,266,304 bytes. Before constructing `ZipFile`,
the tool checks the central directory (maximum 262,144 bytes and 128 entries),
ordinary single-disk ZIP32 structure and flat roles. It rejects unsupported ZIP
features and validates local/central records, descriptors, CRCs, sizes and
nonoverlapping member ranges. Inputs are never extracted. Each parameters or
receipt file is at most 1 MiB, original receipt bytes total at most 4 MiB, and the
contract is at most 65,536 bytes. Selected JSON has maximum depth 32, 262,144
nodes, array length 8,192, string length 65,536 UTF-16 units and numeric token
width 128, with finite safe numeric semantics. The actually formatted UTF-8
report, including its final newline, is at most 1 MiB before stdout is written.
These are byte/work limits, not a hard Python heap bound.

`npm run test:scroll-cause-inspector` runs standard-library synthetic tests,
including full/forensic branches, tampering and reference joins, immutable
contract/portable copied layout, path races, ZIP boundaries, numeric/type limits,
refusal authority and exact emitted output limits. CI runs it as a distinct unit
step and retains its log with existing unit logs. No archived JavaScript or
browser is executed by these tests.
