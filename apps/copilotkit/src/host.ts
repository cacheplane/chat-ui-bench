import type { AbstractAgent, RunAgentResult } from '@ag-ui/client';
import type { CopilotKitCore } from '@copilotkit/core';
import type { LongThreadAdapterHost, RuntimeProgress, RuntimeTranscriptSnapshot } from '../../../packages/contract/src/comparison.js';
import type { Message } from '../../../packages/contract/src/fixture.js';
import { COMPLETED_URL, CONTINUATION_URL, MOUNTED_URL, type CaseContext } from './context.js';
import { ownHistory, validateResponse } from './controls.js';
import {createGeometryCollector,createNativeGeometryPorts,type GeometrySnapshot} from './geometry.js';

const SETUP_TIMEOUT_MS = 60_000;
export const geometryQualification = Object.freeze({
  status: 'unqualified',
  reason: 'Native geometry, virtual stable anchors and visible text require future hosted qualification.',
});

export function boundedDiagnostic(reason: unknown): string {
  return (reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unknown page error').slice(0, 512);
}

/** Owned same-origin replies only; retain no unbounded response body. */
export async function readBoundedReply(response: Response, limit: number): Promise<string> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Owned server HTTP ${response.status}`);
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return text + decoder.decode();
      bytes += next.value.byteLength;
      if (bytes > limit) throw new Error('Owned reply exceeds bound');
      text += decoder.decode(next.value, { stream: true });
    }
  } catch (error) {
    await reader.cancel(error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export interface OwnedFrontendHost extends LongThreadAdapterHost {
  /** Effect cleanup closes admission only. The harness must await dispose(). */
  closeAdmission(reason?: unknown): void;
  observeError(reason: unknown): void;
  /** Public run settlement only; no full transcript validation in this wait. */
  waitForReplay(): Promise<void>;
  /** Call after ending the streaming phase; full H/R validation and commitment ACK. */
  validateCompletion(): Promise<void>;
  /** Full H100 DOM scan for unscored conformance and anchor observations only. */
  readGeometrySnapshot(): GeometrySnapshot;
  readonly geometryQualification: typeof geometryQualification;
}

export function createFrontendHost(context: CaseContext, agent: AbstractAgent, core: CopilotKitCore,
  destroy: () => void, initialError: string | null): OwnedFrontendHost {
  let closed = false;
  let error = initialError;
  let mounted = false;
  let continuation = false;
  let runSettled = false;
  let terminalSuccess = false;
  let successful = false;
  let setupPromise: Promise<void> | undefined;
  let replayPromise: Promise<void> | undefined;
  let validationPromise: Promise<void> | undefined;
  let runPromise: Promise<RunAgentResult> | undefined;
  let detachPromise: Promise<void> | undefined;
  let disposePromise: Promise<void> | undefined;
  const locators = {
    scroller: '[class~="cpk:overflow-y-auto"]:has(> div > [data-testid="copilot-scroll-content"])',
    composer: '[data-testid="copilot-chat-textarea"]',
    returnToResponse: '[data-testid="copilot-scroll-to-bottom"]',
    messageHost(messageId: string): string {
      if(messageId!==context.response.id&&!context.history.some(message=>message.id===messageId))throw new Error('Unknown message locator identity');
      return `[data-message-id="${CSS.escape(messageId)}"]`;
    },
    messageContent(messageId: string): string {
      const expected = messageId === context.response.id ? context.response : context.history.find(message => message.id === messageId);
      if (!expected) throw new Error('Unknown message locator identity');
      const role = expected.role === 'assistant' ? 'copilot-assistant-message' : 'copilot-user-message';
      return `[data-testid="${role}"][data-message-id="${CSS.escape(messageId)}"] > div:first-child`;
    },
  };
  const geometry = createGeometryCollector(context,locators,createNativeGeometryPorts(document,window));
  const acknowledgements = new Set<Promise<void>>();
  function observeError(reason: unknown): void { error = boundedDiagnostic(reason); }
  const agentSubscription = agent.subscribe({
    onRunFailed: ({ error: reason }) => { observeError(reason); },
    onRunErrorEvent: ({ event }) => { observeError(event.message); },
    onRunFinishedEvent: ({event,outcome})=> {
      if(event.runId!==context.ids.continuationRunId) return;
      terminalSuccess=outcome==='success';
      if(!terminalSuccess) observeError(`Original public terminal outcome: ${outcome}`);
    },
  });
  const coreSubscription = core.subscribe({ onError: ({ error: reason }) => { observeError(reason); } });
  function open(): void {
    if (closed) throw new Error('Frontend admission closed; cases cannot retry or reuse');
    if (error !== null) throw new Error(error);
  }
  function exactHistory(withResponse: boolean, finalResponse = true): void {
    if (agent.threadId !== context.ids.threadId || agent.messages.length !== context.history.length + (withResponse ? 1 : 0)) throw new Error('Restored public thread/history length differs');
    // Unscored boundary only: reject additional historical fields, including
    // metadata, rather than silently projecting a changed public transcript.
    const actualHistory = ownHistory(agent.messages.slice(0, context.history.length));
    for (let i = 0; i < context.history.length; i++) {
      const expected = context.history[i];
      const actual = actualHistory[i];
      if (!expected || !actual || actual.id !== expected.id || actual.role !== expected.role || actual.content !== expected.content) throw new Error('Restored public history differs');
    }
    if (withResponse && finalResponse) validateResponse(agent.messages[context.history.length], context.response);
  }
  async function waitForIdleHistory(withResponse: boolean): Promise<void> {
    const deadline = performance.now() + SETUP_TIMEOUT_MS;
    for (;;) {
      open();
      if (!agent.isRunning) {
        try { exactHistory(withResponse); return; }
        catch (reason) {
          if (performance.now() >= deadline) throw reason;
        }
      }
      if (performance.now() >= deadline) throw new Error('Public idle/history setup deadline exceeded');
      await new Promise<void>(resolve => { setTimeout(resolve, 20); });
    }
  }
  function post(url: typeof MOUNTED_URL | typeof COMPLETED_URL, payload: unknown): Promise<void> {
    const acknowledgement = (async () => {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(SETUP_TIMEOUT_MS) });
      await readBoundedReply(response, 4096);
    })();
    acknowledgements.add(acknowledgement);
    // Retain original acknowledgements through disposal, including rejections.
    return acknowledgement;
  }
  function loadHistory(history: readonly Message[]): Promise<void> {
    open();
    if (setupPromise) throw new Error('History admission is once-only');
    if (history.length !== context.history.length || history.some((message, i) => {
      const expected = context.history[i];
      return !expected || message.id !== expected.id || message.role !== expected.role || message.text !== expected.content || message.status !== 'complete';
    })) throw new Error('Requested full history differs from committed context');
    setupPromise = (async () => {
      await waitForIdleHistory(false);
      open();
      exactHistory(false);
      await post(MOUNTED_URL, { threadId: agent.threadId, messages: agent.messages, idle: !agent.isRunning, error });
      open();
      exactHistory(false);
      if (agent.isRunning) throw new Error('Public agent resumed during mounted acknowledgement');
      mounted = true;
    })();
    return setupPromise;
  }
  function connectReplay(url: string): Promise<void> {
    open();
    if (url !== CONTINUATION_URL || context.continuationUrl !== CONTINUATION_URL) throw new Error('Only fixed owned continuation is admitted');
    if (!mounted || continuation) throw new Error('Independent mounted gate and once-only continuation required');
    if (agent.isRunning) throw new Error('Mounted public agent must be idle');
    continuation = true;
    // Keep the original public operation; observer completion is not settlement.
    try { runPromise = core.runAgent({ agent, runId: context.ids.continuationRunId }); }
    catch (reason) { observeError(reason); throw reason; }
    const originalRun = runPromise;
    replayPromise = (async () => {
      try {
        try { await originalRun; }
        finally { runSettled = true; }
        if(!terminalSuccess) throw new Error('Missing successful original public terminal');
      } catch (reason) { observeError(reason); throw reason; }
    })();
    return replayPromise;
  }
  function validateCompletion():Promise<void> {
    open();
    if(!replayPromise || validationPromise) throw new Error('Completed transcript admission is once-only after continuation');
    const originalReplay=replayPromise;
    validationPromise=(async()=> {
      try {
        await originalReplay;
        await waitForIdleHistory(true);
        open();
        exactHistory(true);
        await post(COMPLETED_URL, { threadId: agent.threadId, messages: agent.messages, idle: !agent.isRunning, publicSettled: true, outcome: 'success' });
        open();
        successful = true;
      } catch (reason) { observeError(reason); throw reason; }
    })();
    return validationPromise;
  }
  function readProgress(): RuntimeProgress {
    // Scored observation touches only the public last message and small scalars.
    const last = agent.messages[agent.messages.length - 1];
    const complete=runSettled && terminalSuccess && !agent.isRunning && error===null;
    const active = continuation && !complete && last?.id === context.ids.responseId ? last : undefined;
    if (active && (active.role !== 'assistant' || typeof active.content !== 'string' || active.content.length > 6400)) throw new Error('Active public response exceeds admitted shape/bound');
    if (active && typeof active.content === 'string' && new TextEncoder().encode(active.content).byteLength > 6400) throw new Error('Active public response exceeds UTF-8 byte bound');
    return {
      activeMessage: active && typeof active.content === 'string' ? { id: active.id, role: 'assistant', text: active.content, status: runSettled && !agent.isRunning ? 'complete' : 'streaming' } : null,
      delivery: error !== null ? 'error' : complete ? 'complete' : continuation ? 'streaming' : 'idle',
      outcome: error !== null ? 'error' : complete ? 'success' : null,
      loading: agent.isRunning, error,
    };
  }
  function readTranscript(): RuntimeTranscriptSnapshot {
    // Full transcript access is only for unscored validation.
    const withResponse=continuation && agent.messages.length===context.history.length+1;
    exactHistory(withResponse,false);
    if(withResponse) {
      const response=agent.messages[context.history.length];
      if(!response || response.role!=='assistant' || response.id!==context.ids.responseId || typeof response.content!=='string') throw new Error('Unsupported raw assistant transcript');
      validateResponse(response,{id:response.id,role:'assistant',content:response.content});
    }
    const progress = readProgress();
    return { transcript: agent.messages.map(message => {
      if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') throw new Error('Unexpected public transcript shape');
      return { id: message.id, role: message.role, text: message.content,
        status: message.id === context.ids.responseId && progress.delivery!=='complete' ? 'streaming' : 'complete' };
    }), activeMessageId: progress.activeMessage?.id ?? null, delivery: progress.delivery,
    outcome: progress.outcome, loading: progress.loading, error: progress.error };
  }
  function closeAdmission(reason?: unknown): void {
    const unexpected = !closed;
    closed = true;
    geometry.dispose();
    if (unexpected && reason !== undefined) observeError(reason);
  }
  function readGeometrySnapshot(): GeometrySnapshot {
    open();
    const progress=readProgress(),phase=!continuation?'restored-history':successful?'completed':'streaming';
    return geometry.read(phase,{active:progress.loading&&progress.delivery==='streaming'&&progress.activeMessage!==null,
      prefix:phase==='completed'?context.response.content:progress.activeMessage?.text??''});
  }
  function dispose(): Promise<void> {
    if (disposePromise) return disposePromise;
    closeAdmission();
    disposePromise = (async () => {
      const deadline = performance.now() + 10_000;
      const failures: unknown[] = error === null ? [] : [new Error(error)];
      async function awaitOwned<T>(operation: Promise<T>): Promise<T> {
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw new Error('Frontend disposal deadline exceeded; original owner retained');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => { reject(new Error('Frontend disposal deadline exceeded; original owner retained')); }, remaining);
          })]);
        } finally { if (timer !== undefined) clearTimeout(timer); }
      }
      if (runPromise && !runSettled) {
        try { core.stopAgent({ agent }); }
        catch (reason) { observeError(reason); failures.push(reason); }
      }
      // A stop signal alone is not proof. Drain each original owner first.
      if (runPromise) {
        const settled = await awaitOwned(Promise.allSettled([runPromise]));
        for (const result of settled) if (result.status === 'rejected') failures.push(result.reason);
      }
      // Keep the public detach's own promise, including when the bounded wait
      // fails. A deadline never proves original operation settlement.
      detachPromise = agent.detachActiveRun();
      await awaitOwned(detachPromise);
      const settled = await awaitOwned(Promise.allSettled([...(setupPromise ? [setupPromise] : []), ...(replayPromise ? [replayPromise] : []), ...(validationPromise ? [validationPromise] : []), ...acknowledgements]));
      for (const result of settled) if (result.status === 'rejected') failures.push(result.reason);
      if(continuation && !successful) failures.push(new Error('Full completed transcript was not validated outside the streaming phase'));
      if (failures.length !== 0) throw new Error('Frontend disposal failed; original owner retained', { cause: failures[0] });
      agentSubscription.unsubscribe();
      coreSubscription.unsubscribe();
      destroy();
    })();
    return disposePromise;
  }
  return {
    // Source default configuration only; no hosted geometry qualification.
    capabilities: { rendering: 'virtualized', scrollPolicy: 'bottom-follow', returnToResponse: 'native-control' },
    geometryQualification,
    locators,
    loadHistory, connectReplay, readProgress, readTranscript, closeAdmission, observeError,
    waitForReplay() {if(!replayPromise) throw new Error('Original continuation is absent');return replayPromise;},validateCompletion,
    readGeometrySnapshot,
    // This first full H100 scan is unscored; geometryQualification stays false.
    readVisibleMessages() {
      const snapshot=readGeometrySnapshot();
      if(snapshot.status!=='available')throw new Error(`Native geometry unavailable: ${snapshot.reason}`);
      return snapshot.visibleMessages;
    },
    resetThread() { throw new Error('Reset/retry/reuse is not admitted; await original dispose()'); },
    dispose,
  };
}
