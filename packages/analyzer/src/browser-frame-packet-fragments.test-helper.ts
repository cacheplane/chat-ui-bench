/** Inert byte fixtures: no capture, producer, SDK or trace-file reads. */
export function join(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
export function vi(value: bigint): Uint8Array {
  if (value < 0n || value > 18446744073709551615n) throw new Error('fixture-uint64');
  const bytes: number[] = [];
  do { const byte = Number(value & 127n); value >>= 7n; bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Uint8Array.from(bytes);
}
export const tag = (field: number, wire: number): Uint8Array => vi(BigInt(field) * 8n + BigInt(wire));
export const uint = (field: number, value: bigint): Uint8Array => join(tag(field, 0), vi(value));
export const body = (field: number, value: Uint8Array): Uint8Array => join(tag(field, 2), vi(BigInt(value.length)), value);
export const text = (field: number, value: string): Uint8Array => body(field, new TextEncoder().encode(value));
export const int32 = (field: number, value: bigint): Uint8Array => uint(field, value < 0n ? value + 18446744073709551616n : value);
