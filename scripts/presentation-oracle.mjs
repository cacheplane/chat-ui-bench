import { assertEqual } from './artifact-checks.mjs';

export function assertPhaseIdentities(productionPhases, rawPhaseObservations) {
  assertEqual(
    productionPhases.map(p => ({ phase: p.phase, instanceId: p.instanceId })),
    rawPhaseObservations.map(p => ({ phase: p.phase, instanceId: p.data.instanceId })),
    'Scored phase identities and ordering',
  );
}
export function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Unsafe ${label}`);
  return value;
}
// Inputs are pairs returned by the actual bundled AnimationFramesHandler.
// This performs phase arithmetic only; it never pairs raw animation records.
export function phaseOracle(pairs, startUs, endUs) {
  safeInteger(startUs, 'start'); safeInteger(endUs, 'end');
  if (endUs <= startUs) throw new Error('Empty or reversed phase');
  const inside = value => value >= startUs && value < endUs;
  for (const pair of pairs) {
    safeInteger(pair.beginTs, 'begin timestamp');
    if (pair.feedbackTs !== undefined) safeInteger(pair.feedbackTs, 'feedback timestamp');
  }
  const eligible = pairs.filter(p => inside(p.beginTs) && p.feedbackTs !== undefined && inside(p.feedbackTs));
  const timestampsUs = [...new Set(eligible.map(p => p.feedbackTs))].sort((a, b) => a - b);
  const intervalsUs = timestampsUs.slice(1).map((t, i) => t - timestampsUs[i]);
  const sorted = [...intervalsUs].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  const scaled = safeInteger(timestampsUs.length * 1e6, 'scaled numerator');
  const result = {
    eligiblePairCount: eligible.length, distinctDeliveryCount: timestampsUs.length,
    coalescedPairCount: eligible.length - timestampsUs.length,
    boundaryExcludedPairCount: pairs.filter(p => p.feedbackTs !== undefined && !(inside(p.beginTs) && inside(p.feedbackTs)) && (inside(p.beginTs) || inside(p.feedbackTs) || (p.beginTs < startUs && p.feedbackTs >= endUs))).length,
    nonPresentedPairCount: pairs.filter(p => p.feedbackTs === undefined && inside(p.beginTs)).length,
    denominatorUs: endUs - startUs, fps: timestampsUs.length ? scaled / (endUs - startUs) : null,
    fpsStatus: timestampsUs.length ? 'available' : 'unavailable',
    ...(timestampsUs.length ? {} : { fpsReason: 'No eligible renderer presentation feedback in this phase' }), timestampsUs, intervalsUs,
  };
  if (result.fps !== null && !Number.isFinite(result.fps)) throw new Error('Non-finite FPS');
  if (sorted.length) Object.assign(result, { median: sorted.length % 2 ? sorted[mid] : sorted[mid - 1] + (sorted[mid] - sorted[mid - 1]) / 2, p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1) });
  return result;
}
