import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MiB = 1024 * 1024;
export const MATRIX_ARTIFACT_LIMITS = Object.freeze({
  invocation: 4096 * MiB, manifestReserve: MiB, initialManifestReserve: MiB, finalManifestReserve: MiB, case: 80 * MiB, failureReserve: 65536,
  'private-case': 32 * MiB, transcript: 16 * MiB, evidence: 2 * MiB, result: 2 * MiB, failure: 65536,
});
const kinds = new Set(['private-case', 'transcript', 'evidence', 'result', 'failure']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function checkName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name)) throw Error('matrix-artifact-path-name');
}
function capFor(kind) {
  if (kind === 'manifest') return MATRIX_ARTIFACT_LIMITS.manifestReserve;
  if (!kinds.has(kind)) throw Error('matrix-artifact-kind');
  return MATRIX_ARTIFACT_LIMITS[kind];
}

const sameIdentity = (a, b) => a.ino === b.ino && a.dev === b.dev;
async function checkedPath(root, rootStat, relative, expectedParent = null) {
  if (typeof relative !== 'string' || relative.length > 257 || relative.includes('\\')) throw Error('matrix-artifact-path');
  const segments = relative.split('/');
  if (segments.length < 1 || segments.length > 2) throw Error('matrix-artifact-path');
  for (const segment of segments) checkName(segment);
  const currentRoot = await fs.lstat(root);
  if (!currentRoot.isDirectory() || currentRoot.isSymbolicLink() || currentRoot.ino !== rootStat.ino || currentRoot.dev !== rootStat.dev) throw Error('matrix-artifact-root-path-drift');
  const parent = segments.length === 2 ? path.join(root, segments[0]) : root;
  const stat = await fs.lstat(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(parent) !== parent) throw Error('matrix-artifact-parent-path-symlink');
  if (expectedParent && !sameIdentity(stat, expectedParent)) throw Error('matrix-artifact-parent-path-identity');
  return { file: path.join(root, ...segments), parentStat: expectedParent ?? stat };
}

async function verifyNamedFile(root, rootStat, relative, parentStat, descriptorStat) {
  const { file } = await checkedPath(root, rootStat, relative, parentStat);
  const named = await fs.lstat(file);
  if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1 || !sameIdentity(named, descriptorStat)
    || await fs.realpath(file) !== file) throw Error('matrix-artifact-leaf-path-identity');
}

async function readVerifiedJSON(root, rootStat, ref, kind, expectedParent = null) {
  const cap = capFor(kind);
  if (!ref || typeof ref !== 'object' || !Number.isSafeInteger(ref.bytes) || ref.bytes < 0
    || typeof ref.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(ref.sha256)) throw Error('matrix-artifact-reference');
  if (ref.bytes > cap) throw Error('matrix-artifact-read-cap');
  const { file, parentStat } = await checkedPath(root, rootStat, ref.path, expectedParent);
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes, acceptedStat;
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1) throw Error('matrix-artifact-read-file');
    await verifyNamedFile(root, rootStat, ref.path, parentStat, before);
    if (before.size > cap) throw Error('matrix-artifact-read-cap');
    if (before.size !== ref.bytes) throw Error('matrix-artifact-read-size');
    // A growth race cannot turn readFile into an unbounded allocation/read.
    const buffer = Buffer.alloc(ref.bytes + 1);
    let count = 0;
    while (count < buffer.length) {
      const read = await handle.read(buffer, count, buffer.length - count, count);
      if (read.bytesRead === 0) break;
      count += read.bytesRead;
    }
    const after = await handle.stat();
    if (count !== ref.bytes || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw Error('matrix-artifact-read-size-drift');
    bytes = buffer.subarray(0, count);
    if (hash(bytes) !== ref.sha256) throw Error('matrix-artifact-read-hash');
    await verifyNamedFile(root, rootStat, ref.path, parentStat, after);
    acceptedStat = after;
  } finally { await handle.close(); }
  await verifyNamedFile(root, rootStat, ref.path, parentStat, acceptedStat);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/** Verify an existing invocation without creating a store or publishing anything. */
export async function readMatrixArtifactJSON({ directory, reference, kind = 'evidence' }) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw Error('matrix-artifact-directory-path');
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('matrix-artifact-directory-path-symlink');
  const root = await fs.realpath(directory);
  return readVerifiedJSON(root, stat, reference, kind);
}

/** Exclusive local publication. Reservations are never refunded, even after I/O failure. */
export async function createMatrixArtifactStore({ directory }) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw Error('matrix-artifact-directory-path');
  await fs.mkdir(directory, { mode: 0o700 });
  const rootStat = await fs.lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw Error('matrix-artifact-root-path-symlink');
  const root = await fs.realpath(directory);
  const canonicalStat = await fs.lstat(root);
  if (!sameIdentity(rootStat, canonicalStat)) throw Error('matrix-artifact-root-path-identity');
  const caseNames = new Set(), manifestNames = new Set(), caseStats = new Map();
  let caseReservation = 0, initialManifestBytes = 0, finalManifestBytes = 0, stopped = false;
  const manifestReservations = MATRIX_ARTIFACT_LIMITS.initialManifestReserve + MATRIX_ARTIFACT_LIMITS.finalManifestReserve;
  const checkParent = async relative => (await checkedPath(root, rootStat, relative)).file;
  async function publish(relative, bytes, expectedParent = rootStat) {
    const { file, parentStat } = await checkedPath(root, rootStat, relative, expectedParent);
    const handle = await fs.open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let acceptedStat;
    try {
      const opened = await handle.stat();
      // O_NOFOLLOW protects only the leaf. Pin the original parent and compare
      // the descriptor with its named leaf BEFORE any content is written.
      // Portable Node lacks openat: a refused parent race may create an EMPTY
      // exclusive file elsewhere; it writes no content and yields no reference.
      await verifyNamedFile(root, rootStat, relative, parentStat, opened);
      await handle.writeFile(bytes);
      await handle.sync();
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== bytes.length) throw Error('matrix-artifact-publication-size');
      await verifyNamedFile(root, rootStat, relative, parentStat, stat);
      acceptedStat = stat;
    } finally {
      // A rejected close rejects publication; the partial/existing artifact is retained.
      await handle.close();
    }
    await verifyNamedFile(root, rootStat, relative, parentStat, acceptedStat);
    return Object.freeze({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
  }
  function encode(value, cap) {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') throw Error('matrix-artifact-json');
    // Count exact UTF8 bytes before allocating the encoded buffer or creating a file.
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > cap) throw Error('matrix-artifact-file-cap');
    return Buffer.from(text, 'utf8');
  }
  return Object.freeze({
    async beginCase(caseId) {
      checkName(caseId);
      if (stopped) throw Error('matrix-artifact-invocation-budget-unavailable');
      if (caseNames.has(caseId) || manifestNames.has(caseId)) throw Error('matrix-artifact-case-exists');
      if (caseReservation + MATRIX_ARTIFACT_LIMITS.case + manifestReservations > MATRIX_ARTIFACT_LIMITS.invocation) {
        stopped = true; throw Error('matrix-artifact-invocation-budget');
      }
      caseNames.add(caseId);
      caseReservation += MATRIX_ARTIFACT_LIMITS.case;
      try {
        const caseDirectory = await checkParent(caseId);
        await fs.mkdir(caseDirectory, { mode: 0o700 });
        const caseStat = await fs.lstat(caseDirectory);
        if (!caseStat.isDirectory() || caseStat.isSymbolicLink() || await fs.realpath(caseDirectory) !== caseDirectory) throw Error('matrix-artifact-case-path-identity');
        caseStats.set(caseId, caseStat);
      }
      catch (error) { stopped = true; throw error; }
      let ordinaryBytes = 0, failureBytes = 0, failureAttempted = false, failed = false;
      const names = new Set();
      return Object.freeze({
        async writeJSON(name, value, { kind = 'evidence' } = {}) {
          checkName(name);
          if (!kinds.has(kind)) throw Error('matrix-artifact-kind');
          const cap = capFor(kind), failure = kind === 'failure';
          if (!failure && failed) throw Error('matrix-artifact-case-failed-unavailable');
          if (failure && failureAttempted) throw Error('matrix-artifact-failure-reserve-attempted');
          if (names.has(name)) throw Error('matrix-artifact-name-attempted-exists');
          names.add(name);
          if (failure) failureAttempted = true;
          try {
            const bytes = encode(value, cap);
            if (failure) failureBytes += bytes.length;
            else {
              if (ordinaryBytes + bytes.length > MATRIX_ARTIFACT_LIMITS.case - MATRIX_ARTIFACT_LIMITS.failureReserve) throw Error('matrix-artifact-case-budget');
              ordinaryBytes += bytes.length;
            }
            return await publish(`${caseId}/${name}`, bytes, caseStats.get(caseId));
          } catch (error) { failed = true; stopped = true; throw error; }
        },
        stats() { return Object.freeze({ reservedBytes: ordinaryBytes + failureBytes, ordinaryBytes, failureBytes, failed }); },
      });
    },
    async writeManifest(name, value) {
      checkName(name);
      if (manifestNames.has(name) || caseNames.has(name)) throw Error('matrix-artifact-manifest-name-attempted-exists');
      manifestNames.add(name);
      try {
        const bytes = encode(value, MATRIX_ARTIFACT_LIMITS.manifestReserve);
        const final = name === 'manifest-final.json' || name === 'final.json';
        if ((final ? finalManifestBytes : initialManifestBytes) + bytes.length > MATRIX_ARTIFACT_LIMITS.manifestReserve) throw Error('matrix-artifact-manifest-budget');
        if (final) finalManifestBytes += bytes.length;
        else initialManifestBytes += bytes.length;
        return await publish(name, bytes);
      } catch (error) { stopped = true; throw error; }
    },
    async readJSON(ref, { kind = 'evidence' } = {}) {
      const caseId = typeof ref?.path === 'string' && ref.path.includes('/') ? ref.path.split('/')[0] : null;
      return readVerifiedJSON(root, rootStat, ref, kind, caseStats.get(caseId) ?? null);
    },
    stats() { return Object.freeze({ caseReservation, manifestBytes: initialManifestBytes + finalManifestBytes, initialManifestBytes, finalManifestBytes, invocationReservation: caseReservation + manifestReservations, stopped }); },
  });
}
