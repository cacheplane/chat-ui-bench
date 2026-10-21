import fs from'node:fs';import{types}from'node:util';import{createHash}from'node:crypto';
import{resolve}from'node:path';
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
export function readD0PersistedTrace(value:unknown,policy:unknown){
 let reason:string|null=null,ref:Reference|null=null,fd:number|undefined,study:D0Result|null=null;
 let EOF=false,closed=false,identityMatch=false,hashMatch=false,reads=0,bytes=0;
 let hash:string|null=null,before:string[]|null=null,after:string[]|null=null;
 try{
  if(policy!==D0_POLICY)throw Error();ref=reference(value);
 }catch{reason='invalid-reference';}
 if(ref){
  const s=createD0StructuralStudy(ref.bytes,D0_POLICY),wholeHash=createHash('sha256');
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
  study=s.finish();
 }
 const fullInputVerified=reason===null&&EOF&&closed&&identityMatch&&hashMatch;
 const verified=fullInputVerified&&study?.framingBoundaryComplete===true;
 if(!verified)reason??='structural-unavailable';else if(study?.status==='unavailable')reason='packet-projection-unavailable';
 const result={policy:D0_POLICY,status:verified&&reason===null?'complete-structural-diagnostic':'unavailable',reason,fullInputVerified,structuralContainerEOF:verified,
  reader:{kind:'source-owned-persisted-file',EOF,closed,identityMatch,hashMatch,reads,bytes,sha256:hash,before,after},study,authority:D0_AUTHORITY};
 encodeD0Result(result);return result;
}
