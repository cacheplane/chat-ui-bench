import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createScrollCauseDiagnostic, SCROLL_CAUSE_ROW_BOUND } from '../apps/copilotkit/src/scroll-cause-diagnostic.js';
import { transformScrollCause, reverseScrollCause, PINNED_MODULE, PINNED_SHA256 } from './support/hosted-copilot-scroll-cause-transform.js';

test('actual pinned resize → original adjustment → original delegate retains attribution', async () => {
  const root = resolve('node_modules/@tanstack/virtual-core/dist/esm');
  const temporary = await mkdtemp(join(tmpdir(), 'scroll-cause-unit-'));
  const source = await readFile(join(root, 'index.js'), 'utf8');
  for (const name of ['lazy-measurements.js', 'utils.js']) await writeFile(join(temporary, name), await readFile(join(root, name)));
  for (const name of ['index.js.map', 'lazy-measurements.js.map', 'utils.js.map']) await writeFile(join(temporary, name), await readFile(join(root, name)));
  await writeFile(join(temporary, 'package.json'), '{"type":"module"}');
  const featurePath = resolve('tests/support/hosted-copilot-scroll-cause-transform.ts');
  const observerPath = resolve('apps/copilotkit/src/scroll-cause-diagnostic.ts');
  const observer = existsSync(observerPath) ? await import(pathToFileURL(observerPath).href) : null;
  const feature = existsSync(featurePath) ? await import(pathToFileURL(featurePath).href) : null;
  const code = feature ? feature.transformScrollCause(source, feature.PINNED_MODULE, pathToFileURL(observerPath).href).code : source;
  await writeFile(join(temporary, 'index.js'), code);
  const vendor = await import(pathToFileURL(join(temporary, 'index.js')).href);
  const calls: unknown[] = [];
  const instance = new vendor.Virtualizer({ count: 2, estimateSize: () => 10, getScrollElement: () => null, scrollToFn: vendor.elementScroll, onChange: (_: unknown, sync: boolean) => calls.push(['notify', sync]) });
  instance.scrollOffset = 100;
  instance.scrollElement = { scrollTo(value: unknown) { calls.push(['delegate', value]); } };
  instance.measurementsCache = [{ index: 0, key: 0, start: 0, size: 10, end: 10, lane: 0 }];
  instance.resizeItem(0, 15);
  expect(calls).toEqual([['delegate', { top: 105, behavior: undefined }], ['notify', true]]);
  expect(observer?.scrollCauseObserver.snapshot().rows.some((row: number[]) => row[0] === 6) ?? false).toBe(true);
});

const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const vendorRoot = resolve('node_modules/@tanstack/virtual-core/dist/esm');
const observerSource = pathToFileURL(resolve('apps/copilotkit/src/scroll-cause-diagnostic.ts')).href;

async function load(transformed: boolean, limits = '') {
  const directory = await mkdtemp(join(tmpdir(), 'scroll-cause-differential-'));
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  for (const name of ['lazy-measurements.js', 'utils.js', 'index.js.map', 'lazy-measurements.js.map', 'utils.js.map']) await writeFile(join(directory, name), await readFile(join(vendorRoot, name)));
  const bridge = join(directory, 'observer.mjs');
  await writeFile(bridge, `import { createScrollCauseDiagnostic } from ${JSON.stringify(observerSource)}; export const scrollCauseObserver = createScrollCauseDiagnostic(${limits});`);
  const source = await readFile(join(vendorRoot, 'index.js'), 'utf8');
  await writeFile(join(directory, 'index.js'), transformed ? transformScrollCause(source, PINNED_MODULE, pathToFileURL(bridge).href).code : source);
  return { vendor: await import(pathToFileURL(join(directory, 'index.js')).href), observer: (await import(pathToFileURL(bridge).href)).scrollCauseObserver as ReturnType<typeof createScrollCauseDiagnostic> };
}

type Scenario = { size?: number; start?: number; old?: number; custom?: boolean; pending?: boolean; end?: boolean; absent?: 'element' | 'method'; failure?: 'getter' | 'delegate' | 'predicate' | 'predicate-getter'; outside?: boolean; nested?: boolean; nestedPredicate?: boolean; ios?: boolean; index?: number; missing?: boolean; limit?: boolean };
async function scenario(transformed: boolean, options: Scenario) {
  const { vendor, observer } = await load(transformed, options.limit ? '1' : '');
  const log: unknown[] = [];
  const sentinel = Object.freeze({ original: 'throw identity' });
  let argument: object | null = null, nested = false, customReads = 0, midDelegateComplete: boolean | null = null;
  const receiver = {};
  const instance = new vendor.Virtualizer({ count: 2, estimateSize: () => 10, getScrollElement: () => null, scrollToFn: vendor.elementScroll,
    ...(options.end ? { anchorTo: 'end', initialRect: { width: 100, height: 10 }, scrollEndThreshold: 10 } : {}),
    onChange: (_: unknown, sync: boolean) => log.push(['notify', sync]) });
  Object.defineProperty(receiver, 'scrollTo', { get() {
    log.push(['scrollTo-get']);
    if (options.failure === 'getter') throw sentinel;
    if (options.absent === 'method') return undefined;
    return function (this: unknown, value: { top: number; behavior: unknown }) {
      expect(this).toBe(receiver); argument = value;
      midDelegateComplete = observer.snapshot().complete;
      log.push(['delegate', value.top, value.behavior, argument === value]);
      if (options.failure === 'delegate') throw sentinel;
      if ((options.nested || options.nestedPredicate) && !nested) { nested = true; instance.resizeItem(1, 12); }
    };
  } });
  Object.defineProperty(instance, 'scrollElement', { configurable: true, get() { log.push(['element-get']); return options.absent === 'element' ? null : receiver; } });
  instance.scrollOffset = options.end ? 10 : 100;
  instance.measurementsCache = [0, 1].map(index => ({ index, key: index, start: (options.start ?? 0) + index * 10, size: 10, end: (options.start ?? 0) + index * 10 + 10, lane: 0 }));
  if (options.missing) instance.measurementsCache = [];
  if (options.old !== undefined) instance.itemSizeCache.set(0, options.old);
  if (options.custom !== undefined || options.nestedPredicate || options.failure === 'predicate' || options.failure === 'predicate-getter') Object.defineProperty(instance, 'shouldAdjustScrollPositionOnItemSizeChange', { get() {
    log.push(['predicate-get', ++customReads]);
    if (options.failure === 'predicate-getter' && customReads === 2) throw sentinel;
    return function (this: unknown, item: { index: number }, delta: number, actual: unknown) {
      expect(this).toBe(instance); expect(actual).toBe(instance);
      log.push(['predicate-call', item.index, delta]);
      if (options.failure === 'predicate') throw sentinel;
      if (options.nestedPredicate && item.index === 1) instance._scrollToOffset(40, { adjustments: 1, behavior: 'auto' });
      return options.custom ?? true;
    };
  } });
  if (options.pending) { instance.scrollState = { phase: 'instant' }; instance.pendingWrite = { target: 200, smooth: false, adjustments: 0 }; }
  if (options.ios) { instance._iosTouch = true; instance.isScrolling = true; }
  let thrown: unknown = null;
  try { instance.resizeItem(options.index ?? 0, options.size ?? 15); } catch (error) { thrown = error; }
  expect(thrown === null || thrown === sentinel).toBe(true);
  if (options.outside || thrown !== null) {
    // Original throwing delegate is replaced only after that operation finished;
    // this independent original request must have no exited resize cause.
    Object.defineProperty(instance, 'scrollElement', { configurable: true, value: { scrollTo() { log.push(['outside-delegate']); } } });
    instance._scrollToOffset(30, { adjustments: 2, behavior: 'auto' });
  }
  return { log, threw: thrown === sentinel, rows: observer.snapshot().rows, snapshot: observer.snapshot(), customReads, deferred: instance._iosDeferredAdjustment, midDelegateComplete };
}

test('pins whole executable trio and reverses every insertion; refuses noncanonical receipts', async () => {
  const source = await readFile(join(vendorRoot, 'index.js'), 'utf8');
  expect(Buffer.byteLength(source)).toBe(54156); expect(sha(source)).toBe(PINNED_SHA256);
  for (const [name, hash] of [['lazy-measurements.js', '99b8ef4dc023f5249b8c6c0c164abd2d5793a369b83795c2559ef83069643672'], ['utils.js', 'c1cee1b5f7f1cff7e20bd074dcc38b70f4774924f00bb674c0e226089f8d8279']]) expect(sha(await readFile(join(vendorRoot, name!)))).toBe(hash);
  const result = transformScrollCause(source, PINNED_MODULE, observerSource);
  expect(reverseScrollCause(result)).toBe(source);
  for (const bad of [source + ' ', source.replace('this.resizeItem =', 'this.resizeItemX ='), source + '\nthis.resizeItem =', result.code, source + '__scrollCauseV1']) expect(() => transformScrollCause(bad, PINNED_MODULE, observerSource)).toThrow();
  expect(() => transformScrollCause(source, 'src/index.ts', observerSource)).toThrow();
  for (const bad of ['https://example.org/x.mjs', 'file:///x/../evil.mjs', 'file:///x.mjs";evil()', 'file:///x/%2e%2e/evil.mjs', 'file:///x%00.mjs', 'file:///x%zz.mjs']) expect(() => transformScrollCause(source, PINNED_MODULE, bad)).toThrow();
  const changed = { ...result, code: result.code + '\n', transformedSha256: sha(result.code + '\n'), insertions: [...result.insertions, { offset: source.length, text: '\n' }] };
  expect(() => reverseScrollCause(changed)).toThrow('Unrecognized insertion');
});

const scenarios: [string, Scenario][] = [
  ['positive', {}], ['negative', { size: 5 }], ['zero', { size: 10 }], ['below offset', { start: 200 }],
  ['custom true', { custom: true, start: 200 }], ['custom false', { custom: false }], ['prior measurement', { old: 9 }],
  ['pending readback', { pending: true }], ['end adjustment', { end: true }], ['missing element', { absent: 'element' }],
  ['missing method', { absent: 'method' }], ['getter throw', { failure: 'getter' }], ['delegate throw', { failure: 'delegate' }],
  ['predicate throw before adjustment', { failure: 'predicate' }], ['outside request', { outside: true }], ['nested resize', { nested: true }],
  ['second predicate getter throw', { failure: 'predicate-getter' }],
  ['nested predicate unrelated request', { nestedPredicate: true }],
  ['observer overflow', { limit: true }], ['out of range', { index: 5 }], ['missing measurement', { missing: true }],
];
for (const [name, options] of scenarios) test(`actual original/transformed differential: ${name}`, async () => {
  const original = await scenario(false, options), transformed = await scenario(true, options);
  expect(transformed.log).toEqual(original.log); expect(transformed.threw).toBe(original.threw);
  if (options.custom !== undefined) expect(transformed.customReads).toBe(2);
  if (options.failure) {
    expect(transformed.snapshot.complete).toBe(false);
    expect(transformed.snapshot.activeResizes).toBe(0); expect(transformed.snapshot.activeCauses).toBe(0);
    expect(transformed.rows.filter(row => row[0] === 5).at(-1)?.[4]).toBe(null);
  }
  if (name === 'positive') {
    expect(transformed.midDelegateComplete).toBe(false);
    expect(transformed.rows.map(row => row[0])).toEqual([1, 2, 3, 5, 6, 4, 7]);
    const request = transformed.rows.find(row => row[0] === 5)!;
    expect(request[4]).not.toBe(null); expect(request.slice(6, 10)).toEqual([100, 5, 0, 105]);
    expect(transformed.rows.find(row => row[0] === 6)?.[5]).toBe(1);
  }
  if (options.end) expect(transformed.rows.find(row => row[0] === 3)?.[6]).toBe(2);
  if (options.pending) expect(transformed.rows.some(row => row[0] === 3)).toBe(false);
  if (options.size === 10 || options.index === 5 || options.missing) expect(transformed.rows.map(row => row[0])).toEqual([1, 7]);
  if (options.outside) expect(transformed.rows.filter(row => row[0] === 5).at(-1)?.[4]).toBe(null);
  if (options.nestedPredicate) {
    const unrelated = transformed.rows.find(row => row[0] === 5 && row[6] === 40)!;
    expect(unrelated[4]).toBe(null);
    const parent = transformed.rows.find(row => row[0] === 3)!;
    expect(transformed.rows.filter(row => row[0] === 6).at(-1)?.[4]).toBe(parent[4]);
  }
});

test('iOS deferral clears scope before a later independent original request', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 1 } });
  try {
    const original = await scenario(false, { ios: true, outside: true }), transformed = await scenario(true, { ios: true, outside: true });
    expect(transformed.log).toEqual(original.log); expect(transformed.deferred).toBe(5);
    expect(transformed.rows.filter(row => row[0] === 5)).toHaveLength(1);
    expect(transformed.rows.find(row => row[0] === 5)?.[4]).toBe(null);
  } finally { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else Reflect.deleteProperty(globalThis, 'navigator'); }
});

test('finite tuple width, exact record cap, immutable snapshots and false authority', () => {
  const observer = createScrollCauseDiagnostic(), instance = {};
  for (let i = 0; i < 512; i++) { const id = observer.enter(instance, Number.MAX_VALUE, -Number.MAX_VALUE); observer.exit(instance, id, true); }
  const result = observer.snapshot(); expect(result.complete).toBe(true); expect(result.rows).toHaveLength(1024);
  expect(Math.max(...result.rows.map(row => Buffer.byteLength(JSON.stringify(row))))).toBeLessThanOrEqual(SCROLL_CAUSE_ROW_BOUND);
  expect(1024 * SCROLL_CAUSE_ROW_BOUND + 4096).toBeLessThan(1048576);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1048576);
  expect(Buffer.byteLength(JSON.stringify({ ...result, rows: [] }))).toBeLessThan(4096);
  result.rows[0]![0] = 99; expect(observer.snapshot().rows[0]![0]).toBe(1);
  observer.enter(instance, 0, 1); expect(observer.snapshot()).toMatchObject({ complete: false, fault: 1, qualification: false, nativeGO: false, performance: false, FPS: 'unavailable' });
  expect(observer.snapshot().rows).toHaveLength(1024);
});

test('exact/+1 instance, key, depth and byte caps; hostile values never invoke getters', () => {
  const one = createScrollCauseDiagnostic(1024, 1), instance = {};
  one.enter(instance, 0, 1); one.enter({}, 0, 1); expect(one.snapshot().fault).toBe(2);
  const key = createScrollCauseDiagnostic(1024, 4, 1), resize = key.enter(instance, 0, 15); key.decision(instance, resize, 'a', 0, 0, 10, 10, 15, 5, 100, true, true, true, false, false, 2); expect(key.snapshot().fault).toBe(0); key.decision(instance, resize, 'b', 0, 0, 10, 10, 15, 5, 100, true, true, true, false, false, 2); expect(key.snapshot().fault).toBe(3);
  const deep = createScrollCauseDiagnostic(1024, 4, 1024, 1); const id = deep.enter(instance, 0, 1); const cause = deep.open(instance, id, 1); expect(deep.snapshot().fault).toBe(0); deep.open(instance, id, 1); expect(deep.snapshot().fault).toBe(4); deep.close(instance, id, cause, true, false); deep.exit(instance, id, true);
  const sample = createScrollCauseDiagnostic(); sample.request(instance, 1, 0, undefined, 1); const exact = 4096 + Buffer.byteLength(JSON.stringify(sample.snapshot().rows[0]));
  const at = createScrollCauseDiagnostic(1024, 4, 1024, 8, exact); at.request(instance, 1, 0, undefined, 1); expect(at.snapshot().fault).toBe(0);
  const below = createScrollCauseDiagnostic(1024, 4, 1024, 8, exact - 1); below.request(instance, 1, 0, undefined, 1); expect(below.snapshot().fault).toBe(6);
  for (const invalid of [NaN, Infinity, -Infinity, { get valueOf() { throw new Error('must not read'); } }]) { const bad = createScrollCauseDiagnostic(); bad.request(instance, invalid, 0, undefined, 1); expect(bad.snapshot().fault).toBe(5); }
  expect(() => createScrollCauseDiagnostic(1025)).toThrow();
  expect(() => createScrollCauseDiagnostic(1024, 4, 1024, 8, 4095)).toThrow();
  expect(createScrollCauseDiagnostic(1024, 4, 1024, 8, 4096).snapshot().complete).toBe(true);
});

test('open resize/cause snapshots are incomplete until both scopes close', () => {
  const observer = createScrollCauseDiagnostic(), instance = {};
  const id = observer.enter(instance, 0, 1);
  expect(observer.snapshot()).toMatchObject({ complete: false, activeResizes: 1, activeCauses: 0 });
  const cause = observer.open(instance, id, 1);
  expect(observer.snapshot()).toMatchObject({ complete: false, activeResizes: 1, activeCauses: 1 });
  observer.close(instance, id, cause, true, true);
  expect(observer.snapshot().complete).toBe(false);
  observer.exit(instance, id, true);
  expect(observer.snapshot()).toMatchObject({ complete: true, activeResizes: 0, activeCauses: 0 });
});

const decision = (observer: ReturnType<typeof createScrollCauseDiagnostic>, instance: object, resize: number | null) => observer.decision(instance, resize, 'key', 0, 0, 10, 10, 15, 5, 100, true, true, true, false, false, 2);
for (const kind of ['null', 'alien', 'stale', 'cross-instance'] as const) test(`refuses ${kind} resize ownership for decisions and scopes`, () => {
  for (const operation of ['decision', 'open'] as const) {
    const observer = createScrollCauseDiagnostic(), instance = {}, other = {};
    const original = observer.enter(instance, 0, 15);
    let supplied = kind === 'null' ? null : kind === 'alien' ? 999 : original;
    if (kind === 'stale') { observer.exit(instance, original, true); observer.enter(instance, 1, 15); }
    if (kind === 'cross-instance') { observer.enter(other, 1, 15); }
    const target = kind === 'cross-instance' ? other : instance;
    const before = observer.snapshot().rows.length;
    if (operation === 'decision') decision(observer, target, supplied);
    else expect(observer.open(target, supplied, 1)).toBe(null);
    expect(observer.snapshot()).toMatchObject({ complete: false, fault: 4 });
    expect(observer.snapshot().rows).toHaveLength(before);
  }
});

test('cause closure requires its original active resize and instance', () => {
  for (const kind of ['null', 'alien', 'cross-instance', 'nested'] as const) {
    const observer = createScrollCauseDiagnostic(), instance = {}, other = {};
    const resize = observer.enter(instance, 0, 15), cause = observer.open(instance, resize, 1);
    let supplied = kind === 'null' ? null : kind === 'alien' ? 999 : resize;
    if (kind === 'nested') supplied = observer.enter(instance, 1, 15);
    if (kind === 'cross-instance') observer.enter(other, 1, 15);
    const before = observer.snapshot().rows.length;
    observer.close(kind === 'cross-instance' ? other : instance, supplied, cause, true, true);
    expect(observer.snapshot()).toMatchObject({ complete: false, fault: 4, activeCauses: 1 });
    expect(observer.snapshot().rows).toHaveLength(before);
  }
});

test('identity refusal stops state admission permanently, including request and returned', () => {
  const observer = createScrollCauseDiagnostic(1024, 1), original = {};
  observer.request(original, 1, 0, undefined, 1);
  expect(observer.snapshot()).toMatchObject({ instances: 1, states: 1, fault: 0 });
  observer.request({}, 1, 0, undefined, 1);
  for (let i = 0; i < 100; i++) { observer.request({}, 1, 0, undefined, 1); observer.returned({}, {}, undefined, 1, 0, undefined); }
  expect(observer.snapshot()).toMatchObject({ instances: 1, states: 1, fault: 2, complete: false });
});

test('decision primitive facts, boolean flags and predicate tags form a closed schema', () => {
  for (const [slot, invalid] of [[0, null], [1, true], [7, 99], [8, 0], [9, {}], [10, 1], [11, null], [12, 99], [12, -1]] as const) {
    const observer = createScrollCauseDiagnostic(), instance = {}, resize = observer.enter(instance, 0, 15);
    const values: unknown[] = [0, 0, 10, 10, 15, 5, 100, true, true, true, false, false, 2]; values[slot] = invalid;
    observer.decision(instance, resize, 'key', ...values);
    expect(observer.snapshot()).toMatchObject({ complete: false, fault: 5 });
    expect(observer.snapshot().rows).toHaveLength(1);
  }
});

test('fault occurrence count never claims an omitted record count', () => {
  const observer = createScrollCauseDiagnostic(), instance = {}, resize = observer.enter(instance, 0, 15);
  observer.decision(instance, resize, {}, 0, 0, 10, 10, 15, 5, 100, true, true, true, false, false, 2);
  expect(observer.snapshot()).toMatchObject({ omittedRecords: 'unavailable', fault: 3 });
  expect(observer.snapshot()).not.toHaveProperty('droppedAtLeast');
  expect(observer.snapshot().faultOccurrences).toBeGreaterThan(0);
});

test('numeric facts never coerce booleans and closure flags require booleans', () => {
  for (const operation of ['entry', 'request', 'returned', 'exit', 'close'] as const) {
    const observer = createScrollCauseDiagnostic(), instance = {};
    if (operation === 'entry') observer.enter(instance, true, 15);
    if (operation === 'request') observer.request(instance, true, 0, undefined, 1);
    if (operation === 'returned') observer.returned(instance, {}, undefined, true, 0, undefined);
    if (operation === 'exit') { const resize = observer.enter(instance, 0, 15); observer.exit(instance, resize, 99 as unknown as boolean); }
    if (operation === 'close') { const resize = observer.enter(instance, 0, 15), cause = observer.open(instance, resize, 1); observer.close(instance, resize, cause, true, 99); }
    expect(observer.snapshot()).toMatchObject({ complete: false, fault: 5 });
  }
});

for (const operation of ['exit', 'close'] as const) test(`healthy null ${operation} sentinel is refused; faulted sentinel stays inert`, () => {
  const observer = createScrollCauseDiagnostic(), instance = {};
  if (operation === 'exit') observer.exit(instance, null, true);
  else observer.close(instance, null, null, true, true);
  expect(observer.snapshot()).toMatchObject({ complete: false, fault: 4 });
  const occurrences = observer.snapshot().faultOccurrences;
  observer.exit(instance, null, true); observer.close(instance, null, null, true, true);
  expect(observer.snapshot().faultOccurrences).toBe(occurrences);
});
