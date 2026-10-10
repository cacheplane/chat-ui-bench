import { describe, expect, it } from 'vitest';
import { metricSchema, runMetricsSchema, observationSchema, validationSchema, manifestSchema, evidenceSchema, elapsedBetween } from './artifact.js';
import * as presentationContract from './presentation.js';
const metric = { status: 'available', value: 75, unit: 'ms', evidence: ['page-observations.jsonl'] };
const unavailable = { status: 'unavailable', reason: 'no feedback' };
const phasePresentation = {
  phase: 'streaming-auto-follow', instanceId: '1', startUs: 100, endUs: 1000100, durationUs: 1000000,
  target: { frameId: 'frame', pid: 12, tid: 13 }, boundaryExcludedPairCount: 0, nonPresentedPairCount: 0,
  rendererVisualUpdateFps: { status: 'available', value: 2, unit: 'updates/s', evidence: ['trace.json'], numerator: 2, denominatorUs: 1000000 },
  presentationIntervals: { status: 'available', timestampsUs: [200, 300], intervalsUs: [100], median: 100, p95: 100, max: 100, unit: 'us', evidence: ['trace.json'] },
};
const presentationRun = (phase: unknown = phasePresentation, status = 'valid') => ({ schemaVersion: 1, analyzerVersion: '1.1.0', status, metrics: {}, diagnostics: {}, rendererPresentation: { status: 'available', value: { scope: 'target renderer visual updates', phases: [phase] } } });
describe('renderer presentation contract', () => {
  it('applies relative FPS tolerance even below one update per second', () => {
    const denominatorUs = Number.MAX_SAFE_INTEGER;
    const expected = 1e6 / denominatorUs;
    const rate = { status: 'available', value: expected, unit: 'updates/s', evidence: ['trace.json'], numerator: 1, denominatorUs };
    expect(presentationContract.rendererVisualUpdateFpsSchema.parse(rate)).toEqual(rate);
    expect(presentationContract.rendererVisualUpdateFpsSchema.parse({ ...rate, value: expected * (1 + 5e-13) }).status).toBe('available');
    expect(() => presentationContract.rendererVisualUpdateFpsSchema.parse({ ...rate, value: expected + 5e-13 })).toThrow();
    expect(() => presentationContract.rendererVisualUpdateFpsSchema.parse({ ...rate, value: expected * (1 + 2e-12) })).toThrow();
    expect(presentationContract.rendererVisualUpdateFpsSchema.parse({ ...phasePresentation.rendererVisualUpdateFps, value: 2 * (1 + 5e-13) }).status).toBe('available');
    expect(() => presentationContract.rendererVisualUpdateFpsSchema.parse({ ...phasePresentation.rendererVisualUpdateFps, value: 2 * (1 + 2e-12) })).toThrow();
  });
  it('defines exact per-instance marks and supported raw capture version pairs', () => {
    expect(presentationContract.presentationPhaseMarks('1-clean', '3')).toEqual({ startMark: 'bench:1-clean:phase:3:start', endMark: 'bench:1-clean:phase:3:end' });
    expect(() => presentationContract.presentationPhaseMarks('', '3')).toThrow();
    expect(() => presentationContract.presentationPhaseMarks('1-clean', '03')).toThrow();
    expect(presentationContract.ACCEPTED_RAW_VERSION_PAIRS).toEqual([{ collectorVersion: '1.0.0', analyzerVersion: '1.0.0' }, { collectorVersion: '1.1.0', analyzerVersion: '1.1.0' }]);
  });
  it('accepts strict additive page-target evidence and unchanged legacy evidence', () => {
    const legacy = { schemaVersion: 1, collectorVersion: '1.0.0', files: {}, trace: { format: 'cdp-json', categories: ['devtools.timeline'], complete: true } };
    expect(evidenceSchema.parse(legacy)).toEqual(legacy);
    const presentation = { capability: 'rendererVisualUpdateFps', contractVersion: '1.1.0', sessionTarget: 'page', targetId: 'target', appURL: 'http://localhost/', frameTree: { frameTree: { frame: { id: 'frame', loaderId: 'loader', url: 'http://localhost/', domainAndRegistry: '', securityOrigin: 'http://localhost', mimeType: 'text/html', secureContextType: 'SecureLocalhost', crossOriginIsolatedContextType: 'NotIsolated', gatedAPIFeatures: [] } } }, frameTreeCapturePoint: 'before-tracing', isolatedBrowserProcess: true, singleWorkloadPage: true };
    expect(evidenceSchema.parse({ ...legacy, collectorVersion: '1.1.0', trace: { ...legacy.trace, presentation } }).trace?.presentation).toEqual(presentation);
    for (const patch of [{ targetId: '' }, { sessionTarget: 'browser' }, { frameTree: {} }, { unknown: true }]) expect(() => evidenceSchema.parse({ ...legacy, trace: { ...legacy.trace, presentation: { ...presentation, ...patch } } })).toThrow();
  });
  it('accepts scoped per-phase rates and intervals', () => {
    expect(runMetricsSchema.parse(presentationRun())).toEqual(presentationRun());
    expect(runMetricsSchema.parse({ ...presentationRun(), rendererPresentation: unavailable }).rendererPresentation).toEqual(unavailable);
  });
  it('accepts one delivery with unavailable intervals and zero delivery with both unavailable', () => {
    expect(runMetricsSchema.parse(presentationRun({ ...phasePresentation, rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, numerator: 1, value: 1 }, presentationIntervals: unavailable })).status).toBe('valid');
    expect(runMetricsSchema.parse(presentationRun({ ...phasePresentation, rendererVisualUpdateFps: unavailable, presentationIntervals: unavailable })).status).toBe('valid');
  });
  it.each(['invalid', 'failed'])('rejects nested scored values on %s runs', status => {
    expect(() => runMetricsSchema.parse(presentationRun(phasePresentation, status))).toThrow();
    expect(() => runMetricsSchema.parse(presentationRun({ ...phasePresentation, rendererVisualUpdateFps: unavailable }, status))).toThrow();
    expect(runMetricsSchema.parse(presentationRun({ ...phasePresentation, rendererVisualUpdateFps: unavailable, presentationIntervals: unavailable }, status)).status).toBe(status);
  });
  it('rejects malformed phase identity, arithmetic and interval evidence', () => {
    for (const patch of [{ instanceId: '01' }, { phase: 'setup' }, { target: { frameId: '', pid: 12, tid: 13 } }, { durationUs: 1 }, { rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, numerator: undefined } }, { rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, denominatorUs: undefined } }, { rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, numerator: 0 } }, { presentationIntervals: { ...phasePresentation.presentationIntervals, timestampsUs: [300, 200] } }, { presentationIntervals: { ...phasePresentation.presentationIntervals, p95: 101 } }]) expect(() => runMetricsSchema.parse(presentationRun({ ...phasePresentation, ...patch }))).toThrow();
  });
  it('rejects contradictory numbers, unsafe clocks, and duplicate instance identities', () => {
    for (const patch of [
      { startUs: Infinity }, { endUs: 99 }, { endUs: Number.MAX_SAFE_INTEGER + 1 },
      { target: { frameId: 'frame', pid: -1, tid: 13 } },
      { rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, value: 3 } },
      { rendererVisualUpdateFps: { ...phasePresentation.rendererVisualUpdateFps, denominatorUs: 2000000, value: 1 } },
      { presentationIntervals: { ...phasePresentation.presentationIntervals, intervalsUs: [101] } },
      { presentationIntervals: { ...phasePresentation.presentationIntervals, median: 101 } },
      { presentationIntervals: { ...phasePresentation.presentationIntervals, max: 101 } },
      { presentationIntervals: { ...phasePresentation.presentationIntervals, timestampsUs: [200, 200], intervalsUs: [0] } },
    ]) expect(() => runMetricsSchema.parse(presentationRun({ ...phasePresentation, ...patch }))).toThrow();
    expect(() => runMetricsSchema.parse({ ...presentationRun(), rendererPresentation: { status: 'available', value: { scope: 'target renderer visual updates', phases: [phasePresentation, phasePresentation] } } })).toThrow();
  });
});
describe('artifact correctness and availability contract', () => {
  it('requires explicit availability, units and evidence', () => {
    expect(metricSchema.parse(metric)).toEqual(metric);
    expect(metricSchema.parse({ status: 'unavailable', reason: 'unsupported' })).toEqual({ status: 'unavailable', reason: 'unsupported' });
    for (const v of [{ status: 'unavailable', value: 0 }, { status: 'unavailable', reason: 'no trace', value: 0 }, { status: 'unavailable', reason: '' }, { ...metric, evidence: [] }, { ...metric, value: NaN }]) expect(() => metricSchema.parse(v)).toThrow();
  });
  it.each(['invalid', 'failed'])('forbids scored values on %s runs, allowing explicitly unscored diagnostics', status => {
    expect(() => runMetricsSchema.parse({ schemaVersion: 1, analyzerVersion: '1', status, metrics: { latency: metric }, diagnostics: {} })).toThrow();
    expect(runMetricsSchema.parse({ schemaVersion: 1, analyzerVersion: '1', status, metrics: { latency: { status: 'unavailable', reason: 'invalid output' } }, diagnostics: { stall: { ...metric, scored: false } } }).status).toBe(status);
  });
  it('rejects unknown versions, clocks and phases on observations', () => {
    const o = { schemaVersion: 1, kind: 'receipt', clockDomain: 'page-performance-ms', repetition: '1-clean', phase: 'streaming-auto-follow', sequence: 2, timestampMs: 10, data: {} };
    expect(observationSchema.parse(o)).toEqual(o);
    for (const patch of [{ schemaVersion: 2 }, { clockDomain: 'wall-clock' }, { phase: 'streaming' }, { timestampMs: -1 }]) expect(() => observationSchema.parse({ ...o, ...patch })).toThrow();
  });
  it('only subtracts timestamps in the same clock domain', () => {
    const a = { clockDomain: 'producer-monotonic-ms' as const, timestampMs: 100 };
    expect(elapsedBetween(a, { ...a, timestampMs: 170 })).toBe(70);
    expect(() => elapsedBetween(a, { clockDomain: 'page-performance-ms', timestampMs: 170 })).toThrow(/clock/);
  });
  it('records validation outcomes and explicit failure reasons', () => {
    expect(validationSchema.parse({ schemaVersion: 1, status: 'invalid', reasons: ['wrong final text'], checks: { transcript: false } }).status).toBe('invalid');
    expect(() => validationSchema.parse({ schemaVersion: 1, status: 'failed', reasons: [], checks: {} })).toThrow();
  });
  it('versions raw evidence and requires trace configuration and completion state', () => {
    expect(evidenceSchema.parse({ schemaVersion: 1, collectorVersion: '1', files: { trace: 'trace.json' }, trace: { format: 'cdp-json', categories: ['devtools.timeline'], complete: false, lossReason: 'timeout' } }).trace?.complete).toBe(false);
    expect(() => evidenceSchema.parse({ schemaVersion: 2 })).toThrow();
  });
  it('requires reproducible browser, asset, environment and cold-policy identity', () => {
    const m = {
      schemaVersion: 1, suiteVersion: '0.1.0', analyzerVersion: '1', collectorVersion: '1', repetition: '1-clean', scenarioId: 'calibration-v1',
      git: { revision: 'abc', dirty: false }, fixture: { sha256: 'a'.repeat(64), file: 'fixture.json' }, assets: { 'index.html': 'b'.repeat(64) },
      browser: { executable: '/chromium', version: '1', revision: '123', flags: ['--headless'] },
      environment: { os: 'darwin', architecture: 'arm64', cpu: { status: 'available', value: 'chip' }, gpu: { status: 'unavailable', reason: 'not exposed' } },
      adapter: { id: 'reference', configuration: { fault: 'clean' } }, configuration: { repetitions: 3, order: ['clean'] },
      mode: 'headless', viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded',
    };
    expect(manifestSchema.parse(m)).toEqual(m);
    expect(() => manifestSchema.parse({ ...m, browser: { ...m.browser, flags: undefined } })).toThrow();
    expect(() => manifestSchema.parse({ ...m, environment: { ...m.environment, gpu: { status: 'unavailable' } } })).toThrow();
  });
});
