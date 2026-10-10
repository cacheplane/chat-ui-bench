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
  appendSerialized(path: string, records: readonly string[]): Promise<void>;
  stream(path: string): Promise<ComparisonRawStream>;
}
/** Narrow I/O injection supports controlled failure and pathname-substitution checks. */
export interface ComparisonFileOperations {open?: typeof open; rename?: typeof rename}
const derived = new Set(['evidence.json', 'raw-inventory.json', 'results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
function sameIdentity(a: Pick<Stats,'dev'|'ino'>, b: Pick<Stats,'dev'|'ino'>) {return a.dev === b.dev && a.ino === b.ino;}
function sameFile(a: Stats, b: Stats) {return sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;}
function absent(error: unknown): boolean {return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';}

/** Portable Node checks protect application-owned directories; this is not an adversarial openat sandbox. */
export class ComparisonArtifactWriter {
  private tail: Promise<unknown> = Promise.resolve();
  private sealed = false;
  private sealRequested = false;
  private readonly streams = new Set<string>();
  private serializedBatchOutstanding = false;
  private readonly candidates = new Map<string, {role:'destination'|'temporary'; reason?:string; identity?:Pick<Stats,'dev'|'ino'>}>();
  private readonly parents = new Map<string, Pick<Stats,'dev'|'ino'>>();
  private candidateAdmissionFailure:string|null = null;
  private constructor(readonly directory: string, private readonly rootIdentity: Stats, private readonly io: ComparisonFileOperations, private readonly candidateLimit:16|4096) {}
  static async create(directory: string, io: ComparisonFileOperations = {}, options: {candidateLimit:16|4096} = {candidateLimit:4096}): Promise<ComparisonArtifactWriter> {
    if (options.candidateLimit !== 16 && options.candidateLimit !== 4096) throw new Error('Candidate capacity must be root16 or slot4096');
    await mkdir(directory, {recursive: true});
    const supplied = await lstat(resolve(directory));
    if (supplied.isSymbolicLink() || !supplied.isDirectory()) throw new Error('Artifact root leaf must be a regular directory, not a symlink');
    const canonical = await realpath(resolve(directory)), identity = await lstat(canonical);
    if (!identity.isDirectory() || identity.isSymbolicLink()) throw new Error('Artifact root is not a regular directory');
    if (constants.O_NOFOLLOW === undefined) throw new Error('O_NOFOLLOW is required for comparison artifacts');
    return new ComparisonArtifactWriter(canonical, identity, io, options.candidateLimit);
  }
  scoped(assertActive: () => void): ComparisonScopedWriter {
    return {
      text: (path, value) => this.atomic(path, Buffer.from(value), assertActive),
      json: async (path, value) => this.atomic(path, Buffer.from(this.serialize(value)), assertActive),
      append: (path, entries) => this.appendGuarded(path, entries, assertActive),
      appendSerialized: (path, records) => this.appendSerializedGuarded(path, records, assertActive),
      stream: path => this.streamGuarded(path, assertActive),
    };
  }
  private admit(paths: readonly {path:string;role:'destination'|'temporary'}[]) {
    for (const entry of paths) comparisonArtifactPathSchema.parse(entry.path);
    const additions = new Set(paths.filter(entry => !this.candidates.has(entry.path)).map(entry => entry.path));
    if (this.candidates.size + additions.size > this.candidateLimit) {this.candidateAdmissionFailure='Artifact candidate capacity exhausted before mutation'; throw new Error(this.candidateAdmissionFailure);}
    for (const entry of paths) if (!this.candidates.has(entry.path)) this.candidates.set(entry.path, {role:entry.role});
  }
  private failure(path:string, error:unknown) {
    const candidate = this.candidates.get(path);
    if (candidate && !candidate.reason) candidate.reason = (error instanceof Error ? error.message || error.name : 'Artifact operation failed').slice(0,4096);
  }
  private destinationGuard(path:string, guard:()=>void) {guard(); if (this.streams.has(path)) throw new Error('Active raw stream owns artifact');}
  private tracked<T>(path:string, operation:()=>Promise<T>, guard:()=>void = ()=>{}):Promise<T> {
    try {guard(); if (this.sealed || this.sealRequested) throw new Error('Artifact writer is sealed'); this.admit([{path,role:'destination'}]);}
    catch(error) {return Promise.reject(error);}
    return this.enqueue(operation,guard).catch(error=>{this.failure(path,error); throw error;});
  }
  /** Durably claim a previously empty root. Failed/partial claims are retained and forbid reuse. */
  async claimEmptyRoot(path: string, value: unknown): Promise<void> {
    comparisonArtifactPathSchema.parse(path); if (path.includes('/')) throw new Error('Invocation claim must be a root member');
    const bytes = this.serialize(value);
    return this.tracked(path, async () => {
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
    let actual:Stats;
    try {actual=await lstat(this.directory);} catch(error) {if(absent(error)) throw new Error('Artifact root identity is absent',{cause:error}); throw error;}
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
        if (!absent(error)) throw error;
        if(this.parents.has(cursor)) throw new Error('Artifact ancestor identity was removed');
        if(!createParents) throw error;
        await mkdir(cursor); stat = await lstat(cursor);
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Artifact ancestor is not a regular directory');
      const known = this.parents.get(cursor); if(known && !sameIdentity(known,stat)) throw new Error('Artifact ancestor identity was replaced');
      this.parents.set(cursor,{dev:stat.dev,ino:stat.ino});
      this.contained(await realpath(cursor));
    }
    const parent = await lstat(dirname(destination));
    if (parent.isSymbolicLink() || !parent.isDirectory()) throw new Error('Artifact parent is not a regular directory');
    this.contained(await realpath(dirname(destination)));
    let leaf: Stats | null;
    try {leaf = await lstat(destination);} catch (error) {if (!absent(error)) throw error; leaf = null;}
    if (leaf && (leaf.isSymbolicLink() || !leaf.isFile())) throw new Error('Artifact leaf is not a regular file');
    const knownLeaf=this.candidates.get(path)?.identity;
    if(leaf && knownLeaf && !sameIdentity(knownLeaf,leaf)) throw new Error('Registered artifact leaf identity was replaced');
    await this.checkRoot(); return {path: destination, parent, leaf};
  }
  private async openChecked(path: string, flags: number, guard: () => void, requireAbsent = false): Promise<FileHandle> {
    const checked = await this.checked(path, true); if (requireAbsent && checked.leaf) throw new Error('Raw stream file already exists');
    guard(); const handle = await (this.io.open ?? open)(checked.path, flags | constants.O_NOFOLLOW, 0o600);
    try {
      const opened = await handle.stat();
      const candidate = this.candidates.get(path);
      if(opened.isFile() && candidate && !candidate.identity) candidate.identity={dev:opened.dev,ino:opened.ino};
      const current = await this.checked(path);
      if (!opened.isFile() || !current.leaf || !sameIdentity(opened, current.leaf) || !sameIdentity(checked.parent, current.parent) || checked.leaf && !sameIdentity(checked.leaf, opened)) throw new Error('Opened artifact identity differs from checked path');
      guard(); return handle;
    } catch (error) {
      try {await handle.close();} catch(closeError) {throw new AggregateError([error,closeError],`Checked open failed: ${error instanceof Error ? error.message : 'open failed'}; close failed: ${closeError instanceof Error ? closeError.message : 'close failed'}`);}
      throw error;
    }
  }
  private async syncParent(path: string, expected: Stats) {
    await this.checkRoot(); const parent = dirname(path); this.contained(await realpath(parent));
    const handle = await (this.io.open ?? open)(parent, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {const actual = await lstat(parent), opened = await handle.stat(); if (!actual.isDirectory() || actual.isSymbolicLink() || !sameIdentity(expected, actual) || !sameIdentity(opened, actual)) throw new Error('Durability parent identity changed'); await handle.sync();} finally {await handle.close();}
  }
  private atomic(path: string, bytes: Uint8Array, guard: () => void): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {this.destinationGuard(path,guard); if(this.sealed || this.sealRequested) throw new Error('Artifact writer is sealed'); this.admit([{path,role:'destination'},{path:temporary,role:'temporary'}]);} catch(error) {return Promise.reject(error);}
    return this.tracked(path, async () => {
      if (this.streams.has(path)) throw new Error('Active raw stream owns artifact');
      const checked = await this.checked(path, true);
      let created = false; let temporaryIdentity: Stats | null = null;
      let operationFailure:unknown;
      try {
        guard(); const handle = await this.openChecked(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, guard, true); created = true; temporaryIdentity = await handle.stat();
        try {guard(); await handle.writeFile(bytes); await handle.sync();} finally {await handle.close();}
        const current = await this.checked(path);
        if (!sameIdentity(checked.parent, current.parent) || (checked.leaf ? !current.leaf || !sameFile(checked.leaf, current.leaf) : current.leaf !== null)) throw new Error('Atomic destination changed before replacement');
        guard(); await (this.io.rename ?? rename)(join(this.directory, temporary), current.path); created = false;
        if(temporaryIdentity) this.candidates.get(path)!.identity={dev:temporaryIdentity.dev,ino:temporaryIdentity.ino};
        await this.syncParent(current.path, current.parent);
      } catch(error) {
        operationFailure=error; this.failure(temporary,error); throw error;
      } finally {
        try {
          if (created) {const actual = await this.checked(temporary); if (actual.leaf && temporaryIdentity && sameIdentity(actual.leaf, temporaryIdentity)) await unlink(actual.path);}
          try {const actual = await this.checked(temporary); if (!actual.leaf) this.candidates.delete(temporary);} catch(error) {if (!absent(error)) throw error; this.candidates.delete(temporary);}
        } catch(cleanupError) {
          this.failure(temporary,cleanupError);
          if(operationFailure!==undefined) throw new AggregateError([operationFailure,cleanupError],`Atomic operation and checked temporary cleanup failed: ${operationFailure instanceof Error ? operationFailure.message : 'operation failed'}; ${cleanupError instanceof Error ? cleanupError.message : 'cleanup failed'}`);
          throw cleanupError;
        }
      }
    }, guard);
  }
  text(path: string, value: string) {return this.atomic(path, Buffer.from(value), () => {});}
  async json(path: string, value: unknown) {return this.text(path, this.serialize(value));}
  append(path: string, entries: readonly unknown[]) {return this.appendGuarded(path, entries, () => {});}
  private async appendGuarded(path: string, entries: readonly unknown[], guard: () => void): Promise<void> {
    const lines = entries.map(entry => {const text = JSON.stringify(entry); if (text === undefined) throw new Error('JSONL entry is not serializable'); return text;});
    return this.tracked(path, async () => {
      if (this.streams.has(path)) throw new Error('Active raw stream owns artifact');
      const handle = await this.openChecked(path, constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND, guard);
      try {guard(); if (lines.length) await handle.writeFile(lines.join('\n') + '\n'); await handle.sync();} finally {await handle.close();}
    }, guard);
  }
  private appendSerializedGuarded(path:string, records:readonly string[], guard:()=>void):Promise<void> {
    try {
      this.destinationGuard(path,guard); if(this.sealed || this.sealRequested) throw new Error('Artifact writer is sealed');
      if(this.serializedBatchOutstanding) throw new Error('A serialized append batch is already outstanding');
      if(!Array.isArray(records) || records.length > 64) throw new Error('Serialized batch must contain at most 64 records');
      const owned:string[] = []; let total = 0;
      for(let i=0;i<records.length;i++) {
        const descriptor = Object.getOwnPropertyDescriptor(records,String(i));
        if(!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') throw new Error('Serialized records must be own primitive strings without accessors');
        const record:string = descriptor.value;
        if(record.length > 4194304) throw new Error('Serialized record exceeds code-unit bound');
        if(/[\r\n]/.test(record)) throw new Error('Serialized record contains literal CR/LF');
        const bytes = Buffer.byteLength(record,'utf8');
        if(bytes > 4194304) throw new Error('Serialized record exceeds UTF8 byte bound');
        total += bytes + 1; if(total > 16777216) throw new Error('Serialized batch exceeds UTF8 byte bound including LF');
        owned.push(record);
      }
      if(!owned.length) return this.enqueue(async()=>{},()=>this.destinationGuard(path,guard));
      this.serializedBatchOutstanding = true;
      const task = this.tracked(path,async()=>{
        if(this.sealRequested) throw new Error('Artifact writer seal requested');
        this.destinationGuard(path,guard);
        const handle = await this.openChecked(path,constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND,guard);
        try {for(const record of owned) {guard(); await handle.writeFile(record+'\n');} await handle.sync();} finally {await handle.close();}
      },()=>this.destinationGuard(path,guard));
      return task.finally(()=>{this.serializedBatchOutstanding=false;});
    } catch(error) {return Promise.reject(error);}
  }
  stream(path: string) {return this.streamGuarded(path, () => {});}
  private streamGuarded(path: string, guard: () => void): Promise<ComparisonRawStream> {
    return this.tracked(path, async () => {
      if (this.streams.has(path)) throw new Error('Raw stream already active');
      const existing = await this.checked(path, true);
      if (existing.leaf && existing.leaf.size !== 0) throw new Error('Raw stream requires absent or initialized empty file');
      const handle = await this.openChecked(path, existing.leaf ? constants.O_WRONLY : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, guard, !existing.leaf);
      if ((await handle.stat()).size !== 0) {await handle.close(); throw new Error('Raw stream file is no longer empty');}
      this.streams.add(path); let completed = false;
      return {
        write: bytes => this.tracked(path,async () => {if (completed) throw new Error('Raw stream is complete'); const current = await this.checked(path); if (!current.leaf || !sameIdentity(await handle.stat(), current.leaf)) throw new Error('Raw stream pathname was replaced'); guard(); await handle.writeFile(bytes);}, guard),
        complete: () => this.tracked(path,async () => {if (completed) return; try {await handle.sync();} finally {await handle.close(); completed = true; this.streams.delete(path);}}, () => {}),
      };
    }, guard);
  }
  reconcilePayloadCandidates():Promise<{present:readonly ComparisonPayloadFile[];absent:readonly {path:string;reason:string}[]}> {
    const task=this.tail.then(()=>this.readPayloadCandidates()); this.tail=task.catch(()=>{}); return task;
  }
  private async readPayloadCandidates():Promise<{present:readonly ComparisonPayloadFile[];absent:readonly {path:string;reason:string}[]}> {
    if(this.streams.size) throw new Error('Cannot reconcile active raw streams');
    const present:ComparisonPayloadFile[] = [], missing:{path:string;reason:string}[] = [];
    for(const [path,candidate] of [...this.candidates].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
      let exists:boolean;
      try {const leaf=(await this.checked(path)).leaf; exists=!!leaf;} catch(error) {if(!absent(error)) throw error; exists=false;}
      const reason = candidate.role==='temporary' ? `incomplete atomic temporary${candidate.reason ? ': '+candidate.reason : ''}`.slice(0,4096) : candidate.reason;
      if(!exists) missing.push({path,reason:reason ?? 'Registered artifact is absent'});
      else present.push(reason ? {path,status:'partial',reason} : {path,status:'complete'});
    }
    return {present,absent:missing};
  }
  inventory(files: readonly ComparisonPayloadFile[]): Promise<ComparisonInventoryFile[]> {
    const task=this.tail.then(()=>{
      if(files.some(file=>derived.has(basename(file.path)))) throw new Error('Payload inventory excludes its own manifest and derived files');
      return this.readInventory(files);
    });
    this.tail=task.catch(()=>{}); return task;
  }
  /** Read-only checked helper also works on sealed slots without mutation admission. */
  private async readInventory(files: readonly ComparisonPayloadFile[]): Promise<ComparisonInventoryFile[]> {
      if (this.streams.size) throw new Error('Cannot inventory active raw streams');
      if (new Set(files.map(f => f.path)).size !== files.length) throw new Error('Duplicate inventory path');
      const inventory: ComparisonInventoryFile[] = [];
      for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
        comparisonArtifactPathSchema.parse(file.path);
        const candidate=this.candidates.get(file.path);
        if(!candidate) throw new Error('Inventory path is not a registered artifact candidate');
        const before = await this.checked(file.path); if (!before.leaf) throw new Error('Inventoried payload is absent');
        const handle = await (this.io.open ?? open)(before.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let byteLength = 0; const hash = createHash('sha256');
        try {
          const opened = await handle.stat(); if (!opened.isFile() || !sameFile(opened, before.leaf)) throw new Error('Hash handle differs from checked path');
          for await (const bytes of handle.createReadStream({autoClose: false})) {byteLength += bytes.length; hash.update(bytes);}
          const afterHandle = await handle.stat(), after = await this.checked(file.path);
          if (!after.leaf || !sameFile(before.leaf, after.leaf) || !sameFile(opened, afterHandle) || !sameFile(afterHandle, after.leaf) || byteLength !== opened.size) throw new Error('Payload changed while hashing');
        } finally {await handle.close();}
        const failureReason=candidate.role==='temporary' ? `incomplete atomic temporary${candidate.reason ? ': '+candidate.reason : ''}`.slice(0,4096) : candidate.reason;
        inventory.push(comparisonInventoryFileSchema.parse({...file,...(failureReason ? {status:'partial',reason:failureReason} : {}), byteLength, sha256: hash.digest('hex')}));
      }
      return inventory;

  }
  /** Settlement gate only; each queued operation still reports its own rejection to its caller. */
  async drain(): Promise<void> {await this.tail;}
  async seal(): Promise<void> {
    if (this.sealed) return; this.sealRequested = true; await this.tail;
    if (this.streams.size) {this.sealRequested = false; throw new Error('Cannot seal active raw streams');}
    await this.checkRoot(); this.sealed = true;
  }
}
