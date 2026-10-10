import { replayEventSchema, type ReplayEvent } from '@chat-ui-bench/contract';
/** Strict finite replay; no reconnect, EOF completion, or byte-to-string shortcuts. */
export async function* parseReplaySse(chunks: AsyncIterable<Uint8Array>, onReceipt?: (event: ReplayEvent) => void): AsyncGenerator<ReplayEvent> {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '', sequence = 0, id: string | null = null, complete = false, lastSchedule = -1, terminal: ReplayEvent | null = null;
    function parse(frame: string): ReplayEvent | null {
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data)
            return null;
        const event = replayEventSchema.parse(JSON.parse(data));
        if (complete)
            throw new Error('Event after completion');
        if (event.sequence !== sequence++)
            throw new Error('Noncontiguous replay sequence');
        if (event.scheduledMs < lastSchedule)
            throw new Error('Decreasing replay schedule');
        lastSchedule = event.scheduledMs;
        if (id === null) {
            if (event.type !== 'assistant-start')
                throw new Error('Missing assistant start');
            id = event.messageId;
        }
        else if (event.type === 'assistant-start')
            throw new Error('Duplicate assistant start');
        if (event.messageId !== id)
            throw new Error('Wrong replay message ID');
        if (event.type === 'assistant-complete') {
            complete = true;
            terminal = event;
        }
        onReceipt?.(event);
        return event;
    }
    for await (const chunk of chunks) {
        buffer += decoder.decode(chunk, { stream: true });
        let match: RegExpExecArray | null;
        while ((match = /\r?\n\r?\n/.exec(buffer)) !== null) {
            const frame = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            const event = parse(frame);
            if (event && event.type !== 'assistant-complete')
                yield event;
        }
    }
    buffer += decoder.decode();
    if (buffer.trim())
        throw new Error('Partial final SSE frame');
    if (!complete)
        throw new Error('Missing assistant completion');
    // EOF validates the entire finite lifecycle before persistence can publish success.
    yield terminal!;
}
