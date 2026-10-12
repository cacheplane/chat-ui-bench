import {expect,vi} from 'vitest';
import {createComparisonBuffer,COMPARISON_CAPTURE_LIMITS} from '@chat-ui-bench/contract';
import * as implementation from './comparison-observations.js';
import {runInNewContext} from 'node:vm';

export const identity={repetition:'run-🌍',round:1,artifactDirectory:'runs/one',scenarioId:'scenario',caseIndex:0,adapterProfile:'threadplane',seed:1,mode:'headless' as const};
export const preOptions={optionsVersion:1 as const,identity,limits:COMPARISON_CAPTURE_LIMITS,stateGlobal:'comparisonPreNavigation' as const};
export const mainOptions={optionsVersion:1 as const,identity,limits:COMPARISON_CAPTURE_LIMITS,probeIntervalMs:50 as const,bridgeGlobal:'benchHost' as const,stateGlobal:'comparisonCapture' as const,preNavigationGlobal:'comparisonPreNavigation' as const,observers:{eventTiming:{buffered:true as const,durationThresholdMs:16 as const},loaf:{buffered:true as const}},nativeRecipeIds:{wheel:'comparison-wheel-up-v1' as const,composer:'comparison-composer-calibrate-v1' as const}};
export function page() {
  let time=1, timerId=0,rafId=0,ordinal=0;
  const timers=new Map<number,()=>void>(),frames=new Map<number,(t:number)=>void>(),listeners=new Map<string,Set<(e:any)=>void>>();
  const rect=(l=0,t=0,r=100,b=100)=>({left:l,top:t,right:r,bottom:b});
  const scroller={isConnected:true,scrollTop:0,scrollHeight:200,clientWidth:100,clientHeight:100,clientLeft:0,clientTop:0,getBoundingClientRect:()=>rect(),parentElement:null};
  const composer={isConnected:true,value:'calibrate',contains:(target:any)=>target===composer};
  const returning={contains:(target:any)=>target===returning};
  let text='';
  const node={nodeType:3,get length(){return text.length;},get data(){return text;},isConnected:true,parentElement:null};
  const content={isConnected:true,contains:(n:any)=>n===node,parentElement:scroller,nodes:[node]};node.parentElement=content as any;
  const host={isConnected:true,contains:(n:any)=>n===content||n===node,parentElement:scroller,getBoundingClientRect:()=>rect()};
  const candidate={id:'response',role:'assistant' as const,hostElement:host,contentElement:content};
  const transport=createComparisonBuffer('transport');
  let open:any=null;
  const bridge:any={locators:{scroller:'scroll',composer:'composer',returnToResponse:'return'},readCaptureCandidates:()=>({status:'available',value:{historical:[],active:candidate}}),readActiveHost:()=>({activeMessageId:'response',hostMounted:host.isConnected}),readCaptureMountedMessageCount:()=>({status:'available',value:1}),readCaptureProgress:()=>({status:'available',value:{activeMessage:{id:'response',role:'assistant',text,status:'streaming'},delivery:'streaming',outcome:null,loading:true,error:null}}),drainCaptureEvents:()=>[],readCaptureBufferState:()=>{const {pendingEntries,pendingSerializedBytes,...v}=transport.state();return v;},markPhase:(phase:string,boundary:string)=>{if(boundary==='start'){if(open)throw Error('open');open={phase,instanceId:String(++ordinal)};}else if(!open||open.phase!==phase)throw Error('phase');const v={...open,boundary,timestampMs:time};if(boundary==='end')open=null;return v;},readProgress:()=>{throw Error('legacy');},readActiveDom:()=>{throw Error('legacy');},readVisibleMessages:()=>{throw Error('legacy');}};
  const nativeConsole={warn:vi.fn(),error:vi.fn()};
  const context:any={console:nativeConsole,innerWidth:100,innerHeight:100,performance:{now:()=>time},setTimeout:(fn:()=>void,ms:number)=>{expect(ms).toBe(50);timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id),requestAnimationFrame:(fn:(t:number)=>void)=>{frames.set(++rafId,fn);return rafId;},cancelAnimationFrame:(id:number)=>frames.delete(id),addEventListener:(type:string,fn:any,options:any)=>{if(['wheel','keydown','keyup','input','beforeinput','click'].includes(type))expect(options.passive).toBe(true);const set=listeners.get(type)??new Set();set.add(fn);listeners.set(type,set);},removeEventListener:(type:string,fn:any)=>listeners.get(type)?.delete(fn),getComputedStyle:()=>({transform:'none',clipPath:'none',overflowClipMargin:'0px',overflowX:'visible',overflowY:'visible',display:'block',visibility:'visible'}),NodeFilter:{SHOW_TEXT:4,SHOW_ALL:4294967295},document:{querySelector:(selector:string)=>selector==='scroll'?scroller:selector==='composer'?composer:selector==='return'?returning:null,createTreeWalker:(root:any)=>{let i=0;return {nextNode:()=>root.nodes[i++]??null};},createRange:()=>({setStart:vi.fn(),setEnd:vi.fn(),getBoundingClientRect:()=>rect(),getClientRects:()=>[rect(0,0,10,10)],detach:()=>{}})},benchHost:bridge};
  context.window=context;
  context.MutationObserver=class{observe(){}takeRecords(){return [];}disconnect(){}};
  const consoleOriginals={...nativeConsole};
  return {context,bridge,candidate,node,content,host,scroller,composer,nativeConsole:consoleOriginals,timers,frames,listeners,setText:(v:string)=>{text=v;},setTime:(v:number)=>{time=v;},tick:(v:number)=>{time=v;const [id,fn]=timers.entries().next().value??[];timers.delete(id);fn?.();},frame:(v:number)=>{time=v;const [id,fn]=frames.entries().next().value??[];frames.delete(id);fn?.(v);},emit:(type:string,e:any)=>{for(const fn of listeners.get(type)??[])fn({...e,type});}};
}
export function install(p:ReturnType<typeof page>,pre=true,options=mainOptions) {
  if(pre) runInNewContext(`(${implementation.installComparisonPreNavigation.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options:preOptions,window:p.context});
  runInNewContext(`(${implementation.installComparisonObservations.toString()})(${createComparisonBuffer.toString()}, options)`,{...p.context,options,window:p.context});
  return p.context.comparisonCapture as ReturnType<typeof implementation.installComparisonObservations>;
}

// Independent synthetic layout answers: an envelope never supplies glyph answers.
export function controlledRangeGeometry(p:ReturnType<typeof page>,answers:{
  envelope:(node:any,start:number,end:number)=>{left:number;top:number;right:number;bottom:number};
  glyphs:(node:any,start:number,end:number)=>{left:number;top:number;right:number;bottom:number}[];
}) {
  const calls:{kind:'envelope'|'glyphs';node:any;start:number;end:number}[]=[],detached:any[]=[];
  p.context.document.createRange=()=>{
    let node:any,start=-1,end=-1;
    return {
      setStart:(value:any,offset:number)=>{node=value;start=offset;},
      setEnd:(value:any,offset:number)=>{expect(value).toBe(node);end=offset;},
      getBoundingClientRect:()=>{calls.push({kind:'envelope',node,start,end});return answers.envelope(node,start,end);},
      getClientRects:()=>{calls.push({kind:'glyphs',node,start,end});return answers.glyphs(node,start,end);},
      detach:()=>{detached.push(node);},
    };
  };
  return {calls,detached};
}
