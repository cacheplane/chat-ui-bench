import { expect, test } from 'vitest';
import * as descriptor from './browser-frame-track-descriptor-fragments.js';
import { body, int32, join, tag, uint, vi } from './browser-frame-packet-fragments.test-helper.js';

const policy = 'pinned-browser-frame-track-descriptor-body-fragments-v1';
type Result = {
  status:string; fields: {uuid?:string;parentUuid?:string;process?:{pid?:string;startTimestampNs?:string};thread?:{pid?:string;tid?:string}};
  descriptorAssociation:string; bodyBytes:Uint8Array; occurrences:{scope:string;fieldNumber:number;wireType:number;start:number;valueStart:number;end:number}[];
  skippedFields:{scope:string;fieldNumber:number;start:number;valueStart:number;end:number}[];presentFieldNumbers:number[];consumedBytes:number;
};
function decode(bytes:unknown, selectedPolicy:unknown=policy):Result {
  const fn=(descriptor as {decodeBrowserFrameTrackDescriptorBody?:unknown}).decodeBrowserFrameTrackDescriptorBody;
  expect(fn,'selected descriptor decoder must exist').toBeTypeOf('function');
  return (fn as (bytes:unknown,policy:unknown)=>Result)(bytes,selectedPolicy);
}
function decoded(bytes:Uint8Array):Result {const r=decode(bytes);expect(r.status).toBe('decoded_track_descriptor_body_fragment');return r;}
function denied(bytes:unknown,code:string,selectedPolicy:unknown=policy):void {expect(decode(bytes,selectedPolicy)).toEqual({status:'unavailable',diagnostics:[{code}]});}
const signed=(field:number,n:bigint)=>uint(field,n<0n?n+18446744073709551616n:n);

test('empty body conveys no identity, parent resolution or native authority',()=>{
  expect(decoded(new Uint8Array())).toMatchObject({fields:{},descriptorAssociation:'none',presentFieldNumbers:[],consumedBytes:0,
    normalizationCapability:'track-descriptor-body-fragments-only',processIncarnation:'unestablished',parentAssociation:'not_evaluated',clockAdmission:'not_evaluated',
    runtimeQualification:'unestablished',sourceCoverage:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
  expect((descriptor as {TRACK_DESCRIPTOR_BODY_POLICY?:unknown}).TRACK_DESCRIPTOR_BODY_POLICY).toBe(policy);
});
test('UUID and parent UUID retain uint64 precision, zero and presence',()=>{
  expect(decoded(join(uint(1,9007199254740993n),uint(5,18446744073709551615n)))).toMatchObject({fields:{uuid:'9007199254740993',parentUuid:'18446744073709551615'},presentFieldNumbers:[1,5]});
  expect(decoded(join(uint(5,0n),uint(1,0n))).fields).toEqual({parentUuid:'0',uuid:'0'});
});
test.each([-2147483648n,-1n,0n,2147483647n])('process and thread PID preserve signed int32 %s',n=>{
  expect(decoded(body(3,int32(1,n))).fields).toEqual({process:{pid:String(n)}});
  expect(decoded(body(4,int32(1,n))).fields).toEqual({thread:{pid:String(n)}});
});
test.each([-9223372036854775808n,-9007199254740993n,-1n,0n,9007199254740993n,9223372036854775807n])('TID and process timestamp retain signed int64 %s',n=>{
  expect(decoded(body(4,signed(2,n))).fields).toEqual({thread:{tid:String(n)}});
  expect(decoded(body(3,signed(7,n))).fields).toEqual({process:{startTimestampNs:String(n)}});
});
test.each([2147483648n,4294967295n,18446744071562067967n])('noncanonical/out-of-domain int32 PID %s refuses',n=>{
  denied(body(3,uint(1,n)),'int32-overflow');denied(body(4,uint(1,n)),'int32-overflow');
});
test('empty child presence and both associations remain explicit, without choosing a parent/owner',()=>{
  expect(decoded(body(3,new Uint8Array()))).toMatchObject({fields:{process:{}},descriptorAssociation:'process-only'});
  expect(decoded(body(4,new Uint8Array()))).toMatchObject({fields:{thread:{}},descriptorAssociation:'thread-only'});
  expect(decoded(join(body(4,join(int32(1,2n),signed(2,3n))),uint(5,7n),body(3,join(int32(1,1n),signed(7,9n)))))).toMatchObject({
    fields:{thread:{pid:'2',tid:'3'},parentUuid:'7',process:{pid:'1',startTimestampNs:'9'}},descriptorAssociation:'ambiguous-process-and-thread',parentAssociation:'not_evaluated'});
});
test.each([1,5])('duplicate root scalar %i refuses even identical',n=>denied(join(uint(n,1n),uint(n,1n)),'duplicate-selected-field'));
test.each([3,4])('duplicate child body %i refuses even empty',n=>denied(join(body(n,new Uint8Array()),body(n,new Uint8Array())),'duplicate-selected-field'));
test.each([[3,1],[3,7],[4,1],[4,2]])('duplicate child selected scalar %i/%i refuses', (parent,n)=>{
  denied(body(parent,join(uint(n,1n),uint(n,1n))),'duplicate-selected-field');
});
test.each([body(1,new Uint8Array()),body(5,new Uint8Array()),uint(3,0n),uint(4,0n),body(3,body(1,new Uint8Array())),body(3,body(7,new Uint8Array())),body(4,body(1,new Uint8Array())),body(4,body(2,new Uint8Array()))])('selected wrong wire %# refuses',b=>denied(b,'selected-field-wrong-wire-type'));
test('unknown root and child fields retain depth-first original-body offsets and opaque bytes',()=>{
  const bytes=join(body(2,Uint8Array.of(255)),body(4,join(uint(2,1n),body(5,Uint8Array.of(128)))),body(3,join(uint(1,2n),body(2,Uint8Array.of(255)))),uint(99,3n));
  const r=decoded(bytes);
  expect(r.occurrences.map(o=>[o.scope,o.fieldNumber])).toEqual([['track_descriptor',2],['track_descriptor',4],['thread_descriptor',2],['thread_descriptor',5],['track_descriptor',3],['process_descriptor',1],['process_descriptor',2],['track_descriptor',99]]);
  expect(r.skippedFields.map(o=>[o.scope,o.fieldNumber])).toEqual([['track_descriptor',2],['thread_descriptor',5],['process_descriptor',2],['track_descriptor',99]]);
  for(const o of r.occurrences)expect(bytes.subarray(o.start,o.start+tag(o.fieldNumber,o.wireType).length)).toEqual(tag(o.fieldNumber,o.wireType));
  expect(r.bodyBytes).toEqual(bytes);expect(r.bodyBytes).not.toBe(bytes);
  const unknown=r.skippedFields[1]!;expect([...bytes.subarray(unknown.valueStart,unknown.end)]).toEqual([128]);
  expect(r.presentFieldNumbers).toEqual([3,4]);
});
test('nested unselected descriptor-looking bodies are never recursively decoded',()=>{
  expect(decoded(body(3,body(4,Uint8Array.of(255)))).fields).toEqual({process:{}});
  expect(decoded(body(4,body(3,Uint8Array.of(255)))).fields).toEqual({thread:{}});
});
test('root and both selected children share the exact field-work budget',()=>{
  const unknown=uint(8,0n),prefix=join(...Array.from({length:32764},()=>unknown));
  const children=join(body(3,uint(1,0n)),body(4,uint(2,0n)));
  expect(decoded(join(prefix,children)).occurrences).toHaveLength(32768);
  denied(join(prefix,unknown,children),'field-capacity');
});
test('256KiB body ceiling is unchanged and checked before opaque payload traversal',()=>{
  expect(decoded(body(8,new Uint8Array(262140))).consumedBytes).toBe(262144);
  denied(body(8,new Uint8Array(262141)),'byte-capacity');
});
test.each([Uint8Array.of(128),join(tag(1,0),Uint8Array.of(128)),body(3,Uint8Array.of(128)),body(4,Uint8Array.of(128))])('malformed tail %# withholds partial selected fields',tail=>denied(join(uint(1,1n),tail),'truncated-varint'));
test.each([join(tag(3,2),vi(2n),Uint8Array.of(8)),join(tag(4,2),vi(1n),Uint8Array.of(8))])('selected child length/truncation %# refuses',b=>{
  const r=decode(b);expect(r).toMatchObject({status:'unavailable'});expect(r).not.toHaveProperty('fields');
});
test('tag, unsupported wire, uint64 and fixed-field boundary failures remain bounded',()=>{
  denied(Uint8Array.of(0),'invalid-field-number');denied(tag(1,3),'unsupported-wire-type');
  denied(join(tag(1,0),new Uint8Array(9).fill(255),Uint8Array.of(2)),'uint64-varint-overflow');
  denied(tag(90,1),'truncated-fixed-field');
});
test('exact policy and native ordinary storage boundaries',()=>{
  denied(new Uint8Array(),'unsupported-policy','other');
  for(const value of [null,[],new Uint16Array(),Buffer.from([]),new(class extends Uint8Array {})()])denied(value,'unsupported-byte-view');
  denied(new Uint8Array(new SharedArrayBuffer(0)),'unavailable-byte-storage');
  const detached=new Uint8Array(2);structuredClone(detached.buffer,{transfer:[detached.buffer]});denied(detached,'unavailable-byte-storage');
});
test('input ownership bypasses accessors and result mutation cannot contaminate another decoding',()=>{
  const bytes=join(uint(1,7n),body(3,uint(1,5n)));const expected=Uint8Array.from(bytes);
  for(const key of ['length','byteLength','buffer','slice',Symbol.iterator])Object.defineProperty(bytes,key,{get(){throw new Error('caller');}});
  const r=decoded(bytes);expect(r.bodyBytes).toEqual(expected);bytes[1]=0;expect(r.fields.uuid).toBe('7');
  r.bodyBytes[1]=0;r.fields.process!.pid='9';expect(decoded(expected).fields).toEqual({uuid:'7',process:{pid:'5'}});
});
