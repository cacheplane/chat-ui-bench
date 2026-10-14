/** Bounded protobuf body primitives. No container detection or recursive decoding. */
export const WIRE_LIMITS = Object.freeze({ bytes: 262144, occurrences: 32768, members: 16384, diagnostics: 32 });
export type Scope = 'root' | 'frame_sink';
export interface Occurrence {
  scope: Scope;
  fieldNumber: number;
  wireType: 0 | 1 | 2 | 5;
  start: number;
  valueStart: number;
  end: number;
}
export interface WireField { occurrence: Occurrence; scalar?: bigint }
export class WireError extends Error {
  constructor(readonly code: string) { super(code); }
}

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const nativeByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')!.get!;
const nativeBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const nativeArrayBufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
const nativeSet = Uint8Array.prototype.set;

/** Use native accessors and set, never caller length/iterator/slice/species. Ordinary views only. */
export function copyBody(input: unknown): Uint8Array {
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Uint8Array.prototype) throw new WireError('unsupported-byte-view');
  try {
    const length: number = nativeByteLength.call(input);
    const buffer: ArrayBuffer = nativeBuffer.call(input);
    // This intrinsic denies SharedArrayBuffer (including another realm's), without reading caller properties.
    nativeArrayBufferLength.call(buffer);
    if (length > WIRE_LIMITS.bytes) throw new WireError('byte-capacity');
    const owned = new Uint8Array(length);
    // Native set rejects detached storage, even when its reported length is zero.
    nativeSet.call(owned, input as Uint8Array);
    return owned;
  } catch (error) {
    if (error instanceof WireError) throw error;
    throw new WireError('unavailable-byte-storage');
  }
}

/** One instance per body, shared by its sole selected FrameSink child and packed values. */
export class WireBudget {
  private occurrences = 0;
  private members = 0;
  chargeOccurrence(): void {
    if (++this.occurrences > WIRE_LIMITS.occurrences) throw new WireError('field-capacity');
  }
  chargeMember(): void {
    if (++this.members > WIRE_LIMITS.members) throw new WireError('member-capacity');
  }
}

/** A reader is a flat bounded window. The projection chooses the one allowed child, not this reader. */
export class BodyReader {
  private cursor: number;
  constructor(private readonly bytes: Uint8Array, start: number, private readonly end: number, private readonly budget: WireBudget) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > bytes.byteLength) throw new WireError('invalid-byte-window');
    this.cursor = start;
  }
  get complete(): boolean { return this.cursor === this.end; }
  varint(): bigint {
    let value = 0n;
    for (let index = 0; index < 10; index++) {
      if (this.cursor >= this.end) throw new WireError('truncated-varint');
      const byte = this.bytes[this.cursor++]!;
      if (index === 9 && byte > 1) throw new WireError('uint64-varint-overflow');
      value |= BigInt(byte & 0x7f) << BigInt(index * 7);
      if ((byte & 0x80) === 0) return value;
    }
    throw new WireError('uint64-varint-overflow');
  }
  next(scope: Scope): WireField {
    if (this.complete) throw new WireError('unexpected-body-end');
    this.budget.chargeOccurrence();
    const start = this.cursor;
    const tag = this.varint();
    const fieldBig = tag >> 3n;
    const typeBig = tag & 7n;
    // Validate the tag domain before any Number conversion or selected/unknown dispatch.
    if (fieldBig < 1n || fieldBig > 536870911n) throw new WireError('invalid-field-number');
    if (typeBig !== 0n && typeBig !== 1n && typeBig !== 2n && typeBig !== 5n) throw new WireError('unsupported-wire-type');
    const fieldNumber = Number(fieldBig);
    const wireType = Number(typeBig) as Occurrence['wireType'];
    let valueStart = this.cursor;
    let scalar: bigint | undefined;
    if (wireType === 0) scalar = this.varint();
    else if (wireType === 1 || wireType === 5) {
      const length = wireType === 1 ? 8 : 4;
      if (length > this.end - this.cursor) throw new WireError('truncated-fixed-field');
      this.cursor += length;
    } else {
      const lengthBig = this.varint();
      if (lengthBig > BigInt(this.end - this.cursor)) throw new WireError('out-of-bounds-length');
      const length = Number(lengthBig); // Already bounded by the finite input window.
      valueStart = this.cursor;
      this.cursor += length;
    }
    const occurrence = { scope, fieldNumber, wireType, start, valueStart, end: this.cursor };
    return scalar === undefined ? { occurrence } : { occurrence, scalar };
  }
}

export function signed64(value: bigint): string {
  return (value >= 9223372036854775808n ? value - 18446744073709551616n : value).toString();
}
