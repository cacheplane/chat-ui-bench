import { describe, expect, it, vi } from 'vitest';
import { ownHistory, validateResponse, createStoreDomain, waitForFrontendDisposal } from '../apps/copilotkit/src/controls.js';

describe('frontend disposal original observation',()=>{
  const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
  it('retains async deadline refusal and observes the later original rejection',async()=>{
    let reject!:(reason:unknown)=>void;
    const original=new Promise<void>((_resolve,no)=>{reject=no;});
    const clock=vi.spyOn(performance,'now').mockReturnValue(10001);
    let waiting:Promise<void>;
    try{expect(()=>{waiting=waitForFrontendDisposal(original,10000);}).not.toThrow();}
    finally{clock.mockRestore();}
    await expect(waiting!).rejects.toThrow('Frontend disposal deadline exceeded; original owner retained');
    await turn();reject(Error('Late frontend disposal original rejection'));await turn();await turn();
  });
  it.each([null,undefined,false,Object.freeze({original:true})])('preserves a normal original rejection by identity %j',async reason=>{
    await expect(waitForFrontendDisposal(Promise.reject(reason),performance.now()+10000)).rejects.toBe(reason);
  });
  it('preserves fulfillment value and refuses an already fulfilled original after expiry',async()=>{
    const value=Object.freeze({value:true});expect(await waitForFrontendDisposal(Promise.resolve(value),performance.now()+10000)).toBe(value);
    await expect(waitForFrontendDisposal(Promise.resolve(value),0)).rejects.toThrow('Frontend disposal deadline exceeded');
  });
  it('keeps an original pending after deadline until its independent outcome and observes late rejection',async()=>{
    let reject!:(reason:unknown)=>void,settled=false;
    const original=new Promise<void>((_resolve,no)=>{reject=no;});
    // Independent owner observes actual settlement in this separate control.
    const reason=Object.freeze({late:true});const own=original.then(()=>{settled=true;},error=>{settled=true;expect(error).toBe(reason);});
    const clock=vi.spyOn(performance,'now').mockReturnValue(0);
    let waiting:Promise<void>;try{waiting=waitForFrontendDisposal(original,1);}finally{clock.mockRestore();}
    await expect(waiting!).rejects.toThrow('Frontend disposal deadline exceeded');expect(settled).toBe(false);
    reject(reason);await own;expect(settled).toBe(true);await turn();await turn();
  });
  it('observes the late rejection after a positive-budget timeout without an independent catch',async()=>{
    let reject!:(reason:unknown)=>void;const original=new Promise<void>((_resolve,no)=>{reject=no;});
    const clock=vi.spyOn(performance,'now').mockReturnValue(0);
    let waiting:Promise<void>;try{waiting=waitForFrontendDisposal(original,1);}finally{clock.mockRestore();}
    await expect(waiting!).rejects.toThrow('Frontend disposal deadline exceeded');reject(Error('Late original after frontend race'));await turn();await turn();
  });
});

const H = [{ id: 'h1', role: 'user', content: 'hello' }, { id: 'h2', role: 'assistant', content: 'world' }];
const ids = { threadId: 'thread', seedRunId: 'seed', continuationRunId: 'continue', responseId: 'response' };
const response = { id: 'response', role: 'assistant', content: 'answer' } as const;

describe('literal history admission', () => {
  it('owns immutable exact three-field full H without sharing mutable input', () => {
    const input = structuredClone(H); const owned = ownHistory(input);
    expect(owned).toEqual(H); input[0]!.content = 'changed'; expect(owned).toEqual(H);
    expect(Object.isFrozen(owned)).toBe(true); expect(Object.isFrozen(owned[0])).toBe(true);
  });
  it.each([[], [{...H[0], metadata: {}}], [{id:'x',role:'system',content:'x'}], [{id:'x',role:'user',content:4}], [H[0],H[0]]].map(value=>({value})))('rejects malformed/empty H $value', ({value}) => expect(() => ownHistory(value)).toThrow());
  it('rejects non-enumerable and symbol own additions', () => {
    const extra = {...H[0]}; Object.defineProperty(extra, 'hidden', {value:true});
    expect(() => ownHistory([extra])).toThrow(); expect(() => ownHistory([{...H[0], [Symbol()]:true}])).toThrow();
  });
  it('rejects missing array elements and bounded history/content overflow', () => {
    expect(()=>ownHistory(new Array(2))).toThrow(); expect(()=>ownHistory(Array.from({length:6401},(_,i)=>({id:String(i),role:'user',content:'x'})))).toThrow();
    expect(()=>ownHistory([{id:'h',role:'user',content:'x'.repeat(513)}])).toThrow();
  });
  it('bounds history UTF-8 bytes including multibyte content and lone surrogates', () => {
    expect(()=>ownHistory([{id:'h',role:'user',content:'é'.repeat(256)}])).not.toThrow();
    expect(()=>ownHistory([{id:'h',role:'user',content:'é'.repeat(257)}])).toThrow();
    expect(()=>ownHistory([{id:'h',role:'user',content:'\ud800'.repeat(170)}])).not.toThrow();
    expect(()=>ownHistory([{id:'h',role:'user',content:'\ud800'.repeat(171)}])).toThrow();
  });
});

describe('projected assistant and bounded metadata', () => {
  it('accepts canonical projection plus public metadata', () => expect(() => validateResponse({...response, metadata:{source:'sdk'}}, response)).not.toThrow());
  it.each([{...response, content:'wrong'}, {...response, role:'user'}, {...response,id:'wrong'}, {...response, unknown:true}, {...response, metadata:{large:'x'.repeat(4097)}}])('rejects mismatch/unknown/overflow %j', value => expect(() => validateResponse(value, response)).toThrow());
  it('bounds escaped metadata JSON bytes before retaining metadata', () => {
    expect(()=>validateResponse({...response,metadata:{data:'\0'.repeat(700)}},response)).toThrow();
  });
  it('rejects metadata array iterators/accessors without invoking caller code', () => {
    const iterator=vi.fn(()=>[1][Symbol.iterator]()); const array=[1]; Object.defineProperty(array,Symbol.iterator,{value:iterator});
    expect(()=>validateResponse({...response,metadata:{array}},response)).toThrow(); expect(iterator).not.toHaveBeenCalled();
    const getter=vi.fn(()=>1); const accessors=[1]; Object.defineProperty(accessors,'0',{get:getter});
    expect(()=>validateResponse({...response,metadata:{array:accessors}},response)).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
  it('bounds the expected canonical assistant projection and H100 profile', () => {
    const huge={...response,content:'x'.repeat(6401)}; expect(()=>validateResponse(huge,huge)).toThrow();
    expect(()=>ownHistory(Array.from({length:101},(_,i)=>({id:String(i),role:'user',content:'x'})))).toThrow();
  });
  it('bounds canonical assistant UTF-8 bytes including multibyte and lone surrogate content', () => {
    for(const content of ['é'.repeat(3200),'\ud800'.repeat(2133),'😀'.repeat(1600)]) {
      const canonical={...response,content}; expect(()=>validateResponse(canonical,canonical)).not.toThrow();
    }
    for(const content of ['é'.repeat(3201),'\ud800'.repeat(2134),'😀'.repeat(1601)]) {
      const canonical={...response,content}; expect(()=>validateResponse(canonical,canonical)).toThrow();
    }
  });
});

function ready(incompleteDisposal = false) {
  const domain = createStoreDomain(); const c = domain.beginCase(ids,H,[]);
  const server=c.ownOperation('server-disposal'); const harness=c.ownOperation('harness-disposal');
  if (!incompleteDisposal) { server.settle(); harness.settle(); }
  c.admitSeed({threadId:'thread',runId:'seed',messages:[]}, vi.fn());
  c.observeSeed({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,messages:H});
  c.admitMount(); c.observeMounted({idle:true,error:null,messages:H}); return {domain,c,server,harness};
}
describe('owned lifecycle admission', () => {
  it('rejects unexpected storage without clearing and prevents concurrent cases', () => {
    const d = createStoreDomain(); expect(() => d.beginCase(ids,H,['other'])).toThrow();
    d.beginCase(ids,H,[]); expect(() => d.beginCase(ids,H,[])).toThrow();
  });
  it('requires seed empty input and admitted original IDs before allocating', () => {
    const c=createStoreDomain().beginCase(ids,H,[]); const alloc=vi.fn();
    for(const request of [{threadId:'wrong',runId:'seed',messages:[]},{threadId:'thread',runId:'wrong',messages:[]},{threadId:'thread',runId:'seed',messages:H}]) expect(() => c.admitSeed(request,alloc)).toThrow();
    expect(alloc).not.toHaveBeenCalled(); c.admitSeed({threadId:'thread',runId:'seed',messages:[]},alloc);
    expect(() => c.admitSeed({threadId:'thread',runId:'seed',messages:[]},alloc)).toThrow(); expect(alloc).toHaveBeenCalledTimes(1);
  });
  it.each(['terminalSuccess','eof','bridgeSettled','publicSettled','idle'] as const)('blocks mount without seed %s', missing => {
    const c=createStoreDomain().beginCase(ids,H,[]); c.admitSeed({threadId:'thread',runId:'seed',messages:[]},vi.fn());
    expect(() => c.observeSeed({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,messages:H,[missing]:false})).toThrow(); expect(() => c.admitMount()).toThrow();
  });
  it('rejects altered committed H and independently requires mounted H', () => {
    const c=createStoreDomain().beginCase(ids,H,[]); c.admitSeed({threadId:'thread',runId:'seed',messages:[]},vi.fn());
    expect(() => c.observeSeed({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,messages:[H[1],H[0]]})).toThrow();
    c.observeSeed({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,messages:H}); c.admitMount();
    expect(() => c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn())).toThrow();
    expect(() => c.observeMounted({idle:true,error:null,messages:H.slice(1)})).toThrow();
  });
  it('requires full unchanged continuation H, once-only allocation and stable IDs', () => {
    const {c}=ready(); const alloc=vi.fn();
    for(const messages of [[],H.slice(1),[...H,{id:'new',role:'user',content:'x'}],[H[1],H[0]],[{...H[0],metadata:{}},H[1]],[{...H[0],content:'changed'},H[1]]]) expect(() => c.admitContinuation({threadId:'thread',runId:'continue',messages},alloc)).toThrow();
    expect(() => c.admitContinuation({threadId:'wrong',runId:'continue',messages:H},alloc)).toThrow();
    expect(() => c.admitContinuation({threadId:'thread',runId:'wrong',messages:H},alloc)).toThrow(); expect(alloc).not.toHaveBeenCalled();
    c.admitContinuation({threadId:'thread',runId:'continue',messages:H},alloc);
    expect(() => c.admitContinuation({threadId:'thread',runId:'continue',messages:H},alloc)).toThrow(); expect(alloc).toHaveBeenCalledTimes(1);
  });
  it.each(['native-connect','http','producer','reader','bridge','public-operation'] as const)('incomplete original %s blocks clear/reuse despite stop and idle', kind => {
    const {c,domain}=ready(); const op=c.ownOperation(kind); c.closeAdmission(); c.observeIdle(true); const clear=vi.fn();
    expect(() => c.clearStore(clear)).toThrow(); expect(clear).not.toHaveBeenCalled(); expect(() => domain.beginCase(ids,H,[])).toThrow();
    expect(() => c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn())).toThrow();
    op.settle(); expect(() => op.settle()).toThrow(); c.clearStore(clear); expect(clear).toHaveBeenCalledTimes(1);
    expect(() => domain.beginCase(ids,H,[])).toThrow(); expect(() => c.observeEmptyAfterClear(['thread'])).toThrow();
    c.observeEmptyAfterClear([]); expect(() => domain.beginCase(ids,H,[])).toThrow(); c.finishDisposal(); domain.beginCase(ids,H,[]);
  });
  it('cannot clear from idle alone or finish before clear/post-empty; duplicate clear denied', () => {
    const {c}=ready(); c.observeIdle(true); expect(() => c.clearStore(vi.fn())).toThrow(); expect(() => c.finishDisposal()).toThrow();
    c.closeAdmission(); c.clearStore(vi.fn()); expect(() => c.clearStore(vi.fn())).toThrow(); expect(() => c.finishDisposal()).toThrow();
    c.observeEmptyAfterClear([]); c.finishDisposal(); expect(() => c.ownOperation('http')).toThrow();
  });
  it('cannot clear an admitted original seed or continuation from stop/idle alone', () => {
    const seed=createStoreDomain().beginCase(ids,H,[]); seed.admitSeed({threadId:'thread',runId:'seed',messages:[]},vi.fn());
    seed.closeAdmission(); seed.observeIdle(true); expect(() => seed.clearStore(vi.fn())).toThrow();
    const {c}=ready(); c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn());
    c.closeAdmission(); c.observeIdle(true); expect(() => c.clearStore(vi.fn())).toThrow();
  });
  it('retains fail-closed ownership when clear rejects or original work is registered during allocation', async () => {
    const {c,domain}=ready(); c.closeAdmission(); c.observeIdle(true);
    await expect(c.clearStore(async () => {throw new Error('clear failed');})).rejects.toThrow('clear failed');
    expect(() => c.observeEmptyAfterClear([])).toThrow(); expect(() => c.finishDisposal()).toThrow(); expect(() => domain.beginCase(ids,H,[])).toThrow();
  });
  it('requires complete original continuation receipt plus canonical full final transcript before cleanup', () => {
    const {c}=ready(); c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn());
    const receipt={terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,producerSettled:true,readerSettled:true,messages:[...H,{...response,metadata:{source:'sdk'}}]};
    for(const missing of ['terminalSuccess','eof','bridgeSettled','publicSettled','idle','producerSettled','readerSettled']) expect(()=>c.observeContinuation({...receipt,[missing]:false},response)).toThrow();
    expect(()=>c.observeContinuation({...receipt,messages:[H[0],response]},response)).toThrow();
    c.closeAdmission(); c.observeContinuation(receipt,response); expect(()=>c.observeContinuation(receipt,response)).toThrow();
    c.clearStore(vi.fn()); c.observeEmptyAfterClear([]); c.finishDisposal();
  });
  it('requires independently registered original disposal outcomes before reuse', () => {
    const {c,domain,server,harness}=ready(true);
    c.closeAdmission(); c.observeIdle(true); expect(()=>c.clearStore(vi.fn())).not.toThrow(); c.observeEmptyAfterClear([]);
    expect(()=>c.finishDisposal()).toThrow(); server.settle(); expect(()=>c.finishDisposal()).toThrow();
    harness.settle(); c.finishDisposal(); domain.beginCase(ids,H,[]);
  });
  it('passes immutable owned request data to allocation rather than mutable caller references', () => {
    const {c}=ready(); const input=structuredClone(H); const allocate=vi.fn((request: unknown)=>request);
    const admitted=c.admitContinuation({threadId:'thread',runId:'continue',messages:input},allocate);
    expect(admitted).toEqual({threadId:'thread',runId:'continue',messages:H}); input[0]!.content='changed';
    expect(admitted).toEqual({threadId:'thread',runId:'continue',messages:H}); expect(Object.isFrozen(admitted)).toBe(true);
  });
  it('never invokes history index accessors during continuation request/final receipt validation', () => {
    const {c}=ready(); const getter=vi.fn(()=>H[0]); const altered=structuredClone(H); Object.defineProperty(altered,'0',{get:getter});
    expect(()=>c.admitContinuation({threadId:'thread',runId:'continue',messages:altered},vi.fn())).toThrow(); expect(getter).not.toHaveBeenCalled();
    c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn());
    const final=[...H,response]; Object.defineProperty(final,'0',{get:getter});
    expect(()=>c.observeContinuation({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,producerSettled:true,readerSettled:true,messages:final},response)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it('validates canonical expected descriptors before reading response identity', () => {
    const {c}=ready(); c.admitContinuation({threadId:'thread',runId:'continue',messages:H},vi.fn());
    const getter=vi.fn(()=>response.id); const expected={...response}; Object.defineProperty(expected,'id',{get:getter});
    expect(()=>c.observeContinuation({terminalSuccess:true,eof:true,bridgeSettled:true,publicSettled:true,idle:true,producerSettled:true,readerSettled:true,messages:[...H,response]},expected)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it('rejects identity getters without invoking them or occupying the domain', () => {
    const domain=createStoreDomain(); const getter=vi.fn(()=>ids.threadId); const identity={...ids}; Object.defineProperty(identity,'threadId',{get:getter});
    expect(()=>domain.beginCase(identity,H,[])).toThrow(); expect(getter).not.toHaveBeenCalled();
    expect(()=>domain.beginCase(ids,H,[])).not.toThrow();
  });
  it('rejects additional identity keys and symbols before retaining a case', () => {
    const domain=createStoreDomain();
    const extra={...ids,extra:{retained:'unexpected'}};
    expect(()=>domain.beginCase(extra,H,[])).toThrow();
    expect(()=>domain.beginCase({...ids,[Symbol()]:true},H,[])).toThrow();
    expect(()=>domain.beginCase(ids,H,[])).not.toThrow();
  });
  it.each(['threadId','runId','messages'] as const)('rejects run request %s getters without invoking caller code or allocation', key => {
    const seed=createStoreDomain().beginCase(ids,H,[]); const seedRequest={threadId:'thread',runId:'seed',messages:[]};
    const seedValue=seedRequest[key]; const seedGetter=vi.fn(()=>seedValue); const allocate=vi.fn();
    Object.defineProperty(seedRequest,key,{get:seedGetter});
    expect(()=>seed.admitSeed(seedRequest,allocate)).toThrow(); expect(seedGetter).not.toHaveBeenCalled(); expect(allocate).not.toHaveBeenCalled();
    const {c}=ready(); const request={threadId:'thread',runId:'continue',messages:H}; const value=request[key]; const getter=vi.fn(()=>value);
    Object.defineProperty(request,key,{get:getter});
    expect(()=>c.admitContinuation(request,allocate)).toThrow(); expect(getter).not.toHaveBeenCalled(); expect(allocate).not.toHaveBeenCalled();
  });
  it('rejects run request extra keys/symbols without allocation and admits a subsequent exact envelope', () => {
    const {c}=ready(); const allocate=vi.fn(); const request={threadId:'thread',runId:'continue',messages:H,extra:true};
    expect(()=>c.admitContinuation(request,allocate)).toThrow();
    expect(()=>c.admitContinuation({threadId:'thread',runId:'continue',messages:H,[Symbol()]:true},allocate)).toThrow();
    expect(allocate).not.toHaveBeenCalled(); c.admitContinuation({threadId:'thread',runId:'continue',messages:H},allocate); expect(allocate).toHaveBeenCalledTimes(1);
  });
});
