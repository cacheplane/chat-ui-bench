import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {readFile,writeFile,mkdir,lstat,realpath,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createServer,get} from 'node:http';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostname,release,totalmem} from 'node:os';
import {installObserver} from './spawn-observer.mjs';
import {admitRuntime,validIdentity,sameIdentity,exclusiveCase,displaySupported,scopedEmpty,supported,serialize,diagnostic,combineFailure,ownedGroup,ipcLatch,capabilityBudget,scopedClosure,caseNotAttempted,classifyCapabilityReceipt} from './receipt.mjs';
/** @typedef {Record<string, any>} Data */
const admission=admitRuntime(process.env,process.platform,process.arch);
assert.equal(process.version,'v24.20.0','Actual capability Node runtime must match selected exact version');
const originalSpawn=childProcess.spawn;
const root=process.cwd(),source=fileURLToPath(import.meta.url),directory=fileURLToPath(new URL('.',import.meta.url));
/** @type {Set<Promise<unknown>>} */const pending=new Set();
/** @type {Data[]} */const commands=[];
/** @type {Data[]} */const queries=[];
/** @type {unknown[]} */const lateErrors=[];
let deadline=performance.now()+600000,expired=false;
let queriesAllowed=()=>true;
/** @param {()=>unknown|Promise<unknown>} body @param {number} until */
// BEGIN ownedDeadline
async function owned(body,until=deadline) {
 if(performance.now()>=until)throw Error('Original capability admission expired');
 const task=Promise.resolve().then(()=>{if(performance.now()>=until)throw Error('Original action expired before dispatch');return body();});
 pending.add(task);void task.then(()=>pending.delete(task),error=>{pending.delete(task);if(lateErrors.length<32)lateErrors.push(error);});
 let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Original capability deadline expired; operation remains owned'));},Math.max(0,until-performance.now()));})]);}finally{clearTimeout(timer);}
}
// END ownedDeadline
// BEGIN retainCommandBytes
/** @param {Data} row @param {'stdout'|'stderr'} stream @param {Buffer} bytes @param {number} [maximum] */
function retainCommandBytes(row,stream,bytes,maximum=65536) {
 row[stream+'Bytes']+=bytes.length;
 const kept=Buffer.from(row[stream+'PrefixBase64'],'base64'),remaining=maximum-kept.length;
 const prefix=Buffer.concat([kept,bytes.subarray(0,Math.max(0,remaining))]);
 row[stream+'PrefixBase64']=prefix.toString('base64');row[stream+'PrefixBytes']=prefix.length;
 row[stream+'OmittedBytes']=row[stream+'Bytes']-prefix.length;
 if(row[stream+'Bytes']>65536)row.overflow=true;
}
// END retainCommandBytes
/** @param {string} file @param {string[]} args @param {Data} [options] @param {boolean} [retain] @param {Data} [record] @returns {Promise<Data>} */
// BEGIN originalCommand
async function command(file,args,options={},retain=true,record) {
 if(retain&&commands.length>=32)throw Error('Original preparation command capacity32');
 /** @type {Data} */const row=record??{};Object.assign(row,{file,args,exited:false,closed:false,code:null,signal:null,stdoutBytes:0,stderrBytes:0,stdoutPrefixBase64:'',stderrPrefixBase64:'',stdoutPrefixBytes:0,stderrPrefixBytes:0,stdoutOmittedBytes:0,stderrOmittedBytes:0,prefixEncoding:'base64-original-bytes',decodingStatus:'not-attempted',overflow:false,originalErrors:[]});if(retain)commands.push(row);
 return /** @type {Promise<Data>} */(owned(async()=> {
  const child=originalSpawn(file,args,{...options,stdio:['ignore','pipe','pipe']});row.pid=child.pid;
  child.stdout?.on('data',b=>retainCommandBytes(row,'stdout',b));
  child.stderr?.on('data',b=>retainCommandBytes(row,'stderr',b));
  child.once('error',error=>row.originalErrors.push(diagnostic(error)));
  child.once('exit',(code,signal)=>{row.exited=true;row.code=code;row.signal=signal;});
  await new Promise(r=>child.once('close',(code,signal)=>{row.closed=true;row.code=code;row.signal=signal;r(null);}));
  if(!row.overflow){try{row.stdout=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(row.stdoutPrefixBase64,'base64'));row.stderr=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(row.stderrPrefixBase64,'base64'));row.decodingStatus='complete-valid-utf8';}catch(error){row.decodingStatus='invalid-utf8';throw error;}}else row.decodingStatus='not-admitted-overflow';
  if(row.overflow||row.originalErrors.length||!row.exited||row.code!==0||row.signal!==null)throw Error('Original command lifecycle/bytes unavailable: '+file);
  return row;
 }));
}
// END originalCommand
/** @param {string} path @returns {Promise<Data>} */
async function fact(path) {
 const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size>536870912)throw Error('Expected bounded regular original file: '+path);
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let present=false;/** @type {unknown} */let primary;/** @type {unknown[]} */const cleanup=[];let result;
 try {
  const fd=await handle.stat();for(const k of ['dev','ino','size','mtimeMs','ctimeMs'])assert.equal(/** @type {Data} */(fd)[k],/** @type {Data} */(before)[k]);
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let count=0;
  for(;;){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;count+=bytesRead;if(count>before.size)throw Error('Original file grew during read');hash.update(buffer.subarray(0,bytesRead));}
  assert.equal(count,before.size);const after=await lstat(path),final=await handle.stat();
  for(const k of ['dev','ino','size','mtimeMs','ctimeMs']){assert.equal(/** @type {Data} */(after)[k],/** @type {Data} */(before)[k]);assert.equal(/** @type {Data} */(final)[k],/** @type {Data} */(before)[k]);}
  result={path,byteLength:after.size,sha256:hash.digest('hex'),dev:after.dev,ino:after.ino,mtimeMs:after.mtimeMs,ctimeMs:after.ctimeMs};
 }catch(error){present=true;primary=error;}finally{try{await handle.close();}catch(error){cleanup.push(error);}}
 if(present||cleanup.length)throw combineFailure(present,primary,cleanup);if(!result)throw Error('Original file fact unavailable');return result;
}

/** @param {Data} f */async function verify(f){const actual=await fact(f.path);assert.deepEqual(actual,f);}
/** @param {string} path */async function trackedFacts(path) {
 const list=await command('git',['ls-files','-z'],{cwd:path});const names=list.stdout.split('\0').filter(Boolean);
 if(names.length>4096)throw Error('Tracked source capacity4096');const facts=[];
 for(const name of names){if(relative(path,resolve(path,name)).startsWith('..'))throw Error('Tracked path outside root');facts.push(await owned(()=>fact(join(path,name))));}
 return facts;
}
/** @param {Data} binding @param {string} kind @param {number} pid @returns {Promise<Data>} */
async function query(binding,kind,pid) {
 if(!queriesAllowed()||!['pid','group','display'].includes(kind)||!Number.isSafeInteger(pid)||pid<=0||queries.length>=256)throw Error('Original scoped query admission');
 /** @type {Data} */const record={kind,pid,status:'pending',command:{},actualResultPresent:false,originalErrorPresent:false};queries.push(record);
 try {
  await owned(()=>verify(binding.helper));await owned(()=>verify(binding.source));
  if(!queriesAllowed())throw Error('Original query dispatch revoked');
  const original=await command(binding.helper.path,[kind,String(pid)],{},false,record.command);const envelope=JSON.parse(original.stdout);
  record.helperIdentity=envelope.helper;
  if(Object.hasOwn(envelope,'result')){record.actualResultPresent=true;record.actualResult=envelope.result;}
  if(!validIdentity(envelope.helper)||envelope.helper.pid!==original.pid||envelope.helper.ppid!==process.pid)throw Error('Original SDK helper identity unavailable');
  await owned(()=>verify(binding.helper));await owned(()=>verify(binding.source));record.status='recorded';return envelope.result;
 }catch(error){record.status='unknown';record.originalErrorPresent=true;record.originalError=diagnostic(error);throw error;}
}

const audited=[
 {path:'libsyscall/wrappers/libproc/libproc.c',signature:'proc_listpids(uint32_t type, uint32_t typeinfo, void *buffer, int buffersize)',digest:'7d1f676bdbeca470322d72ad5d1f0257b0efab3d6e2713c89deecce9a1fa98bc'},
 {path:'bsd/kern/proc_info.c',signature:'proc_listpids(uint32_t type, uint32_t typeinfo, user_addr_t buffer, uint32_t  buffersize, int32_t * retval)',digest:'30221118bb08c367545c9eee30ac100676ea8d94ba3264e38c379087809d0657'}
];
/** @param {string} kernel @param {string} out @param {Data[]} attempts */async function primarySources(kernel,out,attempts) {
 const match=/xnu-(\d+(?:\.\d+)+)~/.exec(kernel);if(!match)throw Error('Matching primary kernel tag unavailable');
 const rows=[];
 for(const [index,item] of audited.entries()) {
  const url='https://raw.githubusercontent.com/apple-oss-distributions/xnu/xnu-'+match[1]+'/'+item.path;
  if(Buffer.byteLength(url)>4096)throw Error('Original primary source URL capacity4096');
  assert.equal(attempts.length,index);assert.ok(attempts.length<2);
  /** @type {Data} */const attempt={index,requestedUrl:url,tag:'xnu-'+match[1],fetchCallAttempted:false,fetchSettled:false,responsePresent:false,status:null,ok:null,bodyDisposition:'not-attempted',originalFailurePresent:false,originalFailure:null,cleanupErrors:[],sourceFact:null};attempts.push(attempt);
  /** @type {Response|null} */let response=null;
  /** @type {ReadableStreamDefaultReader<Uint8Array>|undefined} */let reader;
  /** @type {Uint8Array[]} */const chunks=[];let bytes=0;
  let present=false;/** @type {unknown} */let primary;/** @type {unknown[]} */const cleanup=[];
  try {
   response=/** @type {Response} */(await owned(()=>{
    attempt.fetchCallAttempted=true;
    try{return Promise.resolve(fetch(url,{redirect:'error'})).then(value=>{response=value;attempt.fetchSettled=true;attempt.responsePresent=true;attempt.status=value.status;attempt.ok=value.ok;return value;},error=>{attempt.fetchSettled=true;throw error;});}catch(error){attempt.fetchSettled=true;throw error;}
   }));
   assert.ok(response.ok);reader=response.body?.getReader();if(!reader)throw Error('Original primary source body unavailable');
   const originalReader=reader;
   for(;;){const part=/** @type {ReadableStreamReadResult<Uint8Array>} */(await owned(()=>originalReader.read()));if(part.done)break;bytes+=part.value.length;if(bytes>262144)throw Error('Primary source bytes262144');chunks.push(part.value);}
   attempt.bodyDisposition='read-eof';
  }catch(error){present=true;primary=error;attempt.originalFailurePresent=true;attempt.originalFailure=diagnostic(error);}
  finally {
   if(response&&!response.body)attempt.bodyDisposition='absent';
   else if(response&&attempt.bodyDisposition!=='read-eof') {
    const originalResponse=response;
    try{await owned(()=>reader?reader.cancel():originalResponse.body?.cancel());attempt.bodyDisposition='cancelled';}catch(error){attempt.bodyDisposition='unknown';cleanup.push(error);}
   }
   if(reader){try{reader.releaseLock();}catch(error){cleanup.push(error);}}
   attempt.cleanupErrors=cleanup.map(diagnostic);
  }
  if(present||cleanup.length)throw combineFailure(present,primary,cleanup);
  try {
   const original=Buffer.concat(chunks),text=new TextDecoder('utf-8',{fatal:true}).decode(original);
   const start=text.indexOf('\n'+item.signature+'\n')+1;if(start<=0)throw Error('Original audited API function missing');
   const end=text.indexOf('\n}\n',start)+3;if(end<=start)throw Error('Original audited API boundary unavailable');
   const digest=createHash('sha256').update(text.slice(start,end)).digest('hex');assert.equal(digest,item.digest,'Matching kernel scoped enumeration semantics changed');
   const path=join(out,'primary-'+index+'.c');await owned(()=>writeFile(path,original,{flag:'wx'}));const sourceFact={url,tag:'xnu-'+match[1],auditedFunctionSha256:digest,...await fact(path)};attempt.sourceFact=sourceFact;rows.push(sourceFact);
  }catch(error){attempt.originalFailurePresent=true;attempt.originalFailure=diagnostic(error);throw error;}
 }
 return rows;
}
// BEGIN originalLoopbackRequest
/** @param {typeof get} originalGet @param {unknown} receiver @param {string} origin @param {(resource:Data)=>void} register */
function originalLoopbackRequest(originalGet,receiver,origin,register) {
 /** @type {(value:null)=>void} */let done;
 /** @type {(error:unknown)=>void} */let reject;
 /** @type {import('node:http').ClientRequest} */let request;
 let closed=false,ended=false;
 const completion=new Promise((resolve,fail)=>{done=resolve;reject=fail;});
 const actualClose=new Promise(resolve=>{
  request=Reflect.apply(originalGet,receiver,[origin+'/',{agent:false},(/** @type {import('node:http').IncomingMessage} */response)=>{
   let bytes=0;response.on('data',(/** @type {Buffer} */b)=>{bytes+=b.length;if(bytes>4096)request.destroy(Error('Loopback bytes4096'));});
   response.once('error',reject);response.once('end',()=>{ended=true;response.statusCode===200?done(null):reject(Error('Original loopback status'));});
  }]);
  request.once('error',reject);request.once('close',()=>{closed=true;if(!ended)reject(Error('Original loopback closed before EOF'));resolve(null);});
 });
 register({role:'loopback-request',closed:false,close:()=>{if(!closed)request.destroy();return actualClose;}});
 return completion;
}
// END originalLoopbackRequest
/** @param {Data} binding @param {string} nonce */async function capabilityChild(binding,nonce) {
 assert.ok(process.send&&process.connected&&/^[-a-f0-9]{36}$/.test(nonce),'Original parent IPC required');
 const budget=capabilityBudget(performance.now());deadline=budget.acquisition;let cleanupDeadline=budget.closureReport;
 const observer=installObserver((kind,pid)=>query(binding,kind,pid));
 /** @type {Data[]} */const resources=[];
 /** @type {unknown[]} */const cleanup=[];
 let primaryPresent=false;/** @type {unknown} */let primary;
 let closing=false;let stopRequested=false;/** @type {Data|null} */let display=null,pageFacts=null;
 /** @param {Data} resource */function closeOne(resource) {
  if(resource.closeTask)return resource.closeTask;
  const task=Promise.resolve().then(resource.close);resource.closeTask=task;pending.add(task);
  void task.then(()=>{resource.closed=true;pending.delete(task);},error=>{pending.delete(task);if(cleanup.length<32)cleanup.push(error);});return task;
 }
 function startClose(){closing=true;for(const resource of resources)closeOne(resource);}
 queriesAllowed=()=>!closing&&!stopRequested&&!expired;
 /** @param {()=>unknown|Promise<unknown>} body */const act=body=>owned(()=>{if(closing||stopRequested||expired)throw Error('Original capability action revoked');return body();});
 /** @param {string} role @param {()=>Promise<any>} factory @param {(value:any)=>Promise<unknown>} close */
 async function acquire(role,factory,close) {
  if(closing||stopRequested||expired)throw Error('Original resource admission revoked');
  return owned(async()=>{if(closing||stopRequested||expired)throw Error('Original resource dispatch revoked');const value=await factory();const resource={role,closed:false,close:()=>close(value)};resources.push(resource);if(closing){closeOne(resource);throw Error('Late original capability resource; closure pending');}return value;});
 }
 process.on('message',message=>{if(/** @type {Data} */(message)?.type==='stop'&&/** @type {Data} */(message)?.nonce===nonce){stopRequested=true;startClose();}});
 /** @param {Data} message */const send=message=>owned(()=>new Promise((done,reject)=>process.send?.({...message,nonce},undefined,undefined,error=>error?reject(error):done(null))),cleanupDeadline);
 const admit=ipcLatch(process,nonce,'admit'),flushAck=ipcLatch(process,nonce,'flush-ack');
 await send({type:'ready',pid:process.pid});
 const admissionMessage=await owned(()=>admit.promise);admit.remove();
 assert.ok(Number.isFinite(admissionMessage.remainingMs)&&admissionMessage.remainingMs>0&&admissionMessage.remainingMs<=60000);
 deadline=Math.min(deadline,performance.now()+admissionMessage.remainingMs);
 cleanupDeadline=Math.min(cleanupDeadline,deadline+10000);
 try {
  display=await query(binding,'display',process.pid);assert.ok(displaySupported(display),'Actual Quartz/display unavailable');
  const server=await acquire('loopback',()=>new Promise((done,reject)=>{const s=createServer((request,response)=>{if(request.url!=='/')response.writeHead(404);response.end('<!doctype html><title>Capability</title><p>Blank headed capability</p>');});s.once('error',reject);s.listen(0,'127.0.0.1',()=>done(s));}),s=>new Promise((done,reject)=>s.close((/** @type {Error|undefined} */error)=>error?reject(error):done(null))));
  const address=server.address();assert.ok(address&&typeof address==='object');const origin='http://127.0.0.1:'+address.port;
  await act(()=>originalLoopbackRequest(get,undefined,origin,(/** @type {Data} */resource)=>{resources.push(resource);if(closing)closeOne(resource);}));
  const {chromium}=await import('playwright');
  const browsersMetadata=await owned(()=>fact(join(root,'node_modules/playwright-core/browsers.json')));assert.ok(browsersMetadata.byteLength<=16384,'Locked browser metadata capacity16384');
  const declared=JSON.parse(await owned(()=>readFile(browsersMetadata.path,'utf8')));await owned(()=>verify(browsersMetadata));
  assert.ok(Array.isArray(declared.browsers)&&declared.browsers.length<=16);const chromiumDeclarations=declared.browsers.filter((/** @type {Data} */row)=>row.name==='chromium');assert.equal(chromiumDeclarations.length,1);
  const lockedChromium=chromiumDeclarations[0];assert.ok(typeof lockedChromium.revision==='string'&&/^\d+$/.test(lockedChromium.revision)&&typeof lockedChromium.browserVersion==='string'&&lockedChromium.browserVersion.length<=128);
  const browserBinary=await owned(()=>fact(chromium.executablePath()));
  const browser=await acquire('browser',()=>chromium.launch({headless:false,timeout:Math.max(1,deadline-performance.now())}),value=>value.close());
  await owned(()=>observer.barrier());
  const context=await acquire('context',()=>browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'}),value=>value.close());
  /** @type {string[]} */const denied=[];
  await act(()=>context.route('**/*',async (/** @type {import('playwright').Route} */route)=>{if(new URL(route.request().url()).origin!==origin){denied.push(route.request().url().slice(0,8192));await route.abort('blockedbyclient');}else await route.continue();}));
  const page=await acquire('page',()=>context.newPage(),value=>value.close());
  await act(()=>page.goto(origin+'/',{waitUntil:'load',timeout:Math.max(1,deadline-performance.now())}));await act(()=>page.bringToFront());
  pageFacts=await act(()=>page.evaluate(async()=>({visibility:document.visibilityState,focused:document.hasFocus(),width:innerWidth,height:innerHeight,raf:[await new Promise(r=>requestAnimationFrame(r)),await new Promise(r=>requestAnimationFrame(r))]})));
  assert.equal(denied.length,0,'Unexpected blank-page egress');pageFacts={...pageFacts,browserVersion:browser.version(),browserBinary,lockedBrowserDeclaration:{revision:lockedChromium.revision,browserVersion:lockedChromium.browserVersion,metadata:browsersMetadata,actualRevisionQueried:false},headless:false,viewport:{width:1280,height:800}};
  await act(()=>send({type:'acquired'}));
 }catch(error){primaryPresent=true;primary=error;}
 finally {
  deadline=cleanupDeadline;
  startClose();await owned(()=>Promise.allSettled(resources.map(closeOne)),cleanupDeadline).catch(error=>cleanup.push(error));
  await owned(()=>observer.barrier(),cleanupDeadline).catch(error=>cleanup.push(error));
 }
 const snapshot=observer.snapshot();if(snapshot.poisoned||snapshot.omittedErrors){if(!primaryPresent)primary=Error('Original spawn observation unavailable');primaryPresent=true;}
 const report={type:'result',primaryPresent,primary:primaryPresent?diagnostic(primary):null,cleanupErrors:cleanup.map(diagnostic),pending:pending.size+snapshot.pending,stopRequested,expired,spawns:snapshot.rows,observerErrors:snapshot.originalErrors,display,page:pageFacts,queries,resources:resources.map(({role,closed})=>({role,closed}))};
 await send(report);await send({type:'flush',records:snapshot.rows.length});
 await owned(()=>flushAck.promise,cleanupDeadline);flushAck.remove();
 await owned(()=>new Promise(done=>{process.once('disconnect',done);process.disconnect();}),cleanupDeadline);
 if(primaryPresent||cleanup.length||expired||stopRequested||pending.size||snapshot.poisoned||resources.some(x=>!x.closed))process.exitCode=1;
}
async function parent() {
 const temp=await realpath(process.env.RUNNER_TEMP??'');const out=join(temp,'macos-capability-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
 await mkdir(out);const before=await trackedFacts(root);
 /** @type {Data} */const receipt={format:'macos-capability-v1',status:'unavailable',unscored:true,canonicalMatrix:false,onsetAlignment:false,oldLocalClosure:'UNKNOWN',caseSpawnAttempted:false,primarySourceAttempts:[],trackedSourceClosed:false,admission,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,hostname:hostname(),kernelRelease:release(),imageOS:process.env.ImageOS,imageVersion:process.env.ImageVersion,workflowRef:process.env.GITHUB_WORKFLOW_REF,workflowSha:process.env.GITHUB_WORKFLOW_SHA,memoryBytes:totalmem(),node:process.version,v8:process.versions.v8,viewport:{width:1280,height:800},before};
 let primaryPresent=false;
 /** @type {unknown} */
 let primary;
 /** Preserve the first original value, including falsy values; later errors stay ordered.
  * @param {unknown} error */
 function failure(error){if(!primaryPresent){primaryPresent=true;primary=error;}else if(lateErrors.length<32)lateErrors.push(error);}
 /** @type {import('node:child_process').ChildProcess|null} */
 let child=null;let nonce='';
 /** @type {ReturnType<typeof setTimeout>|undefined} */
 let stopTimer;
 let acquisitionComplete=false;
 let reportUntil=deadline;
 /** Original IPC sends stay owned within the same closure/report deadline.
  * @param {Data} message */
 const sendCase=message=>owned(()=>new Promise((done,reject)=>{if(!child?.connected)reject(Error('Original case IPC disconnected'));else child.send(message,error=>error?reject(error):done(null));}),reportUntil);
 /** @type {Data} */let lifecycle={caseClosed:false,caseExit:null,ipcFlushed:false,ipcDisconnected:false};
 try {
  const head=(await command('git',['rev-parse','HEAD'])).stdout.trim();assert.equal(head,admission.sha);
  const version=(await command('/usr/bin/uname',['-v'])).stdout.trim();receipt.kernel=version;
  const sdk=(await command('/usr/bin/xcrun',['--sdk','macosx','--show-sdk-path'])).stdout.trim();
  const clang=(await command('/usr/bin/xcrun',['--find','clang'])).stdout.trim();receipt.compilerVersion=(await command(clang,['--version'])).stdout;
  receipt.sdk={path:sdk,clang:await fact(clang),headers:[]};for(const name of ['usr/include/libproc.h','usr/include/sys/proc_info.h','usr/include/sys/proc.h','System/Library/Frameworks/CoreGraphics.framework/Headers/CGSession.h','System/Library/Frameworks/CoreGraphics.framework/Headers/CGDirectDisplay.h'])receipt.sdk.headers.push(await fact(join(sdk,name)));
  receipt.primarySources=await primarySources(version,out,receipt.primarySourceAttempts);
  const helper=join(out,'kernel-probe');await command(clang,['-Wall','-Wextra','-Werror','-isysroot',sdk,join(directory,'kernel-probe.c'),'-framework','CoreGraphics','-framework','CoreFoundation','-o',helper]);
  const binding={helper:await fact(helper),source:await fact(join(directory,'kernel-probe.c'))};receipt.binding=binding;
  assert.equal(JSON.parse(await readFile(join(root,'node_modules/playwright/package.json'),'utf8')).version,'1.64.0');
  receipt.playwright=await fact(join(root,'node_modules/playwright/package.json'));receipt.lock=await fact(join(root,'package-lock.json'));
  const budget=capabilityBudget(performance.now());deadline=budget.acquisition;reportUntil=budget.closureReport;receipt.budget={...budget,acquisitionMs:60000,closureReportMs:10000};nonce=randomUUID();
  // BEGIN originalCaseSpawn
  receipt.caseSpawnAttempted=true;
  child=originalSpawn(process.execPath,[source,'--case'],{detached:true,cwd:root,env:{...process.env,CAPABILITY_NONCE:nonce,CAPABILITY_BINDING:JSON.stringify(binding)},stdio:['ignore','pipe','pipe','ipc']});
  receipt.casePid=child.pid;
  // END originalCaseSpawn
  stopTimer=setTimeout(()=>{if(!acquisitionComplete){expired=true;if(child?.connected)void sendCase({type:'stop',nonce}).catch(failure);}},Math.max(0,budget.acquisition-performance.now()));
  /** @type {{value:Data|null}} */
  const childReport={value:null};let outputBytes=0;
  receipt.caseOutput={stdoutBytes:0,stderrBytes:0,stdoutPrefixBase64:'',stderrPrefixBase64:'',stdoutPrefixBytes:0,stderrPrefixBytes:0,overflow:false,encoding:'base64-original-bytes'};
  /** @param {Buffer} b @param {'stdout'|'stderr'} stream */function retainOutput(b,stream){const other=stream==='stdout'?'stderr':'stdout';const priorOverflow=receipt.caseOutput.overflow;retainCommandBytes(receipt.caseOutput,stream,b,65536-receipt.caseOutput[other+'PrefixBytes']);outputBytes+=b.length;if(outputBytes>65536){if(!priorOverflow)failure(Error('Original case combined output capacity65536'));receipt.caseOutput.overflow=true;}}
  child.stdout?.on('data',b=>retainOutput(b,'stdout'));
  child.stderr?.on('data',b=>retainOutput(b,'stderr'));
  child.once('error',failure);
  const originalExit=new Promise(done=>child?.once('exit',(code,signal)=>{lifecycle.caseExit={code,signal};done(null);}));
  const originalClose=new Promise(done=>child?.once('close',()=>{lifecycle.caseClosed=true;done(null);}));
  child.once('disconnect',()=>{lifecycle.ipcDisconnected=true;});
  const ready=new Promise(done=>child?.on('message',message=>{const m=/** @type {Data} */(message);try {
   if(Buffer.byteLength(JSON.stringify(m))>262144||m.nonce!==nonce)throw Error('Original capability IPC size/nonce');
   if(m.type==='ready'&&m.pid===child?.pid)done(null);
   else if(m.type==='acquired'&&!acquisitionComplete&&performance.now()<budget.acquisition&&!expired){acquisitionComplete=true;clearTimeout(stopTimer);}
   else if(m.type==='result'&&childReport.value===null)childReport.value=m;
   else if(m.type==='flush'&&childReport.value&&m.records===childReport.value.spawns.length){lifecycle.ipcFlushed=true;void sendCase({type:'flush-ack',nonce}).catch(failure);}
   else throw Error('Original capability IPC membership/order');
  }catch(error){failure(error);}}));
  await owned(()=>ready);assert.ok(child.pid);const initial=await query(binding,'pid',child.pid);assert.ok(exclusiveCase(initial,process.pid,process.getuid?.()??-1));
  const fresh=await query(binding,'pid',child.pid);assert.ok(sameIdentity(initial,fresh));receipt.caseIdentity=initial;
  await owned(()=>new Promise((done,reject)=>child?.send({type:'admit',nonce,remainingMs:Math.max(0,budget.acquisition-performance.now())},error=>error?reject(error):done(null))));
  deadline=budget.closureReport;
  await owned(()=>Promise.all([originalExit,originalClose]));assert.ok(childReport.value,'Original child report missing');
  receipt.child=childReport.value;receipt.groups=[];
  const groups=new Map([[initial.pgid,initial]]);for(const row of childReport.value.spawns){assert.ok(ownedGroup(row,initial),'Unexpected original group/session; no query admitted');groups.set(row.identity.pgid,row.identity);}
  for(const [pgid,identity] of groups){const actual=await query(binding,'group',pgid);receipt.groups.push(actual);assert.ok(scopedEmpty(actual),'Original group closure unavailable');}
  receipt.groupAuthorityComplete=true;
  const final={...childReport.value,...lifecycle,groups:receipt.groups};assert.ok(acquisitionComplete&&supported(final),'Original capability support/closure unavailable');
  if(primaryPresent||expired||pending.size)throw Error('Original capability lifetime unavailable');receipt.status='supported-capability-only';
 }catch(error){failure(error);if(child?.connected)void sendCase({type:'stop',nonce}).catch(failure);}
 finally {
  clearTimeout(stopTimer);
  if(receipt.budget)deadline=receipt.budget.closureReport;
  receipt.primaryPresent=primaryPresent;receipt.primary=primaryPresent?diagnostic(primary):null;receipt.lifecycle=lifecycle;receipt.expired=expired;receipt.pending=pending.size;receipt.queries=queries;receipt.commands=commands;receipt.lateErrors=lateErrors.map(diagnostic);
  try{receipt.after=await trackedFacts(root);assert.deepEqual(receipt.after,before);receipt.trackedSourceClosed=true;}catch(error){receipt.finalSourceError=diagnostic(error);receipt.status='unavailable';}
  receipt.pending=pending.size;receipt.lateErrors=lateErrors.map(diagnostic);
  // BEGIN finalClosureConstruction
  const helperLedgersKnown=Array.isArray(receipt.child?.queries)&&queries.length+receipt.child.queries.length<=256&&[...queries,...receipt.child.queries].every(q=>q!==null&&typeof q==='object'&&!Array.isArray(q)&&q.command!==null&&typeof q.command==='object'&&!Array.isArray(q.command));
  const closure={...receipt.child,...lifecycle,groups:receipt.groups,groupAuthorityComplete:receipt.groupAuthorityComplete===true,helperCommands:helperLedgersKnown?[...queries,...receipt.child.queries].map(q=>q.command):null,pending:pending.size+(receipt.child?.pending??0)};
  // END finalClosureConstruction
  Object.assign(receipt,classifyCapabilityReceipt(receipt,closure));
  try{const text=serialize(receipt);await owned(()=>writeFile(join(out,'receipt.json'),text,{flag:'wx'}),deadline);console.log(JSON.stringify({status:receipt.status,receipt:join(out,'receipt.json'),bytes:Buffer.byteLength(text),unscored:true,canonicalMatrix:false}));}catch(error){
   // BEGIN publicationFallback
   receipt.status=caseNotAttempted(receipt)?'failed-preparation-case-not-attempted':receipt.closureStatus==='observed-scoped-resources-closed'?'unavailable':'failed-uncontained';console.error(JSON.stringify({status:receipt.status,publication:diagnostic(error),pending:pending.size,closureStatus:receipt.closureStatus??'unknown',caseClosureStatus:receipt.caseClosureStatus??'unknown',overallResourceClosure:'unknown',originalScopedClosureUnknown:receipt.closureStatus!=='observed-scoped-resources-closed'}));
   // END publicationFallback
  }
  if(receipt.status!=='supported-capability-only')process.exitCode=1;
 }
}
if(process.argv.length===3&&process.argv[2]==='--case') {
 const text=process.env.CAPABILITY_BINDING??'';if(Buffer.byteLength(text)>4096)throw Error('Original capability binding4096');
 await capabilityChild(JSON.parse(text),process.env.CAPABILITY_NONCE??'');
}else {if(process.argv.length!==2)throw Error('No arbitrary capability CLI inputs');await parent();}
