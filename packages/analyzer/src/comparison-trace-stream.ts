/** Private opt-in consumer. Legacy JsonAdmission and its default budgets are unchanged. */
export const STREAMED_TRACE_POLICY = 'streamed-renderer-events-v1' as const;
export const TRACKER_JSON_A_POLICY = 'streamed-tracker-json-a-v1' as const;
type ScanProfile = typeof STREAMED_TRACE_POLICY | typeof TRACKER_JSON_A_POLICY;
export interface TrackerNumberToken {slot: 'ts' | 'pid' | 'tid' | 'expected' | 'dropped_v3' | 'dropped_v4'; lexeme: string; startUtf8: number; endUtf8: number}
export interface TrackerJsonRecord {eventIndex: number; startUtf8: number; endUtf8: number; rawJson: string; event: Record<string, unknown>; numberTokens: TrackerNumberToken[]}
export interface ComparisonTraceLoadOptions {tracePolicy?: typeof STREAMED_TRACE_POLICY}
export function selectComparisonTracePolicy(options: ComparisonTraceLoadOptions): typeof STREAMED_TRACE_POLICY | undefined {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'tracePolicy')) throw new Error('Unknown comparison trace policy options');
  const policy = options.tracePolicy;
  if (policy !== undefined && policy !== STREAMED_TRACE_POLICY) throw new Error('Unknown comparison trace policy');
  return policy;
}
export interface TraceScanFailure {
  kind: 'malformed' | 'admission-limit'; reason: string; limitName: 'jsonWorkUnits' | 'eventWorkUnits' | 'eventBytes' | 'selectedEventBytes' | 'selectedWorkUnits' | 'selectedEvents' | 'jsonDepth' | 'traceEvents' | 'rawKeyTokenBytes' | 'decodedKeyBytes' | 'objectKeys' | 'activeKeys' | 'activeKeyBytes' | 'numberTokenBytes' | null;
  limit: number | null; observed: number | null; utf8Byte: number;
  offsetMeaning: 'scanner-event-position' | 'last-fully-scanned-prefix';
}
export interface TraceScanTotals {
  byteLength: number; analyzerWorkUnits: number; capturePrimitiveTokens: number;
  maximumDepth: number; traceEventCount: number;
}
export interface TraceAdmissionStatistics {
  policy: ScanProfile; scannerCompletion: 'not-started' | 'stopped' | 'eof-finished';
  physicalClosure: 'verified' | 'unverified';
  completeTotals: TraceScanTotals | null;
  observedPrefix: {scannedUtf8Bytes: number; workUnits: number; traceEvents: number; maximumDepth: number; retainedBytes: number; retainedWork: number; retainedEvents: number} | null;
  legacyWorkThreshold: {status: 'crossed'; observed: number; utf8Byte: number} | {status: 'not-crossed-complete' | 'unknown-not-observed'};
  firstFailure: TraceScanFailure | null;
}
const streamedFailures = new WeakSet<object>();
export class StreamedTraceFailure extends Error {
  constructor(readonly failure: TraceScanFailure) {super(failure.reason); streamedFailures.add(this);}
}
export function isStreamedTraceFailure(value: unknown): value is StreamedTraceFailure {
  return (typeof value === 'object' && value !== null || typeof value === 'function') && streamedFailures.has(value);
}
type Frame = {kind: 'object' | 'array'; depth: number; state: 'key-or-end' | 'key' | 'colon' | 'value-or-end' | 'value' | 'waiting' | 'comma-or-end'; keys: Set<string>; keyBytes: number; key: string | null; traceArray: boolean; trackerKind: 'event' | 'args' | 'terminalArgs' | 'terminalData' | null};
const lifecycleNames = new Set(['FrameCommittedInBrowser', 'CommitLoad', 'navigationStart', 'FrameDeletedInBrowser', 'ProcessReadyInBrowser', 'RenderFrameHostImpl::DidCommitSameDocumentNavigation']);
const selected = (name: string) => name === 'TracingStartedInBrowser' || name === 'thread_name'
  || name === 'AnimationFrame' || name === 'AnimationFrame::Presentation' || lifecycleNames.has(name) || name.startsWith('bench:comparison:');
const whitespace = (c: string) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
const width = (c: string) => {const n = c.codePointAt(0)!; return n <= 127 ? 1 : n <= 2047 ? 2 : n <= 65535 ? 3 : 4;};

export class StreamedTraceAdmission {
  constructor(private readonly profile: ScanProfile = STREAMED_TRACE_POLICY) {
    if (profile !== STREAMED_TRACE_POLICY && profile !== TRACKER_JSON_A_POLICY) throw new Error('Unknown streamed trace profile');
  }
  private decoder = new TextDecoder('utf8', {fatal: true, ignoreBOM: true});
  private frames: Frame[] = []; private token: 'key' | 'string' | 'number' | 'literal' | null = null;
  private escaped = false; private unicode = 0; private keyText = ''; private keyRawBytes = 0;
  private number = ''; private literal = ''; private literalIndex = 0;
  private started = false; private complete = false; private traceSeen = false; private disposed = false; private fed = false;
  private offset = 0; private work = 0; private tokens = 0; private depth = 0; private events = 0;
  private liveKeys = 0; private liveKeyBytes = 0;
  private staging: string | null = null; private stagedBytes = 0; private eventWorkStart = 0;
  private retainedBytes = 0; private retainedWork = 0; private retainedCount = 0;
  private records: Record<string, unknown>[] = [];
  private tracker: TrackerJsonRecord[] = []; private eventStart = 0; private eventExtraWork = 0;
  private eventNumbers: TrackerNumberToken[] = []; private numberStart = 0; private numberSlot: TrackerNumberToken['slot'] | null = null;
  private completion: TraceAdmissionStatistics['scannerCompletion'] = 'not-started';
  private totals: TraceScanTotals | null = null; private failure: TraceScanFailure | null = null;
  private crossing: {status: 'crossed'; observed: number; utf8Byte: number} | null = null;
  private fail(reason: string, limitName: TraceScanFailure['limitName'] = null, observed: number | null = null, limit: number | null = null, offsetMeaning: TraceScanFailure['offsetMeaning'] = 'scanner-event-position'): never {
    const failure: TraceScanFailure = {kind: limitName === null ? 'malformed' : 'admission-limit', reason: `${reason} at UTF8 byte ${this.offset}`, limitName, observed, limit, utf8Byte: this.offset, offsetMeaning};
    this.failure ??= failure; this.completion = 'stopped'; this.totals = null;
    throw new StreamedTraceFailure(this.failure);
  }
  private limit(name: NonNullable<TraceScanFailure['limitName']>, observed: number, maximum: number) {
    if (observed > maximum) this.fail(`${name} exceeded`, name, observed, maximum);
  }
  private charge(tokens: number) {
    this.work++; this.tokens += tokens;
    if (!this.crossing && this.work > 8388608) this.crossing = {status: 'crossed', observed: this.work, utf8Byte: this.offset};
    this.limit('jsonWorkUnits', this.work, 16777216);
    if (this.staging !== null) this.limit('eventWorkUnits', this.work - this.eventWorkStart, 65536);
  }
  private pop() {
    const frame = this.frames.pop()!; this.liveKeys -= frame.keys.size; this.liveKeyBytes -= frame.keyBytes;
  }
  private finishValue() {
    const parent = this.frames.at(-1);
    if (parent) {parent.state = 'comma-or-end'; parent.key = null;} else this.complete = true;
    if (parent?.traceArray && this.staging !== null) {
      const value: unknown = JSON.parse(this.staging);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) this.fail('Malformed generic trace event object');
      const event = value as Record<string, unknown>;
      if (typeof event['name'] !== 'string' || !event['name'].trim() || typeof event['ph'] !== 'string' || !event['ph'].trim()) this.fail('Malformed generic trace event name/ph');
      if (selected(event['name']) || this.profile === TRACKER_JSON_A_POLICY && (event['name'].startsWith('FrameSequenceTracker') || ['Frame', 'Frame ', 'Frame   '].includes(event['name']))) {
        const work = this.work - this.eventWorkStart + (this.profile === TRACKER_JSON_A_POLICY ? this.eventExtraWork + 1 : 0);
        this.limit('selectedEventBytes', this.retainedBytes + this.stagedBytes, 16 * 1024 * 1024);
        this.limit('selectedWorkUnits', this.retainedWork + work, 2097152);
        this.limit('selectedEvents', this.retainedCount + 1, 65536);
        this.retainedBytes += this.stagedBytes; this.retainedWork += work; this.retainedCount++; this.records.push(event);
        if (this.profile === TRACKER_JSON_A_POLICY) this.tracker.push({eventIndex: this.events - 1, startUtf8: this.eventStart, endUtf8: this.offset, rawJson: this.staging, event, numberTokens: this.eventNumbers});
      }
      this.staging = null; this.stagedBytes = 0; this.eventNumbers = []; this.eventExtraWork = 0;
    }
  }
  private beginValue(c: string) {
    const parent = this.frames.at(-1), depth = parent ? parent.depth + 1 : 0;
    this.limit('jsonDepth', depth, 64); this.depth = Math.max(this.depth, depth);
    if (!parent) {if (this.started) this.fail('Trailing JSON value'); this.started = true; if (c !== '{') this.fail('Trace root must be an object');}
    if (parent?.traceArray) {
      this.events++; this.limit('traceEvents', this.events, 1048576);
      if (c !== '{') this.fail('Malformed generic trace event object');
      this.staging = c; this.stagedBytes = width(c); this.eventWorkStart = this.work;
      this.eventStart = this.offset - width(c); this.eventNumbers = []; this.eventExtraWork = 0;
    }
    const traceArray = parent?.kind === 'object' && parent.depth === 0 && parent.key === 'traceEvents';
    if (traceArray) {if (c !== '[') this.fail('Top-level traceEvents must be an array'); this.traceSeen = true;}
    if (parent) parent.state = 'waiting';
    if (c === '{' || c === '[') {
      const trackerKind: Frame['trackerKind'] = c !== '{' || this.profile !== TRACKER_JSON_A_POLICY ? null : parent?.traceArray ? 'event'
        : parent?.kind !== 'object' ? null : parent.trackerKind === 'event' && parent.key === 'args' ? 'args'
        : parent.trackerKind === 'args' && parent.key === 'args' ? 'terminalArgs'
        : parent.trackerKind === 'terminalArgs' && parent.key === 'data' ? 'terminalData' : null;
      this.charge(2); this.frames.push({kind: c === '{' ? 'object' : 'array', depth, state: c === '{' ? 'key-or-end' : 'value-or-end', keys: new Set(), keyBytes: 0, key: null, traceArray: !!traceArray, trackerKind});
    } else if (c === '"') {this.charge(2); this.token = 'string'; this.escaped = false; this.unicode = 0;}
    else if (c === '-' || /^[0-9]$/.test(c)) {
      this.charge(2); this.token = 'number'; this.number = c; this.numberStart = this.offset - width(c);
      const key = parent?.key;
      this.numberSlot = parent?.trackerKind === 'event' && (key === 'ts' || key === 'pid' || key === 'tid') ? key
        : parent?.trackerKind === 'terminalData' && (key === 'expected' || key === 'dropped_v3' || key === 'dropped_v4') ? key : null;
    }
    else if (c === 't' || c === 'f' || c === 'n') {this.charge(c === 'n' ? 1 : 2); this.token = 'literal'; this.literal = c === 't' ? 'true' : c === 'f' ? 'false' : 'null'; this.literalIndex = 1;}
    else this.fail('Invalid JSON value');
  }
  private endNumber(endUtf8 = this.offset) {
    if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(this.number)) this.fail('Invalid JSON number');
    if (!Number.isFinite(Number(this.number))) this.fail('Nonfinite JSON number');
    if (this.numberSlot !== null) {
      this.limit('selectedWorkUnits', this.retainedWork + this.eventExtraWork + 1, 2097152); this.eventExtraWork++;
      this.eventNumbers.push({slot: this.numberSlot, lexeme: this.number, startUtf8: this.numberStart, endUtf8});
    }
    this.numberSlot = null;
    this.number = ''; this.token = null; this.finishValue();
  }
  private character(c: string) {
    if (this.token === 'string' || this.token === 'key') {
      if (this.token === 'key') {this.limit('rawKeyTokenBytes', this.keyRawBytes + width(c), 16384); this.keyRawBytes += width(c); this.keyText += c;}
      if (this.unicode) {if (!/^[a-fA-F0-9]$/.test(c)) this.fail('Invalid JSON Unicode escape'); this.unicode--; return;}
      if (this.escaped) {this.escaped = false; if (c === 'u') this.unicode = 4; else if (!'"\\/bfnrt'.includes(c)) this.fail('Invalid JSON escape'); return;}
      if (c === '\\') {this.escaped = true; return;}
      if (c === '"') {
        if (this.token === 'key') {
          const key: string = JSON.parse(this.keyText), bytes = Buffer.byteLength(key), frame = this.frames.at(-1)!;
          this.limit('decodedKeyBytes', bytes, 8192);
          if (frame.keys.has(key)) this.fail('Duplicate decoded key');
          this.limit('objectKeys', frame.keys.size + 1, 4096); this.limit('activeKeys', this.liveKeys + 1, 65536); this.limit('activeKeyBytes', this.liveKeyBytes + bytes, 1048576);
          frame.keys.add(key); frame.keyBytes += bytes; this.liveKeys++; this.liveKeyBytes += bytes;
          this.charge(1); frame.key = key; frame.state = 'colon'; this.keyText = ''; this.keyRawBytes = 0;
        } else this.finishValue();
        this.token = null; return;
      }
      if (c.codePointAt(0)! < 32) this.fail('Literal control in JSON string'); return;
    }
    if (this.token === 'number') {
      if (/^[0-9eE+.-]$/.test(c)) {this.limit('numberTokenBytes', this.number.length + 1, 256); this.number += c; return;}
      this.endNumber(this.offset - width(c)); this.character(c); return;
    }
    if (this.token === 'literal') {if (c !== this.literal[this.literalIndex]) this.fail('Invalid JSON literal'); if (++this.literalIndex === this.literal.length) {this.token = null; this.finishValue();} return;}
    if (whitespace(c)) return;
    if (this.complete) this.fail('Trailing JSON input');
    const frame = this.frames.at(-1); if (!frame) {this.beginValue(c); return;}
    if (frame.state === 'key-or-end' || frame.state === 'key') {
      if (c === '}' && frame.state === 'key-or-end') {this.pop(); this.finishValue(); return;}
      if (c !== '"') this.fail('Expected JSON property key');
      this.token = 'key'; this.keyText = '"'; this.keyRawBytes = 1; this.escaped = false; this.unicode = 0; return;
    }
    if (frame.state === 'colon') {if (c !== ':') this.fail('Expected JSON colon'); frame.state = 'value'; return;}
    if (frame.state === 'value-or-end' || frame.state === 'value') {
      if (c === ']' && frame.kind === 'array' && frame.state === 'value-or-end') {this.pop(); this.finishValue(); return;}
      this.beginValue(c); return;
    }
    if (frame.state === 'comma-or-end') {
      if (c === (frame.kind === 'object' ? '}' : ']')) {this.pop(); this.finishValue(); return;}
      if (c !== ',') this.fail('Expected JSON comma or closing delimiter'); frame.state = frame.kind === 'object' ? 'key' : 'value'; return;
    }
    this.fail('Incomplete JSON child value');
  }
  private text(text: string) {
    for (const c of text) {
      const bytes = width(c); this.offset += bytes;
      if (this.staging !== null) {this.limit('eventBytes', this.stagedBytes + bytes, 1048576); this.stagedBytes += bytes; this.staging += c;}
      this.character(c);
    }
  }
  feed(bytes: Uint8Array) {
    if (this.disposed || this.completion === 'stopped' || this.completion === 'eof-finished') throw new Error('Streamed trace staging admission ended');
    this.fed = true;
    // The owned FD reads at most65536 raw bytes. Reserve four bytes here for
    // decoder carry: each transient decoded string is <=65536 UTF16 code units,
    // not a64KiB physical heap promise. No decoded string survives this loop.
    for (let offset = 0; offset < bytes.length; offset += 65532) {
      let text: string;
      try {text = this.decoder.decode(bytes.subarray(offset, offset + 65532), {stream: true});} catch {this.fail('Invalid UTF8', null, null, null, 'last-fully-scanned-prefix');}
      this.text(text);
    }
  }
  finish() {
    if (this.disposed || this.failure) throw new Error('Streamed trace staging admission ended');
    let text: string; try {text = this.decoder.decode();} catch {this.fail('Invalid UTF8', null, null, null, 'last-fully-scanned-prefix');}
    this.text(text); if (this.token === 'number') this.endNumber();
    if (this.token || this.frames.length || !this.complete) this.fail('Incomplete JSON input');
    if (!this.traceSeen) this.fail('Missing top-level traceEvents array');
    this.totals = {byteLength: this.offset, analyzerWorkUnits: this.work, capturePrimitiveTokens: this.tokens, maximumDepth: this.depth, traceEventCount: this.events}; this.completion = 'eof-finished';
  }
  statistics(physicalClosure: TraceAdmissionStatistics['physicalClosure'] = 'unverified'): TraceAdmissionStatistics {
    return {policy: this.profile, scannerCompletion: this.completion === 'not-started' && this.fed ? 'stopped' : this.completion, physicalClosure, completeTotals: this.totals ? {...this.totals} : null,
      observedPrefix: this.fed ? {scannedUtf8Bytes: this.offset, workUnits: this.work, traceEvents: this.events, maximumDepth: this.depth, retainedBytes: this.retainedBytes, retainedWork: this.retainedWork, retainedEvents: this.retainedCount} : null,
      legacyWorkThreshold: this.crossing ? {...this.crossing} : {status: this.completion === 'eof-finished' ? 'not-crossed-complete' : 'unknown-not-observed'}, firstFailure: this.failure ? {...this.failure} : null};
  }
  trace() {if (this.disposed || this.completion !== 'eof-finished') throw new Error('Streamed trace syntax not admitted'); return {traceEvents: this.records};}
  trackerRecords() {this.requireTracker(); return this.tracker;}
  private requireTracker() {if (this.disposed || this.completion !== 'eof-finished' || this.profile !== TRACKER_JSON_A_POLICY) throw new Error('Tracker trace syntax not admitted');}
  chargeTrackerProjectionVisit() {this.requireTracker(); this.limit('selectedWorkUnits', this.retainedWork + 1, 2097152); this.retainedWork++;}
  liveState() {return {frames: this.frames.length, keys: this.liveKeys, keyBytes: this.liveKeyBytes, stagedBytes: this.stagedBytes, retainedEvents: this.records.length};}
  dispose() {this.disposed = true; this.frames.length = 0; this.records.length = 0; this.tracker.length = 0; this.eventNumbers.length = 0; this.staging = null; this.stagedBytes = 0; this.liveKeys = 0; this.liveKeyBytes = 0; this.keyText = ''; this.number = ''; this.numberSlot = null;}
}
export function notStartedTraceAdmission(): TraceAdmissionStatistics {
  return {policy: STREAMED_TRACE_POLICY, scannerCompletion: 'not-started', physicalClosure: 'unverified', completeTotals: null,
    observedPrefix: null, legacyWorkThreshold: {status: 'unknown-not-observed'}, firstFailure: null};
}
