import {constants, type Stats} from 'node:fs';
import {lstat, mkdir, open, readdir, realpath, rename, unlink, type FileHandle} from 'node:fs/promises';
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {comparisonArtifactPathSchema, comparisonInventoryFileSchema, type ComparisonInventoryFile} from '@chat-ui-bench/contract';

export interface ComparisonPayloadFile {path: string; status: 'complete' | 'partial'; reason?: string}
export interface ComparisonRawStream {write(bytes: Uint8Array): Promise<void>; complete(): Promise<void>}
export interface ComparisonScopedWriter {
  text(path: string, value: string): Promise<void>;
  json(path: string, value: unknown): Promise<void>;
  append(path: string, entries: readonly unknown[]): Promise<void>;
  stream(path: string): Promise<ComparisonRawStream>;
}
/** Narrow I/O injection supports controlled failure and pathname-substitution checks. */
export interface ComparisonFileOperations {open?: typeof open; rename?: typeof rename}
const derived = new Set(['evidence.json', 'results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
function sameIdentity(a: Stats, b: Stats) {return a.dev === b.dev && a.ino === b.ino;}
function sameFile(a: Stats, b: Stats) {return sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;}
function absent(error: unknown): boolean {return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';}

/** Portable Node checks protect application-owned directories; this is not an adversarial openat sandbox. */
export class ComparisonArtifactWriter implements ComparisonScopedWriter {
  private tail: Promise<unknown> = Promise.resolve();
  private sealed = false;
  private sealRequested = false;
  private readonly streams = new Set<string>();
  private constructor(readonly directory: string, private readonly rootIdentity: Stats, private readonly io: ComparisonFileOperations) {}
  static async create(directory: string, io: ComparisonFileOperations = {}): Promise<ComparisonArtifactWriter> {
    await mkdir(directory, {recursive: true});
    const supplied = await lstat(resolve(directory));
    if (supplied.isSymbolicLink() || !supplied.isDirectory()) throw new Error('Artifact root leaf must be a regular directory, not a symlink');
    const canonical = await realpath(resolve(directory)), identity = await lstat(canonical);
    if (!identity.isDirectory() || identity.isSymbolicLink()) throw new Error('Artifact root is not a regular directory');
    if (constants.O_NOFOLLOW === undefined) throw new Error('O_NOFOLLOW is required for comparison artifacts');
    return new ComparisonArtifactWriter(canonical, identity, io);
  }
  scoped(assertActive: () => void): ComparisonScopedWriter {
    return {
      text: (path, value) => this.atomic(path, Buffer.from(value), assertActive),
      json: async (path, value) => this.atomic(path, Buffer.from(this.serialize(value)), assertActive),
      append: (path, entries) => this.appendGuarded(path, entries, assertActive),
      stream: path => this.streamGuarded(path, assertActive),
    };
  }
  /** Durably claim a previously empty root. Failed/partial claims are retained and forbid reuse. */
  async claimEmptyRoot(path: string, value: unknown): Promise<void> {
    comparisonArtifactPathSchema.parse(path); if (path.includes('/')) throw new Error('Invocation claim must be a root member');
    const bytes = this.serialize(value);
    return this.enqueue(async () => {
      await this.checkRoot(); if ((await readdir(this.directory)).length !== 0) throw new Error('Invocation root is already initialized; an empty root is required');
      const handle = await this.openChecked(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, () => {}, true);
      try {await handle.writeFile(bytes); await handle.sync();} finally {await handle.close();}
      const checked = await this.checked(path); await this.syncParent(checked.path, checked.parent);
    });
  }
  private serialize(value: unknown): string {const serialized = JSON.stringify(value, null, 2); if (serialized === undefined) throw new Error('Artifact JSON is not serializable'); return serialized + '\n';}
  private enqueue<T>(operation: () => Promise<T>, guard: () => void = () => {}): Promise<T> {
    try {guard(); if (this.sealed || this.sealRequested) throw new Error('Artifact writer is sealed');} catch (error) {return Promise.reject(error);}
    const task = this.tail.then(async () => {guard(); if (this.sealed) throw new Error('Artifact writer is sealed'); return operation();});
    this.tail = task.catch(() => {}); return task;
  }
  private async checkRoot() {
    const actual = await lstat(this.directory);
    if (actual.isSymbolicLink() || !actual.isDirectory() || !sameIdentity(actual, this.rootIdentity) || await realpath(this.directory) !== this.directory) throw new Error('Artifact root identity was replaced');
  }
  private contained(path: string) {const rel = relative(this.directory, path); if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw new Error('Artifact escapes pinned root');}
  private async checked(path: string, createParents = false): Promise<{path: string; parent: Stats; leaf: Stats | null}> {
    comparisonArtifactPathSchema.parse(path); await this.checkRoot();
    const destination = join(this.directory, path); this.contained(destination);
    let cursor = this.directory;
    for (const component of path.split('/').slice(0, -1)) {
      cursor = join(cursor, component);
      let stat: Stats;
      try {stat = await lstat(cursor);} catch (error) {
        if (!absent(error) || !createParents) throw error;
        await mkdir(cursor); stat = await lstat(cursor);
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Artifact ancestor is not a regular directory');
      this.contained(await realpath(cursor));
    }
    const parent = await lstat(dirname(destination));
    if (parent.isSymbolicLink() || !parent.isDirectory()) throw new Error('Artifact parent is not a regular directory');
    this.contained(await realpath(dirname(destination)));
    let leaf: Stats | null;
    try {leaf = await lstat(destination);} catch (error) {if (!absent(error)) throw error; leaf = null;}
    if (leaf && (leaf.isSymbolicLink() || !leaf.isFile())) throw new Error('Artifact leaf is not a regular file');
    await this.checkRoot(); return {path: destination, parent, leaf};
  }
  private async openChecked(path: string, flags: number, guard: () => void, requireAbsent = false): Promise<FileHandle> {
    const checked = await this.checked(path, true); if (requireAbsent && checked.leaf) throw new Error('Raw stream file already exists');
    guard(); const handle = await (this.io.open ?? open)(checked.path, flags | constants.O_NOFOLLOW, 0o600);
    try {
      const opened = await handle.stat(), current = await this.checked(path);
      if (!opened.isFile() || !current.leaf || !sameIdentity(opened, current.leaf) || !sameIdentity(checked.parent, current.parent) || checked.leaf && !sameIdentity(checked.leaf, opened)) throw new Error('Opened artifact identity differs from checked path');
      guard(); return handle;
    } catch (error) {await handle.close(); throw error;}
  }
  private async syncParent(path: string, expected: Stats) {
    await this.checkRoot(); const parent = dirname(path); this.contained(await realpath(parent));
    const handle = await open(parent, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {const actual = await lstat(parent), opened = await handle.stat(); if (!actual.isDirectory() || actual.isSymbolicLink() || !sameIdentity(expected, actual) || !sameIdentity(opened, actual)) throw new Error('Durability parent identity changed'); await handle.sync();} finally {await handle.close();}
  }
  private atomic(path: string, bytes: Uint8Array, guard: () => void): Promise<void> {
    return this.enqueue(async () => {
      if (this.streams.has(path)) throw new Error('Active raw stream owns artifact');
      const checked = await this.checked(path, true), temporary = `${path}.${randomUUID()}.tmp`;
      let created = false; let temporaryIdentity: Stats | null = null;
      try {
        guard(); const handle = await this.openChecked(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, guard, true); created = true; temporaryIdentity = await handle.stat();
        try {guard(); await handle.writeFile(bytes); await handle.sync();} finally {await handle.close();}
        const current = await this.checked(path);
        if (!sameIdentity(checked.parent, current.parent) || (checked.leaf ? !current.leaf || !sameFile(checked.leaf, current.leaf) : current.leaf !== null)) throw new Error('Atomic destination changed before replacement');
        guard(); await (this.io.rename ?? rename)(join(this.directory, temporary), current.path); created = false; await this.syncParent(current.path, current.parent);
      } finally {if (created) {const actual = await this.checked(temporary); if (actual.leaf && temporaryIdentity && sameIdentity(actual.leaf, temporaryIdentity)) await unlink(actual.path);}}
    }, guard);
  }
  text(path: string, value: string) {return this.atomic(path, Buffer.from(value), () => {});}
  async json(path: string, value: unknown) {return this.text(path, this.serialize(value));}
  append(path: string, entries: readonly unknown[]) {return this.appendGuarded(path, entries, () => {});}
  private async appendGuarded(path: string, entries: readonly unknown[], guard: () => void): Promise<void> {
    const lines = entries.map(entry => {const text = JSON.stringify(entry); if (text === undefined) throw new Error('JSONL entry is not serializable'); return text;});
    return this.enqueue(async () => {
      if (this.streams.has(path)) throw new Error('Active raw stream owns artifact');
      const handle = await this.openChecked(path, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND, guard);
      try {guard(); if (lines.length) await handle.writeFile(lines.join('\n') + '\n'); await handle.sync();} finally {await handle.close();}
    }, guard);
  }
  stream(path: string) {return this.streamGuarded(path, () => {});}
  private streamGuarded(path: string, guard: () => void): Promise<ComparisonRawStream> {
    return this.enqueue(async () => {
      if (this.streams.has(path)) throw new Error('Raw stream already active');
      const existing = await this.checked(path, true);
      if (existing.leaf && existing.leaf.size !== 0) throw new Error('Raw stream requires absent or initialized empty file');
      const handle = await this.openChecked(path, existing.leaf ? constants.O_WRONLY : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, guard, !existing.leaf);
      if ((await handle.stat()).size !== 0) {await handle.close(); throw new Error('Raw stream file is no longer empty');}
      this.streams.add(path); let completed = false;
      return {
        write: bytes => this.enqueue(async () => {if (completed) throw new Error('Raw stream is complete'); const current = await this.checked(path); if (!current.leaf || !sameIdentity(await handle.stat(), current.leaf)) throw new Error('Raw stream pathname was replaced'); guard(); await handle.writeFile(bytes);}, guard),
        complete: () => this.enqueue(async () => {if (completed) return; try {await handle.sync();} finally {await handle.close(); completed = true; this.streams.delete(path);}}, () => {}),
      };
    }, guard);
  }
  inventory(files: readonly ComparisonPayloadFile[]): Promise<ComparisonInventoryFile[]> {
    return this.enqueue(async () => {
      if (this.streams.size) throw new Error('Cannot inventory active raw streams');
      if (new Set(files.map(f => f.path)).size !== files.length) throw new Error('Duplicate inventory path');
      const inventory: ComparisonInventoryFile[] = [];
      for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
        comparisonArtifactPathSchema.parse(file.path); if (derived.has(basename(file.path))) throw new Error('Payload inventory excludes evidence and derived files');
        const before = await this.checked(file.path); if (!before.leaf) throw new Error('Inventoried payload is absent');
        const handle = await (this.io.open ?? open)(before.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let byteLength = 0; const hash = createHash('sha256');
        try {
          const opened = await handle.stat(); if (!opened.isFile() || !sameFile(opened, before.leaf)) throw new Error('Hash handle differs from checked path');
          for await (const bytes of handle.createReadStream({autoClose: false})) {byteLength += bytes.length; hash.update(bytes);}
          const afterHandle = await handle.stat(), after = await this.checked(file.path);
          if (!after.leaf || !sameFile(before.leaf, after.leaf) || !sameFile(opened, afterHandle) || !sameFile(afterHandle, after.leaf) || byteLength !== opened.size) throw new Error('Payload changed while hashing');
        } finally {await handle.close();}
        inventory.push(comparisonInventoryFileSchema.parse({...file, byteLength, sha256: hash.digest('hex')}));
      }
      return inventory;
    });
  }
  /** Settlement gate only; each queued operation still reports its own rejection to its caller. */
  async drain(): Promise<void> {await this.tail;}
  async seal(): Promise<void> {
    if (this.sealed) return; this.sealRequested = true; await this.tail;
    if (this.streams.size) {this.sealRequested = false; throw new Error('Cannot seal active raw streams');}
    await this.checkRoot(); this.sealed = true;
  }
}
