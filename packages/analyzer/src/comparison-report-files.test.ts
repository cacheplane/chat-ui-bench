import {afterEach, expect, it, vi} from 'vitest';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, realpath, rm, writeFile, readFile, readdir, symlink, rename} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {publishComparisonReport} from './comparison-report-files.js';

const owned: string[] = [];
afterEach(async () => {vi.restoreAllMocks(); for (const path of owned.splice(0)) await rm(path, {recursive: true, force: true});});
async function fixture() {
  const parent = await mkdtemp(join(await realpath(tmpdir()), 'comparison-report-publication-')); owned.push(parent);
  const input = join(parent, 'original'); await mkdir(input);
  // Actual unusable ledger bytes: root-only unavailable is a supported report
  // result, not manufactured successful capture or repaired raw evidence.
  const bytes = Buffer.from('{}\n'); await writeFile(join(input, 'invocation.json'), bytes);
  return {parent, input, output: join(parent, 'report'), bytes};
}
it('publishes actual two-file external diagnostics and preserves original bytes', async () => {
  const f = await fixture(), result = await publishComparisonReport(f.input, f.output);
  expect(result).toMatchObject({analysisStatus: 'unavailable', publicationStatus: 'complete', scoringEligibility: false});
  expect((await readdir(f.output)).sort()).toEqual(['comparison-results.json', 'comparison-summary.md']);
  for (const fact of result.outputs) {
    const bytes = await readFile(join(f.output, fact.path));
    expect(fact.byteLength).toBe(bytes.length); expect(fact.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  }
  expect(await readFile(join(f.input, 'invocation.json'))).toEqual(f.bytes);
});
it('same original into two new directories produces byte-identical JSON and Markdown', async () => {
  const f = await fixture(), second = join(f.parent, 'second');
  await publishComparisonReport(f.input, f.output); await publishComparisonReport(f.input, second);
  for (const name of ['comparison-results.json', 'comparison-summary.md']) expect(await readFile(join(f.output, name))).toEqual(await readFile(join(second, name)));
});
it.each(['relative', 'equal', 'inside', 'outside-parent', 'existing', 'symlink'] as const)('rejects %s destination before output writes', async mode => {
  const f = await fixture(); let output = f.output;
  if (mode === 'relative') output = 'relative-report';
  if (mode === 'equal') output = f.input;
  if (mode === 'inside') output = join(f.input, 'report');
  if (mode === 'outside-parent') output = f.parent;
  if (mode === 'existing') await mkdir(output);
  if (mode === 'symlink') {const alias = join(f.parent, 'alias'); await symlink(f.parent, alias); output = join(alias, 'report');}
  await expect(publishComparisonReport(f.input, output)).rejects.toThrow(/absolute|overlap|existing|symlink|canonical/);
  expect(await readFile(join(f.input, 'invocation.json'))).toEqual(f.bytes);
});
it.each([undefined, null, false, 0, ''])('preserves original output-write failure %j and still closes actual descriptor', async originalError => {
  const f = await fixture(), original = fs.open.bind(fs); let writes = 0, closes = 0;
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args); if (String(args[0]) !== join(f.output, 'comparison-results.json')) return handle;
    return new Proxy(handle, {get(target, key) {
      if (key === 'write') return async (...writeArgs: Parameters<typeof handle.write>) => {await Reflect.apply(target.write, target, writeArgs); writes++; throw originalError;};
      if (key === 'close') return async () => {await target.close(); closes++;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  let present = false, actual;
  try {await publishComparisonReport(f.input, f.output);} catch (error) {present = true; actual = error;}
  expect(present).toBe(true); expect(actual).toBe(originalError); expect([writes, closes]).toEqual([1, 1]);
});
it('preserves independent original write and close failures in order', async () => {
  const f = await fixture(), original = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args); if (String(args[0]) !== join(f.output, 'comparison-results.json')) return handle;
    return new Proxy(handle, {get(target, key) {
      if (key === 'write') return async () => {throw false;};
      if (key === 'close') return async () => {await target.close(); throw 0;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  try {await publishComparisonReport(f.input, f.output); expect.fail('Expected original failures');} catch (error) {
    expect(error).toBeInstanceOf(AggregateError); if (!(error instanceof AggregateError)) throw error;
    expect(error.errors).toEqual([false, 0]);
  }
});

it('rejects output ancestor replacement between exclusive mkdir and writer ownership', async () => {
  const f = await fixture(), parent = join(f.parent, 'destination-parent'); await mkdir(parent); const output = join(parent, 'report');
  const original = fs.mkdir.bind(fs); let replaced = false;
  vi.spyOn(fs, 'mkdir').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (String(args[0]) === output && !replaced) {replaced = true; await rename(parent, parent + '-retained'); await original(parent); await original(output);}
    return result;
  });
  await expect(publishComparisonReport(f.input, output)).rejects.toThrow(/directory identity changed/);
  expect(replaced).toBe(true);
});

it('rejects extra owned membership introduced by final directory-close seam', async () => {
  const f = await fixture(), original = fs.opendir.bind(fs); let changed = false;
  vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
    const dir = await original(...args); if (String(args[0]) !== f.output) return dir;
    return new Proxy(dir, {get(target, key) {
      if (key === 'close') return async () => {await target.close(); changed = true; await writeFile(join(f.output, 'unexpected'), 'actual extra');};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  await expect(publishComparisonReport(f.input, f.output)).rejects.toThrow(/owned directory.*changed/); expect(changed).toBe(true);
});

it('unrelated shared-ancestor sibling creation during write remains permitted', async () => {
  const f = await fixture(), original = fs.open.bind(fs); let changed = false;
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args); if (String(args[0]) !== join(f.output, 'comparison-results.json')) return handle;
    return new Proxy(handle, {get(target, key) {
      if (key === 'write') return async (...writeArgs: Parameters<typeof handle.write>) => {const result = await Reflect.apply(target.write, target, writeArgs); if (!changed) {changed = true; await mkdir(join(f.parent, 'unrelated-sibling'));} return result;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  expect((await publishComparisonReport(f.input, f.output)).publicationStatus).toBe('complete'); expect(changed).toBe(true);
});

it('retains original final-directory read and close falsy failures independently', async () => {
  const f = await fixture(), original = fs.opendir.bind(fs);
  vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
    const dir = await original(...args); if (String(args[0]) !== f.output) return dir;
    return new Proxy(dir, {get(target, key) {
      if (key === 'read') return async () => {await target.read(); throw false;};
      if (key === 'close') return async () => {await target.close(); throw null;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  try {await publishComparisonReport(f.input, f.output); expect.fail('Expected directory failures');} catch (error) {
    expect(error).toBeInstanceOf(AggregateError); if (!(error instanceof AggregateError)) throw error; expect(error.errors).toEqual([false, null]);
  }
});

it('rejects physical output-ancestor inode alias before loader or mkdir', async () => {
  const f = await fixture(), parent = join(f.parent, 'alias-parent'); await mkdir(parent);
  const original = fs.lstat.bind(fs), rootStat = await fs.lstat(f.input, {bigint: true});
  vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => String(args[0]) === parent ? rootStat : original(...args));
  await expect(publishComparisonReport(f.input, join(parent, 'report'))).rejects.toThrow(/physical input\/output overlap/);
  expect(await readdir(parent)).toEqual([]);
});

it.each(['replacement', 'zero-write', 'readback-corruption'] as const)('fails %s with actual IO evidence and no complete receipt', async mode => {
  const f = await fixture(), original = fs.open.bind(fs); let applied = false;
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args); if (String(args[0]) !== join(f.output, 'comparison-results.json')) return handle;
    const writing = args[1] === (constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW);
    return new Proxy(handle, {get(target, key) {
      if (key === 'write' && writing && mode === 'zero-write') return async () => {applied = true; return {bytesWritten: 0, buffer: Buffer.alloc(0)};};
      if (key === 'close' && writing && mode === 'replacement') return async () => {await target.close(); applied = true; await rename(join(f.output, 'comparison-results.json'), join(f.output, 'retained')); await writeFile(join(f.output, 'comparison-results.json'), 'replacement');};
      if (key === 'read' && !writing && mode === 'readback-corruption') return async (...readArgs: Parameters<typeof handle.read>) => {const result = await Reflect.apply(target.read, target, readArgs); if (result.bytesRead) {result.buffer[0] = result.buffer[0]! ^ 1; applied = true;} return result;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  await expect(publishComparisonReport(f.input, f.output)).rejects.toThrow(/identity changed|write accounting|bytes changed/); expect(applied).toBe(true);
});

it('retains original readback read and independent descriptor-close failures', async () => {
  const f = await fixture(), original = fs.open.bind(fs); let reads = 0, closes = 0;
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const handle = await original(...args); if (String(args[0]) !== join(f.output, 'comparison-results.json') || args[1] !== (constants.O_RDONLY | constants.O_NOFOLLOW)) return handle;
    return new Proxy(handle, {get(target, key) {
      if (key === 'read') return async (...readArgs: Parameters<typeof handle.read>) => {await Reflect.apply(target.read, target, readArgs); reads++; throw false;};
      if (key === 'close') return async () => {await target.close(); closes++; throw undefined;};
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  });
  try {await publishComparisonReport(f.input, f.output); expect.fail('Expected readback failures');} catch (error) {
    expect(error).toBeInstanceOf(AggregateError); if (!(error instanceof AggregateError)) throw error; expect(error.errors).toEqual([false, undefined]);
  }
  expect([reads, closes]).toEqual([1, 1]);
});

it('rejects input root replacement during final regular-file stat', async () => {
  const f = await fixture(), original = fs.lstat.bind(fs); let calls = 0, replaced = false;
  vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
    const stat = await original(...args);
    if (String(args[0]) === join(f.output, 'comparison-summary.md') && ++calls === 5) {await rename(f.input, f.input + '-retained'); await mkdir(f.input); replaced = true;}
    return stat;
  });
  await expect(publishComparisonReport(f.input, f.output)).rejects.toThrow(/directory identity changed/); expect(replaced).toBe(true);
});

it('rejects extra owned membership after final regular-file stat', async () => {
  const f = await fixture(), original = fs.lstat.bind(fs); let calls = 0, changed = false;
  vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
    const stat = await original(...args);
    if (String(args[0]) === join(f.output, 'comparison-summary.md') && ++calls === 5) {await writeFile(join(f.output, 'late-extra'), 'actual extra'); changed = true;}
    return stat;
  });
  await expect(publishComparisonReport(f.input, f.output)).rejects.toThrow(/owned directory.*changed/); expect(changed).toBe(true);
});
