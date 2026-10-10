import { describe, expect, it } from 'vitest';
import { createCalibrationFixture, validateFixture, payloadBytes, prefixesFor, prefixCheckpoints, canonicalSerialize } from './fixture.js';
import { canonicalHash, serializeFixture } from './hash.js';

describe('deterministic replay fixture', () => {
  it('has stable identity, alternating history and 200 exact 50ms deltas', () => {
    const f = createCalibrationFixture();
    expect(createCalibrationFixture()).toEqual(f);
    expect(f.schemaVersion).toBe(1);
    expect(f.scenarioId).toBe('calibration-v1');
    expect(f.generator).toEqual({ version: '1', seed: 1 });
    expect(f.history).toHaveLength(100);
    f.history.forEach((m, i) => { expect(m.role).toBe(i % 2 ? 'assistant' : 'user'); expect(m.status).toBe('complete'); });
    expect(f.events[0]?.type).toBe('assistant-start');
    const deltas = f.events.filter(e => e.type === 'text-delta');
    expect(deltas).toHaveLength(200);
    deltas.forEach((e, i) => { expect(e.scheduledMs).toBe((i + 1) * 50); expect(typeof e.text).toBe('string'); });
    expect(f.events.at(-1)?.type).toBe('assistant-complete');
    expect(new Set(f.events.map(e => e.messageId)).size).toBe(1);
    expect(validateFixture(f)).toEqual(f);
  });
  it('hashes exactly the canonical stored UTF8 content recursively', () => {
    expect(payloadBytes('🙂')).toBe(4);
    expect('🙂'.length).toBe(2);
    expect(canonicalHash({ a: 1, b: { z: 2, a: 3 } })).toBe(canonicalHash({ b: { a: 3, z: 2 }, a: 1 }));
    expect(canonicalSerialize({ z: [2, { b: 2, a: 1 }], a: 0 })).toBe('{"a":0,"z":[2,{"a":1,"b":2}]}');
    const saved = serializeFixture(createCalibrationFixture());
    expect(saved.serialized).toBe(canonicalSerialize(saved.fixture));
    expect(saved.hash).toBe(canonicalHash(saved.fixture));
    expect(() => canonicalSerialize({ a: NaN })).toThrow();
    expect(() => canonicalSerialize({ a: undefined })).toThrow();
  });
  it('maps emoji, empty chunks and multiple sequences at one DOM checkpoint', () => {
    expect(prefixesFor(['a', '🙂', ''])).toEqual(['a', 'a🙂', 'a🙂']);
    const points = prefixCheckpoints([
      { sequence: 2, text: 'a' }, { sequence: 3, text: '🙂' }, { sequence: 4, text: '' },
    ]);
    expect(points).toEqual([
      { sequence: 2, prefix: 'a', characterLength: 1, utf8Bytes: 1 },
      { sequence: 3, prefix: 'a🙂', characterLength: 3, utf8Bytes: 5 },
      { sequence: 4, prefix: 'a🙂', characterLength: 3, utf8Bytes: 5 },
    ]);
    expect(points.filter(p => 'a🙂'.startsWith(p.prefix)).map(p => p.sequence)).toEqual([2, 3, 4]);
  });
  it('rejects sparse arrays rather than colliding hashes or producing invalid JSON', () => {
    expect(() => canonicalSerialize(Array(1))).toThrow(/sparse/i);
    expect(() => canonicalSerialize([1, , 3])).toThrow(/sparse/i);
  });
  it('normalizes explicitly absent optional generator metadata before serialization', () => {
    const input = { ...createCalibrationFixture(), generator: undefined };
    const validated = validateFixture(input);
    expect(Object.hasOwn(validated, 'generator')).toBe(false);
    const saved = serializeFixture(validated);
    expect(JSON.parse(saved.serialized)).toEqual(validated);
    expect(saved.hash).toBe(canonicalHash(validated));
  });
  it.each([-1, NaN, Infinity])('rejects invalid schedule %s', time => {
    const f = createCalibrationFixture(); f.events[1]!.scheduledMs = time;
    expect(() => validateFixture(f)).toThrow();
  });
  it.each(['decreasing time', 'duplicate sequence', 'decreasing sequence', 'unknown id', 'before start', 'repeat completion', 'after completion', 'missing completion', 'duplicate history id', 'start existing id'])('rejects %s', fault => {
    const f = createCalibrationFixture();
    switch (fault) {
      case 'decreasing time': f.events[2]!.scheduledMs = 0; break;
      case 'duplicate sequence': f.events[2]!.sequence = f.events[1]!.sequence; break;
      case 'decreasing sequence': f.events[2]!.sequence = 0; break;
      case 'unknown id': f.events[1]!.messageId = 'unknown'; break;
      case 'before start': f.events.shift(); break;
      case 'repeat completion': f.events.push({ ...f.events.at(-1)!, sequence: 203 }); break;
      case 'after completion': f.events.push({ ...f.events[1]!, sequence: 203, scheduledMs: 10000 }); break;
      case 'missing completion': f.events.pop(); break;
      case 'duplicate history id': f.history[1]!.id = f.history[0]!.id; break;
      case 'start existing id': f.events[0]!.messageId = f.history[0]!.id; break;
    }
    expect(() => validateFixture(f)).toThrow();
  });
  it('allows equal scheduled times in sequence order', () => {
    const f = createCalibrationFixture(); f.events[2]!.scheduledMs = 50;
    expect(validateFixture(f)).toEqual(f);
  });
  it('rejects a new response after the fixture response has completed', () => {
    const f = createCalibrationFixture();
    f.events.push(
      { sequence: 202, scheduledMs: 10000, messageId: 'second-response', type: 'assistant-start', text: '' },
      { sequence: 203, scheduledMs: 10000, messageId: 'second-response', type: 'assistant-complete', text: '' },
    );
    expect(() => validateFixture(f)).toThrow(/completion/);
  });
});
