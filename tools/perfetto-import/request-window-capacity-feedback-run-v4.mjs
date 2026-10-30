import {constants} from 'node:fs';
import {open,lstat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {isAbsolute,resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as acquisition from '../native-real-chat/request-window-run-v2.mjs';
import {REQUEST_WINDOW_RECIPE,projectRequestWindow} from '../native-real-chat/request-window-core.mjs';
import {runBrowserPresentationFeedbackObservationsCapacityV3} from './feedback-observations-capacity-run-v3.mjs';

const SCHEMA='native-stock033-request-window-capacity-feedback-v4',BASE=dirname(fileURLToPath(import.meta.url));
const FEEDBACK_POLICY='browser-feedback-whole-graph-capacity-v3';
const PINS=Object.freeze({'feedback-observations-capacity-source-model-v3.json':'02807672dea27faa9f09bb1bc820c629d25ff97713b972d8f45b16f919c887ca','feedback-observations-capacity-core-v3.mjs':'eca4313c09dc65b8fe9e40fb822cbad3834666327888292458b97c3d6d344697','feedback-target-compact-v2.sql':'ddec24b51eca013800a209acaa6f544c9cc4acfc6e9354a7353f246efc11e27a','feedback-scope-compact-v2.sql':'cdb643939620ed2e8985ee48eb95d1d6397caf349dfb632ae728f1eee992c10d'});
const BOUNDARIES=Object.freeze({fps:null,exhaustivePopulation:false,nativeSupported:false,captureQualified:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
const ensure=(condition,reason)=>{if(!condition)throw Error(reason);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function own(v,k){ensure(v&&typeof v==='object'&&!types.isProxy(v),'own-data');const d=Object.getOwnPropertyDescriptor(v,k);ensure(d&&Object.hasOwn(d,'value'),'own-data');return d.value;}
function decimal(v){ensure(typeof v==='string'&&v.length<=40&&/^(0|[1-9][0-9]*)$/.test(v),'normalized-nanoseconds');return BigInt(v);}
function boundedData(root){const stack=[root];let nodes=0,width=0,strings=0;while(stack.length){const v=stack.pop();ensure(++nodes<=65536,'result-capacity');if(typeof v==='string'){const bytes=Buffer.byteLength(v);ensure(bytes<=524288&&strings+bytes<=524288,'result-capacity');strings+=bytes;width+=Buffer.byteLength(JSON.stringify(v));}else if(v===null||typeof v==='boolean'){width+=5;}else if(typeof v==='number'){ensure(Number.isFinite(v),'result-data');width+=String(v).length;}else{ensure(v&&typeof v==='object'&&!types.isProxy(v),'result-data');ensure(Array.isArray(v)||[null,Object.prototype].includes(Object.getPrototypeOf(v)),'result-data');const keys=Reflect.ownKeys(v);width+=keys.length*3+2;ensure(keys.length<=65536,'result-capacity');for(const key of keys){if(Array.isArray(v)&&key==='length')continue;ensure(typeof key==='string','result-data');ensure(nodes+stack.length+2<=65536,'result-capacity');stack.push(key,own(v,key));}}ensure(width<=1048576&&strings<=524288,'result-capacity');}return root;}

// Explicitly authored structural API. Only the production entry below can
// connect this projection to an original acquisition and original capacity return.
export function projectAuthoredRequestWindowCapacityFeedbackV4(observation,facts){
 boundedData(observation);boundedData(facts);
 ensure(own(observation,'schema')==='browser-presentation-feedback-observations-capacity-v3'&&own(observation,'status')==='observed'&&own(observation,'capacityProfile')==='whole-graph-capacity-v3'&&own(observation,'wireFormat')==='compact-v2','whole-capacity-refusal');
 ensure(own(observation,'executionEvidence')==='source-owned-official-run'&&own(observation,'inputOrigin')==='verified-generated-official-compact-csv'&&own(observation,'clockContract')==='official-perfetto-normalized-nanoseconds-v1','capacity-origin');
 for(const [key,value]of Object.entries(BOUNDARIES))ensure(own(observation,key)===value,'capacity-authority');
 ensure(own(facts,'inputRecipe')===REQUEST_WINDOW_RECIPE,'input-recipe');
 ensure(own(facts,'phaseInspectionPolicy')==='request-window-postcapture-owned-v12-v1','phase-inspection-policy');
 const binding=own(facts,'binding'),names=own(facts,'phaseNames'),interval=own(observation,'interval');
 const start=decimal(own(interval,'startTs')),end=decimal(own(interval,'endTs'));
 ensure(own(interval,'membership')==='terminal-in-[start,end)'&&decimal(own(interval,'durationNs'))===end-start,'capacity-interval');
 const window=projectRequestWindow({schema:1,inputRecipe:REQUEST_WINDOW_RECIPE,nonce:own(binding,'nonce'),start:{name:own(names,'start'),tsNs:start.toString()},end:{name:own(names,'end'),tsNs:end.toString()},window:{startNs:(start+500000000n).toString(),endNs:(start+1500000000n).toString()}});
 const events=own(observation,'events');ensure(Array.isArray(events)&&events.length<=65536&&decimal(own(observation,'count'))===BigInt(events.length),'capacity-events');
 const selected=[],seen=new Set();let previous=null;
 for(let i=0;i<events.length;i++){const e=own(events,String(i)),ts=decimal(own(e,'terminalTs')),id=own(e,'displayTraceId');ensure(typeof id==='string'&&/^(0|-?[1-9][0-9]*)$/.test(id)&&id.length<=40&&!seen.has(id),'capacity-display-identity');seen.add(id);ensure(ts>=start&&ts<end&&(previous===null||ts>previous.ts||(ts===previous.ts&&BigInt(id)>previous.id)),'capacity-event-membership');previous={ts,id:BigInt(id)};if(ts>=start+500000000n&&ts<start+1500000000n)selected.push(e);}
 const count=BigInt(selected.length);
 return {schema:SCHEMA,capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2',status:'observed',feedbackPolicy:FEEDBACK_POLICY,phaseInspectionPolicy:own(facts,'phaseInspectionPolicy'),executionEvidence:'authored-structural-projection-only',inputRecipe:REQUEST_WINDOW_RECIPE,fixtureProfile:own(facts,'fixtureProfile'),binding:{...binding},phaseNames:{...names},metric:'observed-successful-browser-feedback-hz',intervalMeaning:'request-anchored-includes-startup-and-queue-time',interval:{startTs:window.window.startNs,endTs:window.window.endNs,durationNs:'1000000000',membership:'terminal-in-[start,end)'},count:count.toString(),observedHz:{numerator:count.toString(),denominator:'1',unit:'s^-1',exact:true},events:selected,coverage:own(observation,'coverage'),diagnostics:own(observation,'diagnostics'),...BOUNDARIES};
}

const identity=s=>Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(k=>[k,String(s[k])]));
async function checkExpectedIdentity(expected,id,handle){
 ensure(expected&&typeof expected==='object'&&!types.isProxy(expected)&&[Object.prototype,null].includes(Object.getPrototypeOf(expected)),'identity-codec');
 const keys=Reflect.ownKeys(expected),native=['dev','ino','size','mtimeMs','ctimeMs'],privateNs=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];
 const hasExact=fields=>keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key));
 if(hasExact(native)){
  // Native preparation owns numeric Stats fields. Compare the same original
  // codec directly, never convert nanoseconds to a floating approximation.
  const numeric=await handle.stat();
  for(const key of native){const value=own(expected,key);ensure(Number.isFinite(value)&&value===numeric[key]&&(!['dev','ino','size'].includes(key)||Number.isSafeInteger(value)),'file-commitment');}
 }else{
  ensure(hasExact(privateNs),'identity-codec');
  for(const key of privateNs){const value=own(expected,key);ensure(typeof value==='string'&&/^-?(0|[1-9][0-9]*)$/.test(value)&&value!=='-0'&&value===id[key],'file-commitment');}
 }
}
async function snapshot(path,limit,check,expected=null,retain=false){
 check();const ls=await lstat(path,{bigint:true});ensure(ls.isFile()&&ls.nlink===1n&&ls.size<=BigInt(limit),'file-custody');
 const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  check();const first=await h.stat({bigint:true}),id=identity(first);
  ensure(first.isFile()&&first.nlink===1n&&first.size<=BigInt(limit)&&equal(id,identity(ls))&&equal(id,identity(await lstat(path,{bigint:true}))),'file-custody');
  if(expected?.identity!==undefined)await checkExpectedIdentity(expected.identity,id,h);
  const digest=createHash('sha256'),parts=[],chunk=Buffer.alloc(65536);let bytes=0;
  for(;;){check();const n=(await h.read(chunk,0,Math.min(chunk.length,limit+1-bytes),bytes)).bytesRead;check();if(!n)break;bytes+=n;ensure(bytes<=limit,'file-capacity');digest.update(chunk.subarray(0,n));if(retain)parts.push(Buffer.from(chunk.subarray(0,n)));}
  ensure(BigInt(bytes)===first.size&&equal(id,identity(await h.stat({bigint:true})))&&equal(id,identity(await lstat(path,{bigint:true}))),'file-custody');
  const fact={path,bytes,sha256:digest.digest('hex'),identity:id};
  if(expected)ensure((expected.path===undefined||expected.path===path)&&(expected.bytes===undefined||expected.bytes===bytes)&&(expected.sha256===undefined||expected.sha256===fact.sha256),'file-commitment');
  return{fact,contents:retain?Buffer.concat(parts):null};
 }finally{await h.close();check();}
}
async function sources(check){const out={};let total=0;for(const [name,pin]of Object.entries(PINS)){out[name]=(await snapshot(join(BASE,name),262144,check,{sha256:pin})).fact;total+=out[name].bytes;}for(const path of[fileURLToPath(import.meta.url),...['feedback-observations-capacity-run-v3.mjs','feedback-observations-capacity-export-v3.mjs'].map(name=>join(BASE,name)),join(BASE,'../native-real-chat/request-window-core.mjs'),join(BASE,'../native-real-chat/request-window-run-v2.mjs')]){const f=(await snapshot(path,262144,check)).fact;out[path]=f;total+=f.bytes;}ensure(total<=1048576,'source-capacity');return out;}
function configOf(raw){ensure(typeof raw==='string'&&Buffer.byteLength(raw)<=16384,'invalid-config');const c=JSON.parse(raw),expected={schema:c.schema,feedbackPolicy:c.feedbackPolicy,processor:{path:c.processor?.path,sha256:c.processor?.sha256},out:c.out,deadlineMs:c.deadlineMs};ensure(equal(c,expected)&&JSON.stringify(expected)===raw&&c.schema===SCHEMA&&c.feedbackPolicy===FEEDBACK_POLICY,'invalid-config');const pathOK=p=>typeof p==='string'&&p.isWellFormed()&&Buffer.byteLength(p)<=4096&&isAbsolute(p)&&resolve(p)===p&&!/[\x00-\x1f\x7f-\x9f]/.test(p);ensure(pathOK(c.processor.path)&&pathOK(c.out)&&typeof c.processor.sha256==='string'&&/^[a-f0-9]{64}$/.test(c.processor.sha256)&&Number.isSafeInteger(c.deadlineMs)&&c.deadlineMs>=1&&c.deadlineMs<=60000,'invalid-config');return c;}
function refused(stage,reason){return{schema:SCHEMA,status:'unavailable',stage,reason,publication:null,originalCapacityV3:null,projection:null,...BOUNDARIES};}
async function writePublication(path,payload,check){ensure(payload.length<=1048576,'result-capacity');check();const h=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let id;try{let offset=0;while(offset<payload.length){check();const n=(await h.write(payload,offset,payload.length-offset,offset)).bytesWritten;ensure(n>0,'publication-write');offset+=n;}await h.sync();id=identity(await h.stat({bigint:true}));}finally{await h.close();}return(await snapshot(path,1048576,check,{bytes:payload.length,sha256:hash(payload),identity:id})).fact;}

export async function runRequestWindowCapacityFeedbackV4(originalAcquisition,configJSON){
 let stage='config';try{
  const config=configOf(configJSON),started=performance.now();const check=()=>ensure(performance.now()-started<240000,'elapsed-budget');
  stage='acquisition';const facts=acquisition.inspectRequestWindowAcquisitionV2(originalAcquisition);ensure(equal(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition)),'acquisition-drift');boundedData(facts);
  ensure(facts.inputRecipe===REQUEST_WINDOW_RECIPE&&facts.trace.identity&&facts.publication.identity,'acquisition-origin');
  for(const path of[facts.trace.path,facts.publication.path,config.processor.path])ensure(config.out!==path&&!config.out.startsWith(path+'/')&&!path.startsWith(config.out+'/'),'output-alias');
  stage='phase-inspection';const phaseInspection=await acquisition.inspectRequestWindowPhaseQualificationV2(originalAcquisition);ensure(equal(phaseInspection.facts,facts),'phase-inspection-binding');boundedData(phaseInspection);const phaseIdentity=own(phaseInspection.publication,'identity'),phaseIdentityKeys=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];ensure(Array.isArray(phaseIdentity)&&phaseIdentity.length===7&&phaseIdentity.every(v=>typeof v==='string'&&/^-?(0|[1-9][0-9]*)$/.test(v)&&v!=='-0'),'phase-identity-codec');const expectedPhasePublication={...phaseInspection.publication,identity:Object.fromEntries(phaseIdentityKeys.map((k,i)=>[k,phaseIdentity[i]]))};const phasePublication=(await snapshot(phaseInspection.publication.path,65536,check,expectedPhasePublication)).fact;
  stage='source';const before=await sources(check),runtime=(await snapshot(process.execPath,268435456,check)).fact;
  const originalTrace=(await snapshot(facts.trace.path,33554432,check,facts.trace)).fact,originalPublication=(await snapshot(facts.publication.path,1048576,check,facts.publication)).fact;
  await mkdir(config.out,{mode:0o700});
  stage='capacity-v3';const originalCapacityV3=await runBrowserPresentationFeedbackObservationsCapacityV3(JSON.stringify({schema:'browser-presentation-feedback-observations-capacity-v3',capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2',trace:{path:originalTrace.path,bytes:originalTrace.bytes,sha256:originalTrace.sha256},processor:config.processor,target:facts.target,phaseNames:facts.phaseNames,out:join(config.out,'capacity-v3'),deadlineMs:config.deadlineMs}));check();
  ensure(originalCapacityV3?.status==='observed'&&originalCapacityV3.stage===null&&originalCapacityV3.reason===null&&originalCapacityV3.publication,'whole-capacity-refusal');
  stage='capacity-publication';const published=await snapshot(originalCapacityV3.publication.path,1048576,check,originalCapacityV3.publication,true);ensure(published.contents.toString('utf8')===JSON.stringify({schema:'browser-presentation-feedback-observations-capacity-v3',capacityProfile:'whole-graph-capacity-v3',wireFormat:'compact-v2',publicationState:'provisional-snapshot-requires-original-returned-receipt',observation:originalCapacityV3.observation}),'capacity-publication-content');
  stage='projection';const authored=projectAuthoredRequestWindowCapacityFeedbackV4(originalCapacityV3.observation,facts),projection={...authored,executionEvidence:'source-owned-original-capacity-v3-composition',inputOrigin:originalCapacityV3.observation.inputOrigin,traceOrigin:'original-source-owned-request-window-acquisition',clockContract:originalCapacityV3.observation.clockContract};
  async function bookends(){check();ensure(equal(facts,await acquisition.verifyRequestWindowAcquisitionV2(originalAcquisition)),'acquisition-drift');await snapshot(originalTrace.path,33554432,check,originalTrace);await snapshot(originalPublication.path,1048576,check,originalPublication);await snapshot(published.fact.path,1048576,check,published.fact);await snapshot(phasePublication.path,65536,check,phasePublication);ensure(equal(before,await sources(check)),'source-bookend');await snapshot(runtime.path,268435456,check,runtime);check();}
  stage='custody';await bookends();
  const result={schema:SCHEMA,feedbackPolicy:FEEDBACK_POLICY,status:'observed',stage:null,reason:null,publicationState:'provisional-snapshot-requires-original-returned-receipt',originalCapacityV3,projection,evidence:{phaseInspectionPublication:phasePublication,sourcesBefore:before,runtimeBefore:runtime,acquisitionPublication:originalPublication,capacityPublication:published.fact,sourceExecutionAssumption:'fresh-trusted-process-reviewed-modules',localExecutionAssumption:'fresh-trusted-process-no-concurrent-local-mutation'},...BOUNDARIES};boundedData(result);
  stage='publication';const publication=await writePublication(join(config.out,'result.json'),Buffer.from(JSON.stringify(result)),check);
  stage='custody';await bookends();await snapshot(publication.path,1048576,check,publication);
  check();return{...result,publication};
 }catch(error){return refused(stage,typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'operation-failed');}
}
