import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {projectBrowserFrameTraceEvidence,TRACE_EVIDENCE_POLICY} from './browser-frame-trace-evidence.js';
import {projectOrderedBrowserFrameEvidence,ORDERED_STATE_V2_POLICY} from './browser-frame-ordered-state.js';
import {WireError} from './browser-frame-protobuf-wire.js';
import {body,join,uint} from './browser-frame-packet-fragments.test-helper.js';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const packet=(...parts:Uint8Array[])=>join(uint(10,1n),...parts);
const trace=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const descriptor=(pid:bigint)=>body(60,join(uint(1,9007199254740993n),body(3,uint(1,pid))));
const clock=()=>body(6,body(1,join(uint(1,64n),uint(2,9007199254740993n))));
function projected(bytes:Uint8Array){const r=projectBrowserFrameTraceEvidence(bytes,TRACE_EVIDENCE_POLICY);expect(r.status).toBe('projected_trace_evidence');if(r.status!=='projected_trace_evidence')throw Error('Expected supplied projection');return r;}
function denied(bytes:unknown,stage:string,code:string,policy:unknown=TRACE_EVIDENCE_POLICY){const r=projectBrowserFrameTraceEvidence(bytes,policy);expect(r.status).toBe('unavailable');if(r.status!=='unavailable')throw Error('Expected denial');expect(r.diagnostics).toMatchObject([{stage,code}]);expect(r).not.toHaveProperty('frames');expect(r).not.toHaveProperty('ordered');return r;}
test('empty whole Trace has structural EOF but no transport/capture/clock authority',()=>{
 const r=projected(new Uint8Array());expect(r).toMatchObject({inputRef:{status:'owned',bytes:0,sha256:hash(new Uint8Array())},structuralContainerEOF:true,frameCount:0,frames:[],nestedOffsets:'packet-relative',inputOrder:'byte-order',captureCompleteness:'unestablished',clockAdmission:'not_evaluated',targetLifetime:'unestablished',runtimeQualification:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,nativeSupported:false});
 expect(r.ordered).toMatchObject({captureOrder:'caller_declared',domain:'whole-supplied-trace-diagnostic-group-v1',bodies:[]});expect(r).not.toHaveProperty('fps');
});
test('binds original whole/body hashes and all wrapper offsets in byte order',()=>{
 const a=packet(descriptor(7n)),b=packet(clock()),bytes=trace(a,b),r=projected(bytes);
 expect(r.inputRef).toEqual({status:'owned',bytes:bytes.length,sha256:hash(bytes)});expect(r.frameCount).toBe(2);
 let next=0;for(const [i,f] of r.frames.entries()){
  const original=i===0?a:b;expect(f).toMatchObject({frameIndex:i,packetIndex:i,keyStart:next,keyEnd:next+1,lengthStart:next+1,lengthEnd:next+2,bodyStart:next+2,bodyEnd:next+2+original.length,bodyBytes:original.length,bodySha256:hash(original)});
  expect(r.ordered.bodies[i]).toEqual({packetIndex:i,bytes:f.bodyBytes,sha256:f.bodySha256});expect(f).not.toHaveProperty('packet');expect(f).not.toHaveProperty('body');next=f.bodyEnd;
 }
 expect(next).toBe(bytes.length);
});
test('nested offsets stay packet-relative with an exact full-input bodyStart anchor',()=>{
 const bytes=trace(packet(),packet(descriptor(7n))),r=projected(bytes),f=r.frames[1]!,d=r.ordered.descriptorObservations[0]!;
 expect(d.packetIndex).toBe(1);expect(d.location.valueStart).toBe(5);
 expect(bytes[f.bodyStart+d.location.valueStart]).toBe(8);expect(d.occurrences[0]!.start).toBe(d.location.valueStart);
 expect(d.location.end).toBe(f.bodyBytes);expect(d.bodySha256).toBe(f.bodySha256);
});
test('sequence-less metadata retains explicit absent writer context',()=>{
 const r=projected(trace(descriptor(7n),clock()));expect(r.ordered.sequences).toEqual([]);expect(r.ordered.packets).toEqual([]);expect(r.ordered.metadataPackets).toHaveLength(2);
 expect(r.ordered.descriptorObservations[0]).toMatchObject({sequenceContext:{status:'absent'},machineContext:{status:'absent'},associationStatus:'unestablished'});
 expect(r.ordered.clockSnapshots[0]!.clocks[0]!.scope).toEqual({kind:'unavailable',reason:'missing_sequence_context'});
});
test('preserves descriptor conflicts, writer clocks and machine-presence separation',()=>{
 const r=projected(trace(packet(descriptor(1n)),packet(descriptor(2n)),packet(clock()),join(uint(10,2n),clock()),packet(uint(98,0n),clock())));
 expect(r.ordered.descriptorObservations.every(d=>d.reasons.includes('conflicting_association'))).toBe(true);
 expect(r.ordered.clockSnapshots.map(c=>c.clocks[0]!.scope)).toEqual([{kind:'sequence-local',machineContext:{status:'absent'},sequenceId:'1'},{kind:'sequence-local',machineContext:{status:'absent'},sequenceId:'2'},{kind:'sequence-local',machineContext:{status:'present',machineId:'0'},sequenceId:'1'}]);
});
test('dropped-plus-cleared retains both facts without a complete-history inference',()=>{
 const r=projected(trace(packet(uint(13,1n),uint(42,3n))));expect(r.ordered.packets[0]!.stateEffect).toBe('reset');expect(r.ordered.lossObservations[0]).toMatchObject({resetObserved:true,dropObserved:true,previousPacketDropped:'3',historyCompleteness:'unestablished'});
});
test('a late corrupt wrapper denies atomically before any success prefix',()=>{
 const b=join(trace(packet()),new Uint8Array([10,128])),r=denied(b,'ingress','truncated-varint');expect(r.structuralContainerEOF).toBe(false);expect(r.inputRef).toEqual({status:'owned',bytes:b.length,sha256:hash(b)});
});
test('a late malformed packet retains structural wrapper EOF but no ordered success',()=>{
 const b=trace(packet(),new Uint8Array([0])),r=denied(b,'ingress','packet-unavailable');expect(r.structuralContainerEOF).toBe(true);expect(r.diagnostics[0]).toMatchObject({frameIndex:1});
});
test('ordered rejection is atomic and linked to its original wrapper body anchor',()=>{
 const r=denied(trace(packet(),uint(10,0n)),'ordered','zero-sequence-id');expect(r.structuralContainerEOF).toBe(true);expect(r.diagnostics[0]).toMatchObject({packetIndex:1,bodyStart:6});
});
test('wrong policy rejects before touching a hostile supplied object',()=>{
 let calls=0;const b=new Proxy({}, {getPrototypeOf(){calls++;throw Error('secret');}});denied(b,'input','unsupported-policy','other');expect(calls).toBe(0);
});
test('unsupported/hostile input yields bounded diagnostic without arbitrary thrown-value authority',()=>{
 denied(Buffer.from([]),'input','unsupported-byte-view');
 const error=new Proxy({}, {getPrototypeOf(){throw Error('secret');}}),b=new Proxy({}, {getPrototypeOf(){throw error;}});
 const r=denied(b,'input','invalid-trace-evidence-input');expect(JSON.stringify(r)).not.toContain('secret');
});
test('native input copy ignores poisoned own byte-view properties',()=>{
 const bytes=trace(packet());let reads=0;
 for(const key of ['length','byteLength','buffer','slice',Symbol.iterator])Object.defineProperty(bytes,key,{get(){reads++;throw Error('secret');}});
 expect(projected(bytes).frameCount).toBe(1);expect(reads).toBe(0);
});
test.each(['return','throw'] as const)('captured hostile WireError code getter %s is read once with bounded fallback',kind=>{
 let reads=0;const error=new WireError('byte-capacity');Object.defineProperty(error,'code',{get(){reads++;if(kind==='throw')throw Error('secret');return 'secret';}});
 const input=new Proxy({}, {getPrototypeOf(){throw error;}});const r=denied(input,'input','invalid-trace-evidence-input');expect(reads).toBe(1);expect(JSON.stringify(r)).not.toContain('secret');
});
test('all returned data is JSON-safe and immutable with no mutable byte views',()=>{
 const b=trace(packet(descriptor(7n))),r=projected(b),before=JSON.stringify(r);b.fill(0);expect(JSON.stringify(r)).toBe(before);
 const visit=(v:unknown)=>{if(v&&typeof v==='object'){expect(v).not.toBeInstanceOf(Uint8Array);expect(Object.isFrozen(v)).toBe(true);for(const child of Object.values(v))visit(child);}};visit(r);
});
test('exact256KiB whole input limit includes Trace wrapper bytes',()=>{
 const b=trace(packet(body(20000,new Uint8Array(262132))));expect(b.length).toBe(262144);expect(projected(b).inputRef.bytes).toBe(262144);
 denied(join(b,new Uint8Array(1)),'input','byte-capacity');
});
test('all1024 Trace frames retained and1025 refuses without pruning',()=>{
 const packets=Array.from({length:1024},()=>packet());expect(projected(trace(...packets)).frames).toHaveLength(1024);denied(trace(...packets,packet()),'ingress','frame-capacity');
});
test('wrapper metadata cannot waive the existing four-MiB ordered output ceiling',()=>{
 const intern=(padding:number)=>packet(uint(13,1n),body(12,join(...Array.from({length:4096},(_,i)=>body(2,join(uint(1,BigInt(i+1)),body(2,new Uint8Array(Math.min(4096,Math.max(0,padding-i*4096))))))))));
 const original=[intern(32768),intern(3661),body(6,join(...Array.from({length:8191},()=>uint(536870911,0n))))];
 const ordered=projectOrderedBrowserFrameEvidence({domain:'whole-supplied-trace-diagnostic-group-v1',packets:original},ORDERED_STATE_V2_POLICY);
 expect(ordered.status).toBe('projected_ordered_manual_evidence');const orderedBytes=Buffer.byteLength(JSON.stringify(ordered));
 expect(orderedBytes).toBeLessThanOrEqual(4194304);expect(4194304-orderedBytes).toBeLessThan(32);
 const bytes=trace(...original);expect(bytes.length).toBeLessThanOrEqual(262144);denied(bytes,'composition','output-byte-capacity');
});
