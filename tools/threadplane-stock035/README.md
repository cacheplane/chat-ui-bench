# Additive registry-stock 0.3.5 selection

This path is separate from the committed stock 0.3.4 workspace, historical
0.3.3 controls, modified 0.3.2 profile and local source-build diagnostics.
It is currently **unavailable**: the fixed reviewed published-identity module
is `null` until all five used 0.3.5 registry records and tarball integrities
have been independently acquired and reviewed. The same fixed record binds
the exact selected app manifest, root manifest and root lock SHA-256 hashes.
Neither CLI accepts caller
pins, local tarballs, a verifier override or a fallback release.

To prepare the fixed record after actual registry acquisition, the pure
`deriveStock035SelectionV1` model accepts a parsed registry identity whose
`selectedSourceHashes` is null and returns the exact derived hashes. This model
does not mutate files or establish admission. Put the reviewed actual hashes
and actual published registry identities together in the fixed source module.
The production accessor refuses null or partial identity and privately copies
and deeply freezes the complete record. The default build guard checks those
actual source hashes; the real selector verifies derivation matches them before
writing anything. Caller-supplied JSON never replaces production authority.

After publication, use a fresh disposable checkout of this benchmark revision.
Record its exact checkout SHA, and explicitly select the reviewed registry
packages before an ordinary install and genuine production build:

```sh
node tools/threadplane-stock035/select-v1.mjs --root /absolute/disposable/checkout --expected-checkout <exact-checkout-sha>
npm ci
npm run build --workspace @chat-ui-bench/threadplane
node tools/competitor-comparison/aimock-stock035-growth-v1.mjs --out /absolute/new/local-stock035-cohort
```

Run the install/build/cohort commands with the disposable checkout as working
directory. Selection validates the exact reviewed 0.3.4 source manifest/lock
bytes, then changes only the five app/workspace pins, five registry package
identities and their internal Threadplane dependency/peer ranges. All other
lock graph fields remain unchanged. Publication uses an exclusive transaction,
input rechecks and guarded app/lock renames. A failed or interrupted selection
leaves the transaction as a refusal marker; discard that disposable checkout
before another explicitly declared attempt. Selection alone never establishes
published-package, build or native admission.

The new cohort declares all twelve attempts: H1000/H10000, R6400, follow and
history-reading, in each of three rounds. It retains the unchanged V5 native
body, public bridge, source/native checks, deadlines, limits and cleanup. The
only additive case seams are the existing eight trace/build seams. Default
stock035 guards bind the five real released package integrities and reviewed
host/configuration plus selected app/root-lock bytes before and after each
case and the complete invocation.
Output paths must be fresh; filters, retries and replacement attempts are not
accepted. Failed and unattempted slots remain part of the declared cohort.

The V2 collector and decoder retain their original completeness, original-owner,
EOF, loss, stream/session release and size checks. Trace availability and native
functional status remain independent. Complete task/Layout/MinorGC events on
the bound renderer describe observed whole-capture intervals/counts, including
observer work. They establish neither CPU time, complete event populations nor
displayed frames. `performance` and `scoringEligibility` remain false; FPS stays
null. This Threadplane-only trace cohort does not establish competitor trace
comparisons or native matrix success for all four libraries.

Keep raw fixtures, traces, package archives, selection/build proofs and failed
attempts local. Do not relabel or pool 0.3.3, 0.3.4, modified0.3.2, local builds,
CPU sampling diagnostics or earlier incomplete captures as stock0.3.5.

Source controls run without installing0.3.5:

```sh
node --test tools/competitor-comparison/aimock-stock035-v1.node.mjs tools/competitor-comparison/stock035-selection-v1.node.mjs tools/competitor-comparison/matrix-case-stock035-trace-v1.node.mjs tools/competitor-comparison/aimock-stock035-growth-v1.node.mjs
```

Synthetic unit records test closed parsing/JSON derivation only. The production
guard has one fixed source identity, and refuses before a build or browser is
launched while publication pins are unavailable. Genuine positive admission
must be verified after registry publication and the fresh install/build above.
