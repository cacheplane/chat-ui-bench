// Fixed child boundary. Request source paths are equality facts, never import authority.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeSemanticLargeSnapshotV3} from './aimock-trace-decoder-v3.mjs';
import {isSemanticLargeProfileStockVersionV3,SEMANTIC_LARGE_V3_POLICY as P, SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';

const SOURCE_NAMES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
const SOURCE_PATHS=SOURCE_NAMES.map(n=>'tools/competitor-comparison/'+n);
const hash=b=>createHash('sha256').update(b).digest('hex');
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const decimal=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v);
const fail=code=>{throw Error('timeline-child-'+code);};
const need=(v,code)=>{if(!v)fail(code);};
function keys(v,ks,code){need(v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k)),code);}
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}

// Lexical duplicate-key pass; JSON.parse remains the sole grammar/value parser.
// This handles escaped aliases without parsing the embedded trace event ledger.
function parse(bytes,code){
 try{
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),stack=[];let i=0;
  while(i<text.length){const c=text[i];
   if(c==='"'){
    const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')break;}
    const parent=stack.at(-1);if(parent?.key){const key=JSON.parse(text.slice(start,i));need(!parent.keys.has(key),code);parent.keys.add(key);parent.key=false;}
   }else if(c==='{'){stack.push({keys:new Set(),key:true});i++;}
   else if(c==='['){stack.push({key:false});i++;}
   else if(c==='}'||c===']'){stack.pop();i++;}
   else if(c===','){const p=stack.at(-1);if(p?.keys)p.key=true;i++;}else i++;
  }
  const value=JSON.parse(text);const pending=[value];while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),code);else if(v&&typeof v==='object')pending.push(...Object.values(v));}return value;
 }catch{fail(code);}
}
function request(b){
 keys(b,['identity','policySha256','artifactRoot','rootIdentity','caseParentIdentity','rawReference','decoderSources'],'request');
 const id=b.identity;keys(id,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256'],'request');
 for(const k of ['id','profile','journey'])need(typeof id[k]==='string'&&Buffer.byteLength(id[k])>0&&Buffer.byteLength(id[k])<=256,'request');
 need(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id.id)&&integer(id.historyCount)&&integer(id.responseBytes)&&digest(id.buildSha256)&&isSemanticLargeProfileStockVersionV3(id.profile,id.stockVersion),'request');
 need(b.policySha256===POLICY_SHA&&typeof b.artifactRoot==='string'&&path.isAbsolute(b.artifactRoot)&&!b.artifactRoot.includes('\0')&&Buffer.byteLength(b.artifactRoot)<=4096&&path.resolve(b.artifactRoot)===b.artifactRoot,'request');
 for(const p of [b.rootIdentity,b.caseParentIdentity]){keys(p,['dev','ino'],'request');need(decimal(p.dev)&&decimal(p.ino),'request');}
 const r=b.rawReference;keys(r,['path','bytes','sha256'],'request');need(r.path===id.id+'/'+P.storage.rawFilename&&r.path.length<=257&&integer(r.bytes)&&r.bytes<=P.capture.wrapperBytes&&digest(r.sha256),'request');
 const s=b.decoderSources;keys(s,['nodeExecutableSha256','files'],'sources');need(digest(s.nodeExecutableSha256)&&Array.isArray(s.files)&&s.files.length===SOURCE_PATHS.length,'sources');
 for(let i=0;i<SOURCE_PATHS.length;i++){keys(s.files[i],['path','sha256'],'sources');need(s.files[i].path===SOURCE_PATHS[i]&&digest(s.files[i].sha256),'sources');}
 return b;
}
const identity=(a,b)=>String(a.dev)===String(b.dev)&&String(a.ino)===String(b.ino);
const metadata=(a,b)=>identity(a,b)&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs&&a.nlink===b.nlink;
const statOptions={bigint:true};
async function checkedPath(b){
 const root=b.artifactRoot,parent=path.join(root,b.identity.id);
 for(const [name,pin]of [[root,b.rootIdentity],[parent,b.caseParentIdentity]]){const s=await fs.lstat(name,statOptions);need(s.isDirectory()&&!s.isSymbolicLink()&&identity(s,pin)&&await fs.realpath(name)===name,'raw-read');}
 return path.join(root,b.rawReference.path);
}
async function named(b,s){
 const file=await checkedPath(b),n=await fs.lstat(file,statOptions);
 need(n.isFile()&&!n.isSymbolicLink()&&n.nlink===1n&&metadata(n,s)&&await fs.realpath(file)===file,'raw-read');
}
// Adapted from old checkedPath/verifyNamedFile/readVerifiedJSON: fixed current
// case/basename/cap, request bigint pins, nanosecond metadata, strict wrapper JSON.
async function readRaw(b){
 let bytes;
 try{
  const file=await checkedPath(b),h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);let accepted;
  try{
   const before=await h.stat(statOptions);need(before.isFile()&&before.nlink===1n&&before.size===BigInt(b.rawReference.bytes)&&before.size<=BigInt(P.capture.wrapperBytes),'raw-read');await named(b,before);
   const buffer=Buffer.alloc(b.rawReference.bytes+1);let count=0;
   while(count<buffer.length){const {bytesRead}=await h.read(buffer,count,Math.min(P.capture.chunkBytes,buffer.length-count),count);if(!bytesRead)break;count+=bytesRead;}
   const after=await h.stat(statOptions);need(count===b.rawReference.bytes&&metadata(before,after),'raw-read');bytes=buffer.subarray(0,count);need(hash(bytes)===b.rawReference.sha256,'raw-read');await named(b,after);accepted=after;
  }finally{await h.close();}
  await named(b,accepted);
 }catch{fail('raw-read');}
 return parse(bytes,'raw-json');
}
async function sourceFile(file,expected){
 const resolved=await fs.realpath(file),before=await fs.lstat(resolved,statOptions);need(before.isFile()&&!before.isSymbolicLink(),'sources');
 const h=await fs.open(resolved,constants.O_RDONLY|constants.O_NOFOLLOW);let after;
 try{const opened=await h.stat(statOptions);need(metadata(before,opened),'sources');need(hash(await h.readFile())===expected,'sources');after=await h.stat(statOptions);need(metadata(before,after),'sources');}finally{await h.close();}
 need(await fs.realpath(file)===resolved&&metadata(after,await fs.lstat(resolved,statOptions)),'sources');return {resolved,stat:after};
}
async function sources(b,original=null){
 try{
  const files=[process.execPath,...SOURCE_NAMES.map(n=>fileURLToPath(new URL('./'+n,import.meta.url)))],expected=[b.decoderSources.nodeExecutableSha256,...b.decoderSources.files.map(f=>f.sha256)],facts=[];
  for(let i=0;i<files.length;i++){const f=await sourceFile(files[i],expected[i]);if(original)need(f.resolved===original[i].resolved&&metadata(f.stat,original[i].stat),'sources');facts.push(f);}return facts;
 }catch{fail('sources');}
}
function invalid(reason,b){return {schema:P.schemas.decoded,status:'invalid',reason,identity:null,policySha256:POLICY_SHA,rawReference:b.rawReference,compressedBytes:null,compressedSha256:null,decodedBytes:null,decodedSha256:null,traceEventCount:null,metadataEventCount:null,emittedCategories:null,rendererMapping:null,costs:null,...P.flags};}
async function decode(b){
 try{
  const bookend=await sources(b),raw=await readRaw(b);need(raw!==null&&typeof raw==='object'&&!Array.isArray(raw)&&same(raw.identity,b.identity)&&raw.policySha256===b.policySha256,'raw-join');
  const result=decodeSemanticLargeSnapshotV3(raw);await sources(b,bookend);return {...result,rawReference:b.rawReference};
 }catch(e){const reason=e?.message;return invalid(['sources','raw-read','raw-json','raw-join'].map(c=>'timeline-child-'+c).includes(reason)?reason:'timeline-child-internal',b);}
}
async function main(){
 let state='request',token=null,body=null,total=0,output=0,failed=false,chunk=[];
 const abort=()=>{if(failed)return;failed=true;process.exitCode=1;process.stdin.destroy();process.stdout.end();process.stderr.end();};
 process.stdin.on('error',abort);process.stdout.on('error',abort);process.stderr.on('error',abort);
 process.stdout.on('finish',()=>{if(state!=='done')abort();});
 process.stdout.on('close',()=>{if(state!=='done')abort();});
 async function write(type,value){
  need(!failed,'output');const bytes=Buffer.from(JSON.stringify({schema:P.schemas.message,type,token,body:value})+'\n');need(output+bytes.length<=P.decoder.stdoutBytes,'output');output+=bytes.length;
  await new Promise((resolve,reject)=>{
   let callback=false,drained=true,returned=false;
   const finish=()=>{if(returned&&callback&&drained){cleanup();resolve();}};
   const error=()=>{cleanup();reject(Error('timeline-child-output'));},drain=()=>{drained=true;finish();};
   const cleanup=()=>{process.stdout.off('error',error);process.stdout.off('finish',error);process.stdout.off('close',error);process.stdout.off('drain',drain);};
   process.stdout.once('error',error);process.stdout.once('finish',error);process.stdout.once('close',error);process.stdout.once('drain',drain);
   drained=process.stdout.write(bytes,e=>{if(e){error();return;}callback=true;finish();});returned=true;finish();
  });need(!failed,'output');
 }
 function accept(bytes){
  const f=parse(bytes,'frame');keys(f,['schema','type','token','body'],'frame');need(f.schema===P.schemas.message&&typeof f.token==='string'&&/^[0-9a-f]{32}$/.test(f.token),'frame');
  if(state==='request'){
   need(f.type==='request','order');body=request(f.body);token=f.token;state='writing-ready';
   write('ready',{pid:process.pid}).then(()=>{state='decode-ack';},abort);
  }else if(state==='decode-ack'){
   need(f.type==='decode-ack'&&f.token===token,'order');keys(f.body,[],'frame');state='decoding';
   decode(body).then(r=>write('result-ready',r)).then(()=>{state='exit-ack';},abort);
  }else if(state==='exit-ack'){
   need(f.type==='exit-ack'&&f.token===token,'order');keys(f.body,[],'frame');state='eof';
  }else fail('order');
 }
 process.stdin.on('readable',()=>{
  try{
   while(!failed){const size=Math.min(P.decoder.pipeChunkBytes,P.decoder.requestAckBytes-total+1,process.stdin.readableLength);if(!size)break;const data=process.stdin.read(size);if(data===null)break;total+=data.length;need(total<=P.decoder.requestAckBytes,'input-cap');
    for(const byte of data){need(!['writing-ready','decoding','eof','done'].includes(state),'order');if(byte===10){need(chunk.length>0,'frame');const frame=Buffer.from(chunk);chunk=[];accept(frame);}else chunk.push(byte);}
   }
  }catch{abort();}
 });
 process.stdin.on('end',()=>{if(failed)return;if(state!=='eof'||chunk.length){abort();return;}state='done';process.stdout.end();process.stderr.end();});
 process.stdin.on('close',()=>{if(!failed&&state!=='done')abort();});
}
// Inert on import; no exported harness, arguments, environment or alternate entry.
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.exitCode=1;});
