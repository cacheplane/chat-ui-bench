import { CHROMIUM_PIN, PERFETTO_PIN } from './browser-frame-source-records.js';

/** Hand-authored normalized declarations; no runtime or normalization evidence. */
export function fixture(): any {
  return {
    origin: 'manual-synthetic-source-records-v1', chromiumPin: CHROMIUM_PIN,
    perfettoPin: PERFETTO_PIN, normalizationContract: 'normalized-source-v1',
    stateMapping: 'chrome-frame-reporter2-v1', normalizationEvidence: 'manual-synthetic-only',
    repetitions: [{
      id: 'r', traceNamespace: 'trace', clockDomain: 'ns', horizon: { startNs: '0', endNs: '500' },
      target: { pageSession: 'page', rootFrame: 'root', processIncarnation: 'renderer-1', hostId: '1', lifetimeId: 'doc' },
      phases: [{ id: 'A', startNs: '100', endNs: '200', clockDomain: 'ns' }, { id: 'B', startNs: '300', endNs: '400', clockDomain: 'ns' }],
      descriptors: [{ id: 'renderer', processIncarnation: 'renderer-1', clockId: 'clock' }, { id: 'viz', processIncarnation: 'viz-1', clockId: 'clock' }],
      clocks: [{ id: 'clock', normalizedDomain: 'ns', evidence: 'manual-synthetic-only' }],
      lifetimes: [{ id: 'doc', processIncarnation: 'renderer-1', startNs: '0', endNs: '500' }],
      lifecycleAuthority: { rootFrame: 'root', lifetimeId: 'doc', clockDomain: 'ns', startNs: '0', endNs: '500', noOmittedTransitions: true },
      pairs: [], records: [record('mapping', 'map', { pageSession: 'page', rootFrame: 'root', hostId: '1', ns: '1' })],
    }],
  };
}
export function record(kind: string, id: string, fields: Record<string, unknown>): any {
  const value = { kind, id, traceNamespace: 'trace', descriptorId: ['receive', 'aggregation', 'draw', 'swap'].includes(kind) ? 'viz' : 'renderer',
    processIncarnation: ['receive', 'aggregation', 'draw', 'swap'].includes(kind) ? 'viz-1' : 'renderer-1', clockId: 'clock', lifetimeId: 'doc', ...fields };
  return { ...value, source: { typed: true, location: `manual:${id}`, fields: Object.keys(fields) } };
}
export function operation(f: any, suffix = '1', attempt = '120', end = '150', state = 'presented_all'): void {
  const r = f.repetitions[0];
  r.pairs.push({ id: `report-pair-${suffix}`, kind: 'reporter', descriptorId: 'renderer', processIncarnation: 'renderer-1', clockId: 'clock', lifetimeId: 'doc', startNs: '80', endNs: end },
    { id: `aggregate-pair-${suffix}`, kind: 'aggregation', descriptorId: 'viz', processIncarnation: 'viz-1', clockId: 'clock', lifetimeId: 'doc', startNs: '70', endNs: attempt });
  r.records.push(record('reporter', `report-${suffix}`, { pairId: `report-pair-${suffix}`, hostId: '1', frameSource: '1', frameSequence: suffix, surfaceTraceId: suffix, displayTraceId: suffix, startNs: '80', endNs: end, state }),
    record('receive', `receive-${suffix}`, { surfaceTraceId: suffix, frameSinkClient: '1', frameSinkSink: '2', ns: '85' }),
    record('aggregation', `aggregate-${suffix}`, { pairId: `aggregate-pair-${suffix}`, displayTraceId: suffix, surfaceTraceIds: [suffix], startNs: '70', endNs: attempt }),
    record('draw', `draw-${suffix}`, { displayTraceId: suffix, ns: attempt }),
    record('swap', `swap-${suffix}`, { displayTraceId: suffix, ns: attempt }));
}
export function additionalReporter(f: any, id: string, end = '150', state = 'presented_all', extra: Record<string, unknown> = {}): void {
  const r = f.repetitions[0];
  r.pairs.push({ id: `report-pair-${id}`, kind: 'reporter', descriptorId: 'renderer', processIncarnation: 'renderer-1', clockId: 'clock', lifetimeId: 'doc', startNs: '80', endNs: end });
  r.records.push(record('reporter', `report-${id}`, { pairId: `report-pair-${id}`, hostId: '1', frameSource: '1', frameSequence: id, surfaceTraceId: '1', displayTraceId: '1', startNs: '80', endNs: end, state, ...extra }));
}
