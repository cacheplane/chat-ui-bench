import { expect, test } from 'vitest';
import * as contract from './index.js';
test('exports an exact page-clock receipt/translation capture schema without implied runtime application', () => {
    const schema = (contract as any).adapterCaptureEventSchema;
    expect(schema).toBeDefined();
    expect(schema.safeParse({ kind: 'translation', sequence: 1, timestampMs: 1, data: { protocolEvent: 'messages', messageId: 'a', text: 'x' } }).success).toBe(true);
    expect(schema.safeParse({ kind: 'translation', sequence: 1, timestampMs: 1, data: { protocolEvent: 'messages', messageId: 'a', text: 'x', applied: true } }).success).toBe(false);
    expect(schema.safeParse({ kind: 'receipt', sequence: 2, timestampMs: 1, data: { event: { type: 'assistant-start', messageId: 'a', sequence: 0, scheduledMs: 0, text: '' } } }).success).toBe(false);
});
