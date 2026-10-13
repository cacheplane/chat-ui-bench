import {afterEach, describe, expect, it, vi} from 'vitest';
import fs from 'node:fs/promises';
import {parseComparisonRendererPresentation} from './comparison-presentation.js';
import * as presentationModule from './comparison-presentation.js';
import {unavailableComparisonRendererDiagnostic} from './comparison-renderer-diagnostic.js';
import {StreamedTraceAdmission} from './comparison-trace-stream.js';
import {projectComparisonReport, serializeComparisonReport} from './comparison-report.js';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, unlink, open, writeFile, link} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadComparisonMember, loadComparisonJson, loadComparisonJsonLines, loadComparisonInvocation, type ComparisonMemberReference} from './comparison-load.js';
import {longThreadCaseOrder, createLongThreadMatrix, createLongThreadFixture, longThreadFixtureSchema, canonicalSerialize, COMPARISON_CAPTURE_LIMITS, comparisonPhaseMarks, PRESENTATION_TRACE_CATEGORIES, PRESENTATION_CAPABILITY, PRESENTATION_CONTRACT_VERSION, comparisonManifestSchema, comparisonDatasetInventorySchema, comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';

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

async function rootFixture(rounds = 1, mode = 'headless', version: '2.0.0' | '2.1.0' = '2.0.0') {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'chat-ui-bench-analysis-root-')); owned.push(root);
  const versions = {schemaVersion: 2, suite: 'long-thread-prose-v1', suiteVersion: '1.0.0', collectorVersion: version, analyzerVersion: version};
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
async function byteFixture(rounds = 1, version: '2.0.0' | '2.1.0' = '2.0.0') {
  const f = await rootFixture(rounds, 'headless', version);
  for (const row of f.runs) {
    const identity = {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile};
    await f.json(row.artifactDirectory + '/validation.json', {...identity, status: 'failed', reasons: ['not started'], checks: [{name: 'acquisition', passed: false, reason: 'not started', evidencePaths: ['descriptor.json']}]});
    await f.json(row.artifactDirectory + '/exceptions.json', {...identity, exceptions: []});
    await f.json(row.artifactDirectory + '/raw-inventory.json', {...identity, status: 'partial', reason: 'not started', files: []});
  }
  const paths = ['invocation-claim.json', 'invocation.json', ...f.runs.flatMap(row => ['descriptor.json', 'validation.json', 'exceptions.json', 'raw-inventory.json'].map(name => row.artifactDirectory + '/' + name))].sort();
  const members = await Promise.all(paths.map(async path => {const bytes = await readFile(join(f.root, path)); return {path, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};}));
  const directories = [...new Set(f.runs.flatMap(row => row.artifactDirectory.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))))].sort();
  const schemas = version === '2.1.0' ? comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'}) : comparisonSchemasForVersionPair({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
  const seal = schemas.comparisonDatasetInventorySchema.parse({...f.versions, invocationId: f.claim.invocationId, status: 'sealed', configuration: f.ledger.configuration, invocationClaim: f.claim, invocationLedger: f.ledger, root: '.', ledger: members.find(row => row.path === 'invocation.json'), members, absentMembers: [], directories,
    slots: f.runs.map(row => ({identity: {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile}, artifactDirectory: row.artifactDirectory, status: 'failed'})), ownershipSettled: true, finalizationSucceeded: true});
  await f.json('dataset-seal.json', seal);
  return {...f, members, seal, async total() {let total = 0; for (const path of [...paths, 'dataset-seal.json']) total += (await fs.lstat(join(f.root, path))).size; return total;}};
}
async function referenceFixture(version: '2.0.0' | '2.1.0', mutation?: 'stale-inventory' | 'orphan-acquisition', repetition: 1 | 2 | 3 = 1) {
  const f = await rootFixture(repetition, 'headless', version);
  const schemas = version === '2.1.0' ? comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'}) : comparisonSchemasForVersionPair({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
  const members: {path: string; byteLength: number; sha256: string}[] = [];
  const measure = async (path: string) => {const bytes = await readFile(join(f.root, path)); return {path, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};};
  for (const row of f.runs) {
    const prefix = row.artifactDirectory + '/', identity = {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile};
    const source = 'provenance/source/example.ts'; await f.json(prefix + source, {original: 'inert source bytes'});
    const {path: _path, ...sourceFact} = await measure(prefix + source);
    const acquisition = schemas.comparisonProvenanceAcquisitionSchema.parse({...identity, status: 'complete', members: mutation === 'orphan-acquisition' && row.caseIndex === 0 ? [] : [{
      role: 'build-source', key: 'example.ts', path: source, originalSha256: sourceFact.sha256,
      beforeCopy: {status: 'available', value: sourceFact}, copied: {status: 'available', value: sourceFact}, afterCopy: {status: 'available', value: sourceFact}, status: 'complete',
    }]});
    await f.json(prefix + 'provenance/acquisition.json', acquisition);
    const validation = schemas.comparisonValidationSchema.parse({...identity, status: 'failed', reasons: ['not started'], checks: [{name: 'acquisition', passed: false, reason: 'not started', evidencePaths: ['descriptor.json']}]});
    await f.json(prefix + 'validation.json', validation); await f.json(prefix + 'exceptions.json', schemas.comparisonExceptionsSchema.parse({...identity, exceptions: []}));
    const rawNames = ['descriptor.json', 'exceptions.json', 'provenance/acquisition.json', source, 'validation.json'];
    const payloads = rawNames.map(path => ({path, status: 'complete'}));
    const unavailable = {status: 'unavailable', reason: 'not started'};
    const capture = schemas.comparisonCaptureStatusSchema.parse({...identity, status: 'partial', reasons: ['not started'], payloads, unavailablePaths: [],
      captureMetadata: unavailable, evidenceMetadata: unavailable, terminalPageDrain: unavailable, terminalProducerDrain: unavailable, finalPageInstrumentation: unavailable, traceEof: unavailable});
    await f.json(prefix + 'capture-status.json', capture);
    const raw = await Promise.all(['capture-status.json', ...rawNames].sort().map(async path => ({...(await measure(prefix + path)), path, status: 'complete'})));
    const inventory = schemas.comparisonRawInventorySchema.parse({...identity, status: 'partial', reason: 'not started', files: raw});
    if (mutation === 'stale-inventory' && row.caseIndex === 0) inventory.files.find(file => file.path === source)!.sha256 = '0'.repeat(64);
    await f.json(prefix + 'raw-inventory.json', inventory);
    members.push(...await Promise.all([...rawNames, 'capture-status.json', 'raw-inventory.json'].map(path => measure(prefix + path))));
  }
  members.push(await measure('invocation-claim.json'), await measure('invocation.json')); members.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const directories = [...new Set(members.flatMap(member => member.path.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))].sort();
  const seal = schemas.comparisonDatasetInventorySchema.parse({...f.versions, invocationId: f.claim.invocationId, status: 'sealed', configuration: f.ledger.configuration, invocationClaim: f.claim, invocationLedger: f.ledger,
    root: '.', ledger: members.find(member => member.path === 'invocation.json'), members, absentMembers: [], directories,
    slots: f.runs.map(row => ({identity: {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile}, artifactDirectory: row.artifactDirectory, status: 'failed'})), ownershipSettled: true, finalizationSucceeded: true});
  await f.json('dataset-seal.json', seal);
  const refreshSeal = async (added: string[] = [], removed: string[] = []) => {
    seal.members = await Promise.all([...seal.members.map(member => member.path).filter(path => !removed.includes(path)), ...added].sort().map(measure));
    seal.directories = [...new Set([...seal.members.map(member => member.path), ...seal.absentMembers.map(member => member.path), ...seal.slots.map(slot => slot.artifactDirectory + '/descriptor.json')].flatMap(path => path.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))))].sort();
    seal.ledger = {...seal.members.find(member => member.path === 'invocation.json')!, path: 'invocation.json'};
    await f.json('dataset-seal.json', schemas.comparisonDatasetInventorySchema.parse(seal));
  };
  return {...f, schemas, seal, refreshSeal};
}
async function counterFixture(version: '2.0.0' | '2.1.0') {
  const f = await referenceFixture(version), row = f.runs[0]!, prefix = row.artifactDirectory + '/';
  // Synthetic schema-valid records: exact retention is the oracle, not growth or atomicity.
  const counters = (['baseline', 'history-ready', 'replay-end'] as const).map((lifecycle, i) => ({lifecycle,
    pageRequestBracket: {status: 'available' as const, value: {clockDomain: 'page-performance-ms' as const, beforeMs: 10 + i * 7, afterMs: 12 + i * 7}},
    hostReceipt: {heap: {status: 'available' as const, value: {clockDomain: 'host-monotonic-ms' as const, timestampMs: 100 + i * 13}}, dom: {status: 'available' as const, value: {clockDomain: 'host-monotonic-ms' as const, timestampMs: 99 + i * 13}}},
    data: {heap: {status: 'available' as const, value: {jsHeapUsedBytes: [0, 137, 59][i]!}}, dom: {status: 'available' as const, value: {nodes: 3 + i, documents: 1, eventListeners: i}}}}));
  const checkpoints = f.schemas.comparisonCheckpointsSchema.parse({...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile,
    inputRecipe: {wheel: {recipeId: 'wheel', deltasCssPx: [-100, -100, -100, -100], cadenceMs: 50}, composer: {recipeId: 'composer', text: 'calibrate', cadenceMs: 35, submit: false}}, hostDispatches: [], hostFrameGuards: [], scroll: [], counters, deadlines: []});
  const measure = async (name: string) => {const bytes = await readFile(join(f.root, prefix + name)); return {path: name, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'complete' as const};};
  const refresh = async (value: unknown = checkpoints, bytes?: Buffer) => {
    if (bytes) await writeFile(join(f.root, prefix + 'checkpoints.json'), bytes); else await f.json(prefix + 'checkpoints.json', value);
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
    if (!capture.payloads.some(p => p.path === 'checkpoints.json')) capture.payloads.push({path: 'checkpoints.json', status: 'complete'});
    await f.json(prefix + 'capture-status.json', capture);
    const inventory = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    inventory.files = inventory.files.filter(p => p.path !== 'checkpoints.json' && p.path !== 'capture-status.json');
    inventory.files.push(await measure('checkpoints.json'), await measure('capture-status.json'));
    await f.json(prefix + 'raw-inventory.json', inventory);
    await f.refreshSeal(f.seal.members.some(p => p.path === prefix + 'checkpoints.json') ? [] : [prefix + 'checkpoints.json']);
  };
  await refresh();
  return {...f, prefix, checkpoints, refresh, fact: await measure('checkpoints.json')};
}

describe('counter checkpoint original admission', () => {
  it.each(['2.0.0', '2.1.0'] as const)('retains the three exact independent counter checkpoints for %s', async version => {
    const f = await counterFixture(version), loaded = await loadComparisonInvocation(f.root);
    expect(loaded.byteIntegrity.seal).toBe('byte-closed');
    expect(Reflect.get(loaded.runs[0]!, 'counterCheckpoints')).toEqual({status: 'verified-original', originalFileFact: {byteLength: f.fact.byteLength, sha256: f.fact.sha256}, rawAvailability: {status: 'parsed', path: f.prefix + 'checkpoints.json'}, reason: null, recordedSnapshotCount: 3, snapshots: f.checkpoints.counters});
    const report = projectComparisonReport(loaded), serialized = serializeComparisonReport(report);
    expect(report.rows[0]!.counterCheckpoints.originalFileFact).toEqual({byteLength: f.fact.byteLength, sha256: f.fact.sha256});
    expect(JSON.parse(serialized.json).rows[0].counterCheckpoints.snapshots).toEqual(f.checkpoints.counters); expect(serialized.markdown).toContain('jsHeapUsedBytes: 137');
    expect(loaded.root.ledger.value?.runs[0]?.status).toBe('failed'); expect(loaded.collection.status).toBe('partial');
  });
  it('rejects a fourth counter before selected schema traversal and retains its bounded row issue', async () => {
    const f = await counterFixture('2.1.0'); f.checkpoints.counters.push(structuredClone(f.checkpoints.counters[2]!)); await f.refresh();
    const schema = vi.spyOn(f.schemas.comparisonCheckpointsSchema, 'safeParse'), loaded = await loadComparisonInvocation(f.root);
    expect(schema).not.toHaveBeenCalled(); expect(loaded.byteIntegrity.seal).toBe('byte-closed');
    expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: [], originalFileFact: expect.any(Object)});
    expect(loaded.runs[0]!.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: f.prefix + 'checkpoints.json', limitName: 'counterSnapshots', observed: 4, observation: 'exact', limit: 3}));
  });
  it.each(['duplicate', 'reversed', 'wrong-row', 'wrong-profile', 'wrong-scenario', 'wrong-round', 'wrong-case', 'mixed-version', 'invalid-bracket', 'invalid-count'] as const)('rejects semantic %s with rebound bytes while keeping independent byte closure', async mode => {
    const f = await counterFixture('2.1.0');
    if (mode === 'duplicate') f.checkpoints.counters[1]!.lifecycle = 'baseline';
    if (mode === 'reversed') f.checkpoints.counters.reverse();
    if (mode === 'wrong-row') f.checkpoints.repetition = 'another-row';
    if (mode === 'wrong-profile') f.checkpoints.adapterProfile = 'another-profile';
    if (mode === 'wrong-scenario') f.checkpoints.scenarioId = 'another-scenario';
    if (mode === 'wrong-round') f.checkpoints.round = 2;
    if (mode === 'wrong-case') f.checkpoints.caseIndex = 1;
    if (mode === 'invalid-bracket' && f.checkpoints.counters[0]!.pageRequestBracket.status === 'available') f.checkpoints.counters[0]!.pageRequestBracket.value.afterMs = 0;
    if (mode === 'invalid-count') f.checkpoints.counters[0]!.data.heap = {status: 'available', value: {jsHeapUsedBytes: Number.MAX_SAFE_INTEGER + 1}};
    await f.refresh(mode === 'mixed-version' ? {...f.checkpoints, analyzerVersion: '2.0.0'} : f.checkpoints);
    const loaded = await loadComparisonInvocation(f.root), diagnostic = loaded.runs[0]!.counterCheckpoints;
    expect(loaded.byteIntegrity.seal).toBe('byte-closed'); expect(diagnostic.status).toBe('unavailable'); expect(diagnostic.snapshots).toEqual([]); expect(diagnostic.recordedSnapshotCount).toBeNull(); expect(diagnostic.originalFileFact).not.toBeNull();
    expect(loaded.runs[0]!.loadingIssues.some(issue => issue.path === f.prefix + 'checkpoints.json')).toBe(true);
  });
  it.each([0, 1, 2] as const)('retains an actual %i-record array without lifecycle completion inference', async count => {
    const f = await counterFixture('2.0.0'); f.checkpoints.counters = f.checkpoints.counters.slice(3 - count); await f.refresh();
    const loaded = await loadComparisonInvocation(f.root);
    expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'verified-original', recordedSnapshotCount: count, snapshots: f.checkpoints.counters});
    expect(loaded.runs[1]!.counterCheckpoints).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: [], rawAvailability: {status: 'absent'}});
  });
  it('retains all five independently unavailable unions and original reasons without zero fill', async () => {
    const f = await counterFixture('2.1.0'), counter = f.checkpoints.counters[1]!;
    counter.pageRequestBracket = {status: 'unavailable', reason: 'page bracket unavailable'};
    counter.hostReceipt.heap = {status: 'unavailable', reason: 'heap host receipt unavailable'};
    counter.hostReceipt.dom = {status: 'unavailable', reason: 'dom host receipt unavailable'};
    counter.data.heap = {status: 'unavailable', reason: 'heap received but invalid'};
    counter.data.dom = {status: 'unavailable', reason: 'dom request failed'};
    await f.refresh(); const loaded = await loadComparisonInvocation(f.root);
    expect(loaded.runs[0]!.counterCheckpoints.snapshots).toEqual(f.checkpoints.counters);
    const report = projectComparisonReport(loaded), result = serializeComparisonReport(report);
    expect(report.rows[0]!.counterCheckpoints.snapshots[1]!.data.heap).toEqual({status: 'unavailable', reason: expect.objectContaining({value: 'heap received but invalid'})});
    expect(report.rows[0]!.counterCheckpoints.snapshots[0]!.data.heap).toEqual({status: 'available', value: {jsHeapUsedBytes: 0}});
    expect(JSON.parse(result.json).rows[0].counterCheckpoints.recordedSnapshotCount).toBe(3); expect(result.markdown).toContain('page bracket unavailable'); expect(report.rows[0]!.reportedLedgerStatus).toBe('failed'); expect(report.scoringEligibility).toBe(false);
    expect(loaded.byteIntegrity.observedUniqueBytes).toBe((await Promise.all([...f.seal.members.map(m => m.path), 'dataset-seal.json'].map(async path => (await readFile(join(f.root, path))).length))).reduce((a, b) => a + b, 0));
  });
  it.each(['page', 'heap-receipt', 'dom-receipt', 'heap-data', 'dom-data'] as const)('retains %s unavailability independently from the other four channels', async channel => {
    const f = await counterFixture('2.0.0'), counter = f.checkpoints.counters[0]!, missing = {status: 'unavailable' as const, reason: 'original ' + channel};
    if (channel === 'page') counter.pageRequestBracket = missing;
    if (channel === 'heap-receipt') counter.hostReceipt.heap = missing;
    if (channel === 'dom-receipt') counter.hostReceipt.dom = missing;
    if (channel === 'heap-data') counter.data.heap = missing;
    if (channel === 'dom-data') counter.data.dom = missing;
    await f.refresh(); const loaded = await loadComparisonInvocation(f.root);
    expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'verified-original', snapshots: f.checkpoints.counters});
  });
  it.each(['utf8', 'syntax', 'depth', 'work'] as const)('keeps slot-json %s failure as global original closure loss', async mode => {
    const f = await counterFixture('2.1.0');
    const bytes = mode === 'utf8' ? Buffer.from([0x7b, 0xff, 0x7d]) : mode === 'syntax' ? Buffer.from('{"counters":[') : mode === 'depth' ? Buffer.from('['.repeat(34) + 'null' + ']'.repeat(34)) : Buffer.from('[' + '0,'.repeat(2_097_152) + '0]');
    await f.refresh(null, bytes); const loaded = await loadComparisonInvocation(f.root);
    expect(loaded.byteIntegrity.seal).toBe('partial'); expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: []});
    expect(loaded.runs[0]!.counterCheckpoints.rawAvailability.status).not.toBe('parsed');
    expect(loaded.loadingIssues.some(issue => issue.path === f.prefix + 'checkpoints.json')).toBe(true);
  }, 15000);
  it.each([undefined, null, false, 0, ''] as const)('revokes a successful generic hash when the counter semantic close throws %j', async error => {
    const f = await counterFixture('2.1.0'), path = f.prefix + 'checkpoints.json', original = fs.open.bind(fs); let opens = 0;
    // One metadata descriptor, then generic hash, then this semantic JSON read.
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== join(f.root, path) || ++opens !== 3) return handle;
      return new Proxy(handle, {get(target, key) {if (key === 'close') return async () => {await target.close(); throw error;}; const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    const loaded = await loadComparisonInvocation(f.root); expect(opens).toBe(3); expect(loaded.byteIntegrity.seal).toBe('partial');
    expect(loaded.byteIntegrity.ioFailures).toContainEqual({operation: 'close', path, error}); expect(loaded.runs[0]!.counterCheckpoints.snapshots).toEqual([]);
  });
  it('revokes already admitted numeric counters when an unrelated original is replaced at final inspection', async () => {
    const f = await counterFixture('2.1.0'), target = join(f.root, f.prefix + 'descriptor.json'), prepared = f.root + '-counter-original-replacement.json'; owned.push(prepared); await writeFile(prepared, await readFile(target));
    const original = fs.opendir.bind(fs); let rootOpens = 0, changed = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {if (String(args[0]) === f.root && ++rootOpens === 3) {await rename(prepared, target); changed = true;} return original(...args);});
    const loaded = await loadComparisonInvocation(f.root), counters = loaded.runs[0]!.counterCheckpoints;
    expect(changed).toBe(true); expect(loaded.byteIntegrity.seal).toBe('partial'); expect(counters).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: [], originalFileFact: expect.any(Object), rawAvailability: {status: 'parsed'}});
    expect(counters.reason).toContain('Final original');
  });
  it('blocks counter opens and selected schema traversal on an explicit unknown root pair', async () => {
    const f = await counterFixture('2.1.0'); await f.json('invocation-claim.json', {...f.claim, collectorVersion: 'unknown', analyzerVersion: 'unknown'});
    const original = fs.open.bind(fs), opened: string[] = [], parser = vi.spyOn(f.schemas.comparisonCheckpointsSchema, 'safeParse');
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const loaded = await loadComparisonInvocation(f.root); expect(loaded.runs).toEqual([]); expect(parser).not.toHaveBeenCalled(); expect(opened.some(path => path.endsWith('/checkpoints.json'))).toBe(false);
  });
  it('does not open or schema-traverse counters after invocation byte preflight exceeds its existing capacity', async () => {
    const f = await counterFixture('2.1.0'), handle = await open(join(f.root, 'invocation.json.00000000-0000-4000-8000-000000000001.tmp'), 'wx'); try {await handle.truncate(16 * 1024 * 1024 * 1024);} finally {await handle.close();}
    const original = fs.open.bind(fs), opened: string[] = [], parser = vi.spyOn(f.schemas.comparisonCheckpointsSchema, 'safeParse');
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const loaded = await loadComparisonInvocation(f.root); expect(loaded.byteIntegrity.admission).toBe('exceeded'); expect(parser).not.toHaveBeenCalled(); expect(opened.some(path => path.endsWith('/checkpoints.json'))).toBe(false);
    expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: []});
  });
  it('retains ordered original read and falsy close failures from the semantic counter descriptor', async () => {
    const f = await counterFixture('2.1.0'), path = f.prefix + 'checkpoints.json', original = fs.open.bind(fs), primary = new Error('actual counter read failure'); let opens = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== join(f.root, path) || ++opens !== 3) return handle;
      return new Proxy(handle, {get(target, key) {if (key === 'read') return async () => {throw primary;}; if (key === 'close') return async () => {await target.close(); throw false;}; const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;}});
    });
    const loaded = await loadComparisonInvocation(f.root); expect(opens).toBe(3); expect(loaded.byteIntegrity.seal).toBe('partial');
    const failures = loaded.byteIntegrity.ioFailures.filter(failure => failure.path === path);
    expect(failures).toEqual([{operation: 'read', path, error: primary}, {operation: 'close', path, error: false}]); expect(failures[0]!.error).toBe(primary); expect(failures[1]!.error).toBe(false); expect(loaded.runs[0]!.counterCheckpoints.snapshots).toEqual([]);
  });
  it.each(['symlink', 'hardlink'] as const)('rejects a genuine counter %s without projecting numeric samples', async kind => {
    const f = await counterFixture('2.1.0'), target = join(f.root, f.prefix + 'checkpoints.json'), peer = kind === 'symlink' ? f.root + '-counter-symlink.json' : join(f.root, f.runs[1]!.artifactDirectory + '/checkpoints.json'), bytes = await readFile(target); owned.push(peer);
    if (kind === 'symlink') {await rename(target, peer); await symlink(peer, target);} else await link(target, peer);
    const loaded = await loadComparisonInvocation(f.root);
    expect(loaded.byteIntegrity.seal).not.toBe('byte-closed'); expect(loaded.runs[0]!.counterCheckpoints).toMatchObject({status: 'unavailable', recordedSnapshotCount: null, snapshots: []});
    expect(loaded.loadingIssues.some(issue => issue.kind === 'identity' && (kind === 'symlink' ? issue.path === f.prefix + 'checkpoints.json' : issue.reason === 'Distinct physical paths have a hardlink alias'))).toBe(true); expect(await readFile(peer)).toEqual(bytes);
  });
});

async function provenanceGraphFixture(version: '2.0.0' | '2.1.0', repetitions: 1 | 2 | 3 = 1) {
  const f = await referenceFixture(version, undefined, repetitions);
  const measure = async (path: string) => {const bytes = await readFile(join(f.root, path)); return {byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};};
  const slots = new Map<string, string[]>();
  for (const row of f.runs) {
    const prefix = row.artifactDirectory + '/', sourceFact = await measure(prefix + 'provenance/source/example.ts');
    const compiler = {name: 'typescript', version: '7.0.2', resolutionPath: 'node_modules/typescript', integrity: 'sha512-YQ==', nodeVersion: 'v24.20.0'};
    const nativeCompiler = {name: '@typescript/typescript-linux-x64', version: '7.0.2', resolutionPath: 'node_modules/@typescript/typescript-linux-x64', integrity: 'sha512-Yg==', platform: 'linux', architecture: 'x64', executablePath: 'node_modules/@typescript/typescript-linux-x64/lib/tsc'};
    const packages = [{name: 'p-queue', version: '9.0.0', resolutionPath: 'node_modules/p-queue', integrity: 'sha512-Yw=='}];
    const metadata = [
      {key: packages[0]!.resolutionPath, value: {name: 'p-queue', version: '9.0.0'}},
      {key: compiler.resolutionPath, value: {name: compiler.name, version: compiler.version, optionalDependencies: {[nativeCompiler.name]: nativeCompiler.version}}},
      {key: nativeCompiler.resolutionPath, value: {name: nativeCompiler.name, version: nativeCompiler.version, os: ['linux'], cpu: ['x64']}},
    ];
    for (const entry of metadata) await f.json(prefix + 'provenance/packages/' + entry.key + '/package.json', entry.value);
    for (const path of ['instrumentation/source/probe.ts', 'instrumentation/compiled/probe.js', 'provenance/assets/main.js']) await f.json(prefix + path, {syntheticInertBytes: path});
    const probeSource = await measure(prefix + 'instrumentation/source/probe.ts'), compiled = await measure(prefix + 'instrumentation/compiled/probe.js'), asset = await measure(prefix + 'provenance/assets/main.js');
    const product = f.schemas.adapterBuildSchema.parse({packages, framework: {name: 'Angular', version: '21.2.25'}, production: true, sourceHashes: {'example.ts': sourceFact.sha256}, copiedSourceHashes: {}, assetHashes: {'main.js': asset.sha256}, settings: {optimization: true, sourceMaps: false}});
    const probe = f.schemas.comparisonInstrumentationBuildSchema.parse({kind: 'comparison-instrumentation-build', formatVersion: 1, sourceHashes: {'probe.ts': probeSource.sha256}, compiledHashes: {'probe.js': compiled.sha256}, compiler, nativeCompiler,
      compilerPackageMetadata: await measure(prefix + 'provenance/packages/' + compiler.resolutionPath + '/package.json'), nativeCompilerPackageMetadata: await measure(prefix + 'provenance/packages/' + nativeCompiler.resolutionPath + '/package.json')});
    await f.json(prefix + 'provenance/build-evidence.json', product); await f.json(prefix + 'instrumentation/build-evidence.json', probe);
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8')));
    const add = async (role: typeof acquisition.members[number]['role'], key: string, path: string, originalSha256?: string) => {
      const fact = await measure(prefix + path); acquisition.members.push({role, key, path, ...(originalSha256 === undefined ? {} : {originalSha256}), beforeCopy: {status: 'available', value: {...fact}}, copied: {status: 'available', value: {...fact}}, afterCopy: {status: 'available', value: {...fact}}, status: 'complete'});
    };
    // Hand-authored deterministic tuples exercise the independent checker, not an imported collector planner.
    await add('build-record', '.build-evidence.json', 'provenance/build-evidence.json');
    await add('instrumentation-build-record', 'packages/runner/.comparison-build-evidence.json', 'instrumentation/build-evidence.json');
    await add('instrumentation-source', 'probe.ts', 'instrumentation/source/probe.ts', probeSource.sha256);
    await add('instrumentation-compiled-input', 'probe.js', 'instrumentation/compiled/probe.js', compiled.sha256);
    await add('served-asset', 'main.js', 'provenance/assets/main.js', asset.sha256);
    for (const entry of metadata) await add('installed-package-metadata', entry.key, 'provenance/packages/' + entry.key + '/package.json');
    await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition));
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    slots.set(prefix, [...new Set([...raw.files.map(file => file.path), ...acquisition.members.map(member => member.path)])].sort());
  }
  const refreshSlot = async (index: number, added: string[] = [], removed: string[] = [], remeasure: string[] = []) => {
    const row = f.runs[index]!, prefix = row.artifactDirectory + '/';
    const names = [...new Set([...slots.get(prefix)!.filter(path => !removed.includes(path)), ...added])].sort(); slots.set(prefix, names);
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8')));
    for (const member of acquisition.members.filter(member => remeasure.includes(member.path))) {
      const fact = await measure(prefix + member.path); member.beforeCopy = {status: 'available', value: {...fact}}; member.copied = {status: 'available', value: {...fact}}; member.afterCopy = {status: 'available', value: {...fact}};
      if (member.originalSha256 !== undefined) member.originalSha256 = fact.sha256;
    }
    await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition));
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'))), originalStatuses = new Map(capture.payloads.map(file => [file.path, file]));
    capture.payloads = names.filter(path => path !== 'capture-status.json').map(path => originalStatuses.get(path) ?? {path, status: 'complete'});
    await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(capture));
    const inventory = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    inventory.files = await Promise.all(names.map(async path => ({path, status: 'complete' as const, ...(await measure(prefix + path))})));
    await f.json(prefix + 'raw-inventory.json', f.schemas.comparisonRawInventorySchema.parse(inventory));
    const current = new Set(f.seal.members.map(member => member.path)); await f.refreshSeal(names.map(path => prefix + path).filter(path => !current.has(path)), removed.map(path => prefix + path));
  };
  for (let index = 0; index < f.runs.length; index++) await refreshSlot(index);
  return {...f, measure, refreshSlot};
}
/** Explicitly synthetic final records; no collector validator, journal replay or live DOM is invoked. */
async function finalContentFixture(version: '2.0.0' | '2.1.0', selectedIndex = 0, repetitions: 1 | 2 | 3 = 1, allRows = false) {
  const f = await provenanceGraphFixture(version, repetitions);
  async function prepare(index: number) {
  const row = f.runs[index]!, prefix = row.artifactDirectory + '/';
  const scenario = /^long-thread-prose-v1-h(100|1000|10000)-r(6400|262144)-(follow|history-reading)-s([0-9]+)$/.exec(row.scenarioId)!;
  const fixture = createLongThreadFixture({historyCount: Number(scenario[1]) as 100 | 1000 | 10000, responseBytes: Number(scenario[2]) as 6400 | 262144,
    journey: scenario[3] as 'follow' | 'history-reading', seed: f.ledger.configuration.seed});
  expect(fixture.scenarioId).toBe(row.scenarioId); const serialized = canonicalSerialize(fixture);
  await writeFile(join(f.root, prefix + 'fixture.json'), serialized);
  const identity = {...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile};
  const response = {id: fixture.events[0]!.messageId, role: 'assistant' as const, status: 'complete' as const, text: fixture.events.filter(event => event.type === 'text-delta').map(event => event.text).join('')};
  const runtime = f.schemas.comparisonFinalRuntimeSchema.parse({...identity, timestampMs: 27, clockDomain: 'page-performance-ms', snapshot: {
    transcript: [...fixture.history, response], activeMessageId: null, delivery: 'complete', outcome: 'success', loading: false, error: null}});
  const visible = f.schemas.comparisonVisibleValidationSchema.parse({...identity, timestampMs: runtime.timestampMs, clockDomain: 'page-performance-ms', coverage: {
    mode: 'all-mounted', messages: runtime.snapshot.transcript.map(message => ({id: message.id, text: message.text})), activeResponse: {id: response.id, text: response.text}}});
  const product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
  const manifest = f.schemas.comparisonManifestSchema.parse({...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex,
    caseOrder: f.ledger.configuration.caseOrder, workload: fixture.workload, git: {revision: 'synthetic-fixture', dirty: false}, fixture: {sha256: createHash('sha256').update(serialized).digest('hex'), file: 'fixture.json'},
    browser: {executable: 'synthetic-browser', version: '156.0.0.0', revision: 'synthetic-revision', flags: []}, environment: {os: 'synthetic-os', architecture: 'synthetic-arch', cpu: {status: 'unavailable', reason: 'synthetic'}, gpu: {status: 'unavailable', reason: 'synthetic'}},
    mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1}, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
    adapter: {id: 'synthetic-adapter', profile: row.adapterProfile, capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, configuration: {markdown: 'default', pinThresholdCssPx: null, telemetry: 'disabled'}, build: product}});
  await f.json(prefix + 'manifest.json', manifest); await f.json(prefix + 'final-runtime.json', runtime); await f.json(prefix + 'visible-validation.json', visible);
  await f.refreshSlot(index, ['fixture.json', 'manifest.json', 'final-runtime.json', 'visible-validation.json']);
  return {row, prefix, fixture, runtime, visible, manifest};
  }
  const selected = await prepare(selectedIndex);
  if (allRows) for (let index = 0; index < f.runs.length; index++) if (index !== selectedIndex) await prepare(index);
  return {...f, ...selected, selectedIndex, async refreshContent() {await f.refreshSlot(selectedIndex);}};
}
describe('comparison independent final content initial capabilities', () => {
  it.each(['2.0.0', '2.1.0'] as const)('checks canonical %s final records independently without promoting the reported failed verdict', async version => {
    const f = await finalContentFixture(version), result = await loadComparisonInvocation(f.root), row = result.runs[f.selectedIndex]!;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(row.provenanceGraph.status).toBe('complete'); expect(Object.values(row.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(row.captureValidation?.status).toBe('failed'); expect(result.collection.status).toBe('partial');
    expect(row).toHaveProperty('finalContent', expect.objectContaining({fixture: expect.objectContaining({status: 'complete'}), runtime: expect.objectContaining({status: 'complete'}), coverage: expect.objectContaining({status: 'complete'})}));
  });
});
describe('comparison independent final content semantic controls', () => {
  it('rejects a structurally valid changed fixture despite current declared and outer hashes', async () => {
    const f = await finalContentFixture('2.1.0'); f.fixture.history[0]!.text = 'X' + f.fixture.history[0]!.text.slice(1); const serialized = canonicalSerialize(longThreadFixtureSchema.parse(f.fixture));
    await writeFile(join(f.root, f.prefix + 'fixture.json'), serialized); f.manifest.fixture.sha256 = createHash('sha256').update(serialized).digest('hex'); await f.json(f.prefix + 'manifest.json', f.schemas.comparisonManifestSchema.parse(f.manifest)); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.status).toBe('complete');
    expect(result.runs[0]).toHaveProperty('finalContent', expect.objectContaining({fixture: expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({path: 'fixture.json', reason: 'Canonical fixture content differs from deterministic generator'})])})}));
  });
  it('rejects noncanonical fixture serialization even when parsed content and the rebound manifest hash agree', async () => {
    const f = await finalContentFixture('2.1.0'), bytes = canonicalSerialize(f.fixture) + '\n'; await writeFile(join(f.root, f.prefix + 'fixture.json'), bytes); f.manifest.fixture.sha256 = createHash('sha256').update(bytes).digest('hex'); await f.json(f.prefix + 'manifest.json', f.manifest); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.runs[0]).toHaveProperty('finalContent', expect.objectContaining({fixture: expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({path: 'fixture.json', reason: 'Fixture original serialization differs from canonical generator bytes'})])})}));
  });
  it('rejects a schema-valid wrong final response without trusting reported validation', async () => {
    const f = await finalContentFixture('2.1.0'), response = f.runtime.snapshot.transcript.at(-1)!; response.text = 'X' + response.text.slice(1); await f.json(f.prefix + 'final-runtime.json', f.schemas.comparisonFinalRuntimeSchema.parse(f.runtime)); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.captureValidation?.status).toBe('failed');
    expect(result.runs[0]).toHaveProperty('finalContent', expect.objectContaining({runtime: expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({path: 'final-runtime.json', reason: 'Runtime response raw text differs from canonical response'})])})}));
  });
  it('rejects omitted mounted history independently of canonical runtime and current byte closure', async () => {
    const f = await finalContentFixture('2.1.0'); if (f.visible.coverage.mode !== 'all-mounted') throw new Error('Controlled all-mounted prerequisite'); f.visible.coverage.messages.shift(); await f.json(f.prefix + 'visible-validation.json', f.schemas.comparisonVisibleValidationSchema.parse(f.visible)); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.runs[0]).toHaveProperty('finalContent', expect.objectContaining({runtime: expect.objectContaining({status: 'complete'}), coverage: expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({path: 'visible-validation.json', reason: 'Mounted coverage identity or order differs from canonical final transcript'})])})}));
  });
});
describe('comparison independent final content observed boundaries', () => {
  it('bounds the combined distinct virtualized cohorts before semantic schema traversal', async () => {
    const f = await finalContentFixture('2.1.0'), response = f.runtime.snapshot.transcript.at(-1)!, coverage = {mode: 'virtualized' as const,
      visibleMessages: f.runtime.snapshot.transcript.map(message => ({id: message.id, text: message.text})), historySamples: [{id: 'additional-history', text: 'raw', sampleIndex: 0, pageTimestampMs: 26}], activeResponse: {id: response.id, text: response.text}, samplingRecipe: {seed: 42, count: 1}};
    await f.json(f.prefix + 'visible-validation.json', f.schemas.comparisonVisibleValidationSchema.parse({...f.visible, coverage})); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'complete'); expect(result.runs[0]).toHaveProperty('finalContent.coverage.issues', expect.arrayContaining([expect.objectContaining({path: 'visible-validation.json', reason: 'Virtualized combined cohort cardinality exceeds canonical final count before schema traversal'})]));
  });
  it('retains a new owned-read failure even when the manifest prerequisite is unavailable', async () => {
    const f = await finalContentFixture('2.1.0'); await unlink(join(f.root, f.prefix + 'manifest.json')); await f.refreshSlot(0, [], ['manifest.json']);
    const path = f.prefix + 'visible-validation.json', target = join(f.root, path), original = fs.open.bind(fs); let opens = 0, failed = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd; return new Proxy(fd, {get(handle, key) {if (key === 'close') return async () => {await handle.close(); failed = true; throw false;}; const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(failed).toBe(true); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs[0]).toHaveProperty('finalContent.coverage.issues', expect.arrayContaining([expect.objectContaining({kind: 'unreadable', path: 'visible-validation.json'})]));
    expect(result.byteIntegrity.ioFailures).toContainEqual(expect.objectContaining({operation: 'close', path, error: false}));
  });
  it.each(['unknown-visible', 'unknown-history', 'wrong-text', 'response-as-history'] as const)('keeps a known virtualized %s contradiction visible despite unsupported cohort selection', async mode => {
    const f = await finalContentFixture('2.1.0'), first = f.fixture.history[0]!, second = f.fixture.history[1]!, response = f.runtime.snapshot.transcript.at(-1)!;
    const coverage = {mode: 'virtualized' as const, visibleMessages: [{id: first.id, text: first.text}], historySamples: [{id: second.id, text: second.text, sampleIndex: 0, pageTimestampMs: 26}], activeResponse: {id: response.id, text: response.text}, samplingRecipe: {seed: 42, count: 1}};
    if (mode === 'unknown-visible') coverage.visibleMessages[0]!.id = 'not-canonical';
    if (mode === 'unknown-history') coverage.historySamples[0]!.id = 'not-canonical';
    if (mode === 'wrong-text') coverage.visibleMessages[0]!.text = 'X' + first.text.slice(1);
    if (mode === 'response-as-history') {coverage.historySamples[0]!.id = response.id; coverage.historySamples[0]!.text = response.text;}
    await f.json(f.prefix + 'visible-validation.json', f.schemas.comparisonVisibleValidationSchema.parse({...f.visible, coverage})); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'complete');
    expect(result.runs[0]).toHaveProperty('finalContent.coverage', expect.objectContaining({status: 'partial', samplingCohort: 'unsupported', issues: expect.arrayContaining([
      expect.objectContaining({path: 'visible-validation.json', reason: mode === 'unknown-visible' ? 'Virtualized observed message is not in canonical final transcript' : mode === 'wrong-text' ? 'Virtualized observed prose differs from canonical message' : 'Virtualized history sample is not in canonical history'}),
      expect.objectContaining({reason: 'Virtualized sampling cohort has no maintained independent selection contract'}),
    ])}));
  });
  it('rejects excess schema-valid runtime cardinality before semantic schema traversal', async () => {
    const f = await finalContentFixture('2.1.0'); f.runtime.snapshot.transcript.push({...f.runtime.snapshot.transcript[0]!}); await f.json(f.prefix + 'final-runtime.json', f.schemas.comparisonFinalRuntimeSchema.parse(f.runtime)); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.runs[0]).toHaveProperty('finalContent.runtime', expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({path: 'final-runtime.json', reason: 'Runtime transcript cardinality exceeds canonical final count before schema traversal'})])}));
  });
});
describe('comparison independent final content absence and identity', () => {
  it.each(['seal', 'owned-hash'] as const)('keeps unknown fixture %s measurement separate from a proven serialization mismatch', async missing => {
    const f = await finalContentFixture('2.1.0'), path = f.prefix + 'fixture.json', target = join(f.root, path); let rejected = false;
    if (missing === 'seal') {f.seal.members = f.seal.members.filter(member => member.path !== path); await f.refreshSeal();}
    else {
      const original = fs.open.bind(fs); let opens = 0;
      vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 2) return fd; return new Proxy(fd, {get(handle, key) {
        if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {await handle.read(...parameters); rejected = true; throw false;}; const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});});
    }
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('partial'); if (missing === 'owned-hash') {expect(rejected).toBe(true); expect(result.byteIntegrity.ioFailures).toContainEqual(expect.objectContaining({operation: 'read', path, error: false}));}
    expect(result.runs[0]).toHaveProperty('finalContent.fixture.issues', expect.arrayContaining([expect.objectContaining({kind: 'membership', path: 'fixture.json', reason: missing === 'seal' ? 'Sealed original fixture measurement unavailable' : 'Owned original fixture measurement unavailable'})]));
    expect(result.runs[0]!.finalContent.fixture.issues.some(issue => issue.reason === 'Fixture original serialization differs from canonical generator bytes')).toBe(false);
  });
  it('names a missing canonical fixture prerequisite without misreporting retained runtime or coverage as missing', async () => {
    const f = await finalContentFixture('2.1.0'); await unlink(join(f.root, f.prefix + 'fixture.json')); await f.refreshSlot(0, [], ['fixture.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); for (const key of ['runtime', 'coverage']) expect(result.runs[0]).toHaveProperty('finalContent.' + key, expect.objectContaining({status: 'unavailable', issues: expect.arrayContaining([expect.objectContaining({path: 'fixture.json', reason: 'Canonical fixture agreement unavailable or contradictory'})])}));
  });
  it('names the missing runtime prerequisite for a retained paired coverage document', async () => {
    const f = await finalContentFixture('2.1.0'); await unlink(join(f.root, f.prefix + 'final-runtime.json')); await f.refreshSlot(0, [], ['final-runtime.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.coverage', expect.objectContaining({status: 'unavailable', issues: expect.arrayContaining([expect.objectContaining({path: 'final-runtime.json', reason: 'Recorded final runtime unavailable for paired coverage'})])}));
  });
  it('retains exact identity disagreement as an identity diagnostic', async () => {
    const f = await finalContentFixture('2.1.0'); f.runtime.repetition = 'different-original-row'; await f.json(f.prefix + 'final-runtime.json', f.schemas.comparisonFinalRuntimeSchema.parse(f.runtime)); await f.refreshContent();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime', expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({kind: 'identity', path: 'final-runtime.json', reason: 'Final content identity differs from original invocation row'})])}));
  });
  it('retains a true declared absent final record separately from an unregistered missing record', async () => {
    const f = await finalContentFixture('2.1.0'), path = 'final-runtime.json'; await unlink(join(f.root, f.prefix + path)); f.seal.absentMembers.push({path: f.prefix + path, reason: 'original final sample unavailable'}); await f.refreshSlot(0, [], [path]);
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, f.prefix + 'capture-status.json'), 'utf8'))); capture.unavailablePaths.push({path, reason: 'original final sample unavailable'}); await f.json(f.prefix + 'capture-status.json', capture);
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, f.prefix + 'raw-inventory.json'), 'utf8'))); Object.assign(raw.files.find(file => file.path === 'capture-status.json')!, await f.measure(f.prefix + 'capture-status.json')); await f.json(f.prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime', expect.objectContaining({status: 'unavailable', issues: expect.arrayContaining([expect.objectContaining({kind: 'absent', path, reason: 'original final sample unavailable'})])}));
  });
});
describe('comparison independent final content text and lifecycle', () => {
  it.each(['digest', 'seed', 'case-order'] as const)('checks manifest fixture %s against the original canonical context', async mode => {
    const f = await finalContentFixture('2.1.0'); if (mode === 'digest') f.manifest.fixture.sha256 = '0'.repeat(64); if (mode === 'seed') f.manifest.workload.seed = 2; if (mode === 'case-order') f.manifest.caseOrder[1] = 'different-case';
    if (mode === 'digest') f.schemas.comparisonManifestSchema.parse(f.manifest);
    else expect(f.schemas.comparisonManifestSchema.safeParse(f.manifest).success).toBe(false);
    await f.json(f.prefix + 'manifest.json', f.manifest); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.fixture.status', mode === 'digest' ? 'partial' : 'unavailable'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'unavailable');
    if (mode !== 'digest') expect(result.runs[0]!.rawAvailability.manifest.status).toBe('malformed');
  });
  it('detects changed bytes in a new owned content read while the actual original and stat remain stable', async () => {
    const f = await finalContentFixture('2.1.0'), path = f.prefix + 'visible-validation.json', target = join(f.root, path), actualBefore = await readFile(target), original = fs.open.bind(fs); let opens = 0, substituted = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd; return new Proxy(fd, {get(handle, key) {
      if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {const result = await handle.read(...parameters); if (!substituted && result.bytesRead) {const bytes = result.buffer as Buffer, index = bytes.indexOf('The reader'); expect(index).toBeGreaterThan(-1); bytes[index] = 'X'.charCodeAt(0); substituted = true;} return result;};
      const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
    }});});
    const result = await loadComparisonInvocation(f.root); expect(substituted).toBe(true); expect(await readFile(target)).toEqual(actualBefore); expect(result.byteIntegrity.seal).toBe('partial'); expect(Object.values(result.runs[0]!.finalContent).every(lane => lane.status !== 'complete')).toBe(true);
    expect(result.runs[0]).toHaveProperty('finalContent.coverage.issues', expect.arrayContaining([expect.objectContaining({kind: 'identity', path: 'visible-validation.json', reason: 'Original bytes changed between owned reads'})]));
  });
  it.each(['ascii-space', 'nbsp', 'unicode'] as const)('preserves the separate projected and raw DOM relations for %s', async mode => {
    const f = await finalContentFixture('2.1.0'); if (f.visible.coverage.mode !== 'all-mounted') throw new Error('Controlled all-mounted prerequisite'); const message = f.visible.coverage.messages[0]!;
    message.text = mode === 'ascii-space' ? message.text.replace(' ', ' \t ') : mode === 'nbsp' ? message.text.replace(' ', '\u00a0') : '🙂' + message.text.slice(1);
    await f.json(f.prefix + 'visible-validation.json', f.schemas.comparisonVisibleValidationSchema.parse(f.visible)); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'complete'); expect(result.runs[0]).toHaveProperty('finalContent.coverage', expect.objectContaining({status: 'partial', projectedProseAgreement: mode === 'ascii-space', rawMountedRuntimeAgreement: false}));
  });
  it.each(['unfinished', 'raw-nbsp', 'history-order', 'history-role', 'response-id'] as const)('checks final runtime %s independently', async mode => {
    const f = await finalContentFixture('2.1.0');
    if (mode === 'unfinished') {f.runtime.snapshot.delivery = 'streaming'; f.runtime.snapshot.loading = true;}
    if (mode === 'raw-nbsp') f.runtime.snapshot.transcript.at(-1)!.text = f.runtime.snapshot.transcript.at(-1)!.text.replace(' ', '\u00a0');
    if (mode === 'history-order') [f.runtime.snapshot.transcript[0], f.runtime.snapshot.transcript[1]] = [f.runtime.snapshot.transcript[1]!, f.runtime.snapshot.transcript[0]!];
    if (mode === 'history-role') f.runtime.snapshot.transcript[0]!.role = 'user';
    if (mode === 'response-id') f.runtime.snapshot.transcript.at(-1)!.id = 'different-response';
    await f.json(f.prefix + 'final-runtime.json', f.schemas.comparisonFinalRuntimeSchema.parse(f.runtime)); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.fixture.status', 'complete'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'partial'); expect(result.runs[0]).toHaveProperty('finalContent.coverage.status', 'partial');
  });
  it('counts genuinely observed runtime history diagnostics after the fixed32 output records', async () => {
    const f = await finalContentFixture('2.1.0'); for (const message of f.runtime.snapshot.transcript.slice(0, -1)) message.text = 'X' + message.text.slice(1); await f.json(f.prefix + 'final-runtime.json', f.runtime); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.issues.length', 32); expect(result.runs[0]).toHaveProperty('finalContent.runtime.additionalIssueCount', 100 - 32);
  });
  it.each(['timestamp', 'active-unavailable', 'active-wrong', 'virtual-zero', 'virtual-observed'] as const)('retains coverage %s facts honestly', async mode => {
    const f = await finalContentFixture('2.1.0'), response = f.runtime.snapshot.transcript.at(-1)!;
    if (mode === 'timestamp') f.visible.timestampMs++;
    if (mode === 'active-unavailable') f.visible.coverage.activeResponse = {status: 'unavailable', reason: 'original response not mounted'};
    if (mode === 'active-wrong') f.visible.coverage.activeResponse = {id: 'wrong-response', text: response.text};
    if (mode === 'virtual-zero' || mode === 'virtual-observed') f.visible.coverage = {mode: 'virtualized', visibleMessages: mode === 'virtual-zero' ? [] : [{id: f.fixture.history[0]!.id, text: f.fixture.history[0]!.text}], historySamples: [], activeResponse: {id: response.id, text: response.text}, samplingRecipe: {seed: 42, count: 0}};
    await f.json(f.prefix + 'visible-validation.json', f.schemas.comparisonVisibleValidationSchema.parse(f.visible)); await f.refreshContent(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.runtime.status', 'complete'); expect(result.runs[0]).toHaveProperty('finalContent.coverage.status', 'partial');
    if (mode.startsWith('virtual')) expect(result.runs[0]).toHaveProperty('finalContent.coverage', expect.objectContaining({samplingCohort: 'unsupported', projectedProseAgreement: true}));
  });
  it.each(['fixture.json', 'final-runtime.json', 'visible-validation.json'] as const)('retains missing %s without inferring a declared absence', async path => {
    const f = await finalContentFixture('2.1.0'); await unlink(join(f.root, f.prefix + path)); await f.refreshSlot(0, [], [path]); const result = await loadComparisonInvocation(f.root), key = path === 'fixture.json' ? 'fixture' : path === 'final-runtime.json' ? 'runtime' : 'coverage';
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.root.seal.value?.absentMembers).toEqual([]); expect(result.runs[0]).toHaveProperty('finalContent.' + key, expect.objectContaining({status: 'unavailable', issues: expect.arrayContaining([expect.objectContaining({kind: 'membership', path, reason: 'Required original final content is not in admitted original inventory'})])}));
  });
  it.each(['fixture.json', 'final-runtime.json', 'visible-validation.json'] as const)('keeps malformed %s as a separate partial diagnostic', async path => {
    const f = await finalContentFixture('2.1.0'); await f.json(f.prefix + path, {malformedOriginal: true}); await f.refreshContent(); const result = await loadComparisonInvocation(f.root), key = path === 'fixture.json' ? 'fixture' : path === 'final-runtime.json' ? 'runtime' : 'coverage';
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toHaveProperty('finalContent.' + key, expect.objectContaining({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({kind: 'malformed', path})])}));
  });
  it('does not open a manifest-declared alternate fixture path', async () => {
    const f = await finalContentFixture('2.1.0'); f.manifest.fixture.file = 'alternate/fixture.json'; await f.json(f.prefix + 'manifest.json', f.schemas.comparisonManifestSchema.parse(f.manifest)); await f.refreshContent();
    const original = fs.open.bind(fs), opened: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);}); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(opened.some(path => path.endsWith('/alternate/fixture.json'))).toBe(false); expect(result.runs[0]).toHaveProperty('finalContent.fixture.status', 'partial');
  });
  it('revokes earlier favorable content when retained runtime is replaced at final ownership closure', async () => {
    const f = await finalContentFixture('2.1.0'), target = join(f.root, f.prefix + 'final-runtime.json'), prepared = f.root + '-final-content-replacement.json'; owned.push(prepared); await writeFile(prepared, await readFile(target));
    const original = fs.opendir.bind(fs); let rootOpens = 0, changed = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {if (String(args[0]) === f.root && ++rootOpens === 3) {await rename(prepared, target); changed = true;} return original(...args);}); const result = await loadComparisonInvocation(f.root);
    expect(changed).toBe(true); expect(result.byteIntegrity.seal).toBe('partial'); for (const lane of Object.values(result.runs[0]!.finalContent)) expect(lane).toMatchObject({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({kind: 'integrity', reason: 'Original invocation ownership or membership was not closed'})])});
  });
  it.each([undefined, null, false, 0, ''])('retains original final-record close failure %j and revokes favorable dependencies', async primary => {
    const f = await finalContentFixture('2.1.0'), path = f.prefix + 'visible-validation.json', target = join(f.root, path), original = fs.open.bind(fs); let opens = 0, closed = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd; return new Proxy(fd, {get(handle, key) {if (key === 'close') return async () => {await handle.close(); closed = true; throw primary;}; const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(closed).toBe(true); expect(result.byteIntegrity.seal).toBe('partial'); expect(Object.values(result.runs[0]!.finalContent).every(lane => lane.status !== 'complete')).toBe(true);
    expect(result.runs[0]).toHaveProperty('finalContent.coverage.issues', expect.arrayContaining([expect.objectContaining({kind: 'unreadable', path: 'visible-validation.json'})])); const failure = result.byteIntegrity.ioFailures.find(row => row.path === path && row.operation === 'close')!; expect(failure).toBeDefined(); expect(Object.hasOwn(failure, 'error')).toBe(true); expect(failure.error).toBe(primary);
  });
});
describe('comparison independent final content complete families', () => {
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => ([1, 2, 3] as const).map(repetitions => ({version, repetitions}))))('retains all canonical $version final documents for $repetitions repetitions under original budgets', {timeout: 60000}, async ({version, repetitions}) => {
    const f = await finalContentFixture(version, 0, repetitions, true), result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs).toHaveLength(12 * repetitions);
    expect(result.runs.every(row => Object.values(row.finalContent).every(lane => lane.status === 'complete'))).toBe(true); expect(result.runs.every(row => row.captureValidation?.status === 'failed')).toBe(true); expect(result.collection.status).toBe('partial');
    expect(result.runs.some(row => row.finalContent.runtime.observedMessages === 10001)).toBe(true); expect(result.loadingIssues.some(issue => issue.kind === 'admission-limit')).toBe(false);
  });
});
describe('comparison independent captured provenance graph', () => {
  it.each(['2.0.0', '2.1.0'] as const)('closes canonical declared graph in %s while retaining failed verdict and partial capture', async version => {
    const f = await provenanceGraphFixture(version), result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs).toHaveLength(12);
    expect(result.runs.every(row => Object.values(row.references).every(lane => lane.status === 'complete'))).toBe(true);
    expect(result.runs.every(row => row.provenanceGraph.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph).toMatchObject({expectedMembers: 9, observedAcquisitionMembers: 9, manifestAgreement: 'unavailable'});
    expect(result.runs.every(row => row.captureValidation?.status === 'failed')).toBe(true); expect(result.collection.status).toBe('partial');
  });
  it('rejects a build-declared source omitted from acquisition despite closed current references', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
    product.sourceHashes['missing.ts'] = 'a'.repeat(64); await f.json(prefix + 'provenance/build-evidence.json', product); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'membership', path: 'provenance/source/missing.ts', reason: 'Expected build declaration has no acquisition member'}));
  });
  it('rejects an acquired source absent from product declarations despite closed current references', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'provenance/source/extra.ts'; await f.json(prefix + path, {inertExtraSource: true});
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), fact = await f.measure(prefix + path);
    acquisition.members.push({role: 'build-source', key: 'extra.ts', path, originalSha256: fact.sha256, beforeCopy: {status: 'available', value: fact}, copied: {status: 'available', value: fact}, afterCopy: {status: 'available', value: fact}, status: 'complete'});
    await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0, [path]); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'membership', path, reason: 'Acquisition member is not declared by captured build records'}));
  });
});

describe('comparison provenance metadata and shared declarations', () => {
  it.each(['name', 'version'] as const)('checks actual inert package metadata %s against captured declaration', async field => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'provenance/packages/node_modules/p-queue/package.json';
    await f.json(prefix + path, {name: field === 'name' ? 'other-package' : 'p-queue', version: field === 'version' ? '9.0.1' : '9.0.0'}); await f.refreshSlot(0, [], [], [path]);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: 'Package metadata identity differs from captured declaration'}));
  });
  it.each(['compiler', 'nativeCompiler'] as const)('checks explicit %s metadata measurement against actual original bytes', async tool => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'instrumentation/build-evidence.json';
    const probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + path), 'utf8'))); probe[tool === 'compiler' ? 'compilerPackageMetadata' : 'nativeCompilerPackageMetadata'].sha256 = '0'.repeat(64);
    await f.json(prefix + path, probe); await f.refreshSlot(0, [], [], [path]); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path: 'provenance/packages/' + probe[tool].resolutionPath + '/package.json', reason: 'Compiler metadata measurement differs from sealed original'}));
  });
  it.each(['optional-pin', 'os', 'cpu', 'executable'] as const)('checks source-grounded native tool %s relationship without executing it', async mutation => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', record = 'instrumentation/build-evidence.json';
    const probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + record), 'utf8')));
    const compilerPath = 'provenance/packages/' + probe.compiler.resolutionPath + '/package.json', nativePath = 'provenance/packages/' + probe.nativeCompiler.resolutionPath + '/package.json';
    if (mutation === 'optional-pin') {await f.json(prefix + compilerPath, {name: probe.compiler.name, version: probe.compiler.version, optionalDependencies: {[probe.nativeCompiler.name]: '7.0.3'}}); probe.compilerPackageMetadata = await f.measure(prefix + compilerPath);}
    if (mutation === 'os' || mutation === 'cpu') {await f.json(prefix + nativePath, {name: probe.nativeCompiler.name, version: probe.nativeCompiler.version, os: mutation === 'os' ? ['darwin'] : ['linux'], cpu: mutation === 'cpu' ? ['arm64'] : ['x64']}); probe.nativeCompilerPackageMetadata = await f.measure(prefix + nativePath);}
    if (mutation === 'executable') probe.nativeCompiler.executablePath = probe.nativeCompiler.resolutionPath + '/bin/other';
    await f.json(prefix + record, probe); await f.refreshSlot(0, [], [], [record, ...(mutation === 'optional-pin' ? [compilerPath] : mutation === 'os' || mutation === 'cpu' ? [nativePath] : [])]);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', reason: mutation === 'optional-pin' ? 'Compiler optional native pin differs from captured native declaration' : mutation === 'executable' ? 'Native executable declaration differs from its recorded package context' : 'Native package metadata does not support declared platform and architecture'}));
  });
  it.each(['sourceHashes', 'compiledHashes'] as const)('checks shared original keys against probe %s instead of trusting individually consistent copies', async field => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', key = field === 'sourceHashes' ? 'probe.ts' : 'probe.js', path = 'provenance/source/' + key;
    await f.json(prefix + path, {independentContradictoryProductCopy: true}); const fact = await f.measure(prefix + path);
    const product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))); product.sourceHashes[key] = fact.sha256; await f.json(prefix + 'provenance/build-evidence.json', product);
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))); acquisition.members.push({role: 'build-source', key, path, originalSha256: fact.sha256, beforeCopy: {status: 'available', value: fact}, copied: {status: 'available', value: fact}, afterCopy: {status: 'available', value: fact}, status: 'complete'});
    await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0, [path], [], ['provenance/build-evidence.json']);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(Object.values(result.runs[0]!.references).every(lane => lane.status === 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: field === 'sourceHashes' ? 'Product and probe shared source declarations differ' : 'Product source and probe compiled declarations differ'}));
  });
});
describe('comparison provenance graph compatibility and ownership', () => {
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => ([1, 2, 3] as const).map(repetitions => ({version, repetitions}))))('retains the complete $version declaration graph for $repetitions repetitions', {timeout: 15000}, async ({version, repetitions}) => {
    const f = await provenanceGraphFixture(version, repetitions), result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(12 * repetitions); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs.every(row => row.provenanceGraph.status === 'complete')).toBe(true);
    expect(result.runs.every(row => row.captureValidation?.status === 'failed')).toBe(true); expect(result.collection.status).toBe('partial');
  });
  it('retains duplicate package names at independent physical resolutions', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', key = 'apps/threadplane/node_modules/p-queue', path = 'provenance/packages/' + key + '/package.json';
    await f.json(prefix + path, {name: 'p-queue', version: '9.0.1'}); const fact = await f.measure(prefix + path);
    const product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))); product.packages.push({name: 'p-queue', version: '9.0.1', resolutionPath: key, integrity: 'sha512-ZA=='}); await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product));
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))); acquisition.members.push({role: 'installed-package-metadata', key, path, beforeCopy: {status: 'available', value: fact}, copied: {status: 'available', value: fact}, afterCopy: {status: 'available', value: fact}, status: 'complete'});
    await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0, [path], [], ['provenance/build-evidence.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph).toMatchObject({status: 'complete', expectedMembers: 10, observedAcquisitionMembers: 10});
  });
  it('deduplicates matching physical compiler metadata but retains contradictory declaration claims', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))), probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8')));
    product.packages.push({name: probe.compiler.name, version: probe.compiler.version, resolutionPath: probe.compiler.resolutionPath, integrity: probe.compiler.integrity});
    const save = async () => {await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);};
    await save(); const positive = await loadComparisonInvocation(f.root); expect(positive.runs[0]!.provenanceGraph).toMatchObject({status: 'complete', expectedMembers: 9});
    product.packages[1]!.integrity = 'sha512-ZQ=='; await save(); const negative = await loadComparisonInvocation(f.root);
    expect(negative.byteIntegrity.seal).toBe('byte-closed'); expect(negative.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path: 'provenance/packages/' + probe.compiler.resolutionPath + '/package.json', reason: 'Same physical metadata path has conflicting captured declarations'}));
  });
  it('keeps legacy package resolution unknown without guessing a new metadata read', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))); delete product.packages[0]!.resolutionPath;
    await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);
    const original = fs.open.bind(fs), target = join(f.root, prefix + 'provenance/packages/node_modules/p-queue/package.json'); let opens = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {if (String(args[0]) === target) opens++; return original(...args);});
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(opens).toBe(2);
    expect(result.runs[0]!.provenanceGraph).toMatchObject({status: 'partial', issues: expect.arrayContaining([expect.objectContaining({reason: 'Legacy package declaration has no original physical resolution path'})])});
  });
  it('retains nonempty copiedSourceHashes as unsupported instead of creating another source projection', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))); product.copiedSourceHashes['legacy-copy.ts'] = 'a'.repeat(64);
    await f.json(prefix + 'provenance/build-evidence.json', product); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph).toMatchObject({status: 'partial', expectedMembers: 9, issues: expect.arrayContaining([expect.objectContaining({reason: 'Nonempty legacy copiedSourceHashes has no supported comparison acquisition projection'})])});
  });
  it.each(['provenance/build-evidence.json', 'instrumentation/build-evidence.json'] as const)('retains missing required %s as unavailable with the exact original path', async path => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/'; await unlink(join(f.root, prefix + path)); await f.refreshSlot(0, [], [path]);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.status).toBe('unavailable');
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({path, reason: 'Required captured build declaration unavailable from admitted originals'}));
  });
  it('revokes every earlier complete graph when a graph metadata original is substituted during final closure', async () => {
    const f = await provenanceGraphFixture('2.1.0'), target = join(f.root, f.runs[0]!.artifactDirectory, 'provenance/packages/node_modules/p-queue/package.json'), replacement = join(f.root, '..', 'graph-original-replacement.json'); await writeFile(replacement, await readFile(target));
    const original = fs.opendir.bind(fs); let rootOpens = 0, changed = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {if (String(args[0]) === f.root && ++rootOpens === 3) {await rename(replacement, target); changed = true;} return original(...args);});
    const result = await loadComparisonInvocation(f.root); expect(changed).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.runs.every(row => row.provenanceGraph.status === 'partial' && row.provenanceGraph.issues.some(issue => issue.kind === 'integrity' && issue.reason === 'Original invocation ownership or membership was not closed'))).toBe(true);
  });
  it.each([undefined, null, false, 0, ''])('retains actual graph metadata descriptor-close failure %j and revokes other complete graphs', async primary => {
    const f = await provenanceGraphFixture('2.1.0'), path = f.runs[0]!.artifactDirectory + '/provenance/packages/node_modules/p-queue/package.json', target = join(f.root, path), original = fs.open.bind(fs); let opens = 0, rejected = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd; return new Proxy(fd, {get(handle, key) {if (key === 'close') return async () => {await handle.close(); rejected = true; throw primary;}; const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs.every(row => row.provenanceGraph.status !== 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'unreadable', path: 'provenance/packages/node_modules/p-queue/package.json'}));
    const failure = result.byteIntegrity.ioFailures.find(issue => issue.path === path && issue.operation === 'close'); expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(primary);
  });
});
describe('comparison provenance graph remaining declaration relations', () => {
  it('retains each malformed original build declaration diagnostic independently', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', paths = ['provenance/build-evidence.json', 'instrumentation/build-evidence.json'];
    for (const path of paths) await f.json(prefix + path, {malformedOriginal: true}); await f.refreshSlot(0, [], [], paths); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.status).toBe('partial');
    for (const path of paths) expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'malformed', path}));
  });
  it('retains malformed original acquisition as partial rather than missing', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'provenance/acquisition.json';
    // Refresh the genuine envelope first, then replace only acquisition bytes and its inventory/seal facts.
    await f.json(prefix + path, {malformedOriginal: true});
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), fact = await f.measure(prefix + path); Object.assign(raw.files.find(file => file.path === path)!, fact);
    await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.status).toBe('partial'); expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'malformed', path}));
  });
  it('retains an unregistered declared destination as unknown without opening it', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members[0]!;
    acquisition.status = 'partial'; acquisition.reason = 'original copy unavailable'; member.status = 'partial'; member.reason = 'original copy unavailable'; member.copied = {status: 'unavailable', reason: 'original copy unavailable'}; member.key = 'unregistered.ts'; member.path = 'provenance/source/unregistered.ts';
    await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition)); await f.refreshSlot(0);
    const original = fs.open.bind(fs), opened: string[] = []; vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);}); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.status).toBe('partial'); expect(opened.some(path => path.endsWith('/unregistered.ts'))).toBe(false); expect(result.root.seal.value?.absentMembers).toEqual([]);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({path: member.path, reason: 'Acquisition member is not declared by captured build records'})); expect(result.runs[0]!.references.acquisition.status).toBe('partial');
  });
  it.each(['sourceHashes', 'assetHashes', 'compiledHashes'] as const)('checks declared %s independently of current copied header facts', async field => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', record = field === 'compiledHashes' ? 'instrumentation/build-evidence.json' : 'provenance/build-evidence.json';
    const product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))), probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8')));
    const declaration = field === 'compiledHashes' ? probe.compiledHashes : product[field], key = Object.keys(declaration)[0]!; declaration[key] = 'a'.repeat(64);
    await f.json(prefix + record, field === 'compiledHashes' ? probe : product); await f.refreshSlot(0, [], [], [record]); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.references.acquisition.status).toBe('complete');
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path: (field === 'sourceHashes' ? 'provenance/source/' : field === 'assetHashes' ? 'provenance/assets/' : 'instrumentation/compiled/') + key, reason: 'Build declared digest differs from acquired or retained original'}));
  });
  it('rejects a schema-valid product key that cannot name a normalized artifact destination', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))); product.sourceHashes['../outside.ts'] = 'a'.repeat(64);
    await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({path: 'provenance/build-evidence.json', reason: 'Build declaration key is not a normalized artifact path'}));
  });
  it.each(['2.0.0', '2.1.0'] as const)('compares a present %s manifest build without requiring a manifest for setup closure', async version => {
    const f = await provenanceGraphFixture(version), row = f.runs[0]!, prefix = row.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
    const manifest = f.schemas.comparisonManifestSchema.parse({...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex,
      caseOrder: f.ledger.configuration.caseOrder, workload: createLongThreadMatrix(1).find(value => value.scenarioId === row.scenarioId)!.workload, git: {revision: 'fixture-revision', dirty: false}, fixture: {sha256: 'a'.repeat(64), file: 'fixture.json'},
      browser: {executable: 'fixture-browser', version: '156.0.0.0', revision: 'fixture-revision', flags: []}, environment: {os: 'fixture-os', architecture: 'fixture-arch', cpu: {status: 'unavailable', reason: 'fixture'}, gpu: {status: 'unavailable', reason: 'fixture'}},
      mode: 'headless', viewport: {width: 1280, height: 800, deviceScaleFactor: 1}, cachePolicy: 'fresh-profile-empty-cache-assets-preloaded', fonts: 'local-system',
      adapter: {id: 'fixture-adapter', profile: row.adapterProfile, capabilities: {rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control'}, configuration: {markdown: 'default', pinThresholdCssPx: null, telemetry: 'disabled'}, build: product}});
    const save = async (added: string[] = []) => {await f.json(prefix + 'manifest.json', f.schemas.comparisonManifestSchema.parse(manifest)); await f.refreshSlot(0, added);};
    await save(['manifest.json']); const positive = await loadComparisonInvocation(f.root); expect(positive.byteIntegrity.seal).toBe('byte-closed'); expect(positive.runs[0]!.provenanceGraph).toMatchObject({status: 'complete', manifestAgreement: 'matched'});
    manifest.adapter.build.framework.version = '21.2.26'; await save(); const negative = await loadComparisonInvocation(f.root); expect(negative.byteIntegrity.seal).toBe('byte-closed'); expect(negative.runs[0]!.provenanceGraph).toMatchObject({status: 'partial', manifestAgreement: 'contradictory', issues: expect.arrayContaining([expect.objectContaining({kind: 'integrity', path: 'manifest.json', reason: 'Manifest build differs from captured product declaration'})])});
  });
  it('retains unknown copied measurement and partial acquisition without comparing retained destination to original stages', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members[0]!;
    acquisition.status = 'partial'; acquisition.reason = 'copy unavailable'; member.status = 'partial'; member.reason = 'copy unavailable'; member.copied = {status: 'unavailable', reason: 'copy unavailable'};
    await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition)); await f.refreshSlot(0); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.references.acquisition.status).toBe('partial'); expect(result.runs[0]!.provenanceGraph.status).toBe('partial');
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({path: member.path, reason: 'Expected acquisition retains partial or unavailable copied measurement'}));
    expect(result.runs[0]!.provenanceGraph.issues.some(issue => issue.kind === 'integrity')).toBe(false);
  });
  it('does not equate a genuinely partial retained destination to the original declared digest when copied measurement is unknown', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members[0]!;
    acquisition.status = 'partial'; acquisition.reason = 'copy unavailable'; member.status = 'partial'; member.reason = 'copy unavailable'; member.copied = {status: 'unavailable', reason: 'copy unavailable'};
    await f.json(prefix + member.path, {genuinelyPartialDestination: true}); await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition)); await f.refreshSlot(0);
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'))), payload = capture.payloads.find(file => file.path === member.path)!; payload.status = 'partial'; payload.reason = 'copy unavailable'; await f.json(prefix + 'capture-status.json', capture);
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), retained = raw.files.find(file => file.path === member.path)!; retained.status = 'partial'; retained.reason = 'copy unavailable'; Object.assign(raw.files.find(file => file.path === 'capture-status.json')!, await f.measure(prefix + 'capture-status.json')); await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.references.acquisition.status).toBe('partial'); expect(result.runs[0]!.references.acquisition.issues.some(issue => issue.kind === 'integrity')).toBe(false);
    expect(result.runs[0]!.provenanceGraph.status).toBe('partial'); expect(result.runs[0]!.provenanceGraph.issues.some(issue => issue.kind === 'integrity')).toBe(false);
    const measured = result.byteIntegrity.files.find(file => file.path === prefix + member.path)!; expect(measured.fact).not.toBeNull(); expect(measured.fact!.sha256).not.toBe(member.originalSha256);
  });
  it('revokes byte closure on a newly owned graph read mismatch while physical bytes remain unchanged', async () => {
    const f = await provenanceGraphFixture('2.1.0'), path = f.runs[0]!.artifactDirectory + '/provenance/packages/node_modules/p-queue/package.json', target = join(f.root, path), original = fs.open.bind(fs); let opens = 0, substituted = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd; return new Proxy(fd, {get(handle, key) {
      if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {const result = await handle.read(...parameters); if (!substituted && result.bytesRead) {const bytes = result.buffer as Buffer, index = bytes.indexOf('9.0.0'); expect(index).toBeGreaterThan(-1); bytes[index] = '8'.charCodeAt(0); substituted = true;} return result;};
      const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
    }});});
    const result = await loadComparisonInvocation(f.root); expect(substituted).toBe(true); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs.every(row => row.provenanceGraph.status !== 'complete')).toBe(true);
    expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'identity', path: 'provenance/packages/node_modules/p-queue/package.json', reason: 'Original bytes changed between owned reads'}));
  });
});
describe('comparison provenance graph copied metadata witness', () => {
  it.each((['compiler', 'nativeCompiler'] as const).flatMap(tool => (['minimal', 'changed-identity', 'missing-identity'] as const).map(shape => ({tool, shape}))))('keeps $tool $shape retained metadata unverified when copied is unavailable', async ({tool, shape}) => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8'))), path = 'provenance/packages/' + probe[tool].resolutionPath + '/package.json';
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members.find(member => member.path === path)!;
    acquisition.status = 'partial'; acquisition.reason = 'metadata copy unavailable'; member.status = 'partial'; member.reason = acquisition.reason; member.copied = {status: 'unavailable', reason: acquisition.reason};
    const retained = shape === 'minimal' ? {name: probe[tool].name, version: probe[tool].version} : shape === 'changed-identity' ? {name: 'retained-prefix', version: '0.0.1'} : {};
    await f.json(prefix + path, retained); await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0);
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'))), payload = capture.payloads.find(file => file.path === path)!; payload.status = 'partial'; payload.reason = acquisition.reason; await f.json(prefix + 'capture-status.json', capture);
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), file = raw.files.find(file => file.path === path)!; file.status = 'partial'; file.reason = acquisition.reason; Object.assign(raw.files.find(file => file.path === 'capture-status.json')!, await f.measure(prefix + 'capture-status.json')); await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    expect(await f.measure(prefix + path)).not.toEqual(probe[tool === 'compiler' ? 'compilerPackageMetadata' : 'nativeCompilerPackageMetadata']);
    const result = await loadComparisonInvocation(f.root), row = result.runs[0]!; expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(row.references.acquisition.status).toBe('partial'); expect(row.references.acquisition.issues.some(issue => issue.kind === 'integrity')).toBe(false);
    expect(row.provenanceGraph.status).toBe('partial'); expect(row.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'membership', path, reason: 'Original package metadata copy is unverified'})); expect(row.provenanceGraph.issues.some(issue => issue.kind === 'integrity' || issue.kind === 'malformed')).toBe(false);
  });
  it('retains same-physical declaration conflicts even when metadata is unavailable', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))), probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8'))), key = probe.compiler.resolutionPath, path = 'provenance/packages/' + key + '/package.json';
    product.packages.push({name: probe.compiler.name, version: probe.compiler.version, resolutionPath: key, integrity: 'sha512-ZQ=='}); await f.json(prefix + 'provenance/build-evidence.json', product);
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members.find(member => member.path === path)!; acquisition.status = 'partial'; acquisition.reason = 'metadata copy unavailable'; member.status = 'partial'; member.reason = acquisition.reason; member.copied = {status: 'unavailable', reason: acquisition.reason}; await f.json(prefix + 'provenance/acquisition.json', acquisition);
    await unlink(join(f.root, prefix + path)); f.seal.absentMembers.push({path: prefix + path, reason: acquisition.reason}); await f.refreshSlot(0, [], [path], ['provenance/build-evidence.json']);
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'))); capture.unavailablePaths.push({path, reason: acquisition.reason}); await f.json(prefix + 'capture-status.json', capture);
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))); Object.assign(raw.files.find(file => file.path === 'capture-status.json')!, await f.measure(prefix + 'capture-status.json')); await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: 'Same physical metadata path has conflicting captured declarations'}));
  });
  it('still checks supported available copied metadata when operational acquisition is partial', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'provenance/packages/node_modules/p-queue/package.json'; await f.json(prefix + path, {name: 'different-package', version: '9.0.0'});
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members.find(member => member.path === path)!; acquisition.status = 'partial'; acquisition.reason = 'source unavailable after copy'; member.status = 'partial'; member.reason = acquisition.reason; member.afterCopy = {status: 'unavailable', reason: acquisition.reason}; const fact = await f.measure(prefix + path); member.beforeCopy = {status: 'available', value: fact}; member.copied = {status: 'available', value: fact}; await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: 'Package metadata identity differs from captured declaration'}));
  });
  it.each(['name', 'version', 'executablePath'] as const)('retains native %s declaration contradictions independently of unknown metadata copy', async field => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8'))), path = 'provenance/packages/' + probe.nativeCompiler.resolutionPath + '/package.json';
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members.find(member => member.path === path)!; acquisition.status = 'partial'; acquisition.reason = 'metadata copy unavailable'; member.status = 'partial'; member.reason = acquisition.reason; member.copied = {status: 'unavailable', reason: acquisition.reason}; await f.json(prefix + 'provenance/acquisition.json', acquisition);
    probe.nativeCompiler[field] = field === 'name' ? '@typescript/typescript-different' : field === 'version' ? '7.0.3' : probe.nativeCompiler.resolutionPath + '/lib/different'; await f.json(prefix + 'instrumentation/build-evidence.json', f.schemas.comparisonInstrumentationBuildSchema.parse(probe)); await f.refreshSlot(0, [], [], ['instrumentation/build-evidence.json']);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.provenanceGraph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path: 'instrumentation/build-evidence.json', reason: field === 'executablePath' ? 'Native executable declaration differs from its recorded package context' : 'Native compiler identity differs from recorded compiler context'}));
  });
  it('requires copied metadata witness to match owned and sealed bytes before semantics', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', path = 'provenance/packages/node_modules/p-queue/package.json'; await f.json(prefix + path, {name: 'different-retained-destination', version: '0.0.1'});
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members.find(member => member.path === path)!; acquisition.status = 'partial'; acquisition.reason = 'copy changed'; member.status = 'partial'; member.reason = acquisition.reason; await f.json(prefix + 'provenance/acquisition.json', acquisition); await f.refreshSlot(0);
    const result = await loadComparisonInvocation(f.root), graph = result.runs[0]!.provenanceGraph; expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(graph.status).toBe('partial');
    expect(graph.issues).toContainEqual(expect.objectContaining({kind: 'integrity', path, reason: 'Declared acquisition copied fact differs from measured original'})); expect(graph.issues).toContainEqual(expect.objectContaining({kind: 'membership', path, reason: 'Original package metadata copy is unverified'})); expect(graph.issues.some(issue => issue.reason === 'Package metadata identity differs from captured declaration')).toBe(false);
  });
});
describe('comparison provenance declaration capacity', () => {
  it('bounds unsupported copiedSourceHashes before semantic traversal', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
    product.copiedSourceHashes = Object.fromEntries(Array.from({length: 4097}, (_, index) => ['copy-' + index + '.ts', 'a'.repeat(64)])); await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: prefix + 'provenance/build-evidence.json', limitName: 'slotCandidates', observed: 4097, observation: 'exact'})); expect(result.runs[0]!.provenanceGraph.expectedMembers).toBeNull();
  });
  it('refuses a selected-schema-valid4097 source map before graph expansion', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/';
    const product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
    product.sourceHashes = Object.fromEntries(Array.from({length: 4097}, (_, index) => ['declared-' + index + '.ts', 'a'.repeat(64)]));
    await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: prefix + 'provenance/build-evidence.json', limitName: 'slotCandidates', limit: 4096, observed: 4097, observation: 'exact'}));
    expect(result.runs[0]!.provenanceGraph.expectedMembers).toBeNull();
  });
  it('refuses4097 package declarations before metadata traversal', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8')));
    product.packages = Array.from({length: 4097}, (_, index) => ({name: 'pkg-' + index, version: '1.0.0', integrity: 'sha512-YQ==', resolutionPath: 'node_modules/pkg-' + index})); await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: prefix + 'provenance/build-evidence.json', limitName: 'slotCandidates', observed: 4097, observation: 'exact'}));
  });
  it('bounds combined distinct metadata while admitting repeated physical metadata at exactly4096 declarations', async () => {
    const f = await provenanceGraphFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', product = f.schemas.adapterBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/build-evidence.json'), 'utf8'))), probe = f.schemas.comparisonInstrumentationBuildSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'instrumentation/build-evidence.json'), 'utf8')));
    const save = async () => {await f.json(prefix + 'provenance/build-evidence.json', f.schemas.adapterBuildSchema.parse(product)); await f.refreshSlot(0, [], [], ['provenance/build-evidence.json']);};
    product.sourceHashes = Object.fromEntries(Array.from({length: 4090}, (_, index) => ['declared-' + index + '.ts', 'a'.repeat(64)])); await save(); const over = await loadComparisonInvocation(f.root);
    expect(over.byteIntegrity.seal).toBe('byte-closed'); expect(over.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: prefix + 'provenance/acquisition.json', limitName: 'slotCandidates', observed: 4097, observation: 'lower-bound'}));
    product.sourceHashes = Object.fromEntries(Array.from({length: 4089}, (_, index) => ['declared-' + index + '.ts', 'a'.repeat(64)])); product.packages = [{name: probe.compiler.name, version: probe.compiler.version, integrity: probe.compiler.integrity, resolutionPath: probe.compiler.resolutionPath}]; await save(); const boundary = await loadComparisonInvocation(f.root);
    expect(boundary.byteIntegrity.seal).toBe('byte-closed'); expect(boundary.loadingIssues.some(issue => issue.kind === 'admission-limit')).toBe(false); expect(boundary.runs[0]!.provenanceGraph).toMatchObject({status: 'partial', expectedMembers: 4096});
    // 4,089 missing declared sources plus two real copies no longer declared: every omitted diagnostic is counted.
    expect(boundary.runs[0]!.provenanceGraph.issues).toHaveLength(32); expect(boundary.runs[0]!.provenanceGraph.additionalIssueCount).toBe(4089 + 2 - 32);
  });
});
describe('comparison loader independently checked slot references', () => {
  it('revokes invocation closure when a newly owned reference read disagrees with earlier original bytes', async () => {
    const f = await referenceFixture('2.1.0'), path = f.runs[0]!.artifactDirectory + '/capture-status.json', target = join(f.root, path), original = fs.open.bind(fs); let opens = 0, substituted = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'read') return async (...parameters: Parameters<typeof handle.read>) => {
          const result = await handle.read(...parameters);
          if (!substituted && result.bytesRead) {const bytes = result.buffer as Buffer, index = bytes.indexOf('not started'); expect(index).toBeGreaterThan(-1); bytes[index] = 'N'.charCodeAt(0); substituted = true;}
          return result;
        };
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(substituted).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.runs.every(row => Object.values(row.references).every(lane => lane.status !== 'complete'))).toBe(true);
    expect(result.runs[0]!.references.capture.issues).toContainEqual(expect.objectContaining({kind: 'identity', path: 'capture-status.json', reason: 'Original bytes changed between owned reads'}));
  });
  it('requires the original incomplete atomic temporary reason for a genuine admitted temporary', async () => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', temporary = 'fixture.json.00000000-0000-4000-8000-000000000001.tmp';
    await writeFile(join(f.root, prefix + temporary), 'partial original');
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
    capture.payloads.push({path: temporary, status: 'partial', reason: 'incomplete atomic temporary: interrupted write'}); capture.payloads.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    const save = async (reason: string, added: string[] = []) => {
      capture.payloads.find(file => file.path === temporary)!.reason = reason; await f.json(prefix + 'capture-status.json', capture);
      const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
      raw.files = raw.files.filter(file => file.path !== temporary);
      const bytes = await readFile(join(f.root, prefix + temporary)); raw.files.push({path: temporary, status: 'partial', reason, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}); raw.files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
      const file = raw.files.find(file => file.path === 'capture-status.json')!, statusBytes = await readFile(join(f.root, prefix + file.path));file.byteLength=statusBytes.length;file.sha256=createHash('sha256').update(statusBytes).digest('hex');
      await f.json(prefix + 'raw-inventory.json', f.schemas.comparisonRawInventorySchema.parse(raw)); await f.refreshSeal(added);
    };
    await save('incomplete atomic temporary: interrupted write', [prefix + temporary]); const positive = await loadComparisonInvocation(f.root);
    expect(positive.byteIntegrity.seal).toBe('byte-closed'); expect(positive.runs[0]!.references.inventory.status).toBe('complete');
    await save('unrelated reason'); const negative = await loadComparisonInvocation(f.root); expect(negative.byteIntegrity.seal).toBe('byte-closed');
    expect(negative.runs[0]!.references.inventory.issues).toContainEqual(expect.objectContaining({path: temporary, reason: 'Temporary payload must preserve incomplete atomic temporary reason'}));
  });
  it.each(['beforeCopy','afterCopy','originalSha256'] as const)('checks contradictory available %s in a partial acquisition', async stage => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', name = 'provenance/acquisition.json';
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root,prefix+name),'utf8'))), member=acquisition.members[0]!;
    acquisition.status='partial';acquisition.reason='source mutation recorded';member.status='partial';member.reason='source mutation recorded';
    if(stage==='originalSha256')member.originalSha256='0'.repeat(64);else if(member[stage].status==='available')member[stage].value.sha256='0'.repeat(64);
    await f.json(prefix+name,f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition));
    const raw=f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root,prefix+'raw-inventory.json'),'utf8'))),file=raw.files.find(file=>file.path===name)!,bytes=await readFile(join(f.root,prefix+name));file.byteLength=bytes.length;file.sha256=createHash('sha256').update(bytes).digest('hex');
    await f.json(prefix+'raw-inventory.json',raw);await f.refreshSeal();const result=await loadComparisonInvocation(f.root);expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.runs[0]!.references.acquisition.issues).toContainEqual(expect.objectContaining({kind:'integrity',path:'provenance/source/example.ts',reason:stage==='originalSha256'?'Acquisition original digest differs from available copied measurement':`Acquisition ${stage} measurement differs from available copied measurement`}));
  });
  it('compares available original source stages while copied measurement remains unknown', async () => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory+'/', name='provenance/acquisition.json';
    const acquisition=f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root,prefix+name),'utf8'))),member=acquisition.members[0]!;
    acquisition.status='partial';acquisition.reason='copy unavailable';member.status='partial';member.reason='copy unavailable';member.copied={status:'unavailable',reason:'copy unavailable'};
    const save=async()=>{
      await f.json(prefix+name,f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition));
      const raw=f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root,prefix+'raw-inventory.json'),'utf8'))),file=raw.files.find(file=>file.path===name)!,bytes=await readFile(join(f.root,prefix+name));file.byteLength=bytes.length;file.sha256=createHash('sha256').update(bytes).digest('hex');await f.json(prefix+'raw-inventory.json',raw);await f.refreshSeal();
    };
    await save();const positive=await loadComparisonInvocation(f.root);expect(positive.byteIntegrity.seal).toBe('byte-closed');expect(positive.runs[0]!.references.acquisition.status).toBe('partial');expect(positive.runs[0]!.references.acquisition.issues.some(issue=>issue.kind==='integrity')).toBe(false);
    if(member.afterCopy.status!=='available')throw new Error('Canonical actual source stage absent');member.afterCopy.value.sha256='0'.repeat(64);
    await save();const negative=await loadComparisonInvocation(f.root);expect(negative.byteIntegrity.seal).toBe('byte-closed');
    expect(negative.runs[0]!.references.acquisition.issues).toContainEqual(expect.objectContaining({kind:'integrity',path:'provenance/source/example.ts',reason:'Acquisition afterCopy measurement differs from available beforeCopy measurement'}));
    expect(member.copied).toEqual({status:'unavailable',reason:'copy unavailable'});
  });
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => ([1, 2, 3] as const).map(repetition => ({version, repetition}))))('retains all $repetition repetitions with independently closed references in $version', async ({version, repetition}) => {
    const f = await referenceFixture(version, undefined, repetition), result = await loadComparisonInvocation(f.root);
    expect(result.runs).toHaveLength(repetition * 12); expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.runs.every(row => Object.values(row.references).every(lane => lane.status === 'complete'))).toBe(true);
    expect(result.runs.every(row => row.captureValidation?.status === 'failed')).toBe(true);
  });
  it.each(['inventory-order', 'inventory-missing', 'capture-payload', 'validation-reason', 'copied-digest', 'partial-copy'] as const)('rejects contradictory %s with a current outer seal', async mutation => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/';
    const load = async (name: string) => JSON.parse(await readFile(join(f.root, prefix + name), 'utf8'));
    if (mutation.startsWith('inventory-')) {
      const value = f.schemas.comparisonRawInventorySchema.parse(await load('raw-inventory.json'));
      if (mutation === 'inventory-order') value.files.reverse(); else value.files.pop();
      await f.json(prefix + 'raw-inventory.json', f.schemas.comparisonRawInventorySchema.parse(value));
    } else if (mutation === 'capture-payload') {
      const value = f.schemas.comparisonCaptureStatusSchema.parse(await load('capture-status.json')); value.payloads.pop();
      await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(value));
    } else if (mutation === 'validation-reason') {
      const value = f.schemas.comparisonValidationSchema.parse(await load('validation.json')); value.reasons = ['different original failure'];
      await f.json(prefix + 'validation.json', f.schemas.comparisonValidationSchema.parse(value));
    } else {
      const value = f.schemas.comparisonProvenanceAcquisitionSchema.parse(await load('provenance/acquisition.json')), member = value.members[0]!;
      if (mutation === 'copied-digest') {
        member.originalSha256 = '0'.repeat(64);
        for (const stage of [member.beforeCopy, member.copied, member.afterCopy]) if (stage.status === 'available') stage.value.sha256 = '0'.repeat(64);
      }
      if (mutation === 'partial-copy') {value.status = 'partial'; value.reason = 'copy interrupted'; member.status = 'partial'; member.reason = 'copy interrupted'; member.copied = {status: 'unavailable', reason: 'copy interrupted'};}
      await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(value));
    }
    // Rebind the genuine inventory to modified payload bytes, except when testing the inventory itself.
    if (!mutation.startsWith('inventory-')) {
      const value = f.schemas.comparisonRawInventorySchema.parse(await load('raw-inventory.json'));
      for (const file of value.files) {const bytes = await readFile(join(f.root, prefix + file.path)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex');}
      await f.json(prefix + 'raw-inventory.json', value);
    }
    await f.refreshSeal(); const result = await loadComparisonInvocation(f.root), row = result.runs[0]!;
    expect(result.byteIntegrity.seal).toBe('byte-closed');
    const lane = mutation.startsWith('inventory-') ? row.references.inventory : mutation === 'capture-payload' || mutation === 'validation-reason' ? row.references.capture : row.references.acquisition;
    expect(lane.status).toBe('partial'); expect(lane.issues.length).toBeGreaterThan(0);
    expect(row.captureValidation?.status).toBe('failed');
  });
  it('revokes every earlier complete reference when an original is replaced during final inspection', async () => {
    const f = await referenceFixture('2.1.0'), target = join(f.root, f.runs[0]!.artifactDirectory, 'provenance/source/example.ts');
    const replacement = join(f.root, '..', 'reference-replacement.json'); await writeFile(replacement, await readFile(target));
    const original = fs.opendir.bind(fs); let rootOpens = 0, replaced = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      if (String(args[0]) === f.root && ++rootOpens === 3) {await rename(replacement, target); replaced = true;}
      return original(...args);
    });
    const result = await loadComparisonInvocation(f.root); expect(replaced).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    for (const row of result.runs) for (const lane of Object.values(row.references)) {
      expect(lane.status).toBe('partial'); expect(lane.issues).toContainEqual(expect.objectContaining({kind: 'integrity', reason: 'Original invocation ownership or membership was not closed'}));
    }
  });
  it.each([undefined, null, false, 0, ''])('revokes all reference lanes on genuine final directory-close failure %j', async originalError => {
    const f = await referenceFixture('2.1.0'), original = fs.opendir.bind(fs); let rootOpens = 0, rejected = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const dir = await original(...args); if (String(args[0]) !== f.root || ++rootOpens !== 3) return dir;
      return new Proxy(dir, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); rejected = true; throw originalError;};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.runs.every(row => Object.values(row.references).every(lane => lane.status === 'partial'))).toBe(true);
    const failure = result.physicalInventory.ioFailures.find(row => row.operation === 'directory-close' && row.path === '.');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it.each([undefined, null, false, 0, ''])('retains genuine falsy owned reference-document close failure %j', async originalError => {
    const f = await referenceFixture('2.1.0'), path = f.runs[0]!.artifactDirectory + '/capture-status.json', target = join(f.root, path), original = fs.open.bind(fs);
    let opens = 0, rejected = false;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const fd = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return fd;
      return new Proxy(fd, {get(handle, key) {
        if (key === 'close') return async () => {await handle.close(); rejected = true; throw originalError;};
        const value: unknown = Reflect.get(handle, key, handle); return typeof value === 'function' ? value.bind(handle) : value;
      }});
    });
    const result = await loadComparisonInvocation(f.root); expect(rejected).toBe(true); expect(result.byteIntegrity.seal).toBe('partial');
    expect(result.runs.every(row => Object.values(row.references).every(lane => lane.status !== 'complete'))).toBe(true);
    expect(result.runs[0]!.references.capture.issues).toContainEqual(expect.objectContaining({kind: 'unreadable', path: 'capture-status.json'}));
    const failure = result.byteIntegrity.ioFailures.find(row => row.operation === 'close' && row.path === path);
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(originalError);
  });
  it.each(['present-partial', 'declared-absent', 'unknown-destination'] as const)('retains copied-unavailable %s facts without inferring zero bytes or absence', async mode => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', source = 'provenance/source/example.ts';
    const acquisition = f.schemas.comparisonProvenanceAcquisitionSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'provenance/acquisition.json'), 'utf8'))), member = acquisition.members[0]!;
    acquisition.status = 'partial'; acquisition.reason = 'original copy unavailable'; member.status = 'partial'; member.reason = 'original copy unavailable'; member.copied = {status: 'unavailable', reason: 'original copy unavailable'};
    if (mode === 'unknown-destination') {member.key = 'unregistered.ts'; member.path = 'provenance/source/unregistered.ts';}
    await f.json(prefix + 'provenance/acquisition.json', f.schemas.comparisonProvenanceAcquisitionSchema.parse(acquisition));
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
    if (mode === 'declared-absent') {
      await unlink(join(f.root, prefix + source)); capture.payloads = capture.payloads.filter(file => file.path !== source);
      capture.unavailablePaths = [{path: source, reason: 'original copy unavailable'}]; f.seal.absentMembers = [{path: prefix + source, reason: 'original copy unavailable'}];
    } else if (mode === 'present-partial') {const payload = capture.payloads.find(file => file.path === source)!; payload.status = 'partial'; payload.reason = 'original copy unavailable';}
    await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(capture));
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    if (mode === 'declared-absent') raw.files = raw.files.filter(file => file.path !== source);
    for (const file of raw.files) {
      const bytes = await readFile(join(f.root, prefix + file.path)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex');
      if (file.path === source && mode === 'present-partial') {file.status = 'partial'; file.reason = 'original copy unavailable';}
    }
    await f.json(prefix + 'raw-inventory.json', f.schemas.comparisonRawInventorySchema.parse(raw)); await f.refreshSeal([], mode === 'declared-absent' ? [prefix + source] : []);
    const result = await loadComparisonInvocation(f.root), row = result.runs[0]!;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(row.references.inventory.status).toBe('complete'); expect(row.references.capture.status).toBe('complete');
    expect(row.references.acquisition).toMatchObject({status: 'partial', reportedStatus: 'partial'});
    expect(result.byteIntegrity.files.some(file => file.path === prefix + source)).toBe(mode !== 'declared-absent');
    expect(result.root.seal.value?.absentMembers.some(file => file.path === prefix + source)).toBe(mode === 'declared-absent');
    expect(result.byteIntegrity.files.some(file => file.path.endsWith('/unregistered.ts'))).toBe(false);
  });
  it.each(['2.0.0', '2.1.0'] as const)('checks references for %s without promoting original partial capture or failed verdicts', async version => {
    const f = await referenceFixture(version), result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs).toHaveLength(12);
    for (const row of result.runs) expect(row).toMatchObject({captureValidation: {status: 'failed', reasons: ['not started']}, references: {
      inventory: {status: 'complete', reportedStatus: 'partial'}, capture: {status: 'complete', reportedStatus: 'partial'}, acquisition: {status: 'complete', reportedStatus: 'complete'},
    }});
    expect(result.collection.status).toBe('partial'); expect(result.collection.onDiskConsistencyOnly).toBe(true);
  });
  it.each(['2.0.0', '2.1.0'] as const)('checks evidence and conditional instrumentation in selected family %s', async version => {
    const f = await referenceFixture(version), prefix = f.runs[0]!.artifactDirectory + '/', unavailable = {status: 'unavailable', reason: 'not started'};
    const probe = {intervalMs: 50, callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable};
    const instrumentation = f.schemas.comparisonInstrumentationSchema.parse({runtimeProbe: probe, domProbe: {...probe, selectionStrategy: 'bounded-visible-candidates'}, scrollProbe: probe, transportDrain: probe, eventTiming: unavailable, loaf: unavailable, buffers: [],
      ...(version === '2.1.0' ? {freshScrollProbe: {samplingMode: 'on-demand', callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable}} : {})});
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
    capture.evidenceMetadata = {status: 'available'};
    capture.finalPageInstrumentation = {status: 'available', value: instrumentation};
    await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(capture));
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    for (const file of raw.files) {const bytes = await readFile(join(f.root, prefix + file.path)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex');}
    const evidence = f.schemas.comparisonEvidenceSchema.parse({...raw, unavailableFiles: [], trace: unavailable, instrumentation});
    await f.json(prefix + 'evidence.json', evidence); await unlink(join(f.root, prefix + 'raw-inventory.json'));
    await f.refreshSeal([prefix + 'evidence.json'], [prefix + 'raw-inventory.json']);
    const positive = await loadComparisonInvocation(f.root); expect(positive.byteIntegrity.seal).toBe('byte-closed');
    expect(positive.runs[0]!.references.capture.status).toBe('complete'); expect(positive.runs[0]!.references.inventory.status).toBe('complete');
    evidence.instrumentation.runtimeProbe.callbackDurationTotalMs = 1;
    await f.json(prefix + 'evidence.json', f.schemas.comparisonEvidenceSchema.parse(evidence)); await f.refreshSeal();
    const negative = await loadComparisonInvocation(f.root); expect(negative.byteIntegrity.seal).toBe('byte-closed');
    expect(negative.runs[0]!.references.capture.issues).toContainEqual(expect.objectContaining({reason: 'Capture instrumentation differs from original evidence'}));
  });
  it.each(['wrong-family', 'wrong-identity', 'missing-capture', 'missing-acquisition'] as const)('preserves byte closure but refuses %s reference authority', async mutation => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/';
    if (mutation.startsWith('missing-')) {
      const name = mutation === 'missing-capture' ? 'capture-status.json' : 'provenance/acquisition.json';
      await unlink(join(f.root, prefix + name));
      const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
      raw.files = raw.files.filter(file => file.path !== name); await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal([], [prefix + name]);
    } else {
      const capture = JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'));
      if (mutation === 'wrong-family') {capture.collectorVersion = '2.0.0'; capture.analyzerVersion = '2.0.0';} else capture.caseIndex = 1;
      await f.json(prefix + 'capture-status.json', capture);
      const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), file = raw.files.find(file => file.path === 'capture-status.json')!;
      const bytes = await readFile(join(f.root, prefix + file.path)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex');
      await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    }
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed');
    const lane = mutation === 'missing-acquisition' ? result.runs[0]!.references.acquisition : result.runs[0]!.references.capture;
    expect(lane.status).toBe(mutation.startsWith('missing-') ? 'unavailable' : 'partial'); expect(lane.issues).not.toHaveLength(0);
  });
  it.each(['raw-inventory.json', 'provenance/acquisition.json'] as const)('rejects stale original identity and family in %s', async name => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/';
    const value = JSON.parse(await readFile(join(f.root, prefix + name), 'utf8')); value.caseIndex = 1;
    await f.json(prefix + name, value);
    const refreshInventory = async () => {
      if (name === 'raw-inventory.json') return;
      const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), file = raw.files.find(file => file.path === name)!;
      const bytes = await readFile(join(f.root, prefix + name)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex'); await f.json(prefix + 'raw-inventory.json', raw);
    };
    await refreshInventory(); await f.refreshSeal(); let result = await loadComparisonInvocation(f.root);
    const key = name === 'raw-inventory.json' ? 'inventory' : 'acquisition';
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.references[key].issues).toContainEqual(expect.objectContaining({kind: 'identity', path: name}));
    value.caseIndex = 0; value.collectorVersion = '2.0.0'; value.analyzerVersion = '2.0.0';
    await f.json(prefix + name, value); await refreshInventory(); await f.refreshSeal(); result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]!.references[key].issues).toContainEqual(expect.objectContaining({kind: 'malformed', path: name}));
  });
  it('compares exact capture absence reasons independently of acquisition unavailability', async () => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/', absentPath = 'fixture.json';
    f.seal.absentMembers = [{path: prefix + absentPath, reason: 'never acquired'}];
    const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
    capture.unavailablePaths = [{path: absentPath, reason: 'never acquired'}];
    const save = async () => {
      await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(capture));
      const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8'))), file = raw.files.find(file => file.path === 'capture-status.json')!;
      const bytes = await readFile(join(f.root, prefix + file.path)); file.byteLength = bytes.length; file.sha256 = createHash('sha256').update(bytes).digest('hex'); await f.json(prefix + 'raw-inventory.json', raw); await f.refreshSeal();
    };
    await save(); const positive = await loadComparisonInvocation(f.root); expect(positive.byteIntegrity.seal).toBe('byte-closed'); expect(positive.runs[0]!.references.capture.status).toBe('complete');
    capture.unavailablePaths[0]!.reason = 'different reason'; await save(); const negative = await loadComparisonInvocation(f.root);
    expect(negative.byteIntegrity.seal).toBe('byte-closed'); expect(negative.runs[0]!.references.capture.issues).toContainEqual(expect.objectContaining({reason: 'Capture unavailable references differ from original declared absences'}));
  });
  it('rejects stale inventory digest despite a current outer seal', async () => {
    const f = await referenceFixture('2.1.0', 'stale-inventory'), result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toMatchObject({references: {inventory: {status: 'partial', issues: [expect.objectContaining({path: 'provenance/source/example.ts', reason: 'Inventory digest differs from measured original or dataset seal'})]}}});
  });
  it('rejects an orphan retained acquisition payload with current inventory and seal bytes', async () => {
    const f = await referenceFixture('2.1.0', 'orphan-acquisition'), result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[0]).toMatchObject({references: {inventory: {status: 'complete'}, acquisition: {status: 'partial', issues: [expect.objectContaining({path: 'provenance/source/example.ts', reason: 'Observed acquisition payload has no acquisition member'})]}}});
  });
  it.each(['files', 'unavailableFiles', 'combined'] as const)('rejects oversized selected-schema-valid evidence %s before reference traversal', async field => {
    const f = await referenceFixture('2.1.0'), prefix = f.runs[0]!.artifactDirectory + '/';
    const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
    const {files: _files, reason: _reason, ...identityAndStatus} = raw, unavailable = {status: 'unavailable', reason: 'not started'};
    const probe = {intervalMs: 50, callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable};
    const evidence = f.schemas.comparisonEvidenceSchema.parse({...identityAndStatus, reason: 'not started', files: Array.from({length: field === 'files' ? 4097 : field === 'combined' ? 2048 : 0}, (_, index) => ({path: 'provenance/source/oversized-' + index + '.ts', status: 'complete', byteLength: 1, sha256: 'a'.repeat(64)})), unavailableFiles: Array.from({length: field === 'unavailableFiles' ? 4097 : field === 'combined' ? 2049 : 0}, (_, index) => ({path: 'provenance/source/absent-' + index + '.ts', reason: 'not acquired'})), trace: unavailable,
      instrumentation: {runtimeProbe: probe, domProbe: {...probe, selectionStrategy: 'bounded-visible-candidates'}, scrollProbe: probe, transportDrain: probe, eventTiming: unavailable, loaf: unavailable, buffers: [], freshScrollProbe: {samplingMode: 'on-demand', callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable}}});
    await f.json(prefix + 'evidence.json', evidence); await unlink(join(f.root, prefix + 'raw-inventory.json'));
    await f.refreshSeal([prefix + 'evidence.json'], [prefix + 'raw-inventory.json']);
    const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed');
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', path: prefix + 'evidence.json', limitName: 'slotCandidates', limit: 4096, observed: 4097, observation: 'exact'}));
    expect(result.runs[0]!.references.inventory.additionalIssueCount).toBe(0);
  });
});
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
  it('admits genuine fresh sealed originals without upgrading partial collection', async () => {
    const f = await byteFixture(1, '2.1.0');
    const schemas = comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});
    expect(schemas.comparisonCaptureInvocationSchema.parse(f.ledger)).toEqual(f.ledger);
    expect(schemas.comparisonDatasetInventorySchema.shape.invocationClaim.parse(f.claim)).toEqual(f.claim);
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});
    expect(result.scheduled).toBe(12); expect(result.runs).toHaveLength(12);
    expect(result.runs.every(row => row.identity.collectorVersion === '2.1.0' && row.descriptor !== null && row.captureValidation !== null)).toBe(true);
    expect(result.byteIntegrity).toMatchObject({status: 'complete', admission: 'within-limit', observedUniqueBytes: await f.total(), seal: 'byte-closed'});
    expect(result.collection).toMatchObject({status: 'partial', onDiskConsistencyOnly: true});
    expect(result.loadingIssues).toHaveLength(12);
    expect(result.loadingIssues.every(issue => issue.kind === 'absent' && issue.path.endsWith('/manifest.json'))).toBe(true);
  });
  it.each([['2.0.0', '2.1.0'], ['2.1.0', '2.0.0']] as const)('blocks cross-root %s ledger / %s claim before any dependent IO', async (ledgerVersion, claimVersion) => {
    const f = await rootFixture(1, 'headless', ledgerVersion);
    await f.json('invocation-claim.json', {...f.claim, collectorVersion: claimVersion, analyzerVersion: claimVersion});
    const original = fs.open.bind(fs), opened: string[] = [];
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toBeNull(); expect(result.scheduled).toBeNull(); expect(result.runs).toEqual([]);
    expect(result.root.ledger.fact).not.toBeNull(); expect(result.root.claim.fact).not.toBeNull();
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation-claim.json', kind: 'malformed', reason: expect.stringMatching(/contradic|differ.*famil/i)}));
    expect(opened.some(path => path.endsWith('/dataset-seal.json') || path.endsWith('/descriptor.json'))).toBe(false);
  });
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
  it.each([['2.0.0', '2.1.0'], ['9.0.0', '9.0.0']])('rejects unsupported root pair %s/%s before dependent descriptor IO', async (collectorVersion, analyzerVersion) => {
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
    expect(result.root.claim.value).toBeNull(); expect(result.runs).toHaveLength(0); expect(result.family).toBeNull();
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation-claim.json', kind: 'malformed'}));
  });
  it.each([['9.0.0', '9.0.0'], ['2.0.0', '2.1.0']])('rejects a later explicit unsupported claim %s/%s behind a valid ledger', async (collectorVersion, analyzerVersion) => {
    const f = await rootFixture(); await f.json('invocation-claim.json', {...f.claim, collectorVersion, analyzerVersion});
    const original = fs.open.bind(fs), opened: string[] = [];
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {opened.push(String(args[0])); return original(...args);});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toBeNull(); expect(result.runs).toEqual([]);
    expect(result.root.ledger.value).toEqual(f.ledger); expect(result.root.claim.value).toBeNull();
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path: 'invocation-claim.json', reason: expect.stringMatching(/unsupported.*pair/i)}));
    expect(opened.some(path => path.endsWith('/dataset-seal.json') || path.endsWith('/descriptor.json'))).toBe(false);
  });
  it('retains fresh claim bytes but manufactures no rows when its ledger is absent', async () => {
    const f = await rootFixture(1, 'headless', '2.1.0'); await unlink(join(f.root, 'invocation.json'));
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});
    expect(result.root.claim.value).toEqual(f.claim); expect(result.root.ledger.availability.status).toBe('absent');
    expect(result.scheduled).toBeNull(); expect(result.runs).toEqual([]); expect(result.collection.status).toBe('unavailable');
  });
  it('preserves fresh ledger rows for a structurally malformed agreeing claim', async () => {
    const f = await rootFixture(1, 'headless', '2.1.0'); await f.json('invocation-claim.json', {...f.claim, extra: true});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'});
    expect(result.root.claim.value).toBeNull(); expect(result.root.claim.availability.status).toBe('malformed');
    expect(result.runs).toHaveLength(12); expect(result.runs.every(row => row.descriptor !== null)).toBe(true);
  });
  it.each([[2, 'headless', 24], [3, 'headed', 36]] as const)('retains all fresh original rows for %i rounds/%s', async (rounds, mode, count) => {
    const f = await rootFixture(rounds, mode, '2.1.0'), result = await loadComparisonInvocation(f.root);
    expect(result.scheduled).toBe(count); expect(result.runs).toHaveLength(count);
    expect(result.runs.map(row => row.identity.repetition)).toEqual(f.runs.map(row => row.repetition));
    expect(result.runs.every(row => row.descriptor?.collectorVersion === '2.1.0')).toBe(true);
    expect(result.collection.status).toBe('partial');
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
  it.each([['2.0.0', false], ['2.0.0', true], ['2.1.0', false], ['2.1.0', true]] as const)('reads %s manifest adapter.profile identity explicitly (mismatch=%s)', async (version, mismatch) => {
    const f = await rootFixture(1, 'headless', version), row = f.runs[0]!, workload = createLongThreadMatrix(1).find(value => value.scenarioId === row.scenarioId)!.workload;
    const schemas = version === '2.1.0' ? comparisonSchemasForVersionPair({collectorVersion: '2.1.0', analyzerVersion: '2.1.0'}) : comparisonSchemasForVersionPair({collectorVersion: '2.0.0', analyzerVersion: '2.0.0'});
    const manifest = schemas.comparisonManifestSchema.parse({...f.versions, repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex,
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
    const wrongFamily = version === '2.1.0' ? '2.0.0' : '2.1.0';
    await f.json(row.artifactDirectory + '/manifest.json', {...manifest, collectorVersion: wrongFamily, analyzerVersion: wrongFamily});
    const changed = await loadComparisonInvocation(f.root);
    expect(changed.runs[0]!.manifest).toBeNull(); expect(changed.runs[0]!.rawAvailability.manifest.status).toBe('malformed');
    await f.json(row.artifactDirectory + '/manifest.json', {...manifest, extra: true});
    expect((await loadComparisonInvocation(f.root)).runs[0]!.rawAvailability.manifest.status).toBe('malformed');
  });
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => (['descriptor.json', 'validation.json', 'exceptions.json', 'dataset-seal.json'] as const).map(name => [version, name] as const)))('rejects wrong-family %s/%s against its genuine rebound seal', async (version, name) => {
    const f = await byteFixture(1, version), path = name === 'dataset-seal.json' ? name : f.runs[0]!.artifactDirectory + '/' + name;
    const canonical = JSON.parse(await readFile(join(f.root, path), 'utf8')), wrongFamily = version === '2.1.0' ? '2.0.0' : '2.1.0';
    await f.json(path, {...canonical, collectorVersion: wrongFamily, analyzerVersion: wrongFamily});
    const bytes = await readFile(join(f.root, path)), fact = {byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
    if (name !== 'dataset-seal.json') await f.json('dataset-seal.json', {...f.seal, members: f.members.map(member => member.path === path ? {...member, ...fact} : member)});
    const result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: version, analyzerVersion: version});
    expect(result.loadingIssues).toContainEqual(expect.objectContaining({path, kind: 'malformed', reason: expect.stringMatching(/strict raw schema/i)}));
    expect(result.byteIntegrity.files.find(member => member.path === path)?.fact).toEqual(fact);
    if (name === 'dataset-seal.json') {expect(result.root.seal.value).toBeNull(); expect(result.byteIntegrity.seal).toBe('partial');}
    else {expect(result.runs[0]!.loadingIssues).toContainEqual(expect.objectContaining({path, kind: 'malformed'})); expect(result.loadingIssues.some(issue => issue.kind === 'integrity' && issue.path === path)).toBe(false);}
    expect(await readFile(join(f.root, path))).toEqual(bytes);
  });
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => (['invocationClaim', 'invocationLedger', 'slots'] as const).map(name => [version, name] as const)))('rejects %s seal with a wrong-family embedded %s', async (version, name) => {
    const f = await byteFixture(1, version), other = version === '2.1.0' ? '2.0.0' : '2.1.0';
    const pair = {collectorVersion: other, analyzerVersion: other};
    const replacement = name === 'slots' ? f.seal.slots.map((slot, i) => i ? slot : {...slot, identity: {...slot.identity, ...pair}}) : {...f.seal[name], ...pair};
    await f.json('dataset-seal.json', {...f.seal, [name]: replacement});
    const bytes = await readFile(join(f.root, 'dataset-seal.json')), result = await loadComparisonInvocation(f.root);
    expect(result.family).toEqual({collectorVersion: version, analyzerVersion: version});
    expect(result.root.seal.value).toBeNull(); expect(result.root.seal.availability.status).toBe('malformed');
    expect(result.root.seal.fact).toEqual({byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
    expect(result.byteIntegrity.seal).toBe('partial'); expect(result.collection.status).toBe('partial');
    expect(await readFile(join(f.root, 'dataset-seal.json'))).toEqual(bytes);
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

// Synthetic trace/metadata records on real owned files; no native oracle or captured code execution.
async function rendererDiagnosticFixture(version: '2.0.0' | '2.1.0', journey: 'follow' | 'history-reading' = 'follow') {
  const selected = longThreadCaseOrder(1).findIndex(id => id.includes('-' + journey + '-'));
  const f = await finalContentFixture(version, selected), prefix = f.prefix, identity = {...f.versions, repetition: f.row.repetition, scenarioId: f.row.scenarioId, round: f.row.round, caseIndex: f.row.caseIndex, adapterProfile: f.row.adapterProfile};
  const unavailable = {status: 'unavailable', reason: 'synthetic unavailable'}, probe = {intervalMs: 50, callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable};
  const instrumentation = f.schemas.comparisonInstrumentationSchema.parse({runtimeProbe: probe, domProbe: {...probe, selectionStrategy: 'bounded-visible-candidates'}, scrollProbe: probe, transportDrain: probe, eventTiming: unavailable, loaf: unavailable, buffers: [], ...(version === '2.1.0' ? {freshScrollProbe: {samplingMode: 'on-demand', callbacks: 0, callbackDurationTotalMs: 0, maximumObservedGapMs: unavailable}} : {})});
  const metadata = f.schemas.comparisonCaptureMetadataSchema.parse({...identity, browserProtocol: {protocolVersion: '1.3', product: 'Chrome/156', revision: 'synthetic', userAgent: 'synthetic', jsVersion: 'synthetic'}, chromiumDownloadRevision: 'synthetic', playwrightVersion: '1.64.0', instrumentation: {sourceHashes: {'probe.ts': 'a'.repeat(64)}, installerSha256: 'b'.repeat(64), probeIntervalMs: 50, limits: COMPARISON_CAPTURE_LIMITS}});
  const sequence = journey === 'follow' ? ['streaming-follow', 'composer-input', 'streaming-follow'] : ['streaming-follow', 'history-reading', 'return-to-response', 'streaming-follow', 'composer-input', 'streaming-follow'];
  const phases = f.schemas.comparisonPhasesSchema.parse({...identity, status: 'complete', openPhase: null, instances: sequence.map((phase, i) => ({phase, instanceId: String(i), startMs: i * 10 + 1, endMs: i * 10 + 9, ...comparisonPhaseMarks(phase, String(i))}))});
  const event = (name: string, ph: string, ts: number, args: Record<string, unknown> = {}, local = '0x1') => ({name, ph, ts, pid: 10, tid: 20, cat: 'blink.user_timing', args, id2: {local}});
  const trace = {traceEvents: [event('TracingStartedInBrowser', 'I', 1, {data: {frames: [{frame: 'root', url: 'https://synthetic.test/', processId: 10}]}}), event('thread_name', 'M', 0, {name: 'CrRendererMain'}), ...phases.instances.flatMap((phase, i) => {
    const start = i * 1000 + 100, end = start + 800;
    return [event(phase.startMark, 'I', start, {data: {startTime: phase.startMs}}), event(phase.endMark, 'I', end, {data: {startTime: phase.endMs}}), ...[0, 1].flatMap(j => [event('AnimationFrame', 'b', start + 10 + j * 200, {id: `${i}-${j}`}, '0x1'), event('AnimationFrame', 'e', start + 20 + j * 200, {}, '0x1'), event('AnimationFrame::Presentation', 'n', start + 30 + j * 200, {id: `${i}-${j}`})])];
  })]};
  const corePrecondition = parseComparisonRendererPresentation({trace, target: {appURL: 'https://synthetic.test/', frameId: 'root'}, phases: phases.instances.map(p => ({phase: p.phase as 'streaming-follow' | 'composer-input' | 'history-reading' | 'return-to-response', instanceId: p.instanceId, startMark: p.startMark, endMark: p.endMark})), evidencePaths: ['trace.json']});
  expect(corePrecondition.presentation.status).toBe('available');
  const completion = {status: 'available', value: {observedAtHostMs: 100, dataLossOccurred: false, stream: 'synthetic-stream', traceFormat: 'json', streamCompression: 'none'}};
  const auxiliary = f.schemas.comparisonTraceAuxiliarySchema.parse({...identity, cap: 256, observedCallbacks: 0, retainedCallbacks: 0, droppedCallbacks: 0, invalidCallbacks: 0, status: 'complete', completion});
  const declaration = {status: 'available', format: 'cdp-json', file: 'trace.json', categories: [...PRESENTATION_TRACE_CATEGORIES], complete: true, tracingComplete: {status: 'available', value: {dataLossOccurred: false, stream: 'synthetic-stream', traceFormat: 'json', streamCompression: 'none'}}, bufferUsage: [], presentation: {status: 'available', value: {capability: PRESENTATION_CAPABILITY, contractVersion: PRESENTATION_CONTRACT_VERSION, sessionTarget: 'page', targetId: 'target', appURL: 'https://synthetic.test/', frameTree: {frameTree: {frame: {id: 'root', url: 'https://synthetic.test/'}}}, frameTreeCapturePoint: 'before-tracing', isolatedBrowserProcess: true, singleWorkloadPage: true}}};
  await f.json(prefix + 'phases.json', phases); await f.json(prefix + 'trace.json', trace); await f.json(prefix + 'trace-auxiliary.json', auxiliary); await f.json(prefix + 'capture-metadata.json', metadata);
  const capture = f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8')));
  Object.assign(capture, f.schemas.comparisonCaptureStatusSchema.parse({...capture, captureMetadata: {status: 'available', value: metadata}})); capture.evidenceMetadata = {status: 'available'}; capture.traceEof = {status: 'available', value: {observedAtHostMs: 101, clockDomain: 'host-monotonic-ms'}};
  await f.json(prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(capture));
  await f.refreshSlot(selected, ['phases.json', 'trace.json', 'trace-auxiliary.json', 'capture-metadata.json']);
  Object.assign(capture, f.schemas.comparisonCaptureStatusSchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'capture-status.json'), 'utf8'))));
  const raw = f.schemas.comparisonRawInventorySchema.parse(JSON.parse(await readFile(join(f.root, prefix + 'raw-inventory.json'), 'utf8')));
  const evidence = f.schemas.comparisonEvidenceSchema.parse({...raw, trace: declaration, instrumentation, unavailableFiles: []});
  await f.json(prefix + 'evidence.json', evidence); await unlink(join(f.root, prefix + 'raw-inventory.json'));
  const refresh = async () => {
    for (const file of evidence.files) {const b = await readFile(join(f.root, prefix + file.path)); file.byteLength = b.length; file.sha256 = createHash('sha256').update(b).digest('hex');}
    await f.json(prefix + 'evidence.json', f.schemas.comparisonEvidenceSchema.parse(evidence));
    await f.refreshSeal(f.seal.members.some(m => m.path === prefix + 'evidence.json') ? [] : [prefix + 'evidence.json'], [prefix + 'raw-inventory.json']);
  };
  await refresh();
  return {...f, phases, trace, auxiliary, metadata, capture, evidence, refresh};
}
const rendererCaption = {
  metricScope: 'matched target Blink AnimationFrame lifecycle/callback records',
  measurementMeaning: 'conditional original trace-window event-association diagnostic; all compositor/display frame coverage unverified',
  unresolvedDomains: ['serialized-phase-origin', 'independent-oracle', 'capture-quality', 'journey-correctness', 'source-executed-authenticity', 'live-content-and-sampling', 'mode-and-cohort', 'cleanup-eligibility', 'scoring-eligibility', 'frame-emission-coverage', 'presentation-feedback-fallback', 'presentation-callback-coalescing'],
};
describe('explicit streamed trace policy', () => {
  it('preserves actual scanner opaque parse rejection and ordered falsy descriptor close without reflective masking', async () => {
    const f = await rendererDiagnosticFixture('2.1.0'), original = new Proxy({}, {getPrototypeOf() {throw 0;}}), selected = JSON.stringify(f.trace.traceEvents[0]), parse = JSON.parse, target = join(f.root, f.prefix + 'trace.json'), originalOpen = fs.open.bind(fs); let opens = 0, closes = 0;
    // Direct original synchronous seam: mock wrappers may reflect a thrown Proxy.
    JSON.parse = (...args: Parameters<typeof JSON.parse>) => {if (args[0] === selected) throw original; return Reflect.apply(parse, JSON, args);};
    try {
    const states: ReturnType<StreamedTraceAdmission['liveState']>[] = [], dispose = StreamedTraceAdmission.prototype.dispose;
    vi.spyOn(StreamedTraceAdmission.prototype, 'dispose').mockImplementation(function(this: StreamedTraceAdmission) {dispose.call(this); states.push(this.liveState());});
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const h = await originalOpen(...args); if (String(args[0]) !== target || ++opens !== 3) return h; return new Proxy(h, {get(object, key) {if (key === 'close') return async () => {closes++; await object.close(); throw '';}; const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;}});});
    const result = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'});
    expect(closes).toBe(1); expect(result.byteIntegrity.seal).toBe('partial');
    const failures = result.byteIntegrity.ioFailures.filter(row => row.path === f.prefix + 'trace.json');
    expect(failures.map(row => row.operation)).toEqual(['read', 'close']); expect(Object.is(failures[0]!.error, original)).toBe(true); expect(failures[1]!.error).toBe('');
    expect(states.length).toBeGreaterThan(0); expect(states.every(state => Object.values(state).every(value => value === 0))).toBe(true);
    expect(result.runs.every(row => row.rendererPresentationCapabilityDiagnostic.status === 'unavailable')).toBe(true);
    expect(() => serializeComparisonReport(projectComparisonReport(result))).not.toThrow();
    } finally {JSON.parse = parse;}
  });
  it('records caller-selected root policy and unknown observations when no trace was inspected', async () => {
    const f = await rootFixture(3, 'headed', '2.1.0'), legacy = await loadComparisonInvocation(f.root), streamed = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'});
    expect(streamed).toHaveProperty('tracePolicy', 'streamed-renderer-events-v1');
    expect(projectComparisonReport(streamed)).toHaveProperty('tracePolicy', 'streamed-renderer-events-v1');
    expect(streamed.runs).toHaveLength(36);
    for (const row of streamed.runs) expect(row.traceAdmission).toMatchObject({scannerCompletion: 'not-started', physicalClosure: 'unverified', completeTotals: null, observedPrefix: null, firstFailure: null, legacyWorkThreshold: {status: 'unknown-not-observed'}});
    expect(Object.hasOwn(legacy, 'tracePolicy')).toBe(false); expect(Object.hasOwn(projectComparisonReport(legacy), 'tracePolicy')).toBe(false);
    expect(legacy.runs.every(row => !Object.hasOwn(row, 'traceAdmission'))).toBe(true);
    const oldAgain = await loadComparisonInvocation(f.root, {});
    expect(serializeComparisonReport(projectComparisonReport(oldAgain))).toEqual(serializeComparisonReport(projectComparisonReport(legacy)));
  });
  it.each(['canonical', 'syntax-failure', 'unknown-parser-failure'] as const)('releases selected staging on original%s path', async mode => {
    const f = await rendererDiagnosticFixture('2.1.0'), completed: ReturnType<StreamedTraceAdmission['liveState']>[] = [], originalDispose = StreamedTraceAdmission.prototype.dispose;
    vi.spyOn(StreamedTraceAdmission.prototype, 'dispose').mockImplementation(function(this: StreamedTraceAdmission) {originalDispose.call(this); completed.push(this.liveState());});
    if (mode === 'syntax-failure') {await writeFile(join(f.root, f.prefix + 'trace.json'), JSON.stringify(f.trace).slice(0, -1) + ',"bad":NaN}'); await f.refresh();}
    if (mode === 'unknown-parser-failure') {const originalParse = JSON.parse, selected = JSON.stringify(f.trace.traceEvents[0]); vi.spyOn(JSON, 'parse').mockImplementation((...args) => {if (args[0] === selected) throw false; return Reflect.apply(originalParse, JSON, args);});}
    const result = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'});
    expect(completed.length).toBeGreaterThan(0); expect(completed.every(value => Object.values(value).every(count => count === 0))).toBe(true);
    if (mode === 'canonical') expect(result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.status).toBe('available');
    else expect(result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.status).toBe('unavailable');
    if (mode === 'unknown-parser-failure') {expect(result.byteIntegrity.seal).toBe('partial'); expect(result.byteIntegrity.ioFailures.some(value => Object.hasOwn(value, 'error') && value.error === false)).toBe(true);}
  });
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => (['follow', 'history-reading'] as const).map(journey => ({version, journey}))))('preserves complete canonical $version $journey numbers and guards', async ({version, journey}) => {
    const f = await rendererDiagnosticFixture(version, journey), legacy = await loadComparisonInvocation(f.root), streamed = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'});
    expect(legacy.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.status).toBe('available');
    expect(streamed.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic).toEqual(legacy.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic);
    expect(streamed.runs.map(row => row.captureValidation)).toEqual(legacy.runs.map(row => row.captureValidation));
    expect(legacy.runs.every(row => row.traceAdmission === undefined)).toBe(true);
    expect(streamed.runs[f.selectedIndex]!.traceAdmission).toMatchObject({scannerCompletion: 'eof-finished', physicalClosure: 'verified'});
  });
  it('retains complete same-FD physical facts when a discarded tail fails lexical admission', async () => {
    const f = await rendererDiagnosticFixture('2.1.0'), bytes = JSON.stringify(f.trace), path = f.prefix + 'trace.json';
    await writeFile(join(f.root, path), bytes.slice(0, -1) + ',"extra":{"x":0,"\\u0078":1}}'); await f.refresh();
    const result = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'}), row = result.runs[f.selectedIndex]!;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(row.rendererPresentationCapabilityDiagnostic.status).toBe('unavailable');
    expect(row.traceAdmission).toMatchObject({scannerCompletion: 'stopped', physicalClosure: 'verified', completeTotals: null, firstFailure: {kind: 'malformed'}});
  });
  it.each([undefined, null, false, 0, ''] as const)('revokes physical authority on original falsy final trace close%j after scanner EOF', async primary => {
    const f = await rendererDiagnosticFixture('2.1.0'), target = join(f.root, f.prefix + 'trace.json'), original = fs.open.bind(fs); let opens = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return handle; return new Proxy(handle, {get(object, key) {
      if (key === 'close') return async () => {await object.close(); throw primary;}; const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
    }});});
    const result = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'}), row = result.runs[f.selectedIndex]!;
    expect(result.byteIntegrity.seal).toBe('partial'); expect(row.traceAdmission).toMatchObject({scannerCompletion: 'eof-finished', physicalClosure: 'unverified'});
    expect(result.runs.every(row => row.rendererPresentationCapabilityDiagnostic.status === 'unavailable')).toBe(true);
    const failure = result.byteIntegrity.ioFailures.find(failure => failure.path === f.prefix + 'trace.json' && failure.operation === 'close');
    expect(failure).toBeDefined(); expect(Object.hasOwn(failure!, 'error')).toBe(true); expect(failure!.error).toBe(primary);
  });
  it('rejects unknown policy before opening the original root', async () => {
    const root = await mkdtemp(join(await realpath(tmpdir()), 'unknown-trace-policy-')); owned.push(root);
    const calls = vi.spyOn(fs, 'opendir');
    await expect(Reflect.apply(loadComparisonInvocation, undefined, [root, {tracePolicy: 'unreviewed'}])).rejects.toThrow(/trace policy/);
    expect(calls).not.toHaveBeenCalled();
  });
  it('admits the same canonical plus irrelevant trace beyond legacy work without changing old admission', async () => {
    const f = await rendererDiagnosticFixture('2.1.0'), original = await loadComparisonInvocation(f.root);
    const expected = original.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(expected.status).toBe('available'); expect(expected.presentation.status).toBe('available');
    const unknown = '{"name":"unused","ph":"I","a":[' + 'null,'.repeat(23) + 'null]},';
    const raw = JSON.stringify(f.trace);
    await writeFile(join(f.root, f.prefix + 'trace.json'), raw.slice(0, -2) + ',' + unknown.repeat(271000).slice(0, -1) + ']}'); await f.refresh();
    const legacy = await loadComparisonInvocation(f.root);
    expect(legacy.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.status).toBe('unavailable');
    expect(legacy.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.issues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonWorkUnits', limit: 8388608, observed: 8388609}));
    const streamed = await loadComparisonInvocation(f.root, {tracePolicy: 'streamed-renderer-events-v1'}), actual = streamed.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(actual.status).toBe('available'); expect(actual.presentation).toEqual(expected.presentation); expect(actual.guards).toEqual(expected.guards);
    expect(streamed.runs[f.selectedIndex]!.captureValidation?.status).toBe('failed'); expect(streamed.runs).toHaveLength(12);
    expect(Reflect.get(streamed.runs[f.selectedIndex]!, 'traceAdmission')).toMatchObject({policy: 'streamed-renderer-events-v1', scannerCompletion: 'eof-finished', physicalClosure: 'verified', legacyWorkThreshold: expect.objectContaining({status: 'crossed'})});
  }, 90000);
});
describe('opaque original filesystem exception preservation', () => {
  it('retains opaque original directory read plus independent falsy close in physical inventory', async () => {
    const f = await rootFixture(), original = new Proxy({}, {getPrototypeOf() {throw 0;}}), opendir = fs.opendir.bind(fs); let closes = 0, injected = false;
    vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
      const h = await Reflect.apply(opendir, undefined, args); if (String(args[0]) !== f.root || injected) return h; injected = true;
      return new Proxy(h, {get(object, key) {
        if (key === 'read') return async () => {await object.read(); throw original;};
        if (key === 'close') return async () => {closes++; await object.close(); throw false;};
        const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
      }});
    });
    const observed = await loadComparisonInvocation(f.root).then(value => ({fulfilled: true as const, value}), error => ({fulfilled: false as const, error}));
    expect(closes).toBe(1); expect(observed.fulfilled).toBe(true); if (!observed.fulfilled) throw Error('Original inventory exception escaped its ledger');
    expect(observed.value.physicalInventory.status).toBe('partial'); expect(observed.value.byteIntegrity.seal).not.toBe('byte-closed');
    expect(Object.is(observed.value.physicalInventory.ioFailures[0]!.error, original)).toBe(true);
    expect(observed.value.physicalInventory.ioFailures[1]!.error).toBe(false); expect(observed.value.physicalInventory.ioFailures.slice(0, 2).map(row => row.operation)).toEqual(['directory-read', 'directory-close']);
  });
  it.each((['path', 'open', 'read', 'post-close'] as const).flatMap(operation => (['getPrototypeOf', 'has', 'get'] as const).map(trap => ({operation, trap}))))('retains original $operation $trap failure and actual independent close', async ({operation, trap}) => {
    const f = await fixture(), target = join(f.root, f.reference.path), original = new Proxy(trap === 'get' ? {code: 'ENOENT'} : {}, {[trap]() {throw 0;}}), originalStat = fs.lstat.bind(fs), originalOpen = fs.open.bind(fs); let stats = 0, closes = 0;
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      if (String(args[0]) === target) {stats++; if (operation === 'path' && stats === 1 || operation === 'post-close' && stats === 3) throw original;}
      return Reflect.apply(originalStat, undefined, args);
    });
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      if (String(args[0]) === target && operation === 'open') throw original;
      const h = await originalOpen(...args); if (String(args[0]) !== target) return h;
      return new Proxy(h, {get(object, key) {
        if (key === 'read' && operation === 'read') return async (...readArgs: Parameters<typeof object.read>) => {await Reflect.apply(object.read, object, readArgs); throw original;};
        if (key === 'close') return async () => {closes++; await object.close(); if (operation === 'read') throw false;};
        const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;
      }});
    });
    const observed = await loadComparisonMember(f.root, f.reference).then(value => ({fulfilled: true as const, value}), error => ({fulfilled: false as const, error}));
    expect(observed.fulfilled).toBe(true); expect(closes).toBe(operation === 'read' || operation === 'post-close' ? 1 : 0);
    if (!observed.fulfilled) throw Error('Original opaque value escaped owned ledger');
    expect(observed.value.status).toBe('failed'); if (observed.value.status !== 'failed') throw Error('Controlled original failure was admitted');
    expect(observed.value.ioFailures?.[0]!.error).toBe(original); expect(observed.value.loadingIssues[0]!.kind).toBe(operation === 'post-close' ? 'identity' : 'unreadable');
    if (operation === 'read') {expect(observed.value.ioFailures?.map(row => row.operation)).toEqual(['read', 'close']); expect(observed.value.ioFailures?.[1]!.error).toBe(false);}
  });
});
describe('comparison conditional renderer diagnostic initial capabilities', () => {
  it.each((['2.0.0', '2.1.0'] as const).flatMap(version => (['follow', 'history-reading'] as const).map(journey => ({version, journey}))))('retains canonical $version $journey parser capability without scoring', async ({version, journey}) => {
    const f = await rendererDiagnosticFixture(version, journey), result = await loadComparisonInvocation(f.root), row = result.runs[f.selectedIndex]!;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(row.references.inventory.status).toBe('complete'); expect(row.manifest?.workload.journey).toBe(journey); expect(row.captureValidation?.status).toBe('failed');
    expect(row).toHaveProperty('rendererPresentationCapabilityDiagnostic', expect.objectContaining({status: 'available', scoringEligibility: false, notFullIntegratedDerivation: true, phaseOrigin: expect.objectContaining({status: 'unavailable-serialization-policy-unverified'}), presentation: expect.objectContaining({status: 'available', value: expect.objectContaining({phases: expect.any(Array)})})}));
    const diagnostic = row.rendererPresentationCapabilityDiagnostic;
    if (diagnostic.presentation.status !== 'available') throw new Error('canonical renderer support');
    expect(diagnostic.presentation.value.phases).toHaveLength(journey === 'follow' ? 3 : 6);
    expect(diagnostic.presentation.value.phases.every(phase => phase.rendererVisualUpdateFps.status === 'available' && phase.rendererVisualUpdateFps.numerator === 2 && phase.rendererVisualUpdateFps.denominatorUs === 800 && phase.presentationIntervals.status === 'available' && phase.presentationIntervals.intervalsUs.length === 1 && phase.presentationIntervals.intervalsUs[0] === 200)).toBe(true);
    expect(diagnostic.guards).toEqual({'owned-originals': 'verified', 'trace-completion': 'verified', 'trace-topology': 'verified', 'canonical-phases': 'verified', 'existing-parser': 'verified', 'serialized-phase-origin': 'unavailable', 'independent-oracle': 'unavailable'});
    expect(diagnostic).toMatchObject(rendererCaption);
    expect(result.collection.status).toBe('partial');
  });
  it('keeps the unavailable factory caption explicit without inventing coverage', () => {
    const value = unavailableComparisonRendererDiagnostic('original unavailable');
    expect(value.status).toBe('unavailable'); expect(value.presentation).toEqual({status: 'unavailable', reason: 'original unavailable'});
    expect(value.scoringEligibility).toBe(false); expect(Object.values(value.guards)).toEqual(Array(7).fill('unavailable'));
    expect(value).toMatchObject(rendererCaption);
  });
  it.each(['2.0.0', '2.1.0'] as const)('retains the honest caption when %s original completion is unavailable', async version => {
    const f = await rendererDiagnosticFixture(version);
    expect((await loadComparisonInvocation(f.root)).runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.status).toBe('available');
    f.capture.traceEof = {status: 'unavailable', reason: 'original EOF unavailable'}; await f.json(f.prefix + 'capture-status.json', f.capture); await f.refresh();
    const result = await loadComparisonInvocation(f.root), value = result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(value.status).toBe('unavailable'); expect(value.scoringEligibility).toBe(false); expect(value.presentation.status).toBe('unavailable');
    expect(value).toMatchObject(rendererCaption); expect(result.runs[f.selectedIndex]!.captureValidation?.status).toBe('failed');
  });
});

describe('comparison conditional renderer diagnostic mandatory guards', () => {
  it.each(['descriptor', 'inventory-byte', 'extra-scored-phase', 'extra-mark'] as const)('rejects source-backed %s contradiction after a canonical positive', async kind => {
    const f = await rendererDiagnosticFixture('2.1.0'); expect((await loadComparisonInvocation(f.root)).runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'available');
    if (kind === 'descriptor') {const path = f.prefix + 'descriptor.json', value = JSON.parse(await readFile(join(f.root, path), 'utf8')); value.repetition = 'different'; await f.json(path, value); await f.refresh();}
    if (kind === 'inventory-byte') {f.evidence.files.find(file => file.path === 'phases.json')!.sha256 = '0'.repeat(64); await f.json(f.prefix + 'evidence.json', f.evidence); await f.refreshSeal();}
    if (kind === 'extra-scored-phase') {const last = f.phases.instances.at(-1)!; f.phases.instances.push({...last, phase: 'history-reading', instanceId: '999', startMs: last.endMs + 1, endMs: last.endMs + 2, ...comparisonPhaseMarks('history-reading', '999')}); await f.json(f.prefix + 'phases.json', f.phases); await f.refresh();}
    if (kind === 'extra-mark') {f.trace.traceEvents.push({...f.trace.traceEvents[2]!, name: comparisonPhaseMarks('streaming-follow', '999').startMark, ts: 99999}); await f.json(f.prefix + 'trace.json', f.trace); await f.refresh();}
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'unavailable'); expect(result.runs[f.selectedIndex]!.captureValidation?.status).toBe('failed');
  });
});

describe('comparison conditional renderer diagnostic retained controls', () => {
  it.each(['missing-eof', 'stream', 'loss', 'aux-accounting', 'categories', 'frame', 'url', 'child', 'isolation', 'wrong-row', 'partial-phases', 'registry-4097', 'duplicate-mark', 'lifecycle', 'foreign-feedback', 'unsafe-time', 'missing-trace'] as const)('fails closed for %s on byte-rebound canonical files', async kind => {
    const f = await rendererDiagnosticFixture('2.1.0'); expect((await loadComparisonInvocation(f.root)).runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'available');
    const declaration = f.evidence.trace; if (declaration.status !== 'available' || declaration.presentation.status !== 'available') throw new Error('canonical declaration');
    if (kind === 'missing-eof') Object.assign(f.capture.traceEof, {status: 'unavailable', reason: 'actual EOF missing', value: undefined});
    if (kind === 'stream') {if (f.auxiliary.completion.status !== 'available') throw new Error('canonical completion'); f.auxiliary.completion.value.stream = 'different';}
    if (kind === 'loss') {if (declaration.tracingComplete.status !== 'available') throw new Error('canonical completion'); declaration.tracingComplete.value.dataLossOccurred = true;}
    if (kind === 'aux-accounting') f.auxiliary.observedCallbacks = 1;
    if (kind === 'categories') declaration.categories = ['blink.user_timing'];
    if (kind === 'frame') declaration.presentation.value.frameTree.frameTree.frame.id = 'different';
    if (kind === 'url') declaration.presentation.value.appURL = 'https://different.test/';
    if (kind === 'child') declaration.presentation.value.frameTree.frameTree.childFrames = [{frame: {id: 'child', url: 'https://synthetic.test/'}}];
    if (kind === 'isolation') declaration.presentation.value.isolatedBrowserProcess = false;
    if (kind === 'wrong-row') f.metadata.repetition = 'different';
    if (kind === 'partial-phases') Object.assign(f.phases, {status: 'partial', reason: 'actual open phase'});
    if (kind === 'registry-4097') f.phases.instances = Array(4097).fill(f.phases.instances[0]);
    if (kind === 'duplicate-mark') f.trace.traceEvents.push({...f.trace.traceEvents[2]!});
    if (kind === 'lifecycle') f.trace.traceEvents.push({...f.trace.traceEvents[0]!, name: 'FrameCommittedInBrowser'});
    if (kind === 'foreign-feedback') f.trace.traceEvents.push({...f.trace.traceEvents.find(e => e.name === 'AnimationFrame::Presentation')!, pid: 999});
    if (kind === 'unsafe-time') f.trace.traceEvents[2]!.ts = Number.MAX_SAFE_INTEGER + 1;
    await f.json(f.prefix + 'capture-status.json', f.capture); await f.json(f.prefix + 'trace-auxiliary.json', f.auxiliary); await f.json(f.prefix + 'capture-metadata.json', f.metadata); await f.json(f.prefix + 'phases.json', f.phases); await f.json(f.prefix + 'trace.json', f.trace); await f.refresh();
    if (kind === 'missing-trace') {await unlink(join(f.root, f.prefix + 'trace.json')); f.evidence.files = f.evidence.files.filter(file => file.path !== 'trace.json'); await f.json(f.prefix + 'evidence.json', f.evidence); await f.refreshSeal([], [f.prefix + 'trace.json']);}
    const result = await loadComparisonInvocation(f.root), diagnostic = result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(diagnostic.status).toBe('unavailable'); expect(diagnostic.scoringEligibility).toBe(false); expect(diagnostic.presentation.status).toBe('unavailable');
    if (kind === 'registry-4097') expect(diagnostic.issues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'phaseRegistry', limit: 4096, observed: 4097}));
  });
  it.each(['missing', 'malformed', 'last-digit'] as const)('retains conditional support with %s origin metadata, never scoring', async mode => {
    const f = await rendererDiagnosticFixture('2.1.0'), event = f.trace.traceEvents[2]!, data = event.args.data as Record<string, unknown>;
    if (mode === 'missing') delete data.startTime; else if (mode === 'malformed') data.startTime = 'invalid'; else data.startTime = 1.0000000000000002;
    await f.json(f.prefix + 'trace.json', f.trace); await f.refresh(); const result = await loadComparisonInvocation(f.root), diagnostic = result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(diagnostic.status).toBe('available'); expect(diagnostic.phaseOrigin.status).toBe(mode === 'missing' ? 'unavailable-missing-metadata' : mode === 'malformed' ? 'unavailable-malformed-metadata' : 'unavailable-serialization-policy-unverified'); expect(diagnostic.scoringEligibility).toBe(false);
  });
  it.each([0, 1])('retains %i actual feedback per window without inventing intervals/zero rate', async count => {
    const f = await rendererDiagnosticFixture('2.1.0'); f.trace.traceEvents = f.trace.traceEvents.filter(event => event.name !== 'AnimationFrame::Presentation' || count === 1 && String(event.args.id).endsWith('-0'));
    await f.json(f.prefix + 'trace.json', f.trace); await f.refresh(); const diagnostic = (await loadComparisonInvocation(f.root)).runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(diagnostic.status).toBe('available'); if (diagnostic.presentation.status !== 'available') throw new Error('canonical parser');
    expect(diagnostic.presentation.value.phases.every(phase => phase.presentationIntervals.status === 'unavailable')).toBe(true); expect(diagnostic.presentation.value.phases.every(phase => count === 0 ? phase.rendererVisualUpdateFps.status === 'unavailable' : phase.rendererVisualUpdateFps.status === 'available' && phase.rendererVisualUpdateFps.numerator === 1)).toBe(true);
  });
  it.each([undefined, null, false, 0, '', new Error('actual close')] as const)('retains exact trace close failure %s and revokes all favorable diagnostics', async primary => {
    const f = await rendererDiagnosticFixture('2.1.0'), target = join(f.root, f.prefix + 'trace.json'), original = fs.open.bind(fs); let closes = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== target) return handle; return new Proxy(handle, {get(object, key) {if (key === 'close') return async () => {await object.close(); if (++closes === 3) throw primary;}; const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(closes).toBe(3); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs.every(row => row.rendererPresentationCapabilityDiagnostic.status === 'unavailable')).toBe(true);
    const failure = result.byteIntegrity.ioFailures.find(value => value.path === f.prefix + 'trace.json' && value.operation === 'close')!; expect(failure).toBeDefined(); expect(Object.hasOwn(failure, 'error')).toBe(true); expect(failure.error).toBe(primary);
  });
  it('revokes a previously supported trace after final original identity replacement', async () => {
    const f = await rendererDiagnosticFixture('2.1.0'), target = join(f.root, f.prefix + 'trace.json'), replacement = f.root + '-replacement'; owned.push(replacement); await writeFile(replacement, await readFile(target)); const original = fs.open.bind(fs); let closes = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== target) return handle; return new Proxy(handle, {get(object, key) {if (key === 'close') return async () => {await object.close(); if (++closes === 3) await rename(replacement, target);}; const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(closes).toBe(3); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.presentation.status', 'unavailable');
    expect(result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic).toMatchObject(rendererCaption);
  });
});

describe('comparison renderer unchanged resource boundaries', () => {
  it.each([4096, 4097])('checks raw phase registry %i before schema refinements', async count => {
    const f = await rendererDiagnosticFixture('2.1.0'), last = f.phases.instances.at(-1)!;
    f.phases.instances.push(...Array.from({length: count - f.phases.instances.length}, (_, i) => ({phase: 'validation' as const, instanceId: String(i + 3), startMs: last.endMs + 1 + i * 2, endMs: last.endMs + 2 + i * 2, ...comparisonPhaseMarks('validation', String(i + 3))})));
    await f.json(f.prefix + 'phases.json', f.phases); await f.refresh(); const result = await loadComparisonInvocation(f.root), diagnostic = result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(diagnostic.status).toBe(count === 4096 ? 'available' : 'unavailable');
    if (count === 4097) expect(diagnostic.issues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'phaseRegistry', limit: 4096, observed: 4097}));
  });
  it.each(['invalid-utf8', 'duplicate-keys', 'depth64', 'depth65'] as const)('uses private trace admission for %s without rewriting bytes', async mode => {
    const f = await rendererDiagnosticFixture('2.1.0'), path = f.prefix + 'trace.json';
    if (mode === 'invalid-utf8') await writeFile(join(f.root, path), Buffer.from([0x22, 0xc3, 0x28, 0x22]));
    else if (mode === 'duplicate-keys') await writeFile(join(f.root, path), '{"traceEvents":[],"trace\\u0045vents":[]}');
    else {const nested = mode === 'depth64' ? 63 : 64, original = JSON.stringify(f.trace); await writeFile(join(f.root, path), original.slice(0, -1) + ',"deep":' + '['.repeat(nested) + 'null' + ']'.repeat(nested) + '}');}
    await f.refresh(); const before = await readFile(join(f.root, path)), core = vi.spyOn(presentationModule, 'parseComparisonRendererPresentation'), result = await loadComparisonInvocation(f.root), diagnostic = result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic;
    expect(core).toHaveBeenCalledTimes(mode === 'depth64' ? 1 : 0); expect(await readFile(join(f.root, path))).toEqual(before); expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(diagnostic.guards['owned-originals']).toBe('verified'); expect(Object.values(result.runs[f.selectedIndex]!.finalContent).every(lane => lane.status === 'complete')).toBe(true); expect(diagnostic.status).toBe(mode === 'depth64' ? 'available' : 'unavailable');
    if (mode === 'depth65') expect(diagnostic.issues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonDepth', limit: 64, observed: 65}));
    if (mode === 'invalid-utf8' || mode === 'duplicate-keys') expect(diagnostic.issues).toContainEqual(expect.objectContaining({kind: 'malformed', role: 'trace'}));
  });
  it.each([8388608, 8388609])('preserves trace work at exact %i units', {timeout: 120000}, async work => {
    const input = '{"traceEvents":[],"padding":[' + 'null,'.repeat(work - 6) + 'null]}', f = await jsonFixture(input, 'trace'), result = await loadComparisonJson(f.root, f.reference);
    if (work === 8388608) {expect(result.status).toBe('admitted-json'); if (result.status !== 'admitted-json') throw new Error('trace work positive'); expect(result.admission.analyzerWorkUnits).toBe(work);}
    else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'jsonWorkUnits', limit: 8388608, observed: 8388609}));
  });
  it.each([128 * 1024 * 1024, 128 * 1024 * 1024 + 1])('preserves original trace byte role at %i bytes', {timeout: 60000}, async size => {
    const f = await fixture(), path = join(f.root, f.reference.path), handle = await open(path, 'w'); try {await handle.truncate(size);} finally {await handle.close();}
    const hash = createHash('sha256'), block = Buffer.alloc(65536); for (let left = size; left > 0; left -= block.length) hash.update(block.subarray(0, Math.min(left, block.length)));
    const result = await loadComparisonMember(f.root, {path: f.reference.path, role: 'trace', expected: {byteLength: size, sha256: hash.digest('hex')}});
    if (size === 128 * 1024 * 1024) expect(result.status).toBe('verified-bytes'); else expect(result.loadingIssues).toContainEqual(expect.objectContaining({kind: 'admission-limit', limitName: 'roleBytes', limit: 128 * 1024 * 1024, observed: size}));
  });
});

describe('comparison trace semantic rejection preserves physical failure authority', () => {
  it.each([undefined, null, false, 0, '', new Error('original read')] as const)('keeps actual later descriptor read failure %s after syntax rejection', async primary => {
    const f = await rendererDiagnosticFixture('2.1.0'), path = f.prefix + 'trace.json', target = join(f.root, path);
    await writeFile(target, '{"traceEvents":[],"trace\\u0045vents":[]}' + ' '.repeat(70000)); await f.refresh(); const original = fs.open.bind(fs); let opens = 0, readCalls = 0;
    vi.spyOn(fs, 'open').mockImplementation(async (...args) => {const handle = await original(...args); if (String(args[0]) !== target || ++opens !== 3) return handle; return new Proxy(handle, {get(object, key) {if (key === 'read') return async (...args: Parameters<typeof object.read>) => {if (++readCalls === 2) throw primary; return Reflect.apply(object.read, object, args);}; const value = Reflect.get(object, key); return typeof value === 'function' ? value.bind(object) : value;}});});
    const result = await loadComparisonInvocation(f.root); expect(readCalls).toBe(2); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs[f.selectedIndex]!.rendererPresentationCapabilityDiagnostic.issues).toContainEqual(expect.objectContaining({kind: 'malformed', path: 'trace.json', reason: expect.stringMatching(/duplicate decoded key/i)})); expect(result.runs.every(row => row.rendererPresentationCapabilityDiagnostic.status === 'unavailable')).toBe(true);
    const failure = result.byteIntegrity.ioFailures.find(value => value.path === path && value.operation === 'read')!; expect(failure).toBeDefined(); expect(Object.hasOwn(failure, 'error')).toBe(true); expect(failure.error).toBe(primary);
  });
  it('keeps an unknown native JSON decoder throw outside the known scanner exception seam', async () => {
    const f = await rendererDiagnosticFixture('2.1.0'), bytes = await readFile(join(f.root, f.prefix + 'trace.json'), 'utf8'), original = JSON.parse;
    vi.spyOn(JSON, 'parse').mockImplementation((...args) => {if (args[0] === bytes) throw false; return Reflect.apply(original, JSON, args);});
    const result = await loadComparisonInvocation(f.root); expect(result.byteIntegrity.seal).toBe('partial'); expect(result.runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'unavailable');
  });
});

describe('comparison renderer original phase payload authority', () => {
  it.each(['lost', 'partial'] as const)('rejects explicit %s phases despite available bytes and registry', async mode => {
    const f = await rendererDiagnosticFixture('2.1.0'); expect((await loadComparisonInvocation(f.root)).runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'available');
    if (mode === 'lost') {f.capture.payloads = f.capture.payloads.filter(file => file.path !== 'phases.json'); f.capture.unavailablePaths.push({path: 'phases.json', reason: 'original acquisition unavailable'});}
    else Object.assign(f.capture.payloads.find(file => file.path === 'phases.json')!, {status: 'partial', reason: 'original acquisition partial'});
    await f.json(f.prefix + 'capture-status.json', f.schemas.comparisonCaptureStatusSchema.parse(f.capture)); await f.refresh(); const result = await loadComparisonInvocation(f.root);
    expect(result.byteIntegrity.seal).toBe('byte-closed'); expect(result.runs[f.selectedIndex]).toHaveProperty('rendererPresentationCapabilityDiagnostic.status', 'unavailable');
  });
});
