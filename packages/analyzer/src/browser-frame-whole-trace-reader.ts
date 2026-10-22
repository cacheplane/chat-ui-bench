import {createWholeAnnotationStudy,WHOLE_ANNOTATION_POLICY,WHOLE_ANNOTATION_AUTHORITY,finishWholeAnnotationOutput,createWholeUserTimingStudy,WHOLE_USER_TIMING_POLICY,type WholeUserTimingStudy}from'./browser-frame-ordered-state.js';
import fs from'node:fs';import{types}from'node:util';import{createHash}from'node:crypto';
import{resolve}from'node:path';
import{createWholeUserTimingStudyV4,WHOLE_USER_TIMING_V4_POLICY,createWholeUserTimingStudyV3,WHOLE_USER_TIMING_V3_POLICY}from'./browser-frame-ordered-state.js';
import type{WholeAnnotationStudy,WholeUserTimingStudyV3,WholeUserTimingStudyV4}from'./browser-frame-ordered-state.js';
export{isClosedStudyFailureCode}from'./browser-frame-ordered-state.js';
export type{ClosedStudyFailureCode}from'./browser-frame-ordered-state.js';
import{createD0StructuralStudy,D0_POLICY,D0_LIMITS,D0_AUTHORITY,encodeD0Result,type D0Result}from'./browser-frame-whole-trace.js';
interface Reference {path:string;bytes:number;sha256:string}
function reference(value:unknown):Reference {
 if(value===null||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error();
 const keys=Reflect.ownKeys(value);if(keys.length!==3||!keys.every(k=>k==='path'||k==='bytes'||k==='sha256'))throw Error();
 const get=(k:string)=>{const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!('value'in d))throw Error();return d.value;};
 const path=get('path'),bytes=get('bytes'),sha256=get('sha256');
 if(typeof path!=='string'||path.length>4096||Buffer.byteLength(path)>4096||!path.startsWith('/')||resolve(path)!==path||path.includes('\0')||!Number.isSafeInteger(bytes)||bytes<0||bytes>D0_LIMITS.bytes||typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256))throw Error();
 return{path,bytes,sha256};
}
function identity(s:fs.BigIntStats):string[]{return[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(n=>{const v=String(n);if(v.length>64)throw Error();return v;});}
function same(a:readonly string[],b:readonly string[]):boolean{return a.length===b.length&&a.every((v,i)=>v===b[i]);}
/** Explicit source-owned file read only; never starts capture or trusts a caller EOF flag. */
function readOwnedFile(ref:Reference,s:{feed(input:unknown):void}){
 let reason:string|null=null,fd:number|undefined;let EOF=false,closed=false,identityMatch=false,hashMatch=false,reads=0,bytes=0;let hash:string|null=null,before:string[]|null=null,after:string[]|null=null;const wholeHash=createHash('sha256');
  try{
   const initial=fs.lstatSync(ref.path,{bigint:true});before=identity(initial);
   if(!initial.isFile()||initial.nlink!==1n||initial.size!==BigInt(ref.bytes))throw Error();
   fd=fs.openSync(ref.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
   if(!same(before,identity(fs.fstatSync(fd,{bigint:true}))))throw Error();
   const buffer=new Uint8Array(D0_LIMITS.chunk);
   for(;;){
    if(reads>=D0_LIMITS.reads){reason='reader-capacity';break;}reads++;
    // At the exact expected cap still request the separate one-byte EOF detector.
    const n=fs.readSync(fd,buffer,0,Math.min(buffer.byteLength,ref.bytes-bytes+1),null);
    if(n===0){EOF=true;break;}
    if(!Number.isInteger(n)||n<0||n>Math.min(buffer.byteLength,ref.bytes-bytes+1)){reason='reader-result';break;}
    const piece=buffer.subarray(0,n);wholeHash.update(piece);bytes+=n;
    if(bytes>ref.bytes){reason='reader-growth';break;}
    s.feed(piece);
   }
   hash=wholeHash.digest('hex');hashMatch=bytes===ref.bytes&&hash===ref.sha256;
   after=identity(fs.fstatSync(fd,{bigint:true}));identityMatch=same(before,after)&&same(before,identity(fs.lstatSync(ref.path,{bigint:true})));
   if(!EOF)reason??='reader-no-eof';if(!identityMatch)reason??='reader-drift';if(!hashMatch)reason??='reader-hash';
  }catch{reason??='reader-failure';}
  finally{
   if(fd!==undefined){try{fs.closeSync(fd);closed=true;}catch{reason??='reader-close';}}
  }
 return {reason,EOF,closed,identityMatch,hashMatch,reads,bytes,hash,before,after};
}
export function readD0PersistedTrace(value:unknown,policy:unknown){
 let reason:string|null=null,ref:Reference|null=null,study:D0Result|null=null;
 let EOF=false,closed=false,identityMatch=false,hashMatch=false,reads=0,bytes=0;
 let hash:string|null=null,before:string[]|null=null,after:string[]|null=null;
 try{
  if(policy!==D0_POLICY)throw Error();ref=reference(value);
 }catch{reason='invalid-reference';}
 if(ref){
  const s=createD0StructuralStudy(ref.bytes,D0_POLICY),out=readOwnedFile(ref,s);
  ({reason,EOF,closed,identityMatch,hashMatch,reads,bytes,hash,before,after}=out);
  study=s.finish();
 }
 const fullInputVerified=reason===null&&EOF&&closed&&identityMatch&&hashMatch;
 const verified=fullInputVerified&&study?.framingBoundaryComplete===true;
 if(!verified)reason??='structural-unavailable';else if(study?.status==='unavailable')reason='packet-projection-unavailable';
 const result={policy:D0_POLICY,status:verified&&reason===null?'complete-structural-diagnostic':'unavailable',reason,fullInputVerified,structuralContainerEOF:verified,
  reader:{kind:'source-owned-persisted-file',EOF,closed,identityMatch,hashMatch,reads,bytes,sha256:hash,before,after},study,authority:D0_AUTHORITY};
 encodeD0Result(result);return result;
}

/** Opt-in whole ordered annotation diagnostic. No native clock/target admission. */
export type WholeAnnotationTrace=Omit<ReturnType<typeof readWholeAnnotationEngine>,'policy'|'study'>&{policy:typeof WHOLE_ANNOTATION_POLICY;study:WholeAnnotationStudy|null};
export function readWholeAnnotationTrace(value:unknown,policy:unknown):WholeAnnotationTrace{
 return readWholeAnnotationEngine(value,policy,false) as WholeAnnotationTrace;
}
export type WholeUserTimingTrace=Omit<ReturnType<typeof readWholeAnnotationTrace>,'policy'|'study'>&{policy:typeof WHOLE_USER_TIMING_POLICY;study:WholeUserTimingStudy|null};
/** Explicit versioned selection uses the same original descriptor reader once. */
export function readWholeUserTimingTrace(value:unknown,policy:unknown):WholeUserTimingTrace{
 return readWholeAnnotationEngine(value,policy,true) as WholeUserTimingTrace;
}
export type WholeUserTimingTraceV3=Omit<WholeUserTimingTrace,'policy'|'study'>&{policy:typeof WHOLE_USER_TIMING_V3_POLICY;study:WholeUserTimingStudyV3|null};
export function readWholeUserTimingTraceV3(value:unknown,policy:unknown):WholeUserTimingTraceV3{
 return readWholeAnnotationEngine(value,policy,true,true) as WholeUserTimingTraceV3;
}
export type WholeUserTimingTraceV4=Omit<WholeUserTimingTraceV3,'policy'|'study'>&{policy:typeof WHOLE_USER_TIMING_V4_POLICY;study:WholeUserTimingStudyV4|null};
export function readWholeUserTimingTraceV4(value:unknown,policy:unknown):WholeUserTimingTraceV4{
 return readWholeAnnotationEngine(value,policy,true,true,true) as WholeUserTimingTraceV4;
}
function readWholeAnnotationEngine(value:unknown,policy:unknown,userTiming:boolean,diagnosticV3=false,provenance=false){
 let reason:string|null=null,ref:Reference|null=null,study:WholeAnnotationStudy|WholeUserTimingStudy|WholeUserTimingStudyV3|WholeUserTimingStudyV4|null=null;
 let out:ReturnType<typeof readOwnedFile>={reason:null,EOF:false,closed:false,identityMatch:false,hashMatch:false,reads:0,bytes:0,hash:null,before:null,after:null};
 const selectedPolicy=provenance?WHOLE_USER_TIMING_V4_POLICY:diagnosticV3?WHOLE_USER_TIMING_V3_POLICY:userTiming?WHOLE_USER_TIMING_POLICY:WHOLE_ANNOTATION_POLICY;
 try{if(policy!==selectedPolicy)throw Error();ref=reference(value);}catch{reason='invalid-reference';}
 if(ref){const s=provenance?createWholeUserTimingStudyV4(ref.bytes,selectedPolicy):diagnosticV3?createWholeUserTimingStudyV3(ref.bytes,selectedPolicy):userTiming?createWholeUserTimingStudy(ref.bytes,selectedPolicy):createWholeAnnotationStudy(ref.bytes,selectedPolicy);out=readOwnedFile(ref,s);reason=out.reason;study=s.finish();}
 const fullInputVerified=reason===null&&out.EOF&&out.closed&&out.identityMatch&&out.hashMatch;
 const complete=fullInputVerified&&study?.status==='whole-annotation-study'&&study.framingBoundaryComplete;
 if(!complete)reason??=study?.reason??'whole-annotation-unavailable';
 if(!complete&&study)study={...study,status:'unavailable',reason:reason??'whole-annotation-unavailable',semanticProcessing:'unavailable',markInventoryAdmission:'not_evaluated',candidates:[]};
 const result={policy:selectedPolicy,status:complete?'complete-whole-annotation-diagnostic':'unavailable',reason,fullInputVerified,structuralContainerEOF:fullInputVerified&&study?.framingBoundaryComplete===true,reader:{kind:'source-owned-persisted-file',EOF:out.EOF,closed:out.closed,identityMatch:out.identityMatch,hashMatch:out.hashMatch,reads:out.reads,bytes:out.bytes,sha256:out.hash,before:out.before,after:out.after},study,authority:WHOLE_ANNOTATION_AUTHORITY};
 try{return finishWholeAnnotationOutput(result);}catch{const unavailable={...result,status:'unavailable',reason:'result-capacity',study:study===null?null:{...study,status:'unavailable',reason:'result-capacity',semanticProcessing:'unavailable',markInventoryAdmission:'not_evaluated',candidates:[]}};return finishWholeAnnotationOutput(unavailable);}
}
