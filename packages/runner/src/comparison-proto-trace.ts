import { createHash } from 'node:crypto';

/** Pure injected-port protocol diagnostic. No session, filesystem or native adapter. */
export interface ProtoStartParameters {
  categories: string;
  transferMode: 'ReturnAsStream';
  streamFormat: 'proto';
  streamCompression: 'none';
}
export interface ProtoSessionPort {
  onComplete(listener: (reply: unknown) => void): () => void;
  onClosed(listener: () => void): () => void;
  start(parameters: ProtoStartParameters): Promise<void>;
  end(): Promise<void>;
  read(parameters: { handle: string; size: 65536 }): Promise<unknown>;
  closeStream(parameters: { handle: string }): Promise<void>;
}
export interface ProtoLifetimePort {
  active(): boolean;
  onRevoked(listener: () => void): () => void;
  close(): Promise<void>;
}
export interface ProtoClockPort {
  nowMs(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(token: unknown): void;
}
export type ProtoWriteAck =
  | { status: 'complete'; written: number }
  | { status: 'partial'; written: number }
  | { status: 'refused'; written: 0 };
export interface ProtoSinkPort {
  write(bytes: Uint8Array): Promise<ProtoWriteAck>;
  close(): Promise<void>;
}
export interface ProtoTracePorts {
  session: ProtoSessionPort;
  lifetime: ProtoLifetimePort;
  sink: ProtoSinkPort;
  clock: ProtoClockPort;
}
export type ProtoStage = 'new' | 'starting' | 'recording' | 'ending' | 'draining' | 'closing' | 'closed';
export type ProtoOperationState = 'not-dispatched' | 'pending' | 'fulfilled' | 'rejected';
export type ProtoOperationKind = 'start' | 'end' | 'read' | 'write' | 'io-close' | 'sink-close' | 'lifetime-close';
export type ProtoFailureCode =
  | 'unsupported-policy' | 'invalid-sequence' | 'observer-failure' | 'lifetime-revoked' | 'session-closed-early'
  | 'invalid-clock' | 'start-rejected' | 'end-rejected' | 'early-completion' | 'duplicate-completion'
  | 'invalid-completion' | 'loss-reported' | 'read-rejected' | 'invalid-read-reply' | 'invalid-base64'
  | 'chunk-capacity' | 'byte-capacity' | 'read-capacity' | 'empty-progress' | 'sink-rejected' | 'sink-invalid-ack'
  | 'sink-partial-write' | 'sink-refused-write' | 'start-timeout' | 'finish-timeout' | 'io-close-rejected'
  | 'sink-close-rejected' | 'lifetime-close-rejected' | 'cleanup-timeout' | 'listener-cleanup-failed' | 'explicit-close';
export interface ProtoObserverReceipt {
  registrationAttempted: boolean;
  registrationState: 'not-attempted' | 'registered' | 'unknown-after-throw';
  removalAttempted: boolean;
  removalState: 'not-attempted' | 'removed' | 'unknown-after-throw';
}
export interface ProtoTimerReceipt {
  stage: 'start' | 'finish' | 'cleanup';
  registrationAttempted: boolean;
  registrationState: 'not-attempted' | 'registered' | 'unknown-after-throw';
  clearAttempted: boolean;
  disposalState: 'not-attempted' | 'cleared' | 'fired' | 'unknown-after-throw';
}
export interface ProtoTraceReceipt {
  schemaVersion: 1;
  policy: 'pinned-proto-transport-diagnostic-pure-v1' | 'pinned-proto-owned-native-transport-v1';
  profileSha256: string;
  revision: number;
  stage: ProtoStage;
  outcome: 'open' | 'protocol-closed' | 'unavailable' | 'unavailable-pending';
  firstFailure: { code: ProtoFailureCode; stage: ProtoStage; readAttempt?: number } | null;
  secondaryFailureCount: number;
  start: ProtoOperationState;
  end: ProtoOperationState;
  completionCount: 0 | 1 | 2;
  observedFormat: 'not-observed' | 'proto' | 'other' | 'invalid';
  observedCompression: 'not-observed' | 'none' | 'other' | 'invalid';
  observedLoss: 'not-observed' | 'false' | 'true' | 'invalid';
  readAttempts: number;
  readReplies: number;
  consecutiveEmpty: number;
  emptyFlagCounts: { absent: number; false: number; true: number };
  receivedEof: boolean;
  acceptedEof: boolean;
  validatedReceivedBytes: number;
  acceptedWriteBytes: number;
  acknowledgedWrittenBytes: number;
  acknowledgedPrefixSha256: string;
  persistedExtent: 'known-acknowledged-prefix' | 'unknown-after-write-failure';
  ioClose: ProtoOperationState;
  sinkClose: ProtoOperationState;
  lifetimeClose: ProtoOperationState;
  sessionCloseObserved: boolean;
  revocationObserved: boolean;
  pending: { kind: ProtoOperationKind; ordinal: number }[];
  observers: { sessionClose: ProtoObserverReceipt; revocation: ProtoObserverReceipt; completion: ProtoObserverReceipt };
  listenerCleanup: 'not-started' | 'pending' | 'complete' | 'unknown';
  clockDomain: 'injected-host-monotonic-ms';
  clockState: 'valid' | 'invalid';
  timers: ProtoTimerReceipt[];
  stageTimes: { stage: 'start' | 'finish' | 'cleanup'; startedAtMs: number | null; deadlineAtMs: number | null }[];
  sinkCloseQueued: boolean;
  originalOperationsSettled: boolean;
  completeClosureObserved: boolean;
  qualification: false;
  transportQualification: false;
  captureQualified: false;
  fpsEligibility: false;
  normalizationCapability: 'supplied-proto-transport-protocol-only';
  captureCompleteness: 'unestablished';
  sourceCoverage: 'unestablished';
  runtimeQualification: 'unestablished';
  targetLifetime: 'unestablished';
  clockAdmission: 'not_evaluated';
  evaluationEligibility: false;
  scoringEligibility: false;
  rankingEligibility: false;
  nativeSupported: false;
  independentAuthority: false;
}
export interface ProtoTraceCollector {
  start(): Promise<ProtoTraceReceipt>;
  finish(): Promise<ProtoTraceReceipt>;
  close(): Promise<ProtoTraceReceipt>;
  snapshot(): ProtoTraceReceipt;
}

// Exact literal selection only: callers cannot mutate a profile or supply limits.
const DIAGNOSTIC_PROFILE = Object.freeze({policy:'pinned-proto-transport-diagnostic-pure-v1' as const, maxBytes:262144,maxReads:64,maxOperations:133,startMs:10000,finishMs:10000,cleanupMs:1000});
const OWNED_PROFILE = Object.freeze({policy:'pinned-proto-owned-native-transport-v1' as const,maxBytes:33554432,maxReads:4096,maxOperations:8197,startMs:10000,finishMs:20000,cleanupMs:10000});
const OWNED_PROFILE_SHA256 = createHash('sha256').update(JSON.stringify(OWNED_PROFILE)).digest('hex');

export function createProtoTraceCollector(ports: ProtoTracePorts, policy: unknown): ProtoTraceCollector {
  const profile = policy === OWNED_PROFILE.policy ? OWNED_PROFILE : DIAGNOSTIC_PROFILE;
  const observer = (): ProtoObserverReceipt => ({ registrationAttempted: false, registrationState: 'not-attempted', removalAttempted: false, removalState: 'not-attempted' });
  const state: ProtoTraceReceipt = {
    schemaVersion: 1, policy: profile.policy,
    profileSha256: profile === OWNED_PROFILE ? OWNED_PROFILE_SHA256 : '725ad10fb8f3280dca9deb933f17c874f320d9ecd5f9b91732f9e3823d07a66d',
    revision: 0, stage: 'new', outcome: 'open', firstFailure: null, secondaryFailureCount: 0,
    start: 'not-dispatched', end: 'not-dispatched', completionCount: 0, observedFormat: 'not-observed', observedCompression: 'not-observed', observedLoss: 'not-observed',
    readAttempts: 0, readReplies: 0, consecutiveEmpty: 0, emptyFlagCounts: { absent: 0, false: 0, true: 0 }, receivedEof: false, acceptedEof: false,
    validatedReceivedBytes: 0, acceptedWriteBytes: 0, acknowledgedWrittenBytes: 0,
    acknowledgedPrefixSha256: createHash('sha256').update(new Uint8Array()).digest('hex'), persistedExtent: 'known-acknowledged-prefix',
    ioClose: 'not-dispatched', sinkClose: 'not-dispatched', lifetimeClose: 'not-dispatched', sessionCloseObserved: false, revocationObserved: false, pending: [],
    observers: { sessionClose: observer(), revocation: observer(), completion: observer() }, listenerCleanup: 'not-started',
    clockDomain: 'injected-host-monotonic-ms', clockState: 'valid', timers: [], stageTimes: [], sinkCloseQueued: false, originalOperationsSettled: true, completeClosureObserved: false,
    qualification: false, transportQualification: false, captureQualified: false, fpsEligibility: false,
    normalizationCapability: 'supplied-proto-transport-protocol-only', captureCompleteness: 'unestablished', sourceCoverage: 'unestablished', runtimeQualification: 'unestablished', targetLifetime: 'unestablished', clockAdmission: 'not_evaluated',
    evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, nativeSupported: false, independentAuthority: false,
  };
  const prefix = createHash('sha256');
  type Operation = { kind: ProtoOperationKind; ordinal: number };
  type Method = { promise: Promise<ProtoTraceReceipt>; resolve(value: ProtoTraceReceipt): void; done: boolean };
  type Timer = { facts: ProtoTimerReceipt; token: unknown; returned: boolean; fired: boolean };
  const pending = new Map<number, Operation>();
  const timerRecords = new Map<'start' | 'finish' | 'cleanup', Timer>();
  const removers: Partial<Record<'sessionClose' | 'revocation' | 'completion', () => void>> = {};
  let ordinal = 0, lastNow: number | undefined, handle: string | undefined;
  let startMethod: Method | undefined, finishMethod: Method | undefined, closeMethod: Method | undefined;
  let baseInstalling = false, baseInstalled = false, cleanupRequested = false, cleanupStarted = false;
  let cleanupInitializing = false, drivingCleanup = false, driveAgain = false, cleanupExpired = false;
  let writePending = false, completionAdmitted = false, endDispatched = false, windowClosed = false;
  let normalEof = false;
  function touch() { if (state.revision < Number.MAX_SAFE_INTEGER) state.revision++; }
  function snapshot(): ProtoTraceReceipt {
    return structuredClone({ ...state, pending: [...pending.values()].map(row => ({ ...row })),
      originalOperationsSettled: pending.size === 0, acknowledgedPrefixSha256: prefix.copy().digest('hex') });
  }
  function method(): Method {
    let resolve!: (value: ProtoTraceReceipt) => void;
    const promise = new Promise<ProtoTraceReceipt>(done => { resolve = done; });
    return { promise, resolve, done: false };
  }
  function resolveMethod(value: Method | undefined) {
    if (value && !value.done) { value.done = true; value.resolve(snapshot()); }
  }
  function resolveWaiting() { resolveMethod(startMethod); resolveMethod(finishMethod); resolveMethod(closeMethod); }
  function noteFailure(code: ProtoFailureCode) {
    if (!state.firstFailure) state.firstFailure = { code, stage: state.stage, ...(state.readAttempts ? { readAttempt: state.readAttempts } : {}) };
    else state.secondaryFailureCount = Math.min(32, state.secondaryFailureCount + 1);
    state.outcome = 'unavailable'; cleanupRequested = true; touch();
  }
  function fail(code: ProtoFailureCode) {
    noteFailure(code);
    if (!baseInstalling && !cleanupInitializing) requestCleanup();
  }
  function brokenClock() {
    const first = state.clockState !== 'invalid';
    state.clockState = 'invalid';
    if (first) noteFailure('invalid-clock');
    for (const timer of timerRecords.values()) {
      if (timer.facts.disposalState !== 'cleared' && timer.facts.disposalState !== 'fired') timer.facts.disposalState = 'unknown-after-throw';
    }
    if (!baseInstalling && !cleanupInitializing) requestCleanup();
    state.outcome = 'unavailable-pending'; touch();
    if (!baseInstalling && !cleanupInitializing) resolveWaiting();
  }
  function now(): number | undefined {
    if (state.clockState === 'invalid') return undefined;
    let value: unknown;
    try { value = ports.clock.nowMs(); } catch { brokenClock(); return undefined; }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || lastNow !== undefined && value < lastNow) {
      brokenClock(); return undefined;
    }
    lastNow = value; return value;
  }
  function clearStage(stage: 'start' | 'finish' | 'cleanup') {
    const timer = timerRecords.get(stage);
    if (!timer || !timer.returned || timer.facts.clearAttempted || state.clockState === 'invalid') return;
    timer.facts.clearAttempted = true; touch();
    try { ports.clock.clearTimer(timer.token); timer.token = undefined; timer.facts.disposalState = timer.fired ? 'fired' : 'cleared'; }
    catch { timer.token = undefined; timer.facts.disposalState = 'unknown-after-throw'; brokenClock(); }
  }
  function openStage(stage: 'start' | 'finish' | 'cleanup', budget: number): boolean {
    const initial = now();
    if (initial === undefined) return false;
    const deadline = initial + budget;
    if (!Number.isFinite(deadline) || deadline > Number.MAX_SAFE_INTEGER || deadline < initial) { brokenClock(); return false; }
    state.stageTimes.push({ stage, startedAtMs: initial, deadlineAtMs: deadline });
    const facts: ProtoTimerReceipt = { stage, registrationAttempted: true, registrationState: 'not-attempted', clearAttempted: false, disposalState: 'not-attempted' };
    const timer: Timer = { facts, token: undefined, returned: false, fired: false };
    timerRecords.set(stage, timer); state.timers.push(facts); touch();
    let registering = true, synchronousFire = false;
    const expire = () => {
      if (windowClosed || timer.fired) return;
      timer.fired = true;
      if (state.clockState === 'invalid') { touch(); return; }
      facts.disposalState = 'fired'; clearStage(stage);
      if ((state.clockState as ProtoTraceReceipt['clockState']) === 'invalid') return;
      if (stage === 'cleanup') {
        cleanupExpired = true; noteFailure('cleanup-timeout'); driveCleanup();
        state.outcome = 'unavailable-pending'; touch(); if (!baseInstalling && !cleanupInitializing) resolveWaiting();
      } else fail(stage === 'start' ? 'start-timeout' : 'finish-timeout');
    };
    try {
      timer.token = ports.clock.setTimer(() => { if (registering) synchronousFire = true; else expire(); }, budget);
      timer.returned = true; facts.registrationState = 'registered'; registering = false;
      if (synchronousFire) expire();
    } catch {
      registering = false; timer.token = undefined; facts.registrationState = 'unknown-after-throw'; facts.disposalState = 'unknown-after-throw'; brokenClock(); return false;
    }
    return state.clockState === 'valid' && !state.firstFailure;
  }
  function active(stage: 'start' | 'finish'): boolean {
    if (state.firstFailure || cleanupRequested || windowClosed) return false;
    let admitted = false;
    try { admitted = ports.lifetime.active() === true; } catch { fail('lifetime-revoked'); return false; }
    if (!admitted) { state.revocationObserved = true; fail('lifetime-revoked'); return false; }
    const at = now(); if (at === undefined) return false;
    const timing = state.stageTimes.find(row => row.stage === stage);
    if (!timing || timing.deadlineAtMs === null || at >= timing.deadlineAtMs) { fail(stage === 'start' ? 'start-timeout' : 'finish-timeout'); return false; }
    return true;
  }
  function tracked<T>(kind: ProtoOperationKind, invoke: () => Promise<T>, fulfilled: (value: T) => void, rejected: () => void) {
    if (ordinal >= profile.maxOperations) { fail('invalid-sequence'); return; }
    const op = { kind, ordinal: ++ordinal }; pending.set(op.ordinal, op); touch();
    const settle = (ok: boolean, value?: T) => {
      pending.delete(op.ordinal); touch();
      try { if (ok) fulfilled(value as T); else rejected(); }
      catch { rejected(); }
      if (cleanupRequested) driveCleanup();
      // Deliberately void: no original promise/value is stored in settled metadata.
    };
    try { void Promise.resolve(invoke()).then(value => { settle(true, value); }, () => { settle(false); }); }
    catch { settle(false); }
  }
  function register(key: 'sessionClose' | 'revocation' | 'completion', install: () => () => void) {
    const facts = state.observers[key]; if (facts.registrationAttempted) return;
    facts.registrationAttempted = true; touch();
    try {
      const remove = install();
      if (typeof remove !== 'function') { facts.registrationState = 'unknown-after-throw'; fail('observer-failure'); return; }
      removers[key] = remove; facts.registrationState = 'registered';
    } catch { facts.registrationState = 'unknown-after-throw'; fail('observer-failure'); }
  }
  function ensureBaseObservers() {
    if (baseInstalled || baseInstalling) return;
    baseInstalling = true;
    register('sessionClose', () => ports.session.onClosed(() => {
      if (windowClosed) return;
      state.sessionCloseObserved = true; touch();
      if (!cleanupRequested) fail('session-closed-early'); else driveCleanup();
    }));
    register('revocation', () => ports.lifetime.onRevoked(() => {
      if (windowClosed) return;
      state.revocationObserved = true; touch();
      if (!cleanupRequested) fail('lifetime-revoked'); else driveCleanup();
    }));
    baseInstalling = false; baseInstalled = true;
  }
  function removeListeners() {
    let unknown = false;
    for (const key of ['sessionClose', 'revocation', 'completion'] as const) {
      const facts = state.observers[key];
      if (facts.registrationState === 'unknown-after-throw') unknown = true;
      const remove = removers[key];
      if (!remove || facts.removalAttempted) { if (facts.removalState === 'unknown-after-throw') unknown = true; continue; }
      facts.removalAttempted = true; delete removers[key]; touch();
      try { remove(); facts.removalState = 'removed'; }
      catch { facts.removalState = 'unknown-after-throw'; unknown = true; noteFailure('listener-cleanup-failed'); }
    }
    state.listenerCleanup = unknown ? 'unknown' : 'complete';
  }
  function ioClose() {
    if (!handle || state.ioClose !== 'not-dispatched') return;
    state.ioClose = 'pending';
    tracked('io-close', () => ports.session.closeStream({ handle: handle! }), () => { state.ioClose = 'fulfilled'; }, () => { state.ioClose = 'rejected'; fail('io-close-rejected'); });
  }
  function sinkClose() {
    if (state.sinkClose !== 'not-dispatched') return;
    if (writePending) { state.sinkCloseQueued = true; return; }
    state.sinkCloseQueued = false; state.sinkClose = 'pending';
    tracked('sink-close', () => ports.sink.close(), () => { state.sinkClose = 'fulfilled'; }, () => { state.sinkClose = 'rejected'; fail('sink-close-rejected'); });
  }
  function lifetimeClose() {
    if (state.lifetimeClose !== 'not-dispatched') return;
    state.lifetimeClose = 'pending';
    tracked('lifetime-close', () => ports.lifetime.close(), () => { state.lifetimeClose = 'fulfilled'; }, () => { state.lifetimeClose = 'rejected'; fail('lifetime-close-rejected'); });
  }
  function isSettled(value: ProtoOperationState) { return value === 'fulfilled' || value === 'rejected'; }
  function driveCleanup() {
    if (!cleanupStarted || baseInstalling || cleanupInitializing || windowClosed) return;
    if (drivingCleanup) { driveAgain = true; return; }
    drivingCleanup = true;
    try {
      do {
        driveAgain = false; ioClose(); sinkClose();
        const ioSettled = !handle || isSettled(state.ioClose);
        if (state.firstFailure || state.clockState === 'invalid' || cleanupExpired || ioSettled && isSettled(state.sinkClose)) lifetimeClose();
        const operationsDone = pending.size === 0 && !writePending && isSettled(state.sinkClose) && isSettled(state.lifetimeClose) && ioSettled;
        if (operationsDone && state.sessionCloseObserved) {
          clearStage('start'); clearStage('finish'); clearStage('cleanup'); removeListeners();
          const timersKnown = state.timers.every(t => t.disposalState === 'cleared' || t.disposalState === 'fired');
          state.completeClosureObserved = state.listenerCleanup === 'complete' && timersKnown;
          const success = !state.firstFailure && !state.revocationObserved && state.clockState === 'valid' && normalEof && completionAdmitted && state.start === 'fulfilled' && state.end === 'fulfilled' && state.acceptedEof && state.acceptedWriteBytes === state.acknowledgedWrittenBytes && state.persistedExtent === 'known-acknowledged-prefix' && state.ioClose === 'fulfilled' && state.sinkClose === 'fulfilled' && state.lifetimeClose === 'fulfilled' && state.completeClosureObserved;
          state.stage = 'closed'; state.outcome = success ? 'protocol-closed' : 'unavailable'; touch();
          windowClosed = state.listenerCleanup === 'complete'; resolveWaiting();
        } else if (state.clockState === 'invalid' || cleanupExpired || operationsDone && state.observers.sessionClose.registrationState === 'unknown-after-throw') {
          state.outcome = 'unavailable-pending'; touch(); resolveWaiting();
        }
      } while (driveAgain && !windowClosed);
    } finally { drivingCleanup = false; }
  }
  function requestCleanup() {
    cleanupRequested = true;
    if (baseInstalling || cleanupInitializing) return;
    ensureBaseObservers();
    if (!cleanupStarted) {
      cleanupStarted = true; cleanupInitializing = true; state.stage = 'closing'; touch();
      if (state.clockState === 'valid') openStage('cleanup', profile.cleanupMs);
      cleanupInitializing = false;
    }
    driveCleanup();
    if (state.clockState === 'invalid') { state.outcome = 'unavailable-pending'; resolveWaiting(); }
  }
  function own(value: unknown, key: string): { present: boolean; value: unknown } {
    if (typeof value !== 'object' || value === null) throw 0;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return { present: false, value: undefined };
    if (!('value' in descriptor)) throw 0;
    return { present: true, value: descriptor.value };
  }
  function onComplete(reply: unknown) {
    if (windowClosed) return;
    state.completionCount = Math.min(2, state.completionCount + 1) as 1 | 2; touch();
    if (state.completionCount === 2) { fail('duplicate-completion'); return; }
    if (state.firstFailure) return;
    if (state.start !== 'fulfilled' || !endDispatched) { fail('early-completion'); return; }
    try {
      const stream = own(reply, 'stream');
      if (stream.present && typeof stream.value === 'string' && /^[\x20-\x7e]{1,256}$/.test(stream.value)) handle = stream.value;
      const format = own(reply, 'traceFormat'), compression = own(reply, 'streamCompression'), loss = own(reply, 'dataLossOccurred');
      state.observedFormat = !format.present ? 'not-observed' : format.value === 'proto' ? 'proto' : typeof format.value === 'string' ? 'other' : 'invalid';
      state.observedCompression = !compression.present ? 'not-observed' : compression.value === 'none' ? 'none' : typeof compression.value === 'string' ? 'other' : 'invalid';
      state.observedLoss = !loss.present ? 'not-observed' : loss.value === false ? 'false' : loss.value === true ? 'true' : 'invalid';
      reply = undefined;
      if (!handle || format.value !== 'proto' || compression.value !== 'none' || loss.value !== false) { fail(loss.value === true ? 'loss-reported' : 'invalid-completion'); return; }
      completionAdmitted = true; touch(); maybeRead();
    } catch { reply = undefined; fail('invalid-completion'); }
  }
  function alphabet(code: number): number {
    if (code >= 65 && code <= 90) return code - 65;
    if (code >= 97 && code <= 122) return code - 71;
    if (code >= 48 && code <= 57) return code + 4;
    return code === 43 ? 62 : code === 47 ? 63 : -1;
  }
  function decodedLength(data: string): number | ProtoFailureCode {
    if (data.length > 87384) return 'chunk-capacity';
    if (data.length % 4 !== 0) return 'invalid-base64';
    if (!data.length) return 0;
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    for (let i = 0; i < data.length - padding; i++) if (alphabet(data.charCodeAt(i)) < 0) return 'invalid-base64';
    if (padding === 2 && (alphabet(data.charCodeAt(data.length - 3)) & 15) !== 0 || padding === 1 && (alphabet(data.charCodeAt(data.length - 2)) & 3) !== 0) return 'invalid-base64';
    const length = data.length / 4 * 3 - padding;
    return length > 65536 ? 'chunk-capacity' : length;
  }
  function decode(data: string, length: number): Uint8Array {
    const bytes = new Uint8Array(length); let offset = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = alphabet(data.charCodeAt(i)), b = alphabet(data.charCodeAt(i + 1)), c = alphabet(data.charCodeAt(i + 2)), d = alphabet(data.charCodeAt(i + 3));
      if (offset < length) bytes[offset++] = (a << 2) | (b >> 4);
      if (offset < length) bytes[offset++] = (b << 4) | (c >> 2);
      if (offset < length) bytes[offset++] = (c << 6) | d;
    }
    return bytes;
  }
  function finishAcquisition() {
    state.acceptedEof = true; normalEof = true; touch(); clearStage('finish');
    if (state.firstFailure) return;
    requestCleanup();
  }
  function writeChunk(original: Uint8Array, eof: boolean) {
    if (!active('finish')) return;
    let retained: Uint8Array | undefined = original;
    state.acceptedWriteBytes += original.length; writePending = true; touch();
    tracked('write', () => ports.sink.write(original.slice()), (reply: unknown) => {
      const bytes = retained!; let amount: number | undefined, status: unknown;
      try {
        const s = own(reply, 'status'), written = own(reply, 'written');
        status = s.value;
        if (s.present && written.present && typeof written.value === 'number' && Number.isInteger(written.value) &&
          (status === 'complete' && written.value === bytes.length || status === 'partial' && written.value >= 0 && written.value < bytes.length || status === 'refused' && written.value === 0)) amount = written.value;
      } catch { /* Only the operation context selects a fixed error code. */ }
      reply = undefined;
      writePending = false;
      if (amount === undefined) { retained = undefined; state.persistedExtent = 'unknown-after-write-failure'; fail('sink-invalid-ack'); return; }
      if (amount) { prefix.update(bytes.subarray(0, amount)); state.acknowledgedWrittenBytes += amount; }
      retained = undefined; touch();
      if (status !== 'complete') { fail(status === 'partial' ? 'sink-partial-write' : 'sink-refused-write'); return; }
      if (!active('finish')) { if (cleanupRequested) driveCleanup(); return; }
      if (eof) finishAcquisition(); else readNext();
    }, () => { retained = undefined; writePending = false; state.persistedExtent = 'unknown-after-write-failure'; fail('sink-rejected'); });
  }
  function readReply(reply: unknown) {
    state.readReplies++; touch();
    if (!active('finish')) { reply = undefined; return; }
    let data = '', eof = false, encoded: boolean | undefined;
    try {
      const d = own(reply, 'data'), e = own(reply, 'eof'), flag = own(reply, 'base64Encoded');
      if (!d.present || typeof d.value !== 'string' || !e.present || typeof e.value !== 'boolean' || flag.present && typeof flag.value !== 'boolean') throw 0;
      data = d.value; eof = e.value; encoded = flag.present ? flag.value as boolean : undefined;
    } catch { reply = undefined; fail('invalid-read-reply'); return; }
    reply = undefined;
    if (data.length && encoded !== true) { data = ''; fail('invalid-read-reply'); return; }
    const length = decodedLength(data);
    if (typeof length !== 'number') { data = ''; fail(length); return; }
    state.validatedReceivedBytes += length; if (eof) state.receivedEof = true;
    if (!length) {
      state.emptyFlagCounts[encoded === undefined ? 'absent' : encoded ? 'true' : 'false']++;
      data = ''; touch();
      if (eof) { finishAcquisition(); return; }
      if (++state.consecutiveEmpty >= 8) { fail('empty-progress'); return; }
      readNext(); return;
    }
    if (length > profile.maxBytes - state.acceptedWriteBytes) { data = ''; fail('byte-capacity'); return; }
    state.consecutiveEmpty = 0;
    const bytes = decode(data, length); data = '';
    // Raw envelope/string are no longer referenced before an asynchronous sink ack.
    writeChunk(bytes, eof);
  }
  function readNext() {
    if (!active('finish') || state.receivedEof) return;
    if (state.readAttempts >= profile.maxReads) { fail('read-capacity'); return; }
    state.readAttempts++; touch();
    tracked('read', () => ports.session.read({ handle: handle!, size: 65536 }), reply => { readReply(reply); }, () => { fail('read-rejected'); });
  }
  function maybeRead() {
    if (completionAdmitted && state.end === 'fulfilled' && !cleanupRequested && state.stage === 'ending') {
      state.stage = 'draining'; touch(); readNext();
    }
  }
  if (policy !== DIAGNOSTIC_PROFILE.policy && policy !== OWNED_PROFILE.policy) {
    state.stage = 'closed'; state.outcome = 'unavailable'; state.firstFailure = { code: 'unsupported-policy', stage: 'new' };
    const result = Promise.resolve(snapshot());
    return { start: () => result, finish: () => result, close: () => result, snapshot };
  }
  return {
    start() {
      if (startMethod) return startMethod.promise;
      startMethod = method();
      if (cleanupRequested || windowClosed) { noteFailure('invalid-sequence'); requestCleanup(); resolveMethod(startMethod); return startMethod.promise; }
      ensureBaseObservers();
      if (state.firstFailure) { requestCleanup(); return startMethod.promise; }
      register('completion', () => ports.session.onComplete(onComplete));
      if (state.firstFailure) { requestCleanup(); return startMethod.promise; }
      state.stage = 'starting'; touch();
      if (!openStage('start', profile.startMs) || !active('start')) { requestCleanup(); return startMethod.promise; }
      state.start = 'pending';
      tracked('start', () => ports.session.start({ categories: 'blink.user_timing,cc,viz,benchmark,graphics.pipeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame', transferMode: 'ReturnAsStream', streamFormat: 'proto', streamCompression: 'none' }), () => {
        state.start = 'fulfilled'; touch();
        if (!active('start')) return;
        clearStage('start'); if (state.firstFailure) return;
        state.stage = 'recording'; touch(); resolveMethod(startMethod);
      }, () => { state.start = 'rejected'; fail('start-rejected'); });
      return startMethod.promise;
    },
    finish() {
      if (finishMethod) return finishMethod.promise;
      finishMethod = method();
      if (state.start !== 'fulfilled' || state.stage !== 'recording' || cleanupRequested) { fail('invalid-sequence'); return finishMethod.promise; }
      state.stage = 'ending'; touch();
      if (!openStage('finish', profile.finishMs) || !active('finish')) { requestCleanup(); return finishMethod.promise; }
      state.end = 'pending'; endDispatched = true;
      tracked('end', () => ports.session.end(), () => { state.end = 'fulfilled'; touch(); if (active('finish')) maybeRead(); }, () => { state.end = 'rejected'; fail('end-rejected'); });
      return finishMethod.promise;
    },
    close() {
      if (closeMethod) return closeMethod.promise;
      closeMethod = method();
      if (windowClosed || state.outcome === 'protocol-closed') { resolveMethod(closeMethod); return closeMethod.promise; }
      if (!cleanupRequested) noteFailure('explicit-close');
      requestCleanup(); return closeMethod.promise;
    },
    snapshot,
  };
}
