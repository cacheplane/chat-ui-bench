import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {SEMANTIC_LARGE_V3_POLICY} from './semantic-large-v3-policy.mjs';

// Source-bound adaptation of matrix-artifacts-v3.mjs (SHA256
// 172fbdd42640c0053f07a50a939b99fa33d6e34b0b7a660cf1644b2d5d621a4e).
// Retains exclusive opens, descriptor/name bookends, bounded cap+1 reading,
// exact UTF8 charging, retained attempted names and close/finally rejection.
// Deltas: fixed rosters/reserves, trace-only kind, bigint stat metadata,
// canonical output-parent pin, absolute dispatch gates and statfs originals.
const policy = SEMANTIC_LARGE_V3_POLICY;
const limits = policy.storage, timing = policy.timing;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sameIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino;
const identity = stat => ({dev: stat.dev.toString(), ino: stat.ino.toString()});
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function snapshot(value) {return freeze(JSON.parse(JSON.stringify(value)));}
function exactData(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) throw Error('matrix-artifact-arguments');
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && Object.getPrototypeOf(proto) !== null) throw Error('matrix-artifact-arguments');
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw Error('matrix-artifact-arguments');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw Error('matrix-artifact-arguments');
  }
}
function checkName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name)) throw Error('matrix-artifact-path-name');
}
function capFor(kind) {
  if (kind === 'manifest') return limits.initialManifestReserveBytes;
  if (!Object.hasOwn(limits.kinds, kind)) throw Error('matrix-artifact-kind');
  return limits.kinds[kind];
}
function checkTraceName(relative, kind) {
  const segments = relative.split('/');
  if ((kind === 'trace-v3') !== (segments.at(-1) === limits.rawFilename)
    || (kind === 'trace-v3' && segments.length !== 2)) throw Error('matrix-artifact-trace-kind-path');
}
function encode(value, cap) {
  const text = JSON.stringify(value);
  if (typeof text !== 'string') throw Error('matrix-artifact-json');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > cap) throw Error('matrix-artifact-file-cap');
  return Buffer.from(text, 'utf8');
}

// Literal schedules, independent of later orchestration modules. Pilot source:
// fixed16 JSON SHA256 1ca9eb6820340ce092f2d251db84d5d19e8f160718fad3e318b5a6abe8248757.
// Full48: old interleaved schedule, ONLY the reviewed round suffix replacement.
const PILOT_IDS = Object.freeze([
  'threadplane-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h10000-r6400-follow-semantic-task-layout-large-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'threadplane-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
  'copilotkit-h10000-r6400-history-reading-semantic-task-layout-large-v3-pilot-round-1',
]);
const FULL_IDS = Object.freeze([
  'threadplane-h1000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'copilotkit-h1000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'assistant-ui-h1000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'threadplane-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'assistant-ui-h10000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'copilotkit-h10000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'threadplane-h10000-r6400-follow-four-profile-stock036-large-v3-round-1',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'threadplane-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-1',
  'copilotkit-h1000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'assistant-ui-h1000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'threadplane-h1000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'threadplane-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'threadplane-h10000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'assistant-ui-h10000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'copilotkit-h10000-r6400-follow-four-profile-stock036-large-v3-round-2',
  'threadplane-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-2',
  'assistant-ui-h1000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'copilotkit-h1000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'threadplane-h1000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'threadplane-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'threadplane-h10000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'copilotkit-h10000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'assistant-ui-h10000-r6400-follow-four-profile-stock036-large-v3-round-3',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'threadplane-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock036-large-v3-round-3',
]);

// Separate stock037 identities preserve the reviewed whole Latin order above.
const STOCK037_PILOT_IDS = Object.freeze([
  'threadplane-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'copilotkit-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'copilotkit-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'assistant-ui-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'threadplane-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'vercel-ai-sdk-h1000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'copilotkit-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'threadplane-h10000-r6400-follow-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'vercel-ai-sdk-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'threadplane-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'assistant-ui-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
  'copilotkit-h10000-r6400-history-reading-semantic-task-layout-large-stock037-v3-pilot-round-1',
]);
const STOCK037_FULL_IDS = Object.freeze([
  'threadplane-h1000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'copilotkit-h1000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'assistant-ui-h1000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'threadplane-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'assistant-ui-h10000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'copilotkit-h10000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'threadplane-h10000-r6400-follow-four-profile-stock037-large-v3-round-1',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'threadplane-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-1',
  'copilotkit-h1000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'assistant-ui-h1000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'threadplane-h1000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'threadplane-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'threadplane-h10000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'assistant-ui-h10000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'copilotkit-h10000-r6400-follow-four-profile-stock037-large-v3-round-2',
  'threadplane-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-2',
  'assistant-ui-h1000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'vercel-ai-sdk-h1000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'copilotkit-h1000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'threadplane-h1000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'vercel-ai-sdk-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'threadplane-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'assistant-ui-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'copilotkit-h1000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'threadplane-h10000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'copilotkit-h10000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'vercel-ai-sdk-h10000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'assistant-ui-h10000-r6400-follow-four-profile-stock037-large-v3-round-3',
  'copilotkit-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'assistant-ui-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'threadplane-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
  'vercel-ai-sdk-h10000-r6400-history-reading-four-profile-stock037-large-v3-round-3',
]);

async function createStore(input, ids) {
  exactData(input, ['directory', 'invocationStarted']);
  const {directory, invocationStarted} = input;
  const initialNow = performance.now();
  if (typeof directory !== 'string' || !path.isAbsolute(directory) || path.resolve(directory) !== directory
    || directory.includes('\0') || Buffer.byteLength(directory) > 4096) throw Error('matrix-artifact-directory-path');
  if (!Number.isFinite(invocationStarted) || invocationStarted < 0 || invocationStarted > initialNow) throw Error('matrix-artifact-invocation-clock');
  const invocationEnd = invocationStarted + timing.invocationMs, cleanupEnd = invocationEnd + timing.cleanupMs;
  const reservation = ids.length * limits.caseBytes + limits.initialManifestReserveBytes + limits.finalManifestReserveBytes + limits.invocationFailureReserveBytes;
  if (reservation > limits.invocationBytes) throw Error('matrix-artifact-invocation-budget');
  const parent = path.dirname(directory), spaceChecks = [], caseStats = new Map(), caseEnds = new Map(), rawReferences = new Map();
  const caseNames = new Set(), manifestNames = new Set();
  let parentStat, rootStat, root, chargedBytes = 0, caseReservation = 0, next = 0, grant = null;
  let stopped = false, deadlineFailed = false, pendingOriginals = 0, pendingWriters = 0, unsafeWriter = false;
  let initialManifestBytes = 0, finalManifestBytes = 0, invocationFailureBytes = 0, invocationFailureAttempted = false;
  function gate(end = invocationEnd, closingEnd = cleanupEnd) {
    return {end: Math.min(end, invocationEnd), cleanupEnd: Math.min(closingEnd, cleanupEnd)};
  }
  function check(operation, closing = false) {
    if (performance.now() >= (closing ? operation.cleanupEnd : operation.end)) {
      deadlineFailed = true; stopped = true; throw Error('matrix-artifact-deadline');
    }
  }
  async function observed(operation, target, method, args, closing = false) {
    check(operation, closing);
    pendingOriginals++;
    try {
      const result = await target[method](...args);
      // An acquired descriptor must reach the caller's finally even when its
      // open settles late. The very next descriptor operation checks the end;
      // close remains clipped to the original cleanup end.
      // statfs preserves the factual value before its caller rejects lateness.
      if (method !== 'open' && method !== 'statfs') check(operation, closing);
      return result;
    } finally {pendingOriginals--;}
  }
  const call = (operation, method, ...args) => observed(operation, fs, method, args);
  const descriptor = (operation, handle, method, ...args) => observed(operation, handle, method, args);
  async function close(operation, handle) {
    try {await observed(operation, handle, 'close', [], true);}
    catch (error) {unsafeWriter = true; stopped = true; throw error;}
  }
  async function verifyParent(operation) {
    const current = await call(operation, 'lstat', parent, {bigint: true});
    if (!current.isDirectory() || current.isSymbolicLink() || !sameIdentity(current, parentStat)
      || await call(operation, 'realpath', parent) !== parent) throw Error('matrix-artifact-output-parent-path-identity');
  }
  async function verifyRoot(operation) {
    await verifyParent(operation);
    const current = await call(operation, 'lstat', root, {bigint: true});
    if (!current.isDirectory() || current.isSymbolicLink() || !sameIdentity(current, rootStat)
      || current.dev !== parentStat.dev || await call(operation, 'realpath', root) !== root) throw Error('matrix-artifact-root-path-drift');
  }
  async function checkedPath(operation, relative, expectedParent = null) {
    if (typeof relative !== 'string' || relative.length > 257 || relative.includes('\\')) throw Error('matrix-artifact-path');
    const segments = relative.split('/');
    if (segments.length < 1 || segments.length > 2) throw Error('matrix-artifact-path');
    for (const segment of segments) checkName(segment);
    await verifyRoot(operation);
    const caseParent = segments.length === 2 ? path.join(root, segments[0]) : root;
    const stat = await call(operation, 'lstat', caseParent, {bigint: true});
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== rootStat.dev
      || await call(operation, 'realpath', caseParent) !== caseParent) throw Error('matrix-artifact-parent-path-symlink');
    if (expectedParent && !sameIdentity(stat, expectedParent)) throw Error('matrix-artifact-parent-path-identity');
    return {file: path.join(root, ...segments), parentStat: expectedParent ?? stat};
  }
  async function verifyNamedFile(operation, relative, expectedParent, descriptorStat) {
    const {file} = await checkedPath(operation, relative, expectedParent);
    const named = await call(operation, 'lstat', file, {bigint: true});
    if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1n || !sameIdentity(named, descriptorStat)
      || await call(operation, 'realpath', file) !== file) throw Error('matrix-artifact-leaf-path-identity');
  }
  async function readVerifiedJSON(operation, ref, kind, expectedParent) {
    exactData(ref, ['path', 'bytes', 'sha256']);
    const cap = capFor(kind);
    if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || typeof ref.path !== 'string'
      || typeof ref.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(ref.sha256)) throw Error('matrix-artifact-reference');
    checkTraceName(ref.path, kind);
    if (ref.bytes > cap) throw Error('matrix-artifact-read-cap');
    const {file, parentStat: pinned} = await checkedPath(operation, ref.path, expectedParent);
    const handle = await call(operation, 'open', file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes, acceptedStat;
    try {
      const before = await descriptor(operation, handle, 'stat', {bigint: true});
      if (!before.isFile() || before.nlink !== 1n) throw Error('matrix-artifact-read-file');
      await verifyNamedFile(operation, ref.path, pinned, before);
      if (before.size > BigInt(cap)) throw Error('matrix-artifact-read-cap');
      if (before.size !== BigInt(ref.bytes)) throw Error('matrix-artifact-read-size');
      const buffer = Buffer.alloc(ref.bytes + 1);
      let count = 0;
      while (count < buffer.length) {
        const read = await descriptor(operation, handle, 'read', buffer, count, buffer.length - count, count);
        if (read.bytesRead === 0) break;
        count += read.bytesRead;
      }
      const after = await descriptor(operation, handle, 'stat', {bigint: true});
      if (count !== ref.bytes || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs) throw Error('matrix-artifact-read-size-drift');
      bytes = buffer.subarray(0, count);
      if (hash(bytes) !== ref.sha256) throw Error('matrix-artifact-read-hash');
      await verifyNamedFile(operation, ref.path, pinned, after);
      acceptedStat = after;
    } finally {await close(operation, handle);}
    await verifyNamedFile(operation, ref.path, pinned, acceptedStat);
    check(operation);
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  }
  async function publish(operation, relative, bytes, expectedParent = rootStat) {
    pendingWriters++;
    try {
      const {file, parentStat: pinned} = await checkedPath(operation, relative, expectedParent);
      const handle = await call(operation, 'open', file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      let acceptedStat;
      try {
        const opened = await descriptor(operation, handle, 'stat', {bigint: true});
        // Portable Node has no openat; a parent race can create an empty
        // exclusive leaf, but identity refusal precedes every content write.
        await verifyNamedFile(operation, relative, pinned, opened);
        await descriptor(operation, handle, 'writeFile', bytes);
        await descriptor(operation, handle, 'sync');
        const stat = await descriptor(operation, handle, 'stat', {bigint: true});
        if (!stat.isFile() || stat.nlink !== 1n || stat.size !== BigInt(bytes.length)) throw Error('matrix-artifact-publication-size');
        await verifyNamedFile(operation, relative, pinned, stat);
        acceptedStat = stat;
      } finally {await close(operation, handle);}
      await verifyNamedFile(operation, relative, pinned, acceptedStat);
      check(operation);
      return Object.freeze({path: relative, bytes: bytes.length, sha256: hash(bytes)});
    } finally {pendingWriters--;}
  }
  async function space(operation, purpose, caseId = null) {
    if (spaceChecks.length >= 1 + ids.length * 2) throw Error('matrix-artifact-space-check-budget');
    const unspent = BigInt(reservation - chargedBytes), required = unspent + BigInt(limits.filesystemMarginBytes);
    const row = {purpose, caseId, chargedBytes: String(chargedBytes), unspentBytes: String(unspent), requiredBytes: String(required), observedFreeBytes: null,
      dispatchedMs: performance.now(), settledMs: null, status: 'pending', deadlineFailed: false};
    spaceChecks.push(row);
    try {
      if (root) await verifyRoot(operation);
      else await verifyParent(operation);
      const observed = await call(operation, 'statfs', parent, {bigint: true});
      if (typeof observed.bsize !== 'bigint' || typeof observed.bavail !== 'bigint' || observed.bsize <= 0n || observed.bavail < 0n) throw Error('matrix-artifact-space-observation');
      row.observedFreeBytes = String(observed.bsize * observed.bavail);
      check(operation);
      if (BigInt(row.observedFreeBytes) < required) throw Error('matrix-artifact-space-unavailable');
      if (root) await verifyRoot(operation);
      else await verifyParent(operation);
      check(operation);
      row.status = 'fulfilled';
    } catch (error) {
      stopped = true;
      row.status = 'rejected'; row.deadlineFailed = performance.now() >= operation.end;
      deadlineFailed ||= row.deadlineFailed;
      throw error;
    } finally {row.settledMs = performance.now();}
  }
  const initial = gate(initialNow + policy.decoder.originalMs);
  parentStat = await call(initial, 'lstat', parent, {bigint: true});
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || await call(initial, 'realpath', parent) !== parent) throw Error('matrix-artifact-output-parent-path-symlink');
  await space(initial, 'initial');
  await call(initial, 'mkdir', directory, {mode: 0o700});
  await verifyParent(initial);
  rootStat = await call(initial, 'lstat', directory, {bigint: true});
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.dev !== parentStat.dev) throw Error('matrix-artifact-root-path-symlink');
  root = await call(initial, 'realpath', directory);
  if (root !== directory || !sameIdentity(rootStat, await call(initial, 'lstat', root, {bigint: true}))) throw Error('matrix-artifact-root-path-identity');
  await verifyRoot(initial);

  return Object.freeze({
    async requireSpaceBeforeNextCaseV3(caseId) {
      if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
      if (caseId !== ids[next]) throw Error('matrix-artifact-next-roster-id');
      if (stopped || unsafeWriter) throw Error('matrix-artifact-invocation-unavailable');
      if (grant) throw Error('matrix-artifact-grant-attempted');
      if (pendingOriginals || pendingWriters) {stopped = true; throw Error('matrix-artifact-space-pending-attempt');}
      // A pending/refused check is itself the one attempt, never retryable.
      grant = {caseId, status: 'pending', settledMs: null};
      try {
        await space(gate(performance.now() + policy.decoder.originalMs), 'next-case', caseId);
        grant.status = 'fulfilled'; grant.settledMs = performance.now();
      } catch (error) {grant.status = 'rejected'; throw error;}
    },
    async beginCase(caseId) {
      if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
      checkName(caseId);
      if (stopped || unsafeWriter) throw Error('matrix-artifact-invocation-budget-unavailable');
      if (pendingOriginals || pendingWriters) {stopped = true; throw Error('matrix-artifact-case-original-pending');}
      if (!grant || grant.caseId !== caseId || grant.status !== 'fulfilled' || caseId !== ids[next]) throw Error('matrix-artifact-case-grant');
      if (performance.now() - grant.settledMs > policy.decoder.originalMs) {stopped = true; throw Error('matrix-artifact-case-grant-expired');}
      const caseDispatched = performance.now();
      const operation = gate();
      check(operation);
      grant = null; next++;
      caseNames.add(caseId); caseReservation += limits.caseBytes;
      try {
        const {file} = await checkedPath(operation, caseId, rootStat);
        await call(operation, 'mkdir', file, {mode: 0o700});
        const stat = await call(operation, 'lstat', file, {bigint: true});
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== rootStat.dev
          || await call(operation, 'realpath', file) !== file) throw Error('matrix-artifact-case-path-identity');
        await verifyRoot(operation);
        caseStats.set(caseId, stat);
      } catch (error) {stopped = true; throw error;}
      let ordinaryBytes = 0, failureBytes = 0, failureAttempted = false, failed = false, transportAttempted = false, decoderAttempted = false;
      // Original case time is supplied only by the later source-bound seam.
      // Until then the store knows only the original invocation hard end;
      // callers retain responsibility for their earlier native case deadline.
      let caseEnd = invocationEnd;
      caseEnds.set(caseId, caseEnd);
      const names = new Set();
      const caseGate = () => gate(caseEnd, Math.min(caseEnd, invocationEnd) + timing.cleanupMs);
      return Object.freeze({
        async writeJSON(name, value, options = {}) {
          checkName(name);
          exactData(options, Object.hasOwn(options, 'kind') ? ['kind'] : []);
          const kind = options.kind ?? 'evidence', failure = kind === 'failure';
          if (!failure && failed) throw Error('matrix-artifact-case-failed-unavailable');
          if (failure && failureAttempted) throw Error('matrix-artifact-failure-reserve-attempted');
          if (names.has(name)) throw Error('matrix-artifact-name-attempted-exists');
          names.add(name);
          if (failure) failureAttempted = true;
          try {
            if (kind === 'manifest' || !Object.hasOwn(limits.kinds, kind)) throw Error('matrix-artifact-kind');
            checkTraceName(`${caseId}/${name}`, kind);
            const bytes = encode(value, capFor(kind));
            if (failure) failureBytes += bytes.length;
            else {
              if (ordinaryBytes + bytes.length > limits.caseBytes - limits.caseFailureReserveBytes) throw Error('matrix-artifact-case-budget');
              ordinaryBytes += bytes.length;
            }
            chargedBytes += bytes.length;
            const operation = caseGate();
            if (failure) operation.end = operation.cleanupEnd;
            const ref = await publish(operation, `${caseId}/${name}`, bytes, caseStats.get(caseId));
            if (kind === 'trace-v3') rawReferences.set(caseId, ref);
            return ref;
          } catch (error) {failed = true; stopped = true; throw error;}
        },
        reserveDecoderTrafficV3() {
          if (arguments.length !== 0) throw Error('matrix-artifact-arguments');
          if (transportAttempted) throw Error('matrix-artifact-decoder-transport-attempted');
          transportAttempted = true;
          try {
            check(caseGate());
            if (failed || unsafeWriter) throw Error('matrix-artifact-case-failed-unavailable');
            if (ordinaryBytes + policy.decoder.transportReserveBytes > limits.caseBytes - limits.caseFailureReserveBytes) throw Error('matrix-artifact-case-budget');
            ordinaryBytes += policy.decoder.transportReserveBytes; chargedBytes += policy.decoder.transportReserveBytes;
          } catch (error) {failed = true; stopped = true; throw error;}
        },
        async requireSpaceBeforeDecoderV3(input) {
          if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
          exactData(input, ['caseStarted', 'invocationStarted']);
          if (input.invocationStarted !== invocationStarted || !Number.isFinite(input.caseStarted)
            || input.caseStarted < invocationStarted || input.caseStarted > caseDispatched) throw Error('matrix-artifact-decoder-original-clock');
          if (decoderAttempted) throw Error('matrix-artifact-decoder-space-attempted');
          const refuse = reason => {failed = true; stopped = true; throw Error(reason);};
          if (failed || stopped || unsafeWriter || pendingWriters || pendingOriginals) refuse('matrix-artifact-decoder-writer-pending-unavailable');
          if (!rawReferences.has(caseId)) refuse('matrix-artifact-decoder-raw-unavailable');
          if (!transportAttempted) refuse('matrix-artifact-decoder-transport-unavailable');
          decoderAttempted = true;
          caseEnd = Math.min(caseEnd, input.caseStarted + timing.caseMs);
          caseEnds.set(caseId, caseEnd);
          const operation = gate(Math.min(caseEnd, performance.now() + policy.decoder.originalMs), Math.min(caseEnd, invocationEnd) + timing.cleanupMs);
          try {
            await checkedPath(operation, `${caseId}/${limits.rawFilename}`, caseStats.get(caseId));
            await space(operation, 'decoder', caseId);
            await checkedPath(operation, `${caseId}/${limits.rawFilename}`, caseStats.get(caseId));
            check(operation);
            return snapshot({artifactRoot: root, rootIdentity: identity(rootStat), caseParentIdentity: identity(caseStats.get(caseId)), rawReference: rawReferences.get(caseId)});
          } catch (error) {failed = true; stopped = true; throw error;}
        },
        stats() {return snapshot({reservedBytes: ordinaryBytes + failureBytes, ordinaryBytes, failureBytes, failed});},
      });
    },
    async writeManifest(name, value) {
      checkName(name);
      if (name === limits.invocationFailureFilename || manifestNames.has(name) || caseNames.has(name)) throw Error('matrix-artifact-manifest-name-attempted-exists');
      manifestNames.add(name);
      try {
        checkTraceName(name, 'manifest');
        const bytes = encode(value, limits.initialManifestReserveBytes);
        const final = name === 'manifest-final.json' || name === 'final.json';
        if ((final ? finalManifestBytes : initialManifestBytes) + bytes.length > limits.initialManifestReserveBytes) throw Error('matrix-artifact-manifest-budget');
        if (final) finalManifestBytes += bytes.length;
        else initialManifestBytes += bytes.length;
        chargedBytes += bytes.length;
        return await publish(final ? {end: cleanupEnd, cleanupEnd} : gate(), name, bytes);
      } catch (error) {stopped = true; throw error;}
    },
    async writeInvocationFailureV3(value) {
      if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
      if (invocationFailureAttempted) throw Error('matrix-artifact-invocation-failure-attempted');
      if (pendingWriters || unsafeWriter) throw Error('matrix-artifact-unsafe-writer-pending');
      const operation = {end: cleanupEnd, cleanupEnd};
      check(operation);
      invocationFailureAttempted = true;
      try {
        const bytes = encode(value, limits.invocationFailureReserveBytes);
        invocationFailureBytes += bytes.length; chargedBytes += bytes.length;
        const ref = await publish(operation, limits.invocationFailureFilename, bytes);
        await readVerifiedJSON(operation, ref, 'manifest', rootStat);
        return ref;
      } catch (error) {stopped = true; throw error;}
    },
    async readJSON(ref, options = {}) {
      exactData(ref, ['path', 'bytes', 'sha256']);
      exactData(options, Object.hasOwn(options, 'kind') ? ['kind'] : []);
      const kind = options.kind ?? 'evidence';
      const caseId = typeof ref?.path === 'string' && ref.path.includes('/') ? ref.path.split('/')[0] : null;
      if (caseId && !caseStats.has(caseId)) throw Error('matrix-artifact-reference-case-path');
      if (kind === 'trace-v3') {
        const raw = rawReferences.get(caseId);
        if (!raw || raw.path !== ref.path || raw.bytes !== ref.bytes || raw.sha256 !== ref.sha256) throw Error('matrix-artifact-reference-raw');
      }
      const end = caseId ? caseEnds.get(caseId) : invocationEnd;
      const operation = gate(end, Math.min(end, invocationEnd) + timing.cleanupMs);
      if (kind === 'failure' || (!caseId && kind === 'manifest' && ['final.json', 'manifest-final.json', limits.invocationFailureFilename].includes(ref.path))) operation.end = operation.cleanupEnd;
      return readVerifiedJSON(operation, ref, kind, caseId ? caseStats.get(caseId) : rootStat);
    },
    stats() {
      return snapshot({caseReservation, manifestBytes: initialManifestBytes + finalManifestBytes, initialManifestBytes, finalManifestBytes,
        invocationFailureBytes, invocationFailureAttempted, invocationReservation: reservation, chargedBytes, stopped, deadlineFailed,
        pendingOriginals, pendingWriters, unsafeWriter, spaceChecks});
    },
  });
}

export async function createSemanticLarge16StoreV3(input) {
  if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
  return createStore(input, PILOT_IDS);
}
export async function createSemanticLarge48StoreV3(input) {
  if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
  return createStore(input, FULL_IDS);
}
export async function createSemanticLargeStock03716StoreV3(input) {
  if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
  return createStore(input, STOCK037_PILOT_IDS);
}
export async function createSemanticLargeStock03748StoreV3(input) {
  if (arguments.length !== 1) throw Error('matrix-artifact-arguments');
  return createStore(input, STOCK037_FULL_IDS);
}
