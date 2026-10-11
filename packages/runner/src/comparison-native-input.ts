import {performance} from 'node:perf_hooks';
import type {Keyboard, Locator, Mouse} from 'playwright';
import {comparisonIdentitySchema, comparisonInputRecipeSchema, comparisonNativeDispatchResultsSchema, mainOptionsSchema, type ComparisonIdentity, type ComparisonInputRecipe, type ComparisonNativeDispatchResults} from '@chat-ui-bench/contract';
import type {ComparisonOwnershipClock, ComparisonOwnershipContext} from './comparison-ownership.js';

export interface ComparisonNativeControls {
  mouse: Pick<Mouse,'move'|'wheel'>;
  keyboard: Pick<Keyboard,'press'|'up'>;
  scroller: Pick<Locator,'boundingBox'>;
  composer: Pick<Locator,'click'>;
  returnControl: Pick<Locator,'isVisible'|'click'> | null;
}
export interface ComparisonNativeInputOptions {
  identity: ComparisonIdentity; recipe: ComparisonInputRecipe;
  ownership: ComparisonOwnershipContext; controls: ComparisonNativeControls; clock?: ComparisonOwnershipClock;
}
export interface ComparisonNativeInput {
  wheel(): Promise<void>; composer(): Promise<void>; returnControl(): Promise<void>;
  snapshot(): ComparisonNativeDispatchResults; close(): Promise<void>;
}
function diagnostic(error:unknown):string {
  const message=error instanceof Error ? error.message || error.name : String(error);
  return message.length>4096 ? message.slice(0,4075)+' [message truncated]' : message || 'Empty rejection';
}
export function createComparisonNativeInput(o:ComparisonNativeInputOptions):ComparisonNativeInput {
  const ctx=o.ownership;
  if(ctx.stage!=='replay') throw new Error('Native input requires replay ownership');
  ctx.assertActive();
  const identity=comparisonIdentitySchema.parse(o.identity), recipe=comparisonInputRecipeSchema.parse(o.recipe);
  mainOptionsSchema.shape.nativeRecipeIds.parse({wheel:recipe.wheel.recipeId,composer:recipe.composer.recipeId});
  const now=o.clock?.now ?? (()=>performance.now()), setTimer=o.clock?.setTimer ?? setTimeout, clearTimer=o.clock?.clearTimer ?? clearTimeout;
  const dispatches:ComparisonNativeDispatchResults['hostDispatches']=[], results:ComparisonNativeDispatchResults['results']=[];
  const pending=new Set<Promise<unknown>>(), timers=new Map<ReturnType<typeof setTimeout>,()=>void>();
  const attempted=new Set<string>();
  let closed=false, closeAttempt:Promise<void>|undefined, failed=false, firstError:unknown,firstWasCleanup=false;
  const cleanupErrors:unknown[]=[];
  let wheelUsed=false, composerUsed=false, returnUsed=false;
  function fail(error:unknown,cleanup=false) {if(!failed){failed=true;firstError=error;firstWasCleanup=cleanup;}}
  function track<T>(invoke:()=>Promise<T>,cleanup=false):Promise<T> {
    let raw:Promise<T>; try {raw=invoke();} catch(error){raw=Promise.reject(error);}
    const task=raw.then(value=>value,error=>{fail(error,cleanup);if(cleanup&&cleanupErrors.length<18)cleanupErrors.push(error);throw error;});
    pending.add(task); void task.then(()=>pending.delete(task),()=>pending.delete(task)); return task;
  }
  function active() {if(closed) throw new Error('Native input closed');ctx.assertActive();}
  function cleanupUp(key:string) {void track(()=>o.controls.keyboard.up(key),true).catch(()=>{});}
  function close():Promise<void> {
    if(closeAttempt) return closeAttempt;
    closed=true;
    for(const [timer,cancel] of timers){clearTimer(timer);cancel();} timers.clear();
    for(const key of attempted) cleanupUp(key);
    closeAttempt=(async()=>{
      while(pending.size) await Promise.allSettled([...pending]);
      ctx.signal.removeEventListener('abort',abort);
      if(failed) throw new AggregateError([...(firstWasCleanup?[]:[firstError]),...cleanupErrors], 'Native input acquisition or cleanup failed');
    })();
    void closeAttempt.catch(()=>{}); return closeAttempt;
  }
  function abort() {void close().catch(()=>{});}
  const adoption=ctx.adopt({name:'comparison-native-input',close});
  void adoption.catch(fail);
  ctx.signal.addEventListener('abort',abort,{once:true});
  function dispatch(kind:ComparisonNativeDispatchResults['hostDispatches'][number]['kind'],recipeId:string,index:number,offset:number,origin:number,invoke:()=>Promise<void>,key?:string):Promise<void> {
    active();
    const time=now();
    dispatches.push({kind,recipeId,index,requestedOffsetMs:offset,actualOffsetMs:time-origin,hostMonotonicMs:time});
    const result:ComparisonNativeDispatchResults['results'][number]={kind,recipeId,index,invocationAtHostMs:time,completion:{status:'unavailable',reason:'Native command has not settled'}};
    results.push(result); if(key!==undefined) attempted.add(key);
    // Attach the receipt continuation immediately to the actual admitted command.
    return track(invoke).then(()=>{const receipt=now();result.completion={status:'acknowledged',completionAtHostMs:receipt,latencyMs:receipt-time};},error=>{const receipt=now();result.completion={status:'rejected',completionAtHostMs:receipt,latencyMs:receipt-time,message:diagnostic(error)};throw error;}).finally(()=>{if(key!==undefined&&closed) cleanupUp(key);});
  }
  async function group(kind:'wheel'|'composer',origin:number):Promise<void> {
    const count=kind==='wheel'?4:recipe.composer.text.length, cadence=kind==='wheel'?50:35;
    const scheduled=Array.from({length:count},(_,index)=>new Promise<void>((resolve,reject)=>{
      const offset=index*cadence;
      const timer=setTimer(()=>{
        timers.delete(timer);
        try {
          active();
          const key=kind==='composer'?recipe.composer.text[index]!:undefined;
          const action=dispatch(kind,kind==='wheel'?recipe.wheel.recipeId:recipe.composer.recipeId,index,offset,origin,
            ()=>kind==='wheel'?o.controls.mouse.wheel(0,-100):o.controls.keyboard.press(key!),key);
          void action.then(resolve,reject);
        }catch(error){reject(error);}
      },Math.max(0,origin+offset-now()));
      timers.set(timer,resolve);
    }));
    const settlements=await Promise.allSettled(scheduled);
    const errors=settlements.filter((v):v is PromiseRejectedResult=>v.status==='rejected').map(v=>v.reason);
    if(errors.length) throw new AggregateError(errors,'Native group failed');
    active();
  }
  return {
    async wheel(){if(wheelUsed) throw new Error('Wheel group cannot be retried');wheelUsed=true;await adoption;active();
      const box=await track(()=>o.controls.scroller.boundingBox({timeout:ctx.remainingMs()}));active();
      if(!box) throw new Error('Scroller bounding box unavailable');
      await track(()=>o.controls.mouse.move(box.x+box.width/2,box.y+box.height/2));active();await group('wheel',now());},
    async composer(){if(composerUsed) throw new Error('Composer group cannot be retried');composerUsed=true;await adoption;active();
      await track(()=>o.controls.composer.click({timeout:ctx.remainingMs()}));active();await group('composer',now());},
    async returnControl(){if(returnUsed) throw new Error('Return group cannot be retried');returnUsed=true;await adoption;active();
      const control=o.controls.returnControl; if(!control) return;
      const visible=await track(()=>control.isVisible());active();if(!visible) return;
      await dispatch('return-control','comparison-return-control-v1',0,0,now(),()=>control.click({timeout:ctx.remainingMs()}));},
    snapshot(){const complete=results.every(r=>r.completion.status!=='unavailable');return comparisonNativeDispatchResultsSchema.parse({...identity,status:complete?'complete':'partial',...(complete?{}:{reason:'Native commands have not all settled'}),hostDispatches:dispatches,results});},
    close,
  };
}
