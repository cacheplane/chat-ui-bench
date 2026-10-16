import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {projectOrderedBrowserFrameEvidence,projectOrderedBrowserFrameState,ORDERED_STATE_POLICY,ORDERED_STATE_V2_POLICY} from './browser-frame-ordered-state.js';
import {body,join,uint} from './browser-frame-packet-fragments.test-helper.js';
const envelope=(...packets:Uint8Array[])=>({domain:'manual',packets});
const packet=(...parts:Uint8Array[])=>join(uint(10,1n),...parts);
const descriptor=(uuid:bigint,pid?:bigint,parent?:bigint)=>body(60,join(uint(1,uuid),...(pid===undefined?[]:[body(3,uint(1,pid))]),...(parent===undefined?[]:[uint(5,parent)])));
const clock=(id:bigint)=>body(6,join(uint(2,6n),body(1,join(uint(1,id),uint(2,9007199254740993n),uint(3,1n),uint(4,1000n)))));
function projected(...packets:Uint8Array[]):any{const r=projectOrderedBrowserFrameEvidence(envelope(...packets),ORDERED_STATE_V2_POLICY);expect(r.status).toBe('projected_ordered_manual_evidence');return r;}
test('opt-in only; v1 rejection and normal result shape remain unchanged',()=>{
 expect(projectOrderedBrowserFrameState(envelope(descriptor(1n)),ORDERED_STATE_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'missing-sequence-id',packetIndex:0}]});
 const v1=projectOrderedBrowserFrameState(envelope(packet()),ORDERED_STATE_POLICY);expect(v1).not.toHaveProperty('descriptorObservations');
 expect(projectOrderedBrowserFrameEvidence(envelope(),ORDERED_STATE_POLICY).status).toBe('unavailable');
 expect(projectOrderedBrowserFrameState(envelope(),ORDERED_STATE_V2_POLICY).status).toBe('unavailable');
});
test('sequence-independent descriptor links exact original hash/offsets without fabricated sequence',()=>{
 const b=descriptor(9007199254740993n,42n),r=projected(b),d=r.descriptorObservations[0];
 expect(r.packets).toEqual([]);expect(r.sequences).toEqual([]);expect(r.metadataPackets[0]).toMatchObject({packetIndex:0,sequenceContext:{status:'absent'}});
 expect(d).toMatchObject({packetIndex:0,bodySha256:createHash('sha256').update(b).digest('hex'),machineContext:{status:'absent'},sequenceContext:{status:'absent'},fields:{uuid:'9007199254740993',process:{pid:'42'}},associationStatus:'unestablished'});
 expect(d.location.end).toBe(b.length);expect(d.occurrences[0].start).toBe(d.location.valueStart);expect(d.reasons).toContain('missing_sequence_context');
});
test.each([body(59,new Uint8Array()),body(12,new Uint8Array()),body(11,new Uint8Array())])('sequence-less stateful payload is refused %#',b=>{
 expect(projectOrderedBrowserFrameEvidence(envelope(b),ORDERED_STATE_V2_POLICY)).toMatchObject({status:'unavailable',diagnostics:[{code:'missing-sequence-id',packetIndex:0}]});
});
test('zero sequence is not treated as absent metadata context',()=>{
 expect(projectOrderedBrowserFrameEvidence(envelope(join(uint(10,0n),descriptor(1n))),ORDERED_STATE_V2_POLICY)).toMatchObject({status:'unavailable',diagnostics:[{code:'zero-sequence-id'}]});
});
test('clock metadata keeps fields and missing writer scope explicit',()=>{
 const r=projected(clock(64n));expect(r.clockSnapshots[0]).toMatchObject({primaryTraceClock:'6',sequenceContext:{status:'absent'},clocks:[{clockId:'64',timestamp:'9007199254740993',isIncremental:true,unitMultiplierNs:'1000',scope:{kind:'unavailable',reason:'missing_sequence_context'}}]});
 expect(r.clockAdmission).toBe('not_evaluated');
});
test.each([[0n,'unknown_clock_id'],[128n,'reserved_clock_id']] as const)('clock ID %s preserves value without inventing machine scope', (id,reason)=>{
 const r=projected(packet(clock(id)));
 expect(r.clockSnapshots[0].clocks[0]).toMatchObject({clockId:id.toString(),scope:{kind:'unavailable',reason}});
});
test('same numeric sequence-local clocks retain different machine and writer scopes',()=>{
 const r=projected(packet(clock(64n)),join(uint(10,2n),clock(64n)),packet(uint(98,0n),clock(64n)));
 expect(r.clockSnapshots.map((c:any)=>c.clocks[0].scope)).toEqual([{kind:'sequence-local',machineContext:{status:'absent'},sequenceId:'1'},{kind:'sequence-local',machineContext:{status:'absent'},sequenceId:'2'},{kind:'sequence-local',machineContext:{status:'present',machineId:'0'},sequenceId:'1'}]);
});
test('reset and loss remain independent observations and cannot establish history completeness',()=>{
 const r=projected(packet(uint(13,1n),uint(42,3n),descriptor(1n,2n)),packet(descriptor(1n,2n)));
 expect(r.packets[0].stateEffect).toBe('reset');expect(r.lossObservations[0]).toMatchObject({packetIndex:0,resetObserved:true,dropObserved:true,previousPacketDropped:'3',historyCompleteness:'unestablished'});
 expect(r.descriptorObservations).toHaveLength(2);expect(r.descriptorObservations.every((d:any)=>d.associationStatus==='unestablished')).toBe(true);
});
test('identical re-emissions and optional omissions do not conflict; machine/different UUID separate',()=>{
 const r=projected(packet(descriptor(1n,2n)),packet(descriptor(1n)),packet(descriptor(2n,2n)),packet(uint(98,0n),descriptor(1n,3n)));
 expect(r.descriptorObservations).toHaveLength(4);expect(r.descriptorObservations.every((d:any)=>!d.reasons.includes('conflicting_association'))).toBe(true);
});
test('incompatible disclosures for same machine/UUID mark every retained observation',()=>{
 const r=projected(packet(descriptor(1n,2n)),packet(descriptor(1n)),join(uint(10,2n),descriptor(1n,3n)));
 expect(r.descriptorObservations.every((d:any)=>d.reasons.includes('conflicting_association'))).toBe(true);
});
test('adding an omitted optional association child is ambiguity, not a disclosed-value conflict',()=>{
 const r=projected(packet(descriptor(1n,2n)),packet(body(60,join(uint(1,1n),body(3,uint(1,2n)),body(4,join(uint(1,2n),uint(2,3n)))))));
 expect(r.descriptorObservations.every((d:any)=>!d.reasons.includes('conflicting_association'))).toBe(true);
 expect(r.descriptorObservations.every((d:any)=>d.reasons.includes('ambiguous_process_and_thread'))).toBe(true);
});
test('parent and process+thread ambiguity are exposed without inherited ownership',()=>{
 const r=projected(packet(descriptor(1n,2n,9n)),packet(body(60,join(uint(1,2n),body(3,uint(1,2n)),body(4,join(uint(1,2n),uint(2,3n)))))));
 expect(r.descriptorObservations[0].reasons).toContain('unresolved_parent');expect(r.descriptorObservations[1].reasons).toContain('ambiguous_process_and_thread');
 expect(r).toMatchObject({evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,runtimeQualification:'unestablished',associationStatus:'unestablished'});
});
test('default and explicit selections retain their original interval/version provenance',()=>{
 const r=projected(packet(uint(13,1n),body(59,join(uint(58,64n),body(11,uint(11,9n))))),packet(body(11,new Uint8Array())));
 expect(r.packets[1]).toMatchObject({intervalVersion:1,defaultsVersionIndex:0,clockSelection:{source:'defaults',clockId:'64',defaultsVersionIndex:0}});expect(r.events[0].trackSelection).toMatchObject({source:'defaults',trackUuid:'9',defaultsVersionIndex:0});
});
test('owned immutable observations survive input mutation and unknown offsets remain original',()=>{
 const b=packet(body(60,join(uint(1,1n),uint(99,7n)))),r=projected(b);b.fill(0);
 expect(r.descriptorObservations[0].fields.uuid).toBe('1');expect(Object.isFrozen(r.descriptorObservations[0].fields)).toBe(true);expect(r.opaqueLocations.some((o:any)=>o.scope==='track_descriptor'&&o.fieldNumber===99)).toBe(true);
});
test('nested descriptor failures deny the whole projection with bounded component diagnostics',()=>{
 const malformed=packet(body(60,join(uint(1,1n),uint(1,2n))));
 expect(projectOrderedBrowserFrameEvidence(envelope(packet(),malformed),ORDERED_STATE_V2_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'fragment-unavailable',packetIndex:1,component:'track_descriptor',cause:'duplicate-selected-field'}]});
});
test('metadata cannot smuggle sequence defaults through a descriptor packet',()=>{
 expect(projectOrderedBrowserFrameEvidence(envelope(join(descriptor(1n),body(59,new Uint8Array()))),ORDERED_STATE_V2_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'missing-sequence-id',packetIndex:0}]});
});
test('full packet boundary retains all1024 descriptor re-emissions, then rejects1025',()=>{
 const packets=Array.from({length:1024},()=>packet(descriptor(1n,2n)));
 expect(projected(...packets).descriptorObservations).toHaveLength(1024);
 expect(projectOrderedBrowserFrameEvidence(envelope(...packets,packet()),ORDERED_STATE_V2_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'packet-capacity'}]});
});
test('clock child and descriptor field work limits are reused, not enlarged',()=>{
 const clocks=body(6,join(...Array.from({length:1025},(_,i)=>body(1,uint(1,BigInt(i))))));
 expect(projectOrderedBrowserFrameEvidence(envelope(clocks),ORDERED_STATE_V2_POLICY)).toMatchObject({status:'unavailable',diagnostics:[{component:'clock_snapshot',cause:'clock-child-capacity'}]});
 const fields=body(60,join(uint(1,1n),...Array.from({length:32768},()=>uint(99,0n))));
 expect(projectOrderedBrowserFrameEvidence(envelope(fields),ORDERED_STATE_V2_POLICY)).toMatchObject({status:'unavailable',diagnostics:[{component:'track_descriptor',cause:'field-capacity'}]});
});
test('zero/default clock remains unavailable and missing descriptor remains an explicit reason',()=>{
 const r=projected(packet(uint(58,0n),body(11,uint(11,9n))));
 expect(r.packets[0].clockSelection).toMatchObject({status:'unavailable'});expect(r.associationReasons).toContain('missing_descriptor');
});
