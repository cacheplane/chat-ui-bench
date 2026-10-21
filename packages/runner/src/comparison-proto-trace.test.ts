import { expect, it } from 'vitest';
import { createProtoTraceCollector, type ProtoTraceCollector, type ProtoTracePorts, type ProtoTraceReceipt, type ProtoWriteAck } from './comparison-proto-trace.js';

// Authored protocol controls only. No filesystem, browser, capture or config imports.
const POLICY = 'pinned-proto-transport-diagnostic-pure-v1';
const OWNED_POLICY = 'pinned-proto-owned-native-transport-v1';
const PROFILE = '725ad10fb8f3280dca9deb933f17c874f320d9ecd5f9b91732f9e3823d07a66d';
const CATEGORIES = 'blink.user_timing,cc,viz,benchmark,graphics.pipeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame';
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const THREE_HASH = '8b167730eca499532adf3dd1b625fe250fe27b835da8c3b5889815dce993a5a4';
const ZERO_HASH = '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d';
const WHOLE_ZERO_HASH = '8a39d2abd3999ab73c34db2476849cddf303ce389b35826850f9a700589b4a90';
const GOOD = { stream: 'owned-stream', traceFormat: 'proto', streamCompression: 'none', dataLossOccurred: false };
const EOF = { data: '', eof: true };
const CHUNK = { data: 'AP8E', base64Encoded: true, eof: true };
const ZERO_CHUNK = 'AAAA'.repeat(21845) + 'AA=='; // independently: 65536 zero bytes

type Deferred<T> = { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void; release(): void };
function deferred<T>(fallback: T): Deferred<T> {
  let fulfill!: (value: T) => void, reject!: (error: unknown) => void, settled = false;
  const promise = new Promise<T>((a, b) => { fulfill = a; reject = b; });
  return {
    promise,
    resolve(value) { if (!settled) { settled = true; fulfill(value); } },
    reject(error) { if (!settled) { settled = true; reject(error); } },
    release() { if (!settled) { settled = true; fulfill(fallback); } },
  };
}
async function turns(count = 32) { for (let n = 0; n < count; n++) await Promise.resolve(); }
function observe<T>(promise: Promise<T>) {
  const observed: { state: 'pending' | 'fulfilled' | 'rejected'; value?: T; error?: unknown } = { state: 'pending' };
  void promise.then(value => { observed.state = 'fulfilled'; observed.value = value; }, error => { observed.state = 'rejected'; observed.error = error; });
  return observed;
}
async function valueOf<T>(promise: Promise<T>): Promise<T> {
  const observed = observe(promise);
  for (let n = 0; n < 2048 && observed.state === 'pending'; n++) await Promise.resolve();
  expect(observed.state, 'authored promises must settle without a real timer').toBe('fulfilled');
  if (observed.state !== 'fulfilled') throw new Error('Controlled method did not fulfill');
  return observed.value as T;
}
function hostileThrown() {
  return new Proxy({}, { get() { throw new Error('exception property inspected'); }, getPrototypeOf() { throw new Error('exception prototype inspected'); } });
}
class ManualClock {
  now = 0; next = 0; nowCalls = 0; timerAttempts = 0; clearAttempts = 0;
  invalidNow: unknown; nowThrows = false; timerThrows: 'before' | 'after' | null = null; clearThrows: 'before' | 'after' | null = null;
  failAtTimerAttempt: number | null = null; failAtClearAttempt: number | null = null;
  readonly timers = new Map<number, { due: number; callback: () => void }>();
  readonly installed: (() => void)[] = [];
  readonly port = {
    nowMs: (): number => { this.nowCalls++; if (this.nowThrows) throw hostileThrown(); return (this.invalidNow === undefined ? this.now : this.invalidNow) as number; },
    setTimer: (callback: () => void, delayMs: number): unknown => {
      this.timerAttempts++;
      const fail = this.failAtTimerAttempt === null || this.timerAttempts === this.failAtTimerAttempt;
      if (fail && this.timerThrows === 'before') throw hostileThrown();
      const token = ++this.next; this.installed.push(callback); this.timers.set(token, { due: this.now + delayMs, callback });
      if (fail && this.timerThrows === 'after') throw hostileThrown();
      return token;
    },
    clearTimer: (token: unknown): void => {
      this.clearAttempts++;
      const fail = this.failAtClearAttempt === null || this.clearAttempts === this.failAtClearAttempt;
      if (fail && this.clearThrows === 'before') throw hostileThrown();
      this.timers.delete(token as number);
      if (fail && this.clearThrows === 'after') throw hostileThrown();
    },
  };
  advance(ms: number) {
    const target = this.now + ms;
    for (let n = 0; n < 16; n++) {
      const due = [...this.timers].filter(([, v]) => v.due <= target).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!due) { this.now = target; return; }
      this.now = due[1].due; this.timers.delete(due[0]); due[1].callback();
    }
    throw new Error('Authored clock exceeded finite callback allowance');
  }
}
type Hooks = {
  retainBytes?: boolean;
  completion?: unknown; replies?: unknown[];
  start?: () => Promise<void>; end?: () => Promise<void>; read?: () => Promise<unknown>;
  write?: (bytes: Uint8Array) => Promise<ProtoWriteAck>;
  ioClose?: () => Promise<void>; sinkClose?: () => Promise<void>; lifetimeClose?: () => Promise<void>;
  registerFailure?: 'session' | 'revocation' | 'completion'; installThenThrow?: boolean;
  unsubscribeFailure?: boolean; autoSessionClose?: boolean;
};
function harness(hooks: Hooks, policy: unknown) {
  const journal: { kind: string; value?: unknown }[] = [], clock = new ManualClock();
  let complete: ((reply: unknown) => void) | undefined, closed: (() => void) | undefined, revoked: (() => void) | undefined, active = true;
  const holds: Deferred<unknown>[] = [], received: number[][] = [];
  const record = (kind: string, value?: unknown) => { journal.push({ kind, ...(value === undefined ? {} : { value }) }); };
  const register = (kind: 'session' | 'revocation' | 'completion', install: () => void, remove: () => void) => {
    record('on:' + kind);
    if (hooks.registerFailure === kind && !hooks.installThenThrow) throw hostileThrown();
    install();
    if (hooks.registerFailure === kind) throw hostileThrown();
    return () => { record('off:' + kind); if (hooks.unsubscribeFailure) throw hostileThrown(); remove(); };
  };
  const ports: ProtoTracePorts = {
    clock: clock.port,
    session: {
      onComplete(listener) { return register('completion', () => { complete = listener; }, () => { complete = undefined; }); },
      onClosed(listener) { return register('session', () => { closed = listener; }, () => { closed = undefined; }); },
      start(parameters) { record('start', parameters); return hooks.start?.() ?? Promise.resolve(); },
      end() { record('end'); if (!hooks.end) complete?.(hooks.completion === undefined ? GOOD : hooks.completion); return hooks.end?.() ?? Promise.resolve(); },
      read(parameters) { record('read', parameters); return hooks.read?.() ?? Promise.resolve(hooks.replies?.shift() ?? EOF); },
      closeStream(parameters) { record('io-close', parameters); return hooks.ioClose?.() ?? Promise.resolve(); },
    },
    lifetime: {
      active() { record('active'); return active; },
      onRevoked(listener) { return register('revocation', () => { revoked = listener; }, () => { revoked = undefined; }); },
      close() { record('lifetime-close'); if (hooks.autoSessionClose !== false) closed?.(); return hooks.lifetimeClose?.() ?? Promise.resolve(); },
    },
    sink: {
      write(bytes) { record('write'); if(hooks.retainBytes!==false) received.push(Array.from(bytes)); return hooks.write?.(bytes) ?? Promise.resolve({ status: 'complete', written: bytes.length }); },
      close() { record('sink-close'); return hooks.sinkClose?.() ?? Promise.resolve(); },
    },
  };
  const collector = createProtoTraceCollector(ports, policy);
  const count = (kind: string) => journal.filter(row => row.kind === kind).length;
  return {
    collector, ports, hooks, clock, journal, received, count,
    emitComplete(reply: unknown = GOOD) { complete?.(reply); }, emitClosed() { closed?.(); },
    revoke() { active = false; revoked?.(); },
    hold<T>(fallback: T) { const held = deferred(fallback); holds.push(held as Deferred<unknown>); return held; },
    async disposeAuthored() {
      for (const hold of holds) hold.release();
      const close = collector.close(); void close.catch(() => {});
      await turns(64);
      for (const hold of holds) hold.release();
      clock.advance(30000); await turns(64);
      // Fixture cleanup is not evidence of collector/native disposal.
      clock.timers.clear();
    },
  };
}
type Harness = ReturnType<typeof harness>;
async function fixture(body: (h: Harness) => Promise<void>, hooks: Hooks = {}, policy?: unknown) {
  const h = harness(hooks, arguments.length >= 3 ? policy : POLICY);
  try { await body(h); } finally { await h.disposeAuthored(); }
}
async function start(h: Harness) { const r = await valueOf(h.collector.start()); expect(r.stage).toBe('recording'); expect(h.count('start')).toBe(1); return r; }
function falseAuthority(r: ProtoTraceReceipt) {
  expect(r).toMatchObject({ qualification: false, transportQualification: false, captureQualified: false, fpsEligibility: false,
    independentAuthority: false, evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false, nativeSupported: false,
    normalizationCapability: 'supplied-proto-transport-protocol-only', captureCompleteness: 'unestablished', sourceCoverage: 'unestablished',
    runtimeQualification: 'unestablished', targetLifetime: 'unestablished', clockAdmission: 'not_evaluated', clockDomain: 'injected-host-monotonic-ms' });
}
function failure(r: ProtoTraceReceipt, code: string) { expect(r.firstFailure?.code).toBe(code); expect(r.outcome).not.toBe('protocol-closed'); falseAuthority(r); }
function finiteReceipt(r: ProtoTraceReceipt) {
  expect(r.readAttempts).toBeLessThanOrEqual(64); expect(r.readReplies).toBeLessThanOrEqual(64); expect(r.pending.length).toBeLessThanOrEqual(4);
  expect(r.acceptedWriteBytes).toBeLessThanOrEqual(262144); expect(r.validatedReceivedBytes).toBeLessThanOrEqual(327680);
  expect(r.secondaryFailureCount).toBeLessThanOrEqual(32); expect(r.timers.length).toBeLessThanOrEqual(3);
  expect(r.pending.every(p => Number.isInteger(p.ordinal) && p.ordinal >= 1 && p.ordinal <= 133)).toBe(true);
  falseAuthority(r);
}

it('pins the exact four-member proto profile and observes before one start dispatch', async () => fixture(async h => {
  const r = await start(h);
  expect(h.journal.find(row => row.kind === 'start')?.value).toEqual({ categories: CATEGORIES, transferMode: 'ReturnAsStream', streamFormat: 'proto', streamCompression: 'none' });
  expect(h.journal.filter(row => row.kind.startsWith('on:')).map(row => row.kind)).toEqual(['on:session', 'on:revocation', 'on:completion']);
  expect(h.journal.findIndex(row => row.kind === 'on:completion')).toBeLessThan(h.journal.findIndex(row => row.kind === 'start'));
  expect(r.profileSha256).toBe(PROFILE); expect(r.policy).toBe(POLICY); falseAuthority(r);
}));
for (const policy of [undefined, null, false, {}, 'proto', new String(POLICY)] as unknown[]) it('invalid policy never accepts ports: ' + (typeof policy), async () => fixture(async h => {
  const r = await valueOf(h.collector.start()); await valueOf(h.collector.finish()); await valueOf(h.collector.close());
  failure(r, 'unsupported-policy'); expect(h.journal).toEqual([]);
}, {}, policy));
it('success hashes independently authored binary bytes while remaining unqualified', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish());
  expect(h.received).toEqual([[0, 255, 4]]); expect(r).toMatchObject({ outcome: 'protocol-closed', acceptedEof: true, receivedEof: true,
    validatedReceivedBytes: 3, acceptedWriteBytes: 3, acknowledgedWrittenBytes: 3, acknowledgedPrefixSha256: THREE_HASH,
    ioClose: 'fulfilled', sinkClose: 'fulfilled', lifetimeClose: 'fulfilled', sessionCloseObserved: true,
    originalOperationsSettled: true, completeClosureObserved: true, listenerCleanup: 'complete', firstFailure: null });
  expect(h.count('io-close')).toBe(1); expect(h.count('sink-close')).toBe(1); expect(h.count('lifetime-close')).toBe(1); finiteReceipt(r);
}, { replies: [CHUNK] }));
it('memoizes original start finish and close method promises without duplicate actions', async () => fixture(async h => {
  const a = h.collector.start(); expect(h.collector.start()).toBe(a); await valueOf(a);
  const b = h.collector.finish(); expect(h.collector.finish()).toBe(b); await valueOf(b);
  const c = h.collector.close(); expect(h.collector.close()).toBe(c); await valueOf(c);
  expect(h.count('start')).toBe(1); expect(h.count('end')).toBe(1); expect(h.count('lifetime-close')).toBe(1);
}));
it('snapshot is owned and never calls ports or changes an earlier receipt', async () => fixture(async h => {
  const early = h.collector.snapshot(), saved = JSON.stringify(early), n = h.journal.length;
  h.collector.snapshot(); expect(h.journal).toHaveLength(n); await start(h); await valueOf(h.collector.finish());
  expect(JSON.stringify(early)).toBe(saved); expect(early.pending).not.toBe(h.collector.snapshot().pending);
}));
it('end fulfillment is required even with a synchronous owned completion', async () => fixture(async h => {
  const end = h.hold<void>(undefined); h.hooks.end = () => { h.emitComplete(); return end.promise; };
  await start(h); const finishing = h.collector.finish(); await turns();
  expect(h.count('end')).toBe(1); expect(h.count('read')).toBe(0); end.resolve();
  expect((await valueOf(finishing)).outcome).toBe('protocol-closed');
}));
for (const op of ['start', 'end'] as const) it('fixed context code for hostile ' + op + ' rejection', async () => fixture(async h => {
  h.hooks[op] = async () => { if (op === 'end') h.emitComplete(); throw hostileThrown(); };
  if (op === 'end') await start(h);
  const r = await valueOf(op === 'start' ? h.collector.start() : h.collector.finish()); failure(r, op + '-rejected');
  expect(h.count('read')).toBe(0); expect(JSON.stringify(r)).not.toContain('exception property');
}));
for (const phase of ['starting', 'recording'] as const) it('early completion during ' + phase + ' never adopts its handle', async () => fixture(async h => {
  if (phase === 'starting') h.hooks.start = async () => { h.emitComplete({ ...GOOD, stream: 'unowned-early' }); };
  const first = await valueOf(h.collector.start());
  if (phase === 'recording') { expect(first.stage).toBe('recording'); h.emitComplete({ ...GOOD, stream: 'unowned-early' }); }
  const r = await valueOf(h.collector.close()); failure(r, 'early-completion'); expect(h.count('io-close')).toBe(0); expect(h.count('read')).toBe(0);
}));
const invalidCompletions: [string, unknown, string, boolean][] = [
  ['missing format', { stream: 's', streamCompression: 'none', dataLossOccurred: false }, 'invalid-completion', true],
  ['json', { ...GOOD, traceFormat: 'json' }, 'invalid-completion', true],
  ['gzip', { ...GOOD, streamCompression: 'gzip' }, 'invalid-completion', true],
  ['missing loss', { stream: 's', traceFormat: 'proto', streamCompression: 'none' }, 'invalid-completion', true],
  ['loss', { ...GOOD, dataLossOccurred: true }, 'loss-reported', true],
  ['wrong loss', { ...GOOD, dataLossOccurred: 'false' }, 'invalid-completion', true],
  ['missing handle', { traceFormat: 'proto', streamCompression: 'none', dataLossOccurred: false }, 'invalid-completion', false],
  ['empty handle', { ...GOOD, stream: '' }, 'invalid-completion', false],
  ['oversize handle', { ...GOOD, stream: 's'.repeat(257) }, 'invalid-completion', false],
  ['nonascii handle', { ...GOOD, stream: 'é' }, 'invalid-completion', false],
];
for (const [name, completion, code, owned] of invalidCompletions) it('completion rejects ' + name + ' with only owned cleanup', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, code); expect(h.count('read')).toBe(0); expect(h.count('io-close')).toBe(owned ? 1 : 0);
}, { completion }));
it('completion descriptors never evaluate a required getter or echo thrown fields', async () => fixture(async h => {
  let gets = 0; h.hooks.completion = Object.defineProperty({ ...GOOD }, 'dataLossOccurred', { get() { gets++; throw hostileThrown(); } });
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'invalid-completion'); expect(gets).toBe(0);
}));
it('duplicate completion saturates its count without closing an unrelated second handle', async () => fixture(async h => {
  const read = h.hold<unknown>(EOF); h.hooks.read = () => read.promise;
  await start(h); const finishing = h.collector.finish(); await turns(); expect(h.count('read')).toBe(1);
  for (let n = 0; n < 40; n++) h.emitComplete({ ...GOOD, stream: 'unrelated-' + n });
  read.resolve(EOF); const r = await valueOf(finishing); failure(r, 'duplicate-completion'); expect(r.completionCount).toBe(2);
  expect(h.journal.filter(row => row.kind === 'io-close').map(row => row.value)).toEqual([{ handle: 'owned-stream' }]); finiteReceipt(r);
}));
for (const kind of ['session', 'revocation'] as const) it(kind + ' loss during acquisition forbids further reads', async () => fixture(async h => {
  await start(h); if (kind === 'session') h.emitClosed(); else h.revoke();
  const r = await valueOf(h.collector.close()); failure(r, kind === 'session' ? 'session-closed-early' : 'lifetime-revoked'); expect(h.count('end')).toBe(0); expect(h.count('read')).toBe(0);
}));

const invalidReplies: [string, unknown][] = [
  ['missing data', { eof: true }], ['nonstring data', { data: 0, eof: true }], ['missing eof', { data: '' }],
  ['nonboolean eof', { data: '', eof: 1 }], ['nonboolean flag', { data: '', eof: true, base64Encoded: 0 }],
  ['nonempty absent flag', { data: 'AAAA', eof: true }], ['nonempty false flag', { data: 'AAAA', eof: true, base64Encoded: false }],
  ['inherited fields', Object.create({ data: '', eof: true })],
];
for (const [name, reply] of invalidReplies) it('read shape rejects ' + name, async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'invalid-read-reply'); expect(h.count('write')).toBe(0);
}, { replies: [reply] }));
for (const data of ['A', 'AAA', 'AA A', 'AA-A', 'AA_A', '=AAA', 'A===', 'AA==AAAA', 'AAAA=', 'AB==', 'AAB=']) it('base64 rejects canonicality violation ' + data, async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'invalid-base64'); expect(r.validatedReceivedBytes).toBe(0); expect(h.count('write')).toBe(0);
}, { replies: [{ data, eof: true, base64Encoded: true }] }));
for (const [data, expected] of [['AA==', [0]], ['AQ==', [1]], ['AAA=', [0, 0]], ['AAAA', [0, 0, 0]]] as const) it('canonical tail produces literal bytes ' + data, async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(h.received).toEqual([expected]); expect(r.outcome).toBe('protocol-closed'); expect(r.acknowledgedWrittenBytes).toBe(expected.length);
}, { replies: [{ data, eof: true, base64Encoded: true }] }));
it('exact87384 characters decode65536 and the same-size65537 encoding refuses', async () => {
  await fixture(async h => { await start(h); const r = await valueOf(h.collector.finish()); expect(h.received[0]).toHaveLength(65536); expect(r.acknowledgedWrittenBytes).toBe(65536); }, { replies: [{ data: ZERO_CHUNK, eof: true, base64Encoded: true }] });
  await fixture(async h => { await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'chunk-capacity'); expect(h.count('write')).toBe(0); }, { replies: [{ data: 'AAAA'.repeat(21845) + 'AAA=', eof: true, base64Encoded: true }] });
});
it('encoded response larger than87384 refuses before sink dispatch', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.firstFailure).not.toBeNull(); expect(h.count('write')).toBe(0); expect(r.validatedReceivedBytes).toBe(0);
}, { replies: [{ data: 'AAAA'.repeat(21847), eof: true, base64Encoded: true }] }));
for (const flag of ['absent', false, true] as const) it('empty EOF preserves its ' + flag + ' encoding observation', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.outcome).toBe('protocol-closed'); expect(r.emptyFlagCounts[String(flag) as 'absent' | 'false' | 'true']).toBe(1);
  expect(r.acknowledgedWrittenBytes).toBe(0); expect(r.acknowledgedPrefixSha256).toBe(EMPTY_HASH); expect(h.count('write')).toBe(0);
}, { replies: [{ data: '', eof: true, ...(flag === 'absent' ? {} : { base64Encoded: flag }) }] }));
it('required read getters and descriptor traps fail with no getter evaluation', async () => {
  let calls = 0;
  for (const reply of [Object.defineProperty({ eof: true }, 'data', { get() { calls++; return ''; } }), new Proxy({}, { getOwnPropertyDescriptor() { throw hostileThrown(); } })]) {
    await fixture(async h => { await start(h); failure(await valueOf(h.collector.finish()), 'invalid-read-reply'); expect(h.count('write')).toBe(0); }, { replies: [reply] });
  }
  expect(calls).toBe(0);
});
it('unknown reply fields are never traversed or retained as receipt authority', async () => fixture(async h => {
  let gets = 0; const extra = { opaque: 'not-a-transport-fact' };
  h.hooks.replies = [Object.defineProperty({ ...CHUNK, extra }, 'unknownGetter', { enumerable: true, get() { gets++; throw hostileThrown(); } })];
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.outcome).toBe('protocol-closed'); expect(gets).toBe(0);
  expect(JSON.stringify(r)).not.toContain('not-a-transport-fact'); expect(JSON.stringify(r)).not.toContain('unknownGetter');
  // Internal retention is additionally a source-review obligation, not a WeakRef/GC claim.
}));
it('read rejection is counted before dispatch and does not inspect its error', async () => fixture(async h => {
  h.hooks.read = async () => { throw hostileThrown(); }; await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'read-rejected'); expect(r.readAttempts).toBe(1); expect(h.count('read')).toBe(1);
}));

for (const eofAt64 of [true, false]) it('read64 ' + (eofAt64 ? 'EOF closes' : 'nonEOF refuses without65'), async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(h.count('read')).toBe(64); expect(r.readAttempts).toBe(64); expect(h.count('write')).toBe(eofAt64 ? 63 : 64);
  if (eofAt64) expect(r.outcome).toBe('protocol-closed'); else failure(r, 'read-capacity'); finiteReceipt(r);
  expect(['start', 'end', 'read', 'write', 'io-close', 'sink-close', 'lifetime-close'].reduce((n, kind) => n + h.count(kind), 0)).toBe(eofAt64 ? 132 : 133);
}, { replies: [...Array.from({ length: 63 }, () => ({ data: 'AA==', base64Encoded: true, eof: false })), eofAt64 ? EOF : { data: 'AA==', base64Encoded: true, eof: false }] }));
it('data on read64 is acknowledged before accepted EOF', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.outcome).toBe('protocol-closed'); expect(r.readAttempts).toBe(64); expect(r.acknowledgedWrittenBytes).toBe(64); expect(h.count('write')).toBe(64);
}, { replies: Array.from({ length: 64 }, (_, n) => ({ data: 'AA==', base64Encoded: true, eof: n === 63 })) }));
for (const eighthEof of [true, false]) it('eighth empty ' + (eighthEof ? 'EOF completes' : 'nonEOF refuses'), async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(h.count('read')).toBe(8); expect(h.count('write')).toBe(0);
  if (eighthEof) expect(r.outcome).toBe('protocol-closed'); else failure(r, 'empty-progress');
}, { replies: Array.from({ length: 8 }, (_, n) => ({ data: '', eof: eighthEof && n === 7 })) }));
it('only an accepted nonempty reply resets seven empty replies', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.outcome).toBe('protocol-closed'); expect(r.readAttempts).toBe(16); expect(r.acknowledgedWrittenBytes).toBe(1);
}, { replies: [...Array.from({ length: 7 }, () => ({ data: '', eof: false })), { data: 'AA==', base64Encoded: true, eof: false }, ...Array.from({ length: 7 }, () => ({ data: '', eof: false })), EOF] }));
for (const tail of ['last-chunk-eof', 'empty-eof', 'excess-eof', 'excess-non-eof'] as const) it('whole262144 boundary with ' + tail, async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); expect(h.count('write')).toBe(4); expect(r.acceptedWriteBytes).toBe(262144); expect(r.acknowledgedWrittenBytes).toBe(262144); expect(r.acknowledgedPrefixSha256).toBe(WHOLE_ZERO_HASH);
  if (tail.startsWith('excess')) { failure(r, 'byte-capacity'); expect(r.validatedReceivedBytes).toBe(262145); expect(r.acceptedEof).toBe(false); expect(r.receivedEof).toBe(tail === 'excess-eof'); }
  else { expect(r.outcome).toBe('protocol-closed'); expect(r.acceptedEof).toBe(true); }
  expect(h.count('read')).toBe(tail === 'last-chunk-eof' ? 4 : 5); finiteReceipt(r);
}, { replies: [...Array.from({ length: 4 }, (_, n) => ({ data: ZERO_CHUNK, base64Encoded: true, eof: tail === 'last-chunk-eof' && n === 3 })), ...(tail === 'last-chunk-eof' ? [] : [tail === 'empty-eof' ? EOF : { data: 'AA==', base64Encoded: true, eof: tail === 'excess-eof' }])] }));
it('partition changes do not change independently known prefix bytes and hash', async () => {
  for (const replies of [[CHUNK], [{ data: 'AA==', base64Encoded: true, eof: false }, { data: '/wQ=', base64Encoded: true, eof: true }]]) {
    await fixture(async h => { await start(h); const r = await valueOf(h.collector.finish()); expect(h.received.flat()).toEqual([0, 255, 4]); expect(r.acknowledgedPrefixSha256).toBe(THREE_HASH); expect(r.acknowledgedWrittenBytes).toBe(3); }, { replies });
  }
});
it('EOF with held write stays unaccepted until complete acknowledgment', async () => fixture(async h => {
  const ack = h.hold<ProtoWriteAck>({ status: 'complete', written: 3 }); h.hooks.write = () => ack.promise;
  await start(h); const finishing = h.collector.finish(); await turns(); expect(h.count('write')).toBe(1);
  const before = h.collector.snapshot(), saved = JSON.stringify(before); expect(before.receivedEof).toBe(true); expect(before.acceptedEof).toBe(false); expect(before.acknowledgedWrittenBytes).toBe(0); expect(h.count('sink-close')).toBe(0);
  ack.release(); const r = await valueOf(finishing); expect(r.outcome).toBe('protocol-closed'); expect(r.acceptedEof).toBe(true); expect(JSON.stringify(before)).toBe(saved);
}, { replies: [CHUNK] }));
for (const [ack, code, written, unknown] of [
  [{ status: 'partial', written: 1 }, 'sink-partial-write', 1, false], [{ status: 'refused', written: 0 }, 'sink-refused-write', 0, false],
  [{ status: 'complete', written: 2 }, 'sink-invalid-ack', 0, true], [{ status: 'partial', written: 3 }, 'sink-invalid-ack', 0, true],
  [{ status: 'complete', written: NaN }, 'sink-invalid-ack', 0, true], [{ status: 'refused', written: 1 }, 'sink-invalid-ack', 0, true],
] as const) it('ack ' + JSON.stringify(ack) + ' retains only the known prefix', async () => fixture(async h => {
  h.hooks.write = async () => ack as ProtoWriteAck; await start(h); const r = await valueOf(h.collector.finish()); failure(r, code);
  expect(r.validatedReceivedBytes).toBe(3); expect(r.acceptedWriteBytes).toBe(3); expect(r.acknowledgedWrittenBytes).toBe(written);
  expect(r.acknowledgedPrefixSha256).toBe(written === 1 ? ZERO_HASH : EMPTY_HASH); expect(r.persistedExtent).toBe(unknown ? 'unknown-after-write-failure' : 'known-acknowledged-prefix'); expect(r.acceptedEof).toBe(false);
}, { replies: [CHUNK] }));
it('rejected write cannot assert that it persisted zero bytes', async () => fixture(async h => {
  h.hooks.write = async () => { throw hostileThrown(); }; await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'sink-rejected'); expect(r.persistedExtent).toBe('unknown-after-write-failure'); expect(r.acknowledgedPrefixSha256).toBe(EMPTY_HASH);
}, { replies: [CHUNK] }));
it('sink mutation of its copy does not mutate the retained hash input', async () => fixture(async h => {
  h.hooks.write = async bytes => { expect(Object.getPrototypeOf(bytes)).toBe(Uint8Array.prototype); bytes.fill(0); return { status: 'complete', written: 3 }; };
  await start(h); const r = await valueOf(h.collector.finish()); expect(r.acknowledgedPrefixSha256).toBe(THREE_HASH); expect(r.outcome).toBe('protocol-closed');
}, { replies: [CHUNK] }));

for (const first of ['close', 'finish'] as const) it('D1 ' + first + ' before start installs base observers before cleanup only', async () => fixture(async h => {
  const action = first === 'close' ? h.collector.close() : h.collector.finish(); const r = await valueOf(action);
  failure(r, first === 'close' ? 'explicit-close' : 'invalid-sequence'); expect(h.count('on:session')).toBe(1); expect(h.count('on:revocation')).toBe(1); expect(h.count('on:completion')).toBe(0);
  const firstClose = h.journal.findIndex(row => row.kind === 'sink-close' || row.kind === 'lifetime-close');
  expect(h.journal.findIndex(row => row.kind === 'on:session')).toBeLessThan(firstClose); expect(h.journal.findIndex(row => row.kind === 'on:revocation')).toBeLessThan(firstClose);
  expect(h.count('start') + h.count('end') + h.count('read') + h.count('write')).toBe(0); expect(r.sessionCloseObserved).toBe(true);
  await valueOf(h.collector.close()); expect(h.count('lifetime-close')).toBe(1);
}));
for (const kind of ['session', 'revocation', 'completion'] as const) for (const after of [false, true]) it('D1 ' + kind + ' subscription ' + (after ? 'install-then-throw' : 'throw') + ' remains bounded', async () => fixture(async h => {
  const r = await valueOf(h.collector.start()); failure(r, 'observer-failure'); expect(h.count('start')).toBe(0);
  expect(h.count('on:' + kind)).toBe(1); expect(h.count('lifetime-close')).toBe(1);
  expect(h.count('on:session')).toBe(1); expect(h.count('on:revocation')).toBe(1);
  const firstCleanup = h.journal.findIndex(row => row.kind === 'sink-close' || row.kind === 'lifetime-close');
  for (const base of ['session', 'revocation']) expect(h.journal.findIndex(row => row.kind === 'on:' + base)).toBeLessThan(firstCleanup);
  const facts = r.observers[kind === 'session' ? 'sessionClose' : kind];
  expect(facts.registrationAttempted).toBe(true); expect(facts.registrationState).toBe('unknown-after-throw');
  expect(facts.removalAttempted).toBe(false); expect(facts.removalState).not.toBe('removed');
  expect(h.count('on:completion')).toBe(kind === 'completion' ? 1 : 0);
  expect(r.listenerCleanup).not.toBe('complete'); expect(r.completeClosureObserved).toBe(false);
}, { registerFailure: kind, installThenThrow: after }));
it('invalid-sequence finish with original start pending never dispatches end', async () => fixture(async h => {
  const held = h.hold<void>(undefined); h.hooks.start = () => held.promise;
  const starting = h.collector.start(); await turns(); expect(h.count('start')).toBe(1);
  const finishing = h.collector.finish(); await turns(); h.clock.advance(1000); const r = await valueOf(finishing);
  failure(r, 'invalid-sequence'); expect(h.count('end')).toBe(0); held.release(); await valueOf(starting);
}));
for (const lane of ['ioClose', 'sinkClose'] as const) it('D2 natural cleanup expiry releases lifetime despite pending ' + lane, async () => fixture(async h => {
  const held = h.hold<void>(undefined); h.hooks[lane] = () => held.promise;
  await start(h); const finishing = h.collector.finish(); await turns(); expect(h.count('io-close')).toBe(1); expect(h.count('sink-close')).toBe(1); expect(h.count('lifetime-close')).toBe(0);
  h.clock.advance(999); await turns(); expect(h.count('lifetime-close')).toBe(0);
  h.clock.advance(1); const r = await valueOf(finishing); failure(r, 'cleanup-timeout'); expect(r.outcome).toBe('unavailable-pending'); expect(h.count('lifetime-close')).toBe(1);
  expect(r.pending.some(p => p.kind === (lane === 'ioClose' ? 'io-close' : 'sink-close'))).toBe(true); const saved = JSON.stringify(r);
  held.release(); await turns(); await valueOf(h.collector.close()); expect(h.count('lifetime-close')).toBe(1); expect(h.collector.snapshot().outcome).not.toBe('protocol-closed'); expect(JSON.stringify(r)).toBe(saved); finiteReceipt(r);
}));
for (const lane of ['ioClose', 'sinkClose', 'lifetimeClose'] as const) it('independent ' + lane + ' rejection preserves other cleanup lanes', async () => fixture(async h => {
  h.hooks[lane] = async () => { throw hostileThrown(); }; await start(h); const r = await valueOf(h.collector.finish());
  failure(r, ({ ioClose: 'io-close-rejected', sinkClose: 'sink-close-rejected', lifetimeClose: 'lifetime-close-rejected' })[lane]);
  expect(h.count('io-close')).toBe(1); expect(h.count('sink-close')).toBe(1); expect(h.count('lifetime-close')).toBe(1);
}));
it('fulfilled close acknowledgments without actual session-close observation stay pending', async () => fixture(async h => {
  await start(h); const finishing = h.collector.finish(); await turns(); h.clock.advance(1000); const r = await valueOf(finishing);
  expect(r.outcome).toBe('unavailable-pending'); expect(r.sessionCloseObserved).toBe(false); expect(r.completeClosureObserved).toBe(false);
  h.emitClosed(); await turns(); expect(h.collector.snapshot().outcome).not.toBe('protocol-closed');
}, { autoSessionClose: false }));
for (const acquisition of ['start', 'end', 'read', 'write'] as const) it('original held ' + acquisition + ' survives deadline without fake cancellation', async () => fixture(async h => {
  const held = h.hold<unknown>(acquisition === 'read' ? EOF : acquisition === 'write' ? { status: 'complete', written: 3 } : undefined);
  if (acquisition === 'start') h.hooks.start = () => held.promise as Promise<void>;
  if (acquisition === 'end') h.hooks.end = () => { h.emitComplete(); return held.promise as Promise<void>; };
  if (acquisition === 'read') h.hooks.read = () => held.promise;
  if (acquisition === 'write') h.hooks.write = () => held.promise as Promise<ProtoWriteAck>;
  const action = acquisition === 'start' ? h.collector.start() : (await start(h), h.collector.finish()); await turns();
  expect(h.count(acquisition)).toBe(1); h.clock.advance(10000); await turns(); h.clock.advance(1000); const r = await valueOf(action);
  failure(r, acquisition === 'start' ? 'start-timeout' : 'finish-timeout'); expect(r.outcome).toBe('unavailable-pending'); expect(r.pending.some(p => p.kind === acquisition)).toBe(true);
  const calls = h.count('read') + h.count('write'), saved = JSON.stringify(r);
  held.release(); await turns(); expect(h.count('read') + h.count('write')).toBe(calls); expect(h.collector.snapshot().outcome).not.toBe('protocol-closed'); expect(JSON.stringify(r)).toBe(saved); finiteReceipt(r);
}, { replies: [CHUNK] }));
it('late partial write ack updates a new prefix revision and only queued sink closure', async () => fixture(async h => {
  const ack = h.hold<ProtoWriteAck>({ status: 'partial', written: 1 }); h.hooks.write = () => ack.promise;
  await start(h); const finishing = h.collector.finish(); await turns(); expect(h.count('write')).toBe(1);
  h.clock.advance(10000); await turns(); h.clock.advance(1000); const early = await valueOf(finishing), saved = JSON.stringify(early);
  failure(early, 'finish-timeout'); expect(early.sinkCloseQueued).toBe(true); expect(h.count('sink-close')).toBe(0); expect(early.acknowledgedWrittenBytes).toBe(0);
  ack.release(); await turns(); const late = h.collector.snapshot(); expect(late.revision).toBeGreaterThan(early.revision); expect(late.acknowledgedWrittenBytes).toBe(1); expect(late.acknowledgedPrefixSha256).toBe(ZERO_HASH);
  expect(h.count('sink-close')).toBe(1); failure(late, 'finish-timeout'); expect(JSON.stringify(early)).toBe(saved);
}, { replies: [CHUNK] }));
for (const bad of [NaN, Infinity, -1, 'not-a-clock']) it('D3 invalid initial clock returns without waiting external close ' + String(bad), async () => fixture(async h => {
  const sink = h.hold<void>(undefined), lifetime = h.hold<void>(undefined); h.hooks.sinkClose = () => sink.promise; h.hooks.lifetimeClose = () => lifetime.promise; h.clock.invalidNow = bad;
  const r = await valueOf(h.collector.start()); failure(r, 'invalid-clock'); expect(r.outcome).toBe('unavailable-pending'); expect(h.count('start')).toBe(0); expect(h.count('sink-close')).toBe(1); expect(h.count('lifetime-close')).toBe(1); expect(r.clockState).toBe('invalid'); expect(r.completeClosureObserved).toBe(false);
}));
for (const kind of ['now', 'timer-before', 'timer-after', 'clear-before', 'clear-after'] as const) it('D3 throwing ' + kind + ' has no fallback timer or success recovery', async () => fixture(async h => {
  const sink = h.hold<void>(undefined); h.hooks.sinkClose = () => sink.promise;
  if (kind === 'now') h.clock.nowThrows = true;
  if (kind.startsWith('timer')) h.clock.timerThrows = kind === 'timer-before' ? 'before' : 'after';
  if (kind.startsWith('clear')) h.clock.clearThrows = kind === 'clear-before' ? 'before' : 'after';
  const r = await valueOf(h.collector.start()); failure(r, 'invalid-clock'); expect(r.outcome).toBe('unavailable-pending'); expect(h.count('lifetime-close')).toBe(1);
  const attempts = h.clock.timerAttempts, clears = h.clock.clearAttempts, clockReads = h.clock.nowCalls;
  const timer = r.timers.find(t => t.stage === 'start');
  if (kind === 'now') { expect(timer).toBeUndefined(); expect(attempts).toBe(0); expect(clears).toBe(0); }
  else {
    expect(attempts).toBe(1); expect(timer?.registrationAttempted).toBe(true);
    expect(timer?.registrationState).toBe(kind.startsWith('timer') ? 'unknown-after-throw' : 'registered');
    expect(timer?.clearAttempted).toBe(kind.startsWith('clear')); expect(timer?.disposalState).toBe('unknown-after-throw');
    expect(clears).toBe(kind.startsWith('clear') ? 1 : 0);
  }
  const saved = JSON.stringify(r);
  for (const callback of h.clock.installed) callback(); sink.release(); await turns();
  expect(h.clock.timerAttempts).toBe(attempts); expect(h.clock.clearAttempts).toBe(clears); expect(h.clock.nowCalls).toBe(clockReads);
  expect(h.collector.snapshot().outcome).not.toBe('protocol-closed'); expect(JSON.stringify(r)).toBe(saved); finiteReceipt(r);
}));
it('D3 backwards clock while a write is pending releases lifetime but queues sink close', async () => fixture(async h => {
  const ack = h.hold<ProtoWriteAck>({ status: 'complete', written: 3 }); h.hooks.write = () => ack.promise;
  h.clock.now = 10; await start(h); const finishing = h.collector.finish(); await turns(); expect(h.count('write')).toBe(1);
  h.clock.now = 9; const closing = h.collector.close(); const r = await valueOf(closing);
  expect(r.clockState).toBe('invalid'); expect(r.outcome).toBe('unavailable-pending'); expect(r.sinkCloseQueued).toBe(true); expect(h.count('sink-close')).toBe(0); expect(h.count('lifetime-close')).toBe(1);
  ack.release(); await turns(); await valueOf(finishing); expect(h.count('sink-close')).toBe(1); expect(h.collector.snapshot().outcome).not.toBe('protocol-closed');
}, { replies: [CHUNK] }));
it('listener removal failure never publishes complete closure', async () => fixture(async h => {
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'listener-cleanup-failed'); expect(r.completeClosureObserved).toBe(false); expect(r.listenerCleanup).not.toBe('complete');
}, { unsubscribeFailure: true }));
for (const elapsed of [9999, 10000]) it('start deadline is absolute at ' + elapsed + 'ms without timer advancement', async () => fixture(async h => {
  h.hooks.start = async () => { h.clock.now = elapsed; };
  const r = await valueOf(h.collector.start());
  if (elapsed === 9999) expect(r.stage).toBe('recording'); else failure(r, 'start-timeout');
}));
it('D3 cleanup timer registration failure returns immediately with held close originals', async () => fixture(async h => {
  const io = h.hold<void>(undefined), sink = h.hold<void>(undefined); h.hooks.ioClose = () => io.promise; h.hooks.sinkClose = () => sink.promise;
  h.clock.timerThrows = 'after'; h.clock.failAtTimerAttempt = 3;
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'invalid-clock');
  expect(r.outcome).toBe('unavailable-pending'); expect(h.clock.timerAttempts).toBe(3); expect(h.count('lifetime-close')).toBe(1);
  expect(r.ioClose).toBe('pending'); expect(r.sinkClose).toBe('pending'); expect(r.lifetimeClose).toBe('pending');
  expect(r.pending.map(op => op.kind).sort()).toEqual(['io-close', 'lifetime-close', 'sink-close']);
  expect(r.timers.some(t => t.registrationState === 'unknown-after-throw')).toBe(true); expect(r.completeClosureObserved).toBe(false);
  io.release(); sink.release(); await turns(); expect(h.collector.snapshot().outcome).not.toBe('protocol-closed');
}));
it('synchronous cleanup deadline publishes timeout only after owned cleanup dispatch', async () => fixture(async h => {
  const io = h.hold<void>(undefined), sink = h.hold<void>(undefined), lifetime = h.hold<void>(undefined);
  h.hooks.ioClose = () => io.promise; h.hooks.sinkClose = () => sink.promise; h.hooks.lifetimeClose = () => lifetime.promise;
  const setTimer = h.ports.clock.setTimer;
  h.ports.clock.setTimer = (callback, delayMs) => {
    const token = setTimer(callback, delayMs);
    if (h.clock.timerAttempts === 3) { expect(delayMs).toBe(1000); h.clock.now += 1000; callback(); }
    return token;
  };
  await start(h); const r = await valueOf(h.collector.finish()); failure(r, 'cleanup-timeout');
  expect(h.clock.timerAttempts).toBe(3); expect(h.count('io-close')).toBe(1); expect(h.count('sink-close')).toBe(1); expect(h.count('lifetime-close')).toBe(1);
  expect(r.ioClose).toBe('pending'); expect(r.sinkClose).toBe('pending'); expect(r.lifetimeClose).toBe('pending');
  expect(r.pending.map(op => op.kind).sort()).toEqual(['io-close', 'lifetime-close', 'sink-close']);
  expect(r.outcome).toBe('unavailable-pending'); expect(r.completeClosureObserved).toBe(false); expect(r.originalOperationsSettled).toBe(false);
  expect(r.timers.find(t => t.stage === 'cleanup')?.registrationState).toBe('registered'); falseAuthority(r);
}, { autoSessionClose: false }));
it('cleanup-time revocation prevents protocol-closed and preserves an earlier failure', async () => {
  for (const priorLoss of [false, true]) await fixture(async h => {
    h.hooks.lifetimeClose = async () => { h.revoke(); };
    await start(h); const r = await valueOf(h.collector.finish());
    expect(r.sessionCloseObserved).toBe(true); expect(r.revocationObserved).toBe(true);
    expect(r.ioClose).toBe('fulfilled'); expect(r.sinkClose).toBe('fulfilled'); expect(r.lifetimeClose).toBe('fulfilled');
    expect(r.originalOperationsSettled).toBe(true); expect(r.outcome).not.toBe('protocol-closed');
    if (priorLoss) expect(r.firstFailure?.code).toBe('loss-reported'); else expect(r.firstFailure).toBeNull();
    falseAuthority(r);
  }, { completion: { ...GOOD, dataLossOccurred: priorLoss }, replies: [CHUNK] });
});

it('owned profile explicitly opts into immutable separate policy and deadlines', async () => fixture(async h => {
  const r = await start(h);
  expect(r.policy).toBe(OWNED_POLICY); expect(r.profileSha256).toMatch(/^[a-f0-9]{64}$/); expect(r.profileSha256).not.toBe(PROFILE);
  expect(r.stageTimes).toEqual([{stage:'start',startedAtMs:0,deadlineAtMs:10000}]);
  await valueOf(h.collector.finish()); const final=h.collector.snapshot();
  expect(final.stageTimes.map(row=>[row.stage,row.deadlineAtMs!-row.startedAtMs!])).toEqual([['start',10000],['finish',20000],['cleanup',10000]]);
  expect(final.outcome).toBe('protocol-closed');falseAuthority(final);
}, {}, OWNED_POLICY));
for(const extra of [0,1,65536]) it('owned profile writes real32MiB bytes then '+(extra?'refuses cap+'+extra:'accepts exact cap'), async () => fixture(async h => {
  let reads=0,written=0;
  h.hooks.read=async()=>{reads++;return reads<=512?{data:ZERO_CHUNK,base64Encoded:true,eof:!extra&&reads===512}:{data:extra===65536?ZERO_CHUNK:'AA==',base64Encoded:true,eof:true};};
  h.hooks.write=async bytes=>{expect(bytes).toBeInstanceOf(Uint8Array);expect(bytes.every(value=>value===0)).toBe(true);written+=bytes.byteLength;return {status:'complete',written:bytes.byteLength};};
  await start(h);const r=await h.collector.finish();
  expect(written).toBe(33554432);expect(r.acknowledgedWrittenBytes).toBe(written);expect(r.readAttempts).toBe(extra?513:512);
  expect(r.validatedReceivedBytes).toBe(33554432+extra);expect(h.count('write')).toBe(512);
  if(extra)failure(r,'byte-capacity');else expect(r.outcome).toBe('protocol-closed');falseAuthority(r);
}, {retainBytes:false}, OWNED_POLICY));
for(const extra of [false,true]) it('owned profile permits4096 actual original reads and refuses4097 attempt '+extra,async()=>fixture(async h=>{
  let reads=0;h.hooks.read=async()=>({data:'AA==',base64Encoded:true,eof:++reads===4096&&!extra});
  await start(h);const r=await h.collector.finish();expect(reads).toBe(4096);expect(r.readAttempts).toBe(4096);expect(r.acknowledgedWrittenBytes).toBe(4096);
  if(extra)failure(r,'read-capacity');else expect(r.outcome).toBe('protocol-closed');
  expect(r.originalOperationsSettled).toBe(true);falseAuthority(r);
}, {retainBytes:false}, OWNED_POLICY));
it('owned finish deadline does not synthesize settlement of a held original read',async()=>fixture(async h=>{
  const read=h.hold<unknown>(EOF);h.hooks.read=()=>read.promise;
  await start(h);const finishing=h.collector.finish();await turns();h.clock.advance(19999);await turns();expect(h.collector.snapshot().firstFailure).toBeNull();
  h.clock.advance(1);await turns();expect(h.collector.snapshot().firstFailure?.code).toBe('finish-timeout');
  h.clock.advance(9999);await turns();expect(observe(finishing).state).toBe('pending');
  h.clock.advance(1);const r=await valueOf(finishing);expect(r.pending.some(row=>row.kind==='read')).toBe(true);expect(r.originalOperationsSettled).toBe(false);
  read.resolve(EOF);await turns();expect(h.collector.snapshot().originalOperationsSettled).toBe(true);expect(h.collector.snapshot().outcome).not.toBe('protocol-closed');
}, {}, OWNED_POLICY));
it('owned policy objects and boxed strings cannot supply mutable capacity overrides',async()=>{
  for(const policy of [{policy:OWNED_POLICY,maxBytes:33554432},new String(OWNED_POLICY)])await fixture(async h=>{
    const r=await valueOf(h.collector.start());failure(r,'unsupported-policy');expect(h.journal).toEqual([]);
  },{},policy);
});

for(const [name,completion,code]of invalidCompletions)it('owned profile retains strict completion '+name,async()=>fixture(async h=>{
 await start(h);const r=await valueOf(h.collector.finish());failure(r,code);expect(h.count('read')).toBe(0);
},{completion},OWNED_POLICY));
for(const data of ['AB==','AAB=','=AAA','AA==AAAA'])it('owned profile retains canonical base64 refusal '+data,async()=>fixture(async h=>{
 await start(h);const r=await valueOf(h.collector.finish());failure(r,'invalid-base64');expect(h.count('write')).toBe(0);
},{replies:[{data,eof:true,base64Encoded:true}]},OWNED_POLICY));
for(const lane of ['start','end','read','write','ioClose','sinkClose','lifetimeClose']as const)it('owned profile retains original held '+lane+' after deadline',async()=>fixture(async h=>{
 const held=h.hold<unknown>(lane==='read'?EOF:lane==='write'?{status:'complete',written:3}:undefined);
 if(lane==='start')h.hooks.start=()=>held.promise as Promise<void>;
 if(lane==='end')h.hooks.end=()=>{h.emitComplete();return held.promise as Promise<void>;};
 if(lane==='read')h.hooks.read=()=>held.promise;
 if(lane==='write')h.hooks.write=()=>held.promise as Promise<ProtoWriteAck>;
 if(lane==='ioClose'||lane==='sinkClose'||lane==='lifetimeClose')h.hooks[lane]=()=>held.promise as Promise<void>;
 const action=lane==='start'?h.collector.start():(await start(h),h.collector.finish());await turns();
 h.clock.advance(lane==='start'?10000:20000);await turns();h.clock.advance(10000);const r=await valueOf(action);
 const kind=({ioClose:'io-close',sinkClose:'sink-close',lifetimeClose:'lifetime-close'}as Record<string,string>)[lane]??lane;
 expect(r.outcome).toBe('unavailable-pending');expect(r.pending.some(row=>row.kind===kind)).toBe(true);expect(r.originalOperationsSettled).toBe(false);
 held.release();await turns();expect(h.collector.snapshot().outcome).not.toBe('protocol-closed');falseAuthority(r);
},{replies:[CHUNK]},OWNED_POLICY));
for(const [status,written,code]of [['partial',1,'sink-partial-write'],['refused',0,'sink-refused-write']]as const)it('owned profile retains '+status+' write acknowledgement',async()=>fixture(async h=>{
 h.hooks.write=async()=>({status,written});await start(h);const r=await valueOf(h.collector.finish());failure(r,code);expect(r.acknowledgedWrittenBytes).toBe(written);expect(r.acceptedEof).toBe(false);
},{replies:[CHUNK]},OWNED_POLICY));
it('owned profile retains eight empty replies refusal',async()=>fixture(async h=>{
 h.hooks.read=async()=>({data:'',eof:false});await start(h);const r=await valueOf(h.collector.finish());failure(r,'empty-progress');expect(r.readAttempts).toBe(8);
},{},OWNED_POLICY));
