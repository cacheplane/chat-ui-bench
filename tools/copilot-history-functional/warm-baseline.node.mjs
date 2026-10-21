import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarmBaseline} from './warm-baseline.mjs';

const connectedState=new WeakMap();
class FixtureNativeNode {
 constructor(value){connectedState.set(this,value);}
 get isConnected(){if(!connectedState.has(this))throw new TypeError('fixture native brand');return connectedState.get(this);}
}
const native=Object.freeze({apply:Reflect.apply,prototype:Object.getPrototypeOf,array:Array.isArray,mapPrototype:Map.prototype,mapGet:Map.prototype.get,mapEntries:Map.prototype.entries,mapSize:Object.getOwnPropertyDescriptor(Map.prototype,'size').get,mapNext:Object.getPrototypeOf(new Map().entries()).next,nodeConnected:Object.getOwnPropertyDescriptor(FixtureNativeNode.prototype,'isConnected').get});
const typedPrototype=Object.getPrototypeOf(Float64Array.prototype);
const typed=Object.freeze({length:Object.getOwnPropertyDescriptor(typedPrototype,'length').get,buffer:Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get,tag:Object.getOwnPropertyDescriptor(typedPrototype,Symbol.toStringTag).get,byteLength:Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get,resizable:Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get??null,float64Prototype:Float64Array.prototype,arrayBufferPrototype:ArrayBuffer.prototype});
function setup(){
 const flat=new Float64Array(200);for(let i=0;i<100;i++){flat[2*i]=i*10;flat[2*i+1]=10;}
 const cache=new Map(),origins=Array(101).fill(null),bindings=Array(101).fill(null);
 return {flat,cache,origins,bindings,build(){return createWarmBaseline(native,typed).build(flat,125.5,2,cache,origins,bindings,1,10);}};
}
test('copies exact owned geometry and transfers canonical empty-cache selector inputs',()=>{
 const s=setup(),r=s.build();assert.equal(r.status,'prepared-input');assert.deepEqual(r.inputs,{flat:Array.from(s.flat),mask:Array(100).fill(0),keys:Array.from({length:100},(_,i)=>'history-'+i),viewport:125.5,overscan:2});assert.notEqual(r.inputs.flat,s.flat);
});
test('Float64 Proxy is refused before any application trap',()=>{
 const s=setup();let traps=0;const p=new Proxy(s.flat,{get(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}});
 assert.equal(createWarmBaseline(native,typed).build(p,125.5,2,s.cache,s.origins,s.bindings,1,10).status,'unavailable');assert.equal(traps,0);
});
function origin(row,patch={}){return {row,node:11,size:10,layout:1,eligible:true,commit:8,measure:13,edge:14,resize:15,seq:1,...patch};}
function binding(row,value,patch={}){return {id:11,node:new FixtureNativeNode(value),row,render:4,commit:7,connected:true,measured:true,layout:1,...patch};}
test('cached rows without source origin stay cache-only',()=>{const s=setup();s.cache.set(7,10);assert.equal(s.build().inputs.mask[7],1);});
test('detached authentic historical origin retains credit',()=>{const s=setup();s.cache.set(7,10);s.origins[7]=origin(7);s.bindings[7]=binding(7,false,{connected:false});assert.equal(s.build().inputs.mask[7],3);});
test('connected unmeasured rows remain in connected population',()=>{const s=setup();s.bindings[7]=binding(7,true,{measured:false});assert.equal(s.build().inputs.mask[7],4);});
test('only unchanged partial validity and all connectivity flags produce bit8',()=>{const s=setup();s.cache.set(7,10);s.origins[7]=origin(7);s.bindings[7]=binding(7,true);assert.equal(s.build().inputs.mask[7],15);s.bindings[7].measured=false;assert.equal(s.build().inputs.mask[7],7);s.bindings[7].measured=true;s.bindings[7].connected=false;assert.equal(s.build().inputs.mask[7],7);});
for(const patch of[{layout:2},{eligible:false},{commit:null},{size:9}])test('authentic stale/ineligible origin receives no credit '+JSON.stringify(patch),()=>{const s=setup();s.cache.set(7,10);s.origins[7]=origin(7,patch);s.bindings[7]=binding(7,true);assert.equal(s.build().inputs.mask[7],5);});
test('latest binding identity mismatch removes live measurement, not historical origin',()=>{const s=setup();s.cache.set(7,10);s.origins[7]=origin(7);s.bindings[7]=binding(7,true,{id:12});assert.equal(s.build().inputs.mask[7],7);});
test('connected tail100 refuses canonical100 preparation',()=>{const s=setup();s.bindings[100]=binding(100,true);assert.equal(s.build().status,'unavailable');});
test('native connectivity ignores shadow application getter',()=>{const s=setup();let calls=0;s.bindings[3]=binding(3,true,{measured:false});Object.defineProperty(s.bindings[3].node,'isConnected',{get(){calls++;throw Error('application');}});assert.equal(s.build().inputs.mask[3],4);assert.equal(calls,0);});
test('native cache access ignores overridden application methods and size',()=>{const s=setup();let calls=0;s.cache.set(2,10);for(const k of['get','entries','size'])Object.defineProperty(s.cache,k,{get(){calls++;throw Error('application');}});assert.equal(s.build().inputs.mask[2],1);assert.equal(calls,0);});
test('native typed getters ignore shadow length and buffer properties',()=>{const s=setup();let calls=0;for(const k of['length','buffer'])Object.defineProperty(s.flat,k,{get(){calls++;throw Error('application');}});assert.equal(s.build().status,'prepared-input');assert.equal(calls,0);});
test('native cache brand refuses Proxy before prototype traps',()=>{const s=setup();let calls=0;const cache=new Proxy(s.cache,{getPrototypeOf(){calls++;throw Error('application');},get(){calls++;throw Error('application');}});assert.equal(createWarmBaseline(native,typed).build(s.flat,125.5,2,cache,s.origins,s.bindings,1,10).status,'unavailable');assert.equal(calls,0);});
for(const [name,change]of[['gap',s=>s.flat[4]++],['zero-size',s=>s.flat[3]=0],['infinity',s=>s.flat[3]=Infinity],['stale-cached-size',s=>s.cache.set(0,11)],['cache-tail',s=>s.cache.set(100,10)],['malformed-origin',s=>s.origins[3]=origin(4)],['malformed-binding',s=>s.bindings[3]=binding(4,true)]])test('refuses '+name,()=>{const s=setup();change(s);assert.equal(s.build().status,'unavailable');});
test('shared and non-Float64 native buffers refuse',()=>{const s=setup();for(const f of[new Float64Array(new SharedArrayBuffer(1600)),new Int32Array(200),new Float64Array(202)])assert.equal(createWarmBaseline(native,typed).build(f,125.5,2,s.cache,s.origins,s.bindings,1,10).status,'unavailable');});
test('input state remains unchanged and returned vectors are independent',()=>{const s=setup();s.cache.set(0,10);s.origins[0]=Object.freeze(origin(0));s.bindings[0]=Object.freeze(binding(0,true));Object.freeze(s.origins);Object.freeze(s.bindings);const flat=Array.from(s.flat),r=s.build();assert.equal(r.status,'prepared-input');assert.deepEqual(Array.from(s.flat),flat);assert.deepEqual([...s.cache],[[0,10]]);s.flat[1]=20;assert.equal(r.inputs.flat[1],10);r.inputs.mask[0]=0;assert.equal(s.origins[0].size,10);});
test('captured native numeric predicates and constructors do not dispatch later replacements',()=>{
 const s=setup(),saved=[Number.isFinite,Number.isSafeInteger,globalThis.Array,Object.freeze];let calls=0,result;
 try{Number.isFinite=Number.isSafeInteger=globalThis.Array=Object.freeze=()=>{calls++;throw Error('application replacement');};result=s.build();}catch{result=null;}finally{[Number.isFinite,Number.isSafeInteger,globalThis.Array,Object.freeze]=saved;}
 assert.equal(result?.status,'prepared-input');assert.equal(calls,0);
});
test('source write sequence6400 is authentic and6401 refuses',()=>{const s=setup();s.cache.set(0,10);s.origins[0]=origin(0,{seq:6400});assert.equal(s.build().status,'prepared-input');s.origins[0].seq=6401;assert.equal(s.build().status,'unavailable');});
test('all100 historical/current branches and detachedtail admit without source mutation',()=>{const s=setup();for(let i=0;i<100;i++){s.cache.set(i,10);s.origins[i]=Object.freeze(origin(i,{node:i+1,seq:6400}));s.bindings[i]=Object.freeze(binding(i,true,{id:i+1}));}s.bindings[100]=Object.freeze(binding(100,false));Object.freeze(s.origins);Object.freeze(s.bindings);assert.deepEqual(s.build().inputs.mask,Array(100).fill(15));assert.equal(s.cache.size,100);});
test('finite geometry total1e7 admits and one-over refuses',()=>{const s=setup();for(let i=0;i<100;i++){s.flat[i*2]=i*100000;s.flat[i*2+1]=100000;}assert.equal(createWarmBaseline(native,typed).build(s.flat,1e7,10,s.cache,s.origins,s.bindings,1,10).status,'prepared-input');s.flat[199]++;assert.equal(s.build().status,'unavailable');});
test('missing native DOM capability, detached and resizable storage refuse',()=>{const s=setup();assert.equal(createWarmBaseline({...native,nodeConnected:null},typed).build(s.flat,125.5,2,s.cache,s.origins,s.bindings,1,10).status,'unavailable');const f=new Float64Array(new ArrayBuffer(1600,{maxByteLength:3200}));assert.equal(createWarmBaseline(native,typed).build(f,125.5,2,s.cache,s.origins,s.bindings,1,10).status,'unavailable');structuredClone(s.flat.buffer,{transfer:[s.flat.buffer]});assert.equal(s.build().status,'unavailable');});
