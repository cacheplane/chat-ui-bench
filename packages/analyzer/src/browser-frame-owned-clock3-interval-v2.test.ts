import {expect,test,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as interval from './browser-frame-owned-clock3-interval-v2.js';
import {readWholeUserTimingTraceV8} from './browser-frame-whole-trace-reader.js';
import {WHOLE_USER_TIMING_V8_POLICY} from './browser-frame-ordered-state.js';
import {readOwnedPaintTraceV12} from './browser-frame-owned-paint-v12-reader.js';
import {OWNED_PAINT_V12_POLICY} from './browser-frame-owned-paint-v12.js';
import {readOwnedClock3IntervalV1} from './browser-frame-owned-clock3-interval-v1.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';
const POLICY='owned-clock3-interval-diagnostic-v2';
const packet=(seq:bigint,...extra:Uint8Array[])=>join(uint(10,seq),...extra);
const stream=(...packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const clock=(id=3n,...extra:Uint8Array[])=>body(1,join(uint(1,id),uint(2,0n),...extra));
const snapshot=(...clocks:Uint8Array[])=>body(6,join(...clocks));
const defaults=(id=64n,track=100n)=>body(59,join(uint(58,id),body(11,uint(11,track))));
const child=(parent=200n,pid=20n,tid=21n,...extra:Uint8Array[])=>body(60,join(uint(1,100n),uint(5,parent),body(4,join(uint(1,pid),uint(2,tid))),...extra));
const parent=(pid=20n,generation=999999999999999999n,...extra:Uint8Array[])=>body(60,join(uint(1,200n),body(3,join(uint(1,pid),uint(7,generation))),...extra));
const event=(name:string,type=3n,...extra:Uint8Array[])=>body(11,join(uint(9,type),text(22,'blink.user_timing'),text(23,name),...extra));
const mark=(name='start',time=9007199254740993n,seq=7n,...extra:Uint8Array[])=>packet(seq,uint(8,time),uint(58,3n),event(name),...extra);
function fixture(){return [packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),defaults()),packet(7n,child()),packet(8n,parent()),snapshot(clock(),clock(64n,uint(3,1n),uint(4,1000n)),clock(65n,uint(3,0n),uint(4,1000n))),mark(),mark('end',9007199254741010n)];}
function owned(b:Uint8Array,run:(ref:{path:string;bytes:number;sha256:string},file:string)=>void){const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'owned-clock3-interval-')),file=path.join(dir,'authored.bin');fs.writeFileSync(file,b);try{run({path:file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')},file);}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}}
function read(ref:unknown,names:unknown='["start","end"]',policy:unknown=POLICY){return interval.readOwnedClock3IntervalV2(typeof ref==='string'?ref:JSON.stringify(ref),names,policy);}
test('complete owned authored bytes yield only an exact clock3 diagnostic and bounded two-mark witness',()=>{
 owned(stream(...fixture()),ref=>{const open=vi.spyOn(fs,'openSync'),r=read(ref);expect(open).toHaveBeenCalledTimes(1);expect(r).toMatchObject({policy:POLICY,status:'owned-clock3-interval-diagnostic',reason:null,traceIntervalNs:'17',durationNs:null,inputOrigin:'not_authenticated',authority:{clockAdmission:'not_evaluated',evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'},witness:{input:{bytes:ref.bytes,sha256:ref.sha256},rawDropCounts:{nonzeroDeclarations:1,explainedDeclarations:1,unexplainedDeclarations:0,contradictoryDeclarations:0},semanticSequenceStartCounts:{raw:0,explained:0,unexplained:0,contradictions:0},domain:{clockId:'3',machineStatus:'absent',sequenceId:'7',trackUuid:'100'},identity:{parentUuid:'200',pid:'20',tid:'21',processStartGeneration:'999999999999999999'}}});
 expect(r.witness?.anchors).toHaveLength(2);expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.witness?.anchors)).toBe(true);expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(16384);
 const v8=readWholeUserTimingTraceV8(ref,WHOLE_USER_TIMING_V8_POLICY);expect(v8.study).toMatchObject({physicalEOF:false,structuralContainerEOF:false});
 });
});
test('uint64 arithmetic stays exact and repeated identity disclosures and unordered snapshots are allowed',()=>{const p=fixture();p[3]=snapshot(body(1,join(uint(1,3n),uint(2,100n))));p[4]=mark('start',18446744073709551600n);p[5]=mark('end',18446744073709551615n);owned(stream(...p,packet(9n,parent()),snapshot(body(1,join(uint(1,3n),uint(2,1n))))),ref=>expect(read(ref).traceIntervalNs).toBe('15'));});
function rejected(b:Uint8Array,reason?:string){owned(b,ref=>{const r=read(ref);expect(r).toMatchObject({status:'unavailable',traceIntervalNs:null,witness:null,durationNs:null,...(reason?{reason}:{})});expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(16384);});}
test.each([
 ['missing start',(p:Uint8Array[])=>p.splice(4,1)],
 ['duplicate start',(p:Uint8Array[])=>p.push(mark())],
 ['duplicate other namespace',(p:Uint8Array[])=>p.push(mark('start',1n,7n,uint(98,0n),defaults()))],
 ['duplicate other sequence',(p:Uint8Array[])=>p.push(mark('start',1n,9n,defaults()))],
 ['missing timestamp',(p:Uint8Array[])=>p[4]=packet(7n,uint(58,3n),event('start'))],
 ['missing type',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,3n),body(11,join(text(22,'blink.user_timing'),text(23,'start'))))],
 ['wrong type',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,3n),event('start',1n))],
 ['missing explicit clock',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),event('start'))],
 ['default3 still not explicit',(p:Uint8Array[])=>{p[0]=packet(7n,uint(13,1n),defaults(3n));p[4]=packet(7n,uint(8,1n),event('start'));}],
 ['non3 clock',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,6n),event('start'))],
 ['zero clock',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,0n),event('start'))],
 ['machine presence',(p:Uint8Array[])=>p[4]=mark('start',1n,7n,uint(98,0n),defaults())],
 ['both present machine',(p:Uint8Array[])=>{p[4]=mark('start',1n,7n,uint(98,0n),defaults());p[5]=mark('end',2n,7n,uint(98,0n));}],
 ['different sequence',(p:Uint8Array[])=>p[5]=mark('end',2n,9n,defaults())],
 ['reset between marks',(p:Uint8Array[])=>p.splice(5,0,packet(7n,uint(13,1n),defaults()))],
 ['different track',(p:Uint8Array[])=>p[5]=packet(7n,uint(8,9007199254741010n),uint(58,3n),event('end',3n,uint(11,101n)))],
 ['zero track',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,3n),event('start',3n,uint(11,0n)))],
 ['no snapshot',(p:Uint8Array[])=>p.splice(3,1)],
 ['no clock3',(p:Uint8Array[])=>p[3]=snapshot(clock(6n))],
 ['snapshot namespace mismatch',(p:Uint8Array[])=>p[3]=join(uint(98,0n),snapshot(clock()))],
 ['clock3 missing timestamp',(p:Uint8Array[])=>p[3]=snapshot(body(1,uint(1,3n)))],
 ['missing child',(p:Uint8Array[])=>p.splice(1,1)],
 ['child disclosed too late',(p:Uint8Array[])=>{const c=p.splice(1,1)[0]!;p.push(c);}],
 ['child wrong sequence',(p:Uint8Array[])=>p[1]=packet(9n,child())],
 ['child wrong namespace',(p:Uint8Array[])=>p[1]=packet(7n,uint(98,0n),child())],
 ['parent missing',(p:Uint8Array[])=>p.splice(2,1)],
 ['parent missing generation',(p:Uint8Array[])=>p[2]=packet(8n,body(60,join(uint(1,200n),body(3,uint(1,20n)))))],
 ['parent wrong pid',(p:Uint8Array[])=>p[2]=packet(8n,parent(22n))],
 ['parent wrong namespace',(p:Uint8Array[])=>p[2]=packet(8n,uint(98,0n),parent())],
 ['child ambiguous',(p:Uint8Array[])=>p[1]=packet(7n,child(200n,20n,21n,body(3,uint(1,20n))))],
 ['parent ambiguous',(p:Uint8Array[])=>p[2]=packet(8n,parent(20n,1n,body(4,uint(1,20n))))],
 ['parent zero',(p:Uint8Array[])=>p[1]=packet(7n,child(0n))],
 ['later child pid conflict',(p:Uint8Array[])=>p.push(packet(7n,child(200n,22n)))],
 ['later child tid conflict',(p:Uint8Array[])=>p.push(packet(7n,child(200n,20n,22n)))],
 ['later child parent conflict',(p:Uint8Array[])=>p.push(packet(7n,child(201n)))],
 ['later child missing identity',(p:Uint8Array[])=>p.push(packet(7n,body(60,uint(1,100n))))],
 ['later parent generation reuse',(p:Uint8Array[])=>p.push(packet(8n,parent(20n,1n)))],
 ['earlier parent generation reuse',(p:Uint8Array[])=>p.unshift(packet(8n,parent(20n,1n)))],
 ['later parent missing identity',(p:Uint8Array[])=>p.push(packet(8n,body(60,uint(1,200n))))],
 ['zero difference',(p:Uint8Array[])=>p[5]=mark('end')],
 ['reverse time',(p:Uint8Array[])=>p[5]=mark('end',1n)],
 ['name order',(p:Uint8Array[])=>[p[4],p[5]]=[p[5]!,p[4]!]],
 ['unknown raw bits',(p:Uint8Array[])=>p.push(packet(9n,uint(13,1n),uint(87,1n),uint(42,3n)))],
 ['raw missing first',(p:Uint8Array[])=>p.push(packet(9n,uint(13,1n),uint(42,1n)))],
 ['repeated first',(p:Uint8Array[])=>p.push(packet(7n,uint(13,1n),uint(87,1n),uint(42,1n)))],
] as const)('rejects %s globally and leaves no partial witness',(_name,mutate)=>{const p=fixture();mutate(p);rejected(stream(...p));});
test.each([uint(4,1n),uint(4,1000n),uint(3,0n),uint(3,1n)])('every clock3 unit/incremental declaration fails before and after marks',declaration=>{for(const late of [false,true]){const p=fixture(),s=snapshot(clock(3n,declaration));if(late)p.push(s);else p[3]=s;rejected(stream(...p),'clock3-profile-unavailable');}});
test.each([uint(13,1n),uint(41,1n)])('late clear plus drop outside pair cannot use the old semantic ledger',clear=>{const p=fixture();p.push(packet(8n,clear,uint(42,1n)));owned(stream(...p),ref=>{const v8=readWholeUserTimingTraceV8(ref,WHOLE_USER_TIMING_V8_POLICY);expect(v8.status).toBe('complete-whole-annotation-diagnostic');expect(v8.study?.sequenceStart).toMatchObject({unexplained:0});expect(v8.study?.rawDropInventory).toMatchObject({unexplainedDeclarations:1});expect(read(ref)).toMatchObject({status:'unavailable',reason:'unexplained-raw-drop',witness:null,traceIntervalNs:null});});});
test('unrelated resolved names and defaults updates with explicit clock3 are supported',()=>{const p=fixture();p.splice(5,0,packet(7n,defaults(65n)),mark('unrelated'));owned(stream(...p),ref=>expect(read(ref).status).toBe('owned-clock3-interval-diagnostic'));});
test.each([1,2,6,8,16,17,20])('legacy event field %i is refused even outside chosen marks',field=>{for(const wire of [uint(field,0n),join(uint(field,0n),uint(field,0n)),body(field,new Uint8Array())]){rejected(stream(...fixture(),packet(7n,event('unrelated',3n,wire))));const p=fixture();p[4]=packet(7n,uint(8,1n),uint(58,3n),event('start',3n,wire));rejected(stream(...p));}});
test('strict primitive canonical names fail before any I/O or caller reflection',()=>{let calls=0;const proxy=new Proxy({},{get(){calls++;throw Error();},ownKeys(){calls++;throw Error();}});const open=vi.spyOn(fs,'openSync');for(const names of [proxy,new String('["start","end"]'),['start','end'],' ["start","end"]','["start", "end"]','["x","x"]','["","end"]','["start"]',JSON.stringify(['x'.repeat(257),'end']),JSON.stringify(['😀'.repeat(65),'end']),JSON.stringify(['\ud800','end']),JSON.stringify(['start\u0085','end'])])expect(interval.readOwnedClock3IntervalV2(proxy,names,POLICY)).toMatchObject({reason:'invalid-mark-names',witness:null,traceIntervalNs:null});expect(calls).toBe(0);expect(open).not.toHaveBeenCalled();vi.restoreAllMocks();});
test('wrong policy and forged reader JSON cannot become interval inputs',()=>{expect(read({},'["start","end"]',{})).toMatchObject({reason:'unsupported-policy',witness:null});expect(read({policy:WHOLE_USER_TIMING_V8_POLICY,status:'complete-whole-annotation-diagnostic'})).toMatchObject({status:'unavailable',witness:null});});
test.each(['hash','bytes','symlink','hardlink','identity','read','close','EOF'] as const)('owned %s failure never exposes partial interval',mode=>{owned(stream(...fixture()),(ref,file)=>{if(mode==='hash')ref.sha256='0'.repeat(64);if(mode==='bytes')ref.bytes--;if(mode==='symlink'){const real=file+'.real';fs.renameSync(file,real);fs.symlinkSync(real,file);}if(mode==='hardlink')fs.linkSync(file,file+'.link');if(mode==='identity'){const orig=fs.fstatSync;let n=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=orig(...args);if(++n===2&&typeof s.ctimeNs==='bigint')s.ctimeNs++;return s;});}if(mode==='read'){const orig=fs.readSync;let n=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(++n===2)throw Error();return orig(...args);});}if(mode==='close'){const orig=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{orig(fd);throw Error();});}if(mode==='EOF'){const orig=fs.readSync;let n=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>++n===2?1:orig(...args));}expect(read(ref)).toMatchObject({status:'unavailable',traceIntervalNs:null,witness:null});});});
test('malformed uint64 and truncated root tails withdraw all earlier success',()=>{rejected(join(stream(...fixture()),Uint8Array.of(10,2,0)));const p=fixture();p[5]=packet(7n,uint(58,3n),event('end'),Uint8Array.of(64,128));rejected(stream(...p));});
test.each([
 ['wrong category',(p:Uint8Array[])=>p[4]=packet(7n,uint(8,1n),uint(58,3n),body(11,join(uint(9,3n),text(22,'other'),text(23,'start'))))],
 ['withheld unrelated inventory',(p:Uint8Array[])=>p.push(packet(7n,uint(8,1n),uint(58,3n),body(11,join(uint(9,3n),uint(3,99n),text(23,'other')))))],
 ['unresolved track',(p:Uint8Array[])=>p[0]=packet(7n,uint(13,1n))],
 ['zero sequence',(p:Uint8Array[])=>p[5]=mark('end',2n,0n,defaults())],
 ['missing sequence',(p:Uint8Array[])=>p[5]=join(uint(8,2n),uint(58,3n),event('end'))],
 ['missing child pid',(p:Uint8Array[])=>p[1]=packet(7n,body(60,join(uint(1,100n),uint(5,200n),body(4,uint(2,21n)))))],
 ['missing child tid',(p:Uint8Array[])=>p[1]=packet(7n,body(60,join(uint(1,100n),uint(5,200n),body(4,uint(1,20n)))))],
 ['duplicate scalar',(p:Uint8Array[])=>p[5]=join(mark('end',2n),uint(8,3n))],
 ['uint64 overflow',(p:Uint8Array[])=>p[5]=packet(7n,Uint8Array.of(64,128,128,128,128,128,128,128,128,128,2),uint(58,3n),event('end'))],
] as const)('rejects %s through the genuine decoder chain',(_name,mutate)=>{const p=fixture();mutate(p);rejected(stream(...p));});
test('reference getters and proxies never execute or echo paths',()=>{let calls=0;const proxy=new Proxy({},{get(){calls++;throw Error();},getPrototypeOf(){calls++;throw Error();}});expect(interval.readOwnedClock3IntervalV2(proxy,'["start","end"]',POLICY)).toMatchObject({status:'unavailable',witness:null});expect(calls).toBe(0);});

test('more than 128 actual metadata observations succeed with all five manifests and deeply frozen witness',()=>{const p=fixture();for(let i=0;i<140;i++)p.push(packet(8n,parent()));owned(stream(...p),ref=>{const v12=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY);expect(v12.study?.evidence.occurrences.length).toBe(143);const r=read(ref);expect(r).toMatchObject({status:'owned-clock3-interval-diagnostic',traceIntervalNs:'17',witness:{examined:{descriptors:142,matchingParentDescriptors:141},manifests:v12.study?.manifests}});function frozen(v:unknown){if(v&&typeof v==='object'){expect(Object.isFrozen(v)).toBe(true);for(const c of Object.values(v))frozen(c);}}frozen(r);});});
test('parent own-parent null is stable but late absent/present or value conflicts refuse',()=>{for(const extra of [uint(5,300n),uint(5,301n)])rejected(stream(...fixture(),packet(8n,parent(20n,999999999999999999n,extra))),'descriptor-identity-unavailable');const p=fixture();p[2]=packet(8n,parent(20n,999999999999999999n,uint(5,300n)));rejected(stream(...p,packet(8n,parent())),'descriptor-identity-unavailable');owned(stream(...p,packet(8n,parent(20n,999999999999999999n,uint(5,300n)))),ref=>expect(read(ref).traceIntervalNs).toBe('17'));});
test('same thread identity after reset, reordered descriptor scalars and late consistent parent are accepted',()=>{const p=fixture();p.push(packet(7n,uint(13,1n),child()),packet(8n,body(60,join(body(3,join(uint(7,999999999999999999n),uint(1,20n))),uint(1,200n)))));owned(stream(...p),ref=>expect(read(ref).traceIntervalNs).toBe('17'));});
test('repeated layouts consume every timestamp including irrelevant and namespaced children',()=>{const p=fixture();p[3]=snapshot(body(1,join(uint(2,999n),uint(1,64n),uint(3,1n))),body(1,join(uint(2,1n),uint(1,3n))));p.push(snapshot(body(1,join(uint(2,2n),uint(1,64n),uint(3,1n))),body(1,join(uint(2,88n),uint(1,3n)))),join(uint(98,0n),snapshot(clock(3n,uint(3,1n),uint(4,1000n)))));owned(stream(...p),ref=>expect(read(ref)).toMatchObject({traceIntervalNs:'17',witness:{examined:{snapshots:3,clockEntries:5,relevantClock3Entries:2}}}));});
test('actual reader metadata and candidate capacity failures withdraw interval atomically',()=>{rejected(stream(...fixture(),...Array.from({length:257},()=>mark('unrelated'))));rejected(stream(...fixture(),...Array.from({length:4097},()=>snapshot(clock()))));});
test('independent projection work exhaustion retains a frozen bounded failure closure',()=>{
 const p=fixture();for(let i=0;i<6000;i++)p.push(packet(8n,parent()));
 owned(stream(...p),ref=>{
  const genuine=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY);
  expect(genuine.status).toBe('complete-owned-whole-diagnostic');
  const r=read(ref);expect(r).toMatchObject({reason:'projection-capacity',witness:null,traceIntervalNs:null});
  expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(r.authority)).toBe(true);
 });
});
test('owned codec2 timestamp markers have exact authored arity and source witness correspondence',()=>{
 const p=fixture();p[3]=snapshot(body(1,join(uint(1,64n),uint(2,501n))),body(1,join(uint(2,77n),uint(1,3n))));
 p.push(snapshot(body(1,join(uint(1,64n),uint(2,502n))),body(1,join(uint(2,11n),uint(1,3n)))));
 owned(stream(...p),ref=>{
  const s=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY).study!;
  const clocks=s.evidence.occurrences.filter(o=>s.evidence.facts[o[0]]!.kind==='clock_snapshot_layout');
  expect(clocks.map(o=>o[6])).toEqual([['501','77'],['502','11']]);
  expect(clocks[0]![0]).toBe(clocks[1]![0]);
  const f=s.evidence.facts[clocks[0]![0]]!;expect(f).toMatchObject({kind:'clock_snapshot_layout',clocks:[[['clockId','64'],['timestamp']],[['timestamp'],['clockId','3']]]});
  for(const o of s.evidence.occurrences)expect(o).toHaveLength(7);
  const r=read(ref);expect(r.traceIntervalNs).toBe('17');
  expect(r.witness?.anchors).toMatchObject(s.candidates.map(c=>({source:c.source,eventLocation:c.eventLocation,rawTimestamp:c.rawTimestamp})));
 });
});
test('malformed late clock children and duplicate selected fields cannot escape codec admission',()=>{
 for(const extra of [body(1,join(uint(1,3n),uint(2,1n),uint(2,2n))),body(1,join(uint(1,3n),uint(2,1n),uint(3,2n))),body(1,join(uint(1,3n),uint(2,1n),body(4,new Uint8Array())))])rejected(stream(...fixture(),snapshot(extra)));
});
test('unsupported policy and every nonprimitive names boundary reject before I/O',()=>{
 const open=vi.spyOn(fs,'openSync');let calls=0;
 const proxy=new Proxy({},{get(){calls++;throw Error();},ownKeys(){calls++;throw Error();}});
 expect(interval.readOwnedClock3IntervalV2(proxy,proxy,proxy)).toMatchObject({reason:'unsupported-policy'});
 for(const value of [null,undefined,true,1,Symbol('names'),{},proxy])expect(interval.readOwnedClock3IntervalV2(proxy,value,POLICY)).toMatchObject({reason:'invalid-mark-names'});
 expect(calls).toBe(0);expect(open).not.toHaveBeenCalled();vi.restoreAllMocks();
});

// All additional vectors below are authored from the packet helper schema.
function crossEpoch(clears=1){const p=fixture();const end=p.pop()!;for(let i=0;i<clears;i++)p.push(packet(7n,uint(13,1n),defaults()),packet(7n,child()));p.push(end);return p;}
function explicitMark(name:string,time:bigint){return packet(7n,uint(8,time),uint(58,3n),event(name,3n,uint(11,100n)));}
function explicitFixture(clear:Uint8Array=uint(13,1n)){return [packet(7n,clear,child()),packet(8n,parent()),snapshot(clock()),explicitMark('start',100n),packet(7n,uint(41,1n),snapshot(clock())),packet(7n,child()),explicitMark('end',117n)];}
test.each([1,3])('independently restored defaults anchors cross %i clears while V1 still refuses',clears=>{
 owned(stream(...crossEpoch(clears)),ref=>{
  const r=read(ref);expect(r).toMatchObject({status:'owned-clock3-interval-diagnostic',traceIntervalNs:'17',witness:{compatibility:{id:'owned-clock3-reviewed-v12-v2'}}});
  expect(r.witness?.anchors).toMatchObject([{sequenceId:'7',sequenceIndex:0,epoch:1,validStateProof:{kind:'anchor-defaults-selection',defaultsVersionIndex:0},threadDescriptor:{scope:['7',0,1]}},{sequenceId:'7',sequenceIndex:0,epoch:1+clears,validStateProof:{kind:'anchor-defaults-selection',defaultsVersionIndex:clears},threadDescriptor:{scope:['7',0,1+clears]}}]);
  expect(readOwnedClock3IntervalV1(JSON.stringify(ref),'["start","end"]','owned-clock3-interval-diagnostic-v1')).toMatchObject({reason:'mark-domain-unavailable',witness:null,traceIntervalNs:null});
 });
});
test.each([uint(13,1n),uint(41,1n),uint(13,3n)])('explicit track anchors use actual clear descriptor and snapshot occurrences',clear=>{
 owned(stream(...explicitFixture(clear)),ref=>{const r=read(ref);expect(r.traceIntervalNs).toBe('17');expect(r.witness?.anchors).toMatchObject([{epoch:1,validStateProof:{kind:'legal-clear-metadata',reference:{factKind:'track_descriptor',location:{fieldNumber:60,wireType:2},scope:['7',0,1]}}},{epoch:2,validStateProof:{kind:'legal-clear-metadata',reference:{factKind:'clock_snapshot_layout',location:{fieldNumber:6,wireType:2},scope:['7',0,2]}}}]);});
});
test('defaults restoration needs no metadata in the clear packet and parent can be late on another writer',()=>{
 const p=crossEpoch();const process=p.splice(2,1)[0]!;p.push(process);owned(stream(...p),ref=>expect(read(ref)).toMatchObject({traceIntervalNs:'17',witness:{parentDescriptor:{scope:['8',1,0]}}}));
});
test.each([
 ['missing new descriptor',(p:Uint8Array[])=>p.splice(6,1)],
 ['late new descriptor',(p:Uint8Array[])=>{const c=p.splice(6,1)[0]!;p.push(c);}],
 ['wrong sequence new descriptor',(p:Uint8Array[])=>p[6]=packet(9n,child())],
 ['wrong machine new descriptor',(p:Uint8Array[])=>p[6]=packet(7n,uint(98,0n),child())],
 ['missing new defaults',(p:Uint8Array[])=>p[5]=packet(7n,uint(13,1n))],
 ['new defaults missing track',(p:Uint8Array[])=>p[5]=packet(7n,uint(13,1n),body(59,uint(58,64n)))],
 ['new defaults zero track',(p:Uint8Array[])=>p[5]=packet(7n,uint(13,1n),defaults(64n,0n))],
] as const)('cross epoch refuses %s',(_label,mutate)=>{const p=crossEpoch();mutate(p);rejected(stream(...p));});
test.each([
 ['initial explained loss is invalid despite epoch one',(p:Uint8Array[])=>p[0]=packet(7n,uint(87,1n),uint(42,1n),child())],
 ['flag two is not clear',(p:Uint8Array[])=>p[0]=packet(7n,uint(13,2n),child())],
 ['unselected defaults in invalid state cannot restore explicit track',(p:Uint8Array[])=>p[0]=packet(7n,uint(87,1n),uint(42,1n),defaults(),child())],
 ['final valid state cannot establish earlier explicit anchor',(p:Uint8Array[])=>{p[0]=packet(7n,child());p.push(packet(7n,uint(13,1n),child()));}],
 ['clear metadata only after start',(p:Uint8Array[])=>{p[0]=packet(7n,uint(13,1n));p.splice(1,0,packet(7n,child()));}],
 ['clear snapshot from another writer',(p:Uint8Array[])=>{p[0]=packet(7n,uint(13,1n),child());p[4]=packet(7n,uint(41,1n));p.splice(5,0,packet(8n,uint(41,1n),snapshot(clock())));}],
 ['clear in old epoch cannot restore end',(p:Uint8Array[])=>p[4]=packet(7n,uint(41,1n))],
] as const)('explicit restoration refuses %s',(_label,mutate)=>{const p=explicitFixture();mutate(p);rejected(stream(...p),'restoration-unavailable');});
test('same packet defaults and mark use genuine decoder effective packet order',()=>{
 const p=fixture();p.splice(5,1,packet(7n,uint(13,1n),child()),packet(7n,uint(8,9007199254741010n),uint(58,3n),event('end'),defaults()));owned(stream(...p),ref=>expect(read(ref).traceIntervalNs).toBe('17'));
});
test('mixed descriptor and event oneof is refused by the genuine schema',()=>{
 const p=fixture();p[5]=packet(7n,uint(13,1n),uint(8,9007199254741010n),uint(58,3n),event('end'),defaults(),child());
 owned(stream(...p),ref=>{expect(readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY)).toMatchObject({status:'unavailable',reason:'duplicate-data-oneof'});expect(read(ref)).toMatchObject({status:'unavailable',traceIntervalNs:null,witness:null});});
});
test('an unselected valid defaults row cannot substitute for explicit-track clear metadata',()=>{
 const p=fixture();p[4]=explicitMark('start',9007199254740993n);p[5]=explicitMark('end',9007199254741010n);
 owned(stream(...p),ref=>{const s=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY).study!;expect(s.state.sequences[0]?.valid).toBe(true);expect(s.candidates[0]).toMatchObject({defaultsVersionIndex:0,track:{source:'event',value:'100'}});expect(read(ref)).toMatchObject({reason:'restoration-unavailable',traceIntervalNs:null,witness:null});});
});
test('initial explained loss leaves epoch one invalid although explicit track selection succeeds',()=>{
 const p=explicitFixture();p[0]=packet(7n,uint(87,1n),uint(42,1n),defaults(),child());p.splice(4);p.push(explicitMark('end',117n));
 owned(stream(...p),ref=>{const genuine=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY);expect(genuine.status).toBe('complete-owned-whole-diagnostic');expect(genuine.study?.state.sequences[0]).toMatchObject({epoch:1,valid:false});expect(genuine.study?.candidates).toMatchObject([{epoch:1,track:{source:'event',status:'selected'}},{epoch:1,track:{source:'event',status:'selected'}}]);expect(read(ref)).toMatchObject({reason:'restoration-unavailable',traceIntervalNs:null,witness:null});});
});
test('each exposed default and descriptor reference corresponds to the original genuine scoped record',()=>{
 owned(stream(...crossEpoch(2)),ref=>{const s=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY).study!,r=read(ref);expect(r.status).toBe('owned-clock3-interval-diagnostic');
  for(const [i,a] of r.witness!.anchors.entries()){
   const c=s.candidates[i]!;expect(a).toMatchObject({source:c.source,eventLocation:c.eventLocation,rawTimestamp:c.rawTimestamp,sequenceId:c.sequenceId,sequenceIndex:c.sequenceIndex,epoch:c.epoch,clock:c.clock,track:c.track,defaultsVersionIndex:c.defaultsVersionIndex});
   expect(a.validStateProof.kind).toBe('anchor-defaults-selection');if(a.validStateProof.kind==='anchor-defaults-selection'){const proof=a.validStateProof,d=s.state.defaults[proof.defaultsVersionIndex]!;expect(proof).toMatchObject({source:d.source,location:d.location,sequenceIndex:d.sequenceIndex,epoch:d.epoch,trackUuid:d.trackUuid,trackEventDefaultsPresent:d.trackEventDefaultsPresent});expect(proof.defaultsVersionIndex).toBe(c.track.defaultsVersionIndex);expect(d.source.packetIndex).toBeLessThanOrEqual(c.source.packetIndex);}
   const t=a.threadDescriptor,o=s.evidence.occurrences[t.occurrenceIndex]!;expect(t).toEqual({occurrenceIndex:t.occurrenceIndex,factIndex:o[0],factKind:s.evidence.facts[o[0]]!.kind,source:o[1],location:o[5],scope:o[3]});expect(t.scope).toEqual([a.sequenceId,a.sequenceIndex,a.epoch]);expect(t.source.packetIndex).toBeLessThanOrEqual(a.source.packetIndex);
  }
 });
});
test('clear proof retains actual flag or boolean headers and concrete metadata occurrence custody',()=>{
 for(const clear of [uint(13,1n),uint(41,1n),uint(13,3n)])owned(stream(...explicitFixture(clear)),ref=>{const s=readOwnedPaintTraceV12(JSON.stringify(ref),OWNED_PAINT_V12_POLICY).study!,r=read(ref);expect(r.traceIntervalNs).toBe('17');
  for(const a of r.witness!.anchors){const p=a.validStateProof;expect(p.kind).toBe('legal-clear-metadata');if(p.kind!=='legal-clear-metadata')throw Error('wrong proof');const o=s.evidence.occurrences[p.reference.occurrenceIndex]!;expect(p).toMatchObject({sequenceFlags:o[4].sequenceFlags,incrementalStateCleared:o[4].incrementalStateCleared,reference:{source:o[1],location:o[5],scope:o[3],factIndex:o[0],factKind:s.evidence.facts[o[0]]!.kind}});expect(p.incrementalStateCleared===true||(BigInt(p.sequenceFlags??'0')&1n)!==0n).toBe(true);expect(p.reference.scope).toEqual([a.sequenceId,a.sequenceIndex,a.epoch]);expect(p.reference.source.packetIndex).toBeLessThanOrEqual(a.source.packetIndex);}
 });
});
test('mixed independently selected restoration routes are retained at their respective anchors',()=>{
 const p=fixture();p[5]=packet(7n,uint(13,1n),child());p.push(explicitMark('end',9007199254741010n));owned(stream(...p),ref=>{const r=read(ref);expect(r.traceIntervalNs).toBe('17');expect(r.witness?.anchors).toMatchObject([{validStateProof:{kind:'anchor-defaults-selection'}},{validStateProof:{kind:'legal-clear-metadata'}}]);});
});
