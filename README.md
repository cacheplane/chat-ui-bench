# Chat UI Bench

Reproducible browser instrumentation for long, streaming agent conversations.
Maintained by Cacheplane for future Threadplane regression checks and chat-stack
comparisons. This foundation measures a minimal reference chat with controlled
faults. Competitor adapters, a dashboard, and comparative rankings are not
implemented.

The npm workspace contains a deterministic replay contract, independent Node SSE
producer, local browser reference, Playwright/CDP capture runner, and offline
analyzer. It validates exact transcript completion, receipt/application ordering,
active message identity, scroll movement/anchoring, and evidence integrity before
scoring any sample. Failed and invalid repetitions remain in reports.

## Run it

Use Node 24+ and npm 11+; dependencies and Playwright Chromium are pinned in the
lockfile. No global browser or Python installation is required.

```sh
npm ci
npx playwright install chromium
npm test
npm run typecheck
npm run build
npm run test:browser
npm run bench:calibrate -- --mode headless --repetitions 3 --out artifacts
npm run bench:calibrate -- --mode headed --repetitions 3 --out artifacts
npm run bench:analyze -- --artifact-dir /absolute/path/to/artifacts/calibration-directory
```

`bench:calibrate` captures then analyzes, printing its new artifact directory.
`bench:analyze` reads existing raw evidence without opening a browser or starting
an SSE producer. It rewrites only derived `metrics.json` and `summary.md` files.
A successful calibration expects the three intentional omitted-delta repetitions
to be invalid, with all other repetitions valid. Unexpected invalid/failed runs
or missing required calibrations produce a nonzero exit. Supported calibration
measurements must satisfy their checks; unsupported stall/snapshot capabilities
remain explicitly **unvalidated**, with reasons, rather than fabricated passes.

Each three-round invocation interleaves seven exclusive variants: clean, stall,
delayed-display, scroll, omitted-delta, retention-release, and retention-retain.
That is 21 repetitions with 100 history messages and 200 deltas at 50 ms intervals.
Each repetition uses a fresh Chromium process/profile with local assets loaded
before measurement. Headed and headless results are grouped separately.

## Measurements and limits

CI runs on pull requests, pushes to `main`, and manual dispatches using Node 24
and npm 11. It installs locked dependencies, runs unit tests, typechecks and builds
the workspaces, then runs the browser conformance suite sequentially with pinned
Playwright Chromium. Failed runs retain command logs and available browser
evidence for seven days. These shared-runner checks validate instrumentation
conformance; they do not establish hardware performance baselines or rank chat
stacks.

Available evidence can derive producer lateness, page receive-to-DOM latency,
DOM backlog, observed composer Event Timing and Long Animation Frames, scroll
movement and anchoring, renderer V8 heap/DOM counters, and named retained buffer
ownership after five resets. Every metric carries its unit and evidence or an
unavailable reason. The analyzer reports comparable group medians, ranges,
sample counts, and every failure.

DOM observations approximate text freshness; they do not prove pixel
presentation. Producer/page clocks are independent, so transport latency is
unavailable. Event Timing absence below the configured 16 ms threshold is
unavailable, not zero latency, and these scripted events are not field INP.
Heap counters are not total browser memory. Retention uses strong named heap
paths and native backing storage, not a guessed JS heap increase.

**Presentation metrics are unavailable in this milestone.** An unchanged headed
CDP trace was rejected by Chrome DevTools Performance import with “No frames
found in trace data.” Capture Chrome 156.0.8078.4 and viewer Chrome 154.0.8037.98
have different revisions; that is a possible factor, not a proven cause. No
numerical FPS or dropped-frame values are published. This foundation is not
ready for public smoothness comparisons.

See [instrumentation and artifact contract](docs/instrumentation.md) for evidence,
clock domains, grouping, capability checks, overhead, and reanalysis limits.
The [approved design](docs/superpowers/specs/2026-10-09-instrumentation-foundation-design.md)
sets the milestone boundaries. Reference calibration results are instrumentation
checks and do not rank chat stacks.

## Planned comparison adapters

The next milestone will add the shared long-thread workload and supported runtime
adapters for public competitor comparisons. These adapters are not implemented.

| Stack | Planned configurations |
| --- | --- |
| Threadplane Angular | Current documented default |
| assistant-ui React | Default kit and documented virtualized composition |
| AI SDK + AI Elements + Streamdown | Documented chat composition |
| CopilotKit Angular | Compatible released Angular configuration |
| CopilotKit React | Documented React chat composition |

Each future comparison must disclose exact library/framework versions, content
features, renderer, configuration, and build revision. Defaults and optimized
configurations will be reported separately after their equivalence is verified.
