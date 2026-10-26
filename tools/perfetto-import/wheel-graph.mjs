import {types} from 'node:util';

// This module parses caller-supplied imported rows. It performs no I/O and does
// not authenticate an exporter, native execution, raw event, clock or target.
const PREFIX='native-wheel-witness-v1:';
const FAMILIES=['LatencyInfo.Flow','WidgetBaseInputHandler::OnHandleInputEvent','EventDispatch','InputLatency::MouseWheel','EventLatency'];
const HEADERS=[
 'name,event_count,arg_set_count',
 'id,ts,dur,depth,parent_id,is_selected,name,category,track_id,track_name,arg_set_id,utid,tid,upid,pid,process_name,thread_name,parent_status,duration_status,parent_id_is_null,name_is_null,category_is_null,track_name_is_null,process_name_is_null,thread_name_is_null',
 'slice_id,arg_key_id,arg_set_id,arg_present,int_value,string_value,real_value,int_value_is_null,string_value_is_null,real_value_is_null',
 'arg_key_id,name,flat_key,key,value_type,arg_occurrence_count,slice_count,flat_key_is_null,key_is_null,value_type_is_null',
 'name,idx,severity,source,value,name_is_null,severity_is_null,source_is_null','start_ts,end_ts',
].map(x=>x.split(','));
const LIMITS=[4096,4096,8192,4096,1024,1];
const MIN=-(1n<<63n),MAX=(1n<<63n)-1n,owned=new WeakMap();
class Refusal extends Error{constructor(stage,reason){super(reason);this.stage=stage;this.reason=reason;}}
const need=(condition,stage,reason)=>{if(!condition)throw new Refusal(stage,reason);};
const authority=()=>({diagnosticOnly:true,inputOrigin:'caller-supplied-csv',nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,executionAdmission:'not_evaluated',rawMarkerAdmission:'not_evaluated',importCorrespondence:'not_evaluated',clock:'not_evaluated',population:'not_evaluated',statsAdmission:'not_evaluated',fullTargetAuthentication:'unavailable',wheelToGsu:'unavailable',fps:null,rate:null,latency:null,duration:null});
const unavailable=e=>Object.freeze({...authority(),status:'unavailable',stage:e instanceof Refusal?e.stage:'input',reason:e instanceof Refusal?e.reason:'invalid-input',witness:null});
const compareText=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
const compare=(a,b)=>a===null?(b===null?0:-1):b===null?1:typeof a==='bigint'?(a<b?-1:a>b?1:0):typeof a==='number'?(a<b?-1:a>b?1:0):compareText(a,b);
const tupleCompare=(a,b)=>{for(let i=0;i<a.length;i++){const c=compare(a[i],b[i]);if(c)return c;}return 0;};
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
function options(o,keys){
 need(o!==null&&typeof o==='object'&&!types.isProxy(o)&&Object.getPrototypeOf(o)===Object.prototype,'input','options');
 const d=Object.getOwnPropertyDescriptors(o),own=Reflect.ownKeys(d);
 need(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&'value'in d[k]),'input','options');
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function strings(value,min,max){
 need(Array.isArray(value)&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Array.prototype,'input','phases');
 const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d),length=d.length?.value;
 need(Number.isInteger(length)&&length>=min&&length<=max&&keys.length===length+1,'input','phases');
 const result=[];
 for(let i=0;i<length;i++){
  const p=d[i];need(p&&'value'in p&&typeof p.value==='string'&&p.value.length>0&&p.value.length<=256&&p.value.isWellFormed()&&Buffer.byteLength(p.value)<=256&&!/[\x00-\x1f\x7f]/.test(p.value),'input','phases');result.push(p.value);
 }
 need(new Set(result).size===result.length,'input','phases');return Object.freeze(result);
}
function originalBytes(view){
 need(view&&typeof view==='object'&&!types.isProxy(view)&&ArrayBuffer.isView(view)&&(Object.getPrototypeOf(view)===Buffer.prototype||Object.getPrototypeOf(view)===Uint8Array.prototype),'input','byte-view');
 need(['buffer','byteLength','byteOffset','length'].every(k=>Object.getOwnPropertyDescriptor(view,k)===undefined),'input','byte-view');
 const proto=Object.getPrototypeOf(Uint8Array.prototype);
 const get=k=>Object.getOwnPropertyDescriptor(proto,k).get.call(view);
 const buffer=get('buffer'),length=get('byteLength'),offset=get('byteOffset');
 need(!types.isSharedArrayBuffer(buffer)&&length<=262144,'input','byte-limit');return Buffer.from(new Uint8Array(buffer,offset,length));
}
function csv(bytes){
 need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'csv','bom');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new Refusal('csv','utf8');}
 const rows=[];let row=[],cell='',state='start',started=false,decoded=0,cellBytes=0;
 const append=c=>{const length=Buffer.byteLength(c);need(cellBytes+length<=16384&&decoded+length<=262144,'csv','decoded-limit');cellBytes+=length;decoded+=length;cell+=c;};
 const field=()=>{need(row.length<25,'csv','column-limit');row.push(cell);cell='';cellBytes=0;state='start';};
 const record=()=>{if(started){field();need(rows.length<24576,'csv','record-limit');rows.push(row);}row=[];started=false;};
 for(let i=0;i<text.length;i++){
  const c=String.fromCodePoint(text.codePointAt(i));if(c.length===2)i++;
  if(state==='quoted'){
   if(c==='"'){if(text[i+1]==='"'){append('"');i++;}else state='closed';}else append(c);
  }else if(c===','){started=true;field();}
  else if(c==='\n'){record();}
  else if(c==='\r'){need(text[i+1]==='\n','csv','bare-cr');i++;record();}
  else if(state==='closed')throw new Refusal('csv','quote-suffix');
  else if(c==='"'){need(state==='start','csv','quote-position');started=true;state='quoted';}
  else{started=true;append(c);state='plain';}
 }
 need(state!=='quoted','csv','unclosed-quote');if(started)record();
 const tables=[];let table=-1;
 for(const r of rows){
  if(table<5&&same(r,HEADERS[table+1])){table++;tables.push([]);continue;}
  need(table>=0&&r.length===HEADERS[table].length&&!HEADERS.some(h=>same(h,r)),'schema','table-schema');
  need(tables[table].length<LIMITS[table],'schema','table-row-limit');tables[table].push(Object.fromEntries(HEADERS[table].map((k,i)=>[k,r[i]])));
 }
 need(table===5&&tables[5].length===1,'schema','table-count');return tables;
}
function integer(s,nonnegative=false){need(typeof s==='string'&&/^(?:0|-?[1-9][0-9]*)$/.test(s)&&s.length<=20,'types','integer');const n=BigInt(s);need(n>=(nonnegative?0n:MIN)&&n<=MAX,'types','integer-range');return n;}
const nullableInteger=s=>s==='[NULL]'?null:integer(s,true);
function flag(s){need(s==='0'||s==='1','types','flag');return s==='1';}
function flagged(row,key,convert=x=>x){const absent=flag(row[key+'_is_null']);if(absent){need(row[key]==='[NULL]','types','null-flag');return null;}return convert(row[key]);}
function real(s){need(typeof s==='string'&&s.length<=128&&/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(s)&&Number.isFinite(Number(s)),'types','real');return {text:s,value:Number(s)};}
const selected=(name,phases)=>name!==null&&(FAMILIES.includes(name)||phases.includes(name)||name.startsWith(PREFIX));
function ordered(rows,key,strict=false){let previous;for(const row of rows){const current=key(row);if(previous)need(tupleCompare(previous,current)<(strict?0:1),'relations','row-order');previous=current;}}
function admit(tables,phases){
 const [rawCounts,rawNodes,rawArgs,rawDictionary,rawStats,rawBounds]=tables;
 const nodes=rawNodes.map(r=>({id:integer(r.id,true),ts:integer(r.ts),dur:integer(r.dur),depth:integer(r.depth,true),parent_id:flagged(r,'parent_id',x=>integer(x,true)),is_selected:flag(r.is_selected),name:flagged(r,'name'),category:flagged(r,'category'),track_id:integer(r.track_id,true),track_name:flagged(r,'track_name'),arg_set_id:nullableInteger(r.arg_set_id),utid:nullableInteger(r.utid),tid:nullableInteger(r.tid),upid:nullableInteger(r.upid),pid:nullableInteger(r.pid),process_name:flagged(r,'process_name'),thread_name:flagged(r,'thread_name'),parent_status:r.parent_status,duration_status:r.duration_status}));
 const byId=new Map();for(const n of nodes){need(!byId.has(n.id),'relations','duplicate-node');byId.set(n.id,n);}
 ordered(nodes,n=>[n.ts,n.id],true);
 for(const n of nodes){
  need(n.is_selected===selected(n.name,phases),'relations','selected-membership');
  need(n.parent_status===(n.parent_id===null?'no_parent':byId.has(n.parent_id)?'parent_present':'missing_parent'),'relations','parent-status');
  need(n.duration_status===(n.dur===-1n?'unclosed':n.dur<0n?'other_negative':'nonnegative'),'relations','duration-status');
 }
 const reachable=new Set();for(const start of nodes.filter(n=>n.is_selected)){let n=start;while(n&&!reachable.has(n.id)){reachable.add(n.id);n=byId.get(n.parent_id);}}
 need(reachable.size===nodes.length,'relations','extraneous-context');
 const counts=rawCounts.map(r=>({name:r.name,event_count:integer(r.event_count,true),arg_set_count:integer(r.arg_set_count,true)}));ordered(counts,r=>[r.name],true);
 const expectedNames=[...new Set([...FAMILIES,...phases,...nodes.filter(n=>n.is_selected).map(n=>n.name)])].sort(compareText);
 need(same(counts.map(r=>r.name),expectedNames),'relations','count-names');
 for(const c of counts){const own=nodes.filter(n=>n.is_selected&&n.name===c.name);need(c.event_count===BigInt(own.length)&&c.arg_set_count===BigInt(new Set(own.filter(n=>n.arg_set_id!==null).map(n=>n.arg_set_id)).size),'relations','counts');}
 const dictionary=rawDictionary.map(r=>({id:integer(r.arg_key_id,true),name:r.name,flat_key:flagged(r,'flat_key'),key:flagged(r,'key'),value_type:flagged(r,'value_type'),arg_occurrence_count:integer(r.arg_occurrence_count,true),slice_count:integer(r.slice_count,true)}));
 dictionary.forEach((r,i)=>need(r.id===BigInt(i+1),'relations','dictionary-id'));ordered(dictionary,r=>[r.name,r.flat_key,r.key,r.value_type],true);
 const dictionaryById=new Map(dictionary.map(r=>[r.id,r]));
 const args=rawArgs.map(r=>{
  const d=dictionaryById.get(integer(r.arg_key_id,true)),node=byId.get(integer(r.slice_id,true));need(d&&node&&node.is_selected,'relations','argument-reference');
  const a={dictionary:d,node,arg_set_id:nullableInteger(r.arg_set_id),arg_present:flag(r.arg_present),int_value:flagged(r,'int_value',x=>integer(x)),string_value:flagged(r,'string_value'),real_value:flagged(r,'real_value',real)};
  need(d.name===node.name&&a.arg_set_id===node.arg_set_id,'relations','argument-join');
  if(!a.arg_present)need(d.flat_key===null&&d.key===null&&d.value_type===null&&a.int_value===null&&a.string_value===null&&a.real_value===null,'relations','placeholder');
  else{
   need(a.arg_set_id!==null,'relations','matched-argset');const type=d.value_type;
   if(['int','uint','pointer','bool'].includes(type))need(a.int_value!==null&&a.string_value===null&&a.real_value===null&&(type!=='bool'||a.int_value===0n||a.int_value===1n),'types','argument-channel');
   else if(type==='string'||type==='json')need(a.int_value===null&&a.string_value!==null&&a.real_value===null,'types','argument-channel');
   else if(type==='real')need(a.int_value===null&&a.string_value===null&&a.real_value!==null,'types','argument-channel');
   else{need(type===null||type==='null','types','argument-type');need(a.int_value===null&&a.string_value===null&&a.real_value===null,'types','argument-channel');}
  }return a;
 });
 ordered(args,a=>[a.node.ts,a.node.id,a.dictionary.flat_key,a.dictionary.key,a.dictionary.value_type,a.int_value,a.string_value,a.real_value?.value??null]);
 const argsByNode=new Map();for(const n of nodes.filter(n=>n.is_selected)){
  const own=args.filter(a=>a.node===n);need(own.length>0&&(own.every(a=>a.arg_present)||(own.length===1&&!own[0].arg_present)),'relations','node-arguments');argsByNode.set(n.id,own);
 }
 for(const d of dictionary){const own=args.filter(a=>a.dictionary===d);need(own.length>0&&d.arg_occurrence_count===BigInt(own.filter(a=>a.arg_present).length)&&d.slice_count===BigInt(new Set(own.map(a=>a.node.id)).size),'relations','dictionary-counts');}
 // The same arg_set_id refers to the same complete argument multiset. Preserve
 // every occurrence, including repeated equal values, rather than deduplicating.
 const argSets=new Map();for(const [id,own]of argsByNode){const n=byId.get(id);if(n.arg_set_id===null)continue;const shape=JSON.stringify(own.map(a=>[a.arg_present,a.dictionary.flat_key,a.dictionary.key,a.dictionary.value_type,a.int_value?.toString()??null,a.string_value,a.real_value?.text??null]));if(argSets.has(n.arg_set_id))need(argSets.get(n.arg_set_id)===shape,'relations','shared-argset');else argSets.set(n.arg_set_id,shape);}
 const stats=rawStats.map(r=>({name:flagged(r,'name'),idx:r.idx==='[NULL]'?null:integer(r.idx),severity:flagged(r,'severity'),source:flagged(r,'source'),value:integer(r.value)}));need(stats.every(s=>s.value!==0n),'relations','zero-stat');
 need(stats.every(s=>(s.severity===null||['info','notice','data_loss','error'].includes(s.severity))&&(s.source===null||['trace','analysis'].includes(s.source))),'types','stat-label');ordered(stats,s=>[s.name,s.idx]);
 const bounds={start:integer(rawBounds[0].start_ts),end:integer(rawBounds[0].end_ts)};need(bounds.start<=bounds.end,'relations','bounds');
 return {phases,nodes,byId,argsByNode,counts,dictionary,stats,bounds};
}
export function parseWheelCarrierCsvV1(bytes,configuration){
 try{const {phases}=options(configuration,['phases']),names=strings(phases,2,16);const data=admit(csv(originalBytes(bytes)),names);const facade=Object.freeze({...authority(),status:'wheel-csv-parsed',stage:'complete',reason:null,tableRows:Object.freeze([data.counts.length,data.nodes.length,[...data.argsByNode.values()].reduce((n,a)=>n+a.length,0),data.dictionary.length,data.stats.length,1]),stats:Object.freeze(data.stats.map(s=>Object.freeze({name:s.name,idx:s.idx?.toString()??null,severity:s.severity,source:s.source,value:s.value.toString()}))),traceBounds:Object.freeze({start_ts:data.bounds.start.toString(),end_ts:data.bounds.end.toString()})});owned.set(facade,data);return facade;}
 catch(e){return unavailable(e);}
}
function required(data,node,key,type,value){
 const own=(data.argsByNode.get(node.id)??[]).filter(a=>a.dictionary.key===key||a.dictionary.flat_key===key);
 need(own.length===1,'graph','required-argument-cardinality');const a=own[0],d=a.dictionary;
 need(a.arg_present&&d.key===key&&d.flat_key===key&&d.value_type===type,'graph','required-argument-type');
 if(type==='string')need(a.string_value===value&&a.int_value===null&&a.real_value===null,'graph','required-argument-value');
 else need(a.int_value!==null&&a.int_value!==-1n&&a.string_value===null&&a.real_value===null,'graph','trace-id');return a;
}
export function evaluateWheelCarrierGraphV1(parsed,configuration){
 try{
  need(parsed!==null&&typeof parsed==='object'&&!types.isProxy(parsed)&&owned.has(parsed),'input','parsed-ownership');const data=owned.get(parsed);
  const o=options(configuration,['phaseNames','markerName']),phases=strings(o.phaseNames,2,2);
  need(same(phases,data.phases)&&/^native:native-wheel-carrier-v1:history100-up:start:[a-f0-9]{16}$/.test(phases[0])&&/^native:native-wheel-carrier-v1:history100-up:end:[a-f0-9]{16}$/.test(phases[1]),'graph','phase-expectation');
  need(typeof o.markerName==='string','graph','marker-expectation');const match=/^native-wheel-witness-v1:([a-f0-9]{32}):0:([1-9][0-9]{0,8})$/.exec(o.markerName);
  need(match&&BigInt(match[2])===1n+BigInt('0x'+match[1].slice(0,7)),'graph','marker-expectation');
  const marks=data.nodes.filter(n=>n.name?.startsWith(PREFIX));need(marks.length===1&&marks[0].name===o.markerName,'graph','marker-cardinality');const mark=marks[0];
  const phaseNodes=phases.map(name=>{const own=data.nodes.filter(n=>n.name===name);need(own.length===1,'graph','phase-cardinality');return own[0];});
  const context=n=>[n.track_id,n.utid,n.tid,n.upid,n.pid];const expected=context(mark);
  need(expected.every(v=>v!==null)&&mark.thread_name==='CrRendererMain','graph','thread-context');
  for(const n of [...phaseNodes,mark])need(n.is_selected&&n.category==='blink.user_timing'&&n.dur===0n&&n.thread_name==='CrRendererMain'&&same(context(n),expected)&&n.ts>=data.bounds.start&&n.ts<=data.bounds.end,'graph','phase-marker-shape');
  need(phaseNodes[0].ts<phaseNodes[1].ts&&phaseNodes[0].ts<=mark.ts&&mark.ts<phaseNodes[1].ts,'graph','phase-containment');
  const path=[],seen=new Set([mark.id]);let child=mark;
  while(child.parent_id!==null){const parent=data.byId.get(child.parent_id);need(parent&&!seen.has(parent.id),'graph','parent-edge');seen.add(parent.id);const endpoint=parent.ts+parent.dur;need(parent.dur>=0n&&endpoint>=MIN&&endpoint<=MAX&&parent.ts>=data.bounds.start&&parent.ts<=data.bounds.end&&endpoint<=data.bounds.end&&same(context(parent),expected)&&parent.thread_name==='CrRendererMain'&&child.depth===parent.depth+1n&&child.ts>=parent.ts&&child.ts+child.dur<=endpoint,'graph','parent-shape');path.push(parent);child=parent;}
  need(child.depth===0n,'graph','root-depth');
  const flows=path.filter(n=>n.name==='LatencyInfo.Flow'),widgets=path.filter(n=>n.name==='WidgetBaseInputHandler::OnHandleInputEvent');
  need(flows.length===1&&widgets.length===1&&path.indexOf(widgets[0])>path.indexOf(flows[0])&&flows[0].dur>0n&&widgets[0].dur>0n,'graph','wheel-ancestry');
  required(data,flows[0],'chrome_latency_info.step','string','STEP_HANDLE_INPUT_EVENT_MAIN');const id=required(data,flows[0],'chrome_latency_info.trace_id','int');required(data,widgets[0],'debug.event','string','MouseWheel');
  const witness=Object.freeze({markerId:mark.id.toString(),phaseIds:Object.freeze(phaseNodes.map(n=>n.id.toString())),flowId:flows[0].id.toString(),widgetId:widgets[0].id.toString(),traceId:id.int_value.toString(),ancestorIds:Object.freeze(path.map(n=>n.id.toString())),ancestorEdges:Object.freeze([mark,...path].map(n=>Object.freeze({childId:n.id.toString(),parentId:n.parent_id?.toString()??null}))),context:Object.freeze(Object.fromEntries(['trackId','utid','tid','upid','pid'].map((k,i)=>[k,expected[i].toString()]))) });
  return Object.freeze({...authority(),status:'imported-wheel-parent-graph-consistent',stage:'complete',reason:null,witness});
 }catch(e){return unavailable(e);}
}
