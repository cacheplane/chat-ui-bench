/** Inert data contracts. No runtime dependencies or resource allocation. */
export interface HostedAdmission {
  candidateSha: string;
  checkoutSha: string;
  githubSha: string;
  workflowSha: string;
  tagResolvedSha: string;
  githubRef: string;
  workflowRef: string;
  repository: string;
  eventName: string;
  actions: string;
  platform: string;
  runnerOs: string;
  runnerMarker: string;
  releaseId: string;
  attempt: string;
}

export function deriveReleaseTag(releaseId: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(releaseId) || releaseId.includes('\n')) {
    throw new Error('Invalid release identity');
  }
  return `hosted-httpagent-${releaseId}`;
}

export function assertHostedAdmission(context: HostedAdmission): Readonly<HostedAdmission> {
  const tagRef = `refs/tags/${deriveReleaseTag(context.releaseId)}`;
  const sourceShas = [context.candidateSha, context.checkoutSha, context.githubSha,
    context.workflowSha, context.tagResolvedSha];
  if (sourceShas.some(sha => !/^[a-f0-9]{40}$/.test(sha) || sha.length !== 40 || sha !== context.candidateSha)
    || context.githubRef !== tagRef
    || context.workflowRef !== `cacheplane/chat-ui-bench/.github/workflows/hosted-httpagent-conformance.yml@${tagRef}`
    || context.repository !== 'cacheplane/chat-ui-bench'
    || context.eventName !== 'workflow_dispatch' || context.actions !== 'true'
    || context.platform !== 'linux' || context.runnerOs !== 'Linux'
    || context.runnerMarker !== 'ubuntu-24.04-hosted-httpagent' || context.attempt !== '1') {
    throw new Error('Hosted source/context admission denied');
  }
  return Object.freeze({
    candidateSha: context.candidateSha, checkoutSha: context.checkoutSha,
    githubSha: context.githubSha, workflowSha: context.workflowSha,
    tagResolvedSha: context.tagResolvedSha, githubRef: context.githubRef,
    workflowRef: context.workflowRef, repository: context.repository,
    eventName: context.eventName, actions: context.actions, platform: context.platform,
    runnerOs: context.runnerOs, runnerMarker: context.runnerMarker,
    releaseId: context.releaseId, attempt: context.attempt,
  });
}

export async function admitAndLoad<T>(context: HostedAdmission, loader: () => T | Promise<T>): Promise<T> {
  assertHostedAdmission(context);
  return loader();
}

export const CAPTURE_LIMITS = {
  bodyBytes: 512_000, aggregateBytes: 8 * 1024 * 1024,
  frameDepth: 8, frameNodes: 4096, frames: 204,
  itemBytes: 4096, itemDepth: 4, itemNodes: 256, errorStringBytes: 2048,
} as const;
export interface CaptureBudget { retainedBytes: number; domains: Record<string, number> }
export function reserveCaptureBytes(budget: CaptureBudget, domain: string | null, bytes: number): void {
  const prior = domain === null ? 0 : budget.domains[domain] ?? 0;
  if (!Number.isSafeInteger(bytes) || bytes < 0
    || !Number.isSafeInteger(budget.retainedBytes) || budget.retainedBytes < 0
    || !Number.isSafeInteger(prior) || prior < 0
    || budget.retainedBytes + bytes > CAPTURE_LIMITS.aggregateBytes
    || (domain !== null && prior + bytes > CAPTURE_LIMITS.bodyBytes)) {
    throw new Error('Capture byte limit');
  }
  budget.retainedBytes += bytes;
  if (domain !== null) Object.defineProperty(budget.domains, domain, { value: prior + bytes, writable: true, enumerable: true, configurable: true });
}

function utf8Bytes(value: string): number { return new TextEncoder().encode(value).byteLength; }
function boundedString(value: unknown, limit: number): string {
  if (typeof value !== 'string' || value.length > limit || utf8Bytes(value) > limit) throw new Error('String byte limit');
  return value;
}

/** Root containers have depth one; scalar leaves do not add container depth.
 * Nodes count each container and scalar once, including repeated references.
 * Traversal and serialization happen before cloning and retained-budget admission.
 */
function validateJsonGraph(value: unknown, maxDepth: number, maxNodes: number, maxBytes: number): string {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > maxNodes) throw new Error('JSON node limit');
    const current = item.value;
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'number') { if (!Number.isFinite(current)) throw new Error('Non-JSON number'); continue; }
    if (typeof current === 'string') { boundedString(current, maxBytes); continue; }
    if (typeof current !== 'object') throw new Error('Non-JSON value');
    const depth = item.depth + 1;
    if (depth > maxDepth) throw new Error('JSON depth limit');
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) throw new Error('Non-plain JSON object');
    const keys = Reflect.ownKeys(current);
    if (keys.length > maxNodes + 1) throw new Error('JSON node limit');
    let elements = 0;
    for (const key of keys) {
      if (Array.isArray(current) && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('Non-JSON key');
      boundedString(key, maxBytes);
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Non-JSON property');
      if (Array.isArray(current) && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length)) throw new Error('Non-JSON array property');
      elements++;
      if (nodes + stack.length + 1 > maxNodes) throw new Error('JSON node limit');
      stack.push({ value: descriptor.value, depth });
    }
    if (Array.isArray(current) && elements !== current.length) throw new Error('Sparse JSON array');
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > maxBytes || utf8Bytes(serialized) > maxBytes) throw new Error('JSON byte limit');
  return serialized;
}

function itemJson(value: unknown): string {
  return validateJsonGraph(value, CAPTURE_LIMITS.itemDepth, CAPTURE_LIMITS.itemNodes, CAPTURE_LIMITS.itemBytes);
}

export function projectBoundedJson(value: unknown, budget: CaptureBudget): unknown {
  const serialized = itemJson(value);
  reserveCaptureBytes(budget, null, utf8Bytes(serialized));
  return JSON.parse(serialized);
}

function selected(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) throw new Error('Callback accessor rejected');
  return descriptor.value;
}

export function projectObservedEvent(value: Record<string, unknown>, budget: CaptureBudget): Record<string, unknown> {
  const type = boundedString(selected(value, 'type'), CAPTURE_LIMITS.errorStringBytes);
  const projection: Record<string, unknown> = { type };
  for (const key of ['runId', 'threadId', 'messageId']) {
    const field = selected(value, key);
    if (field !== undefined) projection[key] = boundedString(field, CAPTURE_LIMITS.errorStringBytes);
  }
  if (type === 'TEXT_MESSAGE_CONTENT') projection.delta = boundedString(selected(value, 'delta'), CAPTURE_LIMITS.errorStringBytes);
  if (type === 'MESSAGES_SNAPSHOT') {
    const messages = selected(value, 'messages');
    if (!Array.isArray(messages) || messages.length > CAPTURE_LIMITS.frameNodes) throw new Error('Snapshot count limit');
    projection.messageCount = messages.length;
  }
  const timestamp = selected(value, 'timestamp');
  if (timestamp !== undefined) {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) throw new Error('Invalid timestamp');
    projection.timestamp = timestamp;
  }
  const metadata = selected(value, 'metadata');
  if (metadata !== undefined) { itemJson(metadata); projection.metadata = metadata; }
  // The projection has a shallow envelope in addition to its separately bounded metadata.
  const serialized = validateJsonGraph(projection, CAPTURE_LIMITS.itemDepth + 1, CAPTURE_LIMITS.itemNodes + 16, 16_384);
  reserveCaptureBytes(budget, null, utf8Bytes(serialized));
  return JSON.parse(serialized) as Record<string, unknown>;
}
export interface ObservationRecorder {
  budget: CaptureBudget; events: Record<string, unknown>[]; errors: Record<string, unknown>[];
  failures: string[]; captureFailed: boolean;
}
export function recordObservedEvent(recorder: ObservationRecorder, value: Record<string, unknown>): void {
  try { recorder.events.push(projectObservedEvent(value, recorder.budget)); }
  catch { containCaptureFailure(recorder); }
}
function containCaptureFailure(recorder: ObservationRecorder): void {
  recorder.captureFailed = true;
  // One fixed summary is sufficient; repeated failing callbacks cannot grow it.
  if (recorder.failures.length) return;
  try {
    reserveCaptureBytes(recorder.budget, null, utf8Bytes(JSON.stringify('Observation capture failed')));
    recorder.failures.push('Observation capture failed');
  } catch { /* Scalar captureFailed remains visible even if no evidence bytes remain. */ }
}
export function recordObservedError(recorder: ObservationRecorder, value: Record<string, unknown>): void {
  try {
    const projection: Record<string, unknown> = {};
    for (const key of ['name', 'message', 'code']) {
      const field = selected(value, key);
      if (field !== undefined) projection[key] = boundedString(field, CAPTURE_LIMITS.errorStringBytes);
    }
    const status = selected(value, 'status');
    if (status !== undefined) {
      if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) throw new Error('Invalid status');
      projection.status = status;
    }
    const payload = selected(value, 'payload');
    if (payload !== undefined) { itemJson(payload); projection.payload = payload; }
    recorder.errors.push(projectBoundedJson(projection, recorder.budget) as Record<string, unknown>);
  } catch { containCaptureFailure(recorder); }
}
export function parseRecordedSse(raw: string, budget: CaptureBudget, domain = 'wire'): unknown[] {
  if (raw.length > CAPTURE_LIMITS.bodyBytes || utf8Bytes(raw) > CAPTURE_LIMITS.bodyBytes) throw new Error('Body byte limit');
  if (!raw || !raw.endsWith('\n\n')) throw new Error('Incomplete SSE framing');
  const frames = raw.slice(0, -2).split('\n\n');
  if (frames.length > CAPTURE_LIMITS.frames) throw new Error('SSE frame count limit');
  for (const frame of frames) {
    if (!frame.startsWith('data: ') || frame.includes('\n') || frame.includes('\r') || frame.length <= 6) throw new Error('Invalid SSE grammar');
    if (utf8Bytes(frame + '\n\n') > CAPTURE_LIMITS.bodyBytes) throw new Error('Frame byte limit');
  }
  // Parsed values are bounded transient candidates, never exposed until the full
  // response validates and all raw plus decoded durable bytes can be reserved.
  const serializedFrames = frames.map(frame => {
    const decoded: unknown = JSON.parse(frame.slice(6));
    return validateJsonGraph(decoded, CAPTURE_LIMITS.frameDepth, CAPTURE_LIMITS.frameNodes, CAPTURE_LIMITS.bodyBytes);
  });
  const rawBytes = utf8Bytes(raw);
  const decodedBytes = serializedFrames.reduce((sum, item) => sum + utf8Bytes(item), 0);
  const trial: CaptureBudget = { retainedBytes: budget.retainedBytes, domains: { ...budget.domains } };
  reserveCaptureBytes(trial, domain, rawBytes);
  reserveCaptureBytes(trial, null, decodedBytes);
  budget.retainedBytes = trial.retainedBytes;
  budget.domains = trial.domains;
  return serializedFrames.map(item => JSON.parse(item) as unknown);
}
export interface OperationGate { admit(): number; settle(token: number, complete: boolean): void; close(): void; readonly admitted: number; readonly active: number | null; readonly closed: boolean }
export function createOperationGate(): OperationGate {
  let admitted = 0;
  let active: number | null = null;
  let closed = false;
  return { get admitted() { return admitted; }, get active() { return active; }, get closed() { return closed; },
    admit() {
      if (closed || active !== null || admitted >= 8) throw new Error('Operation admission denied');
      active = ++admitted;
      return active;
    },
    settle(token, complete) {
      if (active === null || token !== active) throw new Error('Wrong original operation');
      active = null;
      if (!complete) closed = true;
    },
    close() { closed = true; },
  };
}
export interface ReaderLifecycle {
  phase: 'open' | 'reading' | 'closing' | 'released';
  pendingRead: boolean; pendingCancel: boolean; disposalStarted: boolean;
  cancelStarted: boolean; cancelSettled: boolean;
  eof: boolean; socketClosed: boolean; releases: number;
}
export type ReaderTransition = 'read' | 'readSettled' | 'enqueue' | 'eof' | 'dispose' | 'cancel' | 'cancelSettled' | 'release' | 'socketClosed';
export function transitionReader(state: ReaderLifecycle, action: ReaderTransition): ReaderLifecycle {
  const next = { ...state };
  switch (action) {
    case 'read':
      if (state.phase !== 'open' || state.pendingRead || state.pendingCancel) throw new Error('Read admission denied');
      next.phase = 'reading'; next.pendingRead = true; break;
    case 'readSettled':
      if (!state.pendingRead) throw new Error('No pending original read');
      next.pendingRead = false; if (state.phase === 'reading') next.phase = 'open'; break;
    case 'enqueue':
      if (state.phase !== 'open' || state.pendingRead || state.pendingCancel) throw new Error('Enqueue denied');
      break;
    case 'eof':
      if (state.phase !== 'open' || state.pendingRead || state.pendingCancel) throw new Error('EOF transition denied');
      next.eof = true; next.phase = 'closing'; break;
    case 'dispose':
      if (state.phase === 'released' || state.disposalStarted) return next;
      next.disposalStarted = true; next.phase = 'closing'; break;
    case 'cancel':
      if (state.phase !== 'closing' || state.pendingRead || state.pendingCancel || state.cancelStarted || state.eof) throw new Error('Cancel admission denied');
      next.pendingCancel = true; next.cancelStarted = true; break;
    case 'cancelSettled':
      if (!state.pendingCancel) throw new Error('No pending original cancel');
      next.pendingCancel = false; next.cancelSettled = true; break;
    case 'release':
      if (state.phase === 'released') return next;
      if (state.phase !== 'closing' || state.pendingRead || state.pendingCancel || (!state.eof && !state.cancelSettled)) throw new Error('Reader release denied');
      next.phase = 'released'; next.releases = 1; break;
    case 'socketClosed': next.socketClosed = true; break;
  }
  return next;
}

/** Inert production task admission. Rows are serialized evidence capacity,
 * not heap measurement. Normal work cannot consume terminal owner quotas. */
export const TASK_LIMITS = { total: 8192, normal: 7680, terminal: 512, terminalReceiptBytes: 65_536 } as const;
export interface TaskTicket { id: number; label: string; owner: string; lane: 'normal' | 'terminal' }
export interface TaskCapacity {
  normalUsed: number; terminalUsed: number; normalClosed: boolean;
  nextId: number; pending: Record<string, TaskTicket>; terminalKeys: Record<string, true>;
  terminalReceiptSlots: boolean[];
}
export function createTaskCapacity(budget: CaptureBudget): TaskCapacity {
  // Prepaid independently retained serialized/disk summaries, two fixed slots.
  reserveCaptureBytes(budget, null, 2 * TASK_LIMITS.terminalReceiptBytes);
  return { normalUsed: 0, terminalUsed: 0, normalClosed: false, nextId: 1,
    pending: {}, terminalKeys: {}, terminalReceiptSlots: [false, false] };
}
export function reserveTaskGroup(capacity: TaskCapacity, lane: 'normal' | 'terminal',
  requests: readonly { label: string; owner: string }[]): TaskTicket[] | null {
  const normalLabels = [
    'response-finish', 'response-close', 'socket-close', 'response-end', 'server-allocate', 'server-listen', 'server-close',
    'upstream-request-body', 'aimock-public-handler', 'aimock-handler-branch', 'reader-acquire', 'reader-read', 'wrapper-pull',
    'response-write-callback', 'response-drain', 'proxy-forwarding', 'proxy-upstream-fetch', 'sdk-scoped-fetch', 'watchdog',
    'operation-resource-settlement', 'sdk-finalized-notification', 'sdk-operation-setup', 'sdk-subscribe', 'sdk-public-run-agent',
    'raw-operation-setup', 'raw-public-fetch-body', 'raw-fetch', 'receipt-write', 'raw-evidence-write', 'receipt-deadline-observation',
  ];
  const keys = new Set<string>();
  const valid = Array.isArray(requests) && requests.length > 0 && requests.length <= 3
    && requests.every(request => {
      if (lane === 'normal') return normalLabels.includes(request.label)
        && /^(session|operation-[1-8]|reader-([1-9]|1[0-6]))$/.test(request.owner);
      const fixed = (request.owner === 'session' && ['session-dispose', 'session-resource-cleanup',
        'terminal-cleanup-watchdog', 'disposal-receipt-observation'].includes(request.label))
        || (/^reader-([1-9]|1[0-6])$/.test(request.owner) && ['reader-dispose', 'reader-cancel'].includes(request.label))
        || (/^operation-[1-8]$/.test(request.owner) && ['proxy-dispose', 'sdk-unsubscribe'].includes(request.label))
        || (/^receipt-[12]$/.test(request.owner) && ['terminal-receipt-write', 'terminal-receipt-observation', 'terminal-receipt-watchdog'].includes(request.label));
      const key = `${request.owner}:${request.label}`;
      if (!fixed || capacity.terminalKeys[key] || keys.has(key)) return false;
      keys.add(key); return true;
    });
  const count = requests.length;
  const countersValid = Number.isSafeInteger(capacity.normalUsed) && capacity.normalUsed >= 0
    && Number.isSafeInteger(capacity.terminalUsed) && capacity.terminalUsed >= 0
    && Number.isSafeInteger(capacity.nextId) && capacity.nextId >= 1;
  if (!valid || !countersValid || capacity.nextId + count - 1 > TASK_LIMITS.total
    || capacity.normalUsed + capacity.terminalUsed + count > TASK_LIMITS.total
    || (lane === 'normal' && (capacity.normalClosed || capacity.normalUsed + count > TASK_LIMITS.normal))
    || (lane === 'terminal' && capacity.terminalUsed + count > TASK_LIMITS.terminal)) {
    if (lane === 'normal') capacity.normalClosed = true;
    return null;
  }
  if (lane === 'normal') capacity.normalUsed += requests.length; else capacity.terminalUsed += requests.length;
  for (const key of keys) capacity.terminalKeys[key] = true;
  return requests.map(request => {
    const ticket: TaskTicket = { id: capacity.nextId++, ...request, lane };
    capacity.pending[ticket.id] = ticket; return ticket;
  });
}
export function commitTaskTicket(capacity: TaskCapacity, ticket: TaskTicket): void {
  if (capacity.pending[ticket.id] !== ticket) throw new Error('Invalid task ticket');
  delete capacity.pending[ticket.id];
}
export function admitReaderRead(capacity: TaskCapacity, state: ReaderLifecycle, owner: string): {
  ticket: TaskTicket; state: ReaderLifecycle;
} | null {
  const next = transitionReader(state, 'read');
  const group = reserveTaskGroup(capacity, 'normal', [{ label: 'reader-read', owner }]);
  return group ? { ticket: group[0]!, state: next } : null;
}
export function claimTerminalReceiptSlot(capacity: TaskCapacity, slot: number, bytes: number): boolean {
  if (!Number.isInteger(slot) || slot < 1 || slot > 2 || capacity.terminalReceiptSlots[slot - 1]
    || !Number.isSafeInteger(bytes) || bytes < 0 || bytes > TASK_LIMITS.terminalReceiptBytes) return false;
  capacity.terminalReceiptSlots[slot - 1] = true; return true;
}

/** Returned string is the one owned serialized publication buffer; caller
 * saves no candidate graph. Prepaid slot charges this buffer AND its disk copy.
 */
export function encodeTerminalSummary(capacity: TaskCapacity, slot: number, value: unknown,
  fallbackIdentity: unknown): { serialized: string; reduced: boolean } {
  let serialized: string; let reduced = false;
  try { serialized = validateJsonGraph(value, 8, 4096, TASK_LIMITS.terminalReceiptBytes / 2); }
  catch {
    reduced = true;
    const identity = JSON.parse(validateJsonGraph(fallbackIdentity, 4, 128, 4096)) as unknown;
    serialized = JSON.stringify({ scope: 'reduced-incomplete-summary', identity,
      incomplete: true, captureFailed: true, transportComplete: false, qualification: false,
      rawPersistenceComplete: false, completeWireOracle: false,
      publication: { state: 'pending', horizon: 'pre-publication' }, reason: 'Terminal summary bound exceeded' });
  }
  if (!claimTerminalReceiptSlot(capacity, slot, 2 * utf8Bytes(serialized))) throw new Error('Terminal publication slot denied');
  return { serialized, reduced };
}
