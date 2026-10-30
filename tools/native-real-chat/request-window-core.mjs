import {types} from 'node:util';
import {GRAMMAR,RuntimeGate} from './worker-core.mjs';

export const REQUEST_WINDOW_RECIPE='native-stock033-request-window-scroll-v1';
export const REQUEST_WINDOW_CAPTURE_PROTOCOL_V1='request-window-trace-preroll-1000-v1';
export const REQUEST_WINDOW_RUN_ID='native-request-window-v1';
const unavailable=()=>new Error('native-request-window-unavailable');
function own(value,key){if(!value||typeof value!=='object'||types.isProxy(value))throw unavailable();const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))throw unavailable();return d.value;}
function closed(value,keys){if(!value||typeof value!=='object'||types.isProxy(value)||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)throw unavailable();const out={};for(const key of keys)out[key]=own(value,key);return out;}
function validNonce(nonce){if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce))throw unavailable();return nonce;}
function ns(value){if(typeof value!=='string'||value.length>40||!/^(0|[1-9][0-9]*)$/.test(value))throw unavailable();return BigInt(value);}
function markName(name,phase){if(typeof name!=='string'||!new RegExp('^native:'+REQUEST_WINDOW_RUN_ID+':history100-up:'+phase+':[a-f0-9]{16}$').test(name))throw unavailable();return name;}

export function createRequestWindowInput(nonce){validNonce(nonce);return Object.freeze({schema:1,ordinal:0,markerName:`${REQUEST_WINDOW_RECIPE}:${nonce}:0`});}
export function createRequestWindowGesture(input,before){const i=closed(input,['schema','ordinal','markerName']);if(i.schema!==1||i.ordinal!==0||typeof i.markerName!=='string'||!new RegExp('^'+REQUEST_WINDOW_RECIPE+':[a-f0-9]{32}:0$').test(i.markerName))throw unavailable();const g={};for(const key of ['x','y','width','rectHeight']){g[key]=own(before,key);if(!Number.isFinite(g[key]))throw unavailable();}if(g.x<0||g.y<0||g.width<=0||g.rectHeight<=0||g.x+g.width>1280||g.y+g.rectHeight>720)throw unavailable();return Object.freeze({x:g.x+g.width/2,y:g.y+g.rectHeight/2,yDistance:1600,gestureSourceType:'mouse',speed:800,preventFling:true,repeatCount:0,interactionMarkerName:i.markerName});}

// Authored/imported DTO validation is structural. The production bridge must
// additionally bind these exact names and nonce to its owned receipt/request.
export function projectRequestWindow(value){const w=closed(value,['schema','inputRecipe','nonce','start','end','window']);if(w.schema!==1||w.inputRecipe!==REQUEST_WINDOW_RECIPE)throw unavailable();validNonce(w.nonce);w.start=closed(w.start,['name','tsNs']);w.end=closed(w.end,['name','tsNs']);w.window=closed(w.window,['startNs','endNs']);markName(w.start.name,'start');markName(w.end.name,'end');const start=ns(w.start.tsNs),end=ns(w.end.tsNs),low=ns(w.window.startNs),high=ns(w.window.endNs);if(end-start<2000000000n||low!==start+500000000n||high!==start+1500000000n||high> end)throw unavailable();for(const key of ['start','end','window'])Object.freeze(w[key]);return Object.freeze(w);}

// This only subsets already validated Feedback V1 events. It neither validates
// feedback success nor establishes capture, clock, population, or FPS authority.
export function subsetAuthoredRequestWindowFeedback(validatedEvents,window){const w=projectRequestWindow(window);if(!Array.isArray(validatedEvents)||types.isProxy(validatedEvents)||own(validatedEvents,'length')>4096)throw unavailable();const low=ns(w.window.startNs),high=ns(w.window.endNs),out=[];for(let i=0;i<validatedEvents.length;i++){const e=own(validatedEvents,String(i)),ts=ns(own(e,'terminalTs'));if(ts>=low&&ts<high)out.push(e);}return out;}

function startWindow(name,nonce){
 const runId='native-request-window-v1';
 if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce)||typeof name!=='string'||!new RegExp('^native:'+runId+':history100-up:start:[a-f0-9]{16}$').test(name))throw Error('native-request-window');
 const initial=performance.now();
 if(!Number.isFinite(initial)||initial<0||Object.is(initial,-0))throw Error('native-request-window');
 performance.mark(name);
 const started=performance.now();
 if(!Number.isFinite(started)||started<initial||Object.is(started,-0))throw Error('native-request-window');
 let timer=null,ready=false,disposed=false,ended=false;
 const promise=new Promise((resolve,reject)=>{const guard=()=>{if(disposed)return;try{const now=performance.now(),elapsed=now-started;if(!Number.isFinite(now)||Object.is(now,-0)||!Number.isFinite(elapsed)||elapsed<2000)throw Error('native-request-window');ready=true;timer=null;resolve(true);}catch(error){if(timer!==null)clearTimeout(timer);timer=null;disposed=true;reject(error);}};timer=setTimeout(guard,2000);});
 Object.defineProperties(promise,{
  markEnd:{value:function(endName,endNonce){const now=performance.now();if(this!==promise||disposed||ended||!ready||endNonce!==nonce||typeof endName!=='string'||!new RegExp('^native:'+runId+':history100-up:end:[a-f0-9]{16}$').test(endName)||!Number.isFinite(now)||Object.is(now,-0)||now-started<2000)throw Error('native-request-window');performance.mark(endName);ended=true;return true;}},
  dispose:{value:function(){if(this!==promise)throw Error('native-request-window');if(timer!==null){clearTimeout(timer);timer=null;}disposed=true;return true;}}
 });
 return promise;
}
function endWindow(name,nonce){const end=Object.getOwnPropertyDescriptor(this,'markEnd'),dispose=Object.getOwnPropertyDescriptor(this,'dispose');if(!end||typeof end.value!=='function'||!dispose||typeof dispose.value!=='function')throw Error('native-request-window');const result=end.value.call(this,name,nonce);dispose.value.call(this);return result;}
function disposeWindow(){const d=Object.getOwnPropertyDescriptor(this,'dispose');if(!d||typeof d.value!=='function')throw Error('native-request-window');return d.value.call(this);}
export const REQUEST_WINDOW_GRAMMAR=Object.freeze({...GRAMMAR,startWindow:startWindow.toString(),endWindow:endWindow.toString(),disposeWindow:disposeWindow.toString()});

// RuntimeGate retains the original bounded transcript/geometry projections and
// accounting. Check the decoded original CDP subtype before it drops metadata.
export class RequestWindowRuntimeGate extends RuntimeGate{
 constructor(session){super({async send(method,params){const original=await session.send(method,params);if(method==='Runtime.callFunctionOn'&&params?.functionDeclaration===REQUEST_WINDOW_GRAMMAR.startWindow){const result=own(original,'result');if(own(result,'type')!=='object'||own(result,'subtype')!=='promise'||typeof own(result,'objectId')!=='string'||params.returnByValue!==false||params.awaitPromise===true)throw unavailable();}return original;}});}
}
