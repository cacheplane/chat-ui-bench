import type { Message, ReplayEvent } from './fixture.js';
export interface TranscriptMessage { readonly id: string; readonly role: 'user' | 'assistant'; readonly text: string; readonly status: 'streaming' | 'complete' }
export interface AdapterProbes {
  readonly transcript: readonly TranscriptMessage[];
  /** Null after assistant-complete. */
  readonly activeMessageId: string | null;
  readonly lastAppliedSequence: number | null;
}
export interface ChatAdapter {
  loadHistory(history: readonly Message[]): void | Promise<void>;
  connectReplay(url: string): void | Promise<void>;
  resetThread(): void | Promise<void>;
  dispose(): void | Promise<void>;
  readonly probes: AdapterProbes;
}
export interface ReplayReceiver { applyEvent(event: ReplayEvent): void }
export const adapterLocators = {
  scroll: '[data-testid="chat-scroll"]', composer: '[data-testid="composer"]',
  message: '[data-message-id]', activeResponse: '[data-testid="active-response"]',
} as const;
