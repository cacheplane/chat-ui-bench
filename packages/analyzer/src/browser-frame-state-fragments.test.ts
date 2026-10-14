import { expect, test } from 'vitest';
import { decodeBrowserFrameStateBody, STATE_BODY_POLICY } from './browser-frame-state-fragments.js';
import { body, int32, join, tag, text, uint, vi } from './browser-frame-packet-fragments.test-helper.js';
function decoded(bytes: Uint8Array, kind: string): any {
  const result = decodeBrowserFrameStateBody(bytes, kind, STATE_BODY_POLICY) as any;
  expect(result.status).toBe('decoded_state_body_fragment'); return result;
}
function denied(bytes: unknown, kind: unknown, code: string, policy: unknown = STATE_BODY_POLICY): void {
  expect(decodeBrowserFrameStateBody(bytes,kind,policy)).toEqual({status:'unavailable',diagnostics:[{code}]});
}
const kinds = ['defaults','interned_names','clock_snapshot'];
test.each(kinds)('empty standalone %s supplies structural labels only', kind => {
  expect(decoded(new Uint8Array(),kind)).toMatchObject({kind,fields:{},consumedBytes:0,presentFieldNumbers:[],sequenceValidity:'not_evaluated',defaultEpoch:'not_evaluated',internResolution:'not_evaluated',clockAdmission:'not_evaluated',runtimeQualification:'unestablished',sourceCoverage:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
});
test('exact policy, kind and native view boundaries', () => {
  denied(new Uint8Array(),'defaults','unsupported-policy','other'); denied(new Uint8Array(),'unknown','unsupported-state-body-kind');
  for (const view of [null,[],new Uint16Array(),Buffer.from([]),new (class extends Uint8Array {})()]) denied(view,'defaults','unsupported-byte-view');
  denied(new Uint8Array(new SharedArrayBuffer(0)),'defaults','unavailable-byte-storage');
  const detached = new Uint8Array(2);structuredClone(detached.buffer,{transfer:[detached.buffer]});denied(detached,'defaults','unavailable-byte-storage');
  denied(new Uint8Array(262145),'defaults','byte-capacity');
});
test('native storage copying bypasses own accessors and owns result bytes', () => {
  const input = uint(20000,0n);
  for (const key of ['length','byteLength','buffer','slice',Symbol.iterator]) Object.defineProperty(input,key,{get(){throw new Error('caller');}});
  const result = decoded(input,'defaults');expect(result.bodyBytes !== input).toBe(true);expect(result.bodyBytes[0]).toBe(input[0]);
});

test('defaults preserve absent vs explicit zero and uint64 precision', () => {
  expect(decoded(join(uint(58,0n),body(11,uint(11,18446744073709551615n))),'defaults')).toMatchObject({fields:{timestampClockId:'0',trackEventDefaults:{trackUuid:'18446744073709551615'}},presentFieldNumbers:[11,58]});
  expect(decoded(body(11,new Uint8Array()),'defaults').fields).toEqual({trackEventDefaults:{}});
});
test('defaults packed and unpacked counter IDs retain order, repeats and empty presence', () => {
  expect(decoded(body(11,join(uint(31,0n),body(31,join(vi(9007199254740993n),vi(9007199254740993n))),body(45,new Uint8Array()),uint(45,18446744073709551615n))),'defaults').fields).toEqual({trackEventDefaults:{counterTrackUuids:['0','9007199254740993','9007199254740993'],doubleCounterTrackUuids:['18446744073709551615']}});
  expect(decoded(body(11,body(31,new Uint8Array())),'defaults').fields.trackEventDefaults.counterTrackUuids).toEqual([]);
});
test.each([11,58])('duplicate defaults root singular %i denies', n => {
  const value = n===11 ? body(n,new Uint8Array()) : uint(n,0n); denied(join(value,value),'defaults','duplicate-selected-field');
});
test('duplicate child track UUID denies', () => denied(body(11,join(uint(11,0n),uint(11,0n))),'defaults','duplicate-selected-field'));
test('default uint32 clock boundary and overflow', () => {
  expect(decoded(uint(58,4294967295n),'defaults').fields.timestampClockId).toBe('4294967295');denied(uint(58,4294967296n),'defaults','uint32-overflow');
});
test.each([uint(11,0n),body(58,new Uint8Array()),body(11,body(11,new Uint8Array())),body(11,join(tag(31,1),new Uint8Array(8)))])('selected defaults wrong wire %# denies', bytes => denied(bytes,'defaults','selected-field-wrong-wire-type'));
test('defaults unknown fields remain opaque with depth-first original body offsets', () => {
  const bytes=join(uint(20000,7n),body(11,join(uint(11,0n),body(999,Uint8Array.of(255)))),body(12,Uint8Array.of(255)),body(19000,new Uint8Array())); const result=decoded(bytes,'defaults');
  expect(result.occurrences.map((o:any)=>[o.scope,o.fieldNumber])).toEqual([['defaults',20000],['defaults',11],['track_defaults',11],['track_defaults',999],['defaults',12],['defaults',19000]]);
  expect(result.skippedFields.map((o:any)=>o.fieldNumber)).toEqual([20000,999,12,19000]);
  for(const o of result.occurrences)expect(Array.from(bytes.subarray(o.start,o.start+tag(o.fieldNumber,o.wireType).length))).toEqual(Array.from(tag(o.fieldNumber,o.wireType)));
});
test('defaults member cap shared across both arrays', () => {
  const prefix=body(31,new Uint8Array(16383));expect(decoded(body(11,join(prefix,uint(45,1n))),'defaults').fields.trackEventDefaults.doubleCounterTrackUuids).toEqual(['1']);denied(body(11,join(prefix,uint(45,1n),uint(31,2n))),'defaults','member-capacity');
});
test('defaults parent and child share field cap', () => {
  const unknown=uint(20000,0n);const prefix=join(...Array.from({length:32766},()=>unknown));
  expect(decoded(join(prefix,body(11,uint(11,0n))),'defaults').fields.trackEventDefaults.trackUuid).toBe('0');denied(join(prefix,unknown,body(11,uint(11,0n))),'defaults','field-capacity');
});
test.each([Uint8Array.of(128),join(tag(58,0),Uint8Array.of(128)),body(11,Uint8Array.of(128))])('malformed defaults tail withholds early selected values %#', tail => denied(join(uint(58,0n),tail),'defaults','truncated-varint'));

const entry = (table:number,iid:bigint,name:string):Uint8Array => body(table,join(uint(1,iid),text(2,name)));
test('selected intern table entries preserve independent identity and source order', () => {
  expect(decoded(join(entry(2,9007199254740993n,'name'),entry(1,9007199254740993n,'category'),entry(2,18446744073709551615n,'')),'interned_names')).toMatchObject({fields:{entries:[{table:'event_names',iid:'9007199254740993',name:'name'},{table:'event_categories',iid:'9007199254740993',name:'category'},{table:'event_names',iid:'18446744073709551615',name:''}]},presentFieldNumbers:[1,2]});
});
test.each([1,2])('intern table %i rejects absent IID/name and explicit zero IID', table => {
  denied(body(table,text(2,'')),'interned_names','missing-intern-iid');denied(body(table,uint(1,1n)),'interned_names','missing-intern-name');denied(entry(table,0n,''),'interned_names','invalid-intern-iid');
});
test.each([1,2])('intern table %i denies duplicate IID even identical and conflicting values', table => {
  denied(join(entry(table,1n,'same'),entry(table,1n,'same')),'interned_names','duplicate-intern-iid');denied(join(entry(table,1n,'a'),entry(table,1n,'b')),'interned_names','duplicate-intern-iid');
});
test('duplicate child IID/name denies instead of relying on first-write assertions', () => {
  denied(body(1,join(uint(1,1n),uint(1,1n),text(2,''))),'interned_names','duplicate-selected-field');denied(body(1,join(uint(1,1n),text(2,''),text(2,''))),'interned_names','duplicate-selected-field');
});
test.each([uint(1,1n),body(1,join(body(1,new Uint8Array()),text(2,''))),body(1,join(uint(1,1n),uint(2,0n)))])('selected intern wrong wire %# denies', bytes => denied(bytes,'interned_names','selected-field-wrong-wire-type'));
test.each(['','\0','\uFEFF','é','e\u0301','😀'])('intern name UTF8 %j stays exact', value => expect(decoded(entry(1,1n,value),'interned_names').fields.entries[0].name).toBe(value));
test.each([Uint8Array.of(128),Uint8Array.of(192,128),Uint8Array.of(237,160,128),Uint8Array.of(244,144,128,128),Uint8Array.of(226,130)])('invalid intern UTF8 family %# atomically denies', bytes => denied(join(entry(1,1n,'valid'),body(1,join(uint(1,2n),body(2,bytes)))),'interned_names','invalid-utf8'));
test('intern name byte limits are checked before decoding', () => {
  expect(decoded(entry(1,1n,'x'.repeat(4096)),'interned_names').fields.entries[0].name).toHaveLength(4096);denied(entry(1,1n,'x'.repeat(4097)),'interned_names','string-capacity');
  const entries=Array.from({length:8},(_,i)=>entry(1,BigInt(i+1),'x'.repeat(4096)));expect(decoded(join(...entries),'interned_names').fields.entries).toHaveLength(8);denied(join(...entries,entry(1,9n,'x')),'interned_names','string-total-capacity');
});
test('entry count cap includes empty names across both tables', () => {
  const entries=Array.from({length:4096},(_,i)=>entry(i%2+1,BigInt(i+1),''));expect(decoded(join(...entries),'interned_names').fields.entries).toHaveLength(4096);denied(join(...entries,entry(1,5000n,'')),'interned_names','intern-entry-capacity');
});
test('unknown intern tables and child fields remain opaque spans', () => {
  const result=decoded(join(body(3,Uint8Array.of(255)),body(1,join(uint(1,1n),text(2,''),body(90,Uint8Array.of(255))))),'interned_names');
  expect(result.occurrences.map((o:any)=>[o.scope,o.fieldNumber])).toEqual([['interned_data',3],['interned_data',1],['event_category',1],['event_category',2],['event_category',90]]);expect(result.skippedFields.map((o:any)=>o.fieldNumber)).toEqual([3,90]);
});
test('malformed late intern entry withholds all earlier names', () => denied(join(entry(1,1n,'valid'),body(2,Uint8Array.of(128))),'interned_names','truncated-varint'));

test('clock fields preserve absent vs zero, false and raw units without admission', () => {
  const result=decoded(join(body(1,join(uint(1,0n),uint(2,0n),uint(3,0n),uint(4,0n))),body(1,new Uint8Array()),int32(2,-1n)),'clock_snapshot');
  expect(result.fields).toEqual({clocks:[{clockId:'0',timestamp:'0',isIncremental:false,unitMultiplierNs:'0'},{}],primaryTraceClock:'-1'});expect(result.presentFieldNumbers).toEqual([1,2]);expect(result.clockAdmission).toBe('not_evaluated');
});
test('clock values retain uint64 precision and incremental flag without accumulation', () => {
  expect(decoded(body(1,join(uint(1,4294967295n),uint(2,18446744073709551615n),uint(3,1n),uint(4,9007199254740993n))),'clock_snapshot').fields.clocks).toEqual([{clockId:'4294967295',timestamp:'18446744073709551615',isIncremental:true,unitMultiplierNs:'9007199254740993'}]);
});
test.each([0n,3n,555n,-1n,-2147483648n,2147483647n])('raw primary clock enum %s preserved', value=>expect(decoded(int32(2,value),'clock_snapshot').fields.primaryTraceClock).toBe(value.toString()));
test.each([2147483648n,4294967295n,18446744071562067967n])('nonprofile primary enum %s denied', value=>denied(uint(2,value),'clock_snapshot','int32-overflow'));
test.each([1,2,3,4])('duplicate clock child field %i denied', n=>denied(body(1,join(uint(n,0n),uint(n,0n))),'clock_snapshot','duplicate-selected-field'));
test('duplicate primary clock and raw child clock IDs deny', () => {
  denied(join(uint(2,3n),uint(2,3n)),'clock_snapshot','duplicate-selected-field');denied(join(body(1,uint(1,0n)),body(1,uint(1,0n))),'clock_snapshot','duplicate-clock-id');
});
test.each([uint(1,0n),body(2,new Uint8Array()),...Array.from({length:4},(_,i)=>body(1,body(i+1,new Uint8Array())))])('selected clock wrong wire %# denied', bytes=>denied(bytes,'clock_snapshot','selected-field-wrong-wire-type'));
test('clock child uint32 and strict bool bounds deny', () => {
  denied(body(1,uint(1,4294967296n)),'clock_snapshot','uint32-overflow');denied(body(1,uint(3,2n)),'clock_snapshot','non-profile-bool');
});
test('explicit absolute unit-one same-ID fields still do not evaluate clock provenance', () => {
  const result=decoded(join(uint(2,3n),body(1,join(uint(1,3n),uint(2,10n),uint(3,0n),uint(4,1n)))),'clock_snapshot');expect(result.clockAdmission).toBe('not_evaluated');expect(result.sequenceValidity).toBe('not_evaluated');expect(result.evaluationEligibility).toBe(false);
});
test('clock child count exact boundary and overflow', () => {
  const clocks=Array.from({length:1024},(_,i)=>body(1,uint(1,BigInt(i))));expect(decoded(join(...clocks),'clock_snapshot').fields.clocks).toHaveLength(1024);denied(join(...clocks,body(1,new Uint8Array())),'clock_snapshot','clock-child-capacity');
});
test('clock parent and child occurrence counts share one budget', () => {
  const unknown=uint(20000,0n);const prefix=join(...Array.from({length:32766},()=>unknown));expect(decoded(join(prefix,body(1,uint(1,0n))),'clock_snapshot').fields.clocks).toEqual([{clockId:'0'}]);denied(join(prefix,unknown,body(1,uint(1,0n))),'clock_snapshot','field-capacity');
});
test('clock unknown spans preserve ordered depth-first absolute offsets', () => {
  const bytes=join(uint(20000,0n),body(1,join(uint(1,1n),body(99,Uint8Array.of(255)))),body(19000,new Uint8Array()));const result=decoded(bytes,'clock_snapshot');expect(result.occurrences.map((o:any)=>[o.scope,o.fieldNumber])).toEqual([['clock_snapshot',20000],['clock_snapshot',1],['clock',1],['clock',99],['clock_snapshot',19000]]);expect(result.skippedFields.map((o:any)=>o.fieldNumber)).toEqual([20000,99,19000]);
  for(const o of result.occurrences)expect(Array.from(bytes.subarray(o.start,o.start+tag(o.fieldNumber,o.wireType).length))).toEqual(Array.from(tag(o.fieldNumber,o.wireType)));
});
test('malformed clock tail withholds a whole previous snapshot', ()=>denied(join(body(1,uint(1,3n)),body(1,Uint8Array.of(128))),'clock_snapshot','truncated-varint'));
test.each(kinds)('generic malformed %s field families deny atomically', kind=>{
  denied(Uint8Array.of(0),kind,'invalid-field-number');denied(Uint8Array.of(11),kind,'unsupported-wire-type');denied(join(tag(20000,1),new Uint8Array(7)),kind,'truncated-fixed-field');denied(join(tag(20000,2),vi(2n),Uint8Array.of(0)),kind,'out-of-bounds-length');denied(join(tag(20000,0),Uint8Array.from([...Array(9).fill(255),2])),kind,'uint64-varint-overflow');
});
test.each(kinds)('exact byte cap and independently owned output for %s', kind=>{
  const input=body(20000,new Uint8Array(262138));expect(input.length).toBe(262144);const a=decoded(input,kind);const b=decoded(input,kind);a.bodyBytes.fill(0);a.occurrences[0].start=999;a.skippedFields[0].fieldNumber=5;expect(Array.from(b.bodyBytes)).toEqual(Array.from(input));expect(b.occurrences[0].start).toBe(0);expect(b.skippedFields[0].fieldNumber).toBe(20000);
});
test('selected defaults, intern entries and clock arrays do not alias other results', ()=>{
  const a=decoded(body(11,uint(31,1n)),'defaults');const b=decoded(body(11,uint(31,1n)),'defaults');a.fields.trackEventDefaults.counterTrackUuids.push('99');expect(b.fields.trackEventDefaults.counterTrackUuids).toEqual(['1']);
  const c=decoded(entry(1,1n,'original'),'interned_names');const d=decoded(entry(1,1n,'original'),'interned_names');c.fields.entries[0].name='changed';expect(d.fields.entries[0].name).toBe('original');
  const e=decoded(body(1,uint(2,0n)),'clock_snapshot');const f=decoded(body(1,uint(2,0n)),'clock_snapshot');e.fields.clocks[0].timestamp='99';expect(f.fields.clocks[0].timestamp).toBe('0');
});
