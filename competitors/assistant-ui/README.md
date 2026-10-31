# assistant-ui functional profile

This independent npm project renders the complete official assistant-ui `Thread`
kit with `@assistant-ui/react@0.15.32` and
`@assistant-ui/react-markdown@0.14.24`. It uses React 19.3.1 and a custom
`ChatModelAdapter` through `useLocalRuntime`; it does not use the AI SDK runtime.

The copied component closure, Base UI registry components, default template theme,
and upstream license are pinned to commit
`ff654d8156680b839774296ef644b57ab1078425`. Every copied file remains byte-for-byte
upstream. `source-manifest.json` records upstream paths, immutable URLs, and SHA-256
hashes. Source tests check the hashes and completeness of local imports.

Stock behavior is preserved: deferred GFM markdown, all messages mounted with
`content-visibility: auto` and intrinsic sizing, `turnAnchor="top"`, smooth native
scrolling, composer, message actions, and return-to-bottom control. The only added
layout styles constrain html/body/root to the viewport and select Arial. There is
no added virtualizer, message truncation, or benchmark scroll implementation.

The root comparison server serves this project's production `dist`, `/context`,
and `/stream/ui`. The context is parsed before mounting and contains only history,
identities, workload parameters, and digests. The adapter reads actual SSE deltas
and yields cumulative text to LocalRuntime. It neither imports expected future
text nor validates completion by substituting a fixture array.

The public bridge reads `runtime.thread.getState()`. A once-only
`runtime.thread.startRun({ parentId: lastUserId })` creates a continuation without
appending a user. The generated assistant ID remains unchanged. Because the public
`startRun` API returns void, `waitForRun` is explicitly a
`public-runtime-state-transition` promise. It rejects on incomplete/error or
cancellation statuses. Source reader rejection is separately retained, exposed as
documented SDK error status, and awaited during cleanup; cleanup cancels the public
run and owned reader before unmounting.

Use Node 24.20.0 and npm 11.19.0 from this directory:

```sh
npm ci --workspaces=false --ignore-scripts
npm test
npm run build
```

The package has an independent lockfile and node_modules. Build verification checks
physical dependency roots, exact direct pins, lock integrity, external symlinks,
and every bundled node_modules module. Strict consumer type checking uses the
installed public APIs with `skipLibCheck: false`. Tests cover SSE framing, original
reader errors and cancellation, public completion/error transitions, duplicate
start, disposal, source provenance, dependency isolation, and a mounted installed
SDK history/error scenario. Vite's large-chunk advisory is retained; it does not
authorize a performance claim. Browser correctness is checked by the root runner.

This profile is a functional comparison surface. It makes no FPS, latency, ranking,
or full benchmark-matrix claim.
