import {afterEach, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {comparisonSchemasForVersionPair, comparisonPhaseMarks, createLongThreadMatrix, longThreadCaseOrder, comparisonRendererPresentationSchema, PRESENTATION_CAPABILITY, PRESENTATION_CONTRACT_VERSION} from '@chat-ui-bench/contract';
import {loadComparisonInvocation, loadComparisonJson} from './comparison-load.js';
import {projectComparisonReport, serializeComparisonReport, assertComparisonReportBytes} from './comparison-report.js';

const owned: string[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const path of owned.splice(0)) await rm(path, {recursive: true, force: true});});

async function originalFixture(rounds = 1, version: '2.0.0' | '2.1.0' = '2.1.0') {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'comparison-report-original-')); owned.push(root);
  const schemas = comparisonSchemasForVersionPair(version === '2.1.0' ? {collectorVersion: version, analyzerVersion: version} : {collectorVersion: version, analyzerVersion: version}), versions = schemas.versions;
  const configuration = {schemaVersion: 2, suite: 'long-thread-prose-v1', seed: 1, rounds, adapterProfiles: ['threadplane-langgraph-custom-transport'], caseOrder: longThreadCaseOrder(1), mode: 'headless', deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}};
  const runs = Array.from({length: rounds}, (_, round) => configuration.caseOrder.map((scenarioId, caseIndex) => ({round: round + 1, caseIndex, scenarioId, adapterProfile: configuration.adapterProfiles[0], repetition: `${round + 1}-${caseIndex}`, artifactDirectory: `runs/round-${round + 1}/case-${caseIndex}/profile-0`, status: 'failed', reasons: ['independent fixture: never started']}))).flat();
  const ledger = schemas.comparisonCaptureInvocationSchema.parse({...versions, createdAt: '2026-10-10T00:00:00.000Z', purpose: 'conformance', status: 'failed', configuration, runs});
  const json = async (path: string, value: unknown) => {await mkdir(join(root, path, '..'), {recursive: true}); await writeFile(join(root, path), JSON.stringify(value));};
  await json('invocation.json', ledger);
  const first = ledger.runs[0]!;
  const manifest = schemas.comparisonManifestSchema.parse({...versions, repetition: first.repetition, scenarioId: first.scenarioId, round: first.round, caseIndex: first.caseIndex, caseOrder: configuration.caseOrder, workload: createLongThreadMatrix(1)[0]!.workload,
    git: {revision: 'independent-fixture', dirty: false}, fixture: {file: 'fixture.json', sha256: '1'.repeat(64)},
    browser: {executable: 'fixture-browser', version: '156.0.0.0', revision: 'fixture-revision', flags: ['--user-data-dir=/original/full/path']},
    environment: {os: 'fixture-os', architecture: 'fixture-architecture', cpu: {status: 'unavailable', reason: 'not executed'}, gpu: {status: 'unavailable', reason: 'not executed'}}, mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1}, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
    adapter: {id: 'fixture-adapter', profile: first.adapterProfile, capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, configuration: {markdown: 'default', pinThresholdCssPx: null, telemetry: 'disabled'}, build: {packages: [{name: 'fixture-library', version: '1.2.3', integrity: 'sha512-YQ=='}], framework: {name: 'fixture-framework', version: '1.2.3'}, production: true, sourceHashes: {'src/main.ts': '2'.repeat(64)}, copiedSourceHashes: {}, assetHashes: {'main.js': '3'.repeat(64)}, settings: {optimization: true, sourceMaps: true}}}});
  await json(first.artifactDirectory + '/manifest.json', manifest);
  const loaded = await loadComparisonInvocation(root);
  // Pure projection input: strict independently parsed manifest. This fixture has
  // no seal and does not assert that the loader admitted this manifest.
  loaded.runs[0]!.manifest = manifest;
  return {root, ledger, manifest, json, loaded};
}

it.each([12, 24, 36])('retains all %i original admitted failed rows without score promotion', async count => {
  const f = await originalFixture(count / 12), before = JSON.stringify(f.loaded);
  const report = projectComparisonReport(f.loaded);
  expect(report).toMatchObject({format: 'comparison-offline-diagnostic-v1', scoringEligibility: false, rowsAdmitted: true, analysisStatus: 'partial'});
  expect(report.rows).toHaveLength(count);
  expect(report.rows.map(row => row.reportedLedgerStatus)).toEqual(Array(count).fill('failed'));
  expect(report.rows.map(row => row.identity.scenarioId.value)).toEqual(f.ledger.runs.map(row => row.scenarioId));
  expect(JSON.stringify(f.loaded)).toBe(before);
});

it('unsupported root has no manufactured child analysis', async () => {
  const f = await originalFixture(); f.ledger.configuration.adapterProfiles[0] = 'copilot-unregistered';
  for (const row of f.ledger.runs) row.adapterProfile = 'copilot-unregistered';
  await f.json('invocation.json', f.ledger);
  const report = projectComparisonReport(await loadComparisonInvocation(f.root));
  expect(report).toMatchObject({rowsAdmitted: false, declaredRows: 12, rows: [], analysisStatus: 'unavailable', scoringEligibility: false});
});

it.each(['2.0.0', '2.1.0'] as const)('preserves mixed %s reported verdicts and exact ledger reason omissions', async version => {
  const f = await originalFixture(1, version);
  f.ledger.runs[0]!.status = 'valid'; f.ledger.runs[0]!.reasons = [];
  f.ledger.runs[1]!.status = 'invalid'; f.ledger.runs[1]!.reasons = Array.from({length: 32}, (_, i) => 'reported invalid reason ' + i);
  await f.json('invocation.json', f.ledger);
  const report = projectComparisonReport(await loadComparisonInvocation(f.root));
  expect(report.rows.map(row => row.reportedLedgerStatus)).toEqual(['valid', 'invalid', ...Array(10).fill('failed')]);
  expect(report.rows[1]!.reportedLedgerReasons.values).toHaveLength(16);
  expect(report.rows[1]!.reportedLedgerReasons.omittedCount).toBe(16);
  expect(report.scoringEligibility).toBe(false);
});

it('fingerprint preserves full original browser flags and hidden declaration tails', async () => {
  const f = await originalFixture(), first = projectComparisonReport(f.loaded).rows[0]!;
  expect(first.configuration).toMatchObject({status: 'available', meaning: 'recorded-declaration-fingerprint', sha256: expect.stringMatching(/^[a-f0-9]{64}$/)});
  f.manifest.browser.flags[0] = '--user-data-dir=/another/full/path'; await f.json(f.ledger.runs[0]!.artifactDirectory + '/manifest.json', f.manifest);
  const reloaded = await loadComparisonInvocation(f.root); reloaded.runs[0]!.manifest = f.manifest;
  const second = projectComparisonReport(reloaded).rows[0]!;
  expect(second.configuration.sha256).not.toBe(first.configuration.sha256);
});

it('binds independently checked original manifest spellings separately from canonical declarations', async () => {
  const f = await originalFixture(), path = f.ledger.runs[0]!.artifactDirectory + '/manifest.json';
  async function checkedSpelling(bytes: string) {
    await writeFile(join(f.root, path), bytes);
    const expected = {byteLength: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex')};
    const original = await loadComparisonJson(f.root, {path, role: 'slot-json', expected});
    expect(original.status).toBe('admitted-json');
    if (original.status !== 'admitted-json') throw new Error('Original manifest syntax not admitted');
    // Component composition only: a real checked-byte fact and independently
    // schema-parsed declaration, without claiming full invocation/seal authority.
    f.loaded.runs[0]!.manifest = comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'}).comparisonManifestSchema.parse(original.value);
    f.loaded.byteIntegrity.files = [{path, fact: original.fact}];
    return projectComparisonReport(f.loaded).rows[0]!.configuration;
  }
  const first = await checkedSpelling(JSON.stringify(f.manifest));
  const second = await checkedSpelling(JSON.stringify(f.manifest, null, 2).replace('"width": 1280', '"width": 1.28e3'));
  expect(second.sha256).toBe(first.sha256);
  expect(first).toMatchObject({originalManifestFact: {sha256: expect.stringMatching(/^[a-f0-9]{64}$/)}, originalManifestFactReason: null});
  expect(second).toMatchObject({originalManifestFact: {sha256: expect.stringMatching(/^[a-f0-9]{64}$/)}, originalManifestFactReason: null});
  expect(second.originalManifestFact!.sha256).not.toBe(first.originalManifestFact!.sha256);
  f.loaded.runs[0]!.manifest = null;
  expect(projectComparisonReport(f.loaded).rows[0]!.configuration).toMatchObject({status: 'unavailable', originalManifestFact: f.loaded.byteIntegrity.files[0]!.fact, originalManifestFactReason: null});
});

it('does not bind another row manifest fact when the selected original fact is absent', async () => {
  const f = await originalFixture();
  f.loaded.byteIntegrity.files = [{path: f.ledger.runs[1]!.artifactDirectory + '/manifest.json', fact: {byteLength: 10, sha256: '1'.repeat(64)}}];
  expect(projectComparisonReport(f.loaded).rows[0]!.configuration).toMatchObject({originalManifestFact: null, originalManifestFactReason: 'Selected original manifest byte fact unavailable'});
  f.loaded.runs[0]!.manifest = null;
  expect(projectComparisonReport(f.loaded).rows[0]!.configuration).toMatchObject({status: 'unavailable', originalManifestFact: null, originalManifestFactReason: 'Selected original manifest byte fact unavailable'});
});

it('repeated input projects identical bytes and no raw transcript or trace graph', async () => {
  const f = await originalFixture(), first = projectComparisonReport(f.loaded), second = projectComparisonReport(f.loaded);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(JSON.stringify(first)).not.toMatch(/traceEvents|timestampsUs|intervalsUs|transcript|generatedAt|originalOperationStack/);
  expect(first.rows[0]!.renderer).toMatchObject({scoringEligibility: false, notFullIntegratedDerivation: true, status: 'unavailable'});
});

it('bounds Unicode display without splitting a scalar and fingerprints omitted tails', async () => {
  const f = await originalFixture(); f.manifest.browser.executable = 'x'.repeat(127) + '🙂tail';
  const first = projectComparisonReport(f.loaded).rows[0]!;
  expect(first.configuration.display?.browser.executable).toMatchObject({value: 'x'.repeat(127), omittedCodeUnits: 6});
  f.manifest.browser.executable += '-different';
  expect(projectComparisonReport(f.loaded).rows[0]!.configuration.sha256).not.toBe(first.configuration.sha256);
});

it('display digests distinguish original lone surrogate code units despite UTF8 replacement', async () => {
  const f = await originalFixture(); f.manifest.browser.executable = 'x'.repeat(128) + '\uD800';
  const first = projectComparisonReport(f.loaded).rows[0]!.configuration.display!.browser.executable;
  f.manifest.browser.executable = 'x'.repeat(128) + '\uD801';
  const second = projectComparisonReport(f.loaded).rows[0]!.configuration.display!.browser.executable;
  expect(second.value).toBe(first.value); expect(second.sha256).not.toBe(first.sha256);
});

it('reports exact issue omissions and never treats unavailable counters as zero', async () => {
  const f = await originalFixture(); f.loaded.runs[0]!.loadingIssues = Array.from({length: 32}, (_, i) => ({kind: 'unreadable', path: 'trace.json', role: 'trace', reason: 'original issue ' + i})); f.loaded.runs[0]!.additionalLoadingIssueCount = 7;
  const report = projectComparisonReport(f.loaded);
  expect(report.rows[0]!.loading).toMatchObject({omittedCount: 31, values: expect.any(Array)});
  expect(report.rows[0]!.loading.values).toHaveLength(8);
  expect(report.rows[0]!.finalContent.runtime.observedMessages).toBeNull();
});

it.each([3, 6])('preserves %i conditional scalar phases without interval arrays or score promotion', async count => {
  const f = await originalFixture(), diagnostic = f.loaded.runs[0]!.rendererPresentationCapabilityDiagnostic;
  const phases = Array.from({length: count}, (_, i) => ({phase: 'streaming-follow', instanceId: String(i), ...comparisonPhaseMarks('streaming-follow', String(i)), startUs: i * 100, endUs: (i + 1) * 100, durationUs: 100, target: {frameId: 'frame', pid: 10, tid: 11}, boundaryExcludedPairCount: 1, nonPresentedPairCount: 2,
    rendererVisualUpdateFps: {status: 'available', value: 20000, unit: 'updates/s', numerator: 2, denominatorUs: 100, evidence: ['trace.json']},
    presentationIntervals: {status: 'available', timestampsUs: [i * 100 + 10, i * 100 + 30], intervalsUs: [20], median: 20, p95: 20, max: 20, unit: 'us', evidence: ['trace.json']}}));
  diagnostic.status = 'available'; diagnostic.presentation = comparisonRendererPresentationSchema.parse({status: 'available', capability: PRESENTATION_CAPABILITY, contractVersion: PRESENTATION_CONTRACT_VERSION, value: {scope: 'target renderer visual updates', phases}});
  const rendered = projectComparisonReport(f.loaded).rows[0]!.renderer;
  expect(rendered.phases).toHaveLength(count);
  expect(rendered.phases[0]).toMatchObject({durationUs: 100, rendererVisualUpdateFps: {value: 20000, numerator: 2, denominatorUs: 100}, presentationIntervals: {sampleCount: 1, median: 20, p95: 20, max: 20, unit: 'us'}});
  expect(rendered.scoringEligibility).toBe(false); expect(JSON.stringify(rendered)).not.toMatch(/timestampsUs|intervalsUs/);
});

it('annotation digest covers only retained preview and explicitly retains omitted units', async () => {
  const f = await originalFixture(), diagnostic = f.loaded.runs[0]!.rendererPresentationCapabilityDiagnostic;
  diagnostic.phaseOrigin.marks = [{mark: 'original-start', path: 'trace.json', pageMs: 1, nativeValue: 'retained-preview', annotationKind: 'string', omittedCodeUnits: 200}];
  const origin = projectComparisonReport(f.loaded).rows[0]!.renderer.phaseOrigin;
  expect(origin.annotations[0]).toMatchObject({annotationKind: {value: 'string'}, omittedCodeUnits: 200, previewSha256: expect.stringMatching(/^[a-f0-9]{64}$/)});
  expect(JSON.stringify(origin)).not.toContain('retained-preview');
  expect(origin.originalTraceFact).toBeNull();
  expect(() => serializeComparisonReport(projectComparisonReport(f.loaded))).not.toThrow();
});

it('Markdown escapes original HTML, pipes, line breaks and captured link syntax', async () => {
  const f = await originalFixture(); f.loaded.runs[0]!.loadingIssues = [{kind: 'unreadable', path: 'trace.json', role: 'trace', reason: '<script>bad()</script>|[click](https://captured.invalid)\n`code`'}];
  const rendered = serializeComparisonReport(projectComparisonReport(f.loaded));
  expect(rendered.markdown).not.toContain('<script>'); expect(rendered.markdown).not.toContain('[click]'); expect(rendered.markdown).not.toContain('`code`');
  expect(rendered.markdown).not.toContain('https://captured.invalid');
  expect(rendered.markdown).toContain('scoringEligibility: false');
  expect(rendered.markdown).toContain('updates/s'); expect(rendered.markdown).toContain('microseconds');
});

it('renders captured www and email declarations as literal Markdown while preserving JSON text', async () => {
  const f = await originalFixture(), reason = 'www.example.com person@example.com mailto:person@example.com';
  f.loaded.runs[0]!.loadingIssues = [{kind: 'unreadable', path: 'trace.json', role: 'trace', reason}];
  const rendered = serializeComparisonReport(projectComparisonReport(f.loaded));
  expect(JSON.parse(rendered.json).rows[0].loading.values[0].reason.value).toBe(reason);
  expect(rendered.markdown).not.toContain('www.example.com');
  expect(rendered.markdown).not.toContain('person@example.com');
  expect(rendered.markdown).toContain('www&#46;example&#46;com');
  // GFM consolidates decoded text nodes before email autolinking: numeric
  // entities alone are insufficient. A literal code span splits that node.
  expect(rendered.markdown).toContain('person`@`example&#46;com');
});

it.each(['person@@example.com', 'person@@@example.com', '@@, @@@. (@@) [@@@]', '`@@` @@`@@@`'])('preserves contiguous at-sign text %s as one literal node per run', async reason => {
  const f = await originalFixture();
  f.loaded.runs[0]!.loadingIssues = [{kind: 'unreadable', path: 'trace.json', role: 'trace', reason}];
  const rendered = serializeComparisonReport(projectComparisonReport(f.loaded));
  expect(JSON.parse(rendered.json).rows[0].loading.values[0].reason.value).toBe(reason);
  expect(rendered.markdown).not.toContain('`@``@`');
  expect(rendered.markdown).toContain(reason.includes('@@@') ? '`@@@`' : '`@@`');
});

it('rejects oversized unwrapped report text before JSON encoding allocation', async () => {
  const f = await originalFixture(), report = projectComparisonReport(f.loaded);
  // A malformed internal projection must fail before full serialization, not
  // allocate the enormous diagnostic and then discover the byte limit.
  Object.assign(report, {meaning: 'x'.repeat(100000)});
  const serialization = vi.spyOn(JSON, 'stringify');
  expect(() => serializeComparisonReport(report)).toThrow(/closed projection/);
  expect(serialization).not.toHaveBeenCalled();
});

it('closed36-row issue-heavy projection remains below derived output ceilings', async () => {
  const f = await originalFixture(3), large = '🙂'.repeat(2048);
  const values = Array.from({length: 32}, () => ({kind: 'unreadable' as const, path: 'trace.json', role: 'trace' as const, reason: large}));
  for (const row of f.loaded.runs) {
    row.loadingIssues = values;
    for (const lane of [row.references.inventory, row.references.capture, row.references.acquisition, row.provenanceGraph, row.finalContent.fixture, row.finalContent.runtime, row.finalContent.coverage, row.rendererPresentationCapabilityDiagnostic]) lane.issues = values;
  }
  const serialized = serializeComparisonReport(projectComparisonReport(f.loaded));
  expect(Buffer.byteLength(serialized.json)).toBeLessThanOrEqual(19251200);
  expect(Buffer.byteLength(serialized.markdown)).toBeLessThanOrEqual(23539712);
});

it('fixed output predicate admits exact24MiB and rejects +1 and invalid arithmetic', () => {
  expect(() => assertComparisonReportBytes(24 * 1024 * 1024)).not.toThrow();
  for (const bytes of [24 * 1024 * 1024 + 1, -1, NaN, Infinity, 0.5]) expect(() => assertComparisonReportBytes(bytes)).toThrow(/report output/);
});

it.each([undefined, null, false, 0, ''])('retains original falsy IO category %j without coercion', async error => {
  const f = await originalFixture(); f.loaded.byteIntegrity.ioFailures = [{operation: 'close', path: 'trace.json', error}];
  const report = projectComparisonReport(f.loaded);
  expect(report.byteIntegrity.ioFailures.values[0]?.error).toMatchObject({type: error === null ? 'null' : typeof error});
  expect(serializeComparisonReport(report).json).not.toContain('stack');
});

it('opaque error objects are not coerced and root issues retain original32 with exact omissions', async () => {
  const f = await originalFixture(); let coercions = 0;
  f.loaded.byteIntegrity.ioFailures = [{operation: 'read', path: 'trace.json', error: {toString() {coercions++; throw Error('Never coerce');}}}];
  f.loaded.loadingIssues = Array.from({length: 32}, () => ({kind: 'unreadable', path: 'trace.json', role: 'trace', reason: 'root issue'})); f.loaded.additionalLoadingIssueCount = 2;
  const report = projectComparisonReport(f.loaded);
  expect(report.loading.values).toHaveLength(32); expect(report.loading.omittedCount).toBe(2);
  expect(report.byteIntegrity.ioFailures.values[0]?.error.type).toBe('opaque-object'); expect(coercions).toBe(0);
});

it('rejects more than6 phase results before copying unbounded output', async () => {
  const f = await originalFixture(), diagnostic = f.loaded.runs[0]!.rendererPresentationCapabilityDiagnostic;
  const phases = Array.from({length: 7}, (_, i) => ({phase: 'streaming-follow', instanceId: String(i), ...comparisonPhaseMarks('streaming-follow', String(i)), startUs: i * 100, endUs: (i + 1) * 100, durationUs: 100, target: {frameId: 'frame', pid: 10, tid: 11}, boundaryExcludedPairCount: 0, nonPresentedPairCount: 0, rendererVisualUpdateFps: {status: 'unavailable', reason: 'No feedback'}, presentationIntervals: {status: 'unavailable', reason: 'No intervals'}}));
  diagnostic.presentation = comparisonRendererPresentationSchema.parse({status: 'available', capability: PRESENTATION_CAPABILITY, contractVersion: PRESENTATION_CONTRACT_VERSION, value: {scope: 'target renderer visual updates', phases}});
  expect(() => projectComparisonReport(f.loaded)).toThrow(/at most6/);
});
