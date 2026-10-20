# First measurement and resize scroll compensation

The [unchanged-vendor reproduction](../tests/copilotkit-first-measure-resize.test.ts)
demonstrates that the pinned virtualizer can compensate a first measurement
during backward scrolling. Its default rule suppresses a backward remeasurement,
while a source-equivalent Copilot callback can still request compensation.
These are direct vendor calls from synthetic state, not browser-visible motion
or a proposed application fix.

With the repository's locked dependencies installed and Node 24+, run:

```sh
npm test -- tests/copilotkit-first-measure-resize.test.ts --reporter=verbose --no-color
```

Normal unit discovery includes this file. It runs 14 original `resizeItem` calls
and one coordinate-equation check. It does not open a browser, execute React or
the Copilot bundle, use the SDK, download evidence, or write a results artifact.
Local test durations are not benchmark measurements.

## Original source and test ports

The test checks installed package versions `@tanstack/virtual-core` 3.19.4 and
`@copilotkit/react-core` 1.78.0. Before importing the original virtual-core
module, and again after the tests, it checks these exact original bytes:

| Installed file | Bytes | SHA-256 |
| --- | ---: | --- |
| `@tanstack/virtual-core/dist/esm/index.js` | 54156 | `06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09` |
| `@tanstack/virtual-core/dist/esm/lazy-measurements.js` | 1052 | `99b8ef4dc023f5249b8c6c0c164abd2d5793a369b83795c2559ef83069643672` |
| `@tanstack/virtual-core/dist/esm/utils.js` | 2545 | `c1cee1b5f7f1cff7e20bd074dcc38b70f4774924f00bb674c0e226089f8d8279` |
| `@copilotkit/react-core/dist/copilotkit-DgJj6xa0.mjs` | 509399 | `2067b06183e89b1399dbbd894f03d1c541d4f14b4cd62be717d10c01849969a6` |

Paths resolve from the test file to the repository's installed dependencies.
There is no private checkout dependency, copied executable, transform or vendor
method patch. A dependency change fails the pins until deliberately reviewed.
These before/after byte checks do not establish continuous physical identity or
hosted provenance.

An estimated geometry entry exists in `measurementsCache` for both branches.
Absence from `itemSizeCache` makes the operation a first measurement; seeding
that cache makes it a remeasurement. The default first-measure rule compares
the item's top with the current offset plus adjustments, regardless of backward
direction. Default remeasurement requires the whole old item above the fold
and a direction other than backward. A pending command awaiting readback can
prevent applying an otherwise accepted adjustment.

The test checks the exact callback excerpt in the pinned Copilot bundle, then
supplies its equivalent body with a local synthetic pinned-state ref. That
callback refuses while pinned; otherwise it compares the item's top with offset
plus adjustments. It replaces the virtualizer's default decision. The real
React ref lifecycle, component layout and ResizeObserver delivery are not run.

The minimal receiver records original `elementScroll` calls, verifies its `this`
and exact own argument keys, and retains real `undefined` behavior values.
Assertions cover delegate-before-notify ordering and resulting offset/cache
state. They do not simulate how a browser applies or clamps the request.

| Cases | Expected direct calls |
| --- | --- |
| Generic first/default and first/Copilot-equivalent, backward | `top: 105`, `behavior: undefined`, then notify true |
| Retained-number first/default and first/Copilot-equivalent, backward | `top: 16824`, `behavior: undefined`, then notify true |
| Negative first/default, backward | `top: 95`, then notify true |
| Remeasure/default forward; remeasure/Copilot-equivalent backward | `top: 105`, then notify true |
| Fold-spanning first/default; fold-spanning remeasure/Copilot-equivalent | `top: 105`, then notify true |
| Remeasure/default backward; fold-spanning remeasure/default forward | Notify false only; offset stays 100, measured cache becomes 15 |
| Pinned-bottom Copilot-equivalent; pending original command | Notify false only; offset stays 100, measured cache becomes 15 |
| Zero delta | No delegate, notification or new measured cache entry |

Generic inputs use old size 10, actual size 15, offset 100 and item start 0,
except the stated negative, fold and zero cases. The retained-number fixture
uses index/local key 81, start 15149, old size 199, actual size 316 and offset
16707. Its local key is synthetic, not hosted ledger keyToken 2 or proof of the
same hosted object. Default first measurement also compensates: custom callback
presence is not shown to be a necessary or exclusive cause.

## Historical retained observations

The separate historical diagnostic ran at producer commit
`c169fd3543b29178a237ca6c9c9c34c678c04a2c`, tree
`108aad99100a82b46e222e3d7fabb34b8c4e5987`, tag
`hosted-copilot-react-scroll-cause-v3`:
[run 39388317339, attempt 1](https://github.com/cacheplane/chat-ui-bench/actions/runs/39388317339),
[artifact 12248387700](https://github.com/cacheplane/chat-ui-bench/actions/runs/39388317339/artifacts/12248387700)
(`copilot-scroll-cause-39388317339-1`). The original ZIP was 5,755,693 bytes,
SHA-256 `cf4d7367bdc45a2a3a485f3a9e07606d26674297ebc8158f54a5ebd25fe2b5f6`.
Retention is historical; current provider availability is not promised. No
original evidence is bundled with these tests.

A reviewed offline audit of retained scalar/ledger/anchor data observed:

- Strict status remained `incomplete`, with a primary failure and
  `firstFailure.code: "opposing-offset"`, scalar ordinal 74 versus 73, slot 36,
  and cleanup failure count 0.
- Across those samples, scrollTop rose 16707 → 16824 (+117) and scrollHeight
  rose 20754 → 20873 (+119). The extra 2 pixels are unassigned.
- Scalar-marker ordinals 73/74 correspond to ledger sequence numbers 87/95.
  The resize chain occupies ledger sequences 88–94: index 81/keyToken 2,
  start 15149, old size 199, new size 316, delta 117, then a request targeting
  16824 and the original delegate. These are distinct ordinal namespaces.
- The same selected anchor owner 18 had retained probe top 345 and native
  viewport Y 0 at both samples. This is a sampled coordinate observation.

The recorded request is consistent with the observed movement. It does not
prove exclusive scroll authorship, continuous anchor stability or presentation.
Three motion events were retained; competing motion was not proven absent.
Ledger order is JavaScript-order evidence, with no interpolation to host, page
or trace clocks.

The arithmetic test illustrates the tradeoff: `17052 - 16707 = 345` before,
and `17169 - 16824 = 345` after. Keeping the old scrollTop would instead give
462. This is a coordinate equation, not a browser-rendered counterfactual.
Strict raw opposition remains a valid failure under the existing contract;
that failure alone does not prove a user-visible defect. No predicate or strict
verifier change follows from this reproduction.

The audited retained JSON trace was closed: 11,337,759 bytes, SHA-256
`2405e7fb3f4c395a2d020f6d1beeed9543e1b0e93b4397b1b2bcf69778a7d6d2`,
57,293 events, literal completion format JSON/compression none and
`dataLossOccurred: false`. The retained transport included terminal EOF,
IO.close, sink finish/fsync/file-close and expected detach. That literal flag
and those retained witnesses are not an independent global no-loss proof,
full physical/native admission, or frame-presentation evidence. Closed trace
does not establish FPS. Separate native protobuf experiments are outside this
finding.

G2/G3/G4 snapshots, return click and measured phase completion were absent.
The later natural drain completing did not make the scenario succeed.
Qualification, nativeGO, performance, scoring and ranking remain false; FPS is
unavailable. No exclusive cause, production defect or future readiness claim
is established.

The [retained inspector](scroll-cause-retained-inspection.md) is a separate tool
for selected byte/data joins; it does not implement the deeper scalar, ledger
and transport audit described here. The unit fixtures do not replace the
unchanged AIMock chat workload or reproduce browser behavior.
