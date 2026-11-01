import { parsePublicContextText, PUBLIC_CONTEXT_PROTOCOL_HEADER } from '../../shared/context.mjs';
export async function loadContext(response: Response) {
  if (!response.ok) throw new Error(`Context request failed (${response.status})`);
  return parsePublicContextText(await response.text(), response.headers.get(PUBLIC_CONTEXT_PROTOCOL_HEADER) ?? 'functional-v2');
}
