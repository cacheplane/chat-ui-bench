import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'generatedAt').map(([key, child]) => [key, normalized(child)]));
  return value;
}
export function assertEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} mismatch`);
}
export async function artifactDirectory(path) {
  if (!path || !isAbsolute(path)) throw new Error('--artifact-dir must be an absolute existing directory');
  if ((await lstat(path)).isSymbolicLink()) throw new Error('Artifact directory must not be a symlink');
  if (!(await lstat(path)).isDirectory()) throw new Error('Artifact path is not a directory');
  return realpath(path);
}
export async function inventory(directory, kind) {
  const entries = [];
  async function walk(path) {
    for (const name of (await readdir(path)).sort()) {
      const full = join(path, name), stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error(`Unsupported artifact symlink: ${full}`);
      if (stat.isDirectory()) await walk(full);
      else if (stat.isFile()) entries.push(full);
      else throw new Error(`Unsupported artifact file: ${full}`);
    }
  }
  await walk(directory);
  const result = {};
  for (const path of entries.sort()) {
    const derived = ['metrics.json', 'summary.md'].includes(basename(path));
    if ((kind === 'raw') === derived) continue;
    result[relative(directory, path)] = kind === 'raw' ? await sha256(path) : basename(path) === 'metrics.json' ? normalized(JSON.parse(await readFile(path, 'utf8'))) : await readFile(path, 'utf8');
  }
  return result;
}
export async function externalOutput(directory, path) {
  if (!path || !isAbsolute(path)) throw new Error('--out must be an absolute external file');
  const parent = await realpath(dirname(path)), destination = join(parent, basename(path));
  const rel = relative(await realpath(directory), destination);
  if (!rel || (!rel.startsWith('../') && !isAbsolute(rel))) throw new Error('--out must be outside the artifact directory');
  try { if ((await lstat(destination)).isSymbolicLink()) throw new Error('Output must not be a symlink'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return resolve(destination);
}
export function argumentsFor(argv, flags) {
  if (argv.length !== flags.length * 2) throw new Error(`Usage: ${flags.map(flag => `${flag} absolutePath`).join(' ')}`);
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!flags.includes(argv[i]) || result[argv[i]]) throw new Error('Unknown or duplicate option');
    result[argv[i]] = argv[i + 1];
  }
  if (flags.some(flag => !result[flag])) throw new Error('Missing option');
  return result;
}
