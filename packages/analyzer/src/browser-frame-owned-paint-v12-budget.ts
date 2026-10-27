import {types} from 'node:util';
import {WireError} from './browser-frame-protobuf-wire.js';
/** Final reviewed v3 policy; historical limits remain untouched. */
export const OWNED_PAINT_V12_LIMITS = Object.freeze({
  "inputBytes": 33554432,
  "chunkBytes": 65536,
  "packetBytes": 262144,
  "frames": 131072,
  "readCalls": 4096,
  "semanticFields": 4194304,
  "semanticMembers": 1048576,
  "routeFields": 4194304,
  "oldCallbackWork": 1048576,
  "repeatedWork": 4194304,
  "references": 524288,
  "internUpdates": 32768,
  "resetReleaseVisits": 32768,
  "sequenceKeys": 128,
  "sequenceKeyUTF8": 16384,
  "historyDefinitions": 8192,
  "historyUTF8": 1048576,
  "historyUTF16": 1048576,
  "liveInternEntries": 2048,
  "liveInternUTF8": 262144,
  "liveInternUTF16": 262144,
  "defaultsVersions": 1024,
  "defaultsUTF8": 1048576,
  "disclosures": 4096,
  "rawDropRows": 256,
  "metadataFacts": 4096,
  "metadataOccurrences": 8192,
  "clockChildren": 4096,
  "timestampSlots": 4096,
  "layoutEntrySlots": 16384,
  "metadataCanonicalRowBytes": 1048576,
  "metadataCanonicalBytes": 4194304,
  "metadataKeyBytes": 8388608,
  "metadataOccurrenceBytes": 8388608,
  "fullMetadataRowBytes": 16777216,
  "candidateRows": 256,
  "candidateUTF8": 65536,
  "paintRows": 128,
  "paintUTF8": 1048576,
  "anchors": 64,
  "diagnostics": 1,
  "currentLogicalBytes": 536870912,
  "retainedLogicalBytes": 67108864,
  "currentLogicalSlots": 8388608,
  "currentDynamicUTF16": 33554432,
  "cumulativeBufferBytes": 1073741824,
  "cumulativeUTF16Units": 1073741824,
  "cumulativeLogicalSlots": 4294967296,
  "operationCalls": 262144,
  "operationDimensionTotal": 17179869184,
  "totalLogicalWork": 17179869184,
  "canonicalGeneratedBytes": 67108864,
  "canonicalHashBytes": 67108864,
  "canonicalComparisonBytes": 268435456,
  "manifestBytes": 134217728,
  "manifestUpdates": 1048576,
  "utf8WidthScanUnits": 268435456,
  "canonicalPreflightNodes": 16777216,
  "canonicalPreflightStringUnits": 268435456,
  "outputBytes": 33554432,
  "outputNodes": 1048576,
  "outputObjects": 262144,
  "outputKeys": 524288,
  "outputUTF16Units": 16777216,
  "outputEscapedBytes": 33554432,
  "outputStringUTF8": 4096,
  "outputDepth": 16,
  "closureReservedWork": 268435456,
  "failureOutputBytes": 65536,
  "failureOutputNodes": 8192,
  "fixedBookkeepingBytes": 8388608,
  "slabAndChunkBytes": 1048576,
  "sourceFiles": 64,
  "sourceBytes": 16777216,
  "sourcePasses": 2,
  "sourceReadCallsPerFile": 258,
  "sourceManifestBytes": 1048576,
  "runtimeBytes": 268435456,
  "runtimeReadCalls": 8192,
  "runtimePasses": 2,
  "requestBytes": 65536,
  "stdoutBytes": 34603008,
  "stderrBytes": 65536,
  "forwardDeadlineMS": 60000,
  "cleanupGraceMS": 5000,
  "referenceJSONUnits": 32768,
  "comparatorJSONUnits": 4096,
  "outputWriteBytes": 33554432,
  "outputReadbackBytes": 33554433,
  "outputWriteCalls": 1024,
  "outputReadbackCalls": 1024,
  "normalOutputReservedWork": 1073741824,
  "parentTotalLogicalWork": 34359738368,
  "parentChildReservedWork": 17179869184,
  "parentCurrentLogicalBytes": 2147483648,
  "requestNodes": 4096,
  "requestDepth": 16,
  "requestStringUTF8": 4096,
  "manifestNodes": 65536,
  "manifestDepth": 16,
  "manifestStringUTF8": 4096,
  "childResponseNodes": 1048576,
  "childResponseDepth": 24,
  "childResponseStringUTF8": 4096,
  "readerReservedWork": 2147483648
} as const);

const L = OWNED_PAINT_V12_LIMITS;
const operationKeys = 'calls wireByteReads fieldChargeWork memberChargeWork callbackLocalWork loopRecordWork copyBytes hashBytes utf8DecodeBytes terminalChecks resultRecords diagnosticRecords parserAndOutputScanUnits parsedNodes logicalSlots dynamicUTF16Units comparisonScanUnits structuralWork totalLogicalWork reservedByteBufferOccupancy reservedUTF16Occupancy'.split(' ');
const successfulKeys = 'semanticFields semanticMembers routeFields oldCallbackWork repeatedWork references internUpdates resetReleaseVisits sequenceKeys historyDefinitions defaultsVersions metadataFacts metadataOccurrences clockChildren timestampSlots layoutEntrySlots candidateRows paintRows rawDropRows'.split(' ');
const cumulativeKeys = 'requestedReadBytes readCalls acknowledgedReadBytes inputCopyBytes inputHashBytes frameCopyBytes frameHashBytes manifestBytes manifestUpdates utf8WidthScanUnits canonicalPreflightNodes canonicalPreflightStringUnits canonicalGeneratedBytes canonicalHashBytes canonicalComparisonBytes fullMetadataRowBytes metadataFactKeyBytes metadataOccurrenceBytes allocatedBufferBytes allocatedUTF16Units allocatedLogicalSlots wrapperWork outputPreflightNodes outputStringUnits outputEncodedBytes outputWriteBytes outputReadbackBytes sourceReadBytes sourceHashBytes runtimeReadBytes runtimeHashBytes closureReservedWork totalLogicalWork'.split(' ');
const retainedKeys = 'liveInternEntries liveInternUTF8 liveInternUTF16 historyUTF8 historyUTF16 defaultsUTF8 metadataUTF8 candidateUTF8 paintUTF8 indexKeyUTF8'.split(' ');
type NumericRecord = Record<string, number>;
export type OperationTotalsV12 = NumericRecord;
export interface JSONMeasureV12 {nodes:number;objects:number;keys:number;utf8Bytes:number;utf16Units:number;escapedBytes:number;depth:number}
export interface RepresentationV12 {bufferBytes:number;utf16Units:number;logicalSlots:number;fixedRecordBytes:number;logicalBytes:number}
export interface UsageV12 {
 coverage:'complete'|'partial';successful:NumericRecord;
 reserved:Record<'packet'|'state'|'descriptor'|'comparator'|'referenceJSON',OperationTotalsV12>;
 cumulative:NumericRecord;retained:NumericRecord;current:RepresentationV12;highwater:RepresentationV12;finalOutput:JSONMeasureV12;
}
const zeros = (keys:readonly string[]):NumericRecord => Object.fromEntries(keys.map(k=>[k,0]));
const representation = ():RepresentationV12 => ({bufferBytes:0,utf16Units:0,logicalSlots:0,fixedRecordBytes:0,logicalBytes:0});
const measurement = ():JSONMeasureV12 => ({nodes:0,objects:0,keys:0,utf8Bytes:0,utf16Units:0,escapedBytes:0,depth:0});
export function emptyOperationV12():OperationTotalsV12{return zeros(operationKeys);}
export function createUsageV12():UsageV12{return {coverage:'complete',successful:zeros(successfulKeys),reserved:{packet:emptyOperationV12(),state:emptyOperationV12(),descriptor:emptyOperationV12(),comparator:emptyOperationV12(),referenceJSON:emptyOperationV12()},cumulative:zeros(cumulativeKeys),retained:zeros(retainedKeys),current:representation(),highwater:representation(),finalOutput:measurement()};}
export function cloneUsageV12(u:UsageV12):UsageV12{return {coverage:u.coverage,successful:{...u.successful},reserved:{packet:{...u.reserved.packet},state:{...u.reserved.state},descriptor:{...u.reserved.descriptor},comparator:{...u.reserved.comparator},referenceJSON:{...u.reserved.referenceJSON}},cumulative:{...u.cumulative},retained:{...u.retained},current:{...u.current},highwater:{...u.highwater},finalOutput:{...u.finalOutput}};}
export function checkedAddV12(a:number,b:number,cap:number,dimension:string):number{
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||b>cap-a)throw new WireError('capacity-'+dimension);
 return a+b;
}
function helperLength(m:unknown):asserts m is number{if(typeof m!=='number'||!Number.isSafeInteger(m)||m<0||m>L.packetBytes)throw new WireError('invalid-helper-byte-length');}
function helperReservation(m:number,b:number,u:number):Readonly<OperationTotalsV12>{
 const f=Math.min(8193,m+1),q=256+64*(f+b),t=512+20*(f+b)+u;
 return Object.freeze({...emptyOperationV12(),calls:1,wireByteReads:m,fieldChargeWork:f,memberChargeWork:b,loopRecordWork:q,copyBytes:m,utf8DecodeBytes:u,terminalChecks:4,resultRecords:1,reservedByteBufferOccupancy:m,reservedUTF16Occupancy:t,totalLogicalWork:m+f+b+q+m+u+5});
}
export function stateBodyReservationV12(m:unknown,kind:'defaults'|'interned_names'|'clock_snapshot'):Readonly<OperationTotalsV12>{helperLength(m);if(kind!=='defaults'&&kind!=='interned_names'&&kind!=='clock_snapshot')throw new WireError('unsupported-state-body-kind');return helperReservation(m,Math.min(4097,m+1),kind==='interned_names'?Math.min(32768,m):0);}
export function descriptorReservationV12(m:unknown):Readonly<OperationTotalsV12>{helperLength(m);return helperReservation(m,Math.min(2,m),0);}
function parseReservation(p:number):Readonly<OperationTotalsV12>{return Object.freeze({...emptyOperationV12(),calls:1,parserAndOutputScanUnits:4*p,parsedNodes:p,logicalSlots:8*p,dynamicUTF16Units:8*p,comparisonScanUnits:4*p,structuralWork:32*p,totalLogicalWork:52*p,terminalChecks:4,resultRecords:1});}
export function comparatorReservationV12(){return parseReservation(4096);}
export function referenceJSONReservationV12(){return parseReservation(32768);}

/** Exact source-owned JSON width; charged visits precede every role/string access. */
export function measureOwnedJSONV12(value:unknown,charge:(n:number)=>void=()=>{},maxString=L.outputStringUTF8,schema?:(v:unknown,keys:readonly PropertyKey[]|null,path:string)=>void,pathLease?:(units:number)=>()=>void):JSONMeasureV12{
 const out=measurement(),seen=new Set<object>();
 function string(s:string){
  out.escapedBytes+=2;out.utf16Units+=s.length;let width=0;
  for(let i=0;i<s.length;i++){
   charge(2);const c=s.charCodeAt(i);let bytes:number;
   if(c<32){bytes=c===8||c===9||c===10||c===12||c===13?2:6;width++;}
   else if(c===34||c===92){bytes=2;width++;}
   else if(c<128){bytes=1;width++;}
   else if(c<2048){bytes=2;width+=2;}
   else if(c>=55296&&c<=56319&&i+1<s.length){charge(1);const next=s.charCodeAt(i+1);if(next>=56320&&next<=57343){bytes=4;width+=4;i++;}else{bytes=6;width+=3;}}
   else if(c>=55296&&c<=57343){bytes=6;width+=3;}
   else{bytes=3;width+=3;}
   out.escapedBytes+=bytes;
   if(width>maxString||out.escapedBytes>L.outputEscapedBytes)throw new WireError('capacity-outputEscapedBytes');
  }
  out.utf8Bytes+=width;
 }
 function visit(v:unknown,depth:number,path:string):void{
  charge(8);out.nodes++;out.depth=Math.max(out.depth,depth);
  if(out.nodes>L.outputNodes||depth>L.outputDepth)throw new WireError('capacity-outputNodes');
  if(schema&&(v===null||typeof v!=='object')){charge(256+2*(typeof v==='string'?v.length:0));schema(v,null,path);}
  if(v===null||typeof v==='boolean'){out.escapedBytes+=v===false?5:4;return;}
  if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)throw new WireError('result-shape');out.escapedBytes+=String(v).length;return;}
  if(typeof v==='string'){string(v);return;}
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v))throw new WireError('result-shape');
  const array=Array.isArray(v);if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype)||Object.getOwnPropertyDescriptor(Object.prototype,'toJSON')||array&&Object.getOwnPropertyDescriptor(Array.prototype,'toJSON'))throw new WireError('result-shape');
  out.objects++;if(out.objects>L.outputObjects)throw new WireError('capacity-outputObjects');seen.add(v);
  // Every source-owned object role has <=64 fixed keys. Arrays have a native
  // data length checked before allocating their bounded own-key list.
  const arraySize=array?Object.getOwnPropertyDescriptor(v,'length')?.value:0;
  if(array&&(!Number.isSafeInteger(arraySize)||arraySize<0||arraySize>L.outputNodes))throw new WireError('result-shape');
  charge(array?32*(arraySize+1):256);const names=Reflect.ownKeys(v);
  if(!array&&names.length>64)throw new WireError('result-shape');if(schema){charge(256+64*names.length);schema(v,names,path);}out.escapedBytes+=2;
  if(array){
   const d=Object.getOwnPropertyDescriptor(v,'length'),n=d?.value;
   if(!Number.isSafeInteger(n)||n<0||n>L.outputNodes||names.length!==n+1)throw new WireError('result-shape');
   for(let i=0;i<n;i++){charge(2);const index=String(i),entry=Object.getOwnPropertyDescriptor(v,index);if(!entry||!('value'in entry))throw new WireError('result-shape');if(i)out.escapedBytes++;const release=pathLease?.(path.length+index.length+1);try{visit(entry.value,depth+1,schema?path+'.'+index:'');}finally{release?.();}}
  }else for(let i=0;i<names.length;i++){
   charge(4);const key=names[i];if(typeof key!=='string'||key==='toJSON'||key.length>128)throw new WireError('result-shape');
   out.keys++;out.nodes++;if(out.keys>L.outputKeys||out.nodes>L.outputNodes)throw new WireError('capacity-outputKeys');
   if(i)out.escapedBytes++;string(key);out.escapedBytes++;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d))throw new WireError('result-shape');const release=pathLease?.(path.length+key.length+1);try{visit(d.value,depth+1,schema?(path?path+'.'+key:key):'');}finally{release?.();}
  }
  seen.delete(v);
 }
 visit(value,0,'');if(out.escapedBytes>L.outputBytes||out.utf16Units>L.outputUTF16Units)throw new WireError('capacity-outputBytes');return out;
}

const studyKeys='policy status reason inputRef framingBoundaryComplete semanticProcessing markInventoryAdmission paintInventoryAdmission state evidence rawDrop sequenceStart candidates paint supportedLegacyFramePresented counters usage manifests anchors diagnostics authority metrics';
const sourceKeys='packetIndex rootBodyStart packetBytes packetSHA256',spanKeys='packetIndex scope fieldNumber wireType start valueStart end',headerKeys='timestamp timestampClockId sequenceFlags incrementalStateCleared previousPacketDropped firstPacketOnSequence';
const schemaKeys:Record<string,string>={
 state:'sequences definitions defaults','state.sequences.*':'sequenceIndex machine sequenceId valid epoch defaultsVersionIndex',
 'state.definitions.*':'definitionIndex sequenceIndex epoch machine sequenceId table iid value source definedAt',
 'state.defaults.*':'versionIndex sequenceIndex epoch source location timestampClockId trackEventDefaultsPresent trackUuid counterTrackUuidsPresent counterTrackUuidCount doubleCounterTrackUuidsPresent doubleCounterTrackUuidCount',
 evidence:'status codec domain facts occurrences',rawDrop:'status facts','rawDrop.facts.*':'source machine sequenceId priorSeen headers classification',sequenceStart:'raw explained unexplained contradictions',
 'candidates.*':'source eventLocation machine sequenceId sequenceIndex epoch defaultsVersionIndex kind representation value reason annotationIndex nameSource definitionIndex clock track rawTimestamp timestampStatus',
 'paint.*':'status domain context shape family references rule','paint.*.context':'source eventLocation eventBodySHA256 machine sequenceId sequenceIndex epoch defaultsVersionIndex headers clock track',
 'paint.*.shape':'variant frame afterUserInput legacy opaque','paint.*.shape.legacy':'phase location phaseLocation','paint.*.shape.opaque':'location bytes sha256',
 'paint.*.rule':'bodyPolicy adapterPolicy chromiumRevision perfettoRevision sourceABIManifestSHA256 compatibilityManifestSHA256 ownerPolicy',
 'evidence.facts.*.fields':'uuid parentUuid process thread',
 manifests:'packetSHA256 transitionSHA256 definitionSHA256 metadataSHA256 paintSHA256',
 'anchors.*':'frameIndex keyStart keyEnd lengthStart lengthEnd bodyStart bodyEnd bodyBytes bodySHA256','diagnostics.*':'code phase packetIndex component cause',
 authority:'nativeSupported qualificationEligibility evaluationEligibility scoringEligibility rankingEligibility clock target presentation population inputOrigin',metrics:'FPS rate latency duration',
 reader:'kind EOF closed identityMatch hashMatch reads bytes sha256 before after',inputRef:'bytes sha256',
 usage:'coverage successful reserved cumulative retained current highwater finalOutput',
};
/** Fixed NEW output roles, validated in the same full preflight as JSON sizing. */
function validateOutputRoleV12(v:unknown,names:readonly PropertyKey[]|null,rawPath:string){
 const path=rawPath==='study'?'':rawPath.replace(/^study\./,'').replace(/\.\d+(?=\.|$)/g,'.*');
 if(v===null||typeof v!=='object'){validateOutputScalarV12(v,path,rawPath);return;}
 if(Array.isArray(v)){validateOutputArrayV12(v,path,rawPath);return;}
 if(!names)throw new WireError('result-shape');
 const data=(key:string)=>Object.getOwnPropertyDescriptor(v,key)?.value;
 let expected:string|undefined;
 if(path==='')expected=names.includes('inputRef')?studyKeys:'policy status reason fullInputVerified structuralContainerEOF reader study authority metrics usage';
 else if(path==='counters')expected=counterSchemaV12;
 else if(path==='usage.successful')expected=successfulKeys.join(' ');
 else if(path==='usage.cumulative')expected=cumulativeKeys.join(' ');
 else if(path==='usage.retained')expected=retainedKeys.join(' ');
 else if(path==='usage.reserved')expected='packet state descriptor comparator referenceJSON';
 else if(/^usage\.reserved\.[a-zA-Z]+$/.test(path))expected=operationKeys.join(' ');
 else if(path==='usage.current'||path==='usage.highwater')expected='bufferBytes utf16Units logicalSlots fixedRecordBytes logicalBytes';
 else if(path==='usage.finalOutput')expected='nodes objects keys utf8Bytes utf16Units escapedBytes depth';
 else if(path==='evidence.facts.*')expected=data('kind')==='track_descriptor'?'kind fields propertyOrder':'kind primaryTraceClock clocks';
 else if(path==='paint.*.references.*')expected=names.includes('status')?'channel iid location status definition reason':'channel iid location definition';
 else if(path.endsWith('.definition'))expected='definitionIndex source definedAt sequenceIndex epoch table iid value';
 else if(path.endsWith('.machine')||/^evidence\.occurrences\.\*\.\*$/.test(path)&&names.includes('status'))expected='status id';
 else if(path.endsWith('.source')||/^evidence\.occurrences\.\*\.\*$/.test(path)&&names.includes('rootBodyStart'))expected=sourceKeys;
 else if(path.endsWith('.headers')||/^evidence\.occurrences\.\*\.\*$/.test(path)&&names.includes('timestampClockId'))expected=headerKeys;
 else if(path.endsWith('.location')||path.endsWith('.definedAt')||path.endsWith('.eventLocation')||path.endsWith('.phaseLocation')||/^evidence\.occurrences\.\*\.\*$/.test(path)&&names.includes('valueStart'))expected=spanKeys;
 else if(path.endsWith('.clock')||path.endsWith('.track'))expected='status source value defaultsVersionIndex reason';
 else if(path.endsWith('.process'))expected='pid startTimestampNs';else if(path.endsWith('.thread'))expected='pid tid';
 else expected=schemaKeys[path];
 const keys=expected?.split(' ');if(!keys||keys.length!==names.length||keys.some((key,i)=>key!==names[i]))throw new WireError('result-shape');
 if(path==='metrics'&&keys.some(key=>data(key)!==null))throw new WireError('result-shape');
 if(path==='authority'&&(keys.slice(0,5).some(key=>data(key)!==false)||keys.slice(5,9).some(key=>data(key)!=='not_evaluated')||data('inputOrigin')!=='not_authenticated'))throw new WireError('result-shape');
 if(expected===sourceKeys&&(!/^[a-f0-9]{64}$/.test(data('packetSHA256'))||!Number.isSafeInteger(data('rootBodyStart'))))throw new WireError('result-shape');
 if(path==='inputRef'&&(typeof data('sha256')!=='string'||!/^[a-f0-9]{64}$/.test(data('sha256'))))throw new WireError('result-shape');
 if(expected===spanKeys){const start=data('start'),valueStart=data('valueStart'),end=data('end');if(!(start<=valueStart&&valueStart<=end)||![0,1,2,5].includes(data('wireType')))throw new WireError('result-shape');}
 if(path===''){
  const isStudy=names.includes('inputRef');if(data('policy')!=='private-owned-whole-ordered-paint-r-v12'||![isStudy?'complete-owned-selected-schema':'complete-owned-whole-diagnostic','unavailable'].includes(data('status')))throw new WireError('result-shape');
  if(data('status')!=='unavailable'&&data('reason')!==null||!isStudy&&data('fullInputVerified')===false&&data('study')!==null)throw new WireError('result-shape');
 }
 if(expected==='status id'&&!(data('status')==='absent'&&data('id')===null||data('status')==='present'&&unsignedV12(data('id'),4294967295n)))throw new WireError('result-shape');
 if(path==='evidence'&&(data('codec')!==2||data('domain')!=='owned-paint-clock-layout-v12'||!['complete-supported-compact-observations','unavailable'].includes(data('status'))))throw new WireError('result-shape');
 if(path==='rawDrop'&&!['complete-supported-header-declarations','unavailable'].includes(data('status')))throw new WireError('result-shape');
 if(path==='paint.*'&&(data('domain')!=='owned-ordered-paint-r-v12'||!['matched','withheld'].includes(data('status'))||data('status')==='withheld'&&data('family')!==null))throw new WireError('result-shape');
 if(path==='paint.*'){
  const refs=data('references');if(!Array.isArray(refs)||types.isProxy(refs)||Object.getOwnPropertyDescriptor(refs,'length')?.value!==6)throw new WireError('result-shape');
  let withheld=false;
  for(let i=0;i<6;i++){const ref=Object.getOwnPropertyDescriptor(refs,String(i))?.value;if(!ref||typeof ref!=='object'||types.isProxy(ref))throw new WireError('result-shape');const status=Object.getOwnPropertyDescriptor(ref,'status')?.value;if(status==='withheld')withheld=true;if(data('status')==='matched'&&status!==undefined)throw new WireError('result-shape');}
  if(data('status')==='withheld'&&!withheld||data('status')==='matched'&&data('family')===null)throw new WireError('result-shape');
 }
 if(path==='paint.*.shape'&&!(data('variant')==='frame-uint'?['0','1'].includes(data('afterUserInput'))&&data('opaque')===null:data('afterUserInput')===null&&data('opaque')!==null))throw new WireError('result-shape');
 if(path==='evidence.facts.*'&&!['track_descriptor','clock_snapshot_layout'].includes(data('kind')))throw new WireError('result-shape');
 if(path==='candidates.*'&&(!['literal_string','withheld'].includes(data('kind'))||data('kind')==='withheld'&&(data('value')!==null||data('representation')!=='withheld'||data('nameSource')!=='unresolved')))throw new WireError('result-shape');
 if(path.endsWith('.clock')||path.endsWith('.track')){
  if(!(data('status')==='selected'&&['packet','event','defaults'].includes(data('source'))&&unsignedV12(data('value'))&&data('reason')===null||data('status')==='unavailable'&&data('source')===null&&data('value')===null&&data('defaultsVersionIndex')===null&&['invalid_sequence_default_state','no_explicit_or_valid_default_clock','no_explicit_or_valid_default_track'].includes(data('reason'))))throw new WireError('result-shape');
 }
 if(path==='paint.*.references.*'){
  const index=Number(rawPath.split('.').at(-1));if(data('channel')!==paintChannelsV12[index])throw new WireError('result-shape');
  if(names.includes('status')&&!(data('status')==='resolved'&&data('definition')!==null&&data('reason')===null||data('status')==='withheld'&&data('definition')===null&&['invalid-sequence','incremental-dependency','missing-definition'].includes(data('reason'))))throw new WireError('result-shape');
  if(!names.includes('status')&&data('definition')===null)throw new WireError('result-shape');
 }
 if(path==='paint.*.rule'){
  const rule={bodyPolicy:'pinned-paint-timing-r-source-body-fragments-v1',adapterPolicy:'private-paint-packet-adapter-v1',chromiumRevision:'f842f52ef39fd97b449eb27cff414bf05a98ddce',perfettoRevision:'403906f4adfbf287a02e5546f8430dcc9d56b649',sourceABIManifestSHA256:'7cc69940571040a756ff03ed244ee6fbbecba7317d66decde05a153f18e90cdf',compatibilityManifestSHA256:'5e68e968605e192c835c74d74c4ddab63c9a3df844c52a1c5831236b56680fed',ownerPolicy:'private-owned-whole-ordered-paint-r-v12'};
  if(Object.entries(rule).some(([key,value])=>data(key)!==value))throw new WireError('result-shape');
 }
}
const paintChannelsV12=['eventName','category0','category1','category2','annotation0','annotation1'];
const orderTokensV12=['uuid','parentUuid','process','thread','process.pid','process.startTimestampNs','thread.pid','thread.tid'];
const scopesV12=['packet','track_event','legacy_event','frame_sink','reporter2','graphics','defaults','track_defaults','interned_data','event_category','event_name','clock_snapshot','clock','track_descriptor','process_descriptor','thread_descriptor'];
const nullablePathsV12=new Set(('reason reader.sha256 reader.before reader.after state.sequences.*.defaultsVersionIndex state.defaults.*.timestampClockId state.defaults.*.trackUuid diagnostics.*.packetIndex diagnostics.*.component diagnostics.*.cause candidates.*.defaultsVersionIndex candidates.*.value candidates.*.reason candidates.*.annotationIndex candidates.*.definitionIndex candidates.*.rawTimestamp paint.*.context.defaultsVersionIndex paint.*.shape.afterUserInput paint.*.shape.opaque paint.*.family paint.*.references.*.definition paint.*.references.*.reason evidence.facts.*.primaryTraceClock evidence.facts.*.fields.uuid evidence.facts.*.fields.parentUuid evidence.facts.*.fields.process evidence.facts.*.fields.thread evidence.facts.*.fields.process.pid evidence.facts.*.fields.process.startTimestampNs evidence.facts.*.fields.thread.pid evidence.facts.*.fields.thread.tid').split(' '));
const reasonTokensV12=new Set(('unsupported-policy byte-capacity chunk-capacity unsupported-byte-view unavailable-byte-storage read-capacity stream-reentry stream-closed truncated-varint invalid-field-number unsupported-wire-type unsupported-trace-root-field uint64-varint-overflow out-of-bounds-length packet-body-capacity frame-capacity framer-closed framer-reentry truncated-fixed-field selected-field-wrong-wire-type duplicate-selected-field non-profile-bool uint32-overflow int32-overflow string-capacity string-total-capacity invalid-utf8 field-capacity member-capacity output-byte-capacity result-shape representation-release source-model-mismatch invalid-byte-window unexpected-body-end unsupported-legacy-event duplicate-name-oneof duplicate-data-oneof annotation-wrong-wire-type duplicate-annotation-name-oneof duplicate-annotation-proto-oneof duplicate-annotation-value-oneof invalid-annotation-iid unknown-selected-enum unsupported-packet-payload unsupported-packet-payload-field-50 unsupported-packet-payload-field-133 unsupported-packet-payload-field-107 unsupported-packet-payload-field-124 unsupported-packet-payload-field-125 intern-entry-capacity invalid-intern-iid missing-intern-iid missing-intern-name duplicate-intern-iid clock-child-capacity duplicate-clock-id unsupported-state-body-kind adapter-invalid-byte-length adapter-invalid-paint-span adapter-route-duplicate-event adapter-callback-capacity adapter-invalid-input paint-r-source-shape paint-r-invalid-input paint-r-enum paint-r-envelope paint-r-inventory-unresolved paint-r-inventory-mismatch invalid-owned-input input-length missing-sequence-id zero-sequence-id unsupported-sequence-flags invalid-whole-annotation-input fragment-unavailable intern-conflict invalid-event-iid kernel-counter-range kernel-definition-scope kernel-source-span paint-inventory-domain invalid-state-body-input invalid-track-descriptor-body-input missing-or-invalid-annotation-name missing-annotation-name unresolved-annotation-name duplicate-annotation-name unsupported-mark-name-value category-resolution-withheld missing-mark-category ambiguous-mark-category missing-mark-type event-resolution-withheld missing-mark-event-name missing-mark-name ambiguous-mark-representation invalid_sequence_default_state no_explicit_or_valid_default_clock no_explicit_or_valid_default_track invalid-sequence incremental-dependency missing-definition invalid-reference reader-identity reader-path reader-drift reader-capacity reader-result reader-truncated reader-growth reader-no-eof reader-hash reader-failure reader-close reader-study-finalization structural-unavailable reader-output-capacity').split(' '));
for(const key of [...Object.keys(L),...operationKeys,...successfulKeys,...cumulativeKeys,...retainedKeys,'failureRemaining','normalRemaining','readerRemaining'])reasonTokensV12.add('capacity-'+key);
function unsignedV12(v:unknown,max=18446744073709551615n,positive=false):v is string{return typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)&&v.length<=20&&(!positive||v!=='0')&&BigInt(v)<=max;}
function signedV12(v:unknown,bits:number):boolean{if(typeof v!=='string'||! /^(0|-?[1-9][0-9]*)$/.test(v)||v.length>20)return false;const n=BigInt(v),bound=1n<<BigInt(bits-1);return n>=-bound&&n<bound;}
const integerV12=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
function validateOutputArrayV12(v:unknown[],path:string,rawPath:string){
 const n=Object.getOwnPropertyDescriptor(v,'length')!.value as number,at=(i:number)=>Object.getOwnPropertyDescriptor(v,String(i))?.value;
 const limits:Record<string,number>={'state.sequences':L.sequenceKeys,'state.definitions':L.historyDefinitions,'state.defaults':L.defaultsVersions,'evidence.facts':L.metadataFacts,'evidence.occurrences':L.metadataOccurrences,'rawDrop.facts':L.rawDropRows,candidates:L.candidateRows,paint:L.paintRows,anchors:L.anchors,diagnostics:L.diagnostics};
 if(path in limits){if(n>limits[path]!)throw new WireError('result-shape');return;}
 if(path==='paint.*.references'){if(n!==6)throw new WireError('result-shape');return;}
 if(path==='evidence.occurrences.*'){if(n!==7||!integerV12(at(0)))throw new WireError('result-shape');return;}
 if(path==='evidence.occurrences.*.*'){
  const index=Number(rawPath.split('.').at(-1));
  if(index===3&&n===3&&unsignedV12(at(0),4294967295n,true)&&integerV12(at(1))&&integerV12(at(2)))return;
  if(index===6&&n<=1024&&Array.from({length:n},(_,i)=>at(i)).every(x=>unsignedV12(x)))return;
  throw new WireError('result-shape');
 }
 if(path==='evidence.facts.*.propertyOrder'){const values=Array.from({length:n},(_,i)=>at(i));if(n>8||new Set(values).size!==n||values.some(x=>!orderTokensV12.includes(x)))throw new WireError('result-shape');return;}
 if(path==='evidence.facts.*.clocks'){if(n>1024)throw new WireError('result-shape');return;}
 if(path==='evidence.facts.*.clocks.*'){if(n>4)throw new WireError('result-shape');const seen=new Set<unknown>();for(let i=0;i<n;i++){const entry=at(i);if(!Array.isArray(entry)||types.isProxy(entry))throw new WireError('result-shape');const field=Object.getOwnPropertyDescriptor(entry,'0')?.value;if(seen.has(field))throw new WireError('result-shape');seen.add(field);}return;}
 if(path==='evidence.facts.*.clocks.*.*'){
  if(n===1&&at(0)==='timestamp'||n===2&&(at(0)==='isIncremental'&&typeof at(1)==='boolean'||['clockId','unitMultiplierNs'].includes(at(0))&&unsignedV12(at(1))))return;
  throw new WireError('result-shape');
 }
 if(path==='reader.before'||path==='reader.after'){if(n!==7)throw new WireError('result-shape');return;}
 throw new WireError('result-shape');
}
function validateOutputScalarV12(v:unknown,path:string,rawPath:string){
 const key=path.split('.').at(-1)!,nullableUnsigned=['timestamp','rawTimestamp','timestampClockId','sequenceFlags','previousPacketDropped','trackUuid','uuid','parentUuid'];
 let okay=false;
 if(path==='evidence.occurrences.*.*'){const index=Number(rawPath.split('.').at(-1));okay=index===0?integerV12(v):(index===3||index===6)&&v===null;}
 else if(path==='evidence.occurrences.*.*.*'){const parts=rawPath.split('.'),role=Number(parts.at(-2)),index=Number(parts.at(-1));okay=role===6?unsignedV12(v):role===3&&(index===0?unsignedV12(v,4294967295n,true):integerV12(v));}
 else if(v===null){
  const machineId=path.endsWith('.machine.id')||path==='evidence.occurrences.*.*.id';
  const header=path.includes('.headers.')&&headerKeys.split(' ').includes(key)||path.startsWith('evidence.occurrences.*.*.')&&headerKeys.split(' ').includes(key);
  const selection=/\.(clock|track)\.(source|value|defaultsVersionIndex|reason)$/.test(path);
  okay=nullablePathsV12.has(path)||machineId||header||selection||rawPath==='study'||path.startsWith('metrics.');
 }
 else if(path.startsWith('usage.')&&path!=='usage.coverage'||path.startsWith('counters.')||path.startsWith('sequenceStart.')){
  let cap:number=L.operationDimensionTotal;
  if(path.startsWith('usage.successful.'))cap=(L as Record<string,number>)[key]??cap;
  if(path.startsWith('usage.reserved.'))cap=key==='calls'?L.operationCalls:L.operationDimensionTotal;
  if(path.startsWith('usage.cumulative.'))cap=capForCumulative[key]??cap;
  if(path.startsWith('usage.retained.'))cap=key==='indexKeyUTF8'?L.sequenceKeyUTF8:key==='metadataUTF8'?L.metadataCanonicalBytes+L.metadataKeyBytes+L.metadataOccurrenceBytes:(L as Record<string,number>)[key]??L.retainedLogicalBytes;
  if(path.startsWith('usage.current.')||path.startsWith('usage.highwater.'))cap=key==='logicalSlots'?L.currentLogicalSlots:key==='utf16Units'?L.currentDynamicUTF16:L.currentLogicalBytes;
  if(path.startsWith('usage.finalOutput.'))cap=key==='nodes'?L.outputNodes:key==='objects'?L.outputObjects:key==='keys'?L.outputKeys:key==='utf16Units'?L.outputUTF16Units:key==='depth'?L.outputDepth:L.outputBytes;
  if(path.startsWith('counters.')||path.startsWith('sequenceStart.'))cap=key==='feedCalls'?L.readCalls:key==='newDefinitions'?L.historyDefinitions:key==='repeatedDefinitions'?L.internUpdates:key==='sequenceKeys'?L.sequenceKeys:key==='defaultsVersions'?L.defaultsVersions:key==='metadataFacts'?L.metadataFacts:key==='metadataOccurrences'||key==='clockSnapshots'?L.metadataOccurrences:key==='clockChildren'?L.clockChildren:key==='disclosures'?L.disclosures:key.includes('RawDrop')||key==='rawDropDeclarations'?L.rawDropRows:key==='paintResolvedReferences'?6*L.paintRows:key==='paintWithheldReferences'?6*L.paintRows:key==='paintMatched'||key==='paintWithheld'?L.paintRows:key==='ordinaryAnnotationEntries'?L.semanticMembers:L.frames;
  okay=integerV12(v)&&(v as number)<=cap;
 }
 else if(key==='coverage')okay=v==='complete'||v==='partial';
 else if(path.startsWith('metrics.'))okay=false;
 else if(path.startsWith('authority.'))okay=key==='inputOrigin'?v==='not_authenticated':['clock','target','presentation','population'].includes(key)?v==='not_evaluated':v===false;
 else if(['framingBoundaryComplete','fullInputVerified','structuralContainerEOF','valid','priorSeen','trackEventDefaultsPresent','counterTrackUuidsPresent','doubleCounterTrackUuidsPresent','EOF','closed','identityMatch','hashMatch','incrementalStateCleared','firstPacketOnSequence'].includes(key))okay=typeof v==='boolean';
 else if(['packetIndex','rootBodyStart','packetBytes','fieldNumber','wireType','start','valueStart','end','sequenceIndex','definitionIndex','epoch','defaultsVersionIndex','versionIndex','counterTrackUuidCount','doubleCounterTrackUuidCount','frameIndex','keyStart','keyEnd','lengthStart','lengthEnd','bodyStart','bodyEnd','bodyBytes','bytes','reads','supportedLegacyFramePresented','annotationIndex'].includes(key)){
  const cap=key==='fieldNumber'?536870911:key==='reads'?L.readCalls:key==='packetBytes'||key==='bodyBytes'||['start','valueStart','end'].includes(key)?L.packetBytes:key==='definitionIndex'?L.historyDefinitions-1:key==='sequenceIndex'?L.sequenceKeys-1:key==='defaultsVersionIndex'||key==='versionIndex'?L.defaultsVersions-1:key==='packetIndex'||key==='frameIndex'?L.frames-1:key==='epoch'||key==='supportedLegacyFramePresented'?L.frames:key==='counterTrackUuidCount'||key==='doubleCounterTrackUuidCount'||key==='annotationIndex'?4096:L.inputBytes;
  okay=integerV12(v)&&(v as number)<=cap;
 }
 else if(key==='policy'||key==='ownerPolicy')okay=v==='private-owned-whole-ordered-paint-r-v12';
 else if(key==='status')okay=typeof v==='string'&&['complete-owned-selected-schema','complete-owned-whole-diagnostic','unavailable','complete-supported-compact-observations','complete-supported-header-declarations','absent','present','matched','withheld','resolved','selected'].includes(v);
 else if(key==='semanticProcessing')okay=v==='complete-supported-schema'||v==='unavailable';
 else if(key==='markInventoryAdmission'||key==='paintInventoryAdmission')okay=['absent','resolved-supported-source-roots','withheld','not_evaluated'].includes(v as string);
 else if(key==='codec')okay=v===2;
 else if(key==='domain')okay=v==='owned-paint-clock-layout-v12'||v==='owned-ordered-paint-r-v12';
 else if(key==='sequenceId')okay=unsignedV12(v,4294967295n,true);
 else if(key==='iid')okay=unsignedV12(v,18446744073709551615n,true);
 else if(key==='id')okay=unsignedV12(v,4294967295n);
 else if(nullableUnsigned.includes(key))okay=unsignedV12(v,key==='timestampClockId'||key==='sequenceFlags'||key==='previousPacketDropped'?4294967295n:18446744073709551615n);
 else if(key==='primaryTraceClock')okay=signedV12(v,32);
 else if(key==='pid')okay=signedV12(v,32);else if(key==='tid'||key==='startTimestampNs')okay=signedV12(v,64);
 else if(key==='table')okay=['event_names','event_categories','debug_annotation_names'].includes(v as string);
 else if(key==='channel')okay=paintChannelsV12.includes(v as string);
 else if(key==='scope')okay=scopesV12.includes(v as string);
 else if(key==='classification')okay=v==='explained'||v==='unexplained';
 else if(key==='kind')okay=['literal_string','withheld','track_descriptor','clock_snapshot_layout','source-owned-persisted-file'].includes(v as string);
 else if(key==='representation')okay=['annotation','event_name','withheld'].includes(v as string);
 else if(key==='nameSource')okay=['literal','intern','unresolved'].includes(v as string);
 else if(key==='timestampStatus')okay=v==='absent'||v==='raw-unqualified';
 else if(key==='variant')okay=['frame-dictionary','legacy-json-frame','frame-uint'].includes(v as string);
 else if(key==='family')okay=['inspector-paint-timing','lcp-candidate','direct-first-meaningful-paint'].includes(v as string);
 else if(key==='phase')okay=path==='diagnostics.*.phase'?typeof v==='string'&&['feed','frame','semantic','framing','closure','output'].includes(v):v===82;
 else if(key==='afterUserInput')okay=v==='0'||v==='1';
 else if(key==='frame')okay=typeof v==='string'&&v.length>0;
 else if(key==='source')okay=['packet','event','defaults'].includes(v as string);
 else if(key==='value')okay=typeof v==='string';
 else if(key==='reason'||key==='cause'||key==='code')okay=typeof v==='string'&&reasonTokensV12.has(v);
 else if(key==='component')okay=['defaults','interned_names','clock_snapshot','track_descriptor','input','route','old','paint-shell','paint-body','extract'].includes(v as string);
 else if(key==='sha256'||key.endsWith('SHA256'))okay=typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 else if(path==='paint.*.rule.bodyPolicy')okay=v==='pinned-paint-timing-r-source-body-fragments-v1';
 else if(path==='paint.*.rule.adapterPolicy')okay=v==='private-paint-packet-adapter-v1';
 else if(key==='chromiumRevision'||key==='perfettoRevision')okay=typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
 else if(path==='evidence.facts.*.propertyOrder.*')okay=orderTokensV12.includes(v as string);
 else if(path.startsWith('evidence.facts.*.clocks.*.*.'))okay=typeof v==='boolean'||unsignedV12(v)||['timestamp','clockId','unitMultiplierNs','isIncremental'].includes(v as string);
 else if(path==='reader.before.*'||path==='reader.after.*')okay=signedV12(v,128);
 if(!okay)throw new WireError('result-shape');
 void rawPath;
}
const counterSchemaV12='packets processedPackets decodedPackets oldPackets paintPackets opaqueNoStatePackets metadataPackets trackEvents ordinaryTrackEvents ordinaryEventsWithAnnotations ordinaryAnnotationEntries ordinaryResolvedRootInventories ordinaryWithheldRootInventories markAbsent markLiteral markWithheld paintMatched paintWithheld paintResolvedReferences paintWithheldReferences resets losses sequenceKeys newDefinitions repeatedDefinitions defaultsVersions disclosures clockSnapshots metadataFacts metadataOccurrences clockChildren rawDropDeclarations explainedRawDropDeclarations unexplainedRawDropDeclarations firstContradictions supportedLegacyFramePresented feedCalls';

type TransientV12=Partial<Omit<RepresentationV12,'logicalBytes'>>;
const brands=new WeakSet<object>(),modes=new WeakMap<object,'study'|'reader'>();
export function isOwnedPaintBudgetV12(value:unknown):value is OwnedPaintBudgetV12{return typeof value==='object'&&value!==null&&brands.has(value);}
export function assertOwnedPaintBudgetV12(value:unknown,mode?:'study'|'reader'):asserts value is OwnedPaintBudgetV12{if(!isOwnedPaintBudgetV12(value)||mode!==undefined&&modes.get(value)!==mode)throw new WireError('invalid-owned-budget');}
const capForCumulative:Record<string,number>={requestedReadBytes:L.chunkBytes*L.readCalls,readCalls:L.readCalls,acknowledgedReadBytes:L.inputBytes,inputCopyBytes:L.inputBytes,inputHashBytes:L.inputBytes,frameCopyBytes:L.inputBytes,frameHashBytes:L.inputBytes,manifestBytes:L.manifestBytes,manifestUpdates:L.manifestUpdates,utf8WidthScanUnits:L.utf8WidthScanUnits,canonicalPreflightNodes:L.canonicalPreflightNodes,canonicalPreflightStringUnits:L.canonicalPreflightStringUnits,canonicalGeneratedBytes:L.canonicalGeneratedBytes,canonicalHashBytes:L.canonicalHashBytes,canonicalComparisonBytes:L.canonicalComparisonBytes,fullMetadataRowBytes:L.fullMetadataRowBytes,metadataFactKeyBytes:L.metadataKeyBytes,metadataOccurrenceBytes:L.metadataOccurrenceBytes,allocatedBufferBytes:L.cumulativeBufferBytes,allocatedUTF16Units:L.cumulativeUTF16Units,allocatedLogicalSlots:L.cumulativeLogicalSlots,outputPreflightNodes:4*L.outputNodes,outputStringUnits:4*L.outputUTF16Units,outputEncodedBytes:4*L.outputBytes,outputWriteBytes:L.outputWriteBytes,outputReadbackBytes:L.outputReadbackBytes,sourceReadBytes:L.sourceBytes*L.sourcePasses,sourceHashBytes:L.sourceBytes*L.sourcePasses,runtimeReadBytes:L.runtimeBytes*L.runtimePasses,runtimeHashBytes:L.runtimeBytes*L.runtimePasses,wrapperWork:L.totalLogicalWork,totalLogicalWork:L.totalLogicalWork,closureReservedWork:L.normalOutputReservedWork+L.closureReservedWork+L.readerReservedWork};
export class OwnedPaintBudgetV12 {
 readonly usage=createUsageV12();
 private failureRemaining:number=L.closureReservedWork;
 private normalRemaining:number=L.normalOutputReservedWork;
 private readerRemaining=0;
 private retainedBytes=0;
 constructor(mode:'study'|'reader'='study'){
  if(mode!=='study'&&mode!=='reader')throw new WireError('invalid-budget-mode');brands.add(this);modes.set(this,mode);
  this.readerRemaining=mode==='reader'?L.readerReservedWork:0;
  const prepaid=this.failureRemaining+this.normalRemaining+this.readerRemaining;
  this.usage.cumulative.closureReservedWork=prepaid;this.usage.cumulative.totalLogicalWork=prepaid;
  const release=this.reserveTransient({fixedRecordBytes:L.fixedBookkeepingBytes+L.slabAndChunkBytes});void release;
 }
 private sum(key:string,n:number){if(!(key in this.usage.cumulative))throw new WireError('budget-dimension');return checkedAddV12(this.usage.cumulative[key]!,n,capForCumulative[key]??L.operationDimensionTotal,key);}
 chargeCumulative(key:string,n:number):void{const next=this.sum(key,n),work=checkedAddV12(this.usage.cumulative.totalLogicalWork!,n,L.totalLogicalWork,'totalLogicalWork');this.usage.cumulative[key]=next;this.usage.cumulative.totalLogicalWork=work;}
 chargeBatch(entries:Readonly<Record<string,number>>,failure=false):void{
  const next:NumericRecord={};let work=0;for(const key of Object.keys(entries)){next[key]=this.sum(key,entries[key]!);work=checkedAddV12(work,entries[key]!,L.totalLogicalWork,'totalLogicalWork');}
  if(failure){if(work>this.failureRemaining)throw new WireError('capacity-failureRemaining');}
  else checkedAddV12(this.usage.cumulative.totalLogicalWork!,work,L.totalLogicalWork,'totalLogicalWork');
  Object.assign(this.usage.cumulative,next);if(failure)this.failureRemaining-=work;else this.usage.cumulative.totalLogicalWork!+=work;
 }
 private prepaid(key:string,n:number,pool:'failureRemaining'|'normalRemaining'|'readerRemaining',weight=1):void{
  const next=this.sum(key,n),work=n*weight;if(!Number.isSafeInteger(work)||work>this[pool]||work<0)throw new WireError('capacity-'+pool);
  this[pool]-=work;this.usage.cumulative[key]=next;
 }
 chargeClosure(key:string,n:number):void{this.prepaid(key,n,'failureRemaining');}
 chargeFinalization(key:string,n:number):void{this.prepaid(key,n,'normalRemaining');}
 chargeReader(key:string,n:number):void{this.prepaid(key,n,'readerRemaining',key==='requestedReadBytes'||key==='acknowledgedReadBytes'?4:1);}
 reserveTransient(v:TransientV12):()=>void{
  const d={bufferBytes:v.bufferBytes??0,utf16Units:v.utf16Units??0,logicalSlots:v.logicalSlots??0,fixedRecordBytes:v.fixedRecordBytes??0};
  for(const n of Object.values(d))if(!Number.isSafeInteger(n)||n<0)throw new WireError('representation-shape');
  const c=this.usage.current,logical=d.bufferBytes+2*d.utf16Units+64*d.logicalSlots+d.fixedRecordBytes;
  const next={bufferBytes:checkedAddV12(c.bufferBytes,d.bufferBytes,L.currentLogicalBytes,'currentLogicalBytes'),utf16Units:checkedAddV12(c.utf16Units,d.utf16Units,L.currentDynamicUTF16,'currentDynamicUTF16'),logicalSlots:checkedAddV12(c.logicalSlots,d.logicalSlots,L.currentLogicalSlots,'currentLogicalSlots'),fixedRecordBytes:checkedAddV12(c.fixedRecordBytes,d.fixedRecordBytes,L.currentLogicalBytes,'currentLogicalBytes'),logicalBytes:checkedAddV12(c.logicalBytes,logical,L.currentLogicalBytes,'currentLogicalBytes')};
  const a=this.usage.cumulative,buffer=checkedAddV12(a.allocatedBufferBytes!,d.bufferBytes,L.cumulativeBufferBytes,'cumulativeBufferBytes'),utf16=checkedAddV12(a.allocatedUTF16Units!,d.utf16Units,L.cumulativeUTF16Units,'cumulativeUTF16Units'),slots=checkedAddV12(a.allocatedLogicalSlots!,d.logicalSlots,L.cumulativeLogicalSlots,'cumulativeLogicalSlots');
  Object.assign(c,next);a.allocatedBufferBytes=buffer;a.allocatedUTF16Units=utf16;a.allocatedLogicalSlots=slots;
  for(const key of Object.keys(c) as (keyof RepresentationV12)[])this.usage.highwater[key]=Math.max(this.usage.highwater[key],c[key]);
  let live=true;return()=>{if(!live)throw new WireError('representation-release');live=false;c.bufferBytes-=d.bufferBytes;c.utf16Units-=d.utf16Units;c.logicalSlots-=d.logicalSlots;c.fixedRecordBytes-=d.fixedRecordBytes;c.logicalBytes-=logical;};
 }
 reserveOperation(component:keyof UsageV12['reserved'],vector:Readonly<OperationTotalsV12>):()=>void{
  const prior=this.usage.reserved[component],next:NumericRecord={};
  for(const key of operationKeys)next[key]=checkedAddV12(prior[key]!,vector[key]??0,key==='calls'?L.operationCalls:L.operationDimensionTotal,key);
  const work=checkedAddV12(this.usage.cumulative.totalLogicalWork!,vector.totalLogicalWork??0,L.totalLogicalWork,'totalLogicalWork');
  const release=this.reserveTransient({bufferBytes:vector.reservedByteBufferOccupancy??0,utf16Units:(vector.reservedUTF16Occupancy??0)+(vector.dynamicUTF16Units??0),logicalSlots:(vector.logicalSlots??0)+(vector.loopRecordWork??0)});
  Object.assign(prior,next);this.usage.cumulative.totalLogicalWork=work;return release;
 }
 ensureSemanticRoom(fields:number,members:number):void{checkedAddV12(this.usage.successful.semanticFields!,fields,L.semanticFields,'semanticFields');checkedAddV12(this.usage.successful.semanticMembers!,members,L.semanticMembers,'semanticMembers');}
 commitSemantic(fields:number,members:number):void{this.ensureSemanticRoom(fields,members);this.usage.successful.semanticFields!+=fields;this.usage.successful.semanticMembers!+=members;}
 ensureSuccessfulRoom(key:string,n:number):void{if(!(key in this.usage.successful))throw new WireError('budget-dimension');const cap=(L as Record<string,number>)[key]??L.operationDimensionTotal;checkedAddV12(this.usage.successful[key]!,n,cap,key);}
 addSuccessful(key:string,n:number):void{this.ensureSuccessfulRoom(key,n);this.usage.successful[key]!+=n;}
 addRetained(key:string,n:number):void{if(!(key in this.usage.retained))throw new WireError('budget-dimension');const cap=key==='indexKeyUTF8'?L.sequenceKeyUTF8:key==='metadataUTF8'?L.metadataCanonicalBytes+L.metadataKeyBytes+L.metadataOccurrenceBytes:(L as Record<string,number>)[key]??L.retainedLogicalBytes;this.usage.retained[key]=checkedAddV12(this.usage.retained[key]!,n,cap,key);}
 subtractRetained(key:string,n:number):void{if(!Number.isSafeInteger(n)||n<0||n>this.usage.retained[key]!)throw new WireError('representation-release');this.usage.retained[key]!-=n;}
 measure(value:unknown):JSONMeasureV12{return measureOwnedJSONV12(value,n=>this.chargeCumulative('wrapperWork',n));}
 retain(value:unknown,_role:string):{measure:JSONMeasureV12;release:()=>void}{
  const m=this.measure(value),slots=m.nodes+m.keys+16,logical=2*m.utf16Units+64*slots;
  checkedAddV12(this.retainedBytes,logical,L.retainedLogicalBytes,'retainedLogicalBytes');
  const release=this.reserveTransient({utf16Units:m.utf16Units,logicalSlots:slots});this.retainedBytes+=logical;let live=true;
  return {measure:m,release:()=>{if(!live)throw new WireError('representation-release');live=false;this.retainedBytes-=logical;release();}};
 }
 canonical(value:unknown,preflight?:JSONMeasureV12):{text:string;measure:JSONMeasureV12;release:()=>void}{
  const m=preflight??measureOwnedJSONV12(value,n=>this.chargeCumulative('wrapperWork',n));
  this.chargeCumulative('canonicalPreflightNodes',m.nodes);this.chargeCumulative('canonicalPreflightStringUnits',m.utf16Units);
  this.chargeCumulative('canonicalGeneratedBytes',m.escapedBytes);
  this.chargeCumulative('wrapperWork',12*m.escapedBytes+16*m.nodes+4096);
  const release=this.reserveTransient({bufferBytes:6*m.escapedBytes+4096,logicalSlots:4*m.nodes});
  const text=JSON.stringify(value);if(Buffer.byteLength(text)!==m.escapedBytes){release();throw new WireError('source-model-mismatch');}
  return {text,measure:m,release};
 }
 finalizeOutput(value:unknown,failure=false,workerResponse=false):JSONMeasureV12{
  const charge=(n:number)=>failure?this.chargeClosure('wrapperWork',n):this.chargeFinalization('wrapperWork',n);
  const m=measureOwnedJSONV12(value,charge,L.outputStringUTF8,validateOutputRoleV12,units=>this.reserveTransient({utf16Units:4*(units+16),logicalSlots:32}));
  if(failure&&(m.escapedBytes>L.failureOutputBytes||m.nodes>L.failureOutputNodes))throw new WireError('capacity-failureOutputBytes');
  const debit=(key:string,n:number)=>failure?this.chargeClosure(key,n):this.chargeFinalization(key,n);
  debit('outputPreflightNodes',m.nodes);debit('outputStringUnits',m.utf16Units);debit('outputEncodedBytes',m.escapedBytes);
  // Fixed-schema numeric settlement and final freeze are prepaid before visits.
  // The one full preflight above is never repeated; only the fixed Usage roles
  // change. Decimal-width deltas therefore give the final exact JSON width.
  charge(12*(m.escapedBytes+8192)+32*m.nodes+131072);
  const release=this.reserveTransient({bufferBytes:6*(m.escapedBytes+8192)+4096,logicalSlots:4*m.nodes});
  if(workerResponse)this.reserveTransient({bufferBytes:2*(m.escapedBytes+8192),utf16Units:m.escapedBytes+8192});
  const owned=value as {usage?:UsageV12};
  const digits=(u:UsageV12)=>{
   let n=0;const row=(r:NumericRecord,keys:readonly string[])=>{for(const key of keys)n+=String(r[key]).length;};
   row(u.successful,successfulKeys);for(const component of ['packet','state','descriptor','comparator','referenceJSON'] as const)row(u.reserved[component],operationKeys);
   row(u.cumulative,cumulativeKeys);row(u.retained,retainedKeys);for(const r of [u.current,u.highwater])for(const key of ['bufferBytes','utf16Units','logicalSlots','fixedRecordBytes','logicalBytes'] as const)n+=String(r[key]).length;
   for(const key of ['nodes','objects','keys','utf8Bytes','utf16Units','escapedBytes','depth'] as const)n+=String(u.finalOutput[key]).length;return n;
  };
  const prior=owned.usage,priorDigits=prior?digits(prior):0,initialBytes=m.escapedBytes;
  let recordedBytes=initialBytes;
  try{
   // Keep conservative output staging credit through the returned snapshot.
   // It is never refunded into another finalization or semantic operation.
   if(prior){
    for(let i=0;i<16;i++){
     this.usage.finalOutput={...m};
     const expected=initialBytes+digits(this.usage)-priorDigits;
     if(expected===m.escapedBytes)break;
     if(expected<m.escapedBytes||expected>L.outputBytes)throw new WireError('source-model-mismatch');
     m.escapedBytes=expected;debit('outputEncodedBytes',expected-recordedBytes);recordedBytes=expected;
     if(i===15)throw new WireError('source-model-mismatch');
    }
    this.usage.finalOutput={...m};owned.usage=cloneUsageV12(this.usage);
   }
   const text=JSON.stringify(value);if(Buffer.byteLength(text)!==m.escapedBytes)throw new WireError('source-model-mismatch');
   const freeze=(v:unknown):void=>{if(v===null||typeof v!=='object'||Object.isFrozen(v))return;for(const child of Object.values(v))freeze(child);Object.freeze(v);};
   freeze(value);return m;
  }catch(error){release();throw error;}
 }
}
