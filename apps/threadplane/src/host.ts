import type { LangGraphAgent } from '@threadplane/langgraph';
import type { Message as ProductMessage } from '@threadplane/chat';
import {COMPARISON_CAPTURE_LIMITS,type LongThreadCaptureHost,type Message,type RuntimeProgress,type RuntimeTranscriptSnapshot,type VisibleMessage,type ComparisonPhase,type AdapterPhaseBoundary,type ActiveDomSnapshot,type CaptureAvailability,type CaptureCandidate,type CaptureCandidates,type CaptureProgressLimits} from '@chat-ui-bench/contract';
import { ReplayTransport } from './replay-transport.js';
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function raw(message: ProductMessage): string { if (typeof message.content !== 'string')
    throw new Error('Unexpected structured content in prose profile'); return message.content; }
function diagnostic(value:unknown):string|null {
    if(value===null||value===undefined) return null;
    if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean') return '[opaque product error]';
    const text=typeof value==='string'?value:String(value);
    const cap=COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits;
    const suffix=' [diagnostic truncated]';
    return text.length<=cap?text:text.slice(0,cap-suffix.length)+suffix;
}
function ownData(value:object,key:string):unknown {
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor&&'value' in descriptor?descriptor.value:undefined;
}
function boundedUtf8(value:string,maxBytes:number):boolean {
    let bytes=0;
    for(let i=0;i<value.length;i++) {
        const code=value.charCodeAt(i);
        if(code<128) bytes++;
        else if(code<2048) bytes+=2;
        else if(code>=0xd800&&code<=0xdbff&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}
        else bytes+=3;
        if(bytes>maxBytes) return false;
    }
    return true;
}
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
    private identities = new Map<HTMLElement,{id:string;role:'user'|'assistant'}>();
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
                        this.identities.delete(node);
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
        if(message.role!=='user'&&message.role!=='assistant') throw new Error('Unexpected prose message role');
        this.identities.set(host,{id:message.id,role:message.role});
        this.intersection?.observe(host);
    }
    connectReplay(url: string): void { this.assertAlive(); this.transport.connect(url); this.submitError = null; this.submit = this.agent.submit(null).catch(error => { this.submitError = diagnostic(error)??'[empty product rejection]'; }); }
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
    private actualStreamingId():string|null {
        const messages=this.agent.messages(),last=messages.at(-1);
        if(!last||messages.length<=this.historyCount) return null;
        const role=ownData(last,'role');
        if(role==='user') return null;
        if(role!=='assistant') throw new Error('Actual active identity role unavailable');
        const delivery=ownData(last,'delivery');
        if(!delivery||typeof delivery!=='object') throw new Error('Actual active delivery unavailable');
        const phase=ownData(delivery,'phase');
        if(phase==='complete') return null;
        if(phase!=='streaming') throw new Error('Actual active delivery phase unavailable');
        const id=ownData(last,'id');
        if(typeof id!=='string'||id.length===0||id.length>COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits) throw new Error('Actual active identity unavailable within diagnostic limit');
        return id;
    }
    readActiveHost() {
        this.assertAlive();
        const activeMessageId=this.actualStreamingId(),host=activeMessageId===null?undefined:this.mounted.get(activeMessageId);
        return {activeMessageId,hostMounted:host?.isConnected===true};
    }
    readCaptureBufferState() {
        const actual=this.transport.readCaptureBufferState();
        return {name:actual.name,maxEntries:actual.maxEntries,maxSerializedBytes:actual.maxSerializedBytes,
            highWaterEntries:actual.highWaterEntries,highWaterSerializedBytes:actual.highWaterSerializedBytes,
            overflowCount:actual.overflowCount,rejectedRecordCount:actual.rejectedRecordCount,status:actual.status,
            ...(actual.reason===undefined?{}:{reason:actual.reason})};
    }
    readCaptureCandidates(maxCandidates:number):CaptureAvailability<CaptureCandidates> {
        this.assertAlive();
        if(!Number.isSafeInteger(maxCandidates)||maxCandidates<0||maxCandidates>COMPARISON_CAPTURE_LIMITS.maxHistoricalCandidates) return {status:'unavailable',reason:'Invalid historical candidate limit'};
        let activeId:string|null;
        try { activeId=this.actualStreamingId(); } catch { return {status:'unavailable',reason:'Actual active candidate identity unavailable'}; }
        const activeHost=activeId===null?undefined:this.mounted.get(activeId);
        const historicalCount=this.visible.size-(activeHost&&this.visible.has(activeHost)?1:0);
        if(historicalCount>maxCandidates) return {status:'unavailable',reason:'Historical candidate limit exceeded before iteration'};
        const candidate=(host:HTMLElement,id:string,role:'user'|'assistant'):CaptureCandidate=>({id,role,hostElement:host,contentElement:host.querySelector('.chat-message__bubble, .chat-message__assistant-body > chat-streaming-md')});
        const historical:CaptureCandidate[]=[];
        for(const host of this.visible) {
            if(host===activeHost) continue;
            const identity=this.identities.get(host);
            if(!identity||identity.id.length>COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits) return {status:'unavailable',reason:'Actual bounded candidate identity unavailable'};
            historical.push(candidate(host,identity.id,identity.role));
        }
        const active=activeId!==null&&activeHost?candidate(activeHost,activeId,'assistant'):null;
        return {status:'available',value:{historical,active}};
    }
    readCaptureProgress(limits:CaptureProgressLimits):CaptureAvailability<RuntimeProgress> {
        this.assertAlive();
        if(limits.maxRuntimeCodeUnits!==COMPARISON_CAPTURE_LIMITS.maxRuntimeCodeUnits||limits.maxRuntimeUtf8Bytes!==COMPARISON_CAPTURE_LIMITS.maxRuntimeUtf8Bytes) return {status:'unavailable',reason:'Unsupported runtime capture limits'};
        const messages=this.agent.messages(),last=messages.at(-1);
        const loading=this.agent.isLoading()||this.agent.isThreadLoading(),error=diagnostic(this.agent.error())??this.submitError;
        const absent:RuntimeProgress={activeMessage:null,delivery:error?'error':'idle',outcome:error?'error':null,loading,error};
        if(!last||messages.length<=this.historyCount) return {status:'available',value:absent};
        const role=ownData(last,'role'),id=ownData(last,'id'),delivery=ownData(last,'delivery');
        if(role==='user') return {status:'available',value:absent};
        if(role!=='assistant') return {status:'unavailable',reason:'Actual runtime role must be an own supported data property'};
        if(typeof id!=='string'||id.length===0||id.length>COMPARISON_CAPTURE_LIMITS.maxDiagnosticFieldCodeUnits||!delivery||typeof delivery!=='object') return {status:'unavailable',reason:'Actual runtime identity or delivery unavailable'};
        const phase=ownData(delivery,'phase');
        if(phase==='streaming') {
            const content=ownData(last,'content');
            if(typeof content!=='string') return {status:'unavailable',reason:'Actual runtime content must be an own string data property'};
            if(content.length>limits.maxRuntimeCodeUnits||!boundedUtf8(content,limits.maxRuntimeUtf8Bytes)) return {status:'unavailable',reason:'Runtime content limit exceeded'};
            return {status:'available',value:{activeMessage:{id,role:'assistant',text:content,status:'streaming'},delivery:'streaming',outcome:null,loading,error}};
        }
        const outcome=ownData(delivery,'outcome');
        if(phase!=='complete'||!['success','aborted','error','interrupted','paused'].includes(outcome as string)) return {status:'unavailable',reason:'Unsupported actual runtime delivery state'};
        if(outcome==='success') return {status:'available',value:{activeMessage:null,delivery:'complete',outcome:'success',loading,error}};
        const state=outcome==='aborted'?'aborted':'error';
        return {status:'available',value:{activeMessage:null,delivery:state,outcome:state,loading,error:error??`Product delivery outcome: ${outcome}`}};
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
    private disconnect(): void { this.observer?.disconnect(); this.intersection?.disconnect(); this.observer = null; this.intersection = null; this.visible.clear(); this.mounted.clear();this.identities.clear(); }
    async resetThread(): Promise<void> { this.assertAlive(); await this.agent.stop(); await this.submit; await this.loadHistory([]); }
    async dispose(): Promise<void> { if (this.disposed)
        return; this.disposed = true; this.transport.dispose(); await this.agent.stop(); await this.submit; this.disconnect(); if (window.benchHost === this)
        delete window.benchHost; this.destroy(); }
}
