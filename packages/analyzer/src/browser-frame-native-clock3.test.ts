import {expect,test,vi,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import * as reader from './browser-frame-whole-trace-reader.js';
import {createNativeClock3PhaseStudy} from './browser-frame-ordered-state.js';
import {readNativeClock3PhaseAlignment,NATIVE_CLOCK3_PHASE_POLICY} from './browser-frame-native-clock3.js';
import * as native from './browser-frame-native-clock3.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';

const packet=(seq:bigint,...fields:Uint8Array[])=>join(uint(10,seq),...fields);
const event=(name:string,type=3n,...extra:Uint8Array[])=>body(11,join(uint(9,type),text(22,name==='start'||name==='end'?'blink.user_timing':'cc'),text(23,name),...extra));
const mark=(name:string,t:bigint)=>packet(7n,uint(8,t),uint(58,3n),event(name));
const clock=(id:bigint,t:bigint,incremental?:boolean,multiplier?:bigint)=>body(1,join(uint(1,id),uint(2,t),...(incremental===undefined?[]:[uint(3,incremental?1n:0n)]),...(multiplier===undefined?[]:[uint(4,multiplier)])));
const snapshot=(b=1000250n,a=1000n,...extra:Uint8Array[])=>body(6,join(clock(3n,b),clock(64n,a,true,1000n),clock(65n,a,false,1000n),...extra));
const defaults=(id=64n,track=100n)=>body(59,join(uint(58,id),body(11,uint(11,track))));
const descriptor=(uuid=100n)=>body(60,join(uint(1,uuid),uint(5,200n),body(4,join(uint(1,20n),uint(2,21n)))));
const parent=()=>body(60,join(uint(1,200n),body(3,join(uint(1,20n),uint(7,900n)))));
const stream=(packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
function fixture(){return[
 body(6,join(uint(2,6n),clock(3n,999000n),clock(6n,999000n))),
 packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),uint(8,0n),defaults(),snapshot()),
 packet(7n,uint(8,0n),descriptor()),packet(7n,uint(8,0n),parent()),
 mark('start',1010000n),
 packet(7n,uint(8,10n),event('unrelated')),packet(7n,uint(8,2n),descriptor(300n)),
 packet(7n,uint(8,3n),event('DrawFrame')),
 packet(7n,uint(8,1000000n),uint(58,3n),event('BeginFrame')),
 packet(7n,uint(8,1016n),uint(58,65n),event('unrelated')),
 packet(7n,uint(8,1n),event('DrawFrame')),
 mark('end',1020000n),
 packet(7n,uint(8,1020000n),uint(58,3n),event('BeginFrame')),
 ];}
function owned(packets:Uint8Array[],run:(ref:{path:string;bytes:number;sha256:string},file:string)=>void){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'native-clock3-')),file=path.join(dir,'trace.pftrace'),bytes=stream(packets);fs.writeFileSync(file,bytes);
 try{run({path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},file);}finally{vi.restoreAllMocks();fs.rmSync(dir,{recursive:true,force:true});}
}
const read=(value:unknown,names:unknown=['start','end'],policy:unknown=NATIVE_CLOCK3_PHASE_POLICY)=>readNativeClock3PhaseAlignment(value,names,policy) as any;
function refused(packets:Uint8Array[],reason?:string){owned(packets,ref=>{for(const r of [read(ref),native.readNativeClock3PhaseAlignmentV2(ref,['start','end'],native.NATIVE_CLOCK3_PHASE_V2_POLICY)]){expect(r.status).toBe('unavailable');expect(r.projection).toBeNull();if(reason)expect(r.reason).toBe(reason);}});}
afterEach(()=>vi.restoreAllMocks());

test('separate native clock3 reader selection exists without replacing V8',()=>{
  expect((reader as unknown as Record<string,unknown>).readNativeClock3PhaseTrace).toBeTypeOf('function');
  expect(reader.readWholeUserTimingTraceV8).toBeTypeOf('function');
});

test('owned full stream projects exact local residuals through unrelated and descriptor packets',()=>owned(fixture(),ref=>{
 const r=read(ref);expect(r).toMatchObject({status:'native-clock3-phase-alignment-diagnostic',reason:null,fullInputVerified:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true},projection:{referenceClockId:'3',phase:{startNs:'1010000',endNs:'1020000'},counts:{BeginFrame:{before:1,inside:0,after:1},DrawFrame:{before:0,inside:2,after:0}}}});
 expect(r.projection.rows.map((x:any)=>[x.name,x.clock3Ns,x.position])).toEqual([['DrawFrame','1015250','inside'],['BeginFrame','1000000','before'],['DrawFrame','1016250','inside'],['BeginFrame','1020000','after']]);
 expect(r.projection.rows[0]).toMatchObject({rawTimestamp:'3',clockId:'64',clockSource:'defaults',snapshotPacketIndex:1,offsetNs:'250',eventType:'3',nameSource:'literal',nameDefinitionIndex:null,trackSource:'defaults',trackDefaultsVersionIndex:0});
 expect(r.authority).toMatchObject({nativeSupported:false,scoringEligibility:false,rankingEligibility:false,FPS:'unavailable'});
 expect(r.compatibility).toEqual({id:'same-trace-clock3-reviewed-fields-v1',parserPin:'403906f4adfbf287a02e5546f8430dcc9d56b649',interpretationPin:'1e9c61e9844affd7dccd3d42d9ea9f3a3d10cf6d',implementation:'reviewedClock3Phase'});
 expect(Object.isFrozen(r.projection.rows)).toBe(true);
}));

test.each([3n,64n])('explicit packet clock0 selects valid default%i retaining presence',id=>{const p=fixture();p.splice(7,1,packet(7n,defaults(id),uint(8,id===3n?1015250n:3n),uint(58,0n),event('DrawFrame')));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows[0]).toMatchObject({rawTimestamp:id===3n?'1015250':'3',explicitClockId:'0',clockId:String(id),clockSource:'defaults',clock3Ns:'1015250'});});});

test.each([0n,6n])('selected unsupported default%i refuses without implicit clock3',id=>{const p=fixture();p[7]=packet(7n,defaults(id),uint(8,3n),uint(58,0n),event('DrawFrame'));refused(p);});
test('packet0 with no valid default refuses',()=>{const p=fixture();p[1]=packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),snapshot());p[2]=packet(7n,descriptor());p[3]=packet(7n,parent());p[5]=packet(7n,uint(8,1010000n),uint(58,3n),event('unrelated'));p[6]=packet(7n,descriptor(300n));p[7]=packet(7n,uint(8,3n),uint(58,0n),event('DrawFrame',3n,uint(11,100n)));refused(p);});

test('absolute local65 selected event uses exact residual without advancing64',()=>{const p=fixture();p[9]=packet(7n,uint(8,1016n),uint(58,65n),event('DrawFrame'));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows.filter((x:any)=>x.name==='DrawFrame').map((x:any)=>x.clock3Ns)).toEqual(['1015250','1016250','1016250']);});});
test('legitimate unnamed slice ends and counters still advance packet delta time',()=>{const p=fixture();p[5]=packet(7n,uint(8,10n),body(11,uint(9,2n)));p[6]=packet(7n,uint(8,2n),body(11,uint(9,4n)));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows[0].clock3Ns).toBe('1015250');});});
test('timestamp-bearing packet without TrackEvent advances local64',()=>{const p=fixture();p[5]=packet(7n,uint(8,10n));owned(p,ref=>expect(read(ref).projection.rows[0].clock3Ns).toBe('1015250'));});
test('snapshot header timestamp is bypassed rather than added as another delta',()=>{const p=fixture();p[1]=packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),uint(8,8888n),defaults(),snapshot());owned(p,ref=>expect(read(ref).projection.rows[0].clock3Ns).toBe('1015250'));});
test('producer primary clock3 does not change the separately chosen raw clock3 reference',()=>{const p=fixture();p[0]=body(6,join(uint(2,3n),clock(3n,999000n),clock(6n,999000n)));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows[0].clock3Ns).toBe('1015250');expect(r.study.evidenceInventory.observations[0].primaryTraceClock).toBe('3');});});
test('snapshot rebase in initialized epoch preserves unit/residual and resets delta accumulator',()=>{const p=fixture();p.splice(7,0,packet(7n,uint(8,4444n),snapshot(1012250n,1012n)));owned(p,ref=>expect(read(ref).projection.rows[0]).toMatchObject({clock3Ns:'1015250',snapshotPacketIndex:7,offsetNs:'250'}));});
test('reset plus fresh defaults/snapshot establishes a separate local clock epoch',()=>{const p=fixture();p.splice(7,0,packet(7n,uint(13,1n),defaults(),snapshot(1012250n,1012n)));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows[0]).toMatchObject({clock3Ns:'1015250',intervalVersion:2});});});
test('reset without new clock anchor cannot reuse prior accumulator',()=>{const p=fixture();p.splice(7,0,packet(7n,uint(13,1n),defaults()));refused(p);});
test.each([1n,2n,4n])('same selected name with noninstant type%i is unsupported',type=>{const p=fixture();p[7]=packet(7n,uint(8,3n),event('DrawFrame',type));refused(p);});
test('selected instant missing timestamp refuses',()=>{const p=fixture();p[7]=packet(7n,event('DrawFrame'));refused(p);});
test('selected instant without resolved track refuses',()=>{const p=fixture();p[7]=packet(7n,defaults(64n,0n),uint(8,3n),event('DrawFrame'));refused(p);});
test('unresolved name IID refuses completeness while unrelated named events remain supported',()=>{const p=fixture();p[5]=packet(7n,uint(8,10n),body(11,join(uint(9,3n),uint(3,333n))));refused(p);});
test('selected builtin6 cannot be extrapolated from equal initial snapshots',()=>{const p=fixture();p[7]=packet(7n,uint(8,1015250n),uint(58,6n),event('DrawFrame'));refused(p);});
test.each(['zeroId','zeroUnit','badBuiltinUnit','badLocalUnit','badIncremental','lateUnit'])('unsupported or contradictory snapshot %s withdraws all rows',kind=>{const p=fixture();const bad=kind==='zeroId'?body(6,clock(0n,1n)):kind==='zeroUnit'?body(6,clock(3n,1n,false,0n)):kind==='badBuiltinUnit'?body(6,clock(3n,1n,false,1000n)):kind==='badLocalUnit'?body(6,join(clock(3n,1n),clock(64n,1n,true,1n))):kind==='badIncremental'?body(6,join(clock(3n,1n),clock(64n,1n,false,1000n))):body(6,join(clock(3n,1n),clock(65n,1n,false,1n)));p.push(packet(7n,bad));refused(p);});
test('explicit machine0 remains different from absent-machine supported profile',()=>{const p=fixture();p[7]=join(p[7],uint(98,0n));refused(p);});
test('late unexplained raw loss withdraws earlier normalized rows',()=>refused([...fixture(),packet(7n,uint(42,1n))]));
test('late malformed packet withdraws earlier normalized rows',()=>refused([...fixture(),Uint8Array.of(0)]));
test('BigInt projection above Number precision retains exact nanoseconds',()=>{const p=fixture(),n=9007199254740993n;p[0]=body(6,join(uint(2,6n),clock(3n,999000n+n),clock(6n,999000n+n)));p[1]=packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),defaults(),snapshot(1000250n+n));p[4]=mark('start',1010000n+n);p[8]=packet(7n,uint(8,1000000n+n),uint(58,3n),event('BeginFrame'));p[11]=mark('end',1020000n+n);p[12]=packet(7n,uint(8,1020000n+n),uint(58,3n),event('BeginFrame'));owned(p,ref=>expect(read(ref).projection.rows[0]).toMatchObject({clock3Ns:String(n+1015250n),offsetNs:String(n+250n)}));});
test('independent sequences cannot share the numeric64 clock accumulator',()=>{const p=fixture();p.push(packet(8n,uint(13,1n),defaults(64n,101n),snapshot(1020000n,900n)),packet(8n,uint(8,9n),event('unrelated')),packet(8n,uint(8,1n),event('DrawFrame')),packet(7n,uint(8,1n),event('DrawFrame')));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows.slice(-2).map((x:any)=>[x.sequenceId,x.clock3Ns])).toEqual([['8','1030000'],['7','1017250']]);});});
test('negative anchor offset is retained exactly',()=>{const p=fixture();p[1]=packet(7n,uint(13,1n),uint(87,1n),uint(42,1n),defaults(),snapshot(999999n));owned(p,ref=>expect(read(ref).projection.rows[0]).toMatchObject({clock3Ns:'1014999',offsetNs:'-1'}));});
test('uint64 delta multiplication cannot overflow the supported int64 projection range',()=>{const p=fixture();p[7]=packet(7n,uint(8,9223372036854775807n),event('DrawFrame'));refused(p,'clock3-arithmetic-range');});
test('negative projected absolute timestamp refuses all earlier rows',()=>{const p=fixture();p.push(packet(7n,snapshot(0n)),packet(7n,uint(8,0n),uint(58,65n),event('DrawFrame')));refused(p,'clock3-arithmetic-range');});
test('legacy event timestamp representation remains unsupported',()=>{const p=fixture();p[7]=packet(7n,uint(8,3n),event('DrawFrame',3n,uint(1,2n)));refused(p);});
test.each(['child-process','parent-thread','parent-reparent'])('ambiguous mark descriptor %s refuses phase identity',kind=>{const p=fixture();if(kind==='child-process')p[2]=packet(7n,uint(8,0n),body(60,join(uint(1,100n),uint(5,200n),body(4,join(uint(1,20n),uint(2,21n))),body(3,join(uint(1,20n),uint(7,900n))))));else if(kind==='parent-thread')p[3]=packet(7n,uint(8,0n),body(60,join(uint(1,200n),body(3,join(uint(1,20n),uint(7,900n))),body(4,join(uint(1,20n),uint(2,44n))))));else p.push(packet(7n,body(60,join(uint(1,200n),uint(5,300n),body(3,join(uint(1,20n),uint(7,900n)))))));refused(p,'clock3-descriptor-identity');});
test.each(['thread','process'])('repeated equivalent %s descriptor with reversed protobuf field order preserves projection',kind=>owned(fixture(),base=>{
 const expected=read(base).projection,p=fixture();
 p.push(packet(7n,kind==='thread'?body(60,join(uint(1,100n),uint(5,200n),body(4,join(uint(2,21n),uint(1,20n))))):body(60,join(uint(1,200n),body(3,join(uint(7,900n),uint(1,20n)))))));
 owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection).toEqual(expected);});
}));
test.each(['tid','pid','generation'])('missing required phase descriptor %s refuses all normalized rows',field=>{
 const p=fixture();
 if(field==='generation')p[3]=packet(7n,uint(8,0n),body(60,join(uint(1,200n),body(3,uint(1,20n)))));
 else p[2]=packet(7n,uint(8,0n),body(60,join(uint(1,100n),uint(5,200n),body(4,field==='tid'?uint(1,20n):uint(2,21n)))));
 refused(p,'clock3-descriptor-identity');
});
test('whole streaming split boundaries preserve exact projection and manifests',()=>{const bytes=stream(fixture()),make=()=>createNativeClock3PhaseStudy(bytes.length,['start','end'],NATIVE_CLOCK3_PHASE_POLICY),one=make();one.feed(bytes);const expected=one.finish();expect(expected.clock3Projection?.projection?.rows).toHaveLength(4);for(const at of [1,2,3,15,64,bytes.length-1]){const split=make();split.feed(bytes.subarray(0,at));split.feed(bytes.subarray(at));const r=split.finish();expect(r.packetManifestSHA256).toBe(expected.packetManifestSHA256);expect(r.transitionManifestSHA256).toBe(expected.transitionManifestSHA256);expect(r.clock3Projection).toEqual(expected.clock3Projection);}});
test('duplicate or missing phase literal never admits a prefix population',()=>{refused([...fixture(),mark('end',1020000n)]);const p=fixture();p.splice(11,1);refused(p);});
test('fully resolved unrelated UserTiming literal is not a third owned phase and its delta is processed',()=>{const p=fixture();p.splice(7,0,packet(7n,uint(8,1n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,'unrelated-known-mark')))));owned(p,ref=>{const r=read(ref);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows[0].clock3Ns).toBe('1016250');expect(r.projection.rows[2].clock3Ns).toBe('1017250');expect(r.study.candidates).toHaveLength(3);});});
test('unresolved UserTiming name remains a refusal even when outside the two requested literals',()=>{const p=fixture();p.splice(7,0,packet(7n,uint(8,1n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),uint(3,999n)))));refused(p);});
test.each([126,127])('joint native plus two mark ceiling refuses no prefix at %i instants',n=>{const p=fixture();p.splice(5,6,...Array.from({length:n},()=>packet(7n,uint(8,1015000n),uint(58,3n),event('DrawFrame'))));p.pop();owned(p,ref=>{const r=read(ref);if(n===126){expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection.rows).toHaveLength(126);}else{expect(r.status).toBe('unavailable');expect(r.projection).toBeNull();}});});
test('private boundary rejects forged JSON, wrong policy and hostile names before reading',()=>owned(fixture(),ref=>{
 let traps=0;const proxy=new Proxy(['start','end'],{get(){traps++;throw Error();},ownKeys(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}}),getter=['start','end'];
 Object.defineProperty(getter,'0',{get(){traps++;throw Error();}});
 const hole=['start','end'];hole.length=3;const sparse=['start','end'];sparse.length=4294967295;
 const open=vi.spyOn(fs,'openSync');
 for(const names of [proxy,getter,hole,sparse,['start','start'],['start'],['start','end','extra'],['\ud800','end']])expect(read(ref,names)).toMatchObject({status:'unavailable',reason:'invalid-mark-names',projection:null});
 expect(traps).toBe(0);expect(open).not.toHaveBeenCalled();expect(read({status:'success'})).toMatchObject({status:'unavailable',reason:'invalid-reference',projection:null});expect(read(ref,['start','end'],'other')).toMatchObject({status:'unavailable',reason:'unsupported-policy',projection:null});expect(open).not.toHaveBeenCalled();
}));
test.each(['hash','bytes','symlink','hardlink','read','close','identity','EOF'])('owned %s failure withdraws phase and native rows',kind=>owned(fixture(),(ref,file)=>{if(kind==='hash')ref.sha256='0'.repeat(64);if(kind==='bytes')ref.bytes--;if(kind==='symlink'){fs.renameSync(file,file+'.real');fs.symlinkSync(file+'.real',file);}if(kind==='hardlink')fs.linkSync(file,file+'.other');if(kind==='read'){const original=fs.readSync;let n=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>{if(++n===2)throw Error();return original(...args);});}if(kind==='close'){const original=fs.closeSync;vi.spyOn(fs,'closeSync').mockImplementation(fd=>{original(fd);throw Error();});}if(kind==='identity'){const original=fs.fstatSync;let n=0;vi.spyOn(fs,'fstatSync').mockImplementation((...args)=>{const s=original(...args);if(++n===2&&typeof s.ctimeNs==='bigint')s.ctimeNs++;return s;});}if(kind==='EOF'){const original=fs.readSync;let n=0;vi.spyOn(fs,'readSync').mockImplementation((...args)=>++n===2?1:original(...args));}expect(read(ref)).toMatchObject({status:'unavailable',projection:null});}));

test('explicit clock3-v2 retains the exact v1 authored projection with compact evidence',()=>owned(fixture(),ref=>{const old=read(ref),r=native.readNativeClock3PhaseAlignmentV2(ref,['start','end'],native.NATIVE_CLOCK3_PHASE_V2_POLICY);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.projection).toEqual(old.projection);expect(r.compatibility.implementation).toBe('reviewedCompactEvidence');expect(r.study?.evidenceInventory).toMatchObject({status:'complete-supported-compact-observations',version:1});expect(r.authority.FPS).toBe('unavailable');}));
test('clock3-v2 folds high duplicate phase descriptors without losing multiplicity',()=>{const p=fixture();p.push(...Array.from({length:200},()=>packet(7n,descriptor())));owned(p,ref=>{expect(read(ref).status).toBe('unavailable');const r=native.readNativeClock3PhaseAlignmentV2(ref,['start','end'],native.NATIVE_CLOCK3_PHASE_V2_POLICY);expect(r.status).toBe('native-clock3-phase-alignment-diagnostic');expect(r.study?.evidenceInventory.occurrences.length).toBeGreaterThan(200);expect(r.projection?.rows).toHaveLength(4);});});
test.each(['unresolved','clock6','conflict','late-malformed'])('clock3-v2 retains %s semantic refusal',kind=>{const p=fixture();if(kind==='unresolved')p[5]=packet(7n,uint(8,10n),body(11,join(uint(9,3n),uint(3,999n))));else if(kind==='clock6')p[7]=packet(7n,uint(8,1015250n),uint(58,6n),event('DrawFrame'));else if(kind==='conflict')p.push(packet(7n,body(60,join(uint(1,100n),uint(5,200n),body(4,join(uint(1,20n),uint(2,99n)))))));else p.push(Uint8Array.of(0));owned(p,ref=>{const r=native.readNativeClock3PhaseAlignmentV2(ref,['start','end'],native.NATIVE_CLOCK3_PHASE_V2_POLICY);expect(r.status).toBe('unavailable');expect(r.projection).toBeNull();});});
