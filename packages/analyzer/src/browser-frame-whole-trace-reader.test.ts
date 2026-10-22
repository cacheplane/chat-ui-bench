import {expect,test,vi}from'vitest';import fs from'node:fs';import os from'node:os';import path from'node:path';import{createHash}from'node:crypto';
import{readD0PersistedTrace}from'./browser-frame-whole-trace-reader.js';import{D0_POLICY}from'./browser-frame-whole-trace.js';
import{body}from'./browser-frame-packet-fragments.test-helper.js';
import * as timingReader from './browser-frame-whole-trace-reader.js';
import * as timingPolicy from './browser-frame-ordered-state.js';
import {join as protoJoin,text as protoText,uint as protoUint} from './browser-frame-packet-fragments.test-helper.js';
test('v3 alone retains the first original decoder cause and keeps v1/v2 bytes unchanged',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-v3-authored-')),p=path.join(dir,'authored.bin'),b=protoJoin(body(1,protoJoin(protoUint(8,1n),protoUint(8,2n))),body(1,protoJoin(protoUint(8,3n),protoUint(8,4n))));fs.writeFileSync(p,b);
 const ref={path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
 try{const v1=timingReader.readWholeAnnotationTrace(ref,timingPolicy.WHOLE_ANNOTATION_POLICY),v2=timingReader.readWholeUserTimingTrace(ref,timingPolicy.WHOLE_USER_TIMING_POLICY),v3=timingReader.readWholeUserTimingTraceV3(ref,timingPolicy.WHOLE_USER_TIMING_V3_POLICY);expect(v1.study?.diagnostics).toEqual([{code:'fragment-unavailable',packetIndex:0,component:'packet'}]);expect(v2.study?.diagnostics).toEqual(v1.study?.diagnostics);expect(v3.study?.diagnostics).toEqual([{code:'fragment-unavailable',packetIndex:0,component:'packet',cause:'duplicate-selected-field'}]);expect(v3).toMatchObject({reason:'fragment-unavailable',fullInputVerified:true,structuralContainerEOF:true,study:{counters:{packets:2,decodedPackets:1,processedPackets:0},candidates:[]}});expect(JSON.stringify(v1)).toBe(JSON.stringify(v2).replaceAll(timingPolicy.WHOLE_USER_TIMING_POLICY,timingPolicy.WHOLE_ANNOTATION_POLICY));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('closed study failure membership never coerces arbitrary causes',()=>{
 expect(timingPolicy.isClosedStudyFailureCode('duplicate-selected-field')).toBe(true);for(const value of [undefined,null,1,'private path','x'.repeat(65536),new Proxy({},{get(){throw Error('no coercion');}})])expect(timingPolicy.isClosedStudyFailureCode(value)).toBe(false);
});
test('explicit UserTiming reader authenticates the original file then withdraws on hash or close failure',()=>{
 const api=timingReader as unknown as Record<string,any>,policies=timingPolicy as unknown as Record<string,any>;expect(api.readWholeUserTimingTrace).toBeTypeOf('function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-authored-')),p=path.join(dir,'authored.bin'),b=body(1,protoJoin(protoUint(10,1n),protoUint(13,1n),body(11,protoJoin(protoUint(9,3n),protoText(22,'blink.user_timing'),protoText(23,'phase')))));fs.writeFileSync(p,b);
 const ref={path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};
 try{expect(api.readWholeUserTimingTrace(ref,policies.WHOLE_USER_TIMING_POLICY)).toMatchObject({fullInputVerified:true,structuralContainerEOF:true,study:{candidates:[{representation:'event_name',value:'phase'}]}});expect(api.readWholeUserTimingTrace({...ref,sha256:'0'.repeat(64)},policies.WHOLE_USER_TIMING_POLICY)).toMatchObject({status:'unavailable',reason:'reader-hash',study:{candidates:[]}});const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored-close');});expect(api.readWholeUserTimingTrace(ref,policies.WHOLE_USER_TIMING_POLICY)).toMatchObject({status:'unavailable',reason:'reader-close',study:{candidates:[]}});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
});
test('D0 source-owned file reader alone joins physical EOF and exact persisted hash',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'D0-synthetic-'));try{const p=path.join(dir,'authored.bin'),bytes=Uint8Array.of(10,0);fs.writeFileSync(p,bytes);
 const r=readD0PersistedTrace({path:p,bytes:2,sha256:createHash('sha256').update(bytes).digest('hex')},D0_POLICY);
 expect(r).toMatchObject({status:'complete-structural-diagnostic',structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true}});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
function fixture(run:(p:string,ref:{path:string;bytes:number;sha256:string})=>void){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'D0-synthetic-'));try{const p=path.join(dir,'authored.bin'),b=Uint8Array.of(10,0);fs.writeFileSync(p,b);run(p,{path:p,bytes:2,sha256:createHash('sha256').update(b).digest('hex')});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}}
test('wrong persisted hash and truncated advertised input both refuse',()=>fixture((_p,r)=>{
 expect(readD0PersistedTrace({...r,sha256:'0'.repeat(64)},D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,reader:{EOF:true,closed:true,hashMatch:false}});
 expect(readD0PersistedTrace({...r,bytes:3},D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,reader:{EOF:false}});
}));
test('file close failure cannot be replaced by successful framing or EOF',()=>fixture((_p,r)=>{
 const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('synthetic-close');});
 expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,reason:'reader-close',reader:{EOF:true,closed:false}});
}));
test('read exception closes original descriptor and never admits prefix',()=>fixture((_p,r)=>{
 vi.spyOn(fs,'readSync').mockImplementation(()=>{throw {get message(){throw Error('must-not-read');}};});
 expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,reader:{closed:true,EOF:false}});
}));
test('a source-owned complete file can have unavailable packet projection',()=>fixture((p,r)=>{
 const b=Uint8Array.of(10,1,0);fs.writeFileSync(p,b);
 expect(readD0PersistedTrace({...r,bytes:3,sha256:createHash('sha256').update(b).digest('hex')},D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:true,reason:'packet-projection-unavailable',study:{packetProjection:'unavailable'}});
}));
test('symlink, hardlink and accessor references refuse without getter calls',()=>fixture((p,r)=>{
 const sym=p+'.link';fs.symlinkSync(p,sym);expect(readD0PersistedTrace({...r,path:sym},D0_POLICY).status).toBe('unavailable');
 const hard=p+'.hard';fs.linkSync(p,hard);expect(readD0PersistedTrace(r,D0_POLICY).status).toBe('unavailable');
 let calls=0;expect(readD0PersistedTrace({get path(){calls++;return p;},bytes:2,sha256:r.sha256},D0_POLICY).status).toBe('unavailable');expect(calls).toBe(0);
}));
test('short original reads preserve complete ownership and terminal EOF',()=>fixture((_p,r)=>{
 const read=fs.readSync;vi.spyOn(fs,'readSync').mockImplementation((fd,b,off,len,pos)=>read(fd,b,off,Math.min(1,len),pos));
 expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'complete-structural-diagnostic',reader:{reads:3,EOF:true,closed:true}});
}));
test('growth after open is detected and closes the original file',()=>fixture((p,r)=>{
 const read=fs.readSync;let first=true;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(first){first=false;fs.appendFileSync(p,Uint8Array.of(10));}return read(...args);});
 expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'unavailable',reason:'reader-growth',structuralContainerEOF:false,reader:{closed:true}});
}));
test('premature original EOF cannot authenticate persisted bytes',()=>fixture((_p,r)=>{
 vi.spyOn(fs,'readSync').mockReturnValue(0);expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,reader:{EOF:true,hashMatch:false,closed:true}});
}));
test('read attempt boundary reserves actual EOF and refuses a clean boundary without it',()=>fixture((p,r)=>{
 const read=fs.readSync;vi.spyOn(fs,'readSync').mockImplementation((fd,b,off,len,pos)=>read(fd,b,off,Math.min(1,len),pos));
 for(const n of [4088,4089]){const b=body(1,body(100,new Uint8Array(n)));fs.writeFileSync(p,b);const q=readD0PersistedTrace({...r,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},D0_POLICY);
 expect(q.reader.reads).toBe(4096);expect(q.structuralContainerEOF).toBe(n===4088);if(n===4089)expect(q).toMatchObject({status:'unavailable',reason:'reader-capacity',reader:{EOF:false,closed:true,hashMatch:true}});}
}));
test('descriptor identity drift after complete read invalidates otherwise matching bytes',()=>fixture((_p,r)=>{
 const original=fs.fstatSync;let calls=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=original(...args);if(++calls===2&&typeof s.ctimeNs==='bigint')s.ctimeNs+=1n;return s;});
 expect(readD0PersistedTrace(r,D0_POLICY)).toMatchObject({status:'unavailable',reason:'reader-drift',fullInputVerified:false,reader:{EOF:true,closed:true,identityMatch:false,hashMatch:true}});
}));
test('D0 arbitrary EOF assertion is not an admitted file reference',()=>{
 expect(readD0PersistedTrace({eof:true,bytes:0,sha256:'0'.repeat(64)},D0_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false});
});
