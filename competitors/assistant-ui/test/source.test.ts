import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('copied stock renderer is a complete unmodified immutable source closure', () => {
  const path = resolve(root, 'source-manifest.json');
  assert.ok(existsSync(path), 'pinned official source manifest must exist');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.repository, 'https://github.com/assistant-ui/assistant-ui');
  const paths = new Set(manifest.files.map((file: any) => file.local));
  for (const file of manifest.files) {
    const content = readFileSync(resolve(root, file.local));
    assert.equal(createHash('sha256').update(content).digest('hex'), file.sha256, file.local);
    if (!file.local.endsWith('.tsx') && !file.local.endsWith('.ts')) continue;
    for (const match of content.toString().matchAll(/(?:from\s+|import\s*)["'](@\/[^"']+|\.[^"']+)["']/g)) {
      const base = match[1].startsWith('@/') ? resolve(root, 'src', match[1].slice(2)) : resolve(root, dirname(file.local), match[1]);
      assert.ok(['', '.tsx', '.ts', '/index.tsx', '/index.ts'].some((suffix) => existsSync(base + suffix)), `${file.local}: missing ${match[1]}`);
    }
  }
  assert.ok(paths.has('LICENSE.assistant-ui'));
  assert.ok(paths.has('src/official-globals.css'));
  assert.ok(paths.has('src/official-theme.css'));
  assert.ok(paths.has('src/components/assistant-ui/elements/thread.aui.tsx'));
});
