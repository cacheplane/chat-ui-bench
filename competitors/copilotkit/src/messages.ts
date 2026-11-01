import type {ProseMessage} from '../../shared/protocol.ts';

/** Copies only actual public SDK state; it has no expected response text. */
export function createMessageProjection(historyIds: readonly string[]) {
  const history = new Set(historyIds);
  let response: string | null = null;
  return {
    responseId: () => response,
    read(messages: readonly unknown[]): ProseMessage[] {
      if (!Array.isArray(messages) || messages.length > 101) throw new Error('SDK message count');
      const seen = new Set<string>();
      return messages.map(raw => {
        if (!raw || typeof raw !== 'object') throw new Error('SDK message data');
        const message = raw as Record<string, unknown>;
        const {id, role, content} = message;
        if (typeof id !== 'string' || id.length < 1 || id.length > 128 || seen.has(id) || (role !== 'user' && role !== 'assistant') || typeof content !== 'string' || content.length > 6400) throw new Error('SDK prose message');
        seen.add(id);
        if (!history.has(id)) {
          if (role !== 'assistant' || (response !== null && response !== id)) throw new Error('SDK response identity');
          response = id;
        }
        return {id, role, text: content};
      });
    },
  };
}
