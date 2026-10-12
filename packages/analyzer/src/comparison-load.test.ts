import {afterEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, unlink, open, writeFile, link} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadComparisonMember, loadComparisonJson, loadComparisonJsonLines, loadComparisonInvocation, type ComparisonMemberReference} from './comparison-load.js';
import {longThreadCaseOrder, createLongThreadMatrix, comparisonManifestSchema, comparisonDatasetInventorySchema} from '@chat-ui-bench/contract';

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

describe('comparison loader physical membership', () => {
  const temporary = (index: number) => 'invocation.json.00000000-0000-4000-8000-' + index.toString(16).padStart(12, '0') + '.tmp';
  it('enumerates only the declared physical slots with incremental directory reads', async () => {
    const f = await rootFixture(), readdir = vi.spyOn(fs, 'readdir'), result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.status).toBe('complete'); expect(result.physicalInventory.files).toHaveLength(14);
    expect(result.physicalInventory.files.map(file => file.path)).toContain('invocation.json');
    expect(result.physicalInventory.candidates.root).toBe(2); expect(result.physicalInventory.candidates.slots).toHaveLength(12);
    expect(readdir).not.toHaveBeenCalled();
  });
  it.each(['metrics.json', 'unknown-directory'])('reports unknown root %s without opening its payload/tree', async name => {
    const f = await rootFixture(); if (name === 'metrics.json') await writeFile(join(f.root, name), 'untrusted bytes'); else {await mkdir(join(f.root, name)); await writeFile(join(f.root, name, 'payload'), 'outside');}
    const original = fs.open.bind(fs), opened: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'membership', path: name}));
    expect(opened.some(path => path.includes(name))).toBe(false);
    expect(result.physicalInventory.files.some(file => file.path.includes(name))).toBe(false);
  });
  it('excludes only exact regular derived locations and retains raw temporary names', async () => {
    const f = await rootFixture(); await writeFile(join(f.root, 'comparison-results.json'), '{}'); await writeFile(join(f.root, 'comparison-summary.md'), 'summary');
    await writeFile(join(f.root, f.runs[0]!.artifactDirectory, 'results.json'), '{}'); await writeFile(join(f.root, temporary(1)), 'partial original bytes');
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.files.some(file => file.path.endsWith('results.json'))).toBe(false);
    expect(result.physicalInventory.files).toContainEqual(expect.objectContaining({path: temporary(1), role: 'temporary', byteLength: 22}));
    expect(result.physicalInventory.candidates.root).toBe(3);
  });
  it('rejects a hardlink alias between two distinct admitted original paths', async () => {
    const f = await rootFixture(); await link(join(f.root, 'invocation.json'), join(f.root, temporary(1)));
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/hardlink/i)}));
  });
  it.each(['symlink', 'directory'])('rejects a %s at an admitted temporary leaf', async kind => {
    const f = await rootFixture(), path = join(f.root, temporary(1));
    if (kind === 'symlink') await symlink(join(f.root, 'invocation.json'), path); else await mkdir(path);
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', path: temporary(1)}));
  });
  it.each([16, 17])('counts seal within inclusive root capacity %i', async count => {
    const f = await rootFixture(); await writeFile(join(f.root, 'dataset-seal.json'), '{}');
    for (let index = 0; index < count - 3; index++) await writeFile(join(f.root, temporary(index)), '');
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.candidates.root).toBe(count);
    if (count === 16) expect(result.physicalInventory.status).toBe('complete');
    else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'rootCandidates', limit: 16, observed: 17}));
  });
  it.each([4096, 4097])('counts actual slot temporary candidates at inclusive capacity %i', async count => {
    const f = await rootFixture(), slot = f.runs[0]!.artifactDirectory;
    for (let offset = 0; offset < count - 1; offset += 32) await Promise.all(Array.from({length: Math.min(32, count - 1 - offset)}, (_, index) =>
      writeFile(join(f.root, slot, temporary(offset + index).replace('invocation.json.', 'page.jsonl.')), '')));
    const result = await loadComparisonInvocation(f.root), observed = result.physicalInventory.candidates.slots.find(row => row.path === slot)!;
    expect(observed.count).toBe(count);
    if (count === 4096) expect(result.physicalInventory.status).toBe('complete');
    else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'slotCandidates', limit: 4096, observed: 4097}));
  }, 20000);
  it('detects own directory membership changes after its original close without consuming the new payload', async () => {
    const f = await rootFixture(), original = fs.opendir.bind(fs); let mutated = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || mutated) return dir;
      return new Proxy(dir, {get(target, key) {if (key === 'close') return async () => {await target.close(); mutated = true; await writeFile(join(f.root, 'changed-membership'), 'not consumed');};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    const result = await loadComparisonInvocation(f.root);
    expect(mutated).toBe(true); expect(result.physicalInventory.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/directory membership changed/i)}));
  });
  it('permits unrelated shared ancestor sibling creation during physical inspection', async () => {
    const f = await rootFixture(), original = fs.opendir.bind(fs); let changed = false;
    const sibling = f.root + '-unrelated'; owned.push(sibling);
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || changed) return dir;
      return new Proxy(dir, {get(target, key) {if (key === 'close') return async () => {await target.close(); changed = true; await mkdir(sibling);};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    expect((await loadComparisonInvocation(f.root)).physicalInventory.status).toBe('complete'); expect(changed).toBe(true);
  });
  it('detects regular file substitution after the original directory enumeration', async () => {
    const f = await rootFixture(), original = fs.opendir.bind(fs), leaf = join(f.root, temporary(1)); await writeFile(leaf, 'original'); let replaced = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || replaced) return dir;
      return new Proxy(dir, {get(target, key) {if (key === 'close') return async () => {await target.close(); replaced = true; await unlink(leaf); await writeFile(leaf, 'replacement');};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    const result = await loadComparisonInvocation(f.root); expect(replaced).toBe(true); expect(result.physicalInventory.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/regular file identity changed/i)}));
  });
  it('rechecks owned directory identity after the final original enumeration closes', async () => {
    const f = await rootFixture(), original = fs.opendir.bind(fs), retained = f.root + '-retained'; owned.push(retained); let closes = 0;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root) return dir;
      return new Proxy(dir, {get(target, key) {if (key === 'close') return async () => {await target.close(); if (++closes === 2) {await rename(f.root, retained); await mkdir(f.root);}};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    const result = await loadComparisonInvocation(f.root); expect(closes).toBe(2);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', reason: expect.stringMatching(/directory identity changed during final enumeration/i)}));
  });
  it.each([undefined, null, false, 0, ''])('preserves original directory read/close failures %j independently', async originalError => {
    const f = await rootFixture(), original = fs.opendir.bind(fs); let intercepted = false, readCalls = 0, closeCalls = 0;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || intercepted) return dir; intercepted = true;
      return new Proxy(dir, {get(target, key) {
        if (key === 'read') return async () => {expect(await target.read()).not.toBeNull(); readCalls++; throw originalError;};
        if (key === 'close') return async () => {await target.close(); closeCalls++; throw originalError;};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root);
    expect([readCalls, closeCalls]).toEqual([1, 1]); expect(result.physicalInventory.status).toBe('partial');
    expect(result.physicalInventory.ioFailures.map(row => row.operation)).toEqual(['directory-read', 'directory-close']);
    for (const failure of result.physicalInventory.ioFailures) {expect(Object.hasOwn(failure, 'error')).toBe(true); expect(failure.error).toBe(originalError);}
  });
  it.each([undefined, null, false, 0, ''])('preserves exact original outer final-directory stat failure %j', async originalError => {
    const f = await rootFixture(), originalStat = fs.lstat.bind(fs), originalDirectory = fs.opendir.bind(fs); let physical = false, rejected = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {physical = true; return originalDirectory(...args);});
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      const stat = await originalStat(...args); if (physical && String(args[0]) === f.root && !rejected) {rejected = true; throw originalError;} return stat;
    });
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true);
    const failure = result.physicalInventory.ioFailures.find(row => row.operation === 'path-stat' && row.path === '.');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it.each([undefined, null, false, 0, ''])('preserves exact original final-file stat failure %j', async originalError => {
    const f = await rootFixture(), name = temporary(2), target = join(f.root, name); await writeFile(target, 'retained');
    const original = fs.lstat.bind(fs); let calls = 0;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {const stat = await original(...args); if (String(args[0]) === target && ++calls === 2) throw originalError; return stat;});
    const result = await loadComparisonInvocation(f.root); expect(calls).toBe(2);
    const failure = result.physicalInventory.ioFailures.find(row => row.operation === 'path-stat' && row.path === name);
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it('admits a genuine writer UUIDv4 temporary but rejects the broad-contract hyphen suffix', async () => {
    const f = await rootFixture(), actual = 'invocation.json.' + randomUUID() + '.tmp', unknown = 'invocation.json.' + '-'.repeat(36) + '.tmp';
    await writeFile(join(f.root, actual), ''); await writeFile(join(f.root, unknown), '');
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.files).toContainEqual(expect.objectContaining({path: actual, role: 'temporary'}));
    expect(result.physicalInventory.files.some(file => file.path === unknown)).toBe(false);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'membership', path: unknown}));
  });
  it('retains bounded truthful unknown type/size metadata without consuming payloads or trees', async () => {
    const f = await rootFixture(); await writeFile(join(f.root, 'unknown-file'), 'not consumed'); await mkdir(join(f.root, 'unknown-tree'));
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory).toHaveProperty('unknownEntries');
    expect(result.physicalInventory.unknownEntries).toContainEqual(expect.objectContaining({path: 'unknown-file', type: 'file', byteLength: 12}));
    expect(result.physicalInventory.unknownEntries).toContainEqual(expect.objectContaining({path: 'unknown-tree', type: 'directory', byteLength: null}));
  });
  it('counts only genuinely observed omitted unknown metadata after the fixed32 diagnostics', async () => {
    const f = await rootFixture(); for (let index = 0; index < 36; index++) await writeFile(join(f.root, 'unknown-' + index), '');
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.unknownEntries).toHaveLength(32); expect(result.physicalInventory.additionalUnknownEntryCount).toBe(4);
    expect(result.physicalInventory.unknownEntries.every(entry => entry.type === 'file' && entry.byteLength === 0)).toBe(true);
  });
  it('retains actual unknown stat failure path/error with unavailable metadata rather than inventing a size', async () => {
    const f = await rootFixture(), target = join(f.root, 'unknown-stat'); await writeFile(target, 'original');
    const original = fs.lstat.bind(fs), error = false;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {const stat = await original(...args); if (String(args[0]) === target) throw error; return stat;});
    const result = await loadComparisonInvocation(f.root);
    expect(result.physicalInventory.unknownEntries).toContainEqual(expect.objectContaining({path: 'unknown-stat', type: 'unavailable', byteLength: null}));
    const failure = result.physicalInventory.ioFailures.find(row => row.path === 'unknown-stat'); expect(failure?.operation).toBe('path-stat'); expect(failure?.error).toBe(error);
    expect(result.physicalInventory.ioFailures.filter(row => row.path === 'unknown-stat')).toHaveLength(1);
  });
});

async function rootFixture(rounds = 1, mode = 'headless') {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'chat-ui-bench-analysis-root-')); owned.push(root);
  const versions = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: '2.0.0', analyzerVersion: '2.0.0'};
  const configuration = {schemaVersion: 2, suite: 'long-thread-prose-v1', seed: 1, rounds, adapterProfiles: ['threadplane-langgraph-custom-transport'], caseOrder: longThreadCaseOrder(1), mode, deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}};
  const createdAt = '2026-10-10T00:00:00.000Z';
  const runs = Array.from({length: rounds}, (_, index) => index + 1).flatMap(round => configuration.caseOrder.map((scenarioId, caseIndex) => ({round, caseIndex, scenarioId, adapterProfile: configuration.adapterProfiles[0], repetition: `${round}-${caseIndex}-0`, artifactDirectory: `runs/round-${round}/case-${caseIndex}/profile-0`, status: 'failed', reasons: ['not started']})));
  const purpose = mode === 'headed' ? 'publication' : 'conformance';
  const ledger = {...versions, createdAt, purpose, status: 'failed', configuration, runs};
  const claim = {...versions, kind: 'invocation-ownership-claim', invocationId: '46dcd970-87f8-4d58-b9c1-490a5d9b9c05', createdAt, purpose, configuration};
  const json = async (path: string, value: unknown) => {await mkdir(join(root, path, '..'), {recursive: true}); await writeFile(join(root, path), JSON.stringify(value));};
  await json('invocation.json', ledger); await json('invocation-claim.json', claim);
  for (const row of runs) await json(row.artifactDirectory + '/descriptor.json', {...versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile, seed: 1, mode, artifactDirectory: row.artifactDirectory});
  return {root, versions, ledger, claim, runs, json};
}
async function byteFixture(rounds = 1) {
  const f = await rootFixture(rounds);
  for (const row of f.runs) {
    const identity = {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile};
    await f.json(row.artifactDirectory + '/validation.json', {...identity, status: 'failed', reasons: ['not started'], checks: [{name: 'acquisition', passed: false, reason: 'not started', evidencePaths: ['descriptor.json']}]});
    await f.json(row.artifactDirectory + '/exceptions.json', {...identity, exceptions: []});
    await f.json(row.artifactDirectory + '/raw-inventory.json', {...identity, status: 'partial', reason: 'not started', files: []});
  }
  const paths = ['invocation-claim.json', 'invocation.json', ...f.runs.flatMap(row => ['descriptor.json', 'validation.json', 'exceptions.json', 'raw-inventory.json'].map(name => row.artifactDirectory + '/' + name))].sort();
  const members = await Promise.all(paths.map(async path => {const bytes = await readFile(join(f.root, path)); return {path, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};}));
  const directories = [...new Set(f.runs.flatMap(row => row.artifactDirectory.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))))].sort();
  const seal = comparisonDatasetInventorySchema.parse({...f.versions, invocationId: f.claim.invocationId, status: 'sealed', configuration: f.ledger.configuration, invocationClaim: f.claim, invocationLedger: f.ledger, root: '.', ledger: members.find(row => row.path === 'invocation.json'), members, absentMembers: [], directories,
    slots: f.runs.map(row => ({identity: {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile}, artifactDirectory: row.artifactDirectory, status: 'failed'})), ownershipSettled: true, finalizationSucceeded: true});
  await f.json('dataset-seal.json', seal);
  return {...f, members, seal, async total() {let total = 0; for (const path of [...paths, 'dataset-seal.json']) total += (await fs.lstat(join(f.root, path))).size; return total;}};
}
describe('comparison loader aggregate owned bytes', () => {
  it('hashes the complete known raw graph and counts the original seal exactly once', async () => {
    const f = await byteFixture(), result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.status).toBe('complete'); expect(result.byteIntegrity.admission).toBe('within-limit');
    expect(result.byteIntegrity.observedUniqueBytes).toBe(await f.total()); expect(result.byteIntegrity.files).toHaveLength(51);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.collection.status).toBe('partial');
    expect(result.byteIntegrity.files.filter(row => row.path === 'dataset-seal.json')).toHaveLength(1);
  });
  it('fails an actual changed original member against the original seal hash and preserves its bytes', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/exceptions.json', bytes = Buffer.from('changed original'); await writeFile(join(f.root, path), bytes);
    const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.status).toBe('partial'); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'integrity', path})); expect(await readFile(join(f.root, path))).toEqual(bytes);
  });
  it('fails an extra admitted raw file absent from the sealed member set instead of ignoring it', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/fixture.json'; await writeFile(join(f.root, path), '{}');
    const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('partial'); expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'membership', path}));
  });
  it('retains all original36 failed rows and exact original byte accounting', async () => {
    const f = await byteFixture(3), result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(36); expect(result.byteIntegrity.status).toBe('complete'); expect(result.byteIntegrity.observedUniqueBytes).toBe(await f.total());
    expect(result.runs.every(row => row.captureValidation?.status === 'failed')).toBe(true);
  });
  it.each([0, 1])('preflights real sparse invocation bytes at fixed16GiB plus %i before any large payload read', async extra => {
    const f = await byteFixture(), path = 'invocation.json.00000000-0000-4000-8000-000000000001.tmp', target = join(f.root, path);
    const limit = 16 * 1024 * 1024 * 1024, size = limit - await f.total() + extra;
    const sparse = await open(target, 'wx'); try {await sparse.truncate(size);} finally {await sparse.close();}
    const original = fs.open.bind(fs), originalError = false; let payloadReads = 0, ownedCloses = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {
          payloadReads++; await handle.read(...parameters); throw originalError;
        };
        if (key === 'close') return async () => {ownedCloses++; return handle.close();};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.observedUniqueBytes).toBe(limit + extra); expect(result.byteIntegrity.status).toBe('partial');
    expect(result.byteIntegrity.admission).toBe(extra ? 'exceeded' : 'within-limit');
    expect(payloadReads).toBe(extra ? 0 : 1); expect(ownedCloses).toBe(extra ? 1 : 2);
    if (extra) expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'invocationUniqueBytes', limit, observed: limit + 1}));
    else expect(result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'read')?.error).toBe(originalError);
  });
  it('preserves a genuine falsy preflight close rejection and never reports successful byte closure', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/raw-inventory.json', target = join(f.root, path), original = fs.open.bind(fs); let rejected = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== target || rejected) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); rejected = true; throw 0;};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root);
    expect(rejected).toBe(true); expect(result.byteIntegrity.admission).toBe('unavailable'); expect(result.byteIntegrity.seal).not.toBe('byte-closed');
    expect(result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'close')?.error).toBe(0);
  });
  it('counts original observed bootstrap bytes even when a readable version pair rejects the root', async () => {
    const f = await rootFixture(); await f.json('invocation.json', {...f.ledger, collectorVersion: '9.0.0'});
    const expected = (await fs.lstat(join(f.root, 'invocation.json'))).size + (await fs.lstat(join(f.root, 'invocation-claim.json'))).size;
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.observedUniqueBytes).toBe(expected);
    expect(result.byteIntegrity.files).toHaveLength(2); expect(result.family).toBeNull();
  });
  it('checks the original digest even when changed bytes retain the declared length', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/raw-inventory.json', bytes = await readFile(join(f.root, path));
    const changed = Buffer.from(bytes); changed[changed.indexOf('not started')] = 'N'.charCodeAt(0); await writeFile(join(f.root, path), changed);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: 'Original digest differs from declared digest'}));
    expect(await readFile(join(f.root, path))).toEqual(changed);
  });
  it('rejects a genuinely missing declared member while retaining all original rows', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/raw-inventory.json'; await unlink(join(f.root, path));
    const result = await loadComparisonInvocation(f.root); expect(result.runs).toHaveLength(12); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'membership', path, reason: 'Declared seal member is physically absent'}));
  });
  it('distinguishes actual empty original bytes from an explicitly absent candidate', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/fixture.json';
    const seal = comparisonDatasetInventorySchema.parse({...f.seal, absentMembers: [{path, reason: 'never started'}]}); await f.json('dataset-seal.json', seal);
    const absent = await loadComparisonInvocation(f.root); expect(absent.byteIntegrity.seal).toBe('byte-closed'); expect(absent.byteIntegrity.files.some(row => row.path === path)).toBe(false);
    await writeFile(join(f.root, path), ''); const present = await loadComparisonInvocation(f.root);
    expect(present.byteIntegrity.seal).not.toBe('byte-closed'); expect(present.physicalInventory.files).toContainEqual(expect.objectContaining({path, byteLength: 0}));
    expect(present.loadingIssues).toContainEqual(expect.objectContaining({path, reason: 'Explicitly absent raw candidate is physically present'}));
  });
  it('includes an actual retained seal temporary in the root capacity and byte count without declaring publication closure', async () => {
    const f = await byteFixture(), path = 'dataset-seal.json.00000000-0000-4000-8000-000000000001.tmp'; await writeFile(join(f.root, path), '');
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.admission).toBe('within-limit'); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.byteIntegrity.files).toContainEqual({path, fact: {byteLength: 0, sha256: createHash('sha256').digest('hex')}});
    expect(result.physicalInventory.candidates.root).toBe(4); expect(result.byteIntegrity.observedUniqueBytes).toBe(await f.total());
  });
  it('never upgrades a genuine bootstrap close failure after later successful descriptor reads', async () => {
    const f = await byteFixture(), path = 'invocation-claim.json', original = fs.open.bind(fs); let rejected = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== join(f.root, path) || rejected) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); rejected = true; throw undefined;};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true); expect(result.byteIntegrity.status).toBe('partial'); expect(result.root.claim.value).toBeNull();
    const failure = result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'close');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBeUndefined();
  });
  it('retains all36 diagnostic rows after aggregate overflow and performs no manifest payload reads', async () => {
    const f = await byteFixture(3), path = 'invocation.json.00000000-0000-4000-8000-000000000001.tmp';
    const sparse = await open(join(f.root, path), 'wx'); try {await sparse.truncate(16 * 1024 * 1024 * 1024);} finally {await sparse.close();}
    const original = fs.open.bind(fs), opened: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.admission).toBe('exceeded'); expect(result.runs).toHaveLength(36);
    expect(result.runs.every(row => row.descriptor !== null && row.captureValidation?.status === 'failed')).toBe(true);
    expect(result.runs.every(row => row.rawAvailability.manifest.status === 'unreadable')).toBe(true);
    expect(opened.some(path => path.endsWith('/manifest.json'))).toBe(false);
    expect(result.byteIntegrity.files.filter(row => row.path.endsWith('/descriptor.json') || row.path.endsWith('/validation.json') || row.path.endsWith('/exceptions.json')).length).toBe(108);
  });
  it('rejects a newly observed non-diagnostic original before payload allocation when it crosses the admitted aggregate', async () => {
    const f = await byteFixture(), temporary = join(f.root, 'invocation.json.00000000-0000-4000-8000-000000000001.tmp');
    const sparse = await open(temporary, 'wx'); try {await sparse.truncate(16 * 1024 * 1024 * 1024 - await f.total());} finally {await sparse.close();}
    const descriptor = join(f.root, f.runs[0]!.artifactDirectory, 'descriptor.json'), manifest = join(f.root, f.runs[0]!.artifactDirectory, 'manifest.json');
    const original = fs.open.bind(fs); let descriptorCloses = 0, manifestReads = 0, largeReads = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args), path = String(args[0]); if (![descriptor, manifest, temporary].includes(path)) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); if (path === descriptor && ++descriptorCloses === 2) await writeFile(manifest, '{}');};
        if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {
          if (path === manifest) manifestReads++; if (path === temporary) {largeReads++; await handle.read(...parameters); throw 'bounded sparse read';}
          return handle.read(...parameters);
        };
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root);
    expect(manifestReads).toBe(0); expect(largeReads).toBe(0); expect(result.byteIntegrity.admission).toBe('exceeded'); expect(descriptorCloses).toBe(2);
    expect(result.byteIntegrity.observedUniqueBytes).toBe(16 * 1024 * 1024 * 1024 + 2); expect(result.runs).toHaveLength(12);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: f.runs[0]!.artifactDirectory + '/manifest.json', limitName: 'invocationUniqueBytes'}));
  });
  it('rejects original file replacement between preflight and the owned payload read', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/exceptions.json', target = join(f.root, path), descriptor = join(f.root, f.runs[0]!.artifactDirectory, 'descriptor.json');
    const replacement = join(f.root, '..', 'replacement.json'), bytes = await readFile(target); await writeFile(replacement, bytes);
    const original = fs.open.bind(fs); let closes = 0, replaced = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== descriptor) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); if (++closes === 2) {await rename(replacement, target); replaced = true;}};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(replaced).toBe(true); expect(result.byteIntegrity.status).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', path, reason: 'Original member identity changed between owned reads'}));
    expect(await readFile(target)).toEqual(bytes);
  });
  it.each([undefined, null, false, 0, ''])('retains the exact original final membership close failure %j', async originalError => {
    const f = await byteFixture(), original = fs.opendir.bind(fs); let rootOpens = 0, rejected = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || ++rootOpens !== 3) return dir;
      return new Proxy(dir, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); rejected = true; throw originalError;};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true); expect(result.byteIntegrity.status).toBe('partial');
    const failure = result.physicalInventory.ioFailures.find(row => row.operation === 'directory-close' && row.path === '.');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it.each([undefined, null, false, 0, ''])('retains known aggregate crossing and original falsy metadata-close failure %j together', async originalError => {
    const f = await byteFixture(), path = 'invocation.json.00000000-0000-4000-8000-000000000001.tmp', target = join(f.root, path);
    const limit = 16 * 1024 * 1024 * 1024, sparse = await open(target, 'wx'); try {await sparse.truncate(limit);} finally {await sparse.close();}
    const original = fs.open.bind(fs); let closes = 0, payloadReads = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== target) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); closes++; throw originalError;};
        if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {payloadReads++; return handle.read(...parameters);};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root);
    expect(closes).toBe(1); expect(payloadReads).toBe(0);
    expect(result.byteIntegrity.admission).toBe('exceeded'); expect(result.byteIntegrity.status).toBe('partial'); expect(result.runs).toHaveLength(12);
    let rootBytes = 0, diagnosticBytes = 0;
    for (const name of ['dataset-seal.json', 'invocation-claim.json', 'invocation.json']) rootBytes += (await fs.lstat(join(f.root, name))).size;
    for (const row of f.runs) for (const name of ['descriptor.json', 'validation.json', 'exceptions.json']) diagnosticBytes += (await fs.lstat(join(f.root, row.artifactDirectory, name))).size;
    expect(result.byteIntegrity.observedUniqueBytes).toBe(limit + rootBytes + diagnosticBytes);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path, limitName: 'invocationUniqueBytes', limit, observed: limit + rootBytes}));
    const failure = result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'close');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it.each([undefined, null, false, 0, '', Object.assign(new Error('Controlled original absence lookup denied'), {code: 'EACCES'})])('requires actual absent lookup and preserves original non-ENOENT failure %j', async originalError => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/fixture.json', target = join(f.root, path);
    await f.json('dataset-seal.json', comparisonDatasetInventorySchema.parse({...f.seal, absentMembers: [{path, reason: 'never started'}]}));
    const original = fs.lstat.bind(fs); let lookups = 0;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      if (String(args[0]) !== target) return original(...args);
      try {await original(...args);} catch (error) {expect(error).toMatchObject({code: 'ENOENT'}); lookups++; throw originalError;}
      throw new Error('Controlled missing fixture unexpectedly exists');
    });
    const result = await loadComparisonInvocation(f.root); expect(lookups).toBeGreaterThan(0); expect(result.byteIntegrity.seal).toBe('partial');
    const failure = result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'path-stat');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path, kind: 'unreadable'}));
    expect(result.byteIntegrity.files.some(row => row.path === path)).toBe(false);
  });
  it('verifies the actual missing leaf even when its declared ancestor is genuinely absent', async () => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/provenance/source/missing/package.json', target = join(f.root, path);
    await f.json('dataset-seal.json', comparisonDatasetInventorySchema.parse({...f.seal, absentMembers: [{path, reason: 'not acquired'}]}));
    const original = fs.lstat.bind(fs), originalOpen = fs.open.bind(fs); let nativeLeafMisses = 0, targetOpens = 0;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      try {return await original(...args);} catch (error) {if (String(args[0]) === target) {expect(error).toMatchObject({code: 'ENOENT'}); nativeLeafMisses++;} throw error;}
    });
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {if (String(args[0]) === target) targetOpens++; return originalOpen(...args);});
    const result = await loadComparisonInvocation(f.root); expect(nativeLeafMisses).toBe(2); expect(targetOpens).toBe(0); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.byteIntegrity.observedUniqueBytes).toBe(await f.total()); expect(result.byteIntegrity.files.some(row => row.path === path)).toBe(false);
  });
  it.each(['empty', 'directory', 'symlink'] as const)('rejects a %s appearing at the actual declared-absence lookup without reading or charging it', async kind => {
    const f = await byteFixture(), path = f.runs[0]!.artifactDirectory + '/fixture.json', target = join(f.root, path);
    await f.json('dataset-seal.json', comparisonDatasetInventorySchema.parse({...f.seal, absentMembers: [{path, reason: 'never started'}]}));
    const original = fs.lstat.bind(fs), originalOpen = fs.open.bind(fs); let appeared = false, targetOpens = 0;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      if (String(args[0]) !== target || appeared) return original(...args);
      try {await original(...args);} catch (error) {expect(error).toMatchObject({code: 'ENOENT'}); appeared = true;
        if (kind === 'empty') await writeFile(target, ''); else if (kind === 'directory') await mkdir(target); else await symlink(join(f.root, 'invocation.json'), target);
        return original(...args);
      }
      throw new Error('Controlled absence unexpectedly present');
    });
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {if (String(args[0]) === target) targetOpens++; return originalOpen(...args);});
    const result = await loadComparisonInvocation(f.root); expect(appeared).toBe(true); expect(targetOpens).toBe(0); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path, kind: 'membership', reason: 'Declared absent pathname is physically present'}));
    expect(result.byteIntegrity.files.some(row => row.path === path)).toBe(false);
  });
  it('rejects ancestor replacement between genuine declared-absence lookups', async () => {
    const f = await byteFixture(), slot = f.runs[0]!.artifactDirectory, path = slot + '/fixture.json', target = join(f.root, path), retained = f.root + '-retained-slot'; owned.push(retained);
    await f.json('dataset-seal.json', comparisonDatasetInventorySchema.parse({...f.seal, absentMembers: [{path, reason: 'never started'}]}));
    const original = fs.lstat.bind(fs); let replaced = false;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      try {return await original(...args);} catch (error) {
        if (String(args[0]) === target && !replaced) {expect(error).toMatchObject({code: 'ENOENT'}); await rename(join(f.root, slot), retained); await mkdir(join(f.root, slot)); replaced = true;}
        throw error;
      }
    });
    const result = await loadComparisonInvocation(f.root); expect(replaced).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path, kind: 'identity', reason: 'Declared absent ancestor identity changed during pathname lookup'}));
  });
});
describe('comparison loader bounded root bootstrap', () => {
  it('retains every actual terminal ledger row when the seal and manifests are absent', async () => {
    const f = await rootFixture(), result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
    expect(result.scheduled).toBe(12); expect(result.runs).toHaveLength(12);
    expect(result.runs.map(r => r.identity.repetition)).toEqual(f.runs.map(r => r.repetition));
    expect(result.runs[0]!.descriptor).not.toBeNull(); expect(result.runs[0]!.manifest).toBeNull();
    expect(result.runs[0]!.rawAvailability.manifest.status).toBe('absent');
    expect(result.collection).toMatchObject({status: 'partial', onDiskConsistencyOnly: true});
    expect(result.collection.reasons).toContain('Slot inventory and acquisition reference schema agreement not yet verified');
    const bytes = await readFile(join(f.root, 'invocation.json'));
    expect(result.root.ledger.fact).toEqual({byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
  });
  it('retains ledger identity rather than fabricating a missing descriptor', async () => {
    const f = await rootFixture(); await unlink(join(f.root, f.runs[3]!.artifactDirectory, 'descriptor.json'));
    const result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(12); expect(result.runs[3]!.descriptor).toBeNull();
    expect(result.runs[3]!.identity.repetition).toBe(f.runs[3]!.repetition);
    expect(result.runs[3]!.rawAvailability.descriptor.status).toBe('absent');
  });
  it('keeps valid ledger rows on malformed seal and original seal bytes unchanged', async () => {
    const f = await rootFixture(), bytes = Buffer.from('{bad seal}'); await writeFile(join(f.root, 'dataset-seal.json'), bytes);
    const result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(12); expect(result.root.seal.value).toBeNull();
    expect(result.root.seal.availability.status).toBe('malformed'); expect(await readFile(join(f.root, 'dataset-seal.json'))).toEqual(bytes);
  });
  it.each(['scheduled', 'running'])('rejects nonterminal ledger row %s without losing its actual scheduled identity', async status => {
    const f = await rootFixture(); await f.json('invocation.json', {...f.ledger, status: 'pending', runs: f.runs.map((row, i) => i ? row : {...row, status, reasons: []})});
    const result = await loadComparisonInvocation(f.root);
    expect(result.scheduled).toBe(12); expect(result.runs).toHaveLength(12);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation.json', kind: 'malformed', reason: expect.stringMatching(/terminal/i)}));
  });
  it.each([['2.1.0', '2.1.0'], ['2.0.0', '2.1.0'], ['9.0.0', '9.0.0']])('rejects unsupported root pair %s/%s before dependent descriptor IO', async (collectorVersion, analyzerVersion) => {
    const f = await rootFixture(); await f.json('invocation.json', {...f.ledger, collectorVersion, analyzerVersion});
    const original = fs.open.bind(fs), paths: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {paths.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toBeNull(); expect(result.runs).toEqual([]);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation.json', kind: 'malformed', reason: expect.stringMatching(/unsupported.*pair/i)}));
    expect(paths.some(path => path.endsWith('/descriptor.json'))).toBe(false);
  });
  it('rejects claim/ledger version disagreement instead of choosing another family', async () => {
    const f = await rootFixture(); await f.json('invocation-claim.json', {...f.claim, collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});
    const result = await loadComparisonInvocation(f.root);
    expect(result.root.claim.value).toBeNull(); expect(result.runs).toHaveLength(12);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation-claim.json', kind: 'malformed'}));
  });
  it('rejects a strict claim extra field and descriptor identity disagreement', async () => {
    const f = await rootFixture(); await f.json('invocation-claim.json', {...f.claim, extra: true});
    await f.json(f.runs[0]!.artifactDirectory + '/descriptor.json', {...f.versions, repetition: 'wrong', scenarioId: f.runs[0]!.scenarioId, round: 1, caseIndex: 0, adapterProfile: f.runs[0]!.adapterProfile, seed: 1, mode: 'headless', artifactDirectory: f.runs[0]!.artifactDirectory});
    const result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(12); expect(result.root.claim.value).toBeNull(); expect(result.runs[0]!.descriptor).toBeNull();
    expect(result.runs[0]!.identity.repetition).toBe(f.runs[0]!.repetition);
    expect(result.runs[0]!.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity'}));
  });
  it('bounds retained diagnostics to32 and counts only actually observed omitted issues', async () => {
    const f = await rootFixture(); for (const row of f.runs) await unlink(join(f.root, row.artifactDirectory, 'descriptor.json'));
    const result = await loadComparisonInvocation(f.root);
    expect(result.loadingIssues).toHaveLength(32); expect(result.additionalLoadingIssueCount).toBe(17);
    expect(result.runs).toHaveLength(12); expect(result.runs.every(row => row.descriptor === null)).toBe(true);
  });
  it('does not manufacture scheduled rows from a claim when the actual ledger is absent', async () => {
    const f = await rootFixture(); await unlink(join(f.root, 'invocation.json'));
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
    expect(result.scheduled).toBeNull(); expect(result.runs).toEqual([]);
    expect(result.root.ledger.availability.status).toBe('absent');
    expect(result.collection.status).toBe('unavailable');
  });
  it('retains supported strict ledger rows but diagnoses a contradictory original claim', async () => {
    const f = await rootFixture(); await f.json('invocation-claim.json', {...f.claim, createdAt: '2026-10-11T00:00:00.000Z'});
    const result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(12);
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation-claim.json', kind: 'identity'}));
  });
  it.each([[2, 'headless', 24], [3, 'headed', 36]] as const)('retains all original rows for %i rounds/%s', async (rounds, mode, count) => {
    const f = await rootFixture(rounds, mode), result = await loadComparisonInvocation(f.root);
    expect(result.scheduled).toBe(count); expect(result.runs).toHaveLength(count);
    expect(result.runs.map(row => row.identity.repetition)).toEqual(f.runs.map(row => row.repetition));
    expect(result.runs.every(row => row.descriptor !== null && row.manifest === null)).toBe(true);
    expect(result.collection.status).toBe('partial');
  });
  it.each([{}, {schemaVersion: 'broken', collectorVersion: null, analyzerVersion: 2}])('uses a strict valid claim when the ledger header is unusable %j', async ledger => {
    const f = await rootFixture(); await f.json('invocation.json', ledger);
    const original = fs.open.bind(fs), opened: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
    expect(result.root.claim.value).toEqual(f.claim); expect(result.root.ledger.value).toBeNull();
    expect(result.root.ledger.availability.status).toBe('malformed'); expect(result.scheduled).toBeNull(); expect(result.runs).toEqual([]);
    expect(opened.some(path => path.endsWith('/descriptor.json'))).toBe(false);
  });
  it.each([false, true])('reads the manifest adapter.profile identity explicitly (mismatch=%s)', async mismatch => {
    const f = await rootFixture(), row = f.runs[0]!, workload = createLongThreadMatrix(1).find(value => value.scenarioId === row.scenarioId)!.workload;
    const manifest = comparisonManifestSchema.parse({...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex,
      caseOrder: f.ledger.configuration.caseOrder, workload, git: {revision: 'fixture-revision', dirty: false}, fixture: {sha256: 'a'.repeat(64), file: 'fixture.json'},
      browser: {executable: 'fixture-browser', version: '156.0.0.0', revision: 'fixture-revision', flags: []}, environment: {os: 'fixture-os', architecture: 'fixture-arch', cpu: {status: 'unavailable', reason: 'fixture'}, gpu: {status: 'unavailable', reason: 'fixture'}},
      mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1}, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
      adapter: {id: 'fixture-adapter', profile: mismatch ? 'different-profile' : row.adapterProfile, capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'},
        configuration: {markdown: 'default', pinThresholdCssPx: null, telemetry: 'disabled'}, build: {packages: [{name: 'fixture-package', version: '1.0.0', integrity: 'sha512-YQ=='}], framework: {name: 'Angular', version: '21.0.0'}, production: true,
          sourceHashes: {'src/source.ts': 'b'.repeat(64)}, copiedSourceHashes: {}, assetHashes: {'main.js': 'c'.repeat(64)}, settings: {optimization: true, sourceMaps: false}}}});
    await f.json(row.artifactDirectory + '/manifest.json', manifest);
    const result = await loadComparisonInvocation(f.root);
    if (!mismatch) {expect(result.runs[0]!.manifest).toEqual(manifest); expect(result.runs[0]!.rawAvailability.manifest.status).toBe('parsed');}
    else {expect(result.runs[0]!.manifest).toBeNull(); expect(result.runs[0]!.loadingIssues).toContainEqual(expect.objectContaining({kind: 'identity', path: row.artifactDirectory + '/manifest.json'}));}
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
