import { expect, test } from 'vitest';
import { ReplayTransport } from './replay-transport.js';
import type { Message, ReplayEvent } from '@chat-ui-bench/contract';
const api = { ReplayTransport };
const history: Message[] = [{ id: 'h', role: 'user', status: 'complete', text: 'hello' }];
const events: ReplayEvent[] = [{ sequence: 0, scheduledMs: 0, messageId: 'a', type: 'assistant-start', text: '' },
    { sequence: 1, scheduledMs: 1, messageId: 'a', type: 'text-delta', text: 'A🌍' },
    { sequence: 2, scheduledMs: 2, messageId: 'a', type: 'text-delta', text: '漢字' },
    { sequence: 3, scheduledMs: 3, messageId: 'a', type: 'assistant-complete', text: '' }];
test.each([0, -1, 201, NaN, 1.5])('rejects unidentifiable omission fault %s', value => {
    expect(() => new ReplayTransport({ omitDeltaSequence: value })).toThrow('fault');
});
function response(items: unknown[]) { return new Response(items.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } }); }
test.each([undefined, 2])('translates received deltas and persists only yielded text (omission %s)', async (omit) => {
    expect(typeof api.ReplayTransport).toBe('function');
    const transport = new api.ReplayTransport({ fetch: async () => response(events), omitDeltaSequence: omit });
    transport.loadHistory('t', history);
    transport.connect('https://fixture.test/replay');
    const yielded = [];
    for await (const e of transport.stream('benchmark', 't', null, new AbortController().signal))
        yielded.push(e);
    const expected = omit === 2 ? 'A🌍' : 'A🌍漢字';
    expect(yielded[0]).toMatchObject({ type: 'messages', messageMetadata: { langgraph_node: 'benchmark' } });
    expect(yielded.at(-1)).toMatchObject({ type: 'values', data: { messages: [{ id: 'h', type: 'human', content: 'hello' }, { id: 'a', type: 'ai', content: expected }] } });
    expect((await transport.getHistory('t', new AbortController().signal))[0].values.messages.at(-1).content).toBe(expected);
    expect(transport.drainEvidence().filter((e: any) => e.kind === 'receipt')).toHaveLength(4);
});
test('aborted HTTP replay releases ownership without retrying or persisting text', async () => {
    let fetches = 0;
    const transport = new ReplayTransport({ fetch: async (_url, options) => { fetches++; return new Promise((_resolve, reject) => options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason))); } });
    transport.loadHistory('t', history);
    transport.connect('https://fixture.test/replay');
    const abort = new AbortController(), iterator = transport.stream('benchmark', 't', null, abort.signal), next = iterator.next();
    abort.abort(new Error('owned abort'));
    await expect(next).rejects.toThrow('owned abort');
    expect(fetches).toBe(1);
    expect((await transport.getHistory('t', new AbortController().signal))[0]!.values.messages).toHaveLength(1);
    transport.dispose();
    transport.dispose();
    expect(() => transport.connect('https://fixture.test/again')).toThrow('disposed');
});
test('new generation cancels pending replay and discards old evidence callbacks', async () => {
    let requested: AbortSignal | undefined;
    const transport = new ReplayTransport({ fetch: async (_url, options) => { requested = options!.signal as AbortSignal; return new Promise((_resolve, reject) => requested!.addEventListener('abort', () => reject(new Error('reset abort')))); } });
    transport.loadHistory('old', history);
    transport.connect('https://fixture.test/replay');
    const next = transport.stream('benchmark', 'old', null, new AbortController().signal).next();
    transport.loadHistory('new', [{ ...history[0]!, id: 'new-h' }]);
    await expect(next).rejects.toThrow('reset abort');
    expect(requested!.aborted).toBe(true);
    expect(transport.drainEvidence()).toEqual([]);
    expect((await transport.getHistory('new', new AbortController().signal))[0]!.values.messages).toEqual([{ id: 'new-h', type: 'human', content: 'hello' }]);
});
test('premature EOF cannot add a persisted response or synthesize completion', async () => {
    expect(typeof api.ReplayTransport).toBe('function');
    const transport = new api.ReplayTransport({ fetch: async () => response(events.slice(0, 3)) });
    transport.loadHistory('t', history);
    transport.connect('https://fixture.test/replay');
    await expect(async () => { for await (const e of transport.stream('benchmark', 't', null, new AbortController().signal))
        void e; }).rejects.toThrow('completion');
    expect((await transport.getHistory('t', new AbortController().signal))[0].values.messages).toHaveLength(1);
});
test('events after terminal cannot commit a response to final history', async () => {
    expect(typeof api.ReplayTransport).toBe('function');
    const transport = new api.ReplayTransport({ fetch: async () => response([...events, events[3]]) });
    transport.loadHistory('t', history);
    transport.connect('https://fixture.test/replay');
    await expect(async () => { for await (const e of transport.stream('benchmark', 't', null, new AbortController().signal))
        void e; }).rejects.toThrow();
    expect((await transport.getHistory('t', new AbortController().signal))[0].values.messages).toHaveLength(1);
});
test('dispose retains accepted evidence and accessible final buffer state',async()=>{
    const transport=new ReplayTransport({fetch:async()=>response(events)});
    transport.loadHistory('t',history);transport.connect('https://fixture.test/replay');
    for await(const event of transport.stream('a','t',null,new AbortController().signal)) void event;
    transport.dispose();
    expect(transport.readCaptureBufferState()).toMatchObject({pendingEntries:8,highWaterEntries:8,status:'complete'});
    expect(transport.drainEvidence()).toHaveLength(8);
    expect(transport.readCaptureBufferState()).toMatchObject({pendingEntries:0,highWaterEntries:8});
});
test('overflow never delays delivery and reset retains lifetime loss and undrained records',async()=>{
    const items=[events[0],...Array.from({length:2050},(_,i)=>({...events[1]!,sequence:i+1,scheduledMs:i+1,text:'x'})),{...events[3]!,sequence:2051,scheduledMs:2051}];
    let fetches=0;const transport=new ReplayTransport({fetch:async()=>response(fetches++===0?items:events)});
    transport.loadHistory('t',history);transport.connect('https://fixture.test/replay');
    let terminal:unknown;for await(const event of transport.stream('a','t',null,new AbortController().signal)) terminal=event;
    expect(terminal).toMatchObject({type:'values',data:{messages:[{id:'h'},{id:'a',content:'x'.repeat(2050)}]}});
    expect(transport.readCaptureBufferState()).toMatchObject({pendingEntries:4096,highWaterEntries:4096,rejectedRecordCount:8,overflowCount:8,status:'partial'});
    transport.reset();expect(transport.readCaptureBufferState()).toMatchObject({pendingEntries:4096,rejectedRecordCount:8});
    expect(transport.drainEvidence()).toHaveLength(4096);
    transport.loadHistory('new',history);transport.connect('https://fixture.test/replay');
    for await(const event of transport.stream('a','new',null,new AbortController().signal)) void event;
    expect(transport.drainEvidence()).toHaveLength(8);
    transport.dispose();expect(transport.readCaptureBufferState()).toMatchObject({pendingEntries:0,highWaterEntries:4096,rejectedRecordCount:8});
});
