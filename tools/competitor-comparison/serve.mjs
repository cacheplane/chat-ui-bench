import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFunctionalServer} from './server.mjs';

const sig=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String).join(':');
async function loadFixture(file,sha256){
  if(!path.isAbsolute(file)||path.resolve(file)!==file||await fs.realpath(file)!==file)throw Error('fixture-path');
  const named=await fs.lstat(file,{bigint:true});
  if(!named.isFile()||named.nlink!==1n||named.size<1n||named.size>1048576n)throw Error('fixture-file');
  const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const original=await handle.stat({bigint:true});if(sig(named)!==sig(original))throw Error('fixture-open');
    const bytes=Buffer.alloc(Number(original.size)+1);let count=0;
    for(;;){const read=await handle.read(bytes,count,bytes.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;if(count>Number(original.size))throw Error('fixture-size');}
    if(count!==Number(original.size)||sig(original)!==sig(await handle.stat({bigint:true}))||sig(original)!==sig(await fs.lstat(file,{bigint:true}))||await fs.realpath(file)!==file)throw Error('fixture-drift');
    const value=bytes.subarray(0,count);if(createHash('sha256').update(value).digest('hex')!==sha256)throw Error('fixture-sha256');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(value);return JSON.parse(text);
  }finally{await handle.close();}
}
function options(args){
  const value={};for(let i=0;i<args.length;i+=2){const key=args[i],item=args[i+1];if(!['--profile','--assets','--fixture','--sha256','--omit-delta'].includes(key)||Object.hasOwn(value,key)||typeof item!=='string')throw Error('arguments');value[key]=item;}
  if(!['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].includes(value['--profile'])||!value['--assets']||!value['--fixture']||!/^[a-f0-9]{64}$/.test(value['--sha256']??''))throw Error('arguments');
  const omit=value['--omit-delta'];if(omit!==undefined&&(!/^[1-9][0-9]{0,2}$/.test(omit)||Number(omit)>200))throw Error('omit-delta');
  return{profile:value['--profile'],assetsDirectory:value['--assets'],fixturePath:value['--fixture'],sha256:value['--sha256'],...(omit===undefined?{}:{omitDelta:Number(omit)})};
}
const send=value=>new Promise((resolve,reject)=>{if(!process.connected)return reject(Error('ipc-disconnected'));process.send(value,error=>error?reject(error):resolve());});
let server=null,closing=null;
async function close(success){
  if(closing)return closing;
  closing=(async()=>{await server?.close();if(success)await send({type:'closed',report:server.getReport()});else process.exitCode=1;if(process.connected)process.disconnect();})();return closing;
}
try{
  if(process.versions.node!=='24.20.0'||typeof process.send!=='function')throw Error('owned-node24-ipc-required');
  const selected=options(process.argv.slice(2));const privateCase=await loadFixture(selected.fixturePath,selected.sha256);
  server=await startFunctionalServer({...selected,privateCase});
  process.on('message',message=>{
    if(!message||typeof message!=='object'||Object.keys(message).length!==1||message.type!=='close'){void close(false).catch(failure);return;}
    void close(true).catch(failure);
  });
  process.once('disconnect',()=>{if(!closing)void close(false).catch(failure);});
  process.once('SIGTERM',()=>{void close(false).catch(failure);});
  process.once('SIGINT',()=>{void close(false).catch(failure);});
  await send({type:'ready',origin:server.origin});
}catch(error){await failure(error);}
async function failure(error){
  process.exitCode=1;process.stderr.write(String(error?.message??error).slice(0,1024)+'\n');
  try{await server?.close();}catch(closeError){process.stderr.write(String(closeError?.message??closeError).slice(0,1024)+'\n');}
  if(process.connected)process.disconnect();
}
