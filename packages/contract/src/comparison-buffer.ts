export type ComparisonBufferName = 'transport' | 'page-observations' | 'pre-navigation-errors';
export type ComparisonPrimitiveToken = string | number | boolean | null;

/**
 * Self-contained browser factory. Its compiled function source is also embedded by
 * the page installer. Input is an owned variadic primitive stream, never an object:
 * null | string,value | number,value | boolean,value | array,count,values... |
 * object,count,(key,value)... . Counts describe children, not tokens. No accessor,
 * proxy, toJSON, or application object is inspected or retained.
 */
export function createComparisonBuffer(name: ComparisonBufferName) {
  if(name!=='transport'&&name!=='page-observations'&&name!=='pre-navigation-errors') throw new Error('Invalid comparison buffer name');
  const limits = Object.freeze({
    maxPendingEntries: 4096, maxPendingSerializedBytes: 16777216, maxRecordSerializedBytes: 4194304,
    maxRecordTokens: 65536, maxRecordDepth: 32,
    maxRuntimeCodeUnits: 524288, maxRuntimeUtf8Bytes: 1048576,
    maxActiveDomCodeUnits: 524288, maxActiveDomUtf8Bytes: 1048576,
    maxHistoricalDomCodeUnits: 16384, maxHistoricalDomUtf8Bytes: 65536,
    maxHistoricalCallbackCodeUnits: 262144, maxHistoricalCallbackUtf8Bytes: 1048576,
    maxHistoricalCandidates: 64, maxNodesPerSample: 1024, maxNodesPerCallback: 2048,
    maxAncestorsPerGeometry: 64, maxAncestorsPerCallback: 256,
    maxRectsPerSample: 2048, maxRectsPerCallback: 4096,
    maxConsoleArguments: 8, maxDiagnosticFieldCodeUnits: 2048,
    maxDiagnosticMessageCodeUnits: 8192, maxDiagnosticStackCodeUnits: 16384,
  } as const);
  let pending: {serialized: string; bytes: number}[] = [];
  let pendingBytes = 0, highWaterEntries = 0, highWaterBytes = 0;
  let overflowCount = 0, rejectedRecordCount = 0, firstReason: string | undefined;
  function reject(reason: string, overflow = false) {
    rejectedRecordCount++;
    if (overflow) overflowCount++;
    firstReason ??= reason;
    return false;
  }
  function enqueue(...tokens: ComparisonPrimitiveToken[]): boolean {
    if (pending.length === limits.maxPendingEntries) return reject('Pending entry limit exceeded', true);
    if (tokens.length > limits.maxRecordTokens) return reject('Record token limit exceeded');
    const remaining = limits.maxPendingSerializedBytes - pendingBytes;
    const budget = Math.min(limits.maxRecordSerializedBytes, remaining);
    const byteReason = remaining < limits.maxRecordSerializedBytes ? 'Pending byte limit exceeded' : 'Record byte limit exceeded';
    let cursor = 0, bytes = 0;
    function add(amount: number) { bytes += amount; if (bytes > budget) throw byteReason; }
    function stringBytes(value: unknown) {
      if (typeof value !== 'string') throw 'Expected primitive string';
      if (value.length + 2 > budget - bytes) throw byteReason;
      add(2);
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code === 34 || code === 92 || code === 8 || code === 9 || code === 10 || code === 12 || code === 13) add(2);
        else if (code < 32) add(6);
        else if (code < 128) add(1);
        else if (code < 2048) add(2);
        else if (code >= 0xd800 && code <= 0xdbff) {
          const next = value.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) { add(4); i++; } else add(6);
        } else if (code >= 0xdc00 && code <= 0xdfff) add(6);
        else add(3);
      }
    }
    function preflight(depth: number): void {
      if (depth > limits.maxRecordDepth) throw 'Record depth limit exceeded';
      const tag = tokens[cursor++];
      if (tag === 'null') { add(4); return; }
      if (tag === 'string') { stringBytes(tokens[cursor++]); return; }
      if (tag === 'number') {
        const value = tokens[cursor++];
        if (typeof value !== 'number' || !Number.isFinite(value)) throw 'Expected finite primitive number';
        add(String(value).length); return;
      }
      if (tag === 'boolean') {
        const value = tokens[cursor++];
        if (typeof value !== 'boolean') throw 'Expected primitive boolean';
        add(value ? 4 : 5); return;
      }
      if (tag !== 'object' && tag !== 'array') throw 'Invalid record grammar';
      const count = tokens[cursor++];
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > limits.maxRecordTokens || count > tokens.length - cursor) throw 'Invalid child count';
      add(2 + Math.max(0, count - 1));
      const keys = new Set<string>();
      for (let i = 0; i < count; i++) {
        if (tag === 'object') {
          const key = tokens[cursor++]; stringBytes(key);
          if (typeof key !== 'string' || keys.has(key)) throw 'Duplicate record key';
          keys.add(key); add(1);
        }
        preflight(depth + 1);
      }
    }
    function materialize(): unknown {
      const tag = tokens[cursor++];
      if (tag === 'null') return null;
      if (tag === 'string' || tag === 'number' || tag === 'boolean') return tokens[cursor++];
      const count = tokens[cursor++] as number;
      if (tag === 'array') { const array: unknown[] = []; for (let i = 0; i < count; i++) array.push(materialize()); return array; }
      const object = Object.create(null) as Record<string, unknown>;
      for (let i = 0; i < count; i++) { const key = tokens[cursor++] as string; object[key] = materialize(); }
      return object;
    }
    try {
      preflight(0);
      if (cursor !== tokens.length) throw 'Trailing record tokens';
      cursor = 0;
      let serialized:string|undefined;
      try { serialized=JSON.stringify(materialize()); }
      catch { return reject('Record serialization failed'); }
      if (typeof serialized !== 'string') throw 'Serialization returned no record';
      // Verify actual UTF-8 bytes without allocating an encoded copy of the record.
      let actual = 0;
      for (let i = 0; i < serialized.length; i++) {
        const code = serialized.charCodeAt(i);
        if (code < 128) actual++;
        else if (code < 2048) actual += 2;
        else if (code >= 0xd800 && code <= 0xdbff && serialized.charCodeAt(i + 1) >= 0xdc00 && serialized.charCodeAt(i + 1) <= 0xdfff) { actual += 4; i++; }
        else actual += 3;
        if (actual > budget) throw 'Serialized record exceeded preflight';
      }
      if (actual !== bytes) throw 'Serialized record disagreed with preflight';
      pending.push({serialized, bytes}); pendingBytes += bytes;
      highWaterEntries = Math.max(highWaterEntries, pending.length);
      highWaterBytes = Math.max(highWaterBytes, pendingBytes);
      return true;
    } catch (error) {
      const reason = typeof error === 'string' ? error : 'Record serialization failed';
      return reject(reason, reason === 'Pending byte limit exceeded');
    }
  }
  function drain(maxEntries = limits.maxPendingEntries): string[] {
    if (!Number.isInteger(maxEntries) || maxEntries < 0 || maxEntries > limits.maxPendingEntries) throw new Error('Invalid bounded drain size');
    const entries = pending.splice(0, maxEntries);
    for (const entry of entries) pendingBytes -= entry.bytes;
    return entries.map(entry => entry.serialized);
  }
  function state() {
    return {name, maxEntries: limits.maxPendingEntries, maxSerializedBytes: limits.maxPendingSerializedBytes,
      pendingEntries: pending.length, pendingSerializedBytes: pendingBytes,
      highWaterEntries, highWaterSerializedBytes: highWaterBytes, overflowCount, rejectedRecordCount,
      status: firstReason === undefined ? 'complete' as const : 'partial' as const,
      ...(firstReason === undefined ? {} : {reason: firstReason})};
  }
  return {limits, enqueue, drain, state};
}
/** Derived from the same self-contained implementation, never a second set of limits. */
export const COMPARISON_CAPTURE_LIMITS = createComparisonBuffer('page-observations').limits;
export type ComparisonBufferState = ReturnType<ReturnType<typeof createComparisonBuffer>['state']>;
