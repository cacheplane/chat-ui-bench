import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,open,stat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as nativePhase from './comparison-proto-native-capture.js';
import syncFs from 'node:fs';
import {body as protoBody,join as protoJoin,text as protoText,uint as protoUint,int32 as protoInt32} from '../../analyzer/src/browser-frame-packet-fragments.test-helper.js';
// Authored projection faults wrap an actual original read; never physical evidence.
const guardFault=vi.hoisted(()=>({project:null as null|((whole:any)=>any)}));
const nativeFileFault=vi.hoisted(()=>({opened:null as null|((file:any,path:unknown)=>void)}));
vi.mock('node:fs/promises',async importOriginal=>{const original=await importOriginal<typeof import('node:fs/promises')>();return {...original,open:async(...args:Parameters<typeof original.open>)=>{const file=await original.open(...args);nativeFileFault.opened?.(file,args[0]);return file;}};});
// Resolve the real source reader through Vitest; no production bundle is built.
vi.mock('node:module',async importOriginal=>{const original=await importOriginal<typeof import('node:module')>(),reader=await import('../../analyzer/src/browser-frame-whole-trace-reader.js');return {...original,createRequire:(...args:Parameters<typeof original.createRequire>)=>{const require=original.createRequire(...args);return Object.assign((id:string)=>id==='@chat-ui-bench/analyzer/internal/whole-annotation'?{...reader,readWholeUserTimingTraceV3:(...args:Parameters<typeof reader.readWholeUserTimingTraceV3>)=>{const whole=reader.readWholeUserTimingTraceV3(...args);return guardFault.project?guardFault.project(whole):whole;}}:require(id),{resolve:require.resolve});}};});

// Source-only owner tests: supplied authored public objects, real exclusive files,
// no browser acquisition or trace input. This is not functional/native evidence.
async function factory(){
  const path='./comparison-proto-native-capture.js';
  const module=await import(/* @vite-ignore */path).catch(()=>({}));
  expect(module.createProtoNativeCapture,'owned adapter factory must exist').toBeTypeOf('function');
  return module.createProtoNativeCapture;
}
function emitter(){
  const listeners=new Map<string,Set<(...args:any[])=>void>>();
  return {on(event:string,listener:(...args:any[])=>void){let set=listeners.get(event);if(!set)listeners.set(event,set=new Set());set.add(listener);},off(event:string,listener:(...args:any[])=>void){listeners.get(event)?.delete(listener);},emit(event:string,value?:unknown){for(const listener of listeners.get(event)??[])listener(value);},count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}};
}
async function setup(){
  const parent=await realpath(await mkdtemp(join(tmpdir(),'native-owner-authored-')));
  const executablePath=join(parent,'authored-vendor.bin');const binary=Buffer.from('authored synthetic vendor bytes');await writeFile(executablePath,binary,{flag:'wx'});
  const directory=join(parent,'exclusive-output');const journal:string[]=[];
  const browserEvents=emitter(),contextEvents=emitter(),pageEvents=emitter(),sessionEvents=emitter();
  let completion:unknown={stream:'owned',traceFormat:'proto',streamCompression:'none',dataLossOccurred:false};
  let frameReply:unknown={frameTree:{frame:{id:'root',loaderId:'loader',url:'https://authored.invalid/'}}};
  let targetReply:unknown={targetInfo:{targetId:'target',type:'page',url:'https://authored.invalid/',browserContextId:'context'}};
  let versionReply:unknown={product:'Chrome/authored',revision:'@authored'};
  let detachHook=async()=>{};let frames:any[];let connected=true,closed=false;
  const frame={};frames=[frame];
  const browser={...browserEvents,isConnected:()=>connected};
  const context={...contextEvents,browser:()=>browser,isClosed:()=>false,pages:()=>[page]};
  const page={...pageEvents,context:()=>context,isClosed:()=>false,mainFrame:()=>frame,frames:()=>frames,url:()=> 'https://authored.invalid/'};
  const session={...sessionEvents,async send(method:string,parameters?:any){journal.push(method);if(method==='Page.getFrameTree')return frameReply;if(method==='Target.getTargetInfo')return targetReply;if(method==='Browser.getVersion')return versionReply;if(method==='Tracing.end'){sessionEvents.emit('Tracing.tracingComplete',completion);return {};}if(method==='IO.read')return {data:'AP8E',base64Encoded:true,eof:true};return {};},async detach(){journal.push('detach');await detachHook();sessionEvents.emit('close');}};
  const timers=new Map<number,{delay:number;callback:()=>void}>();let next=0;
  const clock={nowMs:()=>0,setTimer:(callback:()=>void,delay:number)=>{timers.set(++next,{delay,callback});return next;},clearTimer:(id:unknown)=>{timers.delete(id as number);}};
  const runtime={executablePath,expectedExecutableBytes:binary.length,expectedExecutableSha256:createHash('sha256').update(binary).digest('hex'),playwrightVersion:'1.64.0',browserRevision:'1248',expectedProduct:'Chrome/authored',expectedRevision:'@authored',launchFlags:['--authored'],headless:true};
  const phase={async mark(name:string){journal.push('mark:'+name);}};
  const runner={async close(){journal.push('runner-close');connected=false;browserEvents.emit('disconnected');},async wait(){journal.push('runner-wait');return {exitCode:0,signal:null};}};
  return {parent,directory,journal,page,context,browser,session,clock,runtime,phase,runner,timers,
    inputs:{page,context,browser,session,clock,runtime,phase,runner,outputDirectory:directory,runId:'authored-run',phaseId:'authored-phase'},
    setFrame(value:unknown){frameReply=value;},setTarget(value:unknown){targetReply=value;},setVersion(value:unknown){versionReply=value;},setFrames(value:any[]){frames=value;},setCompletion(value:unknown){completion=value;},onDetach(hook:()=>Promise<void>){detachHook=hook;},
    async dispose(){await rm(parent,{recursive:true,force:true});}};
}
async function fixture(body:(h:Awaited<ReturnType<typeof setup>>,create:any)=>Promise<void>){const h=await setup();try{await body(h,await factory());}finally{await h.dispose();}}
function unqualified(r:any){expect(r.analysis).toBe('not_evaluated');for(const key of ['qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported'])expect(r[key]).toBe(false);expect(r.targetLifetime).toBe('unestablished');expect(r.clockAdmission).toBe('not_evaluated');}
async function capture(h:any,create:any){const owner=create(h.inputs);const started=await owner.start();expect(started.status,JSON.stringify(started)).toBe('open');await owner.mark('start');await owner.mark('end');const receipt=await owner.finish();return {owner,receipt};}
const tailBinding=Object.freeze({nonce:'authored-tail-nonce',requestSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),sourceRevision:'c'.repeat(40)});
async function tailFixture(body:(h:Awaited<ReturnType<typeof setup>>,owner:any,control:{tick(ms:number):void;invalidate():void;checks:string[];setNow(ms:number):void;setRemaining(ms:number):void;inputs:any})=>Promise<void>){
 const h=await setup();let now=0,remaining=17000,invalid=false,subscriber:(()=>void)|undefined;const checks:string[]=[];
 h.clock.nowMs=()=>now;
 const inputs={...h.inputs,binding:tailBinding,tailGuard:{assertHealthy(){checks.push('healthy');if(invalid)throw Error('invalid');},onInvalidated(callback:()=>void){checks.push('subscribe');subscriber=callback;return()=>{checks.push('unsubscribe');subscriber=undefined;};},assertForwardDeadline(){checks.push('deadline');}},assertTailHeadroom(){checks.push('headroom');if(remaining<500)throw Error('anchored headroom');}};
 const create=(nativePhase as any).createProtoNativeUserTimingCaptureV6Tail500;expect(create,'immutable Tail500 factory').toBeTypeOf('function');
 const owner=create(inputs);
 try{await owner.start();await owner.mark('start');await owner.mark('end');await body(h,owner,{inputs,checks,tick(ms){now=ms;for(const timer of [...h.timers.values()])if(timer.delay===500)timer.callback();},invalidate(){invalid=true;subscriber?.();},setNow(ms){now=ms;},setRemaining(ms){remaining=ms;}});}finally{await h.dispose();}
}
const inspectTail=(owner:unknown):any=>{const inspect=(nativePhase as any).inspectProtoNativeTail500Receipt;expect(inspect,'registered owned receipt inspector').toBeTypeOf('function');return inspect(owner);};
it('Tail500 retains recording until one fixed timer fulfills and exports the actual owned receipt',async()=>tailFixture(async(h,owner,c)=>{
 c.setRemaining(500);
 const set=h.clock.setTimer;h.clock.setTimer=(cb,ms)=>{if(ms===500)h.journal.push('tail-begin');return set(cb,ms);};h.journal.push('authored-release-handles');
 const promise=owner.finish();expect(owner.finish()).toBe(promise);await Promise.resolve();
 expect(c.checks).toEqual(['subscribe','healthy','headroom']);expect(h.journal).not.toContain('Tracing.end');
 expect([...h.timers.values()].filter(t=>t.delay===500)).toHaveLength(1);
 expect(h.page.count()+h.context.count()+h.browser.count()+h.session.count()).toBeGreaterThan(14);c.setNow(499);await Promise.resolve();expect(h.journal).not.toContain('Tracing.end');c.tick(500);
 const receipt=await promise;expect(receipt.status,JSON.stringify(receipt)).toBe('closed');expect(h.journal.filter(s=>s==='Tracing.end')).toHaveLength(1);
 expect(receipt).toMatchObject({collectionPolicy:'native-post-phase-tail-500ms-v1',binding:tailBinding,tail:{requestedMs:500,state:'fulfilled',timer:{registrationState:'registered',disposalState:'cleared'}}});unqualified(receipt);
 const p=inspectTail(owner);expect(inspectTail(owner)).toBe(p);const result=await p;
 expect(result).toEqual({schema:1,collectionPolicy:'native-post-phase-tail-500ms-v1',...tailBinding,intent:{bytes:(await readFile(join(h.directory,'intent.json'))).length,sha256:createHash('sha256').update(await readFile(join(h.directory,'intent.json'))).digest('hex')},receipt:{bytes:(await readFile(join(h.directory,'receipt.json'))).length,sha256:createHash('sha256').update(await readFile(join(h.directory,'receipt.json'))).digest('hex')},tail:{requestedMs:500,state:'fulfilled'},trace:receipt.persisted});
 expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1536);expect(Object.isFrozen(result)).toBe(true);expect(c.checks.filter(s=>s==='healthy')).toHaveLength(2);expect(c.checks).toContain('deadline');
 const saved=JSON.parse(await readFile(join(h.directory,'receipt.json'),'utf8'));expect(saved.operations.find((op:any)=>op.kind==='write-receipt').state).toBe('pending');
 expect(h.journal.findIndex(s=>s.startsWith('mark:')&&s.includes(':end:'))).toBeLessThan(h.journal.indexOf('authored-release-handles'));expect(h.journal.indexOf('authored-release-handles')).toBeLessThan(h.journal.indexOf('tail-begin'));expect(h.journal.indexOf('tail-begin')).toBeLessThan(h.journal.indexOf('Tracing.end'));expect(h.timers.size).toBe(0);expect(h.page.count()+h.context.count()+h.browser.count()+h.session.count()).toBe(0);
}));
for(const mode of ['replace','oversize','policy','nonce','request','manifest','revision','tail']as const)it('Tail500 inspector refuses actual intent '+mode,async()=>tailFixture(async(h,owner,c)=>{
 const final=owner.finish();await Promise.resolve();c.tick(500);await final;const path=join(h.directory,'intent.json'),bytes=await readFile(path);
 if(mode==='replace'){await rename(path,path+'.original');await writeFile(path,bytes,{flag:'wx'});}else if(mode==='oversize')await writeFile(path,Buffer.alloc(16385));else{const data=JSON.parse(bytes.toString());if(mode==='policy')data.collectionPolicy='foreign';else if(mode==='tail')data.tail.requestedMs=499;else data.binding[mode==='nonce'?'nonce':mode==='request'?'requestSha256':mode==='manifest'?'manifestSha256':'sourceRevision']='foreign';await writeFile(path,JSON.stringify(data)+'\n');}
 expect(await inspectTail(owner)).toMatchObject({status:'unavailable',reason:'receipt-unavailable'});
}));
for(const mode of ['early','backwards','nonfinite','invalidate','crash','close']as const)it('Tail500 refuses and cancels '+mode+' without a normal end or duplicate seal',async()=>tailFixture(async(h,owner,c)=>{
 const promise=owner.finish();await Promise.resolve();const callback=[...h.timers.values()].find(t=>t.delay===500)!.callback;
 if(mode==='early')c.tick(499);if(mode==='backwards')c.tick(-1);if(mode==='nonfinite')c.tick(NaN);if(mode==='invalidate')c.invalidate();if(mode==='crash')h.page.emit('crash');if(mode==='close'){const close=owner.close();expect(owner.close()).toBe(close);await close;}
 const result=await promise;expect(result.status).not.toBe('closed');expect(result.failureCount).toBeGreaterThan(0);expect(h.journal.filter(s=>s==='Tracing.end')).toHaveLength(0);callback();await Promise.resolve();
 expect(h.journal.filter(s=>s==='runner-close')).toHaveLength(1);expect(h.journal.filter(s=>s==='runner-wait')).toHaveLength(1);expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);expect(result.operations.filter((op:any)=>op.kind==='write-receipt')).toHaveLength(1);expect([...h.timers.values()].filter(t=>t.delay===500)).toHaveLength(0);expect(await inspectTail(owner)).toMatchObject({status:'unavailable'});
}));
it('Tail500 inspector refuses legacy, fake and prematurely inspected owners permanently',async()=>fixture(async(h,create)=>{
 for(const owner of [{collectionPolicy:'native-post-phase-tail-500ms-v1',...tailBinding},create(h.inputs),null,new Proxy({},{get(){throw Error();}})])expect(await inspectTail(owner)).toMatchObject({status:'unavailable',reason:'unregistered-owner'});
}));
it('Tail500 close before start joins original detach and runner cleanup once without subscribing',async()=>fixture(async(h,_create)=>{
 let subscriptions=0;const owner=nativePhase.createProtoNativeUserTimingCaptureV6Tail500({...h.inputs,binding:tailBinding,tailGuard:{assertHealthy(){throw Error('no active capture');},onInvalidated(){subscriptions++;return()=>{};},assertForwardDeadline(){}},assertTailHeadroom(){throw Error('no active capture');}});
 const closing=owner.close();expect(owner.close()).toBe(closing);const receipt=await closing;expect(receipt.status).toBe('unavailable');expect(subscriptions).toBe(0);expect(h.journal.filter(x=>x==='detach')).toHaveLength(1);expect(h.journal.filter(x=>x==='runner-close')).toHaveLength(1);expect(h.journal.filter(x=>x==='runner-wait')).toHaveLength(1);expect(receipt.createdRoles).toEqual([]);expect(await inspectTail(owner)).toMatchObject({status:'unavailable'});
}));
for(const mode of ['replace','drift','hardlink','symlink','oversize','policy','binding','tail']as const)it('Tail500 inspector refuses actual owned metadata '+mode,async()=>tailFixture(async(h,owner,c)=>{
 const p=owner.finish();await Promise.resolve();c.tick(500);expect((await p).status).toBe('closed');const path=join(h.directory,'receipt.json'),original=await readFile(path);
 if(mode==='replace'){await rename(path,path+'.old');await writeFile(path,original,{flag:'wx'});}else if(mode==='hardlink'){await syncFs.promises.link(path,path+'.link');}else if(mode==='symlink'){await rename(path,path+'.old');await syncFs.promises.symlink(path+'.old',path);}else if(mode==='oversize')await writeFile(path,Buffer.alloc(262145));else if(mode==='drift')await writeFile(path,Buffer.from(original.toString().replace('not_evaluated','not_evaluateX')));else{const data=JSON.parse(original.toString());if(mode==='policy')data.collectionPolicy='foreign';if(mode==='binding')data.binding.nonce='foreign';if(mode==='tail')data.tail.state='pending';await writeFile(path,JSON.stringify(data)+'\n');}
 const inspected=inspectTail(owner);expect(await inspected).toMatchObject({status:'unavailable'});expect(inspectTail(owner)).toBe(inspected);
}));
it('Tail500 close after a closed finish joins the same terminal without invalidating observed facts',async()=>tailFixture(async(_h,owner,c)=>{
 const final=owner.finish();await Promise.resolve();c.tick(500);await final;const close=owner.close();expect(owner.close()).toBe(close);expect(close).toBe(final);expect((await inspectTail(owner)).schema).toBe(1);
}));
it('Tail500 close before the terminal microtask prevents a timer and converges on one seal',async()=>tailFixture(async(h,owner,c)=>{
 const final=owner.finish(),closed=owner.close();expect(owner.finish()).toBe(final);expect(owner.close()).toBe(closed);const result=await final;await closed;
 expect(result.failureCount).toBeGreaterThan(0);expect(c.checks).toEqual([]);expect(h.journal).not.toContain('Tracing.end');expect(h.journal.filter(x=>x==='detach')).toHaveLength(1);expect(result.operations.filter((op:any)=>op.kind==='write-receipt')).toHaveLength(1);
}));
for(const mode of ['timer-install','timer-clear','clock-throw','initial-nonfinite','guard-check','guard-subscribe','guard-remove','headroom','timeout','topology']as const)it('Tail500 owns '+mode+' refusal without retry or unhandled cancellation',async()=>tailFixture(async(h,owner,c)=>{
 const set=h.clock.setTimer,clear=h.clock.clearTimer;let callback:(()=>void)|undefined;
 if(mode==='timer-install')h.clock.setTimer=(cb,ms)=>{const token=set(cb,ms);if(ms===500){callback=cb;throw Error('installed unknown');}return token;};
 if(mode==='timer-clear')h.clock.clearTimer=token=>{const tail=h.timers.get(token as number)?.delay===500;clear(token);if(tail)throw Error('clear failed');};
 if(mode==='clock-throw')h.clock.nowMs=()=>{throw Error('clock');};if(mode==='initial-nonfinite')c.setNow(Infinity);
 if(mode==='guard-check')c.inputs.tailGuard.assertHealthy=()=>{throw Error('health');};if(mode==='guard-subscribe')c.inputs.tailGuard.onInvalidated=()=>{throw Error('subscribe');};if(mode==='guard-remove')c.inputs.tailGuard.onInvalidated=()=>()=>{throw Error('unsubscribe');};
 // This closure models the worker-owned assertion; the owner must neither renew nor reinterpret it.
 if(mode==='headroom')c.setRemaining(499);
 const final=owner.finish();await Promise.resolve();if(mode==='timeout'){[...h.timers.values()].find(t=>t.delay===60000)!.callback();}else if(mode==='topology'){h.context.emit('page');}else if(mode==='guard-remove')c.tick(500);else if([...h.timers.values()].some(t=>t.delay===500))c.tick(500);
 const receipt=await final;expect(receipt.status).not.toBe('closed');expect(receipt.failureCount).toBeGreaterThan(0);callback?.();await Promise.resolve();expect(h.journal.filter(x=>x==='Tracing.end')).toHaveLength(mode==='guard-remove'?1:0);expect(h.journal.filter(x=>x==='runner-close')).toHaveLength(1);expect(await inspectTail(owner)).toMatchObject({status:'unavailable'});
}));
it('Tail500 close during pending original raw close converges without a second sink close or seal',async()=>tailFixture(async(h,owner,c)=>{
 const handle=await open(h.runtime.executablePath,'r'),proto=Object.getPrototypeOf(handle);await handle.close();const sync=proto.sync;let enter!:()=>void,release!:()=>void,calls=0;const entered=new Promise<void>(done=>{enter=done;});
 const spy=vi.spyOn(proto,'sync').mockImplementation(async function(this:any){await sync.call(this);if(++calls===1)await new Promise<void>(done=>{release=done;enter();});});
 try{const final=owner.finish();await Promise.resolve();c.tick(500);await entered;expect(owner.snapshot().originalOperationsSettled).toBe(false);const closing=owner.close();expect(owner.close()).toBe(closing);release();const receipt=await final;await closing;
  expect(receipt.status).toBe('unavailable');expect(receipt.transport.sinkClose).toBe('fulfilled');expect(h.journal.filter(x=>x==='detach')).toHaveLength(1);expect(h.journal.filter(x=>x==='runner-close')).toHaveLength(1);expect(receipt.operations.filter((op:any)=>op.kind==='write-receipt')).toHaveLength(1);expect(calls).toBe(5);expect(await inspectTail(owner)).toMatchObject({status:'unavailable'});
 }finally{spy.mockRestore();}
}));
it('Tail500 delegates equality headroom once and does not renew the anchored deadline at the callback',async()=>tailFixture(async(h,owner,c)=>{
 c.setRemaining(500);c.inputs.tailGuard.assertHealthy=()=>{c.checks.push('healthy');if(h.clock.nowMs()>=17000)throw Error('original deadline equality');};c.setNow(16500);
 const final=owner.finish();await Promise.resolve();expect(c.checks.filter(s=>s==='headroom')).toHaveLength(1);expect([...h.timers.values()].filter(t=>t.delay===500)).toHaveLength(1);c.tick(17000);expect((await final).status).not.toBe('closed');expect(c.checks.filter(s=>s==='headroom')).toHaveLength(1);expect(h.journal).not.toContain('Tracing.end');
}));
it('legacy factories never read new binding, guard or headroom getters and preserve exact DTO keys and timer calls',async()=>fixture(async(h,_create)=>{
 let reads=0;for(const key of ['binding','tailGuard','assertTailHeadroom'])Object.defineProperty(h.inputs,key,{get(){reads++;throw Error('legacy read new input');}});
 const delays:number[]=[],set=h.clock.setTimer;h.clock.setTimer=(cb,ms)=>{delays.push(ms);return set(cb,ms);};
 const {receipt}=await capture(h,nativePhase.createProtoNativeUserTimingCaptureV6);expect(reads).toBe(0);expect(delays).not.toContain(500);expect(delays.filter(ms=>ms===60000)).toHaveLength(1);expect(Object.keys(receipt).sort()).toEqual(['schemaVersion','policy','status','failures','failureCount','createdRoles','operations','originalOperationsSettled','transport','persistedWholeInput','persisted','target','runtime','marks','runner','analysis','qualification','captureQualified','fpsEligibility','evaluationEligibility','scoringEligibility','rankingEligibility','nativeSupported','targetLifetime','clockAdmission'].sort());
 const intent=JSON.parse(await readFile(join(h.directory,'intent.json'),'utf8'));expect(Object.keys(intent).sort()).toEqual(['schemaVersion','policy','runId','phaseId','runtime','analysis'].sort());
}));
it('Tail500 premature registered inspection stays refused after successful completion',async()=>tailFixture(async(_h,owner,c)=>{
 const inspection=inspectTail(owner);expect(await inspection).toEqual({status:'unavailable',reason:'owner-not-ready'});const finish=owner.finish();await Promise.resolve();c.tick(500);expect((await finish).status).toBe('closed');expect(inspectTail(owner)).toBe(inspection);expect(await inspection).toEqual({status:'unavailable',reason:'owner-not-ready'});
}));
it('Tail500 close after normal end dispatch joins one original collector cleanup and one seal',async()=>tailFixture(async(h,owner,c)=>{
 const send=h.session.send;let close:any;h.session.send=async(method,parameters)=>{if(method==='Tracing.end'){close=owner.close();expect(owner.close()).toBe(close);}return send(method,parameters);};
 const final=owner.finish();await Promise.resolve();c.tick(500);const receipt=await final;await close;
 expect(receipt.status).not.toBe('closed');expect(h.journal.filter(x=>x==='Tracing.end')).toHaveLength(1);expect(h.journal.filter(x=>x==='detach')).toHaveLength(1);expect(h.journal.filter(x=>x==='runner-close')).toHaveLength(1);expect(receipt.operations.filter((op:any)=>op.kind==='write-receipt')).toHaveLength(1);expect(await inspectTail(owner)).toMatchObject({status:'unavailable'});
}));
for(const late of [false,true])it('Tail500 close during receipt write owns one seal and preserves '+(late?'late original settlement':'actual completed refusal'),async()=>tailFixture(async(h,owner,c)=>{
 const handle=await open(h.runtime.executablePath,'r'),proto=Object.getPrototypeOf(handle);await handle.close();const write=proto.write;let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(done=>{enter=done;});let writes=0;
 const spy=vi.spyOn(proto,'write').mockImplementation(async function(this:any,...args:any[]){const ack=await write.apply(this,args);if(Buffer.isBuffer(args[0])&&args[0].toString().includes('"createdRoles"')){writes++;await new Promise<void>(done=>{release=done;enter();});}return ack;});
 try{const final=owner.finish();await Promise.resolve();c.tick(500);await entered;const closed=owner.close();expect(owner.close()).toBe(closed);
  if(late){for(const timer of [...h.timers.values()])if(timer.delay===10000)timer.callback();}else release();
  const receipt=await final;await closed;expect(receipt.status).toBe(late?'pending':'unavailable');expect(writes).toBe(1);const inspection=inspectTail(owner);expect(await inspection).toMatchObject({status:'unavailable'});
  if(late){expect(receipt.operations.find((op:any)=>op.kind==='write-receipt').state).toBe('pending');release();await vi.waitFor(()=>expect(owner.snapshot().operations.find((op:any)=>op.kind==='write-receipt').state).toBe('fulfilled'));expect(owner.snapshot().status).not.toBe('closed');expect(inspectTail(owner)).toBe(inspection);expect(writes).toBe(1);}
  expect(h.journal.filter(x=>x==='detach')).toHaveLength(1);expect(h.journal.filter(x=>x==='runner-close')).toHaveLength(1);
 }finally{spy.mockRestore();}
}));
for(const mode of ['EOF','stat','close','deadline','pending-read','pending-close']as const)it('Tail500 inspector owns bounded original '+mode+' refusal and caches it',async()=>tailFixture(async(h,owner,c)=>{
 const final=owner.finish();await Promise.resolve();c.tick(500);expect((await final).status).toBe('closed');
 const handle=await open(h.runtime.executablePath,'r'),proto=Object.getPrototypeOf(handle);await handle.close();let spy:any,release!:()=>void,enter!:()=>void;const entered=new Promise<void>(done=>{enter=done;});let calls=0;
 if(mode==='EOF'){const read=proto.read;spy=vi.spyOn(proto,'read').mockImplementation(async function(this:any,...args:any[]){const actual=await read.apply(this,args);return args[2]===1?{...actual,bytesRead:1}:actual;});}
 if(mode==='stat'){const get=proto.stat;spy=vi.spyOn(proto,'stat').mockImplementation(async function(this:any,...args:any[]){const actual=await get.apply(this,args);if(++calls===2)actual.ctimeMs+=1;return actual;});}
 if(mode==='close')nativeFileFault.opened=(file,path)=>{if(path===join(h.directory,'intent.json')){const close=file.close;file.close=async()=>{await close.call(file);throw Error('original close rejected');};}};
 if(mode==='deadline')c.inputs.tailGuard.assertForwardDeadline=()=>{throw Error('anchored worker deadline');};
 if(mode==='pending-read'){const read=proto.read;spy=vi.spyOn(proto,'read').mockImplementation(async function(this:any,...args:any[]){const actual=await read.apply(this,args);if(++calls===1)await new Promise<void>(done=>{release=done;enter();});return actual;});}
 if(mode==='pending-close')nativeFileFault.opened=(file,path)=>{if(path===join(h.directory,'intent.json')){const close=file.close;file.close=async()=>{await close.call(file);if(++calls===1)await new Promise<void>(done=>{release=done;enter();});};}};
 try{const inspection=inspectTail(owner);expect(inspectTail(owner)).toBe(inspection);if(mode.startsWith('pending-')){await entered;for(const timer of [...h.timers.values()])if(timer.delay===10000)timer.callback();}
  expect(await inspection).toEqual({status:'unavailable',reason:'receipt-unavailable'});expect(inspectTail(owner)).toBe(inspection);
  if(mode.startsWith('pending-')){expect(owner.snapshot().originalOperationsSettled).toBe(false);release();await vi.waitFor(()=>expect(owner.snapshot().originalOperationsSettled).toBe(true));expect(inspectTail(owner)).toBe(inspection);expect(await inspection).toMatchObject({status:'unavailable'});expect(owner.snapshot().status).not.toBe('closed');}
 }finally{nativeFileFault.opened=null;spy?.mockRestore();}
}));
it('Tail500 inspector permanently refuses when the anchored deadline expires during final original receipt close',async()=>tailFixture(async(h,owner,c)=>{
 const final=owner.finish();await Promise.resolve();c.tick(500);expect((await final).status).toBe('closed');let expired=false,closes=0;
 c.inputs.tailGuard.assertForwardDeadline=()=>{if(expired)throw Error('anchored deadline expired');};
 nativeFileFault.opened=(file,path)=>{if(path===join(h.directory,'receipt.json')){const close=file.close;file.close=async()=>{await close.call(file);closes++;expired=true;};}};
 try{const inspection=inspectTail(owner);expect(await inspection).toEqual({status:'unavailable',reason:'receipt-unavailable'});expect(closes).toBe(1);expect(owner.snapshot().originalOperationsSettled).toBe(true);expect(owner.snapshot().operations.find((op:any)=>op.kind==='inspect-close-receipt.json').state).toBe('fulfilled');expired=false;expect(inspectTail(owner)).toBe(inspection);expect(await inspection).toEqual({status:'unavailable',reason:'receipt-unavailable'});expect(closes).toBe(1);}
 finally{nativeFileFault.opened=null;}
}));
it('Tail500 inspector caches before descriptor work and uses only the forward deadline after detach',async()=>tailFixture(async(h,owner,c)=>{
 const final=owner.finish();await Promise.resolve();c.tick(500);await final;let reads=0,inner:any;
 c.inputs.tailGuard.assertHealthy=()=>{throw Error('live identity deliberately unavailable after detach');};
 nativeFileFault.opened=(_file,path)=>{if(path===join(h.directory,'intent.json')||path===join(h.directory,'receipt.json')){reads++;inner=inspectTail(owner);}};
 try{const inspection=inspectTail(owner);expect((await inspection).schema).toBe(1);expect(inner).toBe(inspection);expect(reads).toBe(2);expect(owner.snapshot().operations.filter((op:any)=>op.kind.startsWith('inspect-'))).toEqual(expect.arrayContaining([expect.objectContaining({kind:'inspect-read-intent.json',state:'fulfilled'}),expect.objectContaining({kind:'inspect-close-intent.json',state:'fulfilled'}),expect.objectContaining({kind:'inspect-read-receipt.json',state:'fulfilled'}),expect.objectContaining({kind:'inspect-close-receipt.json',state:'fulfilled'})]));expect(owner.snapshot().operations.length).toBeLessThanOrEqual(64);expect(owner.snapshot().originalOperationsSettled).toBe(true);}
 finally{nativeFileFault.opened=null;}
}));
function inspectPhase(owner:unknown):any {
 const inspect=(nativePhase as unknown as Record<string,unknown>).inspectProtoNativePhase;
 expect(inspect,'new synchronous source-owned phase inspection export').toBeTypeOf('function');
 return (inspect as (owner:unknown)=>unknown)(owner);
}
async function phaseFixture(run:(h:Awaited<ReturnType<typeof setup>>,owner:ReturnType<typeof nativePhase.createProtoNativeCapture>,r:any,names:string[])=>Promise<void>,mode='pair',modern:boolean|'v3'|'v4'|'v5'|'v6'|'tail500'=false){
 await fixture(async(h,create)=>{
  const names:string[]=[],mark=h.phase.mark,send=h.session.send;
  if(mode==='escaped'){h.inputs.runId='"\\'.repeat(16);h.inputs.phaseId='"\\'.repeat(16);h.setTarget({targetInfo:{targetId:'"\\'.repeat(128),type:'page',url:'https://authored.invalid/',browserContextId:'context'}});}
  h.phase.mark=async name=>{names.push(name);await mark(name);};
  h.session.send=async(method,parameters)=>{
   if(method==='IO.read'){
    expect(names).toHaveLength(2);
    const marker=(name:string,i:number,extra:Uint8Array[]=[])=>protoBody(1,protoJoin(protoUint(10,1n),...(mode.startsWith('counter-defaults')?[]:[protoUint(13,1n)]),protoUint(8,i?100n:900n),protoBody(11,protoJoin(...(modern?[protoUint(9,3n),protoText(22,'blink.user_timing'),protoText(23,mode==='annotation'?'performance.mark':name),...(mode==='annotation'?[protoBody(4,protoJoin(protoText(10,'markName'),protoText(6,name)))]:[])]:[protoBody(4,protoJoin(protoText(10,'markName'),protoText(6,name)))]),...extra))));
    let packets=names.map((name,i)=>marker(name,i));
    if(mode==='duplicate-start')packets.push(marker(names[0]!,2));if(mode==='duplicate-end')packets.push(marker(names[1]!,2));
    if(mode==='foreign')packets.push(marker('native:authored-run:authored-phase:other',2));
    if(mode==='outside')packets.push(marker('unrelated',2));
    if(mode==='missing-start')packets=packets.slice(1);if(mode==='missing-end')packets=packets.slice(0,1);
    if(mode==='reverse')packets.reverse();
    if(mode==='withheld')packets[0]=marker(names[0]!,0,[protoBody(4,protoJoin(protoUint(1,9n),protoText(6,'unresolved')))]);
    if(mode==='loss')packets[1]=protoBody(1,protoJoin(protoUint(10,1n),protoUint(42,1n),protoBody(11,modern?protoJoin(protoUint(9,3n),protoText(22,'blink.user_timing'),protoText(23,names[1]!)):protoBody(4,protoJoin(protoText(10,'markName'),protoText(6,names[1]!))))));
    if(mode==='128'||mode==='129')for(let i=2;i<Number(mode);i++)packets.push(marker('unrelated-'+i,i));
    if(mode==='malformed-tail')packets.push(Uint8Array.of(10,2,0));
    if(mode==='duplicate-timestamp')packets.push(protoBody(1,protoJoin(protoUint(8,1n),protoUint(8,2n))));
    if(mode.startsWith('unsupported-field-'))packets.push(protoBody(1,protoBody(Number(mode.slice('unsupported-field-'.length)),new Uint8Array())));
    if(mode.startsWith('provenance124'))packets.push(protoBody(1,protoJoin(protoInt32(3,0n),protoUint(8,17n),protoUint(10,1n),protoUint(58,6n),protoBody(124,protoBody(2,protoBody(1,protoJoin(protoUint(1,0n),protoInt32(2,-1n))))))));
    if(mode==='provenance124-then125')packets.push(protoBody(1,protoBody(125,new Uint8Array())));
    if(mode.startsWith('counter-defaults'))packets.unshift(protoBody(1,protoJoin(protoUint(10,1n),protoUint(13,1n),protoBody(59,protoJoin(protoUint(58,3n),protoBody(11,protoJoin(protoUint(11,7n),protoUint(31,1234n))))))));
    if(mode==='counter-defaults-late125')packets.push(protoBody(1,protoBody(125,new Uint8Array())));
    if(mode.startsWith('sequence-start')){if(mode.includes('history'))packets.push(protoBody(1,protoUint(10,15n)));packets.push(protoBody(1,protoJoin(protoUint(10,15n),...(mode.includes('absent')?[]:[protoUint(87,1n)]),protoUint(42,mode.includes('257')?257n:1n),...(mode.includes('reset')?[protoUint(13,1n)]:[]))));if(mode.includes('late125'))packets.push(protoBody(1,protoBody(125,new Uint8Array())));}
    const bytes=protoJoin(...packets);
    return {data:Buffer.from(bytes).toString('base64'),base64Encoded:true,eof:true};
   }
   return send(method,parameters);
  };
  if(modern){create=(nativePhase as unknown as Record<string,any>)[modern==='tail500'?'createProtoNativeUserTimingCaptureV6Tail500':modern==='v6'?'createProtoNativeUserTimingCaptureV6':modern==='v5'?'createProtoNativeUserTimingCaptureV5':modern==='v4'?'createProtoNativeUserTimingCaptureV4':modern==='v3'?'createProtoNativeUserTimingCaptureV3':'createProtoNativeUserTimingCapture'];expect(create,'versioned capture factory').toBeTypeOf('function');}
  if(modern==='tail500')Object.assign(h.inputs,{binding:tailBinding,tailGuard:{assertHealthy(){},onInvalidated(){return()=>{};},assertForwardDeadline(){}},assertTailHeadroom(){}});
  const owner=create(h.inputs);expect((await owner.start()).status).toBe('open');await owner.mark('start');await owner.mark('end');
  const finishing=owner.finish();expect(owner.finish()).toBe(finishing);if(modern==='tail500'){await Promise.resolve();h.clock.nowMs=()=>500;for(const timer of [...h.timers.values()])if(timer.delay===500)timer.callback();}const r=await finishing;expect(r.status).toBe('closed');
  await run(h,owner,r,names);
 });
}
const inspectTimingV3=(owner:unknown):any=>{const inspect=(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhaseV3;expect(inspect).toBeTypeOf('function');return inspect(owner);};
const inspectTimingV4=(owner:unknown):any=>{const inspect=(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhaseV4;expect(inspect).toBeTypeOf('function');return inspect(owner);};
const inspectTimingV5=(owner:unknown):any=>{const inspect=(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhaseV5;expect(inspect).toBeTypeOf('function');return inspect(owner);};
it('Tail500 uses the unchanged V6 reader and phase boundaries with no new authority',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const read=vi.spyOn(syncFs,'openSync');try{const result=nativePhase.inspectProtoNativeUserTimingPhaseV6(owner);expect(result).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v6',status:'phase-registry-inventory-diagnostic',rows:names.map(name=>({name,representation:'event_name'})),authority:{FPS:null,duration:null,clockAdmission:'not_evaluated',nativeSupported:false}});expect(read).toHaveBeenCalledTimes(1);expect(nativePhase.inspectProtoNativeUserTimingPhaseV6(owner)).toBe(result);expect(read).toHaveBeenCalledTimes(1);expect(Object.keys(result).sort()).toEqual(['policy','wholeInputFailure','status','reason','runId','phaseId','targetId','input','counters','rows','authority'].sort());expect(Object.keys(result.rows[0]!)).toHaveLength(22);}
 finally{read.mockRestore();}
},'pair','tail500'));
it('V5 owner accepts counter-default metadata with one original inspection and fixed false authority',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const read=vi.spyOn(syncFs,'openSync');try{expect(inspectTimingV4(owner)).toMatchObject({reason:'unregistered-owner',wholeInputFailure:null});expect(read).not.toHaveBeenCalled();const r=inspectTimingV5(owner);expect(r).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v5',status:'phase-registry-inventory-diagnostic',wholeInputFailure:null,counters:{packets:3},rows:names.map(name=>({name,trackUuid:'7',clockId:'3'})),authority:{nativeSupported:false,FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false}});expect(inspectTimingV5(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);expect(Object.isFrozen(r)).toBe(true);}finally{read.mockRestore();}
},'counter-defaults','v5'));
it('V5 preserves late whole failure and original closed reader observations',async()=>phaseFixture(async(_h,owner)=>{expect(inspectTimingV5(owner)).toMatchObject({status:'unavailable',rows:[],wholeInputFailure:{reader:{EOF:true,closed:true,fullInputVerified:true},firstSemanticDiagnostic:{packetIndex:3,cause:'unsupported-packet-payload-field-125'}}});},'counter-defaults-late125','v5'));
it('V5 refuses other-version owners without IO and caches premature inspection',async()=>fixture(async(h,create)=>{
 const factory=(nativePhase as unknown as Record<string,any>).createProtoNativeUserTimingCaptureV5;expect(factory).toBeTypeOf('function');const old=create(h.inputs),v2=nativePhase.createProtoNativeUserTimingCapture(h.inputs),v3=nativePhase.createProtoNativeUserTimingCaptureV3(h.inputs),v4=nativePhase.createProtoNativeUserTimingCaptureV4(h.inputs),v5=factory(h.inputs),read=vi.spyOn(syncFs,'openSync');try{for(const x of [null,{},new Proxy({},{get(){throw Error('no reflection');}}),old,v2,v3,v4])expect(inspectTimingV5(x)).toMatchObject({reason:'unregistered-owner',wholeInputFailure:null});const first=inspectTimingV5(v5);expect(first).toMatchObject({reason:'owner-not-ready',wholeInputFailure:null});await v5.start();await v5.mark('start');await v5.mark('end');await v5.finish();expect(inspectTimingV5(v5)).toBe(first);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));

it('V4 owner admits bounded protobuf124 while preserving one-shot inspection and all false authority',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const read=vi.spyOn(syncFs,'openSync');try{
  expect(inspectPhase(owner).reason).toBe('unregistered-owner');expect(inspectTiming(owner).reason).toBe('unregistered-owner');expect(inspectTimingV3(owner).reason).toBe('unregistered-owner');expect(read).not.toHaveBeenCalled();
  const result=inspectTimingV4(owner);expect(result).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v4',status:'phase-registry-inventory-diagnostic',wholeInputFailure:null,counters:{packets:3},rows:names.map(name=>({name,representation:'event_name'})),authority:{captureQualified:false,qualification:false,nativeSupported:false,FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false}});expect(inspectTimingV4(owner)).toBe(result);expect(read).toHaveBeenCalledTimes(1);expect(Object.isFrozen(result)).toBe(true);expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(8192);
 }finally{read.mockRestore();}
},'provenance124','v4'));
it('V4 late125 still withholds the complete earlier phase pair and preserves original refusal cause',async()=>phaseFixture(async(_h,owner)=>{
 const read=vi.spyOn(syncFs,'openSync');try{const result=inspectTimingV4(owner);expect(result).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v4',status:'unavailable',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reason:'fragment-unavailable',reader:{EOF:true,closed:true,hashMatch:true,fullInputVerified:true,structuralContainerEOF:true},firstSemanticDiagnostic:{packetIndex:3,component:'packet',cause:'unsupported-packet-payload-field-125'}},authority:{FPS:null,nativeSupported:false}});expect(inspectTimingV4(owner)).toBe(result);expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();}
},'provenance124-then125','v4'));
it('V3 owner continues refusing identical protobuf124 bytes',async()=>phaseFixture(async(_h,owner)=>{expect(inspectTimingV3(owner)).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v3',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{firstSemanticDiagnostic:{packetIndex:2,cause:'unsupported-packet-payload-field-124'}}});expect(inspectTimingV4(owner)).toMatchObject({reason:'unregistered-owner',wholeInputFailure:null});},'provenance124','v3'));
it('V4 premature inspection caches its first refusal and rejects all other-version owners without IO',async()=>fixture(async(h,create)=>{
 const factory=(nativePhase as unknown as Record<string,any>).createProtoNativeUserTimingCaptureV4;expect(factory).toBeTypeOf('function');const old=create(h.inputs),v2=nativePhase.createProtoNativeUserTimingCapture(h.inputs),v3=nativePhase.createProtoNativeUserTimingCaptureV3(h.inputs),v4=factory(h.inputs),read=vi.spyOn(syncFs,'openSync');try{for(const owner of [null,{},new Proxy({},{get(){throw Error('no reflection');}}),old,v2,v3])expect(inspectTimingV4(owner)).toMatchObject({reason:'unregistered-owner',wholeInputFailure:null});const first=inspectTimingV4(v4);expect(first).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v4',reason:'owner-not-ready',wholeInputFailure:null});await v4.start();await v4.mark('start');await v4.mark('end');await v4.finish();expect(inspectTimingV4(v4)).toBe(first);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));
for(const version of ['v4','v5','v6']as const)for(const mode of ['hash','close','stat','EOF']as const)it(version+' withholds its complete phase pair on original physical '+mode+' refusal',async()=>phaseFixture(async(h,owner)=>{
 let spy:any;if(mode==='hash'){const path=join(h.directory,'trace.pftrace'),bytes=await readFile(path);bytes[bytes.length-1]^=1;await writeFile(path,bytes);}if(mode==='close'){const close=syncFs.closeSync;spy=vi.spyOn(syncFs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored-close');});}if(mode==='stat'){const original=syncFs.fstatSync;let calls=0;spy=vi.spyOn(syncFs,'fstatSync').mockImplementation((...args:any[])=>{const s=(original as any)(...args);if(++calls===2)s.ctimeNs+=1n;return s;});}if(mode==='EOF'){const read=syncFs.readSync;spy=vi.spyOn(syncFs,'readSync').mockImplementation((...args:any[])=>{if(args[3]===1){args[1][args[2]]=0;return 1;}return(read as any)(...args);});}
 try{const inspect=version==='v6'?inspectTimingV6:version==='v5'?inspectTimingV5:inspectTimingV4,result=inspect(owner);expect(result).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reader:{fullInputVerified:false}}});expect(inspect(owner)).toBe(result);}finally{spy?.mockRestore();}
},version==='v6'?'sequence-start':version==='v5'?'counter-defaults':'provenance124',version));
for(const field of [50,133,107,124,125])it('V3 owner projects original fixed unsupported payload cause '+field,async()=>phaseFixture(async(_h,owner)=>{
 const read=vi.spyOn(syncFs,'openSync');try{
  const r=inspectTimingV3(owner);
  expect(r).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reason:'fragment-unavailable',reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,fullInputVerified:true,structuralContainerEOF:true},study:{packets:3,decodedPackets:3,processedPackets:2},firstSemanticDiagnostic:{code:'fragment-unavailable',packetIndex:2,component:'packet',cause:'unsupported-packet-payload-field-'+field}},authority:{FPS:null,qualification:false,nativeSupported:false}});
  expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(8192);expect(inspectTimingV3(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);
 }finally{read.mockRestore();}
},'unsupported-field-'+field,'v3'));
for(const value of [null,undefined,false,0])it('v3 authored guard withholds an invalid first diagnostic '+String(value),async()=>phaseFixture(async(_h,owner)=>{guardFault.project=whole=>({...whole,study:{...whole.study,diagnostics:[value]}});try{expect(inspectTimingV3(owner)).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:null});}finally{guardFault.project=null;}},'duplicate-timestamp','v3'));
for(const value of [undefined,false,0])it('v3 authored guard withholds an invalid study instead of fabricating null '+String(value),async()=>phaseFixture(async(_h,owner)=>{guardFault.project=whole=>({...whole,study:value});try{expect(inspectTimingV3(owner)).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:null});}finally{guardFault.project=null;}},'duplicate-timestamp','v3'));
for(const field of ['counters','diagnostics'])it('v3 authored guard preserves refusal when an observed member is missing '+field,async()=>phaseFixture(async(_h,owner)=>{guardFault.project=whole=>({...whole,study:{...whole.study,[field]:null}});try{expect(inspectTimingV3(owner)).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:null});}finally{guardFault.project=null;}},'duplicate-timestamp','v3'));
for(const [field,value]of [['EOF',undefined],['closed',0],['identityMatch','true'],['hashMatch',null],['bytes',-1],['bytes',33554434],['reads',4097],['reads',0.5],['fullInputVerified',undefined],['structuralContainerEOF',1],['packets',131073],['decodedPackets',NaN],['processedPackets',-1],['packetIndex',131072],['packetIndex',undefined],['status',undefined]]as const)it('v3 authored guard withholds invalid observed scalar '+field+' '+String(value),async()=>phaseFixture(async(_h,owner)=>{
 guardFault.project=whole=>{if(['EOF','closed','identityMatch','hashMatch','bytes','reads'].includes(field))return {...whole,reader:{...whole.reader,[field]:value}};if(field==='fullInputVerified'||field==='structuralContainerEOF')return {...whole,[field]:value};if(field==='packetIndex')return {...whole,study:{...whole.study,diagnostics:[{...whole.study.diagnostics[0],[field]:value}]}};if(field==='status')return {...whole,study:{...whole.study,status:value}};return {...whole,study:{...whole.study,counters:{...whole.study.counters,[field]:value}}};};const read=vi.spyOn(syncFs,'openSync');try{const r=inspectTimingV3(owner);expect(r).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:null});expect(inspectTimingV3(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);}finally{guardFault.project=null;read.mockRestore();}
},'duplicate-timestamp','v3'));
for(const value of ['authored-private-path','x'.repeat(65536),17,new Proxy({},{get(){throw Error('no coercion');}})])it('v3 authored guard closes unknown codes without coercion '+typeof value,async()=>phaseFixture(async(h,owner)=>{guardFault.project=whole=>({...whole,reason:value,study:{...whole.study,diagnostics:[{...whole.study.diagnostics[0],code:value,component:value,cause:value}]}});const read=vi.spyOn(syncFs,'openSync');try{const r=inspectTimingV3(owner);expect(r).toMatchObject({reason:'whole-input-unavailable',wholeInputFailure:{reason:'unavailable-code',firstSemanticDiagnostic:{code:'unavailable-code',packetIndex:2,component:null,cause:'unavailable-code'}}});expect(JSON.stringify(r)).not.toContain(h.parent);expect(JSON.stringify(r)).not.toContain('authored-private-path');expect(inspectTimingV3(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);}finally{guardFault.project=null;read.mockRestore();}},'duplicate-timestamp','v3'));
it('v3 keeps physical reason precedence separate from first semantic cause',async()=>phaseFixture(async(h,owner)=>{const path=join(h.directory,'trace.pftrace'),bytes=await readFile(path);bytes[bytes.length-1]^=1;await writeFile(path,bytes);const r=inspectTimingV3(owner);expect(r).toMatchObject({reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reason:'reader-hash',reader:{EOF:true,closed:true,identityMatch:true,hashMatch:false,fullInputVerified:false,structuralContainerEOF:false},firstSemanticDiagnostic:{code:'fragment-unavailable',packetIndex:2,component:'packet',cause:'duplicate-selected-field'}}});},'duplicate-timestamp','v3'));
for(const mode of ['pair','duplicate-start','missing-end','malformed-tail','128','escaped'])it('v3 keeps fixed phase semantics and bounded output '+mode,async()=>phaseFixture(async(_h,owner)=>{const r=inspectTimingV3(owner);if(mode==='malformed-tail')expect(r.wholeInputFailure).toMatchObject({reason:'out-of-bounds-length',reader:{EOF:true,closed:true,hashMatch:true,fullInputVerified:true,structuralContainerEOF:false}});else expect(r.wholeInputFailure).toBe(null);expect(r.rows).toHaveLength(mode==='pair'||mode==='128'||mode==='escaped'?2:0);expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(8192);expect(Object.isFrozen(r)).toBe(true);},mode,'v3'));
for(const [mode,reason]of [['hash','reader-hash'],['close','reader-close'],['stat','reader-drift'],['EOF','reader-growth'],['throw','reader-failure']]as const)it('v3 preserves physical reason and cache '+mode,async()=>phaseFixture(async(h,owner)=>{
 let spy:any;if(mode==='hash'){const p=join(h.directory,'trace.pftrace'),b=await readFile(p);b[b.length-1]^=1;await writeFile(p,b);}if(mode==='close'){const close=syncFs.closeSync;spy=vi.spyOn(syncFs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored-private-close');});}if(mode==='stat'){const original=syncFs.fstatSync;let calls=0;spy=vi.spyOn(syncFs,'fstatSync').mockImplementation((...args:any[])=>{const s=(original as any)(...args);if(++calls===2)s.ctimeNs+=1n;return s;});}if(mode==='EOF'){const read=syncFs.readSync;spy=vi.spyOn(syncFs,'readSync').mockImplementation((...args:any[])=>{if(args[3]===1){args[1][args[2]]=0;return 1;}return(read as any)(...args);});}if(mode==='throw')spy=vi.spyOn(syncFs,'readSync').mockImplementation(()=>{throw {get message(){throw Error('no coercion');}};});const read=vi.spyOn(syncFs,'openSync');try{const r=inspectTimingV3(owner);expect(r).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reason,reader:{fullInputVerified:false}}});expect(JSON.stringify(r)).not.toContain(h.parent);expect(JSON.stringify(r)).not.toContain('authored-private');expect(read).toHaveBeenCalledTimes(1);expect(inspectTimingV3(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();spy?.mockRestore();}
},'pair','v3'));
it('v3 refuses unknown, Proxy and other-version owners without dispatch and caches premature inspection',async()=>fixture(async(h,create)=>{const old=create(h.inputs),v2=nativePhase.createProtoNativeUserTimingCapture(h.inputs),v3=nativePhase.createProtoNativeUserTimingCaptureV3(h.inputs),read=vi.spyOn(syncFs,'lstatSync');try{for(const value of [null,{},new Proxy({},{get(){throw Error();}}),old,v2])expect(inspectTimingV3(value)).toMatchObject({reason:'unregistered-owner',wholeInputFailure:null});const r=inspectTimingV3(v3);expect(r).toMatchObject({reason:'owner-not-ready',wholeInputFailure:null});await v3.start();await v3.mark('start');await v3.mark('end');await v3.finish();expect(inspectTimingV3(v3)).toBe(r);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}}));
it('v3 reentry latches the same immutable refusal after one original descriptor',async()=>phaseFixture(async(_h,owner)=>{const original=syncFs.lstatSync;let entered=false,inner:any;const read=vi.spyOn(syncFs,'openSync'),stat=vi.spyOn(syncFs,'lstatSync').mockImplementation((...args:any[])=>{if(!entered){entered=true;inner=inspectTimingV3(owner);}return(original as any)(...args);});try{const r=inspectTimingV3(owner);expect(r).toBe(inner);expect(r).toMatchObject({reason:'internal-unavailable',wholeInputFailure:null});expect(read).toHaveBeenCalledTimes(1);expect(inspectTimingV3(owner)).toBe(r);}finally{stat.mockRestore();read.mockRestore();}},'pair','v3'));
for(const [mode,reason,packets,decoded,processed,index,component,cause]of [['129','candidate-capacity',129,129,128,128,null,null],['duplicate-timestamp','fragment-unavailable',3,3,2,2,'packet','duplicate-selected-field']]as const)it('v3 retains original whole-input failure '+mode,async()=>phaseFixture(async(_h,owner)=>{
 const read=vi.spyOn(syncFs,'openSync');try{expect(inspectPhase(owner).reason).toBe('unregistered-owner');expect(inspectTiming(owner).reason).toBe('unregistered-owner');expect(read).not.toHaveBeenCalled();const result=inspectTimingV3(owner);expect(result).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v3',status:'unavailable',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{reason,reader:{EOF:true,closed:true,identityMatch:true,hashMatch:true,fullInputVerified:true,structuralContainerEOF:true},study:{status:'unavailable',packets,decodedPackets:decoded,processedPackets:processed},firstSemanticDiagnostic:{code:reason,packetIndex:index,component,cause}},authority:{FPS:null,qualification:false}});expect(read).toHaveBeenCalledTimes(1);expect(inspectTimingV3(owner)).toBe(result);expect(read).toHaveBeenCalledTimes(1);expect(Object.isFrozen(result.wholeInputFailure.firstSemanticDiagnostic)).toBe(true);}finally{read.mockRestore();}
},mode,'v3'));
it('versioned owner selects event-name policy at creation, caches one reader, and cannot enter legacy inspection',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const inspect=(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhase;expect(inspect).toBeTypeOf('function');const read=vi.spyOn(syncFs,'openSync');try{expect(inspectPhase(owner).reason).toBe('unregistered-owner');const r=inspect(owner);expect(r).toMatchObject({status:'phase-registry-inventory-diagnostic',rows:names.map((name,i)=>({name,phase:i?'end':'start',representation:'event_name',annotationIndex:null})),authority:{FPS:null,qualification:false}});expect(r.policy).not.toBe('source-owned-phase-registry-inventory-diagnostic-v1');expect(read).toHaveBeenCalledTimes(1);expect(inspect(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();}
},'pair',true));
const inspectTiming=(owner:unknown):any=>(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhase(owner);
for(const [mode,reason]of [['duplicate-start','duplicate-start'],['duplicate-end','duplicate-end'],['foreign','foreign-selected-prefix'],['missing-start','missing-start'],['missing-end','missing-end'],['reverse','wire-order-unavailable'],['withheld','root-inventory-withheld'],['loss','state-loss-observed'],['129','whole-input-unavailable'],['malformed-tail','whole-input-unavailable']]as const)it('versioned owner keeps exact source-name and whole-input refusal '+mode,async()=>phaseFixture(async(_h,owner)=>{expect(inspectTiming(owner)).toMatchObject({status:'unavailable',reason,rows:[]});},mode,true));
it('versioned owner keeps the filtered annotation representation explicit',async()=>phaseFixture(async(_h,owner)=>{expect(inspectTiming(owner)).toMatchObject({status:'phase-registry-inventory-diagnostic',rows:[{representation:'annotation',annotationIndex:0},{representation:'annotation',annotationIndex:0}]});},'annotation',true));
it('versioned owner retains fixed output guards with maximally escaped identifiers',async()=>phaseFixture(async(_h,owner)=>{const r=inspectTiming(owner);expect(r.status).toBe('phase-registry-inventory-diagnostic');expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(8192);expect(Object.keys(r.rows[0])).toHaveLength(22);expect(Object.isFrozen(r.rows[0])).toBe(true);},'escaped',true));
for(const mode of ['outside','128'])it('versioned owner inventories unfiltered outside-prefix candidates '+mode,async()=>phaseFixture(async(_h,owner)=>{expect(inspectTiming(owner)).toMatchObject({status:'phase-registry-inventory-diagnostic',counters:{candidates:mode==='128'?128:3,outsidePrefix:mode==='128'?126:1}});},mode,true));
it('versioned owner pre-ready inspection caches refusal and legacy owners cannot change policy',async()=>fixture(async(h,create)=>{const old=create(h.inputs),fresh=nativePhase.createProtoNativeUserTimingCapture(h.inputs),read=vi.spyOn(syncFs,'lstatSync');try{expect(inspectTiming(old).reason).toBe('unregistered-owner');const r=inspectTiming(fresh);expect(r.reason).toBe('owner-not-ready');await fresh.start();await fresh.mark('start');await fresh.mark('end');await fresh.finish();expect(inspectTiming(fresh)).toBe(r);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}}));
it('versioned owner reentry keeps the first immutable refusal with one original descriptor',async()=>phaseFixture(async(_h,owner)=>{const original=syncFs.lstatSync;let entered=false,inner:any;const read=vi.spyOn(syncFs,'openSync'),stat=vi.spyOn(syncFs,'lstatSync').mockImplementation((...args:any[])=>{if(!entered){entered=true;inner=inspectTiming(owner);}return(original as any)(...args);});try{const r=inspectTiming(owner);expect(inner).toMatchObject({status:'unavailable',reason:'internal-unavailable',rows:[]});expect(r).toBe(inner);expect(Object.isFrozen(r)).toBe(true);expect(read).toHaveBeenCalledTimes(1);expect(inspectTiming(owner)).toBe(r);}finally{stat.mockRestore();read.mockRestore();}},'pair',true));
for(const mode of ['hash','close','stat','EOF']as const)it('versioned owner withdraws its complete pair on late '+mode+' failure',async()=>phaseFixture(async(h,owner)=>{let spy:any;if(mode==='hash'){const p=join(h.directory,'trace.pftrace'),b=await readFile(p);b[b.length-1]^=1;await writeFile(p,b);}if(mode==='close'){const close=syncFs.closeSync;spy=vi.spyOn(syncFs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored-close');});}if(mode==='stat'){const original=syncFs.fstatSync;let calls=0;spy=vi.spyOn(syncFs,'fstatSync').mockImplementation((...args:any[])=>{const s=(original as any)(...args);if(++calls===2)s.ctimeNs+=1n;return s;});}if(mode==='EOF'){const read=syncFs.readSync;spy=vi.spyOn(syncFs,'readSync').mockImplementation((...args:any[])=>{if(args[3]===1){args[1][args[2]]=0;return 1;}return(read as any)(...args);});}try{const r=inspectTiming(owner);expect(r).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[]});expect(inspectTiming(owner)).toBe(r);}finally{spy?.mockRestore();}},'pair',true));
it('phase join source-owned generated names bind the whole supplied file without clock authority',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const result=inspectPhase(owner);
 expect(result).toMatchObject({status:'phase-registry-inventory-diagnostic',reason:null,runId:'authored-run',phaseId:'authored-phase',rows:[{phase:'start',name:names[0],rawTimestamp:'900'},{phase:'end',name:names[1],rawTimestamp:'100'}],authority:{qualification:false,captureQualified:false,nativeSupported:false,FPS:null,duration:null,clockAdmission:'not_evaluated'}});
 expect(result.rows[0].packetIndex).toBeLessThan(result.rows[1].packetIndex);expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.rows[0])).toBe(true);
}));
it('phase join rejects unknown cloned and prototype owners without reflection or reader I/O',()=>{
 let traps=0;const proxy=Proxy.revocable({},{get(){traps++;throw 1;},ownKeys(){traps++;throw 1;},getPrototypeOf(){traps++;throw 1;},getOwnPropertyDescriptor(){traps++;throw 1;}});
 const read=vi.spyOn(syncFs,'lstatSync');try{
  for(const value of [null,undefined,1,'x',{},Object.create({receipt:{status:'closed'}}),{receipt:{status:'closed'}},proxy.proxy])expect(inspectPhase(value)).toMatchObject({status:'unavailable',reason:'unregistered-owner',rows:[]});
  proxy.revoke();expect(inspectPhase(proxy.proxy).reason).toBe('unregistered-owner');expect(traps).toBe(0);expect(read).not.toHaveBeenCalled();
 }finally{read.mockRestore();}
});
it('phase join genuine pre-ready request consumes once and never resurrects',async()=>fixture(async(h,create)=>{
 const owner=create(h.inputs);const read=vi.spyOn(syncFs,'lstatSync');try{const refused=inspectPhase(owner);expect(refused.reason).toBe('owner-not-ready');expect(read).not.toHaveBeenCalled();await owner.start();await owner.mark('start');await owner.mark('end');await owner.finish();expect(inspectPhase(owner)).toBe(refused);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));
it('phase join caches one real read and leaves persisted self-pending receipt truthful',async()=>phaseFixture(async(h,owner,_r)=>{
 const saved=JSON.parse(await readFile(join(h.directory,'receipt.json'),'utf8'));expect(saved.operations.find((o:any)=>o.kind==='write-receipt').state).toBe('pending');
 const read=vi.spyOn(syncFs,'openSync');try{const result=inspectPhase(owner);expect(result.status).toBe('phase-registry-inventory-diagnostic');expect(read).toHaveBeenCalledTimes(1);expect(inspectPhase(owner)).toBe(result);expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();}
}));
it('phase join cached physical hash refusal cannot expose a positive prefix',async()=>phaseFixture(async(h,owner,_r)=>{
 const file=join(h.directory,'trace.pftrace'),bytes=await readFile(file);bytes[bytes.length-1]^=1;await writeFile(file,bytes);
 const first=inspectPhase(owner);expect(first).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[]});expect(inspectPhase(owner)).toBe(first);
}));
for(const[mode,reason]of [['duplicate-start','duplicate-start'],['duplicate-end','duplicate-end'],['foreign','foreign-selected-prefix'],['missing-start','missing-start'],['missing-end','missing-end'],['reverse','wire-order-unavailable'],['withheld','root-inventory-withheld'],['loss','state-loss-observed'],['129','whole-input-unavailable'],['malformed-tail','whole-input-unavailable']]as const)it('phase join real authored bytes refuse '+mode,async()=>phaseFixture(async(_h,owner)=>{
 expect(inspectPhase(owner)).toMatchObject({status:'unavailable',reason,rows:[]});
},mode));
for(const mode of ['outside','128'])it('phase join permits only classified outside-prefix inventory '+mode,async()=>phaseFixture(async(_h,owner)=>{
 const r=inspectPhase(owner);expect(r.status).toBe('phase-registry-inventory-diagnostic');expect(r.counters).toMatchObject({candidates:mode==='128'?128:3,outsidePrefix:mode==='128'?126:1});expect(r.rows).toHaveLength(2);expect(Object.keys(r.rows[0])).toHaveLength(21);
},mode));
it('phase join reader throw closes input and caches fixed refusal without exception coercion',async()=>phaseFixture(async(_h,owner)=>{
 let coercions=0;const read=vi.spyOn(syncFs,'readSync').mockImplementation(()=>{throw {get message(){coercions++;throw 1;},toString(){coercions++;throw 1;}};});
 const close=vi.spyOn(syncFs,'closeSync');try{const r=inspectPhase(owner);expect(r).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[]});expect(close).toHaveBeenCalledTimes(1);const n=read.mock.calls.length;expect(inspectPhase(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(n);expect(coercions).toBe(0);}finally{read.mockRestore();close.mockRestore();}
}));
it('phase join identical bytes in replacement inode do not match original owner identity',async()=>phaseFixture(async(h,owner)=>{
 const file=join(h.directory,'trace.pftrace'),replacement=join(h.parent,'replacement'),bytes=await readFile(file),old=await stat(file,{bigint:true});await writeFile(replacement,bytes,{flag:'wx'});const next=await stat(replacement,{bigint:true});expect(next.dev===old.dev&&next.ino===old.ino).toBe(false);await rename(replacement,file);
 expect(inspectPhase(owner)).toMatchObject({status:'unavailable',reason:'file-identity-unavailable',rows:[]});
}));
it('phase join exact source field keys and escaped identifiers remain within closed output caps',async()=>phaseFixture(async(_h,owner)=>{
 const r=inspectPhase(owner);expect(r.status).toBe('phase-registry-inventory-diagnostic');expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThanOrEqual(8192);expect(Object.keys(r).sort()).toEqual(['policy','status','reason','runId','phaseId','targetId','input','counters','rows','authority'].sort());
 expect(Object.keys(r.rows[0]).sort()).toEqual(['phase','name','packetIndex','sequenceIndex','intervalVersion','eventStart','eventValueStart','eventEnd','bodySHA256','annotationIndex','definitionIndex','nameSource','clockId','clockSource','trackUuid','trackSource','machineStatus','machineId','sequenceId','rawTimestamp','timestampStatus'].sort());
 expect(r.authority).toEqual({captureQualified:false,qualification:false,nativeSupported:false,clockAdmission:'not_evaluated',targetLifetime:'unestablished',population:'not_evaluated',FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});expect(Object.isFrozen(r.input)&&Object.isFrozen(r.rows)&&Object.isFrozen(r.authority)).toBe(true);
},'escaped'));
it('phase join rejects genuine snapshots and method-copy clones after fulfillment',async()=>phaseFixture(async(_h,owner)=>{
 const read=vi.spyOn(syncFs,'lstatSync');try{for(const value of [owner.snapshot(),{...owner},Object.create(Object.getPrototypeOf(owner))])expect(inspectPhase(value).reason).toBe('unregistered-owner');expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));
it('phase join reader close failure withdraws a resolved pair',async()=>phaseFixture(async(_h,owner)=>{
 const close=syncFs.closeSync,spy=vi.spyOn(syncFs,'closeSync').mockImplementation(fd=>{close(fd);throw Error('authored-close');});try{expect(inspectPhase(owner)).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[]});}finally{spy.mockRestore();}
}));
it('phase join reentry during original source read latches one immutable refusal',async()=>phaseFixture(async(_h,owner)=>{
 const original=syncFs.lstatSync;let entered=false,inner:any;const read=vi.spyOn(syncFs,'openSync');
 const stat=vi.spyOn(syncFs,'lstatSync').mockImplementation((...args:any[])=>{if(!entered){entered=true;inner=inspectPhase(owner);}return (original as any)(...args);});
 try{const outer=inspectPhase(owner);expect(entered).toBe(true);expect(inner).toMatchObject({status:'unavailable',reason:'internal-unavailable',rows:[]});expect(Object.isFrozen(inner)).toBe(true);expect(outer).toBe(inner);expect(inspectPhase(owner)).toBe(inner);expect(read).toHaveBeenCalledTimes(1);}finally{stat.mockRestore();read.mockRestore();}
}));
it('phase join held original runner settlement refuses before any source read',async()=>fixture(async(h,create)=>{
 let release!:(v:any)=>void,entered!:()=>void;const ready=new Promise<void>(done=>{entered=done;});h.runner.wait=()=>new Promise(done=>{release=done;entered();});const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');const final=owner.finish();await ready;
 const read=vi.spyOn(syncFs,'lstatSync');try{const r=inspectPhase(owner);expect(r.reason).toBe('owner-not-ready');expect(read).not.toHaveBeenCalled();release({exitCode:0,signal:null});expect((await final).status).toBe('closed');expect(inspectPhase(owner)).toBe(r);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));
it('owns real exclusive persisted bytes and final queries before exactly one detach',async()=>fixture(async(h,create)=>{
  const {owner,receipt:r}=await capture(h,create);expect(r.status).toBe('closed');expect(r.transport.outcome).toBe('protocol-closed');expect(r.persistedWholeInput).toBe('verified');expect(r.persisted.bytes).toBe(3);
  expect(await readFile(join(h.directory,'trace.pftrace'))).toEqual(Buffer.from([0,255,4]));expect(r.persisted.sha256).toBe('8b167730eca499532adf3dd1b625fe250fe27b835da8c3b5889815dce993a5a4');
  expect(r.marks.map((row:any)=>row.state)).toEqual(['fulfilled','fulfilled']);expect(new Set(r.marks.map((row:any)=>row.name)).size).toBe(2);
  expect(h.journal.filter(s=>s==='Tracing.start')).toHaveLength(1);expect(h.journal.filter(s=>s==='Tracing.end')).toHaveLength(1);expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);
  expect(h.journal.lastIndexOf('Page.getFrameTree')).toBeLessThan(h.journal.indexOf('detach'));expect(h.journal.filter(s=>s==='Page.getFrameTree')).toHaveLength(2);
  expect(h.journal.indexOf('detach')).toBeLessThan(h.journal.indexOf('runner-close'));expect(r.runner.wait).toEqual({exitCode:0,signal:null});
  expect(h.timers.size).toBe(0);expect(h.session.count()+h.page.count()+h.context.count()+h.browser.count()).toBe(0);unqualified(r);expect(owner.snapshot()).toEqual(r);
}));
it('refuses a reused output directory without overwriting existing bytes',async()=>fixture(async(h,create)=>{
  await mkdir(h.directory);await writeFile(join(h.directory,'trace.pftrace'),'sentinel',{flag:'wx'});const owner=create(h.inputs);const r=await owner.start();expect(r.status).toBe('unavailable');expect(await readFile(join(h.directory,'trace.pftrace'),'utf8')).toBe('sentinel');expect(h.journal).not.toContain('Tracing.start');unqualified(r);
}));
for(const change of ['binary','revision','child','navigation','readback']as const)it('refuses '+change+' drift while retaining unavailable evidence',async()=>fixture(async(h,create)=>{
  const owner=create(h.inputs);
  if(change==='binary')await writeFile(h.runtime.executablePath,'different bytes');if(change==='revision')h.setVersion({product:'Chrome/authored',revision:'@other'});if(change==='child')h.setFrames([{},{}]);
  const started=await owner.start();if(change==='binary'||change==='revision'||change==='child'){expect(started.status).toBe('unavailable');expect(h.journal).not.toContain('Tracing.start');unqualified(started);return;}
  await owner.mark('start');if(change==='navigation')h.page.emit('framenavigated',{});if(change==='readback')h.onDetach(async()=>{await writeFile(join(h.directory,'trace.pftrace'),Buffer.from([1,2,3]));});await owner.mark('end');const r=await owner.finish();expect(r.status).toBe('unavailable');expect(r.persistedWholeInput).toBe('unavailable');unqualified(r);
}));
it('required target getters are refused without invocation',async()=>fixture(async(h,create)=>{
  let gets=0;h.setTarget({targetInfo:Object.defineProperty({targetId:'target',type:'page',browserContextId:'context'},'url',{get(){gets++;throw Error('getter');}})});const owner=create(h.inputs);const r=await owner.start();expect(gets).toBe(0);expect(r.status).toBe('unavailable');expect(h.journal).not.toContain('Tracing.start');unqualified(r);
}));
it('phase calls are actual unique ordered original operations and duplicate marks refuse',async()=>fixture(async(h,create)=>{
  const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('start');const r=await owner.close();expect(h.journal.filter(s=>s.startsWith('mark:'))).toHaveLength(1);expect(r.status).toBe('unavailable');unqualified(r);
}));
it('held final query remains pending after cleanup timeout and detach is still attempted once',async()=>fixture(async(h,create)=>{
  const original=h.session.send;let queried=0,release!:(value:unknown)=>void,entered!:()=>void;
  const afterFrameEntered=new Promise<void>(done=>{entered=done;});
  h.session.send=async(method:string,params?:any)=>{if(method==='Page.getFrameTree'&&++queried===2)return new Promise(done=>{release=done;entered();});return original(method,params);};
  const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');const finishing=owner.finish();
  await afterFrameEntered;expect(queried).toBe(2);
  for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();for(let i=0;i<100;i++)await Promise.resolve();
  const r=await finishing;expect(r.status).toBe('pending');expect(r.originalOperationsSettled).toBe(false);expect(r.operations.some((op:any)=>op.kind==='after-frame'&&op.state==='pending')).toBe(true);expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);unqualified(r);
  release({frameTree:{frame:{id:'root',loaderId:'loader',url:'https://authored.invalid/'}}});for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().status).not.toBe('closed');
}));
it('revalidates binary after capture before original detach',async()=>fixture(async(h,create)=>{
 const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');await writeFile(h.runtime.executablePath,'changed after start');const r=await owner.finish();expect(r.status).toBe('unavailable');expect(r.persistedWholeInput).toBe('unavailable');expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);unqualified(r);
}));
it('refuses identical-byte replacement inode at readback',async()=>fixture(async(h,create)=>{
 let mutation:Promise<void>|undefined;
 h.onDetach(()=>mutation=(async()=>{
  const path=join(h.directory,'trace.pftrace'),replacement=join(h.parent,'same-byte-replacement');
  const originalIdentity=await stat(path,{bigint:true}),bytes=await readFile(path);
  expect(bytes).toEqual(Buffer.from([0,255,4]));
  // Allocate while the original inode still exists: unlinking first permits
  // immediate inode reuse and does not establish this test's premise.
  await writeFile(replacement,bytes,{flag:'wx'});
  const replacementIdentity=await stat(replacement,{bigint:true});
  expect(replacementIdentity.dev===originalIdentity.dev&&replacementIdentity.ino===originalIdentity.ino).toBe(false);
  expect(await readFile(replacement)).toEqual(bytes);
  await rename(replacement,path);
  const selected=await stat(path,{bigint:true});
  expect({dev:selected.dev,ino:selected.ino}).toEqual({dev:replacementIdentity.dev,ino:replacementIdentity.ino});
  expect(await readFile(path)).toEqual(bytes);
 })());
 const {receipt:r}=await capture(h,create);
 // The owner deliberately catches detach failures. Check the original hook
 // promise outside that refusal boundary so a failed premise cannot pass.
 expect(mutation).toBeDefined();await mutation;
 expect(r.status).toBe('unavailable');expect(r.persistedWholeInput).toBe('unavailable');expect(r.failures).toEqual(['persisted-readback']);unqualified(r);
}));
it('refuses unpinned installed browser revision before tracing',async()=>fixture(async(h,create)=>{
 h.runtime.browserRevision='invented-other';const owner=create(h.inputs);const r=await owner.start();expect(r.status).toBe('unavailable');expect(h.journal).not.toContain('Tracing.start');unqualified(r);
}));
it('install-then-throw removes every attempted listener and never traces',async()=>fixture(async(h,create)=>{
 const original=h.page.on;h.page.on=(event,listener)=>{original(event,listener);if(event==='frameattached')throw Error('installed then throw');};const owner=create(h.inputs);const r=await owner.start();expect(r.status).toBe('unavailable');expect(h.journal).not.toContain('Tracing.start');expect(h.page.count()).toBe(0);unqualified(r);
}));
it('failed final query still attempts exactly one original detach',async()=>fixture(async(h,create)=>{
 const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');h.setTarget({targetInfo:{targetId:'other',type:'page',url:'https://authored.invalid/',browserContextId:'context'}});const r=await owner.finish();expect(r.status).toBe('unavailable');expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);unqualified(r);
}));
it('lifecycle overflow refuses before retaining beyond aggregate role reservation',async()=>fixture(async(h,create)=>{
 const owner=create(h.inputs);await owner.start();for(let i=0;i<5000;i++)h.page.emit('framenavigated',{});const r=await owner.close();expect(r.status).toBe('unavailable');expect(Buffer.byteLength(JSON.stringify(r.target))).toBeLessThanOrEqual(65536);expect(r.target.events.length).toBeLessThanOrEqual(4096);expect(r.failures.length).toBeLessThanOrEqual(32);unqualified(r);
}));
it('short positive descriptor reads refuse without unbounded progress retries',async()=>fixture(async(h,create)=>{
 const handle=await open(h.runtime.executablePath,'r');const proto=Object.getPrototypeOf(handle);await handle.close();const original=proto.read;
 const spy=vi.spyOn(proto,'read').mockImplementation(function(this:any,buffer:any,offset:any,length:any,position:any){return original.call(this,buffer,offset,Math.min(length,1),position);});
 try{const owner=create(h.inputs);const r=await owner.start();expect(r.status).toBe('unavailable');expect(h.journal).not.toContain('Tracing.start');expect(spy.mock.calls.length).toBeLessThan(4);unqualified(r);}finally{spy.mockRestore();}
}));
it('fsync rejection leaves transport and persistence unavailable',async()=>fixture(async(h,create)=>{
 const handle=await open(h.runtime.executablePath,'r');const proto=Object.getPrototypeOf(handle);await handle.close();const original=proto.sync;
 const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');
 let failed=false;const spy=vi.spyOn(proto,'sync').mockImplementation(function(this:any){if(!failed){failed=true;return Promise.reject(Error('authored fsync failure'));}return original.call(this);});
 try{const r=await owner.finish();expect(failed).toBe(true);expect(r.status).toBe('unavailable');expect(r.transport.sinkClose).toBe('rejected');expect(r.persistedWholeInput).toBe('unavailable');unqualified(r);}finally{spy.mockRestore();}
}));
it('held original runner wait remains pending after its deadline',async()=>fixture(async(h,create)=>{
 let release!:(value:any)=>void,entered!:()=>void;const waitEntered=new Promise<void>(done=>{entered=done;});h.runner.wait=()=>new Promise(done=>{release=done;entered();});const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');const final=owner.finish();
 await waitEntered;expect(release).toBeTypeOf('function');for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();const r=await final;expect(r.status).toBe('pending');expect(r.operations.some((row:any)=>row.kind==='runner-wait'&&row.state==='pending')).toBe(true);expect(r.runner.wait).toBeNull();unqualified(r);release({exitCode:0,signal:null});for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().status).not.toBe('closed');
}));
it('marker registry binds both actual original names to run phase and observed target',async()=>fixture(async(h,create)=>{
 const {receipt:r}=await capture(h,create);for(const row of r.marks)expect(row).toMatchObject({runId:'authored-run',phaseId:'authored-phase',targetId:'target'});
}));
it('end marker cannot dispatch before original start marker settlement',async()=>fixture(async(h,create)=>{
 const releases:(()=>void)[]=[];h.phase.mark=async(name:string)=>{h.journal.push('mark:'+name);return new Promise<void>(done=>{releases.push(done);});};const owner=create(h.inputs);await owner.start();const startMark=owner.mark('start');for(let i=0;i<10;i++)await Promise.resolve();const endMark=owner.mark('end');for(let i=0;i<10;i++)await Promise.resolve();const count=h.journal.filter(s=>s.startsWith('mark:')).length;for(const release of releases)release();await Promise.all([startMark,endMark]);const r=await owner.close();expect(count).toBe(1);expect(r.status).toBe('unavailable');unqualified(r);
}));
it('enables Page events after ownership listeners and before initial target queries',async()=>fixture(async(h,create)=>{
 const original=h.session.send;h.session.send=async(method:string,params?:any)=>{if(method==='Page.enable')expect(h.page.count()+h.session.count()).toBeGreaterThan(8);return original(method,params);};const {receipt:r}=await capture(h,create);expect(h.journal.filter(s=>s==='Page.enable')).toHaveLength(1);expect(h.journal.indexOf('Page.enable')).toBeLessThan(h.journal.indexOf('Page.getFrameTree'));expect(r.status).toBe('closed');
}));

for(const field of ['expectedExecutableBytes','headless']as const)it('C1 rejects '+field+' object before retention serialization or acquisition',async()=>fixture(async(h,create)=>{
 let calls=0;(h.runtime as any)[field]={toJSON(){calls++;return field==='headless'?true:32;}};
 const owner=create(h.inputs);const r=await owner.start();expect(calls).toBe(0);expect(r.createdRoles).toEqual([]);expect(h.journal).not.toContain('Tracing.start');expect(r.status).toBe('unavailable');unqualified(r);
}));
for(const value of [0,-1,536870913,Number.MAX_SAFE_INTEGER+1,1.5,NaN,Infinity,'32',null])it('C1 rejects invalid primitive runtime byte size '+String(value)+' before acquisition',async()=>fixture(async(h,create)=>{
 (h.runtime as any).expectedExecutableBytes=value;const r=await create(h.inputs).start();expect(r.createdRoles).toEqual([]);expect(r.status).toBe('unavailable');unqualified(r);
}));
it('C1 runtime own-data capture never invokes an input getter',async()=>fixture(async(h,create)=>{
 let gets=0;Object.defineProperty(h.runtime,'expectedExecutableBytes',{get(){gets++;return 32;}});const r=await create(h.inputs).start();expect(gets).toBe(0);expect(r.createdRoles).toEqual([]);expect(r.status).toBe('unavailable');unqualified(r);
}));
it('C2 install-then-throw prevents new acquisition and records original not-dispatched',async()=>fixture(async(h,create)=>{
 const original=h.clock.setTimer;h.clock.setTimer=(callback,delay)=>{const token=original(callback,delay);if(delay===10000)throw Error('authored installed timer throw');return token;};
 const r=await create(h.inputs).start();const reserve=r.operations.find((row:any)=>row.kind==='reserve-directory');expect(reserve.state).toBe('not-dispatched');expect(reserve.timer).toMatchObject({registrationState:'unknown-after-throw',disposalState:'unknown-after-throw'});expect(r.createdRoles).toEqual([]);
 expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);expect(h.journal.filter(s=>s==='runner-close')).toHaveLength(1);expect(h.journal.filter(s=>s==='runner-wait')).toHaveLength(1);expect(h.journal).not.toContain('Tracing.start');expect(r.status).toBe('unavailable');unqualified(r);
}));
it('C2 unknown cleanup timer preserves a held original detach as pending',async()=>fixture(async(h,create)=>{
 let release!:()=>void;h.onDetach(()=>new Promise<void>(done=>{release=done;}));const original=h.clock.setTimer;h.clock.setTimer=(callback,delay)=>{const token=original(callback,delay);if(delay===10000)throw Error('authored installed timer throw');return token;};
 const owner=create(h.inputs);const r=await owner.start();expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);expect(r.status).toBe('pending');expect(r.originalOperationsSettled).toBe(false);expect(r.operations.find((row:any)=>row.kind==='detach')).toMatchObject({state:'pending',timer:{registrationState:'unknown-after-throw',disposalState:'unknown-after-throw'}});
 release();for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().operations.find((row:any)=>row.kind==='detach').state).toBe('fulfilled');expect(owner.snapshot().status).not.toBe('closed');unqualified(r);
}));
it('C3 initial raw stat has a deadline and retains the held original pending state',async()=>fixture(async(h,create)=>{
 const handle=await open(h.runtime.executablePath,'r');const proto=Object.getPrototypeOf(handle);await handle.close();const original=proto.stat;let calls=0,release!:(()=>void),entered!:()=>void;const statEntered=new Promise<void>(done=>{entered=done;});
 const spy=vi.spyOn(proto,'stat').mockImplementation(async function(this:any,...args:any[]){const actual=await original.apply(this,args);if(++calls===2)return new Promise(done=>{release=()=>done(actual);entered();});return actual;});
 const owner=create(h.inputs);const starting=owner.start();
 try{
  await statEntered;expect(release).toBeTypeOf('function');
  for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();
  const observed=await starting,pending=owner.snapshot();release();await starting;
  expect(observed,'start must refuse by the stat deadline without waiting for original stat '+JSON.stringify(pending)).toBeDefined();expect(observed.status).toBe('pending');expect(observed.originalOperationsSettled).toBe(false);expect(observed.operations.find((row:any)=>row.kind==='raw-stat').state).toBe('pending');expect(h.journal).not.toContain('Tracing.start');unqualified(observed);
  for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().operations.find((row:any)=>row.kind==='raw-stat').state).toBe('fulfilled');expect(owner.snapshot().status).not.toBe('closed');
 }finally{release?.();await starting;await owner.close();spy.mockRestore();}
}));
for(const [exitCode,signal]of [[Number.MAX_SAFE_INTEGER+1,null],[-1,null],[256,null],[0,'\u0000'.repeat(64)],[0,'not-a-signal'],[0,'SIG'+'X'.repeat(13)]]as const)it('C4 refuses runner result outside exact exit/signal grammar '+JSON.stringify([exitCode,signal]),async()=>fixture(async(h,create)=>{
 h.runner.wait=async()=>({exitCode,signal})as any;const {receipt:r}=await capture(h,create);expect(r.runner.wait).toBeNull();expect(r.status).toBe('unavailable');unqualified(r);
}));
it('C4 retains bounded nonzero exit and uppercase signal evidence',async()=>fixture(async(h,create)=>{
 h.runner.wait=async()=>({exitCode:255,signal:'SIGTERM'})as any;const {receipt:r}=await capture(h,create);expect(r.runner.wait).toEqual({exitCode:255,signal:'SIGTERM'});expect(r.status).toBe('unavailable');unqualified(r);
}));
it('C4 false headless is retained as an exact Boolean',async()=>fixture(async(h,create)=>{
 h.runtime.headless=false;const {receipt:r}=await capture(h,create);expect(r.runtime.headless).toBe(false);expect(r.status).toBe('closed');unqualified(r);
}));
it('C4 signal grammar refuses a trailing line terminator',async()=>fixture(async(h,create)=>{
 h.runner.wait=async()=>({exitCode:0,signal:'SIGTERM\n'})as any;const {receipt:r}=await capture(h,create);expect(r.runner.wait).toBeNull();expect(r.status).toBe('unavailable');unqualified(r);
}));

const inspectTimingV6=(owner:unknown):any=>{const inspect=(nativePhase as unknown as Record<string,any>).inspectProtoNativeUserTimingPhaseV6;expect(inspect).toBeTypeOf('function');return inspect(owner);};
it('V6 owner admits only a proven late startup with cached inspection and fixed false authority',async()=>phaseFixture(async(_h,owner,_r,names)=>{
 const read=vi.spyOn(syncFs,'openSync');try{for(const inspect of [inspectPhase,inspectTiming,inspectTimingV3,inspectTimingV4,inspectTimingV5])expect(inspect(owner).reason).toBe('unregistered-owner');expect(read).not.toHaveBeenCalled();const r=inspectTimingV6(owner);expect(r).toMatchObject({policy:'source-owned-user-timing-phase-inventory-diagnostic-v6',status:'phase-registry-inventory-diagnostic',rows:names.map(name=>({name})),authority:{nativeSupported:false,FPS:null,duration:null,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false}});expect(inspectTimingV6(owner)).toBe(r);expect(read).toHaveBeenCalledTimes(1);}finally{read.mockRestore();}
},'sequence-start','v6'));
for(const mode of ['sequence-start-absent','sequence-start-257','sequence-start-history','sequence-start-history-reset'])it('V6 owner refuses whole-file unexplained or contradictory start '+mode,async()=>phaseFixture(async(_h,owner)=>{expect(inspectTimingV6(owner)).toMatchObject({status:'unavailable',rows:[]});},mode,'v6'));
it('V6 explained startup cannot preserve prefix rows through an unsupported whole tail',async()=>phaseFixture(async(_h,owner)=>{expect(inspectTimingV6(owner)).toMatchObject({status:'unavailable',reason:'whole-input-unavailable',rows:[],wholeInputFailure:{firstSemanticDiagnostic:{cause:'unsupported-packet-payload-field-125'}}});},'sequence-start-late125','v6'));
it('V5 owner keeps refusing the same genuine startup as raw loss',async()=>phaseFixture(async(_h,owner)=>{expect(inspectTimingV5(owner)).toMatchObject({status:'unavailable',reason:'state-loss-observed',rows:[]});},'sequence-start','v5'));
it('V6 rejects all older owner brands and caches premature refusal without additional IO',async()=>fixture(async(h,create)=>{
 const factory=(nativePhase as unknown as Record<string,any>).createProtoNativeUserTimingCaptureV6;expect(factory).toBeTypeOf('function');const old=[create(h.inputs),nativePhase.createProtoNativeUserTimingCapture(h.inputs),nativePhase.createProtoNativeUserTimingCaptureV3(h.inputs),nativePhase.createProtoNativeUserTimingCaptureV4(h.inputs),nativePhase.createProtoNativeUserTimingCaptureV5(h.inputs)],owner=factory(h.inputs),read=vi.spyOn(syncFs,'openSync');try{for(const x of [...old,null,{},new Proxy({},{get(){throw Error('no reflection');}})])expect(inspectTimingV6(x).reason).toBe('unregistered-owner');const r=inspectTimingV6(owner);expect(r.reason).toBe('owner-not-ready');await owner.start();await owner.mark('start');await owner.mark('end');await owner.finish();expect(inspectTimingV6(owner)).toBe(r);expect(read).not.toHaveBeenCalled();}finally{read.mockRestore();}
}));
