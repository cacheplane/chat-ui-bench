import { serve } from '@hono/node-server';
import type { AddressInfo } from 'node:net';
import type { CaseIds } from '../src/controls.js';
import { createCaseRuntime, type MountedOwner } from './runtime.js';
import { diagnostic } from './ownership.js';

/** Future separately admitted hosted entry supplies actual production assets and
 * the original page/harness owner. No CLI, top-level listener or default registry. */
export async function createCaseServer(options:{fixture:unknown;ids:CaseIds;repetition:string;mountedOwner:MountedOwner;assets:(request:Request)=>Promise<Response>}) {
  const application=createCaseRuntime(options.fixture,options.ids,options.repetition);
  application.bindMountedOwner(options.mountedOwner);
  let resolveListening:(value:AddressInfo)=>void = ()=> {throw new Error('Listening outcome not initialized');};
  let rejectListening:(reason:unknown)=>void = ()=> {throw new Error('Listening rejection not initialized');};
  const listening=new Promise<AddressInfo>((resolve,reject)=> {resolveListening=resolve;rejectListening=reject;});
  const server=serve({hostname:'127.0.0.1',port:0,fetch:request=> {
    const path=new URL(request.url).pathname;
    return path.startsWith('/copilot') || path.startsWith('/__bench/') ? application.fetch(request) : options.assets(request);
  }},info=>resolveListening(info));
  server.once('error',rejectListening);
  let info:AddressInfo;
  try {info=await listening;server.off('error',rejectListening);}
  catch(error) {throw new Error('Original server listen failed; application/store ownership retained',{cause:{primary:diagnostic(error),evidence:application.evidence()}});}
  const url=`http://127.0.0.1:${info.port}`;
  const closeServer=async()=> {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));};
  return {url,seed:()=>application.seed(url),completed:application.completed,context:application.context,evidence:application.evidence,
    close:()=>application.dispose(closeServer)};
}
