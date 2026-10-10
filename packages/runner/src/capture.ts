import { open } from 'node:fs/promises';
import { join } from 'node:path';
import type { Browser, CDPSession, Page } from 'playwright';
import { canonicalSerialize, manifestSchema, evidenceSchema, type Fixture, type Observation, type Phase, type TranscriptMessage, type Validation } from '@chat-ui-bench/contract';
import type { ReplayServer } from '@chat-ui-bench/producer';
import type { ArtifactWriter } from './artifacts.js';
import { collectEnvironment, sha256 } from './environment.js';
import { collectRetention } from './retention.js';
import type { Variant } from './calibrate.js';
import { withDeadline, errorMessage } from './calibrate.js';
export const TRACE_CATEGORIES = ['blink.user_timing', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'input', 'latencyInfo', 'cc', 'viz', 'benchmark', 'v8', 'v8.execute', 'disabled-by-default-v8.gc'] as const;
interface TraceComplete { stream?: string; dataLossOccurred?: boolean }
export interface TraceSession {
  once(event: 'Tracing.tracingComplete', callback: (event: TraceComplete) => void): unknown;
  off(event: 'Tracing.tracingComplete', callback: (event: TraceComplete) => void): unknown;
  send(method: string, parameters?: Record<string, unknown>): Promise<any>;
}

interface PageAPI {
  ready: boolean;
  configure(value: { repetition: string; fault: string }): void;
  loadHistory(history: Fixture['history']): void;
  connectReplay(url: string): void;
  setPhase(phase: Phase): void;
  returnToBottom(): void; resetThread(): void; dispose(): void; drainObservations(): Observation[];
  probes: { transcript: TranscriptMessage[]; activeMessageId: string | null; lastAppliedSequence: number | null };
  replayState: string; autoFollow: boolean;
}
declare global { interface Window { chatBench: PageAPI } }
const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
async function counters(session: CDPSession) {
  let heap; let dom;
  try { heap = { status: 'available', value: await session.send('Runtime.getHeapUsage'), unit: 'bytes', scope: 'renderer V8 heap; excludes total browser memory' }; }
  catch (error) { heap = { status: 'unavailable', reason: String(error) }; }
  try { dom = { status: 'available', value: await session.send('Memory.getDOMCounters'), unit: 'count', scope: 'renderer documents, nodes, and JS event listeners' }; }
  catch (error) { dom = { status: 'unavailable', reason: String(error) }; }
  return { heap, dom };
}
async function snapshot(session: CDPSession, writer: ArtifactWriter, name: 'baseline' | 'post'): Promise<string> {
  const file = `${name}.heapsnapshot`; const handle = await open(join(writer.directory, file), 'w');
  let writes = Promise.resolve();
  const chunk = (event: { chunk: string }): void => { writes = writes.then(async () => { await handle.writeFile(event.chunk); }); };
  session.on('HeapProfiler.addHeapSnapshotChunk', chunk);
  try { await withDeadline(session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }), 10000, `${name} heap snapshot`); await writes; await handle.sync(); }
  finally { session.off('HeapProfiler.addHeapSnapshotChunk', chunk); await writes.catch(() => {}); await handle.close(); }
  return file;
}
async function setPhase(page: Page, phase: Phase): Promise<void> { await page.evaluate(phase => window.chatBench.setPhase(phase), phase); }
export function matchingStallObservation(observations: readonly Observation[]): Observation | undefined {
  const fault = observations.find(entry => entry.kind === 'fault-stall');
  return fault && observations.find(entry => entry.kind === 'long-animation-frame' && Number(entry.data.duration) >= 120 && entry.timestampMs <= fault.timestampMs && entry.timestampMs + Number(entry.data.duration) >= fault.timestampMs + Number(fault.data.durationMs) - 1);
}
async function scrollState(page: Page, anchorId?: string) {
  return page.evaluate(id => {
    const scroller = document.querySelector<HTMLElement>('[data-testid="chat-scroll"]')!;
    const bounds = scroller.getBoundingClientRect();
    const anchor = id ? scroller.querySelector<HTMLElement>(`[data-message-id="${id}"]`) : [...scroller.querySelectorAll<HTMLElement>('[data-message-id^="history-"]')].find(node => { const rect = node.getBoundingClientRect(); return rect.top >= bounds.top && rect.top < bounds.bottom; });
    return { timestampMs: performance.now(), sequence: window.chatBench.probes.lastAppliedSequence, scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, anchorId: anchor?.dataset.messageId ?? null, anchorOffsetCssPx: anchor ? anchor.getBoundingClientRect().top - bounds.top : null, autoFollow: window.chatBench.autoFollow };
  }, anchorId);
}
async function gesture(page: Page) {
  await setPhase(page, 'gesture-scroll');
  const initial = await scrollState(page);
  const bounds = await page.locator('[data-testid="chat-scroll"]').boundingBox();
  if (!bounds) throw new Error('Scroll container is not visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -100); await wait(50); }
  await wait(200); const before = await scrollState(page);
  if (!before.anchorId) throw new Error('Scroll gesture did not expose a visible historical message');
  await wait(800); const after = await scrollState(page, before.anchorId);
  await setPhase(page, 'return-to-bottom'); await page.evaluate(() => window.chatBench.returnToBottom());
  const returned = await scrollState(page); await setPhase(page, 'streaming-auto-follow');
  return {
    initial, before, after, returned, movementCssPx: initial.scrollTop - before.scrollTop,
    anchorDriftCssPx: before.anchorOffsetCssPx === null || after.anchorOffsetCssPx === null ? null : Math.abs(after.anchorOffsetCssPx - before.anchorOffsetCssPx),
    followDisabled: !before.autoFollow, followRearmed: returned.autoFollow,
    gesture: { direction: 'up', distanceCssPx: 400, wheelDeltaCssPx: -100, wheelCount: 4, intervalMs: 50, settlingMs: 200, anchorObservationMs: 800 },
  };
}
export interface CaptureOptions {
  browser: Browser; server: ReplayServer; writer: ArtifactWriter; fixture: Fixture;
  run: { id: string; round: number; variant: Variant }; mode: 'headed' | 'headless'; root: string; assetDirectory: string; assetURL: string;
  setupRemainingMs: number; registerDisposal(callback: () => Promise<void>): void;
}
export async function captureRepetition(options: CaptureOptions): Promise<Validation> {
  const { browser, server, writer, fixture, run } = options;
  const setupDeadline = Date.now() + options.setupRemainingMs;
  const withinSetup = <T>(operation: Promise<T>): Promise<T> => withDeadline(operation, Math.max(1, setupDeadline - Date.now()), 'setup');
  const fixtureJSON = canonicalSerialize(fixture); await writer.text('fixture.json', fixtureJSON);
  const browserSession = await withinSetup(browser.newBrowserCDPSession());
  const environment = await withinSetup(collectEnvironment(options.root, options.assetDirectory, browserSession));
  const fault = run.variant === 'omitted-delta' ? 'omit' : run.variant;
  const manifest = manifestSchema.parse({
    schemaVersion: 1, suiteVersion: '0.1.0', analyzerVersion: '1.0.0', collectorVersion: '1.0.0', repetition: run.id, scenarioId: fixture.scenarioId,
    git: environment.git, assets: environment.assets, browser: environment.browser, environment: environment.environment,
    fixture: { sha256: sha256(fixtureJSON), file: 'fixture.json' }, adapter: { id: 'reference', configuration: { repetition: run.id, fault } },
    configuration: { variant: run.variant, round: run.round, chromiumDownloadRevision: environment.chromiumDownloadRevision, playwrightVersion: environment.playwrightVersion, browserProtocol: environment.browserProtocol, setupTimeoutMs: 10000, replayTimeoutMs: 30000, disposalTimeoutMs: 10000, ordering: 'interleaved-by-round', coldPolicy: 'fresh Playwright browser process and temporary empty profile per repetition; local assets loaded before measurement' },
    mode: options.mode, viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded',
  });
  await writer.json('manifest.json', manifest);
  const files: Record<string, string> = { manifest: 'manifest.json', fixture: 'fixture.json', producer: 'producer-events.jsonl', page: 'page-observations.jsonl', trace: 'trace.json', checkpoints: 'checkpoints.json', finalProbes: 'final-probes.json', validation: 'validation.json', calibration: 'calibration.json', exceptions: 'exceptions.json' };
  let trace: TraceEvidence = { complete: false, lossReason: 'Capture has not completed' };
  const writeEvidence = async (): Promise<void> => { await writer.json('evidence.json', evidenceSchema.parse({ schemaVersion: 1, collectorVersion: '1.0.0', files, trace: { format: 'cdp-json', categories: [...TRACE_CATEGORIES], ...trace } })); };
  await writer.text('trace.json', ''); await writeEvidence();
  const context = await withinSetup(browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }));
  const page = await withinSetup(context.newPage()); const renderer = await withinSetup(context.newCDPSession(page));
  const exceptions: { kind: string; message: string }[] = [];
  page.on('pageerror', error => { exceptions.push({ kind: 'pageerror', message: error.message }); });
  page.on('console', message => { if (message.type() === 'error') exceptions.push({ kind: 'console-error', message: message.text() }); });
  const allProducer: Observation[] = []; const allPage: Observation[] = [];
  const drain = async (): Promise<void> => {
    const producer = server.drain(); allProducer.push(...producer); await writer.append('producer-events.jsonl', producer);
    const observations = await withDeadline(page.evaluate(() => window.chatBench.drainObservations()), 1000, 'page log collection'); allPage.push(...observations); await writer.append('page-observations.jsonl', observations);
  };
  let configured = false; let tracing = false; let captureError: unknown;
  options.registerDisposal(async () => {
    if (configured) {
      try { await page.evaluate(() => window.chatBench.dispose()); await drain(); }
      catch (error) { await writer.json('page-disposal-error.json', { reason: errorMessage(error) }); throw error; }
      finally { await writer.json('exceptions.json', exceptions); }
    }
  });
  const captured: { scroll: Awaited<ReturnType<typeof gesture>> | null } = { scroll: null };
  const checkpoints: Record<string, unknown> = {};
  try {
    await withDeadline((async () => {
      await page.goto(options.assetURL, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForFunction(() => window.chatBench?.ready === true, undefined, { timeout: 10000 });
      await page.evaluate(({ repetition, fault, history }) => { window.chatBench.configure({ repetition, fault }); window.chatBench.setPhase('setup'); window.chatBench.loadHistory(history); }, { repetition: run.id, fault, history: fixture.history });
      configured = true;
    })(), Math.max(1, setupDeadline - Date.now()), 'page setup');
    checkpoints.setup = await withinSetup(counters(renderer)); await withinSetup(drain());
    await withinSetup(browserSession.send('Tracing.start', { categories: TRACE_CATEGORIES.join(','), transferMode: 'ReturnAsStream', streamFormat: 'json' })); tracing = true;
    await withDeadline((async () => {
      await setPhase(page, 'streaming-auto-follow');
      await page.evaluate(url => window.chatBench.connectReplay(url), server.url);
      let inputDone = false; let scrollDone = false;
      while (true) {
        await drain();
        const state = await page.evaluate(() => ({ state: window.chatBench.replayState, sequence: window.chatBench.probes.lastAppliedSequence }));
        if (state.state === 'failed') throw new Error('Page replay failed; inspect page-observations.jsonl');
        if (server.state === 'failed') throw new Error('Producer replay failed; inspect producer-events.jsonl');
        if (state.state === 'complete') break;
        if (!inputDone && (state.sequence ?? -1) >= 10) {
          await setPhase(page, 'composer-input'); await page.locator('[data-testid="composer"]').pressSequentially('calibrate', { delay: 35 });
          await setPhase(page, 'streaming-auto-follow'); inputDone = true;
        }
        if (run.variant === 'scroll' && !scrollDone && (state.sequence ?? -1) >= 25) { captured.scroll = await gesture(page); scrollDone = true; }
        await wait(50);
      }
      // Allow buffered PerformanceObserver delivery, without any full transcript read.
      await wait(200); await drain(); checkpoints.streamingEnd = await counters(renderer);
    })(), 30000, 'replay');
  } catch (error) { captureError = error; }
  finally {
    if (configured) { try { await drain(); } catch (error) { captureError ??= error; } }
    if (tracing) { trace = await finishTrace(browserSession, join(writer.directory, 'trace.json')); tracing = false; }
    await writeEvidence();
  }
  try {
    if (captureError) throw captureError;
    if (!trace.complete) throw new Error(`Trace collection failed: ${trace.lossReason}`);
    // Scored trace has ended before full transcript validation and retention diagnostics.
    await setPhase(page, 'validation');
    const final = await page.evaluate(() => ({ transcript: window.chatBench.probes.transcript, activeMessageId: window.chatBench.probes.activeMessageId, lastAppliedSequence: window.chatBench.probes.lastAppliedSequence, replayState: window.chatBench.replayState, autoFollow: window.chatBench.autoFollow, displayedText: document.querySelector('[data-testid="active-response"]')?.textContent ?? null }));
    await writer.json('final-probes.json', final);
    const responseID = fixture.events[0]!.messageId;
    const text = fixture.events.filter(event => event.type === 'text-delta').map(event => event.text).join('');
    const expected = [...fixture.history, { id: responseID, role: 'assistant', status: 'complete', text }];
    const scroll = captured.scroll;
    const sends = allProducer.filter(entry => entry.kind === 'producer-send');
    const checks: Record<string, boolean> = {
      transcriptExact: canonicalSerialize(final.transcript) === canonicalSerialize(expected), displayedTextExact: final.displayedText === text,
      complete: final.replayState === 'complete' && final.activeMessageId === null && final.lastAppliedSequence === fixture.events.at(-1)!.sequence,
      producerOrdered: sends.length === fixture.events.length && sends.every((entry, index) => entry.sequence === fixture.events[index]!.sequence),
      noConsoleExceptions: exceptions.length === 0, noReplayFailure: !allPage.some(entry => entry.kind === 'replay-failure'), traceComplete: trace.complete,
    };
    if (run.variant === 'scroll') {
      checks.scrollMoved = !!scroll && scroll.movementCssPx >= 350 && scroll.movementCssPx <= 450;
      checks.anchorStable = !!scroll && scroll.anchorDriftCssPx !== null && scroll.anchorDriftCssPx <= 2;
      checks.updatesOverlapAnchor = !!scroll && (scroll.after.sequence ?? -1) > (scroll.before.sequence ?? -1);
      checks.autoFollowPausedAndRearmed = !!scroll?.followDisabled && !!scroll.followRearmed;
    }
    const matchingLoaf = matchingStallObservation(allPage);
    const input = allPage.filter(entry => entry.kind === 'event-timing' && entry.phase === 'composer-input');
    const calibration = {
      stall: run.variant !== 'stall' ? { status: 'not-requested' } : matchingLoaf ? { status: 'validated', source: 'long-animation-frame', timestampMs: matchingLoaf.timestampMs, durationMs: matchingLoaf.data.duration } : { status: 'unvalidated', reason: 'No matching Long Animation Frame entry; raw main-thread trace requires independent offline inspection' },
      input: input.length ? { status: 'available', entryCount: input.length, evidence: 'page-observations.jsonl' } : { status: 'unavailable', reason: 'No observed composer Event Timing entries; unsupported or below the accepted 16ms threshold, never zero latency' },
      presentation: { status: 'unavailable', reason: 'Raw trace frame/presentation contract has not been validated against headed DevTools; no presentation metrics computed' },
    };
    if (run.variant === 'delayed-display') {
      checks.delayedDisplayObserved = allPage.some(entry => entry.kind === 'dom-checkpoint' && entry.timestampMs - Number(entry.data.receiptMs) >= 100);
      checks.backlogObserved = allPage.some(entry => entry.kind === 'dom-backlog' && Number(entry.data.backlog) >= 3);
    }
    if (run.variant.startsWith('retention-')) {
      const retention = await collectRetention({ setPhase: () => withDeadline(setPhase(page, 'retention'), 10000, 'retention phase setup'), gc: async () => { await withDeadline(renderer.send('HeapProfiler.collectGarbage'), 10000, 'retention GC'); }, snapshot: name => snapshot(renderer, writer, name), reset: async () => { await withDeadline(page.evaluate(() => window.chatBench.resetThread()), 10000, 'retention reset'); } });
      await writer.json('retention.json', retention);
      files.retention = 'retention.json';
      if (retention.status === 'available') { files.baseline = retention.value.baseline; files.post = retention.value.post; }
    }
    checkpoints.scroll = scroll; await writer.json('checkpoints.json', checkpoints); await writer.json('calibration.json', calibration);
    await drain();
    const reasons = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => `Validation failed: ${name}`);
    return { schemaVersion: 1, status: reasons.length ? 'invalid' : 'valid', reasons, checks };
  } catch (error) { captureError = error; throw error; }
  finally {
    await writer.json('exceptions.json', exceptions);
    await writer.json('checkpoints.json', { ...checkpoints, scroll: captured.scroll });
    await writeEvidence();
  }
}
export interface TraceEvidence { complete: boolean; lossReason?: string }
export async function finishTrace(session: TraceSession, path: string, deadlineMs = 10000): Promise<TraceEvidence> {
  const handle = await open(path, 'w'); let stream: string | undefined; let listener!: (event: TraceComplete) => void;
  let result: TraceEvidence = { complete: false, lossReason: 'Trace collection has not completed' };
  try {
    const completion = new Promise<TraceComplete>(resolve => { listener = resolve; session.once('Tracing.tracingComplete', listener); });
    result = await withDeadline((async () => {
      await session.send('Tracing.end'); const event = await completion; stream = event.stream;
      if (!stream) throw new Error('Tracing.tracingComplete omitted stream');
      while (true) {
        const chunk = await session.send('IO.read', { handle: stream });
        if (chunk.data) { await handle.writeFile(chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data); await handle.sync(); }
        if (chunk.eof) break;
      }
      return event.dataLossOccurred ? { complete: false, lossReason: 'CDP reported trace data loss' } : { complete: true };
    })(), deadlineMs, 'trace completion');
  } catch (error) { result = { complete: false, lossReason: errorMessage(error) }; }
  finally {
    if (listener) session.off('Tracing.tracingComplete', listener);
    if (stream) { try { await withDeadline(session.send('IO.close', { handle: stream }), 1000, 'trace stream close'); } catch (error) { result = { complete: false, lossReason: [result.lossReason, `Trace stream close: ${errorMessage(error)}`].filter(Boolean).join('; ') }; } }
    await handle.close();
  }
  return result;
}
