// Source-owned preparation only. Importing this module starts no compiler, I/O or child.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire,isBuiltin} from 'node:module';
import {types,isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {compilerOutputBytes} from './prepare.mjs';
import {admitStock033DataV2,assembleStock033RosterV2,assertStock033ArchiveBudgetV2,assertStock033FixtureInputsV2,assertStock033RuntimeImportsV2,stock033Roles,nativeOwnerKeys,nativeRuntimeCompiledKeys} from './roster-stock033-v2.mjs';
import {parseStock033ProductRecord,productSourceKeys,productionSettings,stock033Identity} from '../../apps/threadplane/provenance.mjs';
import {parseProbeRecord,contractCompiledKeys} from '../../apps/threadplane/probe-provenance.mjs';

const fail=label=>{throw Error('native-stock033-v2-preparation-unavailable: '+label);};
const same=isDeepStrictEqual;
const identity=s=>({dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs});
const caps=Object.freeze({operations:131072,readBytes:3221225472,hashBytes:3221225472,writeBytes:Number.MAX_SAFE_INTEGER,externalWriteBytes:8388608,serializedBytes:8388608,platformPasses:4,platformReadBytes:2147483648,platformReferencedBytes:536870912,archiveWriteBytes:16777216});
const ledgers=new WeakSet(),authoredLedgers=new WeakSet(),ledgerCounters=new WeakMap(),ledgerCeilings=new WeakMap(),platformSets=new WeakMap();
const tailPolicy='native-post-phase-tail-500ms-v1',tailAdmissions=new WeakMap(),authoredTailAdmissions=new WeakMap();
const wheelFamily=Object.freeze({}),wheelRecipe='native-wheel-carrier-v1',wheelAdmissions=new WeakMap(),authoredWheelAdmissions=new WeakMap();
const suffix=tail=>tail?'-tail500-v1':'';
const preparationMode=(authored,tail=false)=>tail===wheelFamily?(authored?'authored-':'')+'real-chat-stock033-tail500-wheel-v1':(authored?'authored-real-chat-history100-stock-033-v2':'real-chat-history100-stock-033-v2')+suffix(tail);
const referencePolicy=(authored,tail=false)=>tail===wheelFamily?(authored?'authored-':'')+'source-owned-prep-stock033-tail500-wheel-v1':(authored?'authored-preparation-reference-stock-033-v2':'source-owned-preparation-reference-stock-033-v2')+suffix(tail);
const manifestMode=(authored,tail=false)=>tail===wheelFamily?(authored?'authored-':'')+'real-chat-custody-stock033-tail500-wheel-v1':(authored?'authored-real-chat-source-custody-stock-033-v2':'real-chat-source-custody-stock-033-v2')+suffix(tail);
const releasePolicy=tail=>tail===wheelFamily?'source-reviewed-stock033-inputs-tail500-wheel-v1':'source-reviewed-stock033-preparation-inputs-v2'+suffix(tail);
function collectionKeys(tail){return tail===wheelFamily?['collectionPolicy','inputRecipe']:tail?['collectionPolicy']:[];}
function collectionFields(tail){return tail===wheelFamily?{collectionPolicy:tailPolicy,inputRecipe:wheelRecipe}:tail?{collectionPolicy:tailPolicy}:{};}
function collectionCheck(value,tail){if(tail&&value.collectionPolicy!==tailPolicy||tail===wheelFamily&&value.inputRecipe!==wheelRecipe)fail('collection policy');}

/** Injected clocks/anchors are authored-only; reconciled scalar counters may be production inputs. */
export function createStock033PreparationLedgerV2(options={}){return createLedger(options,caps);}
function createLedger(options,ceilings){
 if(!options||typeof options!=='object'||types.isProxy(options)||Object.getPrototypeOf(options)!==Object.prototype)fail('ledger options');const supplied={};for(const key of Reflect.ownKeys(options)){const descriptor=Object.getOwnPropertyDescriptor(options,key);if(!['now','startedAt','initial'].includes(key)||!Object.hasOwn(descriptor,'value'))fail('ledger options');supplied[key]=descriptor.value;}
 const injected=Object.hasOwn(supplied,'now')||Object.hasOwn(supplied,'startedAt'),{now=()=>performance.now(),initial={}}=supplied;if(typeof now!=='function')fail('ledger clock');const startedAt=supplied.startedAt===undefined?now():supplied.startedAt;if(!Number.isFinite(startedAt))fail('ledger anchor');admitStock033DataV2(initial,4096);
 const counters=Object.fromEntries(Object.keys(caps).map(key=>[key,0])),pending=new Map(),ownedHandles=new Map(),stages=[];
 let active=0,handles=0,reservedCloses=0,peakHandles=0,peakOperations=0,sequence=0;
 function charge(key,amount){if(!Object.hasOwn(caps,key)||!Number.isSafeInteger(amount)||amount<0||counters[key]+amount+(key==='operations'?reservedCloses:0)>ceilings[key])fail('counter '+key);counters[key]+=amount;}
 for(const [key,value]of Object.entries(initial))charge(key,value);
 const ledger={
  charge,
  ensureCapacity(key,amount){if(!Object.hasOwn(caps,key)||!Number.isSafeInteger(amount)||amount<0||counters[key]+amount+(key==='operations'?reservedCloses:0)>ceilings[key])fail('counter '+key);},
  assertActive(){if(now()-startedAt>=60000)fail('forward deadline');},
  assertFinal(){if(now()-startedAt>=65000)fail('final deadline');},
  remainingForwardMs(){return Math.max(0,60000-(now()-startedAt));},
  remainingFinalMs(){return Math.max(0,65000-(now()-startedAt));},
  async operation(name,operation,{cleanup=false,closing=false}={}){
   if(!cleanup)ledger.assertActive();if(active>=16)fail('operation slots');if(closing){if(!reservedCloses)fail('close reservation');reservedCloses--;}charge('operations',1);
   const id=++sequence;pending.set(id,String(name).slice(0,192));active++;peakOperations=Math.max(peakOperations,active);
   try{return await operation();}finally{pending.delete(id);active--;}
  },
  handle(){ledger.assertActive();if(handles>=8||counters.operations+reservedCloses+2>ceilings.operations)fail('source handles/close reservation');handles++;reservedCloses++;peakHandles=Math.max(peakHandles,handles);const id=++sequence;ownedHandles.set(id,'source handle '+id);let released=false;return(consumed=false)=>{if(!released){released=true;handles--;if(!consumed)reservedCloses--;ownedHandles.delete(id);}};},
  stage(name){ledger.assertActive();if(stages.length>=64||typeof name!=='string'||name.length>192)fail('stages');stages.push({name,elapsedMs:now()-startedAt});},
  snapshot(){return{operations:counters.operations,readBytes:counters.readBytes,hashBytes:counters.hashBytes,writeBytes:counters.writeBytes,peakHandles,peakOperations,stages:stages.length,platformPasses:counters.platformPasses};},
  totals(){return{...counters};},pending(){return [...pending.values(),...ownedHandles.values()];},stageRows(){return stages.map(row=>({...row}));},
  hash(bytes){charge('hashBytes',bytes.length);return createHash('sha256').update(bytes).digest('hex');}
 };
 ledgers.add(ledger);if(injected)authoredLedgers.add(ledger);ledgerCounters.set(ledger,counters);ledgerCeilings.set(ledger,ceilings);return Object.freeze(ledger);
}
function ledgerOf(ledger){if(!ledgers.has(ledger))fail('owned ledger');return ledger;}
function absolute(filename,max=512){if(typeof filename!=='string'||Buffer.byteLength(filename)>max||path.resolve(filename)!==filename)fail('absolute path');return filename;}
function factShape(fact,cap){admitStock033DataV2(fact,2048);if(!fact||!Number.isSafeInteger(fact.bytes)||fact.bytes<0||fact.bytes>cap||typeof fact.sha256!=='string'||! /^[a-f0-9]{64}$/.test(fact.sha256)||!fact.identity)fail('file fact');closed(fact.identity,['dev','ino','size','mtimeMs','ctimeMs']);for(const key of ['dev','ino','size'])if(!Number.isSafeInteger(fact.identity[key])||fact.identity[key]<0)fail('identity integer');for(const key of ['mtimeMs','ctimeMs'])if(!Number.isFinite(fact.identity[key]))fail('identity time');if(fact.identity.size!==fact.bytes)fail('identity size');}
async function pathCheck(filename,ledger,{directory=false}={}){
 absolute(filename);const ancestors=[];let current=path.parse(filename).root;
 for(const part of filename.slice(current.length).split('/').slice(0,-1)){
  current=path.join(current,part);const s=await ledger.operation('lstat ancestor',()=>fs.lstat(current));if(!s.isDirectory()||s.isSymbolicLink())fail('unsafe ancestor');ancestors.push([current,{dev:s.dev,ino:s.ino}]);
 }
 const s=await ledger.operation('lstat path',()=>fs.lstat(filename));if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||!directory&&s.nlink!==1)fail('regular one-link file');
 if(await ledger.operation('realpath',()=>fs.realpath(filename))!==filename)fail('canonical path');return{identity:identity(s),ancestors};
}
async function pathBookend(filename,check,ledger){
 for(const [ancestor,expected]of check.ancestors){const s=await ledger.operation('lstat ancestor bookend',()=>fs.lstat(ancestor));if(!s.isDirectory()||s.isSymbolicLink()||s.dev!==expected.dev||s.ino!==expected.ino)fail('ancestor drift');}
 const z=await ledger.operation('lstat path bookend',()=>fs.lstat(filename));if(!z.isFile()||z.nlink!==1||!same(identity(z),check.identity)||await ledger.operation('realpath bookend',()=>fs.realpath(filename))!==filename)fail('path drift');
}
async function opened(filename,flags,ledger,action){
 const release=ledger.handle();let file;
 try{file=await ledger.operation('open',()=>fs.open(filename,flags|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600));return await action(file);}
 finally{if(file){await ledger.operation('close',()=>file.close(),{cleanup:true,closing:true});release(true);}else release();}
}
async function readOperation(file,buffer,offset,length,position,ledger,platform=false){
 ledger.charge('readBytes',length);if(platform)ledger.charge('platformReadBytes',length);
 let dispatched=false,result;try{result=await ledger.operation(platform?'platform read':'read',()=>{dispatched=true;return file.read(buffer,offset,length,position);});}catch(error){if(!dispatched){const counters=ledgerCounters.get(ledger);counters.readBytes-=length;if(platform)counters.platformReadBytes-=length;}throw error;}
 if(!Number.isSafeInteger(result.bytesRead)||result.bytesRead<0||result.bytesRead>length)fail('read result');
 const unused=length-result.bytesRead,counters=ledgerCounters.get(ledger);counters.readBytes-=unused;if(platform)counters.platformReadBytes-=unused;return result;
}
export async function readStock033FileV2(filename,cap,ledger,expected){
 ledgerOf(ledger);absolute(filename);if(!Number.isSafeInteger(cap)||cap<0||cap>2097152)fail('member cap');if(expected)factShape(expected,cap);
 const check=await pathCheck(filename,ledger);if(check.identity.size>cap||check.identity.size<0||expected&&!same(check.identity,expected.identity))fail('file identity/cap');
 const bytes=Buffer.alloc(check.identity.size);
 await opened(filename,constants.O_RDONLY,ledger,async file=>{
  const a=await ledger.operation('fstat',()=>file.stat());if(!a.isFile()||a.nlink!==1||!same(identity(a),check.identity))fail('opened identity');
  for(let offset=0;offset<bytes.length;){const n=Math.min(65536,bytes.length-offset);const r=await readOperation(file,bytes,offset,n,offset,ledger);if(r.bytesRead!==n)fail('short read');offset+=n;}
  const eof=await readOperation(file,Buffer.alloc(1),0,1,bytes.length,ledger);if(eof.bytesRead)fail('extra byte');
  const z=await ledger.operation('fstat bookend',()=>file.stat());if(!z.isFile()||z.nlink!==1||!same(identity(z),check.identity))fail('opened drift');await pathBookend(filename,check,ledger);
 });
 const digest=ledger.hash(bytes);if(expected&&(expected.bytes!==bytes.length||expected.sha256!==digest))fail('hash drift');ledger.assertActive();return{bytes,fact:{bytes:bytes.length,sha256:digest,identity:check.identity}};
}
export async function writeStock033FileV2(filename,bytes,cap,ledger,kind='external'){
 ledgerOf(ledger);absolute(filename);if(!Buffer.isBuffer(bytes)||!Number.isSafeInteger(cap)||cap<0||bytes.length>cap||cap>2097152||!['external','archive'].includes(kind))fail('write cap/kind');
 await pathCheck(path.dirname(filename),ledger,{directory:true});ledger.charge(kind==='external'?'externalWriteBytes':'archiveWriteBytes',bytes.length);ledger.charge('writeBytes',bytes.length);
 let created,dispatched=false;
 try{await opened(filename,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY,ledger,async file=>{
  const a=await ledger.operation('fstat created',()=>file.stat());if(!a.isFile()||a.nlink!==1)fail('created identity');
  const result=await ledger.operation('write',()=>{dispatched=true;return file.write(bytes,0,bytes.length,0);});if(!Number.isSafeInteger(result.bytesWritten)||result.bytesWritten<0||result.bytesWritten>bytes.length)fail('write result');const unused=bytes.length-result.bytesWritten,counters=ledgerCounters.get(ledger);counters.writeBytes-=unused;counters[kind==='external'?'externalWriteBytes':'archiveWriteBytes']-=unused;if(unused)fail('short write');await ledger.operation('fsync',()=>file.sync());
  const z=await ledger.operation('fstat written',()=>file.stat());if(!z.isFile()||z.nlink!==1||z.dev!==a.dev||z.ino!==a.ino||z.size!==bytes.length)fail('created drift');created=identity(z);
 });}catch(error){if(!dispatched){const counters=ledgerCounters.get(ledger);counters.writeBytes-=bytes.length;counters[kind==='external'?'externalWriteBytes':'archiveWriteBytes']-=bytes.length;}throw error;}
 const fact={bytes:bytes.length,sha256:ledger.hash(bytes),identity:created};const readback=await readStock033FileV2(filename,cap,ledger,fact);if(!readback.bytes.equals(bytes))fail('readback');return fact;
}
/** One bounded physical pass; observed facts are not a claim of trusted caller origin. */
export async function observeStock033PlatformsV2(paths,ledger){return platformPass(paths,ledger,false);}
export async function verifyStock033PlatformsV2(rows,ledger){const result=await platformPass(rows,ledger,true);return{files:result.length,bytes:result.reduce((n,row)=>n+row.bytes,0)};}
async function platformPass(rows,ledger,verify){
 ledgerOf(ledger);admitStock033DataV2(rows);if(!Array.isArray(rows)||rows.length<1||rows.length>1024)fail('platform rows');let total=0;const names=new Set(),paths=new Set(),observed=[];
 for(const row of rows){
  closed(row,verify?['key','path','bytes','sha256','identity']:['key','path']);absolute(row.path);keyName(row.key);
  if(names.has(row.key)||paths.has(row.path))fail('platform membership');names.add(row.key);paths.add(row.path);
  if(verify){factShape(row,536870912);if(row.bytes<1||(total+=row.bytes)>536870912)fail('platform membership');}
 }
 if(verify)bindPlatformSet(rows,ledger);
 ledger.charge('platformPasses',1);total=0;
 for(const row of rows){
  const check=await pathCheck(row.path,ledger),size=check.identity.size;
  if(size<1||(total+=size)>536870912||verify&&(!same(check.identity,row.identity)||size!==row.bytes))fail('platform identity');const digest=createHash('sha256');
  await opened(row.path,constants.O_RDONLY,ledger,async file=>{
   const a=await ledger.operation('platform fstat',()=>file.stat());if(!a.isFile()||a.nlink!==1||!same(identity(a),check.identity))fail('platform opened identity');const buffer=Buffer.alloc(65536);
   for(let offset=0;offset<size;){const n=Math.min(buffer.length,size-offset);const r=await readOperation(file,buffer,0,n,offset,ledger,true);if(r.bytesRead!==n)fail('platform short read');ledger.charge('hashBytes',n);digest.update(buffer.subarray(0,n));offset+=n;}
   const eof=await readOperation(file,buffer,0,1,size,ledger,true);if(eof.bytesRead)fail('platform extra byte');
   const z=await ledger.operation('platform fstat bookend',()=>file.stat());if(!z.isFile()||z.nlink!==1||!same(identity(z),check.identity))fail('platform opened drift');await pathBookend(row.path,check,ledger);
  });const sha256=digest.digest('hex');if(verify&&sha256!==row.sha256)fail('platform hash');observed.push({key:row.key,path:row.path,bytes:size,sha256,identity:check.identity});
 }
 if(!verify)bindPlatformSet(observed,ledger);ledger.assertActive();return observed;
}
function bindPlatformSet(rows,ledger){
 const tuples=[...rows].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(row=>[row.key,row.path,row.bytes,row.sha256,['dev','ino','size','mtimeMs','ctimeMs'].map(key=>row.identity[key])]);
 const bytes=serializeStock033DataV2(tuples,1048576,ledger),digest=ledger.hash(bytes),previous=platformSets.get(ledger),total=rows.reduce((n,row)=>n+row.bytes,0);
 if(previous!==undefined&&previous!==digest)fail('platform set drift');const old=ledger.totals();if(old.platformReferencedBytes&&old.platformReferencedBytes!==total)fail('platform set drift');
 if(!old.platformReferencedBytes)ledger.charge('platformReferencedBytes',total);platformSets.set(ledger,digest);
}
export function stock033PlatformSetSha256V2(ledger){ledgerOf(ledger);return platformSets.get(ledger)??null;}
function accountingShape(value){closed(value,['totals','platformSetSha256']);closed(value.totals,Object.keys(caps));for(const[key,n]of Object.entries(value.totals))if(!Number.isSafeInteger(n)||n<0||n>caps[key])fail('transfer counter');if(value.platformSetSha256!==null&&!/^[a-f0-9]{64}$/.test(value.platformSetSha256)||Boolean(value.totals.platformReferencedBytes)!==Boolean(value.platformSetSha256))fail('transfer platform set');}
/** Fixed preparation handoff, not a public configurable resource policy. */
export function createTransferredStock033LedgerV2(input){
 admitStock033DataV2(input,4096);closed(input,['totals','platformSetSha256','reservation']);const {reservation,...accounting}=input;accountingShape(accounting);closed(reservation,Object.keys(caps));
 const ceilings={};for(const[key,n]of Object.entries(reservation)){if(!Number.isSafeInteger(n)||n<0||n>caps[key])fail('transfer reservation');ceilings[key]=caps[key]-n;if(input.totals[key]>ceilings[key])fail('transfer capacity');}
 const ledger=createLedger({initial:input.totals},ceilings);if(input.platformSetSha256!==null)platformSets.set(ledger,input.platformSetSha256);return ledger;
}
export function reconcileStock033LedgerV2(ledger,baseline,final){
 ledgerOf(ledger);admitStock033DataV2({baseline,final},8192);accountingShape(baseline);accountingShape(final);
 if(baseline.platformSetSha256!==final.platformSetSha256||stock033PlatformSetSha256V2(ledger)!==baseline.platformSetSha256)fail('transfer platform drift');
 const delta={};for(const key of Object.keys(caps)){delta[key]=final.totals[key]-baseline.totals[key];if(delta[key]<0)fail('transfer counter reversal');ledger.ensureCapacity(key,delta[key]);}
 for(const[key,n]of Object.entries(delta))ledger.charge(key,n);
}
export function serializeStock033DataV2(value,cap,ledger){return serialize(value,cap,ledger);}

function closed(value,keys){if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype||!same(Reflect.ownKeys(value).sort(),[...keys].sort()))fail('closed data');for(const key of keys)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail('data property');}
function keyName(key){if(typeof key!=='string'||Buffer.byteLength(key)>192||! /^[A-Za-z0-9_@.-]+(?:\/[A-Za-z0-9_@.-]+)*$/.test(key)||key.split('/').some(part=>part==='.'||part==='..'||part==='records'))fail('member key');return key;}
function runtimeCheck(runtime){
 closed(runtime,['executablePath','expectedExecutableBytes','expectedExecutableSha256','playwrightVersion','browserRevision','expectedProduct','expectedRevision','launchFlags','headless']);absolute(runtime.executablePath);
 if(!Number.isSafeInteger(runtime.expectedExecutableBytes)||runtime.expectedExecutableBytes<1||runtime.expectedExecutableBytes>536870912||! /^[a-f0-9]{64}$/.test(runtime.expectedExecutableSha256)||runtime.playwrightVersion!=='1.64.0'||runtime.browserRevision!=='1248'||runtime.expectedProduct!=='HeadlessChrome/156.0.8078.4'||runtime.expectedRevision!=='@f842f52ef39fd97b449eb27cff414bf05a98ddce'||runtime.headless!==true||!same(runtime.launchFlags,['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-automation']))fail('runtime profile');
}
function releaseCheck(release,sourceObservation,tail=false){
 admitStock033DataV2(release);admitStock033DataV2(sourceObservation);closed(release,['schema','policy','source','build','roles','fixtureInputs','runtime','platformRows',...collectionKeys(tail)]);collectionCheck(release,tail);closed(sourceObservation,['revision','dirty']);closed(release.source,['revision','dirty']);
 if(release.schema!==1||release.policy!==releasePolicy(tail)||sourceObservation.dirty!==false||! /^[a-f0-9]{40}$/.test(sourceObservation.revision)||!same(release.source,sourceObservation))fail('reviewed source observation');
 closed(release.build,['product','probe']);for(const [name,key]of [['product','apps/threadplane/.build-evidence.json'],['probe','packages/runner/.comparison-build-evidence.json']]){closed(release.build[name],['key','fact']);if(release.build[name].key!==key)fail('build key');factShape(release.build[name].fact,262144);}
 closed(release.roles,stock033Roles);let references=0;
 for(const rows of Object.values(release.roles)){if(!Array.isArray(rows)||rows.length>1024||(references+=rows.length)>8192)fail('role bound');const seen=new Set();for(const row of rows){closed(row,['key','bytes','sha256']);keyName(row.key);if(seen.has(row.key)||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>2097152||! /^[a-f0-9]{64}$/.test(row.sha256))fail('role facts');seen.add(row.key);}}
 declaredMembers(release.roles);
 const sortedFacts=rows=>[...rows].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);if(!Array.isArray(release.fixtureInputs)||!same(sortedFacts(release.fixtureInputs),sortedFacts(release.roles['fixture-input']))||release.fixtureInputs.length<1||release.fixtureInputs.length>256)fail('fixture role join');runtimeCheck(release.runtime);
 if(!Array.isArray(release.platformRows)||release.platformRows.length<5||release.platformRows.length>1024)fail('platform references');for(const row of release.platformRows){closed(row,['key','path','bytes','sha256','identity']);keyName(row.key);factShape(row,536870912);absolute(row.path);}
}
function selectedOptions(options,authored,tail=false){
 if(!options||typeof options!=='object'||types.isProxy(options)||Object.getPrototypeOf(options)!==Object.prototype)fail('options');
 const copy={};for(const key of Reflect.ownKeys(options)){if(!['mode','sourceRoot','outputDirectory','compilationDirectory','release','sourceObservation','ledger',...collectionKeys(tail)].includes(key))fail('option key');const d=Object.getOwnPropertyDescriptor(options,key);if(!Object.hasOwn(d,'value'))fail('option getter');copy[key]=d.value;}
 const {ledger,...data}=copy;admitStock033DataV2(data);closed(data,['mode','sourceRoot','outputDirectory','compilationDirectory','release','sourceObservation',...collectionKeys(tail)]);collectionCheck(data,tail);if(data.mode!==preparationMode(authored,tail))fail('v2 mode');for(const key of ['sourceRoot','outputDirectory','compilationDirectory'])absolute(data[key],256);releaseCheck(data.release,data.sourceObservation,tail);
 const owned=ledger===undefined?createStock033PreparationLedgerV2():ledgerOf(ledger);if(authored&&ledger===undefined)authoredLedgers.add(owned);if(authoredLedgers.has(owned)!==authored)fail('authored ledger boundary');if(!authored&&(process.platform!=='darwin'||process.arch!=='arm64'))fail('reviewed host');
 return{...JSON.parse(JSON.stringify(data)),ledger:owned};
}
async function freshDirectories(sourceRoot,directories,ledger){
 await pathCheck(sourceRoot,ledger,{directory:true});if(new Set(directories).size!==directories.length)fail('distinct output directories');
 for(const filename of directories){absolute(filename,256);if(filename===sourceRoot||filename.startsWith(sourceRoot+'/')||directories.some(other=>other!==filename&&(filename.startsWith(other+'/')||other.startsWith(filename+'/'))))fail('output containment');await pathCheck(path.dirname(filename),ledger,{directory:true});
  try{await ledger.operation('fresh lstat',()=>fs.lstat(filename));fail('fresh output');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
}
function countedInventoryOps(ledger){return Object.fromEntries(['realpath','lstat','readdir'].map(method=>[method,async(...args)=>{const result=await ledger.operation('inventory '+method,()=>fs[method](...args));if(method==='readdir'&&result.length>1024)fail('inventory directory bound');return result;}]));}
async function sourceInventory(sourceRoot,ledger){return [...await productSourceKeys(sourceRoot,{ops:countedInventoryOps(ledger)}),...contractCompiledKeys].sort();}
function observedRoles(release,facts){return Object.fromEntries(stock033Roles.map(role=>[role,release.roles[role].map(row=>({key:row.key,bytes:facts.get(row.key).fact.bytes,sha256:facts.get(row.key).fact.sha256}))]));}
function declaredMembers(roles){
 const names=new Map();let bytes=0;for(const rows of Object.values(roles))for(const row of rows){const previous=names.get(row.key);if(previous){if(!same(previous,row))fail('cross-role facts');continue;}if(names.size>=1024)fail('unique archive bound');names.set(row.key,row);bytes+=row.bytes;assertStock033ArchiveBudgetV2({archiveBytes:bytes,manifestBytes:0});}return names;
}
async function observeMembers(sourceRoot,release,ledger,expected){
 const names=declaredMembers(release.roles);
 const result=new Map();for(const [key,row]of [...names].sort(([a],[b])=>a.localeCompare(b))){
  const known=expected?.get(key)?.fact;const read=await readStock033FileV2(sourceRoot+'/'+key,2097152,ledger,known);if(read.fact.bytes!==row.bytes||read.fact.sha256!==row.sha256)fail('observed source drift');result.set(key,read);
 }return result;
}
async function authenticate(sourceRoot,release,sourceObservation,facts,ledger,authored,tail=false){
 releaseCheck(release,sourceObservation,tail);
 const contract=await import('../../packages/contract/dist/index.js');
 for(const item of Object.values(release.build)){const observed=facts.get(item.key);if(!observed||!same(observed.fact,item.fact))fail('original build fact');}
 const product=parseStock033ProductRecord(facts.get(release.build.product.key).bytes,contract),probe=parseProbeRecord(facts.get(release.build.probe.key).bytes,contract);
 const inventory=await sourceInventory(sourceRoot,ledger);const rootAuthority={product,probe,productSourceKeys:inventory,fixtureInputs:release.fixtureInputs,platform:authored?'darwin':process.platform,architecture:authored?'arm64':process.arch};
 // Pure admission bounds the whole assembler input to1MiB. Each tuple is
 // shorter than its expected row object; the domain prefix fits the spare1MiB.
 // Assembly is synchronous and inert: no await/hook can spend this reserved room.
 ledger.ensureCapacity('hashBytes',2097152);
 const roster=assembleStock033RosterV2({roles:release.roles,observedRoles:observedRoles(release,facts),rootAuthority});ledger.charge('hashBytes',roster.digestBytes);
 const json=key=>{const value=facts.get(key);if(!value)fail('missing metadata');return JSON.parse(value.bytes.toString('utf8'));};
 const configuration=json('apps/threadplane/angular.json'),builder=configuration.projects?.threadplane?.architect?.build;productionSettings(configuration);
 if(!same(builder.options.styles,['src/styles.css'])||builder.defaultConfiguration!=='production'||Object.hasOwn(builder.configurations.production,'styles'))fail('stock styles');
 const lock=json('package-lock.json'),rootPackage=json('package.json');
 for(const p of product.packages){const metadata=json(p.resolutionPath+'/package.json'),locked=lock.packages?.[p.resolutionPath];if(metadata.name!==p.name||metadata.version!==p.version||locked?.version!==p.version||locked?.integrity!==p.integrity||locked?.name!==undefined&&locked.name!==p.name)fail('product package lock metadata');}
 function tool(selected,key){const metadata=json(key),locked=lock.packages?.[key.slice(0,-13)];if(selected.name!==metadata.name||selected.version!==metadata.version||selected.integrity!==locked?.integrity||selected.version!==locked?.version||locked?.name!==undefined&&locked.name!==selected.name)fail('tool lock metadata');return metadata;}
 if(probe.compiler.name!=='typescript'||probe.compiler.version!=='7.0.2'||probe.compiler.resolutionPath!=='node_modules/typescript'||probe.compiler.nodeVersion!==process.version||rootPackage.devDependencies?.typescript!=='7.0.2')fail('compiler pin');
 const compiler=tool(probe.compiler,'node_modules/typescript/package.json'),native=tool(probe.nativeCompiler,'node_modules/@typescript/typescript-darwin-arm64/package.json');
 if(probe.nativeCompiler.name!=='@typescript/typescript-darwin-arm64'||probe.nativeCompiler.resolutionPath!=='node_modules/@typescript/typescript-darwin-arm64'||probe.nativeCompiler.executablePath!=='node_modules/@typescript/typescript-darwin-arm64/lib/tsc'||probe.nativeCompiler.platform!=='darwin'||probe.nativeCompiler.architecture!=='arm64'||probe.nativeCompiler.version!==probe.compiler.version||compiler.optionalDependencies?.[probe.nativeCompiler.name]!==probe.compiler.version||!native.os?.includes('darwin')||!native.cpu?.includes('arm64'))fail('native compiler');
 for(const [field,key]of [['compilerPackageMetadata','node_modules/typescript/package.json'],['nativeCompilerPackageMetadata','node_modules/@typescript/typescript-darwin-arm64/package.json']]){const fact=facts.get(key).fact;if(probe[field].byteLength!==fact.bytes||probe[field].sha256!==fact.sha256)fail('compiler metadata measurement');}
 for(const [key,name,pin]of [['node_modules/esbuild/package.json','esbuild',lock.packages?.['node_modules/esbuild']?.version],['node_modules/@esbuild/darwin-arm64/package.json','@esbuild/darwin-arm64',json('node_modules/esbuild/package.json').version],['node_modules/playwright/package.json','playwright','1.64.0'],['node_modules/playwright-core/package.json','playwright-core','1.64.0']]){const metadata=json(key),locked=lock.packages?.[key.slice(0,-13)];if(typeof pin!=='string'||metadata.name!==name||metadata.version!==pin||locked?.version!==pin||!/^sha(?:256|384|512)-[A-Za-z0-9+/=_-]+$/.test(locked?.integrity??''))fail('platform package metadata');}
 const browsers=json('node_modules/playwright-core/browsers.json').browsers;if(!Array.isArray(browsers)||!browsers.some(row=>row.name==='chromium-headless-shell'&&row.revision===release.runtime.browserRevision&&row.browserVersion==='156.0.8078.4'))fail('browser metadata');
 const analyzer=json('packages/analyzer/package.json'),entry=analyzer.exports?.['./internal/whole-annotation'];if((typeof entry==='string'?entry:entry?.require)!=='./dist/browser-frame-whole-trace-reader.js')fail('whole annotation export');
 const assetNames=await ledger.operation('asset readdir',()=>fs.readdir(sourceRoot+'/apps/threadplane/dist'));if(!same([...assetNames].sort(),Object.keys(product.assetHashes).sort()))fail('physical asset membership');
 const expectedPaths=[process.execPath,sourceRoot+'/'+probe.nativeCompiler.executablePath,sourceRoot+'/node_modules/@esbuild/darwin-arm64/bin/esbuild',release.runtime.executablePath,sourceRoot+'/node_modules/playwright-core/lib/coreBundle.js'];
 for(const filename of expectedPaths)if(!release.platformRows.some(row=>row.path===filename))fail('required platform path');const browser=release.platformRows.find(row=>row.path===release.runtime.executablePath);if(browser.bytes!==release.runtime.expectedExecutableBytes||browser.sha256!==release.runtime.expectedExecutableSha256)fail('runtime platform join');
 return{roster,product,probe,rootAuthority};
}
function compilerCopies(built,ledger){ledger.charge('serializedBytes',3145728);const bounded=compilerOutputBytes(built);ledgerCounters.get(ledger).serializedBytes-=3145728-bounded.moduleBytes.length-bounded.metafileBytes.length;return bounded;}
async function runtimeImports(sourceRoot,facts,roster,esbuild,ledger){
 const imports=[];
 for(const key of [...nativeOwnerKeys.filter(key=>key.endsWith('.mjs')),...nativeRuntimeCompiledKeys]){
  const built=await esbuild.build({stdin:{contents:facts.get(key).bytes.toString('utf8'),sourcefile:key,resolveDir:path.dirname(sourceRoot+'/'+key)},bundle:false,platform:'node',format:'esm',target:'node24',write:false,metafile:true,logLevel:'silent'});
  compilerCopies(built,ledger);
  for(const output of Object.values(built.metafile.outputs))for(const item of output.imports){
   const name=item.path;if(isBuiltin(name))continue;
   if(name.startsWith('.'))imports.push(keyName(path.posix.normalize(path.posix.join(path.posix.dirname(key),name))));
   else if(name==='@chat-ui-bench/analyzer/internal/whole-annotation')imports.push('packages/analyzer/dist/browser-frame-whole-trace-reader.js');
   else if(name==='@chat-ui-bench/contract')imports.push('packages/contract/dist/index.js');
   else if(name==='esbuild'||name==='playwright')continue; // explicitly named trusted compiler/platform internals
   else fail('runtime external import '+name);
  }
 }
 assertStock033RuntimeImportsV2([...new Set(imports)],roster);
}
function serialize(value,cap,ledger){admitStock033DataV2(value,cap-1);ledger.charge('serializedBytes',cap);const bytes=Buffer.from(JSON.stringify(value)+'\n');ledgerCounters.get(ledger).serializedBytes-=cap-bytes.length;return bytes;}
function canonicalFixture(fixture,contract,ledger){
 admitStock033DataV2(fixture);closed(fixture,['status','history','digests','authority']);closed(fixture.digests,['sourceSha256','eventsSha256','historySha256']);
 const source=contract.createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'}),messages=source.history.map(({id,role,text})=>({id,role,content:text})),clock=i=>({timestamp:i,metadata:{clock:'synthetic-canonical-history-restore-ms',epochMs:0,scheduledMs:i}}),events=[{type:'RUN_STARTED',threadId:'native-chat-source-A',runId:'native-chat-source-A',...clock(0)},{type:'MESSAGES_SNAPSHOT',messages,...clock(1)},{type:'RUN_FINISHED',threadId:'native-chat-source-A',runId:'native-chat-source-A',...clock(2)}];
 const expected={sourceSha256:ledger.hash(Buffer.from(contract.canonicalSerialize(source))),eventsSha256:ledger.hash(Buffer.from(contract.canonicalSerialize(events))),historySha256:ledger.hash(Buffer.from(contract.canonicalSerialize(messages)))};
 if(fixture.status!=='source-fixture-verified'||fixture.authority!==false||!same(fixture.history,source.history.map(message=>({...message,status:'complete'})))||!same(fixture.digests,expected))fail('canonical fixture history');
}
async function directory(filename,ledger){await ledger.operation('mkdir',()=>fs.mkdir(filename,{mode:0o700}));}
async function archiveParent(root,key,created,ledger){let current=root;for(const part of key.split('/').slice(0,-1)){current+='/'+part;if(!created.has(current)){await directory(current,ledger);created.add(current);}}}
/** Trusted-root API: the outer owner binds sourceRoot to this reviewed checkout and
 * authenticates sourceObservation/config/release lineage. Caller hashes alone
 * establish no origin. Compiler/Node loader private reads remain trusted platform work.
 * No process or acquisition ownership is implied by this source-only return. */
export async function prepareActualStock033V2(options){
 return prepareCore(options,false);
}
export async function prepareActualStock033V2Tail500(options){return prepareCore(options,false,true);}
async function prepareCore(options,authored,tail=false){
 const selected=selectedOptions(options,authored,tail),{sourceRoot,outputDirectory,compilationDirectory,release,sourceObservation,ledger}=selected;
 ledger.stage('admit');await freshDirectories(sourceRoot,[outputDirectory,compilationDirectory],ledger);
 const facts=await observeMembers(sourceRoot,release,ledger),authenticated=await authenticate(sourceRoot,release,sourceObservation,facts,ledger,authored,tail),{roster,product}=authenticated;
 ledger.stage('authenticated');await verifyStock033PlatformsV2(release.platformRows,ledger);
 const esbuild=createRequire(sourceRoot+'/package.json')('esbuild');let bounded,fixture,moduleFact;
 try{
  await runtimeImports(sourceRoot,facts,roster,esbuild,ledger);
  const built=await esbuild.build({absWorkingDir:sourceRoot,entryPoints:['tools/native-real-chat/fixture-entry.mjs'],bundle:true,platform:'node',format:'esm',target:'node24',write:false,metafile:true,logLevel:'silent',banner:{js:"import{createRequire as __fixtureRequire}from'node:module';const require=__fixtureRequire(import.meta.url);"}});
  // Reserve the unchanged constructor maxima before making retained compiler copies.
  bounded=compilerCopies(built,ledger);assertStock033FixtureInputsV2(release.fixtureInputs,built.metafile);
  // Compiler input and all named source bookends retain their original file identities.
  await observeMembers(sourceRoot,release,ledger,facts);await directory(compilationDirectory,ledger);
  moduleFact=await writeStock033FileV2(compilationDirectory+'/fixture-compiled.mjs',bounded.moduleBytes,2097152,ledger);
  await writeStock033FileV2(compilationDirectory+'/fixture-metafile.json',bounded.metafileBytes,1048576,ledger);
  await readStock033FileV2(compilationDirectory+'/fixture-compiled.mjs',2097152,ledger,moduleFact);
  const invoked=await import(pathToFileURL(compilationDirectory+'/fixture-compiled.mjs').href);fixture=invoked.compileSourceFixture();
  await readStock033FileV2(compilationDirectory+'/fixture-compiled.mjs',2097152,ledger,moduleFact);canonicalFixture(fixture,await import('../../packages/contract/dist/index.js'),ledger);
  await writeStock033FileV2(compilationDirectory+'/fixture-output.json',serialize(fixture,131072,ledger),131072,ledger);
 }finally{await esbuild.stop();}
 ledger.stage('compiled');await observeMembers(sourceRoot,release,ledger,facts);if(!same(await sourceInventory(sourceRoot,ledger),authenticated.rootAuthority.productSourceKeys))fail('product inventory drift');
 const history=Buffer.from(JSON.stringify(fixture.history)),archiveTotal=roster.archiveBytes+history.length+bounded.moduleBytes.length;
 if(history.length>65536)fail('history cap');assertStock033ArchiveBudgetV2({archiveBytes:archiveTotal,manifestBytes:0});
 await directory(outputDirectory,ledger);await directory(outputDirectory+'/inputs',ledger);const created=new Set([outputDirectory+'/inputs']),records=[];
 for(const row of roster.rows){const original=facts.get(row.key);await archiveParent(outputDirectory+'/inputs',row.key,created,ledger);const archived=await writeStock033FileV2(outputDirectory+'/inputs/'+row.key,original.bytes,2097152,ledger,'archive');records.push({...row,source:sourceRoot+'/'+row.key,identity:original.fact.identity,archivedIdentity:archived.identity});}
 const historyFact=await writeStock033FileV2(outputDirectory+'/history.json',history,65536,ledger,'archive'),compiledFact=await writeStock033FileV2(outputDirectory+'/fixture-compiled.mjs',bounded.moduleBytes,2097152,ledger,'archive');
 const assets=Object.entries(product.assetHashes).map(([name,sha256])=>({name,bytes:facts.get('apps/threadplane/dist/'+name).fact.bytes,sha256}));
 const fixtureEvidence={source:fixture.digests.sourceSha256,events:fixture.digests.eventsSha256,history:fixture.digests.historySha256,projection:historyFact.sha256};
 const manifest={mode:manifestMode(authored,tail),...collectionFields(tail),records,owned:[{key:'history.json',...historyFact},{key:'fixture-compiled.mjs',...compiledFact}],platform:release.platformRows,assets,totalBytes:archiveTotal,fixture:fixtureEvidence,platformTrust:'Pinned compiler/Node/Playwright/browser internals; explicit source I/O only, no complete dynamic dependency closure.',product:stock033Identity,custody:{sourceRoot,sourceObservation,build:release.build,fixtureInputs:release.fixtureInputs},roster:{contract:roster.contract,digest:roster.digest,roleCounts:roster.roleCounts,membershipCount:roster.membershipCount,unionCount:roster.unionCount,overlapCount:roster.overlapCount}};if(authored)manifest.authoredControl=true;
 const manifestBytes=serialize(manifest,1048576,ledger);assertStock033ArchiveBudgetV2({archiveBytes:archiveTotal,manifestBytes:manifestBytes.length});
 const manifestFact=await writeStock033FileV2(outputDirectory+'/app-manifest.json',manifestBytes,1048576,ledger,'archive');
 await verifyStock033PlatformsV2(release.platformRows,ledger);await observeMembers(sourceRoot,release,ledger,facts);if(!same(await sourceInventory(sourceRoot,ledger),authenticated.rootAuthority.productSourceKeys))fail('product inventory drift');
 const template={mode:preparationMode(authored,tail),...collectionFields(tail),root:outputDirectory,nonce:randomBytes(16).toString('hex'),runtime:release.runtime,assets,fixture:fixtureEvidence,history:historyFact,manifest:manifestFact,product:stock033Identity};if(authored)template.authoredControl=true;
 const templateFact=await writeStock033FileV2(outputDirectory+'/template.json',serialize(template,4096,ledger),4096,ledger,'archive');
 const reference={policy:referencePolicy(authored,tail),...collectionFields(tail),product:stock033Identity,template:templateFact,manifest:manifestFact};if(authored)reference.authoredControl=true;serialize(reference,4096,ledger);ledger.stage('prepared');ledger.assertActive();if(ledger.pending().length)fail('pending originals');return authored?{template,reference,authoredControl:true,...(tail===wheelFamily?{inputRecipe:wheelRecipe}:{})}:{template,reference,...(tail===wheelFamily?{inputRecipe:wheelRecipe}:{})};
}
export async function verifyStock033PreparationV2(root,template,reference,{ledger=createStock033PreparationLedgerV2()}={}){
 return verifyCore(root,template,reference,ledger,false);
}
function preflightArchive(manifest,manifestBytes){
 const names=new Set();let bytes=0;
 for(const row of manifest.records){closed(row,['key','bytes','sha256','roles','source','identity','archivedIdentity']);keyName(row.key);if(names.has(row.key))fail('manifest member');names.add(row.key);factShape({bytes:row.bytes,sha256:row.sha256,identity:row.identity},2097152);factShape({bytes:row.bytes,sha256:row.sha256,identity:row.archivedIdentity},2097152);bytes+=row.bytes;assertStock033ArchiveBudgetV2({archiveBytes:bytes,manifestBytes});}
 const owned=new Set();for(const row of manifest.owned){closed(row,['key','bytes','sha256','identity']);if(!['history.json','fixture-compiled.mjs'].includes(row.key)||owned.has(row.key))fail('owned member');owned.add(row.key);factShape(row,row.key==='history.json'?65536:2097152);bytes+=row.bytes;assertStock033ArchiveBudgetV2({archiveBytes:bytes,manifestBytes});}
 if(bytes!==manifest.totalBytes)fail('archive total');
}
function servedAssetJoin(assets,product,roster){
 const emitted=Object.keys(product.assetHashes),rows=new Map(roster.rows.filter(row=>row.roles.includes('served-asset')).map(row=>[row.key,row]));
 if(!Array.isArray(assets)||assets.length!==12||emitted.length!==12||rows.size!==12)fail('served asset join');const names=new Set();let total=0;
 for(const asset of assets){closed(asset,['name','bytes','sha256']);if(typeof asset.name!=='string'||! /^[A-Za-z0-9_.-]{1,192}$/.test(asset.name)||names.has(asset.name)||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||(total+=asset.bytes)>2097152)fail('served asset join');names.add(asset.name);const row=rows.get('apps/threadplane/dist/'+asset.name);if(!row||asset.sha256!==product.assetHashes[asset.name]||asset.bytes!==row.bytes||asset.sha256!==row.sha256)fail('served asset join');}
 if(!same([...names].sort(),emitted.sort()))fail('served asset join');
}
async function verifyCore(root,template,reference,ledger,authored,tail=false){
 ledgerOf(ledger);if(authoredLedgers.has(ledger)!==authored)fail('authored ledger boundary');admitStock033DataV2(template,4095);admitStock033DataV2(reference,4095);closed(reference,['policy','product','template','manifest',...collectionKeys(tail),...(authored?['authoredControl']:[])]);closed(template,['mode','root','nonce','runtime','assets','fixture','history','manifest','product',...collectionKeys(tail),...(authored?['authoredControl']:[])]);
 collectionCheck(template,tail);collectionCheck(reference,tail);if(template.mode!==preparationMode(authored,tail)||reference.policy!==referencePolicy(authored,tail)||template.root!==root||!same(template.product,stock033Identity)||!same(reference.product,stock033Identity)||authored&&(template.authoredControl!==true||reference.authoredControl!==true))fail('v2 reference');absolute(root,256);runtimeCheck(template.runtime);if(!authored&&(process.platform!=='darwin'||process.arch!=='arm64'))fail('reviewed host');template=JSON.parse(JSON.stringify(template));reference=JSON.parse(JSON.stringify(reference));
 const owned=JSON.parse((await readStock033FileV2(root+'/template.json',4096,ledger,reference.template)).bytes);if(!same(owned,template)||!same(owned.manifest,reference.manifest))fail('original template join');
 const manifestRead=await readStock033FileV2(root+'/app-manifest.json',1048576,ledger,reference.manifest),manifest=JSON.parse(manifestRead.bytes);closed(manifest,['mode','records','owned','platform','assets','totalBytes','fixture','platformTrust','product','custody','roster',...collectionKeys(tail),...(authored?['authoredControl']:[])]);
 collectionCheck(manifest,tail);if(manifest.mode!==manifestMode(authored,tail)||authored&&manifest.authoredControl!==true||!same(manifest.product,stock033Identity)||!Array.isArray(manifest.records)||manifest.records.length>1024||manifest.owned.length!==2||!same(manifest.assets,template.assets)||!same(manifest.fixture,template.fixture))fail('manifest joins');
 preflightArchive(manifest,reference.manifest.bytes);
 const roles=Object.fromEntries(stock033Roles.map(role=>[role,[]])),facts=new Map();let total=0;const names=new Set();
 for(const row of manifest.records){keyName(row.key);if(names.has(row.key)||row.source!==manifest.custody.sourceRoot+'/'+row.key||!Array.isArray(row.roles)||row.roles.length<1||new Set(row.roles).size!==row.roles.length)fail('manifest member');names.add(row.key);const fact={bytes:row.bytes,sha256:row.sha256,identity:row.identity};const original=await readStock033FileV2(row.source,2097152,ledger,fact);await readStock033FileV2(root+'/inputs/'+row.key,2097152,ledger,{...fact,identity:row.archivedIdentity});facts.set(row.key,original);total+=row.bytes;
  for(const role of row.roles){if(!Object.hasOwn(roles,role))fail('manifest role');roles[role].push({key:row.key,bytes:row.bytes,sha256:row.sha256});}
 }
 for(const role of stock033Roles)roles[role].sort((a,b)=>a.key.localeCompare(b.key));
 const release={schema:1,policy:releasePolicy(tail),...collectionFields(tail),source:manifest.custody.sourceObservation,build:manifest.custody.build,roles,fixtureInputs:manifest.custody.fixtureInputs,runtime:owned.runtime,platformRows:manifest.platform};
 const authenticated=await authenticate(manifest.custody.sourceRoot,release,manifest.custody.sourceObservation,facts,ledger,authored,tail),roster=authenticated.roster;
 servedAssetJoin(manifest.assets,authenticated.product,roster);
 const rosterEvidence={contract:roster.contract,digest:roster.digest,roleCounts:roster.roleCounts,membershipCount:roster.membershipCount,unionCount:roster.unionCount,overlapCount:roster.overlapCount};if(!same(rosterEvidence,manifest.roster))fail('roster digest');
 const ownedNames=new Set();for(const item of manifest.owned){if(!['history.json','fixture-compiled.mjs'].includes(item.key)||ownedNames.has(item.key))fail('owned member');ownedNames.add(item.key);const {key,...fact}=item;const result=await readStock033FileV2(root+'/'+key,key==='history.json'?65536:2097152,ledger,fact);total+=result.bytes.length;if(key==='history.json'&&(!same(fact,owned.history)||fact.sha256!==owned.fixture.projection))fail('history original join');}
 if(total!==manifest.totalBytes)fail('archive total');assertStock033ArchiveBudgetV2({archiveBytes:total,manifestBytes:reference.manifest.bytes});await verifyStock033PlatformsV2(manifest.platform,ledger);ledger.assertActive();if(tail&&ledger.pending().length)fail('pending originals');if(tail)(tail===wheelFamily?(authored?authoredWheelAdmissions:wheelAdmissions):(authored?authoredTailAdmissions:tailAdmissions)).set(owned,Object.freeze({manifestSha256:manifestRead.fact.sha256,sourceRevision:manifest.custody.sourceObservation.revision,...collectionFields(tail)}));return owned;
}

/** Explicit cross-platform authored controls only. No CLI selects this boundary.
 * It exercises actual local FS/esbuild using tiny fake reviewed-platform files.
 * Every prepared value is branded and production APIs reject its facts/ledgers. */
export function createStock033AuthoredControlV2(){
 const createLedger=options=>{const ledger=createStock033PreparationLedgerV2(options);authoredLedgers.add(ledger);return ledger;};
 return Object.freeze({createStock033PreparationLedgerV2:createLedger,prepareActualStock033V2:options=>prepareCore(options,true),verifyStock033PreparationV2:(root,template,reference,{ledger=createLedger()}={})=>verifyCore(root,template,reference,ledger,true)});
}

export async function verifyStock033Tail500PreparationV2(root,template,reference,{ledger=createStock033PreparationLedgerV2()}={}){return verifyCore(root,template,reference,ledger,false,true);}
function inspectTailAdmission(owned,authored){const result=(authored?authoredTailAdmissions:tailAdmissions).get(owned);if(!result)fail('tail admission');return result;}
export function inspectStock033Tail500PreparationV2(owned){return inspectTailAdmission(owned,false);}
export function createStock033AuthoredControlV2Tail500(){const createLedger=options=>{const ledger=createStock033PreparationLedgerV2(options);authoredLedgers.add(ledger);return ledger;};return Object.freeze({createStock033PreparationLedgerV2:createLedger,prepareActualStock033V2Tail500:options=>prepareCore(options,true,true),verifyStock033Tail500PreparationV2:(root,template,reference,{ledger=createLedger()}={})=>verifyCore(root,template,reference,ledger,true,true),inspectStock033Tail500PreparationV2:owned=>inspectTailAdmission(owned,true)});}

export async function prepareActualStock033V2WheelCarrierTail500(options){return prepareCore(options,false,wheelFamily);}
export async function verifyStock033WheelCarrierTail500PreparationV2(root,template,reference,{ledger=createStock033PreparationLedgerV2()}={}){return verifyCore(root,template,reference,ledger,false,wheelFamily);}
function inspectWheelAdmission(owned,authored){const result=(authored?authoredWheelAdmissions:wheelAdmissions).get(owned);if(!result)fail('wheel admission');return result;}
export function inspectStock033WheelCarrierTail500PreparationV2(owned){return inspectWheelAdmission(owned,false);}
export function createStock033AuthoredControlV2WheelCarrierTail500(){const createLedger=options=>{const ledger=createStock033PreparationLedgerV2(options);authoredLedgers.add(ledger);return ledger;};return Object.freeze({createStock033PreparationLedgerV2:createLedger,prepareActualStock033V2WheelCarrierTail500:options=>prepareCore(options,true,wheelFamily),verifyStock033WheelCarrierTail500PreparationV2:(root,template,reference,{ledger=createLedger()}={})=>verifyCore(root,template,reference,ledger,true,wheelFamily),inspectStock033WheelCarrierTail500PreparationV2:owned=>inspectWheelAdmission(owned,true)});}
