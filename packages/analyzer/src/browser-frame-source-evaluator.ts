import { admitSourceRecords, Diagnostics, LIMITS, type Aggregation, type DisplayEvent, type Phase, type Receive, type Reporter, type Repetition, type SourceRecord } from './browser-frame-source-records.js';

const LABELS = Object.freeze({ runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', normalizationCapability: 'manual-fixtures-only',
  scoringEligibility: false, rankingEligibility: false, declarationAgreement: 'manual-declarations-only',
  measurementMeaning: 'observed-target-associated-chromium-operations',
  companions: Object.freeze({ completion: 'not_evaluated_here', domFreshness: 'not_evaluated_here', backlog: 'not_evaluated_here', scrollCorrectness: 'not_evaluated_here' }) } as const);
interface JoinedOperation { displayTraceId: string; attemptNs: string; reporters: Reporter[] }
interface ReducedOperation extends JoinedOperation { outcomeStatus: 'unknown' | 'coherent_success' | 'incoherent_success'; success?: { endNs: string; reporters: Reporter[]; category: 'all_only' | 'partial_only' | 'mixed_all_partial' } }
interface JoinResult { operations: JoinedOperation[]; attemptBlocked: Set<string>; presentationBlocked: Set<string> }
const numericOrder = (a: string, b: string): number => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;
const byId = <T extends { id: string }>(a: T, b: T): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
function inside(ns: string, p: Phase): boolean { return BigInt(ns) >= BigInt(p.startNs) && BigInt(ns) < BigInt(p.endNs); }
function successful(r: Reporter): boolean { return r.state === 'presented_all' || r.state === 'presented_partial'; }

/** Each stored record and relation is charged; a capacity failure yields no prefix metrics. */
class Budget {
  private used = 0;
  charge(count = 1): void { this.used += count; if (this.used > LIMITS.identities) throw new Error('index-or-output-capacity'); }
}
function index<T extends SourceRecord>(records: T[], key: (v: T) => string, budget: Budget): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of records) { budget.charge(); const k = key(value); const group = result.get(k); if (group) group.push(value); else result.set(k, [value]); }
  return result;
}
function block(set: Set<string>, phases: Phase[], time?: string): void {
  for (const p of phases) if (time === undefined || inside(time, p)) set.add(p.id);
}
function join(r: Repetition, diagnostics: Diagnostics): JoinResult {
  const records = r.records.slice().sort(byId);
  const reporters = records.filter((v): v is Reporter => v.kind === 'reporter' && v.processIncarnation === r.target.processIncarnation && v.hostId === r.target.hostId && v.lifetimeId === r.target.lifetimeId);
  const budget = new Budget();
  const surfaces = index(reporters, v => v.surfaceTraceId, budget);
  const receives = index(records.filter((v): v is Receive => v.kind === 'receive'), v => v.surfaceTraceId, budget);
  const aggregates = index(records.filter((v): v is Aggregation => v.kind === 'aggregation'), v => v.displayTraceId, budget);
  const draws = index(records.filter((v): v is DisplayEvent => v.kind === 'draw'), v => v.displayTraceId, budget);
  const swaps = index(records.filter((v): v is DisplayEvent => v.kind === 'swap'), v => v.displayTraceId, budget);
  const named = index(reporters.filter(v => Object.hasOwn(v, 'displayTraceId')), v => v.displayTraceId!, budget);
  const result: JoinResult = { operations: [], attemptBlocked: new Set(), presentationBlocked: new Set() };
  const joined = new Map<string, JoinedOperation>();
  const association = (display: string, groups: Aggregation[]): Reporter[] => {
    const ids = new Map<string, Reporter>();
    const add = (reporter: Reporter) => { if (!ids.has(reporter.id)) { budget.charge(); ids.set(reporter.id, reporter); } };
    for (const aggregate of groups) for (const surface of new Set(aggregate.surfaceTraceIds)) for (const reporter of surfaces.get(surface) ?? []) add(reporter);
    for (const reporter of named.get(display) ?? []) add(reporter);
    return [...ids.values()].sort(byId);
  };
  for (const [display, swapGroup] of [...swaps].sort(([a], [b]) => numericOrder(a, b))) {
    const aggregationGroup = aggregates.get(display) ?? [];
    const linked = association(display, aggregationGroup);
    if (!linked.length) continue;
    const times = new Set(swapGroup.map(v => v.ns));
    const attempt = times.size === 1 ? swapGroup[0]!.ns : undefined;
    const unsupported = linked.some(v => v.frameType === 'forked' || v.frameType === 'backfill');
    let valid = attempt !== undefined && aggregationGroup.length > 0 && !unsupported;
    const swap = swapGroup[0]!;
    const drawGroup = draws.get(display) ?? [];
    valid &&= drawGroup.length > 0 && new Set(drawGroup.map(v => v.ns)).size === 1;
    valid &&= swapGroup.every(v => v.processIncarnation === swap.processIncarnation && v.lifetimeId === r.target.lifetimeId);
    valid &&= drawGroup.every(v => v.processIncarnation === swap.processIncarnation && v.lifetimeId === r.target.lifetimeId && BigInt(v.ns) <= BigInt(attempt!));
    const signatures = new Set(aggregationGroup.map(v => JSON.stringify([v.startNs, v.endNs, [...new Set(v.surfaceTraceIds)].sort(numericOrder)])));
    valid &&= signatures.size === 1;
    valid &&= aggregationGroup.every(v => v.processIncarnation === swap.processIncarnation && v.lifetimeId === r.target.lifetimeId && BigInt(v.endNs) <= BigInt(attempt!));
    for (const reporter of linked) {
      const containing = aggregationGroup.filter(v => v.surfaceTraceIds.includes(reporter.surfaceTraceId));
      const receiveGroup = receives.get(reporter.surfaceTraceId) ?? [];
      const sinks = new Set(receiveGroup.map(v => `${v.frameSinkClient}/${v.frameSinkSink}`));
      valid &&= containing.length > 0 && receiveGroup.length > 0 && sinks.size === 1 && receiveGroup.every(v => !v.rejected && v.processIncarnation === swap.processIncarnation && v.lifetimeId === reporter.lifetimeId && containing.some(a => BigInt(v.ns) <= BigInt(a.endNs)));
    }
    if (!valid) {
      const code = unsupported ? linked.some(v => v.frameType === 'forked') ? 'unsupported-fork-group' : 'unsupported-backfill-relation' : attempt === undefined ? 'conflicting-attempt-time' : 'unresolved-attempt-chain';
      diagnostics.add({ code, repetition: r.id, record: swap.id });
      block(result.attemptBlocked, r.phases, attempt);
      for (const reporter of linked) if (successful(reporter) && reporter.displayTraceId === display) block(result.presentationBlocked, r.phases, reporter.endNs);
      continue;
    }
    budget.charge();
    const operation = { displayTraceId: display, attemptNs: attempt!, reporters: linked };
    result.operations.push(operation); joined.set(display, operation);
  }
  for (const reporter of reporters) {
    const op = reporter.displayTraceId === undefined ? undefined : joined.get(reporter.displayTraceId);
    if (successful(reporter) && (!op || !op.reporters.some(v => v.id === reporter.id))) {
      block(result.presentationBlocked, r.phases, reporter.endNs);
      diagnostics.add({ code: reporter.frameType === 'forked' ? 'unsupported-fork-group' : 'unresolved-successful-association', repetition: r.id, record: reporter.id });
    } else if (!successful(reporter) && !op) {
      diagnostics.add({ code: reporter.frameType === 'backfill' ? 'backfill-skipped-opportunity' : 'opportunity-association', repetition: r.id, record: reporter.id });
    }
  }
  for (const [surface, group] of receives) if (surfaces.has(surface) && ![...aggregates.values()].some(as => as.some(a => a.surfaceTraceIds.includes(surface)))) {
    diagnostics.add({ code: 'receive-only-not-demonstrated-accepted', repetition: r.id, record: group[0]!.id });
  }
  return result;
}
function mappingAgrees(r: Repetition, p: Phase, operations: JoinedOperation[]): boolean {
  const rootMappings = r.records.filter(v => v.kind === 'mapping' && v.rootFrame === r.target.rootFrame && v.pageSession === r.target.pageSession && BigInt(v.ns) < BigInt(p.endNs));
  const exact = rootMappings.filter(v => v.kind === 'mapping' && v.processIncarnation === r.target.processIncarnation && v.hostId === r.target.hostId && v.lifetimeId === r.target.lifetimeId);
  let requiredStart = BigInt(p.startNs);
  for (const op of operations) if (inside(op.attemptNs, p) || op.reporters.some(v => successful(v) && v.displayTraceId === op.displayTraceId && inside(v.endNs, p))) {
    for (const reporter of op.reporters) if (BigInt(reporter.startNs) < requiredStart) requiredStart = BigInt(reporter.startNs);
    if (BigInt(op.attemptNs) < requiredStart) requiredStart = BigInt(op.attemptNs);
  }
  return rootMappings.length === exact.length && exact.some(v => v.kind === 'mapping' && BigInt(v.ns) < requiredStart)
    && !r.records.some(v => v.kind === 'transition' && v.rootFrame === r.target.rootFrame && BigInt(v.ns) < BigInt(p.endNs));
}
function reduceOperations(r: Repetition, joined: JoinResult, diagnostics: Diagnostics): ReducedOperation[] {
  const usedSurfaces = new Set<string>();
  return joined.operations.map((op): ReducedOperation => {
    for (const surface of new Set(op.reporters.map(v => v.surfaceTraceId))) {
      if (usedSurfaces.has(surface)) diagnostics.add({ code: 'reused-target-surface-membership', repetition: r.id, record: op.displayTraceId });
      usedSurfaces.add(surface);
    }
    const reporters = op.reporters.filter(v => successful(v) && v.displayTraceId === op.displayTraceId);
    if (!reporters.length) return { ...op, outcomeStatus: 'unknown' };
    const ends = new Set(reporters.map(v => v.endNs));
    if (ends.size !== 1 || reporters.some(v => BigInt(v.endNs) < BigInt(op.attemptNs))) {
      for (const reporter of reporters) block(joined.presentationBlocked, r.phases, reporter.endNs);
      diagnostics.add({ code: ends.size !== 1 ? 'conflicting-success-end' : 'success-before-attempt', repetition: r.id, record: op.displayTraceId });
      return { ...op, outcomeStatus: 'incoherent_success' };
    }
    const category = reporters.every(v => v.state === 'presented_all') ? 'all_only' : reporters.every(v => v.state === 'presented_partial') ? 'partial_only' : 'mixed_all_partial';
    return { ...op, outcomeStatus: 'coherent_success', success: { endNs: reporters[0]!.endNs, reporters, category } };
  });
}
function intervals(times: string[]) {
  if (times.length < 2) return { status: 'unavailable' as const, reason: 'fewer-than-two-observed-operations' };
  const sorted = times.slice().sort(numericOrder);
  return { status: 'observed_only' as const, adjacentNs: sorted.slice(1).map((time, i) => (BigInt(time) - BigInt(sorted[i]!)).toString()) };
}
function rate(count: number, p: Phase, unit: 'attempts/s' | 'reported-presentations/s') {
  return { scaledNumerator: (BigInt(count) * 1000000000n).toString(), denominatorNs: (BigInt(p.endNs) - BigInt(p.startNs)).toString(), unit };
}
const CONTENT_KEYS = ['hasMissingContent', 'checkerboardedNeedsRaster', 'checkerboardedNeedsRecord'] as const;
function contentCounts(reporters: Reporter[]) {
  const content = { hasMissingContent: { true: 0, false: 0, absent: 0 }, checkerboardedNeedsRaster: { true: 0, false: 0, absent: 0 }, checkerboardedNeedsRecord: { true: 0, false: 0, absent: 0 } };
  for (const reporter of reporters) for (const key of CONTENT_KEYS) content[key][!Object.hasOwn(reporter, key) ? 'absent' : reporter[key] ? 'true' : 'false']++;
  return content;
}
function metrics(r: Repetition, p: Phase, joined: JoinResult, operations: ReducedOperation[], agrees: boolean) {
  const attempts = operations.filter(v => inside(v.attemptNs, p));
  const presentations = operations.filter(v => v.success && inside(v.success.endNs, p));
  const associationCount = presentations.reduce((count, v) => count + v.success!.reporters.length, 0);
  if (associationCount > LIMITS.identities || attempts.length > LIMITS.identities || presentations.length > LIMITS.identities) throw new Error('phase-output-capacity');
  const associations = presentations.flatMap(v => v.success!.reporters);
  const categories = { all_only: 0, partial_only: 0, mixed_all_partial: 0 };
  for (const op of presentations) categories[op.success!.category]++;
  const hasEarlyReporter = (v: ReducedOperation) => v.reporters.some(reporter => BigInt(reporter.startNs) < BigInt(p.startNs));
  const unavailable = { status: 'unavailable' as const, reason: 'relevant-relation-or-declaration-unavailable' };
  return {
    id: p.id, startNs: p.startNs, endNs: p.endNs, declarationAgreement: agrees,
    opportunityAssociationCount: r.records.filter(v => v.kind === 'reporter' && v.processIncarnation === r.target.processIncarnation && v.hostId === r.target.hostId && v.lifetimeId === r.target.lifetimeId && !successful(v) && inside(v.endNs, p)).length,
    attempts: !agrees || joined.attemptBlocked.has(p.id) ? { ...unavailable } : {
      status: 'observed_only' as const, count: attempts.length, zeroMeaning: 'zero-observed-associations-in-manual-fixture' as const,
      rate: rate(attempts.length, p, 'attempts/s'), intervals: intervals(attempts.map(v => v.attemptNs)),
      attemptUnknownOutcome: attempts.filter(v => v.outcomeStatus === 'unknown').length,
      attemptSuccessCarryOut: attempts.filter(v => v.success && BigInt(v.success.endNs) >= BigInt(p.endNs)).length,
      reporterStartCarryIn: attempts.filter(hasEarlyReporter).length,
    },
    presentations: !agrees || joined.presentationBlocked.has(p.id) ? { ...unavailable } : {
      status: 'observed_only' as const, count: presentations.length, zeroMeaning: 'zero-observed-associations-in-manual-fixture' as const,
      outcomeCoverage: 'known_successful_subset' as const, rate: rate(presentations.length, p, 'reported-presentations/s'),
      intervals: intervals(presentations.map(v => v.success!.endNs)), categories, successfulAssociationCount: associations.length,
      content: contentCounts(associations), presentationAttemptCarryIn: presentations.filter(v => BigInt(v.attemptNs) < BigInt(p.startNs)).length,
      reporterStartCarryIn: presentations.filter(hasEarlyReporter).length,
    },
  };
}
export function evaluateBrowserFrameSourceRecords(input: unknown, policy: unknown) {
  const admitted = admitSourceRecords(input, policy);
  if (admitted.status === 'unavailable') return admitted;
  const diagnostics = new Diagnostics();
  try {
    const repetitions = admitted.envelope.repetitions.slice().sort(byId).map(r => {
      const joined = join(r, diagnostics);
      const operations = reduceOperations(r, joined, diagnostics);
      const phases = r.phases.slice().sort(byId).map(p => {
        const agrees = mappingAgrees(r, p, joined.operations);
        if (!agrees) diagnostics.add({ code: 'target-mapping-or-lifecycle-disagreement', repetition: r.id, phase: p.id });
        return metrics(r, p, joined, operations, agrees);
      });
      return { id: r.id, evaluatedRecordCount: r.records.length, evaluatedPhaseCount: phases.length,
        operations: operations.map(v => ({ displayTraceId: v.displayTraceId, attemptNs: v.attemptNs, outcomeStatus: v.outcomeStatus, reporterIds: v.reporters.map(v => v.id), ...(v.success ? { reportedSuccessEndNs: v.success.endNs } : {}) })), phases };
    });
    return { status: 'observed_only' as const, ...LABELS, companions: { ...LABELS.companions }, evaluatedRepetitionCount: repetitions.length, repetitions, diagnostics: diagnostics.result() };
  } catch (error) {
    diagnostics.add({ code: error instanceof Error ? error.message : 'evaluation-capacity' });
    return { status: 'unavailable' as const, diagnostics: diagnostics.result() };
  }
}
