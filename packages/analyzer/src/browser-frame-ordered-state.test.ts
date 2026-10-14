import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { projectOrderedBrowserFrameState, ORDERED_STATE_POLICY } from './browser-frame-ordered-state.js';
import { body, join, text, uint, vi } from './browser-frame-packet-fragments.test-helper.js';
const envelope = (...packets: Uint8Array[]) => ({domain:'manual',packets});
const packet = (...parts: Uint8Array[]) => join(uint(10,1n),...parts);
function projected(...packets: Uint8Array[]): any {
  const result=projectOrderedBrowserFrameState(envelope(...packets),ORDERED_STATE_POLICY) as any;
  expect(result.status).toBe('projected_ordered_manual_state');return result;
}
function unavailable(input: unknown, code: string, packetIndex?:number, policy:unknown=ORDERED_STATE_POLICY): void {
  expect(projectOrderedBrowserFrameState(input,policy)).toEqual({status:'unavailable',diagnostics:[{code,...(packetIndex===undefined?{}:{packetIndex})}]});
}
test('empty batch supplies frozen structural projection without runtime/capture admission',()=>{
  const r=projected();expect(r).toMatchObject({domain:'manual',bodies:[],sequences:[],defaultsVersions:[],internDefinitions:[],packets:[],events:[],opaqueLocations:[],clockAdmission:'not_evaluated',captureOrder:'caller_declared',runtimeQualification:'unestablished',sourceCoverage:'unestablished',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.events)).toBe(true);
});
test('body metadata binds copied bytes without capture origin claims',()=>{
  const b=packet();expect(projected(b).bodies).toEqual([{packetIndex:0,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}]);
});
test('exact policy and plain inert envelope boundary',()=>{
  unavailable(envelope(),'unsupported-policy',undefined,'other');
  for(const value of [null,[],{domain:'manual'},{packets:[]},{domain:'',packets:[]},{domain:'é',packets:[]},{domain:'x'.repeat(129),packets:[]},{domain:'manual',packets:[],extra:true}])unavailable(value,'invalid-envelope');
  const accessor={packets:[]};Object.defineProperty(accessor,'domain',{get(){throw new Error('accessor');}});unavailable(accessor,'invalid-envelope');
  const symbol=envelope();Object.defineProperty(symbol,Symbol('extra'),{value:1});unavailable(symbol,'invalid-envelope');
  const nullPrototype=Object.assign(Object.create(null),envelope());expect((projectOrderedBrowserFrameState(nullPrototype,ORDERED_STATE_POLICY) as any).status).toBe('projected_ordered_manual_state');
});
test('ordinary dense array data descriptors are required without reading getters',()=>{
  const sparse=new Array(1);const extra:any=[];extra.x=1;const accessor:any=[];Object.defineProperty(accessor,'0',{get(){throw new Error('getter');},configurable:true});
  for(const packets of [sparse,extra,accessor,new(class extends Array{})()])unavailable({domain:'manual',packets},'invalid-envelope');
  expect((projectOrderedBrowserFrameState({domain:'manual',packets:Object.freeze([packet()])},ORDERED_STATE_POLICY) as any).status).toBe('projected_ordered_manual_state');
});
test('per-body native-copy protections and poisoning do not evaluate caller properties',()=>{
  for(const bytes of [Buffer.from([]),new Uint16Array(),new(class extends Uint8Array{})()])unavailable({domain:'manual',packets:[bytes]},'unsupported-byte-view',0);
  const b=packet();for(const key of ['length','byteLength','buffer','slice',Symbol.iterator])Object.defineProperty(b,key,{get(){throw new Error('poison');}});expect(projected(b).bodies[0].bytes).toBe(2);
});
test('aggregate packet capacity precedes semantic work',()=>{
  expect(projected(...Array.from({length:1024},()=>packet())).bodies).toHaveLength(1024);unavailable(envelope(...Array.from({length:1025},()=>packet())),'packet-capacity');
});
test('aggregate copied bytes have an exact four-MiB boundary',()=>{
  const big=packet(body(20000,new Uint8Array(262136)));expect(big.length).toBe(262144);
  expect(projected(...Array.from({length:16},()=>big)).bodies).toHaveLength(16);unavailable(envelope(...Array.from({length:16},()=>big),new Uint8Array(1)),'input-byte-capacity',16);
});

test('initial state and first marker never independently establish validity',()=>{
  const r=projected(packet(),packet(uint(87,1n)));expect(r.sequences).toEqual([{sequenceIndex:0,sequenceId:'1',valid:false,intervalVersion:0}]);expect(r.packets.map((p:any)=>[p.valid,p.intervalVersion,p.stateEffect])).toEqual([[false,0,'none'],[false,0,'none']]);
});
test('source sequence IDs stay exact and absence/zero are profile refusals',()=>{
  expect(projected(uint(10,4294967295n)).sequences[0].sequenceId).toBe('4294967295');unavailable(envelope(new Uint8Array()),'missing-sequence-id',0);unavailable(envelope(uint(10,0n)),'zero-sequence-id',0);
});
test('machine absence, zero and maximum use distinct sequence keys',()=>{
  const r=projected(packet(),packet(uint(98,0n)),packet(uint(98,4294967295n)),packet());expect(r.sequences.map((s:any)=>[s.sequenceId,s.machineId])).toEqual([['1',undefined],['1','0'],['1','4294967295']]);expect(r.packets.map((p:any)=>p.sequenceIndex)).toEqual([0,1,2,0]);
});
test('sequence count limit applies across scoped keys',()=>{
  const packets=Array.from({length:64},(_,i)=>uint(10,BigInt(i+1)));expect(projected(...packets).sequences).toHaveLength(64);unavailable(envelope(...packets,uint(10,65n)),'sequence-capacity',64);
});
test.each([uint(41,1n),uint(13,1n),join(uint(41,0n),uint(13,1n))])('each reset route establishes a new interval %#',reset=>{
  const r=projected(packet(reset));expect(r.packets[0]).toMatchObject({valid:true,intervalVersion:1,stateEffect:'reset',defaultsVersionIndex:null});
});
test('reset wins loss while exact loss reasons survive',()=>{
  const r=projected(packet(uint(13,1n),uint(42,257n)),packet(uint(42,4n)),packet(uint(41,1n)));expect(r.packets.map((p:any)=>[p.valid,p.intervalVersion,p.stateEffect])).toEqual([[true,1,'reset'],[false,2,'loss'],[true,3,'reset']]);expect(r.packets[0].fields.previousPacketDropped).toBe('257');expect(r.packets[1].fields.previousPacketDropped).toBe('4');
});
test('raw absent versus zero flags/loss and false first/reset remain distinct',()=>{
  const r=projected(packet(),packet(uint(13,0n),uint(42,0n),uint(87,0n),uint(41,0n)));expect(r.packets[0].fields).toEqual({sequenceId:'1'});expect(r.packets[1].fields).toEqual({sequenceId:'1',sequenceFlags:'0',previousPacketDropped:'0',firstPacketOnSequence:false,incrementalStateCleared:false});
});
test.each([4n,8n,4294967295n])('unknown flag bits %s deny atomically',flags=>unavailable(envelope(packet(uint(13,1n)),packet(uint(13,flags))),'unsupported-sequence-flags',1));
test('interleaved sequence transitions remain independent',()=>{
  const r=projected(packet(uint(13,1n)),join(uint(10,2n),uint(42,1n)),packet(),join(uint(10,2n),uint(13,1n)));expect(r.packets.map((p:any)=>[p.sequenceIndex,p.valid,p.intervalVersion])).toEqual([[0,true,1],[1,false,1],[0,true,1],[1,true,2]]);
});
const defaults = (clock?:bigint,track?:bigint):Uint8Array => body(59,join(...(clock===undefined?[]:[uint(58,clock)]),...(track===undefined?[]:[body(11,uint(11,track))])));
const event = (...parts:Uint8Array[]):Uint8Array => body(11,join(...parts));
test('default versions include index zero and every whole replacement',()=>{
  const r=projected(packet(uint(13,1n),defaults(3n,0n)),packet(defaults(4n)),packet(body(59,new Uint8Array())));
  expect(r.defaultsVersions.map((v:any)=>[v.versionIndex,v.intervalVersion,v.fields])).toEqual([[0,1,{timestampClockId:'3',trackEventDefaultsPresent:true,trackUuid:'0'}],[1,1,{timestampClockId:'4'}],[2,1,{}]]);expect(r.packets.map((p:any)=>p.defaultsVersionIndex)).toEqual([0,1,2]);expect(Object.isFrozen(r.defaultsVersions[0])).toBe(true);
});
test('same-packet defaults precede literal event independent of wire order',()=>{
  const r=projected(packet(event(text(23,'')),defaults(3n,0n),uint(13,1n)));
  expect(r.packets[0].clockSelection).toEqual({status:'selected',source:'defaults',clockId:'3',defaultsVersionIndex:0});expect(r.events[0]).toMatchObject({defaultsVersionIndex:0,name:{kind:'literal',value:''},trackSelection:{status:'selected',source:'defaults',trackUuid:'0',defaultsVersionIndex:0}});expect(r.packets[0].eventIndex).toBe(0);
});
test('raw timestamp absence, zero and full uint64 never imply normalized ns',()=>{
  const r=projected(packet(),packet(uint(8,0n)),packet(uint(8,18446744073709551615n)));expect(r.packets.map((p:any)=>p.fields.timestamp)).toEqual([undefined,'0','18446744073709551615']);expect(r.clockAdmission).toBe('not_evaluated');
});
test('explicit nonzero clocks win while zero or absent can use only valid nonzero defaults',()=>{
  const r=projected(packet(uint(13,1n),defaults(3n)),packet(uint(58,4n)),packet(uint(58,0n)),packet(),packet(defaults(0n)),packet(uint(42,1n),defaults(7n)));
  expect(r.packets.map((p:any)=>p.clockSelection)).toEqual([{status:'selected',source:'defaults',clockId:'3',defaultsVersionIndex:0},{status:'selected',source:'packet',clockId:'4'},{status:'selected',source:'defaults',clockId:'3',defaultsVersionIndex:0},{status:'selected',source:'defaults',clockId:'3',defaultsVersionIndex:0},{status:'unavailable',reason:'no_explicit_or_valid_default_clock'},{status:'unavailable',reason:'invalid_sequence_default_state'}]);expect(r.packets[2].fields.timestampClockId).toBe('0');
});
test('loss retains invalid default pointer and reset clears it without rewriting older versions',()=>{
  const r=projected(packet(uint(13,1n),defaults(3n,9n)),packet(uint(42,1n)),packet(uint(13,1n)));
  expect(r.packets.map((p:any)=>p.defaultsVersionIndex)).toEqual([0,0,null]);expect(r.defaultsVersions[0].fields.trackUuid).toBe('9');expect(r.packets[1].clockSelection.status).toBe('unavailable');
});
test('updates during invalidity never restore validity or expose default track',()=>{
  const r=projected(packet(defaults(3n,0n),event(text(23,'literal'))));expect(r.packets[0].valid).toBe(false);expect(r.events[0].trackSelection).toEqual({status:'unavailable',reason:'invalid_sequence_default_state'});expect(r.packets[0].clockSelection.status).toBe('unavailable');
});
test('explicit event track zero wins and no implicit track is invented',()=>{
  const r=projected(packet(uint(13,1n),defaults(3n,7n),event(uint(11,0n))),packet(body(59,new Uint8Array()),event()));expect(r.events[0].trackSelection).toEqual({status:'selected',source:'event',trackUuid:'0'});expect(r.events[1].trackSelection).toEqual({status:'unavailable',reason:'no_explicit_or_valid_default_track'});
});
test.each([31,45])('counter default presence %i even empty is unsupported',n=>unavailable(envelope(packet(body(59,body(11,body(n,new Uint8Array()))))),'unsupported-counter-defaults',0));
test('empty defaults child retains source presence without invented track',()=>{
  const r=projected(packet(uint(13,1n),body(59,body(11,new Uint8Array()))));expect(r.defaultsVersions[0].fields).toEqual({trackEventDefaultsPresent:true});
});
test('clock snapshots and unknown fields remain explicitly opaque with original offsets',()=>{
  const b=packet(body(6,Uint8Array.of(255)),body(20000,Uint8Array.of(255)));const r=projected(b);expect(r.opaqueLocations.map((o:any)=>o.fieldNumber)).toEqual([6,20000]);for(const o of r.opaqueLocations)expect(Array.from(b.subarray(o.valueStart,o.end))).toEqual([255]);expect(r.clockAdmission).toBe('not_evaluated');
});
const intern = (table:number,iid:bigint,value:string):Uint8Array => body(12,body(table,join(uint(1,iid),text(2,value))));
test('same-packet intern declarations precede event names and category references',()=>{
  const entries=body(12,join(body(2,join(uint(1,18446744073709551615n),text(2,'name'))),body(1,join(uint(1,9007199254740993n),text(2,'category')))));
  const r=projected(packet(event(uint(10,18446744073709551615n),body(3,join(vi(9007199254740993n),vi(9007199254740993n))),text(22,'')),entries,uint(13,1n)));
  expect(r.events[0]).toMatchObject({name:{kind:'intern',definitionIndex:0},internedCategoryDefinitionIndexes:[1,1],literalCategories:['']});expect(r.internDefinitions.map((d:any)=>[d.iid,d.value])).toEqual([['18446744073709551615','name'],['9007199254740993','category']]);
});
test('same IID stays independent across tables, sequences and machine absence',()=>{
  const both=body(12,join(body(1,join(uint(1,18446744073709551615n),text(2,'category'))),body(2,join(uint(1,18446744073709551615n),text(2,'name')))));
  const r=projected(packet(uint(13,1n),both),join(uint(10,2n),uint(13,1n),intern(2,18446744073709551615n,'other')),packet(uint(98,0n),uint(13,1n),intern(2,18446744073709551615n,'machine')));
  expect(r.internDefinitions.map((d:any)=>[d.sequenceIndex,d.table,d.value])).toEqual([[0,'event_categories','category'],[0,'event_names','name'],[1,'event_names','other'],[2,'event_names','machine']]);
});
test('identical selected value repeats keep first definition provenance despite changed encoding',()=>{
  const r=projected(packet(uint(13,1n),intern(2,1n,'same')),packet(body(12,body(2,join(text(2,'same'),uint(1,1n),body(99,Uint8Array.of(255))))),event(uint(10,1n))));expect(r.internDefinitions).toHaveLength(1);expect(r.internDefinitions[0].definedAt.packetIndex).toBe(0);expect(r.events[0].name.definitionIndex).toBe(0);expect(r.packets[1]).toMatchObject({internNewDefinitions:0,internRepeatedDefinitions:1,internUpdateOutcome:'applied'});
});
test('cross-packet conflicting value refuses all earlier state',()=>unavailable(envelope(packet(uint(13,1n),intern(2,1n,'a')),packet(intern(2,1n,'b'))),'intern-conflict',1));
test('reset permits IID reuse with new value without relabeling earlier definitions',()=>{
  const r=projected(packet(uint(13,1n),intern(2,1n,'old'),event(uint(10,1n))),packet(uint(13,1n),intern(2,1n,'new'),event(uint(10,1n))));expect(r.events.map((e:any)=>e.name.definitionIndex)).toEqual([0,1]);expect(r.internDefinitions.map((d:any)=>[d.intervalVersion,d.value])).toEqual([[1,'old'],[2,'new']]);
});
test('invalid intern updates are structurally checked but withheld until reset',()=>{
  const r=projected(packet(intern(2,1n,'ignored')),packet(uint(13,1n),intern(2,1n,'accepted'),event(uint(10,1n))));expect(r.internDefinitions.map((d:any)=>d.value)).toEqual(['accepted']);expect(r.packets[0].internUpdateOutcome).toBe('withheld_invalid');
});
test('loss blocks new updates and dependent lookup while preserving earlier immutable facts',()=>{
  const r=projected(packet(uint(13,1n),intern(2,1n,'old'),event(uint(10,1n))),packet(uint(42,1n),intern(2,2n,'ignored'),event(uint(10,1n))));expect(r.events).toHaveLength(1);expect(r.events[0].name.definitionIndex).toBe(0);expect(r.internDefinitions[0].intervalVersion).toBe(1);expect(r.packets[1]).toMatchObject({eventOutcome:'withheld_intern_invalid',internUpdateOutcome:'withheld_invalid',intervalVersion:2});expect(r.packets[1]).not.toHaveProperty('eventIndex');
});
test('flag2 dependency withholding has no partially resolved literal event',()=>{
  const r=projected(packet(uint(13,2n),event(text(23,'literal'),text(22,'category'))));expect(r.events).toEqual([]);expect(r.packets[0].eventOutcome).toBe('withheld_dependency');expect(r.packets[0].eventLocation.fieldNumber).toBe(11);
});
test('intern references require valid state even without flag2',()=>{
  const r=projected(packet(event(uint(10,1n))),packet(event(uint(3,1n))));expect(r.events).toEqual([]);expect(r.packets.map((p:any)=>p.eventOutcome)).toEqual(['withheld_intern_invalid','withheld_intern_invalid']);
});
test('empty packed IID presence needs no lookup and literal events can resolve while invalid',()=>{
  const r=projected(packet(event(body(3,new Uint8Array()),text(22,''),text(23,''))));expect(r.events[0]).toMatchObject({name:{kind:'literal',value:''},literalCategories:[''],internedCategoryDefinitionIndexes:[]});expect(r.packets[0].valid).toBe(false);
});
test.each([uint(10,0n),uint(3,0n)])('event IID zero denies even withheld event %#',iid=>unavailable(envelope(packet(uint(13,2n),event(iid))),'invalid-event-iid',0));
test.each([uint(10,1n),uint(3,1n)])('eligible missing definition denies atomically %#',iid=>unavailable(envelope(packet(uint(13,1n),event(iid))),'missing-intern-definition',0));
test('empty intern body and unknown child spans retain original packet provenance',()=>{
  const first=packet(body(12,new Uint8Array()));const second=packet(uint(13,1n),body(12,body(2,join(uint(1,1n),text(2,''),body(99,Uint8Array.of(255))))));const r=projected(first,second);expect(r.packets[0].internLocation.fieldNumber).toBe(12);expect(r.packets[0].internLocation.end).toBe(first.length);expect(r.internDefinitions[0].definedAt.packetIndex).toBe(1);const location=r.opaqueLocations.find((o:any)=>o.scope==='event_name'&&o.fieldNumber===99);expect(Array.from(second.subarray(location.valueStart,location.end))).toEqual([255]);
});
test('all unprojected typed bodies remain opaque and never become frame observations',()=>{
  const r=projected(packet(event(body(1075,uint(1,1n)),body(1052,uint(1,5n)))));expect(r.events[0].typedArgumentKinds).toEqual(['reporter2','graphics']);expect(r.opaqueLocations.map((o:any)=>o.fieldNumber)).toEqual([1075,1052]);expect(r.events[0]).not.toHaveProperty('reporter2');expect(r.evaluationEligibility).toBe(false);
});
test('within-body duplicate entries still refuse despite identical cross-packet policy',()=>{
  expect(projectOrderedBrowserFrameState(envelope(packet(uint(13,1n),body(12,join(body(2,join(uint(1,1n),text(2,'x'))),body(2,join(uint(1,1n),text(2,'x'))))))),ORDERED_STATE_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'fragment-unavailable',packetIndex:0,component:'interned_names',cause:'duplicate-intern-iid'}]});
});
function manyIntern(count:number,start=1n,table=2,value=''):Uint8Array{return body(12,join(...Array.from({length:count},(_,i)=>body(table,join(uint(1,start+BigInt(i)),text(2,value))))));}
test('aggregate fields count packet and child visits without double-counting containers',()=>{
  const emptyRefs=event(join(...Array.from({length:32766},()=>body(3,new Uint8Array()))));const b=packet(emptyRefs);
  expect(projected(b,b,b,b).events).toHaveLength(4);unavailable(envelope(b,b,b,b,packet()),'field-capacity',4);
});
test('ignored graphics repeated members still consume whole-call work capacity',()=>{
  const b=packet(event(body(1052,body(8,new Uint8Array(16384)))));expect(projected(b,b,b,b).events).toHaveLength(4);unavailable(envelope(b,b,b,b,packet(event(body(1052,uint(8,0n))))),'repeated-work-capacity',4);
});
test('invalid withheld intern entries still consume aggregate update budget',()=>{
  const b=packet(manyIntern(4096));expect(projected(b,b,b,b).internDefinitions).toEqual([]);unavailable(envelope(b,b,b,b,packet(intern(2,1n,''))),'intern-update-capacity',4);
});
test('live intern entries are bounded across tables while reset releases live state',()=>{
  const full=packet(uint(13,1n),manyIntern(4096));expect(projected(full).internDefinitions).toHaveLength(4096);unavailable(envelope(full,packet(intern(1,1n,''))),'live-intern-entry-capacity',1);expect(projected(full,packet(uint(13,1n),intern(1,1n,''))).internDefinitions).toHaveLength(4097);
});
test('live name byte budget is retained across loss and released by reset',()=>{
  const blocks=Array.from({length:4},(_,i)=>packet(...(i===0?[uint(13,1n)]:[]),manyIntern(8,BigInt(i*8+1),2,'x'.repeat(4096))));expect(projected(...blocks).internDefinitions).toHaveLength(32);unavailable(envelope(...blocks,packet(intern(2,33n,'x'))),'live-intern-string-capacity',4);const r=projected(...blocks,packet(uint(42,1n),intern(2,33n,'ignored')),packet(uint(13,1n),intern(2,33n,'x')));expect(r.internDefinitions).toHaveLength(33);expect(r.packets[4].internUpdateOutcome).toBe('withheld_invalid');
});
test('historical definitions remain bounded independently of released live maps',()=>{
  const full=packet(uint(13,1n),manyIntern(4096));expect(projected(full,full).internDefinitions).toHaveLength(8192);unavailable(envelope(full,full,packet(uint(13,1n),intern(2,1n,''))),'definition-capacity',2);
});
test('equal repeats consume work without creating historical dictionary copies',()=>{
  const entries=packet(manyIntern(4096));const r=projected(packet(uint(13,1n)),entries,entries,entries,entries);expect(r.internDefinitions).toHaveLength(4096);expect(r.packets[4].internRepeatedDefinitions).toBe(4096);unavailable(envelope(packet(uint(13,1n)),entries,entries,entries,entries,packet(intern(2,1n,''))),'intern-update-capacity',5);
});
test('category references stay bounded and never expand full intern values per event',()=>{
  const b=packet(event(body(3,new Uint8Array(16384).fill(1))));const first=packet(uint(13,1n),intern(1,1n,'x'.repeat(4096)));const r=projected(first,b,b);expect(r.internDefinitions).toHaveLength(1);expect(r.events.map((e:any)=>e.internedCategoryDefinitionIndexes.length)).toEqual([16384,16384]);expect(r.events[0].internedCategoryDefinitionIndexes[0]).toBe(0);expect(JSON.stringify(r).split('x'.repeat(4096))).toHaveLength(2);unavailable(envelope(first,b,b,packet(event(uint(3,1n)))),'reference-capacity',3);
});
test('opaque locations are complete or the whole batch is unavailable',()=>{
  const parts=join(...Array.from({length:8192},()=>uint(20000,0n)));expect(projected(packet(parts)).opaqueLocations).toHaveLength(8192);unavailable(envelope(packet(parts,uint(20000,0n))),'opaque-location-capacity',0);
});
test('many legal literal bodies exceed whole-output string budget atomically',()=>{
  const b=packet(event(join(...Array.from({length:8},()=>text(22,'x'.repeat(4096))))));expect(projected(...Array.from({length:8},()=>b)).events).toHaveLength(8);unavailable(envelope(...Array.from({length:17},()=>b)),'output-string-capacity',15);
});
test('new or repeated definitions retain immutable frozen dictionaries and exact shifted spans',()=>{
  const b=packet(uint(13,1n),intern(2,1n,'value'),event(uint(10,1n)));const r=projected(b);expect(Object.isFrozen(r.internDefinitions[0])).toBe(true);expect(Object.isFrozen(r.internDefinitions[0].definedAt)).toBe(true);expect(Object.isFrozen(r.packets[0].fields)).toBe(true);expect(Object.isFrozen(r.events[0].name)).toBe(true);expect(Array.from(b.subarray(r.internDefinitions[0].definedAt.valueStart,r.internDefinitions[0].definedAt.end))).toEqual(Array.from(join(uint(1,1n),text(2,'value'))));
});
test('late malformed packet reports one trusted cause without earlier facts',()=>{
  expect(projectOrderedBrowserFrameState(envelope(packet(uint(13,1n),intern(2,1n,'value')),join(packet(),Uint8Array.of(128))),ORDERED_STATE_POLICY)).toEqual({status:'unavailable',diagnostics:[{code:'fragment-unavailable',packetIndex:1,component:'packet',cause:'truncated-varint'}]});
});
test('output node capacity is independent of field, string and reference budgets',()=>{
  const literal=event(text(23,''),uint(11,0n));const emptyDefaults=body(59,new Uint8Array());
  const first=packet(uint(58,1n),uint(13,1n),manyIntern(4096),emptyDefaults,literal);
  const second=packet(uint(58,1n),uint(13,1n),body(12,join(body(1,join(uint(1,1n),text(2,''))),...Array.from({length:4095},(_,i)=>body(2,join(uint(1,BigInt(i+1)),text(2,'')))))),emptyDefaults,literal);
  const refs=event(text(23,''),uint(11,0n),body(3,new Uint8Array(16384).fill(1)));
  const opaque=join(...Array.from({length:8192},()=>uint(20000,0n)));
  const rest=Array.from({length:1020},()=>packet(uint(58,1n),emptyDefaults,literal));
  const result=projectOrderedBrowserFrameState(envelope(first,second,packet(uint(58,1n),emptyDefaults,refs,opaque),packet(uint(58,1n),emptyDefaults,refs),...rest),ORDERED_STATE_POLICY) as any;
  expect(result).toMatchObject({status:'unavailable',diagnostics:[{code:'output-node-capacity'}]});expect(Object.keys(result)).toEqual(['status','diagnostics']);expect(result.diagnostics[0].packetIndex).toBeGreaterThan(3);expect(result.diagnostics[0].packetIndex).toBeLessThan(1024);
});
test('serialized output cap accounts for JSON escapes rather than only raw UTF8',()=>{
  const blocks=Array.from({length:8},(_,block)=>packet(uint(58,1n),...(block%4===0?[uint(13,1n)]:[]),body(12,join(...Array.from({length:896},(_,i)=>body(2,join(uint(1,BigInt((block%4)*1024+i+1)),text(2,i<8?'\0'.repeat(4096):''))))))));
  const opaque=join(...Array.from({length:8192},()=>uint(20000,0n)));
  unavailable(envelope(...blocks,packet(uint(58,1n),opaque,event(text(23,'\0'.repeat(512)),uint(11,0n)))),'output-byte-capacity');
});
