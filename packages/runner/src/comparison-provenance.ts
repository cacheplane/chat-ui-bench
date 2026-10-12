import {comparisonContextFamily, type ComparisonRuntimeSchemas} from './comparison-runtime-family.js';
import {spawn, type SpawnOptionsWithoutStdio} from 'node:child_process';
import type {Readable, Writable} from 'node:stream';
import type {ComparisonOwnedResource} from './comparison-ownership.js';
import * as fs from 'node:fs/promises';
import {constants, type BigIntStats} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {adapterBuildSchema, comparisonInstrumentationBuildSchema, canonicalSerialize, type AdapterBuild, type ComparisonInstrumentationBuild} from '@chat-ui-bench/contract';
import type {ComparisonSlotContext} from './long-thread-run.js';
import type {ComparisonRawStream, ComparisonScopedWriter} from './comparison-artifacts.js';
import type {ComparisonInstallerPair} from './comparison-installer.js';

type Measurement = {byteLength: number; sha256: string};
type Availability<T> = {status: 'available'; value: T} | {status: 'unavailable'; reason: string};
type RuntimeAcquisition=ReturnType<ComparisonRuntimeSchemas['comparisonProvenanceAcquisitionSchema']['parse']>;
type Member = RuntimeAcquisition['members'][number];
type FileIdentity = {dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number};
type PathCheck = {root: string; path: string; key: string; identity: FileIdentity; ancestors: [string, FileIdentity][]};
type ReadCheck = PathCheck & Measurement & {bytes: Buffer};
type Lifecycle = {assertActive(): void; adopt(resource: ComparisonOwnedResource): Promise<void>};
type FileFact = {sha256: string; identity: FileIdentity; path: string; ancestors: {path: string; dev: number; ino: number}[]};
type ExactIdentity = Readonly<{dev: string; ino: string; size: string; mtimeNs: string; ctimeNs: string}>;
type ExactPathIdentity = Readonly<{path: string; identity: ExactIdentity; ancestors: readonly Readonly<{path: string; dev: string; ino: string}>[]}>;
type ProductInputs = {facts: Record<string, FileFact>; metadata: Record<string, FileFact>; packages: AdapterBuild['packages']; settings: AdapterBuild['settings']};
type ProbeInputs = {facts: Record<string, FileFact>; compiler: ComparisonInstrumentationBuild['compiler']; nativeCompiler: ComparisonInstrumentationBuild['nativeCompiler']; compilerPackageMetadata: Measurement; nativeCompilerPackageMetadata: Measurement; toolFiles: {path: string; identity: FileIdentity}[]};
interface OriginalLowHelpers {
  checkedPath(root: string, path: string, ops: typeof fs, options: {directory?: boolean}, lifecycle: Lifecycle): Promise<PathCheck>;
  recheckPath(check: PathCheck, ops: typeof fs, lifecycle: Lifecycle): Promise<void>;
  checkedRead(root: string, path: string, ops: typeof fs, lifecycle: Lifecycle): Promise<ReadCheck>;
  packagePath(name: string, from: string, ops: typeof fs, lifecycle: Lifecycle): Promise<string | null>;
}
interface OriginalProductHelpers {
  threadplaneBuildEvidence(root: string, options: {lifecycle: Lifecycle}): Promise<unknown>;
  snapshotProductInputs(root: string, options: {lifecycle: Lifecycle}): Promise<ProductInputs>;
}
interface OriginalProbeHelpers {
  comparisonInstrumentationBuildEvidence(root: string, options: {lifecycle: Lifecycle}): Promise<unknown>;
  snapshotProbeInputs(root: string, options: {lifecycle: Lifecycle}): Promise<ProbeInputs>;
  snapshotCompiledInputs(root: string, options: {lifecycle: Lifecycle}): Promise<Record<string, FileFact>>;
}
export interface ComparisonAcquiredInstrumentation extends ComparisonInstallerPair {}
export interface ComparisonServingFacts {originalRoot: string; build: AdapterBuild; probe: ComparisonInstrumentationBuild; assets: Record<string, string>}
export interface ComparisonAcquisitionSnapshot {
  acquisition: RuntimeAcquisition;
  payloads: readonly {path: 'instrumentation/pre-navigation.js' | 'instrumentation/main.js'; measurement: Availability<Measurement>; status: 'not-attempted' | 'pending' | 'complete' | 'failed'}[];
  persistence: {path: 'provenance/acquisition.json'; status: 'not-attempted' | 'pending' | 'complete' | 'failed'; reason?: string};
}
export interface ComparisonProvenanceSession {
  acquire(preNavigationOptionsJSON: string, mainOptionsJSON: string): Promise<ComparisonAcquiredInstrumentation>;
  snapshotAcquisition(): ComparisonAcquisitionSnapshot;
  recheckBeforeServing(): Promise<ComparisonServingFacts>;
}
interface OriginalFacts {
  build: AdapterBuild; probe: ComparisonInstrumentationBuild; productInputs: ProductInputs; probeInputs: ProbeInputs;
  compiled: Record<string, FileFact>; records: readonly [ReadCheck, ReadCheck]; files: Record<string, FileFact>; exact: Readonly<Record<string, ExactPathIdentity>>;
}
interface SessionState {
  descriptor: ReturnType<ComparisonRuntimeSchemas['comparisonScheduledRunSchema']['parse']>; family:ComparisonRuntimeSchemas; version:'2.0.0'|'2.1.0'; root: string; writer: ComparisonScopedWriter; lifecycle: Lifecycle; signal: AbortSignal;
  attempted: boolean; complete: boolean; snapshot: ComparisonAcquisitionSnapshot; low?: OriginalLowHelpers;
  product?: OriginalProductHelpers; probe?: OriginalProbeHelpers; original?: OriginalFacts;
}
const sessions = new WeakMap<object, SessionState>();
const unavailable = (reason: string): Availability<never> => ({status: 'unavailable', reason});
const exactIdentity = (stat: BigIntStats): ExactIdentity => Object.freeze({dev: stat.dev.toString(), ino: stat.ino.toString(), size: stat.size.toString(), mtimeNs: stat.mtimeNs.toString(), ctimeNs: stat.ctimeNs.toString()});
const equal = (actual: unknown, expected: unknown) => canonicalSerialize(actual) === canonicalSerialize(expected);
async function guarded<T>(state: SessionState, operation: () => Promise<T>): Promise<T> {state.lifecycle.assertActive(); const value = await operation(); state.lifecycle.assertActive(); return value;}

/** No IO: register this opaque handle before awaiting the one-shot acquire. */
export function createComparisonProvenanceSession(context: ComparisonSlotContext, originalRoot: string): ComparisonProvenanceSession {
  const family=comparisonContextFamily(context),version=context.comparisonVersion??'2.0.0';
  const descriptor = family.comparisonScheduledRunSchema.parse(context.descriptor), identity = family.comparisonIdentitySchema.parse(context.identity);
  for (const key of Object.keys(identity) as (keyof typeof identity)[]) if (identity[key] !== descriptor[key]) throw new Error('Comparison descriptor identity differs');
  if (descriptor.adapterProfile !== 'threadplane-langgraph-custom-transport') throw new Error('Unsupported comparison profile');
  if (typeof originalRoot !== 'string' || !originalRoot || originalRoot.includes('\0')) throw new Error('Original root must be a primitive path');
  const ownership = context.ownership, generation = ownership.generation, writer = context.writer;
  const assertActive = ownership.assertActive.bind(ownership), adopt = ownership.adopt.bind(ownership);
  const lifecycle: Lifecycle = {assertActive() {if (ownership.generation !== generation) throw new Error('Original generation changed'); assertActive();}, adopt};
  const state: SessionState = {descriptor: structuredClone(descriptor), family,version, root: originalRoot, signal: ownership.signal, lifecycle,
    writer: {text: writer.text.bind(writer), json: writer.json.bind(writer), append: writer.append.bind(writer), appendSerialized: writer.appendSerialized.bind(writer), stream: writer.stream.bind(writer)}, attempted: false, complete: false,
    snapshot: {acquisition: {...identity, status: 'partial', reason: 'comparison-not-yet-acquired', members: []}, payloads: ['instrumentation/pre-navigation.js', 'instrumentation/main.js'].map(path => ({path: path as 'instrumentation/pre-navigation.js' | 'instrumentation/main.js', status: 'not-attempted', measurement: unavailable('comparison-payload-not-acquired')})), persistence: {path: 'provenance/acquisition.json', status: 'not-attempted'}}};
  const session: ComparisonProvenanceSession = Object.freeze({
    async acquire(this: ComparisonProvenanceSession, pre: string, main: string) {return acquireSession(brandedState(this), pre, main);},
    snapshotAcquisition(this: ComparisonProvenanceSession) {return snapshot(brandedState(this));},
    async recheckBeforeServing(this: ComparisonProvenanceSession) {return recheckSession(requireState(this));},
  });
  sessions.set(session, state); return session;
}
function snapshot(state: SessionState): ComparisonAcquisitionSnapshot {
  const copy = structuredClone(state.snapshot); copy.acquisition = state.family.comparisonProvenanceAcquisitionSchema.parse(copy.acquisition); return copy;
}
function brandedState(session: ComparisonProvenanceSession): SessionState {
  const state = sessions.get(session); if (!state) throw new Error('A genuine comparison session is required');
  return state;
}
function requireState(session: ComparisonProvenanceSession): SessionState {
  const state = brandedState(session);
  state.lifecycle.assertActive(); if (!state.complete || !state.original || !state.low) throw new Error('Comparison acquisition is incomplete'); return state;
}
/** Private authority accessor for profile/environment; never a barrel export. */
export function requireComparisonProvenanceSession(session: ComparisonProvenanceSession) {
  const state = requireState(session);
  return Object.freeze({descriptor: structuredClone(state.descriptor), originalRoot: state.root, lifecycle: state.lifecycle, signal: state.signal,
    recheck: () => recheckSession(requireState(session)),
    async read(key: string) {requireState(session); return guarded(state, () => state.low!.checkedRead(state.root, join(state.root, key), fs, state.lifecycle));},
    async packageMetadataPath(name: string) {requireState(session); return guarded(state, () => state.low!.packagePath(name, join(state.root, 'package.json'), fs, state.lifecycle));},
  });
}
function validateOptions(state: SessionState, input: string, kind: 'pre' | 'main'): void {
  if (typeof input !== 'string' || input.length > 65536 || Buffer.byteLength(input, 'utf8') > 65536) throw new Error('Comparison options are overbudget');
  const options = (kind === 'pre' ? state.family.preNavigationOptionsSchema : state.family.mainOptionsSchema).parse(JSON.parse(input));
  if (canonicalSerialize(options) !== input) throw new Error('Comparison options must be canonical');
  for (const key of ['repetition', 'round', 'artifactDirectory', 'scenarioId', 'caseIndex', 'adapterProfile', 'seed', 'mode'] as const) if (options.identity[key] !== state.descriptor[key]) throw new Error('Comparison options differ from actual descriptor');
}
async function loadOriginal(state: SessionState): Promise<void> {
  const requested = resolve(state.root), rootStat = await guarded(state, () => fs.lstat(requested));
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Unsafe original root');
  state.root = await guarded(state, () => fs.realpath(requested));
  // Bootstrap the original low helper only after checked regular ancestors and
  // entry. Resolver/loader internals remain outside explicit FD attestation.
  for (const key of ['apps', 'apps/threadplane']) {const stat = await guarded(state, () => fs.lstat(join(state.root, key))); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe original helper ancestor');}
  const lowPath = join(state.root, 'apps/threadplane/dependency-closure.mjs'), stat = await guarded(state, () => fs.lstat(lowPath));
  if (!stat.isFile() || stat.isSymbolicLink() || await guarded(state, () => fs.realpath(lowPath)) !== lowPath) throw new Error('Unsafe original helper');
  state.low = await guarded(state, () => import(pathToFileURL(lowPath).href)) as OriginalLowHelpers;
  for (const key of ['provenance', 'probe-provenance']) await guarded(state, () => state.low!.checkedPath(state.root, join(state.root, `apps/threadplane/${key}.mjs`), fs, {}, state.lifecycle));
  state.product = await guarded(state, () => import(pathToFileURL(join(state.root, 'apps/threadplane/provenance.mjs')).href)) as OriginalProductHelpers;
  state.probe = await guarded(state, () => import(pathToFileURL(join(state.root, 'apps/threadplane/probe-provenance.mjs')).href)) as OriginalProbeHelpers;
}
async function originalFacts(state: SessionState): Promise<OriginalFacts> {
  const options = {lifecycle: state.lifecycle};
  const build = adapterBuildSchema.parse(await guarded(state, () => state.product!.threadplaneBuildEvidence(state.root, options)));
  const probe = comparisonInstrumentationBuildSchema.parse(await guarded(state, () => state.probe!.comparisonInstrumentationBuildEvidence(state.root, options)));
  const productInputs = await guarded(state, () => state.product!.snapshotProductInputs(state.root, options));
  const probeInputs = await guarded(state, () => state.probe!.snapshotProbeInputs(state.root, options));
  const compiled = await guarded(state, () => state.probe!.snapshotCompiledInputs(state.root, options));
  const records: [ReadCheck, ReadCheck] = [await guarded(state, () => state.low!.checkedRead(state.root, join(state.root, 'apps/threadplane/.build-evidence.json'), fs, state.lifecycle)), await guarded(state, () => state.low!.checkedRead(state.root, join(state.root, 'packages/runner/.comparison-build-evidence.json'), fs, state.lifecycle))];
  // Genuine snapshot helpers already measured these originals under the same
  // lifecycle. Retain those fresh facts, not a second redundant source pass.
  const files: Record<string, FileFact> = {...productInputs.facts, ...productInputs.metadata, ...probeInputs.facts, ...compiled};
  const keys = new Set([...Object.keys(build.assetHashes).map(key => `apps/threadplane/dist/${key}`), `${probe.compiler.resolutionPath}/package.json`, `${probe.nativeCompiler.resolutionPath}/package.json`]);
  for (const key of [...keys].sort()) {
    const check = await guarded(state, () => state.low!.checkedPath(state.root, join(state.root, key), fs, {}, state.lifecycle));
    const measurement = await sourcePass(state, check);
    files[key] = {sha256: measurement.sha256, identity: check.identity, path: check.path, ancestors: check.ancestors.map(([path, stat]) => ({path, dev: stat.dev, ino: stat.ino}))};
  }
  const exact: Record<string, ExactPathIdentity> = {}, directories = new Map<string, Readonly<{path: string; dev: string; ino: string}>>();
  const capture = async (key: string, path: string, ancestors: readonly string[]) => {
    if (path !== join(state.root, key)) throw new Error('Comparison exact source path differs');
    const fact = await captureExactPath(state, path, ancestors, directories);
    if (Object.hasOwn(exact, key) && !equal(exact[key], fact)) throw new Error('Comparison exact source is duplicated inconsistently');
    exact[key] = fact;
  };
  for (const [key, fact] of Object.entries(files).sort()) await capture(key, fact.path, fact.ancestors.map(row => row.path));
  for (const record of records) await capture(record.key, record.path, record.ancestors.map(([path]) => path));
  return {build, probe, productInputs, probeInputs, compiled, records, files, exact: Object.freeze(exact)};
}
async function captureExactPath(state: SessionState, path: string, ancestors: readonly string[], directories = new Map<string, Readonly<{path: string; dev: string; ino: string}>>()): Promise<ExactPathIdentity> {
  if (ancestors[0] !== state.root || new Set(ancestors).size !== ancestors.length) throw new Error('Comparison exact ancestor chain differs');
  const captured: Readonly<{path: string; dev: string; ino: string}>[] = [];
  for (const path of ancestors) {
    let row = directories.get(path);
    if (!row) {
      const stat = await guarded(state, () => fs.lstat(path, {bigint: true}));
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Comparison exact ancestor shape changed');
      row = Object.freeze({path, dev: stat.dev.toString(), ino: stat.ino.toString()}); directories.set(path, row);
    }
    captured.push(row);
  }
  const leaf = await guarded(state, () => fs.lstat(path, {bigint: true}));
  if (!leaf.isFile() || leaf.isSymbolicLink() || leaf.size < 0n || leaf.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Comparison exact source shape/size changed');
  return Object.freeze({path, identity: exactIdentity(leaf), ancestors: Object.freeze(captured)});
}
async function recheckExactPath(state: SessionState, expected: ExactPathIdentity): Promise<void> {
  const current = await captureExactPath(state, expected.path, expected.ancestors.map(row => row.path));
  if (!equal(current, expected)) throw new Error('Comparison exact source or ancestor changed');
}
function assertOriginals(actual: OriginalFacts, expected: OriginalFacts): void {
  const summarize = (value: OriginalFacts) => ({...value, records: value.records.map(record => ({identity: record.identity, sha256: record.sha256, byteLength: record.byteLength, ancestors: record.ancestors}))});
  if (!equal(summarize(actual), summarize(expected)) || actual.records.some((record, i) => !record.bytes.equals(expected.records[i]!.bytes))) throw new Error('Comparison original facts changed');
}
type PlannedMember = {member: Member; source: string};
function memberPlan(facts: OriginalFacts): PlannedMember[] {
  const planned: PlannedMember[] = [];
  const add = (role: Member['role'], key: string, path: string, source: string, originalSha256?: string) => {planned.push({source, member: {role, key, path, ...(originalSha256 === undefined ? {} : {originalSha256}), beforeCopy: unavailable('comparison-before-copy-not-acquired'), copied: unavailable('comparison-copy-not-acquired'), afterCopy: unavailable('comparison-after-copy-not-acquired'), status: 'partial', reason: 'comparison-member-not-acquired'}});};
  add('build-record', '.build-evidence.json', 'provenance/build-evidence.json', 'apps/threadplane/.build-evidence.json');
  add('instrumentation-build-record', 'packages/runner/.comparison-build-evidence.json', 'instrumentation/build-evidence.json', 'packages/runner/.comparison-build-evidence.json');
  for (const [key, hash] of Object.entries(facts.build.sourceHashes).sort()) add('build-source', key, `provenance/source/${key}`, key, hash);
  for (const [key, hash] of Object.entries(facts.probe.sourceHashes).sort()) add('instrumentation-source', key, `instrumentation/source/${key}`, key, hash);
  for (const [key, hash] of Object.entries(facts.probe.compiledHashes).sort()) add('instrumentation-compiled-input', key, `instrumentation/compiled/${key}`, key, hash);
  for (const [key, hash] of Object.entries(facts.build.assetHashes).sort()) add('served-asset', key, `provenance/assets/${key}`, `apps/threadplane/dist/${key}`, hash);
  const metadata = new Set([...facts.build.packages.map(row => row.resolutionPath!), facts.probe.compiler.resolutionPath, facts.probe.nativeCompiler.resolutionPath]);
  for (const key of [...metadata].sort()) add('installed-package-metadata', key, `provenance/packages/${key}/package.json`, `${key}/package.json`);
  if (planned.length > 4096) throw new Error('Comparison member capacity exceeded');
  return planned;
}
async function sourcePass(state: SessionState, check: PathCheck, destination?: ComparisonRawStream, pinned?: ExactPathIdentity): Promise<Measurement> {
  const low = state.low!;
  await guarded(state, () => low.recheckPath(check, fs, state.lifecycle));
  const exact = pinned ?? await captureExactPath(state, check.path, check.ancestors.map(([path]) => path));
  if (exact.path !== check.path || !equal(exact.ancestors.map(row => row.path), check.ancestors.map(([path]) => path))) throw new Error('Comparison exact pinned chain differs');
  await recheckExactPath(state, exact);
  state.lifecycle.assertActive(); const fd = await fs.open(check.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let closing: Promise<void> | undefined;
  const resource: ComparisonOwnedResource = {name: `comparison-source:${check.key}`, close() {return closing ??= Promise.resolve().then(() => fd.close());}};
  let primary: unknown, failed = false;
  let hash: ReturnType<typeof createHash> | undefined; let count = 0;
  try {
    await state.lifecycle.adopt(resource); // First open continuation, even late.
    state.lifecycle.assertActive(); hash = createHash('sha256');
    const before = await guarded(state, () => fd.stat({bigint: true}));
    if (!before.isFile() || !equal(exactIdentity(before), exact.identity)) throw new Error('Comparison exact source FD identity changed');
    await guarded(state, () => low.recheckPath(check, fs, state.lifecycle));
    const buffer = Buffer.alloc(65536);
    for (;;) {
      const {bytesRead} = await guarded(state, () => fd.read(buffer, 0, buffer.length, null));
      if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > buffer.length || bytesRead > Number.MAX_SAFE_INTEGER - count || BigInt(bytesRead) > BigInt(exact.identity.size) - BigInt(count)) throw new Error('Comparison source size changed');
      if (!bytesRead) break;
      const chunk = buffer.subarray(0, bytesRead);
      if (destination) await guarded(state, () => destination.write(chunk));
      hash.update(chunk); count += bytesRead;
    }
    if (BigInt(count) !== BigInt(exact.identity.size) || !equal(exactIdentity(await guarded(state, () => fd.stat({bigint: true}))), exact.identity)) throw new Error('Comparison exact source changed during pass');
    await guarded(state, () => low.recheckPath(check, fs, state.lifecycle));
    await recheckExactPath(state, exact);
  } catch (error) {primary = error; failed = true;}
  const closes = await Promise.allSettled([resource.close(), ...(destination ? [destination.complete()] : [])]);
  const closeFailure = closes.find(result => result.status === 'rejected');
  if (closeFailure?.status === 'rejected') {if (failed) throw new AggregateError([primary, closeFailure.reason], 'Comparison pass and close failed'); throw closeFailure.reason;}
  if (failed) throw primary;
  state.lifecycle.assertActive(); await guarded(state, () => low.recheckPath(check, fs, state.lifecycle));
  await recheckExactPath(state, exact);
  return {byteLength: count, sha256: hash!.digest('hex')};
}
/** Internal raw-wire validator; never exported by the runner barrel. */
export function parseComparisonAssemblyOutput(raw: Buffer): ComparisonInstallerPair {
  if (raw.length > 12583086) throw new Error('Comparison assembly output limit');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join(',') !== 'preNavigation,main,preNavigationByteLength,mainByteLength,installerSha256') throw new Error('Comparison assembly output grammar');
  const pair = value as ComparisonInstallerPair;
  for (const [text, length] of [[pair.preNavigation, pair.preNavigationByteLength], [pair.main, pair.mainByteLength]] as const) if (typeof text !== 'string' || text.length > 1048576 || !Number.isSafeInteger(length) || length < 0 || length > 1048576 || Buffer.byteLength(text, 'utf8') !== length) throw new Error('Comparison assembly payload limits');
  if (typeof pair.installerSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(pair.installerSha256) || !raw.equals(Buffer.from(JSON.stringify(pair), 'utf8'))) throw new Error('Comparison assembly exact encoding');
  const hash = createHash('sha256').update('chat-ui-bench:comparison-installer-pair:v1\n');
  for (const text of [pair.preNavigation, pair.main]) {const bytes = Buffer.from(text, 'utf8'), length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.length)); hash.update(length).update(bytes);}
  if (hash.digest('hex') !== pair.installerSha256) throw new Error('Comparison assembly pair hash'); return pair;
}
function workerEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {NODE_DISABLE_COMPILE_CACHE: '1'};
  if (process.platform === 'win32') {const keys = Object.keys(process.env).filter(key => key.toLowerCase() === 'systemroot'); if (keys.length !== 1 || typeof process.env[keys[0]!] !== 'string' || !process.env[keys[0]!]) throw new Error('Unproved Windows worker prerequisites'); env.SystemRoot = process.env[keys[0]!]!;}
  return env;
}
async function acquireSession(state: SessionState, pre: string, main: string): Promise<ComparisonAcquiredInstrumentation> {
  if (state.attempted) throw new Error('Comparison acquisition is one-shot'); state.attempted = true;
  try {
    validateOptions(state, pre, 'pre'); validateOptions(state, main, 'main'); state.lifecycle.assertActive();
    await loadOriginal(state); const original = await originalFacts(state); state.original = original;
    const planned = memberPlan(original);
    state.snapshot.acquisition.members = planned.map(row => row.member);
    snapshot(state); // Strict role/key/dedup admission before destination IO.
    for (const {member, source} of planned) {
      const check = await guarded(state, () => state.low!.checkedPath(state.root, join(state.root, source), fs, {}, state.lifecycle));
      const captured = original.files[source] ?? original.records.find(record => record.key === source);
      const ancestors = check.ancestors.map(([path, stat]) => ({path, dev: stat.dev, ino: stat.ino}));
      const capturedAncestors = captured && ('bytes' in captured ? captured.ancestors.map(([path, stat]) => ({path, dev: stat.dev, ino: stat.ino})) : captured.ancestors);
      if (!captured || check.path !== captured.path || !equal(check.identity, captured.identity) || !equal(ancestors, capturedAncestors)) throw new Error('Comparison original pinned identity changed before copying');
      const exact = original.exact[source]; if (!exact) throw new Error('Comparison exact original anchor is missing');
      const before = await sourcePass(state, check, undefined, exact); member.beforeCopy = {status: 'available', value: before};
      if (before.sha256 !== captured.sha256 || member.originalSha256 !== undefined && before.sha256 !== member.originalSha256) throw new Error('Comparison source differs from genuine inventory');
      const destination = await guarded(state, () => state.writer.stream(member.path));
      member.copied = {status: 'available', value: await sourcePass(state, check, destination, exact)};
      member.afterCopy = {status: 'available', value: await sourcePass(state, check, undefined, exact)};
      if (!equal(member.beforeCopy, member.copied) || !equal(member.beforeCopy, member.afterCopy)) throw new Error('Comparison copy measurements differ');
      member.status = 'complete'; delete member.reason;
    }
    assertOriginals(await originalFacts(state), original);
    const worker = await guarded(state, () => state.low!.checkedPath(state.root, join(state.root, 'packages/runner/dist/comparison-assembly-worker.js'), fs, {}, state.lifecycle));
    state.lifecycle.assertActive(); const tracker = createObservedComparisonProcess(process.execPath, [worker.path], {cwd: state.root, env: workerEnvironment()}, state.signal, {cap: 12583086});
    await state.lifecycle.adopt(tracker.resource); // First creator follow-up.
    state.lifecycle.assertActive();
    await guarded(state, () => tracker.write(Buffer.from(JSON.stringify(state.version==='2.0.0'?[pre,main]:[pre,main,state.version]), 'utf8')));
    const result = await guarded(state, () => tracker.result); const pair = parseComparisonAssemblyOutput(result.stdout);
    assertOriginals(await originalFacts(state), original);
    for (const [index, payload] of [pair.preNavigation, pair.main].entries()) {
      const status = state.snapshot.payloads[index]!; status.status = 'pending';
      try {
        await guarded(state, () => state.writer.text(status.path, payload));
        status.status = 'complete'; status.measurement = {status: 'available', value: {byteLength: Buffer.byteLength(payload, 'utf8'), sha256: createHash('sha256').update(payload, 'utf8').digest('hex')}};
      } catch (error) {status.status = 'failed'; status.measurement = unavailable('comparison-payload-write-failed'); throw error;}
    }
    state.snapshot.acquisition.status = 'complete'; delete state.snapshot.acquisition.reason;
    state.snapshot.persistence.status = 'pending';
    try {await guarded(state, () => state.writer.text('provenance/acquisition.json', canonicalSerialize(snapshot(state).acquisition))); state.snapshot.persistence.status = 'complete';}
    catch (error) {state.snapshot.persistence.status = 'failed'; state.snapshot.persistence.reason = 'comparison-acquisition-persistence-failed'; throw error;}
    state.lifecycle.assertActive(); state.complete = true; return structuredClone(pair);
  } catch (error) {state.snapshot.acquisition.status = 'partial'; state.snapshot.acquisition.reason = 'comparison-acquisition-failed'; throw error;}
}
async function recheckSession(state: SessionState): Promise<ComparisonServingFacts> {
  assertOriginals(await originalFacts(state), state.original!); state.lifecycle.assertActive();
  return structuredClone({originalRoot: state.root, build: state.original!.build, probe: state.original!.probe, assets: state.original!.build.assetHashes});
}

export interface ObservedComparisonResult {stdout: Buffer; dirty: boolean}
export interface ObservedComparisonProcess {
  readonly resource: ComparisonOwnedResource;
  readonly result: Promise<ObservedComparisonResult>;
  write(bytes: Buffer): Promise<void>;
}
/** Module-direct infrastructure, deliberately absent from the public barrel.
 * The creator observes actual events synchronously before returning a tracker.
 */
export function createObservedComparisonProcess(command: string, args: readonly string[], options: Pick<SpawnOptionsWithoutStdio, 'cwd' | 'env'>, signal: AbortSignal, policy: {cap: number} | {discard: true}): ObservedComparisonProcess {
  const child = spawn(command, [...args], {...options, shell: false, detached: false, stdio: ['pipe', 'pipe', 'pipe']});
  const streams = [child.stdin, child.stdout, child.stderr] as const;
  let exited = false, childClosed = false, eof = false, dirty = false, failure = false, count = 0;
  let exitCode: number | null = null, exitSignal: NodeJS.Signals | null = null;
  let chunks: Buffer[] = [], closePromise: Promise<void> | undefined;
  const listeners: (() => void)[] = [];
  const observe = (emitter: Readable | Writable | typeof child, event: string, callback: (...args: unknown[]) => void) => {
    emitter.on(event, callback); listeners.push(() => emitter.off(event, callback));
  };
  const actualChildClose = new Promise<void>(resolve => {
    observe(child, 'close', (() => {childClosed = true; resolve();}) as () => void);
  });
  const actualPipeCloses = streams.map(stream => new Promise<void>(resolve => {
    observe(stream, 'close', (() => resolve()) as () => void);
  }));
  const allClosed = Promise.all([actualChildClose, ...actualPipeCloses]);
  const resource: ComparisonOwnedResource = {name: 'comparison-observed-process', close() {
    if (!closePromise) {
      // Start every close independently; one synchronous failure cannot hide
      // another pipe or prevent direct termination. Only real events settle.
      let cleanupFailed = false;
      for (const stream of streams) try {stream.destroy();} catch {cleanupFailed = true;}
      if (!exited && !childClosed) try {if (!child.kill('SIGKILL')) cleanupFailed = true;} catch {cleanupFailed = true;}
      closePromise = allClosed.then(() => {
        signal.removeEventListener('abort', abort);
        for (const remove of listeners) remove();
        chunks = [];
        if (cleanupFailed) throw new Error('comparison-process-cleanup-failed');
      });
      void closePromise.catch(() => {});
    }
    return closePromise;
  }};
  const fail = () => {failure = true; void resource.close().catch(() => {});};
  const abort = () => fail();
  observe(child, 'error', fail);
  observe(child, 'exit', ((code: number | null, signalValue: NodeJS.Signals | null) => {exited = true; exitCode = code; exitSignal = signalValue;}) as (...args: unknown[]) => void);
  for (const stream of streams) observe(stream, 'error', fail);
  observe(child.stdout, 'end', (() => {eof = true;}) as () => void);
  observe(child.stdout, 'data', ((chunk: unknown) => {
    if (!Buffer.isBuffer(chunk)) {fail(); return;}
    if (chunk.length) dirty = true;
    if ('cap' in policy) {
      if (chunk.length > policy.cap - count) {fail(); return;}
      count += chunk.length; chunks.push(chunk);
    }
  }) as (...args: unknown[]) => void);
  observe(child.stderr, 'data', ((chunk: unknown) => {if (!Buffer.isBuffer(chunk) || chunk.length) fail();}) as (...args: unknown[]) => void);
  signal.addEventListener('abort', abort, {once: true});
  if (signal.aborted) abort();
  const result = allClosed.then(async () => {
    if (failure || !exited || !eof || exitCode !== 0 || exitSignal !== null) {await resource.close(); throw new Error('comparison-process-failed');}
    const stdout = Buffer.concat(chunks, count);
    await resource.close();
    if (failure || !exited || !eof || exitCode !== 0 || exitSignal !== null) throw new Error('comparison-process-failed');
    return {stdout, dirty};
  });
  void result.catch(() => {});
  return {resource, result, async write(bytes) {
    try {await writeComparisonPipe(child.stdin, bytes);} catch {fail(); throw new Error('comparison-process-stdin-failed');}
  }};
}

async function writeComparisonPipe(stream: Writable, bytes: Buffer): Promise<void> {
  for (let offset = 0; offset < bytes.length; offset += 65536) {
    await new Promise<void>((resolve, reject) => {
      let returned = false, needsDrain = false, callback = false, drained = false, settled = false;
      const remove = () => {stream.off('error', fail); stream.off('close', fail); stream.off('drain', drain);};
      const fail = () => {if (!settled) {settled = true; remove(); reject(new Error('comparison-pipe-write-failed'));}};
      const finish = () => {if (!settled && returned && callback && (!needsDrain || drained)) {settled = true; remove(); resolve();}};
      const drain = () => {drained = true; finish();};
      stream.on('error', fail); stream.on('close', fail); stream.on('drain', drain);
      try {
        needsDrain = !stream.write(bytes.subarray(offset, Math.min(offset + 65536, bytes.length)), error => {if (error) fail(); else {callback = true; finish();}});
        returned = true; finish();
      } catch {fail();}
    });
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const remove = () => {stream.off('error', fail); stream.off('close', fail); stream.off('finish', finish);};
    const fail = () => {if (!settled) {settled = true; remove(); reject(new Error('comparison-pipe-end-failed'));}};
    const finish = () => {if (!settled) {settled = true; remove(); resolve();}};
    stream.on('error', fail); stream.on('close', fail); stream.on('finish', finish);
    try {stream.end();} catch {fail();}
  });
}
