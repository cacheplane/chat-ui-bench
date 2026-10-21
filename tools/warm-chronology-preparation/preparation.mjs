// Source-only preparation. No application installation, origin writes or readiness.
import {types} from 'node:util';
import {calculateRangeImpl,defaultRangeExtractor} from './kernel.mjs';
const descriptor=Object.getOwnPropertyDescriptor,prototype=Object.getPrototypeOf,isProxy=types.isProxy;
const view=new DataView(new ArrayBuffer(8));
export const CAPS=Object.freeze({ranges:16,events:448,records:464,bytes:49152,rangeBytes:384,eventBytes:96,gaps:6,steps:12,rangeCalls:24});
function ordinary(v,array=false){return v!==null&&typeof v==='object'&&!isProxy(v)&&(array?Array.isArray(v)&&prototype(v)===Array.prototype:[null,Object.prototype].includes(prototype(v)));}
// Native descriptor rows have a data value or undefined; no admitted slot permits undefined.
function data(v,k){return descriptor(v,k)?.value;}
function values(v,keys){if(!ordinary(v))return null;const out=[];for(const k of keys){const x=data(v,k);if(x===undefined)return null;out.push(x);}return out;}
// Both native Number predicates refuse non-number primitives/objects without coercion.
function integer(v,lo,hi){return Number.isSafeInteger(v)&&v>=lo&&v<=hi;}
function real(v,lo,hi){return Number.isFinite(v)&&v>=lo&&v<=hi;}
function double(v){view.setFloat64(0,v,false);return view.getBigUint64(0,false).toString(16).padStart(16,'0');}
function header(a){return a.slice(0,5).every(x=>integer(x,0,32768))&&integer(a[0],1,32768)&&integer(a[5],0,20);}
function arrayLength(a,max){if(!ordinary(a,true))return -1;const n=data(a,'length');return integer(n,0,max)?n:-1;}
const R=['q','c','r','og','cg','l','scrollTop','clientHeight','scrollHeight','clientWidth','start','end','indices','keys'];
export function formatRange(input){
 const a=values(input,R);if(!a||!header(a)||!real(a[6],0,1e7)||!a.slice(7,10).every(x=>integer(x,0,1e7))||!integer(a[10],-1,99)||!integer(a[11],-1,99))return null;
 const n=arrayLength(a[12],100);if(n<0||arrayLength(a[13],100)!==n||(!n?(a[10]!==-1||a[11]!==-1):(a[10]<0||a[11]<a[10])))return null;
 const parts=[];let previous=-1;
 for(let j=0;j<n;j++){const i=data(a[12],String(j)),key=data(a[13],String(j));if(!integer(i,0,99)||i<=previous||typeof key!=='string'||key!=='history-'+i)return null;previous=i;parts.push(String(i));}
 const text='R|'+[...a.slice(0,6),double(a[6]),...a.slice(7,12)].join(',')+'|'+parts.join(',')+'\n';return text.length<=CAPS.rangeBytes?text:null;
}
const E=['q','c','r','og','cg','l','t','i','n','v','d','z'];
export function formatEvent(input){
 const a=values(input,E);if(!a||!header(a))return null;const [,,,,,,t,i,n,v,d,z]=a;
 if(!integer(t,0,20)||!integer(i,-1,99)||!integer(n,0,32768)||!real(v,-1e7,1e7)||!real(d,0,t===8?1e9:1e7)||!integer(z,0,32768))return null;
 const row=[6,7,8,9,10,12].includes(t),bool=[1,3,4,5,6,7,10,13,14,17,18,19,20].includes(t);
 if(!row&&(i!==-1||n!==0)||row&&t!==6&&t!==7&&(i<0||n===0)||t===6&&(z===0?(i!==-1||n!==0):(i<0||n===0))||bool&&z>1)return null;
 if(t!==8&&t!==9&&t!==10&&t!==18&&!Object.is(v,0)||t!==8&&t!==9&&!Object.is(d,0)||t!==10&&v<0)return null;
 if([9,12,16].includes(t)&&z!==0||[0,8,15].includes(t)&&z>100||t===11&&z>3200)return null;
 const text='E|'+[...a.slice(0,6),String(t).padStart(2,'0'),i,n,double(v),double(d),z].join(',')+'\n';return text.length<=CAPS.eventBytes?text:null;
}
export function createCapture(){
 let queue=[],bytes=0,ranges=0,events=0,refusal=null,closed=false;
 function fail(reason){refusal??=reason;return false;}
 function append(input,range){
  if(refusal||closed)return false;
  if(range?ranges===CAPS.ranges:events===CAPS.events)return fail('record-capacity');
  const text=range?formatRange(input):formatEvent(input);if(text===null)return fail('invalid-record');
  if(data(input,'q')!==queue.length+1)return fail('ordinal');
  if(bytes+text.length>CAPS.bytes)return fail('byte-capacity');
  queue.push(text);bytes+=text.length;if(range)ranges++;else events++;return true;
 }
 return Object.freeze({range:input=>append(input,true),event:input=>append(input,false),stats:()=>Object.freeze({ranges,events,bytes,retained:queue.length,closed,refusal}),close(){
  if(closed)return Object.freeze({status:'unavailable',reason:'already-closed'});closed=true;
  const records=queue.length,text=queue.join('');queue.length=0;
  if(refusal)return Object.freeze({status:'unavailable',reason:refusal,text,records,bytes,complete:false,fullWarmReady:false,nativeGO:false});
  return Object.freeze({status:'captured-baseline-only',text,records,bytes,complete:true,fullWarmReady:false,nativeGO:false});
 }});
}
function unavailable(reason,rangeCalls=0){return Object.freeze({status:'unavailable',reason,rangeCalls,fullWarmReady:false,nativeGO:false});}
// Inputs are an owned synthetic geometry/provenance model, never application state.
export function prepareGap(input){
 const a=values(input,['flat','mask','keys','viewport','overscan']);if(!a||arrayLength(a[0],200)!==200||arrayLength(a[1],100)!==100||arrayLength(a[2],100)!==100||!integer(a[3],1,1e7)||!integer(a[4],0,10))return unavailable('invalid-input');
 const [flat,original,keys,viewport,overscan]=a;const state=[];let end=0;
 for(let i=0;i<100;i++){const start=data(flat,String(i*2)),size=data(flat,String(i*2+1)),m=data(original,String(i));if(!real(start,0,1e7)||start!==end||!real(size,1,1e7)||!integer(m,0,15)||m&2&&!(m&1)||m&8&&(m&6)!==6||data(keys,String(i))!=='history-'+i)return unavailable('invalid-input');end=start+size;if(end>1e7)return unavailable('invalid-input');state.push(m);}
 let calls=0;
 function range(target){if(++calls>CAPS.rangeCalls)return null;const offset=Math.min(data(flat,String(target*2)),Math.max(0,end-viewport));const r=calculateRangeImpl({length:100},viewport,offset,1,flat);return defaultRangeExtractor({...r,count:100,lanes:1,overscan});}
 let best=null,gaps=0;
 for(let i=0;i<100;){if(state[i]&3){i++;continue;}const start=i;while(i<100&&!(state[i]&3))i++;const last=i-1;if(last-start+1<16)continue;if(++gaps>CAPS.gaps)return unavailable('gap-capacity',calls);
  const mid=Math.floor((start+last)/2),final=range(mid);if(!final)return unavailable('range-capacity',calls);const bottom=final.at(-1)+1+overscan;const below=bottom<100?range(bottom):null;
  if(!below||final[0]<start||final.at(-1)>last||below[0]!==final.at(-1)+1)continue;
  if(!best||last-start>best.last-best.start)best={start,last,mid,bottom};
 }
 if(!best)return unavailable(gaps?'unsafe-join':'no-gap',calls);
 const targets=[];for(let x=99;x>best.bottom;x-=10)targets.push(x);targets.push(best.bottom);for(let x=0;x<best.mid;x+=10)targets.push(x);targets.push(best.mid);if(targets.length>CAPS.steps)return unavailable('step-capacity',calls);
 let previous=null,final=null;
 for(const target of targets){const next=range(target);if(!next)return unavailable('range-capacity',calls);const low=next[0],high=next.at(-1);
  for(let i=0;i<100;i++){
   const retained=previous===null?Boolean(state[i]&4):i>=previous[0]&&i<=previous.at(-1),present=i>=low&&i<=high;
   if(!present){state[i]&=~(4|8|32);continue;}
   if(!retained){if(state[i]&3||state[i]&16)state[i]&=~(8|32);else state[i]|=32;}
   state[i]|=4|16;
  }
  previous=next;final=next;
 }
 if(state.some(x=>!(x&2)&&((x&1)||!(x&16))))return unavailable('coverage-gap',calls);
 if(final.some(i=>!(state[i]&8)&&!(state[i]&32)))return unavailable('final-cached-remount',calls);
 return Object.freeze({status:'prepared-structural-only',gap:Object.freeze([best.start,best.last]),partition:best.mid,targets:Object.freeze(targets),final:Object.freeze(final),rangeCalls:calls,fullWarmReady:false,nativeGO:false,qualification:'Synthetic prospective coverage only; every potential first measure still requires original nonzero write and exact final private/native fences.'});
}
