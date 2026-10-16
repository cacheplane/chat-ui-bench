/** Supplied-port diagnostics only. No page, source, presentation or FPS authority. */
export type Domain = 'threadTicks'|'timeTicks';
export type State = 'not-attempted'|'pending'|'fulfilled'|'rejected';
export type Identity = {pageLabel:string;sessionLabel:string;generation:number;active:boolean};
export type Continuity = {state:'not-checked'|'same'|'invalid'|'changed'|'inactive'|'admission-revoked';initial:Identity|null;checks:number};
export type Reply = {state:'fulfilled';reply:unknown}|{state:'not-attempted'|'pending'|'rejected'};
export type EndpointSet = {isolate:Reply;heap:Reply;dom:Reply;performance:Reply};
export type ScenarioState = 'not-attempted'|'pending'|'passed'|'failed'|'invalid'|'rejected';
export type Cleanup = {disable:State;detach:State};
export type DirectCostInput = {schemaVersion:'direct-cost-input-v1';declaredDomain:Domain;enable:State;continuity:Continuity;browser:Reply;baseline:EndpointSet;end:EndpointSet;scenario:ScenarioState;cleanup:Cleanup};
export type Reason = 'not-sampled'|'pending'|'rejected'|'shape'|'bound'|'duplicate-metric'|'missing-field'|'numeric-domain'|'enable-unavailable'|'identity-unavailable'|'isolate-unavailable'|'isolate-changed'|'timestamp-not-advancing'|'decreasing-selected-counter'|'scenario-unavailable'|'output-bound'|'cleanup-unavailable';
export type Value<T> = {status:'available';value:T}|{status:'unavailable';reason:Reason};
export type MetricRow = {name:string;value:number};
export type BrowserProjection = {protocolVersion:string;product:string;revision:string;userAgent:string;jsVersion:string};
export type HeapProjection = {usedSize?:number;totalSize?:number;embedderHeapUsedSize?:number;backingStorageSize?:number};
export type DOMProjection = {documents?:number;nodes?:number;jsEventListeners?:number};
export type EndpointProjection = {isolate:Value<{id:string}>;heap:Value<HeapProjection>;dom:Value<DOMProjection>;performance:Value<readonly MetricRow[]>};
export type DurationFacts = {domain:Domain;scope:'observed-renderer-thread';timestampStart:number;timestampEnd:number;taskSeconds:number;scriptSeconds:number;layoutSeconds:number;recalcStyleSeconds:number;devToolsCommandSeconds:number;v8CompileSeconds:Value<number>;layoutCount:Value<number>;recalcStyleCount:Value<number>};
export type GaugePair = {baseline:Value<number>;end:Value<number>;change:Value<number>};
export type DirectCostResult = {schemaVersion:'direct-cost-diagnostic-v1';qualification:false;fpsAvailable:false;status:'available'|'unavailable';declaredDomain:Domain|null;scenario:ScenarioState;continuity:Continuity;enable:State;cleanup:Cleanup;browser:Value<BrowserProjection>;baseline:EndpointProjection;end:EndpointProjection;durations:Value<DurationFacts>;gauges:{heapUsed:GaugePair;heapTotal:GaugePair;embedderHeapUsed:GaugePair;backingStorage:GaugePair;documents:GaugePair;nodes:GaugePair;jsEventListeners:GaugePair}};
export type DirectCostSnapshot = {schemaVersion:'direct-cost-sequence-v1';phase:'idle'|'running'|'settled';states:{browser:State;enable:State;baseline:{isolate:State;heap:State;dom:State;performance:State};end:{isolate:State;heap:State;dom:State;performance:State};disable:State;detach:State};scenario:ScenarioState;continuity:Continuity;primaryFailureObserved:boolean;result:DirectCostResult|null};
export type DirectCostPorts = {send(method:string,params?:{timeDomain:Domain}):Promise<unknown>;detach():Promise<void>;admissionOpen():boolean;identity():unknown};

const states:readonly unknown[]=['not-attempted','pending','fulfilled','rejected'];
const scenarios:readonly unknown[]=['not-attempted','pending','passed','failed','invalid','rejected'];
const continuityStates:readonly unknown[]=['not-checked','same','invalid','changed','inactive','admission-revoked'];
const required=['Timestamp','TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','DevToolsCommandDuration'] as const;
const heapKeys=['usedSize','totalSize','embedderHeapUsedSize','backingStorageSize'] as const;
const domKeys=['documents','nodes','jsEventListeners'] as const;
const unavailable=<T=never>(reason:Reason):Value<T>=>({status:'unavailable',reason});
const available=<T>(value:T):Value<T>=>({status:'available',value});
// Only these owned objects are classified. WeakMap lookup does not inspect a
// foreign thrown value's members or prototype, including hostile/revoked proxies.
const denialFacts=new WeakMap<object,{reason:Reason;budget:boolean}>();
class Denial {constructor(reason:Reason){denialFacts.set(this,{reason,budget:false});}}
class BudgetDenial extends Denial {constructor(){super('bound');denialFacts.set(this,{reason:'bound',budget:true});}}
function knownDenial(error:unknown):{reason:Reason;budget:boolean}|undefined{return error!==null&&(typeof error==='object'||typeof error==='function')?denialFacts.get(error):undefined;}
function object(value:unknown):value is object {return value!==null&&typeof value==='object';}
function reader(){let visits=0;return (value:unknown,key:string):unknown=>{if(++visits>4096)throw new BudgetDenial();if(!object(value))throw new Denial('shape');const d=Object.getOwnPropertyDescriptor(value,key);if(!d)return undefined;if(!('value'in d))throw new Denial('shape');return d.value;};}
type Read=ReturnType<typeof reader>;
function freeze<T>(value:T):T {if(object(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function copy<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function bytes(value:unknown):number{return new TextEncoder().encode(JSON.stringify(value)+'\n').length;}
function ascii(value:unknown,max:number):value is string{return typeof value==='string'&&value.length>=1&&value.length<=max&&/^[\x20-\x7e]+$/.test(value);}
function identity(value:unknown,read:Read):Identity {const pageLabel=read(value,'pageLabel'),sessionLabel=read(value,'sessionLabel'),generation=read(value,'generation'),active=read(value,'active');if(!ascii(pageLabel,128)||!ascii(sessionLabel,128)||typeof generation!=='number'||!Number.isSafeInteger(generation)||generation<0||typeof active!=='boolean')throw new Denial('shape');return {pageLabel,sessionLabel,generation,active};}
function emptyEndpoint(reason:Reason):EndpointProjection{return {isolate:unavailable(reason),heap:unavailable(reason),dom:unavailable(reason),performance:unavailable(reason)};}
function empty(reason:Reason):DirectCostResult {const pair=():GaugePair=>({baseline:unavailable(reason),end:unavailable(reason),change:unavailable(reason)});return {schemaVersion:'direct-cost-diagnostic-v1',qualification:false,fpsAvailable:false,status:'unavailable',declaredDomain:null,scenario:'not-attempted',continuity:{state:'not-checked',initial:null,checks:0},enable:'not-attempted',cleanup:{disable:'not-attempted',detach:'not-attempted'},browser:unavailable(reason),baseline:emptyEndpoint(reason),end:emptyEndpoint(reason),durations:unavailable(reason),gauges:{heapUsed:pair(),heapTotal:pair(),embedderHeapUsed:pair(),backingStorage:pair(),documents:pair(),nodes:pair(),jsEventListeners:pair()}};}
function denial(error:unknown):Reason {return knownDenial(error)?.reason??'shape';}
function normalizeReply<T>(value:unknown,read:Read,normalize:(raw:unknown)=>T):Value<T>{try{const state=read(value,'state');if(!states.includes(state))throw new Denial('shape');if(state!=='fulfilled')return unavailable(state==='pending'?'pending':state==='rejected'?'rejected':'not-sampled');const result=normalize(read(value,'reply'));if(bytes(result)>65536)throw new Denial('output-bound');return available(result);}catch(error){if(knownDenial(error)?.budget)throw error;return unavailable(denial(error));}}
function browser(raw:unknown,read:Read):BrowserProjection {const result={} as BrowserProjection;for(const key of ['protocolVersion','product','revision','userAgent','jsVersion'] as const){const v=read(raw,key);if(typeof v!=='string'||v.length<1)throw new Denial('shape');if(v.length>1024||new TextEncoder().encode(v).length>1024)throw new Denial('bound');result[key]=v;}return result;}
function isolate(raw:unknown,read:Read):{id:string}{const id=read(raw,'id');if(typeof id!=='string'||!/^[0-9a-f]{1,16}$/.test(id))throw new Denial('shape');return {id};}
function performance(raw:unknown,read:Read):MetricRow[]{const rows=read(raw,'metrics');if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype)throw new Denial('shape');const length=read(rows,'length');if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>256)throw new Denial('bound');const result:MetricRow[]=[],names=new Set<string>();for(let i=0;i<length;i++){const row=read(rows,String(i)),name=read(row,'name'),value=read(row,'value');if(!ascii(name,128))throw new Denial('bound');if(typeof value!=='number'||!Number.isFinite(value))throw new Denial('numeric-domain');if(names.has(name))throw new Denial('duplicate-metric');names.add(name);result.push({name,value});}return result;}
type GaugeMap=Record<string,Value<number>>;
function gauges(raw:unknown,read:Read,keys:readonly string[],max:number,heap:boolean):{projection:Record<string,number>;fields:GaugeMap}{if(!object(raw))throw new Denial('shape');const projection:Record<string,number>={},fields:GaugeMap={};for(const key of keys){let value:unknown;try{value=read(raw,key);}catch(error){if(knownDenial(error)?.budget)throw error;fields[key]=unavailable('shape');continue;}fields[key]=value===undefined?unavailable('missing-field'):typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max?available(value):unavailable('numeric-domain');if(fields[key].status==='available')projection[key]=fields[key].value;}
 if(heap&&projection.usedSize!==undefined&&projection.totalSize!==undefined&&projection.usedSize>projection.totalSize){delete projection.usedSize;delete projection.totalSize;fields.usedSize=unavailable('numeric-domain');fields.totalSize=unavailable('numeric-domain');}return {projection,fields};}
function endpoint(value:unknown,read:Read):{projection:EndpointProjection;heap:GaugeMap;dom:GaugeMap}{const heap:GaugeMap={},dom:GaugeMap={};const normalizeGauges=(raw:unknown,keys:readonly string[],max:number,target:GaugeMap,isHeap:boolean)=>{const result=gauges(raw,read,keys,max,isHeap);Object.assign(target,result.fields);return result.projection;};return {projection:{isolate:normalizeReply(read(value,'isolate'),read,v=>isolate(v,read)),heap:normalizeReply(read(value,'heap'),read,v=>normalizeGauges(v,heapKeys,Number.MAX_SAFE_INTEGER,heap,true)),dom:normalizeReply(read(value,'dom'),read,v=>normalizeGauges(v,domKeys,2147483647,dom,false)),performance:normalizeReply(read(value,'performance'),read,v=>performance(v,read))},heap,dom};}
function selected(rows:Value<readonly MetricRow[]>,name:string,count=false):Value<number>{if(rows.status==='unavailable')return unavailable(rows.reason);const row=rows.value.find(row=>row.name===name);if(!row)return unavailable('missing-field');return row.value>=0&&(!count||Number.isSafeInteger(row.value))?available(row.value):unavailable('numeric-domain');}
function baselineReason(result:DirectCostResult):Reason|null {if(result.browser.status==='unavailable')return result.browser.reason;if(result.enable!=='fulfilled')return 'enable-unavailable';if(result.continuity.state!=='same'||result.continuity.checks===0||!result.continuity.initial?.active)return 'identity-unavailable';if(result.baseline.isolate.status==='unavailable')return 'isolate-unavailable';for(const name of required){const value=selected(result.baseline.performance,name);if(value.status==='unavailable')return value.reason;}return null;}

// Supported-field snapshot at settlement. Invalid values become inert primitives;
// omitted fields stay omitted. Foreign objects and accessors never survive it.
function capture(raw:unknown,key:'browser'|'isolate'|'heap'|'dom'|'performance'):unknown {
 const read=reader();
 const fields=(value:unknown,keys:readonly string[]):unknown=>{if(!object(value))return null;const out:Record<string,unknown>={};for(const name of keys){try{const v=read(value,name);if(v!==undefined)out[name]=typeof v==='string'||typeof v==='number'||typeof v==='boolean'||v===null?v:null;}catch{out[name]=null;}}return out;};
 try{if(key==='browser')return fields(raw,['protocolVersion','product','revision','userAgent','jsVersion']);if(key==='isolate')return fields(raw,['id']);if(key==='heap')return fields(raw,heapKeys);if(key==='dom')return fields(raw,domKeys);
  const rows=read(raw,'metrics');if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return {metrics:null};const length=read(rows,'length');if(typeof length!=='number'||!Number.isSafeInteger(length)||length<0||length>256)return {metrics:new Array(257)};const normalized:unknown[]=[];for(let i=0;i<length;i++)normalized.push(fields(read(rows,String(i)),['name','value']));return {metrics:normalized};
 }catch{return null;}
}

/** Assesses caller-supplied observations; neither supplied states nor labels prove native acquisition. */
export function assessDirectCostSamples(input:unknown):DirectCostResult {
 const read=reader();let result=empty('shape');
 try{
  if(read(input,'schemaVersion')!=='direct-cost-input-v1')throw new Denial('shape');const domain=read(input,'declaredDomain'),enable=read(input,'enable'),scenario=read(input,'scenario');if((domain!=='threadTicks'&&domain!=='timeTicks')||!states.includes(enable)||!scenarios.includes(scenario))throw new Denial('shape');
  const c=read(input,'continuity'),state=read(c,'state'),initialRaw=read(c,'initial'),checks=read(c,'checks');if(!continuityStates.includes(state)||typeof checks!=='number'||!Number.isSafeInteger(checks)||checks<0||checks>19)throw new Denial('shape');const initial=initialRaw===null?null:identity(initialRaw,read);
  const cleanup=read(input,'cleanup'),disable=read(cleanup,'disable'),detach=read(cleanup,'detach');if(!states.includes(disable)||!states.includes(detach))throw new Denial('shape');
  result={...result,declaredDomain:domain,enable:enable as State,scenario:scenario as ScenarioState,continuity:{state:state as Continuity['state'],initial,checks},cleanup:{disable:disable as State,detach:detach as State}};
  result.browser=normalizeReply(read(input,'browser'),read,v=>browser(v,read));const baseline=endpoint(read(input,'baseline'),read),end=endpoint(read(input,'end'),read);result.baseline=baseline.projection;result.end=end.projection;
  let join:Reason|null=result.continuity.state!=='same'||checks!==19||!initial?.active?'identity-unavailable':scenario!=='passed'&&scenario!=='failed'?'scenario-unavailable':null;
  if(!join){const a=result.baseline.isolate,b=result.end.isolate;join=a.status!=='available'||b.status!=='available'?'isolate-unavailable':a.value.id!==b.value.id?'isolate-changed':null;}
  const delta=(name:string,count=false):Value<number>=>{const a=selected(result.baseline.performance,name,count),b=selected(result.end.performance,name,count);if(a.status==='unavailable')return a;if(b.status==='unavailable')return b;const value=b.value-a.value;return !Number.isFinite(value)||value<0?unavailable('decreasing-selected-counter'):available(value);};
  let durationReason=baselineReason(result)??join;const start=selected(result.baseline.performance,'Timestamp'),finish=selected(result.end.performance,'Timestamp');if(!durationReason){if(start.status==='unavailable')durationReason=start.reason;else if(finish.status==='unavailable')durationReason=finish.reason;else if(finish.value<=start.value)durationReason='timestamp-not-advancing';}
  const fields=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','DevToolsCommandDuration'].map(name=>delta(name));if(!durationReason){for(const value of fields)if(value.status==='unavailable'){durationReason=value.reason;break;}}
  if(durationReason)result.durations=unavailable(durationReason);else if(start.status==='available'&&finish.status==='available'&&fields.every(value=>value.status==='available')){result.durations=available({domain,scope:'observed-renderer-thread',timestampStart:start.value,timestampEnd:finish.value,taskSeconds:(fields[0] as {value:number}).value,scriptSeconds:(fields[1] as {value:number}).value,layoutSeconds:(fields[2] as {value:number}).value,recalcStyleSeconds:(fields[3] as {value:number}).value,devToolsCommandSeconds:(fields[4] as {value:number}).value,v8CompileSeconds:delta('V8CompileDuration'),layoutCount:delta('LayoutCount',true),recalcStyleCount:delta('RecalcStyleCount',true)});}
  const pair=(key:string,kind:'heap'|'dom'):GaugePair=>{const a=baseline[kind][key]??unavailable(baseline.projection[kind].status==='unavailable'?baseline.projection[kind].reason:'missing-field'),b=end[kind][key]??unavailable(end.projection[kind].status==='unavailable'?end.projection[kind].reason:'missing-field');return {baseline:a,end:b,change:join?unavailable(join):a.status==='unavailable'?unavailable(a.reason):b.status==='unavailable'?unavailable(b.reason):available(b.value-a.value)};};
  result.gauges={heapUsed:pair('usedSize','heap'),heapTotal:pair('totalSize','heap'),embedderHeapUsed:pair('embedderHeapUsedSize','heap'),backingStorage:pair('backingStorageSize','heap'),documents:pair('documents','dom'),nodes:pair('nodes','dom'),jsEventListeners:pair('jsEventListeners','dom')};result.status=result.durations.status==='available'&&disable==='fulfilled'&&detach==='fulfilled'?'available':'unavailable';
  if(bytes(result)>131072)throw new Denial('output-bound');return freeze(result);
 }catch(error){const reason=denial(error);const fallback=empty(reason);if(reason==='output-bound'){fallback.enable=result.enable;fallback.cleanup=result.cleanup;fallback.scenario=result.scenario;fallback.continuity=result.continuity;fallback.declaredDomain=result.declaredDomain;}return freeze(fallback);}
}

/** Effect-free construction. The caller supplies the once-shared detach original and outer deadline. */
export function createDirectCostSequence(ports:DirectCostPorts,scenario:()=>Promise<unknown>,declaredDomain:Domain):{run():Promise<DirectCostResult>;snapshot():DirectCostSnapshot}{
 let phase:DirectCostSnapshot['phase']='idle',hasPrimary=false,primary:unknown,result:DirectCostResult|null=null,enableAttempted=false;
 const endpoint=():EndpointSet=>({isolate:{state:'not-attempted'},heap:{state:'not-attempted'},dom:{state:'not-attempted'},performance:{state:'not-attempted'}});
 const input:DirectCostInput={schemaVersion:'direct-cost-input-v1',declaredDomain,enable:'not-attempted',browser:{state:'not-attempted'},baseline:endpoint(),end:endpoint(),scenario:'not-attempted',continuity:{state:'not-checked',initial:null,checks:0},cleanup:{disable:'not-attempted',detach:'not-attempted'}};
 // Retained originals are private and never traversed, copied, serialized, or exposed.
 const originals:unknown[]=[];const failures:unknown[]=[];
 const remember=(value:unknown)=>{failures.push(value);if(!hasPrimary){hasPrimary=true;primary=value;}};
 const check=():boolean=>{if(input.continuity.state!=='not-checked'&&input.continuity.state!=='same')return false;input.continuity.checks++;if(ports.admissionOpen()!==true){input.continuity.state='admission-revoked';return false;}const raw=ports.identity();let current:Identity;try{current=identity(raw,reader());}catch{input.continuity.state='invalid';return false;}if(!input.continuity.initial)input.continuity.initial=current;if(!current.active){input.continuity.state='inactive';return false;}const initial=input.continuity.initial;if(current.pageLabel!==initial.pageLabel||current.sessionLabel!==initial.sessionLabel||current.generation!==initial.generation){input.continuity.state='changed';return false;}input.continuity.state='same';return true;};
 const measure=async(method:string,set:EndpointSet|DirectCostInput,key:'isolate'|'heap'|'dom'|'performance'|'browser'):Promise<boolean>=>{if(!check())return false;(set as unknown as Record<string,Reply>)[key]={state:'pending'};let raw:unknown;try{const promise=ports.send(method);originals.push(promise);raw=await promise;originals.push(raw);(set as unknown as Record<string,Reply>)[key]={state:'fulfilled',reply:raw};}catch(error){(set as unknown as Record<string,Reply>)[key]={state:'rejected'};throw error;}
  // Store supported primitives immediately, then apply the same bounded assessor.
  (set as unknown as Record<string,Reply>)[key]={state:'fulfilled',reply:capture(raw,key)};
  assessDirectCostSamples(input);
  return check();};
 const perform=async():Promise<void>=>{
   if(!await measure('Browser.getVersion',input,'browser'))return;
   if(assessDirectCostSamples(input).browser.status!=='available')return;
   enableAttempted=true;input.enable='pending';try{const original=ports.send('Performance.enable',{timeDomain:declaredDomain});originals.push(original);originals.push(await original);input.enable='fulfilled';}catch(error){input.enable='rejected';throw error;}
   for(const [method,key] of [['Runtime.getIsolateId','isolate'],['Runtime.getHeapUsage','heap'],['Memory.getDOMCounters','dom'],['Performance.getMetrics','performance']] as const){if(!await measure(method,input.baseline,key))return;if(key==='isolate'&&assessDirectCostSamples(input).baseline.isolate.status!=='available')return;}
   if(baselineReason(assessDirectCostSamples(input))||!check())return;
   input.scenario='pending';let value:unknown;try{const original=scenario();originals.push(original);value=await original;originals.push(value);}catch(error){input.scenario='rejected';throw error;}let status:unknown;try{status=reader()(value,'status');}catch{status=undefined;}input.scenario=status==='passed'||status==='failed'?status:'invalid';if(input.scenario==='invalid')return;
   for(const [method,key] of [['Performance.getMetrics','performance'],['Memory.getDOMCounters','dom'],['Runtime.getHeapUsage','heap'],['Runtime.getIsolateId','isolate']] as const)if(!await measure(method,input.end,key))return;
 };
 const run=async():Promise<DirectCostResult>=>{if(phase!=='idle')throw new Error('Direct cost sequence already run');phase='running';let owned=false;
  try{if(ports.admissionOpen()!==true)input.continuity.state='admission-revoked';else{owned=true;if(declaredDomain==='threadTicks'||declaredDomain==='timeTicks')await perform();}
  }catch(error){remember(error);}finally{if(owned){if(enableAttempted){input.cleanup.disable='pending';try{const original=ports.send('Performance.disable');originals.push(original);originals.push(await original);input.cleanup.disable='fulfilled';}catch(error){input.cleanup.disable='rejected';remember(error);}}input.cleanup.detach='pending';try{const original=ports.detach();originals.push(original);await original;input.cleanup.detach='fulfilled';}catch(error){input.cleanup.detach='rejected';remember(error);}}result=assessDirectCostSamples(input);phase='settled';}
  if(hasPrimary)throw primary;return result;
 };
 return {run,snapshot:()=>freeze({schemaVersion:'direct-cost-sequence-v1',phase,states:{browser:input.browser.state,enable:input.enable,baseline:{isolate:input.baseline.isolate.state,heap:input.baseline.heap.state,dom:input.baseline.dom.state,performance:input.baseline.performance.state},end:{isolate:input.end.isolate.state,heap:input.end.heap.state,dom:input.end.dom.state,performance:input.end.performance.state},disable:input.cleanup.disable,detach:input.cleanup.detach},scenario:input.scenario,continuity:copy(input.continuity),primaryFailureObserved:hasPrimary,result:result===null?null:copy(result)})};
}
