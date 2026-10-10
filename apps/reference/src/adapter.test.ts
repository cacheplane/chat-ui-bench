import { describe, expect, it } from 'vitest';
import { createCalibrationFixture, observationSchema, type ReplayEvent } from '@chat-ui-bench/contract';
import { ReferenceAdapter } from './adapter.js';

// Only a deterministic DOM/lifecycle seam. Browser timing and scroll acceptance are runner work.
class Element {
  textContent = ''; dataset: Record<string, string> = {}; children: Element[] = [];
  scrollTop = 0; scrollHeight = 5000; clientHeight = 500;
  events = new Map<string, (event: any) => void>();
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  addEventListener(type: string, fn: (event: any) => void) { this.events.set(type, fn); }
  removeEventListener(type: string) { this.events.delete(type); }
  setAttribute(name: string, value: string) { if (name === 'data-testid') this.dataset.testid = value; }
  removeAttribute(name: string) { if (name === 'data-testid') delete this.dataset.testid; }
}
function harness(fault = 'clean') {
  const scroller = new Element(), composer = new Element(), button = new Element();
  const root = { querySelector: (selector: string) => selector.includes('chat-scroll') ? scroller : selector.includes('composer') ? composer : button };
  const document = { createElement: () => new Element() };
  let time = 0, observed: Element | undefined, callback: (() => void) | undefined, disconnects = 0, sourceClosed = 0;
  let nextTimer = 0;
  const timers = new Map<number, () => void>();
  const source: any = { onmessage: null, onerror: null, close: () => sourceClosed++ };
  const adapter = new ReferenceAdapter(root as any, { repetition: 'r1', fault }, {
    document, now: () => time,
    setTimer: (fn: () => void) => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimer: (id: number) => timers.delete(id),
    createEventSource: () => source,
    createMutationObserver: (fn: () => void) => { callback = fn; return { observe: (element: Element) => { observed = element; }, disconnect: () => disconnects++ }; },
    stall: (duration: number) => { time += duration; },
  });
  const fixture = createCalibrationFixture();
  return {
    adapter, scroller, composer, button, fixture, source, timers,
    mutation: (target: Element | undefined = observed) => { if (target === observed) callback?.(); },
    observed: () => observed, disconnects: () => disconnects, sourceClosed: () => sourceClosed,
    flush: () => { time += 200; const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
  };
}
describe('reference semantic adapter', () => {
  it('loads plain-text history once and applies exact text with read-only probes', () => {
    const h = harness();
    h.adapter.loadHistory(h.fixture.history);
    expect(() => h.adapter.loadHistory(h.fixture.history)).toThrow(/once|loaded/i);
    h.fixture.events.forEach(e => h.adapter.applyEvent(e));
    expect(h.adapter.probes.transcript).toHaveLength(101);
    expect(h.adapter.probes.transcript.at(-1).text).toBe(h.fixture.events.map(e => e.text).join(''));
    expect(h.adapter.probes.activeMessageId).toBeNull();
    expect(h.adapter.probes.lastAppliedSequence).toBe(201);
    expect(Object.isFrozen(h.adapter.probes.transcript)).toBe(true);
    h.adapter.dispose();
  });
  it('records receipts before application; unrelated history mutations do not trigger a scan', () => {
    const h = harness();
    h.adapter.loadHistory(h.fixture.history);
    h.adapter.applyEvent(h.fixture.events[0]!);
    h.adapter.applyEvent(h.fixture.events[1]!);
    h.adapter.drainObservations();
    h.mutation(h.scroller.children[0]);
    expect(h.adapter.drainObservations()).toEqual([]);
    h.mutation();
    const checkpoints = h.adapter.drainObservations();
    expect(checkpoints.filter(e => e.kind === 'dom-checkpoint').map(e => e.sequence)).toEqual([0, 1]);
    checkpoints.forEach(e => expect(observationSchema.safeParse(e).success).toBe(true));
    h.adapter.dispose();
  });
  it('continues receipts with delayed display; completion flushes pending text', () => {
    const h = harness('delayed-display');
    const events = h.fixture.events;
    events.slice(0, 4).forEach(e => h.adapter.applyEvent(e));
    expect(h.observed()!.textContent).toBe('');
    expect(h.adapter.drainObservations().filter(e => e.kind === 'receipt')).toHaveLength(4);
    h.flush(); h.mutation();
    expect(h.observed()!.textContent).toBe(events.slice(0, 4).map(e => e.text).join(''));
    h.adapter.applyEvent(events[4]!);
    h.adapter.applyEvent(events.at(-1)!);
    expect(h.observed()!.textContent).toBe(events.slice(0, 5).map(e => e.text).join(''));
    expect(h.timers.size).toBe(0);
    h.adapter.dispose();
  });
  it('omits delta75 from logical and visible text and keeps the wrong completed output', () => {
    const h = harness('omit');
    h.fixture.events.forEach(e => h.adapter.applyEvent(e));
    const correct = h.fixture.events.map(e => e.text).join('');
    expect(h.adapter.probes.transcript.at(-1).text).not.toBe(correct);
    expect(h.adapter.probes.transcript.at(-1).text).toBe(h.fixture.events.filter(e => e.sequence !== 75).map(e => e.text).join(''));
    expect(h.adapter.probes.activeMessageId).toBeNull();
    h.adapter.dispose();
  });
  it('synchronously stalls120ms immediately after delta50 application', () => {
    const h = harness('stall');
    h.fixture.events.slice(0, 51).forEach(e => h.adapter.applyEvent(e));
    const logs = h.adapter.drainObservations();
    expect(logs.find(e => e.kind === 'fault-stall')?.data).toMatchObject({ durationMs: 120, afterSequence: 50 });
    expect(h.adapter.probes.lastAppliedSequence).toBe(50);
    h.adapter.dispose();
  });
  it('upward user wheel pauses follow until explicit return-to-bottom', () => {
    const h = harness('scroll');
    h.scroller.events.get('wheel')!({ deltaY: -200 });
    h.scroller.scrollTop = 500;
    h.fixture.events.slice(0, 3).forEach(e => h.adapter.applyEvent(e));
    expect(h.adapter.autoFollow).toBe(false);
    expect(h.scroller.scrollTop).toBe(500);
    h.adapter.returnToBottom();
    expect(h.adapter.autoFollow).toBe(true);
    expect(h.scroller.scrollTop).toBe(4500);
    h.adapter.dispose();
  });
  it('closes EventSource without retries, disconnects observers, clears delayed timers and listeners', () => {
    const h = harness('delayed-display');
    h.adapter.connectReplay('http://127.0.0.1/replay');
    h.fixture.events.slice(0, 2).forEach(e => h.adapter.applyEvent(e));
    h.adapter.dispose();
    expect(h.sourceClosed()).toBe(1);
    expect(h.disconnects()).toBe(1);
    expect(h.timers.size).toBe(0);
    expect(h.scroller.events.size).toBe(0);
  });
  it('transport error is terminal, closes the stream, and records a failure', () => {
    const h = harness();
    h.adapter.connectReplay('http://127.0.0.1/replay');
    h.source.onerror();
    expect(h.adapter.replayState).toBe('failed');
    expect(h.sourceClosed()).toBe(1);
    expect(h.adapter.drainObservations().at(-1)?.kind).toBe('replay-failure');
    h.adapter.dispose();
  });
  it.each(['retention-retain', 'retention-release'])('allocates exactly4MiB on each reset for %s without exposing buffers', fault => {
    const h = harness(fault);
    for (let i = 0; i < 5; i++) h.adapter.resetThread();
    const logs = h.adapter.drainObservations().filter(e => e.kind === 'retention-reset');
    expect(logs).toHaveLength(5);
    expect(logs.at(-1)?.data).toMatchObject({ allocatedBytes: 4 * 1024 * 1024, retainedBufferCount: fault === 'retention-retain' ? 5 : 0 });
    logs.forEach(e => expect(observationSchema.safeParse(e).success).toBe(true));
    h.adapter.dispose();
  });
});
