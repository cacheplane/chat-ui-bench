import type {ProtoClockPort,ProtoStartParameters,ProtoTracePorts,ProtoWriteAck} from './comparison-proto-trace.js';

/** Narrow structural subsets of the pinned public objects. No SDK value import.
 * Acquisition, dedicated-session/file ownership and pre-registration continuity
 * belong to the future outer owner, not this injected mapping. */
interface PublicSession {
 on(event:'Tracing.tracingComplete',listener:(reply:unknown)=>void):unknown;
 on(event:'close',listener:()=>void):unknown;
 off(event:'Tracing.tracingComplete',listener:(reply:unknown)=>void):unknown;
 off(event:'close',listener:()=>void):unknown;
 send(method:'Tracing.start',parameters:ProtoStartParameters):Promise<unknown>;
 send(method:'Tracing.end'):Promise<unknown>;
 send(method:'IO.read',parameters:{handle:string;size:65536}):Promise<unknown>;
 send(method:'IO.close',parameters:{handle:string}):Promise<unknown>;
 detach():Promise<void>;
}
interface PublicBrowser {
 isConnected():boolean;
 on(event:'disconnected',listener:()=>void):unknown;
 off(event:'disconnected',listener:()=>void):unknown;
}
interface PublicContext {
 browser():PublicBrowser|null;
 isClosed():boolean;
 on(event:'close',listener:()=>void):unknown;
 off(event:'close',listener:()=>void):unknown;
}
interface PublicPage {
 context():PublicContext;
 isClosed():boolean;
 on(event:'close'|'crash',listener:()=>void):unknown;
 off(event:'close'|'crash',listener:()=>void):unknown;
}
export interface ProtoPublicInputs {
 session:PublicSession;page:PublicPage;context:PublicContext;browser:PublicBrowser;
 file:{write(bytes:Uint8Array,offset:number,length:number,position:null):Promise<unknown>;close():Promise<void>};
 clock:ProtoClockPort;
}
const observerFailure=()=>new Error('Proto public observer failure');
function removeAll(removers:readonly (()=>unknown)[]):void {
 let failed=false;
 for(const remove of removers){try{remove();}catch{failed=true;}}
 if(failed)throw observerFailure();
}
function observe(register:()=>unknown,remove:()=>unknown):()=>void {
 // Registration is attempted before calling native on, including install-throw.
 try{register();}catch{try{remove();}catch{/* Unknown cleanup stays failure. */}throw observerFailure();}
 return ()=>{try{remove();}catch{throw observerFailure();}};
}
function closeOnce(call:()=>Promise<void>):()=>Promise<void> {
 let attempted=false,cached:Promise<void>;
 return ()=>{
  if(!attempted){attempted=true;try{cached=call();}catch{cached=Promise.reject(new Error('Proto public close failure'));}}
  return cached;
 };
}
function writeAck(reply:unknown,length:number):ProtoWriteAck {
 let written:unknown;
 try{
  if(reply===null||typeof reply!=='object')throw 0;
  const descriptor=Object.getOwnPropertyDescriptor(reply,'bytesWritten');
  if(!descriptor||!Object.hasOwn(descriptor,'value'))throw 0;
  written=descriptor.value;
 }catch{throw new Error('Proto public write acknowledgement failure');}
 if(typeof written!=='number'||!Number.isInteger(written)||written<0||written>length)throw new Error('Proto public write acknowledgement failure');
 return {status:written===length?'complete':'partial',written};
}
/** Effect-free factory. Every promise mapping settles only after the invoked
 * original. Planned detach is not a synthesized close or lifetime revocation. */
export function createProtoPublicPorts(inputs:ProtoPublicInputs):ProtoTracePorts {
 const {session,page,context,browser,file,clock}=inputs;
 return {
  clock,
  session:{
   onComplete:listener=>observe(()=>session.on('Tracing.tracingComplete',listener),()=>session.off('Tracing.tracingComplete',listener)),
   onClosed:listener=>observe(()=>session.on('close',listener),()=>session.off('close',listener)),
   start:parameters=>session.send('Tracing.start',parameters).then(()=>{}),
   end:()=>session.send('Tracing.end').then(()=>{}),
   read:parameters=>session.send('IO.read',parameters),
   closeStream:parameters=>session.send('IO.close',parameters).then(()=>{}),
  },
  sink:{write:bytes=>{const length=bytes.byteLength;return file.write(bytes,0,length,null).then(reply=>writeAck(reply,length));},close:closeOnce(()=>file.close())},
  lifetime:{
   active:()=>page.context()===context&&context.browser()===browser&&!page.isClosed()&&!context.isClosed()&&browser.isConnected(),
   close:closeOnce(()=>session.detach()),
   onRevoked:listener=>{
    const callbacks=[()=>listener(),()=>listener(),()=>listener(),()=>listener()];
    const registrations=[
     {on:()=>page.on('close',callbacks[0]!),off:()=>page.off('close',callbacks[0]!)},
     {on:()=>page.on('crash',callbacks[1]!),off:()=>page.off('crash',callbacks[1]!)},
     {on:()=>context.on('close',callbacks[2]!),off:()=>context.off('close',callbacks[2]!)},
     {on:()=>browser.on('disconnected',callbacks[3]!),off:()=>browser.off('disconnected',callbacks[3]!)},
    ];
    const attempted:(()=>unknown)[]=[];
    try{for(const registration of registrations){attempted.push(registration.off);registration.on();}}
    catch{try{removeAll(attempted);}catch{/* All attempted offs still ran. */}throw observerFailure();}
    return ()=>removeAll(attempted);
   },
  },
 };
}
