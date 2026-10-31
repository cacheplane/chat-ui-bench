// Authored-only helper controls. No captured data, native execution, or publication.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const digest = name => createHash('sha256').update(readFileSync(new URL(name, import.meta.url))).digest('hex');
const pinned = [digest('./feedback-observations-capacity-core-v3.mjs'), digest('./feedback-observations-capacity-source-model-v3.json')];
let make;
function canonicalInventory(root) {
  const strings = [], numbers = [];
  const walk = value => {
    if (typeof value === 'number') {
      assert.ok(Number.isSafeInteger(value));
      numbers.push(value);
    } else if (typeof value === 'string') strings.push(value);
    else if (value && typeof value === 'object') {
      if (!Array.isArray(value)) strings.push(...Object.keys(value));
      for (const item of Object.values(value)) walk(item);
    } else assert.ok(value === null || typeof value === 'boolean');
  };
  walk(root);
  return { strings, numbers };
}
test('authored helper is available', async () => {
  const module = await import('./feedback-packed-authored-fixture-v1.mjs').catch(() => ({}));
  assert.equal(typeof module.makePackedFeedbackAuthoredFixtureV1, 'function');
  make = module.makePackedFeedbackAuthoredFixtureV1;
});

test('small admitted candidates equal complete unchanged V3 results', () => {
  for (const presentations of [1, 2, 8]) {
    const fixture = make({ presentations, aggregateMembers: 2 });
    assert.equal(fixture.authoredFixture, true);
    assert.ok(Buffer.isBuffer(fixture.targetCSV));
    assert.ok(Buffer.isBuffer(fixture.scopeCSV));
    assert.equal(fixture.legacyResult.status, 'observed');
    assert.deepEqual(fixture.canonicalCandidate, fixture.legacyResult);
    assert.equal(fixture.canonicalCandidate.events.length, presentations);
    assert.deepEqual(fixture.canonicalCandidate.interval, {
      startTs: '1000000000', endTs: '3000000000', durationNs: '2000000000', membership: 'terminal-in-[start,end)',
    });
    assert.ok(Object.isFrozen(fixture));
    assert.ok(Object.isFrozen(fixture.canonicalCandidate.events));
  }
});

test('scale candidates retain actual legacy output refusal and complete canonical graph', () => {
  for (const [presentations, bytes] of [[120, 700969], [240, 1399970], [480, 2797970]]) {
    const fixture = make({ presentations, aggregateMembers: 24 });
    assert.equal(fixture.legacyResult.status, 'unavailable');
    assert.equal(fixture.legacyResult.stage, 'limits');
    assert.ok(['result-width', 'result-nodes'].includes(fixture.legacyResult.reason));
    assert.equal(fixture.canonicalCandidate.status, 'observed');
    assert.equal(fixture.canonicalCandidate.events.length, presentations);
    assert.equal(Buffer.byteLength(JSON.stringify(fixture.canonicalCandidate)), bytes);
    assert.equal(fixture.canonicalCandidate.interval.durationNs, '2000000000');
    canonicalInventory(fixture.canonicalCandidate);
    assert.equal(typeof fixture.canonicalCandidate.observedHz.numerator, 'string');
    assert.equal(typeof fixture.canonicalCandidate.observedHz.denominator, 'string');
    for (const event of fixture.canonicalCandidate.events) {
      assert.equal(event.aggregationReferences.length, 1);
      assert.equal(event.aggregationReferences[0].members.length, 24);
      assert.equal(event.aggregationReferences[0].contributions.length, 1);
      assert.equal(typeof event.displayTraceId, 'string');
      assert.equal(typeof event.terminalTs, 'string');
    }
  }
});

test('entire canonical numeric inventory is safe integer and source strings preserve Unicode', () => {
  const fixture = make({ presentations: 2, aggregateMembers: 24, extraReporterArguments: 2 });
  const { strings } = canonicalInventory(fixture.canonicalCandidate);
  assert.ok(strings.includes('AUTHORED_EXTRA_é_😀'));
  assert.ok(strings.includes('1000000000'));
  assert.ok(strings.includes('2000000000'));
  assert.equal(fixture.legacyResult.status, 'observed');
  assert.deepEqual(fixture.canonicalCandidate, fixture.legacyResult);
});

test('invalid options cannot create unbounded or alternate-origin fixtures', () => {
  for (const options of [{ presentations: 0 }, { presentations: 481 }, { presentations: 1.5 }, { aggregateMembers: 1 }, { aggregateMembers: 25 }, { extraReporterArguments: -1 }, { extraReporterArguments: 25 }, { source: 'anything' }]) {
    assert.throws(() => make(options));
  }
});

test('separate calls retain fresh deterministic Buffers and logical arrays', () => {
  const first = make({ presentations: 1 });
  const second = make({ presentations: 1 });
  assert.deepEqual(first.targetCSV, second.targetCSV);
  assert.deepEqual(first.scopeCSV, second.scopeCSV);
  assert.notEqual(first.targetCSV, second.targetCSV);
  assert.notEqual(first.canonicalCandidate.events, second.canonicalCandidate.events);
  first.targetCSV.fill(0);
  assert.notDeepEqual(first.targetCSV, second.targetCSV);
  assert.equal(second.canonicalCandidate.events.length, 1);
});

test('helper leaves pinned historical evaluator and policy bytes unchanged', () => {
  assert.deepEqual([digest('./feedback-observations-capacity-core-v3.mjs'), digest('./feedback-observations-capacity-source-model-v3.json')], pinned);
});
