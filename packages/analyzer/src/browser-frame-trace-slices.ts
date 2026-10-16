import {createHash} from 'node:crypto';
import {copyBody,WireError} from './browser-frame-protobuf-wire.js';
import {decodeBrowserFrameTraceForSlices} from './browser-frame-trace-ingress.js';
import {Budget,ProfileError,projectOwnedBrowserFrameSliceState,type RestrictedOrderedBuild,type RestrictedEventInput} from './browser-frame-ordered-state.js';
import type {PayloadFields,PayloadMember} from './browser-frame-protobuf-fragments.js';
import type {SliceTraceFrame} from './browser-frame-trace-ingress.js';
type Location=RestrictedEventInput['eventLocation'];
type ScalarValue=string|boolean|{value:number;name:string};
export interface TypedOccurrence {
 typedIndex:number;rawEventIndex:number;packetIndex:number;packetBodySha256:string;kind:'reporter2'|'graphics';eventLocation:Location;payloadLocation:Location;
 fields:PayloadFields;presentFieldNumbers:number[];
 fieldOccurrences:{occurrenceIndex:number;parentOccurrenceIndex?:number;location:Location;selectedPath?:string;selectedValue?:ScalarValue}[];
 members:PayloadMember[];
}
export interface RawEvent extends Omit<RestrictedEventInput,'event'> {
 machineContext:{status:'absent'}|{status:'present';machineId:string};packetBodySha256:string;
 fields:RestrictedEventInput['event']['fields'];presentFieldNumbers:number[];
 nameResolution:{status:'absent'}|{status:'resolved';value:string;source:'literal'|'intern';definitionIndex?:number}|{status:'unavailable';reason:string};
 typedIndexes:number[];pairingDisposition:'begin_candidate'|'end_candidate'|'instant_only'|'unsupported_profile'|'withheld';reasons:string[];barrierIndexes:number[];
}
export interface RestrictedSlice {
 sliceIndex:number;beginRawEventIndex:number;endRawEventIndex?:number;
 /** First-seen diagnostic family ordinal; identity remains on the BEGIN RawEvent. */
 familyIndex:number;sequenceIndex:number;intervalVersion:number;parentSliceIndex?:number;depth:number;beginTypedIndexes:number[];
 status:'matched_restricted_structure'|'open_at_supplied_eof'|'interrupted'|'withheld_family';reasons:string[];
}
export interface PairingBarrier {barrierIndex:number;atPacketIndex:number;rawEventIndex?:number;scope:'family'|'writer_interval';familyIndex?:number;sequenceIndex:number;intervalVersion:number;reason:string;affectedOpenSliceIndexes:number[]}
export const TRACE_SLICES_POLICY = 'whole-supplied-browser-frame-restricted-slices-v1';
const LABELS={profile:'single-observed-writer-source-ordered-nonzero-track-unnamed-end-v1',pairingCapability:'conditional-source-order-structure-only',nativePairingQualified:false,performanceEligibility:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,nativeSupported:false,captureCompleteness:'unestablished',sourceCoverage:'unestablished',runtimeQualification:'unestablished',targetLifetime:'unestablished',associationStatus:'unestablished',clockAdmission:'not_evaluated'} as const;
function freezeOwned<T>(value:T):T {
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeOwned(child);Object.freeze(value);}return value;
}
function requireEnclosed(at:Location,parent:Location):void {
 if(![at.start,at.valueStart,at.end].every(Number.isSafeInteger)||at.start<parent.valueStart||at.valueStart<at.start||at.end<at.valueStart||at.end>parent.end||at.packetIndex!==parent.packetIndex)throw new ProfileError('source-location-mismatch',at.packetIndex);
}
const REPORTER_PATHS:Partial<Record<number,keyof PayloadFields>>={1:'state',3:'frameSource',4:'frameSequence',10:'hasMissingContent',11:'hostId',13:'frameType',15:'checkerboardedNeedsRaster',16:'checkerboardedNeedsRecord',17:'surfaceTraceId',18:'displayTraceId'};
const GRAPHICS_PATHS:Partial<Record<number,keyof PayloadFields>>={1:'step',2:'frameSinkId',3:'displayTraceId',8:'surfaceTraceIds',10:'surfaceTraceId'};
function retainEvents(build:RestrictedOrderedBuild,frames:readonly SliceTraceFrame[],budget:Budget):{rawEvents:RawEvent[];typedOccurrences:TypedOccurrence[]} {
 const rawEvents:RawEvent[]=[],typedOccurrences:TypedOccurrence[]=[];
 for(const source of build.rawEventInputs){
  budget.repeatedWork(1,source.packetIndex);
  const {event,...context}=source,frame=frames[source.packetIndex]!;
  const nameFact=source.orderedEventIndex===undefined?undefined:build.ordered.events[source.orderedEventIndex]?.name;
  let nameResolution:RawEvent['nameResolution'];
  if(source.resolution!=='resolved')nameResolution={status:'unavailable',reason:source.resolution};
  else if(nameFact===undefined)nameResolution={status:'absent'};
  else if(nameFact.kind==='literal')nameResolution={status:'resolved',value:nameFact.value,source:'literal'};
  else nameResolution={status:'resolved',source:'intern',definitionIndex:nameFact.definitionIndex,value:build.ordered.internDefinitions[nameFact.definitionIndex]!.value};
  const machineId=frame.packet.fields.machineId;
  const raw:RawEvent={...context,machineContext:machineId===undefined?{status:'absent'}:{status:'present',machineId},packetBodySha256:frame.bodySha256,fields:event.fields,presentFieldNumbers:event.presentFieldNumbers,nameResolution,typedIndexes:[],pairingDisposition:'withheld',reasons:[],barrierIndexes:[]};
  requireEnclosed(source.eventLocation,{packetIndex:source.packetIndex,scope:'packet',fieldNumber:1,wireType:2,start:0,valueStart:0,end:frame.bodyBytes});
  // These container occurrences are in original event byte order, not schema/kind order.
  for(const at of frame.packet.occurrences){
   budget.repeatedWork(1,source.packetIndex);
   if(at.scope!=='track_event'||at.fieldNumber!==1052&&at.fieldNumber!==1075)continue;
   const kind=at.fieldNumber===1075?'reporter2':'graphics',payload=event[kind];
   if(payload===undefined)throw new ProfileError('typed-payload-mismatch',source.packetIndex);
   const payloadLocation={packetIndex:source.packetIndex,...at};requireEnclosed(payloadLocation,source.eventLocation);
   let parentOccurrenceIndex:number|undefined;
   const fieldOccurrences:TypedOccurrence['fieldOccurrences']=[];
   for(const [occurrenceIndex,field] of payload.occurrences.entries()){
    budget.repeatedWork(1,source.packetIndex);
    const location={packetIndex:source.packetIndex,...field};requireEnclosed(location,payloadLocation);
    const child=field.scope==='frame_sink';
    if(!child)parentOccurrenceIndex=undefined;
    const row:TypedOccurrence['fieldOccurrences'][number]={occurrenceIndex,location};
    let selectedPath:string|undefined,selectedValue:ScalarValue|undefined;
    if(child){
     if(fieldOccurrences.length===0)throw new ProfileError('source-location-mismatch',source.packetIndex);
     // The sole supported message child is graphics FrameSinkId; its owner is the last root container.
     if(parentOccurrenceIndex===undefined){const previous=fieldOccurrences[fieldOccurrences.length-1]!;parentOccurrenceIndex=previous.occurrenceIndex;}
     row.parentOccurrenceIndex=parentOccurrenceIndex;requireEnclosed(location,fieldOccurrences[parentOccurrenceIndex]!.location);
     const key=field.fieldNumber===1?'client':field.fieldNumber===2?'sink':undefined;
     if(key!==undefined){selectedPath=`frameSinkId.${key}`;selectedValue=payload.fields.frameSinkId?.[key];}
    }else{
     const key=(kind==='reporter2'?REPORTER_PATHS:GRAPHICS_PATHS)[field.fieldNumber];
     if(key!==undefined){selectedPath=key;const value=payload.fields[key];if(typeof value==='string'||typeof value==='boolean'||value!==undefined&&'value' in value)selectedValue=value as ScalarValue;}
    }
    if(selectedPath!==undefined)row.selectedPath=selectedPath;if(selectedValue!==undefined)row.selectedValue=selectedValue;
    fieldOccurrences.push(row);
   }
   for(const member of payload.members){budget.repeatedWork(1,source.packetIndex);const owner=fieldOccurrences[member.fieldOccurrenceIndex];if(owner===undefined)throw new ProfileError('source-location-mismatch',source.packetIndex);requireEnclosed({packetIndex:source.packetIndex,scope:kind,fieldNumber:8,wireType:0,...member},owner.location);}
   const typedIndex=typedOccurrences.length;
   typedOccurrences.push({typedIndex,rawEventIndex:raw.rawEventIndex,packetIndex:source.packetIndex,packetBodySha256:frame.bodySha256,kind,eventLocation:source.eventLocation,payloadLocation,fields:payload.fields,presentFieldNumbers:payload.presentFieldNumbers,fieldOccurrences,members:payload.members});raw.typedIndexes.push(typedIndex);
  }
  rawEvents.push(raw);
 }
 return {rawEvents,typedOccurrences};
}
function pairEvents(rawEvents:RawEvent[],build:RestrictedOrderedBuild,budget:Budget):{slices:RestrictedSlice[];barriers:PairingBarrier[]} {
 interface Family {index:number;writers:Set<number>;excluded:string[];stack:number[];excludedBarrier?:number;poison?:{sequenceIndex:number;intervalVersion:number;barrierIndex:number}}
 interface Writer {active:Set<Family>;poison?:number}
 const families=new Map<string,Family>(),writers=new Map<number,Writer>(),slices:RestrictedSlice[]=[],barriers:PairingBarrier[]=[];
 const key=(machine:RawEvent['machineContext'],uuid:string)=>JSON.stringify([machine.status,machine.status==='present'?machine.machineId:null,uuid]);
 const familyOf=(raw:RawEvent):Family|undefined=>raw.trackSelection.status==='selected'&&raw.trackSelection.trackUuid!==undefined&&raw.trackSelection.trackUuid!=='0'?families.get(key(raw.machineContext,raw.trackSelection.trackUuid)):undefined;
 for(const raw of rawEvents){
  budget.repeatedWork(1,raw.packetIndex);
  if(raw.trackSelection.status!=='selected'||raw.trackSelection.trackUuid===undefined||raw.trackSelection.trackUuid==='0')continue;
  const k=key(raw.machineContext,raw.trackSelection.trackUuid);let f=families.get(k);
  if(f===undefined){f={index:families.size,writers:new Set(),excluded:[],stack:[]};families.set(k,f);}f.writers.add(raw.sequenceIndex);
 }
 for(const f of families.values()){budget.repeatedWork(1,0);if(f.writers.size>1)f.excluded.push('multiple_observed_writers');}
 for(const descriptor of build.ordered.descriptorObservations){
  budget.repeatedWork(1+descriptor.reasons.length,descriptor.packetIndex);
  const uuid=descriptor.fields.uuid;
  if(uuid===undefined||!descriptor.reasons.includes('conflicting_association'))continue;
  const f=families.get(key(descriptor.machineContext,uuid));if(f!==undefined&&!f.excluded.includes('conflicting_descriptor'))f.excluded.push('conflicting_descriptor');
 }
 const flush=(f:Family,reason:string,packetIndex:number):number[]=>{
  const affected:number[]=[];
  while(f.stack.length){budget.repeatedWork(1,packetIndex);const index=f.stack.pop()!,slice=slices[index]!;slice.status='interrupted';slice.reasons.push(reason);affected.push(index);}
  return affected;
 };
 const barrier=(packetIndex:number,sequenceIndex:number,intervalVersion:number,reason:string,scope:'family'|'writer_interval',affected:number[],raw?:RawEvent,f?:Family):number=>{
  budget.repeatedWork(1,packetIndex);const barrierIndex=barriers.length;
  barriers.push({barrierIndex,atPacketIndex:packetIndex,...(raw===undefined?{}:{rawEventIndex:raw.rawEventIndex}),scope,...(f===undefined?{}:{familyIndex:f.index}),sequenceIndex,intervalVersion,reason,affectedOpenSliceIndexes:affected});return barrierIndex;
 };
 const poisonFamily=(raw:RawEvent,f:Family,writer:Writer,reason:string)=>{
  const id=barrier(raw.packetIndex,raw.sequenceIndex,raw.intervalVersion,reason,'family',flush(f,reason,raw.packetIndex),raw,f);
  writer.active.delete(f);f.poison={sequenceIndex:raw.sequenceIndex,intervalVersion:raw.intervalVersion,barrierIndex:id};raw.reasons.push(reason);raw.barrierIndexes.push(id);
 };
 const poisonWriter=(raw:RawEvent,writer:Writer,reason:string)=>{
  const affected:number[]=[];for(const f of writer.active){budget.repeatedWork(1,raw.packetIndex);affected.push(...flush(f,reason,raw.packetIndex));}writer.active.clear();
  const id=barrier(raw.packetIndex,raw.sequenceIndex,raw.intervalVersion,reason,'writer_interval',affected,raw);writer.poison=id;raw.reasons.push(reason);raw.barrierIndexes.push(id);
 };
 const lossByPacket=new Map<number,RestrictedOrderedBuild['ordered']['lossObservations'][number]>();
 for(const loss of build.ordered.lossObservations){budget.repeatedWork(1,loss.packetIndex);lossByPacket.set(loss.packetIndex,loss);}
 let cursor=0;
 for(const packet of build.ordered.packets){
  budget.repeatedWork(1,packet.packetIndex);
  let writer=writers.get(packet.sequenceIndex);if(writer===undefined){writer={active:new Set()};writers.set(packet.sequenceIndex,writer);}
  const loss=lossByPacket.get(packet.packetIndex);
  if(loss?.resetObserved||loss?.dropObserved){
   const reason=loss.resetObserved?(loss.dropObserved?'reset_and_loss':'incremental_reset'):'observed_loss',affected:number[]=[];
   for(const f of writer.active){budget.repeatedWork(1,packet.packetIndex);affected.push(...flush(f,reason,packet.packetIndex));}writer.active.clear();
   const id=barrier(packet.packetIndex,packet.sequenceIndex,packet.intervalVersion,reason,'writer_interval',affected);
   if(loss.resetObserved)delete writer.poison;else writer.poison=id;
  }
  const raw=rawEvents[cursor];if(raw===undefined||raw.packetIndex!==packet.packetIndex)continue;cursor++;
  budget.repeatedWork(1,raw.packetIndex);
  const f=familyOf(raw);
  if(f===undefined){raw.pairingDisposition='unsupported_profile';poisonWriter(raw,writer,'unsupported_implicit_or_zero_track_profile');continue;}
  if(f.excluded.length){
   raw.reasons.push(...f.excluded);
   if(f.excludedBarrier===undefined)f.excludedBarrier=barrier(raw.packetIndex,raw.sequenceIndex,raw.intervalVersion,f.excluded[0]!,'family',[],raw,f);
   raw.barrierIndexes.push(f.excludedBarrier);continue;
  }
  if(writer.poison!==undefined){raw.reasons.push('active_writer_barrier');raw.barrierIndexes.push(writer.poison);continue;}
  if(f.poison?.sequenceIndex===raw.sequenceIndex&&f.poison.intervalVersion===raw.intervalVersion){raw.reasons.push('active_family_barrier');raw.barrierIndexes.push(f.poison.barrierIndex);continue;}
  if(!packet.valid){poisonFamily(raw,f,writer,'invalid_sequence_interval');continue;}
  // Presence, not decoded empty value or a guessed native default, defines this narrow END profile.
  if(raw.fields.type==='2'&&raw.presentFieldNumbers.some(n=>n===10||n===23||n===3||n===22)){
   raw.pairingDisposition='unsupported_profile';poisonFamily(raw,f,writer,'unsupported_end_constraints');continue;
  }
  if(raw.resolution!=='resolved'){poisonFamily(raw,f,writer,raw.resolution);continue;}
  switch(raw.fields.type){
   case '1':{
    budget.repeatedWork(1,raw.packetIndex);raw.pairingDisposition='begin_candidate';
    const parent=f.stack[f.stack.length-1],sliceIndex=slices.length;
    slices.push({sliceIndex,beginRawEventIndex:raw.rawEventIndex,familyIndex:f.index,sequenceIndex:raw.sequenceIndex,intervalVersion:raw.intervalVersion,...(parent===undefined?{}:{parentSliceIndex:parent}),depth:f.stack.length,beginTypedIndexes:[...raw.typedIndexes],status:'open_at_supplied_eof',reasons:[]});f.stack.push(sliceIndex);writer.active.add(f);break;
   }
   case '2':{
    budget.repeatedWork(1,raw.packetIndex);const index=f.stack.pop();
    if(index===undefined){raw.reasons.push('end_without_begin');break;}
    const slice=slices[index]!;slice.endRawEventIndex=raw.rawEventIndex;slice.status='matched_restricted_structure';raw.pairingDisposition='end_candidate';if(f.stack.length===0)writer.active.delete(f);break;
   }
   case '3':raw.pairingDisposition='instant_only';break;
   default:raw.pairingDisposition='unsupported_profile';poisonFamily(raw,f,writer,raw.fields.type==='4'||raw.fields.type==='5'?'unsupported_non_slice_type':'unsupported_event_type');
  }
 }
 if(cursor!==rawEvents.length)throw new ProfileError('event-order-mismatch');
 return {slices,barriers};
}
/** Whole supplied bytes and a deliberately restricted source-order profile only.
 * Named/categorized END, implicit/zero track, multiple observed writers and
 * unknown state create explicit withholding; raw typed evidence is retained.
 * No native sorter/track merge, clock/target/capture or presentation authority.
 * Fixed inherited budgets apply to the entire composition; no prefix on denial.
 */
export function projectBrowserFrameTraceSlices(input: unknown, policy: unknown) {
 let inputRef:{status:'unavailable'}|{status:'owned';bytes:number;sha256:string}={status:'unavailable'},structuralContainerEOF=false;
 const unavailable=(diagnostic:{stage:string;code:string;packetIndex?:number;frameIndex?:number;bodyStart?:number;offset?:number;component?:string;cause?:string})=>freezeOwned({...LABELS,status:'unavailable' as const,inputRef,structuralContainerEOF,diagnostics:[diagnostic]});
 if(policy!==TRACE_SLICES_POLICY)return unavailable({stage:'input',code:'unsupported-policy'});
 let bytes:Uint8Array;
 try{bytes=copyBody(input);}catch(error){
  let code='invalid-trace-slices-input';
  try{if(error instanceof WireError){const value:unknown=error.code;if(value==='unsupported-byte-view'||value==='unavailable-byte-storage'||value==='byte-capacity')code=value;}}catch{/* Hostile exceptions supply no diagnostic authority. */}
  return unavailable({stage:'input',code});
 }
 inputRef={status:'owned',bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex')};
 let sourceFrames:readonly SliceTraceFrame[]=[];
 try {
  const budget=new Budget('final-owned'),ingress=decodeBrowserFrameTraceForSlices(bytes,budget);
  structuralContainerEOF=ingress.structuralContainerEOF;
  if(ingress.status==='unavailable')return unavailable({stage:'ingress',...ingress.diagnostics[0]!});
  sourceFrames=ingress.frames;
  if(ingress.inputRef.sha256!==inputRef.sha256||ingress.inputRef.bytes!==inputRef.bytes)throw new ProfileError('input-reference-mismatch');
  for(const [i,f] of ingress.frames.entries()){
   if(f.frameIndex!==i||f.bodyEnd-f.bodyStart!==f.bodyBytes||f.bodyBytes!==f.packet.bodyBytes.byteLength||f.bodySha256!==createHash('sha256').update(bytes.subarray(f.bodyStart,f.bodyEnd)).digest('hex')||f.bodySha256!==createHash('sha256').update(f.packet.bodyBytes).digest('hex'))throw new ProfileError('packet-reference-mismatch',i);
  }
  const build=projectOwnedBrowserFrameSliceState(ingress.frames,budget);
  if(build.status==='unavailable'){
   const d=build.diagnostics[0]!,f=d.packetIndex===undefined?undefined:ingress.frames[d.packetIndex];
   return unavailable({stage:'ordered',...d,...(f===undefined?{}:{bodyStart:f.bodyStart})});
  }
  const frames=ingress.frames.map(({packet:_,...f})=>({...f,packetIndex:f.frameIndex}));
  const retained=retainEvents(build,ingress.frames,budget);
  const pairing=pairEvents(retained.rawEvents,build,budget);
  const result={...LABELS,status:'projected_restricted_trace_slices' as const,inputRef,frames,structuralContainerEOF:true as const,nestedOffsets:'packet-relative' as const,ordered:build.ordered,...retained,...pairing};
  budget.finishOwnedOutput(result);
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>4194304)throw new ProfileError('output-byte-capacity');
  return freezeOwned(result);
 }catch(error){const frame=error instanceof ProfileError&&error.packetIndex!==undefined?sourceFrames[error.packetIndex]:undefined;return unavailable({stage:'composition',code:error instanceof ProfileError?error.code:'trace-slices-composition-failed',...(error instanceof ProfileError&&error.packetIndex!==undefined?{packetIndex:error.packetIndex}:{}),...(frame===undefined?{}:{bodyStart:frame.bodyStart})});}
}
export type TraceSlicesResult=ReturnType<typeof projectBrowserFrameTraceSlices>;
export type TraceSlicesProjection=Extract<TraceSlicesResult,{status:'projected_restricted_trace_slices'}>;
export type TraceSlicesUnavailable=Extract<TraceSlicesResult,{status:'unavailable'}>;
