/** Inert supplied-data checks only. Acceptance never establishes an original native fact. */
import { ordinaryPath, assertInventory, assertOriginalCommand, type OriginalCommand, type FileFact } from './hosted-copilot-contract.ts';
export const MOUNTED_POLICY_LIMITS = Object.freeze({ files: 128, bytes: 33554432, packages: 19, imports: 64, resolutions: 10,
  registrationHistory: 2, leases: 2, caseWitnesses: 19, globalWitnesses: 10, stdio: 8, parentStream: 4194304, applicationStream: 262144 });
export const MOUNTED_PACKAGE_PINS = freeze({
  "apps/copilotkit/node_modules/@copilotkit/runtime": {
    "version": "1.78.0",
    "integrity": "sha512-UcajG47iE3fxMY29soNT0qFKTbPE2/ThU4jFtbhEo1perTn674Mks3TI4xQ9Iys3Ke9IB0bHrADsHhblcb2WKg=="
  },
  "node_modules/@ag-ui/client": {
    "version": "1.0.2",
    "integrity": "sha512-BPxcQBPxJZi7XiQI8eBpiE6KBcySjD6hV7XWQhezYbLeK9WJkcUZ6RhX5dngWw+VgfapxPdJdEDTV/JxF21Duw=="
  },
  "node_modules/@ag-ui/core": {
    "version": "1.0.2",
    "integrity": "sha512-lb0YfvHY4eTHcXthTWzXjsElLqycGWDhaXGTejwMkUV5TtJVZircRS12/tMpqzd32sL+WZ2PWQ4m0+ThKrGF8A=="
  },
  "node_modules/@ag-ui/encoder": {
    "version": "1.0.2",
    "integrity": "sha512-SE8pQ7dpXwtqpD1WzW2Of9h4uZRDPVGZqT7kdrQ17w9+eOxAolqqRybVLBqJTqCZiUNgX0hFUNlAJSOV0z0UDg=="
  },
  "node_modules/@hono/node-server": {
    "version": "1.19.17",
    "integrity": "sha512-dSneS5qhiauZWGDCeK4o695Xd9nUNjviSZCMQrj10eetr8Uln1ucn6bbphOM6UynAMMtNIzZNSpL9vnASJwrPQ=="
  },
  "node_modules/rxjs": {
    "version": "7.8.1",
    "integrity": "sha512-AA3TVj+0A2iuIoQkWEK/tqFjBq2j+6PO6Y0zJcvzLAFhEFIO3HL0vls9hWLncZbAAbK0mar7oZ4V079I/qPMxg=="
  },
  "node_modules/@copilotkit/aimock": {
    "version": "1.45.1",
    "integrity": "sha512-JYf6ThCKD8eNMVm0PYsfu1wASy2E2T8VCVoWnEpWHNV2QiSv4yMJ6JHTPm5Gp76azKqme2F43L6siFA1gU7UKQ=="
  },
  "node_modules/playwright": {
    "version": "1.64.0",
    "integrity": "sha512-kVzTnYFYEyQ9RGzBjNCd2+yEqWmVbxl3AHPynv3qQ6JTjv4a+kwRcnqQwIpuP3NnrnIrE/Q6wWAIAvMfIE2/Yg=="
  },
  "node_modules/playwright-core": {
    "version": "1.64.0",
    "integrity": "sha512-T9r+MZkTECl2+oUcZ26YgZzTrYidTsIhYYkJix+6iDOymOb1FB2RLLSOxRGnZGv5DStt+aduIVbt+E8WygXYpg=="
  },
  "node_modules/zod": {
    "version": "4.6.5",
    "integrity": "sha512-v5l/aFXZQeai4awLbOpSoHecE9UiMrnfx75tEXLjNonXVARxQ5mOeipTjROUchszUNCqnE+hqAMujRsRHsut2Q=="
  },
  "node_modules/parse5": {
    "version": "7.3.0",
    "integrity": "sha512-IInvU7fabl34qmi9gY8XOVxhYyMyuH2xUNpb2q8/Y+7552KlejkRvqvD19nMoUW/uQGGbqNpA6Tufu5FL5BZgw=="
  },
  "node_modules/rolldown": {
    "version": "1.2.13",
    "integrity": "sha512-/5apOkwWxtACcQtZ5WlrAsKS4JwXVThQPJZ3RqIruRY9UG9M8e0VlXN068xum/JRKA4aIUoJ13ghe/kGCvidiQ=="
  },
  "node_modules/lightningcss": {
    "version": "1.33.0",
    "integrity": "sha512-WkUDrojuJs0xkgGf2udWxa3yGBRxPtxUkB79i6aCZLRgc7PM8fZe9TosfPDcvEpQZbuFASnHYmRLBLUbmLOIIA=="
  },
  "node_modules/vite": {
    "version": "8.3.4",
    "integrity": "sha512-IftLE8phJhdNRIGNEV4JCCvfNScoZQVfcXaN8TQropWGJtOHcu+iAB9pHcuGvmEb/kddw0LBe/jS8ztdC6xdiQ=="
  },
  "node_modules/typescript": {
    "version": "7.0.2",
    "integrity": "sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA=="
  },
  "node_modules/@copilotkit/react-core": {
    "version": "1.78.0",
    "integrity": "sha512-Y8/W4HWFvfnmFkGjDloYdYjX9zSmcEjWGOSAJIpBjjAKRJV+gop1nhok0lIqPFq3K496mZzFeLYVNxDodIB85A=="
  },
  "node_modules/@copilotkit/core": {
    "version": "1.78.0",
    "integrity": "sha512-jaBvkiRJ4wTo16UylwfB3ASg2HzGkCiRp1EQa4KwS7Y1dS88LKmTQXzd5n8BO8G8cQsV2Mg/swIYNV4J9lSlIg=="
  },
  "node_modules/react": {
    "version": "19.3.0",
    "integrity": "sha512-E8LUcbtBWt20bbl2YoHfx4ZDBdxVTfOKtCZn9cDSJ4l6/nuoApcpIBcj47t2wZoVX8g2ZHuMHbiShgCR1T5Sog=="
  },
  "node_modules/react-dom": {
    "version": "19.3.0",
    "integrity": "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q=="
  }
});
export type PolicyReason = 'invalid-shape' | 'cardinality-cap' | 'invalid-scalar' | 'mounted-purpose' | 'mounted-context' |
  'source-mismatch' | 'source-inventory' | 'lock-mismatch' | 'profile-mismatch' | 'installed-source-mismatch' |
  'installed-profile-mismatch' | 'install-stream-overflow' | 'install-original-incomplete' | 'install-original-failed' |
  'native-output-path' | 'native-output' | 'native-imports-missing' | 'native-import' | 'native-resolution' |
  'origin-ledger' | 'origin-not-leased' | 'origin-listen-unobserved' | 'origin-already-registered' | 'channel-denied' |
  'origin-original-incomplete' | 'origin-original-failed' | 'control-endpoint-mismatch' | 'control-reuse' | 'witness-schema' |
  'witness-contradiction' | 'case-chain' | 'case-identity-reuse' | 'premature-case2' | 'original-failed' | 'original-incomplete' |
  'case-incomplete' | 'parent-stream-overflow' | 'parent-stream-contradiction' | 'parent-original-incomplete' | 'parent-original-failed';
export type PolicyAuthority = Readonly<{ input: 'supplied-data'; sourceAuthenticated: false; prerequisiteQualified: false;
  installedGraphQualified: false; nativeImportQualified: false; originalClosureQualified: false; runtimeAdmission: false; qualification: false }>;
export type PolicyResult<F> = Readonly<{ schemaVersion: 1; status: 'accepted' | 'invalid' | 'unavailable'; reason: PolicyReason | null;
  facts: F | null; authority: PolicyAuthority }>;
export type MountedContext = Readonly<{ candidateSha: string; checkoutSha: string; githubSha: string; workflowSha: string; tagSha: string;
  repository: string; releaseId: string; githubRef: string; workflowRef: string; eventName: string; actions: string;
  platform: string; runnerOs: string; runnerMarker: string; attempt: string }>;
export type SourceFacts = Readonly<{ commitSha: string; treeSha: string; lockSha256: string; files: readonly Readonly<FileFact>[] }>;
export type PrerequisiteFacts = Readonly<{ originalRunId: string; attempt: 1; sourceSha: string; artifactId: string; archiveSha256: string;
  qualifiedRootReceiptSha256: string; qualifiedPeerReceiptSha256: string; frontendSettingsSha256: string }>;
export type PreInstallIntent = Readonly<{ schemaVersion: 1; kind: 'pre-install-intent'; purpose: string; context: MountedContext; source: SourceFacts;
  prerequisite: PrerequisiteFacts; profile: Readonly<{ nodeVersion: string; npmVersion: string; telemetryDisabled: string; doNotTrack: string }> }>;
export type PackageFact = Readonly<{ path: string; version: string; integrity: string; manifestSha256: string; regular: boolean; contained: boolean; symlink: boolean }>;
export type PostInstallAdmission = Readonly<{ schemaVersion: 1; kind: 'post-install-admission'; intent: PreInstallIntent; originalInstall: Readonly<OriginalCommand>;
  installedProfile: Readonly<{ sourceSha: string; lockSha256: string; originalInstallReceiptSha256: string; hiddenLockReceiptSha256: string;
  checkedInstalledRecords: number; packages: readonly PackageFact[] }> }>;
export type AdmissionFacts = Readonly<{ phase: 'pre-install' | 'post-install'; sourceSha: string; treeSha: string; sourceFiles: number;
  sourceBytes: number; lockSha256: string; installedPackages?: 19; checkedInstalledRecords?: number }>;
export type NativeImport = Readonly<{ specifier: string; kind: 'static' | 'dynamic-literal' | 'dynamic-computed'; resolutionIndex: number | null }>;
export type NativeResolution = Readonly<{ specifier: string; publicSpecifier: string; publicEntryPath: string; packagePath: string; version: string; integrity: string; entryPath: string;
  regular: boolean; contained: boolean; symlink: boolean }>;
export type MountedModuleInput = Readonly<{ schemaVersion: 1; sourceSha: string; runId: string; workerPath: string;
  emitted: readonly Readonly<{ path: string; kind: 'chunk' | 'asset'; format: 'es' | 'cjs'; entry: boolean; bytes: number; sha256: string }>[];
  imports: readonly NativeImport[]; resolutions: readonly NativeResolution[]; executedCopySha256: string }>;
/** Supplied opaque commitments; these fields never qualify historical native behavior. */
export type TrackerANativePrerequisite = Readonly<{ sourceSha: string; sourceTreeSha: string; originalRunId: string; attempt: 1;
  workflowId: number; workflowPath: string; releaseId: string; artifactId: string; archiveSha256: string; archiveBytes: number;
  qualifiedRootReceiptSha256: string; qualifiedPeerReceiptSha256: string; frontendSettingsSha256: string; qualification: false }>;
export type MountedTrackerAPilotPrerequisites = Readonly<{ intent: PreInstallIntent; installed: PostInstallAdmission;
  module: MountedModuleInput; nativePrerequisite: TrackerANativePrerequisite }>;
export type ModuleFacts = Readonly<{ sourceSha: string; workerPath: string; workerSha256: string; importOccurrences: number; packageResolutions: number }>;
export type OriginRole = 'native-case' | 'independent-producer';
export type CaseJourney = 'follow' | 'history-reading';
export type OriginalStatus = 'fulfilled' | 'pending' | 'rejected' | 'timed-out' | 'unavailable';
export type OriginLease = Readonly<{ role: OriginRole; origin: string; caseId: CaseJourney; threadId: string }>;
export type OriginAction = Readonly<{ kind: 'register'; role: OriginRole; origin: string; listenObserved: boolean }> |
  Readonly<{ kind: 'request'; role: OriginRole; origin: string; channel: 'native-fetch' | 'page-http' | 'page-websocket'; method: string; path: string }> |
  Readonly<{ kind: 'release'; role: OriginRole; origin: string; originalClose: OriginalStatus }>;
export type OriginTransition = Readonly<{ schemaVersion: 1; kind: 'origin-transition'; caseId: CaseJourney; threadId: string;
  registrationHistory: readonly OriginLease[]; leases: readonly OriginLease[]; action: OriginAction }>;
export type ControlConnect = Readonly<{ schemaVersion: 1; kind: 'control-connect'; boundEndpoint: string; requestedEndpoint: string; priorConnectCount: number }>;
export type OriginFacts = Readonly<{ kind: 'origin-transition'; registrationHistory: readonly OriginLease[]; leases: readonly OriginLease[];
  nextLeaseCount: number; request: Readonly<{ channel: string; method: string; path: string }> | null }> |
  Readonly<{ channel: 'playwright-control'; endpoint: string; connectCount: 1 }>;
export type Witness = Readonly<{ label: string; status: OriginalStatus }>;
export type CaseRecord = Readonly<{ caseNumber: 1 | 2; journey: CaseJourney; threadId: string; seedRunId: string; continuationRunId: string;
  repetition: string; completed: boolean; publicIdle: boolean; storeEmpty: boolean; domainReleased: boolean; originals: readonly Witness[] }>;
export type StreamFacts = Readonly<{ readableEOF: boolean; writerFinish: boolean; writerClose: boolean; writerError: boolean;
  seen: number; retained: number; retainedBytesKnown: boolean }>;
export type StdioFact = Readonly<{ index: number; kind: 'stdout' | 'stderr' | 'protocol'; status: OriginalStatus;
  coverage: 'post-bind-only'; seenBytes: number | null; retainedBytes: number | null }>;
export type CaseBoundary = Readonly<{ schemaVersion: 1; kind: 'case-boundary'; priorCase: CaseRecord | null; currentCase: CaseRecord; secondStarted: boolean }>;
export type GlobalFinal = Readonly<{ schemaVersion: 1; kind: 'global-final'; cases: readonly CaseRecord[]; originals: readonly Witness[];
  applicationExit: Readonly<{ exitCode: number | null; signal: string | null }>; stdio: readonly StdioFact[];
  parentCommand: Readonly<{ original: Readonly<OriginalCommand>; stdout: StreamFacts; stderr: StreamFacts }> }>;
export type ClosureFacts = Readonly<{ kind: 'case-boundary'; caseNumber: 1 | 2; originalWitnesses: 19; nextCasePermitted: boolean }> |
  Readonly<{ kind: 'global-final'; cases: 2; caseOriginalWitnesses: 38; globalOriginalWitnesses: 10; availableStdio: number;
  applicationExit: Readonly<{ exitCode: number | null; signal: string | null }>; parentCoverage: 'spawn-complete'; applicationCoverage: 'post-bind-partial' }>;
class Denied extends Error { readonly reason: PolicyReason; readonly status: 'invalid' | 'unavailable';
  constructor(reason: PolicyReason, status: 'invalid' | 'unavailable' = 'invalid') { super(reason); this.reason = reason; this.status = status; } }
const deny = (reason: PolicyReason, status: 'invalid' | 'unavailable' = 'invalid'): never => { throw new Denied(reason, status); };
function freeze<T>(owned: T): T { if (typeof owned === 'object' && owned !== null) { for (const value of Object.values(owned)) freeze(value); Object.freeze(owned); } return owned; }
function evaluate<F>(work: () => F): PolicyResult<F> {
  const authority: PolicyAuthority = { input: 'supplied-data', sourceAuthenticated: false, prerequisiteQualified: false, installedGraphQualified: false,
    nativeImportQualified: false, originalClosureQualified: false, runtimeAdmission: false, qualification: false };
  try { return freeze({ schemaVersion: 1, status: 'accepted', reason: null, facts: work(), authority }); }
  catch (e) { return freeze({ schemaVersion: 1, status: e instanceof Denied ? e.status : 'invalid', reason: e instanceof Denied ? e.reason : 'invalid-shape', facts: null, authority }); }
}
// Shape/cap pass copies own data only, before any scalar or semantic evaluation.
type Data = Record<string, unknown>;
type Shape = { type: 'record'; fields: Record<string, Shape> } | { type: 'array'; item: Shape; maximum: number; exact: number | null } |
  { type: 'value'; stringCap: number } | { type: 'nullable'; inner: Shape };
const value = (stringCap = 128): Shape => ({ type: 'value', stringCap });
const shape = (fields: Record<string, Shape>): Shape => ({ type: 'record', fields });
const list = (item: Shape, maximum: number, exact: number | null = null): Shape => ({ type: 'array', item, maximum, exact });
const nullable = (inner: Shape): Shape => ({ type: 'nullable', inner });
function own(input: unknown, key: string): unknown { if (typeof input !== 'object' || input === null) return deny('invalid-shape');
  const d = Object.getOwnPropertyDescriptor(input, key); if (!d || !('value' in d)) return deny('invalid-shape'); return d.value as unknown; }
function copy(input: unknown, spec: Shape, checkStringCaps = true): unknown {
  // Defer string refusals until the bounded graph's descriptors/shapes are checked.
  // Array length admission remains immediate, before own-key or element traversal.
  let stringCapExceeded = false;
  const visit = (input: unknown, spec: Shape): unknown => {
  if (spec.type === 'nullable') return input === null ? null : visit(input, spec.inner);
  if (spec.type === 'value') { if (typeof input === 'string' && input.length > spec.stringCap) stringCapExceeded = true; return input; }
  if (spec.type === 'array') {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return deny('invalid-shape');
    const length = own(input, 'length'); if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) return deny('invalid-shape');
    if (length > spec.maximum || spec.exact !== null && length !== spec.exact) return deny('cardinality-cap');
    if (Reflect.ownKeys(input).length !== length + 1) return deny('invalid-shape');
    const out: unknown[] = []; for (let i = 0; i < length; i++) out.push(visit(own(input, String(i)), spec.item)); return out;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return deny('invalid-shape');
  const prototype = Object.getPrototypeOf(input); if (prototype !== Object.prototype && prototype !== null) return deny('invalid-shape');
  const keys = Object.keys(spec.fields), actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some(k => typeof k !== 'string' || !keys.includes(k))) return deny('invalid-shape');
  const out: Data = Object.create(null) as Data; for (const key of keys) out[key] = visit(own(input, key), spec.fields[key]!); return out;
  };
  const out = visit(input, spec);
  if (checkStringCaps && stringCapExceeded) return deny('cardinality-cap');
  return out;
}
const fields = (keys: readonly string[], cap = 128): Record<string, Shape> => Object.fromEntries(keys.map(key => [key, value(cap)]));
const R = (v: unknown): Data => v as Data;
const A = (v: unknown): unknown[] => v as unknown[];
function S(v: unknown, maximum = 128, minimum = 1): string {
  if (typeof v !== 'string' || v.length < minimum || v.length > maximum || /[^\x20-\x7e]/.test(v)) return deny('invalid-scalar'); return v;
}
function N(v: unknown, maximum = Number.MAX_SAFE_INTEGER, minimum = 0): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < minimum || v > maximum) return deny('invalid-scalar'); return v;
}
function B(v: unknown): boolean { if (typeof v !== 'boolean') return deny('invalid-scalar'); return v; }
function E<T extends string>(v: unknown, choices: readonly T[]): T { const s = S(v); if (!choices.includes(s as T)) return deny('invalid-scalar'); return s as T; }
function H(v: unknown, length = 64): string { const s = S(v, length); if (s.length !== length || /[^a-f0-9]/.test(s)) return deny('invalid-scalar'); return s; }
function ID(v: unknown): string { const s = S(v); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(s)) return deny('invalid-scalar'); return s; }
function numericID(v: unknown): string { const s = S(v, 20); if (!/^[1-9][0-9]*$/.test(s)) return deny('invalid-scalar'); return s; }
function P(v: unknown): string { const s = S(v, 1024); if (!ordinaryPath(s)) return deny('invalid-scalar'); return s; }
function V(v: unknown): 1 { if (v !== 1) return deny('invalid-scalar'); return 1; }
const lockSHA = 'c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56';
const contextKeys = ['candidateSha','checkoutSha','githubSha','workflowSha','tagSha','repository','releaseId','githubRef','workflowRef','eventName','actions','platform','runnerOs','runnerMarker','attempt'];
const fileShape = shape({ path: value(1024), bytes: value(), sha256: value(64), regular: value(), contained: value(), symlink: value() });
const sourceShape = shape({ commitSha: value(40), treeSha: value(40), lockSha256: value(64), files: list(fileShape,128) });
const prerequisiteShape = shape({ originalRunId:value(20), attempt:value(), sourceSha:value(40), artifactId:value(20), ...fields(['archiveSha256','qualifiedRootReceiptSha256','qualifiedPeerReceiptSha256','frontendSettingsSha256'],64) });
const contextShape = shape({ ...fields(contextKeys), ...fields(['candidateSha','checkoutSha','githubSha','workflowSha','tagSha'],40), releaseId:value(64), workflowRef:value(256) });
const intentShape = shape({ schemaVersion:value(), kind:value(), purpose:value(), context:contextShape, source:sourceShape,
  prerequisite:prerequisiteShape, profile:shape(fields(['nodeVersion','npmVersion','telemetryDisabled','doNotTrack'])) });
const commandShape = shape(fields(['exitCode','signal','stdoutBytes','stderrBytes','stdoutRetainedBytes','stderrRetainedBytes','closed','streamsComplete'],64));
const packageShape = shape({ path:value(1024),version:value(),integrity:value(256),manifestSha256:value(64),regular:value(),contained:value(),symlink:value() });
const postShape = shape({ schemaVersion:value(),kind:value(),intent:intentShape,originalInstall:commandShape,
  installedProfile:shape({ sourceSha:value(40),lockSha256:value(64),originalInstallReceiptSha256:value(64),hiddenLockReceiptSha256:value(64),checkedInstalledRecords:value(),packages:list(packageShape,19,19) }) });
function declaredCommand(input: unknown): OriginalCommand {
  const r=R(input); const result={exitCode:r.exitCode===null?null:N(r.exitCode),signal:r.signal===null?null:S(r.signal,64),stdoutBytes:N(r.stdoutBytes),stderrBytes:N(r.stderrBytes),
    stdoutRetainedBytes:N(r.stdoutRetainedBytes),stderrRetainedBytes:N(r.stderrRetainedBytes),closed:B(r.closed),streamsComplete:B(r.streamsComplete)};
  return result;
}
function commandConsistent(result: OriginalCommand): boolean {
  return result.stdoutRetainedBytes<=result.stdoutBytes && result.stderrRetainedBytes<=result.stderrBytes &&
    (!result.streamsComplete || result.stdoutRetainedBytes===result.stdoutBytes && result.stderrRetainedBytes===result.stderrBytes);
}
function parseIntent(r: Data): PreInstallIntent {
  V(r.schemaVersion); E(r.kind,['pre-install-intent']); const purpose=S(r.purpose); const c=R(r.context),source=R(r.source),q=R(r.prerequisite),profile=R(r.profile);
  const context=Object.fromEntries(contextKeys.map(key=>[key,S(c[key],256)])) as unknown as MountedContext;
  for (const key of ['candidateSha','checkoutSha','githubSha','workflowSha','tagSha']) H(c[key],40);
  const files=A(source.files).map(v=> {const f=R(v);return {path:P(f.path),bytes:N(f.bytes),sha256:H(f.sha256),regular:B(f.regular),contained:B(f.contained),symlink:B(f.symlink)};});
  const parsedSource={commitSha:H(source.commitSha,40),treeSha:H(source.treeSha,40),lockSha256:H(source.lockSha256),files};
  const prerequisite: PrerequisiteFacts={originalRunId:numericID(q.originalRunId),attempt:V(q.attempt),sourceSha:H(q.sourceSha,40),artifactId:numericID(q.artifactId),
    archiveSha256:H(q.archiveSha256),qualifiedRootReceiptSha256:H(q.qualifiedRootReceiptSha256),qualifiedPeerReceiptSha256:H(q.qualifiedPeerReceiptSha256),frontendSettingsSha256:H(q.frontendSettingsSha256)};
  const parsedProfile={nodeVersion:S(profile.nodeVersion),npmVersion:S(profile.npmVersion),telemetryDisabled:S(profile.telemetryDisabled),doNotTrack:S(profile.doNotTrack)};
  return {schemaVersion:1,kind:'pre-install-intent',purpose,context,source:parsedSource,prerequisite,profile:parsedProfile};
}
function sourceCap(r: Data): void { let bytes=0; for(const v of A(R(r.source).files)) {const n=R(v).bytes;if(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0) bytes+=n;}
  if(bytes>MOUNTED_POLICY_LIMITS.bytes) deny('cardinality-cap'); }
type AdmissionProfile = 'ordinary' | 'tracker-a';
function intentSemantics(v: PreInstallIntent, profile: AdmissionProfile): AdmissionFacts {
  const pilot=profile==='tracker-a',c=v.context;
  const release=pilot?'hosted-copilot-react-tracker-json-a-v12':'hosted-copilot-react-h100-r6400-v19',ref=`refs/tags/${release}`;
  const workflow=pilot?'.github/workflows/hosted-copilot-tracker-a.yml':'.github/workflows/hosted-copilot-mounted.yml';
  if(v.purpose!==(pilot?'hosted-copilot-mounted-tracker-json-a-pilot-only':'hosted-copilot-mounted-default-react-only')) return deny('mounted-purpose');
  if(c.repository!=='cacheplane/chat-ui-bench'||c.releaseId!==release||c.githubRef!==ref||c.workflowRef!==`cacheplane/chat-ui-bench/${workflow}@${ref}`||
    c.eventName!=='workflow_dispatch'||c.actions!=='true'||c.platform!=='linux'||c.runnerOs!=='Linux'||c.runnerMarker!==(pilot?'ubuntu-24.04-hosted-copilot-tracker-a':'ubuntu-24.04-hosted-copilot-mounted')||c.attempt!=='1') return deny('mounted-context');
  if([c.checkoutSha,c.githubSha,c.workflowSha,c.tagSha,v.source.commitSha].some(s=>s!==c.candidateSha)) return deny('source-mismatch');
  let inventory; try {inventory=assertInventory(v.source.files);}catch {return deny('source-inventory');}
  const required=['package-lock.json','.github/workflows/hosted-copilot-mounted.yml','tools/hosted-copilot-mounted-bootstrap.mjs','apps/copilotkit/hosted-native-entry.ts','apps/copilotkit/src/geometry-policy.ts'];
  if(pilot) required.push('.github/workflows/hosted-copilot-tracker-a.yml','apps/copilotkit/runtime/mounted-tracker-a.ts','apps/copilotkit/runtime/mounted-tracker-a-trace.ts',
    'tests/copilotkit-mounted-tracker-a.test.ts','tests/copilotkit-mounted-tracker-a-trace.test.ts');
  if(required.some(path=>!v.source.files.some(f=>f.path===path))) return deny('source-inventory');
  if(v.source.lockSha256!==lockSHA||v.source.files.find(f=>f.path==='package-lock.json')!.sha256!==lockSHA) return deny('lock-mismatch');
  if(v.profile.nodeVersion!=='v24.20.0'||v.profile.npmVersion!=='11.19.0'||v.profile.telemetryDisabled!=='true'||v.profile.doNotTrack!=='1') return deny('profile-mismatch');
  return {phase:'pre-install',sourceSha:v.source.commitSha,treeSha:v.source.treeSha,sourceFiles:inventory.files.length,sourceBytes:inventory.bytes,lockSha256:v.source.lockSha256};
}
const pin = (path: string): Readonly<{version:string;integrity:string}> | undefined => Object.hasOwn(MOUNTED_PACKAGE_PINS,path)?MOUNTED_PACKAGE_PINS[path as keyof typeof MOUNTED_PACKAGE_PINS]:undefined;
export function evaluateMountedTrackerAAdmissionPolicy(input: unknown): PolicyResult<AdmissionFacts> { return admissionPolicy(input,'tracker-a'); }
export function evaluateMountedAdmissionPolicy(input: unknown): PolicyResult<AdmissionFacts> { return admissionPolicy(input,'ordinary'); }
function admissionPolicy(input: unknown, selected: AdmissionProfile): PolicyResult<AdmissionFacts> { return evaluate(()=> {
  const kind=E(own(input,'kind'),['pre-install-intent','post-install-admission']);const r=R(copy(input,kind==='pre-install-intent'?intentShape:postShape));
  const raw=kind==='pre-install-intent'?r:R(r.intent);sourceCap(raw);const intent=parseIntent(raw);
  if(kind==='pre-install-intent') return intentSemantics(intent,selected);
  V(r.schemaVersion);const original=declaredCommand(r.originalInstall),p=R(r.installedProfile);
  const profile={sourceSha:H(p.sourceSha,40),lockSha256:H(p.lockSha256),originalInstallReceiptSha256:H(p.originalInstallReceiptSha256),hiddenLockReceiptSha256:H(p.hiddenLockReceiptSha256),
    checkedInstalledRecords:N(p.checkedInstalledRecords,4096,19),packages:A(p.packages).map(x=>{const q=R(x);return {path:P(q.path),version:S(q.version),integrity:S(q.integrity,256),manifestSha256:H(q.manifestSha256),regular:B(q.regular),contained:B(q.contained),symlink:B(q.symlink)};})};
  if(!commandConsistent(original)) return deny('invalid-scalar');
  const facts=intentSemantics(intent,selected);
  if(profile.sourceSha!==intent.source.commitSha||profile.lockSha256!==intent.source.lockSha256) return deny('installed-source-mismatch');
  const seen=new Set<string>();for(const q of profile.packages) {const expected=pin(q.path);if(!expected||seen.has(q.path)||q.version!==expected.version||q.integrity!==expected.integrity||!q.regular||!q.contained||q.symlink) return deny('installed-profile-mismatch');seen.add(q.path);}
  if(original.stdoutBytes>MOUNTED_POLICY_LIMITS.parentStream||original.stderrBytes>MOUNTED_POLICY_LIMITS.parentStream) return deny('install-stream-overflow');
  if(!original.closed||!original.streamsComplete) return deny('install-original-incomplete','unavailable');
  if(!assertOriginalCommand(original).success) return deny('install-original-failed','unavailable');
  return {...facts,phase:'post-install',installedPackages:19,checkedInstalledRecords:profile.checkedInstalledRecords};
}); }
export const MOUNTED_MODULE_PACKAGE_SPECIFIERS: Readonly<Record<string,string>>=Object.freeze({'@copilotkit/runtime/v2':'apps/copilotkit/node_modules/@copilotkit/runtime','@copilotkit/runtime/v2/hono':'apps/copilotkit/node_modules/@copilotkit/runtime',
  '@ag-ui/client':'node_modules/@ag-ui/client','@ag-ui/core':'node_modules/@ag-ui/core','@ag-ui/core/schemas':'node_modules/@ag-ui/core','@hono/node-server':'node_modules/@hono/node-server',
  'rxjs':'node_modules/rxjs','@copilotkit/aimock/agui':'node_modules/@copilotkit/aimock','playwright':'node_modules/playwright','zod':'node_modules/zod'});
export const MOUNTED_MODULE_BUILTINS: readonly string[]=Object.freeze(['node:http','node:crypto','node:fs/promises','node:path','node:url','node:perf_hooks']);
/** One reviewed external rewrite; compiler IDs retain the original logical map. */
export const WORKER_ZOD_PUBLIC_BINDING = Object.freeze({publicSpecifier:'zod',rawSpecifier:'../../../../node_modules/zod/index.js',packagePath:'node_modules/zod',sourceParent:'packages/contract/src/fixture.ts'} as const);
export interface WorkerPublicPackage {readonly publicSpecifier:string;readonly packagePath:string}
export interface WorkerPublicEntry {readonly publicSpecifier:string;readonly rawUrl:string;readonly publicUrl:string}
export function lookupWorkerPublicPackage(raw:unknown):Readonly<WorkerPublicPackage>|null {
  if(typeof raw!=='string'||raw.length===0||raw.length>128)return null;
  if(raw===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier)return Object.freeze({publicSpecifier:'zod',packagePath:'node_modules/zod'});
  if(raw==='zod'||!Object.hasOwn(MOUNTED_MODULE_PACKAGE_SPECIFIERS,raw))return null;
  return Object.freeze({publicSpecifier:raw,packagePath:MOUNTED_MODULE_PACKAGE_SPECIFIERS[raw]!});
}
/** Explicit resolver port only: URL/profile checks are not filesystem authority. */
export function resolveMountedPublicEntry(raw:unknown,workerParentUrl:unknown,sourceRootUrl:unknown,resolvePublic:(specifier:string,parent:string)=>string):Readonly<WorkerPublicEntry> {
  const failure=():never=>{throw new Error('Worker public binding denied');};
  const canonicalFile=(value:unknown):value is string=>{
    if(typeof value!=='string'||value.length===0||value.length>4096||/[\x00-\x20\x7f]/.test(value)||/%(?:2e|2f|5c)/i.test(value))return false;
    try{const url=new URL(value);return url.href===value&&url.protocol==='file:'&&url.host===''&&!url.search&&!url.hash&&!url.pathname.includes('//');}catch{return false;}
  };
  const binding=lookupWorkerPublicPackage(raw);
  if(!binding||typeof raw!=='string'||!canonicalFile(sourceRootUrl)||!sourceRootUrl.endsWith('/')||!canonicalFile(workerParentUrl)||!workerParentUrl.startsWith(sourceRootUrl)||typeof resolvePublic!=='function')return failure();
  if(!/^apps\/copilotkit\/\.hosted-mounted\/[1-9][0-9]{0,19}-1\/worker\.mjs$/.test(workerParentUrl.slice(sourceRootUrl.length)))return failure();
  const rawUrl=resolvePublic(raw,workerParentUrl);
  const publicUrl=raw===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier?resolvePublic(binding.publicSpecifier,new URL(WORKER_ZOD_PUBLIC_BINDING.sourceParent,sourceRootUrl).href):rawUrl;
  const packageUrl=new URL(binding.packagePath+'/',sourceRootUrl).href;
  if(!canonicalFile(rawUrl)||!canonicalFile(publicUrl)||rawUrl!==publicUrl||!rawUrl.startsWith(packageUrl))return failure();
  return Object.freeze({publicSpecifier:binding.publicSpecifier,rawUrl,publicUrl});
}
const moduleShape=shape({schemaVersion:value(),sourceSha:value(40),runId:value(20),workerPath:value(1024),executedCopySha256:value(64),
  emitted:list(shape({path:value(1024),kind:value(),format:value(),entry:value(),bytes:value(),sha256:value(64)}),1,1),
  imports:list(shape({specifier:value(),kind:value(),resolutionIndex:value()}),64),
  resolutions:list(shape({specifier:value(),publicSpecifier:value(),publicEntryPath:value(1024),packagePath:value(1024),version:value(),integrity:value(256),entryPath:value(1024),regular:value(),contained:value(),symlink:value()}),10)});
export function evaluateMountedModulePolicy(input: unknown): PolicyResult<ModuleFacts> {return evaluate(()=> {
  const r=R(copy(input,moduleShape));V(r.schemaVersion);const sourceSha=H(r.sourceSha,40),runId=numericID(r.runId),workerPath=P(r.workerPath),copyHash=H(r.executedCopySha256);
  const output=A(r.emitted).map(x=>{const q=R(x);return {path:P(q.path),kind:E(q.kind,['chunk','asset']),format:E(q.format,['es','cjs']),entry:B(q.entry),bytes:N(q.bytes),sha256:H(q.sha256)};})[0]!;
  const imports=A(r.imports).map(x=>{const q=R(x);return {specifier:S(q.specifier),kind:E(q.kind,['static','dynamic-literal','dynamic-computed']),resolutionIndex:q.resolutionIndex===null?null:N(q.resolutionIndex)};});
  const resolutions=A(r.resolutions).map(x=>{const q=R(x);return {specifier:S(q.specifier),publicSpecifier:S(q.publicSpecifier),publicEntryPath:P(q.publicEntryPath),packagePath:P(q.packagePath),version:S(q.version),integrity:S(q.integrity,256),entryPath:P(q.entryPath),regular:B(q.regular),contained:B(q.contained),symlink:B(q.symlink)};});
  if(workerPath!==`apps/copilotkit/.hosted-mounted/${runId}-1/worker.mjs`) return deny('native-output-path');
  if(output.path!==workerPath||output.kind!=='chunk'||output.format!=='es'||!output.entry||output.bytes<1||output.bytes>16777216||output.sha256!==copyHash) return deny('native-output');
  if(imports.length===0) return deny('native-imports-missing');
  if(imports.some(i=>i.kind==='dynamic-computed'||i.specifier===WORKER_ZOD_PUBLIC_BINDING.rawSpecifier&&i.kind!=='static'||!MOUNTED_MODULE_BUILTINS.includes(i.specifier)&&lookupWorkerPublicPackage(i.specifier)===null)) return deny('native-import');
  const seen=new Set<string>(),used=new Set<number>();for(const q of resolutions) {const binding=lookupWorkerPublicPackage(q.specifier),expected=binding?pin(binding.packagePath):undefined;
    if(!binding||!expected||seen.has(q.specifier)||q.publicSpecifier!==binding.publicSpecifier||q.publicEntryPath!==q.entryPath||q.packagePath!==binding.packagePath||q.version!==expected.version||q.integrity!==expected.integrity||!q.entryPath.startsWith(q.packagePath+'/')||!q.regular||!q.contained||q.symlink) return deny('native-resolution');seen.add(q.specifier);}
  for(const i of imports) {if(MOUNTED_MODULE_BUILTINS.includes(i.specifier)) {if(i.resolutionIndex!==null) return deny('native-resolution');}
    else {if(i.resolutionIndex===null||resolutions[i.resolutionIndex]?.specifier!==i.specifier) return deny('native-resolution');used.add(i.resolutionIndex);}}
  if(used.size!==resolutions.length) return deny('native-resolution');
  return {sourceSha,workerPath,workerSha256:output.sha256,importOccurrences:imports.length,packageResolutions:resolutions.length};
});}
const trackerANativePrerequisiteShape=shape({sourceSha:value(40),sourceTreeSha:value(40),originalRunId:value(20),attempt:value(),workflowId:value(),
  workflowPath:value(1024),releaseId:value(64),artifactId:value(20),archiveSha256:value(64),archiveBytes:value(),
  qualifiedRootReceiptSha256:value(64),qualifiedPeerReceiptSha256:value(64),frontendSettingsSha256:value(64),qualification:value()});
const trackerAPrerequisitesShape=shape({intent:intentShape,installed:postShape,module:moduleShape,nativePrerequisite:trackerANativePrerequisiteShape});
export function evaluateMountedTrackerAPilotPrerequisites(input:unknown):PolicyResult<AdmissionFacts> {return evaluate(()=> {
  // Admit the entire bounded own-data graph before scalar checks or canonical comparison.
  const r=R(copy(input,trackerAPrerequisitesShape));
  const pre=evaluateMountedTrackerAAdmissionPolicy(r.intent),post=evaluateMountedTrackerAAdmissionPolicy(r.installed),module=evaluateMountedModulePolicy(r.module);
  for(const result of [pre,post,module]) if(result.status!=='accepted') deny(result.reason??'invalid-shape',result.status==='unavailable'?'unavailable':'invalid');
  const intent=parseIntent(R(r.intent)),installedIntent=parseIntent(R(R(r.installed).intent)),m=R(r.module);
  // Parser output is finite canonical own data; raw caller objects are never serialized.
  if(JSON.stringify(intent)!==JSON.stringify(installedIntent)||m.sourceSha!==intent.source.commitSha||m.runId!==intent.prerequisite.originalRunId) return deny('source-mismatch');
  const q=R(r.nativePrerequisite),qualification=B(q.qualification);if(qualification!==false) return deny('invalid-scalar');
  const native:TrackerANativePrerequisite={sourceSha:H(q.sourceSha,40),sourceTreeSha:H(q.sourceTreeSha,40),originalRunId:numericID(q.originalRunId),attempt:V(q.attempt),
    workflowId:N(q.workflowId),workflowPath:P(q.workflowPath),releaseId:S(q.releaseId,64),artifactId:numericID(q.artifactId),archiveSha256:H(q.archiveSha256),archiveBytes:N(q.archiveBytes,33554432,1),
    qualifiedRootReceiptSha256:H(q.qualifiedRootReceiptSha256),qualifiedPeerReceiptSha256:H(q.qualifiedPeerReceiptSha256),frontendSettingsSha256:H(q.frontendSettingsSha256),qualification};
  if(native.workflowId!==386692729||native.workflowPath!=='.github/workflows/hosted-copilot-mounted.yml'||native.releaseId!=='hosted-copilot-react-h100-r6400-v19') return deny('mounted-context');
  if(native.sourceSha!==intent.source.commitSha||native.sourceTreeSha!==intent.source.treeSha||native.frontendSettingsSha256!==intent.prerequisite.frontendSettingsSha256) return deny('source-mismatch');
  return post.facts!;
});}
const roleChoices=['native-case','independent-producer'] as const,journeys=['follow','history-reading'] as const,statuses=['fulfilled','pending','rejected','timed-out','unavailable'] as const;
const leaseShape=shape({role:value(),origin:value(64),caseId:value(),threadId:value()});
function httpOrigin(v:unknown):string {const s=S(v,64),m=/^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(s);if(!m||Number(m[1])>65535) return deny('invalid-scalar');return s;}
function endpoint(v:unknown):string {const s=S(v,4096),m=/^ws:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/([A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)$/.exec(s);
  if(!m||Number(m[1])>65535||m[2]!.length>2048||m[2]!.split('/').some(p=>p==='.'||p==='..')) return deny('invalid-scalar');return s;}
function parseLease(input:unknown):OriginLease {const r=R(input);return {role:E(r.role,roleChoices),origin:httpOrigin(r.origin),caseId:E(r.caseId,journeys),threadId:ID(r.threadId)};}
const sameLease=(a:OriginLease,b:OriginLease):boolean=>a.role===b.role&&a.origin===b.origin&&a.caseId===b.caseId&&a.threadId===b.threadId;
export function evaluateMountedOriginPolicy(input:unknown):PolicyResult<OriginFacts> {return evaluate(()=> {
  const kind=E(own(input,'kind'),['origin-transition','control-connect']);
  if(kind==='control-connect') {const r=R(copy(input,shape({schemaVersion:value(),kind:value(),boundEndpoint:value(4096),requestedEndpoint:value(4096),priorConnectCount:value()})));V(r.schemaVersion);
    const bound=endpoint(r.boundEndpoint),requested=endpoint(r.requestedEndpoint),prior=N(r.priorConnectCount,1);
    if(bound!==requested) return deny('control-endpoint-mismatch');if(prior!==0) return deny('control-reuse');return {channel:'playwright-control',endpoint:bound,connectCount:1};}
  // The selected action schema must be checked before outer string-cap refusal.
  const outerShape=shape({schemaVersion:value(),kind:value(),caseId:value(),threadId:value(),registrationHistory:list(leaseShape,2),leases:list(leaseShape,2),action:value()});
  const outer=R(copy(input,outerShape,false)),rawActionKind=own(outer.action,'kind');
  // With no selectable action schema, retain known outer caps before scalar refusal.
  if(rawActionKind!=='register'&&rawActionKind!=='request'&&rawActionKind!=='release') copy(input,outerShape);
  const actionKind=E(rawActionKind,['register','request','release']);
  const actionFields=actionKind==='register'?{...fields(['kind','role']),origin:value(64),listenObserved:value()}:actionKind==='release'?{...fields(['kind','role','originalClose']),origin:value(64)}:
    {...fields(['kind','role','channel']),origin:value(64),method:value(16),path:value(2048)};
  const r=R(copy(input,shape({schemaVersion:value(),kind:value(),caseId:value(),threadId:value(),registrationHistory:list(leaseShape,2),leases:list(leaseShape,2),action:shape(actionFields)})));V(r.schemaVersion);
  const caseId=E(r.caseId,journeys),threadId=ID(r.threadId),history=A(r.registrationHistory).map(parseLease),leases=A(r.leases).map(parseLease),action=R(r.action);
  const role=E(action.role,roleChoices),origin=httpOrigin(action.origin);
  const listen=actionKind==='register'?B(action.listenObserved):null,originalClose=actionKind==='release'?E(action.originalClose,statuses):null;
  const request=actionKind==='request'?{channel:E(action.channel,['native-fetch','page-http','page-websocket']),method:S(action.method,16),path:S(action.path,2048)}:null;
  const validLedger=(entries:readonly OriginLease[])=>new Set(entries.map(l=>l.role)).size===entries.length&&new Set(entries.map(l=>l.origin)).size===entries.length&&entries.every(l=>l.caseId===caseId&&l.threadId===threadId);
  if(!validLedger(history)||!validLedger(leases)||leases.some(l=>!history.some(h=>sameLease(l,h)))) return deny('origin-ledger');
  const output=(nextHistory:readonly OriginLease[],nextLeases:readonly OriginLease[],req:typeof request):OriginFacts=>({kind:'origin-transition',registrationHistory:nextHistory,leases:nextLeases,nextLeaseCount:nextLeases.length,request:req});
  if(actionKind==='register') {if(!listen) return deny('origin-listen-unobserved','unavailable');if(history.length>=2||history.some(h=>h.role===role||h.origin===origin)) return deny('origin-already-registered');
    const lease={role,origin,caseId,threadId};return output([...history,lease],[...leases,lease],null);}
  const existing=leases.find(l=>l.role===role&&l.origin===origin);if(!existing) return deny('origin-not-leased','unavailable');
  if(actionKind==='release') {if(originalClose!=='fulfilled') return deny(originalClose==='rejected'?'origin-original-failed':'origin-original-incomplete','unavailable');return output(history,leases.filter(l=>l!==existing),null);}
  const req=request!;let allowed=false;
  if(role==='independent-producer') allowed=req.channel==='native-fetch'&&req.method==='GET'&&req.path==='/replay';
  else if(req.channel==='native-fetch') allowed=req.method==='GET'&&req.path==='/copilot/info'||req.method==='POST'&&req.path==='/copilot/agent/benchmark/run';
  else if(req.channel==='page-http') allowed=req.method==='GET'&&['/__bench/context','/copilot/info'].includes(req.path)||req.method==='POST'&&
    ['/__bench/mounted','/__bench/completed','/copilot/agent/benchmark/run','/copilot/agent/benchmark/connect',`/copilot/agent/benchmark/stop/${encodeURIComponent(threadId)}`].includes(req.path);
  if(!allowed) return deny('channel-denied');return output(history,leases,req);
});}
const caseLabels=['seedReaderEOF','coldReaderEOF','mountedACK','publicRun','successfulTerminal','completionACK','bridge','producerFinish','producerReaderEOF','nativeOriginClose','producerOriginClose',
  'remoteCloseAdmission','hostDispose','rootUnmount','pageClose','contextClose','storeClear','publicStoreEmpty','caseDomainRelease'];
const globalLabels=['workerImport','browserLaunch','browserConnect','clientClose','clientDisconnected','browserServerClose','publicServerClose','applicationChildExit','applicationChildClose','parentWorkerClose'];
export const MOUNTED_CASE_WITNESS_LABELS:readonly string[]=Object.freeze([...caseLabels]);
export const MOUNTED_GLOBAL_WITNESS_LABELS:readonly string[]=Object.freeze([...globalLabels]);
const witnessShape=shape({label:value(64),status:value()});
const caseShape=shape({...fields(['caseNumber','journey','threadId','seedRunId','continuationRunId','repetition','completed','publicIdle','storeEmpty','domainReleased']),originals:list(witnessShape,19,19)});
const streamShape=shape(fields(['readableEOF','writerFinish','writerClose','writerError','seen','retained','retainedBytesKnown']));
const globalShape=shape({schemaVersion:value(),kind:value(),cases:list(caseShape,2,2),originals:list(witnessShape,10,10),applicationExit:shape({exitCode:value(),signal:value(64)}),
  stdio:list(shape({index:value(),kind:value(),status:value(),coverage:value(),seenBytes:value(),retainedBytes:value()}),8),parentCommand:shape({original:commandShape,stdout:streamShape,stderr:streamShape})});
function witnesses(input:unknown):Witness[] {return A(input).map(v=>{const r=R(v);return {label:S(r.label,64),status:E(r.status,statuses)};});}
function parseCase(input:unknown):CaseRecord {const r=R(input),n=N(r.caseNumber,2,1) as 1|2;return {caseNumber:n,journey:E(r.journey,journeys),threadId:ID(r.threadId),seedRunId:ID(r.seedRunId),continuationRunId:ID(r.continuationRunId),repetition:ID(r.repetition),
  completed:B(r.completed),publicIdle:B(r.publicIdle),storeEmpty:B(r.storeEmpty),domainReleased:B(r.domainReleased),originals:witnesses(r.originals)};}
function witnessSlots(input:readonly Witness[],labels:readonly string[]):void {if(input.some((w,i)=>w.label!==labels[i])) deny('witness-schema');}
const caseIDs=(c:CaseRecord):string[]=>[c.threadId,c.seedRunId,c.continuationRunId,c.repetition];
function caseRelations(c:CaseRecord):void {witnessSlots(c.originals,caseLabels);if(c.journey!==(c.caseNumber===1?'follow':'history-reading')) deny('case-chain');
  if(new Set(caseIDs(c)).size!==4) deny('case-identity-reuse');
  if(c.storeEmpty!==(c.originals[17]!.status==='fulfilled')||c.domainReleased!==(c.originals[18]!.status==='fulfilled')) deny('witness-contradiction');}
const completeCase=(c:CaseRecord):boolean=>c.completed&&c.publicIdle&&c.storeEmpty&&c.domainReleased&&c.originals.every(w=>w.status==='fulfilled');
function requireWitnesses(w:readonly Witness[]):void {if(w.some(x=>x.status==='rejected')) deny('original-failed','unavailable');if(w.some(x=>x.status!=='fulfilled')) deny('original-incomplete','unavailable');}
function requireCase(c:CaseRecord):void {requireWitnesses(c.originals);if(!completeCase(c)) deny('case-incomplete','unavailable');}
function chain(cases:readonly CaseRecord[]):void {if(cases[0]?.caseNumber!==1||cases[1]?.caseNumber!==2) deny('case-chain');if(new Set(cases.flatMap(caseIDs)).size!==8) deny('case-identity-reuse');}
function parseStream(input:unknown):StreamFacts {const r=R(input);return {readableEOF:B(r.readableEOF),writerFinish:B(r.writerFinish),writerClose:B(r.writerClose),writerError:B(r.writerError),seen:N(r.seen),retained:N(r.retained),retainedBytesKnown:B(r.retainedBytesKnown)};}
const completeStream=(s:StreamFacts):boolean=>s.readableEOF&&s.writerFinish&&s.writerClose&&!s.writerError&&s.retainedBytesKnown&&s.seen===s.retained;
export function evaluateMountedClosurePolicy(input:unknown):PolicyResult<ClosureFacts> {return evaluate(()=> {
  const kind=E(own(input,'kind'),['case-boundary','global-final']);
  if(kind==='case-boundary') {const r=R(copy(input,shape({schemaVersion:value(),kind:value(),priorCase:nullable(caseShape),currentCase:caseShape,secondStarted:value()})));V(r.schemaVersion);
    const current=parseCase(r.currentCase),prior=r.priorCase===null?null:parseCase(r.priorCase),secondStarted=B(r.secondStarted);caseRelations(current);if(prior) caseRelations(prior);
    if(current.caseNumber===1&&prior!==null||current.caseNumber===2&&(!prior||prior.caseNumber!==1||!secondStarted)) return deny('case-chain');
    if(prior) chain([prior,current]);const first=current.caseNumber===1?current:prior!;
    if(!completeCase(first)&&secondStarted) return deny('premature-case2');requireCase(current);
    return {kind:'case-boundary',caseNumber:current.caseNumber,originalWitnesses:19,nextCasePermitted:current.caseNumber===1&&!secondStarted};}
  const r=R(copy(input,globalShape));V(r.schemaVersion);const cases=A(r.cases).map(parseCase),originals=witnesses(r.originals),exit=R(r.applicationExit);
  const applicationExit={exitCode:exit.exitCode===null?null:N(exit.exitCode),signal:exit.signal===null?null:S(exit.signal,64)};
  const stdio=A(r.stdio).map(x=>{const q=R(x),kind=E(q.kind,['stdout','stderr','protocol']);const seen=q.seenBytes===null?null:N(q.seenBytes),retained=q.retainedBytes===null?null:N(q.retainedBytes);
    const coverage=E(q.coverage,['post-bind-only']),status=E(q.status,statuses),index=N(q.index,7);
    if(kind==='protocol'?(seen!==null||retained!==null):(seen===null||retained===null||seen!==retained||seen>262144)) return deny('invalid-scalar');return {kind,coverage,status,index,seenBytes:seen,retainedBytes:retained};});
  const parent=R(r.parentCommand),original=declaredCommand(parent.original),stdout=parseStream(parent.stdout),stderr=parseStream(parent.stderr);
  cases.forEach(caseRelations);chain(cases);witnessSlots(originals,globalLabels);
  if(originals[7]!.status==='fulfilled'&&applicationExit.exitCode===null&&applicationExit.signal===null) return deny('witness-contradiction');
  if(new Set(stdio.map(s=>s.index)).size!==stdio.length||['stdout','stderr'].some(k=>stdio.filter(s=>s.kind===k).length>1)) return deny('witness-contradiction');
  if(stdout.seen!==original.stdoutBytes||stdout.retained!==original.stdoutRetainedBytes||stderr.seen!==original.stderrBytes||stderr.retained!==original.stderrRetainedBytes||
    stdout.retained>stdout.seen||stderr.retained>stderr.seen||original.streamsComplete!==(completeStream(stdout)&&completeStream(stderr))) return deny('parent-stream-contradiction');
  if(stdout.seen>4194304||stderr.seen>4194304) return deny('parent-stream-overflow');
  cases.forEach(requireCase);requireWitnesses(originals);requireWitnesses(stdio.map(s=>({label:String(s.index),status:s.status})));
  if(!original.closed||!original.streamsComplete) return deny('parent-original-incomplete','unavailable');
  if(!assertOriginalCommand(original).success) return deny('parent-original-failed','unavailable');
  return {kind:'global-final',cases:2,caseOriginalWitnesses:38,globalOriginalWitnesses:10,availableStdio:stdio.length,applicationExit,parentCoverage:'spawn-complete',applicationCoverage:'post-bind-partial'};
});}
