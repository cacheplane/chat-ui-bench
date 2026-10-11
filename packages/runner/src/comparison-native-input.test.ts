import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {comparisonIdentitySchema, comparisonInputRecipeSchema, comparisonNativeDispatchResultsSchema} from '@chat-ui-bench/contract';
import {ComparisonOwnership} from './comparison-ownership.js';
import {createComparisonNativeInput, type ComparisonNativeControls, type ComparisonNativeInput} from './comparison-native-input.js';
import type {ComparisonOwnershipContext,ComparisonOwnershipClock} from './comparison-ownership.js';

const identity = comparisonIdentitySchema.parse({schemaVersion:2,suite:'long-thread-prose-v1',suiteVersion:'1.0.0',collectorVersion:'2.0.0',analyzerVersion:'2.0.0',repetition:'r',scenarioId:'case',round:1,caseIndex:0,adapterProfile:'profile'});
const recipe = comparisonInputRecipeSchema.parse({wheel:{recipeId:'comparison-wheel-up-v1',deltasCssPx:[-100,-100,-100,-100],cadenceMs:50},composer:{recipeId:'comparison-composer-calibrate-v1',text:'calibrate',cadenceMs:35,submit:false}});
beforeEach(() => {vi.useFakeTimers(); vi.setSystemTime(0);});
afterEach(() => vi.useRealTimers());

function deferred<T>() {let resolve!:(v:T)=>void, reject!:(v:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});void promise.catch(()=>{});return {promise,resolve,reject};}
function controls():ComparisonNativeControls {return {mouse:{move:vi.fn(async()=>{}),wheel:vi.fn(async()=>{})},keyboard:{press:vi.fn(async()=>{}),up:vi.fn(async()=>{})},scroller:{boundingBox:vi.fn(async()=>({x:0,y:0,width:100,height:100}))},composer:{click:vi.fn(async()=>{})},returnControl:{isVisible:vi.fn(async()=>true),click:vi.fn(async()=>{})}};}
async function exercise(body:(f:{input:ComparisonNativeInput;controls:ComparisonNativeControls;owner:ComparisonOwnership;ctx:ComparisonOwnershipContext;release(fn:()=>void):void})=>Promise<void>, c=controls(),clock:ComparisonOwnershipClock={now:Date.now},options:{recipe?:typeof recipe;ownership?:(ctx:ComparisonOwnershipContext)=>ComparisonOwnershipContext}={}) {
  const owner=new ComparisonOwnership({now:Date.now}), releases:(()=>void)[]=[];
  let failure:unknown, failed=false;
  const work=owner.run('replay',async ctx=>{
    let input:ComparisonNativeInput|undefined;
    try {input=createComparisonNativeInput({identity,recipe:options.recipe??recipe,ownership:options.ownership?.(ctx)??ctx,controls:c,clock});await body({input,controls:c,owner,ctx,release:fn=>releases.push(fn)});}
    catch(error){failed=true;failure=error;}
    finally {const closing=input?.close();void closing?.catch(()=>{});for(const release of releases) release();await Promise.allSettled([closing]);}
  });
  let result:Awaited<typeof work>|undefined;
  try {result=await work;} finally {for(const release of releases) release();await owner.dispose();await owner.ownershipSettled;}
  if(failed) throw failure;expect(result?.status).toBe('complete');return owner;
}
async function flush(){await vi.advanceTimersByTimeAsync(0);}
it('native fixture propagates controlled body assertion after genuine cleanup',async()=>{const closed=vi.fn(async()=>{});await expect(exercise(async({input,ctx})=>{await ctx.adopt({name:'assertion-cleanup',close:closed});await input.returnControl();expect(input.snapshot().results).toHaveLength(2);})).rejects.toThrow();expect(closed).toHaveBeenCalledOnce();});
it('native fixture propagates actual constructor failure before body and cleans adopted resources',async()=>{const body=vi.fn(async()=>{}),closed=vi.fn(async()=>{});await expect(exercise(body,controls(),{now:Date.now},{recipe:{...recipe,wheel:{...recipe.wheel,recipeId:'invalid-constructor-id'}},ownership:ctx=>{void ctx.adopt({name:'before-constructor',close:closed});return ctx;}})).rejects.toThrow();expect(body).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledOnce();});
for(const value of [undefined,null,0,false,''] as const)it(`native fixture propagates actual admission failure: ${String(value)}`,async()=>{const body=vi.fn(async()=>{}),closed=vi.fn(async()=>{});await expect(exercise(body,controls(),{now:Date.now},{ownership:ctx=>{void ctx.adopt({name:'before-admission',close:closed});return {...ctx,assertActive(){throw value;}};}})).rejects.toBe(value);expect(body).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledOnce();});

it('healthy native groups retain fourteen actual settled dispatches', async () => {
  const owner = new ComparisonOwnership({now:Date.now});
  const wheels:number[][]=[], keys:string[]=[], ups:string[]=[];
  const body = owner.run('replay', async ownership => {
    const input = createComparisonNativeInput({identity,recipe,ownership,clock:{now:Date.now},controls:{
      mouse:{async move(){},async wheel(x:number,y:number){wheels.push([x,y]);}},
      keyboard:{async press(key:string){keys.push(key);},async up(key:string){ups.push(key);}},
      scroller:{async boundingBox(){return {x:0,y:0,width:100,height:100};}},
      composer:{async click(){}},returnControl:{async isVisible(){return true;},async click(){}},
    }});
    const wheel = input.wheel();
    await vi.advanceTimersByTimeAsync(150); await wheel;
    const composer = input.composer();
    await vi.advanceTimersByTimeAsync(280); await composer;
    await input.returnControl();
    const snapshot = input.snapshot();
    expect(snapshot.status).toBe('complete');
    expect(snapshot.hostDispatches).toHaveLength(14);
    const expected=[...Array.from({length:4},(_,index)=>({kind:'wheel',recipeId:recipe.wheel.recipeId,index,requestedOffsetMs:index*50})),...Array.from({length:9},(_,index)=>({kind:'composer',recipeId:recipe.composer.recipeId,index,requestedOffsetMs:index*35})),{kind:'return-control',recipeId:'comparison-return-control-v1',index:0,requestedOffsetMs:0}];
    expect(snapshot.hostDispatches.map(({kind,recipeId,index,requestedOffsetMs})=>({kind,recipeId,index,requestedOffsetMs}))).toEqual(expected);
    expect(snapshot.results.map(({kind,recipeId,index})=>({kind,recipeId,index}))).toEqual(expected.map(({kind,recipeId,index})=>({kind,recipeId,index})));
    for(const result of snapshot.results)if(result.completion.status==='acknowledged')expect(result.completion.latencyMs).toBe(result.completion.completionAtHostMs-result.invocationAtHostMs);
    expect(snapshot.results.every(r=>r.completion.status==='acknowledged')).toBe(true);
    expect(comparisonNativeDispatchResultsSchema.safeParse(snapshot).success).toBe(true);
    expect(wheels).toEqual(Array.from({length:4},()=>[0,-100]));
    expect(keys.join('')).toBe('calibrate');
    snapshot.results.length=0; expect(input.snapshot().results).toHaveLength(14);
    const close=input.close(); expect(input.close()).toBe(close); await close;
  });
  try {expect((await body).status).toBe('complete');}
  finally {await owner.dispose(); await owner.ownershipSettled;}
  expect(owner.failures).toEqual([]); expect(owner.canContinue).toBe(true);
});
for(const delay of [10,-10] as const)it(delay>0?'delayed timer retains actual lateness':'negative signed lateness is derived without clamping',async()=>{await exercise(async({input})=>{const wheel=input.wheel();await vi.advanceTimersByTimeAsync(200);await wheel;const rows=input.snapshot().hostDispatches;expect(rows[1]!.actualOffsetMs-rows[1]!.requestedOffsetMs).toBe(delay);expect(rows[1]!.actualOffsetMs).toBe(50+delay);},controls(),{now:Date.now,setTimer:(callback,ms)=>setTimeout(callback,Math.max(0,ms+delay))});});
it('healthy native required settlement cannot complete early',async()=>{const c=controls(),hold=deferred<void>();vi.mocked(c.returnControl!.click).mockImplementationOnce(()=>hold.promise);await exercise(async({input,release})=>{release(()=>hold.resolve());const returned=input.returnControl();void returned.catch(()=>{});await flush();expect(input.snapshot().status).toBe('partial');const close=input.close();let settled=false;void close.then(()=>{settled=true;},()=>{settled=true;});await flush();expect(settled).toBe(false);hold.resolve();await returned;await close;expect(input.snapshot().status).toBe('complete');},c);});
it('native adoption precedes commands and close does not await enclosing adoption',async()=>{const c=controls(),owner=new ComparisonOwnership({now:Date.now}),hold=deferred<void>();let failure:unknown,failed=false;try{const result=await owner.run('replay',async ctx=>{let adopted=0;const input=createComparisonNativeInput({identity,recipe,controls:c,clock:{now:Date.now},ownership:{...ctx,async adopt(resource){adopted++;await ctx.adopt(resource);await hold.promise;}}});expect(adopted).toBe(1);const wheel=input.wheel();void wheel.catch(()=>{});try{await flush();expect(c.scroller.boundingBox).not.toHaveBeenCalled();await input.close();hold.resolve();await expect(wheel).rejects.toThrow();}catch(error){failed=true;failure=error;}finally{const close=input.close();hold.resolve();await Promise.allSettled([close,wheel]);}});expect(result.status).toBe('complete');}finally{hold.resolve();await owner.dispose();await owner.ownershipSettled;}if(failed)throw failure;});
it('independent cleanup errors retained after all settles',async()=>{const c=controls(),hold=deferred<void>();vi.mocked(c.keyboard.up).mockImplementation(async key=>{if(key==='c'){await hold.promise;throw 0;}if(key==='a')throw false;});await exercise(async({input,release})=>{release(()=>hold.resolve());const group=input.composer();await vi.advanceTimersByTimeAsync(280);await group;let settled=false;const close=input.close();void close.then(()=>{settled=true;},()=>{settled=true;});try{await flush();expect(settled).toBe(false);}finally{hold.resolve();}try{await close;throw new Error('Expected cleanup failure');}catch(error){expect(error).toBeInstanceOf(AggregateError);if(error instanceof AggregateError){expect(error.errors).toContain(0);expect(error.errors).toContain(false);}}},c);});
it('adopts collector before first command',async()=>{await exercise(async({input,controls,ctx})=>{expect(ctx.stage).toBe('replay');expect(controls.scroller.boundingBox).not.toHaveBeenCalled();expect(controls.keyboard.press).not.toHaveBeenCalled();await input.returnControl();expect(controls.returnControl!.click).toHaveBeenCalledOnce();});});
it('synchronous handle snapshot survives failed start',async()=>{const c=controls();vi.mocked(c.scroller.boundingBox).mockRejectedValue(false);await exercise(async({input})=>{expect(input.snapshot().results).toEqual([]);await expect(input.wheel()).rejects.toBe(false);expect(input.snapshot().results).toEqual([]);expect(comparisonNativeDispatchResultsSchema.safeParse(input.snapshot()).success).toBe(true);},c);});
for(const value of [undefined,null,0,false,''] as const)it(`falsy rejection remains failure: ${String(value)}`,async()=>{const c=controls();vi.mocked(c.mouse.wheel).mockRejectedValueOnce(value);await exercise(async({input})=>{const wheel=input.wheel();void wheel.catch(()=>{});await vi.advanceTimersByTimeAsync(150);await expect(wheel).rejects.toThrow();expect(input.snapshot().results[0]!.completion.status).toBe('rejected');try{await input.close();throw Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(AggregateError);if(error instanceof AggregateError)expect(error.errors).toContain(value);}},c);});
it('snapshot after expiry performs zero I/O',async()=>{const c=controls(),hold=deferred<void>(),owner=new ComparisonOwnership({now:Date.now});vi.mocked(c.mouse.wheel).mockImplementationOnce(()=>hold.promise);let input:ComparisonNativeInput|undefined;const stage=owner.run('replay',async ownership=>{input=createComparisonNativeInput({identity,recipe,ownership,controls:c,clock:{now:Date.now}});await input.wheel();});try{await vi.advanceTimersByTimeAsync(30000);expect((await stage).status).toBe('expired');const count=vi.mocked(c.mouse.wheel).mock.calls.length;input?.snapshot();input?.snapshot();expect(c.mouse.wheel).toHaveBeenCalledTimes(count);expect(c.scroller.boundingBox).toHaveBeenCalledOnce();}finally{const disposal=owner.dispose();hold.resolve();await disposal;await owner.ownershipSettled;}});
it('native recipe IDs must match the actual B installer contract',async()=>{const owner=new ComparisonOwnership({now:Date.now}),c=controls();try{const result=await owner.run('replay',async ownership=>{expect(()=>createComparisonNativeInput({identity,ownership,controls:c,recipe:{...recipe,wheel:{...recipe.wheel,recipeId:'unbound-wheel'}}})).toThrow();expect(c.mouse.wheel).not.toHaveBeenCalled();expect(c.scroller.boundingBox).not.toHaveBeenCalled();});expect(result.status).toBe('complete');}finally{await owner.dispose();await owner.ownershipSettled;}});

it('setup native context rejects before timers or commands',async()=>{
 const owner=new ComparisonOwnership({now:Date.now}), c=controls();
 try{const result=await owner.run('setup',async ownership=>{expect(()=>createComparisonNativeInput({identity,recipe,ownership,controls:c})).toThrow('replay');expect(c.scroller.boundingBox).not.toHaveBeenCalled();expect(c.mouse.wheel).not.toHaveBeenCalled();});
 expect(result.status).toBe('complete');}finally{await owner.dispose();await owner.ownershipSettled;}
});
for(const kind of ['wheel','composer'] as const) {
 it(kind==='wheel'?'first rejected wheel leaves other armed callbacks invoking once':'first rejected press leaves other armed characters invoking once',async()=>{
  const c=controls(), call=kind==='wheel'?c.mouse.wheel:c.keyboard.press;vi.mocked(call).mockRejectedValueOnce(false);
  await exercise(async({input})=>{const group=input[kind]();const observed=group.then(()=>false,()=>true);await vi.advanceTimersByTimeAsync(300);expect(await observed).toBe(true);expect(call).toHaveBeenCalledTimes(kind==='wheel'?4:9);expect(input.snapshot().results[0]!.completion.status).toBe('rejected');},c);
 });
 it(kind==='wheel'?'four wheels arm before held first ACK':'nine calibrate timers arm before held ACK',async()=>{
  const c=controls(), hold=deferred<void>(), call=kind==='wheel'?c.mouse.wheel:c.keyboard.press;vi.mocked(call).mockImplementationOnce(()=>hold.promise);
  await exercise(async({input,release})=>{release(()=>hold.resolve());let settled=false;const group=input[kind]().finally(()=>{settled=true;});void group.catch(()=>{});await vi.advanceTimersByTimeAsync(300);expect(call).toHaveBeenCalledTimes(kind==='wheel'?4:9);expect(settled).toBe(false);expect(input.snapshot().status).toBe('partial');hold.resolve();await group;},c);
 });
 it(kind==='wheel'?'rejected dispatch is not retried':'falsy press rejection stays rejected',async()=>{
  const c=controls(), call=kind==='wheel'?c.mouse.wheel:c.keyboard.press;vi.mocked(call).mockRejectedValueOnce(undefined);
  await exercise(async({input})=>{const group=input[kind]();void group.catch(()=>{});await vi.advanceTimersByTimeAsync(300);await expect(group).rejects.toThrow();await expect(input[kind]()).rejects.toThrow('retried');expect(call).toHaveBeenCalledTimes(kind==='wheel'?4:9);expect(input.snapshot().results[0]!.completion.status).toBe('rejected');},c);
 });
}
it('group rejection waits every admitted settlement',async()=>{
 const c=controls(),hold=deferred<void>();vi.mocked(c.mouse.wheel).mockRejectedValueOnce(null).mockImplementationOnce(()=>hold.promise);
 await exercise(async({input,release})=>{release(()=>hold.resolve());let settled=false;const group=input.wheel();void group.then(()=>{settled=true;},()=>{settled=true;});await vi.advanceTimersByTimeAsync(200);expect(settled).toBe(false);hold.resolve();await expect(group).rejects.toThrow();},c);
});
it('stalled 300ms checkpoint cannot serialize wheels',async()=>{
 const checkpoint=deferred<void>();await exercise(async({input,controls,release})=>{release(()=>checkpoint.resolve());const wheel=input.wheel();await vi.advanceTimersByTimeAsync(300);expect(controls.mouse.wheel).toHaveBeenCalledTimes(4);await wheel;});
});
it('preparation precedes origin',async()=>{
 const c=controls(),box=deferred<{x:number;y:number;width:number;height:number}|null>();vi.mocked(c.scroller.boundingBox).mockImplementationOnce(()=>box.promise);
 await exercise(async({input,release})=>{release(()=>box.resolve(null));const wheel=input.wheel();void wheel.catch(()=>{});await vi.advanceTimersByTimeAsync(100);expect(c.mouse.wheel).not.toHaveBeenCalled();box.resolve({x:0,y:0,width:10,height:10});await vi.advanceTimersByTimeAsync(150);await wheel;expect(input.snapshot().hostDispatches[0]!.hostMonotonicMs).toBe(100);},c);
});
it('late ACK samples actual host settlement',async()=>{
 const c=controls(),hold=deferred<void>();vi.mocked(c.mouse.wheel).mockImplementationOnce(()=>hold.promise);
 await exercise(async({input,release})=>{release(()=>hold.resolve());const group=input.wheel();void group.catch(()=>{});await vi.advanceTimersByTimeAsync(400);hold.resolve();await group;const completion=input.snapshot().results[0]!.completion;expect(completion.status==='acknowledged'&&completion.completionAtHostMs).toBe(400);},c);
});
for(const visible of [false,null] as const) it(visible===null?'absent or invisible return has no fallback':'invisible declared return has no fallback',async()=>{
 const c=controls();if(visible===null)c.returnControl=null;else vi.mocked(c.returnControl!.isVisible).mockResolvedValue(false);
 await exercise(async({input})=>{const w=input.wheel();await vi.advanceTimersByTimeAsync(150);await w;const k=input.composer();await vi.advanceTimersByTimeAsync(280);await k;await input.returnControl();expect(input.snapshot().results).toHaveLength(13);expect(c.mouse.move).toHaveBeenCalledTimes(1);},c);
});
it('visible declared return invokes once',async()=>{await exercise(async({input,controls})=>{await input.returnControl();await expect(input.returnControl()).rejects.toThrow('retried');expect(controls.returnControl!.click).toHaveBeenCalledTimes(1);expect(input.snapshot().hostDispatches[0]).toMatchObject({recipeId:'comparison-return-control-v1',index:0,requestedOffsetMs:0});});});
it('maximum ledger is fourteen',async()=>{await exercise(async({input})=>{const w=input.wheel();await vi.advanceTimersByTimeAsync(150);await w;const k=input.composer();await vi.advanceTimersByTimeAsync(280);await k;await input.returnControl();for(const kind of ['wheel','composer','returnControl'] as const)await expect(input[kind]()).rejects.toThrow();expect(input.snapshot().results).toHaveLength(14);});});
it('snapshot clone cannot mutate helper',async()=>{await exercise(async({input})=>{await input.returnControl();input.snapshot().hostDispatches[0]!.recipeId='mutated';expect(input.snapshot().hostDispatches[0]!.recipeId).toBe('comparison-return-control-v1');});});
it('canceled action has no ledger entry',async()=>{await exercise(async({input,controls})=>{const w=input.wheel();void w.catch(()=>{});await flush();await input.close();await expect(w).rejects.toThrow();expect(controls.mouse.wheel).toHaveBeenCalledTimes(1);expect(input.snapshot().results).toHaveLength(1);});});
it('abort cancels pending timers and begins keyups independently',async()=>{
 const c=controls(),hold=deferred<void>();vi.mocked(c.keyboard.press).mockImplementationOnce(()=>hold.promise);
 await exercise(async({input,release})=>{release(()=>hold.resolve());const group=input.composer();void group.catch(()=>{});await flush();const close=input.close();void close.catch(()=>{});expect(c.keyboard.up).toHaveBeenCalledWith('c');await vi.advanceTimersByTimeAsync(300);expect(c.keyboard.press).toHaveBeenCalledTimes(1);hold.resolve();await Promise.allSettled([close,group]);},c);
});
it('late opaque press requires final cleanup up',async()=>{
 const c=controls(),hold=deferred<void>(),finalUp=deferred<void>();vi.mocked(c.keyboard.press).mockImplementationOnce(()=>hold.promise);vi.mocked(c.keyboard.up).mockResolvedValueOnce().mockImplementationOnce(()=>finalUp.promise);
 await exercise(async({input,release})=>{release(()=>hold.resolve());release(()=>finalUp.resolve());const group=input.composer();void group.catch(()=>{});await flush();let closed=false;const close=input.close();void close.then(()=>{closed=true;},()=>{closed=true;});hold.resolve();await flush();expect(c.keyboard.up).toHaveBeenCalledTimes(2);expect(closed).toBe(false);finalUp.resolve();await close;await Promise.allSettled([group]);},c);
});
it('keyup rejection retains unsafe failure',async()=>{
 const c=controls();vi.mocked(c.keyboard.up).mockRejectedValue(false);const owner=await exercise(async({input})=>{const k=input.composer();await vi.advanceTimersByTimeAsync(280);await k;await expect(input.close()).rejects.toThrow();},c);expect(owner.canContinue).toBe(false);expect(owner.failures.length).toBeGreaterThan(0);
});
for(const name of ['held press does not delay other resource closes','held command keeps ownership unsettled past report'] as const) it(name,async()=>{
 const c=controls(),hold=deferred<void>();vi.mocked(c.keyboard.press).mockImplementationOnce(()=>hold.promise);
 const owner=new ComparisonOwnership({now:Date.now}), other=vi.fn(async()=>{});let input:ComparisonNativeInput|undefined;
 const stage=owner.run('replay',async ownership=>{await ownership.adopt({name:'other',close:other});input=createComparisonNativeInput({identity,recipe,ownership,controls:c,clock:{now:Date.now}});await input.composer();});
 void stage.catch(()=>{});
 try {await vi.advanceTimersByTimeAsync(30000);expect((await stage).status).toBe('expired');const dispose=owner.dispose();await flush();expect(other).toHaveBeenCalledTimes(1);let settled=false;void owner.ownershipSettled.then(()=>{settled=true;});await vi.advanceTimersByTimeAsync(10000);expect((await dispose).status).toBe('expired');expect(settled).toBe(false);expect(owner.canContinue).toBe(false);}
 finally {const close=input?.close();void close?.catch(()=>{});hold.resolve();await Promise.allSettled([close]);await owner.ownershipSettled;}
});
