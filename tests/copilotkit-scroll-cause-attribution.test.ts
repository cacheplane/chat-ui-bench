import { expect, test } from 'vitest';
import * as diagnostic from '../apps/copilotkit/src/scroll-cause-diagnostic.ts';
import * as tracker from '../apps/copilotkit/runtime/mounted-tracker-a.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MOUNTED_CASE_WITNESS_LABELS } from './support/hosted-copilot-mounted-policy.ts';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformScrollCause, PINNED_MODULE } from './support/hosted-copilot-scroll-cause-transform.ts';
const nativePath: string = '../apps/copilotkit/runtime/mounted-native.ts';
const native = await import(nativePath);
const serialized = <T extends Function>(callback: T): T => Function(`return (${callback.toString()})`)() as T;

for (const kind of ['normal', 'state', 'field', 'capability', 'cap-getter', 'marker-throw', 'geometry-throw', 'url', 'scroller'] as const) test(`actual serialized callbacks preserve raw ordering/refusal: ${kind}`, async () => {
  const create = Reflect.get(diagnostic, 'createScrollCauseAttributionDiagnostic');
  const observer: any = create(), calls: string[] = [], owner = { isConnected: true, scrollTop: 100, scrollHeight: 1000, clientHeight: 200, getBoundingClientRect() { calls.push('box'); return { x: 0, y: 0, width: 100, height: 200 }; }, addEventListener() {}, removeEventListener() {} };
  const shot = { original: true };
  const originalThrow = Object.freeze({ original: true }); let attackerCalls = 0, switchedScroller = false;
  const host = { locators: { scroller: '#owner' }, readGeometrySnapshot() { calls.push('geometry'); if (kind === 'geometry-throw') throw originalThrow; return shot; }, releaseAnchorDiagnostic() {}, probeAnchorDiagnostic() { return {}; } };
  const cap = Object.freeze({ protocol: 'scroll-cause-attribution-v1', observer, start(scroller: object) { calls.push('start'); observer.start(scroller); }, marker(scroller: object, purpose: unknown) { calls.push('marker'); if (kind === 'marker-throw') throw originalThrow; observer.marker(scroller, purpose); }, seal: observer.seal });
  const globals: Record<string, unknown> = { window: { __copilotkitBenchHost: host, __copilotkitScrollCauseDiagnostic: cap }, document: { querySelectorAll() { calls.push('query'); return [switchedScroller ? { ...owner } : owner]; } }, location: { href: 'http://original/' }, innerWidth: 100, innerHeight: 200, devicePixelRatio: 1 };
  const previous = Object.entries(globals).map(([key, value]) => { const descriptor = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { configurable: true, value }); return [key, descriptor] as const; });
  try {
    serialized(tracker.initializeTrackerAPage)({ scrollCauseAttribution: true }); calls.length = 0;
    const w = globals.window as any, forged = { start() { attackerCalls++; }, marker() { attackerCalls++; }, export() { attackerCalls++; } };
    if (kind === 'state') w.__copilotkitTrackerA = { ...w.__copilotkitTrackerA, attribution: forged };
    if (kind === 'field') w.__copilotkitTrackerA.attribution = forged;
    if (kind === 'capability') w.__copilotkitScrollCauseDiagnostic = Object.freeze({ ...cap, ...forged });
    if (kind === 'cap-getter') Object.defineProperty(w, '__copilotkitScrollCauseDiagnostic', { get() { attackerCalls++; return cap; } });
    if (kind === 'url') (globals.location as any).href = 'http://changed/';
    if (kind === 'geometry-throw') { expect(() => serialized(tracker.readTrackerAGeometrySnapshot)('tracker-a-G1-anchor-diagnostic-v1')).toThrow(originalThrow); expect(calls).toEqual(['geometry']); return; }
    expect(serialized(tracker.readTrackerAGeometrySnapshot)('tracker-a-G1-anchor-diagnostic-v1')).toBe(shot);
    expect(calls).toEqual(kind === 'normal' || kind === 'marker-throw' || kind === 'scroller' ? ['geometry', 'start'] : ['geometry']); calls.length = 0;
    switchedScroller = kind === 'scroller';
    await serialized(tracker.readTrackerAAnchorScalarEnvelope)({ selection: undefined, purpose: { role: 'pre', ordinal: 1, slot: null } });
    if (kind === 'normal' || kind === 'marker-throw') expect(calls.indexOf('marker')).toBeGreaterThan(calls.indexOf('box'));
    const exportCallback = Reflect.get(tracker, 'exportTrackerAScrollCauseDiagnostic'); expect(exportCallback).toBeTypeOf('function');
    const exported = serialized(exportCallback)() as any;
    if (kind === 'normal') { expect(exported.snapshot.markers.count).toBe(1); expect(exported.g1).toBe('raw-returned'); }
    else if (kind === 'scroller') expect(exported.sameScroller).toBe('changed');
    else expect(exported.snapshot).toBe(null);
    expect(attackerCalls).toBe(0);
  } finally { for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

const factory = () => {
  const create = Reflect.get(diagnostic, 'createScrollCauseAttributionDiagnostic');
  expect(create).toBeTypeOf('function');
  return create() as any;
};
test('version2 starts with the genuine receiver and marks without fake instance state', () => {
  const observer = factory(), owner = {}, instance = {};
  observer.enter(instance, 0, 15); observer.exit(instance, null, true);
  expect(observer.snapshot()).toMatchObject({ version: 2, collectionState: 'inactive', instances: 0, states: 0, rows: [], complete: false });
  observer.start(owner); observer.marker(owner, { role: 'pre', ordinal: 1, slot: null });
  observer.request(instance, 10, 2, undefined, 12); observer.returned(instance, owner, () => {}, 10, 2, undefined);
  observer.marker(owner, { role: 'post', ordinal: 2, slot: null });
  const sealed = observer.seal();
  expect(sealed).toMatchObject({ version: 2, status: 'unqualified', collectionState: 'sealed', ownerId: 1, startSequence: 0, endSequence: 4, complete: true, instances: 1, states: 1, markers: { count: 2, firstOrdinal: 1, lastOrdinal: 2, pre: true, post: true, contiguous: true } });
  expect(sealed.rows[0]).toEqual([8, 1, null, null, null, 1, 1, 1, null, ...Array(23).fill(null)]);
  expect(sealed.rows[2][5]).toBe(1);
  expect(Object.isFrozen(sealed.rows[0])).toBe(true);
  observer.marker(owner, { role: 'post', ordinal: 3, slot: null }); observer.enter({}, 0, 1); observer.exit({}, null, true);
  expect(observer.snapshot()).toEqual(sealed);
});

test('inactive invocation cannot become a collection scope; seal mid-call stays incomplete', () => {
  const observer = factory(), instance = {}, owner = {};
  expect(observer.enter(instance, 0, 15)).toBe(null); observer.start(owner); observer.exit(instance, null, true);
  expect(observer.seal()).toMatchObject({ complete: false, diagnosticFault: 5, instances: 0, states: 0 });
  const active = factory(); active.start(owner); const resize = active.enter(instance, 0, 15), cause = active.open(instance, resize, 1);
  const sealed = active.seal(); expect(sealed).toMatchObject({ complete: false, diagnosticFault: 5, activeResizes: 1, activeCauses: 1 });
  active.close(instance, resize, cause, true, true); active.exit(instance, resize, true); expect(active.snapshot()).toEqual(sealed);
});

test('marker shape, owner and ordering refuse closedly without getter invocation', () => {
  for (const kind of ['getter', 'owner', 'reverse', 'duplicate', 'invalid'] as const) {
    const observer = factory(), owner = {}; observer.start(owner); observer.marker(owner, { role: 'pre', ordinal: 1, slot: null });
    let getters = 0;
    const purpose = kind === 'getter' ? { get role() { getters++; return 'post'; }, ordinal: 2, slot: null } : { role: 'post', ordinal: kind === 'reverse' ? 0 : kind === 'duplicate' ? 1 : 2, slot: kind === 'invalid' ? 0 : null };
    observer.marker(kind === 'owner' ? {} : owner, purpose);
    expect(getters).toBe(0); expect(observer.seal().complete).toBe(false);
  }
});
test('starting inside an inactive original request refuses unsafe late delegate coverage', () => {
  const observer = factory(), instance = {}, owner = {};
  observer.request(instance, 10, 2, undefined, 12); observer.start(owner);
  observer.returned(instance, owner, () => {}, 10, 2, undefined);
  expect(observer.seal()).toMatchObject({ complete: false, diagnosticFault: 5, rows: [], instances: 0, states: 0 });
});
test('markers and vendor records share the exact row limit and width budget', () => {
  const observer = factory(), instance = {}, owner = {}; observer.start(owner);
  observer.marker(owner, { role: 'pre', ordinal: 1, slot: null });
  for (let i = 0; i < 1022; i++) observer.request(instance, i, 0, undefined, i);
  observer.marker(owner, { role: 'post', ordinal: 2, slot: null });
  expect(observer.snapshot().rows).toHaveLength(1024);
  observer.marker(owner, { role: 'post', ordinal: 3, slot: null });
  const snapshot = observer.seal(); expect(snapshot).toMatchObject({ complete: false, fault: 1, markers: { count: 2 } });
  expect(snapshot.rows).toHaveLength(1024); expect(new TextEncoder().encode(JSON.stringify(snapshot)).length).toBeLessThan(1048576);
});
test('diagnostic preflight never coerces source values or enters normal prerequisites', async () => {
  let getters = 0;
  const options = { kind: 'scroll-cause-diagnostic-options', schemaVersion: 1, source: { commitSha: { toString() { getters++; return 'a'.repeat(40); } }, treeSha: 'b'.repeat(40), lockSha256: 'c'.repeat(64) }, run: { repository: 'cacheplane/chat-ui-bench', runId: '1', attempt: 1, tag: 'hosted-copilot-react-scroll-cause-v3' }, browserEndpoint: 'ws://127.0.0.1:1234/', assets: { root: '/unreachable', files: [] }, buildRef: { path: 'diagnostic-build.json', bytes: 1, sha256: 'd'.repeat(64) } };
  await expect(native.runNativeMountedScrollCauseDiagnostic(options, {}, {})).rejects.toThrow('before SDK imports'); expect(getters).toBe(0);
  await expect(native.runNativeMountedConformance(options, {})).rejects.toThrow('prerequisites');
  await expect(native.runNativeMountedTrackerAPilot(options, {}, {})).rejects.toThrow('prerequisites');
});

test('native export retains the single original across timeout and late fulfillment', async () => {
  const create = Reflect.get(native, 'createScrollCauseExportOwner'); expect(create).toBeTypeOf('function');
  let calls = 0, settle!: (value: unknown) => void, now = 10;
  const owner = create(() => { calls++; return new Promise(resolve => { settle = resolve; }); }, 10000, () => now, async () => { throw Error('finite timeout'); });
  await owner.attempt(); expect(calls).toBe(1); expect(owner.receipt).toMatchObject({ status: 'pending', waiter: 'timed-out', failure: 'export-timeout' });
  const value = { actual: true }; now = 20; settle(value); await Promise.resolve(); await Promise.resolve();
  expect(owner.receipt).toMatchObject({ status: 'fulfilled', settledHostMs: 20, waiter: 'timed-out' }); expect(owner.value()).toBe(value);
  await owner.attempt(); expect(calls).toBe(1);
});

function projectionFixture() {
  const coverage = { protocol: 'scroll-cause-attribution-v1', version: 1, capability: 'not-checked', host: 'not-checked', url: 'not-checked', sameScroller: 'not-checked', g1: 'not-returned', originals: { inputDrain: 'not-started', trace: 'unavailable', export: 'not-started' }, scalarJoin: { status: 'unavailable', expected: null, observed: 0, lastOrdinal: null }, availability: 'unavailable', reasons: ['not-started', 'g1-unavailable', 'ledger-unavailable', 'scalar-join-unavailable', 'input-unclosed', 'trace-unclosed', 'export-unclosed'] };
  const receipt = { status: 'not-started', requestedHostMs: null, targetHostMs: null, settledHostMs: null, waiter: 'not-started', failure: null };
  return { kind: 'scroll-cause-diagnostic-result', schemaVersion: 1, strict: { status: 'incomplete', hasPrimary: true, firstFailure: { code: 'opposing-offset', ordinal: 3, previousOrdinal: 2, slot: 0 }, cleanupFailures: [], caseEvidence: [], snapshots: [], input: null, transport: null, anchorDiagnostic: null, inputDrain: { status: 'not-started', requestedHostMs: null, settledHostMs: null }, postCaptureDrain: {schemaVersion:1,eligibility:'ineligible',reason:'no-measured-failure',original:'not-started',waiter:'not-started',outcome:'ineligible',requestedHostMs:null,targetHostMs:null,settledHostMs:null} }, originals: ['browserConnect', 'clientClose', 'clientDisconnected'].map(label => ({ label, status: 'fulfilled' })), browserVersion: null, caseEvidence: [], attribution: { protocol: 'scroll-cause-attribution-v1', exportOriginal: receipt, snapshot: null, coverage }, qualification: false, nativeGO: false, performance: false, fps: 'unavailable' };
}
const profile = { path: 'tracker-a-profile.json', bytes: 10, sha256: 'a'.repeat(64) };
for (const witness of [
  { code: 'opposing-offset', ordinal: 1, previousOrdinal: 82, slot: 39 },
  { code: 'unclassified', ordinal: 2, previousOrdinal: 1, slot: 0 },
  { code: 'baseline', ordinal: null, previousOrdinal: 1, slot: null },
  { code: 'end-stop', ordinal: 4, previousOrdinal: 3, slot: 0 },
]) test(`projection refuses impossible first-failure relation ${witness.code}`, () => {
  const value: any = projectionFixture(); value.strict.firstFailure = witness;
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow();
});
test('projection preserves valid first-failure null, pre, post and measured-slot boundaries', () => {
  const witnesses: unknown[] = [
    { code: 'unclassified', ordinal: null, previousOrdinal: null, slot: null },
    { code: 'baseline', ordinal: null, previousOrdinal: null, slot: null },
    { code: 'baseline', ordinal: 1, previousOrdinal: null, slot: null },
  ];
  for (const code of ['baseline', 'timestamp-reverse', 'opposing-offset', 'end-stop']) {
    for (let ordinal = 2; ordinal <= 82; ordinal++) witnesses.push({ code, ordinal, previousOrdinal: ordinal - 1, slot: null });
    for (let slot = 0; slot < 40; slot++) for (const ordinal of [2 + 2 * slot, 3 + 2 * slot]) witnesses.push({ code, ordinal, previousOrdinal: ordinal - 1, slot });
  }
  for (const firstFailure of witnesses) {
    const value: any = projectionFixture(); value.strict.firstFailure = firstFailure;
    expect(native.projectScrollCauseEvidence(value, profile).firstFailure).toEqual(firstFailure);
  }
});
const laneAuthority = () => ({ qualification: false, fps: 'unavailable', ratio: 'unavailable', scoring: false, ranking: false });
function inputLane() {
  return { schemaVersion: 2, kind: 'tracker-a-case-input', mode: 'tracker-json-a-pilot-v2', caseNumber: 2, profileRef: profile, handlerGates: [], wheelEvents: [], scrollEvents: [], motionEvents: [], losses: null, overflows: null, entry: null, phase: null, geometryCheckpoints: null, anchor: null, listeners: null, pointer: null, scalarObservations: [], wheelRequests: [], outcome: null, authority: laneAuthority() };
}
function transportLane() {
  return { schemaVersion: 1, kind: 'tracker-a-transport', mode: 'tracker-json-a-pilot-v2', profileRef: profile, raw: null, listeners: null, operations: [], completion: null, sessionClose: null, handles: [], handleOverflow: null, sink: null, portCalls: 0, readCalls: 0, knownReadBytes: 0, outcome: { capture: { status: 'incomplete', reason: 'transport' }, containment: 'unverified' }, authority: laneAuthority() };
}
for (const lane of ['input', 'transport'] as const) for (const field of ['kind', 'schemaVersion', 'mode', 'profileRef', 'authority', 'extra', 'missing'] as const) test(`projection refuses original ${lane} finite ${field}`, () => {
  const value: any = projectionFixture(), record: any = lane === 'input' ? inputLane() : transportLane();
  value.strict[lane] = record;
  if (lane === 'transport') value.attribution.coverage.originals.trace = 'not-closed';
  if (field === 'profileRef') record.profileRef = { ...profile, sha256: 'b'.repeat(64) };
  else if (field === 'authority') record.authority = { ...laneAuthority(), qualification: true };
  else if (field === 'extra') record.privateErrorPayload = 'not-original-field';
  else if (field === 'missing') delete record.kind;
  else record[field] = field === 'schemaVersion' ? 999 : 'other';
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow();
});
test('projection refuses wrong input case and retained snapshot status', () => {
  const value: any = projectionFixture(); value.strict.input = { ...inputLane(), caseNumber: 1 };
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow();
  value.strict.input = null; value.strict.snapshots = [{ caseNumber: 2, snapshot: { status: 'made-up', reason: 'disposed' } }];
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow();
});
test('finite original lane checks retain valid discriminants without granting normal admission', () => {
  const value: any = projectionFixture(); value.strict.input = inputLane(); value.strict.transport = transportLane(); value.attribution.coverage.originals.trace = 'not-closed';
  const projection = native.projectScrollCauseEvidence(value, profile);
  expect(projection.input).toEqual(value.strict.input); expect(projection.transport).toEqual(value.strict.transport);
  expect(projection.strictResult.qualification).toBe(false); expect(projection.strictResult.nativeGO).toBe(false);
});
test('projection copies original failure without serializing primary/cleanup errors', () => {
  const value: any = projectionFixture(); let getters = 0;
  const error = Object.create(Error.prototype); Object.defineProperty(error, 'message', { get() { getters++; throw Error(); } });
  value.strict.primary = error; value.strict.cleanupFailures = [error];
  const projection = native.projectScrollCauseEvidence(value, profile);
  expect(getters).toBe(0); expect(projection.strictResult.strict).toEqual({ status: 'incomplete', hasPrimary: true, firstFailure: value.strict.firstFailure, cleanupFailureCount: 1 });
  expect(JSON.stringify(projection)).not.toContain('message'); expect(projection.cases).toEqual([]);
  expect(projection.strictResult).toHaveProperty('anchorDiagnostic', null);
  expect(projection.strictResult.publicationAbsence).toEqual(projection.absence);
  const closed = JSON.stringify(projection.strictResult); projection.absence.push({ path: 'forged.json', reason: 'forged' });
  expect(JSON.stringify(projection.strictResult)).toBe(closed);
});

test('actual native disposal awaits pilot and remote admission before one export, preserving cleanup', async () => {
  const source = readFileSync(new URL('../apps/copilotkit/runtime/mounted-native.ts', import.meta.url), 'utf8');
  const start = source.indexOf('const mountedOwner={closeAdmission:remoteCloseAdmission,async dispose(){');
  const end = source.indexOf('\n   const server=', start); expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const code = stripTypeScriptTypes(source.slice(start, end));
  for (const kind of ['diagnostic', 'ordinary', 'pilot-reject', 'export-reject'] as const) {
    const calls: string[] = []; let pilotResolve!: () => void, admissionResolve!: () => void;
    const pilotOriginal = new Promise<void>((yes, no) => { pilotResolve = kind === 'pilot-reject' ? () => no(null) : yes; });
    const remote = new Promise<void>(yes => { admissionResolve = yes; });
    const env: any = { mode: { kind: kind === 'ordinary' ? 'ordinary' : 'scroll-cause' }, number: 2, overallDeadline: performance.now() + 10000, attributionExport: undefined, exportPage: undefined,
      remoteAdmission: remote, remoteCloseAdmission() { calls.push('admit'); }, pilot: { dispose() { calls.push('pilot'); return pilotOriginal; } },
      createScrollCauseExportOwner: native.createScrollCauseExportOwner, exportTrackerAScrollCauseDiagnostic: tracker.exportTrackerAScrollCauseDiagnostic,
      page: { async evaluate(callback: Function) { if (callback === tracker.exportTrackerAScrollCauseDiagnostic) { calls.push('export'); if (kind === 'export-reject') throw null; return {}; } const text = callback.toString(); calls.push(text.includes('__copilotkitNativeWheel') ? 'wheel' : text.includes('h.dispose') ? 'host' : 'root'); return true; }, async close() { calls.push('page'); } },
      context: { async close() { calls.push('context'); } }, mark() {} };
    env.attributionExport = native.createScrollCauseExportOwner(() => env.exportPage.evaluate(tracker.exportTrackerAScrollCauseDiagnostic), env.overallDeadline);
    const actual = Function('env', `with (env) { ${code}; return mountedOwner; }`)(env);
    let rejection: unknown; const work = actual.dispose().catch((error: unknown) => { rejection = error; });
    await Promise.resolve(); expect(calls).toEqual(['admit', 'pilot']); pilotResolve(); await Promise.resolve(); await Promise.resolve(); expect(calls).not.toContain('export');
    admissionResolve(); await work;
    expect(calls).toEqual(['admit', 'pilot', ...(kind === 'ordinary' ? [] : ['export']), 'wheel', 'host', 'root', 'page', 'context']);
    expect(rejection !== undefined).toBe(kind === 'pilot-reject');
  }
});

for (const ending of ['fulfilled', 'rejected', 'early-incomplete', 'normal', 'callback-rejected'] as const) test(`actual native final transport observes only existing cleanup originals: ${ending}`, async () => {
  const source = readFileSync(new URL('../apps/copilotkit/runtime/mounted-native.ts', import.meta.url), 'utf8');
  const start = source.indexOf('   cleanup=(async()=>{', source.indexOf('function bindNativeTrackerA('));
  const end = source.indexOf('\n   })();void cleanup.catch', start); expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const body = stripTypeScriptTypes(source.slice(start + '   cleanup=(async()=>{'.length, end));
  const gate = () => { let resolve!: () => void, reject!: (error: unknown) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
  const finish = gate(), detach = gate(), closed = gate(), removed = gate(), drained = gate();
  const originalError = Object.freeze({ trace: 'original rejection' }), early = { ...transportLane(), listeners: { sessionClose: { registration: { status: 'fulfilled' } } }, outcome: { capture: { status: ending === 'rejected' || ending === 'early-incomplete' ? 'incomplete' : 'complete', reason: null }, containment: 'verified' }, operations: [{ status: 'pending' }] };
  const final = { ...early, operations: [{ status: 'fulfilled' }] }; let current = early;
  const observations: unknown[] = [], calls: string[] = [];
  const env = { baselineOriginal: {}, acquisition: undefined, trace: { async finish() { calls.push('finish'); await finish.promise; }, snapshot() { calls.push('snapshot'); return structuredClone(current); } }, sink: undefined,
    session: {}, consumerAttempted: true, consumerEverBound: true, detachOriginal: detach.promise, detachAttempted: true, publicClosed: closed.promise,
    cleanupRequested: true, detachStatus: 'fulfilled', firstSessionCloseMatch: true, publicCloseInstalled: true,
    registrations: { wheel: { installAttempted: true, installOriginal: Promise.resolve(true) }, ...Object.fromEntries(['scroll', 'animationstart', 'transitionrun', 'navigation', 'contextClose', 'pageClose'].map(name => [name, { installAttempted: false }])) },
    listeners: { wheel: { async remove() { calls.push('remove'); await removed.promise; } } }, drained: true, drainOriginal: { promise: drained.promise, status: 'fulfilled' }, targetDiagnostic: undefined, frameDiagnostic: undefined, sessionOriginal: {}, targetOriginal: {}, frameOriginal: {},
    ports: { scrollCauseAttribution: ending !== 'normal', observeScrollCauseTransport(value: unknown) { calls.push('observe'); observations.push(value); if (ending === 'callback-rejected') throw Object.freeze({ diagnostic: 'never escape' }); } } };
  let rejection: unknown; const work = Function('env', `with(env){return (async()=>{${body}})();}`)(env).catch((error: unknown) => { rejection = error; });
  await Promise.resolve(); expect(calls).toEqual(['finish']); expect(observations).toEqual([]);
  if (ending === 'rejected') finish.reject(originalError); else finish.resolve();
  for (let i = 0; i < 6; i++) await Promise.resolve(); expect(observations).toEqual([]);
  detach.resolve(); closed.resolve(); for (let i = 0; i < 6; i++) await Promise.resolve(); expect(calls).toContain('remove'); expect(observations).toEqual([]);
  removed.resolve(); for (let i = 0; i < 6; i++) await Promise.resolve(); expect(observations).toEqual([]);
  current = final; drained.resolve(); await work;
  expect(observations).toEqual(ending === 'normal' ? [] : [final]);
  expect(rejection !== undefined).toBe(ending === 'rejected' || ending === 'early-incomplete');
  if (rejection) { const causes = (rejection as Error).cause as unknown[]; if (ending === 'rejected') expect(causes[0]).toBe(originalError); }
});

test('actual diagnostic result updates only final transport without promoting original strict outcome', () => {
  const source = readFileSync(new URL('../apps/copilotkit/runtime/mounted-native.ts', import.meta.url), 'utf8');
  const start = source.indexOf("  if(mode.kind==='scroll-cause'){", source.indexOf('const pilot=await runMountedTrackerA('));
  const end = source.indexOf('\n  return {pilot,originals,browserVersion,caseEvidence};', start);
  const code = stripTypeScriptTypes(`function actual(){${source.slice(start, end)}}`);
  const pilot: any = projectionFixture().strict, original = Object.freeze({ original: 'strict failure' }); pilot.primary = original; pilot.cleanupFailures = [original];
  const final = transportLane(), receipt = projectionFixture().attribution.exportOriginal;
  const result = Function('env', `with(env){${code};return actual();}`)({ mode: { kind: 'scroll-cause' }, pilot, diagnosticTransport: final, attributionExport: { receipt, value: () => undefined }, copyScrollCauseData: native.copyScrollCauseData, scrollCauseCoverage: (strict: unknown) => strict, originals: [], browserVersion: null, caseEvidence: [] });
  expect(result.strict.transport).toBe(final); expect(pilot.transport).toBe(null);
  for (const key of ['status', 'hasPrimary', 'primary', 'firstFailure', 'cleanupFailures', 'inputDrain']) expect(result.strict[key]).toBe(pilot[key]);
});

test('copy budgets refuse hostile data and exact/+1 bytes before unbounded serialization', () => {
  let getters = 0;
  const hostile = Object.defineProperty({}, 'payload', { enumerable: true, get() { getters++; throw Error(); } });
  for (const value of [hostile, new Error('private'), [,,], { value: Infinity }, { value: '\ud800' }]) expect(() => native.copyScrollCauseData(value, 16384)).toThrow();
  expect(getters).toBe(0); const cycle: any = {}; cycle.self = cycle; expect(() => native.copyScrollCauseData(cycle, 16384)).toThrow();
  const value = { text: '😀\n"' }; const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  expect(native.copyScrollCauseData(value, bytes)).toEqual(value); expect(() => native.copyScrollCauseData(value, bytes - 1)).toThrow();
  expect(() => native.copyScrollCauseData(Array(8193).fill(null), 1048576)).toThrow();
});
for (const kind of ['coverage-extra', 'coverage-enum', 'receipt-extra', 'witness-extra'] as const) test(`projection refuses closed ${kind}`, () => {
  const value: any = projectionFixture();
  if (kind === 'coverage-extra') value.attribution.coverage.errorMessage = 'forbidden';
  if (kind === 'coverage-enum') value.attribution.coverage.capability = 'accepted';
  if (kind === 'receipt-extra') value.attribution.exportOriginal.message = 'forbidden';
  if (kind === 'witness-extra') value.originals[0].errorMessage = 'forbidden';
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow();
});

test('projection never invents anchor snapshot references or reads anchor errors', () => {
  const value: any = projectionFixture(); let getters = 0;
  Object.defineProperty(value.strict, 'anchorDiagnosticError', { get() { getters++; throw Error(); } });
  value.strict.anchorDiagnostic = { selection: { snapshotRef: { path: 'native-case-2.json', index: 0 } }, observations: [] };
  expect(() => native.projectScrollCauseEvidence(value, profile)).toThrow(); expect(getters).toBe(0);
});

test('projection retains absent anchor as null and joins nonnull selection to the actual original row', () => {
  const absent: any = projectionFixture(); delete absent.strict.anchorDiagnostic;
  expect(native.projectScrollCauseEvidence(absent, profile).strictResult.anchorDiagnostic).toBe(null);
  const value: any = projectionFixture();
  const row = { id: 'H0', role: 'user', ownerToken: 7, contentTopCssPx: 100, relativeTopCssPx: 10 };
  value.caseEvidence = [{ caseNumber: 2, journey: 'history-reading', threadId: 'thread', seedRunId: 'seed', continuationRunId: 'continuation', repetition: 1, completed: false, publicIdle: false, storeEmpty: false, domainReleased: false, originals: MOUNTED_CASE_WITNESS_LABELS.map(label => ({ label, status: 'fulfilled' })) }];
  value.strict.snapshots = [{ caseNumber: 2, snapshot: { status: 'available', frame: { schemaVersion: 1, clockDomain: 'page-performance-ms', nativeViewport: { y: 3 } }, evaluation: { rows: [row], authority: { input: 'supplied-data', nativeDOMQualified: false, visibleGlyphProof: false, presentationProof: false, scoringEligibility: false } }, visibleMessages: [], scroll: { scrollTop: 0, scrollHeight: 100, clientHeight: 100 } } }];
  value.strict.anchorDiagnostic = { selection: { snapshotRef: { path: 'native-case-2.json', index: 0 }, ...row, metric: 'min-positive-text-rect-viewport-y', nativeViewportY: 3 }, observations: [] };
  expect(native.projectScrollCauseEvidence(value, profile).strictResult.anchorDiagnostic).toEqual(value.strict.anchorDiagnostic);
  for (const field of ['id', 'role', 'ownerToken', 'contentTopCssPx', 'relativeTopCssPx', 'nativeViewportY']) {
    const bad = structuredClone(value); bad.strict.anchorDiagnostic.selection[field] = field === 'id' ? 'other' : field === 'role' ? 'assistant' : 999;
    expect(() => native.projectScrollCauseEvidence(bad, profile)).toThrow();
  }
});

test('actual pinned closed trio preserves success and original throws with version2, retiring failed causes', async () => {
  const sourceRoot = resolve('node_modules/@tanstack/virtual-core/dist/esm');
  for (const failure of ['none', 'delegate', 'predicate'] as const) {
    const outcomes: unknown[] = [];
    for (const transformed of [false, true]) {
      const directory = await mkdtemp(join(tmpdir(), 'scroll-cause-A-vendor-'));
      await writeFile(join(directory, 'package.json'), '{"type":"module"}');
      for (const name of ['lazy-measurements.js', 'utils.js', 'index.js.map', 'lazy-measurements.js.map', 'utils.js.map']) await writeFile(join(directory, name), await readFile(join(sourceRoot, name)));
      const bridge = join(directory, 'observer.mjs');
      await writeFile(bridge, `import {createScrollCauseAttributionDiagnostic} from ${JSON.stringify(pathToFileURL(resolve('apps/copilotkit/src/scroll-cause-diagnostic.ts')).href)};export const scrollCauseObserver=createScrollCauseAttributionDiagnostic();`);
      const source = await readFile(join(sourceRoot, 'index.js'), 'utf8');
      await writeFile(join(directory, 'index.js'), transformed ? transformScrollCause(source, PINNED_MODULE, pathToFileURL(bridge).href).code : source);
      const vendor = await import(pathToFileURL(join(directory, 'index.js')).href), observer = (await import(pathToFileURL(bridge).href)).scrollCauseObserver;
      const log: unknown[] = [], sentinel = Object.freeze({ original: failure }); let throwing = true;
      const owner = { scrollTo(value: unknown) { log.push(['delegate', value]); if (failure === 'delegate' && throwing) throw sentinel; } };
      const instance = new vendor.Virtualizer({ count: 1, estimateSize: () => 10, getScrollElement: () => null, scrollToFn: vendor.elementScroll, onChange: (_: unknown, sync: boolean) => log.push(['notify', sync]) });
      instance.scrollOffset = 100; instance.scrollElement = owner;
      instance.measurementsCache = [{ index: 0, key: 0, start: 0, size: 10, end: 10, lane: 0 }];
      if (failure === 'predicate') instance.shouldAdjustScrollPositionOnItemSizeChange = () => { log.push('predicate'); throw sentinel; };
      observer.start(owner); observer.marker(owner, { role: 'pre', ordinal: 1, slot: null });
      let thrown: unknown; try { instance.resizeItem(0, 15); } catch (error) { thrown = error; }
      expect(thrown === sentinel).toBe(failure !== 'none'); throwing = false;
      instance._scrollToOffset(200, { adjustments: 0, behavior: undefined });
      observer.marker(owner, { role: 'post', ordinal: 2, slot: null });
      const snapshot = observer.seal();
      if (transformed) { const requests = snapshot.rows.filter((row: (number | null)[]) => row[0] === 5); expect(requests.at(-1)?.[4]).toBe(null); expect(snapshot.activeResizes).toBe(0); expect(snapshot.activeCauses).toBe(0); expect(snapshot.markers.count).toBe(2); expect(snapshot.complete).toBe(failure === 'none'); }
      outcomes.push(log);
    }
    expect(outcomes[1]).toEqual(outcomes[0]);
  }
});

test('projection requires the v3 receipt without reading a receipt accessor',()=>{
 const missing:any=projectionFixture();delete missing.strict.postCaptureDrain;
 expect(()=>native.projectScrollCauseEvidence(missing,profile)).toThrow();
 let reads=0;const accessor:any=projectionFixture();Object.defineProperty(accessor.strict.postCaptureDrain,'reason',{enumerable:true,get(){reads++;throw Error('foreign');}});
 expect(()=>native.projectScrollCauseEvidence(accessor,profile)).toThrow();expect(reads).toBe(0);
});
for(const state of ['pending','rejected','timed-out','late-fulfilled'] as const)test(`projection refuses unpublished drain ${state}`,()=>{
 const value:any=projectionFixture(),late=state==='late-fulfilled';
 value.strict.postCaptureDrain={schemaVersion:1,eligibility:'eligible',reason:'eligible',original:late?'fulfilled':state==='rejected'?'rejected':'pending',waiter:state==='pending'?'not-started':state==='rejected'?'rejected':'timed-out',outcome:state==='pending'?'pending':state==='rejected'?'rejected':'timed-out',requestedHostMs:1,targetHostMs:10,settledHostMs:late?11:state==='rejected'?2:null};
 expect(()=>native.projectScrollCauseEvidence(value,profile)).toThrow('postcapture');
});
