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

const stockIntegrities = {
  "chat": "sha512-XUwGLxixdIeraMZ2ncDnH0nsLujEzmS3WxakrVcREALUfz4nF27zwAiodpP1wOkQ7YOx9aSgwlikzD54qgZAzA==",
  "langgraph": "sha512-rE8dqILnjwLc/Cu1oxknsiJOEU4t7FlVUI78yuWyA4L411nYiKIu94tFOlYLnxfwrm2GSzd0tvHZn76xx5ZuMA==",
  "render": "sha512-jQz+JBbXD85YKNI6nKirMzRHL2mEmccnJkF6niemaXDk2tX9SK3lhnquR81+177ml7JS4OTYWhJLkYRcDVB7Tw==",
  "a2ui": "sha512-NVuiK9atHrCYufQlRwrbDcbVP/Ovfbt85XfnSXPage97CcdvMfjjMRxB4ZE3abwS1yhu5yi+53JBEzWfm1uiwA==",
  "telemetry": "sha512-nK76GH5WiwCUzkIwdF2J1PkQ0podtG5upXfCwyXjwZN/ZPw+ObU3C+r6wK1JW+pzIf0Zxuc+PoKMu5WFSoIykA=="
};

function fixture() {
  const root = { name: 'fixture', version: '1', workspaces: ['apps/*'], overrides: { vulnerable: '9.9.9' } };
  const app = { name: 'app', version: '1', private: true, scripts: { build: 'retained' }, dependencies: { safe: '9.9.9', ...Object.fromEntries(names.map((n) => [`@threadplane/${n}`, '0.3.4'])) } };
  const stock = { name: 'fixture', version: '1', lockfileVersion: 3, packages: { '': { name: root.name, version: root.version, workspaces: root.workspaces }, 'apps/threadplane': { name: app.name, version: app.version, dependencies: structuredClone(app.dependencies) }, 'node_modules/safe': { version: '9.9.9', integrity: 'security-fix' } } };
  for (const name of names) stock.packages[`apps/threadplane/node_modules/@threadplane/${name}`] = { version: '0.3.4', resolved: `https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.4.tgz`, integrity: stockIntegrities[name], peerDependencies: { '@threadplane/telemetry': '^0.3.4', safe: '^9' } };
  const legacy = structuredClone(stock);
  for (const name of names) {
    legacy.packages['apps/threadplane'].dependencies[`@threadplane/${name}`] = '0.3.2';
    Object.assign(legacy.packages[`apps/threadplane/node_modules/@threadplane/${name}`], { version: '0.3.2', resolved: `https://registry.npmjs.org/@threadplane/${name}/-/${name}-0.3.2.tgz`, integrity: integrities[name], peerDependencies: { '@threadplane/telemetry': '^0.3.2', safe: '^9' } });
  }
  legacy.threadplaneModifiedDependencies = { policy: 'stock034-to-modified032-v1', derivationBaseStockLockSHA: sha(json(stock)), rootManifestSHA: sha(json(root)) };
  return { rootManifestBytes: json(root), appManifestBytes: json(app), stockLockBytes: json(stock), legacyLockBytes: json(legacy), app, root, stock, legacy };
}

test('overlays exactly five pins and retains scripts, current security graph and root overrides', async () => {
  const { prepareStock034Selection } = await import('./select-stock034.mjs').catch(() => ({}));
  assert.equal(typeof prepareStock034Selection, 'function', 'stock034 preparation API must exist');
  const f = fixture();
  const result = prepareStock034Selection(f);
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
  ['wrong old chat version', (f) => { f.legacy.packages['apps/threadplane/node_modules/@threadplane/chat'].version = '0.3.4'; }],
  ['inconsistent selected workspace pins', (f) => { f.legacy.packages['apps/threadplane'].dependencies['@threadplane/chat'] = '0.3.4'; }],
  ['non-Threadplane graph mutation', (f) => { f.legacy.packages['node_modules/safe'].version = '1'; }],
  ['contradictory stock app manifest', (f) => { f.app.dependencies.safe = '1'; f.appManifestBytes = json(f.app); }],
  ['sixth Threadplane pin', (f) => { f.app.dependencies['@threadplane/extra'] = '0.3.4'; f.appManifestBytes = json(f.app); }],
]) test(`rejects ${name}`, async () => {
  const { prepareStock034Selection } = await import('./select-stock034.mjs');
  const f = fixture(); mutate(f); f.legacyLockBytes = json(f.legacy);
  assert.throws(() => prepareStock034Selection(f));
});

test('filesystem publication validates before writing and rejects an unfinished transaction', async () => {
  const { selectStock034Dependencies } = await import('./select-stock034.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'threadplane-selector-'));
  try {
    const f = fixture();
    await mkdir(join(dir, 'apps/threadplane'), { recursive: true });
    await mkdir(join(dir, 'tools/threadplane-modified-dependencies'), { recursive: true });
    for (const [path, bytes] of [['package.json', f.rootManifestBytes], ['package-lock.json', f.stockLockBytes], ['apps/threadplane/package.json', f.appManifestBytes], ['tools/threadplane-modified-dependencies/package-lock.stock034-to-modified032.json', f.legacyLockBytes]]) await writeFile(join(dir, path), bytes);
    await mkdir(join(dir, '.threadplane-modified-dependencies-selection'));
    await assert.rejects(selectStock034Dependencies(dir, 'fixture-checkout'));
    assert.equal(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8'), f.appManifestBytes);
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.stockLockBytes);
    await rm(join(dir, '.threadplane-modified-dependencies-selection'), { recursive: true });
    const wrongLegacy = structuredClone(f.legacy);
    wrongLegacy.packages['node_modules/safe'].version = '1';
    await writeFile(join(dir, 'tools/threadplane-modified-dependencies/package-lock.stock034-to-modified032.json'), json(wrongLegacy));
    await assert.rejects(selectStock034Dependencies(dir, 'fixture-checkout'));
    assert.equal(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8'), f.appManifestBytes);
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.stockLockBytes);
    await writeFile(join(dir, 'tools/threadplane-modified-dependencies/package-lock.stock034-to-modified032.json'), f.legacyLockBytes);
    const result = await selectStock034Dependencies(dir, 'fixture-checkout');
    assert.equal(result.checkoutSHA, 'fixture-checkout');
    assert.equal(await readFile(join(dir, 'package-lock.json'), 'utf8'), f.legacyLockBytes);
    assert.equal(JSON.parse(await readFile(join(dir, 'apps/threadplane/package.json'), 'utf8')).dependencies['@threadplane/chat'], '0.3.2');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

function refresh(f) {
  f.rootManifestBytes = json(f.root);
  f.appManifestBytes = json(f.app);
  f.stockLockBytes = json(f.stock);
  f.legacy.threadplaneModifiedDependencies = { policy: 'stock034-to-modified032-v1', derivationBaseStockLockSHA: sha(f.stockLockBytes), rootManifestSHA: sha(f.rootManifestBytes) };
  f.legacyLockBytes = json(f.legacy);
}

test('input bytes remain immutable and all output hashes bind exact bytes', async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const f = fixture(), before = structuredClone(f), result = prepareStock034Selection(f);
  assert.deepEqual(f, before);
  assert.equal(result.stockLockSHA, sha(f.stockLockBytes));
  assert.equal(result.rootManifestSHA, sha(f.rootManifestBytes));
  assert.equal(result.selectedLockSHA, sha(f.legacyLockBytes));
  assert.equal(result.overlaidManifestSHA, sha(result.appManifestBytes));
  for (const n of names) {
    assert.equal(JSON.parse(result.legacyLockBytes).packages[`apps/threadplane/node_modules/@threadplane/${n}`].integrity, integrities[n]);
  }
});

for (const version of ['0.3.3', '0.3.5', '^0.3.4']) test(`refuses source ${version}`, async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const f = fixture();
  for (const n of names) { f.app.dependencies[`@threadplane/${n}`] = version; f.stock.packages['apps/threadplane'].dependencies[`@threadplane/${n}`] = version; }
  refresh(f);
  assert.throws(() => prepareStock034Selection(f), /exact stock 0.3.4 pins/);
});
for (const [label, mutate] of [
  ['mixed source', f => { f.app.dependencies['@threadplane/chat'] = f.stock.packages['apps/threadplane'].dependencies['@threadplane/chat'] = '0.3.3'; }],
  ['missing pin', f => { delete f.app.dependencies['@threadplane/chat']; delete f.stock.packages['apps/threadplane'].dependencies['@threadplane/chat']; }],
  ['misplaced pin', f => { f.app.devDependencies = {'@threadplane/chat': '0.3.4'}; f.stock.packages['apps/threadplane'].devDependencies = f.app.devDependencies; }],
  ['wrong source integrity', f => { f.stock.packages['apps/threadplane/node_modules/@threadplane/chat'].integrity = 'forged'; }],
  ['wrong source URL', f => { f.stock.packages['apps/threadplane/node_modules/@threadplane/chat'].resolved = 'https://evil.invalid/chat.tgz'; }],
  ['unknown internal range', f => { f.stock.packages['apps/threadplane/node_modules/@threadplane/chat'].peerDependencies['@threadplane/telemetry'] = '~0.3.4'; }],
  ['wrong target URL', f => { f.legacy.packages['apps/threadplane/node_modules/@threadplane/chat'].resolved = 'https://evil.invalid/chat.tgz'; }],
  ['lock v2', f => { f.stock.lockfileVersion = 2; }],
  ['existing derivation metadata', f => { f.stock.threadplaneModifiedDependencies = {}; }],
  ['root workspace contradiction', f => { f.stock.packages[''].version = 'contradiction'; }],
]) test(`refuses ${label} with fresh derivation hashes`, async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const f = fixture(); mutate(f); refresh(f);
  assert.throws(() => prepareStock034Selection(f));
});
for (const [label, mutate] of [
  ['old envelope', f => { delete f.legacy.threadplaneModifiedDependencies.policy; }],
  ['extra envelope key', f => { f.legacy.threadplaneModifiedDependencies.extra = true; }],
  ['wrong policy', f => { f.legacy.threadplaneModifiedDependencies.policy = 'stock033-to-modified032-v1'; }],
  ['root raw byte drift', f => { f.rootManifestBytes += '\n'; }],
]) test(`refuses ${label}`, async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const f = fixture(); mutate(f); f.legacyLockBytes = json(f.legacy);
  assert.throws(() => prepareStock034Selection(f));
});

test('unchanged old selector refuses stock034 source even with its own envelope', async () => {
  const {prepareSelection} = await import('./select.mjs');
  const f = fixture(); delete f.legacy.threadplaneModifiedDependencies.policy; f.legacyLockBytes = json(f.legacy);
  assert.throws(() => prepareSelection(f), /exact stock 0.3.3 pins/);
});

async function checkout(f) {
  const dir = await mkdtemp(join(tmpdir(), 'threadplane-stock034-selector-'));
  await mkdir(join(dir, 'apps/threadplane'), {recursive:true});
  await mkdir(join(dir, 'tools/threadplane-modified-dependencies'), {recursive:true});
  for (const [path, bytes] of [['package.json',f.rootManifestBytes],['package-lock.json',f.stockLockBytes],['apps/threadplane/package.json',f.appManifestBytes],['tools/threadplane-modified-dependencies/package-lock.stock034-to-modified032.json',f.legacyLockBytes]]) await writeFile(join(dir,path),bytes);
  return dir;
}

test('refuses a null preexisting selection envelope', async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const f = fixture(); f.stock.threadplaneModifiedDependencies = null; refresh(f);
  f.legacy.threadplaneModifiedDependencies = {...f.legacy.threadplaneModifiedDependencies}; f.legacyLockBytes=json(f.legacy);
  assert.throws(() => prepareStock034Selection(f), /unselected stock/);
});

test('missing dedicated stock034 lock refuses without writes or subsequent installation', async () => {
  const {selectStock034Dependencies} = await import('./select-stock034.mjs');
  const f = fixture(), dir = await checkout(f); let installs=0;
  try {
    await rm(join(dir,'tools/threadplane-modified-dependencies/package-lock.stock034-to-modified032.json'));
    await assert.rejects(async () => {await selectStock034Dependencies(dir,'checkout'); installs++;});
    assert.equal(installs,0);
    assert.equal(await readFile(join(dir,'package.json'),'utf8'),f.rootManifestBytes);
    assert.equal(await readFile(join(dir,'apps/threadplane/package.json'),'utf8'),f.appManifestBytes);
    assert.equal(await readFile(join(dir,'package-lock.json'),'utf8'),f.stockLockBytes);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('simultaneous selectors have one exclusive owner and never rewrite root manifest', async () => {
  const {selectStock034Dependencies} = await import('./select-stock034.mjs');
  const f=fixture(), dir=await checkout(f);
  try {
    const results = await Promise.allSettled([selectStock034Dependencies(dir,'one'),selectStock034Dependencies(dir,'two')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.equal(await readFile(join(dir,'package.json'),'utf8'),f.rootManifestBytes);
    assert.equal(await readFile(join(dir,'package-lock.json'),'utf8'),f.legacyLockBytes);
  } finally {await rm(dir,{recursive:true,force:true});}
});

for (const rollbackFails of [false,true]) test(`second publication failure restores app or retains failed rollback (${rollbackFails})`, async () => {
  const {selectStock034Dependencies} = await import('./select-stock034.mjs');
  const {default:fs} = await import('node:fs'); const {syncBuiltinESMExports}=await import('node:module');
  const f=fixture(),dir=await checkout(f), original=fs.promises.rename; let installs=0;
  try {
    fs.promises.rename=async (from,to) => {
      if (from===join(dir,'.threadplane-modified-dependencies-selection/lock.json')) throw Error('controlled second publication failure');
      if (rollbackFails && from===join(dir,'.threadplane-modified-dependencies-selection/original-app.json')) throw Error('controlled rollback failure');
      return original(from,to);
    };
    syncBuiltinESMExports();
    await assert.rejects(async()=>{await selectStock034Dependencies(dir,'checkout');installs++;},rollbackFails?/rollback failed; transaction retained/:/controlled second publication failure/);
    assert.equal(installs,0);
    assert.equal(await readFile(join(dir,'package-lock.json'),'utf8'),f.stockLockBytes);
    assert.equal(await readFile(join(dir,'package.json'),'utf8'),f.rootManifestBytes);
    if (rollbackFails) {
      assert.equal(await readFile(join(dir,'.threadplane-modified-dependencies-selection/original-app.json'),'utf8'),f.appManifestBytes);
      assert.equal(JSON.parse(await readFile(join(dir,'apps/threadplane/package.json'),'utf8')).dependencies['@threadplane/chat'],'0.3.2');
      await assert.rejects(selectStock034Dependencies(dir,'retry'),/EEXIST/);
    } else {
      assert.equal(await readFile(join(dir,'apps/threadplane/package.json'),'utf8'),f.appManifestBytes);
      await assert.rejects(readFile(join(dir,'.threadplane-modified-dependencies-selection/original-app.json')),/ENOENT/);
    }
  } finally {fs.promises.rename=original;syncBuiltinESMExports();await rm(dir,{recursive:true,force:true});}
});

test('committed stock034 lock and dedicated derivation satisfy the fixed policy without publication', async () => {
  const {prepareStock034Selection} = await import('./select-stock034.mjs');
  const [rootManifestBytes,appManifestBytes,stockLockBytes,legacyLockBytes]=await Promise.all([
    readFile(new URL('../../package.json',import.meta.url),'utf8'),
    readFile(new URL('../../apps/threadplane/package.json',import.meta.url),'utf8'),
    readFile(new URL('../../package-lock.json',import.meta.url),'utf8'),
    readFile(new URL('./package-lock.stock034-to-modified032.json',import.meta.url),'utf8'),
  ]);
  const result=prepareStock034Selection({rootManifestBytes,appManifestBytes,stockLockBytes,legacyLockBytes});
  assert.equal(result.selectedLockSHA,sha(legacyLockBytes));
  assert.equal(result.stockLockSHA,sha(stockLockBytes));
  assert.deepEqual(JSON.parse(result.legacyLockBytes).threadplaneModifiedDependencies,{
    policy:'stock034-to-modified032-v1',derivationBaseStockLockSHA:sha(stockLockBytes),rootManifestSHA:sha(rootManifestBytes),
  });
});
