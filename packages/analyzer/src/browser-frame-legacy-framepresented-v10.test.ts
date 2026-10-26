import {expect,test,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as readers from './browser-frame-whole-trace-reader.js';
import * as state from './browser-frame-ordered-state.js';
import {decodeBrowserFramePacket,PACKET_POLICY} from './browser-frame-packet-fragments.js';
import {createWholeFramePresentedPacketDecoder} from './browser-frame-packet-fragments.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';

const api=state as unknown as Record<string,any>;
const policy='pinned-whole-trace-user-timing-framepresented-r-diagnostic-v10';
const entry=(table:number,iid:bigint,value:string)=>body(table,join(uint(1,iid),text(2,value)));
function definitions(offset=0n,name='FramePresented',categories=['cc','benchmark'],key='environment'){
 return body(12,join(entry(2,offset+1n,name),entry(1,offset+2n,categories[0]!),entry(1,offset+3n,categories[1]!),entry(3,offset+4n,key)));
}
function event(offset=0n,extra=new Uint8Array()){
 return body(11,join(uint(3,offset+2n),uint(3,offset+3n),uint(10,offset+1n),uint(11,0n),body(4,join(uint(1,offset+4n),text(6,'browser'))),body(6,uint(2,82n)),extra));
}
const packet=(...parts:Uint8Array[])=>join(uint(10,1n),uint(13,1n),...parts);
function run(...packets:Uint8Array[]){
 expect(api.createWholeUserTimingStudyV10).toBeTypeOf('function');
 const bytes=join(...packets.map(p=>body(1,p))),study=api.createWholeUserTimingStudyV10(bytes.length,policy);study.feed(bytes);return study.finish();
}
test('V10 resolves exact source R after same-packet definitions in either physical order with arbitrary IIDs',()=>{
 expect(api.WHOLE_USER_TIMING_V10_POLICY).toBe(policy);
 for(const offset of [0n,700n])for(const reverse of [false,true]){
  const parts=[event(offset),definitions(offset)];if(reverse)parts.reverse();
  expect(run(packet(...parts))).toMatchObject({policy,status:'whole-annotation-study',semanticProcessing:'complete-supported-schema',supportedLegacyFramePresented:1,counters:{trackEvents:1,packets:1},candidates:[]});
 }
});
test('old standalone and V9 retain exact legacy refusal',()=>{
 const p=packet(event(),definitions());expect(decodeBrowserFramePacket(p,PACKET_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'unsupported-legacy-event'}]});
 const bytes=body(1,p),s=state.createWholeUserTimingStudyV9(bytes.length,state.WHOLE_USER_TIMING_V9_POLICY);s.feed(bytes);
 expect(s.finish()).toMatchObject({status:'unavailable',diagnostics:[{cause:'unsupported-legacy-event'}]});
});
const sourceParts=()=>[uint(3,2n),uint(3,3n),uint(10,1n),uint(11,0n),body(4,join(uint(1,4n),text(6,'browser'))),body(6,uint(2,82n))];
test('R fragment keeps absent modern type, exact phase locations and truthful nested work',()=>{
 let work=0;const p=packet(event(),definitions()),r=createWholeFramePresentedPacketDecoder()(p,n=>{work+=n;});
 expect(r.status).toBe('decoded_packet_fragment');if(r.status==='unavailable')return;
 expect(r.event?.fields.type).toBeUndefined();expect(r.event).toMatchObject({legacy:{kind:'frame-presented-r',phase:'82'}});
 const at=r.occurrences.find(o=>o.scope==='legacy_event')!;expect(at).toMatchObject({fieldNumber:2,wireType:0});expect([...p.slice(at.start,at.end)]).toEqual([16,82]);expect(work).toBe(1);
 const s=run(p);expect(s.budgets.fields).toBeGreaterThan(r.occurrences.length);expect(s.candidates).toEqual([]);
});
test.each([
 new Uint8Array(),uint(2,81n),uint(2,83n),join(uint(2,82n),uint(2,82n)),body(2,new Uint8Array()),Uint8Array.of(16,210,0),Uint8Array.of(144,0,82),Uint8Array.of(16,128),
 ...[1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,100].map(n=>join(uint(2,82n),uint(n,1n))),
])('refuses every non-source nested legacy body %#',legacy=>{
 const parts=sourceParts();parts[5]=body(6,legacy);expect(run(packet(body(11,join(...parts)),definitions()))).toMatchObject({status:'unavailable',candidates:[]});
});
test.each([
 ...[0,1,2,3,4].map(index=>sourceParts().filter((_,i)=>i!==index)),
 ...[0,1,2,3,4,5].map(index=>[...sourceParts(),sourceParts()[index]!]),
 ...[0n,3n].map(type=>[...sourceParts(),uint(9,type)]),
 ...[1,2,8,16,17,20,22,23,100,1052,1075].map(n=>[...sourceParts(),uint(n,1n)]),
 sourceParts().map((p,i)=>i===3?uint(11,1n):p),
 sourceParts().map((p,i)=>i===0?body(3,uint(1,2n)):p),
].map(parts=>({parts})))('refuses non-source outer R shape %#',({parts})=>{
 expect(run(packet(body(11,join(...parts)),definitions()))).toMatchObject({status:'unavailable',candidates:[]});
});
test.each([
 text(10,'environment'),join(uint(1,4n),text(6,'browser'),uint(100,1n)),join(uint(1,4n),text(6,'browser'),text(6,'browser')),
 join(uint(1,4n),uint(2,1n)),join(uint(1,4n),body(11,new Uint8Array())),join(uint(1,4n),text(6,'Browser')),join(uint(1,0n),text(6,'browser')),
])('refuses annotation representation or value variant %#',annotation=>{
 const parts=sourceParts();parts[4]=body(4,annotation);expect(run(packet(body(11,join(...parts)),definitions()))).toMatchObject({status:'unavailable',candidates:[]});
});
test.each([
 definitions(0n,'Other'),definitions(0n,'chat-ui-bench-wheel:phase'),definitions(0n,'wheel-carrier-v1:0123456789abcdef:0:141812335'),definitions(0n,'native-wheel-witness-v1:0123456789abcdef:0:141812335'),definitions(0n,'FramePresented',['cc','cc']),definitions(0n,'FramePresented',['benchmark','benchmark']),definitions(0n,'FramePresented',['cc','other']),definitions(0n,'FramePresented',['cc','benchmark'],'other'),
 new Uint8Array(),body(12,entry(2,1n,'FramePresented')),body(12,join(entry(2,1n,'FramePresented'),entry(2,1n,'conflict'))),
])('refuses unresolved or wrong source semantics %#',defs=>{
 expect(run(packet(event(),defs))).toMatchObject({status:'unavailable',candidates:[]});
});
test('later definitions cannot repair R; malformed same-packet state cannot be ignored',()=>{
 expect(run(packet(event()),packet(definitions()))).toMatchObject({status:'unavailable',candidates:[]});
 expect(run(packet(event(),definitions(),body(59,Uint8Array.of(0))))).toMatchObject({status:'unavailable',candidates:[]});
 const first=packet(definitions()),r=join(uint(10,1n),uint(42,1n),event());expect(run(first,r)).toMatchObject({status:'unavailable',candidates:[]});
 const reset=join(uint(10,1n),uint(13,1n),event());expect(run(first,reset)).toMatchObject({status:'unavailable',candidates:[]});
});
test('explicit track zero stays source-owned even with ordinary nonzero defaults',()=>{
 const defaults=body(59,body(11,uint(11,99n)));expect(run(packet(defaults,event(),definitions())).status).toBe('whole-annotation-study');
 const parts=sourceParts().filter((_,i)=>i!==3);expect(run(packet(defaults,body(11,join(...parts)),definitions())).status).toBe('unavailable');
});
test('supported R occurrences have bounded count without a 128-row ceiling and budgets still exhaust',()=>{
 const first=packet(event(),definitions()),rest=join(uint(10,1n),event());
 const s=run(first,...Array.from({length:130},()=>rest));expect(s).toMatchObject({status:'whole-annotation-study',supportedLegacyFramePresented:131,counters:{trackEvents:131,packets:131},candidates:[]});
 expect(run(first,...Array.from({length:5000},()=>rest))).toMatchObject({status:'unavailable',candidates:[]});
});
test('source form commitment changes with physical phase position and every packet remains manifested',()=>{
 const a=run(packet(event(),definitions())),b=run(packet(definitions(),event()));expect(a.packetManifestSHA256).not.toBe(b.packetManifestSHA256);expect(a.transitionManifestSHA256).not.toBe(b.transitionManifestSHA256);
});
const readerApi=readers as unknown as Record<string,any>;
function owned(run:(p:string,ref:{path:string;bytes:number;sha256:string})=>void,bytes=body(1,packet(event(),definitions()))){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'legacy-r-v10-'));try{const p=path.join(dir,'authored.bin');fs.writeFileSync(p,bytes);run(p,{path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
}
test('owned V10 reader selects exact policy and authenticates full source R bytes',()=>owned((_p,ref)=>{
 expect(readerApi.readWholeUserTimingTraceV10).toBeTypeOf('function');
 expect(readerApi.readWholeUserTimingTraceV10(ref,policy)).toMatchObject({policy,status:'complete-whole-annotation-diagnostic',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,hashMatch:true,identityMatch:true},study:{supportedLegacyFramePresented:1,candidates:[]}});
 expect(readerApi.readWholeUserTimingTraceV10(ref,state.WHOLE_USER_TIMING_V9_POLICY)).toMatchObject({status:'unavailable',reason:'invalid-reference',study:null});
 expect(readers.readWholeUserTimingTraceV9(ref,policy)).toMatchObject({status:'unavailable',reason:'invalid-reference',study:null});
}));
test('V10 owned custody withdraws on hash, length, close, read and identity failures',()=>{
 for(const mode of ['hash','length','close','read','identity','growth','truncation','path','EOF'])owned((p,ref)=>{
  let r=ref;
  if(mode==='hash')r={...ref,sha256:'0'.repeat(64)};
  if(mode==='length')r={...ref,bytes:ref.bytes+1};
  if(mode==='close'){const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('close');});}
  if(mode==='read')vi.spyOn(fs,'readSync').mockImplementation(()=>{throw Error('read');});
  if(mode==='EOF')vi.spyOn(fs,'readSync').mockReturnValue(0);
  if(mode==='identity'){const stat=fs.fstatSync;let calls=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=stat(...args);if(++calls===2&&typeof s.ctimeNs==='bigint')s.ctimeNs+=1n;return s;});}
  if(['growth','truncation','path'].includes(mode)){const read=fs.readSync;let first=true;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(first){first=false;if(mode==='growth')fs.appendFileSync(p,new Uint8Array([0]));else if(mode==='truncation')fs.truncateSync(p,1);else{fs.renameSync(p,p+'.old');fs.writeFileSync(p,fs.readFileSync(p+'.old'));}}return read(...args);});}
  expect(readerApi.readWholeUserTimingTraceV10(r,policy)).toMatchObject({status:'unavailable',study:{status:'unavailable',semanticProcessing:'unavailable',candidates:[],evidenceInventory:{status:'unavailable',facts:[],occurrences:[]},rawDropInventory:{status:'unavailable',facts:[]}}});
 });
});
test('V10 owned reference rejects symlinks, hardlinks, noncanonical paths and accessors',()=>{
 for(const mode of ['symlink','hardlink','canonical','accessor'])owned((p,ref)=>{
  let r:unknown=ref;
  if(mode==='symlink'){fs.symlinkSync(p,p+'.link');r={...ref,path:p+'.link'};}
  if(mode==='hardlink')fs.linkSync(p,p+'.hard');
  if(mode==='canonical')r={...ref,path:path.dirname(p)+'/./authored.bin'};
  if(mode==='accessor')r={get path(){throw Error('getter');},bytes:ref.bytes,sha256:ref.sha256};
  const result=readerApi.readWholeUserTimingTraceV10(r,policy);expect(result.status).toBe('unavailable');if(result.study)expect(result.study).toMatchObject({status:'unavailable',candidates:[]});
 });
});
test('a valid marker preceding unsupported R never escapes V10 withdrawal or full input hash',()=>{
 const marker=packet(body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'phase'))));
 const bytes=join(body(1,marker),body(1,packet(event(0n,uint(100,1n)),definitions())),body(1,body(19000,new Uint8Array(70000))));
 owned((_p,ref)=>{const read=fs.readSync;vi.spyOn(fs,'readSync').mockImplementation((fd,b,off,len,pos)=>read(fd,b,off,Math.min(37,len),pos));expect(readerApi.readWholeUserTimingTraceV10(ref,policy)).toMatchObject({status:'unavailable',fullInputVerified:true,structuralContainerEOF:true,reader:{bytes:bytes.length,sha256:ref.sha256,EOF:true,closed:true,identityMatch:true,hashMatch:true},study:{candidates:[],counters:{packets:3,processedPackets:1}}});},bytes);
});
test('V10 policy is never an alias for V9 study and all earlier whole decoders retain R refusal',()=>{
 expect(()=>api.createWholeUserTimingStudyV10(0,state.WHOLE_USER_TIMING_V9_POLICY)).toThrow();
 expect(()=>state.createWholeUserTimingStudyV9(0,policy)).toThrow();
 const bytes=body(1,packet(event(),definitions()));
 for(const [factory,p] of [[state.createWholeAnnotationStudy,state.WHOLE_ANNOTATION_POLICY],[state.createWholeUserTimingStudy,state.WHOLE_USER_TIMING_POLICY],[state.createWholeUserTimingStudyV3,state.WHOLE_USER_TIMING_V3_POLICY],[state.createWholeUserTimingStudyV4,state.WHOLE_USER_TIMING_V4_POLICY],[state.createWholeUserTimingStudyV5,state.WHOLE_USER_TIMING_V5_POLICY],[state.createWholeUserTimingStudyV6,state.WHOLE_USER_TIMING_V6_POLICY],[state.createWholeUserTimingStudyV7,state.WHOLE_USER_TIMING_V7_POLICY],[state.createWholeUserTimingStudyV8,state.WHOLE_USER_TIMING_V8_POLICY]] as const){const s=factory(bytes.length,p);s.feed(bytes);expect(s.finish()).toMatchObject({status:'unavailable',candidates:[]});}
});
