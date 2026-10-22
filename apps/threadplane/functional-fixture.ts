// Node-only fixture projection; never a production transport or raw AIMock SSE.
import {AGUIMock} from '@copilotkit/aimock/agui';
import {createServer} from 'node:http';
import {writeGatedFunctionalResponse} from './functional-build.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {isDeepStrictEqual} from 'node:util';
import {createLongThreadFixture,type ReplayEvent} from '@chat-ui-bench/contract';
import {registerCanonicalHistoryRestoreFixture,registerCanonicalLongThreadFixture} from '../../tests/fixtures/aimock.js';

export function registeredFunctionalProjection(){
 const source=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'});
 const mock=new AGUIMock();
 const restore=registerCanonicalHistoryRestoreFixture(mock,source,{threadId:'functional-history100',runId:'functional-restore',epochMs:0});
 const continuation=registerCanonicalLongThreadFixture(mock,source,{threadId:'functional-history100',runId:'functional-continuation',epochMs:0});
 const snapshot=restore.events.find(event=>event.type==='MESSAGES_SNAPSHOT');
 if(snapshot?.type!=='MESSAGES_SNAPSHOT')throw Error('Registered AIMock history snapshot missing');
 const history=snapshot.messages.map(message=>{
  if((message.role!=='user'&&message.role!=='assistant')||typeof message.content!=='string')throw Error('Unexpected registered history');
  return {id:message.id,role:message.role,text:message.content,status:'complete' as const};
 });
 const events:ReplayEvent[]=[];
 for(const event of continuation.events){
  if(event.type==='TEXT_MESSAGE_START')events.push({sequence:events.length,scheduledMs:0,messageId:event.messageId,type:'assistant-start',text:''});
  if(event.type==='TEXT_MESSAGE_CONTENT')events.push({sequence:events.length,scheduledMs:event.timestamp!,messageId:event.messageId,type:'text-delta',text:event.delta});
  if(event.type==='TEXT_MESSAGE_END')events.push({sequence:events.length,scheduledMs:event.timestamp!,messageId:event.messageId,type:'assistant-complete',text:''});
 }
 if(!isDeepStrictEqual(history,source.history)||!isDeepStrictEqual(events,source.events))throw Error('Registered AIMock projection differs from canonical fixture');
 return {label:'Custom ReplayEvent SSE projection of actual registered AIMock canonical fixtures; not raw AIMock SSE',fixture:{...source,history,events},digests:{restore:restore.digests,continuation:continuation.digests},mock};
}

/** Functional-only timing hold BEFORE assistant-start; canonical data stays exact. */
export async function createFunctionalProjectionServer(projection:ReturnType<typeof registeredFunctionalProjection>){
 const gate=Promise.withResolvers<void>();const abort=new AbortController();let released=false;
 const pending=new Set<Promise<void>>(),failures:unknown[]=[];
 const server=createServer((_request,response)=>{
  response.writeHead(200,{'content-type':'text/event-stream','access-control-allow-origin':'*'});response.flushHeaders();
  const task=(async()=>{try{
   const [start,...remaining]=projection.fixture.events;
   await writeGatedFunctionalResponse({gate:gate.promise,signal:abort.signal,
    writeStart:()=>response.write(`data: ${JSON.stringify(start)}\n\n`),
    async writeRemaining(){let previous=0;
     for(const event of remaining){await delay(event.scheduledMs-previous,undefined,{signal:abort.signal});previous=event.scheduledMs;if(response.destroyed)return;response.write(`data: ${JSON.stringify(event)}\n\n`);}
     response.end();
    }
   });
  }catch(error){if(!abort.signal.aborted)failures.push(error);response.destroy();}})();
  pending.add(task);void task.finally(()=>pending.delete(task));
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 const address=server.address();if(!address||typeof address==='string')throw Error('Missing projection server address');
 return {url:`http://127.0.0.1:${address.port}/registered-aimock-projection`,releaseResponse(){if(!released){released=true;gate.resolve();}},async close(){abort.abort();gate.resolve();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await Promise.allSettled([...pending]);if(failures.length)throw new AggregateError(failures,'Functional projection server failed');}};
}
