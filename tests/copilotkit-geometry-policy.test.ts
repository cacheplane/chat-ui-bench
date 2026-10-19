import { describe, expect, it } from 'vitest';
import { evaluateHistoricalAnchor, evaluateMountedGeometry, evaluateSelectedGeometryRow, GEOMETRY_LIMITS } from '../apps/copilotkit/src/geometry-policy.js';

type Rect = { x: number; y: number; width: number; height: number };
const rect = (x = 5, y = 10, width = 20, height = 10): Rect => ({ x, y, width, height });
const canonical = (id: string, role = 'user', text = 'H'.repeat(512)) => ({ id, role, text });
const row = (index = 0) => ({ id: `H${index}`, role: 'user', presence: 'mounted', ownerToken: index + 1 as number | null,
  observedText: 'H'.repeat(512), textRects: [rect()], ancestorClips: [] as { rect: Rect; clipX: boolean; clipY: boolean }[] });
const frame = () => ({ schemaVersion: 1, scopeId: 'scope-1', clockDomain: 'page-performance-ms', observedAtPageMs: 0,
  phase: 'streaming', expectedHistory: Array.from({ length: 100 }, (_, i) => canonical(`H${i}`)),
  expectedResponse: canonical('R', 'assistant', 'R'.repeat(6400)), responseProgress: { active: true, prefix: 'R' },
  viewport: rect(0, 0, 100, 100), nativeViewport: rect(0, 0, 100, 100), rows: [row()] });
describe('selected historical row shares the full metric',()=>{
 it.each(['raw-top','clip','native-viewport','empty','mismatch','nonpositive','fully-clipped'] as const)('is exactly the full evaluator row for %s',kind=>{
  const f=frame(),r=f.rows[0]!;if(kind==='raw-top'){r.textRects=[rect(0,-5),rect(0,20)];}if(kind==='clip')r.ancestorClips=[{rect:rect(0,15,100,10),clipX:false,clipY:true}];if(kind==='native-viewport')f.nativeViewport=rect(0,12,100,100);if(kind==='empty')r.observedText='';if(kind==='mismatch')r.observedText='wrong';if(kind==='nonpositive')r.textRects=[rect(0,10,0,20)];if(kind==='fully-clipped')r.textRects=[rect(0,200)];
  expect(evaluateSelectedGeometryRow(r,f.expectedHistory[0],f.viewport,f.nativeViewport)).toEqual(evaluateMountedGeometry(f).rows[0]);
 });
 it('preflights overlong text before walking supplied rectangles or invoking accessors',()=>{const f=frame(),r=f.rows[0]!;let getters=0;const rectangles=[rect()];Object.defineProperty(rectangles,0,{get(){getters++;throw Error('must not inspect');}});expect(()=>evaluateSelectedGeometryRow({...r,observedText:'x'.repeat(8193),textRects:rectangles},f.expectedHistory[0],f.viewport,f.nativeViewport)).toThrow();expect(getters).toBe(0);});
 it('accepts exact retained text and rectangle caps and refuses their next item',()=>{const f=frame(),r=f.rows[0]!;r.observedText='H'.repeat(512)+' '.repeat(7680);r.textRects=Array.from({length:256},()=>rect());expect(evaluateSelectedGeometryRow(r,f.expectedHistory[0],f.viewport,f.nativeViewport).geometryEligibility).toBe('eligible');r.textRects.push(rect());expect(()=>evaluateSelectedGeometryRow(r,f.expectedHistory[0],f.viewport,f.nativeViewport)).toThrow();});
});
const pair = () => { const first = frame(); const second = frame(); second.observedAtPageMs = 800;
  second.responseProgress.prefix = 'RR'; second.rows[0]!.textRects[0]!.y = 14;
  return { schemaVersion: 1, anchorId: 'H0', first, second }; };
const flags = { input: 'supplied-data', nativeDOMQualified: false, visibleGlyphProof: false,
  presentationProof: false, scoringEligibility: false };
const invalid = (input: unknown, code: string) => { const result = evaluateMountedGeometry(input);
  expect(result.status).toBe('invalid'); expect(result.diagnostics).toEqual([{ code, rowIndex: null }]);
  expect(result.rows).toEqual([]); expect(result.scopeId).toBeNull(); expect(result.phase).toBeNull();
  expect(result.observedAtPageMs).toBeNull(); expect(result.authority).toEqual(flags); };

describe('supplied-data mounted geometry', () => {
  it('owns frozen output and independently clips both shared bounds', () => {
    const f = frame(); f.nativeViewport = rect(10, 12, 50, 60);
    const result = evaluateMountedGeometry(f); expect(result.status).toBe('evaluated');
    expect(result.rows[0]).toEqual({ id: 'H0', role: 'user', presence: 'mounted', ownerToken: 1,
      textRelation: 'exact', geometryEligibility: 'eligible', reason: null,
      clippedTextRects: [rect(10, 12, 15, 8)], contentTopCssPx: 10, relativeTopCssPx: -2 });
    expect(result.authority).toEqual(flags); expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rows[0]!.clippedTextRects[0])).toBe(true);
    f.rows[0]!.textRects[0]!.y = 50; expect(result.rows[0]!.contentTopCssPx).toBe(10);
  });
  it.each([
    [true, false, rect(10, 500, 5, 0), [rect(10, 10, 5, 10)]],
    [false, true, rect(500, 12, 0, 4), [rect(5, 12, 20, 4)]],
    [true, true, rect(10, 12, 5, 4), [rect(10, 12, 5, 4)]],
    [false, false, rect(500, 500, 0, 0), [rect()]],
    [true, false, rect(10, 0, 0, 100), []],
    [false, true, rect(0, 10, 100, 0), []],
    [true, false, rect(25, 0, 10, 100), []],
  ] as const)('clips only declared ancestor axes (%s,%s)', (clipX, clipY, clip, expected) => {
    const f = frame(); f.rows[0]!.ancestorClips = [{ rect: clip, clipX, clipY }];
    const result = evaluateMountedGeometry(f); expect(result.status).toBe('evaluated');
    expect(result.rows[0]!.clippedTextRects).toEqual(expected);
    expect(result.rows[0]!.geometryEligibility).toBe(expected.length ? 'eligible' : 'ineligible');
    expect(result.rows[0]!.contentTopCssPx).toBe(10);
  });
  it('keeps overlapping occurrences in order and ignores zero-area top candidates', () => {
    const f = frame(); f.rows[0]!.textRects = [rect(0, -50, 0, 2), rect(), rect(7, 8, 5, 10)];
    const result = evaluateMountedGeometry(f); expect(result.status).toBe('evaluated');
    expect(result.rows[0]!.clippedTextRects).toEqual([rect(), rect(7, 8, 5, 10)]);
    expect(result.rows[0]!.contentTopCssPx).toBe(8);
  });
  it.each([NaN, Infinity, -Infinity, -1, 1000001])('rejects width %s', width => {
    const f = frame(); f.rows[0]!.textRects[0]!.width = width; invalid(f, 'invalid-rect');
  });
  it.each(['viewport', 'nativeViewport'] as const)('retains only scoped facts for zero %s', field => {
    const f = frame(); f[field].width = 0; const result = evaluateMountedGeometry(f);
    expect(result.status).toBe('unavailable'); expect(result.scopeId).toBe('scope-1');
    expect(result.phase).toBe('streaming'); expect(result.observedAtPageMs).toBe(0); expect(result.rows).toEqual([]);
    expect(result.diagnostics).toEqual([{ code: 'unavailable-viewport', rowIndex: null }]);
  });
  it.each(['unmounted', 'unavailable'])('retains presence %s without invented text or owners', presence => {
    const f = frame(); f.rows[0] = { ...row(), presence, ownerToken: null, observedText: '', textRects: [], ancestorClips: [] };
    const r = evaluateMountedGeometry(f); expect(r.status).toBe('evaluated');
    expect(r.rows[0]).toMatchObject({ textRelation: 'not-evaluated', geometryEligibility: 'unavailable', ownerToken: null,
      reason: presence === 'unmounted' ? 'unmounted' : 'unavailable-observation', contentTopCssPx: null, relativeTopCssPx: null, clippedTextRects: [] });
  });
  it.each(['', ' \t\n\r\f\v '])('uses empty-text for projected-empty %j before mismatch', observedText => {
    const f = frame(); f.rows[0]!.observedText = observedText; const r = evaluateMountedGeometry(f);
    expect(r.status).toBe('evaluated'); expect(r.rows[0]).toMatchObject({ reason: 'empty-text', textRelation: 'not-evaluated',
      geometryEligibility: 'ineligible', contentTopCssPx: 10, relativeTopCssPx: 10, clippedTextRects: [rect()] });
  });
  it('projects observed ASCII whitespace without changing raw canonical bytes', () => {
    const f = frame(); const text = `A B${'X'.repeat(509)}`; f.expectedHistory[0]!.text = text;
    f.rows[0]!.observedText = ` \tA\n\rB${'X'.repeat(509)}\v `;
    expect(evaluateMountedGeometry(f).rows[0]!.textRelation).toBe('exact');
  });
  it.each(['\u00a0', '\x00', '\x7f'])('rejects unadmitted observed character %j', c => {
    const f = frame(); f.rows[0]!.observedText = c; invalid(f, 'invalid-ascii');
  });
  it.each(['text-mismatch', 'no-positive-text-rects', 'fully-clipped'])('retains row reason %s', reason => {
    const f = frame(); if (reason === 'text-mismatch') f.rows[0]!.observedText = 'wrong';
    if (reason === 'no-positive-text-rects') f.rows[0]!.textRects = [rect(0, 0, 0, 1)];
    if (reason === 'fully-clipped') f.rows[0]!.textRects = [rect(200, 10)];
    const r = evaluateMountedGeometry(f); expect(r.status).toBe('evaluated');
    expect(r.rows[0]!.reason).toBe(reason); expect(r.rows[0]!.geometryEligibility).toBe('ineligible');
    expect(r.rows[0]!.textRelation).toBe(reason === 'text-mismatch' ? 'mismatch' : 'exact');
    expect(r.rows[0]!.contentTopCssPx).toBe(reason === 'no-positive-text-rects' ? null : 10);
  });
  it('allows virtualized missing IDs and a partial streaming response', () => {
    const f = frame(); f.rows = [{ ...row(), id: 'R', role: 'assistant', observedText: 'RRR' }];
    const r = evaluateMountedGeometry(f); expect(r.status).toBe('evaluated');
    expect(r.rows[0]!.textRelation).toBe('canonical-prefix'); expect(r.rows[0]!.geometryEligibility).toBe('eligible');
    f.phase = 'completed'; f.responseProgress = { active: false, prefix: 'R'.repeat(6400) };
    expect(evaluateMountedGeometry(f).rows[0]!.reason).toBe('text-mismatch');
    f.rows[0]!.observedText = 'R'.repeat(6400); expect(evaluateMountedGeometry(f).rows[0]!.textRelation).toBe('exact');
  });
  it.each([
    ['duplicate-expected-id', (f: ReturnType<typeof frame>) => { f.expectedHistory[1]!.id = 'H0'; }],
    ['duplicate-expected-id', (f: ReturnType<typeof frame>) => { f.expectedResponse.id = 'H0'; }],
    ['duplicate-observation-id', (f: ReturnType<typeof frame>) => { f.rows.push({ ...row(), role: 'assistant', ownerToken: 2 }); }],
    ['duplicate-owner-token', (f: ReturnType<typeof frame>) => { f.rows.push({ ...row(1), ownerToken: 1 }); }],
    ['unknown-observation-id', (f: ReturnType<typeof frame>) => { f.rows[0]!.id = 'unknown'; f.rows[0]!.role = 'assistant'; }],
    ['role-mismatch', (f: ReturnType<typeof frame>) => { f.rows[0]!.role = 'assistant'; }],
    ['response-before-continuation', (f: ReturnType<typeof frame>) => { f.phase = 'restored-history'; f.responseProgress = { active: false, prefix: '' }; f.rows[0] = { ...row(), id: 'R', role: 'assistant', observedText: 'R' }; }],
    ['invalid-presence', (f: ReturnType<typeof frame>) => { f.rows[0]!.presence = 'unmounted'; }],
    ['invalid-scalar', (f: ReturnType<typeof frame>) => { f.clockDomain = 'other'; }],
  ] as const)('global precedence %s', (code, mutate) => { const f = frame(); mutate(f); invalid(f, code); });
  it('rejects descriptors, symbols, sparse arrays, extra/missing fields without invoking accessors', () => {
    let calls = 0; const f = frame(); Object.defineProperty(f, 'scopeId', { get() { calls++; return 'scope-1'; } });
    invalid(f, 'invalid-shape'); expect(calls).toBe(0);
    const a = frame(); Object.defineProperty(a.rows, Symbol.iterator, { value() { calls++; return [][Symbol.iterator](); } });
    invalid(a, 'invalid-shape'); expect(calls).toBe(0);
    const b = frame(); delete b.rows[0]; invalid(b, 'invalid-shape');
    invalid({ ...frame(), extra: true }, 'invalid-shape');
    const { rows: _rows, ...c } = frame(); invalid(c, 'invalid-shape');
  });
  it('caps raw rows before duplicate and known-ID checks; 128 is not a valid 128-ID profile', () => {
    const f = frame(); f.rows = Array.from({ length: 128 }, () => row()); invalid(f, 'duplicate-observation-id');
    f.rows.push(row()); invalid(f, 'cardinality-cap'); expect(GEOMETRY_LIMITS.rows).toBe(128);
  });
  it('checks exact per-row and total rectangles before identity checks', () => {
    const f = frame(); f.rows[0]!.textRects = Array.from({ length: 256 }, () => rect());
    expect(evaluateMountedGeometry(f).status).toBe('evaluated'); f.rows[0]!.textRects.push(rect()); invalid(f, 'cardinality-cap');
    f.rows = Array.from({ length: 16 }, (_, i) => ({ ...row(i), textRects: Array.from({ length: 256 }, () => rect()) }));
    expect(evaluateMountedGeometry(f).status).toBe('evaluated'); f.rows.push(row(16)); invalid(f, 'cardinality-cap');
  });
  it('checks clip and aggregate text boundaries without extrapolating identity capacity', () => {
    const clip = { rect: rect(), clipX: false, clipY: false }; const f = frame();
    f.rows[0]!.ancestorClips = Array.from({ length: 32 }, () => clip);
    expect(evaluateMountedGeometry(f).status).toBe('evaluated'); f.rows[0]!.ancestorClips.push(clip); invalid(f, 'cardinality-cap');
    f.rows = Array.from({ length: 128 }, () => ({ ...row(), ancestorClips: Array.from({ length: 32 }, () => clip) }));
    invalid(f, 'duplicate-observation-id'); f.rows[0]!.ancestorClips.push(clip); invalid(f, 'cardinality-cap');
    f.rows = Array.from({ length: 16 }, (_, i) => ({ ...row(i), observedText: 'H'.repeat(8192) }));
    expect(evaluateMountedGeometry(f).status).toBe('evaluated'); f.rows.push({ ...row(16), observedText: 'H' }); invalid(f, 'cardinality-cap');
    f.rows = [{ ...row(), observedText: 'H'.repeat(8193) }]; invalid(f, 'cardinality-cap');
  });
  it('enforces exact canonical lengths, timestamp and owner bounds', () => {
    const f = frame(); f.observedAtPageMs = 360000; f.rows[0]!.ownerToken = 4096;
    expect(evaluateMountedGeometry(f).status).toBe('evaluated'); f.rows[0]!.ownerToken = 4097; invalid(f, 'invalid-presence');
    f.rows[0]!.ownerToken = 1; f.observedAtPageMs = 360001; invalid(f, 'invalid-scalar');
    f.observedAtPageMs = 0; f.expectedHistory[0]!.text = 'H'.repeat(511); invalid(f, 'invalid-ascii');
    f.expectedHistory[0]!.text = 'H'.repeat(512); f.expectedResponse.text = 'R'.repeat(6401); invalid(f, 'invalid-ascii');
  });
  it.each(['history', 'response', 'prefix', 'identity'])('rejects terminal newline in raw %s instead of regex end-anchor acceptance', field => {
    const f = frame();
    if (field === 'history') f.expectedHistory[1]!.text = `${'H'.repeat(511)}\n`;
    if (field === 'response') f.expectedResponse.text = `${'R'.repeat(6399)}\n`;
    if (field === 'prefix') { f.expectedResponse.text = `${'R'.repeat(6399)}\n`; f.responseProgress.prefix = f.expectedResponse.text; }
    if (field === 'identity') f.scopeId = 'scope-1\n';
    invalid(f, field === 'identity' ? 'invalid-scalar' : 'invalid-ascii');
  });
  it('retains at most 32 ordered diagnostics and reports omitted causes', () => {
    const f = frame(); f.rows = Array.from({ length: 40 }, (_, i) => ({ ...row(i), observedText: 'wrong' }));
    const r = evaluateMountedGeometry(f); expect(r.status).toBe('evaluated');
    expect(r.diagnostics).toEqual(Array.from({ length: 32 }, (_, rowIndex) => ({ code: 'text-mismatch', rowIndex })));
    expect(r.omittedDiagnostics).toBe(8); expect(Object.isFrozen(r.diagnostics[0])).toBe(true);
  });
  it('retains the raw full 101-ID profile and owner/clock/identity exact bounds', () => {
    const f = frame(); f.rows = f.expectedHistory.map((_, i) => row(i));
    f.rows.push({ ...row(), id: 'R', role: 'assistant', ownerToken: 101, observedText: 'R' });
    f.scopeId = 'S'.repeat(128); f.observedAtPageMs = 0.5;
    expect(evaluateMountedGeometry(f).rows).toHaveLength(101);
    f.scopeId += 'S'; invalid(f, 'invalid-scalar'); f.scopeId = 'scope-1';
    f.rows[0]!.ownerToken = 1.5; invalid(f, 'invalid-presence');
  });
  it('checks caps before prior scalar defects and duplicates before aliases/unknown IDs', () => {
    const f = frame(); f.clockDomain = 'foreign'; f.rows[0]!.textRects = Array.from({ length: 257 }, () => rect());
    invalid(f, 'cardinality-cap');
    const d = frame(); d.rows = [{ ...row(), id: 'foreign' }, { ...row(), id: 'foreign' }];
    invalid(d, 'duplicate-observation-id');
    d.expectedHistory[1]!.id = 'H0'; invalid(d, 'duplicate-expected-id');
  });
  it('bounds the raw response prefix before its ASCII scan', () => {
    const f = frame(); f.responseProgress.prefix = `${'R'.repeat(6400)}\u00a0`;
    invalid(f, 'invalid-scalar');
  });
});

describe('historical anchor same-context acceptance and closed failure facts', () => {
  it('returns signed displacement and original elapsed with all proof flags false', () => {
    expect(evaluateHistoricalAnchor(pair())).toEqual({ schemaVersion: 1, status: 'accepted', anchorId: 'H0', reason: null,
      elapsedMs: 800, signedDisplacementCssPx: 4, firstOwnerToken: 1, secondOwnerToken: 1, authority: flags });
    const p = pair(); p.second.rows[0]!.textRects[0]!.y = 5;
    expect(evaluateHistoricalAnchor(p).signedDisplacementCssPx).toBe(-5);
  });
  it.each([
    ['order', (p: ReturnType<typeof pair>) => { [p.second.expectedHistory[1], p.second.expectedHistory[2]] = [p.second.expectedHistory[2]!, p.second.expectedHistory[1]!]; }],
    ['history-id', (p: ReturnType<typeof pair>) => { p.second.expectedHistory[1]!.id = 'other'; }],
    ['history-role', (p: ReturnType<typeof pair>) => { p.second.expectedHistory[1]!.role = 'assistant'; }],
    ['history-text', (p: ReturnType<typeof pair>) => { p.second.expectedHistory[1]!.text = 'X'.repeat(512); }],
    ['response-id', (p: ReturnType<typeof pair>) => { p.second.expectedResponse.id = 'other'; }],
    ['response-text', (p: ReturnType<typeof pair>) => { p.first.expectedResponse.text = 'A'.repeat(6400); p.first.responseProgress.prefix = 'A'; p.second.expectedResponse.text = 'B'.repeat(6400); p.second.responseProgress.prefix = 'BB'; }],
    ['raw-projected-equivalent', (p: ReturnType<typeof pair>) => { p.first.expectedHistory[1]!.text = ` A${'X'.repeat(510)}`; p.second.expectedHistory[1]!.text = `A${'X'.repeat(510)} `; }],
  ] as const)('rejects independently valid but different %s context before progress', (_label, mutate) => {
    const p = pair(); mutate(p); expect(evaluateMountedGeometry(p.first).status).toBe('evaluated');
    expect(evaluateMountedGeometry(p.second).status).toBe('evaluated');
    expect(evaluateHistoricalAnchor(p)).toEqual({ schemaVersion: 1, status: 'invalid', anchorId: null, reason: 'context-mismatch',
      elapsedMs: null, signedDisplacementCssPx: null, firstOwnerToken: null, secondOwnerToken: null, authority: flags });
  });
  it('orders frame, scope and context errors ahead of phase/owner/time/progress', () => {
    const p = pair(); p.second.expectedHistory[1]!.text = 'X'.repeat(512); p.second.phase = 'completed';
    p.second.responseProgress = { active: false, prefix: 'R'.repeat(6400) }; p.second.rows[0]!.ownerToken = 2;
    p.second.observedAtPageMs = 0; expect(evaluateHistoricalAnchor(p).reason).toBe('context-mismatch');
    p.second.scopeId = 'scope-2'; expect(evaluateHistoricalAnchor(p).reason).toBe('scope-mismatch');
    p.second.expectedResponse.role = 'user'; expect(evaluateHistoricalAnchor(p).reason).toBe('invalid-frame');
    p.first.viewport.width = 0; expect(evaluateHistoricalAnchor(p).reason).toBe('invalid-frame');
  });
  it.each([
    ['invalid-input', 'invalid', null, null, null, null, (p: ReturnType<typeof pair>) => { p.anchorId = ''; }],
    ['invalid-frame', 'invalid', null, null, null, null, (p: ReturnType<typeof pair>) => { p.second.clockDomain = 'foreign'; }],
    ['unavailable-frame', 'unavailable', null, null, null, null, (p: ReturnType<typeof pair>) => { p.first.viewport.width = 0; }],
    ['scope-mismatch', 'invalid', null, null, null, null, (p: ReturnType<typeof pair>) => { p.second.scopeId = 'other'; }],
    ['wrong-phase', 'unavailable', 'H0', null, null, null, (p: ReturnType<typeof pair>) => { p.second.phase = 'completed'; p.second.responseProgress = { active: false, prefix: 'R'.repeat(6400) }; }],
    ['not-historical-id', 'unavailable', 'R', null, null, null, (p: ReturnType<typeof pair>) => { p.anchorId = 'R'; }],
    ['anchor-not-observed', 'unavailable', 'H0', null, null, null, (p: ReturnType<typeof pair>) => { p.second.rows = []; }],
    ['owner-changed', 'unavailable', 'H0', null, 1, 2, (p: ReturnType<typeof pair>) => { p.second.rows[0]!.ownerToken = 2; }],
    ['anchor-geometry-unavailable', 'unavailable', 'H0', null, 1, 1, (p: ReturnType<typeof pair>) => { p.second.rows[0]!.observedText = 'wrong'; }],
    ['reversed-time', 'invalid', null, null, null, null, (p: ReturnType<typeof pair>) => { p.first.observedAtPageMs = 900; }],
    ['interval-too-short', 'unavailable', 'H0', 799, 1, 1, (p: ReturnType<typeof pair>) => { p.second.observedAtPageMs = 799; }],
    ['producer-not-active', 'unavailable', 'H0', 800, 1, 1, (p: ReturnType<typeof pair>) => { p.first.responseProgress.active = false; }],
    ['prefix-not-advanced', 'unavailable', 'H0', 800, 1, 1, (p: ReturnType<typeof pair>) => { p.second.responseProgress.prefix = 'R'; }],
  ] as const)('retains exactly the closed facts for %s', (reason, status, anchorId, elapsedMs, firstOwnerToken, secondOwnerToken, mutate) => {
    const p = pair(); mutate(p); expect(evaluateHistoricalAnchor(p)).toEqual({ schemaVersion: 1, status, anchorId, reason,
      elapsedMs, signedDisplacementCssPx: null, firstOwnerToken, secondOwnerToken, authority: flags });
  });
  it('does not expose one-sided owners, zero elapsed drift, or caller evaluation flags', () => {
    const p = pair(); p.second.rows[0] = { ...row(), presence: 'unmounted', ownerToken: null, observedText: '', textRects: [], ancestorClips: [] };
    expect(evaluateHistoricalAnchor(p)).toMatchObject({ reason: 'anchor-not-observed', firstOwnerToken: null, secondOwnerToken: null });
    const z = pair(); z.second.observedAtPageMs = 0; expect(evaluateHistoricalAnchor(z)).toMatchObject({ reason: 'interval-too-short', elapsedMs: 0, signedDisplacementCssPx: null });
    expect(evaluateHistoricalAnchor({ ...pair(), first: { status: 'evaluated', eligible: true } }).reason).toBe('invalid-frame');
  });
});
