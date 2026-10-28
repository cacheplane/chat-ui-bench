import {readOwnedPaintTraceV12,type OwnedPaintTraceV12} from './browser-frame-owned-paint-v12-reader.js';
import {OWNED_PAINT_V12_POLICY,type OwnedPaintStudyV12} from './browser-frame-owned-paint-v12.js';
import {OWNED_PAINT_V12_LIMITS as L} from './browser-frame-owned-paint-v12-budget.js';
import type {CandidateV12,SourceV12,SpanV12,LayoutOccurrenceV12} from './browser-frame-owned-paint-v12-kernel.js';

export const OWNED_CLOCK3_INTERVAL_V2_POLICY='owned-clock3-interval-diagnostic-v2';
const OUTPUT_BYTES=16384;
const WORK_UNITS=1048576;
const REASONS=['unsupported-policy','invalid-mark-names','owned-input-unavailable','study-unavailable','raw-drop-unavailable','unexplained-raw-drop','unexplained-sequence-state','mark-inventory-unavailable','mark-cardinality','mark-domain-unavailable','restoration-unavailable','clock3-profile-unavailable','descriptor-identity-unavailable','timestamp-unavailable','mark-order','result-capacity','projection-capacity','internal-unavailable'] as const;
export type OwnedClock3IntervalV2Reason=typeof REASONS[number];
function freeze<T>(value:T):T {
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
}
const AUTHORITY=freeze({clockAdmission:'not_evaluated',nativeClockSupport:false,targetAdmission:'not_evaluated',targetLifetime:'unestablished',presentation:'not_evaluated',population:'not_evaluated',metric:'not_evaluated',performance:'not_evaluated',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'} as const);
const COMPATIBILITY=freeze({id:'owned-clock3-reviewed-v12-v2',parserPin:'403906f4adfbf287a02e5546f8430dcc9d56b649',interpretationPin:'1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d'});
interface MetadataReference {occurrenceIndex:number;factIndex:number;factKind:'clock_snapshot_layout'|'track_descriptor';source:SourceV12;location:SpanV12;scope:[string,number,number]|null}
type ValidStateProof={kind:'anchor-defaults-selection';defaultsVersionIndex:number;sequenceIndex:number;epoch:number;source:SourceV12;location:SpanV12;trackUuid:string;trackEventDefaultsPresent:true}|{kind:'legal-clear-metadata';reference:MetadataReference;sequenceFlags:string|null;incrementalStateCleared:boolean|null};
interface AnchorWitness {source:SourceV12;eventLocation:SpanV12;rawTimestamp:string;sequenceId:string;sequenceIndex:number;epoch:number;clock:CandidateV12['clock'];track:CandidateV12['track'];defaultsVersionIndex:number|null;validStateProof:ValidStateProof;threadDescriptor:MetadataReference}
interface Witness {
 input:{bytes:number;sha256:string};
 reader:{kind:string;EOF:boolean;closed:boolean;identityMatch:boolean;hashMatch:boolean;reads:number};
 manifests:OwnedPaintStudyV12['manifests'];compatibility:typeof COMPATIBILITY;
 rawDropCounts:{nonzeroDeclarations:number;explainedDeclarations:number;unexplainedDeclarations:number;contradictoryDeclarations:0};
 semanticSequenceStartCounts:OwnedPaintStudyV12['sequenceStart'];anchors:[AnchorWitness,AnchorWitness];parentDescriptor:MetadataReference;
 domain:{clockId:'3';machineStatus:'absent';sequenceIndex:number;sequenceId:string;trackUuid:string};
 identity:{trackUuid:string;parentUuid:string;pid:string;tid:string;processStartGeneration:string};
 examined:{snapshots:number;clockEntries:number;relevantClock3Entries:number;descriptors:number;matchingThreadDescriptors:number;matchingParentDescriptors:number};
}
type Base={policy:typeof OWNED_CLOCK3_INTERVAL_V2_POLICY;durationNs:null;inputOrigin:'not_authenticated';authority:typeof AUTHORITY};
export type OwnedClock3IntervalV2Result=Readonly<Base&({status:'unavailable';reason:OwnedClock3IntervalV2Reason;traceIntervalNs:null;witness:null}|{status:'owned-clock3-interval-diagnostic';reason:null;traceIntervalNs:string;witness:Witness})>;
const BASE:Base={policy:OWNED_CLOCK3_INTERVAL_V2_POLICY,durationNs:null,inputOrigin:'not_authenticated',authority:AUTHORITY};
// Reserved failure closure: fixed, bounded and frozen before any per-call work.
// Returning a failure needs no result allocation, serialization or recursive freeze.
const FAILURES=Object.fromEntries(REASONS.map(reason=>[reason,freeze({...BASE,status:'unavailable' as const,reason,traceIntervalNs:null,witness:null})])) as Record<OwnedClock3IntervalV2Reason,OwnedClock3IntervalV2Result>;
class Refusal extends Error {constructor(readonly reason:OwnedClock3IntervalV2Reason){super(reason);}}
function requireGate(good:unknown,reason:OwnedClock3IntervalV2Reason):asserts good {if(!good)throw new Refusal(reason);}
class ProjectionWork {
 private remaining=WORK_UNITS;
 charge(n:number){if(!Number.isSafeInteger(n)||n<0||n>this.remaining)throw new Refusal('projection-capacity');this.remaining-=n;}
 string(value:string){this.charge(1+value.length);}
 uint(value:unknown):value is string {this.charge(1);if(typeof value!=='string'||value.length>20)return false;this.string(value);return /^(0|[1-9][0-9]*)$/.test(value)&&(value.length<20||value<='18446744073709551615');}
 nonzero(value:unknown):value is string {return this.uint(value)&&value!=='0';}
 hash(value:unknown):value is string {this.charge(65);return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);}
 equal(a:string|null,b:string|null){this.charge(1+(a?.length??0)+(b?.length??0));return a===b;}
}
const index=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
function names(input:unknown):[string,string]|null {
 if(typeof input!=='string'||input.length>4096)return null;
 try{
  const value:unknown=JSON.parse(input);
  if(!Array.isArray(value)||value.length!==2||JSON.stringify(value)!==input)return null;
  const valid=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&Buffer.byteLength(s)<=256&&!/\p{Cc}/u.test(s)&&!/[\uD800-\uDFFF]/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''));
  return valid(value[0])&&valid(value[1])&&value[0]!==value[1]?[value[0],value[1]]:null;
 }catch{return null;}
}
function sourceValid(source:SourceV12,s:OwnedPaintStudyV12,w:ProjectionWork){
 w.charge(8);return index(source.packetIndex)&&source.packetIndex<s.counters.packets!&&index(source.rootBodyStart)&&index(source.packetBytes)&&source.rootBodyStart+source.packetBytes<=s.inputRef.bytes&&w.hash(source.packetSHA256);
}
function spanValid(at:SpanV12,source:SourceV12,w:ProjectionWork){
 w.charge(12);w.string(at.scope);return at.packetIndex===source.packetIndex&&index(at.start)&&index(at.valueStart)&&index(at.end)&&at.start<at.valueStart&&at.valueStart<=at.end&&at.end<=source.packetBytes;
}
function admitRead(read:OwnedPaintTraceV12,w:ProjectionWork):OwnedPaintStudyV12 {
 w.charge(128);const r=read.reader,s=read.study;
 requireGate(read.fullInputVerified&&read.structuralContainerEOF&&r.EOF&&r.closed&&r.identityMatch&&r.hashMatch&&r.kind==='source-owned-persisted-file','owned-input-unavailable');
 requireGate(read.policy===OWNED_PAINT_V12_POLICY&&read.status==='complete-owned-whole-diagnostic'&&read.reason===null&&s&&s.policy===OWNED_PAINT_V12_POLICY&&s.status==='complete-owned-selected-schema'&&s.reason===null&&s.framingBoundaryComplete&&s.semanticProcessing==='complete-supported-schema'&&s.inputRef.bytes===r.bytes&&s.inputRef.sha256===r.sha256&&w.hash(r.sha256),'study-unavailable');
 for(const hash of Object.values(s.manifests))requireGate(w.hash(hash),'study-unavailable');
 requireGate(Object.keys(s.manifests).length===5,'study-unavailable');return s;
}
function admitLoss(s:OwnedPaintStudyV12,w:ProjectionWork){
 w.charge(64);const raw=s.rawDrop,c=s.counters,q=s.sequenceStart;
 requireGate(raw.status==='complete-supported-header-declarations'&&raw.facts.length<=L.rawDropRows,'raw-drop-unavailable');
 for(const n of [c.rawDropDeclarations,c.explainedRawDropDeclarations,c.unexplainedRawDropDeclarations,c.firstContradictions,q.raw,q.explained,q.unexplained,q.contradictions])requireGate(index(n),'raw-drop-unavailable');
 let explained=0,unexplained=0;const seen=new Set<number>();
 for(const f of raw.facts){w.charge(32);
  requireGate(sourceValid(f.source,s,w)&&!seen.has(f.source.packetIndex)&&w.nonzero(f.sequenceId)&&w.nonzero(f.headers.previousPacketDropped),'raw-drop-unavailable');seen.add(f.source.packetIndex);
  const good=f.headers.previousPacketDropped==='1'&&f.headers.firstPacketOnSequence===true&&f.priorSeen===false;
  requireGate(f.classification===(good?'explained':'unexplained'),'raw-drop-unavailable');if(good)explained++;else unexplained++;
 }
 requireGate(c.rawDropDeclarations===raw.facts.length&&c.explainedRawDropDeclarations===explained&&c.unexplainedRawDropDeclarations===unexplained,'raw-drop-unavailable');
 requireGate(unexplained===0,'unexplained-raw-drop');
 requireGate(c.firstContradictions===0&&q.contradictions===0&&q.unexplained===0&&q.raw===q.explained+q.unexplained,'unexplained-sequence-state');
 return {nonzeroDeclarations:raw.facts.length,explainedDeclarations:explained,unexplainedDeclarations:unexplained,contradictoryDeclarations:0 as const};
}
function selectMarks(s:OwnedPaintStudyV12,n:[string,string],w:ProjectionWork):[CandidateV12,CandidateV12] {
 w.charge(64);requireGate(s.markInventoryAdmission==='resolved-supported-source-roots'&&s.counters.ordinaryWithheldRootInventories===0&&s.counters.markWithheld===0&&s.candidates.length<=L.candidateRows,'mark-inventory-unavailable');
 let start:CandidateV12|undefined,end:CandidateV12|undefined,a=0,b=0;
 for(const c of s.candidates){w.charge(8);requireGate(c.kind==='literal_string'&&typeof c.value==='string','mark-inventory-unavailable');w.string(c.value);w.charge(n[0].length+n[1].length);if(c.value===n[0]){a++;start=c;}if(c.value===n[1]){b++;end=c;}}
 requireGate(a===1&&b===1&&start&&end,'mark-cardinality');
 for(const c of [start,end]){w.charge(64);requireGate(c.reason===null&&(c.representation==='annotation'||c.representation==='event_name')&&sourceValid(c.source,s,w)&&spanValid(c.eventLocation,c.source,w)&&c.eventLocation.fieldNumber===11&&c.eventLocation.wireType===2&&c.eventLocation.valueStart<c.eventLocation.end&&c.timestampStatus==='raw-unqualified'&&c.clock.status==='selected'&&c.clock.reason===null&&c.clock.source==='packet'&&c.clock.value==='3'&&c.track.status==='selected'&&c.track.reason===null&&(c.track.source==='event'||c.track.source==='defaults'&&index(c.track.defaultsVersionIndex))&&w.nonzero(c.track.value)&&c.machine.status==='absent'&&c.machine.id===null&&w.nonzero(c.sequenceId)&&index(c.sequenceIndex)&&index(c.epoch),'mark-domain-unavailable');}
 requireGate(w.equal(start.sequenceId,end.sequenceId)&&start.sequenceIndex===end.sequenceIndex&&start.epoch<=end.epoch&&w.equal(start.track.value,end.track.value),'mark-domain-unavailable');return [start,end];
}
function metadataReference(o:LayoutOccurrenceV12,i:number,s:OwnedPaintStudyV12,w:ProjectionWork):MetadataReference {
 w.charge(32);if(o[3])w.string(o[3][0]);
 return {occurrenceIndex:i,factIndex:o[0],factKind:s.evidence.facts[o[0]]!.kind,source:{...o[1]},location:{...o[5]},scope:o[3]?[...o[3]]:null};
}
function anchorScope(o:LayoutOccurrenceV12,c:CandidateV12,w:ProjectionWork){
 w.charge(8);return o[2].status==='absent'&&o[3]!==null&&w.equal(o[3][0],c.sequenceId)&&o[3][1]===c.sequenceIndex&&o[3][2]===c.epoch&&o[1].packetIndex<=c.source.packetIndex;
}
function restored(s:OwnedPaintStudyV12,c:CandidateV12,clear:{reference:MetadataReference;sequenceFlags:string|null;incrementalStateCleared:boolean|null}|null,w:ProjectionWork):ValidStateProof {
 w.charge(64);
 if(c.track.source==='defaults'){
  const i=c.track.defaultsVersionIndex;
  requireGate(index(i)&&i<s.state.defaults.length&&s.state.defaults.length<=L.defaultsVersions&&c.defaultsVersionIndex===i,'restoration-unavailable');
  const d=s.state.defaults[i]!;
  requireGate(d.versionIndex===i&&d.sequenceIndex===c.sequenceIndex&&d.epoch===c.epoch&&d.trackEventDefaultsPresent&&w.equal(d.trackUuid,c.track.value)&&sourceValid(d.source,s,w)&&spanValid(d.location,d.source,w)&&d.location.scope==='packet'&&d.location.fieldNumber===59&&d.location.wireType===2&&d.location.valueStart<d.location.end&&d.source.packetIndex<=c.source.packetIndex,'restoration-unavailable');
  return {kind:'anchor-defaults-selection',defaultsVersionIndex:i,sequenceIndex:d.sequenceIndex,epoch:d.epoch,source:{...d.source},location:{...d.location},trackUuid:d.trackUuid!,trackEventDefaultsPresent:true};
 }
 requireGate(c.track.source==='event'&&clear,'restoration-unavailable');
 return {kind:'legal-clear-metadata',...clear};
}
function admitMetadata(s:OwnedPaintStudyV12,start:CandidateV12,end:CandidateV12,w:ProjectionWork){
 const e=s.evidence;w.charge(32);
 requireGate(e.status==='complete-supported-compact-observations'&&e.codec===2&&e.domain==='owned-paint-clock-layout-v12'&&e.facts.length<=L.metadataFacts&&e.occurrences.length<=L.metadataOccurrences,'clock3-profile-unavailable');
 const examined={snapshots:0,clockEntries:0,relevantClock3Entries:0,descriptors:0,matchingThreadDescriptors:0,matchingParentDescriptors:0};
 let fields=0,timestamps=0,priorPacket=-1;
 const anchors=[start,end] as const;
 const threads:[MetadataReference|null,MetadataReference|null]=[null,null];
 const clears:[{reference:MetadataReference;sequenceFlags:string|null;incrementalStateCleared:boolean|null}|null,{reference:MetadataReference;sequenceFlags:string|null;incrementalStateCleared:boolean|null}|null]=[null,null];
 let thread:{parent:string;pid:string;tid:string}|null=null;
 // First pass validates codec2 once and inspects all clocks and selected children.
 for(let oi=0;oi<e.occurrences.length;oi++){const o=e.occurrences[oi]!;w.charge(48);
  requireGate(Array.isArray(o)&&o.length===7&&index(o[0])&&o[0]<e.facts.length&&sourceValid(o[1],s,w)&&spanValid(o[5],o[1],w)&&o[1].packetIndex>=priorPacket,'clock3-profile-unavailable');priorPacket=o[1].packetIndex;
  const [fi,source,machine,scope,,,vector]=o,f=e.facts[fi]!;
  requireGate(machine.status==='absent'?machine.id===null:machine.status==='present'&&w.uint(machine.id),'clock3-profile-unavailable');
  requireGate(scope===null||Array.isArray(scope)&&scope.length===3&&w.nonzero(scope[0])&&index(scope[1])&&index(scope[2]),'clock3-profile-unavailable');
  w.charge(24);const h=o[4];
  requireGate((h.sequenceFlags===null||w.uint(h.sequenceFlags)&&BigInt(h.sequenceFlags)<=3n)&&(h.incrementalStateCleared===null||typeof h.incrementalStateCleared==='boolean')&&o[5].scope==='packet'&&o[5].wireType===2&&o[5].valueStart<o[5].end&&o[5].fieldNumber===(f.kind==='clock_snapshot_layout'?6:60),'clock3-profile-unavailable');
  // The retained occurrence is genuine codec2 metadata, not an inferred reset.
  if(h.incrementalStateCleared===true||(BigInt(h.sequenceFlags??'0')&1n)!==0n){
   for(const ai of [0,1] as const){w.charge(4);if(clears[ai]===null&&anchorScope(o,anchors[ai],w))clears[ai]={reference:metadataReference(o,oi,s,w),sequenceFlags:h.sequenceFlags,incrementalStateCleared:h.incrementalStateCleared};}
  }
  if(f.kind==='clock_snapshot_layout'){
   examined.snapshots++;requireGate(Array.isArray(vector),'clock3-profile-unavailable');let slot=0;
   for(const clock of f.clocks){w.charge(12);examined.clockEntries++;requireGate(examined.clockEntries<=L.clockChildren,'projection-capacity');let id:string|null=null,stamp:string|null=null,units=false,incremental=false;
    for(const entry of clock){w.charge(8);requireGate(++fields<=L.layoutEntrySlots,'projection-capacity');
     if(entry[0]==='timestamp'){requireGate(entry.length===1&&++timestamps<=L.timestampSlots&&slot<vector.length,'clock3-profile-unavailable');const value=vector[slot++];requireGate(w.uint(value),'clock3-profile-unavailable');stamp=value;}
     else if(entry[0]==='clockId'){requireGate(entry.length===2&&w.uint(entry[1]),'clock3-profile-unavailable');id=entry[1];}
     else if(entry[0]==='unitMultiplierNs'){requireGate(entry.length===2&&w.uint(entry[1]),'clock3-profile-unavailable');units=true;}
     else if(entry[0]==='isIncremental'){requireGate(entry.length===2&&typeof entry[1]==='boolean','clock3-profile-unavailable');incremental=true;}
     else throw new Refusal('clock3-profile-unavailable');
    }
    if(machine.status==='absent'&&id==='3'){examined.relevantClock3Entries++;requireGate(stamp!==null&&!units&&!incremental,'clock3-profile-unavailable');}
   }
   requireGate(slot===vector.length,'clock3-profile-unavailable');continue;
  }
  requireGate(f.kind==='track_descriptor'&&vector===null,'clock3-profile-unavailable');examined.descriptors++;
  const d=f.fields;if(machine.status!=='absent'||!w.equal(d.uuid,start.track.value))continue;
  examined.matchingThreadDescriptors++;w.charge(32);
  requireGate(d.thread&&d.process===null&&w.nonzero(d.parentUuid)&&!w.equal(d.parentUuid,start.track.value)&&d.thread.pid!==null&&d.thread.tid!==null,'descriptor-identity-unavailable');
  w.string(d.thread.pid);w.string(d.thread.tid);
  if(thread)requireGate(w.equal(thread.parent,d.parentUuid)&&w.equal(thread.pid,d.thread.pid)&&w.equal(thread.tid,d.thread.tid),'descriptor-identity-unavailable');
  else thread={parent:d.parentUuid,pid:d.thread.pid,tid:d.thread.tid};
  for(const ai of [0,1] as const){w.charge(4);if(threads[ai]===null&&anchorScope(o,anchors[ai],w))threads[ai]=metadataReference(o,oi,s,w);}
 }
 requireGate(examined.relevantClock3Entries>0,'clock3-profile-unavailable');requireGate(thread&&threads[0]&&threads[1],'descriptor-identity-unavailable');
 let parent:{ownParent:string|null;generation:string}|null=null,parentDescriptor:MetadataReference|null=null;
 // Second pass visits only descriptor scalars; clock children are not reexpanded.
 for(let oi=0;oi<e.occurrences.length;oi++){const o=e.occurrences[oi]!;w.charge(8);const f=e.facts[o[0]]!;if(f.kind!=='track_descriptor'||o[2].status!=='absent'||!w.equal(f.fields.uuid,thread.parent))continue;
  w.charge(32);examined.matchingParentDescriptors++;const d=f.fields;
  requireGate(d.process&&d.thread===null&&w.equal(d.process.pid,thread.pid)&&d.process.startTimestampNs!==null,'descriptor-identity-unavailable');w.string(d.process.startTimestampNs);
  if(parent)requireGate(w.equal(parent.ownParent,d.parentUuid)&&w.equal(parent.generation,d.process.startTimestampNs),'descriptor-identity-unavailable');
  else {parent={ownParent:d.parentUuid,generation:d.process.startTimestampNs};parentDescriptor=metadataReference(o,oi,s,w);}
 }
 requireGate(parent&&parentDescriptor,'descriptor-identity-unavailable');
 const proofs:[ValidStateProof,ValidStateProof]=[restored(s,start,clears[0],w),restored(s,end,clears[1],w)];
 return {examined,threads:threads as [MetadataReference,MetadataReference],proofs,parentDescriptor,identity:{trackUuid:start.track.value!,parentUuid:thread.parent,pid:thread.pid,tid:thread.tid,processStartGeneration:parent.generation}};
}
function anchorWitness(c:CandidateV12,validStateProof:ValidStateProof,threadDescriptor:MetadataReference,w:ProjectionWork):AnchorWitness {
 w.charge(64);w.string(c.sequenceId);
 return {source:{...c.source},eventLocation:{...c.eventLocation},rawTimestamp:c.rawTimestamp!,sequenceId:c.sequenceId,sequenceIndex:c.sequenceIndex,epoch:c.epoch,clock:{...c.clock},track:{...c.track},defaultsVersionIndex:c.defaultsVersionIndex,validStateProof,threadDescriptor};
}
function output(result:OwnedClock3IntervalV2Result,w:ProjectionWork):OwnedClock3IntervalV2Result {
 // Only the new fixed witness is walked, never a study/evidence graph.
 let nodes=0,stringBytes=0;
 function preflight(v:unknown):void {
  w.charge(4);requireGate(++nodes<=1024,'result-capacity');
  if(typeof v==='string'){w.string(v);stringBytes+=Buffer.byteLength(v);requireGate(stringBytes<=OUTPUT_BYTES,'result-capacity');}
  else if(v!==null&&typeof v==='object')for(const [key,child] of Object.entries(v)){w.string(key);preflight(child);}
 }
 preflight(result);
 // Reserve the entire bounded stringify, UTF8 size scan and freeze before either.
 w.charge(OUTPUT_BYTES*4+1024*8);
 requireGate(Buffer.byteLength(JSON.stringify(result))<=OUTPUT_BYTES,'result-capacity');return freeze(result);
}
/** Single genuine owned read; no caller-created study or serialized result is trusted. */
export function readOwnedClock3IntervalV2(referenceJSON:unknown,namesJSON:unknown,policy:unknown):OwnedClock3IntervalV2Result {
 if(policy!==OWNED_CLOCK3_INTERVAL_V2_POLICY)return FAILURES['unsupported-policy'];
 const n=names(namesJSON);if(!n)return FAILURES['invalid-mark-names'];
 try{
  const read=readOwnedPaintTraceV12(referenceJSON,OWNED_PAINT_V12_POLICY),w=new ProjectionWork(),s=admitRead(read,w);
  const rawDropCounts=admitLoss(s,w),[start,end]=selectMarks(s,n,w),{examined,identity,threads,proofs,parentDescriptor}=admitMetadata(s,start,end,w);
  requireGate(w.uint(start.rawTimestamp)&&w.uint(end.rawTimestamp),'timestamp-unavailable');
  requireGate(end.source.packetIndex>start.source.packetIndex,'mark-order');
  const a=BigInt(start.rawTimestamp),b=BigInt(end.rawTimestamp);requireGate(b>a,'mark-order');
  const r=read.reader;
  const witness:Witness={input:{bytes:r.bytes,sha256:r.sha256!},reader:{kind:r.kind,EOF:r.EOF,closed:r.closed,identityMatch:r.identityMatch,hashMatch:r.hashMatch,reads:r.reads},manifests:{...s.manifests},compatibility:COMPATIBILITY,rawDropCounts,semanticSequenceStartCounts:{...s.sequenceStart},anchors:[anchorWitness(start,proofs[0],threads[0],w),anchorWitness(end,proofs[1],threads[1],w)],parentDescriptor,domain:{clockId:'3',machineStatus:'absent',sequenceIndex:start.sequenceIndex,sequenceId:start.sequenceId,trackUuid:start.track.value!},identity,examined};
  // Subtract last, after every original-file, inventory, profile and identity gate.
  return output({...BASE,status:'owned-clock3-interval-diagnostic',reason:null,traceIntervalNs:(b-a).toString(),witness},w);
 }catch(error){return FAILURES[error instanceof Refusal?error.reason:'internal-unavailable'];}
}
