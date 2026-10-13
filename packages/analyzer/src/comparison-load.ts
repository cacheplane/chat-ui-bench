import fs from 'node:fs/promises';
import {constants, type BigIntStats} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute, join, normalize, parse} from 'node:path';
import {z} from 'zod';
import {comparisonSchemasForVersionPair, type ComparisonSchemaPair} from '@chat-ui-bench/contract';
import {checkComparisonReferences, revokeComparisonReferences, unavailableComparisonReferences, type ComparisonSlotReferences, type ComparisonReferenceInput} from './comparison-reference-closure.js';
import {unavailableComparisonProvenanceGraph, provenanceGraphAdmission, provenanceMetadataPaths, provenanceMetadataCopiedWitnesses, checkComparisonProvenanceGraph, revokeComparisonProvenanceGraph, comparisonPackageMetadataSchema, type ComparisonProvenanceGraph, type ProductDeclaration, type ProbeDeclaration, type PackageMetadata} from './comparison-provenance-graph.js';
import {longThreadFixtureSchema, type LongThreadFixture} from '@chat-ui-bench/contract';
import {unavailableComparisonFinalContent, checkComparisonFinalContent, finalContentCardinalityIssues, replaceFinalContentIssue, revokeComparisonFinalContent, type ComparisonFinalContent, type FinalRuntime, type FinalVisible} from './comparison-final-content.js';
import {unavailableComparisonRendererDiagnostic, checkComparisonRendererDiagnostic, revokeComparisonRendererDiagnostic, type ComparisonRendererDiagnostic} from './comparison-renderer-diagnostic.js';
import {StreamedTraceAdmission, isStreamedTraceFailure, selectComparisonTracePolicy, notStartedTraceAdmission, type ComparisonTraceLoadOptions, type TraceAdmissionStatistics} from './comparison-trace-stream.js';

type ComparisonSchemas = ReturnType<typeof comparisonSchemasForVersionPair>;
type ComparisonIdentity = z.output<ComparisonSchemas['comparisonIdentitySchema']>;
type ComparisonScheduledRun = z.output<ComparisonSchemas['comparisonScheduledRunSchema']>;
type ComparisonManifest = z.output<ComparisonSchemas['comparisonManifestSchema']>;
type ComparisonValidation = z.output<ComparisonSchemas['comparisonValidationSchema']>;
type ComparisonExceptions = z.output<ComparisonSchemas['comparisonExceptionsSchema']>;
type ComparisonInvocation = z.output<ComparisonSchemas['comparisonCaptureInvocationSchema']>;
type ComparisonDataset = z.output<ComparisonSchemas['comparisonDatasetInventorySchema']>;

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

const memberFailures = new WeakSet<object>();
class MemberFailure extends Error {
  constructor(readonly issue: ComparisonLoadingIssue) {super(issue.reason); memberFailures.add(this);}
}
function isMemberFailure(value: unknown): value is MemberFailure {
  return (typeof value === 'object' && value !== null || typeof value === 'function') && memberFailures.has(value);
}
function isNodeMissing(value: unknown): boolean {
  try {return typeof value === 'object' && value !== null && 'code' in value && value.code === 'ENOENT';}
  catch {return false;}
}
const INVOCATION_BYTE_LIMIT = 16 * 1024 * MIB;
type OwnedMetadata = {status: 'verified-metadata'; path: string; byteLength: number; loadingIssues: []};
type ReadScope = {observe: (path: string, role: ComparisonRawRole, stat: BigIntStats) => void; metadataOnly?: boolean};
class InvocationBytes {
  readonly originals = new Map<string, {stat: BigIntStats; role: ComparisonRawRole; fact: ComparisonByteFact | null}>();
  observedUniqueBytes = 0;
  enforceLimit = false;
  exceeded = false;
  readonly ioFailures: {operation: 'path-stat' | 'open' | 'descriptor-stat' | 'read' | 'close'; path: string; error: unknown}[] = [];
  additionalIoFailureCount = 0;
  readonly failedOwnedReads = new Set<string>();
  ioFailure(operation: 'path-stat' | 'open' | 'descriptor-stat' | 'read' | 'close', path: string, error: unknown) {
    if (this.ioFailures.length < 32) this.ioFailures.push({operation, path, error}); else this.additionalIoFailureCount++;
  }
  observe(path: string, role: ComparisonRawRole, stat: BigIntStats, diagnostic = false) {
    const previous = this.originals.get(path);
    if (previous) {
      if (!identity(previous.stat, stat) || previous.role !== role) throw new MemberFailure({kind: 'identity', path, role,
        reason: 'Original member identity changed between owned reads'});
    } else {
      const size = Number(stat.size);
      if (!Number.isSafeInteger(size) || size < 0 || size > Number.MAX_SAFE_INTEGER - this.observedUniqueBytes)
        throw new MemberFailure({kind: 'integrity', path, role, reason: 'Original byte accounting is not safely representable'});
      this.originals.set(path, {stat, role, fact: null}); this.observedUniqueBytes += size;
    }
    if (this.enforceLimit && this.observedUniqueBytes > INVOCATION_BYTE_LIMIT) this.exceeded = true;
    if (this.exceeded && !diagnostic) throw new MemberFailure({kind: 'admission-limit', path, role, limitName: 'invocationUniqueBytes',
      limit: INVOCATION_BYTE_LIMIT, observed: this.observedUniqueBytes, observation: 'lower-bound', reason: 'Observed original bytes exceed invocation admission limit before payload read'});
  }
  scope(diagnostic = false): ReadScope & {metadataOnly: false} {return {observe: (path, role, stat) => this.observe(path, role, stat, diagnostic), metadataOnly: false};}
  metadataScope(): ReadScope & {metadataOnly: true} {return {observe: (path, role, stat) => this.observe(path, role, stat), metadataOnly: true};}
  retain(loaded: LoadedComparisonMember | OwnedMetadata) {
    if (loaded.status === 'failed' && this.originals.has(loaded.path)) this.failedOwnedReads.add(loaded.path);
    if (loaded.status === 'failed') for (const failure of loaded.ioFailures ?? []) this.ioFailure(failure.operation, loaded.path, failure.error);
    const original = this.originals.get(loaded.path);
    if (original && loaded.status === 'verified-bytes') {
      if (original.fact && (original.fact.byteLength !== loaded.fact.byteLength || original.fact.sha256 !== loaded.fact.sha256))
        throw new MemberFailure({kind: 'identity', path: loaded.path, role: original.role, reason: 'Original bytes changed between owned reads'});
      original.fact = loaded.fact;
    }
  }
}
/** Actual absence proof only: no opened payload, byte charge or synthetic digest. */
async function checkDeclaredAbsence(root: string, path: string, owner: InvocationBytes): Promise<ComparisonLoadingIssue | null> {
  const fail = (kind: 'identity' | 'membership' | 'unreadable', reason: string): never => {
    throw new MemberFailure({kind, path, role: 'unknown', reason: preview(reason)});
  };
  async function lookup(absolutePath: string): Promise<BigIntStats | null> {
    try {return await fs.lstat(absolutePath, {bigint: true});} catch (error) {
      if (isNodeMissing(error)) return null;
      owner.ioFailure('path-stat', path, error); return fail('unreadable', preview(error, 'Declared absent pathname lookup failed: '));
    }
  }
  async function ancestors(): Promise<{path: string; stat: BigIntStats | null}[]> {
    const parent = join(root, path, '..'), parts = parent.slice(parse(parent).root.length).split('/');
    let current = parse(parent).root; const rows: {path: string; stat: BigIntStats | null}[] = [];
    for (const part of parts) {
      current = join(current, part); const stat = await lookup(current);
      if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) fail('identity', 'Declared absent ancestor is not an original non-symlink directory');
      rows.push({path: current, stat});
    }
    return rows;
  }
  try {
    const before = await ancestors();
    if (await lookup(join(root, path))) fail('membership', 'Declared absent pathname is physically present');
    const after = await ancestors();
    if (before.length !== after.length || before.some((row, index) => {
      const next = after[index]!;
      return row.path !== next.path || (row.stat === null) !== (next.stat === null)
        || row.stat !== null && next.stat !== null && (row.stat.dev !== next.stat.dev || row.stat.ino !== next.stat.ino);
    })) fail('identity', 'Declared absent ancestor identity changed during pathname lookup');
    if (await lookup(join(root, path))) fail('membership', 'Declared absent pathname appeared during pathname lookup');
    return null;
  } catch (error) {if (isMemberFailure(error)) return error.issue; throw error;}
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
  reference: ComparisonMemberReference | (Pick<ComparisonMemberReference, 'path' | 'role'> & {expected?: never}),
  consume?: (bytes: Uint8Array) => void, finish?: () => void, mode?: 'declared' | 'measured-bootstrap',
  scope?: ReadScope & {metadataOnly?: false},
): Promise<LoadedComparisonMember>;
async function readCheckedMember(
  absoluteDirectory: string,
  reference: ComparisonMemberReference | (Pick<ComparisonMemberReference, 'path' | 'role'> & {expected?: never}),
  consume: undefined, finish: undefined, mode: 'measured-bootstrap', scope: ReadScope & {metadataOnly: true},
): Promise<LoadedComparisonMember | OwnedMetadata>;
async function readCheckedMember(
  absoluteDirectory: string,
  reference: ComparisonMemberReference | (Pick<ComparisonMemberReference, 'path' | 'role'> & {expected?: never}),
  consume?: (bytes: Uint8Array) => void,
  finish?: () => void,
  mode: 'declared' | 'measured-bootstrap' = 'declared',
  scope?: ReadScope,
): Promise<LoadedComparisonMember | OwnedMetadata> {
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
    const expected = reference.expected;
    if (expected === undefined ? mode !== 'measured-bootstrap' : !Number.isSafeInteger(expected.byteLength) || expected.byteLength < 0
      || !/^[a-f0-9]{64}$/.test(expected.sha256)) fail('integrity', 'Invalid declared byte length or digest');
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
    if (expected && before.size !== BigInt(expected.byteLength)) fail('integrity', 'Original size differs from declared byte length');
    operation = 'open'; handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    operation = 'descriptor-stat'; const opened = await handle.stat({bigint: true});
    if (!opened.isFile() || !identity(opened, before)) fail('identity', 'Opened descriptor differs from original regular file');
    if (!sameAncestors(chain, await ancestors(parent))) fail('identity', 'Ancestor identity changed before reading');
    scope?.observe(reference.path, reference.role, opened);
    if (!scope?.metadataOnly) {
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
    if (expected ? length !== expected.byteLength : BigInt(length) !== before.size)
      fail('integrity', expected ? 'Read length differs from declared byte length' : 'Read length differs from original descriptor byte length');
    fact = {byteLength: length, sha256: hash.digest('hex')};
    if (expected && fact.sha256 !== expected.sha256) fail('integrity', 'Original digest differs from declared digest');
    }
  } catch (error) {
    if (isMemberFailure(error)) issues.push(error.issue);
    else {
      ioFailures.push({operation, error});
      const missing = isNodeMissing(error);
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
  if (issues.length === 0 && originalPath && originalFile && originalChain) {
    try {
      const afterClose = await fs.lstat(originalPath, {bigint: true});
      if (afterClose.isSymbolicLink() || !afterClose.isFile() || !identity(afterClose, originalFile))
        fail('identity', 'Original pathname identity changed after descriptor close');
      const parent = originalPath.slice(0, originalPath.lastIndexOf('/'));
      if (!sameAncestors(originalChain, await ancestors(parent))) fail('identity', 'Ancestor identity changed after descriptor close');
    } catch (error) {
      if (isMemberFailure(error)) issues.push(error.issue);
      else {
        ioFailures.push({operation: 'path-stat', error});
        issues.push({kind: 'identity', path: reference.path, role: reference.role, reason: preview(error, 'Post-close pathname identity unavailable: ')});
      }
    }
  }
  if (scope?.metadataOnly && !issues.length && originalFile)
    return {status: 'verified-metadata', path: reference.path, byteLength: Number(originalFile.size), loadingIssues: []};
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
  constructor(private reference: Pick<ComparisonMemberReference, 'path' | 'role'>, private record = false) {
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

export type ComparisonRawAvailability = {status: 'parsed'; path: string}
  | {status: 'absent' | 'malformed' | 'unreadable'; path: string; reason: string};
export interface ComparisonLoadedDocument<T> {
  value: T | null; fact: ComparisonByteFact | null; availability: ComparisonRawAvailability;
}
export type ComparisonCounterSnapshot = z.output<ComparisonSchemas['comparisonCheckpointsSchema']>['counters'][number];
export interface ComparisonCounterCheckpoints {
  status: 'verified-original' | 'unavailable'; originalFileFact: ComparisonByteFact | null;
  rawAvailability: ComparisonRawAvailability; reason: string | null;
  recordedSnapshotCount: number | null; snapshots: ComparisonCounterSnapshot[];
}
function unavailableCounterCheckpoints(path: string): ComparisonCounterCheckpoints {
  return {status: 'unavailable', originalFileFact: null, rawAvailability: {status: 'unreadable', path, reason: 'Counter checkpoints not admitted by invocation preflight'},
    reason: 'Counter checkpoints not admitted by invocation preflight', recordedSnapshotCount: null, snapshots: []};
}
export interface ComparisonLoadedBootstrapRun {
  identity: ComparisonIdentity; artifactDirectory: string; descriptor: ComparisonScheduledRun | null;
  manifest: ComparisonManifest | null; captureValidation: ComparisonValidation | null;
  rawAvailability: {descriptor: ComparisonRawAvailability; manifest: ComparisonRawAvailability; captureValidation: ComparisonRawAvailability};
  loadingIssues: ComparisonLoadingIssue[]; additionalLoadingIssueCount: number;
  references: ComparisonSlotReferences;
  provenanceGraph: ComparisonProvenanceGraph;
  finalContent: ComparisonFinalContent;
  rendererPresentationCapabilityDiagnostic: ComparisonRendererDiagnostic;
  counterCheckpoints: ComparisonCounterCheckpoints;
  traceAdmission?: TraceAdmissionStatistics;
}
type Claim = z.output<ComparisonSchemas['comparisonDatasetInventorySchema']['shape']['invocationClaim']>;
export interface ComparisonLoadedInvocationBootstrap {
  tracePolicy?: 'streamed-renderer-events-v1';
  family: ComparisonSchemaPair | null;
  root: {claim: ComparisonLoadedDocument<Claim>; ledger: ComparisonLoadedDocument<ComparisonInvocation>;
    seal: ComparisonLoadedDocument<ComparisonDataset>};
  scheduled: number | null; runs: ComparisonLoadedBootstrapRun[];
  byteIntegrity: {status: 'not-inspected' | 'complete' | 'partial'; admission: 'unavailable' | 'within-limit' | 'exceeded'; observedUniqueBytes: number;
    files: {path: string; fact: ComparisonByteFact | null}[]; seal: 'not-verified' | 'byte-closed' | 'partial';
    ioFailures: {operation: 'path-stat' | 'open' | 'descriptor-stat' | 'read' | 'close'; path: string; error: unknown}[]; additionalIoFailureCount: number};
  collection: {status: 'partial' | 'unavailable'; reasons: string[]; onDiskConsistencyOnly: true};
  loadingIssues: ComparisonLoadingIssue[]; additionalLoadingIssueCount: number;
  physicalInventory: {status: 'not-inspected' | 'complete' | 'partial'; files: {path: string; role: ComparisonRawRole; byteLength: number; dev: string; ino: string; mtimeNs: string; ctimeNs: string}[];
    directories: string[]; candidates: {root: number; slots: {path: string; count: number}[]}; inspectedEntries: number;
    ioFailures: {operation: 'directory-open' | 'directory-read' | 'directory-close' | 'path-stat'; path: string; error: unknown}[]; additionalIoFailureCount: number;
    unknownEntries: {path: string; type: 'file' | 'directory' | 'symlink' | 'other' | 'unavailable'; byteLength: number | null; reason?: string}[]; additionalUnknownEntryCount: number};
}
function issueList() {
  const loadingIssues: ComparisonLoadingIssue[] = []; let additionalLoadingIssueCount = 0;
  return {loadingIssues, add(issue: ComparisonLoadingIssue) {if (loadingIssues.length < 32) loadingIssues.push(issue); else additionalLoadingIssueCount++;},
    count: () => additionalLoadingIssueCount};
}
/** Data-only measured bootstrap: no declared SHA is fabricated, and no absence mode is public. */
async function measuredJson(root: string, path: string, role: 'root-json' | 'dataset-seal' | 'slot-json' | 'trace', owner?: InvocationBytes, diagnostic = false): Promise<LoadedComparisonJson & {traceSyntaxUnavailable?: true}> {
  const reference = {path, role}, chunks: Buffer[] = [];
  let scanner: JsonAdmission | null = new JsonAdmission(reference), syntaxFailure: ComparisonLoadingIssue | undefined;
  let admission: ComparisonJsonAdmission | undefined;
  function stopTraceSyntax(error: unknown): void {
    if (role !== 'trace' || !isMemberFailure(error) || (error.issue.kind !== 'malformed' && error.issue.kind !== 'admission-limit')) throw error;
    syntaxFailure = error.issue; scanner = null; chunks.length = 0;
  }
  const loaded = await readCheckedMember(root, reference, bytes => {
    if (!scanner) return;
    try {scanner.feed(bytes);} catch (error) {stopTraceSyntax(error);}
    if (scanner) chunks.push(Buffer.from(bytes));
  }, () => {if (scanner) try {admission = scanner.finish();} catch (error) {stopTraceSyntax(error);}}, 'measured-bootstrap', owner?.scope(diagnostic));
  try {owner?.retain(loaded);} catch (error) {
    if (!isMemberFailure(error)) throw error;
    return {status: 'failed', path, fact: loaded.fact, loadingIssues: [error.issue]};
  }
  if (loaded.status === 'failed') return syntaxFailure ? {...loaded, loadingIssues: [syntaxFailure, ...loaded.loadingIssues]} : loaded;
  if (syntaxFailure) return {status: 'failed', path, fact: loaded.fact, loadingIssues: [syntaxFailure], traceSyntaxUnavailable: true};
  try {return {status: 'admitted-json', path, fact: loaded.fact, value: JSON.parse(Buffer.concat(chunks, loaded.fact.byteLength).toString('utf8')) as unknown,
    admission: admission!, loadingIssues: []};}
  catch (error) {return {status: 'failed', path, fact: loaded.fact, loadingIssues: [{kind: 'malformed', path, role, reason: preview(error)}]};}
}
/** Selected originals only; the same owned descriptor closes physical bytes independently. */
async function measuredStreamedTrace(root: string, path: string, owner: InvocationBytes) {
  const scanner = new StreamedTraceAdmission(); let syntaxFailure: ComparisonLoadingIssue | undefined;
  const inspect = (operation: () => void) => {
    try {operation();} catch (error) {
      if (!isStreamedTraceFailure(error)) throw error;
      const failure = error.failure;
      syntaxFailure = failure.kind === 'admission-limit'
        ? {kind: 'admission-limit', path, role: 'trace', reason: failure.reason, limitName: failure.limitName!, limit: failure.limit!, observed: failure.observed!, observation: 'lower-bound'}
        : {kind: 'malformed', path, role: 'trace', reason: failure.reason};
      scanner.dispose();
    }
  };
  try {
    const loaded = await readCheckedMember(root, {path, role: 'trace'}, bytes => {if (!syntaxFailure) inspect(() => scanner.feed(bytes));}, () => {if (!syntaxFailure) inspect(() => scanner.finish());}, 'measured-bootstrap', owner.scope());
    let raw: LoadedComparisonJson & {traceSyntaxUnavailable?: true};
    try {owner.retain(loaded);} catch (error) {
      if (!isMemberFailure(error)) throw error;
      const statistics = scanner.statistics(); scanner.dispose();
      const raw: LoadedComparisonJson & {traceSyntaxUnavailable?: true} = {status: 'failed', path, fact: loaded.fact, loadingIssues: [error.issue]};
      return {raw, statistics};
    }
    if (loaded.status === 'failed') raw = syntaxFailure ? {...loaded, loadingIssues: [syntaxFailure, ...loaded.loadingIssues]} : loaded;
    else if (syntaxFailure) raw = {status: 'failed', path, fact: loaded.fact, loadingIssues: [syntaxFailure], traceSyntaxUnavailable: true};
    else raw = {status: 'admitted-json', path, fact: loaded.fact, value: scanner.trace(), admission: scanner.statistics().completeTotals!, loadingIssues: []};
    return {raw, statistics: scanner.statistics(loaded.status === 'verified-bytes' ? 'verified' : 'unverified'), dispose: () => scanner.dispose()};
  } catch (error) {scanner.dispose(); throw error;}
}
/** Bounded physical membership only: file SHA/aggregate/reference closure follows separately. */
async function physicalInventory(root: string, slots: string[], seal: ComparisonDataset | null,
  add: (issue: ComparisonLoadingIssue) => void): Promise<ComparisonLoadedInvocationBootstrap['physicalInventory']> {
  const result: ComparisonLoadedInvocationBootstrap['physicalInventory'] = {status: 'complete', files: [], directories: [], candidates: {root: 0, slots: slots.map(path => ({path, count: 0}))}, inspectedEntries: 0, ioFailures: [], additionalIoFailureCount: 0, unknownEntries: [], additionalUnknownEntryCount: 0};
  const directories = new Set<string>(['']), declared = new Set([...(seal?.members ?? []), ...(seal?.absentMembers ?? [])].map(member => member.path)), candidates = new Set<string>();
  const requiredDirectories = new Set<string>(['']), absentPaths = new Set(seal?.absentMembers.map(member => member.path) ?? []);
  const rootNames = new Set(['invocation-claim.json', 'invocation.json', 'dataset-finalization-failure.json', 'dataset-seal.json']);
  const slotNames = new Set(['descriptor.json', 'fixture.json', 'validation.json', 'exceptions.json', 'producer.jsonl', 'page.jsonl', 'page-exceptions.jsonl', 'trace.json', 'manifest.json', 'capture-metadata.json', 'phases.json', 'checkpoints.json', 'final-runtime.json', 'visible-validation.json', 'trace-auxiliary.json', 'native-dispatch-results.json', 'capture-status.json', 'finalization-status.json', 'evidence.json', 'raw-inventory.json']);
  const parentPaths = (path: string) => {const parts = path.split('/'); return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));};
  for (const slot of slots) {directories.add(slot); requiredDirectories.add(slot); parentPaths(slot).forEach(path => {directories.add(path); requiredDirectories.add(path);});}
  const issue = (path: string, kind: 'identity' | 'membership' | 'unreadable', reason: string) => {result.status = 'partial'; add({path: path || '.', kind, role: 'unknown', reason: preview(reason)});};
  if (slots.some((path, i) => slots.some((other, j) => i !== j && (path === other || path.startsWith(other + '/'))))) {
    issue('.', 'membership', 'Declared slot prefixes overlap'); return result;
  }
  const owner = (path: string) => slots.findIndex(slot => path.startsWith(slot + '/'));
  function role(path: string): ComparisonRawRole | null {
    const original = path.replace(/\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/, ''), index = owner(path), temporary = original !== path;
    if (index < 0) return rootNames.has(original) ? temporary ? 'temporary' : original === 'dataset-seal.json' ? 'dataset-seal' : 'root-json' : null;
    const local = original.slice(slots[index]!.length + 1);
    if (slotNames.has(local)) return temporary ? 'temporary' : local === 'trace.json' ? 'trace' : local.endsWith('.jsonl') ? 'jsonl' : 'slot-json';
    if (!declared.has(path)) return null;
    if (['instrumentation/pre-navigation.js', 'instrumentation/main.js'].includes(local)) return temporary ? 'temporary' : 'installer';
    if (['provenance/acquisition.json', 'provenance/build-evidence.json', 'instrumentation/build-evidence.json'].includes(local)
      || /^provenance\/packages\/.+\/package\.json$/.test(local)) return temporary ? 'temporary' : 'slot-json';
    if (/^(?:provenance\/(?:source|assets)|instrumentation\/(?:source|compiled))\/.+/.test(local)) return temporary ? 'temporary' : 'retained-opaque';
    return null;
  }
  for (const member of [...(seal?.members ?? []), ...(seal?.absentMembers ?? [])]) {
    if (role(member.path) === null) {issue(member.path, 'membership', 'Declared raw member has no admitted exact role'); continue;}
    parentPaths(member.path).forEach(path => directories.add(path));
  }
  for (const member of seal?.members ?? []) parentPaths(member.path).forEach(path => requiredDirectories.add(path));
  function candidate(path: string) {
    if (candidates.has(path)) return; candidates.add(path);
    const index = owner(path), count = index < 0 ? ++result.candidates.root : ++result.candidates.slots[index]!.count, limit = index < 0 ? 16 : 4096;
    if (count > limit) {result.status = 'partial'; throw new MemberFailure({kind: 'admission-limit', path, role: role(path) ?? 'unknown', limitName: index < 0 ? 'rootCandidates' : 'slotCandidates', limit, observed: count, observation: 'lower-bound', reason: 'Physical candidate capacity exceeded'});}
  }
  const identities = new Map<string, string>(), originalFiles = new Map<string, BigIntStats>(), directoryFacts = new Map<string, BigIntStats>();
  const maxEntries = 2 * (147472 + directories.size + 2 + slots.length), maxReads = maxEntries + 2 * directories.size;
  let reads = 0;
  const ioFailure = (operation: (typeof result.ioFailures)[number]['operation'], path: string, error: unknown) => {
    if (result.ioFailures.length < 32) result.ioFailures.push({operation, path: path || '.', error}); else result.additionalIoFailureCount++;
  };
  async function pathStat(path: string): Promise<BigIntStats> {
    try {return await fs.lstat(join(root, path), {bigint: true});}
    catch (error) {ioFailure('path-stat', path, error); throw new MemberFailure({kind: 'unreadable', path: path || '.', role: role(path) ?? 'unknown', reason: preview(error)});}
  }
  const unknown = (entry: (typeof result.unknownEntries)[number]) => {
    if (result.unknownEntries.length < 32) result.unknownEntries.push(entry); else result.additionalUnknownEntryCount++;
  };
  async function enumerate(path: string, visit: (name: string) => Promise<void>): Promise<string[]> {
    let handle: Awaited<ReturnType<typeof fs.opendir>> | undefined, primaryPresent = false, primary: unknown; const names: string[] = [], cleanup: unknown[] = [];
    let operation: (typeof result.ioFailures)[number]['operation'] = 'directory-open';
    try {
      handle = await fs.opendir(join(root, path), {bufferSize: 1});
      for (;;) {
        if (reads === maxReads) throw new MemberFailure({kind: 'admission-limit', path: path || '.', role: 'unknown', limitName: 'directoryReadWork', limit: maxReads, observed: reads + 1, observation: 'lower-bound', reason: 'Bounded directory read work exhausted before next entry allocation'});
        reads++; operation = 'directory-read'; const entry = await handle.read(); if (entry === null) break;
        result.inspectedEntries++; if (result.inspectedEntries > maxEntries) throw new MemberFailure({kind: 'admission-limit', path: path || '.', role: 'unknown', limitName: 'directoryEntries', limit: maxEntries, observed: result.inspectedEntries, observation: 'lower-bound', reason: 'Bounded directory entry work exceeded'});
        names.push(entry.name); operation = 'path-stat'; await visit(entry.name);
      }
    } catch (error) {primaryPresent = true; primary = error; if (!isMemberFailure(error)) ioFailure(operation, path, error);}
    finally {if (handle) try {await handle.close();} catch (error) {cleanup.push(error); ioFailure('directory-close', path, error);}}
    if (primaryPresent && !isMemberFailure(primary)) issue(path, 'unreadable', preview(primary));
    for (const error of cleanup) issue(path, 'unreadable', preview(error, 'Original directory close failed: '));
    if (primaryPresent && isMemberFailure(primary)) throw primary;
    return names.sort();
  }
  const memberships = new Map<string, string[]>(), queue = [''];
  try {
    for (const absent of seal?.absentMembers ?? []) if (role(absent.path) !== null) candidate(absent.path);
    for (let index = 0; index < queue.length; index++) {
      const path = queue[index]!, before = await pathStat(path);
      if (before.isSymbolicLink() || !before.isDirectory()) {issue(path, 'identity', 'Admitted directory is not an original regular directory'); continue;}
      directoryFacts.set(path, before); if (path) result.directories.push(path);
      memberships.set(path, await enumerate(path, async name => {
        const relative = path ? path + '/' + name : name;
        if (!normalizedMember(relative)) {issue('.', 'membership', 'Physical entry path is not normalized'); return;}
        const admittedRole = role(relative), derived = relative === 'comparison-results.json' || relative === 'comparison-summary.md' || slots.some(slot => relative === slot + '/results.json');
        if (admittedRole === null && !derived && !directories.has(relative)) {
          issue(relative, 'membership', 'Unknown physical member or directory; payload not read');
          let stat: BigIntStats; try {stat = await pathStat(relative);} catch (error) {
            unknown({path: relative, type: 'unavailable', byteLength: null, reason: isMemberFailure(error) ? error.issue.reason : preview(error)}); throw error;
          }
          const type = stat.isSymbolicLink() ? 'symlink' : stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other';
          unknown({path: relative, type, byteLength: type === 'file' && stat.size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(stat.size) : null,
            ...(type === 'file' && stat.size > BigInt(Number.MAX_SAFE_INTEGER) ? {reason: 'Unknown original file size exceeds safe integer representation'} : {})}); return;
        }
        if (admittedRole !== null) candidate(relative);
        const stat = await pathStat(relative);
        if (admittedRole !== null || derived) {
          if (stat.isSymbolicLink() || !stat.isFile()) {issue(relative, 'identity', 'Admitted leaf is not an original regular file'); return;}
          const key = `${stat.dev}:${stat.ino}`, previous = identities.get(key);
          if (previous !== undefined && previous !== relative) {issue(relative, 'identity', 'Distinct physical paths have a hardlink alias'); return;} identities.set(key, relative);
          originalFiles.set(relative, stat);
          if (!derived) {
            if (absentPaths.has(relative)) issue(relative, 'membership', 'Explicitly absent raw candidate is physically present');
            const limit = ROLE_BYTE_LIMITS[admittedRole as Exclude<ComparisonRawRole, 'unknown'>];
            if (stat.size > BigInt(limit)) {result.status = 'partial'; add({kind: 'admission-limit', path: relative, role: admittedRole!, limitName: 'roleBytes', limit,
              observed: stat.size <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(stat.size) : limit + 1, observation: stat.size <= BigInt(Number.MAX_SAFE_INTEGER) ? 'exact' : 'lower-bound', reason: 'Observed physical member exceeds its fixed role-byte limit'});}
            else result.files.push({path: relative, role: admittedRole!, byteLength: Number(stat.size), dev: String(stat.dev), ino: String(stat.ino), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs)});
          }
        } else if (stat.isSymbolicLink() || !stat.isDirectory()) issue(relative, 'identity', 'Admitted directory is not an original regular directory');
        else queue.push(relative);
      }));
    }
    for (const path of requiredDirectories) if (!directoryFacts.has(path)) issue(path, 'membership', 'Required admitted directory is physically absent');
    for (const [path, before] of directoryFacts) {
      const after = await pathStat(path);
      if (after.isSymbolicLink() || !after.isDirectory() || before.dev !== after.dev || before.ino !== after.ino) {issue(path, 'identity', 'Owned directory identity changed'); continue;}
      const names = await enumerate(path, async () => {}), original = memberships.get(path)!;
      const closed = await pathStat(path);
      if (closed.isSymbolicLink() || !closed.isDirectory() || before.dev !== closed.dev || before.ino !== closed.ino)
        issue(path, 'identity', 'Owned directory identity changed during final enumeration');
      if (names.length !== original.length || names.some((name, index) => name !== original[index])) issue(path, 'identity', 'Owned directory membership changed');
    }
    for (const [path, before] of originalFiles) {
      const after = await pathStat(path);
      if (after.isSymbolicLink() || !after.isFile() || !identity(before, after)) issue(path, 'identity', 'Original regular file identity changed during physical inspection');
    }
  } catch (error) {result.status = 'partial'; if (isMemberFailure(error)) add(error.issue); else issue('.', 'unreadable', preview(error));}
  result.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); result.directories.sort(); return result;
}
/** Closed-family bootstrap and owned byte closure; semantic reference closure remains partial. */
export async function loadComparisonInvocation(root: string, options: ComparisonTraceLoadOptions = {}): Promise<ComparisonLoadedInvocationBootstrap> {
  const tracePolicy = selectComparisonTracePolicy(options);
  const issues = issueList();
  const owner = new InvocationBytes();
  const add = (path: string, reason: string, kind: ComparisonLoadingIssue['kind'] = 'malformed', role: ComparisonRawRole = 'root-json') => {
    if (kind === 'admission-limit') throw new Error('Admission failures require their complete named fields');
    const issue: ComparisonLoadingIssue = {kind, path, role, reason: preview(reason)}; issues.add(issue); return issue;
  };
  const unparsed = <T>(path: string): ComparisonLoadedDocument<T> => ({value: null, fact: null,
    availability: {status: 'unreadable', path, reason: 'Document not admitted by root bootstrap'}});
  const ledgerRaw = await measuredJson(root, 'invocation.json', 'root-json', owner);
  const claimRaw = await measuredJson(root, 'invocation-claim.json', 'root-json', owner);
  const result: ComparisonLoadedInvocationBootstrap = {...(tracePolicy === undefined ? {} : {tracePolicy}), family: null, root: {claim: unparsed('invocation-claim.json'), ledger: unparsed('invocation.json'), seal: unparsed('dataset-seal.json')},
    scheduled: null, runs: [], byteIntegrity: {status: 'not-inspected', admission: 'unavailable', observedUniqueBytes: 0, files: [], seal: 'not-verified', ioFailures: owner.ioFailures, additionalIoFailureCount: 0}, collection: {status: 'unavailable', reasons: ['Slot inventory and acquisition reference schema agreement not yet verified'], onDiskConsistencyOnly: true},
    loadingIssues: issues.loadingIssues, additionalLoadingIssueCount: 0,
    physicalInventory: {status: 'not-inspected', files: [], directories: [], candidates: {root: 0, slots: []}, inspectedEntries: 0, ioFailures: [], additionalIoFailureCount: 0, unknownEntries: [], additionalUnknownEntryCount: 0}};
  function finishResult() {
    result.additionalLoadingIssueCount = issues.count();
    result.byteIntegrity.observedUniqueBytes = owner.observedUniqueBytes;
    result.byteIntegrity.files = [...owner.originals].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, value]) => ({path, fact: value.fact}));
    result.byteIntegrity.additionalIoFailureCount = owner.additionalIoFailureCount;
    return result;
  }
  result.root.ledger.fact = ledgerRaw.fact; result.root.claim.fact = claimRaw.fact;
  function document<T>(raw: LoadedComparisonJson, schema: z.ZodType<T>, role: ComparisonRawRole): ComparisonLoadedDocument<T> {
    if (raw.status === 'failed') {
      raw.loadingIssues.forEach(issue => issues.add(issue)); const first = raw.loadingIssues[0];
      return {value: null, fact: raw.fact, availability: {status: first?.kind === 'absent' ? 'absent' : first?.kind === 'malformed' ? 'malformed' : 'unreadable',
        path: raw.path, reason: first?.reason ?? 'Original document unavailable'}};
    }
    const parsed = schema.safeParse(raw.value);
    if (!parsed.success) {const issue = add(raw.path, 'Strict raw schema rejected: ' + preview(parsed.error.issues[0]?.message ?? 'Invalid raw document'), 'malformed', role);
      return {value: null, fact: raw.fact, availability: {status: 'malformed', path: raw.path, reason: issue.reason}};}
    return {value: parsed.data, fact: raw.fact, availability: {status: 'parsed', path: raw.path}};
  }
  let schemas: ComparisonSchemas | null = null, explicitPair: ComparisonSchemaPair | null = null, contradiction = false;
  for (const rootRaw of [ledgerRaw, claimRaw]) {
    if (rootRaw.status !== 'admitted-json') continue;
    const value = rootRaw.value;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const header = value as Record<string, unknown>;
    const collector = header['collectorVersion'], analyzer = header['analyzerVersion'];
    if (typeof collector !== 'string' || typeof analyzer !== 'string') continue;
    const pair: ComparisonSchemaPair | null = collector === '2.0.0' && analyzer === '2.0.0'
      ? {collectorVersion: '2.0.0', analyzerVersion: '2.0.0'}
      : collector === '2.1.0' && analyzer === '2.1.0' ? {collectorVersion: '2.1.0', analyzerVersion: '2.1.0'} : null;
    // Scan both roots before dependent reads; a later contradiction cannot hide
    // behind an earlier valid ledger or select a different parser as a fallback.
    if (pair === null) {
      const issue = add(rootRaw.path, 'Unsupported comparison root version pair or suite');
      const rejected = rootRaw.path === 'invocation.json' ? result.root.ledger : result.root.claim;
      rejected.availability = {status: 'malformed', path: rootRaw.path, reason: issue.reason};
      contradiction = true; continue;
    }
    if (explicitPair !== null && explicitPair.collectorVersion !== pair.collectorVersion) {
      add(rootRaw.path, 'Comparison root version pairs contradict the selected family'); contradiction = true;
    }
    explicitPair ??= pair;
    if (schemas === null) {
      const candidate = comparisonSchemasForVersionPair(pair), shape = candidate.comparisonVersionShape;
      if (z.strictObject(shape).safeParse(Object.fromEntries(Object.keys(shape).map(key => [key, header[key]]))).success) {
        schemas = candidate; result.family = pair;
      }
    }
  }
  if (schemas === null) {
    for (const raw of [ledgerRaw, claimRaw]) if (raw.status === 'failed') raw.loadingIssues.forEach(issue => issues.add(issue));
    return finishResult();
  }
  result.root.ledger = document<ComparisonInvocation>(ledgerRaw, schemas.comparisonCaptureInvocationSchema, 'root-json');
  result.root.claim = document<Claim>(claimRaw, schemas.comparisonDatasetInventorySchema.shape.invocationClaim, 'root-json');
  if (contradiction) {result.family = null; return finishResult();}
  result.root.seal = document<ComparisonDataset>(await measuredJson(root, 'dataset-seal.json', 'dataset-seal', owner), schemas.comparisonDatasetInventorySchema, 'dataset-seal');
  const ledger = result.root.ledger.value, claim = result.root.claim.value;
  if (ledger && claim && (ledger.createdAt !== claim.createdAt || ledger.purpose !== claim.purpose
    || JSON.stringify(ledger.configuration) !== JSON.stringify(claim.configuration))) add('invocation-claim.json', 'Actual claim differs from ledger configuration, purpose or creation time', 'identity');
  if (ledger) {
    const config = ledger.configuration;
    if (config.rounds > 3 || config.adapterProfiles.length !== 1 || config.adapterProfiles[0] !== 'threadplane-langgraph-custom-transport'
      || config.mode === 'headed' && (config.rounds !== 3 || ledger.purpose !== 'publication')
      || config.mode === 'headless' && ledger.purpose !== 'conformance') add('invocation.json', 'Unsupported bounded invocation configuration');
    else {
      result.scheduled = ledger.runs.length; result.collection.status = 'partial';
      result.physicalInventory = await physicalInventory(root, ledger.runs.map(row => row.artifactDirectory), result.root.seal.value, issue => issues.add(issue));
      result.byteIntegrity.status = 'partial';
      let prefixBytes = 0, metadataComplete = result.physicalInventory.status === 'complete';
      for (const file of result.physicalInventory.status === 'complete' ? result.physicalInventory.files : []) {
        const metadata = await readCheckedMember(root, {path: file.path, role: file.role}, undefined, undefined, 'measured-bootstrap', owner.metadataScope());
        owner.retain(metadata);
        if (metadata.status !== 'verified-metadata') {metadata.loadingIssues.forEach(issue => issues.add(issue)); metadataComplete = false;}
        const observed = owner.originals.get(file.path)?.stat;
        if (!observed) continue;
        if (observed.dev.toString() !== file.dev || observed.ino.toString() !== file.ino || observed.size !== BigInt(file.byteLength)
          || observed.mtimeNs.toString() !== file.mtimeNs || observed.ctimeNs.toString() !== file.ctimeNs) {
          add(file.path, 'Owned descriptor differs from physical inventory original', 'identity', file.role); metadataComplete = false;
        }
        const observedBytes = Number(observed.size);
        if (observedBytes > INVOCATION_BYTE_LIMIT - prefixBytes) {
          result.byteIntegrity.admission = 'exceeded';
          issues.add({kind: 'admission-limit', path: file.path, role: file.role, limitName: 'invocationUniqueBytes', limit: INVOCATION_BYTE_LIMIT,
            observed: prefixBytes + observedBytes, observation: 'lower-bound', reason: 'Canonical original member prefix exceeds invocation byte admission limit'});
          break;
        }
        prefixBytes += observedBytes;
      }
      if (result.byteIntegrity.admission !== 'exceeded') result.byteIntegrity.admission = metadataComplete ? 'within-limit' : 'unavailable';
      owner.enforceLimit = result.byteIntegrity.admission === 'within-limit';
      owner.exceeded = result.byteIntegrity.admission === 'exceeded';
      if (ledger.status === 'pending' || ledger.runs.some(row => row.status === 'scheduled' || row.status === 'running')) add('invocation.json', 'Invocation ledger is not terminal');
      for (const row of ledger.runs) {
        const rowIssues = issueList(), identity = schemas.comparisonIdentitySchema.parse({
          schemaVersion: ledger.schemaVersion, suite: ledger.suite, suiteVersion: ledger.suiteVersion, collectorVersion: ledger.collectorVersion, analyzerVersion: ledger.analyzerVersion,
          repetition: row.repetition, scenarioId: row.scenarioId, round: row.round, caseIndex: row.caseIndex, adapterProfile: row.adapterProfile});
        async function slotDocument<T>(name: string, schema: z.ZodType<T>): Promise<ComparisonLoadedDocument<T>> {
          const path = row.artifactDirectory + '/' + name;
          if (name === 'manifest.json' && result.byteIntegrity.admission !== 'within-limit') return {value: null, fact: null,
            availability: {status: 'unreadable', path, reason: 'Non-diagnostic member not admitted after invocation preflight failure'}};
          const raw = await measuredJson(root, path, 'slot-json', owner, name !== 'manifest.json');
          if (owner.exceeded) result.byteIntegrity.admission = 'exceeded';
          const doc = document(raw, schema, 'slot-json');
          // Row diagnostics are the independently observed errors from this exact member, not a root-list slice.
          if (raw.status === 'failed') raw.loadingIssues.forEach(issue => rowIssues.add(issue));
          else if (doc.value === null) rowIssues.add({kind: 'malformed', path, role: 'slot-json', reason: 'Strict raw schema rejected'});
          if (doc.value !== null) {
            const original = doc.value as Record<string, unknown>;
            if (Object.entries(identity).some(([key, value]) => (name === 'manifest.json' && key === 'adapterProfile'
              ? (doc.value as ComparisonManifest).adapter.profile : original[key]) !== value)
              || name === 'descriptor.json' && (original['artifactDirectory'] !== row.artifactDirectory || original['seed'] !== config.seed || original['mode'] !== config.mode)) {
              const issue = add(path, 'Raw member identity differs from actual ledger row', 'identity', 'slot-json'); rowIssues.add(issue);
              doc.value = null; doc.availability = {status: 'unreadable', path, reason: issue.reason};
            }
          }
          return doc;
        }
        const descriptor = await slotDocument<ComparisonScheduledRun>('descriptor.json', schemas.comparisonScheduledRunSchema), manifest = await slotDocument<ComparisonManifest>('manifest.json', schemas.comparisonManifestSchema),
          validation = await slotDocument<ComparisonValidation>('validation.json', schemas.comparisonValidationSchema);
        // Exceptions are baseline diagnostic evidence; their absence cannot be hidden by a failed-not-started label.
        await slotDocument<ComparisonExceptions>('exceptions.json', schemas.comparisonExceptionsSchema);
        result.runs.push({... (tracePolicy === undefined ? {} : {traceAdmission: notStartedTraceAdmission()}), identity, artifactDirectory: row.artifactDirectory, descriptor: descriptor.value, manifest: manifest.value, captureValidation: validation.value,
          rawAvailability: {descriptor: descriptor.availability, manifest: manifest.availability, captureValidation: validation.availability},
          loadingIssues: rowIssues.loadingIssues, additionalLoadingIssueCount: rowIssues.count(), references: unavailableComparisonReferences('Slot references not admitted by invocation preflight'), provenanceGraph: unavailableComparisonProvenanceGraph('Captured provenance graph not yet checked'), finalContent: unavailableComparisonFinalContent('Final content not admitted by invocation preflight'), rendererPresentationCapabilityDiagnostic: unavailableComparisonRendererDiagnostic('Renderer diagnostics not admitted by invocation preflight'), counterCheckpoints: unavailableCounterCheckpoints(row.artifactDirectory + '/checkpoints.json')});
      }
      if (result.byteIntegrity.admission === 'within-limit') {
        let hashComplete = owner.failedOwnedReads.size === 0;
        const seal = result.root.seal.value, expected = new Map(seal?.members.map(member => [member.path, member]) ?? []);
        for (const file of result.physicalInventory.files) {
          const declared = expected.get(file.path);
          const loaded = await readCheckedMember(root, declared ? {path: file.path, role: file.role, expected: declared}
            : {path: file.path, role: file.role}, undefined, undefined, 'measured-bootstrap', owner.scope());
          try {owner.retain(loaded);} catch (error) {
            if (!isMemberFailure(error)) throw error;
            issues.add(error.issue); hashComplete = false;
          }
          if (loaded.status === 'failed') {hashComplete = false; loaded.loadingIssues.forEach(issue => issues.add(issue));}
        }
        for (const [index, run] of result.runs.entries()) {
          const prefix = run.artifactDirectory + '/', localFiles = result.physicalInventory.files.filter(file => file.path.startsWith(prefix));
          const files: ComparisonReferenceInput['files'] = new Map(localFiles.map(file => [file.path.slice(prefix.length), {actual: owner.originals.get(file.path)?.fact ?? null, seal: expected.get(file.path) ?? null, role: file.role}]));
          const absent = (seal?.absentMembers ?? []).filter(member => member.path.startsWith(prefix)).map(member => ({path: member.path.slice(prefix.length), reason: member.reason}));
          async function referenceDocument<T>(name: string, schema: z.ZodType<T>): Promise<ComparisonLoadedDocument<T> & {referenceIssue?: ComparisonLoadingIssue}> {
            if (!files.has(name)) return {value: null, fact: null, availability: {status: 'absent', path: prefix + name, reason: 'Required reference document is not an admitted original member'}};
            const raw = await measuredJson(root, prefix + name, 'slot-json', owner);
            if (raw.status === 'failed') hashComplete = false;
            if (name === 'checkpoints.json' && raw.status === 'admitted-json' && raw.value !== null && typeof raw.value === 'object') {
              const counters = (raw.value as Record<string, unknown>)['counters'];
              if (Array.isArray(counters) && counters.length > 3) {
                const reason = 'Counter checkpoints exceed the three ordered lifecycle snapshots';
                const referenceIssue: ComparisonLoadingIssue = {kind: 'admission-limit', path: prefix + name, role: 'slot-json', limitName: 'counterSnapshots', limit: 3, observed: counters.length, observation: 'exact', reason};
                issues.add(referenceIssue);
                return {value: null, fact: raw.fact, availability: {status: 'malformed', path: prefix + name, reason}, referenceIssue};
              }
            }
            if ((name === 'evidence.json' || name === 'raw-inventory.json') && raw.status === 'admitted-json' && raw.value !== null && typeof raw.value === 'object') {
              const declared = (raw.value as Record<string, unknown>)['files'], unavailable = (raw.value as Record<string, unknown>)['unavailableFiles'];
              const referenceCount = (Array.isArray(declared) ? declared.length : 0) + (Array.isArray(unavailable) ? unavailable.length : 0);
              if (referenceCount > 4096) {
                const reason = 'Inventory references exceed existing slot candidate capacity';
                issues.add({kind: 'admission-limit', path: prefix + name, role: 'slot-json', limitName: 'slotCandidates', limit: 4096, observed: referenceCount, observation: 'exact', reason});
                return {value: null, fact: raw.fact, availability: {status: 'malformed', path: prefix + name, reason}};
              }
            }
            const doc = document(raw, schema, 'slot-json');
            if (doc.value !== null && Object.entries(run.identity).some(([key, value]) => (doc.value as Record<string, unknown>)[key] !== value)) {
              const failure = add(prefix + name, 'Reference document identity differs from original ledger row', 'identity', 'slot-json');
              doc.value = null; doc.availability = {status: 'unreadable', path: prefix + name, reason: failure.reason};
              return {...doc, referenceIssue: failure};
            }
            if (raw.status === 'failed' && raw.loadingIssues[0]) return {...doc, referenceIssue: raw.loadingIssues[0]};
            return doc;
          }
          const checkpoints = await referenceDocument<z.output<ComparisonSchemas['comparisonCheckpointsSchema']>>('checkpoints.json', schemas.comparisonCheckpointsSchema);
          const counterFact = files.get('checkpoints.json');
          const countersClosed = counterFact?.role === 'slot-json' && counterFact.actual !== null && counterFact.seal !== null && checkpoints.fact !== null
            && counterFact.actual.byteLength === counterFact.seal.byteLength && counterFact.actual.sha256 === counterFact.seal.sha256
            && checkpoints.fact.byteLength === counterFact.actual.byteLength && checkpoints.fact.sha256 === counterFact.actual.sha256;
          run.counterCheckpoints = {status: checkpoints.value !== null && countersClosed ? 'verified-original' : 'unavailable', originalFileFact: checkpoints.fact,
            rawAvailability: checkpoints.availability, reason: checkpoints.value === null ? checkpoints.availability.status === 'parsed' ? 'Strict counter checkpoint schema rejected' : checkpoints.availability.reason : countersClosed ? null : 'Counter checkpoint original and seal facts do not agree',
            recordedSnapshotCount: checkpoints.value !== null && countersClosed ? checkpoints.value.counters.length : null, snapshots: checkpoints.value !== null && countersClosed ? checkpoints.value.counters : []};
          if (run.counterCheckpoints.status === 'unavailable') {
            const failure = checkpoints.referenceIssue ?? {kind: checkpoints.availability.status === 'absent' ? 'absent' : checkpoints.availability.status === 'malformed' ? 'malformed' : 'integrity', path: prefix + 'checkpoints.json', role: 'slot-json', reason: run.counterCheckpoints.reason!} satisfies ComparisonLoadingIssue;
            if (run.loadingIssues.length < 32) run.loadingIssues.push(failure); else run.additionalLoadingIssueCount++;
          }
          const names = (['evidence.json', 'raw-inventory.json'] as const).filter(name => files.has(name));
          const inventory = names.length === 1 ? names[0] === 'evidence.json'
            ? await referenceDocument<z.output<ComparisonSchemas['comparisonEvidenceSchema']>>(names[0], schemas.comparisonEvidenceSchema)
            : await referenceDocument<z.output<ComparisonSchemas['comparisonRawInventorySchema']>>(names[0]!, schemas.comparisonRawInventorySchema) : null;
          const capture = await referenceDocument<ComparisonReferenceInput['capture']>('capture-status.json', schemas.comparisonCaptureStatusSchema);
          const acquisition = await referenceDocument<ComparisonReferenceInput['acquisition']>('provenance/acquisition.json', schemas.comparisonProvenanceAcquisitionSchema);
          run.references = checkComparisonReferences({inventory: inventory?.value && names[0] ? {path: names[0], value: inventory.value} : null,
            capture: capture.value, acquisition: acquisition.value, validation: run.captureValidation, row: ledger.runs[index]!, files, absent});
          if (names.length > 1) {
            run.references.inventory.status = 'partial'; run.references.inventory.issues[0] = {kind: 'membership', path: '.', role: 'slot-json', reason: 'Multiple original slot inventories are retained'};
          }
          for (const [key, doc] of [['inventory', inventory], ['capture', capture], ['acquisition', acquisition]] as const) {
            if (doc?.value === null && doc.availability.status !== 'absent' && doc.availability.status !== 'parsed') {
              const lane = run.references[key]; lane.status = 'partial'; lane.issues[0] = doc.referenceIssue
                ? {...doc.referenceIssue, path: doc.referenceIssue.path.slice(prefix.length)}
                : {kind: doc.availability.status, path: doc.availability.path.slice(prefix.length), role: 'slot-json', reason: doc.availability.reason};
            }
          }
          async function graphOriginal(name: string): Promise<LoadedComparisonJson | null> {
            if (!files.has(name)) return null;
            const raw = await measuredJson(root, prefix + name, 'slot-json', owner);
            if (raw.status === 'failed') hashComplete = false;
            return raw;
          }
          const productRaw = await graphOriginal('provenance/build-evidence.json'), probeRaw = await graphOriginal('instrumentation/build-evidence.json');
          const admission = provenanceGraphAdmission(productRaw?.status === 'admitted-json' ? productRaw.value : null, probeRaw?.status === 'admitted-json' ? probeRaw.value : null);
          if (admission) {
            issues.add({...admission, path: prefix + admission.path});
            run.provenanceGraph = unavailableComparisonProvenanceGraph(admission.reason);
            run.provenanceGraph.status = 'partial'; run.provenanceGraph.issues[0] = admission;
          } else {
            const product = productRaw === null ? null : document<ProductDeclaration>(productRaw, schemas.adapterBuildSchema, 'slot-json');
            const probe = probeRaw === null ? null : document<ProbeDeclaration>(probeRaw, schemas.comparisonInstrumentationBuildSchema, 'slot-json');
            const metadata = new Map<string, PackageMetadata | null>(), metadataFailures: ComparisonLoadingIssue[] = [];
            const metadataWitnesses = provenanceMetadataCopiedWitnesses(acquisition.value, files);
            if (product?.value && probe?.value) for (const name of provenanceMetadataPaths(product.value, probe.value)) {
              if (!metadataWitnesses.has(name)) {metadata.set(name, null); continue;}
              const raw = await graphOriginal(name), doc = raw === null ? null : document<PackageMetadata>(raw, comparisonPackageMetadataSchema, 'slot-json');
              metadata.set(name, doc?.value ?? null);
              if (doc?.value === null) metadataFailures.push(raw?.status === 'failed' && raw.loadingIssues[0]
                ? {...raw.loadingIssues[0], path: raw.loadingIssues[0].path.slice(prefix.length)}
                : {kind: doc.availability.status === 'malformed' ? 'malformed' : 'unreadable', path: name, role: 'slot-json', reason: 'Original package metadata unavailable: ' + (doc.availability.status === 'parsed' ? '' : doc.availability.reason)});
            }
            run.provenanceGraph = checkComparisonProvenanceGraph({product: product?.value ?? null, probe: probe?.value ?? null, acquisition: acquisition.value,
              manifest: run.manifest, files, metadata});
            const replaceGraphIssue = (failure: ComparisonLoadingIssue) => {
              const index = run.provenanceGraph.issues.findIndex(issue => issue.path === failure.path);
              if (index >= 0) run.provenanceGraph.issues[index] = failure;
              else if (run.provenanceGraph.issues.length < 32) run.provenanceGraph.issues.push(failure);
              else run.provenanceGraph.additionalIssueCount++;
            };
            for (const [name, raw, doc] of [['provenance/build-evidence.json', productRaw, product], ['instrumentation/build-evidence.json', probeRaw, probe]] as const) if (doc?.value === null) {
              run.provenanceGraph.status = 'partial'; replaceGraphIssue(raw?.status === 'failed' && raw.loadingIssues[0]
                ? {...raw.loadingIssues[0], path: raw.loadingIssues[0].path.slice(prefix.length)}
                : {kind: doc.availability.status === 'malformed' ? 'malformed' : 'unreadable', path: name, role: 'slot-json', reason: doc.availability.status === 'parsed' ? 'Original build declaration unavailable' : doc.availability.reason});
            }
            if (acquisition.value === null && acquisition.availability.status !== 'absent' && acquisition.availability.status !== 'parsed') {
              run.provenanceGraph.status = 'partial'; replaceGraphIssue(acquisition.referenceIssue
                ? {...acquisition.referenceIssue, path: acquisition.referenceIssue.path.slice(prefix.length)}
                : {kind: acquisition.availability.status, path: 'provenance/acquisition.json', role: 'slot-json', reason: acquisition.availability.reason});
            }
            for (const failure of metadataFailures) {
              if (run.provenanceGraph.status === 'complete') run.provenanceGraph.status = 'partial';
              if (run.provenanceGraph.issues.length < 32) run.provenanceGraph.issues.push(failure); else run.provenanceGraph.additionalIssueCount++;
            }
          }
          const fixtureRaw = await graphOriginal('fixture.json'), runtimeRaw = await graphOriginal('final-runtime.json'), visibleRaw = await graphOriginal('visible-validation.json');
          const contentBounds = finalContentCardinalityIssues(fixtureRaw?.status === 'admitted-json' ? fixtureRaw.value : null, runtimeRaw?.status === 'admitted-json' ? runtimeRaw.value : null, visibleRaw?.status === 'admitted-json' ? visibleRaw.value : null, run.manifest);
          const fixture = fixtureRaw === null || !run.manifest || contentBounds.has('fixture') ? null : document<LongThreadFixture>(fixtureRaw, longThreadFixtureSchema, 'slot-json');
          const runtime = runtimeRaw === null || !run.manifest || contentBounds.has('runtime') ? null : document<FinalRuntime>(runtimeRaw, schemas.comparisonFinalRuntimeSchema, 'slot-json');
          const visible = visibleRaw === null || !run.manifest || contentBounds.has('coverage') ? null : document<FinalVisible>(visibleRaw, schemas.comparisonVisibleValidationSchema, 'slot-json');
          const contentIdentityFailures = new Map<'runtime' | 'coverage', ComparisonLoadingIssue>();
          for (const [key, name, doc] of [['runtime', 'final-runtime.json', runtime], ['coverage', 'visible-validation.json', visible]] as const) if (doc?.value && Object.entries(run.identity).some(([key, value]) => Reflect.get(doc.value!, key) !== value)) {
            contentIdentityFailures.set(key, {kind: 'identity', path: name, role: 'slot-json', reason: 'Final content identity differs from original invocation row'});
            doc.value = null; doc.availability = {status: 'unreadable', path: doc.availability.path, reason: 'Final content identity differs from original invocation row'};
          }
          run.finalContent = checkComparisonFinalContent({fixture: fixture?.value ?? null, runtime: runtime?.value ?? null, visible: visible?.value ?? null,
            manifest: run.manifest, row: ledger.runs[index]!, seed: ledger.configuration.seed, caseOrder: ledger.configuration.caseOrder, files, absent});
          for (const [key, failure] of contentBounds) replaceFinalContentIssue(run.finalContent[key], failure);
          for (const [key, name, raw, doc] of [['fixture', 'fixture.json', fixtureRaw, fixture], ['runtime', 'final-runtime.json', runtimeRaw, runtime], ['coverage', 'visible-validation.json', visibleRaw, visible]] as const) if (raw?.status === 'failed' || doc?.value === null) {
            const identityFailure = key === 'fixture' ? undefined : contentIdentityFailures.get(key);
            replaceFinalContentIssue(run.finalContent[key], identityFailure ?? (raw?.status === 'failed' && raw.loadingIssues[0]
              ? {...raw.loadingIssues[0], path: raw.loadingIssues[0].path.slice(prefix.length)}
              : {kind: doc?.availability.status === 'malformed' ? 'malformed' : 'unreadable', path: name, role: 'slot-json', reason: doc?.availability.status === 'parsed' ? 'Original final content unavailable' : doc?.availability.reason ?? 'Owned original final content read unavailable'}));
          }
          const phasesRaw = await graphOriginal('phases.json'), auxiliaryRaw = await graphOriginal('trace-auxiliary.json'), metadataRaw = await graphOriginal('capture-metadata.json');
          const streamed = files.has('trace.json') && tracePolicy !== undefined ? await measuredStreamedTrace(root, prefix + 'trace.json', owner) : null;
          const traceRaw = streamed?.raw ?? (files.has('trace.json') ? await measuredJson(root, prefix + 'trace.json', 'trace', owner) : null);
          if (streamed) run.traceAdmission = streamed.statistics;
          try {
          if (traceRaw?.status === 'failed' && !traceRaw.traceSyntaxUnavailable) hashComplete = false;
          const original = (raw: LoadedComparisonJson | null) => raw?.status === 'admitted-json' ? raw.value : null;
          run.rendererPresentationCapabilityDiagnostic = checkComparisonRendererDiagnostic({schemas, identity: run.identity, manifest: run.manifest, descriptor: run.descriptor, originals: files, ...(tracePolicy === undefined ? {} : {tracePolicy}),
            trace: original(traceRaw), phases: original(phasesRaw), auxiliary: original(auxiliaryRaw), metadata: original(metadataRaw),
            evidence: names[0] === 'evidence.json' ? inventory?.value : null, capture: capture.value});
          for (const raw of [traceRaw, phasesRaw, auxiliaryRaw, metadataRaw]) if (raw?.status === 'failed') for (const issue of raw.loadingIssues) {
            const diagnostic = run.rendererPresentationCapabilityDiagnostic;
            if (diagnostic.issues.length < 32) diagnostic.issues.push({...issue, path: issue.path.slice(prefix.length)}); else diagnostic.additionalIssueCount++;
          }
          } finally {streamed?.dispose?.();}
        }
        if (owner.failedOwnedReads.size > 0) hashComplete = false;
        let absencesClosed = true;
        for (const member of seal?.absentMembers ?? []) {
          const issue = await checkDeclaredAbsence(root, member.path, owner);
          if (issue) {issues.add(issue); absencesClosed = false;}
        }
        const finalPhysical = await physicalInventory(root, ledger.runs.map(row => row.artifactDirectory), seal, issue => issues.add(issue));
        for (const failure of finalPhysical.ioFailures) {
          if (result.physicalInventory.ioFailures.length < 32) result.physicalInventory.ioFailures.push(failure);
          else result.physicalInventory.additionalIoFailureCount++;
        }
        result.physicalInventory.additionalIoFailureCount += finalPhysical.additionalIoFailureCount;
        for (const entry of finalPhysical.unknownEntries) {
          if (result.physicalInventory.unknownEntries.length < 32) result.physicalInventory.unknownEntries.push(entry);
          else result.physicalInventory.additionalUnknownEntryCount++;
        }
        result.physicalInventory.additionalUnknownEntryCount += finalPhysical.additionalUnknownEntryCount;
        result.physicalInventory.inspectedEntries += finalPhysical.inspectedEntries;
        if (finalPhysical.status !== 'complete' || JSON.stringify(finalPhysical.files) !== JSON.stringify(result.physicalInventory.files)
          || JSON.stringify(finalPhysical.directories) !== JSON.stringify(result.physicalInventory.directories)) {
          add('.', 'Physical originals or directory membership changed across byte integrity reads', 'identity'); hashComplete = false;
          result.physicalInventory.status = 'partial';
        }
        result.byteIntegrity.status = hashComplete ? 'complete' : 'partial';
        result.byteIntegrity.seal = 'partial';
        if (seal) {
          const actualPaths = result.physicalInventory.files.filter(file => file.path !== 'dataset-seal.json').map(file => file.path);
          const actualSet = new Set(actualPaths);
          const declaredPaths = [...expected.keys()].sort(); let closure = hashComplete && absencesClosed;
          for (const path of actualPaths) if (!expected.has(path)) {add(path, 'Physical raw member is not declared by dataset seal', 'membership'); closure = false;}
          for (const path of declaredPaths) if (!actualSet.has(path)) {add(path, 'Declared seal member is physically absent', 'membership'); closure = false;}
          if (JSON.stringify(seal.directories) !== JSON.stringify(result.physicalInventory.directories.filter(path => path !== '.').sort())) {
            add('dataset-seal.json', 'Seal directories differ from actual closed physical inventory', 'membership', 'dataset-seal'); closure = false;
          }
          if (seal.status !== 'sealed' || !seal.ownershipSettled || !seal.finalizationSucceeded
            || JSON.stringify(seal.invocationLedger) !== JSON.stringify(ledger) || claim === null
            || JSON.stringify(seal.invocationClaim) !== JSON.stringify(claim) || seal.invocationId !== claim.invocationId
            || JSON.stringify(seal.configuration) !== JSON.stringify(ledger.configuration)
            || actualPaths.some(path => path === 'dataset-finalization-failure.json' || path.startsWith('dataset-seal.json.'))) {
            add('dataset-seal.json', 'Seal publication or embedded original identity is not closed', 'integrity', 'dataset-seal'); closure = false;
          }
          if (closure) result.byteIntegrity.seal = 'byte-closed';
        }
        if (result.byteIntegrity.seal !== 'byte-closed') for (const run of result.runs) {revokeComparisonReferences(run.references); revokeComparisonProvenanceGraph(run.provenanceGraph); revokeComparisonFinalContent(run.finalContent); revokeComparisonRendererDiagnostic(run.rendererPresentationCapabilityDiagnostic);
          if (run.traceAdmission) run.traceAdmission.physicalClosure = 'unverified';
          run.counterCheckpoints.status = 'unavailable'; run.counterCheckpoints.recordedSnapshotCount = null; run.counterCheckpoints.snapshots = []; run.counterCheckpoints.reason = 'Final original byte and ownership closure not verified';}
        const referencesComplete = result.runs.every(run => Object.values(run.references).every(lane => lane.status === 'complete'));
        result.collection.reasons = [...(referencesComplete ? [] : ['Slot inventory and acquisition reference schema agreement not yet verified']),
          ...(result.runs.every(run => run.provenanceGraph.status === 'complete') ? [] : ['Captured provenance declaration graph not yet verified']),
          ...(result.runs.every(run => Object.values(run.finalContent).every(lane => lane.status === 'complete')) ? [] : ['Independent final transcript and persisted coverage agreement not yet verified']),
          'Build/source authenticity and executed graph, replay delivery/application/EOF, phase/native/geometry semantics, renderer presentation, independent correctness and scoring eligibility not yet verified'];
      }
    }
  }
  return finishResult();
}
