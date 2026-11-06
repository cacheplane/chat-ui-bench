import {createHash} from 'node:crypto';

/** Pure data validation only. Acquisition, source custody and owners are separate gates. */
export const CPU_PROFILE_V2_LIMITS=Object.freeze({maxProfileBytes:2097152,maxBindingBytes:65536,maxNodes:100000,maxSamples:200000,maxWindowUs:240000000,maxPositionTicks:200000,maxResultBytes:32768,topNodes:8});
const VERSION='156.0.8078.4',REVISION='f842f52ef39fd97b449eb27cff414bf05a98ddce';
const SOURCE_PINS=Object.freeze({v8Revision:'b976f35da8356fcf4e5e176d1d810ba6a6f05718',devToolsRevision:'2d671c506c4e5f8958b027e26047deb0acfbd7f9'});
const sha=text=>createHash('sha256').update(text).digest('hex');
const need=(value,reason)=>{if(!value)throw Error('cpu-profile-v2-'+reason);};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const safe=value=>Number.isSafeInteger(value);
function keys(value,required,optional,reason){
 need(record(value),reason);const actual=Object.keys(value),allowed=new Set([...required,...optional]);
 need(required.every(key=>Object.hasOwn(value,key))&&actual.every(key=>allowed.has(key)),reason);
}
function parse(text,limit,cap){
 need(typeof text==='string','input-type');need(Buffer.byteLength(text)<=limit,cap);
 let value;try{value=JSON.parse(text);}catch{throw Error('cpu-profile-v2-json');}
 need(JSON.stringify(value)===text,'canonical-json');return value;
}
const RESERVED=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype','toJSON']);
const EMPTY_SOURCES=new Map([['(root)','root'],['(program)','program'],['(idle)','idle'],['(garbage collector)','garbage-collector']]);
const SOURCE_BUCKETS=new Map([['unattributed-root','root'],['unattributed-program','program'],['unattributed-idle','idle'],['unattributed-garbage-collector','garbageCollector']]);
function assetKey(key){
 need(typeof key==='string'&&key.length>0&&key.split('/').every(part=>/^[A-Za-z0-9._~-]+$/.test(part)&&part!=='.'&&part!=='..'&&!RESERVED.has(part)),'asset-path');
 return key;
}
function bindingContext(text){
 const b=parse(text,CPU_PROFILE_V2_LIMITS.maxBindingBytes,'binding-byte-cap');keys(b,['schema','browserVersion','chromiumRevision','origin','assetHashes'],[],'binding-shape');
 need(b.schema==='chrome156-cpu-source-context-v2'&&b.browserVersion===VERSION&&b.chromiumRevision===REVISION,'binding-version');
 let url;try{url=new URL(b.origin);}catch{throw Error('cpu-profile-v2-binding-origin');}
 need(typeof b.origin==='string'&&['http:','https:'].includes(url.protocol)&&url.origin===b.origin&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password,'binding-origin');
 need(record(b.assetHashes),'asset-map');const assets=new Map();
 for(const key of Object.keys(b.assetHashes)){assetKey(key);const hash=b.assetHashes[key];need(typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash),'asset-hash');need(!assets.has(key),'asset-collision');assets.set(key,hash);}
 return {binding:b,assets};
}
function source(frame,context){
 if(frame.url==='')return {assetPath:null,assetSha256:null,kind:'unattributed-'+(EMPTY_SOURCES.get(frame.functionName)??'other')};
 // These assets use literal canonical ASCII paths. No percent decoding or aliases.
 need(!/[\\%]/.test(frame.url),'source-url');let url;try{url=new URL(frame.url);}catch{throw Error('cpu-profile-v2-source-url');}
 need(url.origin===context.binding.origin&&!url.search&&!url.hash,'source-origin');
 const key=url.pathname.slice(1);try{assetKey(key);}catch{throw Error('cpu-profile-v2-source-path');}
 need(frame.url===context.binding.origin+'/'+key&&url.href===frame.url&&context.assets.has(key),'source-asset');
 return {assetPath:key,assetSha256:context.assets.get(key),kind:'bound-asset'};
}
function display(value,maxBytes){
 let text='',bytes=0;for(const char of value){const n=Buffer.byteLength(char);if(bytes+n>maxBytes)break;text+=char;bytes+=n;}
 const json=JSON.stringify(value);return {text,rawJsonBytes:Buffer.byteLength(json),sha256:sha(json),truncated:text!==value};
}
const digestRows=rows=>{const hash=createHash('sha256');for(const row of rows)hash.update(JSON.stringify(row)+'\n');return hash.digest('hex');};
function compare(a,b,primary,secondary){return b[primary]-a[primary]||b[secondary]-a[secondary]||(a.id<b.id?-1:a.id>b.id?1:0);}
function retainTop(rows,row,primary,secondary){let at=0;while(at<rows.length&&compare(row,rows[at],primary,secondary)>=0)at++;if(at<CPU_PROFILE_V2_LIMITS.topNodes){rows.splice(at,0,row);if(rows.length>CPU_PROFILE_V2_LIMITS.topNodes)rows.pop();}}

export function analyzeChrome156CpuProfileV2(profileJson,bindingJson){
 const profile=parse(profileJson,CPU_PROFILE_V2_LIMITS.maxProfileBytes,'profile-byte-cap'),context=bindingContext(bindingJson);
 keys(profile,['nodes','startTime','endTime','samples','timeDeltas'],[],'profile-shape');
 const {nodes,samples,timeDeltas,startTime,endTime}=profile;
 need(Array.isArray(nodes)&&nodes.length>0&&nodes.length<=CPU_PROFILE_V2_LIMITS.maxNodes,'nodes');
 need(safe(startTime)&&startTime>=0&&safe(endTime)&&endTime>startTime&&endTime-startTime<=CPU_PROFILE_V2_LIMITS.maxWindowUs,'profile-time');
 need(Array.isArray(samples)&&samples.length>0&&samples.length<=CPU_PROFILE_V2_LIMITS.maxSamples&&Array.isArray(timeDeltas)&&timeDeltas.length===samples.length,'samples');
 const byId=new Map(),sources=[],parent=new Int32Array(nodes.length).fill(-1);let edgeCount=0,tickCount=0;
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];keys(node,['id','callFrame'],['children','hitCount','positionTicks','deoptReason'],'node-shape');
  need(safe(node.id)&&node.id>0&&!byId.has(node.id),'node-id');byId.set(node.id,i);
  const f=node.callFrame;keys(f,['functionName','scriptId','url','lineNumber','columnNumber'],[],'frame-shape');
  need(['functionName','scriptId','url'].every(key=>typeof f[key]==='string')&&['lineNumber','columnNumber'].every(key=>safe(f[key])&&f[key]>=-1),'frame-shape');
  if(Object.hasOwn(node,'children')){need(Array.isArray(node.children),'node-children');edgeCount+=node.children.length;need(edgeCount<=nodes.length-1,'tree-edges');}
  if(Object.hasOwn(node,'hitCount'))need(safe(node.hitCount)&&node.hitCount>=0,'node-hit-count');
  if(Object.hasOwn(node,'deoptReason'))need(typeof node.deoptReason==='string','node-deopt-reason');
  if(Object.hasOwn(node,'positionTicks')){
   need(Array.isArray(node.positionTicks),'node-position-ticks');tickCount+=node.positionTicks.length;need(tickCount<=CPU_PROFILE_V2_LIMITS.maxPositionTicks,'node-position-ticks');
   for(const tick of node.positionTicks){keys(tick,['line','ticks'],[],'node-position-ticks');need(safe(tick.line)&&tick.line>=1&&safe(tick.ticks)&&tick.ticks>=0,'node-position-ticks');}
  }
  sources.push(source(f,context));
 }
 need(edgeCount===nodes.length-1,'tree-edges');
 for(let i=0;i<nodes.length;i++)for(const id of nodes[i].children??[]){const child=byId.get(id);need(safe(id)&&child!==undefined&&child!==i&&parent[child]===-1,'tree-parent');parent[child]=i;}
 need(parent[0]===-1,'tree-root');
 const order=[],pending=[0],seen=new Uint8Array(nodes.length);
 while(pending.length){const i=pending.pop();need(seen[i]===0,'tree-cycle');seen[i]=1;order.push(i);for(const child of nodes[i].children??[])pending.push(byId.get(child));}
 need(order.length===nodes.length,'tree-disconnected');
 const timestamps=new Float64Array(samples.length),self=new Uint32Array(nodes.length);let at=startTime,min=Infinity,max=-Infinity,negative=0,zero=0,positive=0,minDelta=Infinity,maxDelta=-Infinity,negativeSum=0;
 const originalPairs=createHash('sha256');
 for(let i=0;i<samples.length;i++){
  const id=samples[i],index=byId.get(id),delta=timeDeltas[i];need(safe(id)&&index!==undefined,'unknown-sample');
  need(safe(delta)&&delta>=-2147483648&&delta<=2147483647,'delta');at+=delta;need(safe(at)&&at>=startTime&&at<=endTime,'sample-window');
  timestamps[i]=at;min=Math.min(min,at);max=Math.max(max,at);minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);
  if(delta<0){negative++;negativeSum+=delta;}else if(delta===0)zero++;else positive++;
  self[index]++;originalPairs.update(JSON.stringify([i,id,delta,at])+'\n');
 }
 const permutation=Array.from({length:samples.length},(_,i)=>i).sort((a,b)=>timestamps[a]<timestamps[b]?-1:timestamps[a]>timestamps[b]?1:a-b);
 const indexSeen=new Uint8Array(samples.length),orderedSelf=new Uint32Array(nodes.length),orderedPairs=createHash('sha256'),permutationHash=createHash('sha256');let previous=-1,previousAt=-Infinity;
 for(const i of permutation){need(safe(i)&&i>=0&&i<samples.length&&!indexSeen[i],'conservation-index');indexSeen[i]=1;
  need(timestamps[i]>previousAt||timestamps[i]===previousAt&&i>previous,'conservation-order');previous=i;previousAt=timestamps[i];
  orderedSelf[byId.get(samples[i])]++;orderedPairs.update(JSON.stringify([i,samples[i],timeDeltas[i],timestamps[i]])+'\n');permutationHash.update(String(i)+'\n');
 }
 need(permutation.length===samples.length&&indexSeen.every(x=>x===1)&&orderedSelf.every((n,i)=>n===self[i]),'conservation-counts');
 need(timestamps[permutation[0]]===min&&timestamps[permutation.at(-1)]===max,'conservation-window');
 const inclusive=Uint32Array.from(self);for(let j=order.length-1;j>0;j--){const i=order[j];inclusive[parent[i]]+=inclusive[i];}
 need(inclusive[0]===samples.length,'conservation-inclusive');
 const frequency=nodes.flatMap((node,i)=>self[i]>0?[[node.id,self[i]]]:[]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 const topSelf=[],topInclusive=[],unattributedSelf={root:0,program:0,idle:0,garbageCollector:0,other:0};let boundAssetSelf=0;
 const sourceRows=createHash('sha256');
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i],s=sources[i],row={id:node.id,parentId:parent[i]===-1?null:nodes[parent[i]].id,selfSamples:self[i],inclusiveSamples:inclusive[i],sourceKind:s.kind};
  sourceRows.update(JSON.stringify([node.id,row.parentId,node.callFrame,s.assetPath,s.assetSha256])+'\n');
  retainTop(topSelf,row,'selfSamples','inclusiveSamples');retainTop(topInclusive,row,'inclusiveSamples','selfSamples');
  if(s.kind==='bound-asset')boundAssetSelf+=self[i];else unattributedSelf[SOURCE_BUCKETS.get(s.kind)??'other']+=self[i];
 }
 need(boundAssetSelf+Object.values(unattributedSelf).reduce((a,b)=>a+b,0)===samples.length,'conservation-source-counts');
 const nodeRow=row=>{const i=byId.get(row.id),f=nodes[i].callFrame,s=sources[i];return {...row,frame:{functionName:display(f.functionName,128),scriptId:display(f.scriptId,64),url:display(f.url,256),lineNumber:f.lineNumber,columnNumber:f.columnNumber},asset:s.assetPath===null?null:{path:display(s.assetPath,256),sha256:s.assetSha256}};};
 need(JSON.stringify(profile)===profileJson,'conservation-raw');
 const result={schema:'chrome156-sampled-stacks-v2',status:'validated-data-only',contract:{browserVersion:VERSION,chromiumRevision:REVISION,...SOURCE_PINS},input:{profileBytes:Buffer.byteLength(profileJson),profileSha256:sha(profileJson),bindingSha256:sha(bindingJson),graphSha256:sha(JSON.stringify(nodes)),sourceRowsSha256:sourceRows.digest('hex'),sourceMapSha256:digestRows([...context.assets].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0))},counts:{nodes:nodes.length,samples:samples.length},deltas:{negative,zero,positive,minUs:minDelta,maxUs:maxDelta,negativeSumUs:negativeSum},window:{startUs:startTime,endUs:endTime,minSampleUs:min,maxSampleUs:max},conservation:{indexCount:samples.length,indexBijection:true,pairsConserved:true,frequenciesConserved:true,rawInputUnchanged:true,originalPairSha256:originalPairs.digest('hex'),orderedPairSha256:orderedPairs.digest('hex'),permutationSha256:permutationHash.digest('hex'),frequencySha256:digestRows(frequency)},boundAssetSelf,unattributedSelf,topSelf:topSelf.map(nodeRow),topInclusive:topInclusive.map(nodeRow),scope:'Sample counts only; pure data validation is not source/acquisition/owner admission.',performance:false,scoringEligibility:false,FPS:null,cpuTime:null};
 need(Buffer.byteLength(JSON.stringify(result))<=CPU_PROFILE_V2_LIMITS.maxResultBytes,'result-byte-cap');return result;
}
