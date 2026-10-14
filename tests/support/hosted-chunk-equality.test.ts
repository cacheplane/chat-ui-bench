import { expect, test } from 'vitest';
import { equalChunkBytes } from './hosted-chunk-equality.js';

test('equal bytes ignore differing segmentation', () => {
  expect(equalChunkBytes([Uint8Array.of(1, 2, 3, 4)], [Uint8Array.of(1), Uint8Array.of(2, 3), Uint8Array.of(4)])).toBe(true);
});
test('byte drift within equal-length segments fails', () => {
  expect(equalChunkBytes([Uint8Array.of(1, 2, 3)], [Uint8Array.of(1, 9, 3)])).toBe(false);
});
test('empty chunks do not change equality or hide trailing bytes', () => {
  expect(equalChunkBytes([new Uint8Array(), Uint8Array.of(1), new Uint8Array()], [Uint8Array.of(1)])).toBe(true);
  expect(equalChunkBytes([], [new Uint8Array(), new Uint8Array()])).toBe(true);
  expect(equalChunkBytes([Uint8Array.of(1)], [Uint8Array.of(1), new Uint8Array(), Uint8Array.of(2)])).toBe(false);
});
test('offset views compare visible bytes, not their backing buffers', () => {
  const left = Uint8Array.of(8, 1, 2, 9).subarray(1, 3);
  const equal = Uint8Array.of(7, 1, 2, 6).subarray(1, 3);
  const drift = Uint8Array.of(1, 2, 8, 9).subarray(1, 3);
  expect(equalChunkBytes([left], [equal])).toBe(true);
  expect(equalChunkBytes([left], [drift])).toBe(false);
});
test('length drift in either direction fails', () => {
  expect(equalChunkBytes([Uint8Array.of(1)], [Uint8Array.of(1, 2)])).toBe(false);
  expect(equalChunkBytes([Uint8Array.of(1, 2)], [Uint8Array.of(1)])).toBe(false);
});
test('borrowed comparison preserves inputs', () => {
  const left = Uint8Array.of(1, 2); const right = Uint8Array.of(1, 2);
  expect(equalChunkBytes([left], [right])).toBe(true);
  expect(Array.from(left)).toEqual([1, 2]); expect(Array.from(right)).toEqual([1, 2]);
});
