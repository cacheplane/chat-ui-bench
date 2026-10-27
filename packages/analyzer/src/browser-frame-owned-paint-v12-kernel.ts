import {createHash} from 'node:crypto';
import {createPaintPacketAdapter,packetAdapterReservation,PAINT_PACKET_ADAPTER_POLICY,type OwnedPacketResult} from './browser-frame-paint-packet-adapter.js';
import {comparePaintTimingRInventory,PAINT_TIMING_R_BODY_POLICY,PAINT_TIMING_R_SOURCE_ABI_V1} from './browser-frame-paint-timing-r-fragments.js';
import {decodeWholeStateBody,type AnnotationStateBodyFragment} from './browser-frame-state-fragments.js';
import {decodeWholeDescriptor} from './browser-frame-track-descriptor-fragments.js';
import {resolveAnnotations} from './browser-frame-ordered-state.js';
import {OwnedPaintBudgetV12,OWNED_PAINT_V12_LIMITS as L,stateBodyReservationV12,descriptorReservationV12,comparatorReservationV12,emptyOperationV12,type OperationTotalsV12} from './browser-frame-owned-paint-v12-budget.js';
import type {RootFrame} from './browser-frame-trace-framer.js';
import type {PacketFields,PacketOccurrence} from './browser-frame-packet-fragments.js';

export const OWNED_PAINT_V12_POLICY='private-owned-whole-ordered-paint-r-v12';
export const OWNED_PAINT_V12_METRICS=Object.freeze({FPS:null,rate:null,latency:null,duration:null});
export const OWNED_PAINT_V12_AUTHORITY=Object.freeze({nativeSupported:false,qualificationEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,clock:'not_evaluated',target:'not_evaluated',presentation:'not_evaluated',population:'not_evaluated',inputOrigin:'not_authenticated'} as const);
export type MachineV12={status:'absent';id:null}|{status:'present';id:string};
export interface SourceV12 {packetIndex:number;rootBodyStart:number;packetBytes:number;packetSHA256:string}
export interface SpanV12 {packetIndex:number;scope:string;fieldNumber:number;wireType:0|1|2|5;start:number;valueStart:number;end:number}
export type TableV12='event_names'|'event_categories'|'debug_annotation_names';
export interface DefinitionV12 {definitionIndex:number;sequenceIndex:number;epoch:number;machine:MachineV12;sequenceId:string;table:TableV12;iid:string;value:string;source:SourceV12;definedAt:SpanV12}
export interface DefinitionRefV12 {definitionIndex:number;source:SourceV12;definedAt:SpanV12;sequenceIndex:number;epoch:number;table:TableV12;iid:string;value:string}
export interface SequenceV12 {sequenceIndex:number;machine:MachineV12;sequenceId:string;valid:boolean;epoch:number;defaultsVersionIndex:number|null}
export interface DefaultV12 {versionIndex:number;sequenceIndex:number;epoch:number;source:SourceV12;location:SpanV12;timestampClockId:string|null;trackEventDefaultsPresent:boolean;trackUuid:string|null;counterTrackUuidsPresent:boolean;counterTrackUuidCount:number;doubleCounterTrackUuidsPresent:boolean;doubleCounterTrackUuidCount:number}
export interface HeadersV12 {timestamp:string|null;timestampClockId:string|null;sequenceFlags:string|null;incrementalStateCleared:boolean|null;previousPacketDropped:string|null;firstPacketOnSequence:boolean|null}
export type SelectionV12={status:'selected';source:'packet'|'event'|'defaults';value:string;defaultsVersionIndex:number|null;reason:null}|{status:'unavailable';source:null;value:null;defaultsVersionIndex:null;reason:string};
export interface PaintContextV12 {source:SourceV12;eventLocation:SpanV12;eventBodySHA256:string;machine:MachineV12;sequenceId:string;sequenceIndex:number;epoch:number;defaultsVersionIndex:number|null;headers:HeadersV12;clock:SelectionV12;track:SelectionV12}
export interface PaintRefV12 {channel:string;iid:string;location:SpanV12;definition:DefinitionRefV12|null;status?:'resolved'|'withheld';reason?:string|null}
export interface PaintRowV12 {status:'matched'|'withheld';domain:'owned-ordered-paint-r-v12';context:PaintContextV12;shape:{variant:string;frame:string;afterUserInput:string|null;legacy:{phase:82;location:SpanV12;phaseLocation:SpanV12};opaque:{location:SpanV12;bytes:number;sha256:string}|null};family:string|null;references:PaintRefV12[];rule:typeof RULE}
export interface CandidateV12 {source:SourceV12;eventLocation:SpanV12;machine:MachineV12;sequenceId:string;sequenceIndex:number;epoch:number;defaultsVersionIndex:number|null;kind:'literal_string'|'withheld';representation:'annotation'|'event_name'|'withheld';value:string|null;reason:string|null;annotationIndex:number|null;nameSource:'literal'|'intern'|'unresolved';definitionIndex:number|null;clock:SelectionV12;track:SelectionV12;rawTimestamp:string|null;timestampStatus:'absent'|'raw-unqualified'}
export interface RawDropV12 {source:SourceV12;machine:MachineV12;sequenceId:string;priorSeen:boolean;headers:HeadersV12;classification:'explained'|'unexplained'}
type LayoutFactV12={kind:'track_descriptor';fields:{uuid:string|null;parentUuid:string|null;process:{pid:string|null;startTimestampNs:string|null}|null;thread:{pid:string|null;tid:string|null}|null};propertyOrder:string[]}|{kind:'clock_snapshot_layout';primaryTraceClock:string|null;clocks:(['timestamp']|['clockId'|'unitMultiplierNs',string]|['isIncremental',boolean])[][]};
export type LayoutOccurrenceV12=[number,SourceV12,MachineV12,[string,number,number]|null,HeadersV12,SpanV12,string[]|null];
export interface DiagnosticV12 {code:string;phase:string;packetIndex:number|null;component:string|null;cause:string|null}
export class OwnedPaintFailureV12 extends Error {constructor(readonly code:string,readonly component:string|null=null,readonly causeCode:string|null=null){super(code);}}
const RULE=Object.freeze({bodyPolicy:PAINT_TIMING_R_BODY_POLICY,adapterPolicy:PAINT_PACKET_ADAPTER_POLICY,chromiumRevision:PAINT_TIMING_R_SOURCE_ABI_V1.chromiumRevision,perfettoRevision:PAINT_TIMING_R_SOURCE_ABI_V1.perfettoRevision,sourceABIManifestSHA256:'7cc69940571040a756ff03ed244ee6fbbecba7317d66decde05a153f18e90cdf',compatibilityManifestSHA256:'5e68e968605e192c835c74d74c4ddab63c9a3df844c52a1c5831236b56680fed',ownerPolicy:OWNED_PAINT_V12_POLICY});
const counterKeys='packets processedPackets decodedPackets oldPackets paintPackets opaqueNoStatePackets metadataPackets trackEvents ordinaryTrackEvents ordinaryEventsWithAnnotations ordinaryAnnotationEntries ordinaryResolvedRootInventories ordinaryWithheldRootInventories markAbsent markLiteral markWithheld paintMatched paintWithheld paintResolvedReferences paintWithheldReferences resets losses sequenceKeys newDefinitions repeatedDefinitions defaultsVersions disclosures clockSnapshots metadataFacts metadataOccurrences clockChildren rawDropDeclarations explainedRawDropDeclarations unexplainedRawDropDeclarations firstContradictions supportedLegacyFramePresented feedCalls'.split(' ');
const nativeSubarray=Uint8Array.prototype.subarray;
const machine=(f:PacketFields):MachineV12=>f.machineId===undefined?{status:'absent',id:null}:{status:'present',id:f.machineId};
const headers=(f:PacketFields):HeadersV12=>({timestamp:f.timestamp??null,timestampClockId:f.timestampClockId??null,sequenceFlags:f.sequenceFlags??null,incrementalStateCleared:f.incrementalStateCleared??null,previousPacketDropped:f.previousPacketDropped??null,firstPacketOnSequence:f.firstPacketOnSequence??null});
type Current={row:SequenceV12;tables:Record<TableV12,Map<string,number>>;liveLeases:Map<number,{release:()=>void;utf8:number;utf16:number}>};

/** Internal original-byte owner. No caller-created packet/fragment is consumed. */
export function createOwnedPaintKernelV12(budget:OwnedPaintBudgetV12){
 const adapter=createPaintPacketAdapter(); // one provenance gate for the entire study lifetime
 const sequences:SequenceV12[]=[],definitions:DefinitionV12[]=[],defaults:DefaultV12[]=[],candidates:CandidateV12[]=[],paint:PaintRowV12[]=[],rawDrops:RawDropV12[]=[],facts:LayoutFactV12[]=[],occurrences:LayoutOccurrenceV12[]=[];
 const keys=new Map<string,Current>(),factKeys=new Map<string,number>(),disclosures=new Map<string,{values:Map<string,string>;conflict:boolean;processSeen:boolean;threadSeen:boolean}>();
 const retained:(()=>void)[]=[],hashes={packet:createHash('sha256'),transition:createHash('sha256'),definition:createHash('sha256'),metadata:createHash('sha256'),paint:createHash('sha256')};
 const counters:Record<string,number>=Object.fromEntries(counterKeys.map(k=>[k,0]));
 const sequenceStart={raw:0,explained:0,unexplained:0,contradictions:0};let markWithheld=false,paintWithheld=false;
 let definitionsBytes=0,metadataCanonicalBytes=0,disclosureCount=0,maxFactKeyBytes=0;
 const pendingHelpers=new Set<()=>void>();
 function helperLease(release:()=>void){const wrapped=()=>{if(pendingHelpers.delete(wrapped))release();};pendingHelpers.add(wrapped);return wrapped;}
 function work(n=1){budget.chargeCumulative('wrapperWork',n);}
 function width(value:string){budget.chargeCumulative('utf8WidthScanUnits',value.length);return Buffer.byteLength(value);}
 function retain(value:unknown,role:string){const lease=budget.retain(value,role);retained.push(lease.release);return lease.measure;}
 function count(key:string,n=1){work();const next=counters[key]!+n;if(!Number.isSafeInteger(next))throw new OwnedPaintFailureV12('kernel-counter-range');counters[key]=next;}
 function success(key:string,n=1){budget.addSuccessful(key,n);}
 function ensureSuccess(key:string,n=1){budget.ensureSuccessfulRoom(key,n);}
 function note(which:keyof typeof hashes,label:string,values:readonly(string|number|boolean|null)[]){
  work(64+32*values.length);let n=label.length+2;
  const widths:number[]=[];
  for(const value of values){
   if(typeof value==='string'){const bytes=width(value);widths.push(bytes);n+=2+String(bytes).length+bytes;}
   else{widths.push(0);n+=value===null||typeof value==='boolean'?2:2+String(value).length;}
  }
  budget.chargeCumulative('manifestBytes',n);budget.chargeCumulative('manifestUpdates',1);
  const release=budget.reserveTransient({utf16Units:64+label.length,logicalSlots:values.length+2});
  try{
   const hash=hashes[which];hash.update(label,'ascii').update('\n','ascii');
   for(let i=0;i<values.length;i++){const value=values[i]!;if(typeof value==='string')hash.update('s'+widths[i]+':','ascii').update(value,'utf8');else hash.update(value===null?'n;':typeof value==='boolean'?value?'t;':'f;':'i'+value+';','ascii');}
   hash.update('\n','ascii');
  }finally{release();}
 }
 function span(source:SourceV12,o:{scope?:string;fieldNumber:number;wireType:0|1|2|5;start:number;valueStart:number;end:number},shift=0,scope=o.scope===undefined||o.scope==='root'?'track_event':o.scope):SpanV12{
  work(8);const start=o.start+shift,valueStart=o.valueStart+shift,end=o.end+shift;
  if(!Number.isSafeInteger(end)||start<0||start>valueStart||valueStart>end||end>source.packetBytes)throw new OwnedPaintFailureV12('kernel-source-span');
  return {packetIndex:source.packetIndex,scope,fieldNumber:o.fieldNumber,wireType:o.wireType,start,valueStart,end};
 }
 function ref(current:Current,table:TableV12,iid:string,chargeReference=true):DefinitionRefV12|undefined{
  work(1+iid.length);if(chargeReference)success('references');const index=current.tables[table].get(iid);if(index===undefined)return;
  const d=definitions[index];if(!d||d.sequenceIndex!==current.row.sequenceIndex||d.epoch!==current.row.epoch||d.table!==table||d.iid!==iid)throw new OwnedPaintFailureV12('kernel-definition-scope');
  return {definitionIndex:d.definitionIndex,source:d.source,definedAt:d.definedAt,sequenceIndex:d.sequenceIndex,epoch:d.epoch,table:d.table,iid:d.iid,value:d.value};
 }
 // Copied selected policy from frozen ordered-state.ts select:61–67, with V12 nullable schema and precharges.
 function select(current:Current,explicit:string|undefined,kind:'clock'|'track'):SelectionV12{
  work(4);const s=current.row,d=s.defaultsVersionIndex===null?undefined:defaults[s.defaultsVersionIndex];
  if(explicit!==undefined&&(kind==='track'||explicit!=='0'))return {status:'selected',source:kind==='clock'?'packet':'event',value:explicit,defaultsVersionIndex:null,reason:null};
  const value=kind==='clock'?d?.timestampClockId:d?.trackUuid;
  if(s.valid&&value!==undefined&&value!==null&&(kind==='track'||value!=='0'))return {status:'selected',source:'defaults',value,defaultsVersionIndex:s.defaultsVersionIndex,reason:null};
  return {status:'unavailable',source:null,value:null,defaultsVersionIndex:null,reason:!s.valid&&s.defaultsVersionIndex!==null?'invalid_sequence_default_state':`no_explicit_or_valid_default_${kind}`};
 }
 function helper(p:OwnedPacketResult,at:PacketOccurrence,kind:'defaults'|'interned_names'|'clock_snapshot'){
  const m=at.end-at.valueStart;budget.ensureSemanticRoom(Math.min(8192,m),Math.min(4096,m));
  const release=helperLease(budget.reserveOperation('state',stateBodyReservationV12(m,kind)));
  const decoded=decodeWholeStateBody(nativeSubarray.call(p.bodyBytes,at.valueStart,at.end),kind);
  if(decoded.status==='unavailable'){release();throw new OwnedPaintFailureV12('fragment-unavailable',kind,decoded.diagnostics[0]?.code??'invalid-state-body-input');}
  const f=decoded.fields,members=kind==='interned_names'?(f.entries?.length??0):kind==='clock_snapshot'?(f.clocks?.length??0):(f.trackEventDefaults?.counterTrackUuids?.length??0)+(f.trackEventDefaults?.doubleCounterTrackUuids?.length??0);
  try{budget.commitSemantic(decoded.occurrences.length,members);return {decoded,release};}catch(error){release();throw error;}
 }
 function metadata(p:OwnedPacketResult,source:SourceV12,current:Current|undefined){
  for(const at of p.rawWindows){work();if(at.fieldNumber!==6&&at.fieldNumber!==60)continue;
   const h=headers(p.fields),m=machine(p.fields),s=current?.row;
   // Preserve the frozen codec2 retain() observation at its original phase,
   // including optional-header insertion order, before compacting it.
   const packetFields:Record<string,string|boolean>={};work(6);
   for(const key of ['timestamp','timestampClockId','sequenceFlags','previousPacketDropped','incrementalStateCleared','firstPacketOnSequence'] as const){const value=p.fields[key];if(value!==undefined)packetFields[key]=value;}
   const observationContext={packetIndex:source.packetIndex,bodySha256:source.packetSHA256,machineContext:m.status==='absent'?{status:'absent'}:{status:'present',machineId:m.id},sequenceContext:s===undefined?{status:'absent'}:{status:'present',sequenceId:s.sequenceId,sequenceIndex:s.sequenceIndex,intervalVersion:s.epoch},packetFields,location:span(source,at)};
   let fact:LayoutFactV12,timestamps:string[]|null=null,full:unknown,release:()=>void;
   if(at.fieldNumber===60){
    const n=at.end-at.valueStart;budget.ensureSemanticRoom(Math.min(8192,n),Math.min(2,n));release=helperLease(budget.reserveOperation('descriptor',descriptorReservationV12(n)));
    const d=decodeWholeDescriptor(nativeSubarray.call(p.bodyBytes,at.valueStart,at.end));
    if(d.status==='unavailable'){release();throw new OwnedPaintFailureV12('fragment-unavailable','track_descriptor',d.diagnostics[0]?.code??'invalid-track-descriptor-body-input');}
    budget.commitSemantic(d.occurrences.length,Number(d.fields.process!==undefined)+Number(d.fields.thread!==undefined));
    const f=d.fields,order:string[]=[];work(16);
    for(const key of Object.keys(f)){order.push(key);if(key==='process')for(const child of Object.keys(f.process!))order.push('process.'+child);if(key==='thread')for(const child of Object.keys(f.thread!))order.push('thread.'+child);}
    fact={kind:'track_descriptor',fields:{uuid:f.uuid??null,parentUuid:f.parentUuid??null,process:f.process===undefined?null:{pid:f.process.pid??null,startTimestampNs:f.process.startTimestampNs??null},thread:f.thread===undefined?null:{pid:f.thread.pid??null,tid:f.thread.tid??null}},propertyOrder:order};
    full={...observationContext,kind:'track_descriptor',fields:f};
    const reasons=['clock_not_normalized','frame_mapping_not_implemented'];
    if(!s)reasons.push('missing_sequence_context');
    if(f.uuid===undefined||f.uuid==='0'||d.descriptorAssociation==='none'||f.process!==undefined&&f.process.pid===undefined||f.thread!==undefined&&(f.thread.pid===undefined||f.thread.tid===undefined))reasons.push('incomplete_association');
    if(f.parentUuid!==undefined)reasons.push('unresolved_parent');if(d.descriptorAssociation==='ambiguous-process-and-thread')reasons.push('ambiguous_process_and_thread');
    // Retain bounded disclosed scalars only; no association/target qualification is inferred.
    if(f.uuid!==undefined&&f.uuid!=='0'){
     const keyJSON=budget.canonical([m.status,m.id,f.uuid]),key=keyJSON.text;work(key.length);let group=disclosures.get(key);
     try{
     if(!group){if(disclosureCount>=L.disclosures)throw new OwnedPaintFailureV12('capacity-disclosures');retain({key},'disclosure');group={values:new Map(),conflict:false,processSeen:false,threadSeen:false};disclosures.set(key,group);disclosureCount++;count('disclosures');}
     const entries:[string,string|undefined][]=[['parent',f.parentUuid],['process.pid',f.process?.pid],['process.start',f.process?.startTimestampNs],['thread.pid',f.thread?.pid],['thread.tid',f.thread?.tid]];
     for(const [key,value] of entries){work();if(value===undefined)continue;const prior=group.values.get(key);if(prior===undefined){retain({key,value},'disclosure');group.values.set(key,value);}else{work(prior.length+value.length);if(prior!==value)group.conflict=true;}}
     group.processSeen||=f.process!==undefined;group.threadSeen||=f.thread!==undefined;
     note('metadata','disclosure',[key,group.conflict,group.processSeen,group.threadSeen]);
     }finally{keyJSON.release();}
    }
    note('metadata','descriptor-reasons',reasons);
   }else{
    const d=helper(p,at,'clock_snapshot');release=d.release;const f=d.decoded.fields;timestamps=[];
    const clocks:Extract<LayoutFactV12,{kind:'clock_snapshot_layout'}>['clocks']=[];
    for(const clock of f.clocks??[]){work(5);success('clockChildren');const entries:Extract<LayoutFactV12,{kind:'clock_snapshot_layout'}>['clocks'][number]=[];
     for(const key of Object.keys(clock) as (keyof typeof clock)[]){work();ensureSuccess('layoutEntrySlots');if(key==='timestamp'){ensureSuccess('timestampSlots');timestamps.push(clock.timestamp!);success('timestampSlots');entries.push(['timestamp']);}else if(key==='isIncremental')entries.push([key,clock[key]!]);else entries.push([key,clock[key]!]);success('layoutEntrySlots');}
     const id=clock.clockId;const scope=id===undefined?'missing_clock_id':id==='0'?'unknown_clock_id':BigInt(id)>=128n?'reserved_clock_id':BigInt(id)>=64n?s===undefined?'missing_sequence_context':'sequence-local':'machine-clock-id';
     note('metadata','clock-scope',[id??null,scope,m.status,m.id,s?.sequenceId??null,s?.sequenceIndex??null,s?.epoch??null]);clocks.push(entries);
    }
    fact={kind:'clock_snapshot_layout',primaryTraceClock:f.primaryTraceClock??null,clocks};
    full={...observationContext,kind:'clock_snapshot',...(f.primaryTraceClock===undefined?{}:{primaryTraceClock:f.primaryTraceClock}),clocks:f.clocks??[]};count('clockSnapshots');count('clockChildren',clocks.length);
   }
   try{
    const fullJSON=budget.canonical(full);budget.chargeCumulative('fullMetadataRowBytes',fullJSON.measure.escapedBytes);fullJSON.release();
    const prospective=budget.measure(fact);
    if(prospective.escapedBytes>L.metadataCanonicalRowBytes)throw new OwnedPaintFailureV12('capacity-metadataCanonicalRowBytes');
    budget.chargeCumulative('metadataFactKeyBytes',prospective.escapedBytes);
    // Candidate and possible retained exact key coexist with helper and staging.
    const possibleKey=helperLease(budget.reserveTransient({utf16Units:prospective.escapedBytes,logicalSlots:2}));
    let keptKey=false;
    const canonical=budget.canonical(fact,prospective);
    try{
     if(canonical.measure.escapedBytes>L.metadataCanonicalRowBytes)throw new OwnedPaintFailureV12('capacity-metadataCanonicalRowBytes');
     // One native Map lookup; exact string equality establishes identity. Native
     // map hashing/collision implementation is outside this source work model.
     budget.chargeCumulative('canonicalComparisonBytes',canonical.measure.escapedBytes+maxFactKeyBytes);
     let index=factKeys.get(canonical.text);
     if(index===undefined){ensureSuccess('metadataFacts');const n=canonical.measure.escapedBytes;if(n>L.metadataCanonicalBytes-metadataCanonicalBytes)throw new OwnedPaintFailureV12('capacity-metadataCanonicalBytes');
      retain(fact,'metadataFact');retained.push(possibleKey);keptKey=true;budget.addRetained('metadataUTF8',canonical.measure.utf8Bytes);metadataCanonicalBytes+=n;maxFactKeyBytes=Math.max(maxFactKeyBytes,n);index=facts.length;factKeys.set(canonical.text,index);facts.push(fact);success('metadataFacts');count('metadataFacts');
     }
     ensureSuccess('metadataOccurrences');const occurrence:LayoutOccurrenceV12=[index,source,m,s?[s.sequenceId,s.sequenceIndex,s.epoch]:null,h,span(source,at),timestamps];
     const encoded=budget.canonical(occurrence);budget.chargeCumulative('metadataOccurrenceBytes',encoded.measure.escapedBytes);encoded.release();
     const measured=retain(occurrence,'metadataOccurrence');budget.addRetained('metadataUTF8',measured.utf8Bytes);occurrences.push(occurrence);success('metadataOccurrences');count('metadataOccurrences');note('metadata','occurrence',[index,source.packetIndex,source.packetSHA256]);
    }finally{canonical.release();if(!keptKey)possibleKey();}
   }finally{release();}
  }
 }
 function applyDefaults(p:OwnedPacketResult,source:SourceV12,current:Current){
  const at=p.rawWindows.find(w=>w.fieldNumber===59);if(!at)return;
  const {decoded,release}=helper(p,at,'defaults');try{const f=decoded.fields,t=f.trackEventDefaults;
   ensureSuccess('defaultsVersions');const row:DefaultV12={versionIndex:defaults.length,sequenceIndex:current.row.sequenceIndex,epoch:current.row.epoch,source,location:span(source,at),timestampClockId:f.timestampClockId??null,trackEventDefaultsPresent:t!==undefined,trackUuid:t?.trackUuid??null,counterTrackUuidsPresent:t?.counterTrackUuids!==undefined,counterTrackUuidCount:t?.counterTrackUuids?.length??0,doubleCounterTrackUuidsPresent:t?.doubleCounterTrackUuids!==undefined,doubleCounterTrackUuidCount:t?.doubleCounterTrackUuids?.length??0};
   const m=retain(row,'defaults');budget.addRetained('defaultsUTF8',m.utf8Bytes);current.row.defaultsVersionIndex=row.versionIndex;defaults.push(row);success('defaultsVersions');count('defaultsVersions');note('transition','defaults',[row.versionIndex,row.timestampClockId,row.trackUuid,row.counterTrackUuidsPresent,row.counterTrackUuidCount,row.doubleCounterTrackUuidsPresent,row.doubleCounterTrackUuidCount]);
  }finally{release();}
 }
 function applyIntern(p:OwnedPacketResult,source:SourceV12,current:Current){
  const at=p.rawWindows.find(w=>w.fieldNumber===12);if(!at)return;
  const {decoded,release}=helper(p,at,'interned_names');try{
   const entries=decoded.fields.entries??[];success('internUpdates',entries.length);success('repeatedWork',entries.length);
   const locations=decoded.occurrences.filter(o=>o.scope==='interned_data'&&(o.fieldNumber===1||o.fieldNumber===2||o.fieldNumber===3));work(decoded.occurrences.length);
   if(current.row.valid)for(let i=0;i<entries.length;i++){
    work();const entry=entries[i]!,table=current.tables[entry.table],prior=table.get(entry.iid);width(entry.name);
    if(prior!==undefined){const d=definitions[prior]!;work(d.value.length+entry.name.length);if(d.value!==entry.name)throw new OwnedPaintFailureV12('intern-conflict');count('repeatedDefinitions');continue;}
    if(width(entry.name)>L.outputStringUTF8)throw new OwnedPaintFailureV12('capacity-outputStringUTF8');
    ensureSuccess('historyDefinitions');const n=width(entry.name)+width(entry.iid);if(n>L.historyUTF8-definitionsBytes)throw new OwnedPaintFailureV12('capacity-historyUTF8');
    budget.addRetained('historyUTF8',n);budget.addRetained('historyUTF16',entry.name.length+entry.iid.length);budget.addRetained('liveInternEntries',1);budget.addRetained('liveInternUTF8',n);budget.addRetained('liveInternUTF16',entry.name.length+entry.iid.length);
    const row:DefinitionV12={definitionIndex:definitions.length,sequenceIndex:current.row.sequenceIndex,epoch:current.row.epoch,machine:current.row.machine,sequenceId:current.row.sequenceId,table:entry.table,iid:entry.iid,value:entry.name,source,definedAt:span(source,locations[i]!,at.valueStart)};
    retain(row,'definition');const live=budget.reserveTransient({logicalSlots:2,utf16Units:entry.iid.length});current.liveLeases.set(row.definitionIndex,{release:live,utf8:n,utf16:entry.name.length+entry.iid.length});definitionsBytes+=n;table.set(entry.iid,row.definitionIndex);definitions.push(row);success('historyDefinitions');count('newDefinitions');note('definition','definition',[row.definitionIndex,row.sequenceIndex,row.epoch,row.table,row.iid,row.value,source.packetSHA256,row.definedAt.start,row.definedAt.end]);
   }
  }finally{release();}
 }
 function paintEvent(p:Extract<OwnedPacketResult,{branch:'paint'}>,source:SourceV12,current:Current){
  const e=p.paintProjection,at=p.occurrences.find(o=>o.scope==='packet'&&o.fieldNumber===11)!;
  ensureSuccess('paintRows');const all=[e.nameIid,...e.categoryIids,...e.annotations.map(a=>a.nameIid)],tables:TableV12[]=['event_names','event_categories','event_categories','event_categories','debug_annotation_names','debug_annotation_names'];
  const channels=['eventName','category0','category1','category2','annotation0','annotation1'];
  const locations=[e.directOccurrences[3]!,...e.directOccurrences.slice(0,3),e.annotations[0]!.occurrences[0]!,e.annotations[1]!.occurrences[0]!];
  let withheld=false;const references:PaintRefV12[]=[];
  for(let i=0;i<6;i++){work();const iid=all[i]!,reason=!current.row.valid?((BigInt(p.fields.sequenceFlags??'0')&2n)!==0n?'incremental-dependency':'invalid-sequence'):null;
   const definition=reason===null?ref(current,tables[i]!,iid):undefined;
   if(!definition)withheld=true;
   references.push({channel:channels[i]!,iid,location:span(source,locations[i]!,at.valueStart),status:definition?'resolved':'withheld',definition:definition??null,reason:definition?null:reason??'missing-definition'});
  }
  const context:PaintContextV12={source,eventLocation:span(source,at),eventBodySHA256:e.bodySHA256,machine:current.row.machine,sequenceId:current.row.sequenceId,sequenceIndex:current.row.sequenceIndex,epoch:current.row.epoch,defaultsVersionIndex:current.row.defaultsVersionIndex,headers:headers(p.fields),clock:select(current,p.fields.timestampClockId,'clock'),track:select(current,e.trackUuid,'track')};
  const opaque=e.skippedOpaqueLocations[0];
  const shape:PaintRowV12['shape']={variant:e.structuralVariant,frame:e.frame,afterUserInput:e.structuralVariant==='frame-uint'?e.annotations[1]!.uintValue!:null,legacy:{phase:82,location:span(source,e.legacy,at.valueStart),phaseLocation:span(source,e.legacy.phaseOccurrence,at.valueStart,'legacy_event')},opaque:opaque?{location:span(source,opaque,at.valueStart),bytes:opaque.bytes,sha256:opaque.sha256}:null};
  let family:string|null=null;
  if(!withheld){
   const names=references.map(r=>r.definition!.value);work(names.reduce((n,s)=>n+s.length,0));
   if(names.some((s,i)=>s.length<1||s.length>(i===0?128:64)))throw new OwnedPaintFailureV12('paint-inventory-domain');
   const inventory=budget.canonical({eventName:names[0]!,categories:names.slice(1,4),annotationNames:names.slice(4)});
   try{
    if(inventory.text.length>4096)throw new OwnedPaintFailureV12('paint-inventory-domain');
    const release=budget.reserveOperation('comparator',comparatorReservationV12());
    try{const comparison=comparePaintTimingRInventory(p.paint,inventory.text);if(comparison.status==='unavailable')throw new OwnedPaintFailureV12(comparison.code);family=comparison.sourceFamily;}
    finally{release();}
   }finally{inventory.release();}
  }
  if(withheld)paintWithheld=true;
  const row:PaintRowV12={status:withheld?'withheld':'matched',domain:'owned-ordered-paint-r-v12',context,shape,family,references:withheld?references:references.map(r=>({channel:r.channel,iid:r.iid,location:r.location,definition:r.definition})),rule:RULE};
  const m=retain(row,'paint');budget.addRetained('paintUTF8',m.utf8Bytes);paint.push(row);success('paintRows');count(withheld?'paintWithheld':'paintMatched');
  count('paintResolvedReferences',references.filter(r=>r.definition!==null).length);count('paintWithheldReferences',references.filter(r=>r.definition===null).length);note('paint','paint',[source.packetIndex,source.packetSHA256,row.status,family]);
 }
 function ordinaryEvent(p:Extract<OwnedPacketResult,{branch:'old'}>,source:SourceV12,current:Current){
  const event=p.packet.event;if(!event)return;const e=event.fields,at=p.occurrences.find(o=>o.scope==='packet'&&o.fieldNumber===11)!;
  count('ordinaryTrackEvents');count('ordinaryAnnotationEntries',event.annotations.length);if(event.annotations.length)count('ordinaryEventsWithAnnotations');
  const a=event.annotations.length;work(256+32*a);const reserve=budget.reserveTransient({logicalSlots:256+64*a,utf16Units:20*a});
  try{
   const resolved=resolveAnnotations(event.annotations,iid=>{const d=ref(current,'debug_annotation_names',iid,false);return d?{definitionIndex:d.definitionIndex,value:d.value}:undefined;},current.row.valid,{repeatedWork(n:number){success('repeatedWork',n);work(n);},categoryReferences(n:number){success('references',n);work(n);}},source.packetIndex);
   count(resolved.nameInventoryStatus==='resolved'?'ordinaryResolvedRootInventories':'ordinaryWithheldRootInventories');
   if(resolved.markName.status==='withheld')markWithheld=true; // sticky BEFORE selection, including non3/non-blink
   if(e.nameIid==='0'||e.categoryIids?.some(iid=>iid==='0'))throw new OwnedPaintFailureV12('invalid-event-iid');
   let outcome='resolved';const flags=BigInt(p.fields.sequenceFlags??'0');
   if(!current.row.valid&&(flags&2n)!==0n)outcome='withheld_dependency';
   else if(!current.row.valid&&(e.nameIid!==undefined||(e.categoryIids?.length??0)>0))outcome='withheld_intern_invalid';
   const nameDefinition=e.nameIid===undefined||!current.row.valid?undefined:ref(current,'event_names',e.nameIid);
   const categoryDefinitions=(e.categoryIids??[]).map(iid=>current.row.valid?ref(current,'event_categories',iid):undefined);
   if(outcome==='resolved'&&(e.nameIid!==undefined&&!nameDefinition||categoryDefinitions.some(d=>d===undefined)))outcome='withheld_missing_intern_definition';
   const name=e.nameIid===undefined?e.name:nameDefinition?.value;
   if('legacy'in event){
    const categories=categoryDefinitions.map(d=>d?.value),ann=resolved.annotations[0]?.name as {kind:string;definitionIndex?:number}|undefined;
    const key=ann?.kind==='intern'&&ann.definitionIndex!==undefined?definitions[ann.definitionIndex]?.value:undefined;
    if(!current.row.valid||outcome!=='resolved'||name!=='FramePresented'||categories.length!==2||!categories.includes('cc')||!categories.includes('benchmark')||resolved.nameInventoryStatus!=='resolved'||resolved.annotations.length!==1||key!=='environment'||event.annotations[0]?.stringValue!=='browser'||e.trackUuid!=='0')throw new OwnedPaintFailureV12('unsupported-legacy-event');
    count('supportedLegacyFramePresented');
   }
   // Selected userTimingMark policy copied from frozen ordered-state.ts:698–717.
   // Category loops are charged here; paint never calls this policy.
   let kind:'absent'|'withheld'|'literal_string'='absent',reason:string|null=null,value:string|null=null,annotationIndex:number|null=null,representation:CandidateV12['representation']='withheld';
   const refuse=(why:string)=>{kind='withheld';reason=why;};
   if(e.type===undefined||e.type==='3'){
    work((e.categories?.length??0)+(e.categoryIids?.length??0));let countCategories=e.categories?.length??0,blink=(e.categories??[]).some(s=>s.length===17&&s==='blink.user_timing');
    if((e.categoryIids?.length??0)>0&&!current.row.valid)refuse('category-resolution-withheld');
    else{
     for(const d of categoryDefinitions){countCategories++;if(!d){refuse('category-resolution-withheld');break;}if(d.value.length===17&&d.value==='blink.user_timing')blink=true;}
     if(reason===null){
      if(countCategories===0)refuse('missing-mark-category');
      else if(blink){
       if(countCategories!==1)refuse('ambiguous-mark-category');else if(e.type===undefined)refuse('missing-mark-type');
       else if(resolved.markName.status==='withheld')refuse(resolved.markName.reason);
       else if(outcome!=='resolved')refuse('event-resolution-withheld');else if(name===undefined||name.length===0)refuse('missing-mark-event-name');
       else if(name==='performance.mark'){
        if(resolved.markName.status==='literal_string'){kind='literal_string';representation='annotation';value=resolved.markName.value;annotationIndex=resolved.markName.annotationIndex;}else refuse('missing-mark-name');
       }else if(resolved.markName.status!=='absent')refuse('ambiguous-mark-representation');
       else{kind='literal_string';representation='event_name';value=name;}
      }
     }
    }
   }
   if(kind==='absent'){count('markAbsent');return;}
   const selectedKind=kind as 'withheld'|'literal_string';if(selectedKind==='withheld'){markWithheld=true;count('markWithheld');}else count('markLiteral');
   const annotationName=representation==='annotation'&&annotationIndex!==null?resolved.annotations[annotationIndex]?.name as {kind:string;definitionIndex?:number}:undefined;
   const selectedDefinition=representation==='annotation'?annotationName?.definitionIndex:nameDefinition?.definitionIndex;
   ensureSuccess('candidateRows');const row:CandidateV12={source,eventLocation:span(source,at),machine:current.row.machine,sequenceId:current.row.sequenceId,sequenceIndex:current.row.sequenceIndex,epoch:current.row.epoch,defaultsVersionIndex:current.row.defaultsVersionIndex,kind:selectedKind,representation,value,reason,annotationIndex,nameSource:selectedKind==='withheld'?'unresolved':selectedDefinition!==undefined?'intern':'literal',definitionIndex:selectedKind==='withheld'?null:selectedDefinition??null,clock:select(current,p.fields.timestampClockId,'clock'),track:select(current,e.trackUuid,'track'),rawTimestamp:p.fields.timestamp??null,timestampStatus:p.fields.timestamp===undefined?'absent':'raw-unqualified'};
   const m=retain(row,'candidate');budget.addRetained('candidateUTF8',m.utf8Bytes);candidates.push(row);success('candidateRows');
  }finally{reserve();}
 }
 return {
  counters,sequenceStart,
  process(original:Uint8Array,frame:RootFrame){
   count('decodedPackets');const v=packetAdapterReservation(original.length);if('status'in v)throw new OwnedPaintFailureV12(v.code);
   budget.ensureSemanticRoom(v.fieldChargeWork,v.memberChargeWork);
   const vector:OperationTotalsV12={...emptyOperationV12(),calls:1,...v,reservedByteBufferOccupancy:v.byteBufferOccupancy,reservedUTF16Occupancy:v.utf16Occupancy,resultRecords:v.packetResultRecords};
   vector.totalLogicalWork=v.wireByteReads+v.fieldChargeWork+v.memberChargeWork+v.callbackLocalWork+v.loopRecordWork+v.copyBytes+v.hashBytes+v.utf8DecodeBytes+v.terminalChecks+v.diagnosticRecords+v.packetResultRecords;
   const release=budget.reserveOperation('packet',vector);
   try{
    const p=adapter.decode(original);if(p.status==='unavailable')throw new OwnedPaintFailureV12(p.code,p.stage);
    budget.commitSemantic(p.usage.fields+p.usage.routeFields,p.usage.members);success('routeFields',p.usage.routeFields);success('oldCallbackWork',p.usage.oldCallbackWork);
    // Fixed wrapper envelope covers small source-owned record construction,
    // raw-window selection and packet occurrence searches before those visits.
    work(1024+64*(p.occurrences.length+p.rawWindows.length));
    count(p.branch==='paint'?'paintPackets':'oldPackets');const source:SourceV12={packetIndex:frame.frameIndex,rootBodyStart:frame.bodyStart,packetBytes:original.length,packetSHA256:p.packetSHA256};
    const f=p.fields,hasEvent=p.branch==='paint'||p.packet.event!==undefined;
    note('packet','packet',[source.packetIndex,p.packetSHA256,f.machineId??null,f.sequenceId??null,f.timestamp??null,f.timestampClockId??null,f.sequenceFlags??null,f.incrementalStateCleared??null,f.previousPacketDropped??null,f.firstPacketOnSequence??null]);
    if(f.sequenceId===undefined){
     if(hasEvent||p.rawWindows.some(w=>w.fieldNumber===12||w.fieldNumber===59)||f.sequenceFlags!==undefined||f.incrementalStateCleared!==undefined||f.previousPacketDropped!==undefined||f.firstPacketOnSequence!==undefined)throw new OwnedPaintFailureV12('missing-sequence-id');
     if(p.rawWindows.some(w=>w.fieldNumber===6||w.fieldNumber===60)){metadata(p,source,undefined);count('metadataPackets');}else count('opaqueNoStatePackets');count('processedPackets');return;
    }
    if(f.sequenceId==='0')throw new OwnedPaintFailureV12('zero-sequence-id');
    const m=machine(f),keyJSON=budget.canonical([m.status,m.id,f.sequenceId]),key=keyJSON.text,keyRelease=helperLease(keyJSON.release);work(key.length);let current=keys.get(key);const priorSeen=current!==undefined;
    if(f.previousPacketDropped!==undefined&&f.previousPacketDropped!=='0'){
     ensureSuccess('rawDropRows');const classification=f.previousPacketDropped==='1'&&f.firstPacketOnSequence===true&&!priorSeen?'explained':'unexplained';
     const row:RawDropV12={source,machine:m,sequenceId:f.sequenceId,priorSeen,headers:headers(f),classification};retain(row,'rawDrop');rawDrops.push(row);success('rawDropRows');count('rawDropDeclarations');count(classification==='explained'?'explainedRawDropDeclarations':'unexplainedRawDropDeclarations');
    }
    if(!current){
     ensureSuccess('sequenceKeys');budget.addRetained('indexKeyUTF8',width(key));const row:SequenceV12={sequenceIndex:sequences.length,machine:m,sequenceId:f.sequenceId,valid:false,epoch:0,defaultsVersionIndex:null};retain(row,'sequence');retain({key},'sequenceKey');current={row,tables:{event_names:new Map(),event_categories:new Map(),debug_annotation_names:new Map()},liveLeases:new Map()};keys.set(key,current);sequences.push(row);success('sequenceKeys');count('sequenceKeys');
    }
    keyRelease();
    const s=current.row,flags=BigInt(f.sequenceFlags??'0');if(flags>3n)throw new OwnedPaintFailureV12('unsupported-sequence-flags');
    if(f.incrementalStateCleared===true||(flags&1n)!==0n){
     const visits=current.tables.event_names.size+current.tables.event_categories.size+current.tables.debug_annotation_names.size;ensureSuccess('resetReleaseVisits',visits);work(8*visits);
     s.epoch++;s.valid=true;s.defaultsVersionIndex=null;
     for(const table of Object.values(current.tables)){for(const index of table.values()){const live=current.liveLeases.get(index)!;budget.subtractRetained('liveInternEntries',1);budget.subtractRetained('liveInternUTF8',live.utf8);budget.subtractRetained('liveInternUTF16',live.utf16);live.release();current.liveLeases.delete(index);}table.clear();}success('resetReleaseVisits',visits);count('resets');
    }else if(f.previousPacketDropped!==undefined&&f.previousPacketDropped!=='0'){s.epoch++;s.valid=false;count('losses');}
    if(priorSeen&&f.firstPacketOnSequence===true){sequenceStart.contradictions++;count('firstContradictions');throw new OwnedPaintFailureV12('invalid-whole-annotation-input');}
    if(f.incrementalStateCleared!==true&&(flags&1n)===0n&&f.previousPacketDropped!==undefined&&f.previousPacketDropped!=='0'){sequenceStart.raw++;if(f.firstPacketOnSequence===true&&f.previousPacketDropped==='1')sequenceStart.explained++;else sequenceStart.unexplained++;}
    note('transition','sequence',[s.sequenceIndex,s.epoch,s.valid,s.defaultsVersionIndex]);
    if(p.rawWindows.some(w=>w.fieldNumber===6||w.fieldNumber===60)){metadata(p,source,current);count('metadataPackets');}
    applyDefaults(p,source,current);applyIntern(p,source,current);
    if(hasEvent){count('trackEvents');if(p.branch==='paint')paintEvent(p,source,current);else ordinaryEvent(p,source,current);}
    count('processedPackets');
   }finally{release();}
  },
  withdraw(){budget.usage.coverage='partial';budget.chargeClosure('wrapperWork',64+8*(retained.length+pendingHelpers.size+budget.usage.retained.liveInternEntries!));for(const release of pendingHelpers)release();for(const current of keys.values())for(const live of current.liveLeases.values())live.release();candidates.length=0;paint.length=0;rawDrops.length=0;facts.length=0;occurrences.length=0;definitions.length=0;defaults.length=0;sequences.length=0;keys.clear();factKeys.clear();disclosures.clear();for(const release of retained)release();retained.length=0;for(const key of Object.keys(budget.usage.retained))budget.usage.retained[key]=0;},
  snapshot(good:boolean){return {state:{sequences:good?sequences:[],definitions:good?definitions:[],defaults:good?defaults:[]},evidence:{status:good?'complete-supported-compact-observations' as const:'unavailable' as const,codec:2 as const,domain:'owned-paint-clock-layout-v12' as const,facts:good?facts:[],occurrences:good?occurrences:[]},rawDrop:{status:good?'complete-supported-header-declarations' as const:'unavailable' as const,facts:good?rawDrops:[]},candidates:good?candidates:[],paint:good?paint:[],markInventoryAdmission:!good?'not_evaluated' as const:markWithheld?'withheld' as const:counters.ordinaryTrackEvents===0?'absent' as const:'resolved-supported-source-roots' as const,paintInventoryAdmission:!good?'not_evaluated' as const:paintWithheld?'withheld' as const:counters.paintPackets===0?'absent' as const:'resolved-supported-source-roots' as const};},
  manifests(){for(const [key,group] of disclosures){note('metadata','final-disclosure',[key,group.conflict,group.processSeen,group.threadSeen]);}return {packetSHA256:hashes.packet.digest('hex'),transitionSHA256:hashes.transition.digest('hex'),definitionSHA256:hashes.definition.digest('hex'),metadataSHA256:hashes.metadata.digest('hex'),paintSHA256:hashes.paint.digest('hex')};}
 };
}
