import {afterEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, unlink, open, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadComparisonMember, loadComparisonJson, loadComparisonJsonLines, type ComparisonMemberReference} from './comparison-load.js';

const owned: string[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const path of owned.splice(0)) await rm(path, {recursive: true, force: true});});

async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'chat-ui-bench-analysis-loader-')); owned.push(directory);
  const root = join(directory, 'dataset'); await mkdir(root);
  // Hand-authored bytes cross the 64KiB boundary inside a UTF8 scalar; no capture/parser oracle.
  const bytes = Buffer.from('{"text":"' + 'x'.repeat(65525) + '🙂"}\n');
  const relative = 'slot/validation.json'; await mkdir(join(root, 'slot'));
  await writeFile(join(root, relative), bytes);
  const reference: ComparisonMemberReference = {path: relative, role: 'slot-json', expected: {
    byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  }};
  return {directory, root, bytes, reference};
}

describe('comparison loader checked original-byte admission', () => {
  it('streams the complete declared regular member and retains its exact byte fact', async () => {
    const f = await fixture();
    expect(await loadComparisonMember(f.root, f.reference)).toEqual({
      status: 'verified-bytes', path: f.reference.path, fact: f.reference.expected, loadingIssues: [],
    });
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it.each(['root', 'ancestor', 'leaf'] as const)('rejects a %s symlink without changing original bytes', async kind => {
    const f = await fixture(); let root = f.root, reference = f.reference;
    if (kind === 'root') {root = join(f.directory, 'root-link'); await symlink(f.root, root);}
    if (kind === 'ancestor') {
      const parent = join(f.directory, 'parent'); await mkdir(parent);
      await symlink(f.root, join(parent, 'dataset'));
      root = join(f.directory, 'parent-link', 'dataset'); await symlink(parent, join(f.directory, 'parent-link'));
    }
    if (kind === 'leaf') {
      const outside = join(f.directory, 'outside.json'); await writeFile(outside, f.bytes);
      await symlink(outside, join(f.root, 'slot', 'leaf-link.json'));
      reference = {...reference, path: 'slot/leaf-link.json'};
    }
    const result = await loadComparisonMember(root, reference);
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/symlink|symbolic link/i)}));
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it('rejects a directory used as a declared regular file', async () => {
    const f = await fixture(); await mkdir(join(f.root, 'slot', 'directory.json'));
    const result = await loadComparisonMember(f.root, {...f.reference, path: 'slot/directory.json'});
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/regular file/i)}));
  });

  it.each(['../outside.json', '/outside.json', 'slot/../validation.json', 'slot//validation.json'])('rejects nonnormalized member %s', async path => {
    const f = await fixture(); const sentinel = join(f.directory, 'outside.json'); await writeFile(sentinel, 'outside sentinel');
    const result = await loadComparisonMember(f.root, {...f.reference, path});
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'membership', path: '.', reason: expect.stringMatching(/normalized relative/i)}));
    expect(await readFile(sentinel, 'utf8')).toBe('outside sentinel');
  });

  it('retains an integrity failure for a wrong declared digest without rewriting the file', async () => {
    const f = await fixture();
    const result = await loadComparisonMember(f.root, {...f.reference, expected: {...f.reference.expected, sha256: '0'.repeat(64)}});
    expect(result.status).toBe('failed');
    expect(result.fact).toEqual(f.reference.expected);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'integrity', reason: expect.stringMatching(/digest/i)}));
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it('rejects an incorrect declared byte length rather than accepting a prefix', async () => {
    const f = await fixture();
    const result = await loadComparisonMember(f.root, {...f.reference, expected: {...f.reference.expected, byteLength: f.bytes.length - 1}});
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'integrity', reason: expect.stringMatching(/length|size/i)}));
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it('reports genuine missing-member absence separately from unreadable bytes', async () => {
    const f = await fixture();
    const result = await loadComparisonMember(f.root, {...f.reference, path: 'slot/absent.json'});
    expect(result.status).toBe('failed'); expect(result.fact).toBeNull();
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'absent', path: 'slot/absent.json'}));
  });

  it('fails the slot JSON byte cap before allocating an oversized sparse member', async () => {
    const f = await fixture(), path = join(f.root, 'slot', 'oversized.json');
    const file = await open(path, 'wx'); try {await file.truncate(32 * 1024 * 1024 + 1);} finally {await file.close();}
    const result = await loadComparisonMember(f.root, {...f.reference, path: 'slot/oversized.json', expected: {byteLength: 32 * 1024 * 1024 + 1, sha256: '0'.repeat(64)}});
    expect(result.status).toBe('failed'); expect(result.fact).toBeNull();
    expect(result.loadingIssues).toContainEqual({kind: 'admission-limit', path: 'slot/oversized.json', role: 'slot-json',
      limitName: 'ordinaryJsonBytes', limit: 32 * 1024 * 1024, observed: 32 * 1024 * 1024 + 1,
      observation: 'exact', reason: expect.any(String)});
  });

  it.each([undefined, null, 0, false, ''] as const)('preserves original falsy read and close failures %#', async originalError => {
    const f = await fixture(), target = join(f.root, f.reference.path), originalOpen = fs.open.bind(fs);
    let readCalls = 0, closeCalls = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await originalOpen(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(original, key) {
        if (key === 'read') return async (buffer: Buffer, offset: number, length: number, position: number | null) => {
          const result = await original.read(buffer, offset, length, position); expect(result.bytesRead).toBeGreaterThan(0);
          readCalls++; throw originalError;
        };
        if (key === 'close') return async () => {await original.close(); closeCalls++; throw originalError;};
        const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
      }});
    });
    const result = await loadComparisonMember(f.root, f.reference);
    expect(result.status).toBe('failed'); if (result.status !== 'failed') throw new Error('Expected original IO failures');
    expect(result.fact).toBeNull(); expect([readCalls, closeCalls]).toEqual([1, 1]);
    expect(result.ioFailures?.map(row => row.operation)).toEqual(['read', 'close']);
    for (const row of result.ioFailures!) {expect(Object.hasOwn(row, 'error')).toBe(true); expect(row.error).toBe(originalError);}
    expect(result.loadingIssues).toHaveLength(2);
    expect(await readFile(target)).toEqual(f.bytes);
  });

  it('bounds UTF8 diagnostics while retaining both complete original errors', async () => {
    const f = await fixture(), target = join(f.root, f.reference.path), originalOpen = fs.open.bind(fs);
    const originalReadError = '🙂'.repeat(2048), originalCloseError = '😃'.repeat(2048);
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await originalOpen(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(original, key) {
        if (key === 'read') return async () => {throw originalReadError;};
        if (key === 'close') return async () => {await original.close(); throw originalCloseError;};
        const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
      }});
    });
    const result = await loadComparisonMember(f.root, f.reference);
    expect(result.status).toBe('failed'); if (result.status !== 'failed') throw new Error('Expected original IO failures');
    expect(result.ioFailures?.[0]?.error).toBe(originalReadError); expect(result.ioFailures?.[1]?.error).toBe(originalCloseError);
    for (const issue of result.loadingIssues) expect(Buffer.byteLength(issue.reason, 'utf8')).toBeLessThanOrEqual(4096);
  });

  it('detects original pathname substitution after descriptor close settles', async () => {
    const f = await fixture(), target = join(f.root, f.reference.path), originalOpen = fs.open.bind(fs); let closeCalls = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await originalOpen(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(original, key) {
        if (key === 'close') return async () => {
          const result = await original.close(); closeCalls++;
          await rename(target, target + '.retained'); await writeFile(target, 'new pathname bytes'); return result;
        };
        const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
      }});
    });
    const result = await loadComparisonMember(f.root, f.reference);
    expect(closeCalls).toBe(1); expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/pathname|identity/i)}));
    expect(await readFile(target + '.retained')).toEqual(f.bytes);
    expect(await readFile(target, 'utf8')).toBe('new pathname bytes');
  });

  it('classifies genuine pathname removal during checked reading as identity loss', async () => {
    const f = await fixture(), target = join(f.root, f.reference.path), originalOpen = fs.open.bind(fs);
    let readOccurred = false, removed = false, closeCalls = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await originalOpen(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(original, key) {
        if (key === 'read') return async (buffer: Buffer, offset: number, length: number, position: number | null) => {
          const result = await original.read(buffer, offset, length, position);
          if (result.bytesRead > 0) readOccurred = true; return result;
        };
        if (key === 'stat') return async (options: {bigint: true}) => {
          const result = await original.stat(options);
          if (readOccurred && !removed) {await unlink(target); removed = true;}
          return result;
        };
        if (key === 'close') return async () => {const result = await original.close(); closeCalls++; return result;};
        const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
      }});
    });
    const result = await loadComparisonMember(f.root, f.reference);
    expect([readOccurred, removed, closeCalls]).toEqual([true, true, 1]);
    expect(result.status).toBe('failed'); expect(result.fact).toBeNull();
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity'}));
    expect(result.loadingIssues.some(issue => issue.kind === 'absent')).toBe(false);
    await expect(readFile(target)).rejects.toMatchObject({code: 'ENOENT'});
  });

  it('keeps diagnostic UTF8 encoding bounded before allocating buffers', async () => {
    const f = await fixture(), target = join(f.root, f.reference.path), originalOpen = fs.open.bind(fs);
    const originalError = '🙂'.repeat(65536), encoding = vi.spyOn(Buffer, 'from');
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await originalOpen(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(original, key) {
        if (key === 'read') return async () => {throw originalError;};
        if (key === 'close') return async () => {await original.close(); throw originalError;};
        const value = Reflect.get(original, key); return typeof value === 'function' ? value.bind(original) : value;
      }});
    });
    const result = await loadComparisonMember(f.root, f.reference);
    expect(result.status).toBe('failed'); if (result.status !== 'failed') throw new Error('Expected original IO failures');
    expect(result.ioFailures?.[0]?.error).toBe(originalError); expect(result.ioFailures?.[1]?.error).toBe(originalError);
    const encodedStrings = encoding.mock.calls.map(args => args[0]).filter(value => typeof value === 'string');
    for (const value of encodedStrings) expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(4096);
    for (const issue of result.loadingIssues) expect(Buffer.byteLength(issue.reason, 'utf8')).toBeLessThanOrEqual(4096);
  });
});

async function jsonFixture(value: string | Buffer, role: ComparisonMemberReference['role'] = 'slot-json') {
  const f = await fixture(), bytes = typeof value === 'string' ? Buffer.from(value) : value;
  await writeFile(join(f.root, f.reference.path), bytes);
  return {...f, bytes, reference: {...f.reference, role, expected: {
    byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  }}};
}

describe('comparison loader streamed JSON admission', () => {
  it('keeps separate literal analyzer work and capture primitive-token arithmetic', async () => {
    const f = await jsonFixture('{"a":[null,true,"x"]}'), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected syntax admission');
    expect(result.value).toEqual({a: [null, true, 'x']});
    expect(result.admission).toEqual({byteLength: f.bytes.length, analyzerWorkUnits: 6, capturePrimitiveTokens: 10, maximumDepth: 2});
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it('decodes a scalar crossing a 64KiB UTF8 boundary without corrupting raw bytes', async () => {
    const f = await fixture(), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected syntax admission');
    expect(result.value).toEqual({text: 'x'.repeat(65525) + '🙂'});
    expect(result.admission).toMatchObject({analyzerWorkUnits: 3, capturePrimitiveTokens: 5, maximumDepth: 1});
  });

  it.each(['{"a":0,"\\u0061":1}', '{"nested":{"x":0,"x":1}}'])('rejects duplicate decoded keys %s', async input => {
    const f = await jsonFixture(input), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'malformed', reason: expect.stringMatching(/duplicate decoded key/i)}));
  });

  it.each(['[1,]', '{"a":}', '{"a":01}', 'true false', '1e309', '"unterminated'])('rejects strict grammar or nonfinite number %s', async input => {
    const f = await jsonFixture(input), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('failed'); expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'malformed'}));
  });

  it('rejects invalid UTF8 instead of replacement decoding', async () => {
    const f = await jsonFixture(Buffer.from([0x22, 0xc3, 0x28, 0x22])), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('failed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'malformed', reason: expect.stringMatching(/UTF8/i)}));
  });

  it('applies inclusive ordinary-JSON depth32 and rejects the first child at33', async () => {
    const allowed = await jsonFixture('['.repeat(32) + 'null' + ']'.repeat(32));
    const result = await loadComparisonJson(allowed.root, allowed.reference);
    expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected inclusive depth');
    expect(result.admission.maximumDepth).toBe(32);
    const rejected = await jsonFixture('['.repeat(33) + 'null' + ']'.repeat(33));
    const failure = await loadComparisonJson(rejected.root, rejected.reference);
    expect(failure.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonDepth', limit: 32, observed: 33}));
  });

  it('binds only the decoded top-level traceEvents array, not nested or string lookalikes', async () => {
    const f = await jsonFixture('{"note":"\\\"traceEvents\\\":[{}]","args":{"traceEvents":[1,2]},"trace\\u0045vents":[{},null]}', 'trace');
    const result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected trace grammar admission');
    expect(result.admission.traceEventCount).toBe(2);
    for (const text of ['[]', '{"args":{"traceEvents":[]}}', '{"traceEvents":{}}', '{"traceEvents":[],"trace\\u0045vents":[]}']) {
      const rejected = await jsonFixture(text, 'trace'), failure = await loadComparisonJson(rejected.root, rejected.reference);
      expect(failure.status).toBe('failed'); expect(failure.loadingIssues).toContainEqual(expect.objectContaining({kind: 'malformed'}));
    }
  });

  it('keeps escaped quotes and Unicode keys correct across native read chunks', async () => {
    const text = '{"value":"' + 'x'.repeat(65525) + '\\"tail"}';
    const f = await jsonFixture(text), result = await loadComparisonJson(f.root, f.reference);
    expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected split escape');
    expect(result.value).toEqual({value: 'x'.repeat(65525) + '"tail'});
    const key = 'k'.repeat(65530), duplicate = await jsonFixture('{"' + key + '\\u0061":0,"' + key + 'a":1}');
    expect((await loadComparisonJson(duplicate.root, duplicate.reference)).loadingIssues).toContainEqual(
      expect.objectContaining({kind: 'malformed', reason: expect.stringMatching(/duplicate decoded key/i)}));
    for (const input of ['{"\\uD83D\\uDE42":0,"🙂":1}', '{"\\uD800":0,"\\ud800":1}']) {
      const alias = await jsonFixture(input);
      expect((await loadComparisonJson(alias.root, alias.reference)).loadingIssues).toContainEqual(
        expect.objectContaining({kind: 'malformed', reason: expect.stringMatching(/duplicate decoded key/i)}));
    }
  });

  it.each([2097151, 2097152])('enforces ordinary JSON work at inclusive boundary %i', async count => {
    const input = '[' + 'null,'.repeat(count - 1) + 'null]', f = await jsonFixture(input), parse = vi.spyOn(JSON, 'parse');
    const result = await loadComparisonJson(f.root, f.reference);
    if (count === 2097151) {
      expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected inclusive work');
      expect(result.admission.analyzerWorkUnits).toBe(2097152); expect(result.value).toHaveLength(count);
    } else {
      expect(result.status).toBe('failed');
      expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonWorkUnits', limit: 2097152, observed: 2097153}));
      expect(parse.mock.calls.some(args => args[0] === input)).toBe(false);
    }
  });

  it.each([1048576, 1048577])('counts direct trace elements at inclusive boundary %i', async count => {
    // Serialized-element admission only; nulls are not claimed valid renderer trace events.
    const input = '{"traceEvents":[' + 'null,'.repeat(count - 1) + 'null]}', f = await jsonFixture(input, 'trace');
    const parse = vi.spyOn(JSON, 'parse'), result = await loadComparisonJson(f.root, f.reference);
    if (count === 1048576) {
      expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected inclusive event count');
      expect(result.admission.traceEventCount).toBe(1048576);
    } else {
      expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'traceEvents', limit: 1048576, observed: 1048577}));
      expect(parse.mock.calls.some(args => args[0] === input)).toBe(false);
    }
  });

  it.each([63, 64])('applies the separate trace depth64 limit with %i nested arrays', async count => {
    const f = await jsonFixture('{"traceEvents":[],"deep":' + '['.repeat(count) + 'null' + ']'.repeat(count) + '}', 'trace');
    const result = await loadComparisonJson(f.root, f.reference);
    if (count === 63) {
      expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('Expected trace depth');
      expect(result.admission.maximumDepth).toBe(64);
    } else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonDepth', limit: 64, observed: 65}));
  });
});

describe('comparison loader streamed JSONL admission', () => {
  it('retains each complete record and distinguishes empty present files from absence', async () => {
    const f = await jsonFixture('{"a":[null,true,"x"]}\n{"line":"escaped\\ntext"}\n', 'jsonl');
    const result = await loadComparisonJsonLines(f.root, f.reference);
    expect(result.status).toBe('admitted-jsonl'); if (result.status !== 'admitted-jsonl') throw new Error('Expected record admission');
    expect(result.records).toEqual([{a: [null, true, 'x']}, {line: 'escaped\ntext'}]);
    expect(result.admission[0]).toMatchObject({analyzerWorkUnits: 6, capturePrimitiveTokens: 10, maximumDepth: 2});
    const empty = await jsonFixture('', 'jsonl'), emptyResult = await loadComparisonJsonLines(empty.root, empty.reference);
    expect(emptyResult.status).toBe('admitted-jsonl'); if (emptyResult.status !== 'admitted-jsonl') throw new Error('Expected empty present journal');
    expect(emptyResult.records).toEqual([]); expect(emptyResult.fact.byteLength).toBe(0);
  });

  it.each(['{}', '{}\n\n{}\n', '{}\n{bad}\n', '{}\r\n'])('does not drop partial, empty, malformed or CR lines %s', async input => {
    const f = await jsonFixture(input, 'jsonl'), result = await loadComparisonJsonLines(f.root, f.reference);
    expect(result.status).toBe('failed'); expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'malformed'}));
    expect(await readFile(join(f.root, f.reference.path))).toEqual(f.bytes);
  });

  it('admits CPT65536 inclusively and rejects CPT65537 despite AWU65536', async () => {
    const allowed = await jsonFixture('[' + Array(65534).fill('null').join(',') + ']\n', 'jsonl');
    const result = await loadComparisonJsonLines(allowed.root, allowed.reference);
    expect(result.status).toBe('admitted-jsonl'); if (result.status !== 'admitted-jsonl') throw new Error('Expected inclusive record tokens');
    expect(result.admission[0]).toMatchObject({analyzerWorkUnits: 65535, capturePrimitiveTokens: 65536});
    const rejected = await jsonFixture('[' + Array(65535).fill('null').join(',') + ']\n', 'jsonl');
    const failure = await loadComparisonJsonLines(rejected.root, rejected.reference);
    expect(failure.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'capturePrimitiveTokens', limit: 65536, observed: 65537}));
  });

  it.each([4194304, 4194305])('counts JSONL record bytes excluding LF at boundary %i', async count => {
    const f = await jsonFixture('"' + 'x'.repeat(count - 2) + '"\n', 'jsonl'), result = await loadComparisonJsonLines(f.root, f.reference);
    if (count === 4194304) {
      expect(result.status).toBe('admitted-jsonl'); if (result.status !== 'admitted-jsonl') throw new Error('Expected inclusive record bytes');
      expect(result.admission[0]?.byteLength).toBe(count); expect(result.fact.byteLength).toBe(count + 1);
    } else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonlRecordBytes', limit: 4194304, observed: 4194305}));
  });

  it.each([131072, 131073])('applies the inclusive per-file journal record bound %i', async count => {
    const f = await jsonFixture('{}\n'.repeat(count), 'jsonl'), result = await loadComparisonJsonLines(f.root, f.reference);
    if (count === 131072) {
      expect(result.status).toBe('admitted-jsonl'); if (result.status !== 'admitted-jsonl') throw new Error('Expected inclusive record count');
      expect(result.records).toHaveLength(count); expect(result.admission).toHaveLength(count); expect(result.fact.byteLength).toBe(3 * count);
    } else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonlRecords', limit: 131072, observed: 131073}));
  });
});
