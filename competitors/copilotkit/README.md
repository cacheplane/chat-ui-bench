# CopilotKit functional profile

This independent npm project pins CopilotKit React/core/runtime 1.83.0 and React
19.3.1. It mounts the public v2 `CopilotKitProvider` and default `CopilotChat`
with their shipped stylesheet. The application stylesheet only supplies viewport
height, system font, and containment. The default chat owns its virtualized
renderer, bottom following, and native return control.

The same-origin server plugin uses the public `CopilotRuntime`,
`InMemoryAgentRunner`, and Hono adapter. An owned AG-UI agent replays the actual
Aimock seed and continuation events supplied by the common case server. It seeds
the anonymous HTTP owner through the public runner before accepting requests.
The plugin admits one owned thread and one continuation, validates history and
run identity, and waits for retained public agent promises and playback tasks
during disposal. It uses no enterprise or development-agent shortcut.

The browser bridge reads the public default agent's messages and state. It keeps
the original `copilotkit.runAgent` promise, preserves actual response IDs, and
awaits public detach and original settlement before unmounting. Final text,
server emissions, HTTP completion, and browser request completion are distinct
functional evidence; this profile does not establish per-delta SDK consumption.

Run from this directory, with Node 24.20.0:

```sh
npm ci --workspaces=false --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build
```

The typecheck checks the strict consumer project with `skipLibCheck`; it does
not claim to typecheck all vendor declarations. The production build emits
`profile-isolation.json` recording registered physical module resolution. Its
policy permits this project and the shared dependency-free context parser, and
rejects physical modules resolved from the root or another profile. Build
warnings remain visible. Browser geometry and native-control behavior require
the common fresh browser journeys. This is a functional H100/R6400 profile;
it provides no FPS, performance ranking, or full comparison-matrix qualification.
