# Additive registry-stock 0.3.6 preparation

This path is staged and unavailable. Its fixed production identity is null.
Threadplane 0.3.6 has not supplied the actual six-package release proof required
by this path. No synthetic parser fixture, unit port or caller record grants
stock admission. Existing 0.3.5, 0.3.4, 0.3.3 and modified/local results retain
separate identities and source files.

Activation requires independent verification of all six synchronized packages,
the five benchmark-consumed registry versions, URLs and SHA-512 integrities,
and review of their actual dependency, peer and optional maps. The pure
`deriveStock036SelectionV1` model consumes only the exact canonical 0.3.4 root,
app manifest and lock bytes. Its returned three selected source hashes must
match the reviewed immutable fixed record before the selector may write. The
root manifest remains unchanged. A changed external dependency graph requires
separate review; a same-integrity local tarball is never a registry selection.

After actual post-G03 main is green and actual release verification is complete,
use a new disposable checkout of the final reviewed revision. Only then run:

```sh
node tools/threadplane-stock036/select-v1.mjs --root /absolute/disposable/checkout --expected-checkout <exact-checkout-sha>
npm ci
npm run build --workspace @chat-ui-bench/threadplane
node tools/competitor-comparison/aimock-stock036-growth-v1.mjs --out /absolute/new/local-stock036-cohort
```

These commands are not preparation evidence until they actually succeed. The
selector rejects unavailable pins before filesystem transactions. Genuine fresh
installed-package/build/default-guard bookends are required after activation;
selection alone grants no build or native admission. Keep all attempts and raw
traces local. Native checks, deadlines and trace limits are unchanged. FPS stays
null; semantic event intervals are not sampled CPU time or presentation FPS.
