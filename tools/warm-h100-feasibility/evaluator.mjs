// Source-only private-state study. This module grants no browser or metric authority.
import {types} from 'node:util';
const descriptor=Object.getOwnPropertyDescriptor,mapGet=Function.call.bind(Map.prototype.get),mapSize=Function.call.bind(descriptor(Map.prototype,'size').get),isProxy=types.isProxy;

function prose(i){const text=`The reader considers the calm conversation number ${i} from collection 1. Clear words describe a familiar place and a thoughtful reply. `;return text.repeat(Math.ceil(512/text.length)).slice(0,511).replace(/ $/,'a')+'.';}
function data(object,key){if(!object||isProxy(object))throw refusal;const d=descriptor(object,key);if(!d||!('value'in d))throw refusal;return d.value;}
function array(object,max){return Array.isArray(object)&&!isProxy(object)&&object.length<=max;}
const refusal=Symbol('warm-source-refusal');
const integer=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;
const result=(reason,historicalComplete=false,liveSubsetValid=false,connectedRows=0)=>({historicalComplete,liveSubsetValid,fullWarmReady:false,connectedRows,reason,nativeGO:false,qualified:false,fps:null});
export function createWarmCensus(){
 let first=null,calls=0,busy=false,failed=false;
 return{fence(s,{connected}){
  if(busy){failed=true;return result('reentrant');}if(failed||calls>=2)return result('closed');busy=true;calls++;
  try{
   if(typeof connected!=='function')throw refusal;
   const owner=data(s,'owner'),cache=data(s,'cache'),scroller=data(s,'scroller'),mapping=data(s,'mapping'),layout=data(s,'layout'),sealed=data(s,'sealed');
   const origins=data(s,'origins'),bindings=data(s,'bindings'),epochs=data(s,'epochs'),commits=data(s,'commits'),scopes=data(s,'scopes'),frames=data(s,'fiberFrames');
   if(data(s,'reason')!==null||data(s,'originalFailed')||data(s,'fontFailed')||!data(s,'eligible')||data(s,'current')!==null||!array(commits,32)||commits.length||!array(scopes,12832)||scopes.length||!array(frames,7728)||frames.length||!owner||!cache||!scroller||!mapping||!data(s,'committedTarget')||!data(s,'selectedRoot')||!integer(layout,21)||!integer(sealed,32768)||data(s,'baselineOwner')!==owner||data(s,'baselineCache')!==cache||data(s,'baselineScroller')!==scroller||data(s,'baselineLayout')!==layout)throw refusal;
   if(!array(origins,101)||origins.length!==101||!array(bindings,101)||bindings.length!==101||!array(epochs,3200)||isProxy(cache)||mapSize(cache)>100)throw refusal;
   const rows=data(mapping,'rows'),messages=data(mapping,'messages'),keys=data(mapping,'keys');
   if(!array(rows,101)||rows.length!==100||!array(messages,101)||messages.length!==100||isProxy(keys)||mapSize(keys)!==100||data(mapping,'owner')!==owner||data(mapping,'scroller')!==scroller||data(mapping,'layout')!==layout)throw refusal;
   const expected=data(s,'expected');if(!array(expected,100)||expected.length!==100)throw refusal;const wanted=new Map();let tuples='[';let historical=mapSize(cache)===100,live=true,connectedRows=0;
   for(let i=0;i<100;i++){
    const row=data(rows,String(i)),message=data(messages,String(i)),key=`history-${i}`;
    if(data(row,'type')!=='message'||data(row,'message')!==message||data(message,'id')!==key||data(message,'role')!==(i%2?'user':'assistant')||data(message,'content')!==data(expected,String(i))||data(expected,String(i))!==prose(i)||mapGet(keys,key)!==key)throw refusal;
    const o=data(origins,String(i)),b=data(bindings,String(i)),value=mapGet(cache,i);
    if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e7))throw refusal;let tuple=null;
    if(!o)historical=false;
    else{
     tuple=['row','node','size','layout','eligible','commit','measure','edge','resize','seq'].map(k=>data(o,k));
     if(tuple.some(v=>typeof v!=='number'&&typeof v!=='boolean'))throw refusal;const [rowIndex,node,size,ol,eligible,commit,measure,edge,resize,seq]=tuple;
     if(rowIndex!==i||!integer(node,32768)||!Number.isFinite(size)||size<=0||size>1e7||ol!==layout||!integer(commit,32768)||commit>sealed||!integer(measure,32768)||!integer(edge,32768)||!integer(resize,32768)||!integer(seq,6400)||value!==size||wanted.has(node))throw refusal;if(eligible!==true)historical=false;
     wanted.set(node,{row:i,originCommit:commit,found:false});
    }
    tuples+=(i?',':'')+JSON.stringify([value,tuple]);
    if(b&&connected(data(b,'node'))===true){
     connectedRows++;
     // Unchanged partial.valid, with native Map access and own-data reads only.
     const valid=!!b&&!!o&&data(o,'node')===data(b,'id')&&data(b,'commit')!==null&&data(o,'commit')!==null&&data(b,'commit')<=data(o,'commit')&&data(o,'commit')<=sealed&&data(b,'layout')===layout&&data(o,'eligible')===true&&data(o,'layout')===layout&&mapGet(cache,i)===data(o,'size');
     if(!data(b,'measured')||!data(b,'connected')||!valid)live=false;
    }
   }
   for(let i=0;i<epochs.length;i++){
    const e=data(epochs,String(i)),w=wanted.get(data(e,'id'));if(!w)continue;
    if(w.found||data(e,'row')!==w.row||data(e,'layout')!==layout||!data(e,'measured')||!integer(data(e,'commit'),32768)||data(e,'commit')>w.originCommit)historical=false;w.found=true;
   }
   for(const w of wanted.values())if(!w.found)historical=false;
   if(data(origins,'100')!==null)historical=false;const extra=data(bindings,'100');if(extra&&connected(data(extra,'node'))===true){connectedRows++;live=false;}live=live&&connectedRows>0;tuples+=']';if(tuples.length>16384)throw refusal;
   const identities=[owner,cache,scroller,data(s,'selectedRoot'),rows,messages,keys,data(mapping,'store')],tuple=layout+':'+tuples;
   const current={identities,tuple},same=first&&first.tuple===tuple&&first.identities.every((v,i)=>v===identities[i]);
   const ready=historical&&live&&!failed;
   const out=result(!historical?'historical-gap':!live?'live-binding-gap':calls===1?'first-fence':!same?'fence-drift':null,historical,live,connectedRows);
   out.fullWarmReady=!!(calls===2&&first?.ready&&ready&&same);if(calls===1)first={...current,ready};
   return out;
  }catch(error){failed=true;if(error!==refusal)throw error;return result('source-shape');}finally{busy=false;}
 }};
}
