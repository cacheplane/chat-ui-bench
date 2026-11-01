import type {PublicContext} from './protocol.ts';
export function parsePublicContext(value: unknown): PublicContext;
export function closedData(value: unknown, keys: readonly string[]): Record<string, unknown>;
