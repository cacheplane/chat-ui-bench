import type {PublicContext} from './protocol.ts';
export function parsePublicContext(value: unknown): PublicContext;
export function parsePublicContextText(text: unknown, protocol?: unknown): PublicContext;
export const PUBLIC_CONTEXT_PROTOCOL_HEADER: 'x-chat-ui-bench-protocol';
export const PUBLIC_CONTEXT_LIMITS: Readonly<{'functional-v2':131072; 'matrix-v3':8388608}>;
export function closedData(value: unknown, keys: readonly string[]): Record<string, unknown>;
