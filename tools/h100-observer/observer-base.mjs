import {types} from 'node:util';
import {createHash} from 'node:crypto';
const desc=Object.getOwnPropertyDescriptor,descs=Object.getOwnPropertyDescriptors,keys=Reflect.ownKeys;
const stringify=JSON.stringify,prototype=Object.getPrototypeOf;
const mapSize=desc(Map.prototype,'size').get,entries=Map.prototype.entries;
const next=Object.getPrototypeOf(new Map().entries()).next;
const apply=Reflect.apply;
export const LIMITS=Object.freeze({owners:2,rows:100,totalRows:101,nodes:128,generations:32,depth:8,events:1024,eventBytes:196608,censusCalls:16,work:32768,candidates:128,scopes:128,output:262144});
export const EXPORT_REFUSAL=Object.freeze(Object.assign(new Error('capability-export-refused'),{code:'capability-export-refused'}));
const authority=Object.freeze({qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'});
const reasons=new Set(['source-gap','owner','mapping','generation','node','unmeasured','missing-key','external-continuity','primitive','limit','scope-open','admission-closed','publication','timeout','disposal','call-edge','unsupported-callee','original-failure']);
const phases=new Set(['configuration','cache','options','resizeFn','mapping','begin','bind','edge','measuredResult','resizeEnter','write','resizeExit','edgeReturn','end','reset','resetDone','fence','candidate-state','candidate-ancestor','snapshot-copy']);
const uint=(v,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=10000000;
export function render(record,cap=LIMITS.output){
 if(!uint(cap,LIMITS.output)||cap<512)throw Error('output-limit');let slots=0,chars=0;const seen=new Set();
 function own(v,depth){
  if(++slots>32768||depth>32)throw Error('output-limit');
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'){chars+=v.length;if(chars>cap)throw Error('output-limit');return v;}
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v))throw Error('output-primitive');seen.add(v);
  const a=Array.isArray(v),proto=prototype(v);if(a?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)throw Error('output-primitive');
  const length=a?desc(v,'length'):null;if(a&&(!length||!uint(length.value,32768)))throw Error('output-limit');
  const names=keys(v);if(names.length>32768-slots)throw Error('output-limit');const out=a?[]:Object.create(null);
  if(a){const len=length;if(names.length!==len.value+1)throw Error('output-primitive');for(let i=0;i<len.value;i++){const d=desc(v,String(i));if(!d||!Object.hasOwn(d,'value'))throw Error('output-primitive');out.push(own(d.value,depth+1));}}
  else for(const name of names){if(typeof name!=='string'||name==='toJSON')throw Error('output-primitive');const d=desc(v,name);if(!d||!Object.hasOwn(d,'value'))throw Error('output-primitive');chars+=name.length;if(chars>cap)throw Error('output-limit');out[name]=own(d.value,depth+1);}
  seen.delete(v);return out;
 }
 const b=Buffer.from(stringify(own(record,0),null,2)+'\n');if(b.length>cap)throw Error('output-limit');return b;
}
export function createObserver(smaller={}){
 const lim={...LIMITS};let reason=null,admission=true,seq=0,token=0,eventBytes=0,work=0,dropped=0,censusCalls=0;
 const owners=new WeakMap(),ownerList=[],scopeStack=[],resizeStack=[],scopeList=[],scopeById=new Map(),candidates=[],pending=new Set(),edges=new Map(),events=[];let cleanupReady=false,cleanupInProgress=false,cleanupDone=false,cleanupFault=false;let operation='configuration',firstWorkFailure=null,committedCount=0;let unconsumed=0;let armed=null,lastCensus={attempts:0,complete:false,entries:[]};
 let original='not-started',waiter='not-started',late='none',disposed=false,writer='not-started',published=false;
 function fail(code){
  reason??=reasons.has(code)?code:'source-gap';
  if(cleanupDone||cleanupInProgress)return;cleanupInProgress=true;
  try{if(cleanupReady){for(const c of pending){if(c.data[7]!==0){cleanupFault=true;continue;}c.data[7]=2;}pending.clear();}armed=null;}
  catch{cleanupFault=true;}finally{cleanupDone=true;cleanupInProgress=false;}
 }
 function charge(n=1,label=operation){
  if(!phases.has(label)||!uint(n,2147483647)||n<1){fail('source-gap');return false;}
  if(n>lim.work-work){firstWorkFailure??=Object.freeze({operation:label,requested:n,remaining:lim.work-work,workUnits:work,limit:lim.work});fail('limit');return false;}work+=n;return true;
 }
 function badExport(){fail('source-gap');throw EXPORT_REFUSAL;}
 function exportGuard(fn){try{return fn();}catch(error){if(error===EXPORT_REFUSAL)throw error;fail('source-gap');throw EXPORT_REFUSAL;}}

 function safe(fallback,fn){try{return fn();}catch{fail('source-gap');return fallback;}}
 function need(v,code='primitive'){if(!v){fail(code);return false;}return true;}
 function record(value,names){if(!charge(4)||!need(value!==null&&typeof value==='object'&&!types.isProxy(value)))return null;if(!need(prototype(value)===Object.prototype||prototype(value)===null))return null;if(!charge(names.length*3+2))return null;const d=descs(value);if(!need(keys(d).length===names.length&&names.every(n=>Object.hasOwn(d,n)&&Object.hasOwn(d[n],'value')&&d[n].enumerable===true)))return null;const out=Object.create(null);for(const n of names){if(!charge())return null;out[n]=d[n].value;}return out;}
 function array(v,max){
  if(!charge(4)||!need(v!==null&&typeof v==='object'&&!types.isProxy(v)&&Array.isArray(v)&&prototype(v)===Array.prototype))return null;
  const length=desc(v,'length');if(!need(length&&Object.hasOwn(length,'value')&&uint(length.value,max)&&length.enumerable===false))return null;
  const a=[];for(let i=0;i<length.value;i++){if(!charge(3))return null;const d=desc(v,String(i));if(!need(d&&Object.hasOwn(d,'value')&&d.enumerable===true))return null;a.push(d.value);}
  if(!charge(2)||!need(keys(v).length===length.value+1))return null;return a;
 }
 function text(v,max=128){return charge(typeof v==='string'?v.length+1:1)&&need(typeof v==='string'&&v.length<=max&&/^[\x20-\x7e]+$/.test(v));}
 function owner(v){if(!charge(2))return null;const o=owners.get(v);if(!o)fail('owner');return o;}
 function emit(tag,o=null,s=null,row=null,node=null,index=null,key=null,size=null,origin=0,outcome=1,prepaid=false){
  if(reason){dropped=Math.min(2147483647,dropped+1);return null;}if(!prepaid&&!charge(32))return null;
  const tuple=[tag,++seq,o?.id??null,o?.gen??null,s,row,node,index,key,size,origin,outcome];
  if(!need(tuple.every(v=>v===null||typeof v==='number'&&Number.isFinite(v)),'primitive'))return null;
  const bytes=Buffer.byteLength(stringify(tuple));if(events.length>=lim.events||bytes>256||bytes>lim.eventBytes-eventBytes){fail('limit');return null;}eventBytes+=bytes;events.push(Object.freeze(tuple));return seq;
 }
 function available(){if(!admission){fail('admission-closed');return false;}return !reason;}
 function ownMap(o){if(!charge(2))return false;const d=desc(o.instance,'itemSizeCache');return need(d&&Object.hasOwn(d,'value')&&d.value===o.map&&!types.isProxy(d.value),'generation');}
 function maybeCommit(c){
  if(reason||!c)return;if(!charge(5,'candidate-state'))return;if(c.data[7]!==0)return;const e=c.edge;if(!e.returned||!e.resize?.normal)return;
  for(const id of c.parents){if(!charge(4,'candidate-ancestor'))return;const ancestor=scopeById.get(id);if(ancestor?.data[8]!==1)return;}
  if(!charge(8))return;const previous=c.owner.latest.get(c.data[4]);if(previous!==c){c.data[7]=3;pending.delete(c);return;}
  const committedSeq=emit(19,c.owner,e.resize.id,null,null,null,c.data[4],c.data[6],e.origin);if(reason)return;c.data[7]=1;committedCount++;c.data[8]=committedSeq;c.owner.committed.set(c.data[4],c);pending.delete(c);
 }

 safe(null,()=>{if(!charge(2)||!need(smaller!==null&&typeof smaller==='object'&&!types.isProxy(smaller)))return;const names=keys(smaller);if(!need(names.length<=keys(LIMITS).length,'limit'))return;const r=record(smaller,names);if(!r)return;for(const k of keys(r)){if(!charge(2)||!need(Object.hasOwn(LIMITS,k)&&uint(r[k],LIMITS[k])&&r[k]>0,'limit'))return;if(k==='work'&&r[k]<work){fail('limit');return;}lim[k]=r[k];}});
 if(!reason&&charge(32,'configuration'))cleanupReady=true;
 function parentIds(){const result=[];for(const s of scopeStack){if(!charge(3))return [];result.push(s.data[0]);}return result;}
 function ownerNodeCount(except=null){let n=0;for(const o of ownerList){if(!charge(4))return lim.nodes+1;if(o!==except)n+=o.nodeRefs.size;}return n;}
 function generationCount(){let n=0;for(const o of ownerList){if(!charge(3))return lim.generations;n+=o.gen;}return n;}
 const api={
  cache(v,map){return safe(map,()=>{if(reason)return map;operation='cache';if(!charge(24))return map;if(!available())return map;if(!need(!types.isProxy(v)&&typeof v==='object'&&v!==null&&types.isMap(map)&&!types.isProxy(map),'owner'))return map;if(!need(ownerList.length<lim.owners&&!owners.has(v),'limit'))return map;const o={id:ownerList.length+1,instance:v,map,fn:null,gen:1,mapping:null,nodes:new WeakMap(),nodeRefs:new Map(),rows:new Map(),latest:new Map(),committed:new Map()};owners.set(v,o);ownerList.push(o);emit(1,o);return map;});},
  options(v,merged,defaultKey){safe(null,()=>{if(reason)return null;operation='options';if(!charge(24))return null;const o=owner(v);if(!o||!available())return;const k=desc(merged,'getItemKey'),a=desc(merged,'anchorTo'),count=desc(merged,'count');if(!need(k&&Object.hasOwn(k,'value')&&k.value===defaultKey&&a&&Object.hasOwn(a,'value')&&a.value==='start'&&count&&Object.hasOwn(count,'value')&&uint(count.value,101),'mapping'))return;o.optionKey=k.value;o.optionAnchor=a.value;o.optionCount=count.value;});},
  resizeFn(v,fn){return safe(fn,()=>{if(reason)return fn;operation='resizeFn';if(!charge(6))return fn;const o=owner(v);if(o&&available()&&need(typeof fn==='function'))o.fn=fn;return fn;});},
  mapping(v,input,nodePairs){return safe(false,()=>{if(reason)return false;operation='mapping';if(!charge(18))return false;const o=owner(v);if(!o||!available())return false;
   const r=record(input,['schemaVersion','kind','context','historyRows','response','count']);if(!r||!text(r.kind,64)||!need(r.schemaVersion===1&&r.kind==='synthetic-default-history-mapping-v1','mapping'))return false;
   const context=record(r.context,['contextToken','contextGeneration','scrollerToken','threadId']);if(!context||!need(uint(context.contextToken,2)&&context.contextToken>0&&uint(context.scrollerToken,2)&&context.scrollerToken>0&&uint(context.contextGeneration,32)&&context.contextGeneration>0,'mapping')||!text(context.threadId))return false;
   const raw=array(r.historyRows,lim.rows);if(!raw||!need(raw.length===100,'mapping'))return false;const rows=[];const ids=new Set(),nodeTokens=new Set();
   for(let i=0;i<raw.length;i++){if(!charge(24))return false;const row=array(raw[i],8);if(!row||!text(row[2],9)||!need(row.length===8&&row[0]===i+1&&row[4]===i&&row[5]===i&&['user','assistant'].includes(row[2])&&uint(row[7],lim.nodes)&&row[7]>0,'mapping')||!text(row[1])||!text(row[6])||!text(row[3],64)||!need(/^[a-f0-9]{64}$/.test(row[3])&&!ids.has(row[1])&&row[6]===row[1],'mapping'))return false;if(!need(!nodeTokens.has(row[7]),'node'))return false;nodeTokens.add(row[7]);ids.add(row[1]);rows.push(row);}
   let response=null;if(r.response!==null){response=record(r.response,['messageId','index','cacheKey','reactKey','nodeToken']);if(!response||!text(response.messageId)||!text(response.reactKey)||!need(response.index===100&&response.cacheKey===100&&response.reactKey===response.messageId&&!ids.has(response.messageId)&&uint(response.nodeToken,lim.nodes)&&response.nodeToken>0&&!nodeTokens.has(response.nodeToken),'mapping'))return false;}
   if(!need(r.count===(response?101:100)&&r.count<=lim.totalRows,'mapping'))return false;
   if(!charge(16))return false;const owned={schemaVersion:1,kind:r.kind,context,historyRows:rows,response,count:r.count};if(!need(Buffer.byteLength(stringify(owned))<=65536,'limit'))return false;
   const digest=createHash('sha256').update(stringify({context,historyRows:rows})).digest('hex');
   if(o.mapping&&!need(o.mapping.digest===digest&&(!o.mapping.response||stringify(o.mapping.response)===stringify(response)),'mapping'))return false;
   const pairs=array(nodePairs,lim.nodes);if(!pairs||!need(pairs.length===100&&ownerNodeCount(o)+pairs.length<=lim.nodes,'node'))return false;
   const seen=new Set();for(let i=0;i<pairs.length;i++){if(!charge(18))return false;const pair=array(pairs[i],2);if(!pair||!need(pair.length===2&&pair[0]!==null&&typeof pair[0]==='object'&&!types.isProxy(pair[0])&&pair[1]===rows[i][7]&&!seen.has(pair[0]),'node'))return false;seen.add(pair[0]);if(o.nodeRefs.has(i+1)&&!need(o.nodeRefs.get(i+1)===pair[0],'node'))return false;o.nodes.set(pair[0],i+1);o.nodeRefs.set(i+1,pair[0]);o.rows.set(i,rows[i]);}
   if(!charge(8))return false;o.mapping={...owned,digest};return true;
  });},
  begin(v,kind){return safe(null,()=>{if(reason)return null;operation='begin';if(!charge(68))return null;const o=owner(v);if(!o||!available())return null;if(!need([1,2,3].includes(kind)&&scopeStack.length<lim.depth&&scopeList.length<lim.scopes&&token<1024,'limit'))return null;const id=++token,data=[id,scopeStack.at(-1)?.data[0]??null,o.id,kind,null,null,null,null,0],s={o,data,edges:[],waiting:new Set()};data[6]=emit(2,o,id,null,null,null,null,null,0,1,true);if(reason)return null;scopeList.push(s);scopeById.set(id,s);scopeStack.push(s);return id;});},
  bind(v,id,node,index){safe(null,()=>{if(reason)return null;operation='bind';if(!charge(20))return null;if(reason||id===null)return;const o=owner(v),s=scopeById.get(id);if(!need(o&&s&&s.o===o&&scopeStack.at(-1)===s&&uint(index,127)&&node!==null&&typeof node==='object'&&!types.isProxy(node),'node'))return;const row=o.nodes.get(node);if(!need(row!==undefined&&o.rows.get(index)?.[0]===row,'node'))return;s.data[4]=o.rows.get(index)[7];s.data[5]=index;});},
  edge(v,id,node,index){return safe(null,()=>{if(reason)return null;operation='edge';if(!charge(36))return null;const o=owner(v),s=scopeById.get(id);if(!available()||!need(o&&s&&scopeStack.at(-1)===s&&s.o===o&&s.data[5]===index&&o.nodes.get(node)===o.rows.get(index)?.[0],'call-edge'))return null;const d=desc(v,'resizeItem');if(!need(d&&Object.hasOwn(d,'value')&&d.value===o.fn,'unsupported-callee')||!need(token<1024,'limit'))return null;const parents=parentIds();if(reason)return null;const e={id:++token,o,scope:id,index,origin:s.data[3]===2?2:1,parents,state:'pending',resize:null,returned:false,size:null};edges.set(e.id,e);s.edges.push(e);unconsumed++;return e.id;});},
  measuredResult(id,value){return safe(value,()=>{if(reason)return value;operation='measuredResult';if(!charge(16))return value;if(reason||id===null)return value;const e=edges.get(id);if(!available()||!need(e&&e.state==='pending'&&armed===null&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10000000,'call-edge'))return value;e.size=value;e.state='armed';armed=e;emit(17,e.o,id,null,null,e.index,e.index,value,e.origin);return value;});},
  resizeEnter(v,index,size){return safe(null,()=>{if(reason)return null;operation='resizeEnter';if(!charge(100))return null;const o=owner(v);if(!o||!available())return null;if(!need(resizeStack.length<lim.depth&&token<1024&&uint(index,127)&&typeof size==='number'&&Number.isFinite(size)&&Math.abs(size)<=10000000,'primitive'))return null;const e=armed;armed=null;if(e&&!need(e.o===o&&e.index===index&&e.size===size&&e.state==='armed','call-edge'))return null;const r={id:++token,o,index,edge:e,normal:null};if(e){e.state='consumed';e.resize=r;emit(18,o,e.id,null,null,index,index,size,e.origin,1,true);if(reason)return null;}emit(4,o,r.id,null,null,index,index,size,e?.origin??3,1,true);if(reason)return null;resizeStack.push(r);return r.id;});},
  write(v,key,size){safe(null,()=>{if(reason)return null;operation='write';if(!charge(32))return null;const o=owner(v),r=resizeStack.at(-1);if(reason||!need(o&&r&&r.o===o&&uint(key,127)&&key===r.index&&typeof size==='number'&&Number.isFinite(size)&&Math.abs(size)<=10000000&&ownMap(o),'call-edge'))return;
   const old=o.latest.get(key);if(old?.data[7]===1)committedCount--;if(old?.data[7]===0||old?.data[7]===1){old.data[7]=3;pending.delete(old);}o.committed.delete(key);
   const write=emit(5,o,r.id,null,null,key,key,size,r.edge?.origin??3);if(reason)return;
   if(!r.edge){o.latest.set(key,null);return;}if(!need(candidates.length<lim.candidates,'limit'))return;
   if(!charge(r.edge.parents.length*4+32))return;const c={owner:o,edge:r.edge,parents:[...r.edge.parents],data:[candidates.length+1,r.edge.id,r.edge.scope,r.id,key,write,size,0,null]};candidates.push(c);pending.add(c);r.edge.candidate=c;o.latest.set(key,c);for(const id of c.parents){scopeById.get(id).waiting.add(c);}
  });},
  resizeExit(v,id,normal){safe(null,()=>{
   // Twelve scalar unwind slots were prepaid by resizeEnter even after latch.
   operation='resizeExit';
if(id===null)return;const r=resizeStack.pop();if(!need(r&&r.id===id&&r.o===owners.get(v)&&typeof normal==='boolean','call-edge'))return;r.normal=normal;emit(10,r.o,id,null,null,null,null,null,r.edge?.origin??3,normal?1:2);if(!normal)fail('original-failure');maybeCommit(r.edge?.candidate);});},
  edgeReturn(id){safe(null,()=>{if(reason)return null;operation='edgeReturn';if(!charge(25))return null;if(id===null)return;const e=edges.get(id);if(!need(e&&e.state==='consumed'&&e.resize?.normal===true,'call-edge'))return;e.returned=true;unconsumed--;if(armed===e)armed=null;maybeCommit(e.candidate);});},
  end(v,id,normal){safe(null,()=>{
   // Twelve scalar unwind slots were prepaid by begin even after latch.
   operation='end';
if(id===null)return;const s=scopeStack.pop();if(!need(s&&s.data[0]===id&&s.o===owners.get(v)&&typeof normal==='boolean','call-edge'))return;s.data[8]=normal?1:2;s.data[7]=emit(3,s.o,id,null,null,null,null,null,0,normal?1:2);if(!normal)fail('original-failure');if(reason)return;for(const e of s.edges){if(reason||!charge(8))return;if(!e.returned){if(armed===e)armed=null;e.state='closed';if(normal&&!reason)fail('call-edge');}}for(const c of s.waiting){if(!charge(2))return;maybeCommit(c);}});},
  reset(v,kind){safe(null,()=>{if(reason)return null;operation='reset';if(!charge(25))return null;const o=owner(v);if(!o)return;if(generationCount()>=lim.generations){fail('limit');return;}o.gen++;emit(kind===4?8:6,o);committedCount-=o.committed.size;o.latest.clear();o.committed.clear();fail('generation');});},
  resetDone(v,kind){safe(null,()=>{if(reason)return null;operation='resetDone';if(!charge(4))return null;const o=owners.get(v);emit(kind===4?9:7,o);});},
  fence(v){return exportGuard(()=>{if(reason)return api.snapshot();operation='fence';if(!charge(48))throw EXPORT_REFUSAL;const o=owner(v);if(!o||!available())return api.snapshot();if(!need(!scopeStack.length&&!resizeStack.length&&!armed&&pending.size===0&&unconsumed===0,'scope-open'))return api.snapshot();if(!need(++censusCalls<=lim.censusCalls,'limit')||!need(o.mapping,'mapping')||!ownMap(o))return api.snapshot();
   const op=desc(v,'options');if(!need(op&&Object.hasOwn(op,'value')&&op.value&&!types.isProxy(op.value),'mapping'))return api.snapshot();const keyLaw=desc(op.value,'getItemKey'),anchorLaw=desc(op.value,'anchorTo');if(o.optionKey!==undefined&&!need(keyLaw&&Object.hasOwn(keyLaw,'value')&&keyLaw.value===o.optionKey&&anchorLaw&&Object.hasOwn(anchorLaw,'value')&&anchorLaw.value==='start','mapping'))return api.snapshot();const count=desc(op.value,'count');if(!need(count&&Object.hasOwn(count,'value')&&count.value===o.mapping.count,'mapping'))return api.snapshot();
   if(!charge(2)||!need(apply(mapSize,o.map,[])<=128,'limit'))return api.snapshot();const it=apply(entries,o.map,[]),actual=new Map();
   for(let i=0;i<=128;i++){if(!charge(10))return api.snapshot();const step=apply(next,it,[]);if(step.done)break;if(!need(i<128,'limit'))return api.snapshot();const [key,size]=step.value;if(!need(uint(key,127)&&positive(size),'unmeasured'))return api.snapshot();if(key>=100&&!need(key===100&&o.mapping.response!==null,'missing-key'))return api.snapshot();actual.set(key,size);}
   const census=[];for(const row of o.mapping.historyRows){if(!charge(24))return api.snapshot();const c=o.committed.get(row[5]);if(!need(actual.has(row[5])&&c&&c.data[7]===1&&c.data[6]===actual.get(row[5])&&c.owner.gen===o.gen&&positive(c.data[6]),'unmeasured'))return api.snapshot();census.push([row[0],row[5],c.data[6],o.gen,row[7],c.data[5]]);}
   lastCensus={attempts:censusCalls,complete:true,entries:census};emit(12,o);emit(13,o);return api.snapshot();
  });},
  snapshot(){return exportGuard(()=>{
   if(cleanupFault)badExport();
   if(!charge(1024+events.length*64+scopeList.length*48+candidates.length*48+lastCensus.entries.length*40,'snapshot-copy'))throw EXPORT_REFUSAL;
   function primitive(value){if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;if(typeof value==='string'&&value.length<=128&&/^[\x20-\x7e]+$/.test(value))return value;return badExport();}
   function recordCopy(value){const result={};for(const name of Object.keys(value)){const d=desc(value,name);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)badExport();result[name]=primitive(d.value);}return Object.freeze(result);}
   function tupleCopy(value,width){if(value===null||typeof value!=='object'||types.isProxy(value)||!Array.isArray(value)||prototype(value)!==Array.prototype)badExport();const length=desc(value,'length');if(!length||length.value!==width||keys(value).length!==width+1)badExport();const result=[];for(let i=0;i<width;i++){const d=desc(value,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable||!(d.value===null||typeof d.value==='number'&&Number.isFinite(d.value)))badExport();result.push(d.value);}return Object.freeze(result);}
   const o=ownerList[0],second=ownerList[1];const nodes=(o?.nodeRefs.size??0)+(second?.nodeRefs.size??0),generations=(o?.gen??0)+(second?.gen??0);
   const counts=recordCopy({owners:ownerList.length,historyRows:o?.mapping?.historyRows.length??0,totalRows:o?.mapping?.count??0,nodes,generations,events:events.length,eventBytes,censusCalls,workUnits:work,droppedEvents:dropped,pendingCandidates:pending.size,committedCandidates:committedCount});
   for(const name of Object.keys(counts))if(!uint(counts[name]))badExport();
   const closure=recordCopy({admission:admission?'open':'closed',activeMeasurements:scopeStack.length,activeResizes:resizeStack.length,publishOriginal:original,publishWaiter:waiter,lateOutcome:late,disposed,receiptWriter:writer});
   if(!['not-started','pending','fulfilled','rejected'].includes(original)||!['not-started','fulfilled','rejected','timed-out'].includes(waiter)||!['none','fulfilled','rejected'].includes(late)||typeof disposed!=='boolean'||!['not-started','open','closed','unresolved'].includes(writer)||!uint(scopeStack.length,8)||!uint(resizeStack.length,8)||typeof lastCensus.complete!=='boolean'||!uint(censusCalls,16))badExport();
   return Object.freeze({...recordCopy({schemaVersion:1,kind:'history-cache-observer-capability-v1',scope:'synthetic-source-owned-core-slice-v1',status:reason?'unavailable':'observed',reasonCode:reason,ownerGeneration:o?1:null,cacheGeneration:o?.gen??null,mappingDigest:o?.mapping?.digest??null}),counts,
    events:Object.freeze(events.map(row=>tupleCopy(row,12))),census:Object.freeze({attempts:primitive(censusCalls),complete:primitive(lastCensus.complete),entries:Object.freeze(lastCensus.entries.map(row=>tupleCopy(row,6)))}),closure,authority:recordCopy(authority),
    measurementScopes:Object.freeze(scopeList.map(scope=>tupleCopy(scope.data,9))),provenanceCandidates:Object.freeze(candidates.map(candidate=>tupleCopy(candidate.data,9)))});
  });},
  workFailure(){return firstWorkFailure;},
  unavailable(code='source-gap'){fail(code);return api.snapshot();},
  close(){admission=false;fail('admission-closed');return api.snapshot();},
  dispose(){disposed=true;admission=false;fail('disposal');return api.snapshot();},
  async publish(publishOriginal,waiterOriginal){if(published){fail('publication');return api.snapshot();}if(!charge(36,'fence'))throw EXPORT_REFUSAL;published=true;if(scopeStack.length||resizeStack.length||armed||pending.size!==0||unconsumed!==0)fail('scope-open');waiter='not-started';let promise;
   let argument;if(reason)argument=api.snapshot();else if(ownerList.length!==1)argument=api.unavailable('mapping');else argument=api.fence(ownerList[0].instance);
   try{original='pending';promise=Promise.resolve(publishOriginal(argument));}catch{original='rejected';fail('publication');return api.snapshot();}
   const tracked=promise.then(()=>{original='fulfilled';if(waiter==='timed-out'||waiter==='rejected'||!admission)late='fulfilled';},()=>{original='rejected';if(waiter==='timed-out'||waiter==='rejected'||!admission)late='rejected';fail('publication');});
   try{await waiterOriginal;waiter='fulfilled';if(original!=='fulfilled')fail('publication');}catch(e){waiter=e===TIMEOUT?'timed-out':'rejected';fail(e===TIMEOUT?'timeout':'publication');}void tracked;return api.snapshot();
  },
 };
 return Object.freeze(api);
}
export const TIMEOUT=Symbol('capability-timeout');
