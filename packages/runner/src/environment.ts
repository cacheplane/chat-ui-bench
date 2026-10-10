import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus, arch, platform, release } from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { CDPSession } from 'playwright';
import type { Manifest } from '@chat-ui-bench/contract';
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
