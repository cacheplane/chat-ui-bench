import {expect,test,vi} from 'vitest';
import {ThreadplaneHost} from './host.js';
import {ReplayTransport} from './replay-transport.js';
import {COMPARISON_CAPTURE_LIMITS,comparisonBoundedBufferSchema,createComparisonBuffer} from '@chat-ui-bench/contract';

function setup(message: object|null, count=1) {
  const messages=message ? {length:count,at:()=>message} : {length:0,at:()=>undefined};
  const agent={messages:()=>messages,isLoading:()=>true,isThreadLoading:()=>false,error:()=>null};
  const host=new ThreadplaneHost(agent as never,new ReplayTransport(),()=>{});
  return host;
}
const active=()=>({id:'actual',role:'assistant',content:'🌍漢',delivery:{phase:'streaming'}});
test('actual streaming host mount is independent of missing content and terminal DOM',()=>{
  const message=active(),host=setup(message),element={isConnected:true};
  Object.assign(host,{mounted:new Map([['actual',element]])});
  expect(host.readActiveHost()).toEqual({activeMessageId:'actual',hostMounted:true});
  message.delivery.phase='complete';
  expect(host.readActiveHost()).toEqual({activeMessageId:null,hostMounted:false});
});
test('candidate overbudget checks Set size before iteration or content lookup',()=>{
  const host=setup(active()),touch=vi.fn(()=>{throw Error('iteration');});
  const visible=new Set(Array.from({length:65},()=>({get textContent(){return touch();}})));
  visible[Symbol.iterator]=touch as never;
  Object.assign(host,{visible});
  expect(host.readCaptureCandidates(64)).toMatchObject({status:'unavailable',reason:expect.stringContaining('candidate')});
  expect(touch).not.toHaveBeenCalled();
});
test('progress rejects content accessors and oversize before reading or truncating',()=>{
  const touch=vi.fn(()=>{throw Error('content getter');});
  const message=active();Object.defineProperty(message,'content',{get:touch});
  expect(setup(message).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'unavailable'});
  expect(touch).not.toHaveBeenCalled();
  expect(setup({...active(),content:'x'.repeat(524289)}).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'unavailable'});
  expect(setup({...active(),content:'漢'.repeat(400000)}).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'unavailable'});
  expect(setup({...active(),content:[{text:'structured'}]}).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'unavailable'});
  expect(setup(active()).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'available',value:{activeMessage:{id:'actual',text:'🌍漢',status:'streaming'}}});
});
test('opaque product errors never invoke String or arbitrary toJSON',()=>{
  const touch=vi.fn(()=>{throw Error('coercion');});const host=setup(active());
  Object.assign(host,{agent:{messages:()=>[active()],isLoading:()=>true,isThreadLoading:()=>false,error:()=>({toString:touch,toJSON:touch})}});
  expect(host.readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'available',value:{error:'[opaque product error]'}});
  expect(touch).not.toHaveBeenCalled();
});
test('64 historical references plus one separately mounted active host are permitted',()=>{
  const host=setup(active()),content={};
  const elements=Array.from({length:65},()=>({isConnected:true,querySelector:()=>content,get textContent(){throw Error('text');}}));
  const identities=new Map(elements.slice(0,64).map((element,i)=>[element,{id:`h-${i}`,role:i%2?'assistant':'user'}]));
  Object.assign(host,{visible:new Set(elements),identities,mounted:new Map([['actual',elements[64]]])});
  const result=host.readCaptureCandidates(64);
  expect(result.status).toBe('available');
  if(result.status==='available') {
    expect(result.value.historical).toHaveLength(64);
    expect(result.value.active?.id).toBe('actual');expect(result.value.active?.role).toBe('assistant');
    expect(result.value.active?.hostElement).toBe(elements[64]);expect(result.value.active?.contentElement).toBe(content);
  }
});
test.each(['success','aborted','error','interrupted','paused'])('bounded progress preserves actual terminal outcome %s',outcome=>{
  const host=setup({...active(),delivery:{phase:'complete',outcome}});
  expect(host.readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'available',value:{activeMessage:null,delivery:outcome==='success'?'complete':outcome==='aborted'?'aborted':'error'}});
});
test('host projects genuine lifetime queue evidence into the strict raw schema',()=>{
  const q=createComparisonBuffer('transport'),host=setup(active());
  Object.assign(host,{transport:{readCaptureBufferState:q.state}});
  for(let i=0;i<4097;i++) q.enqueue('null');
  const snapshot=host.readCaptureBufferState();
  expect(comparisonBoundedBufferSchema.parse(snapshot)).toMatchObject({highWaterEntries:4096,overflowCount:1,rejectedRecordCount:1,status:'partial',reason:'Pending entry limit exceeded'});
  expect(snapshot).not.toHaveProperty('pendingEntries');
});
test('submit rejection is bounded at its real catch boundary without object coercion',async()=>{
  const touch=vi.fn(()=>{throw Error('coercion');});
  const transport=new ReplayTransport();transport.loadHistory('t',[]);
  const agent={messages:()=>[],isLoading:()=>false,isThreadLoading:()=>false,error:()=>null,submit:async()=>{throw {toString:touch,toJSON:touch};}};
  const host=new ThreadplaneHost(agent as never,transport,()=>{});
  host.connectReplay('https://fixture.test/replay');await host.waitForReplay();
  expect(host.readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'available',value:{error:'[opaque product error]'}});
  expect(touch).not.toHaveBeenCalled();
});
test('diagnostic truncation label remains inside declared field character bound',()=>{
  const host=setup(active());
  Object.assign(host,{agent:{messages:()=>[active()],isLoading:()=>true,isThreadLoading:()=>false,error:()=> 'x'.repeat(1000000)}});
  const snapshot=host.readCaptureProgress(COMPARISON_CAPTURE_LIMITS);
  expect(snapshot.status).toBe('available');
  if(snapshot.status==='available') {expect(snapshot.value.error?.length).toBeLessThanOrEqual(2048);expect(snapshot.value.error).toContain('[diagnostic truncated]');}
});
test('unsafe streaming identity fails explicitly rather than reporting no active host',()=>{
  expect(()=>setup({...active(),id:'x'.repeat(2049)}).readActiveHost()).toThrow('identity');
  const touch=vi.fn(()=>{throw Error('role');});const message=active();Object.defineProperty(message,'role',{get:touch});
  expect(setup(message).readCaptureProgress(COMPARISON_CAPTURE_LIMITS)).toMatchObject({status:'unavailable'});
  expect(touch).not.toHaveBeenCalled();
});
