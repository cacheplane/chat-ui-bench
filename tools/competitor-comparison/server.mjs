import http from 'node:http';
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {parsePublicContext} from '../../competitors/shared/context.mjs';
import {scheduledPlayback,uiSse} from './wire.mjs';

const BODY_CAP=1048576,STATIC_CAP=16777216,REQUEST_CAP=512;
const fail=(status,code)=>Object.assign(new Error(code),{status});
const signature=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeMs,s.ctimeMs].join(':');
const encode=value=>'data: '+JSON.stringify(value)+'\n\n';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.ico':'image/x-icon'};

async function write(response,chunk,signal,row){
  signal.throwIfAborted();row.responseBytes+=Buffer.byteLength(chunk);
  if(!response.write(chunk))await once(response,'drain',{signal});
}
/** Exported for authored ownership controls; production uses this same path. */
export async function pipeOwnedWebResponse(response,value,signal,row){
  const headers={};for(const[key,item]of value.headers)if(!['connection','transfer-encoding','content-length'].includes(key))headers[key]=item;
  response.writeHead(value.status,headers);row.status=value.status;
  if(!value.body){signal.throwIfAborted();row.sourceEof=true;response.end();return;}
  const reader=value.body.getReader();let eof=false,cancelOriginal=null;
  const cancel=()=>{
    if(cancelOriginal===null){cancelOriginal=reader.cancel(signal.reason);void cancelOriginal.then(()=>{},()=>{});}
    return cancelOriginal;
  };
  signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)cancel();
  try{
    for(;;){signal.throwIfAborted();const item=await reader.read();if(item.done){eof=true;break;}await write(response,item.value,signal,row);}
    signal.throwIfAborted();row.sourceEof=true;response.end();
  }finally{
    try{if(cancelOriginal!==null)await cancelOriginal;else if(!eof)await cancel();}
    finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
  }
}

async function readBody(request,row){
  const chunks=[];let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>BODY_CAP)throw fail(413,'body-cap');chunks.push(chunk);}
  row.bodyBytes=size;return Buffer.concat(chunks,size);
}
async function staticBytes(root,relative){
  const file=path.join(root,relative);
  if(await fs.realpath(file)!==file)throw fail(403,'static-symlink');
  const named=await fs.lstat(file);if(!named.isFile()||named.nlink!==1)throw fail(403,'static-file');
  if(named.size>STATIC_CAP)throw fail(413,'static-cap');
  const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const first=await handle.stat();if(signature(first)!==signature(named))throw fail(409,'static-open-drift');
    const data=Buffer.alloc(first.size+1);let used=0;
    for(;;){const {bytesRead}=await handle.read(data,used,data.length-used,used);if(!bytesRead)break;used+=bytesRead;if(used>first.size)throw fail(409,'static-size-drift');}
    if(used!==first.size||signature(first)!==signature(await handle.stat())||signature(first)!==signature(await fs.lstat(file))||await fs.realpath(file)!==file)throw fail(409,'static-drift');
    return data.subarray(0,used);
  }finally{await handle.close();}
}
function validateUiBody(profile,body,context){
  if(!body||typeof body!=='object'||Array.isArray(body)||body.id!==context.threadId||body.runId!==context.runId||body.trigger!=='regenerate-message')throw fail(400,'ui-identity');
  if(profile==='vercel-ai-sdk'){
    if(!Array.isArray(body.messages)||body.messages.length!==100)throw fail(400,'ui-history');
    for(let i=0;i<100;i++){
      const message=body.messages[i],expected=context.history[i];
      if(!message||message.id!==expected.id||message.role!==expected.role||!Array.isArray(message.parts)||message.parts.length!==1||message.parts[0].type!=='text'||message.parts[0].text!==expected.text)throw fail(400,'ui-history');
    }
  }else if(profile==='assistant-ui'){
    if(Object.keys(body).length!==3)throw fail(400,'ui-body-fields');
  }else throw fail(404,'ui-profile');
}
async function* canonicalSse(events){
  let id=null,runStarted=false,started=false,ended=false,finished=false;
  for await(const event of events){
    if(finished)throw Error('canonical-after-finish');
    if(event.type==='RUN_STARTED'){
      if(runStarted)throw Error('canonical-run-start');runStarted=true;
    }else if(event.type==='TEXT_MESSAGE_START'){
      if(!runStarted||started||event.role!=='assistant')throw Error('canonical-start');started=true;id=event.messageId;
      yield encode({sequence:0,scheduledMs:0,messageId:id,type:'assistant-start',text:''});
    }else if(event.type==='TEXT_MESSAGE_CONTENT'){
      const scheduledMs=event.metadata?.scheduledMs,sequence=scheduledMs/50;
      if(!started||ended||event.messageId!==id||!Number.isInteger(sequence)||sequence<1||sequence>200)throw Error('canonical-delta');
      yield encode({sequence,scheduledMs,messageId:id,type:'text-delta',text:event.delta});
    }else if(event.type==='TEXT_MESSAGE_END'){
      if(!started||ended||event.messageId!==id)throw Error('canonical-end');ended=true;
    }else if(event.type==='RUN_FINISHED'){
      if(!ended)throw Error('canonical-finish');finished=true;
      yield encode({sequence:201,scheduledMs:10000,messageId:id,type:'assistant-complete',text:''});
    }else throw Error('canonical-event');
  }
  if(!finished)throw Error('canonical-incomplete');
}

/** Functional source/HTTP ownership only; no SDK-consumption or FPS inference. */
export async function startFunctionalServer({profile,assetsDirectory,privateCase,omitDelta}){
  const context=parsePublicContext(privateCase?.publicContext);
  if(context.profile!==profile||typeof assetsDirectory!=='string'||!path.isAbsolute(assetsDirectory)||path.resolve(assetsDirectory)!==assetsDirectory||await fs.realpath(assetsDirectory)!==assetsDirectory)throw Error('server-selection');
  if(!Array.isArray(privateCase.historyRestore)||privateCase.historyRestore.length!==3||!Array.isArray(privateCase.continuation)||privateCase.continuation.length!==204||typeof privateCase.seedRunId!=='string')throw Error('server-private-case');
  if(omitDelta!==undefined&&(!Number.isInteger(omitDelta)||omitDelta<1||omitDelta>200))throw Error('server-fault');
  const report={schema:1,profile,sourceOrigin:privateCase.origin,sourceEmissions:[],playbacks:{seed:{started:false,completed:false,aborted:false,error:null},continuation:{started:false,completed:false,aborted:false,error:null}},requests:[],closed:false,errors:[],performance:false,FPS:null};
  const controllers=new Set(),sockets=new Set(),socketClosures=new Set(),pending=new Set();let closing=false,closeOriginal=null,plugin=null,origin=null;
  const playback=async function*(kind,signal){
    const row=report.playbacks[kind];if(!row||closing||row.started)throw fail(409,'playback-once-only');row.started=true;
    try{
      for await(const event of scheduledPlayback(privateCase,kind,{signal,omitDelta:kind==='continuation'?omitDelta:undefined,observe:receipt=>{if(report.sourceEmissions.length>=207)throw Error('emission-cap');report.sourceEmissions.push(receipt);}}))yield event;
      signal.throwIfAborted();row.completed=true;
    }catch(error){row.aborted=signal.aborted;row.error=String(error?.message??error).slice(0,512);throw error;}
  };
  if(profile==='copilotkit'){
    const {createRoutes}=await import('../../competitors/copilotkit/server.mjs');
    plugin=await createRoutes({context:privateCase,playback});
  }
  async function stream(response,source,signal,row){
    for await(const chunk of source)await write(response,chunk,signal,row);
    signal.throwIfAborted();row.sourceEof=true;response.end();
  }
  const server=http.createServer({maxHeaderSize:65536},(request,response)=>{
    const controller=new AbortController();controllers.add(controller);
    const row={method:request.method,path:(request.url??'').slice(0,256),bodyBytes:0,status:null,responseBytes:0,sourceEof:false,responseFinished:false,responseClosed:false,clientAborted:false,error:null};
    const capacity=report.requests.length>=REQUEST_CAP;if(!capacity)report.requests.push(row);
    const abort=()=>{row.clientAborted=true;controller.abort();};request.once('aborted',abort);
    response.once('finish',()=>{row.responseFinished=true;});
    const closed=new Promise(resolve=>response.once('close',()=>{row.responseClosed=true;if(!response.writableFinished)abort();resolve();}));
    const task=(async()=>{
      try{
        if(capacity||closing)throw fail(capacity?429:503,capacity?'request-cap':'closing');
        if(typeof request.url!=='string'||request.url.length>8192)throw fail(400,'url-cap');
        const url=new URL(request.url,origin);row.path=url.pathname.slice(0,256);
        let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{throw fail(400,'url-encoding');}
        if(url.search||decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(x=>x==='.'||x==='..'))throw fail(400,'path');
        if(request.method==='GET'&&decoded==='/context'){
          const text=JSON.stringify(context);response.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});row.status=200;await stream(response,[text],controller.signal,row);return;
        }
        if(plugin&&decoded.startsWith('/copilot')){
          const body=request.method==='GET'||request.method==='HEAD'?undefined:await readBody(request,row);
          const headers=new Headers();for(let i=0;i<request.rawHeaders.length;i+=2)if(!['connection','transfer-encoding','content-length'].includes(request.rawHeaders[i].toLowerCase()))headers.append(request.rawHeaders[i],request.rawHeaders[i+1]);
          const value=await plugin.handle(new Request(url,{method:request.method,headers,signal:controller.signal,...(body===undefined?{}:{body})}));
          if(!value)throw fail(404,'plugin-route');await pipeOwnedWebResponse(response,value,controller.signal,row);return;
        }
        if(decoded==='/stream/ui'&&request.method==='POST'){
          let body;try{body=JSON.parse((await readBody(request,row)).toString('utf8'));}catch(error){if(error.status)throw error;throw fail(400,'json');}
          validateUiBody(profile,body,context);if(report.playbacks.continuation.started)throw fail(409,'playback-once-only');
          response.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'private,no-cache,max-age=0,must-revalidate','x-vercel-ai-ui-message-stream':'v1'});row.status=200;
          await stream(response,uiSse(playback('continuation',controller.signal)),controller.signal,row);return;
        }
        if(decoded==='/stream/canonical'&&request.method==='GET'&&profile==='threadplane'){
          if(report.playbacks.continuation.started)throw fail(409,'playback-once-only');response.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'private,no-cache,max-age=0,must-revalidate'});row.status=200;
          await stream(response,canonicalSse(playback('continuation',controller.signal)),controller.signal,row);return;
        }
        if(decoded==='/stream/agui'&&request.method==='POST'&&profile!=='copilotkit'){
          let body;try{body=JSON.parse((await readBody(request,row)).toString('utf8'));}catch(error){if(error.status)throw error;throw fail(400,'json');}
          if(body.threadId!==context.threadId||body.runId!==context.runId||!Array.isArray(body.messages)||body.messages.length!==100||body.messages.some((m,i)=>m.id!==context.history[i].id||m.role!==context.history[i].role||m.content!==context.history[i].text))throw fail(400,'agui-identity-or-history');
          if(report.playbacks.continuation.started)throw fail(409,'playback-once-only');response.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'private,no-cache,max-age=0,must-revalidate'});row.status=200;
          await stream(response,(async function*(){for await(const event of playback('continuation',controller.signal))yield encode(event);})(),controller.signal,row);return;
        }
        if(request.method!=='GET')throw fail(404,'route');
        const relative=decoded==='/'?'index.html':decoded.slice(1);if(!relative||relative.includes('//'))throw fail(400,'path');
        let bytes;try{bytes=await staticBytes(assetsDirectory,relative);}catch(error){if(error.code==='ENOENT')throw fail(404,'static-missing');throw error;}
        response.writeHead(200,{'content-type':mime[path.extname(relative)]??'application/octet-stream','cache-control':'no-store'});row.status=200;await stream(response,[bytes],controller.signal,row);
      }catch(error){
        row.error=String(error?.message??error).slice(0,512);
        if(!response.headersSent&&!response.destroyed){row.status=Number.isInteger(error.status)?error.status:500;response.writeHead(row.status,{'content-type':'application/json'});response.end(JSON.stringify({error:row.error}));}
        else if(!response.destroyed)response.destroy();
      }finally{await closed;controllers.delete(controller);request.removeListener('aborted',abort);}
    })();pending.add(task);void task.then(()=>pending.delete(task),error=>{pending.delete(task);if(report.errors.length<16)report.errors.push(String(error?.message??error).slice(0,512));});
  });
  server.requestTimeout=30000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
  server.on('connection',socket=>{
    sockets.add(socket);
    const closure=new Promise(resolve=>socket.once('close',()=>{sockets.delete(socket);resolve();}));
    socketClosures.add(closure);void closure.then(()=>socketClosures.delete(closure));
  });
  try{server.listen(0,'127.0.0.1');await once(server,'listening');origin='http://127.0.0.1:'+server.address().port;}
  catch(error){await plugin?.dispose();throw error;}
  return{
    origin,
    getReport:()=>structuredClone(report),
    close(){
      if(closeOriginal)return closeOriginal;closing=true;
      closeOriginal=(async()=>{
        for(const controller of controllers)controller.abort();
        const serverClose=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
        for(const socket of sockets)socket.destroy();
        const results=await Promise.allSettled([serverClose,...pending,...socketClosures,...(plugin?[plugin.dispose()]:[])]);
        const failures=results.filter(x=>x.status==='rejected');if(failures.length)throw new AggregateError(failures.map(x=>x.reason),'server-close');
        if(pending.size||controllers.size||sockets.size)throw Error('server-originals-pending');report.closed=true;
      })();return closeOriginal;
    },
  };
}
