import {expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

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
  const original=h.session.send;let queried=0,release!:(value:unknown)=>void;
  h.session.send=async(method:string,params?:any)=>{if(method==='Page.getFrameTree'&&++queried===2)return new Promise(done=>{release=done;});return original(method,params);};
  const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');const finishing=owner.finish();
  for(let i=0;i<1000&&queried<2;i++)await new Promise<void>(done=>setImmediate(done));expect(queried).toBe(2);
  for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();for(let i=0;i<100;i++)await Promise.resolve();
  const r=await finishing;expect(r.status).toBe('pending');expect(r.originalOperationsSettled).toBe(false);expect(r.operations.some((op:any)=>op.kind==='after-frame'&&op.state==='pending')).toBe(true);expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);unqualified(r);
  release({frameTree:{frame:{id:'root',loaderId:'loader',url:'https://authored.invalid/'}}});for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().status).not.toBe('closed');
}));
it('revalidates binary after capture before original detach',async()=>fixture(async(h,create)=>{
 const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');await writeFile(h.runtime.executablePath,'changed after start');const r=await owner.finish();expect(r.status).toBe('unavailable');expect(r.persistedWholeInput).toBe('unavailable');expect(h.journal.filter(s=>s==='detach')).toHaveLength(1);unqualified(r);
}));
it('refuses identical-byte replacement inode at readback',async()=>fixture(async(h,create)=>{
 h.onDetach(async()=>{await rm(join(h.directory,'trace.pftrace'));await writeFile(join(h.directory,'trace.pftrace'),Buffer.from([0,255,4]),{flag:'wx'});});const {receipt:r}=await capture(h,create);expect(r.status).toBe('unavailable');expect(r.persistedWholeInput).toBe('unavailable');unqualified(r);
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
 let release!:(value:any)=>void;h.runner.wait=()=>new Promise(done=>{release=done;});const owner=create(h.inputs);await owner.start();await owner.mark('start');await owner.mark('end');const final=owner.finish();
 for(let i=0;i<1000&&!release;i++)await new Promise<void>(done=>setImmediate(done));expect(release).toBeTypeOf('function');for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();const r=await final;expect(r.status).toBe('pending');expect(r.operations.some((row:any)=>row.kind==='runner-wait'&&row.state==='pending')).toBe(true);expect(r.runner.wait).toBeNull();unqualified(r);release({exitCode:0,signal:null});for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().status).not.toBe('closed');
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
 const handle=await open(h.runtime.executablePath,'r');const proto=Object.getPrototypeOf(handle);await handle.close();const original=proto.stat;let calls=0,release!:(()=>void);
 const spy=vi.spyOn(proto,'stat').mockImplementation(async function(this:any,...args:any[]){const actual=await original.apply(this,args);if(++calls===2)return new Promise(done=>{release=()=>done(actual);});return actual;});
 const owner=create(h.inputs);let early:any;const starting=owner.start();void starting.then((r:any)=>{early=r;});
 try{
  for(let i=0;i<1000&&!release;i++)await new Promise<void>(done=>setImmediate(done));expect(release).toBeTypeOf('function');
  for(let round=0;round<12&&!early;round++){for(const {callback,delay}of [...h.timers.values()])if(delay===10000)callback();await new Promise<void>(done=>setTimeout(done,5));}
  const observed=early,pending=owner.snapshot();release();await starting;
  expect(observed,'start must refuse by the stat deadline without waiting for original stat '+JSON.stringify(pending)).toBeDefined();expect(observed.status).toBe('pending');expect(observed.originalOperationsSettled).toBe(false);expect(observed.operations.find((row:any)=>row.kind==='raw-stat').state).toBe('pending');expect(h.journal).not.toContain('Tracing.start');unqualified(observed);
  for(let i=0;i<100;i++)await Promise.resolve();expect(owner.snapshot().operations.find((row:any)=>row.kind==='raw-stat').state).toBe('fulfilled');expect(owner.snapshot().status).not.toBe('closed');
 }finally{release?.();await starting;const closing=owner.close();for(let i=0;i<1000;i++)await new Promise<void>(done=>setImmediate(done));for(const {callback}of [...h.timers.values()])callback();await closing;spy.mockRestore();}
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
