import {expect,test}from'vitest';
import {createD0StructuralStudy,D0_POLICY,D0_LIMITS,encodeD0Result}from'./browser-frame-whole-trace.js';
import{body,join}from'./browser-frame-packet-fragments.test-helper.js';
test('chunk proxy rejection invokes no application traps and ordinary byte views remain valid',()=>{
 for(const throwing of [false,true]){
  let traps=0;const input=new Proxy(Uint8Array.of(10,0),{getPrototypeOf(){traps++;if(throwing)throw Error('application trap');return Uint8Array.prototype;},get(){traps++;throw Error('application get');}});
  const s=createD0StructuralStudy(2,D0_POLICY);s.feed(input);
  expect(traps).toBe(0);expect(s.finish()).toMatchObject({status:'unavailable',inputRef:{bytes:0},diagnostics:[{code:'unsupported-byte-view'}]});
 }
 for(const input of [Uint8Array.of(10,0),new Uint8Array(Uint8Array.of(99,10,0,99).buffer,1,2)]){
  const s=createD0StructuralStudy(2,D0_POLICY);s.feed(input);expect(s.finish()).toMatchObject({status:'structural-study',packets:1,decodedPackets:1});
 }
});
test('D0 study frames complete supplied empty packet but cannot own physical EOF',()=>{
 const s=createD0StructuralStudy(2,D0_POLICY);s.feed(Uint8Array.of(10,0));
 expect(s.finish()).toMatchObject({status:'structural-study',framingBoundaryComplete:true,structuralContainerEOF:false});
});
test('projection first failure stops decoding but full framing and body hashes continue',()=>{
 const s=createD0StructuralStudy(7,D0_POLICY);s.feed(Uint8Array.of(10,1,0,10,0,10,0));const r=s.finish();
 expect(r).toMatchObject({status:'unavailable',framingBoundaryComplete:true,packetProjection:'unavailable',packets:3,decodedPackets:1});expect(r.anchors).toHaveLength(3);expect(r.authority.orderedState).toBe('not_evaluated');
});
test('chunk cap is refused before ownership and shared/subclass storage never admitted',()=>{
 const s=createD0StructuralStudy(65537,D0_POLICY);s.feed(new Uint8Array(65537));expect(s.finish()).toMatchObject({status:'unavailable',inputRef:{bytes:0},diagnostics:[{code:'chunk-capacity'}]});
 for(const bytes of [new(class extends Uint8Array{})(2),new Uint8Array(new SharedArrayBuffer(2))]){const f=createD0StructuralStudy(2,D0_POLICY);f.feed(bytes);expect(f.finish().status).toBe('unavailable');}
});
test('feed capacity includes zero progress and cannot renew on failure',()=>{
 const s=createD0StructuralStudy(0,D0_POLICY);for(let i=0;i<4097;i++)s.feed(new Uint8Array());expect(()=>s.feed(new Uint8Array())).toThrow('stream-closed');expect(s.finish()).toMatchObject({status:'unavailable',feedCalls:4096,diagnostics:[{code:'read-capacity'}]});expect(()=>s.finish()).toThrow('stream-closed');
});
test('complete maximal packet population hashes whole manifest and retains only128 anchors',()=>{
 const s=createD0StructuralStudy(262144,D0_POLICY),b=new Uint8Array(65536);for(let i=0;i<b.length;i+=2)b[i]=10;
 for(let i=0;i<4;i++)s.feed(b);const r=s.finish();expect(r).toMatchObject({status:'structural-study',packets:131072,decodedPackets:131072,anchorsOmitted:130944});expect(r.anchors).toHaveLength(128);expect(encodeD0Result(r).length).toBeLessThan(262144);
});
test('exact JSON escaped byte ceiling is checked before serialization',()=>{
 const text='\0'.repeat(43689)+'a',v={v:text};expect(encodeD0Result(v).length).toBe(262144);expect(()=>encodeD0Result({v:text+'a'})).toThrow('result-capacity');
 for(const v of ['\t\n\b\r\f','é😀\ud800',String(D0_LIMITS.bytes)])expect(new TextDecoder().decode(encodeD0Result({v}))).toBe(JSON.stringify({v})+'\n');
});
test('snapshot manifest and spans do not depend on supported partitions',()=>{
 const b=Uint8Array.of(10,2,8,1,10,0);const one=createD0StructuralStudy(6,D0_POLICY);one.feed(b);const r=one.finish();
 for(let at=0;at<=b.length;at++){const s=createD0StructuralStudy(6,D0_POLICY);s.feed(b.subarray(0,at));s.feed(b.subarray(at));const q=s.finish();expect(q.manifestSHA256).toBe(r.manifestSHA256);expect(q.anchors).toEqual(r.anchors);expect(q.inputRef).toEqual(r.inputRef);}
});
function feed(s:ReturnType<typeof createD0StructuralStudy>,b:Uint8Array){for(let i=0;i<b.length;i+=65536)s.feed(b.subarray(i,i+65536));}
test('whole32MiB fixed profile reaches complete boundary without retaining raw input',()=>{
 const packet=body(1,body(100,new Uint8Array(262135)));expect(packet.length).toBe(262144);
 const s=createD0StructuralStudy(33554432,D0_POLICY);for(let i=0;i<128;i++)feed(s,packet);
 const r=s.finish();expect(r).toMatchObject({status:'structural-study',packets:128,feedCalls:512,inputRef:{bytes:33554432}});expect(r.anchors).toHaveLength(128);expect(()=>createD0StructuralStudy(33554433,D0_POLICY)).toThrow('byte-capacity');
});
test('aggregate occurrence exact limit plus crossing packet is paid once then projection stops',()=>{
 const bytes=new Uint8Array(32768*3);for(let i=0;i<bytes.length;i+=3)bytes.set([192,12,0],i);
 const packet=body(1,bytes),s=createD0StructuralStudy(packet.length*33+2,D0_POLICY);
 for(let i=0;i<33;i++)feed(s,packet);s.feed(Uint8Array.of(10,0));const r=s.finish();
 expect(r).toMatchObject({status:'unavailable',framingBoundaryComplete:true,packets:34,decodedPackets:33,occurrences:1048576,packetProjection:'unavailable',diagnostics:[{code:'aggregate-projection-capacity',frameIndex:32}]});
});
test('terminal failed independent payload member budget is not retried on following packets',()=>{
 const b=join(body(1,body(11,body(1052,body(8,new Uint8Array(16385))))),Uint8Array.of(10,0));
 const s=createD0StructuralStudy(b.length,D0_POLICY);feed(s,b);expect(s.finish()).toMatchObject({framingBoundaryComplete:true,packets:2,decodedPackets:1,packetProjection:'unavailable'});
});
test('packet count plus1 cannot certify a prefix',()=>{
 const b=new Uint8Array(65536);for(let i=0;i<b.length;i+=2)b[i]=10;
 const s=createD0StructuralStudy(262146,D0_POLICY);for(let i=0;i<4;i++)s.feed(b);s.feed(Uint8Array.of(10,0));
 expect(s.finish()).toMatchObject({status:'unavailable',framingBoundaryComplete:false,packets:131072,diagnostics:[{code:'frame-capacity'}]});
});
test('member aggregate plus1 uses existing decoder and stops after first crossing packet',()=>{
 const packet=body(1,body(11,body(1052,body(8,new Uint8Array(16384))))),s=createD0StructuralStudy(packet.length*33+2,D0_POLICY);
 for(let i=0;i<33;i++)feed(s,packet);s.feed(Uint8Array.of(10,0));expect(s.finish()).toMatchObject({framingBoundaryComplete:true,packets:34,decodedPackets:33,members:524288,packetProjection:'unavailable'});
});
test('packet body exact cap is distinct from cap plus1',()=>{
 for(const n of [262144,262145]){const b=body(1,new Uint8Array(n)),s=createD0StructuralStudy(b.length,D0_POLICY);feed(s,b);const r=s.finish();expect(r.framingBoundaryComplete).toBe(n===262144);if(n>262144)expect(r.diagnostics[0]?.code).toBe('packet-body-capacity');}
});
test('simultaneous complete numeric and finite diagnostic whole witness remains bounded',()=>{
 const s=createD0StructuralStudy(0,D0_POLICY),r=s.finish(),anchor={frameIndex:131072,keyStart:33554432,keyEnd:33554432,lengthStart:33554432,lengthEnd:33554432,bodyStart:33554432,bodyEnd:33554432,bodyBytes:262144,bodySHA256:'f'.repeat(64)};
 const max={...r,status:'unavailable',inputRef:{bytes:33554432,sha256:'f'.repeat(64)},packets:131072,decodedPackets:131072,occurrences:1048576,members:524288,feedCalls:4096,anchors:Array.from({length:128},()=>({...anchor})),anchorsOmitted:130944,diagnostics:Array.from({length:32},()=>({code:'x'.repeat(64),frameIndex:131072}))};
 const owned={policy:D0_POLICY,status:'unavailable',reason:'x'.repeat(64),fullInputVerified:false,structuralContainerEOF:false,reader:{kind:'source-owned-persisted-file',EOF:false,closed:false,identityMatch:false,hashMatch:false,reads:4096,bytes:33554433,sha256:'f'.repeat(64),before:Array(7).fill('9'.repeat(64)),after:Array(7).fill('9'.repeat(64))},study:{...max,packetProjection:'unavailable'},authority:r.authority};
 const studyBytes=encodeD0Result(max).length,ownedBytes=encodeD0Result(owned).length;
 expect(studyBytes).toBeLessThan(262144);expect(ownedBytes).toBeLessThan(262144);
 const success={...max,status:'structural-study',diagnostics:[]},ownedSuccess={...owned,status:'complete-structural-diagnostic',reason:null,fullInputVerified:true,structuralContainerEOF:true,study:success};
 function shape(value:unknown){let nodes=0,records=0,strings=0;function walk(v:unknown){nodes++;if(typeof v==='string')strings+=Buffer.byteLength(v);else if(v&&typeof v==='object'){records++;if(Array.isArray(v))v.forEach(walk);else for(const[k,x]of Object.entries(v)){strings+=Buffer.byteLength(k);walk(x);}}}walk(value);return{nodes,records,strings};}
 const studyShape=shape(max),ownedShape=shape(owned),combined={nodes:studyShape.nodes+ownedShape.nodes,records:studyShape.records+ownedShape.records,strings:studyShape.strings+ownedShape.strings};
 expect(combined.nodes).toBeLessThanOrEqual(4096);expect(combined.records).toBeLessThanOrEqual(512);expect(combined.strings).toBeLessThanOrEqual(49152);
 console.log('D0 whole output witnesses '+JSON.stringify({studyBytes,ownedBytes,studySuccessBytes:encodeD0Result(success).length,ownedSuccessBytes:encodeD0Result(ownedSuccess).length,studyShape,ownedShape,combined,numericMax:33554433,anchors:128,diagnostics:32,escapedExactBytes:encodeD0Result({v:'\0'.repeat(43689)+'a'}).length}));
});
test('private result node and object guards fit the closed output inside wider profile maxima',()=>{
 expect(encodeD0Result(Array(4095).fill(null)).length).toBeGreaterThan(0);expect(()=>encodeD0Result(Array(4096).fill(null))).toThrow('result-capacity');
 expect(encodeD0Result(Array.from({length:255},()=>({}))).length).toBeGreaterThan(0);expect(()=>encodeD0Result(Array.from({length:256},()=>({})))).toThrow('result-capacity');
});
test('detached storage and hostile thrown values never escape as diagnostic authority',()=>{
 const bytes=Uint8Array.of(10,0);structuredClone(bytes.buffer,{transfer:[bytes.buffer]});const a=createD0StructuralStudy(2,D0_POLICY);a.feed(bytes);expect(a.finish().status).toBe('unavailable');
 const thrown=new Proxy({},{getPrototypeOf(){throw Error('secret-caller-error');}}),input=new Proxy(Uint8Array.of(10,0),{getPrototypeOf(){throw thrown;}}),b=createD0StructuralStudy(2,D0_POLICY);b.feed(input);expect(b.finish()).toMatchObject({status:'unavailable',diagnostics:[{code:'unsupported-byte-view'}]});
});
test('result validation never invokes accessors or caller toJSON hooks',()=>{
 let calls=0;expect(()=>encodeD0Result({get x(){calls++;return 1;}})).toThrow('result-shape');expect(()=>encodeD0Result({toJSON(){calls++;return {};}})).toThrow('result-shape');expect(calls).toBe(0);
});
test('D0 late invalid wrapper never admits earlier positive packet prefix',()=>{
 const s=createD0StructuralStudy(4,D0_POLICY);s.feed(Uint8Array.of(10,0,18,0));
 expect(s.finish()).toMatchObject({status:'unavailable',framingBoundaryComplete:false,structuralContainerEOF:false});
});
