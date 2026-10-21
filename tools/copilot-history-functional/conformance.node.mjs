import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const here=new URL('.',import.meta.url);
const exists=name=>fs.existsSync(new URL(name,here));
const moduleFor=async(name,fallback)=>import(exists(name)?new URL(name,here):new URL('../copilot-module-binding/'+fallback,here));

test('functional adapter owns commit and source mapping capabilities',async()=>{
 const {adapter}=await moduleFor('adapter.mjs','adapter.mjs');
 for(const name of ['commitStart','commitSpawnedEnd','fiberStart','fiberEnd','rows','mapping','beginCleanup','endCleanup','partial'])assert.equal(typeof adapter[name],'function',name);
});
test('React transform closes the source commit before post-layout follow-up',async()=>{
 const tx=await moduleFor('instrument.mjs','instrument.mjs');const r=tx.transform('react');
 assert.ok(r.code.includes('__lhBoundary=true; __lh.commitSpawnedEnd(__lhRoot,__lhWork,true);'),'early source boundary missing');
 const start=r.code.indexOf('function flushSpawnedWork('),end=r.code.indexOf('\nfunction ',start+10),body=r.code.slice(start,end);
 assert.ok(body.indexOf('__lhBoundary=true;')<body.indexOf('injectedHook.onCommitFiberRoot'));
 assert.ok(body.includes('catch(__lhError){if(!__lhRoot||__lhBoundary)__lh.failure();throw __lhError;}'));
 assert.equal(tx.sha(tx.reverse(r)),r.sourceSha256);
});
test('seed-only teardown has a separate reversible guarded server transform',async()=>{
 assert.ok(exists('server-transform.mjs'),'seed-only server transform missing');
 const m=await import(new URL('server-transform.mjs',here));assert.equal(typeof m.transformCServer,'function');assert.equal(typeof m.reverseCServer,'function');assert.match(m.C_PREDICATE,/__CSeedSettled/);assert.match(m.C_PREDICATE,/__CForbidden/);
});
test('functional runner is inert by default and rejects an unsupported mode',async()=>{
 assert.ok(exists('run.mjs'),'functional runner missing');const m=await import(new URL('run.mjs',here));assert.equal(m.parseArgs([]).mode,'preflight');assert.throws(()=>m.parseArgs(['--retry']));assert.throws(()=>m.parseArgs(['--browser','--out','relative']));
});
test('functional app build installs observer around original launch',()=>{
 assert.ok(exists('build.mjs'),'functional build missing');const s=fs.readFileSync(new URL('build.mjs',here),'utf8');assert.match(s,/installC/);assert.match(s,/launchPage/);assert.ok(!s.includes('/private/tmp/'));
});
test('original return journal is bounded and preserves original values',async()=>{
 assert.ok(exists('returns.mjs'),'functional return retainer missing');const {returnJournal}=await import(new URL('returns.mjs',here));const j=returnJournal(),value={ok:true};assert.equal(j.capture('launch',()=>value),value);assert.throws(()=>j.capture('launch',()=>value));const r=j.seal();assert.equal(r.records[0].complete,true);assert.equal(r.records[0].sha256,createHash('sha256').update(JSON.stringify(value)).digest('hex'));
});
test('functional profile keeps compile, output and admitted-work caps separate',()=>{
 assert.ok(exists('profile.json'),'functional profile missing');const p=JSON.parse(fs.readFileSync(new URL('profile.json',here)));assert.equal(p.buildFiles,640);assert.equal(p.buildBytes,33554432);assert.equal(p.inputFiles,16384);assert.equal(p.inputBytesPerPass,67108864);assert.equal(p.sourceWork.global,67108160);assert.match(p.sourceWork.scope,/first refusal/);
});
test('public implementation contains no private provenance paths',()=>{
 assert.ok(exists('instrument.mjs'),'portable source instrument missing');for(const name of ['adapter.mjs','instrument.mjs','build.mjs','run.mjs','profile.json']){const s=fs.readFileSync(new URL(name,here),'utf8');assert.ok(!s.includes('/private/tmp/'),name);assert.ok(!s.includes('prepared-v16'),name);}
});

test('complete maximum driver view remains within unchanged original return cap',async()=>{
 const {returnJournal}=await import('./returns.mjs');const witness={diagnostic:{site:'x'.repeat(64),options:{call:64,hadOwner:false,sameOwner:false,selected:false,lanesOne:false,enabledTrue:false,initialEmpty:false}},hostReady:false,phase:'preselection',reason:'original-failure',eligible:false,fontFailed:false,counts:{scopes:12832,renders:32,commits:32,nodes:3200,writes:6400,censuses:4,exports:4,options:64,detach:6400,layoutEvents:20,work:67108864},fonts:'loading',binding:{kind:'private-live-history-emitted-singleton-v1',status:'unavailable',reason:'original-failure',bindings:['copilot','core','react','wrapper'],counts:[2,2,2,2],qualification:false,performance:false}};
 const raw=Buffer.from(JSON.stringify(witness));assert.equal(raw.length,733);const j=returnJournal();assert.equal(j.capture('observe-1',()=>witness),witness);const r=j.seal().records[0];assert.equal(r.complete,true);assert.equal(r.capturedBytes,733);assert.equal(Buffer.from(r.data,'base64').toString(),raw.toString());assert.equal(r.sha256,createHash('sha256').update(raw).digest('hex'));
});
test('original returns preserve throw identity and never invoke accessors or proxies',async()=>{const {returnJournal}=await import('./returns.mjs');let read=0;const x={get bad(){read++;throw Error('getter');}},j=returnJournal();assert.equal(j.capture('launch',()=>x),x);assert.equal(read,0);assert.equal(j.seal().records[0].outcome,'serialization-refused');const sentinel={original:true};assert.throws(()=>returnJournal().capture('launch',()=>{throw sentinel;}),e=>e===sentinel);const p=new Proxy({}, {get(){read++;throw Error('proxy');}});assert.equal(returnJournal().capture('launch',()=>p),p);assert.equal(read,0);});
test('raw return boundary refuses the first oversized byte without changing original result',async()=>{const {returnJournal}=await import('./returns.mjs');for(const size of [2046,2047]){const value='x'.repeat(size),j=returnJournal();assert.equal(j.capture('launch',()=>value),value);const r=j.seal().records[0];assert.equal(r.complete,size===2046);assert.equal(r.capturedBytes,2048);assert.equal(j.complete(),size===2046);}});
test('physical cleanup requires all original EOF/close witnesses and no forced containment',async()=>{const {CPhysicalAdmission}=await import('./driver.mjs');const good={forcedContainment:false,exit:[0,null],close:[0,null],error:false,stdout:{end:true,close:true,error:false},stderr:{end:true,close:true,error:false}};assert.equal(CPhysicalAdmission(good,true),true);assert.equal(CPhysicalAdmission({...good,forcedContainment:true},true),false);assert.equal(CPhysicalAdmission(good,false),false);assert.equal(CPhysicalAdmission({...good,stdout:{...good.stdout,end:false}},true),false);});
test('work budget has named nonrenewable diagnostic reserve inside unchanged hard cap',()=>{const p=JSON.parse(fs.readFileSync(new URL('./profile.json',here))),w=p.sourceWork;assert.equal(w.initial,1366272+64);assert.equal(w.global,57484288+8388608+1235200+64);assert.equal(w.cap-w.global,704);assert.equal(w.commitPartition,138816+30848+30848+15424+32768+4096+5778);assert.ok(w.commitPartition<=w.commit);assert.equal(w.commitDiagnosticReserve.units,64);assert.equal(w.commitDiagnosticReserve.renewed,false);assert.equal(w.regular,3962);assert.equal(w.batch,1736);assert.equal(w.child,752);assert.equal(w.cleanup,2926);assert.ok(w.cleanup<=w.cleanupCeiling);});
test('functional runner keeps refusal and physical containment distinct from eligibility',()=>{const s=fs.readFileSync(new URL('./run.mjs',here),'utf8'),d=fs.readFileSync(new URL('./driver.mjs',here),'utf8');assert.ok(s.includes("env.COPILOTKIT_TELEMETRY_DISABLED='1'"));assert.ok(s.includes("env.DO_NOT_TRACK='1'"));assert.ok(s.includes('observed.controllerGroupGone'));assert.ok(d.includes('C-no-natural-positive-write'));assert.ok(d.includes("invalidated=third.reason==='layout'"));assert.ok(d.includes("sourceCheck()"));});
