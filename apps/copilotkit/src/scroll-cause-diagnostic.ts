/** Disabled observation only. Tuple ABI v1: event, sequence, instance, resize,
 * cause, scroller, then event-specific numeric atoms, padded to 32 atoms.
 * Events: 1 entry(index,size); 2 decision(index,key,start,cached,old,size,delta,
 * offset,first,default,effective,end,awaiting,predicate[0 skipped/1 custom/2 default]);
 * 3 scope-open(branch[1 size/2 end]); 4 scope-close(normal,adjusted);
 * 5 request(offset,adjustments,behavior[0 absent/1 auto/2 smooth],target);
 * 6 delegate-return(offset,adjustments,behavior,called); 7 exit(normal).
 * No tuple contains a key, content, exception, timestamp, or DOM geometry read.
 */
export type ScrollCauseAtom = number | null;
export const SCROLL_CAUSE_LIMITS = Object.freeze({ records: 1024, instances: 4, scrollers: 4, keys: 1024, depth: 8, bytes: 1048576, rowBytes: 896, headerBytes: 4096 });
// Enforced per-atom encoding <=26 bytes: 32*26 +31 commas +2 brackets =865.
export const SCROLL_CAUSE_ROW_BOUND = 865;

export function createScrollCauseDiagnostic(records = 1024, instances = 4, keys = 1024, depth = 8, bytes = 1048576) {
  return createScrollCauseCore(records, instances, keys, depth, bytes).observer;
}
function createScrollCauseCore(records = 1024, instances = 4, keys = 1024, depth = 8, bytes = 1048576) {
  const limits = [records, instances, keys, depth, bytes];
  const maxima = [1024, 4, 1024, 8, 1048576];
  if (limits.some((value, index) => !Number.isSafeInteger(value) || value < 1 || value > maxima[index]!) || bytes < 4096) throw new Error('Invalid diagnostic limits');
  const rows: ScrollCauseAtom[][] = [];
  const identities = new WeakMap<object, number>();
  const scrollers = new WeakMap<object, number>();
  const keyIds = new Map<unknown, number>();
  const states = new WeakMap<object, { resizes: number[]; causes: { id: number; resize: number }[] }>();
  let identityCount = 0, scrollerCount = 0, stateCount = 0, sequence = 0, token = 0;
  let fault = 0, faultOccurrences = 0, exceptionalPaths = 0, activeResizes = 0, activeCauses = 0, rowEncodingBytes = 0;
  const fail = (code: number) => { if (!fault) fault = code; faultOccurrences = Math.min(2147483647, faultOccurrences + 1); };
  const object = (value: unknown): value is object => value !== null && (typeof value === 'object' || typeof value === 'function');
  const identity = (value: unknown, scroller = false): number | null => {
    if (!object(value)) { if (value !== null && value !== undefined) fail(2); return null; }
    const map = scroller ? scrollers : identities;
    let id = map.get(value);
    if (id !== undefined) return id;
    if ((scroller ? scrollerCount : identityCount) >= instances) { fail(2); return null; }
    id = scroller ? ++scrollerCount : ++identityCount;
    map.set(value, id);
    return id;
  };
  const admit = (value: object) => {
    if (fault) { fail(fault); return null; }
    if (!object(value) || identity(value) === null) { fail(2); return null; }
    let result = states.get(value);
    if (!result) { result = { resizes: [], causes: [] }; states.set(value, result); stateCount++; }
    return result;
  };
  const owned = (value: object, resize: number | null) => {
    const current = object(value) ? states.get(value) : undefined;
    if (resize === null || !current || current.resizes.at(-1) !== resize) { fail(4); return null; }
    return current;
  };
  const causeAtTop = (current: NonNullable<ReturnType<typeof admit>>) => {
    const cause = current.causes.at(-1);
    return cause?.resize === current.resizes.at(-1) ? cause?.id ?? null : null;
  };
  const keyId = (key: unknown): number | null => {
    if (object(key) || typeof key === 'symbol' || (typeof key === 'string' && key.length > 256) || (typeof key === 'number' && !Number.isFinite(key)) || (typeof key === 'bigint' && (key > 9007199254740991n || key < -9007199254740991n))) { fail(3); return null; }
    let id = keyIds.get(key);
    if (id !== undefined) return id;
    if (keyIds.size >= keys) { fail(3); return null; }
    id = keyIds.size + 1; keyIds.set(key, id); return id;
  };
  const atom = (value: unknown): ScrollCauseAtom => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || JSON.stringify(value).length > 26) { fail(5); return null; }
    return value;
  };
  const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const nullableNumeric = (value: unknown) => value === null || value === undefined || numeric(value);
  const behavior = (value: unknown) => value === undefined ? 0 : value === 'auto' ? 1 : value === 'smooth' ? 2 : (fail(5), null);
  const header = () => ({ version: 1, status: 'disabled-unqualified', qualification: false, nativeGO: false, performance: false, FPS: 'unavailable', complete: fault === 0 && exceptionalPaths === 0 && activeResizes === 0 && activeCauses === 0, fault, exceptionalPaths, activeResizes, activeCauses, faultOccurrences, omittedRecords: 'unavailable', instances: identityCount, states: stateCount, scrollers: scrollerCount, keys: keyIds.size });
  const emit = (event: number, instance: object | null, resize: number | null, cause: number | null, scroller: unknown, values: unknown[]) => {
    if (fault) { fail(fault); return; }
    if (values.length > 26) { fail(5); return; }
    const id = event === 8 ? null : identity(instance);
    const scrollerId = identity(scroller, true);
    const row: ScrollCauseAtom[] = [event, ++sequence, id, resize, cause, scrollerId, ...values.map(atom)];
    if (row.length > 32) { fail(5); return; }
    while (row.length < 32) row.push(null);
    if (fault) return;
    if (rows.length >= records) { fail(1); return; }
    const encoded = JSON.stringify(row);
    if (encoded.length > SCROLL_CAUSE_ROW_BOUND || encoded.length > SCROLL_CAUSE_LIMITS.rowBytes) { fail(5); return; }
    // Reserve the whole bounded header once. Never repeatedly serialize retained
    // prefixes on the observed path. All characters are ASCII, so these are bytes.
    const additionalBytes = encoded.length + (rows.length ? 1 : 0);
    if (4096 + rowEncodingBytes + additionalBytes > bytes) { fail(6); return; }
    rowEncodingBytes += additionalBytes;
    rows.push(row);
  };
  const guarded = <T>(fallback: T, action: () => T): T => { try { return action(); } catch { fail(5); return fallback; } };
  const observer = Object.freeze({
    enter(instance: object, index: unknown, size: unknown) { return guarded<number | null>(null, () => {
      if (fault) { fail(fault); return null; }
      if (!numeric(index) || !numeric(size)) { fail(5); return null; }
      const current = admit(instance);
      if (!current) return null;
      if (current.resizes.length >= depth) { fail(4); return null; }
      const id = ++token; current.resizes.push(id); activeResizes++; emit(1, instance, id, null, null, [index, size]); return id;
    }); },
    exit(instance: object, resize: number | null, normal: boolean) { guarded(undefined, () => {
      if (resize === null) { if (!fault) fail(4); return; }
      if (typeof normal !== 'boolean') { fail(5); return; }
      const current = owned(instance, resize);
      if (!current) return;
      if (current.causes.at(-1)?.resize === resize) { fail(4); return; }
      current.resizes.pop(); activeResizes--; emit(7, instance, resize, null, null, [normal]);
      if (!normal) exceptionalPaths = Math.min(2147483647, exceptionalPaths + 1);
    }); },
    decision(instance: object, resize: number | null, key: unknown, ...values: unknown[]) { guarded(undefined, () => {
      if (fault) { fail(fault); return; }
      if (!owned(instance, resize)) return;
      if (values.length !== 13 || !values.slice(0, 7).every(numeric) || !values.slice(7, 12).every(value => typeof value === 'boolean') || (values[12] !== 0 && values[12] !== 1 && values[12] !== 2)) { fail(5); return; }
      const id = keyId(key); emit(2, instance, resize, null, null, [values[0], id, ...values.slice(1)]);
    }); },
    open(instance: object, resize: number | null, branch: number) { return guarded<number | null>(null, () => {
      if (fault) { fail(fault); return null; }
      const current = owned(instance, resize);
      if (!current || resize === null) return null;
      if ((branch !== 1 && branch !== 2) || current.causes.length >= depth) { fail(4); return null; }
      const id = ++token; current.causes.push({ id, resize }); activeCauses++; emit(3, instance, resize, id, null, [branch]); return id;
    }); },
    close(instance: object, resize: number | null, cause: number | null, normal: boolean, adjusted: unknown) { guarded(undefined, () => {
      if (cause === null) { if (!fault) fail(4); return; }
      if (typeof normal !== 'boolean' || typeof adjusted !== 'boolean') { fail(5); return; }
      const current = owned(instance, resize);
      if (!current) return;
      if (current.causes.at(-1)?.id !== cause || current.causes.at(-1)?.resize !== resize) { fail(4); return; }
      current.causes.pop(); activeCauses--; emit(4, instance, resize, cause, null, [normal, adjusted]);
      if (!normal) exceptionalPaths = Math.min(2147483647, exceptionalPaths + 1);
    }); },
    request(instance: object, offset: unknown, adjustments: unknown, mode: unknown, target: unknown) { guarded(undefined, () => {
      if (!numeric(offset) || !nullableNumeric(adjustments) || !numeric(target)) { fail(5); return; }
      const current = admit(instance); if (!current) return;
      emit(5, instance, current.resizes.at(-1) ?? null, causeAtTop(current), null, [offset, adjustments, behavior(mode), target]);
    }); },
    returned(instance: object, receiver: unknown, method: unknown, offset: unknown, adjustments: unknown, mode: unknown) { guarded(undefined, () => {
      if (!numeric(offset) || !nullableNumeric(adjustments) || (method !== undefined && method !== null && typeof method !== 'function')) { fail(5); return; }
      const current = admit(instance); if (!current) return;
      emit(6, instance, current.resizes.at(-1) ?? null, causeAtTop(current), receiver, [offset, adjustments, behavior(mode), method !== null && method !== undefined]);
    }); },
    snapshot() {
      const result = { ...header(), rows: rows.map(row => row.slice()) };
      if (JSON.stringify(result).length > bytes) { fail(6); return { ...header(), rows: [] as ScrollCauseAtom[][] }; }
      return result;
    },
  });
  return { observer, receiver: (owner: object) => guarded<number | null>(null, () => identity(owner, true)), marker(owner: object, role: number, ordinal: number, slot: number | null) { return guarded(false, () => {
    const before = rows.length; emit(8, null, null, null, owner, [role, ordinal, slot]); return rows.length === before + 1;
  }); } };
}

export type ScrollCauseMarkerPurpose = Readonly<{ role: 'pre' | 'before' | 'after' | 'post'; ordinal: number; slot: number | null }>;
/** Explicit opt-in collection. No callbacks, DOM access, clocks, or timers. */
export function createScrollCauseAttributionDiagnostic() {
  const core = createScrollCauseCore();
  let collectionState: 'inactive' | 'collecting' | 'sealed' = 'inactive', owner: object | null = null, ownerId: number | null = null;
  let attemptedStart = false, diagnosticFault = 0, inactiveDepth = 0, inactiveRequests = 0;
  let startSequence: 0 | null = null, endSequence: number | null = null;
  const markers = { count: 0, firstOrdinal: null as number | null, lastOrdinal: null as number | null, pre: false, post: false, contiguous: true };
  const fail = (code: number) => { diagnosticFault ||= code; };
  const active = () => collectionState === 'collecting' && diagnosticFault === 0;
  const snapshot = () => {
    const original = core.observer.snapshot();
    return { ...original, version: 2 as const, status: 'unqualified' as const, complete: collectionState === 'sealed' && original.complete && diagnosticFault === 0, collectionState, ownerId, startSequence, endSequence, diagnosticFault, markers: { ...markers } };
  };
  let sealed: ReturnType<typeof snapshot> | null = null;
  const freeze = () => {
    const result = snapshot();
    if (JSON.stringify(result).length > 1048576) { fail(5); result.complete = false; result.diagnosticFault = diagnosticFault; result.rows = []; }
    result.rows.forEach(Object.freeze); Object.freeze(result.rows); Object.freeze(result.markers); return Object.freeze(result);
  };
  return Object.freeze({
    enter(...args: Parameters<typeof core.observer.enter>) {
      if (collectionState === 'inactive') { inactiveDepth = Math.min(9, inactiveDepth + 1); if (inactiveDepth > 8) fail(5); return null; }
      return active() ? core.observer.enter(...args) : null;
    },
    exit(...args: Parameters<typeof core.observer.exit>) {
      if (collectionState === 'inactive') { if (inactiveDepth > 0) inactiveDepth--; return; }
      if (collectionState === 'collecting' && args[1] !== null) core.observer.exit(...args);
    },
    decision(...args: Parameters<typeof core.observer.decision>) { if (active()) core.observer.decision(...args); },
    open(...args: Parameters<typeof core.observer.open>) { return active() ? core.observer.open(...args) : null; },
    close(...args: Parameters<typeof core.observer.close>) { if (collectionState === 'collecting' && args[2] !== null) core.observer.close(...args); },
    request(...args: Parameters<typeof core.observer.request>) { if (collectionState === 'inactive') { inactiveRequests = Math.min(9, inactiveRequests + 1); if (inactiveRequests > 8) fail(5); return; } if (active()) core.observer.request(...args); },
    returned(...args: Parameters<typeof core.observer.returned>) { if (collectionState === 'inactive') { if (inactiveRequests > 0) inactiveRequests--; return; } if (active()) core.observer.returned(...args); },
    start(scroller: object) {
      if (collectionState === 'sealed') return;
      if (attemptedStart) { fail(scroller === owner ? 1 : 2); return; } attemptedStart = true;
      if (inactiveDepth !== 0 || inactiveRequests !== 0) { fail(5); return; }
      if (scroller === null || (typeof scroller !== 'object' && typeof scroller !== 'function')) { fail(2); return; }
      if (diagnosticFault) return;
      owner = scroller; ownerId = core.receiver(scroller); if (ownerId === null) { fail(2); return; }
      startSequence = 0; collectionState = 'collecting';
    },
    marker(scroller: object, purpose: ScrollCauseMarkerPurpose) {
      if (!active()) return;
      try {
        if (scroller !== owner) { fail(2); return; }
        if (!purpose || ![Object.prototype, null].includes(Object.getPrototypeOf(purpose))) { fail(3); return; }
        const fields = Object.getOwnPropertyDescriptors(purpose);
        if (Reflect.ownKeys(fields).length !== 3 || ['role', 'ordinal', 'slot'].some(key => !fields[key] || !('value' in fields[key]!) || !fields[key]!.enumerable)) { fail(3); return; }
        const role: unknown = fields.role!.value, ordinal: unknown = fields.ordinal!.value, slot: unknown = fields.slot!.value;
        if (typeof ordinal !== 'number' || !Number.isInteger(ordinal) || !((role === 'pre' && ordinal === 1 && slot === null) || (role === 'post' && ordinal >= 2 && ordinal <= 82 && slot === null) || ((role === 'before' || role === 'after') && typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < 40 && ordinal === (role === 'before' ? 2 : 3) + 2 * slot))) { fail(3); return; }
        if (markers.count >= 82 || (markers.lastOrdinal !== null && ordinal <= markers.lastOrdinal)) { fail(4); return; }
        if (core.marker(scroller, role === 'pre' ? 1 : role === 'before' ? 2 : role === 'after' ? 3 : 4, ordinal, slot as number | null)) {
          markers.contiguous &&= ordinal === (markers.lastOrdinal ?? 0) + 1;
          markers.count++; markers.firstOrdinal ??= ordinal; markers.lastOrdinal = ordinal; markers.pre ||= role === 'pre'; markers.post ||= role === 'post';
        }
      } catch { fail(3); }
    },
    seal() {
      if (sealed) return sealed;
      const current = core.observer.snapshot();
      if (inactiveDepth || inactiveRequests || current.activeResizes || current.activeCauses) fail(5);
      collectionState = 'sealed'; endSequence = current.rows.at(-1)?.[1] ?? 0; sealed = freeze(); return sealed;
    },
    snapshot() { return sealed ?? snapshot(); },
  });
}

/** Importing this module does not activate any runtime observer. */
export const scrollCauseObserver = createScrollCauseDiagnostic();
