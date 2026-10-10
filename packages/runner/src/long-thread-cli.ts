import {comparisonInvocationSchema, longThreadCaseOrder, type ComparisonInvocation} from '@chat-ui-bench/contract';
export interface LongThreadConfiguration {help: false; purpose: 'publication' | 'conformance'; out: string; configuration: ComparisonInvocation}
/** Pure parser seam. Executable capture wiring belongs to the actual browser driver, not this module. */
export function parseLongThreadArgs(args: readonly string[]): {help: true} | LongThreadConfiguration {
  if (args.length === 1 && args[0] === '--help') return {help: true};
  const values = new Map<string, string>(), allowed = new Set(['--adapter', '--mode', '--rounds', '--seed', '--out']);
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]!, value = args[i + 1];
    if (!allowed.has(flag) || values.has(flag) || value === undefined || value.startsWith('--') || !value.length) throw new Error(`Unknown, duplicate or missing argument: ${flag}`);
    values.set(flag, value);
  }
  const integer = (flag: string, fallback: number) => {const value = values.get(flag) ?? String(fallback); if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Invalid integer ${flag}`); return Number(value);};
  const out = values.get('--out'); if (!out || out.includes('\0')) throw new Error('Output root --out is required');
  const mode = values.get('--mode') ?? 'headed', seed = integer('--seed', 1), rounds = integer('--rounds', 3);
  if (mode !== 'headed' && mode !== 'headless') throw new Error('Mode must be headed or headless');
  if (mode === 'headed' && rounds !== 3) throw new Error('Publication requires three complete rounds');
  const configuration = comparisonInvocationSchema.parse({schemaVersion: 2, suite: 'long-thread-prose-v1', seed, rounds, adapterProfiles: [values.get('--adapter') ?? 'threadplane-langgraph-custom-transport'], caseOrder: longThreadCaseOrder(seed), mode, deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}});
  return {help: false, purpose: mode === 'headed' ? 'publication' : 'conformance', out, configuration};
}
