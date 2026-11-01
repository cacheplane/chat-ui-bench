import type {ProseMessage} from '../../shared/protocol.ts';

/** Copies only actual public SDK state; it has no expected response text. */
export function createMessageProjection(historyIds: readonly string[], responseCharacters = 6400) {
  // The canonical fixture and shared context parser require assistant-first history.
  const history = new Set(historyIds);
  let response: string | null = null;
  const count = (messages: readonly unknown[]) => {
    if (!Array.isArray(messages) || messages.length > historyIds.length + 1) throw new Error('SDK message count');
  };
  const prose = (raw: unknown): ProseMessage => {
    if (!raw || typeof raw !== 'object') throw new Error('SDK message data');
    const {id, role, content, toolCalls} = raw as Record<string, unknown>;
    if (typeof id !== 'string' || id.length < 1 || id.length > 128 || (role !== 'user' && role !== 'assistant') || typeof content !== 'string' || (toolCalls !== undefined && (!Array.isArray(toolCalls) || toolCalls.length !== 0)) || content.length > responseCharacters) throw new Error('SDK prose message');
    return {id, role, text: content};
  };
  const current = (messages: readonly unknown[]): ProseMessage | null => {
    count(messages);
    if (messages.length <= historyIds.length) {
      if (messages.length) {
        const index = messages.length - 1, tail = prose(messages[index]);
        if (tail.id !== historyIds[index] || tail.role !== (index % 2 ? 'user' : 'assistant')) throw new Error('SDK history identity/order/role');
      }
      return null;
    }
    const message = prose(messages[messages.length - 1]);
    if (history.has(message.id) || message.role !== 'assistant' || (response !== null && response !== message.id)) throw new Error('SDK response identity');
    response = message.id;
    return message;
  };
  return {
    responseId: () => response,
    read(messages: readonly unknown[]): ProseMessage[] {
      count(messages);
      const seen = new Set<string>();
      const result: ProseMessage[] = [];
      for (let index = 0; index < messages.length; index++) {
        if (!Object.hasOwn(messages, index)) throw new Error('SDK sparse message data');
        const raw = messages[index];
        const message = prose(raw);
        if (seen.has(message.id)) throw new Error('SDK prose message');
        seen.add(message.id);
        if (index < historyIds.length) {
          if (message.id !== historyIds[index] || message.role !== (index % 2 ? 'user' : 'assistant')) throw new Error('SDK history identity/order/role');
        } else current(messages);
        result.push(message);
      }
      return result;
    },
    readProgress(messages: readonly unknown[]) {
      const message = current(messages);
      return {messageCount: messages.length, responseId: message?.id ?? null, responseCharacters: message?.text.length ?? null};
    },
    readResponse: current,
  };
}
