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
