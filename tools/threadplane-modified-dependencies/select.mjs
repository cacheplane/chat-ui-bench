import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Registry integrities from reviewed baseline df05817b02c6408d205a618b4babc05bc7693c70.
// That baseline supplies package identity only, never the current dependency graph.
const integrities = {
  a2ui: 'sha512-KquGMp7QD2rr0VdMNJBJm/pCoHG/mvrcknSphXyqiB+y2SLdxP8L/XFjzYntMBHQk1nub0bY28EytDGfxmX5Eg==',
  chat: 'sha512-htsWljhDogT6fOsmZrOvC+wFDRPhiQR/rvfwTJ2dYd/H6MiwPm3twxSr+KdNbaNRnARb62kUvPaigm0VA3cuGw==',
  langgraph: 'sha512-aSGuZbn9dmOFUzGbLIXv5sjjMRqWZ2x4FYr388ouaE+18AmEWDu8FqItURyNOTd3RjUPUs/tdy9HdrKyJeGC/A==',
  render: 'sha512-xZOzi/YGXPl3bQaqo+QQ+uroNO4duNGlv/y8V2I289z3YnJP4VoHkl1T3eK89UQ4KiCp4tpRpWwCSeHFNYowWw==',
  telemetry: 'sha512-mp7pHxZhD+2iMeiyIqzMtghDNEBulxcY93sKdIy/2/rJNiBmZ07msZaTgM7X1fJtjq45vuzhnga5Tk2g2XxMLg==',
};
const names = Object.keys(integrities).map((n) => `@threadplane/${n}`);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (a, b, message) => ensure(isDeepStrictEqual(a, b), message);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function checkManifest(manifest, entry, label) {
  ensure(entry, `Missing ${label} lock workspace`);
  for (const key of ['name', 'version', 'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'engines', 'workspaces']) {
    equal(manifest[key], entry[key], `${label} manifest contradicts stock lock: ${key}`);
  }
}

export function prepareSelection({ rootManifestBytes, appManifestBytes, stockLockBytes, legacyLockBytes }) {
  const root = JSON.parse(rootManifestBytes);
  const app = JSON.parse(appManifestBytes);
  const stock = JSON.parse(stockLockBytes);
  const legacy = JSON.parse(legacyLockBytes);
  const stockLockSHA = sha(stockLockBytes);
  const rootManifestSHA = sha(rootManifestBytes);
  equal(legacy.threadplaneModifiedDependencies, { derivationBaseStockLockSHA: stockLockSHA, rootManifestSHA }, 'Stale legacy derivation: current stock lock/root manifest hashes differ');
  ensure(stock.lockfileVersion === 3 && !stock.threadplaneModifiedDependencies, 'Expected unselected stock lock v3');
  checkManifest(root, stock.packages?.[''], 'root');
  checkManifest(app, stock.packages?.['apps/threadplane'], 'Threadplane app');
  const pins = Object.entries(app.dependencies ?? {}).filter(([name]) => name.startsWith('@threadplane/'));
  equal(pins.map(([name]) => name).sort(), [...names].sort(), 'Expected exactly five Threadplane app pins');
  ensure(pins.every(([, version]) => version === '0.3.3'), 'Expected exact stock 0.3.3 pins');
  for (const key of ['devDependencies', 'optionalDependencies', 'peerDependencies']) ensure(!Object.keys(app[key] ?? {}).some((n) => n.startsWith('@threadplane/')), `Unexpected Threadplane ${key}`);
  const expected = structuredClone(stock);
  for (const name of names) {
    app.dependencies[name] = '0.3.2';
    expected.packages['apps/threadplane'].dependencies[name] = '0.3.2';
    const path = `apps/threadplane/node_modules/${name}`;
    const entry = expected.packages[path];
    const shortName = name.split('/')[1];
    ensure(entry?.version === '0.3.3' && entry.resolved === `https://registry.npmjs.org/${name}/-/${shortName}-0.3.3.tgz`, `Unexpected stock identity: ${path}`);
    entry.version = '0.3.2';
    entry.resolved = `https://registry.npmjs.org/${name}/-/${shortName}-0.3.2.tgz`;
    entry.integrity = integrities[shortName];
    for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [peer, range] of Object.entries(entry[key] ?? {})) {
        if (names.includes(peer)) {
          ensure(['0.3.3', '^0.3.3'].includes(range), `Unexpected stock Threadplane relationship: ${peer}`);
          entry[key][peer] = range.replace('0.3.3', '0.3.2');
        }
      }
    }
  }
  expected.threadplaneModifiedDependencies = { derivationBaseStockLockSHA: stockLockSHA, rootManifestSHA };
  equal(legacy, expected, 'Legacy lock differs from permitted five-package substitution (version, integrity, workspace pins or unrelated graph)');
  const overlaid = json(app);
  return { appManifestBytes: overlaid, legacyLockBytes, stockLockSHA, rootManifestSHA, selectedLockSHA: sha(legacyLockBytes), overlaidManifestSHA: sha(overlaid), pins: Object.fromEntries(names.map((name) => [name, '0.3.2'])) };
}

async function regularFile(root, relative) {
  const parts = relative.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const info = await lstat(join(root, ...parts.slice(0, i)));
    ensure(i === parts.length ? info.isFile() : info.isDirectory(), `Expected owned regular path: ${relative}`);
  }
  return readFile(join(root, relative), 'utf8');
}

export async function selectDependencies(root, checkoutSHA) {
  root = resolve(root);
  const transaction = join(root, '.threadplane-modified-dependencies-selection');
  // Exclusive ownership also prevents accepting a previous interrupted publication.
  await mkdir(transaction, { mode: 0o700 });
  let keepTransaction = false;
  try {
    const [rootManifestBytes, appManifestBytes, stockLockBytes, legacyLockBytes] = await Promise.all([
      regularFile(root, 'package.json'), regularFile(root, 'apps/threadplane/package.json'),
      regularFile(root, 'package-lock.json'), regularFile(root, 'tools/threadplane-modified-dependencies/package-lock.legacy.json'),
    ]);
    const result = prepareSelection({ rootManifestBytes, appManifestBytes, stockLockBytes, legacyLockBytes });
    // Stage and validate everything before publishing either destination. Files
    // are created exclusively in our transaction directory on the same filesystem.
    await writeFile(join(transaction, 'original-app.json'), appManifestBytes, { flag: 'wx' });
    await writeFile(join(transaction, 'app.json'), result.appManifestBytes, { flag: 'wx' });
    await writeFile(join(transaction, 'lock.json'), result.legacyLockBytes, { flag: 'wx' });
    // Refuse changed inputs between validation and publication.
    equal(await regularFile(root, 'apps/threadplane/package.json'), appManifestBytes, 'App changed during selection');
    equal(await regularFile(root, 'package-lock.json'), stockLockBytes, 'Stock lock changed during selection');
    equal(await regularFile(root, 'package.json'), rootManifestBytes, 'Root manifest changed during selection');
    await rename(join(transaction, 'app.json'), join(root, 'apps/threadplane/package.json'));
    try {
      await rename(join(transaction, 'lock.json'), join(root, 'package-lock.json'));
    } catch (error) {
      try { await rename(join(transaction, 'original-app.json'), join(root, 'apps/threadplane/package.json')); }
      catch (rollbackError) { keepTransaction = true; throw new AggregateError([error, rollbackError], 'Selection failed; rollback failed; transaction retained. Restore the stock checkout before retrying.'); }
      throw error;
    }
    return { checkoutSHA, stockLockSHA: result.stockLockSHA, rootManifestSHA: result.rootManifestSHA, selectedLockSHA: result.selectedLockSHA, overlaidManifestSHA: result.overlaidManifestSHA, pins: result.pins };
  } finally {
    // An interrupted process leaves this directory behind and the next run fails
    // closed. npm ci also rejects a half-selected manifest/lock pair.
    if (!keepTransaction) await rm(transaction, { recursive: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const checkoutSHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  console.log(JSON.stringify(await selectDependencies(root, checkoutSHA), null, 2));
}
