import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as preparation from './prepare-stock033-v2.mjs';
test('tail500 owner uses separate wrappers and exact bounded child selectors',async context=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs');
 for(const key of ['generateStock033PreparationInputsV2Tail500','runStock033PreparationOwnerV2Tail500','createStock033OwnerAuthoredControlV2Tail500'])assert.equal(typeof owner[key],'function',key);
 const control=owner.createStock033OwnerAuthoredControlV2Tail500();let lo=1,hi=512;
 while(lo<hi){const n=Math.ceil((lo+hi)/2);try{control.requestEnvelope('/'+'x'.repeat(n-1));lo=n;}catch{hi=n-1;}}
 const accepted=control.requestEnvelope('/'+'x'.repeat(lo-1));assert.equal(accepted.request.type,'prepare-tail500-v1');assert.equal(accepted.request.collectionPolicy,'native-post-phase-tail-500ms-v1');assert.equal(Buffer.byteLength(JSON.stringify(accepted.request)+'\n'),1024);assert.throws(()=>control.requestEnvelope('/'+'x'.repeat(lo)));
 context.diagnostic('tail500 child request accepts '+lo+' path bytes at exact 1024-byte newline-inclusive cap');
 const envelope=control.resultEnvelope('ok');assert.equal(envelope.collectionPolicy,'native-post-phase-tail-500ms-v1');assert(Buffer.byteLength(JSON.stringify(envelope)+'\n')<=8192);assert(Buffer.byteLength(JSON.stringify(envelope.accounting))<=512);
 lo=0;hi=8192;while(lo<hi){const n=Math.ceil((lo+hi)/2);try{control.resultEnvelope('x'.repeat(n));lo=n;}catch{hi=n-1;}}
 assert.equal(Buffer.byteLength(JSON.stringify(control.resultEnvelope('x'.repeat(lo)))+'\n'),8192);assert.throws(()=>control.resultEnvelope('x'.repeat(lo+1)));
});
test('tail500 authored owner child retains separate selector and original closure',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),result=await owner.createStock033OwnerAuthoredControlV2Tail500().run('success');
 assert.equal(result.request.type,'authored-tail500-v1');assert.equal(result.request.collectionPolicy,'native-post-phase-tail-500ms-v1');assert.equal(result.prepared.reference.policy,'authored-owner-reference-stock033-v2-tail500-v1');assert.equal(result.child.exit.code,0);assert.equal(result.child.close.code,0);assert.equal(result.stdout.end,true);assert.equal(result.stderr.end,true);
});

test('owner module imports inertly and fixed authored child joins one original success with exit and both EOF',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs');assert.equal(typeof owner.createStock033OwnerAuthoredControlV2,'function');
 const result=await owner.createStock033OwnerAuthoredControlV2().run('success');
 assert.equal(result.authoredControl,true);assert.equal(result.child.exit.code,0);assert.equal(result.child.close.code,0);
 assert.equal(result.stdout.end,true);assert.equal(result.stderr.end,true);assert.equal(result.stdout.close,true);assert.equal(result.stderr.close,true);
 assert.equal(result.prepared.reference.policy,'authored-owner-reference-stock033-v2');assert.equal(result.authority.FPS,null);assert.equal(result.authority.scoringEligibility,false);
 assert.equal(result.request.nonce,result.child.nonce);assert.equal(Object.keys(result.childAccounting.totals).length,10);
});
for(const kind of ['wrong-nonce','duplicate','nonzero','disconnect','overflow','inherited-pipe','timeout'])test('original owner refuses authored '+kind,async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs');await assert.rejects(owner.createStock033OwnerAuthoredControlV2().run(kind),error=>{
  assert.match(error.message,/owner-unavailable/);assert.ok(error.ownerObservation);assert.equal(error.ownerObservation.send,'fulfilled');
  if(kind==='duplicate')assert.equal(error.ownerObservation.messageCount,2);
  if(kind==='nonzero')assert.equal(error.ownerObservation.exit.code,1);
  if(kind==='timeout'||kind==='inherited-pipe')assert.equal(error.ownerObservation.timedOut,true);
  return true;
 });
});
test('production owner has no arbitrary child or host selector',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs');
 await assert.rejects(owner.runStock033PreparationOwnerV2({child:'/tmp/arbitrary',config:{path:'/tmp/config',fact:{}}}),/owner-unavailable/);
 await assert.rejects(owner.generateStock033PreparationInputsV2({sourceRoot:'/tmp/arbitrary'}),/owner-unavailable/);
 let hooks=0;await assert.rejects(owner.runStock033PreparationOwnerV2(new Proxy({}, {getOwnPropertyDescriptor(){hooks++;throw Error('hook');},ownKeys(){hooks++;throw Error('hook');}})),/owner-unavailable/);assert.equal(hooks,0);
});
test('generator joins the original build return rather than accepting rehashed replacement record objects',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),control=owner.createStock033OwnerAuthoredControlV2();
 const product={sourceHashes:{a:'a'.repeat(64)},assetHashes:{b:'b'.repeat(64)}},probe={compiledHashes:{c:'c'.repeat(64)}};
 assert.deepEqual(control.joinOriginalBuild({product,probe},structuredClone(product),structuredClone(probe)),{authoredControl:true});
 assert.throws(()=>control.joinOriginalBuild({product,probe},{...product,assetHashes:{b:'c'.repeat(64)}},probe),/owner-unavailable/);
});
test('authored result envelope enforces the coupled8192byte limit and512byte accounting limit',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),control=owner.createStock033OwnerAuthoredControlV2();assert.equal(typeof control.resultEnvelope,'function');
 let lo=0,hi=8192;while(lo<hi){const n=Math.ceil((lo+hi)/2);try{control.resultEnvelope('x'.repeat(n));lo=n;}catch{hi=n-1;}}
 const accepted=control.resultEnvelope('x'.repeat(lo));assert.equal(Buffer.byteLength(JSON.stringify(accepted)+'\n'),8192);assert.ok(Buffer.byteLength(JSON.stringify(accepted.accounting))<=512);
 assert.throws(()=>control.resultEnvelope('x'.repeat(lo+1)));assert.equal(accepted.authoredControl,true);assert.equal(accepted.template.authoredControl,true);assert.equal(accepted.reference.authoredControl,true);
});
test('request budget and exact reservation remain inside unchanged1024byte envelope',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),control=owner.createStock033OwnerAuthoredControlV2();assert.equal(typeof control.requestEnvelope,'function');
 let lo=1,hi=512;while(lo<hi){const n=Math.ceil((lo+hi)/2);try{control.requestEnvelope('/'+'x'.repeat(n-1));lo=n;}catch{hi=n-1;}}
 const accepted=control.requestEnvelope('/'+'x'.repeat(lo-1));assert.equal(Buffer.byteLength(JSON.stringify(accepted.request)+'\n'),1024);assert.equal(accepted.authoredControl,true);
 assert.equal(accepted.request.budget.reservation.length,3);assert.equal(Object.keys(accepted.request.budget.totals).length,10);assert.throws(()=>control.requestEnvelope('/'+'x'.repeat(lo)));
});
for(const [name,cap]of [['requestEnvelope',1024],['resultEnvelope',8192]])test(name+' reserves aggregate headroom before envelope clone or JSON construction',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),control=owner.createStock033OwnerAuthoredControlV2(),originalStringify=JSON.stringify,originalClone=globalThis.structuredClone;
 let jsonCalls=0,cloneCalls=0,error;
 try{
  JSON.stringify=(...args)=>{jsonCalls++;return Reflect.apply(originalStringify,JSON,args);};
  globalThis.structuredClone=(...args)=>{cloneCalls++;return Reflect.apply(originalClone,globalThis,args);};
  try{control[name]('/fixture',8388608-cap+1);}catch(value){error=value;}
 }finally{JSON.stringify=originalStringify;globalThis.structuredClone=originalClone;}
 assert.equal(jsonCalls,0);assert.equal(cloneCalls,0);assert.match(error?.message??'',/counter serializedBytes/);
});
test('parent reservation grows with admitted original/archive bytes and literal ancestor depths',async()=>{
 const owner=await import('./prepare-owner-stock033-v2.mjs'),control=owner.createStock033OwnerAuthoredControlV2();assert.equal(typeof control.reservationFor,'function');
 const roles=Object.fromEntries(['product-source','probe-source','probe-compiled','fixture-input','native-owner','native-runtime','metadata','served-asset'].map(key=>[key,[]]));roles['fixture-input']=[{key:'x.js',bytes:1,sha256:'a'.repeat(64)}];
 const config={sourceRoot:'/private/tmp/source',preparedDirectory:'/private/tmp/prepared',evidenceDirectory:'/private/tmp/evidence',release:{path:'/private/tmp/release.json'},originalConfigPath:'/private/tmp/config.json'},release={roles,platformRows:[{path:'/private/tmp/platform',bytes:1}]};
 const base=control.reservationFor(config,release,10);release.roles['fixture-input'][0]={key:'one/two/x.js',bytes:65537,sha256:'a'.repeat(64)};
 const changed=control.reservationFor(config,release,10);assert.ok(changed.tuple[0]>base.tuple[0]);assert.equal(changed.tuple[1]-base.tuple[1],131072);assert.equal(changed.tuple[2]-base.tuple[2],131072);assert.equal(changed.authoredControl,true);
});

test('transferred child accounting preserves ten counters and reserves parent finalization before dispatch',()=>{
 assert.equal(typeof preparation.createTransferredStock033LedgerV2,'function');
 const parent=preparation.createStock033PreparationLedgerV2();parent.charge('operations',10);
 const baseline=parent.totals(),reservation=Object.fromEntries(Object.keys(baseline).map(key=>[key,0]));reservation.operations=131060;
 const child=preparation.createTransferredStock033LedgerV2({totals:baseline,platformSetSha256:null,reservation});
 child.charge('operations',2);assert.throws(()=>child.charge('operations',1),/counter operations/);
 preparation.reconcileStock033LedgerV2(parent,{totals:baseline,platformSetSha256:null},{totals:child.totals(),platformSetSha256:null});
 assert.equal(parent.totals().operations,12);
 const before=parent.totals();assert.throws(()=>preparation.reconcileStock033LedgerV2(parent,{totals:before,platformSetSha256:null},{totals:{...before,operations:11},platformSetSha256:null}));assert.deepEqual(parent.totals(),before);
});
test('bounded serialization charges actual UTF8 bytes and refuses before JSON hooks',()=>{
 assert.equal(typeof preparation.serializeStock033DataV2,'function');
 const ledger=preparation.createStock033PreparationLedgerV2(),bytes=preparation.serializeStock033DataV2({text:'é'},64,ledger);
 assert.equal(ledger.totals().serializedBytes,bytes.length);assert.equal(bytes.toString(),'{"text":"é"}\n');
 assert.throws(()=>preparation.serializeStock033DataV2({toJSON(){throw Error('must not run');}},64,ledger),/serialization hook|own data/);
});
test('platform original observation and subsequent verification bind one distinct set across a transfer',async()=>{
 assert.equal(typeof preparation.observeStock033PlatformsV2,'function');
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'stock033-owner-platform-')));
 try{
  const filename=root+'/platform';await fs.writeFile(filename,'actual authored platform bytes');const parent=preparation.createStock033PreparationLedgerV2();
  const rows=await preparation.observeStock033PlatformsV2([{key:'platform/test',path:filename}],parent);
  const digest=preparation.stock033PlatformSetSha256V2(parent);assert.match(digest,/^[a-f0-9]{64}$/);
  const baseline={totals:parent.totals(),platformSetSha256:digest},reservation=Object.fromEntries(Object.keys(baseline.totals).map(key=>[key,0]));
  const child=preparation.createTransferredStock033LedgerV2({...baseline,reservation});await preparation.verifyStock033PlatformsV2(rows,child);
  preparation.reconcileStock033LedgerV2(parent,baseline,{totals:child.totals(),platformSetSha256:preparation.stock033PlatformSetSha256V2(child)});
  assert.equal(parent.totals().platformPasses,2);assert.equal(parent.totals().platformReferencedBytes,rows[0].bytes);assert.equal(parent.totals().platformReadBytes,2*rows[0].bytes);
  await assert.rejects(preparation.verifyStock033PlatformsV2([{...rows[0],key:'platform/swapped'}],parent),/set drift/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('transferred summaries reject unknown, omitted and unsafe counters before mutation',()=>{
 const parent=preparation.createStock033PreparationLedgerV2(),base={totals:parent.totals(),platformSetSha256:null},zero={...base.totals};
 for(const totals of [{...zero,extra:0},{...zero,operations:NaN},{...zero,operations:-1},Object.fromEntries(Object.entries(zero).filter(([key])=>key!=='readBytes'))]){
  assert.throws(()=>preparation.createTransferredStock033LedgerV2({totals,platformSetSha256:null,reservation:zero}));assert.deepEqual(parent.totals(),zero);
 }
 assert.throws(()=>preparation.createTransferredStock033LedgerV2({...base,reservation:{...zero,operations:-1}}));
 assert.throws(()=>preparation.createTransferredStock033LedgerV2({...base,platformSetSha256:'a'.repeat(64),reservation:zero}));
});
