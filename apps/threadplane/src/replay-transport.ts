import type { AgentTransport, StreamEvent } from '@threadplane/langgraph';
import type { ThreadState } from '@langchain/langgraph-sdk';
import type { Message, ReplayEvent, AdapterCaptureEvent } from '@chat-ui-bench/contract';
import { parseReplaySse } from './sse.js';
type NativeMessage = {
    id: string;
    type: 'human' | 'ai';
    content: string;
};
export interface ReplayTransportOptions {
    fetch?: typeof fetch; /** Conformance fault, never a normal profile option. */
    omitDeltaSequence?: number;
    clock?: () => number;
}
export class ReplayTransport implements AgentTransport {
    private histories = new Map<string, NativeMessage[]>();
    private url: string | null = null;
    private generation = 0;
    private active: AbortController | null = null;
    private evidence: AdapterCaptureEvent[] = [];
    private disposed = false;
    constructor(private readonly options: ReplayTransportOptions = {}) {
        const omission = options.omitDeltaSequence;
        if (omission !== undefined && (!Number.isInteger(omission) || omission < 1 || omission > 200))
            throw new Error('Invalid conformance omission fault sequence');
    }
    loadHistory(threadId: string, history: readonly Message[]): void {
        this.reset();
        this.histories.set(threadId, history.map(m => ({ id: m.id, type: m.role === 'user' ? 'human' : 'ai', content: m.text })));
    }
    connect(url: string): void { if (this.disposed)
        throw new Error('Transport disposed'); this.url = url; }
    reset(): void { this.generation++; this.active?.abort(); this.active = null; this.url = null; this.evidence = []; }
    dispose(): void { if (this.disposed)
        return; this.disposed = true; this.reset(); this.histories.clear(); }
    drainEvidence(): AdapterCaptureEvent[] { const events = this.evidence; this.evidence = []; return events; }
    async getHistory(threadId: string, signal: AbortSignal): Promise<ThreadState[]> {
        signal.throwIfAborted();
        const messages = this.histories.get(threadId);
        if (!messages)
            throw new Error('Unknown thread');
        return [{ values: { messages: messages.map(m => ({ ...m })) }, next: [], checkpoint: { thread_id: threadId, checkpoint_ns: '', checkpoint_id: `checkpoint-${threadId}`, checkpoint_map: {} }, metadata: {}, created_at: '2026-01-01T00:00:00.000Z', parent_checkpoint: null, tasks: [] }];
    }
    async *stream(_assistantId: string, threadId: string | null, _payload: unknown, signal: AbortSignal): AsyncGenerator<StreamEvent> {
        if (this.disposed || !this.url || !threadId)
            throw new Error('Replay not connected to a loaded thread');
        if (this.active)
            throw new Error('Replay already active');
        const generation = this.generation, controller = new AbortController();
        this.active = controller;
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        const clock = this.options.clock ?? (() => performance.now());
        const record = (event: AdapterCaptureEvent) => { if (generation === this.generation && !this.disposed)
            this.evidence.push(event); };
        try {
            const response = await (this.options.fetch ?? fetch)(this.url, { signal: controller.signal });
            if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body)
                throw new Error(`Invalid replay HTTP response ${response.status}`);
            reader = response.body.getReader();
            const chunks = async function* () { while (true) {
                controller.signal.throwIfAborted();
                const result = await reader!.read();
                if (result.done)
                    return;
                yield result.value;
            } };
            let text = '', responseId: string | null = null;
            for await (const event of parseReplaySse(chunks(), event => record({ kind: 'receipt', timestampMs: clock(), sequence: event.sequence, data: { event } }))) {
                controller.signal.throwIfAborted();
                if (generation !== this.generation)
                    throw new Error('Stale replay generation');
                if (event.type === 'text-delta' && event.sequence === this.options.omitDeltaSequence)
                    continue;
                if (event.type === 'assistant-start') {
                    if (this.histories.get(threadId)!.some(m => m.id === event.messageId))
                        throw new Error('Response ID conflicts with history');
                    responseId = event.messageId;
                }
                if (event.type === 'text-delta')
                    text += event.text;
                const protocolEvent = event.type === 'assistant-complete' ? 'values' : 'messages';
                record({ kind: 'translation', timestampMs: clock(), sequence: event.sequence, data: { protocolEvent, messageId: event.messageId, text: event.type === 'assistant-complete' ? text : event.text } });
                if (event.type === 'assistant-complete') {
                    const messages = [...this.histories.get(threadId)!, { id: responseId!, type: 'ai' as const, content: text }];
                    this.histories.set(threadId, messages);
                    yield { type: 'values', data: { messages } };
                }
                else
                    yield { type: 'messages', messages: [{ id: event.messageId, type: 'AIMessageChunk', content: event.text }], messageMetadata: { langgraph_node: 'benchmark' } };
            }
        }
        finally {
            controller.abort();
            signal.removeEventListener('abort', abort);
            try {
                await reader?.cancel();
            }
            finally {
                reader?.releaseLock();
                if (this.active === controller)
                    this.active = null;
            }
        }
    }
}
