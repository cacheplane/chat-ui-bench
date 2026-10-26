import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const api=await import('./native-wheel-raw-census.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const modules=['whole-trace-reader','ordered-state','packet-fragments','protobuf-fragments','protobuf-wire','state-fragments','trace-framer','track-descriptor-fragments','track-event-fragments','whole-trace'];
const repo=path.resolve(new URL('../..',import.meta.url).pathname);
function isolatedSource(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'raw-wheel-source-'));
  const paths=['tools/perfetto-import/native-wheel-raw-census.mjs','package.json','package-lock.json','tsconfig.base.json','packages/analyzer/package.json','packages/analyzer/tsconfig.json',...modules.flatMap(n=>[`packages/analyzer/src/browser-frame-${n}.ts`,`packages/analyzer/dist/browser-frame-${n}.js`])];
  for(const name of paths){const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repo,name),target);}
  return dir;
}
const hash=b=>createHash('sha256').update(b).digest('hex');
const concat=(...parts)=>Buffer.concat(parts);
function varint(n){n=BigInt(n);const a=[];do{const b=Number(n&127n);n>>=7n;a.push(b|(n?128:0));}while(n);return Buffer.from(a);}
const uint=(n,v)=>concat(varint(BigInt(n)*8n),varint(v));
const body=(n,b)=>concat(varint(BigInt(n)*8n+2n),varint(b.length),b);
const text=(n,s)=>body(n,Buffer.from(s));
const prefix='native-wheel-witness-v1:';
const marker=prefix+'00000000000000000000000000000000:0:1';
const packet=(...parts)=>concat(uint(10,6),...parts);
const descriptor=(pid=20,tid=21)=>body(60,concat(uint(1,100),uint(5,200),body(4,concat(uint(1,pid),uint(2,tid)))));
const parent=(pid=20)=>body(60,concat(uint(1,200),body(3,concat(uint(1,pid),uint(7,900)))));
const entry=(table,iid,value)=>body(table,concat(uint(1,iid),text(2,value)));
const event=(name=marker,type=3,extra=Buffer.alloc(0))=>body(11,concat(uint(9,type),uint(12,0),uint(3,2),text(23,name),body(4,concat(text(10,'data'),text(6,'source-owned'))),extra));
function fixture(){return[
  packet(uint(13,1),uint(87,1),uint(42,1),body(59,concat(uint(58,3),body(11,uint(11,100)))),body(12,entry(1,2,'blink.user_timing'))),
  packet(descriptor()),packet(parent()),packet(uint(8,1000),uint(58,3),event()),
  packet(descriptor()),packet(parent()),body(72,Buffer.alloc(0)),body(51,Buffer.alloc(0)),body(5,body(2,text(1,'metadata'))),
];}
function file(packets){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'raw-wheel-census-')),p=path.join(dir,'trace.pftrace'),bytes=concat(...packets.map(p=>body(1,p)));fs.writeFileSync(p,bytes);return{dir,ref:{path:p,bytes:bytes.length,sha256:hash(bytes)}};}
async function run(packets){assert.equal(typeof api.inspectNativeWheelRawCensusV1,'function');const f=file(packets);try{return await api.inspectNativeWheelRawCensusV1(f.ref);}finally{fs.rmSync(f.dir,{recursive:true,force:true});}}
function authority(r){assert.equal(r.kind,'native-wheel-raw-census-v1');assert.equal(r.diagnosticOnly,true);assert.equal(r.association,'not_evaluated');for(const key of ['nativeSupported','qualification','evaluationEligibility','scoringEligibility','rankingEligibility','fpsEligibility'])assert.equal(r[key],false,key);assert.equal(r.FPS,null);assert.equal(r.originalExecution,'not_evaluated');assert.equal(r.importerAdmission,'not_evaluated');}
function refused(r,reason){authority(r);assert.equal(r.status,'unavailable');assert.equal(r.witness,null);assert.equal(r.descriptors,null);assert.equal(r.census,null);if(reason)assert.equal(r.reason,reason);}

test('raw wheel helper exposes one fixed structural diagnostic API',()=>{assert.equal(typeof api.inspectNativeWheelRawCensusV1,'function');assert.deepEqual(Object.keys(api),['inspectNativeWheelRawCensusV1']);});
test('raw wheel helper closes the actual authored file, resolves defaults and preserves descriptor multiplicity',async()=>{
  const r=await run(fixture());authority(r);assert.equal(r.status,'complete-native-wheel-raw-census-diagnostic',r.reason);assert.equal(r.reason,null);
  assert.equal(r.census.literalPrefixEvents,1);assert.equal(r.census.prefixedDefinitions,0);assert.equal(r.census.filteredLiterals,0);assert.equal(r.census.filteredDefinitions,0);
  assert.equal(r.witness.name,marker);assert.equal(r.witness.packetIndex,3);assert.equal(r.witness.type,'3');assert.equal(r.witness.candidate.trackUuid,'100');assert.equal(r.witness.candidate.trackSource,'defaults');
  assert.deepEqual(r.descriptors.thread.fields,{uuid:'100',parentUuid:'200',thread:{pid:'20',tid:'21'}});assert.equal(r.descriptors.thread.occurrences.length,2);assert.equal(r.descriptors.process.occurrences.length,2);
  assert.equal(r.reader.EOF,true);assert.equal(r.reader.closed,true);assert.equal(r.reader.identityMatch,true);assert.equal(r.reader.hashMatch,true);assert.equal(r.sourceBookends.stable,true);
});
test('raw wheel census counts every literal prefix rather than just successful mark candidates',async()=>{
  for(const type of [1,2,3,4]){const p=fixture();p.push(packet(uint(8,1001),uint(58,3),event(prefix+'ffffffffffffffffffffffffffffffff:0:268435456',type)));refused(await run(p));}
  for(const type of [1,2,4]){const p=fixture();p[3]=packet(uint(8,1000),uint(58,3),event(marker,type));refused(await run(p));}
});
test('raw wheel census refuses inactive definitions and filtered source branches anywhere',async()=>{
  for(const name of [marker,'performance.mark','performance.measure']){const p=fixture();p.push(packet(body(12,entry(2,300,name))));refused(await run(p),'name-inventory-unavailable');}
  for(const name of ['performance.mark','performance.measure']){const p=fixture();p.push(packet(uint(8,1001),uint(58,3),event(name)));refused(await run(p));}
  for(const name of ['performance.mark','performance.measure']){const p=fixture();p.push(packet(uint(8,1001),uint(58,3),body(11,concat(uint(9,3),text(22,'cc'),text(23,name)))));refused(await run(p),'name-inventory-unavailable');}
});
test('resolved categories and initialized default identities cannot be supplied by marker spelling',async()=>{
  for(const initial of [
    packet(uint(13,1),body(59,concat(uint(58,3),body(11,uint(11,100)))),body(12,entry(1,2,'cc'))),
    packet(uint(13,1),body(59,uint(58,3)),body(12,entry(1,2,'blink.user_timing'))),
    packet(uint(13,1),body(59,concat(uint(58,3),body(11,uint(11,0)))),body(12,entry(1,2,'blink.user_timing'))),
    packet(body(59,concat(uint(58,3),body(11,uint(11,100)))),body(12,entry(1,2,'blink.user_timing'))),
  ]){const p=fixture();p[0]=initial;refused(await run(p));}
  const p=fixture();p[3]=packet(uint(8,1000),uint(58,0),event());const r=await run(p);assert.equal(r.status,'complete-native-wheel-raw-census-diagnostic',r.reason);assert.equal(r.witness.headers[58],'0');assert.equal(r.witness.candidate.clockSource,'defaults');
});
test('raw wheel helper refuses alternate packet carriers even after an otherwise valid witness',async()=>{
  for(const n of [82,125,50,133,107,98,999]){const p=fixture();p.push(body(n,Buffer.alloc(0)));refused(await run(p));}
  for(const n of [51,72]){const p=fixture();p.push(body(n,text(1,'nonempty')));refused(await run(p),'unsupported-packet-profile');}
  for(const n of [1,3,4,5,999]){const p=fixture();p.push(body(5,body(n,Buffer.alloc(0))));refused(await run(p),'unsupported-packet-profile');}
});
test('raw witness shape never aliases explicit, extended, absent-type or malformed literal events',async()=>{
  for(const extra of [uint(11,100),uint(47,17),body(1000,Buffer.alloc(0))]){const p=fixture();p[3]=packet(uint(8,1000),uint(58,3),event(marker,3,extra));refused(await run(p),'witness-shape-unavailable');}
  for(const name of [prefix+'00000000000000000000000000000000:0:2',prefix+'00000000000000000000000000000000:1:1',prefix+'bad']){const p=fixture();p[3]=packet(uint(8,1000),uint(58,3),event(name));refused(await run(p),'witness-shape-unavailable');}
  const p=fixture();p[3]=packet(uint(8,1000),uint(58,3),body(11,concat(uint(12,0),uint(3,2),text(23,marker),body(4,concat(text(10,'data'),text(6,'x'))))));refused(await run(p));
});
test('raw witness rejects missing prior descriptors and every later conflicting identity',async()=>{
  for(const mutate of [p=>p.splice(1,1),p=>p.splice(2,1),p=>p.push(packet(descriptor(20,22))),p=>p.push(packet(parent(30))),p=>p.push(packet(body(60,concat(uint(1,200),body(3,uint(1,20))))))]){const p=fixture();mutate(p);refused(await run(p),'descriptor-unavailable');}
});
test('raw helper withdraws anchors on later malformed framing, state or selected strings',async()=>{
  for(const extra of [Buffer.from([0]),body(11,Buffer.from([0])),packet(uint(42,1)),packet(body(12,body(2,concat(uint(1,333),body(2,Buffer.from([0xff]))))))]){const p=fixture();p.push(extra);refused(await run(p));}
});
test('closed references deny accessors, proxies and extra decoding capabilities before IO',async()=>{
  assert.equal(typeof api.inspectNativeWheelRawCensusV1,'function');let calls=0;const getter={get path(){calls++;throw Error('getter');},bytes:0,sha256:'0'.repeat(64)};
  for(const ref of [getter,new Proxy({},{get(){calls++;throw Error('trap');}}),{path:'/missing',bytes:0,sha256:'0'.repeat(64),prefix:'other:'},{path:'/missing',bytes:33554433,sha256:'0'.repeat(64)}])refused(await api.inspectNativeWheelRawCensusV1(ref),'invalid-reference');
  assert.equal(calls,0);
});
test('original trace custody refuses hashes, extents, hardlinks, symlinks and FIFOs',async()=>{
  assert.equal(typeof api.inspectNativeWheelRawCensusV1,'function');const f=file(fixture());try{
    refused(await api.inspectNativeWheelRawCensusV1({...f.ref,sha256:'0'.repeat(64)}));refused(await api.inspectNativeWheelRawCensusV1({...f.ref,bytes:f.ref.bytes+1}));
    const hard=path.join(f.dir,'hard');fs.linkSync(f.ref.path,hard);refused(await api.inspectNativeWheelRawCensusV1(f.ref));fs.unlinkSync(hard);
    const soft=path.join(f.dir,'soft');fs.symlinkSync(f.ref.path,soft);refused(await api.inspectNativeWheelRawCensusV1({...f.ref,path:soft}));
    const fifo=path.join(f.dir,'fifo');execFileSync('mkfifo',[fifo]);refused(await api.inspectNativeWheelRawCensusV1({...f.ref,path:fifo,bytes:0}));
  }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('missing or stale compiled dependencies never execute after source admission fails',async()=>{
  for(const missing of [true,false]){
    const dir=isolatedSource(),f=file(fixture());
    try{
      const compiled=path.join(dir,'packages/analyzer/dist/browser-frame-ordered-state.js');
      if(missing)fs.unlinkSync(compiled);else fs.appendFileSync(compiled,'\nglobalThis.__nativeWheelCensusUnexpectedExecution = true;\n');
      globalThis.__nativeWheelCensusUnexpectedExecution=false;
      const copy=await import(pathToFileURL(path.join(dir,'tools/perfetto-import/native-wheel-raw-census.mjs')).href);
      refused(await copy.inspectNativeWheelRawCensusV1(f.ref),'dependency-unavailable');
      assert.equal(globalThis.__nativeWheelCensusUnexpectedExecution,false);
    }finally{delete globalThis.__nativeWheelCensusUnexpectedExecution;fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(f.dir,{recursive:true,force:true});}
  }
});
test('file changes after either original trace close withdraw all positive anchors',async()=>{
  for(const closeNumber of [1,2]){
    const f=file(fixture()),ino=fs.statSync(f.ref.path,{bigint:true}).ino,original=fs.closeSync;let seen=0,mutating=false;
    fs.closeSync=function(fd){let trace=false;try{trace=fs.fstatSync(fd,{bigint:true}).ino===ino;}catch{}const value=original(fd);if(trace&&!mutating&&++seen===closeNumber){mutating=true;try{fs.appendFileSync(f.ref.path,Buffer.from([0]));}finally{mutating=false;}}return value;};
    try{const r=await api.inspectNativeWheelRawCensusV1(f.ref);refused(r,'input-unavailable');assert.equal(seen,closeNumber);assert.equal(r.upstreamReader.closed,true);if(closeNumber===2)assert.equal(r.reader.closed,true);}
    finally{fs.closeSync=original;fs.rmSync(f.dir,{recursive:true,force:true});}
  }
});
test('helper source changes after V11 reading withdraw otherwise valid raw evidence',async()=>{
  const dir=isolatedSource(),f=file(fixture()),ino=fs.statSync(f.ref.path,{bigint:true}).ino,original=fs.closeSync;let changed=false;
  try{
    const copiedPath=path.join(dir,'tools/perfetto-import/native-wheel-raw-census.mjs'),copy=await import(pathToFileURL(copiedPath).href);
    fs.closeSync=function(fd){let trace=false;try{trace=fs.fstatSync(fd,{bigint:true}).ino===ino;}catch{}const value=original(fd);if(trace&&!changed){changed=true;fs.appendFileSync(copiedPath,'\n// observed mutation\n');}return value;};
    const r=await copy.inspectNativeWheelRawCensusV1(f.ref);refused(r,'source-drift');assert.equal(changed,true);assert.equal(r.reader.closed,true);
  }finally{fs.closeSync=original;fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('original trace close acknowledgments and second-pass physical EOF cannot be asserted by callers',async()=>{
  for(const closeNumber of [1,2]){
    const f=file(fixture()),ino=fs.statSync(f.ref.path,{bigint:true}).ino,original=fs.closeSync;let seen=0;
    fs.closeSync=function(fd){let trace=false;try{trace=fs.fstatSync(fd,{bigint:true}).ino===ino;}catch{}original(fd);if(trace&&++seen===closeNumber)throw Error('authored close failure');};
    try{const r=await api.inspectNativeWheelRawCensusV1(f.ref);refused(r,closeNumber===1?'v11-unavailable':'input-unavailable');assert.equal(closeNumber===1?r.upstreamReader.closed:r.reader.closed,false);}
    finally{fs.closeSync=original;fs.rmSync(f.dir,{recursive:true,force:true});}
  }
  const f=file(fixture()),open=fs.openSync,read=fs.readSync;let opens=0,secondFd=null,denied=false;
  fs.openSync=function(p,...args){const fd=open(p,...args);if(p===f.ref.path&&++opens===2)secondFd=fd;return fd;};
  fs.readSync=function(fd,...args){if(fd===secondFd&&!denied){denied=true;return 0;}return read(fd,...args);};
  try{const r=await api.inspectNativeWheelRawCensusV1(f.ref);refused(r,'input-unavailable');assert.equal(denied,true);assert.equal(r.reader.EOF,true);assert.equal(r.reader.hashMatch,false);assert.equal(r.reader.closed,true);}
  finally{fs.openSync=open;fs.readSync=read;fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('the extra raw pass spends the remaining V11 work allowance rather than renewing it',async()=>{
  const p=fixture();for(let i=0;i<16000;i++)p.push(packet(uint(8,i+1001),uint(58,3),body(11,concat(uint(9,3),text(22,'cc'),text(23,'other')))));
  const f=file(p);
  try{
    const whole=await import('../../packages/analyzer/dist/browser-frame-whole-trace-reader.js'),state=await import('../../packages/analyzer/dist/browser-frame-ordered-state.js');
    const original=whole.readWholeUserTimingTraceV11(f.ref,state.WHOLE_USER_TIMING_V11_POLICY);assert.equal(original.status,'complete-whole-annotation-diagnostic',original.reason);assert.ok(original.study.budgets.fields<=131072);
    const r=await api.inspectNativeWheelRawCensusV1(f.ref);refused(r,'work-capacity');assert.ok(r.budgets.fields<=131072);assert.ok(r.budgets.fields>original.study.budgets.fields);
  }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('persistent accounting includes the complete additional retained report as well as V11 usage',async()=>{
  const f=file(fixture());
  try{
    const whole=await import('../../packages/analyzer/dist/browser-frame-whole-trace-reader.js'),state=await import('../../packages/analyzer/dist/browser-frame-ordered-state.js');
    const initial=whole.readWholeUserTimingTraceV11(f.ref,state.WHOLE_USER_TIMING_V11_POLICY),r=await api.inspectNativeWheelRawCensusV1(f.ref);
    assert.equal(r.status,'complete-native-wheel-raw-census-diagnostic',r.reason);
    assert.ok(r.budgets.persistentUTF8-initial.study.budgets.persistentUTF8>=Buffer.byteLength(JSON.stringify(r)));
    assert.ok(r.budgets.persistentUTF8<=262144);
  }finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
