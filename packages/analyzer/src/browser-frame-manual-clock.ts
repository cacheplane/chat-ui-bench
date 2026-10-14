import {createHash} from 'node:crypto';
import {copyBody,WireError} from './browser-frame-protobuf-wire.js';
import {decodeBrowserFramePacket,PACKET_POLICY,PACKET_SOURCE,type PacketFields} from './browser-frame-packet-fragments.js';
import {decodeBrowserFrameStateBody,STATE_BODY_POLICY,type ClockFields} from './browser-frame-state-fragments.js';
export const MANUAL_CLOCK_POLICY='manual-single-domain-frame-clock-v1';
const LABELS=Object.freeze({normalizationCapability:'manual-single-domain-scalar-contract-only',units:'caller_declared',callerDomain:'caller_declared',captureOrder:'caller_declared',scalarChecksOnly:true,sourceClockProof:'unestablished',runtimeQualification:'unestablished',sourceCoverage:'unestablished',captureCompleteness:'unestablished',physicalCalibration:'unestablished',targetLifetime:'unestablished',phaseAlignment:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false} as const);
type Phase='preflight'|'declarations'|'events'|'pairs'|'output';
class Denial extends Error{constructor(readonly code:string,readonly phase:Phase,readonly packetIndex?:number,readonly component?:string,readonly cause?:string){super(code);}}
interface Machine{presence:'absent'|'present';value?:string}
interface Lane{sequenceId:string;machine:Machine}
interface Clock{clockId:string;scope:'sequence_local'|'raw_nonlocal'}
interface Body{packetIndex:number;bytes:number;sha256:string}
interface Location{packetIndex:number;scope:string;fieldNumber:number;wireType:number;start:number;valueStart:number;end:number}
type RawTiming=Pick<PacketFields,'timestamp'|'timestampClockId'|'sequenceFlags'|'incrementalStateCleared'|'previousPacketDropped'|'firstPacketOnSequence'>;
type BarrierReason='observed_reset'|'observed_loss'|'unusable_target_snapshot';
interface Barrier{barrierIndex:number;packetIndex:number;segmentIndex:number;reasons:BarrierReason[];rawSequenceFlags?:string;rawIncrementalStateCleared?:boolean;rawPreviousPacketDropped?:string;declarationIndex?:number}
type DeclarationReason='missing_target_clock'|'missing_timestamp'|'missing_unit'|'zero_unit'|'missing_incremental_flag';
interface Declaration{declarationIndex:number;packetIndex:number;segmentIndex:number;location:Location;clockLocation?:Location;rawPacketTiming:RawTiming;rawPrimaryTraceClock?:string;rawTarget?:ClockFields;outcome:{status:'usable';manualNs:string;unitMultiplierNs:string}|{status:'withheld';reason:DeclarationReason}}
interface Interval{intervalIndex:number;segmentIndex:number;leftDeclarationIndex:number;rightDeclarationIndex:number;leftNs:string;rightNs:string;unitMultiplierNs:string;leftPacketIndex:number;rightPacketIndex:number;empty:boolean}
type EventReason='missing_explicit_packet_clock'|'zero_explicit_packet_clock'|'different_explicit_packet_clock'|'missing_explicit_timestamp'|'no_left_declaration'|'no_right_declaration'|'empty_interval'|'timestamp_interval_mismatch';
type EventOutcome={status:'eligible_manual_scalar';intervalIndex:number;manualNs:string}|{status:'withheld';reason:EventReason;intervalIndex?:number};
interface Candidate{eventIndex:number;packetIndex:number;segmentIndex:number;location:Location;raw:RawTiming}
interface Event extends Candidate{outcome:EventOutcome}
interface Pair{pairIndex:number;fromEventIndex:number;toEventIndex:number;outcome:{status:'difference';intervalIndex:number;differenceNs:string}|{status:'withheld';reason:'withheld_endpoint'|'different_segment'|'different_interval'|'backward_scalar_reading';observedDifferenceNs?:string}}
export interface ManualClockUnavailable{status:'unavailable';diagnostics:readonly {code:string;phase:Phase;packetIndex?:number;component?:string;cause?:string}[]}
export interface ManualClockAssessment extends Readonly<typeof LABELS>{status:'assessed_manual_clock_contract';domain:string;lane:Lane;clock:Clock;source:typeof PACKET_SOURCE;bodies:Body[];barriers:Barrier[];declarations:Declaration[];intervals:Interval[];events:Event[];pairs:Pair[];opaqueLocations:Location[]}
function ownData(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(value===null||typeof value!=='object'||![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw new Denial('invalid-envelope','preflight');
 const descriptors=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(descriptors).length!==keys.length)throw new Denial('invalid-envelope','preflight');
 const result:Record<string,unknown>={};for(const key of keys){const d=descriptors[key];if(!d||!Object.hasOwn(d,'value'))throw new Denial('invalid-envelope','preflight');result[key]=d.value;}return result;
}
function u32(value:unknown,nonzero=false):string{if(typeof value!=='string'||value.length>10||!(/^(0|[1-9][0-9]*)$/.test(value))||BigInt(value)>4294967295n||nonzero&&value==='0')throw new Denial('invalid-envelope','preflight');return value;}
function preflight(input:unknown):{domain:string;lane:Lane;clock:Clock;packets:Uint8Array[]}{
 const v=ownData(input,['domain','lane','clock','packets']);if(typeof v.domain!=='string'||!(/^[\x20-\x7e]{1,128}$/.test(v.domain)))throw new Denial('invalid-envelope','preflight');
 const l=ownData(v.lane,['sequenceId','machine']);
 const presence=typeof l.machine==='object'&&l.machine!==null?Object.getOwnPropertyDescriptor(l.machine,'presence')?.value:undefined;
 const m=ownData(l.machine,presence==='present'?['presence','value']:['presence']);let machine:Machine;
 if(m.presence==='absent')machine={presence:'absent'};else if(m.presence==='present')machine={presence:'present',value:u32(m.value)};else throw new Denial('invalid-envelope','preflight');
 const lane={sequenceId:u32(l.sequenceId,true),machine};const c=ownData(v.clock,['clockId','scope']);const clockId=u32(c.clockId,true);const scope=BigInt(clockId)>=64n&&BigInt(clockId)<128n?'sequence_local':'raw_nonlocal';if(c.scope!==scope)throw new Denial('invalid-envelope','preflight');
 const source=v.packets;if(!Array.isArray(source)||Object.getPrototypeOf(source)!==Array.prototype)throw new Denial('invalid-envelope','preflight');const length:unknown=Object.getOwnPropertyDescriptor(source,'length')?.value;
 if(typeof length!=='number'||!Number.isInteger(length)||length<0)throw new Denial('invalid-envelope','preflight');if(length>1024)throw new Denial('packet-capacity','preflight');
 const entries=Object.getOwnPropertyDescriptors(source);if(Reflect.ownKeys(entries).length!==length+1)throw new Denial('invalid-envelope','preflight');const packets:Uint8Array[]=[];let bytes=0;
 for(let i=0;i<length;i++){const d=entries[String(i)];if(!d||!Object.hasOwn(d,'value'))throw new Denial('invalid-envelope','preflight');let owned:Uint8Array;
  try{owned=copyBody(d.value);}catch(error){throw new Denial('fragment-unavailable','preflight',i,'copy',error instanceof WireError?error.code:'invalid-byte-input');}
  if((bytes+=owned.byteLength)>4194304)throw new Denial('input-byte-capacity','preflight',i);packets.push(owned);
 }return {domain:v.domain,lane,clock:{clockId,scope},packets};
}
function freeze<T>(value:T):T{if(value!==null&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
function rawTiming(fields:PacketFields):RawTiming{
 return {...(fields.timestamp===undefined?{}:{timestamp:fields.timestamp}),...(fields.timestampClockId===undefined?{}:{timestampClockId:fields.timestampClockId}),...(fields.sequenceFlags===undefined?{}:{sequenceFlags:fields.sequenceFlags}),...(fields.incrementalStateCleared===undefined?{}:{incrementalStateCleared:fields.incrementalStateCleared}),...(fields.previousPacketDropped===undefined?{}:{previousPacketDropped:fields.previousPacketDropped}),...(fields.firstPacketOnSequence===undefined?{}:{firstPacketOnSequence:fields.firstPacketOnSequence})};
}
const INT64_MAX=9223372036854775807n;
/** Fixed-schema guards, not caller-configurable test caps. Output values are counted once. */
class Budget{
 private fields=0;private repeated=0;
 visits(count:number,index:number):void{if((this.fields+=count)>131072)throw new Denial('field-capacity','declarations',index);}
 members(count:number,index:number):void{if((this.repeated+=count)>65536)throw new Denial('repeated-work-capacity','declarations',index);}
 final(value:unknown):void{
  let nodes=0,strings=0;
  function walk(v:unknown):void{if(++nodes>262144)throw new Denial('output-node-capacity','output');if(typeof v==='string'){if((strings+=Buffer.byteLength(v,'utf8'))>524288)throw new Denial('output-string-capacity','output');}else if(v!==null&&typeof v==='object')for(const child of Object.values(v))walk(child);}
  // Rows have already been reserved and are bounded by the reviewed coupled schema.
  // This final admission traversal counts root/containers and each emitted value exactly once.
  walk(value);if(Buffer.byteLength(JSON.stringify(value),'utf8')>4194304)throw new Denial('output-byte-capacity','output');
 }
}
function reserve(rows:readonly unknown[],maximum:number,index:number,phase:Phase):void{if(rows.length>=maximum)throw new Denial('output-row-capacity',phase,index);}
export function assessManualFrameClock(input:unknown,policy:unknown):ManualClockAssessment|ManualClockUnavailable{
 let phase:Phase='preflight';
 try{if(policy!==MANUAL_CLOCK_POLICY)throw new Denial('unsupported-policy','preflight');const own=preflight(input);
  const bodies=own.packets.map((bytes,packetIndex)=>({packetIndex,bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')}));
  const barriers:Barrier[]=[];const declarations:Declaration[]=[];const intervals:Interval[]=[];const candidates:Candidate[]=[];const budget=new Budget();const opaqueLocations:Location[]=[];const opaqueKeys=new Set<string>();
  function opaque(row:Location):void{const key=JSON.stringify([row.packetIndex,row.scope,row.fieldNumber,row.wireType,row.start,row.valueStart,row.end]);if(opaqueKeys.has(key))return;if(opaqueLocations.length>=8192)throw new Denial('opaque-location-capacity','declarations',row.packetIndex);opaqueKeys.add(key);opaqueLocations.push(row);}
  let segment=0,unitRegister:bigint|undefined,lastChecked:bigint|undefined,left:{row:Declaration;ns:bigint;unit:string}|undefined;
  phase='declarations';
  for(let packetIndex=0;packetIndex<own.packets.length;packetIndex++){
   const fragment=decodeBrowserFramePacket(own.packets[packetIndex],PACKET_POLICY);
   if(fragment.status==='unavailable')throw new Denial('fragment-unavailable',phase,packetIndex,'packet',fragment.diagnostics[0]?.code);
   budget.visits(fragment.occurrences.length,packetIndex);budget.members((fragment.event?.fields.categoryIids?.length??0)+(fragment.event?.fields.categories?.length??0)+(fragment.event?.graphics?.fields.surfaceTraceIds?.length??0),packetIndex);
   const f=fragment.fields;if(f.sequenceId===undefined)throw new Denial('missing-sequence-id',phase,packetIndex);if(f.sequenceId==='0')throw new Denial('zero-sequence-id',phase,packetIndex);
   if(f.sequenceId!==own.lane.sequenceId||(own.lane.machine.presence==='absent'?f.machineId!==undefined:f.machineId!==own.lane.machine.value))throw new Denial('source-lane-mismatch',phase,packetIndex);
   const flags=BigInt(f.sequenceFlags??'0');if(flags>3n)throw new Denial('unsupported-sequence-flags',phase,packetIndex);
   let barrier:Barrier|undefined;
   function addBarrier(reason:BarrierReason):void{
    if(!barrier){reserve(barriers,1024,packetIndex,phase);segment++;left=undefined;barrier={barrierIndex:barriers.length,packetIndex,segmentIndex:segment,reasons:[],...(f.sequenceFlags===undefined?{}:{rawSequenceFlags:f.sequenceFlags}),...(f.incrementalStateCleared===undefined?{}:{rawIncrementalStateCleared:f.incrementalStateCleared}),...(f.previousPacketDropped===undefined?{}:{rawPreviousPacketDropped:f.previousPacketDropped})};barriers.push(barrier);}
    barrier.reasons.push(reason);
   }
   if(f.incrementalStateCleared===true||(flags&1n)!==0n)addBarrier('observed_reset');if(f.previousPacketDropped!==undefined&&f.previousPacketDropped!=='0')addBarrier('observed_loss');
   for(const o of fragment.skippedFields)opaque({packetIndex,...o});for(const o of fragment.opaquePayloads)if(o.fieldNumber!==6)opaque({packetIndex,...o});
   const at=fragment.opaquePayloads.find(o=>o.fieldNumber===6);
   if(at){
    const decoded=decodeBrowserFrameStateBody(fragment.bodyBytes.slice(at.valueStart,at.end),'clock_snapshot',STATE_BODY_POLICY);
    if(decoded.status==='unavailable')throw new Denial('fragment-unavailable',phase,packetIndex,'clock_snapshot',decoded.diagnostics[0]?.code);
    budget.visits(decoded.occurrences.length,packetIndex);budget.members(decoded.fields.clocks?.length??0,packetIndex);
    const clocks=decoded.fields.clocks??[],targetIndex=clocks.findIndex(c=>c.clockId===own.clock.clockId),target=clocks[targetIndex];
    const entries=decoded.occurrences.filter(o=>o.scope==='clock_snapshot'&&o.fieldNumber===1);const entry=entries[targetIndex];
    for(const [index,o] of entries.entries())if(index!==targetIndex)opaque({packetIndex,...o,start:o.start+at.valueStart,valueStart:o.valueStart+at.valueStart,end:o.end+at.valueStart});
    for(const o of decoded.skippedFields)opaque({packetIndex,...o,start:o.start+at.valueStart,valueStart:o.valueStart+at.valueStart,end:o.end+at.valueStart});
    let ns:bigint|undefined,unit:bigint|undefined,reason:DeclarationReason|undefined;
    if(target){
     if(target.isIncremental===true)throw new Denial('unsupported-incremental-clock',phase,packetIndex);
     unit=target.unitMultiplierNs===undefined?undefined:BigInt(target.unitMultiplierNs);
     if(unit!==undefined&&unit>0n){
      if(unitRegister!==undefined&&unit!==unitRegister)throw new Denial('changed-unit',phase,packetIndex);unitRegister=unit;
      if(decoded.fields.primaryTraceClock===own.clock.clockId&&unit!==1n)throw new Denial('primary-clock-non-ns-unit',phase,packetIndex);
      if(target.timestamp!==undefined){ns=BigInt(target.timestamp)*unit;if(ns>INT64_MAX)throw new Denial('snapshot-overflow',phase,packetIndex);if(lastChecked!==undefined&&ns<lastChecked)throw new Denial('backward-snapshot',phase,packetIndex);lastChecked=ns;}
     }
     reason=target.timestamp===undefined?'missing_timestamp':unit===undefined?'missing_unit':unit===0n?'zero_unit':target.isIncremental===undefined?'missing_incremental_flag':undefined;
    }else reason='missing_target_clock';
    if(reason!==undefined)addBarrier('unusable_target_snapshot');
    const outcome:Declaration['outcome']=reason!==undefined?{status:'withheld',reason}:{status:'usable',manualNs:ns!.toString(),unitMultiplierNs:unit!.toString()};
    reserve(declarations,1024,packetIndex,phase);const row:Declaration={declarationIndex:declarations.length,packetIndex,segmentIndex:segment,location:{packetIndex,...at},rawPacketTiming:rawTiming(f),...(entry===undefined?{}:{clockLocation:{packetIndex,...entry,start:entry.start+at.valueStart,valueStart:entry.valueStart+at.valueStart,end:entry.end+at.valueStart}}),...(decoded.fields.primaryTraceClock===undefined?{}:{rawPrimaryTraceClock:decoded.fields.primaryTraceClock}),...(target===undefined?{}:{rawTarget:{...target}}),outcome};
    if(barrier)barrier.declarationIndex=row.declarationIndex;
    if(outcome.status==='usable'){
     if(left){reserve(intervals,1024,packetIndex,phase);intervals.push({intervalIndex:intervals.length,segmentIndex:segment,leftDeclarationIndex:left.row.declarationIndex,rightDeclarationIndex:row.declarationIndex,leftNs:left.ns.toString(),rightNs:outcome.manualNs,unitMultiplierNs:outcome.unitMultiplierNs,leftPacketIndex:left.row.packetIndex,rightPacketIndex:packetIndex,empty:left.ns===ns});}
     left={row,ns:ns!,unit:outcome.unitMultiplierNs};
    }
    declarations.push(row);
   }
   const eventAt=fragment.occurrences.find(o=>o.scope==='packet'&&o.fieldNumber===11);
   if(fragment.event&&eventAt){reserve(candidates,1024,packetIndex,phase);opaque({packetIndex,...eventAt});candidates.push({eventIndex:candidates.length,packetIndex,segmentIndex:segment,location:{packetIndex,...eventAt},raw:rawTiming(f)});}
  }
  phase='events';
  const events:Event[]=candidates.map(candidate=>{
   const raw=candidate.raw;let outcome:EventOutcome;
   if(raw.timestampClockId===undefined)outcome={status:'withheld',reason:'missing_explicit_packet_clock'};
   else if(raw.timestampClockId==='0')outcome={status:'withheld',reason:'zero_explicit_packet_clock'};
   else if(raw.timestampClockId!==own.clock.clockId)outcome={status:'withheld',reason:'different_explicit_packet_clock'};
   else if(raw.timestamp===undefined)outcome={status:'withheld',reason:'missing_explicit_timestamp'};
   else{
    const interval=intervals.find(i=>i.segmentIndex===candidate.segmentIndex&&i.leftPacketIndex<candidate.packetIndex&&candidate.packetIndex<i.rightPacketIndex);
    if(interval===undefined){const hasLeft=declarations.some(d=>d.segmentIndex===candidate.segmentIndex&&d.packetIndex<candidate.packetIndex&&d.outcome.status==='usable');outcome={status:'withheld',reason:hasLeft?'no_right_declaration':'no_left_declaration'};}
    else if(interval.empty)outcome={status:'withheld',reason:'empty_interval',intervalIndex:interval.intervalIndex};
    else{const ns=BigInt(raw.timestamp)*BigInt(interval.unitMultiplierNs);if(ns>INT64_MAX)throw new Denial('event-overflow',phase,candidate.packetIndex);
     outcome=ns<BigInt(interval.leftNs)||ns>=BigInt(interval.rightNs)?{status:'withheld',reason:'timestamp_interval_mismatch',intervalIndex:interval.intervalIndex}:{status:'eligible_manual_scalar',intervalIndex:interval.intervalIndex,manualNs:ns.toString()};
    }
   }
   return {...candidate,outcome};
  });
  phase='pairs';const pairs:Pair[]=[];
  for(let index=1;index<events.length;index++){
   const from=events[index-1]!,to=events[index]!;let outcome:Pair['outcome'];
   if(from.outcome.status!=='eligible_manual_scalar'||to.outcome.status!=='eligible_manual_scalar')outcome={status:'withheld',reason:'withheld_endpoint'};
   else if(from.segmentIndex!==to.segmentIndex)outcome={status:'withheld',reason:'different_segment'};
   else if(from.outcome.intervalIndex!==to.outcome.intervalIndex)outcome={status:'withheld',reason:'different_interval'};
   else{const difference=BigInt(to.outcome.manualNs)-BigInt(from.outcome.manualNs);if(difference < -INT64_MAX ||difference>INT64_MAX)throw new Denial('invalid-manual-clock-input',phase,to.packetIndex);
    outcome=difference<0n?{status:'withheld',reason:'backward_scalar_reading',observedDifferenceNs:difference.toString()}:{status:'difference',intervalIndex:from.outcome.intervalIndex,differenceNs:difference.toString()};
   }
   reserve(pairs,1023,to.packetIndex,phase);pairs.push({pairIndex:pairs.length,fromEventIndex:from.eventIndex,toEventIndex:to.eventIndex,outcome});
  }
  phase='output';const result:ManualClockAssessment={status:'assessed_manual_clock_contract',domain:own.domain,lane:own.lane,clock:own.clock,source:PACKET_SOURCE,bodies,barriers,declarations,intervals,events,pairs,opaqueLocations:opaqueLocations.sort((a,b)=>a.packetIndex-b.packetIndex||a.start-b.start||a.end-b.end),...LABELS};budget.final(result);return freeze(result);
 }catch(error){return freeze({status:'unavailable',diagnostics:[{code:error instanceof Denial?error.code:'invalid-manual-clock-input',phase:error instanceof Denial?error.phase:phase,...(error instanceof Denial&&error.packetIndex!==undefined?{packetIndex:error.packetIndex}:{}),...(error instanceof Denial&&error.component!==undefined?{component:error.component}:{}),...(error instanceof Denial&&error.cause!==undefined?{cause:error.cause}:{})}]});}
}
