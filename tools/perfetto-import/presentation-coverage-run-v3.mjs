// Fixed sibling diagnostic. Existing pinned runners and policies stay unchanged.
import fs from 'node:fs/promises';
import{
  constants
}
from'node:fs';
import cp from'node:child_process';
import{
  createHash
}
from'node:crypto';
import{
  dirname,join,isAbsolute,resolve,parse
}
from'node:path';
import{
  fileURLToPath
}
from'node:url';
import{
  types
}
from'node:util';
import model from './presentation-coverage-source-model-v2.json' with {
  type:'json'
};
import {
  evaluatePresentationCoverageV2,inspectPresentationCoverageCoreV2
}
from './presentation-coverage-core-v2.mjs';
import {
  createPresentationCoverageAccountV2,chargePresentationCoverageWorkV2
}
from './presentation-coverage-wire-v2.mjs';
import * as acquisition from '../native-real-chat/request-window-run-v2.mjs';
// V3 versions the exporter only; the imported inventory model/core remain V2.
// model.sql identifies the legacy V2 query; EXPORT_CONTRACT.sql is executed.
export const EXPORT_CONTRACT=Object.freeze({
  schema:'presentation-coverage-export-contract-v3',exportPolicy:'typed-uint64-decimal-export-v3',inventorySchema:'browser-presentation-coverage-inventory-v2',inventoryPolicy:model.policy,inventoryModel:'presentation-coverage-source-model-v2.json',sql:Object.freeze({path:'presentation-coverage-v3.sql',bytes:13452,sha256:'7f7ce8aa5a78acfe1bd4b03e2d028efa9a781963ca7ccd918c345277e1e0d7fa'}),argumentEncoding:'typed-uint64-canonical-decimal-other-cells-unchanged'
});
export const EXPECTED_VERSION=model.importer.versionText.trim();
export const PROCESSOR_PINS=Object.freeze({
  ...model.importer.processorPins
});
const SOURCE_PINS=Object.freeze({
  "presentation-coverage-v3.sql": {
    "bytes": 13452,
    "sha256": "7f7ce8aa5a78acfe1bd4b03e2d028efa9a781963ca7ccd918c345277e1e0d7fa"
  },
  "presentation-coverage-wire-v2.mjs": {
    "bytes": 9089,
    "sha256": "bc33c1e69d7134de6579ed6385bc27b0a45b50aa16effc8cd13c07176000104a"
  },
  "presentation-coverage-core-v2.mjs": {
    "bytes": 40209,
    "sha256": "49f9f01a6e2b4e3e416f37fdc04127addf347afeaa4268d503c87c6d28a03eb6"
  },
  "presentation-coverage-source-model-v2.json": {
    "bytes": 9659,
    "sha256": "1248549504a954ac87ea91af9b3292d72c65d6a374fa9d8dcb68bc02156048a8"
  }
});
const BASE=dirname(fileURLToPath(import.meta.url)),SELF=fileURLToPath(import.meta.url),originals=new WeakMap();
const bad=()=>Error('capacity-export-unavailable'),hash=b=>createHash('sha256').update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),identity=s=>Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));
const need=(ok,reason)=>{
  if(!ok)throw Error(reason);
},SHA=/^[a-f0-9]{64}$/;
const pathOK=p=>typeof p==='string'&&p.length>0&&p.length<=4096&&Buffer.byteLength(p)<=4096&&p.isWellFormed()&&!/[\x00-\x1f\x7f-\x9f]/.test(p)&&isAbsolute(p)&&resolve(p)===p;
const authorities=()=>({
  fps:null,rate:null,duration:null,exhaustivePopulation:false,nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false
});
function refused(stage,reason){
  return Object.freeze({
    schema:'browser-presentation-coverage-inventory-run-v3',policy:model.policy,exportPolicy:EXPORT_CONTRACT.exportPolicy,status:'unavailable',stage,reason,publication:null,diagnostic:null,authorities:Object.freeze(authorities())
  });
}
function clock(){const start=performance.now(),callbacks=new Set();let aborted=false;return{check(){if(aborted||performance.now()-start>=240000)throw bad();},abort(){aborted=true;for(const callback of callbacks)callback();},onAbort(callback){callbacks.add(callback);return()=>callbacks.delete(callback);},remaining(){return Math.max(1,240000-(performance.now()-start));}};}
async function snapshot(path,cap,c,expected=null,retain=false){c.check();if(!pathOK(path)||await fs.realpath(path)!==path)throw bad();const ancestors=[];let dir=parse(path).root;for(const part of path.slice(dir.length).split('/').slice(0,-1)){dir=join(dir,part);const a=await fs.lstat(dir,{bigint:true});c.check();if(!a.isDirectory()||a.isSymbolicLink())throw bad();ancestors.push({path:dir,dev:a.dev,ino:a.ino});}const named=await fs.lstat(path,{bigint:true});c.check();if(!named.isFile()||named.nlink!==1n||named.size>BigInt(cap))throw bad();const file=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{c.check();const first=await file.stat({bigint:true}),id=identity(first);if(!same(id,identity(named))||!same(id,identity(await fs.lstat(path,{bigint:true}))))throw bad();if(expected?.identity&&!same(id,expected.identity))throw bad();const digest=createHash('sha256'),parts=[],buffer=Buffer.alloc(65536);let bytes=0,reads=0;for(;;){c.check();if(++reads>8192)throw bad();const n=(await file.read(buffer,0,Math.min(buffer.length,cap+1-bytes),bytes)).bytesRead;c.check();if(!n)break;bytes+=n;if(bytes>cap)throw bad();digest.update(buffer.subarray(0,n));if(retain)parts.push(Buffer.from(buffer.subarray(0,n)));}if(BigInt(bytes)!==first.size||!same(id,identity(await file.stat({bigint:true})))||!same(id,identity(await fs.lstat(path,{bigint:true})))||await fs.realpath(path)!==path)throw bad();for(const a of ancestors){const s=await fs.lstat(a.path,{bigint:true});c.check();if(!s.isDirectory()||s.isSymbolicLink()||s.dev!==a.dev||s.ino!==a.ino)throw bad();}const fact={path,bytes,sha256:digest.digest('hex'),identity:id};if(expected&&((expected.bytes!==undefined&&expected.bytes!==bytes)||(expected.sha256!==undefined&&expected.sha256!==fact.sha256)))throw bad();return{fact,contents:retain?Buffer.concat(parts):null};}finally{await file.close();c.check();}}
async function write(path,bytes,cap,c){c.check();if(!Buffer.isBuffer(bytes)||bytes.length>cap)throw bad();const file=await fs.open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let id;try{c.check();let offset=0,calls=0;while(offset<bytes.length){if(++calls>1024)throw bad();const n=(await file.write(bytes,offset,Math.min(65536,bytes.length-offset),offset)).bytesWritten;c.check();if(!n)throw bad();offset+=n;}await file.sync();id=identity(await file.stat({bigint:true}));}finally{await file.close();}return(await snapshot(path,cap,c,{bytes:bytes.length,sha256:hash(bytes),identity:id})).fact;}
function originalPid(pid){if(!Number.isSafeInteger(pid)||pid<1)throw bad();const raw=cp.execFileSync('/bin/ps',['-ww','-p',String(pid),'-o','pid=,ppid=,pgid=,lstart='],{encoding:'utf8',timeout:1000,maxBuffer:256,env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}}),m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(raw);if(!m||Number(m[1])!==pid)throw bad();return{pid,ppid:Number(m[2]),pgid:Number(m[3]),start:m[4]};}
async function capture(executable,args,deadlineMs,c,stdoutCap){const started=performance.now(),record={args,code:null,signal:null,closed:false,error:null,timedOut:false,elapsedDeadlineExceeded:false,streams:{},original:null,groupAbsent:false};const buffers={stdout:[],stderr:[]};let exit=null,close=null,timer,finalTimer;const child=cp.spawn(executable,args,{detached:true,stdio:['ignore','pipe','pipe'],env:{LANG:'C',LC_ALL:'C',PATH:dirname(process.execPath)+':/usr/bin:/bin'}});const contain=()=>{try{const o=record.original;if(o){try{if(!same(originalPid(o.pid),o))return;}catch{if(!exit)return;try{process.kill(o.pid,0);return;}catch(e){if(e.code!=='ESRCH')return;}}process.kill(-o.pgid,'SIGKILL');}else child.kill('SIGKILL');}catch(e){if(e.code!=='ESRCH')record.killError='original-group-containment-unavailable';}};const fail=reason=>{record.error??=reason;contain();};child.on('error',()=>fail('original-process-error'));child.once('exit',(code,signal)=>{exit={code,signal};record.exit={code,signal};if(code!==0||signal!==null)fail('processor-exited-unsuccessfully');});const done=new Promise(r=>child.once('close',(code,signal)=>{close={code,signal};record.close={code,signal};record.code=code;record.signal=signal;record.closed=true;record.closeElapsedMs=performance.now()-started;if(record.closeElapsedMs>=deadlineMs){record.elapsedDeadlineExceeded=true;fail('process-deadline-exceeded');}r();}));for(const name of['stdout','stderr']){const stream=child[name],s=record.streams[name]={eof:false,closed:false,forcedDestroy:false,error:null,observedBytes:0,bytes:0,chunks:0,sha256:null};stream.on('data',chunk=>{if(!Buffer.isBuffer(chunk)){fail('original-stream-type');return;}s.observedBytes+=chunk.length;if(++s.chunks>8192){fail('original-stream-chunk-limit');return;}const cap=name==='stdout'?stdoutCap:65536,n=Math.min(chunk.length,cap-s.bytes);if(n>0){buffers[name].push(Buffer.from(chunk.subarray(0,n)));s.bytes+=n;}if(n<chunk.length)fail(name+'-limit-exceeded');});stream.on('error',()=>{s.error='original-stream-error';fail(s.error);});stream.once('end',()=>s.eof=true);stream.once('close',()=>s.closed=true);}const remove=c.onAbort(()=>fail('parent-deadline-exceeded'));try{record.original=originalPid(child.pid);if(record.original.ppid!==process.pid||record.original.pgid!==child.pid)throw bad();const settled=await Promise.race([done.then(()=>true),new Promise(r=>timer=setTimeout(()=>{record.timedOut=true;fail('process-deadline-exceeded');r(false);},Math.max(1,Math.min(deadlineMs-(performance.now()-started),c.remaining()))))]);clearTimeout(timer);if(!settled)await Promise.race([done,new Promise(r=>finalTimer=setTimeout(r,Math.max(1,Math.min(5000,c.remaining()))))]);if(!close){fail('original-close-unavailable');for(const name of['stdout','stderr']){record.streams[name].forcedDestroy=true;child[name].destroy();}}for(let attempt=0;attempt<64;attempt++){try{process.kill(-record.original.pgid,0);}catch(e){if(e.code==='ESRCH')record.groupAbsent=true;break;}if(attempt===63||performance.now()-started>=deadlineMs+5000)break;await new Promise(r=>setTimeout(r,Math.min(10,c.remaining())));}if(!record.groupAbsent)fail('original-group-absence-unavailable');if(!exit||!close||exit.code!==0||exit.signal!==null||close.code!==0||close.signal!==null||record.timedOut||Object.values(record.streams).some(s=>!s.eof||!s.closed||s.error||s.forcedDestroy))record.error??='original-closure-unavailable';}catch{fail('original-process-unavailable');}finally{remove();clearTimeout(timer);clearTimeout(finalTimer);if(!close)contain();}record.elapsedMs=performance.now()-started;if(record.elapsedMs>=deadlineMs){record.elapsedDeadlineExceeded=true;fail('process-deadline-exceeded');}const result={record};for(const name of['stdout','stderr']){result[name]=Buffer.concat(buffers[name]);record.streams[name].sha256=hash(result[name]);}c.check();return result;}
async function snapshotAcquisitionFile(path, cap, clock, expected) {
  const id = expected?.identity;
  need(id && !types.isProxy(id) && [Object.prototype, null].includes(Object.getPrototypeOf(id)), 'acquisition-identity-codec');
  const numericKeys = ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs'];
  const privateKeys = ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'];
  const descriptors = Object.getOwnPropertyDescriptors(id);
  const keys = Reflect.ownKeys(descriptors);
  const exact = fields => keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key) && Object.hasOwn(descriptors[key], 'value'));
  if (exact(privateKeys)) return snapshot(path, cap, clock, expected);
  need(exact(numericKeys), 'acquisition-identity-codec');
  // Native acquisition owns numeric fs.Stats fields. Compare numeric Stats
  // directly; converting nanoseconds to milliseconds loses the original codec.
  const normalized = await snapshot(path, cap, clock, {
    path: expected.path, bytes: expected.bytes, sha256: expected.sha256,
  });
  clock.check();
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const ns = await handle.stat({bigint: true});
    need(same(identity(ns), normalized.fact.identity), 'acquisition-identity-drift');
    const numeric = await handle.stat();
    for (const key of numericKeys) {
      const value = descriptors[key].value;
      need(Number.isFinite(value) && !Object.is(value, -0) && value === numeric[key], 'acquisition-identity-mismatch');
      if (['dev', 'ino', 'size'].includes(key)) need(Number.isSafeInteger(value), 'acquisition-identity-codec');
    }
    need(same(identity(await handle.stat({bigint:true})), normalized.fact.identity), 'acquisition-identity-drift');
    need(same(identity(await fs.lstat(path,{bigint:true})), normalized.fact.identity), 'acquisition-identity-drift');
    return normalized;
  } finally {
    await handle.close();
    clock.check();
  }
}
// Non-array values are closed runner/core/qualified-V2 DTOs, at most 32
// own fields. The only map-shaped metadata is the fixed source roster (5),
// generated file roles (7) and process roles (2); dynamic evidence uses arrays.
function freeze(v,account){
  if(v&&typeof v==='object'){
    chargePresentationCoverageWorkV2(account,Array.isArray(v)?v.length+1:33);
    const keys=Object.keys(v);
    need(keys.length<=(Array.isArray(v)?v.length:32),'result-object-width');
    chargePresentationCoverageWorkV2(account,keys.length+1);
    for(const k of keys)freeze(v[k],account);
    chargePresentationCoverageWorkV2(account,keys.length+2);
    Object.freeze(v);
  }
  return v;
}
function serialize(v,account){
  let bound=0;
  const stack=[v];
  while(stack.length){
    chargePresentationCoverageWorkV2(account,1);
    const x=stack.pop();
    if(typeof x==='string'){
      chargePresentationCoverageWorkV2(account,x.length);
      bound+=6*x.length+2;
    }
    else if(x===null||typeof x!=='object')bound+=32;
    else{
      chargePresentationCoverageWorkV2(account,Array.isArray(x)?x.length+1:33);
      const keys=Object.keys(x);
      need(keys.length<=(Array.isArray(x)?x.length:32),'result-object-width');
      chargePresentationCoverageWorkV2(account,keys.length);
      bound+=keys.length+2;
      for(const k of keys){
        chargePresentationCoverageWorkV2(account,k.length+1);
        bound+=Array.isArray(x)?0:6*k.length+3;
        stack.push(x[k]);
      }
    }
    need(bound<=25165824,'result-capacity');
  }
  chargePresentationCoverageWorkV2(account,bound);
  const text=JSON.stringify(v);
  chargePresentationCoverageWorkV2(account,text.length*3);
  need(Buffer.byteLength(text)<=4194304,'result-byte-limit');
  return Buffer.from(text);
}
function sameOwned(a,b,account){
  const left=serialize(a,account),right=serialize(b,account);
  chargePresentationCoverageWorkV2(account,left.length+right.length);
  return left.equals(right);
}
// New generated artifacts share the logical ledger. Existing binary source,
// runtime, processor and caller trace snapshots retain independent custody caps.
function generatedWork(account,bytes,cap,weight){
  need(Number.isSafeInteger(bytes)&&!Object.is(bytes,-0)&&bytes>=0&&bytes<=cap,'generated-byte-capacity');
  chargePresentationCoverageWorkV2(account,bytes*weight);
}
async function writeGenerated(path,bytes,cap,c,account){
  // Three byte passes: input hash, readback hash and conservative buffer work.
  need(Buffer.isBuffer(bytes),'generated-byte-capacity');
  generatedWork(account,bytes.length,cap,3);
  return write(path,bytes,cap,c);
}
async function readGenerated(fact,cap,c,account,retain=false){
  // Two passes for custody scan/hash; retaining also prepays chunk copy/concat.
  generatedWork(account,fact.bytes,cap,retain?4:2);
  return snapshot(fact.path,cap,c,fact,retain);
}
function configOf(raw,authored=false){
  need(typeof raw==='string'&&Buffer.byteLength(raw)<=16384,'invalid-config');
  const c=JSON.parse(raw),expected={
    schema:c.schema,policy:c.policy,exportPolicy:c.exportPolicy,trace:{
      path:c.trace?.path,bytes:c.trace?.bytes,sha256:c.trace?.sha256
    },processor:{
      path:c.processor?.path,sha256:c.processor?.sha256
    },target:{
      frameId:c.target?.frameId,loaderId:c.target?.loaderId
    },phaseNames:{
      start:c.phaseNames?.start,end:c.phaseNames?.end
    },out:c.out,deadlineMs:c.deadlineMs
  };
  need(JSON.stringify(expected)===raw&&c.schema==='browser-presentation-coverage-inventory-run-v3'&&c.policy===model.policy&&c.exportPolicy===EXPORT_CONTRACT.exportPolicy,'invalid-config');
  need([c.trace.path,c.processor.path,c.out].every(pathOK)&&Number.isSafeInteger(c.trace.bytes)&&!Object.is(c.trace.bytes,-0)&&c.trace.bytes>=0&&c.trace.bytes<=33554432&&SHA.test(c.trace.sha256)&&SHA.test(c.processor.sha256)&&Number.isSafeInteger(c.deadlineMs)&&c.deadlineMs>=1&&c.deadlineMs<=60000,'invalid-config');
  for(const name of [...Object.values(c.target),...Object.values(c.phaseNames)])need(typeof name==='string'&&name.length>0&&Buffer.byteLength(name)<=256&&name.isWellFormed()&&!/[\x00-\x1f\x7f-\x9f]/.test(name),'invalid-config');
  need(c.phaseNames.start!==c.phaseNames.end,'invalid-config');
  if(!authored)need(c.deadlineMs===60000,'invalid-config');
  if(!authored)need(PROCESSOR_PINS[process.platform+'-'+process.arch]===c.processor.sha256,'processor-pin');
  const protectedPaths=[c.trace.path,c.processor.path,process.execPath,SELF,...Object.keys(SOURCE_PINS).map(n=>join(BASE,n))];
  need(c.trace.path!==c.processor.path&&!protectedPaths.some(p=>c.out===p||c.out.startsWith(p+'/')||p.startsWith(c.out+'/')),'output-alias');
  return c;
}
async function sources(c){
  const out={
  };
  let total=0;
  for(const[name,pin]of Object.entries(SOURCE_PINS)){
    out[name]=(await snapshot(join(BASE,name),name.endsWith('.sql')?32768:262144,c,pin)).fact;
    total+=out[name].bytes;
  }
  out.runner=(await snapshot(SELF,262144,c)).fact;
  need(total+out.runner.bytes<=1048576,'source-capacity');
  return out;
}
function owned(original){
  need(original&&!types.isProxy(original),'original-run-required');
  const e=originals.get(original);
  need(e,'original-run-required');
  try {
    e.clock.check();
    chargePresentationCoverageWorkV2(e.account,1);
  } catch(error) { originals.delete(original); throw error; }
  return e;
}
export function inspectPresentationCoverageRunV3(original){
  const e=owned(original);
  try {
    inspectPresentationCoverageCoreV2(e.core);
    return e.summary;
  } catch(error) { originals.delete(original); throw error; }
}
export async function verifyPresentationCoverageRunV3(original){
  const e=owned(original);
  try {
    await e.verify();
    return inspectPresentationCoverageRunV3(original);
  } catch(error) { originals.delete(original); throw error; }
}
export function runPresentationCoverageDiagnosticV3(configJSON){
  return run(configJSON,false,null);
}
export function runAuthoredPresentationCoverageDiagnosticV3(configJSON){
  return run(configJSON,true,null);
}
function entryContext(){
  return {clock:clock(),account:createPresentationCoverageAccountV2()};
}
function textWork(text,account){
  need(typeof text==='string'&&text.length<=16384,'invalid-config');
  chargePresentationCoverageWorkV2(account,text.length*8+1);
}
async function run(raw,authored,binding,context=entryContext()){
  let stage='config';
  let c,account;
  try{
    const deadline=context.clock;
    account=context.account;
    deadline.check();textWork(raw,account);
    c=configOf(raw,authored);deadline.check();
    chargePresentationCoverageWorkV2(account,4096);
    const selectorJSON=JSON.stringify({target:c.target,phaseNames:c.phaseNames});
    textWork(selectorJSON,account);
    const canonicalInputs={configJSON:raw,configSha256:hash(raw),selectorJSON,selectorSha256:hash(selectorJSON),adapterConfigJSON:binding?.configJSON??null,adapterConfigSha256:binding?.configSha256??null};
    stage='output';
    need(await fs.realpath(dirname(c.out))===dirname(c.out),'output-parent');
    await fs.mkdir(c.out,{
      mode:0o700
    });
    stage='source';
    const before=await sources(deadline),runtime=(await snapshot(process.execPath,268435456,deadline)).fact,trace=(await snapshot(c.trace.path,33554432,deadline,c.trace)).fact,processor=(await snapshot(c.processor.path,67108864,deadline,c.processor)).fact;
    if(binding)await binding.verify();
    chargePresentationCoverageWorkV2(account,before['presentation-coverage-v3.sql'].bytes*16+4096);
    const text=(await snapshot(before['presentation-coverage-v3.sql'].path,32768,deadline,before['presentation-coverage-v3.sql'],true)).contents.toString('utf8');
    need(text.split('__PHASE_VALUES__').length===2,'fixed-sql');
    const sql=Buffer.from(text.replace('__PHASE_VALUES__',Object.values(c.phaseNames).map(name=>"('"+name.replaceAll("'","''")+"')").join(',')));
    const files={
      sql:await writeGenerated(join(c.out,'diagnostic.sql'),sql,32768,deadline,account)
    },processes={
    };
    stage='process';
    for(const[name,args]of [['version',['--version']],['query',['query','-f',files.sql.path,c.trace.path]]]){
      const stdoutCap=name==='query'?8388608:262144;
      // Reserve copy/concat/hash work before spawn, with no refund or reset.
      generatedWork(account,stdoutCap+65536,8388608+65536,4);
      const actual=await capture(c.processor.path,args,c.deadlineMs,deadline,stdoutCap);
      processes[name]=actual.record;
      files[name+'.stdout']=await writeGenerated(join(c.out,name+'.stdout'),actual.stdout,stdoutCap,deadline,account);
      files[name+'.stderr']=await writeGenerated(join(c.out,name+'.stderr'),actual.stderr,65536,deadline,account);
      need(!actual.record.error,'processor-process');
      if(name==='version')need(new TextDecoder('utf-8',{
        fatal:true
      }).decode(actual.stdout).trim()===EXPECTED_VERSION,'processor-version');
    }
    stage='core';
    const csv=(await readGenerated(files['query.stdout'],8388608,deadline,account,true)).contents;
    const core=evaluatePresentationCoverageV2(csv,selectorJSON,account);
    need(core.status==='diagnostic',core.reason??'core-refusal');
    inspectPresentationCoverageCoreV2(core);
    const verify=async()=>{
      deadline.check();
      if(binding)await binding.verify();
      await snapshot(trace.path,33554432,deadline,trace);
      await snapshot(processor.path,67108864,deadline,processor);
      await snapshot(runtime.path,268435456,deadline,runtime);
      need(sameOwned(before,await sources(deadline),account),'source-bookend');
      for(const[key,fact]of Object.entries(files))await readGenerated(fact,key==='sql'?32768:key==='query.stdout'?8388608:key.endsWith('stderr')?65536:['manifest','result'].includes(key)?4194304:262144,deadline,account);
      deadline.check();
    };
    stage='custody';
    await verify();
    const manifest={
      schema:'presentation-coverage-process-manifest-v3',policy:model.policy,exportPolicy:EXPORT_CONTRACT.exportPolicy,canonicalInputs,officialProcessor:!authored,authoredExecutable:authored,expectedVersion:EXPECTED_VERSION,trace,processor,runtime,sourcesBefore:before,sourcesAfter:before,files:{
        ...files
      },processes,assumptions:{
        sourceExecution:'fresh-trusted-process-reviewed-modules',localMutation:'no-concurrent-local-file-mutation',browserSourceCorrespondence:'vendor-assumed'
      },authorities:authorities()
    };
    files.manifest=await writeGenerated(join(c.out,'manifest.json'),serialize(manifest,account),4194304,deadline,account);
    await verify();
    const result={
      schema:'browser-presentation-coverage-inventory-run-v3',policy:model.policy,exportPolicy:EXPORT_CONTRACT.exportPolicy,status:'diagnostic',stage:null,reason:null,canonicalInputs,publicationState:'provisional-snapshot-requires-original-returned-receipt',executionEvidence:authored?'authored-executable-process-control':'source-owned-official-import',inputOrigin:authored?'authored-executable-generated-csv':'verified-generated-official-csv',traceOrigin:binding?'original-source-owned-request-window-acquisition':'caller-supplied-persisted-trace',clockContract:'official-perfetto-normalized-nanoseconds-v1',acquisitionBinding:binding?.facts??null,graphProof:files['query.stdout'],processManifest:files.manifest,diagnostic:core,authorities:authorities()
    };
    stage='publication';
    const payload=serialize(result,account),publication=await writeGenerated(join(c.out,'result.json'),payload,4194304,deadline,account);
    files.result=publication;
    const returned=freeze({
      ...result,publication
    },account);
    serialize(returned,account);
    stage='custody';
    await verify();
    if(!authored){
      const summary=freeze({
        schema:returned.schema,policy:returned.policy,exportPolicy:returned.exportPolicy,status:'diagnostic',publication,graphProof:returned.graphProof,traceOrigin:returned.traceOrigin,authorities:authorities()
      },account);
      originals.set(returned,{
        clock:deadline,account,core,verify,summary
      });
    }
    return returned;
  }
  catch(error){
    return refused(stage,typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'operation-failed');
  }
}
export async function runPresentationCoverageFromAcquisitionV3(originalAcquisition,raw){
  let stage='acquisition';
  const context=entryContext(),dc=context.clock;
  try{
    dc.check();textWork(raw,context.account);
    const facts=acquisition.inspectRequestWindowAcquisitionV2(originalAcquisition);
    need(sameOwned(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition),context.account),'acquisition-drift');
    const phase=await acquisition.inspectRequestWindowPhaseQualificationV2(originalAcquisition);
    need(sameOwned(phase.facts,facts,context.account),'phase-binding');
    need(typeof raw==='string'&&Buffer.byteLength(raw)<=16384,'invalid-config');
    const c=JSON.parse(raw),expected={
      schema:c.schema,policy:c.policy,exportPolicy:c.exportPolicy,processor:{
        path:c.processor?.path,sha256:c.processor?.sha256
      },out:c.out,deadlineMs:c.deadlineMs
    };
    need(JSON.stringify(expected)===raw&&c.schema==='browser-presentation-coverage-from-acquisition-v3'&&c.policy===model.policy&&c.exportPolicy===EXPORT_CONTRACT.exportPolicy,'invalid-config');
  const trace=(await snapshotAcquisitionFile(facts.trace.path,33554432,dc,facts.trace)).fact,pub=(await snapshotAcquisitionFile(facts.publication.path,1048576,dc,facts.publication)).fact;
    const phaseId=phase.publication.identity,phaseFact={
      ...phase.publication,identity:Array.isArray(phaseId)?Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map((k,i)=>[k,phaseId[i]])):phaseId
    };
    await snapshot(phaseFact.path,65536,dc,phaseFact);
    const verify=async()=>{
      dc.check();
      need(sameOwned(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition),context.account),'acquisition-drift');
      need(sameOwned(phase,await acquisition.inspectRequestWindowPhaseQualificationV2(originalAcquisition),context.account),'phase-drift');
      await snapshot(trace.path,33554432,dc,trace);
      await snapshot(pub.path,1048576,dc,pub);
      await snapshot(phaseFact.path,65536,dc,phaseFact);
    };
    const binding={
      configJSON:raw,configSha256:hash(raw),
      facts:{
        binding:facts.binding,fixtureProfile:facts.fixtureProfile,phaseNames:facts.phaseNames,target:facts.target,acquisitionPublication:pub,phasePublication:phaseFact
      },verify
    };
    return run(JSON.stringify({
      schema:'browser-presentation-coverage-inventory-run-v3',policy:c.policy,exportPolicy:c.exportPolicy,trace:{
        path:trace.path,bytes:trace.bytes,sha256:trace.sha256
      },processor:c.processor,target:facts.target,phaseNames:facts.phaseNames,out:c.out,deadlineMs:c.deadlineMs
    }),false,binding,context);
  }
  catch(error){
    return refused(stage,typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'acquisition-unavailable');
  }
}
if(process.argv[1]&&resolve(process.argv[1])===SELF){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--config'){
    process.stderr.write('usage: --config /absolute/canonical-config.json\n');
    process.exitCode=1;
  }
  else{
    try{
      const context=entryContext();
      chargePresentationCoverageWorkV2(context.account,16384*4);
      const raw=(await snapshot(args[1],16384,context.clock,null,true)).contents.toString('utf8');
      const result=await run(raw,false,null,context);
      process.stdout.write(JSON.stringify({
        schema:result.schema,policy:result.policy,exportPolicy:result.exportPolicy,status:result.status,stage:result.stage,reason:result.reason,publication:result.publication,authorities:result.authorities
      })+'\n');
      if(result.status!=='diagnostic')process.exitCode=1;
    }
    catch{
      process.stderr.write('coverage diagnostic unavailable\n');
      process.exitCode=1;
    }
  }
}
