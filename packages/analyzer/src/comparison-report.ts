import {createHash} from 'node:crypto';
import {canonicalSerialize} from '@chat-ui-bench/contract';
import type {ComparisonLoadedInvocationBootstrap, ComparisonLoadingIssue} from './comparison-load.js';
import type {ComparisonReferenceLane} from './comparison-reference-closure.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const declarationMeaning = 'recorded-declaration-fingerprint' as const;
function text(value: string) {
  let end = Math.min(128, value.length);
  if (end < value.length && end > 0 && /[\uD800-\uDBFF]/.test(value[end - 1]!) && /[\uDC00-\uDFFF]/.test(value[end]!)) end--;
  return {value: value.slice(0, end), omittedCodeUnits: value.length - end, sha256: sha256(canonicalSerialize(value))};
}
function isDisplay(value: object): value is ReturnType<typeof text> {
  return Object.hasOwn(value, 'value') && Object.hasOwn(value, 'sha256') && Object.hasOwn(value, 'omittedCodeUnits');
}
function issues(values: readonly ComparisonLoadingIssue[], additional: number, maximum = 8) {
  return {values: values.slice(0, maximum).map(row => ({kind: row.kind, path: text(row.path), reason: text(row.reason),
    role: row.role, limitName: row.kind === 'admission-limit' ? text(row.limitName) : null, limit: row.kind === 'admission-limit' ? row.limit : null,
    observed: row.kind === 'admission-limit' ? row.observed : null, observation: row.kind === 'admission-limit' ? row.observation : null})), omittedCount: additional + Math.max(0, values.length - maximum)};
}
function lane(value: ComparisonReferenceLane) {return {status: value.status, reportedStatus: value.reportedStatus === null ? null : text(value.reportedStatus), issues: issues(value.issues, value.additionalIssueCount)};}
function errorCategory(value: unknown) {
  if (value === null) return {type: 'null', value: null};
  if (typeof value === 'string') return {type: 'string', value: text(value)};
  if (typeof value === 'boolean') return {type: 'boolean', value};
  if (typeof value === 'number') return {type: 'number', value: Number.isFinite(value) ? value : null, finite: Number.isFinite(value)};
  if (value instanceof Error) {
    const message = Object.getOwnPropertyDescriptor(value, 'message');
    return {type: 'error', message: message && Object.hasOwn(message, 'value') && typeof message.value === 'string' ? text(message.value) : null};
  }
  return {type: typeof value === 'object' || typeof value === 'function' ? 'opaque-object' : typeof value};
}
export const comparisonReportErrorCategory = errorCategory;
function failures(values: readonly {operation: string; path: string; error: unknown}[], additional: number) {
  return {values: values.slice(0, 32).map(row => ({operation: row.operation, path: text(row.path), error: errorCategory(row.error)})), omittedCount: additional + Math.max(0, values.length - 32)};
}
function availability(value: ComparisonLoadedInvocationBootstrap['root']['ledger']['availability']) {
  return {status: value.status, path: text(value.path), reason: value.status === 'parsed' ? null : text(value.reason)};
}

export function projectComparisonReport(loaded: ComparisonLoadedInvocationBootstrap) {
  if (loaded.runs.length > 36) throw new Error('Comparison report supports at most36 admitted rows');
  const rowsAdmitted = loaded.scheduled !== null;
  const ledger = loaded.root.ledger.value;
  const rows = rowsAdmitted ? loaded.runs.map((run, index) => {
    if (run.rendererPresentationCapabilityDiagnostic.presentation.status === 'available' && run.rendererPresentationCapabilityDiagnostic.presentation.value.phases.length > 6) throw new Error('Comparison report supports at most6 phases');
    if (run.counterCheckpoints.snapshots.length > 3) throw new Error('Comparison report supports at most3 counter snapshots');
    const manifest = run.manifest;
    const originalManifestFact = loaded.byteIntegrity.files.find(file => file.path === run.artifactDirectory + '/manifest.json')?.fact ?? null;
    const originalManifest = {originalManifestFact, originalManifestFactReason: originalManifestFact === null ? 'Selected original manifest byte fact unavailable' as const : null};
    const configuration = manifest === null ? {...originalManifest, status: 'unavailable' as const, meaning: declarationMeaning, sha256: null, display: null, reason: text('Original selected manifest unavailable')} : {
      ...originalManifest,
      status: 'available' as const, meaning: declarationMeaning, reason: null,
      display: {meaning: 'recorded declarations' as const, adapterId: text(manifest.adapter.id), profile: text(manifest.adapter.profile),
        framework: {name: text(manifest.adapter.build.framework.name), version: text(manifest.adapter.build.framework.version)},
        browser: {executable: text(manifest.browser.executable), version: text(manifest.browser.version), revision: text(manifest.browser.revision)},
        os: text(manifest.environment.os), architecture: text(manifest.environment.architecture), revision: text(manifest.git.revision), dirty: manifest.git.dirty,
        mode: manifest.mode, viewport: {...manifest.viewport}, cachePolicy: manifest.cachePolicy, fonts: manifest.fonts,
        workload: {suite: manifest.workload.suite, generator: manifest.workload.generator, seed: manifest.workload.seed,
          historyCount: manifest.workload.historyCount, historyMessageBytes: manifest.workload.historyMessageBytes, totalHistoryBytes: manifest.workload.totalHistoryBytes,
          responseBytes: manifest.workload.responseBytes, deltaCount: manifest.workload.deltaCount, deltaIntervalMs: manifest.workload.deltaIntervalMs, journey: manifest.workload.journey},
        packages: manifest.adapter.build.packages.slice(0, 16).map(pkg => ({name: text(pkg.name), version: text(pkg.version), integrity: text(pkg.integrity)})),
        omittedPackageCount: Math.max(0, manifest.adapter.build.packages.length - 16)},
      sha256: sha256(canonicalSerialize({schemaVersion: manifest.schemaVersion, suite: manifest.suite, suiteVersion: manifest.suiteVersion,
        collectorVersion: manifest.collectorVersion, analyzerVersion: manifest.analyzerVersion, caseOrder: manifest.caseOrder,
        git: manifest.git, fixture: manifest.fixture, browser: manifest.browser, environment: manifest.environment, mode: manifest.mode,
        viewport: manifest.viewport, cachePolicy: manifest.cachePolicy, adapter: manifest.adapter, workload: manifest.workload, fonts: manifest.fonts})),
    };
    return {identity: {schemaVersion: run.identity.schemaVersion, suite: text(run.identity.suite), suiteVersion: text(run.identity.suiteVersion),
      collectorVersion: text(run.identity.collectorVersion), analyzerVersion: text(run.identity.analyzerVersion),
      repetition: text(run.identity.repetition), scenarioId: text(run.identity.scenarioId), round: run.identity.round, caseIndex: run.identity.caseIndex, adapterProfile: text(run.identity.adapterProfile)},
      artifactDirectory: text(run.artifactDirectory), reportedLedgerStatus: ledger?.runs[index]?.status ?? null,
      reportedLedgerReasons: {values: ledger?.runs[index]?.reasons.slice(0, 16).map(text) ?? [], omittedCount: Math.max(0, (ledger?.runs[index]?.reasons.length ?? 0) - 16)},
      rawAvailability: {descriptor: availability(run.rawAvailability.descriptor), manifest: availability(run.rawAvailability.manifest), captureValidation: availability(run.rawAvailability.captureValidation)},
      reportedValidation: run.captureValidation === null ? null : {status: run.captureValidation.status,
        reasons: run.captureValidation.reasons.slice(0, 32).map(text), omittedReasonCount: Math.max(0, run.captureValidation.reasons.length - 32),
        checks: run.captureValidation.checks.slice(0, 32).map(check => ({name: text(check.name), passed: check.passed, reason: check.reason === null ? null : text(check.reason)})), omittedCheckCount: Math.max(0, run.captureValidation.checks.length - 32)},
      configuration, loading: issues(run.loadingIssues, run.additionalLoadingIssueCount),
      references: {inventory: lane(run.references.inventory), capture: lane(run.references.capture), acquisition: lane(run.references.acquisition)},
      provenance: {...lane(run.provenanceGraph), expectedMembers: run.provenanceGraph.expectedMembers, observedAcquisitionMembers: run.provenanceGraph.observedAcquisitionMembers, manifestAgreement: run.provenanceGraph.manifestAgreement},
      finalContent: {fixture: {...lane(run.finalContent.fixture), expectedMessages: run.finalContent.fixture.expectedMessages, observedMessages: run.finalContent.fixture.observedMessages},
        runtime: {...lane(run.finalContent.runtime), expectedMessages: run.finalContent.runtime.expectedMessages, observedMessages: run.finalContent.runtime.observedMessages},
        coverage: {...lane(run.finalContent.coverage), expectedMessages: run.finalContent.coverage.expectedMessages, observedMessages: run.finalContent.coverage.observedMessages, mode: run.finalContent.coverage.mode,
          projectedProseAgreement: run.finalContent.coverage.projectedProseAgreement, rawMountedRuntimeAgreement: run.finalContent.coverage.rawMountedRuntimeAgreement, activeResponseAgreement: run.finalContent.coverage.activeResponseAgreement, samplingCohort: run.finalContent.coverage.samplingCohort}},
      counterCheckpoints: {status: run.counterCheckpoints.status, originalFileFact: run.counterCheckpoints.originalFileFact,
        rawAvailability: availability(run.counterCheckpoints.rawAvailability), reason: run.counterCheckpoints.reason === null ? null : text(run.counterCheckpoints.reason), recordedSnapshotCount: run.counterCheckpoints.recordedSnapshotCount,
        snapshots: run.counterCheckpoints.snapshots.map(snapshot => ({lifecycle: snapshot.lifecycle,
          pageRequestBracket: snapshot.pageRequestBracket.status === 'available' ? {status: 'available' as const, value: {clockDomain: snapshot.pageRequestBracket.value.clockDomain, beforeMs: snapshot.pageRequestBracket.value.beforeMs, afterMs: snapshot.pageRequestBracket.value.afterMs}} : {status: 'unavailable' as const, reason: text(snapshot.pageRequestBracket.reason)},
          hostReceipt: {heap: snapshot.hostReceipt.heap.status === 'available' ? {status: 'available' as const, value: {clockDomain: snapshot.hostReceipt.heap.value.clockDomain, timestampMs: snapshot.hostReceipt.heap.value.timestampMs}} : {status: 'unavailable' as const, reason: text(snapshot.hostReceipt.heap.reason)}, dom: snapshot.hostReceipt.dom.status === 'available' ? {status: 'available' as const, value: {clockDomain: snapshot.hostReceipt.dom.value.clockDomain, timestampMs: snapshot.hostReceipt.dom.value.timestampMs}} : {status: 'unavailable' as const, reason: text(snapshot.hostReceipt.dom.reason)}},
          data: {heap: snapshot.data.heap.status === 'available' ? {status: 'available' as const, value: {jsHeapUsedBytes: snapshot.data.heap.value.jsHeapUsedBytes}} : {status: 'unavailable' as const, reason: text(snapshot.data.heap.reason)}, dom: snapshot.data.dom.status === 'available' ? {status: 'available' as const, value: {nodes: snapshot.data.dom.value.nodes, documents: snapshot.data.dom.value.documents, eventListeners: snapshot.data.dom.value.eventListeners}} : {status: 'unavailable' as const, reason: text(snapshot.data.dom.reason)}}})),
        meaning: 'recorded V8 isolate heap and DOM object counters; independently timed requests, not atomic, library-exclusive, visible DOM or leak evidence' as const},
      renderer: {status: run.rendererPresentationCapabilityDiagnostic.status, scoringEligibility: false as const, notFullIntegratedDerivation: true as const,
        metricScope: run.rendererPresentationCapabilityDiagnostic.metricScope, measurementMeaning: run.rendererPresentationCapabilityDiagnostic.measurementMeaning,
        guards: {...run.rendererPresentationCapabilityDiagnostic.guards}, unresolvedDomains: [...run.rendererPresentationCapabilityDiagnostic.unresolvedDomains],
        phaseOrigin: {status: run.rendererPresentationCapabilityDiagnostic.phaseOrigin.status,
          originalTraceFact: loaded.byteIntegrity.files.find(file => file.path === run.artifactDirectory + '/trace.json')?.fact ?? null,
          annotations: run.rendererPresentationCapabilityDiagnostic.phaseOrigin.marks.slice(0, 12).map((mark, ordinal) => ({ordinal,
            annotationKind: text(mark.annotationKind), pageMs: mark.pageMs, nativeNumber: typeof mark.nativeValue === 'number' && Number.isFinite(mark.nativeValue) ? mark.nativeValue : null,
            previewSha256: typeof mark.nativeValue === 'string' ? sha256(canonicalSerialize(mark.nativeValue)) : null, retainedPreviewCodeUnits: typeof mark.nativeValue === 'string' ? mark.nativeValue.length : null,
            omittedCodeUnits: mark.omittedCodeUnits})), omittedAnnotationCount: Math.max(0, run.rendererPresentationCapabilityDiagnostic.phaseOrigin.marks.length - 12)},
        presentationStatus: run.rendererPresentationCapabilityDiagnostic.presentation.status,
        presentationReason: run.rendererPresentationCapabilityDiagnostic.presentation.status === 'unavailable' ? text(run.rendererPresentationCapabilityDiagnostic.presentation.reason) : null,
        phases: run.rendererPresentationCapabilityDiagnostic.presentation.status === 'available' ? run.rendererPresentationCapabilityDiagnostic.presentation.value.phases.map(phase => ({
          phase: phase.phase, instanceId: text(phase.instanceId), startMark: text(phase.startMark), endMark: text(phase.endMark),
          startUs: phase.startUs, endUs: phase.endUs, durationUs: phase.durationUs, target: {frameId: text(phase.target.frameId), pid: phase.target.pid, tid: phase.target.tid},
          boundaryExcludedPairCount: phase.boundaryExcludedPairCount, nonPresentedPairCount: phase.nonPresentedPairCount,
          rendererVisualUpdateFps: phase.rendererVisualUpdateFps.status === 'available' ? {status: 'available' as const, value: phase.rendererVisualUpdateFps.value, unit: phase.rendererVisualUpdateFps.unit, numerator: phase.rendererVisualUpdateFps.numerator, denominatorUs: phase.rendererVisualUpdateFps.denominatorUs} : {status: 'unavailable' as const, reason: text(phase.rendererVisualUpdateFps.reason)},
          presentationIntervals: phase.presentationIntervals.status === 'available' ? {status: 'available' as const, sampleCount: phase.presentationIntervals.intervalsUs.length, median: phase.presentationIntervals.median, p95: phase.presentationIntervals.p95, max: phase.presentationIntervals.max, unit: phase.presentationIntervals.unit} : {status: 'unavailable' as const, reason: text(phase.presentationIntervals.reason)},
        })) : [],
        issues: issues(run.rendererPresentationCapabilityDiagnostic.issues, run.rendererPresentationCapabilityDiagnostic.additionalIssueCount, 2)},
    };
  }) : [];
  return {format: 'comparison-offline-diagnostic-v1' as const, scoringEligibility: false as const,
    displayStringHashEncoding: 'sha256-canonical-json-string-utf8' as const,
    meaning: 'recorded-file consistency and conditional renderer diagnostics' as const, family: loaded.family === null ? null : {...loaded.family},
    rowsAdmitted, declaredRows: ledger?.runs.length ?? null, scheduledRows: loaded.scheduled, analysisStatus: loaded.collection.status,
    collection: {status: loaded.collection.status, onDiskConsistencyOnly: true as const, reasons: loaded.collection.reasons.slice(0, 32).map(text), omittedReasonCount: Math.max(0, loaded.collection.reasons.length - 32)},
    root: {ledgerFact: loaded.root.ledger.fact, claimFact: loaded.root.claim.fact, sealFact: loaded.root.seal.fact,
      availability: {ledger: availability(loaded.root.ledger.availability), claim: availability(loaded.root.claim.availability), seal: availability(loaded.root.seal.availability)}},
    byteIntegrity: {status: loaded.byteIntegrity.status, admission: loaded.byteIntegrity.admission, observedUniqueBytes: loaded.byteIntegrity.observedUniqueBytes, seal: loaded.byteIntegrity.seal,
      observedVerifiedFileCount: loaded.byteIntegrity.files.filter(file => file.fact !== null).length, ioFailures: failures(loaded.byteIntegrity.ioFailures, loaded.byteIntegrity.additionalIoFailureCount)},
    physicalInventory: {status: loaded.physicalInventory.status, observedFileCount: loaded.physicalInventory.status === 'not-inspected' ? null : loaded.physicalInventory.files.length,
      observedDirectoryCount: loaded.physicalInventory.status === 'not-inspected' ? null : loaded.physicalInventory.directories.length, countMeaning: loaded.physicalInventory.status === 'complete' ? 'exact' : 'lower-bound',
      ioFailures: failures(loaded.physicalInventory.ioFailures, loaded.physicalInventory.additionalIoFailureCount),
      unknownEntries: {values: loaded.physicalInventory.unknownEntries.slice(0, 32).map(entry => ({path: text(entry.path), type: entry.type, byteLength: entry.byteLength, reason: entry.reason === undefined ? null : text(entry.reason)})), omittedCount: loaded.physicalInventory.additionalUnknownEntryCount + Math.max(0, loaded.physicalInventory.unknownEntries.length - 32)}},
    loading: issues(loaded.loadingIssues, loaded.additionalLoadingIssueCount, 32), rows};
}

export type ComparisonOfflineReport = ReturnType<typeof projectComparisonReport>;

export function assertComparisonReportBytes(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 24 * 1024 * 1024) throw new Error('Comparison report output exceeds fixed24MiB or invalid byte accounting');
}

/** Callable behavioral RED seam for the separate bounded publication projection. */
export function serializeComparisonReport(report: ComparisonOfflineReport): {json: string; markdown: string} {
  let fields = 0;
  const active = new Set<object>();
  function skeleton(value: unknown, depth = 0): unknown {
    if (depth > 16) throw new Error('Comparison report closed projection depth');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {if (!Number.isFinite(value)) throw new Error('Comparison report closed projection number'); return value;}
    if (typeof value === 'string') {if (value.length > 256) throw new Error('Comparison report closed projection unwrapped text'); return value;}
    if (typeof value !== 'object' || active.has(value)) throw new Error('Comparison report closed projection object/cycle');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Comparison report closed projection prototype');
    if (isDisplay(value)) {
      const display = value as ReturnType<typeof text>;
      if (typeof display.value !== 'string' || display.value.length > 128 || !Number.isSafeInteger(display.omittedCodeUnits) || display.omittedCodeUnits < 0 || typeof display.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(display.sha256)) throw new Error('Comparison report closed projection display');
      fields++; return null;
    }
    active.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > 36) throw new Error('Comparison report closed projection array');
        for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new Error('Comparison report closed projection sparse array');
        return value.map(child => skeleton(child, depth + 1));
      }
      const result: Record<string, unknown> = {}, keys = Object.keys(value);
      if (keys.length > 32) throw new Error('Comparison report closed projection fields');
      for (const key of keys) {
        const property = Object.getOwnPropertyDescriptor(value, key)!;
        if (key.length > 64 || !Object.hasOwn(property, 'value')) throw new Error('Comparison report closed projection property');
        result[key] = skeleton(property.value, depth + 1);
      }
      return result;
    } finally {active.delete(value);}
  }
  const rowStructures = report.rows.map(row => {fields = 0; const shape = skeleton(row); if (fields > 456) throw new Error('Comparison report closed projection row text fields'); return shape;});
  fields = 0;
  const structure = skeleton({...report, rows: []}) as Record<string, unknown>;
  structure['rows'] = rowStructures;
  if (fields > 336) throw new Error('Comparison report closed projection root text fields');
  if (Buffer.byteLength(JSON.stringify(structure)) > 2 * 1024 * 1024) throw new Error('Comparison report closed projection structural reserve');
  const json = JSON.stringify(report, null, 2) + '\n';
  const lines = ['# Offline comparison diagnostics', '', 'scoringEligibility: false. Recorded-file consistency only; conditional target-renderer updates/s, not monitor refresh. Integer phase and interval values use microseconds. No ranks or aggregates.', ''];
  // GFM email autolinks postprocess decoded, consolidated text nodes. Keep @
  // in its own literal code node; an entity alone would recreate the email.
  function escape(value: string) {return value.replace(/@+|[&<>\[\]()`|:.\\\r\n\u0000-\u001f\u007f]/g, char => char[0] === '@' ? '`' + char + '`' : '&#' + char.charCodeAt(0) + ';');}
  function append(value: unknown, path: string): void {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && isDisplay(value)) {
      const display = value as ReturnType<typeof text>;
      lines.push('- ' + escape(path) + ': ' + escape(display.value) + ' (omitted code units: ' + display.omittedCodeUnits + '; sha256: ' + display.sha256 + ')'); return;
    }
    if (Array.isArray(value)) {if (!value.length) lines.push('- ' + escape(path) + ': []'); else value.forEach((child, i) => append(child, path + '[' + i + ']')); return;}
    if (value !== null && typeof value === 'object') {for (const [key, child] of Object.entries(value)) append(child, path ? path + '.' + key : key); return;}
    lines.push('- ' + escape(path) + ': ' + escape(String(value)));
  }
  append(report, '');
  const markdown = lines.join('\n') + '\n';
  assertComparisonReportBytes(Buffer.byteLength(json)); assertComparisonReportBytes(Buffer.byteLength(markdown));
  return {json, markdown};
}
