// Fixed source-bound owner. No executable, clock, OS, cap or policy ports.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {isSemanticLargeProfileStockVersionV3,SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';

const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const need=(v,c)=>{if(!v)throw Error('timeline-owner-'+c);};
function keys(v,ks,c){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,c);const names=Reflect.ownKeys(v);need(names.length===ks.length&&ks.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&d.enumerable;}),c);}
function validateIdentity(v){keys(v,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256'],'arguments');for(const k of ['id','profile','journey'])need(typeof v[k]==='string'&&Buffer.byteLength(v[k])>0&&Buffer.byteLength(v[k])<=256,'arguments');need(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v.id)&&isSemanticLargeProfileStockVersionV3(v.profile,v.stockVersion)&&integer(v.historyCount)&&integer(v.responseBytes)&&digest(v.buildSha256),'arguments');}
const SOURCE_NAMES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
const REASONS=new Set(['preflight','deadline','sources','platform','reservation','space','request','spawn','protocol','result','pipe','process','rss','cleanup','originals-bound','publication','publication-unsettled','internal'].map(c=>'timeline-owner-'+c));
const CHILD_REASONS=new Set(['buffer-ledger','buffer-usage','capture-facts','decoder-arguments','decompressed-cap','event-category','fields','gzip-utf8-or-json-invalid','identity','inventory','json-duplicate-key','own-data','owner-clock','owner-facts','payload-base64','payload-integrity','phase-clock','raw-bound','raw-header','receipt-bound','required-metadata','result-bound','support-facts','trace-event','trace-json','trace-process','trace-time','child-input-cap','child-frame','child-order','child-request','child-sources','child-raw-read','child-raw-json','child-raw-join','child-output','child-internal'].map(c=>'timeline-'+c));
const sha=b=>createHash('sha256').update(b).digest('hex');
const code=e=>REASONS.has(e?.message)?e.message:'timeline-owner-internal';
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
// Strict boundary parsing. The embedded compressed event ledger is never parsed here.
function parse(bytes){
 try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),stack=[];let i=0;
  while(i<text.length){const c=text[i];if(c==='"'){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')break;}const p=stack.at(-1);if(p?.key){const k=JSON.parse(text.slice(start,i));need(!p.keys.has(k),'protocol');p.keys.add(k);p.key=false;}}
   else if(c==='{'){stack.push({keys:new Set(),key:true});i++;}else if(c==='['){stack.push({key:false});i++;}else if(c==='}'||c===']'){stack.pop();i++;}else if(c===','){if(stack.at(-1)?.keys)stack.at(-1).key=true;i++;}else i++;}
  const v=JSON.parse(text),pending=[v];let n=0;while(pending.length){need(++n<=100000,'protocol');const x=pending.pop();if(typeof x==='number')need(Number.isFinite(x),'protocol');else if(x&&typeof x==='object')pending.push(...Object.values(x));}return v;
 }catch{throw Error('timeline-owner-protocol');}
}
function preview(v){keys(v,['text','trueCharacters','truncated'],'result');need(typeof v.text==='string'&&integer(v.trueCharacters)&&v.text.length===Math.min(64,v.trueCharacters)&&v.truncated===(v.trueCharacters>64),'result');}
function binding(v,count){keys(v,['frameId','nestedProcessId','pid','tid','frameEventIndex','frameRecordIndex','threadEventIndex'],'result');need(typeof v.frameId==='string'&&v.frameId.length>0&&v.frameId.length<=128&&[v.pid,v.tid,v.nestedProcessId].every(x=>integer(x)&&x>0)&&v.nestedProcessId===v.pid&&[v.frameEventIndex,v.threadEventIndex].every(x=>integer(x)&&x<count)&&integer(v.frameRecordIndex),'result');}
function witnesses(v,frame,count){
 keys(v,['totalCount','distinctIdentities','duplicateCount','first8','latest','retainedCount','droppedCount','truncated'],'result');need([v.totalCount,v.distinctIdentities,v.duplicateCount,v.retainedCount,v.droppedCount].every(integer)&&v.distinctIdentities<=v.totalCount&&v.duplicateCount===v.totalCount-v.distinctIdentities&&Array.isArray(v.first8)&&v.first8.length===Math.min(v.totalCount,8)&&v.retainedCount===Math.min(v.totalCount,8)+(v.totalCount>8?1:0)&&v.droppedCount===v.totalCount-v.retainedCount&&v.truncated===(v.totalCount>v.retainedCount),'result');
 const rows=[...v.first8,...(v.latest===null?[]:[v.latest])];need((v.totalCount===0)===(v.latest===null),'result');for(const r of rows){keys(r,frame?['eventIndex','frameRecordIndex','frameId','nestedProcessId']:['eventIndex','pid','tid'],'result');need(integer(r.eventIndex)&&r.eventIndex<count,'result');if(frame)need(integer(r.frameRecordIndex)&&typeof r.frameId==='string'&&r.frameId.length>0&&r.frameId.length<=128&&integer(r.nestedProcessId)&&r.nestedProcessId>0,'result');else need(integer(r.pid)&&r.pid>0&&integer(r.tid)&&r.tid>0,'result');}if(v.totalCount&&v.totalCount<=8)need(same(v.latest,v.first8.at(-1)),'result');
 // Mapper visits each thread event once, but can visit many frame records in it.
 if(!frame)need(v.totalCount<=count,'result');let previous=null;
 for(const r of [...v.first8,...(v.totalCount>8?[v.latest]:[])]){need(!previous||r.eventIndex>previous.eventIndex||(frame&&r.eventIndex===previous.eventIndex&&r.frameRecordIndex>previous.frameRecordIndex),'result');previous=r;}
}
function mapping(v,count){
 keys(v,['schema','status','reason','binding','frameWitnesses','threadWitnesses','foreignFrameCount','foreignRendererMainCount','malformedRelevantCount','performance','scoringEligibility','FPS'],'result');need(v.schema==='aimock-trace-renderer-v1'&&v.performance===false&&v.scoringEligibility===false&&v.FPS===null&&[v.foreignFrameCount,v.foreignRendererMainCount,v.malformedRelevantCount].every(integer),'result');witnesses(v.frameWitnesses,true,count);witnesses(v.threadWitnesses,false,count);
 if(v.status==='available'){need(v.reason===null&&v.frameWitnesses.distinctIdentities===1&&v.threadWitnesses.distinctIdentities===1&&v.malformedRelevantCount===0,'result');binding(v.binding,count);const f=v.frameWitnesses.first8[0],t=v.threadWitnesses.first8[0];need(f&&t&&f.nestedProcessId===v.binding.pid&&f.frameId===v.binding.frameId&&f.eventIndex===v.binding.frameEventIndex&&f.frameRecordIndex===v.binding.frameRecordIndex&&t.pid===v.binding.pid&&t.tid===v.binding.tid&&t.eventIndex===v.binding.threadEventIndex,'result');}
 else {const reason=v.malformedRelevantCount?'malformed-relevant-metadata':v.frameWitnesses.distinctIdentities>1?'conflicting-owned-frame-processes':v.frameWitnesses.distinctIdentities===0?'owned-frame-missing':v.threadWitnesses.distinctIdentities>1?'conflicting-renderer-main-threads':v.threadWitnesses.distinctIdentities===0?'owned-renderer-main-missing':null;need(v.status==='unavailable'&&v.binding===null&&reason!==null&&v.reason===reason,'result');}
 if(v.status==='available'){for(const f of [...v.frameWitnesses.first8,v.frameWitnesses.latest])need(f.nestedProcessId===v.binding.pid&&f.frameId===v.binding.frameId,'result');for(const t of [...v.threadWitnesses.first8,v.threadWitnesses.latest])need(t.pid===v.binding.pid&&t.tid===v.binding.tid,'result');}
 const frameEvents=new Set([...v.frameWitnesses.first8,...(v.frameWitnesses.latest?[v.frameWitnesses.latest]:[])].map(r=>r.eventIndex));for(const t of [...v.threadWitnesses.first8,...(v.threadWitnesses.latest?[v.threadWitnesses.latest]:[])])need(!frameEvents.has(t.eventIndex),'result');
}
function costs(v,m,count){
 const base=['schema','status','reason','performance','scoringEligibility','FPS','cpuTime','presentationCoverage'];
 keys(v,v.status==='available'?[...base,'scope','clock','binding','tasks','layouts','minorGC','limitations']:base,'result');need(v.schema==='aimock-owned-renderer-costs-v1'&&v.performance===false&&v.scoringEligibility===false&&v.FPS===null&&v.cpuTime===null&&v.presentationCoverage==='unverified','result');
 if(v.status==='unavailable'){need(['aimock-trace-owned-renderer-unavailable','aimock-trace-owned-event-category-unrecognized','aimock-trace-owned-event-time-invalid','aimock-trace-no-owned-complete-tasks'].includes(v.reason),'result');return;}
 need(v.status==='available'&&m.status==='available'&&same(v.binding,m.binding)&&v.reason===null&&v.scope==='whole-capture-observed-complete-X-events'&&v.clock==='trace-timeTicks-microseconds'&&same(v.limitations,['not-a-complete-task-population','not-a-streaming-only-window','wall-duration-is-not-CPU-time','nested-and-overlapping-classes-not-additive','headless-conformance-is-not-display-presentation']),'result');
 const occupied=new Set([...m.frameWitnesses.first8,...m.threadWitnesses.first8,m.frameWitnesses.latest,m.threadWitnesses.latest].map(r=>r.eventIndex));
 for(const k of ['tasks','layouts','minorGC']){const p=v[k];keys(p,k==='tasks'?['observedCompleteEvents','longTaskEvents','longest']:['observedCompleteEvents','longest'],'result');need(integer(p.observedCompleteEvents)&&p.observedCompleteEvents<=count&&Array.isArray(p.longest)&&p.longest.length===Math.min(p.observedCompleteEvents,8),'result');if(k==='tasks')need(p.observedCompleteEvents>0&&integer(p.longTaskEvents)&&p.longTaskEvents<=p.observedCompleteEvents,'result');let previous=null;const seen=new Set();for(const row of p.longest){keys(row,['eventIndex','timestampUs','durationUs'],'result');need(integer(row.eventIndex)&&row.eventIndex<count&&!seen.has(row.eventIndex)&&!occupied.has(row.eventIndex)&&finite(row.timestampUs)&&finite(row.durationUs)&&row.timestampUs+row.durationUs<=Number.MAX_SAFE_INTEGER&&(!previous||previous.durationUs>row.durationUs||(previous.durationUs===row.durationUs&&previous.eventIndex<row.eventIndex)),'result');previous=row;seen.add(row.eventIndex);occupied.add(row.eventIndex);}if(k==='tasks'){const retainedLong=p.longest.filter(r=>r.durationUs>=50000).length;need(p.longTaskEvents>=retainedLong&&(p.observedCompleteEvents>8||p.longTaskEvents===retainedLong),'result');}}
 need(v.tasks.observedCompleteEvents+v.layouts.observedCompleteEvents+v.minorGC.observedCompleteEvents<=count,'result');
}
function validateResult(v,id,ref){
 keys(v,['schema','status','reason','identity','policySha256','rawReference','compressedBytes','compressedSha256','decodedBytes','decodedSha256','traceEventCount','metadataEventCount','emittedCategories','rendererMapping','costs',...Object.keys(P.flags)],'result');need(v.schema===P.schemas.decoded&&v.policySha256===POLICY_SHA&&same(v.rawReference,ref)&&Object.keys(P.flags).every(k=>v[k]===P.flags[k]),'result');
 const fields=['identity','compressedBytes','compressedSha256','decodedBytes','decodedSha256','traceEventCount','metadataEventCount','emittedCategories','rendererMapping','costs'];
 if(v.status==='invalid'){need(CHILD_REASONS.has(v.reason)&&fields.every(k=>v[k]===null),'result');return v;}
 need(v.status==='valid'&&v.reason===null&&same(v.identity,id)&&integer(v.compressedBytes)&&v.compressedBytes<=4194304&&integer(v.decodedBytes)&&v.decodedBytes<=67108864&&digest(v.compressedSha256)&&digest(v.decodedSha256)&&integer(v.traceEventCount)&&integer(v.metadataEventCount)&&v.metadataEventCount>0&&v.metadataEventCount<=v.traceEventCount,'result');
 const e=v.emittedCategories;keys(e,['count','sha256','first16','truncated','requested'],'result');need(integer(e.count)&&digest(e.sha256)&&Array.isArray(e.first16)&&e.first16.length===Math.min(e.count,16),'result');e.first16.forEach(preview);need(e.truncated===(e.count>16||e.first16.some(p=>p.truncated))&&Array.isArray(e.requested)&&e.requested.length===P.config.traceConfig.includedCategories.length,'result');
 for(let i=0;i<e.requested.length;i++){const r=e.requested[i];keys(r,['category','observed','meaning'],'result');need(r.category===P.config.traceConfig.includedCategories[i]&&typeof r.observed==='boolean'&&r.meaning===(r.observed?'actual-event-category-token':'not-observed-in-this-trace; support-unknown'),'result');}
 if(!e.truncated){const names=e.first16.map(p=>p.text);need(same(names,[...new Set(names)].sort())&&sha(JSON.stringify(names))===e.sha256&&e.requested.every(r=>r.observed===names.includes(r.category)),'result');}
 mapping(v.rendererMapping,v.traceEventCount);costs(v.costs,v.rendererMapping,v.traceEventCount);return v;
}
function parseRss(bytes,pid,parentPid,start){
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('timeline-owner-rss');}
 const m=/^[ \t]*([0-9]+)[ \t]+([0-9]+)[ \t]+([0-9]+)[ \t]+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (?: [1-9]|[12][0-9]|3[01]) (?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9] [0-9]{4})[ \t]*\n?$/.exec(text);
 need(m&&Number(m[1])===pid&&Number(m[2])===parentPid&&integer(Number(m[1]))&&integer(Number(m[2]))&&integer(Number(m[3]))&&integer(Number(m[3])*1024)&&(!start||m[4]===start),'rss');return {rssBytes:Number(m[3])*1024,startWitness:m[4]};
}
const metadata=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs&&a.nlink===b.nlink;
const observation=()=>({status:'pending',observedMs:null,code:null,signal:null,reason:null});
const pipeRecord=()=>({status:'pending',observedBytes:0,retainedPrefixBase64:'',droppedBytes:0,completeSha256:null,endMs:null,finishMs:null,closeMs:null,writeDispatchedMs:null,writeSettledMs:null,reason:null});
const cleanupRecord=()=>({termDispatchedMs:null,termAccepted:null,killDispatchedMs:null,killAccepted:null,originalsClosedMs:null,reason:null});
const env=()=>Object.fromEntries(['PATH','HOME','TMPDIR','SystemRoot','WINDIR'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
export async function runAimockTraceDecoderOwnerV3(input){
 need(arguments.length===1,'arguments');keys(input,['identity','store','artifacts','caseStarted','invocationStarted'],'arguments');validateIdentity(input.identity);need(finite(input.caseStarted)&&finite(input.invocationStarted),'arguments');
 for(const [object,methods]of [[input.store,['readJSON','stats']],[input.artifacts,['writeJSON','reserveDecoderTrafficV3','requireSpaceBeforeDecoderV3','stats']]])for(const name of methods){const d=Object.getOwnPropertyDescriptor(object??{},name);need(d&&Object.hasOwn(d,'value')&&typeof d.value==='function','arguments');}
 const now=()=>performance.now(),entered=now();need(input.invocationStarted<=input.caseStarted&&input.caseStarted<=entered,'arguments');
 const {store,artifacts,caseStarted,invocationStarted}=input,identity={...input.identity},caseEnd=caseStarted+240000,invocationEnd=invocationStarted+1200000,cleanupEnd=Math.min(caseEnd,invocationEnd)+30000,preflightEnd=Math.min(entered+10000,caseEnd,invocationEnd);
 const pending=new Set(),descriptors=new Set(),owners=[];let failure=null,decoderResult=null,decoderOriginals=null,decoder=null,bridge=null,sourceInventory=null,psFact=null,nodeExecutableSha256=null,decoderClosureSha256=null,rssExecutableSha256=null,dispatchedMs=null,successEnd=null,processClosedMs=null,tickTimer=null;
 const rss={thresholdBytes:1073741824,attempted:0,fulfilled:0,rejected:0,missed:0,pending:0,peakBytes:null,initialSeen:false,terminalSeen:false,samples:[]};
 let releaseFailure;const failed=new Promise(resolve=>{releaseFailure=resolve;});
 function latch(reason){if(!failure){failure=REASONS.has(reason)?reason:'timeline-owner-internal';clearTimeout(tickTimer);releaseFailure(failure);}}
 const gate=(end,c='deadline')=>need(now()<end,c);
 // Attention never settles/cancels its original. Retained handlers track late originals.
 async function attend(original,end,c){let timer;try{return await Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeline-owner-'+c)),Math.max(0,end-now()));})]);}finally{clearTimeout(timer);}}
 async function operation(end,fn,c){gate(end);const record={};pending.add(record);let original;try{original=Promise.resolve(fn());}catch(e){pending.delete(record);throw Error('timeline-owner-'+c);}const tracked=original.then(value=>{pending.delete(record);return value;},()=>{pending.delete(record);throw Error('timeline-owner-'+c);});tracked.catch(()=>{});record.original=tracked;const value=await attend(tracked,end,c);gate(end);return value;}
 async function sourceFact(name,end,original=null){
  const run=fn=>operation(end,fn,'sources'),resolved=await run(()=>fs.realpath(name)),before=await run(()=>fs.lstat(resolved,{bigint:true}));need(before.isFile()&&!before.isSymbolicLink(),'sources');let h,after,abandoned=false,closeStarted=false;const hasher=createHash('sha256');
  const close=()=>{if(closeStarted)return;closeStarted=true;const original=operation(cleanupEnd,()=>h.close().then(()=>{descriptors.delete(h);}),'sources');original.catch(()=>{});return attend(original,Math.min(end,cleanupEnd),'sources');};
  try{h=await run(()=>fs.open(resolved,constants.O_RDONLY|constants.O_NOFOLLOW).then(opened=>{h=opened;descriptors.add(opened);if(abandoned){const late=close();late?.catch(()=>{});}return opened;}));need(metadata(before,await run(()=>h.stat({bigint:true}))),'sources');const buffer=Buffer.alloc(65536);let position=0;while(true){const {bytesRead}=await run(()=>h.read(buffer,0,buffer.length,position));if(!bytesRead)break;hasher.update(buffer.subarray(0,bytesRead));position+=bytesRead;}after=await run(()=>h.stat({bigint:true}));need(metadata(before,after),'sources');}
  finally{abandoned=true;if(h)await close();}
  need(await run(()=>fs.realpath(name))===resolved&&metadata(after,await run(()=>fs.lstat(resolved,{bigint:true}))),'sources');const fact={name,resolved,stat:after,sha256:hasher.digest('hex')};if(original)need(fact.resolved===original.resolved&&fact.sha256===original.sha256&&metadata(fact.stat,original.stat),'sources');return fact;
 }
 function track(executable,args,kind,deadline,dispatchMs){
  gate(successEnd);const record={ownerId:kind+'-'+owners.length,kind,pid:null,parentPid:process.pid,startWitness:null,dispatchMs,deadlineMs:deadline,spawn:observation(),exit:observation(),close:observation(),stdin:pipeRecord(),stdout:pipeRecord(),stderr:pipeRecord(),attention:observation(),cleanup:cleanupRecord()};
  let child,resolveSpawn,resolveClosed,closed=false;const spawned=new Promise(r=>{resolveSpawn=r;}),closedPromise=new Promise(r=>{resolveClosed=r;}),writes=new Set(),drains=new Set(),buffers={stdout:[],stderr:[]},prefix={stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)},hashes={stdin:createHash('sha256'),stdout:createHash('sha256'),stderr:createHash('sha256')};
  const t={record,spawned,closedPromise,get child(){return child;},get closed(){return closed;},get bytes(){return {stdout:Buffer.concat(buffers.stdout),stderr:Buffer.concat(buffers.stderr)};},onData:null,onEnd:null};owners.push(t);
  function stamp(o,status,reason=null,code=null,signal=null){Object.assign(o,{status,observedMs:now(),code,signal,reason});}
  function changed(){
   for(const name of ['stdin','stdout','stderr']){const p=record[name],complete=p.closeMs!==null&&(name==='stdin'?p.finishMs!==null&&writes.size===0&&drains.size===0:p.endMs!==null)&&p.reason===null;if(p.closeMs!==null){p.status=complete?'fulfilled':'rejected';if(complete&&p.completeSha256===null)p.completeSha256=hashes[name].digest('hex');}}
   const exitKnown=record.exit.status!=='pending'||(record.pid===null&&record.spawn.status==='rejected');
   if(!closed&&exitKnown&&record.close.status!=='pending'&&['stdin','stdout','stderr'].every(s=>record[s].closeMs!==null)&&writes.size===0&&drains.size===0){closed=true;record.cleanup.originalsClosedMs=now();stamp(record.attention,now()<deadline&&record.exit.code===0&&record.exit.signal===null&&['stdin','stdout','stderr'].every(s=>record[s].status==='fulfilled')?'fulfilled':'rejected',now()<deadline?null:'timeline-owner-deadline');resolveClosed();}
  }
  try{gate(successEnd);child=spawn(executable,args,{stdio:['pipe','pipe','pipe'],env:kind==='rss-query'?{...env(),LC_ALL:'C',TZ:'UTC'}:env(),shell:false,detached:false});if(integer(child.pid)&&child.pid>0)record.pid=child.pid;}
  catch{stamp(record.spawn,'rejected','timeline-owner-spawn');stamp(record.attention,'rejected','timeline-owner-spawn');resolveSpawn();closed=true;record.cleanup.originalsClosedMs=now();resolveClosed();latch('timeline-owner-spawn');return t;}
  child.once('spawn',()=>{stamp(record.spawn,'fulfilled');resolveSpawn();if(!record.pid)latch('timeline-owner-spawn');if(now()>=deadline)latch('timeline-owner-deadline');});
  child.on('error',()=>{if(record.spawn.status==='pending'){stamp(record.spawn,'rejected','timeline-owner-spawn');resolveSpawn();}latch('timeline-owner-spawn');changed();});
  child.once('exit',(code,signal)=>{stamp(record.exit,'fulfilled',null,code,signal);if(code!==0||signal!==null)latch(kind==='decoder'?'timeline-owner-process':'timeline-owner-rss');if(now()>=deadline)latch('timeline-owner-deadline');changed();});
  child.once('close',(code,signal)=>{stamp(record.close,'fulfilled',null,code,signal);if(now()>=deadline)latch('timeline-owner-deadline');changed();});
  for(const name of ['stdin','stdout','stderr']){
   const stream=child[name],p=record[name];if(!stream){p.reason='timeline-owner-pipe';latch(p.reason);continue;}
   for(const event of name==='stdin'?['finish','close']:['end','close'])stream.once(event,()=>{p[event+'Ms']=now();if(now()>=deadline)latch('timeline-owner-deadline');if(event==='close'){for(const d of drains){d.reject(Error('timeline-owner-pipe'));}drains.clear();}changed();if(name==='stdout'&&event==='end')t.onEnd?.();});
   stream.on('error',()=>{p.reason='timeline-owner-pipe';latch(p.reason);changed();});
   if(name==='stdin')continue;
   const cap=kind==='decoder'?(name==='stdout'?262144:65536):(name==='stdout'?4096:8192),prefixCap=name==='stdout'?256:1024;
   stream.on('readable',()=>{try{while(!p.reason){const amount=Math.min(65536,cap-p.observedBytes+1,stream.readableLength);if(!amount){stream.read(0);break;}const b=stream.read(amount);if(b===null)break;p.observedBytes+=b.length;hashes[name].update(b);if(prefix[name].length<prefixCap)prefix[name]=Buffer.concat([prefix[name],b.subarray(0,prefixCap-prefix[name].length)]);p.retainedPrefixBase64=prefix[name].toString('base64');p.droppedBytes=p.observedBytes-prefix[name].length;
     if(p.observedBytes>cap){p.reason='timeline-owner-pipe';latch(p.reason);break;}if(now()>=deadline){latch('timeline-owner-deadline');break;}if(kind==='rss-query')buffers[name].push(b);if(name==='stdout')t.onData?.(b);
    }}catch(e){latch(code(e));}});
  }
  t.write=async bytes=>{
   gate(successEnd);need(!failure&&record.spawn.status==='fulfilled'&&record.exit.status==='pending'&&record.close.status==='pending','pipe');const p=record.stdin,stream=child.stdin,entry={};p.writeDispatchedMs=now();p.observedBytes+=bytes.length;p.droppedBytes=p.observedBytes;hashes.stdin.update(bytes);writes.add(entry);
   let callbackDone=false,drained=true,returned=false,resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;}),drainRecord={reject};
   const done=()=>{if(returned&&callbackDone&&drained){p.writeSettledMs=now();if(now()>=successEnd){reject(Error('timeline-owner-deadline'));latch('timeline-owner-deadline');}else resolve();changed();}};
   const drain=()=>{drained=true;drains.delete(drainRecord);done();};stream.once('drain',drain);
   try{gate(successEnd);drained=stream.write(bytes,e=>{writes.delete(entry);callbackDone=true;if(e){p.writeSettledMs=now();p.reason='timeline-owner-pipe';reject(Error(p.reason));latch(p.reason);}else done();changed();});returned=true;if(!drained)drains.add(drainRecord);else stream.off('drain',drain);done();}catch{writes.delete(entry);stream.off('drain',drain);p.reason='timeline-owner-pipe';reject(Error(p.reason));latch(p.reason);changed();}
   promise.catch(()=>{});await attend(promise,successEnd,'deadline');gate(successEnd);
  };
  t.end=()=>{gate(Math.min(successEnd,deadline));need(!failure&&record.exit.status==='pending'&&record.close.status==='pending','pipe');child.stdin.end();};
  t.signal=signal=>{
   if(now()>=cleanupEnd||!record.pid||record.spawn.status!=='fulfilled'||record.exit.status!=='pending'||record.close.status!=='pending')return;
   const prefix=signal==='SIGTERM'?'term':'kill';if(record.cleanup[prefix+'DispatchedMs']!==null)return;record.cleanup[prefix+'DispatchedMs']=now();try{record.cleanup[prefix+'Accepted']=child.kill(signal);}catch{record.cleanup[prefix+'Accepted']=false;}if(record.cleanup[prefix+'Accepted']!==true)record.cleanup.reason='timeline-owner-cleanup';
  };
  return t;
 }
 let query=null,activeSample=null;
 function startSample(kind){
  need(activeSample===null,'rss');const original=sample(kind);activeSample=original;
  const release=()=>{if(activeSample===original)activeSample=null;};original.then(release,release);return original;
 }
 async function sample(kind){
  gate(successEnd);need(!failure&&decoder&&decoder.record.spawn.status==='fulfilled'&&decoder.record.exit.status==='pending'&&decoder.record.close.status==='pending'&&!query&&rss.attempted<128,'rss');rss.attempted++;rss.pending++;let helper,classified=false;const dispatch=now();
  try{helper=track(psFact.resolved,['-p',String(decoder.record.pid),'-o','pid=','-o','ppid=','-o','rss=','-o','lstart='],'rss-query',Math.min(dispatch+250,successEnd),dispatch);query=helper;await attend(helper.spawned,helper.record.deadlineMs,'rss');need(helper.record.pid&&helper.record.pid!==decoder.record.pid&&helper.record.spawn.status==='fulfilled','rss');helper.end();await attend(helper.closedPromise,helper.record.deadlineMs,'rss');gate(helper.record.deadlineMs,'rss');need(!failure&&helper.record.exit.code===0&&helper.record.exit.signal===null&&helper.record.close.code===0&&['stdin','stdout','stderr'].every(s=>helper.record[s].status==='fulfilled')&&helper.record.stderr.observedBytes===0&&decoder.record.exit.status==='pending'&&decoder.record.close.status==='pending','rss');
   const value=parseRss(helper.bytes.stdout,decoder.record.pid,process.pid,decoder.record.startWitness);helper.record.startWitness=value.startWitness;if(kind===0)decoder.record.startWitness=value.startWitness;const settled=now();gate(helper.record.deadlineMs,'rss');rss.fulfilled++;classified=true;rss.samples.push([kind,dispatch,settled,value.rssBytes]);rss.peakBytes=Math.max(rss.peakBytes??0,value.rssBytes);if(kind===0)rss.initialSeen=true;if(kind===2)rss.terminalSeen=true;need(value.rssBytes<=1073741824,'rss');
  }catch(e){if(!classified){if(!helper||helper.closed)rss.rejected++;else helper.closedPromise.then(()=>{rss.rejected++;});}latch('timeline-owner-rss');throw e;}
  finally{if(helper?.closed){rss.pending--;query=null;}else if(helper){helper.closedPromise.then(()=>{rss.pending--;if(query===helper)query=null;});}else{rss.pending--;query=null;}}
 }
 function scheduleTick(){tickTimer=setTimeout(()=>{if(failure)return;if(now()>=successEnd){latch('timeline-owner-deadline');return;}if(query||activeSample){rss.missed++;latch('timeline-owner-rss');return;}scheduleTick();startSample(1).catch(e=>latch(code(e)));},100);}
 async function cleanup(){
  clearTimeout(tickTimer);const live=owners.filter(t=>!t.closed);for(const t of live){t.signal?.('SIGTERM');for(const name of ['stdin','stdout','stderr'])t.child?.[name]?.destroy();}const timers=live.map(t=>setTimeout(()=>t.signal?.('SIGKILL'),Math.min(2000,Math.max(0,cleanupEnd-now()))));
  try{await attend(Promise.all(live.map(t=>t.closedPromise)),cleanupEnd,'cleanup');}catch{latch('timeline-owner-cleanup');}finally{timers.forEach(clearTimeout);}
 }
 const storeUnsafe=()=>{try{const s=store.stats();return !!(s.pendingOriginals||s.pendingWriters||s.unsafeWriter);}catch{return true;}};
 try{
  gate(preflightEnd,'preflight');need(['darwin','linux'].includes(process.platform),'platform');const files=[process.execPath,...SOURCE_NAMES.map(n=>fileURLToPath(new URL('./'+n,import.meta.url)))];sourceInventory=[];for(const file of files)sourceInventory.push(await sourceFact(file,preflightEnd));
  psFact=await sourceFact(process.platform==='darwin'?'/bin/ps':'/usr/bin/ps',preflightEnd);nodeExecutableSha256=sourceInventory[0].sha256;rssExecutableSha256=psFact.sha256;
  const decoderSources={nodeExecutableSha256,files:sourceInventory.slice(1).map((s,i)=>({path:'tools/competitor-comparison/'+SOURCE_NAMES[i],sha256:s.sha256}))};decoderClosureSha256=sha(JSON.stringify(decoderSources));
  await operation(preflightEnd,()=>artifacts.reserveDecoderTrafficV3(),'reservation');bridge=await operation(preflightEnd,()=>artifacts.requireSpaceBeforeDecoderV3({caseStarted,invocationStarted}),'space');keys(bridge,['artifactRoot','rootIdentity','caseParentIdentity','rawReference'],'space');need(typeof bridge.artifactRoot==='string'&&path.isAbsolute(bridge.artifactRoot)&&!bridge.artifactRoot.includes('\0')&&Buffer.byteLength(bridge.artifactRoot)<=4096&&path.resolve(bridge.artifactRoot)===bridge.artifactRoot,'space');
  for(const pin of [bridge.rootIdentity,bridge.caseParentIdentity]){keys(pin,['dev','ino'],'space');need([pin.dev,pin.ino].every(v=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)),'space');}keys(bridge.rawReference,['path','bytes','sha256'],'space');need(bridge.rawReference.path===identity.id+'/'+P.storage.rawFilename&&bridge.rawReference.path.length<=257&&integer(bridge.rawReference.bytes)&&bridge.rawReference.bytes<=6291456&&digest(bridge.rawReference.sha256),'space');
  bridge=JSON.parse(JSON.stringify(bridge));const token=randomBytes(16).toString('hex'),frame=(type,body)=>Buffer.from(JSON.stringify({schema:P.schemas.message,type,token,body})+'\n');
  const request=frame('request',{identity,policySha256:POLICY_SHA,...bridge,decoderSources}),decodeAck=frame('decode-ack',{}),exitAck=frame('exit-ack',{});need(request.length+decodeAck.length+exitAck.length<=16384,'request');gate(preflightEnd);dispatchedMs=now();successEnd=Math.min(dispatchedMs+10000,caseEnd,invocationEnd);
  decoder=track(sourceInventory[0].resolved,['--max-old-space-size=512',sourceInventory[1].resolved],'decoder',successEnd,dispatchedMs);let state='ready',partial=[],requestWrite,decodeWrite;
  let resolveDialogue;const dialogue=new Promise(resolve=>{resolveDialogue=resolve;});
  function accept(bytes){const f=parse(bytes);keys(f,['schema','type','token','body'],'protocol');need(f.schema===P.schemas.message&&f.token===token,'protocol');gate(successEnd);
   if(state==='ready'){need(f.type==='ready','protocol');keys(f.body,['pid'],'protocol');need(f.body.pid===decoder.record.pid&&integer(f.body.pid)&&f.body.pid>0,'protocol');state='initial-rss';(async()=>{await requestWrite;await startSample(0);need(!failure,'rss');state='result';decodeWrite=decoder.write(decodeAck);await decodeWrite;if(state==='result')scheduleTick();})().catch(e=>latch(code(e)));}
   else if(state==='result'){need(f.type==='result-ready','protocol');decoderResult=validateResult(f.body,identity,bridge.rawReference);state='terminal-rss';clearTimeout(tickTimer);(async()=>{await decodeWrite;const original=activeSample;if(original)await original;need(!failure&&activeSample===null&&query===null&&rss.pending===0,'rss');await startSample(2);need(!failure,'rss');await decoder.write(exitAck);state='done';decoder.end();resolveDialogue();})().catch(e=>latch(code(e)));}
   else need(false,'protocol');
  }
  decoder.onData=b=>{for(const byte of b){need(!['terminal-rss','done'].includes(state),'protocol');if(byte===10){need(partial.length>0,'protocol');const bytes=Buffer.from(partial);partial=[];accept(bytes);}else partial.push(byte);}};
  decoder.onEnd=()=>{if(state!=='done'||partial.length)latch('timeline-owner-protocol');};
  const work=(async()=>{await attend(decoder.spawned,successEnd,'spawn');need(decoder.record.spawn.status==='fulfilled','spawn');requestWrite=decoder.write(request);await requestWrite;await dialogue;await attend(decoder.closedPromise,successEnd,'deadline');gate(successEnd);need(decoder.record.exit.code===0&&decoder.record.exit.signal===null&&decoder.record.close.code===0&&['stdin','stdout','stderr'].every(s=>decoder.record[s].status==='fulfilled')&&rss.initialSeen&&rss.terminalSeen&&rss.pending===0&&rss.rejected===0&&rss.missed===0,'process');})();work.catch(()=>{});
  await attend(Promise.race([work,failed.then(reason=>{throw Error(reason);})]),successEnd,'deadline');need(!failure,'process');clearTimeout(tickTimer);processClosedMs=Math.max(...owners.map(t=>t.record.cleanup.originalsClosedMs));
  for(const fact of sourceInventory)await sourceFact(fact.name,successEnd,fact);await sourceFact(psFact.name,successEnd,psFact);
 }catch(e){latch(code(e));}
 if(failure)await cleanup();
 if(owners.length&&owners.every(t=>t.closed))processClosedMs=Math.max(...owners.map(t=>t.record.cleanup.originalsClosedMs));
 const processUnsafe=()=>owners.some(t=>!t.closed);
 // Originals are charged/published once. They never self-certify their file write.
 if(decoder&&processClosedMs!==null&&!pending.size&&!descriptors.size&&!processUnsafe()&&!storeUnsafe()&&successEnd!==null&&now()<successEnd){
  const originals=JSON.parse(JSON.stringify({schema:P.schemas.originals,identity,policySha256:POLICY_SHA,rawReference:bridge.rawReference,nodeExecutableSha256,decoderClosureSha256,rssExecutableSha256,decoder:decoder.record,queries:owners.filter(t=>t!==decoder).map(t=>t.record),unsafeOutstanding:false,...P.flags}));
  try{need(Buffer.byteLength(JSON.stringify(originals))<=1048576,'originals-bound');const ref=await operation(successEnd,()=>artifacts.writeJSON('aimock-trace-v3-decoder-originals.json',originals,{kind:'evidence'}),'publication');keys(ref,['path','bytes','sha256'],'publication');need(ref.path===identity.id+'/aimock-trace-v3-decoder-originals.json'&&ref.bytes===Buffer.byteLength(JSON.stringify(originals))&&ref.sha256===sha(JSON.stringify(originals)),'publication');const read=await operation(successEnd,()=>store.readJSON(ref,{kind:'evidence'}),'publication');need(same(read,originals),'publication');decoderOriginals={...ref};}
  catch(e){latch(pending.size?'timeline-owner-publication-unsettled':code(e));}
 }
 if(!failure&&decoderOriginals===null)latch('timeline-owner-publication');
 const decoderOwner={schema:P.schemas.owner,status:failure?'unavailable':'complete',reason:failure,clock:{basis:'parent-node-performance',dispatchedMs,successDeadlineMs:successEnd,cleanupDeadlineMs:cleanupEnd,originalsClosedMs:processClosedMs},originalsReference:decoderOriginals,nodeExecutableSha256,decoderClosureSha256,rssExecutableSha256,rss,unsafeOutstanding:pending.size>0||descriptors.size>0||processUnsafe()||storeUnsafe(),...P.flags};
 need(Buffer.byteLength(JSON.stringify(decoderOwner))<=16384,'originals-bound');return freeze(JSON.parse(JSON.stringify({decoderResult,decoderOwner,decoderOriginals})));
}
