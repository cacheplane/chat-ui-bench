import type { Availability } from '@chat-ui-bench/contract';
import { errorMessage } from './calibrate.js';
export interface RetentionDependencies { setPhase(): Promise<void>; gc(): Promise<void>; snapshot(name: 'baseline' | 'post'): Promise<string>; reset(): Promise<void> }
export interface RetentionEvidence { baseline: string; post: string; resets: number; ownershipAnalysis: 'offline-required' }
export async function collectRetention(dependencies: RetentionDependencies): Promise<Availability<RetentionEvidence>> {
  try {
    await dependencies.setPhase(); await dependencies.gc(); const baseline = await dependencies.snapshot('baseline');
    for (let i = 0; i < 5; i++) await dependencies.reset();
    await dependencies.gc(); const post = await dependencies.snapshot('post');
    return { status: 'available', value: { baseline, post, resets: 5, ownershipAnalysis: 'offline-required' } };
  } catch (error) { return { status: 'unavailable', reason: `Retention calibration unvalidated: ${errorMessage(error)}` }; }
}
