import {expect,test} from 'vitest';
import {projectBrowserFrameTraceSlices as project,TRACE_SLICES_POLICY as POLICY} from './browser-frame-trace-slices.js';
import {decodeBrowserFramePayloadWithMembers,decodeBrowserFramePayload,PAYLOAD_POLICY} from './browser-frame-protobuf-fragments.js';
import {body,join,tag,uint,vi,text} from './browser-frame-packet-fragments.test-helper.js';
import {createHash} from 'node:crypto';
import {decodeBrowserFramePacketWithMembers,decodeBrowserFramePacket,PACKET_POLICY} from './browser-frame-packet-fragments.js';
import {projectOrderedBrowserFrameState,projectOrderedBrowserFrameEvidence,ORDERED_STATE_POLICY,ORDERED_STATE_V2_POLICY} from './browser-frame-ordered-state.js';
import {WireError} from './browser-frame-protobuf-wire.js';
const trace=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const packet=(...fields:Uint8Array[])=>join(uint(10,1n),...fields);
const event=(type:bigint,...fields:Uint8Array[])=>body(11,join(uint(9,type),uint(11,7n),...fields));
// Compile-time compatibility assertion: the restricted-only outcome never widens old API declarations.
type OldProjection=Extract<ReturnType<typeof projectOrderedBrowserFrameState>,{status:'projected_ordered_manual_state'}>;
// @ts-expect-error this outcome belongs only to the separately typed restricted projection
const restrictedOutcomeOnOldAPI:OldProjection['packets'][number]['eventOutcome']='withheld_missing_intern_definition';
function projected(bytes:Uint8Array){const r=project(bytes,POLICY);expect(r.status).toBe('projected_restricted_trace_slices');if(r.status!=='projected_restricted_trace_slices')throw Error('Expected restricted projection');return r;}
test('existing ordered policies keep missing-definition atomic refusal and default payload shape',()=>{
 const p=packet(uint(13,1n),event(1n,uint(10,99n),body(1075,join(uint(1,1n),uint(5,1n),uint(6,3n)))));
 for(const [fn,policy] of [[projectOrderedBrowserFrameState,ORDERED_STATE_POLICY],[projectOrderedBrowserFrameEvidence,ORDERED_STATE_V2_POLICY]] as const){expect(fn({domain:'pure',packets:[p]},policy)).toMatchObject({status:'unavailable',diagnostics:[{code:'missing-intern-definition'}]});}
 const r=projected(trace(packet(uint(13,1n),event(1n,body(1075,join(uint(1,1n),uint(5,1n),uint(6,3n)))))));
 expect(r.typedOccurrences[0]!.fields).toEqual({state:{value:1,name:'presented_all'}});
 expect(r.typedOccurrences[0]!.fieldOccurrences.slice(1).map(o=>o.location.fieldNumber)).toEqual([5,6]);
 for(const at of r.typedOccurrences[0]!.fieldOccurrences.slice(1))expect(at).not.toHaveProperty('selectedPath');
});
test('typed payload order, FrameSink child paths, unknown duplicates and exact whole offsets are source-bound',()=>{
 const bytes=trace(packet(uint(13,1n),event(3n,body(1075,uint(1,2n)),body(1052,join(body(2,join(uint(1,0n),uint(2,9n))),uint(20000,1n),uint(20000,1n),body(8,join(vi(9n),vi(9n)))))))),r=projected(bytes);
 expect(r.typedOccurrences.map(t=>t.kind)).toEqual(['reporter2','graphics']);expect(r.rawEvents[0]!.typedIndexes).toEqual([0,1]);
 const typed=r.typedOccurrences[1]!,sink=typed.fieldOccurrences[0]!,client=typed.fieldOccurrences[1]!,id=typed.fieldOccurrences[2]!;
 expect(client).toMatchObject({parentOccurrenceIndex:0,selectedPath:'frameSinkId.client',selectedValue:'0'});expect(id).toMatchObject({parentOccurrenceIndex:0,selectedPath:'frameSinkId.sink',selectedValue:'9'});
 expect(client.location.start).toBe(sink.location.valueStart);
 const unknown=typed.fieldOccurrences.filter(o=>o.location.fieldNumber===20000);expect(unknown).toHaveLength(2);expect(unknown[0]!.location.start).toBeLessThan(unknown[1]!.location.start);
 for(const t of r.typedOccurrences){const f=r.frames[t.packetIndex]!;expect(t.packetBodySha256).toBe(f.bodySha256);expect(f.bodySha256).toBe(createHash('sha256').update(bytes.subarray(f.bodyStart,f.bodyEnd)).digest('hex'));for(const m of t.members){expect(bytes[f.bodyStart+m.start]).toBe(9);expect(m.end-m.start).toBe(1);}}
});
test('anonymous nested stage and orphan END retain incomplete structure without presentation inference',()=>{
 const ending=packet(event(2n,body(1075,uint(1,1n))));
 const r=projected(trace(packet(uint(13,1n),event(2n)),packet(event(1n,text(23,'outer'))),packet(event(1n)),ending));
 expect(r.rawEvents[0]!.reasons).toEqual(['end_without_begin']);
 expect(r.slices).toMatchObject([{status:'open_at_supplied_eof',beginRawEventIndex:1},{status:'matched_restricted_structure',beginRawEventIndex:2,endRawEventIndex:3,parentSliceIndex:0}]);
 expect(r.slices[1]!.beginTypedIndexes).toEqual([]);expect(r.typedOccurrences[0]!.rawEventIndex).toBe(3);
 for(const s of r.slices){expect(s).not.toHaveProperty('duration');expect(s).not.toHaveProperty('presentationTimestamp');}expect(r).not.toHaveProperty('fps');
});
test('explicit/default track and raw clock selections remain independent of structural pairing',()=>{
 const defaults=body(59,join(uint(58,64n),body(11,uint(11,7n))));
 const beginning=packet(uint(13,1n),defaults,body(11,join(uint(9,1n),body(1075,uint(1,1n)))));
 const r=projected(trace(beginning,packet(uint(58,128n),event(2n))));
 expect(r.slices[0]!.status).toBe('matched_restricted_structure');expect(r.rawEvents[0]!.trackSelection).toMatchObject({status:'selected',source:'defaults',trackUuid:'7',defaultsVersionIndex:0});
 expect(r.rawEvents.map(e=>e.clockSelection)).toMatchObject([{status:'selected',source:'defaults',clockId:'64'},{status:'selected',source:'packet',clockId:'128'}]);expect(r.clockAdmission).toBe('not_evaluated');
 const zero=projected(trace(packet(uint(13,1n),defaults,body(11,join(uint(9,1n),uint(11,0n))))));expect(zero.rawEvents[0]!.fields.trackUuid).toBe('0');expect(zero.rawEvents[0]!.reasons).toEqual(['unsupported_implicit_or_zero_track_profile']);
});
test('same UUID remains independent across absent and explicit-zero machine contexts and across tracks',()=>{
 const a=(type:bigint)=>packet(event(type)),b=(type:bigint)=>packet(uint(98,0n),event(type));
 const r=projected(trace(packet(uint(13,1n),event(1n)),packet(uint(98,0n),uint(13,1n),event(1n)),a(2n),b(2n)));
 expect(r.slices.map(s=>[s.beginRawEventIndex,s.endRawEventIndex])).toEqual([[0,2],[1,3]]);expect(r.rawEvents.map(e=>e.machineContext)).toEqual([{status:'absent'},{status:'present',machineId:'0'},{status:'absent'},{status:'present',machineId:'0'}]);
});
test('loss-only flushes every open track in a writer and does not recover without reset',()=>{
 const on=(track:bigint,type:bigint)=>body(11,join(uint(9,type),uint(11,track)));
 const r=projected(trace(packet(uint(13,1n),on(7n,1n)),packet(on(8n,1n)),packet(uint(42,2n),on(7n,2n)),packet(on(8n,2n))));
 expect(r.slices.map(s=>s.status)).toEqual(['interrupted','interrupted']);expect(r.rawEvents.slice(2).map(e=>e.reasons)).toEqual([['active_writer_barrier'],['active_writer_barrier']]);expect(r.barriers[1]).toMatchObject({reason:'observed_loss',affectedOpenSliceIndexes:[0,1]});
});
test('invalid initial and dependency events retain typed evidence but cannot create a structural pair',()=>{
 const r=projected(trace(packet(uint(13,2n),event(1n,body(1075,uint(1,3n)))),packet(event(2n))));
 expect(r.rawEvents[0]!.resolution).toBe('withheld_dependency');expect(r.typedOccurrences).toHaveLength(1);expect(r.slices).toEqual([]);expect(r.rawEvents[0]!.reasons).toEqual(['invalid_sequence_interval']);
});
test.each([[join(uint(1,1n),uint(1,1n)),'duplicate-selected-field'],[uint(1,4n),'unknown-selected-enum'],[body(1,new Uint8Array()),'selected-field-wrong-wire-type'],[new Uint8Array([8,128]),'truncated-varint']] as const)('late selected reporter corruption denies all prefix rows %#',(payload,cause)=>{
 const r=project(trace(packet(uint(13,1n),event(1n)),packet(event(2n,body(1075,payload)))),POLICY);expect(r).toMatchObject({status:'unavailable',diagnostics:[{stage:'ingress',code:'packet-unavailable',frameIndex:1,cause}]});expect(r).not.toHaveProperty('rawEvents');
});
test('invalid UTF8 and legacy event fields refuse atomically instead of fabricating names',()=>{
 for(const [field,cause] of [[body(23,new Uint8Array([255])),'invalid-utf8'],[uint(6,0n),'unsupported-legacy-event']] as const){expect(project(trace(packet(uint(13,1n),event(1n,field))),POLICY)).toMatchObject({status:'unavailable',diagnostics:[{cause}]});}
});
test('whole-input fixed ceilings include wrapper bytes and retain all1024 frames',()=>{
 const bytes=trace(packet(body(20000,new Uint8Array(262132))));expect(bytes.byteLength).toBe(262144);expect(projected(bytes).inputRef.bytes).toBe(262144);
 expect(project(join(bytes,new Uint8Array(1)),POLICY)).toMatchObject({status:'unavailable',diagnostics:[{stage:'input',code:'byte-capacity'}]});
 expect(projected(trace(...Array.from({length:1024},()=>packet()))).frames).toHaveLength(1024);
 expect(project(trace(...Array.from({length:1025},()=>packet())),POLICY)).toMatchObject({status:'unavailable',diagnostics:[{stage:'ingress',code:'frame-capacity'}]});
});
test('ingress aggregate fields and repeated members stay global across packets',()=>{
 const fields=join(...Array.from({length:16380},()=>body(3,new Uint8Array())));
 const r=project(trace(packet(uint(13,1n),event(3n,fields)),packet(event(3n,fields))),POLICY);
 expect(r).toMatchObject({status:'unavailable',diagnostics:[{stage:'ingress',code:'aggregate-field-capacity'}]});
 const members=body(8,new Uint8Array(8193));expect(project(trace(packet(uint(13,1n),event(3n,body(1052,members))),packet(event(3n,body(1052,members)))),POLICY)).toMatchObject({status:'unavailable',diagnostics:[{stage:'ingress',code:'aggregate-member-capacity'}]});
});
test('ordinary owned copy ignores poisoned own accessors and output has no byte views or mutation authority',()=>{
 const bytes=trace(packet(uint(13,1n),event(1n,body(1075,uint(1,1n)))));let reads=0;
 for(const k of ['length','byteLength','buffer','slice',Symbol.iterator])Object.defineProperty(bytes,k,{get(){reads++;throw Error('secret');}});
 const r=projected(bytes),before=JSON.stringify(r);bytes.fill(0);expect(reads).toBe(0);expect(JSON.stringify(r)).toBe(before);
 const visit=(value:unknown)=>{if(value!==null&&typeof value==='object'){expect(value).not.toBeInstanceOf(Uint8Array);expect(Object.isFrozen(value)).toBe(true);for(const child of Object.values(value))visit(child);}};visit(r);
});
test('hostile thrown values and view kinds have bounded diagnostics without evaluating arbitrary error payloads',()=>{
 const detached=new Uint8Array(1);structuredClone(detached.buffer,{transfer:[detached.buffer]});
 for(const input of [Buffer.alloc(0),new Uint8Array(new SharedArrayBuffer(1)),new(class extends Uint8Array{})(0),detached])expect(project(input,POLICY).status).toBe('unavailable');
 const thrown=new Proxy({}, {getPrototypeOf(){throw Error('secret');}}),proxy=new Proxy({}, {getPrototypeOf(){throw thrown;}});expect(JSON.stringify(project(proxy,POLICY))).not.toContain('secret');
 let reads=0;const error=new WireError('byte-capacity');Object.defineProperty(error,'code',{get(){reads++;throw Error('secret');}});const input=new Proxy({}, {getPrototypeOf(){throw error;}});
 expect(project(input,POLICY)).toMatchObject({status:'unavailable',diagnostics:[{code:'invalid-trace-slices-input'}]});expect(reads).toBe(1);
 for(const policy of [undefined,null,NaN,Infinity,{},new Proxy({}, {get(){throw Error('secret');}})])expect(project(input,policy)).toMatchObject({status:'unavailable',diagnostics:[{code:'unsupported-policy'}]});expect(reads).toBe(1);
});
test('all nested stages pair against their real outer END in source order, independent of raw timestamp order',()=>{
 const r=project(trace(packet(uint(13,1n),uint(8,100n),event(1n,text(23,'PipelineReporter'),body(1075,uint(1,1n)))),packet(uint(8,90n),event(1n,text(23,'stage'))),packet(event(1n,text(23,'breakdown'))),packet(event(2n)),packet(event(2n)),packet(event(2n))),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[{sliceIndex:0,beginRawEventIndex:0,endRawEventIndex:5,depth:0,status:'matched_restricted_structure',beginTypedIndexes:[0]},{sliceIndex:1,beginRawEventIndex:1,endRawEventIndex:4,parentSliceIndex:0,depth:1},{sliceIndex:2,beginRawEventIndex:2,endRawEventIndex:3,parentSliceIndex:1,depth:2}]});
});
test.each([text(23,'A'),text(23,''),text(22,'cc'),uint(3,1n),body(3,new Uint8Array())])('an END with any name/category presence never pops a stack %#',constraint=>{
 const r=project(trace(packet(uint(13,1n),body(12,body(1,join(uint(1,1n),text(2,'cc')))),event(1n,text(23,'A'))),packet(event(1n,text(23,'B'))),packet(event(2n,constraint)),packet(event(2n))),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[{status:'interrupted'},{status:'interrupted'}],barriers:[{reason:'incremental_reset'},{reason:'unsupported_end_constraints',affectedOpenSliceIndexes:[1,0]}]});
 if(r.status==='projected_restricted_trace_slices')for(const s of r.slices)expect(s).not.toHaveProperty('endRawEventIndex');
});
test('reset and loss invalidate open endpoints before same-packet event; reset can start a new structural interval',()=>{
 const r=project(trace(packet(uint(13,1n),event(1n)),packet(uint(13,1n),uint(42,1n),event(1n)),packet(event(2n))),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[{beginRawEventIndex:0,status:'interrupted'},{beginRawEventIndex:1,endRawEventIndex:2,status:'matched_restricted_structure'}],barriers:[{reason:'incremental_reset'},{reason:'reset_and_loss',affectedOpenSliceIndexes:[0]}]});
});
test('unknown track poisons later families until an observed reset',()=>{
 const r=project(trace(packet(uint(13,1n),body(11,uint(9,1n))),packet(event(1n)),packet(event(2n)),packet(uint(13,1n),event(1n)),packet(event(2n))),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[{beginRawEventIndex:3,endRawEventIndex:4,status:'matched_restricted_structure'}],rawEvents:[{reasons:['unsupported_implicit_or_zero_track_profile']},{reasons:['active_writer_barrier']},{reasons:['active_writer_barrier']},{pairingDisposition:'begin_candidate'},{pairingDisposition:'end_candidate'}]});
});
test('a later foreign writer or descriptor conflict withholds the full family rather than an earlier favorable pair',()=>{
 const second=join(uint(10,2n),uint(13,1n),event(1n));
 const r=project(trace(packet(uint(13,1n),event(1n)),packet(event(2n)),second),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[],rawEvents:[{reasons:['multiple_observed_writers']},{reasons:['multiple_observed_writers']},{reasons:['multiple_observed_writers']}]});
 const desc=(pid:bigint)=>body(60,join(uint(1,7n),body(3,uint(1,pid))));
 expect(project(trace(packet(uint(13,1n),desc(1n)),packet(event(1n)),packet(event(2n)),packet(desc(2n))),POLICY)).toMatchObject({status:'projected_restricted_trace_slices',slices:[],rawEvents:[{reasons:['conflicting_descriptor']},{reasons:['conflicting_descriptor']}]});
});
test('native STATE and COUNTER types and zero tracks stay unsupported-profile evidence with every typed occurrence',()=>{
 const r=project(trace(packet(uint(13,1n),event(1n)),packet(event(5n,body(1075,uint(1,3n)))),packet(event(4n)),packet(body(11,join(uint(9,2n),uint(11,0n))))),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',slices:[{status:'interrupted'}],typedOccurrences:[{rawEventIndex:1,fields:{state:{value:3}}}],rawEvents:[{pairingDisposition:'begin_candidate'},{pairingDisposition:'unsupported_profile',reasons:['unsupported_non_slice_type']},{reasons:['active_family_barrier']},{reasons:['unsupported_implicit_or_zero_track_profile']}]});
});
test('raw and typed occurrences survive dependency and missing-intern withholding without changing old policy',()=>{
 const bytes=trace(packet(uint(13,1n),event(1n,text(23,'PipelineReporter'),body(1075,join(uint(1,1n),uint(3,9007199254740993n))))),packet(event(2n,body(1052,body(8,vi(9n)))))),r=project(bytes,POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',inputRef:{sha256:createHash('sha256').update(bytes).digest('hex')},rawEvents:[{rawEventIndex:0,fields:{type:'1'},resolution:'resolved',typedIndexes:[0]},{rawEventIndex:1,fields:{type:'2'},typedIndexes:[1]}],typedOccurrences:[{typedIndex:0,rawEventIndex:0,kind:'reporter2',fields:{state:{value:1,name:'presented_all'},frameSource:'9007199254740993'}},{typedIndex:1,rawEventIndex:1,kind:'graphics',members:[{value:'9',memberIndex:0,logicalIndex:0}]}]});
});
test('missing intern definition keeps new raw evidence but never invents a resolved name',()=>{
 const unresolved=trace(packet(uint(13,1n),event(1n,uint(10,99n),body(1075,uint(1,3n)))));
 expect(project(unresolved,POLICY)).toMatchObject({status:'projected_restricted_trace_slices',rawEvents:[{resolution:'withheld_missing_intern_definition',nameResolution:{status:'unavailable'}}],typedOccurrences:[{fields:{state:{value:3,name:'dropped'}}}]});
});
test.each([[body(11,uint(9,1n)),'missing-sequence-id'],[join(uint(10,0n),body(11,uint(9,1n))),'zero-sequence-id']] as const)('event sequence refusal is atomic %#',(packet,code)=>{
 const r=project(trace(packet),POLICY);expect(r).toMatchObject({status:'unavailable',diagnostics:[{stage:'ordered',code,packetIndex:0}]});
 expect(r).not.toHaveProperty('rawEvents');expect(r).not.toHaveProperty('typedOccurrences');expect(r).not.toHaveProperty('slices');
});
test('sequence-less descriptor metadata retains absent writer without raw event',()=>{
 expect(project(trace(body(60,uint(1,7n))),POLICY)).toMatchObject({status:'projected_restricted_trace_slices',rawEvents:[],ordered:{metadataPackets:[{sequenceContext:{status:'absent'}}]}});
});
test('late corrupt wrapper refuses before a packet success prefix',()=>{
 const r=project(join(trace(uint(10,1n)),new Uint8Array([10,128])),POLICY);
 expect(r).toMatchObject({status:'unavailable',structuralContainerEOF:false,diagnostics:[{stage:'ingress',code:'truncated-varint'}]});expect(r).not.toHaveProperty('ordered');
});
test('empty supplied trace is frozen restricted evidence with no performance authority',()=>{
 const r=project(new Uint8Array(),POLICY);
 expect(r).toMatchObject({status:'projected_restricted_trace_slices',structuralContainerEOF:true,rawEvents:[],typedOccurrences:[],slices:[],barriers:[],nativePairingQualified:false,performanceEligibility:false,fpsEligibility:false});
 expect(Object.isFrozen(r)).toBe(true);
});
test('typed members retain original mixed packed/unpacked varint spans and duplicate values',()=>{
 const bytes=join(uint(8,9n),body(8,join(vi(9n),vi(9007199254740993n))),body(8,new Uint8Array()),join(tag(8,0),new Uint8Array([0x89,0])));
 const r=decodeBrowserFramePayloadWithMembers(bytes,'graphics');
 expect(r.status).toBe('decoded_fragment');if(r.status!=='decoded_fragment')throw Error('Expected member projection');
 expect(r.members).toEqual([
  {fieldOccurrenceIndex:0,memberIndex:0,logicalIndex:0,start:1,valueStart:1,end:2,value:'9'},
  {fieldOccurrenceIndex:1,memberIndex:0,logicalIndex:1,start:4,valueStart:4,end:5,value:'9'},
  {fieldOccurrenceIndex:1,memberIndex:1,logicalIndex:2,start:5,valueStart:5,end:13,value:'9007199254740993'},
  {fieldOccurrenceIndex:3,memberIndex:0,logicalIndex:3,start:16,valueStart:16,end:18,value:'9'},
 ]);
 expect(r.fields.surfaceTraceIds).toEqual(['9','9','9007199254740993','9']);
 const old=decodeBrowserFramePayload(bytes,'graphics',PAYLOAD_POLICY);
 expect(old).not.toHaveProperty('members');expect(r.occurrences).toEqual(old.status==='decoded_fragment'?old.occurrences:[]);
});
test('wrong policy rejects without inspecting hostile input',()=>{
 let touched=0;const input=new Proxy({}, {getPrototypeOf(){touched++;throw Error('secret');}});
 expect(project(input,'other')).toMatchObject({status:'unavailable',diagnostics:[{code:'unsupported-policy'}]});expect(touched).toBe(0);
});
test('internal packet member spans shift exactly once while old packet output has no member property',()=>{
 const payload=body(8,vi(9007199254740993n)),bytes=join(uint(10,1n),body(11,body(1052,payload)));
 const r=decodeBrowserFramePacketWithMembers(bytes);expect(r.status).toBe('decoded_packet_fragment');
 if(r.status!=='decoded_packet_fragment')throw Error('Expected packet');
 const at=r.occurrences.find(o=>o.scope==='track_event'&&o.fieldNumber===1052)!;
 expect(r.event!.graphics!.members[0]).toMatchObject({start:at.valueStart+2,valueStart:at.valueStart+2,end:at.end,value:'9007199254740993'});
 const old=decodeBrowserFramePacket(bytes,PACKET_POLICY);expect(old.status).toBe('decoded_packet_fragment');
 if(old.status==='decoded_packet_fragment'){expect(old.event!.graphics).not.toHaveProperty('members');expect(old.occurrences).toEqual(r.occurrences);}
});
