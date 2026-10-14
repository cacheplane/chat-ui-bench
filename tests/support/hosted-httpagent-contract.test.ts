import { describe, expect, it } from 'vitest';
import { admitAndLoad, assertHostedAdmission, deriveReleaseTag, CAPTURE_LIMITS,
  reserveCaptureBytes, projectBoundedJson, projectObservedEvent, recordObservedEvent,
  recordObservedError, parseRecordedSse, createOperationGate, transitionReader,
  TASK_LIMITS, createTaskCapacity, reserveTaskGroup, commitTaskTicket,
  admitReaderRead, claimTerminalReceiptSlot, encodeTerminalSummary } from './hosted-httpagent-contract.js';
import type { HostedAdmission, CaptureBudget, ObservationRecorder, ReaderLifecycle } from './hosted-httpagent-contract.js';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
const releaseId = 'receipt-1';
const tagRef = 'refs/tags/hosted-httpagent-receipt-1';
const workflowRef = `cacheplane/chat-ui-bench/.github/workflows/hosted-httpagent-conformance.yml@${tagRef}`;
const accepted: HostedAdmission = {
  candidateSha: sha, checkoutSha: sha, githubSha: sha, workflowSha: sha,
  tagResolvedSha: sha, githubRef: tagRef, workflowRef,
  repository: 'cacheplane/chat-ui-bench', eventName: 'workflow_dispatch',
  actions: 'true', platform: 'linux', runnerOs: 'Linux',
  runnerMarker: 'ubuntu-24.04-hosted-httpagent', releaseId, attempt: '1',
};

describe('same-source hosted admission', () => {
  it('admits exact literal identities and calls harmless loader once', async () => {
    let calls = 0;
    expect(assertHostedAdmission(accepted)).toEqual(accepted);
    expect(assertHostedAdmission(accepted)).not.toBe(accepted);
    expect(deriveReleaseTag(releaseId)).toBe('hosted-httpagent-receipt-1');
    await expect(admitAndLoad(accepted, () => { calls++; return { admitted: true }; })).resolves.toEqual({ admitted: true });
    expect(calls).toBe(1);
  });

  const denials: Partial<HostedAdmission>[] = [
    { candidateSha: other }, { checkoutSha: other }, { githubSha: other },
    { workflowSha: other }, { tagResolvedSha: other },
    ...(['candidateSha', 'checkoutSha', 'githubSha', 'workflowSha', 'tagResolvedSha'] as const)
      .flatMap(key => [{ [key]: 'A'.repeat(40) }, { [key]: 'a'.repeat(39) }, { [key]: 'g'.repeat(40) }]),
    { githubRef: 'refs/heads/hosted-httpagent-receipt-1' },
    { githubRef: `${tagRef}-suffix` }, { workflowRef: `${workflowRef}-suffix` },
    { workflowRef: workflowRef.replace('cacheplane', 'outsider') },
    { workflowRef: workflowRef.replace('hosted-httpagent-conformance.yml', 'another.yml') },
    { workflowRef: workflowRef.replace(tagRef, 'refs/heads/main') },
    { repository: 'outsider/chat-ui-bench' }, { eventName: 'push' },
    { actions: '' }, { platform: 'darwin' }, { runnerOs: 'macOS' },
    { runnerMarker: '' }, { releaseId: '' }, { releaseId: 'x'.repeat(65) },
    { releaseId: '-bad' }, { releaseId: 'Upper' }, { releaseId: 'bad/id' },
    { releaseId: 'bad\n' }, { attempt: '2' }, { attempt: '01' },
  ];
  it.each(denials)('rejects drift %j before loading', async drift => {
    let calls = 0;
    await expect(admitAndLoad({ ...accepted, ...drift }, () => { calls++; return 'harmless'; })).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

describe('production task quotas and prepaid terminal publication', () => {
  it('keeps terminal rows available after normal admission exhausts', () => {
    const capacity = createTaskCapacity(budget()); capacity.normalUsed = 7680;
    expect(reserveTaskGroup(capacity, 'normal', [{ label: 'reader-read', owner: 'reader-1' }])).toBeNull();
    expect(capacity.normalUsed).toBe(7680); expect(capacity.normalClosed).toBe(true);
    expect(reserveTaskGroup(capacity, 'terminal', [{ label: 'session-dispose', owner: 'session' }])).toHaveLength(1);
    expect(TASK_LIMITS.normal + TASK_LIMITS.terminal).toBe(8192);
  });
  it('rejects a two-row writer group without partial admission or pending callback', () => {
    const capacity = createTaskCapacity(budget()); capacity.normalUsed = 7679;
    expect(reserveTaskGroup(capacity, 'normal', [
      { label: 'response-write-callback', owner: 'operation-1' }, { label: 'response-drain', owner: 'operation-1' },
    ])).toBeNull();
    expect(capacity.normalUsed).toBe(7679); expect(capacity.pending).toEqual({}); expect(capacity.nextId).toBe(1);
  });
  it('denied reader admission leaves the real inert state unchanged', () => {
    const capacity = createTaskCapacity(budget()); capacity.normalUsed = 7680;
    const state = reader(); expect(admitReaderRead(capacity, state, 'reader-16')).toBeNull();
    expect(state).toEqual(reader()); expect(capacity.pending).toEqual({});
    expect(transitionReader(state, 'dispose').pendingRead).toBe(false);
  });
  it.each([
    [{ label: 'reader-read', owner: 'reader-1' }],
    [{ label: 'reader-cancel', owner: 'reader-17' }],
    [{ label: 'proxy-dispose', owner: 'operation-9' }],
    [{ label: 'sdk-unsubscribe', owner: 'session' }],
    [{ label: 'terminal-receipt-write', owner: 'receipt-3' }],
    [{ label: 'terminal-cleanup-watchdog', owner: 'operation-1' }],
    [{ label: 'session-dispose', owner: 'session' }, { label: 'session-dispose', owner: 'session' }],
  ].map(requests => ({ requests })))('rejects invalid terminal group %j without consuming reserve', ({ requests }) => {
    const capacity = createTaskCapacity(budget()); expect(reserveTaskGroup(capacity, 'terminal', requests)).toBeNull();
    expect(capacity.terminalUsed).toBe(0); expect(capacity.pending).toEqual({});
  });
  it('admits exactly all 58 fixed terminal owner roles once, after normal closure', () => {
    const capacity = createTaskCapacity(budget()); capacity.normalUsed = 7680; capacity.normalClosed = true;
    const requests = [
      ...['session-dispose', 'session-resource-cleanup', 'terminal-cleanup-watchdog', 'disposal-receipt-observation'].map(label => ({ label, owner: 'session' })),
      ...Array.from({ length: 16 }, (_, i) => ['reader-dispose', 'reader-cancel'].map(label => ({ label, owner: `reader-${i + 1}` }))).flat(),
      ...Array.from({ length: 8 }, (_, i) => ['proxy-dispose', 'sdk-unsubscribe'].map(label => ({ label, owner: `operation-${i + 1}` }))).flat(),
      ...Array.from({ length: 2 }, (_, i) => ['terminal-receipt-write', 'terminal-receipt-observation', 'terminal-receipt-watchdog'].map(label => ({ label, owner: `receipt-${i + 1}` }))).flat(),
    ];
    expect(requests).toHaveLength(58);
    for (const request of requests) {
      const group = reserveTaskGroup(capacity, 'terminal', [request]); expect(group).toHaveLength(1);
      commitTaskTicket(capacity, group![0]!);
      expect(reserveTaskGroup(capacity, 'terminal', [request])).toBeNull();
    }
    expect(capacity.terminalUsed).toBe(58); expect(capacity.normalUsed + capacity.terminalUsed).toBeLessThanOrEqual(8192);
    expect(capacity.pending).toEqual({});
  });
  it('commits only an original owned ticket once', () => {
    const capacity = createTaskCapacity(budget()); const ticket = reserveTaskGroup(capacity, 'normal', [{ label: 'reader-read', owner: 'reader-1' }])![0]!;
    expect(() => commitTaskTicket(capacity, { ...ticket })).toThrow(); commitTaskTicket(capacity, ticket);
    expect(() => commitTaskTicket(capacity, ticket)).toThrow();
  });
  it('prepaid terminal slots remain available with the ordinary aggregate full', () => {
    const capture = budget(); const capacity = createTaskCapacity(capture);
    expect(capture.retainedBytes).toBe(131072);
    reserveCaptureBytes(capture, null, CAPTURE_LIMITS.aggregateBytes - capture.retainedBytes);
    expect(() => reserveCaptureBytes(capture, null, 1)).toThrow();
    expect(claimTerminalReceiptSlot(capacity, 1, 65536)).toBe(true);
    expect(claimTerminalReceiptSlot(capacity, 1, 1)).toBe(false);
    expect(claimTerminalReceiptSlot(capacity, 2, 65536)).toBe(true);
    expect(capture.retainedBytes).toBe(8 * 1024 * 1024);
  });
  it.each([-1, 0.5, NaN, Infinity, 65537])('rejects bad terminal byte count %s without spending a slot', bytes => {
    const capacity = createTaskCapacity(budget()); expect(claimTerminalReceiptSlot(capacity, 1, bytes)).toBe(false);
    expect(capacity.terminalReceiptSlots).toEqual([false, false]);
  });
  it('independent literal clean eight-operation summary fits the 32KiB two-copy slot', () => {
    const value = { scope: 'terminal-disposition-summary', identity: accepted,
      validation: { operationTokens: [1, 2, 3, 4, 5, 6, 7, 8], assertionOutcome: 'passed' },
      operations: Array.from({ length: 8 }, (_, i) => ({ token: i + 1, kind: i < 5 ? 'sdk' : 'raw', original: 'fulfilled', complete: true,
        finalized: i < 5, timedOut: false, status: i < 3 ? 200 : 404, requests: 1, callbackCounts: { events: i === 1 ? 204 : 3, errors: 0 },
        bodies: Array.from({ length: 5 }, (_, j) => ({ domain: `${i + 1}:boundary-${j}`, bytes: 512000,
          sha256: 'a'.repeat(64), persistedChunks: 204, chunks: 204, persistedBytes: 512000, persistenceFailed: false, persistenceIncomplete: false })) })),
      readers: Array.from({ length: 16 }, (_, i) => ({ id: i + 1, operation: Math.floor(i / 2) + 1, phase: 'released',
        pendingRead: false, pendingCancel: false, disposalStarted: true, cancelStarted: false, cancelSettled: false, eof: true, socketClosed: true, releases: 1, terminal: 'eof' })),
      tasks: Array.from({ length: 48 }, (_, i) => ({ label: `fixed-label-${i}`, pending: 0, fulfilled: 8192, rejected: 0 })),
      resources: { sockets: 64, closedSockets: 64, responses: 16, finishedResponses: 16, servers: 2, settledServers: 2 },
      primaryFailures: [], cleanupFailures: [], incomplete: false, captureFailed: false,
      publication: { state: 'pending', horizon: 'pre-publication' } };
    const capture = budget(); const capacity = createTaskCapacity(capture);
    const encoded = encodeTerminalSummary(capacity, 1, value, accepted);
    expect(encoded.reduced).toBe(false); expect(new TextEncoder().encode(encoded.serialized).byteLength).toBeLessThanOrEqual(32768);
    expect(JSON.parse(encoded.serialized)).toEqual(value); expect(capture.retainedBytes).toBe(131072);
    expect(() => encodeTerminalSummary(capacity, 1, value, accepted)).toThrow();
  });
  it('oversize summary forces incomplete reduced fallback, never shorter success', () => {
    const capacity = createTaskCapacity(budget());
    const encoded = encodeTerminalSummary(capacity, 1, { transportComplete: true, qualification: true, padding: 'x'.repeat(32769) }, accepted);
    expect(encoded.reduced).toBe(true); expect(JSON.parse(encoded.serialized)).toMatchObject({
      incomplete: true, captureFailed: true, transportComplete: false, qualification: false, scope: 'reduced-incomplete-summary',
      rawPersistenceComplete: false, completeWireOracle: false,
    });
    expect(capacity.terminalReceiptSlots).toEqual([true, false]);
  });
});

const budget = (): CaptureBudget => ({ retainedBytes: 0, domains: {} });
const recorder = (): ObservationRecorder => ({ budget: budget(), events: [], errors: [], failures: [], captureFailed: false });
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const nested = (depth: number): unknown => { let value: unknown = 1; for (let i = 0; i < depth; i++) value = { child: value }; return value; };

describe('capture reservations', () => {
  it('admits exact body and aggregate boundaries', () => {
    const capture = budget();
    reserveCaptureBytes(capture, 'request', 512000);
    reserveCaptureBytes(capture, null, CAPTURE_LIMITS.aggregateBytes - 512000);
    expect(capture.retainedBytes).toBe(CAPTURE_LIMITS.aggregateBytes);
    const before = structuredClone(capture);
    expect(() => reserveCaptureBytes(capture, null, 1)).toThrow();
    expect(capture).toEqual(before);
  });
  it('counts body chunks before admitting overflow', () => {
    const capture = budget();
    reserveCaptureBytes(capture, 'response', 511999);
    reserveCaptureBytes(capture, 'response', 1);
    const before = structuredClone(capture);
    expect(() => reserveCaptureBytes(capture, 'response', 1)).toThrow();
    expect(capture).toEqual(before);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid count %s without mutation', bytes => {
    const capture = budget();
    expect(() => reserveCaptureBytes(capture, 'body', bytes)).toThrow();
    expect(capture).toEqual(budget());
  });
  it('uses UTF-8 bytes for metadata, clones after admission, and isolates mutation', () => {
    const capture = budget();
    const value = { label: 'é' };
    const copy = projectBoundedJson(value, capture);
    value.label = 'changed';
    expect(copy).toEqual({ label: 'é' });
    expect(capture.retainedBytes).toBe(new TextEncoder().encode('{"label":"é"}').byteLength);
  });
  it('admits metadata at exact bytes/depth/nodes limits', () => {
    expect(projectBoundedJson('x'.repeat(4094), budget())).toBe('x'.repeat(4094));
    expect(projectBoundedJson(nested(4), budget())).toEqual(nested(4));
    expect(projectBoundedJson(Array.from({ length: 255 }, () => 0), budget())).toHaveLength(255);
  });
  it.each(['x'.repeat(4095), 'é'.repeat(2048), nested(5), Array.from({ length: 256 }, () => 0)])('rejects metadata overflow without retention', value => {
    const capture = budget();
    expect(() => projectBoundedJson(value, capture)).toThrow();
    expect(capture.retainedBytes).toBe(0);
  });
  it('rejects cycles and accessor data without executing getters', () => {
    const cyclic: Record<string, unknown> = {}; cyclic.child = cyclic;
    expect(() => projectBoundedJson(cyclic, budget())).toThrow();
    let reads = 0;
    const accessor = { get value() { reads++; return 'secret'; } };
    expect(() => projectBoundedJson(accessor, budget())).toThrow();
    expect(reads).toBe(0);
  });
});

describe('small synchronous callback records', () => {
  it('never reads callback context/state/buffer and copies selected delta fields', () => {
    const capture = budget();
    let unrelatedReads = 0;
    const event = { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'abc', metadata: { sample: 2 }, timestamp: 1,
      get messages() { unrelatedReads++; return Array.from({ length: 100 }, () => ({ content: 'x'.repeat(512) })); },
      get state() { unrelatedReads++; return {}; }, get textMessageBuffer() { unrelatedReads++; return 'unbounded'; },
      get input() { unrelatedReads++; return {}; },
    };
    const result = projectObservedEvent(event, capture);
    event.metadata.sample = 3;
    expect(result).toEqual({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: 'abc', metadata: { sample: 2 }, timestamp: 1 });
    expect(unrelatedReads).toBe(0);
    expect(capture.retainedBytes).toBe(new TextEncoder().encode(JSON.stringify(result)).byteLength);
  });
  it('projects snapshot count without reading history contents', () => {
    const messages = new Array(100);
    Object.defineProperty(messages, 0, { get() { throw new Error('history must not be read'); } });
    expect(projectObservedEvent({ type: 'MESSAGES_SNAPSHOT', messages }, budget())).toEqual({ type: 'MESSAGES_SNAPSHOT', messageCount: 100 });
  });
  it('records finalization as scalar observation only', () => {
    expect(projectObservedEvent({ type: 'RUN_FINALIZED', runId: 'r', state: { secret: 1 } }, budget())).toEqual({ type: 'RUN_FINALIZED', runId: 'r' });
  });
  it('contains invalid metadata synchronously with fixed bounded failure', () => {
    const capture = recorder();
    expect(recordObservedEvent(capture, { type: 'X', metadata: { secret: 'x'.repeat(5000) } })).toBeUndefined();
    expect(capture.events).toEqual([]);
    expect(capture.captureFailed).toBe(true);
    expect(capture.failures).toEqual(['Observation capture failed']);
    expect(capture.budget.retainedBytes).toBe(new TextEncoder().encode(JSON.stringify('Observation capture failed')).byteLength);
  });
  it('retains only error name/message/code/status/payload and clones payload', () => {
    const capture = recorder();
    const error = { name: 'Error', message: 'failure', code: 'FIXTURE_ERROR', status: 404, payload: { reason: 'miss' }, stack: 'private stack' };
    expect(recordObservedError(capture, error)).toBeUndefined();
    error.payload.reason = 'changed';
    expect(capture.errors).toEqual([{ name: 'Error', message: 'failure', code: 'FIXTURE_ERROR', status: 404, payload: { reason: 'miss' } }]);
  });
  it.each([{ message: 'x'.repeat(2049) }, { name: 'é'.repeat(1025) }, { code: 'x'.repeat(2049) }, { payload: nested(5) }, { payload: 'x'.repeat(4095) }, { payload: Array.from({ length: 256 }, () => 0) }])('contains error overflow', error => {
    const capture = recorder();
    expect(recordObservedError(capture, error)).toBeUndefined();
    expect(capture.errors).toEqual([]);
    expect(capture.failures).toEqual(['Observation capture failed']);
  });
  it('retains exact 2048-byte error string', () => {
    const capture = recorder(); recordObservedError(capture, { message: 'x'.repeat(2048) });
    expect(capture.errors[0]?.message).toHaveLength(2048);
  });
  it('contains exhausted aggregate and retains no uncharged failure', () => {
    const capture = recorder(); capture.budget.retainedBytes = CAPTURE_LIMITS.aggregateBytes;
    expect(recordObservedEvent(capture, { type: 'RUN_STARTED' })).toBeUndefined();
    expect(recordObservedError(capture, { message: 'error' })).toBeUndefined();
    expect(capture.captureFailed).toBe(true);
    expect(capture.events).toEqual([]); expect(capture.errors).toEqual([]); expect(capture.failures).toEqual([]);
    expect(capture.budget.retainedBytes).toBe(CAPTURE_LIMITS.aggregateBytes);
  });
});

describe('independent wire grammar and graph bounds', () => {
  it('admits full H100 snapshot exceeding metadata bytes and nodes', () => {
    const snapshot = { type: 'MESSAGES_SNAPSHOT', messages: Array.from({ length: 100 }, (_, i) => ({ id: `m-${i}`, role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(512) })), metadata: { fixture: 'literal' } };
    const raw = frame(snapshot);
    expect(new TextEncoder().encode(raw).byteLength).toBeGreaterThan(4096);
    const capture = budget(); const parsed = parseRecordedSse(raw, capture);
    expect(parsed).toEqual([snapshot]);
    expect((parsed[0] as typeof snapshot).messages).toHaveLength(100);
    expect(capture.retainedBytes).toBe(new TextEncoder().encode(raw).byteLength + new TextEncoder().encode(JSON.stringify(snapshot)).byteLength);
  });
  it.each(['data: {}\n', 'data: {}', 'event: x\ndata: {}\n\n', 'data: {}\ndata: {}\n\n', 'data:{}\n\n', 'data: {bad}\n\n', 'data: {}\r\n\r\n', '\n\n', ''])('rejects incomplete/noncanonical/malformed framing without retention', raw => {
    const capture = budget(); expect(() => parseRecordedSse(raw, capture)).toThrow(); expect(capture).toEqual(budget());
  });
  it('admits exact body bytes but rejects 512001 bytes before parse', () => {
    const raw = frame('x'.repeat(511990)); // JSON quotes + data prefix + separator = ten bytes.
    expect(new TextEncoder().encode(raw).byteLength).toBe(512000);
    expect(parseRecordedSse(raw, budget())).toHaveLength(1);
    const capture = budget();
    expect(() => parseRecordedSse('!'.repeat(512001), capture)).toThrow('Body byte limit');
    expect(capture).toEqual(budget());
  });
  it('admits 204 frames and rejects 205 before retaining', () => {
    expect(parseRecordedSse(frame({}).repeat(204), budget())).toHaveLength(204);
    const capture = budget(); expect(() => parseRecordedSse(frame({}).repeat(205), capture)).toThrow(); expect(capture).toEqual(budget());
  });
  it('uses whole-frame depth eight and node count 4096 independently', () => {
    expect(parseRecordedSse(frame(nested(8)), budget())).toEqual([nested(8)]);
    expect(parseRecordedSse(frame(Array.from({ length: 4095 }, () => 0)), budget())).toHaveLength(1);
    for (const value of [nested(9), Array.from({ length: 4096 }, () => 0)]) {
      const capture = budget(); expect(() => parseRecordedSse(frame(value), capture)).toThrow(); expect(capture).toEqual(budget());
    }
  });
  it('reserves raw and decoded copies before returning durable events', () => {
    const capture = budget(); const raw = frame({ type: 'X' });
    capture.retainedBytes = CAPTURE_LIMITS.aggregateBytes - new TextEncoder().encode(raw).byteLength;
    const before = structuredClone(capture);
    expect(() => parseRecordedSse(raw, capture)).toThrow(); expect(capture).toEqual(before);
  });
});

const reader = (): ReaderLifecycle => ({ phase: 'open', pendingRead: false, pendingCancel: false, disposalStarted: false, cancelStarted: false, cancelSettled: false, eof: false, socketClosed: false, releases: 0 });
describe('operation and reader ownership', () => {
  it('admits only one original; duplicate does not consume another request', () => {
    const gate = createOperationGate(); const token = gate.admit();
    expect(gate.active).toBe(token); expect(() => gate.admit()).toThrow(); expect(gate.admitted).toBe(1);
    expect(() => gate.settle(token + 1, true)).toThrow(); expect(gate.active).toBe(token);
    gate.settle(token, true); expect(gate.active).toBeNull(); expect(gate.admit()).toBe(2);
  });
  it('rejects the ninth operation and stale/duplicate settlement', () => {
    const gate = createOperationGate();
    for (let i = 0; i < 8; i++) { const token = gate.admit(); gate.settle(token, true); expect(() => gate.settle(token, true)).toThrow(); }
    expect(() => gate.admit()).toThrow(); expect(gate.admitted).toBe(8);
  });
  it('incomplete settlement and explicit close permanently stop admission', () => {
    const gate = createOperationGate(); const token = gate.admit(); gate.settle(token, false);
    expect(gate.closed).toBe(true); expect(() => gate.admit()).toThrow(); expect(gate.admitted).toBe(1);
    const closed = createOperationGate(); closed.close(); expect(() => closed.admit()).toThrow(); expect(closed.admitted).toBe(0);
  });
  it('serial read/read-settle/enqueue and EOF release do not imply socket close', () => {
    const initial = reader(); let state = transitionReader(initial, 'read');
    expect(initial.phase).toBe('open'); expect(state.pendingRead).toBe(true);
    expect(() => transitionReader(state, 'read')).toThrow(); expect(() => transitionReader(state, 'release')).toThrow();
    state = transitionReader(state, 'readSettled'); state = transitionReader(state, 'enqueue');
    state = transitionReader(state, 'eof'); expect(state.eof).toBe(true); expect(state.socketClosed).toBe(false);
    expect(() => transitionReader(state, 'read')).toThrow(); expect(() => transitionReader(state, 'enqueue')).toThrow();
    state = transitionReader(state, 'release'); expect(state.releases).toBe(1);
    expect(transitionReader(state, 'release')).toEqual(state); expect(transitionReader(state, 'dispose')).toEqual(state);
    expect(transitionReader(state, 'socketClosed').socketClosed).toBe(true);
  });
  it('dispose marks closing before pending read settles and cancel precedes release', () => {
    let state = transitionReader(reader(), 'read'); state = transitionReader(state, 'dispose');
    expect(state.phase).toBe('closing'); expect(state.disposalStarted).toBe(true);
    expect(transitionReader(state, 'dispose')).toEqual(state);
    for (const action of ['read', 'enqueue', 'release', 'cancel'] as const) expect(() => transitionReader(state, action)).toThrow();
    state = transitionReader(state, 'readSettled'); state = transitionReader(state, 'cancel');
    expect(state.pendingCancel).toBe(true); expect(() => transitionReader(state, 'release')).toThrow(); expect(() => transitionReader(state, 'cancel')).toThrow();
    state = transitionReader(state, 'cancelSettled'); state = transitionReader(state, 'release');
    expect(state.releases).toBe(1); expect(state.eof).toBe(false);
  });
  it('rejects cancellation before close and settlement without original', () => {
    for (const action of ['cancel', 'cancelSettled', 'readSettled', 'release'] as const) expect(() => transitionReader(reader(), action)).toThrow();
  });
  it('requires non-EOF cancellation settlement before release and never cancels twice', () => {
    let state = transitionReader(reader(), 'dispose');
    expect(() => transitionReader(state, 'release')).toThrow();
    state = transitionReader(state, 'cancel'); state = transitionReader(state, 'cancelSettled');
    expect(() => transitionReader(state, 'cancel')).toThrow();
    expect(transitionReader(state, 'release').releases).toBe(1);
  });
});
