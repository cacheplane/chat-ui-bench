import { expect, test, vi as mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createPaintPacketAdapter, packetAdapterReservation } from './browser-frame-paint-packet-adapter.js';
import { BodyReader, WireBudget } from './browser-frame-protobuf-wire.js';
import { body, int32, join, text, uint, vi } from './browser-frame-packet-fragments.test-helper.js';
const source = (name: string) => readFileSync(new URL(`./${name}.ts`, import.meta.url),'utf8');
const paint = () => join(uint(3,1n),uint(3,2n),uint(3,3n),uint(10,4n),uint(11,0n),body(4,join(uint(1,5n),text(6,'frame'))),body(4,join(uint(1,6n),text(11,'opaque'))),body(6,uint(2,82n)));
const provenance = (payload=new Uint8Array()) => join(int32(3,0n),uint(8,17n),uint(10,1n),uint(58,6n),body(124,payload));
test('exact old 86 DATA roster and every collision retain physical error precedence',()=>{
 const roster=(s:string)=>JSON.parse('['+s.match(/const DATA = new Set\(\[([^\]]+)\]/)![1]+']') as number[];
 const old=roster(source('browser-frame-packet-fragments'));
 expect(old).toHaveLength(86);expect(roster(source('browser-frame-paint-packet-adapter'))).toEqual(old);
 for(const field of old.filter(n=>n!==11))for(const reverse of [false,true]){
  const parts=[body(field,new Uint8Array()),body(11,paint())];if(reverse)parts.reverse();
  const expected=!reverse&&[50,133,107,125].includes(field)?`unsupported-packet-payload-field-${field}`:'duplicate-data-oneof';
  expect(createPaintPacketAdapter().decode(join(...parts))).toHaveProperty('code',expected);
 }
});
test('provenance is granted once across interleaved paint and never revived after failure',()=>{
 const d=createPaintPacketAdapter();expect(d.decode(provenance())).toHaveProperty('branch','old');
 expect(d.decode(body(11,paint()))).toHaveProperty('branch','paint');
 const fail=d.decode(provenance());expect(fail).toHaveProperty('code','unsupported-packet-payload-field-124');
 expect(d.decode(join(uint(13,1n),uint(42,1n)))).toBe(fail);
 const malformed=createPaintPacketAdapter();const f=malformed.decode(provenance(body(2,body(1,uint(1,0n)))));
 expect(f).toHaveProperty('status','unavailable');expect(malformed.decode(provenance())).toBe(f);
});
test('runtime closure has exactly seven modules with no state/config/callback seam',()=>{
 const seen=new Set<string>();
 function visit(name:string){if(seen.has(name))return;seen.add(name);const s=source(name);for(const m of s.matchAll(/(?:from\s+|import\s*)['"]\.\/(browser-frame-[^'"]+)\.js['"]/g)){
  const line=s.slice(s.lastIndexOf('\n',m.index)+1,s.indexOf('\n',m.index));if(!line.startsWith('import type'))visit(m[1]!);
 }}
 visit('browser-frame-paint-packet-adapter');
 expect([...seen].sort()).toEqual(['browser-frame-paint-packet-adapter','browser-frame-packet-fragments','browser-frame-track-event-fragments','browser-frame-protobuf-fragments','browser-frame-trace-framer','browser-frame-protobuf-wire','browser-frame-paint-timing-r-fragments'].sort());
 const s=source('browser-frame-paint-packet-adapter');expect(s.match(/createWholeFramePresentedPacketDecoder\(\)/g)).toHaveLength(1);
 expect(s).toContain('function createPaintPacketAdapter()');expect(s).not.toMatch(/JSON\.|decodeWholeState|consumeOwned|\.slice\(/);
});
test('source topology and immutable old helpers pin reservation proof',()=>{
 // Reservation proof v2 audits adapter copies, hashes, UTF8 delegation and
 // traversal. Any source change requires explicit review of that proof.
 expect(createHash('sha256').update(source('browser-frame-paint-packet-adapter')).digest('hex'))
  .toBe('b779e7167f69e63e0070471ce47c567ffbcc532a61c990a89406291b7a80be9b');
 const pins:Record<string,string> = {
  "browser-frame-packet-fragments": "bff8611ca4a6933461d00c4c108ac13afc0ae02356fc5b1bb6d4dc27de896909",
  "browser-frame-track-event-fragments": "222da6353dd5f6d0b107227bf19ca63a764b131644823e85e6cff266e41e3c21",
  "browser-frame-protobuf-fragments": "f88b3233be5bff4b0abfe1cb7b4ede46080eeec27c340b43b7fdde3b753c6337",
  "browser-frame-trace-framer": "a10bf3bc680c10a7ecc336196d61578617d8ee0ccbe569025e2b114564372aa4",
  "browser-frame-protobuf-wire": "db48e75d1ddf63370b0302ec17447476d175440f86b08872ceee98e37dda8f3e",
  "browser-frame-paint-timing-r-fragments": "dda657add676c3e08e419606ca4c0a7d85e18c8929c73cffe8fbcea5e0a83aaa"
};
 for(const [name,sha] of Object.entries(pins))expect(createHash('sha256').update(source(name)).digest('hex')).toBe(sha);
 const s=source('browser-frame-paint-packet-adapter');expect(s).toContain('bytes.subarray(event!.valueStart, event!.end)');
 expect(s.indexOf('i < 13')).toBeLessThan(s.indexOf('const shell = new BodyReader'));
 expect(s.indexOf('i < 5')).toBeLessThan(s.indexOf('const shell = new BodyReader'));
});
test('test-only byte cursor and charge instrumentation bounds old typed, packed, annotations, provenance and failures',()=>{
 const modern=join(body(3,join(vi(1n),vi(2n))),text(22,'cat'),uint(9,3n),text(23,'event'),
  body(4,join(uint(1,1n),text(6,'a'))),body(4,join(uint(1,2n),text(6,'b'))),body(1075,uint(1,1n)),body(1052,body(8,join(vi(1n),vi(2n)))));
 const fixtures=[new Uint8Array(),Uint8Array.of(128),Uint8Array.of(0),body(11,modern),body(11,paint()),provenance(),
  provenance(body(2,body(1,join(uint(1,0n),int32(2,-1n))))),
  provenance(body(2,body(1,uint(1,0n)))),body(11,join(modern,Uint8Array.of(128))),
  body(11,join(modern,body(1052,new Uint8Array()))),
  join(...Array.from({length:8180},()=>uint(19000,0n)),body(11,paint()))];
 for(const bytes of fixtures){
  let reads=0,fields=0,members=0;
  const original=BodyReader.prototype.varint;
  const v=mock.spyOn(BodyReader.prototype,'varint').mockImplementation(function(this:BodyReader){const at=this.position;try{return original.call(this);}finally{reads+=this.position-at;}});
  const cf=WireBudget.prototype.chargeOccurrence,cm=WireBudget.prototype.chargeMember;
  const f=mock.spyOn(WireBudget.prototype,'chargeOccurrence').mockImplementation(function(this:WireBudget){fields++;return cf.call(this);});
  const m=mock.spyOn(WireBudget.prototype,'chargeMember').mockImplementation(function(this:WireBudget){members++;return cm.call(this);});
  let r;try{r=createPaintPacketAdapter().decode(bytes);}finally{v.mockRestore();f.mockRestore();m.mockRestore();}
  const reservation=packetAdapterReservation(bytes.length);if('status' in reservation)throw Error('reservation');
  expect(reads).toBeLessThanOrEqual(reservation.wireByteReads);
  expect(fields+1).toBeLessThanOrEqual(reservation.fieldChargeWork);
  expect(members+1).toBeLessThanOrEqual(reservation.memberChargeWork);
  if(bytes===fixtures[3]){expect(r).toHaveProperty('branch','old');expect(r).toMatchObject({usage:{members:7}});}
 }
});
test('one-byte malformed tag oracle reads exactly one byte and zero-size old reads none',()=>{
 for(const [bytes,expected] of [[Uint8Array.of(128),1],[new Uint8Array(),0]] as const){
 let reads=0;const old=BodyReader.prototype.varint;
 const spy=mock.spyOn(BodyReader.prototype,'varint').mockImplementation(function(this:BodyReader){const p=this.position;try{return old.call(this);}finally{reads+=this.position-p;}});
 try{createPaintPacketAdapter().decode(bytes);expect(reads).toBe(expected);}finally{spy.mockRestore();}
 }
});
