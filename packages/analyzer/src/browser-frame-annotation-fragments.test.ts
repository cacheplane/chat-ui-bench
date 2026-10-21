import {describe as wholeDescribe,vi as wholeVi}from'vitest';
import *as wholePacket from'./browser-frame-packet-fragments.js';
import *as wholeState from'./browser-frame-state-fragments.js';
import *as wholePayload from'./browser-frame-protobuf-fragments.js';
import *as wholeDescriptor from'./browser-frame-track-descriptor-fragments.js';
import *as wholeWire from'./browser-frame-protobuf-wire.js';
import{readWholeAnnotationTrace}from'./browser-frame-whole-trace-reader.js';
import wholeFs from'node:fs';import wholeOs from'node:os';import wholePath from'node:path';import{createHash as wholeHash}from'node:crypto';
import {expect,test} from 'vitest';
import * as ordered from './browser-frame-ordered-state.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';
import {Budget,projectOrderedBrowserFrameState,ORDERED_STATE_POLICY} from './browser-frame-ordered-state.js';
import {decodeAnnotation,type AnnotationBody} from './browser-frame-trace-framer.js';
import {resolveAnnotations} from './browser-frame-ordered-state.js';
import {WireBudget} from './browser-frame-protobuf-wire.js';
import type {InternEntry} from './browser-frame-state-fragments.js';
import type {OrderedStateProjection,OrderedEvidenceProjection} from './browser-frame-ordered-state.js';
import type {EventFragment} from './browser-frame-track-event-fragments.js';
import type {PacketFragment} from './browser-frame-packet-fragments.js';
type LegacyTable<T extends InternEntry['table']>=T;
type LegacyStateTable<T extends OrderedStateProjection['internDefinitions'][number]['table']>=T;
type LegacyEvidenceTable<T extends OrderedEvidenceProjection['internDefinitions'][number]['table']>=T;
// @ts-expect-error annotation tables belong only to the opt-in result
type NoLegacyAnnotationTable=LegacyTable<'debug_annotation_names'>;
// @ts-expect-error annotation tables belong only to the opt-in result
type NoLegacyStateAnnotationTable=LegacyStateTable<'debug_annotation_names'>;
// @ts-expect-error annotation tables belong only to the opt-in result
type NoLegacyEvidenceAnnotationTable=LegacyEvidenceTable<'debug_annotation_names'>;
// @ts-expect-error old event results have no annotation property
type NoLegacyEventAnnotations=EventFragment['annotations'];
// @ts-expect-error old packet events have no annotation property
type NoLegacyPacketAnnotations=NonNullable<PacketFragment['event']>['annotations'];
const policy='ordered-manual-browser-frame-annotations-v1';
const packet=(...parts:Uint8Array[])=>join(uint(10,1n),...parts);
const event=(...entries:Uint8Array[])=>body(11,join(...entries.map(e=>body(4,e))));
const name=(value='markName')=>text(10,value);
const value=(value='phase')=>text(6,value);
const intern=(iid=1n,n='markName')=>body(12,body(3,join(uint(1,iid),text(2,n))));
const envelope=(...packets:Uint8Array[])=>({domain:'manual',packets});
function run(input:unknown):any {
 return ordered.projectOrderedBrowserFrameAnnotations(input,policy);
}
function projected(...packets:Uint8Array[]):any {const r=run(envelope(...packets));expect(r.status).toBe('projected_ordered_manual_annotations');return r;}
test('literal markName has an explicit candidate and no boundary authority',()=>{
 const r=projected(packet(uint(13,1n),event(join(name(),value()))));
 expect(r.annotationEvents[0].markName).toEqual({status:'literal_string',value:'phase',annotationIndex:0});
 expect(r.authority).toMatchObject({nativeGO:false,FPS:'unavailable',embeddedOpaqueValidity:'not_evaluated'});
 expect(Object.isFrozen(r.annotationEvents[0])).toBe(true);
});
test('annotation table3 resolves before event independently of packet wire order',()=>{
 for(const parts of [[intern(),event(join(uint(1,1n),value()))],[event(join(uint(1,1n),value())),intern()]]){
 const r=projected(packet(uint(13,1n),...parts));expect(r.annotationEvents[0].markName.status).toBe('literal_string');expect(r.orderedEvidence.internDefinitions[0].table).toBe('debug_annotation_names');}
});
test('all sibling names resolve before selecting supported prefix',()=>{
 const r=projected(packet(uint(13,1n),event(join(name(),value()),join(uint(1,9n),value()))));
 expect(r.annotationEvents[0].markName.status).toBe('withheld');
});
test('literal and IID aliases are duplicate root names',()=>{
 const r=projected(packet(uint(13,1n),intern(),event(join(name(),value()),join(uint(1,1n),value()))));expect(r.annotationEvents[0].markName).toMatchObject({status:'withheld',reason:'duplicate-annotation-name'});
});
test('distinct nested data remains unexamined and cannot impersonate root key',()=>{
 const r=projected(packet(uint(13,1n),event(join(name(),value()),join(name('data'),body(11,join(name(),value('fake')))))));
 expect(r.annotationEvents[0].markName.value).toBe('phase');expect(r.annotationEvents[0].annotations[1].value.kind).toBe('unsupported');
});
for(const extra of [body(11,new Uint8Array()),body(12,new Uint8Array()),text(16,'T'),body(14,new Uint8Array()),uint(100,1n)])test('same markName unsupported direct field withholds '+extra[0],()=>{
 const r=projected(packet(uint(13,1n),event(join(name(),value(),extra))));expect(r.annotationEvents[0].markName.status).toBe('withheld');
});
test('loss invalidates annotation references until reset and new definition',()=>{
 const r=projected(packet(uint(13,1n),intern()),packet(uint(42,1n),event(join(uint(1,1n),value()))),packet(uint(13,1n),intern(),event(join(uint(1,1n),value()))));
 expect(r.annotationEvents.map((e:any)=>e.markName.status)).toEqual(['withheld','literal_string']);
});
for(const layer of ['envelope','array','packet'])for(const mode of ['count','throw','revoked'])test('zero proxy effects '+layer+' '+mode,()=>{
 let calls=0;const trap=()=>{calls++;if(mode==='throw')throw Error('trap');return undefined;};
 const target=layer==='envelope'?envelope():layer==='array'?[]:packet();
 const holder=Proxy.revocable(target,{getPrototypeOf:trap,ownKeys:trap,getOwnPropertyDescriptor:trap,get:trap} as any);if(mode==='revoked')holder.revoke();
 const input=layer==='envelope'?holder.proxy:layer==='array'?{domain:'manual',packets:holder.proxy}:envelope(holder.proxy as Uint8Array);
 expect(()=>run(input)).not.toThrow();expect(calls).toBe(0);expect(run(input).status).toBe('unavailable');
});
test('new API policy is exact and own accessor/coercion hooks never run',()=>{
 const fn=(ordered as any).projectOrderedBrowserFrameAnnotations;expect(fn(envelope(),'other').status).toBe('unavailable');
 let calls=0;const bad={packets:[]};Object.defineProperty(bad,'domain',{get(){calls++;throw Error('getter');}});
 expect(run(bad).status).toBe('unavailable');expect(calls).toBe(0);
 const array:any=[];Object.defineProperty(array,'0',{get(){calls++;throw Error('index');}});expect(run({domain:'manual',packets:array}).status).toBe('unavailable');expect(calls).toBe(0);
});
test('name IID scopes include machine, sequence and table independently',()=>{
 const defs=body(12,join(body(1,join(uint(1,1n),text(2,'category'))),body(2,join(uint(1,1n),text(2,'event'))),body(3,join(uint(1,1n),text(2,'markName')))));
 const r=projected(packet(uint(13,1n),defs),packet(event(join(uint(1,1n),value()))),join(uint(10,2n),uint(13,1n),event(join(uint(1,1n),value()))),packet(uint(98,0n),uint(13,1n),event(join(uint(1,1n),value()))));
 expect(r.orderedEvidence.internDefinitions.map((d:any)=>d.table)).toEqual(['event_categories','event_names','debug_annotation_names']);
 expect(r.annotationEvents.map((e:any)=>e.markName.status)).toEqual(['literal_string','withheld','withheld']);
});
test('missing names and unsupported interned string value cannot become boundaries',()=>{
 for(const entry of [value(),join(name(),uint(17,1n)),join(uint(1,1n),value())])expect(projected(packet(uint(13,1n),event(entry))).annotationEvents[0].markName.status).toBe('withheld');
});
test('future annotation definitions never resolve earlier events',()=>{
 const r=projected(packet(uint(13,1n),event(join(uint(1,1n),value()))),packet(intern()),packet(event(join(uint(1,1n),value()))));expect(r.annotationEvents.map((e:any)=>e.markName.status)).toEqual(['withheld','literal_string']);
});
test('prior identical definitions repeat but conflicts and body duplicates refuse',()=>{
 expect(projected(packet(uint(13,1n),intern()),packet(intern())).orderedEvidence.packets[1].internRepeatedDefinitions).toBe(1);
 for(const packets of [[packet(uint(13,1n),intern()),packet(intern(1n,'different'))],[packet(uint(13,1n),body(12,join(body(3,join(uint(1,1n),text(2,'x'))),body(3,join(uint(1,1n),text(2,'x'))))))]])expect(run(envelope(...packets)).status).toBe('unavailable');
});
for(const entry of [join(name(),name(),value()),join(name(),uint(1,1n),value()),join(name(),value(),uint(3,1n)),join(name(),text(13,'wrong-wire')),join(uint(1,0n),value()),join(text(1,'wrong-wire'),value()),join(body(10,new Uint8Array([255])),value()),join(name(),body(6,new Uint8Array([255])))])test('malformed direct annotation refuses '+Buffer.from(entry).toString('hex'),()=>expect(run(envelope(packet(uint(13,1n),event(entry)))).status).toBe('unavailable'));
test('opaque nested invalid bytes are explicitly unexamined rather than declared valid',()=>{
 const r=projected(packet(uint(13,1n),event(join(name(),value()),join(name('data'),body(11,new Uint8Array([255]))))));
 expect(r.annotationEvents[0].markName.status).toBe('literal_string');expect(r.authority.embeddedOpaqueValidity).toBe('not_evaluated');
});
test('per-string and shared event string capacities exact and one over',()=>{
 expect(projected(packet(event(join(name(),value('x'.repeat(4096)))))).annotationEvents[0].markName.value).toHaveLength(4096);
 expect(run(envelope(packet(event(join(name(),value('x'.repeat(4097))))))).status).toBe('unavailable');
 const entries=Array.from({length:8},()=>join(name('x'),value('a'.repeat(4095))));expect(projected(packet(event(...entries))).annotationEvents).toHaveLength(1);
 entries[7]=join(name('x'),value('a'.repeat(4096)));expect(run(envelope(packet(event(...entries)))).status).toBe('unavailable');
});
test('table3 uses shared live entries and resets release its reservations',()=>{
 const entries=Array.from({length:4096},(_,i)=>body(3,join(uint(1,BigInt(i+1)),text(2,'x'))));
 const full=packet(uint(13,1n),body(12,join(...entries)));
 expect(projected(full).orderedEvidence.internDefinitions).toHaveLength(4096);
 expect(run(envelope(full,packet(intern(4097n)))).diagnostics[0].code).toBe('live-intern-entry-capacity');
 expect(projected(full,packet(uint(13,1n),intern())).orderedEvidence.internDefinitions).toHaveLength(4097);
});
const owned=(name='markName'):AnnotationBody=>({location:{start:0,end:1},name,stringValue:'p',unsupported:false,opaqueLocations:[]});
test('both passes and duplicate key has/add consume shared repeated-work exactly',()=>{
 const b=new Budget();b.repeatedWork(65532,0);expect(resolveAnnotations([owned()],()=>undefined,true,b,0).markName.status).toBe('literal_string');
 const over=new Budget();over.repeatedWork(65533,0);expect(()=>resolveAnnotations([owned()],()=>undefined,true,over,0)).toThrow('repeated-work-capacity');
 const duplicate=new Budget();duplicate.repeatedWork(65529,0);expect(resolveAnnotations([owned(),owned()],()=>undefined,true,duplicate,0).markName.status).toBe('withheld');
 const dOver=new Budget();dOver.repeatedWork(65530,0);expect(()=>resolveAnnotations([owned(),owned()],()=>undefined,true,dOver,0)).toThrow('repeated-work-capacity');
});
test('name IID lookups consume shared reference capacity',()=>{
 const entry:AnnotationBody={...owned(),nameIid:'1'};delete entry.name;
 const lookup=()=>({definitionIndex:0,value:'markName'});const b=new Budget();b.categoryReferences(32767,0);expect(resolveAnnotations([entry],lookup,true,b,0).markName.status).toBe('literal_string');
 const over=new Budget();over.categoryReferences(32768,0);expect(()=>resolveAnnotations([entry],lookup,true,over,0)).toThrow('reference-capacity');
});
test('opaque offset insertion is charged before it can be retained',()=>{
 const bytes=uint(100,1n),b=new Budget();b.repeatedWork(65536,0);const context={bytes,budget:new WireBudget(),occurrences:[],skippedFields:[]};
 expect(()=>decodeAnnotation(context,0,bytes.length,()=>'',n=>b.repeatedWork(n,0))).toThrow('repeated-work-capacity');
});
test('complete output including duplicated candidate string is counted',()=>{
 const one=packet(event(join(name(),value('x'.repeat(4096)))));
 expect(projected(...Array.from({length:50},()=>one)).annotationEvents).toHaveLength(50);
 expect(run(envelope(...Array.from({length:64},()=>one))).diagnostics[0].code).toBe('output-string-capacity');
});
test('legacy ordered policies still skip annotation children without new semantics',()=>{
 const p=packet(uint(13,1n),intern(),event(join(name(),value()))),input=envelope(p);
 const old:any=projectOrderedBrowserFrameState(input,ORDERED_STATE_POLICY);const old2:any=ordered.projectOrderedBrowserFrameEvidence(input,ordered.ORDERED_STATE_V2_POLICY);
 expect(old.status).toBe('projected_ordered_manual_state');expect(old2.status).toBe('projected_ordered_manual_evidence');
 expect(old.internDefinitions).toEqual([]);expect(old2.internDefinitions).toEqual([]);expect(old2).not.toHaveProperty('annotationEvents');
 expect(old.opaqueLocations.some((o:any)=>o.fieldNumber===4)).toBe(true);
});

wholeDescribe('fixed whole-only delegate limits',()=>{
const{decodeWholeAnnotationPacket,decodeBrowserFrameAnnotationPacket}=wholePacket;
const{decodeWholeStateBody,decodeBrowserFrameAnnotationStateBody}=wholeState;
const{decodeWholePayload,decodeBrowserFramePayload,PAYLOAD_POLICY}=wholePayload;
const{decodeWholeDescriptor,decodeBrowserFrameTrackDescriptorBody,TRACK_DESCRIPTOR_BODY_POLICY}=wholeDescriptor;
const{newWholeWireBudget,WireBudget}=wholeWire;
const input=(n:number)=>join(...Array.from({length:n},()=>uint(20000,0n)));
const decoders=[
 ['packet',(b:Uint8Array)=>decodeWholeAnnotationPacket(b,()=>{}),(b:Uint8Array)=>decodeBrowserFrameAnnotationPacket(b,()=>{})],
 ['state',(b:Uint8Array)=>decodeWholeStateBody(b,'interned_names'),(b:Uint8Array)=>decodeBrowserFrameAnnotationStateBody(b)],
 ['payload',(b:Uint8Array)=>decodeWholePayload(b,'reporter2'),(b:Uint8Array)=>decodeBrowserFramePayload(b,'reporter2',PAYLOAD_POLICY)],
 ['descriptor',(b:Uint8Array)=>decodeWholeDescriptor(b),(b:Uint8Array)=>decodeBrowserFrameTrackDescriptorBody(b,TRACK_DESCRIPTOR_BODY_POLICY)],
]as const;
for(const[name,whole,legacy]of decoders){
 test('new fixed '+name+' admits8192 and refuses8193fields while legacy staysunchanged',()=>{
  expect(whole(input(8192)).status).not.toBe('unavailable');
  expect(whole(input(8193))).toMatchObject({status:'unavailable',diagnostics:[{code:'field-capacity'}]});
  expect(legacy(input(8193)).status).not.toBe('unavailable');
 });
}
test('fixed whole member budget4096 refuses before4097 and legacy stays16384',()=>{
 const b=newWholeWireBudget();for(let i=0;i<4096;i++)b.chargeMember();expect(()=>b.chargeMember()).toThrow('member-capacity');
 const old=new WireBudget();for(let i=0;i<16384;i++)old.chargeMember();expect(()=>old.chargeMember()).toThrow('member-capacity');
});
test('typed graphics packed members get the lower fixed whole delegate budget',()=>{
 const packed=body(8,new Uint8Array(4097));
 expect(decodeWholePayload(packed,'graphics')).toMatchObject({status:'unavailable',diagnostics:[{code:'member-capacity'}]});
 expect(decodeBrowserFramePayload(packed,'graphics',PAYLOAD_POLICY).status).not.toBe('unavailable');
 const nested=body(11,body(1052,packed));
 expect(decodeWholeAnnotationPacket(nested,()=>{})).toMatchObject({status:'unavailable',diagnostics:[{code:'member-capacity'}]});
 expect(decodeBrowserFrameAnnotationPacket(nested,()=>{}).status).not.toBe('unavailable');
});
for(const[name,whole]of decoders)for(const mode of['count','throw','revoked'])test('new '+name+' input zero Proxy traps '+mode,()=>{
 let traps=0;const p=Proxy.revocable(new Uint8Array(),{getPrototypeOf(){traps++;if(mode==='throw')throw Error('trap');return Uint8Array.prototype;}});if(mode==='revoked')p.revoke();
 expect(whole(p.proxy)).toMatchObject({status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]});expect(traps).toBe(0);
});
});

wholeDescribe('progressive whole annotation diagnostic',()=>{
const{createWholeAnnotationStudy:create,WHOLE_ANNOTATION_POLICY:policy,finishWholeAnnotationOutput}=ordered;
const fs=wholeFs,os=wholeOs,path=wholePath,createHash=wholeHash,vi=wholeVi;
const packet=(...p:Uint8Array[])=>join(uint(10,1n),...p);
const intern=(name='markName')=>body(12,body(3,join(uint(1,1n),text(2,name))));
const event=(iid=true)=>body(11,body(4,join(iid?uint(1,1n):text(10,'markName'),text(6,'phase'))));
const first=packet(uint(13,1n),intern()),later=packet(event());
function run(...packets:Uint8Array[]):any{const b=join(...packets.map(p=>body(1,p))),s=create(b.length,policy);const step=b.length>4096?65536:7;for(let i=0;i<b.length;i+=step)s.feed(b.slice(i,i+step));return s.finish();}
test('persistent earlier annotation name resolves later packet',()=>{expect(run(first,later)).toMatchObject({status:'whole-annotation-study',candidates:[{kind:'literal_string',value:'phase',sequenceId:'1'}]});});
test('persistent defaults retain source before later event',()=>{expect(run(packet(uint(13,1n),body(59,uint(58,3n))),packet(event(false))).candidates[0]).toMatchObject({clockId:'3',clockSource:'defaults'});});
test('cross-packet conflict refuses all prior publication',()=>{expect(run(first,later,packet(intern('other')))).toMatchObject({status:'unavailable',reason:'intern-conflict',candidates:[]});});
test('malformed tail withdraws all prior candidates',()=>{expect(run(first,later,Uint8Array.of(128))).toMatchObject({status:'unavailable',candidates:[]});});
test('sequence-less no relevant state is diagnostic opaque',()=>{expect(run(uint(20000,1n))).toMatchObject({status:'whole-annotation-study',counters:{opaqueNoStatePackets:1}});});
test('unknown sibling name withholds even no literal mark known',()=>{expect(run(packet(uint(13,1n),body(11,body(4,join(uint(1,99n),text(6,'x'))))))).toMatchObject({status:'whole-annotation-study',markInventoryAdmission:'withheld',candidates:[{kind:'withheld'}]});});
test('same packet definitions precede event despite wire order',()=>{expect(run(packet(uint(13,1n),event(),intern())).candidates[0]).toMatchObject({kind:'literal_string',value:'phase'});});
test('later packet definition never backfills prior unresolved root',()=>{const r=run(packet(uint(13,1n),event()),packet(intern()));expect(r.markInventoryAdmission).toBe('withheld');expect(r.candidates[0].kind).toBe('withheld');});
test('reset wins simultaneous drop and permits same packet definitions',()=>{expect(run(packet(uint(13,1n),uint(42,1n),intern(),event())).candidates[0].kind).toBe('literal_string');});
test('loss retains definitions but invalidates annotation lookup',()=>{expect(run(first,packet(uint(42,1n),event()))).toMatchObject({markInventoryAdmission:'withheld',candidates:[{kind:'withheld'}],counters:{losses:1}});});
test('explicit clock selection wins invalid fallback after loss',()=>{expect(run(packet(uint(13,1n),body(59,uint(58,3n))),packet(uint(42,1n),uint(58,4n),event(false))).candidates[0]).toMatchObject({clockId:'4',clockSource:'packet'});});
test('raw machine, sequence and timestamp remain unqualified',()=>{expect(run(packet(uint(13,1n),uint(98,7n),uint(8,9007199254740993n),event(false))).candidates[0]).toMatchObject({machineStatus:'present',machineId:'7',sequenceId:'1',rawTimestamp:'9007199254740993',timestampStatus:'raw-unqualified'});});
test('sequence-less relevant state refuses instead of opaque no-op',()=>{expect(run(intern())).toMatchObject({status:'unavailable',reason:'missing-sequence-id',candidates:[]});});
test('unsupported payload is not a sequence-less no-op',()=>{expect(run(body(50,new Uint8Array())).status).toBe('unavailable');});
test('duplicate resolved root names withhold complete inventory',()=>{expect(run(packet(uint(13,1n),body(11,join(body(4,join(text(10,'markName'),text(6,'a'))),body(4,join(text(10,'markName'),text(6,'b')))))))).toMatchObject({markInventoryAdmission:'withheld',candidates:[{kind:'withheld',reason:'duplicate-annotation-name'}]});});
for(const kind of['counting','throwing','revoked'])test('whole feed Proxy '+kind+' invokes no traps',()=>{let traps=0;const p=Proxy.revocable(new Uint8Array(),{getPrototypeOf(){traps++;if(kind==='throwing')throw Error();return Uint8Array.prototype;}});if(kind==='revoked')p.revoke();const s=create(0,policy);s.feed(p.proxy);expect(s.finish()).toMatchObject({status:'unavailable',reason:'unsupported-byte-view',candidates:[]});expect(traps).toBe(0);});
test('chunk cap refusal precedes large body copy',()=>{const s=create(65537,policy);s.feed(new Uint8Array(65537));expect(s.finish()).toMatchObject({status:'unavailable',reason:'chunk-capacity',candidates:[]});});
test('finished handle never accepts more bytes or second finish',()=>{const s=create(0,policy);expect(s.finish()).toMatchObject({status:'whole-annotation-study',physicalEOF:false,structuralContainerEOF:false});expect(()=>s.feed(new Uint8Array())).toThrow('stream-closed');expect(()=>s.finish()).toThrow('stream-closed');});
test('candidate cap refuses all publication at129',()=>{expect(run(first,...Array.from({length:129},()=>later))).toMatchObject({status:'unavailable',reason:'candidate-capacity',candidates:[]});});
function withFile(fn:(ref:{path:string;bytes:number;sha256:string})=>void){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synthetic-whole-annotations-')),p=path.join(dir,'synthetic.bin'),b=join(body(1,first),body(1,later));fs.writeFileSync(p,b,{flag:'wx'});try{fn({path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true});}}
test('owned synthetic file joins separate EOF and persisted hash',()=>withFile(ref=>{expect(readWholeAnnotationTrace(ref,policy)).toMatchObject({status:'complete-whole-annotation-diagnostic',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true},study:{candidates:[{kind:'literal_string',value:'phase'}],physicalEOF:false}});}));
test('wrong persisted hash withdraws otherwise positive inner candidates',()=>withFile(ref=>{expect(readWholeAnnotationTrace({...ref,sha256:'0'.repeat(64)},policy)).toMatchObject({status:'unavailable',fullInputVerified:false,reason:'reader-hash',study:{status:'unavailable',candidates:[]}});}));
test('reader exception withdraws inner positive prefix',()=>withFile(ref=>{vi.spyOn(fs,'readSync').mockImplementation(()=>{throw Error('synthetic');});expect(readWholeAnnotationTrace(ref,policy)).toMatchObject({status:'unavailable',reason:'reader-failure',study:{candidates:[]}});}));
test('close error withdraws positive complete inner study',()=>withFile(ref=>{const close=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('synthetic');});expect(readWholeAnnotationTrace(ref,policy)).toMatchObject({status:'unavailable',reason:'reader-close',study:{candidates:[]}});}));
test('reader reference Proxy is denied without traps',()=>{let traps=0;const ref=new Proxy({},{getPrototypeOf(){traps++;throw Error();}});expect(readWholeAnnotationTrace(ref,policy)).toMatchObject({status:'unavailable',reason:'invalid-reference',authority:{nativeGO:false}});expect(traps).toBe(0);});
test('whole output UTF8/key reservation refuses maximal candidate combination without prefix',()=>{const event=body(11,join(uint(11,18446744073709551615n),body(4,join(text(10,'markName'),text(6,'\\'.repeat(128)))))),p=join(uint(10,4294967295n),uint(98,4294967295n),uint(58,4294967295n),uint(8,18446744073709551615n),event),r=run(...Array.from({length:128},()=>p));expect(r).toMatchObject({status:'unavailable',reason:'result-capacity',candidates:[],budgets:{candidateRows:128,candidateUTF8:16384}});expect(Buffer.byteLength(JSON.stringify(r)+'\n')).toBeLessThanOrEqual(262144);});
test('whole serializer rejects escaped string capacity before allocation',()=>{expect(()=>finishWholeAnnotationOutput({value:'\0'.repeat(50000)})).toThrow('result-capacity');});
test('whole serializer rejects unsafe numeric slots',()=>{expect(()=>finishWholeAnnotationOutput({value:33554433})).toThrow('result-shape');expect(()=>finishWholeAnnotationOutput({value:NaN})).toThrow('result-shape');});
test('whole serializer rejects accessors and Proxy without invocation',()=>{let calls=0;expect(()=>finishWholeAnnotationOutput({get value(){calls++;return 1;}})).toThrow('result-shape');const p=new Proxy({},{getPrototypeOf(){calls++;throw Error();}});expect(()=>finishWholeAnnotationOutput(p)).toThrow('result-shape');expect(calls).toBe(0);});
test('whole serializer exact65k UTF8 and one-over are separately refused',()=>{expect(finishWholeAnnotationOutput('a'.repeat(65536)).length).toBe(65536);expect(()=>finishWholeAnnotationOutput('a'.repeat(65537))).toThrow('result-capacity');});
test('transition digest distinguishes identical counts but changed supported outcome',()=>{const make=(value:string)=>run(packet(uint(13,1n),body(11,body(4,join(text(10,'markName'),text(6,value)))))),a=make('a'),b=make('b');expect(a.counters).toEqual(b.counters);expect(a.transitionManifestSHA256).not.toBe(b.transitionManifestSHA256);expect(a.candidates[0].value).toBe('a');expect(b.candidates[0].value).toBe('b');});
test('nonrenewable history string pool survives live reset release',()=>{const p=packet(uint(13,1n),intern('x'.repeat(4096))),r=run(...Array.from({length:65},()=>p));expect(r).toMatchObject({status:'unavailable',reason:'persistent-string-capacity',candidates:[]});expect(r.budgets.liveEntries).toBeLessThanOrEqual(1);expect(r.budgets.persistentUTF8).toBeLessThanOrEqual(262144);});
test('default version cap is separate from live selection pointer',()=>{const p=packet(body(59,uint(58,3n))),r=run(packet(uint(13,1n)),...Array.from({length:1025},()=>p));expect(r).toMatchObject({status:'unavailable',reason:'defaults-capacity',candidates:[],budgets:{defaultsVersions:1024}});});
test('candidate aggregate UTF8 exact boundary and one-over',()=>{const e=(n:number)=>packet(body(11,body(4,join(text(10,'markName'),text(6,'x'.repeat(n)))))),r=run(packet(uint(13,1n)),...Array.from({length:4},()=>e(4096)));expect(r).toMatchObject({status:'whole-annotation-study',budgets:{candidateUTF8:16384}});expect(run(packet(uint(13,1n)),...Array.from({length:4},()=>e(4096)),e(1))).toMatchObject({status:'unavailable',reason:'candidate-string-capacity',candidates:[]});});
test('actual source DTO keys are closed separately from generic JSON guard',()=>{const r=run(first,later);expect(Object.keys(r)).toEqual(['policy','status','reason','inputRef','framingBoundaryComplete','physicalEOF','structuralContainerEOF','semanticProcessing','markInventoryAdmission','counters','budgets','packetManifestSHA256','transitionManifestSHA256','anchors','candidates','diagnostics','authority']);expect(Object.keys(r.candidates[0])).toEqual(['packetIndex','sequenceIndex','intervalVersion','eventStart','eventValueStart','eventEnd','bodySHA256','kind','value','reason','annotationIndex','nameSource','definitionIndex','clockId','clockSource','trackUuid','trackSource','machineStatus','machineId','sequenceId','rawTimestamp','timestampStatus']);expect(finishWholeAnnotationOutput({foo:'bar'})).toEqual({foo:'bar'});expect(readWholeAnnotationTrace({foo:'bar'},policy).status).toBe('unavailable');});
test('transition record includes independently reconstructed semantic digest and exact context',()=>{const value='a',p=packet(uint(13,1n),body(11,body(4,join(text(10,'markName'),text(6,value))))),r=run(p),semantic=createHash('sha256').update('whole-supported-packet-semantics-v1\n');const note=(label:string,values:readonly(string|number|boolean|null)[])=>{semantic.update(label+'\n','ascii');for(const v of values){if(typeof v==='string')semantic.update('s'+Buffer.byteLength(v)+':','ascii').update(v,'utf8');else semantic.update(v===null?'n;':typeof v==='boolean'?v?'t;':'f;':'i'+v+';','ascii');}semantic.update('\n','ascii');};note('packet',[null,'1',null,null,'1',null,null,null]);note('root',['literal','markName',null,null,'literal_string','a',null]);note('mark',['resolved','literal_string','a']);note('event',[null,null,null,'resolved','unavailable','no_explicit_or_valid_default_track',null,null,'unavailable','no_explicit_or_valid_default_clock',null,null,null,true]);const record=`0,0,1,R,-,0,0,R,1,0,${semantic.digest('hex')},${createHash('sha256').update(p).digest('hex')}\n`;expect(r.transitionManifestSHA256).toBe(createHash('sha256').update('whole-annotation-transitions-v1\n').update(record,'ascii').digest('hex'));});
});

wholeDescribe('supported semantic selection digest',()=>{test('same counters retain different selected track provenance',()=>{const go=(id:bigint)=>{const p=join(uint(10,1n),uint(13,1n),body(11,join(uint(11,id),body(4,join(text(10,'markName'),text(6,'phase')))))),b=body(1,p),s=ordered.createWholeAnnotationStudy(b.length,ordered.WHOLE_ANNOTATION_POLICY);s.feed(b);return s.finish();},a=go(1n),b=go(2n);expect(a.counters).toEqual(b.counters);expect(a.transitionManifestSHA256).not.toBe(b.transitionManifestSHA256);expect(a.candidates[0]?.trackUuid).toBe('1');expect(b.candidates[0]?.trackUuid).toBe('2');});});

wholeDescribe('sequence-less metadata state boundary',()=>{for(const field of[13,41,42,87])test('clock metadata does not authorize unscoped state field'+field,()=>{const p=join(uint(field,0n),body(6,new Uint8Array())),b=body(1,p),s=ordered.createWholeAnnotationStudy(b.length,ordered.WHOLE_ANNOTATION_POLICY);s.feed(b);expect(s.finish()).toMatchObject({status:'unavailable',reason:'missing-sequence-id',candidates:[]});});test('generic JSON guard refuses sparse arrays with named replacement',()=>{const a=new Array(1);(a as unknown as {foo:number}).foo=1;expect(()=>ordered.finishWholeAnnotationOutput(a)).toThrow('result-shape');});});
wholeDescribe('whole32MiB profile across owned chunks',()=>{
 const frame=(prefix:Uint8Array)=>body(1,join(prefix,body(20000,new Uint8Array(262140-prefix.length-6))));
 const initial=join(uint(10,1n),uint(13,1n),body(12,body(3,join(uint(1,1n),text(2,'markName'))))),mark=join(uint(10,1n),body(11,body(4,join(uint(1,1n),text(6,'phase'))))),conflict=join(uint(10,1n),body(12,body(3,join(uint(1,1n),text(2,'other')))));
 for(const failure of[false,true,'growth']as const)test(failure==='growth'?'terminal observed byte32MiB+1 is preserved in unavailable reader DTO':failure?'semantic failure still hashes complete32MiB tail and withdraws prefix':'owned32MiB keeps prior intern across128frames/513reads',()=>{
  const dir=wholeFs.mkdtempSync(wholePath.join(wholeOs.tmpdir(),'synthetic-whole32m-')),p=wholePath.join(dir,'synthetic.bin'),fd=wholeFs.openSync(p,'wx'),h=wholeHash('sha256');let bytes=0;
  try{const opaque=frame(new Uint8Array());for(let i=0;i<128;i++){const b=i===0?frame(failure===true?join(initial,body(11,body(4,join(uint(1,1n),text(6,'phase'))))):initial):failure===true&&i===1?frame(conflict):failure!==true&&i===127?frame(mark):opaque;expect(b.byteLength).toBe(262144);expect(wholeFs.writeSync(fd,b)).toBe(b.length);h.update(b);bytes+=b.length;}}finally{wholeFs.closeSync(fd);}
  try{const sha256=h.digest('hex');expect(bytes).toBe(33554432);if(failure==='growth'){const native=wholeFs.readSync;wholeVi.spyOn(wholeFs,'readSync').mockImplementation((...args:any[])=>{if(args[3]===1){(args[1]as Uint8Array)[args[2]]=0;return 1;}return(native as(...args:any[])=>number)(...args);});const r=readWholeAnnotationTrace({path:p,bytes,sha256},ordered.WHOLE_ANNOTATION_POLICY);expect(r).toMatchObject({status:'unavailable',reason:'reader-growth',fullInputVerified:false,structuralContainerEOF:false,reader:{bytes:33554433,EOF:false,closed:true},study:{candidates:[]}});return;}const r=readWholeAnnotationTrace({path:p,bytes,sha256},ordered.WHOLE_ANNOTATION_POLICY);expect(r).toMatchObject({fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,reads:513,bytes:33554432,sha256},study:{inputRef:{bytes:33554432,sha256},counters:{packets:128}}});if(failure)expect(r).toMatchObject({status:'unavailable',reason:'intern-conflict',study:{candidates:[],counters:{processedPackets:1,decodedPackets:2}}});else expect(r).toMatchObject({status:'complete-whole-annotation-diagnostic',study:{candidates:[{packetIndex:127,kind:'literal_string',value:'phase'}],counters:{processedPackets:128,opaqueNoStatePackets:126}}});}finally{wholeVi.restoreAllMocks();wholeFs.rmSync(dir,{recursive:true});}
 });
});

wholeDescribe('exact terminal reader diagnostic number domain',()=>{test('only root.reader.bytes accepts32MiB+1',()=>{expect(ordered.finishWholeAnnotationOutput({reader:{bytes:33554433}})).toEqual({reader:{bytes:33554433}});for(const value of[{bytes:33554433},{reader:{other:33554433}},{nested:{reader:{bytes:33554433}}},{reader:{bytes:33554434}}])expect(()=>ordered.finishWholeAnnotationOutput(value)).toThrow('result-shape');});});
