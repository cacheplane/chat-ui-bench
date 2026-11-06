import {createHash} from 'node:crypto';
import {CPU_PROFILE_V2_LIMITS} from './aimock-cpu-profile-v2.mjs';

export const STOCK037_CPU_DIAGNOSTIC_ID_V1='threadplane-h10000-r6400-follow-stock037-cpu-samples-v1';
const VERSION='156.0.8078.4',REVISION='f842f52ef39fd97b449eb27cff414bf05a98ddce';
const RECEIPT_BYTES=16384,INTERVAL_US=10000,CAPTURE_MS=30000;
const flags={performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(value,reason)=>{if(!value)throw Error('stock037-cpu-'+reason);};
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
function exact(value,keys,reason){need(record(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),reason);}
function canonicalProfile(reply){
 exact(reply,['profile'],'stop-envelope');const p=reply.profile;
 need(record(p)&&Array.isArray(p.nodes)&&p.nodes.length<=CPU_PROFILE_V2_LIMITS.maxNodes,'profile-nodes-bound');
 need(Array.isArray(p.samples)&&p.samples.length<=CPU_PROFILE_V2_LIMITS.maxSamples&&Array.isArray(p.timeDeltas)&&p.timeDeltas.length<=CPU_PROFILE_V2_LIMITS.maxSamples,'profile-samples-bound');
 let ticks=0,edges=0;
 for(const n of p.nodes){
  need(record(n),'profile-node-bound');
  if(n.children!==undefined){need(Array.isArray(n.children),'profile-children-bound');edges+=n.children.length;need(edges<=CPU_PROFILE_V2_LIMITS.maxNodes,'profile-children-bound');}
  if(n.positionTicks!==undefined){need(Array.isArray(n.positionTicks),'profile-ticks-bound');ticks+=n.positionTicks.length;need(ticks<=CPU_PROFILE_V2_LIMITS.maxPositionTicks,'profile-ticks-bound');}
 }
 // Trusted CDP JSON only: a practical bounded walk before exact serialization.
 // This cap does not bound Chromium/CDP's prior whole-object allocation.
 const pending=[[p,0]];let entries=0;
 while(pending.length){
  const [v,depth]=pending.pop();need(depth<=32&&++entries<=1500000,'profile-structure-bound');
  if(v===null||typeof v==='boolean')continue;
  if(typeof v==='number'){need(Number.isFinite(v),'profile-number');continue;}
  if(typeof v==='string'){need(v.length<=CPU_PROFILE_V2_LIMITS.maxProfileBytes,'profile-string-bound');continue;}
  need(typeof v==='object','profile-json');const keys=Object.keys(v);need(keys.length<=CPU_PROFILE_V2_LIMITS.maxSamples&&pending.length+keys.length+entries<=1500000,'profile-structure-bound');
  for(const k of keys){need(k.length<=CPU_PROFILE_V2_LIMITS.maxProfileBytes,'profile-string-bound');pending.push([v[k],depth+1]);}
 }
 const json=JSON.stringify(p);need(Buffer.byteLength(json)<=CPU_PROFILE_V2_LIMITS.maxProfileBytes,'profile-byte-cap');return json;
}

/** Fixed supplemental acquisition owner. No analyzer or native admission authority. */
export function createStock037CpuCaptureV1(ports){
 need(arguments.length===1,'arguments');exact(ports,['now','origin','identity','wait','remaining','stageMs','assetHashes'],'ports');
 const {now,origin,identity,wait,remaining,stageMs,assetHashes}=ports;
 need(typeof now==='function'&&typeof wait==='function'&&typeof remaining==='function'&&finite(origin)&&stageMs===10000,'ports');
 exact(identity,['id','profile','historyCount','responseBytes','journey','stockVersion','buildSha256'],'identity');
 need(identity.id===STOCK037_CPU_DIAGNOSTIC_ID_V1&&identity.profile==='threadplane'&&identity.historyCount===10000&&identity.responseBytes===6400&&identity.journey==='follow'&&identity.stockVersion==='0.3.7'&&/^[a-f0-9]{64}$/.test(identity.buildSha256),'identity');
 need(record(assetHashes)&&Object.keys(assetHashes).length<=256,'assets');
 for(const [key,value]of Object.entries(assetHashes))need(key.length>0&&key.length<=2048&&key.split('/').every(p=>/^[A-Za-z0-9._~-]+$/.test(p)&&p!=='.'&&p!=='..')&&typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'assets');
 const fixedIdentity=JSON.parse(JSON.stringify(identity)),fixedAssets=JSON.parse(JSON.stringify(assetHashes));
 let session=null,ownedPage=null,ownedContext=null,ownedFrame=null,browser=null,setupCalled=false,ready=false,startCalled=false,startDispatched=false,startAcknowledged=false,publicAckMs=null,closing=false,sealed=false,snapshot=null;
 let setupEnd=null,setupClock=null,startClock=null,finishClock=null,inventory=null,rawJson=null,bindingJson=null,startAttention=null,stopOriginal=null,releaseOriginal=null,finishAttention=null,timer=null;
 const rows=new Map(),attention=new WeakMap(),issues=[],listeners=[];
 const watchdog={scheduled:false,deadlineMs:null,expired:false,cancelled:false};
 const stamp=()=>{const n=now();return finite(n)&&n>=origin?n-origin:null;};
 const issue=code=>{if(!issues.includes(code))issues.push(code);};
 function available(){need(finite(now())&&now()>=origin&&finite(remaining())&&remaining()>0,'absolute-deadline');}
 function owned(){need(ownedContext.pages().length===1&&ownedContext.pages()[0]===ownedPage&&ownedPage.mainFrame()===ownedFrame,'owned-page-changed');}
 function listen(target,event,fn){target.on(event,fn);listeners.push([target,event,fn]);}
 function cancelWatchdog(){if(timer!==null){clearTimeout(timer);timer=null;}if(watchdog.scheduled)watchdog.cancelled=true;}
 function checkCaptureDeadline(){if(startClock!==null&&now()-origin>=startClock.captureDeadlineMs){watchdog.expired=true;issue('stock037-cpu-watchdog-expired');}}
 function track(kind,operation,onValue){
  available();need(!rows.has(kind),'duplicate-operation');
  const row={kind,status:'pending',dispatchedMs:stamp(),settledMs:null,attentionStatus:'pending',attentionDeadlineMs:null,attentionSettledMs:null,error:null};rows.set(kind,row);
  let original;try{original=Promise.resolve(operation());}catch(error){original=Promise.reject(error);}
  void original.then(value=>{row.status='fulfilled';row.settledMs=stamp();try{onValue?.(value);}catch(error){issue(error.message.startsWith('stock037-cpu-')?error.message:'stock037-cpu-reply-invalid');}},error=>{row.status='rejected';row.settledMs=stamp();row.error=typeof error?.message==='string'?error.message.slice(0,128):'operation rejected';issue('stock037-cpu-'+kind+'-rejected');});
  return {original,row};
 }
 function attend(op,setup=false){
  if(attention.has(op.original))return attention.get(op.original);
  let end,budget;
  try{available();budget=Math.min(stageMs,remaining(),setup?setupEnd-now():Infinity);need(finite(budget)&&budget>0,'attention-deadline');end=now()+budget;op.row.attentionDeadlineMs=end-origin;}
  catch(error){op.row.attentionStatus='rejected';op.row.attentionSettledMs=stamp();issue('stock037-cpu-'+op.row.kind+'-attention');const p=Promise.reject(error);void p.catch(()=>{});attention.set(op.original,p);return p;}
  const p=(async()=>{try{const value=await wait(op.original,budget,'stock037-cpu-'+op.row.kind);available();need(now()<end,'attention-deadline');op.row.attentionStatus='fulfilled';op.row.attentionSettledMs=stamp();return value;}catch(error){op.row.attentionStatus='rejected';op.row.attentionSettledMs=stamp();issue('stock037-cpu-'+op.row.kind+'-attention');throw error;}})();void p.catch(()=>{});attention.set(op.original,p);return p;
 }
 function command(kind,method,params={},setup=false,onValue){return attend(track(kind,()=>session.send(method,params),onValue),setup);}
 function ensureStop(){
  if(stopOriginal!==null)return stopOriginal;
  if(!session||!startDispatched)return null;
  stopOriginal=track('stop',()=>session.send('Profiler.stop',{}),reply=>{checkCaptureDeadline();cancelWatchdog();const json=canonicalProfile(reply);if(!sealed)rawJson=json;});return stopOriginal;
 }
 function release(){
  if(releaseOriginal!==null)return releaseOriginal;
  if(!session)return Promise.resolve();
  releaseOriginal=(async()=>{
   try{await command('disable','Profiler.disable');}catch{issue('stock037-cpu-disable-unconfirmed');}
   try{await attend(track('detach',()=>session.detach()));}catch{issue('stock037-cpu-detach-unconfirmed');}
   cancelWatchdog();
  })();void releaseOriginal.catch(()=>{});return releaseOriginal;
 }
 function beginFinish(){
  if(finishAttention!==null)return finishAttention;
  checkCaptureDeadline();
  closing=true;finishClock={startedMs:stamp(),attentionBudgetMs:Math.max(0,Math.min(stageMs,remaining()))};
  let op;
  try{op=track('finish',async()=>{
   try{const stop=ensureStop();if(stop!==null)await attend(stop);}
   finally{await release();}
   need(startAcknowledged&&publicAckMs!==null&&rawJson!==null&&issues.length===0,'incomplete');
  });finishAttention=attend(op);}
  catch(error){issue('stock037-cpu-finish-refused');finishAttention=Promise.reject(error);void finishAttention.catch(()=>{});}
  return finishAttention;
 }
 const api={
  async setup(input){
   need(!setupCalled&&!sealed,'setup-once');setupCalled=true;exact(input,['browser','context','page','expectedOrigin'],'setup-ports');
   const {expectedOrigin}=input;let url;try{url=new URL(expectedOrigin);}catch{}need(url&&url.origin===expectedOrigin&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,'origin');
   browser=input.browser;ownedContext=input.context;ownedPage=input.page;ownedFrame=ownedPage.mainFrame();available();owned();setupEnd=now()+Math.min(stageMs,remaining());setupClock={startedMs:stamp(),deadlineMs:setupEnd-origin};
   listen(browser,'disconnected',()=>{if(rows.get('detach')?.status!=='fulfilled')issue('stock037-cpu-browser-disconnected');});
   listen(ownedPage,'close',()=>{if(rows.get('detach')?.status!=='fulfilled')issue('stock037-cpu-page-closed');});
   listen(ownedPage,'framenavigated',()=>issue('stock037-cpu-navigation'));
   listen(ownedContext,'page',()=>issue('stock037-cpu-extra-page'));
   try{
    const created=track('session',()=>ownedContext.newCDPSession(ownedPage),value=>{
     session=value;if(!sealed)listen(session,'close',()=>{if(!rows.has('detach'))issue('stock037-cpu-session-closed');});
     if(closing||sealed||rows.get('session').attentionStatus==='rejected')void release();
    });
    await attend(created,true);need(!closing&&!sealed,'setup-closed');
    const version=await command('version','Browser.getVersion',{},true);need(record(version)&&Buffer.byteLength(JSON.stringify(version))<=4096,'version-reply');
    const product=version.product,revision=version.revision;need(typeof product==='string'&&new RegExp('^(?:Chrome|HeadlessChrome)/'+VERSION.replaceAll('.','\\.')+'$').test(product)&&typeof revision==='string'&&revision.replace(/^@/,'')===REVISION,'browser-version');
    const tree=await command('frame','Page.getFrameTree',{},true),target=await command('target','Target.getTargetInfo',{},true);
    const frame=tree?.frameTree?.frame,info=target?.targetInfo;need(record(frame)&&typeof frame.id==='string'&&frame.id.length>0&&frame.id.length<=256&&record(info)&&info.type==='page'&&typeof info.targetId==='string'&&info.targetId.length>0&&info.targetId.length<=256,'inventory');
    need(new URL(frame.url).origin===expectedOrigin&&new URL(info.url).origin===expectedOrigin&&frame.url===info.url&&frame.url.length<=2048,'owned-origin');
    inventory={browserVersion:product.slice(product.indexOf('/')+1),browserProduct:product,chromiumRevision:revision.replace(/^@/,''),versionReply:JSON.parse(JSON.stringify(version)),mainFrameId:frame.id,targetId:info.targetId,url:frame.url,expectedOrigin,pageCount:ownedContext.pages().length};
    bindingJson=JSON.stringify({schema:'chrome156-cpu-source-context-v2',browserVersion:inventory.browserVersion,chromiumRevision:inventory.chromiumRevision,origin:expectedOrigin,assetHashes:fixedAssets});need(Buffer.byteLength(bindingJson)<=CPU_PROFILE_V2_LIMITS.maxBindingBytes,'binding-byte-cap');
    await command('enable','Profiler.enable',{},true);await command('interval','Profiler.setSamplingInterval',{interval:INTERVAL_US},true);owned();need(!closing&&!sealed&&issues.length===0&&now()<setupEnd,'setup-incomplete');ready=true;
   }catch(error){issue('stock037-cpu-setup-failed');throw error;}
  },
  start(){
   need(ready&&!startCalled&&!closing&&!sealed&&issues.length===0,'start-state');startCalled=true;available();owned();need(now()<setupEnd,'setup-deadline');
   const op=track('start',()=>{
    startDispatched=true;const started=now(),budget=Math.min(CAPTURE_MS,remaining());startClock={dispatchedMs:stamp(),captureDeadlineMs:started+budget-origin};watchdog.scheduled=true;watchdog.deadlineMs=startClock.captureDeadlineMs;
    timer=setTimeout(()=>{timer=null;watchdog.expired=true;issue('stock037-cpu-watchdog-expired');void beginFinish().catch(()=>{});},budget);timer.unref?.();
    return session.send('Profiler.start',{});
   },()=>{startAcknowledged=true;});startAttention=attend(op,true);return startAttention;
  },
  markPublicAck(){need(ready&&!closing&&!sealed&&startAcknowledged&&rows.get('start')?.attentionStatus==='fulfilled'&&publicAckMs===null&&issues.length===0,'public-ack');available();owned();need(now()<setupEnd&&now()-origin<startClock.captureDeadlineMs,'setup-deadline');publicAckMs=stamp();},
  finish(){need(!sealed,'sealed');try{owned();}catch(error){issue('stock037-cpu-owned-page-changed');}return beginFinish();},
  beforeBrowserClose(){return sealed?null:beginFinish();},
  afterBrowserClose(){closing=true;cancelWatchdog();if(!sealed)void release();},
  seal(){
   if(snapshot!==null)return snapshot;sealed=true;cancelWatchdog();for(const [target,event,fn]of listeners)target.off(event,fn);
   for(const row of rows.values()){
    if(row.status!=='fulfilled'||row.attentionStatus!=='fulfilled')continue;
    const clocks=[row.dispatchedMs,row.settledMs,row.attentionSettledMs,row.attentionDeadlineMs];
    if(!clocks.every(finite)||!(row.dispatchedMs<=row.settledMs&&row.settledMs<=row.attentionSettledMs&&row.attentionSettledMs<row.attentionDeadlineMs))issue('stock037-cpu-original-clocks');
   }
   const owners=[...rows.values()].map(row=>({...row})),unsafeOutstanding=owners.some(row=>row.status==='pending')||(session!==null&&rows.get('detach')?.status!=='fulfilled');
   const required=['session','version','frame','target','enable','interval','start','stop','disable','detach','finish'];
   const complete=ready&&startAcknowledged&&publicAckMs!==null&&rawJson!==null&&bindingJson!==null&&!unsafeOutstanding&&issues.length===0&&required.every(kind=>rows.get(kind)?.status==='fulfilled'&&rows.get(kind)?.attentionStatus==='fulfilled');
   const fact=json=>json===null?null:{bytes:Buffer.byteLength(json),sha256:sha(json)};
   const receipt={schema:'stock037-cpu-capture-receipt-v1',identity:fixedIdentity,nodeClock:'node-performance-relative-to-case-start',setupClock,startClock,finishClock,sealedMs:stamp(),publicAckMs,inventory,samplingIntervalUs:INTERVAL_US,captureLimitMs:CAPTURE_MS,watchdog:{...watchdog},owners,issues:[...issues],raw:fact(rawJson),binding:fact(bindingJson),complete,unsafeOutstanding,resourceScope:'Caps bound retained/analyzed bytes, not Chromium/CDP whole-object transport allocation.',limits:{rawBytes:CPU_PROFILE_V2_LIMITS.maxProfileBytes,bindingBytes:CPU_PROFILE_V2_LIMITS.maxBindingBytes,receiptBytes:RECEIPT_BYTES},...flags};
   need(Buffer.byteLength(JSON.stringify(receipt))<=RECEIPT_BYTES,'receipt-byte-cap');snapshot=freeze(JSON.parse(JSON.stringify({receipt,rawJson,bindingJson})));return snapshot;
  },
 };
 return Object.freeze(api);
}
