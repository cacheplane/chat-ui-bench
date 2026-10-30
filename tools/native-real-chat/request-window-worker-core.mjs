import {REQUEST_WINDOW_RECIPE,REQUEST_WINDOW_CAPTURE_PROTOCOL_V1} from './request-window-core.mjs';
import {types} from 'node:util';
const attempts=new WeakSet(),unavailable=()=>Error('native-request-window-capture-unavailable');
function geometry(value){if(!value||types.isProxy(value)||Reflect.ownKeys(value).length!==7)throw unavailable();const copy={};for(const key of ['top','height','extent','x','y','width','rectHeight']){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!Number.isFinite(d.value))throw unavailable();copy[key]=d.value;}if(copy.height<=0||copy.width<=0||copy.rectHeight<=0||copy.extent<copy.height||copy.top<0||copy.top>copy.extent-copy.height||copy.x<0||copy.y<0||copy.x+copy.width>1280||copy.y+copy.rectHeight>720)throw unavailable();return copy;}
function marked(value,phase){if(!value||value.failureCount!==0||!Array.isArray(value.marks)||value.marks.length!==(phase==='start'?1:2))throw unavailable();for(const [i,row]of value.marks.entries())if(row.phase!==(i?'end':'start')||row.state!=='fulfilled')throw unavailable();}
export async function runRequestWindowChatCapture(ports){
 if(!ports||types.isProxy(ports)||attempts.has(ports)||ports.inputRecipe!==REQUEST_WINDOW_RECIPE)throw unavailable();attempts.add(ports);
 if(Object.hasOwn(ports,'captureProtocol')){const d=Object.getOwnPropertyDescriptor(ports,'captureProtocol');if(!d||!Object.hasOwn(d,'value')||d.value!==REQUEST_WINDOW_CAPTURE_PROTOCOL_V1)throw unavailable();}
 try{
  await ports.load();if(await ports.confirmHistory()!==true)throw unavailable();ports.identity();let before=geometry(await ports.geometry());if(before.top<1600)throw unavailable();
  const started=await ports.owner.start();if(started.status!=='open'||started.failureCount!==0)throw unavailable();
  if(Object.hasOwn(ports,'captureProtocol')){await ports.waitPreroll();ports.identity();if(await ports.confirmHistory()!==true||await ports.confirmPrerollGeometry()!==true)throw unavailable();}
  const startReceipt=await ports.owner.mark('start');marked(startReceipt,'start');ports.verifyMarkReceipt(startReceipt);
  await ports.gesture();await ports.waitWindow();ports.identity();let after=geometry(await ports.geometry());if(after.top>=before.top)throw unavailable();for(const key of ['height','extent','x','y','width','rectHeight'])if(after[key]!==before[key])throw unavailable();if(await ports.confirmHistory()!==true)throw unavailable();const endReceipt=await ports.owner.mark('end');marked(endReceipt,'end');ports.verifyMarkReceipt(endReceipt);
  await ports.releaseHandles();before=null;after=null;const original=ports.owner.finish();if(ports.owner.finish()!==original)throw unavailable();const receipt=await original;if(receipt.status!=='closed')throw unavailable();await ports.releaseApplication();const phase=ports.inspect(ports.owner,receipt);
  const input=ports.inputTrace(),trace=receipt.persisted;if(!trace||!Number.isSafeInteger(trace.bytes)||trace.bytes<1||trace.bytes>33554432||typeof trace.sha256!=='string'||!/^[a-f0-9]{64}$/.test(trace.sha256))throw unavailable();
  return {status:'diagnostic',inputRecipe:REQUEST_WINDOW_RECIPE,...(Object.hasOwn(ports,'captureProtocol')?{captureProtocol:ports.captureProtocol}:{}),captureStatus:receipt.status,phase,input,nativeSupported:false,clock:'not_evaluated',population:'not_evaluated',FPS:null,collection:{trace:{bytes:trace.bytes,sha256:trace.sha256},marks:{...input.marks}}};
 }catch(error){await ports.disposeGuard().catch(()=>{});if(ports.owner.close)await ports.owner.close().catch(()=>{});throw error;}
}
