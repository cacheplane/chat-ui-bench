import type {RunAgentInput, BaseEvent} from '@ag-ui/core';
import type {RunAgentParameters, AgentSubscriber, RunAgentResult} from '@ag-ui/client';
import type {Observable as ObservableType} from 'rxjs';
import type {PublicContext} from '../../shared/protocol.ts';
import {parsePublicContext} from '../../shared/context.mjs';

interface PrivateContext {
  publicContext: PublicContext;
  seedRunId: string;
  historyRestore: readonly BaseEvent[];
  continuation: readonly BaseEvent[];
}
interface Options {
  context: PrivateContext;
  playback(kind: 'seed' | 'continuation', signal: AbortSignal): AsyncIterable<BaseEvent>;
}
let leased = false;
const AGENT_ID = 'default';

export async function createRoutes({context, playback}: Options) {
  const publicContext = parsePublicContext(context.publicContext);
  if (publicContext.profile !== 'copilotkit' || typeof context.seedRunId !== 'string' || context.seedRunId === publicContext.runId) throw new Error('Copilot context identity');
  if (leased) throw new Error('Copilot process already owns a case');
  leased = true;
  // Public opt-out must precede the first runtime import/telemetry singleton.
  process.env.COPILOTKIT_TELEMETRY_DISABLED = 'true';
  process.env.DO_NOT_TRACK = '1';
  let closed = false;
  const pending = new Set<Promise<unknown>>();
  const controllers = new Set<AbortController>();
  const listeners: Array<() => void> = [];
  const owned = <T>(promise: Promise<T>): Promise<T> => {
    pending.add(promise);
    void promise.then(() => pending.delete(promise), () => pending.delete(promise));
    return promise;
  };
  try {
    const [{AbstractAgent}, {Observable}, {CopilotRuntime, InMemoryAgentRunner}, {createCopilotHonoHandler}] = await Promise.all([
      import('@ag-ui/client'), import('rxjs'), import('@copilotkit/runtime/v2'), import('@copilotkit/runtime/v2/hono'),
    ]);
    let seedExecuted = false;
    let continuationAdmitted = false;
    let continuationExecuted = false;
    const validHistory = (messages: RunAgentInput['messages']) => messages.length === publicContext.history.length && messages.every((message, index) => {
      const expected = publicContext.history[index]!;
      return message.id === expected.id && message.role === expected.role && 'content' in message && message.content === expected.text;
    });
    class CanonicalAgent extends AbstractAgent {
      constructor() { super({agentId: AGENT_ID, threadId: publicContext.threadId, description: 'Canonical finite functional fixture'}); }
      override clone() { return new CanonicalAgent(); }
      override runAgent(parameters?: RunAgentParameters, subscriber?: AgentSubscriber): Promise<RunAgentResult> {
        // Runtime invokes this public API. Retain its exact original promise,
        // separately from the playback task and HTTP/Observable completion.
        return owned(super.runAgent(parameters, subscriber));
      }
      override run(input: RunAgentInput): ObservableType<BaseEvent> {
        if (closed || input.threadId !== publicContext.threadId) throw new Error('Unowned Copilot thread');
        const kind = input.runId === context.seedRunId ? 'seed' : 'continuation';
        if (kind === 'seed') {
          if (seedExecuted || input.messages.length !== 0) throw new Error('Copilot seed admission');
          seedExecuted = true;
        } else {
          if (input.runId !== publicContext.runId || !continuationAdmitted || continuationExecuted || !validHistory(input.messages)) throw new Error('Copilot continuation admission');
          continuationExecuted = true;
        }
        return new Observable<BaseEvent>(subscriber => {
          const controller = new AbortController();
          controllers.add(controller);
          const task = owned((async () => {
            let count = 0;
            try {
              for await (const event of playback(kind, controller.signal)) {
                if (closed || controller.signal.aborted) throw new Error('Copilot playback aborted');
                if (++count > (kind === 'seed' ? 3 : 204)) throw new Error('Copilot event bound');
                subscriber.next(event);
              }
            } finally { controllers.delete(controller); }
          })());
          void task.then(() => subscriber.complete(), error => subscriber.error(error));
          return () => { controller.abort(); };
        });
      }
    }
    const agent = new CanonicalAgent();
    const runner = new InMemoryAgentRunner({maxThreads: 1, maxRunsPerThread: 2, maxBytes: 1048576});
    const runtime = new CopilotRuntime({agents: {[AGENT_ID]: agent}, runner});
    const app = createCopilotHonoHandler({runtime, basePath: '/copilot'});
    // Public ownerId:'' is the anonymous HTTP identity. Omitting it seeds a
    // server-only thread under the1.83 public ownership contract.
    await owned(new Promise<void>((resolve, reject) => {
      let terminal = false;
      runner.run({threadId: publicContext.threadId, ownerId: '', agent, input: {
        threadId: publicContext.threadId, runId: context.seedRunId, messages: [], state: {}, tools: [], context: [], forwardedProps: {},
      }}).subscribe({next(event) { if (event.type === 'RUN_ERROR') reject(new Error('Copilot seed failed: '+String((event as BaseEvent & {message?: string}).message).slice(0,512))); if (event.type === 'RUN_FINISHED') terminal = true; }, error: reject,
        complete() { terminal ? resolve() : reject(new Error('Copilot seed terminal absent')); }});
    }));
    if (await runner.isRunning({threadId: publicContext.threadId, ownerId: ''}) || !validHistory(runner.getThreadMessages(publicContext.threadId, {ownerId: ''}))) throw new Error('Copilot seed public state mismatch');
    let disposal: Promise<void> | null = null;
    return {
      async handle(request: Request): Promise<Response | null> {
        const url = new URL(request.url);
        if (!url.pathname.startsWith('/copilot')) return null;
        if (closed) return Response.json({error: 'case-closed'}, {status: 410});
        if (url.search || url.hash) return Response.json({error: 'route'}, {status: 400});
        const path = url.pathname;
        if (path === '/copilot/info' && request.method === 'GET') return app.fetch(request);
        const connect = path === `/copilot/agent/${AGENT_ID}/connect`;
        const run = path === `/copilot/agent/${AGENT_ID}/run`;
        const stop = path === `/copilot/agent/${AGENT_ID}/stop/${publicContext.threadId}`;
        if (request.method !== 'POST' || (!connect && !run && !stop)) return Response.json({error: 'route'}, {status: 404});
        let body: Record<string, unknown>;
        try { body = await request.clone().json() as Record<string, unknown>; } catch { return Response.json({error: 'body'}, {status: 400}); }
        if (stop) {
          //1.83's public REST client owns thread identity in the exact path;
          // its stop body contains only the active runId.
          if (!body || Object.keys(body).length !== 1 || body.runId !== publicContext.runId) return Response.json({error: 'stop-identity'}, {status: 400});
        } else if (!body || body.threadId !== publicContext.threadId || (run && (body.runId !== publicContext.runId || !Array.isArray(body.messages) || !validHistory(body.messages)))) return Response.json({error: 'identity-or-history'}, {status: 400});
        if (run) {
          if (continuationAdmitted) return Response.json({error: 'once-only'}, {status: 409});
          continuationAdmitted = true;
          const onAbort = () => { void owned(runner.stop({threadId: publicContext.threadId, runId: publicContext.runId, ownerId: ''})); };
          request.signal.addEventListener('abort', onAbort, {once: true});
          listeners.push(() => request.signal.removeEventListener('abort', onAbort));
          if (request.signal.aborted) onAbort();
        }
        return app.fetch(request);
      },
      dispose(): Promise<void> {
        if (disposal) return disposal;
        closed = true;
        disposal = (async () => {
          for (const controller of controllers) controller.abort();
          await owned(runner.stop({threadId: publicContext.threadId, runId: publicContext.runId, ownerId: ''}));
          while (pending.size) await Promise.allSettled([...pending]);
          if (await runner.isRunning({threadId: publicContext.threadId, ownerId: ''})) throw new Error('Copilot original run remains active');
          for (const remove of listeners) remove();
          leased = false;
        })();
        return disposal;
      },
    };
  } catch (error) {
    closed = true;
    for (const controller of controllers) controller.abort();
    await Promise.allSettled([...pending]);
    leased = false;
    throw error;
  }
}
