export type ProfileId = 'threadplane' | 'copilotkit' | 'assistant-ui' | 'vercel-ai-sdk';
export type ProseMessage = Readonly<{id: string; role: 'user' | 'assistant'; text: string}>;
export interface PublicContext {
  readonly schema: 1;
  readonly profile: ProfileId;
  readonly threadId: string;
  readonly runId: string;
  readonly canonicalResponseId: string;
  readonly history: readonly ProseMessage[];
  readonly workload: Readonly<{seed: 1; historyCount: 100; responseBytes: 6400; deltaCount: 200; deltaIntervalMs: 50; journey: 'follow' | 'history-reading'}>;
  readonly digests: Readonly<{sourceSha256: string; historySha256: string; responseSha256: string}>;
}
export interface Capabilities {
  readonly rendering: 'all-mounted' | 'virtualized';
  readonly scrollPolicy: 'bottom-follow' | 'turn-anchoring' | 'manual';
  readonly returnToResponse: 'native-control' | 'unsupported';
}
export interface BenchSnapshot {
  readonly messages: readonly ProseMessage[];
  readonly running: boolean;
  readonly error: string | null;
  readonly responseId: string | null;
  readonly operation: Readonly<{kind: 'original-run-promise' | 'public-runtime-state-transition'; status: 'idle' | 'pending' | 'fulfilled' | 'rejected'}>;
}
/** Functional observation only: this bridge grants no measurement/FPS authority. */
export interface CompetitorBench {
  read(): BenchSnapshot;
  start(): void;
  waitForRun(): Promise<void>;
  dispose(): Promise<void>;
  readonly selectors: Readonly<{scroller: string; composer: string; message: string; messageContent: string; returnToResponse: string | null}>;
  readonly capabilities: Capabilities;
}
declare global {
  interface Window {
    competitorBench?: CompetitorBench;
    competitorBenchError?: string;
  }
}
