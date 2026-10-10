import type { LangGraphAgent } from '@threadplane/langgraph';
import type { Message as ProductMessage } from '@threadplane/chat';
import type { LongThreadCaptureHost, Message, RuntimeProgress, RuntimeTranscriptSnapshot, VisibleMessage, ComparisonPhase, AdapterPhaseBoundary, ActiveDomSnapshot } from '@chat-ui-bench/contract';
import { ReplayTransport } from './replay-transport.js';
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function raw(message: ProductMessage): string { if (typeof message.content !== 'string')
    throw new Error('Unexpected structured content in prose profile'); return message.content; }
export class ThreadplaneHost implements LongThreadCaptureHost {
    readonly capabilities = { rendering: 'all-mounted', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control' } as const;
    readonly locators = { scroller: 'chat .chat-scroll', composer: 'chat chat-input textarea.chat-input__textarea', returnToResponse: 'chat chat-scroll-bubble button.chat-scroll-bubble', messageContent: (id: string) => `chat-message[data-bench-message-id="${CSS.escape(id)}"] > .chat-message__bubble, chat-message[data-bench-message-id="${CSS.escape(id)}"] .chat-message__assistant-body > chat-streaming-md` };
    private disposed = false;
    private historyCount = 0;
    private submit: Promise<void> = Promise.resolve();
    private submitError: string | null = null;
    private observer: MutationObserver | null = null;
    private intersection: IntersectionObserver | null = null;
    private visible = new Set<HTMLElement>();
    private mounted = new Map<string, HTMLElement>();
    private phase: AdapterPhaseBoundary | null = null;
    private ordinal = 0;
    constructor(private readonly agent: LangGraphAgent, private readonly transport: ReplayTransport, private readonly destroy: () => void) { }
    private assertAlive(): void { if (this.disposed)
        throw new Error('Host disposed'); }
    async loadHistory(history: readonly Message[]): Promise<void> {
        this.assertAlive();
        await this.agent.stop();
        this.disconnect();
        const id = `benchmark-${crypto.randomUUID()}`;
        this.historyCount = history.length;
        this.submitError = null;
        this.transport.loadHistory(id, history);
        this.agent.switchThread(id);
        const deadline = performance.now() + 60000;
        while (this.agent.isThreadLoading() || this.agent.messages().length !== history.length) {
            if (performance.now() > deadline)
                throw new Error('History setup deadline exceeded');
            await frame();
        }
        await frame();
        await frame();
        const actual = this.agent.messages();
        if (actual.some((m, i) => m.id !== history[i]!.id || m.role !== history[i]!.role || raw(m) !== history[i]!.text))
            throw new Error('Product history differs from loaded checkpoint');
        if (history.length === 0)
            return;
        const list = document.querySelector('chat chat-message-list'), scroller = document.querySelector(this.locators.scroller);
        if (!list || !scroller)
            throw new Error('Native chat message list/scroller absent');
        this.intersection = new IntersectionObserver(entries => { for (const entry of entries) {
            const host = entry.target as HTMLElement;
            if (entry.isIntersecting)
                this.visible.add(host);
            else
                this.visible.delete(host);
        } }, { root: scroller });
        const hosts = Array.from(list.querySelectorAll<HTMLElement>(':scope > chat-message'));
        if (hosts.length !== actual.length)
            throw new Error('Product mounted history count differs');
        hosts.forEach((host, i) => this.annotate(host, actual[i]!));
        this.observer = new MutationObserver(records => {
            if (this.disposed)
                return;
            for (const record of records) {
                for (const node of record.removedNodes) {
                    if (node instanceof HTMLElement && node.matches('chat-message')) {
                        this.visible.delete(node);
                        this.intersection?.unobserve(node);
                        const id = node.dataset['benchMessageId'];
                        if (id)
                            this.mounted.delete(id);
                    }
                }
                for (const node of record.addedNodes) {
                    if (node instanceof HTMLElement && node.matches('chat-message')) {
                        const messages = this.agent.messages(), message = messages.at(-1);
                        if (!message)
                            throw new Error('Mounted response has no actual product message');
                        this.annotate(node, message);
                    }
                }
            }
        });
        this.observer.observe(list, { childList: true });
        await frame();
        await frame();
    }
    private annotate(host: HTMLElement, message: ProductMessage): void {
        if (host.getAttribute('data-role') !== message.role)
            throw new Error('Product DOM/runtime role divergence');
        host.dataset['benchMessageId'] = message.id;
        this.mounted.set(message.id, host);
        this.intersection?.observe(host);
    }
    connectReplay(url: string): void { this.assertAlive(); this.transport.connect(url); this.submitError = null; this.submit = this.agent.submit(null).catch(error => { this.submitError = String(error); }); }
    async waitForReplay(): Promise<void> { await this.submit; }
    readProgress(): RuntimeProgress {
        this.assertAlive();
        const messages = this.agent.messages(), last = messages.at(-1), hasResponse = messages.length > this.historyCount && last?.role === 'assistant';
        const loading = this.agent.isLoading() || this.agent.isThreadLoading(), productError = this.agent.error(), error = productError ? String(productError) : this.submitError;
        if (!hasResponse)
            return { activeMessage: null, delivery: error ? 'error' : 'idle', outcome: error ? 'error' : null, loading, error };
        if (last.delivery.phase === 'streaming')
            return { activeMessage: { id: last.id, role: 'assistant', text: raw(last), status: 'streaming' }, delivery: 'streaming', outcome: null, loading, error };
        const outcome = last.delivery.outcome;
        if (outcome === 'success')
            return { activeMessage: null, delivery: 'complete', outcome: 'success', loading, error };
        const reason = error ?? `Product delivery outcome: ${outcome}`;
        return { activeMessage: null, delivery: outcome === 'aborted' ? 'aborted' : 'error', outcome: outcome === 'aborted' ? 'aborted' : 'error', loading, error: reason };
    }
    readTranscript(): RuntimeTranscriptSnapshot {
        const progress = this.readProgress();
        return { transcript: this.agent.messages().map(m => { if (m.role !== 'user' && m.role !== 'assistant')
                throw new Error('Unexpected prose message role'); return { id: m.id, role: m.role, text: raw(m), status: m.delivery.phase === 'streaming' ? 'streaming' : 'complete' }; }), activeMessageId: progress.activeMessage?.id ?? null, delivery: progress.delivery, outcome: progress.outcome, loading: progress.loading, error: progress.error };
    }
    readVisibleMessages(): readonly VisibleMessage[] {
        this.assertAlive();
        const viewport = document.querySelector(this.locators.scroller)?.getBoundingClientRect();
        if (!viewport)
            return [];
        const result: VisibleMessage[] = [];
        for (const host of this.visible) {
            const rect = host.getBoundingClientRect();
            if (rect.bottom <= viewport.top || rect.top >= viewport.bottom)
                continue;
            const id = host.dataset['benchMessageId']!;
            const content = document.querySelector(this.locators.messageContent(id));
            if (content)
                result.push({ id, text: content.textContent ?? '', topCssPx: rect.top, bottomCssPx: rect.bottom });
        }
        return result.sort((a, b) => a.topCssPx - b.topCssPx);
    }
    readActiveDom(): ActiveDomSnapshot {
        this.assertAlive();
        const messages = this.agent.messages(), actual = messages.at(-1);
        const id = actual?.role === 'assistant' && messages.length > this.historyCount ? actual.id : null;
        const content = id ? document.querySelector(this.locators.messageContent(id)) : null;
        return { activeMessageId: id, mounted: content !== null, text: content?.textContent ?? null, mountedMessageCount: this.mounted.size };
    }
    drainCaptureEvents() { this.assertAlive(); return this.transport.drainEvidence(); }
    markPhase(phase: ComparisonPhase, boundary: 'start' | 'end'): AdapterPhaseBoundary {
        this.assertAlive();
        if (boundary === 'start') {
            if (this.phase)
                throw new Error('Scored phase already open');
            this.phase = { phase, instanceId: String(this.ordinal++), boundary, timestampMs: performance.now() };
        }
        else if (!this.phase || this.phase.phase !== phase)
            throw new Error('Phase end does not match open phase');
        const event = { phase, instanceId: this.phase!.instanceId, boundary, timestampMs: performance.now() };
        const mark=performance.mark(`bench:comparison:${event.phase}:${event.instanceId}:${boundary}`);
        event.timestampMs=mark.startTime;
        if (boundary === 'end')
            this.phase = null;
        return event;
    }
    private disconnect(): void { this.observer?.disconnect(); this.intersection?.disconnect(); this.observer = null; this.intersection = null; this.visible.clear(); this.mounted.clear(); }
    async resetThread(): Promise<void> { this.assertAlive(); await this.agent.stop(); await this.submit; await this.loadHistory([]); }
    async dispose(): Promise<void> { if (this.disposed)
        return; this.disposed = true; this.transport.dispose(); await this.agent.stop(); await this.submit; this.disconnect(); if (window.benchHost === this)
        delete window.benchHost; this.destroy(); }
}
