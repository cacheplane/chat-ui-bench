import type { AgentSubscriber, EventType, HttpAgent, HttpAgentConfig, HttpAgentFetchFn, Message, RunAgentParameters } from '@ag-ui/client';
import type { AGUIMessage } from '@copilotkit/aimock/agui';
import type { createCanonicalHttpAgentConfiguration } from '../fixtures/copilotkit-httpagent.js';

type Configuration = ReturnType<typeof createCanonicalHttpAgentConfiguration>;
type ConstructorConfig = ConstructorParameters<typeof HttpAgent>[0];
type RunParameters = NonNullable<Parameters<HttpAgent['runAgent']>[0]>;

// These functions are compile-only consumer controls; this file is outside Vitest's test pattern.
export function configurationControls(result: Configuration) {
  const config: ConstructorConfig = result.config;
  const restore: RunParameters = result.restoreRun;
  const continuation: RunParameters = result.continuationRun;
  const history: Message[] = result.expectedHistory;
  const content: string | undefined = result.expectedHistory[0]?.content;
  return { config, restore, continuation, history, content };
}

export function fetchControls(fetchImplementation: (url: string, init: RequestInit) => Promise<Response>): HttpAgentFetchFn {
  return fetchImplementation;
}

type SnapshotPayload = Parameters<NonNullable<AgentSubscriber['onMessagesSnapshotEvent']>>[0];
type ContentPayload = Parameters<NonNullable<AgentSubscriber['onTextMessageContentEvent']>>[0];
type ErrorPayload = Parameters<NonNullable<AgentSubscriber['onRunErrorEvent']>>[0];

export const subscriberControls = {
  onMessagesSnapshotEvent(payload: SnapshotPayload) {
    const messages: Message[] = payload.event.messages;
    const type: EventType.MESSAGES_SNAPSHOT = payload.event.type;
    void messages; void type;
  },
  onTextMessageContentEvent(payload: ContentPayload) {
    const id: string = payload.event.messageId;
    const delta: string = payload.event.delta;
    const buffer: string = payload.textMessageBuffer;
    const type: EventType.TEXT_MESSAGE_CONTENT = payload.event.type;
    void id; void delta; void buffer; void type;
  },
  onRunErrorEvent(payload: ErrorPayload) {
    const message: string = payload.event.message;
    const code: string | undefined = payload.event.code;
    const type: EventType.RUN_ERROR = payload.event.type;
    void message; void code; void type;
  },
} satisfies AgentSubscriber;

export function negativeControls(genericHistory: AGUIMessage[]) {
  // @ts-expect-error Public HttpAgent configuration requires a URL.
  const missingUrl: HttpAgentConfig = { threadId: 'thread' };
  // @ts-expect-error Runtime-provider configuration is not client configuration.
  const providerConfig: HttpAgentConfig = { url: 'data-only', runtimeUrl: 'provider-only' };
  // @ts-expect-error Run parameters do not accept arbitrary request properties.
  const unsupportedRun: RunAgentParameters = { runId: 'run', unsupported: true };
  // @ts-expect-error Broad AIMock messages lack the public SDK Message union guarantees.
  const unsafeHistory: Message[] = genericHistory;
  return { missingUrl, providerConfig, unsupportedRun, unsafeHistory };
}
