// Source-only fixture: no browser/SDK/server/native effects. Render topology is input;
// pinned React layout/ref/scheduler and original virtual core execute the write path.
import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {resolve}from'node:path';import{registry,sourceRoot,transform,reverse,boundedRead}from'../copilot-history-functional/instrument.mjs';
const raw=boundedRead(resolve(sourceRoot,registry[24].path),registry[24].bytes).toString();
function declaration(text,name){const a=text.indexOf('function '+name+'('),b=text.indexOf('\nfunction ',a+10);assert.ok(a>=0&&b>a,name);return text.slice(a,b);}
const PREFIX=`
const fixtureConnection=new WeakMap();class Node{get isConnected(){if(!fixtureConnection.has(this))throw Error('fixture brand');return fixtureConnection.get(this);}}
class Element extends Node{get clientWidth(){return 100;}}
class ResizeObserver{static instances=[];constructor(callback){this.callback=callback;this.nodes=new Set();ResizeObserver.instances.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}}
const window={ResizeObserver,requestAnimationFrame:fn=>fn()},document={documentElement:new Element(),fonts:{ready:Promise.resolve(),status:'loaded',addEventListener(){},removeEventListener(){}}};fixtureConnection.set(document.documentElement,true);
const getComputedStyle=()=>({fontFamily:'fixture',fontSize:'16px',display:'block'});
`;
const FIXTURE=`
export async function fixture(react,core,makeLayout,makeSchedule,rowKeyFactory){
 installC(async()=>{});await Promise.resolve();for(const k of ['copilot','react','wrapper'])adapter.moduleBinding(k);
 const root={current:null,next:null,pendingLanes:0,cancelPendingCommit:null,timeoutHandle:-1},first=new react.FiberNode(3,null,null,0);first.stateNode=root;root.current=first;
 const Component=function Target(){},scroll=new Element();fixtureConnection.set(scroll,true);scroll.scrollTop=0;scroll.scrollHeight=1500;scroll.clientHeight=120;adapter.component(Component);
 const messages=expected.map((content,i)=>({id:'history-'+i,role:i%2?'user':'assistant',content})),rows=messages.map(message=>({type:'message',message})),keys=new Map(messages.map(m=>[m.id,m.id])),store={};
 let v=null,currentTarget=null,mounted=new Map(),notifications=0,refCalls=0,roCalls=0,emptyCommits=0,layoutCommits=0,scheduler=null,lastRender=null;
 const makeNode=i=>{const n=new Element();n.row=i;n.size=15;n.getAttribute=k=>{assertFixture(k==='data-index');return String(i);};fixtureConnection.set(n,true);return n;};
 function notify(_instance,sync){assertFixture(sync===false);notifications++;root.pendingLanes=1;scheduler.schedule(root);}
 const commitLayout=makeLayout(adapter,(_bits,f)=>{if(f.type===Component)adapter.mapping(lastRender);});
 function empty(){const host=react.createWorkInProgress(root.current,null);react.bubbleProperties(host);const c=adapter.commitStart(root,host);adapter.commitMutationEnd(c,true);root.current=host;commitLayout(root,host.alternate,host);adapter.commitLayoutEnd(root,host,true);adapter.commitSpawnedEnd(root,host,true);emptyCommits++;}
 function state(){return{owner,cache,scroller,selectedRoot,mapping,committedTarget,baselineOwner,baselineCache,baselineScroller,baselineLayout,baselineWidth,eligible,reason,originalFailed,fontFailed,layout,sealed,current,commits,scopes,fiberFrames,origins,bindings,epochs,expected,counts};}
 function visit(start){
  scheduler=makeSchedule(empty);const host=react.createWorkInProgress(root.current,null),old=currentTarget,target=old?react.createWorkInProgress(old,null):new react.FiberNode(0,{},null,0);target.type=Component;target.memoizedProps={messages};target.memoizedState={};target.updateQueue={};target.flags=4;target.return=host;host.child=target;
  adapter.renderStart(target,Component,root,host);
  if(!v){v=new core.Virtualizer({count:100,estimateSize:()=>10,getScrollElement:()=>null,scrollToFn(){},onChange:notify,measureElement:node=>node.size});v.scrollElement=scroll;v.targetWindow=window;v.scrollOffset=0;v.measurementsCache=Array.from({length:100},(_,i)=>({index:i,key:i,start:i*10,size:10,end:i*10+10,lane:0}));}
  else v.setOptions({...v.options,onChange:notify});
  const r=adapter.rows(rows,messages,keys,store,v,scroll,null,null,null,'benchmark','C-thread-1');lastRender=r;
  const key=rowKeyFactory(keys,adapter);for(const row of rows)key(row);adapter.renderEnd(r,true);
  const next=new Map();let prior=null;target.child=null;for(let i=start;i<Math.min(100,start+8);i++){const existing=mounted.get(i),node=existing||makeNode(i);next.set(i,node);const f=new react.FiberNode(5,null,null,0);f.stateNode=node;f.ref=n=>{refCalls++;v.measureElement(n);};f.flags=existing?0:512;f.return=target;if(prior)prior.sibling=f;else target.child=f;prior=f;}
  for(const[i,node]of mounted)if(!next.has(i))fixtureConnection.set(node,false);
  const c=adapter.commitStart(root,host);v.measureElement(null);adapter.commitMutationEnd(c,true);react.bubbleProperties(target);react.bubbleProperties(host);root.current=host;commitLayout(root,host.alternate,host);adapter.commitLayoutEnd(root,host,true);adapter.commitSpawnedEnd(root,host,true);currentTarget=target;mounted=next;layoutCommits++;
  const observer=ResizeObserver.instances.find(o=>[...mounted.values()].some(n=>o.nodes.has(n)));assertFixture(observer);roCalls++;observer.callback([...mounted.values()].map(target=>({target,borderBoxSize:[{blockSize:target.size}]})));
  scheduler.flush(root);if(reason)throw Error('fixture observer '+reason+'/'+firstSite);return state();
 }
 return{visit,state,empty,connected:node=>Node.prototype.__lookupGetter__('isConnected').call(node),summary:()=>({notifications,refCalls,roCalls,emptyCommits,layoutCommits,counts:{...counts},cacheEntries:cache?.size,origins:origins.filter(Boolean).length}),remountSame(start){for(const node of mounted.values())fixtureConnection.set(node,false);mounted.clear();return visit(start);},scroll};
}
function assertFixture(ok){if(!ok)throw Error('fixture premise');}
`;
let serial=0;
export async function sourceFixture(){
 const source=boundedRead(new URL('../copilot-history-functional/adapter.mjs',import.meta.url),8388608).toString(),url='data:text/javascript;base64,'+Buffer.from(PREFIX+source+FIXTURE+'\n//fixture'+(++serial)).toString('base64');
 const receipt=transform('core');assert.equal(reverse(receipt),boundedRead(resolve(sourceRoot,registry[0].path),registry[0].bytes).toString());
 let code=receipt.code.replace(/import \{adapter as __lh\} from [^;]+;/,'import {adapter as __lh} from '+JSON.stringify(url)+';');for(const name of ['utils.js','lazy-measurements.js'])code=code.replace('"./'+name+'"',JSON.stringify(pathToFileURL(resolve(sourceRoot,'node_modules/@tanstack/virtual-core/dist/esm',name)).href));
 const core=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),m=await import(url);
 const react=Function(['FiberNode','createFiberImplClass','createWorkInProgress','bubbleProperties'].map(n=>declaration(raw,n)).join('\n')+';return {FiberNode,createWorkInProgress,bubbleProperties};')();
 const wrapped=transform('react').code,layout=Function('__lh','commitHookEffectListMount',['recursivelyTraverseLayoutEffects','commitLayoutEffectOnFiber','safelyAttachRef'].map(n=>declaration(wrapped,n)).join('\n')+'\nfunction captureCommitPhaseError(_f,_p,error){throw error;}return commitLayoutEffectOnFiber;');
 const makeSchedule=Function('perform','let firstScheduledRoot=null,lastScheduledRoot=null,mightHavePendingSyncWork=false,didScheduleMicrotask=false,isFlushingWork=false,workInProgressRootRenderLanes=0,workInProgressRoot=null;function scheduleImmediateRootScheduleTask(){}function getNextLanes(r){return r.pendingLanes;}function checkIfRootIsPrerendering(){return false;}function performSyncWorkOnRoot(r){r.pendingLanes=0;perform();}\n'+['ensureRootIsScheduled','flushSyncWorkAcrossRoots_impl'].map(n=>declaration(raw,n)).join('\n')+';return{schedule:ensureRootIsScheduled,flush(){flushSyncWorkAcrossRoots_impl(0,false);}};');
 const copilot=transform('copilot').code,a=copilot.indexOf('const rowKey = (row) =>'),b=copilot.indexOf(';',a)+1;assert.ok(a>=0&&b>a);const rowKeyFactory=Function('rowRenderKeys','__lh',copilot.slice(a,b)+';return rowKey;');
 return m.fixture(react,core,layout,makeSchedule,rowKeyFactory);
}
