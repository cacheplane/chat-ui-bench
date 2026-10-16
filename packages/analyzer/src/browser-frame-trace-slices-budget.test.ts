import {expect,test} from 'vitest';
import {Budget,ProfileError,projectOrderedBrowserFrameEvidence,ORDERED_STATE_V2_POLICY} from './browser-frame-ordered-state.js';
import {projectBrowserFrameTraceSlices,TRACE_SLICES_POLICY} from './browser-frame-trace-slices.js';
import {projectBrowserFrameTraceEvidence,TRACE_EVIDENCE_POLICY} from './browser-frame-trace-evidence.js';
import {body,join,uint} from './browser-frame-packet-fragments.test-helper.js';
function code(fn:()=>void,expected:string){try{fn();throw Error('Expected denial');}catch(e){expect(e).toBeInstanceOf(ProfileError);expect((e as ProfileError).code).toBe(expected);}}
test('one final-owned ledger admits the complete result once including wrapper and extension',()=>{
 const b=new Budget('final-owned');
 // Eager calls from the reused core are not a second output admission pass.
 b.output('x'.repeat(524288));
 b.finishOwnedOutput({wrapper:'x'.repeat(262144),extension:'x'.repeat(262144)});
 code(()=>b.finishOwnedOutput({}),'output-already-finalized');
});
test('combined final output denies one extra string byte although either stage fits',()=>{
 const b=new Budget('final-owned');b.output('not admitted as output yet');
 code(()=>b.finishOwnedOutput({wrapper:'x'.repeat(262144),extension:'x'.repeat(262145)}),'output-string-capacity');
});
test('field and work counters accumulate across all passes without reset',()=>{
 const b=new Budget('final-owned');b.fieldsVisited(32768,0);b.fieldsVisited(98304,1);
 code(()=>b.fieldsVisited(1,2),'field-capacity');
 const w=new Budget('final-owned');w.repeatedWork(16384,0);w.repeatedWork(49152,1);
 code(()=>w.repeatedWork(1,2),'repeated-work-capacity');
});
test('old eager accounting keeps exact current output node/string limits',()=>{
 const b=new Budget();b.output('x'.repeat(524288));code(()=>b.output('x'),'output-string-capacity');
 const n=new Budget();n.output(Array(262143).fill(null));code(()=>n.output(null),'output-node-capacity');
});
test('dense unpacked members fit existing evidence but actual combined new passes exhaust one shared ledger',()=>{
 const members=join(...Array.from({length:16384},()=>uint(8,0n)));
 const packet=join(uint(10,1n),uint(13,1n),body(11,join(uint(9,1n),uint(11,7n),body(1052,members)))),bytes=body(1,packet);
 expect(projectBrowserFrameTraceEvidence(bytes,TRACE_EVIDENCE_POLICY).status).toBe('projected_trace_evidence');
 const result=projectBrowserFrameTraceSlices(bytes,TRACE_SLICES_POLICY);
 expect(result).toMatchObject({status:'unavailable',diagnostics:[{stage:'composition',code:'repeated-work-capacity',packetIndex:0,bodyStart:4}]});
 expect(result).not.toHaveProperty('ordered');expect(result).not.toHaveProperty('rawEvents');expect(result).not.toHaveProperty('typedOccurrences');
});
test('packed member source retention and offset shifting also consume shared whole-call work',()=>{
 const packet=join(uint(10,1n),uint(13,1n),body(11,join(uint(9,1n),uint(11,7n),body(1052,body(8,new Uint8Array(16384)))))),bytes=body(1,packet);
 expect(projectBrowserFrameTraceEvidence(bytes,TRACE_EVIDENCE_POLICY).status).toBe('projected_trace_evidence');
 const result=projectBrowserFrameTraceSlices(bytes,TRACE_SLICES_POLICY);
 expect(result).toMatchObject({status:'unavailable',diagnostics:[{stage:'composition',code:'repeated-work-capacity',packetIndex:0}]});expect(result).not.toHaveProperty('typedOccurrences');
});
test('final-owned node capacity is exact over the entire result, not reset by wrapper or extension',()=>{
 new Budget('final-owned').finishOwnedOutput(Array(262143).fill(null));
 code(()=>new Budget('final-owned').finishOwnedOutput(Array(262144).fill(null)),'output-node-capacity');
});
test('whole result includes wrapper overhead in the unchanged four-MiB serialized limit',()=>{
 const packet=(...parts:Uint8Array[])=>join(uint(10,1n),...parts);
 const intern=(padding:number)=>packet(uint(13,1n),body(12,join(...Array.from({length:4096},(_,i)=>body(2,join(uint(1,BigInt(i+1)),body(2,new Uint8Array(Math.min(4096,Math.max(0,padding-i*4096))))))))));
 const original=[intern(32768),intern(3661),body(6,join(...Array.from({length:8191},()=>uint(536870911,0n))))];
 const base=projectOrderedBrowserFrameEvidence({domain:'whole-supplied-trace-diagnostic-group-v1',packets:original},ORDERED_STATE_V2_POLICY);
 expect(base.status).toBe('projected_ordered_manual_evidence');expect(Buffer.byteLength(JSON.stringify(base))).toBeLessThanOrEqual(4194304);
 const result=projectBrowserFrameTraceSlices(join(...original.map(p=>body(1,p))),TRACE_SLICES_POLICY);
 expect(result).toMatchObject({status:'unavailable',diagnostics:[{stage:'composition',code:'output-byte-capacity'}]});expect(result).not.toHaveProperty('ordered');
});
