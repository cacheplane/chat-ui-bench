import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setImmediate as immediate} from 'node:timers/promises';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as api from './aimock-trace-capture-v3.mjs';
import {createAimockTraceCaptureV2,AIMOCK_TRACE_LIMITS_V2,AIMOCK_TRACE_CONFIG_V2} from './aimock-trace-capture-v1.mjs';
import {SEMANTIC_LARGE_V3_POLICY as policy,SEMANTIC_LARGE_V3_POLICY_SHA256} from './semantic-large-v3-policy.mjs';

const createCapture = api.createAimockTraceCaptureV3;
const identity = {id:'authored-v3',profile:'threadplane',historyCount:1000,responseBytes:6400,journey:'follow',stockVersion:'0.3.6',buildSha256:'a'.repeat(64)};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve=yes; reject=no; });
  return {promise, resolve, reject};
}
function harness({factory=createCapture,send=()=>undefined,wait=p=>p,remaining=()=>100000,bytes=Buffer.from('authored opaque bytes'),autoComplete=true,detach=()=>Promise.resolve(),frameId='owned',targetId='target',url='http://127.0.0.1:1234/',version='authored-browser',caseIdentity=identity}={}) {
  let time=0, offset=0;
  const calls=[], waits=[], dispatches=[], pageCDP=new EventEmitter(), browserCDP=new EventEmitter();
  const page=new EventEmitter(), context=new EventEmitter(), mainFrame={};
  page.mainFrame=()=>mainFrame;
  const pages=[page]; context.pages=()=>pages;
  context.newCDPSession=()=>{ calls.push('page-session'); return Promise.resolve(pageCDP); };
  pageCDP.send=(method, options)=>{
    calls.push(method); dispatches.push({method,time});
    const supplied=send(method,options);
    if(supplied!==undefined) return supplied;
    if(method==='Page.getFrameTree') return Promise.resolve({frameTree:{frame:{id:frameId,url}}});
    if(method==='Target.getTargetInfo') return Promise.resolve({targetInfo:{targetId,type:'page',url}});
    if(method==='Tracing.getCategories') return Promise.resolve({categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
    if(method==='Tracing.end'&&autoComplete) queueMicrotask(()=>complete());
    if(method==='IO.read') {
      const part=bytes.subarray(offset,offset+65536); offset+=part.length;
      return Promise.resolve({data:part.toString('base64'),base64Encoded:true,eof:offset===bytes.length});
    }
    return Promise.resolve({});
  };
  pageCDP.detach=()=>{calls.push('page-detach');dispatches.push({method:'page-detach',time});return detach('page');};
  browserCDP.detach=()=>{calls.push('browser-detach');dispatches.push({method:'browser-detach',time});return detach('browser');};
  browserCDP.send=()=>{throw Error('browser cannot own stream');};
  const browser=Object.assign(new EventEmitter(),{
    version:()=>version,
    newBrowserCDPSession:()=>{calls.push('browser-session');return Promise.resolve(browserCDP);},
    close:()=>{calls.push('browser.close');return Promise.resolve();},
  });
  const collector=factory({now:()=>time,origin:0,identity:caseIdentity,wait:(p,ms,label)=>{waits.push({ms,label});return wait(p,ms,label);},remaining,stageMs:10000});
  const complete=(patch={})=>pageCDP.emit('Tracing.tracingComplete',{dataLossOccurred:false,stream:'stream',traceFormat:'json',streamCompression:'gzip',...patch});
  return {collector,calls,waits,dispatches,browser,context,page,pages,mainFrame,pageCDP,browserCDP,complete,setTime:n=>{time=n;},setup:()=>collector.setup({browser,context,page,expectedOrigin:'http://127.0.0.1:1234'})};
}
async function cleanupAfterNativeRefusal(h, nativeFailure) {
  try {
    const finish=h.collector.beforeBrowserClose();
    if(finish!==null&&finish!==undefined) await finish;
  } catch {}
  await h.browser.close();
  return nativeFailure;
}

test('native refusal cleanup holds browser through end, complete, EOF, IO close and both detach originals',async()=>{
  const end=deferred(), read=deferred(), close=deferred(), pageDetach=deferred(), browserDetach=deferred();
  const h=harness({autoComplete:false,send:name=>({'Tracing.end':end,'IO.read':read,'IO.close':close}[name]?.promise),detach:kind=>kind==='page'?pageDetach.promise:browserDetach.promise});
  await h.setup(); h.collector.markPublicAck();
  const nativeFailure=Error('initial-readiness-deadline');
  const cleanup=cleanupAfterNativeRefusal(h,nativeFailure);
  await immediate(); assert(!h.calls.includes('browser.close'),'browser closed before actual trace completion');
  end.resolve({}); await immediate(); assert(!h.calls.includes('browser.close'));
  h.complete(); await immediate(); assert(h.calls.includes('IO.read')); assert(!h.calls.includes('browser.close'));
  read.resolve({data:'eA==',base64Encoded:true,eof:true}); await immediate(); assert(h.calls.includes('IO.close')); assert(!h.calls.includes('browser.close'));
  close.resolve({}); await immediate(); assert(h.calls.includes('page-detach')); assert(h.calls.includes('browser-detach')); assert(!h.calls.includes('browser.close'));
  pageDetach.resolve(); await immediate(); assert(!h.calls.includes('browser.close'));
  browserDetach.resolve(); assert.equal(await cleanup,nativeFailure);
  const r=h.collector.seal().receipt;
  assert.equal(r.complete,true); assert.equal(r.unsafeOutstanding,false);
  assert.equal(h.calls.at(-1),'browser.close');
  for(const method of ['Tracing.end','IO.read','IO.close','page-detach','browser-detach']) assert.equal(h.calls.filter(x=>x===method).length,1);
  for(const owner of r.owners) { assert.equal(owner.pending,0); assert.equal(owner.lastStatus,'fulfilled'); assert.equal(owner.attentionStatus,'fulfilled'); }
});

test('strict case, invocation and elapsed cleanup ends refuse all new protocol dispatches at equality or later',async()=>{
  for(const endSource of ['case','invocation','cleanup']) for(const lateness of [0,1]) {
    let now=0; const ends={case:100000,invocation:100000,cleanup:100000}; ends[endSource]=5;
    const h=harness({remaining:()=>Math.min(ends.case-now,ends.invocation-now,ends.cleanup-now)});
    await h.setup(); h.collector.markPublicAck(); now=5+lateness; h.setTime(now);
    const count=h.calls.length, first=h.collector.beforeBrowserClose();
    await assert.rejects(first,/timeline-case-deadline/); assert.equal(h.collector.beforeBrowserClose(),first);
    h.collector.afterBrowserClose(); await immediate();
    assert.equal(h.calls.length,count); const r=h.collector.seal().receipt;
    assert.equal(r.complete,false); assert.equal(r.unsafeOutstanding,false);
    assert(!r.owners.some(o=>['finish','trace-end','trace-complete','io-read'].includes(o.kind)));
  }
});

test('remaining cleanup consumed by public disposal clips the one finish clock without reset',async()=>{
  let now=29995; const cleanupEnd=30000;
  const h=harness({remaining:()=>Math.min(240000-now,1200000-now,cleanupEnd-now)});
  await h.setup(); h.collector.markPublicAck(); h.setTime(now);
  const first=h.collector.beforeBrowserClose(); await first;
  assert.equal(h.collector.beforeBrowserClose(),first);
  const r=h.collector.seal().receipt;
  assert.deepEqual(r.finishClock,{startedMs:29995,deadlineMs:30000,budgetMs:5});
  assert(h.waits.every(row=>row.ms<=5)); assert.equal(r.complete,true);
});

test('clock crossing during end, read, IO close or detach refuses following commands without late rescue',async()=>{
  for(const source of ['case','invocation','cleanup']) for(const point of ['Tracing.end','IO.read','IO.close','page-detach','browser-detach']) for(const lateness of [0,1]) {
    let now=0,h; const ends={case:100000,invocation:100000,cleanup:100000}; ends[source]=5;
    const jump=()=>{now=5+lateness;h.setTime(now);};
    h=harness({remaining:()=>Math.min(ends.case-now,ends.invocation-now,ends.cleanup-now),send:name=>{if(name===point)jump();},detach:kind=>{if(kind+'-detach'===point)jump();return Promise.resolve();}});
    await h.setup(); h.collector.markPublicAck();
    const first=h.collector.beforeBrowserClose(); await assert.rejects(first); await immediate();
    assert.equal(h.collector.beforeBrowserClose(),first); h.collector.afterBrowserClose(); await immediate();
    assert(h.dispatches.every(row=>row.time<5),`${source}/${point}/${lateness}: post-end dispatch`);
    const r=h.collector.seal().receipt; assert.equal(r.complete,false);
    assert.equal(r.finishClock.deadlineMs,5); assert.equal(r.finishClock.budgetMs,5);
    if(point==='Tracing.end')assert(!h.calls.includes('IO.read'));
    if(point==='IO.read')assert(!h.calls.includes('IO.close'));
    if(point==='IO.close')assert(!h.calls.includes('page-detach'));
    if(point==='page-detach')assert(!h.calls.includes('browser-detach'));
  }
});

test('pending IO read, IO close and each detach are unsafe despite rejected finish attention and browser close',async()=>{
  for(const point of ['IO.read','IO.close','page-detach','browser-detach']) {
    const raw=deferred(), attention=deferred();
    const label='matrix-trace-'+({'IO.read':'io-read','IO.close':'io-close'}[point]??point);
    const h=harness({send:name=>name===point?raw.promise:undefined,detach:kind=>kind+'-detach'===point?raw.promise:Promise.resolve(),wait:(p,ms,name)=>name===label?attention.promise:p});
    await h.setup(); h.collector.markPublicAck(); const first=h.collector.beforeBrowserClose();
    void first.catch(()=>{}); await immediate(); attention.reject(Error('fixed-pending-attention'));
    await assert.rejects(first); await h.browser.close(); await immediate();
    const snapshot=h.collector.seal(), sealed=JSON.stringify(snapshot),r=snapshot.receipt;
    const owner=r.owners.find(o=>o.kind===label.slice('matrix-trace-'.length));
    assert.equal(owner.pending,1); assert.equal(owner.lastStatus,'unknown');
    assert.equal(r.complete,false); assert.equal(r.unsafeOutstanding,true);
    raw.resolve(point==='IO.read'?{data:'AA==',base64Encoded:true,eof:true}:{}); await immediate();
    assert.equal(JSON.stringify(h.collector.seal()),sealed);
  }
});

test('settled read, close and detach rejections stay unavailable while safely closed originals need not be unsafe',async()=>{
  for(const point of ['IO.read','IO.close','page-detach','browser-detach']) {
    const h=harness({send:name=>name===point?Promise.reject(Error('settled-refusal')):undefined,detach:kind=>kind+'-detach'===point?Promise.reject(Error('settled-refusal')):Promise.resolve()});
    await h.setup(); h.collector.markPublicAck(); await assert.rejects(h.collector.beforeBrowserClose()); await immediate();
    const r=h.collector.seal().receipt; assert.equal(r.complete,false); assert.equal(r.unsafeOutstanding,false);
    assert(r.owners.some(o=>o.lastStatus==='rejected'&&o.pending===0));
  }
});

test('missing EOF, malformed IO, excessive reads, and duplicate or malformed completion never qualify',async()=>{
  let getterCalls=0; const getter={eof:true}; Object.defineProperty(getter,'data',{get(){getterCalls++;return 'x';}});
  for(const reply of [{data:'?',base64Encoded:true,eof:true},{data:'x'.repeat(65537),eof:true},{data:'',eof:false},getter,{data:'AA==',base64Encoded:true,eof:false}]) {
    const h=harness({send:name=>name==='IO.read'?Promise.resolve(reply):undefined});
    await h.setup(); h.collector.markPublicAck(); await assert.rejects(h.collector.beforeBrowserClose());
    const r=h.collector.seal().receipt; assert.equal(r.complete,false); assert.equal(r.eof,false);
    if(reply!==getter&&Object.getOwnPropertyDescriptor(reply,'data').value==='AA==')assert.equal(h.calls.filter(x=>x==='IO.read').length,4096);
  }
  assert.equal(getterCalls,0);
  for(const mode of ['duplicate','format','loss-unknown']) {
    const h=harness({autoComplete:false}); await h.setup(); h.collector.markPublicAck(); const first=h.collector.beforeBrowserClose();
    h.complete(mode==='format'?{streamCompression:'none'}:mode==='loss-unknown'?{dataLossOccurred:null}:{});
    if(mode==='duplicate')h.complete(); await assert.rejects(first); assert.equal(h.collector.seal().receipt.complete,false);
  }
});

test('owned page/session/browser termination, navigation and inventory changes remain latched',async()=>{
  for(const mode of ['session','browser','page','navigation','extra-page','inventory']) {
    const h=harness(); await h.setup(); h.collector.markPublicAck();
    if(mode==='session')h.pageCDP.emit('close');
    if(mode==='browser')h.browser.emit('disconnected');
    if(mode==='page')h.page.emit('close');
    if(mode==='navigation')h.page.emit('framenavigated',h.mainFrame);
    if(mode==='extra-page')h.context.emit('page',{});
    if(mode==='inventory')h.pages.push({});
    if(mode==='inventory')await assert.rejects(h.collector.finish(),/timeline-owned-page-changed/);
    await assert.rejects(h.collector.beforeBrowserClose()); assert.equal(h.collector.seal().receipt.complete,false);
  }
});

test('expected page detach close and final browser disconnect leave completed ownership intact',async()=>{
  let h; h=harness({detach:kind=>{if(kind==='page')h.pageCDP.emit('close');return Promise.resolve();}});
  await h.setup(); h.collector.markPublicAck(); await h.collector.beforeBrowserClose();
  h.browser.emit('disconnected'); const external=()=>{}; h.pageCDP.on('Tracing.tracingComplete',external);
  const r=h.collector.seal().receipt; assert.equal(r.complete,true);
  assert.deepEqual(h.pageCDP.listeners('Tracing.tracingComplete'),[external]);
  assert.equal(h.browser.listenerCount('disconnected'),0); assert.equal(h.pageCDP.listenerCount('close'),0);
});

test('missing completion original stays unsafe after finish attention expires; late events cannot mutate seal',async()=>{
  const h=harness({autoComplete:false,wait:(p,ms,label)=>label==='matrix-trace-finish'?Promise.reject(Error('fixed-finish-attention')):p});
  await h.setup(); h.collector.markPublicAck(); await assert.rejects(h.collector.beforeBrowserClose()); await immediate();
  const s=h.collector.seal(),sealed=JSON.stringify(s);
  assert.equal(s.receipt.tracingCompleteSeen,false); assert.equal(s.receipt.eof,false); assert.equal(s.receipt.unsafeOutstanding,true);
  assert.equal(s.receipt.owners.find(o=>o.kind==='trace-complete').pending,1);
  h.complete(); await immediate(); assert.equal(JSON.stringify(h.collector.seal()),sealed);
});

test('actual disconnect after end settles completion rejection but never substitutes for EOF',async()=>{
  for(const terminal of ['session','browser']) {
    const h=harness({autoComplete:false}); await h.setup(); h.collector.markPublicAck();
    const first=h.collector.beforeBrowserClose(); void first.catch(()=>{}); await immediate();
    if(terminal==='session')h.pageCDP.emit('close');else h.browser.emit('disconnected');
    await assert.rejects(first); const r=h.collector.seal().receipt;
    assert.equal(r.owners.find(o=>o.kind==='trace-end').lastStatus,'fulfilled');
    assert.equal(r.owners.find(o=>o.kind==='trace-complete').lastStatus,'rejected');
    assert.equal(r.unsafeOutstanding,false); assert.equal(r.complete,false); assert.equal(r.eof,false);
    assert(!h.calls.includes('IO.read'));
  }
});

test('browser close cannot settle a pending raw end original even when completion rejects safely',async()=>{
  const raw=deferred(),h=harness({autoComplete:false,send:name=>name==='Tracing.end'?raw.promise:undefined,wait:(p,ms,label)=>label==='matrix-trace-trace-end'?Promise.reject(Error('fixed-end-attention')):p});
  await h.setup(); h.collector.markPublicAck(); await assert.rejects(h.collector.beforeBrowserClose());
  h.browser.emit('disconnected'); await h.browser.close(); await immediate();
  const r=h.collector.seal().receipt;
  assert.equal(r.owners.find(o=>o.kind==='trace-end').pending,1);
  assert.equal(r.owners.find(o=>o.kind==='trace-complete').lastStatus,'rejected');
  assert.equal(r.unsafeOutstanding,true); assert.equal(r.complete,false);
  raw.resolve({}); await immediate(); assert.equal(r.owners.find(o=>o.kind==='trace-end').pending,1);
});

test('pending session acquisitions remain actual unknown owners without manufactured trace start or finish',async()=>{
  for(const point of ['browser-session','page-session']) {
    const raw=deferred(),attention=deferred(),h=harness({wait:(p,ms,label)=>label==='matrix-trace-'+point?attention.promise:p});
    if(point==='browser-session')h.browser.newBrowserCDPSession=()=>raw.promise;
    else h.context.newCDPSession=()=>raw.promise;
    const setup=h.setup(); void setup.catch(()=>{}); await immediate();
    assert.equal(h.collector.beforeBrowserClose(),null); attention.reject(Error('fixed-acquisition-attention')); await assert.rejects(setup);
    h.collector.afterBrowserClose(); await immediate(); const r=h.collector.seal().receipt;
    assert.equal(r.owners.find(o=>o.kind===point).pending,1); assert.equal(r.unsafeOutstanding,true);
    assert(!h.calls.includes('Tracing.start')); assert(!r.owners.some(o=>o.kind==='finish'));
    raw.resolve(point==='browser-session'?h.browserCDP:h.pageCDP); await immediate();
    assert.equal(r.owners.find(o=>o.kind===point).pending,1);
  }
});

test('old hook concretely closes browser while its real tracing completion remains pending',async()=>{
  const h=harness({factory:createAimockTraceCaptureV2,autoComplete:false});
  await h.setup(); h.collector.markPublicAck();
  const nativeFailure=Error('initial-readiness-deadline');
  assert.equal(await cleanupAfterNativeRefusal(h,nativeFailure),nativeFailure);
  assert(h.calls.includes('browser.close')); assert(!h.calls.includes('IO.read'));
  h.complete(); await immediate();
  assert(h.calls.indexOf('browser.close')<h.calls.indexOf('IO.read'));
  h.collector.seal();
});

test('hook reuses exact attention across repeated cleanup and normal finish without rearming waits',async()=>{
  for(const normal of [false,true]) {
    const gate=deferred();
    const h=harness({send:name=>name==='IO.close'?gate.promise:undefined});
    await h.setup(); h.collector.markPublicAck();
    const first=normal?h.collector.finish():h.collector.beforeBrowserClose();
    assert(first instanceof Promise); assert.equal(h.collector.beforeBrowserClose(),first);
    await immediate(); const count=h.waits.length;
    assert.equal(h.collector.beforeBrowserClose(),first); assert.equal(h.waits.length,count);
    gate.resolve({}); await first;
    const settledWaits=h.waits.length;
    assert.equal(h.collector.beforeBrowserClose(),first); assert.equal(h.collector.finish(),first);
    assert.equal(h.waits.length,settledWaits);
    assert.equal(h.collector.seal().receipt.complete,true); assert.equal(h.collector.beforeBrowserClose(),null);
    assert.equal(h.calls.filter(x=>x==='Tracing.end').length,1);
  }
});

test('no start and definitively rejected start manufacture no finish or stop',async()=>{
  const fresh=harness(); assert.equal(fresh.collector.beforeBrowserClose(),null);
  assert.equal(fresh.calls.length,0); assert.equal(fresh.collector.seal().receipt.complete,false);
  for(const method of ['Page.getFrameTree','Tracing.start']) {
    const h=harness({send:name=>name===method?Promise.reject(Error('authored-setup-refusal')):undefined});
    await assert.rejects(h.setup(),/authored-setup-refusal/);
    assert.equal(h.collector.beforeBrowserClose(),null); h.collector.afterBrowserClose(); await immediate();
    const r=h.collector.seal().receipt;
    assert.equal(r.complete,false); assert.equal(r.unsafeOutstanding,false);
    assert(!h.calls.includes('Tracing.end')); assert(!r.owners.some(o=>o.kind==='finish'));
  }
});

test('pending start joins original once and cannot rescue failed setup or unknown ownership',async()=>{
  const raw=deferred(), attention=deferred();
  const h=harness({send:name=>name==='Tracing.start'?raw.promise:undefined,wait:(p,ms,label)=>label==='matrix-trace-trace-start'?attention.promise:p});
  const setup=h.setup(); void setup.catch(()=>{}); await immediate();
  const first=h.collector.beforeBrowserClose(); assert.equal(h.collector.beforeBrowserClose(),first);
  await first; attention.reject(Error('setup-attention-refusal')); await assert.rejects(setup);
  const r=h.collector.seal().receipt;
  assert.equal(r.complete,false); assert.equal(r.unsafeOutstanding,true);
  assert.equal(r.owners.find(o=>o.kind==='trace-start').pending,1);
  assert.equal(h.calls.filter(x=>x==='Tracing.start').length,1);
  raw.resolve({}); await immediate(); assert.equal(r.owners.find(o=>o.kind==='trace-start').pending,1);
});

test('failed finish attention remains identical and failed after late original closure',async()=>{
  const h=harness({autoComplete:false,wait:(p,ms,label)=>label==='matrix-trace-trace-complete'?Promise.reject(Error('fixed-attention-refusal')):p});
  await h.setup(); h.collector.markPublicAck();
  const first=h.collector.finish(); await assert.rejects(first,/fixed-attention-refusal/);
  const waitCount=h.waits.length; assert.equal(h.collector.beforeBrowserClose(),first);
  await assert.rejects(h.collector.beforeBrowserClose(),/fixed-attention-refusal/); assert.equal(h.waits.length,waitCount);
  h.complete(); await immediate();
  const r=h.collector.seal().receipt;
  assert.equal(r.eof,true); assert.equal(r.complete,false);
  assert.equal(r.owners.find(o=>o.kind==='trace-complete').lastStatus,'fulfilled');
  assert.equal(r.owners.find(o=>o.kind==='trace-complete').attentionStatus,'rejected');
});

test('early buffer stop joins one stop/drain while high usage and loss remain latched',async()=>{
  for(const mode of ['usage','loss']) {
    const h=harness({autoComplete:false}); await h.setup(); h.collector.markPublicAck();
    h.pageCDP.emit('Tracing.bufferUsage',{percentFull:mode==='usage'?0.9:0.826});
    const first=h.collector.beforeBrowserClose(); assert.equal(h.collector.beforeBrowserClose(),first);
    h.complete({dataLossOccurred:mode==='loss'}); await assert.rejects(first); await immediate();
    const r=h.collector.seal().receipt;
    assert.equal(r.eof,true); assert.equal(r.ioClosed,true); assert.equal(r.complete,false);
    assert.equal(r.stopReason,mode==='usage'?'buffer-usage':'before-browser-close');
    assert(r.issues.includes(mode==='usage'?'timeline-buffer-usage90':'timeline-data-loss'));
    assert.equal(h.calls.filter(x=>x==='Tracing.end').length,1);
    assert.equal(api.createAimockTraceRawEvidenceV3(h.collector.seal()).receipt.complete,false);
  }
});

test('fixed V3 acquisition requests the common larger buffer and preserves two-category semantics',async()=>{
  const h=harness(); await h.setup();
  const config=api.AIMOCK_TRACE_CONFIG_V3;
  assert.equal(config.traceConfig.traceBufferSizeInKb,16384);
  assert.deepEqual(config.traceConfig.includedCategories,['devtools.timeline','disabled-by-default-devtools.timeline']);
  assert.equal(config.traceConfig.enableSampling,false);
  assert.equal(config.traceConfig.enableSystrace,false);
  assert.equal(config.traceConfig.recordMode,'recordUntilFull');
  h.collector.markPublicAck(); await h.collector.finish(); h.collector.seal();
});

test('notification diagnostic retains first8 plus rolling last8, with exact omitted count and unchanged legacy max',async()=>{
  const h=harness(); await h.setup(); h.collector.markPublicAck();
  for(let n=1;n<=25;n++) { h.setTime(n); h.pageCDP.emit('Tracing.bufferUsage',{percentFull:n===12?0.8:0.1,value:0.2,eventCount:n}); }
  await h.collector.finish(); const r=h.collector.seal().receipt;
  assert.deepEqual(r.bufferNotificationsV3,{
    totalCount:25,first8:Array.from({length:8},(_,i)=>[i+1,i+1,0.1,0.2,i+1]),
    last8:Array.from({length:8},(_,i)=>[i+18,i+18,0.1,0.2,i+18]),retainedCount:16,droppedCount:9,truncated:true,
  });
  assert.deepEqual(r.bufferUsage,{count:25,first:0.2,last:0.2,max:0.8});
  assert.equal(r.complete,true); assert.equal(r.truncated,false);
});

test('4MiB exact compressed bound and next byte preserve truthful bounded prefix',async()=>{
  for(const size of [4194304,4194305]) {
    const h=harness({bytes:Buffer.alloc(size,3)}); await h.setup(); h.collector.markPublicAck();
    if(size===4194304) await h.collector.finish(); else await assert.rejects(h.collector.finish());
    const s=h.collector.seal(); assert.equal(s.receipt.retainedBytes,4194304);
    assert.equal(s.receipt.receivedBytes,size); assert.equal(s.receipt.truncated,size>4194304);
    assert.equal(s.receipt.complete,size===4194304); assert.equal(s.payloadBase64.length,5592408);
    const raw=api.createAimockTraceRawEvidenceV3(s);
    assert.equal(raw.retainedCompressedBytes,4194304);
    assert.equal(raw.receipt.truncated,size>4194304);
    assert(Buffer.byteLength(JSON.stringify(raw))<=6291456);
  }
});

const hash=value=>createHash('sha256').update(value).digest('hex');
test('finite source map preserves byte-exact collector core, helpers and fixed legacy modules',async()=>{
  const read=name=>readFile(new URL(name,import.meta.url),'utf8');
  const old=await read('aimock-trace-capture-v1.mjs'), fresh=await read('aimock-trace-capture-v3.mjs');
  assert.equal(hash(old),'ee25e4ac8a37d73677c69d5975edeab1cba0d8bbebb17a57e8564f6f6e91ab32');
  assert.equal(hash(await read('aimock-trace-capture-v2.mjs')),'5681153b2a23c91be85f149fdbfb837c5566ac20fd658865d5952f12a0961a00');
  assert.equal(hash(await read('aimock-trace-completion-waiter-v1.mjs')),'67df5242c4f7765c3cc34a5503ffc32168696622c27c3e1705b66b3af7855d38');
  assert.equal(hash(await read('semantic-large-v3-policy.mjs')),'245f2f9e59d79fd83079941601e658ac7202c232c470dc7f545af20394eef405');
  const oldCaseSlice="try{trace.beforeBrowserClose();}catch{traceFailure??='aimock-trace-stop-unavailable';}\n // TRACE-V2-END cleanup-stop\n  if(browser){const originalClose=browser.close();";
  for(const [name,expected] of [
    ['matrix-case-competitor-trace-v1.mjs','2d95efd2268b4c2335565ed7a32ac442ed9f20b509b682502ab92cfeaaa4892b'],
    ['matrix-case-stock036-trace-v1.mjs','b0346d3a5d55b023d92a4ff0efa3e2e091ab9a05bafd84bb9d580e11faba442d'],
  ]) { const source=await read(name); assert.equal(hash(source),expected); assert.equal(source.split(oldCaseSlice).length-1,1); }
  assert.equal(SEMANTIC_LARGE_V3_POLICY_SHA256,'bce01bad127db70b2469209a669b7258f9fa6615e3ef92d5d6c08a763d9b95c5');
  const oldCore=old.slice(old.indexOf('function createCaptureForProfile('),old.indexOf('/** Post-seal'));
  let core=fresh.slice(fresh.indexOf('function createCaptureForProfile('),fresh.indexOf('// Copy JSON'));
  const replaceOnce=(before,after)=>{assert.equal(core.split(before).length-1,1,before);core=core.replace(before,after);};
  const observation=/\/\* V3-BUFFER-OBSERVATION-BEGIN \*\/[\s\S]*?\/\* V3-BUFFER-OBSERVATION-END \*\//g;
  const seal=/   \/\* V3-BUFFER-SEAL-BEGIN \*\/[\s\S]*?   \/\* V3-BUFFER-SEAL-END \*\/\n/g;
  assert.equal([...core.matchAll(observation)].length,1); assert.equal([...core.matchAll(seal)].length,1);
  assert.equal((core.match(/V3-BUFFER-/g)??[]).length,4);
  core=core.replace(observation,'').replace(seal,'');
  replaceOnce('const left=4194304-retainedBytes','const left=1048576-retainedBytes');
  replaceOnce('limits:AIMOCK_TRACE_LIMITS_V3','limits:AIMOCK_TRACE_LIMITS_V1');
  replaceOnce("beforeBrowserClose(){if(!sealed){closing=true;setupActive=false;if(startDispatched&&owners.get('trace-start')?.lastStatus!=='rejected')return beginFinish('before-browser-close');}return null;},","beforeBrowserClose(){if(!sealed){closing=true;setupActive=false;if(startDispatched&&owners.get('trace-start')?.lastStatus!=='rejected')void beginFinish('before-browser-close').catch(()=>{});}},");
  assert.equal(core,oldCore);
  assert.equal(fresh.slice(fresh.indexOf('const sha='),fresh.indexOf('export const AIMOCK_TRACE_LIMITS_V3=')),old.slice(old.indexOf('const sha='),old.indexOf('export const AIMOCK_TRACE_LIMITS_V1=')));
  assert.equal(fresh.slice(fresh.indexOf('function own('),fresh.indexOf('/** Factual owned-page')),old.slice(old.indexOf('function own('),old.indexOf('/** Source-bound')));
  assert.equal((fresh.match(/function createCaptureForProfile\(/g)??[]).length,1);
  assert.equal((fresh.match(/export function createAimockTraceCaptureV3\(ports\)\{return createCaptureForProfile\(ports,PROFILE_V3\);\}/g)??[]).length,1);
  assert(!fresh.includes('node:zlib')); assert(!fresh.includes('mapAimockTraceRenderer'));
});

test('active support setup still pending at cleanup retains its original owner and setup refusal',async()=>{
  const raw=deferred(),h=harness({send:name=>name==='Tracing.getCategories'?raw.promise:undefined});
  const setup=h.setup(); void setup.catch(()=>{}); await immediate();
  const first=h.collector.beforeBrowserClose(); await first;
  raw.resolve({categories:policy.config.traceConfig.includedCategories}); await assert.rejects(setup,/timeline-setup-closed/);
  const r=h.collector.seal().receipt;
  assert.equal(r.complete,false); assert.equal(r.protocolSupport,null); assert(r.issues.includes('timeline-setup-failed'));
  assert.equal(r.owners.find(o=>o.kind==='active-page-categories').pending,0);
  assert.equal(h.calls.filter(x=>x==='Tracing.end').length,1);
});

test('expired finish attention is reused and late completion cannot launch a new drain or rescue status',async()=>{
  let h; h=harness({autoComplete:false,wait:(p,ms,label)=>{
    if(label==='matrix-trace-trace-complete'){h.setTime(10000);return Promise.reject(Error('fixed-finish-timeout'));}return p;
  }});
  await h.setup(); h.collector.markPublicAck(); const first=h.collector.beforeBrowserClose();
  await assert.rejects(first); const count=h.calls.length; h.complete(); await immediate();
  assert.equal(h.collector.beforeBrowserClose(),first); await assert.rejects(first);
  assert.equal(h.calls.length,count); const r=h.collector.seal().receipt;
  assert.equal(r.complete,false); assert.equal(r.eof,false); assert.equal(r.retainedBytes,0);
  assert.equal(r.owners.find(o=>o.kind==='trace-complete').lastStatus,'fulfilled');
  assert.equal(r.owners.find(o=>o.kind==='trace-complete').attentionStatus,'rejected');
});

test('synchronous end and close rejection stays single-dispatch through repeated hooks and release',async()=>{
  for(const point of ['Tracing.end','IO.close']) {
    const h=harness({send:name=>{if(name===point)throw Error('synchronous-refusal');}});
    await h.setup(); h.collector.markPublicAck(); const first=h.collector.beforeBrowserClose(); await assert.rejects(first);
    assert.equal(h.collector.beforeBrowserClose(),first); h.collector.afterBrowserClose(); await immediate();
    assert.equal(h.calls.filter(x=>x===point).length,1); assert.equal(h.collector.seal().receipt.complete,false);
  }
});

test('bounded hostile maximum acquisition previews plus sixteen notifications fit the fixed receipt',async t=>{
  const hostile='\u0000'.repeat(4096); let h;
  h=harness({bytes:Buffer.alloc(4194304,3),frameId:'\u0000'.repeat(128),targetId:'\u0000'.repeat(128),url:'http://127.0.0.1:1234/'+'\u0000'.repeat(1024),version:'\u0000'.repeat(256),
    caseIdentity:{...identity,id:'\u0000'.repeat(256)},send:name=>{
      if(name==='Tracing.getCategories')return Promise.resolve({categories:[...Array(8).fill('\u0000'.repeat(256)),...policy.config.traceConfig.includedCategories]});
      if(name==='Tracing.end'){queueMicrotask(()=>h.complete());return Promise.reject(Error(hostile));}
      if(name==='IO.close')return Promise.reject(Error(hostile));
    },detach:()=>Promise.reject(Error(hostile)),
  });
  await h.setup(); h.collector.markPublicAck();
  for(let i=1;i<=25;i++){h.setTime(i);h.pageCDP.emit('Tracing.bufferUsage',{percentFull:0.826,value:0.5,eventCount:Number.MAX_SAFE_INTEGER});}
  await assert.rejects(h.collector.beforeBrowserClose()); await immediate();
  const s=h.collector.seal(),rbytes=Buffer.byteLength(JSON.stringify(s.receipt)),raw=api.createAimockTraceRawEvidenceV3(s);
  const overhead=Buffer.byteLength(JSON.stringify({...raw,payloadBase64:''})),bytes=Buffer.byteLength(JSON.stringify(raw));
  assert.equal(s.receipt.retainedBytes,4194304); assert.equal(s.receipt.complete,false);
  assert.equal(s.receipt.bufferNotificationsV3.retainedCount,16);
  assert(rbytes<=16384); assert(overhead<=65536); assert(bytes<=6291456);
  t.diagnostic(`hostile receipt ${rbytes}/16384, overhead ${overhead}/65536, wrapper ${bytes}/6291456`);
});

test('raw byte-cap geometry leaves wrapper headroom and never raises ordinary evidence capacity',()=>{
  assert.equal(api.AIMOCK_TRACE_LIMITS_V3.evidenceBytes,2097152);
  assert.equal(5592408+65536,5657944); assert(5657944<6291456);
  assert.equal(6291456-5657944,633512);
});

test('raw retention preserves empty incomplete facts and rejects accessors and non-JSON values without invoking them',()=>{
  const s=harness().collector.seal(), raw=api.createAimockTraceRawEvidenceV3(s);
  assert.equal(raw.retainedCompressedBytes,0); assert.equal(raw.payloadBase64,''); assert.equal(raw.receipt.complete,false);
  for(const value of [NaN,undefined,()=>{},new Date()]) {
    const input=structuredClone(s); input.receipt.inventory=value;
    assert.throws(()=>api.createAimockTraceRawEvidenceV3(input),/timeline-raw-json/);
  }
  let invoked=0;
  for(const key of ['toJSON','inventory']) {
    const input=structuredClone(s); Object.defineProperty(input.receipt,key,{get(){invoked++;return {};}});
    assert.throws(()=>api.createAimockTraceRawEvidenceV3(input),/timeline-(raw-json|own-data)/);
  }
  assert.equal(invoked,0);
});

test('exact exports and only five fixed capacity deltas leave all other config and limits unchanged',()=>{
  assert.deepEqual(Object.keys(api).sort(),['AIMOCK_TRACE_CONFIG_V3','AIMOCK_TRACE_LIMITS_V3','createAimockTraceCaptureV3','createAimockTraceRawEvidenceV3'].sort());
  assert.deepEqual(api.AIMOCK_TRACE_LIMITS_V3,{...AIMOCK_TRACE_LIMITS_V2,compressedBytes:4194304,decodedBytes:67108864,base64Characters:5592408,wrapperBytes:6291456});
  assert.deepEqual(api.AIMOCK_TRACE_CONFIG_V3,{...AIMOCK_TRACE_CONFIG_V2,traceConfig:{...AIMOCK_TRACE_CONFIG_V2.traceConfig,traceBufferSizeInKb:16384}});
  assert.equal(Object.keys(api.AIMOCK_TRACE_LIMITS_V3).length,9);
  assert(Object.isFrozen(api.AIMOCK_TRACE_CONFIG_V3.traceConfig.includedCategories));
  assert(Object.isFrozen(api.AIMOCK_TRACE_LIMITS_V3));
});

test('ledger cardinality boundaries and missing optional amounts preserve exact truthful tuples',async()=>{
  for(const count of [0,1,8,9,16,17,1000]) {
    const h=harness(); await h.setup(); h.collector.markPublicAck();
    for(let i=1;i<=count;i++){h.setTime(i);h.pageCDP.emit('Tracing.bufferUsage',i%2?{percentFull:0.1}:{value:0.2,eventCount:i});}
    await h.collector.finish(); const r=h.collector.seal().receipt,b=r.bufferNotificationsV3;
    assert.equal(b.totalCount,count); assert.equal(b.retainedCount,Math.min(count,16));
    assert.equal(b.droppedCount,Math.max(0,count-16)); assert.equal(b.truncated,count>16);
    assert.equal(b.first8.length,Math.min(count,8)); assert.equal(b.last8.length,Math.min(Math.max(count-8,0),8));
    const tuples=[...b.first8,...b.last8]; assert.equal(new Set(tuples.map(x=>x[0])).size,tuples.length);
    for(const [ordinal,stamp,percent,value,events] of tuples)assert.deepEqual([stamp,percent,value,events],ordinal%2?[ordinal,0.1,null,null]:[ordinal,null,0.2,ordinal]);
    assert.equal(r.complete,true); assert.deepEqual(Object.keys(r.bufferUsage),['count','first','last','max']);
    if(count===0)assert.deepEqual(r.bufferUsage,{count:0,first:null,last:null,max:null});
    assert(Buffer.byteLength(JSON.stringify(r))<=16384);
  }
});

test('invalid notification is not fabricated as valid ledger observation or ignored issue',async()=>{
  for(const notification of [{},{percentFull:1.01},{percentFull:-0.1},{value:0.1,eventCount:1.5},{percentFull:NaN},{value:0.1,extra:true}]) {
    const h=harness(); await h.setup(); h.collector.markPublicAck(); h.pageCDP.emit('Tracing.bufferUsage',notification);
    await assert.rejects(h.collector.beforeBrowserClose()); const r=h.collector.seal().receipt;
    assert.equal(r.bufferUsage.count,0); assert.equal(r.bufferNotificationsV3.totalCount,0);
    assert(r.issues.includes('timeline-buffer-usage-invalid')); assert.equal(r.complete,false);
  }
});

test('raw retention refuses old schemas, noncanonical base64, wrong joins and over-cap bytes',async()=>{
  const h=harness(); await h.setup(); h.collector.markPublicAck(); await h.collector.finish(); const original=h.collector.seal();
  for(const mutate of [
    s=>{s.receipt.schema='aimock-trace-capture-v2';},
    s=>{s.payloadBase64+='=';},s=>{s.payloadBase64=' '+s.payloadBase64;},
    s=>{s.receipt.retainedBytes++;},s=>{s.receipt.payloadSha256='b'.repeat(64);},
    s=>{s.extra=true;},s=>{s.receipt.identity.extra=true;},
    s=>{s.payloadBase64=Buffer.alloc(4194305).toString('base64');s.receipt.retainedBytes=4194305;s.receipt.payloadSha256=hash(Buffer.alloc(4194305));},
    s=>{s.payloadBase64='A'.repeat(5592412);},
  ]) { const s=structuredClone(original); mutate(s); assert.throws(()=>api.createAimockTraceRawEvidenceV3(s),/timeline-/); }
  let calls=0; const getter={receipt:original.receipt}; Object.defineProperty(getter,'payloadBase64',{get(){calls++;return original.payloadBase64;}});
  assert.throws(()=>api.createAimockTraceRawEvidenceV3(getter),/timeline-own-data/); assert.equal(calls,0);
  assert.throws(()=>api.createAimockTraceRawEvidenceV3(original,{}),/timeline-raw-arguments/);
  const mutation=structuredClone(original); const raw=api.createAimockTraceRawEvidenceV3(mutation);
  mutation.receipt.identity.id='mutated'; assert.equal(raw.identity.id,identity.id); assert.equal(raw.receipt.identity.id,identity.id);
});

test('synthetic raw receipt byte ceiling is checked at exact boundary and plus1 before any publication',async()=>{
  const h=harness(); await h.setup(); h.collector.markPublicAck(); await h.collector.finish(); const s=structuredClone(h.collector.seal());
  // Representation-boundary model only. Such oversized preview text never
  // qualifies as a valid decoder receipt or a real native capture.
  s.receipt.inventory.browserVersion.text='';
  const base=Buffer.byteLength(JSON.stringify(s.receipt));
  s.receipt.inventory.browserVersion.text='x'.repeat(16384-base);
  assert.equal(Buffer.byteLength(JSON.stringify(s.receipt)),16384);
  assert.equal(api.createAimockTraceRawEvidenceV3(s).receipt.inventory.browserVersion.text.length,16384-base);
  s.receipt.inventory.browserVersion.text+='x';
  assert.throws(()=>api.createAimockTraceRawEvidenceV3(s),/timeline-receipt-bound/);
});

test('raw retention is a closed artifact without validation or embedded event parsing',async()=>{
  const h=harness(); await h.setup(); h.collector.markPublicAck(); await h.collector.finish();
  const s=h.collector.seal();
  const raw=api.createAimockTraceRawEvidenceV3(s);
  assert.equal(raw.schema,'aimock-semantic-large-raw-snapshot-v3');
  assert.deepEqual(Object.keys(raw),['schema','captureProfile','policySha256','identity','traceFormat','compression','payloadEncoding','receipt','retainedCompressedBytes','compressedSha256','payloadBase64','performance','scoringEligibility','FPS','cpuTime']);
  assert.equal(raw.identity.id,identity.id); assert.equal(raw.payloadBase64,s.payloadBase64);
  assert.equal(raw.performance,false); assert.equal(raw.scoringEligibility,false); assert.equal(raw.FPS,null); assert.equal(raw.cpuTime,null);
  assert(Object.isFrozen(raw.receipt)); assert(!Object.hasOwn(raw,'validation'));
});

test('fresh authored collector raw joins the pure decoder; drained loss and 90percent remain refused',async()=>{
  const {decodeSemanticLargeSnapshotV3:decode}=await import('./aimock-trace-decoder-v3.mjs');
  const events=[
    {ph:'I',name:'TracingStartedInBrowser',cat:'disabled-by-default-devtools.timeline',args:{data:{frames:[{frame:'owned',processId:42}]}}},
    {ph:'M',name:'thread_name',pid:42,tid:7,args:{name:'CrRendererMain'}},
    {ph:'X',name:'RunTask',cat:'disabled-by-default-devtools.timeline',pid:42,tid:7,ts:1,dur:50000},
    {ph:'X',name:'Layout',cat:'devtools.timeline',pid:42,tid:7,ts:2,dur:4},
  ];
  for(const mode of ['complete','loss','usage']) {
    const h=harness({bytes:gzipSync(JSON.stringify({traceEvents:events})),autoComplete:false});
    await h.setup(); h.setTime(1); h.collector.markPublicAck();
    for(let i=2;i<=26;i++){h.setTime(i);h.pageCDP.emit('Tracing.bufferUsage',{percentFull:mode==='usage'&&i===12?0.9:0.1});}
    h.setTime(100); const finish=h.collector.beforeBrowserClose(); h.complete({dataLossOccurred:mode==='loss'});
    if(mode==='complete')await finish;else await assert.rejects(finish);
    const raw=api.createAimockTraceRawEvidenceV3(h.collector.seal()), result=decode(raw);
    assert.equal(raw.receipt.eof,true); assert.equal(raw.receipt.bufferNotificationsV3.droppedCount,9);
    assert.equal(result.status,mode==='complete'?'valid':'invalid',result.reason??mode);
    if(mode==='complete'){
      assert.equal(result.rendererMapping.status,'available'); assert.equal(result.rendererMapping.binding.pid,42);
      assert.equal(result.traceEventCount,4); assert.equal(result.costs.tasks.observedCompleteEvents,1);
      assert.equal(result.compressedSha256,raw.compressedSha256);
    }else assert.equal(result.costs,null);
  }
});
