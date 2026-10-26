import {types} from 'node:util';
import {readWholeUserTimingTraceV8} from './browser-frame-whole-trace-reader.js';
import {WHOLE_USER_TIMING_V8_POLICY,type WholeUserTimingCandidate} from './browser-frame-ordered-state.js';

export const SAME_TRACE_CLOCK3_INTERVAL_POLICY='same-trace-clock3-interval-diagnostic-v1';
const OUTPUT_BYTES=16384;
const PARSER_PIN='403906f4adfbf287a02e5546f8430dcc9d56b649';
const INTERPRETATION_PIN='1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d';
function freeze<T>(value:T):T {
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
}
const sourceURL=(pin:string,file:string)=>'https://raw.githubusercontent.com/google/perfetto/'+pin+'/protos/perfetto/'+file;
/**
 * Reviewed field compatibility commitments, not runtime creator authentication.
 * The parser pin remains unchanged. The first four proto sources are identical;
 * TracePacket differs in loss-related comments, with reviewed declarations unchanged.
 * No source fetch or runtime self-qualification is performed.
 */
export const SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY=freeze({
 id:'same-trace-clock3-reviewed-fields-v1',parserPin:PARSER_PIN,interpretationPin:INTERPRETATION_PIN,
 sources:[
  {path:'trace/track_event/track_event.proto',parserSHA256:'875df7bb2644a5762a540f3ac3e465435b8a6bdcab8afd29519c80716d3da9f9',interpretationSHA256:'875df7bb2644a5762a540f3ac3e465435b8a6bdcab8afd29519c80716d3da9f9'},
  {path:'trace/clock_snapshot.proto',parserSHA256:'90c94de705e5427afb905c1df7ca84921bf3b52d6312751ee5c9587862c76bf5',interpretationSHA256:'90c94de705e5427afb905c1df7ca84921bf3b52d6312751ee5c9587862c76bf5'},
  {path:'common/builtin_clock.proto',parserSHA256:'ae1d1542bc0a1f1fbd29d9351f19e2a86bd8add28c8e06ef662a7beadb8226fe',interpretationSHA256:'ae1d1542bc0a1f1fbd29d9351f19e2a86bd8add28c8e06ef662a7beadb8226fe'},
  {path:'trace/trace_packet_defaults.proto',parserSHA256:'2cec9913ad8f2d9fa50e2368b209ef34049dd360d745244f29b1cc07a6179640',interpretationSHA256:'2cec9913ad8f2d9fa50e2368b209ef34049dd360d745244f29b1cc07a6179640'},
  {path:'trace/trace_packet.proto',parserSHA256:'873de5e3d48b0e4a745bb1bd0bd893c44d1e3c108e0eff48cd8a812ecf11a6a4',interpretationSHA256:'dbed03ce7972a9b69297ac67f2497885cea3947dc970bae7267d503ef8a02ded'}
 ].map(s=>({...s,parserURL:sourceURL(PARSER_PIN,s.path),interpretationURL:sourceURL(INTERPRETATION_PIN,s.path)})),
 implementation:{
  auditBaseline:{
   'browser-frame-packet-fragments.ts':'3c385a08fc99af0ee1876625a075a67b429ba1b128f8a7e190c13523c8024358',
   'browser-frame-track-event-fragments.ts':'0462ac829f3fe122ab8455c9c0df7ecf780a30898e6e0f5b1a4d65531d40468e',
   'browser-frame-state-fragments.ts':'b1dce024aa8609430be3901e9f3e3503d53883d367e7ecf881ca4eca3816137d',
   'browser-frame-ordered-state.ts':'91705c13b14875e76c2081225e783a0ed31bba766a0de4395d2e8800a2feb0a9',
   'browser-frame-whole-trace-reader.ts':'4c60f4605d5945fef7c908b2409cab1325e78069467b87f879271fce7374778b'
  },
  reviewedV8:{
   'browser-frame-ordered-state.ts':'4e5a791840c9bfe71f8d1c5715fe6cb488520482ba29c46f7325b7b2c1211e9b',
   'browser-frame-whole-trace-reader.ts':'36332ebb8a7a918cb8840bbee11b582992276320b2390bb4de06e87c145e7021',
   'browser-frame-track-descriptor-fragments.ts':'96ba204dce2c2172540dc143c417ba0609477015c65101c7999d5ea48de31ada'
  },
  reviewedClock3Phase:{
   'browser-frame-ordered-state.ts':'525c9571f58a37e22789704f44767d52d4a1931541abb243dbf737229dad401b',
   'browser-frame-whole-trace-reader.ts':'9ad412eee489b30ee012b2bdea79a792bff1028dedc3554e35143f5f43aec562',
   'browser-frame-native-clock3.ts':'f16ba6936b1411adf357cf71509453e868ccf846a6f5e734c8f677dc6cb972e9'
  },
  reviewedCompactEvidence:{
   'browser-frame-ordered-state.ts':'8d89132ec9e9422f91a5bcd6e686b070538b4e8b428676eaaf9bf647eb9bdeac',
   'browser-frame-whole-trace-reader.ts':'7f055ed38dae36a2a4322377c67d9da39bbd48952bc5e2d82707b0bef21003e4',
   'browser-frame-native-clock3.ts':'6eb9ac399e61249fc45cf5fb273a8797ebc98cb05d25a5a8c104da505b363b52'
  },
  reviewedFramePresentedClockLayout:{
   'browser-frame-packet-fragments.ts':'bff8611ca4a6933461d00c4c108ac13afc0ae02356fc5b1bb6d4dc27de896909',
   'browser-frame-track-event-fragments.ts':'222da6353dd5f6d0b107227bf19ca63a764b131644823e85e6cff266e41e3c21',
   'browser-frame-ordered-state.ts':'264a70018bb978a2aec2058349ddde17135112b554db5cb7b5aff539623166d2',
   'browser-frame-whole-trace-reader.ts':'742989717efebf8e515f598a66c3c0fdf1f8d8885f2c05e5525836a6714f7c88'
  }
 }
});
const AUTHORITY=freeze({
 clockAdmission:'not_evaluated',nativeClockSupport:false,targetAdmission:'not_evaluated',
 targetLifetime:'unestablished',presentation:'not_evaluated',population:'not_evaluated',
 metric:'not_evaluated',performance:'not_evaluated',evaluationEligibility:false,
 scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'
} as const);
export type SameTraceClock3IntervalReason='unsupported-policy'|'invalid-mark-names'|'owned-input-unavailable'|
 'study-unavailable'|'raw-drop-unavailable'|'unexplained-raw-drop'|'unexplained-sequence-state'|
 'mark-inventory-unavailable'|'mark-cardinality'|'mark-domain-unavailable'|'clock3-profile-unavailable'|
 'descriptor-identity-unavailable'|'timestamp-unavailable'|'mark-order'|'result-capacity';
interface MarkWitness {
 packetIndex:number;eventStart:number;eventValueStart:number;eventEnd:number;bodySHA256:string;rawTimestamp:string;
}
interface IntervalWitness {
 input:{bytes:number;sha256:string};
 reader:{kind:string;EOF:boolean;closed:boolean;identityMatch:boolean;hashMatch:boolean;reads:number};
 manifests:{packetSHA256:string;transitionSHA256:string};
 compatibility:{id:string;parserPin:string;interpretationPin:string};
 rawDropCounts:{nonzeroDeclarations:number;explainedDeclarations:number;unexplainedDeclarations:number;contradictoryDeclarations:number};
 semanticSequenceStartCounts:{raw:number;explained:number;unexplained:number;contradictions:number};
 marks:readonly [MarkWitness,MarkWitness];
 domain:{clockId:'3';machineStatus:'absent';sequenceIndex:number;sequenceId:string;intervalVersion:number;trackUuid:string};
 identity:{trackUuid:string;parentUuid:string;pid:string;tid:string;processStartGeneration:string};
 examined:{snapshots:number;clockEntries:number;relevantClock3Entries:number;descriptors:number;matchingThreadDescriptors:number;matchingParentDescriptors:number};
}
interface BaseResult {policy:typeof SAME_TRACE_CLOCK3_INTERVAL_POLICY;durationNs:null;inputOrigin:'not_authenticated';authority:typeof AUTHORITY}
export type SameTraceClock3IntervalResult=Readonly<BaseResult&(
 {status:'unavailable';reason:SameTraceClock3IntervalReason;traceIntervalNs:null;witness:null}|
 {status:'same-trace-clock3-interval-diagnostic';reason:null;traceIntervalNs:string;witness:IntervalWitness}
)>;
function unavailable(reason:SameTraceClock3IntervalReason):SameTraceClock3IntervalResult {
 return freeze({policy:SAME_TRACE_CLOCK3_INTERVAL_POLICY,status:'unavailable',reason,traceIntervalNs:null,durationNs:null,inputOrigin:'not_authenticated',authority:AUTHORITY,witness:null});
}
function markNames(value:unknown):[string,string]|null {
 // Proxy detection precedes every reflective operation. Inspect descriptors before values.
 if(value===null||typeof value!=='object'||types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const keys=Reflect.ownKeys(value);if(keys.length!==3||!keys.every(k=>k==='0'||k==='1'||k==='length'))return null;
 const length=Object.getOwnPropertyDescriptor(value,'length'),first=Object.getOwnPropertyDescriptor(value,'0'),second=Object.getOwnPropertyDescriptor(value,'1');
 if(length?.value!==2||!first||!second||!('value'in first)||!('value'in second))return null;
 const a:unknown=first.value,b:unknown=second.value;
 const valid=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&Buffer.byteLength(s)<=256&&!/\p{Cc}/u.test(s)&&!/[\uD800-\uDFFF]/u.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''));
 return valid(a)&&valid(b)&&a!==b?[a,b]:null;
}
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const uint64=(s:unknown):s is string=>typeof s==='string'&&/^(0|[1-9][0-9]*)$/.test(s)&&(s.length<20||(s.length===20&&s<='18446744073709551615'));
const nonzero=(s:unknown):s is string=>uint64(s)&&s!=='0';
const index=(n:number)=>Number.isSafeInteger(n)&&n>=0;
function markWitness(c:WholeUserTimingCandidate):MarkWitness {
 return {packetIndex:c.packetIndex,eventStart:c.eventStart,eventValueStart:c.eventValueStart,eventEnd:c.eventEnd,bodySHA256:c.bodySHA256,rawTimestamp:c.rawTimestamp!};
}
/** One source-owned original read. Caller JSON and inferred clock conversions are never inputs. */
export function readSameTraceClock3Interval(reference:unknown,exactTwoMarkNames:unknown,fixedPolicy:unknown):SameTraceClock3IntervalResult {
 if(fixedPolicy!==SAME_TRACE_CLOCK3_INTERVAL_POLICY)return unavailable('unsupported-policy');
 const names=markNames(exactTwoMarkNames);if(!names)return unavailable('invalid-mark-names');
 const read=readWholeUserTimingTraceV8(reference,WHOLE_USER_TIMING_V8_POLICY),s=read.study,r=read.reader;
 if(!read.fullInputVerified||!read.structuralContainerEOF||!r.EOF||!r.closed||!r.identityMatch||!r.hashMatch||r.kind!=='source-owned-persisted-file')return unavailable('owned-input-unavailable');
 if(read.policy!==WHOLE_USER_TIMING_V8_POLICY||read.status!=='complete-whole-annotation-diagnostic'||read.reason!==null||!s||s.policy!==WHOLE_USER_TIMING_V8_POLICY||s.status!=='whole-annotation-study'||s.reason!==null||!s.framingBoundaryComplete||s.semanticProcessing!=='complete-supported-schema'||s.inputRef.bytes!==r.bytes||s.inputRef.sha256!==r.sha256||!hash(r.sha256)||!hash(s.packetManifestSHA256)||!hash(s.transitionManifestSHA256))return unavailable('study-unavailable');
 // Nested pure-study physical/structural EOF deliberately remain false.
 const raw=s.rawDropInventory;
 if(raw.status!=='complete-supported-header-declarations'||raw.facts.length>64||raw.nonzeroDeclarations!==raw.facts.length)return unavailable('raw-drop-unavailable');
 let explained=0,unexplained=0;const seenPackets=new Set<number>();
 for(const fact of raw.facts){
  if(!index(fact.packetIndex)||fact.packetIndex>=s.counters.packets||seenPackets.has(fact.packetIndex)||!hash(fact.bodySHA256)||!nonzero(fact.sequenceId)||!nonzero(fact.previousPacketDropped))return unavailable('raw-drop-unavailable');
  seenPackets.add(fact.packetIndex);
  const good=fact.previousPacketDropped==='1'&&fact.firstPacketOnSequence===true&&fact.priorSeen===false;
  if(fact.classification!==(good?'explained':'unexplained'))return unavailable('raw-drop-unavailable');
  if(good)explained++;else unexplained++;
 }
 if(raw.explainedDeclarations!==explained||raw.unexplainedDeclarations!==unexplained||raw.contradictoryDeclarations!==0)return unavailable('raw-drop-unavailable');
 if(unexplained!==0)return unavailable('unexplained-raw-drop');
 if(s.sequenceStart.unexplained!==0||s.sequenceStart.contradictions!==0||s.sequenceStart.raw!==s.sequenceStart.explained)return unavailable('unexplained-sequence-state');
 if(s.markInventoryAdmission!=='resolved-supported-roots'||s.counters.withheldRootInventories!==0||s.counters.markWithheld!==0||s.candidates.some(c=>c.kind!=='literal_string')||s.evidenceInventory.status!=='complete-supported-observations')return unavailable('mark-inventory-unavailable');
 const starts=s.candidates.filter(c=>c.kind==='literal_string'&&c.value===names[0]),ends=s.candidates.filter(c=>c.kind==='literal_string'&&c.value===names[1]);
 if(starts.length!==1||ends.length!==1)return unavailable('mark-cardinality');
 const start=starts[0]!,end=ends[0]!;
 for(const c of [start,end]){
  if(c.kind!=='literal_string'||c.reason!==null||!['annotation','event_name'].includes(c.representation)||!index(c.packetIndex)||c.packetIndex>=s.counters.packets||!index(c.eventStart)||!index(c.eventValueStart)||!index(c.eventEnd)||c.eventStart>=c.eventValueStart||c.eventValueStart>=c.eventEnd||!hash(c.bodySHA256)||c.timestampStatus!=='raw-unqualified'||c.clockSource!=='packet'||c.clockId!=='3'||!nonzero(c.trackUuid)||!nonzero(c.sequenceId)||!index(c.sequenceIndex)||!index(c.intervalVersion)||c.machineStatus!=='absent'||c.machineId!==null)return unavailable('mark-domain-unavailable');
 }
 if(start.sequenceIndex!==end.sequenceIndex||start.sequenceId!==end.sequenceId||start.intervalVersion!==end.intervalVersion||start.trackUuid!==end.trackUuid)return unavailable('mark-domain-unavailable');
 const observations=s.evidenceInventory.observations;
 let snapshots=0,clockEntries=0,relevantClock3Entries=0,descriptors=0;
 for(const row of observations){
  if(row.kind==='track_descriptor'){descriptors++;continue;}
  snapshots++;clockEntries+=row.clocks.length;
  if(row.machineContext.status!=='absent')continue;
  for(const c of row.clocks)if(c.clockId==='3'){
   relevantClock3Entries++;
   if(!uint64(c.timestamp)||Object.hasOwn(c,'unitMultiplierNs')||Object.hasOwn(c,'isIncremental'))return unavailable('clock3-profile-unavailable');
  }
 }
 if(relevantClock3Entries===0)return unavailable('clock3-profile-unavailable');
 const tracks=observations.filter(row=>row.kind==='track_descriptor'&&row.machineContext.status==='absent'&&row.fields.uuid===start.trackUuid);
 const first=tracks[0];if(!first||first.kind!=='track_descriptor')return unavailable('descriptor-identity-unavailable');
 const f=first.fields;
 if(!f.thread||f.process||!nonzero(f.parentUuid)||f.parentUuid===start.trackUuid||f.thread.pid===undefined||f.thread.tid===undefined)return unavailable('descriptor-identity-unavailable');
 const threadIdentity=JSON.stringify([f.uuid,f.parentUuid,f.thread.pid,f.thread.tid]);
 let established=false;
 for(const row of tracks){
  if(row.kind!=='track_descriptor'||!row.fields.thread||row.fields.process||JSON.stringify([row.fields.uuid,row.fields.parentUuid,row.fields.thread.pid,row.fields.thread.tid])!==threadIdentity)return unavailable('descriptor-identity-unavailable');
  const scope=row.sequenceContext;
  if(scope.status==='present'&&scope.sequenceIndex===start.sequenceIndex&&scope.sequenceId===start.sequenceId&&scope.intervalVersion===start.intervalVersion&&row.packetIndex<=start.packetIndex)established=true;
 }
 if(!established)return unavailable('descriptor-identity-unavailable');
 const parents=observations.filter(row=>row.kind==='track_descriptor'&&row.machineContext.status==='absent'&&row.fields.uuid===f.parentUuid);
 const parent=parents[0];if(!parent||parent.kind!=='track_descriptor')return unavailable('descriptor-identity-unavailable');
 const p=parent.fields;
 if(!p.process||p.thread||p.process.pid!==f.thread.pid||p.process.startTimestampNs===undefined)return unavailable('descriptor-identity-unavailable');
 // Process start is an opaque generation, never compared against event clocks.
 const parentIdentity=JSON.stringify([p.uuid,p.parentUuid,p.process.pid,p.process.startTimestampNs]);
 for(const row of parents)if(row.kind!=='track_descriptor'||row.fields.thread||!row.fields.process||JSON.stringify([row.fields.uuid,row.fields.parentUuid,row.fields.process.pid,row.fields.process.startTimestampNs])!==parentIdentity)return unavailable('descriptor-identity-unavailable');
 if(!uint64(start.rawTimestamp)||!uint64(end.rawTimestamp))return unavailable('timestamp-unavailable');
 if(end.packetIndex<=start.packetIndex)return unavailable('mark-order');
 // Subtraction is last: both values are canonical uint64 decimal strings.
 const a=BigInt(start.rawTimestamp),b=BigInt(end.rawTimestamp);
 if(b<=a)return unavailable('mark-order');
 const witness:IntervalWitness={
  input:{bytes:r.bytes,sha256:r.sha256},
  reader:{kind:r.kind,EOF:r.EOF,closed:r.closed,identityMatch:r.identityMatch,hashMatch:r.hashMatch,reads:r.reads},
  manifests:{packetSHA256:s.packetManifestSHA256,transitionSHA256:s.transitionManifestSHA256},
  compatibility:{id:SAME_TRACE_CLOCK3_INTERVAL_COMPATIBILITY.id,parserPin:PARSER_PIN,interpretationPin:INTERPRETATION_PIN},
  rawDropCounts:{nonzeroDeclarations:raw.nonzeroDeclarations,explainedDeclarations:raw.explainedDeclarations,unexplainedDeclarations:raw.unexplainedDeclarations,contradictoryDeclarations:raw.contradictoryDeclarations},
  semanticSequenceStartCounts:{...s.sequenceStart},marks:[markWitness(start),markWitness(end)],
  domain:{clockId:'3',machineStatus:'absent',sequenceIndex:start.sequenceIndex,sequenceId:start.sequenceId!,intervalVersion:start.intervalVersion,trackUuid:start.trackUuid!},
  identity:{trackUuid:start.trackUuid!,parentUuid:f.parentUuid,pid:f.thread.pid,tid:f.thread.tid,processStartGeneration:p.process.startTimestampNs},
  examined:{snapshots,clockEntries,relevantClock3Entries,descriptors,matchingThreadDescriptors:tracks.length,matchingParentDescriptors:parents.length}
 };
 const result:SameTraceClock3IntervalResult={policy:SAME_TRACE_CLOCK3_INTERVAL_POLICY,status:'same-trace-clock3-interval-diagnostic',reason:null,traceIntervalNs:(b-a).toString(),durationNs:null,inputOrigin:'not_authenticated',authority:AUTHORITY,witness};
 if(Buffer.byteLength(JSON.stringify(result))>OUTPUT_BYTES)return unavailable('result-capacity');
 return freeze(result);
}
