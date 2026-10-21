// Private owned ingress only. No page state, measurement, or readiness synthesis.
export function createWarmController(ingress){
 let phase=0,slot=0,chronology=null,plan=null;
 function fail(){phase=-1;chronology=null;plan=null;ingress.abort();}
 function enter(expected,active){if(phase!==expected){fail();throw Error('C-warm-order');}phase=active;}
 async function frame(expected){await ingress.controllerFrame();if(phase!==expected||!ingress.healthy())throw Error('C-warm-health');}
 async function observe(){enter(0,3);try{await frame(3);phase=0;}catch(error){fail();throw error;}}
 async function baseline(){
  enter(0,1);try{
  const sealed=ingress.sealPreparation();chronology=sealed.chronology;plan=sealed.plan;
  if(!chronology?.complete||!ingress.healthy())throw Error('C-warm-seal');
  if(plan.status==='prepared-structural-only'&&plan.reason===null){
   if(!Number.isSafeInteger(plan.steps)||plan.steps<1||plan.steps>12||typeof plan.targets!=='string'||plan.targets.length>35)throw Error('C-warm-plan');
   let cursor=0;
   for(let step=0;step<plan.steps;step++){
    const end=plan.targets.indexOf(',',cursor),last=end<0?plan.targets.length:end,part=plan.targets.slice(cursor,last);
    if(!/^(0|[1-9][0-9]?)$/.test(part)||(step===plan.steps-1)!==(end<0))throw Error('C-warm-plan');
    if(!ingress.moveTo(Number(part)))throw Error('C-warm-motion');
    await frame(1);cursor=last+1;
   }
  }else if(!(plan.status==='unavailable'&&plan.reason==='no-gap'))throw Error('C-warm-plan');
  phase=2;
  }catch(error){fail();throw error;}
 }
 async function snapshot(){
  enter(2,4);try{if(slot===4)throw Error('C-warm-order');const next=++slot;
  if(next<=2)await frame(4);let partial,fence;
  if(next<=2){const result=ingress.partialFence();partial=result.partial;fence=result.fence;}
  else{partial=ingress.adapter.partial();if(partial.reason!=='layout')throw Error('C-warm-layout');fence={historicalComplete:false,liveSubsetValid:false,fullWarmReady:false,connectedRows:0,reason:'closed',nativeGO:false,qualified:false,fps:null};}
  if(phase!==4)throw Error('C-warm-order');
  const result={kind:'warm-history-C-wrapper-v1',slot:next,partial,chronology:next===1?chronology:null,plan:next===1?plan:null,fence,authority:{qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'}};
  if(next===1){chronology=null;plan=null;}phase=2;return result;
  }catch(error){fail();throw error;}
 }
 return Object.freeze({observe,baseline,snapshot,dispose:fail});
}
