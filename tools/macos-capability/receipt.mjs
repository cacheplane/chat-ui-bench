/** Pure receipt admission; no host/browser actions. Parsed SDK data is validated before use. */
/** @typedef {Record<string, any>} Data */
/** @param {Record<string,string|undefined>} env @param {string} platform @param {string} arch */
export function admitRuntime(env,platform,arch) {
 if(platform!=='darwin'||arch!=='arm64'||env.GITHUB_ACTIONS!=='true'||env.RUNNER_ENVIRONMENT!=='github-hosted'||env.RUNNER_OS!=='macOS'||env.GITHUB_REPOSITORY!=='cacheplane/chat-ui-bench'||env.GITHUB_REF!=='refs/heads/main'||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||env.EXPECTED_SHA!==env.GITHUB_SHA)throw Error('Hosted capability admission');
 return {repository:env.GITHUB_REPOSITORY,sha:env.GITHUB_SHA,ref:env.GITHUB_REF,provider:'github-hosted',platform,arch};
}
/** @param {Data|null|undefined} row */
export function validIdentity(row) {
 return row?.status==='observed'&&['pid','ppid','pgid','sid','uid','birthSec','birthUsec','kernelStatus'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0)&&row.pid>0&&row.ppid>0&&row.pgid>0&&row.sid>0&&row.birthSec>0&&row.birthUsec<1000000;
}
/** @param {Data|null|undefined} a @param {Data|null|undefined} b */
export function sameIdentity(a,b) {return validIdentity(a)&&validIdentity(b)&&['pid','ppid','pgid','sid','uid','birthSec','birthUsec'].every(k=>a?.[k]===b?.[k]);}
/** @param {Data} row @param {number} parent @param {number} uid */
export function exclusiveCase(row,parent,uid){return validIdentity(row)&&row.pid===row.pgid&&row.pid===row.sid&&row.ppid===parent&&row.uid===uid;}
/** @param {Data} spawn @param {Data} owner */
export function ownedGroup(spawn,owner) {
 const row=spawn.identity;
 if(!validIdentity(owner)||!validIdentity(row)||spawn.pid!==row.pid||row.ppid!==owner.pid||row.uid!==owner.uid)return false;
 return spawn.detached===false?row.pgid===owner.pgid&&row.sid===owner.sid:spawn.detached===true&&row.pid===row.pgid&&row.pid===row.sid;
}
/** @param {import('node:events').EventEmitter} emitter @param {string} nonce @param {string} type */
export function ipcLatch(emitter,nonce,type) {
 /** @type {(value:Data)=>void} */let resolve;
 const promise=new Promise(/** @param {(value:Data)=>void} done */done=>{resolve=done;});
 /** @param {Data} message */function receive(message){if(message?.nonce===nonce&&message.type===type)resolve(message);}
 emitter.on('message',receive);return {promise,remove(){emitter.removeListener('message',receive);}};
}
/** @param {Data|null|undefined} row */
export function scopedEmpty(row){return row?.status==='observed'&&row.lookahead===257&&row.admittedMaximum===256&&row.pidBytes>0&&Number.isSafeInteger(row.pidBytes)&&row.returnedBytes===0&&row.invalidMember!==true&&Array.isArray(row.members)&&row.members.length===0;}
/** @param {Data|null|undefined} row */
export function displaySupported(row) {
 return row?.status==='observed'&&row.onConsole===true&&row.loginDone===true&&Number.isSafeInteger(row.displayCount)&&row.displayCount>0&&row.displayCount<=8&&Array.isArray(row.displays)&&row.displays.length===row.displayCount&&new Set(row.displays.map((/** @type {Data} */d)=>d.id)).size===row.displayCount&&row.displays.some((/** @type {Data} */d)=>d.id===row.main)&&row.displays.every((/** @type {Data} */d)=>Number.isSafeInteger(d.id)&&d.id>0&&['x','y','width','height'].every(k=>Number.isFinite(d[k]))&&d.width>0&&d.height>0);
}
/** One original start: 60s acquisition, then the existing 10s closure/report allowance.
 * @param {number} start */
export function capabilityBudget(start){if(!Number.isFinite(start)||start<0)throw Error('Original capability clock');return {acquisition:start+60000,closureReport:start+70000};}
/** Availability is independent from closure of the actually observed scoped resources.
 * @param {Data} row */
export function scopedClosure(row) {
 const roles=['loopback','loopback-request','browser','context','page'];
 return row.pending===0&&Array.isArray(row.cleanupErrors)&&row.cleanupErrors.length===0&&Array.isArray(row.observerErrors)&&row.observerErrors.length===0&&row.caseClosed===true&&Number.isInteger(row.caseExit?.code)&&row.caseExit?.signal===null&&row.ipcFlushed===true&&row.ipcDisconnected===true&&row.groupAuthorityComplete===true&&Array.isArray(row.groups)&&row.groups.length>0&&row.groups.every(scopedEmpty)&&Array.isArray(row.resources)&&row.resources.length<=5&&new Set(row.resources.map((/** @type {Data} */r)=>r.role)).size===row.resources.length&&row.resources.every((/** @type {Data} */r)=>roles.includes(r.role)&&r.closed===true)&&Array.isArray(row.spawns)&&row.spawns.length<=64&&row.spawns.every((/** @type {Data} */s)=>s.closed===true&&s.exited===true&&validIdentity(s.identity))&&Array.isArray(row.helperCommands)&&row.helperCommands.every((/** @type {Data} */c)=>c.closed===true&&c.exited===true);
}
/** Explicit dispatch absence is distinct from closure of an attempted case.
 * @param {Data} row */
export function caseNotAttempted(row) {
 const life=row.lifecycle;
 return row.caseSpawnAttempted===false&&['unavailable','failed-preparation-case-not-attempted'].includes(row.status)&&['casePid','child','caseOutput','caseIdentity','groups','groupAuthorityComplete','resources','spawns'].every(key=>!Object.hasOwn(row,key))&&Array.isArray(row.queries)&&row.queries.length===0&&life?.caseClosed===false&&life.caseExit===null&&life.ipcFlushed===false&&life.ipcDisconnected===false;
}
/** Settlement of observed public operations never proves pooled sockets or descendants absent.
 * @param {Data} row */
export function preparationSettled(row) {
 const commands=row.commands,attempts=row.primarySourceAttempts;
 return row.pending===0&&row.trackedSourceClosed===true&&!Object.hasOwn(row,'finalSourceError')&&Array.isArray(commands)&&commands.length>0&&commands.length<=32&&Array.from(commands).every(command=>command?.exited===true&&command.closed===true&&((Number.isInteger(command.code)&&command.signal===null)||(command.code===null&&typeof command.signal==='string'&&command.signal.length>0)))&&Array.isArray(attempts)&&attempts.length<=2&&Array.from(attempts).every((attempt,index)=>attempt?.index===index&&attempt.fetchCallAttempted===true&&attempt.fetchSettled===true&&Array.isArray(attempt.cleanupErrors)&&attempt.cleanupErrors.length===0&&(attempt.responsePresent===false?attempt.originalFailurePresent===true&&attempt.status===null&&attempt.ok===null&&attempt.bodyDisposition==='not-attempted':attempt.responsePresent===true&&Number.isInteger(attempt.status)&&attempt.status>=100&&attempt.status<=599&&attempt.ok===(attempt.status>=200&&attempt.status<=299)&&['absent','cancelled','read-eof'].includes(attempt.bodyDisposition)));
}
/** @param {Data} receipt @param {Data} closure */
export function classifyCapabilityReceipt(receipt,closure) {
 const noCase=caseNotAttempted(receipt),closed=!noCase&&scopedClosure(closure);
 const closureStatus=closed?'observed-scoped-resources-closed':'unknown';
 return {status:noCase?'failed-preparation-case-not-attempted':closed?receipt.status:'failed-uncontained',capabilityStatus:!noCase&&receipt.status==='supported-capability-only'?'supported':'unavailable',closureStatus,caseClosureStatus:noCase?'not-applicable-case-not-attempted':closureStatus,preparationOperationStatus:noCase&&preparationSettled(receipt)?'settled-observed':'unknown',overallResourceClosure:'unknown'};
}
/** @param {Data} row */
export function supported(row) {
 const roles=['loopback','loopback-request','browser','context','page'];
 return row.primaryPresent===false&&Array.isArray(row.cleanupErrors)&&row.cleanupErrors.length===0&&Array.isArray(row.observerErrors)&&row.observerErrors.length===0&&row.expired===false&&row.stopRequested===false&&Array.isArray(row.resources)&&row.resources.length===roles.length&&roles.every(role=>row.resources.filter((/** @type {Data} */r)=>r.role===role&&r.closed===true).length===1)&&row.pending===0&&row.caseExit?.code===0&&row.caseExit?.signal===null&&row.caseClosed===true&&row.ipcFlushed===true&&row.ipcDisconnected===true&&Array.isArray(row.spawns)&&row.spawns.length>0&&row.spawns.length<=64&&row.spawns.every((/** @type {Data} */x)=>x.exited===true&&x.closed===true&&x.code===0&&x.signal===null&&validIdentity(x.identity))&&Array.isArray(row.groups)&&row.groups.length>0&&row.groups.every(scopedEmpty)&&displaySupported(row.display)&&row.page?.visibility==='visible'&&row.page?.focused===true&&row.page?.width===1280&&row.page?.height===800&&Array.isArray(row.page?.raf)&&row.page.raf.length===2&&row.page.raf.every((/** @type {unknown} */x)=>typeof x==='number'&&Number.isFinite(x)&&x>=0)&&row.page.raf[1]>row.page.raf[0];
}
/** @param {unknown} value */
export function serialize(value){const json=JSON.stringify(value);if(typeof json!=='string')throw Error('Receipt capacity262144');const text=json+'\n';if(Buffer.byteLength(text)>262144)throw Error('Receipt capacity262144');return text;}
/** @param {Data[]} rows @param {Data} row */
export function appendQuery(rows,row){if(rows.length>=256)throw Error('Query capacity256');const text=JSON.stringify(row);if(Buffer.byteLength(text)>65536)throw Error('Query bytes65536');rows.push(JSON.parse(text));}
/** @param {number} count */
export function spawnAdmitted(count){return Number.isSafeInteger(count)&&count>=0&&count<64;}
/** @param {boolean} present @param {unknown} primary @param {unknown[]} cleanup */
export function combineFailure(present,primary,cleanup){if(present&&cleanup.length)return new AggregateError([primary,...cleanup],'Original capability and independent cleanup');if(present)return primary;if(cleanup.length)return new AggregateError(cleanup,'Independent capability cleanup');return null;}
/** @param {unknown} value @returns {Data} */
export function diagnostic(value) {
 let nodes=0;const seen=new WeakSet();
 /** @param {unknown} item @returns {Data} */function visit(item) {
  if(nodes++>=32)return {type:'unavailable',reason:'Diagnostic nodes32'};
  const type=item===null?'null':typeof item;
  if(item===null||type==='boolean'||type==='number')return {type,value:typeof item==='number'&&!Number.isFinite(item)?String(item):item};
  if(type==='undefined')return {type};if(typeof item==='string')return {type,value:item.slice(0,8192),truncated:item.length>8192};
  if(item&&typeof item==='object') {
   if(seen.has(item))return {type:'unavailable',reason:'Original diagnostic cycle'};seen.add(item);
   if(item instanceof AggregateError) {
    const errors=Object.getOwnPropertyDescriptor(item,'errors');
    if(errors&&'value'in errors&&Array.isArray(errors.value))return {type:'aggregate',errors:errors.value.slice(0,32).map(visit),omitted:Math.max(0,errors.value.length-32)};
   }
   const message=Object.getOwnPropertyDescriptor(item,'message');return {type,message:message&&'value'in message&&typeof message.value==='string'?message.value.slice(0,8192):'Opaque original value'};
  }
  return {type,reason:'Opaque original value'};
 }
 return visit(value);
}
