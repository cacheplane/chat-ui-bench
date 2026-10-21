// SOURCE-ONLY fixture projection model. No browser, readiness or capture authority.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {createLongThreadFixture,canonicalSerialize} from '../../packages/contract/dist/index.js';
const fail=()=>{throw Error('native-chat-fixture');};
const hash=value=>createHash('sha256').update(canonicalSerialize(value)).digest('hex');
function own(value,key){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))fail();return d.value;}
function exact(value,expected){
 if(expected===null||typeof expected!=='object'){if(value!==expected)fail();return;}
 if(value===null||typeof value!=='object'||types.isProxy(value))fail();
 if(Array.isArray(expected)){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||own(value,'length')!==expected.length)fail();
  if(Reflect.ownKeys(value).length!==expected.length+1)fail();for(let i=0;i<expected.length;i++)exact(own(value,i),expected[i]);return;
 }
 if(Object.getPrototypeOf(value)!==Object.prototype)fail();const keys=Object.keys(expected);
 if(Reflect.ownKeys(value).length!==keys.length)fail();for(const key of keys)exact(own(value,key),expected[key]);
}
/** Trusted source compiler output only. This equality check does not authenticate a caller DTO as an AIMock invocation. */
export function projectCompiledHistory(source,compiled,identity){
 try{
  const canonical=createLongThreadFixture({seed:1,historyCount:100,responseBytes:6400,journey:'history-reading'});exact(source,canonical);
  if(!identity||types.isProxy(identity)||Object.getPrototypeOf(identity)!==Object.prototype)fail();
  const threadId=own(identity,'threadId'),runId=own(identity,'runId'),epochMs=own(identity,'epochMs');
  if(typeof threadId!=='string'||typeof runId!=='string'||threadId.length>128||runId.length>128||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(threadId)||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(runId)||!Number.isSafeInteger(epochMs)||epochMs<0||!Number.isSafeInteger(epochMs+10000))fail();
  if(compiled===null||typeof compiled!=='object'||types.isProxy(compiled)||Object.getPrototypeOf(compiled)!==Object.prototype)fail();
  const messages=canonical.history.map(({id,role,text})=>({id,role,content:text}));
  const clock=i=>({timestamp:epochMs+i,metadata:{clock:'synthetic-canonical-history-restore-ms',epochMs,scheduledMs:i}});
  const events=[{type:'RUN_STARTED',threadId,runId,...clock(0)},{type:'MESSAGES_SNAPSHOT',messages,...clock(1)},{type:'RUN_FINISHED',threadId,runId,...clock(2)}];
  exact(own(compiled,'input'),{threadId,runId,messages:[]});exact(own(compiled,'events'),events);
  const digests={sourceSha256:hash(canonical),eventsSha256:hash(events),historySha256:hash(messages)};exact(own(compiled,'digests'),digests);
  const snapshot=own(own(compiled,'events'),1),history=own(snapshot,'messages').map(message=>Object.freeze({id:own(message,'id'),role:own(message,'role'),text:own(message,'content'),status:'complete'}));
  return Object.freeze({status:'source-fixture-verified',history:Object.freeze(history),digests:Object.freeze(digests),authority:false});
 }catch{fail();}
}
