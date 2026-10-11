import {test, expect} from 'vitest';
import * as api from './environment.js';
test('comparison environment is additive and requires genuine acquired authority', async () => {
  expect(typeof api.collectEnvironment).toBe('function');
  expect(typeof api.collectComparisonEnvironment).toBe('function');
  await expect(api.collectComparisonEnvironment({} as never, {} as never, 'conformance')).rejects.toThrow('genuine');
});
test.each([
  ['7f454c4601000000', 52], ['7f454c4602000000', 64],
  ['feedface00000000', 28], ['cefaedfe00000000', 28],
  ['feedfacf00000000', 32], ['cffaedfe00000000', 32],
  ['cafebabe00000000', 8], ['bebafeca00000000', 8],
  ['cafebabf00000000', 8], ['bfbafeca00000000', 8],
])('native Git shape reads only the exact format header %s', (hex, length) => {
  expect(api.comparisonNativeHeaderSize(Buffer.from(hex, 'hex'))).toBe(length);
});
test.each([Buffer.from('#!/bin/sh'), Buffer.from('7f454c4603000000', 'hex'), Buffer.alloc(7)])('native Git shape rejects script, unknown class and short read %#', header => {
  expect(() => api.comparisonNativeHeaderSize(header)).toThrow();
});
test('unsupported purpose fails before acquisition or CDP', async () => {
  await expect(api.collectComparisonEnvironment({} as never, {} as never, 'invented' as never)).rejects.toThrow('purpose');
});
