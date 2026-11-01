import test from 'node:test';
import assert from 'node:assert/strict';
import {createFunctionalCase} from '../../../tools/competitor-comparison/fixtures.mjs';
process.env.COPILOTKIT_TELEMETRY_DISABLED='true';process.env.DO_NOT_TRACK='1';
let id=0;
function fixture(){
 const value=structuredClone(createFunctionalCase('copilotkit','follow')),suffix=String(++id);
 value.publicContext.threadId+='-test'+suffix;value.publicContext.runId+='-test'+suffix;value.seedRunId+='-test'+suffix;
 for(const events of [value.historyRestore,value.continuation])for(const event of events){if('threadId'in event)event.threadId=value.publicContext.threadId;if('runId'in event)event.runId=events===value.historyRestore?value.seedRunId:value.publicContext.runId;}
 return value;
}
const request=(route,body,signal)=>new Request('http://127.0.0.1'+route,{method:body?'POST':'GET',...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal});
function input(context,runId,messages=[]){return{threadId:context.publicContext.threadId,runId,messages,state:{},tools:[],context:[],forwardedProps:{}};}
test('real public runtime restores authored history and runs one admitted continuation',async()=>{
 const {createRoutes}=await import('../server.mjs'),context=fixture(),calls=[];
 const routes=await createRoutes({context,playback:async function*(kind,signal){calls.push(kind);for(const event of kind==='seed'?context.historyRestore:context.continuation){assert.equal(signal.aborted,false);yield event;}}});
 try{
  assert.equal(await routes.handle(request('/foreign')),null);
  const info=await routes.handle(request('/copilot/info'));assert.equal(info.status,200);
  const restore=await routes.handle(request('/copilot/agent/default/connect',input(context,'cold-read')));assert.equal(restore.status,200);const restored=await restore.text();assert.ok(restored.includes(context.publicContext.history[0].text));
  const messages=context.publicContext.history.map(({id,role,text})=>({id,role,content:text}));
  const run=await routes.handle(request('/copilot/agent/default/run',input(context,context.publicContext.runId,messages)));assert.equal(run.status,200);assert.ok((await run.text()).includes('RUN_FINISHED'));assert.deepEqual(calls,['seed','continuation']);
  assert.equal((await routes.handle(request('/copilot/agent/default/run',input(context,context.publicContext.runId,messages)))).status,409);
 }finally{await routes.dispose();await routes.dispose();}
 assert.equal((await routes.handle(request('/copilot/info'))).status,410);
});
test('wrong thread/run/history/route cannot start playback',async()=>{
 const {createRoutes}=await import('../server.mjs'),context=fixture(),calls=[];
 const routes=await createRoutes({context,playback:async function*(kind){calls.push(kind);yield* context.historyRestore;}});
 try{
  for(const body of [input(context,'wrong'),{...input(context,context.publicContext.runId),threadId:'other'},input(context,context.publicContext.runId,[])])assert.equal((await routes.handle(request('/copilot/agent/default/run',body))).status,400);
  assert.equal((await routes.handle(request('/copilot/threads/clear',{}))).status,404);assert.deepEqual(calls,['seed']);
 }finally{await routes.dispose();}
});
test('disposal awaits the original aborted playback cleanup and public SDK operation',async()=>{
 const {createRoutes}=await import('../server.mjs'),context=fixture();let release,started,aborted=false,disposed=false;
 const cleanup=new Promise(resolve=>{release=resolve;}),running=new Promise(resolve=>{started=resolve;});
 const routes=await createRoutes({context,playback:async function*(kind,signal){
  if(kind==='seed'){yield*context.historyRestore;return;}
  yield context.continuation[0];started();
  await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));aborted=true;await cleanup;throw Error('authored cancelled continuation');
 }});
 const messages=context.publicContext.history.map(({id,role,text})=>({id,role,content:text}));
 const response=await routes.handle(request('/copilot/agent/default/run',input(context,context.publicContext.runId,messages)));
 await running;const disposal=routes.dispose().then(()=>{disposed=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(aborted,true);assert.equal(disposed,false);release();await disposal;await response.body.cancel();assert.equal(disposed,true);
});

test('native1.83 stop owns thread in path and exact runId-only body',async()=>{
 const {createRoutes}=await import('../server.mjs'),context=fixture();const routes=await createRoutes({context,playback:async function*(kind){if(kind!=='seed')throw Error('unexpected playback');yield*context.historyRestore;}});
 try{const route='/copilot/agent/default/stop/'+context.publicContext.threadId;
 assert.equal((await routes.handle(request(route,{runId:context.publicContext.runId}))).status,200);
 for(const body of [{runId:'foreign'},{runId:context.publicContext.runId,threadId:context.publicContext.threadId},{runId:context.publicContext.runId,extra:true},{}])assert.equal((await routes.handle(request(route,body))).status,400);
 assert.equal((await routes.handle(request('/copilot/agent/default/stop/foreign',{runId:context.publicContext.runId}))).status,404);
 }finally{await routes.dispose();}
});

test('actual H10000 cold connect crosses native SSE parser then preserves full original continuation', {timeout:30000},async()=>{
 const {createMatrixCase}=await import('../../../tools/competitor-comparison/matrix-fixtures-v3.mjs');
 const {startFunctionalServer}=await import('../../../tools/competitor-comparison/server.mjs');
 const {HttpAgent}=await import('@ag-ui/client');const fs=await import('node:fs/promises');
 const dir=await fs.realpath(await fs.mkdtemp('/private/tmp/copilot-cold-matrix-'));
 const context=createMatrixCase({profile:'copilotkit',historyCount:10000,responseBytes:262144,journey:'follow'});
 let server,agent;
 try{
  server=await startFunctionalServer({profile:'copilotkit',assetsDirectory:dir,privateCase:context,protocol:'matrix-v3'});
  agent=new HttpAgent({url:server.origin+'/copilot/agent/default/connect',threadId:context.publicContext.threadId,fetch:async(url,options)=>{const response=await fetch(url,options);assert.equal(response.headers.get('cache-control'),'private,no-cache,max-age=0,must-revalidate');return response;}});
  await agent.runAgent({runId:'actual-cold-connect'});
  assert.equal(agent.messages.length,10000);assert.deepEqual(agent.messages.map(({id,role,content})=>({id,role,text:content})),context.publicContext.history);
  const wrong=agent.messages.map(message=>({...message}));wrong.at(-1).content='wrong history';
  const refused=await fetch(server.origin+'/copilot/agent/default/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({threadId:context.publicContext.threadId,runId:context.publicContext.runId,messages:wrong,state:{},tools:[],context:[],forwardedProps:{}})});assert.equal(refused.status,400);await refused.text();assert.equal(server.getReport().sourceEmissions.length,3);
  agent.url=server.origin+'/copilot/agent/default/run';await agent.runAgent({runId:context.publicContext.runId});
  assert.equal(agent.isRunning,false);assert.equal(agent.messages.length,10001);
  assert.deepEqual(agent.messages.slice(0,10000).map(({id,role,content})=>({id,role,text:content})),context.publicContext.history);
  const expected=context.continuation.filter(e=>e.type==='TEXT_MESSAGE_CONTENT').map(e=>e.delta).join('');assert.equal(agent.messages.at(-1).content,expected);assert.equal(agent.messages.at(-1).content.length,262144);
  await server.close();const report=server.getReport();assert.equal(report.closed,true);assert.equal(report.sourceEmissions.length,207);assert.equal(report.playbacks.seed.completed,true);assert.equal(report.playbacks.continuation.completed,true);
 }finally{await agent?.detachActiveRun();await server?.close();await fs.rm(dir,{recursive:true,force:true});}
});
