import {spawn} from 'node:child_process';
import {openSync,writeSync,fsyncSync,closeSync,mkdirSync,lstatSync,readdirSync,mkdtempSync,realpathSync} from 'node:fs';
import {resolve,isAbsolute,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {preflight,readBounded,instrument,reverse} from './instrument.mjs';
import {tmpdir} from 'node:os';
import {render} from './observer-base.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const sourceRoot=resolve(here,'../..');
const runtime=()=>({node:process.versions.node,v8:process.versions.v8,platform:process.platform,arch:process.arch,execPath:process.execPath});
const digest=b=>createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(readBounded(resolve(here,'source-pins.json'),16384));
export function parseArgs(args){
 if(!Array.isArray(args)||args.length>3)throw Error('arguments');
 const out={mode:'test',sourceRoot};let mode=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--preflight'||args[i]==='--test'){if(mode)throw Error('arguments');out.mode=args[i].slice(2);mode=true;}
  else if(args[i]==='--out'){const p=args[++i];if(out.out||typeof p!=='string'||!isAbsolute(p)||resolve(p)!==p)throw Error('arguments');out.out=p;}
  else throw Error('arguments');
 }
 if(out.mode==='preflight'&&out.out)throw Error('arguments');return out;
}
export function allocateOutput(out,makeParent=()=>mkdtempSync(join(tmpdir(),'h100-observer-'))){
 const path=out??join(makeParent(),'run');
 if(typeof path!=='string'||!isAbsolute(path)||resolve(path)!==path)throw Error('output-path');
 mkdirSync(path,{mode:0o700});return path;
}
export function deriveStudy(){
 const legacy=readBounded(resolve(here,'observer-base.mjs'),65536);
 if(legacy.length!==25223||digest(legacy)!=='b24787211944d896a02f7856bec7350e699c3e670301ed9a57f68ef3bf7806fc')throw Error('legacy-pin');
 const old=legacy.toString('utf8');
 if(old.split('work:32768').length!==2||old.split("kind:'history-cache-observer-capability-v1'").length!==2)throw Error('profile-anchor');
 return Buffer.from(old.replace('work:32768','work:393216').replace("kind:'history-cache-observer-capability-v1'","kind:'history-cache-observer-h100-functional-v1'"));
}
const realIO={open:p=>openSync(p,'wx',0o600),write:(fd,b,offset)=>writeSync(fd,b,offset,b.length-offset),fsync:fsyncSync,close:closeSync,read:p=>readBounded(p,1048576)};
export function writeClosed(path,bytes,io=realIO){
 if(!Buffer.isBuffer(bytes)||bytes.length>1048576)throw Error('output-limit');let fd=io.open(path),error;
 try{let offset=0;while(offset<bytes.length){const n=io.write(fd,bytes,offset);if(!Number.isSafeInteger(n)||n<=0||n>bytes.length-offset)throw Error('write');offset+=n;}io.fsync(fd);}catch(e){error=e;}
 try{io.close(fd);}catch(e){error??=e;}if(error)throw error;const readback=io.read(path);if(!Buffer.isBuffer(readback)||!readback.equals(bytes))throw Error('readback');return {bytes:bytes.length,sha256:digest(readback),fsync:'fulfilled',close:'fulfilled',readback:'matched'};
}
export function studyReport(checks){
 if(!Array.isArray(checks)||checks.length>64)throw Error('checks');return {schemaVersion:1,kind:'history-cache-observer-h100-functional-study-v1',status:'unavailable',sourcePins:pins,checks,warmReadiness:'unavailable',liveReactMapping:'unavailable',externalMutationContinuity:'unavailable',authority:{qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'}};
}
export function prepare(root=sourceRoot,actual=runtime()){
 if(!/^24\./.test(actual.node)||!['linux','darwin'].includes(actual.platform))throw Error('runtime');
 const observer=deriveStudy(),legacy=readBounded(resolve(here,'observer-base.mjs'),65536),result=preflight(root);
 const source=readBounded(resolve(root,'node_modules/@tanstack/virtual-core/dist/esm/index.js'),65536).toString('utf8');
 const transformed=instrument(source,new URL('./observer-base.mjs',import.meta.url).href);
 if(reverse(transformed)!==source)throw Error('reverse');
 const fingerprints=Object.fromEntries(['run.mjs','instrument.mjs','conformance.node.mjs','source-pins.json'].map(name=>{const b=readBounded(resolve(here,name),262144);return [name,{bytes:b.length,sha256:digest(b)}];}));
 return {...result,reverse:'exact',insertions:transformed.insertions.length,profile:'h100-functional-v1',workCeiling:393216,detailKind:'history-cache-observer-h100-functional-v1',studyKind:'history-cache-observer-h100-functional-study-v1',runtime:actual,fingerprints,observer:{bytes:observer.length,sha256:digest(observer)},legacyObserver:{bytes:legacy.length,sha256:digest(legacy)}};
}
function inventory(root){let files=0,bytes=0,variants=0;const rows=[];function walk(p,depth){if(depth>1)throw Error('file-depth');for(const name of readdirSync(p)){const path=resolve(p,name),s=lstatSync(path);if(s.isSymbolicLink()||s.nlink!==1&&!s.isDirectory())throw Error('file-shape');if(s.isDirectory()){walk(path,depth+1);continue;}if(!s.isFile()||++files>96||(bytes+=s.size)>8388608)throw Error('file-limit');if(/^index-\d+\.mjs$/.test(name)&&++variants>40)throw Error('fixture-limit');rows.push({path:path.slice(root.length+1),bytes:s.size,sha256:digest(readBounded(path,8388608))});}}walk(root,0);return {files,bytes,variants,rows};}
function groupExists(pid){try{process.kill(-pid,0);return true;}catch(e){if(e?.code==='ESRCH')return false;throw e;}}
export async function closeGroup(pid,ports={exists:groupExists,kill:(id,signal)=>process.kill(-id,signal),now:()=>performance.now(),delay:ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!pid||!ports.exists(pid))return false;
 try{ports.kill(pid,'SIGKILL');}catch(e){if(e?.code!=='ESRCH')throw e;}
 const deadline=ports.now()+5000;
 while(ports.exists(pid)&&ports.now()<deadline)await ports.delay(25);
 return ports.exists(pid);
}
export async function runTests(options){
 const start=performance.now(),deadline=start+120000;const before=prepare(options.sourceRoot);
 options={...options,out:allocateOutput(options.out)};
 writeClosed(resolve(options.out,'observer-study.mjs'),deriveStudy());
 const fixtures=resolve(options.out,'fixtures');mkdirSync(fixtures,{mode:0o700});
 let failure=null,timedOut=false,exit=null,close=null,spawnError=false;const streams={stdout:{bytes:0,end:false,close:false},stderr:{bytes:0,end:false,close:false}};
 for(const name of Object.keys(streams))streams[name].fd=openSync(resolve(options.out,`${name}.bin`),'wx',0o600);
 const child=spawn(process.execPath,['--test','--test-concurrency=1','--test-reporter=spec','conformance.node.mjs'],{cwd:here,detached:true,stdio:['ignore','pipe','pipe'],env:{CAPABILITY_SOURCE_ROOT:options.sourceRoot,CAPABILITY_OUTPUT_ROOT:fixtures,CAPABILITY_ARTIFACT_ROOT:options.out,TZ:'UTC'}});
 function stop(code){failure??=code;try{process.kill(-child.pid,'SIGTERM');}catch{};}
 const timer=setTimeout(()=>{timedOut=true;stop('deadline');},Math.max(1,deadline-performance.now()));
 const killTimer=setTimeout(()=>{if(!close){try{process.kill(-child.pid,'SIGKILL');}catch{}}},Math.max(1,deadline-performance.now()+5000));
 const containment=new Promise(resolveContainment=>{const t=setTimeout(()=>resolveContainment('unresolved'),Math.max(1,deadline-performance.now()+10000));child.once('close',()=>{clearTimeout(t);resolveContainment('closed');});});
 for(const [name,stream] of [['stdout',child.stdout],['stderr',child.stderr]]){
  const s=streams[name];stream.on('data',b=>{if(s.bytes+b.length>1048576){stop('stdio-limit');return;}try{let offset=0;while(offset<b.length){const n=writeSync(s.fd,b,offset,b.length-offset);if(n<=0)throw Error('write');offset+=n;}s.bytes+=b.length;}catch{stop('stdio-write');}});stream.on('end',()=>{s.end=true;});stream.on('close',()=>{s.close=true;});stream.on('error',()=>stop('stdio-error'));
 }
 child.once('error',()=>{spawnError=true;failure??='spawn';});child.once('exit',(code,signal)=>{exit=[code,signal];});child.once('close',(code,signal)=>{close=[code,signal];});
 const containmentState=await containment;clearTimeout(timer);clearTimeout(killTimer);
 const exact=a=>Array.isArray(a)&&a.length===2&&Number.isInteger(a[0])&&a[0]===0&&a[1]===null;
 const groupSeenAlive=child.pid?groupExists(child.pid):null;
 let groupAlive=groupSeenAlive?await closeGroup(child.pid):groupSeenAlive;
 if(groupSeenAlive)failure??='process-group-survivor';
 if(containmentState!=='closed'||groupAlive||spawnError||!exact(exit)||!exact(close)||JSON.stringify(exit)!==JSON.stringify(close))failure??='process-closure';
 if(Object.values(streams).some(s=>!s.end||!s.close))failure??='stdio-closure';
 if(performance.now()>=deadline)failure??='deadline';
 const saved={};for(const [name,s]of Object.entries(streams)){let ok=true;try{fsyncSync(s.fd);}catch{ok=false;failure??='stdio-fsync';}try{closeSync(s.fd);}catch{ok=false;failure??='stdio-file-close';}try{const b=readBounded(resolve(options.out,`${name}.bin`),1048576);if(b.length!==s.bytes)throw Error('readback');saved[name]={bytes:b.length,sha256:digest(b),fsync:ok?'fulfilled':'failed',close:ok?'fulfilled':'failed',readback:'matched'};}catch{failure??='stdio-readback';}}
 // Containment is not a deadline extension. Late or unresolved work is never admitted.
 if(failure==='deadline'||containmentState!=='closed')return {exitCode:1,reason:failure??'containment',timedOut,exit,close,groupAlive,containmentState,deadlineMilliseconds:120000,elapsedMilliseconds:performance.now()-start,artifacts:'unadmitted-containment-only',saved,output:options.out};
 const after=prepare(options.sourceRoot);if(JSON.stringify(before)!==JSON.stringify(after))failure??='source-drift';
 const check=failure?'failed':'passed';const report=studyReport([{id:'synthetic-core-tests',outcome:check},{id:'exact-source-reverse',outcome:'passed'},{id:'real-node-process-closure',outcome:check}]);
 const reportFile=writeClosed(resolve(options.out,'study.json'),render(report));
 const receipt={schemaVersion:1,kind:'portable-functional-node-run-v1',status:failure?'failed':'closed',reason:failure,timedOut,deadlineMilliseconds:120000,exit,close,groupAlive,containmentState,stdio:Object.fromEntries(Object.entries(streams).map(([n,s])=>[n,{bytes:s.bytes,end:s.end,close:s.close}])),saved,reportFile,sourceBefore:before,sourceAfter:after,inventory:inventory(options.out),authority:report.authority};
 const receiptFile=writeClosed(resolve(options.out,'receipt.json'),render(receipt));
 const finalInventory=inventory(options.out);const finalSource=prepare(options.sourceRoot);const within=performance.now()<deadline;
 const verified=JSON.stringify(finalSource)===JSON.stringify(before)&&within;
 const verification={schemaVersion:1,kind:'external-final-verification-v1',status:verified?'closed':'failed',deadlineMilliseconds:120000,withinOriginalBoundary:within,elapsedMilliseconds:performance.now()-start,receiptFile,reportFile,inventory:finalInventory,sourcePins:finalSource.files,authority:report.authority};
 if(!within)return {exitCode:1,reason:'finalization-deadline',artifacts:'unadmitted'};
 writeClosed(resolve(options.out,'verification.json'),render(verification));
 const completeInventory=inventory(options.out);
 const stableSource=JSON.stringify(prepare(options.sourceRoot))===JSON.stringify(before);
 if(!stableSource||performance.now()>=deadline)return {exitCode:1,reason:'post-verification-boundary-or-source',artifacts:'unadmitted'};
 return {exitCode:failure||!verified?1:0,status:failure||!verified?'failed':'closed',output:options.out,inventory:completeInventory,qualification:false,warmReadiness:'unavailable',fps:'unavailable'};
}
export async function main(args){const options=parseArgs(args);if(options.mode==='preflight'){const result=prepare(options.sourceRoot);process.stdout.write(JSON.stringify({status:'prepared',...result,vendorExecuted:false,outputWritten:false})+'\n');return 0;}const result=await runTests(options);process.stdout.write(JSON.stringify(result)+'\n');return result.exitCode;}
if(process.argv[1]&&pathToFileURL(realpathSync(resolve(process.argv[1]))).href===import.meta.url){main(process.argv.slice(2)).then(code=>{process.exitCode=code;},error=>{process.stderr.write(`h100-observer-run-refused: ${error.code??error.message}\n`);process.exitCode=1;});}
