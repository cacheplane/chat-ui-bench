import type { AdapterProbes, Message, Observation, Phase } from '@chat-ui-bench/contract';
import { ReferenceAdapter, type ReferenceConfiguration, type ReferenceReplayState } from './adapter.js';
import type { InstrumentationAvailability } from './observations.js';
import './styles.css';

/**
 * Runner integration: await window.chatBench.ready, configure({ repetition, fault }),
 * loadHistory(fixture.history), setPhase('streaming-auto-follow'), connectReplay(url).
 * Poll replayState/lastAppliedSequence without copying history; drainObservations incrementally.
 * Read probes.transcript only during validation. Use fresh browser processes per repetition.
 * Phases: setup, streaming-auto-follow, composer-input, gesture-scroll, return-to-bottom,
 * validation, retention, disposal. setPhase emits trace-visible performance.mark markers.
 * dispose closes transport/observers/timers; observations remain drainable afterward.
 * Retention diagnostics use five resetThread calls in retention phase then CDP snapshots;
 * stable heap path: ReferenceRetainedBufferOwner -> retainedBuffers -> Uint8Array -> buffer.
 */
export interface ReferenceBrowserAPI {
  readonly ready: true;
  configure(configuration: ReferenceConfiguration): void;
  loadHistory(history: readonly Message[]): void;
  connectReplay(url: string): void;
  resetThread(): void;
  dispose(): void;
  setPhase(phase: Phase): void;
  returnToBottom(): void;
  drainObservations(): Observation[];
  readonly probes: AdapterProbes;
  readonly replayState: ReferenceReplayState;
  readonly autoFollow: boolean;
  readonly instrumentation: InstrumentationAvailability;
}
declare global { interface Window { chatBench: ReferenceBrowserAPI } }
const root = document.querySelector('#reference');
if (!root) throw new Error('Missing reference root');
let adapter: ReferenceAdapter | null = null;
const configured = (): ReferenceAdapter => {
  if (!adapter) throw new Error('Call chatBench.configure before using the reference');
  return adapter;
};
window.chatBench = Object.freeze({
  ready: true,
  configure: (configuration: ReferenceConfiguration) => { adapter?.dispose(); adapter = new ReferenceAdapter(root, configuration); },
  loadHistory: (history: readonly Message[]) => configured().loadHistory(history),
  connectReplay: (url: string) => configured().connectReplay(url),
  resetThread: () => configured().resetThread(),
  dispose: () => configured().dispose(),
  setPhase: (phase: Phase) => configured().setPhase(phase),
  returnToBottom: () => configured().returnToBottom(),
  drainObservations: () => configured().drainObservations(),
  get probes() { return configured().probes; },
  get replayState() { return configured().replayState; },
  get autoFollow() { return configured().autoFollow; },
  get instrumentation() { return configured().instrumentation; },
} satisfies ReferenceBrowserAPI);
