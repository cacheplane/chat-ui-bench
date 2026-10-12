import * as comparison from './comparison.js';
import * as artifact from './comparison-artifact.js';
import * as options from './comparison-installer-options.js';

// Original schema surface; version-free leaves are shared, never copied.
const shared={
 comparisonArtifactPathSchema:comparison.comparisonArtifactPathSchema,
 comparisonVersionShape:comparison.comparisonVersionShape,
 comparisonIdentityShape:comparison.comparisonIdentityShape,
 comparisonIdentitySchema:comparison.comparisonIdentitySchema,
 comparisonPhaseSchema:comparison.comparisonPhaseSchema,
 adapterCapabilitiesSchema:comparison.adapterCapabilitiesSchema,
 adapterBuildSchema:comparison.adapterBuildSchema,
 comparisonAdapterSchema:comparison.comparisonAdapterSchema,
 comparisonManifestSchema:comparison.comparisonManifestSchema,
 comparisonInvocationSchema:comparison.comparisonInvocationSchema,
 runtimeMessageSchema:comparison.runtimeMessageSchema,
 runtimeProgressSchema:comparison.runtimeProgressSchema,
 visibleMessageSchema:comparison.visibleMessageSchema,
 comparisonUnavailableSchema:comparison.comparisonUnavailableSchema,
 comparisonAvailabilitySchema:comparison.comparisonAvailabilitySchema,
 comparisonBoundedBufferSchema:comparison.comparisonBoundedBufferSchema,
 comparisonObserverSchema:comparison.comparisonObserverSchema,
 rendererCountersSchema:comparison.rendererCountersSchema,
 comparisonObservationSchema:comparison.comparisonObservationSchema,
 comparisonPhaseInstanceSchema:artifact.comparisonPhaseInstanceSchema,
 comparisonOpenPhaseSchema:artifact.comparisonOpenPhaseSchema,
 comparisonPhaseBoundarySchema:artifact.comparisonPhaseBoundarySchema,
 comparisonPhasesSchema:artifact.comparisonPhasesSchema,
 comparisonInventoryFileSchema:artifact.comparisonInventoryFileSchema,
 comparisonInstrumentationSchema:artifact.comparisonInstrumentationSchema,
 comparisonTraceSchema:artifact.comparisonTraceSchema,
 comparisonEvidenceSchema:artifact.comparisonEvidenceSchema,
 comparisonFinalRuntimeSchema:artifact.comparisonFinalRuntimeSchema,
 comparisonVisibleValidationSchema:artifact.comparisonVisibleValidationSchema,
 comparisonExceptionEntrySchema:artifact.comparisonExceptionEntrySchema,
 comparisonExceptionsSchema:artifact.comparisonExceptionsSchema,
 comparisonValidationSchema:artifact.comparisonValidationSchema,
 comparisonMeasurementSchema:artifact.comparisonMeasurementSchema,
 comparisonRunResultsSchema:artifact.comparisonRunResultsSchema,
 comparisonRectSchema:artifact.comparisonRectSchema,
 comparisonGeometrySchema:artifact.comparisonGeometrySchema,
 comparisonCaptureLimitsSchema:artifact.comparisonCaptureLimitsSchema,
 comparisonCaptureMetadataSchema:artifact.comparisonCaptureMetadataSchema,
 comparisonInputRecipeSchema:artifact.comparisonInputRecipeSchema,
 comparisonHostDispatchSchema:artifact.comparisonHostDispatchSchema,
 comparisonDeadlineSchema:artifact.comparisonDeadlineSchema,
 comparisonHostFrameGuardSchema:artifact.comparisonHostFrameGuardSchema,
 comparisonCounterCheckpointSchema:artifact.comparisonCounterCheckpointSchema,
 comparisonCheckpointsSchema:artifact.comparisonCheckpointsSchema,
 comparisonScheduledRunSchema:artifact.comparisonScheduledRunSchema,
 comparisonCaptureInvocationSchema:artifact.comparisonCaptureInvocationSchema,
 comparisonCaptureStatusSchema:artifact.comparisonCaptureStatusSchema,
 comparisonRawInventorySchema:artifact.comparisonRawInventorySchema,
 comparisonFinalizationStatusSchema:artifact.comparisonFinalizationStatusSchema,
 comparisonDatasetFinalizationFailureSchema:artifact.comparisonDatasetFinalizationFailureSchema,
 comparisonTraceAuxiliarySchema:artifact.comparisonTraceAuxiliarySchema,
 comparisonNativeDispatchResultsSchema:artifact.comparisonNativeDispatchResultsSchema,
 comparisonInstrumentationBuildSchema:artifact.comparisonInstrumentationBuildSchema,
 comparisonProvenanceAcquisitionSchema:artifact.comparisonProvenanceAcquisitionSchema,
 comparisonDatasetInventorySchema:artifact.comparisonDatasetInventorySchema,
 installerRunIdentitySchema:options.installerRunIdentitySchema,
 preNavigationOptionsSchema:options.preNavigationOptionsSchema,
 mainOptionsSchema:options.mainOptionsSchema,
};
const baseLegacy=comparison.legacyComparisonBase;
const legacy=Object.freeze({...shared,...baseLegacy});
const baseFresh=comparison.createComparisonBaseSchemas('2.1.0');
const fresh=Object.freeze({...shared,...baseFresh,...artifact.createComparisonArtifactSchemas(baseFresh,artifact.comparisonFreshInstrumentationSchema),mainOptionsSchema:options.freshMainOptionsSchema});
export type LegacyComparisonSchemaPair={collectorVersion:'2.0.0';analyzerVersion:'2.0.0'};
export type FreshComparisonSchemaPair={collectorVersion:'2.1.0';analyzerVersion:'2.1.0'};
export type ComparisonSchemaPair=LegacyComparisonSchemaPair|FreshComparisonSchemaPair;
export function comparisonSchemasForVersionPair(pair:LegacyComparisonSchemaPair):typeof legacy;
export function comparisonSchemasForVersionPair(pair:FreshComparisonSchemaPair):typeof fresh;
export function comparisonSchemasForVersionPair(pair:ComparisonSchemaPair):typeof legacy|typeof fresh;
export function comparisonSchemasForVersionPair(pair:ComparisonSchemaPair){
 if(pair===null||typeof pair!=='object'||Array.isArray(pair)||Object.keys(pair).sort().join(',')!=='analyzerVersion,collectorVersion')throw new Error('Unsupported comparison schema pair');
 if(pair.collectorVersion==='2.0.0'&&pair.analyzerVersion==='2.0.0')return legacy;
 if(pair.collectorVersion==='2.1.0'&&pair.analyzerVersion==='2.1.0')return fresh;
 throw new Error('Unsupported comparison schema pair');
}
