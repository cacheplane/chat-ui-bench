import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const source = fileURLToPath(new URL('./', import.meta.url));
const files = new Set([
  'matrix-diagnostics-v1.node.mjs', 'matrix-diagnostics-v1.mjs',
  'matrix-policy-v3.mjs', 'matrix-admission-v3.mjs', 'matrix-run-v3.mjs',
  'fixtures', 'fixtures/matrix-run-v3-pre-diagnostics.source.txt',
]);

test('all 14 original diagnostics controls run in an isolated directory without Git history', async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), 'matrix-diagnostics-no-git-'));
  try {
    const comparison = path.join(directory, 'tools/competitor-comparison');
    await fs.cp(source, comparison, {
      recursive: true,
      filter: entry => entry === source.slice(0, -1) || entry === source || files.has(path.relative(source, entry)),
    });
    const context = path.join(directory, 'competitors/shared/context.mjs');
    await fs.mkdir(path.dirname(context), { recursive: true });
    await fs.copyFile(new URL('../../competitors/shared/context.mjs', import.meta.url), context);
    await assert.rejects(fs.access(path.join(directory, '.git')), { code: 'ENOENT' });
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    delete env.NODE_TEST_CONTEXT;
    const result = await exec(process.execPath, [
      '--test', '--test-concurrency=1', '--test-reporter=spec',
      'tools/competitor-comparison/matrix-diagnostics-v1.node.mjs',
    ], { cwd: directory, env, timeout: 30_000, maxBuffer: 131_072 });
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /tests 14\b/);
    assert.match(result.stdout, /pass 14\b/);
    assert.match(result.stdout, /fail 0\b/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
