import assert from 'node:assert/strict';import{test}from'node:test';
import{formatRange,formatEvent,createCapture,prepareGap}from'./preparation.mjs';
import fs from'node:fs';import{createHash}from'node:crypto';
import{readFixedSource,extractKernelSource,sourceRegistry}from'./source-inputs.mjs';
import{main,toolFiles}from'./run.mjs';
import{createRequire}from'node:module';
const {parseAst}=createRequire(import.meta.url)('rolldown/parseAst');
const currentText=fs.readFileSync(new URL('preparation.mjs',import.meta.url),'utf8');
const oldPredicate="if(state.some(x=>!(x&2)&&!(x&16)))",newPredicate="if(state.some(x=>!(x&2)&&((x&1)||!(x&16))))";
assert.equal(currentText.split(newPredicate).length,2);
const heldText=currentText.replace(newPredicate,oldPredicate).replace("from './kernel.mjs'",'from '+JSON.stringify(new URL('kernel.mjs',import.meta.url).href));
const {prepareGap:heldPrepareGap}=await import('data:text/javascript;base64,'+Buffer.from(heldText).toString('base64'));
const indices=Array.from({length:100},(_,i)=>i),keys=indices.map(i=>'history-'+i);
test('portable fixed source resolver returns exact installed core and reproducible original kernel',()=>{
 const source=readFixedSource('core');assert.equal(typeof source,'string');assert.equal(createHash('sha256').update(source).digest('hex'),'06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09');assert.equal(createHash('sha256').update(extractKernelSource()).digest('hex'),'5a1fa22deb4e13919dee14e0652a1f556b0697b4683134f18c2d776af3289672');
});
test('portable runner rejects browser/live/source override arguments before output',()=>{
 for(const args of [[],['--browser'],['--test','--out','relative'],['--test','--out','/never-created','--source','override']])assert.throws(()=>main(args),/source-only-arguments/);
});
function runnerSubject(postSnapshot,childStatus=0){
 const text=fs.readFileSync(new URL('run.mjs',import.meta.url),'utf8'),ast=parseAst(text,{},'run.mjs');
 const node=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='main').declaration;
 const factory=Function('process','preflight','snapshot','fs','spawnSync','resolve','isAbsolute','here','sourceRoot','sha','writeExclusive','console','return ('+text.slice(node.start,node.end)+');');
 const writes=new Map(),logs=[],stdout=Buffer.from('completed child stdout\n'),stderr=Buffer.from('completed child stderr\n');let snapshots=0,children=0;
 const before=[{path:'owned-source',bytes:1,sha256:'fixed',stat7:['1','2','3','1','1','4','5']}];
 const subject=factory({versions:{node:'24.20.0'},execPath:'/trusted/node',platform:'test',arch:'test'},()=>{},()=>++snapshots===1?before:postSnapshot(before),{mkdirSync:()=>{}},()=>{children++;return{stdout,stderr,status:childStatus,signal:null};},(...parts)=>parts.join('/').replaceAll('//','/'),p=>p.startsWith('/'),'/owned/tools','/owned',raw=>createHash('sha256').update(raw).digest('hex'),(path,raw)=>{assert.equal(writes.has(path),false);writes.set(path,Buffer.from(raw));},{log:value=>logs.push(value)});
 return{subject,writes,logs,stdout,stderr,counts:()=>({snapshots,children})};
}
for(const fault of ['missing','unreadable','identity'])test('portable runner retains completed streams and unavailable receipt after '+fault+' post-child source verification',()=>{
 const sentinel=Error('controlled-private-'+fault),p=runnerSubject(()=>{throw sentinel;});let failure;
 try{p.subject(['--test','--out','/controlled-output']);}catch(error){failure=error;}
 assert.ok(p.writes.has('/controlled-output/stdout'),'completed stdout must be retained after source failure');
 assert.deepEqual(p.writes.get('/controlled-output/stdout'),p.stdout);assert.deepEqual(p.writes.get('/controlled-output/stderr'),p.stderr);
 const receipt=JSON.parse(p.writes.get('/controlled-output/receipt.json').toString());
 assert.equal(receipt.status,'unavailable');assert.equal(receipt.sourceStable,false);assert.equal(receipt.sourceVerificationError,'post-child-source-verification-failed');assert.equal(receipt.exit,0);
 assert.equal(receipt.stdout.sha256,createHash('sha256').update(p.stdout).digest('hex'));assert.equal(receipt.stderr.sha256,createHash('sha256').update(p.stderr).digest('hex'));
 assert.equal(receipt.directWait,true);assert.equal(receipt.pipeEOF,true);assert.deepEqual(p.counts(),{snapshots:2,children:1});assert.equal(p.logs.length,0);
 assert.match(failure.message,/^source-controls-refused$/);assert.equal(JSON.stringify(receipt).includes('controlled-private-'),false);
});
test('portable runner retains refusal for a changed returned source manifest',()=>{
 const p=runnerSubject(()=>[{path:'different-source'}]);assert.throws(()=>p.subject(['--test','--out','/controlled-output']),/^Error: source-controls-refused$/);
 const receipt=JSON.parse(p.writes.get('/controlled-output/receipt.json').toString());assert.equal(receipt.sourceStable,false);assert.equal(receipt.sourceVerificationError,'post-child-source-verification-failed');assert.equal(receipt.status,'unavailable');assert.deepEqual(p.writes.get('/controlled-output/stdout'),p.stdout);
});
test('portable runner never reflects or stringifies a post-child verifier exception',()=>{
 let traps=0;const sentinel=new Proxy({},{get(){traps++;throw Error('unexpected fault reflection');},getPrototypeOf(){traps++;throw Error('unexpected fault prototype');}}),p=runnerSubject(()=>{throw sentinel;});
 assert.throws(()=>p.subject(['--test','--out','/controlled-output']),/^Error: source-controls-refused$/);assert.equal(traps,0);
 const receipt=JSON.parse(p.writes.get('/controlled-output/receipt.json').toString());assert.equal(receipt.status,'unavailable');assert.equal(receipt.sourceVerificationError,'post-child-source-verification-failed');
});
test('portable runner keeps source-stable child failure unavailable',()=>{
 const p=runnerSubject(before=>before,1);assert.throws(()=>p.subject(['--test','--out','/controlled-output']),/^Error: source-controls-refused$/);
 const receipt=JSON.parse(p.writes.get('/controlled-output/receipt.json').toString());assert.equal(receipt.sourceStable,true);assert.equal(receipt.sourceVerificationError,null);assert.equal(receipt.status,'unavailable');assert.equal(receipt.exit,1);
});
test('portable runner success requires completed child and matching source manifest',()=>{
 const p=runnerSubject(before=>before),receipt=p.subject(['--test','--out','/controlled-output']);assert.equal(receipt.status,'source-only-pass');assert.equal(receipt.sourceStable,true);assert.equal(receipt.sourceVerificationError,null);assert.equal(p.logs.length,1);assert.equal(p.writes.size,3);
});
test('portable resolver refuses controlled missing and changed inputs without modifying installed sources',()=>{
 const text=fs.readFileSync(new URL('source-inputs.mjs',import.meta.url),'utf8'),ast=parseAst(text,{},'source-inputs.mjs');
 const node=ast.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='readFixedSource').declaration;
 const factory=Function('boundedRead','resolve','sourceRoot','sha','sourceRegistry','return ('+text.slice(node.start,node.end)+');');
 const digest=x=>createHash('sha256').update(x).digest('hex'),original=readFixedSource('core'),before=digest(original),missing=Error('controlled-missing');
 const absent=factory(()=>{throw missing;},(root,path)=>root+'/'+path,'fixed-root',digest,sourceRegistry);assert.throws(()=>absent('core'),e=>e===missing);
 const changed=Buffer.from(original);changed[0]^=1;const mismatch=factory(()=>changed,(root,path)=>root+'/'+path,'fixed-root',digest,sourceRegistry);assert.throws(()=>mismatch('core'),/source-pin/);
 assert.throws(()=>readFixedSource('../core'),/source-alias/);assert.throws(()=>readFixedSource('__proto__'),/source-alias/);assert.equal(digest(readFixedSource('core')),before);
});
test('portable current source census and seven-file closure preserve reviewed preparation',()=>{
 function count(n){if(!n||typeof n!=='object')return 0;let v=typeof n.type==='string'?1:0;for(const[k,x]of Object.entries(n))if(k!=='parent'){if(Array.isArray(x))for(const y of x)v+=count(y);else if(x&&typeof x==='object')v+=count(x);}return v;}
 function named(source,name){let found;function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name===name)found=n;for(const x of Object.values(n))if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')visit(x);}visit(parseAst(source,{},'source.mjs'));return found;}
 assert.equal(createHash('sha256').update(currentText).digest('hex'),'be8ed74e44185ddb812cd658b9c3eb7a40ac91d64d56c2402b0703e2ac5ac016');
 assert.equal(count(named(currentText,'prepareGap')),795);assert.equal(count(named(extractKernelSource(),'calculateRangeImpl')),271);assert.equal(count(named(extractKernelSource(),'findNearestBinarySearchFlat')),67);
 assert.equal(toolFiles.length,7);assert.equal(new Set(toolFiles).size,7);const forbidden='/'+'private'+'/tmp/';for(const name of toolFiles)assert.equal(fs.readFileSync(new URL(name,import.meta.url),'utf8').includes(forbidden),false,name);
 const profile=JSON.parse(fs.readFileSync(new URL('profile.json',import.meta.url),'utf8'));assert.equal(profile.runtimeIntegrated,false);assert.equal(profile.nativeGO,false);assert.equal(profile.reservations.chronology+profile.reservations.selector,2097152);
});
const range=()=>({q:32768,c:32768,r:32768,og:32768,cg:32768,l:20,scrollTop:1e7,clientHeight:1e7,scrollHeight:1e7,clientWidth:1e7,start:99,end:99,indices,keys});
const event=()=>({q:32768,c:32768,r:32768,og:32768,cg:32768,l:20,t:8,i:99,n:32768,v:1e7,d:1e9,z:100});
test('whole canonical range and callback witnesses fit conservative377/88 with exact doubles',()=>{
 const R=formatRange(range()),E=formatEvent(event());assert.equal(typeof R,'string');assert.equal(R.length,375);assert.equal(E.length,85);assert.ok(R.length<=377&&E.length<=88);assert.match(R,/^R\|/);assert.ok(R.endsWith('\n'));assert.match(E,/416312d000000000/);
});
test('all21 event kinds enforce their exact unused fields and primitive types',()=>{
 const z=[100,1,32768,1,1,1,1,1,100,0,1,3200,0,1,1,100,0,1,1,1,1];
 for(let t=0;t<=20;t++){
  const row=[6,7,8,9,10,12].includes(t),e={...event(),t,i:row?99:-1,n:row?32768:0,v:[8,9,18].includes(t)?1e7:t===10?-1e7:0,d:t===8?1e9:t===9?1e7:0,z:z[t]};
  assert.equal(typeof formatEvent(e),'string','kind'+t);assert.equal(formatEvent({...e,t:21}),null);assert.equal(formatEvent({...e,z:32769}),null);
  if(t!==8&&t!==9)assert.equal(formatEvent({...e,d:1}),null);if(!row)assert.equal(formatEvent({...e,n:1}),null);
 }
 assert.equal(typeof formatEvent({...event(),t:6,i:-1,n:0,v:0,d:0,z:0}),'string');
});
test('exact double representation preserves signed zero and fractions without coercion',()=>{
 for(const x of [-0,0,0.1,0.5,1e7]){const e=formatEvent({...event(),t:9,v:x,d:x,z:0});assert.equal(typeof e,'string');const hex=e.slice(2).split(',')[9];const bytes=Uint8Array.from(hex.match(/../g),h=>parseInt(h,16));assert.ok(Object.is(new DataView(bytes.buffer).getFloat64(0,false),x));}
 for(const x of [Infinity,-Infinity,NaN,undefined,null,1n,'1',new Number(1)])assert.equal(formatEvent({...event(),v:x}),null);
});
test('17th range and449th callback refuse before retention, no renewal on close',()=>{
 for(const [kind,limit,f]of[['range',16,range],['event',448,event]]){
  const c=createCapture();for(let j=1;j<=limit;j++)assert.equal(c[kind]({...f(),q:j}),true);
  const before=c.stats();let traps=0;const p=new Proxy({}, {getPrototypeOf(){traps++;throw Error('trap');}});assert.equal(c[kind](p),false);assert.equal(traps,0);assert.equal(c.stats().retained,before.retained);assert.equal(c.stats().refusal,'record-capacity');
  assert.equal(c.range({...range(),q:limit+1}),false);assert.equal(c.close().status,'unavailable');assert.equal(c.stats().retained,0);assert.equal(c.close().reason,'already-closed');
 }
});
test('invalid ordinal and missing/accessor array slots refuse once without effects',()=>{
 const c=createCapture();assert.equal(c.event({...event(),q:2}),false);assert.equal(c.stats().refusal,'ordinal');assert.equal(c.event({...event(),q:1}),false);assert.equal(c.close().reason,'ordinal');
 let calls=0;const a=[0];Object.defineProperty(a,'0',{get(){calls++;return 0;}});assert.equal(formatRange({...range(),indices:a,keys:['history-0']}),null);assert.equal(calls,0);
 for(const pair of [[[],[],0,0],[[0],['history-0'],-1,-1],[[0],['history-0'],1,0]])assert.equal(formatRange({...range(),indices:pair[0],keys:pair[1],start:pair[2],end:pair[3]}),null);
});
test('byte boundary predicate has exact49152 direction while strict grammar dominates it',()=>{
 const text=fs.readFileSync(new URL('preparation.mjs',import.meta.url),'utf8');assert.ok(text.includes('if(bytes+text.length>CAPS.bytes)'));
 const refused=Function('bytes','length','return bytes+length>49152');assert.equal(refused(49151,1),false);assert.equal(refused(49152,1),true);assert.ok(16*377+448*88<=49152);
});
test('pure selector refuses geometry/key/cache-invalid/no-cover conditions without mutation',()=>{
 const flat=indices.flatMap(i=>[i*200,200]),mask=indices.map(()=>0),base={flat,mask,keys,viewport:500,overscan:5};assert.equal(prepareGap(base).status,'prepared-structural-only');
 const badFlat=[...flat];badFlat[2]++;
 for(const bad of [{...base,flat:badFlat},{...base,keys:keys.map((k,i)=>i===1?'wrong':k)},{...base,mask:indices.map(()=>8)},{...base,viewport:0},{...base,overscan:11}])assert.equal(prepareGap(bad).reason,'invalid-input');
 assert.equal(prepareGap({...base,viewport:1,overscan:0}).reason,'coverage-gap');assert.deepEqual(mask,indices.map(()=>0));
 let calls=0;const p=new Proxy(flat,{getPrototypeOf(){calls++;throw Error('proxy');}});assert.equal(prepareGap({...base,flat:p}).reason,'invalid-input');assert.equal(calls,0);
});
test('maximal gap tie uses lowest index once; short gaps and cached-invalid entries are not gaps',()=>{
 const flat=indices.flatMap(i=>[i*200,200]),mask=indices.map(i=>i>=10&&i<=29||i>=50&&i<=69?0:3);const result=prepareGap({flat,mask,keys,viewport:500,overscan:5});assert.equal(result.status,'prepared-structural-only');assert.deepEqual(result.gap,[10,29]);
 const short=indices.map(i=>i>=10&&i<25?0:1);assert.equal(prepareGap({flat,mask:short,keys,viewport:500,overscan:5}).reason,'no-gap');
});
test('exact original range/kernel functions generate every prepared interval',()=>{
 const source=readFixedSource('core');assert.equal(createHash('sha256').update(source).digest('hex'),'06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09');
 const generated=extractKernelSource();for(const name of ['const defaultRangeExtractor =','const findNearestBinarySearch =','function findNearestBinarySearchFlat','function calculateRangeImpl'])assert.ok(generated.includes(name));
 const a=source.indexOf('const defaultRangeExtractor ='),b=source.indexOf('\nconst observeElementRect',a),c=source.indexOf('const findNearestBinarySearch ='),d=source.indexOf('\nexport {',c);assert.ok(generated.includes(source.slice(a,b)));assert.ok(generated.includes(source.slice(c,d)));
});
test('source-owned original measurement callback keeps return/getter/throw identity around prepared exit records',()=>{
 const source=readFixedSource('copilot');assert.equal(createHash('sha256').update(source).digest('hex'),'2067b06183e89b1399dbbd894f03d1c541d4f14b4cd62be717d10c01849969a6');const a=source.indexOf('const measureRowElement = React.useCallback('),b=source.indexOf('\n\tconst isPinnedToBottomRef',a);assert.ok(a>=0&&b>a);const exact=source.slice(a,b);
 function execute(record,fault){const trace=[],ref={current:{total:0,sizes:new Map()}},fn=Function('measuredRef','React',exact+';return measureRowElement;')(ref,{useCallback:f=>f});const error=Error('original');const node={getBoundingClientRect(){trace.push('rect');if(fault==='rect')throw error;return {height:288};},dataset:{get index(){trace.push('index');if(fault==='index')throw error;return '9';}}};let result,thrown;const c=createCapture();try{result=fn(node);}catch(e){thrown=e;}finally{if(record)c.event({...event(),q:1,t:7,i:9,n:1,v:0,d:0,z:thrown?0:1});}return {trace,result,thrown,error,total:ref.current.total,size:ref.current.sizes.size,closed:c.close()};}
 for(const fault of [null,'rect','index']){const before=execute(false,fault),after=execute(true,fault);assert.deepEqual(after.trace,before.trace);assert.equal(after.result,before.result);assert.equal(after.total,before.total);assert.equal(after.size,before.size);if(fault){assert.equal(before.thrown,before.error);assert.equal(after.thrown,after.error);}else assert.equal(after.result,288);assert.equal(after.closed.records,1);}
 // E08 z-after-Map.size is deliberately NOT claimed available from this original callback.
 assert.ok(!exact.includes('sizes.size'));assert.ok(exact.includes('sizes.set(index, height)'));
});
test('all fixed numeric/count slots enforce exact and one-over boundaries',()=>{
 for(const field of ['q','c','r','og','cg']){assert.equal(typeof formatRange({...range(),[field]:32768}),'string');assert.equal(formatRange({...range(),[field]:32769}),null);assert.equal(formatRange({...range(),[field]:-1}),null);}
 for(const [field,max]of[['l',20],['clientHeight',1e7],['clientWidth',1e7],['scrollHeight',1e7]]){assert.equal(typeof formatRange({...range(),[field]:max}),'string');assert.equal(formatRange({...range(),[field]:max+1}),null);assert.equal(formatRange({...range(),[field]:0.5}),null);}
 assert.equal(formatRange({...range(),indices:[...indices,99],keys:[...keys,'history-99']}),null);assert.equal(typeof formatRange({...range(),indices:[],keys:[],start:-1,end:-1}),'string');
 for(const [field,max]of[['n',32768],['d',1e9],['z',100],['i',99]]){assert.equal(typeof formatEvent({...event(),[field]:max}),'string');assert.equal(formatEvent({...event(),[field]:max+1}),null);}
 assert.equal(typeof formatEvent({...event(),t:10,d:0,v:-1e7,z:1}),'string');assert.equal(formatEvent({...event(),t:10,d:0,v:-10000001,z:1}),null);
});
test('all object layers reject counting/throwing/revoked proxies before reflection',()=>{
 for(const subject of ['record','indices','keys','flat','mask'])for(const mode of ['count','throw','revoke']){let calls=0;const trap=()=>{calls++;if(mode==='throw')throw Error('trap');return null;};const target=subject==='record'?range():subject==='flat'?indices.flatMap(i=>[i*200,200]):subject==='mask'?indices.map(()=>0):subject==='keys'?keys:indices;const p=Proxy.revocable(target,{getPrototypeOf:trap,getOwnPropertyDescriptor:trap,get:trap,ownKeys:trap});if(mode==='revoke')p.revoke();let result;if(subject==='record')result=formatRange(p.proxy);else if(subject==='indices'||subject==='keys')result=formatRange({...range(),[subject]:p.proxy});else result=prepareGap({flat:indices.flatMap(i=>[i*200,200]),mask:indices.map(()=>0),keys,viewport:500,overscan:5,[subject]:p.proxy}).reason;assert.ok(result===null||result==='invalid-input');assert.equal(calls,0);}
});
test('five source-realizable maximal gaps stay within6 candidates and24 total ranges',()=>{
 const mask=indices.map(i=>i<85&&i%17<16?0:3);const result=prepareGap({flat:indices.flatMap(i=>[i*200,200]),mask,keys,viewport:200,overscan:5});assert.equal(result.status,'prepared-structural-only');assert.deepEqual(result.gap,[0,15]);assert.equal(result.rangeCalls,22);assert.equal(result.targets.length,12);assert.equal(result.fullWarmReady,false);
});
test('unused double fields are canonical positive zero and native viewport is integer',()=>{
 assert.equal(formatEvent({...event(),t:0,i:-1,n:0,v:-0,d:0,z:100}),null);
 assert.equal(formatEvent({...event(),t:0,i:-1,n:0,v:0,d:-0,z:100}),null);
 assert.equal(prepareGap({flat:indices.flatMap(i=>[i*200,200]),mask:indices.map(()=>0),keys,viewport:500.5,overscan:5}).reason,'invalid-input');
});
test('failure close preserves bounded incomplete prefix without readiness promotion',()=>{
 const c=createCapture();const first={...event(),q:1};assert.equal(c.event(first),true);assert.equal(c.event({...event(),q:3}),false);const result=c.close();assert.equal(result.status,'unavailable');assert.equal(result.reason,'ordinal');assert.equal(result.text,formatEvent(first));assert.equal(result.complete,false);assert.equal(result.fullWarmReady,false);assert.equal(c.stats().retained,0);
});
test('cached-without-origin visits cannot count as potential first measurement coverage',()=>{
 const input={flat:indices.flatMap(i=>[i*200,200]),mask:indices.map(i=>i>=10&&i<=29?0:1),keys,viewport:500,overscan:5};
 assert.equal(heldPrepareGap(input).status,'prepared-structural-only','retained exact v1 counterexample');
 const result=prepareGap(input);assert.equal(result.status,'unavailable');assert.equal(result.reason,'coverage-gap');assert.deepEqual(input.mask,indices.map(i=>i>=10&&i<=29?0:1));assert.equal(result.fullWarmReady,false);
});
test('capture is one baseline-only join with exact16/448 admission and sticky refusal',()=>{
 const c=createCapture();let bytes=0;for(let i=0;i<16;i++){const row={...range(),q:i+1};assert.equal(c.range(row),true);bytes+=formatRange(row).length;}for(let i=0;i<448;i++){const row={...event(),q:i+17};assert.equal(c.event(row),true);bytes+=formatEvent(row).length;}
 const closed=c.close();assert.equal(closed.status,'captured-baseline-only');assert.equal(closed.records,464);assert.equal(closed.bytes,bytes);assert.equal(closed.text.length,bytes);assert.equal(c.close().reason,'already-closed');
});
test('owned formatter refuses type/coercion/accessor/proxy without effects',()=>{
 let calls=0;const bad={valueOf(){calls++;throw Error('coercion');}};assert.equal(formatRange({...range(),scrollTop:bad}),null);const g={...range()};Object.defineProperty(g,'scrollTop',{get(){calls++;throw Error('getter');}});assert.equal(formatRange(g),null);assert.equal(formatRange(new Proxy(range(),{getPrototypeOf(){calls++;throw Error('proxy');}})),null);assert.equal(calls,0);
});
test('canonical key remapping and exact index/ID/geometry boundaries refuse',()=>{
 assert.equal(formatRange({...range(),q:32769}),null);assert.equal(formatRange({...range(),clientWidth:10000001}),null);assert.equal(formatRange({...range(),indices:[100],keys:['history-100']}),null);assert.equal(formatRange({...range(),indices:[1,0],keys:['history-1','history-0']}),null);assert.equal(formatRange({...range(),keys:keys.map((k,i)=>i===9?'x':k)}),null);assert.equal(formatEvent({...event(),v:NaN}),null);
});
test('pure selector needs a genuine cache-and-origin gap and uses original ranges',()=>{
 const flat=indices.flatMap(i=>[200*i,200]);const mask=indices.map(i=>i>=92?15:i<13||i>=56&&i<72||i>=90?3:0);const result=prepareGap({flat,mask,keys,viewport:500,overscan:5});assert.equal(result.status,'prepared-structural-only');assert.ok(result.targets.length<=12);assert.ok(result.rangeCalls<=24);assert.equal(result.fullWarmReady,false);assert.deepEqual(mask,indices.map(i=>i>=92?15:i<13||i>=56&&i<72||i>=90?3:0));
 const invalid=prepareGap({flat,mask:indices.map(()=>1),keys,viewport:500,overscan:5});assert.equal(invalid.status,'unavailable');assert.equal(invalid.reason,'no-gap');
});
