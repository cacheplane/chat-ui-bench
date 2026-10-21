import {test,expect,vi} from 'vitest';
import {decodeBrowserFrameTrace,TRACE_INGRESS_POLICY} from './browser-frame-trace-ingress.js';
import {TraceRootFramer} from './browser-frame-trace-framer.js';
import * as packetDecoder from './browser-frame-packet-fragments.js';
const createD0RootFramerDesign=(bytes:number)=>new TraceRootFramer(bytes,131072,262144,{});
const frame=(...bytes:number[])=>Uint8Array.from(bytes);
test('A old eager rejects complete late malformed root before invalid earlier packet',()=>{
  const value=decodeBrowserFrameTrace(frame(10,1,0,18,0),TRACE_INGRESS_POLICY);
  expect(value).toMatchObject({status:'unavailable',structuralContainerEOF:false,diagnostics:[{code:'unsupported-trace-root-field',offset:3,frameIndex:1}]});
});
test('A old complete wrapper keeps packet failure distinct from root EOF',()=>{
  expect(decodeBrowserFrameTrace(frame(10,1,0),TRACE_INGRESS_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:true,diagnostics:[{code:'packet-unavailable'}]});
});
test('A old policy refuses 262145 whole bytes before scanning',()=>{
  expect(decodeBrowserFrameTrace(new Uint8Array(262145),TRACE_INGRESS_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,diagnostics:[{code:'byte-capacity'}]});
});
test('A old nonminimal root encodings and empty body remain accepted',()=>{
  expect(decodeBrowserFrameTrace(frame(138,0,128,0),TRACE_INGRESS_POLICY)).toMatchObject({status:'decoded_trace_container_fragments',frameCount:1,structuralContainerEOF:true});
});
test('A old 1025th frame capacity wins before its invalid tag',()=>{
  const bytes=new Uint8Array(2049);for(let i=0;i<1024;i++)bytes.set([10,0],i*2);bytes[2048]=0;
  expect(decodeBrowserFrameTrace(bytes,TRACE_INGRESS_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false,diagnostics:[{code:'frame-capacity',offset:2048,frameIndex:1024}]});
});
for(const split of [0,1,2,3,4])test(`RED D0 shared framer nonminimal encoded split ${split}`,()=>{
  const bytes=frame(138,0,128,0),f=createD0RootFramerDesign(bytes.length);
  f.feed(bytes.subarray(0,split));f.feed(bytes.subarray(split));
  expect(f.finish()).toMatchObject({status:'framed',frames:1,framingBoundaryComplete:true,physicalEOF:false});
});
test('RED D0 fixed opt-in can frame 1025 empty packets without changing old limit',()=>{
  const b=new Uint8Array(2050);for(let i=0;i<1025;i++)b.set([10,0],i*2);
  const f=createD0RootFramerDesign(b.length);f.feed(b);
  expect(f.finish()).toMatchObject({status:'framed',frames:1025,framingBoundaryComplete:true,physicalEOF:false});
});
test('RED D0 complete root still cannot confer physical reader EOF',()=>{
  const f=createD0RootFramerDesign(0);
  expect(f.finish()).toEqual({status:'framed',frames:0,framingBoundaryComplete:true,physicalEOF:false});
});
test('shared machine streams bodies without metadata-only body allocation',()=>{
 const windows:unknown[]=[],pieces:number[]=[];const f=new TraceRootFramer(6,1024,262144,{end:w=>windows.push(w)});
 f.feed(Uint8Array.of(10,2,8));f.feed(Uint8Array.of(1,10,0));expect(f.finish().frames).toBe(2);
 expect(windows).toEqual([{frameIndex:0,keyStart:0,keyEnd:1,lengthStart:1,lengthEnd:2,bodyStart:2,bodyEnd:4},{frameIndex:1,keyStart:4,keyEnd:5,lengthStart:5,lengthEnd:6,bodyStart:6,bodyEnd:6}]);
 const g=new TraceRootFramer(4,131072,262144,{body:b=>pieces.push(...b)});for(const n of [10,2,8,1])g.feed(Uint8Array.of(n));expect(g.finish().frames).toBe(1);expect(pieces).toEqual([8,1]);
});
test.each([{bytes:[128]},{bytes:[10,128]},{bytes:[10,2,8]}])('partial root never finishes: %j',({bytes})=>{
 const b=Uint8Array.from(bytes),f=new TraceRootFramer(b.length+1,131072,262144,{});f.feed(b);expect(()=>f.finish()).toThrow();expect(()=>f.finish()).toThrow('framer-closed');
});
test('sink reentry stays fatal even if sink catches the nested exception',()=>{
 let f:TraceRootFramer;f=new TraceRootFramer(2,131072,262144,{start(){try{f.feed(new Uint8Array());}catch{}}});
 expect(()=>f.feed(Uint8Array.of(10,0))).toThrow('framer-reentry');expect(()=>f.finish()).toThrow('framer-closed');
});
test('body limit and uint64 detector refuse before publication',()=>{
 const f=new TraceRootFramer(4,131072,1,{});expect(()=>f.feed(Uint8Array.of(10,2,0,0))).toThrow('packet-body-capacity');
 const g=new TraceRootFramer(10,131072,262144,{});expect(()=>g.feed(Uint8Array.from([128,128,128,128,128,128,128,128,128,2]))).toThrow('uint64-varint-overflow');
});
test('eager late wrapper failure invokes neither packet decoder nor packet subarray',()=>{
 const packet=vi.spyOn(packetDecoder,'decodeBrowserFramePacket'),subarray=vi.spyOn(Uint8Array.prototype,'subarray');
 try{expect(decodeBrowserFrameTrace(Uint8Array.of(10,1,0,18,0),TRACE_INGRESS_POLICY)).toMatchObject({status:'unavailable',structuralContainerEOF:false});expect(packet).not.toHaveBeenCalled();expect(subarray).not.toHaveBeenCalled();}finally{packet.mockRestore();subarray.mockRestore();}
});
