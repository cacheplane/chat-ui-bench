import { payloadBytes, type Observation, type Phase, type ReplayEvent } from '@chat-ui-bench/contract';

interface PendingPrefix { sequence: number; prefix: string; receiptMs: number }
/** Bounded to one active response. The DOM observer supplies text only from that node. */
export class PageObservations {
  private entries: Observation[] = [];
  private pending: PendingPrefix[] = [];
  private expected = '';
  private receivedSequence: number | null = null;
  private representedSequence: number | null = null;
  private readonly phaseTimeline: { phase: Phase; timestampMs: number }[] = [{ phase: 'setup', timestampMs: 0 }];
  phase: Phase = 'setup';
  constructor(readonly repetition: string, private readonly now: () => number) {}
  record(kind: string, sequence: number | null, data: Observation['data'], timestampMs = this.now(), phase = this.phase): void {
    this.entries.push({ schemaVersion: 1, kind, clockDomain: 'page-performance-ms', repetition: this.repetition, phase, sequence, timestampMs, data });
  }
  setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimeline.push({ phase, timestampMs: this.now() });
    this.record('phase', null, { phase });
  }
  recordPerformance(kind: string, data: Observation['data'], startTime: number): void {
    const phase = this.phaseTimeline.findLast(boundary => boundary.timestampMs <= startTime)?.phase ?? 'setup';
    this.record(kind, null, { ...data, observedAtMs: this.now() }, startTime, phase);
  }
  receive(event: ReplayEvent): void {
    const receiptMs = this.now();
    if (event.type === 'assistant-start') {
      this.expected = ''; this.pending = []; this.representedSequence = null;
    }
    this.expected += event.text;
    this.receivedSequence = event.sequence;
    this.pending.push({ sequence: event.sequence, prefix: this.expected, receiptMs });
    this.record('receipt', event.sequence, { eventType: event.type, messageId: event.messageId, payloadBytes: payloadBytes(event.text) }, receiptMs);
    this.recordBacklog('receipt', receiptMs);
  }
  checkpoint(visibleText: string, timestampMs = this.now()): void {
    while (this.pending.length && visibleText.startsWith(this.pending[0]!.prefix)) {
      const prefix = this.pending.shift()!;
      this.representedSequence = prefix.sequence;
      this.record('dom-checkpoint', prefix.sequence, {
        receiptMs: prefix.receiptMs, characterLength: prefix.prefix.length, utf8Bytes: payloadBytes(prefix.prefix),
      }, timestampMs);
    }
    this.recordBacklog('checkpoint', timestampMs);
  }
  private recordBacklog(sample: 'receipt' | 'checkpoint', timestampMs: number): void {
    this.record('dom-backlog', this.receivedSequence, {
      sample,
      receivedSequence: this.receivedSequence, representedSequence: this.representedSequence,
      backlog: this.receivedSequence === null ? 0 : this.receivedSequence - (this.representedSequence ?? 0),
    }, timestampMs);
  }
  reset(): void { this.pending = []; this.expected = ''; this.receivedSequence = null; this.representedSequence = null; }
  drain(): Observation[] { const entries = this.entries; this.entries = []; return entries; }
}

export interface InstrumentationAvailability {
  eventTiming: { supported: boolean; durationThresholdMs: number | null; reason: string | null };
  longAnimationFrame: { supported: boolean; reason: string | null };
}
export function observePerformance(observations: PageObservations): { availability: InstrumentationAvailability; dispose(): void } {
  const observers: PerformanceObserver[] = [];
  const availability: InstrumentationAvailability = {
    eventTiming: { supported: false, durationThresholdMs: null, reason: 'Event Timing is unsupported' },
    longAnimationFrame: { supported: false, reason: 'Long Animation Frames are unsupported' },
  };
  const supported = typeof PerformanceObserver === 'undefined' ? [] : PerformanceObserver.supportedEntryTypes;
  if (supported.includes('event')) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const event = entry as PerformanceEventTiming;
          observations.recordPerformance('event-timing', { name: event.name, startTime: event.startTime, duration: event.duration, processingStart: event.processingStart, processingEnd: event.processingEnd, interactionId: event.interactionId }, event.startTime);
        }
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
      observers.push(observer);
      availability.eventTiming = { supported: true, durationThresholdMs: 16, reason: 'Entries below the accepted 16ms threshold may be absent; absence is unavailable, never zero latency' };
    } catch (error) { availability.eventTiming.reason = `Event Timing observer rejected: ${String(error)}`; }
  }
  if (supported.includes('long-animation-frame')) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) observations.recordPerformance('long-animation-frame', { startTime: entry.startTime, duration: entry.duration, details: entry.toJSON() }, entry.startTime);
      });
      observer.observe({ type: 'long-animation-frame', buffered: true });
      observers.push(observer); availability.longAnimationFrame = { supported: true, reason: null };
    } catch (error) { availability.longAnimationFrame.reason = `Long Animation Frame observer rejected: ${String(error)}`; }
  }
  observations.record('instrumentation-availability', null, { eventTiming: { ...availability.eventTiming }, longAnimationFrame: { ...availability.longAnimationFrame } });
  return { availability, dispose: () => observers.forEach(observer => observer.disconnect()) };
}
