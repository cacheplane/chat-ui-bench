import{createWholeUserTimingStudyV11,WHOLE_USER_TIMING_V11_POLICY,type WholeUserTimingStudyV11}from'./browser-frame-ordered-state.js';
import{createWholeUserTimingStudyV10,WHOLE_USER_TIMING_V10_POLICY,type WholeUserTimingStudyV10}from'./browser-frame-ordered-state.js';
import{createWholeUserTimingStudyV9,WHOLE_USER_TIMING_V9_POLICY,createNativeClock3PhaseStudyV2,NATIVE_CLOCK3_PHASE_V2_POLICY,type WholeUserTimingStudyV9}from'./browser-frame-ordered-state.js';
import {createWholeAnnotationStudy,WHOLE_ANNOTATION_POLICY,WHOLE_ANNOTATION_AUTHORITY,finishWholeAnnotationOutput,createWholeUserTimingStudy,WHOLE_USER_TIMING_POLICY,type WholeUserTimingStudy}from'./browser-frame-ordered-state.js';
import fs from'node:fs';import{types}from'node:util';import{createHash}from'node:crypto';
import{resolve}from'node:path';
import{createWholeUserTimingStudyV8,WHOLE_USER_TIMING_V8_POLICY,createWholeUserTimingStudyV7,WHOLE_USER_TIMING_V7_POLICY,createWholeUserTimingStudyV6,WHOLE_USER_TIMING_V6_POLICY,createWholeUserTimingStudyV5,WHOLE_USER_TIMING_V5_POLICY,createWholeUserTimingStudyV4,WHOLE_USER_TIMING_V4_POLICY,createWholeUserTimingStudyV3,WHOLE_USER_TIMING_V3_POLICY}from'./browser-frame-ordered-state.js';
import type{WholeAnnotationStudy,WholeUserTimingStudyV3,WholeUserTimingStudyV4,WholeUserTimingStudyV5,WholeUserTimingStudyV6,WholeUserTimingStudyV7,WholeUserTimingStudyV8}from'./browser-frame-ordered-state.js';
import{createNativeClock3PhaseStudy,nativeClock3Names,NATIVE_CLOCK3_PHASE_POLICY}from'./browser-frame-ordered-state.js';
import type{NativeClock3Projection}from'./browser-frame-ordered-state.js';
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
type TracePolicy<T,P,S>=Omit<T,'policy'|'study'>&{policy:P;study:S|null};
export type WholeAnnotationTrace=Omit<ReturnType<typeof readWholeAnnotationEngine>,'policy'|'study'>&{policy:typeof WHOLE_ANNOTATION_POLICY;study:WholeAnnotationStudy|null};
export function readWholeAnnotationTrace(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,false) as WholeAnnotationTrace;
}
export type WholeUserTimingTrace=Omit<ReturnType<typeof readWholeAnnotationTrace>,'policy'|'study'>&{policy:typeof WHOLE_USER_TIMING_POLICY;study:WholeUserTimingStudy|null};
/** Explicit versioned selection uses the same original descriptor reader once. */
export function readWholeUserTimingTrace(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,true) as WholeUserTimingTrace;
}
export type WholeUserTimingTraceV3=TracePolicy<WholeUserTimingTrace,typeof WHOLE_USER_TIMING_V3_POLICY,WholeUserTimingStudyV3>;
export function readWholeUserTimingTraceV3(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,true,true) as WholeUserTimingTraceV3;
}
export type WholeUserTimingTraceV4=TracePolicy<WholeUserTimingTraceV3,typeof WHOLE_USER_TIMING_V4_POLICY,WholeUserTimingStudyV4>;
export function readWholeUserTimingTraceV4(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,true,true,true) as WholeUserTimingTraceV4;
}
export type WholeUserTimingTraceV5=TracePolicy<WholeUserTimingTraceV4,typeof WHOLE_USER_TIMING_V5_POLICY,WholeUserTimingStudyV5>;
export function readWholeUserTimingTraceV5(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,2,true,true) as WholeUserTimingTraceV5;
}
export type WholeUserTimingTraceV6=TracePolicy<WholeUserTimingTraceV5,typeof WHOLE_USER_TIMING_V6_POLICY,WholeUserTimingStudyV6>;
export function readWholeUserTimingTraceV6(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,3,true,true) as WholeUserTimingTraceV6;
}
export type WholeUserTimingTraceV7=TracePolicy<WholeUserTimingTraceV6,typeof WHOLE_USER_TIMING_V7_POLICY,WholeUserTimingStudyV7>;
export function readWholeUserTimingTraceV7(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,3,true,true,true) as WholeUserTimingTraceV7;
}
export type WholeUserTimingTraceV8=TracePolicy<WholeUserTimingTraceV7,typeof WHOLE_USER_TIMING_V8_POLICY,WholeUserTimingStudyV8>;
export function readWholeUserTimingTraceV8(value:unknown,policy:unknown) {
 return readWholeAnnotationEngine(value,policy,3,true,true,true,true) as WholeUserTimingTraceV8;
}
const CLOCK_LAYOUT_READER_SOURCE=Symbol('whole-clock-layout-v11');
export type WholeUserTimingTraceV11=TracePolicy<WholeUserTimingTraceV8,typeof WHOLE_USER_TIMING_V11_POLICY,WholeUserTimingStudyV11>;
export function readWholeUserTimingTraceV11(value:unknown,policy:unknown){return readWholeAnnotationEngine(value,policy,3,true,true,true,true,false,CLOCK_LAYOUT_READER_SOURCE) as WholeUserTimingTraceV11;}
export type WholeUserTimingTraceV10=TracePolicy<WholeUserTimingTraceV8,typeof WHOLE_USER_TIMING_V10_POLICY,WholeUserTimingStudyV10>;
export function readWholeUserTimingTraceV10(value:unknown,policy:unknown){return readWholeAnnotationEngine(value,policy,3,true,true,true,true,true,FRAME_PRESENTED_READER_SOURCE) as WholeUserTimingTraceV10;}
const FRAME_PRESENTED_READER_SOURCE=Symbol('whole-frame-presented-r-v10');
export type WholeUserTimingTraceV9=TracePolicy<WholeUserTimingTraceV8,typeof WHOLE_USER_TIMING_V9_POLICY,WholeUserTimingStudyV9>;
export function readWholeUserTimingTraceV9(value:unknown,policy:unknown){return readWholeAnnotationEngine(value,policy,3,true,true,true,true,true) as WholeUserTimingTraceV9;}
/** Separate private diagnostic; never a replacement decoder/collector policy. */
type NativeTrace<S>=Omit<ReturnType<typeof readNativeClock3PhaseEngine>,'study'>&{study:Omit<S,'clock3Projection'>|null};
export function readNativeClock3PhaseTrace(value:unknown,names:unknown,policy:unknown){return readNativeClock3PhaseEngine(value,names,policy) as NativeTrace<ReturnType<ReturnType<typeof createNativeClock3PhaseStudy>['finish']>>;}
export function readNativeClock3PhaseTraceV2(value:unknown,names:unknown,policy:unknown){return readNativeClock3PhaseEngine(value,names,policy,true) as NativeTrace<ReturnType<ReturnType<typeof createNativeClock3PhaseStudyV2>['finish']>>;}
function readNativeClock3PhaseEngine(value:unknown,names:unknown,policy:unknown,compactV9=false) {
 let reason:string|null=null,ref:Reference|null=null,study:ReturnType<ReturnType<typeof createNativeClock3PhaseStudy>['finish']>|ReturnType<ReturnType<typeof createNativeClock3PhaseStudyV2>['finish']>|null=null;
 let out:ReturnType<typeof readOwnedFile>={reason:null,EOF:false,closed:false,identityMatch:false,hashMatch:false,reads:0,bytes:0,hash:null,before:null,after:null};
 const tuple=nativeClock3Names(names);
 if(policy!==(compactV9?NATIVE_CLOCK3_PHASE_V2_POLICY:NATIVE_CLOCK3_PHASE_POLICY))reason='unsupported-policy';else if(!tuple)reason='invalid-mark-names';
 else try{ref=reference(value);}catch{reason='invalid-reference';}
 if(ref&&tuple){const s=compactV9?createNativeClock3PhaseStudyV2(ref.bytes,tuple,NATIVE_CLOCK3_PHASE_V2_POLICY):createNativeClock3PhaseStudy(ref.bytes,tuple,NATIVE_CLOCK3_PHASE_POLICY);out=readOwnedFile(ref,s);reason=out.reason;study=s.finish();}
 const fullInputVerified=reason===null&&out.EOF&&out.closed&&out.identityMatch&&out.hashMatch;
 const complete=fullInputVerified&&study?.status==='whole-annotation-study'&&study.framingBoundaryComplete;
 if(!complete)reason??=study?.reason??'whole-annotation-unavailable';
 if(complete&&study){
  if(study.rawDropInventory?.status!=='complete-supported-header-declarations'||study.rawDropInventory.unexplainedDeclarations!==0||study.rawDropInventory.contradictoryDeclarations!==0)reason='clock3-raw-drop';
  else if(study.sequenceStart?.unexplained!==0||study.sequenceStart.contradictions!==0)reason='clock3-sequence-state';
  else if(study.markInventoryAdmission!=='resolved-supported-roots')reason='clock3-mark-inventory';
  else reason=study.clock3Projection?.reason??null;
 }
 const projection:NativeClock3Projection|null=complete&&reason===null?study?.clock3Projection?.projection??null:null;
 if(!projection)reason??='clock3-projection-unavailable';
 const retainedStudy=study===null?null:((({clock3Projection:_,...rest})=>rest)(study));
 if(!complete&&retainedStudy){retainedStudy.status='unavailable';retainedStudy.reason=reason;retainedStudy.semanticProcessing='unavailable';retainedStudy.markInventoryAdmission='not_evaluated';retainedStudy.candidates=[];if(retainedStudy.evidenceInventory)retainedStudy.evidenceInventory=compactV9?{status:'unavailable',version:1,facts:[],occurrences:[]}:{status:'unavailable',observations:[]};if(retainedStudy.rawDropInventory)retainedStudy.rawDropInventory={status:'unavailable',facts:[],nonzeroDeclarations:null,explainedDeclarations:null,unexplainedDeclarations:null,contradictoryDeclarations:null};}
 const result={policy:compactV9?NATIVE_CLOCK3_PHASE_V2_POLICY:NATIVE_CLOCK3_PHASE_POLICY,status:projection?'native-clock3-phase-alignment-diagnostic':'unavailable',reason,fullInputVerified,structuralContainerEOF:fullInputVerified&&study?.framingBoundaryComplete===true,
  reader:{kind:'source-owned-persisted-file',EOF:out.EOF,closed:out.closed,identityMatch:out.identityMatch,hashMatch:out.hashMatch,reads:out.reads,bytes:out.bytes,sha256:out.hash,before:out.before,after:out.after},study:retainedStudy,projection,inputOrigin:'not_authenticated',authority:WHOLE_ANNOTATION_AUTHORITY};
 try{return finishWholeAnnotationOutput(result);}catch{return finishWholeAnnotationOutput({...result,status:'unavailable',reason:'result-capacity',projection:null,study:null});}
}
// Numeric2 selects V5 metadata validation without adding an engine argument.
function readWholeAnnotationEngine(value:unknown,policy:unknown,userTiming:boolean|2|3,diagnosticV3=false,provenance=false,evidenceV7=false,rawDropV8=false,compactV9=false,source?:typeof FRAME_PRESENTED_READER_SOURCE|typeof CLOCK_LAYOUT_READER_SOURCE){
 let reason:string|null=null,ref:Reference|null=null,study:WholeAnnotationStudy|WholeUserTimingStudy|WholeUserTimingStudyV3|WholeUserTimingStudyV4|WholeUserTimingStudyV5|WholeUserTimingStudyV6|WholeUserTimingStudyV7|WholeUserTimingStudyV8|WholeUserTimingStudyV9|WholeUserTimingStudyV10|WholeUserTimingStudyV11|null=null;
 let out:ReturnType<typeof readOwnedFile>={reason:null,EOF:false,closed:false,identityMatch:false,hashMatch:false,reads:0,bytes:0,hash:null,before:null,after:null};
 const selectedPolicy=source===CLOCK_LAYOUT_READER_SOURCE?WHOLE_USER_TIMING_V11_POLICY:source===FRAME_PRESENTED_READER_SOURCE?WHOLE_USER_TIMING_V10_POLICY:compactV9?WHOLE_USER_TIMING_V9_POLICY:rawDropV8?WHOLE_USER_TIMING_V8_POLICY:evidenceV7?WHOLE_USER_TIMING_V7_POLICY:userTiming===3?WHOLE_USER_TIMING_V6_POLICY:userTiming===2?WHOLE_USER_TIMING_V5_POLICY:provenance?WHOLE_USER_TIMING_V4_POLICY:diagnosticV3?WHOLE_USER_TIMING_V3_POLICY:userTiming?WHOLE_USER_TIMING_POLICY:WHOLE_ANNOTATION_POLICY;
 try{if(policy!==selectedPolicy)throw Error();ref=reference(value);}catch{reason='invalid-reference';}
 if(ref){const s=source===CLOCK_LAYOUT_READER_SOURCE?createWholeUserTimingStudyV11(ref.bytes,selectedPolicy):source===FRAME_PRESENTED_READER_SOURCE?createWholeUserTimingStudyV10(ref.bytes,selectedPolicy):compactV9?createWholeUserTimingStudyV9(ref.bytes,selectedPolicy):rawDropV8?createWholeUserTimingStudyV8(ref.bytes,selectedPolicy):evidenceV7?createWholeUserTimingStudyV7(ref.bytes,selectedPolicy):userTiming===3?createWholeUserTimingStudyV6(ref.bytes,selectedPolicy):userTiming===2?createWholeUserTimingStudyV5(ref.bytes,selectedPolicy):provenance?createWholeUserTimingStudyV4(ref.bytes,selectedPolicy):diagnosticV3?createWholeUserTimingStudyV3(ref.bytes,selectedPolicy):userTiming?createWholeUserTimingStudy(ref.bytes,selectedPolicy):createWholeAnnotationStudy(ref.bytes,selectedPolicy);out=readOwnedFile(ref,s);reason=out.reason;study=s.finish();}
 const fullInputVerified=reason===null&&out.EOF&&out.closed&&out.identityMatch&&out.hashMatch;
 const complete=fullInputVerified&&study?.status==='whole-annotation-study'&&study.framingBoundaryComplete;
 if(!complete)reason??=study?.reason??'whole-annotation-unavailable';
 if(!complete&&study)study={...study,status:'unavailable',reason:reason??'whole-annotation-unavailable',semanticProcessing:'unavailable',markInventoryAdmission:'not_evaluated',candidates:[],...('rawDropInventory' in study?{rawDropInventory:{status:'unavailable' as const,facts:[],nonzeroDeclarations:null,explainedDeclarations:null,unexplainedDeclarations:null,contradictoryDeclarations:null}}:{}),...('evidenceInventory' in study?{evidenceInventory:source===CLOCK_LAYOUT_READER_SOURCE?{status:'unavailable' as const,version:2 as const,facts:[],occurrences:[]}:compactV9?{status:'unavailable' as const,version:1 as const,facts:[],occurrences:[]}:{status:'unavailable' as const,observations:[]}}:{})} as typeof study;
 const result={policy:selectedPolicy,status:complete?'complete-whole-annotation-diagnostic':'unavailable',reason,fullInputVerified,structuralContainerEOF:fullInputVerified&&study?.framingBoundaryComplete===true,reader:{kind:'source-owned-persisted-file',EOF:out.EOF,closed:out.closed,identityMatch:out.identityMatch,hashMatch:out.hashMatch,reads:out.reads,bytes:out.bytes,sha256:out.hash,before:out.before,after:out.after},study,authority:WHOLE_ANNOTATION_AUTHORITY};
 try{return finishWholeAnnotationOutput(result);}catch{const unavailable={...result,status:'unavailable',reason:'result-capacity',study:study===null?null:{...study,status:'unavailable',reason:'result-capacity',semanticProcessing:'unavailable',markInventoryAdmission:'not_evaluated',candidates:[],...('rawDropInventory' in study?{rawDropInventory:{status:'unavailable' as const,facts:[],nonzeroDeclarations:null,explainedDeclarations:null,unexplainedDeclarations:null,contradictoryDeclarations:null}}:{}),...('evidenceInventory' in study?{evidenceInventory:source===CLOCK_LAYOUT_READER_SOURCE?{status:'unavailable' as const,version:2 as const,facts:[],occurrences:[]}:compactV9?{status:'unavailable' as const,version:1 as const,facts:[],occurrences:[]}:{status:'unavailable' as const,observations:[]}}:{})}};return finishWholeAnnotationOutput(unavailable);}
}
