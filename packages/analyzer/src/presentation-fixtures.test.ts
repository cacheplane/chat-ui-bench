import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadPresentationFixture, presentationFixtures, presentationGoldenIndex, presentationIntervalGoldenIndex, readPresentationFixtureBytes } from './presentation-fixtures.test-helper.js';

describe('authentic renderer presentation fixture integrity', () => {
  it('pins the copied golden index bytes and matching source revisions', () => {
    expect(createHash('sha256').update(readPresentationFixtureBytes('reduced-golden.json')).digest('hex')).toBe('62e3e14c3f273fdd205f6c7c43b5ea6b91df6f853ece7d19823ef224c93c3fff');
    expect(presentationGoldenIndex.browserRevision).toBe('f842f52ef39fd97b449eb27cff414bf05a98ddce');
    expect(presentationGoldenIndex.frontendRevision).toBe('2d671c506c4e5f8958b027e26047deb0acfbd7f9');
    expect(presentationFixtures.map(c => c.expectedFromActualBundledHandler.presentationPairs)).toEqual([300, 285, 299, 287, 299, 288]);
    expect(presentationFixtures.map(c => c.expectedPhaseAnalysis.identityChecks.pairs)).toEqual([295, 281, 294, 283, 295, 284]);
    expect(presentationFixtures.map(c => c.expectedPhaseAnalysis.distinctPresentationTimestamps)).toEqual([292, 269, 278, 265, 268, 260]);
  });
  it.each(presentationFixtures)('$name retains declared original indices and unchanged reduced bytes', golden => {
    expect(createHash('sha256').update(readPresentationFixtureBytes(golden.file)).digest('hex')).toBe(golden.reducedFileSha256);
    expect(golden.sourceEventIndices.length).toBe(golden.eventCount);
    expect(loadPresentationFixture(golden).traceEvents.length).toBe(golden.eventCount);
    expect(new Set(golden.sourceEventIndices).size).toBe(golden.eventCount);
    expect(golden.sourceEventIndices.every((index, i, indices) => Number.isSafeInteger(index) && index >= 0 && (i === 0 || index > indices[i - 1]!))).toBe(true);
    expect(golden.fullTraceSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('preserves independently derived bundled-handler interval goldens', () => {
    expect(createHash('sha256').update(readPresentationFixtureBytes('interval-golden.json')).digest('hex')).toBe('bce7e38970d6b2105851967b9c7b14087cf05b5753eb947925422cd5efef15ff');
    expect(presentationIntervalGoldenIndex.cases.map(c => [c.medianUs, c.p95Us, c.maxUs])).toEqual([[8333, 8334, 16666], [8333, 16666, 116664], [8333, 16666, 16667], [8333, 16666, 108331], [8333, 16666, 16667], [8333, 16666, 116664]]);
    for (const c of presentationIntervalGoldenIndex.cases) {
      expect(c.timestampsUs.length).toBe(c.distinctDeliveries);
      expect(c.intervalsUs.length).toBe(c.intervalCount);
      expect(c.timestampsUs.slice(1).map((t, i) => t - c.timestampsUs[i]!)).toEqual(c.intervalsUs);
    }
  });
});
