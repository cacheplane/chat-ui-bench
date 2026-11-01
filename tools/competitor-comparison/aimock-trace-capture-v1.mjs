// Maintained owned-page Aimock trace capture. No readiness or input authority.
import {mapAimockTraceRendererV1} from "./aimock-trace-renderer-v1.mjs";
// Stream, codec, limits and actual ownership remain the reviewed V1 controls.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(value,code)=>{if(!value)throw Error(code);};
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const safeInt=value=>Number.isSafeInteger(value)&&value>=0;
const flags={performance:false,scoringEligibility:false,FPS:null};
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}
export const AIMOCK_TRACE_LIMITS_V1=frozen({compressedBytes:1048576,chunkBytes:65536,maxReads:4096,decodedBytes:16777216,receiptBytes:16384,wrapperOverheadBytes:65536,base64Characters:1398104,wrapperBytes:1463640,evidenceBytes:2097152});
export const AIMOCK_TRACE_CONFIG_V1=frozen({transferMode:'ReturnAsStream',streamFormat:'json',streamCompression:'gzip',tracingBackend:'chrome',bufferUsageReportingInterval:1000,traceConfig:{recordMode:'recordUntilFull',traceBufferSizeInKb:4096,enableSampling:false,enableSystrace:false,includedCategories:['toplevel','devtools.timeline','renderer.scheduler','v8','disabled-by-default-v8.gc','disabled-by-default-devtools.timeline']}});
function own(value,key){const d=value&&Object.getOwnPropertyDescriptor(value,key);need(d&&Object.hasOwn(d,'value'),'timeline-own-data');return d.value;}
function record(value,required,optional=[]){need(value&&Object.getPrototypeOf(value)===Object.prototype,'timeline-record');const keys=Reflect.ownKeys(value);need(keys.every(k=>required.includes(k)||optional.includes(k))&&required.every(k=>keys.includes(k)),'timeline-fields');const r={};for(const k of keys)r[k]=own(value,k);return r;}
function boundedString(value,limit,code){need(typeof value==='string'&&value.length>0&&value.length<=limit,code);return value;}
function textPreview(text,limit=64){return typeof text==='string'?{text:text.slice(0,limit),trueCharacters:text.length,truncated:text.length>limit}:null;}
function errorPreview(error){try{return textPreview(own(error,'message'));}catch{return null;}}
function stringFact(text){return {...textPreview(text),sha256:sha(text)};}
function protocolChunk(raw){
 const v=record(raw,['data','eof'],['base64Encoded']);need(typeof v.data==='string'&&typeof v.eof==='boolean'&&(v.base64Encoded===undefined||typeof v.base64Encoded==='boolean'),'timeline-chunk-shape');
 let bytes;
 if(v.base64Encoded===true){need(v.data.length<=4*Math.ceil(65536/3)&&v.data.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.data),'timeline-chunk-base64');bytes=Buffer.from(v.data,'base64');need(bytes.toString('base64')===v.data,'timeline-chunk-base64');}
 else{need(v.data.length<=65536&&Buffer.byteLength(v.data,'utf8')<=65536,'timeline-chunk-size');bytes=Buffer.from(v.data,'utf8');}
 need(bytes.length<=65536,'timeline-chunk-size');need(v.eof||bytes.length>0,'timeline-chunk-no-progress');return {bytes,eof:v.eof};
}

/** Source-bound browser/context/page ports. All protocol Promise outcomes are
 * observed independently; attention, browser close and detach imply no EOF.
 */
export function createAimockTraceCaptureV1({now,origin,identity,wait,remaining,stageMs}){
 let setupEnd=null,setupClock=null,setupActive=false,setupReady=false,finishEnd=null,finishClock=null,finishAttention=null,completeOriginal=null,resolveComplete=null,drainOriginal=null;
 let sealed=false,snapshot=null,closing=false,browserCDP=null,pageCDP=null,stream=null,stopDispatched=false,completeSeen=false,startDispatched=false,startAck=false,ioCloseOriginal=null,ioCloseDispatched=false,draining=false,setupCalled=false,startReserved=false,stopBusy=false,closeBusy=false,endDispatchError=null;
 let retainedBytes=0,receivedBytes=0,eof=false,ioClosed=false,truncated=false,dataLossOccurred=null,publicAckMs=null;
 let inventory=null,protocolSupport=null,completion=null,stopReason=null,ownedContext=null,ownedPage=null,ownedMainFrame=null;
 let endOriginal=null;const held=new WeakMap(),attentions=new WeakMap();
 const chunks=[],owners=new Map(),originals=[],issues=[],hash=createHash('sha256');
 const usage={count:0,first:null,last:null,max:null};
 const stamp=()=>{try{const n=now();return finite(n)&&finite(origin)&&n>=origin?n-origin:null;}catch{return null;}};
 const issue=code=>{if(!sealed&&!issues.includes(code)&&issues.length<8)issues.push(code);};
 function preflight(){need(!sealed,'timeline-sealed');const left=remaining(),n=now();need(finite(n)&&finite(origin)&&n>=origin&&finite(left)&&left>0,'timeline-case-deadline');if(setupActive){need(n<setupEnd,'timeline-setup-deadline');need(issues.length===0,'timeline-setup-ownership-invalid');}if(finishEnd!==null)need(n<finishEnd,'timeline-finish-deadline');if(ownedContext&&!closing&&owners.get('finish')?.lastStatus!=='fulfilled')need(ownedContext.pages().length===1&&ownedContext.pages()[0]===ownedPage&&ownedPage.mainFrame()===ownedMainFrame,'timeline-owned-page-changed');}
 function attend(original,kind){
  if(attentions.has(original))return attentions.get(original);
  const row=held.get(original);let budget,end;
  try{preflight();const began=now();budget=Math.min(stageMs,remaining(),setupActive?setupEnd-began:Infinity,finishEnd===null?Infinity:finishEnd-began);need(finite(budget)&&budget>0,'timeline-attention-deadline');end=began+budget;if(row)row.attentionDeadlineMs=end-origin;}
  catch(error){if(!sealed&&row)row.attentionStatus='rejected';const rejected=Promise.reject(error);void rejected.catch(()=>{});attentions.set(original,rejected);return rejected;}
  const attentionOriginal=(async()=>{try{const value=await wait(original,budget,'matrix-trace-'+kind);preflight();need(now()<end,'timeline-attention-deadline');if(!sealed&&row){row.attentionStatus='fulfilled';row.attentionSettledMs=stamp();}return value;}catch(error){if(!sealed&&row){row.attentionStatus='rejected';row.attentionSettledMs=stamp();}throw error;}})();attentions.set(original,attentionOriginal);void attentionOriginal.catch(()=>{});return attentionOriginal;
 }
 function tracked(kind,start){
  need(!sealed,'timeline-sealed');preflight();let row=owners.get(kind);if(!row){row={kind,dispatched:0,fulfilled:0,rejected:0,pending:0,lastStatus:'unknown',lastDispatchedMs:null,lastSettledMs:null,attentionStatus:'pending',attentionDeadlineMs:null,attentionSettledMs:null,error:null};owners.set(kind,row);}
  row.dispatched++;row.pending++;row.lastStatus='unknown';row.attentionStatus='pending';row.attentionDeadlineMs=null;row.attentionSettledMs=null;row.lastDispatchedMs=stamp();
  let original;
  try{original=start();originals.push(original);held.set(original,row);Promise.prototype.then.call(original,
   ()=>{try{if(sealed)return;row.pending--;row.fulfilled++;row.lastStatus='fulfilled';row.lastSettledMs=stamp();if(kind==='trace-start')startAck=true;}catch{}},
   error=>{try{if(sealed)return;row.pending--;row.rejected++;row.lastStatus='rejected';row.lastSettledMs=stamp();row.error=errorPreview(error);issue('timeline-protocol-rejected');}catch{}});
  }catch(error){row.pending--;row.rejected++;row.lastStatus='rejected';row.lastSettledMs=stamp();row.error=errorPreview(error);issue('timeline-protocol-rejected');throw error;}
  return original;
 }
 function detach(){
  if(sealed)return [];const outcomes=[];
  for(const [kind,session]of [['page-detach',pageCDP],['browser-detach',browserCDP]])if(session&&!owners.has(kind))try{const original=tracked(kind,()=>session.detach());outcomes.push(attend(original,kind));}catch(error){outcomes.push(Promise.reject(error));}
  for(const p of outcomes)void p.catch(()=>issue('timeline-detach-attention-rejected'));return outcomes;
 }
 function closeIO(){
  if(sealed||stream===null)return null;if(ioCloseDispatched||closeBusy)return ioCloseOriginal;closeBusy=true;
  try{ioCloseOriginal=tracked('io-close',()=>{ioCloseDispatched=true;return pageCDP.send('IO.close',{handle:stream});});Promise.prototype.then.call(ioCloseOriginal,()=>{if(!sealed)ioClosed=true;},()=>{});void attend(ioCloseOriginal,'io-close').catch(()=>issue('timeline-io-close-attention-rejected'));return ioCloseOriginal;}catch{issue('timeline-io-close-rejected');return null;}finally{closeBusy=false;}
 }
 function stop(reason){
  if(sealed||stopDispatched||stopBusy||!startDispatched||!pageCDP)return;stopBusy=true;
  try{if(completeOriginal===null)completeOriginal=tracked('trace-complete',()=>new Promise(resolve=>{resolveComplete=resolve;}));endOriginal=tracked('trace-end',()=>{stopDispatched=true;stopReason=['functional-body-complete','before-browser-close','buffer-usage','event-mode'].includes(reason)?reason:'before-browser-close';return pageCDP.send('Tracing.end',{});});void attend(endOriginal,'trace-end').catch(()=>issue('timeline-end-attention-rejected'));}catch(error){endDispatchError=error;issue('timeline-end-rejected');}finally{stopBusy=false;}
 }
 async function drain(){
  if(draining||sealed)return;draining=true;
  try{
   for(let i=0;i<4096&&!sealed;i++){
    const raw=await attend(tracked('io-read',()=>pageCDP.send('IO.read',{handle:stream,size:65536})),'io-read');if(sealed)return;
    const next=protocolChunk(raw);receivedBytes+=next.bytes.length;if(next.eof)eof=true;
    const left=1048576-retainedBytes,part=next.bytes.subarray(0,left);
    if(part.length){const retained=Buffer.from(part);chunks.push(retained);hash.update(retained);retainedBytes+=retained.length;}
    if(next.bytes.length>left){truncated=true;issue('timeline-compressed-cap');break;}
    if(eof)break;
    if(i===4095)issue('timeline-read-cap');
   }
  }catch(error){issue('timeline-stream-incomplete');throw error;}
  finally{if(!sealed){const original=closeIO();if(original)try{await attend(original,'io-close');}catch{}if(!sealed)await Promise.allSettled(detach());}}
 }
 const onComplete=input=>{
  try{
   if(sealed)return;if(completeSeen){issue('timeline-duplicate-complete');return;}completeSeen=true;resolveComplete?.(input);need(stopDispatched,'timeline-unsolicited-complete');
   const c=record(input,['dataLossOccurred'],['stream','traceFormat','streamCompression']);
   dataLossOccurred=typeof c.dataLossOccurred==='boolean'?c.dataLossOccurred:null;
   completion={observedMs:stamp(),dataLossOccurred,traceFormat:typeof c.traceFormat==='string'?c.traceFormat.slice(0,16):null,streamCompression:typeof c.streamCompression==='string'?c.streamCompression.slice(0,16):null};
   need(dataLossOccurred!==null,'timeline-loss-unknown');if(dataLossOccurred)issue('timeline-data-loss');
   need(c.traceFormat==='json'&&c.streamCompression==='gzip','timeline-complete-format');stream=boundedString(c.stream,256,'timeline-stream-handle');
   drainOriginal=tracked('stream-drain',()=>drain());void attend(drainOriginal,'stream-drain').catch(()=>{issue('timeline-stream-incomplete');});
  }catch{issue('timeline-complete-invalid');}
 };
 const onUsage=input=>{try{if(sealed)return;const v=record(input,[],['percentFull','eventCount','value']);const amounts=[v.percentFull,v.value].filter(x=>x!==undefined);need(amounts.length>0&&amounts.every(x=>finite(x)&&x<=1)&&(v.eventCount===undefined||safeInt(v.eventCount)),'timeline-buffer-usage');const amount=Math.max(...amounts);usage.count++;usage.first??=amount;usage.last=amount;usage.max=usage.max===null?amount:Math.max(usage.max,amount);if(amount>=0.9){issue('timeline-buffer-usage90');stop('buffer-usage');}}catch{issue('timeline-buffer-usage-invalid');}};
 const onData=()=>{if(!sealed){issue('timeline-unexpected-event-mode');stop('event-mode');}};
 function captureComplete(){return protocolSupport!==null&&startAck&&stopDispatched&&completeSeen&&dataLossOccurred===false&&eof&&ioClosed&&!truncated&&issues.length===0&&[...owners.values()].every(row=>row.pending===0&&row.rejected===0&&row.fulfilled===row.dispatched&&row.attentionStatus==='fulfilled'&&finite(row.lastDispatchedMs)&&finite(row.lastSettledMs)&&finite(row.attentionDeadlineMs)&&finite(row.attentionSettledMs)&&row.lastSettledMs>=row.lastDispatchedMs&&row.attentionSettledMs>=row.lastSettledMs&&row.attentionSettledMs<row.attentionDeadlineMs);}
 function beginFinish(reason){
  if(finishAttention!==null)return finishAttention;
  try{preflight();const began=now(),budget=Math.min(stageMs,remaining());need(finite(budget)&&budget>0,'timeline-finish-budget');finishEnd=began+budget;finishClock={startedMs:began-origin,deadlineMs:finishEnd-origin,budgetMs:budget};
   const original=tracked('finish',()=> (async()=>{stop(reason);if(endDispatchError)throw endDispatchError;need(endOriginal!==null&&completeOriginal!==null,'timeline-end-unavailable');await attend(endOriginal,'trace-end');await attend(completeOriginal,'trace-complete');need(drainOriginal!==null,'timeline-drain-unavailable');await attend(drainOriginal,'stream-drain');need(eof&&ioClosed&&!truncated&&issues.length===0,'timeline-finish-incomplete');for(const kind of ['io-close','page-detach','browser-detach'])need(owners.get(kind)?.lastStatus==='fulfilled'&&owners.get(kind)?.attentionStatus==='fulfilled','timeline-finish-release-incomplete');})());finishAttention=attend(original,'finish');
  }catch(error){finishAttention=Promise.reject(error);void finishAttention.catch(()=>{});issue('timeline-finish-refused');}return finishAttention;
 }
 return Object.freeze({
  async setup({browser,context,page,expectedOrigin}){
   need(!setupCalled&&!sealed,'timeline-setup-once');setupCalled=true;preflight();need(finite(stageMs)&&stageMs>0&&stageMs<=10000,'timeline-setup-budget');const started=now(),budget=Math.min(stageMs,remaining());setupEnd=started+budget;setupClock={startedMs:started-origin,deadlineMs:setupEnd-origin,budgetMs:budget};setupActive=true;
   try{
    need(context.pages().length===1&&context.pages()[0]===page,'timeline-owned-one-page');ownedContext=context;ownedPage=page;ownedMainFrame=page.mainFrame();need(ownedMainFrame&&typeof ownedMainFrame==='object','timeline-owned-main-frame');const live=()=>!sealed&&!closing&&owners.get('finish')?.lastStatus!=='fulfilled';page.on('framenavigated',frame=>{if(live()&&frame===ownedMainFrame)issue('timeline-owned-navigation');});page.on('close',()=>{if(live())issue('timeline-owned-page-closed');});context.on('page',()=>{if(live())issue('timeline-owned-extra-page');});const version=boundedString(browser.version(),256,'timeline-browser-version');
    browserCDP=await attend(tracked('browser-session',()=>browser.newBrowserCDPSession()),'browser-session');need(!sealed&&!closing,'timeline-setup-closed');
    pageCDP=await attend(tracked('page-session',()=>context.newCDPSession(page)),'page-session');need(!sealed&&!closing,'timeline-setup-closed');
    pageCDP.on('Tracing.tracingComplete',onComplete);pageCDP.on('Tracing.bufferUsage',onUsage);pageCDP.on('Tracing.dataCollected',onData);
    const frames=await attend(tracked('frame-tree',()=>pageCDP.send('Page.getFrameTree',{})),'frame-tree');need(!sealed&&!closing,'timeline-setup-closed');
    const frame=own(own(frames,'frameTree'),'frame'),frameId=boundedString(own(frame,'id'),128,'timeline-frame-id'),url=boundedString(own(frame,'url'),2048,'timeline-frame-url');need(new URL(url).origin===expectedOrigin,'timeline-frame-origin');
    const targetReply=await attend(tracked('target-info',()=>pageCDP.send('Target.getTargetInfo',{})),'target-info');need(!sealed&&!closing,'timeline-setup-closed');
    const target=own(targetReply,'targetInfo'),targetId=boundedString(own(target,'targetId'),128,'timeline-target-id');need(own(target,'type')==='page'&&own(target,'url')===url,'timeline-owned-target');
    inventory={oneOwnedPage:true,mainFrameId:frameId,targetId,documentURL:stringFact(url),origin:stringFact(expectedOrigin),browserVersion:textPreview(version),rendererMapping:'unavailable-until-actual-trace-metadata'};
    startReserved=true;await attend(tracked('trace-start',()=>{startDispatched=true;return pageCDP.send('Tracing.start',AIMOCK_TRACE_CONFIG_V1);}),'trace-start');need(!sealed&&!closing,'timeline-setup-closed');
    const supported=await attend(tracked('active-page-categories',()=>pageCDP.send('Tracing.getCategories',{})),'active-page-categories');need(!sealed&&!closing,'timeline-setup-closed');
    const supportOwner=owners.get('active-page-categories');need(supportOwner.lastStatus==='fulfilled'&&finite(supportOwner.lastSettledMs)&&supportOwner.lastSettledMs<setupClock.deadlineMs,'timeline-support-original-not-on-time');
    const list=own(supported,'categories');need(Array.isArray(list)&&list.length<=4096,'timeline-categories');const names=[];for(let i=0;i<list.length;i++)names.push(boundedString(own(list,String(i)),256,'timeline-category-name'));
    const requested=AIMOCK_TRACE_CONFIG_V1.traceConfig.includedCategories,found=requested.filter(name=>names.includes(name));protocolSupport={stage:'active-page-categories',requested:[...requested],supportedRequested:found,returnedCount:names.length,returnedSha256:sha(JSON.stringify(names)),returnedFirst8:names.slice(0,8).map(name=>textPreview(name,32)),originalSettledMs:supportOwner.lastSettledMs,setupDeadlineMs:setupClock.deadlineMs};need(found.length===requested.length&&names.length>0,'timeline-category-unsupported');
    preflight();setupActive=false;setupReady=true;
   }catch(error){issue('timeline-setup-failed');throw error;}
  },
  assertBeforeStart(){need(setupReady&&startAck&&protocolSupport!==null&&!setupActive&&!sealed&&!closing&&publicAckMs===null&&issues.length===0,'timeline-prestart-ownership-invalid');preflight();need(now()<setupEnd,'timeline-setup-deadline');},
  markPublicAck(){need(setupReady&&startAck&&protocolSupport!==null&&!setupActive&&!sealed&&!closing&&publicAckMs===null&&issues.length===0,'timeline-start-ack-required');preflight();publicAckMs=stamp();},
  finish(){if(finishAttention!==null)return finishAttention;need(setupReady&&publicAckMs!==null&&!sealed&&!closing,'timeline-finish-before-body');return beginFinish('functional-body-complete');},
  beforeBrowserClose(){if(!sealed){closing=true;setupActive=false;if(startDispatched&&owners.get('trace-start')?.lastStatus!=='rejected')void beginFinish('before-browser-close').catch(()=>{});}},
  afterBrowserClose(){if(!sealed){closeIO();detach();}},
  seal(){
   if(snapshot!==null)return snapshot;
   sealed=true;const unsafeOutstanding=[...owners.values()].some(row=>row.pending>0);
   const ownerList=[...owners.values()],fulfilled=kind=>owners.get(kind)?.lastStatus==='fulfilled';
   const complete=captureComplete()&&fulfilled('finish')&&!unsafeOutstanding;
   const payloadBase64=Buffer.concat(chunks,retainedBytes).toString('base64');
   const receipt={schema:'aimock-trace-capture-v1',identity,nodeClock:'node-performance-relative-to-case-start',setupClock,finishClock,sealedMs:stamp(),publicAckMs,config:AIMOCK_TRACE_CONFIG_V1,limits:AIMOCK_TRACE_LIMITS_V1,protocolSupport,inventory,startDispatched,startAcknowledged:startAck,stopDispatched,stopReason,tracingCompleteSeen:completeSeen,completion,dataLossOccurred,bufferUsage:usage,eof,ioClosed,truncated,retainedBytes,receivedBytes,totalOriginalCompressedBytes:eof?receivedBytes:null,payloadSha256:hash.digest('hex'),owners:ownerList,issues,complete,unsafeOutstanding,...flags};
   need(Buffer.byteLength(JSON.stringify(receipt))<=16384,'timeline-receipt-bound');snapshot=frozen({receipt:JSON.parse(JSON.stringify(receipt)),payloadBase64});return snapshot;
  },
 });
}

/** Post-seal only. Never called on the acquisition or ordinary cleanup path. */
export function validateAimockTraceV1(snapshot){
 const result={schema:'aimock-trace-validation-v1',status:'invalid',reason:null,decodedBytes:null,decodedSha256:null,traceEventCount:null,metadataEventCount:null,rendererMapping:{status:'unavailable'},...flags};
 try{
  const {receipt:r,payloadBase64}=snapshot;
  need(typeof payloadBase64==='string'&&payloadBase64.length<=1398104&&payloadBase64.length%4===0,'timeline-payload-base64');
  const compressed=Buffer.from(payloadBase64,'base64');need(compressed.toString('base64')===payloadBase64&&compressed.length===r.retainedBytes&&compressed.length<=1048576&&sha(compressed)===r.payloadSha256,'timeline-payload-integrity');
  if(!r.complete){result.status='capture-incomplete';result.reason='timeline-capture-incomplete';return frozen(result);}
  need(r.schema==='aimock-trace-capture-v1'&&r.performance===false&&r.scoringEligibility===false&&r.FPS===null&&r.startDispatched===true&&r.startAcknowledged===true&&r.stopDispatched===true&&r.tracingCompleteSeen===true&&r.dataLossOccurred===false&&r.eof===true&&r.ioClosed===true&&r.truncated===false&&r.unsafeOutstanding===false&&r.issues.length===0,'timeline-capture-facts');
  need(JSON.stringify(r.config)===JSON.stringify(AIMOCK_TRACE_CONFIG_V1)&&JSON.stringify(r.limits)===JSON.stringify(AIMOCK_TRACE_LIMITS_V1)&&r.completion?.dataLossOccurred===false&&r.completion.traceFormat==='json'&&r.completion.streamCompression==='gzip'&&r.totalOriginalCompressedBytes===r.receivedBytes&&r.retainedBytes===r.receivedBytes,'timeline-capture-facts');
  need(r.protocolSupport?.stage==='active-page-categories'&&JSON.stringify(r.protocolSupport.requested)===JSON.stringify(AIMOCK_TRACE_CONFIG_V1.traceConfig.includedCategories)&&JSON.stringify(r.protocolSupport.supportedRequested)===JSON.stringify(AIMOCK_TRACE_CONFIG_V1.traceConfig.includedCategories)&&r.protocolSupport.returnedCount>=6&&r.protocolSupport.returnedCount<=4096&&finite(r.protocolSupport.originalSettledMs)&&r.protocolSupport.originalSettledMs<r.protocolSupport.setupDeadlineMs&&r.protocolSupport.setupDeadlineMs===r.setupClock?.deadlineMs,'timeline-support-facts');
  const expectedOwners=['browser-session','page-session','frame-tree','target-info','trace-start','active-page-categories','trace-end','trace-complete','stream-drain','finish','io-read','io-close','page-detach','browser-detach'];
  need(Array.isArray(r.owners)&&r.owners.length===expectedOwners.length&&new Set(r.owners.map(o=>o.kind)).size===expectedOwners.length&&expectedOwners.every(kind=>r.owners.some(o=>o.kind===kind)),'timeline-owner-facts');
  for(const clock of [r.setupClock,r.finishClock])need(clock&&finite(clock.startedMs)&&finite(clock.deadlineMs)&&finite(clock.budgetMs)&&clock.budgetMs>0&&clock.budgetMs<=10000&&clock.deadlineMs>clock.startedMs&&Math.abs(clock.deadlineMs-clock.startedMs-clock.budgetMs)<0.000001,'timeline-phase-clock');
  need(finite(r.publicAckMs)&&r.publicAckMs>=r.setupClock.startedMs&&r.finishClock.startedMs>=r.publicAckMs&&finite(r.sealedMs)&&r.sealedMs>=r.finishClock.startedMs,'timeline-phase-clock');
  for(const owner of r.owners){need(safeInt(owner.dispatched)&&owner.dispatched>=1&&owner.dispatched<=(owner.kind==='io-read'?4096:1)&&owner.fulfilled===owner.dispatched&&owner.rejected===0&&owner.pending===0&&owner.lastStatus==='fulfilled'&&owner.attentionStatus==='fulfilled','timeline-owner-facts');const clock=expectedOwners.indexOf(owner.kind)<6?r.setupClock:r.finishClock;need(finite(owner.lastDispatchedMs)&&finite(owner.lastSettledMs)&&finite(owner.attentionDeadlineMs)&&finite(owner.attentionSettledMs)&&owner.lastDispatchedMs>=clock.startedMs&&owner.lastSettledMs>=owner.lastDispatchedMs&&owner.attentionSettledMs>=owner.lastSettledMs&&owner.attentionSettledMs<owner.attentionDeadlineMs&&owner.attentionDeadlineMs<=clock.deadlineMs+0.000001&&owner.attentionSettledMs<=r.sealedMs,'timeline-owner-clock');}
  const decoded=gunzipSync(compressed,{maxOutputLength:16777216});need(decoded.length<=16777216,'timeline-decompressed-cap');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(decoded),value=JSON.parse(text);need(value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.traceEvents),'timeline-trace-json');
  let metadata=0;const emitted=new Set();
  for(const event of value.traceEvents){
   need(event&&typeof event==='object'&&!Array.isArray(event)&&typeof event.ph==='string'&&event.ph.length>0&&event.ph.length<=4&&typeof event.name==='string'&&event.name.length<=1024,'timeline-trace-event');
   for(const key of ['pid','tid'])if(event[key]!==undefined)need(safeInt(event[key]),'timeline-trace-process');
   for(const key of ['ts','dur'])if(event[key]!==undefined)need(finite(event[key]),'timeline-trace-time');
   if(event.cat!==undefined){need(typeof event.cat==='string'&&event.cat.length<=4096,'timeline-event-category');for(const name of event.cat.split(',').filter(Boolean))emitted.add(name);}
   if(event.ph==='M')metadata++;
  }
  need(metadata>0,'timeline-required-metadata');result.rendererMapping=mapAimockTraceRendererV1(value,r.inventory.mainFrameId);
  const names=[...emitted].sort();result.emittedCategories={count:names.length,sha256:sha(JSON.stringify(names)),first16:names.slice(0,16).map(name=>textPreview(name)),truncated:names.length>16||names.some(name=>name.length>64),requested:AIMOCK_TRACE_CONFIG_V1.traceConfig.includedCategories.map(category=>({category,observed:emitted.has(category),meaning:emitted.has(category)?'actual-event-category-token':'not-observed-in-this-trace; support-unknown'}))};
  result.status='valid';result.decodedBytes=decoded.length;result.decodedSha256=sha(decoded);result.traceEventCount=value.traceEvents.length;result.metadataEventCount=metadata;
 }catch(error){const descriptor=error&&Object.getOwnPropertyDescriptor(error,'message');const text=descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:null;result.reason=typeof text==='string'&&/^timeline-[a-z0-9-]+$/.test(text)?text:'timeline-gzip-utf8-or-json-invalid';}
 return frozen(result);
}
export function createAimockTraceEvidenceV1(snapshot,validation){
 const wrapper={schema:'aimock-trace-evidence-v1',traceFormat:'json',compression:'gzip',payloadEncoding:'base64',retainedCompressedBytes:snapshot.receipt.retainedBytes,compressedSha256:snapshot.receipt.payloadSha256,capture:snapshot.receipt,validation,payloadBase64:snapshot.payloadBase64,...flags};
 const overhead={...wrapper,payloadBase64:''};need(Buffer.byteLength(JSON.stringify(overhead))<=65536,'timeline-wrapper-overhead');need(wrapper.payloadBase64.length<=1398104&&Buffer.byteLength(JSON.stringify(wrapper))<=1463640&&Buffer.byteLength(JSON.stringify(wrapper))<=2097152,'timeline-wrapper-bound');return frozen(wrapper);
}

