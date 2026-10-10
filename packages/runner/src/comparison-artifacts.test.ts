import {afterEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, readFile, writeFile, mkdir, symlink, rename, rm, open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ComparisonArtifactWriter} from './comparison-artifacts.js';
const roots: string[] = [];
async function root() { const dir = await mkdtemp(join(tmpdir(), 'comparison-writer-')); roots.push(dir); return dir; }
afterEach(async () => { await Promise.all(roots.splice(0).map(r => rm(r, {recursive: true, force: true}))); });
describe('comparison artifact writer', () => {
  it('serializes concurrent whole-line appends and nested atomic writes', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    await writer.json('runs/1-0-threadplane/trace.json', {ready: true});
    await Promise.all(Array.from({length: 20}, (_, i) => writer.append('page.jsonl', [{i}])));
    expect(JSON.parse(await readFile(join(dir, 'runs/1-0-threadplane/trace.json'), 'utf8'))).toEqual({ready: true});
    expect((await readFile(join(dir, 'page.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)).toEqual(Array.from({length: 20}, (_, i) => ({i})));
  });
  it.each(['/x', '../x', 'a/../x', 'a//x', 'a/./x', 'a\\x', 'https://x', 'C:/x', '', 'a\u0000b', 'é'])('rejects member syntax %j', async path => {
    const writer = await ComparisonArtifactWriter.create(await root());
    await expect(writer.text(path, 'bad')).rejects.toThrow();
  });
  it.each(['outside', 'inside', 'dangling', 'prefix-sibling'])('rejects %s ancestor links without changing sentinels', async kind => {
    const dir = await root(), outside = await root();
    const sibling = dir + '-sibling'; roots.push(sibling); await mkdir(sibling);
    await writeFile(join(outside, 'sentinel'), 'outside');
    await writeFile(join(dir, 'sentinel'), 'inside');
    await symlink(kind === 'inside' ? dir : kind === 'dangling' ? join(outside, 'missing') : kind === 'prefix-sibling' ? sibling : outside, join(dir, 'link'));
    const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.text('link/sentinel', 'bad')).rejects.toThrow();
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside');
    expect(await readFile(join(dir, 'sentinel'), 'utf8')).toBe('inside');
  });
  it('rejects existing leaf links and directories', async () => {
    const dir = await root(), outside = await root(); await writeFile(join(outside, 'sentinel'), 'outside');
    await symlink(join(outside, 'sentinel'), join(dir, 'link')); await mkdir(join(dir, 'folder'));
    const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.append('link', [{bad: true}])).rejects.toThrow();
    await expect(writer.text('folder', 'bad')).rejects.toThrow();
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('outside');
  });
  it('pins canonical root identity and rejects its replacement', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir), moved = dir + '-original'; roots.push(moved);
    await rename(dir, moved); await mkdir(dir);
    await expect(writer.text('new', 'bad')).rejects.toThrow(/root|identity|replaced/i);
  });
  it('rejects a caller root leaf symlink while allowing its ordinary ancestor resolution', async () => {
    const dir = await root(), outside = await root(); await symlink(outside, join(dir, 'root-link'));
    await expect(ComparisonArtifactWriter.create(join(dir, 'root-link'))).rejects.toThrow(/root|symlink/i);
    await mkdir(join(outside, 'actual-root')); const writer = await ComparisonArtifactWriter.create(join(dir, 'root-link/actual-root'));
    await writer.text('safe', 'yes'); expect(await readFile(join(outside, 'actual-root/safe'), 'utf8')).toBe('yes');
  });
  it('rejects a FIFO leaf before opening it', async () => {
    const dir = await root(); execFileSync('mkfifo', [join(dir, 'fifo')]); const writer = await ComparisonArtifactWriter.create(dir);
    await expect(writer.append('fifo', [{bad: true}])).rejects.toThrow(/regular file/i);
  });
  it('does not append a partially serialized JSON batch', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    await writer.text('page.jsonl', '{malformed');
    await expect(writer.append('page.jsonl', [{good: true}, {bad: 1n}])).rejects.toThrow();
    expect(await readFile(join(dir, 'page.jsonl'), 'utf8')).toBe('{malformed');
  });
  it('checks generation again when queued work executes', async () => {
    const dir = await root(); let release!: () => void, entered!: () => void;
    const opened = new Promise<void>(r => entered = r), blocker = new Promise<void>(r => release = r);
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {if (String(args[0]).includes('first.')) {entered(); await blocker;} return open(...args);}});
    let active = true; const scoped = writer.scoped(() => {if (!active) throw new Error('revoked');});
    const first = writer.text('first', 'x'); await opened; const queued = scoped.append('page.jsonl', [{late: true}]);
    active = false; release();
    await Promise.allSettled([first]); await expect(queued).rejects.toThrow('revoked');
    await expect(readFile(join(dir, 'page.jsonl'))).rejects.toThrow();
  });
  it('retains old JSON and cleans only owned temporaries after rename failure', async () => {
    const dir = await root(); await writeFile(join(dir, 'validation.json'), '{"old":true}');
    const writer = await ComparisonArtifactWriter.create(dir, {rename: async () => {throw new Error('rename failed');}});
    await expect(writer.json('validation.json', {new: true})).rejects.toThrow('rename failed');
    expect(await readFile(join(dir, 'validation.json'), 'utf8')).toBe('{"old":true}');
  });
  it('preserves an actual interrupted JSONL tail and inventories those exact partial bytes', async () => {
    const dir = await root(); await writeFile(join(dir, 'page.jsonl'), '{"old":true}\n');
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args);
      if (String(args[0]).endsWith('/page.jsonl') && Number(args[1]) !== 0) {
        const write = handle.writeFile.bind(handle);
        vi.spyOn(handle, 'writeFile').mockImplementation(async () => {await write('{"bad'); throw new Error('interrupted write');});
      }
      return handle;
    }});
    await expect(writer.append('page.jsonl', [{bad: true}])).rejects.toThrow('interrupted write');
    const bytes = await readFile(join(dir, 'page.jsonl')); expect(bytes.toString()).toBe('{"old":true}\n{"bad');
    expect((await writer.inventory([{path: 'page.jsonl', status: 'partial', reason: 'interrupted write'}]))[0]).toMatchObject({byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'partial'});
  });
  it('never removes an outside same-name sentinel when a temp parent is replaced during rename', async () => {
    const dir = await root(), outside = await root(); let sentinel = '';
    const writer = await ComparisonArtifactWriter.create(dir, {rename: async source => {
      await rename(join(dir, 'nested'), join(dir, 'owned-original')); await symlink(outside, join(dir, 'nested'));
      sentinel = join(outside, basename(String(source))); await writeFile(sentinel, 'outside sentinel'); throw new Error('injected rename failure');
    }});
    await expect(writer.json('nested/value.json', {value: 1})).rejects.toThrow();
    expect(await readFile(sentinel, 'utf8')).toBe('outside sentinel');
  });
  it('rejects an opened hash handle substituted for the checked pathname', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), 'original'); await writeFile(join(dir, 'other'), 'wrong');
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (path, flags, mode) => open(String(path).endsWith('/raw') ? join(dir, 'other') : path, flags, mode)});
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/handle|identity|path/i);
  });
  it('rejects pathname replacement after opening a readable original hash handle', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), 'original');
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args); if (String(args[0]).endsWith('/raw')) {await rename(join(dir, 'raw'), join(dir, 'old')); await writeFile(join(dir, 'raw'), 'replacement');} return handle;
    }});
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/changed|path/i);
    expect(await readFile(join(dir, 'old'), 'utf8')).toBe('original');
  });
  it('rejects file mutation during streamed hashing', async () => {
    const dir = await root(); await writeFile(join(dir, 'raw'), Buffer.alloc(262144, 1));
    const writer = await ComparisonArtifactWriter.create(dir, {open: async (...args) => {
      const handle = await open(...args), create = handle.createReadStream.bind(handle);
      vi.spyOn(handle, 'createReadStream').mockImplementation(options => {const stream = create({...options, highWaterMark: 1024}); stream.once('data', () => appendFileSync(join(dir, 'raw'), 'changed')); return stream;});
      return handle;
    }});
    await expect(writer.inventory([{path: 'raw', status: 'complete'}])).rejects.toThrow(/changed|hash/i);
  });
  it('streams exact bytes and refuses inventory with an unfinished stream', async () => {
    const dir = await root(), writer = await ComparisonArtifactWriter.create(dir);
    const stream = await writer.stream('trace.json'); await stream.write(Buffer.from([0, 255, 3]));
    await expect(writer.inventory([{path: 'trace.json', status: 'complete'}])).rejects.toThrow(/stream/i);
    await stream.complete();
    const files = await writer.inventory([{path: 'trace.json', status: 'complete'}]);
    expect(files[0]).toMatchObject({byteLength: 3, sha256: createHash('sha256').update(Buffer.from([0, 255, 3])).digest('hex')});
  });
  it('allows an initialized empty trace to become a checked stream without truncating existing evidence', async () => {
    const writer = await ComparisonArtifactWriter.create(await root()); await writer.text('trace.json', '');
    const stream = await writer.stream('trace.json'); await stream.write(Buffer.from('trace')); await stream.complete();
    await expect(writer.stream('trace.json')).rejects.toThrow(/empty|exists/i);
  });
  it('hashes only explicit payload files with actual bytes and partial reasons', async () => {
    const writer = await ComparisonArtifactWriter.create(await root());
    await writer.text('empty', ''); await writer.text('unicode', '🙂'); await writer.text('page.jsonl', '{partial'); await writer.text('unlisted', 'ignore');
    const files = await writer.inventory([{path: 'unicode', status: 'complete'}, {path: 'empty', status: 'complete'}, {path: 'page.jsonl', status: 'partial', reason: 'interrupted'}]);
    expect(files.map(f => f.path)).toEqual(['empty', 'page.jsonl', 'unicode']); expect(files.map(f => f.byteLength)).toEqual([0, 8, 4]);
    await expect(writer.inventory([{path: 'empty', status: 'complete'}, {path: 'empty', status: 'complete'}])).rejects.toThrow(/duplicate/i);
    await expect(writer.inventory([{path: 'evidence.json', status: 'complete'}])).rejects.toThrow(/derived|evidence/i);
  });
  it('seals permanently after queued writes finish', async () => {
    const writer = await ComparisonArtifactWriter.create(await root()); const pending = writer.text('before', 'yes'); await writer.seal(); await pending;
    await expect(writer.text('after', 'no')).rejects.toThrow(/seal/i); await expect(writer.stream('after')).rejects.toThrow(/seal/i);
  });
  it('allows only one exclusive claim on an empty root and preserves prior partial members', async () => {
    const dir = await root(), a = await ComparisonArtifactWriter.create(dir), b = await ComparisonArtifactWriter.create(dir);
    const claims = await Promise.allSettled([a.claimEmptyRoot('invocation-claim.json', {id: 'a'}), b.claimEmptyRoot('invocation-claim.json', {id: 'b'})]);
    expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(['a', 'b']).toContain(JSON.parse(await readFile(join(dir, 'invocation-claim.json'), 'utf8')).id);
    const partial = await root(); await writeFile(join(partial, 'partial-trace'), 'incomplete raw bytes');
    const writer = await ComparisonArtifactWriter.create(partial); await expect(writer.claimEmptyRoot('invocation-claim.json', {id: 'new'})).rejects.toThrow(/empty|existing|initialized/i);
    expect(await readFile(join(partial, 'partial-trace'), 'utf8')).toBe('incomplete raw bytes');
  });
});
