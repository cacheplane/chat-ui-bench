import { rendererPresentationSchema, scoredPresentationPhaseSchema, type PresentationPhaseInput, type RendererPresentation } from '@chat-ui-bench/contract';
import { parsePresentationCore } from './presentation-core.js';

export interface RendererPresentationInput {
  trace: unknown;
  target: { appURL: string; frameId: string };
  phases: PresentationPhaseInput[];
}
export interface PresentationPairDiagnostics {
  wholeTracePairCount: number;
  wholeTraceNonPresentedPairCount: number;
  identityMismatches: number;
  phases: { phase: PresentationPhaseInput['phase']; instanceId: string; eligiblePairCount: number; distinctDeliveryCount: number }[];
}
export interface RendererPresentationResult {
  presentation: RendererPresentation;
  diagnostics?: PresentationPairDiagnostics;
}
/** Strict legacy wrapper; phase validation retains the original topology-first precedence. */
export function parseRendererPresentation(input: RendererPresentationInput): RendererPresentationResult {
  const result = parsePresentationCore(input, phase => { scoredPresentationPhaseSchema.parse(phase.phase); });
  try { rendererPresentationSchema.parse(result.presentation); return result; }
  catch (error) { return {presentation: {status: 'unavailable', reason: `Unsupported renderer presentation trace: ${error instanceof Error ? error.message : 'malformed input'}`}}; }
}
