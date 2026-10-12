import {comparisonSchemasForVersionPair, type ComparisonSchemaVersion} from '@chat-ui-bench/contract';

export type ComparisonRuntimeSchemas=ReturnType<typeof comparisonSchemasForVersionPair>;
export type ComparisonRuntimeIdentity=ReturnType<ComparisonRuntimeSchemas['comparisonIdentitySchema']['parse']>;
export type ComparisonRuntimeInvocation=ReturnType<ComparisonRuntimeSchemas['comparisonCaptureInvocationSchema']['parse']>;
export type ComparisonRuntimeValidation=ReturnType<ComparisonRuntimeSchemas['comparisonValidationSchema']['parse']>;
export type ComparisonRuntimeEvidence=ReturnType<ComparisonRuntimeSchemas['comparisonEvidenceSchema']['parse']>;
export type ComparisonRuntimeCaptureStatus=ReturnType<ComparisonRuntimeSchemas['comparisonCaptureStatusSchema']['parse']>;
export type ComparisonRuntimeDataset=ReturnType<ComparisonRuntimeSchemas['comparisonDatasetInventorySchema']['parse']>;
export interface ComparisonRuntimeFamilyContext {comparisonVersion?:ComparisonSchemaVersion;comparisonSchemas?:ComparisonRuntimeSchemas}
/** Explicit closed selection, independent of artifact contents or shape. */
export function comparisonRuntimeFamily(version:ComparisonSchemaVersion='2.0.0'):ComparisonRuntimeSchemas {
 if(version!=='2.0.0'&&version!=='2.1.0')throw new Error('Unsupported comparison runtime version');
 return version==='2.0.0'?comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version}):comparisonSchemasForVersionPair({collectorVersion:version,analyzerVersion:version});
}
/** Root contexts retain their selected family; historical standalone contexts default to legacy. */
export function comparisonContextFamily(context:ComparisonRuntimeFamilyContext):ComparisonRuntimeSchemas {
 const expected=comparisonRuntimeFamily(context.comparisonVersion);
 if(context.comparisonSchemas!==undefined&&context.comparisonSchemas!==expected)throw new Error('Comparison context schema family differs from selected version');
 return context.comparisonSchemas??expected;
}
