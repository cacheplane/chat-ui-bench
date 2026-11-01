import {afterEach,expect,test,vi} from 'vitest';
import {ThreadplaneHost} from './host.js';
import {ReplayTransport} from './replay-transport.js';
import {createMatrixCase} from '../../../tools/competitor-comparison/matrix-fixtures-v3.mjs';

afterEach(()=>vi.unstubAllGlobals());
async function setup(){
 const value=createMatrixCase({profile:'threadplane',historyCount:1000,responseBytes:262144,journey:'follow'});
 const native=value.fixture.history.map((message:any)=>({id:message.id,role:message.role,content:message.text,delivery:{phase:'complete',outcome:'success'}}));
 const hosts=native.map((message:any)=>({dataset:{} as Record<string,string>,getAttribute:(key:string)=>key==='data-role'?message.role:null}));
 const list={querySelectorAll:()=>hosts},scroller={};
 vi.stubGlobal('document',{querySelector:(selector:string)=>selector==='chat chat-message-list'?list:scroller});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queueMicrotask(()=>callback(performance.now()));return 1;});
 const intersection=vi.fn(()=>{throw Error('Legacy all-row observer must not run in matrix mode');});vi.stubGlobal('IntersectionObserver',intersection);
 vi.stubGlobal('MutationObserver',class{observe(){}disconnect(){}});
 let resolve!:()=>void,reject!:(error:Error)=>void;
 const original=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});void original.catch(()=>{});
 const state={messages:native as any[],loading:false,error:null as unknown};
 const agent={messages:()=>state.messages,isLoading:()=>state.loading,isThreadLoading:()=>false,error:()=>state.error,stop:vi.fn(async()=>{}),switchThread:vi.fn(),submit:vi.fn(()=>original)};
 const destroy=vi.fn(),host=new ThreadplaneHost(agent as any,new ReplayTransport(),destroy);
 vi.stubGlobal('window',{benchHost:host});
 expect(typeof (host as any).loadMatrixHistory).toBe('function');
 await (host as any).loadMatrixHistory(value.fixture.history);
 return{value,native,host:host as any,agent,state,original,resolve,reject,destroy,intersection};
}
test('matrix history retains actual identities without legacy all-row intersection observation',async()=>{
 const{host,native,intersection}=await setup();
 expect(intersection).not.toHaveBeenCalled();
 expect(host.readMatrixProgress()).toEqual({schema:1,messageCount:1000,responseId:null,responseCharacters:null,running:false,error:null,operation:{kind:'original-run-promise',status:'idle'}});
 expect(host.readMatrixResponse()).toBeNull();expect(native).toHaveLength(1000);
 await host.disposeMatrix();
});
test('matrix progress reads actual count/tail without traversing historical messages or copying response',async()=>{
 const{host,state,native,value,resolve,original}=await setup();
 const response={id:'actual-native-response',role:'assistant',content:'actual prefix',delivery:{phase:'streaming',outcome:null}};
 const rows=[...native,response];state.messages=new Proxy(rows,{get(target,key,receiver){if(['map','find','filter','forEach','some',Symbol.iterator].includes(key as any)||typeof key==='string'&&/^\d+$/.test(key)&&Number(key)!==target.length-1)throw Error('historical traversal');return Reflect.get(target,key,receiver);}});
 state.loading=true;expect(host.connectMatrixReplay('https://fixture.test/stream')).toBe(original);
 expect(host.readMatrixProgress()).toMatchObject({messageCount:1001,responseId:response.id,responseCharacters:13,running:true,operation:{status:'pending'}});
 expect(host.readMatrixResponse()).toEqual({id:response.id,role:'assistant',text:response.content});
 response.content=value.fixture.events.filter((event:any)=>event.type==='text-delta').map((event:any)=>event.text).join('');
 response.delivery={phase:'complete',outcome:'success'} as any;state.loading=false;resolve();await original;
 expect(host.readMatrixProgress()).toMatchObject({responseCharacters:262144,running:false,error:null,operation:{status:'fulfilled'}});
 expect(()=>host.connectMatrixReplay('https://fixture.test/again')).toThrow();await host.disposeMatrix();
});
test('matrix replay retains the original rejection and disposal still attempts every owned stage',async()=>{
 const{host,original,reject,agent,destroy}=await setup(),failure=Error('original SDK rejection');
 expect(host.connectMatrixReplay('https://fixture.test/stream')).toBe(original);reject(failure);await expect(original).rejects.toBe(failure);
 expect(host.readMatrixProgress()).toMatchObject({operation:{status:'rejected'}});expect(host.readMatrixProgress().error).not.toBeNull();
 const closing=host.disposeMatrix();expect(host.disposeMatrix()).toBe(closing);
 const caught=await closing.catch((error:AggregateError)=>error);expect(caught).toBeInstanceOf(AggregateError);expect(caught.errors).toContain(failure);
 expect(agent.stop).toHaveBeenCalledTimes(2);expect(destroy).toHaveBeenCalledOnce();expect((window as any).benchHost).toBeUndefined();
 expect(()=>host.readMatrixProgress()).toThrow('disposed');
});
