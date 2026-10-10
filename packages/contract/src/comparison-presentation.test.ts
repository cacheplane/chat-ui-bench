import { describe, expect, it } from 'vitest';
import * as contract from './index.js';
const phase = () => ({phase: 'streaming-follow', instanceId: '0', startMark: 'bench:comparison:streaming-follow:0:start', endMark: 'bench:comparison:streaming-follow:0:end', startUs: 0, endUs: 1000000, durationUs: 1000000, target: {frameId: 'f', pid: 1, tid: 2}, boundaryExcludedPairCount: 0, nonPresentedPairCount: 0, rendererVisualUpdateFps: {status: 'available', value: 2, unit: 'updates/s', evidence: ['trace.json'], numerator: 2, denominatorUs: 1000000}, presentationIntervals: {status: 'available', timestampsUs: [100000, 600000], intervalsUs: [500000], median: 500000, p95: 500000, max: 500000, unit: 'us', evidence: ['trace.json']}});
describe('separate v2 presentation envelopes around existing FPS arithmetic', () => {
  it('accepts v2 marks and rejects renamed legacy phases', () => {
    expect(contract.comparisonRendererPresentationPhaseSchema).toBeDefined();
    expect(contract.comparisonRendererPresentationPhaseSchema.safeParse(phase()).success).toBe(true);
    for (const name of ['streaming-auto-follow', 'gesture-scroll', 'return-to-bottom']) expect(contract.comparisonRendererPresentationPhaseSchema.safeParse({...phase(), phase: name}).success).toBe(false);
    expect(contract.comparisonRendererPresentationPhaseSchema.safeParse({...phase(), startMark: 'bench:r:phase:0:start'}).success).toBe(false);
    expect(contract.comparisonPresentationPhaseInputSchema.safeParse({phase: phase().phase, instanceId: '0', startMark: phase().startMark, endMark: phase().endMark}).success).toBe(true);
    expect(() => contract.comparisonPhaseMarks('invented-phase', '0')).toThrow();
  });
  it('uses full-phase denominator, exact interval feedback, and exclusive boundaries', () => {
    expect(contract.comparisonRendererPresentationPhaseSchema).toBeDefined();
    for (const patch of [{durationUs: 500000}, {rendererVisualUpdateFps: {...phase().rendererVisualUpdateFps, value: 4, denominatorUs: 500000}}, {presentationIntervals: {...phase().presentationIntervals, max: 1}}, {presentationIntervals: {...phase().presentationIntervals, timestampsUs: [500000, 1000000]}}, {rendererVisualUpdateFps: {...phase().rendererVisualUpdateFps, numerator: 3, value: 3}}, {presentationIntervals: {status: 'unavailable', reason: 'missing'}}, {endUs: Number.MAX_SAFE_INTEGER + 1}]) expect(contract.comparisonRendererPresentationPhaseSchema.safeParse({...phase(), ...patch}).success).toBe(false);
  });
  it('keeps repeated instances chronological, unique and nonoverlapping', () => {
    expect(contract.comparisonRendererPresentationSchema).toBeDefined();
    const next = {...phase(), instanceId: '1', startMark: 'bench:comparison:streaming-follow:1:start', endMark: 'bench:comparison:streaming-follow:1:end', startUs: 1000000, endUs: 2000000, presentationIntervals: {...phase().presentationIntervals, timestampsUs: [1100000, 1600000]}};
    const parent = {capability: contract.PRESENTATION_CAPABILITY, contractVersion: contract.PRESENTATION_CONTRACT_VERSION, status: 'available', value: {scope: 'target renderer visual updates', phases: [phase(), next]}};
    expect(contract.comparisonRendererPresentationSchema.safeParse(parent).success).toBe(true);
    for (const phases of [[phase(), phase()], [next, phase()], [phase(), {...next, startUs: 999999, durationUs: 1000001}]]) expect(contract.comparisonRendererPresentationSchema.safeParse({...parent, value: {...parent.value, phases}}).success).toBe(false);
    expect(contract.comparisonRendererPresentationSchema.safeParse({status: 'unavailable', reason: 'unsupported topology'}).success).toBe(true);
  });
});
