/** Supplied-data math only: never DOM, glyph, frame or scoring authority. */
export const GEOMETRY_LIMITS = Object.freeze({ history: 100, historyText: 512, responseText: 6400, rows: 128,
  textRectsPerRow: 256, textRects: 4096, ancestorClipsPerRow: 32, ancestorClips: 4096, rectangles: 8194,
  observedTextPerRow: 8192, observedText: 131072, ownerToken: 4096, identityLength: 128,
  coordinate: 1000000, observedAtPageMs: 360000, diagnostics: 32, anchorIntervalMs: 800 });
export type MessageRole = 'user' | 'assistant';
export type GeometryPhase = 'restored-history' | 'streaming' | 'completed';
export type RowPresence = 'mounted' | 'unmounted' | 'unavailable';
export type GeometryRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type GeometryClip = Readonly<{ rect: GeometryRect; clipX: boolean; clipY: boolean }>;
export type ExpectedGeometryMessage = Readonly<{ id: string; role: MessageRole; text: string }>;
export type GeometryObservation = Readonly<{ id: string; role: MessageRole; presence: RowPresence; ownerToken: number | null;
  observedText: string; textRects: readonly GeometryRect[]; ancestorClips: readonly GeometryClip[] }>;
export type MountedGeometryInput = Readonly<{ schemaVersion: 1; scopeId: string; clockDomain: 'page-performance-ms'; observedAtPageMs: number;
  phase: GeometryPhase; expectedHistory: readonly ExpectedGeometryMessage[]; expectedResponse: ExpectedGeometryMessage;
  responseProgress: Readonly<{ active: boolean; prefix: string }>; viewport: GeometryRect; nativeViewport: GeometryRect;
  rows: readonly GeometryObservation[] }>;
export type RowReason = 'unmounted' | 'unavailable-observation' | 'empty-text' | 'text-mismatch' | 'no-positive-text-rects' | 'fully-clipped';
export type GlobalGeometryReason = 'invalid-shape' | 'cardinality-cap' | 'invalid-scalar' | 'invalid-rect' | 'invalid-ascii' |
  'invalid-presence' | 'duplicate-expected-id' | 'duplicate-observation-id' | 'duplicate-owner-token' | 'unknown-observation-id' |
  'role-mismatch' | 'response-before-continuation';
export type GeometryDiagnostic = Readonly<{ code: GlobalGeometryReason | RowReason | 'unavailable-viewport'; rowIndex: number | null }>;
export type GeometryAuthority = Readonly<{ input: 'supplied-data'; nativeDOMQualified: false; visibleGlyphProof: false; presentationProof: false; scoringEligibility: false }>;
export type EvaluatedGeometryRow = Readonly<{ id: string; role: MessageRole; presence: RowPresence; ownerToken: number | null;
  textRelation: 'exact' | 'canonical-prefix' | 'mismatch' | 'not-evaluated'; geometryEligibility: 'eligible' | 'ineligible' | 'unavailable';
  reason: RowReason | null; clippedTextRects: readonly GeometryRect[]; contentTopCssPx: number | null; relativeTopCssPx: number | null }>;
export type GeometryEvaluation = Readonly<{ schemaVersion: 1; status: 'evaluated' | 'unavailable' | 'invalid'; scopeId: string | null;
  phase: GeometryPhase | null; observedAtPageMs: number | null; rows: readonly EvaluatedGeometryRow[];
  diagnostics: readonly GeometryDiagnostic[]; omittedDiagnostics: number; authority: GeometryAuthority }>;
export type AnchorReason = 'invalid-input' | 'invalid-frame' | 'unavailable-frame' | 'scope-mismatch' | 'context-mismatch' | 'wrong-phase' |
  'not-historical-id' | 'anchor-not-observed' | 'owner-changed' | 'anchor-geometry-unavailable' | 'reversed-time' | 'interval-too-short' |
  'producer-not-active' | 'prefix-not-advanced';
export type HistoricalAnchorInput = Readonly<{ schemaVersion: 1; anchorId: string; first: MountedGeometryInput; second: MountedGeometryInput }>;
export type HistoricalAnchorEvaluation = Readonly<{ schemaVersion: 1; status: 'accepted' | 'unavailable' | 'invalid'; anchorId: string | null;
  reason: AnchorReason | null; elapsedMs: number | null; signedDisplacementCssPx: number | null;
  firstOwnerToken: number | null; secondOwnerToken: number | null; authority: GeometryAuthority }>;
type RecordData = Record<string, unknown>;
class InvalidData extends Error { readonly code:GlobalGeometryReason;constructor(code: GlobalGeometryReason) { super(code);this.code=code; } }
const fail = (code: GlobalGeometryReason): never => { throw new InvalidData(code); };
const authority = (): GeometryAuthority => ({ input: 'supplied-data', nativeDOMQualified: false, visibleGlyphProof: false, presentationProof: false, scoringEligibility: false });
function freeze<T>(owned: T): T {
  if (typeof owned === 'object' && owned !== null) { for (const value of Object.values(owned)) freeze(value); Object.freeze(owned); }
  return owned;
}
// Read only own data descriptors; never invoke supplied getters or iterators.
function record(input: unknown, keys: readonly string[]): RecordData {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail('invalid-shape');
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return fail('invalid-shape');
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== keys.length || ownKeys.some(k => typeof k !== 'string' || !keys.includes(k))) return fail('invalid-shape');
  const copy: RecordData = Object.create(null) as RecordData;
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) return fail('invalid-shape'); copy[key] = descriptor.value as unknown; }
  return copy;
}
function array(input: unknown, cap: number, exact?: number): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return fail('invalid-shape');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (!descriptor || !('value' in descriptor)) return fail('invalid-shape');
  const length = descriptor.value as unknown;
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) return fail('invalid-shape');
  if (length > cap || (exact !== undefined && length !== exact)) return fail('cardinality-cap');
  if (Reflect.ownKeys(input).length !== length + 1) return fail('invalid-shape');
  const copy: unknown[] = [];
  for (let i = 0; i < length; i++) { const entry = Object.getOwnPropertyDescriptor(input, String(i));
    if (!entry || !('value' in entry)) return fail('invalid-shape'); copy.push(entry.value as unknown); }
  return copy;
}
function identity(input: unknown): string {
  if (typeof input !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(input)) return fail('invalid-scalar'); return input;
}
function role(input: unknown): MessageRole {
  if (input !== 'user' && input !== 'assistant') return fail('invalid-scalar'); return input;
}
function ascii(input: unknown, length?: number, whitespace = false): string {
  if (typeof input !== 'string' || (length !== undefined && input.length !== length) ||
    !(whitespace ? /^[\x09-\x0d\x20-\x7e]*$/ : /^[\x20-\x7e]*$/).test(input)) return fail('invalid-ascii'); return input;
}
export const projectGeometryText = (text: string): string => text.replace(/[\x09-\x0d\x20]+/g, ' ').replace(/^ +| +$/g, '');
function rectangle(input: unknown): GeometryRect {
  const r = record(input, ['x', 'y', 'width', 'height']);
  for (const key of ['x', 'y', 'width', 'height']) if (typeof r[key] !== 'number' || !Number.isFinite(r[key])) return fail('invalid-rect');
  const x = r.x as number, y = r.y as number, width = r.width as number, height = r.height as number;
  if (Math.abs(x) > GEOMETRY_LIMITS.coordinate || Math.abs(y) > GEOMETRY_LIMITS.coordinate || width < 0 || height < 0 ||
      width > GEOMETRY_LIMITS.coordinate || height > GEOMETRY_LIMITS.coordinate || !Number.isFinite(x + width) || !Number.isFinite(y + height)) return fail('invalid-rect');
  return { x, y, width, height };
}
function message(r: RecordData, textLength: number): ExpectedGeometryMessage {
  return { id: identity(r.id), role: role(r.role), text: ascii(r.text, textLength) };
}
function parse(input: unknown): MountedGeometryInput {
  const r = record(input, ['schemaVersion', 'scopeId', 'clockDomain', 'observedAtPageMs', 'phase', 'expectedHistory', 'expectedResponse', 'responseProgress', 'viewport', 'nativeViewport', 'rows']);
  const history = array(r.expectedHistory, GEOMETRY_LIMITS.history, GEOMETRY_LIMITS.history).map(item => record(item, ['id', 'role', 'text']));
  const response = record(r.expectedResponse, ['id', 'role', 'text']), progress = record(r.responseProgress, ['active', 'prefix']);
  // Preflight every bounded collection before scalar/identity validation.
  let totalRects = 0, totalClips = 0, totalText = 0;
  const rows = array(r.rows, GEOMETRY_LIMITS.rows).map(item => {
    const row = record(item, ['id', 'role', 'presence', 'ownerToken', 'observedText', 'textRects', 'ancestorClips']);
    const textRects = array(row.textRects, GEOMETRY_LIMITS.textRectsPerRow);
    const ancestorClips = array(row.ancestorClips, GEOMETRY_LIMITS.ancestorClipsPerRow).map(c => record(c, ['rect', 'clipX', 'clipY']));
    totalRects += textRects.length; totalClips += ancestorClips.length;
    if (typeof row.observedText === 'string') {
      if (row.observedText.length > GEOMETRY_LIMITS.observedTextPerRow) return fail('cardinality-cap'); totalText += row.observedText.length; }
    if (totalRects > GEOMETRY_LIMITS.textRects || totalClips > GEOMETRY_LIMITS.ancestorClips || totalRects + totalClips + 2 > GEOMETRY_LIMITS.rectangles || totalText > GEOMETRY_LIMITS.observedText) return fail('cardinality-cap');
    return { row, textRects, ancestorClips };
  });
  if (r.schemaVersion !== 1 || r.clockDomain !== 'page-performance-ms' || typeof r.observedAtPageMs !== 'number' ||
      !Number.isFinite(r.observedAtPageMs) || r.observedAtPageMs < 0 || r.observedAtPageMs > GEOMETRY_LIMITS.observedAtPageMs ||
      (r.phase !== 'restored-history' && r.phase !== 'streaming' && r.phase !== 'completed')) return fail('invalid-scalar');
  const expectedHistory = history.map(h => message(h, GEOMETRY_LIMITS.historyText));
  const expectedResponse = message(response, GEOMETRY_LIMITS.responseText);
  if (expectedResponse.role !== 'assistant') return fail('invalid-scalar');
  if (typeof progress.prefix === 'string' && progress.prefix.length > GEOMETRY_LIMITS.responseText) return fail('invalid-scalar');
  const prefix = ascii(progress.prefix);
  if (typeof progress.active !== 'boolean' || prefix.length > GEOMETRY_LIMITS.responseText || !expectedResponse.text.startsWith(prefix) ||
      (r.phase === 'restored-history' && (progress.active || prefix !== '')) ||
      (r.phase === 'completed' && (progress.active || prefix !== expectedResponse.text))) return fail('invalid-scalar');
  const result: MountedGeometryInput = { schemaVersion: 1, scopeId: identity(r.scopeId), clockDomain: 'page-performance-ms', observedAtPageMs: r.observedAtPageMs,
    phase: r.phase, expectedHistory, expectedResponse, responseProgress: { active: progress.active, prefix }, viewport: rectangle(r.viewport), nativeViewport: rectangle(r.nativeViewport),
    rows: rows.map(({ row, textRects, ancestorClips }) => {
      if (row.presence !== 'mounted' && row.presence !== 'unmounted' && row.presence !== 'unavailable') return fail('invalid-presence');
      const text = ascii(row.observedText, undefined, true);
      if (row.presence === 'mounted') { if (typeof row.ownerToken !== 'number' || !Number.isInteger(row.ownerToken) || row.ownerToken < 1 || row.ownerToken > GEOMETRY_LIMITS.ownerToken) return fail('invalid-presence'); }
      else if (row.ownerToken !== null || text !== '' || textRects.length !== 0 || ancestorClips.length !== 0) return fail('invalid-presence');
      return { id: identity(row.id), role: role(row.role), presence: row.presence, ownerToken: row.ownerToken as number | null, observedText: text,
        textRects: textRects.map(rectangle), ancestorClips: ancestorClips.map(c => {
          if (typeof c.clipX !== 'boolean' || typeof c.clipY !== 'boolean') return fail('invalid-scalar'); return { rect: rectangle(c.rect), clipX: c.clipX, clipY: c.clipY }; }) };
    }) };
  const known = new Map<string, ExpectedGeometryMessage>();
  for (const m of [...expectedHistory, expectedResponse]) { if (known.has(m.id)) return fail('duplicate-expected-id'); known.set(m.id, m); }
  const ids = new Set<string>();
  for (const row of result.rows) { if (ids.has(row.id)) return fail('duplicate-observation-id'); ids.add(row.id); }
  const owners = new Set<number>();
  for (const row of result.rows) if (row.ownerToken !== null) { if (owners.has(row.ownerToken)) return fail('duplicate-owner-token'); owners.add(row.ownerToken); }
  if (result.rows.some(row => !known.has(row.id))) return fail('unknown-observation-id');
  if (result.rows.some(row => row.role !== known.get(row.id)!.role)) return fail('role-mismatch');
  if (result.phase === 'restored-history' && result.rows.some(row => row.id === expectedResponse.id)) return fail('response-before-continuation');
  return result;
}
const positive = (r: GeometryRect): boolean => r.width > 0 && r.height > 0;
function intersect(source: GeometryRect, bound: GeometryRect, clipX = true, clipY = true): GeometryRect | null {
  const x = clipX ? Math.max(source.x, bound.x) : source.x, y = clipY ? Math.max(source.y, bound.y) : source.y;
  const right = clipX ? Math.min(source.x + source.width, bound.x + bound.width) : source.x + source.width;
  const bottom = clipY ? Math.min(source.y + source.height, bound.y + bound.height) : source.y + source.height;
  return right <= x || bottom <= y ? null : { x, y, width: right - x, height: bottom - y };
}
function evaluateRow(row: GeometryObservation, frame: Pick<MountedGeometryInput,'viewport'|'nativeViewport'>, known: ExpectedGeometryMessage,streamingResponse=false): EvaluatedGeometryRow {
  const base = { id: row.id, role: row.role, presence: row.presence, ownerToken: row.ownerToken };
  if (row.presence !== 'mounted') return { ...base, textRelation: 'not-evaluated', geometryEligibility: 'unavailable', reason: row.presence === 'unmounted' ? 'unmounted' : 'unavailable-observation', clippedTextRects: [], contentTopCssPx: null, relativeTopCssPx: null };
  const originals = row.textRects.filter(positive); let contentTopCssPx: number | null = null;
  const clippedTextRects: GeometryRect[] = [];
  for (const source of originals) {
    contentTopCssPx = contentTopCssPx === null ? source.y : Math.min(contentTopCssPx, source.y);
    let clipped = intersect(source, frame.viewport); if (clipped) clipped = intersect(clipped, frame.nativeViewport);
    for (const ancestor of row.ancestorClips) { if (!clipped) break; clipped = intersect(clipped, ancestor.rect, ancestor.clipX, ancestor.clipY); }
    if (clipped) clippedTextRects.push(clipped);
  }
  const observed = projectGeometryText(row.observedText), canonical = projectGeometryText(known.text);
  const conforms = streamingResponse ? canonical.startsWith(observed) : canonical === observed;
  const reason: RowReason | null = !observed ? 'empty-text' : !conforms ? 'text-mismatch' : !originals.length ? 'no-positive-text-rects' : !clippedTextRects.length ? 'fully-clipped' : null;
  return { ...base, textRelation: !observed ? 'not-evaluated' : !conforms ? 'mismatch' : streamingResponse ? 'canonical-prefix' : 'exact', geometryEligibility: reason === null ? 'eligible' : 'ineligible', reason,
    clippedTextRects, contentTopCssPx, relativeTopCssPx: contentTopCssPx === null ? null : contentTopCssPx - frame.nativeViewport.y };
}
/** One bounded historical row, with the exact full-frame text/clip metric. */
export function evaluateSelectedGeometryRow(input:unknown,expected:unknown,viewport:unknown,nativeViewport:unknown):EvaluatedGeometryRow {
 const r=record(input,['id','role','presence','ownerToken','observedText','textRects','ancestorClips']);
 if(typeof r.observedText!=='string'||r.observedText.length>GEOMETRY_LIMITS.observedTextPerRow)return fail('cardinality-cap');
 const k=record(expected,['id','role','text']),known=message(k,GEOMETRY_LIMITS.historyText);
 const rects=array(r.textRects,GEOMETRY_LIMITS.textRectsPerRow).map(rectangle);
 const clips=array(r.ancestorClips,GEOMETRY_LIMITS.ancestorClipsPerRow).map(value=>{const c=record(value,['rect','clipX','clipY']);if(typeof c.clipX!=='boolean'||typeof c.clipY!=='boolean')return fail('invalid-scalar');return {rect:rectangle(c.rect),clipX:c.clipX,clipY:c.clipY};});
 if(r.id!==known.id||r.role!==known.role||r.presence!=='mounted'||typeof r.ownerToken!=='number'||!Number.isInteger(r.ownerToken)||r.ownerToken<1||r.ownerToken>GEOMETRY_LIMITS.ownerToken)return fail('invalid-scalar');
 const text=ascii(r.observedText,undefined,true);
 const v=rectangle(viewport),n=rectangle(nativeViewport);if(!positive(v)||!positive(n))return fail('invalid-rect');
 return freeze(evaluateRow({id:known.id,role:known.role,presence:'mounted',ownerToken:r.ownerToken,observedText:text,textRects:rects,ancestorClips:clips},{viewport:v,nativeViewport:n},known));
}
function invalidGeometry(code: GlobalGeometryReason): GeometryEvaluation {
  return freeze({ schemaVersion: 1, status: 'invalid', scopeId: null, phase: null, observedAtPageMs: null, rows: [], diagnostics: [{ code, rowIndex: null }], omittedDiagnostics: 0, authority: authority() });
}
function evaluateParsed(frame: MountedGeometryInput): GeometryEvaluation {
  const scoped = { schemaVersion: 1 as const, scopeId: frame.scopeId, phase: frame.phase, observedAtPageMs: frame.observedAtPageMs, authority: authority() };
  if (!positive(frame.viewport) || !positive(frame.nativeViewport)) return freeze({ ...scoped, status: 'unavailable', rows: [], diagnostics: [{ code: 'unavailable-viewport', rowIndex: null }], omittedDiagnostics: 0 });
  const known = new Map([...frame.expectedHistory, frame.expectedResponse].map(m => [m.id, m]));
  const diagnostics: GeometryDiagnostic[] = []; let omittedDiagnostics = 0;
  const rows = frame.rows.map((row, rowIndex) => { const evaluated = evaluateRow(row, frame, known.get(row.id)!,row.id===frame.expectedResponse.id&&frame.phase==='streaming');
    if (evaluated.reason !== null) { if (diagnostics.length < GEOMETRY_LIMITS.diagnostics) diagnostics.push({ code: evaluated.reason, rowIndex }); else omittedDiagnostics++; }
    return evaluated; });
  return freeze({ ...scoped, status: 'evaluated', rows, diagnostics, omittedDiagnostics });
}
export function evaluateMountedGeometry(input: unknown): GeometryEvaluation {
  try { return evaluateParsed(parse(input)); } catch (error) { return invalidGeometry(error instanceof InvalidData ? error.code : 'invalid-shape'); }
}
function anchorResult(status: HistoricalAnchorEvaluation['status'], reason: AnchorReason | null,
  facts: Partial<Pick<HistoricalAnchorEvaluation, 'anchorId' | 'elapsedMs' | 'signedDisplacementCssPx' | 'firstOwnerToken' | 'secondOwnerToken'>> = {}): HistoricalAnchorEvaluation {
  return freeze({ schemaVersion: 1, status, reason, anchorId: null, elapsedMs: null, signedDisplacementCssPx: null, firstOwnerToken: null, secondOwnerToken: null, ...facts, authority: authority() });
}
function sameMessage(a: ExpectedGeometryMessage, b: ExpectedGeometryMessage): boolean { return a.id === b.id && a.role === b.role && a.text === b.text; }
export function evaluateHistoricalAnchor(input: unknown): HistoricalAnchorEvaluation {
  let raw: RecordData, anchorId: string;
  try { raw = record(input, ['schemaVersion', 'anchorId', 'first', 'second']); if (raw.schemaVersion !== 1) return anchorResult('invalid', 'invalid-input'); anchorId = identity(raw.anchorId); }
  catch { return anchorResult('invalid', 'invalid-input'); }
  let first: MountedGeometryInput, second: MountedGeometryInput;
  try { first = parse(raw.first); second = parse(raw.second); } catch { return anchorResult('invalid', 'invalid-frame'); }
  const a = evaluateParsed(first), b = evaluateParsed(second);
  if (a.status === 'unavailable' || b.status === 'unavailable') return anchorResult('unavailable', 'unavailable-frame');
  if (first.scopeId !== second.scopeId) return anchorResult('invalid', 'scope-mismatch');
  if (!first.expectedHistory.every((m, i) => sameMessage(m, second.expectedHistory[i]!)) || !sameMessage(first.expectedResponse, second.expectedResponse)) return anchorResult('invalid', 'context-mismatch');
  if (first.phase !== 'streaming' || second.phase !== 'streaming') return anchorResult('unavailable', 'wrong-phase', { anchorId });
  if (!first.expectedHistory.some(m => m.id === anchorId)) return anchorResult('unavailable', 'not-historical-id', { anchorId });
  const firstRow = a.rows.find(row => row.id === anchorId), secondRow = b.rows.find(row => row.id === anchorId);
  if (!firstRow || !secondRow || firstRow.presence !== 'mounted' || secondRow.presence !== 'mounted') return anchorResult('unavailable', 'anchor-not-observed', { anchorId });
  const owners = { anchorId, firstOwnerToken: firstRow.ownerToken, secondOwnerToken: secondRow.ownerToken };
  if (firstRow.ownerToken !== secondRow.ownerToken) return anchorResult('unavailable', 'owner-changed', owners);
  if (firstRow.geometryEligibility !== 'eligible' || secondRow.geometryEligibility !== 'eligible') return anchorResult('unavailable', 'anchor-geometry-unavailable', owners);
  if (second.observedAtPageMs < first.observedAtPageMs) return anchorResult('invalid', 'reversed-time');
  const elapsedMs = second.observedAtPageMs - first.observedAtPageMs, timed = { ...owners, elapsedMs };
  if (elapsedMs < GEOMETRY_LIMITS.anchorIntervalMs) return anchorResult('unavailable', 'interval-too-short', timed);
  if (!first.responseProgress.active || !second.responseProgress.active) return anchorResult('unavailable', 'producer-not-active', timed);
  if (second.responseProgress.prefix.length <= first.responseProgress.prefix.length) return anchorResult('unavailable', 'prefix-not-advanced', timed);
  return anchorResult('accepted', null, { ...timed, signedDisplacementCssPx: secondRow.relativeTopCssPx! - firstRow.relativeTopCssPx! });
}
