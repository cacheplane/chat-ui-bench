import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const POLICY = 'private-owned-whole-ordered-paint-r-v12';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const ORIGIN = process.hrtime.bigint();
const CAPS = Object.freeze({work:34359738368,current:2147483648,child:17179869184,request:65536,manifest:1048576,
  stdout:34603008,stderr:65536,output:33554432,source:16777216,runtime:268435456,forward:60000,cleanup:5000});
// Parent finite role guards: two source+manifest bookends, two runtime
// passes, two normal encodings plus one tiny failure, and allocations bounded
// by the32Gi source-work envelope. These are separate from child capacities.
const COUNTER_CAPS=Object.freeze({sourceReadBytes:2*(CAPS.source+CAPS.manifest),sourceHashBytes:2*(CAPS.source+CAPS.manifest),runtimeReadBytes:2*CAPS.runtime,runtimeHashBytes:2*CAPS.runtime,outputWriteBytes:CAPS.output,outputReadbackBytes:CAPS.output+1,outputEncodedBytes:2*CAPS.output+65536,allocatedBufferBytes:CAPS.work,allocatedUTF16Units:CAPS.work,allocatedLogicalSlots:CAPS.work,closureReservedWork:CAPS.child+268435456,outputPreflightNodes:20*1048576,outputStringUnits:20*16777216});
const METRICS = Object.freeze({FPS:null,rate:null,latency:null,duration:null});
const AUTHORITY = Object.freeze({nativeSupported:false,qualificationEligibility:false,evaluationEligibility:false,scoringEligibility:false,
  rankingEligibility:false,clock:'not_evaluated',target:'not_evaluated',presentation:'not_evaluated',population:'not_evaluated',inputOrigin:'not_authenticated'});
const MODULES = Object.freeze(['browser-frame-owned-paint-v12-budget','browser-frame-owned-paint-v12-kernel','browser-frame-owned-paint-v12',
  'browser-frame-owned-paint-v12-reader','browser-frame-paint-packet-adapter','browser-frame-paint-timing-r-fragments','browser-frame-ordered-state',
  'browser-frame-whole-trace','browser-frame-trace-framer','browser-frame-packet-fragments','browser-frame-track-event-fragments',
  'browser-frame-protobuf-fragments','browser-frame-protobuf-wire','browser-frame-state-fragments','browser-frame-track-descriptor-fragments']);
const FILES = Object.freeze([...MODULES.map(n=>'packages/analyzer/src/'+n+'.ts'),...MODULES.map(n=>'packages/analyzer/dist/'+n+'.js'),
  'tools/owned-paint-v12/run.mjs','tools/owned-paint-v12/worker.mjs','package.json','package-lock.json','tsconfig.base.json',
  'packages/analyzer/package.json','packages/analyzer/tsconfig.json']);
const ownedSeals = new WeakMap();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bad = () => { throw Error('owned-v12-local-unavailable'); };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const identity = s => [s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(n=>String(n));
function zeroUsage(){
 const op=()=>Object.fromEntries(['calls','wireByteReads','fieldChargeWork','memberChargeWork','callbackLocalWork','loopRecordWork','copyBytes','hashBytes',
  'utf8DecodeBytes','terminalChecks','resultRecords','diagnosticRecords','parserAndOutputScanUnits','parsedNodes','logicalSlots','dynamicUTF16Units',
  'comparisonScanUnits','structuralWork','totalLogicalWork','reservedByteBufferOccupancy','reservedUTF16Occupancy'].map(k=>[k,0]));
 const rep=()=>({bufferBytes:0,utf16Units:0,logicalSlots:0,fixedRecordBytes:0,logicalBytes:0});
 return {coverage:'partial',successful:Object.fromEntries(['semanticFields','semanticMembers','routeFields','oldCallbackWork','repeatedWork','references','internUpdates',
 'resetReleaseVisits','sequenceKeys','historyDefinitions','defaultsVersions','metadataFacts','metadataOccurrences','clockChildren','timestampSlots','layoutEntrySlots',
 'candidateRows','paintRows','rawDropRows'].map(k=>[k,0])),reserved:{packet:op(),state:op(),descriptor:op(),comparator:op(),referenceJSON:op()},
 cumulative:Object.fromEntries(['requestedReadBytes','readCalls','acknowledgedReadBytes','inputCopyBytes','inputHashBytes','frameCopyBytes','frameHashBytes','manifestBytes',
 'manifestUpdates','utf8WidthScanUnits','canonicalPreflightNodes','canonicalPreflightStringUnits','canonicalGeneratedBytes','canonicalHashBytes','canonicalComparisonBytes',
 'fullMetadataRowBytes','metadataFactKeyBytes','metadataOccurrenceBytes','allocatedBufferBytes','allocatedUTF16Units','allocatedLogicalSlots','wrapperWork','outputPreflightNodes',
 'outputStringUnits','outputEncodedBytes','outputWriteBytes','outputReadbackBytes','sourceReadBytes','sourceHashBytes','runtimeReadBytes','runtimeHashBytes','closureReservedWork',
 'totalLogicalWork'].map(k=>[k,0])),retained:Object.fromEntries(['liveInternEntries','liveInternUTF8','liveInternUTF16','historyUTF8','historyUTF16','defaultsUTF8','metadataUTF8',
 'candidateUTF8','paintUTF8','indexKeyUTF8'].map(k=>[k,0])),current:rep(),highwater:rep(),finalOutput:{nodes:0,objects:0,keys:0,utf8Bytes:0,utf16Units:0,escapedBytes:0,depth:0}};
}
class ParentBudget {
 constructor(){this.usage=zeroUsage();this.work=0;this.current=0;this.failureMode=false;this.failureRemaining=268435456;this.charge(268435456,'closureReservedWork');this.occupy(9437184,{fixedRecordBytes:9437184});}
 charge(n,key='wrapperWork'){if(this.failureMode){if(!Number.isSafeInteger(n)||n<0||n>this.failureRemaining)bad();this.failureRemaining-=n;this.counter(key,n);return;}if(!Number.isSafeInteger(n)||n<0||n>CAPS.work-this.work)bad();const next=this.nextCounter(key,n);this.work+=n;this.usage.cumulative.totalLogicalWork=this.work;this.usage.cumulative[key]=next;}
 occupy(n,v={bufferBytes:n}){if(!Number.isSafeInteger(n)||n<0||n>(this.failureMode?CAPS.current:CAPS.current-1048576)-this.current)bad();
  const parts={bufferBytes:v.bufferBytes??0,utf16Units:v.utf16Units??0,logicalSlots:v.logicalSlots??0,fixedRecordBytes:v.fixedRecordBytes??0};
  if(parts.bufferBytes+2*parts.utf16Units+64*parts.logicalSlots+parts.fixedRecordBytes!==n)bad();
  const allocations={allocatedBufferBytes:this.nextCounter('allocatedBufferBytes',parts.bufferBytes),allocatedUTF16Units:this.nextCounter('allocatedUTF16Units',parts.utf16Units),allocatedLogicalSlots:this.nextCounter('allocatedLogicalSlots',parts.logicalSlots)};
  this.current+=n;this.usage.current.logicalBytes=this.current;this.usage.highwater.logicalBytes=Math.max(this.current,this.usage.highwater.logicalBytes);
  for(const [key,amount]of Object.entries(parts)){this.usage.current[key]+=amount;this.usage.highwater[key]=Math.max(this.usage.current[key],this.usage.highwater[key]);}
  Object.assign(this.usage.cumulative,allocations);
  let live=true;return()=>{if(live){live=false;this.current-=n;this.usage.current.logicalBytes=this.current;for(const [key,amount]of Object.entries(parts))this.usage.current[key]-=amount;}};}

 active(){if(Number(process.hrtime.bigint()-ORIGIN)/1e6>=CAPS.forward)bad();}
 nextCounter(k,n){const prior=this.usage.cumulative[k],cap=COUNTER_CAPS[k]??CAPS.work;if(!Number.isSafeInteger(prior)||!Number.isSafeInteger(n)||n<0||n>cap-prior)bad();return prior+n;}
 counter(k,n){this.usage.cumulative[k]=this.nextCounter(k,n);}
}
// A single bounded lexical pass counts keys as nodes and checks decoded string
// widths before JSON.parse. It builds no token array and uses no recursive parser.
function lexical(text,role,budget){
 const limits=role==='request'?[CAPS.request,4096,16]:role==='manifest'?[CAPS.manifest,65536,16]:[CAPS.stdout,1048576,24];
 if(typeof text!=='string'||text.length>limits[0])bad();
 budget.charge(8*text.length+64);let nodes=0,depth=0,quoted=false,escaped=false,width=0,unitCount=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);
  if(quoted){
   if(escaped){escaped=false;if(c===117){if(i+4>=text.length)bad();const raw=text.slice(i+1,i+5);if(!/^[0-9a-fA-F]{4}$/.test(raw))bad();const code=Number.parseInt(raw,16);
    if(code>=55296&&code<=56319&&i+10<text.length&&text.charCodeAt(i+5)===92&&text.charCodeAt(i+6)===117&&/^[0-9a-fA-F]{4}$/.test(text.slice(i+7,i+11))){const low=Number.parseInt(text.slice(i+7,i+11),16);if(low>=56320&&low<=57343){i+=10;width+=4;unitCount+=2;}else{i+=4;width+=3;unitCount++;}}
    else{i+=4;width+=code<128?1:code<2048?2:3;unitCount++;}}else{width++;unitCount++;}}
   else if(c===92)escaped=true;
   else if(c===34){quoted=false;if(width>4096||unitCount>4096)bad();}
   else{if(c<32)bad();if(c>=55296&&c<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){width+=4;unitCount+=2;i++;}else{width+=c<128?1:c<2048?2:3;unitCount++;}}
   if(width>4096||unitCount>4096)bad();continue;
  }
  if(c===34){quoted=true;width=0;unitCount=0;if(++nodes>limits[1])bad();}
  else if(c===123||c===91){if(++depth>limits[2]||++nodes>limits[1])bad();}
  else if(c===125||c===93){if(--depth<0)bad();}
  else if(c===45||c>=48&&c<=57||c===116||c===102||c===110){if(++nodes>limits[1])bad();while(i+1<text.length&&!/[\s,\]}]/.test(text[i+1]))i++;}
 }
 if(quoted||escaped||depth!==0)bad();
 const p=Buffer.byteLength(text);if(p>limits[0])bad();
 budget.charge(52*p+64*nodes);const release=budget.occupy(2*p+16*p+512*nodes+4096,{bufferBytes:2*p,utf16Units:8*p,logicalSlots:8*nodes,fixedRecordBytes:4096});
 return {release,nodes,p};
}
function parse(text,role,budget){const credit=lexical(text,role,budget);try{return{value:JSON.parse(text),release:credit.release};}catch{credit.release();bad();}}
function keys(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||!same(Object.keys(value),names))bad();}
function ref(value){keys(value,['path','bytes','sha256']);if(typeof value.path!=='string'||Buffer.byteLength(value.path)>4096||value.path.includes('\0')||path.resolve(value.path)!==value.path||
 !Number.isSafeInteger(value.bytes)||value.bytes<0||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))bad();return value;}
function absolute(filename){if(typeof filename!=='string'||Buffer.byteLength(filename)>4096||filename.includes('\0')||path.resolve(filename)!==filename)bad();return filename;}
function paths(filename,budget,exists=true){
 absolute(filename);budget.charge(filename.length+64);let prefixUnits=0,directoryCount=0;for(let i=1;i<filename.length;i++)if(filename.charCodeAt(i)===47){prefixUnits+=i;directoryCount++;}budget.occupy(2*(prefixUnits+3*filename.length)+512*directoryCount+4096,{utf16Units:prefixUnits+3*filename.length,logicalSlots:8*directoryCount,fixedRecordBytes:4096});let current=path.parse(filename).root;const ancestors=[];
 for(const part of filename.slice(current.length).split('/').slice(0,-1)){budget.active();budget.charge(current.length+part.length+64);current=path.join(current,part);
  const s=fs.lstatSync(current,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink())bad();ancestors.push([current,String(s.dev),String(s.ino)]);}
 if(fs.realpathSync(path.dirname(filename))!==path.dirname(filename))bad();
 if(exists){const s=fs.lstatSync(filename,{bigint:true});if(!s.isFile()||s.nlink!==1n||s.isSymbolicLink()||fs.realpathSync(filename)!==filename)bad();return{ancestors,id:identity(s),size:Number(s.size)};}
 if(fs.existsSync(filename))bad();return{ancestors};
}
function bookend(filename,check,budget){budget.active();for(const [name,dev,ino]of check.ancestors){budget.charge(name.length+64);const s=fs.lstatSync(name,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||String(s.dev)!==dev||String(s.ino)!==ino)bad();}
 if(check.id){const s=fs.lstatSync(filename,{bigint:true});if(!s.isFile()||s.nlink!==1n||!same(identity(s),check.id)||fs.realpathSync(filename)!==filename)bad();}}
function readFile(filename,cap,budget,kind='source',expected=null,retain=true){
 budget.active();const check=paths(filename,budget);if(check.size>cap||check.size<0||expected&&check.size!==expected.bytes)bad();
 const release=budget.occupy(65536+(retain?4*check.size:0),{bufferBytes:65536+(retain?2*check.size:0),utf16Units:retain?check.size:0});let fd;const parts=[];let bytes=0,reads=0;const hash=createHash('sha256');let result;
 try{budget.charge(64);fd=fs.openSync(filename,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  if(!same(identity(fs.fstatSync(fd,{bigint:true})),check.id))bad();const buffer=Buffer.alloc(65536);
  for(;;){budget.active();if(++reads>(kind==='runtime'?8192:kind==='output'?1024:258))bad();const requested=Math.min(buffer.length,check.size-bytes+1);budget.charge(4*requested);
   if(kind==='output')budget.counter('outputReadbackBytes',requested);const n=fs.readSync(fd,buffer,0,requested,null);if(!Number.isSafeInteger(n)||n<0||n>requested)bad();if(!n)break;bytes+=n;if(bytes>check.size)bad();
   budget.charge(4*n);if(kind!=='output'){budget.counter(kind==='runtime'?'runtimeReadBytes':'sourceReadBytes',n);budget.counter(kind==='runtime'?'runtimeHashBytes':'sourceHashBytes',n);}
   hash.update(buffer.subarray(0,n));if(retain){budget.occupy(128,{logicalSlots:2});parts.push(Buffer.from(buffer.subarray(0,n)));}}
  const digest=hash.digest('hex');if(bytes!==check.size||expected&&digest!==expected.sha256)bad();
  if(!same(identity(fs.fstatSync(fd,{bigint:true})),check.id))bad();bookend(filename,check,budget);
  result={bytes,sha256:digest,identity:check.id,data:retain?Buffer.concat(parts):null};
 }finally{try{if(fd!==undefined){budget.charge(64);fs.closeSync(fd);}}finally{if(!retain)release();}}
 return result;
}
function importEdges(text,budget){
 // One streaming iterator, at most33 native match roles (including the refused
 // first excess), and two source-sized capture strings are admitted up front.
 budget.charge(8*text.length+33*256);
 budget.occupy(4*text.length+33*16*64,{utf16Units:2*text.length,logicalSlots:33*16});
 const edges=[];
 for(const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\b(?!\s*type\b)\s*(?:[^;]*?\bfrom\s*)?['"]([^'"]+)['"]/g)){
  if(edges.length>=32)bad();const edge=match[1];if(edge.length>192)bad();
  budget.charge(2*edge.length+64);budget.occupy(2*edge.length+128,{utf16Units:edge.length,logicalSlots:2});edges.push(edge);
 }
 return edges;
}

function closure(manifest,budget,originalIdentities=null){
 keys(manifest,['policy','capacityTableSHA256','ruleCompatibilitySHA256','toolchain','build','files','runtime','imports']);
 if(manifest.policy!==POLICY||manifest.capacityTableSHA256!=='8a5fb3b0ffacdd51b74cab0469824c525231fe2a87c4da2c32612cc5f097cd64'||
 manifest.ruleCompatibilitySHA256!=='5e68e968605e192c835c74d74c4ddab63c9a3df844c52a1c5831236b56680fed'||!Array.isArray(manifest.files)||manifest.files.length!==FILES.length)bad();
 keys(manifest.toolchain,['compilerVersion','nodeVersion','npmMajor']);if(manifest.toolchain.compilerVersion!=='7.0.2'||manifest.toolchain.nodeVersion!=='24.20.0'||manifest.toolchain.npmMajor!==11)bad();
 keys(manifest.build,['command','exitCode','sourceDistCorrespondence']);if(manifest.build.command!=='npm run build --workspace=@chat-ui-bench/analyzer'||manifest.build.exitCode!==0||manifest.build.sourceDistCorrespondence!=='reviewed-build')bad();
 let total=0;const sourceText=[],identities=[];
 for(let i=0;i<FILES.length;i++){const row=manifest.files[i];keys(row,['path','bytes','sha256']);if(row.path!==FILES[i]||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>CAPS.source-total)bad();total+=row.bytes;
  const observed=readFile(path.join(ROOT,row.path),CAPS.source,budget,'source',row,i<32);identities.push(observed.identity);if(originalIdentities&&!same(observed.identity,originalIdentities[i]))bad();if(i<32)sourceText.push(observed.data.toString('utf8'));}
 keys(manifest.runtime,['path','bytes','sha256','identity','version','platform','arch']);
 const runtime=manifest.runtime;if(runtime.path!==fs.realpathSync(process.execPath)||runtime.version!==process.version||runtime.platform!==process.platform||runtime.arch!==process.arch||!Array.isArray(runtime.identity)||runtime.identity.length!==7)bad();
 const observed=readFile(runtime.path,CAPS.runtime,budget,'runtime',runtime,false);if(!same(observed.identity,runtime.identity))bad();
 if(!Array.isArray(manifest.imports)||manifest.imports.length!==32)bad();
 // Source/dist edge lists are admitted as a fixed reviewed roster, and checked
 // against literal import/export declarations before the original worker starts.
 for(let i=0;i<manifest.imports.length;i++){const row=manifest.imports[i];keys(row,['path','edges']);if(row.path!==FILES[i]||!Array.isArray(row.edges)||row.edges.length>32||row.edges.some(e=>typeof e!=='string'||e.length>192))bad();
  const text=sourceText[i];
  const edges=importEdges(text,budget);
  if(!same(edges,row.edges)||/\bimport\s*\(/.test(text)||/\brequire\s*\(/.test(text))bad();
  for(const edge of edges){if(edge.startsWith('node:')){if(!['node:fs','node:path','node:crypto','node:child_process','node:util'].includes(edge))bad();}
   else{const target=path.posix.normalize(path.posix.join(path.posix.dirname(row.path),edge));const selected=target.endsWith('.js')&&row.path.includes('/src/')?target.slice(0,-3)+'.ts':target;if(!FILES.includes(selected))bad();}}
 }
 return identities;
}
function collect(stream,cap,budget){let bytes=0,chunks=0,ended=false,closed=false,error=false;const parts=[];let resolve;const done=new Promise(r=>resolve=r);
 stream.on('data',b=>{try{budget.active();if(error||ended||closed||!Buffer.isBuffer(b)||++chunks>4096||b.length>cap-bytes)bad();budget.charge(4*b.length);budget.occupy(b.length+128,{bufferBytes:b.length,logicalSlots:2});bytes+=b.length;parts.push(Buffer.from(b));}catch{error=true;stream.destroy();}});
 stream.once('end',()=>ended=true);stream.once('error',()=>error=true);stream.once('close',()=>{closed=true;resolve();});
 return{done,finish(){if(error||!ended||!closed)bad();budget.charge(4*bytes);budget.occupy(4*bytes,{bufferBytes:2*bytes,utf16Units:bytes});return Buffer.concat(parts);},get failed(){return error;}};
}
async function childOnce(referenceJSON,runtime,budget){
 budget.active();budget.charge(CAPS.child,'closureReservedWork');const worker=path.join(ROOT,'tools/owned-paint-v12/worker.mjs');
 const env={PATH:path.dirname(runtime.path),LANG:'C.UTF-8',TZ:'UTC'};
 const child=spawn(runtime.path,[worker],{cwd:ROOT,env,execArgv:[],shell:false,stdio:['pipe','pipe','pipe']});
 const stdout=collect(child.stdout,CAPS.stdout,budget),stderr=collect(child.stderr,CAPS.stderr,budget);
 let stdinFinished=false,stdinClosed=false,stdinError=false,exited=false,closed=false,exitCode=null,signal=null,spawnError=false;
 child.stdin.once('finish',()=>stdinFinished=true);child.stdin.once('close',()=>stdinClosed=true);child.stdin.once('error',()=>stdinError=true);
 child.once('exit',(code,s)=>{exited=true;exitCode=code;signal=s;});
 const original=new Promise(resolve=>{child.once('error',()=>{spawnError=true;});child.once('close',()=>{closed=true;resolve();});});
 budget.charge(referenceJSON.length*4);child.stdin.end(referenceJSON);
 const remaining=Math.max(1,CAPS.forward-Number(process.hrtime.bigint()-ORIGIN)/1e6);let timer,forced=false;
 const timeout=new Promise(resolve=>timer=setTimeout(()=>{forced=true;if(!closed)child.kill('SIGTERM');resolve('timeout');},remaining));
 const outcome=await Promise.race([original.then(()=> 'closed'),timeout]);clearTimeout(timer);
 if(outcome==='timeout'){
  let escalation,cleanup;const killTimer=setTimeout(()=>{if(!closed)child.kill('SIGKILL');},Math.max(1,Math.floor(CAPS.cleanup/2)));escalation=killTimer;
  const joined=await Promise.race([original.then(()=>true),new Promise(resolve=>cleanup=setTimeout(()=>resolve(false),CAPS.cleanup))]);clearTimeout(escalation);clearTimeout(cleanup);
  if(!joined){if(!closed)child.kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();child.stdin.destroy();bad();}
 }
 await Promise.all([stdout.done,stderr.done]);
 if(forced||spawnError||!exited||!closed||exitCode!==0||signal!==null||!stdinFinished||!stdinClosed||stdinError||stdout.failed||stderr.failed)bad();
 stderr.finish();const raw=stdout.finish();budget.active();const text=raw.toString('utf8');if(!Buffer.from(text).equals(raw))bad();
 const parsed=parse(text,'child',budget);if(JSON.stringify(parsed.value)!==text){parsed.release();bad();}
 return{value:parsed.value,release:parsed.release};
}
function validateReader(reader){keys(reader,['policy','status','reason','fullInputVerified','structuralContainerEOF','reader','study','authority','metrics','usage']);
 if(reader.policy!==POLICY||!['complete-owned-whole-diagnostic','unavailable'].includes(reader.status)||!same(reader.authority,AUTHORITY)||!same(reader.metrics,METRICS))bad();
 if(reader.status==='complete-owned-whole-diagnostic'&&(!reader.fullInputVerified||!reader.structuralContainerEOF||reader.study?.status!=='complete-owned-selected-schema'))bad();
 if(!reader.fullInputVerified&&reader.study!==null)bad();}
function publish(destination,bytes,budget,forbidden){
 if(bytes.length>CAPS.output||forbidden.includes(destination))bad();const check=paths(destination,budget,false);
 const temporary=path.join(path.dirname(destination),'.owned-v12-'+randomBytes(16).toString('hex')+'.tmp');let fd,linked=false,ownedIdentity=null;
 try{budget.active();budget.charge(bytes.length*4);fd=fs.openSync(temporary,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY|fs.constants.O_NOFOLLOW,0o600);
  const initial=fs.fstatSync(fd,{bigint:true});ownedIdentity=identity(initial);if(!initial.isFile()||initial.nlink!==1n)bad();
  let offset=0,calls=0;while(offset<bytes.length){budget.active();if(++calls>1024)bad();const length=Math.min(65536,bytes.length-offset);budget.counter('outputWriteBytes',length);const n=fs.writeSync(fd,bytes,offset,length,null);if(n!==length)bad();offset+=n;}
  fs.fsyncSync(fd);const final=fs.fstatSync(fd,{bigint:true});if(final.dev!==initial.dev||final.ino!==initial.ino||final.size!==BigInt(bytes.length))bad();fs.closeSync(fd);fd=undefined;
  const fact={bytes:bytes.length,sha256:sha(bytes)},writtenIdentity=identity(final);
  // Check the original written file immediately before no-replace publication.
  // Link/unlink legitimately changes ctime, so the final read takes a new full
  // seven-part bookend while preserving original inode/mode/extent ownership.
  const staged=paths(temporary,budget);if(!same(staged.id,writtenIdentity))bad();
  bookend(destination,check,budget);budget.active();fs.linkSync(temporary,destination);linked=true;
  const linkedTemp=fs.lstatSync(temporary,{bigint:true});if(String(linkedTemp.dev)!==ownedIdentity[0]||String(linkedTemp.ino)!==ownedIdentity[1])bad();fs.unlinkSync(temporary);
  const sealed=paths(destination,budget);if(sealed.id[0]!==String(initial.dev)||sealed.id[1]!==String(initial.ino)||sealed.id[2]!==String(initial.mode)||sealed.id[3]!=='1'||sealed.size!==bytes.length)bad();
  // Exactly one bounded readback, now over the FINAL sealed path. No bundle can
  // escape until final bytes/hash/EOF/original descriptor close all verify.
  const back=readFile(destination,CAPS.output,budget,'output',fact);
  if(!same(back.identity,sealed.id)||!back.data.equals(bytes))bad();bookend(destination,sealed,budget);bookend(destination,check,budget);
  const sealedFact={path:destination,...fact};ownedSeals.set(sealedFact,ownedIdentity);return sealedFact;
 }catch{if(linked){try{const s=fs.lstatSync(destination,{bigint:true});if(s.isFile()&&String(s.dev)===ownedIdentity?.[0]&&String(s.ino)===ownedIdentity?.[1])fs.unlinkSync(destination);}catch{}}bad();}
 finally{if(fd!==undefined){try{fs.closeSync(fd);}catch{}}try{const s=fs.lstatSync(temporary,{bigint:true});if(String(s.dev)===ownedIdentity?.[0]&&String(s.ino)===ownedIdentity?.[1])fs.unlinkSync(temporary);}catch{}}
}

function measureOutput(value,budget){
 const m={nodes:0,objects:0,keys:0,utf8Bytes:0,utf16Units:0,escapedBytes:0,depth:0};
 const string=s=>{if(typeof s!=='string')bad();budget.charge(4*s.length+8);let width=0,escaped=2;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);m.utf16Units++;if(c===34||c===92){width++;escaped+=2;}else if(c<32){width++;escaped+=[8,9,10,12,13].includes(c)?2:6;}
   else if(c>=55296&&c<=56319&&i+1<s.length&&s.charCodeAt(i+1)>=56320&&s.charCodeAt(i+1)<=57343){width+=4;escaped+=4;m.utf16Units++;i++;}
   else if(c>=55296&&c<=57343){width+=3;escaped+=6;}else{const n=c<128?1:c<2048?2:3;width+=n;escaped+=n;}}
  if(width>4096)bad();m.utf8Bytes+=width;m.escapedBytes+=escaped;};
 function visit(v,d){budget.charge(32);if(++m.nodes>1048576||d>24)bad();m.depth=Math.max(m.depth,d);
  if(v===null){m.escapedBytes+=4;return;}if(typeof v==='boolean'){m.escapedBytes+=v?4:5;return;}
  if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)bad();m.escapedBytes+=String(v).length;return;}
  if(typeof v==='string'){string(v);return;}if(!v||typeof v!=='object')bad();if(++m.objects>262144)bad();
  const ks=Object.keys(v);if(Array.isArray(v)){m.escapedBytes+=2+Math.max(0,v.length-1);for(const item of v)visit(item,d+1);}
  else{m.escapedBytes+=2+Math.max(0,ks.length-1);for(const k of ks){if(++m.keys>524288)bad();string(k);m.escapedBytes++;visit(v[k],d+1);}}
 }
 visit(value,0);if(m.escapedBytes>CAPS.output||m.utf16Units>16777216)bad();return m;
}

function discardSeal(bundle){if(!bundle)return;const owned=ownedSeals.get(bundle);if(!owned)return;try{const s=fs.lstatSync(bundle.path,{bigint:true});if(String(s.dev)===owned[0]&&String(s.ino)===owned[1])fs.unlinkSync(bundle.path);}catch{}}
function snapshotUsage(budget){budget.charge(65536);budget.occupy(65536,{fixedRecordBytes:65536});return structuredClone(budget.usage);}
function usageNumericWidth(usage){
 let width=0;const row=record=>{for(const key in record)width+=String(record[key]).length;};
 row(usage.successful);for(const component in usage.reserved)row(usage.reserved[component]);
 row(usage.cumulative);row(usage.retained);row(usage.current);row(usage.highwater);row(usage.finalOutput);return width;
}
function prepareOutput(result,budget,failure){
 budget.active();
 budget.charge(failure?12*65536+16*8192+4096:12*CAPS.output+16*1048576+4096);
 result.usage=snapshotUsage(budget);
 // Exactly one full-tree preflight. Subsequent changes are fixed numeric Usage
 // roles only, whose decimal widths can be settled without revisiting the tree.
 const m=measureOutput(result,budget),initialBytes=m.escapedBytes;
 if(failure&&(m.escapedBytes>65536||m.nodes>8192))bad();
 const release=budget.occupy(6*(m.escapedBytes+8192)+256*m.nodes+4096,{bufferBytes:6*(m.escapedBytes+8192)+4096,logicalSlots:4*m.nodes});
 // Fixed512 numeric roles *(one prior +8 settlement rounds) *20 units. Future work and
 // temporary digit strings/role slots are prepaid BEFORE the final snapshot.
 budget.charge(131072);budget.occupy(2*92160+64*4608,{utf16Units:92160,logicalSlots:4608});const priorWidth=usageNumericWidth(result.usage);
 budget.counter('outputPreflightNodes',m.nodes);budget.counter('outputStringUnits',m.utf16Units);
 result.usage=snapshotUsage(budget);result.usage.finalOutput={...m};
 let settled=false;
 for(let i=0;i<8;i++){
  const bytes=initialBytes+usageNumericWidth(result.usage)-priorWidth;
  if(bytes===result.usage.finalOutput.escapedBytes){settled=true;break;}
  result.usage.finalOutput.escapedBytes=bytes;
 }
 if(!settled)bad();const finalBytes=result.usage.finalOutput.escapedBytes;
 if(finalBytes>CAPS.output||failure&&finalBytes>65536)bad();
 budget.active();const text=JSON.stringify(result);
 if(Buffer.byteLength(text)!==finalBytes)bad();budget.active();return{bytes:Buffer.from(text),release};
}

function sendFinalOutput(bytes,bundle,budget){
 try{budget.active();}catch{discardSeal(bundle);return Promise.reject(Error('local-output-deadline'));}
 const stream=process.stdout,remaining=CAPS.forward-Number(process.hrtime.bigint()-ORIGIN)/1e6;
 return new Promise((resolve,reject)=>{
  let settled=false,timer;
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);discardSeal(bundle);reject(Error('local-output-transport'));};
  const onError=()=>fail(),onClose=()=>fail();
  stream.once('error',onError);stream.once('close',onClose);
  timer=setTimeout(()=>{fail();stream.destroy(Error('local-output-deadline'));process.exit(1);},Math.max(1,remaining));
  try{stream.write(bytes,error=>{
   if(error){fail();return;}if(settled)return;
   try{budget.active();}catch{fail();stream.destroy(Error('local-output-deadline'));process.exit(1);return;}
   settled=true;clearTimeout(timer);stream.removeListener('error',onError);stream.removeListener('close',onClose);resolve();
  });}catch{fail();}
 });
}

async function main(){
 const budget=new ParentBudget();let reader=null,bundle=null,reason=null,parsedRequest,parsedManifest,parsedChild;
 try{
  budget.charge(128);const originalInput=fs.fstatSync(0).isFile()?fs.createReadStream('',{fd:0,autoClose:true,emitClose:true,highWaterMark:65536}):process.stdin;const source=collect(originalInput,CAPS.request,budget);const inputTimer=setTimeout(()=>originalInput.destroy(),Math.max(1,CAPS.forward-Number(process.hrtime.bigint()-ORIGIN)/1e6));await source.done;clearTimeout(inputTimer);const raw=source.finish();const text=raw.toString('utf8');if(!Buffer.from(text).equals(raw))bad();
  parsedRequest=parse(text,'request',budget);const request=parsedRequest.value;keys(request,['policy','trace','compatibility','output']);if(request.policy!==POLICY||JSON.stringify(request)!==text)bad();
  ref(request.trace);ref(request.compatibility);absolute(request.output);if(request.trace.bytes>33554432||request.compatibility.bytes>CAPS.manifest)bad();
  const manifestRead=readFile(request.compatibility.path,CAPS.manifest,budget,'source',request.compatibility);const manifestText=manifestRead.data.toString('utf8');if(!Buffer.from(manifestText).equals(manifestRead.data))bad();
  parsedManifest=parse(manifestText,'manifest',budget);const manifest=parsedManifest.value;if(JSON.stringify(manifest)!==manifestText)bad();const originalIdentities=closure(manifest,budget);
  const forbidden=[request.trace.path,request.compatibility.path,manifest.runtime.path,...FILES.map(f=>path.join(ROOT,f))];
  paths(request.output,budget,false);if(forbidden.includes(request.output))bad();
  parsedChild=await childOnce(JSON.stringify(request.trace),manifest.runtime,budget);validateReader(parsedChild.value);reader=parsedChild.value;
  closure(manifest,budget,originalIdentities);const afterManifest=readFile(request.compatibility.path,CAPS.manifest,budget,'source',request.compatibility,false);if(!same(afterManifest.identity,manifestRead.identity))bad();
  budget.active();const draft={policy:POLICY,status:'sealed-local-diagnostic',reason:null,reader,bundle:null,metrics:METRICS,authority:AUTHORITY,usage:null};
  const prepared=prepareOutput(draft,budget,false),bytes=prepared.bytes,staging=prepared.release;bundle=publish(request.output,bytes,budget,forbidden);staging();
 }catch{reason='local-postcapture-unavailable';reader=null;bundle=null;}

 budget.failureMode=reason!==null;const result={policy:POLICY,status:reason===null?'sealed-local-diagnostic':'unavailable',reason,reader,bundle,metrics:METRICS,authority:AUTHORITY,usage:null};
 let prepared;try{prepared=prepareOutput(result,budget,reason!==null);}catch{discardSeal(bundle);reader=null;bundle=null;budget.failureMode=true;prepared=prepareOutput({policy:POLICY,status:'unavailable',reason:'local-postcapture-unavailable',reader:null,bundle:null,metrics:METRICS,authority:AUTHORITY,usage:null},budget,true);}
 try{await sendFinalOutput(prepared.bytes,bundle,budget);}catch{discardSeal(bundle);throw Error('local-output-transport');}
 finally{reader=null;result.reader=null;for(const parsed of [parsedChild,parsedManifest,parsedRequest])if(parsed){parsed.value=null;parsed.release();}}
}
main().catch(()=>{process.exitCode=1;});
