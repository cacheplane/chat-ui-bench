import {fork} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./serve.mjs',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url));
function deadline(original,ms,label){let timer;return Promise.race([original,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]).finally(()=>clearTimeout(timer));}

/** A deadline is attention/containment only; successful closure awaits ORIGINAL close. */
export async function launchCaseServer({profile,assetsDirectory,fixturePath,sha256,omitDelta,protocol}){
  if(protocol!==undefined&&protocol!=='matrix-v3')throw Error('competitor-server-protocol');
  const args=['--profile',profile,'--assets',assetsDirectory,'--fixture',fixturePath,'--sha256',sha256,...(protocol===undefined?[]:['--protocol',protocol]),...(omitDelta===undefined?[]:['--omit-delta',String(omitDelta)])];
  const child=fork(entry,args,{cwd:root,execPath:process.execPath,execArgv:[],env:{PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME,LC_ALL:'C',NODE_ENV:'production',COPILOTKIT_TELEMETRY_DISABLED:'true',DO_NOT_TRACK:'1'},stdio:['ignore','pipe','pipe','ipc']});
  const state={pid:child.pid,exit:null,close:null,disconnected:false,report:null,protocolError:null,stdout:[],stderr:[],streams:{stdout:{bytes:0,end:false,closed:false},stderr:{bytes:0,end:false,closed:false}}};
  let resolveReady,rejectReady,ready=false,resolveClose,closing=null;
  const originalReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});originalReady.catch(()=>{});
  const originalClose=new Promise(resolve=>{resolveClose=resolve;});
  const contain=reason=>{state.protocolError??=reason;if(state.exit===null)child.kill('SIGTERM');};
  child.on('error',error=>{state.protocolError??=String(error.message).slice(0,512);rejectReady(error);});
  child.on('exit',(code,signal)=>{state.exit={code,signal};});
  child.on('disconnect',()=>{state.disconnected=true;});
  child.on('close',(code,signal)=>{state.close={code,signal};if(!ready)rejectReady(Error('competitor-server-before-ready'));resolveClose();});
  child.on('message',message=>{
    if(!message||typeof message!=='object')return contain('server-ipc-shape');
    if(message.type==='ready'&&!ready&&Object.keys(message).length===2&&typeof message.origin==='string'&&/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(message.origin)&&Number(new URL(message.origin).port)<=65535){ready=true;resolveReady(message.origin);return;}
    if(message.type==='closed'&&ready&&state.report===null&&Object.keys(message).length===2&&message.report&&Buffer.byteLength(JSON.stringify(message.report))<=262144){state.report=message.report;return;}
    contain('server-ipc-protocol');
  });
  for(const name of ['stdout','stderr']){
    const stream=child[name],observed=state.streams[name];
    stream.on('data',bytes=>{observed.bytes+=bytes.length;if(observed.bytes>262144||state[name].length>=512){contain('server-stream-cap');return;}state[name].push(Buffer.from(bytes));});
    stream.on('end',()=>{observed.end=true;});stream.on('close',()=>{observed.closed=true;});stream.on('error',()=>contain('server-stream-error'));
  }
  const outcome=()=>({...state,stdout:Buffer.concat(state.stdout).toString('utf8'),stderr:Buffer.concat(state.stderr).toString('utf8')});
  async function terminateAndObserve(){
    if(state.close===null&&state.exit===null)child.kill('SIGKILL');
    try{await deadline(originalClose,5000,'competitor-server-original-close-unsettled');}
    catch(error){error.unsafeOutstanding=true;error.serverOutcome=outcome();throw error;}
  }
  let origin;
  try{origin=await deadline(originalReady,30000,'competitor-server-ready-deadline');}
  catch(error){await terminateAndObserve();error.serverOutcome=outcome();throw error;}
  function close(){
    if(closing)return closing;
    closing=(async()=>{
      try{
        if(state.close===null){
          if(child.connected)await new Promise((resolve,reject)=>child.send({type:'close'},error=>error?reject(error):resolve()));
          await deadline(originalClose,10000,'competitor-server-close-deadline');
        }
      }catch(error){await terminateAndObserve();error.serverOutcome=outcome();throw error;}
      if(!state.disconnected||Object.values(state.streams).some(x=>!x.end||!x.closed)||state.protocolError)throw Object.assign(Error('competitor-server-original-streams'),{serverOutcome:outcome()});
      return outcome();
    })();return closing;
  }
  return Object.freeze({origin,close});
}
