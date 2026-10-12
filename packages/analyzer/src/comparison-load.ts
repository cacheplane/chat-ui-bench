import fs from 'node:fs/promises';
import {constants, type BigIntStats} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute, join, normalize, parse} from 'node:path';

export type ComparisonRawRole =
  | 'root-json' | 'dataset-seal' | 'slot-json' | 'jsonl' | 'trace'
  | 'installer' | 'retained-opaque' | 'temporary' | 'unknown';

export interface ComparisonByteFact { byteLength: number; sha256: string }
export type ComparisonLoadingIssue =
  | {kind: 'admission-limit'; path: string; role: ComparisonRawRole; limitName: string;
     limit: number; observed: number; observation: 'exact' | 'lower-bound'; reason: string}
  | {kind: 'absent' | 'malformed' | 'unreadable' | 'identity' | 'membership' | 'integrity';
     path: string; role: ComparisonRawRole; reason: string};

export interface ComparisonMemberReference {
  path: string;
  role: ComparisonRawRole;
  expected: ComparisonByteFact;
}

export type LoadedComparisonMember =
  | {status: 'verified-bytes'; path: string; fact: ComparisonByteFact; loadingIssues: []}
  | {status: 'failed'; path: string; fact: ComparisonByteFact | null; loadingIssues: ComparisonLoadingIssue[];
     ioFailures?: {operation: 'path-stat' | 'open' | 'descriptor-stat' | 'read' | 'close'; error: unknown}[]};

const MIB = 1024 * 1024;
const ROLE_BYTE_LIMITS: Readonly<Record<Exclude<ComparisonRawRole, 'unknown'>, number>> = {
  'root-json': 32 * MIB, 'dataset-seal': 128 * MIB, 'slot-json': 32 * MIB,
  jsonl: 512 * MIB, trace: 128 * MIB, installer: MIB,
  'retained-opaque': 16 * 1024 * MIB, temporary: 16 * 1024 * MIB,
};
const normalizedMember = (path: string) => /^[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/.test(path)
  && !path.split('/').some(part => part === '.' || part === '..');
const identity = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino
  && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
type Ancestor = {path: string; dev: bigint; ino: bigint};
const sameAncestors = (a: Ancestor[], b: Ancestor[]) => a.length === b.length
  && a.every((row, i) => row.path === b[i]!.path && row.dev === b[i]!.dev && row.ino === b[i]!.ino);

class MemberFailure extends Error {
  constructor(readonly issue: ComparisonLoadingIssue) {super(issue.reason);}
}
function preview(error: unknown, prefix = ''): string {
  let text: string; try {text = String(error);} catch {text = 'Unrenderable original filesystem failure';}
  // Report preview only; complete original errors stay in the bounded internal IO failure list.
  const scalars: {text: string; bytes: number}[] = []; let bytes = 0, truncated = false;
  scan: for (const part of [prefix, text]) for (const scalar of part) {
    const point = scalar.codePointAt(0)!;
    const width = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (width > 4096 - bytes) {truncated = true; break scan;}
    scalars.push({text: scalar, bytes: width}); bytes += width;
  }
  if (truncated) while (bytes > 4093) bytes -= scalars.pop()!.bytes;
  return scalars.map(scalar => scalar.text).join('') + (truncated ? '...' : '');
}

/** Byte admission only. Collection/version/semantics and presentation eligibility are separate. */
async function readCheckedMember(
  absoluteDirectory: string,
  reference: ComparisonMemberReference,
  consume?: (bytes: Uint8Array) => void,
  finish?: () => void,
): Promise<LoadedComparisonMember> {
  const issues: ComparisonLoadingIssue[] = [], ioFailures: NonNullable<Extract<LoadedComparisonMember, {status: 'failed'}>['ioFailures']> = [];
  let fact: ComparisonByteFact | null = null;
  let operation: (typeof ioFailures)[number]['operation'] = 'path-stat';
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let originalPath: string | undefined, originalFile: BigIntStats | undefined, originalChain: Ancestor[] | undefined;
  const fail = (kind: Exclude<ComparisonLoadingIssue['kind'], 'admission-limit'>, reason: string, path = reference.path): never => {
    throw new MemberFailure({kind, path, role: reference.role, reason});
  };
  async function ancestors(path: string): Promise<Ancestor[]> {
    const parts = path.slice(parse(path).root.length).split('/');
    let current = parse(path).root;
    const rows: Ancestor[] = [];
    for (const part of parts) {
      current = join(current, part); operation = 'path-stat';
      const stat = await fs.lstat(current, {bigint: true});
      if (stat.isSymbolicLink()) fail('identity', 'Supplied ancestor is a symbolic link');
      if (!stat.isDirectory()) fail('identity', 'Supplied ancestor is not a directory');
      rows.push({path: current, dev: stat.dev, ino: stat.ino});
    }
    return rows;
  }
  try {
    if (!isAbsolute(absoluteDirectory) || normalize(absoluteDirectory) !== absoluteDirectory)
      fail('membership', 'Dataset root must be a normalized absolute directory', '.');
    if (typeof reference.path !== 'string' || !normalizedMember(reference.path))
      fail('membership', 'Member must have a normalized relative path', '.');
    if (reference.role === 'unknown' || !Object.hasOwn(ROLE_BYTE_LIMITS, reference.role))
      fail('membership', 'Member has no admitted byte role');
    if (!Number.isSafeInteger(reference.expected.byteLength) || reference.expected.byteLength < 0
      || !/^[a-f0-9]{64}$/.test(reference.expected.sha256)) fail('integrity', 'Invalid declared byte length or digest');
    const path = join(absoluteDirectory, reference.path), parent = path.slice(0, path.lastIndexOf('/'));
    const chain = await ancestors(parent); operation = 'path-stat';
    const before = await fs.lstat(path, {bigint: true});
    originalPath = path; originalFile = before; originalChain = chain;
    if (before.isSymbolicLink()) fail('identity', 'Member is a symbolic link');
    if (!before.isFile()) fail('identity', 'Member must be a regular file');
    const limit = ROLE_BYTE_LIMITS[reference.role as Exclude<ComparisonRawRole, 'unknown'>];
    if (before.size > BigInt(limit)) {
      throw new MemberFailure({kind: 'admission-limit', path: reference.path, role: reference.role,
        limitName: reference.role === 'root-json' || reference.role === 'slot-json' ? 'ordinaryJsonBytes' : 'roleBytes',
        limit, observed: before.size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(before.size) : limit + 1,
        observation: before.size <= BigInt(Number.MAX_SAFE_INTEGER) ? 'exact' : 'lower-bound',
        reason: 'Original member exceeds its analyzer byte admission limit'});
    }
    if (before.size !== BigInt(reference.expected.byteLength)) fail('integrity', 'Original size differs from declared byte length');
    operation = 'open'; handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    operation = 'descriptor-stat'; const opened = await handle.stat({bigint: true});
    if (!opened.isFile() || !identity(opened, before)) fail('identity', 'Opened descriptor differs from original regular file');
    if (!sameAncestors(chain, await ancestors(parent))) fail('identity', 'Ancestor identity changed before reading');
    const hash = createHash('sha256'), block = Buffer.allocUnsafe(65536); let length = 0;
    for (;;) {
      operation = 'read'; const result = await handle.read(block, 0, block.length, null);
      if (!Number.isSafeInteger(result.bytesRead) || result.bytesRead < 0 || result.bytesRead > block.length)
        fail('identity', 'Original descriptor returned an invalid byte count');
      if (!result.bytesRead) break;
      if (result.bytesRead > limit - length) fail('integrity', 'Original file grew beyond its byte admission limit');
      const bytes = block.subarray(0, result.bytesRead);
      length += result.bytesRead; hash.update(bytes); consume?.(bytes);
    }
    finish?.();
    operation = 'descriptor-stat';
    if (!identity(await handle.stat({bigint: true}), before)) fail('identity', 'Original descriptor identity changed during reading');
    operation = 'path-stat'; const after = await fs.lstat(path, {bigint: true});
    if (after.isSymbolicLink() || !after.isFile() || !identity(after, before)) fail('identity', 'Original pathname identity changed during reading');
    if (!sameAncestors(chain, await ancestors(parent))) fail('identity', 'Ancestor identity changed during reading');
    if (length !== reference.expected.byteLength) fail('integrity', 'Read length differs from declared byte length');
    fact = {byteLength: length, sha256: hash.digest('hex')};
    if (fact.sha256 !== reference.expected.sha256) fail('integrity', 'Original digest differs from declared digest');
  } catch (error) {
    if (error instanceof MemberFailure) issues.push(error.issue);
    else {
      ioFailures.push({operation, error});
      const missing = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
      issues.push({kind: missing ? originalFile !== undefined || handle !== undefined ? 'identity' : 'absent' : 'unreadable',
        path: reference.path, role: reference.role, reason: preview(error)});
    }
  } finally {
    if (handle) {
      try {await handle.close();} catch (error) {
        ioFailures.push({operation: 'close', error});
        issues.push({kind: 'unreadable', path: reference.path, role: reference.role, reason: preview(error, 'Original descriptor close failed: ')});
      }
    }
  }
  if (issues.length === 0 && fact !== null && originalPath && originalFile && originalChain) {
    try {
      const afterClose = await fs.lstat(originalPath, {bigint: true});
      if (afterClose.isSymbolicLink() || !afterClose.isFile() || !identity(afterClose, originalFile))
        fail('identity', 'Original pathname identity changed after descriptor close');
      const parent = originalPath.slice(0, originalPath.lastIndexOf('/'));
      if (!sameAncestors(originalChain, await ancestors(parent))) fail('identity', 'Ancestor identity changed after descriptor close');
    } catch (error) {
      if (error instanceof MemberFailure) issues.push(error.issue);
      else {
        ioFailures.push({operation: 'path-stat', error});
        issues.push({kind: 'identity', path: reference.path, role: reference.role, reason: preview(error, 'Post-close pathname identity unavailable: ')});
      }
    }
  }
  if (issues.length || fact === null) return {status: 'failed', path: reference.path, fact,
    loadingIssues: issues, ...(ioFailures.length ? {ioFailures} : {})};
  return {status: 'verified-bytes', path: reference.path, fact, loadingIssues: []};
}

export async function loadComparisonMember(root: string, reference: ComparisonMemberReference): Promise<LoadedComparisonMember> {
  return readCheckedMember(root, reference);
}

export interface ComparisonJsonAdmission {
  byteLength: number; analyzerWorkUnits: number; capturePrimitiveTokens: number;
  maximumDepth: number; traceEventCount?: number;
}
type FailedMember = Extract<LoadedComparisonMember, {status: 'failed'}>;
export type LoadedComparisonJson = FailedMember | {
  status: 'admitted-json'; path: string; fact: ComparisonByteFact;
  value: unknown; admission: ComparisonJsonAdmission; loadingIssues: [];
};
export type LoadedComparisonJsonLines = FailedMember | {
  status: 'admitted-jsonl'; path: string; fact: ComparisonByteFact;
  records: unknown[]; admission: ComparisonJsonAdmission[]; loadingIssues: [];
};

type JsonFrame = {
  kind: 'object' | 'array'; depth: number;
  state: 'key-or-end' | 'key' | 'colon' | 'value-or-end' | 'value' | 'waiting' | 'comma-or-end';
  keys: Set<string>; key: string | null; traceArray: boolean;
};
const whitespace = (c: string) => c === ' ' || c === '\t' || c === '\r' || c === '\n';

/** Private streamed admission, not a semantic schema/parser registry. No whole value objects are allocated. */
class JsonAdmission {
  private decoder = new TextDecoder('utf8', {fatal: true, ignoreBOM: true});
  private frames: JsonFrame[] = [];
  private token: 'key' | 'string' | 'number' | 'literal' | null = null;
  private escaped = false; private unicode = 0; private keyText = '';
  private number = ''; private literal = ''; private literalIndex = 0;
  private started = false; private complete = false; private traceSeen = false;
  private offset = 0; private bytes = 0; private work = 0; private tokens = 0; private depth = 0; private events = 0;
  private readonly workLimit: number; private readonly depthLimit: number;
  constructor(private reference: ComparisonMemberReference, private record = false) {
    this.workLimit = record ? 65536 : reference.role === 'trace' || reference.role === 'dataset-seal' ? 8388608 : 2097152;
    this.depthLimit = reference.role === 'trace' && !record ? 64 : 32;
  }
  malformed(reason: string): never {
    throw new MemberFailure({kind: 'malformed', path: this.reference.path, role: this.reference.role,
      reason: `${reason} at UTF8 byte ${this.offset}`});
  }
  private limit(name: string, value: number, maximum: number) {
    if (value > maximum) throw new MemberFailure({kind: 'admission-limit', path: this.reference.path, role: this.reference.role,
      limitName: name, limit: maximum, observed: value, observation: 'lower-bound',
      reason: `${name} exceeded during streamed admission at UTF8 byte ${this.offset}`});
  }
  private charge(work: number, tokens: number) {
    this.work += work; this.tokens += tokens;
    this.limit('jsonWorkUnits', this.work, this.workLimit);
    if (this.record) this.limit('capturePrimitiveTokens', this.tokens, 65536);
  }
  private finishValue() {
    const parent = this.frames.at(-1);
    if (parent) {parent.state = 'comma-or-end'; parent.key = null;} else this.complete = true;
  }
  private beginValue(c: string) {
    const parent = this.frames.at(-1), depth = parent ? parent.depth + 1 : 0;
    this.limit('jsonDepth', depth, this.depthLimit); this.depth = Math.max(this.depth, depth);
    if (!parent) {
      if (this.started) this.malformed('Trailing JSON value'); this.started = true;
      if (this.reference.role === 'trace' && !this.record && c !== '{') this.malformed('Trace root must be an object');
    }
    if (parent?.traceArray) {this.events++; this.limit('traceEvents', this.events, 1048576);}
    const traceArray = this.reference.role === 'trace' && !this.record && parent?.kind === 'object'
      && parent.depth === 0 && parent.key === 'traceEvents';
    if (traceArray) {if (c !== '[') this.malformed('Top-level traceEvents must be an array'); this.traceSeen = true;}
    if (parent) parent.state = 'waiting';
    if (c === '{' || c === '[') {
      this.charge(1, 2);
      this.frames.push({kind: c === '{' ? 'object' : 'array', depth,
        state: c === '{' ? 'key-or-end' : 'value-or-end', keys: new Set(), key: null, traceArray});
    } else if (c === '"') {this.charge(1, 2); this.token = 'string'; this.escaped = false; this.unicode = 0;}
    else if (c === '-' || /^[0-9]$/.test(c)) {this.charge(1, 2); this.token = 'number'; this.number = c;}
    else if (c === 't' || c === 'f' || c === 'n') {
      this.charge(1, c === 'n' ? 1 : 2); this.token = 'literal'; this.literal = c === 't' ? 'true' : c === 'f' ? 'false' : 'null'; this.literalIndex = 1;
    } else this.malformed('Invalid JSON value');
  }
  private endNumber() {
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(this.number)) this.malformed('Invalid JSON number');
    if (!Number.isFinite(Number(this.number))) this.malformed('Nonfinite JSON number');
    this.number = ''; this.token = null; this.finishValue();
  }
  private character(c: string) {
    if (this.token === 'string' || this.token === 'key') {
      if (this.token === 'key') this.keyText += c;
      if (this.unicode) {if (!/^[a-fA-F0-9]$/.test(c)) this.malformed('Invalid JSON Unicode escape'); this.unicode--; return;}
      if (this.escaped) {
        this.escaped = false;
        if (c === 'u') this.unicode = 4;
        else if (!'"\\/bfnrt'.includes(c)) this.malformed('Invalid JSON escape');
        return;
      }
      if (c === '\\') {this.escaped = true; return;}
      if (c === '"') {
        if (this.token === 'key') {
          const frame = this.frames.at(-1)!; const key = JSON.parse(this.keyText) as string;
          if (frame.keys.has(key)) this.malformed('Duplicate decoded key'); frame.keys.add(key);
          this.charge(1, 1); frame.key = key; frame.state = 'colon'; this.keyText = '';
        } else this.finishValue();
        this.token = null; return;
      }
      if (c.codePointAt(0)! < 32) this.malformed('Literal control in JSON string');
      return;
    }
    if (this.token === 'number') {
      if (/^[0-9eE+.-]$/.test(c)) {this.number += c; return;}
      this.endNumber(); this.character(c); return;
    }
    if (this.token === 'literal') {
      if (c !== this.literal[this.literalIndex]) this.malformed('Invalid JSON literal');
      if (++this.literalIndex === this.literal.length) {this.token = null; this.finishValue();}
      return;
    }
    if (whitespace(c)) return;
    if (this.complete) this.malformed('Trailing JSON input');
    const frame = this.frames.at(-1);
    if (!frame) {this.beginValue(c); return;}
    if (frame.state === 'key-or-end' || frame.state === 'key') {
      if (c === '}' && frame.state === 'key-or-end') {this.frames.pop(); this.finishValue(); return;}
      if (c !== '"') this.malformed('Expected JSON property key');
      this.token = 'key'; this.keyText = '"'; this.escaped = false; this.unicode = 0; return;
    }
    if (frame.state === 'colon') {if (c !== ':') this.malformed('Expected JSON colon'); frame.state = 'value'; return;}
    if (frame.state === 'value-or-end' || frame.state === 'value') {
      if (c === ']' && frame.kind === 'array' && frame.state === 'value-or-end') {this.frames.pop(); this.finishValue(); return;}
      this.beginValue(c); return;
    }
    if (frame.state === 'comma-or-end') {
      if (c === (frame.kind === 'object' ? '}' : ']')) {this.frames.pop(); this.finishValue(); return;}
      if (c !== ',') this.malformed('Expected JSON comma or closing delimiter');
      frame.state = frame.kind === 'object' ? 'key' : 'value'; return;
    }
    this.malformed('Incomplete JSON child value');
  }
  private text(text: string) {
    for (const scalar of text) {
      const point = scalar.codePointAt(0)!; this.offset += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
      this.character(scalar);
    }
  }
  feed(bytes: Uint8Array) {
    this.bytes += bytes.byteLength;
    let text: string; try {text = this.decoder.decode(bytes, {stream: true});} catch {this.malformed('Invalid UTF8');}
    this.text(text);
  }
  finish(): ComparisonJsonAdmission {
    let text: string; try {text = this.decoder.decode();} catch {this.malformed('Invalid UTF8');}
    this.text(text); if (this.token === 'number') this.endNumber();
    if (this.token || this.frames.length || !this.complete) this.malformed('Incomplete JSON input');
    if (this.reference.role === 'trace' && !this.record && !this.traceSeen) this.malformed('Missing top-level traceEvents array');
    return {byteLength: this.bytes, analyzerWorkUnits: this.work, capturePrimitiveTokens: this.tokens,
      maximumDepth: this.depth, ...(this.reference.role === 'trace' && !this.record ? {traceEventCount: this.events} : {})};
  }
}

/** Raw syntax admission; version-family schemas and independent semantic checks follow separately. */
export async function loadComparisonJson(root: string, reference: ComparisonMemberReference): Promise<LoadedComparisonJson> {
  if (!['root-json', 'dataset-seal', 'slot-json', 'trace'].includes(reference.role))
    return {status: 'failed', path: reference.path, fact: null, loadingIssues: [{kind: 'membership', path: reference.path,
      role: reference.role, reason: 'Member role does not admit a complete JSON payload'}]};
  const scanner = new JsonAdmission(reference), chunks: Buffer[] = []; let admission: ComparisonJsonAdmission | undefined;
  const loaded = await readCheckedMember(root, reference, bytes => {scanner.feed(bytes); chunks.push(Buffer.from(bytes));}, () => {admission = scanner.finish();});
  if (loaded.status === 'failed') return loaded;
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks, loaded.fact.byteLength).toString('utf8'));
    return {status: 'admitted-json', path: reference.path, fact: loaded.fact, value, admission: admission!, loadingIssues: []};
  } catch (error) {return {status: 'failed', path: reference.path, fact: loaded.fact, loadingIssues: [{
    kind: 'malformed', path: reference.path, role: reference.role, reason: preview(error, 'Admitted JSON decode failed: '),
  }]};}
}

/** JSONL is admitted record by record, never by dropping an incomplete or malformed tail. */
export async function loadComparisonJsonLines(root: string, reference: ComparisonMemberReference): Promise<LoadedComparisonJsonLines> {
  if (reference.role !== 'jsonl') return {status: 'failed', path: reference.path, fact: null, loadingIssues: [{
    kind: 'membership', path: reference.path, role: reference.role, reason: 'Member role does not admit JSONL records',
  }]};
  const records: unknown[] = [], admission: ComparisonJsonAdmission[] = [];
  let parts: Buffer[] = [], lineBytes = 0, scanner = new JsonAdmission(reference, true);
  const malformed = (reason: string): never => {throw new MemberFailure({kind: 'malformed', path: reference.path, role: reference.role, reason});};
  const limit = (name: string, value: number, maximum: number): never => {throw new MemberFailure({kind: 'admission-limit', path: reference.path,
    role: reference.role, limitName: name, limit: maximum, observed: value, observation: 'lower-bound', reason: `${name} exceeded in original JSONL`});};
  const append = (bytes: Uint8Array) => {
    if (bytes.includes(13)) malformed('Literal CR is not part of a serialized JSONL record');
    if (bytes.length > 4194304 - lineBytes) limit('jsonlRecordBytes', lineBytes + bytes.length, 4194304);
    lineBytes += bytes.length; scanner.feed(bytes); parts.push(Buffer.from(bytes));
  };
  const complete = () => {
    if (!lineBytes) malformed('Empty JSONL record');
    if (records.length === 131072) limit('jsonlRecords', records.length + 1, 131072);
    const stats = scanner.finish();
    try {records.push(JSON.parse(Buffer.concat(parts, lineBytes).toString('utf8')));} catch {malformed('Malformed original JSONL record');}
    admission.push(stats); parts = []; lineBytes = 0; scanner = new JsonAdmission(reference, true);
  };
  const loaded = await readCheckedMember(root, reference, bytes => {
    let start = 0;
    for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10) {append(bytes.subarray(start, i)); complete(); start = i + 1;}
    if (start < bytes.length) append(bytes.subarray(start));
  }, () => {if (lineBytes) malformed('Partial final JSONL record without LF');});
  if (loaded.status === 'failed') return loaded;
  return {status: 'admitted-jsonl', path: reference.path, fact: loaded.fact, records, admission, loadingIssues: []};
}
