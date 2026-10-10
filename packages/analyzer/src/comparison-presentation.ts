import { comparisonArtifactPathSchema, comparisonPresentationPhaseInputSchema, comparisonRendererPresentationSchema, PRESENTATION_CAPABILITY, PRESENTATION_CONTRACT_VERSION, type ComparisonPresentationPhaseInput, type ComparisonRendererPresentation, type ComparisonScoredPresentationPhase } from '@chat-ui-bench/contract';
import { parsePresentationCore, type PresentationCoreDiagnostics } from './presentation-core.js';

export interface ComparisonRendererPresentationInput {
  trace: unknown;
  target: {appURL: string; frameId: string};
  phases: ComparisonPresentationPhaseInput[];
  /** Caller-supplied raw evidence paths. Filesystem/hash provenance gates belong to the artifact loader. */
  evidencePaths: string[];
}
export type ComparisonPresentationPairDiagnostics = PresentationCoreDiagnostics<ComparisonScoredPresentationPhase>;
export interface ComparisonRendererPresentationResult { presentation: ComparisonRendererPresentation; diagnostics?: ComparisonPresentationPairDiagnostics }

/** Parser capability only; collector/mode/revision/correctness guards remain required before scoring. */
export function parseComparisonRendererPresentation(input: ComparisonRendererPresentationInput): ComparisonRendererPresentationResult {
  try {
    if (!Array.isArray(input.evidencePaths) || input.evidencePaths.length === 0) throw new Error('Missing presentation evidence paths');
    const evidencePaths = input.evidencePaths.map(path => comparisonArtifactPathSchema.parse(path));
    const result = parsePresentationCore(input, phase => { comparisonPresentationPhaseInputSchema.parse(phase); });
    if (result.presentation.status === 'unavailable') return {presentation: comparisonRendererPresentationSchema.parse(result.presentation)};
    const presentation = comparisonRendererPresentationSchema.parse({
      capability: PRESENTATION_CAPABILITY, contractVersion: PRESENTATION_CONTRACT_VERSION, status: 'available',
      value: {scope: result.presentation.value.scope, phases: result.presentation.value.phases.map((phase, i) => ({
        ...phase, startMark: input.phases[i]!.startMark, endMark: input.phases[i]!.endMark,
        rendererVisualUpdateFps: phase.rendererVisualUpdateFps.status === 'available' ? {...phase.rendererVisualUpdateFps, evidence: [...evidencePaths]} : phase.rendererVisualUpdateFps,
        presentationIntervals: phase.presentationIntervals.status === 'available' ? {...phase.presentationIntervals, evidence: [...evidencePaths]} : phase.presentationIntervals,
      }))},
    });
    return {presentation, ...(result.diagnostics ? {diagnostics: result.diagnostics} : {})};
  } catch (error) { return {presentation: {status: 'unavailable', reason: `Unsupported renderer presentation trace: ${error instanceof Error ? error.message : 'malformed input'}`}}; }
}
