import { readFileSync, realpathSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const ownModules = resolve(root, 'node_modules') + sep;
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const require = createRequire(resolve(root, 'package.json'));
for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Dependency is not exactly pinned: ${name}`);
  const installedRoot = realpathSync(resolve(root, 'node_modules', name));
  const installed = JSON.parse(readFileSync(resolve(installedRoot, 'package.json'), 'utf8'));
  let path;
  try { path = realpathSync(require.resolve(name)); }
  catch (error) {
    // CSS-only and ambient-type packages have no Node runtime export.
    const target = installed.exports?.['.']?.style ?? (name.startsWith('@types/') ? installed.types ?? 'index.d.ts' : undefined);
    if (!target) throw error;
    path = realpathSync(resolve(installedRoot, target));
  }
  if (!path.startsWith(ownModules)) throw new Error(`Dependency escaped isolated node_modules: ${name}: ${path}`);
  const metadata = lock.packages[`node_modules/${name}`];
  if (!metadata || metadata.version !== version || installed.version !== version || !metadata.integrity) throw new Error(`Lock mismatch: ${name}`);
}
for (const key of Object.keys(lock.packages)) {
  if (!key) continue;
  if (!key.startsWith('node_modules/') || key.includes('..') || lock.packages[key].link) throw new Error(`External lock dependency: ${key}`);
  const path = resolve(root, key);
  if (existsSync(path) && !realpathSync(path).startsWith(ownModules)) throw new Error(`Dependency link escaped package: ${key}`);
}
// Reject workspace links even when their packages are not imported by the entry point.
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.bin') continue;
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink() && !realpathSync(path).startsWith(ownModules)) throw new Error(`External dependency symlink: ${path}`);
    if (entry.isDirectory() && (entry.name.startsWith('@') || directory.endsWith('node_modules'))) {
      if (entry.name.startsWith('@')) scan(path);
      else if (existsSync(resolve(path, 'node_modules'))) scan(resolve(path, 'node_modules'));
    }
  }
}
scan(resolve(root, 'node_modules'));
console.log('assistant-ui isolated dependency graph verified');
