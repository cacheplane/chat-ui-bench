import {describe, it, expect, vi} from 'vitest';
import {StreamedTraceAdmission, StreamedTraceFailure} from './comparison-trace-stream.js';

function scan(text: string, width = 65536) {
  const value = new StreamedTraceAdmission(), bytes = Buffer.from(text);
  for (let i = 0; i < bytes.length; i += width) value.feed(bytes.subarray(i, i + width));
  value.finish(); return value;
}
const event = {name: 'AnimationFrame', ph: 'b', ts: 1, pid: 10, tid: 11, args: {id: 'one'}, id2: {local: '0x1'}};
describe('streamed trace admission', () => {
  it.each([1, 2, 7, 65536])('retains exact selected originals and validates discarded Unicode at chunk width%i', width => {
    const text = JSON.stringify({other: {unicode: 'é😀', escaped: '"{}\\'}, traceEvents: [{name: 'unused', ph: 'I', args: {str: 'é😀'}}, event]});
    const value = scan(text, width); expect(value.trace().traceEvents).toEqual([event]);
    expect(value.statistics()).toMatchObject({scannerCompletion: 'eof-finished', completeTotals: {byteLength: Buffer.byteLength(text), traceEventCount: 2}, legacyWorkThreshold: {status: 'not-crossed-complete'}});
    value.dispose(); expect(value.liveState()).toEqual({frames: 0, keys: 0, keyBytes: 0, stagedBytes: 0, retainedEvents: 0});
  });
  it.each(['{"traceEvents":[{"ph":"I"}]}', '{"traceEvents":[{"name":"x","ph":""}]}', '{"traceEvents":[null]}'])('rejects malformed generic discarded event%s', text => {
    expect(() => scan(text)).toThrow(/generic trace event/);
  });
  it.each(['{"traceEvents":[],"x":0,"\\u0078":1}', '{"traceEvents":[],"x":{"k":0,"\\u006b":1}}', '{"traceEvents":[],"\\u0074raceEvents":[]}'])('rejects decoded duplicate even outside events%s', text => {
    expect(() => scan(text)).toThrow(/Duplicate decoded key/);
  });
  it.each(['{}', '{"x":{"traceEvents":[]}}', '{"traceEvents":{}}', '{"traceEvents":[]} {}'])('keeps exact root grammar%s', text => {expect(() => scan(text)).toThrow();});
  it.each([64, 65])('retains inclusive depth boundary%i outside events', depth => {
    const text = '{"traceEvents":[],"x":' + '['.repeat(depth) + ']'.repeat(depth) + '}';
    // Root depth0 and nested containers depth1..depth, without a deeper scalar.
    if (depth === 64) expect(() => scan(text)).not.toThrow();
    else expect(() => scan(text)).toThrow(/jsonDepth/);
  });
  it.each([256, 257])('bounds original number lexeme%i outside events', length => {
    const text = '{"traceEvents":[],"x":0.' + '0'.repeat(length - 2) + '}';
    if (length === 256) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/numberTokenBytes/);
  });
  it.each([16384, 16385])('bounds raw key token including quotes%i', length => {
    const key = '"' + '\\u0061'.repeat(Math.floor((length - 2) / 6)) + 'a'.repeat((length - 2) % 6) + '"';
    const text = '{"traceEvents":[], ' + key + ':0}';
    if (length === 16384) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/rawKeyTokenBytes/);
  });
  it.each([8192, 8193])('bounds decoded key UTF8 content%i', length => {
    const text = '{"traceEvents":[],"' + 'a'.repeat(length) + '":0}';
    if (length === 8192) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/decodedKeyBytes/);
  });
  it.each([4096, 4097])('bounds unique keys in the original root%i', count => {
    const text = '{"traceEvents":[]' + Array.from({length: count - 1}, (_, i) => ',"k' + i + '":0').join('') + '}';
    if (count === 4096) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/objectKeys/);
  });
  it('keeps stopped-prefix statistics separate from complete physical bytes and does not invent8m crossing', () => {
    const value = new StreamedTraceAdmission();
    expect(() => value.feed(Buffer.from('{"traceEvents":[],"x":0.' + '0'.repeat(256) + '}'))).toThrow(StreamedTraceFailure);
    expect(value.statistics()).toMatchObject({scannerCompletion: 'stopped', completeTotals: null, legacyWorkThreshold: {status: 'unknown-not-observed'}});
    value.dispose(); expect(value.liveState().frames).toBe(0);
  });
  it('validates malformed discarded tail and preserves failure after earlier selected original', () => {
    const value = new StreamedTraceAdmission();
    expect(() => value.feed(Buffer.from('{"traceEvents":[' + JSON.stringify(event) + '],"later":NaN}'))).toThrow();
    expect(value.statistics().completeTotals).toBeNull(); value.dispose(); expect(value.liveState().retainedEvents).toBe(0);
  });
  it('does not reinterpret invalid UTF8 as an exact error-byte witness', () => {
    const value = new StreamedTraceAdmission(); value.feed(Buffer.from('{"traceEvents":['));
    expect(() => value.feed(Buffer.from([0xff]))).toThrow();
    expect(value.statistics().firstFailure?.offsetMeaning).toBe('last-fully-scanned-prefix');
  });
  it('handles a four-byte scalar split at a raw65536-byte boundary without retaining decoded chunks', () => {
    const text = '{"traceEvents":[],"s":"' + 'a'.repeat(65536 - 25) + '😀' + 'b'.repeat(65535) + '"}';
    const value = scan(text); expect(value.statistics().completeTotals?.byteLength).toBe(Buffer.byteLength(text));
    expect(value.liveState()).toEqual({frames: 0, keys: 0, keyBytes: 0, stagedBytes: 0, retainedEvents: 0});
  });
  it('bounds actual decoded native results in UTF16 code units with carried scalar bytes', () => {
    const observations: {raw: number; units: number}[] = [], original = TextDecoder.prototype.decode;
    const decoder = vi.spyOn(TextDecoder.prototype, 'decode').mockImplementation(function(this: TextDecoder, ...args: Parameters<TextDecoder['decode']>) {
      const result = Reflect.apply(original, this, args); observations.push({raw: args[0]?.byteLength ?? 0, units: result.length}); return result;
    });
    try {
      const prefix = '{"traceEvents":[],"s":"', text = prefix + 'a'.repeat(65532 - Buffer.byteLength(prefix) - 3) + '😀' + 'b'.repeat(65536) + '"}';
      expect(scan(text).statistics().completeTotals?.byteLength).toBe(Buffer.byteLength(text));
      expect(observations.length).toBeGreaterThan(2); expect(observations.every(value => value.raw <= 65532 && value.units <= 65536)).toBe(true);
    } finally {decoder.mockRestore();}
  });
  it.each([1048576, 1048577])('bounds original per-event raw bytes%i', size => {
    const event = JSON.stringify({name: 'unused', ph: 'I', s: ''}), text = '{"traceEvents":[' + event.slice(0, -2) + 'a'.repeat(size - Buffer.byteLength(event)) + '"}]}';
    if (size === 1048576) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/eventBytes/);
  });
  it.each([65536, 65537])('bounds per-event original work%i', work => {
    const text = '{"traceEvents":[{"name":"unused","ph":"I","a":[' + 'null,'.repeat(work - 8) + 'null]}]}';
    if (work === 65536) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/eventWorkUnits/);
  });
  it.each([32, 33])('bounds retained selected work at%s maximal events', count => {
    const event = '{"name":"AnimationFrame","ph":"b","a":[' + 'null,'.repeat(65528) + 'null]}';
    const text = '{"traceEvents":[' + Array(count).fill(event).join(',') + ']}';
    if (count === 32) {const value = scan(text); expect(value.statistics().observedPrefix?.retainedWork).toBe(2097152);}
    else expect(() => scan(text)).toThrow(/selectedWorkUnits/);
  }, 30000);
  it.each([65536, 65537])('bounds selected event count%i', count => {
    const text = '{"traceEvents":[' + Array(count).fill('{"name":"AnimationFrame","ph":"b"}').join(',') + ']}';
    if (count === 65536) expect(scan(text).trace().traceEvents).toHaveLength(count);
    else expect(() => scan(text)).toThrow(/selectedEvents/);
  }, 30000);
  it('decrements nested object key storage before sibling admission', () => {
    const child = '{' + Array.from({length: 4096}, (_, i) => '"k' + i + '":0').join(',') + '}';
    const value = scan('{"traceEvents":[],"siblings":[' + Array(20).fill(child).join(',') + ']}');
    expect(value.liveState().keys).toBe(0); expect(value.liveState().keyBytes).toBe(0);
  });
  it.each([16, 17])('bounds all live nested key sets at%s full objects', levels => {
    let text = '{"traceEvents":[]';
    for (let depth = 0; depth < levels; depth++) {
      const keys = 4096 - (depth === 0 ? 1 : 0) - (depth < levels - 1 ? 1 : 0);
      text += (depth === 0 ? ',' : '') + Array.from({length: keys}, (_, i) => '"k' + i + '":0').join(',');
      if (depth < levels - 1) text += ',"nested":{';
    }
    text += '}'.repeat(levels);
    if (levels === 16) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/activeKeys/);
  });
  it.each([1048576, 1048577])('bounds all active decoded key UTF8 bytes%i', total => {
    const keys = Array.from({length: 127}, (_, i) => String(i).padStart(3, '0') + 'a'.repeat(8189));
    keys.push('z'.repeat(total - Buffer.byteLength('traceEvents') - 127 * 8192));
    const text = '{"traceEvents":[],' + keys.map(key => JSON.stringify(key) + ':0').join(',') + '}';
    if (total === 1048576) expect(() => scan(text)).not.toThrow(); else expect(() => scan(text)).toThrow(/activeKeyBytes/);
  });
  it.each([16, 17])('bounds selected original raw bytes at%s maximal events', count => {
    const head = JSON.stringify({name: 'AnimationFrame', ph: 'b', s: ''}), event = head.slice(0, -2) + 'a'.repeat(1048576 - Buffer.byteLength(head)) + '"}';
    const text = '{"traceEvents":[' + Array(count).fill(event).join(',') + ']}';
    if (count === 16) expect(scan(text).statistics().observedPrefix?.retainedBytes).toBe(16777216);
    else expect(() => scan(text)).toThrow(/selectedEventBytes/);
  }, 30000);
  it('retains complete selector closure including late metadata and foreign process records', () => {
    const names = ['AnimationFrame', 'AnimationFrame::Presentation', 'TracingStartedInBrowser', 'thread_name', 'bench:comparison:streaming-follow:0:start', 'FrameCommittedInBrowser', 'CommitLoad', 'navigationStart', 'FrameDeletedInBrowser', 'ProcessReadyInBrowser', 'RenderFrameHostImpl::DidCommitSameDocumentNavigation'];
    const originals = names.map((name, i) => ({name, ph: 'I', pid: i + 100, tid: i + 200, args: {foreign: true}}));
    const value = scan(JSON.stringify({traceEvents: [{name: 'not-selected', ph: 'I'}, ...originals]}));
    expect(value.trace().traceEvents).toEqual(originals);
  });
  it.each([1048576, 1048577])('bounds all generic trace elements including discarded ones%i', count => {
    const text = '{"traceEvents":[' + Array(count).fill('{"name":"unused","ph":"I"}').join(',') + ']}';
    if (count === 1048576) expect(scan(text).statistics().completeTotals?.traceEventCount).toBe(count);
    else expect(() => scan(text)).toThrow(/traceEvents/);
  }, 30000);
  it('stops at fullwork16777217 with actual8m crossing and null full totals', () => {
    const event = '{"name":"unused","ph":"I","a":[' + 'null,'.repeat(65528) + 'null]}', value = new StreamedTraceAdmission();
    const bytes = Buffer.from('{"traceEvents":[' + Array(256).fill(event).join(',') + ']}');
    expect(() => {for (let i = 0; i < bytes.length; i += 65536) value.feed(bytes.subarray(i, i + 65536)); value.finish();}).toThrow(/jsonWorkUnits/);
    expect(value.statistics()).toMatchObject({scannerCompletion: 'stopped', completeTotals: null, observedPrefix: {workUnits: 16777217}, legacyWorkThreshold: {status: 'crossed', observed: 8388609}});
    value.dispose(); expect(value.liveState().retainedEvents).toBe(0);
  }, 60000);
  it('admits exactly fullwork16777216 only after actual EOF', () => {
    const event = (work: number) => '{"name":"unused","ph":"I","a":[' + 'null,'.repeat(work - 8) + 'null]}';
    const value = scan('{"traceEvents":[' + [...Array(255).fill(event(65536)), event(65533)].join(',') + ']}');
    expect(value.statistics()).toMatchObject({scannerCompletion: 'eof-finished', completeTotals: {analyzerWorkUnits: 16777216}, legacyWorkThreshold: {status: 'crossed', observed: 8388609}});
  }, 60000);
});
