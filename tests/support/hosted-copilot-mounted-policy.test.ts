import { describe, expect, it } from 'vitest';
import * as publicBinding from './hosted-copilot-mounted-policy.ts';
import { evaluateMountedAdmissionPolicy as admission, evaluateMountedModulePolicy as modulePolicy,
  evaluateMountedOriginPolicy as originPolicy, evaluateMountedClosurePolicy as closure,
  MOUNTED_PACKAGE_PINS, MOUNTED_POLICY_LIMITS } from './hosted-copilot-mounted-policy.js';

const sha = 'a'.repeat(40), hash = 'b'.repeat(64);
const zodAlias = '../../../../node_modules/zod/index.js';
describe('exact emitted public root binding',()=>{
 const root='file:///repo/',worker='file:///repo/apps/copilotkit/.hosted-mounted/123-1/worker.mjs',entry='file:///repo/node_modules/zod/index.js';
 it('retains the finite raw/logical identities without changing the ten compiler map or nineteen pins',()=>{
  expect(publicBinding.lookupWorkerPublicPackage(zodAlias)).toEqual({publicSpecifier:'zod',packagePath:'node_modules/zod'});
  expect(publicBinding.lookupWorkerPublicPackage('zod')).toBeNull();
  for(const [specifier,packagePath] of Object.entries(publicBinding.MOUNTED_MODULE_PACKAGE_SPECIFIERS))if(specifier!=='zod')expect(publicBinding.lookupWorkerPublicPackage(specifier)).toEqual({publicSpecifier:specifier,packagePath});
  expect(Object.keys(publicBinding.MOUNTED_MODULE_PACKAGE_SPECIFIERS)).toHaveLength(10);expect(Object.keys(MOUNTED_PACKAGE_PINS)).toHaveLength(19);
 });
 it('makes both original parent-aware calls and returns original canonical URL strings',()=>{
  const calls:string[][]=[];const result=publicBinding.resolveMountedPublicEntry(zodAlias,worker,root,(specifier,parent)=>{calls.push([specifier,parent]);return entry;});
  expect(calls).toEqual([[zodAlias,worker],['zod','file:///repo/packages/contract/src/fixture.ts']]);
  expect(result).toEqual({publicSpecifier:'zod',rawUrl:entry,publicUrl:entry});expect(Object.isFrozen(result)).toBe(true);
 });
 it('uses one original call for other public names and never substitutes a logical worker-parent zod call',()=>{
  const calls:string[][]=[];const result=publicBinding.resolveMountedPublicEntry('rxjs',worker,root,(specifier,parent)=>{calls.push([specifier,parent]);return 'file:///repo/node_modules/rxjs/dist/esm/index.js';});
  expect(calls).toEqual([['rxjs',worker]]);expect(result.publicSpecifier).toBe('rxjs');expect(result.rawUrl).toBe(result.publicUrl);
 });
 it.each(['zod','../../../node_modules/zod/index.js','../../../../node_modules/zod/../zod/index.js','../../../../node_modules/zod/index.js?x','file:///repo/node_modules/zod/index.js','zod/v4','node:module'])('rejects unreviewed raw spelling %s before the resolver',raw=>{
  let calls=0;expect(()=>publicBinding.resolveMountedPublicEntry(raw,worker,root,()=>{calls++;return entry;})).toThrow();expect(calls).toBe(0);
 });
 it.each(['file:///other/apps/copilotkit/.hosted-mounted/123-1/worker.mjs','file:///repo/apps/copilotkit/.hosted-mounted/0123-1/worker.mjs','file:///repo/apps/copilotkit/.hosted-mounted/123-2/worker.mjs','file:///repo/tool.mjs','file:///repo/apps/copilotkit/.hosted-mounted/123-1/worker.mjs?x'])('checks the fixed same-root worker URL before port use %s',bad=>{
  let calls=0;expect(()=>publicBinding.resolveMountedPublicEntry(zodAlias,bad,root,()=>{calls++;return entry;})).toThrow();expect(calls).toBe(0);
 });
 it('refuses noncanonical/foreign root and hostile primitives before port use without reflection',()=>{
  let calls=0;const hostile=new Proxy({}, {get(){calls++;throw Error();},getPrototypeOf(){calls++;throw Error();},ownKeys(){calls++;throw Error();}});
  for(const raw of [hostile,null,undefined,1])expect(()=>publicBinding.lookupWorkerPublicPackage(raw)).not.toThrow();
  for(const bad of ['file:///repo','file:///repo/../repo/','https://repo/','file://host/repo/','file:///repo/?x',hostile])expect(()=>publicBinding.resolveMountedPublicEntry(zodAlias,worker,bad,()=>{calls++;return entry;})).toThrow();expect(calls).toBe(0);
 });
 it.each(['file:///repo/apps/copilotkit/node_modules/zod/index.js','file:///other/node_modules/zod/index.js','https://example.test/zod.js','file:///repo/node_modules/zod/index.js?x','file:///repo/node_modules/zod/../zod/index.js','file://host/repo/node_modules/zod/index.js'])('refuses unequal or noncanonical original public results %s',bad=>{
  let calls=0;expect(()=>publicBinding.resolveMountedPublicEntry(zodAlias,worker,root,()=>++calls===1?entry:bad)).toThrow();
 });
 it('preserves the original resolver throw without consulting its properties',()=>{
  let reads=0;const thrown={get message(){reads++;throw Error();}};let observed:unknown;
  try{publicBinding.resolveMountedPublicEntry(zodAlias,worker,root,()=>{throw thrown;});}catch(error){observed=error;}
  expect(observed).toBe(thrown);expect(reads).toBe(0);
 });
 it('admits actual raw/logical/equal public facts and denies bare or dynamic alias and contradictions',()=>{
  const f=moduleInput();f.imports=[{specifier:zodAlias,kind:'static',resolutionIndex:0}];
  f.resolutions=[{specifier:zodAlias,publicSpecifier:'zod',publicEntryPath:'node_modules/zod/index.js',packagePath:'node_modules/zod',version:'4.6.5',integrity:MOUNTED_PACKAGE_PINS['node_modules/zod'].integrity,entryPath:'node_modules/zod/index.js',regular:true,contained:true,symlink:false}];
  expect(modulePolicy(f).status).toBe('accepted');expect(f.imports[0]!.specifier).toBe(zodAlias);
  for(const change of [(v:typeof f)=>{v.imports[0]!.specifier='zod';v.resolutions[0]!.specifier='zod';},(v:typeof f)=>v.imports[0]!.kind='dynamic-literal',
   (v:typeof f)=>v.resolutions[0]!.publicSpecifier='rxjs',(v:typeof f)=>v.resolutions[0]!.publicEntryPath='apps/copilotkit/node_modules/zod/index.js',
   (v:typeof f)=>v.resolutions[0]!.version='3.25.76']){const v=structuredClone(f);change(v);expect(modulePolicy(v).status).toBe('invalid');}
  for(const key of ['publicSpecifier','publicEntryPath']){const v:Record<string,any>=structuredClone(f);delete v.resolutions[0][key];expect(modulePolicy(v).status).toBe('invalid');let calls=0;Object.defineProperty(v.resolutions[0],key,{get(){calls++;throw Error();}});expect(modulePolicy(v).status).toBe('invalid');expect(calls).toBe(0);}
 });
});
const lock = 'c9c4138247c23c593ceb5bd9f5275b59962aad0f017bcbc33dc78bcec3545a56';
const flags = { input: 'supplied-data', sourceAuthenticated: false, prerequisiteQualified: false, installedGraphQualified: false,
  nativeImportQualified: false, originalClosureQualified: false, runtimeAdmission: false, qualification: false };
const required = ['package-lock.json', '.github/workflows/hosted-copilot-mounted.yml', 'tools/hosted-copilot-mounted-bootstrap.mjs',
  'apps/copilotkit/hosted-native-entry.ts', 'apps/copilotkit/src/geometry-policy.ts'];
const file = (path: string) => ({ path, bytes: 1, sha256: path === 'package-lock.json' ? lock : hash, regular: true, contained: true, symlink: false });
const intent = () => ({ schemaVersion: 1, kind: 'pre-install-intent', purpose: 'hosted-copilot-mounted-default-react-only',
  context: { candidateSha: sha, checkoutSha: sha, githubSha: sha, workflowSha: sha, tagSha: sha, repository: 'cacheplane/chat-ui-bench',
    releaseId: 'hosted-copilot-react-h100-r6400-v4', githubRef: 'refs/tags/hosted-copilot-react-h100-r6400-v4',
    workflowRef: 'cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-mounted.yml@refs/tags/hosted-copilot-react-h100-r6400-v4',
    eventName: 'workflow_dispatch', actions: 'true', platform: 'linux', runnerOs: 'Linux', runnerMarker: 'ubuntu-24.04-hosted-copilot-mounted', attempt: '1' },
  source: { commitSha: sha, treeSha: 'c'.repeat(40), lockSha256: lock, files: required.map(file) },
  prerequisite: { originalRunId: '1', attempt: 1, sourceSha: 'd'.repeat(40), artifactId: '2', archiveSha256: hash,
    qualifiedRootReceiptSha256: hash, qualifiedPeerReceiptSha256: hash, frontendSettingsSha256: hash },
  profile: { nodeVersion: 'v24.20.0', npmVersion: '11.19.0', telemetryDisabled: 'true', doNotTrack: '1' } });
const command = () => ({ exitCode: 0 as number | null, signal: null as string | null, stdoutBytes: 3, stderrBytes: 0,
  stdoutRetainedBytes: 3, stderrRetainedBytes: 0, closed: true, streamsComplete: true });
const post = () => ({ schemaVersion: 1, kind: 'post-install-admission', intent: intent(), originalInstall: command(),
  installedProfile: { sourceSha: sha, lockSha256: lock, originalInstallReceiptSha256: hash, hiddenLockReceiptSha256: hash,
    checkedInstalledRecords: 19, packages: Object.entries(MOUNTED_PACKAGE_PINS).map(([path, pin]) => ({ path, version: pin.version,
      integrity: pin.integrity, manifestSha256: hash, regular: true, contained: true, symlink: false })) } });
const moduleInput = () => ({ schemaVersion: 1, sourceSha: sha, runId: '3', workerPath: 'apps/copilotkit/.hosted-mounted/3-1/worker.mjs',
  emitted: [{ path: 'apps/copilotkit/.hosted-mounted/3-1/worker.mjs', kind: 'chunk', format: 'es', entry: true, bytes: 20, sha256: hash }],
  imports: [{ specifier: '@copilotkit/runtime/v2', kind: 'static', resolutionIndex: 0 as number | null },
    { specifier: 'node:http', kind: 'static', resolutionIndex: null as number | null }],
  resolutions: [{ specifier: '@copilotkit/runtime/v2', publicSpecifier: '@copilotkit/runtime/v2', publicEntryPath: 'apps/copilotkit/node_modules/@copilotkit/runtime/dist/v2/index.mjs', packagePath: 'apps/copilotkit/node_modules/@copilotkit/runtime', version: '1.78.0',
    integrity: MOUNTED_PACKAGE_PINS['apps/copilotkit/node_modules/@copilotkit/runtime'].integrity,
    entryPath: 'apps/copilotkit/node_modules/@copilotkit/runtime/dist/v2/index.mjs', regular: true, contained: true, symlink: false }],
  executedCopySha256: hash });
const lease = (role = 'native-case', origin = 'http://127.0.0.1:1234') => ({ role, origin, caseId: 'follow', threadId: 'a:b' });
const originInput = () => ({ schemaVersion: 1, kind: 'origin-transition', caseId: 'follow', threadId: 'a:b',
  registrationHistory: [lease()], leases: [lease()], action: { kind: 'request', role: 'native-case', origin: 'http://127.0.0.1:1234',
    channel: 'page-http', method: 'POST', path: '/copilot/agent/benchmark/stop/a%3Ab' } });
const control = () => ({ schemaVersion: 1, kind: 'control-connect', boundEndpoint: 'ws://127.0.0.1:4321/original-id',
  requestedEndpoint: 'ws://127.0.0.1:4321/original-id', priorConnectCount: 0 });
const caseLabels = ['seedReaderEOF','coldReaderEOF','mountedACK','publicRun','successfulTerminal','completionACK','bridge','producerFinish',
  'producerReaderEOF','nativeOriginClose','producerOriginClose','remoteCloseAdmission','hostDispose','rootUnmount','pageClose','contextClose',
  'storeClear','publicStoreEmpty','caseDomainRelease'];
const globalLabels = ['workerImport','browserLaunch','browserConnect','clientClose','clientDisconnected','browserServerClose','publicServerClose',
  'applicationChildExit','applicationChildClose','parentWorkerClose'];
const caseRecord = (n = 1) => ({ caseNumber: n, journey: n === 1 ? 'follow' : 'history-reading', threadId: `thread-${n}`,
  seedRunId: `seed-${n}`, continuationRunId: `continuation-${n}`, repetition: `repetition-${n}`, completed: true, publicIdle: true,
  storeEmpty: true, domainReleased: true, originals: caseLabels.map(label => ({ label, status: 'fulfilled' })) });
const boundary = () => ({ schemaVersion: 1, kind: 'case-boundary', priorCase: null as ReturnType<typeof caseRecord> | null,
  currentCase: caseRecord(), secondStarted: false });
const stream = (seen = 3) => ({ readableEOF: true, writerFinish: true, writerClose: true, writerError: false, seen, retained: seen, retainedBytesKnown: true });
const globalInput = () => ({ schemaVersion: 1, kind: 'global-final', cases: [caseRecord(), caseRecord(2)],
  originals: globalLabels.map(label => ({ label, status: 'fulfilled' })), applicationExit: { exitCode: 0 as number | null, signal: null as string | null },
  stdio: [{ index: 1, kind: 'stdout', status: 'fulfilled', coverage: 'post-bind-only', seenBytes: 2 as number | null, retainedBytes: 2 as number | null }],
  parentCommand: { original: command(), stdout: stream(), stderr: stream(0) } });
type Evaluation = { status: string; reason: string | null; facts: unknown; authority: unknown };
const expectFailure = (result: Evaluation, reason: string, status = 'invalid') => {
  expect(result).toMatchObject({ status, reason, facts: null, authority: flags });
};

describe('bounded shape precedence across the four supplied-data policies', () => {
  it('admits the fresh native V4 identity with the same supplied authority limits', () => {
    const v=intent();expect(v.context.releaseId).toBe('hosted-copilot-react-h100-r6400-v4');
    expect(admission(v)).toMatchObject({status:'accepted',reason:null,facts:{phase:'pre-install',sourceFiles:5,sourceBytes:5},authority:flags});
    expect(admission(post())).toMatchObject({status:'accepted',reason:null,authority:flags});
  });
  it.each(['v1','v2','v3'])('rejects the used native %s identity even when its three identity fields agree', version => {
    const v=intent();v.context.releaseId='hosted-copilot-react-h100-r6400-'+version;v.context.githubRef='refs/tags/'+v.context.releaseId;v.context.workflowRef='cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-mounted.yml@'+v.context.githubRef;
    expectFailure(admission(v),'mounted-context');const p=post();p.intent=v;expectFailure(admission(p),'mounted-context');
  });
  const policies = [
    { name: 'admission', evaluate: admission, input: () => { const v = intent(); v.context.candidateSha = 'a'.repeat(41);
      return { v, later: v.profile, key: 'doNotTrack', array: v.source.files, maximum: 128 }; } },
    { name: 'module', evaluate: modulePolicy, input: () => { const v = moduleInput(); v.sourceSha = 'a'.repeat(41);
      return { v, later: v, key: 'runId', array: v.imports, maximum: 64 }; } },
    { name: 'origin', evaluate: originPolicy, input: () => { const v = originInput(); v.threadId = 'a'.repeat(129);
      return { v, later: v.action, key: 'path', array: v.registrationHistory, maximum: 2 }; } },
    { name: 'closure', evaluate: closure, input: () => { const v = boundary(); v.currentCase.threadId = 'a'.repeat(129);
      return { v, later: v, key: 'secondStarted', array: v.currentCase.originals, maximum: 19 }; } },
  ];
  it.each(policies)('$name checks a later own-data descriptor before an earlier string cap', ({ input, evaluate }) => {
    const { v, later, key } = input(); let calls = 0;
    Object.defineProperty(later, key, { enumerable: true, configurable: true, get() { calls++; return 'unused'; } });
    const result = evaluate(v); expect(calls).toBe(0); expectFailure(result, 'invalid-shape');
  });
  it.each(policies)('$name checks a later reachable record shape before an earlier string cap', ({ input, evaluate }) => {
    const { v, later, key } = input(); Reflect.deleteProperty(later, key);
    expectFailure(evaluate(v), 'invalid-shape');
  });
  it.each(policies)('$name retains the string cap after a complete admitted-size shape traversal', ({ input, evaluate }) => {
    const { v } = input(); expectFailure(evaluate(v), 'cardinality-cap');
  });
  it.each(policies)('$name refuses an oversized array before reading any element', ({ input, evaluate }) => {
    const { v, array, maximum } = input(); let calls = 0;
    array.length = maximum + 1;
    Object.defineProperty(array, '0', { configurable: true, get() { calls++; return null; } });
    const result = evaluate(v); expect(calls).toBe(0); expectFailure(result, 'cardinality-cap');
  });
  it('checks a later emitted record shape before the module source cap', () => {
    const v = moduleInput(); v.sourceSha = 'a'.repeat(41); Reflect.deleteProperty(v.emitted[0]!, 'sha256');
    expectFailure(modulePolicy(v), 'invalid-shape');
  });
  it('checks a later witness record shape before the closure thread cap', () => {
    const v = boundary(); v.currentCase.threadId = 'a'.repeat(129); Reflect.deleteProperty(v.currentCase.originals[18]!, 'status');
    expectFailure(closure(v), 'invalid-shape');
  });
  it('does not scan the oversized string while checking a later descriptor', () => {
    const v = moduleInput(); const oversized = 'a'.repeat(10000); v.sourceSha = oversized;
    let getters = 0, scans = 0; const original = RegExp.prototype.test;
    Object.defineProperty(v, 'runId', { get() { getters++; return '3'; } });
    RegExp.prototype.test = function(input: string): boolean { if (input === oversized) scans++; return original.call(this, input); };
    let result: Evaluation;
    try { result = modulePolicy(v); } finally { RegExp.prototype.test = original; }
    expect(getters).toBe(0); expect(scans).toBe(0); expectFailure(result, 'invalid-shape');
  });
});

describe('supplied mounted admission and direct module facts', () => {
  it('accepts fake bounded pre/post records without acquiring or qualifying them', () => {
    expect(admission(intent())).toMatchObject({ status: 'accepted', reason: null, facts: { phase: 'pre-install', sourceFiles: 5, sourceBytes: 5 }, authority: flags });
    expect(admission(post())).toMatchObject({ status: 'accepted', facts: { phase: 'post-install', installedPackages: 19 }, authority: flags });
    expect(MOUNTED_POLICY_LIMITS.files).toBe(128); expect(Object.keys(MOUNTED_PACKAGE_PINS)).toHaveLength(19);
  });
  it.each([
    ['mounted-purpose', (v: ReturnType<typeof intent>) => { v.purpose = 'production-only'; }],
    ['mounted-context', (v: ReturnType<typeof intent>) => { v.context.attempt = '2'; }],
    ['mounted-context', (v: ReturnType<typeof intent>) => { v.context.workflowRef = 'wrong'; }],
    ['source-mismatch', (v: ReturnType<typeof intent>) => { v.context.checkoutSha = 'e'.repeat(40); }],
    ['source-inventory', (v: ReturnType<typeof intent>) => { v.source.files.pop(); }],
    ['source-inventory', (v: ReturnType<typeof intent>) => { v.source.files.push(file('package-lock.json')); }],
    ['lock-mismatch', (v: ReturnType<typeof intent>) => { v.source.lockSha256 = hash; }],
    ['profile-mismatch', (v: ReturnType<typeof intent>) => { v.profile.telemetryDisabled = 'false'; }],
  ] as const)('rejects %s supplied relationship', (reason, mutate) => { const v = intent(); mutate(v); expectFailure(admission(v), reason); });
  it('does not fabricate installed facts before original install', () => {
    expectFailure(admission({ ...intent(), installedPackages: [] }), 'invalid-shape');
    const v = post(); v.originalInstall.closed = false; expectFailure(admission(v), 'install-original-incomplete', 'unavailable');
    v.originalInstall.closed = true; v.originalInstall.exitCode = 1; expectFailure(admission(v), 'install-original-failed', 'unavailable');
  });
  it.each(['path','version','integrity'] as const)('denies actual-profile-shaped %s drift', field => {
    const v = post(); v.installedProfile.packages[0]![field] = field === 'path' ? 'node_modules/@copilotkit/runtime' : 'different';
    expectFailure(admission(v), 'installed-profile-mismatch');
  });
  it('checks package count/source and stream bounds', () => {
    const v = post(); v.installedProfile.packages.pop(); expectFailure(admission(v), 'cardinality-cap');
    const s = post(); s.installedProfile.sourceSha = 'f'.repeat(40); expectFailure(admission(s), 'installed-source-mismatch');
    const b = post(); b.originalInstall.stdoutBytes = b.originalInstall.stdoutRetainedBytes = 4194305;
    expectFailure(admission(b), 'install-stream-overflow');
  });
  it('caps raw source entries and aggregate declared bytes before relationships', () => {
    const v = intent(); v.source.files = [...v.source.files, ...Array.from({ length: 123 }, (_, i) => file(`file-${i}`))];
    expect(admission(v).status).toBe('accepted'); v.source.files.push(file('overflow')); expectFailure(admission(v), 'cardinality-cap');
    const b = intent(); b.source.files[0]!.bytes = 33554428; expect(admission(b).status).toBe('accepted');
    b.source.files[0]!.bytes++; expectFailure(admission(b), 'cardinality-cap');
  });
  it('owns frozen output and rejects getter/symbol/sparse/extra data without invocation', () => {
    const v = intent(); const r = admission(v); expect(r.status).toBe('accepted'); expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.facts)).toBe(true); v.source.files[0]!.bytes = 100; expect(r.facts).toMatchObject({ sourceBytes: 5 });
    let calls = 0; const g = intent(); Object.defineProperty(g, 'purpose', { get() { calls++; return 'mounted'; } });
    expectFailure(admission(g), 'invalid-shape'); expect(calls).toBe(0);
    const a = intent(); Object.defineProperty(a.source.files, Symbol.iterator, { value() { calls++; return [][Symbol.iterator](); } });
    expectFailure(admission(a), 'invalid-shape'); expect(calls).toBe(0);
    const sparse = intent(); delete sparse.source.files[0]; expectFailure(admission(sparse), 'invalid-shape');
    expectFailure(admission({ ...intent(), extra: true }), 'invalid-shape');
  });
  it('checks one app-local output and public package resolution metadata only', () => {
    expect(modulePolicy(moduleInput())).toMatchObject({ status: 'accepted', facts: { importOccurrences: 2, packageResolutions: 1 }, authority: flags });
  });
  it.each([
    ['native-output-path', (v: ReturnType<typeof moduleInput>) => { v.workerPath = 'tmp/worker.mjs'; }],
    ['native-output', (v: ReturnType<typeof moduleInput>) => { v.emitted[0]!.kind = 'asset'; }],
    ['native-output', (v: ReturnType<typeof moduleInput>) => { v.executedCopySha256 = 'c'.repeat(64); }],
    ['native-import', (v: ReturnType<typeof moduleInput>) => { v.imports[0]!.kind = 'dynamic-computed'; }],
    ['native-import', (v: ReturnType<typeof moduleInput>) => { v.imports[0]!.specifier = 'https://endpoint.invalid'; }],
    ['native-resolution', (v: ReturnType<typeof moduleInput>) => { v.resolutions[0]!.packagePath = 'node_modules/@copilotkit/runtime'; }],
    ['native-resolution', (v: ReturnType<typeof moduleInput>) => { v.imports[0]!.resolutionIndex = 2; }],
    ['native-resolution', (v: ReturnType<typeof moduleInput>) => { v.resolutions[0]!.entryPath = 'outside/index.mjs'; }],
  ] as const)('rejects %s module relationship', (reason, mutate) => { const v = moduleInput(); mutate(v); expectFailure(modulePolicy(v), reason); });
  it('retains import occurrences/caps and denies unknown or unreferenced resolution', () => {
    const v = moduleInput(); v.imports = Array.from({ length: 64 }, () => ({ ...v.imports[0]! })); expect(modulePolicy(v).status).toBe('accepted');
    v.imports.push({ ...v.imports[0]! }); expectFailure(modulePolicy(v), 'cardinality-cap');
    const b = moduleInput(); b.imports = []; expectFailure(modulePolicy(b), 'native-imports-missing');
    const c = moduleInput(); c.imports = [c.imports[1]!]; expectFailure(modulePolicy(c), 'native-resolution');
  });
});

describe('supplied per-case origin history and separate control channel', () => {
  it.each(['unknown', '', 3, 'x'.repeat(10000)])('keeps known outer caps before unselectable action kind %j', kind => {
    const v = originInput(); v.threadId = 'a'.repeat(129); Object.defineProperty(v.action, 'kind', { value: kind });
    expectFailure(originPolicy(v), 'cardinality-cap');
  });
  it.each(['unknown', '', 3, 'x'.repeat(10000)])('keeps valid outer shape plus unselectable action kind %j as scalar refusal', kind => {
    const v = originInput(); Object.defineProperty(v.action, 'kind', { value: kind });
    expectFailure(originPolicy(v), 'invalid-scalar');
  });
  it('rejects an own action discriminator accessor without invoking it even with an outer cap', () => {
    const v = originInput(); v.threadId = 'a'.repeat(129); let calls = 0;
    Object.defineProperty(v.action, 'kind', { get() { calls++; return 'request'; } });
    const result = originPolicy(v); expect(calls).toBe(0); expectFailure(result, 'invalid-shape');
  });
  it('does not scan an overlong unselectable action discriminator before length refusal', () => {
    const v = originInput(); const oversized = 'x'.repeat(10000); v.action.kind = oversized;
    let scans = 0; const original = RegExp.prototype.test;
    RegExp.prototype.test = function(input: string): boolean { if (input === oversized) scans++; return original.call(this, input); };
    let result: Evaluation;
    try { result = originPolicy(v); } finally { RegExp.prototype.test = original; }
    expect(scans).toBe(0); expectFailure(result, 'invalid-scalar');
  });
  it('admits exact canonical encoded colon stop, keeps history and immutable fresh leases', () => {
    const v = originInput(); const r = originPolicy(v); expect(r).toMatchObject({ status: 'accepted', facts: { nextLeaseCount: 1, registrationHistory: [lease()], leases: [lease()] }, authority: flags });
    expect(Object.isFrozen(r.facts)).toBe(true); v.leases[0]!.origin = 'mutated'; expect(r.facts).toMatchObject({ leases: [lease()] });
  });
  it.each(['a:b','a%3ab','a%253Ab','different'])('denies noncanonical/wrong stop segment %s', segment => {
    const v = originInput(); v.action.path = `/copilot/agent/benchmark/stop/${segment}`; expectFailure(originPolicy(v), 'channel-denied');
  });
  it.each(['/__bench/continuation','/copilot/agent/benchmark/connect?x=1','/copilot/agent/benchmark/stop/all'])('denies endpoint expansion %s', path => {
    const v = originInput(); v.action.path = path; expectFailure(originPolicy(v), 'channel-denied');
  });
  it('requires registered origin and exact history subset before requests', () => {
    const v = originInput(); v.leases = []; expectFailure(originPolicy(v), 'origin-not-leased', 'unavailable');
    const b = originInput(); b.registrationHistory = []; expectFailure(originPolicy(b), 'origin-ledger');
    const c = originInput(); c.registrationHistory[0]!.threadId = 'other'; expectFailure(originPolicy(c), 'origin-ledger');
  });
  it('retains history on release and denies registration again after release', () => {
    const base = originInput(); const released = originPolicy({ ...base, action: { kind: 'release', role: 'native-case', origin: lease().origin, originalClose: 'fulfilled' } });
    expect(released).toMatchObject({ status: 'accepted', facts: { registrationHistory: [lease()], leases: [], nextLeaseCount: 0 } });
    expectFailure(originPolicy({ ...base, leases: [], action: { kind: 'register', role: 'native-case', origin: lease().origin, listenObserved: true } }), 'origin-already-registered');
    expectFailure(originPolicy({ ...base, leases: [], action: { kind: 'register', role: 'native-case', origin: 'http://127.0.0.1:4321', listenObserved: true } }), 'origin-already-registered');
    expectFailure(originPolicy({ ...base, leases: [], action: { kind: 'register', role: 'independent-producer', origin: lease().origin, listenObserved: true } }), 'origin-already-registered');
  });
  it('registers both histories once only after supplied listen and denies history aliases', () => {
    const b = { ...originInput(), registrationHistory: [], leases: [], action: { kind: 'register', role: 'native-case', origin: lease().origin, listenObserved: true } };
    expect(originPolicy(b)).toMatchObject({ status: 'accepted', facts: { registrationHistory: [lease()], leases: [lease()] } });
    b.action.listenObserved = false; expectFailure(originPolicy(b), 'origin-listen-unobserved', 'unavailable');
    const two = originInput(); two.registrationHistory.push(lease('independent-producer', 'http://127.0.0.1:4321'));
    expect(originPolicy({ ...two, action: { kind: 'register', role: 'independent-producer', origin: 'http://127.0.0.1:9999', listenObserved: true } })).toMatchObject({ reason: 'origin-already-registered' });
  });
  it.each(['pending','timed-out','unavailable','rejected'])('never releases on original %s', originalClose => {
    const b = originInput(); expectFailure(originPolicy({ ...b, action: { kind: 'release', role: 'native-case', origin: lease().origin, originalClose } }),
      originalClose === 'rejected' ? 'origin-original-failed' : 'origin-original-incomplete', 'unavailable'); expect(b.leases).toEqual([lease()]);
  });
  it.each(['http://localhost:1234','http://127.0.0.1:0','http://127.0.0.1:65536','http://127.0.0.1:01234','http://[::1]:1234','http://127.0.0.1:1234/'])('rejects origin alias %s', origin => {
    const b = originInput(); b.action.origin = origin; expectFailure(originPolicy(b), 'invalid-scalar');
  });
  it('separates producer Node HTTP, page WebSockets and exact original control endpoint', () => {
    const b = originInput(); b.action.channel = 'page-websocket'; expectFailure(originPolicy(b), 'channel-denied');
    const p = { ...b, registrationHistory: [lease('independent-producer')], leases: [lease('independent-producer')],
      action: { kind: 'request', role: 'independent-producer', origin: lease().origin, channel: 'native-fetch', method: 'GET', path: '/replay' } };
    expect(originPolicy(p).status).toBe('accepted'); p.action.channel = 'page-http'; expectFailure(originPolicy(p), 'channel-denied');
    expect(originPolicy(control())).toMatchObject({ status: 'accepted', facts: { channel: 'playwright-control', connectCount: 1 }, authority: flags });
    const c = control(); c.priorConnectCount = 1; expectFailure(originPolicy(c), 'control-reuse');
    c.priorConnectCount = 0; c.requestedEndpoint += '-other'; expectFailure(originPolicy(c), 'control-endpoint-mismatch');
  });
  it.each(['thread\n','a b','a%3Ab'])('rejects nonidentity raw thread %j', threadId => {
    const b = originInput(); b.threadId = threadId; expectFailure(originPolicy(b), 'invalid-scalar');
  });
});

describe('declared originals, serial boundaries and partial versus whole streams', () => {
  it('accepts bounded literal case/global relationships with every authority false', () => {
    expect(closure(boundary())).toMatchObject({ status: 'accepted', facts: { caseNumber: 1, nextCasePermitted: true }, authority: flags });
    expect(closure(globalInput())).toMatchObject({ status: 'accepted', facts: { cases: 2, caseOriginalWitnesses: 38, globalOriginalWitnesses: 10,
      parentCoverage: 'spawn-complete', applicationCoverage: 'post-bind-partial' }, authority: flags });
  });
  it.each(caseLabels)('requires the separate original %s before case2', label => {
    const v = boundary(); v.currentCase.originals.find(w => w.label === label)!.status = 'pending';
    if (label === 'publicStoreEmpty') v.currentCase.storeEmpty = false;
    if (label === 'caseDomainRelease') v.currentCase.domainReleased = false;
    expectFailure(closure(v), 'original-incomplete', 'unavailable'); v.secondStarted = true; expectFailure(closure(v), 'premature-case2');
  });
  it.each(globalLabels)('requires the separate global original %s', label => {
    const v = globalInput(); v.originals.find(w => w.label === label)!.status = 'unavailable'; expectFailure(closure(v), 'original-incomplete', 'unavailable');
  });
  it('distinguishes witness scalar/shape/slot/length and rejects state contradictions', () => {
    const v = boundary(); v.currentCase.originals[0]!.label = 'unknown'; expectFailure(closure(v), 'witness-schema');
    v.currentCase.originals[0]!.label = caseLabels[0]!; v.currentCase.originals[0]!.status = 'unknown'; expectFailure(closure(v), 'invalid-scalar');
    const b = boundary(); b.currentCase.originals.pop(); expectFailure(closure(b), 'cardinality-cap');
    const c = boundary(); c.currentCase.storeEmpty = false; expectFailure(closure(c), 'witness-contradiction');
  });
  it('denies rejected/timed-out originals and never reopens a failed first case', () => {
    const v = boundary(); v.currentCase.originals[0]!.status = 'rejected'; expectFailure(closure(v), 'original-failed', 'unavailable');
    v.currentCase.originals[0]!.status = 'timed-out'; expectFailure(closure(v), 'original-incomplete', 'unavailable');
    const b = boundary(); b.currentCase.completed = false; expectFailure(closure(b), 'case-incomplete', 'unavailable');
    const g = globalInput(); g.cases[1]!.threadId = g.cases[0]!.threadId; expectFailure(closure(g), 'case-identity-reuse');
  });
  it('admits a valid second boundary without another case start', () => {
    const b = boundary(); b.currentCase = caseRecord(2); b.priorCase = caseRecord(); b.secondStarted = true;
    expect(closure(b)).toMatchObject({ status: 'accepted', facts: { nextCasePermitted: false, caseNumber: 2 } });
    b.priorCase = null; expectFailure(closure(b), 'case-chain');
    const f = boundary(); f.secondStarted = true; expect(closure(f)).toMatchObject({ status: 'accepted', facts: { nextCasePermitted: false } });
  });
  it('preserves forced-fallback signal and no-available-stdio partial coverage', () => {
    const v = globalInput(); v.applicationExit = { exitCode: null, signal: 'SIGKILL' }; v.stdio = [];
    expect(closure(v)).toMatchObject({ status: 'accepted', facts: { availableStdio: 0, applicationExit: { exitCode: null, signal: 'SIGKILL' }, applicationCoverage: 'post-bind-partial' } });
    v.applicationExit.signal = null; expectFailure(closure(v), 'witness-contradiction');
  });
  it('requires independent available stdio and never consumes protocol bytes', () => {
    const v = globalInput(); v.stdio[0]!.status = 'pending'; expectFailure(closure(v), 'original-incomplete', 'unavailable');
    v.stdio[0]!.status = 'fulfilled'; v.stdio[0]!.kind = 'protocol'; expectFailure(closure(v), 'invalid-scalar');
    v.stdio[0]!.seenBytes = null; v.stdio[0]!.retainedBytes = null; expect(closure(v).status).toBe('accepted');
  });
  it.each(['readableEOF','writerFinish','writerClose','retainedBytesKnown'] as const)('requires parent %s independently of child current state', field => {
    const v = globalInput(); v.parentCommand.stdout[field] = false; expectFailure(closure(v), 'parent-stream-contradiction');
    v.parentCommand.original.streamsComplete = false; expectFailure(closure(v), 'parent-original-incomplete', 'unavailable');
  });
  it('keeps actual parent failure/overflow distinct and rejects contradictory retained lengths', () => {
    const v = globalInput(); v.parentCommand.original.exitCode = 1; expectFailure(closure(v), 'parent-original-failed', 'unavailable');
    const b = globalInput(); b.parentCommand.stdout.retained = 2; expectFailure(closure(b), 'parent-stream-contradiction');
    const c = globalInput(); c.parentCommand.stdout = stream(4194305); c.parentCommand.original.stdoutBytes = c.parentCommand.original.stdoutRetainedBytes = 4194305;
    expectFailure(closure(c), 'parent-stream-overflow');
  });
  it('classifies declared parent retained-above-seen as a parent relationship contradiction', () => {
    const v = globalInput(); v.parentCommand.original.streamsComplete = false;
    v.parentCommand.original.stdoutRetainedBytes = v.parentCommand.stdout.retained = 4;
    expectFailure(closure(v), 'parent-stream-contradiction');
  });
  it('accepts exact parent/application/available-stdio limits and rejects plus-one', () => {
    const v = globalInput(); v.parentCommand.stdout = stream(4194304);
    v.parentCommand.original.stdoutBytes = v.parentCommand.original.stdoutRetainedBytes = 4194304;
    v.stdio[0]!.seenBytes = v.stdio[0]!.retainedBytes = 262144;
    expect(closure(v).status).toBe('accepted'); v.stdio[0]!.seenBytes = v.stdio[0]!.retainedBytes = 262145;
    expectFailure(closure(v), 'invalid-scalar');
    v.stdio = Array.from({ length: 8 }, (_, index) => ({ index, kind: 'protocol', status: 'fulfilled', coverage: 'post-bind-only', seenBytes: null, retainedBytes: null }));
    expect(closure(v).status).toBe('accepted'); v.stdio.push({ ...v.stdio[0]!, index: 8 }); expectFailure(closure(v), 'cardinality-cap');
  });
  it('keeps duplicate/extra package and global witness counts distinct', () => {
    const v = post(); v.installedProfile.packages[1] = { ...v.installedProfile.packages[0]! }; expectFailure(admission(v), 'installed-profile-mismatch');
    v.installedProfile.packages.push({ ...v.installedProfile.packages[0]! }); expectFailure(admission(v), 'cardinality-cap');
    const g = globalInput(); g.originals.push({ ...g.originals[0]! }); expectFailure(closure(g), 'cardinality-cap');
  });
  it.each(['ws://localhost:4321/original-id','ws://127.0.0.1:04321/original-id','ws://127.0.0.1:4321/a%2Fb','ws://127.0.0.1:4321/id?x=1','ws://127.0.0.1:4321/id\n'])('denies control representation %j without normalization', endpoint => {
    const v = control(); v.boundEndpoint = v.requestedEndpoint = endpoint; expectFailure(originPolicy(v), 'invalid-scalar');
  });
  it('retains frozen histories after release without freezing or mutating supplied objects', () => {
    const v = originInput(); const result = originPolicy({ ...v, action: { kind: 'release', role: 'native-case', origin: lease().origin, originalClose: 'fulfilled' } });
    expect(result).toMatchObject({ status: 'accepted', facts: { leases: [], registrationHistory: [lease()] } });
    expect(Object.isFrozen(v.registrationHistory[0])).toBe(false);
    v.registrationHistory[0]!.origin = 'changed'; expect(result.facts).toMatchObject({ registrationHistory: [lease()] });
  });
  it('validates outer origin shape and known collection caps before nested action scalars', () => {
    const v = originInput(); v.action.kind = 'unknown';
    expectFailure(originPolicy({ ...v, extra: true }), 'invalid-shape');
    v.registrationHistory.push(lease('independent-producer', 'http://127.0.0.1:4321'), lease());
    expectFailure(originPolicy(v), 'cardinality-cap');
  });
  it('applies exact context SHA length cap before semantic context comparisons', () => {
    const v = intent(); v.context.candidateSha = 'a'.repeat(41); v.purpose = 'wrong-purpose';
    expectFailure(admission(v), 'cardinality-cap');
  });
  it('admits all ten public direct subpaths then caps the raw resolution array', () => {
    const specs = ['@copilotkit/runtime/v2','@copilotkit/runtime/v2/hono','@ag-ui/client','@ag-ui/core','@ag-ui/core/schemas','@hono/node-server','rxjs','@copilotkit/aimock/agui','playwright','zod'];
    const paths = ['apps/copilotkit/node_modules/@copilotkit/runtime','apps/copilotkit/node_modules/@copilotkit/runtime','node_modules/@ag-ui/client','node_modules/@ag-ui/core','node_modules/@ag-ui/core',
      'node_modules/@hono/node-server','node_modules/rxjs','node_modules/@copilotkit/aimock','node_modules/playwright','node_modules/zod'] as const;
    const v = moduleInput(); v.resolutions = specs.map((specifier, i) => { const path = paths[i]!; const pin = MOUNTED_PACKAGE_PINS[path];
      return { specifier:specifier==='zod'?zodAlias:specifier, publicSpecifier:specifier, publicEntryPath:`${path}/dist/public.mjs`, packagePath: path, version: pin.version, integrity: pin.integrity, entryPath: `${path}/dist/public.mjs`, regular: true, contained: true, symlink: false }; });
    v.imports = specs.map((specifier, resolutionIndex) => ({ specifier:specifier==='zod'?zodAlias:specifier, kind: specifier==='zod'?'static':'dynamic-literal', resolutionIndex }));
    expect(modulePolicy(v)).toMatchObject({ status: 'accepted', facts: { importOccurrences: 10, packageResolutions: 10 } });
    v.resolutions.push({ ...v.resolutions[0]! }); expectFailure(modulePolicy(v), 'cardinality-cap');
  });
  it('rejects nested own getters in every other evaluator without invoking them', () => {
    let calls = 0; const m = moduleInput(); Object.defineProperty(m.resolutions[0], 'version', { get() { calls++; return '1.78.0'; } });
    expectFailure(modulePolicy(m), 'invalid-shape');
    const o = originInput(); Object.defineProperty(o.action, 'path', { get() { calls++; return '/copilot/info'; } });
    expectFailure(originPolicy(o), 'invalid-shape');
    const g = globalInput(); Object.defineProperty(g.parentCommand.stdout, 'writerClose', { get() { calls++; return true; } });
    expectFailure(closure(g), 'invalid-shape'); expect(calls).toBe(0);
  });
});
