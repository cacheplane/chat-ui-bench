import {expect,test,vi} from 'vitest';
import * as ordered from './browser-frame-ordered-state.js';
import * as reader from './browser-frame-whole-trace-reader.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
const POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v6';
const packet=(seq:bigint,...extra:Uint8Array[])=>join(uint(10,seq),...extra);
const mark=()=>packet(1n,uint(13,1n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase'))));
const stream=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const api=ordered as unknown as Record<string,any>;
test('V6 does not extend the legacy closed failure membership',()=>{expect(ordered.isClosedStudyFailureCode('contradictory-first-packet')).toBe(false);});
function study(b:Uint8Array,chunk=Math.min(32768,b.length||1)):any{expect(api.createWholeUserTimingStudyV6).toBeTypeOf('function');const s=api.createWholeUserTimingStudyV6(b.length,POLICY);for(let i=0;i<b.length;i+=chunk)s.feed(b.subarray(i,i+chunk));const r=s.finish();expect(r.sequenceStart.raw).toBe(r.sequenceStart.explained+r.sequenceStart.unexplained);return r;}
test('V6 classifies a genuine late sequence start without rewriting V5 raw loss meaning',()=>{
 const b=stream(mark(),packet(15n,uint(87,1n),uint(42,1n))),v6=study(b),v5=ordered.createWholeUserTimingStudyV5(b.length,ordered.WHOLE_USER_TIMING_V5_POLICY);v5.feed(b);
 expect(v6).toMatchObject({policy:POLICY,status:'whole-annotation-study',counters:{losses:1},sequenceStart:{raw:1,explained:1,unexplained:0,contradictions:0},candidates:[{value:'phase'}],authority:{FPS:'unavailable',nativeGO:false,scoringEligibility:false}});
 const old=v5.finish();expect(old.counters.losses).toBe(1);expect(old).not.toHaveProperty('sequenceStart');expect(v6.transitionManifestSHA256).not.toBe(old.transitionManifestSHA256);
});
test.each([[],[uint(87,0n)],[uint(87,1n),uint(42,257n)]].map(extra=>({extra})))('V6 never explains missing/false first declarations or nonordinary drop %#',({extra})=>{
 const r=study(stream(mark(),packet(2n,...(extra.length===2?extra:[uint(42,1n),...extra]))));expect(r).toMatchObject({sequenceStart:{explained:0,unexplained:1}});
});
test.each([[],[uint(13,1n)],[uint(42,1n)],[uint(13,1n),uint(42,1n)]].map(extra=>({extra})))('a renewed true first declaration after any same-key history withdraws candidates %#',({extra})=>{
 const b=stream(mark(),packet(2n),packet(2n,uint(87,1n),...extra));for(const chunk of [b.length,1])expect(study(b,chunk)).toMatchObject({status:'unavailable',reason:'invalid-whole-annotation-input',candidates:[],sequenceStart:{contradictions:1}});
});
test('a first declaration without drop never grants loss exemption or state recovery',()=>{const defaults=body(59,join(uint(58,3n),body(11,uint(11,7n)))),event=body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase')));expect(study(stream(packet(2n,uint(87,1n),defaults,event)))).toMatchObject({status:'whole-annotation-study',sequenceStart:{raw:0,explained:0,unexplained:0,contradictions:0},candidates:[{clockId:null,trackUuid:null}]});});
test('first-observation identity distinguishes absent machine, present zero and other machines',()=>{
 const b=stream(mark(),packet(2n),packet(2n,uint(98,0n),uint(87,1n),uint(42,1n)),packet(2n,uint(98,3n),uint(87,1n),uint(42,1n)));
 expect(study(b)).toMatchObject({status:'whole-annotation-study',sequenceStart:{explained:2,unexplained:0,contradictions:0}});
});
test('startup alone leaves dependent defaults invalid and reset retains its original priority',()=>{
 const defaults=body(59,join(uint(58,3n),body(11,uint(11,7n)))),event=body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase')));
 const first=study(stream(packet(2n,uint(87,1n),uint(42,1n),defaults,event)));expect(first).toMatchObject({status:'whole-annotation-study',candidates:[{trackUuid:null,clockId:null}],counters:{losses:1}});
 const reset=study(stream(packet(2n,uint(87,1n),uint(42,1n),uint(13,1n),defaults,event)));expect(reset).toMatchObject({candidates:[{trackUuid:'7',clockId:'3'}],counters:{losses:0,resets:1},sequenceStart:{raw:0,explained:0,unexplained:0}});
});
test.each([packet(0n,uint(87,1n)),join(uint(87,1n),body(11,new Uint8Array())),packet(2n,uint(87,2n)),packet(2n,uint(13,4n))])('V6 retains existing invalid sequence/flag failures %#',bad=>expect(study(stream(mark(),bad))).toMatchObject({status:'unavailable',candidates:[]}));
test('V6 counter defaults remain metadata only and a malformed tail withdraws the prefix',()=>{
 const prefix=stream(packet(1n,uint(13,1n),body(59,body(11,join(uint(11,7n),uint(31,99n))))),mark());expect(study(prefix)).toMatchObject({status:'whole-annotation-study',candidates:[{value:'phase'}]});expect(study(join(prefix,Uint8Array.of(10,2,0)))).toMatchObject({status:'unavailable',candidates:[]});expect(()=>api.createWholeUserTimingStudyV6(0,ordered.WHOLE_USER_TIMING_V5_POLICY)).toThrow('unsupported-policy');
});
test('V6 retains the exact 64-sequence bound and withdraws the candidate on sequence 65',()=>{
 const packets=[mark(),...Array.from({length:63},(_,i)=>packet(BigInt(i+2),uint(87,1n),uint(42,1n)))];expect(study(stream(...packets))).toMatchObject({status:'whole-annotation-study',budgets:{sequences:64},sequenceStart:{raw:63,explained:63,unexplained:0}});expect(study(stream(...packets,packet(65n,uint(87,1n))))).toMatchObject({status:'unavailable',reason:'sequence-capacity',candidates:[]});
});
test('V6 repeated-work exhaustion at final ledger admission fails closed instead of throwing',()=>{
 const defaults=(n:number)=>packet(1n,uint(13,1n),body(59,body(11,body(31,new Uint8Array(n))))),overhead=study(stream(...Array.from({length:16},()=>defaults(0)))).budgets.repeated,tail=65536-15*4096-overhead,prefix=Array.from({length:15},()=>defaults(4096));expect(tail).toBeGreaterThan(0);
 expect(study(stream(...prefix,defaults(tail)))).toMatchObject({status:'whole-annotation-study',budgets:{repeated:65536}});expect(study(stream(...prefix,defaults(tail+1)))).toMatchObject({status:'unavailable',reason:'repeated-work-capacity',candidates:[]});
});
test('V6 preserves candidate 128/129 withdrawal and bounded escaped output',()=>{
 expect(study(stream(...Array.from({length:128},mark)))).toMatchObject({status:'whole-annotation-study',budgets:{candidateRows:128}});expect(study(stream(...Array.from({length:129},mark)))).toMatchObject({status:'unavailable',reason:'candidate-capacity',candidates:[]});
 const escaped=packet(1n,uint(13,1n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'\0'.repeat(4096))))),r=study(stream(...Array.from({length:4},()=>escaped)));expect(r.status).toBe('whole-annotation-study');expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(262144);expect(study(stream(...Array.from({length:5},()=>escaped)))).toMatchObject({status:'unavailable',reason:'candidate-string-capacity',candidates:[]});
});
test('V6 startup cannot revive intern dependencies; only reset and redefinition recover them',()=>{
 const definition=body(12,body(2,join(uint(1,1n),text(2,'phase')))),event=body(11,join(uint(9,3n),text(22,'blink.user_timing'),uint(10,1n))),first=packet(2n,uint(87,1n),uint(42,1n),definition,event),r=study(stream(first,packet(2n,uint(13,1n),definition,event)));
 expect(r.status).toBe('whole-annotation-study');expect(r.candidates).toHaveLength(2);expect(r.candidates[0]).toMatchObject({kind:'withheld',value:null});expect(r.candidates[1]).toMatchObject({kind:'literal_string',value:'phase',nameSource:'intern'});expect(r.markInventoryAdmission).toBe('withheld');
});
test.each(['hash','close','read','drift','EOF'] as const)('V6 original reader withdraws candidates on late physical %s failure',mode=>{
 const read=(reader as unknown as Record<string,any>).readWholeUserTimingTraceV6;expect(read).toBeTypeOf('function');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sequence-start-authored-')),file=path.join(dir,'authored.bin'),b=stream(mark(),packet(2n,uint(87,1n),uint(42,1n)));fs.writeFileSync(file,b);const ref={path:file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
 try{expect(read(ref,POLICY)).toMatchObject({status:'complete-whole-annotation-diagnostic',fullInputVerified:true,reader:{EOF:true,closed:true},study:{sequenceStart:{explained:1}}});if(mode==='hash')ref.sha256='0'.repeat(64);if(mode==='close'){const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored');});}if(mode==='read'){const readSync=fs.readSync;let calls=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(++calls===2)throw Error('authored');return readSync(...args);});}if(mode==='drift'){const stat=fs.fstatSync;let calls=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=stat(...args);if(++calls===2&&typeof s.ctimeNs==='bigint')s.ctimeNs++;return s;});}if(mode==='EOF'){const readSync=fs.readSync;let calls=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>++calls===2?1:readSync(...args));}expect(read(ref,POLICY)).toMatchObject({status:'unavailable',study:{candidates:[]}});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
});
