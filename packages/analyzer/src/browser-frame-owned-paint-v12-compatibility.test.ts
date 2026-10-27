import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Historical source identities are immutable compatibility inputs. The new
// policy has its own budget and does not repin or override any old profile.
const oldSourcePins = {
  "browser-frame-ordered-state": "264a70018bb978a2aec2058349ddde17135112b554db5cb7b5aff539623166d2",
  "browser-frame-packet-fragments": "bff8611ca4a6933461d00c4c108ac13afc0ae02356fc5b1bb6d4dc27de896909",
  "browser-frame-paint-timing-r-fragments": "dda657add676c3e08e419606ca4c0a7d85e18c8929c73cffe8fbcea5e0a83aaa",
  "browser-frame-protobuf-fragments": "f88b3233be5bff4b0abfe1cb7b4ede46080eeec27c340b43b7fdde3b753c6337",
  "browser-frame-protobuf-wire": "db48e75d1ddf63370b0302ec17447476d175440f86b08872ceee98e37dda8f3e",
  "browser-frame-state-fragments": "b1dce024aa8609430be3901e9f3e3503d53883d367e7ecf881ca4eca3816137d",
  "browser-frame-trace-framer": "a10bf3bc680c10a7ecc336196d61578617d8ee0ccbe569025e2b114564372aa4",
  "browser-frame-track-descriptor-fragments": "96ba204dce2c2172540dc143c417ba0609477015c65101c7999d5ea48de31ada",
  "browser-frame-track-event-fragments": "222da6353dd5f6d0b107227bf19ca63a764b131644823e85e6cff266e41e3c21",
  "browser-frame-whole-trace": "45580ce2ceb9ad12ce9dd5aa8531816ea7af3820396a2f1ab4d143b29642b13b"
} as const;
const runtimeModules = [
  'browser-frame-owned-paint-v12-budget', 'browser-frame-owned-paint-v12-kernel',
  'browser-frame-owned-paint-v12', 'browser-frame-owned-paint-v12-reader',
  'browser-frame-paint-packet-adapter', 'browser-frame-paint-timing-r-fragments',
  'browser-frame-ordered-state', 'browser-frame-whole-trace',
  'browser-frame-trace-framer', 'browser-frame-packet-fragments',
  'browser-frame-track-event-fragments', 'browser-frame-protobuf-fragments',
  'browser-frame-protobuf-wire', 'browser-frame-state-fragments',
  'browser-frame-track-descriptor-fragments',
] as const;
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');

test('V12 preserves the historical whole/state/packet source identities', () => {
  for (const [name, sha] of Object.entries(oldSourcePins))
    expect(hash(readFileSync(new URL(`./${name}.ts`, import.meta.url))), name).toBe(sha);
});

test('owned reader emitted runtime graph is exactly the reviewed fifteen modules', () => {
  const visited = new Set<string>();
  const builtins = new Set(['node:crypto', 'node:util', 'node:fs', 'node:path']);
  function visit(name: string) {
    if (visited.has(name)) return;
    expect(runtimeModules as readonly string[], `unexpected module ${name}`).toContain(name);
    visited.add(name);
    const source = readFileSync(new URL(`../dist/${name}.js`, import.meta.url), 'utf8');
    expect(source).not.toMatch(/\bimport\s*\(/);
    for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]!;
      if (specifier.startsWith('node:')) expect(builtins.has(specifier), specifier).toBe(true);
      else {
        expect(specifier).toMatch(/^\.\/[a-z0-9-]+\.js$/);
        visit(specifier.slice(2, -3));
      }
    }
  }
  visit('browser-frame-owned-paint-v12-reader');
  expect([...visited].sort()).toEqual([...runtimeModules].sort());
});

test('new owned policy and internal reader composition are absent from public package exports', () => {
  const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  expect(index + pkg).not.toContain('owned-paint-v12');
  expect(index + pkg).not.toContain('createOwnedPaintStudyV12ForReader');
});
