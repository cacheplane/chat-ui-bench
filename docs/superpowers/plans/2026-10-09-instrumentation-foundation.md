# Instrumentation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reproducible local calibration suite proving deterministic chat replay, correctness gating, and independently available browser measurements, without competitor comparisons.

**Architecture:** An npm workspace contains a shared versioned contract, an independent Node SSE producer, a framework-free Vite reference chat, and a Playwright/CDP runner with an offline analyzer. Every repetition has immutable raw evidence and explicit validity; the analyzer derives metrics without launching a browser. Presentation remains unavailable until headed trace evidence and its analysis are independently verified.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Vite, Playwright Chromium, Node HTTP/crypto, schema validation (Zod), browser PerformanceObserver/MutationObserver, CDP traces and heap snapshots. Resolve compatible exact versions on Node 24.20.0/npm 11.19.0 and commit the lockfile; do not install Nx or require global Python/browser installations.

---

## Scope and execution rules

The approved authority is `docs/superpowers/specs/2026-10-09-instrumentation-foundation-design.md`. The repository currently has only that document and `README.md`; create the implementation structure below. Complete these four tasks sequentially in the parent's dedicated implementation worktree `/private/tmp/chat-ui-bench-foundation`. The user selected subagent execution. Do not make mid-task implementation commits; review and verify all finished work before the parent worker considers one logical implementation commit. Do not commit generated artifacts. The parent owns plan review and commit handling.

This is one calibration milestone. Exclude competitor adapters, arbitrary scenario DSLs, dashboards, rankings, schedulers, transport latency, production performance claims, Crossbench integration, and optional CPU/allocation profiling. If CDP presentation evidence is insufficient, preserve unavailable output rather than adding a second runner. A later design decision may select another capture path.

Use @superpowers:test-driven-development for meaningful behavior tests, @superpowers:systematic-debugging for unexpected failures, and @superpowers:verification-before-completion before reporting completion. Resolve capture API details against the installed Playwright types and captured browser revision. Treat examples below as required behavioral contracts, not a request to reproduce an untested API signature.

Registry versions verified during planning were Playwright 1.64.0, Vite 8.3.4, Vitest 5.0.3, TypeScript 7.0.2, Zod 4.6.5, and tsx 4.23.15. Use these exact versions if compatible together, verify installed APIs, and lock any compatibility adjustment. Do not infer the browser revision from cached Chromium 1248; verify Playwright's matching browser metadata and install when needed.

## File boundaries

Each workspace has `package.json`, `tsconfig.json`, `src/index.ts` (exports only), and its own `src/*.test.ts`. Root scripts build packages in dependency order. Use ESM consistently; the producer, runner, and analyzer import the contract workspace, while Vite bundles the reference's contract import.

| Path | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore` | Exact dependencies, workspace scripts, TypeScript/test configuration, ignored run outputs |
| `packages/contract/src/fixture.ts` | Fixture schemas, lifecycle validation, deterministic fixture creation, canonical serialization/hash and prefix mapping |
| `packages/contract/src/artifact.ts` | Versioned run, observation, evidence, validity, and metric schemas |
| `packages/contract/src/adapter.ts` | Semantic adapter operations and read-only probe interface |
| `packages/producer/src/replay.ts` | Injectable monotonic deadline scheduler and event/send log |
| `packages/producer/src/server.ts` | Loopback SSE endpoint, connection/closure ownership, backpressure logging |
| `apps/reference/index.html`, `apps/reference/vite.config.ts` | Reference entry and production bundle |
| `apps/reference/src/main.ts`, `apps/reference/src/styles.css` | Fixed-size chat DOM, stable locators, input and scrolling |
| `apps/reference/src/adapter.ts` | History/replay/reset/dispose and deterministic fault modes |
| `apps/reference/src/observations.ts` | Active-response MutationObserver, Event Timing and LoAF observations |
| `packages/runner/src/cli.ts`, `packages/runner/src/calibrate.ts` | CLI parsing, interleaved matrix, run-directory creation, repetition lifecycle |
| `packages/runner/src/capture.ts` | CDP trace/metrics capture and phase markers |
| `packages/runner/src/retention.ts` | Separate forced-GC snapshot diagnostic and retained-buffer evidence |
| `packages/runner/src/artifacts.ts`, `packages/runner/src/environment.ts` | Incremental durable evidence and manifest/environment identity |
| `packages/runner/src/browser.test.ts` | Real-browser calibration acceptance using the runner |
| `packages/analyzer/src/validate.ts`, `packages/analyzer/src/metrics.ts` | Artifact correctness gates and same-clock metric derivation |
| `packages/analyzer/src/trace.ts`, `packages/analyzer/src/retention.ts` | Versioned capability checks for trace/snapshot evidence |
| `packages/analyzer/src/report.ts`, `packages/analyzer/src/cli.ts` | Deterministic JSON/Markdown reports and offline CLI |
| `docs/instrumentation.md`, `README.md` | Reproduction, artifact contract, limitations, headed evidence checklist |

Do not put browser lifecycle in the analyzer or correctness verdicts in the reference adapter. Keep trace data raw; do not invent normalized presentation samples.

## Public commands and output contract

Root scripts must support these exact invocations:

```bash
npm ci
npx playwright install chromium
npm test
npm run typecheck
npm run build
npm run test:browser
npm run bench:calibrate -- --mode headless --repetitions 3 --out artifacts
npm run bench:calibrate -- --mode headed --repetitions 3 --out artifacts
npm run bench:analyze -- --artifact-dir artifacts/<invocation-id>
```

`bench:calibrate` runs built packages and serves the built reference assets, so documentation requires `npm run build` first. `test:browser` builds first and runs only the real-browser test file; exclude it from ordinary `npm test`. Fixture/unit tests run through `vitest run`; typecheck uses `tsc --noEmit` for each workspace. Build uses contract → producer → reference → runner → analyzer dependency ordering. Choose a small script runner such as `tsx` for test/config tooling only if needed, and lock it.

The default matrix interleaves round 1, round 2, round 3 in fixed order: clean, stall, delayed-display, scroll, omitted-delta, retention-release, retention-retain. This produces 15 streaming/input repetitions and six separate retention diagnostics. Each repetition launches a fresh Chromium process/profile and producer; retention performs five resets within its own process. The omission is an expected invalid calibration: retain its invalid result and count correct rejection as calibration success. Unexpected invalid/failed controls or missing required calibrations cause a nonzero calibration exit. Lack of headed presentation support is a documented capability limit, not a fabricated successful measurement.

`artifacts/<new timestamp-and-random-id>/` contains `invocation.json`, `summary.md`, `metrics.json`, and `repetitions/<round>-<variant>/` with `manifest.json`, exact `fixture.json`, `producer-events.jsonl`, `page-observations.jsonl`, `trace.json`, `validation.json`, `metrics.json`, and `summary.md`. Retention directories additionally preserve all raw `.heapsnapshot` files and diagnostic checkpoints. Logs must be written before analysis; preserve partial artifacts on failure and write failure status in `finally`. Never overwrite another invocation or rerun a failed sample in its place. Ignore `artifacts/`, `node_modules/`, and build outputs in Git.

### Task 1: Establish validated contracts and deterministic fixtures

**Files:** Create root configuration; create `packages/contract/{package.json,tsconfig.json,src/index.ts,src/fixture.ts,src/artifact.ts,src/adapter.ts,src/fixture.test.ts,src/artifact.test.ts}`. Other workspace manifests can be added in their owning tasks.

- [ ] **Step 1: Bootstrap the contract test toolchain.** Resolve exact TypeScript/Vitest/Zod versions, create scripts, and generate `package-lock.json` with npm. Set `test` to exclude `browser.test.ts`. Configure package exports to compiled files and internal workspace dependency versions coherently.
- [ ] **Step 2: Write failing behavioral tests.** Test deterministic 100-message alternating history, one active assistant response, 200 exact UTF-8 deltas scheduled every 50 ms, generator version/seed metadata, canonical hash stability across property insertion order, and UTF-8 bytes versus string length. Reject negative/nonfinite/decreasing schedules, duplicate sequence numbers, unknown IDs, delta before start, repeated completion, and events after completion. Test prefix mapping for multibyte/empty chunks and one DOM checkpoint satisfying multiple sequences. Include these concrete assertions:

```ts
expect(payloadBytes('🙂')).toBe(4);
expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
expect(() => validateFixture(withDuplicateSequence(fixture))).toThrow();
expect(() => validateFixture(withDeltaAfterCompletion(fixture))).toThrow();
expect(prefixesFor(['a', '🙂', ''])).toEqual(['a', 'a🙂', 'a🙂']);
expect(() => metricSchema.parse({ status: 'unavailable', value: 0 })).toThrow();
```

- [ ] **Step 3: Run red tests.** Run `npx vitest run packages/contract/src/fixture.test.ts packages/contract/src/artifact.test.ts`. Expect missing implementation exports or explicit failing behavior; fix test discovery/config problems before implementation.
- [ ] **Step 4: Implement contract validation and fixtures.** Use recursive sorted-key JSON serialization, SHA-256 over the stored canonical UTF-8 fixture, explicit lifecycle validation, and separate prefix character lengths/UTF-8 byte counts. Include assistant-start and assistant-complete around the 200 deltas. Allow equal timestamps in sequence order. Freeze fixture identity per invocation.

Use this metric shape throughout:

```ts
type Metric<T> =
  | { status: 'available'; value: T; unit: string; evidence: string[] }
  | { status: 'unavailable'; reason: string };
type RunStatus = 'valid' | 'invalid' | 'failed';
type ClockDomain = 'producer-monotonic-ms' | 'page-performance-ms';
```

Unavailable metrics require a nonempty reason and forbid numeric `value`; failed/invalid samples cannot contain scored performance values. Raw diagnostics may remain inspectable with explicit unscored labels. Define phase IDs `setup`, `streaming-auto-follow`, `composer-input`, `gesture-scroll`, `return-to-bottom`, `validation`, `retention`, and `disposal`. Observations carry clock domain, repetition, phase and sequence; manifests carry schema/suite/analyzer/collector versions and availability reasons for absent environment facts.

Define `loadHistory`, `connectReplay`, `resetThread`, `dispose`, and read-only `{ transcript, activeMessageId, lastAppliedSequence }` probes; locators use `data-testid="chat-scroll"`, `data-testid="composer"`, `data-message-id`, and `data-testid="active-response"`. A completed response has no active message; validation compares active ID during replay and cleared state after completion.
- [ ] **Step 5: Run green verification.** Repeat the red command; run `npm test` and `npm run typecheck`. Expect all discovered unit tests and contract typechecks to pass. Review contracts against all artifact fields in the spec before continuing.

### Task 2: Build independent replay and the instrumented reference

**Files:** Create producer/reference workspace files from the boundary table, plus `packages/producer/src/replay.test.ts`, `packages/producer/src/server.test.ts`, `apps/reference/src/observations.test.ts`, and `apps/reference/src/adapter.test.ts`.

- [ ] **Step 1: Write scheduler and checkpoint red tests.** Inject a monotonic clock, timer and SSE writer. A simulated late callback must send sequences in order without changing subsequent deadlines; `write(false)` records backpressure without waiting for a browser ACK. A disconnect ends replay and records failure. Assert a late event planned for 100 ms and actually sent at 170 ms has lateness 70 ms, while the next planned deadline remains 150 ms. Test a checkpoint after three receipts maps all satisfied prefixes to one page timestamp, batches report positive backlog, and unrelated history mutation causes no scan. Test teardown disconnects observers/EventSource and clears timers.
- [ ] **Step 2: Run red tests.** Run `npx vitest run packages/producer/src apps/reference/src`. Expect missing functions or behavioral assertion failures, not test-environment errors.
- [ ] **Step 3: Implement the producer.** Use `performance.now()` or an equivalent Node monotonic origin. Compute each deadline as origin + scheduled time, record relative scheduled/actual time, exact bytes and `write()` backpressure, and send in sequence when late. SSE serves one validated fixture per repetition over loopback and terminates on disconnection; runner owns shutdown. Do not await receipt/render acknowledgement or shift deadlines. Log actual failures and use transport headers consistent with a loopback Vite production asset server.
- [ ] **Step 4: Implement the reference and observations.** Apply history once, render plain text with local fixed CSS/font fallbacks, and expose the semantic adapter/probes. On SSE receipt record sequence and page timestamp before applying. Use MutationObserver only on the active response and compare its text to expected cumulative prefixes; checkpoint all newly satisfied sequences at one observer timestamp. Store observations locally and drain incrementally to the runner. Full transcript inspection occurs only outside scored phases.

Fault modes are exclusive: clean; synchronous 120 ms busy interval immediately after delta 50 is applied; display flush every 200 ms while receipts continue; omit a fixed delta (for example delta 75); retention-release; retention-retain. Complete must flush delayed pending text. Retention reset allocates one exactly 4 MiB `Uint8Array` per reset; retain stores it in a module-owned array, release leaves it unreachable. Use a stable named holder so snapshot reachability can be diagnosed; do not infer retention from JS heap counters.

Feature-detect Event Timing and LoAF observers, record unsupported reasons, and record Event Timing threshold (16 ms if accepted by the installed browser). Below-threshold/missing input entries are unavailable/not observed, never zero. Upward wheel input pauses follow; return-to-bottom explicitly resumes it. Do not use rAF as a presentation counter.
- [ ] **Step 5: Run green tests and build.** Repeat `npx vitest run packages/producer/src apps/reference/src`; run `npm test`, `npm run typecheck`, and `npm run build`. Inspect that Vite produces a local reference bundle with no external fonts/model calls. Browser interaction acceptance belongs to Task 3, not a mocked DOM timing claim here.

### Task 3: Capture isolated repetitions and calibrate observable behavior

**Files:** Create runner files from the boundary table, `packages/runner/src/calibrate.test.ts`, `packages/runner/src/artifacts.test.ts`, `packages/runner/src/retention.test.ts`, and `packages/runner/src/browser.test.ts`.

- [ ] **Step 1: Write lifecycle/artifact red tests.** Inject browser/server factories and failure points. Prove fresh browser/profile for every repetition, interleaved ordering, setup/disposal deadlines of 10 seconds, replay deadline 30 seconds, partial logs retained on collection failure, no silent retry, resource closure after each failure, and a unique directory for successive invocations. Test retention GC/snapshots cannot execute inside streaming/input phases. Simulate tracingComplete timeout/lost trace and preserve failed artifacts.
- [ ] **Step 2: Run red tests.** Run `npx vitest run packages/runner/src/calibrate.test.ts packages/runner/src/artifacts.test.ts packages/runner/src/retention.test.ts` and expect missing implementations or failed lifecycle assertions.
- [ ] **Step 3: Implement capture ownership and manifests.** At this task `bench:calibrate` captures raw evidence and observable validation; Task 4 wires in offline analysis and final summaries so the task has no dependency on an unbuilt analyzer. Launch Playwright's pinned bundled Chromium with explicit headed/headless mode, viewport 1280×800 and scale 1. Record executable, browser version/revision and actual process launch arguments; use the installed browser metadata rather than guess revision from version. Record Git revision/dirty status, fixture and local asset SHA-256 hashes, adapter fault configuration, repetitions/order, cold empty profile/cache policy, OS/architecture, available CPU/GPU facts or explicit missing reasons. Load local assets before scored replay; make no startup performance claim.

Use one pinned CDP category set covering user timing/timeline, input, compositor/frame and V8/GC where supported; write exact configuration and collector version beside the raw JSON trace. Exclude screenshots and expensive profiles. Emit named page user-timing phase markers and retain trace completion metadata. Get supported heap/DOM CDP counters with units/scope at phase checkpoints, gracefully mark absent counters unavailable. Collect console exceptions, stream connection/disconnect state, receipt/applied/checkpoint observations and final probes. Capture finishes before full transcript validation, retention GC or disposal. All bounded cleanup runs in `finally`; a timeout is failure, never completion.
- [ ] **Step 4: Implement gestures, typing and retention diagnostics.** Start replay, drive composer keys while streaming, and bracket Event Timing observations. The scroll variant uses a fixed upward wheel gesture (400 CSS px requested distance at a documented fixed cadence/speed), then return-to-bottom. With tall fixed history verify actual scroll movement and identify a stable visible message before updates; capture its viewport offset after settling, with ≤2 CSS px drift. Reject boundaries/zero movement, and ensure anchor checkpoints overlap incoming updates. Tag synthetic gesture and auto-follow phases separately. Do not replace a failed gesture with a different workload.

Retention-release/retain each perform five resets and force GC through supported CDP only in the separate diagnostic phase. Capture baseline and post-reset snapshots (preserve both), parse the snapshot metadata schema rather than hard-coded edge indices, and identify reachable ArrayBuffer backing-store evidence associated with the module-owned retained Uint8Arrays. Document ownership paths and byte-accounting limitations. If the installed snapshot format cannot establish evidence, mark retained-buffer calibration unvalidated/unavailable. Do not require a 20 MiB `JSHeapUsedSize` change. Keep raw snapshots so later analyzer fixes can reproduce diagnostics offline.
- [ ] **Step 5: Add and run real-browser red/green acceptance.** Write `browser.test.ts` before adjusting behavior to pass it. Use one repetition per case to bound CI cost, real built assets, and the same runner APIs. At this task assert raw control transcript/completion, omitted text mismatch, producer ordered independent delivery, delayed checkpoint/backlog evidence, nonzero scroll movement and anchor tolerance, and saved retention snapshots. The runner records observable correctness violations in `validation.json`; Task 4 extends these tests to assert analyzer verdicts, delayed latency comparisons, snapshot reachability, and independent metric availability. Stall requires a matching 120 ms main-thread duration in LoAF or supported trace; if neither is supported, explicitly assert unvalidated status instead of asserting latency increased. Input entries absent below threshold must carry reasons.

Run `npx playwright install chromium`, then `npm run test:browser`. First execution must expose a missing calibration behavior; after fixes expect all browser checks to pass or documented capability branches to report unavailable. Use effect comparisons, not machine-specific FPS thresholds or fragile absolute scheduling assertions. Browser tests must inspect run validity as well as metric statuses.
- [ ] **Step 6: Verify runner units and headed capture evidence.** Repeat Step 2 command and `npm run typecheck`. Run `npm run bench:calibrate -- --mode headed --repetitions 1 --out artifacts`. Inspect a raw trace in Chrome DevTools for phase markers, renderer identity, gesture input, frame/presentation records, category support, and trace completeness; record exact environment/evidence and limitations in `docs/instrumentation.md`. If no headed display is available, record that limitation and keep presentation unvalidated; the final headless matrix still runs in Task 4.

### Task 4: Gate artifacts, analyze offline, and publish reproducible capability reports

**Files:** Create analyzer files from the boundary table and `packages/analyzer/src/{validate,metrics,trace,retention,report}.test.ts`; modify `README.md`; create `docs/instrumentation.md`; complete root scripts.

- [ ] **Step 1: Write artifact/metric red tests.** Use small hand-authored evidence fixtures with known answers. Reject fixture hash mismatch, duplicate send/receipt/application events, wrong final text, missing completion, wrong active ID, stream disconnect, console exceptions, incomplete phases, zero scroll and excessive anchor drift. Requested trace-derived metrics reject trace loss; optional missing instrumentation makes only its metric unavailable. Unknown schema/analyzer versions produce an explicit failed analysis rather than accepting fields opportunistically.

```ts
expect(producerLateness({ scheduledMs: 100, actualMs: 170 })).toBe(70);
expect(receiveToDom({ receivedMs: 20, observedMs: 95 })).toBe(75);
expect(() => elapsedBetween(producerPoint, pagePoint)).toThrow(/clock/);
expect(validateRun(omittedDeltaArtifacts).status).toBe('invalid');
expect(analyze(missingPresentationEvidence).scrollPresentation).toEqual({
  status: 'unavailable', reason: expect.any(String),
});
```

Test known mutation checkpoints satisfying multiple sequences, DOM backlog, unobserved Event Timing, supported/unsupported LoAF, heap/DOM units, retained versus released reachability, and incomplete snapshot format. Test no available scored values for invalid/failed samples; preserve individual failures in aggregates. Two offline analyses over the same input/version must have identical metrics after removing explicitly recorded generation timestamps. The analyzer must not depend on a running producer/reference/browser.
- [ ] **Step 2: Run red tests.** Run `npx vitest run packages/analyzer/src`. Expect missing implementations or intentionally failing correctness/availability assertions.
- [ ] **Step 3: Implement deterministic analysis and conservative trace capability.** Wire analysis into `bench:calibrate` after capture and extend Task 3's browser acceptance to check final analyzed results. Validate evidence before calculating numeric metrics. Use producer-domain send lateness only and page-domain receipt/checkpoint timing only; transport latency remains unavailable. Report each sample and median/range for valid comparable samples grouped by scenario, headed/headless mode and environment identity; retain failures and available-sample counts. Treat three repetitions as calibration only.

Default `scrollPresentation` to unavailable with a specific missing/unvalidated evidence reason. This milestone may ship in that state. Never derive FPS/jank from rAF, DOM mutation timestamps, or arbitrary trace event names. A numerical presentation implementation is permitted only after Task 3's headed inspection demonstrates a supported event/schema contract and DevTools cross-check. If implemented, isolate it in `trace.ts`, pin analyzer/query versions and any optional Trace Processor binary hash, add a golden raw trace plus missing-event/schema rejection tests, and document explicit optional installation instructions. If those conditions cannot be met, omit numerical presentation analysis entirely; there is no requirement to install Perfetto just to return unavailable. Stall duration diagnostics from verified main-thread trace events are independent of presentation.

Report `valid`, `invalid`, or `failed` per repetition with reasons; statuses must not treat unavailable optional metrics as run failure. Separate calibration conclusions from values: omission rejection, stall detection validated/unvalidated, delayed-display effect validated/unvalidated, retention support validated/unvalidated and scroll correctness. If retention snapshot evidence is absent, calibration must not claim retention measurement validated. CLI exits nonzero for incomplete/failed analysis; expected omission remains recorded invalid without making a successfully completed calibration invocation fail.
- [ ] **Step 4: Document real usage and capability limits.** Update README from design-stage wording to actual implemented capabilities, without claiming public smoothness readiness when presentation is unavailable. Link reproduction documentation and the approved spec; do not suggest Crossbench was implemented. Describe commands, build/browser installation, exact fault matrix and repetitions, phase timeouts, clock separation, cold policy, instrumentation overhead, Event Timing threshold, snapshot retention, raw artifact filenames, offline reanalysis, headed/headless separation, versions and trace capability checklist. State no rankings, total-memory claims, field INP claim or pixel-presentation claim for DOM latency. Optional unavailable fields need explicit reasons.
- [ ] **Step 5: Run green checks and full headless calibration.** Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:browser
npm run bench:calibrate -- --mode headless --repetitions 3 --out artifacts
```

Expect all unit/type/build/browser checks successful and a new invocation containing all 21 repetitions, including the three intentionally invalid omitted-delta runs. Controls and delayed/scroll runs have exact output; retention and stall reports reflect actual available evidence. Record command output and the artifact path in the delivery report, without committing generated runs.
- [ ] **Step 6: Prove offline reproducibility.** Set `ARTIFACT_DIR` to the exact path printed by Step 5, then run the commands below. `generatedAt` is the only permitted volatile report field; computation must not include clock-dependent values. Reanalysis must not rewrite raw capture evidence. Unit tests enforce the same comparison. Inspect Markdown for absent numeric values on unavailable metrics and invalid samples.

```bash
cp "$ARTIFACT_DIR/metrics.json" /private/tmp/chat-ui-bench-metrics-before.json
npm run bench:analyze -- --artifact-dir "$ARTIFACT_DIR"
npm run bench:analyze -- --artifact-dir "$ARTIFACT_DIR"
node --input-type=module -e 'import fs from "node:fs"; import assert from "node:assert/strict"; const strip = v => Array.isArray(v) ? v.map(strip) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "generatedAt").map(([k,x]) => [k,strip(x)])) : v; assert.deepEqual(strip(JSON.parse(fs.readFileSync(process.env.ARTIFACT_DIR + "/metrics.json", "utf8"))), strip(JSON.parse(fs.readFileSync("/private/tmp/chat-ui-bench-metrics-before.json", "utf8")))); console.log("Offline metrics identical");'
```

Export `ARTIFACT_DIR` when assigning it so the Node comparison receives it. Expect `Offline metrics identical` and exit 0.
- [ ] **Step 7: Review the final diff and acceptance evidence.** Run `git diff --check`, `git status --short`, and `git diff --stat`; verify outputs are ignored and lockfile included. Review every spec acceptance item against actual tests/artifacts. Parent worker performs required implementation/spec review and reports headed availability, presentation readiness, retention support, and any checks that could not run before deciding on one logical commit. Do not claim competitor comparison readiness.

## Completion evidence to hand back

Provide the exact commands/results, invocation artifact path, pinned dependency/browser identity, capability availability reasons, headed inspection findings or environment blocker, retention snapshot evidence/limits, and any outstanding acceptance failure. A successful milestone can have unavailable presentation metrics, but cannot have unacknowledged missing calibration evidence or guessed numbers.
