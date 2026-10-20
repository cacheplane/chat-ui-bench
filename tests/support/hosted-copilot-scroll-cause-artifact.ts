import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {constants,createWriteStream} from 'node:fs';
import {open,lstat,realpath,opendir,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {deflateRawSync} from 'node:zlib';
import {diagnosticNeed as need} from './hosted-copilot-scroll-cause-refusal.ts';
/** Separate unqualified diagnostic namespace. Never used by normal inventories. */
export const SCROLL_CAUSE_ROLE_CAPS=Object.freeze({
 'diagnostic-profile.json':16384,'tracker-a-profile.json':16384,
 'diagnostic-source.json':262144,'diagnostic-build.json':1048576,'diagnostic-transform.json':262144,
 'diagnostic-frontend-inventory.json':524288,'diagnostic-module-pins.json':1048576,
 'diagnostic-frontend.zip':33554432,'diagnostic-worker.mjs':16777216,
 'diagnostic-browser-registry.json':262144,'diagnostic-browser-process.json':16384,
 'parent-started.json':16384,'parent-result.json':16384,'parent.stdout':4194304,'parent.stderr':4194304,
 'application-started.json':16384,'application-result.json':16384,'application.stdout':262144,'application.stderr':262144,
 'browser-stdout.bin':262144,'browser-stderr.bin':262144,
 'native-case-1.json':2097152,'native-case-2.json':2097152,
 'diagnostic-strict-result.json':524288,'tracker-a-case-2-input.json':262144,'tracker-a-case-2-transport.json':1048576,
 'tracker-a-case-2-trace.json':33554432,'diagnostic-first-failure.json':4096,
 'scroll-cause-ledger.json':1048576,'scroll-cause-export.json':16384,'diagnostic-manifest.json':524288,
});
export type DiagnosticRole=keyof typeof SCROLL_CAUSE_ROLE_CAPS;
export const SCROLL_CAUSE_OPTIONAL_REASONS=Object.freeze({
 'browser-stdout.bin':'stdio-not-exposed','browser-stderr.bin':'stdio-not-exposed',
 'native-case-1.json':'case-not-produced','native-case-2.json':'case-not-produced',
 'tracker-a-case-2-input.json':'input-not-produced','tracker-a-case-2-transport.json':'transport-not-produced',
 'tracker-a-case-2-trace.json':'raw-not-created','diagnostic-first-failure.json':'first-failure-none',
 'scroll-cause-ledger.json':'ledger-unavailable','scroll-cause-export.json':'export-not-created',
});
export const SCROLL_CAUSE_MANDATORY_ROLES=Object.freeze((Object.keys(SCROLL_CAUSE_ROLE_CAPS) as DiagnosticRole[]).filter(path=>!Object.hasOwn(SCROLL_CAUSE_OPTIONAL_REASONS,path)));
export function assertDiagnosticBudget(bytes:number,files:number):void{
 if(!Number.isSafeInteger(bytes)||bytes<0||bytes>134217728||!Number.isSafeInteger(files)||files<0||files>128)throw Error('diagnostic-budget');
}
export const diagnosticHash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const statIdentity=(s:{dev:number|bigint;ino:number|bigint;mode:number|bigint;nlink:number|bigint;size:number|bigint;mtimeMs:number|bigint;ctimeMs:number|bigint;mtimeNs?:bigint;ctimeNs?:bigint})=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs??s.mtimeMs,s.ctimeNs??s.ctimeMs].map(String);
async function boundedFileRead(handle:Awaited<ReturnType<typeof open>>,size:number){
 const raw=Buffer.alloc(size+1);let read=0;while(read<raw.length){const result=await handle.read(raw,read,raw.length-read,read);if(result.bytesRead===0)break;read+=result.bytesRead;need(read<=size,'diagnostic-file-grew');}need(read===size,'diagnostic-file-size');return raw.subarray(0,read);
}
async function canonicalDirectory(directory:string){
 need(resolve(directory)===directory&&await realpath(directory)===directory,'diagnostic-directory');
 let path='/';for(const part of directory.split('/').filter(Boolean)){path=join(path,part);const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink(),'diagnostic-directory');}
 return statIdentity(await lstat(directory,{bigint:true}));
}
export async function readDiagnosticPhysical(path:string,cap:number){
 need(resolve(path)===path&&await realpath(path)===path,'diagnostic-physical-path');await canonicalDirectory(resolve(path,'..'));const before=await lstat(path,{bigint:true});
 need(before.isFile()&&before.nlink===1n&&before.size<=BigInt(cap),'diagnostic-physical');const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{need(JSON.stringify(statIdentity(await handle.stat({bigint:true})))===JSON.stringify(statIdentity(before)),'diagnostic-file-changed');const raw=await boundedFileRead(handle,Number(before.size));need(BigInt(raw.length)===before.size&&JSON.stringify(statIdentity(await handle.stat({bigint:true})))===JSON.stringify(statIdentity(before))&&JSON.stringify(statIdentity(await lstat(path,{bigint:true})))===JSON.stringify(statIdentity(before)),'diagnostic-file-changed');return {bytes:raw.length,sha256:diagnosticHash(raw),identity:statIdentity(before),raw};}finally{await handle.close();}
}
/** Complete non-ZIP64 archive; every member is an authenticated original asset. */
export async function packDiagnosticFrontend(root:string,files:readonly {path:string;bytes:number;sha256:string}[]){
 need(files.length>0&&files.length<=1025,'diagnostic-zip-count');const owner=await canonicalDirectory(root),names=new Set<string>(),locals:Buffer[]=[],central:Buffer[]=[];let offset=0,total=0;
 const crc=(raw:Buffer)=>{let n=0xffffffff;for(const byte of raw){n^=byte;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
 for(const file of files){need(typeof file.path==='string'&&/^[A-Za-z0-9_./-]+$/.test(file.path)&&!file.path.startsWith('/')&&!file.path.split('/').some(p=>!p||p==='.'||p==='..')&&!names.has(file.path),'diagnostic-zip-path');names.add(file.path);
  const original=await readDiagnosticPhysical(join(root,file.path),16777216);need(original.bytes===file.bytes&&original.sha256===file.sha256,'diagnostic-zip-source');total+=original.bytes;need(total<=67108864,'diagnostic-zip-expanded');
  const name=Buffer.from(file.path),compressed=deflateRawSync(original.raw),sum=crc(original.raw),local=Buffer.alloc(30),directory=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(sum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(original.bytes,22);local.writeUInt16LE(name.length,26);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);directory.writeUInt32LE(sum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(original.bytes,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
  locals.push(local,name,compressed);central.push(directory,name);offset+=local.length+name.length+compressed.length;need(offset<=33554432,'diagnostic-zip-cap');
  const after=await readDiagnosticPhysical(join(root,file.path),16777216);need(JSON.stringify(after.identity)===JSON.stringify(original.identity)&&after.sha256===original.sha256,'diagnostic-zip-source-changed');
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 need(offset+directory.length+22<=33554432&&JSON.stringify(await canonicalDirectory(root))===JSON.stringify(owner),'diagnostic-zip-cap');return Buffer.concat([...locals,directory,end]);
}
export async function readDiagnosticRole(directory:string,name:DiagnosticRole){
 need(Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,name),'diagnostic-role');const owner=await canonicalDirectory(directory),path=join(directory,name),before=await lstat(path,{bigint:true});
 need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1n&&before.size<=BigInt(SCROLL_CAUSE_ROLE_CAPS[name]),'diagnostic-physical');
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);let raw:Buffer;
 try{need(JSON.stringify(statIdentity(await handle.stat({bigint:true})))===JSON.stringify(statIdentity(before)),'diagnostic-file-changed');raw=await boundedFileRead(handle,Number(before.size));need(BigInt(raw.length)===before.size&&JSON.stringify(statIdentity(await handle.stat({bigint:true})))===JSON.stringify(statIdentity(before)),'diagnostic-file-changed');}finally{await handle.close();}
 need(JSON.stringify(statIdentity(await lstat(path,{bigint:true})))===JSON.stringify(statIdentity(before))&&JSON.stringify(await canonicalDirectory(directory))===JSON.stringify(owner),'diagnostic-file-changed');
 return {path:name,bytes:raw.length,sha256:diagnosticHash(raw),identity:statIdentity(before),raw};
}
export async function revalidateDiagnosticRole(directory:string,fact:Awaited<ReturnType<typeof readDiagnosticRole>>){
 const now=await readDiagnosticRole(directory,fact.path);need(now.bytes===fact.bytes&&now.sha256===fact.sha256&&JSON.stringify(now.identity)===JSON.stringify(fact.identity),'diagnostic-file-changed');return now;
}
export async function writeDiagnosticRole(directory:string,name:DiagnosticRole,raw:Uint8Array){
 need(Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,name)&&raw.byteLength<=SCROLL_CAUSE_ROLE_CAPS[name],'diagnostic-role-cap');const owner=await canonicalDirectory(directory);
 const handle=await open(join(directory,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{await handle.writeFile(raw);await handle.sync();}finally{await handle.close();}
 const after=await canonicalDirectory(directory);need(after[0]===owner[0]&&after[1]===owner[1]&&after[2]===owner[2],'diagnostic-directory-changed');return readDiagnosticRole(directory,name);
}
export async function writeDiagnosticJson(directory:string,name:DiagnosticRole,value:unknown){return writeDiagnosticRole(directory,name,Buffer.from(JSON.stringify(value)+'\n'));}
export function cleanDiagnosticEnvironment(extra:Readonly<Record<string,string>>={}){
 const env:Record<string,string>={PATH:'/usr/bin:/bin',COPILOTKIT_TELEMETRY_DISABLED:'true',DO_NOT_TRACK:'1'};
 for(const name of ['HOME','TMPDIR','PLAYWRIGHT_BROWSERS_PATH','GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','GITHUB_REF','GITHUB_WORKFLOW_REF','GITHUB_WORKFLOW_SHA','RUNNER_OS','RUNNER_TEMP'])if(process.env[name]!==undefined)env[name]=process.env[name]!;
 for(const [name,value] of Object.entries(extra)){need(name.startsWith('SCROLL_CAUSE_'),'diagnostic-environment');env[name]=value;}
 return env;
}
export function diagnosticRecord(value:unknown,keys:readonly string[]):Record<string,unknown>{
 need(typeof value==='object'&&value!==null&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'diagnostic-record');
 const descriptors=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(descriptors).length===keys.length,'diagnostic-keys');
 const result:Record<string,unknown>=Object.create(null);
 for(const key of keys){const d=descriptors[key];need(d&&'value'in d&&d.enumerable,'diagnostic-data');result[key]=d.value;}
 return result;
}
/** Independent publisher admission: only closed own data, never a foreign getter or Proxy. */
export function assertDiagnosticPostCaptureDrain(value:unknown):void{
 need(!types.isProxy(value),'diagnostic-postcapture-drain');
 const r=diagnosticRecord(value,['schemaVersion','eligibility','reason','original','waiter','outcome','requestedHostMs','targetHostMs','settledHostMs']);
 need(r.schemaVersion===1&&['eligible','ineligible'].includes(r.eligibility as string)&&['eligible','no-measured-failure','continuation-not-started','completion-attempted','capture-incomplete','pending-original','cleanup-rejected','cleanup-timeout','deadline','admission-closed'].includes(r.reason as string)&&['not-started','pending','fulfilled','rejected'].includes(r.original as string)&&['not-started','fulfilled','rejected','timed-out'].includes(r.waiter as string)&&['ineligible','pending','fulfilled','rejected','timed-out'].includes(r.outcome as string),'diagnostic-postcapture-drain');
 for(const key of ['requestedHostMs','targetHostMs','settledHostMs'])need(r[key]===null||typeof r[key]==='number'&&Number.isFinite(r[key])&&Number(r[key])>=0,'diagnostic-postcapture-drain');
 need((r.eligibility==='eligible')===(r.reason==='eligible')&&!(r.eligibility==='ineligible'&&r.original!=='not-started')&&!(r.outcome==='fulfilled'&&(r.original!=='fulfilled'||r.waiter!=='fulfilled'||r.eligibility!=='eligible'))&&!(r.outcome==='rejected'&&(r.original!=='rejected'||r.waiter!=='rejected'||r.eligibility!=='eligible'))&&!(r.outcome==='timed-out'&&r.waiter!=='timed-out')&&!(r.outcome==='ineligible'&&r.eligibility!=='ineligible')&&!(r.original!=='not-started'&&(r.requestedHostMs===null||r.targetHostMs===null))&&!(['fulfilled','rejected'].includes(r.original as string)&&r.settledHostMs===null)&&!(['not-started','pending'].includes(r.original as string)&&r.settledHostMs!==null)&&!(r.requestedHostMs!==null&&r.targetHostMs!==null&&Number(r.requestedHostMs)>=Number(r.targetHostMs))&&!(r.settledHostMs!==null&&r.requestedHostMs!==null&&Number(r.settledHostMs)<Number(r.requestedHostMs)),'diagnostic-postcapture-drain');
 need((r.waiter==='fulfilled')===(r.outcome==='fulfilled')&&(r.waiter==='timed-out')===(r.outcome==='timed-out')&&!(r.eligibility==='eligible'&&r.original==='not-started')&&!(r.eligibility==='ineligible'&&(r.waiter==='rejected'?r.reason!=='cleanup-rejected':r.waiter==='timed-out'?r.reason!=='cleanup-timeout':r.waiter!=='not-started'))&&!(r.outcome==='pending'&&r.waiter!=='not-started'),'diagnostic-postcapture-drain');
 need(!(r.reason==='cleanup-timeout'&&(r.waiter!=='timed-out'||r.outcome!=='timed-out'))&&!(r.reason==='cleanup-rejected'&&(r.waiter!=='rejected'||r.outcome!=='ineligible')),'diagnostic-postcapture-drain');
 need((r.requestedHostMs===null)===(r.targetHostMs===null)&&!(['cleanup-timeout','cleanup-rejected'].includes(r.reason as string)&&r.requestedHostMs===null)&&!(['no-measured-failure','continuation-not-started','capture-incomplete','pending-original','deadline'].includes(r.reason as string)&&r.requestedHostMs!==null)&&!(r.outcome==='fulfilled'&&Number(r.settledHostMs)>=Number(r.targetHostMs)),'diagnostic-postcapture-drain');
 need(r.original!=='pending'&&!['pending','rejected','timed-out'].includes(r.outcome as string),'diagnostic-postcapture-drain-unsettled');
}
/** Bounded data parser; duplicate keys never disappear through JSON.parse. */
export function parseDiagnosticJson(raw:Uint8Array):unknown{
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);let cursor=0,nodes=0;
 const space=()=>{while(cursor<text.length&&/[\t\r\n ]/.test(text[cursor]!))cursor++;};
 const string=()=>{const start=cursor++;let closed=false;while(cursor<text.length){const c=text[cursor++]!;if(c==='\\'){cursor++;continue;}if(c==='"'){closed=true;break;}}need(closed,'diagnostic-json-string');const value=JSON.parse(text.slice(start,cursor)) as unknown;need(typeof value==='string'&&value.length<=65536,'diagnostic-json-string');return value;};
 function value(depth:number):unknown{
  need(depth<=32&&++nodes<=262144,'diagnostic-json-work');space();const c=text[cursor];
  if(c==='"')return string();
  if(c==='{'){
   cursor++;space();const out:Record<string,unknown>=Object.create(null);if(text[cursor]==='}'){cursor++;return out;}
   while(true){space();need(text[cursor]==='"','diagnostic-json-key');const key=string();need(!Object.hasOwn(out,key),'diagnostic-json-duplicate');space();need(text[cursor++]===':','diagnostic-json-colon');out[key]=value(depth+1);space();const separator=text[cursor++];if(separator==='}')return out;need(separator===',','diagnostic-json-object');}
  }
  if(c==='['){cursor++;space();const out:unknown[]=[];if(text[cursor]===']'){cursor++;return out;}while(true){need(out.length<8192,'diagnostic-json-array');out.push(value(depth+1));space();const separator=text[cursor++];if(separator===']')return out;need(separator===',','diagnostic-json-array');}}
  for(const [literal,result] of [['true',true],['false',false],['null',null]] as const)if(text.startsWith(literal,cursor)){cursor+=literal.length;return result;}
  const number=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(cursor));need(number&&number[0].length<=128,'diagnostic-json-number');cursor+=number[0].length;const result=Number(number[0]);need(Number.isFinite(result)&&(!Number.isInteger(result)||Number.isSafeInteger(result)),'diagnostic-json-number');return result;
 }
 const result=value(1);space();need(cursor===text.length,'diagnostic-json-trailing');return result;
}
export const diagnosticRef=(fact:{path:string;bytes:number;sha256:string})=>({path:fact.path,bytes:fact.bytes,sha256:fact.sha256});
const FOOTER='SCROLL_CAUSE_CHILD_PUBLICATION_V1 ';
function footerData(value:unknown){
 const r=diagnosticRecord(value,['protocol','source','run','rawTrace','strictResultRef']),raw=diagnosticRecord(r.rawTrace,['created','closed']),ref=diagnosticRecord(r.strictResultRef,['path','bytes','sha256']);
 need(r.protocol==='scroll-cause-child-publication-v1'&&typeof r.source==='string'&&/^[a-f0-9]{40}$/.test(r.source)&&typeof r.run==='string'&&/^[1-9][0-9]{0,19}$/.test(r.run),'diagnostic-footer-context');
 need(typeof raw.created==='boolean'&&typeof raw.closed==='boolean'&&(raw.created||!raw.closed),'diagnostic-footer-raw');
 need(ref.path==='diagnostic-strict-result.json'&&Number.isSafeInteger(ref.bytes)&&Number(ref.bytes)>=1&&Number(ref.bytes)<=524288&&typeof ref.sha256==='string'&&/^[a-f0-9]{64}$/.test(ref.sha256),'diagnostic-footer-ref');
 return {protocol:r.protocol,source:r.source,run:r.run,rawTrace:{created:raw.created,closed:raw.closed},strictResultRef:{path:ref.path,bytes:ref.bytes,sha256:ref.sha256}};
}
export function encodeDiagnosticFooter(value:unknown){const line='\n'+FOOTER+JSON.stringify(footerData(value))+'\n';need(Buffer.byteLength(line)<=2048,'diagnostic-footer-cap');return line;}
export function parseDiagnosticFooter(raw:Buffer,expected:{source:string;run:string;strictResultRef:{path:string;bytes:number;sha256:string}}){
 need(raw.length<=262144,'diagnostic-footer-stdout-cap');const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),lines=text.split('\n').filter(line=>line.startsWith(FOOTER));
 need(lines.length===1&&text.endsWith(lines[0]!+'\n')&&Buffer.byteLength(lines[0]!)<=2047,'diagnostic-footer-missing-or-duplicate');
 const result=footerData(parseDiagnosticJson(Buffer.from(lines[0]!.slice(FOOTER.length))));
 need(result.source===expected.source&&result.run===expected.run&&JSON.stringify(result.strictResultRef)===JSON.stringify(expected.strictResultRef),'diagnostic-footer-join');
 return {...result,stdoutRef:{path:'application.stdout',bytes:raw.length,sha256:diagnosticHash(raw)}};
}
export function diagnosticAbsentRoles(present:ReadonlySet<string>,publicationAbsence:unknown,browserValue:unknown,rawTrace:unknown){
 for(const path of present)need(Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,path),'diagnostic-extra-role');
 for(const path of SCROLL_CAUSE_MANDATORY_ROLES)need(present.has(path),'diagnostic-mandatory-role');
 need(Array.isArray(publicationAbsence)&&publicationAbsence.length<=8,'diagnostic-absence');
 const claims=new Map<string,string>();
 for(const value of publicationAbsence){const row=diagnosticRecord(value,['path','reason']);need(typeof row.path==='string'&&typeof row.reason==='string'&&Object.hasOwn(SCROLL_CAUSE_OPTIONAL_REASONS,row.path)&&!row.path.startsWith('browser-')&&row.path!=='tracker-a-case-2-trace.json'&&!claims.has(row.path)&&SCROLL_CAUSE_OPTIONAL_REASONS[row.path as keyof typeof SCROLL_CAUSE_OPTIONAL_REASONS]===row.reason,'diagnostic-absence-claim');claims.set(row.path,row.reason);}
 const raw=diagnosticRecord(rawTrace,['created','closed']);need(typeof raw.created==='boolean'&&typeof raw.closed==='boolean','diagnostic-raw-witness');
 if(raw.created)need(raw.closed===true&&present.has('tracker-a-case-2-trace.json'),'diagnostic-raw-open');else{need(raw.closed===false&&!present.has('tracker-a-case-2-trace.json'),'diagnostic-raw-inconsistent');claims.set('tracker-a-case-2-trace.json','raw-not-created');}
 const browser=diagnosticRecord(browserValue,['stdio']);need(Array.isArray(browser.stdio)&&browser.stdio.length<=7,'diagnostic-stdio');
 const indexes=new Set<number>();
 for(const value of browser.stdio){need(typeof value==='object'&&value!==null,'diagnostic-stdio');const ds=Object.getOwnPropertyDescriptors(value);const get=(name:string)=>{const d=ds[name];need(d&&'value'in d,'diagnostic-stdio');return d.value as unknown;};
  const index=get('index'),kind=get('kind');need(Number.isSafeInteger(index)&&Number(index)>=1&&Number(index)<=7&&!indexes.has(Number(index)),'diagnostic-stdio');indexes.add(Number(index));
  need(kind===(index===1?'stdout':index===2?'stderr':'protocol')&&get('attached')===true&&get('status')==='fulfilled','diagnostic-stdio-open');
 }
 for(const [index,path] of [[1,'browser-stdout.bin'],[2,'browser-stderr.bin']] as const){if(indexes.has(index))need(present.has(path),'diagnostic-stdio-missing');else{need(!present.has(path),'diagnostic-stdio-unclaimed');claims.set(path,'stdio-not-exposed');}}
 const absent:{path:string;reason:string}[]=[];
 for(const path of Object.keys(SCROLL_CAUSE_ROLE_CAPS)){
  if(Object.hasOwn(SCROLL_CAUSE_OPTIONAL_REASONS,path)){if(present.has(path))need(!claims.has(path),'diagnostic-present-absent');else{const reason=claims.get(path);need(reason,'diagnostic-unwitnessed-absence');absent.push({path,reason});}}
 }
 return absent;
}
export function assertDiagnosticCommandClosure(startedValue:unknown,resultValue:unknown,files:Readonly<{stdout:{bytes:number};stderr:{bytes:number}}>,expectedArgv:readonly string[]):void{
 const started=diagnosticRecord(startedValue,['argv','qualification','originalClosed','startedUtc']);
 const result=diagnosticRecord(resultValue,['argv','spawned','spawnError','exitObserved','exit','closeObserved','close','timedOut','terminationRequested','streams','streamsComplete','descendantClosure','qualification']);
 need(JSON.stringify(started.argv)===JSON.stringify(expectedArgv)&&JSON.stringify(result.argv)===JSON.stringify(expectedArgv)&&started.qualification===false&&started.originalClosed===false&&typeof started.startedUtc==='string'&&/^[\x20-\x7e]{1,32}$/.test(started.startedUtc),'diagnostic-command-owner');
 need(result.qualification===false&&result.descendantClosure==='unqualified'&&result.spawned===true&&result.spawnError===false&&result.exitObserved===true&&result.closeObserved===true&&result.streamsComplete===true&&typeof result.timedOut==='boolean'&&typeof result.terminationRequested==='boolean','diagnostic-command-open');
 const exit=diagnosticRecord(result.exit,['exitCode','signal']),close=diagnosticRecord(result.close,['exitCode','signal']);
 need(JSON.stringify(exit)===JSON.stringify(close)&&((Number.isSafeInteger(exit.exitCode)&&Number(exit.exitCode)>=0&&Number(exit.exitCode)<=255&&exit.signal===null)||(exit.exitCode===null&&['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGBUS','SIGILL','SIGQUIT','SIGHUP'].includes(exit.signal as string))),'diagnostic-command-exit');
 const streams=diagnosticRecord(result.streams,['stdout','stderr']);
 for(const name of ['stdout','stderr'] as const){const s=diagnosticRecord(streams[name],['readableEOF','writerFinish','writerClose','writerError','overflow','seen','retained']);need(s.readableEOF===true&&s.writerFinish===true&&s.writerClose===true&&s.writerError===false&&s.overflow===false&&Number.isSafeInteger(s.seen)&&s.seen===s.retained&&s.retained===files[name].bytes,'diagnostic-stream-open');}
}
export async function captureDiagnosticCommand(directory:string,name:'parent'|'application',argv:readonly string[],deadlineMs:number,extra:Readonly<Record<string,string>>={}){
 need((name==='parent'||name==='application')&&argv.length>=1&&argv.every(x=>typeof x==='string'&&x.length<=4096)&&Number.isSafeInteger(deadlineMs)&&deadlineMs>=1&&deadlineMs<=300000,'diagnostic-command');
 await writeDiagnosticJson(directory,`${name}-started.json`,{argv,qualification:false,originalClosed:false,startedUtc:new Date().toISOString()});
 const child=spawn(argv[0]!,argv.slice(1),{cwd:process.cwd(),env:cleanDiagnosticEnvironment(extra),stdio:['ignore','pipe','pipe']});
 let spawned=false,spawnError:false|'spawn-refused'=false,exit:{exitCode:number|null;signal:string|null}|null=null,timedOut=false,terminationRequested=false;
 child.once('spawn',()=>{spawned=true;});child.once('error',()=>{spawnError='spawn-refused';});child.once('exit',(exitCode,signal)=>{exit={exitCode,signal};});
 let killTimer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>{if(!terminationRequested){terminationRequested=true;child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),3000);}};
 const timer=setTimeout(()=>{timedOut=true;stop();},deadlineMs);
 function pipe(stream:NodeJS.ReadableStream,kind:'stdout'|'stderr'){
  const cap=SCROLL_CAUSE_ROLE_CAPS[`${name}.${kind}`],sink=createWriteStream(join(directory,`${name}.${kind}`),{flags:'wx',mode:0o600,flush:true});
  const facts={readableEOF:false,writerFinish:false,writerClose:false,writerError:false,overflow:false,seen:0,retained:0};
  const closed=new Promise<void>(done=>{sink.once('finish',()=>{facts.writerFinish=true;});sink.once('close',()=>{facts.writerClose=true;done();});});
  sink.on('error',()=>{facts.writerError=true;stream.resume();stop();});
  stream.on('data',(chunk:Buffer)=>{facts.seen+=chunk.length;if(facts.seen>cap){facts.overflow=true;stop();}const retained=chunk.subarray(0,Math.max(0,cap-facts.retained));if(!facts.writerError){facts.retained+=retained.length;if(retained.length&&!sink.write(retained)){stream.pause();sink.once('drain',()=>stream.resume());}}});
  stream.once('end',()=>{facts.readableEOF=true;sink.end();});stream.once('error',()=>{facts.writerError=true;sink.end();});stream.once('close',()=>{if(!facts.readableEOF){facts.writerError=true;sink.end();}});
  return {facts,closed};
 }
 const stdout=pipe(child.stdout,'stdout'),stderr=pipe(child.stderr,'stderr');
 const close=await new Promise<{exitCode:number|null;signal:string|null}>(done=>child.once('close',(exitCode,signal)=>done({exitCode,signal})));
 clearTimeout(timer);if(killTimer)clearTimeout(killTimer);await Promise.all([stdout.closed,stderr.closed]);
 const streams={stdout:stdout.facts,stderr:stderr.facts},streamsComplete=Object.values(streams).every(s=>s.readableEOF&&s.writerFinish&&s.writerClose&&!s.writerError&&!s.overflow&&s.seen===s.retained);
 const result={argv,spawned,spawnError,exitObserved:exit!==null,exit,closeObserved:true,close,timedOut,terminationRequested,streams,streamsComplete,descendantClosure:'unqualified',qualification:false};
 await writeDiagnosticJson(directory,`${name}-result.json`,result);return result;
}

export interface DiagnosticPublicationContext {source:{commitSha:string;treeSha:string;lockSha256:string};run:{repository:string;runId:string;attempt:number;tag:string};parentArgv:readonly string[];childArgv:readonly string[];launchWorker:string}
type RoleFact=Awaited<ReturnType<typeof readDiagnosticRole>>;
async function diagnosticCensus(directory:string){
 const owner=await canonicalDirectory(directory),names:string[]=[];const entries=await opendir(directory);
 try{for await(const entry of entries){need(names.length<31&&Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,entry.name)&&entry.isFile()&&!entry.isSymbolicLink(),'diagnostic-namespace');names.push(entry.name);}}finally{await entries.close().catch(()=>{});}
 const facts=new Map<DiagnosticRole,RoleFact>();for(const name of Object.keys(SCROLL_CAUSE_ROLE_CAPS) as DiagnosticRole[])if(names.includes(name))facts.set(name,await readDiagnosticRole(directory,name));
 need(JSON.stringify(owner)===JSON.stringify(await canonicalDirectory(directory)),'diagnostic-namespace-changed');return {facts,owner};
}
const object=(v:unknown):Record<string,unknown>=>{need(v!==null&&typeof v==='object'&&!Array.isArray(v),'diagnostic-object');return v as Record<string,unknown>;};
async function inspectDiagnosticPublication(directory:string,context:DiagnosticPublicationContext,withManifest:boolean){
 const census=await diagnosticCensus(directory),facts=census.facts;
 need(facts.has('diagnostic-manifest.json')===withManifest,'diagnostic-manifest-state');
 const present=new Set<string>([...facts.keys(),'diagnostic-manifest.json']);
 const fact=(path:DiagnosticRole)=>{const f=facts.get(path);need(f,'diagnostic-required-ref');return f;};
 const data=(path:DiagnosticRole)=>object(parseDiagnosticJson(fact(path).raw));
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const ref=(path:DiagnosticRole)=>diagnosticRef(fact(path));
 const joinRef=(value:unknown,path:DiagnosticRole)=>need(same(diagnosticRecord(value,['path','bytes','sha256']),ref(path)),'diagnostic-reference-join');
 const recipe=data('diagnostic-profile.json'),source=data('diagnostic-source.json'),build=data('diagnostic-build.json'),tracker=data('tracker-a-profile.json');
 for(const row of [recipe,source,build,tracker])need(same(row.source,context.source)&&same(row.run,context.run)&&row.qualification===false,'diagnostic-context-join');
 need(build.profilePath==='diagnostic-profile.json'&&build.profileSha256===fact('diagnostic-profile.json').sha256,'diagnostic-build-recipe');joinRef(tracker.recipeRef,'diagnostic-profile.json');joinRef(tracker.buildRef,'diagnostic-build.json');
 const launch=await readDiagnosticPhysical(context.launchWorker,16777216),worker=object(build.worker),copy=fact('diagnostic-worker.mjs');
 need(worker.launchPath===context.launchWorker&&worker.bytes===launch.bytes&&worker.sha256===launch.sha256&&copy.bytes===launch.bytes&&copy.sha256===launch.sha256,'diagnostic-worker-copy');
 for(const [name,argv] of [['parent',context.parentArgv],['application',context.childArgv]] as const)assertDiagnosticCommandClosure(data(`${name}-started.json`),data(`${name}-result.json`),{stdout:fact(`${name}.stdout`),stderr:fact(`${name}.stderr`)},argv);
 const strict=data('diagnostic-strict-result.json');
 diagnosticRecord(strict,['schemaVersion','kind','profileRef','strict','caseEvidence','originals','browserVersion','anchorDiagnostic','postCaptureDrain','publicationAbsence','attributionCoverage','qualification','nativeGO','performance','fps']);
 need(strict.schemaVersion===1&&strict.kind==='unqualified-scroll-cause-strict-result'&&strict.qualification===false&&strict.nativeGO===false&&strict.performance===false&&strict.fps==='unavailable','diagnostic-strict-authority');joinRef(strict.profileRef,'tracker-a-profile.json');
 assertDiagnosticPostCaptureDrain(strict.postCaptureDrain);
 const originalStrict=diagnosticRecord(strict.strict,['status','hasPrimary','firstFailure','cleanupFailureCount']);need(['complete','incomplete'].includes(originalStrict.status as string)&&typeof originalStrict.hasPrimary==='boolean'&&Number.isSafeInteger(originalStrict.cleanupFailureCount)&&Number(originalStrict.cleanupFailureCount)>=0,'diagnostic-strict-shape');
 const expectedExit=originalStrict.status==='complete'&&originalStrict.hasPrimary===false?0:2;
 for(const name of ['parent','application'] as const){const commandResult=data(`${name}-result.json`),exit=object(commandResult.exit);need(commandResult.timedOut===false&&commandResult.terminationRequested===false&&exit.exitCode===expectedExit&&exit.signal===null,'diagnostic-infrastructure-exit');}
 need(Array.isArray(strict.originals)&&strict.originals.length===3,'diagnostic-client-closure');for(const [i,label] of ['browserConnect','clientClose','clientDisconnected'].entries()){const w=diagnosticRecord(strict.originals[i],['label','status']);need(w.label===label&&w.status==='fulfilled','diagnostic-client-open');}
 need(Array.isArray(strict.caseEvidence)&&strict.caseEvidence.length<=2,'diagnostic-case-closure');for(const item of strict.caseEvidence){const row=object(item);need(Array.isArray(row.originals)&&row.originals.length===19&&row.originals.every(v=>{const w=object(v);return ['fulfilled','rejected','unavailable'].includes(w.status as string);}),'diagnostic-case-open');}
 const browser=data('diagnostic-browser-process.json');need(browser.coverage==='post-bind-only'&&browser.binaryByteIdentity==='unestablished'&&browser.descendants==='unqualified'&&browser.closePromise==='fulfilled'&&browser.closeEvent==='fulfilled'&&browser.qualification===false,'diagnostic-browser-open');
 const footer=parseDiagnosticFooter(fact('application.stdout').raw,{source:context.source.commitSha,run:context.run.runId,strictResultRef:ref('diagnostic-strict-result.json')});need(same(browser.childPublication,footer),'diagnostic-child-publication');
 const absence=diagnosticAbsentRoles(present,strict.publicationAbsence,{stdio:browser.stdio},footer.rawTrace);
 if(Array.isArray(browser.stdio))for(const item of browser.stdio){const row=object(item);if(row.index===1||row.index===2){const f=fact(row.index===1?'browser-stdout.bin':'browser-stderr.bin');need(row.readableEOF===true&&row.writerFinish===true&&row.writerClose===true&&row.writerError===false&&row.overflow===false&&row.seen===row.retained&&row.retained===f.bytes,'diagnostic-browser-stream-open');}}
 if(footer.rawTrace.created){const transport=data('tracker-a-case-2-transport.json'),sink=object(transport.sink),raw=object(transport.raw);need(sink.created===true&&sink.finish==='fulfilled'&&sink.fsync==='fulfilled'&&sink.fileClose==='fulfilled','diagnostic-trace-writer-open');joinRef(raw.ref,'tracker-a-case-2-trace.json');need(Array.isArray(transport.operations)&&transport.operations.every(v=>object(v).status!=='pending'),'diagnostic-transport-pending');}
 const noPending=(v:unknown,depth=1):void=>{need(depth<=32,'diagnostic-pending-work');if(v===null||typeof v!=='object')return;if(Array.isArray(v)){for(const child of v)noPending(child,depth+1);return;}const row=object(v);need(row.status!=='pending','diagnostic-original-pending');for(const child of Object.values(row))noPending(child,depth+1);};
 if(facts.has('tracker-a-case-2-input.json')){const input=data('tracker-a-case-2-input.json');joinRef(input.profileRef,'tracker-a-profile.json');noPending(input);}
 if(facts.has('tracker-a-case-2-transport.json')){const transport=data('tracker-a-case-2-transport.json');joinRef(transport.profileRef,'tracker-a-profile.json');need(object(transport.sink).created===footer.rawTrace.created,'diagnostic-raw-original-join');if(!footer.rawTrace.created){const raw=object(transport.raw);need(raw.status==='absent'&&raw.ref===null,'diagnostic-raw-absence-join');}noPending(transport);}
 const coverage=object(strict.attributionCoverage);if(coverage.originals!==undefined)need(object(coverage.originals).inputDrain!=='pending','diagnostic-input-drain-pending');
 const exported=data('scroll-cause-export.json');need(exported.status!=='pending'&&exported.failure!=='closure-unavailable','diagnostic-export-pending');
 if(strict.anchorDiagnostic!==null){const anchor=diagnosticRecord(strict.anchorDiagnostic,['selection','observations']),selection=object(anchor.selection),snapshot=diagnosticRecord(selection.snapshotRef,['path','index']);need(snapshot.path==='native-case-2.json'&&Number.isSafeInteger(snapshot.index)&&Number(snapshot.index)>=0,'diagnostic-anchor-ref');const cases=data('native-case-2.json');need(Array.isArray(cases.snapshots),'diagnostic-anchor-case');const shot=object(cases.snapshots[Number(snapshot.index)]);need(shot.status==='available','diagnostic-anchor-unavailable');const evaluation=object(shot.evaluation),frame=object(shot.frame);need(Array.isArray(evaluation.rows),'diagnostic-anchor-rows');const matches=evaluation.rows.filter(v=>object(v).id===selection.id);need(matches.length===1&&['id','role','ownerToken','contentTopCssPx','relativeTopCssPx'].every(k=>object(matches[0])[k]===selection[k])&&object(frame.nativeViewport).y===selection.nativeViewportY,'diagnostic-anchor-owner');}
 if(facts.has('diagnostic-first-failure.json')){const first=data('diagnostic-first-failure.json');need(first.kind==='unqualified-scroll-cause-first-failure'&&same(first.source,context.source)&&same(first.run,context.run)&&same(first.firstFailure,originalStrict.firstFailure),'diagnostic-first-failure');joinRef(first.diagnosticStrictResultRef,'diagnostic-strict-result.json');}
 // Authenticate only literal persisted references, never normal admission replay.
 let visited=0;const walk=(v:unknown,depth:number)=>{need(++visited<=262144&&depth<=32,'diagnostic-reference-work');if(v===null||typeof v!=='object')return;if(Array.isArray(v)){for(const child of v)walk(child,depth+1);return;}for(const [key,child] of Object.entries(v)){if((key.endsWith('Ref')||key==='ref')&&child!==null&&typeof child==='object'&&Object.hasOwn(child,'sha256')){const r=diagnosticRecord(child,['path','bytes','sha256']);need(typeof r.path==='string'&&Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,r.path),'diagnostic-reference-role');joinRef(child,r.path as DiagnosticRole);}else walk(child,depth+1);}};
 for(const [path,f] of facts)if(path.endsWith('.json')&&path!=='diagnostic-manifest.json'&&path!=='tracker-a-case-2-trace.json')walk(parseDiagnosticJson(f.raw),1);
 const files=[...facts.values()].filter(f=>f.path!=='diagnostic-manifest.json').map(diagnosticRef),bytesBeforeManifest=files.reduce((sum,f)=>sum+f.bytes,0);assertDiagnosticBudget(bytesBeforeManifest+launch.bytes+SCROLL_CAUSE_ROLE_CAPS['diagnostic-manifest.json'],files.length+2);
 const manifest={schemaVersion:1,kind:'unqualified-scroll-cause-manifest',source:context.source,run:context.run,profileRef:ref('diagnostic-profile.json'),trackerProfileRef:ref('tracker-a-profile.json'),buildRef:ref('diagnostic-build.json'),strictResultRef:ref('diagnostic-strict-result.json'),ledgerRef:facts.has('scroll-cause-ledger.json')?ref('scroll-cause-ledger.json'):null,exportRef:ref('scroll-cause-export.json'),files,absent:absence,bytesBeforeManifest,writerClosure:{commands:'original-exit-close-and-streams',browser:'original-close-promise-event-and-attached-streams',rawTrace:footer.rawTrace,outerRun:'workflow-sequenced-after-run',descendants:'unqualified'},coverage:strict.attributionCoverage,qualification:false,nativeGO:false,performance:false,fps:'unavailable'};
 for(const f of facts.values())await revalidateDiagnosticRole(directory,f);const final=await diagnosticCensus(directory);need(JSON.stringify([...final.facts.keys()])===JSON.stringify([...facts.keys()])&&JSON.stringify(final.owner)===JSON.stringify(census.owner),'diagnostic-final-namespace');
 const finalWorker=await readDiagnosticPhysical(context.launchWorker,16777216);need(finalWorker.sha256===launch.sha256&&JSON.stringify(finalWorker.identity)===JSON.stringify(launch.identity),'diagnostic-launch-worker-changed');return {manifest,facts};
}
/** A later action after outer run; physically existing manifest alone grants nothing. */
export async function publishDiagnosticInventory(directory:string,context:DiagnosticPublicationContext,writeManifest:(directory:string,name:'diagnostic-manifest.json',value:unknown)=>Promise<unknown>=writeDiagnosticJson){
 const inspected=await inspectDiagnosticPublication(directory,context,false);await writeManifest(directory,'diagnostic-manifest.json',inspected.manifest);return verifyDiagnosticInventory(directory,context);
}
export async function verifyDiagnosticInventory(directory:string,context:DiagnosticPublicationContext){
 const inspected=await inspectDiagnosticPublication(directory,context,true),original=inspected.facts.get('diagnostic-manifest.json')!;need(JSON.stringify(parseDiagnosticJson(original.raw))===JSON.stringify(inspected.manifest),'diagnostic-manifest-join');await revalidateDiagnosticRole(directory,original);return inspected.manifest;
}

/** Separate fixed command-only namespace; none of these checks admits payloads. */
export const SCROLL_CAUSE_FORENSIC_ROLES=Object.freeze(['parent-started.json','parent-result.json','parent.stdout','parent.stderr','application-started.json','application-result.json','application.stdout','application.stderr'] as const);
const FORENSIC_MANIFEST='forensic-manifest.json',FORENSIC_MANIFEST_CAP=16384;
export const SCROLL_CAUSE_FORENSIC_RESERVATION=Object.freeze({bytes:Object.values(SCROLL_CAUSE_ROLE_CAPS).reduce((sum,cap)=>sum+cap,0)+16777216+SCROLL_CAUSE_FORENSIC_ROLES.reduce((sum,path)=>sum+SCROLL_CAUSE_ROLE_CAPS[path],0)+FORENSIC_MANIFEST_CAP,files:Object.keys(SCROLL_CAUSE_ROLE_CAPS).length+1+SCROLL_CAUSE_FORENSIC_ROLES.length+1});
type ForensicContext=Omit<DiagnosticPublicationContext,'launchWorker'>;
function commandForensicContext(context:ForensicContext){
 const source=diagnosticRecord(context.source,['commitSha','treeSha','lockSha256']),run=diagnosticRecord(context.run,['repository','runId','attempt','tag']);
 need(typeof source.commitSha==='string'&&/^[a-f0-9]{40}$/.test(source.commitSha)&&typeof source.treeSha==='string'&&/^[a-f0-9]{40}$/.test(source.treeSha)&&typeof source.lockSha256==='string'&&/^[a-f0-9]{64}$/.test(source.lockSha256)&&run.repository==='cacheplane/chat-ui-bench'&&typeof run.runId==='string'&&/^[1-9][0-9]{0,19}$/.test(run.runId)&&run.attempt===1&&run.tag==='hosted-copilot-react-scroll-cause-v3','diagnostic-context-join');
 const argv=(value:readonly string[])=>{need(Array.isArray(value)&&value.length>=1&&value.length<=8&&Reflect.ownKeys(value).length===value.length+1,'diagnostic-command-owner');const copied:string[]=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));need(d&&'value'in d&&typeof d.value==='string'&&d.value.length<=4096,'diagnostic-command-owner');copied.push(d.value);}need(Buffer.byteLength(JSON.stringify(copied))<=8192,'diagnostic-command-owner');return copied;};
 return {source,run,parentArgv:argv(context.parentArgv),childArgv:argv(context.childArgv)};
}
async function forensicOriginalCensus(directory:string){
 const owner=await canonicalDirectory(directory),rows:{path:string;identity:string[]}[]=[];const handle=await opendir(directory);
 try{for await(const entry of handle){need(rows.length<31&&Object.hasOwn(SCROLL_CAUSE_ROLE_CAPS,entry.name),'diagnostic-namespace');const path=entry.name as DiagnosticRole,s=await lstat(join(directory,path),{bigint:true});need(s.isFile()&&!s.isSymbolicLink()&&s.size<=BigInt(SCROLL_CAUSE_ROLE_CAPS[path]),'diagnostic-physical');rows.push({path,identity:statIdentity(s)});}}finally{await handle.close().catch(()=>{});}
 rows.sort((a,b)=>a.path.localeCompare(b.path));need(JSON.stringify(owner)===JSON.stringify(await canonicalDirectory(directory)),'diagnostic-namespace-changed');
 return {entries:rows.length,sha256:diagnosticHash(JSON.stringify({owner,rows})),coverage:'metadata-only; unselected roles not admitted'};
}
async function forensicOriginals(directory:string,context:ForensicContext){
 const checked=commandForensicContext(context),namespace=await forensicOriginalCensus(directory),files=new Map<string,RoleFact>();
 assertDiagnosticBudget(SCROLL_CAUSE_FORENSIC_RESERVATION.bytes,SCROLL_CAUSE_FORENSIC_RESERVATION.files);
 for(const path of SCROLL_CAUSE_FORENSIC_ROLES)files.set(path,await readDiagnosticRole(directory,path));
 const get=(path:string)=>{const f=files.get(path);need(f,'diagnostic-required-ref');return f;};
 const outcomes:Record<string,unknown>={};
 for(const [name,argv] of [['parent',checked.parentArgv],['application',checked.childArgv]] as const){const started=parseDiagnosticJson(get(`${name}-started.json`).raw),result=parseDiagnosticJson(get(`${name}-result.json`).raw);assertDiagnosticCommandClosure(started,result,{stdout:get(`${name}.stdout`),stderr:get(`${name}.stderr`)},argv);const r=object(result);outcomes[name]={exit:r.exit,close:r.close,timedOut:r.timedOut,terminationRequested:r.terminationRequested};}
 need(JSON.stringify(namespace)===JSON.stringify(await forensicOriginalCensus(directory)),'diagnostic-namespace-changed');return {checked,namespace,files,outcomes};
}
async function forensicStageCensus(stage:string,withManifest:boolean){
 const owner=await canonicalDirectory(stage),names:string[]=[];const handle=await opendir(stage);
 try{for await(const entry of handle){need(names.length<9&&entry.isFile()&&!entry.isSymbolicLink()&&(SCROLL_CAUSE_FORENSIC_ROLES.some(path=>path===entry.name)||(withManifest&&entry.name===FORENSIC_MANIFEST)),'diagnostic-namespace');names.push(entry.name);}}finally{await handle.close().catch(()=>{});}
 need(names.length===8+Number(withManifest)&&SCROLL_CAUSE_FORENSIC_ROLES.every(path=>names.includes(path))&&names.includes(FORENSIC_MANIFEST)===withManifest,'diagnostic-namespace');need(JSON.stringify(owner)===JSON.stringify(await canonicalDirectory(stage)),'diagnostic-namespace-changed');return owner.slice(0,3);
}
function forensicManifest(originals:Awaited<ReturnType<typeof forensicOriginals>>,copies:Map<string,RoleFact>,stageIdentity:string[]){
 return {schemaVersion:1,kind:'unqualified-scroll-cause-command-forensics',source:originals.checked.source,run:originals.checked.run,profile:{release:'hosted-copilot-react-scroll-cause-v3',scope:'closed-parent-application-commands-only'},parentArgv:originals.checked.parentArgv,childArgv:originals.checked.childArgv,files:SCROLL_CAUSE_FORENSIC_ROLES.map(path=>{const original=originals.files.get(path)!,copy=copies.get(path)!;return {...diagnosticRef(original),originalIdentity:original.identity,copyIdentity:copy.identity};}),originalNamespace:originals.namespace,stageIdentity,outcomes:originals.outcomes,reservation:SCROLL_CAUSE_FORENSIC_RESERVATION,diagnosticArtifactAdmission:'not-established',browserClosure:'unestablished',rawTraceClosure:'unestablished',descendants:'unqualified',qualification:false,nativeGO:false,performance:false,fps:'unavailable'};
}
/** Fresh sibling only. A diagnostic inventory failure cannot block this action. */
export async function admitScrollCauseCommandForensics(directory:string,stage:string,context:ForensicContext,writeManifest:(stage:string,raw:Buffer)=>Promise<unknown>=async(stage,raw)=>{
 const handle=await open(join(stage,FORENSIC_MANIFEST),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await handle.writeFile(raw);await handle.sync();}finally{await handle.close();}
}){
 need(resolve(directory)===directory&&resolve(stage)===stage&&directory!==stage&&dirname(directory)===dirname(stage),'diagnostic-directory');await canonicalDirectory(dirname(directory));const originals=await forensicOriginals(directory,context);await mkdir(stage,{mode:0o700});await canonicalDirectory(stage);
 const copies=new Map<string,RoleFact>();for(const path of SCROLL_CAUSE_FORENSIC_ROLES){const original=originals.files.get(path)!;await revalidateDiagnosticRole(directory,original);const copied=await writeDiagnosticRole(stage,path,original.raw);need(copied.bytes===original.bytes&&copied.sha256===original.sha256,'diagnostic-reference-join');copies.set(path,copied);await revalidateDiagnosticRole(directory,original);}
 const stageIdentity=await forensicStageCensus(stage,false);for(const f of originals.files.values())await revalidateDiagnosticRole(directory,f);need(JSON.stringify(originals.namespace)===JSON.stringify(await forensicOriginalCensus(directory)),'diagnostic-namespace-changed');
 const manifest=forensicManifest(originals,copies,stageIdentity),raw=Buffer.from(JSON.stringify(manifest)+'\n');need(raw.length<=FORENSIC_MANIFEST_CAP,'diagnostic-role-cap');await writeManifest(stage,raw);return verifyScrollCauseCommandForensics(directory,stage,context);
}
/** Reauthenticate originals, copies and manifest; no admitted-object trust. */
export async function verifyScrollCauseCommandForensics(directory:string,stage:string,context:ForensicContext){
 need(resolve(directory)===directory&&resolve(stage)===stage&&directory!==stage&&dirname(directory)===dirname(stage),'diagnostic-directory');const originals=await forensicOriginals(directory,context),stageIdentity=await forensicStageCensus(stage,true),copies=new Map<string,RoleFact>();
 for(const path of SCROLL_CAUSE_FORENSIC_ROLES){const copy=await readDiagnosticRole(stage,path),original=originals.files.get(path)!;need(copy.bytes===original.bytes&&copy.sha256===original.sha256,'diagnostic-reference-join');copies.set(path,copy);}
 const manifest=await readDiagnosticPhysical(join(stage,FORENSIC_MANIFEST),FORENSIC_MANIFEST_CAP),expected=forensicManifest(originals,copies,stageIdentity);need(JSON.stringify(parseDiagnosticJson(manifest.raw))===JSON.stringify(expected),'diagnostic-manifest-join');
 for(const f of originals.files.values())await revalidateDiagnosticRole(directory,f);for(const f of copies.values())await revalidateDiagnosticRole(stage,f);need(JSON.stringify(originals.namespace)===JSON.stringify(await forensicOriginalCensus(directory))&&JSON.stringify(stageIdentity)===JSON.stringify(await forensicStageCensus(stage,true)),'diagnostic-namespace-changed');const final=await readDiagnosticPhysical(join(stage,FORENSIC_MANIFEST),FORENSIC_MANIFEST_CAP);need(final.sha256===manifest.sha256&&JSON.stringify(final.identity)===JSON.stringify(manifest.identity),'diagnostic-file-changed');return expected;
}
