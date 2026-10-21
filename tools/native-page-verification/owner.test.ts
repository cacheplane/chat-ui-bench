import {expect,it}from 'vitest';
it('thin original mode remains unreleased without any capture invocation',async()=>{
 const path='./run.mjs';const module=await import(/* @vite-ignore */path).catch(()=>({}));expect(module.originalModeReceipt).toBeTypeOf('function');
 const receipt=module.originalModeReceipt({functionalGo:true,release:true});expect(receipt).toMatchObject({status:'unreleased',analysis:'not_evaluated',captureInvoked:false});
});
it('source-only injected orchestration preserves actual original ordered method settlement',async()=>{
 const path='./run.mjs';const module=await import(/* @vite-ignore */path).catch(()=>({}));expect(module.runInjectedNativeOwner).toBeTypeOf('function');
 const calls:string[]=[];let release!:()=>void;const hold=new Promise<void>(done=>{release=done;});
 const task=module.runInjectedNativeOwner(()=>({async start(){calls.push('start');await hold;return {status:'open'};},async mark(phase:string){calls.push(phase+'-mark');return {status:'open'};},async finish(){calls.push('finish');return {status:'closed',analysis:'not_evaluated'};},async close(){calls.push('close');return {status:'unavailable',analysis:'not_evaluated'};}}));
 await Promise.resolve();expect(calls).toEqual(['start']);release();expect(await task).toMatchObject({analysis:'not_evaluated',sourceOnly:true});expect(calls).toEqual(['start','start-mark','end-mark','finish']);
});
