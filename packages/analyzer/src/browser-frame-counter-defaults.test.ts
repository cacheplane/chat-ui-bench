import {expect,test,vi as mock} from 'vitest';
import * as ordered from './browser-frame-ordered-state.js';
import * as readers from './browser-frame-whole-trace-reader.js';
import {body,join,text,uint,vi,tag} from './browser-frame-packet-fragments.test-helper.js';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
const POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v5';
const defaults=(...fields:Uint8Array[])=>join(uint(10,1n),uint(13,1n),body(59,join(uint(58,3n),body(11,join(uint(11,7n),...fields)))));
const mark=(...extra:Uint8Array[])=>join(uint(10,1n),uint(8,23n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase'),...extra)));
const stream=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
function study(bytes:Uint8Array):any{const create=(ordered as unknown as Record<string,any>).createWholeUserTimingStudyV5;expect(create).toBeTypeOf('function');const s=create(bytes.length,POLICY);for(let i=0;i<bytes.length;i+=32768)s.feed(bytes.subarray(i,i+32768));return s.finish();}
test('V5 validates counter defaults and retains only primary-track UserTiming mark metadata',()=>{
 const b=stream(defaults(uint(31,5712889379782234n)),mark());
 expect(study(b)).toMatchObject({policy:POLICY,status:'whole-annotation-study',candidates:[{value:'phase',clockId:'3',clockSource:'defaults',trackUuid:'7',trackSource:'defaults',representation:'event_name'}],authority:{FPS:'unavailable'}});
 const legacy=ordered.createWholeUserTimingStudyV4(b.length,ordered.WHOLE_USER_TIMING_V4_POLICY);legacy.feed(b);expect(legacy.finish()).toMatchObject({status:'unavailable',reason:'unsupported-counter-defaults',candidates:[]});
});
test('V5 original owned reader uses the explicit profile and preserves whole-file hash and EOF',()=>{
 const read=(readers as unknown as Record<string,any>).readWholeUserTimingTraceV5;expect(read).toBeTypeOf('function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'counter-defaults-authored-')),file=path.join(dir,'authored.bin'),b=stream(defaults(uint(31,0n)),mark());
 try{fs.writeFileSync(file,b);expect(read({path:file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},POLICY)).toMatchObject({policy:POLICY,status:'complete-whole-annotation-diagnostic',fullInputVerified:true,reader:{EOF:true,closed:true,hashMatch:true},study:{status:'whole-annotation-study',candidates:[{value:'phase'}]}});}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const packed=(field:number,...values:bigint[])=>body(field,join(...values.map(vi)));
test('V5 validates packed, unpacked and split lists including zero, repeats and maximum uint64 without retaining them',()=>{
 for(const fields of [[uint(31,0n),uint(31,18446744073709551615n),uint(31,0n)],[packed(31,0n,18446744073709551615n),packed(31,0n)],[uint(45,0n),packed(45,18446744073709551615n,0n)],[packed(31),packed(45)]]){
  const r=study(stream(defaults(...fields),mark()));expect(r.status).toBe('whole-annotation-study');expect(r.candidates).toHaveLength(1);expect(r.candidates[0]).toMatchObject({value:'phase',trackUuid:'7',clockId:'3'});expect(JSON.stringify(r)).not.toContain('counterTrackUuids');expect(JSON.stringify(r)).not.toContain('doubleCounterTrackUuids');expect(JSON.stringify(r)).not.toContain('18446744073709551615');
 }
});
test('one bounded presence/count digest note distinguishes empty presence while original body hashes bind values and packing',()=>{
 const prototype=Object.getPrototypeOf(createHash('sha256')),update=prototype.update,calls:unknown[]=[];
 const spy=mock.spyOn(prototype,'update').mockImplementation(function(this:any,data:any,...args:any[]){calls.push(data);return update.call(this,data,...args);});
 try{
  const absent=study(stream(defaults(),mark()));expect(calls.filter(x=>x==='counter-defaults\n')).toHaveLength(0);
  calls.length=0;const empty=study(stream(defaults(packed(31),packed(45)),mark())),at=calls.indexOf('counter-defaults\n');expect(at).toBeGreaterThanOrEqual(0);expect(calls.slice(at,at+6)).toEqual(['counter-defaults\n','t;','i0;','t;','i0;','\n']);expect(calls.filter(x=>x==='counter-defaults\n')).toHaveLength(1);expect(empty.budgets.repeated).toBe(absent.budgets.repeated+1);expect(empty.budgets.persistentUTF8).toBe(absent.budgets.persistentUTF8);expect(empty.transitionManifestSHA256).not.toBe(absent.transitionManifestSHA256);
  const a=study(stream(defaults(uint(31,12345678901234567n),uint(31,9n)),mark())),b=study(stream(defaults(uint(31,9n),uint(31,12345678901234567n)),mark())),c=study(stream(defaults(packed(31,12345678901234567n,9n)),mark()));
  expect(calls).not.toContain('12345678901234567');expect(a.candidates).toEqual(b.candidates);expect(a.candidates).toEqual(c.candidates);expect(a.transitionManifestSHA256).not.toBe(b.transitionManifestSHA256);expect(a.packetManifestSHA256).not.toBe(c.packetManifestSHA256);
 }finally{spy.mockRestore();}
});
test.each([join(tag(31,5),new Uint8Array(4)),body(31,Uint8Array.of(128)),body(45,Uint8Array.from([...Array(9).fill(255),2]))])('V5 selected counter wire errors refuse and withdraw earlier marks %#',field=>{
 const r=study(stream(mark(),defaults(field),mark()));expect(r).toMatchObject({status:'unavailable',framingBoundaryComplete:true,candidates:[],diagnostics:[{component:'defaults'}]});expect(r.diagnostics[0].cause).toMatch(/selected-field-wrong-wire-type|truncated-varint|uint64-varint-overflow/);
});
test('V5 preserves duplicate primary track and clock refusal rather than replacing primary defaults',()=>{
 for(const b of [stream(defaults(uint(31,1n),uint(11,8n)),mark()),stream(join(uint(10,1n),uint(13,1n),body(59,join(uint(58,3n),uint(58,4n),body(11,uint(31,1n))))),mark())])expect(study(b)).toMatchObject({status:'unavailable',candidates:[],diagnostics:[{cause:'duplicate-selected-field'}]});
});
test('V5 exact per-body counter member limit is shared between both lists and refuses first excess',()=>{
 expect(study(stream(defaults(body(31,new Uint8Array(4096))),mark())).status).toBe('whole-annotation-study');
 expect(study(stream(defaults(body(31,new Uint8Array(2048)),body(45,new Uint8Array(2048))),mark())).status).toBe('whole-annotation-study');
 expect(study(stream(defaults(body(31,new Uint8Array(4096)),uint(45,0n)),mark()))).toMatchObject({status:'unavailable',candidates:[],diagnostics:[{cause:'member-capacity'}]});
});
test('V5 charges the extra note against the exact global repeated-work bound before hashing it',()=>{
 const zero=study(stream(...Array.from({length:16},()=>defaults(body(31,new Uint8Array()))))),overhead=zero.budgets.repeated,tail=65536-15*4096-overhead;
 expect(tail).toBeGreaterThan(0);const prefix=Array.from({length:15},()=>defaults(body(31,new Uint8Array(4096))));
 const exact=study(stream(...prefix,defaults(body(31,new Uint8Array(tail)))));expect(exact.status,JSON.stringify({overhead,tail,reason:exact.reason,diagnostics:exact.diagnostics,budget:exact.budgets})).toBe('whole-annotation-study');expect(exact.budgets.repeated).toBe(65536);
 const prototype=Object.getPrototypeOf(createHash('sha256')),update=prototype.update;let notes=0;const spy=mock.spyOn(prototype,'update').mockImplementation(function(this:any,data:any,...args:any[]){if(data==='counter-defaults\n')notes++;return update.call(this,data,...args);});
 try{expect(study(stream(...prefix,defaults(body(31,new Uint8Array(tail+1)))))).toMatchObject({status:'unavailable',reason:'repeated-work-capacity',candidates:[]});expect(notes).toBe(15);}finally{spy.mockRestore();}
});
test('V5 emits at most 1024 counter notes and refuses next default before an additional note',()=>{
 const prototype=Object.getPrototypeOf(createHash('sha256')),update=prototype.update;let notes=0;const spy=mock.spyOn(prototype,'update').mockImplementation(function(this:any,data:any,...args:any[]){if(data==='counter-defaults\n')notes++;return update.call(this,data,...args);});
 try{const packets=Array.from({length:1024},()=>defaults(packed(31)));expect(study(stream(...packets)).status).toBe('whole-annotation-study');expect(notes).toBe(1024);notes=0;expect(study(stream(...packets,defaults(packed(31))))).toMatchObject({status:'unavailable',reason:'defaults-capacity',candidates:[]});expect(notes).toBe(1024);}finally{spy.mockRestore();}
});
test('V5 keeps counter events opaque and never promotes type4 as a mark or counter identity',()=>{
 const counter=join(uint(10,1n),uint(8,24n),body(11,join(uint(9,4n),text(22,'blink.user_timing'),text(23,'counter-name'),uint(30,999n))));
 const r=study(stream(defaults(uint(31,99n)),counter,mark(uint(31,999n),uint(30,77n))));expect(r.status).toBe('whole-annotation-study');expect(r.candidates).toHaveLength(1);expect(r.candidates[0]).toMatchObject({value:'phase',trackUuid:'7'});
});
test('V5 preserves whole-tail refusal, explicit policy selection and V1–V4 counter-default failures',()=>{
 const b=stream(defaults(uint(31,1n)),mark(),body(125,new Uint8Array()));expect(study(b)).toMatchObject({status:'unavailable',framingBoundaryComplete:true,candidates:[],diagnostics:[{cause:'unsupported-packet-payload-field-125'}]});
 for(const [create,policy]of [[ordered.createWholeAnnotationStudy,ordered.WHOLE_ANNOTATION_POLICY],[ordered.createWholeUserTimingStudy,ordered.WHOLE_USER_TIMING_POLICY],[ordered.createWholeUserTimingStudyV3,ordered.WHOLE_USER_TIMING_V3_POLICY],[ordered.createWholeUserTimingStudyV4,ordered.WHOLE_USER_TIMING_V4_POLICY]]as const){const old=create(b.length,policy);old.feed(b);expect(old.finish()).toMatchObject({status:'unavailable',reason:'unsupported-counter-defaults',candidates:[]});}
 const create=(ordered as unknown as Record<string,any>).createWholeUserTimingStudyV5;expect(()=>create(0,ordered.WHOLE_USER_TIMING_V4_POLICY)).toThrow('unsupported-policy');
});
test('V5 counter defaults preserve legacy reset, loss, sequence and machine isolation for primary defaults',()=>{
 const event=body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase')));
 const selected=(seq:bigint,extra=new Uint8Array())=>join(uint(10,seq),uint(8,23n),extra,event);
 for(const following of [[join(uint(10,1n),uint(13,1n)),selected(1n)],[join(uint(10,1n),uint(42,1n)),selected(1n)],[selected(2n)],[selected(1n,uint(98,2n))]]){
  const v5=study(stream(defaults(uint(31,99n)),...following)),control=stream(defaults(),...following),v4=ordered.createWholeUserTimingStudyV4(control.length,ordered.WHOLE_USER_TIMING_V4_POLICY);v4.feed(control);const old=v4.finish();expect(v5.candidates).toEqual(old.candidates);expect(v5.candidates.length).toBeGreaterThan(0);for(const c of v5.candidates){expect(c.trackUuid).toBe(null);expect(c.clockId).toBe(null);}
 }
});
test('V5 is opt-in and keeps the whole V4 result identical apart from policy when counter defaults are absent',()=>{
 const b=stream(defaults(),mark()),old=ordered.createWholeUserTimingStudyV4(b.length,ordered.WHOLE_USER_TIMING_V4_POLICY);old.feed(b);expect({...study(b),policy:ordered.WHOLE_USER_TIMING_V4_POLICY}).toEqual(old.finish());
});
