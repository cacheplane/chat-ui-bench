// Pure, data-only V3 codec. Run in the future owned child, never in its parent.
// Policy identity describes acquisition only; it grants no native/release authority.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {isSemanticLargeProfileStockVersionV3,SEMANTIC_LARGE_V3_POLICY as P,SEMANTIC_LARGE_V3_POLICY_SHA256 as POLICY_SHA} from './semantic-large-v3-policy.mjs';
import {mapAimockTraceRendererV1} from './aimock-trace-renderer-v1.mjs';
import {projectOwnedRendererCostsV1} from './aimock-trace-costs-v1.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c);};
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const flags={performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
const rawKeys=['schema','captureProfile','policySha256','identity','traceFormat','compression','payloadEncoding','receipt','retainedCompressedBytes','compressedSha256','payloadBase64',...Object.keys(flags)];
const receiptKeys=['schema','identity','nodeClock','setupClock','finishClock','sealedMs','publicAckMs','config','limits','protocolSupport','inventory','startDispatched','startAcknowledged','stopDispatched','stopReason','tracingCompleteSeen','completion','dataLossOccurred','bufferUsage','eof','ioClosed','truncated','retainedBytes','receivedBytes','totalOriginalCompressedBytes','payloadSha256','owners','issues','complete','unsafeOutstanding','performance','scoringEligibility','FPS','bufferNotificationsV3'];
const limits={compressedBytes:4194304,chunkBytes:65536,maxReads:4096,decodedBytes:67108864,receiptBytes:16384,wrapperOverheadBytes:65536,base64Characters:5592408,wrapperBytes:6291456,evidenceBytes:2097152};
const ownerKinds=['browser-session','page-session','frame-tree','target-info','trace-start','active-page-categories','trace-end','trace-complete','stream-drain','finish','io-read','io-close','page-detach','browser-detach'];
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function keys(v,expected){need(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k)),'timeline-fields');}
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
// Detach own plain JSON data before observing it. Getters, toJSON, sparse arrays,
// symbols, cycles, exotic prototypes and unbounded structures never reach codec.
function detached(input){
 let bytes=0,nodes=0;const ancestors=new Set();
 function visit(v,depth){need(depth<=64&&++nodes<=100000,'timeline-raw-bound');
  if(v===null||typeof v==='boolean'){bytes+=5;}
  else if(typeof v==='string'){need(v.length<=P.capture.wrapperBytes,'timeline-raw-bound');bytes+=Buffer.byteLength(v)+2;}
  else if(typeof v==='number'){need(Number.isFinite(v),'timeline-own-data');bytes+=32;}
  else {
   need(v&&typeof v==='object'&&!ancestors.has(v),'timeline-own-data');const array=Array.isArray(v);need(Object.getPrototypeOf(v)===(array?Array.prototype:Object.prototype),'timeline-own-data');
   const ks=Reflect.ownKeys(v);need(ks.length<=100000&&ks.every(k=>typeof k==='string'),'timeline-own-data');
   if(array)need(ks.length===v.length+1&&ks.at(-1)==='length','timeline-own-data');
   const out=array?[]:{};ancestors.add(v);bytes+=2;
   for(const k of ks){if(array&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);need(d&&Object.hasOwn(d,'value')&&d.enumerable&&k!=='toJSON','timeline-own-data');bytes+=Buffer.byteLength(k)+4;need(bytes<=P.capture.wrapperBytes,'timeline-raw-bound');Object.defineProperty(out,k,{value:visit(d.value,depth+1),enumerable:true,writable:true,configurable:true});}
   ancestors.delete(v);return out;
  }
  need(bytes<=P.capture.wrapperBytes,'timeline-raw-bound');return v;
 }
 return freeze(visit(input,0));
}
function identity(v){keys(v,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256']);for(const k of ['id','profile','journey'])need(typeof v[k]==='string'&&v[k].length>0&&Buffer.byteLength(v[k])<=256,'timeline-identity');need(integer(v.historyCount)&&integer(v.responseBytes)&&isSemanticLargeProfileStockVersionV3(v.profile,v.stockVersion)&&digest(v.buildSha256),'timeline-identity');}
function preview(v,limit=64,hashed=false){keys(v,hashed?['text','trueCharacters','truncated','sha256']:['text','trueCharacters','truncated']);need(typeof v.text==='string'&&v.text.length<=limit&&integer(v.trueCharacters)&&v.trueCharacters>=v.text.length&&typeof v.truncated==='boolean'&&v.truncated===(v.trueCharacters>limit)&&v.text.length===Math.min(v.trueCharacters,limit),'timeline-inventory');if(hashed)need(digest(v.sha256)&& (v.truncated||v.sha256===sha(v.text)),'timeline-inventory');}
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
 keys(r,receiptKeys);identity(r.identity);need(same(r.identity,raw.identity),'timeline-identity');
 need(Buffer.byteLength(JSON.stringify(r))<=16384,'timeline-receipt-bound');
 need(r.schema===P.schemas.receipt&&r.nodeClock==='node-performance-relative-to-case-start'&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null&&r.complete===true&&r.startDispatched===true&&r.startAcknowledged===true&&r.stopDispatched===true&&r.tracingCompleteSeen===true&&r.dataLossOccurred===false&&r.eof===true&&r.ioClosed===true&&r.truncated===false&&r.unsafeOutstanding===false&&Array.isArray(r.issues)&&r.issues.length===0&&['functional-body-complete','before-browser-close'].includes(r.stopReason),'timeline-capture-facts');
 need(same(r.config,P.config)&&same(r.limits,limits),'timeline-capture-facts');
 keys(r.completion,['observedMs','dataLossOccurred','traceFormat','streamCompression']);need(r.completion.dataLossOccurred===false&&r.completion.traceFormat==='json'&&r.completion.streamCompression==='gzip','timeline-capture-facts');
 for(const clock of [r.setupClock,r.finishClock]){keys(clock,['startedMs','deadlineMs','budgetMs']);need(finite(clock.startedMs)&&finite(clock.deadlineMs)&&finite(clock.budgetMs)&&clock.budgetMs>0&&clock.budgetMs<=10000&&clock.deadlineMs>clock.startedMs&&Math.abs(clock.deadlineMs-clock.startedMs-clock.budgetMs)<.000001,'timeline-phase-clock');}
 need(finite(r.publicAckMs)&&r.publicAckMs>=r.setupClock.startedMs&&r.finishClock.startedMs>=r.publicAckMs&&finite(r.sealedMs)&&r.sealedMs>=r.finishClock.startedMs&&finite(r.completion.observedMs)&&r.completion.observedMs>=r.finishClock.startedMs&&r.completion.observedMs<r.finishClock.deadlineMs&&r.completion.observedMs<=r.sealedMs,'timeline-phase-clock');
 need(Array.isArray(r.owners)&&r.owners.length===14&&new Set(r.owners.map(o=>o.kind)).size===14&&ownerKinds.every(k=>r.owners.some(o=>o.kind===k)),'timeline-owner-facts');
 for(const o of r.owners){keys(o,['kind','dispatched','fulfilled','rejected','pending','lastStatus','lastDispatchedMs','lastSettledMs','attentionStatus','attentionDeadlineMs','attentionSettledMs','error']);need(integer(o.dispatched)&&o.dispatched>=1&&o.dispatched<=(o.kind==='io-read'?4096:1)&&o.fulfilled===o.dispatched&&o.rejected===0&&o.pending===0&&o.lastStatus==='fulfilled'&&o.attentionStatus==='fulfilled'&&o.error===null,'timeline-owner-facts');const c=ownerKinds.indexOf(o.kind)<6?r.setupClock:r.finishClock;need(finite(o.lastDispatchedMs)&&finite(o.lastSettledMs)&&finite(o.attentionDeadlineMs)&&finite(o.attentionSettledMs)&&o.lastDispatchedMs>=c.startedMs&&o.lastSettledMs>=o.lastDispatchedMs&&o.attentionSettledMs>=o.lastSettledMs&&o.attentionSettledMs<o.attentionDeadlineMs&&o.attentionDeadlineMs<=c.deadlineMs+.000001&&o.attentionSettledMs<=r.sealedMs,'timeline-owner-clock');}
 const s=r.protocolSupport;keys(s,['stage','requested','supportedRequested','returnedCount','returnedSha256','returnedFirst8','originalSettledMs','setupDeadlineMs']);need(s.stage==='active-page-categories'&&same(s.requested,P.config.traceConfig.includedCategories)&&same(s.supportedRequested,P.config.traceConfig.includedCategories)&&integer(s.returnedCount)&&s.returnedCount>=2&&s.returnedCount<=4096&&digest(s.returnedSha256)&&Array.isArray(s.returnedFirst8)&&s.returnedFirst8.length===Math.min(s.returnedCount,8)&&finite(s.originalSettledMs)&&s.originalSettledMs<s.setupDeadlineMs&&s.setupDeadlineMs===r.setupClock.deadlineMs,'timeline-support-facts');for(const p of s.returnedFirst8)preview(p,32);need(s.originalSettledMs===r.owners.find(o=>o.kind==='active-page-categories').lastSettledMs,'timeline-support-facts');
 const inv=r.inventory;keys(inv,['oneOwnedPage','mainFrameId','targetId','documentURL','origin','browserVersion','rendererMapping']);need(inv.oneOwnedPage===true&&['mainFrameId','targetId'].every(k=>typeof inv[k]==='string'&&inv[k].length>0&&inv[k].length<=128)&&inv.rendererMapping==='unavailable-until-actual-trace-metadata','timeline-inventory');preview(inv.documentURL,64,true);preview(inv.origin,64,true);preview(inv.browserVersion);ledger(r);
 need(integer(r.retainedBytes)&&r.retainedBytes===raw.retainedCompressedBytes&&r.retainedBytes===r.receivedBytes&&r.receivedBytes===r.totalOriginalCompressedBytes&&r.payloadSha256===raw.compressedSha256,'timeline-payload-integrity');
}
// JSON.parse silently accepts duplicate keys. This linear lexical pass rejects
// them (including escaped spellings), without parsing a second event ledger.
function uniqueJSONKeys(text){
 const stack=[];let i=0;
 function string(retain){const parts=[];let start=++i;while(i<text.length){const c=text[i++];if(c==='"'){if(retain)parts.push(text.slice(start,i-1));return retain?parts.join(''):null;}if(c==='\\'){if(retain)parts.push(text.slice(start,i-1));const e=text[i++];if(e==='u'){const h=text.slice(i,i+4);need(/^[0-9a-fA-F]{4}$/.test(h),'timeline-trace-json');if(retain)parts.push(String.fromCharCode(parseInt(h,16)));i+=4;}else{const escapes={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};need(Object.hasOwn(escapes,e),'timeline-trace-json');if(retain)parts.push(escapes[e]);}start=i;}else need(c.charCodeAt(0)>=32,'timeline-trace-json');}throw Error('timeline-trace-json');}
 while(i<text.length){const c=text[i];if(c==='"'){const parent=stack.at(-1),key=parent?.type==='object'&&parent.key;const value=string(key);if(key){need(!parent.keys.has(value),'timeline-json-duplicate-key');parent.keys.add(value);parent.key=false;}}else if(c==='{'){stack.push({type:'object',keys:new Set(),key:true});i++;}else if(c==='['){stack.push({type:'array'});i++;}else if(c==='}'||c===']'){stack.pop();i++;}else if(c===','){if(stack.at(-1)?.type==='object')stack.at(-1).key=true;i++;}else i++;}
}
/** One immutable raw snapshot in; closed bounded aggregates out. No ports/options. */
export function decodeSemanticLargeSnapshotV3(input){
 const result={schema:P.schemas.decoded,status:'invalid',reason:null,identity:null,policySha256:POLICY_SHA,compressedBytes:null,compressedSha256:null,decodedBytes:null,decodedSha256:null,traceEventCount:null,metadataEventCount:null,emittedCategories:null,rendererMapping:null,costs:null,...flags};
 try{
  need(arguments.length===1,'timeline-decoder-arguments');const raw=detached(input);keys(raw,rawKeys);
  need(raw.schema===P.schemas.raw&&raw.captureProfile===P.captureProfile&&raw.policySha256===POLICY_SHA&&raw.traceFormat==='json'&&raw.compression==='gzip'&&raw.payloadEncoding==='base64'&&Object.keys(flags).every(k=>raw[k]===flags[k]),'timeline-raw-header');identity(raw.identity);
  need(typeof raw.payloadBase64==='string'&&raw.payloadBase64.length<=P.capture.base64Characters&&raw.payloadBase64.length%4===0,'timeline-payload-base64');need(integer(raw.retainedCompressedBytes)&&raw.retainedCompressedBytes<=P.capture.compressedBytes&&digest(raw.compressedSha256),'timeline-payload-integrity');
  need(Buffer.byteLength(JSON.stringify({...raw,payloadBase64:''}))<=P.capture.wrapperOverheadBytes&&Buffer.byteLength(JSON.stringify(raw))<=P.capture.wrapperBytes,'timeline-raw-bound');receipt(raw.receipt,raw);
  const compressed=Buffer.from(raw.payloadBase64,'base64');need(compressed.toString('base64')===raw.payloadBase64&&compressed.length===raw.retainedCompressedBytes&&sha(compressed)===raw.compressedSha256,'timeline-payload-integrity');
  const decoded=gunzipSync(compressed,{maxOutputLength:P.capture.decodedBytes});need(decoded.length<=P.capture.decodedBytes,'timeline-decompressed-cap');const text=new TextDecoder('utf-8',{fatal:true}).decode(decoded);uniqueJSONKeys(text);const value=JSON.parse(text);
  need(value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.traceEvents),'timeline-trace-json');let metadata=0;const emitted=new Set();
  for(const event of value.traceEvents){need(event&&typeof event==='object'&&!Array.isArray(event)&&typeof event.ph==='string'&&event.ph.length>0&&event.ph.length<=4&&typeof event.name==='string'&&event.name.length<=1024,'timeline-trace-event');for(const k of ['pid','tid'])if(event[k]!==undefined)need(integer(event[k]),'timeline-trace-process');for(const k of ['ts','dur'])if(event[k]!==undefined)need(finite(event[k]),'timeline-trace-time');if(event.cat!==undefined){need(typeof event.cat==='string'&&event.cat.length<=4096,'timeline-event-category');for(const name of event.cat.split(',').filter(Boolean))emitted.add(name);}if(event.ph==='M')metadata++;}
  need(metadata>0,'timeline-required-metadata');const rendererMapping=mapAimockTraceRendererV1(value,raw.receipt.inventory.mainFrameId),costs=projectOwnedRendererCostsV1(value,rendererMapping.binding),names=[...emitted].sort();const emittedCategories={count:names.length,sha256:sha(JSON.stringify(names)),first16:names.slice(0,16).map(text=>({text:text.slice(0,64),trueCharacters:text.length,truncated:text.length>64})),truncated:names.length>16||names.some(n=>n.length>64),requested:P.config.traceConfig.includedCategories.map(category=>({category,observed:emitted.has(category),meaning:emitted.has(category)?'actual-event-category-token':'not-observed-in-this-trace; support-unknown'}))};
  Object.assign(result,{status:'valid',identity:raw.identity,compressedBytes:compressed.length,compressedSha256:sha(compressed),decodedBytes:decoded.length,decodedSha256:sha(decoded),traceEventCount:value.traceEvents.length,metadataEventCount:metadata,emittedCategories,rendererMapping,costs});need(Buffer.byteLength(JSON.stringify(result))<=P.decoder.stdoutBytes-1024,'timeline-result-bound');
 }catch(error){const message=Object.getOwnPropertyDescriptor(error??{},'message')?.value;return freeze({...result,status:'invalid',reason:typeof message==='string'&&/^timeline-[a-z0-9-]{1,110}$/.test(message)?message:'timeline-gzip-utf8-or-json-invalid',identity:null,compressedBytes:null,compressedSha256:null,decodedBytes:null,decodedSha256:null,traceEventCount:null,metadataEventCount:null,emittedCategories:null,rendererMapping:null,costs:null});}
 return freeze(result);
}
