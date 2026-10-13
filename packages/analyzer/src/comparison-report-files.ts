import fs from 'node:fs/promises';
import {constants, type BigIntStats} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute, join, normalize, parse, relative, sep} from 'node:path';
import {loadComparisonInvocation} from './comparison-load.js';
import {selectComparisonTracePolicy} from './comparison-trace-stream.js';
import {projectComparisonReport, serializeComparisonReport, assertComparisonReportBytes} from './comparison-report.js';

const sameInode = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino;
const identity = (s: BigIntStats) => ({dev: String(s.dev), ino: String(s.ino), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs)});
const sameFile = (a: BigIntStats, b: BigIntStats) => a.isFile() && b.isFile() && a.nlink === 1n && b.nlink === 1n && sameInode(a, b) && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
function within(parent: string, child: string) {const rel = relative(parent, child); return rel === '' || rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);}
function originalFailure(errors: unknown[]): never {if (errors.length === 1) throw errors[0]; throw new AggregateError(errors, 'Original comparison publication and close failures');}
async function directoryChain(path: string) {
  const root = parse(path).root, names = [root]; let current = root;
  for (const segment of path.slice(root.length).split(sep).filter(Boolean)) {current = join(current, segment); names.push(current);}
  const entries = [];
  for (const name of names) {
    const stat = await fs.lstat(name, {bigint: true});
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Comparison report symlink/non-directory ancestor');
    entries.push({path: name, stat});
  }
  return entries;
}
async function checkChain(chain: Awaited<ReturnType<typeof directoryChain>>) {
  const after = [];
  for (const entry of chain) {
    const stat = await fs.lstat(entry.path, {bigint: true});
    if (!stat.isDirectory() || stat.isSymbolicLink() || !sameInode(entry.stat, stat)) throw new Error('Comparison report directory identity changed');
    after.push({path: entry.path, identity: identity(stat)});
  }
  return after;
}
async function ownedWrite(path: string, contents: string) {
  const bytes = Buffer.from(contents); assertComparisonReportBytes(bytes.length);
  const handle = await fs.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const errors: unknown[] = []; let final: BigIntStats | undefined;
  try {
    const before = await handle.stat({bigint: true});
    if (!before.isFile() || before.nlink !== 1n) throw new Error('Comparison report original descriptor is not singly owned regular file');
    let offset = 0;
    while (offset < bytes.length) {
      const written = await handle.write(bytes, offset, bytes.length - offset, offset);
      if (!Number.isSafeInteger(written.bytesWritten) || written.bytesWritten <= 0 || written.bytesWritten > bytes.length - offset) throw new Error('Comparison report original write accounting');
      offset += written.bytesWritten;
    }
    final = await handle.stat({bigint: true});
    if (!final.isFile() || final.nlink !== 1n || !sameInode(before, final) || final.size !== BigInt(bytes.length) || !sameFile(final, await fs.lstat(path, {bigint: true}))) throw new Error('Comparison report output descriptor/path differs after write');
  } catch (error) {errors.push(error);} finally {try {await handle.close();} catch (error) {errors.push(error);}}
  if (errors.length) originalFailure(errors);
  if (!final || !sameFile(final, await fs.lstat(path, {bigint: true}))) throw new Error('Comparison report output identity changed after close');
  return {path, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), stat: final};
}
async function readback(fact: Awaited<ReturnType<typeof ownedWrite>>) {
  if (!sameFile(fact.stat, await fs.lstat(fact.path, {bigint: true}))) throw new Error('Comparison report output replaced before readback');
  const handle = await fs.open(fact.path, constants.O_RDONLY | constants.O_NOFOLLOW); const errors: unknown[] = [];
  const hash = createHash('sha256'); let bytes = 0;
  try {
    if (!sameFile(fact.stat, await handle.stat({bigint: true}))) throw new Error('Comparison report readback descriptor identity');
    const buffer = Buffer.alloc(65536);
    while (true) {
      const read = await handle.read(buffer, 0, buffer.length, null);
      if (!Number.isSafeInteger(read.bytesRead) || read.bytesRead < 0 || read.bytesRead > buffer.length) throw new Error('Comparison report original read accounting');
      if (!read.bytesRead) break;
      bytes += read.bytesRead; assertComparisonReportBytes(bytes); hash.update(buffer.subarray(0, read.bytesRead));
    }
    if (bytes !== fact.byteLength || hash.digest('hex') !== fact.sha256 || !sameFile(fact.stat, await handle.stat({bigint: true}))) throw new Error('Comparison report output bytes changed during readback');
  } catch (error) {errors.push(error);} finally {try {await handle.close();} catch (error) {errors.push(error);}}
  if (errors.length) originalFailure(errors);
  if (!sameFile(fact.stat, await fs.lstat(fact.path, {bigint: true}))) throw new Error('Comparison report output identity changed after readback close');
}
export async function publishComparisonReport(input: string, output: string, options: import('./comparison-trace-stream.js').ComparisonTraceLoadOptions = {}) {
  const tracePolicy = selectComparisonTracePolicy(options);
  const admittedOptions = tracePolicy === undefined ? {} : {tracePolicy};
  if (!isAbsolute(input) || !isAbsolute(output) || normalize(input) !== input || normalize(output) !== output) throw new Error('Comparison report requires canonical absolute paths');
  if (within(input, output) || within(output, input)) throw new Error('Comparison report input/output overlap');
  const inputChain = await directoryChain(input), outputParent = await directoryChain(dirname(output));
  if (await fs.realpath(input) !== input || await fs.realpath(dirname(output)) !== dirname(output)) throw new Error('Comparison report canonical path alias');
  if (outputParent.some(entry => sameInode(entry.stat, inputChain.at(-1)!.stat))) throw new Error('Comparison report physical input/output overlap');
  let exists = false;
  try {await fs.lstat(output, {bigint: true}); exists = true;} catch (error) {
    let missing = false;
    try {missing = error !== null && typeof error === 'object' && Reflect.get(error, 'code') === 'ENOENT';} catch { /* Unknown errno retains the original rejection. */ }
    if (!missing) throw error;
  }
  if (exists) throw new Error('Comparison report existing output destination');
  const report = projectComparisonReport(await loadComparisonInvocation(input, admittedOptions)), encoded = serializeComparisonReport(report);
  await checkChain(inputChain); await checkChain(outputParent);
  await fs.mkdir(output, {mode: 0o700});
  const outputChain = await directoryChain(output), files = [];
  await checkChain(outputParent);
  for (const [name, value] of [['comparison-results.json', encoded.json], ['comparison-summary.md', encoded.markdown]] as const) {
    await checkChain(inputChain); await checkChain(outputParent); await checkChain(outputChain);
    files.push(await ownedWrite(join(output, name), value));
  }
  for (const file of files) await readback(file);
  const membershipBefore = await fs.lstat(output, {bigint: true});
  const dir = await fs.opendir(output); const members: string[] = [], errors: unknown[] = [];
  try {let entry; while ((entry = await dir.read()) !== null) {if (members.length === 2 || !entry.isFile()) throw new Error('Comparison report unexpected owned directory member'); members.push(entry.name);}}
  catch (error) {errors.push(error);} finally {try {await dir.close();} catch (error) {errors.push(error);}}
  if (errors.length) originalFailure(errors);
  const membershipAfter = await fs.lstat(output, {bigint: true});
  if (!membershipAfter.isDirectory() || !sameInode(membershipBefore, membershipAfter) || membershipBefore.mtimeNs !== membershipAfter.mtimeNs || membershipBefore.ctimeNs !== membershipAfter.ctimeNs) throw new Error('Comparison report owned directory membership changed during original enumeration/close');
  if (members.sort().join(',') !== 'comparison-results.json,comparison-summary.md') throw new Error('Comparison report owned directory membership differs');
  for (const file of files) if (!sameFile(file.stat, await fs.lstat(file.path, {bigint: true}))) throw new Error('Comparison report final file identity changed');
  const originalAfter = await checkChain(inputChain), outputAfter = await checkChain(outputChain);
  await checkChain(outputParent);
  const finalMembership = await fs.lstat(output, {bigint: true});
  if (!finalMembership.isDirectory() || !sameInode(membershipAfter, finalMembership) || membershipAfter.mtimeNs !== finalMembership.mtimeNs || membershipAfter.ctimeNs !== finalMembership.ctimeNs) throw new Error('Comparison report owned directory membership changed during final lifetime');
  return {publicationStatus: 'complete' as const, analysisStatus: report.analysisStatus, scoringEligibility: false as const,
    outputs: files.map(file => ({path: file.path.slice(output.length + 1), byteLength: file.byteLength, sha256: file.sha256, identity: identity(file.stat)})),
    originalDirectoryBefore: inputChain.map(entry => ({path: entry.path, identity: identity(entry.stat)})), originalDirectoryAfter: originalAfter,
    outputDirectoryBefore: outputChain.map(entry => ({path: entry.path, identity: identity(entry.stat)})), outputDirectoryAfter: outputAfter,
    ownedMembership: {members, before: identity(membershipBefore), after: identity(finalMembership)}};
}
