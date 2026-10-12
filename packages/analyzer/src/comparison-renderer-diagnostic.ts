import {comparisonSchemasForVersionPair, PRESENTATION_TRACE_CATEGORIES, comparisonPhaseMarks, COMPARISON_CAPTURE_LIMITS} from '@chat-ui-bench/contract';
import type {z} from 'zod';
import {parseComparisonRendererPresentation} from './comparison-presentation.js';
import type {ComparisonLoadingIssue, ComparisonRawRole} from './comparison-load.js';

type Schemas = ReturnType<typeof comparisonSchemasForVersionPair>;
type Parser = ReturnType<typeof parseComparisonRendererPresentation>;
type OriginStatus = 'unavailable-missing-metadata' | 'unavailable-malformed-metadata' | 'unavailable-serialization-policy-unverified';
const guards = ['owned-originals', 'trace-completion', 'trace-topology', 'canonical-phases', 'existing-parser', 'serialized-phase-origin', 'independent-oracle'] as const;
type Guard = typeof guards[number];
export interface ComparisonRendererDiagnostic {
  status: 'available' | 'unavailable'; scoringEligibility: false; notFullIntegratedDerivation: true;
  metricScope: 'target renderer visual updates'; measurementMeaning: 'conditional original trace-window parser capability';
  guards: Record<Guard, 'verified' | 'unavailable'>;
  unresolvedDomains: readonly string[];
  issues: ComparisonLoadingIssue[]; additionalIssueCount: number;
  phaseOrigin: {status: OriginStatus; marks: {mark: string; path: 'trace.json'; pageMs: number; nativeValue: number | string | boolean | null; annotationKind: string; omittedCodeUnits: number}[]};
  presentation: Parser['presentation']; diagnostics?: Parser['diagnostics'];
}
export function unavailableComparisonRendererDiagnostic(reason: string): ComparisonRendererDiagnostic {
  return {status: 'unavailable', scoringEligibility: false, notFullIntegratedDerivation: true,
    metricScope: 'target renderer visual updates', measurementMeaning: 'conditional original trace-window parser capability',
    guards: Object.fromEntries(guards.map(key => [key, 'unavailable'])) as ComparisonRendererDiagnostic['guards'],
    unresolvedDomains: ['serialized-phase-origin', 'independent-oracle', 'capture-quality', 'journey-correctness', 'source-executed-authenticity', 'live-content-and-sampling', 'mode-and-cohort', 'cleanup-eligibility', 'scoring-eligibility'],
    issues: [{kind: 'unreadable', path: 'trace.json', role: 'trace', reason}], additionalIssueCount: 0,
    phaseOrigin: {status: 'unavailable-missing-metadata', marks: []}, presentation: {status: 'unavailable', reason}};
}
export function revokeComparisonRendererDiagnostic(value: ComparisonRendererDiagnostic): void {
  value.status = 'unavailable'; value.guards['owned-originals'] = 'unavailable';
  value.presentation = {status: 'unavailable', reason: 'Original invocation ownership or membership was not closed'};
  delete value.diagnostics;
  const issue: ComparisonLoadingIssue = {kind: 'integrity', path: '.', role: 'trace', reason: value.presentation.reason};
  if (value.issues.length < 32) value.issues.push(issue); else value.additionalIssueCount++;
}
interface Input {
  schemas: Schemas; identity: z.output<Schemas['comparisonIdentitySchema']>; manifest: z.output<Schemas['comparisonManifestSchema']> | null; descriptor: z.output<Schemas['comparisonScheduledRunSchema']> | null;
  originals: Map<string, {actual: {byteLength: number; sha256: string} | null; seal: {byteLength: number; sha256: string} | null; role: ComparisonRawRole}>;
  trace: unknown; phases: unknown; evidence: unknown; auxiliary: unknown; capture: unknown; metadata: unknown;
}
const record = (value: unknown): Record<string, unknown> | null => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
export function rendererPhaseRegistryIssue(value: unknown): ComparisonLoadingIssue | null {
  const phases = record(value), instances = phases?.instances;
  if (Array.isArray(instances) && instances.length + (phases?.openPhase == null ? 0 : 1) > 4096)
    return {kind: 'admission-limit', path: 'phases.json', role: 'slot-json', limitName: 'phaseRegistry', limit: 4096, observed: instances.length + (phases?.openPhase == null ? 0 : 1), observation: 'exact', reason: 'Original phase registry exceeds source4096 admission'};
  return null;
}
export function checkComparisonRendererDiagnostic(input: Input): ComparisonRendererDiagnostic {
  const out = unavailableComparisonRendererDiagnostic('Original renderer diagnostic prerequisites unavailable'); out.issues = [];
  const fail = (path: string, reason: string, kind: Exclude<ComparisonLoadingIssue['kind'], 'admission-limit'> = 'integrity') => {
    if (out.issues.length < 32) out.issues.push({kind, path, role: path === 'trace.json' ? 'trace' : 'slot-json', reason}); else out.additionalIssueCount++;
  };
  const required = ['descriptor.json', 'manifest.json', 'trace.json', 'phases.json', 'evidence.json', 'capture-status.json', 'trace-auxiliary.json', 'capture-metadata.json'];
  for (const path of required) {
    const fact = input.originals.get(path);
    if (!fact) fail(path, 'Required original renderer member is not in admitted original inventory', 'membership');
    else if (!fact.actual || !fact.seal) fail(path, 'Owned original renderer byte witness unavailable', 'unreadable');
    else if (fact.actual.byteLength !== fact.seal.byteLength || fact.actual.sha256 !== fact.seal.sha256) fail(path, 'Original renderer bytes differ from dataset seal');
  }
  if (!input.manifest) fail('manifest.json', 'Original selected manifest unavailable');
  if (!input.descriptor) fail('descriptor.json', 'Original selected descriptor unavailable');
  if (out.issues.length) return out;
  out.guards['owned-originals'] = 'verified';
  if (input.trace === null) {fail('trace.json', 'Original trace syntax was not admitted', 'malformed'); return out;}
  const bound = rendererPhaseRegistryIssue(input.phases); if (bound) {out.issues.push(bound); return out;}
  const parsed = {
    phases: input.schemas.comparisonPhasesSchema.safeParse(input.phases), evidence: input.schemas.comparisonEvidenceSchema.safeParse(input.evidence),
    auxiliary: input.schemas.comparisonTraceAuxiliarySchema.safeParse(input.auxiliary), capture: input.schemas.comparisonCaptureStatusSchema.safeParse(input.capture),
    metadata: input.schemas.comparisonCaptureMetadataSchema.safeParse(input.metadata),
  };
  for (const [key, value] of Object.entries(parsed)) if (!value.success) fail(key === 'auxiliary' ? 'trace-auxiliary.json' : key === 'capture' ? 'capture-status.json' : key === 'metadata' ? 'capture-metadata.json' : key + '.json', 'Original renderer metadata is malformed or unavailable', 'malformed');
  if (!parsed.phases.success || !parsed.evidence.success || !parsed.auxiliary.success || !parsed.capture.success || !parsed.metadata.success) return out;
  const {phases: {data: phases}, evidence: {data: evidence}, auxiliary: {data: auxiliary}, capture: {data: capture}, metadata: {data: metadata}} = parsed;
  for (const path of required.filter(path => path !== 'evidence.json')) {
    const declared = evidence.files.find(file => file.path === path), actual = input.originals.get(path)?.actual;
    if (!declared || declared.status !== 'complete' || !actual || declared.byteLength !== actual.byteLength || declared.sha256 !== actual.sha256)
      fail('evidence.json', 'Original complete renderer member declaration disagrees: ' + path);
  }
  for (const [path, value] of [['phases.json', phases], ['evidence.json', evidence], ['trace-auxiliary.json', auxiliary], ['capture-status.json', capture], ['capture-metadata.json', metadata]] as const)
    if (Object.entries(input.identity).some(([key, expected]) => Reflect.get(value, key) !== expected)) fail(path, 'Renderer metadata identity differs from original invocation row', 'identity');
  const trace = evidence.trace;
  if (trace.status !== 'available' || !trace.complete || trace.file !== 'trace.json' || !same(trace.categories, PRESENTATION_TRACE_CATEGORIES)) fail('evidence.json', 'Complete fixed-path trace with exact source categories required');
  if (trace.status !== 'available' || trace.tracingComplete.status !== 'available' || auxiliary.status !== 'complete' || auxiliary.completion.status !== 'available') fail('trace-auxiliary.json', 'Actual supported tracing completion unavailable');
  else {
    const completed = trace.tracingComplete.value, receipt = auxiliary.completion.value;
    if (completed.dataLossOccurred !== false || receipt.dataLossOccurred !== false || !completed.stream || completed.stream !== receipt.stream || completed.traceFormat !== receipt.traceFormat || completed.streamCompression !== receipt.streamCompression || completed.traceFormat === 'proto' || completed.streamCompression === 'gzip') fail('trace-auxiliary.json', 'Tracing completion declarations disagree or loss/format unsupported');
    if (auxiliary.droppedCallbacks || auxiliary.invalidCallbacks || auxiliary.retainedCallbacks !== trace.bufferUsage.length) fail('trace-auxiliary.json', 'Original callback accounting does not close trace buffer observations');
    if (capture.traceEof.status !== 'available' || capture.traceEof.value.observedAtHostMs < receipt.observedAtHostMs) fail('capture-status.json', 'Actual EOF receipt after tracing completion required');
  }
  for (const path of required.filter(path => path !== 'evidence.json' && path !== 'capture-status.json'))
    if (!capture.payloads.some(file => file.path === path && file.status === 'complete') || capture.unavailablePaths.some(file => file.path === path)) fail('capture-status.json', 'Original complete renderer payload declaration unavailable: ' + path);
  if (capture.captureMetadata.status !== 'available' || !same(capture.captureMetadata.value, metadata) || capture.evidenceMetadata.status !== 'available') fail('capture-status.json', 'Original acquired metadata declarations disagree');
  const traceFile = evidence.files.find(file => file.path === 'trace.json'), actual = input.originals.get('trace.json')?.actual;
  if (!traceFile || traceFile.status !== 'complete' || !actual || traceFile.byteLength !== actual.byteLength || traceFile.sha256 !== actual.sha256) fail('evidence.json', 'Original complete trace payload byte declaration disagrees');
  if (out.issues.length || trace.status !== 'available') return out;
  out.guards['trace-completion'] = 'verified';
  if (trace.presentation.status !== 'available') {fail('evidence.json', 'Original before-tracing topology unavailable'); return out;}
  const topology = trace.presentation.value, frame = topology.frameTree.frameTree;
  if (!topology.isolatedBrowserProcess || !topology.singleWorkloadPage || topology.appURL !== frame.frame.url || (frame.childFrames?.length ?? 0) !== 0) {fail('evidence.json', 'Original primary page topology is unsupported'); return out;}
  if (phases.status !== 'complete' || phases.openPhase !== null) {fail('phases.json', 'Original phase registry is not closed'); return out;}
  const sequence = input.manifest!.workload.journey === 'follow' ? ['streaming-follow', 'composer-input', 'streaming-follow'] : ['streaming-follow', 'history-reading', 'return-to-response', 'streaming-follow', 'composer-input', 'streaming-follow'];
  const scored = phases.instances.filter(phase => ['streaming-follow', 'composer-input', 'history-reading', 'return-to-response'].includes(phase.phase));
  if (!same(scored.map(phase => phase.phase), sequence)) {fail('phases.json', 'Original scored phase instances differ from source journey order'); return out;}
  const inputs = scored.map(phase => ({phase: phase.phase as 'streaming-follow' | 'composer-input' | 'history-reading' | 'return-to-response', instanceId: phase.instanceId, ...comparisonPhaseMarks(phase.phase, phase.instanceId)}));
  const events = record(input.trace)?.traceEvents, expectedMarks = new Set(phases.instances.flatMap(phase => [phase.startMark, phase.endMark]));
  if (Array.isArray(events) && events.some(event => {const name = record(event)?.name; return typeof name === 'string' && name.startsWith('bench:comparison:') && !expectedMarks.has(name);})) {fail('trace.json', 'Unexpected canonical phase mark outside original registry'); return out;}
  const parser = parseComparisonRendererPresentation({trace: input.trace, target: {appURL: topology.appURL, frameId: frame.frame.id}, phases: inputs, evidencePaths: ['trace.json']});
  if (parser.presentation.status !== 'available') {fail('trace.json', parser.presentation.reason, 'malformed'); return out;}
  out.guards['trace-topology'] = 'verified'; out.guards['canonical-phases'] = 'verified'; out.guards['existing-parser'] = 'verified';
  let missing = false, malformed = false;
  for (const phase of scored) for (const [mark, pageMs] of [[phase.startMark, phase.startMs], [phase.endMark, phase.endMs]] as const) {
    const event = Array.isArray(events) ? record(events.find(value => record(value)?.name === mark)) : null;
    const native = record(record(event?.args)?.data)?.startTime;
    if (native === undefined) missing = true; else if (typeof native !== 'number' || !Number.isFinite(native) || native < 0) malformed = true;
    const annotationKind = native === undefined ? 'missing' : native === null ? 'null' : Array.isArray(native) ? 'array' : typeof native;
    const omittedCodeUnits = typeof native === 'string' ? Math.max(0, native.length - COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits) : 0;
    const nativeValue = typeof native === 'string' ? native.slice(0, COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits) : typeof native === 'number' || typeof native === 'boolean' ? native : null;
    out.phaseOrigin.marks.push({mark, path: 'trace.json', pageMs, nativeValue, annotationKind, omittedCodeUnits});
  }
  out.phaseOrigin.status = malformed ? 'unavailable-malformed-metadata' : missing ? 'unavailable-missing-metadata' : 'unavailable-serialization-policy-unverified';
  out.status = 'available'; out.presentation = parser.presentation; out.diagnostics = parser.diagnostics;
  return out;
}
