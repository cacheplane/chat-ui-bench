import { afterEach, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readOwnedPaintTraceV12, readOwnedPaintTraceV12ForWorker } from './browser-frame-owned-paint-v12-reader.js';
import { OwnedPaintBudgetV12 } from './browser-frame-owned-paint-v12-budget.js';
import { OWNED_PAINT_V12_POLICY } from './browser-frame-owned-paint-v12.js';
import { body, join, uint, text } from './browser-frame-packet-fragments.test-helper.js';

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});
function fixture(bytes: Uint8Array = body(1, new Uint8Array())) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'owned-v12-synthetic-')));
  directories.push(directory);
  const filename = path.join(directory, 'authored.bin');
  fs.writeFileSync(filename, bytes);
  const reference = { path: filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  return { directory, filename, bytes, reference, json: JSON.stringify(reference) };
}
const read = (value: unknown) => readOwnedPaintTraceV12(value, OWNED_PAINT_V12_POLICY);
function withdrawn(result: ReturnType<typeof read>) {
  expect(result).toMatchObject({ status: 'unavailable', fullInputVerified: false, structuralContainerEOF: false, study: null,
    metrics: { FPS: null, rate: null, latency: null, duration: null },
    authority: { nativeSupported: false, qualificationEligibility: false, evaluationEligibility: false,
      scoringEligibility: false, rankingEligibility: false, inputOrigin: 'not_authenticated' } });
  expect(JSON.stringify(result)).not.toContain('complete-owned-selected-schema');
}

test('original synthetic file joins physical EOF, root boundary, hash, identity and successful close', () => {
  const f = fixture();
  const result = read(f.json);
  expect(result).toMatchObject({ status: 'complete-owned-whole-diagnostic', reason: null, fullInputVerified: true,
    structuralContainerEOF: true, reader: { kind: 'source-owned-persisted-file', EOF: true, closed: true,
      identityMatch: true, hashMatch: true, bytes: f.bytes.length, sha256: f.reference.sha256 },
    study: { status: 'complete-owned-selected-schema', counters: { packets: 1 } } });
  expect(result.reader.reads).toBe(2);
  expect(result.reader.before).toHaveLength(7);
  expect(result.reader.after).toEqual(result.reader.before);
});

test('empty synthetic file still requires an original zero-byte EOF read', () => {
  const result = read(fixture(new Uint8Array()).json);
  expect(result).toMatchObject({ fullInputVerified: true, structuralContainerEOF: true,
    reader: { bytes: 0, reads: 1, EOF: true, closed: true, hashMatch: true } });
});

test('reference object proxies and coercion hooks are never inspected', () => {
  let calls = 0;
  const hostile = new Proxy({}, { get() { calls++; throw Error('hostile'); }, ownKeys() { calls++; throw Error('hostile'); },
    getPrototypeOf() { calls++; throw Error('hostile'); } });
  for (const input of [hostile, null, undefined, 1, true, { toString() { calls++; throw Error('hostile'); } }]) withdrawn(read(input));
  expect(calls).toBe(0);
});

test('reference length and policy reject before JSON.parse or filesystem access', () => {
  const parse = vi.spyOn(JSON, 'parse');
  const open = vi.spyOn(fs, 'openSync');
  withdrawn(read(' '.repeat(32769)));
  withdrawn(readOwnedPaintTraceV12('{}', 'wrong-policy'));
  expect(parse).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

test('owned JSON requires exactly canonical ordered path bytes sha256', () => {
  const f = fixture();
  const wrong = [ '{}', 'null', '[]', f.json + '\n', ' ' + f.json,
    JSON.stringify({ bytes: f.reference.bytes, path: f.filename, sha256: f.reference.sha256 }),
    f.json.replace('"bytes":2', '"bytes":2.0'), f.json.replace('"bytes":2', '"bytes":2,"bytes":2'),
    JSON.stringify({ ...f.reference, extra: 0 }), JSON.stringify({ ...f.reference, bytes: -1 }),
    JSON.stringify({ ...f.reference, bytes: 33554433 }), JSON.stringify({ ...f.reference, sha256: 'A'.repeat(64) }),
    JSON.stringify({ ...f.reference, path: f.directory + '/./authored.bin' }),
    JSON.stringify({ ...f.reference, path: f.filename + '\0' }) ];
  const open = vi.spyOn(fs, 'openSync');
  for (const input of wrong) withdrawn(read(input));
  expect(open).not.toHaveBeenCalled();
});

test('wrong hash withdraws the entire otherwise successful study', () => {
  const f = fixture();
  withdrawn(read(JSON.stringify({ ...f.reference, sha256: '0'.repeat(64) })));
});

test('close failure after real EOF cannot retain nested semantic success', () => {
  const f = fixture();
  const original = fs.closeSync;
  vi.spyOn(fs, 'closeSync').mockImplementation(fd => { original(fd); throw Error('authored-close'); });
  const result = read(f.json);
  withdrawn(result);
  expect(result.reader).toMatchObject({ EOF: true, closed: false, hashMatch: true });
});

test('descriptor drift after matching bytes withdraws the complete study', () => {
  const f = fixture(), original = fs.fstatSync;
  let calls = 0;
  vi.spyOn(fs, 'fstatSync').mockImplementation(((...args: Parameters<typeof fs.fstatSync>) => {
    const stat = original(...args);
    if (++calls === 2 && typeof stat.ctimeNs === 'bigint') stat.ctimeNs += 1n;
    return stat;
  }) as typeof fs.fstatSync);
  withdrawn(read(f.json));
});

test('symlink leaf, symlink ancestor and hard-linked leaf reject before opening input', () => {
  const f = fixture();
  const leaf = f.filename + '.symlink'; fs.symlinkSync(f.filename, leaf);
  const ancestor = f.directory + '-symlink'; fs.symlinkSync(f.directory, ancestor); directories.push(ancestor);
  const open = vi.spyOn(fs, 'openSync');
  withdrawn(read(JSON.stringify({ ...f.reference, path: leaf })));
  withdrawn(read(JSON.stringify({ ...f.reference, path: ancestor + '/authored.bin' })));
  fs.linkSync(f.filename, f.filename + '.hard'); withdrawn(read(f.json));
  expect(open).not.toHaveBeenCalled();
});

test('growth after original open is detected and the original descriptor closes', () => {
  const f = fixture(), original = fs.readSync;
  let first = true;
  vi.spyOn(fs, 'readSync').mockImplementation(((...args: Parameters<typeof fs.readSync>) => {
    if (first) { first = false; fs.appendFileSync(f.filename, Uint8Array.of(10)); }
    return original(...args);
  }) as typeof fs.readSync);
  const result = read(f.json); withdrawn(result); expect(result.reader.closed).toBe(true);
});

test('original read exception never exposes a prefix study and always attempts close', () => {
  const f = fixture();
  vi.spyOn(fs, 'readSync').mockImplementation(() => { throw { get message() { throw Error('do not inspect'); } }; });
  const result = read(f.json); withdrawn(result); expect(result.reader.closed).toBe(true);
});

test('short original reads charge requested bytes without refunds and prove a separate EOF', () => {
  const f = fixture(), original = fs.readSync;
  vi.spyOn(fs, 'readSync').mockImplementation(((fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null) =>
    original(fd, buffer, offset, Math.min(1, length), position)) as typeof fs.readSync);
  const result = read(f.json);
  expect(result).toMatchObject({ fullInputVerified: true, reader: { reads: 3, bytes: 2, EOF: true } });
  expect(result.usage.cumulative.requestedReadBytes).toBe(6);
  expect(result.usage.cumulative.acknowledgedReadBytes).toBe(2);
});

test('semantic refusal drains a chunk-split original tail to physical EOF without revival', () => {
  const bytes = join(body(1, body(50, new Uint8Array())), body(1, body(19000, new Uint8Array(70000))));
  const result = read(fixture(bytes).json);
  expect(result).toMatchObject({ status: 'unavailable', fullInputVerified: true, structuralContainerEOF: true,
    reader: { EOF: true, closed: true, hashMatch: true, bytes: bytes.length },
    study: { status: 'unavailable', semanticProcessing: 'unavailable', candidates: [], paint: [],
      state: { sequences: [], definitions: [], defaults: [] }, evidence: { facts: [], occurrences: [] }, rawDrop: { facts: [] } } });
});

test('root framing refusal still hashes and closes original bytes but cannot claim structural EOF', () => {
  const result = read(fixture(Uint8Array.of(10, 4, 0)).json);
  expect(result).toMatchObject({ status: 'unavailable', fullInputVerified: true, structuralContainerEOF: false,
    reader: { EOF: true, closed: true, hashMatch: true }, study: { status: 'unavailable' } });
});

test('ordinary UserTiming candidate cannot survive late reader hash withdrawal', () => {
  const bytes = body(1, join(uint(10, 1n), uint(13, 1n), body(11, join(uint(9, 3n), text(22, 'blink.user_timing'), text(23, 'phase')))));
  const f = fixture(bytes), healthy = read(f.json);
  expect(healthy.fullInputVerified).toBe(true);
  expect(healthy.study?.candidates).toHaveLength(1);
  withdrawn(read(JSON.stringify({ ...f.reference, sha256: '0'.repeat(64) })));
});

test('read-call exhaustion never invents EOF even after every expected byte was read', () => {
  const f = fixture(new Uint8Array(4096)), original = fs.readSync;
  vi.spyOn(fs, 'readSync').mockImplementation(((fd: number, buffer: Uint8Array, offset: number, length: number, position: number | null) =>
    original(fd, buffer, offset, Math.min(1, length), position)) as typeof fs.readSync);
  const result = read(f.json);
  withdrawn(result);
  expect(result.reader).toMatchObject({ reads: 4096, bytes: 4096, EOF: false, closed: true, hashMatch: true });
});

test('original path replacement after bytes read cannot substitute a reopened descriptor', () => {
  const f = fixture(), original = fs.readSync;
  let replaced = false;
  vi.spyOn(fs, 'readSync').mockImplementation(((...args: Parameters<typeof fs.readSync>) => {
    const n = original(...args);
    if (!replaced && n > 0) {
      replaced = true;
      fs.renameSync(f.filename, f.filename + '.original');
      fs.writeFileSync(f.filename, f.bytes);
    }
    return n;
  }) as typeof fs.readSync);
  const open = vi.spyOn(fs, 'openSync'), result = read(f.json);
  withdrawn(result); expect(result.reader.closed).toBe(true);
  // The replacement write has its own open; only one read-only input descriptor is created.
  expect(open.mock.calls.filter(([, flags]) => typeof flags === 'number' && (flags & fs.constants.O_NOFOLLOW) !== 0)).toHaveLength(1);
});

test('private worker composition rejects forged and study-mode budgets before methods or I/O', () => {
  let calls = 0;
  const hostile = new Proxy({}, { get() { calls++; throw Error('hostile'); } });
  expect(() => readOwnedPaintTraceV12ForWorker('{}', OWNED_PAINT_V12_POLICY, hostile as OwnedPaintBudgetV12)).toThrow('invalid-owned-budget');
  expect(() => readOwnedPaintTraceV12ForWorker('{}', OWNED_PAINT_V12_POLICY, new OwnedPaintBudgetV12())).toThrow('invalid-owned-budget');
  expect(calls).toBe(0);
});

test('late custody refusal withdraws every matched paint and definition history', () => {
  const definition = (table: number, iid: bigint, value: string) => body(table, join(uint(1, iid), text(2, value)));
  const definitions = body(12, join(definition(1, 1n, 'loading'), definition(1, 2n, 'rail'), definition(1, 3n, 'devtools.timeline'),
    definition(2, 43n, 'firstMeaningfulPaint'), definition(3, 17n, 'frame'), definition(3, 18n, 'afterUserInput')));
  const paint = body(11, join(uint(3, 1n), uint(3, 2n), uint(3, 3n), uint(10, 43n), uint(11, 0n),
    body(4, join(uint(1, 17n), text(6, 'authored-frame'))), body(4, join(uint(1, 18n), uint(3, 1n))), body(6, uint(2, 82n))));
  const f = fixture(body(1, join(uint(10, 6n), uint(13, 1n), definitions, paint)));
  const healthy = read(f.json);
  expect(healthy.study?.paint).toHaveLength(1);
  expect(healthy.study?.state.definitions).toHaveLength(6);
  expect(Object.isFrozen(healthy)).toBe(true);
  withdrawn(read(JSON.stringify({ ...f.reference, sha256: '0'.repeat(64) })));
});

test('retained ancestor credit includes each full prefix rather than only final path length', () => {
  const shallow = fixture(), baseline = read(shallow.json);
  const nested = path.join(shallow.directory, ...Array.from({ length: 35 }, (_, i) => 'segment' + String(i).padStart(2, '0')));
  fs.mkdirSync(nested, { recursive: true });
  const filename = path.join(nested, 'deep.bin'); fs.writeFileSync(filename, shallow.bytes);
  const result = read(JSON.stringify({ ...shallow.reference, path: filename }));
  expect(result.fullInputVerified).toBe(true);
  const prefixes = (name: string) => [...name].reduce((sum, c, i) => sum + (i > 0 && c === '/' ? i : 0), 0);
  expect(result.usage.cumulative.allocatedUTF16Units - baseline.usage.cumulative.allocatedUTF16Units)
    .toBeGreaterThanOrEqual(prefixes(filename) - prefixes(shallow.filename));
});
