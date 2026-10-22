import {expect,test,vi as mock} from 'vitest';
import * as decoders from './browser-frame-packet-fragments.js';
import * as ordered from './browser-frame-ordered-state.js';
import * as readers from './browser-frame-whole-trace-reader.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {body,int32,join,tag,text,uint,vi} from './browser-frame-packet-fragments.test-helper.js';

const entry=(...fields:Uint8Array[])=>body(1,join(...fields));
const buffer=(...entries:Uint8Array[])=>body(2,join(...entries));
const provenance=(payload=new Uint8Array(),...header:Uint8Array[])=>join(int32(3,0n),uint(8,17n),uint(10,1n),uint(58,6n),body(124,payload),...header);
function decoder():any {
 const factory=(decoders as unknown as Record<string,any>).createWholeProvenancePacketDecoder;
 expect(factory).toBeTypeOf('function');return factory();
}
const denied=(decode:any,input:Uint8Array,code='unsupported-packet-payload-field-124')=>expect(decode(input,()=>{})).toEqual({status:'unavailable',diagnostics:[{code}]});

test('fixed provenance profile validates an empty emitter-shaped provenance packet without selecting identities',()=>{
 const r=decoder()(provenance(),()=>{});
 expect(r).toMatchObject({status:'decoded_packet_fragment',fields:{timestamp:'17',sequenceId:'1',timestampClockId:'6'}});
 expect(r.fields).not.toHaveProperty('trustedPid');expect(r.skippedFields.map((f:any)=>f.fieldNumber)).toEqual([3,124]);
});
test('nested buffers and canonical signed producer domains are validated without retained IDs',()=>{
 for(const producer of [-2147483648n,-1n,0n,2147483647n]){
  const r=decoder()(provenance(join(buffer(),buffer(entry(uint(1,0n),int32(2,producer)),entry(uint(1,4294967295n),int32(2,producer))))),()=>{});
  expect(r.status).toBe('decoded_packet_fragment');expect(r).not.toHaveProperty('provenance');
 }
});
test('all five outer fields may be permuted, but no sixth, absent, duplicate or foreign header is admitted',()=>{
 const fields=[int32(3,-1n),uint(8,18446744073709551615n),uint(10,1n),uint(58,6n),body(124,new Uint8Array())];
 expect(decoder()(join(...fields.toReversed()),()=>{}).status).toBe('decoded_packet_fragment');
 for(let i=0;i<fields.length;i++){
  if(i===4)expect(decoder()(join(...fields.filter((_,j)=>j!==i)),()=>{}).status).toBe('decoded_packet_fragment');
  else denied(decoder(),join(...fields.filter((_,j)=>j!==i)));
  denied(decoder(),join(...fields,fields[i]!));
 }
 for(const field of [uint(98,0n),uint(13,1n),uint(42,1n),body(59,new Uint8Array()),uint(19000,0n)])denied(decoder(),provenance(new Uint8Array(),field));
});
test('strict header wrong wire, value and canonical numeric errors refuse before reducer commit',()=>{
 for(const extra of [uint(10,0n),uint(58,0n)]){
  const field=extra[0]===80?10:58;
  const parts=[int32(3,0n),uint(8,17n),uint(10,1n),uint(58,6n),body(124,new Uint8Array())];
  denied(decoder(),join(...parts.filter((_,i)=>i!==(field===10?2:3)),extra));
 }
 denied(decoder(),join(uint(3,2147483648n),uint(8,17n),uint(10,1n),uint(58,6n),body(124,new Uint8Array())),'int32-overflow');
 denied(decoder(),join(body(3,new Uint8Array()),uint(8,17n),uint(10,1n),uint(58,6n),body(124,new Uint8Array())),'selected-field-wrong-wire-type');
 denied(decoder(),join(int32(3,0n),uint(8,17n),uint(10,1n),uint(58,6n),uint(124,0n)),'selected-field-wrong-wire-type');
});
test('nested missing, duplicate, unknown, wrong wire and overflowing sequence fields refuse',()=>{
 for(const payload of [uint(2,0n),body(3,new Uint8Array()),buffer(uint(1,0n)),buffer(body(2,new Uint8Array())),buffer(entry()),buffer(entry(uint(1,0n))),buffer(entry(int32(2,0n))),buffer(entry(uint(1,0n),uint(1,1n),int32(2,0n))),buffer(entry(uint(1,0n),int32(2,0n),uint(3,0n)))])denied(decoder(),provenance(payload));
 denied(decoder(),provenance(buffer(entry(uint(1,4294967296n),int32(2,0n)))),'uint32-overflow');
 denied(decoder(),provenance(buffer(entry(uint(1,0n),uint(2,2147483648n)))),'int32-overflow');
 denied(decoder(),provenance(join(tag(2,2),vi(1n))),'out-of-bounds-length');
});
test('the nested32 subset charges each visited field and refuses before a33rd read',()=>{
 let work=0;
 expect(decoder()(provenance(join(...Array.from({length:32},()=>buffer()))),(n:number)=>{work+=n;}).status).toBe('decoded_packet_fragment');
 expect(work).toBe(37);
 const tenSequences=Array.from({length:10},()=>entry(uint(1,0n),int32(2,0n)));
 expect(decoder()(provenance(join(buffer(...tenSequences),buffer())),()=>{}).status).toBe('decoded_packet_fragment');
 denied(decoder(),provenance(join(buffer(...tenSequences),buffer(),buffer())));
 denied(decoder(),provenance(join(...Array.from({length:33},()=>buffer()))));
 // The33rd field is malformed: subset refusal must occur before its wire read.
 let refusedWork=0;
 denied((input:Uint8Array)=>decoder()(input,()=>{refusedWork++;}),provenance(join(...Array.from({length:32},()=>buffer()),Uint8Array.of(0))));
 expect(refusedWork).toBe(37);
});
test('one gate belongs to each decoder, survives other packets, and second124 fails before nested work',()=>{
 const decode=decoder();expect(decode(provenance(),()=>{}).status).toBe('decoded_packet_fragment');
 expect(decode(uint(10,2n),()=>{}).status).toBe('decoded_packet_fragment');
 let work=0;denied((input:Uint8Array)=>decode(input,()=>{work++;}),provenance(buffer(entry(uint(1,0n),int32(2,0n)))));expect(work).toBe(0);
 expect(decoder()(provenance(),()=>{}).status).toBe('decoded_packet_fragment');
});
test('old V3 remains refusing124; fixed provenance profile keeps all four other refusals and oneof safety',()=>{
 expect(decoders.decodeWholeUserTimingPacketV3(provenance(),()=>{})).toEqual({status:'unavailable',diagnostics:[{code:'unsupported-packet-payload-field-124'}]});
 for(const f of [50,133,107,125])denied(decoder(),body(f,new Uint8Array()),'unsupported-packet-payload-field-'+f);
 for(const input of [join(body(6,new Uint8Array()),provenance()),join(provenance(),body(6,new Uint8Array()))])denied(decoder(),input);
});
test('nested repeated singular fields, scalar wires and truncated child windows keep bounded failures',()=>{
 denied(decoder(),provenance(buffer(entry(uint(1,0n),int32(2,0n),int32(2,1n)))));
 denied(decoder(),provenance(buffer(entry(body(1,new Uint8Array()),int32(2,0n)))),'selected-field-wrong-wire-type');
 denied(decoder(),provenance(buffer(entry(uint(1,0n),body(2,new Uint8Array())))),'selected-field-wrong-wire-type');
 denied(decoder(),provenance(buffer(join(tag(1,2),vi(2n),Uint8Array.of(8)))),'out-of-bounds-length');
 denied(decoder(),provenance(buffer(entry(join(tag(1,0),Uint8Array.of(128))))),'truncated-varint');
 const decode=decoder();denied(decode,provenance(buffer(entry())));denied(decode,provenance());
});
const policy='pinned-whole-trace-user-timing-marks-diagnostic-v4';
function study(bytes:Uint8Array,split=bytes.length):any{
 const create=(ordered as unknown as Record<string,any>).createWholeUserTimingStudyV4;
 expect(create).toBeTypeOf('function');const s=create(bytes.length,policy);
 s.feed(bytes.subarray(0,split));s.feed(bytes.subarray(split));return s.finish();
}
const mark=()=>join(uint(10,1n),uint(13,1n),uint(8,23n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase'))));
test('V4 alone admits provenance while preserving subsequent mark, clock and sequence processing',()=>{
 const b=join(body(1,provenance()),body(1,mark()));
 const result=study(b);expect(result).toMatchObject({policy,status:'whole-annotation-study',candidates:[{value:'phase',sequenceId:'1',rawTimestamp:'23'}],counters:{packets:2,processedPackets:2}});
 const old=ordered.createWholeUserTimingStudyV3(b.length,ordered.WHOLE_USER_TIMING_V3_POLICY);old.feed(b);expect(old.finish()).toMatchObject({status:'unavailable',candidates:[],diagnostics:[{cause:'unsupported-packet-payload-field-124'}]});
 for(let split=0;split<=b.length;split++)expect(study(b,split)).toEqual(result);
});
test('prior intern/default state survives provenance and ordinary reducer effects match an opaque control packet',()=>{
 const definitions=body(12,join(body(2,join(uint(1,1n),text(2,'phase'))),body(1,join(uint(1,2n),text(2,'blink.user_timing')))));
 const initial=join(uint(10,1n),uint(13,1n),definitions,body(59,join(uint(58,3n),body(11,uint(11,7n)))));
 const event=join(uint(10,1n),uint(8,23n),body(11,join(uint(9,3n),uint(3,2n),uint(10,1n))));
 const b=join(body(1,initial),body(1,provenance()),body(1,event)),r=study(b);
 expect(r).toMatchObject({status:'whole-annotation-study',candidates:[{value:'phase',nameSource:'intern',clockId:'3',clockSource:'defaults',trackUuid:'7',sequenceId:'1',rawTimestamp:'23'}],counters:{processedPackets:3}});
 const control=join(body(1,initial),body(1,join(int32(3,0n),uint(8,17n),uint(10,1n),uint(58,6n),body(19000,new Uint8Array()))),body(1,event));
 const v3=ordered.createWholeUserTimingStudyV3(control.length,ordered.WHOLE_USER_TIMING_V3_POLICY);v3.feed(control);expect(r.candidates).toEqual(v3.finish().candidates);
});
test('V4 provenance cannot renew through chunks, intervening sequence resets, or completed mark prefixes',()=>{
 for(const between of [new Uint8Array(),body(1,join(uint(10,2n),uint(13,1n))),body(1,mark())]){
  const b=join(body(1,provenance()),between,body(1,provenance()),body(1,mark()));
  expect(study(b,3)).toMatchObject({status:'unavailable',framingBoundaryComplete:true,candidates:[],diagnostics:[{cause:'unsupported-packet-payload-field-124'}]});
 }
});
test.each([50,133,107,125])('V4 refuses field%i on either side of provenance and withholds any earlier mark',field=>{
 for(const packets of [[body(field,new Uint8Array()),provenance()],[provenance(),mark(),body(field,new Uint8Array())]]){
  const b=join(...packets.map(p=>body(1,p)));
  expect(study(b)).toMatchObject({status:'unavailable',framingBoundaryComplete:true,candidates:[],diagnostics:[{cause:'unsupported-packet-payload-field-'+field}]});
 }
});
test('V4 original owned reader verifies complete tail after malformed provenance and preserves physical errors',()=>{
 const read=(readers as unknown as Record<string,any>).readWholeUserTimingTraceV4;expect(read).toBeTypeOf('function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'provenance-authored-')),p=path.join(dir,'authored.bin');
 const b=join(body(1,mark()),body(1,provenance(buffer(entry()))),body(1,body(19000,new Uint8Array(70000))));fs.writeFileSync(p,b);
 const ref={path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},originalRead=fs.readSync;
 mock.spyOn(fs,'readSync').mockImplementation((fd,buf,off,len,pos)=>originalRead(fd,buf,off,Math.min(31,len),pos));
 try{
  expect(read(ref,policy)).toMatchObject({status:'unavailable',fullInputVerified:true,structuralContainerEOF:true,reader:{bytes:b.length,EOF:true,closed:true,hashMatch:true,identityMatch:true},study:{candidates:[],counters:{packets:3,decodedPackets:2,processedPackets:1},diagnostics:[{cause:'unsupported-packet-payload-field-124'}]}});
  expect(read({...ref,sha256:'0'.repeat(64)},policy)).toMatchObject({status:'unavailable',reason:'reader-hash',study:{candidates:[]}});
 }finally{mock.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
});
