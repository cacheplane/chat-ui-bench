import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {body,join,text,uint} from '../../packages/analyzer/src/browser-frame-packet-fragments.test-helper.ts';
import {readWholeUserTimingTraceV6} from '../../packages/analyzer/dist/browser-frame-whole-trace-reader.js';
const api=await import('./request-window-phase-v2.mjs').catch(()=>({}));
const policy='source-owned-request-window-phase-inventory-diagnostic-v2';
const selection={runId:'native-request-window-v1',phaseId:'history100-up',targetId:'target-a',start:'native:native-request-window-v1:history100-up:start:'+('a'.repeat(16)),end:'native:native-request-window-v1:history100-up:end:'+('b'.repeat(16))};
const packet=(sequence,...parts)=>join(uint(10,BigInt(sequence)),...parts);
const stream=packets=>join(...packets.map(p=>body(1,p)));
const descriptor=uuid=>packet(8,body(60,join(uint(1,BigInt(uuid)),body(3,join(uint(1,20n),uint(7,99n))))));
const mark=(name,time=10000000000n,...extras)=>packet(7,uint(8,time),uint(58,3n),body(11,join(uint(9,3n),text(22,'blink.user_timing'),text(23,name),...extras)));
function fixture(){return [packet(7,uint(13,1n),body(59,join(uint(58,3n),body(11,uint(11,100n))))),descriptor(100),mark(selection.start),mark(selection.end,12000000000n)];}
function owned(packets,run){const root=fs.realpathSync(fs.mkdtempSync(os.tmpdir()+'/request-phase-v2-')),path=root+'/authored.bin',bytes=stream(packets);fs.writeFileSync(path,bytes);const s=fs.statSync(path),fact={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),identity:{dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs}};try{return run(fact,path);}finally{fs.rmSync(root,{recursive:true,force:true});}}
function read(fact,names=selection){assert.equal(typeof api.readRequestWindowPhaseV2,'function');return api.readRequestWindowPhaseV2(fact,names);}
test('actual V12 original reader yields frozen bounded two-mark diagnostic with exact five-domain commitments',()=>owned(fixture(),fact=>{
 const r=read(fact);assert.equal(r.policy,policy);assert.equal(r.status,'phase-registry-inventory-diagnostic');assert.equal(r.readerPolicy,'private-owned-whole-ordered-paint-r-v12');assert.equal(r.reason,null);assert.equal(r.wholeInputFailure,null);
 assert.deepEqual(r.rows.map(x=>[x.phase,x.name,x.packetIndex,x.rawTimestamp]),[['start',selection.start,2,'10000000000'],['end',selection.end,3,'12000000000']]);
 assert.equal(r.input.sha256,fact.sha256);assert.equal(r.manifests.domain,'owned-paint-clock-layout-v12');assert.equal(Object.keys(r.manifests).length,6);assert.equal(r.counters.packets,r.counters.processedPackets);assert.equal(r.counters.candidates,2);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<=8192);function frozen(v){if(v&&typeof v==='object'){assert.ok(Object.isFrozen(v));for(const x of Object.values(v))frozen(x);}}frozen(r);assert.equal(r.authority.FPS,null);assert.equal(r.authority.nativeSupported,false);
}));
test('explicit V12 processes129distinct descriptors while unchanged V6 still refuses128 capacity',()=>{
 const p=fixture();p.splice(2,0,...Array.from({length:128},(_,i)=>descriptor(200+i)));
 return owned(p,fact=>{const old=readWholeUserTimingTraceV6({path:fact.path,bytes:fact.bytes,sha256:fact.sha256},'pinned-whole-trace-user-timing-marks-diagnostic-v6');assert.equal(old.study.reason,'disclosure-capacity');const r=read(fact);assert.equal(r.status,'phase-registry-inventory-diagnostic');assert.equal(r.counters.disclosures,129);assert.equal(r.counters.processedPackets,p.length);});
});
for(const [name,mutate,reason]of [
 ['duplicate start',p=>p.push(mark(selection.start)), 'duplicate-start'],
 ['duplicate end',p=>p.push(mark(selection.end)), 'duplicate-end'],
 ['missing start',p=>p.splice(2,1),'missing-start'],
 ['missing end',p=>p.pop(),'missing-end'],
 ['foreign prefix',p=>p.push(mark(selection.start.slice(0,-16)+'c'.repeat(16))),'foreign-selected-prefix'],
 ['reverse packet order',p=>{[p[2],p[3]]=[p[3],p[2]];},'wire-order-unavailable'],
 ['late unexplained drop',p=>p.push(packet(7,uint(42,1n))),'state-loss-observed'],
 ['late contradictory first',p=>p.push(packet(7,uint(87,1n))),'whole-input-unavailable'],
 ['late unsupported field',p=>p.push(packet(7,body(50,new Uint8Array()))),'whole-input-unavailable'],
 ['late duplicate scalar',p=>p.push(packet(7,uint(8,1n),uint(8,2n))),'whole-input-unavailable'],
 // V12's separately fixed candidateUTF8 budget can refuse before its256 row cap
 // and before our downstream128 check. Preserve that genuine earlier refusal.
 ['129 candidate input reaches genuine V12 retained-string refusal',p=>p.push(...Array.from({length:127},(_,i)=>mark('outside-'+i))),'whole-input-unavailable'],
 ])test('refuses '+name+' without any partial rows',()=>{const p=fixture();mutate(p);owned(p,fact=>{const r=read(fact);assert.equal(r.status,'unavailable');assert.equal(r.reason,reason);assert.deepEqual(r.rows,[]);assert.equal(r.authority.FPS,null);assert.ok(Object.isFrozen(r));});});
test('unrelated withheld annotation root globally refuses even with exact selected marks',()=>{
 const p=fixture();p.push(packet(7,body(11,join(uint(9,3n),text(22,'other'),text(23,'outside'),body(4,join(uint(1,99n),text(6,'opaque')))))));
 owned(p,fact=>{const r=read(fact);assert.equal(r.status,'unavailable');assert.equal(r.reason,'root-inventory-withheld');});
});
test('explained first initialization is allowed, including nonzero losses counter',()=>{
 for(const clear of [true,false]){const p=fixture();p[0]=packet(7,...(clear?[uint(13,1n)]:[]),uint(42,1n),uint(87,1n),body(59,join(uint(58,3n),body(11,uint(11,100n)))));
  owned(p,fact=>{const r=read(fact);assert.equal(r.status,'phase-registry-inventory-diagnostic');if(!clear)assert.equal(r.rows[0].trackSource,'unavailable');});
 }
});
test('strict inert inputs refuse proxies/getters and malformed owner names before filesystem activity',()=>{
 let traps=0;const proxy=new Proxy({},{ownKeys(){traps++;throw Error('trap');},getOwnPropertyDescriptor(){traps++;throw Error('trap');}}),getter={};Object.defineProperty(getter,'path',{get(){traps++;throw Error('getter');}});
 for(const value of [proxy,getter,null,{}])assert.equal(read(value).status,'unavailable');assert.equal(traps,0);
 owned(fixture(),fact=>{for(const names of [proxy,{...selection,start:selection.end},{...selection,extra:true}])assert.equal(read(fact,names).status,'unavailable');assert.equal(traps,0);});
});
test('original expected bytes/hash/identity, replacement inode and hardlinks refuse atomically',()=>owned(fixture(),(fact,path)=>{
 for(const value of [{...fact,bytes:fact.bytes-1},{...fact,sha256:'0'.repeat(64)},{...fact,identity:{...fact.identity,ino:fact.identity.ino+1}}])assert.equal(read(value).status,'unavailable');
 const bytes=fs.readFileSync(path);fs.writeFileSync(path+'.replacement',bytes);fs.renameSync(path+'.replacement',path);assert.equal(read(fact).status,'unavailable');
 const s=fs.statSync(path),next={...fact,identity:{dev:s.dev,ino:s.ino,size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs}};fs.linkSync(path,path+'.link');assert.equal(read(next).status,'unavailable');
}));
test('one actual V12 pass and original wrapper close are mandatory',()=>owned(fixture(),fact=>{
 const open=fs.openSync,close=fs.closeSync;let opens=0,closes=0;
 fs.openSync=function(...args){opens++;return Reflect.apply(open,fs,args);};fs.closeSync=function(...args){closes++;Reflect.apply(close,fs,args);if(closes===2)throw Error('authored original wrapper close refusal');};
 try{const r=read(fact);assert.equal(opens,2);assert.equal(closes,2);assert.equal(r.status,'unavailable');assert.equal(r.reason,'file-identity-unavailable');}finally{fs.openSync=open;fs.closeSync=close;}
}));
for(const annotation of [false,true])test(`common V6/V12 translated rows agree for ${annotation?'interned annotation':'interned event name'} with restored defaults across reset`,()=>{
 const def=(table,iid,name)=>body(table,join(uint(1,BigInt(iid)),text(2,name)));
 const defaults=()=>body(59,join(uint(58,3n),body(11,uint(11,100n))));
 const state=name=>packet(7,uint(13,1n),defaults(),body(12,join(def(1,1,'blink.user_timing'),def(2,1,annotation?'performance.mark':name),def(3,1,'markName'))));
 const event=(name,timestamp)=>packet(7,uint(8,timestamp),body(11,join(uint(9,3n),uint(3,1n),uint(10,1n),...(annotation?[body(4,join(uint(1,1n),text(6,name)))]:[]))));
 const p=[state(selection.start),event(selection.start,10000000000n),state(selection.end),event(selection.end,12000000000n)];
 owned(p,fact=>{const legacy=readWholeUserTimingTraceV6({path:fact.path,bytes:fact.bytes,sha256:fact.sha256},'pinned-whole-trace-user-timing-marks-diagnostic-v6');assert.equal(legacy.status,'complete-whole-annotation-diagnostic');const current=read(fact);assert.equal(current.status,'phase-registry-inventory-diagnostic');
  assert.deepEqual(current.rows.map(r=>r.intervalVersion),[1,2]);assert.deepEqual(current.rows.map(r=>r.clockSource),['defaults','defaults']);assert.deepEqual(current.rows.map(r=>r.nameSource),['intern','intern']);
  for(let i=0;i<2;i++){const r=current.rows[i],old=legacy.study.candidates[i];assert.equal(r.name,old.value);for(const key of Object.keys(r))if(!['phase','name'].includes(key))assert.deepEqual(r[key],old[key],key);}
 });
});
test('complete authored60000packet input preserves full physical and semantic processing with compact phase output',()=>{
 const count=60000,p=fixture();p.splice(2,0,...Array.from({length:count-p.length},()=>new Uint8Array()));
 owned(p,fact=>{const r=read(fact);assert.equal(r.status,'phase-registry-inventory-diagnostic');assert.equal(r.counters.packets,count);assert.equal(r.counters.decodedPackets,count);assert.equal(r.counters.processedPackets,count);assert.equal(r.rows[0].packetIndex,count-2);assert.ok(Buffer.byteLength(JSON.stringify(r))<=8192);});
});
for(const count of [4096,4097])test(`genuine fixed V12 disclosure boundary ${count} retains original capacity semantics`,()=>{
 const p=fixture();p.splice(2,0,...Array.from({length:count-1},(_,i)=>descriptor(200+i)));
 owned(p,fact=>{const r=read(fact);if(count===4096){assert.equal(r.status,'phase-registry-inventory-diagnostic');assert.equal(r.counters.disclosures,4096);assert.equal(r.counters.metadataFacts,4096);assert.equal(r.counters.processedPackets,p.length);}else{assert.equal(r.status,'unavailable');assert.equal(r.reason,'whole-input-unavailable');assert.equal(r.wholeInputFailure.reason,'capacity-disclosures');assert.deepEqual(r.rows,[]);}});
});
