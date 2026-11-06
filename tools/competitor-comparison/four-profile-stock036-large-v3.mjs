// Pure fixed-roster qualification. Acquired data facts do not authorize execution.
import path from 'node:path';
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {fourProfileStock036InterleavedRosterV1,verifyInterleavedFixtureV1} from './four-profile-stock036-interleaved-v1.mjs';
import {MATRIX_V5_ACQUISITION} from './matrix-policy-v5.mjs';
import {isSemanticLargeProfileStockVersionV3,SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';
export const FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3=Object.freeze(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']);
export const SEMANTIC_LARGE_FLAGS_V3=P.flags;
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const roster=freeze(fourProfileStock036InterleavedRosterV1().map(s=>({...s,selection:{...s.selection},id:s.id.replace(`-four-profile-stock036-interleaved-v1-round-${s.round}`,`-four-profile-stock036-large-v3-round-${s.round}`)})));
export function fourProfileStock036LargeRosterV3(){if(arguments.length)throw Error('semantic-large-roster-arguments');return roster;}
export function parseFourProfileStock036LargeArgumentsV3(args){if(arguments.length!==1||!Array.isArray(args)||types.isProxy(args)||args.length!==2||Reflect.ownKeys(args).length!==3||![0,1].every(i=>{const d=Object.getOwnPropertyDescriptor(args,String(i));return d&&d.enumerable&&Object.hasOwn(d,'value');})||args[0]!=='--out'||typeof args[1]!=='string'||!path.isAbsolute(args[1])||path.resolve(args[1])!==args[1]||args[1].includes('\0'))throw Error('semantic-large-arguments');return {out:args[1]};}
export async function verifySemanticLargeFixtureV3(source,result,slot){return verifyInterleavedFixtureV1(source,result,slot);}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const need=(v,c)=>{if(!v)throw Error('timeline-owner-'+c);};
function keys(v,ks,c){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype,c);const names=Reflect.ownKeys(v);need(names.length===ks.length&&ks.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')&&d.enumerable;}),c);}
function validateIdentity(v){keys(v,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256'],'arguments');for(const k of ['id','profile','journey'])need(typeof v[k]==='string'&&Buffer.byteLength(v[k])>0&&Buffer.byteLength(v[k])<=256,'arguments');need(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(v.id)&&isSemanticLargeProfileStockVersionV3(v.profile,v.stockVersion)&&integer(v.historyCount)&&integer(v.responseBytes)&&digest(v.buildSha256),'arguments');}
const REASONS=new Set(['preflight','deadline','sources','platform','reservation','space','request','spawn','protocol','result','pipe','process','rss','cleanup','originals-bound','publication','publication-unsettled','internal'].map(c=>'timeline-owner-'+c));
const CHILD_REASONS=new Set(['buffer-ledger','buffer-usage','capture-facts','decoder-arguments','decompressed-cap','event-category','fields','gzip-utf8-or-json-invalid','identity','inventory','json-duplicate-key','own-data','owner-clock','owner-facts','payload-base64','payload-integrity','phase-clock','raw-bound','raw-header','receipt-bound','required-metadata','result-bound','support-facts','trace-event','trace-json','trace-process','trace-time','child-input-cap','child-frame','child-order','child-request','child-sources','child-raw-read','child-raw-json','child-raw-join','child-output','child-internal'].map(c=>'timeline-'+c));
const sha=b=>createHash('sha256').update(b).digest('hex');
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ks=Object.keys(a);return ks.length===Object.keys(b).length&&ks.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
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
 mapping(v.rendererMapping,v.traceEventCount);costs(v.costs,v.rendererMapping,v.traceEventCount);
 // Known thread witnesses are M events; owned frame witnesses are I events,
 // possibly with several frame records in one event. Cost populations are
 // disjoint X events. These bounds use retained identities, not unseen events.
 const m=v.rendererMapping,c=v.costs,frameEvents=new Set([...m.frameWitnesses.first8,...(m.frameWitnesses.latest?[m.frameWitnesses.latest]:[])].map(r=>r.eventIndex));
 const completeX=c.status==='available'?c.tasks.observedCompleteEvents+c.layouts.observedCompleteEvents+c.minorGC.observedCompleteEvents:0;
 need(m.threadWitnesses.totalCount+m.foreignRendererMainCount<=v.metadataEventCount&&v.metadataEventCount+frameEvents.size+completeX<=v.traceEventCount,'event-populations');return v;
}

const receiptKeys=['schema','identity','nodeClock','setupClock','finishClock','sealedMs','publicAckMs','config','limits','protocolSupport','inventory','startDispatched','startAcknowledged','stopDispatched','stopReason','tracingCompleteSeen','completion','dataLossOccurred','bufferUsage','eof','ioClosed','truncated','retainedBytes','receivedBytes','totalOriginalCompressedBytes','payloadSha256','owners','issues','complete','unsafeOutstanding','performance','scoringEligibility','FPS','bufferNotificationsV3'];
const limits={compressedBytes:4194304,chunkBytes:65536,maxReads:4096,decodedBytes:67108864,receiptBytes:16384,wrapperOverheadBytes:65536,base64Characters:5592408,wrapperBytes:6291456,evidenceBytes:2097152};
const ownerKinds=['browser-session','page-session','frame-tree','target-info','trace-start','active-page-categories','trace-end','trace-complete','stream-drain','finish','io-read','io-close','page-detach','browser-detach'];
function receiptPreview(v,limit=64,hashed=false){keys(v,hashed?['text','trueCharacters','truncated','sha256']:['text','trueCharacters','truncated']);need(typeof v.text==='string'&&v.text.length<=limit&&integer(v.trueCharacters)&&v.trueCharacters>=v.text.length&&typeof v.truncated==='boolean'&&v.truncated===(v.trueCharacters>limit)&&v.text.length===Math.min(v.trueCharacters,limit),'timeline-inventory');if(hashed)need(digest(v.sha256)&& (v.truncated||v.sha256===sha(v.text)),'timeline-inventory');}
function ledger(r){
 const b=r.bufferUsage,l=r.bufferNotificationsV3;keys(b,['count','first','last','max']);keys(l,['totalCount','first8','last8','retainedCount','droppedCount','truncated']);
 need(integer(b.count)&&l.totalCount===b.count&&Array.isArray(l.first8)&&Array.isArray(l.last8)&&l.first8.length===Math.min(b.count,8)&&l.last8.length===Math.min(Math.max(b.count-8,0),8)&&l.retainedCount===Math.min(b.count,16)&&l.droppedCount===b.count-l.retainedCount&&l.truncated===(l.droppedCount>0),'timeline-buffer-ledger');
 if(!b.count){need(b.first===null&&b.last===null&&b.max===null,'timeline-buffer-ledger');return;}
 need(finite(b.first)&&finite(b.last)&&finite(b.max)&&b.max<.9&&b.first<=b.max&&b.last<=b.max,'timeline-buffer-usage');
 const rows=[...l.first8,...l.last8];let previous=-1,retainedMax=0;
 for(let i=0;i<rows.length;i++){const row=rows[i],ordinal=i<l.first8.length?i+1:b.count-l.last8.length+i-l.first8.length+1;need(Array.isArray(row)&&row.length===5&&row[0]===ordinal&&finite(row[1])&&row[1]>=previous&&row[1]<=r.sealedMs,'timeline-buffer-ledger');previous=row[1];need((row[2]!==null||row[3]!==null)&&[row[2],row[3]].every(x=>x===null||(finite(x)&&x<=1))&&(row[4]===null||integer(row[4])),'timeline-buffer-ledger');const amount=Math.max(row[2]??0,row[3]??0);retainedMax=Math.max(retainedMax,amount);need(amount<=b.max,'timeline-buffer-ledger');if(i===0)need(amount===b.first,'timeline-buffer-ledger');if(i===rows.length-1)need(amount===b.last,'timeline-buffer-ledger');}
 if(l.droppedCount===0)need(b.max===retainedMax,'timeline-buffer-ledger');
}
function receipt(r,raw){
 keys(r,receiptKeys);validateIdentity(r.identity);need(same(r.identity,raw.identity),'timeline-identity');
 need(Buffer.byteLength(JSON.stringify(r))<=16384,'timeline-receipt-bound');
 need(r.schema===P.schemas.receipt&&r.nodeClock==='node-performance-relative-to-case-start'&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null&&r.complete===true&&r.startDispatched===true&&r.startAcknowledged===true&&r.stopDispatched===true&&r.tracingCompleteSeen===true&&r.dataLossOccurred===false&&r.eof===true&&r.ioClosed===true&&r.truncated===false&&r.unsafeOutstanding===false&&Array.isArray(r.issues)&&r.issues.length===0&&['functional-body-complete','before-browser-close'].includes(r.stopReason),'timeline-capture-facts');
 need(same(r.config,P.config)&&same(r.limits,limits),'timeline-capture-facts');
 keys(r.completion,['observedMs','dataLossOccurred','traceFormat','streamCompression']);need(r.completion.dataLossOccurred===false&&r.completion.traceFormat==='json'&&r.completion.streamCompression==='gzip','timeline-capture-facts');
 for(const clock of [r.setupClock,r.finishClock]){keys(clock,['startedMs','deadlineMs','budgetMs']);need(finite(clock.startedMs)&&finite(clock.deadlineMs)&&finite(clock.budgetMs)&&clock.budgetMs>0&&clock.budgetMs<=10000&&clock.deadlineMs>clock.startedMs&&Math.abs(clock.deadlineMs-clock.startedMs-clock.budgetMs)<.000001,'timeline-phase-clock');}
 need(finite(r.publicAckMs)&&r.publicAckMs>=r.setupClock.startedMs&&r.finishClock.startedMs>=r.publicAckMs&&finite(r.sealedMs)&&r.sealedMs>=r.finishClock.startedMs&&finite(r.completion.observedMs)&&r.completion.observedMs>=r.finishClock.startedMs&&r.completion.observedMs<r.finishClock.deadlineMs&&r.completion.observedMs<=r.sealedMs,'timeline-phase-clock');
 need(Array.isArray(r.owners)&&r.owners.length===14&&new Set(r.owners.map(o=>o.kind)).size===14&&ownerKinds.every(k=>r.owners.some(o=>o.kind===k)),'timeline-owner-facts');
 for(const o of r.owners){keys(o,['kind','dispatched','fulfilled','rejected','pending','lastStatus','lastDispatchedMs','lastSettledMs','attentionStatus','attentionDeadlineMs','attentionSettledMs','error']);need(integer(o.dispatched)&&o.dispatched>=1&&o.dispatched<=(o.kind==='io-read'?4096:1)&&o.fulfilled===o.dispatched&&o.rejected===0&&o.pending===0&&o.lastStatus==='fulfilled'&&o.attentionStatus==='fulfilled'&&o.error===null,'timeline-owner-facts');const c=ownerKinds.indexOf(o.kind)<6?r.setupClock:r.finishClock;need(finite(o.lastDispatchedMs)&&finite(o.lastSettledMs)&&finite(o.attentionDeadlineMs)&&finite(o.attentionSettledMs)&&o.lastDispatchedMs>=c.startedMs&&o.lastSettledMs>=o.lastDispatchedMs&&o.attentionSettledMs>=o.lastSettledMs&&o.attentionSettledMs<o.attentionDeadlineMs&&o.attentionDeadlineMs<=c.deadlineMs+.000001&&o.attentionSettledMs<=r.sealedMs,'timeline-owner-clock');}
 const s=r.protocolSupport;keys(s,['stage','requested','supportedRequested','returnedCount','returnedSha256','returnedFirst8','originalSettledMs','setupDeadlineMs']);need(s.stage==='active-page-categories'&&same(s.requested,P.config.traceConfig.includedCategories)&&same(s.supportedRequested,P.config.traceConfig.includedCategories)&&integer(s.returnedCount)&&s.returnedCount>=2&&s.returnedCount<=4096&&digest(s.returnedSha256)&&Array.isArray(s.returnedFirst8)&&s.returnedFirst8.length===Math.min(s.returnedCount,8)&&finite(s.originalSettledMs)&&s.originalSettledMs<s.setupDeadlineMs&&s.setupDeadlineMs===r.setupClock.deadlineMs,'timeline-support-facts');for(const p of s.returnedFirst8)receiptPreview(p,32);need(s.originalSettledMs===r.owners.find(o=>o.kind==='active-page-categories').lastSettledMs,'timeline-support-facts');
 const inv=r.inventory;keys(inv,['oneOwnedPage','mainFrameId','targetId','documentURL','origin','browserVersion','rendererMapping']);need(inv.oneOwnedPage===true&&['mainFrameId','targetId'].every(k=>typeof inv[k]==='string'&&inv[k].length>0&&inv[k].length<=128)&&inv.rendererMapping==='unavailable-until-actual-trace-metadata','timeline-inventory');receiptPreview(inv.documentURL,64,true);receiptPreview(inv.origin,64,true);receiptPreview(inv.browserVersion);ledger(r);
 need(integer(r.retainedBytes)&&r.retainedBytes===raw.retainedCompressedBytes&&r.retainedBytes===r.receivedBytes&&r.receivedBytes===r.totalOriginalCompressedBytes&&r.payloadSha256===raw.compressedSha256,'timeline-payload-integrity');
}
 function processOriginal(record,kind,owner){
  keys(record,['ownerId','kind','pid','parentPid','startWitness','dispatchMs','deadlineMs','spawn','exit','close','stdin','stdout','stderr','attention','cleanup'],'original');
  const clock=owner.clock,validTime=t=>finite(t)&&t>=record.dispatchMs&&t<record.deadlineMs;
  need(record.kind===kind&&typeof record.ownerId==='string'&&record.ownerId.length>0&&record.ownerId.length<=128&&integer(record.pid)&&record.pid>0&&integer(record.parentPid)&&record.parentPid>0&&typeof record.startWitness==='string'&&/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|[12][0-9]|3[01]) ([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9] [0-9]{4}$/.test(record.startWitness)&&finite(record.dispatchMs)&&record.dispatchMs>=clock.dispatchedMs&&finite(record.deadlineMs)&&record.deadlineMs<=clock.successDeadlineMs&&record.dispatchMs<record.deadlineMs,'original');
  for(const name of ['spawn','exit','close','attention']){const o=record[name];keys(o,['status','observedMs','code','signal','reason'],'original');need(o.status==='fulfilled'&&validTime(o.observedMs)&&o.reason===null&&o.signal===null&&o.code===(name==='exit'||name==='close'?0:null),'original');}
  need(record.spawn.observedMs<=record.exit.observedMs&&record.exit.observedMs<=record.close.observedMs&&record.attention.observedMs>=record.close.observedMs,'original-clock');
  const cleanup=record.cleanup;keys(cleanup,['termDispatchedMs','termAccepted','killDispatchedMs','killAccepted','originalsClosedMs','reason'],'original');need(cleanup.termDispatchedMs===null&&cleanup.termAccepted===null&&cleanup.killDispatchedMs===null&&cleanup.killAccepted===null&&cleanup.reason===null&&validTime(cleanup.originalsClosedMs)&&cleanup.originalsClosedMs>=record.close.observedMs&&cleanup.originalsClosedMs<=record.attention.observedMs,'original');
  for(const name of ['stdin','stdout','stderr']){
   const pipe=record[name];keys(pipe,['status','observedBytes','retainedPrefixBase64','droppedBytes','completeSha256','endMs','finishMs','closeMs','writeDispatchedMs','writeSettledMs','reason'],'pipe');
   const cap=name==='stdin'?16384:kind==='decoder'?(name==='stdout'?262144:65536):(name==='stdout'?4096:8192),prefixCap=name==='stdout'?256:1024;
   need(pipe.status==='fulfilled'&&pipe.reason===null&&integer(pipe.observedBytes)&&pipe.observedBytes<=cap&&integer(pipe.droppedBytes)&&typeof pipe.retainedPrefixBase64==='string'&&digest(pipe.completeSha256)&&validTime(pipe.closeMs)&&pipe.closeMs<=cleanup.originalsClosedMs,'pipe');
   const prefix=Buffer.from(pipe.retainedPrefixBase64,'base64');need(prefix.toString('base64')===pipe.retainedPrefixBase64&&prefix.length===(name==='stdin'?0:Math.min(pipe.observedBytes,prefixCap))&&pipe.droppedBytes===pipe.observedBytes-prefix.length,'pipe');
   if(name==='stdin'){
    need(pipe.endMs===null&&validTime(pipe.finishMs)&&pipe.finishMs<=pipe.closeMs,'pipe');
    if(kind==='decoder')need(validTime(pipe.writeDispatchedMs)&&validTime(pipe.writeSettledMs)&&pipe.writeDispatchedMs<=pipe.writeSettledMs&&pipe.writeSettledMs<=pipe.finishMs&&pipe.writeSettledMs<=record.exit.observedMs&&pipe.writeDispatchedMs<record.exit.observedMs&&pipe.observedBytes>0,'pipe');
    else need(pipe.writeDispatchedMs===null&&pipe.writeSettledMs===null&&pipe.observedBytes===0&&pipe.completeSha256===sha(Buffer.alloc(0)),'pipe');
   }else need(pipe.finishMs===null&&pipe.writeDispatchedMs===null&&pipe.writeSettledMs===null&&validTime(pipe.endMs)&&pipe.endMs<=pipe.closeMs,'pipe');
   if(pipe.droppedBytes===0)need(pipe.completeSha256===sha(prefix),'pipe');
  }
 }
 function originalsEvidence(originals,owner,rawReference,traceIdentity){
  keys(originals,['schema','identity','policySha256','rawReference','nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256','decoder','queries','unsafeOutstanding',...Object.keys(P.flags)],'originals');
  need(Buffer.byteLength(JSON.stringify(originals))<=1048576&&originals.schema===P.schemas.originals&&same(originals.identity,traceIdentity)&&originals.policySha256===POLICY_SHA&&same(originals.rawReference,rawReference)&&originals.unsafeOutstanding===false,'originals');literalFlags(originals);
  for(const k of ['nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256'])need(digest(originals[k])&&originals[k]===owner[k],'source-join');
  processOriginal(originals.decoder,'decoder',owner);need(originals.decoder.ownerId==='decoder-0'&&integer(originals.decoder.parentPid)&&originals.decoder.parentPid>0&&originals.decoder.dispatchMs===owner.clock.dispatchedMs&&originals.decoder.deadlineMs===owner.clock.successDeadlineMs,'original-clock');
  const queries=originals.queries,rss=owner.rss;need(Array.isArray(queries)&&queries.length>=2&&queries.length<=128&&queries.length===rss.attempted&&rss.samples.length===queries.length,'rss');
  const pids=new Set([originals.decoder.pid]),ids=new Set([originals.decoder.ownerId]);let latest=originals.decoder.cleanup.originalsClosedMs,previous=null;
  for(let i=0;i<queries.length;i++){
   const q=queries[i],sample=rss.samples[i];processOriginal(q,'rss-query',owner);need(q.ownerId==='rss-query-'+(i+1)&&!pids.has(q.pid)&&!ids.has(q.ownerId)&&q.parentPid===originals.decoder.parentPid&&q.startWitness===originals.decoder.startWitness&&q.stderr.observedBytes===0&&q.deadlineMs===Math.min(q.dispatchMs+250,owner.clock.successDeadlineMs)&&q.dispatchMs>=originals.decoder.spawn.observedMs&&q.cleanup.originalsClosedMs<originals.decoder.exit.observedMs&&(!previous||q.dispatchMs>=previous.cleanup.originalsClosedMs&&q.dispatchMs>=rss.samples[i-1][2]),'rss-original');pids.add(q.pid);ids.add(q.ownerId);
   need(Array.isArray(sample)&&sample.length===4&&sample[0]===(i===0?0:i===queries.length-1?2:1)&&sample[1]===q.dispatchMs&&finite(sample[2])&&sample[2]>=q.cleanup.originalsClosedMs&&sample[2]<q.deadlineMs&&sample[2]<originals.decoder.exit.observedMs&&integer(sample[3])&&sample[3]<=1073741824,'rss-sample');
   // Query stdout fits in its bounded prefix on accepted one-row ps output.
   need(q.stdout.droppedBytes===0,'rss-original');const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(q.stdout.retainedPrefixBase64,'base64'));
   const row=/^[ \t]*([0-9]+)[ \t]+([0-9]+)[ \t]+([0-9]+)[ \t]+([^\n]+?)[ \t]*\n?$/.exec(text);
   need(row&&Number(row[1])===originals.decoder.pid&&Number(row[2])===originals.decoder.parentPid&&Number.isSafeInteger(Number(row[3]))&&Number(row[3])*1024===sample[3]&&row[4]===q.startWitness,'rss-original');
   latest=Math.max(latest,q.cleanup.originalsClosedMs);previous=q;
  }
  need(latest===owner.clock.originalsClosedMs&&rss.peakBytes===Math.max(...rss.samples.map(s=>s[3]))&&originals.decoder.stdin.writeDispatchedMs>=rss.samples.at(-1)[2],'rss-join');
 }

function boundedJSON(value,cap){
 let bytes=0;const seen=new Set(),add=n=>{bytes+=n;need(bytes<=cap,'bound');};
 function visit(v){if(v===null){add(4);return;}if(typeof v==='boolean'){add(v?4:5);return;}if(typeof v==='number'){need(Number.isFinite(v),'own-data');add(String(v).length);return;}if(typeof v==='string'){need(v.length<=cap,'bound');add(Buffer.byteLength(JSON.stringify(v)));return;}
 need(v&&typeof v==='object'&&!types.isProxy(v)&&!seen.has(v),'own-data');seen.add(v);
 const array=Array.isArray(v);need(array||Object.getPrototypeOf(v)===Object.prototype,'own-data');const names=Reflect.ownKeys(v);need(names.every(k=>typeof k==='string'),'own-data');add(2);let count=0;
 if(array){const length=Object.getOwnPropertyDescriptor(v,'length').value;need(length<=cap&&names.length===length+1,'own-data');for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);visit(d.value);}}
 else for(const k of names){const d=Object.getOwnPropertyDescriptor(v,k);need(d&&d.enumerable&&Object.hasOwn(d,'value'),'own-data');if(count++)add(1);add(Buffer.byteLength(JSON.stringify(k))+1);visit(d.value);}
 seen.delete(v);
 }visit(value);return bytes;
}
const SOURCES=['aimock-trace-decoder-child-v3.mjs','aimock-trace-decoder-v3.mjs','semantic-large-v3-policy.mjs','aimock-trace-renderer-v1.mjs','aimock-trace-costs-v1.mjs','aimock-trace-capture-v1.mjs','aimock-trace-completion-waiter-v1.mjs'];
function sources(facts){boundedJSON(facts,4096);keys(facts,['decoderSources','rssExecutableSha256']);const s=facts.decoderSources;keys(s,['nodeExecutableSha256','files']);need(digest(s.nodeExecutableSha256)&&digest(facts.rssExecutableSha256)&&Array.isArray(s.files)&&s.files.length===7,'source');need(Object.keys(s).join(',')==='nodeExecutableSha256,files','source');for(let i=0;i<7;i++){const f=s.files[i];keys(f,['path','sha256']);need(Object.keys(f).join(',')==='path,sha256'&&f.path==='tools/competitor-comparison/'+SOURCES[i]&&digest(f.sha256),'source');}return {nodeExecutableSha256:s.nodeExecutableSha256,decoderClosureSha256:sha(JSON.stringify(s)),rssExecutableSha256:facts.rssExecutableSha256};}
function reference(ref,id,name,value,cap){keys(ref,['path','bytes','sha256']);need(ref.path===id+'/'+name&&integer(ref.bytes)&&ref.bytes>0&&ref.bytes<=cap&&digest(ref.sha256),'reference');if(value!==undefined){boundedJSON(value,cap);const text=JSON.stringify(value);need(Buffer.byteLength(text)===ref.bytes&&sha(text)===ref.sha256,'reference');}}
function literalFlags(v){need(Object.keys(P.flags).every(k=>v[k]===P.flags[k]),'flags');}
export function validateSemanticLargeTraceRecordV3(record,identity,sourceFacts){try{
 if(arguments.length!==3)return false;
 // Check each retained object before any stringify, traversal or detached copy.
 need(record&&!types.isProxy(record),'own-data');keys(record,['raw','originals','validation']);
 for(const [k,cap]of [['raw',65536+1024],['originals',1048576+1024],['validation',2097152+1024]])boundedJSON(record[k],cap);
 boundedJSON(identity,2048);validateIdentity(identity);const expected=sources(sourceFacts);
 for(const k of ['raw','originals','validation'])keys(record[k],['reference','value']);
 const raw=record.raw.value,originals=record.originals.value,v=record.validation.value,id=identity.id;
 keys(raw,['schema','captureProfile','policySha256','identity','traceFormat','compression','payloadEncoding','receipt','retainedCompressedBytes','compressedSha256',...Object.keys(P.flags)]);literalFlags(raw);
 need(raw.schema===P.schemas.raw&&raw.captureProfile===P.captureProfile&&raw.policySha256===POLICY_SHA&&same(raw.identity,identity)&&raw.traceFormat==='json'&&raw.compression==='gzip'&&raw.payloadEncoding==='base64'&&integer(raw.retainedCompressedBytes)&&raw.retainedCompressedBytes>0&&raw.retainedCompressedBytes<=4194304&&digest(raw.compressedSha256),'raw');
 need(boundedJSON(raw,65536)+19<=65536,'raw-overhead');
 reference(record.raw.reference,id,'aimock-trace-v3-private.json',undefined,6291456);
 // Payload is omitted after actual store hash verification. Its full-wrapper hash
 // cannot be recomputed here; the retained byte geometry can still be checked.
 const fullBytes=Buffer.byteLength(JSON.stringify(raw))+19+4*Math.ceil(raw.retainedCompressedBytes/3);
 need(record.raw.reference.bytes===fullBytes,'raw-byte-join');receipt(raw.receipt,raw);
 reference(record.originals.reference,id,'aimock-trace-v3-decoder-originals.json',originals,1048576);
 reference(record.validation.reference,id,'aimock-trace-v3-validation.json',v,2097152);
 keys(v,['schema','identity','policySha256','rawReference','decoderResult','decoderOwner',...Object.keys(P.flags)]);literalFlags(v);
 need(v.schema===P.schemas.validation&&same(v.identity,identity)&&v.policySha256===POLICY_SHA&&same(v.rawReference,record.raw.reference),'validation');
 const owner=v.decoderOwner;keys(owner,['schema','status','reason','clock','originalsReference','nodeExecutableSha256','decoderClosureSha256','rssExecutableSha256','rss','unsafeOutstanding',...Object.keys(P.flags)]);literalFlags(owner);boundedJSON(owner,16384);
 need(owner.schema===P.schemas.owner&&owner.status==='complete'&&owner.reason===null&&owner.unsafeOutstanding===false&&same(owner.originalsReference,record.originals.reference),'owner');
 for(const k of Object.keys(expected))need(owner[k]===expected[k]&&originals[k]===expected[k],'sources');
 const c=owner.clock;keys(c,['basis','dispatchedMs','successDeadlineMs','cleanupDeadlineMs','originalsClosedMs']);need(c.basis==='parent-node-performance'&&finite(c.dispatchedMs)&&finite(c.successDeadlineMs)&&c.successDeadlineMs>c.dispatchedMs&&c.successDeadlineMs<=c.dispatchedMs+10000&&finite(c.cleanupDeadlineMs)&&c.cleanupDeadlineMs>=c.successDeadlineMs+30000&&finite(c.originalsClosedMs)&&c.originalsClosedMs>=c.dispatchedMs&&c.originalsClosedMs<c.successDeadlineMs,'clock');
 const rss=owner.rss;keys(rss,['thresholdBytes','attempted','fulfilled','rejected','missed','pending','peakBytes','initialSeen','terminalSeen','samples']);need(rss.thresholdBytes===1073741824&&integer(rss.attempted)&&rss.attempted>=2&&rss.attempted<=128&&rss.fulfilled===rss.attempted&&rss.rejected===0&&rss.missed===0&&rss.pending===0&&rss.initialSeen===true&&rss.terminalSeen===true&&integer(rss.peakBytes)&&rss.peakBytes<=rss.thresholdBytes&&Array.isArray(rss.samples),'rss');
 // Context is private to this one validation call, never retained by a runner.
 originalsEvidence(originals,owner,record.raw.reference,identity);
 boundedJSON(v.decoderResult,262144);validateResult(v.decoderResult,identity,record.raw.reference);
 const child=v.decoderResult;need(child.status==='valid'&&child.reason===null&&child.compressedBytes===raw.retainedCompressedBytes&&child.compressedSha256===raw.compressedSha256&&child.rendererMapping.status==='available'&&child.rendererMapping.binding.frameId===raw.receipt.inventory.mainFrameId&&child.costs.status==='available','child');
 return true;
 }catch{return false;}}

const PROFILES=FOUR_PROFILE_STOCK036_LARGE_PROFILES_V3,ATTEMPT_SCHEMA='four-profile-stock036-large-attempt-v3';

const legacyFlags={performance:false,scoringEligibility:false,FPS:null};
const matches=(v,w)=>v&&Object.entries(w).every(([k,x])=>v[k]===x);

// Only inspect array envelope descriptors here; joined context has separate
// per-record bounds and is never copied into an aggregate array check.
function resultArray(value,max){
 try{if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype)return false;
 const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!Object.hasOwn(length,'value')||!integer(length.value)||length.value>max)return false;
 const names=Reflect.ownKeys(value);if(names.length!==length.value+1)return false;
 for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return false;}return true;
 }catch{return false;}
}

function qualification(results,buildHashes,context){
 const empty=()=>roster.map(()=>({attempted:false,native:false,trace:false,qualified:false,base:false}));
 try{
 if(!resultArray(results,roster.length))return empty();
 boundedJSON(buildHashes,1024);keys(buildHashes,PROFILES);need(PROFILES.every(p=>digest(buildHashes[p])),'build');
 need(context&&!types.isProxy(context),'context');keys(context,['decoderSources','rssExecutableSha256','cases']);const facts={decoderSources:context.decoderSources,rssExecutableSha256:context.rssExecutableSha256};sources(facts);
 need(context.cases&&!types.isProxy(context.cases),'cases');keys(context.cases,roster.map(s=>s.id));need(Object.keys(context.cases).join(',')===roster.map(s=>s.id).join(','),'cases-order');
 const rows=roster.map((slot,i)=>{const descriptor=Object.getOwnPropertyDescriptor(results,String(i));if(!descriptor||!Object.hasOwn(descriptor,'value')||descriptor.value===null)return {attempted:false,native:false,trace:false,qualified:false,base:false};const r=descriptor.value;try{boundedJSON(r,2097152);
 const e=r.semanticLargeAttempt,f=e?.fixture,d=r.fixtureDigests,p=slot.selection.profile,hash=buildHashes[p];
 const identity={id:slot.id,...slot.selection,stockVersion:p==='threadplane'?'0.3.6':null,buildSha256:hash};
 const t=r.traceDiagnostic,record=context.cases[slot.id];let trace=false;
 try{if(t){keys(t,['schema','profile','status','failure','buildSha256','rawCapture','decoderOriginals','validation','policySha256',...Object.keys(P.flags)]);trace=matches(t,{schema:p==='threadplane'?'threadplane-aimock-trace-case-v3':'competitor-aimock-semantic-trace-case-v3',profile:p,status:'complete',failure:null,buildSha256:hash,policySha256:POLICY_SHA,...P.flags})&&validateSemanticLargeTraceRecordV3(record,identity,facts)&&same(t.rawCapture,record.raw.reference)&&same(t.decoderOriginals,record.originals.reference)&&same(t.validation,record.validation.reference);}}catch{trace=false;}
 let base=matches(r,{schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',id:slot.id,kind:'positive',...slot.selection,unsafeOutstanding:false,stopInvocation:false,...legacyFlags})&&!Object.hasOwn(r,'publicationUnavailable')&&same(r.acquisition,MATRIX_V5_ACQUISITION);
 if(!e)base=false;else {keys(e,['schema','parentId','round','stratum','block','position','sourceFlavor','buildSha256','fixture','originalCall','qualificationUnsafe',...Object.keys(P.flags)]);const call=e.originalCall;keys(call,['clock','dispatched','settled']);base=base&&matches(e,{schema:ATTEMPT_SCHEMA,parentId:slot.parentId,round:slot.round,stratum:slot.stratum,block:slot.block,position:slot.position,sourceFlavor:slot.sourceFlavor,buildSha256:hash,qualificationUnsafe:false,...P.flags})&&call.clock==='controller-monotonic'&&finite(call.dispatched)&&finite(call.settled)&&call.settled>=call.dispatched;}
 const fields=['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'];if(f)keys(f,['status',...fields]);base=base&&f&&matches(f,{status:'verified-canonical'})&&fields.every(k=>digest(f[k]))&&d&&fields.slice(0,3).every(k=>f[k]===d[k]);
 const a=r.admission,native=base&&matches(r,{status:'matrix-pass',failure:null})&&matches(a,{schema:'four-stack-matrix-conformance-v5',profile:p,status:'functional-pass',...legacyFlags})&&same(a.acquisition,MATRIX_V5_ACQUISITION)&&matches(a.workload,{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50});
 return {attempted:r.status!=='unattempted',native:!!native,trace:!!trace,base:!!base,qualified:!!native&&!!trace};}catch{return {attempted:true,native:false,trace:false,qualified:false,base:false};}});
 const fields=['sourceSha256','historySha256','responseSha256','sourceDeltaSha256'];
 const baseRows=rows.map(r=>r.base);for(let i=0;i<rows.length;i++)if(baseRows[i])for(let j=0;j<rows.length;j++)if(baseRows[j]&&roster[i].stratum===roster[j].stratum&&!fields.every(k=>results[i].semanticLargeAttempt.fixture[k]===results[j].semanticLargeAttempt.fixture[k])){rows[i].qualified=false;rows[i].base=false;}
 return rows;
 }catch{return empty();}}
function summary(results,buildHashes,context){const q=qualification(results,buildHashes,context);
 // Observed native statuses are separate counts, never substituted for joined qualification.
 for(let i=0;i<roster.length;i++){
 q[i].attempted=false;q[i].native=false;
 try{if(!Array.isArray(results)||types.isProxy(results))continue;const d=Object.getOwnPropertyDescriptor(results,String(i)),r=d&&Object.hasOwn(d,'value')?d.value:null;boundedJSON(r,2097152);
 const slot=roster[i],identity=matches(r,{id:slot.id,kind:'positive',...slot.selection});q[i].attempted=!!identity&&['invalid','matrix-pass'].includes(r.status);
 const a=r?.admission;q[i].native=!!identity&&matches(r,{schema:'four-stack-matrix-case-v5',purpose:'functional-conformance-development',status:'matrix-pass',failure:null,unsafeOutstanding:false,...legacyFlags})&&!Object.hasOwn(r,'publicationUnavailable')&&same(r.acquisition,MATRIX_V5_ACQUISITION)&&matches(a,{schema:'four-stack-matrix-conformance-v5',profile:slot.selection.profile,status:'functional-pass',...legacyFlags})&&same(a.acquisition,MATRIX_V5_ACQUISITION)&&matches(a.workload,{seed:1,historyCount:slot.selection.historyCount,responseBytes:6400,journey:slot.selection.journey,deltaCount:200,deltaIntervalMs:50});
 }catch{}}

 return {profiles:PROFILES.map(profile=>{const indices=roster.flatMap((s,i)=>s.selection.profile===profile?[i]:[]),count=k=>indices.filter(i=>q[i][k]).length;return {profile,planned:indices.length,attempted:count('attempted'),nativePass:count('native'),traceComplete:count('trace'),qualified:count('qualified'),plannedPositions:[1,2,3,4].map(p=>indices.filter(i=>roster[i].position===p).length),qualifiedPositions:[1,2,3,4].map(p=>indices.filter(i=>q[i].qualified&&roster[i].position===p).length)};}),pairedBlocks:Array.from({length:roster.length/4},(_,b)=>{const rows=q.slice(b*4,b*4+4),count=k=>rows.filter(r=>r[k]).length;return {block:b+1,round:Math.floor(b/4)+1,stratum:b%4,planned:4,attempted:count('attempted'),nativePass:count('native'),traceComplete:count('trace'),fullyQualified:count('qualified'),qualified:rows.every(r=>r.qualified)};}),...P.flags};}

export function admitFourProfileStock036LargeV3(results,buildHashes,traceRecords){return arguments.length===3&&resultArray(results,48)&&results.length===48&&qualification(results,buildHashes,traceRecords).every(r=>r.qualified);}
export function summarizeFourProfileStock036LargeV3(results,buildHashes,traceRecords){return summary(results,buildHashes,traceRecords);}
