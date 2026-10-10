import { readFileSync } from 'node:fs';
export const presentationFixtureDirectory = new URL('./fixtures/renderer-presentation/', import.meta.url);
export interface PresentationTraceEvent { name: string; ph: string; ts: number; pid: number; tid: number; args?: Record<string, any>; [key: string]: any }
export interface PresentationFixtureGolden {
  name: string; file: string; fullTraceSha256: string; reducedFileSha256: string; sourceEventIndices: number[]; eventCount: number;
  expectedFromActualBundledHandler: { animationCount: number; presentationPairs: number; mainFrameId: string };
  expectedPhaseAnalysis: { phase: { startUs: number; endUs: number; durationUs: number }; identityChecks: { mismatches: number; targetPid: number; uniquePairedIds: number; pairs: number }; distinctPresentationTimestamps: number; rendererVisualUpdateFPS: number; largestPresentationInterval: { fromUs: number; toUs: number; intervalUs: number } };
}
export interface PresentationIntervalGolden { name: string; eligiblePairs: number; distinctDeliveries: number; targetTid: number; medianUs: number; p95Us: number; maxUs: number; intervalCount: number; timestampsUs: number[]; intervalsUs: number[] }
export function readPresentationFixtureBytes(file: string): Buffer { return readFileSync(new URL(file, presentationFixtureDirectory)); }
export const presentationGoldenIndex = JSON.parse(readPresentationFixtureBytes('reduced-golden.json').toString()) as { schemaVersion: number; browserRevision: string; frontendRevision: string; cases: PresentationFixtureGolden[] };
export const presentationIntervalGoldenIndex = JSON.parse(readPresentationFixtureBytes('interval-golden.json').toString()) as { source: string; sourceSha256: string; derivation: string; cases: PresentationIntervalGolden[] };
export function loadPresentationFixture(golden: PresentationFixtureGolden): { traceEvents: PresentationTraceEvent[]; [key: string]: unknown } {
  return JSON.parse(readPresentationFixtureBytes(golden.file).toString());
}
export const presentationFixtures = presentationGoldenIndex.cases;
