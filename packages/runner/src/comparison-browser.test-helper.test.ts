// Controlled filesystem tests only: these do not launch a browser or add capture attempts.
import {afterEach, expect, test} from 'vitest';
import * as helper from './comparison-browser.test-helper.js';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, cp, open, rm, readdir, stat, unlink, link, symlink, rename, realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {
  adapterBuildSchema, comparisonInstrumentationBuildSchema, canonicalSerialize, createLongThreadFixture,
  comparisonDatasetInventorySchema, comparisonCaptureInvocationSchema, comparisonScheduledRunSchema,
  comparisonValidationSchema, comparisonExceptionsSchema, comparisonRawInventorySchema, comparisonManifestSchema,
} from '@chat-ui-bench/contract';
import {parseLongThreadArgs} from './long-thread-cli.js';
import {createLongThreadLedger} from './long-thread-run.js';
import {runInNewContext} from 'node:vm';
import {parseSync} from 'rolldown/experimental';

const d0FramerMembers = [
  'packages/analyzer/src/browser-frame-trace-framer.ts',
  'packages/analyzer/src/browser-frame-trace-framer.test.ts',
  ...['.d.ts','.js','.js.map'].map(ext=>'packages/analyzer/dist/browser-frame-trace-framer'+ext),
];
async function addD0FixtureMembers(workspace:string) {
  for(const key of d0FramerMembers){await mkdir(dirname(join(workspace,key)),{recursive:true});await copyFile(join(repository,key),join(workspace,key));}
}
// Full snapshots and final-copy mutation controls traverse all 310 members.
// Pure and preflight controls keep the default deadline; lock extrema retain 30s.
test.each(d0FramerMembers)('D0-v8 retains exact selected framer member %s',{timeout:10000},async key=>{
  const f=await fixture();await addD0FixtureMembers(f.workspace);const receipt=await writer()(f.root,f);
  const manifest=JSON.parse(await readFile(receipt!.path,'utf8')),record=manifest.records.find((row:{key:string})=>row.key===key);
  expect(record).toBeDefined();expect((await readFile(join(receipt!.directory,record.copied.path))).equals(await readFile(join(repository,key)))).toBe(true);
});
test.each(d0FramerMembers)('D0-v8 refuses missing selected framer member %s',async key=>{
  const f=await fixture();await addD0FixtureMembers(f.workspace);await unlink(join(f.workspace,key));await expect(writer()(f.root,f)).rejects.toThrow();
});
test('D0-v8 refuses original framer mutation during final copy',{timeout:10000},async()=>{
  const f=await fixture();await addD0FixtureMembers(f.workspace);const injected=duringLastCopy(f,async()=>{const path=join(f.workspace,d0FramerMembers[0]!),bytes=await readFile(path);bytes[0]=bytes[0]!^1;await writeFile(path,bytes);});
  await expect(writer()(f.root,{...f,open:injected})).rejects.toThrow('original identity changed');
});

const d1AnnotationTestMember='packages/analyzer/src/browser-frame-annotation-fragments.test.ts';
async function addD1FixtureMember(workspace:string) {
  await mkdir(dirname(join(workspace,d1AnnotationTestMember)),{recursive:true});
  await copyFile(join(repository,d1AnnotationTestMember),join(workspace,d1AnnotationTestMember));
}
test('D1-v9 retains exact annotation test member',{timeout:10000},async()=>{
  const f=await fixture();await addD1FixtureMember(f.workspace);const receipt=await writer()(f.root,f);
  const manifest=JSON.parse(await readFile(receipt!.path,'utf8')),record=manifest.records.find((row:{key:string})=>row.key===d1AnnotationTestMember);
  expect(record).toBeDefined();
  const original=await readFile(join(repository,d1AnnotationTestMember)),copied=await readFile(join(receipt!.directory,record.copied.path));
  expect(copied.equals(original)).toBe(true);expect(record.before.fact).toEqual({byteLength:original.length,sha256:sha256(original)});expect(record.before).toEqual(record.after);
});
test('D1-v9 refuses missing annotation test member',async()=>{
  const f=await fixture();await addD1FixtureMember(f.workspace);await unlink(join(f.workspace,d1AnnotationTestMember));
  await expect(writer()(f.root,f)).rejects.toThrow();
});
test('D1-v9 refuses original annotation test mutation during final copy',{timeout:10000},async()=>{
  const f=await fixture();await addD1FixtureMember(f.workspace);const injected=duringLastCopy(f,async()=>{const path=join(f.workspace,d1AnnotationTestMember),bytes=await readFile(path);bytes[0]=bytes[0]!^1;await writeFile(path,bytes);});
  await expect(writer()(f.root,{...f,open:injected})).rejects.toThrow('original identity changed');
});

const nativePhasePackageMember='packages/analyzer/package.json';
test('native-phase-v10 retains exact analyzer package member',{timeout:10000},async()=>{
  const f=await fixture(),receipt=await writer()(f.root,f);
  const manifest=JSON.parse(await readFile(receipt!.path,'utf8')),record=manifest.records.find((row:{key:string})=>row.key===nativePhasePackageMember);
  expect(record).toBeDefined();
  const original=await readFile(join(repository,nativePhasePackageMember)),copied=await readFile(join(receipt!.directory,record.copied.path));
  expect(copied.equals(original)).toBe(true);expect(record.before.fact).toEqual({byteLength:original.length,sha256:sha256(original)});expect(record.before).toEqual(record.after);
});
test('native-phase-v10 refuses missing analyzer package member',async()=>{
  const f=await fixture();await unlink(join(f.workspace,nativePhasePackageMember));await expect(writer()(f.root,f)).rejects.toThrow();
});
test('native-phase-v10 refuses original analyzer package mutation during final copy',{timeout:10000},async()=>{
  const f=await fixture(),injected=duringLastCopy(f,async()=>{const path=join(f.workspace,nativePhasePackageMember),bytes=await readFile(path);bytes[0]=bytes[0]!^1;await writeFile(path,bytes);});
  await expect(writer()(f.root,{...f,open:injected})).rejects.toThrow('original identity changed');
});

function emptyHostObserver(observedAt=100) {
  const callbacks=new Map<number,(value:unknown)=>void>();let next=0;
  const body={isConnected:true,textContent:''};let currentBody=body;
  const element={isConnected:true,textContent:'',outerHTML:'<controlled-empty-assistant/>',contains:(candidate:unknown)=>candidate===currentBody,querySelector:()=>currentBody};let currentElement=element;
  const active={id:'response',text:''};
  const context={window:{benchHost:{readProgress:()=>({activeMessage:active}),locators:{messageContent:()=>'.controlled-content'}}},document:{querySelector:(selector:string)=>selector==='.controlled-content'?currentBody:currentElement},performance:{now:()=>observedAt},requestAnimationFrame:(callback:(value:unknown)=>void)=>{callbacks.set(++next,callback);return next;}};
  const task=runInNewContext(`(${helper.observeEmptyHostFrames.toString()})('response')`,context) as ReturnType<typeof helper.observeEmptyHostFrames>;
  let settled=false;void task.then(()=>{settled=true;},()=>{settled=true;});
  return {task,callbacks,active,body,element,isSettled:()=>settled,replaceHost:()=>{currentElement={...element};},replaceBody:()=>{currentBody={...body};},async emit(value:unknown){expect(callbacks.size).toBe(1);const [handle,callback]=callbacks.entries().next().value!;callbacks.delete(handle);callback(value);await Promise.resolve();await Promise.resolve();}};
}

test('H01 observer preserves the exact earlier original CI timestamp until two eligible callbacks',async()=>{
  const p=emptyHostObserver(519.1000000000931);await p.emit(519.1);await p.emit(535.8);
  expect(p.isSettled()).toBe(false);await p.emit(552.5);const observed=await p.task;
  expect(observed.frames).toEqual([535.8,552.5]);expect(observed.observedAt).toBe(519.1000000000931);
  expect(Reflect.get(observed,'callbacks').map((row:{timestampMs:number})=>row.timestampMs)).toEqual([519.1,535.8,552.5]);
  expect(observed.snapshots).toHaveLength(4);expect(observed.empty).toBe(true);expect(observed.retained).toBe(true);expect(p.callbacks.size).toBe(0);
});
test('H01 observer retains every repeated earlier callback and its snapshot',async()=>{
  const p=emptyHostObserver();for(const time of [99,98,99]){await p.emit(time);expect(p.isSettled()).toBe(false);}await p.emit(100);await p.emit(120);const observed=await p.task;
  expect(observed.frames).toEqual([100,120]);expect(Reflect.get(observed,'callbacks').map((row:{timestampMs:number;eligible:boolean})=>[row.timestampMs,row.eligible])).toEqual([[99,false],[98,false],[99,false],[100,true],[120,true]]);expect(observed.snapshots).toHaveLength(6);
});
test.each([NaN,Infinity,-Infinity,-1,undefined,null,'100',Symbol('invalid')])('H01 observer rejects malformed original first timestamp %s',async value=>{
  const p=emptyHostObserver();await p.emit(value);expect(p.isSettled()).toBe(true);await expect(p.task).rejects.toThrow('Distinct chronological rAF timestamp unavailable');expect(p.callbacks.size).toBe(0);
});
test.each([100,99,NaN])('H01 observer rejects post-first nonprogressing timestamp %s',async value=>{
  const p=emptyHostObserver();await p.emit(100);await p.emit(value);await expect(p.task).rejects.toThrow('Distinct chronological rAF timestamp unavailable');expect(p.callbacks.size).toBe(0);
});
test.each(['host','body','text'] as const)('H01 observer checks original %s on every rejected callback',async change=>{
  const p=emptyHostObserver();if(change==='host')p.replaceHost();else if(change==='body')p.replaceBody();else p.active.text='early';await p.emit(99);await p.emit(100);expect(p.isSettled()).toBe(false);await p.emit(120);const observed=await p.task;
  expect(change==='host'?observed.retained:observed.empty).toBe(false);
  const first=observed.callbacks[0];if(first===undefined)throw new Error('Original rejected callback was not retained');expect(first.timestampMs).toBe(99);expect(first.eligible).toBe(false);expect(change==='host'?first.retained:first.empty).toBe(false);expect(observed.snapshots).toHaveLength(4);
});

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const directories: string[] = [];
afterEach(async () => {
  const failures: unknown[] = [];
  for (const directory of directories.splice(0)) try {await rm(directory, {recursive: true, force: true});} catch (error) {failures.push(error);}
  if (failures.length) throw new AggregateError(failures, 'Controlled snapshot fixture cleanup failed');
});
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const versions = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0'} as const;
const reason = 'Synthetic filesystem fixture; no browser collection was attempted';
// Explicit maintained audit scope. Product/probe/output/package inventories below come from current inputs.
const foundationSources = ['packages/analyzer/src/browser-frame-ordered-state-v2.test.ts',
  'packages/analyzer/src/browser-frame-ordered-state.ts',
  'packages/analyzer/src/browser-frame-trace-evidence.test.ts',
  'packages/analyzer/src/browser-frame-trace-evidence.ts',
  'packages/analyzer/src/browser-frame-track-descriptor-fragments.test.ts',
  'packages/analyzer/src/browser-frame-track-descriptor-fragments.ts',
  'packages/runner/src/comparison-proto-public-ports.test.ts',
  'packages/runner/src/comparison-proto-public-ports.ts'];
const analyzerSelected12 = [...d0FramerMembers.slice(2),'packages/analyzer/dist/browser-frame-ordered-state.d.ts',
  'packages/analyzer/dist/browser-frame-ordered-state.js',
  'packages/analyzer/dist/browser-frame-ordered-state.js.map',
  'packages/analyzer/dist/browser-frame-trace-evidence.d.ts',
  'packages/analyzer/dist/browser-frame-trace-evidence.js',
  'packages/analyzer/dist/browser-frame-trace-evidence.js.map',
  'packages/analyzer/dist/browser-frame-track-descriptor-fragments.d.ts',
  'packages/analyzer/dist/browser-frame-track-descriptor-fragments.js',
  'packages/analyzer/dist/browser-frame-track-descriptor-fragments.js.map'];
const foundationOutputs = [...analyzerSelected12, ...['.d.ts','.js','.js.map'].map(ext=>'packages/runner/dist/comparison-proto-public-ports'+ext)];
const nativeCaptureMembers = [
  'packages/runner/src/comparison-proto-native-capture.ts',
  'packages/runner/src/comparison-proto-native-capture.test.ts',
  'packages/runner/dist/comparison-proto-native-capture.d.ts',
  'packages/runner/dist/comparison-proto-native-capture.js',
  'packages/runner/dist/comparison-proto-native-capture.js.map',
];
const source59 = [
  nativePhasePackageMember,
  d1AnnotationTestMember,
  ...d0FramerMembers.slice(0,2),
  ...nativeCaptureMembers.slice(0, 2),
  ...foundationSources,
  '.github/workflows/ci.yml', 'apps/threadplane/probe-provenance.mjs', 'apps/threadplane/probe-provenance.test.ts', 'package.json',
  'packages/runner/src/comparison-assembly-worker.test.ts', 'packages/runner/src/comparison-assembly-worker.ts',
  'packages/runner/src/comparison-browser.test-helper.test.ts', 'packages/runner/src/comparison-browser.test-helper.ts', 'packages/runner/src/comparison-browser.test.ts',
  'packages/runner/src/comparison-capture-journal.test.ts', 'packages/runner/src/comparison-capture-journal.ts',
  'packages/runner/src/comparison-counters.test.ts', 'packages/runner/src/comparison-counters.ts',
  'packages/runner/src/comparison-lifecycle-oracle.test.ts', 'packages/runner/src/comparison-lifecycle-oracle.ts',
  'packages/runner/src/comparison-native-input.test.ts', 'packages/runner/src/comparison-native-input.ts',
  'packages/runner/src/comparison-observations.test.ts', 'packages/runner/src/comparison-observations.ts',
  'packages/runner/src/comparison-ownership.test.ts', 'packages/runner/src/comparison-ownership.ts',
  'packages/runner/src/comparison-proto-trace.test.ts', 'packages/runner/src/comparison-proto-trace.ts',
  'packages/runner/src/comparison-provenance.test.ts', 'packages/runner/src/comparison-provenance.ts',
  'packages/runner/src/comparison-threadplane.test.ts', 'packages/runner/src/comparison-threadplane.ts',
  'packages/runner/src/comparison-trace.test.ts', 'packages/runner/src/comparison-trace.ts',
  'packages/runner/src/environment.test.ts', 'packages/runner/src/environment.ts', 'packages/runner/src/index.ts',
  'packages/runner/src/long-thread-capture.test.ts', 'packages/runner/src/long-thread-capture.ts',
  'packages/runner/src/long-thread-main.test.ts', 'packages/runner/src/long-thread-main.ts',
  'packages/runner/src/long-thread-run.test.ts', 'packages/runner/src/long-thread-run.ts',
  'packages/runner/src/comparison-runtime-family.ts', 'packages/runner/src/comparison-runtime-family.test.ts',
  'packages/runner/src/comparison-scroll-fresh.test.ts',
  'packages/contract/tsconfig.types.json', 'packages/contract/type-tests/comparison-families.ts',
  'vitest.comparison.browser.config.ts', 'vitest.config.ts',
].sort();
const source23 = [
  ...foundationSources,
  '.github/workflows/ci.yml', 'package.json',
  'packages/runner/src/comparison-browser.test-helper.test.ts', 'packages/runner/src/comparison-browser.test-helper.ts', 'packages/runner/src/comparison-browser.test.ts',
  'packages/runner/src/comparison-lifecycle-oracle.test.ts', 'packages/runner/src/comparison-lifecycle-oracle.ts',
  'packages/runner/src/comparison-observations.test.ts', 'packages/runner/src/comparison-observations.ts',
  'packages/runner/src/comparison-proto-trace.test.ts', 'packages/runner/src/comparison-proto-trace.ts',
  'packages/runner/src/long-thread-capture.test.ts', 'packages/runner/src/long-thread-capture.ts',
  'vitest.comparison.browser.config.ts', 'vitest.config.ts',
].sort();
const oracleMembers = [
  'packages/runner/src/comparison-lifecycle-oracle.ts',
  'packages/runner/src/comparison-lifecycle-oracle.test.ts',
  'packages/runner/dist/comparison-lifecycle-oracle.d.ts',
  'packages/runner/dist/comparison-lifecycle-oracle.js',
  'packages/runner/dist/comparison-lifecycle-oracle.js.map',
];
// Independent current Linux catalogue from the original failed-head build metadata.
const expectedProductMetadata50 = [
  "apps/threadplane/node_modules/@angular/build",
  "apps/threadplane/node_modules/@angular/cli",
  "apps/threadplane/node_modules/@angular/common",
  "apps/threadplane/node_modules/@angular/compiler",
  "apps/threadplane/node_modules/@angular/compiler-cli",
  "apps/threadplane/node_modules/@angular/core",
  "apps/threadplane/node_modules/@angular/platform-browser",
  "apps/threadplane/node_modules/@angular/router",
  "apps/threadplane/node_modules/@cacheplane/partial-json",
  "apps/threadplane/node_modules/@cacheplane/partial-markdown",
  "apps/threadplane/node_modules/@json-render/core",
  "apps/threadplane/node_modules/@langchain/core",
  "apps/threadplane/node_modules/@langchain/core/node_modules/langsmith",
  "apps/threadplane/node_modules/@langchain/langgraph-sdk",
  "apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue",
  "apps/threadplane/node_modules/@langchain/langgraph-sdk/node_modules/p-queue/node_modules/p-timeout",
  "apps/threadplane/node_modules/@threadplane/a2ui",
  "apps/threadplane/node_modules/@threadplane/chat",
  "apps/threadplane/node_modules/@threadplane/langgraph",
  "apps/threadplane/node_modules/@threadplane/render",
  "apps/threadplane/node_modules/@threadplane/telemetry",
  "apps/threadplane/node_modules/marked",
  "apps/threadplane/node_modules/rxjs",
  "apps/threadplane/node_modules/typescript",
  "apps/threadplane/node_modules/vitest",
  "node_modules/@cfworker/json-schema",
  "node_modules/@langchain/protocol",
  "node_modules/@opentelemetry/api",
  "node_modules/@standard-schema/spec",
  "node_modules/@types/json-schema",
  "node_modules/base64-js",
  "node_modules/commander",
  "node_modules/eventemitter3",
  "node_modules/is-network-error",
  "node_modules/js-tiktoken",
  "node_modules/katex",
  "node_modules/mustache",
  "node_modules/openai",
  "node_modules/p-finally",
  "node_modules/p-queue",
  "node_modules/p-queue/node_modules/eventemitter3",
  "node_modules/p-retry",
  "node_modules/p-timeout",
  "node_modules/react",
  "node_modules/react-dom",
  "node_modules/scheduler",
  "node_modules/tslib",
  "node_modules/undici",
  "node_modules/ws",
  "node_modules/zod"
] as const;
const expectedMetadata52 = [...expectedProductMetadata50.map(path => path + "/package.json"), "node_modules/typescript/package.json", "node_modules/@typescript/typescript-linux-x64/package.json"].sort();
async function physicalFiles(root: string, relative: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(join(root, relative), {withFileTypes: true})) {
    const key = relative + '/' + entry.name;
    if (entry.isDirectory()) result.push(...await physicalFiles(root, key));
    else {expect(entry.isFile()).toBe(true); result.push(key);}
  }
  return result.sort();
}
const canonicalFixtures = new Map<number, {bytes: Buffer; workload: ReturnType<typeof createLongThreadFixture>['workload']}>();
function canonicalFixture(caseIndex: number) {
  let value = canonicalFixtures.get(caseIndex);
  if (!value) {
    const fixture = createLongThreadFixture({seed: 1, historyCount: ([100, 1000, 10000] as const)[Math.floor(caseIndex / 4)]!, responseBytes: caseIndex % 4 < 2 ? 6400 : 262144, journey: caseIndex % 2 === 0 ? 'follow' : 'history-reading'});
    value = {bytes: Buffer.from(canonicalSerialize(fixture) + '\n'), workload: fixture.workload}; canonicalFixtures.set(caseIndex, value);
  }
  return value;
}
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'comparison-snapshot-unit-')); directories.push(directory);
  const workspace = join(directory, 'original'), evidenceRoot = join(directory, 'evidence'), root = join(evidenceRoot, 'comparison-browser-root-controlled');
  await mkdir(workspace, {recursive: true}); await mkdir(root, {recursive: true});
  const build = adapterBuildSchema.parse(JSON.parse(await readFile(join(repository, 'apps/threadplane/.build-evidence.json'), 'utf8')));
  const probe = comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(repository, 'packages/runner/.comparison-build-evidence.json'), 'utf8')));
  const lock = JSON.parse(await readFile(join(repository, 'package-lock.json'), 'utf8')) as {packages: Record<string, {version: string; integrity: string}>};
  const nativePath = 'node_modules/@typescript/typescript-linux-x64', nativeLock = lock.packages[nativePath]!;
  expect(nativeLock).toBeDefined();
  // This is controlled Linux metadata emulation, not a claim about this decoder's OS or an actual Linux capture.
  probe.nativeCompiler = {...probe.nativeCompiler, name: '@typescript/typescript-linux-x64', resolutionPath: nativePath, executablePath: nativePath + '/lib/tsc', platform: 'linux', architecture: 'x64', integrity: nativeLock.integrity, version: nativeLock.version};
  const output138 = [...await physicalFiles(repository, 'packages/contract/dist'), ...await physicalFiles(repository, 'packages/runner/dist')].sort();
  expect(output138).toHaveLength(138);
  expect(output138.filter(key => key.includes('/comparison-lifecycle-oracle.'))).toEqual(oracleMembers.slice(2));
  expect(build.packages.map(pkg => pkg.resolutionPath).sort()).toEqual(expectedProductMetadata50);
  expect(Object.keys(build.assetHashes)).toHaveLength(12);
  const metadata52 = [...new Set([...build.packages, probe.compiler, probe.nativeCompiler].map(pkg => pkg.resolutionPath + '/package.json'))].sort();
  expect(metadata52).toEqual(expectedMetadata52);
  const assets = Object.keys(build.assetHashes).map(key => 'apps/threadplane/dist/' + key);
  const raw2 = ['apps/threadplane/.build-evidence.json', 'packages/runner/.comparison-build-evidence.json'];
  const union = [...new Set([...source59, ...Object.keys(build.sourceHashes), ...Object.keys(probe.sourceHashes), ...output138, ...analyzerSelected12, ...metadata52, ...assets, ...raw2])].sort();
  const copyKeys = union.filter(key => !raw2.includes(key) && key !== nativePath + '/package.json');
  const copyParents = [...new Set(copyKeys.map(key => dirname(join(workspace, key))))];
  for (const parent of copyParents) await mkdir(parent, {recursive: true});
  for (const key of copyKeys) {
    // The new maintained test supplies its own bytes in the defect-baseline projection too.
    await copyFile(key === 'packages/runner/src/comparison-browser.test-helper.test.ts' ? fileURLToPath(import.meta.url) : join(repository, key), join(workspace, key));
  }
  await mkdir(join(workspace, nativePath), {recursive: true});
  await writeFile(join(workspace, nativePath, 'package.json'), JSON.stringify({name: probe.nativeCompiler.name, version: probe.nativeCompiler.version}) + '\n');
  const fact = async (key: string) => {const bytes = await readFile(join(workspace, key)); return {byteLength: bytes.length, sha256: sha256(bytes)};};
  for (const key of Object.keys(build.sourceHashes)) build.sourceHashes[key] = (await fact(key)).sha256;
  for (const key of Object.keys(probe.sourceHashes)) probe.sourceHashes[key] = (await fact(key)).sha256;
  for (const key of Object.keys(probe.compiledHashes)) probe.compiledHashes[key] = (await fact(key)).sha256;
  probe.compilerPackageMetadata = await fact('node_modules/typescript/package.json'); probe.nativeCompilerPackageMetadata = await fact(nativePath + '/package.json');
  await writeFile(join(workspace, raw2[0]!), canonicalSerialize(adapterBuildSchema.parse(build)) + '\n');
  await writeFile(join(workspace, raw2[1]!), canonicalSerialize(comparisonInstrumentationBuildSchema.parse(probe)) + '\n');
  const context = {ci: 'true', runId: '123', runAttempt: '1', repository: 'cacheplane/chat-ui-bench', workflowRef: 'cacheplane/chat-ui-bench/.github/workflows/ci.yml@refs/heads/main', eventName: 'push', sha: '1'.repeat(40), platform: 'linux', architecture: 'x64'};
  const config = parseLongThreadArgs(['--mode', 'headless', '--rounds', '1', '--seed', '1', '--out', root]);
  if (config.help) throw new Error('Controlled fixture configuration unexpectedly requested help');
  const ledger = createLongThreadLedger(config); ledger.status = 'failed';
  for (const row of ledger.runs) {row.status = 'failed'; row.reasons = [reason];}
  const terminalLedger = comparisonCaptureInvocationSchema.parse(ledger), invocationId = randomUUID();
  const claim = {...versions, kind: 'invocation-ownership-claim', invocationId, createdAt: terminalLedger.createdAt, purpose: 'conformance', configuration: config.configuration};
  const members: {path: string; byteLength: number; sha256: string}[] = [];
  const put = async (path: string, value: unknown) => {const bytes = Buffer.from(canonicalSerialize(value) + '\n'); await mkdir(dirname(join(root, path)), {recursive: true}); await writeFile(join(root, path), bytes); const row = {path, byteLength: bytes.length, sha256: sha256(bytes)}; members.push(row); return row;};
  await put('invocation-claim.json', claim); const ledgerMember = await put('invocation.json', terminalLedger);
  const slots = [];
  for (const row of terminalLedger.runs) {
    const identity = {...versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile};
    const base = row.artifactDirectory, canonical = canonicalFixture(row.caseIndex);
    await put(base + '/descriptor.json', comparisonScheduledRunSchema.parse({...identity, seed: 1, mode: 'headless', artifactDirectory: base}));
    await put(base + '/validation.json', comparisonValidationSchema.parse({...identity, status: 'failed', checks: [{name: 'synthetic-only', passed: false, reason, evidencePaths: ['descriptor.json']}], reasons: [reason]}));
    await put(base + '/exceptions.json', comparisonExceptionsSchema.parse({...identity, exceptions: []}));
    await put(base + '/raw-inventory.json', comparisonRawInventorySchema.parse({...identity, status: 'partial', reason, files: []}));
    await writeFile(join(root, base, 'fixture.json'), canonical.bytes); members.push({path: base + '/fixture.json', byteLength: canonical.bytes.length, sha256: sha256(canonical.bytes)});
    const {adapterProfile: _profile, ...manifestIdentity} = identity;
    await put(base + '/manifest.json', comparisonManifestSchema.parse({...manifestIdentity, caseOrder: config.configuration.caseOrder, workload: canonical.workload,
      git: {revision: context.sha, dirty: false}, fixture: {file: 'fixture.json', sha256: sha256(canonical.bytes)}, browser: {executable: 'controlled-no-browser', version: 'controlled', revision: 'controlled', flags: []},
      environment: {os: 'controlled', architecture: 'controlled', cpu: {status: 'unavailable', reason}, gpu: {status: 'unavailable', reason}}, mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1}, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
      adapter: {id: 'threadplane', profile: row.adapterProfile, capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, build, configuration: {markdown: 'default', pinThresholdCssPx: 150, telemetry: 'disabled'}},
    }));
    slots.push({identity, artifactDirectory: base, status: 'failed' as const});
  }
  const datasetDirectories = new Set<string>();
  for (const member of members) {let path = dirname(member.path); while (path !== '.') {datasetDirectories.add(path); path = dirname(path);}}
  const seal = comparisonDatasetInventorySchema.parse({...versions, invocationId, status: 'sealed', configuration: config.configuration, invocationClaim: claim, invocationLedger: terminalLedger, root: '.', ledger: ledgerMember, members: members.sort((a, b) => a.path.localeCompare(b.path)), absentMembers: [], directories: [...datasetDirectories].sort(), slots, ownershipSettled: true, finalizationSucceeded: true});
  await writeFile(join(root, 'dataset-seal.json'), canonicalSerialize(seal) + '\n');
  const hashed = new Set([...Object.keys(build.sourceHashes), ...Object.keys(probe.sourceHashes), ...Object.keys(probe.compiledHashes), ...assets,
    probe.compiler.resolutionPath + '/package.json', probe.nativeCompiler.resolutionPath + '/package.json']);
  const paddingKeys = source59.filter(key => key.endsWith('.test.ts') && !hashed.has(key));
  // Only synthetic file/lock extrema may compact unlocked, named JavaScript/declaration copies.
  // Both use the same AST, raw literal/comment and exact newline parity checks below.
  const syntheticExtremumPaddingKeys = [...new Set([...paddingKeys, ...output138.filter(key => (key.endsWith('.js') || key.endsWith('.d.ts')) && !hashed.has(key))])].sort();
  return {root, workspace, evidenceRoot, context, union, paddingKeys, syntheticExtremumPaddingKeys, syntheticExtremumProtectedKeys: [...hashed]};
}
const writer = () => helper.writeComparisonCiSnapshot;
type Fixture = Awaited<ReturnType<typeof fixture>>;
const COPY_TRIGGER = '/workspace/vitest.config.ts';
function duringLastCopy(f: Fixture, mutation: (ownRoot: string) => Promise<void>): typeof open {
  let invoked = false;
  return (async (...args: Parameters<typeof open>) => {
    const fd = await open(...args), path = String(args[0]);
    if (!invoked && typeof args[1] === 'number' && (args[1] & constants.O_CREAT) !== 0 && path.includes('comparison-browser-ci-context-') && path.endsWith(COPY_TRIGGER)) {
      invoked = true;
      try {await mutation(path.slice(0, -COPY_TRIGGER.length));} catch (error) {try {await fd.close();} catch (closeError) {throw new AggregateError([error, closeError], 'Controlled mutation and descriptor close failed');} throw error;}
    }
    return fd;
  }) as typeof open;
}
async function padUnion(f: Fixture, target: number) {
  let total = 0; for (const key of f.union) total += (await stat(join(f.workspace, key))).size;
  expect(total).toBeLessThan(target);
  for (const key of f.paddingKeys) {
    const path = join(f.workspace, key), bytes = await readFile(path), addition = Math.min(target - total, 1024 * 1024 - bytes.length);
    if (addition > 0) {await writeFile(path, Buffer.concat([bytes, Buffer.alloc(addition, 32)])); total += addition;}
    if (total === target) break;
  }
  expect(total).toBe(target);
}
async function lockExtension(f: Fixture, scalarOrContainer: string) {
  const key = 'package-lock.json', path = join(f.workspace, key), original = (await readFile(path, 'utf8')).trimEnd();
  expect(original.endsWith('}')).toBe(true);
  const bytes = Buffer.from(original.slice(0, -1) + ',"controlledExtension":' + scalarOrContainer + '}\n');
  await writeFile(path, bytes);
  const buildPath = join(f.workspace, 'apps/threadplane/.build-evidence.json'), probePath = join(f.workspace, 'packages/runner/.comparison-build-evidence.json');
  const build = adapterBuildSchema.parse(JSON.parse(await readFile(buildPath, 'utf8'))), probe = comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(probePath, 'utf8')));
  // Keep all original package rows, records and manifest digests consistent; only the bounded JSON obligation differs.
  for (const hashes of [build.sourceHashes, build.copiedSourceHashes, probe.sourceHashes]) if (Object.hasOwn(hashes, key)) hashes[key] = sha256(bytes);
  await writeFile(buildPath, canonicalSerialize(build) + '\n'); await writeFile(probePath, canonicalSerialize(probe) + '\n');
  const sealPath = join(f.root, 'dataset-seal.json'), seal = comparisonDatasetInventorySchema.parse(JSON.parse(await readFile(sealPath, 'utf8')));
  for (const slot of seal.slots) {
    const relative = slot.artifactDirectory + '/manifest.json', manifestPath = join(f.root, relative);
    const manifest = comparisonManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8'))); manifest.adapter.build = build;
    const manifestBytes = Buffer.from(canonicalSerialize(manifest) + '\n'); await writeFile(manifestPath, manifestBytes);
    const member = seal.members.find(row => row.path === relative)!; member.byteLength = manifestBytes.length; member.sha256 = sha256(manifestBytes);
  }
  await writeFile(sealPath, canonicalSerialize(comparisonDatasetInventorySchema.parse(seal)) + '\n');
}

test('CI off performs no filesystem access', async () => {
  expect(await writer()('/not-present', {context: {ci: 'false', runId: undefined, runAttempt: undefined, repository: undefined, workflowRef: undefined, eventName: undefined, sha: undefined, platform: 'darwin', architecture: 'arm64'}, open: (() => {throw Error('must not open');}) as typeof open})).toBeNull();
});
test('closed original snapshot retains actual copy bytes and controlled Linux metadata', {timeout:10000}, async () => {
  const f = await fixture(), receipt = await writer()(f.root, f); expect(receipt).not.toBeNull();
  const bytes = await readFile(receipt!.path), manifest = JSON.parse(bytes.toString());
  expect(f.union).toHaveLength(310); expect(manifest.records).toHaveLength(310);
  expect(bytes.length).toBe(receipt!.byteLength); expect(sha256(bytes)).toBe(receipt!.sha256);
  expect(manifest.format).toBe('comparison-ci-original-snapshot-v10');
  expect(manifest.context.platform).toBe('linux'); expect(manifest.inventories.source59).toEqual(source59); expect(manifest.inventories.output138).toHaveLength(138); expect(manifest.inventories.contract42).toHaveLength(42); expect(manifest.inventories.metadata52).toEqual(expectedMetadata52);
  expect(Object.keys(manifest.inventories).sort()).toEqual(['source59','source23','product47','probe31','compiled16','output138','analyzerSelected12','contract42','raw2','assets','metadata52'].sort());
  expect(manifest.inventories.source23).toEqual(source23); expect(manifest.inventories.analyzerSelected12).toEqual([...analyzerSelected12].sort());
  expect(source59).toHaveLength(59); expect(source23).toHaveLength(23);
  const protoMembers = [
    'packages/runner/src/comparison-proto-trace.ts',
    'packages/runner/src/comparison-proto-trace.test.ts',
    'packages/runner/dist/comparison-proto-trace.d.ts',
    'packages/runner/dist/comparison-proto-trace.js',
    'packages/runner/dist/comparison-proto-trace.js.map',
  ];
  expect((await physicalFiles(repository, 'packages/runner/dist')).filter(key => key.includes('/comparison-proto-trace.')).sort()).toEqual(protoMembers.slice(2));
  expect(manifest.inventories.output138.filter((key: string) => key.includes('/comparison-proto-trace.'))).toEqual(protoMembers.slice(2));
  for (const key of [...protoMembers, ...foundationSources, ...foundationOutputs, ...nativeCaptureMembers]) {
    const record = manifest.records.find((row: {key:string}) => row.key === key);
    expect(record).toBeDefined();
    const original = await readFile(join(f.workspace, key)), copied = await readFile(join(receipt!.directory, record.copied.path));
    expect(original.equals(await readFile(join(repository, key)))).toBe(true);
    expect(copied.equals(original)).toBe(true);
    expect(record.before.fact).toEqual({byteLength: original.length, sha256: sha256(original)});
    expect(record.copied.fact).toEqual({byteLength: copied.length, sha256: sha256(copied)});
    expect(record.before).toEqual(record.after);
    expect(record.originalPath).toBe(join(f.workspace, key));
    for (const [path, identity] of [[record.originalPath, record.before.identity], [join(receipt!.directory, record.copied.path), record.copied.identity]] as const) {
      const actual = await stat(path, {bigint: true});
      expect(identity).toEqual({dev: String(actual.dev), ino: String(actual.ino), size: String(actual.size), mtimeNs: String(actual.mtimeNs), ctimeNs: String(actual.ctimeNs)});
    }
  }
  for (const key of oracleMembers) {
    const record = manifest.records.find((row: {key:string}) => row.key === key);
    expect(record).toBeDefined();
    expect(record.before.fact.sha256).toBe(sha256(await readFile(join(f.workspace,key))));
    expect(record.copied.fact).toEqual(record.before.fact);
  }
  for (const row of manifest.records) {expect((await readFile(join(receipt!.directory, row.copied.path))).equals(await readFile(row.originalPath))).toBe(true); expect(row.before).toEqual(row.after); expect(row.copied.fact).toEqual(row.before.fact);}
  expect(receipt!.lifetime.manifest.fact).toEqual({byteLength: receipt!.byteLength, sha256: receipt!.sha256});
  expect(receipt!.lifetime.directories.length).toBeGreaterThan(0);
  for (const row of receipt!.lifetime.directories) {expect(row.identity.dev).toBe(row.created.dev); expect(row.identity.ino).toBe(row.created.ino); expect((await readdir(join(receipt!.directory, row.path))).sort()).toEqual(row.members);}
  expect(receipt!.work.readBytes).toBeGreaterThan(manifest.work.beforeManifestReadBytes);
  expect(receipt!.work.writtenBytes).toBe(manifest.originalBytes + receipt!.byteLength);
  expect(receipt!.work.jsonFiles).toBe(68);
  expect(manifest.limits).toMatchObject({fileBytes: 1024 * 1024, lockBytes: 2 * 1024 * 1024, originalBytes: 8 * 1024 * 1024, files: 311, jsonFiles: 69, manifestBytes: 23348128, readBytes: 170428224, writeBytes: 31736736});
});
test.each(['read', 'close'] as const)('shared ancestor sibling churn after %s preserves the original snapshot', {timeout:10000}, async seam => {
  const f = await fixture(), ancestor = dirname(f.workspace), before = await stat(ancestor, {bigint: true});
  const source = join(f.workspace, seam === 'read' ? 'apps/threadplane/.build-evidence.json' : '.github/workflows/ci.yml');
  let selected = false, changed = false, readBytes = false;
  const churn = async () => {
    await mkdir(join(ancestor, 'unrelated-sibling'));
    const after = await stat(ancestor, {bigint: true});
    expect(after.isDirectory()).toBe(true); expect(after.dev).toBe(before.dev); expect(after.ino).toBe(before.ino);
    expect(after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs).toBe(true);
    changed = true;
  };
  const injected = (async (...args: Parameters<typeof open>) => {
    const fd = await open(...args);
    if (selected || String(args[0]) !== source) return fd;
    selected = true;
    return new Proxy(fd, {get(original, key) {
      if (key === 'read') return async (buffer: Buffer, offset: number, length: number, position: number | null) => {
        const result = await original.read(buffer, offset, length, position);
        if (result.bytesRead > 0) {
          readBytes = true;
          if (seam === 'read' && !changed) await churn();
        }
        return result;
      };
      if (key === 'close' && seam === 'close') return async () => {
        const result = await original.close();
        if (readBytes && !changed) await churn();
        return result;
      };
      const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
    }});
  }) as typeof open;
  let receipt: Awaited<ReturnType<typeof helper.writeComparisonCiSnapshot>>;
  try {receipt = await writer()(f.root, {...f, open: injected});}
  finally {expect(selected).toBe(true); expect(readBytes).toBe(true); expect(changed).toBe(true);}
  expect(receipt).not.toBeNull();
  const manifest = JSON.parse((await readFile(receipt!.path)).toString()), row = manifest.ancestors.find((value: {path: string}) => value.path === ancestor);
  expect(row).toBeDefined(); expect(row.before.dev).toBe(row.after.dev); expect(row.before.ino).toBe(row.after.ino);
  if (seam === 'close') expect(row.before.mtimeNs !== row.after.mtimeNs || row.before.ctimeNs !== row.after.ctimeNs).toBe(true);
});
test.each(['repository', 'sha', 'runId', 'workflowRef'])('unsafe CI context %s fails before copying', async key => {const f = await fixture(); await expect(writer()(f.root, {...f, context: {...f.context, [key]: 'unsafe\nvalue'}})).rejects.toThrow();});
test('equal workspace and evidence roots fail at the domain obligation', async () => {
  const f = await fixture(), root = join(f.workspace, 'comparison-browser-root-controlled');
  // All required originals and root metadata remain present. V1 can complete this equal-root snapshot.
  await cp(f.root, root, {recursive: true});
  await expect(writer()(root, {...f, evidenceRoot: f.workspace})).rejects.toThrow('root domains');
});
test('earlier own copy corruption is rejected at lifetime closure', {timeout:10000}, async () => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {const path = join(own, 'workspace/.github/workflows/ci.yml'), bytes = await readFile(path); bytes[0] = bytes[0]! ^ 1; await writeFile(path, bytes);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('own physical member identity');
});
test('earlier own copy replacement with identical bytes is rejected at lifetime closure', {timeout:10000}, async () => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {const path = join(own, 'workspace/.github/workflows/ci.yml'), bytes = await readFile(path); await unlink(path); await writeFile(path, bytes);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('own physical member identity');
});
test('earlier own directory replacement fails its original creation identity', {timeout:10000}, async () => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {
    const original = join(own, 'workspace/.github'), moved = join(f.evidenceRoot, 'moved-own-github');
    await rename(original, moved); await mkdir(join(original, 'workflows'), {recursive: true});
    await rename(join(moved, 'workflows/ci.yml'), join(original, 'workflows/ci.yml'));
  });
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('own directory creation identity');
});
test.each(['file', 'directory'])('extra own %s admitted after an earlier copy fails closure', {timeout:10000}, async kind => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {const path = join(own, 'workspace/extra-own'); if (kind === 'file') await writeFile(path, 'extra'); else await mkdir(path);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow(kind === 'file' ? 'unexpected own member' : 'extra copied directory');
});
test('earlier own nonregular copy fails closure', {timeout:10000}, async () => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {const path = join(own, 'workspace/.github/workflows/ci.yml'); await unlink(path); await mkdir(path);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('extra copied directory');
});
test('earlier own symlink copy fails closure', {timeout:10000}, async () => {
  const f = await fixture(), injected = duringLastCopy(f, async own => {const path = join(own, 'workspace/.github/workflows/ci.yml'); await unlink(path); await symlink(join(f.workspace, '.github/workflows/ci.yml'), path);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('symlink');
});
test.each(['output', 'asset'])('scoped %s membership mutation after copy fails final closure', {timeout:10000}, async scope => {
  const f = await fixture(), injected = duringLastCopy(f, async () => {await mkdir(join(f.workspace, scope === 'output' ? 'packages/contract/dist/extra' : 'apps/threadplane/dist/extra'));});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow(scope === 'output' ? 'unexpected output directory' : 'asset directory entry cap');
});
test('scoped served asset bytes changed after copy fail original lifetime identity', {timeout:10000}, async () => {
  const f = await fixture(), asset = f.union.find(key => key.startsWith('apps/threadplane/dist/'))!, injected = duringLastCopy(f, async () => {const path = join(f.workspace, asset), bytes = await readFile(path); bytes[0] = bytes[0]! ^ 1; await writeFile(path, bytes);});
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('original identity changed');
});
test('scoped unselected output bytes changed after copy fail original lifetime identity', {timeout:10000}, async () => {
  const f = await fixture(), key = f.union.find(key => key.startsWith('packages/contract/dist/') && key.endsWith('.d.ts'))!, injected = duringLastCopy(f, async () => {
    const path = join(f.workspace, key), bytes = await readFile(path); bytes[0] = bytes[0]! ^ 1; await writeFile(path, bytes);
  });
  await expect(writer()(f.root, {...f, open: injected})).rejects.toThrow('original identity changed');
});
test('original ancestor symlink fails without resolving to a convenient copy', async () => {const f = await fixture(), alias = join(dirname(f.workspace), 'alias'); await symlink(f.workspace, alias); await expect(writer()(f.root, {...f, workspace: alias})).rejects.toThrow('symlink');});
test('nonregular original fails the genuine pre-read type check', async () => {const f = await fixture(), path = join(f.workspace, f.paddingKeys[0]!); await unlink(path); await mkdir(path); await expect(writer()(f.root, f)).rejects.toThrow('pre-read file cap');});
test.each(oracleMembers)('snapshot-v6 rejects missing oracle member %s', async key => {
  const f = await fixture(); await unlink(join(f.workspace,key));
  await expect(writer()(f.root,f)).rejects.toThrow();
});
test('snapshot-v6 rejects an unexpected compiled oracle member', async () => {
  const f = await fixture();
  await writeFile(join(f.workspace,'packages/runner/dist/comparison-lifecycle-oracle.extra.js'),'extra');
  await expect(writer()(f.root,f)).rejects.toThrow();
});
test('named original output symlink fails physical output closure', async () => {
  const f = await fixture(), key = f.union.find(key => key.startsWith('packages/contract/dist/') && key.endsWith('.d.ts'))!, path = join(f.workspace, key);
  await unlink(path); await symlink(join(f.workspace, f.paddingKeys[0]!), path);
  await expect(writer()(f.root, f)).rejects.toThrow('output symlink');
});
test('named original nonregular output fails physical output closure', async () => {
  const f = await fixture(), key = f.union.find(key => key.startsWith('packages/contract/dist/') && key.endsWith('.d.ts'))!, path = join(f.workspace, key);
  await unlink(path); await mkdir(path);
  await expect(writer()(f.root, f)).rejects.toThrow('unexpected output directory');
});
test('distinct named originals cannot share a hardlink inode', async () => {const f = await fixture(), a = join(f.workspace, f.paddingKeys[0]!), b = join(f.workspace, f.paddingKeys[1]!); await unlink(b); await link(a, b); await expect(writer()(f.root, f)).rejects.toThrow('original hardlink');});
test.each(['stat', 'read', 'write'])('falsy descriptor %s and genuine close error both survive', async fault => {
  const f = await fixture(), closeError = Error('controlled close failure');
  const injected = (async (...args: Parameters<typeof open>) => {
    const fd = await open(...args), path = String(args[0]), target = fault === 'write' ? path.includes('comparison-browser-ci-context-') && path.endsWith('/workspace/.github/workflows/ci.yml') : path.endsWith('/dataset-seal.json');
    if (!target) return fd;
    return new Proxy(fd, {get(original, key) {if (key === fault) return async () => {throw false;}; if (key === 'close') return async () => {await original.close(); throw closeError;}; const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;}});
  }) as typeof open;
  let caught: unknown; try {await writer()(f.root, {...f, open: injected});} catch (error) {caught = error;}
  expect(caught).toBeInstanceOf(AggregateError); expect((caught as AggregateError).errors).toEqual([false, closeError]);
  expect((caught as AggregateError).errors[0]).toBe(false); expect((caught as AggregateError).errors[1]).toBe(closeError);
});
for (const excess of [0, 1]) test(`end-to-end file cap exact plus ${excess} uses the largest synthetic AST-identical unhashed maintained source`, {timeout:excess===0?10000:5000}, async () => {
  const f = await fixture(); await compactSyntheticExtremumFixture(f);
  const candidates = await Promise.all(f.paddingKeys.map(async key => ({key, bytes: (await stat(join(f.workspace, key))).size})));
  candidates.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
  const key = candidates[0]!.key, path = join(f.workspace, key), bytes = await readFile(path);
  let unionBytes = 0; for (const member of f.union) unionBytes += (await stat(join(f.workspace, member))).size;
  expect(unionBytes + 1024 * 1024 - bytes.length).toBeLessThanOrEqual(8 * 1024 * 1024);
  await writeFile(path, Buffer.concat([bytes, Buffer.alloc(1024 * 1024 + excess - bytes.length, 32)]));
  if (excess) await expect(writer()(f.root, f)).rejects.toThrow('pre-read file cap');
  else {const receipt = await writer()(f.root, f), manifest = JSON.parse(await readFile(receipt!.path, 'utf8')); expect(manifest.records.find((row: {key: string}) => row.key === key).before.fact.byteLength).toBe(1024 * 1024);}
});
// Test-only synthetic file/lock-extremum text. Normal real-byte snapshots stay unchanged.
function lockFixtureParse(text:string){const parsed=parseSync('controlled.ts',text,{lang:'ts',astType:'ts'});expect(parsed.errors).toEqual([]);return parsed;}
function lockFixtureNodes(node:unknown,visit:(n:{type:string;start:number;end:number})=>void):void{
  if(!node||typeof node!=='object'||!('type'in node))return;visit(node as {type:string;start:number;end:number});
  for(const value of Object.values(node)){if(Array.isArray(value))for(const child of value)lockFixtureNodes(child,visit);else lockFixtureNodes(value,visit);}
}
function assertLockFixtureParity(original:string,candidate:string):void{
  const a=lockFixtureParse(original),b=lockFixtureParse(candidate),normalized=(v:unknown)=>JSON.stringify(v,(key,value)=>['start','end','loc','range','span'].includes(key)?undefined:typeof value==='bigint'?{_bigint:String(value)}:value);
  expect(normalized(b.program)).toBe(normalized(a.program));
  const raw=(parsed:ReturnType<typeof lockFixtureParse>,text:string)=>{const literals:string[]=[];lockFixtureNodes(parsed.program,n=>{if(n.type==='Literal'||n.type==='TemplateLiteral')literals.push(text.slice(n.start,n.end));});return {literals,comments:parsed.comments.map(c=>text.slice(c.start,c.end))};};
  expect(raw(b,candidate)).toEqual(raw(a,original));expect(candidate.match(/\r\n|\r|\n/g)).toEqual(original.match(/\r\n|\r|\n/g));
}
// Reuse only exact text whose complete parity checks already succeeded. Each
// fixture still reads/caps its own original, writes its own copy and hashes it.
const verifiedExtremumTexts=new Map<string,string>();
let verifiedExtremumUnits=0;
function compactSyntheticExtremumText(original:string):string{
  const cached=verifiedExtremumTexts.get(original);if(cached!==undefined)return cached;
  const pass=(text:string,leading:boolean)=>{const parsed=lockFixtureParse(text),mask=new Uint8Array(text.length);lockFixtureNodes(parsed.program,n=>{if(n.type==='Literal'||n.type==='TemplateLiteral')mask.fill(1,n.start,n.end);});for(const c of parsed.comments)mask.fill(1,c.start,c.end);
      let candidate='';for(let i=0;i<text.length;){if(!mask[i]&&(text[i]===' '||text[i]==='\t')){let end=i+1;while(end<text.length&&!mask[end]&&(text[end]===' '||text[end]==='\t'))end++;const remove=leading?(i===0||text[i-1]==='\n'||text[i-1]==='\r'):/[(),;{}\[\]:=]/.test(candidate.at(-1)??'')||/[(),;{}\[\]:=]/.test(text[end]??'');if(!remove)candidate+=text.slice(i,end);i=end;}else candidate+=text[i++];}return candidate;};
  const candidate=pass(pass(original,true),false);assertLockFixtureParity(original,candidate);
  const units=original.length+candidate.length;
  // Bounds count retained UTF-16 input/output units. A full cache recomputes
  // without retaining; it never skips validation or changes fixture membership.
  if(verifiedExtremumTexts.size<128&&units<=8*1024*1024-verifiedExtremumUnits){verifiedExtremumTexts.set(original,candidate);verifiedExtremumUnits+=units;}
  return candidate;
}
async function compactSyntheticExtremumFixture(f:Awaited<ReturnType<typeof fixture>>){
  const rows:{key:string;originalBytes:number;compactedBytes:number;compactedSHA256:string}[]=[];
  for(const key of f.syntheticExtremumPaddingKeys){
    const path=join(f.workspace,key),original=await readFile(path,'utf8');expect(Buffer.byteLength(original)).toBeLessThanOrEqual(1024*1024);
    const candidate=compactSyntheticExtremumText(original);await writeFile(path,candidate);
    rows.push({key,originalBytes:Buffer.byteLength(original),compactedBytes:Buffer.byteLength(candidate),compactedSHA256:sha256(Buffer.from(candidate))});
  }return rows;
}
test('synthetic horizontal punctuation compaction keeps raw syntax and every newline',()=>{
  const original='  const value: { label: string; values: number[] } = { label: "a = [ b ]", values: [ 1, 2 ] };\r\n'
    +'  const pattern = /a [=] b/g; /* keep { = } */\n'
    +'  const template = `raw { = } ${ value.label }`; // keep [ : ]\n';
  const candidate=compactSyntheticExtremumText(original);
  expect(candidate).toContain('const value:{label:string;values:number[]}={label:"a = [ b ]",values:[1,2]};');
  expect(candidate).toContain('/a [=] b/g');expect(candidate).toContain('`raw { = } ${ value.label }`');
  expect(candidate).toContain('/* keep { = } */');expect(candidate).toContain('// keep [ : ]');
  expect(candidate.match(/\r\n|\r|\n/g)).toEqual(original.match(/\r\n|\r|\n/g));
  for(const mutant of [candidate.replace('"a = [ b ]"','"a=[b]"'),candidate.replace('raw { = }','raw{}'),candidate.replace('/* keep { = } */','/* keep{} */'),candidate.replace('\r\n','\n')])expect(()=>assertLockFixtureParity(original,mutant)).toThrow();
});
test('verified synthetic compaction follows changed source bytes instead of stale text',()=>{
  const original='  const label: string = "alpha"; /* keep */\r\n  const template = `raw ${ label }`;\n';
  const first=compactSyntheticExtremumText(original);
  expect(compactSyntheticExtremumText(original)).toBe(first);
  for(const changed of [original.replace('alpha','beta'),original.replace('/* keep */','/* changed */'),original.replace('raw ${','changed ${'),original.replace('\r\n','\n')]){
    const candidate=compactSyntheticExtremumText(changed);
    assertLockFixtureParity(changed,candidate);expect(candidate).not.toBe(first);
    expect(()=>assertLockFixtureParity(original,candidate)).toThrow();
  }
  for(let attempt=0;attempt<2;attempt++)expect(()=>compactSyntheticExtremumText(original+'const =;')).toThrow();
});
test('synthetic lock compaction preserves every build-bound and non-padding member',async()=>{
  const f=await fixture(),protectedKeys=new Set(f.syntheticExtremumProtectedKeys);
  const preserved=await Promise.all(f.union.filter(key=>!f.syntheticExtremumPaddingKeys.includes(key)||protectedKeys.has(key)).map(async key=>({key,bytes:await readFile(join(f.workspace,key))})));
  const compacted=await compactSyntheticExtremumFixture(f);
  expect(compacted.some(row=>row.key.endsWith('.js')&&row.compactedBytes<row.originalBytes)).toBe(true);
  expect(compacted.some(row=>row.key.endsWith('.d.ts')&&row.compactedBytes<row.originalBytes)).toBe(true);
  for(const row of compacted)expect(protectedKeys.has(row.key)).toBe(false);
  for(const row of preserved)expect((await readFile(join(f.workspace,row.key))).equals(row.bytes)).toBe(true);
});
test('uncompacted current 2MiB lock exceeds the joint budget and parity mutants refuse',async()=>{
  const original='const value: string = "alpha"; // keep\nvoid value;\n';
  for(const mutant of [original.replace('alpha','beta'),original.replace('// keep','// changed'),original.replace('void value;','')])expect.soft(()=>assertLockFixtureParity(original,mutant)).toThrow();
  const f=await fixture(),lock=join(f.workspace,'package-lock.json'),originalLock=(await stat(lock)).size;
  let unionBytes=0;for(const key of f.union)unionBytes+=(await stat(join(f.workspace,key))).size;
  expect(unionBytes+2*1024*1024-originalLock).toBeGreaterThan(8*1024*1024);
  const text=(await readFile(lock,'utf8')).trimEnd(),fixed=Buffer.byteLength(text.slice(0,-1)+',"controlledExtension":""}\n');
  await lockExtension(f,JSON.stringify('x'.repeat(2*1024*1024-fixed)));
  expect((await stat(lock)).size).toBe(2*1024*1024);await expect(writer()(f.root,f)).rejects.toThrow('pre-read aggregate cap');
});
test.each([0, 1])('synthetic AST-identical lock cap 2MiB plus %i preserves every locked identity', {timeout: 30000}, async excess => {
  const f = await fixture(), path = join(f.workspace, 'package-lock.json');
  let beforeBytes=0;for(const key of f.union)beforeBytes+=(await stat(join(f.workspace,key))).size;
  const originalLockBytes=(await stat(path)).size,compacted=await compactSyntheticExtremumFixture(f),saved=compacted.reduce((n,row)=>n+row.originalBytes-row.compactedBytes,0);
  let afterBytes=0;for(const key of f.union)afterBytes+=(await stat(join(f.workspace,key))).size;
  expect(beforeBytes-afterBytes).toBe(saved);expect(afterBytes+2*1024*1024+excess-originalLockBytes).toBeLessThanOrEqual(8*1024*1024);
  const original = (await readFile(path, 'utf8')).trimEnd();
  const fixedBytes = Buffer.byteLength(original.slice(0, -1) + ',"controlledExtension":""}\n');
  const target = 2 * 1024 * 1024 + excess;
  await lockExtension(f, JSON.stringify('x'.repeat(target - fixedBytes)));
  const bytes = await readFile(path); expect(bytes.length).toBe(target);
  if (excess) await expect(writer()(f.root, f)).rejects.toThrow('regular bounded original');
  else {
    const receipt = await writer()(f.root, f), manifest = JSON.parse(await readFile(receipt!.path, 'utf8'));
    expect(manifest.records).toHaveLength(310);for(const changed of compacted){const record=manifest.records.find((entry:{key:string})=>entry.key===changed.key);expect(record.before.fact).toEqual({byteLength:changed.compactedBytes,sha256:changed.compactedSHA256});expect(record.after).toEqual(record.before);expect(record.copied.fact).toEqual(record.before.fact);expect((await readFile(join(receipt!.directory,record.copied.path))).equals(await readFile(join(f.workspace,changed.key)))).toBe(true);}
    for(const record of manifest.records){expect(record.after).toEqual(record.before);expect(record.copied.fact).toEqual(record.before.fact);expect((await readFile(join(receipt!.directory,record.copied.path))).equals(await readFile(record.originalPath))).toBe(true);}
    const row = manifest.records.find((entry: {key: string}) => entry.key === 'package-lock.json');
    expect(row.before.fact).toEqual({byteLength: target, sha256: sha256(bytes)});
    expect(row.after).toEqual(row.before); expect(row.copied.fact).toEqual(row.before.fact);
    expect((await readFile(join(receipt!.directory, row.copied.path))).equals(bytes)).toBe(true);
  }
});
test('foreign package-lock basename retains the ordinary 1MiB policy', () => {
  const foreign = 'apps/threadplane/package-lock.json';
  expect(helper.comparisonCiSnapshotFileCap('package-lock.json')).toBe(2 * 1024 * 1024);
  expect(helper.comparisonCiSnapshotFileCap(foreign)).toBe(1024 * 1024);
  expect(() => helper.comparisonCiSnapshotBudget(0, 1024 * 1024 + 1, helper.comparisonCiSnapshotFileCap(foreign), 'foreign lock cap')).toThrow('foreign lock cap');
  expect(() => helper.comparisonCiSnapshotFileCap('../package-lock.json')).toThrow('normalized relative key');
});
for (const excess of [0, 1]) test(`end-to-end union cap exact plus ${excess} preserves every hashed record`, {timeout:excess===0?10000:5000}, async () => {
  const f = await fixture(); await padUnion(f, 8 * 1024 * 1024 + excess);
  if (excess) await expect(writer()(f.root, f)).rejects.toThrow('pre-read aggregate cap');
  else {const receipt = await writer()(f.root, f), manifest = JSON.parse(await readFile(receipt!.path, 'utf8')); expect(manifest.originalBytes).toBe(8 * 1024 * 1024);}
});
test.each([['manifest', 23348128], ['read work', 170428224], ['write work', 31736736]])('budget predicate %s exact and plus one; not a full-writer ceiling-reach claim', (_label, maximum) => {
  const cap = Number(maximum), budget = helper.comparisonCiSnapshotBudget;
  expect(budget(cap - 1, 1, cap, 'controlled cap')).toBe(cap); expect(() => budget(cap - 1, 2, cap, 'controlled cap')).toThrow('controlled cap');
});
test.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])('budget predicate rejects malformed operand %s before arithmetic', value => {
  const budget = helper.comparisonCiSnapshotBudget;
  for (const args of [[value, 0, 1], [0, value, 1], [0, 0, value]]) expect(() => budget(args[0]!, args[1]!, args[2]!, 'malformed')).toThrow('malformed');
});
test('budget predicate rejects safe operands whose sum would overflow', () => {expect(() => helper.comparisonCiSnapshotBudget(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER, 'overflow')).toThrow('overflow');});
test('changed original build source fails its actual digest', async () => {const f = await fixture(); await writeFile(join(f.workspace, 'apps/threadplane/src/app.ts'), 'changed'); await expect(writer()(f.root, f)).rejects.toThrow('original digest');});
test('Linux compiler integrity remains bound to the actual lock row', async () => {const f = await fixture(), path = join(f.workspace, 'packages/runner/.comparison-build-evidence.json'), probe = JSON.parse(await readFile(path, 'utf8')); probe.nativeCompiler.integrity = 'sha512-incorrect'; await writeFile(path, JSON.stringify(probe) + '\n'); await expect(writer()(f.root, f)).rejects.toThrow('locked package');});
test.each(['missing', 'extra', 'relocated'] as const)('current physical metadata %s contradicts the independently reviewed membership', async change => {
  const f = await fixture(), path = join(f.workspace, 'apps/threadplane/.build-evidence.json');
  const build = JSON.parse(await readFile(path, 'utf8'));
  const originalPackage = build.packages[0];
  const relocatedPackage = {...originalPackage, resolutionPath: `node_modules/controlled-relocation/node_modules/${originalPackage.name}`};
  if (change === 'missing') build.packages.pop();
  else if (change === 'extra') build.packages.push(relocatedPackage);
  else build.packages[0] = relocatedPackage;
  expect(adapterBuildSchema.safeParse(build).success).toBe(true);
  await writeFile(path, JSON.stringify(build) + '\n');
  await expect(writer()(f.root, f)).rejects.toThrow('product metadata membership');
});
test('duplicate decoded metadata keys fail bounded parsing', async () => {const f = await fixture(); await writeFile(join(f.workspace, 'package-lock.json'), '{"packages":{},"\\u0070ackages":{}}'); await expect(writer()(f.root, f)).rejects.toThrow('duplicate key');});
test('metadata depth fails bounded parsing', async () => {const f = await fixture(); await writeFile(join(f.workspace, 'package-lock.json'), '{"packages":{},"nested":' + '['.repeat(34) + 'null' + ']'.repeat(34) + '}'); await expect(writer()(f.root, f)).rejects.toThrow('depth/AWU');});
for (const depth of [32, 33]) test(`metadata exact depth ${depth} retains valid lock packages and matching source records`, {timeout:depth===32?10000:5000}, async () => {
  const f = await fixture(); await lockExtension(f, '['.repeat(depth - 1) + 'null' + ']'.repeat(depth - 1));
  if (depth === 32) expect(await writer()(f.root, f)).not.toBeNull();
  else await expect(writer()(f.root, f)).rejects.toThrow('depth/AWU');
});
test('metadata 33-character scalar fails its token bound with valid lock packages', async () => {
  const f = await fixture(); await lockExtension(f, '1'.repeat(33));
  await expect(writer()(f.root, f)).rejects.toThrow('JSON scalar');
});
test('metadata finite overflow fails its numeric bound with valid lock packages', async () => {
  const f = await fixture(); await lockExtension(f, '1e309');
  await expect(writer()(f.root, f)).rejects.toThrow('finite scalar');
});
test('invalid UTF8 metadata fails closed', async () => {const f = await fixture(); await writeFile(join(f.workspace, 'package-lock.json'), Buffer.from([0x7b, 0xff, 0x7d])); await expect(writer()(f.root, f)).rejects.toThrow();});

test.each([...foundationSources,...foundationOutputs])('snapshot-v6 rejects missing selected foundation member %s',async key=>{const f=await fixture();await unlink(join(f.workspace,key));await expect(writer()(f.root,f)).rejects.toThrow();});
test('snapshot-v6 selected analyzer bytes retain original lifetime closure',{timeout:10000},async()=>{const f=await fixture(),key='packages/analyzer/dist/browser-frame-ordered-state.d.ts',injected=duringLastCopy(f,async()=>{const path=join(f.workspace,key),bytes=await readFile(path);bytes[0]=bytes[0]!^1;await writeFile(path,bytes);});await expect(writer()(f.root,{...f,open:injected})).rejects.toThrow('original identity changed');});
