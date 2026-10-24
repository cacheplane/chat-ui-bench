# Modified Threadplane dependency selection

`node select.mjs` (from any working directory) selects the released 0.3.2 renderer for the modified idle-host profile from the current checkout. Run the source-only controls with `node --test tools/threadplane-modified-dependencies/select.node.mjs`. These commands do not install packages or run a browser.

The dedicated `package-lock.legacy.json` in this directory is derived from the current stock security graph. Its top-level `threadplaneModifiedDependencies` field records `derivationBaseStockLockSHA` (SHA-256 of the exact current root `package-lock.json` bytes) and `rootManifestSHA` (SHA-256 of the exact current root `package.json` bytes, including security overrides). Selection fails if the dedicated lock is absent or either current hash differs; a stock security update requires a new derivation and review.

The compatible dependency fixes do not clear the full audit: the graph still contains upstream Zod 3 dependencies affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A clean selected `npm ci` succeeds, while unchanged `npm audit --audit-level=high` fails on that advisory and its dependent-package chains. Keep the audit gate unchanged. The lock is a reproducible selection artifact, not evidence of a passing audit or browser run.

Derive the lock by copying the final stock lock and changing only:

- The five `@threadplane/{a2ui,chat,langgraph,render,telemetry}` app workspace pins from exact 0.3.3 to exact 0.3.2.
- The five corresponding `apps/threadplane/node_modules/@threadplane/*` records: version, npm registry tarball URL, reviewed 0.3.2 integrity, and their Threadplane dependency/peer ranges from `0.3.3`/`^0.3.3` to `0.3.2`/`^0.3.2`.
- The derivation metadata above.

The five integrities in `select.mjs` come from immutable historical baseline `df05817b02c6408d205a618b4babc05bc7693c70`. That commit is a package identity reference, never the new CI locked graph. All other fields and package paths must match the current stock lock exactly as parsed JSON. A required change outside this small substitution needs explicit source review; the selector will reject it. Root and app manifests must agree with their stock lock workspace entries before overlaying. The root manifest itself is never rewritten, so current security overrides remain active.

After deriving the candidate, run the source controls and `node tools/threadplane-modified-dependencies/select.mjs` in a disposable current-stock checkout, inspect the emitted checkout/hash/pin log, then run ordinary root `npm ci`, unchanged `npm audit --audit-level=high`, and `npm run test:browser:threadplane:idle-host-css`. Review the lock diff and actual functional build evidence before accepting the generated lock. Keep this tooling and dedicated lock outside the benchmark runtime copy roster. The stock lock and stock app manifest stay committed as stock; selection writes only the disposable checkout used for modified CI.

Selection validates every input before staging exclusive temporary files in an exclusively owned transaction directory on the checkout filesystem. Each destination is published by atomic rename. If lock publication fails, the app manifest is restored by rename; a failed rollback retains the transaction directory and throws. An interrupted selection also leaves that directory, so subsequent selections fail closed. A half-selected manifest/lock pair cannot pass `npm ci`. Restore a clean stock checkout before retrying an interrupted transaction; never continue to installation after a failed selector. Successful selection logs the current checkout SHA, stock lock SHA, root manifest SHA, selected lock SHA, overlaid app manifest SHA, and all five selected pins.

New functional builds describe their actual security-updated closure and original 0.3.2 renderer/CSS identity. Existing descriptors, stylesheets, parser rules, package-integrity expectations, historical captures and results are unchanged.
