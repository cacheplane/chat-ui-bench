import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import {constants,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';

/** @typedef {Record<string,any>} Data */
const selected=['.github/workflows/macos-source-availability.yml','tools/macos-source-availability/run.mjs','tools/macos-source-availability/run.test.mjs','tools/macos-capability/README.md'];
const audited=[
 {path:'libsyscall/wrappers/libproc/libproc.c',signature:'proc_listpids(uint32_t type, uint32_t typeinfo, void *buffer, int buffersize)',digest:'7d1f676bdbeca470322d72ad5d1f0257b0efab3d6e2713c89deecce9a1fa98bc'},
 {path:'bsd/kern/proc_info.c',signature:'proc_listpids(uint32_t type, uint32_t typeinfo, user_addr_t buffer, uint32_t  buffersize, int32_t * retval)',digest:'30221118bb08c367545c9eee30ac100676ea8d94ba3264e38c379087809d0657'}
];
const members=['primary-0.c','primary-1.c','receipt.json'];
/** @param {unknown} value @param {number} maximum */
function text(value,maximum){if(typeof value!=='string'||!value||value.length>maximum||Buffer.byteLength(value)>maximum)throw Error('Original bounded identity unavailable');return value;}
/** @param {Record<string,string|undefined>} env @param {Data} runtime */
export function admit(env,runtime){
 if(runtime.platform!=='darwin'||runtime.arch!=='arm64'||runtime.version!=='v24.20.0'||env.GITHUB_ACTIONS!=='true'||env.RUNNER_ENVIRONMENT!=='github-hosted'||env.RUNNER_OS!=='macOS'||env.GITHUB_REPOSITORY!=='cacheplane/chat-ui-bench'||env.GITHUB_REF!=='refs/heads/main'||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||env.EXPECTED_SHA!==env.GITHUB_SHA||env.GITHUB_WORKFLOW_SHA!==env.GITHUB_SHA||env.ImageOS!=='macos15')throw Error('Hosted exact macOS15 admission');
 const keys=['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_JOB','GITHUB_WORKFLOW_REF','GITHUB_WORKFLOW_SHA','ImageOS','ImageVersion'];for(const key of keys)text(env[key],256);
 for(const key of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])if(!/^[1-9][0-9]*$/.test(env[key]??''))throw Error('Original run/attempt identity unavailable');
 text(runtime.v8,256);text(runtime.execPath,256);
 const sha=text(env.GITHUB_SHA,40);return {repository:env.GITHUB_REPOSITORY,sha,ref:env.GITHUB_REF,provider:'github-hosted',platform:runtime.platform,arch:runtime.arch,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,workflowJobKey:env.GITHUB_JOB,workflowRef:env.GITHUB_WORKFLOW_REF,workflowSha:env.GITHUB_WORKFLOW_SHA,imageOS:env.ImageOS,imageVersion:env.ImageVersion,node:runtime.version,v8:runtime.v8,execPath:runtime.execPath};
}
/** @param {string} kernel */
export function exactTag(kernel){if(typeof kernel!=='string'||Buffer.byteLength(kernel)>4096)throw Error('Original kernel metadata capacity4096');const matches=[...kernel.matchAll(/xnu-(\d+(?:\.\d+)+)~/g)];if(matches.length!==1)throw Error('Unambiguous full matching kernel tag unavailable');const match=matches[0];assert.ok(match);return 'xnu-'+match[1];}
/** @param {string[]} outputs @param {string} expected */
export function metadata(outputs,expected){
 if(outputs.length!==5||outputs.some(x=>typeof x!=='string'||Buffer.byteLength(x)>4096))throw Error('Original metadata command closure');
 const [head,kernel,release,arch,product]=outputs.map(x=>x.trim());assert.ok(typeof kernel==='string');assert.equal(head,expected,'Observed HEAD differs from exact main');assert.match(release??'',/^24\.[0-9]+\.[0-9]+$/);assert.equal(arch,'arm64');assert.ok(kernel.startsWith('Darwin Kernel Version '+release+': '),'Original uname kernel/release contradiction');
 const rows=(product??'').split(/\r?\n/),field=/** @param {string} key */key=>{const hits=rows.filter(x=>x.startsWith(key+':'));if(hits.length!==1)throw Error('Original sw_vers field unavailable');return text(hits[0]?.slice(key.length+1).trim(),256);};
 const productVersion=field('ProductVersion');assert.match(productVersion,/^15\.[0-9]+(?:\.[0-9]+)?$/);assert.equal(field('ProductName'),'macOS');
 return {observedHead:head,kernel,kernelRelease:release,architecture:arch,productVersion,productBuild:field('BuildVersion'),exactTag:exactTag(kernel??'')};
}
/** @param {boolean} present @param {unknown} primary @param {unknown[]} cleanup */
function failure(present,primary,cleanup){if(present&&cleanup.length)return new AggregateError([primary,...cleanup],'Original probe and independent cleanup');if(present)return primary;if(cleanup.length)return new AggregateError(cleanup,'Independent probe cleanup');return null;}
/** Bounded diagnostic projection never reads accessors or claims opaque object identity.
 * @param {unknown} value */
export function diagnostic(value){let nodes=0;const seen=new WeakSet();
/** @param {unknown} x
 * @returns {Data} */
function visit(x){if(nodes++>=16)return {type:'unavailable',reason:'Diagnostic nodes16'};const type=x===null?'null':typeof x;if(x===null||type==='boolean'||type==='number')return {type,value:typeof x==='number'&&!Number.isFinite(x)?String(x):x};if(type==='undefined')return {type};if(typeof x==='string')return {type,value:x.slice(0,512),omittedCodeUnits:Math.max(0,x.length-512)};if(x&&typeof x==='object'){if(seen.has(x))return {type:'unavailable',reason:'Original diagnostic cycle'};seen.add(x);const errors=Object.getOwnPropertyDescriptor(x,'errors');if(x instanceof AggregateError&&errors&&'value'in errors&&Array.isArray(errors.value)){const values=[];for(const item of errors.value){if(nodes>=16)break;values.push(visit(item));}return {type:'aggregate',errors:values,omitted:errors.value.length-values.length};}const message=Object.getOwnPropertyDescriptor(x,'message');const str=message&&'value'in message&&typeof message.value==='string'?message.value:null;return {type,message:str===null?'Opaque original value':str.slice(0,512),omittedCodeUnits:str===null?0:Math.max(0,str.length-512)};}return {type,reason:'Opaque original value'};}try{return visit(value);}catch{return {type:value===null?'null':typeof value,reason:'Opaque diagnostic reflection unavailable'};}}
/** Absolute endpoints remain tied to one original start; timing ports are only ordinary-control seams.
 * @param {Data} [ports] */
export function createOwner(ports={}){
 const now=ports.now??(()=>performance.now()),setTimer=ports.setTimer??setTimeout,clearTimer=ports.clearTimer??clearTimeout;const start=now();assert.ok(Number.isFinite(start)&&start>=0);const acquisition=start+60000,report=start+70000;
 /** @type {Set<Promise<unknown>>} */const pending=new Set();
/** @type {unknown[]} */const taskRejections=[];let omittedErrors=0,expired=false;
 /** @type {(e:unknown)=>void} */let revoke;
/** @type {(e:unknown)=>void} */let reportRevoke;
 const revoked=new Promise((_,reject)=>{revoke=reject;}),reportRevoked=new Promise((_,reject)=>{reportRevoke=reject;});void revoked.catch(()=>{});void reportRevoked.catch(()=>{});
 let timer,reportTimer;try{timer=setTimer(()=>{expired=true;revoke(Error('Original acquisition deadline expired; operation remains owned'));},60000);reportTimer=setTimer(()=>reportRevoke(Error('Original cleanup/report deadline expired; operation remains owned')),70000);}catch(error){const cleanup=[];if(timer!==undefined)try{clearTimer(timer);}catch(close){cleanup.push(close);}throw failure(true,error,cleanup);}
 /** @param {()=>unknown|Promise<unknown>} body @param {boolean} cleanup */
 async function dispatch(body,cleanup){const endpoint=cleanup?report:acquisition;if(now()>=endpoint)throw Error('Original deadline admission expired');const task=Promise.resolve().then(()=>{if(now()>=endpoint)throw Error('Original deadline expired before dispatch');return body();});pending.add(task);void task.then(()=>pending.delete(task),error=>{pending.delete(task);if(taskRejections.length<16)taskRejections.push(error);else omittedErrors++;});return Promise.race([task,cleanup?reportRevoked:revoked]);}
 return {start,acquisition,report,pending,taskRejections,run:/** @param {()=>unknown|Promise<unknown>} body */body=>dispatch(body,false),cleanup:/** @param {()=>unknown|Promise<unknown>} body */body=>dispatch(body,true),expired:()=>expired||now()>=acquisition,omittedErrors:()=>omittedErrors,remaining:()=>Math.max(0,report-now()),stop(){const errors=[];for(const original of [timer,reportTimer])try{clearTimer(original);}catch(error){errors.push(error);}return errors;}};
}
/** @param {Data} row @param {'stdout'|'stderr'} stream @param {Buffer} bytes */
function retain(row,stream,bytes){row[stream+'Bytes']+=bytes.length;const old=Buffer.from(row[stream+'PrefixBase64'],'base64'),prefix=Buffer.concat([old,bytes.subarray(0,Math.max(0,4096-old.length))]);row[stream+'PrefixBase64']=prefix.toString('base64');row[stream+'RetainedBytes']=prefix.length;row[stream+'OmittedBytes']=row[stream+'Bytes']-prefix.length;if(row[stream+'Bytes']>4096)row.overflow=true;}
/** @param {string} file @param {string[]} args @param {string} cwd @param {Data[]} rows @param {ReturnType<typeof createOwner>} owner @param {typeof childProcess.spawn} [spawn] @param {unknown} [receiver] */
export async function originalCommand(file,args,cwd,rows,owner,spawn=childProcess.spawn,receiver=childProcess){
 const allowed=(file==='git'&&args.join('\0')==='rev-parse\0HEAD')||(file==='/usr/bin/uname'&&args.length===1&&['-v','-r','-m'].includes(args[0]??''))||(file==='/usr/bin/sw_vers'&&args.length===0);if(!allowed||rows.length>=5)throw Error('Original metadata command allowlist/capacity5');
 /** @type {Data} */const row={file,args:[...args],spawnAttempted:false,exited:false,closed:false,code:null,signal:null,stdoutBytes:0,stderrBytes:0,stdoutPrefixBase64:'',stderrPrefixBase64:'',stdoutRetainedBytes:0,stderrRetainedBytes:0,stdoutOmittedBytes:0,stderrOmittedBytes:0,overflow:false,originalErrors:[],omittedErrors:0,decodingStatus:'not-attempted'};rows.push(row);
 return /** @type {Promise<Data>} */(owner.run(async()=>{
  row.spawnAttempted=true;let child;let originalErrorPresent=false;
/** @type {unknown} */let originalError;try{child=Reflect.apply(spawn,receiver,[file,args,{cwd,stdio:['ignore','pipe','pipe']}]);}catch(error){row.originalErrors.push(diagnostic(error));throw error;}row.pid=child.pid;
  child.stdout?.on('data',b=>retain(row,'stdout',b));child.stderr?.on('data',b=>retain(row,'stderr',b));child.once('error',error=>{originalErrorPresent=true;originalError=error;if(row.originalErrors.length<16)row.originalErrors.push(diagnostic(error));else row.omittedErrors++;});child.once('exit',(code,signal)=>{row.exited=true;row.code=code;row.signal=signal;});
  await new Promise(done=>child.once('close',(code,signal)=>{row.closed=true;row.code=code;row.signal=signal;done(null);}));
  if(originalErrorPresent)throw originalError;
  if(row.overflow||row.originalErrors.length||!row.exited||row.code!==0||row.signal!==null)throw Error('Original metadata command lifecycle/bytes unavailable');
  const decode=new TextDecoder('utf-8',{fatal:true});try{row.stdout=decode.decode(Buffer.from(row.stdoutPrefixBase64,'base64'));row.stderr=decode.decode(Buffer.from(row.stderrPrefixBase64,'base64'));row.decodingStatus='complete-valid-utf8';}catch(error){row.decodingStatus='invalid-utf8';throw error;}return row;
 }));
}
/** @param {string} kernel @param {Data[]} attempts @param {ReturnType<typeof createOwner>} owner @param {typeof fetch} [originalFetch] @param {(index:number,bytes:Buffer)=>Promise<Data>} [commit] */
export async function primarySources(kernel,attempts,owner,originalFetch=fetch,commit){
 const tag=exactTag(kernel);
/** @type {Data[]} */const result=[];
 for(const [index,item] of audited.entries()){
  const url='https://raw.githubusercontent.com/apple-oss-distributions/xnu/'+tag+'/'+item.path;if(Buffer.byteLength(url)>4096||attempts.length!==index||attempts.length>=2)throw Error('Original primary URL/attempt capacity');
  /** @type {Data} */const attempt={index,requestedUrl:url,tag,fetchCallAttempted:false,fetchSettled:false,responsePresent:false,status:null,ok:null,bodyDisposition:'not-attempted',lockReleased:false,observedBytes:0,retainedBytes:0,originalFailurePresent:false,cleanupErrors:[],sourceFact:null};attempts.push(attempt);
  /** @type {Response|null} */let response=null;
/** @type {ReadableStreamDefaultReader<Uint8Array>|undefined} */let reader;
/** @type {Uint8Array[]} */const chunks=[];let present=false;
/** @type {unknown} */let primary;
/** @type {unknown[]} */const cleanup=[];
  try{
   response=/** @type {Response} */(await owner.run(()=>{attempt.fetchCallAttempted=true;try{return Promise.resolve(Reflect.apply(originalFetch,globalThis,[url,{redirect:'error'}])).then(value=>{response=value;attempt.fetchSettled=true;attempt.responsePresent=true;attempt.status=value.status;attempt.ok=value.ok;return value;},error=>{attempt.fetchSettled=true;throw error;});}catch(error){attempt.fetchSettled=true;throw error;}}));
   assert.ok(response.ok,'Original matching primary HTTP status unavailable');reader=response.body?.getReader();if(!reader)throw Error('Original primary source body unavailable');const originalReader=reader;
   for(;;){const part=/** @type {ReadableStreamReadResult<Uint8Array>} */(await owner.run(()=>originalReader.read()));if(part.done)break;attempt.observedBytes+=part.value.length;if(attempt.observedBytes>262144)throw Error('Primary source bytes262144');if(part.value.length)chunks.push(Buffer.from(part.value));attempt.retainedBytes+=part.value.length;}
   attempt.bodyDisposition='read-eof';
  }catch(error){present=true;primary=error;attempt.originalFailurePresent=true;attempt.originalFailure=diagnostic(error);}
  finally{
   if(response&&!response.body)attempt.bodyDisposition='absent';
   else if(response&&attempt.bodyDisposition!=='read-eof'){
    const originalResponse=response;try{await owner.cleanup(()=>reader?reader.cancel():originalResponse.body?.cancel());attempt.bodyDisposition='cancelled';}catch(error){attempt.bodyDisposition='unknown';cleanup.push(error);}
   }
   if(reader)try{reader.releaseLock();attempt.lockReleased=true;}catch(error){cleanup.push(error);}attempt.cleanupErrors=cleanup.map(diagnostic);
  }
  if(present||cleanup.length)throw failure(present,primary,cleanup);
  try{const bytes=Buffer.concat(chunks),decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes),start=decoded.indexOf('\n'+item.signature+'\n')+1;if(start<=0)throw Error('Original audited function missing');const end=decoded.indexOf('\n}\n',start)+3;if(end<=start)throw Error('Original audited function boundary missing');const digest=createHash('sha256').update(decoded.slice(start,end)).digest('hex');assert.equal(digest,item.digest,'Exact matching source function mismatch');
   const f={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),auditedFunctionSha256:digest};attempt.sourceFact=commit?{...f,...await owner.run(()=>commit(index,bytes))}:f;result.push(attempt.sourceFact);
  }catch(error){attempt.originalFailurePresent=true;attempt.originalFailure=diagnostic(error);throw error;}
 }
 return result;
}
/** @param {Data} s */function epoch(s){return {dev:String(s.dev),ino:String(s.ino),bytes:Number(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),nlink:Number(s.nlink)};}
/** @param {string} path @param {typeof fs} ports */
async function parents(path,ports){const list=[];let current=dirname(resolve(path));for(;;){const s=await ports.lstat(current,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink())throw Error('Original ancestor kind/link unavailable');list.push({path:current,dev:String(s.dev),ino:String(s.ino)});if(current===parse(current).root)break;current=dirname(current);}return list;}
/** @param {Data[]} rows @param {typeof fs} ports */async function verifyParents(rows,ports){for(const row of rows){const s=await ports.lstat(row.path,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==row.dev||String(s.ino)!==row.ino)throw Error('Original ancestor identity changed');}}
/** Epoch checks add no descriptor/hash/close cycle. @param {Data} row @param {Data} observed */
function verifyEpoch(row,observed){const {path,sha256,name,...original}=row;if(!observed.isFile()||observed.isSymbolicLink()||observed.nlink!==1n)throw Error('Original file kind/link changed');assert.deepEqual(epoch(observed),original);}
/** @param {Data} row @param {typeof fs} ports */async function verifyFileEpoch(row,ports){verifyEpoch(row,await ports.lstat(row.path,{bigint:true}));}
/** Bounded final synchronous observations happen after timer teardown, without new asynchronous work.
 * @param {Data[]} rows @param {typeof lstatSync} originalStat @param {unknown} receiver */
function verifyParentsSync(rows,originalStat,receiver){for(const row of rows){const s=Reflect.apply(originalStat,receiver,[row.path,{bigint:true}]);if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==row.dev||String(s.ino)!==row.ino)throw Error('Original ancestor identity changed');}}
/** @param {string} path @param {number} limit @param {typeof fs} [ports] */
export async function fileFact(path,limit,ports=fs){const chain=await parents(path,ports),before=await ports.lstat(path,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(limit))throw Error('Bounded singly-owned regular original file required');const initial=epoch(before),h=await ports.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let present=false;
/** @type {unknown} */let primary;
/** @type {unknown[]} */const cleanup=[];let result;
 try{const fd=await h.stat({bigint:true});assert.ok(fd.isFile());assert.deepEqual(epoch(fd),initial);const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let count=0;for(;;){const {bytesRead}=await h.read(buffer,0,Math.min(buffer.length,limit-count+1),null);if(!bytesRead)break;count+=bytesRead;if(count>initial.bytes||count>limit)throw Error('Original file size changed');hash.update(buffer.subarray(0,bytesRead));}assert.equal(count,initial.bytes);assert.deepEqual(epoch(await h.stat({bigint:true})),initial);const after=await ports.lstat(path,{bigint:true});assert.ok(after.isFile()&&!after.isSymbolicLink());assert.deepEqual(epoch(after),initial);await verifyParents(chain,ports);result={path,...initial,sha256:hash.digest('hex')};}catch(error){present=true;primary=error;}finally{try{await h.close();}catch(error){cleanup.push(error);}}
 try{const final=await ports.lstat(path,{bigint:true});assert.ok(final.isFile()&&!final.isSymbolicLink());assert.deepEqual(epoch(final),initial);await verifyParents(chain,ports);}catch(error){cleanup.push(error);}if(present||cleanup.length)throw failure(present,primary,cleanup);if(!result)throw Error('Original file fact unavailable');return result;
}
/** @param {string} path @param {typeof fs} [ports] */
export async function createOutput(path,ports=fs){const chain=await parents(path,ports);await ports.mkdir(path);const s=await ports.lstat(path,{bigint:true});assert.ok(s.isDirectory()&&!s.isSymbolicLink());return {path,created:{dev:String(s.dev),ino:String(s.ino)},chain,closedEpoch:/** @type {Data|undefined} */(undefined),files:/** @type {Data[]} */([])};}
/** @param {ReturnType<typeof createOutput> extends Promise<infer T>?T:never} output @param {typeof fs} ports */
async function ownedDir(output,ports){await verifyParents(output.chain,ports);const s=await ports.lstat(output.path,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==output.created.dev||String(s.ino)!==output.created.ino)throw Error('Exclusive created output directory identity changed');return epoch(s);}
/** @param {Awaited<ReturnType<typeof createOutput>>} output @param {string} name @param {Buffer} bytes @param {typeof fs} [ports] */
export async function publish(output,name,bytes,ports=fs){if(!members.includes(name)||output.files.length>=3||output.files.some(x=>x.name===name)||bytes.length>(name==='receipt.json'?65536:262144))throw Error('Closed output member/byte capacity');await ownedDir(output,ports);const path=join(output.path,name),h=await ports.open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let present=false;
/** @type {unknown} */let primary;
/** @type {unknown[]} */const cleanup=[];let published;
 try{const first=await h.stat({bigint:true});assert.ok(first.isFile()&&first.nlink===1n);assert.equal(first.size,0n,'Original exclusive-created publication descriptor is not empty');let count=0;while(count<bytes.length){const part=await h.write(bytes,count,bytes.length-count,count);if(!Number.isSafeInteger(part.bytesWritten)||part.bytesWritten<=0||part.bytesWritten>bytes.length-count)throw Error('Original publication short-write unavailable');count+=part.bytesWritten;}const last=await h.stat({bigint:true});assert.ok(last.isFile()&&last.nlink===1n);assert.equal(last.dev,first.dev);assert.equal(last.ino,first.ino);assert.equal(last.size,BigInt(bytes.length));published=epoch(last);const observed=await ports.lstat(path,{bigint:true});assert.ok(observed.isFile()&&!observed.isSymbolicLink());assert.deepEqual(epoch(observed),published);await ownedDir(output,ports);}catch(error){present=true;primary=error;}finally{try{await h.close();}catch(error){cleanup.push(error);}}
 if(present||cleanup.length)throw failure(present,primary,cleanup);assert.ok(published);const fact=await fileFact(path,name==='receipt.json'?65536:262144,ports);const {sha256,path:originalPath,...actualEpoch}=fact;assert.deepEqual(actualEpoch,published);assert.equal(sha256,createHash('sha256').update(bytes).digest('hex'));await ownedDir(output,ports);const row={name,...fact};output.files.push(row);return row;
}
/** @param {string} path @param {typeof fs} ports */async function names(path,ports){const handle=await ports.opendir(path);let present=false;
/** @type {unknown} */let primary;
/** @type {unknown[]} */const cleanup=[];
/** @type {string[]} */const list=[];try{for(;;){const next=await handle.read();if(!next)break;if(list.length>=3)throw Error('Owned output members3');if(!next.isFile()||!members.includes(next.name))throw Error('Unknown owned output member');list.push(next.name);}}catch(error){present=true;primary=error;}finally{try{await handle.close();}catch(error){cleanup.push(error);}}if(present||cleanup.length)throw failure(present,primary,cleanup);return list.sort();}
/** @param {Awaited<ReturnType<typeof createOutput>>} output @param {typeof fs} [ports] */
export async function closeOutput(output,ports=fs){const before=await ownedDir(output,ports),expected=output.files.map(x=>x.name).sort();assert.deepEqual(await names(output.path,ports),expected);for(const row of output.files){const {name,...f}=row;assert.deepEqual(await fileFact(f.path,name==='receipt.json'?65536:262144,ports),f);}assert.deepEqual(await names(output.path,ports),expected);assert.deepEqual(await ownedDir(output,ports),before);for(const row of output.files)await verifyFileEpoch(row,ports);output.closedEpoch=before;return [...output.files];}
/** @param {Data} row @param {number} [limit] */
export function serialize(row,limit=65536){if(limit!==65536&&limit!==4096)throw Error('Fixed receipt/witness capacity');const arrays=/** @type {Array<[string,number]>} */([['commands',5],['attempts',2],['before',4],['after',4],['outputMembers',3],['errors',16]]);for(const [key,max] of arrays){const value=row[key];if(value!==undefined&&(!Array.isArray(value)||value.length>Number(max)))throw Error('Closed receipt cardinality '+key);}let scalarUnits=0;
/** @param {unknown} value */
function bound(value){if(typeof value==='string'){scalarUnits+=value.length;if(scalarUnits>limit)throw Error('Receipt scalar capacity');}else if(Array.isArray(value)){for(const x of value)bound(x);}else if(value&&typeof value==='object'){for(const [key,x] of Object.entries(value)){scalarUnits+=key.length;if(scalarUnits>limit)throw Error('Receipt scalar capacity');bound(x);}}}bound(row);const value=JSON.stringify(row)+'\n';if(Buffer.byteLength(value)>limit)throw Error('Compact receipt/witness byte capacity');return value;}
/** Delegate exactly one original public stream write; backpressure return is not callback settlement.
 * @param {(...args:any[])=>unknown} originalWrite @param {unknown} receiver @param {string} value */
export function originalWrite(originalWrite,receiver,value){return new Promise((done,reject)=>{Reflect.apply(originalWrite,receiver,[value,/** @param {unknown} error */error=>error===null||error===undefined?done(null):reject(error)]);});}
/** Built-in-only orchestration; ports expose original operations solely for ordinary conformance controls.
 * @param {Data} [ports] */
export async function runProbe(ports={}){
 const env=ports.env??process.env,runtime=ports.runtime??{platform:process.platform,arch:process.arch,version:process.version,v8:process.versions.v8,execPath:process.execPath};const admission=admit(env,runtime),root=resolve(ports.root??process.cwd()),io=ports.fs??fs,owner=createOwner(ports.clock);
/** @type {Data[]} */const commands=[];
/** @type {Data[]} */const attempts=[];
/** @type {unknown[]} */const causes=[];let omittedCauses=0;
/** @type {Data|undefined} */let result;
let escapedPresent=false;
/** @type {unknown[]} */let timerErrors=[];
/** @type {(()=>void)|undefined} */let finalEpochCheck;
 const retainCause=/** @param {unknown} value */value=>{if(causes.length<16)causes.push(value);else omittedCauses++;};
 try{
 let sourceClosed=false,outputClosed=false,observed=null;
/** @type {Awaited<ReturnType<typeof createOutput>>|undefined} */let output;
/** @type {Data|null} */let receiptFact=null;
/** Original private chains remain tied to the four before facts; public fact shapes are unchanged.
 * @type {Array<{fact:Data,chain:Data[]}>} */const selectedEpochs=[];
 async function checkSelectedEpochs(){if(selectedEpochs.length!==selected.length)throw Error('Original selected source epoch inventory unavailable');for(const row of selectedEpochs){await verifyParents(row.chain,io);await verifyFileEpoch(row.fact,io);}}
 async function checkOutputEpochs(){if(!output||!output.closedEpoch)throw Error('Exclusive original output closure epoch unavailable');assert.deepEqual(await ownedDir(output,io),output.closedEpoch);for(const row of output.files)await verifyFileEpoch(row,io);}
 finalEpochCheck=()=>{
  const originalStat=ports.lstatSync??lstatSync,receiver=ports.lstatSyncReceiver;
  /** Every original synchronous metadata dispatch still observes the fixed report admission endpoint.
   * @param {any[]} args */
  const checkedStat=(...args)=>{if(owner.remaining()<=0)throw Error('Original cleanup/report deadline admission expired');return Reflect.apply(originalStat,receiver,args);};
  try{if(sourceClosed){
   if(selectedEpochs.length!==selected.length)throw Error('Original selected source epoch inventory unavailable');
   for(const row of selectedEpochs){verifyParentsSync(row.chain,checkedStat,undefined);verifyEpoch(row.fact,checkedStat(row.fact.path,{bigint:true}));}
  }}catch(error){sourceClosed=false;retainCause(error);}
  try{if(outputClosed){
   if(!output||!output.closedEpoch)throw Error('Exclusive original output closure epoch unavailable');
   verifyParentsSync(output.chain,checkedStat,undefined);const s=checkedStat(output.path,{bigint:true});
   if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==output.created.dev||String(s.ino)!==output.created.ino)throw Error('Exclusive created output directory identity changed');
   assert.deepEqual(epoch(s),output.closedEpoch);for(const row of output.files)verifyEpoch(row,checkedStat(row.path,{bigint:true}));
  }}catch(error){outputClosed=false;retainCause(error);}
  if(result){
   result.witness.selectedSourceClosed=sourceClosed;result.witness.outputClosed=outputClosed;
   if(!sourceClosed||!outputClosed){result.exitCode=1;result.originalFailurePresent=causes.length>0||omittedCauses>0;result.witness.status='source-unavailable';result.witness.publicOperationStatus='unknown';result.witness.observationStatus='revoked-after-original-terminal';}
  }
 };
 /** @type {Data} */const receipt={format:'macos-source-availability-v1',status:'source-unavailable',publicationStatus:'pending-external-authentication',admission,acquisitionMs:60000,cleanupReportMs:10000,capabilityStatus:'not-attempted',sdkAttempted:false,browserAttempted:false,caseSpawnAttempted:false,processQueryAttempted:false,canonicalMatrix:false,scoringEligibility:false,overallResourceClosure:'unknown',oldLocalClosure:'UNKNOWN',commands,attempts,before:[],after:[],sourceFacts:[],errors:[],omittedErrors:0};
 try{
  const temp=await owner.run(()=>io.realpath(env.RUNNER_TEMP??''));output=await owner.run(()=>createOutput(join(/** @type {string} */(temp),'macos-source-availability-'+admission.runId+'-'+admission.runAttempt),io));
  for(const name of selected){const path=join(root,name),chain=await owner.run(()=>parents(path,io)),fact=await owner.run(()=>fileFact(path,262144,io));await owner.run(()=>verifyParents(chain,io));receipt.before.push(fact);selectedEpochs.push({fact,chain});}
  /** @type {Array<[string,string[]]>} */
  const specs=[['git',['rev-parse','HEAD']],['/usr/bin/uname',['-v']],['/usr/bin/uname',['-r']],['/usr/bin/uname',['-m']],['/usr/bin/sw_vers',[]]];
  for(const [file,args] of specs)await originalCommand(/** @type {string} */(file),/** @type {string[]} */(args),root,commands,owner,ports.spawn??childProcess.spawn,ports.spawnReceiver??childProcess);
  observed=metadata(commands.map(x=>x.stdout),admission.sha);receipt.observed=observed;
  assert.ok(output);const originalOutput=output;receipt.sourceFacts=await primarySources(observed.kernel??'',attempts,owner,ports.fetch??fetch,(index,bytes)=>publish(originalOutput,'primary-'+index+'.c',bytes,io));
 }catch(error){retainCause(error);}
 try{for(const name of selected)receipt.after.push(await owner.cleanup(()=>fileFact(join(root,name),262144,io)));assert.deepEqual(receipt.after,receipt.before);sourceClosed=true;}catch(error){retainCause(error);}
 const provisional=causes.length===0&&omittedCauses===0&&sourceClosed&&attempts.length===2&&commands.length===5&&owner.pending.size===0&&!owner.expired();receipt.status=provisional?'source-available':'source-unavailable';receipt.selectedSourceClosed=sourceClosed;receipt.pendingOperations=owner.pending.size;receipt.expired=owner.expired();receipt.errors=causes.map(diagnostic);receipt.omittedErrors=omittedCauses;receipt.publicOperationStatus='unknown';
 let finalStatus='source-unavailable',terminalPresent=false;
 try{if(!output)throw Error('Exclusive original output unavailable');receiptFact=await owner.cleanup(()=>publish(output,'receipt.json',Buffer.from(serialize(receipt)),io));const finalSources=[];for(const name of selected)finalSources.push(await owner.cleanup(()=>fileFact(join(root,name),262144,io)));assert.deepEqual(finalSources,receipt.before);sourceClosed=true;}catch(error){sourceClosed=false;retainCause(error);}
 if(receiptFact&&sourceClosed){try{assert.ok(output);await owner.cleanup(()=>closeOutput(output,io));outputClosed=true;}catch(error){retainCause(error);}try{await owner.cleanup(checkSelectedEpochs);}catch(error){sourceClosed=false;retainCause(error);}if(provisional&&sourceClosed&&outputClosed&&owner.pending.size===0&&!owner.expired())finalStatus='source-available';}
 const settled=sourceClosed&&outputClosed&&owner.pending.size===0&&commands.length>0&&commands.every(x=>x.exited&&x.closed)&&attempts.every(x=>x.fetchSettled&&x.cleanupErrors.length===0&&((!x.responsePresent&&x.originalFailurePresent)||(x.responsePresent&&['read-eof','cancelled','absent'].includes(x.bodyDisposition))))&&owner.taskRejections.length===0;
 /** @type {Data} */const witness={format:'macos-source-availability-terminal-v1',status:finalStatus,publicationStatus:'pending-external-authentication',publicOperationStatus:settled?'settled-observed':'unknown',overallResourceClosure:'unknown',capabilityStatus:'not-attempted',scoringEligibility:false,selectedSourceClosed:sourceClosed,outputClosed,pendingOperations:owner.pending.size,expired:owner.expired(),receiptFact,outputMembers:output?.files??[],errors:causes.map(diagnostic),omittedErrors:omittedCauses,taskRejections:owner.taskRejections.map(diagnostic),omittedTaskRejections:owner.omittedErrors()};
 try{const value='MACOS_SOURCE_AVAILABILITY_TERMINAL '+serialize(witness,4096);if(Buffer.byteLength(value)>4096)throw Error('Terminal witness bytes4096');await owner.cleanup(()=>ports.terminal?ports.terminal(value):originalWrite(process.stdout.write,process.stdout,value));terminalPresent=true;if(finalStatus==='source-available'){try{await owner.cleanup(checkSelectedEpochs);}catch(error){sourceClosed=false;retainCause(error);}try{await owner.cleanup(checkOutputEpochs);}catch(error){outputClosed=false;retainCause(error);}witness.selectedSourceClosed=sourceClosed;witness.outputClosed=outputClosed;if(!sourceClosed||!outputClosed){finalStatus='source-unavailable';witness.status='source-unavailable';witness.observationStatus='revoked-after-original-terminal';}}if(owner.expired()||owner.pending.size!==0){finalStatus='source-unavailable';witness.status='source-unavailable';witness.expired=owner.expired();witness.pendingOperations=owner.pending.size;witness.observationStatus='revoked-after-original-terminal';}}catch(error){retainCause(error);finalStatus='source-unavailable';witness.status='source-unavailable';witness.observationStatus='terminal-write-unavailable';}
 if(!terminalPresent&&owner.remaining()>0){try{const value='MACOS_SOURCE_AVAILABILITY_DURABILITY_UNAVAILABLE '+JSON.stringify(diagnostic(causes.at(-1)))+'\n';if(Buffer.byteLength(value)>4096)throw Error('Durability diagnostic bytes4096');await owner.cleanup(()=>ports.durability?ports.durability(value):ports.terminal?undefined:originalWrite(process.stderr.write,process.stderr,value));}catch(error){retainCause(error);}}
 result={receipt,witness,exitCode:finalStatus==='source-available'&&terminalPresent?0:1,originalErrors:causes,originalFailurePresent:causes.length>0||omittedCauses>0};
 }catch(error){escapedPresent=true;retainCause(error);}finally{timerErrors=owner.stop();for(const error of timerErrors)retainCause(error);if(result&&timerErrors.length){result.exitCode=1;result.originalFailurePresent=true;result.witness.status='source-unavailable';result.witness.timerCleanupErrors=timerErrors.map(diagnostic);result.witness.observationStatus='revoked-after-original-terminal';}}
 if(escapedPresent)throw failure(true,causes[0],causes.slice(1));if(!result)throw failure(false,undefined,timerErrors);finalEpochCheck?.();
 // One final returned ledger follows all owned settlement, teardown and metadata observations.
 // The previously printed terminal witness remains provisional and is never replaced or reprinted.
 /** @type {boolean|null} */let expired=null;let deadlineAvailable=false;
 try{expired=owner.expired();deadlineAvailable=true;}catch(error){retainCause(error);}
 const pending=owner.pending.size;result.witness.expired=expired;result.witness.pendingOperations=pending;
 result.witness.finalDeadlineObservation=deadlineAvailable?'available':'unavailable';
 if(!deadlineAvailable||pending!==0)result.witness.publicOperationStatus='unknown';
 if(!deadlineAvailable||expired||pending!==0){result.exitCode=1;result.witness.status='source-unavailable';result.witness.observationStatus='revoked-after-original-terminal';}
 result.originalFailurePresent=causes.length>0||omittedCauses>0;
 result.witness.errors=causes.map(diagnostic);result.witness.omittedErrors=omittedCauses;
 result.witness.taskRejections=owner.taskRejections.map(diagnostic);result.witness.omittedTaskRejections=owner.omittedErrors();
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await runProbe();process.exitCode=result.exitCode;}catch(error){process.exitCode=1;process.stderr.write('MACOS_SOURCE_AVAILABILITY_DURABILITY_UNAVAILABLE '+JSON.stringify(diagnostic(error))+'\n');}
}
