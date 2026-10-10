import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argumentsFor, artifactDirectory, externalOutput, inventory, assertEqual } from './artifact-checks.mjs';
import { phaseOracle, safeInteger, assertPhaseIdentities } from './presentation-oracle.mjs';

const expected = {
  product: 'Chrome/156.0.8078.4', revision: '@f842f52ef39fd97b449eb27cff414bf05a98ddce',
  frontendRevision: '2d671c506c4e5f8958b027e26047deb0acfbd7f9',
  resources: {
    'models/trace/trace.js': '9ac5c69d2a98606fdfe9c1118881f353c8e7389b3e24929468374b171c357488',
    'models/trace/handlers/handlers.js': '4315ac8bc6195af18e65a53fe1681ab4852fbf9e2aa5c41c2f88ff38b88ca072',
  },
};
const json = async path => JSON.parse(await readFile(path, 'utf8'));
let browser, directory, output, raw;
const report = { status: 'failed', expected, runs: [], errors: [], comparedPhases: 0, scoredPhases: 0 };
try {
  const args = argumentsFor(process.argv.slice(2), ['--artifact-dir', '--out']);
  directory = await artifactDirectory(args['--artifact-dir']);
  output = await externalOutput(directory, args['--out']);
  raw = await inventory(directory, 'raw');
  report.rawSHA256 = raw;
  const invocation = await json(join(directory, 'invocation.json'));
  if (!Array.isArray(invocation.order)) throw new Error('Missing invocation order');
  // This inspector is launched only after workload capture is finished.
  browser = await chromium.launch({ headless: false });
  const session = await browser.newBrowserCDPSession();
  try { report.browser = await session.send('Browser.getVersion'); } finally { await session.detach(); }
  assertEqual(report.browser.product, expected.product, 'Runtime Chromium version');
  assertEqual(report.browser.revision, expected.revision, 'Runtime Chromium revision');
  const page = await browser.newPage();
  await page.goto('devtools://devtools/bundled/inspector.html');
  const resources = await page.evaluate(async paths => {
    const result = {};
    for (const path of paths) {
      const response = await fetch(`devtools://devtools/bundled/${path}`);
      if (!response.ok) throw new Error(`Bundled resource ${path}: ${response.status}`);
      result[path] = Array.from(new Uint8Array(await response.arrayBuffer()));
    }
    return result;
  }, Object.keys(expected.resources));
  report.resourceSHA256 = Object.fromEntries(Object.entries(resources).map(([path, bytes]) => [path, createHash('sha256').update(Buffer.from(bytes)).digest('hex')]));
  assertEqual(report.resourceSHA256, expected.resources, 'Actual bundled frontend resources');
  report.frontendRevision = expected.frontendRevision; // Identified by the two exact matching compiled resources.
  // Infrastructure failure must be fatal even when every retained run is unscoreable.
  await page.evaluate(async () => {
    const Trace = await import('devtools://devtools/bundled/models/trace/trace.js');
    if (typeof Trace.TraceModel?.Model?.createWithAllHandlers !== 'function' || typeof Trace.Types?.Configuration?.defaults !== 'function') throw new Error('Bundled full TraceModel API unavailable');
    const handler = Trace.Handlers?.ModelHandlers?.AnimationFrames;
    for (const method of ['reset', 'handleUserConfig', 'handleEvent', 'finalize', 'data']) if (typeof handler?.[method] !== 'function') throw new Error(`Bundled AnimationFramesHandler API unavailable: ${method}`);
  });
  report.bundledImportStatus = 'verified';
  for (const entry of invocation.order) {
    if (typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(entry.id)) throw new Error('Unsafe repetition ID');
    const runDirectory = join(directory, 'repetitions', entry.id);
    const result = { id: entry.id, status: 'skipped', phases: [] };
    report.runs.push(result);
    let scoreable = false, loadedProduction = false;
    try {
      const production = await json(join(runDirectory, 'metrics.json'));
      loadedProduction = true;
      const presentation = production.metrics?.rendererPresentation;
      scoreable = production.validation?.status === 'valid' && presentation?.status === 'available';
      result.skippedReason = scoreable ? undefined : `Run ${production.validation?.status}; ${presentation?.reason ?? 'renderer capability unavailable'}`;
      const trace = await json(join(runDirectory, 'trace.json'));
      if (!Array.isArray(trace.traceEvents)) throw new Error('Missing traceEvents');
      const oracle = await page.evaluate(async events => {
        const Trace = await import('devtools://devtools/bundled/models/trace/trace.js');
        const model = Trace.TraceModel.Model.createWithAllHandlers({ ...Trace.Types.Configuration.defaults(), enableAnimationsFrameHandler: true });
        await model.parse(events, { yieldToMain: false });
        const parsed = model.parsedTrace();
        const meta = parsed.data.Meta;
        const processes = [...(meta.rendererProcessesByFrame.get(meta.mainFrameId) ?? new Map()).keys()];
        const pid = processes.length === 1 ? processes[0] : undefined;
        const mainThreads = [...(meta.threadsInProcess.get(pid) ?? new Map())].filter(([, event]) => event.args?.name === 'CrRendererMain');
        const tid = mainThreads.length === 1 ? mainThreads[0][0] : undefined;
        // Full-model parse resets this handler's config. Re-enable after reset.
        const handler = Trace.Handlers.ModelHandlers.AnimationFrames;
        handler.reset();
        handler.handleUserConfig({ ...Trace.Types.Configuration.defaults(), enableAnimationsFrameHandler: true });
        for (const event of events) handler.handleEvent(event);
        await handler.finalize();
        const data = handler.data();
        const pairs = data.animationFrames.map(frame => {
          const begin = frame.args.data.beginEvent;
          const feedback = data.presentationForFrame.get(frame);
          return { pid: frame.pid, tid: frame.tid, beginId: begin.args.id, beginTs: begin.ts, endTs: frame.ts + frame.dur, ...(feedback ? { feedbackId: feedback.args.id, feedbackTs: feedback.ts } : {}) };
        });
        return { target: { frameId: meta.mainFrameId, pid, tid }, mainFrameURL: meta.mainFrameURL, processCount: processes.length, mainThreadCount: mainThreads.length, wholeTracePairCount: pairs.length, wholeTraceNonPresentedPairCount: pairs.filter(p => p.feedbackTs === undefined).length, pairs, legacyFrames: { scope: 'legacy Frames handler, unscored', count: parsed.data.Frames.frames.length } };
      }, trace.traceEvents);
      result.oracle = oracle;
      result.parseStatus = 'parsed';
      if (!scoreable) continue;
      if (oracle.processCount !== 1 || oracle.mainThreadCount !== 1) throw new Error('Actual Meta does not resolve a unique renderer/main thread');
      safeInteger(oracle.target.pid, 'target PID'); safeInteger(oracle.target.tid, 'target TID');
      const evidence = await json(join(runDirectory, 'evidence.json'));
      assertEqual(oracle.target.frameId, evidence.trace.presentation.frameTree.frameTree.frame.id, 'Actual Meta frame identity');
      assertEqual(oracle.mainFrameURL, evidence.trace.presentation.appURL, 'Actual Meta URL');
      const targetPairs = oracle.pairs.filter(p => p.pid === oracle.target.pid && p.tid === oracle.target.tid);
      for (const pair of targetPairs) if (pair.feedbackTs !== undefined) assertEqual(pair.feedbackId, pair.beginId, 'Actual handler presentation args.id');
      result.targetPairCount = targetPairs.length;
      const observations = (await readFile(join(runDirectory, 'page-observations.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      const phaseMarks = observations.filter(o => o.kind === 'phase' && o.data?.startMark);
      assertPhaseIdentities(presentation.value.phases, phaseMarks);
      for (const phase of presentation.value.phases) {
        const identity = phaseMarks.find(p => p.data.instanceId === phase.instanceId);
        const mark = name => {
          const matches = trace.traceEvents.filter(e => e.name === name);
          if (matches.length !== 1) throw new Error(`Missing/duplicate raw phase mark ${name}`);
          assertEqual({ pid: matches[0].pid, tid: matches[0].tid }, { pid: oracle.target.pid, tid: oracle.target.tid }, 'Phase mark actual Meta thread');
          return safeInteger(matches[0].ts, 'phase mark');
        };
        const startUs = mark(identity.data.startMark), endUs = mark(identity.data.endMark);
        const calculated = phaseOracle(targetPairs, startUs, endUs);
        assertEqual(phase.target, oracle.target, 'Production target vs actual Meta');
        assertEqual([phase.startUs, phase.endUs, phase.durationUs], [startUs, endUs, calculated.denominatorUs], 'Production phase boundaries');
        assertEqual([phase.boundaryExcludedPairCount, phase.nonPresentedPairCount], [calculated.boundaryExcludedPairCount, calculated.nonPresentedPairCount], 'Production exclusions/non-presented counts');
        const fps = phase.rendererVisualUpdateFps, intervals = phase.presentationIntervals;
        if (calculated.distinctDeliveryCount) {
          if (fps.status !== 'available') throw new Error('Production FPS unavailable despite eligible actual handler feedback');
          assertEqual([fps.numerator, fps.denominatorUs], [calculated.distinctDeliveryCount, calculated.denominatorUs], 'Production numerator/full denominator');
          if (!Number.isFinite(fps.value) || Math.abs(fps.value - calculated.fps) > calculated.fps * 1e-12) throw new Error('Production FPS mismatch');
        } else if (fps.status !== 'unavailable') throw new Error('Production FPS available without eligible feedback');
        if (calculated.intervalsUs.length) {
          if (intervals.status !== 'available') throw new Error('Production intervals unavailable despite multiple deliveries');
          for (const field of ['timestampsUs', 'intervalsUs', 'median', 'p95', 'max']) assertEqual(intervals[field], calculated[field], `Production ${field}`);
        } else if (intervals.status !== 'unavailable') throw new Error('Production intervals available without multiple deliveries');
        result.phases.push({ phase: phase.phase, instanceId: phase.instanceId, startUs, endUs, ...calculated, status: 'matched' });
        report.comparedPhases++;
        if (calculated.distinctDeliveryCount) report.scoredPhases++;
      }
      result.status = 'matched';
    } catch (error) {
      result.error = error.message;
      if (scoreable || !loadedProduction) { result.status = 'failed'; report.errors.push(`${entry.id}: ${error.message}`); }
      else { result.parseStatus = 'error'; result.skippedReason ??= 'Malformed or missing retained evidence'; }
    }
  }
} catch (error) { report.errors.push(error.message); }
finally {
  if (browser) await browser.close().catch(error => report.errors.push(`Browser close: ${error.message}`));
  if (raw) try { assertEqual(await inventory(directory, 'raw'), raw, 'Raw inventory after bundled cross-check'); report.rawUnchanged = true; } catch (error) { report.errors.push(error.message); }
}
report.status = report.errors.length ? 'failed' : 'passed';
report.presentationValidation = report.scoredPhases ? { status: report.status, comparedPhaseCount: report.comparedPhases, availablePhaseCount: report.scoredPhases } : { status: 'unavailable', reason: 'No scoreable renderer presentation capability; raw preservation and mismatch checks do not validate FPS' };
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.status === 'passed' ? 'PASS' : 'FAIL'}: preservation/mismatch checks; ${report.scoredPhases} phases matched; presentation validation ${report.presentationValidation.status}; ${report.runs.filter(r => r.status === 'skipped').length} runs explicitly skipped; ${report.errors.join('; ')}${output ? ` Report: ${output}` : ''}`);
if (report.status === 'failed') process.exitCode = 1;
