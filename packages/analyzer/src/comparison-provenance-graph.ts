import {z} from 'zod';
import {canonicalSerialize, comparisonArtifactPathSchema, type comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';
import type {ComparisonByteFact, ComparisonLoadingIssue} from './comparison-load.js';
import type {ComparisonReferenceInput, ComparisonReferenceLane} from './comparison-reference-closure.js';

type Schemas = ReturnType<typeof comparisonSchemasForVersionPair>;
export type ProductDeclaration = z.output<Schemas['adapterBuildSchema']>;
export type ProbeDeclaration = z.output<Schemas['comparisonInstrumentationBuildSchema']>;
type Acquisition = NonNullable<ComparisonReferenceInput['acquisition']>;
export const comparisonPackageMetadataSchema = z.object({name: z.string().min(1), version: z.string().min(1), optionalDependencies: z.unknown().optional(), os: z.unknown().optional(), cpu: z.unknown().optional()});
export type PackageMetadata = z.output<typeof comparisonPackageMetadataSchema>;
export interface ComparisonProvenanceGraph extends ComparisonReferenceLane {
  expectedMembers: number | null; observedAcquisitionMembers: number | null;
  manifestAgreement: 'matched' | 'unavailable' | 'contradictory';
}
export interface ProvenanceGraphInput {
  product: ProductDeclaration | null; probe: ProbeDeclaration | null; acquisition: Acquisition | null;
  manifest: z.output<Schemas['comparisonManifestSchema']> | null;
  files: ComparisonReferenceInput['files']; metadata: Map<string, PackageMetadata | null>;
}
export function unavailableComparisonProvenanceGraph(reason: string): ComparisonProvenanceGraph {
  return {status: 'unavailable', reportedStatus: null, expectedMembers: null, observedAcquisitionMembers: null,
    manifestAgreement: 'unavailable', issues: [{kind: 'membership', path: '.', role: 'slot-json', reason}], additionalIssueCount: 0};
}
function issue(result: ComparisonProvenanceGraph, path: string, reason: string, kind: 'membership' | 'integrity' = 'membership'): void {
  if (result.status !== 'unavailable') result.status = 'partial';
  if (result.issues.length < 32) result.issues.push({kind, path, role: 'slot-json', reason}); else result.additionalIssueCount++;
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
/** No semantic schema traversal or expected-path expansion before this bounded raw preflight. */
export function provenanceGraphAdmission(product: unknown, probe: unknown): ComparisonLoadingIssue | null {
  const p = object(product), q = object(probe), counts: number[] = [];
  const limit = (path: string, observed: number, observation: 'exact' | 'lower-bound'): ComparisonLoadingIssue => ({kind: 'admission-limit', path, role: 'slot-json', limitName: 'slotCandidates', limit: 4096, observed, observation, reason: 'Captured provenance declarations exceed existing slot candidate capacity'});
  for (const [raw, name, fields] of [[p, 'provenance/build-evidence.json', ['sourceHashes', 'assetHashes', 'copiedSourceHashes']], [q, 'instrumentation/build-evidence.json', ['sourceHashes', 'compiledHashes']]] as const) {
    for (const key of fields) {const value = object(raw?.[key]), count = value === null ? 0 : Object.keys(value).length; if (count > 4096) return limit(name, count, 'exact'); if (key !== 'copiedSourceHashes') counts.push(count);}
  }
  const rows = Array.isArray(p?.['packages']) ? p['packages'] : [];
  if (rows.length > 4096) return limit('provenance/build-evidence.json', rows.length, 'exact');
  const fixed = 2 + counts.reduce((a, b) => a + b, 0); if (fixed > 4096) return limit('provenance/acquisition.json', fixed, 'exact');
  const paths = new Set<string>();
  for (const raw of [...rows, q?.['compiler'], q?.['nativeCompiler']]) {
    const path = object(raw)?.['resolutionPath']; if (typeof path === 'string') paths.add(path);
    if (fixed + paths.size > 4096) return limit('provenance/acquisition.json', fixed + paths.size, 'lower-bound');
  }
  return null;
}
export function provenanceMetadataPaths(product: ProductDeclaration, probe: ProbeDeclaration): string[] {
  return [...new Set([...product.packages.flatMap(row => row.resolutionPath === undefined ? [] : [row.resolutionPath]), probe.compiler.resolutionPath, probe.nativeCompiler.resolutionPath])].sort().map(path => 'provenance/packages/' + path + '/package.json');
}
const sameFact = (a: ComparisonByteFact | null, b: ComparisonByteFact | null): boolean => a !== null && b !== null && a.byteLength === b.byteLength && a.sha256 === b.sha256;
/** Copy availability is a byte witness, independent of operational acquisition completeness. */
export function provenanceMetadataCopiedWitnesses(acquisition: Acquisition | null, files: ComparisonReferenceInput['files']): Set<string> {
  const paths = new Set<string>();
  for (const member of acquisition?.members ?? []) {
    if (member.role !== 'installed-package-metadata' || member.path !== 'provenance/packages/' + member.key + '/package.json' || member.copied.status !== 'available') continue;
    const original = files.get(member.path);
    if (original && sameFact(member.copied.value, original.actual) && sameFact(member.copied.value, original.seal)) paths.add(member.path);
  }
  return paths;
}
/** Independent declaration relations only; no collector planner, filesystem or captured module execution. */
export function checkComparisonProvenanceGraph(input: ProvenanceGraphInput): ComparisonProvenanceGraph {
  const {product, probe, acquisition, files} = input;
  const result = unavailableComparisonProvenanceGraph('Required captured build declarations or acquisition unavailable');
  result.reportedStatus = acquisition?.status ?? null; result.observedAcquisitionMembers = acquisition?.members.length ?? null;
  if (product === null || probe === null || acquisition === null) {
    result.issues = [];
    for (const [missing, path] of [[product === null, 'provenance/build-evidence.json'], [probe === null, 'instrumentation/build-evidence.json'], [acquisition === null, 'provenance/acquisition.json']] as const) {
      if (missing) issue(result, path, 'Required captured build declaration unavailable from admitted originals');
    }
    return result;
  }
  result.status = 'complete'; result.issues = [];
  if (acquisition.status !== 'complete') issue(result, 'provenance/acquisition.json', 'Original acquisition remains partial');
  if (Object.keys(product.copiedSourceHashes).length) issue(result, 'provenance/build-evidence.json', 'Nonempty legacy copiedSourceHashes has no supported comparison acquisition projection');
  type Expected = {role: Acquisition['members'][number]['role']; key: string; path: string; digest?: string};
  const expected = new Map<string, Expected>();
  const add = (role: Expected['role'], key: string, path: string, digest?: string) => {
    if (!comparisonArtifactPathSchema.safeParse(key).success || !comparisonArtifactPathSchema.safeParse(path).success) {issue(result, 'provenance/build-evidence.json', 'Build declaration key is not a normalized artifact path'); return;}
    if (expected.has(path)) {issue(result, path, 'Expected build destinations collide'); return;}
    expected.set(path, {role, key, path, ...(digest === undefined ? {} : {digest})});
  };
  add('build-record', '.build-evidence.json', 'provenance/build-evidence.json');
  add('instrumentation-build-record', 'packages/runner/.comparison-build-evidence.json', 'instrumentation/build-evidence.json');
  for (const [role, hashes, prefix] of [['build-source', product.sourceHashes, 'provenance/source/'], ['instrumentation-source', probe.sourceHashes, 'instrumentation/source/'], ['instrumentation-compiled-input', probe.compiledHashes, 'instrumentation/compiled/'], ['served-asset', product.assetHashes, 'provenance/assets/']] as const)
    for (const [key, digest] of Object.entries(hashes)) add(role, key, prefix + key, digest);
  for (const path of provenanceMetadataPaths(product, probe)) add('installed-package-metadata', path.slice('provenance/packages/'.length, -'/package.json'.length), path);
  for (const row of product.packages) if (row.resolutionPath === undefined) issue(result, 'provenance/build-evidence.json', 'Legacy package declaration has no original physical resolution path');
  for (const [key, digest] of Object.entries(product.sourceHashes)) {
    if (Object.hasOwn(probe.sourceHashes, key) && probe.sourceHashes[key] !== digest) issue(result, 'provenance/source/' + key, 'Product and probe shared source declarations differ', 'integrity');
    if (Object.hasOwn(probe.compiledHashes, key) && probe.compiledHashes[key] !== digest) issue(result, 'provenance/source/' + key, 'Product source and probe compiled declarations differ', 'integrity');
  }
  result.expectedMembers = expected.size;
  const recorded = new Map(acquisition.members.map(member => [member.path, member]));
  for (const member of acquisition.members) if (!expected.has(member.path)) issue(result, member.path, 'Acquisition member is not declared by captured build records');
  for (const [path, declaration] of expected) {
    const member = recorded.get(path), original = files.get(path);
    if (!member) {issue(result, path, 'Expected build declaration has no acquisition member'); continue;}
    if (member.role !== declaration.role || member.key !== declaration.key) issue(result, path, 'Acquisition role or key differs from captured build declaration');
    if (member.status !== 'complete' || member.copied.status !== 'available') issue(result, path, 'Expected acquisition retains partial or unavailable copied measurement');
    if (original ? !sameFact(original.actual, original.seal) : member.copied.status === 'available') issue(result, path, 'Expected build declaration has no measured sealed original', 'integrity');
    if (declaration.digest !== undefined && (member.originalSha256 !== declaration.digest || member.copied.status === 'available' && (original?.actual?.sha256 !== declaration.digest || member.copied.value.sha256 !== declaration.digest))) issue(result, path, 'Build declared digest differs from acquired or retained original', 'integrity');
    if (member.copied.status === 'available' && (!original || !sameFact(member.copied.value, original.actual))) issue(result, path, 'Declared acquisition copied fact differs from measured original', 'integrity');
  }
  const claims = new Map<string, {name: string; version: string; integrity: string}[]>();
  const metadataWitnesses = provenanceMetadataCopiedWitnesses(acquisition, files);
  for (const declaration of [...product.packages, probe.compiler, probe.nativeCompiler]) {
    if (declaration.resolutionPath === undefined) continue;
    const path = 'provenance/packages/' + declaration.resolutionPath + '/package.json';
    const rows = claims.get(path) ?? []; rows.push(declaration); claims.set(path, rows);
  }
  for (const [path, rows] of claims) {
    if (rows.some(row => row.name !== rows[0]!.name || row.version !== rows[0]!.version || row.integrity !== rows[0]!.integrity)) issue(result, path, 'Same physical metadata path has conflicting captured declarations', 'integrity');
    if (!metadataWitnesses.has(path)) {issue(result, path, 'Original package metadata copy is unverified'); continue;}
    const metadata = input.metadata.get(path);
    if (!metadata) {issue(result, path, 'Original package metadata is unavailable'); continue;}
    if (rows.some(row => row.name !== metadata.name || row.version !== metadata.version)) issue(result, path, 'Package metadata identity differs from captured declaration', 'integrity');
  }
  const compilerPath = 'provenance/packages/' + probe.compiler.resolutionPath + '/package.json', nativePath = 'provenance/packages/' + probe.nativeCompiler.resolutionPath + '/package.json';
  for (const [path, fact] of [[compilerPath, probe.compilerPackageMetadata], [nativePath, probe.nativeCompilerPackageMetadata]] as const) {
    const original = files.get(path);
    if (metadataWitnesses.has(path) && (!original || !sameFact(fact, original.actual) || !sameFact(fact, original.seal))) issue(result, path, 'Compiler metadata measurement differs from sealed original', 'integrity');
  }
  const compilerMetadata = metadataWitnesses.has(compilerPath) ? input.metadata.get(compilerPath) : null, nativeMetadata = metadataWitnesses.has(nativePath) ? input.metadata.get(nativePath) : null;
  if (compilerMetadata && object(compilerMetadata.optionalDependencies)?.[probe.nativeCompiler.name] !== probe.nativeCompiler.version) issue(result, compilerPath, 'Compiler optional native pin differs from captured native declaration', 'integrity');
  if (nativeMetadata && (!Array.isArray(nativeMetadata.os) || !nativeMetadata.os.includes(probe.nativeCompiler.platform) || !Array.isArray(nativeMetadata.cpu) || !nativeMetadata.cpu.includes(probe.nativeCompiler.architecture))) issue(result, nativePath, 'Native package metadata does not support declared platform and architecture', 'integrity');
  if (probe.nativeCompiler.version !== probe.compiler.version || probe.nativeCompiler.name !== '@typescript/typescript-' + probe.nativeCompiler.platform + '-' + probe.nativeCompiler.architecture) issue(result, 'instrumentation/build-evidence.json', 'Native compiler identity differs from recorded compiler context', 'integrity');
  if (probe.nativeCompiler.executablePath !== probe.nativeCompiler.resolutionPath + '/lib/tsc' + (probe.nativeCompiler.platform === 'win32' ? '.exe' : '')) issue(result, 'instrumentation/build-evidence.json', 'Native executable declaration differs from its recorded package context', 'integrity');
  if (input.manifest !== null) {
    result.manifestAgreement = canonicalSerialize(input.manifest.adapter.build) === canonicalSerialize(product) ? 'matched' : 'contradictory';
    if (result.manifestAgreement === 'contradictory') issue(result, 'manifest.json', 'Manifest build differs from captured product declaration', 'integrity');
  }
  return result;
}
export function revokeComparisonProvenanceGraph(result: ComparisonProvenanceGraph): void {
  if (result.status === 'complete') issue(result, '.', 'Original invocation ownership or membership was not closed', 'integrity');
}
