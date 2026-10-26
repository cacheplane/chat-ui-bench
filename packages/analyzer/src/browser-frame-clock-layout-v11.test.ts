import {expect,test,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as state from './browser-frame-ordered-state.js';
import * as readers from './browser-frame-whole-trace-reader.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';

const api=state as unknown as Record<string,any>,reader=readers as unknown as Record<string,any>;
const policy='pinned-whole-trace-user-timing-clock-layout-evidence-diagnostic-v11';
const clock=(...children:Uint8Array[])=>body(6,join(...children));
const child=(...fields:Uint8Array[])=>body(1,join(...fields));
const descriptor=(id:bigint)=>body(60,uint(1,id));
function run(packets:Uint8Array[],version=11){
 expect(api[`createWholeUserTimingStudyV${version}`]).toBeTypeOf('function');
 const bytes=join(...packets.map(p=>body(1,p))),s=api[`createWholeUserTimingStudyV${version}`](bytes.length,api[`WHOLE_USER_TIMING_V${version}_POLICY`]);for(let at=0;at<bytes.length;at+=65536)s.feed(bytes.slice(at,at+65536));return s.finish();
}
// Independent consumer: never imports the maintained encoder or its reconstruction helpers.
function expand(inv:any):any[]{
 if(inv.version!==2||!Array.isArray(inv.facts)||!Array.isArray(inv.occurrences))throw Error('codec');
 return inv.occurrences.map((o:any)=>{
  if(!Array.isArray(o)||o.length!==8||!Number.isInteger(o[0])||o[0]<0||!inv.facts[o[0]])throw Error('reference');
  const [ref,packetIndex,bodySha256,machineId,s,packetFields,l,values]=o,f=inv.facts[ref];
  let fact:any;
  if(f.kind==='track_descriptor'){if(values!==null)throw Error('descriptor-vector');fact=f;}
  else {
   if(f.kind!=='clock_snapshot_layout'||!Array.isArray(values))throw Error('layout');let at=0;
   const clocks=f.clocks.map((entries:any)=>{const c:any={};for(const e of entries){if(!Array.isArray(e)||!['clockId','timestamp','isIncremental','unitMultiplierNs'].includes(e[0])||Object.hasOwn(c,e[0]))throw Error('field');if(e[0]==='timestamp'){if(e.length!==1||typeof values[at]!=='string'||!/^(0|[1-9][0-9]*)$/.test(values[at])||BigInt(values[at])>18446744073709551615n)throw Error('timestamp');c.timestamp=values[at++];}else{if(e.length!==2)throw Error('value');c[e[0]]=e[1];}}return c;});
   if(at!==values.length)throw Error('vector-length');fact={kind:'clock_snapshot',...(Object.hasOwn(f,'primaryTraceClock')?{primaryTraceClock:f.primaryTraceClock}:{}),clocks};
  }
  return {packetIndex,bodySha256,machineContext:machineId===null?{status:'absent'}:{status:'present',machineId},sequenceContext:s===null?{status:'absent'}:{status:'present',sequenceId:s[0],sequenceIndex:s[1],intervalVersion:s[2]},packetFields,location:{packetIndex,scope:l[0],fieldNumber:l[1],wireType:l[2],start:l[3],valueStart:l[4],end:l[5]},...fact};
 });
}
function expandV10(inv:any){return inv.occurrences.map((o:any)=>{const [ref,packetIndex,bodySha256,machineId,s,packetFields,l]=o;return {packetIndex,bodySha256,machineContext:machineId===null?{status:'absent'}:{status:'present',machineId},sequenceContext:s===null?{status:'absent'}:{status:'present',sequenceId:s[0],sequenceIndex:s[1],intervalVersion:s[2]},packetFields,location:{packetIndex,scope:l[0],fieldNumber:l[1],wireType:l[2],start:l[3],valueStart:l[4],end:l[5]},...inv.facts[ref]};});}
test('V11 has explicit policy and owned codec2 selection',()=>{
 expect(api.WHOLE_USER_TIMING_V11_POLICY).toBe(policy);expect(reader.readWholeUserTimingTraceV11).toBeTypeOf('function');
 expect(()=>api.createWholeUserTimingStudyV11(0,state.WHOLE_USER_TIMING_V10_POLICY)).toThrow();
 expect(run([])).toMatchObject({policy,status:'whole-annotation-study',evidenceInventory:{version:2,facts:[],occurrences:[]}});
 expect(run([])).not.toHaveProperty('clock3Projection');
});
test('exact ordered layouts preserve every timestamp, presence, key order and full old context',()=>{
 const packets=[descriptor(1n),...Array.from({length:3},(_,i)=>clock(child(uint(2,BigInt(i)),uint(1,0n),uint(3,0n),uint(4,0n)),child(uint(1,3n),uint(2,18446744073709551615n)))),clock(child()),clock(),clock(child(uint(1,3n))),body(6,join(uint(2,0n),child(uint(2,0n))))];
 packets[1]=join(uint(10,7n),uint(13,1n),uint(8,0n),uint(58,0n),uint(98,0n),packets[1]!);
 const a=run(packets),old=run(packets,10);expect(a.status).toBe('whole-annotation-study');expect(old.status).toBe('whole-annotation-study');
 expect(JSON.stringify(expand(a.evidenceInventory))).toBe(JSON.stringify(expandV10(old.evidenceInventory)));
 expect(a.evidenceInventory.facts).toHaveLength(6);expect(a.evidenceInventory.occurrences).toHaveLength(8);
 expect(a.evidenceInventory.occurrences[0][7]).toBeNull();expect(a.evidenceInventory.occurrences[1][7]).toEqual(['0','18446744073709551615']);
 expect(a.evidenceInventory.facts[1].clocks[0]).toEqual([['timestamp'],['clockId','0'],['isIncremental',false],['unitMultiplierNs','0']]);
 expect(a.transitionManifestSHA256).toBe(old.transitionManifestSHA256);
});
test.each([128,129])('normalized fact cap %i',n=>{
 const s=run(Array.from({length:n},(_,i)=>descriptor(BigInt(i))));expect(s.status).toBe(n===128?'whole-annotation-study':'unavailable');if(n===129)expect(s.evidenceInventory).toEqual({status:'unavailable',version:2,facts:[],occurrences:[]});
});
test.each([256,257])('occurrence cap %i survives timestamp factoring',n=>{
 const s=run(Array.from({length:n},(_,i)=>clock(child(uint(2,BigInt(i))))));expect(s.status).toBe(n===256?'whole-annotation-study':'unavailable');if(n===256){expect(s.evidenceInventory.facts).toHaveLength(1);expect(expand(s.evidenceInventory)).toHaveLength(n);}
});
test.each([512,513])('clock capacity %i counts every occurrence',n=>{
 const packets=Array.from({length:Math.floor(n/8)},()=>clock(...Array.from({length:8},(_,i)=>child(uint(1,BigInt(i)),uint(2,1n)))));if(n%8)packets.push(clock(child(uint(2,1n))));
 expect(run(packets).status).toBe(n===512?'whole-annotation-study':'unavailable');
});
test('independent consumer refuses malformed codec2 vectors and references',()=>{
 const inv=run([clock(child(uint(2,1n)),child(uint(2,2n)))]).evidenceInventory;
 for(const mutate of [(x:any)=>x.occurrences[0][7].pop(),(x:any)=>x.occurrences[0][7].push('3'),(x:any)=>x.occurrences[0][7]=null,(x:any)=>x.occurrences[0][7][0]='01',(x:any)=>x.occurrences[0][7][0]='18446744073709551616',(x:any)=>x.occurrences[0][0]=100,(x:any)=>x.facts[0].kind='clock_snapshot',(x:any)=>x.facts[0].clocks[0][0].push('1')]){const copy=structuredClone(inv);mutate(copy);expect(()=>expand(copy)).toThrow();}
 const reordered=structuredClone(inv);reordered.occurrences[0][7].reverse();expect(JSON.stringify(expand(reordered))).not.toBe(JSON.stringify(expand(inv)));
});
test('layout equality distinguishes key order, flags, units, primary and child order',()=>{
 const a=child(uint(1,3n),uint(2,1n)),b=child(uint(1,6n),uint(2,2n));
 const packets=[clock(a,b),clock(b,a),clock(child(uint(2,1n),uint(1,3n)),b),clock(a,child(uint(1,6n),uint(2,2n),uint(3,0n))),clock(a,child(uint(1,6n),uint(2,2n),uint(3,1n))),clock(a,child(uint(1,6n),uint(2,2n),uint(4,0n))),body(6,join(a,b,uint(2,0n)))];
 const s=run(packets);expect(s.status).toBe('whole-annotation-study');expect(s.evidenceInventory.facts).toHaveLength(7);
 expect(JSON.stringify(expand(s.evidenceInventory))).toBe(JSON.stringify(expandV10(run(packets,10).evidenceInventory)));
});
test('compression charges each complete original row plus keys, templates, tuples, vectors and work',()=>{
 const packets=Array.from({length:20},(_,i)=>clock(child(uint(1,3n),uint(2,BigInt(i))))),s=run(packets),rows=expand(s.evidenceInventory);
 const inv=s.evidenceInventory,size=(v:any)=>Buffer.byteLength(JSON.stringify(v));
 const original=rows.reduce((n:number,row:any)=>n+size(row),0),tuples=inv.occurrences.reduce((n:number,o:any)=>n+size(o),0),vectors=inv.occurrences.reduce((n:number,o:any)=>n+size(o[7]),0),keys=20*size(inv.facts[0]),templates=size(inv.facts[0]);
 expect(s.budgets.persistentUTF8).toBe(original+tuples+vectors+keys+templates);
 expect(s.budgets.repeated).toBeGreaterThan(run(packets,10).budgets.repeated);
});
test('factoring never waives original aggregate persistence or final envelope limits',()=>{
 const d=body(6,join(uint(2,6n),...Array.from({length:2},(_,i)=>child(uint(1,BigInt(i)),uint(2,18446744073709551615n),uint(3,0n),uint(4,18446744073709551615n)))));let last:any=null,failed:any=null;
 let low=1,high=256;while(low<=high){const n=Math.floor((low+high)/2),s=run(Array.from({length:n},()=>d));if(s.status==='unavailable'){failed=s;high=n-1;}else{last=s;low=n+1;}}
 expect(last?.status).toBe('whole-annotation-study');expect(failed?.reason).toBe('persistent-string-capacity');expect(last.evidenceInventory.facts).toHaveLength(1);
 expect(last.budgets.persistentUTF8).toBeLessThanOrEqual(262144);expect(failed.evidenceInventory).toEqual({status:'unavailable',version:2,facts:[],occurrences:[]});
 const many=run(Array.from({length:128},(_,i)=>clock(...Array.from({length:4},(_,j)=>child(uint(1,BigInt(j)),uint(2,18446744073709551615n),uint(4,18446744073709551615n-BigInt(i)))))));expect(Buffer.byteLength(JSON.stringify(many))).toBeLessThanOrEqual(262144);expect(many.evidenceInventory.occurrences).toHaveLength(128);
});
test('V11 admits exactly V10 source R and binds semantic commitments identically',()=>{
 const entry=(table:number,iid:bigint,value:string)=>body(table,join(uint(1,iid),text(2,value)));
 const defs=body(12,join(entry(2,1n,'FramePresented'),entry(1,2n,'cc'),entry(1,3n,'benchmark'),entry(3,4n,'environment')));
 const event=(phase:bigint)=>body(11,join(uint(3,2n),uint(3,3n),uint(10,1n),uint(11,0n),body(4,join(uint(1,4n),text(6,'browser'))),body(6,uint(2,phase))));
 const p=join(uint(10,1n),uint(13,1n),defs,event(82n)),s=run([p]);expect(s).toMatchObject({status:'whole-annotation-study',supportedLegacyFramePresented:1});expect(s.transitionManifestSHA256).toBe(run([p],10).transitionManifestSHA256);
 for(const phase of [0n,81n,83n])expect(run([join(uint(10,1n),uint(13,1n),defs,event(phase))]).status).toBe('unavailable');
});
test('input, read, reset and source-state guards remain bounded and atomic',()=>{
 expect(()=>api.createWholeUserTimingStudyV11(33554433,policy)).toThrow();
 const s=api.createWholeUserTimingStudyV11(0,policy);for(let i=0;i<4097;i++)s.feed(new Uint8Array());expect(s.finish()).toMatchObject({status:'unavailable',reason:'read-capacity',evidenceInventory:{version:2,facts:[],occurrences:[]}});
 const packets=[descriptor(1n),join(uint(10,1n),body(59,Uint8Array.of(0)))];expect(run(packets)).toMatchObject({status:'unavailable',evidenceInventory:{version:2,facts:[],occurrences:[]}});
});
test('owned reader verifies custody, withdraws all evidence and refuses other policies before IO',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clock-layout-v11-'));try{const bytes=body(1,clock(child(uint(2,0n)))),p=path.join(dir,'trace');fs.writeFileSync(p,bytes);const ref={path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 expect(reader.readWholeUserTimingTraceV11(ref,policy)).toMatchObject({policy,status:'complete-whole-annotation-diagnostic',study:{evidenceInventory:{version:2}}});
 expect(reader.readWholeUserTimingTraceV11({...ref,sha256:'0'.repeat(64)},policy)).toMatchObject({status:'unavailable',study:{candidates:[],evidenceInventory:{status:'unavailable',version:2,facts:[],occurrences:[]},rawDropInventory:{status:'unavailable',facts:[]}}});
 const spy=vi.spyOn(fs,'openSync');expect(reader.readWholeUserTimingTraceV11(ref,state.WHOLE_USER_TIMING_V10_POLICY)).toMatchObject({status:'unavailable',study:null});expect(spy).not.toHaveBeenCalled();
 }finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
});
test.each([clock(child(uint(1,1n)),child(uint(1,1n))),clock(child(uint(3,2n))),body(6,Uint8Array.of(0)),body(11,body(6,uint(2,81n)))])('V11 retains malformed source and legacy refusals %#',p=>{expect(run([p])).toMatchObject({status:'unavailable',candidates:[],evidenceInventory:{status:'unavailable',version:2,facts:[],occurrences:[]}});});
