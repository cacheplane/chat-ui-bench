import { afterAll, beforeAll, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Synthetic state ports exercise original installed methods, not browser layout
// or React. The retained numeric example below grants no hosted object identity.
const modules = new URL('../node_modules/', import.meta.url);
const core = new URL('@tanstack/virtual-core/', modules);
const copilot = new URL('@copilotkit/react-core/', modules);
const index = new URL('dist/esm/index.js', core);
const pins: readonly [URL, number, string][] = [
  [index, 54156, '06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09'],
  [new URL('dist/esm/lazy-measurements.js', core), 1052, '99b8ef4dc023f5249b8c6c0c164abd2d5793a369b83795c2559ef83069643672'],
  [new URL('dist/esm/utils.js', core), 2545, 'c1cee1b5f7f1cff7e20bd074dcc38b70f4774924f00bb674c0e226089f8d8279'],
  [new URL('dist/copilotkit-DgJj6xa0.mjs', copilot), 509399, '2067b06183e89b1399dbbd894f03d1c541d4f14b4cd62be717d10c01849969a6'],
];
const predicateExcerpt = `const shouldAdjustScrollOnResize = React.useCallback((item, _delta, instance) => {
\t\tif (isPinnedToBottomRef.current) return false;
\t\tconst scrollAdjustments = instance.scrollAdjustments ?? 0;
\t\treturn item.start < (instance.scrollOffset ?? 0) + scrollAdjustments;
\t}, []);`;

async function assertPins() {
  for (const [root, name, version] of [[core, '@tanstack/virtual-core', '3.19.4'], [copilot, '@copilotkit/react-core', '1.78.0']] as const) {
    const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
    expect(metadata.name).toBe(name);
    expect(metadata.version).toBe(version);
  }
  for (const [path, bytes, hash] of pins) {
    const source = await readFile(path);
    expect(source.byteLength).toBe(bytes);
    expect(createHash('sha256').update(source).digest('hex')).toBe(hash);
  }
  const source = await readFile(new URL('dist/copilotkit-DgJj6xa0.mjs', copilot), 'utf8');
  expect(source.split(predicateExcerpt)).toHaveLength(2);
}

async function importOriginal() { return import(index.href); }
let vendor: Awaited<ReturnType<typeof importOriginal>>;
beforeAll(async () => {
  await assertPins();
  vendor = await importOriginal();
});
afterAll(assertPins);

type Scenario = {
  index?: number; start?: number; old?: number; size?: number; offset?: number;
  remeasure?: boolean; predicate?: 'default' | 'copilot'; pinned?: boolean;
  pending?: boolean; direction?: 'forward' | 'backward';
};
type Result = { calls: unknown[]; first: boolean; offset: number; cacheSize: number | undefined };

function runScenario({ index = 0, start = 0, old = 10, size = 15, offset = 100,
  remeasure = false, predicate = 'default', pinned = false, pending = false,
  direction = 'backward' }: Scenario = {}): Result {
  const calls: unknown[] = [];
  const instance = new vendor.Virtualizer({
    count: index + 2, estimateSize: () => old, getScrollElement: () => null,
    scrollToFn: vendor.elementScroll,
    onChange: (_: unknown, sync: boolean) => calls.push(['notify', sync]),
  });
  const owner = {
    scrollTo(this: unknown, value: { top: number; behavior: unknown }): void {
      expect(this).toBe(owner);
      expect(Reflect.ownKeys(value)).toEqual(['top', 'behavior']);
      calls.push(['delegate', value]);
    },
  };
  instance.scrollOffset = offset;
  instance.scrollDirection = direction;
  instance.scrollElement = owner;
  // Estimated geometry exists in both branches. Only a measured cache entry
  // distinguishes remeasurement from the first estimate-to-actual correction.
  instance.measurementsCache[index] = { index, key: index, start, size: old, end: start + old, lane: 0 };
  if (remeasure) instance.itemSizeCache.set(index, old);
  if (predicate === 'copilot') {
    // Exact source-equivalent body checked above; the real React ref is not run.
    const isPinnedToBottomRef = { current: pinned };
    instance.shouldAdjustScrollPositionOnItemSizeChange = (
      item: { start: number }, _delta: number,
      instance: { scrollAdjustments?: number; scrollOffset?: number },
    ) => {
      if (isPinnedToBottomRef.current) return false;
      const scrollAdjustments = instance.scrollAdjustments ?? 0;
      return item.start < (instance.scrollOffset ?? 0) + scrollAdjustments;
    };
  }
  if (pending) {
    instance.scrollState = { index: 0 };
    instance.pendingWrite = { target: offset + 50, smooth: false, adjustments: 0 };
  }
  const first = !instance.itemSizeCache.has(index);
  instance.resizeItem(index, size);
  return { calls, first, offset: instance.scrollOffset, cacheSize: instance.itemSizeCache.get(index) };
}

const applying: readonly [string, Scenario, number][] = [
  ['generic first/default/backward', {}, 105],
  ['generic first/Copilot-equivalent/backward', { predicate: 'copilot' }, 105],
  ['retained117 first/default/backward', { index: 81, start: 15149, old: 199, size: 316, offset: 16707 }, 16824],
  ['retained117 first/Copilot-equivalent/backward', { index: 81, start: 15149, old: 199, size: 316, offset: 16707, predicate: 'copilot' }, 16824],
  ['negative first/default/backward', { size: 5 }, 95],
  ['remeasure default forward', { remeasure: true, direction: 'forward' }, 105],
  ['remeasure Copilot-equivalent backward', { remeasure: true, predicate: 'copilot' }, 105],
  ['fold-spanning first/default', { start: 95 }, 105],
  ['fold-spanning remeasure/Copilot-equivalent', { start: 95, remeasure: true, predicate: 'copilot' }, 105],
];
for (const [name, options, target] of applying) test(name, () => {
  const result = runScenario(options);
  expect(result.calls).toEqual([['delegate', { top: target, behavior: undefined }], ['notify', true]]);
  expect(result.offset).toBe(target);
  expect(result.first).toBe(!options.remeasure);
  expect(result.cacheSize).toBe(options.size ?? 15);
});

const suppressed: readonly [string, Scenario][] = [
  ['remeasure default backward', { remeasure: true }],
  ['fold-spanning remeasure/default', { start: 95, remeasure: true, direction: 'forward' }],
  ['pinned-bottom Copilot-equivalent', { predicate: 'copilot', pinned: true }],
  ['pending original command suppresses applying an adjustment', { predicate: 'copilot', pending: true }],
];
for (const [name, options] of suppressed) test(name, () => {
  const result = runScenario(options);
  expect(result.calls).toEqual([['notify', false]]);
  expect(result.offset).toBe(100);
  expect(result.cacheSize).toBe(15);
  expect(result.first).toBe(!options.remeasure);
});

test('zero delta has no delegate, notification or new measurement', () => {
  const result = runScenario({ size: 10, predicate: 'copilot' });
  expect(result.calls).toEqual([]);
  expect(result.offset).toBe(100);
  expect(result.first).toBe(true);
  expect(result.cacheSize).toBeUndefined();
});

test('coordinate equation distinguishes compensation from raw scroll opposition', () => {
  // Arithmetic only: these are not a browser-rendered counterfactual or frames.
  const before = { documentY: 17052, scrollTop: 16707 };
  const after = { documentY: 17169, scrollTop: 16824 };
  expect(before.documentY - before.scrollTop).toBe(345);
  expect(after.documentY - after.scrollTop).toBe(345);
  expect(after.documentY - before.documentY).toBe(117);
  expect(after.scrollTop - before.scrollTop).toBe(117);
  expect(after.documentY - before.scrollTop).toBe(462);
});
