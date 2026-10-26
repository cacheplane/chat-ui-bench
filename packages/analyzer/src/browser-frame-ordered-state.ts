const envelopeError='invalid-envelope',policyError='unsupported-policy',capacityError='result-capacity';
import {copyWholeAnnotationChunk} from './browser-frame-whole-trace.js';
import { createHash } from 'node:crypto';
import {types} from 'node:util';
import {TraceRootFramer,type RootFrame,type AnnotationBody} from './browser-frame-trace-framer.js';
import { decodeWholeDescriptor,decodeBrowserFrameTrackDescriptorBody, TRACK_DESCRIPTOR_BODY_POLICY, type TrackDescriptorFields } from './browser-frame-track-descriptor-fragments.js';
import { copyBody, WireError } from './browser-frame-protobuf-wire.js';
import { createWholeFramePresentedPacketDecoder,createWholeProvenancePacketDecoder,decodeWholeUserTimingPacketV3,decodeWholeAnnotationPacket,decodeBrowserFramePacket,decodeBrowserFrameAnnotationPacket, PACKET_POLICY, PACKET_SOURCE, type PacketFields, type PacketFragmentWithMembers } from './browser-frame-packet-fragments.js';
import { decodeWholeStateBody,decodeBrowserFrameStateBody,decodeBrowserFrameAnnotationStateBody, STATE_BODY_POLICY, type ClockFields } from './browser-frame-state-fragments.js';
import type {EventFragmentWithMembers,AnnotationEventFragment,WholeFramePresentedEventFragment} from './browser-frame-track-event-fragments.js';
export const ORDERED_STATE_POLICY = 'ordered-manual-browser-frame-state-v1';
export const ORDERED_STATE_V2_POLICY = 'ordered-manual-browser-frame-evidence-v2';
export const ORDERED_ANNOTATION_POLICY='ordered-manual-browser-frame-annotations-v1';

const LABELS = Object.freeze({ normalizationCapability: 'ordered-manual-name-state-only', clockAdmission: 'not_evaluated', captureOrder: 'caller_declared', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
export class ProfileError extends Error {
  constructor(readonly code: string, readonly packetIndex?: number, readonly component?: string, readonly causeCode?: string) { super(code); }
}
interface Sequence extends SequenceFact { defaultsVersionIndex: number | null; names:Map<string,number>;categories:Map<string,number>;annotationNames?:Map<string,number> }
interface Location { packetIndex: number; scope: string; fieldNumber: number; wireType: number; start: number; valueStart: number; end: number }
interface DefaultFields { timestampClockId?: string; trackEventDefaultsPresent?: true; trackUuid?: string }
interface DefaultVersion { versionIndex: number; sequenceIndex: number; intervalVersion: number; packetIndex: number; location: Location; fields: DefaultFields }
interface InternDefinition { definitionIndex:number;sequenceIndex:number;intervalVersion:number;table:'event_categories'|'event_names';iid:string;value:string;definedAt:Location }
interface AnnotationInternDefinition extends Omit<InternDefinition,'table'>{table:InternDefinition['table']|'debug_annotation_names'}
type Selection = {status:'selected';source:'packet'|'event'|'defaults';clockId?:string;trackUuid?:string;defaultsVersionIndex?:number} | {status:'unavailable';reason:string};
interface EventFact { eventIndex: number; packetIndex: number; sequenceIndex: number; intervalVersion: number; defaultsVersionIndex: number|null; location: Location; name?: {kind:'literal';value:string} | {kind:'intern';definitionIndex:number}; literalCategories?: string[]; internedCategoryDefinitionIndexes?:number[]; type?: string; trackSelection: Selection; typedArgumentKinds:string[] }
interface PacketFact { packetIndex: number; sequenceIndex: number; fields: PacketFields; valid: boolean; intervalVersion: number; stateEffect: 'none' | 'reset' | 'loss'; defaultsVersionIndex: number | null; clockSelection:Selection; eventOutcome:'absent'|'resolved'|'withheld_dependency'|'withheld_intern_invalid';eventIndex?:number;eventLocation?:Location;internLocation?:Location;internUpdateOutcome:'absent'|'applied'|'withheld_invalid';internNewDefinitions:number;internRepeatedDefinitions:number }
export interface RestrictedPacketFact extends Omit<PacketFact,'eventOutcome'> {eventOutcome:PacketFact['eventOutcome']|'withheld_missing_intern_definition'}
interface BodyFact {packetIndex:number;bytes:number;sha256:string}
interface SequenceFact {sequenceIndex:number;sequenceId:string;machineId?:string;valid:boolean;intervalVersion:number}
export interface OrderedStateProjection extends Readonly<typeof LABELS> {
  status:'projected_ordered_manual_state';domain:string;source:typeof PACKET_SOURCE;
  bodies:readonly BodyFact[];sequences:readonly SequenceFact[];defaultsVersions:readonly DefaultVersion[];internDefinitions:readonly InternDefinition[];
  packets:readonly PacketFact[];events:readonly EventFact[];opaqueLocations:readonly Location[];
}
type MachineContext={status:'absent'}|{status:'present';machineId:string};
type SequenceContext={status:'absent'}|{status:'present';sequenceId:string;sequenceIndex:number;intervalVersion:number};
interface EvidenceContext {packetIndex:number;bodySha256:string;machineContext:MachineContext;sequenceContext:SequenceContext}
type AssociationReason='missing_descriptor'|'incomplete_association'|'conflicting_association'|'unresolved_parent'|'missing_sequence_context'|'clock_not_normalized'|'frame_mapping_not_implemented'|'ambiguous_process_and_thread';
interface DescriptorObservation extends EvidenceContext {location:Location;fields:TrackDescriptorFields;occurrences:readonly Location[];associationStatus:'unestablished';reasons:AssociationReason[]}
type ClockScope={kind:'sequence-local';machineContext:MachineContext;sequenceId:string}|{kind:'machine-clock-id';machineContext:MachineContext}|{kind:'unavailable';reason:'missing_sequence_context'|'missing_clock_id'|'unknown_clock_id'|'reserved_clock_id'};
interface ClockObservation extends EvidenceContext {location:Location;primaryTraceClock?:string;clocks:readonly (ClockFields&{scope:ClockScope})[];occurrences:readonly Location[]}
interface LossObservation extends EvidenceContext {resetObserved:boolean;dropObserved:boolean;previousPacketDropped?:string;historyCompleteness:'unestablished'}
interface MetadataPacket extends EvidenceContext {fields:PacketFields}
export interface OrderedEvidenceProjection extends Omit<OrderedStateProjection,'status'|'normalizationCapability'> {
 status:'projected_ordered_manual_evidence';normalizationCapability:'ordered-manual-identity-evidence-only';associationStatus:'unestablished';associationReasons:readonly AssociationReason[];
 metadataPackets:readonly MetadataPacket[];descriptorObservations:readonly DescriptorObservation[];clockSnapshots:readonly ClockObservation[];lossObservations:readonly LossObservation[];
}
export interface OrderedStateUnavailable {status:'unavailable';diagnostics:readonly {code:string;packetIndex?:number;component?:string;cause?:string}[]}
const ANNOTATION_AUTHORITY=Object.freeze({captureOrder:'caller_declared',embeddedOpaqueValidity:'not_evaluated',annotationCompleteness:'unestablished',clock:'not_evaluated',marks:'not_evaluated',target:'not_evaluated',population:'not_evaluated',metric:'not_evaluated',runtimeQualification:'unestablished',nativeGO:false,nativeSupported:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,performance:false,FPS:'unavailable'}as const);
interface AnnotationEvent extends ReturnType<typeof resolveAnnotations>{packetIndex:number;sequenceIndex:number;intervalVersion:number;eventLocation:Location}
export interface OrderedAnnotationEvidence extends Omit<OrderedEvidenceProjection,'internDefinitions'>{internDefinitions:readonly AnnotationInternDefinition[]}
export interface OrderedAnnotationProjection {status:'projected_ordered_manual_annotations';domain:string;source:typeof PACKET_SOURCE;orderedEvidence:OrderedAnnotationEvidence;annotationEvents:readonly AnnotationEvent[];authority:typeof ANNOTATION_AUTHORITY}
export interface OwnedSlicePacket {packet:PacketFragmentWithMembers;bodySha256:string;bodyBytes:number;frameIndex:number}
export interface RestrictedEventInput {rawEventIndex:number;packetIndex:number;sequenceIndex:number;intervalVersion:number;defaultsVersionIndex:number|null;eventLocation:Location;event:EventFragmentWithMembers;trackSelection:Selection;clockSelection:Selection;resolution:Exclude<RestrictedPacketFact['eventOutcome'],'absent'>;orderedEventIndex?:number}
export interface RestrictedOrderedBuild {status:'built_restricted_state';ordered:Omit<OrderedEvidenceProjection,'status'|'packets'>&{status:'projected_restricted_slice_state';packets:readonly RestrictedPacketFact[]};rawEventInputs:RestrictedEventInput[]}
/** Internal: only fragments owned and hash-checked by whole-input composition. */
export function projectOwnedBrowserFrameSliceState(frames:readonly OwnedSlicePacket[],budget:Budget):RestrictedOrderedBuild|OrderedStateUnavailable {
 return project(undefined,ORDERED_STATE_V2_POLICY,true,{frames,budget}) as RestrictedOrderedBuild|OrderedStateUnavailable;
}
function select(sequence:Sequence, versions:DefaultVersion[], explicit:string|undefined, kind:'clock'|'track'):Selection {
  const value = sequence.defaultsVersionIndex === null ? undefined : versions[sequence.defaultsVersionIndex]?.fields;
  if (explicit !== undefined && (kind==='track'||explicit!=='0')) return {status:'selected',source:kind==='clock'?'packet':'event',...(kind==='clock'?{clockId:explicit}:{trackUuid:explicit})};
  const fallback = kind==='clock'?value?.timestampClockId:value?.trackUuid;
  if (sequence.valid && fallback !== undefined && (kind==='track'||fallback!=='0')) return {status:'selected',source:'defaults',...(kind==='clock'?{clockId:fallback}:{trackUuid:fallback}),defaultsVersionIndex:sequence.defaultsVersionIndex!};
  return {status:'unavailable',reason:!sequence.valid && sequence.defaultsVersionIndex!==null?'invalid_sequence_default_state':`no_explicit_or_valid_default_${kind}`};
}
export class Budget {
  constructor(private readonly mode:'eager'|'final-owned'='eager'){}
  private finalized=false;
  /** Internal whole-owned admission only; never traverse caller objects here. */
  finishOwnedOutput(value:unknown):void{
    if(this.mode!=='final-owned')throw new ProfileError('invalid-output-mode');
    if(this.finalized)throw new ProfileError('output-already-finalized');
    this.finalized=true;this.countOutput(value);
  }
  private fields=0;private repeated=0;private updates=0;private references=0;private nodes=0;private strings=0;
  private liveEntries=0;private liveBytes=0;
  fieldsVisited(count:number,index:number):void{if((this.fields+=count)>131072)throw new ProfileError('field-capacity',index);}
  repeatedWork(count:number,index:number):void{if((this.repeated+=count)>65536)throw new ProfileError('repeated-work-capacity',index);}
  internUpdates(count:number,index:number):void{if((this.updates+=count)>16384)throw new ProfileError('intern-update-capacity',index);}
  categoryReferences(count:number,index:number):void{if((this.references+=count)>32768)throw new ProfileError('reference-capacity',index);}
  liveInsert(value:string,index:number):void{
    if(++this.liveEntries>4096)throw new ProfileError('live-intern-entry-capacity',index);
    if((this.liveBytes+=Buffer.byteLength(value,'utf8'))>131072)throw new ProfileError('live-intern-string-capacity',index);
  }
  release(table:Map<string,number>,definitions:InternDefinition[]):void{
    for(const index of table.values()){this.liveEntries--;this.liveBytes-=Buffer.byteLength(definitions[index]!.value,'utf8');}
  }
  output(value:unknown,index?:number):void{
    if(this.mode==='eager')this.countOutput(value,index);
  }
  private countOutput(value:unknown,index?:number):void{
    if(++this.nodes>262144)throw new ProfileError('output-node-capacity',index);
    if(typeof value==='string'){
      if((this.strings+=Buffer.byteLength(value,'utf8'))>524288)throw new ProfileError('output-string-capacity',index);
    }else if(value!==null&&typeof value==='object'){
      // Owned JSON-safe rows only. This is not a traversal of arbitrary caller objects.
      for(const item of Object.values(value))this.countOutput(item,index);
    }
  }
}
function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freezeOwned(item);
    Object.freeze(value);
  }
  return value;
}
function preflight(input: unknown): { domain: string; packets: Uint8Array[] } {
  if (input === null || typeof input !== 'object' || ![null,Object.prototype].includes(Object.getPrototypeOf(input))) throw new ProfileError(envelopeError);
  const fields = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(fields).length !== 2 || !fields.domain || !fields.packets || !Object.hasOwn(fields.domain,'value') || !Object.hasOwn(fields.packets,'value')) throw new ProfileError(envelopeError);
  const domain: unknown = fields.domain.value; const source: unknown = fields.packets.value;
  if (typeof domain !== 'string' || !/^[\x20-\x7e]{1,128}$/.test(domain) || !Array.isArray(source) || Object.getPrototypeOf(source) !== Array.prototype) throw new ProfileError(envelopeError);
  const length: unknown = Object.getOwnPropertyDescriptor(source,'length')?.value;
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) throw new ProfileError(envelopeError);
  if (length > 1024) throw new ProfileError('packet-capacity');
  const entries = Object.getOwnPropertyDescriptors(source);
  if (Reflect.ownKeys(entries).length !== length + 1) throw new ProfileError(envelopeError);
  const packets: Uint8Array[] = []; let bytes = 0;
  for (let index=0;index<length;index++) {
    const entry = entries[String(index)];
    if (!entry || !Object.hasOwn(entry,'value')) throw new ProfileError(envelopeError);
    let owned: Uint8Array;
    try { owned = copyBody(entry.value); }
    catch (error) { throw new ProfileError(error instanceof WireError && ['unsupported-byte-view','unavailable-byte-storage','byte-capacity'].includes(error.code) ? error.code : 'invalid-ordered-state-input',index); }
    if ((bytes += owned.byteLength) > 4194304) throw new ProfileError('input-byte-capacity',index);
    packets.push(owned);
  }
  return { domain,packets };
}
/** New API only: reject every Proxy layer before reflecting or copying it. */
function annotationPreflight(input:unknown):{domain:string;packets:Uint8Array[]}{
 if(input===null||typeof input!=='object'||types.isProxy(input))throw new ProfileError(envelopeError);
 if(![null,Object.prototype].includes(Object.getPrototypeOf(input)))throw new ProfileError(envelopeError);
 const fields=Object.getOwnPropertyDescriptors(input),field=fields.packets;
 if(!field||!Object.hasOwn(field,'value'))throw new ProfileError(envelopeError);
 const array:unknown=field.value;
 if(array===null||typeof array!=='object'||types.isProxy(array)||!Array.isArray(array)||Object.getPrototypeOf(array)!==Array.prototype)throw new ProfileError(envelopeError);
 const length=Object.getOwnPropertyDescriptor(array,'length')?.value;
 if(typeof length!=='number'||!Number.isInteger(length)||length<0)throw new ProfileError(envelopeError);
 if(length>1024)throw new ProfileError('packet-capacity');
 const entries=Object.getOwnPropertyDescriptors(array);
 for(let i=0;i<length;i++){
  const entry=entries[String(i)];if(!entry||!Object.hasOwn(entry,'value'))throw new ProfileError(envelopeError);
  if(types.isProxy(entry.value))throw new ProfileError('unsupported-byte-view',i);
 }
 return preflight(input);
}
/** Manual supplied packet order only; never a native boundary authority. */
export function projectOrderedBrowserFrameAnnotations(input:unknown,policy:unknown):OrderedAnnotationProjection|OrderedStateUnavailable{
 return project(input,policy,true,undefined,true)as OrderedAnnotationProjection|OrderedStateUnavailable;
}
/** Caller-declared standalone bodies; no capture ordering, EOF or clock authority. */
export function projectOrderedBrowserFrameState(input:unknown,policy:unknown):OrderedStateProjection|OrderedStateUnavailable {
 return project(input,policy,false) as OrderedStateProjection|OrderedStateUnavailable;
}
/** Opt-in evidence only: standalone caller order is not capture/clock/owner authority. */
export function projectOrderedBrowserFrameEvidence(input:unknown,policy:unknown):OrderedEvidenceProjection|OrderedStateUnavailable {
 return project(input,policy,true) as OrderedEvidenceProjection|OrderedStateUnavailable;
}
function createOrderedReducer(domain:string,bodies:BodyFact[],budget:Budget,v2:boolean,slice:{frames:readonly OwnedSlicePacket[];budget:Budget}|undefined,annotations:boolean,whole?:WholeMode){
    const annotationEvents:AnnotationEvent[]=[];
    const sequences: Sequence[] = []; const byKey = new Map<string,Sequence>(); const packets: RestrictedPacketFact[] = [];
    const defaultsVersions:DefaultVersion[]=[];const events:EventFact[]=[];const opaqueLocations:Location[]=[];const internDefinitions:AnnotationInternDefinition[]=[];
    // Legacy Budget.release reads only .value. Preserve its declaration and pass
    // this owned shared definition store through that value-only operation.
    const releaseInterns=(table:Map<string,number>)=>budget.release(table,internDefinitions as InternDefinition[]);
    const rawEventInputs:RestrictedEventInput[]=[];
    const descriptorObservations:DescriptorObservation[]=[],clockSnapshots:ClockObservation[]=[],lossObservations:LossObservation[]=[],metadataPackets:MetadataPacket[]=[];
    const disclosures=new Map<string,{values:Map<string,string>;conflict:boolean;processSeen:boolean;threadSeen:boolean}>();
    const machine=(fields:PacketFields):MachineContext=>fields.machineId===undefined?{status:'absent'}:{status:'present',machineId:fields.machineId};
    const trackKey=(m:MachineContext,uuid:string)=>JSON.stringify([m.status,m.status==='present'?m.machineId:null,uuid]);
    const context=(packetIndex:number,fields:PacketFields,sequence?:Sequence):EvidenceContext=>({packetIndex,bodySha256:whole?.bodySHA256??bodies[packetIndex]!.sha256,machineContext:machine(fields),sequenceContext:sequence===undefined?{status:'absent'}:{status:'present',sequenceId:sequence.sequenceId,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion}});
    function observe(packetIndex:number,fragment:Exclude<ReturnType<typeof decodeBrowserFramePacket>,{status:'unavailable'}>,sequence?:Sequence):void {
      // Fragment type is inferred from the packet decoder; all rows below are owned.
      const fields=fragment.fields,ctx=context(packetIndex,fields,sequence),flags=BigInt(fields.sequenceFlags??'0'),resetObserved=fields.incrementalStateCleared===true||(flags&1n)!==0n,dropObserved=fields.previousPacketDropped!==undefined&&fields.previousPacketDropped!=='0';
      budget.repeatedWork(1,packetIndex);
      if(whole){whole.counters.resets+=Number(resetObserved);whole.counters.losses+=Number(!resetObserved&&dropObserved);}
      else {const loss:LossObservation={...ctx,resetObserved,dropObserved,...(fields.previousPacketDropped===undefined?{}:{previousPacketDropped:fields.previousPacketDropped}),historyCompleteness:'unestablished'};budget.output(loss,packetIndex);lossObservations.push(loss);}
      for(const at of fragment.opaquePayloads){
        if(at.fieldNumber!==60&&at.fieldNumber!==6)continue;
        const location={packetIndex,...at};
        const retain=(value:{kind:'track_descriptor';fields:TrackDescriptorFields}|{kind:'clock_snapshot';primaryTraceClock?:string;clocks:readonly ClockFields[]})=>{if(!whole?.evidence)return;const packetFields:RawEvidencePacketFields={};for(const key of ['timestamp','timestampClockId','sequenceFlags','previousPacketDropped','incrementalStateCleared','firstPacketOnSequence'] as const){const value=fields[key];if(value!==undefined)Object.assign(packetFields,{[key]:value});}whole.evidence.retain({...ctx,packetFields,location,...value});};
        const absolute=(o:{scope:string;fieldNumber:number;wireType:number;start:number;valueStart:number;end:number}):Location=>({packetIndex,...o,start:o.start+at.valueStart,valueStart:o.valueStart+at.valueStart,end:o.end+at.valueStart});
        if(at.fieldNumber===60){
          const decoded=whole?decodeWholeDescriptor(fragment.bodyBytes.slice(at.valueStart,at.end)):decodeBrowserFrameTrackDescriptorBody(fragment.bodyBytes.slice(at.valueStart,at.end),TRACK_DESCRIPTOR_BODY_POLICY);
          if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'track_descriptor',decoded.diagnostics[0]?.code);
          whole?.evidence?.admit(0,packetIndex);
          budget.fieldsVisited(decoded.occurrences.length,packetIndex);budget.repeatedWork(1+Number(decoded.fields.process!==undefined)+Number(decoded.fields.thread!==undefined),packetIndex);
          const fields=decoded.fields;retain({kind:'track_descriptor',fields});if(whole)whole.note('descriptor',[fields.uuid??null,fields.parentUuid??null,fields.process?.pid??null,fields.process?.startTimestampNs??null,fields.thread?.pid??null,fields.thread?.tid??null]);const reasons:AssociationReason[]=['clock_not_normalized','frame_mapping_not_implemented'];
          if(ctx.sequenceContext.status==='absent')reasons.push('missing_sequence_context');
          if(fields.uuid===undefined||fields.uuid==='0'||decoded.descriptorAssociation==='none'||fields.process!==undefined&&fields.process.pid===undefined||fields.thread!==undefined&&(fields.thread.pid===undefined||fields.thread.tid===undefined))reasons.push('incomplete_association');
          if(fields.parentUuid!==undefined)reasons.push('unresolved_parent');
          if(decoded.descriptorAssociation==='ambiguous-process-and-thread')reasons.push('ambiguous_process_and_thread');
          if(fields.uuid!==undefined&&fields.uuid!=='0'){
            const key=trackKey(ctx.machineContext,fields.uuid);let group=disclosures.get(key);
            if(!group){if(whole){if(disclosures.size>=128)throw new ProfileError('disclosure-capacity',packetIndex);whole.budget.persist(key,packetIndex);whole.counters.disclosures++;}group={values:new Map(),conflict:false,processSeen:false,threadSeen:false};disclosures.set(key,group);}
            const disclose=(key:string,value:string|undefined)=>{if(value===undefined)return;budget.repeatedWork(1,packetIndex);const old=group!.values.get(key);if(old!==undefined&&old!==value)group!.conflict=true;else {if(whole&&old===undefined)whole.budget.persist(key+value,packetIndex);group!.values.set(key,value);}};
            disclose('parent',fields.parentUuid);disclose('process.pid',fields.process?.pid);disclose('process.start',fields.process?.startTimestampNs);disclose('thread.pid',fields.thread?.pid);disclose('thread.tid',fields.thread?.tid);
            group.processSeen ||= fields.process!==undefined;group.threadSeen ||= fields.thread!==undefined;
          }
          const row:DescriptorObservation={...ctx,location,fields,occurrences:decoded.occurrences.map(absolute),associationStatus:'unestablished',reasons};budget.output(row,packetIndex);if(!whole)descriptorObservations.push(row);
          for(const o of decoded.skippedFields)opaque(absolute(o));
        }else{
          const decoded=whole?decodeWholeStateBody(fragment.bodyBytes.slice(at.valueStart,at.end),'clock_snapshot'):decodeBrowserFrameStateBody(fragment.bodyBytes.slice(at.valueStart,at.end),'clock_snapshot',STATE_BODY_POLICY);
          if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'clock_snapshot',decoded.diagnostics[0]?.code);
          whole?.evidence?.admit(decoded.fields.clocks?.length??0,packetIndex);
          budget.fieldsVisited(decoded.occurrences.length,packetIndex);budget.repeatedWork(1+(decoded.fields.clocks?.length??0),packetIndex);
          retain({kind:'clock_snapshot',...(decoded.fields.primaryTraceClock===undefined?{}:{primaryTraceClock:decoded.fields.primaryTraceClock}),clocks:decoded.fields.clocks??[]});
          if(whole)whole.note('clock-header',[decoded.fields.primaryTraceClock??null]);
          const clocks=(decoded.fields.clocks??[]).map(clock=>{
            if(whole)whole.note('clock',[clock.clockId??null,clock.timestamp??null,clock.isIncremental??null,clock.unitMultiplierNs??null]);
            let scope:ClockScope;
            if(clock.clockId===undefined)scope={kind:'unavailable',reason:'missing_clock_id'};
            else if(clock.clockId==='0')scope={kind:'unavailable',reason:'unknown_clock_id'};
            else if(BigInt(clock.clockId)>=128n)scope={kind:'unavailable',reason:'reserved_clock_id'};
            else if(BigInt(clock.clockId)>=64n&&BigInt(clock.clockId)<=127n)scope=ctx.sequenceContext.status==='absent'?{kind:'unavailable',reason:'missing_sequence_context'}:{kind:'sequence-local',machineContext:ctx.machineContext,sequenceId:ctx.sequenceContext.sequenceId};
            else scope={kind:'machine-clock-id',machineContext:ctx.machineContext};
            return {...clock,scope};
          });
          const row:ClockObservation={...ctx,location,...(decoded.fields.primaryTraceClock===undefined?{}:{primaryTraceClock:decoded.fields.primaryTraceClock}),clocks,occurrences:decoded.occurrences.map(absolute)};budget.output(row,packetIndex);if(whole)whole.counters.clockSnapshots++;else clockSnapshots.push(row);
          for(const o of decoded.skippedFields)opaque(absolute(o));
        }
      }
    }
    const opaqueKeys=new Set<string>();
    function opaque(row:Location):void{
      if(whole){budget.repeatedWork(1,row.packetIndex);return;}
      const key=JSON.stringify([row.packetIndex,row.scope,row.fieldNumber,row.wireType,row.start,row.valueStart,row.end]);
      if(opaqueKeys.has(key))return;
      if(opaqueLocations.length>=8192)throw new ProfileError('opaque-location-capacity',row.packetIndex);
      budget.output(row,row.packetIndex);opaqueKeys.add(key);opaqueLocations.push(row);
    }
    function consume(packetIndex:number,fragment:Exclude<ReturnType<typeof decodeBrowserFramePacket>,{status:'unavailable'}>):void{
      if(whole){whole.transition={sequenceIndex:null,intervalVersion:null,defaultsVersionIndex:null,stateEffect:'O',eventOutcome:'A',newDefinitions:0,repeatedDefinitions:0};whole.semantic=createHash('sha256').update('whole-supported-packet-semantics-v1\n');}
      budget.fieldsVisited(fragment.occurrences.length,packetIndex);
      budget.repeatedWork((fragment.event?.fields.categoryIids?.length??0)+(fragment.event?.fields.categories?.length??0)+(fragment.event?.graphics?.fields.surfaceTraceIds?.length??0),packetIndex);
      const fields = fragment.fields;
      whole?.clock3?.begin(fields);
      if(whole)whole.note('packet',[fields.machineId??null,fields.sequenceId??null,fields.timestamp??null,fields.timestampClockId??null,fields.sequenceFlags??null,fields.incrementalStateCleared??null,fields.previousPacketDropped??null,fields.firstPacketOnSequence??null]);
      if (fields.sequenceId === undefined) {
        if(whole&&(fields.sequenceFlags!==undefined||fields.incrementalStateCleared!==undefined||fields.previousPacketDropped!==undefined||fields.firstPacketOnSequence!==undefined))throw new ProfileError('missing-sequence-id',packetIndex);
        if(whole&&!fragment.event&&!fragment.opaquePayloads.some(at=>at.fieldNumber===12||at.fieldNumber===59)&&fields.sequenceFlags===undefined&&fields.incrementalStateCleared===undefined&&fields.previousPacketDropped===undefined&&fields.firstPacketOnSequence===undefined){
          if(fragment.opaquePayloads.some(at=>at.fieldNumber===6||at.fieldNumber===60)){observe(packetIndex,fragment);whole.transition.stateEffect='M';whole.counters.metadataPackets++;}else whole.counters.opaqueNoStatePackets++;whole.clock3?.timestamp(packetIndex,fields,undefined,fields.timestampClockId===undefined?{status:'unavailable',reason:'no-clock'}:{status:'selected',source:'packet',clockId:fields.timestampClockId},fragment.opaquePayloads.some(at=>at.fieldNumber===6));return;
        }
        if(!v2||fragment.event||fragment.opaquePayloads.some(at=>at.fieldNumber===12||at.fieldNumber===59)||!fragment.opaquePayloads.some(at=>at.fieldNumber===6||at.fieldNumber===60))throw new ProfileError('missing-sequence-id',packetIndex);
        if(BigInt(fields.sequenceFlags??'0')>3n)throw new ProfileError('unsupported-sequence-flags',packetIndex);
        observe(packetIndex,fragment);
        whole?.clock3?.timestamp(packetIndex,fields,undefined,fields.timestampClockId===undefined?{status:'unavailable',reason:'no-clock'}:{status:'selected',source:'packet',clockId:fields.timestampClockId},fragment.opaquePayloads.some(at=>at.fieldNumber===6));
        for(const at of fragment.skippedFields)opaque({packetIndex,...at});
        for(const at of fragment.opaquePayloads)opaque({packetIndex,...at});
        const row:MetadataPacket={...context(packetIndex,fields),fields:{...fields}};budget.output(row,packetIndex);if(whole)whole.counters.metadataPackets++;else metadataPackets.push(row);return;
      }
      if (fields.sequenceId === '0') throw new ProfileError('zero-sequence-id',packetIndex);
      const key = `${fields.machineId === undefined ? 'absent' : 'present:'+fields.machineId}:${fields.sequenceId}`;
      let sequence = byKey.get(key);
      const observed=sequence!==undefined;
      whole?.rawDrop?.(packetIndex,fields,observed);
      if (!sequence) {
        if (sequences.length >= 64) throw new ProfileError('sequence-capacity',packetIndex);
        if(whole)whole.budget.persist(key+fields.sequenceId+(fields.machineId??''),packetIndex);
        sequence = {sequenceIndex:sequences.length,sequenceId:fields.sequenceId,...(fields.machineId===undefined?{}:{machineId:fields.machineId}),valid:false,intervalVersion:0,defaultsVersionIndex:null,names:new Map(),categories:new Map(),...(annotations?{annotationNames:new Map<string,number>()}:{})};
        sequences.push(sequence);byKey.set(key,sequence);
      }
      const flags = BigInt(fields.sequenceFlags ?? '0');
      if (flags > 3n) throw new ProfileError('unsupported-sequence-flags',packetIndex);
      let stateEffect: PacketFact['stateEffect'] = 'none';
      if (fields.incrementalStateCleared === true || (flags & 1n) !== 0n) {
        if(annotations)budget.repeatedWork(sequence.names.size+sequence.categories.size,packetIndex);
        stateEffect='reset';sequence.intervalVersion++;sequence.valid=true;sequence.defaultsVersionIndex=null;releaseInterns(sequence.names);releaseInterns(sequence.categories);sequence.names.clear();sequence.categories.clear();
        if(sequence.annotationNames){budget.repeatedWork(sequence.annotationNames.size,packetIndex);releaseInterns(sequence.annotationNames);sequence.annotationNames.clear();}
      } else if (fields.previousPacketDropped !== undefined && fields.previousPacketDropped !== '0') {
        stateEffect='loss';sequence.intervalVersion++;sequence.valid=false;
      }
      whole?.clock3?.sequence(sequence,stateEffect);
      if(whole?.sequenceStart){
        const ledger=whole.sequenceStart;
        budget.repeatedWork(1,packetIndex);
        if(fields.firstPacketOnSequence===true&&observed){ledger.contradictions++;throw new ProfileError('invalid-whole-annotation-input',packetIndex);}
        if(stateEffect==='loss'){ledger.raw++;if(fields.firstPacketOnSequence===true&&fields.previousPacketDropped==='1')ledger.explained++;else ledger.unexplained++;}
      }
      if(whole){whole.transition.sequenceIndex=sequence.sequenceIndex;whole.transition.intervalVersion=sequence.intervalVersion;whole.transition.stateEffect=stateEffect==='none'?'N':stateEffect==='reset'?'R':'L';}
      if(v2)observe(packetIndex,fragment,sequence);
      for(const at of fragment.skippedFields)opaque({packetIndex,...at});
      for(const at of fragment.opaquePayloads)if(![12,59].includes(at.fieldNumber))opaque({packetIndex,...at});
      const defaultAt=fragment.opaquePayloads.find(at=>at.fieldNumber===59);
      if(defaultAt){
        const decoded=whole?decodeWholeStateBody(fragment.bodyBytes.slice(defaultAt.valueStart,defaultAt.end),'defaults'):decodeBrowserFrameStateBody(fragment.bodyBytes.slice(defaultAt.valueStart,defaultAt.end),'defaults',STATE_BODY_POLICY);
        if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'defaults',decoded.diagnostics[0]?.code);
        budget.fieldsVisited(decoded.occurrences.length,packetIndex);
        const child=decoded.fields.trackEventDefaults;
        budget.repeatedWork((child?.counterTrackUuids?.length??0)+(child?.doubleCounterTrackUuids?.length??0),packetIndex);
        if(child?.counterTrackUuids!==undefined||child?.doubleCounterTrackUuids!==undefined){if(whole?.userTiming!==2&&whole?.userTiming!==3)throw new ProfileError('unsupported-counter-defaults',packetIndex);}
        const value:DefaultFields={...(decoded.fields.timestampClockId===undefined?{}:{timestampClockId:decoded.fields.timestampClockId}),...(child===undefined?{}:{trackEventDefaultsPresent:true as const,...(child.trackUuid===undefined?{}:{trackUuid:child.trackUuid})})};
        if(whole){if(defaultsVersions.length>=1024)throw new ProfileError('defaults-capacity',packetIndex);if(child?.counterTrackUuids!==undefined||child?.doubleCounterTrackUuids!==undefined){budget.repeatedWork(1,packetIndex);whole.note('counter-defaults',[child.counterTrackUuids!==undefined,child.counterTrackUuids?.length??0,child.doubleCounterTrackUuids!==undefined,child.doubleCounterTrackUuids?.length??0]);}whole.budget.persist((value.timestampClockId??'')+(value.trackUuid??''),packetIndex);whole.counters.defaultsVersions++;whole.note('defaults',[value.timestampClockId??null,value.trackUuid??null,value.trackEventDefaultsPresent??false]);}
        sequence.defaultsVersionIndex=defaultsVersions.length;
        const version={versionIndex:defaultsVersions.length,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,packetIndex,location:{packetIndex,...defaultAt},fields:value};budget.output(version,packetIndex);defaultsVersions.push(version);
        for(const at of decoded.skippedFields)opaque({packetIndex,...at,start:at.start+defaultAt.valueStart,valueStart:at.valueStart+defaultAt.valueStart,end:at.end+defaultAt.valueStart});
      }
      const fact:RestrictedPacketFact={packetIndex,sequenceIndex:sequence.sequenceIndex,fields:{...fields},valid:sequence.valid,intervalVersion:sequence.intervalVersion,stateEffect,defaultsVersionIndex:sequence.defaultsVersionIndex,clockSelection:select(sequence,defaultsVersions,fields.timestampClockId,'clock'),eventOutcome:'absent',internUpdateOutcome:'absent',internNewDefinitions:0,internRepeatedDefinitions:0};
      const internAt=fragment.opaquePayloads.find(at=>at.fieldNumber===12);
      if(internAt){
        fact.internLocation={packetIndex,...internAt};
        const decoded=whole?decodeWholeStateBody(fragment.bodyBytes.slice(internAt.valueStart,internAt.end),'interned_names'):annotations?decodeBrowserFrameAnnotationStateBody(fragment.bodyBytes.slice(internAt.valueStart,internAt.end)):decodeBrowserFrameStateBody(fragment.bodyBytes.slice(internAt.valueStart,internAt.end),'interned_names',STATE_BODY_POLICY);
        if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'interned_names',decoded.diagnostics[0]?.code);
        budget.fieldsVisited(decoded.occurrences.length,packetIndex);budget.repeatedWork(decoded.fields.entries?.length??0,packetIndex);budget.internUpdates(decoded.fields.entries?.length??0,packetIndex);
        for(const at of decoded.skippedFields)opaque({packetIndex,...at,start:at.start+internAt.valueStart,valueStart:at.valueStart+internAt.valueStart,end:at.end+internAt.valueStart});
        fact.internUpdateOutcome=sequence.valid?'applied':'withheld_invalid';if(whole)whole.note('intern-outcome',[fact.internUpdateOutcome,decoded.fields.entries?.length??0]);
        const locations=decoded.occurrences.filter(at=>at.scope==='interned_data'&&(at.fieldNumber===1||at.fieldNumber===2||annotations&&at.fieldNumber===3));
        if(sequence.valid)for(const [index,entry] of (decoded.fields.entries??[]).entries()){
          const table=entry.table==='event_names'?sequence.names:entry.table==='debug_annotation_names'?sequence.annotationNames!:sequence.categories;
          const previous=table.get(entry.iid);
          if(whole)whole.note('definition',[entry.table,entry.iid,entry.name,previous??null]);
          if(previous!==undefined){
            if(internDefinitions[previous]!.value!==entry.name)throw new ProfileError('intern-conflict',packetIndex);
            fact.internRepeatedDefinitions++;if(whole)whole.counters.repeatedDefinitions++;
          }else{
            if(internDefinitions.length>=8192)throw new ProfileError('definition-capacity',packetIndex);
            if(whole){whole.budget.persist(entry.iid+entry.name,packetIndex);whole.counters.newDefinitions++;}
            budget.liveInsert(entry.name,packetIndex);
            const at=locations[index]!;
            const definitionIndex=internDefinitions.length;
            const definition={definitionIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,table:entry.table,iid:entry.iid,value:entry.name,definedAt:{packetIndex,...at,start:at.start+internAt.valueStart,valueStart:at.valueStart+internAt.valueStart,end:at.end+internAt.valueStart}};
            budget.output(definition,packetIndex);table.set(entry.iid,definitionIndex);internDefinitions.push(definition);
            fact.internNewDefinitions++;
          }
        }
      }
      whole?.clock3?.timestamp(packetIndex,fields,sequence,fact.clockSelection,fragment.opaquePayloads.some(at=>at.fieldNumber===6));
      const eventAt=fragment.occurrences.find(at=>at.scope==='packet'&&at.fieldNumber===11);
      if(fragment.event&&eventAt){
        fact.eventLocation={packetIndex,...eventAt};
        const e=fragment.event.fields;
        let annotationResolution:ReturnType<typeof resolveAnnotations>|undefined;
        if(annotations){
         const resolved=resolveAnnotations((fragment.event as AnnotationEventFragment).annotations,iid=>{const definitionIndex=sequence.annotationNames!.get(iid);if(definitionIndex===undefined)return undefined;return {definitionIndex,value:internDefinitions[definitionIndex]!.value};},sequence.valid,budget,packetIndex);
         if(whole?.userTiming)annotationResolution=resolved;
         else if(whole)whole.event(packetIndex,sequence,fields,{packetIndex,...eventAt},fragment.event as AnnotationEventFragment,resolved,select(sequence,defaultsVersions,e.trackUuid,'track'),fact.clockSelection);
         else annotationEvents.push({packetIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,eventLocation:{packetIndex,...eventAt},...resolved});
        }
        if(e.nameIid==='0'||e.categoryIids?.some(iid=>iid==='0'))throw new ProfileError('invalid-event-iid',packetIndex);
        const raw:RestrictedEventInput|undefined=slice===undefined?undefined:{rawEventIndex:rawEventInputs.length,packetIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,defaultsVersionIndex:sequence.defaultsVersionIndex,eventLocation:{packetIndex,...eventAt},event:fragment.event as EventFragmentWithMembers,trackSelection:select(sequence,defaultsVersions,e.trackUuid,'track'),clockSelection:fact.clockSelection,resolution:'withheld_dependency'};
        if(!sequence.valid&&(flags&2n)!==0n)fact.eventOutcome='withheld_dependency';
        else if(!sequence.valid&&(e.nameIid!==undefined||(e.categoryIids?.length??0)>0))fact.eventOutcome='withheld_intern_invalid';
        else if((slice!==undefined||whole?.userTiming)&&(e.nameIid!==undefined&&!sequence.names.has(e.nameIid)||e.categoryIids?.some(iid=>!sequence.categories.has(iid)))){
          budget.categoryReferences(e.categoryIids?.length??0,packetIndex);fact.eventOutcome='withheld_missing_intern_definition';
        }
        else{
          budget.categoryReferences(e.categoryIids?.length??0,packetIndex);
          const lookup=(iid:string,table:Map<string,number>):number=>{const definitionIndex=table.get(iid);if(definitionIndex===undefined)throw new ProfileError('missing-intern-definition',packetIndex);return definitionIndex;};
          const name=e.nameIid===undefined?(e.name===undefined?undefined:{kind:'literal' as const,value:e.name}):{kind:'intern' as const,definitionIndex:lookup(e.nameIid,sequence.names)};
          const refs=e.categoryIids?.map(iid=>lookup(iid,sequence.categories));
          fact.eventOutcome='resolved';fact.eventIndex=events.length;
          const row={eventIndex:events.length,packetIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,defaultsVersionIndex:sequence.defaultsVersionIndex,location:{packetIndex,...eventAt},...(name===undefined?{}:{name}),...(e.categories===undefined?{}:{literalCategories:e.categories}),...(refs===undefined?{}:{internedCategoryDefinitionIndexes:refs}),...(e.type===undefined?{}:{type:e.type}),trackSelection:select(sequence,defaultsVersions,e.trackUuid,'track'),typedArgumentKinds:[...(fragment.event.reporter2?['reporter2']:[]),...(fragment.event.graphics?['graphics']:[])]};budget.output(row,packetIndex);if(!whole)events.push(row);
        }
        if(whole){
          const track=select(sequence,defaultsVersions,e.trackUuid,'track'),clock=fact.clockSelection;
          whole.note('event',[e.name??null,e.nameIid??null,e.type??null,fact.eventOutcome,track.status,track.status==='selected'?track.source:track.reason,track.status==='selected'?track.trackUuid??null:null,track.status==='selected'?track.defaultsVersionIndex??null:null,clock.status,clock.status==='selected'?clock.source:clock.reason,clock.status==='selected'?clock.clockId??null:null,clock.status==='selected'?clock.defaultsVersionIndex??null:null,fact.eventOutcome==='resolved'&&e.nameIid!==undefined?sequence.names.get(e.nameIid)??null:null,sequence.valid]);
          for(const category of e.categories??[]){budget.repeatedWork(1,packetIndex);whole.note('literal-category',[category]);}
          for(const iid of e.categoryIids??[]){budget.repeatedWork(1,packetIndex);whole.note('intern-category',[iid,fact.eventOutcome==='resolved'?sequence.categories.get(iid)??null:null]);}
        }
        if(raw!==undefined){budget.repeatedWork(1,packetIndex);raw.resolution=fact.eventOutcome;if(fact.eventIndex!==undefined)raw.orderedEventIndex=fact.eventIndex;rawEventInputs.push(raw);}
        for(const at of fragment.occurrences)if(at.scope==='track_event'&&(at.fieldNumber===1052||at.fieldNumber===1075))opaque({packetIndex,...at});
        if(whole?.userTiming)whole.event(packetIndex,sequence,fields,{packetIndex,...eventAt},fragment.event as WholeFramePresentedEventFragment,annotationResolution!,select(sequence,defaultsVersions,e.trackUuid,'track'),fact.clockSelection,{outcome:fact.eventOutcome,definitions:internDefinitions});
      }
      budget.output(fact,packetIndex);if(whole){whole.transition.defaultsVersionIndex=fact.defaultsVersionIndex;whole.transition.eventOutcome=fact.eventOutcome==='absent'?'A':fact.eventOutcome==='resolved'?'R':fact.eventOutcome==='withheld_dependency'?'D':fact.eventOutcome==='withheld_intern_invalid'?'I':'M';whole.transition.newDefinitions=fact.internNewDefinitions;whole.transition.repeatedDefinitions=fact.internRepeatedDefinitions;}else packets.push(fact);
    }
    function finish():OrderedStateProjection|OrderedEvidenceProjection|RestrictedOrderedBuild|OrderedAnnotationProjection{
    const sequenceRows=sequences.map(s=>{const row={sequenceIndex:s.sequenceIndex,sequenceId:s.sequenceId,...(s.machineId===undefined?{}:{machineId:s.machineId}),valid:s.valid,intervalVersion:s.intervalVersion};budget.output(row);return row;});
    const associationReasons:AssociationReason[]=['clock_not_normalized','frame_mapping_not_implemented'];
    if(v2){
      for(const row of descriptorObservations){
        const uuid=row.fields.uuid;
        const group=uuid===undefined||uuid==='0'?undefined:disclosures.get(trackKey(row.machineContext,uuid));
        if(group?.conflict){budget.output('conflicting_association',row.packetIndex);row.reasons.push('conflicting_association');}
        if(group?.processSeen&&group.threadSeen&&!row.reasons.includes('ambiguous_process_and_thread')){budget.output('ambiguous_process_and_thread',row.packetIndex);row.reasons.push('ambiguous_process_and_thread');}
        for(const reason of row.reasons)if(!associationReasons.includes(reason))associationReasons.push(reason);
      }
      for(const event of events){
        budget.repeatedWork(1,event.packetIndex);const uuid=event.trackSelection.status==='selected'?event.trackSelection.trackUuid:undefined;
        if(uuid===undefined||uuid==='0'||!disclosures.has(trackKey(machine(sequences[event.sequenceIndex]!),uuid))){if(!associationReasons.includes('missing_descriptor'))associationReasons.push('missing_descriptor');}
      }
      budget.output({status:'projected_ordered_manual_evidence',normalizationCapability:'ordered-manual-identity-evidence-only',associationStatus:'unestablished',associationReasons,metadataPackets:[],descriptorObservations:[],clockSnapshots:[],lossObservations:[]});
    }
    const base:Omit<OrderedStateProjection,'packets'|'internDefinitions'>&{packets:RestrictedPacketFact[];internDefinitions:AnnotationInternDefinition[]}={ status:'projected_ordered_manual_state',domain:domain,source:PACKET_SOURCE,bodies,sequences:sequenceRows,defaultsVersions,internDefinitions,packets,events,opaqueLocations:opaqueLocations.sort((a,b)=>a.packetIndex-b.packetIndex||a.start-b.start||a.end-b.end),...LABELS };
    const result:typeof base|(Omit<OrderedAnnotationEvidence,'packets'>&{packets:RestrictedPacketFact[]})=v2?{...base,status:'projected_ordered_manual_evidence',normalizationCapability:'ordered-manual-identity-evidence-only',associationStatus:'unestablished',associationReasons,metadataPackets,descriptorObservations,clockSnapshots,lossObservations}:base;
    if(slice!==undefined){
      if(result.status!=='projected_ordered_manual_evidence')throw new ProfileError('invalid-internal-slice-mode');
      // Slice callers always leave annotations=false, so their table domain is legacy.
      return {status:'built_restricted_state',ordered:{...result,status:'projected_restricted_slice_state'},rawEventInputs} as RestrictedOrderedBuild;
    }
    if(annotations){
     const output:OrderedAnnotationProjection={status:'projected_ordered_manual_annotations',domain:domain,source:PACKET_SOURCE,orderedEvidence:result as OrderedAnnotationEvidence,annotationEvents,authority:ANNOTATION_AUTHORITY};
     budget.finishOwnedOutput(output);
     if(Buffer.byteLength(JSON.stringify(output),'utf8')>4194304)throw new ProfileError('output-byte-capacity');
     return freezeOwned(output);
    }
    // Final admission cap; bounded JSON serialization may transiently exceed it.
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>4194304)throw new ProfileError('output-byte-capacity');
    // The only new outcome is guarded by slice!==undefined above; old declarations remain unchanged.
    return freezeOwned(result) as OrderedStateProjection|OrderedEvidenceProjection;
    }
    return {consume,finish,state:()=>({sequences:sequences.length,historyDefinitions:internDefinitions.length,defaultsVersions:defaultsVersions.length,disclosureGroups:disclosures.size})};
}

function project(input:unknown,policy:unknown,v2:boolean,slice?:{frames:readonly OwnedSlicePacket[];budget:Budget},annotations=false):OrderedStateProjection|OrderedEvidenceProjection|OrderedStateUnavailable|RestrictedOrderedBuild|OrderedAnnotationProjection {
  try {
    if (policy !== (annotations?ORDERED_ANNOTATION_POLICY:v2?ORDERED_STATE_V2_POLICY:ORDERED_STATE_POLICY)) throw new ProfileError(policyError);
    const own = slice===undefined?(annotations?annotationPreflight(input):preflight(input)):{domain:'whole-supplied-restricted-trace-group-v1',packets:slice.frames.map(f=>f.packet.bodyBytes)};
    const budget=slice?.budget??new Budget(annotations?'final-owned':'eager');
    budget.output({status:'projected_ordered_manual_state',domain:own.domain,source:PACKET_SOURCE,bodies:[],sequences:[],defaultsVersions:[],internDefinitions:[],packets:[],events:[],opaqueLocations:[],...LABELS});
    const bodies=own.packets.map((bytes,packetIndex)=>{const row={packetIndex,bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};budget.output(row,packetIndex);return row;});
    const reducer=createOrderedReducer(own.domain,bodies,budget,v2,slice,annotations);
    for (let packetIndex=0;packetIndex<own.packets.length;packetIndex++) {
      const fragment = slice===undefined?(annotations?decodeBrowserFrameAnnotationPacket(own.packets[packetIndex],n=>budget.repeatedWork(n,packetIndex)):decodeBrowserFramePacket(own.packets[packetIndex],PACKET_POLICY)):slice.frames[packetIndex]!.packet;
      if (fragment.status === 'unavailable') throw new ProfileError('fragment-unavailable',packetIndex,'packet',fragment.diagnostics[0]?.code);
      reducer.consume(packetIndex,fragment);
    }
    return reducer.finish();
  } catch (error) {
    return freezeOwned({status:'unavailable',diagnostics:[{code:error instanceof ProfileError ? error.code : 'invalid-ordered-state-input',...(error instanceof ProfileError && error.packetIndex !== undefined ? {packetIndex:error.packetIndex}: {}),...(error instanceof ProfileError && error.component!==undefined?{component:error.component}:{}),...(error instanceof ProfileError && error.causeCode!==undefined?{cause:error.causeCode}:{})}]});
  }
}

interface ResolutionBudget {repeatedWork(count:number,index:number):void;categoryReferences(count:number,index:number):void}
/** Resolve every root name before selecting a candidate; no prefix promotion. */
export function resolveAnnotations(input:readonly AnnotationBody[],lookup:(iid:string)=>{definitionIndex:number;value:string}|undefined,valid:boolean,budget:ResolutionBudget,index:number){
 const annotations:Record<string,unknown>[]=[],keys:(string|undefined)[]=[],seen=new Set<string>();
 let reason:string|undefined;
 for(const body of input){
  budget.repeatedWork(1,index);
  let key=body.name;let name:Record<string,unknown>;
  if(key!==undefined)name={kind:'literal',value:key};
  else if(body.nameIid!==undefined){
   budget.categoryReferences(1,index);const definition=valid?lookup(body.nameIid):undefined;
   if(definition){key=definition.value;name={kind:'intern',definitionIndex:definition.definitionIndex};}
   else name={kind:'unresolved',reason:'missing-or-invalid-annotation-name'};
  }else name={kind:'unresolved',reason:'missing-annotation-name'};
  if(key===undefined)reason??='unresolved-annotation-name';
  else{budget.repeatedWork(1,index);if(seen.has(key))reason='duplicate-annotation-name';else{budget.repeatedWork(1,index);seen.add(key);}}
  keys.push(key);
  annotations.push({location:body.location,name,value:body.stringValue!==undefined&&!body.unsupported?{kind:'literal_string',value:body.stringValue}:{kind:'unsupported',reason:'unsupported-or-missing-annotation-value',opaqueLocations:body.opaqueLocations}});
 }
 let candidate:number|undefined;
 for(let i=0;i<input.length;i++){budget.repeatedWork(1,index);if(keys[i]==='markName')candidate=i;}
 let markName:{status:'withheld';reason:string}|{status:'absent'}|{status:'literal_string';value:string;annotationIndex:number};
 if(reason!==undefined)markName={status:'withheld',reason};
 else if(candidate===undefined)markName={status:'absent'};
 else if(input[candidate]!.unsupported||input[candidate]!.stringValue===undefined)markName={status:'withheld',reason:'unsupported-mark-name-value'};
 else markName={status:'literal_string',value:input[candidate]!.stringValue!,annotationIndex:candidate};
 return {nameInventoryStatus:reason===undefined?'resolved' as const:'withheld' as const,annotations,markName};
}

export const WHOLE_ANNOTATION_POLICY='pinned-whole-trace-ordered-annotations-diagnostic-v1';
export const WHOLE_USER_TIMING_POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v2';
export const WHOLE_USER_TIMING_V3_POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v3';
export const WHOLE_USER_TIMING_V4_POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v4';
export const WHOLE_USER_TIMING_V5_POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v5';
export const WHOLE_USER_TIMING_V6_POLICY='pinned-whole-trace-user-timing-marks-diagnostic-v6';
export const WHOLE_USER_TIMING_V7_POLICY='pinned-whole-trace-user-timing-evidence-diagnostic-v7';
export const WHOLE_USER_TIMING_V8_POLICY='pinned-whole-trace-user-timing-raw-drop-evidence-diagnostic-v8';
export const WHOLE_USER_TIMING_V9_POLICY='pinned-whole-trace-user-timing-compact-evidence-diagnostic-v9';
export const WHOLE_USER_TIMING_V10_POLICY='pinned-whole-trace-user-timing-framepresented-r-diagnostic-v10';
export const WHOLE_USER_TIMING_V11_POLICY='pinned-whole-trace-user-timing-clock-layout-evidence-diagnostic-v11';
export const NATIVE_CLOCK3_PHASE_POLICY='native-clock3-phase-alignment-diagnostic-v1';
export const NATIVE_CLOCK3_PHASE_V2_POLICY='native-clock3-phase-alignment-diagnostic-v2';
export function nativeClock3Names(value:unknown):readonly[string,string]|null {
 if(value===null||typeof value!=='object'||types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!('value'in length)||length.value!==2)return null;
 const keys=Reflect.ownKeys(value);if(keys.length!==3||!keys.every(k=>k==='0'||k==='1'||k==='length'))return null;
 const a=Object.getOwnPropertyDescriptor(value,'0'),b=Object.getOwnPropertyDescriptor(value,'1');
 if(!a||!b||!('value'in a)||!('value'in b))return null;
 const valid=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&Buffer.byteLength(s)<=256&&!/\p{Cc}/u.test(s)&&!/[\uD800-\uDFFF]/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''));
 return valid(a.value)&&valid(b.value)&&a.value!==b.value?[a.value,b.value]:null;
}
type Clock3Config={names:readonly[string,string]};
type Clock3Position='before'|'inside'|'after';
interface Clock3PacketWitness {
 packetIndex:number;bodySHA256:string;sequenceId:string|null;sequenceIndex:number|null;intervalVersion:number|null;
 rawTimestamp:string;explicitClockId:string|null;clockId:string;clockSource:string;defaultsVersionIndex:number|null;
 clock3Ns:string;offsetNs:string;snapshotPacketIndex:number|null;
}
interface Clock3EventWitness extends Clock3PacketWitness {eventType:'3';eventName:string;nameSource:'literal'|'intern';nameDefinitionIndex:number|null;trackUuid:string;trackSource:string;trackDefaultsVersionIndex:number|null}
interface Clock3Instant extends Clock3EventWitness {name:'BeginFrame'|'DrawFrame';position:Clock3Position}
interface Clock3PhaseWitness extends Clock3EventWitness {name:string}
type Clock3Counts={BeginFrame:Record<Clock3Position,number>;DrawFrame:Record<Clock3Position,number>};
export interface NativeClock3Projection {
 status:'projected-clock3-instants';referenceClockId:'3';phase:{startNs:string;endNs:string;start:Clock3PhaseWitness;end:Clock3PhaseWitness};
 rows:Clock3Instant[];counts:Clock3Counts;
}
/** Focused private arithmetic unit. Only source-created reducer hooks call this port. */
function createClock3Projection(config:Clock3Config,budget:WholeStudyBudget,markCount:()=>number,admit:(value:unknown)=>void){
 type Anchor={local:bigint;global:bigint;offset:bigint;packetIndex:number};
 const states=new Map<number,{epoch:number;valid:boolean;a64?:Anchor;a65?:Anchor;local64?:bigint}>(),rows:Omit<Clock3Instant,'position'>[]=[],marks:Clock3PhaseWitness[]=[];
 let failure:string|null=null,pending:{row:WholeClockEvidenceObservation;index:number}|null=null,current:Clock3PacketWitness|null=null;
 const refuse=(reason:string)=>{failure??=reason;rows.length=0;marks.length=0;current=null;pending=null;states.clear();};
 const intMax=9223372036854775807n;
 const checked=(n:bigint)=>n>=0n&&n<=intMax;
 function witness(index:number,fields:PacketFields,selection:Selection,sequence:Sequence|undefined,ns:bigint,offset=0n,snapshotPacketIndex:number|null=null){
  if(!checked(ns)){refuse('clock3-arithmetic-range');return;}
  current={packetIndex:index,bodySHA256:'',sequenceId:sequence?.sequenceId??null,sequenceIndex:sequence?.sequenceIndex??null,intervalVersion:sequence?.intervalVersion??null,
   rawTimestamp:fields.timestamp!,explicitClockId:fields.timestampClockId??null,clockId:selection.status==='selected'?selection.clockId!:'',clockSource:selection.status==='selected'?selection.source:'unavailable',defaultsVersionIndex:selection.status==='selected'?selection.defaultsVersionIndex??null:null,clock3Ns:String(ns),offsetNs:String(offset),snapshotPacketIndex};
 }
 function applySnapshot(sequence:Sequence|undefined){
  const item=pending;pending=null;if(!item||failure)return;
  if(item.row.kind!=='clock_snapshot')return;
  const row=item.row;
  if(row.machineContext.status!=='absent'){refuse('clock3-machine');return;}
  let global:bigint|undefined;const local=new Map<string,ClockFields>();
  for(const c of row.clocks){
   budget.repeatedWork(1,row.packetIndex);
   if(c.clockId===undefined||c.timestamp===undefined||!['3','6','64','65'].includes(c.clockId)){refuse('clock3-snapshot-domain');return;}
   if(c.clockId==='3'||c.clockId==='6'){
    if(c.unitMultiplierNs!==undefined&&c.unitMultiplierNs!=='1'||c.isIncremental===true||!checked(BigInt(c.timestamp))){refuse('clock3-builtin-properties');return;}
    if(c.clockId==='3')global=BigInt(c.timestamp);
   }else{
    if(c.unitMultiplierNs!=='1000'||c.clockId==='64'&&c.isIncremental!==true||c.clockId==='65'&&c.isIncremental===true){refuse('clock3-local-properties');return;}
    local.set(c.clockId,c);
   }
  }
  if(local.size===0)return;
  if(global===undefined||!sequence?.valid){refuse('clock3-snapshot-anchor');return;}
  let state=states.get(sequence.sequenceIndex);
  if(!state||state.epoch!==sequence.intervalVersion){state={epoch:sequence.intervalVersion,valid:true};states.set(sequence.sequenceIndex,state);}
  for(const [id,c]of local){const a=BigInt(c.timestamp!),offset=global-a*1000n;if(!checked(a*1000n)||offset< -intMax||offset>intMax){refuse('clock3-arithmetic-range');return;}
   const anchor={local:a,global,offset,packetIndex:row.packetIndex};budget.persist(String(offset)+c.timestamp+String(global),row.packetIndex);
   if(id==='64'){state.a64=anchor;state.local64=a;}else state.a65=anchor;
  }
 }
 return {
  retained(){return{rows,marks};},
  begin(fields:PacketFields){current=null;pending=null;if(!failure&&fields.machineId!==undefined)refuse('clock3-machine');},
  sequence(sequence:Sequence,effect:PacketFact['stateEffect']){if(failure)return;if(effect!=='none')states.delete(sequence.sequenceIndex);},
  stage(row:WholeClockEvidenceObservation,index:number){if(!failure&&row.kind==='clock_snapshot')pending={row,index};},
  timestamp(index:number,fields:PacketFields,sequence:Sequence|undefined,selection:Selection,hasSnapshot:boolean){
   if(failure)return;applySnapshot(sequence);if(failure||hasSnapshot)return;
   if((BigInt(fields.sequenceFlags??'0')&2n)!==0n&&!sequence?.valid)return;
   if(fields.timestamp===undefined)return;
   budget.repeatedWork(1,index);
   if(selection.status!=='selected')return;
   const id=selection.clockId!,raw=BigInt(fields.timestamp);if(raw>intMax){refuse('clock3-arithmetic-range');return;}
   if(id==='3'){witness(index,fields,selection,sequence,raw);return;}
   if(id!=='64'&&id!=='65')return;
   const state=sequence===undefined?undefined:states.get(sequence.sequenceIndex),anchor=id==='64'?state?.a64:state?.a65;
   if(!sequence?.valid||!state||state.epoch!==sequence.intervalVersion||!anchor){refuse('clock3-missing-anchor');return;}
   const local=id==='64'?(state.local64??anchor.local)+raw:raw;
   if(!checked(local*1000n)){refuse('clock3-arithmetic-range');return;}
   if(id==='64')state.local64=local;
   witness(index,fields,selection,sequence,anchor.global+(local-anchor.local)*1000n,anchor.offset,anchor.packetIndex);
  },
  event(index:number,hash:string,event:AnnotationEventFragment,sequence:Sequence,final:{outcome:string;definitions:readonly{value:string}[]},track:Selection,mark:{status:string;value?:string}){
   if(failure)return;
   budget.repeatedWork(1,index);
   const e=event.fields,definition=e.nameIid===undefined?undefined:sequence.names.get(e.nameIid),name=e.nameIid===undefined?e.name:definition===undefined?undefined:final.definitions[definition]?.value;
   if(e.nameIid!==undefined&&name===undefined){refuse('clock3-name-unavailable');return;}
   const native=name==='BeginFrame'||name==='DrawFrame',phase=mark.status==='literal_string'&&config.names.includes(mark.value!);
   if(!native&&!phase)return;
   if(e.type!=='3'||final.outcome!=='resolved'||!current||track.status!=='selected'||!track.trackUuid||track.trackUuid==='0'){refuse('clock3-selected-unavailable');return;}
   const w={...current,bodySHA256:hash,eventType:'3' as const,eventName:name!,nameSource:e.nameIid===undefined?'literal' as const:'intern' as const,nameDefinitionIndex:definition??null,trackUuid:track.trackUuid,trackSource:track.source,trackDefaultsVersionIndex:track.defaultsVersionIndex??null};
   if(phase){const row={...w,name:mark.value!};budget.persist(JSON.stringify(row),index);admit({rows,marks:[...marks,row]});marks.push(row);if(marks.length>2)refuse('clock3-mark-cardinality');return;}
   if(rows.length+markCount()>=128){refuse('clock3-candidate-capacity');return;}
   const row={...w,name:name as 'BeginFrame'|'DrawFrame'};budget.persist(JSON.stringify(row),index);budget.usage.candidateRows++;budget.usage.candidateUTF8+=Buffer.byteLength(name!);
   if(budget.usage.candidateUTF8>16384){refuse('clock3-candidate-capacity');return;}
   admit({rows:[...rows,row],marks});rows.push(row);
  },
  admitMark(){if(!failure&&rows.length+markCount()>=128)refuse('clock3-candidate-capacity');},
  discard(){refuse('clock3-owned-input-unavailable');},
  finish(good:boolean,candidates:WholeAnnotationCandidate[],observations:WholeClockEvidenceObservation[],compactRows? :()=>Iterable<WholeClockEvidenceObservation>){
   if(!good)refuse('clock3-core-unavailable');
   if(!failure){
    if(marks.length!==2||marks[0]!.name!==config.names[0]||marks[1]!.name!==config.names[1]||BigInt(marks[0]!.clock3Ns)>=BigInt(marks[1]!.clock3Ns)||marks[0]!.trackUuid!==marks[1]!.trackUuid)refuse('clock3-mark-cardinality');
    if(config.names.some(name=>candidates.filter(c=>c.kind==='literal_string'&&c.value===name).length!==1))refuse('clock3-mark-cardinality');
   }
   if(!failure&&compactRows&&!compactPhaseIdentity(compactRows,marks[0]!.trackUuid))refuse('clock3-descriptor-identity');
   if(!failure&&!compactRows){
    const track=marks[0]!.trackUuid,descriptors=observations.filter((o):o is WholeClockEvidenceObservation&{kind:'track_descriptor'}=>o.kind==='track_descriptor'&&o.fields.uuid===track),parents=new Set(descriptors.map(o=>o.fields.parentUuid)),threads=new Set(descriptors.filter(o=>o.fields.thread).map(o=>JSON.stringify([o.fields.thread!.pid,o.fields.thread!.tid])));
    if(descriptors.length===0||parents.size!==1||parents.has(undefined)||parents.has('0')||parents.has(track)||threads.size!==1||descriptors.some(o=>!o.fields.thread||o.fields.thread.pid===undefined||o.fields.thread.tid===undefined||o.fields.process!==undefined))refuse('clock3-descriptor-identity');
    else{const parent=[...parents][0]!,processes=observations.filter((o):o is WholeClockEvidenceObservation&{kind:'track_descriptor'}=>o.kind==='track_descriptor'&&o.fields.uuid===parent),identities=new Set(processes.map(o=>JSON.stringify([o.fields.parentUuid??null,o.fields.process?.pid,o.fields.process?.startTimestampNs])));
     if(identities.size!==1||processes.length===0||processes.some(o=>o.fields.thread!==undefined||o.fields.process?.pid===undefined||o.fields.process.startTimestampNs===undefined)||descriptors.some(o=>o.fields.thread?.pid!==processes[0]!.fields.process!.pid))refuse('clock3-descriptor-identity');
    }
   }
   if(failure)return{reason:failure,projection:null};
   const start=marks[0]!,end=marks[1]!,counts:Clock3Counts={BeginFrame:{before:0,inside:0,after:0},DrawFrame:{before:0,inside:0,after:0}};
   const projected=rows.map(row=>{const n=BigInt(row.clock3Ns),position:Clock3Position=n<BigInt(start.clock3Ns)?'before':n<BigInt(end.clock3Ns)?'inside':'after';counts[row.name][position]++;return{...row,position};});
   return{reason:null,projection:{status:'projected-clock3-instants' as const,referenceClockId:'3' as const,phase:{startNs:start.clock3Ns,endNs:end.clock3Ns,start,end},rows:projected,counts}};
  }
 };
}
/** Supported known headers only; optional headers preserve explicit zero/false and absence. */
export interface WholeRawDropFact {
 packetIndex:number;bodySHA256:string;machineContext:MachineContext;sequenceId:string;previousPacketDropped:string;
 firstPacketOnSequence?:boolean;sequenceFlags?:string;incrementalStateCleared?:boolean;
 priorSeen:boolean;classification:'explained'|'unexplained';
}
export type WholeRawDropInventory={status:'complete-supported-header-declarations';facts:readonly WholeRawDropFact[];nonzeroDeclarations:number;explainedDeclarations:number;unexplainedDeclarations:number;contradictoryDeclarations:number}|
 {status:'unavailable';facts:readonly WholeRawDropFact[];nonzeroDeclarations:null;explainedDeclarations:null;unexplainedDeclarations:null;contradictoryDeclarations:null};
function unavailableRawDropInventory():WholeRawDropInventory{return{status:'unavailable',facts:[],nonzeroDeclarations:null,explainedDeclarations:null,unexplainedDeclarations:null,contradictoryDeclarations:null};}
type RawEvidencePacketFields=Pick<PacketFields,'timestamp'|'timestampClockId'|'sequenceFlags'|'previousPacketDropped'|'incrementalStateCleared'|'firstPacketOnSequence'>;
type WholeEvidenceContext=EvidenceContext&{location:Location;packetFields:RawEvidencePacketFields};
export type WholeClockEvidenceObservation=WholeEvidenceContext&(
 {kind:'track_descriptor';fields:TrackDescriptorFields}|
 {kind:'clock_snapshot';primaryTraceClock?:string;clocks:readonly ClockFields[]});
export interface WholeClockEvidenceInventory {status:'complete-supported-observations'|'unavailable';observations:readonly WholeClockEvidenceObservation[]}
type CompactFact={kind:'track_descriptor';fields:TrackDescriptorFields}|{kind:'clock_snapshot';primaryTraceClock?:string;clocks:readonly ClockFields[]};
type CompactOccurrence=readonly[number,number,string,string|null,readonly[string,number,number]|null,RawEvidencePacketFields,readonly[string,number,number,number,number,number]];
export interface WholeCompactEvidenceInventory {status:'complete-supported-compact-observations'|'unavailable';version:1;facts:readonly CompactFact[];occurrences:readonly CompactOccurrence[]}
type ClockLayoutEntry=readonly ['timestamp']|readonly ['clockId'|'unitMultiplierNs',string]|readonly ['isIncremental',boolean];
type ClockLayoutFact={kind:'track_descriptor';fields:TrackDescriptorFields}|{kind:'clock_snapshot_layout';primaryTraceClock?:string;clocks:readonly (readonly ClockLayoutEntry[])[]};
type ClockLayoutOccurrence=readonly [...CompactOccurrence,readonly string[]|null];
export interface WholeClockLayoutEvidenceInventory {status:'complete-supported-compact-observations'|'unavailable';version:2;facts:readonly ClockLayoutFact[];occurrences:readonly ClockLayoutOccurrence[]}
/** Codec2 normalizes clock layouts only; every occurrence retains its exact timestamp vector. */
function createClockLayoutEvidence(budget:WholeStudyBudget){
 const facts:ClockLayoutFact[]=[],occurrences:ClockLayoutOccurrence[]=[],keys=new Map<string,number>();let clocks=0;
 const inventory=(good:boolean):WholeClockLayoutEvidenceInventory=>({status:good?'complete-supported-compact-observations':'unavailable',version:2,facts:good?facts:[],occurrences:good?occurrences:[]});
 return {inventory,releaseKeys(){keys.clear();},clear(){facts.length=0;occurrences.length=0;keys.clear();clocks=0;},
  retain(row:WholeClockEvidenceObservation,admit:(inventory:WholeClockLayoutEvidenceInventory)=>void){
   const i=row.packetIndex,n=row.kind==='clock_snapshot'?row.clocks.length:0;
   if(occurrences.length>=256||n>512-clocks)throw new ProfileError('invalid-whole-annotation-input',i);
   // Charge the complete supported row before extracting even the first layout slot.
   budget.repeatedWork(1,i);budget.persist(JSON.stringify(row),i);
   const timestamps:string[]=[];
   const fact:ClockLayoutFact=row.kind==='track_descriptor'?{kind:row.kind,fields:row.fields}:{kind:'clock_snapshot_layout',...(row.primaryTraceClock===undefined?{}:{primaryTraceClock:row.primaryTraceClock}),clocks:row.clocks.map(clock=>{
    budget.repeatedWork(1,i);const entries:ClockLayoutEntry[]=[];
    for(const field of Object.keys(clock) as (keyof ClockFields)[]){budget.repeatedWork(1,i);if(field==='timestamp'){timestamps.push(clock.timestamp!);entries.push(['timestamp']);budget.repeatedWork(1,i);}else if(field==='isIncremental')entries.push([field,clock[field]!]);else entries.push([field,clock[field]!]);}
    return entries;
   })};
   const key=JSON.stringify(fact);budget.repeatedWork(1,i);budget.persist(key,i);
   let index=keys.get(key);const fresh=index===undefined;
   if(fresh&&facts.length>=128)throw new ProfileError('invalid-whole-annotation-input',i);
   index??=facts.length;const s=row.sequenceContext,l=row.location;
   const occurrence:ClockLayoutOccurrence=[index,i,row.bodySha256,row.machineContext.status==='absent'?null:row.machineContext.machineId,s.status==='absent'?null:[s.sequenceId,s.sequenceIndex,s.intervalVersion],row.packetFields,[l.scope,l.fieldNumber,l.wireType,l.start,l.valueStart,l.end],row.kind==='track_descriptor'?null:timestamps];
   budget.repeatedWork(1+(fresh?1:0),i);budget.persist(JSON.stringify(occurrence),i);
   // The transient vector and retained template also pay in addition to tuple/key storage.
   budget.persist(JSON.stringify(timestamps)+(fresh?key:''),i);
   admit({status:'complete-supported-compact-observations',version:2,facts:fresh?[...facts,fact]:facts,occurrences:[...occurrences,occurrence]});
   if(fresh){keys.set(key,index);facts.push(fact);}occurrences.push(occurrence);clocks+=n;
  }
 };
}
/** Source-owned codec stays in this existing module to preserve native preparation's closed dependency roster. */
function createCompactEvidence(budget:WholeStudyBudget){
 const facts:CompactFact[]=[],occurrences:CompactOccurrence[]=[],keys=new Map<string,number>();let clocks=0;
 const inventory=(good:boolean):WholeCompactEvidenceInventory=>({status:good?'complete-supported-compact-observations':'unavailable',version:1,facts:good?facts:[],occurrences:good?occurrences:[]});
 return {inventory,releaseKeys(){keys.clear();},clear(){facts.length=0;occurrences.length=0;keys.clear();clocks=0;},
  retain(row:WholeClockEvidenceObservation,admit:(inventory:WholeCompactEvidenceInventory)=>void){
   const n=row.kind==='clock_snapshot'?row.clocks.length:0;
   if(occurrences.length>=256||n>512-clocks)throw new ProfileError('invalid-whole-annotation-input',row.packetIndex);
   const fact:CompactFact=row.kind==='track_descriptor'?{kind:row.kind,fields:row.fields}:{kind:row.kind,...(row.primaryTraceClock===undefined?{}:{primaryTraceClock:row.primaryTraceClock}),clocks:row.clocks};
   const key=JSON.stringify(fact);let index=keys.get(key);const fresh=index===undefined;
   if(fresh&&facts.length>=128)throw new ProfileError('invalid-whole-annotation-input',row.packetIndex);
   index??=facts.length;const s=row.sequenceContext,l=row.location;
   const occurrence:CompactOccurrence=[index,row.packetIndex,row.bodySha256,row.machineContext.status==='absent'?null:row.machineContext.machineId,s.status==='absent'?null:[s.sequenceId,s.sequenceIndex,s.intervalVersion],row.packetFields,[l.scope,l.fieldNumber,l.wireType,l.start,l.valueStart,l.end]];
   // Compression never waives the original full-row persistence charge. Keys and references pay additionally.
   budget.repeatedWork(1+Number(fresh),row.packetIndex);budget.persist(JSON.stringify(row),row.packetIndex);budget.persist(JSON.stringify(occurrence)+(fresh?key:''),row.packetIndex);
   admit({status:'complete-supported-compact-observations',version:1,facts:fresh?[...facts,fact]:facts,occurrences:[...occurrences,occurrence]});
   if(fresh){keys.set(key,index);facts.push(fact);}occurrences.push(occurrence);clocks+=n;
  },
  *rows():Generator<WholeClockEvidenceObservation>{for(const [index,packetIndex,bodySha256,machineId,sequence,packetFields,l]of occurrences){budget.repeatedWork(1,packetIndex);const location:Location={packetIndex,scope:l[0] as Location['scope'],fieldNumber:l[1],wireType:l[2],start:l[3],valueStart:l[4],end:l[5]};yield{packetIndex,bodySha256,machineContext:machineId===null?{status:'absent'}:{status:'present',machineId},sequenceContext:sequence===null?{status:'absent'}:{status:'present',sequenceId:sequence[0],sequenceIndex:sequence[1],intervalVersion:sequence[2]},packetFields,location,...facts[index]!};}}
 };
}
/** Two bounded passes retain identities only; no expanded observation or descriptor array. */
function compactPhaseIdentity(rows:()=>Iterable<WholeClockEvidenceObservation>,track:string):boolean{
 let count=0,invalid=false;const parents=new Set<string|undefined>(),threads=new Set<string>();let pid:string|undefined;
 for(const o of rows())if(o.kind==='track_descriptor'&&o.fields.uuid===track){const f=o.fields;count++;parents.add(f.parentUuid);if(f.thread)threads.add(JSON.stringify([f.thread.pid,f.thread.tid]));if(!f.thread||f.thread.pid===undefined||f.thread.tid===undefined||f.process!==undefined)invalid=true;pid=f.thread?.pid;}
 if(invalid||count===0||parents.size!==1||parents.has(undefined)||parents.has('0')||parents.has(track)||threads.size!==1)return false;
 const parent=[...parents][0];let processes=0;const identities=new Set<string>();
 for(const o of rows())if(o.kind==='track_descriptor'&&o.fields.uuid===parent){const f=o.fields;processes++;identities.add(JSON.stringify([f.parentUuid??null,f.process?.pid,f.process?.startTimestampNs]));if(f.thread!==undefined||f.process?.pid===undefined||f.process.startTimestampNs===undefined||f.process.pid!==pid)invalid=true;}
 return !invalid&&processes>0&&identities.size===1;
}
export interface WholeAnnotationCandidate {
 packetIndex:number;sequenceIndex:number;intervalVersion:number;eventStart:number;eventValueStart:number;eventEnd:number;bodySHA256:string;
 kind:'literal_string'|'withheld';value:string|null;reason:string|null;annotationIndex:number|null;nameSource:'literal'|'intern'|'unresolved';definitionIndex:number|null;
 clockId:string|null;clockSource:string;trackUuid:string|null;trackSource:string;machineStatus:'absent'|'present';machineId:string|null;sequenceId:string|null;rawTimestamp:string|null;timestampStatus:'absent'|'raw-unqualified';
}
export type WholeUserTimingCandidate=Omit<WholeAnnotationCandidate,'kind'|'value'|'reason'|'annotationIndex'>&(
 {representation:'annotation';kind:'literal_string';value:string;reason:null;annotationIndex:number}|
 {representation:'event_name';kind:'literal_string';value:string;reason:null;annotationIndex:null}|
 {representation:'withheld';kind:'withheld';value:null;reason:string;annotationIndex:null});
export interface WholeAnnotationDiagnostic {code:string;packetIndex:number|null;component:string|null}
export interface WholeAnnotationDiagnosticV3 extends WholeAnnotationDiagnostic {cause:ClosedStudyFailureCode|'unavailable-code'|null}
type StudyPort<T>=Readonly<{feed(input:unknown):void;finish():T}>;
export type WholeAnnotationStudy=Omit<ReturnType<ReturnType<typeof createWholeAnnotationEngine>['finish']>,'policy'|'diagnostics'|'sequenceStart'|'evidenceInventory'|'rawDropInventory'|'clock3Projection'>&{policy:typeof WHOLE_ANNOTATION_POLICY;diagnostics:WholeAnnotationDiagnostic[]};
export type WholeUserTimingStudy=Omit<WholeAnnotationStudy,'policy'|'candidates'>&{policy:typeof WHOLE_USER_TIMING_POLICY;candidates:WholeUserTimingCandidate[]};
export type WholeUserTimingStudyV3=Omit<WholeUserTimingStudy,'policy'|'diagnostics'>&{policy:typeof WHOLE_USER_TIMING_V3_POLICY;diagnostics:WholeAnnotationDiagnosticV3[]};
type Policy<T,P>=Omit<T,'policy'>&{policy:P};
export type WholeUserTimingStudyV4=Policy<WholeUserTimingStudyV3,typeof WHOLE_USER_TIMING_V4_POLICY>;
export type WholeUserTimingStudyV5=Policy<WholeUserTimingStudyV4,typeof WHOLE_USER_TIMING_V5_POLICY>;
export type WholeUserTimingStudyV6=Policy<WholeUserTimingStudyV5,typeof WHOLE_USER_TIMING_V6_POLICY>&{sequenceStart:SequenceStart};
export type WholeUserTimingStudyV7=Policy<WholeUserTimingStudyV6,typeof WHOLE_USER_TIMING_V7_POLICY>&{evidenceInventory:WholeClockEvidenceInventory};
export type WholeUserTimingStudyV8=Policy<WholeUserTimingStudyV7,typeof WHOLE_USER_TIMING_V8_POLICY>&{rawDropInventory:WholeRawDropInventory};
export type WholeUserTimingStudyV9=Policy<Omit<WholeUserTimingStudyV8,'evidenceInventory'>,typeof WHOLE_USER_TIMING_V9_POLICY>&{evidenceInventory:WholeCompactEvidenceInventory};
export type WholeUserTimingStudyV11=Policy<Omit<WholeUserTimingStudyV10,'evidenceInventory'>,typeof WHOLE_USER_TIMING_V11_POLICY>&{evidenceInventory:WholeClockLayoutEvidenceInventory};
export type WholeUserTimingStudyV10=Policy<WholeUserTimingStudyV9,typeof WHOLE_USER_TIMING_V10_POLICY>&{supportedLegacyFramePresented:number};

/** Length checks bound fixed-name comparisons independently of arbitrary names. */
function userTimingMark(event:AnnotationEventFragment,sequence:Sequence,resolved:ReturnType<typeof resolveAnnotations>,final:{outcome:string;definitions:readonly {value:string}[]}):{representation:WholeUserTimingCandidate['representation'];mark:{status:'absent'}|{status:'withheld';reason:string}|{status:'literal_string';value:string;annotationIndex:number|null};source?:'literal'|'intern';definitionIndex?:number}{
 const absent={representation:'withheld' as const,mark:{status:'absent' as const}},refuse=(reason:string)=>({representation:'withheld' as const,mark:{status:'withheld' as const,reason}}),e=event.fields;
 if(e.type!==undefined&&e.type!=='3')return absent;
 let count=e.categories?.length??0,blink=false;
 if((e.categoryIids?.length??0)>0&&!sequence.valid)return refuse('category-resolution-withheld');
 for(const name of e.categories??[])if(name.length===17&&name==='blink.user_timing')blink=true;
 for(const iid of e.categoryIids??[]){count++;const index=sequence.categories.get(iid);if(index===undefined)return refuse('category-resolution-withheld');const name=final.definitions[index]!.value;if(name.length===17&&name==='blink.user_timing')blink=true;}
 if(count===0)return refuse('missing-mark-category');
 if(!blink)return absent;
 if(count!==1)return refuse('ambiguous-mark-category');
 if(e.type===undefined)return refuse('missing-mark-type');
 if(resolved.markName.status==='withheld')return refuse(resolved.markName.reason);
 if(final.outcome!=='resolved')return refuse('event-resolution-withheld');
 const definitionIndex=e.nameIid===undefined?undefined:sequence.names.get(e.nameIid),name=e.nameIid===undefined?e.name:definitionIndex===undefined?undefined:final.definitions[definitionIndex]!.value;
 if(name===undefined||name.length===0)return refuse('missing-mark-event-name');
 const fixed=name.length===16&&name==='performance.mark',mark=resolved.markName;
 if(!fixed&&mark.status!=='absent')return refuse('ambiguous-mark-representation');
 if(fixed)return mark.status==='literal_string'?{representation:'annotation',mark}:refuse('missing-mark-name');
 return {representation:'event_name',mark:{status:'literal_string',value:name,annotationIndex:null},source:definitionIndex===undefined?'literal':'intern',...(definitionIndex===undefined?{}:{definitionIndex})};
}
function wholeCounters(){return {packets:0,processedPackets:0,decodedPackets:0,opaqueNoStatePackets:0,metadataPackets:0,trackEvents:0,eventsWithAnnotations:0,annotationEntries:0,resolvedRootInventories:0,withheldRootInventories:0,markAbsent:0,markLiteral:0,markWithheld:0,resets:0,losses:0,newDefinitions:0,repeatedDefinitions:0,defaultsVersions:0,disclosures:0,clockSnapshots:0,feedCalls:0};}
class WholeStudyBudget extends Budget {
 readonly usage={fields:0,repeated:0,updates:0,references:0,sequences:0,liveEntries:0,liveUTF8:0,historyDefinitions:0,defaultsVersions:0,disclosureGroups:0,candidateRows:0,candidateUTF8:0,persistentUTF8:0};
 constructor(){super('final-owned');}
 override fieldsVisited(n:number,i:number){super.fieldsVisited(n,i);this.usage.fields+=n;}
 override repeatedWork(n:number,i:number){super.repeatedWork(n,i);this.usage.repeated+=n;}
 override internUpdates(n:number,i:number){super.internUpdates(n,i);this.usage.updates+=n;}
 override categoryReferences(n:number,i:number){super.categoryReferences(n,i);this.usage.references+=n;}
 override liveInsert(v:string,i:number){super.liveInsert(v,i);this.usage.liveEntries++;this.usage.liveUTF8+=Buffer.byteLength(v);}
 override release(table:Map<string,number>,definitions:InternDefinition[]){super.release(table,definitions);for(const n of table.values()){this.usage.liveEntries--;this.usage.liveUTF8-=Buffer.byteLength(definitions[n]!.value);}}
 persist(v:string,i:number){const n=Buffer.byteLength(v);if(n>262144-this.usage.persistentUTF8)throw new ProfileError('persistent-string-capacity',i);this.usage.persistentUTF8+=n;}
}
// Private same-arity selector: 2 is V5 metadata-only UserTiming; booleans preserve older profiles.
type UserTimingMode=boolean|2|3;
type SequenceStart={raw:number;explained:number;unexplained:number;contradictions:number};
interface WholeMode {clock3?:ReturnType<typeof createClock3Projection>;rawDrop?:(index:number,fields:PacketFields,priorSeen:boolean)=>void;evidence?:{admit(clocks:number,index:number):void;retain(row:WholeClockEvidenceObservation):void};sequenceStart?:SequenceStart;userTiming:UserTimingMode;semantic:ReturnType<typeof createHash>;note(label:string,fields:readonly(string|number|boolean|null)[]):void;transition:{sequenceIndex:number|null;intervalVersion:number|null;defaultsVersionIndex:number|null;stateEffect:string;eventOutcome:string;newDefinitions:number;repeatedDefinitions:number};bodySHA256:string;budget:WholeStudyBudget;counters:ReturnType<typeof wholeCounters>;event(i:number,s:Sequence,f:PacketFields,at:Location,e:WholeFramePresentedEventFragment,r:ReturnType<typeof resolveAnnotations>,track:Selection,clock:Selection,final?:{outcome:string;definitions:readonly {value:string}[]}):void}
const WHOLE_REFUSALS=new Set(["unsupported-packet-payload-field-50","unsupported-packet-payload-field-133","unsupported-packet-payload-field-107","unsupported-packet-payload-field-124","unsupported-packet-payload-field-125","annotation-wrong-wire-type","byte-capacity","candidate-capacity","candidate-string-capacity","chunk-capacity","clock-child-capacity","defaults-capacity","definition-capacity","disclosure-capacity","duplicate-annotation-name-oneof","duplicate-annotation-proto-oneof","duplicate-annotation-value-oneof","duplicate-clock-id","duplicate-data-oneof","duplicate-intern-iid","duplicate-name-oneof","duplicate-selected-field","field-capacity","fragment-unavailable","frame-capacity","framer-closed","framer-reentry","input-byte-capacity","input-length","int32-overflow","intern-conflict","intern-entry-capacity","intern-update-capacity","invalid-annotation-iid","invalid-byte-window",envelopeError,"invalid-event-iid","invalid-field-number","invalid-framer-profile","invalid-intern-iid","invalid-internal-slice-mode","invalid-output-mode","invalid-utf8","invalid-whole-annotation-input","live-intern-entry-capacity","live-intern-string-capacity","manifest-capacity","member-capacity","missing-intern-definition","missing-intern-iid","missing-intern-name","missing-sequence-id","non-profile-bool","opaque-location-capacity","out-of-bounds-length","output-already-finalized","output-byte-capacity","output-node-capacity","output-string-capacity","packet-body-capacity","packet-capacity","persistent-string-capacity","read-capacity","reference-capacity","repeated-work-capacity",capacityError,"result-shape","selected-field-wrong-wire-type","sequence-capacity","stream-closed","stream-reentry","string-capacity","string-total-capacity","transition-capacity","truncated-fixed-field","truncated-varint","uint32-overflow","uint64-varint-overflow","unavailable-byte-storage","unexpected-body-end","unknown-selected-enum","unsupported-byte-view","unsupported-counter-defaults","unsupported-legacy-event","unsupported-packet-payload","unsupported-payload-kind",policyError,"unsupported-sequence-flags","unsupported-state-body-kind","unsupported-trace-root-field","unsupported-wire-type","zero-sequence-id"]as const);
export const WHOLE_ANNOTATION_AUTHORITY=Object.freeze({annotations:'diagnostic-only',orderedState:'diagnostic-only',clock:'not_evaluated',marks:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',metric:'not_evaluated',captureCompleteness:'unestablished',runtimeQualification:'unestablished',evaluationEligibility:false,nativeGO:false,nativeSupported:false,performance:false,scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'}as const);
/** Fixed whole-profile serialization admission, including every escaped key/value. */
function admitWholeOutput(value:unknown):void{
 const active=new Set<object>();
 let nodes=0,objects=0,utf8=0,bytes=1;
 function string(s:string){if(s.length>65536)throw new ProfileError(capacityError);utf8+=Buffer.byteLength(s);if(utf8>65536)throw new ProfileError(capacityError);bytes+=2;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<32)bytes+=c===8||c===9||c===10||c===12||c===13?2:6;else if(c===34||c===92)bytes+=2;else if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=55296&&c<=56319&&i+1<s.length&&s.charCodeAt(i+1)>=56320&&s.charCodeAt(i+1)<=57343){bytes+=4;i++;}else bytes+=c>=55296&&c<=57343?6:3;if(bytes>262144)throw new ProfileError(capacityError);}}
 function visit(v:unknown,depth:number,rootReader=false,observedReaderBytes=false){if(++nodes>32768||depth>16)throw new ProfileError(capacityError);if(v===null){bytes+=4;return;}if(typeof v==='boolean'){bytes+=v?4:5;return;}if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0||v>(observedReaderBytes?33554433:33554432))throw new ProfileError('result-shape');bytes+=String(v).length;return;}if(typeof v==='string'){string(v);return;}if(typeof v!=='object'||types.isProxy(v)||active.has(v)||++objects>4096)throw new ProfileError('result-shape');const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))throw new ProfileError('result-shape');active.add(v);const keys=Object.keys(v);if(keys.length>32768)throw new ProfileError(capacityError);if(array){const n=Object.getOwnPropertyDescriptor(v,'length')?.value;if(!Number.isInteger(n)||n!==keys.length||!keys.every((key,index)=>key===String(index)))throw new ProfileError('result-shape');}if(Reflect.ownKeys(v).length!==keys.length+(array?1:0))throw new ProfileError('result-shape');bytes+=2+Math.max(0,keys.length-1);for(const key of keys){if(!array){if(key.length>64)throw new ProfileError('result-shape');string(key);bytes++;}const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))throw new ProfileError('result-shape');visit(d.value,depth+1,depth===0&&key==='reader',rootReader&&key==='bytes');}active.delete(v);}
 visit(value,0);if(bytes>262144)throw new ProfileError(capacityError);
}
/** Whole-input synthetic diagnostic only. Physical evidence is unavailable here. */
export function createWholeAnnotationStudy(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_ANNOTATION_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,false) as StudyPort<WholeAnnotationStudy>;
}
/** Explicit source-shape inventory; no producer, clock or target authenticity. */
export function createWholeUserTimingStudy(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,true) as StudyPort<WholeUserTimingStudy>;
}
/** V3 alone retains a bounded first cause from the original semantic catch. */
export function createWholeUserTimingStudyV3(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V3_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,true,true) as StudyPort<WholeUserTimingStudyV3>;
}
/** Fixed single-provenance subset; all physical and semantic authority remains diagnostic. */
export function createWholeUserTimingStudyV4(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V4_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,true,true,true) as StudyPort<WholeUserTimingStudyV4>;
}
/** V5 validates ephemeral counter-default metadata; no counter values or state are interpreted. */
export function createWholeUserTimingStudyV5(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V5_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,2,true,true) as StudyPort<WholeUserTimingStudyV5>;
}
export function createWholeUserTimingStudyV6(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V6_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true) as StudyPort<WholeUserTimingStudyV6>;
}
export function createWholeUserTimingStudyV7(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V7_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true) as unknown as StudyPort<WholeUserTimingStudyV7>;
}
/** Opt-in raw header inventory before reset precedence, using the same decoder and reducer. */
export function createWholeUserTimingStudyV8(expectedBytes:number,policy:unknown) {
 if(policy!==WHOLE_USER_TIMING_V8_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true) as unknown as StudyPort<WholeUserTimingStudyV8>;
}
export function createNativeClock3PhaseStudy(expectedBytes:number,names:unknown,policy:unknown){
 if(policy!==NATIVE_CLOCK3_PHASE_POLICY)throw new WireError(policyError);
 const tuple=nativeClock3Names(names);if(!tuple)throw new WireError('invalid-mark-names');
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true,{names:tuple}) as StudyPort<NativeClock3StudyResult<typeof NATIVE_CLOCK3_PHASE_POLICY,Omit<WholeClockEvidenceInventory,'observations'>&{observations:WholeClockEvidenceObservation[]}>>;
}
type NativeClock3StudyResult<P,I>=Omit<ReturnType<ReturnType<typeof createWholeAnnotationEngine>['finish']>,'policy'|'evidenceInventory'>&{policy:P;evidenceInventory?:I};
export function createWholeUserTimingStudyV9(expectedBytes:number,policy:unknown){
 if(policy!==WHOLE_USER_TIMING_V9_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true,undefined,true) as unknown as StudyPort<WholeUserTimingStudyV9>;
}
export function createNativeClock3PhaseStudyV2(expectedBytes:number,names:unknown,policy:unknown){
 if(policy!==NATIVE_CLOCK3_PHASE_V2_POLICY)throw new WireError(policyError);
 const tuple=nativeClock3Names(names);if(!tuple)throw new WireError('invalid-mark-names');
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true,{names:tuple},true) as StudyPort<NativeClock3StudyResult<typeof NATIVE_CLOCK3_PHASE_V2_POLICY,WholeCompactEvidenceInventory>>;
}
export type ClosedStudyFailureCode=typeof WHOLE_REFUSALS extends Set<infer Code>?Code:never;
export function isClosedStudyFailureCode(value:unknown):value is ClosedStudyFailureCode{return typeof value==='string'&&value.length<=64&&WHOLE_REFUSALS.has(value as ClosedStudyFailureCode);}
const CLOCK_LAYOUT_WHOLE_SOURCE=Symbol('whole-clock-layout-v11');
export function createWholeUserTimingStudyV11(expectedBytes:number,policy:unknown){
 if(policy!==WHOLE_USER_TIMING_V11_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true,undefined,false,CLOCK_LAYOUT_WHOLE_SOURCE) as unknown as StudyPort<WholeUserTimingStudyV11>;
}
const FRAME_PRESENTED_WHOLE_SOURCE=Symbol('whole-frame-presented-r-v10');
export function createWholeUserTimingStudyV10(expectedBytes:number,policy:unknown){
 if(policy!==WHOLE_USER_TIMING_V10_POLICY)throw new WireError(policyError);
 return createWholeAnnotationEngine(expectedBytes,3,true,true,true,true,undefined,true,FRAME_PRESENTED_WHOLE_SOURCE) as unknown as StudyPort<WholeUserTimingStudyV10>;
}
function createWholeAnnotationEngine(expectedBytes:number,userTiming:UserTimingMode,diagnosticV3=false,provenance=false,evidenceV7=false,rawDropV8=false,clock3Config?:Clock3Config,compactV9=false,source?:typeof FRAME_PRESENTED_WHOLE_SOURCE|typeof CLOCK_LAYOUT_WHOLE_SOURCE){
 const rawDropFacts:WholeRawDropFact[]=[];
 const observations:WholeClockEvidenceObservation[]=[];let clockEntries=0;
 let supportedLegacyFramePresented=0;
 const decodeWholePacket=source===CLOCK_LAYOUT_WHOLE_SOURCE||source===FRAME_PRESENTED_WHOLE_SOURCE?createWholeFramePresentedPacketDecoder():provenance?createWholeProvenancePacketDecoder():diagnosticV3?decodeWholeUserTimingPacketV3:decodeWholeAnnotationPacket;
 if(!Number.isSafeInteger(expectedBytes)||expectedBytes<0||expectedBytes>33554432)throw new WireError('byte-capacity');
 const budget=new WholeStudyBudget(),counters=wholeCounters(),candidates:WholeAnnotationCandidate[]=[],anchors:(RootFrame&{bodyBytes:number;bodySHA256:string})[]=[];
 const compact=compactV9?createCompactEvidence(budget):undefined;
 const layout=source===CLOCK_LAYOUT_WHOLE_SOURCE?createClockLayoutEvidence(budget):undefined;
 const rawHash=createHash('sha256'),packetHash=createHash('sha256').update('D0 packet-manifest-v1\n'),transitionHash=createHash('sha256').update('whole-annotation-transitions-v1\n');
 let rawBytes=0,active=false,closed=false,rootFailed=false,semanticFailed=false,failure:string|null=null,body:Uint8Array|null=null,bodyAt=0,bodyHash=createHash('sha256'),withheld=false;
 const diagnostics:{code:string;packetIndex:number|null;component:string|null;cause?:string|null}[]=[];
 const projection=clock3Config?createClock3Projection(clock3Config,budget,()=>candidates.length,value=>admitWholeOutput({value,...(compact?{evidenceInventory:compact.inventory(true)}:{observations}),candidates,rawDropFacts})):undefined;
 function fail(code:string,index:number|null=null,component:string|null=null,cause?:unknown){projection?.discard();if(rawDropV8)rawDropFacts.length=0;if(evidenceV7){compact?.clear();layout?.clear();observations.length=0;candidates.length=0;}failure??=code;if(diagnostics.length===0)diagnostics.push({code,packetIndex:index,component,...(diagnosticV3?{cause:cause===undefined?null:isClosedStudyFailureCode(cause)?cause:'unavailable-code'}:{})});}
 function errorCode(e:unknown){return(e instanceof ProfileError||e instanceof WireError)&&isClosedStudyFailureCode(e.code)?e.code:'invalid-whole-annotation-input';}
 const mode:WholeMode={...(projection?{clock3:projection}:{}),...(rawDropV8?{rawDrop(index:number,fields:PacketFields,priorSeen:boolean){
  if(fields.previousPacketDropped===undefined||fields.previousPacketDropped==='0')return;
  if(rawDropFacts.length>=64)throw new ProfileError('invalid-whole-annotation-input',index);
  const row:WholeRawDropFact={packetIndex:index,bodySHA256:mode.bodySHA256,machineContext:fields.machineId===undefined?{status:'absent'}:{status:'present',machineId:fields.machineId},sequenceId:fields.sequenceId!,previousPacketDropped:fields.previousPacketDropped,...(fields.firstPacketOnSequence===undefined?{}:{firstPacketOnSequence:fields.firstPacketOnSequence}),...(fields.sequenceFlags===undefined?{}:{sequenceFlags:fields.sequenceFlags}),...(fields.incrementalStateCleared===undefined?{}:{incrementalStateCleared:fields.incrementalStateCleared}),priorSeen,classification:fields.previousPacketDropped==='1'&&fields.firstPacketOnSequence===true&&!priorSeen?'explained':'unexplained'};
  budget.repeatedWork(1,index);budget.persist(JSON.stringify(row),index);budget.output(row,index);
  // Pre-admit the retained arrays together under the existing node/string/JSON ceilings.
  // The complete study and owned-file envelope are checked again at final admission.
  admitWholeOutput({rawDropFacts:[...rawDropFacts,row],...(layout?{evidenceInventory:layout.inventory(true)}:compact?{evidenceInventory:compact.inventory(true),...(projection?{clock3Retained:projection.retained()}: {})}:{observations}),candidates});rawDropFacts.push(row);
 }}:{}),...(evidenceV7?{evidence:{admit(clocks:number,index:number){if(!layout&&!compact&&(observations.length>=128||clocks>512-clockEntries))throw new ProfileError('invalid-whole-annotation-input',index);},retain(row:WholeClockEvidenceObservation){projection?.stage(row,observations.length);if(layout){layout.retain(row,evidenceInventory=>admitWholeOutput({evidenceInventory,candidates,rawDropFacts}));return;}if(compact){compact.retain(row,evidenceInventory=>admitWholeOutput({evidenceInventory,candidates,rawDropFacts,...(projection?{clock3Retained:projection.retained()}: {})}));return;}budget.repeatedWork(1,row.packetIndex);budget.persist(JSON.stringify(row),row.packetIndex);observations.push(row);if(row.kind==='clock_snapshot')clockEntries+=row.clocks.length;}}}:{}),...(userTiming===3?{sequenceStart:{raw:0,explained:0,unexplained:0,contradictions:0}}:{}),userTiming,semantic:createHash('sha256'),note(label,fields){mode.semantic.update(label+'\n','ascii');for(const value of fields){if(typeof value==='string')mode.semantic.update('s'+Buffer.byteLength(value)+':','ascii').update(value,'utf8');else mode.semantic.update(value===null?'n;':typeof value==='boolean'?value?'t;':'f;':'i'+value+';','ascii');}mode.semantic.update('\n','ascii');},transition:{sequenceIndex:null,intervalVersion:null,defaultsVersionIndex:null,stateEffect:'O',eventOutcome:'A',newDefinitions:0,repeatedDefinitions:0},bodySHA256:'',budget,counters,event(i,sequence,fields,at,event,resolved,track,clock,final){
  counters.trackEvents++;counters.annotationEntries+=event.annotations.length;if(event.annotations.length)counters.eventsWithAnnotations++;
  if(resolved.nameInventoryStatus==='withheld'){counters.withheldRootInventories++;withheld=true;}else counters.resolvedRootInventories++;
  if(userTiming&&resolved.markName.status==='withheld')withheld=true;
  for(const annotation of resolved.annotations){budget.repeatedWork(1,i);const name=annotation.name as {kind:string;value?:string;definitionIndex?:number;reason?:string},value=annotation.value as {kind:string;value?:string;reason?:string};mode.note('root',[name.kind,name.value??null,name.definitionIndex??null,name.reason??null,value.kind,value.value??null,value.reason??null]);}
  if('legacy' in event){
   const e=event.fields,legacy=event.legacy;
   budget.repeatedWork(1+(e.categoryIids?.length??0),i);
   const nameIndex=e.nameIid===undefined?undefined:sequence.names.get(e.nameIid);
   const categories=(e.categoryIids??[]).map(iid=>{const index=sequence.categories.get(iid);return index===undefined?undefined:final!.definitions[index]?.value;});
   const annotationName=resolved.annotations[0]?.name as {kind:string;definitionIndex?:number}|undefined;
   const key=annotationName?.kind==='intern'&&annotationName.definitionIndex!==undefined?final!.definitions[annotationName.definitionIndex]?.value:undefined;
   if((source!==FRAME_PRESENTED_WHOLE_SOURCE&&source!==CLOCK_LAYOUT_WHOLE_SOURCE)||!sequence.valid||final?.outcome!=='resolved'||nameIndex===undefined||final.definitions[nameIndex]?.value!=='FramePresented'||categories.length!==2||!categories.includes('cc')||!categories.includes('benchmark')||resolved.nameInventoryStatus!=='resolved'||resolved.annotations.length!==1||key!=='environment'||event.annotations[0]?.stringValue!=='browser')throw new ProfileError('unsupported-legacy-event',i);
   if(supportedLegacyFramePresented>=counters.trackEvents||counters.trackEvents>counters.packets)throw new ProfileError('invalid-whole-annotation-input',i);
   supportedLegacyFramePresented++;
   const commitment=[legacy.kind,legacy.phase,legacy.bodyStart,legacy.bodyEnd,legacy.phaseStart,legacy.phaseValueStart,legacy.phaseEnd,'FramePresented',...categories,'environment','browser'] as (string|number)[];
   budget.persist(JSON.stringify(commitment),i);mode.note('supported-legacy-frame-presented-r',commitment);
  }
  const selectedMark=userTiming?userTimingMark(event,sequence,resolved,final!):undefined;
  const mark=selectedMark?.mark??resolved.markName;projection?.event(i,mode.bodySHA256,event,sequence,final!,track,mark);mode.note('mark',[resolved.nameInventoryStatus,mark.status,mark.status==='literal_string'?mark.value:mark.status==='withheld'?mark.reason:null]);if(mark.status==='absent'){counters.markAbsent++;return;}if(mark.status==='withheld'){counters.markWithheld++;withheld=true;}else counters.markLiteral++;
  projection?.admitMark();if(candidates.length>=128)throw new ProfileError('candidate-capacity',i);
  const value=mark.status==='literal_string'?mark.value:null,n=value===null?0:Buffer.byteLength(value);if(n>4096||n>16384-budget.usage.candidateUTF8)throw new ProfileError('candidate-string-capacity',i);
  const selected=mark.status==='literal_string'&&mark.annotationIndex!==null?resolved.annotations[mark.annotationIndex]?.name as {kind:string;definitionIndex?:number}|undefined:undefined;
  const row:WholeAnnotationCandidate={packetIndex:i,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,eventStart:at.start,eventValueStart:at.valueStart,eventEnd:at.end,bodySHA256:mode.bodySHA256,kind:mark.status,value,reason:mark.status==='withheld'?mark.reason:null,annotationIndex:mark.status==='literal_string'?mark.annotationIndex:null,nameSource:selectedMark?.source??(selected?.kind==='intern'?'intern':selected?.kind==='literal'?'literal':'unresolved'),definitionIndex:selectedMark?.definitionIndex??selected?.definitionIndex??null,clockId:clock.status==='selected'?clock.clockId??null:null,clockSource:clock.status==='selected'?clock.source:'unavailable',trackUuid:track.status==='selected'?track.trackUuid??null:null,trackSource:track.status==='selected'?track.source:'unavailable',machineStatus:fields.machineId===undefined?'absent':'present',machineId:fields.machineId??null,sequenceId:sequence.sequenceId,rawTimestamp:fields.timestamp??null,timestampStatus:fields.timestamp===undefined?'absent':'raw-unqualified'};
  if(userTiming)(row as WholeUserTimingCandidate).representation=selectedMark!.representation;
  budget.persist((value??'')+(row.clockId??'')+(row.trackUuid??'')+(row.machineId??'')+sequence.sequenceId+(row.rawTimestamp??''),i);budget.usage.candidateUTF8+=n;budget.usage.candidateRows++;candidates.push(row);
 }};
 const reducer=createOrderedReducer('whole-source-ordered-annotations-v1',[],budget,true,undefined,true,mode);
 const framer=new TraceRootFramer(expectedBytes,131072,262144,{
  start(frame){bodyHash=createHash('sha256');bodyAt=0;body=semanticFailed?null:new Uint8Array(frame.bodyEnd-frame.bodyStart);},
  body(piece){bodyHash.update(piece);if(body){body.set(piece,bodyAt);bodyAt+=piece.byteLength;}},
  end(frame){const sha=bodyHash.digest('hex'),n=frame.bodyEnd-frame.bodyStart,record=`${frame.frameIndex},${frame.keyStart},${frame.keyEnd},${frame.lengthStart},${frame.lengthEnd},${frame.bodyStart},${frame.bodyEnd},${n},${sha}\n`;if(record.length>192)throw new WireError('manifest-capacity');packetHash.update(record,'ascii');counters.packets++;if(anchors.length<64)anchors.push({...frame,bodyBytes:n,bodySHA256:sha});const current=body;body=null;if(semanticFailed||!current)return;
   try{const packet=decodeWholePacket(current,n=>budget.repeatedWork(n,frame.frameIndex));counters.decodedPackets++;if(packet.status==='unavailable')throw new ProfileError('fragment-unavailable',frame.frameIndex,'packet',packet.diagnostics[0]?.code);mode.bodySHA256=sha;reducer.consume(frame.frameIndex,packet);counters.processedPackets++;const state=reducer.state();Object.assign(budget.usage,state);const t=mode.transition,transition=`${frame.frameIndex},${t.sequenceIndex??'-'},${t.intervalVersion??'-'},${t.stateEffect},${t.defaultsVersionIndex??'-'},${t.newDefinitions},${t.repeatedDefinitions},${t.eventOutcome},${counters.markLiteral},${counters.markWithheld},${mode.semantic.digest('hex')},${sha}\n`;if(transition.length>192)throw new ProfileError('transition-capacity');transitionHash.update(transition,'ascii');}catch(e){semanticFailed=true;fail(errorCode(e),frame.frameIndex,e instanceof ProfileError?e.component??null:null,e instanceof ProfileError?e.causeCode:undefined);}
  },
 });
 return Object.freeze({feed(input:unknown):void{if(active){rootFailed=true;fail('stream-reentry');throw new WireError('stream-reentry');}if(closed)throw new WireError('stream-closed');active=true;try{if(counters.feedCalls>=4096)throw new WireError('read-capacity');counters.feedCalls++;const owned=copyWholeAnnotationChunk(input);if(owned.byteLength>expectedBytes-rawBytes)throw new WireError('byte-capacity');rawHash.update(owned);rawBytes+=owned.byteLength;if(!rootFailed)framer.feed(owned);}catch(e){rootFailed=true;body=null;fail(errorCode(e));}finally{active=false;}},finish(){if(active||closed)throw new WireError('stream-closed');closed=true;let boundary=false;if(!rootFailed)try{framer.finish();boundary=true;}catch(e){rootFailed=true;fail(errorCode(e));}if(rawBytes!==expectedBytes){boundary=false;fail('input-length');}if(mode.sequenceStart)try{budget.repeatedWork(1,0);transitionHash.update('sequence-start-v6:'+JSON.stringify(mode.sequenceStart)+'\n','ascii');}catch(e){fail(errorCode(e));}let good=failure===null&&!semanticFailed&&!rootFailed;let projected:ReturnType<ReturnType<typeof createClock3Projection>['finish']>|undefined;if(projection)try{projected=projection.finish(good,candidates,observations,compact?()=>compact.rows():undefined);}catch(e){fail(errorCode(e));good=false;projected={reason:'clock3-core-unavailable',projection:null};}const result={...(projected?{clock3Projection:projected}:{}),...(rawDropV8?{rawDropInventory:good?{status:'complete-supported-header-declarations' as const,facts:rawDropFacts,nonzeroDeclarations:rawDropFacts.length,explainedDeclarations:rawDropFacts.filter(row=>row.classification==='explained').length,unexplainedDeclarations:rawDropFacts.filter(row=>row.classification==='unexplained').length,contradictoryDeclarations:0}:unavailableRawDropInventory()}:{}),...(evidenceV7?{evidenceInventory:layout?layout.inventory(good):compact?compact.inventory(good):{status:good?'complete-supported-observations' as const:'unavailable' as const,observations:good?observations:[]}}:{}),...(mode.sequenceStart?{sequenceStart:mode.sequenceStart}:{}),...(source===CLOCK_LAYOUT_WHOLE_SOURCE||source===FRAME_PRESENTED_WHOLE_SOURCE?{supportedLegacyFramePresented}:{}),policy:source===CLOCK_LAYOUT_WHOLE_SOURCE?WHOLE_USER_TIMING_V11_POLICY:source===FRAME_PRESENTED_WHOLE_SOURCE?WHOLE_USER_TIMING_V10_POLICY:compact?clock3Config?NATIVE_CLOCK3_PHASE_V2_POLICY:WHOLE_USER_TIMING_V9_POLICY:clock3Config?NATIVE_CLOCK3_PHASE_POLICY:rawDropV8?WHOLE_USER_TIMING_V8_POLICY:evidenceV7?WHOLE_USER_TIMING_V7_POLICY:userTiming===3?WHOLE_USER_TIMING_V6_POLICY:userTiming===2?WHOLE_USER_TIMING_V5_POLICY:provenance?WHOLE_USER_TIMING_V4_POLICY:diagnosticV3?WHOLE_USER_TIMING_V3_POLICY:userTiming?WHOLE_USER_TIMING_POLICY:WHOLE_ANNOTATION_POLICY,status:good?'whole-annotation-study' as const:'unavailable' as const,reason:failure,inputRef:{bytes:rawBytes,sha256:rawHash.digest('hex')},framingBoundaryComplete:boundary,physicalEOF:false as const,structuralContainerEOF:false as const,semanticProcessing:good?'complete-supported-schema':'unavailable',markInventoryAdmission:good?withheld?'withheld':'resolved-supported-roots':'not_evaluated',counters,budgets:budget.usage,packetManifestSHA256:packetHash.digest('hex'),transitionManifestSHA256:transitionHash.digest('hex'),anchors,candidates:good?candidates:[],diagnostics,authority:WHOLE_ANNOTATION_AUTHORITY};body=null;try{admitWholeOutput(result);}catch(e){fail(errorCode(e));result.status='unavailable';result.reason=failure;result.semanticProcessing='unavailable';result.markInventoryAdmission='not_evaluated';result.candidates=[];if(result.clock3Projection)result.clock3Projection={reason:'clock3-core-unavailable',projection:null};if(result.evidenceInventory)result.evidenceInventory=layout?layout.inventory(false):compact?compact.inventory(false):{status:'unavailable',observations:[]};if(result.rawDropInventory)result.rawDropInventory=unavailableRawDropInventory();admitWholeOutput(result);}compact?.releaseKeys();layout?.releaseKeys();return freezeOwned(result);}});
}

/** Bounded owned-JSON structure guard; not a closed-schema/source authenticator. */
export function finishWholeAnnotationOutput<T>(value:T):T{admitWholeOutput(value);return freezeOwned(value);}
