# AI SDK UI functional profile

This independent npm project pins `@ai-sdk/react@4.0.163`, `ai@7.0.159`, and
React 19.3.1. It uses public `useChat`, `DefaultChatTransport`, and `regenerate()`
to continue the existing final user message without appending a new user.

AI SDK UI supplies state and streaming hooks. This profile's plain-text message
renderer, composer, bottom-follow behavior, and return button are benchmark-owned
application code. It does not represent AI Elements, Streamdown, or a stock chat
renderer. Those configurations require separate adapters and results.

The shared context contains canonical history, identities, workload parameters,
and hashes; it contains no future response text. Actual streamed SDK state
supplies the generated response ID and final transcript. The bridge retains the
original regenerate promise, SDK error, and public onFinish flags independently:
promise fulfillment alone cannot prove successful streaming. Disposal stops the
public run, unmounts React, and awaits the original operation.

Use Node 24.20.0 and npm 11 from this directory:

```sh
npm ci --workspaces=false --ignore-scripts
npm test
npm run build
```

The lockfile and physical dependency tree are independent of the root and other
profiles. Build checks enforce exact direct pins, local tools and dependency
roots, strict consumer types, and the physical modules included in the production
bundle. `dist/profile-build.json` records build inputs. Tests include the actual
mounted SDK, transport rejection, and an AbortError after delivery of all text.

This is a functional H100/R6400 configuration. It establishes no FPS, performance
ranking, pixel presentation, or full comparison-matrix qualification.
