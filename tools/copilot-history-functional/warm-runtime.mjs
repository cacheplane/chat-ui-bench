// Internal owned-locals capability. No Node imports or application installation.
// Arrays come only from the private header builder or pinned original extractor.
// This is not the portable Node module's arbitrary-input/Proxy API.
export function createWarmRuntime(){
 const view=new DataView(new ArrayBuffer(8));
 const queue=[];let bytes=0,ranges=0,events=0,refusal=null,closed=false,busy=false;
 const integer=(n,lo,hi)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const real=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
 function double(n){view.setFloat64(0,n,false);return view.getUint32(0,false).toString(16).padStart(8,'0')+view.getUint32(4,false).toString(16).padStart(8,'0');}
 function header(h){return Array.isArray(h)&&h.length===6&&integer(h[0],1,464)&&integer(h[1],0,32768)&&integer(h[2],0,32768)&&integer(h[3],0,1)&&integer(h[4],0,1)&&integer(h[5],1,21);}
 function formatRange(h,outerSize,scrollOffset,start,end,indices){
  if(!header(h)||!real(outerSize,0,1e7)||!real(scrollOffset,0,1e7)||!integer(start,-1,99)||!integer(end,-1,99)||!Array.isArray(indices)||indices.length>100)return null;
  if(start===-1||end===-1){if(start!==-1||end!==-1||indices.length!==0)return null;}else if(start>end||indices.length===0)return null;
  let previous=-1;for(const i of indices){if(!integer(i,0,99)||i<=previous)return null;previous=i;}
  const text=['R|',''+h.join(','),',',double(outerSize),',',double(scrollOffset),',',''+start,',',''+end,'|',''+indices.join(','),'\n'].join('');
  return text.length<=384?text:null;
 }
 function formatEvent(h,t,i,n,v,d,z){
  if(!header(h)||!integer(t,0,21)||!integer(i,-1,99)||!integer(n,0,32768)||!real(v,t===10?-1e7:0,1e7)||!real(d,0,t===8||t===21?1e9:1e7)||!integer(z,0,32768))return null;
  const row=t===8||t===9||t===10||t===12,absent=i===-1&&n===0;
  if(!row&&!absent||row&&!absent&&(i<0||n===0)||(t===9||t===10)&&absent)return null;
  if(t!==8&&t!==9&&t!==10&&t!==18&&!Object.is(v,0)||t!==8&&t!==9&&t!==21&&!Object.is(d,0))return null;
  if(t===0||t===8||t===9||t===11||t===12||t===16){if(z!==0)return null;}
  else if(t===2){if(z>32768)return null;}
  else if(t===15||t===21){if(z>100)return null;}
  else if(z>1)return null;
  if(t===6&&z!==1)return null;
  const text=['E|',''+h.join(','),',',''+String(t).padStart(2,'0'),',',''+i,',',''+n,',',double(v),',',double(d),',',''+z,'\n'].join('');
  return text.length<=96?text:null;
 }
 function fail(code,site='00'){if(!closed)refusal??=code+'|'+site;return false;}
 function append(range,args){
  if(closed||refusal)return false;if(busy)return fail('pair-reentrant','70');
  if(range?ranges===16:events===448)return fail('record-capacity','71');busy=true;
  try{const text=range?formatRange(...args):formatEvent(...args);if(text===null)return fail('invalid-record','72');if(args[0][0]!==queue.length+1)return fail('ordinal','73');if(bytes+text.length>49152)return fail('byte-capacity','74');queue.push(text);bytes+=text.length;if(range)ranges++;else events++;return true;}finally{busy=false;}
 }
 function close(){
  if(closed)return Object.freeze({status:'unavailable',reason:'already-closed',complete:false,records:0,bytes:0,text:'',fullWarmReady:false,nativeGO:false});
  closed=true;const records=queue.length,text=queue.join('');queue.length=0;
  return Object.freeze({status:refusal?'unavailable':'captured-baseline-only',reason:refusal===null?null:refusal.slice(0,-3),complete:refusal===null,records,bytes,text,fullWarmReady:false,nativeGO:false});
 }
 return Object.freeze({formatRange,formatEvent,range:(...args)=>append(true,args),event:(...args)=>append(false,args),ordinal:()=>queue.length+1,active:()=>!closed&&!refusal,healthy:()=>refusal===null,retained:()=>queue.length,diagnostic:()=>refusal===null?'00':refusal.slice(-2),fail,close});
}
let sourceRuntime=null;
// Used only by the opt-in source transform; default imports do not create it.
export function getWarmRuntime(){return sourceRuntime??=createWarmRuntime();}
