// Source-only genuine AIMock fixtures. No preparation, browser or capture authority.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {createLongThreadFixture,canonicalSerialize} from '../../packages/contract/dist/index.js';
import {compileCanonicalHistoryRestoreFixture} from '../../tests/fixtures/aimock.ts';

const owned=new WeakMap();
const fail=()=>{throw Error('native-large-fixture-v1-unavailable');};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function own(value,key){
 if(!value||typeof value!=='object'||types.isProxy(value))fail();
 const descriptor=Object.getOwnPropertyDescriptor(value,key);
 if(!descriptor||!Object.hasOwn(descriptor,'value'))fail();
 return descriptor.value;
}
// Compare against the finite canonical structure, without invoking caller hooks.
function exact(value,expected){
 if(expected===null||typeof expected!=='object'){if(value!==expected)fail();return;}
 if(!value||typeof value!=='object'||types.isProxy(value))fail();
 if(Object.getPrototypeOf(value)!==Object.getPrototypeOf(expected))fail();
 const keys=Reflect.ownKeys(expected);if(Reflect.ownKeys(value).length!==keys.length)fail();
 for(const key of keys)exact(own(value,key),expected[key]);
}
function fixtureIdentity(count){return {threadId:`native-history${count}-source-v1`,runId:`native-history${count}-restore-v1`,epochMs:0};}
function project(count,source,compiled,genuine=false){
 try{
  const canonical=createLongThreadFixture({seed:1,historyCount:count,responseBytes:6400,journey:'history-reading'});
  exact(source,canonical);
  const identity=fixtureIdentity(count),messages=canonical.history.map(({id,role,text})=>({id,role,content:text}));
  const clock=scheduledMs=>({timestamp:scheduledMs,metadata:{clock:'synthetic-canonical-history-restore-ms',epochMs:0,scheduledMs}});
  const events=[{type:'RUN_STARTED',threadId:identity.threadId,runId:identity.runId,...clock(0)},{type:'MESSAGES_SNAPSHOT',messages,...clock(1)},{type:'RUN_FINISHED',threadId:identity.threadId,runId:identity.runId,...clock(2)}];
  exact(own(compiled,'input'),{threadId:identity.threadId,runId:identity.runId,messages:[]});exact(own(compiled,'events'),events);
  const digests={sourceSha256:hash(canonicalSerialize(canonical)),eventsSha256:hash(canonicalSerialize(events)),historySha256:hash(canonicalSerialize(messages))};
  exact(own(compiled,'digests'),digests);
  const profile=`native-history${count}-v1`,chunks=[],bytes=[];
  for(let start=0;start<count;start+=100){
   const data=Buffer.from(JSON.stringify(canonical.history.slice(start,start+100)));if(data.length>65536)fail();
   bytes.push(data);chunks.push(Object.freeze({index:chunks.length,start,count:100,bytes:data.length,sha256:hash(data)}));
  }
  const projection=JSON.stringify(canonical.history);
  const commitment={schema:1,profile,historyCount:count,chunks};
  const manifest=Object.freeze({schema:1,profile,origin:genuine?'actual-aimock-compiler':'authored-canonical-projection',identity:Object.freeze(identity),workload:Object.freeze({seed:1,historyCount:count,responseBytes:6400,journey:'history-reading'}),historyCount:count,chunkCount:chunks.length,chunks:Object.freeze(chunks),digests:Object.freeze({...digests,projectionSha256:hash(projection),projectionBytes:Buffer.byteLength(projection),chunksSha256:hash(canonicalSerialize(commitment))}),authority:false});
  if(Buffer.byteLength(JSON.stringify(manifest))>65536)fail();
  // Public structural projection cannot grant the private invocation capability.
  if(genuine)owned.set(manifest,{profile,bytes});return manifest;
 }catch{fail();}
}
function compile(count){
 const source=createLongThreadFixture({seed:1,historyCount:count,responseBytes:6400,journey:'history-reading'});
 return project(count,source,compileCanonicalHistoryRestoreFixture(source,fixtureIdentity(count)),true);
}
export function compileHistory1000SourceFixtureV1(){return compile(1000);}
export function compileHistory10000SourceFixtureV1(){return compile(10000);}
export function projectHistory1000SourceFixtureV1(source,compiled){return project(1000,source,compiled);}
export function projectHistory10000SourceFixtureV1(source,compiled){return project(10000,source,compiled);}
export function inspectLargeFixtureV1(admission,profile){
 const value=owned.get(admission);if(!value||value.profile!==profile)fail();return admission;
}
export function readLargeFixtureChunkV1(admission,profile,index){
 inspectLargeFixtureV1(admission,profile);const value=owned.get(admission);
 if(!Number.isSafeInteger(index)||index<0||index>=value.bytes.length)fail();
 return Buffer.from(value.bytes[index]);
}
