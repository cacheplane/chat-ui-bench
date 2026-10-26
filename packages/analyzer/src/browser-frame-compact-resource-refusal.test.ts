import {expect,test} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as ordered from './browser-frame-ordered-state.js';
import * as reader from './browser-frame-whole-trace-reader.js';
import * as native from './browser-frame-native-clock3.js';
import {body,join,text,uint} from './browser-frame-packet-fragments.test-helper.js';

const names=['start','end'] as const;
const packet=(...fields:Uint8Array[])=>join(uint(10,7n),...fields);
const event=(name:string,category='cc')=>body(11,join(uint(9,3n),text(22,category),text(23,name)));
const mark=(name:string,t=4n)=>packet(uint(8,t),uint(58,3n),event(name,'blink.user_timing'));
const prefix=()=>[
 packet(uint(13,1n),uint(87,1n),uint(42,1n),body(59,join(uint(58,3n),body(11,uint(11,100n)))),
  body(60,join(uint(1,100n),uint(5,200n),body(4,join(uint(1,20n),uint(2,21n)))))),
 packet(body(60,join(uint(1,200n),body(3,join(uint(1,20n),uint(7,900n)))))),
 mark('start',1n),packet(uint(8,2n),uint(58,3n),event('BeginFrame')),mark('end',3n),
];
const max=9223372036854775807n;
const heavyDescriptor=(variation=0)=>body(60,join(uint(1,18446744073709551615n),uint(5,18446744073709551614n-BigInt(variation)),
 body(3,join(uint(1,2147483647n),uint(7,max))),body(4,join(uint(1,2147483647n),uint(2,max)))));
const bulky=()=>packet(uint(8,max),uint(58,3n),uint(13,1n),uint(42,0n),uint(41,0n),uint(87,0n),heavyDescriptor());
const stream=(packets:Uint8Array[])=>join(...packets.map(p=>body(1,p)));
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

function engine(bytes:Uint8Array,version:9|2){
 const s=version===9?ordered.createWholeUserTimingStudyV9(bytes.length,ordered.WHOLE_USER_TIMING_V9_POLICY):
  ordered.createNativeClock3PhaseStudyV2(bytes.length,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
 for(let i=0;i<bytes.length;i+=32768)s.feed(bytes.slice(i,i+32768));
 return s.finish();
}
function owned<T>(bytes:Uint8Array,run:(ref:{path:string;bytes:number;sha256:string})=>T):T{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'compact-resource-')),file=path.join(dir,'trace.pftrace');
 fs.writeFileSync(file,bytes);
 try{return run({path:file,bytes:bytes.length,sha256:hash(bytes)});}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function sourceState(result:ReturnType<typeof engine>,version:9|2){
 expect(result.status).toBe('whole-annotation-study');
 expect(result.evidenceInventory).toMatchObject({status:'complete-supported-compact-observations'});
 expect(result.evidenceInventory?.occurrences.length).toBeGreaterThan(0);
 expect(result.candidates.length).toBeGreaterThan(0);
 expect(result.rawDropInventory).toMatchObject({status:'complete-supported-header-declarations',nonzeroDeclarations:1,explainedDeclarations:1});
 if(version===2){expect('clock3Projection'in result).toBe(true);if('clock3Projection'in result)expect(result.clock3Projection?.projection?.rows.length).toBeGreaterThan(0);}
}
function withdrawn(result:ReturnType<typeof engine>){
 expect(result.status).toBe('unavailable');
 expect(result.semanticProcessing).toBe('unavailable');expect(result.markInventoryAdmission).toBe('not_evaluated');
 expect(result.evidenceInventory).toEqual({status:'unavailable',version:1,facts:[],occurrences:[]});
 expect(result.candidates).toEqual([]);
 expect(result.rawDropInventory).toEqual({status:'unavailable',facts:[],nonzeroDeclarations:null,explainedDeclarations:null,unexplainedDeclarations:null,contradictoryDeclarations:null});
 if('clock3Projection'in result&&result.clock3Projection)expect(result.clock3Projection.projection).toBeNull();
 expect(result.budgets.repeated).toBeLessThanOrEqual(65536);
 expect(result.budgets.persistentUTF8).toBeLessThanOrEqual(262144);
}
function measured(value:unknown){
 let nodes=0,objects=0,utf8=0,depth=0;
 function visit(v:unknown,d:number){nodes++;depth=Math.max(depth,d);if(typeof v==='string')utf8+=Buffer.byteLength(v);
  else if(v!==null&&typeof v==='object'){objects++;for(const[k,x]of Object.entries(v)){if(!Array.isArray(v))utf8+=Buffer.byteLength(k);visit(x,d+1);}}}
 visit(value,0);return{nodes,objects,utf8,depth,bytes:Buffer.byteLength(JSON.stringify(value))};
}

test.each([9,2] as const)('V%i repeated-work refusal withdraws populated compact/mark/rawdrop/projection state and reads the entire tail',version=>{
 const safe=stream([...prefix(),...Array.from({length:1000},()=>packet(uint(8,2n),uint(58,3n),event('unrelated')))]);
 sourceState(engine(safe,version),version);
 const bytes=stream([...prefix(),...Array.from({length:22000},()=>packet(uint(8,2n),uint(58,3n),event('unrelated')))]),result=engine(bytes,version);
 withdrawn(result);expect(result.reason).toBe('repeated-work-capacity');expect(result.budgets.repeated).toBe(65536);
 expect(result.framingBoundaryComplete).toBe(true);expect(result.inputRef).toEqual({bytes:bytes.length,sha256:hash(bytes)});
 expect(result.counters.packets).toBe(22005);expect(result.counters.processedPackets).toBeLessThan(result.counters.packets);
 owned(bytes,ref=>{const r=version===9?reader.readWholeUserTimingTraceV9(ref,ordered.WHOLE_USER_TIMING_V9_POLICY):native.readNativeClock3PhaseAlignmentV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(r).toMatchObject({status:'unavailable',reason:'repeated-work-capacity',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,bytes:bytes.length,sha256:hash(bytes)}});
  expect(r.study).not.toBeNull();withdrawn(r.study as ReturnType<typeof engine>);if('projection'in r)expect(r.projection).toBeNull();});
});

test.each([9,2] as const)('V%i persistent refusal charges full repeated rows and tuple/key overhead before the occurrence ceiling',version=>{
 sourceState(engine(stream([...prefix(),...Array.from({length:200},bulky)]),version),version);
 const bytes=stream([...prefix(),...Array.from({length:253},bulky)]),r=engine(bytes,version);
 withdrawn(r);expect(r.reason).toBe('persistent-string-capacity');expect(r.diagnostics[0]?.packetIndex).toBe(version===9?253:252);
 expect(r.budgets.persistentUTF8).toBeGreaterThan(260000);expect(r.framingBoundaryComplete).toBe(true);expect(r.inputRef).toEqual({bytes:bytes.length,sha256:hash(bytes)});
 expect(r.counters.packets).toBe(258);expect(r.counters.processedPackets).toBeLessThan(258);
 owned(bytes,ref=>{const result=version===9?reader.readWholeUserTimingTraceV9(ref,ordered.WHOLE_USER_TIMING_V9_POLICY):native.readNativeClock3PhaseAlignmentV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(result).toMatchObject({status:'unavailable',reason:'persistent-string-capacity',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,sha256:hash(bytes)}});
  expect(result.study).not.toBeNull();withdrawn(result.study as ReturnType<typeof engine>);if('projection'in result)expect(result.projection).toBeNull();});
});

test('v2 iterator finish work cannot escape the repeated-work guard or publish a completed prefix',()=>{
 const packets=(count:number)=>[...prefix(),...Array.from({length:230},()=>packet(heavyDescriptor())),
  ...Array.from({length:count},()=>packet(uint(8,2n),uint(58,3n),event('unrelated')))];
 sourceState(engine(stream(packets(10300)),2),2);
 const bytes=stream(packets(10400)),result=engine(bytes,2);withdrawn(result);
 expect(result.reason).toBe('repeated-work-capacity');expect(result.diagnostics[0]?.packetIndex).toBeNull();
 expect(result.counters.processedPackets).toBe(result.counters.packets);expect(result.counters.packets).toBe(10635);
 expect(result.budgets.repeated).toBe(65536);expect(result.framingBoundaryComplete).toBe(true);expect(result.inputRef).toEqual({bytes:bytes.length,sha256:hash(bytes)});
 owned(bytes,ref=>{const r=native.readNativeClock3PhaseAlignmentV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(r).toMatchObject({status:'unavailable',reason:'repeated-work-capacity',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,sha256:hash(bytes)},projection:null});
  expect(r.study).not.toBeNull();withdrawn(r.study as ReturnType<typeof engine>);});
});

const outputPackets=(lengths:number[])=>[...prefix(),...Array.from({length:230},(_,i)=>packet(heavyDescriptor(i%126))),...lengths.map((n,i)=>mark(String(i)+'x'.repeat(n-1)))];
test.each([9,2] as const)('V%i final combined aggregate UTF8 refusal clears all previously admitted arrays',version=>{
 const safe=engine(stream(outputPackets([4080,4080,4080])),version);sourceState(safe,version);
 const size=measured(safe);expect(size.utf8).toBeLessThanOrEqual(65536);expect(size.utf8+4080).toBeGreaterThan(65536);
 // One further candidate keeps all other dimensions far below their unchanged ceilings.
 expect(size.bytes+12000).toBeLessThan(262144);expect(size.nodes+64).toBeLessThan(32768);expect(size.objects+4).toBeLessThan(4096);expect(size.depth).toBeLessThan(16);
 const bytes=stream(outputPackets([4080,4080,4080,4080])),r=engine(bytes,version);withdrawn(r);
 expect(r.reason).toBe('result-capacity');expect(r.diagnostics[0]?.packetIndex).toBeNull();expect(r.counters.processedPackets).toBe(r.counters.packets);
 expect(r.budgets.persistentUTF8).toBeLessThan(220000);expect(r.budgets.candidateUTF8).toBeLessThan(16384);expect(r.inputRef).toEqual({bytes:bytes.length,sha256:hash(bytes)});
 owned(bytes,ref=>{const result=version===9?reader.readWholeUserTimingTraceV9(ref,ordered.WHOLE_USER_TIMING_V9_POLICY):native.readNativeClock3PhaseAlignmentV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(result).toMatchObject({status:'unavailable',reason:'result-capacity',fullInputVerified:true,structuralContainerEOF:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,sha256:hash(bytes)}});
  expect(result.study).not.toBeNull();withdrawn(result.study as ReturnType<typeof engine>);if('projection'in result)expect(result.projection).toBeNull();});
});

test('complete v2 engine state can still be refused by the owned reader envelope',()=>{
 const bytes=stream(outputPackets([4080,4080,3700]));sourceState(engine(bytes,2),2);
 owned(bytes,ref=>{const r=reader.readNativeClock3PhaseTraceV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(r).toMatchObject({status:'unavailable',reason:'result-capacity',fullInputVerified:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true},projection:null,study:null});});
});
test('complete owned v2 reader state can still be refused by final facade compatibility admission',()=>{
 const bytes=stream(outputPackets([4080,4080,3500]));
 owned(bytes,ref=>{const core=reader.readNativeClock3PhaseTraceV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(core.status).toBe('native-clock3-phase-alignment-diagnostic');expect(core.study?.evidenceInventory?.occurrences).toHaveLength(232);expect(core.study?.candidates).toHaveLength(5);expect(core.study?.rawDropInventory?.facts).toHaveLength(1);expect(core.projection?.rows).toHaveLength(1);
  expect(measured(core).utf8).toBeLessThanOrEqual(65536);
  const result=native.readNativeClock3PhaseAlignmentV2(ref,names,ordered.NATIVE_CLOCK3_PHASE_V2_POLICY);
  expect(result).toMatchObject({status:'unavailable',reason:'result-capacity',fullInputVerified:true,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true},projection:null,study:null});});
});

test('shared unchanged whole-output guard retains independent node, object and depth bounds',()=>{
 expect(()=>ordered.finishWholeAnnotationOutput(Array.from({length:32767},()=>null))).not.toThrow();
 expect(()=>ordered.finishWholeAnnotationOutput(Array.from({length:32768},()=>null))).toThrow('result-capacity');
 expect(()=>ordered.finishWholeAnnotationOutput(Array.from({length:4095},()=>({})))).not.toThrow();
 expect(()=>ordered.finishWholeAnnotationOutput(Array.from({length:4096},()=>({})))).toThrow('result-shape');
 let value:unknown=null;for(let i=0;i<16;i++)value=[value];expect(()=>ordered.finishWholeAnnotationOutput(value)).not.toThrow();
 expect(()=>ordered.finishWholeAnnotationOutput([value])).toThrow('result-capacity');
});
