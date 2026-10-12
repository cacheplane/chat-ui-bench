import {createHash} from 'node:crypto';
import type {z} from 'zod';
import {canonicalSerialize, createLongThreadFixture, projectProseDomText, type LongThreadFixture, type comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';
import type {ComparisonLoadingIssue} from './comparison-load.js';
import type {ComparisonReferenceInput, ComparisonReferenceLane} from './comparison-reference-closure.js';

type Schemas = ReturnType<typeof comparisonSchemasForVersionPair>;
export type FinalRuntime = z.output<Schemas['comparisonFinalRuntimeSchema']>;
export type FinalVisible = z.output<Schemas['comparisonVisibleValidationSchema']>;
type Manifest = z.output<Schemas['comparisonManifestSchema']>;
export interface ComparisonContentLane extends ComparisonReferenceLane {expectedMessages: number | null; observedMessages: number | null}
export interface ComparisonCoverageLane extends ComparisonContentLane {
  mode: FinalVisible['coverage']['mode'] | null;
  projectedProseAgreement: boolean | null; rawMountedRuntimeAgreement: boolean | null; activeResponseAgreement: boolean | null;
  samplingCohort: 'not-applicable' | 'unsupported' | 'unavailable';
}
export interface ComparisonFinalContent {fixture: ComparisonContentLane; runtime: ComparisonContentLane; coverage: ComparisonCoverageLane}
export interface FinalContentInput {
  fixture: LongThreadFixture | null; runtime: FinalRuntime | null; visible: FinalVisible | null; manifest: Manifest | null;
  row: ComparisonReferenceInput['row']; seed: number; caseOrder: readonly string[]; files: ComparisonReferenceInput['files']; absent: ComparisonReferenceInput['absent'];
}
function lane(path: string, reason: string): ComparisonContentLane {
  return {status: 'unavailable', reportedStatus: null, expectedMessages: null, observedMessages: null,
    issues: [{kind: 'membership', path, role: 'slot-json', reason}], additionalIssueCount: 0};
}
export function unavailableComparisonFinalContent(reason: string): ComparisonFinalContent {
  return {fixture: lane('fixture.json', reason), runtime: lane('final-runtime.json', reason),
    coverage: {...lane('visible-validation.json', reason), mode: null, projectedProseAgreement: null, rawMountedRuntimeAgreement: null, activeResponseAgreement: null, samplingCohort: 'unavailable'}};
}
function start(target: ComparisonContentLane): void {target.status = 'complete'; target.issues = [];}
function issue(target: ComparisonContentLane, path: string, reason: string, kind: 'membership' | 'integrity' = 'integrity'): void {
  if (target.status !== 'unavailable') target.status = 'partial';
  if (target.issues.length < 32) target.issues.push({kind, path, role: 'slot-json', reason}); else target.additionalIssueCount++;
}
export function replaceFinalContentIssue(target: ComparisonContentLane, failure: ComparisonLoadingIssue): void {
  target.status = 'partial';
  const index = target.issues.findIndex(row => row.path === failure.path);
  if (index >= 0) target.issues[index] = failure; else if (target.issues.length < 32) target.issues.push(failure); else target.additionalIssueCount++;
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
/** Existing canonical workload cardinalities, checked before selected semantic schema traversal. */
export function finalContentCardinalityIssues(fixture: unknown, runtime: unknown, visible: unknown, manifest: Manifest | null): Map<keyof ComparisonFinalContent, ComparisonLoadingIssue> {
  const issues = new Map<keyof ComparisonFinalContent, ComparisonLoadingIssue>();
  if (!manifest) return issues;
  const historyCount = manifest.workload.historyCount;
  function check(key: keyof ComparisonFinalContent, path: string, value: unknown, maximum: number, reason: string) {
    if (Array.isArray(value) && value.length > maximum && !issues.has(key)) issues.set(key, {kind: 'integrity', path, role: 'slot-json', reason});
  }
  check('fixture', 'fixture.json', object(fixture)?.['history'], historyCount, 'Fixture history cardinality exceeds canonical count before schema traversal');
  check('fixture', 'fixture.json', object(fixture)?.['events'], 202, 'Fixture event cardinality exceeds canonical count before schema traversal');
  check('runtime', 'final-runtime.json', object(object(runtime)?.['snapshot'])?.['transcript'], historyCount + 1, 'Runtime transcript cardinality exceeds canonical final count before schema traversal');
  const coverage = object(object(visible)?.['coverage']);
  if (coverage?.['mode'] === 'all-mounted') check('coverage', 'visible-validation.json', coverage['messages'], historyCount + 1, 'Mounted coverage cardinality exceeds canonical final count before schema traversal');
  if (coverage?.['mode'] === 'virtualized') {
    check('coverage', 'visible-validation.json', coverage['visibleMessages'], historyCount + 1, 'Virtualized visible cardinality exceeds canonical final count before schema traversal');
    check('coverage', 'visible-validation.json', coverage['historySamples'], historyCount, 'Virtualized history cardinality exceeds canonical count before schema traversal');
    const observed = coverage['visibleMessages'], sampled = coverage['historySamples'];
    if (Array.isArray(observed) && Array.isArray(sampled) && observed.length + sampled.length > historyCount + 1 && !issues.has('coverage')) issues.set('coverage', {kind: 'integrity', path: 'visible-validation.json', role: 'slot-json', reason: 'Virtualized combined cohort cardinality exceeds canonical final count before schema traversal'});
  }
  return issues;
}
/** Data-only final agreement. No collector validator, journal or captured module is executed. */
export function checkComparisonFinalContent(input: FinalContentInput): ComparisonFinalContent {
  const result = unavailableComparisonFinalContent('Required original final content unavailable');
  const {fixture, runtime, visible, manifest} = input;
  for (const [key, path] of [['fixture', 'fixture.json'], ['runtime', 'final-runtime.json'], ['coverage', 'visible-validation.json']] as const) if (!input.files.has(path)) {
    const absence = input.absent.find(row => row.path === path);
    result[key].issues[0] = absence ? {kind: 'absent', path, role: 'slot-json', reason: absence.reason}
      : {kind: 'membership', path, role: 'slot-json', reason: 'Required original final content is not in admitted original inventory'};
  }
  function missingFixtureDependency() {
    for (const [key, path] of [['runtime', 'final-runtime.json'], ['coverage', 'visible-validation.json']] as const) if (input.files.has(path)) result[key].issues = [{kind: 'membership', path: 'fixture.json', role: 'slot-json', reason: 'Canonical fixture agreement unavailable or contradictory'}];
  }
  if (!manifest) {result.fixture.issues[0] = {kind: 'membership', path: 'manifest.json', role: 'slot-json', reason: 'Manifest workload unavailable for canonical fixture'}; missingFixtureDependency(); return result;}
  if (!fixture) {missingFixtureDependency(); return result;}
  start(result.fixture); result.fixture.expectedMessages = manifest.workload.historyCount; result.fixture.observedMessages = fixture.history.length;
  if (manifest.fixture.file !== 'fixture.json') issue(result.fixture, 'manifest.json', 'Manifest fixture label differs from maintained original fixture path');
  if (manifest.workload.seed !== input.seed || fixture.workload.seed !== input.seed || canonicalSerialize(manifest.caseOrder) !== canonicalSerialize(input.caseOrder)
    || fixture.scenarioId !== input.row.scenarioId || canonicalSerialize(fixture.workload) !== canonicalSerialize(manifest.workload)) issue(result.fixture, 'fixture.json', 'Fixture workload or identity differs from original invocation context');
  const expected = createLongThreadFixture({historyCount: manifest.workload.historyCount, responseBytes: manifest.workload.responseBytes, journey: manifest.workload.journey, seed: manifest.workload.seed});
  if (expected.scenarioId !== input.row.scenarioId) issue(result.fixture, 'fixture.json', 'Canonical scenario differs from original invocation row');
  const serialized = canonicalSerialize(expected), fact = {byteLength: Buffer.byteLength(serialized), sha256: createHash('sha256').update(serialized).digest('hex')};
  if (canonicalSerialize(fixture) !== serialized) issue(result.fixture, 'fixture.json', 'Canonical fixture content differs from deterministic generator');
  const original = input.files.get('fixture.json');
  if (!original?.actual) issue(result.fixture, 'fixture.json', 'Owned original fixture measurement unavailable', 'membership');
  else {
    if (original.actual.byteLength !== fact.byteLength || original.actual.sha256 !== fact.sha256) issue(result.fixture, 'fixture.json', 'Fixture original serialization differs from canonical generator bytes');
    if (manifest.fixture.sha256 !== original.actual.sha256) issue(result.fixture, 'manifest.json', 'Manifest fixture digest differs from measured original');
  }
  if (!original?.seal) issue(result.fixture, 'fixture.json', 'Sealed original fixture measurement unavailable', 'membership');
  else if (original.seal.byteLength !== fact.byteLength || original.seal.sha256 !== fact.sha256) issue(result.fixture, 'fixture.json', 'Fixture sealed measurement differs from canonical generator bytes');
  if (result.fixture.status !== 'complete') {missingFixtureDependency(); return result;}
  const responseId = expected.events[0]!.messageId, responseText = expected.events.filter(event => event.type === 'text-delta').map(event => event.text).join('');
  const expectedMessages = [...expected.history, {id: responseId, role: 'assistant' as const, status: 'complete' as const, text: responseText}];
  if (runtime) {
    start(result.runtime); result.runtime.expectedMessages = expectedMessages.length; result.runtime.observedMessages = runtime.snapshot.transcript.length;
    if (runtime.snapshot.transcript.length !== expectedMessages.length) issue(result.runtime, 'final-runtime.json', 'Runtime transcript count differs from canonical final transcript');
    for (let index = 0; index < expected.history.length; index++) {
      const actual = runtime.snapshot.transcript[index], wanted = expected.history[index]!;
      if (!actual || actual.id !== wanted.id || actual.role !== wanted.role || actual.status !== 'complete' || actual.text !== wanted.text) issue(result.runtime, 'final-runtime.json', 'Runtime history differs from canonical message at index ' + index);
    }
    const response = runtime.snapshot.transcript[expected.history.length];
    if (!response || response.id !== responseId || response.role !== 'assistant' || response.status !== 'complete') issue(result.runtime, 'final-runtime.json', 'Runtime response identity or status differs from canonical response');
    if (response?.text !== responseText) issue(result.runtime, 'final-runtime.json', 'Runtime response raw text differs from canonical response');
    const state = runtime.snapshot;
    if (state.activeMessageId !== null || state.delivery !== 'complete' || state.outcome !== 'success' || state.loading || state.error !== null) issue(result.runtime, 'final-runtime.json', 'Runtime final state has not settled successfully');
  }
  if (!visible || !runtime) {
    if (visible && !runtime) result.coverage.issues = [{kind: 'membership', path: 'final-runtime.json', role: 'slot-json', reason: 'Recorded final runtime unavailable for paired coverage'}];
    return result;
  }
  start(result.coverage); result.coverage.mode = visible.coverage.mode; result.coverage.expectedMessages = expectedMessages.length;
  if (visible.timestampMs !== runtime.timestampMs) issue(result.coverage, 'visible-validation.json', 'Final runtime and coverage page timestamps differ');
  if (result.runtime.status !== 'complete') issue(result.coverage, 'final-runtime.json', 'Final runtime agreement unavailable or contradictory', 'membership');
  const active = visible.coverage.activeResponse;
  result.coverage.activeResponseAgreement = !('status' in active) && active.id === responseId && projectProseDomText(active.text) === projectProseDomText(responseText);
  if (!result.coverage.activeResponseAgreement) issue(result.coverage, 'visible-validation.json', 'Active response content unavailable or differs from canonical response', 'status' in active ? 'membership' : 'integrity');
  if (visible.coverage.mode === 'all-mounted') {
    const messages = visible.coverage.messages; result.coverage.observedMessages = messages.length; result.coverage.samplingCohort = 'not-applicable';
    if (messages.length !== expectedMessages.length || messages.some((message, index) => message.id !== expectedMessages[index]?.id)) issue(result.coverage, 'visible-validation.json', 'Mounted coverage identity or order differs from canonical final transcript');
    result.coverage.projectedProseAgreement = messages.length === expectedMessages.length && messages.every((message, index) => projectProseDomText(message.text) === projectProseDomText(expectedMessages[index]!.text));
    if (!result.coverage.projectedProseAgreement) issue(result.coverage, 'visible-validation.json', 'Mounted projected prose differs from canonical final transcript');
    result.coverage.rawMountedRuntimeAgreement = messages.length === runtime.snapshot.transcript.length && messages.every((message, index) => message.id === runtime.snapshot.transcript[index]?.id && message.text === runtime.snapshot.transcript[index]?.text);
    if (!result.coverage.rawMountedRuntimeAgreement) issue(result.coverage, 'visible-validation.json', 'Mounted raw content differs from recorded final runtime');
    if (!('status' in active) && !messages.some(message => message.id === active.id && message.text === active.text)) issue(result.coverage, 'visible-validation.json', 'Active response differs from its recorded mounted row');
  } else {
    result.coverage.observedMessages = visible.coverage.visibleMessages.length + visible.coverage.historySamples.length; result.coverage.samplingCohort = 'unsupported';
    const messages = new Map(expectedMessages.map(message => [message.id, message])), history = new Map(expected.history.map(message => [message.id, message]));
    let agreement = true;
    for (const observed of visible.coverage.visibleMessages) {
      const wanted = messages.get(observed.id);
      if (!wanted) {agreement = false; issue(result.coverage, 'visible-validation.json', 'Virtualized observed message is not in canonical final transcript');}
      else if (projectProseDomText(observed.text) !== projectProseDomText(wanted.text)) {agreement = false; issue(result.coverage, 'visible-validation.json', 'Virtualized observed prose differs from canonical message');}
    }
    for (const observed of visible.coverage.historySamples) {
      const wanted = history.get(observed.id);
      if (!wanted) {agreement = false; issue(result.coverage, 'visible-validation.json', 'Virtualized history sample is not in canonical history');}
      else if (projectProseDomText(observed.text) !== projectProseDomText(wanted.text)) {agreement = false; issue(result.coverage, 'visible-validation.json', 'Virtualized observed prose differs from canonical message');}
    }
    result.coverage.projectedProseAgreement = agreement;
    issue(result.coverage, 'visible-validation.json', 'Virtualized sampling cohort has no maintained independent selection contract', 'membership');
  }
  return result;
}
export function revokeComparisonFinalContent(result: ComparisonFinalContent): void {
  for (const target of Object.values(result)) if (target.status === 'complete') issue(target, '.', 'Original invocation ownership or membership was not closed');
}
