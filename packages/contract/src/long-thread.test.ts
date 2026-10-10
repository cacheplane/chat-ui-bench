import { describe, expect, it } from 'vitest';
import { canonicalHash } from './hash.js';
import { payloadBytes } from './fixture.js';
import { createLongThreadFixture, createLongThreadMatrix, longThreadFixtureSchema, projectProseDomText, validateCanonicalLongThreadFixture } from './long-thread.js';

describe('long thread workload', () => {
  it('generates the twelve cases in fixed independent-axis order', () => {
    const matrix = createLongThreadMatrix();
    expect(matrix.map(f => [f.workload.historyCount, f.workload.responseBytes, f.workload.journey])).toEqual(
      [100, 1000, 10000].flatMap(h => [6400, 262144].flatMap(r => ['follow', 'history-reading'].map(j => [h, r, j]))));
    for (const fixture of matrix) {
      expect(fixture.schemaVersion).toBe(2);
      expect(fixture.history).toHaveLength(fixture.workload.historyCount);
      expect(fixture.history.at(-1)?.role).toBe('user');
      expect(new Set(fixture.history.map(m => m.id)).size).toBe(fixture.history.length);
      fixture.history.forEach((m, i) => {
        expect(m.role).toBe(i % 2 === 0 ? 'assistant' : 'user');
        expect(m.status).toBe('complete');
        expect(payloadBytes(m.text)).toBe(512);
        expect(m.text).toMatch(/^[A-Za-z0-9 .,]+[A-Za-z0-9.]$/);
      });
      const deltas = fixture.events.filter(e => e.type === 'text-delta');
      expect(deltas).toHaveLength(200);
      expect(deltas.every(e => /\S/.test(e.text))).toBe(true);
      expect(payloadBytes(deltas.map(e => e.text).join(''))).toBe(fixture.workload.responseBytes);
      expect(deltas.map(e => payloadBytes(e.text))).toEqual(fixture.workload.chunkBytes);
      expect(deltas.map(e => e.scheduledMs)).toEqual(Array.from({length: 200}, (_, i) => (i + 1) * 50));
      expect(fixture.events[0]).toMatchObject({sequence: 0, scheduledMs: 0, type: 'assistant-start', text: ''});
      expect(fixture.events.at(-1)).toMatchObject({sequence: 201, scheduledMs: 10000, type: 'assistant-complete', text: ''});
      expect(longThreadFixtureSchema.safeParse(fixture).success).toBe(true);
    }
  });
  it('is deterministic and seed changes text without changing the byte budget', () => {
    const options = {historyCount: 100, responseBytes: 6400, journey: 'follow'} as const;
    const first = createLongThreadFixture(options);
    expect(canonicalHash(first)).toBe(canonicalHash(createLongThreadFixture({...options, seed: 1})));
    expect(canonicalHash(first)).not.toBe(canonicalHash(createLongThreadFixture({...options, seed: 2})));
    expect(first.history).toEqual(createLongThreadFixture({...options, responseBytes: 262144}).history);
    expect(first.events).toEqual(createLongThreadFixture({...options, journey: 'history-reading'}).events);
  });
  it('pins the canonical seed one fixture hashes', () => {
    expect(createLongThreadMatrix().map(canonicalHash)).toEqual([
      '7bdd63ebc2ef650a28d26bf9ca7342e4c83fe08469d17ddefdcf770ec0534128',
      'e5d11838de49f82d50f7a4f17a5916d06c290bc68bd97bd118163ada1cbcc88d',
      '449278cec763e7e8e2a40684968cff99630de006904ba561c181fbb8c02a73a1',
      'f20e9234943846530ce6292075ee52d40405a81389173fc473af3fea6a5625ff',
      '60a43e25a8de05df215d1d25baf1c20bcec5f40237db621ceeaee214d9b49aa7',
      '1f92e53531e4d0daee45724000973c21788dd7ef625c30bced32698480418255',
      '5cdc65e43ed123c2fb1aa987e1a893196e1ea88b8404617f1c3cd79b8023a790',
      'df50d14646a6555340d54037e7c5eb3b0fff9d75ff092ed624e8c2c19a5c79d3',
      'c70489589009b26bb146685ba7930bb29df2f136b1d28c23c57eb4d3c84f0bdd',
      '1766a99592127470301b0f9333b473b2e3edc628da4dd8e4bf01c2ba9b427016',
      'ad0889a9e26b9f67215fd66ac4cc88272dcd7ac7d78b85829b9419b1273ae6fb',
      '5297f6439cfb9b189954380e42603ed1c380883651b27e372433e7b0a2b0c8c6',
    ]);
  });
  it('strictly rejects metadata mismatch, omitted chunks, and invalid lifecycle', () => {
    const fixture = createLongThreadFixture({historyCount: 100, responseBytes: 6400, journey: 'follow'});
    expect(longThreadFixtureSchema.safeParse({...fixture, unexpected: true}).success).toBe(false);
    expect(longThreadFixtureSchema.safeParse({...fixture, events: fixture.events.filter(e => e.sequence !== 50)}).success).toBe(false);
    expect(longThreadFixtureSchema.safeParse({...fixture, workload: {...fixture.workload, responseBytes: 262144}}).success).toBe(false);
    expect(longThreadFixtureSchema.safeParse({...fixture, events: fixture.events.slice(0, -1)}).success).toBe(false);
    expect(() => createLongThreadFixture({...fixture.workload, seed: -1})).toThrow();
  });
  it('projects only ASCII whitespace and preserves Unicode and omissions', () => {
    expect(projectProseDomText(' \tFirst\r\n second\f ')).toBe('First second');
    expect(projectProseDomText(' A\u00a0B 🙂 漢字 \u2003 ')).toBe('A\u00a0B 🙂 漢字 \u2003');
    expect(projectProseDomText('First missing word.')).not.toBe(projectProseDomText('First word.'));
  });
  it('distinguishes structurally valid prose from exact canonical seed content', () => {
    const fixture = createLongThreadFixture({historyCount: 100, responseBytes: 6400, journey: 'follow', seed: 2});
    expect(validateCanonicalLongThreadFixture(fixture)).toEqual(fixture);
    const changedHistory = {...fixture, history: fixture.history.map((m, i) => i === 0 ? {...m, text: 'X' + m.text.slice(1)} : m)};
    expect(longThreadFixtureSchema.safeParse(changedHistory).success).toBe(true);
    expect(() => validateCanonicalLongThreadFixture(changedHistory)).toThrow('canonical');
    const changedResponse = {...fixture, events: fixture.events.map(e => e.sequence === 1 ? {...e, text: 'X' + e.text.slice(1)} : e)};
    expect(longThreadFixtureSchema.safeParse(changedResponse).success).toBe(true);
    expect(() => validateCanonicalLongThreadFixture(changedResponse)).toThrow('canonical');
    const changedIdentity = {...fixture, history: fixture.history.map((m, i) => i === 0 ? {...m, id: 'different-id'} : m)};
    expect(() => validateCanonicalLongThreadFixture(changedIdentity)).toThrow('canonical');
  });
});
