import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from './worker-core.mjs';
import * as ports from './worker-ports.mjs';
test('wheel family is distinct and uses exact nonce carrier endpoints',()=>{
 assert.equal(typeof core.runWheelCarrierChatCapture,'function');
 assert.equal(typeof core.WheelCarrierRuntimeGate,'function');
 assert.equal(typeof ports.createWheelCarrierTail500ChatPorts,'function');
 for(const [nonce,clickCount]of [['0'.repeat(32),1],['f'.repeat(32),268435456]])assert.deepEqual(core.createWheelCarrierInput(nonce),{schema:1,ordinal:0,clickCount,markerName:`native-wheel-witness-v1:${nonce}:0:${clickCount}`});
 for(const nonce of ['x'.repeat(32),'a'.repeat(31),'A'.repeat(32)])assert.throws(()=>core.createWheelCarrierInput(nonce));
});
test('new runtime gate refuses legacy wheel data while old gate refuses nested witness',async()=>{
 assert.equal(typeof core.WheelCarrierRuntimeGate,'function');
 const session={send:async()=>({result:{type:'object',value:{trusted:true,deltaX:0,deltaY:-10}}})};
 await assert.rejects(new core.WheelCarrierRuntimeGate(session).send('Runtime.awaitPromise',{}));
 await assert.rejects(new core.RuntimeGate({send:async()=>({result:{type:'object',value:{inputRecipe:'native-wheel-carrier-v1',witness:{}}}})}).send('Runtime.awaitPromise',{}));
});
const nonce='a'.repeat(32),recipe='native-wheel-carrier-v1';
function witness(detail=178956971){return{type:'wheel',trusted:true,detail,deltaX:0,deltaY:-100,deltaMode:0,eventTimeStamp:15,callbackNow:16,callbackTimeOrigin:1000,currentTargetIsScroller:true,targetWithinScroller:true,scrollerConnected:true,mark:{name:`native-wheel-witness-v1:${nonce}:0:${detail}`,callState:'returned',entryType:'mark',startTime:17,duration:0}};}
test('new grammar first callback retains actual wheel and native mark observations',async()=>{
 assert.ok(core.WHEEL_CARRIER_GRAMMAR);let listener,options,marks=0;
 const element={isConnected:true,contains:t=>t===target,addEventListener(type,fn,o){assert.equal(type,'wheel');listener=fn;options=o;}},target={};
 const performance={now:()=>16,timeOrigin:1000,mark:name=>{marks++;return{name,entryType:'mark',startTime:17,duration:0}}};
 const arm=Function('document','performance','return ('+core.WHEEL_CARRIER_GRAMMAR.wheelWitness+')')({querySelector:()=>element},performance);
 const promise=arm.call(element,178956971,`native-wheel-witness-v1:${nonce}:0:178956971`);
 listener({type:'wheel',isTrusted:true,detail:178956971,deltaX:0,deltaY:-100,deltaMode:0,timeStamp:15,currentTarget:element,target});
 assert.deepEqual(await promise,{inputRecipe:recipe,witness:witness()});assert.deepEqual(options,{once:true,passive:true});assert.equal(marks,1);
});
for(const patch of [{isTrusted:false},{detail:2},{type:'click'},{deltaY:0},{deltaMode:3}])test('first wrong wheel refuses without marker '+JSON.stringify(patch),async()=>{
 assert.ok(core.WHEEL_CARRIER_GRAMMAR);let listener,marks=0;const element={isConnected:true,contains:()=>true,addEventListener(t,fn){listener=fn;}};
 const arm=Function('document','performance','return ('+core.WHEEL_CARRIER_GRAMMAR.wheelWitness+')')({querySelector:()=>element},{now:()=>16,timeOrigin:1000,mark(){marks++;}});
 const promise=arm.call(element,178956971,`native-wheel-witness-v1:${nonce}:0:178956971`);
 listener({type:'wheel',isTrusted:true,detail:178956971,deltaX:0,deltaY:-100,deltaMode:0,timeStamp:15,currentTarget:element,target:{},...patch});await assert.rejects(promise);assert.equal(marks,0);
});
test('new gate retains only exact bounded own data witness',async()=>{
 assert.equal(typeof core.WheelCarrierRuntimeGate,'function');
 const run=value=>new core.WheelCarrierRuntimeGate({send:async()=>({result:{type:'object',value}})}).send('Runtime.awaitPromise',{});
 assert.deepEqual((await run({inputRecipe:recipe,witness:witness()})).result.value,{inputRecipe:recipe,witness:witness()});
 for(const mutate of [v=>v.witness.extra=1,v=>v.witness.mark.extra=1,v=>v.witness.detail=0,v=>v.witness.trusted=false,v=>v.witness.deltaY=NaN,v=>Object.defineProperty(v.witness,'detail',{get(){throw Error('getter')}})]){const v={inputRecipe:recipe,witness:witness()};mutate(v);await assert.rejects(run(v));}
});
function trace(){const input=core.createWheelCarrierInput(nonce),before={top:300,height:100,extent:1000,x:0,y:0,width:100,rectHeight:100};return{schema:1,inputRecipe:recipe,request:{nonce,sha256:'b'.repeat(64),sourceRevision:'c'.repeat(40)},ordinal:0,selected:{frameId:'frame',loaderId:'loader',executionContextUniqueId:'unique',generation:1,backendNodeId:4},geometry:{before,after:{...before,top:200}},issued:{move:{method:'Input.dispatchMouseEvent',params:{type:'mouseMoved',x:50,y:50},state:'fulfilled',responseShape:'empty-object'},wheel:{method:'Input.dispatchMouseEvent',params:{type:'mouseWheel',x:50,y:50,deltaX:0,deltaY:-100,clickCount:input.clickCount},state:'fulfilled',responseShape:'empty-object'}},witness:witness()};}
test('input trace preserves actual observations and closes every nested schema',()=>{
 assert.equal(typeof core.projectWheelCarrierInputTrace,'function');const original=trace();assert.deepEqual(core.projectWheelCarrierInputTrace(original),original);
 for(const mutate of [t=>t.extra=1,t=>t.request.extra=1,t=>t.issued.wheel.params.extra=1,t=>t.issued.wheel.params.x=51,t=>t.issued.wheel.params.clickCount=2,t=>t.witness.detail=2,t=>t.selected.frameId='a'.repeat(257),t=>t.issued.move.state='pending',t=>t.witness.mark.name='wrong',t=>t.geometry.after.top=300]){const t=trace();mutate(t);assert.throws(()=>core.projectWheelCarrierInputTrace(t));}
 let reads=0;const t=trace();Object.defineProperty(t.selected,'frameId',{enumerable:true,get(){reads++;throw Error('getter')}});assert.throws(()=>core.projectWheelCarrierInputTrace(t));assert.equal(reads,0);
});
test('legacy grammar values remain byte-identical to baseline',async()=>{const {createHash}=await import('node:crypto');assert.equal(Object.keys(core.GRAMMAR).length,9);assert.equal(createHash('sha256').update(JSON.stringify(core.GRAMMAR)).digest('hex'),'9641596f3191c201fde5af376337a36da90155b1dd6e65203751b4d7bc5f0435');});
test('new projector rejects proxies without touching traps and enforces UTF8 and total subcap',()=>{let reads=0;assert.throws(()=>core.projectWheelCarrierInputTrace(new Proxy({}, {ownKeys(){reads++;throw Error('trap')}})));assert.equal(reads,0);const t=trace();t.selected.frameId='😀'.repeat(65);assert.throws(()=>core.projectWheelCarrierInputTrace(t));});
test('new runtime precharges original cap and rejects an oversized native reply',async()=>{let n=0;const g=new core.WheelCarrierRuntimeGate({send:async()=>{n++;return{}}});for(let i=0;i<80;i++)await g.send('Runtime.enable',{});await assert.rejects(g.send('Runtime.enable',{}));assert.equal(n,80);});
