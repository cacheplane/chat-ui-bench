import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus, arch, platform, release } from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { CDPSession } from 'playwright';
import type { Manifest } from '@chat-ui-bench/contract';
import {manifestSchema} from '@chat-ui-bench/contract';
import * as comparisonFs from 'node:fs/promises';
import {constants as comparisonConstants, type BigIntStats} from 'node:fs';
import {devNull} from 'node:os';
import {relative, parse as parsePath, sep} from 'node:path';
import {requireComparisonProvenanceSession, createObservedComparisonProcess, type ComparisonProvenanceSession} from './comparison-provenance.js';
import type {ComparisonOwnedResource} from './comparison-ownership.js';
const exec = promisify(execFile);
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export interface CapturedEnvironment {
  git: Manifest['git']; assets: Manifest['assets']; browser: Manifest['browser']; environment: Manifest['environment'];
  browserProtocol: { protocolVersion: string; product: string; revision: string; userAgent: string; jsVersion: string };
  chromiumDownloadRevision: string; playwrightVersion: string;
}
export async function collectEnvironment(root: string, assetDirectory: string, session: CDPSession): Promise<CapturedEnvironment> {
  const version = await session.send('Browser.getVersion');
  const command = await session.send('Browser.getBrowserCommandLine');
  if (!command.arguments.includes('--enable-automation')) throw new Error('Browser identity requires explicit --enable-automation');
  const executable = command.arguments[0]; if (!executable) throw new Error('Browser omitted actual executable');
  const { stdout: revision } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
  const { stdout: changes } = await exec('git', ['status', '--porcelain'], { cwd: root });
  const assets: Record<string, string> = {};
  const visit = async (directory: string, prefix = ''): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(join(directory, entry.name), `${prefix}${entry.name}/`);
      else if (entry.isFile()) assets[`${prefix}${entry.name}`] = sha256(await readFile(join(directory, entry.name)));
    }
  };
  await visit(assetDirectory);
  if (!assets['index.html']) throw new Error('Build the reference app before capture');
  let gpu: Manifest['environment']['gpu'];
  try { const info = await session.send('SystemInfo.getInfo'); gpu = { status: 'available', value: info.gpu as any }; }
  catch (error) { gpu = { status: 'unavailable', reason: `SystemInfo.getInfo unavailable: ${String(error)}` }; }
  const require = createRequire(import.meta.url);
  const browserDownloads = JSON.parse(await readFile(join(dirname(require.resolve('playwright-core/package.json')), 'browsers.json'), 'utf8'));
  const chromium = browserDownloads.browsers.find((browser: { name: string }) => browser.name === 'chromium');
  return {
    git: { revision: revision.trim(), dirty: changes.trim().length > 0 }, assets,
    browser: { executable, version: version.product, revision: version.revision, flags: command.arguments.slice(1) },
    environment: { os: `${platform()} ${release()}`, architecture: arch(), cpu: cpus().length ? { status: 'available' as const, value: { model: cpus()[0]!.model, logicalCount: cpus().length } } : { status: 'unavailable' as const, reason: 'OS returned no CPU information' }, gpu },
    browserProtocol: version, chromiumDownloadRevision: String(chromium.revision), playwrightVersion: JSON.parse(await readFile(require.resolve('playwright/package.json'), 'utf8')).version as string,
  };
}

export interface ComparisonEnvironmentCapture {
  readonly facts: CapturedEnvironment;
  recheckBeforeServing(): Promise<CapturedEnvironment>;
}
type ComparisonAuthority = ReturnType<typeof requireComparisonProvenanceSession>;
async function comparisonGuarded<T>(authority: ComparisonAuthority, operation: () => Promise<T>): Promise<T> {
  authority.lifecycle.assertActive(); const value = await operation(); authority.lifecycle.assertActive(); return value;
}
const sameNative = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
/** Internal fixed shape gate; no architecture table or executable digest. */
export function comparisonNativeHeaderSize(header: Buffer): number {
  if (header.length < 8) throw new Error('Short native Git header');
  if (header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    if (header[4] === 1) return 52;
    if (header[4] === 2) return 64;
  }
  const magic = header.subarray(0, 4).toString('hex');
  if (magic === 'feedface' || magic === 'cefaedfe') return 28;
  if (magic === 'feedfacf' || magic === 'cffaedfe') return 32;
  if (['cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(magic)) return 8;
  throw new Error('Git must be a native executable');
}
async function nativeGit(authority: ComparisonAuthority): Promise<string> {
  if (platform() !== 'darwin' && platform() !== 'linux') throw new Error('Required Windows Git identity is unsupported');
  const selected = '/usr/bin/git', canonical = await comparisonGuarded(authority, () => comparisonFs.realpath(selected));
  const ancestors: {path: string; stat: BigIntStats}[] = [];
  let parent = parsePath(canonical).root;
  const systemRoot = await comparisonGuarded(authority, () => comparisonFs.lstat(parent, {bigint: true}));
  if (!systemRoot.isDirectory() || systemRoot.isSymbolicLink()) throw new Error('Unsafe system Git root');
  ancestors.push({path: parent, stat: systemRoot});
  for (const part of relative(parent, dirname(canonical)).split(sep)) {
    if (part) parent = join(parent, part);
    const stat = await comparisonGuarded(authority, () => comparisonFs.lstat(parent, {bigint: true}));
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe system Git ancestor');
    ancestors.push({path: parent, stat});
  }
  const before = await comparisonGuarded(authority, () => comparisonFs.lstat(canonical, {bigint: true}));
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('Unsafe system Git executable');
  await comparisonGuarded(authority, () => comparisonFs.access(canonical, comparisonConstants.X_OK));
  authority.lifecycle.assertActive(); const fd = await comparisonFs.open(canonical, comparisonConstants.O_RDONLY | comparisonConstants.O_NOFOLLOW);
  let closePromise: Promise<void> | undefined;
  const resource: ComparisonOwnedResource = {name: 'comparison-native-git-header', close() {return closePromise ??= Promise.resolve().then(() => fd.close());}};
  let failure: unknown, failed = false;
  try {
    await authority.lifecycle.adopt(resource); // First continuation after open.
    if (!sameNative(await comparisonGuarded(authority, () => fd.stat({bigint: true})), before)) throw new Error('Native Git changed before header read');
    const read = async (buffer: Buffer, offset: number, end: number) => {
      while (offset < end) {const {bytesRead} = await comparisonGuarded(authority, () => fd.read(buffer, offset, end - offset, offset)); if (!bytesRead) throw new Error('Short native Git header'); offset += bytesRead;}
    };
    const first = Buffer.alloc(8); await read(first, 0, 8);
    const size = comparisonNativeHeaderSize(first);
    if (size > 8) {const header = Buffer.alloc(size); first.copy(header); await read(header, 8, size);}
    if (!sameNative(await comparisonGuarded(authority, () => fd.stat({bigint: true})), before)) throw new Error('Native Git changed during header read');
  } catch (error) {failed = true; failure = error;}
  try {await resource.close();} catch (error) {if (failed) throw new AggregateError([failure, error], 'Native Git acquisition and close failed'); throw error;}
  if (failed) throw failure;
  authority.lifecycle.assertActive();
  for (const row of ancestors) {const current = await comparisonGuarded(authority, () => comparisonFs.lstat(row.path, {bigint: true})); if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== row.stat.dev || current.ino !== row.stat.ino) throw new Error('System Git ancestor changed');}
  if (!sameNative(await comparisonGuarded(authority, () => comparisonFs.lstat(canonical, {bigint: true})), before) || await comparisonGuarded(authority, () => comparisonFs.realpath(selected)) !== canonical) throw new Error('System Git identity changed');
  return canonical;
}
async function comparisonGitFacts(authority: ComparisonAuthority): Promise<CapturedEnvironment['git']> {
  const executable = await nativeGit(authority);
  const prefix = ['--no-optional-locks', `--work-tree=${authority.originalRoot}`, '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false'];
  const env = {GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0'};
  authority.lifecycle.assertActive();
  const revisionChild = createObservedComparisonProcess(executable, [...prefix, 'rev-parse', '--verify', 'HEAD'], {cwd: authority.originalRoot, env}, authority.signal, {cap: 65});
  await authority.lifecycle.adopt(revisionChild.resource);
  const revision = (await comparisonGuarded(authority, () => revisionChild.result)).stdout;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})\n?$/.test(revision.toString('ascii')) || !Buffer.from(revision.toString('ascii'), 'ascii').equals(revision)) throw new Error('Git revision output differs from exact grammar');
  authority.lifecycle.assertActive();
  const statusChild = createObservedComparisonProcess(executable, [...prefix, 'status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none'], {cwd: authority.originalRoot, env}, authority.signal, {discard: true});
  await authority.lifecycle.adopt(statusChild.resource);
  const status = await comparisonGuarded(authority, () => statusChild.result);
  return {revision: revision.toString('ascii').replace(/\n$/, ''), dirty: status.dirty};
}
function comparisonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing original Playwright metadata'); return value as Record<string, unknown>;
}
const versionRequest = (session: CDPSession) => session.send('Browser.getVersion');
const commandRequest = (session: CDPSession) => session.send('Browser.getBrowserCommandLine');
const gpuRequest = (session: CDPSession) => session.send('SystemInfo.getInfo');
export async function collectComparisonEnvironment(session: ComparisonProvenanceSession, browserSession: CDPSession, purpose: 'publication' | 'conformance'): Promise<ComparisonEnvironmentCapture> {
  if (purpose !== 'publication' && purpose !== 'conformance') throw new Error('Unsupported comparison purpose');
  const authority = requireComparisonProvenanceSession(session);
  const serving = await authority.recheck(); authority.lifecycle.assertActive();
  const version = await comparisonGuarded(authority, () => versionRequest(browserSession));
  for (const key of ['protocolVersion', 'product', 'revision', 'userAgent', 'jsVersion'] as const) if (typeof version[key] !== 'string' || !version[key]) throw new Error('Browser omitted required protocol identity');
  const command = await comparisonGuarded(authority, () => commandRequest(browserSession));
  if (!Array.isArray(command.arguments) || command.arguments.some(value => typeof value !== 'string') || !command.arguments.includes('--enable-automation') || !command.arguments[0]) throw new Error('Browser omitted actual executable/automation identity');
  let gpu: CapturedEnvironment['environment']['gpu'] = {status: 'unavailable', reason: 'comparison-gpu-unavailable'};
  let gpuInfo: Awaited<ReturnType<typeof gpuRequest>> | undefined;
  try {gpuInfo = await comparisonGuarded(authority, () => gpuRequest(browserSession));}
  catch {authority.lifecycle.assertActive();}
  if (gpuInfo !== undefined) gpu = manifestSchema.shape.environment.shape.gpu.parse({status: 'available', value: gpuInfo.gpu});
  const playwrightPath = await authority.packageMetadataPath('playwright'), corePath = await authority.packageMetadataPath('playwright-core');
  if (!playwrightPath || !corePath) throw new Error('Original Playwright metadata is missing');
  const metadata = comparisonObject(JSON.parse((await authority.read(relative(authority.originalRoot, playwrightPath))).bytes.toString('utf8')));
  const core = comparisonObject(JSON.parse((await authority.read(relative(authority.originalRoot, corePath))).bytes.toString('utf8')));
  const root = comparisonObject(JSON.parse((await authority.read('package.json')).bytes.toString('utf8')));
  const lock = comparisonObject(JSON.parse((await authority.read('package-lock.json')).bytes.toString('utf8')));
  if (typeof metadata.version !== 'string' || !metadata.version || metadata.name !== 'playwright' || core.name !== 'playwright-core' || core.version !== metadata.version || comparisonObject(root.devDependencies).playwright !== metadata.version) throw new Error('Original Playwright direct pin differs');
  for (const [path, versionValue] of [[playwrightPath, metadata.version], [corePath, core.version]] as const) if (comparisonObject(comparisonObject(lock.packages)[relative(authority.originalRoot, dirname(path))]).version !== versionValue) throw new Error('Original Playwright lock differs');
  const downloads = comparisonObject(JSON.parse((await authority.read(relative(authority.originalRoot, join(dirname(corePath), 'browsers.json')))).bytes.toString('utf8')));
  if (!Array.isArray(downloads.browsers)) throw new Error('Original Chromium download inventory is missing');
  const chromium = downloads.browsers.map(comparisonObject).find(row => row.name === 'chromium');
  if (!chromium || !(typeof chromium.revision === 'string' && chromium.revision.length > 0 || typeof chromium.revision === 'number' && Number.isSafeInteger(chromium.revision) && chromium.revision >= 0)) throw new Error('Original Chromium download revision is missing');
  const git = await comparisonGitFacts(authority);
  if (purpose === 'publication' && git.dirty) throw new Error('Publication requires a clean original worktree');
  const cpu = cpus();
  const basic = manifestSchema.pick({git: true, assets: true, browser: true, environment: true}).parse({git, assets: serving.assets, browser: {executable: command.arguments[0], version: version.product, revision: version.revision, flags: command.arguments.slice(1)}, environment: {os: `${platform()} ${release()}`, architecture: arch(), cpu: cpu.length ? {status: 'available', value: {model: cpu[0]!.model, logicalCount: cpu.length}} : {status: 'unavailable', reason: 'comparison-cpu-unavailable'}, gpu}});
  const facts: CapturedEnvironment = {...basic, browserProtocol: {protocolVersion: version.protocolVersion, product: version.product, revision: version.revision, userAgent: version.userAgent, jsVersion: version.jsVersion}, playwrightVersion: metadata.version, chromiumDownloadRevision: String(chromium.revision)};
  const captured = structuredClone(facts); authority.lifecycle.assertActive();
  return Object.freeze({facts: structuredClone(captured), async recheckBeforeServing() {
    requireComparisonProvenanceSession(session); const current = await comparisonGitFacts(authority);
    if (current.revision !== captured.git.revision || purpose === 'publication' && current.dirty) throw new Error('Original Git state changed before serving');
    authority.lifecycle.assertActive(); return structuredClone({...captured, git: current});
  }});
}
