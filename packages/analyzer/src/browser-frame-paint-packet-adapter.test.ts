import { expect, test } from 'vitest';
import * as api from './browser-frame-paint-packet-adapter.js';
import { body, join, text, uint } from './browser-frame-packet-fragments.test-helper.js';
const paint = (variant = 0) => join(uint(3,1n),uint(3,2n),uint(3,3n),uint(10,4n),uint(11,0n),body(4,join(uint(1,5n),text(variant===1?8:6,'frame'))),body(4,join(uint(1,6n),variant===2?uint(3,1n):text(variant===1?6:11,'opaque'))),body(6,uint(2,82n)));
const decode = (p: unknown) => api.createPaintPacketAdapter().decode(p);
test('fixed private API and pure frozen reservation vector',()=>{
 expect(api.PAINT_PACKET_ADAPTER_POLICY).toBe('private-paint-packet-adapter-v1');
 for(const n of [0,1,262144]){
  const r=api.packetAdapterReservation(n);expect(Object.isFrozen(r)).toBe(true);
  expect(r).toMatchObject({wireByteReads:3*n,copyBytes:4*n,hashBytes:4*n,terminalChecks:4});
  expect(Object.values(r).every(v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)).toBe(true);
 }
 let traps=0;const p=new Proxy({}, {get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});
 for(const n of [p,{},'1',null,undefined,NaN,Infinity,-1,0.5,262145,Number.MAX_SAFE_INTEGER])expect(api.packetAdapterReservation(n)).toHaveProperty('status','unavailable');
 expect(traps).toBe(0);
});
test('all paint forms keep original bytes, raw pending state and shifted spans',()=>{
 for(const v of [0,1,2]){
  const p=join(uint(10,0n),body(59,Uint8Array.of(0)),body(12,Uint8Array.of(128)),body(11,paint(v)));
  const r=decode(p);expect(r).toMatchObject({status:'decoded_owned_packet',branch:'paint',sequenceValidity:'not_evaluated',nativeSupported:false});
  if(r.status==='unavailable'||r.branch!=='paint')throw Error('paint expected');
  expect(r.fields.sequenceId).toBe('0');expect(r.paint.usage).toMatchObject({fields:13,members:5});
  expect(r.rawWindows.map(x=>x.fieldNumber)).toEqual([59,12]);expect(r.paintPacketOccurrences.every(o=>o.end<=p.length)).toBe(true);
  expect(r.bodyBytes).toEqual(p);p.fill(0);expect(r.bodyBytes).not.toEqual(p);expect('event' in r).toBe(false);
 }
});
test('route scans entire packet and direct event before dispatch and latches immutable failure',()=>{
 const a=api.createPaintPacketAdapter();const first=a.decode(join(body(11,paint()),Uint8Array.of(128)));
 expect(first).toMatchObject({status:'unavailable',code:'truncated-varint',stage:'route'});
 let traps=0;const p=new Proxy({}, {get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});
 expect(Object.isFrozen(first)).toBe(true);expect(a.decode(p)).toBe(first);expect(traps).toBe(0);
 expect(decode(join(body(11,paint()),uint(11,1n)))).toHaveProperty('code','adapter-route-duplicate-event');
 expect(decode(body(11,join(paint(),Uint8Array.of(128))))).toHaveProperty('code','truncated-varint');
});
test('old zero DATA and modern multiannotation without legacy stay old',()=>{
 expect(decode(new Uint8Array())).toMatchObject({branch:'old',packet:{status:'decoded_packet_fragment'}});
 const e=join(uint(9,3n),text(23,'x'),body(4,join(uint(1,1n),text(6,'a'))),body(4,join(uint(1,2n),text(6,'b'))));
 expect(decode(body(11,e))).toHaveProperty('branch','old');
});
test('old legacy preserves direct order, annotation order, string contents and zero IIDs',()=>{
 for(const value of ['', '\uFEFF','\0','é'])for(const reverse of [false,true]){
 const parts=[uint(3,0n),uint(3,2n),uint(10,0n),uint(11,0n),body(4,join(text(6,value),uint(1,1n))),body(6,uint(2,82n))];
 if(reverse)parts.reverse();expect(decode(body(11,join(...parts)))).toHaveProperty('branch','old');
 }
});
test('paint shell preserves scalar domains and refusal order',()=>{
 for(const [h,code] of [[uint(58,4294967296n),'uint32-overflow'],[uint(41,2n),'non-profile-bool'],[uint(79,2147483648n),'int32-overflow'],[body(8,new Uint8Array()),'selected-field-wrong-wire-type'],[join(uint(8,0n),uint(8,1n)),'duplicate-selected-field']] as const)
 expect(decode(join(body(11,paint()),h))).toHaveProperty('code',code);
 expect(decode(join(uint(41,0n),uint(87,0n),uint(79,18446744073709551615n),body(11,paint())))).toMatchObject({fields:{incrementalStateCleared:false,firstPacketOnSequence:false,trustedPid:'-1'}});
 for(const reverse of [false,true]){const parts=[body(124,new Uint8Array()),body(11,paint())];if(reverse)parts.reverse();expect(decode(join(...parts))).toHaveProperty('code','duplicate-data-oneof');}
});
test('paint shared shell allowance reserves thirteen body fields before reads',()=>{
 for(const [shell,status] of [[8179,'decoded_owned_packet'],[8180,'unavailable']] as const){
 const p=join(...Array.from({length:shell-1},()=>uint(19000,0n)),body(11,paint()));expect(decode(p).status).toBe(status);
 }
});
test('storage guards and proxies preserve literal refusals without hooks',()=>{
 let traps=0;const p=new Proxy(new Uint8Array(),{getPrototypeOf(){traps++;throw Error();}});
 expect(decode(p)).toHaveProperty('code','unsupported-byte-view');expect(traps).toBe(0);
 expect(decode(new Uint8Array(262145))).toHaveProperty('code','byte-capacity');
 expect(decode(new Uint8Array(new SharedArrayBuffer(0)))).toHaveProperty('code','unavailable-byte-storage');
});

test('paint projection extracts owned scalar and span arrays separately from minted helper',()=>{
 const r=decode(body(11,paint()));if(r.status==='unavailable'||r.branch!=='paint')throw Error('paint');
 expect(r.paintProjection.categoryIids).toEqual(r.paint.categoryIids);
 expect(r.paintProjection.categoryIids).not.toBe(r.paint.categoryIids);
 expect(r.paintProjection.annotations[0]!.occurrences).not.toBe(r.paint.annotations[0]!.occurrences);
 expect(r.paintProjection.bodySHA256).toBe(r.paint.bodySHA256);
});

test('every selected shell field refuses duplicate and wrong wire without normalizing absence',()=>{
 for(const n of [8,58,10,13,42,98,79,41,87,12,59]){
  const opaque=n===12||n===59;
  const good=opaque?body(n,new Uint8Array()):uint(n,0n);
  const wrong=opaque?uint(n,0n):body(n,new Uint8Array());
  expect(decode(join(good,good,body(11,paint())))).toHaveProperty('code','duplicate-selected-field');
  expect(decode(join(wrong,body(11,paint())))).toHaveProperty('code','selected-field-wrong-wire-type');
 }
 const r=decode(body(11,paint()));
 expect(r).toHaveProperty('fields',{});
});

test('body errors preserve helper diagnostics and prevent later revival',()=>{
 for(const phase of [new Uint8Array(),uint(2,81n),Uint8Array.of(16,210,0),Uint8Array.of(16,128)]){
  const original=paint();
  // The final source envelope is four bytes: field6/length2/16/82.
  const changed=join(original.subarray(0,original.length-4),body(6,phase));
  const a=api.createPaintPacketAdapter();
  const r=a.decode(body(11,changed));
  expect(r).toMatchObject({status:'unavailable',stage:'paint-body'});
  expect(a.decode(body(11,paint()))).toBe(r);
  expect(Reflect.set(r,'code','changed')).toBe(false);
 }
});

test('detached, subclass and hostile instance accessors keep intrinsic storage behavior',()=>{
 const d=new Uint8Array(1);structuredClone(d.buffer,{transfer:[d.buffer]});
 expect(decode(d)).toHaveProperty('code','unavailable-byte-storage');
 expect(decode(new (class extends Uint8Array {})())).toHaveProperty('code','unsupported-byte-view');
 const p=body(11,paint());let traps=0;
 const trap=()=>{traps++;throw Error('hook');};
 Object.defineProperties(p,{length:{get:trap},buffer:{get:trap},[Symbol.iterator]:{value:trap}});
 expect(decode(p)).toHaveProperty('branch','paint');expect(traps).toBe(0);
});
