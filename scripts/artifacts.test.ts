import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, normalized, assertEqual, externalOutput } from './artifact-checks.mjs';
it('inventories every raw path and detects byte changes, additions and removals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'artifact-check-'));
  await mkdir(join(dir, 'nested'));
  await writeFile(join(dir, 'invocation.json'), '{}');
  for (const name of ['trace.json', 'manifest.json', 'page-observations.jsonl']) await writeFile(join(dir, 'nested', name), 'raw');
  await writeFile(join(dir, 'metrics.json'), '{}');
  const before = await inventory(dir, 'raw');
  expect(Object.keys(before)).toEqual(['invocation.json', 'nested/manifest.json', 'nested/page-observations.jsonl', 'nested/trace.json']);
  for (const name of ['trace.json', 'manifest.json', 'page-observations.jsonl']) {
    await writeFile(join(dir, 'nested', name), 'changed');
    expect(await inventory(dir, 'raw')).not.toEqual(before);
    await writeFile(join(dir, 'nested', name), 'raw');
  }
  await writeFile(join(dir, 'new-raw.json'), 'new');
  expect(await inventory(dir, 'raw')).not.toEqual(before);
  await unlink(join(dir, 'new-raw.json'));
  await unlink(join(dir, 'nested', 'trace.json'));
  expect(() => assertEqual(before, {}, 'raw')).toThrow('raw');
  expect(await inventory(dir, 'raw')).not.toEqual(before);
});
it('normalizes only recursive generatedAt and preserves array order', () => {
  expect(normalized({ generatedAt: 1, nested: { generatedAt: 2, value: 3 } })).toEqual({ nested: { value: 3 } });
  expect(() => assertEqual(normalized({ a: [1, 2] }), normalized({ a: [2, 1] }), 'derived')).toThrow();
});
it('rejects symlinks and outputs inside the artifact tree', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'artifact-link-'));
  await symlink(tmpdir(), join(dir, 'escape'));
  await expect(inventory(dir, 'raw')).rejects.toThrow('symlink');
  await expect(externalOutput(dir, join(dir, 'out.json'))).rejects.toThrow('outside');
});
