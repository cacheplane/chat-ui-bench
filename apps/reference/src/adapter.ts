import {
  messageSchema, replayEventSchema, type AdapterProbes, type ChatAdapter, type Message,
  type Observation, type Phase, type ReplayEvent, type TranscriptMessage,
} from '@chat-ui-bench/contract';
import { observePerformance, PageObservations, type InstrumentationAvailability } from './observations.js';

export const faultModes = ['clean', 'stall', 'delayed-display', 'omit', 'scroll', 'retention-release', 'retention-retain'] as const;
export type FaultMode = typeof faultModes[number];
export interface ReferenceConfiguration { repetition: string; fault: FaultMode }
export type ReferenceReplayState = 'idle' | 'connecting' | 'streaming' | 'complete' | 'failed' | 'disposed';
export interface ReferenceEnvironment {
  document: Pick<Document, 'createElement'>;
  now(): number;
  setTimer(callback: () => void, delayMs: number): number;
  clearTimer(handle: number): void;
  createEventSource(url: string): EventSource;
  createMutationObserver(callback: MutationCallback): Pick<MutationObserver, 'observe' | 'disconnect'>;
  stall(durationMs: number): void;
}
const browserEnvironment = (): ReferenceEnvironment => ({
  document, now: () => performance.now(),
  setTimer: (fn, delay) => window.setTimeout(fn, delay), clearTimer: handle => window.clearTimeout(handle),
  createEventSource: url => new EventSource(url), createMutationObserver: callback => new MutationObserver(callback),
  stall: duration => { const until = performance.now() + duration; while (performance.now() < until) { /* synchronous calibration fault */ } },
});

/** This name and retainedBuffers property are intentionally preserved in production for heap ownership analysis. */
class ReferenceRetainedBufferOwner {
  readonly retainedBuffers: Uint8Array[] = [];
  allocate(retain: boolean): void {
    const buffer = new Uint8Array(4 * 1024 * 1024);
    buffer.fill(1);
    if (retain) this.retainedBuffers.push(buffer);
  }
  release(): void { this.retainedBuffers.length = 0; }
}
const referenceRetainedBufferOwner = new ReferenceRetainedBufferOwner();

export class ReferenceAdapter implements ChatAdapter {
  private readonly env: ReferenceEnvironment;
  private readonly scroll: HTMLElement;
  private readonly composer: HTMLTextAreaElement;
  private readonly returnButton: HTMLButtonElement;
  private readonly observations: PageObservations;
  private readonly mutationObserver: Pick<MutationObserver, 'observe' | 'disconnect'>;
  private readonly performanceInstrumentation: ReturnType<typeof observePerformance>;
  private messages: TranscriptMessage[] = [];
  private active: TranscriptMessage | null = null;
  private responseElement: HTMLElement | null = null;
  private sequence: number | null = null;
  private receivedSequence: number | null = null;
  private loaded = false;
  private disposed = false;
  private connected = false;
  private source: EventSource | null = null;
  private displayTimer: number | null = null;
  private following = true;
  private state: ReferenceReplayState = 'idle';
  readonly configuration: Readonly<ReferenceConfiguration>;

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.deltaY < 0) { this.following = false; this.observations.record('auto-follow', this.sequence, { enabled: false, reason: 'upward-wheel' }); }
  };
  private readonly onReturn = (): void => this.returnToBottom();
  private readonly onInput = (): void => this.observations.record('composer-input', null, {});

  constructor(root: ParentNode, configuration: ReferenceConfiguration, environment?: ReferenceEnvironment) {
    if (!faultModes.includes(configuration.fault)) throw new Error('Unknown fault mode');
    if (!configuration.repetition) throw new Error('A repetition ID is required');
    this.configuration = Object.freeze({ ...configuration });
    this.env = environment ?? browserEnvironment();
    const required = <T extends Element>(selector: string): T => {
      const node = root.querySelector<T>(selector);
      if (!node) throw new Error(`Missing reference locator: ${selector}`);
      return node;
    };
    this.scroll = required<HTMLElement>('[data-testid="chat-scroll"]');
    this.composer = required<HTMLTextAreaElement>('[data-testid="composer"]');
    this.returnButton = required<HTMLButtonElement>('[data-testid="return-to-bottom"]');
    this.observations = new PageObservations(configuration.repetition, this.env.now);
    this.mutationObserver = this.env.createMutationObserver(() => {
      if (!this.disposed && this.responseElement) this.observations.checkpoint(this.responseElement.textContent ?? '');
    });
    this.performanceInstrumentation = observePerformance(this.observations);
    this.scroll.addEventListener('wheel', this.onWheel, { passive: true });
    this.returnButton.addEventListener('click', this.onReturn);
    this.composer.addEventListener('input', this.onInput);
  }
  private ensureLive(): void { if (this.disposed) throw new Error('Adapter is disposed'); }
  private makeMessage(message: TranscriptMessage): HTMLElement {
    const row = this.env.document.createElement('article');
    row.dataset.messageId = message.id;
    row.dataset.role = message.role;
    row.dataset.status = message.status;
    row.textContent = message.text;
    return row;
  }
  loadHistory(history: readonly Message[]): void {
    this.ensureLive();
    if (this.loaded) throw new Error('History may be loaded only once per thread');
    if (this.state !== 'idle') throw new Error('History must be loaded before replay');
    const validated = history.map(message => messageSchema.parse(message));
    if (new Set(validated.map(message => message.id)).size !== validated.length) throw new Error('Duplicate history message ID');
    this.messages = validated.map(message => ({ ...message }));
    this.scroll.replaceChildren(...this.messages.map(message => this.makeMessage(message)));
    this.loaded = true; this.followBottom();
  }
  connectReplay(url: string): void {
    this.ensureLive();
    if (this.connected) throw new Error('Replay cannot reconnect or retry');
    this.connected = true; this.state = 'connecting';
    const source = this.env.createEventSource(url);
    this.source = source;
    source.onmessage = event => {
      try { this.applyEvent(replayEventSchema.parse(JSON.parse(event.data))); }
      catch (error) { this.fail(`invalid-event: ${error instanceof Error ? error.message : String(error)}`); }
    };
    source.onerror = () => this.fail('transport-disconnect');
  }
  private closeSource(): void {
    if (!this.source) return;
    this.source.onmessage = null; this.source.onerror = null; this.source.close(); this.source = null;
  }
  private clearDisplayTimer(): void {
    if (this.displayTimer !== null) { this.env.clearTimer(this.displayTimer); this.displayTimer = null; }
  }
  private fail(reason: string): void {
    if (this.state === 'complete' || this.state === 'disposed' || this.state === 'failed') return;
    this.state = 'failed'; this.closeSource(); this.clearDisplayTimer(); this.mutationObserver.disconnect();
    this.observations.record('replay-failure', this.receivedSequence, { reason });
  }
  applyEvent(input: ReplayEvent): void {
    this.ensureLive();
    if (this.state === 'failed' || this.state === 'complete') throw new Error('Replay is terminal');
    const event = replayEventSchema.parse(input);
    if (this.receivedSequence !== null && event.sequence <= this.receivedSequence) throw new Error('Duplicate or decreasing received sequence');
    // Receipt precedes semantic application and synchronous fault injection.
    this.observations.receive(event); this.receivedSequence = event.sequence;
    if (event.type === 'assistant-start') {
      if (this.active || this.messages.some(message => message.id === event.messageId)) throw new Error('Invalid assistant-start');
      this.active = { id: event.messageId, role: 'assistant', status: 'streaming', text: '' };
      this.messages.push(this.active);
      this.responseElement = this.makeMessage(this.active);
      this.responseElement.dataset.testid = 'active-response';
      this.scroll.append(this.responseElement);
      this.mutationObserver.observe(this.responseElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-status'] });
      this.state = 'streaming'; this.followBottom();
    } else {
      if (!this.active || this.active.id !== event.messageId) throw new Error('Unknown active response');
      if (event.type === 'text-delta') {
        if (!(this.configuration.fault === 'omit' && event.sequence === 75)) {
          this.active = { ...this.active, text: this.active.text + event.text };
          this.messages[this.messages.length - 1] = this.active;
        }
        if (this.configuration.fault === 'delayed-display') {
          if (this.displayTimer === null) this.displayTimer = this.env.setTimer(() => { this.displayTimer = null; this.flushDisplay(); }, 200);
        } else this.flushDisplay();
      } else {
        this.clearDisplayTimer(); this.flushDisplay();
        this.messages[this.messages.length - 1] = { ...this.active, status: 'complete' };
        this.responseElement!.dataset.status = 'complete';
        this.active = null; this.state = 'complete'; this.closeSource();
      }
    }
    this.sequence = event.sequence;
    this.observations.record('application', event.sequence, { eventType: event.type, omitted: this.configuration.fault === 'omit' && event.sequence === 75, activeMessageId: this.active?.id ?? null });
    if (event.type === 'text-delta' && event.sequence === 50 && this.configuration.fault === 'stall') {
      const startTime = this.env.now(); this.env.stall(120);
      this.observations.record('fault-stall', event.sequence, { afterSequence: 50, durationMs: this.env.now() - startTime, configuredDurationMs: 120 }, startTime);
    }
  }
  private flushDisplay(): void {
    if (this.active && this.responseElement) { this.responseElement.textContent = this.active.text; this.followBottom(); }
  }
  private followBottom(): void {
    if (this.following) this.scroll.scrollTop = Math.max(0, this.scroll.scrollHeight - this.scroll.clientHeight);
  }
  returnToBottom(): void {
    this.ensureLive(); this.following = true; this.followBottom();
    this.observations.record('auto-follow', this.sequence, { enabled: true, reason: 'explicit-return-to-bottom' });
  }
  setPhase(phase: Phase): void {
    this.ensureLive(); this.observations.setPhase(phase);
  }
  closeScoredPhase(): void { this.ensureLive(); this.observations.closeScoredPhase(); }
  get replayState(): ReferenceReplayState { return this.state; }
  get autoFollow(): boolean { return this.following; }
  get instrumentation(): InstrumentationAvailability { return this.performanceInstrumentation.availability; }
  get probes(): AdapterProbes {
    const adapter = this;
    return Object.freeze({
      get transcript() { return Object.freeze(adapter.messages.map(message => Object.freeze({ ...message }))); },
      get activeMessageId() { return adapter.active?.id ?? null; },
      get lastAppliedSequence() { return adapter.sequence; },
    });
  }
  drainObservations(): Observation[] { return this.observations.drain(); }
  resetThread(): void {
    this.ensureLive(); this.closeSource(); this.clearDisplayTimer(); this.mutationObserver.disconnect();
    this.messages = []; this.active = null; this.responseElement = null; this.sequence = null; this.receivedSequence = null;
    this.loaded = false; this.connected = false; this.following = true; this.state = 'idle';
    this.scroll.replaceChildren(); this.observations.reset();
    if (this.configuration.fault === 'retention-retain' || this.configuration.fault === 'retention-release') {
      referenceRetainedBufferOwner.allocate(this.configuration.fault === 'retention-retain');
      this.observations.record('retention-reset', null, { allocatedBytes: 4 * 1024 * 1024, retainedBufferCount: referenceRetainedBufferOwner.retainedBuffers.length, ownerClass: 'ReferenceRetainedBufferOwner', ownerProperty: 'retainedBuffers' });
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.observations.setPhase('disposal');
    this.closeSource(); this.clearDisplayTimer(); this.mutationObserver.disconnect(); this.performanceInstrumentation.dispose();
    this.scroll.removeEventListener('wheel', this.onWheel); this.returnButton.removeEventListener('click', this.onReturn); this.composer.removeEventListener('input', this.onInput);
    this.messages = []; this.active = null; this.responseElement = null; this.scroll.replaceChildren();
    referenceRetainedBufferOwner.release(); this.disposed = true; this.state = 'disposed';
  }
}
