import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { OWNED_PAINT_V12_POLICY, OWNED_PAINT_V12_AUTHORITY, OWNED_PAINT_V12_METRICS,
  createOwnedPaintStudyV12ForReader, type OwnedPaintStudyV12 } from './browser-frame-owned-paint-v12.js';
import { OwnedPaintBudgetV12, OWNED_PAINT_V12_LIMITS, cloneUsageV12,
  referenceJSONReservationV12, assertOwnedPaintBudgetV12, type UsageV12 } from './browser-frame-owned-paint-v12-budget.js';

interface Reference { path: string; bytes: number; sha256: string }
export interface OwnedPaintTraceV12 {
  policy: typeof OWNED_PAINT_V12_POLICY;
  status: 'complete-owned-whole-diagnostic' | 'unavailable'; reason: string | null;
  fullInputVerified: boolean; structuralContainerEOF: boolean;
  reader: { kind: 'source-owned-persisted-file'; EOF: boolean; closed: boolean; identityMatch: boolean;
    hashMatch: boolean; reads: number; bytes: number; sha256: string | null; before: readonly string[] | null; after: readonly string[] | null };
  study: OwnedPaintStudyV12 | null;
  authority: typeof OWNED_PAINT_V12_AUTHORITY; metrics: typeof OWNED_PAINT_V12_METRICS; usage: UsageV12;
}

// Source-derived custody choreography: frozen whole-trace-reader readOwnedFile,
// and prepare-stock033-v2 pathCheck/pathBookend. No historical implementation is imported.
function identity(stat: fs.BigIntStats): string[] {
  return [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].map(n => {
    const value = String(n); if (value.length > 64) throw Error('reader-identity'); return value;
  });
}
function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
function reference(input: unknown, budget: OwnedPaintBudgetV12): { ref: Reference; release: () => void } {
  if (typeof input !== 'string' || input.length > 32768) throw Error('invalid-reference');
  const release = budget.reserveOperation('referenceJSON', referenceJSONReservationV12());
  try {
    const value: unknown = JSON.parse(input);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid-reference');
    const keys = Object.keys(value);
    if (keys.length !== 3 || keys[0] !== 'path' || keys[1] !== 'bytes' || keys[2] !== 'sha256') throw Error('invalid-reference');
    const record = value as Reference;
    if (typeof record.path !== 'string' || record.path.length > 4096 || record.path.includes('\0') ||
      !Number.isSafeInteger(record.bytes) || record.bytes < 0 || record.bytes > 33554432 ||
      typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('invalid-reference');
    budget.chargeCumulative('utf8WidthScanUnits', record.path.length);
    if (Buffer.byteLength(record.path) > 4096 || !path.isAbsolute(record.path) || path.resolve(record.path) !== record.path) throw Error('invalid-reference');
    budget.chargeCumulative('wrapperWork', 4 * input.length + 32);
    if (JSON.stringify(record) !== input) throw Error('invalid-reference');
    return { ref: { path: record.path, bytes: record.bytes, sha256: record.sha256 }, release };
  } catch { release(); throw Error('invalid-reference'); }
}

/** Source-owned original-file custody. Public inputs carry neither EOF nor budget authority. */
export function readOwnedPaintTraceV12(referenceJSON: unknown, policy: unknown): OwnedPaintTraceV12 {
  return readOwnedPaintTraceEngine(referenceJSON, policy, new OwnedPaintBudgetV12('reader'), false);
}

/** Source-private fixed-worker composition; no package export or caller budget API. */
export function readOwnedPaintTraceV12ForWorker(referenceJSON: unknown, policy: unknown, budget: OwnedPaintBudgetV12): OwnedPaintTraceV12 {
  assertOwnedPaintBudgetV12(budget, 'reader');
  return readOwnedPaintTraceEngine(referenceJSON, policy, budget, true);
}

function readOwnedPaintTraceEngine(referenceJSON: unknown, policy: unknown, budget: OwnedPaintBudgetV12, worker: boolean): OwnedPaintTraceV12 {
  const reader: OwnedPaintTraceV12['reader'] = { kind: 'source-owned-persisted-file', EOF: false, closed: false,
    identityMatch: false, hashMatch: false, reads: 0, bytes: 0, sha256: null, before: null, after: null };
  let reason: string | null = null, ref: Reference | null = null, fd: number | undefined;
  let study: OwnedPaintStudyV12 | null = null;
  let owner: ReturnType<typeof createOwnedPaintStudyV12ForReader> | null = null;
  let releaseBuffer: (() => void) | undefined, releasePaths: (() => void) | undefined, releaseReference: (() => void) | undefined;
  const fail = (code: string) => { reason ??= code; };
  const physical = (amount = 64) => budget.chargeReader('wrapperWork', amount);
  const ancestors: { path: string; dev: bigint; ino: bigint }[] = [];
  try {
    if (policy !== OWNED_PAINT_V12_POLICY) throw Error('invalid-reference');
    const parsed = reference(referenceJSON, budget); ref = parsed.ref; releaseReference = parsed.release;
  } catch { fail('invalid-reference'); }
  if (ref) {
    try {
      physical(ref.path.length + 64);
      let prefixUnits = 0, directoryCount = 0;
      // Every retained ancestor prefix has its own string extent. Count those
      // extents before split/join/append; a linear path length is insufficient.
      for (let i = 1; i < ref.path.length; i++) if (ref.path.charCodeAt(i) === 47) { prefixUnits += i; directoryCount++; }
      releasePaths = budget.reserveTransient({ utf16Units: prefixUnits + ref.path.length * 3 + 64, logicalSlots: directoryCount * 8 + 64 });
      let current = path.parse(ref.path).root;
      for (const part of ref.path.slice(current.length).split('/').slice(0, -1)) {
        physical(current.length + part.length + 64); current = path.join(current, part);
        const stat = fs.lstatSync(current, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('reader-path');
        ancestors.push({ path: current, dev: stat.dev, ino: stat.ino });
      }
      physical(ref.path.length + 64);
      if (fs.realpathSync(ref.path) !== ref.path) throw Error('reader-path');
      physical(); const initial = fs.lstatSync(ref.path, { bigint: true }); reader.before = identity(initial);
      if (!initial.isFile() || initial.nlink !== 1n || initial.size !== BigInt(ref.bytes)) throw Error('reader-path');
      physical(); fd = fs.openSync(ref.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      physical(); if (!same(reader.before, identity(fs.fstatSync(fd, { bigint: true })))) throw Error('reader-drift');
      owner = createOwnedPaintStudyV12ForReader(ref.bytes, budget);
      releaseBuffer = budget.reserveTransient({ bufferBytes: 65536 });
      const buffer = new Uint8Array(65536), hash = createHash('sha256');
      for (;;) {
        if (reader.reads >= OWNED_PAINT_V12_LIMITS.readCalls) { fail('reader-capacity'); break; }
        const requested = Math.min(buffer.byteLength, ref.bytes - reader.bytes + 1);
        budget.chargeReader('requestedReadBytes', requested); budget.chargeReader('readCalls', 1);
        reader.reads++;
        const n = fs.readSync(fd, buffer, 0, requested, null);
        if (!Number.isSafeInteger(n) || n < 0 || n > requested) { fail('reader-result'); break; }
        if (n === 0) { reader.EOF = true; if (reader.bytes !== ref.bytes) fail('reader-truncated'); break; }
        budget.chargeReader('acknowledgedReadBytes', n);
        const piece = Uint8Array.prototype.subarray.call(buffer, 0, n) as Uint8Array;
        hash.update(piece); reader.bytes += n;
        if (reader.bytes > ref.bytes) { fail('reader-growth'); break; }
        owner.feed(piece);
      }
      physical(); reader.sha256 = hash.digest('hex');
      reader.hashMatch = reader.bytes === ref.bytes && reader.sha256 === ref.sha256;
      physical(); reader.after = identity(fs.fstatSync(fd, { bigint: true }));
      physical(); reader.identityMatch = same(reader.before, reader.after) && same(reader.before, identity(fs.lstatSync(ref.path, { bigint: true })));
      for (const ancestor of ancestors) {
        physical(ancestor.path.length + 64); const stat = fs.lstatSync(ancestor.path, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== ancestor.dev || stat.ino !== ancestor.ino) reader.identityMatch = false;
      }
      physical(ref.path.length + 64); if (fs.realpathSync(ref.path) !== ref.path) reader.identityMatch = false;
      if (!reader.EOF) fail('reader-no-eof');
      if (!reader.identityMatch) fail('reader-drift');
      if (!reader.hashMatch) fail('reader-hash');
    } catch { fail('reader-failure'); }
    finally {
      if (fd !== undefined) {
        try { physical(); fs.closeSync(fd); reader.closed = true; } catch { fail('reader-close'); }
      }
      ancestors.length = 0; releaseBuffer?.(); releasePaths?.();
    }
    if (owner) {
      try { study = owner.finish(); } catch { fail('reader-study-finalization'); }
    }
  }
  const fullInputVerified = reason === null && reader.EOF && reader.closed && reader.identityMatch && reader.hashMatch;
  const structuralContainerEOF = fullInputVerified && study?.framingBoundaryComplete === true;
  if (!fullInputVerified) study = null;
  else if (!structuralContainerEOF || study?.status !== 'complete-owned-selected-schema') reason = study?.reason ?? 'structural-unavailable';
  ref = null; releaseReference?.();
  const result: OwnedPaintTraceV12 = { policy: OWNED_PAINT_V12_POLICY,
    status: fullInputVerified && structuralContainerEOF && study?.status === 'complete-owned-selected-schema' ? 'complete-owned-whole-diagnostic' : 'unavailable',
    reason, fullInputVerified, structuralContainerEOF, reader, study,
    authority: OWNED_PAINT_V12_AUTHORITY, metrics: OWNED_PAINT_V12_METRICS, usage: cloneUsageV12(budget.usage) };
  try {
    budget.finalizeOutput(result, !fullInputVerified, worker); return result;
  }
  catch {
    const failed: OwnedPaintTraceV12 = { policy: OWNED_PAINT_V12_POLICY, status: 'unavailable', reason: 'reader-output-capacity',
      fullInputVerified: false, structuralContainerEOF: false, reader, study: null,
      authority: OWNED_PAINT_V12_AUTHORITY, metrics: OWNED_PAINT_V12_METRICS, usage: cloneUsageV12(budget.usage) };
    budget.finalizeOutput(failed, true, worker); return failed;
  }
}
