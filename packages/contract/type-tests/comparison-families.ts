import {comparisonSchemasForVersionPair, createComparisonArtifactSchemas, createComparisonBaseSchemas} from '../src/index.js';

const legacy = comparisonSchemasForVersionPair({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
const fresh = comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});

// @ts-expect-error Fresh base requires fresh instrumentation.
createComparisonArtifactSchemas(createComparisonBaseSchemas('2.1.0'), legacy.comparisonInstrumentationSchema);
// @ts-expect-error Legacy base must reject the structurally extended fresh instrumentation.
createComparisonArtifactSchemas(createComparisonBaseSchemas('2.0.0'), fresh.comparisonInstrumentationSchema);

const legacyBuilt = createComparisonArtifactSchemas(createComparisonBaseSchemas('2.0.0'), legacy.comparisonInstrumentationSchema);
const freshBuilt = createComparisonArtifactSchemas(createComparisonBaseSchemas('2.1.0'), fresh.comparisonInstrumentationSchema);
type Assert<T extends true> = T;
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type LegacyEvidence = ReturnType<typeof legacyBuilt.comparisonEvidenceSchema.parse>;
type FreshEvidence = ReturnType<typeof freshBuilt.comparisonEvidenceSchema.parse>;
type LegacyVersion = Assert<Same<LegacyEvidence['collectorVersion'], '2.0.0'>>;
type FreshVersion = Assert<Same<FreshEvidence['collectorVersion'], '2.1.0'>>;
type LegacyStatAbsent = Assert<Same<'freshScrollProbe' extends keyof LegacyEvidence['instrumentation'] ? true : false, false>>;
type FreshStatRequired = Assert<Same<undefined extends FreshEvidence['instrumentation']['freshScrollProbe'] ? true : false, false>>;
