import { createHash } from 'node:crypto';
import { canonicalSerialize, validateFixture, type Fixture } from './fixture.js';
export function canonicalHash(value: unknown): string { return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex'); }
/** Write serialized verbatim as fixture.json; SHA-256 covers those exact UTF-8 bytes. */
export function serializeFixture(input: unknown): { fixture: Fixture; serialized: string; hash: string } {
  const fixture = validateFixture(input);
  const serialized = canonicalSerialize(fixture);
  return { fixture, serialized, hash: createHash('sha256').update(serialized, 'utf8').digest('hex') };
}
