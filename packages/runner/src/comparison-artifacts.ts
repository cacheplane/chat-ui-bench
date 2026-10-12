import {comparisonRuntimeFamily, type ComparisonRuntimeIdentity as ComparisonIdentity, type ComparisonRuntimeDataset as ComparisonDatasetInventory} from './comparison-runtime-family.js';
import type {ComparisonSchemaVersion} from '@chat-ui-bench/contract';
import {constants, type Stats} from 'node:fs';
import {lstat, mkdir, open, readdir, realpath, rename, unlink, type FileHandle} from 'node:fs/promises';
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {comparisonArtifactPathSchema, comparisonInventoryFileSchema, canonicalSerialize, type ComparisonInventoryFile} from '@chat-ui-bench/contract';

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
export interface ComparisonDatasetSlotSource {
  writer: ComparisonArtifactWriter; artifactDirectory: string; identity: ComparisonIdentity;
  status: 'valid'|'invalid'|'failed'; ownershipSettled: boolean; finalizationSucceeded: boolean;
}
export type ComparisonDatasetSealFacts = Readonly<ComparisonDatasetInventory>;
const derived = new Set(['evidence.json', 'raw-inventory.json', 'results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
const analysisDerived = new Set(['results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
function sameIdentity(a: Pick<Stats,'dev'|'ino'>, b: Pick<Stats,'dev'|'ino'>) {return a.dev === b.dev && a.ino === b.ino;}
function sameFile(a: Stats, b: Stats) {return sameIdentity(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;}
function absent(error: unknown): boolean {return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';}
async function closing<T>(handle:FileHandle,operation:()=>Promise<T>):Promise<T> {
  let value:T, failure:unknown, failed=false;
  try {value=await operation();} catch(error) {failure=error; failed=true;}
  try {await handle.close();} catch(error) {
    if(failed) throw new AggregateError([failure,error],[failure,error].map(e=>e instanceof Error?e.message:String(e)).join('; '));
    throw error;
  }
  if(failed) throw failure; return value!;
}

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
  private publicationRequested = false;
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
    await closing(handle,async()=>{
      const actual = await lstat(parent), opened = await handle.stat();
      if (!actual.isDirectory() || actual.isSymbolicLink() || !opened.isDirectory() || !sameIdentity(expected, actual) || !sameIdentity(opened, actual) || await realpath(parent)!==parent) throw new Error('Durability parent identity changed');
      await handle.sync();
      const after=await lstat(parent), afterHandle=await handle.stat();
      if(!after.isDirectory() || after.isSymbolicLink() || !sameIdentity(expected,after) || !sameIdentity(afterHandle,after) || await realpath(parent)!==parent) throw new Error('Durability parent identity changed after sync');
      await this.checkRoot();
    });
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
        complete: () => {
          const closeOwned=async()=>{if (completed) return; try {await handle.sync();} finally {await handle.close(); completed = true; this.streams.delete(path);}};
          if(!this.publicationRequested) return this.tracked(path,closeOwned,()=>{});
          // Publication freezes mutation admission, but cannot strand an already owned FD.
          // This lane only syncs/closes this existing stream; it never reopens publication.
          const task=this.tail.then(closeOwned).catch(error=>{this.failure(path,error); throw error;});
          this.tail=task.catch(()=>{}); return task;
        },
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
  /** Checked reads work on sealed slots; root's first collection also syncs retained payload bytes. */
  private async readInventory(files: readonly ComparisonPayloadFile[], durable = false): Promise<ComparisonInventoryFile[]> {
      if (this.streams.size) throw new Error('Cannot inventory active raw streams');
      if (new Set(files.map(f => f.path)).size !== files.length) throw new Error('Duplicate inventory path');
      const inventory: ComparisonInventoryFile[] = [];
      for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
        comparisonArtifactPathSchema.parse(file.path);
        const candidate=this.candidates.get(file.path);
        if(!candidate) throw new Error('Inventory path is not a registered artifact candidate');
        const before = await this.checked(file.path); if (!before.leaf) throw new Error('Inventoried payload is absent');
        const leaf=before.leaf;
        const handle = await (this.io.open ?? open)(before.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let byteLength = 0; const hash = createHash('sha256');
        await closing(handle,async()=>{
          const opened = await handle.stat(); if (!opened.isFile() || !sameFile(opened, leaf)) throw new Error('Hash handle differs from checked path');
          for await (const bytes of handle.createReadStream({autoClose: false})) {byteLength += bytes.length; hash.update(bytes);}
          if(durable) await handle.sync();
          const afterHandle = await handle.stat(), after = await this.checked(file.path);
          if (!after.leaf || !sameFile(leaf, after.leaf) || !sameFile(opened, afterHandle) || !sameFile(afterHandle, after.leaf) || byteLength !== opened.size) throw new Error('Payload changed while hashing');
        });
        const failureReason=candidate.role==='temporary' ? `incomplete atomic temporary${candidate.reason ? ': '+candidate.reason : ''}`.slice(0,4096) : candidate.reason;
        inventory.push(comparisonInventoryFileSchema.parse({...file,...(failureReason ? {status:'partial',reason:failureReason} : {}), byteLength, sha256: hash.digest('hex')}));
      }
      return inventory;

  }
  /** Settlement gate only; each queued operation still reports its own rejection to its caller. */
  async drain(): Promise<void> {await this.tail;}
  /** Root owns and pins every scheduled ancestor before any acquisition. */
  async createSlotWriter(prefix:string):Promise<ComparisonArtifactWriter> {
    if(this.candidateLimit!==16 || this.sealed || this.sealRequested) throw new Error('Only an active root can initialize a slot');
    comparisonArtifactPathSchema.parse(prefix);
    await this.checked(prefix+'/descriptor.json',true);
    return ComparisonArtifactWriter.create(join(this.directory,prefix),this.io,{candidateLimit:4096});
  }
  /** Owner-only declared metadata acquisition retains one whole JSON body, with checked identity/read count. */
  private async readJson(path:string):Promise<unknown> {
    if(!this.candidates.has(path)) throw new Error('JSON path is not registered');
    const before=await this.checked(path);
    if(!before.leaf) throw new Error('JSON member is absent');
    const leaf=before.leaf;
    const handle=await (this.io.open ?? open)(before.path,constants.O_RDONLY|constants.O_NOFOLLOW);
    return closing(handle,async()=>{
      const opened=await handle.stat();
      if(!opened.isFile() || !sameFile(opened,leaf)) throw new Error('JSON handle identity differs');
      const bytes=await handle.readFile();
      const current=await this.checked(path), after=await handle.stat();
      if(!current.leaf || !sameFile(opened,after) || !sameFile(opened,current.leaf) || bytes.length!==opened.size) throw new Error('JSON member changed during acquisition');
      return JSON.parse(bytes.toString('utf8'));
    });
  }
  /** Final root mutation. Normal admission and retries stay frozen even on failure. */
  publishDatasetSeal(sources:readonly ComparisonDatasetSlotSource[],build:(checked:ComparisonDatasetSealFacts)=>ComparisonDatasetInventory,version:ComparisonSchemaVersion='2.0.0'):Promise<void> {
    const family=comparisonRuntimeFamily(version);
    if(this.candidateLimit!==16 || this.sealed || this.sealRequested || this.publicationRequested) return Promise.reject(new Error('Dataset publication requires an unfrozen root writer; retry is forbidden'));
    this.publicationRequested=true;
    const sealTemporary=`dataset-seal.json.${randomUUID()}.tmp`;
    const failureTemporary=`dataset-finalization-failure.json.${randomUUID()}.tmp`;
    const ledgerTemporary=`invocation.json.${randomUUID()}.tmp`;
    try {this.admit([{path:'dataset-seal.json',role:'destination'},{path:sealTemporary,role:'temporary'},{path:'dataset-finalization-failure.json',role:'destination'},{path:failureTemporary,role:'temporary'},{path:'invocation.json',role:'destination'},{path:ledgerTemporary,role:'temporary'}]);}
    catch(error) {this.sealRequested=true; return Promise.reject(error);}
    this.sealRequested=true;
    // Snapshot bounded authority before awaiting the queue; no mutable caller array survives.
    const sourceCount=sources.length;
    const selected=sourceCount<=36 ? sources.map(source=>({...source,identity:{...source.identity}})) : [];
    const task=this.tail.then(async()=>{
      let facts:ComparisonDatasetInventory|undefined;
      let claim:ComparisonDatasetInventory['invocationClaim']|undefined;
      let ledger:ComparisonDatasetInventory['invocationLedger']|undefined;
      let durabilityDirectories:Map<string,Stats>|undefined;
      const writeReserved=async(path:string,temporary:string,value:unknown,requireAbsent:boolean)=>{
        try {
        const bytes=Buffer.from(this.serialize(value)), before=await this.checked(path);
        if(requireAbsent && before.leaf) throw new Error('Dataset seal destination already exists');
        const handle=await this.openChecked(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,()=>{},true);
        const opened=await closing(handle,async()=>{const actual=await handle.stat(); await handle.writeFile(bytes); await handle.sync(); return actual;});
        const current=await this.checked(path);
        if(!sameIdentity(before.parent,current.parent) || (before.leaf ? !current.leaf || !sameFile(before.leaf,current.leaf) : current.leaf!==null)) throw new Error('Publication destination changed before rename');
        await (this.io.rename ?? rename)(join(this.directory,temporary),current.path);
        this.candidates.get(path)!.identity={dev:opened.dev,ino:opened.ino};
        await this.syncParent(current.path,current.parent);
        const published=await this.readJson(path);
        if(canonicalSerialize(published)!==canonicalSerialize(value)) throw new Error('Published JSON content differs');
        const [content]=await this.readInventory([{path,status:'complete'}]);
        if(!content || content.byteLength!==bytes.length || content.sha256!==createHash('sha256').update(bytes).digest('hex')) throw new Error('Published exact JSON bytes differ');
        const remaining=await this.checked(temporary); if(!remaining.leaf) this.candidates.delete(temporary);
        } catch(error) {this.failure(path,error); this.failure(temporary,error); throw error;}
      };
      try {
        if(!selected.length || sourceCount>36 || new Set(selected.map(s=>s.writer)).size!==selected.length || new Set(selected.map(s=>s.artifactDirectory)).size!==selected.length) throw new Error('Dataset requires unique bounded slot sources');
        await this.checkRoot(); if(this.streams.size) throw new Error('Dataset root has active streams');
        claim=family.comparisonDatasetInventorySchema.shape.invocationClaim.parse(await this.readJson('invocation-claim.json'));
        ledger=family.comparisonCaptureInvocationSchema.parse(await this.readJson('invocation.json'));
        if(ledger.runs.length!==selected.length) throw new Error('Dataset sources differ from every scheduled ledger row');
        const collect=async():Promise<ComparisonDatasetInventory>=>{
          const members:ComparisonDatasetInventory['members']=[], absentMembers:ComparisonDatasetInventory['absentMembers']=[];
          const directoryIdentities=new Map<string,Stats>([['',this.rootIdentity]]);
          const excluded=(path:string)=>path==='dataset-seal.json' || path===sealTemporary || derived.has(basename(path)) && path!=='evidence.json' && path!=='raw-inventory.json';
          const addDirectory=async(path:string,writer:ComparisonArtifactWriter,local:string)=>{
            const actual=await lstat(join(this.directory,path));
            if(!actual.isDirectory() || actual.isSymbolicLink()) throw new Error('Declared dataset directory is not regular');
            const known=local==='' ? writer.rootIdentity : writer.parents.get(join(writer.directory,local)) ?? this.parents.get(join(this.directory,path));
            if(known && !sameIdentity(actual,known)) throw new Error('Declared dataset directory identity was replaced');
            const prior=directoryIdentities.get(path); if(prior && !sameIdentity(prior,actual)) throw new Error('Dataset directory substitution');
            directoryIdentities.set(path,actual);
          };
          const collectWriter=async(writer:ComparisonArtifactWriter,prefix:string)=>{
            await writer.checkRoot(); if(writer.streams.size || writer.candidateAdmissionFailure) throw new Error('Dataset writer has unresolved streams or candidate admission failure');
            const reconciled=await writer.readPayloadCandidates();
            const files=await writer.readInventory(reconciled.present.filter(f=>!excluded(f.path)),durabilityDirectories===undefined);
            members.push(...files.map(f=>({path:prefix+f.path,byteLength:f.byteLength,sha256:f.sha256})));
            absentMembers.push(...reconciled.absent.filter(f=>!excluded(f.path)).map(f=>({...f,path:prefix+f.path})));
            for(const candidate of [...reconciled.present,...reconciled.absent]) {
              const parts=candidate.path.split('/').slice(0,-1);
              for(let i=1;i<=parts.length;i++) {
                const local=parts.slice(0,i).join('/');
                try {await addDirectory(prefix+local,writer,local);} catch(error) {if(!absent(error)) throw error;}
              }
            }
            return {files,reconciled};
          };
          await collectWriter(this,'');
          for(let index=0;index<selected.length;index++) {
            const source=selected[index]!, row=ledger!.runs[index]!, writer=source.writer;
            comparisonArtifactPathSchema.parse(source.artifactDirectory);
            if(!source.ownershipSettled || !source.finalizationSucceeded || !writer.sealed || writer.candidateLimit!==4096 || writer.directory!==join(this.directory,source.artifactDirectory) || source.artifactDirectory!==row.artifactDirectory || source.status!==row.status) throw new Error('Slot source is not settled, sealed or descriptor-bound');
            await writer.drain();
            const descriptor=family.comparisonScheduledRunSchema.parse(await writer.readJson('descriptor.json'));
            const validation=family.comparisonValidationSchema.parse(await writer.readJson('validation.json'));
            const exceptions=family.comparisonExceptionsSchema.parse(await writer.readJson('exceptions.json'));
            const expected={...source.identity,seed:ledger!.configuration.seed,mode:ledger!.configuration.mode,artifactDirectory:source.artifactDirectory};
            if(canonicalSerialize(descriptor)!==canonicalSerialize(expected) || validation.status!==source.status || canonicalSerialize(validation.reasons)!==canonicalSerialize(row.reasons) || Object.keys(source.identity).some(key=>validation[key as keyof typeof validation]!==source.identity[key as keyof ComparisonIdentity] || exceptions[key as keyof typeof exceptions]!==source.identity[key as keyof ComparisonIdentity])) throw new Error('Checked slot descriptor, verdict or exception identity differs');
            const prefix=source.artifactDirectory+'/';
            const collected=await collectWriter(writer,prefix);
            if(collected.reconciled.present.some(f=>f.path==='finalization-status.json')) throw new Error('Slot finalization failure prohibits dataset publication');
            const manifests=collected.files.filter(f=>f.path==='evidence.json' || f.path==='raw-inventory.json');
            if(manifests.length!==1) throw new Error('Slot requires exactly one inventory manifest');
            const manifestPath=manifests[0]!.path;
            const manifest=manifestPath==='evidence.json' ? family.comparisonEvidenceSchema.parse(await writer.readJson(manifestPath)) : family.comparisonRawInventorySchema.parse(await writer.readJson(manifestPath));
            if(Object.keys(source.identity).some(key=>manifest[key as keyof typeof manifest]!==source.identity[key as keyof ComparisonIdentity])) throw new Error('Slot manifest identity differs');
            const raw=collected.files.filter(f=>f.path!==manifestPath);
            // Manifest statuses are driver facts; checked operation failure always takes precedence.
            const checked=await writer.readInventory(manifest.files.map(f=>({path:f.path,status:f.status,...(f.reason?{reason:f.reason}:{})})));
            if(canonicalSerialize(checked)!==canonicalSerialize(manifest.files) || raw.length!==manifest.files.length || raw.some(f=>!manifest.files.some(m=>m.path===f.path && m.sha256===f.sha256 && m.byteLength===f.byteLength))) throw new Error('Slot manifest has stale hashes or missing raw members');
            if('unavailableFiles' in manifest && canonicalSerialize([...manifest.unavailableFiles].sort((a,b)=>a.path.localeCompare(b.path)))!==canonicalSerialize([...collected.reconciled.absent].sort((a,b)=>a.path.localeCompare(b.path)))) throw new Error('Slot manifest absent members differ');
            if(!raw.some(f=>f.path==='capture-status.json')) throw new Error('Every slot requires checked owner capture-status.json');
            const status=family.comparisonCaptureStatusSchema.parse(await writer.readJson('capture-status.json'));
            if(Object.keys(source.identity).some(key=>status[key as keyof typeof status]!==source.identity[key as keyof ComparisonIdentity])) throw new Error('Capture status identity differs');
            if((status.evidenceMetadata.status==='available')!==(manifestPath==='evidence.json')) throw new Error('Capture status evidence availability differs from actual slot manifest');
            const payloads=manifest.files.filter(f=>f.path!=='capture-status.json').map(f=>({path:f.path,status:f.status,...(f.reason!==undefined?{reason:f.reason}:{})}));
            if(canonicalSerialize(status.payloads)!==canonicalSerialize(payloads) || canonicalSerialize(status.unavailablePaths)!==canonicalSerialize(collected.reconciled.absent)) throw new Error('Capture status disagrees with checked raw membership');
            if('instrumentation' in manifest && status.finalPageInstrumentation.status==='available' && canonicalSerialize(status.finalPageInstrumentation.value)!==canonicalSerialize(manifest.instrumentation)) throw new Error('Capture status instrumentation differs from evidence');
            const parts=source.artifactDirectory.split('/');
            for(let i=1;i<=parts.length;i++) await addDirectory(parts.slice(0,i).join('/'),writer,i===parts.length?'':'__scheduled_parent__');
          }
          members.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0); absentMembers.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
          const directories=[...directoryIdentities.keys()].filter(Boolean).sort();
          // Enumerate only finite declared ancestors; never follow or hash unknown entries.
          const allowed=new Set([...members.map(f=>f.path),...directories,'dataset-seal.json',sealTemporary]);
          for(const directory of [...directoryIdentities.keys()]) {
            const actual=await lstat(join(this.directory,directory));
            if(!actual.isDirectory() || actual.isSymbolicLink() || !sameIdentity(actual,directoryIdentities.get(directory)!)) throw new Error('Dataset directory identity changed');
            for(const entry of await readdir(join(this.directory,directory),{withFileTypes:true})) {
              const path=directory ? directory+'/'+entry.name : entry.name;
              if(!allowed.has(path) && !analysisDerived.has(entry.name)) throw new Error('Unexpected dataset entry: '+path);
              if(entry.isSymbolicLink() || !entry.isFile() && !entry.isDirectory() || entry.isDirectory()!==directoryIdentities.has(path)) throw new Error('Unexpected dataset entry type: '+path);
            }
          }
          const rootClaim=family.comparisonDatasetInventorySchema.shape.invocationClaim.parse(await this.readJson('invocation-claim.json'));
          const rootLedger=family.comparisonCaptureInvocationSchema.parse(await this.readJson('invocation.json'));
          if(canonicalSerialize(rootClaim)!==canonicalSerialize(claim) || canonicalSerialize(rootLedger)!==canonicalSerialize(ledger)) throw new Error('Claim or ledger changed during publication');
          const ledgerMember=members.find(m=>m.path==='invocation.json'); if(!ledgerMember) throw new Error('Missing checked ledger');
          const {schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion}=claim!;
          durabilityDirectories ??= directoryIdentities;
          return family.comparisonDatasetInventorySchema.parse({schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion,invocationId:claim!.invocationId,status:'sealed',configuration:ledger!.configuration,invocationClaim:claim,invocationLedger:ledger,root:'.',ledger:ledgerMember,members,absentMembers,directories,slots:selected.map(s=>({identity:s.identity,artifactDirectory:s.artifactDirectory,status:s.status})),ownershipSettled:true,finalizationSucceeded:true});
        };
        facts=await collect();
        const supplied=family.comparisonDatasetInventorySchema.parse(build(structuredClone(facts)));
        if(canonicalSerialize(supplied)!==canonicalSerialize(facts)) throw new Error('Dataset builder differs from independently checked facts');
        // Persist only the finite checked directory tree, deepest first and root last.
        for(const [directory,expected] of [...durabilityDirectories!].sort(([a],[b])=>b.split('/').filter(Boolean).length-a.split('/').filter(Boolean).length || (a<b?-1:a>b?1:0))) {
          await this.syncParent(join(this.directory,directory,'__directory_durability__'),expected);
        }
        await writeReserved('dataset-seal.json',sealTemporary,supplied,true);
        const after=await collect();
        if(canonicalSerialize(after)!==canonicalSerialize(facts)) throw new Error('Dataset members changed after publication');
        if(canonicalSerialize(await this.readJson('dataset-seal.json'))!==canonicalSerialize(facts)) throw new Error('Dataset seal changed during final postcheck');
        const [sealContent]=await this.readInventory([{path:'dataset-seal.json',status:'complete'}]);
        const expectedBytes=Buffer.from(this.serialize(facts));
        if(!sealContent || sealContent.byteLength!==expectedBytes.length || sealContent.sha256!==createHash('sha256').update(expectedBytes).digest('hex')) throw new Error('Dataset seal exact bytes changed during final postcheck');
        this.sealed=true;
      } catch(error) {
        const errors:unknown[]=[error]; let sealState:'absent'|'present-unusable'|'unavailable'='unavailable';
        // Every safely obtainable failure outcome poisons the seal. If ALL retention writes
        // fail after rename, offline consistency cannot prove command success/crash durability.
        if(!claim) {try {claim=family.comparisonDatasetInventorySchema.shape.invocationClaim.parse(await this.readJson('invocation-claim.json'));} catch(retention) {errors.push(retention);}}
        if(!ledger) {try {ledger=family.comparisonCaptureInvocationSchema.parse(await this.readJson('invocation.json'));} catch(retention) {errors.push(retention);}}
        try {sealState=(await this.checked('dataset-seal.json')).leaf?'present-unusable':'absent';} catch(retention) {errors.push(retention);}
        if(claim) {
          const {schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion,invocationId}=claim;
          try {await writeReserved('dataset-finalization-failure.json',failureTemporary,family.comparisonDatasetFinalizationFailureSchema.parse({schemaVersion,suite,suiteVersion,collectorVersion,analyzerVersion,invocationId,status:'failed',reasons:[error instanceof Error?error.message.slice(0,4096):'Dataset publication failed'],failedAtHostMs:performance.now(),sealPath:'dataset-seal.json',sealState}),false);} catch(retention) {errors.push(retention);}
        }
        if(ledger) {
          ledger.status='failed';
          const first=ledger.runs[0]; if(first) {first.status='failed'; first.reasons=[...first.reasons,'Dataset finalization failed: '+(error instanceof Error?error.message:'publication error')];}
          try {await writeReserved('invocation.json',ledgerTemporary,family.comparisonCaptureInvocationSchema.parse(ledger),false);} catch(retention) {errors.push(retention);}
        }
        throw new AggregateError(errors,errors.map(e=>e instanceof Error?e.message:String(e)).join('; '));
      }
    });
    this.tail=task.catch(()=>{}); return task;
  }
  async seal(): Promise<void> {
    if (this.sealed) return;
    if(this.publicationRequested) throw new Error('Dataset publication is frozen; ordinary seal is forbidden');
    this.sealRequested = true; await this.tail;
    if (this.streams.size) {this.sealRequested = false; throw new Error('Cannot seal active raw streams');}
    await this.checkRoot(); this.sealed = true;
  }
}
