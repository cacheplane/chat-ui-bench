import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const names = ['a2ui', 'chat', 'langgraph', 'render', 'telemetry'];
const integrities = {
  a2ui: 'sha512-KquGMp7QD2rr0VdMNJBJm/pCoHG/mvrcknSphXyqiB+y2SLdxP8L/XFjzYntMBHQk1nub0bY28EytDGfxmX5Eg==',
  chat: 'sha512-htsWljhDogT6fOsmZrOvC+wFDRPhiQR/rvfwTJ2dYd/H6MiwPm3twxSr+KdNbaNRnARb62kUvPaigm0VA3cuGw==',
  langgraph: 'sha512-aSGuZbn9dmOFUzGbLIXv5sjjMRqWZ2x4FYr388ouaE+18AmEWDu8FqItURyNOTd3RjUPUs/tdy9HdrKyJeGC/A==',
  render: 'sha512-xZOzi/YGXPl3bQaqo+QQ+uroNO4duNGlv/y8V2I289z3YnJP4VoHkl1T3eK89UQ4KiCp4tpRpWwCSeHFNYowWw==',
  telemetry: 'sha512-mp7pHxZhD+2iMeiyIqzMtghDNEBulxcY93sKdIy/2/rJNiBmZ07msZaTgM7X1fJtjq45vuzhnga5Tk2g2XxMLg==',
};

function fixture() {
  const root = { name: 'fixture', version: '1', workspaces: ['apps/*'], overrides: { vulnerable: '9.9.9' } };
  const app = { name: 'app', version: '1', private: true, scripts: { build: 'retained' }, dependencies: { safe: '9.9.9', ...Object.fromEntries(names.map((n) => [`@threadplane/${n}`, '0.3.3'])) } };
  const stock = { name: 'fixture', version: '1', lockfileVersion: 3, packages: { '': { name: root.name, version: root.version, workspaces: root.workspaces }, 'apps/threadplane': { name: app.name, version: app.version, dependencies: structuredClone(app.dependencies) }, 'node_modules/safe': { version: '9.9.9', integrity: 'security-fix' } } };
  for (const name of names) stock.packages[`apps/threadplane/node_modules/@threadplane/${name}`] = { version: '0.3.3', resolved: `https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.3.tgz`, integrity: 'stock', peerDependencies: { '@threadplane/telemetry': '^0.3.3', safe: '^9' } };
  const legacy = structuredClone(stock);
  for (const name of names) {
    legacy.packages['apps/threadplane'].dependencies[`@threadplane/${name}`] = '0.3.2';
    Object.assign(legacy.packages[`apps/threadplane/node_modules/@threadplane/${name}`], { version: '0.3.2', resolved: `https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.2.tgz`, integrity: integrities[name], peerDependencies: { '@threadplane/telemetry': '^0.3.2', safe: '^9' } });
  }
  legacy.threadplaneModifiedDependencies = { derivationBaseStockLockSHA: sha(json(stock)), rootManifestSHA: sha(json(root)) };
  return { rootManifestBytes: json(root), appManifestBytes: json(app), stockLockBytes: json(stock), legacyLockBytes: json(legacy), app, root, stock, legacy };
}

test('overlays exactly five pins and retains scripts, current security graph and root overrides', async () => {
  const { prepareSelection } = await import('./select.mjs');
  const f = fixture();
  const result = prepareSelection(f);
  const app = JSON.parse(result.appManifestBytes);
  assert.deepEqual(app.scripts, f.app.scripts);
  assert.equal(app.dependencies.safe, '9.9.9');
  assert.equal(Object.keys(app.dependencies).length, 6);
  for (const n of names) assert.equal(app.dependencies[`@threadplane/${n}`], '0.3.2');
  assert.deepEqual(JSON.parse(result.legacyLockBytes).packages['node_modules/safe'], f.stock.packages['node_modules/safe']);
  assert.equal(result.rootManifestSHA, sha(f.rootManifestBytes));
  assert.equal(f.root.overrides.vulnerable, '9.9.9');
});

for (const [name, mutate] of [
  ['stale stock lock', (f) => { f.stockLockBytes += '\n'; }],
  ['changed security overrides', (f) => { const r = JSON.parse(f.rootManifestBytes); r.overrides.vulnerable = '1'; f.rootManifestBytes = json(r); }],
  ['wrong old chat integrity', (f) => { f.legacy.packages['apps/threadplane/node_modules/@threadplane/chat'].integrity = 'forged'; }],
  ['wrong old chat version', (f) => { f.legacy.packages['apps/threadplane/node_modules/@threadplane/chat'].version = '0.3.3'; }],
  ['inconsistent selected workspace pins', (f) => { f.legacy.packages['apps/threadplane'].dependencies['@threadplane/chat'] = '0.3.3'; }],
  ['non-Threadplane graph mutation', (f) => { f.legacy.packages['node_modules/safe'].version = '1'; }],
  ['contradictory stock app manifest', (f) => { f.app.dependencies.safe = '1'; f.appManifestBytes = json(f.app); }],
  ['sixth Threadplane pin', (f) => { f.app.dependencies['@threadplane/extra'] = '0.3.3'; f.appManifestBytes = json(f.app); }],
]) test(`rejects ${name}`, async () => {
  const { prepareSelection } = await import('./select.mjs');
  const f = fixture(); mutate(f); f.legacyLockBytes = json(f.legacy);
  assert.throws(() => prepareSelection(f));
});

test('filesystem publication validates before writing and rejects an unfinished transaction', async () => {
  const { selectDependencies } = await import('./select.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'threadplane-selector-'));
  try {
    const f = fixture();
    await mkdir(join(dir, 'apps/threadplane'), { recursive: true });
    await mkdir(join(dir, 'tools/threadplane-modified-dependencies'), { recursive: true });
    for (const [path, bytes] of [['package.json', f.rootManifestBytes], ['package-lock.json', f.stockLockBytes], ['apps/threadplane/package.json', f.appManifestBytes], ['tools/threadplane-modified-dependencies/package-lock.legacy.json', f.legacyLockBytes]]) await writeFile(join(dir, path), bytes);
    await mkdir(join(dir, '.threadplane-modified-dependencies-selection'));
    await assert.rejects(selectDependencies(dir, 'fixture-checkout'));
    assert.equal(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8'), f.appManifestBytes);
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.stockLockBytes);
    await rm(join(dir, '.threadplane-modified-dependencies-selection'), { recursive: true });
    const wrongLegacy = structuredClone(f.legacy);
    wrongLegacy.packages['node_modules/safe'].version = '1';
    await writeFile(join(dir, 'tools/threadplane-modified-dependencies/package-lock.legacy.json'), json(wrongLegacy));
    await assert.rejects(selectDependencies(dir, 'fixture-checkout'));
    assert.equal(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8'), f.appManifestBytes);
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.stockLockBytes);
    await writeFile(join(dir, 'tools/threadplane-modified-dependencies/package-lock.legacy.json'), f.legacyLockBytes);
    const result = await selectDependencies(dir, 'fixture-checkout');
    assert.equal(result.checkoutSHA, 'fixture-checkout');
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.legacyLockBytes);
    assert.equal(JSON.parse(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8')).dependencies['@threadplane/chat'], '0.3.2');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
