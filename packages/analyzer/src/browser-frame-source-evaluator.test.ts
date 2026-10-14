import { describe, expect, it } from 'vitest';
import { admitSourceRecords, decimal, Diagnostics, POLICY } from './browser-frame-source-records.js';
import { fixture, operation, record, additionalReporter } from './browser-frame-source-evaluator.test-helper.js';
import { evaluateBrowserFrameSourceRecords as evaluate } from './browser-frame-source-evaluator.js';

describe('bounded manual source admission', () => {
  it('admits explicit manual envelope and rejects missing policy or pins', () => {
    expect(admitSourceRecords(fixture(), POLICY).status).toBe('admitted');
    expect(admitSourceRecords(fixture(), undefined).status).toBe('unavailable');
    const f = fixture(); f.chromiumPin = 'wrong'; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
  });
  it('retains adjacent unsafe integers and exact ns differences', () => {
    expect(decimal('9007199254740993', 'int64')).toBe(9007199254740993n);
    expect(decimal('9007199254740993', 'ns')! - decimal('9007199254740992', 'ns')!).toBe(1n);
  });
  it.each(['-0', '+1', '01', ' 1', '1e3', '0x1', 1, null, undefined, '9'.repeat(100000)])('rejects noncanonical or oversized decimal %s', value => {
    expect(decimal(value, 'int64')).toBeNull();
  });
  it('enforces source-width boundaries', () => {
    expect(decimal('-9223372036854775808', 'int64')).toBe(-9223372036854775808n);
    expect(decimal('9223372036854775808', 'int64')).toBeNull();
    expect(decimal('18446744073709551615', 'uint64')).toBe(18446744073709551615n);
    expect(decimal('18446744073709551616', 'uint64')).toBeNull();
    expect(decimal('4294967295', 'uint32')).toBe(4294967295n);
    expect(decimal('4294967296', 'uint32')).toBeNull();
    expect(decimal('-1', 'ns')).toBeNull();
  });
  it('preserves optional absence and rejects present undefined and contradictory OR', () => {
    const f = fixture(); operation(f); expect(admitSourceRecords(f, POLICY).status).toBe('admitted');
    const reporter = f.repetitions[0].records[1]; reporter.frameType = undefined;
    expect(admitSourceRecords(f, POLICY).status).toBe('unavailable'); delete reporter.frameType;
    Object.assign(reporter, { hasMissingContent: false, checkerboardedNeedsRaster: true, checkerboardedNeedsRecord: false });
    reporter.source.fields.push('hasMissingContent', 'checkerboardedNeedsRaster', 'checkerboardedNeedsRecord');
    expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
  });
  it('does not invoke accessors', () => {
    const f = fixture(); let called = false; Object.defineProperty(f, 'origin', { get() { called = true; throw new Error('getter'); } });
    expect(admitSourceRecords(f, POLICY).status).toBe('unavailable'); expect(called).toBe(false);
  });
  it('rejects overlapping phases and horizon or pair disagreement', () => {
    const f = fixture(); f.repetitions[0].phases[1].startNs = '150'; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
    const g = fixture(); operation(g); g.repetitions[0].pairs[0].endNs = '149'; expect(admitSourceRecords(g, POLICY).status).toBe('unavailable');
  });
  it('bounds repetition, phase, record, identity and member cardinalities before deduplication', () => {
    const f = fixture(); f.repetitions = Array.from({ length: 3 }, (_, i) => ({ ...fixture().repetitions[0], id: `r${i}` }));
    expect(admitSourceRecords(f, POLICY).status).toBe('admitted'); f.repetitions.push(f.repetitions[0]); expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
    const g = fixture(); g.repetitions[0].phases = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, startNs: `${i * 10}`, endNs: `${i * 10 + 5}`, clockDomain: 'ns' }));
    expect(admitSourceRecords(g, POLICY).status).toBe('admitted'); g.repetitions[0].phases.push({ id: 'last', startNs: '80', endNs: '90', clockDomain: 'ns' }); expect(admitSourceRecords(g, POLICY).status).toBe('unavailable');
    const h = fixture(); operation(h); const a = h.repetitions[0].records.find((r: any) => r.kind === 'aggregation');
    a.surfaceTraceIds = Array(16384).fill('1'); expect(admitSourceRecords(h, POLICY).status).toBe('admitted'); a.surfaceTraceIds.push('1'); expect(admitSourceRecords(h, POLICY).status).toBe('unavailable');
    const j = fixture(); j.repetitions[0].records = Array.from({ length: 4092 }, (_, i) => ({ ...j.repetitions[0].records[0], id: `map${i}` }));
    expect(admitSourceRecords(j, POLICY).status).toBe('admitted'); j.repetitions[0].records.push({ ...j.repetitions[0].records[0], id: 'extra' }); expect(admitSourceRecords(j, POLICY).status).toBe('unavailable');
    j.repetitions[0].records = Array(4097).fill(j.repetitions[0].records[0]); expect(admitSourceRecords(j, POLICY).status).toBe('unavailable');
  });
  it.each(['state', 'frameType', 'kind', 'descriptorId', 'clockId', 'lifetimeId', 'traceNamespace'])('rejects unknown enum or dangling identity in %s', field => {
    const f = fixture(); operation(f); f.repetitions[0].records[1][field] = 'unknown'; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
  });
  it('rejects forged source presence, duplicate pair and record identity, unknown fields and nonplain objects', () => {
    const f = fixture(); operation(f); f.repetitions[0].records[1].source.typed = false; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
    const g = fixture(); operation(g); g.repetitions[0].pairs.push({ ...g.repetitions[0].pairs[0] }); expect(admitSourceRecords(g, POLICY).status).toBe('unavailable');
    const h = fixture(); h.repetitions[0].records.push({ ...h.repetitions[0].records[0] }); expect(admitSourceRecords(h, POLICY).status).toBe('unavailable');
    const j = fixture(); j.complete = true; expect(admitSourceRecords(j, POLICY).status).toBe('unavailable'); delete j.complete;
    Object.setPrototypeOf(j, { custom: true }); expect(admitSourceRecords(j, POLICY).status).toBe('unavailable');
  });
  it.each([null, undefined, 0, 1, 'STATE_PRESENTED_ALL'])('rejects absent/unnormalized reporter state %s', state => {
    const f = fixture(); operation(f); f.repetitions[0].records[1].state = state; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
  });
  it('rejects reversed pairs, zero-duration phases, horizon gaps and incomplete source presence', () => {
    const f = fixture(); operation(f); f.repetitions[0].pairs[0].startNs = '160'; f.repetitions[0].records[1].startNs = '160'; expect(admitSourceRecords(f, POLICY).status).toBe('unavailable');
    const g = fixture(); g.repetitions[0].phases[0].endNs = '100'; expect(admitSourceRecords(g, POLICY).status).toBe('unavailable');
    const h = fixture(); operation(h); h.repetitions[0].horizon.endNs = '140'; expect(admitSourceRecords(h, POLICY).status).toBe('unavailable');
    const j = fixture(); operation(j); j.repetitions[0].records[1].source.fields = ['state']; expect(admitSourceRecords(j, POLICY).status).toBe('unavailable');
  });
  it('rejects arrays with accessor members, holes and oversized identity slots without evaluating getters', () => {
    const f = fixture(); let called = false; Object.defineProperty(f.repetitions, '0', { get() { called = true; throw new Error('getter'); }, enumerable: true });
    expect(admitSourceRecords(f, POLICY).status).toBe('unavailable'); expect(called).toBe(false);
    const g = fixture(); g.repetitions = Array(1); expect(admitSourceRecords(g, POLICY).status).toBe('unavailable');
    const h = fixture(); h.repetitions[0].target.rootFrame = 'a'.repeat(129); expect(admitSourceRecords(h, POLICY).status).toBe('unavailable');
  });
  it('requires the explicit lifecycle, clock and source pin declarations without qualification promotion', () => {
    for (const field of ['origin', 'perfettoPin', 'normalizationContract', 'stateMapping', 'normalizationEvidence']) {
      const f = fixture(); delete f[field]; expect(evaluate(f, POLICY).status).toBe('unavailable');
    }
    const g = fixture(); g.repetitions[0].clocks[0].normalizedDomain = 'other-clock'; expect(evaluate(g, POLICY).status).toBe('unavailable');
    const h = fixture(); h.repetitions[0].lifecycleAuthority.noOmittedTransitions = false; expect(evaluate(h, POLICY).status).toBe('unavailable');
    const j = fixture(); j.runtimeQualification = 'verified'; expect(evaluate(j, POLICY).status).toBe('unavailable');
    expect(evaluate(fixture(), POLICY)).toMatchObject({ declarationAgreement: 'manual-declarations-only', companions: { completion: 'not_evaluated_here', domFreshness: 'not_evaluated_here', backlog: 'not_evaluated_here', scrollCorrectness: 'not_evaluated_here' } });
  });
});

describe('independent windows, relevance and exact metric reduction', () => {
  it.each([
    ['90', '110', 0, 1, 0, 0, 1, 0],
    ['190', '310', 1, 0, 0, 1, 0, 1],
    ['250', '320', 0, 0, 0, 1, 0, 1],
    ['390', '410', 0, 0, 1, 0, 0, 0],
    ['100', '100', 1, 1, 0, 0, 0, 0],
    ['200', '200', 0, 0, 0, 0, 0, 0],
    ['300', '300', 0, 0, 1, 1, 0, 0],
    ['400', '400', 0, 0, 0, 0, 0, 0],
  ])('attempt %s and success %s use their independent half-open windows', (attempt, end, aAttempts, aPresentations, bAttempts, bPresentations, aCarry, bCarry) => {
    const f = fixture(); operation(f, '1', attempt as string, end as string);
    const [a, b] = evaluate(f, POLICY).repetitions[0].phases;
    expect([a.attempts.count, a.presentations.count, b.attempts.count, b.presentations.count]).toEqual([aAttempts, aPresentations, bAttempts, bPresentations]);
    expect([a.presentations.presentationAttemptCarryIn, b.presentations.presentationAttemptCarryIn]).toEqual([aCarry, bCarry]);
    if (attempt === '190') expect(a.attempts.attemptSuccessCarryOut).toBe(1);
    if (attempt === '390') expect(b.attempts.attemptSuccessCarryOut).toBe(1);
  });
  it('ordinary no-update/drop and receive-only evidence do not withhold observed zero lanes', () => {
    for (const state of ['no_update_desired', 'dropped']) {
      const f = fixture(); operation(f, '1', '120', '150', state);
      f.repetitions[0].records = f.repetitions[0].records.filter((v: any) => v.kind === 'mapping' || v.kind === 'reporter');
      delete f.repetitions[0].records[1].displayTraceId; f.repetitions[0].records[1].source.fields = f.repetitions[0].records[1].source.fields.filter((v: string) => v !== 'displayTraceId');
      f.repetitions[0].pairs = f.repetitions[0].pairs.filter((v: any) => v.kind === 'reporter');
      const result = evaluate(f, POLICY); expect(result.repetitions[0].phases[0]).toMatchObject({ attempts: { status: 'observed_only', count: 0 }, presentations: { status: 'observed_only', count: 0 }, opportunityAssociationCount: 1 });
      f.repetitions[0].records.push(record('receive', 'rejected', { surfaceTraceId: '1', frameSinkClient: '1', frameSinkSink: '2', ns: '90', rejected: true }));
      expect(evaluate(f, POLICY).repetitions[0].phases[0].attempts.count).toBe(0);
      expect(evaluate(f, POLICY).diagnostics.samples.map((v: any) => v.code)).toContain('receive-only-not-demonstrated-accepted');
    }
  });
  it('scopes unresolved success to its end window while independent attempt lanes survive', () => {
    const f = fixture(); operation(f); additionalReporter(f, '2', '310'); const reporter = f.repetitions[0].records.at(-1);
    delete reporter.displayTraceId; reporter.source.fields = reporter.source.fields.filter((v: string) => v !== 'displayTraceId');
    const [a, b] = evaluate(f, POLICY).repetitions[0].phases;
    expect(a.attempts.count).toBe(1); expect(a.presentations.count).toBe(1); expect(b.attempts.count).toBe(0); expect(b.presentations.status).toBe('unavailable');
  });
  it('preserves known-successful-subset outcomes when a reused surface has no display-specific success', () => {
    const f = fixture(); operation(f); operation(f, '2', '180', '190');
    const r = f.repetitions[0]; r.records = r.records.filter((v: any) => v.id !== 'report-2'); r.pairs = r.pairs.filter((v: any) => v.id !== 'report-pair-2');
    r.records.find((v: any) => v.id === 'aggregate-2').surfaceTraceIds = ['1'];
    const a = evaluate(f, POLICY).repetitions[0].phases[0];
    expect(a.attempts).toMatchObject({ count: 2, attemptUnknownOutcome: 1 }); expect(a.presentations).toMatchObject({ count: 1, outcomeCoverage: 'known_successful_subset' });
  });
  it.each([['presented_all', 'presented_all', 'all_only'], ['presented_partial', 'presented_partial', 'partial_only'], ['presented_all', 'presented_partial', 'mixed_all_partial']])('reduces %s + %s associations to one exclusive %s operation', (first, second, category) => {
    const f = fixture(); operation(f, '1', '120', '150', first); additionalReporter(f, '2', '150', second); additionalReporter(f, '3', '150', 'dropped');
    const a = evaluate(f, POLICY).repetitions[0].phases[0];
    expect(a.presentations.count).toBe(1); expect(a.presentations.successfulAssociationCount).toBe(2); expect(a.presentations.categories[category]).toBe(1);
    expect(Object.values(a.presentations.categories).reduce((n: number, x: any) => n + x, 0)).toBe(1);
    expect(a.attempts.reporterStartCarryIn).toBe(1); expect(a.presentations.reporterStartCarryIn).toBe(1);
  });
  it('counts true/false/absent content as associations and not operations', () => {
    const f = fixture(); operation(f); additionalReporter(f, '2', '150', 'presented_partial', { hasMissingContent: true, checkerboardedNeedsRaster: true, checkerboardedNeedsRecord: false });
    additionalReporter(f, '3', '150', 'presented_all', { hasMissingContent: false, checkerboardedNeedsRaster: false, checkerboardedNeedsRecord: false });
    const a = evaluate(f, POLICY).repetitions[0].phases[0]; expect(a.presentations.count).toBe(1);
    expect(a.presentations.content.hasMissingContent).toEqual({ true: 1, false: 1, absent: 1 });
    expect(a.presentations.content.checkerboardedNeedsRecord).toEqual({ true: 0, false: 2, absent: 1 });
  });
  it('conflicting success ends withhold only their presentation phases and preserve the attempt', () => {
    const f = fixture(); operation(f, '1', '180', '199'); additionalReporter(f, '2', '300');
    const [a, b] = evaluate(f, POLICY).repetitions[0].phases;
    expect(a.attempts.count).toBe(1); expect(a.attempts.attemptUnknownOutcome).toBe(0); expect(b.attempts.count).toBe(0); expect(a.presentations.status).toBe('unavailable'); expect(b.presentations.status).toBe('unavailable');
    f.repetitions[0].records.at(-1).endNs = '250'; f.repetitions[0].pairs.at(-1).endNs = '250';
    expect(evaluate(f, POLICY).repetitions[0].phases[1].presentations.count).toBe(0);
  });
  it('rejects lower prefix rates on bounded output overflow', () => {
    const f = fixture(); operation(f); const r = f.repetitions[0];
    for (let i = 2; i <= 1800; i++) additionalReporter(f, `${i}`);
    expect(admitSourceRecords(f, POLICY).status).toBe('admitted');
    const result = evaluate(f, POLICY); expect(result.status).toBe('unavailable'); expect(result).not.toHaveProperty('repetitions');
    expect(result.diagnostics.samples.map((v: any) => v.code)).toContain('index-or-output-capacity');
  });
  it('withholds an explicitly attempted dropped chain, even with its entire aggregation absent', () => {
    const f = fixture(); operation(f, '1', '120', '310', 'dropped'); const r = f.repetitions[0];
    r.records = r.records.filter((v: any) => v.kind !== 'aggregation'); r.pairs = r.pairs.filter((v: any) => v.kind !== 'aggregation');
    const [a, b] = evaluate(f, POLICY).repetitions[0].phases; expect(a.attempts.status).toBe('unavailable'); expect(a.presentations.count).toBe(0); expect(b.attempts.count).toBe(0);
  });
  it('rejects receive FrameSink conflicts and conflicting aggregation or draw identities without inferring ownership', () => {
    for (const kind of ['receive', 'draw', 'aggregation']) {
      const f = fixture(); operation(f); const r = f.repetitions[0]; const original = r.records.find((v: any) => v.kind === kind);
      const clone = JSON.parse(JSON.stringify(original)); clone.id = 'collision';
      if (kind === 'receive') clone.frameSinkSink = '3';
      if (kind === 'draw') clone.ns = '119';
      if (kind === 'aggregation') { clone.endNs = '119'; clone.pairId = 'collision-pair'; r.pairs.push({ ...r.pairs[1], id: 'collision-pair', endNs: '119' }); }
      r.records.push(clone); expect(evaluate(f, POLICY).repetitions[0].phases[0].attempts.status).toBe('unavailable');
    }
  });
  it('requires a mapping before carried reporter start and the same explicit process incarnation', () => {
    const f = fixture(); operation(f, '1', '90', '110'); f.repetitions[0].records[0].ns = '85';
    expect(evaluate(f, POLICY).repetitions[0].phases[0].presentations.status).toBe('unavailable');
    const g = fixture(); operation(g); g.repetitions[0].records[1].processIncarnation = 'renderer-restart'; expect(evaluate(g, POLICY).status).toBe('unavailable');
  });
  it('retains equal-time distinct IDs and exact zero intervals, with one exact rational per full phase', () => {
    const f = fixture(); operation(f); operation(f, '2'); const a = evaluate(f, POLICY).repetitions[0].phases[0];
    expect(a.presentations.count).toBe(2); expect(a.presentations.intervals.adjacentNs).toEqual(['0']);
    expect(a.presentations.rate).toEqual({ scaledNumerator: '2000000000', denominatorNs: '100', unit: 'reported-presentations/s' });
    expect(a.attempts.rate.unit).toBe('attempts/s');
    expect(evaluate(f, POLICY).repetitions[0].phases[1].attempts.intervals.status).toBe('unavailable');
  });
  it('subtracts large adjacent ns without converting to Number', () => {
    const f = fixture(); operation(f); operation(f, '2'); const r = f.repetitions[0]; const offset = 9007199254740992n;
    for (const v of [r.horizon, r.lifecycleAuthority, ...r.phases, ...r.lifetimes, ...r.pairs, ...r.records]) for (const key of ['startNs', 'endNs', 'ns']) if (key in v) v[key] = (BigInt(v[key]) + offset).toString();
    r.records.find((v: any) => v.id === 'report-2').endNs = (offset + 151n).toString(); r.pairs.find((v: any) => v.id === 'report-pair-2').endNs = (offset + 151n).toString();
    const a = evaluate(f, POLICY).repetitions[0].phases[0]; expect(a.presentations.intervals?.adjacentNs).toEqual(['1']); expect(a.presentations.rate.denominatorNs).toBe('100');
  });
  it('isolates repetitions, frozen caller objects and output mutation', () => {
    const f = fixture(); operation(f); const other = fixture().repetitions[0]; other.id = 'empty'; f.repetitions.push(other);
    function freeze(v: any): void { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } } freeze(f);
    const before = evaluate(f, POLICY); expect(before.repetitions[0].phases[0].attempts.count).toBe(0); expect(before.repetitions[1].phases[0].attempts.count).toBe(1);
    before.repetitions[1].operations[0].reporterIds.push('caller-mutation'); expect(evaluate(f, POLICY).repetitions[1].operations[0].reporterIds).toEqual(['report-1']);
  });
  it('caps diagnostic samples and retains the additional issue count', () => {
    const d = new Diagnostics(); for (let i = 0; i < 100; i++) d.add({ code: `issue-${i}` }); expect(d.result().samples).toHaveLength(32); expect(d.result().additionalIssueCount).toBe(68);
  });
  it('withholds unsupported fork/backfill required chains and diagnoses a skipped backfill', () => {
    for (const frameType of ['forked', 'backfill']) {
      const f = fixture(); operation(f); const reporter = f.repetitions[0].records[1]; reporter.frameType = frameType; reporter.source.fields.push('frameType');
      const a = evaluate(f, POLICY).repetitions[0].phases[0]; expect(a.attempts.status).toBe('unavailable'); expect(a.presentations.status).toBe('unavailable');
    }
    const f = fixture(); operation(f, '1', '120', '150', 'dropped'); const r = f.repetitions[0];
    r.records = r.records.filter((v: any) => v.kind === 'reporter' || v.kind === 'mapping'); r.pairs = r.pairs.filter((v: any) => v.kind === 'reporter');
    r.records[1].frameType = 'backfill'; r.records[1].source.fields.push('frameType');
    const a = evaluate(f, POLICY).repetitions[0].phases[0]; expect(a.attempts.count).toBe(0); expect(a.presentations.count).toBe(0);
  });
});

describe('whole-horizon exact joins and declarations', () => {
  it('joins two exact displays without mutating input and fixes qualification labels', () => {
    const f = fixture(); operation(f, '9007199254740992'); operation(f, '9007199254740993'); const before = JSON.stringify(f);
    const result = evaluate(f, POLICY); expect(result.status).toBe('observed_only');
    expect(result.repetitions[0].operations.map((v: any) => v.displayTraceId)).toEqual(['9007199254740992', '9007199254740993']);
    expect(JSON.stringify(f)).toBe(before);
    expect(result).toMatchObject({ runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', normalizationCapability: 'manual-fixtures-only', scoringEligibility: false, rankingEligibility: false });
  });
  it('is invariant to permutation and repeated membership with distinct equal-time operations', () => {
    const f = fixture(); operation(f); operation(f, '2'); f.repetitions[0].records[3].surfaceTraceIds.push('1');
    const before = evaluate(f, POLICY); for (const key of ['records', 'pairs', 'phases', 'clocks', 'lifetimes', 'descriptors']) f.repetitions[0][key].reverse();
    expect(evaluate(f, POLICY)).toEqual(before); expect(before.repetitions[0].operations).toHaveLength(2);
  });
  it('withholds mapping-affected phases without using unrelated owners', () => {
    const f = fixture(); operation(f); f.repetitions[0].records[0].hostId = '2';
    expect(evaluate(f, POLICY).repetitions[0].phases.every((v: any) => v.attempts.status === 'unavailable')).toBe(true);
    const g = fixture(); operation(g); g.repetitions[0].records[0].ns = '250';
    expect(evaluate(g, POLICY).repetitions[0].phases[0].attempts.status).toBe('unavailable');
    const h = fixture(); operation(h); h.repetitions[0].records.push(record('transition', 'commit', { rootFrame: 'root', ns: '250', transition: 'commit' }));
    const phases = evaluate(h, POLICY).repetitions[0].phases;
    expect(phases[0].attempts.status).toBe('observed_only'); expect(phases[1].attempts.status).toBe('unavailable');
  });
  it('scopes missing receive/draw/aggregation by explicit swap identity', () => {
    for (const missing of ['receive', 'draw', 'aggregation']) {
      const f = fixture(); operation(f); f.repetitions[0].records = f.repetitions[0].records.filter((v: any) => v.kind !== missing);
      if (missing === 'aggregation') f.repetitions[0].pairs = f.repetitions[0].pairs.filter((v: any) => v.kind !== 'aggregation');
      const phases = evaluate(f, POLICY).repetitions[0].phases;
      expect(phases[0].attempts.status).toBe('unavailable'); expect(phases[0].presentations.status).toBe('unavailable');
      expect(phases[1].attempts.status).toBe('observed_only'); expect(phases[1].presentations.status).toBe('observed_only');
    }
  });
  it('withholds repetition-wide attempts for conflicting exact swap times', () => {
    const f = fixture(); operation(f); f.repetitions[0].records.push(record('swap', 'conflicting-swap', { displayTraceId: '1', ns: '310' }));
    expect(evaluate(f, POLICY).repetitions[0].phases.every((v: any) => v.attempts.status === 'unavailable')).toBe(true);
  });
  it('does not turn an unrelated reporter or orphan receive into target evidence', () => {
    const f = fixture(); operation(f); f.repetitions[0].records[1].hostId = '2';
    expect(evaluate(f, POLICY).repetitions[0].operations).toEqual([]);
  });
});
