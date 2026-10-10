import {z} from 'zod';
import {comparisonArtifactPathSchema} from './comparison.js';
import {comparisonCaptureLimitsSchema} from './comparison-artifact.js';

const safeCount=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const boundedIdentity=z.string().min(1).max(256);
/** Shared strict data schemas; callers still own the primitive JSON input boundary. */
export const installerRunIdentitySchema=z.strictObject({
  repetition:boundedIdentity,round:safeCount.refine(v=>v>0),
  artifactDirectory:comparisonArtifactPathSchema.refine(v=>v.length<=2048),
  scenarioId:boundedIdentity,caseIndex:safeCount,adapterProfile:boundedIdentity,
  seed:safeCount,mode:z.enum(['headed','headless']),
});
const common={optionsVersion:z.literal(1),identity:installerRunIdentitySchema,limits:comparisonCaptureLimitsSchema};
export const preNavigationOptionsSchema=z.strictObject({...common,stateGlobal:z.literal('comparisonPreNavigation')});
export const mainOptionsSchema=z.strictObject({
  ...common,probeIntervalMs:z.literal(50),bridgeGlobal:z.literal('benchHost'),
  stateGlobal:z.literal('comparisonCapture'),preNavigationGlobal:z.literal('comparisonPreNavigation'),
  observers:z.strictObject({
    eventTiming:z.strictObject({buffered:z.literal(true),durationThresholdMs:z.literal(16)}),
    loaf:z.strictObject({buffered:z.literal(true)}),
  }),
  nativeRecipeIds:z.strictObject({wheel:z.literal('comparison-wheel-up-v1'),composer:z.literal('comparison-composer-calibrate-v1')}),
});
export type InstallerRunIdentity=z.infer<typeof installerRunIdentitySchema>;
export type PreNavigationOptions=z.infer<typeof preNavigationOptionsSchema>;
export type MainOptions=z.infer<typeof mainOptionsSchema>;
