import { expect, test } from 'vitest';
import { parseReplaySse } from './sse.js';
const api = { parseReplaySse };
const events = [
    { sequence: 0, scheduledMs: 0, messageId: 'a', type: 'assistant-start', text: '' },
    { sequence: 1, scheduledMs: 1, messageId: 'a', type: 'text-delta', text: 'A🌍é漢字' },
    { sequence: 2, scheduledMs: 2, messageId: 'a', type: 'assistant-complete', text: '' },
];
async function* bytes(input: string) { for (const b of new TextEncoder().encode(input))
    yield new Uint8Array([b]); }
const encode = (items: unknown[]) => items.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join('');
test('decodes fragmented Unicode and preserves the actual replay lifecycle', async () => {
    expect(typeof api.parseReplaySse).toBe('function');
    const received = [];
    for await (const e of api.parseReplaySse(bytes(encode(events))))
        received.push(e);
    expect(received).toEqual(events);
});
test.each([
    [events.slice(0, 2), 'completion'],
    [[events[0], events[1], events[1], events[2]], 'sequence'],
    [[events[0], { ...events[1], messageId: 'b' }, events[2]], 'message'],
    [[...events, events[2]], 'completion'],
])('rejects incomplete or inconsistent lifecycle %j', async (items, reason) => {
    expect(typeof api.parseReplaySse).toBe('function');
    await expect(async () => { for await (const e of api.parseReplaySse(bytes(encode(items))))
        void e; }).rejects.toThrow(reason);
});
test('rejects malformed JSON and a partial final frame', async () => {
    expect(typeof api.parseReplaySse).toBe('function');
    for (const input of ['data: {bad}\n\n', encode(events).slice(0, -2)])
        await expect(async () => { for await (const e of api.parseReplaySse(bytes(input)))
            void e; }).rejects.toThrow();
});
test('accepts SSE comments and multiline JSON data without changing Unicode', async () => {
    const input = events.map(e => `: keepalive\n${JSON.stringify(e, null, 2).split('\n').map(line => `data: ${line}`).join('\n')}\n\n`).join('');
    const actual = [];
    for await (const event of parseReplaySse(bytes(input)))
        actual.push(event);
    expect(actual).toEqual(events);
});
test.each([
    [{ ...events[0], sequence: 1 }, events[1], events[2]],
    [events[1], events[2]],
    [events[0], events[0], events[2]],
    [events[0], { ...events[1], scheduledMs: 3 }, events[2]],
    [events[0], { ...events[1], text: 4 }, events[2]],
])('rejects invalid sequence/start/schedule/schema %j', async (items) => {
    await expect(async () => { for await (const event of parseReplaySse(bytes(encode(items))))
        void event; }).rejects.toThrow();
});
test('rejects incomplete UTF-8 instead of adding replacement characters', async () => {
    async function* input() { yield new Uint8Array([0xf0, 0x9f]); }
    await expect(async () => { for await (const event of parseReplaySse(input()))
        void event; }).rejects.toThrow();
});
