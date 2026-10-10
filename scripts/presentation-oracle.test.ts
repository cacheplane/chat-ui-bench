import { expect, it } from 'vitest';
import { phaseOracle, assertPhaseIdentities } from './presentation-oracle.mjs';
it('rejects a production phase relabelled under the same raw ordinal', () => {
  const raw = [{ kind: 'phase', phase: 'streaming-auto-follow', data: { phase: 'composer-input', instanceId: '0', startMark: 'start', endMark: 'end' } }];
  expect(() => assertPhaseIdentities([{ phase: 'composer-input', instanceId: '0' }], raw)).toThrow('Scored phase identities and ordering');
  expect(() => assertPhaseIdentities([{ phase: 'streaming-auto-follow', instanceId: '0' }], raw)).not.toThrow();
});
it('uses full phase duration, both boundaries and distinct feedback from actual handler pairs', () => {
  const result = phaseOracle([{ beginTs: 10, feedbackTs: 20 }, { beginTs: 15, feedbackTs: 20 }, { beginTs: 30, feedbackTs: 40 }, { beginTs: 5, feedbackTs: 20 }, { beginTs: 50, feedbackTs: 100 }, { beginTs: 70 }], 10, 100);
  expect(result).toMatchObject({ eligiblePairCount: 3, distinctDeliveryCount: 2, coalescedPairCount: 1, boundaryExcludedPairCount: 2, nonPresentedPairCount: 1, denominatorUs: 90, timestampsUs: [20, 40], intervalsUs: [20], median: 20, p95: 20, max: 20 });
  expect(result.fps).toBe(2e6 / 90);
});
it('rejects unsafe timestamps and empty/reversed phase intervals', () => {
  expect(() => phaseOracle([], 0, 0)).toThrow();
  expect(() => phaseOracle([{ beginTs: 1, feedbackTs: Number.MAX_SAFE_INTEGER + 1 }], 0, 100)).toThrow();
});
it('reports absence as unavailable rather than zero FPS', () => {
  expect(phaseOracle([], 0, 100)).toMatchObject({ fps: null, fpsStatus: 'unavailable', fpsReason: expect.stringContaining('No eligible'), distinctDeliveryCount: 0 });
});
