import { describe, expect, it } from 'vitest';
import { metricSchema, runMetricsSchema, observationSchema, validationSchema, manifestSchema, evidenceSchema, elapsedBetween } from './artifact.js';
const metric = { status: 'available', value: 75, unit: 'ms', evidence: ['page-observations.jsonl'] };
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
