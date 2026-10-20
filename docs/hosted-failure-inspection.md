# Inspect a retained hosted failure

The optional offline inspector describes a retained Tracker JSON A failure. It
does not run a browser, import archived code, contact GitHub, or change benchmark
eligibility. It requires Python 3.12 or newer on a POSIX system with descriptor
relative operations and no-follow directory opens, with no third-party Python
packages. Unsupported platform capabilities are refused.
Node/V8 collection and the existing comparison analyzer keep their own profiles.

Use the original extracted failure directory and a separate context file. Obtain
the inventory byte count and SHA256 from your retained acquisition evidence; do
not treat a newly calculated hash of an unknown directory as provider provenance.
The context has these required fields; replace the placeholders before use:

```json
{
  "sourceSha": "<expected-40-character-source-SHA>",
  "runId": "<original-decimal-run-ID>",
  "attempt": 1,
  "inventoryRef": {
    "path": "tracker-a-failure-inventory.json",
    "bytes": 12345,
    "sha256": "<expected-64-character-inventory-SHA256>"
  }
}
```

Use canonical absolute paths. Keep the context outside the artifact directory.
Choose a new output directory
outside the input and context directories, and any supplied source or external
evidence directories. Existing output directories are refused.

```sh
npm run bench:inspect:hosted-failure -- \
  --artifact-dir /evidence/original-extracted-failure \
  --context /evidence/context/expected.json \
  --out /results/new-failure-inspection
```

The optional `sourceRoot` field protects an additional absolute source directory
from output overlap. Optional `externalRefs` entries have `kind`, absolute `path`,
`bytes`, and `sha256` fields. Supported kinds are `provider-run`, `archive`, and
`extraction`. Each supplied file is hash checked. A `provider-run` file uses the
original GitHub REST run shape, including `id`, `run_attempt`, and `head_sha`.
Capture that unprojected shape with
`gh api repos/OWNER/REPO/actions/runs/RUN_ID`, replacing the repository and run ID.
Matching those fields establishes a relation to supplied metadata; provenance
remains caller supplied. An archive reference is hash checked, not extracted or
independently qualified. The failure inventory alone contains no pilot run ID;
without supplied matching run metadata that identity remains unjoined.

The report separates file integrity, supported schema and reference joins,
sampled scroll/anchor relations, whole-trace JSON syntax, retained capture
closure, and the original failed scenario. A rise in `scrollTop` can coexist
with an unchanged selected anchor position. Two stable anchor samples establish
only that sampled relation; they do not prove uninterrupted stability or explain
which implementation caused the offset change. Inter-slot samples are distinct
from samples bracketing the same wheel event.

Trace inspection consumes the complete bounded JSON file, including unknown
events, and reports a census. Parsed EOF and retained capture closure are separate
checks. Neither establishes complete scenario execution, presented frames, FPS,
scoring, or rankings. Unsupported relation checks remain explicitly unavailable.
The original strict offset failure stays failed, even when inspection succeeds.

Exit 0 means a diagnostic report was published. Exit 2 means an input, format,
or integrity refusal. Neither exit code means the benchmark passed. Reports keep
qualification, native admission, performance, scoring, and ranking disabled, with
FPS unavailable.
A refusal can leave partial output. Require the successful terminal receipt and
its report hash; file existence alone is insufficient. Descriptor checks detect
observed path changes but do not provide an atomic snapshot against arbitrary
concurrent directory renames.

The inspector preserves the publisher's finite role caps, including a 32 MiB raw
trace and 128 MiB/128-file namespace ceiling. Strict UTF-8 JSON decoding rejects
duplicate decoded keys and nonfinite values and preserves integers and decimal
tokens without a floating-point round trip. Additional numeric, depth, work, and
report bounds apply. Python's JSON decoder allocates objects before some checks;
these bounds do not guarantee constant-space parsing or a hard process heap cap.

Run the synthetic integrity and diagnostic tests locally with:

```sh
npm run test:hosted-failure-inspector
```

Ubuntu unit CI runs these tests explicitly. Private downloaded artifacts and
generated inspection reports belong outside the repository.
