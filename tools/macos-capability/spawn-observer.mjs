import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {errorMonitor} from 'node:events';
import {validIdentity,spawnAdmitted,diagnostic} from './receipt.mjs';
const originalSpawn=childProcess.spawn;
/** @typedef {Record<string, any>} Data */
/** No native side effects until explicitly installed by the authenticated child. */
/** @param {(kind:string,pid:number)=>Promise<Data>} query */
export function installObserver(query) {
 /** @type {Data[]} */const rows=[];
 /** @type {Set<Promise<unknown>>} */const pending=new Set();
 /** @type {unknown[]} */const errors=[];
 let poisoned=false,omittedErrors=0;
 /** @param {unknown} error */function poison(error){poisoned=true;if(errors.length<32)errors.push(error);else omittedErrors++;}
 /** @this {unknown} @param {...any} args */
 const wrapper=function(...args) {
  const actual=/** @type {import('node:child_process').ChildProcess} */(Reflect.apply(originalSpawn,this,args));
  try {
   if(!spawnAdmitted(rows.length)){poison(Error('Application spawn capacity64'));return actual;}
   const options=Array.isArray(args[1])?args[2]:args[1];const descriptor=options&&typeof options==='object'?Object.getOwnPropertyDescriptor(options,'detached'):null;
   const inherited=options&&typeof options==='object'&&'detached'in options&&!descriptor;
   const detached=descriptor&&'value'in descriptor&&typeof descriptor.value==='boolean'?descriptor.value:!descriptor&&!inherited?false:null;
   /** @type {Data} */const row={detached,detachedSource:descriptor?'own-data':inherited?'unsupported-inherited':'default-false',ordinal:rows.length+1,pid:actual.pid,identity:null,spawnfile:actual.spawnfile,spawnargs:actual.spawnargs,
    exited:false,closed:false,code:null,signal:null,originalErrorPresent:false};
   rows.push(row);
   (/** @type {import('node:events').EventEmitter} */(actual)).on(errorMonitor,(/** @type {unknown} */error)=>{row.originalErrorPresent=true;poison(error);});
   actual.once('exit',(code,signal)=>{row.exited=true;row.code=code;row.signal=signal;});
   actual.once('close',(code,signal)=>{row.closed=true;row.code=code;row.signal=signal;});
   const task=(async()=>{if(!Number.isSafeInteger(actual.pid)||!actual.pid)throw Error('Original application PID unavailable');
    const identity=await query('pid',actual.pid);
    if(!validIdentity(identity)||identity.ppid!==process.pid||identity.uid!==process.getuid?.())throw Error('Original application identity unavailable');
    row.identity=identity;
   })();pending.add(task);void task.then(()=>pending.delete(task),error=>{pending.delete(task);poison(error);});
  }catch(error){poison(error);}
  return actual;
 };
 childProcess.spawn=/** @type {typeof childProcess.spawn} */(wrapper);
 syncBuiltinESMExports();
 return {
  async barrier(){await Promise.allSettled([...pending]);if(poisoned)throw new AggregateError(errors,'Original spawn observation unavailable');},
  snapshot(){return {poisoned,omittedErrors,pending:pending.size,rows:rows.map(row=>({...row})),originalErrors:errors.map(diagnostic)};},
  restore(){childProcess.spawn=originalSpawn;syncBuiltinESMExports();}
 };
}
