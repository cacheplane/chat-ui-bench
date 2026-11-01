import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
test('package dependency graph is isolated under its own physical node_modules', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-isolation.mjs'], { encoding: 'utf8', cwd: new URL('..', import.meta.url) });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /isolated dependency graph verified/);
});
