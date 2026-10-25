import {expect,test,vi} from 'vitest';
import * as ordered from './browser-frame-ordered-state.js';
import * as reader from './browser-frame-whole-trace-reader.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
const POLICY='pinned-whole-trace-user-timing-evidence-diagnostic-v7';
const api=ordered as unknown as Record<string,any>,readApi=reader as unknown as Record<string,any>;
const packet=(seq:bigint,...extra:Uint8Array[])=>join(uint(10,seq),...extra);
const stream=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const snapshot=(...clocks:Uint8Array[])=>body(6,join(...clocks.map(c=>body(1,c))));
const clock=(id=3n)=>join(uint(1,id),uint(2,0n),uint(3,0n),uint(4,0n));
const mark=()=>packet(1n,uint(13,1n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase'))));
function study(b:Uint8Array,chunk=Math.min(32768,b.length||1)):any{expect(api.createWholeUserTimingStudyV7).toBeTypeOf('function');const s=api.createWholeUserTimingStudyV7(b.length,POLICY);for(let i=0;i<b.length;i+=chunk)s.feed(b.subarray(i,i+chunk));return s.finish();}
test('V7 inventories raw absence/false/zero without assigning clock authority',()=>{
 const b=stream(snapshot(clock(),new Uint8Array()),join(uint(98,0n),body(60,join(uint(1,0n),uint(5,0n),body(3,join(uint(1,0n),uint(7,0n))),body(4,join(uint(1,0n),uint(2,0n)))))),packet(8n,uint(87,1n),uint(42,1n),uint(58,0n),uint(8,0n),snapshot(clock(64n))),packet(8n,uint(13,1n),uint(42,0n),uint(87,0n),snapshot(new Uint8Array())));
 const r=study(b);expect(r).toMatchObject({policy:POLICY,status:'whole-annotation-study',evidenceInventory:{status:'complete-supported-observations'},sequenceStart:{explained:1},authority:{clock:'not_evaluated',FPS:'unavailable'}});
 const rows=r.evidenceInventory.observations;expect(rows).toHaveLength(4);
 expect(rows[0]).toMatchObject({kind:'clock_snapshot',machineContext:{status:'absent'},sequenceContext:{status:'absent'},packetFields:{},clocks:[{clockId:'3',timestamp:'0',isIncremental:false,unitMultiplierNs:'0'},{}]});
 expect(rows[0]).not.toHaveProperty('primaryTraceClock');expect(rows[0].clocks[0]).not.toHaveProperty('scope');
 expect(rows[1]).toMatchObject({kind:'track_descriptor',machineContext:{status:'present',machineId:'0'},sequenceContext:{status:'absent'},fields:{uuid:'0',parentUuid:'0',process:{pid:'0',startTimestampNs:'0'},thread:{pid:'0',tid:'0'}}});
 expect(rows[2]).toMatchObject({packetIndex:2,sequenceContext:{status:'present',sequenceId:'8',sequenceIndex:0,intervalVersion:1},packetFields:{timestamp:'0',timestampClockId:'0',firstPacketOnSequence:true,previousPacketDropped:'1'}});
 expect(rows[3]).toMatchObject({sequenceContext:{intervalVersion:2},packetFields:{firstPacketOnSequence:false,previousPacketDropped:'0',sequenceFlags:'1'},clocks:[{}]});
 for(const row of rows){expect(row.bodySha256).toMatch(/^[a-f0-9]{64}$/);expect(row).not.toHaveProperty('occurrences');expect(Object.isFrozen(row)).toBe(true);expect(Object.isFrozen(row.packetFields)).toBe(true);}
 expect(Object.isFrozen(rows[0].clocks[0])).toBe(true);expect(Object.isFrozen(rows)).toBe(true);
 expect(study(b,1)).toEqual({...r,counters:{...r.counters,feedCalls:b.length}});
});
test('V7 preserves the exact V6 state and manifests for a supported stream',()=>{const b=stream(mark(),packet(2n,uint(87,1n),uint(42,1n),snapshot(clock()))),s=ordered.createWholeUserTimingStudyV6(b.length,ordered.WHOLE_USER_TIMING_V6_POLICY);s.feed(b);const old=s.finish(),v7=study(b);const {evidenceInventory,policy,...rest}=v7;expect({...rest,policy:old.policy}).toEqual({...old,budgets:{...old.budgets,persistentUTF8:v7.budgets.persistentUTF8,repeated:v7.budgets.repeated}});expect(old).not.toHaveProperty('evidenceInventory');expect(()=>api.createWholeUserTimingStudyV7(0,old.policy)).toThrow('unsupported-policy');});
test('V7 prechecks the combined 128-row and total 512-clock limits and withdraws prefixes',()=>{
 const metadata=()=>body(60,new Uint8Array());
 expect(study(stream(...Array.from({length:128},metadata))).evidenceInventory.observations).toHaveLength(128);
 expect(study(stream(mark(),...Array.from({length:128},metadata),snapshot()))).toMatchObject({status:'unavailable',candidates:[],evidenceInventory:{status:'unavailable',observations:[]}});
 const four=()=>snapshot(...Array.from({length:4},(_,i)=>clock(BigInt(i+1))));
 expect(study(stream(...Array.from({length:128},four)))).toMatchObject({status:'unavailable',reason:'result-capacity',candidates:[],evidenceInventory:{status:'unavailable',observations:[]}});
 const many=()=>snapshot(...Array.from({length:64},(_,i)=>clock(BigInt(i+1))));
 expect(study(stream(...Array.from({length:8},many)))).toMatchObject({status:'whole-annotation-study'});
 expect(study(stream(mark(),...Array.from({length:8},many),snapshot(clock())))).toMatchObject({status:'unavailable',candidates:[],evidenceInventory:{status:'unavailable',observations:[]}});
});
test('semantic and physical malformed tails withdraw all retained evidence and marks',()=>{const prefix=stream(mark(),snapshot(clock()));for(const tail of [stream(packet(0n)),Uint8Array.of(10,2,0)])expect(study(join(prefix,tail))).toMatchObject({status:'unavailable',candidates:[],evidenceInventory:{status:'unavailable',observations:[]}});});
test('V7 joins source offsets/hash and exact machine-sequence intervals without inference',()=>{
 const raw=join(uint(2,3n),body(1,clock())),payload=body(6,raw),first=packet(8n,uint(58,3n),uint(8,0n),payload),second=packet(8n,uint(98,0n),uint(13,1n),payload),third=packet(8n,payload),b=stream(first,second,third),r=study(b),rows=r.evidenceInventory.observations;
 const payloadPrefix=first.length-payload.length,payloadHeader=payload.length-raw.length;
 expect(rows[0]).toMatchObject({bodySha256:createHash('sha256').update(first).digest('hex'),primaryTraceClock:'3',packetFields:{timestampClockId:'3',timestamp:'0'},location:{packetIndex:0,start:payloadPrefix,valueStart:payloadPrefix+payloadHeader,end:first.length},sequenceContext:{sequenceIndex:0,intervalVersion:0},machineContext:{status:'absent'}});
 expect(first.slice(rows[0].location.valueStart,rows[0].location.end)).toEqual(raw);
 expect(rows[1]).toMatchObject({machineContext:{status:'present',machineId:'0'},sequenceContext:{sequenceIndex:1,intervalVersion:1}});
 expect(rows[2]).toMatchObject({machineContext:{status:'absent'},sequenceContext:{sequenceIndex:0,intervalVersion:0}});
 expect(rows[2].packetFields).toEqual({});expect(rows[2].clocks).toEqual([{clockId:'3',timestamp:'0',isIncremental:false,unitMultiplierNs:'0'}]);
});
test('V7 semantic refusal continues physical packet framing and hashing',()=>{
 const b=stream(snapshot(clock()),packet(0n),snapshot(clock()));const r=study(b);expect(r).toMatchObject({status:'unavailable',framingBoundaryComplete:true,counters:{packets:3,processedPackets:1},inputRef:{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},evidenceInventory:{status:'unavailable',observations:[]}});
});
test('V7 original reader rejects other policies before opening any source',()=>{
 expect(readApi.readWholeUserTimingTraceV7({path:'/private/tmp/unread-authored',bytes:0,sha256:'0'.repeat(64)},ordered.WHOLE_USER_TIMING_V6_POLICY)).toMatchObject({status:'unavailable',reason:'invalid-reference',study:null,reader:{reads:0}});
});
test('reader wrapper output admission withdraws an otherwise admitted study inventory',()=>{
 const b=stream(...Array.from({length:126},()=>snapshot(...Array.from({length:4},(_,i)=>clock(BigInt(i+1)))))),s=study(b);
 expect(s).toMatchObject({status:'whole-annotation-study',evidenceInventory:{status:'complete-supported-observations'}});expect(s.evidenceInventory.observations).toHaveLength(126);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clock-evidence-wrapper-')),file=path.join(dir,'authored.bin');fs.writeFileSync(file,b);
 try{const ref={path:file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},r=readApi.readWholeUserTimingTraceV7(ref,POLICY);expect(r).toMatchObject({status:'unavailable',reason:'result-capacity',fullInputVerified:true,study:{status:'unavailable',reason:'result-capacity',candidates:[],evidenceInventory:{status:'unavailable',observations:[]}}});expect(Object.isFrozen(r.study.evidenceInventory.observations)).toBe(true);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test.each(['hash','close','read','drift','EOF'] as const)('V7 original reader clears evidence after %s failures',mode=>{
 expect(readApi.readWholeUserTimingTraceV7).toBeTypeOf('function');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clock-evidence-')),file=path.join(dir,'authored.bin'),b=stream(mark(),snapshot(clock()));fs.writeFileSync(file,b);const ref={path:file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
 try{expect(readApi.readWholeUserTimingTraceV7(ref,POLICY)).toMatchObject({status:'complete-whole-annotation-diagnostic',fullInputVerified:true,study:{evidenceInventory:{status:'complete-supported-observations'}}});if(mode==='hash')ref.sha256='0'.repeat(64);if(mode==='close'){const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored');});}if(mode==='read'){const readSync=fs.readSync;let calls=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(++calls===2)throw Error('authored');return readSync(...args);});}if(mode==='drift'){const stat=fs.fstatSync;let calls=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=stat(...args);if(++calls===2&&typeof s.ctimeNs==='bigint')s.ctimeNs++;return s;});}if(mode==='EOF'){const readSync=fs.readSync;let calls=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>++calls===2?1:readSync(...args));}expect(readApi.readWholeUserTimingTraceV7(ref,POLICY)).toMatchObject({status:'unavailable',study:{candidates:[],evidenceInventory:{status:'unavailable',observations:[]}}});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
});
