import { createHash } from 'node:crypto';
import { copyBody, WireError } from './browser-frame-protobuf-wire.js';
import { decodeBrowserFramePacket, PACKET_POLICY, PACKET_SOURCE, type PacketFields } from './browser-frame-packet-fragments.js';
import { decodeBrowserFrameStateBody, STATE_BODY_POLICY } from './browser-frame-state-fragments.js';
export const ORDERED_STATE_POLICY = 'ordered-manual-browser-frame-state-v1';
const LABELS = Object.freeze({ normalizationCapability: 'ordered-manual-name-state-only', clockAdmission: 'not_evaluated', captureOrder: 'caller_declared', runtimeQualification: 'unestablished', sourceCoverage: 'unestablished', evaluationEligibility: false, scoringEligibility: false, rankingEligibility: false } as const);
class ProfileError extends Error {
  constructor(readonly code: string, readonly packetIndex?: number, readonly component?: string, readonly causeCode?: string) { super(code); }
}
interface Sequence { sequenceIndex: number; sequenceId: string; machineId?: string; valid: boolean; intervalVersion: number; defaultsVersionIndex: number | null; names:Map<string,number>;categories:Map<string,number> }
interface Location { packetIndex: number; scope: string; fieldNumber: number; wireType: number; start: number; valueStart: number; end: number }
interface DefaultFields { timestampClockId?: string; trackEventDefaultsPresent?: true; trackUuid?: string }
interface DefaultVersion { versionIndex: number; sequenceIndex: number; intervalVersion: number; packetIndex: number; location: Location; fields: DefaultFields }
interface InternDefinition { definitionIndex:number;sequenceIndex:number;intervalVersion:number;table:'event_categories'|'event_names';iid:string;value:string;definedAt:Location }
type Selection = {status:'selected';source:'packet'|'event'|'defaults';clockId?:string;trackUuid?:string;defaultsVersionIndex?:number} | {status:'unavailable';reason:string};
interface EventFact { eventIndex: number; packetIndex: number; sequenceIndex: number; intervalVersion: number; defaultsVersionIndex: number|null; location: Location; name?: {kind:'literal';value:string} | {kind:'intern';definitionIndex:number}; literalCategories?: string[]; internedCategoryDefinitionIndexes?:number[]; type?: string; trackSelection: Selection; typedArgumentKinds:string[] }
interface PacketFact { packetIndex: number; sequenceIndex: number; fields: PacketFields; valid: boolean; intervalVersion: number; stateEffect: 'none' | 'reset' | 'loss'; defaultsVersionIndex: number | null; clockSelection:Selection; eventOutcome:'absent'|'resolved'|'withheld_dependency'|'withheld_intern_invalid';eventIndex?:number;eventLocation?:Location;internLocation?:Location;internUpdateOutcome:'absent'|'applied'|'withheld_invalid';internNewDefinitions:number;internRepeatedDefinitions:number }
interface BodyFact {packetIndex:number;bytes:number;sha256:string}
interface SequenceFact {sequenceIndex:number;sequenceId:string;machineId?:string;valid:boolean;intervalVersion:number}
export interface OrderedStateProjection extends Readonly<typeof LABELS> {
  status:'projected_ordered_manual_state';domain:string;source:typeof PACKET_SOURCE;
  bodies:readonly BodyFact[];sequences:readonly SequenceFact[];defaultsVersions:readonly DefaultVersion[];internDefinitions:readonly InternDefinition[];
  packets:readonly PacketFact[];events:readonly EventFact[];opaqueLocations:readonly Location[];
}
export interface OrderedStateUnavailable {status:'unavailable';diagnostics:readonly {code:string;packetIndex?:number;component?:string;cause?:string}[]}
function select(sequence:Sequence, versions:DefaultVersion[], explicit:string|undefined, kind:'clock'|'track'):Selection {
  const value = sequence.defaultsVersionIndex === null ? undefined : versions[sequence.defaultsVersionIndex]?.fields;
  if (explicit !== undefined && (kind==='track'||explicit!=='0')) return {status:'selected',source:kind==='clock'?'packet':'event',...(kind==='clock'?{clockId:explicit}:{trackUuid:explicit})};
  const fallback = kind==='clock'?value?.timestampClockId:value?.trackUuid;
  if (sequence.valid && fallback !== undefined && (kind==='track'||fallback!=='0')) return {status:'selected',source:'defaults',...(kind==='clock'?{clockId:fallback}:{trackUuid:fallback}),defaultsVersionIndex:sequence.defaultsVersionIndex!};
  return {status:'unavailable',reason:!sequence.valid && sequence.defaultsVersionIndex!==null?'invalid_sequence_default_state':`no_explicit_or_valid_default_${kind}`};
}
class Budget {
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
    if(++this.nodes>262144)throw new ProfileError('output-node-capacity',index);
    if(typeof value==='string'){
      if((this.strings+=Buffer.byteLength(value,'utf8'))>524288)throw new ProfileError('output-string-capacity',index);
    }else if(value!==null&&typeof value==='object'){
      // Owned JSON-safe rows only. This is not a traversal of arbitrary caller objects.
      for(const item of Object.values(value))this.output(item,index);
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
  if (input === null || typeof input !== 'object' || ![null,Object.prototype].includes(Object.getPrototypeOf(input))) throw new ProfileError('invalid-envelope');
  const fields = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(fields).length !== 2 || !fields.domain || !fields.packets || !Object.hasOwn(fields.domain,'value') || !Object.hasOwn(fields.packets,'value')) throw new ProfileError('invalid-envelope');
  const domain: unknown = fields.domain.value; const source: unknown = fields.packets.value;
  if (typeof domain !== 'string' || !/^[\x20-\x7e]{1,128}$/.test(domain) || !Array.isArray(source) || Object.getPrototypeOf(source) !== Array.prototype) throw new ProfileError('invalid-envelope');
  const length: unknown = Object.getOwnPropertyDescriptor(source,'length')?.value;
  if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) throw new ProfileError('invalid-envelope');
  if (length > 1024) throw new ProfileError('packet-capacity');
  const entries = Object.getOwnPropertyDescriptors(source);
  if (Reflect.ownKeys(entries).length !== length + 1) throw new ProfileError('invalid-envelope');
  const packets: Uint8Array[] = []; let bytes = 0;
  for (let index=0;index<length;index++) {
    const entry = entries[String(index)];
    if (!entry || !Object.hasOwn(entry,'value')) throw new ProfileError('invalid-envelope');
    let owned: Uint8Array;
    try { owned = copyBody(entry.value); }
    catch (error) { throw new ProfileError(error instanceof WireError && ['unsupported-byte-view','unavailable-byte-storage','byte-capacity'].includes(error.code) ? error.code : 'invalid-ordered-state-input',index); }
    if ((bytes += owned.byteLength) > 4194304) throw new ProfileError('input-byte-capacity',index);
    packets.push(owned);
  }
  return { domain,packets };
}
/** Caller-declared standalone bodies; no capture ordering, EOF or clock authority. */
export function projectOrderedBrowserFrameState(input: unknown, policy: unknown): OrderedStateProjection | OrderedStateUnavailable {
  try {
    if (policy !== ORDERED_STATE_POLICY) throw new ProfileError('unsupported-policy');
    const own = preflight(input);
    const budget=new Budget();
    budget.output({status:'projected_ordered_manual_state',domain:own.domain,source:PACKET_SOURCE,bodies:[],sequences:[],defaultsVersions:[],internDefinitions:[],packets:[],events:[],opaqueLocations:[],...LABELS});
    const bodies=own.packets.map((bytes,packetIndex)=>{const row={packetIndex,bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};budget.output(row,packetIndex);return row;});
    const sequences: Sequence[] = []; const byKey = new Map<string,Sequence>(); const packets: PacketFact[] = [];
    const defaultsVersions:DefaultVersion[]=[];const events:EventFact[]=[];const opaqueLocations:Location[]=[];const internDefinitions:InternDefinition[]=[];
    const opaqueKeys=new Set<string>();
    function opaque(row:Location):void{
      const key=JSON.stringify([row.packetIndex,row.scope,row.fieldNumber,row.wireType,row.start,row.valueStart,row.end]);
      if(opaqueKeys.has(key))return;
      if(opaqueLocations.length>=8192)throw new ProfileError('opaque-location-capacity',row.packetIndex);
      budget.output(row,row.packetIndex);opaqueKeys.add(key);opaqueLocations.push(row);
    }
    for (let packetIndex=0;packetIndex<own.packets.length;packetIndex++) {
      const fragment = decodeBrowserFramePacket(own.packets[packetIndex],PACKET_POLICY);
      if (fragment.status === 'unavailable') throw new ProfileError('fragment-unavailable',packetIndex,'packet',fragment.diagnostics[0]?.code);
      budget.fieldsVisited(fragment.occurrences.length,packetIndex);
      budget.repeatedWork((fragment.event?.fields.categoryIids?.length??0)+(fragment.event?.fields.categories?.length??0)+(fragment.event?.graphics?.fields.surfaceTraceIds?.length??0),packetIndex);
      const fields = fragment.fields;
      if (fields.sequenceId === undefined) throw new ProfileError('missing-sequence-id',packetIndex);
      if (fields.sequenceId === '0') throw new ProfileError('zero-sequence-id',packetIndex);
      const key = `${fields.machineId === undefined ? 'absent' : 'present:'+fields.machineId}:${fields.sequenceId}`;
      let sequence = byKey.get(key);
      if (!sequence) {
        if (sequences.length >= 64) throw new ProfileError('sequence-capacity',packetIndex);
        sequence = {sequenceIndex:sequences.length,sequenceId:fields.sequenceId,...(fields.machineId===undefined?{}:{machineId:fields.machineId}),valid:false,intervalVersion:0,defaultsVersionIndex:null,names:new Map(),categories:new Map()};
        sequences.push(sequence);byKey.set(key,sequence);
      }
      const flags = BigInt(fields.sequenceFlags ?? '0');
      if (flags > 3n) throw new ProfileError('unsupported-sequence-flags',packetIndex);
      let stateEffect: PacketFact['stateEffect'] = 'none';
      if (fields.incrementalStateCleared === true || (flags & 1n) !== 0n) {
        stateEffect='reset';sequence.intervalVersion++;sequence.valid=true;sequence.defaultsVersionIndex=null;budget.release(sequence.names,internDefinitions);budget.release(sequence.categories,internDefinitions);sequence.names.clear();sequence.categories.clear();
      } else if (fields.previousPacketDropped !== undefined && fields.previousPacketDropped !== '0') {
        stateEffect='loss';sequence.intervalVersion++;sequence.valid=false;
      }
      for(const at of fragment.skippedFields)opaque({packetIndex,...at});
      for(const at of fragment.opaquePayloads)if(![12,59].includes(at.fieldNumber))opaque({packetIndex,...at});
      const defaultAt=fragment.opaquePayloads.find(at=>at.fieldNumber===59);
      if(defaultAt){
        const decoded=decodeBrowserFrameStateBody(fragment.bodyBytes.slice(defaultAt.valueStart,defaultAt.end),'defaults',STATE_BODY_POLICY);
        if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'defaults',decoded.diagnostics[0]?.code);
        budget.fieldsVisited(decoded.occurrences.length,packetIndex);
        const child=decoded.fields.trackEventDefaults;
        budget.repeatedWork((child?.counterTrackUuids?.length??0)+(child?.doubleCounterTrackUuids?.length??0),packetIndex);
        if(child?.counterTrackUuids!==undefined||child?.doubleCounterTrackUuids!==undefined)throw new ProfileError('unsupported-counter-defaults',packetIndex);
        const value:DefaultFields={...(decoded.fields.timestampClockId===undefined?{}:{timestampClockId:decoded.fields.timestampClockId}),...(child===undefined?{}:{trackEventDefaultsPresent:true as const,...(child.trackUuid===undefined?{}:{trackUuid:child.trackUuid})})};
        sequence.defaultsVersionIndex=defaultsVersions.length;
        const version={versionIndex:defaultsVersions.length,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,packetIndex,location:{packetIndex,...defaultAt},fields:value};budget.output(version,packetIndex);defaultsVersions.push(version);
        for(const at of decoded.skippedFields)opaque({packetIndex,...at,start:at.start+defaultAt.valueStart,valueStart:at.valueStart+defaultAt.valueStart,end:at.end+defaultAt.valueStart});
      }
      const fact:PacketFact={packetIndex,sequenceIndex:sequence.sequenceIndex,fields:{...fields},valid:sequence.valid,intervalVersion:sequence.intervalVersion,stateEffect,defaultsVersionIndex:sequence.defaultsVersionIndex,clockSelection:select(sequence,defaultsVersions,fields.timestampClockId,'clock'),eventOutcome:'absent',internUpdateOutcome:'absent',internNewDefinitions:0,internRepeatedDefinitions:0};
      const internAt=fragment.opaquePayloads.find(at=>at.fieldNumber===12);
      if(internAt){
        fact.internLocation={packetIndex,...internAt};
        const decoded=decodeBrowserFrameStateBody(fragment.bodyBytes.slice(internAt.valueStart,internAt.end),'interned_names',STATE_BODY_POLICY);
        if(decoded.status==='unavailable')throw new ProfileError('fragment-unavailable',packetIndex,'interned_names',decoded.diagnostics[0]?.code);
        budget.fieldsVisited(decoded.occurrences.length,packetIndex);budget.repeatedWork(decoded.fields.entries?.length??0,packetIndex);budget.internUpdates(decoded.fields.entries?.length??0,packetIndex);
        for(const at of decoded.skippedFields)opaque({packetIndex,...at,start:at.start+internAt.valueStart,valueStart:at.valueStart+internAt.valueStart,end:at.end+internAt.valueStart});
        fact.internUpdateOutcome=sequence.valid?'applied':'withheld_invalid';
        const locations=decoded.occurrences.filter(at=>at.scope==='interned_data'&&(at.fieldNumber===1||at.fieldNumber===2));
        if(sequence.valid)for(const [index,entry] of (decoded.fields.entries??[]).entries()){
          const table=entry.table==='event_names'?sequence.names:sequence.categories;
          const previous=table.get(entry.iid);
          if(previous!==undefined){
            if(internDefinitions[previous]!.value!==entry.name)throw new ProfileError('intern-conflict',packetIndex);
            fact.internRepeatedDefinitions++;
          }else{
            if(internDefinitions.length>=8192)throw new ProfileError('definition-capacity',packetIndex);
            budget.liveInsert(entry.name,packetIndex);
            const at=locations[index]!;
            const definitionIndex=internDefinitions.length;
            const definition={definitionIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,table:entry.table,iid:entry.iid,value:entry.name,definedAt:{packetIndex,...at,start:at.start+internAt.valueStart,valueStart:at.valueStart+internAt.valueStart,end:at.end+internAt.valueStart}};
            budget.output(definition,packetIndex);table.set(entry.iid,definitionIndex);internDefinitions.push(definition);
            fact.internNewDefinitions++;
          }
        }
      }
      const eventAt=fragment.occurrences.find(at=>at.scope==='packet'&&at.fieldNumber===11);
      if(fragment.event&&eventAt){
        fact.eventLocation={packetIndex,...eventAt};
        const e=fragment.event.fields;
        if(e.nameIid==='0'||e.categoryIids?.some(iid=>iid==='0'))throw new ProfileError('invalid-event-iid',packetIndex);
        if(!sequence.valid&&(flags&2n)!==0n)fact.eventOutcome='withheld_dependency';
        else if(!sequence.valid&&(e.nameIid!==undefined||(e.categoryIids?.length??0)>0))fact.eventOutcome='withheld_intern_invalid';
        else{
          budget.categoryReferences(e.categoryIids?.length??0,packetIndex);
          const lookup=(iid:string,table:Map<string,number>):number=>{const definitionIndex=table.get(iid);if(definitionIndex===undefined)throw new ProfileError('missing-intern-definition',packetIndex);return definitionIndex;};
          const name=e.nameIid===undefined?(e.name===undefined?undefined:{kind:'literal' as const,value:e.name}):{kind:'intern' as const,definitionIndex:lookup(e.nameIid,sequence.names)};
          const refs=e.categoryIids?.map(iid=>lookup(iid,sequence.categories));
          fact.eventOutcome='resolved';fact.eventIndex=events.length;
          const row={eventIndex:events.length,packetIndex,sequenceIndex:sequence.sequenceIndex,intervalVersion:sequence.intervalVersion,defaultsVersionIndex:sequence.defaultsVersionIndex,location:{packetIndex,...eventAt},...(name===undefined?{}:{name}),...(e.categories===undefined?{}:{literalCategories:e.categories}),...(refs===undefined?{}:{internedCategoryDefinitionIndexes:refs}),...(e.type===undefined?{}:{type:e.type}),trackSelection:select(sequence,defaultsVersions,e.trackUuid,'track'),typedArgumentKinds:[...(fragment.event.reporter2?['reporter2']:[]),...(fragment.event.graphics?['graphics']:[])]};budget.output(row,packetIndex);events.push(row);
        }
        for(const at of fragment.occurrences)if(at.scope==='track_event'&&(at.fieldNumber===1052||at.fieldNumber===1075))opaque({packetIndex,...at});
      }
      budget.output(fact,packetIndex);packets.push(fact);
    }
    const sequenceRows=sequences.map(s=>{const row={sequenceIndex:s.sequenceIndex,sequenceId:s.sequenceId,...(s.machineId===undefined?{}:{machineId:s.machineId}),valid:s.valid,intervalVersion:s.intervalVersion};budget.output(row);return row;});
    const result:OrderedStateProjection={ status:'projected_ordered_manual_state',domain:own.domain,source:PACKET_SOURCE,bodies,sequences:sequenceRows,defaultsVersions,internDefinitions,packets,events,opaqueLocations:opaqueLocations.sort((a,b)=>a.packetIndex-b.packetIndex||a.start-b.start||a.end-b.end),...LABELS };
    // Final admission cap; bounded JSON serialization may transiently exceed it.
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>4194304)throw new ProfileError('output-byte-capacity');
    return freezeOwned(result);
  } catch (error) {
    return freezeOwned({status:'unavailable',diagnostics:[{code:error instanceof ProfileError ? error.code : 'invalid-ordered-state-input',...(error instanceof ProfileError && error.packetIndex !== undefined ? {packetIndex:error.packetIndex}: {}),...(error instanceof ProfileError && error.component!==undefined?{component:error.component}:{}),...(error instanceof ProfileError && error.causeCode!==undefined?{cause:error.causeCode}:{})}]});
  }
}
